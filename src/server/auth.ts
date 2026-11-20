// SIGN-IN AND SESSIONS
// --------------------
// How signing in works:
//   1. The browser posts an email and password to /api/auth/login.
//   2. login() checks the password against the stored bcrypt hash.
//   3. On success it makes a long random token, stores only the HASH of it in the
//      sessions table, and the route sends the token itself to the browser in a cookie.
//   4. On every later request the cookie comes back; getUserByToken() hashes it, finds
//      the session row, checks it has not expired, and loads the user.
//   5. Signing out deletes the session row, so the cookie stops working immediately.
//
// API routes call requireRole(); pages call pageUser() in page-auth.ts. Both end up in
// getUserByToken(), so there is one place where "who is this?" is decided.

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, transaction } from "@/db/client";
import { sessions, users, type Role } from "@/db/schema";
import { AppError } from "./errors";

export const SESSION_COOKIE = "harbour_session";
const SESSION_HOURS = 8; // roughly one working day
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 60_000; // how long an account is locked after too many wrong passwords

// What the rest of the app knows about the signed-in person. Deliberately excludes the
// password hash, so it can never be sent anywhere by accident.
export type SessionUser = { id: string; name: string; email: string; role: Role; title: string };

// Only the hash of a session token is stored, so a leaked database cannot be used to sign in.
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Compared against when the email is unknown, so both cases take the same time.
// Without this, a fast "no such email" answer would reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(email: unknown, password: unknown): Promise<{ token: string; user: SessionUser }> {
  // ONE answer for every failure: unknown email, wrong password, and a locked account all
  // get the same status and the same words. If any of them answered differently, someone
  // could try a list of emails and learn which ones have accounts here.
  // (The message mentions the pause so that a real person who is locked out knows to wait.)
  const wrong = new AppError(
    401,
    "Email or password is incorrect. After five wrong attempts, sign-in for that account pauses for one minute.",
  );
  if (typeof email !== "string" || typeof password !== "string") throw wrong;

  const user = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
  // Unknown email, or temporarily locked after repeated failures (a locked account refuses
  // even the correct password). Still spend the time a real password check takes, so the
  // speed of the answer gives nothing away either.
  if (!user || user.lockedUntil > Date.now()) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw wrong;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    // Count the failure. On the fifth, lock the account for a minute and start counting again.
    // The count is re-read inside the transaction so two wrong guesses arriving together
    // are both counted.
    await transaction(async () => {
      const fresh = await db.query.users.findFirst({ where: eq(users.id, user.id) });
      const failed = (fresh?.failedLogins ?? 0) + 1;
      const locked = failed >= MAX_FAILED_LOGINS;
      await db
        .update(users)
        .set({ failedLogins: locked ? 0 : failed, lockedUntil: locked ? Date.now() + LOCK_MS : 0 })
        .where(eq(users.id, user.id));
    });
    throw wrong;
  }

  // 32 random bytes: impossible to guess. The browser gets the token; we keep its hash.
  const token = randomBytes(32).toString("base64url");
  // Correct password: clear the failure count, remove any sessions that have expired,
  // and create the new session, as one all-or-nothing change.
  await transaction(async () => {
    await db.update(users).set({ failedLogins: 0, lockedUntil: 0 }).where(eq(users.id, user.id));
    await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
    await db.insert(sessions).values({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: Date.now() + SESSION_HOURS * 3600_000,
    });
  });
  return { token, user: toSessionUser(user) };
}

// Sign out: delete the session row. The cookie is then worthless even if someone kept a copy.
export async function logout(token: string | null) {
  if (token) await transaction(() => db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).then(() => {}));
}

// Turns a cookie value into a user, or null if the token is missing, unknown or expired.
export async function getUserByToken(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.query.sessions.findFirst({ where: eq(sessions.tokenHash, hashToken(token)) });
  if (!session || session.expiresAt < Date.now()) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  return user ? toSessionUser(user) : null;
}

// Reads our cookie out of a request's "Cookie" header, which looks like "a=1; harbour_session=xyz; b=2".
// Done by hand (rather than with Next.js helpers) so that API routes can be tested with plain Request objects.
export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

// Used by every API route: 401 when not signed in, 403 when signed in with the wrong role.
export async function requireRole(req: Request, role: Role): Promise<SessionUser> {
  const user = await getUserByToken(tokenFromRequest(req));
  if (!user) throw new AppError(401, "Please sign in.");
  if (user.role !== role) throw new AppError(403, "You do not have access to this.");
  return user;
}

// The Set-Cookie header value that signs a browser in.
//   HttpOnly      page JavaScript cannot read the cookie, so a script injected into a page cannot steal it
//   SameSite=Lax  the browser does not send it on requests made by other websites
//   Secure        only sent over HTTPS (added when deployed; plain http://localhost is used in development)
//   Max-Age       the browser forgets it after the same 8 hours as the server
export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}

// The Set-Cookie header value that signs a browser out (Max-Age=0 tells it to delete the cookie).
export function clearedCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// Copies only the safe fields from a database row.
function toSessionUser(u: typeof users.$inferSelect): SessionUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, title: u.title };
}

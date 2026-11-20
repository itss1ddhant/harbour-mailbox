// The page-side twin of requireRole in auth.ts. Pages read the cookie through Next.js
// (cookies()) and redirect instead of answering 401/403.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/db/schema";
import { getUserByToken, SESSION_COOKIE, type SessionUser } from "./auth";

// The signed-in person for the page being built, or null.
export async function currentUser(): Promise<SessionUser | null> {
  return getUserByToken((await cookies()).get(SESSION_COOKIE)?.value);
}

// Where each kind of user lands after signing in.
export const homeFor =(role: Role) => (role === "staff" ? "/staff" : "/portal");

// Called at the top of every staff and portal page and layout.
// Not signed in -> login page. Signed in with the other role -> their own home.
// redirect() stops the page there, so the code after a pageUser() call always has a user.
export async function pageUser(role: Role): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}

// Shared helpers for the tests: a fresh copy of the demo data, a way to call an API
// route directly, and a way to sign in.

import { runMigrations } from "@/db/client";
import { emailFor, passwordFor, seed, wipe } from "@/db/seed";
import { POST as loginRoute } from "@/app/api/auth/login/route";

const BASE = "http://localhost:3000";

// A clean copy of the Monday-morning mailbox.
export async function freshMailbox() {
  await runMigrations();
  await wipe();
  return seed();
}

type Handler = (req: Request, context: { params: Promise<any> }) => Promise<Response>;

// Calls an API route exactly as Next.js would, without starting a server.
// A route file exports plain functions (GET, POST) that take a Request and return a
// Response, so a test can build a Request by hand and call them directly.
//   cookie  the session cookie from signIn(), or omitted to act as a signed-out visitor
//   params  the URL parameters, e.g. { id: threadId }
//   origin  defaults to our own site; set to another site to test the cross-site check
// Returns the status, the raw text (handy for "does this text appear anywhere?") and the parsed JSON.
export async function call(
  handler: Handler,
  options: { method?: string; cookie?: string; body?: unknown; params?: Record<string, string>; origin?: string; url?: string } = {},
) {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { host: "localhost:3000" };
  if (options.cookie) headers.cookie = options.cookie;
  if (method !== "GET") {
    headers["content-type"] = "application/json";
    headers.origin = options.origin ?? BASE;
  }
  const req = new Request(options.url ?? `${BASE}/api/test`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
  });
  const res = await handler(req, { params: Promise.resolve(options.params ?? {}) });
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null, headers: res.headers };
}

// Signs in through the real login route (with that person's own demo password unless
// another is given) and returns the session cookie.
export async function signIn(key: string, password = passwordFor(key)) {
  const res = await call(loginRoute as Handler, { method: "POST", body: { email: emailFor(key), password } });
  if (res.status !== 200) throw new Error(`Login failed for ${key}: ${res.text}`);
  return res.headers.get("set-cookie")!.split(";")[0];
}

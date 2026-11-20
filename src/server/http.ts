// API ROUTE WRAPPER
// -----------------
// Shared wrapper for API routes: same-origin check, sign-in and role check, JSON parsing, error replies.
//
// Every file under src/app/api exports its handlers through route() or publicRoute(),
// for example:
//     export const POST = route("staff", async ({ user, params, body }) => { ... });
// so each handler is a few lines of real work, and the checks below cannot be forgotten.
//
// What happens to a request, in order:
//   1. requireRole  is there a valid session, and is it the right role?   -> 401 / 403
//   2. readBody     (not for GET) same-origin + JSON checks, then parse   -> 403 / 415 / 400
//   3. the handler runs (inside a database transaction if it is not a GET, so its
//      changes are all-or-nothing); whatever it returns is sent back as JSON
//   4. an AppError thrown anywhere becomes { error: message } with its status;
//      anything else is logged on the server and answered with a generic 500.

import { transaction } from "@/db/client";
import type { Role } from "@/db/schema";
import { requireRole, type SessionUser } from "./auth";
import { AppError } from "./errors";

// Body: the parsed JSON, with values of unknown type so each handler must check them.
// Ctx:  what a handler receives. P is the shape of the URL parameters, e.g. { id: string }.
type Body = Record<string, unknown>;
type Ctx<P> = { req: Request; user: SessionUser; params: P; body: Body };
type PublicCtx = { req: Request; body: Body };

// Requests that change data must come from our own pages and be JSON.
// Together with the SameSite cookie, this stops another website acting as a signed-in user.
// Browsers attach an Origin header saying which site a request came from; if it names a
// different host from ours, refuse. Requiring a JSON content type also blocks plain HTML
// forms on other sites, which cannot send JSON.
// (x-forwarded-host is the public host name when running behind a proxy such as Vercel.)
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host) {
    // An Origin that is not a proper address (sandboxed pages send the word "null") is
    // treated as another site, not as a server error.
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (originHost !== host) throw new AppError(403, "Cross-site request refused.");
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    throw new AppError(415, "Send JSON.");
  }
}

// GET requests have no body and change nothing, so they skip the checks.
// Anything else must pass the same-origin check and contain a JSON object.
async function readBody(req: Request): Promise<Body> {
  if (req.method === "GET") return {};
  assertSameOrigin(req);
  const parsed = await req.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new AppError(400, "Invalid request.");
  return parsed as Body;
}

// A handler may return a ready-made Response (login does, to set the cookie),
// any value to be sent as JSON, or nothing at all.
function reply(result: unknown) {
  return result instanceof Response ? result : Response.json(result ?? { ok: true });
}

function fail(err: unknown) {
  if (err instanceof AppError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

// For routes that need a signed-in user of a given role ("staff" or "client").
// `context.params` is a Promise because that is how Next.js passes URL parameters.
export function route<P = object>(role: Role, fn: (ctx: Ctx<P>) => Promise<unknown>) {
  return async (req: Request, context: { params: Promise<P> }) => {
    try {
      const user = await requireRole(req, role); // before anything else: no session, no information
      const body = await readBody(req);
      const params = await context.params;
      const handle = () => fn({ req, user, params, body });
      // Anything that changes data runs as one transaction: if the handler throws part-way
      // (a rule refuses the change, say), everything it had already written is undone.
      // GET requests only read, so they do not need one.
      return reply(req.method === "GET" ? await handle() : await transaction(handle));
    } catch (err) {
      return fail(err);
    }
  };
}

// For the two routes that work without a session: login and logout.
export function publicRoute(fn: (ctx: PublicCtx) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      return reply(await fn({ req, body: await readBody(req) }));
    } catch (err) {
      return fail(err);
    }
  };
}

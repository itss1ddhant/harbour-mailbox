// POST /api/auth/logout
// Deletes the session from the database and tells the browser to delete its cookie.
// Public, so it also works when the session has already expired.

import { clearedCookie, logout, tokenFromRequest } from "@/server/auth";
import { publicRoute } from "@/server/http";

export const POST = publicRoute(async ({ req }) => {
  await logout(tokenFromRequest(req));
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearedCookie() } });
});

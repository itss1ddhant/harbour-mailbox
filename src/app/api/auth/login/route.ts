// POST /api/auth/login   body: { email, password }
// Public (no session needed). Checks the password and, on success, answers with the
// session cookie and the person's role so the login page knows where to send them.
// Wrong details -> 401 with a generic message. Locked account -> 429.

import { login, sessionCookie } from "@/server/auth";
import { publicRoute } from "@/server/http";

export const POST = publicRoute(async ({ body }) => {
  const { token, user } = await login(body.email, body.password);
  return Response.json(
    { ok: true, role: user.role, name: user.name },
    { headers: { "Set-Cookie": sessionCookie(token) } },
  );
});

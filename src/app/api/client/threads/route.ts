// GET  /api/client/threads   the signed-in client's conversations
// POST /api/client/threads   body: { subject, body }   start a new conversation
// Clients only. Both use the client's own id from the session, never an id sent by the
// browser, so a client cannot ask for somebody else's list.

import { listClientThreads } from "@/server/client-view";
import { route } from "@/server/http";
import { startClientThread } from "@/server/messages";

export const GET = route("client", async ({ user }) => ({ threads: await listClientThreads(user.id) }));

export const POST = route("client", async ({ user, body }) => ({
  id: await startClientThread(user, body.subject, body.body),
}));

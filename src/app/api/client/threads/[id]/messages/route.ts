// POST /api/client/threads/:id/messages   body: { body }
// Clients only. The client writes in one of their conversations. 404 if it is not theirs.
// Saving the message may reopen a waiting request or create a new one (see requests.ts).

import { route } from "@/server/http";
import { postClientMessage } from "@/server/messages";

export const POST = route<{ id: string }>("client", async ({ params, user, body }) => ({
  id: await postClientMessage(params.id, user, body.body),
}));

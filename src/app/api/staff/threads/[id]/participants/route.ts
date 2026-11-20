// POST /api/staff/threads/:id/participants   body: { userId, reason }
// Staff only. Gives a client access to a conversation. The reason is required and recorded.
// A client calling this gets 403: clients cannot give access to anyone, including themselves.

import { route } from "@/server/http";
import { addParticipant } from "@/server/messages";

export const POST = route<{ id: string }>("staff", async ({ params, user, body }) => {
  await addParticipant(params.id, user, body.userId, body.reason);
});

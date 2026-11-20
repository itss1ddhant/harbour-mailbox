// POST /api/staff/threads/:id/messages
// Staff only. Used by both boxes at the bottom of the staff thread screen.
// body: { mode, body, draft?, requestId?, waitingFor?, addressedTo? }
// Checkboxes arrive from the form as the text "on", hence the two comparisons for draft.

import { route } from "@/server/http";
import { postInternalNote, postStaffReply } from "@/server/messages";

// mode "note"  -> internal note, optionally addressed to a colleague
// mode "reply" -> reply to the client; "draft" saves it without sending
export const POST = route<{ id: string }>("staff", async ({ params, user, body }) => {
  if (body.mode === "note") {
    return { id: await postInternalNote(params.id, user, { body: body.body, addressedTo: body.addressedTo }) };
  }
  return {
    id: await postStaffReply(params.id, user, {
      body: body.body,
      draft: body.draft === true || body.draft === "on",
      requestId: body.requestId,
      waitingFor: body.waitingFor,
    }),
  };
});

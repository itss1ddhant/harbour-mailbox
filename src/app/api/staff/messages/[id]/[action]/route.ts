// Staff only. Actions on a single message; the last part of the URL says which.
//   send      send a draft reply to the client
//   discard   delete a draft reply
//   answered  the person a note was addressed to marks it as dealt with

import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { discardDraft, markAnswered, sendDraft } from "@/server/messages";

// POST /api/staff/messages/:id/send | discard | answered
export const POST = route<{ id: string; action: string }>("staff", async ({ params, user }) => {
  switch (params.action) {
    case "send":
      return sendDraft(params.id);
    case "discard":
      return discardDraft(params.id);
    case "answered":
      return markAnswered(params.id, user);
    default:
      throw new AppError(404, "Unknown action.");
  }
});

// Staff only. One route for every change to a request; the last part of the URL says which.
// Each case calls the matching rule in src/server/requests.ts, which does the checking.
//   claim     (no body)                 take an unowned request
//   handover  { toUserId, note }        pass it to a colleague
//   wait      { waitingFor }            mark as waiting on the client
//   resume    (no body)                 stop waiting
//   close     { outcome, note? }        close with an outcome
//   reopen    (no body)                 undo a close

import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { claim, close, handOver, reopen, resume, setWaitingOnClient } from "@/server/requests";

// POST /api/staff/requests/:id/claim | handover | wait | resume | close | reopen
export const POST = route<{ id: string; action: string }>("staff", async ({ params, user, body }) => {
  switch (params.action) {
    case "claim":
      return claim(params.id, user);
    case "handover":
      return handOver(params.id, user, body.toUserId, body.note);
    case "wait":
      return setWaitingOnClient(params.id, user, body.waitingFor);
    case "resume":
      return resume(params.id, user);
    case "close":
      return close(params.id, user, body.outcome, body.note);
    case "reopen":
      return reopen(params.id, user);
    default:
      throw new AppError(404, "Unknown action.");
  }
});

// GET /api/client/threads/:id
// Clients only. One conversation, as the client is allowed to see it: no internal notes,
// no drafts. Answers 404 if the client is not a participant (see client-view.ts).

import { getClientThread } from "@/server/client-view";
import { route } from "@/server/http";

export const GET = route<{ id: string }>("client", async ({ params, user }) => getClientThread(params.id, user.id));

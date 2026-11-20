// GET /api/staff/threads/:id
// Staff only. One conversation with everything in it, including internal notes and drafts.
// The folder name [id] is how Next.js marks a URL parameter; it arrives as params.id.

import { route } from "@/server/http";
import { getStaffThread } from "@/server/staff-view";

export const GET = route<{ id: string }>("staff", async ({ params }) => getStaffThread(params.id));

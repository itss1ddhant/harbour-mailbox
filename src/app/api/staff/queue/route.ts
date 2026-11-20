// GET /api/staff/queue            my work plus all unowned work
// GET /api/staff/queue?scope=team  everyone's work
// Staff only. Returns the same data the queue page (src/app/staff/page.tsx) shows.

import { route } from "@/server/http";
import { getQueue } from "@/server/staff-view";

export const GET = route("staff", async ({ req, user }) => {
  const scope = new URL(req.url).searchParams.get("scope") === "team" ? "team" : "mine";
  return getQueue(user, scope);
});

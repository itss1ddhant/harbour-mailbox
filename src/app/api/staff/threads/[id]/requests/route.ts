// POST /api/staff/threads/:id/requests
// Staff only. "Add another request" on the thread screen.
// body: { title, ownerId?, dueDate? ("YYYY-MM-DD" from the date picker), needsAccessDecision? }
// A due date means 5pm on that day.

import { AppError } from "@/server/errors";
import { route } from "@/server/http";
import { createRequest } from "@/server/requests";

// Add a second piece of work to a thread, with its own owner.
export const POST = route<{ id: string }>("staff", async ({ params, user, body }) => {
  let dueAt: number | null = null;
  if (typeof body.dueDate === "string" && body.dueDate) {
    dueAt = Date.parse(`${body.dueDate}T17:00:00`);
    if (Number.isNaN(dueAt)) throw new AppError(400, "Due date is not a valid date.");
  }
  const id = await createRequest(params.id, user, {
    title: body.title,
    ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : null,
    dueAt,
    needsAccessDecision: body.needsAccessDecision === true || body.needsAccessDecision === "on",
  });
  return { id };
});

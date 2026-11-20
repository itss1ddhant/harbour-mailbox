// WHAT CLIENTS ARE ALLOWED TO SEE
// -------------------------------
// The ONLY code that builds data for clients. Used by the client API (/api/client/*)
// and by the portal pages. If you need to show a client something new, add it here.
// Two rules are enforced here, in the database queries themselves:
//   1. A client sees a thread only if thread_participants has a row for them.
//   2. A client sees only client messages and SENT staff replies.
//      Internal notes and drafts are never selected, so they cannot leak.
//
// A third habit keeps internal fields out: every function below builds its result by
// naming each field it returns. Database rows are never passed through whole, so a
// column added later (an internal one, say) does not reach clients by accident.
// tests/boundaries.test.ts checks all of this through the real API.

import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { messages, requests, threadParticipants, threads, users } from "@/db/schema";
import { assertParticipant } from "./messages";

// Rule 2 as a database condition: (a client message) OR (a staff reply that was sent).
// An internal_note matches neither half; nor does a draft.
const visibleToClient = or(
  eq(messages.kind, "client_message"),
  and(eq(messages.kind, "staff_reply"), eq(messages.deliveryStatus, "sent")),
);

// Turns the internal status into words for the client. The internal outcome note and the
// owner are not included; a declined request is simply shown as "Closed".
function clientStatus(r: { status: string; outcome: string | null; waitingFor: string | null }) {
  if (r.status === "closed") return r.outcome === "declined" ? "Closed" : "Completed";
  if (r.status === "waiting_on_client") return `Waiting for you: ${r.waitingFor ?? "a reply"}`;
  if (r.status === "needs_triage") return "Received. Not yet picked up by the team.";
  return "With the Harbour team.";
}

// The client-visible messages in the given threads, oldest first.
// The caller must already have checked that the client may see these threads.
async function visibleMessages(threadIds: string[]) {
  if (threadIds.length === 0) return [];
  const rows = await db
    .select({
      id: messages.id,
      threadId: messages.threadId,
      body: messages.body,
      kind: messages.kind,
      createdAt: messages.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(and(inArray(messages.threadId, threadIds), visibleToClient))
    .orderBy(asc(messages.createdAt));
  return rows.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    body: m.body,
    createdAt: m.createdAt,
    fromHarbour: m.authorRole === "staff",
    authorName: m.authorRole === "staff" ? `${m.authorName} (Harbour)` : m.authorName,
    // Staff ids are not given out. A client's own id is, so the page can label "You".
    authorId: m.authorRole === "staff" ? null : m.authorId,
  }));
}

// The requests in the given threads, reduced to what a client should know:
// the title, whether it is still open, whether it is waiting for them, and a status line.
async function visibleRequests(threadIds: string[]) {
  if (threadIds.length === 0) return [];
  const rows = await db
    .select({
      id: requests.id,
      threadId: requests.threadId,
      title: requests.title,
      status: requests.status,
      outcome: requests.outcome,
      waitingFor: requests.waitingFor,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(inArray(requests.threadId, threadIds))
    .orderBy(asc(requests.createdAt));
  return rows.map((r) => ({
    id: r.id,
    threadId: r.threadId,
    title: r.title,
    open: r.status !== "closed",
    waitingForYou: r.status === "waiting_on_client",
    status: clientStatus(r),
  }));
}

// The portal home page: every thread this client is a participant of, newest activity first.
// Rule 1 is the starting point of the query: it begins from thread_participants.
export async function listClientThreads(clientId: string) {
  const mine = await db
    .select({ id: threads.id, subject: threads.subject, createdAt: threads.createdAt })
    .from(threadParticipants)
    .innerJoin(threads, eq(threads.id, threadParticipants.threadId))
    .where(eq(threadParticipants.userId, clientId));
  const ids = mine.map((t) => t.id);
  const [allMessages, allRequests] = await Promise.all([visibleMessages(ids), visibleRequests(ids)]);

  return mine
    .map((t) => {
      const msgs = allMessages.filter((m) => m.threadId === t.id);
      const last = msgs[msgs.length - 1];
      return {
        id: t.id,
        subject: t.subject,
        lastMessage: last ? { authorName: last.authorName, body: last.body, createdAt: last.createdAt } : null,
        requests: allRequests.filter((r) => r.threadId === t.id),
        updatedAt: last?.createdAt ?? t.createdAt,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// One conversation, for the portal thread page. `sharedWith` names the other clients on
// the thread, so that (for example) Elena can see that Oliver can read the joint one.
export async function getClientThread(threadId: string, clientId: string) {
  await assertParticipant(threadId, clientId); // throws 404 for anyone else
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  const [msgs, reqs, people] = await Promise.all([
    visibleMessages([threadId]),
    visibleRequests([threadId]),
    db
      .select({ id: users.id, name: users.name })
      .from(threadParticipants)
      .innerJoin(users, eq(users.id, threadParticipants.userId))
      .where(eq(threadParticipants.threadId, threadId)),
  ]);
  return {
    id: threadId,
    subject: thread!.subject,
    sharedWith: people.filter((p) => p.id !== clientId).map((p) => p.name),
    messages: msgs,
    requests: reqs,
  };
}

// WHAT STAFF SEE
// --------------
// Data for staff screens: the work queue and the full thread (including internal notes).
// Read-only: nothing in this file changes the database.
//
//   getQueue        the home screen. Requests grouped into Unowned / Needs action /
//                   Questions for me / Waiting on client / Recently closed.
//   getStaffThread  one conversation with everything: all messages, requests with their
//                   history, who has access, and the lists needed by the forms.
//   getOutcomes     the numbers on the Outcomes page.
//   nextStep        the one-line "who acts next" sentence shown on every request.
//
// Staff may see every thread, so there is no per-thread access check here; the routes
// and pages that call these functions check that the caller is staff.

import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { messages, requestEvents, requests, threadParticipants, threads, users } from "@/db/schema";
import { AppError } from "./errors";

type RequestRow = typeof requests.$inferSelect;

export const OUTCOME_LABELS: Record<string, string> = {
  resolved: "Resolved",
  no_action_needed: "No action needed",
  declined: "Declined",
};

// One plain line: who acts next, and on what.
// The checks run from most to least urgent, and the first that applies wins.
export function nextStep(r: RequestRow, ownerName: string | null, hasDraft: boolean) {
  if (r.status === "closed") return `Closed: ${OUTCOME_LABELS[r.outcome ?? ""] ?? "done"}.`;
  if (!r.ownerId) return "Nobody owns this. Claim it or hand it to the right person.";
  if (hasDraft) return `${ownerName} has a reply drafted but not sent. Send or discard it.`;
  if (r.status === "waiting_on_client") return `Waiting on client: ${r.waitingFor}. Nothing to do until they reply.`;
  if (r.needsAccessDecision) return `${ownerName} to decide on access and record the reason.`;
  if (r.clientReplied) return `Client replied. ${ownerName} to respond or close.`;
  return `${ownerName} to finish the work, then close it with an outcome.`;
}

// The short coloured label on a queue row saying why the row is there.
// Same order of checks as nextStep above. The queue page uses these exact strings to
// pick a colour and to decide which buttons to show, so change them in both places.
function reason(r: RequestRow, hasDraft: boolean) {
  if (!r.ownerId) return "Unowned";
  if (hasDraft) return "Reply not sent";
  if (r.status === "waiting_on_client") return "Waiting on client";
  if (r.needsAccessDecision) return "Access decision needed";
  if (r.clientReplied) return "Client replied";
  return "In progress";
}

// Sort order inside a queue section: earliest due date first; requests with no due date
// after those; ties broken by oldest first.
const byUrgency =(a: { dueAt: number | null; createdAt: number }, b: { dueAt: number | null; createdAt: number }) =>
  (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.createdAt - b.createdAt;

// scope "mine": unowned work plus my own. scope "team": everyone's (the "Whole team" link).
export async function getQueue(me: { id: string }, scope: "mine" | "team") {
  // Step 1: every request that is not closed, the 8 most recently closed, and staff names.
  const [open, closed, staff] = await Promise.all([
    db.select().from(requests).where(ne(requests.status, "closed")),
    db.select().from(requests).where(eq(requests.status, "closed")).orderBy(desc(requests.closedAt)).limit(8),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "staff")),
  ]);
  const all = [...open, ...closed];
  const threadIds = [...new Set(all.map((r) => r.threadId))];
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  // Step 2: for the threads those requests belong to, load in four queries: the threads,
  // the clients on them, their messages (for the preview and to spot drafts), and earlier
  // closed requests (for the "X handled this thread before" hint).
  const [threadRows, people, msgs, previous] = threadIds.length
    ? await Promise.all([
        db.select().from(threads).where(inArray(threads.id, threadIds)),
        db
          .select({ threadId: threadParticipants.threadId, name: users.name })
          .from(threadParticipants)
          .innerJoin(users, eq(users.id, threadParticipants.userId))
          .where(inArray(threadParticipants.threadId, threadIds)),
        db
          .select({
            threadId: messages.threadId,
            kind: messages.kind,
            body: messages.body,
            deliveryStatus: messages.deliveryStatus,
            requestId: messages.requestId,
            createdAt: messages.createdAt,
            authorName: users.name,
          })
          .from(messages)
          .innerJoin(users, eq(users.id, messages.authorId))
          .where(inArray(messages.threadId, threadIds))
          .orderBy(asc(messages.createdAt)),
        db
          .select({ threadId: requests.threadId, ownerId: requests.ownerId })
          .from(requests)
          .where(and(inArray(requests.threadId, threadIds), eq(requests.status, "closed")))
          .orderBy(asc(requests.closedAt)),
      ])
    : [[], [], [], []];

  // Step 3: turn one request into one row of the queue.
  const toRow = (r: RequestRow) => {
    const threadMsgs = msgs.filter((m) => m.threadId === r.threadId);
    // Preview the latest thing actually said between Harbour and the client.
    const said = threadMsgs.filter((m) => m.kind !== "internal_note" && m.deliveryStatus !== "draft");
    const last = said[said.length - 1];
    const hasDraft = threadMsgs.some((m) => m.requestId === r.id && m.deliveryStatus === "draft");
    const ownerName = r.ownerId ? (staffName.get(r.ownerId) ?? null) : null;
    const lastOwner = previous.filter((p) => p.threadId === r.threadId).pop()?.ownerId;
    return {
      id: r.id,
      threadId: r.threadId,
      title: r.title,
      subject: threadRows.find((t) => t.id === r.threadId)?.subject ?? "",
      clients: people.filter((p) => p.threadId === r.threadId).map((p) => p.name),
      ownerId: r.ownerId,
      ownerName,
      status: r.status,
      reason: reason(r, hasDraft),
      nextStep: nextStep(r, ownerName, hasDraft),
      dueAt: r.dueAt,
      createdAt: r.createdAt,
      closedAt: r.closedAt,
      previouslyHandledBy: !r.ownerId && lastOwner ? (staffName.get(lastOwner) ?? null) : null,
      preview: last ? { authorName: last.authorName, body: last.body, createdAt: last.createdAt } : null,
    };
  };

  const inScope = (r: RequestRow) => scope === "team" || r.ownerId === me.id;

  // Step 4: internal notes addressed to me that I have not yet marked as answered.
  const questionRows = await db
    .select({
      id: messages.id,
      threadId: messages.threadId,
      body: messages.body,
      createdAt: messages.createdAt,
      fromName: users.name,
      subject: threads.subject,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(and(eq(messages.kind, "internal_note"), eq(messages.addressedTo, me.id), isNull(messages.answeredAt)))
    .orderBy(asc(messages.createdAt));

  // Step 5: sort the requests into the sections of the screen.
  // Unowned work is shown to everyone, whatever the scope: it is everybody's problem.
  return {
    unowned: open.filter((r) => !r.ownerId).sort(byUrgency).map(toRow),
    needsAction: open.filter((r) => r.ownerId && r.status !== "waiting_on_client" && inScope(r)).sort(byUrgency).map(toRow),
    questions: questionRows,
    waiting: open.filter((r) => r.ownerId && r.status === "waiting_on_client" && inScope(r)).sort(byUrgency).map(toRow),
    recentlyClosed: closed.map(toRow),
  };
}

// Everything about one conversation, for the staff thread screen.
// Unlike client-view.ts this returns ALL messages, including internal notes and drafts.
export async function getStaffThread(threadId: string) {
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!thread) throw new AppError(404, "Thread not found.");

  const [allUsers, people, msgs, reqs] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role, title: users.title, email: users.email }).from(users),
    db.select().from(threadParticipants).where(eq(threadParticipants.threadId, threadId)),
    db.select().from(messages).where(eq(messages.threadId, threadId)).orderBy(asc(messages.createdAt)),
    db.select().from(requests).where(eq(requests.threadId, threadId)).orderBy(asc(requests.createdAt)),
  ]);
  const events = reqs.length
    ? await db
        .select()
        .from(requestEvents)
        .where(inArray(requestEvents.requestId, reqs.map((r) => r.id)))
        .orderBy(asc(requestEvents.createdAt))
    : [];
  const name = (id: string | null) => allUsers.find((u) => u.id === id)?.name ?? null;
  const participantIds = new Set(people.map((p) => p.userId));

  return {
    id: thread.id,
    subject: thread.subject,
    participants: people.map((p) => ({
      id: p.userId,
      name: name(p.userId),
      addedBy: name(p.addedBy),
      reason: p.reason,
      addedAt: p.addedAt,
    })),
    messages: msgs.map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      authorName: name(m.authorId),
      deliveryStatus: m.deliveryStatus,
      requestId: m.requestId,
      addressedToId: m.addressedTo,
      addressedToName: name(m.addressedTo),
      answeredAt: m.answeredAt,
      createdAt: m.createdAt,
    })),
    requests: reqs.map((r) => {
      const hasDraft = msgs.some((m) => m.requestId === r.id && m.deliveryStatus === "draft");
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        ownerId: r.ownerId,
        ownerName: name(r.ownerId),
        waitingFor: r.waitingFor,
        dueAt: r.dueAt,
        needsAccessDecision: r.needsAccessDecision,
        outcome: r.outcome,
        outcomeNote: r.outcomeNote,
        nextStep: nextStep(r, name(r.ownerId), hasDraft),
        events: events.filter((e) => e.requestId === r.id).map((e) => ({ id: e.id, detail: e.detail, createdAt: e.createdAt })),
      };
    }),
    // The two lists below fill the drop-downs on the screen: colleagues to hand over to or
    // ask, and clients who could be given access because they do not have it yet.
    staff: allUsers.filter((u) => u.role === "staff").map((u) => ({ id: u.id, name: u.name, title: u.title })),
    clientsWithoutAccess: allUsers
      .filter((u) => u.role === "client" && !participantIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name })),
  };
}

// For Priya: did we solve the problem, not just reply quickly.
// Loads every request and counts in memory, which is fine at Harbour's size.
//   reopened             requests with at least one "reopened" event
//   unownedOverADay      open, no owner, created more than 24 hours ago
//   averageDaysToOutcome created -> closed, averaged over closed requests
export async function getOutcomes() {
  const [all, events] = await Promise.all([
    db.select().from(requests),
    db.select().from(requestEvents).where(eq(requestEvents.type, "reopened")),
  ]);
  const closed = all.filter((r) => r.status === "closed");
  const dayAgo = Date.now() - 24 * 3600_000;
  const days = closed.map((r) => ((r.closedAt ?? r.createdAt) - r.createdAt) / (24 * 3600_000));
  return {
    open: all.length - closed.length,
    closed: closed.length,
    byOutcome: Object.keys(OUTCOME_LABELS).map((key) => ({
      label: OUTCOME_LABELS[key],
      count: closed.filter((r) => r.outcome === key).length,
    })),
    reopened: new Set(events.map((e) => e.requestId)).size,
    unownedOverADay: all.filter((r) => r.status !== "closed" && !r.ownerId && r.createdAt < dayAgo).length,
    waitingOnClient: all.filter((r) => r.status === "waiting_on_client").length,
    averageDaysToOutcome: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
  };
}

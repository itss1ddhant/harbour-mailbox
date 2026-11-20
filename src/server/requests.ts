// REQUEST RULES
// -------------
// Every change to a request goes through this file. Nothing else in the app updates the
// requests table (the demo data in db/seed.ts is the one exception, for back-dated rows).
// A request is one piece of work inside a thread: one owner, a status, and an outcome when closed.
//
// The life of a request:
//
//   needs_triage ──claim / handOver──▶ open ◀──────── reopen ─────────┐
//        │                              │  ▲                           │
//        │                 setWaiting   │  │ client replies / resume   │
//        │                              ▼  │                           │
//        │                       waiting_on_client                     │
//        │                              │                              │
//        └──────────── close(outcome) ──┴────────────▶ closed ─────────┘
//
// Each function below: loads the request, checks the change is allowed (throwing an
// AppError with a clear message if not), updates the row, and writes a history event.
// `actor` is the member of staff making the change.

import { and, eq, isNull, ne } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { OUTCOMES, requestEvents, requests, threads, users, type Outcome } from "@/db/schema";
import { AppError, requireText } from "./errors";

type Actor = { id: string; name: string };

// Adds one line to a request's history (the request_events table).
// `at` can be supplied so the demo data can create events in the past.
async function logEvent(requestId: string, actorId: string | null, type: string, detail = "", at = Date.now()) {
  await db.insert(requestEvents).values({ id: newId(), requestId, actorId, type, detail, createdAt: at });
}

// Loads a request or answers "404 not found".
async function getRequest(id: string) {
  const request = await db.query.requests.findFirst({ where: eq(requests.id, id) });
  if (!request) throw new AppError(404, "Request not found.");
  return request;
}

// Loads a user and insists they are staff. Work can never be owned by a client.
async function getStaff(id: unknown) {
  const user = typeof id === "string" ? await db.query.users.findFirst({ where: eq(users.id, id) }) : null;
  if (!user || user.role !== "staff") throw new AppError(400, "Choose a member of staff.");
  return user;
}

// Creates a request in a thread. Two callers:
//   - staff, from "Add another request" on the thread screen (actor = that person)
//   - onClientMessage below, when a client writes on a thread with nothing open (actor = null)
// With an owner it starts as "open"; without one it starts as "needs_triage" and shows
// under "Unowned" in everyone's queue.
export async function createRequest(
  threadId: string,
  actor: Actor | null, // null = created automatically from a client message
  input: { title: unknown; ownerId?: string | null; dueAt?: number | null; needsAccessDecision?: boolean },
  at = Date.now(),
) {
  const title = requireText(input.title, "Title", 200);
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!thread) throw new AppError(404, "Thread not found.");
  if (input.ownerId) await getStaff(input.ownerId);

  const id = newId();
  await db.insert(requests).values({
    id,
    threadId,
    title,
    ownerId: input.ownerId ?? null,
    status: input.ownerId ? "open" : "needs_triage",
    dueAt: input.dueAt ?? null,
    needsAccessDecision: !!input.needsAccessDecision,
    clientReplied: actor === null, // made from a client message, so the client is waiting on us
    createdAt: at,
  });
  await logEvent(id, actor?.id ?? null, "created", actor ? `Added by ${actor.name}` : "Created from a client message", at);
  return id;
}

// Called whenever a client writes in a thread.
// - A request waiting on the client goes back to open, with the same owner.
// - Other open requests are flagged "client replied".
// - If nothing is open, the message is new work: create an unowned request to triage.
//   (This is thread T5 in the brief: a new question sent as a reply to a finished thread.)
// Returns the id of the new request, or null if none was created.
export async function onClientMessage(threadId: string, body: string, at = Date.now()) {
  // "Open" here means every request in the thread that is not closed.
  const open = await db.query.requests.findMany({
    where: and(eq(requests.threadId, threadId), ne(requests.status, "closed")),
  });
  if (open.length === 0) {
    // Use the client's own words (shortened) as the title; staff can see at a glance what was asked.
    const title = body.length > 80 ? body.slice(0, 77) + "..." : body;
    return createRequest(threadId, null, { title }, at);
  }
  for (const r of open) {
    const wasWaiting = r.status === "waiting_on_client";
    await db
      .update(requests)
      .set({ clientReplied: true, status: wasWaiting ? "open" : r.status })
      .where(eq(requests.id, r.id));
    if (wasWaiting) await logEvent(r.id, null, "client_replied", "Client replied; back with the owner", at);
  }
  return null;
}

// Take an unowned request. Fails if someone else got there first.
export async function claim(requestId: string, actor: Actor) {
  const request = await getRequest(requestId);
  if (request.status === "closed") throw new AppError(409, "This request is closed.");
  // The "owner is empty" check is part of the UPDATE itself, not a separate read. If two
  // people click Claim at the same moment, the database lets only one update match a row;
  // the other changes nothing (rowsAffected is 0) and gets the message below.
  const result = await db
    .update(requests)
    .set({ ownerId: actor.id, status: request.status === "needs_triage" ? "open" : request.status })
    .where(and(eq(requests.id, requestId), isNull(requests.ownerId)));
  if (result.rowsAffected === 0) {
    throw new AppError(409, "This request already has an owner. Ask them to hand it over.");
  }
  await logEvent(requestId, actor.id, "claimed", `${actor.name} took ownership`);
}

// Pass a request to a colleague. The note is required so the new owner knows why.
// Also used to assign an unowned request to someone else. Replacing the single ownerId
// means the old owner stops being accountable at the same moment the new one starts.
export async function handOver(requestId: string, actor: Actor, toUserId: unknown, note: unknown) {
  const request = await getRequest(requestId);
  if (request.status === "closed") throw new AppError(409, "This request is closed.");
  const to = await getStaff(toUserId);
  const reason = requireText(note, "A handover note", 1000);
  await db
    .update(requests)
    .set({ ownerId: to.id, status: request.status === "needs_triage" ? "open" : request.status })
    .where(eq(requests.id, requestId));
  await logEvent(requestId, actor.id, "handed_over", `${actor.name} handed over to ${to.name}: ${reason}`);
}

// The work continues, but the next move is the client's.
// (Thread T3 in the brief: "I answered the question, but we still need the signed form.")
// `waitingFor` is shown to the client in their portal as "Waiting for you: ...".
// An owner is required, so that someone is accountable for chasing it.
export async function setWaitingOnClient(requestId: string, actor: Actor, waitingFor: unknown) {
  const request = await getRequest(requestId);
  if (request.status === "closed") throw new AppError(409, "This request is closed.");
  if (!request.ownerId) throw new AppError(409, "Claim this request before marking it as waiting.");
  const what = requireText(waitingFor, "What you are waiting for", 200);
  await db
    .update(requests)
    .set({ status: "waiting_on_client", waitingFor: what, clientReplied: false })
    .where(eq(requests.id, requestId));
  await logEvent(requestId, actor.id, "waiting_on_client", `Waiting on client: ${what}`);
}

// Staff decide to stop waiting (for example the form arrived by post) and take the request back.
export async function resume(requestId: string, actor: Actor) {
  const request = await getRequest(requestId);
  if (request.status !== "waiting_on_client") throw new AppError(409, "This request is not waiting on the client.");
  await db.update(requests).set({ status: "open", waitingFor: null }).where(eq(requests.id, requestId));
  await logEvent(requestId, actor.id, "resumed", `${actor.name} stopped waiting on the client`);
}

// A staff reply about a request means the client's last message has been dealt with.
export async function markReplied(requestId: string) {
  await db.update(requests).set({ clientReplied: false }).where(eq(requests.id, requestId));
}

// Closing always records an outcome. Declining, or closing an access request, needs a reason.
// The outcome is what lets Priya see whether problems were solved rather than just answered.
// Outcomes: resolved, no_action_needed (for example a thank-you), declined.
export async function close(requestId: string, actor: Actor, outcome: unknown, note: unknown) {
  const request = await getRequest(requestId);
  if (request.status === "closed") throw new AppError(409, "This request is already closed.");
  if (!OUTCOMES.includes(outcome as Outcome)) throw new AppError(400, "Choose an outcome.");
  const reason = typeof note === "string" ? note.trim() : "";
  if (!reason && outcome === "declined") throw new AppError(400, "Say why this was declined.");
  if (!reason && request.needsAccessDecision) {
    throw new AppError(400, "Record the access decision and the reason for it.");
  }
  await db
    .update(requests)
    .set({
      status: "closed",
      outcome: outcome as Outcome,
      outcomeNote: reason || null,
      ownerId: request.ownerId ?? actor.id, // whoever closes unowned work is accountable for it
      clientReplied: false,
      waitingFor: null,
      closedAt: Date.now(),
      closedBy: actor.id,
    })
    .where(eq(requests.id, requestId));
  await logEvent(requestId, actor.id, "closed", `${actor.name} closed as ${outcome}${reason ? `: ${reason}` : ""}`);
}

// Undo a close. The owner is kept. The "reopened" event is what the Outcomes page counts
// as "closed before the problem was solved".
export async function reopen(requestId: string, actor: Actor) {
  const request = await getRequest(requestId);
  if (request.status !== "closed") throw new AppError(409, "This request is not closed.");
  await db
    .update(requests)
    .set({ status: "open", outcome: null, outcomeNote: null, closedAt: null, closedBy: null })
    .where(eq(requests.id, requestId));
  await logEvent(requestId, actor.id, "reopened", `${actor.name} reopened this`);
}

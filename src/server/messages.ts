// WRITING MESSAGES
// ----------------
// Everything that adds to a conversation: client messages, staff replies, drafts,
// internal notes, and giving a client access to a thread.
//
// This file writes rows; it does not decide what a request should do next. When a
// message affects a request it calls into requests.ts (onClientMessage, markReplied,
// setWaitingOnClient), so the request rules stay in one place.
//
// The optional `at` arguments exist so the demo data can create messages in the past.

import { and, eq } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { messages, requests, threadParticipants, threads, users } from "@/db/schema";
import { AppError, requireText } from "./errors";
import { markReplied, onClientMessage, setWaitingOnClient } from "./requests";

type Actor = { id: string; name: string };

async function getThread(threadId: string) {
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!thread) throw new AppError(404, "Thread not found.");
  return thread;
}

// The access check for clients. Called before a client reads or writes anything in a thread.
// 404, not 403: a client must not learn that someone else's thread exists.
export async function assertParticipant(threadId: string, userId: string) {
  const row = await db.query.threadParticipants.findFirst({
    where: and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, userId)),
  });
  if (!row) throw new AppError(404, "Conversation not found.");
}

// ---------- Clients ----------

// "Ask something new" in the portal: creates the thread, lists the client as its only
// participant, then posts their first message (which creates an unowned request).
export async function startClientThread(client: Actor, subject: unknown, body: unknown, at = Date.now()) {
  const cleanSubject = requireText(subject, "Subject", 200);
  const cleanBody = requireText(body, "Message");
  const threadId = newId();
  await db.insert(threads).values({ id: threadId, subject: cleanSubject, createdAt: at });
  await db.insert(threadParticipants).values({
    threadId,
    userId: client.id,
    addedBy: null,
    reason: "Started the conversation",
    addedAt: at,
  });
  await postClientMessage(threadId, client, cleanBody, at);
  return threadId;
}

// A client writes in a thread they are a participant of. After saving the message, the
// request rules decide what it means for the work (see onClientMessage in requests.ts).
export async function postClientMessage(threadId: string, client: Actor, body: unknown, at = Date.now()) {
  await assertParticipant(threadId, client.id);
  const cleanBody = requireText(body, "Message");
  const id = newId();
  await db.insert(messages).values({
    id,
    threadId,
    authorId: client.id,
    kind: "client_message",
    body: cleanBody,
    createdAt: at,
  });
  await onClientMessage(threadId, cleanBody, at);
  return id;
}

// ---------- Staff ----------

// Staff write to the client.
//   draft: true   saved but not sent; the client cannot see it; the request is not touched
//   requestId     which request the reply is about (optional)
//   waitingFor    if filled in, the request moves to "waiting on client" for that thing
export async function postStaffReply(
  threadId: string,
  staff: Actor,
  input: { body: unknown; draft?: boolean; requestId?: unknown; waitingFor?: unknown },
  at = Date.now(),
) {
  await getThread(threadId);
  const body = requireText(input.body, "Reply");
  const requestId = await requestInThread(threadId, input.requestId);
  // The request rules run BEFORE the message is written. If a rule refuses (for example
  // "claim this request before marking it as waiting"), nothing has been sent yet, so the
  // person can fix it and try again without the client receiving the reply twice.
  // Only a reply that is actually sent counts as having answered the client.
  if (!input.draft && requestId) {
    if (typeof input.waitingFor === "string" && input.waitingFor.trim()) {
      await setWaitingOnClient(requestId, staff, input.waitingFor);
    }
    await markReplied(requestId);
  }
  const id = newId();
  await db.insert(messages).values({
    id,
    threadId,
    authorId: staff.id,
    kind: "staff_reply",
    body,
    deliveryStatus: input.draft ? "draft" : "sent",
    requestId,
    createdAt: at,
  });
  return id;
}

// Staff write a note for staff. Stored in the same table as other messages but with
// kind "internal_note", which client-view.ts never selects.
// If addressed to a colleague, it appears in that person's queue under "Questions for me".
export async function postInternalNote(
  threadId: string,
  staff: Actor,
  input: { body: unknown; addressedTo?: unknown },
  at = Date.now(),
) {
  await getThread(threadId);
  const body = requireText(input.body, "Note");
  let addressedTo: string | null = null;
  if (typeof input.addressedTo === "string" && input.addressedTo) {
    const colleague = await db.query.users.findFirst({ where: eq(users.id, input.addressedTo) });
    if (!colleague || colleague.role !== "staff") throw new AppError(400, "Notes can only be addressed to staff.");
    addressedTo = colleague.id;
  }
  const id = newId();
  await db.insert(messages).values({
    id,
    threadId,
    authorId: staff.id,
    kind: "internal_note",
    body,
    addressedTo,
    createdAt: at,
  });
  return id;
}

async function getStaffMessage(messageId: string) {
  const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
  if (!message) throw new AppError(404, "Message not found.");
  return message;
}

// Delivery is simulated: sending marks the reply as sent and makes it visible to the client.
export async function sendDraft(messageId: string) {
  const message = await getStaffMessage(messageId);
  if (message.kind !== "staff_reply" || message.deliveryStatus !== "draft") {
    throw new AppError(409, "Only a draft reply can be sent.");
  }
  await db.update(messages).set({ deliveryStatus: "sent", createdAt: Date.now() }).where(eq(messages.id, messageId));
  if (message.requestId) await markReplied(message.requestId);
}

// Throw a draft away. Safe to delete outright because the client never saw it.
export async function discardDraft(messageId: string) {
  const message = await getStaffMessage(messageId);
  if (message.kind !== "staff_reply" || message.deliveryStatus !== "draft") {
    throw new AppError(409, "Only a draft reply can be discarded.");
  }
  await db.delete(messages).where(eq(messages.id, messageId));
}

// Removes a question from the addressee's "Questions for me" list. Only they can do it.
export async function markAnswered(messageId: string, staff: Actor) {
  const message = await getStaffMessage(messageId);
  if (message.kind !== "internal_note" || message.addressedTo !== staff.id) {
    throw new AppError(403, "Only the person a note is addressed to can mark it as answered.");
  }
  await db.update(messages).set({ answeredAt: Date.now() }).where(eq(messages.id, messageId));
}

// Giving a client access to a thread is an explicit, recorded decision.
// The reason is required and stored with who gave access and when. From then on the
// client can read the whole conversation (but still never internal notes or drafts).
export async function addParticipant(threadId: string, staff: Actor, userId: unknown, reason: unknown) {
  await getThread(threadId);
  const why = requireText(reason, "A reason for giving access", 500);
  const person = typeof userId === "string" ? await db.query.users.findFirst({ where: eq(users.id, userId) }) : null;
  if (!person || person.role !== "client") throw new AppError(400, "Choose a client.");
  const existing = await db.query.threadParticipants.findFirst({
    where: and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, person.id)),
  });
  if (existing) throw new AppError(409, `${person.name} already has access.`);
  await db.insert(threadParticipants).values({
    threadId,
    userId: person.id,
    addedBy: staff.id,
    reason: why,
    addedAt: Date.now(),
  });
}

// Checks that a request id sent by the browser really belongs to this thread, so a reply
// in one conversation cannot change a request in another. Returns null if none was given.
async function requestInThread(threadId: string, requestId: unknown): Promise<string | null> {
  if (typeof requestId !== "string" || !requestId) return null;
  const request = await db.query.requests.findFirst({
    where: and(eq(requests.id, requestId), eq(requests.threadId, threadId)),
  });
  if (!request) throw new AppError(400, "That request is not part of this thread.");
  return request.id;
}

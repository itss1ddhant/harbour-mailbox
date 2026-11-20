// Demo data: Harbour's eight staff, four clients, and the six threads from the brief (T1-T6).
// Times are set relative to "now", so the mailbox always looks like this Monday morning.

import bcrypt from "bcryptjs";
import { db, newId } from "./client";
import { messages, requestEvents, requests, sessions, threadParticipants, threads, users } from "./schema";
import { postClientMessage } from "@/server/messages";

// The demo people: who they are and what job they do. No passwords here.
// Each person's password comes from the .env file (see passwordFor below), which is
// never committed, so no credentials live in the source code.
export const DEMO_ACCOUNTS = [
  { key: "maya", name: "Maya", role: "staff", title: "Service associate" },
  { key: "leo", name: "Leo", role: "staff", title: "Adviser" },
  { key: "priya", name: "Priya", role: "staff", title: "Operations lead" },
  { key: "tom", name: "Tom", role: "staff", title: "Adviser" },
  { key: "aisha", name: "Aisha", role: "staff", title: "Adviser" },
  { key: "daniel", name: "Daniel", role: "staff", title: "Adviser" },
  { key: "ben", name: "Ben", role: "staff", title: "Service associate" },
  { key: "grace", name: "Grace", role: "staff", title: "Service associate" },
  { key: "elena", name: "Elena", role: "client", title: "Client" },
  { key: "oliver", name: "Oliver", role: "client", title: "Client (Elena's partner)" },
  { key: "sam", name: "Sam", role: "client", title: "Client" },
  { key: "noor", name: "Noor", role: "client", title: "Client" },
] as const;

export const emailFor = (key: string) =>
  `${key}@${DEMO_ACCOUNTS.find((a) => a.key === key)?.role === "staff" ? "harbour.example" : "client.example"}`;

// The name of the .env setting that holds one person's password:
// "maya" -> DEMO_PASSWORD_MAYA.
export const passwordSetting = (key: string) => `DEMO_PASSWORD_${key.toUpperCase()}`;

// One person's demo password, read from .env. (The .env file is loaded into process.env
// by src/db/client.ts.) Used by seed() below and by the tests.
export const passwordFor = (key: string) => process.env[passwordSetting(key)] ?? "";

// Stops with a clear message if any demo password is missing or too short, rather than
// quietly creating an account nobody can sign in to.
export function checkPasswords() {
  const missing = DEMO_ACCOUNTS.filter((a) => passwordFor(a.key).length < 8).map((a) => passwordSetting(a.key));
  if (missing.length > 0) {
    throw new Error(
      `Demo passwords are not set. Open the .env file and give each of these a value of at least 8 characters:\n  ${missing.join("\n  ")}`,
    );
  }
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Empties every table. The order matters: rows that point at other rows go first
// (events and messages before requests, requests before threads, and so on).
export async function wipe() {
  for (const table of [requestEvents, messages, requests, threadParticipants, threads, sessions, users]) {
    await db.delete(table);
  }
}

export async function isEmpty() {
  return (await db.select({ id: users.id }).from(users).limit(1)).length === 0;
}

// Loads the demo data into an empty database. Returns the ids it created (user ids by
// first name, thread ids as t1..t6) so the tests can refer to them.
export async function seed() {
  checkPasswords();
  const now = Date.now();
  // bcrypt is slow on purpose (that is what makes stolen hashes hard to crack). The
  // second argument is the "cost": 10 for real use. The tests reload this data before
  // almost every test, so they use the minimum cost to stay fast.
  const cost = process.env.VITEST ? 4 : 10;

  // id.maya, id.leo, ... : the user id for each demo account.
  const id: Record<string, string> = {};
  for (const a of DEMO_ACCOUNTS) {
    id[a.key] = newId();
    // Only this hash is stored; the password itself never reaches the database.
    const passwordHash = await bcrypt.hash(passwordFor(a.key), cost);
    await db.insert(users).values({ id: id[a.key], name: a.name, email: emailFor(a.key), passwordHash, role: a.role, title: a.title });
  }

  // Three small helpers used below to write back-dated rows directly. They bypass the
  // rules in server/requests.ts on purpose: the demo has to start in states (and at
  // times) that the rules would not produce "now".
  //   thread()   a conversation and the clients who can see it
  //   message()  one message; staff replies count as sent unless told otherwise
  //   request()  one request, plus a history line saying where it came from
  async function thread(subject: string, participants: string[], at: number) {
    const threadId = newId();
    await db.insert(threads).values({ id: threadId, subject, createdAt: at });
    for (const p of participants) {
      await db.insert(threadParticipants).values({ threadId, userId: id[p], addedBy: null, reason: "Client on this matter", addedAt: at });
    }
    return threadId;
  }
  async function message(
    threadId: string,
    author: string,
    kind: "client_message" | "staff_reply" | "internal_note",
    body: string,
    at: number,
    extra: Partial<typeof messages.$inferInsert> = {},
  ) {
    await db.insert(messages).values({
      id: newId(),
      threadId,
      authorId: id[author],
      kind,
      body,
      deliveryStatus: kind === "staff_reply" ? "sent" : null,
      createdAt: at,
      ...extra,
    });
  }
  async function request(threadId: string, title: string, at: number, fields: Partial<typeof requests.$inferInsert>, history: string) {
    const requestId = newId();
    await db.insert(requests).values({ id: requestId, threadId, title, status: "open", createdAt: at, ...fields });
    await db.insert(requestEvents).values({ id: newId(), requestId, actorId: null, type: "imported", detail: history, createdAt: at });
    return requestId;
  }

  // T1 - Elena, documents. Latest: "URGENT - thank you, I've found it now!" Spreadsheet: Maya, open.
  const t1 = await thread("Documents for your review", ["elena"], now - 3 * DAY);
  await message(t1, "elena", "client_message", "I can't find the pension statement you sent last week. Could you send it again?", now - 3 * DAY);
  await message(t1, "maya", "staff_reply", "Of course. I'll dig it out and resend it on Monday.", now - 3 * DAY + 2 * HOUR);
  await message(t1, "elena", "client_message", "URGENT — thank you, I've found it now!", now - 5 * MIN);
  await request(t1, "Resend pension statement", now - 3 * DAY, { ownerId: id.maya, clientReplied: true }, "Imported from the spreadsheet: owner Maya, open");

  // T2 - Sam, application. Nobody owns it and a promise was made before Tuesday.
  const t2 = await thread("Application", ["sam"], now - 5 * DAY);
  await message(t2, "sam", "client_message", "I've uploaded everything for the application. Is there anything else you need from me?", now - 5 * DAY);
  await message(t2, "tom", "staff_reply", "Thanks Sam. Someone will confirm everything is in order before your appointment on Tuesday.", now - 4 * DAY);
  await message(t2, "sam", "client_message", "You said someone would confirm before my appointment on Tuesday. Is anything missing?", now - 2 * DAY - 19 * HOUR);
  await request(
    t2,
    "Confirm the application is complete before Tuesday's appointment",
    now - 4 * DAY,
    { status: "needs_triage", clientReplied: true, dueAt: now + 23 * HOUR + 45 * MIN },
    "Imported from the spreadsheet: no owner, last reply Thursday",
  );

  // T3 - Elena, signed form. Spreadsheet said "Complete", but the form is still owed.
  const t3 = await thread("Signed form", ["elena"], now - 4 * DAY);
  await message(t3, "elena", "client_message", "Two questions before I sign: does the form need a witness, and can I return it by email?", now - 3 * DAY);
  const t3Request = await request(
    t3,
    "Signed transfer form",
    now - 4 * DAY,
    { ownerId: id.maya, status: "waiting_on_client", waitingFor: "signed form" },
    "Imported from the spreadsheet: owner Maya, marked complete. Reopened as waiting on the client because the form is still owed",
  );
  await message(t3, "maya", "staff_reply", "I've answered your questions below. We still need your signed form.\n\nNo witness is needed, and a scanned copy by email is fine.", now - 25 * MIN, { requestId: t3Request });

  // T4 - Oliver, joint paperwork. Oliver is on this thread only; he cannot see Elena's other threads.
  const t4 = await thread("Joint paperwork", ["elena", "oliver"], now - 10 * DAY);
  await message(t4, "elena", "client_message", "Oliver and I have both signed the joint account forms. They're attached.", now - 10 * DAY);
  await message(t4, "leo", "staff_reply", "Thank you both. The joint account paperwork is all in order.", now - 9 * DAY);
  await message(t4, "oliver", "client_message", "Elena said you have the documents. Please send me everything you have for her.", now - 15 * MIN);
  await request(
    t4,
    "Oliver asks for everything held for Elena",
    now - 15 * MIN,
    { ownerId: id.leo, clientReplied: true, needsAccessDecision: true },
    "Imported from the spreadsheet: owner Leo, relationship: Elena's partner, no access decision recorded",
  );

  // T5 - Sam, address. A new question on an application thread that was completed last month.
  const t5 = await thread("Application documents", ["sam"], now - 40 * DAY);
  await message(t5, "sam", "client_message", "Here are the payslips and ID you asked for.", now - 40 * DAY);
  await message(t5, "leo", "staff_reply", "All received and checked. Nothing more needed for this part.", now - 32 * DAY);
  await request(
    t5,
    "Supporting documents for application",
    now - 40 * DAY,
    { ownerId: id.leo, status: "closed", outcome: "resolved", closedAt: now - 32 * DAY, closedBy: id.leo },
    "Imported from the spreadsheet: owner Leo, complete last month",
  );
  // Sent through the real rule: a client message on a thread with nothing open becomes new, unowned work.
  await postClientMessage(t5, { id: id.sam, name: "Sam" }, "Also, I've moved. Where should I send my new address?", now - 10 * MIN);

  // T6 - Noor, appointment. A reply was drafted on Friday and never sent.
  const t6 = await thread("Appointment", ["noor"], now - 2 * DAY - 17 * HOUR);
  await message(t6, "noor", "client_message", "Can we move our appointment to Wednesday?", now - 2 * DAY - 16 * HOUR - 35 * MIN);
  const t6Request = await request(
    t6,
    "Move appointment to Wednesday",
    now - 2 * DAY - 16 * HOUR - 35 * MIN,
    { ownerId: id.maya, clientReplied: true },
    "Imported from the spreadsheet: owner Maya, draft reply saved, delivery result blank",
  );
  await message(t6, "maya", "staff_reply", "Hi Noor, Wednesday at 2pm works for us. See you then.", now - 2 * DAY - 16 * HOUR, {
    deliveryStatus: "draft",
    requestId: t6Request,
  });

  return { id, threads: { t1, t2, t3, t4, t5, t6 } };
}

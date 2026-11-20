// DATABASE TABLES
// ---------------
// This file is the single description of what is stored. Drizzle (the database library)
// reads it for two things:
//   1. Type-safe queries in the rest of the code (db.select().from(requests) ...).
//   2. `npm run db:generate`, which compares this file with the last migration and writes
//      the SQL needed to bring a database up to date into the drizzle/ folder.
//
// The model in one paragraph:
//   A THREAD is a conversation with one or more clients. MESSAGES belong to a thread.
//   A REQUEST is one piece of work inside a thread, with at most one owner and, when
//   closed, an outcome. A thread can have several requests. REQUEST_EVENTS record every
//   change to a request. THREAD_PARTICIPANTS says which clients may see a thread.
//
// All times are stored as milliseconds since 1970 (Date.now()).
// All ids are random strings (see newId in client.ts), so they cannot be guessed.

import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// INDEXES
// An index is like the index at the back of a book: instead of reading every row to find
// "the messages in this thread", the database looks the thread up and goes straight to
// them. Each table below lists indexes for the columns the app searches by. Primary keys
// and the unique email already have one automatically.

// The allowed values for the "enum" columns below. SQLite stores them as plain text;
// listing them here lets TypeScript reject any other value at compile time.

export const ROLES = ["staff", "client"] as const;
export const MESSAGE_KINDS = ["client_message", "staff_reply", "internal_note"] as const;
export const DELIVERY = ["draft", "sent", "failed"] as const;
export const REQUEST_STATUS = ["needs_triage", "open", "waiting_on_client", "closed"] as const;
export const OUTCOMES = ["resolved", "no_action_needed", "declined"] as const;

export type Role = (typeof ROLES)[number];
export type RequestStatus = (typeof REQUEST_STATUS)[number];
export type Outcome = (typeof OUTCOMES)[number];

// Everyone who can sign in: Harbour staff and clients. `role` decides which half of the
// app they may use. `failedLogins` and `lockedUntil` implement the short lock after
// repeated wrong passwords (see login in server/auth.ts).
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  title: text("title").notNull().default(""),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: integer("locked_until").notNull().default(0),
});

// One row per signed-in browser. The browser holds a random token in a cookie; only the
// SHA-256 hash of that token is stored here. Kept in the database (not in memory) so
// that people stay signed in across a server restart.
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_expires_idx").on(t.expiresAt)], // clearing out expired sessions
);

// A conversation. Deliberately has no status and no owner: those belong to requests.
export const threads = sqliteTable("threads", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  createdAt: integer("created_at").notNull(),
});

// The only source of client access. A client sees a thread if, and only if,
// there is a row here for them. `addedBy` and `reason` are the recorded access decision
// (thread T4 in the brief: "No access decision recorded").
// The primary key (threadId, userId) means a person can be listed on a thread only once.
export const threadParticipants = sqliteTable(
  "thread_participants",
  {
    threadId: text("thread_id").notNull().references(() => threads.id),
    userId: text("user_id").notNull().references(() => users.id),
    addedBy: text("added_by").references(() => users.id), // null = the client started the thread
    reason: text("reason").notNull(),
    addedAt: integer("added_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.threadId, t.userId] }),
    index("participants_user_idx").on(t.userId), // "which threads can this client see?"
  ],
);

// One piece of work. This is the heart of the product.
//   status:  needs_triage -> open <-> waiting_on_client -> closed (and closed -> open on reopen)
//   ownerId: a single column, so two owners are impossible by construction.
//   clientReplied: true when the client has written since staff last replied.
//   needsAccessDecision: true when closing must record a decision and reason (T4).
//   title and waitingFor are shown to the client; outcomeNote is internal.
// All changes go through server/requests.ts.
export const requests = sqliteTable(
  "requests",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull().references(() => threads.id),
    title: text("title").notNull(), // shown to the client
    ownerId: text("owner_id").references(() => users.id), // one owner, or nobody yet
    status: text("status", { enum: REQUEST_STATUS }).notNull(),
    waitingFor: text("waiting_for"), // shown to the client
    dueAt: integer("due_at"),
    clientReplied: integer("client_replied", { mode: "boolean" }).notNull().default(false),
    needsAccessDecision: integer("needs_access_decision", { mode: "boolean" }).notNull().default(false),
    outcome: text("outcome", { enum: OUTCOMES }),
    outcomeNote: text("outcome_note"), // internal
    createdAt: integer("created_at").notNull(),
    closedAt: integer("closed_at"),
    closedBy: text("closed_by").references(() => users.id),
  },
  (t) => [
    index("requests_thread_idx").on(t.threadId), // the requests in one conversation
    index("requests_status_idx").on(t.status, t.closedAt), // the queue: open work, and the latest closed
  ],
);

// Everything written in a thread. `kind` separates the three sorts of message:
//   client_message  written by a client; always visible to the thread's participants
//   staff_reply     written by staff FOR the client; visible to the client only once
//                   deliveryStatus is "sent" (a "draft" is staff-only)
//   internal_note   written by staff for staff; never visible to a client
// The filter that enforces this lives in server/client-view.ts.
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull().references(() => threads.id),
    authorId: text("author_id").notNull().references(() => users.id),
    kind: text("kind", { enum: MESSAGE_KINDS }).notNull(),
    body: text("body").notNull(),
    deliveryStatus: text("delivery_status", { enum: DELIVERY }), // staff replies only
    requestId: text("request_id").references(() => requests.id), // which request a reply is about
    addressedTo: text("addressed_to").references(() => users.id), // internal notes only
    answeredAt: integer("answered_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("messages_thread_idx").on(t.threadId, t.createdAt), // one conversation, in order
    index("messages_addressed_idx").on(t.addressedTo), // "Questions for me"
  ],
);

// The history of a request: who did what, and when. Written by logEvent in
// server/requests.ts and shown under "History" on the staff thread screen. Rows are only
// ever added, never changed. actorId is empty when the system acted (a client message
// arrived, or the row came from the spreadsheet import).
export const requestEvents = sqliteTable(
  "request_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull().references(() => requests.id),
    actorId: text("actor_id").references(() => users.id),
    type: text("type").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("events_request_idx").on(t.requestId, t.createdAt)], // one request's history, in order
);

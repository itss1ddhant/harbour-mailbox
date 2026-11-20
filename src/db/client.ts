// DATABASE CONNECTION
// -------------------
// Opens the one database connection the whole app shares, and exports:
//   db             the Drizzle query builder used everywhere else
//   transaction    runs a group of changes as all-or-nothing (explained below)
//   client         the raw libSQL connection underneath it (used by one test)
//   runMigrations  creates or updates the tables from the SQL files in drizzle/
//   newId          makes a random id for a new row
//
// Where the data lives is decided by the DATABASE_URL setting:
//   file:./data/harbour.db   a SQLite file inside the project (local development)
//   libsql://...             a hosted Turso database (deployment); also needs
//                            DATABASE_AUTH_TOKEN
// The rest of the code does not know or care which one is in use.

import "dotenv/config"; // reads .env into process.env; does not override values already set
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || "file:./data/harbour.db";

// Vercel's file system is read-only and thrown away between requests, so a file database
// cannot work there. Fail with a clear message instead of a confusing one later.
if (url.startsWith("file:") && process.env.VERCEL) {
  throw new Error("Set DATABASE_URL and DATABASE_AUTH_TOKEN to a hosted database when deploying.");
}
// For a file database, make sure the folder (data/) exists before SQLite tries to create the file.
if (url.startsWith("file:")) {
  fs.mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
}

// In `npm run dev`, Next.js reloads this file every time code changes. Without this,
// each reload would open another connection. Keeping the connection on globalThis means
// it is created once and reused.
const globalForDb = globalThis as unknown as { harbourClient?: Client };
export const client =
  globalForDb.harbourClient ??
  createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
globalForDb.harbourClient = client;

// Passing the schema enables the db.query.<table>.findFirst(...) style of query.
const rootDb = drizzle(client, { schema });

// TRANSACTIONS
// A transaction is a group of database changes that either all happen or none do.
// Example: sending a reply writes a message, updates a request and adds a history line.
// If the third step failed without a transaction, the first two would stay: half a change.
//
// How it works here:
//   - transaction(fn) starts a transaction, runs fn, and commits. If fn throws, every
//     change made inside it is undone ("rolled back") and the error carries on up.
//   - While fn is running, `currentTx` remembers the open transaction for that one
//     request. (AsyncLocalStorage is Node's way of keeping a value attached to one chain
//     of async work, so two requests being handled at once do not see each other's.)
//   - `db` below looks at currentTx on every use. So code anywhere in the app just writes
//     db.insert(...) or db.update(...) as usual, and automatically joins the transaction
//     if one is open. Nothing has to be passed around.
//   - Transactions run one at a time (the `writeQueue`). SQLite allows only one writer at
//     once; queuing here means a second writer waits its turn instead of failing with
//     "database is locked". It also means two people acting at the same moment cannot
//     both read the old state and overwrite each other.
// server/http.ts wraps every data-changing API route in transaction(), so this is
// switched on in one place for the whole API.
type Tx = Parameters<Parameters<typeof rootDb.transaction>[0]>[0];
const currentTx = new AsyncLocalStorage<Tx>();

export const db: typeof rootDb = new Proxy(rootDb, {
  get(target, prop) {
    const active = (currentTx.getStore() ?? target) as unknown as Record<string | symbol, unknown>;
    const value = active[prop];
    return typeof value === "function" ? value.bind(active) : value;
  },
});

// Kept on globalThis for the same reason as the connection above: one queue per process.
const globalForQueue = globalThis as unknown as { harbourWriteQueue?: Promise<unknown> };

export function transaction<T>(fn: () => Promise<T>): Promise<T> {
  // Already inside a transaction: just carry on as part of it.
  if (currentTx.getStore()) return fn();
  const run = () => rootDb.transaction((tx) => currentTx.run(tx, fn));
  // Start after whatever is already queued has finished, whether it succeeded or failed.
  const result = (globalForQueue.harbourWriteQueue ?? Promise.resolve()).then(run, run);
  globalForQueue.harbourWriteQueue = result.catch(() => {});
  return result;
}

// Applies any SQL files in drizzle/ that this database has not had yet. Safe to run
// repeatedly: Drizzle keeps a record of applied migrations inside the database.
export async function runMigrations() {
  await migrate(rootDb, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
}

// 12 random bytes as URL-safe text (16 characters), for example "y5GNKWhu9Zk-_pJZ".
// Random rather than 1, 2, 3... so that one id tells you nothing about any other.
export function newId() {
  return randomBytes(12).toString("base64url");
}

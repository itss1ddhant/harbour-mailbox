// Runs before each test file. Points the app at its own throwaway database file,
// so tests never touch the demo data in data/harbour.db.

import fs from "node:fs";
import { randomBytes } from "node:crypto";

fs.mkdirSync("./data/test", { recursive: true });
process.env.DATABASE_URL = `file:./data/test/${randomBytes(6).toString("hex")}.db`;
delete (globalThis as { harbourClient?: unknown }).harbourClient;

// The demo passwords normally come from .env. Tests must not depend on that file, so
// each test file gets its own random passwords for its throwaway database. Tests read
// them back with passwordFor("maya") and so on.
for (const key of ["maya", "leo", "priya", "tom", "aisha", "daniel", "ben", "grace", "elena", "oliver", "sam", "noor"]) {
  process.env[`DEMO_PASSWORD_${key.toUpperCase()}`] = randomBytes(9).toString("base64url");
}

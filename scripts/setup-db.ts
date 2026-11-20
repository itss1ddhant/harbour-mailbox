// npm run db:setup
// Creates the tables. Loads the demo data only if the database is empty.

import { runMigrations } from "../src/db/client";
import { DEMO_ACCOUNTS, emailFor, isEmpty, seed } from "../src/db/seed";

async function main() {
  await runMigrations();
  if (await isEmpty()) {
    await seed();
    console.log("Demo data loaded (threads T1-T6).");
  } else {
    console.log("Database already has data. Left as it is. Use `npm run db:reset` to start again.");
  }
  printAccounts();
  console.log("\nDatabase ready.");
}

export function printAccounts() {
  // Emails and job titles only. Passwords are not printed; they are in your .env file.
  console.log("\nDemo accounts (each person's password is in your .env file)");
  for (const a of DEMO_ACCOUNTS) console.log(`  ${emailFor(a.key).padEnd(28)} ${a.title}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

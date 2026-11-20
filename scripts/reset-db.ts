// npm run db:reset
// Deletes everything and reloads the demo data. Use before a demo.

import { runMigrations } from "../src/db/client";
import { checkPasswords, seed, wipe } from "../src/db/seed";

async function main() {
  // Check the demo passwords in .env BEFORE deleting anything, so a missing password
  // stops the reset with the existing data still in place.
  checkPasswords();
  await runMigrations();
  await wipe();
  await seed();
  console.log("Database wiped and demo data reloaded (threads T1-T6).\n\nDatabase ready.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

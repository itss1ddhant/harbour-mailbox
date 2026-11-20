# Harbour Mailbox

A full-stack shared mailbox and request-management application for Harbour, an advisory firm with eight staff serving 500 clients.

**Core idea:** a conversation is not the same as a piece of work. Harbour Mailbox separates client **threads** from actionable **requests**, each with an owner, next step, lifecycle state, and recorded outcome.

**Live demo:** `harbour-mailbox.vercel.app`  
**Source:** `https://github.com/itss1ddhant/harbour-mailbox`

## Features

- **Prioritized work queues:** Unowned requests, needs action, questions for me, waiting on client, and recently closed.
- **Clear accountability:** Claim, hand over, wait on client, close with an outcome, or reopen a request.
- **Conversation and work separation:** A thread can contain multiple independent requests; new work on a previously closed thread is surfaced.
- **Staff collaboration:** Internal notes and colleague questions stay invisible to clients.
- **Client portal:** Clients can view and reply only to conversations they are explicitly authorized to access.
- **Delivery awareness:** Unsent drafts are distinguished from replies visible to clients (email delivery is simulated).
- **Outcome tracking:** Team visibility into unowned requests, reopened work, and time to outcome.
- **Durable data:** Messages, ownership, access, request history, and sessions persist in the database.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Application | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| API | Next.js API routes |
| Database | SQLite locally; Turso/libSQL when hosted |
| ORM | Drizzle ORM |
| Testing | Vitest |
| Hosting | Vercel |

## Run Locally

**Requirements:** Node.js 20+ (22 LTS recommended) and npm.

```bash
# Clone and enter the repository
git clone <repository-url>
cd harbour-mailbox

# Install dependencies
npm install

# Configure local environment
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed.

In `.env`, set a unique password of at least eight characters for each of the twelve `DEMO_PASSWORD_*` variables. Leave the default local SQLite database configuration in place.

```bash
# Create tables and seed the six sample conversations
npm run db:setup

# Start the development server
npm run dev
```

Open **http://localhost:3000** and sign in with any demo account. For example, use `maya@harbour.example` and the password configured for `DEMO_PASSWORD_MAYA`.

The seed data includes the assignment's six Monday-morning threads (T1–T6). To restore their initial state, run `npm run db:reset` (this deletes current local demo changes).

## Code Structure

```text
src/
├── app/          # Pages, staff/client portals and API routes
├── components/   # Shared UI components
├── server/       # Authentication, permissions and request rules
├── db/           # Schema, database connection and demo seed
└── lib/          # Shared utilities
drizzle/          # Database migrations
tests/            # Automated API, workflow and integrity tests
scripts/          # Database setup/reset utilities
```

The main business rules live in `src/server/requests.ts`. Client responses are assembled in `src/server/client-view.ts`, which only selects authorized threads and client-visible messages; internal notes and unsent drafts are excluded from client queries.

## Tests

```bash
npm test
npm run build
```

The test suite contains **44 tests** covering authorization and client isolation, request lifecycle behavior, concurrent claims, transaction integrity, and persistence. Tests run against isolated databases and do not modify the local demo database.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the development server |
| `npm run build` | Build for production |
| `npm start` | Start the production build locally |
| `npm test` | Run tests |
| `npm run db:setup` | Apply migrations and seed an empty database |
| `npm run db:reset` | Recreate the sample data (**destructive**) |
| `npm run db:generate` | Generate migrations after schema changes |

## Documentation
- [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) — Demo account roles, emails and password setup to be shared.

## Current Scope

The demo uses a client portal instead of live email ingestion/delivery. Attachments, notifications, and account administration are not implemented. These constraints are deliberate for the limited scope and are discussed in the submission overview.

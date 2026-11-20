# Harbour Mailbox

A shared mailbox for a small advisory firm. It separates the **conversation** (a thread with a client) from the **work** (a request with one owner, a next step and a recorded outcome), so nobody has to guess what still needs doing or who owns it.

| Document | Read it for |
| --- | --- |
| `README.md` (this file) | Running it, deploying it, a tour of the screens, and what every file and folder is |
| [HANDOFF.md](HANDOFF.md) | The product decisions, how it works inside, the API, known gaps, likely discussion questions |
| [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) | Who the demo people are, their jobs, their emails, and where each one's password is set |
| [BUILD_PLAN.md](BUILD_PLAN.md) | The plan the build followed, and where the build differs from it |
| [AGENTS.md](AGENTS.md) | Instructions for an AI coding assistant working on this code |

Everything used is free. You need only Node.js and Git.

**Contents:** 1 Prerequisites · 2 Unzip · 3 Install and run · 4 A tour of the app · 5 Tests · 6 Restart check · 7 Commands · 8 Deploy · 9 Troubleshooting · 10 Every file and folder

---

## 1. Install the two prerequisites (once)

Written for Windows 10 or 11. Every command goes into **Windows PowerShell**. On Mac or Linux the `npm` commands are identical.

1. **Node.js 22 LTS**: download the Windows installer from nodejs.org, run it, accept the defaults.
2. **Git for Windows**: download from git-scm.com, run it, accept the defaults. Needed for deployment only.
3. Close any open PowerShell windows, open a new one, and check:

```powershell
node --version
npm --version
git --version
```

Expected: `v22.x.x` (20 or later works), a version number such as `10.x.x`, and `git version 2.x`.

If `npm` fails with "running scripts is disabled on this system", run this once and try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. Unzip and open the folder

1. Right-click `harbour-mailbox.zip`, choose **Extract All**, and extract to a short path such as `C:\dev\harbour-mailbox`. Avoid OneDrive folders; file syncing slows the install.
2. Open the extracted folder in File Explorer. You should see `package.json` directly inside it. If you see only another folder, go into that one.
3. Click the address bar, type `powershell`, press Enter. A PowerShell window opens in that folder.
4. Confirm you are in the right place:

```powershell
dir package.json
```

All remaining commands are run from this folder.

## 3. Install, set up, run

| Step | Command | What it does | Expected |
| --- | --- | --- | --- |
| 1 | `npm install` | Downloads the libraries into `node_modules` | 1-3 minutes, ends with "added N packages" |
| 2 | `Copy-Item .env.example .env` | Creates your local settings file | No output |
| 2a | `notepad .env` | Opens the settings file. Type a password (8 or more characters, a different one each) after the `=` on each of the twelve `DEMO_PASSWORD_...` lines. Save and close. | Notepad opens |
| 3 | `npm run db:setup` | Creates `data\harbour.db`, builds the tables, loads the six demo threads | A list of demo accounts, then "Database ready." |
| 4 | `npm run dev` | Starts the app | "Ready" and `http://localhost:3000` |

5. Open `http://localhost:3000` in a browser.
6. On the login page, sign in as Maya: email `maya@harbour.example`, and the password you gave `DEMO_PASSWORD_MAYA` in step 2a. You should see Sam's application at the top under "Unowned", due in about a day.
7. To stop the app, click the PowerShell window and press `Ctrl + C`.

Notes on these steps:

- **Leave the PowerShell window open** while you use the app. Closing it stops the app.
- **The first page takes a few seconds** in `npm run dev`, because each page is compiled the first time it is opened.
- **On Mac or Linux**, step 2 is `cp .env.example .env`.
- **What step 1 creates:** a `node_modules` folder (about 400 MB of libraries). It is not part of the source and can always be recreated with `npm install`.
- **What step 3 creates:** a `data` folder containing `harbour.db`. That one file is the whole database. Deleting it and running `npm run db:setup` gives you a fresh copy of the demo data.
- **What step 4 creates:** a `.next` folder, Next.js's working files. Safe to delete at any time.

**Signing in.** The login page shows no accounts: it takes an email and a password, as a real one would. Every demo person has their own password, which you chose in `.env` (step 2a). No password is written in the code or in any document: step 3 reads `.env`, and the database keeps only a hash. If step 3 says "Demo passwords are not set", a line in `.env` is empty or shorter than 8 characters. All twelve accounts, with each person's job, email and what to look at, are in [`DEMO_ACCOUNTS.md`](DEMO_ACCOUNTS.md). Staff emails are `name@harbour.example` and client emails are `name@client.example`.

## 4. A tour of the app

The demo data is the Monday-morning mailbox from the brief: six threads, T1 to T6. Times are set relative to when the data was loaded, so it always looks like "now".

### As Maya (service associate): the queue

Sign in as Maya (emails are in `DEMO_ACCOUNTS.md`, passwords in your `.env`). Her queue has these sections:

| Section | What is in it at the start | What to try |
| --- | --- | --- |
| Unowned | Sam's application, due in a day (T2). Sam's change of address, sent on an old thread (T5). | Click **Claim** on Sam's application. It moves to "Mine: needs action". |
| Mine: needs action | Elena's "URGENT — thank you" (T1). Noor's appointment, flagged "Reply not sent" (T6). | Click **No action needed** on Elena's. It moves to "Recently closed" without being opened. |
| Mine: waiting on client | Elena's signed form (T3). | Nothing to do: it comes back when Elena replies. |
| Recently closed | Sam's old application documents. | Open it and click **Reopen** to see that closing can be undone. |

Every row shows why it is there, the latest message, and a "Next:" line saying who does what.

### As Maya: one conversation

Click **Open** on Noor's appointment (T6).

- The dashed orange box is the draft from Friday that was never sent. Click **Send to client now**.
- Below the messages are two boxes. The teal one writes to the client. The amber one writes an internal note that the client never sees.
- In the amber box, write a question, choose **Leo** under "Ask a colleague", and add it.
- On the right, each request has its actions: **Mark as waiting on client**, **Hand over to a colleague**, **Close with an outcome**, and **History**.
- Under "Who can see this conversation" is the list of clients with access and the form to give access, which requires a reason.

### As Leo (adviser)

Sign out, then sign in as Leo.

- "Questions for me" shows Maya's note. **Mark answered** removes it.
- Oliver's request for Elena's documents (T4) is flagged "Access decision needed". Open it and try **Close with an outcome** with no reason: it is refused. Close it as **Declined** with a reason.

### As Priya (operations lead)

- **Whole team** in the top bar shows everyone's work.
- **Outcomes** shows open requests, work unowned for over a day, reopened requests, and average days to an outcome.

### As the clients

| Sign in as | What you see |
| --- | --- |
| Elena | Three conversations: two of her own and the joint one. T3 shows "Waiting for you: signed form". No internal notes anywhere. |
| Oliver | Only "Joint paperwork". He cannot see Elena's other conversations, even with their address pasted into the browser. |
| Sam | Reply on "Application documents" (closed). Then sign in as staff: a new unowned request has appeared. |
| Noor | The reply Maya sent, and not her note to Leo. |

To put everything back as it was: stop the app, run `npm run db:reset`, start it again.

## 5. Run the tests

Open a second PowerShell window in the same folder, or stop the app first:

```powershell
npm test
```

Expected: `Test Files 3 passed (3)` and `Tests 44 passed (44)`, in about ten seconds. The tests use their own temporary database and do not touch your demo data.

## 6. Prove state survives a restart

1. As Maya, claim Sam's request and add an internal note to it.
2. In PowerShell, press `Ctrl + C` to stop the app.
3. Run `npm run dev` again and refresh the browser.
4. The claim and the note are still there. The data lives in `data\harbour.db`, not in memory.

## 7. Useful commands

| Command | Use |
| --- | --- |
| `npm run dev` | Run locally while developing |
| `npm run build` then `npm start` | Run the production build locally |
| `npm test` | Run the tests |
| `npm run db:setup` | Create tables; load demo data only if the database is empty |
| `npm run db:reset` | Wipe everything and reload the six demo threads. Use before a demo. |
| `npm run db:generate` | After changing `src/db/schema.ts`: write a new migration into `drizzle/` |

## 8. Deploy for free

You need three free accounts: GitHub, Turso (database) and Vercel (hosting). Check each one's current free-tier terms when you sign up.

### Step 1: put the code on GitHub

1. Sign in to github.com and create a new **empty** repository named `harbour-mailbox` (no README, no .gitignore).
2. In PowerShell, in the project folder (replace `YOUR-USERNAME`):

```powershell
git init
git add .
git commit -m "Harbour mailbox"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/harbour-mailbox.git
git push -u origin main
```

If Git asks who you are, run `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, then repeat the commit. A browser window opens for the GitHub sign-in on first push.

### Step 2: create the hosted database on Turso

1. Sign up at turso.tech.
2. In the web dashboard, create a database named `harbour`, in the region nearest you.
3. Copy the database URL. It starts with `libsql://`.
4. Create a database token with read and write access and copy it.

Use the web dashboard for this. The Turso command-line tool does not run on Windows without WSL.

### Step 3: load the tables and demo data into Turso

In PowerShell, in the project folder, paste your two values between the quotes:

```powershell
$env:DATABASE_URL = "libsql://your-database-url"
$env:DATABASE_AUTH_TOKEN = "your-token"
npm run db:setup
```

Expected: "Database ready." Then **close this PowerShell window**, so later local commands go back to the local file database.

### Step 4: deploy the app on Vercel

1. Sign up at vercel.com using **Continue with GitHub**.
2. Choose **Add New > Project** and import `harbour-mailbox`.
3. Leave the build settings as detected (Next.js).
4. Under **Environment Variables**, add:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the `libsql://` URL from Turso |
| `DATABASE_AUTH_TOKEN` | the Turso token |

5. Click **Deploy**. After a minute or two Vercel shows the live address, ending in `.vercel.app`.

### Step 5: check the live site

1. Open the live address and sign in as Maya.
2. Make a change, such as claiming a request.
3. In Vercel, open **Deployments**, choose the latest, and **Redeploy**. Your change is still there afterwards.

**Updating later:** change the code, then `git add .`, `git commit -m "what changed"`, `git push`. Vercel redeploys by itself. To reset the live demo data, repeat Step 3 with `npm run db:reset` in place of `npm run db:setup`.

## 9. If something goes wrong

| Symptom | Fix |
| --- | --- |
| "running scripts is disabled" | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then retry |
| `node` or `npm` not recognised | Close and reopen PowerShell after installing Node |
| "Could not read package.json" | You are in the wrong folder. Repeat section 2, steps 2-4. |
| Port 3000 already in use | `npm run dev -- -p 3001`, then open `http://localhost:3001` |
| `npm install` fails part-way | Delete the `node_modules` folder and run `npm install` again |
| Login fails for demo accounts | Check the email against `DEMO_ACCOUNTS.md` and the password against that person's line in `.env`. If you edited `.env` after setup, run `npm run db:reset`. |
| "Demo passwords are not set" | Open `.env` and give every `DEMO_PASSWORD_...` line a value of 8 or more characters, then run the command again. |
| Sign-in keeps saying "Email or password is incorrect" even with the right password | Wait one minute. Five wrong passwords pause that account briefly, and the page gives the same message on purpose so it does not reveal which emails have accounts. |
| Local app shows the live data | A PowerShell window still has the Turso values set. Close it and open a new one. |
| Vercel build fails | Open the build log; the usual cause is a missing or mistyped environment variable. Fix it and Redeploy. |
| Live site errors on login | The Turso database is empty. Repeat section 8, Step 3. |

## 10. Every file and folder

### How the pieces fit

```
Browser
  │  pages: /login, /staff..., /portal...        buttons and forms post JSON to /api/...
  ▼
src/app            screens (pages) and API routes; thin, no rules of their own
  │
  ▼
src/server         the rules: who may do what, what a request does next, what a client may see
  │
  ▼
src/db             table definitions and the database connection
  │
  ▼
data/harbour.db    one SQLite file (or a hosted Turso database when deployed)
```

A rule of thumb for finding things: **screens are in `src/app`, decisions are in `src/server`, storage is in `src/db`.**

### Top level

| Path | What it is |
| --- | --- |
| `README.md` | This file |
| `HANDOFF.md` | Decisions, internals, API reference, gaps, discussion preparation |
| `BUILD_PLAN.md` | The plan and how the build differs from it |
| `DEMO_ACCOUNTS.md` | The twelve demo accounts: name, job, email, which `.env` line holds the password, what to look at as each. Must match `src/db/seed.ts`. |
| `AGENTS.md` | Briefing for an AI coding assistant: commands, rules that must not be broken, where to make common changes |
| `harbor doc feature md.md` | The original assignment brief |
| `package.json` | The project's name, its libraries (`dependencies` are needed to run, `devDependencies` only to build and test), and the `npm run ...` commands |
| `package-lock.json` | The exact version of every library that was installed. Written by npm; do not edit. It makes `npm install` give the same result on every machine. |
| `.env.example` | Template for settings. Copied to `.env` in step 3. |
| `.env` | Your local settings: database location and the twelve demo passwords. Created by you, never committed, not in the zip. |
| `.gitignore` | Files Git must not track: `node_modules`, `.next`, `data`, `.env`, zips |
| `tsconfig.json` | TypeScript settings. The important line is `"@/*": ["./src/*"]`, which lets code write `@/server/auth` instead of `../../server/auth`. |
| `next.config.mjs` | Next.js settings, and the security headers sent with every page (each one explained inside) |
| `postcss.config.mjs` | Turns on Tailwind for the stylesheet |
| `drizzle.config.ts` | Tells `npm run db:generate` where the table definitions are and where to write migrations |
| `vitest.config.mts` | Test runner settings |
| `next-env.d.ts` | Written by Next.js. Do not edit. |

### Folders that are created, not written

| Path | Created by | Safe to delete? |
| --- | --- | --- |
| `node_modules/` | `npm install` | Yes. Run `npm install` again. |
| `.next/` | `npm run dev` or `npm run build` | Yes. It is rebuilt. |
| `data/` | `npm run db:setup` | Yes, but it holds your database. Run `npm run db:setup` to get the demo data back. |
| `data/test/` | `npm test`, removed when tests finish | Yes |

### `drizzle/`: the database's history

| Path | What it is |
| --- | --- |
| `drizzle/0000_init.sql` | The SQL that creates the seven tables. Generated from `src/db/schema.ts`; applied by `npm run db:setup`. |
| `drizzle/0001_indexes.sql` | The SQL that adds the indexes (fast look-ups by thread, status, addressee and so on). Also generated from `src/db/schema.ts`. |
| `drizzle/meta/` | Drizzle's own record of which migrations exist and what the tables looked like after each. Generated; do not edit. |

When a table changes, `npm run db:generate` adds a new numbered `.sql` file here. Existing files are never edited.

### `scripts/`: run from the command line

| Path | What it does |
| --- | --- |
| `scripts/setup-db.ts` | `npm run db:setup`. Creates the tables, loads the demo data if the database is empty, prints the demo emails and job titles (not passwords). Never destroys data. |
| `scripts/reset-db.ts` | `npm run db:reset`. Deletes everything and reloads the demo data. |

### `src/db/`: storage

| Path | What it is |
| --- | --- |
| `src/db/schema.ts` | The seven tables: `users`, `sessions`, `threads`, `thread_participants`, `requests`, `messages`, `request_events`. Each has a comment explaining its purpose. |
| `src/db/client.ts` | Opens the database connection (`db`), runs migrations, makes random ids |
| `src/db/seed.ts` | The demo data: 8 staff, 4 clients, threads T1-T6. Reads each demo account's password from `.env`; holds none itself. |

### `src/server/`: the rules

| Path | What it is |
| --- | --- |
| `src/server/requests.ts` | **Every request rule.** `createRequest`, `onClientMessage`, `claim`, `handOver`, `setWaitingOnClient`, `resume`, `markReplied`, `close`, `reopen`. Starts with a diagram of the request's life. |
| `src/server/client-view.ts` | **The only code that builds data for clients.** Filters threads by participant and selects only client messages and sent replies. |
| `src/server/messages.ts` | Writing: client messages, staff replies, drafts, internal notes, giving access. Also `assertParticipant`, the client access check. |
| `src/server/staff-view.ts` | Reading for staff: the queue, the full thread, the outcomes numbers, and the "next step" sentence |
| `src/server/auth.ts` | Passwords, sessions, cookies, `requireRole` |
| `src/server/http.ts` | The wrapper every API route uses: sign-in and role check, same-origin check, JSON parsing, error replies |
| `src/server/page-auth.ts` | The sign-in check for pages (redirects to the login page) |
| `src/server/errors.ts` | `AppError` (an error with an HTTP status that is safe to show) and `requireText` |

### `src/app/`: screens and API

In Next.js, the folder path is the web address. A file named `page.tsx` is a screen; `route.ts` is an API endpoint; `layout.tsx` wraps the pages below it; a folder in square brackets such as `[id]` is a variable part of the address.

| Path | Address | What it is |
| --- | --- | --- |
| `src/app/layout.tsx` | every page | Outer frame: tab title, stylesheet |
| `src/app/not-found.tsx` | any address that does not exist | The "Page not found" screen. Also shown for a conversation a client may not see, so it never confirms the conversation exists. |
| `src/app/error.tsx` | any page that crashes | A plain "Something went wrong" screen with a retry button and a reference code; no technical detail |
| `src/app/globals.css` | | The stylesheet: Tailwind plus a few shared styles (`.btn`, `.card`, ...) |
| `src/app/page.tsx` | `/` | Sends you to `/staff`, `/portal` or `/login` |
| `src/app/login/page.tsx` | `/login` | Login page |
| `src/app/login/LoginForm.tsx` | | The form and demo-account buttons (runs in the browser) |
| `src/app/staff/layout.tsx` | `/staff/...` | Staff-only guard and top bar |
| `src/app/staff/page.tsx` | `/staff` | The work queue |
| `src/app/staff/threads/[id]/page.tsx` | `/staff/threads/:id` | One conversation: messages, reply and note boxes, requests, access |
| `src/app/staff/outcomes/page.tsx` | `/staff/outcomes` | Outcome summary |
| `src/app/portal/layout.tsx` | `/portal/...` | Client-only guard and top bar |
| `src/app/portal/page.tsx` | `/portal` | A client's conversations, and "Ask something new" |
| `src/app/portal/threads/[id]/page.tsx` | `/portal/threads/:id` | One conversation as the client sees it |

API routes (full details in HANDOFF.md):

| Path | Address |
| --- | --- |
| `src/app/api/auth/login/route.ts` | `POST /api/auth/login` |
| `src/app/api/auth/logout/route.ts` | `POST /api/auth/logout` |
| `src/app/api/staff/queue/route.ts` | `GET /api/staff/queue` |
| `src/app/api/staff/threads/[id]/route.ts` | `GET /api/staff/threads/:id` |
| `src/app/api/staff/threads/[id]/messages/route.ts` | `POST /api/staff/threads/:id/messages` |
| `src/app/api/staff/threads/[id]/requests/route.ts` | `POST /api/staff/threads/:id/requests` |
| `src/app/api/staff/threads/[id]/participants/route.ts` | `POST /api/staff/threads/:id/participants` |
| `src/app/api/staff/requests/[id]/[action]/route.ts` | `POST /api/staff/requests/:id/claim`, `handover`, `wait`, `resume`, `close`, `reopen` |
| `src/app/api/staff/messages/[id]/[action]/route.ts` | `POST /api/staff/messages/:id/send`, `discard`, `answered` |
| `src/app/api/client/threads/route.ts` | `GET` and `POST /api/client/threads` |
| `src/app/api/client/threads/[id]/route.ts` | `GET /api/client/threads/:id` |
| `src/app/api/client/threads/[id]/messages/route.ts` | `POST /api/client/threads/:id/messages` |

### `src/components/` and `src/lib/`: shared pieces

| Path | What it is |
| --- | --- |
| `src/components/ApiForm.tsx` | The form used by every button: sends its fields as JSON, shows an error, refreshes the page. Can ask "are you sure?" first (used by "No action needed" in the queue). Apart from the login form and the error screen, this is the only code that runs in the browser. |
| `src/components/Header.tsx` | The top bar with links and Sign out |
| `src/lib/format.ts` | "5 min ago", "Due in 1 day", and message previews |

### `tests/`

| Path | What it is |
| --- | --- |
| `tests/boundaries.test.ts` | 19 tests through the real API routes: internal notes and drafts never reach clients; clients cannot reach each other's threads; 401, 403, login lock, one password per account, cookie flags, cross-site refusal, sign-out, expiry |
| `tests/requests.test.ts` | 19 tests of the rules: the T1-T6 behaviours, ownership, handover, outcomes, questions for a colleague, data surviving a new connection |
| `tests/integrity.test.ts` | 6 tests of data safety: a change that fails part-way is undone completely; a refused reply is not sent; eight people claiming one request at once gives exactly one owner; sign-ins and other changes at the same moment do not block each other |
| `tests/helpers.ts` | `freshMailbox()` (reload demo data), `call()` (invoke a route), `signIn()` |
| `tests/setup.ts` | Gives each test file its own throwaway database |
| `tests/global-setup.ts` | Deletes the throwaway databases afterwards |

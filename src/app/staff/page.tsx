// THE STAFF QUEUE  (/staff, and /staff?scope=team for the whole team)
// The home screen for staff: one row per request, grouped by what needs to happen.
//
// This is a server component: it runs on the server for each visit, reads the queue with
// getQueue (src/server/staff-view.ts) and sends finished HTML. The only parts that run in
// the browser are the <ApiForm> buttons, which post to the API and then refresh the page.
//
//   QueueRow  one request: why it is here, due date, client, latest message, next step, buttons
//   Section   a titled group of rows, with a message for when it is empty
//   QueuePage the page itself

import Link from "next/link";
import { ApiForm } from "@/components/ApiForm";
import { dueLabel, shorten, timeAgo } from "@/lib/format";
import { pageUser } from "@/server/page-auth";
import { getQueue } from "@/server/staff-view";

// The shape of one queue row, taken from what getQueue returns so the two cannot drift apart.
type Row =Awaited<ReturnType<typeof getQueue>>["unowned"][number];

// Badge colour for each reason. The keys must match the strings returned by reason() in
// src/server/staff-view.ts.
const REASON_STYLE: Record<string, string> = {
  Unowned: "bg-red-100 text-red-800",
  "Reply not sent": "bg-orange-100 text-orange-800",
  "Client replied": "bg-blue-100 text-blue-800",
  "Access decision needed": "bg-purple-100 text-purple-800",
  "Waiting on client": "bg-slate-100 text-slate-700",
  "In progress": "bg-slate-100 text-slate-700",
};

function QueueRow({ row, closed }: { row: Row; closed?: boolean }) {
  const overdue = row.dueAt !== null && row.dueAt < Date.now();
  return (
    <li className="card flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
      {/* Left: everything needed to decide what to do WITHOUT opening the thread
          (Maya: "I open every unread email to work out what needs me"). */}
      <div className="min-w-0 flex-1 basis-80">
        <div className="flex flex-wrap items-center gap-2">
          {!closed && <span className={`badge ${REASON_STYLE[row.reason] ?? ""}`}>{row.reason}</span>}
          {!closed && row.dueAt !== null && (
            <span className={`badge ${overdue ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}`}>{dueLabel(row.dueAt)}</span>
          )}
          <Link href={`/staff/threads/${row.threadId}`} className="font-medium text-slate-900 hover:text-teal-700 hover:underline">
            {row.title}
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {row.clients.join(" & ")} · {row.subject} · {row.ownerName ? `Owner: ${row.ownerName}` : "No owner"}
          {row.previouslyHandledBy && ` · ${row.previouslyHandledBy} handled this thread before`}
        </p>
        {!closed && row.preview && (
          <p className="mt-2 border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
            <span className="text-slate-500">
              {row.preview.authorName}, {timeAgo(row.preview.createdAt)}:
            </span>{" "}
            “{shorten(row.preview.body)}”
          </p>
        )}
        <p className="mt-2 text-sm">
          <span className="font-medium text-slate-500">Next: </span>
          {row.nextStep}
        </p>
      </div>
      {/* Right: quick actions.
          Claim             only when nobody owns the request
          No action needed  only for new or just-replied-to work (a thank-you, for example);
                            never offered where a decision or a pending reply could be lost
          Open              always */}
      <div className="flex shrink-0 flex-wrap items-start gap-2">
        {!closed && !row.ownerId && (
          <ApiForm action={`/api/staff/requests/${row.id}/claim`}>
            <button className="btn-primary">Claim</button>
          </ApiForm>
        )}
        {!closed && (row.reason === "Client replied" || row.reason === "Unowned") && (
          <ApiForm
            action={`/api/staff/requests/${row.id}/close`}
            confirm={`Close "${row.title}" as no action needed? The client will not get a reply. You can reopen it later.`}
          >
            <input type="hidden" name="outcome" value="no_action_needed" />
            <button className="btn" title="Close this request without a reply, for example a thank-you">
              No action needed
            </button>
          </ApiForm>
        )}
        <Link href={`/staff/threads/${row.threadId}`} className="btn">
          Open
        </Link>
      </div>
    </li>
  );
}

function Section({ title, hint, rows, empty, closed }: { title: string; hint: string; rows: Row[]; empty: string; closed?: boolean }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold">
        {title} <span className="font-normal text-slate-500">({rows.length})</span>
      </h2>
      <p className="mb-3 text-sm text-slate-500">{hint}</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <QueueRow key={row.id} row={row} closed={closed} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await pageUser("staff"); // redirects away unless a member of staff is signed in
  // /staff?scope=team shows everyone's work; plain /staff shows mine plus unowned.
  const team =(await searchParams).scope === "team";
  const queue = await getQueue(user, team ? "team" : "mine");

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{team ? "Whole team" : `${user.name}'s queue`}</h1>
      <p className="mb-6 text-sm text-slate-600">
        Each row is one piece of work with one owner. {team ? "Showing everyone's work." : "Showing unowned work and your own."}
      </p>

      <Section
        title="Unowned"
        hint="Nobody is accountable for these yet. Reading one does not make it yours; claiming it does."
        rows={queue.unowned}
        empty="Nothing is waiting for an owner."
      />
      <Section
        title={team ? "Needs action" : "Mine: needs action"}
        hint="The next move is ours."
        rows={queue.needsAction}
        empty="Nothing needs action."
      />

      {/* Internal notes a colleague addressed to me. Only shown when there are some. */}
      {queue.questions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold">
            Questions for me <span className="font-normal text-slate-500">({queue.questions.length})</span>
          </h2>
          <p className="mb-3 text-sm text-slate-500">Internal notes a colleague addressed to you. Clients never see these.</p>
          <ul className="space-y-2">
            {queue.questions.map((q) => (
              <li key={q.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <div className="min-w-0 flex-1 basis-80 text-sm">
                  <p className="text-slate-600">
                    {q.fromName} asked {timeAgo(q.createdAt)} · {q.subject}
                  </p>
                  <p className="mt-1">“{shorten(q.body, 240)}”</p>
                </div>
                <ApiForm action={`/api/staff/messages/${q.id}/answered`}>
                  <button className="btn">Mark answered</button>
                </ApiForm>
                <Link href={`/staff/threads/${q.threadId}`} className="btn">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section
        title={team ? "Waiting on client" : "Mine: waiting on client"}
        hint="Not finished. They come back to “needs action” when the client replies."
        rows={queue.waiting}
        empty="Nothing is waiting on a client."
      />
      <Section title="Recently closed" hint="Closed with a recorded outcome." rows={queue.recentlyClosed} empty="Nothing closed yet." closed />
    </>
  );
}

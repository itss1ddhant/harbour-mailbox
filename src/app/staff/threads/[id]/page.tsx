// THE STAFF THREAD SCREEN  (/staff/threads/:id)
// One conversation, with everything staff can do to it.
//
//   Left:   the messages, then two separate boxes: "Reply to client" (teal) and
//           "Internal note" (amber). They are kept visibly different so a note is never
//           sent to a client by mistake.
//   Right:  the requests in this conversation (owner, next step, actions, history),
//           then who can see the conversation and the form to give access.
//
// The collapsible parts use the plain HTML <details>/<summary> elements, so they open
// and close without any JavaScript. Every button is an <ApiForm> posting to /api/staff/...
//
//   Message      one message, drawn differently for client / staff reply / draft / note
//   RequestCard  one request with its actions
//   ThreadPage   the page itself

import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/components/ApiForm";
import { dueLabel, timeAgo } from "@/lib/format";
import { AppError } from "@/server/errors";
import { pageUser } from "@/server/page-auth";
import { getStaffThread, OUTCOME_LABELS } from "@/server/staff-view";

// The shape of the data, taken from what getStaffThread returns.
type Thread = Awaited<ReturnType<typeof getStaffThread>>;

// Label and badge colour for each request status.
const STATUS: Record<string, { label: string; style: string }> = {
  needs_triage: { label: "Needs triage", style: "bg-red-100 text-red-800" },
  open: { label: "Open", style: "bg-blue-100 text-blue-800" },
  waiting_on_client: { label: "Waiting on client", style: "bg-slate-100 text-slate-700" },
  closed: { label: "Closed", style: "bg-green-100 text-green-800" },
};

// One message. Four looks, so that nobody can mistake who has seen what:
//   internal note  amber box, labelled "not visible to the client"
//   draft reply    dashed orange box, labelled "not sent", with Send and Discard
//   staff reply    teal, indented from the left
//   client message white, indented from the right
function Message({ m, meId }: { m: Thread["messages"][number]; meId: string }) {
  if (m.kind === "internal_note") {
    return (
      <li className="rounded-lg border border-amber-300 bg-amber-50 p-3">
        <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">Internal note · not visible to the client</p>
        <p className="mt-1 text-xs text-slate-600">
          {m.authorName}, {timeAgo(m.createdAt)}
          {m.addressedToName && ` · for ${m.addressedToName}${m.answeredAt ? " (answered)" : ""}`}
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
        {/* Only the person the note is addressed to gets the button. */}
        {m.addressedToId === meId && !m.answeredAt && (
          <ApiForm action={`/api/staff/messages/${m.id}/answered`} className="mt-2">
            <button className="btn">Mark answered</button>
          </ApiForm>
        )}
      </li>
    );
  }
  if (m.deliveryStatus === "draft") {
    return (
      <li className="rounded-lg border-2 border-dashed border-orange-400 bg-orange-50 p-3">
        <p className="text-xs font-semibold tracking-wide text-orange-800 uppercase">Draft reply · not sent · the client has not seen this</p>
        <p className="mt-1 text-xs text-slate-600">
          {m.authorName}, saved {timeAgo(m.createdAt)}
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
        <div className="mt-2 flex gap-2">
          <ApiForm action={`/api/staff/messages/${m.id}/send`}>
            <button className="btn-primary">Send to client now</button>
          </ApiForm>
          <ApiForm action={`/api/staff/messages/${m.id}/discard`}>
            <button className="btn">Discard draft</button>
          </ApiForm>
        </div>
      </li>
    );
  }
  const fromStaff = m.kind === "staff_reply";
  return (
    <li className={`rounded-lg border p-3 ${fromStaff ? "ml-8 border-teal-200 bg-teal-50" : "mr-8 border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-600">
        <span className="font-semibold">{m.authorName}</span> {fromStaff ? "(Harbour) replied" : "(client) wrote"} {timeAgo(m.createdAt)}
        {fromStaff && ` · ${m.deliveryStatus === "failed" ? "Delivery failed" : "Sent"}`}
      </p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
    </li>
  );
}

// One request and the actions that are valid for it right now. Which actions appear
// depends on its state; the same rules are enforced again on the server (requests.ts),
// so hiding a button here is a convenience, not the protection.
//   unowned            Claim
//   waiting on client  Stop waiting
//   owned and open     Mark as waiting on client
//   any open           Hand over / Assign, Close with an outcome
//   closed             Reopen
function RequestCard({ r, thread }: { r: Thread["requests"][number]; thread: Thread }) {
  const closed = r.status === "closed";
  const api = `/api/staff/requests/${r.id}`;
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${STATUS[r.status].style}`}>{STATUS[r.status].label}</span>
        {r.needsAccessDecision && <span className="badge bg-purple-100 text-purple-800">Access decision</span>}
        {!closed && r.dueAt !== null && <span className="badge bg-amber-100 text-amber-900">{dueLabel(r.dueAt)}</span>}
      </div>
      <h3 className="mt-2 font-medium">{r.title}</h3>
      <p className="mt-1 text-sm text-slate-600">Owner: {r.ownerName ?? "nobody yet"}</p>
      <p className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-sm">
        <span className="font-medium text-slate-500">Next: </span>
        {r.nextStep}
      </p>
      {closed && r.outcomeNote && <p className="mt-2 text-sm text-slate-700">Reason recorded: {r.outcomeNote}</p>}

      <div className="mt-3 space-y-2 text-sm">
        {!closed && !r.ownerId && (
          <ApiForm action={`${api}/claim`}>
            <button className="btn-primary">Claim: I own this</button>
          </ApiForm>
        )}
        {!closed && r.status === "waiting_on_client" && (
          <ApiForm action={`${api}/resume`}>
            <button className="btn">Stop waiting: back to open</button>
          </ApiForm>
        )}
        {!closed && r.ownerId && r.status !== "waiting_on_client" && (
          <details>
            <summary className="text-teal-800">Mark as waiting on client</summary>
            <ApiForm action={`${api}/wait`} className="mt-2">
              <label className="label">What are we waiting for? (the client sees this)</label>
              <input name="waitingFor" required maxLength={200} placeholder="e.g. signed form" className="field mb-2" />
              <button className="btn">Mark waiting</button>
            </ApiForm>
          </details>
        )}
        {!closed && (
          <details>
            <summary className="text-teal-800">{r.ownerId ? "Hand over to a colleague" : "Assign to a colleague"}</summary>
            <ApiForm action={`${api}/handover`} className="mt-2">
              <label className="label">New owner</label>
              <select name="toUserId" required className="field mb-2" defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {thread.staff
                  .filter((s) => s.id !== r.ownerId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.title})
                    </option>
                  ))}
              </select>
              <label className="label">Handover note (internal)</label>
              <textarea name="note" required rows={2} className="field mb-2" placeholder="What they need to know" />
              <button className="btn">Hand over</button>
            </ApiForm>
          </details>
        )}
        {!closed && (
          <details>
            <summary className="text-teal-800">Close with an outcome</summary>
            <ApiForm action={`${api}/close`} className="mt-2">
              <label className="label">Outcome</label>
              <select name="outcome" required className="field mb-2" defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="label">
                {r.needsAccessDecision ? "Access decision and reason (required, internal)" : "Reason (internal; required if declined)"}
              </label>
              <textarea name="note" rows={2} className="field mb-2" required={r.needsAccessDecision} />
              <button className="btn">Close request</button>
            </ApiForm>
          </details>
        )}
        {closed && (
          <ApiForm action={`${api}/reopen`}>
            <button className="btn">Reopen</button>
          </ApiForm>
        )}
        <details>
          <summary className="text-slate-500">History ({r.events.length})</summary>
          <ul className="mt-1 space-y-1 text-xs text-slate-600">
            {r.events.map((e) => (
              <li key={e.id}>
                {timeAgo(e.createdAt)}: {e.detail}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </li>
  );
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await pageUser("staff"); // redirects away unless a member of staff is signed in
  const { id } = await params; // the :id part of the address
  let thread: Thread;
  // An unknown id shows the standard "not found" page instead of an error.
  try {
    thread = await getStaffThread(id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const openRequests = thread.requests.filter((r) => r.status !== "closed");
  const names = thread.participants.map((p) => p.name).join(" & ");

  return (
    <>
      <Link href="/staff" className="text-sm text-teal-800 hover:underline">
        ← Back to queue
      </Link>
      <h1 className="mt-2 text-xl font-semibold">{thread.subject}</h1>
      <p className="mb-5 text-sm text-slate-600">Conversation with {names}</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <ul className="space-y-3">
            {thread.messages.map((m) => (
              <Message key={m.id} m={m} meId={me.id} />
            ))}
          </ul>

          {/* The two ways of writing. Both post to the same route; the hidden "mode" field
              says which. Different colours, titles and button labels keep them apart. */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ApiForm action={`/api/staff/threads/${thread.id}/messages`} className="rounded-lg border-2 border-teal-600 bg-white p-4">
              <input type="hidden" name="mode" value="reply" />
              <h2 className="font-semibold text-teal-800">Reply to client</h2>
              <p className="mb-2 text-xs text-slate-600">{names} will see this.</p>
              <textarea name="body" required rows={4} className="field mb-2" placeholder={`Write to ${names}…`} />
              {/* Linking the reply to a request lets one send both answer the client and,
                  if something is still owed, move the request to "waiting on client". */}
              {openRequests.length > 0 && (
                <>
                  <label className="label">About which request?</label>
                  <select name="requestId" className="field mb-2">
                    {openRequests.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  <label className="label">Still need something from the client? (optional)</label>
                  <input name="waitingFor" maxLength={200} className="field mb-2" placeholder="e.g. signed form. Keeps the request open" />
                </>
              )}
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" name="draft" /> Save as draft, do not send yet
              </label>
              <button className="btn-primary">Send to client</button>
            </ApiForm>

            <ApiForm action={`/api/staff/threads/${thread.id}/messages`} className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
              <input type="hidden" name="mode" value="note" />
              <h2 className="font-semibold text-amber-900">Internal note</h2>
              <p className="mb-2 text-xs text-slate-600">Staff only. Never sent to or shown to the client.</p>
              <textarea name="body" required rows={4} className="field mb-2" placeholder="Note or question for colleagues…" />
              <label className="label">Ask a colleague (optional)</label>
              <select name="addressedTo" className="field mb-3" defaultValue="">
                <option value="">Nobody in particular</option>
                {thread.staff
                  .filter((s) => s.id !== me.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.title})
                    </option>
                  ))}
              </select>
              <button className="btn-note">Add internal note</button>
            </ApiForm>
          </div>
        </div>

        {/* Right-hand column: the work, then the access list. */}
        <aside className="space-y-6">
          <section>
            <h2 className="mb-2 font-semibold">Requests in this conversation</h2>
            <ul className="space-y-3">
              {thread.requests.map((r) => (
                <RequestCard key={r.id} r={r} thread={thread} />
              ))}
            </ul>
            {thread.requests.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
            <details className="mt-3 text-sm">
              <summary className="text-teal-800">Add another request</summary>
              <ApiForm action={`/api/staff/threads/${thread.id}/requests`} className="card mt-2 p-3">
                <label className="label">What needs doing? (the client sees this title)</label>
                <input name="title" required maxLength={200} className="field mb-2" />
                <label className="label">Owner</label>
                <select name="ownerId" className="field mb-2" defaultValue="">
                  <option value="">Nobody yet (goes to Unowned)</option>
                  {thread.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.title})
                    </option>
                  ))}
                </select>
                <label className="label">Due date (optional)</label>
                <input type="date" name="dueDate" className="field mb-2" />
                <label className="mb-3 flex items-center gap-2">
                  <input type="checkbox" name="needsAccessDecision" /> Needs an access decision
                </label>
                <button className="btn">Add request</button>
              </ApiForm>
            </details>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Who can see this conversation</h2>
            <ul className="card divide-y divide-slate-100 text-sm">
              {thread.participants.map((p) => (
                <li key={p.id} className="p-3">
                  <span className="font-medium">{p.name}</span>
                  <p className="text-xs text-slate-600">
                    {p.addedBy ? `Access given by ${p.addedBy}, ${timeAgo(p.addedAt)}: ${p.reason}` : p.reason}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Clients see only the conversations they are listed on. Being someone&apos;s partner does not give access.
            </p>
            {thread.clientsWithoutAccess.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="text-teal-800">Give another client access</summary>
                <ApiForm action={`/api/staff/threads/${thread.id}/participants`} className="card mt-2 p-3">
                  <label className="label">Client</label>
                  <select name="userId" required className="field mb-2" defaultValue="">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {thread.clientsWithoutAccess.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label className="label">Why? (recorded; they will see the whole conversation)</label>
                  <textarea name="reason" required rows={2} className="field mb-2" placeholder="e.g. Elena gave written consent on 3 May" />
                  <button className="btn">Give access</button>
                </ApiForm>
              </details>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

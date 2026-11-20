// THE CLIENT PORTAL HOME  (/portal)
// A client's own conversations, each with the status of its open requests, and a form to
// ask something new. All data comes from listClientThreads in src/server/client-view.ts,
// which only ever returns threads the client is a participant of.

import Link from "next/link";
import { ApiForm } from "@/components/ApiForm";
import { shorten, timeAgo } from "@/lib/format";
import { listClientThreads } from "@/server/client-view";
import { pageUser } from "@/server/page-auth";

export default async function PortalPage() {
  const user = await pageUser("client"); // redirects away unless a client is signed in
  // The id comes from the session, so a client can only ever list their own conversations.
  const threads = await listClientThreads(user.id);

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Hello, {user.name}</h1>
      <p className="mb-6 text-sm text-slate-600">Your conversations with Harbour, and where each of your requests stands.</p>

      <details className="card mb-6 p-4">
        <summary className="font-medium text-teal-800">Ask something new</summary>
        {/* Starts a new conversation, then opens it (":id" becomes the new thread's id). */}
        <ApiForm action="/api/client/threads" redirectTo="/portal/threads/:id" className="mt-3">
          <label className="label">Subject</label>
          <input name="subject" required maxLength={200} className="field mb-2" />
          <label className="label">Message</label>
          <textarea name="body" required rows={4} className="field mb-3" />
          <button className="btn-primary">Send to Harbour</button>
        </ApiForm>
      </details>

      {threads.length === 0 && <p className="text-sm text-slate-500">You have no conversations yet.</p>}
      <ul className="space-y-3">
        {threads.map((t) => (
          <li key={t.id} className="card p-4">
            <Link href={`/portal/threads/${t.id}`} className="font-medium text-slate-900 hover:text-teal-700 hover:underline">
              {t.subject}
            </Link>
            {t.lastMessage && (
              <p className="mt-1 text-sm text-slate-600">
                {t.lastMessage.authorName}, {timeAgo(t.lastMessage.createdAt)}: “{shorten(t.lastMessage.body, 110)}”
              </p>
            )}
            <ul className="mt-2 space-y-1 text-sm">
              {t.requests
                .filter((r) => r.open)
                .map((r) => (
                  <li key={r.id}>
                    <span className={`badge mr-2 ${r.waitingForYou ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{r.status}</span>
                    {r.title}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

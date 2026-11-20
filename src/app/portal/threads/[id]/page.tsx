// ONE CONVERSATION IN THE CLIENT PORTAL  (/portal/threads/:id)
// Shows who else can see the conversation, where each request stands, the messages, and
// a box to reply. Data comes from getClientThread (src/server/client-view.ts): internal
// notes and drafts are not in it. If the client is not a participant the page shows the
// standard "not found" page, the same as for an address that does not exist.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/components/ApiForm";
import { timeAgo } from "@/lib/format";
import { getClientThread } from "@/server/client-view";
import { AppError } from "@/server/errors";
import { pageUser } from "@/server/page-auth";

export default async function PortalThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("client");
  const { id } = await params;
  let thread: Awaited<ReturnType<typeof getClientThread>>;
  // getClientThread throws a 404 AppError when this client is not on the thread.
  // Showing the ordinary "not found" page reveals nothing about whether the thread exists.
  try {
    thread = await getClientThread(id, user.id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  return (
    <>
      <Link href="/portal" className="text-sm text-teal-800 hover:underline">
        ← All conversations
      </Link>
      <h1 className="mt-2 text-xl font-semibold">{thread.subject}</h1>
      <p className="mb-5 text-sm text-slate-600">
        {thread.sharedWith.length > 0
          ? `Shared with ${thread.sharedWith.join(" and ")}. They can read and write in this conversation.`
          : "Only you and Harbour can see this conversation."}
      </p>

      {/* Plain-language status of each request, so the client knows what happens next
          and whether anything is waiting for them. */}
      {thread.requests.length > 0 && (
        <section className="card mb-5 p-4">
          <h2 className="mb-2 text-sm font-semibold">Where things stand</h2>
          <ul className="space-y-1.5 text-sm">
            {thread.requests.map((r) => (
              <li key={r.id}>
                <span
                  className={`badge mr-2 ${r.waitingForYou ? "bg-amber-100 text-amber-900" : r.open ? "bg-slate-100 text-slate-700" : "bg-green-100 text-green-800"}`}
                >
                  {r.status}
                </span>
                {r.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-3">
        {thread.messages.map((m) => (
          <li key={m.id} className={`rounded-lg border p-3 ${m.fromHarbour ? "mr-8 border-teal-200 bg-teal-50" : "ml-8 border-slate-200 bg-white"}`}>
            <p className="text-xs text-slate-600">
              <span className="font-semibold">{m.authorId === user.id ? "You" : m.authorName}</span> · {timeAgo(m.createdAt)}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ul>

      <ApiForm action={`/api/client/threads/${thread.id}/messages`} className="card mt-6 p-4">
        <label className="label" htmlFor="body">
          Write to Harbour
        </label>
        <textarea id="body" name="body" required rows={4} className="field mb-3" />
        <button className="btn-primary">Send</button>
      </ApiForm>
    </>
  );
}

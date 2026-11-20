"use client";

// Shown when a page crashes while being built (for example the database cannot be
// reached). Next.js requires this file to run in the browser, hence "use client".
// The person sees a plain message and a way to retry. No technical detail is shown:
// the real error is in the server log, and `digest` is a short code that matches the
// log line, so support can find it without the page revealing anything internal.

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-teal-800">Something went wrong</h1>
      <p className="mt-2 text-slate-600">
        Nothing you entered has been lost on the server. Please try again in a moment.
      </p>
      {error.digest && <p className="mt-2 text-xs text-slate-500">Reference: {error.digest}</p>}
      <button className="btn-primary mt-6" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}

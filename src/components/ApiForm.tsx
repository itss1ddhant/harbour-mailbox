"use client";

// The one piece of browser-side code shared by every button and form in the app
// (apart from the login form). See the comment on ApiForm below.

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

// A form that sends its fields as JSON to an API route, shows any error,
// and then refreshes the page (or goes to `redirectTo`; ":id" is replaced by the id in the reply).
//
// How it is used:  <ApiForm action="/api/staff/requests/123/claim"><button>Claim</button></ApiForm>
// The inputs, selects and buttons are written inside it as ordinary HTML by the page.
// Each input's `name` becomes a key in the JSON that is sent.
//
// Why refresh instead of updating the screen by hand: the pages are built on the server
// from the database, so after a change the simplest correct thing is to ask the server
// for the page again. router.refresh() does that without a full page reload.
export function ApiForm({
  action,
  children,
  className,
  redirectTo,
  confirm,
}: {
  action: string;
  children: ReactNode;
  className?: string;
  redirectTo?: string;
  // If given, the browser asks this question first and nothing is sent unless the
  // person says OK. Used for one-click actions that are easy to press by mistake.
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); // true while waiting for the server; disables the form
  const [error, setError] = useState(""); // the server's message if the request was refused

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser's own form submission; we send JSON instead
    const form = event.currentTarget;
    if (confirm && !window.confirm(confirm)) return; // the person changed their mind
    setBusy(true);
    setError("");
    try {
      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // FormData collects every named field in the form; fromEntries turns it into { name: value }.
        // An unticked checkbox is simply absent; a ticked one has the value "on".
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      // The API answers errors as { error: "message" } (see server/http.ts).
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      form.reset(); // clear what was typed
      if (redirectTo) router.push(redirectTo.replace(":id", data.id ?? ""));
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={className}>
      {/* A disabled fieldset disables everything inside it, which prevents double clicks.
          "contents" makes the fieldset itself invisible to the page layout. */}
      <fieldset disabled={busy} className="contents">
        {children}
      </fieldset>
      {error && (
        <p role="alert" className="mt-2 rounded bg-red-50 px-2 py-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

"use client";

// The sign-in form (runs in the browser, hence "use client" above).
// Takes an email and a password and calls POST /api/auth/login. Staff and clients use
// the same form; the server's answer says which home screen to go to.
// After a successful sign-in the page is loaded afresh (window.location) rather than
// navigated in-app, so that every part of the next page is built with the new cookie.

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The server gives one message for "wrong password" and "no such account",
        // so this form never reveals which emails exist.
        setError(data.error ?? "Could not sign in.");
        return;
      }
      window.location.href = data.role === "staff" ? "/staff" : "/portal";
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        signIn();
      }}
    >
      <h2 className="mb-4 font-semibold">Sign in</h2>
      <label className="label" htmlFor="email">
        Email
      </label>
      <input id="email" type="email" required autoFocus autoComplete="username" className="field mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="label" htmlFor="password">
        Password
      </label>
      <input id="password" type="password" required autoComplete="current-password" className="field mb-4" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn-primary" disabled={busy}>
        Sign in
      </button>
      {error && (
        <p role="alert" className="mt-3 rounded bg-red-50 px-2 py-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

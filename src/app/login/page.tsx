// The /login page (runs on the server). Sends people who are already signed in to their
// home screen; otherwise shows the sign-in form.
// The page deliberately shows no account names or passwords. The demo accounts are
// listed in DEMO_ACCOUNTS.md for whoever runs the demo.

import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/server/page-auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold text-teal-800">Harbour Mailbox</h1>
      <p className="mt-1 mb-8 text-slate-600">
        One place for client requests: who owns each one, what happens next, and how it ended.
      </p>
      <LoginForm />
    </main>
  );
}

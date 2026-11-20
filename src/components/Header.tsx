// The top bar shown on every signed-in page: product name, navigation links, who is
// signed in, and the Sign out button (which posts to /api/auth/logout, then goes to /login).

import Link from "next/link";
import type { SessionUser } from "@/server/auth";
import { ApiForm } from "./ApiForm";

export function Header({ user, links }: { user: SessionUser; links: { href: string; label: string }[] }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="text-lg font-semibold text-teal-800">Harbour</span>
        <nav className="flex gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-700 hover:text-teal-700 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {user.name} · {user.title}
          </span>
          <ApiForm action="/api/auth/logout" redirectTo="/login">
            <button className="btn">Sign out</button>
          </ApiForm>
        </div>
      </div>
    </header>
  );
}

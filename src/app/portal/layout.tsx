// Wraps every page under /portal. pageUser("client") is the guard: not signed in ->
// login page; signed in as staff -> the staff queue. Then it adds the top bar.

import { Header } from "@/components/Header";
import { pageUser } from "@/server/page-auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("client");
  return (
    <>
      <Header user={user} links={[{ href: "/portal", label: "My conversations" }]} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}

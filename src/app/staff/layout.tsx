// Wraps every page under /staff. pageUser("staff") is the guard: not signed in -> login
// page; signed in as a client -> the portal. Then it adds the top bar with staff links.

import { Header } from "@/components/Header";
import { pageUser } from "@/server/page-auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("staff");
  return (
    <>
      <Header
        user={user}
        links={[
          { href: "/staff", label: "My queue" },
          { href: "/staff?scope=team", label: "Whole team" },
          { href: "/staff/outcomes", label: "Outcomes" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}

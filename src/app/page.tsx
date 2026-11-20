// The address "/" itself. It shows nothing: it sends signed-in people to their home
// screen (/staff or /portal) and everyone else to /login.

import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/server/page-auth";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? homeFor(user.role) : "/login");
}

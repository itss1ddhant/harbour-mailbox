// Shown for any address that does not exist, and when a page calls notFound(): a
// conversation that is not there, or one this client is not allowed to see. Both cases
// look identical on purpose, so the page never confirms that someone else's conversation exists.

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-teal-800">Page not found</h1>
      <p className="mt-2 text-slate-600">
        This page does not exist, or you do not have access to it.
      </p>
      {/* "/" sends each person to the right place: staff queue, client portal, or sign-in. */}
      <Link href="/" className="btn-primary mt-6 inline-block">
        Back to the start
      </Link>
    </main>
  );
}

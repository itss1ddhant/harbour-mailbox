// The outermost page frame. Next.js wraps every page in this: it sets the browser tab
// title and loads the stylesheet. Staff and portal pages add their own header inside it
// (src/app/staff/layout.tsx and src/app/portal/layout.tsx).

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harbour Mailbox",
  description: "A shared mailbox that tracks who owns each client request and how it ended.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

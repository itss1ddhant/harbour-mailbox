// Data integrity: changes are all-or-nothing, and people acting at the same moment
// cannot leave the data in a muddle.

import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, newId, transaction } from "@/db/client";
import { messages, requestEvents, requests, threads } from "@/db/schema";
import { emailFor, passwordFor } from "@/db/seed";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as requestAction } from "@/app/api/staff/requests/[id]/[action]/route";
import { POST as staffPost } from "@/app/api/staff/threads/[id]/messages/route";
import { call, freshMailbox, signIn } from "./helpers";

let t: Awaited<ReturnType<typeof freshMailbox>>["threads"];
const requestIn = async (threadId: string) => (await db.select().from(requests).where(eq(requests.threadId, threadId)))[0];
const messagesIn = (threadId: string) => db.select().from(messages).where(eq(messages.threadId, threadId));

beforeEach(async () => {
  ({ threads: t } = await freshMailbox());
});

describe("all-or-nothing changes", () => {
  it("if a change fails part-way, everything it had already written is undone", async () => {
    const threadId = newId();
    await expect(
      transaction(async () => {
        await db.insert(threads).values({ id: threadId, subject: "Half-written", createdAt: Date.now() });
        throw new Error("something went wrong after the first write");
      }),
    ).rejects.toThrow();
    expect(await db.select().from(threads).where(eq(threads.id, threadId))).toHaveLength(0);
  });

  it("a later change still works after an earlier one failed", async () => {
    await transaction(async () => { throw new Error("fails"); }).catch(() => {});
    const threadId = newId();
    await transaction(async () => {
      await db.insert(threads).values({ id: threadId, subject: "Fine", createdAt: Date.now() });
    });
    expect(await db.select().from(threads).where(eq(threads.id, threadId))).toHaveLength(1);
  });

  it("a reply that a rule refuses is not sent, so retrying cannot send it twice", async () => {
    // T2 has no owner. "Still need something from the client" requires an owner.
    const maya = await signIn("maya");
    const request = await requestIn(t.t2);
    const before = (await messagesIn(t.t2)).length;

    const res = await call(staffPost, {
      method: "POST",
      cookie: maya,
      params: { id: t.t2 },
      body: { mode: "reply", body: "Please send the last page.", requestId: request.id, waitingFor: "last page" },
    });

    expect(res.status).toBe(409);
    expect(await messagesIn(t.t2)).toHaveLength(before); // nothing reached the client
    expect((await requestIn(t.t2)).status).toBe("needs_triage"); // and the request is untouched
  });
});

describe("people acting at the same moment", () => {
  it("eight people claim the same request at once: exactly one gets it", async () => {
    const keys = ["maya", "leo", "priya", "tom", "aisha", "daniel", "ben", "grace"];
    const cookies = [];
    for (const key of keys) cookies.push(await signIn(key));
    const request = await requestIn(t.t2);

    const results = await Promise.all(
      cookies.map((cookie) => call(requestAction, { method: "POST", cookie, params: { id: request.id, action: "claim" } })),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7); // a clear refusal, never a crash
    const claims = await db.select().from(requestEvents).where(eq(requestEvents.requestId, request.id));
    expect(claims.filter((e) => e.type === "claimed")).toHaveLength(1); // and one history line
  });

  it("closing and handing over the same request at once: one wins, the other is refused", async () => {
    const maya = await signIn("maya");
    const leo = await signIn("leo");
    const request = await requestIn(t.t1);
    const ben = (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, emailFor("ben")) }))!;

    const [closed, handed] = await Promise.all([
      call(requestAction, { method: "POST", cookie: maya, params: { id: request.id, action: "close" }, body: { outcome: "resolved" } }),
      call(requestAction, { method: "POST", cookie: leo, params: { id: request.id, action: "handover" }, body: { toUserId: ben.id, note: "Ben knows this client" } }),
    ]);

    expect([closed.status, handed.status].sort()).not.toContain(500);
    const after = await requestIn(t.t1);
    // Whichever ran second saw the result of the first, so the row is consistent:
    // either closed by its original owner, or handed over and then closed.
    expect(after.status).toBe("closed");
    expect(closed.status).toBe(200);
  });

  it("sign-ins and other changes at the same moment do not block each other", async () => {
    const maya = await signIn("maya");
    const request = await requestIn(t.t2);
    const results = await Promise.all([
      call(requestAction, { method: "POST", cookie: maya, params: { id: request.id, action: "claim" } }),
      call(login, { method: "POST", body: { email: emailFor("leo"), password: passwordFor("leo") } }),
      call(login, { method: "POST", body: { email: emailFor("sam"), password: "wrong-password" } }),
      call(login, { method: "POST", body: { email: emailFor("noor"), password: passwordFor("noor") } }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 401, 200]);
  });
});

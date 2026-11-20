// The boundaries the brief says must stay intact, tested through the real API routes.

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as clientList, POST as clientStart } from "@/app/api/client/threads/route";
import { GET as clientThread } from "@/app/api/client/threads/[id]/route";
import { POST as clientPost } from "@/app/api/client/threads/[id]/messages/route";
import { GET as staffQueue } from "@/app/api/staff/queue/route";
import { GET as staffThread } from "@/app/api/staff/threads/[id]/route";
import { POST as staffPost } from "@/app/api/staff/threads/[id]/messages/route";
import { POST as staffParticipants } from "@/app/api/staff/threads/[id]/participants/route";
import { POST as messageAction } from "@/app/api/staff/messages/[id]/[action]/route";
import { passwordFor } from "@/db/seed";
import { call, freshMailbox, signIn } from "./helpers";

const SECRET = "INTERNAL-ONLY-7731 do we trust this address change?";
let t: Awaited<ReturnType<typeof freshMailbox>>["threads"];
let maya: string, leo: string, elena: string, oliver: string, noor: string;

beforeAll(async () => {
  ({ threads: t } = await freshMailbox());
  [maya, leo, elena, oliver, noor] = await Promise.all(["maya", "leo", "elena", "oliver", "noor"].map((k) => signIn(k)));
});

describe("internal notes stay internal", () => {
  it("never appear in any client API response, but do appear for staff", async () => {
    for (const threadId of [t.t1, t.t4]) {
      const posted = await call(staffPost, { method: "POST", cookie: maya, params: { id: threadId }, body: { mode: "note", body: SECRET } });
      expect(posted.status).toBe(200);
    }

    const list = await call(clientList, { cookie: elena });
    const own = await call(clientThread, { cookie: elena, params: { id: t.t1 } });
    const joint = await call(clientThread, { cookie: oliver, params: { id: t.t4 } });
    for (const res of [list, own, joint]) {
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("INTERNAL-ONLY-7731");
      expect(res.text).not.toContain("internal_note");
    }

    const staff = await call(staffThread, { cookie: leo, params: { id: t.t1 } });
    expect(staff.text).toContain("INTERNAL-ONLY-7731");
  });

  it("client responses do not include internal request fields", async () => {
    const res = await call(clientThread, { cookie: elena, params: { id: t.t3 } });
    expect(res.text).not.toContain("outcomeNote");
    expect(res.text).not.toContain("ownerId");
    expect(res.text).not.toContain("Imported from the spreadsheet");
  });

  it("a draft reply is invisible to the client until it is sent (T6)", async () => {
    const before = await call(clientThread, { cookie: noor, params: { id: t.t6 } });
    expect(before.text).not.toContain("Wednesday at 2pm");

    const staff = await call(staffThread, { cookie: maya, params: { id: t.t6 } });
    const draft = staff.json.messages.find((m: any) => m.deliveryStatus === "draft");
    expect(draft).toBeTruthy();
    const sent = await call(messageAction, { method: "POST", cookie: maya, params: { id: draft.id, action: "send" } });
    expect(sent.status).toBe(200);

    const after = await call(clientThread, { cookie: noor, params: { id: t.t6 } });
    expect(after.text).toContain("Wednesday at 2pm");
  });
});

describe("clients cannot reach each other's conversations", () => {
  it("Oliver sees the joint thread and none of Elena's own (T4)", async () => {
    const list = await call(clientList, { cookie: oliver });
    expect(list.json.threads.map((x: any) => x.id)).toEqual([t.t4]);
  });

  it("another client's thread is 'not found' for reading and for writing", async () => {
    for (const threadId of [t.t1, t.t3, t.t2]) {
      expect((await call(clientThread, { cookie: oliver, params: { id: threadId } })).status).toBe(404);
      const write = await call(clientPost, { method: "POST", cookie: oliver, params: { id: threadId }, body: { body: "hello" } });
      expect(write.status).toBe(404);
    }
    // Same answer as a thread that does not exist at all, so nothing is revealed.
    expect((await call(clientThread, { cookie: oliver, params: { id: "no-such-thread" } })).status).toBe(404);
  });

  it("Elena sees her own threads and the joint one", async () => {
    const ids = (await call(clientList, { cookie: elena })).json.threads.map((x: any) => x.id);
    expect(ids.sort()).toEqual([t.t1, t.t3, t.t4].sort());
  });

  it("a new conversation is visible only to the client who started it", async () => {
    const started = await call(clientStart, { method: "POST", cookie: noor, body: { subject: "Private", body: "Just for Harbour" } });
    expect(started.status).toBe(200);
    expect((await call(clientThread, { cookie: noor, params: { id: started.json.id } })).status).toBe(200);
    expect((await call(clientThread, { cookie: elena, params: { id: started.json.id } })).status).toBe(404);
  });

  it("access is given only by a recorded staff decision with a reason", async () => {
    const mayaThread = await call(staffThread, { cookie: maya, params: { id: t.t1 } });
    const oliverId = mayaThread.json.clientsWithoutAccess.find((c: any) => c.name === "Oliver").id;

    const noReason = await call(staffParticipants, { method: "POST", cookie: maya, params: { id: t.t1 }, body: { userId: oliverId, reason: " " } });
    expect(noReason.status).toBe(400);
    expect((await call(clientThread, { cookie: oliver, params: { id: t.t1 } })).status).toBe(404);

    const byClient = await call(staffParticipants, { method: "POST", cookie: elena, params: { id: t.t1 }, body: { userId: oliverId, reason: "x" } });
    expect(byClient.status).toBe(403);

    const ok = await call(staffParticipants, { method: "POST", cookie: maya, params: { id: t.t1 }, body: { userId: oliverId, reason: "Elena consented by phone" } });
    expect(ok.status).toBe(200);
    expect((await call(clientThread, { cookie: oliver, params: { id: t.t1 } })).status).toBe(200);
  });
});

describe("authentication and authorisation", () => {
  it("no session: 401 on staff and client routes", async () => {
    expect((await call(staffQueue)).status).toBe(401);
    expect((await call(clientList)).status).toBe(401);
    expect((await call(staffThread, { params: { id: t.t1 } })).status).toBe(401);
    expect((await call(clientList, { cookie: "harbour_session=made-up" })).status).toBe(401);
  });

  it("wrong role: 403", async () => {
    expect((await call(staffQueue, { cookie: elena })).status).toBe(403);
    expect((await call(staffThread, { cookie: elena, params: { id: t.t1 } })).status).toBe(403);
    expect((await call(clientList, { cookie: maya })).status).toBe(403);
  });

  it("login gives the same error for a wrong password and an unknown email", async () => {
    const wrong = await call(login, { method: "POST", body: { email: "sam@client.example", password: "nope" } });
    const unknown = await call(login, { method: "POST", body: { email: "nobody@client.example", password: "nope" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.error).toBe(unknown.json.error);
  });

  it("repeated failed logins lock the account for a while", async () => {
    for (let i = 0; i < 5; i++) {
      await call(login, { method: "POST", body: { email: "ben@harbour.example", password: "wrong" } });
    }
    // Even the right password is refused while the account is locked.
    const locked = await call(login, { method: "POST", body: { email: "ben@harbour.example", password: passwordFor("ben") } });
    expect(locked.status).toBe(401);
    expect(locked.headers.get("set-cookie")).toBeNull();
  });

  it("a locked account answers exactly like an unknown email, so the lock does not reveal who has an account", async () => {
    for (let i = 0; i < 5; i++) {
      await call(login, { method: "POST", body: { email: "aisha@harbour.example", password: "wrong" } });
      await call(login, { method: "POST", body: { email: "nobody@harbour.example", password: "wrong" } });
    }
    const locked = await call(login, { method: "POST", body: { email: "aisha@harbour.example", password: "wrong" } });
    const unknown = await call(login, { method: "POST", body: { email: "nobody@harbour.example", password: "wrong" } });
    expect(locked.status).toBe(unknown.status);
    expect(locked.text).toBe(unknown.text);
  });

  it("each account has its own password: one person's password does not open another's account", async () => {
    const res = await call(login, { method: "POST", body: { email: "grace@harbour.example", password: passwordFor("maya") } });
    expect(res.status).toBe(401);
  });

  it("the session cookie is httpOnly and SameSite", async () => {
    const res = await call(login, { method: "POST", body: { email: "sam@client.example", password: passwordFor("sam") } });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("a request from another website is refused", async () => {
    const res = await call(clientPost, {
      method: "POST",
      cookie: elena,
      params: { id: t.t1 },
      body: { body: "forged" },
      origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
  });

  it("a request with a nonsense origin is refused cleanly, not answered with a server error", async () => {
    // Sandboxed pages send the literal word "null" as their origin.
    const res = await call(clientPost, { method: "POST", cookie: elena, params: { id: t.t1 }, body: { body: "forged" }, origin: "null" });
    expect(res.status).toBe(403);
  });

  it("logging out ends the session", async () => {
    const cookie = await signIn("grace");
    expect((await call(staffQueue, { cookie })).status).toBe(200);
    await call(logout, { method: "POST", cookie });
    expect((await call(staffQueue, { cookie })).status).toBe(401);
  });

  it("an expired session is rejected", async () => {
    const cookie = await signIn("daniel");
    await db.update(sessions).set({ expiresAt: Date.now() - 1000 }).where(eq(sessions.userId, (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, "daniel@harbour.example") }))!.id));
    expect((await call(staffQueue, { cookie })).status).toBe(401);
  });
});

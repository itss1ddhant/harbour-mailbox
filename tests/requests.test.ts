// The request rules: ownership, waiting on the client, outcomes, and new work on old threads.

import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { client, db } from "@/db/client";
import { requestEvents, requests } from "@/db/schema";
import { postClientMessage, postInternalNote, postStaffReply, markAnswered } from "@/server/messages";
import { claim, close, createRequest, handOver, reopen } from "@/server/requests";
import { getQueue } from "@/server/staff-view";
import { freshMailbox } from "./helpers";

let id: Record<string, string>;
let t: Awaited<ReturnType<typeof freshMailbox>>["threads"];
const who = (key: string) => ({ id: id[key], name: key[0].toUpperCase() + key.slice(1) });
const requestsIn = (threadId: string) => db.select().from(requests).where(eq(requests.threadId, threadId));
const openIn = async (threadId: string) => (await requestsIn(threadId)).filter((r) => r.status !== "closed");

beforeEach(async () => {
  ({ id, threads: t } = await freshMailbox());
});

describe("the Monday mailbox", () => {
  it("T2: unowned work with a deadline is first in the queue", async () => {
    const queue = await getQueue(who("maya"), "mine");
    expect(queue.unowned[0].threadId).toBe(t.t2);
    expect(queue.unowned[0].dueAt).toBeGreaterThan(Date.now());
    expect(queue.unowned[0].nextStep).toContain("Nobody owns this");
  });

  it("T3: answered but still owed a form is waiting on the client, not complete", async () => {
    const queue = await getQueue(who("maya"), "mine");
    const row = queue.waiting.find((r) => r.threadId === t.t3)!;
    expect(row.nextStep).toContain("signed form");
    expect(queue.recentlyClosed.some((r) => r.threadId === t.t3)).toBe(false);
  });

  it("T5: a new question on a completed thread becomes new unowned work", async () => {
    const all = await requestsIn(t.t5);
    expect(all).toHaveLength(2);
    const fresh = all.find((r) => r.status !== "closed")!;
    expect(fresh.status).toBe("needs_triage");
    expect(fresh.ownerId).toBeNull();
    expect(fresh.title).toContain("I've moved");

    const queue = await getQueue(who("maya"), "mine");
    expect(queue.unowned.find((r) => r.threadId === t.t5)!.previouslyHandledBy).toBe("Leo");
  });

  it("T6: an unsent draft keeps the request with its owner, flagged", async () => {
    const queue = await getQueue(who("maya"), "mine");
    expect(queue.needsAction.find((r) => r.threadId === t.t6)!.reason).toBe("Reply not sent");
  });

  it("T1: a thank-you can be closed as 'no action needed'", async () => {
    const [request] = await openIn(t.t1);
    await close(request.id, who("maya"), "no_action_needed", "");
    const [after] = await requestsIn(t.t1);
    expect(after.status).toBe("closed");
    expect(after.outcome).toBe("no_action_needed");
  });
});

describe("client messages", () => {
  it("a message on a thread with nothing open creates a request to triage", async () => {
    const [request] = await openIn(t.t1);
    await close(request.id, who("maya"), "resolved", "");
    await postClientMessage(t.t1, who("elena"), "One more thing: can you change my address?");
    const open = await openIn(t.t1);
    expect(open).toHaveLength(1);
    expect(open[0].status).toBe("needs_triage");
    expect(open[0].ownerId).toBeNull();
  });

  it("a message while work is open does not create a duplicate request", async () => {
    await postClientMessage(t.t1, who("elena"), "Actually, one question.");
    expect(await openIn(t.t1)).toHaveLength(1);
  });

  it("a reply that still needs something from the client keeps the request open", async () => {
    const [request] = await openIn(t.t6);
    await postStaffReply(t.t6, who("maya"), { body: "Wednesday works. Please confirm a time.", requestId: request.id, waitingFor: "preferred time" });
    let [after] = await openIn(t.t6);
    expect(after.status).toBe("waiting_on_client");
    expect(after.waitingFor).toBe("preferred time");

    await postClientMessage(t.t6, who("noor"), "2pm please.");
    [after] = await openIn(t.t6);
    expect(after.status).toBe("open");
    expect(after.ownerId).toBe(id.maya); // same owner
    expect(after.clientReplied).toBe(true);
  });
});

describe("one accountable owner", () => {
  it("only one person can claim a request", async () => {
    const [request] = await openIn(t.t2);
    await claim(request.id, who("maya"));
    await expect(claim(request.id, who("leo"))).rejects.toMatchObject({ status: 409 });
    const [after] = await openIn(t.t2);
    expect(after.ownerId).toBe(id.maya);
    expect(after.status).toBe("open");
    const events = await db.select().from(requestEvents).where(and(eq(requestEvents.requestId, request.id), eq(requestEvents.type, "claimed")));
    expect(events).toHaveLength(1);
  });

  it("a handover needs a note and is recorded", async () => {
    const [request] = await openIn(t.t6);
    await expect(handOver(request.id, who("maya"), id.leo, "")).rejects.toMatchObject({ status: 400 });
    await handOver(request.id, who("maya"), id.leo, "Leo knows Noor's diary");
    const [after] = await openIn(t.t6);
    expect(after.ownerId).toBe(id.leo);
    const events = await db.select().from(requestEvents).where(eq(requestEvents.requestId, request.id));
    expect(events.some((e) => e.detail.includes("Leo knows Noor's diary"))).toBe(true);
  });

  it("work cannot be handed to a client", async () => {
    const [request] = await openIn(t.t6);
    await expect(handOver(request.id, who("maya"), id.elena, "oops")).rejects.toMatchObject({ status: 400 });
  });

  it("two teams can each own a separate request on one thread", async () => {
    await createRequest(t.t2, who("priya"), { title: "Book the meeting room", ownerId: id.ben });
    const [first] = (await openIn(t.t2)).filter((r) => r.title.startsWith("Confirm"));
    await claim(first.id, who("leo"));
    const owners = (await openIn(t.t2)).map((r) => r.ownerId).sort();
    expect(owners).toEqual([id.ben, id.leo].sort());
  });
});

describe("outcomes", () => {
  it("a request cannot close without an outcome", async () => {
    const [request] = await openIn(t.t1);
    await expect(close(request.id, who("maya"), "", "")).rejects.toMatchObject({ status: 400 });
    await expect(close(request.id, who("maya"), "done", "")).rejects.toMatchObject({ status: 400 });
    expect((await openIn(t.t1))[0].status).toBe("open");
  });

  it("declining needs a reason", async () => {
    const [request] = await openIn(t.t1);
    await expect(close(request.id, who("maya"), "declined", "  ")).rejects.toMatchObject({ status: 400 });
  });

  it("T4: an access request cannot close without a recorded decision", async () => {
    const [request] = await openIn(t.t4);
    await expect(close(request.id, who("leo"), "resolved", "")).rejects.toMatchObject({ status: 400 });
    await close(request.id, who("leo"), "declined", "No consent from Elena on record. Asked Oliver to have Elena contact us.");
    const [after] = await requestsIn(t.t4);
    expect(after.outcome).toBe("declined");
    expect(after.outcomeNote).toContain("No consent");
  });

  it("closing unowned work makes the closer accountable; reopening is recorded", async () => {
    const [request] = await openIn(t.t5);
    await close(request.id, who("grace"), "resolved", "Sent the change of address form");
    let after = (await requestsIn(t.t5)).find((r) => r.id === request.id)!;
    expect(after.ownerId).toBe(id.grace);
    await reopen(request.id, who("grace"));
    after = (await requestsIn(t.t5)).find((r) => r.id === request.id)!;
    expect(after.status).toBe("open");
    expect(after.outcome).toBeNull();
  });
});

describe("questions for a colleague", () => {
  it("a note addressed to Leo appears in Leo's queue until he marks it answered", async () => {
    const noteId = await postInternalNote(t.t5, who("maya"), { body: "Leo, is the old address still on file?", addressedTo: id.leo });
    expect((await getQueue(who("leo"), "mine")).questions.map((q) => q.id)).toContain(noteId);
    expect((await getQueue(who("maya"), "mine")).questions).toHaveLength(0);
    await expect(markAnswered(noteId, who("maya"))).rejects.toMatchObject({ status: 403 });
    await markAnswered(noteId, who("leo"));
    expect((await getQueue(who("leo"), "mine")).questions).toHaveLength(0);
  });

  it("a note cannot be addressed to a client", async () => {
    await expect(postInternalNote(t.t5, who("maya"), { body: "hi", addressedTo: id.sam })).rejects.toMatchObject({ status: 400 });
  });
});

describe("state survives a restart", () => {
  it("data is on disk: a brand new connection to the same file sees it", async () => {
    const [request] = await openIn(t.t2);
    await claim(request.id, who("maya"));
    await postInternalNote(t.t2, who("maya"), { body: "Checked the file: payslip for March is missing." });

    const second = createClient({ url: process.env.DATABASE_URL! });
    const owner = await second.execute({ sql: "select owner_id from requests where id = ?", args: [request.id] });
    const note = await second.execute("select count(*) as n from messages where body like '%payslip for March%'");
    second.close();
    expect(owner.rows[0].owner_id).toBe(id.maya);
    expect(Number(note.rows[0].n)).toBe(1);
    expect(client.closed).toBe(false);
  });
});

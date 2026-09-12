import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { GATHER_WAIT_MS, largestExactBracket } from "./matchmaking.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.*s");

async function enqueuePlayers(
  t: ReturnType<typeof convexTest>,
  count: number,
  start = 0,
) {
  for (let i = 0; i < count; i++) {
    const n = start + i;
    await t.mutation(api.queue.enqueue, {
      sessionId: `sess-${n}`,
      name: `P${n}`,
      emoji: "🦊",
    });
  }
}

async function royals(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ctx.db.query("royals").collect());
}

async function queueSessions(t: ReturnType<typeof convexTest>) {
  const rows = await t.run(async (ctx) => ctx.db.query("queue").collect());
  return rows.map((row) => row.sessionId).sort();
}

describe("largestExactBracket", () => {
  test("never returns odd or 2", () => {
    expect(largestExactBracket(0)).toBeNull();
    expect(largestExactBracket(1)).toBeNull();
    expect(largestExactBracket(2)).toBeNull();
    expect(largestExactBracket(3)).toBeNull();
    expect(largestExactBracket(4)).toBe(4);
    expect(largestExactBracket(5)).toBe(4);
    expect(largestExactBracket(7)).toBe(4);
    expect(largestExactBracket(8)).toBe(8);
    expect(largestExactBracket(15)).toBe(8);
    expect(largestExactBracket(16)).toBe(16);
    expect(largestExactBracket(17)).toBe(16);
  });
});

describe("matchmaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("1–3 queued never start a royal", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 3);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await royals(t)).toHaveLength(0);
    expect(await queueSessions(t)).toHaveLength(3);
  });

  test("4 queued starts after the 20s gather wait", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 4);
    expect(await royals(t)).toHaveLength(0);

    vi.advanceTimersByTime(GATHER_WAIT_MS - 1);
    await t.finishInProgressScheduledFunctions();
    expect(await royals(t)).toHaveLength(0);

    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();

    const started = await royals(t);
    expect(started).toHaveLength(1);
    expect(started[0]!.size).toBe(4);
    expect(started[0]!.status).toBe("playing");
    expect(await queueSessions(t)).toHaveLength(0);

    const matches = await t.run(async (ctx) =>
      ctx.db
        .query("matches")
        .withIndex("by_royal", (q) => q.eq("royalId", started[0]!._id))
        .collect(),
    );
    expect(matches).toHaveLength(2);
    const bySlot = [...matches].sort((a, b) => a.slot - b.slot);
    expect(bySlot[0]).toMatchObject({
      playerA: "sess-0",
      playerB: "sess-1",
      roundSize: 4,
      phase: "picking",
      roundIndex: 1,
      slot: 0,
    });
    expect(bySlot[1]).toMatchObject({
      playerA: "sess-2",
      playerB: "sess-3",
      slot: 1,
    });

    const status = await t.query(api.queue.myStatus, { sessionId: "sess-0" });
    expect(status.kind).toBe("inRoyal");
    if (status.kind !== "inRoyal") throw new Error("expected inRoyal");
    expect(status.royalId).toBe(started[0]!._id);
    expect(status.matchId).toBe(bySlot[0]!._id);

    const seats = await t.run(async (ctx) =>
      ctx.db
        .query("royalPlayers")
        .withIndex("by_royal", (q) => q.eq("royalId", started[0]!._id))
        .collect(),
    );
    expect(seats).toHaveLength(4);
    expect(seats.every((s) => s.status === "alive")).toBe(true);
  });

  test("8 queued replaces the 4-wait and starts after a second 20s", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 4);
    vi.advanceTimersByTime(10_000);
    await t.finishInProgressScheduledFunctions();
    await enqueuePlayers(t, 4, 4);

    vi.advanceTimersByTime(10_000);
    await t.finishInProgressScheduledFunctions();
    expect(await royals(t)).toHaveLength(0);

    vi.advanceTimersByTime(10_000);
    await t.finishInProgressScheduledFunctions();

    const started = await royals(t);
    expect(started).toHaveLength(1);
    expect(started[0]!.size).toBe(8);
    const matches = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(matches).toHaveLength(4);
    expect(await queueSessions(t)).toHaveLength(0);
  });

  test("16 queued starts immediately and leaves nobody waiting", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 16);
    const started = await royals(t);
    expect(started).toHaveLength(1);
    expect(started[0]!.size).toBe(16);
    const matches = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(matches).toHaveLength(8);
    expect(await queueSessions(t)).toHaveLength(0);
  });

  test("17+ pops 16 FIFO and the last session stays queued", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 17);
    const started = await royals(t);
    expect(started).toHaveLength(1);
    expect(started[0]!.size).toBe(16);
    expect(await queueSessions(t)).toEqual(["sess-16"]);

    const leftover = await t.query(api.queue.myStatus, {
      sessionId: "sess-16",
    });
    expect(leftover.kind).toBe("queued");

    const inRoyal = await t.query(api.queue.myStatus, { sessionId: "sess-0" });
    expect(inRoyal.kind).toBe("inRoyal");
  });

  test("5–7 after the 4-wait start a 4, not an 8", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 7);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const started = await royals(t);
    expect(started).toHaveLength(1);
    expect(started[0]!.size).toBe(4);
    expect(await queueSessions(t)).toEqual(["sess-4", "sess-5", "sess-6"]);
  });

  test("a late enqueue never joins a royal that is already playing", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 4);
    await t.mutation(internal.matchmaking.tryStart, { generation: 1 });
    const started = await royals(t);
    expect(started).toHaveLength(1);
    expect(started[0]!.size).toBe(4);

    await t.mutation(api.queue.enqueue, {
      sessionId: "sess-late",
      name: "Late",
      emoji: "🐙",
    });
    const seats = await t.run(async (ctx) =>
      ctx.db
        .query("royalPlayers")
        .withIndex("by_royal", (q) => q.eq("royalId", started[0]!._id))
        .collect(),
    );
    expect(seats).toHaveLength(4);
    expect(seats.map((s) => s.sessionId)).not.toContain("sess-late");
    expect(await queueSessions(t)).toEqual(["sess-late"]);
  });

  test("stale 4-wait is a no-op after generation advances to 8", async () => {
    const t = convexTest(schema, modules);
    await enqueuePlayers(t, 4);
    await enqueuePlayers(t, 4, 4);
    await t.mutation(internal.matchmaking.tryStart, { generation: 1 });
    expect(await royals(t)).toHaveLength(0);
    expect(await queueSessions(t)).toHaveLength(8);
  });
});

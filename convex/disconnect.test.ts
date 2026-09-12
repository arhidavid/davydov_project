import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import {
  PRESENCE_STALE_MS,
  RECONNECT_GRACE_MS,
  forfeitEntropy,
  forfeitWinner,
} from "./disconnect.js";
import { chooseRandomWinner } from "./rpsLogic.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.*s");

const ada = { sessionId: "sess-ada", name: "Ada", emoji: "🦊" };
const grace = { sessionId: "sess-grace", name: "Grace", emoji: "🐙" };

describe("forfeitWinner", () => {
  test("one leaver advances the opponent", () => {
    expect(
      forfeitWinner({
        playerA: "a",
        playerB: "b",
        bothGone: false,
        leaverSessionId: "a",
        entropy: "x",
      }),
    ).toBe("b");
  });

  test("both gone uses entropy", () => {
    const entropy = "forfeit-seed";
    expect(
      forfeitWinner({
        playerA: "a",
        playerB: "b",
        bothGone: true,
        leaverSessionId: "a",
        entropy,
      }),
    ).toBe(chooseRandomWinner("a", "b", entropy));
  });
});

async function seedFinal(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const royalId = await ctx.db.insert("royals", {
      size: 4,
      status: "playing",
      startedAt: 1,
    });
    await ctx.db.insert("royalPlayers", {
      royalId,
      sessionId: ada.sessionId,
      name: ada.name,
      emoji: ada.emoji,
      status: "alive",
      lastSeen: 1,
    });
    await ctx.db.insert("royalPlayers", {
      royalId,
      sessionId: grace.sessionId,
      name: grace.name,
      emoji: grace.emoji,
      status: "alive",
      lastSeen: 1,
    });
    const matchId = await ctx.db.insert("matches", {
      royalId,
      roundSize: 2,
      slot: 0,
      playerA: ada.sessionId,
      playerB: grace.sessionId,
      scoreA: 0,
      scoreB: 0,
      phase: "picking",
      roundIndex: 1,
      drawStreak: 0,
      pickDeadline: 0,
    });
    return { royalId, matchId };
  });
}

describe("disconnect / reconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("searching disconnect cancels the queue row", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.queue.enqueue, ada);
    await t.mutation(api.queue.heartbeat, { sessionId: ada.sessionId });

    vi.advanceTimersByTime(PRESENCE_STALE_MS - 1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.queue.myStatus, { sessionId: ada.sessionId })).toMatchObject({
      kind: "queued",
    });

    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.queue.myStatus, { sessionId: ada.sessionId })).toEqual({
      kind: "idle",
    });
    const rows = await t.run(async (ctx) => ctx.db.query("queue").collect());
    expect(rows).toHaveLength(0);
  });

  test("heartbeat in a royal refreshes lastSeen and is ok", async () => {
    const t = convexTest(schema, modules);
    const { royalId } = await seedFinal(t);
    const beat = await t.mutation(api.queue.heartbeat, {
      sessionId: ada.sessionId,
    });
    expect(beat).toEqual({ ok: true });
    const seats = await t.run(async (ctx) =>
      ctx.db
        .query("royalPlayers")
        .withIndex("by_royal", (q) => q.eq("royalId", royalId))
        .collect(),
    );
    const adaSeat = seats.find((s) => s.sessionId === ada.sessionId)!;
    expect(adaSeat.lastSeen).toBeGreaterThan(1);
  });

  test("one leaver loses after 20s grace; opponent advances", async () => {
    const t = convexTest(schema, modules);
    const { matchId, royalId } = await seedFinal(t);
    await t.mutation(api.queue.heartbeat, { sessionId: ada.sessionId });
    await t.mutation(api.queue.heartbeat, { sessionId: grace.sessionId });

    const adaSeat = await t.run(async (ctx) => {
      const seats = await ctx.db
        .query("royalPlayers")
        .withIndex("by_session", (q) => q.eq("sessionId", ada.sessionId))
        .collect();
      return seats[0]!;
    });
    await t.mutation(internal.disconnect.watchPresence, {
      sessionId: ada.sessionId,
      seenAt: adaSeat.lastSeen,
    });

    const inGrace = await t.run(async (ctx) => ctx.db.get(adaSeat._id));
    expect((inGrace!.disconnectGraceEndsAt ?? 0) > 0).toBe(true);

    await t.mutation(internal.matches.closeRound, {
      matchId,
      roundIndex: 1,
    });
    const paused = await t.query(api.matches.view, {
      matchId,
      sessionId: grace.sessionId,
    });
    expect(paused!.phase).toBe("picking");
    expect(paused!.opponentReconnecting).toBe(true);

    await t.mutation(internal.disconnect.resolveForfeit, {
      sessionId: ada.sessionId,
      royalId,
    });

    expect(await t.query(api.queue.myStatus, { sessionId: ada.sessionId })).toEqual({
      kind: "lost",
      royalId,
    });
    expect(await t.query(api.queue.myStatus, { sessionId: grace.sessionId })).toEqual({
      kind: "winner",
      royalId,
    });
    const match = await t.run(async (ctx) => ctx.db.get(matchId));
    expect(match!.phase).toBe("done");
    expect(match!.winnerSessionId).toBe(grace.sessionId);
  });

  test("scheduled grace end forfeits without a client clock", async () => {
    const t = convexTest(schema, modules);
    const { royalId } = await seedFinal(t);
    await t.mutation(api.queue.heartbeat, { sessionId: ada.sessionId });
    const adaSeat = await t.run(async (ctx) => {
      const seats = await ctx.db
        .query("royalPlayers")
        .withIndex("by_session", (q) => q.eq("sessionId", ada.sessionId))
        .collect();
      return seats[0]!;
    });
    await t.mutation(internal.disconnect.watchPresence, {
      sessionId: ada.sessionId,
      seenAt: adaSeat.lastSeen,
    });

    vi.advanceTimersByTime(RECONNECT_GRACE_MS);
    await t.finishInProgressScheduledFunctions();

    expect(await t.query(api.queue.myStatus, { sessionId: ada.sessionId })).toEqual({
      kind: "lost",
      royalId,
    });
    expect(await t.query(api.queue.myStatus, { sessionId: grace.sessionId })).toEqual({
      kind: "winner",
      royalId,
    });
  });

  test("reconnect within 20s continues the match", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedFinal(t);
    await t.mutation(api.queue.heartbeat, { sessionId: ada.sessionId });
    const adaSeat = await t.run(async (ctx) => {
      const seats = await ctx.db
        .query("royalPlayers")
        .withIndex("by_session", (q) => q.eq("sessionId", ada.sessionId))
        .collect();
      return seats[0]!;
    });
    await t.mutation(internal.disconnect.watchPresence, {
      sessionId: ada.sessionId,
      seenAt: adaSeat.lastSeen,
    });

    vi.advanceTimersByTime(RECONNECT_GRACE_MS - 1);
    await t.finishInProgressScheduledFunctions();

    await t.mutation(api.queue.heartbeat, { sessionId: ada.sessionId });
    const after = await t.run(async (ctx) => ctx.db.get(adaSeat._id));
    expect(after!.disconnectGraceEndsAt ?? 0).toBe(0);

    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();

    const status = await t.query(api.queue.myStatus, { sessionId: ada.sessionId });
    expect(status.kind).toBe("inRoyal");
    const match = await t.run(async (ctx) => ctx.db.get(matchId));
    expect(match!.phase).toBe("picking");
    expect(match!.winnerSessionId).toBeUndefined();
  });

  test("both gone at grace end picks a random match winner", async () => {
    const t = convexTest(schema, modules);
    const { matchId, royalId } = await seedFinal(t);
    await t.mutation(api.queue.heartbeat, { sessionId: ada.sessionId });
    await t.mutation(api.queue.heartbeat, { sessionId: grace.sessionId });

    const seats = await t.run(async (ctx) =>
      ctx.db
        .query("royalPlayers")
        .withIndex("by_royal", (q) => q.eq("royalId", royalId))
        .collect(),
    );
    for (const seat of seats) {
      await t.mutation(internal.disconnect.watchPresence, {
        sessionId: seat.sessionId,
        seenAt: seat.lastSeen,
      });
    }

    await t.mutation(internal.disconnect.resolveForfeit, {
      sessionId: ada.sessionId,
      royalId,
    });

    const expected = chooseRandomWinner(
      ada.sessionId,
      grace.sessionId,
      forfeitEntropy(matchId, ada.sessionId, grace.sessionId),
    );
    const match = await t.run(async (ctx) => ctx.db.get(matchId));
    expect(match!.phase).toBe("done");
    expect(match!.winnerSessionId).toBe(expected);

    const loser = expected === ada.sessionId ? grace.sessionId : ada.sessionId;
    expect(await t.query(api.queue.myStatus, { sessionId: loser })).toEqual({
      kind: "lost",
      royalId,
    });
    expect(await t.query(api.queue.myStatus, { sessionId: expected })).toEqual({
      kind: "winner",
      royalId,
    });
  });
});

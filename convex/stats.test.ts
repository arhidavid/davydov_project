import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { emptyLiveStats, mostPopularGesture } from "./stats.js";

const modules = import.meta.glob("./**/*.*s");

describe("mostPopularGesture", () => {
  test("returns null when nobody has thrown", () => {
    expect(mostPopularGesture({ rock: 0, paper: 0, scissors: 0 })).toEqual({
      gesture: null,
      tied: false,
    });
  });

  test("picks the max and flags a tie", () => {
    expect(mostPopularGesture({ rock: 3, paper: 1, scissors: 1 })).toEqual({
      gesture: "rock",
      tied: false,
    });
    expect(mostPopularGesture({ rock: 2, paper: 2, scissors: 1 })).toEqual({
      gesture: "rock",
      tied: true,
    });
  });
});

describe("stats.live", () => {
  test("empty deployment is all zeros", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.stats.live, {})).resolves.toEqual(emptyLiveStats());
  });

  test("counts queued humans as real players", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.queue.enqueue, {
      sessionId: "a",
      name: "Ada",
      emoji: "🦊",
    });
    await t.mutation(api.queue.enqueue, {
      sessionId: "b",
      name: "Bo",
      emoji: "🐙",
    });
    const stats = await t.query(api.stats.live, {});
    expect(stats.queuedCount).toBe(2);
    expect(stats.realPlayerCount).toBe(2);
    expect(stats.queuedPreview).toEqual([
      { name: "Ada", emoji: "🦊" },
      { name: "Bo", emoji: "🐙" },
    ]);
    expect(stats.oldestQueuedAt).toEqual(expect.any(Number));
  });

  test("ignores secret throws while a match is still picking", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const royalId = await ctx.db.insert("royals", {
        size: 4,
        status: "playing",
        startedAt: 1,
      });
      const matchId = await ctx.db.insert("matches", {
        royalId,
        roundSize: 2,
        slot: 0,
        playerA: "p1",
        playerB: "p2",
        scoreA: 0,
        scoreB: 0,
        phase: "picking",
        roundIndex: 1,
        drawStreak: 0,
        pickDeadline: 9,
      });
      await ctx.db.insert("throws", {
        matchId,
        roundIndex: 1,
        sessionId: "p1",
        gesture: "scissors",
      });
    });
    const stats = await t.query(api.stats.live, {});
    expect(stats.throwCount).toBe(0);
    expect(stats.mostPopularGesture).toBeNull();
    expect(stats.pickingMatchCount).toBe(1);
    expect(stats.runningMatchCount).toBe(1);
  });

  test("counts royals, matches, and popular revealed gestures", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.queue.enqueue, {
      sessionId: "queued-only",
      name: "Waiter",
      emoji: "⏳",
    });

    await t.run(async (ctx) => {
      const royalId = await ctx.db.insert("royals", {
        size: 4,
        status: "playing",
        startedAt: 1,
      });
      await ctx.db.insert("royals", {
        size: 8,
        status: "complete",
        startedAt: 1,
        championSessionId: "champ",
      });
      for (const [sessionId, name, status] of [
        ["p1", "One", "alive"],
        ["p2", "Two", "alive"],
        ["p3", "Three", "eliminated"],
        ["p4", "Four", "eliminated"],
      ] as const) {
        await ctx.db.insert("royalPlayers", {
          royalId,
          sessionId,
          name,
          emoji: "🎯",
          status,
          lastSeen: 1,
        });
      }
      const liveMatchId = await ctx.db.insert("matches", {
        royalId,
        roundSize: 2,
        slot: 0,
        playerA: "p1",
        playerB: "p2",
        scoreA: 1,
        scoreB: 0,
        phase: "revealed",
        roundIndex: 2,
        drawStreak: 0,
        pickDeadline: 9,
      });
      await ctx.db.insert("matches", {
        royalId,
        roundSize: 4,
        slot: 0,
        playerA: "p3",
        playerB: "p4",
        scoreA: 2,
        scoreB: 1,
        phase: "done",
        roundIndex: 3,
        drawStreak: 0,
        winnerSessionId: "p3",
        pickDeadline: 8,
      });
      await ctx.db.insert("throws", {
        matchId: liveMatchId,
        roundIndex: 1,
        sessionId: "p1",
        gesture: "paper",
      });
      await ctx.db.insert("throws", {
        matchId: liveMatchId,
        roundIndex: 1,
        sessionId: "p2",
        gesture: "paper",
      });
      await ctx.db.insert("throws", {
        matchId: liveMatchId,
        roundIndex: 2,
        sessionId: "p1",
        gesture: "rock",
      });
    });

    const stats = await t.query(api.stats.live, {});
    expect(stats.queuedCount).toBe(1);
    expect(stats.realPlayerCount).toBe(5);
    expect(stats.inRoyalCount).toBe(4);
    expect(stats.aliveCount).toBe(2);
    expect(stats.runningRoyalCount).toBe(1);
    expect(stats.completedRoyalCount).toBe(1);
    expect(stats.runningMatchCount).toBe(1);
    expect(stats.pickingMatchCount).toBe(0);
    expect(stats.finishedMatchCount).toBe(1);
    expect(stats.throwCount).toBe(3);
    expect(stats.gestureCounts).toEqual({ rock: 1, paper: 2, scissors: 0 });
    expect(stats.mostPopularGesture).toBe("paper");
    expect(stats.popularGestureTied).toBe(false);
    expect(stats.playingRoyalSizes).toEqual([4]);
  });
});

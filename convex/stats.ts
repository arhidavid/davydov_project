import { v } from "convex/values";
import { query } from "./_generated/server";

const GESTURES = ["rock", "paper", "scissors"] as const;
export type Gesture = (typeof GESTURES)[number];

const queuedPreview = v.object({
  name: v.string(),
  emoji: v.string(),
});

const liveStats = v.object({
  realPlayerCount: v.number(),
  queuedCount: v.number(),
  inRoyalCount: v.number(),
  aliveCount: v.number(),
  runningRoyalCount: v.number(),
  completedRoyalCount: v.number(),
  runningMatchCount: v.number(),
  pickingMatchCount: v.number(),
  finishedMatchCount: v.number(),
  throwCount: v.number(),
  mostPopularGesture: v.union(
    v.literal("rock"),
    v.literal("paper"),
    v.literal("scissors"),
    v.null(),
  ),
  popularGestureTied: v.boolean(),
  gestureCounts: v.object({
    rock: v.number(),
    paper: v.number(),
    scissors: v.number(),
  }),
  playingRoyalSizes: v.array(
    v.union(v.literal(4), v.literal(8), v.literal(16)),
  ),
  queuedPreview: v.array(queuedPreview),
  oldestQueuedAt: v.union(v.number(), v.null()),
});

export type LiveStats = {
  realPlayerCount: number;
  queuedCount: number;
  inRoyalCount: number;
  aliveCount: number;
  runningRoyalCount: number;
  completedRoyalCount: number;
  runningMatchCount: number;
  pickingMatchCount: number;
  finishedMatchCount: number;
  throwCount: number;
  mostPopularGesture: Gesture | null;
  popularGestureTied: boolean;
  gestureCounts: { rock: number; paper: number; scissors: number };
  playingRoyalSizes: Array<4 | 8 | 16>;
  queuedPreview: Array<{ name: string; emoji: string }>;
  oldestQueuedAt: number | null;
};

export function mostPopularGesture(
  counts: LiveStats["gestureCounts"],
): { gesture: Gesture | null; tied: boolean } {
  const ranked = GESTURES.map((gesture) => ({
    gesture,
    count: counts[gesture],
  }));
  const max = Math.max(0, ...ranked.map((row) => row.count));
  if (max === 0) {
    return { gesture: null, tied: false };
  }
  const winners = ranked.filter((row) => row.count === max);
  return {
    gesture: winners[0]!.gesture,
    tied: winners.length > 1,
  };
}

export function emptyLiveStats(): LiveStats {
  return {
    realPlayerCount: 0,
    queuedCount: 0,
    inRoyalCount: 0,
    aliveCount: 0,
    runningRoyalCount: 0,
    completedRoyalCount: 0,
    runningMatchCount: 0,
    pickingMatchCount: 0,
    finishedMatchCount: 0,
    throwCount: 0,
    mostPopularGesture: null,
    popularGestureTied: false,
    gestureCounts: { rock: 0, paper: 0, scissors: 0 },
    playingRoyalSizes: [],
    queuedPreview: [],
    oldestQueuedAt: null,
  };
}

/**
 * Public aggregate for the projector dashboard. Counts only — no sessionIds
 * and no in-progress throws (those stay secret until the round leaves picking).
 */
export const live = query({
  args: {},
  returns: liveStats,
  handler: async (ctx): Promise<LiveStats> => {
    const queued = await ctx.db.query("queue").withIndex("by_joinedAt").take(256);
    const royals = await ctx.db.query("royals").take(128);
    const royalPlayers = await ctx.db.query("royalPlayers").take(512);
    const matches = await ctx.db.query("matches").take(512);
    const throws = await ctx.db.query("throws").take(2048);

    const sessions = new Set<string>();
    for (const row of queued) {
      sessions.add(row.sessionId);
    }
    for (const row of royalPlayers) {
      sessions.add(row.sessionId);
    }

    const playingRoyalIds = new Set(
      royals.filter((royal) => royal.status === "playing").map((royal) => royal._id),
    );
    const inRoyal = new Set<string>();
    let aliveCount = 0;
    for (const row of royalPlayers) {
      if (!playingRoyalIds.has(row.royalId)) {
        continue;
      }
      inRoyal.add(row.sessionId);
      if (row.status === "alive" || row.status === "champion") {
        aliveCount += 1;
      }
    }

    const revealedMatchIds = new Set(
      matches.filter((match) => match.phase !== "picking").map((match) => match._id),
    );
    const gestureCounts = { rock: 0, paper: 0, scissors: 0 };
    let throwCount = 0;
    for (const row of throws) {
      if (!revealedMatchIds.has(row.matchId)) {
        continue;
      }
      throwCount += 1;
      gestureCounts[row.gesture] += 1;
    }
    const popular = mostPopularGesture(gestureCounts);

    return {
      realPlayerCount: sessions.size,
      queuedCount: queued.length,
      inRoyalCount: inRoyal.size,
      aliveCount,
      runningRoyalCount: playingRoyalIds.size,
      completedRoyalCount: royals.filter((royal) => royal.status === "complete")
        .length,
      runningMatchCount: matches.filter((match) => match.phase !== "done").length,
      pickingMatchCount: matches.filter((match) => match.phase === "picking")
        .length,
      finishedMatchCount: matches.filter((match) => match.phase === "done").length,
      throwCount,
      mostPopularGesture: popular.gesture,
      popularGestureTied: popular.tied,
      gestureCounts,
      playingRoyalSizes: royals
        .filter((royal) => royal.status === "playing")
        .map((royal) => royal.size),
      queuedPreview: queued.slice(0, 16).map((row) => ({
        name: row.name,
        emoji: row.emoji,
      })),
      oldestQueuedAt: queued[0]?.joinedAt ?? null,
    };
  },
});

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { applyMatchComplete } from "./bracket.js";
import { isInDisconnectGrace, matchHasDisconnectGrace } from "./disconnect.js";
import {
  PICK_WINDOW_MS,
  nextMatchState,
  randomWinnerEntropy,
  resolveRound,
  type Gesture,
} from "./rpsLogic";

const gestureValidator = v.union(
  v.literal("rock"),
  v.literal("paper"),
  v.literal("scissors"),
);

const phaseValidator = v.union(
  v.literal("picking"),
  v.literal("revealed"),
  v.literal("done"),
);

const viewValidator = v.union(
  v.null(),
  v.object({
    matchId: v.id("matches"),
    royalId: v.id("royals"),
    playerA: v.string(),
    playerB: v.string(),
    scoreA: v.number(),
    scoreB: v.number(),
    phase: phaseValidator,
    roundIndex: v.number(),
    drawStreak: v.number(),
    pickDeadline: v.number(),
    winnerSessionId: v.union(v.string(), v.null()),
    roundSize: v.union(
      v.literal(16),
      v.literal(8),
      v.literal(4),
      v.literal(2),
    ),
    yourScore: v.number(),
    opponentScore: v.number(),
    yourName: v.string(),
    yourEmoji: v.string(),
    opponentName: v.string(),
    opponentEmoji: v.string(),
    yourGesture: v.union(gestureValidator, v.null()),
    opponentGesture: v.union(gestureValidator, v.null()),
    opponentHasThrown: v.boolean(),
    opponentReconnecting: v.boolean(),
  }),
);

function requireSessionId(sessionId: string): string {
  const id = sessionId.trim();
  if (!id) {
    throw new Error("sessionId is required");
  }
  return id;
}

function otherPlayer(match: Doc<"matches">, sessionId: string): string {
  return sessionId === match.playerA ? match.playerB : match.playerA;
}

async function throwsForRound(
  ctx: QueryCtx | MutationCtx,
  matchId: Id<"matches">,
  roundIndex: number,
): Promise<Doc<"throws">[]> {
  return await ctx.db
    .query("throws")
    .withIndex("by_match_round", (q) =>
      q.eq("matchId", matchId).eq("roundIndex", roundIndex),
    )
    .collect();
}

async function seatIdentity(
  ctx: QueryCtx | MutationCtx,
  royalId: Id<"royals">,
  sessionId: string,
): Promise<{ name: string; emoji: string }> {
  const seats = await ctx.db
    .query("royalPlayers")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  const seat = seats.find((row) => row.royalId === royalId) ?? null;
  return {
    name: seat?.name.trim() || "Player",
    emoji: seat?.emoji.trim() || "🙂",
  };
}

async function throwForPlayer(
  ctx: QueryCtx | MutationCtx,
  matchId: Id<"matches">,
  roundIndex: number,
  sessionId: string,
): Promise<Doc<"throws"> | null> {
  return await ctx.db
    .query("throws")
    .withIndex("by_match_round_session", (q) =>
      q
        .eq("matchId", matchId)
        .eq("roundIndex", roundIndex)
        .eq("sessionId", sessionId),
    )
    .unique();
}

async function scheduleClose(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  roundIndex: number,
): Promise<void> {
  await ctx.scheduler.runAfter(
    PICK_WINDOW_MS,
    internal.matches.closeRound,
    { matchId, roundIndex },
  );
}

async function startPicking(
  ctx: MutationCtx,
  match: Doc<"matches">,
  roundIndex: number,
): Promise<void> {
  const pickDeadline = Date.now() + PICK_WINDOW_MS;
  await ctx.db.patch(match._id, {
    phase: "picking",
    roundIndex,
    pickDeadline,
  });
  await scheduleClose(ctx, match._id, roundIndex);
}

async function applyResolvedRound(
  ctx: MutationCtx,
  match: Doc<"matches">,
  throwA: Gesture | null,
  throwB: Gesture | null,
): Promise<void> {
  const roundResult = resolveRound(throwA, throwB);
  const next = nextMatchState({
    roundIndex: match.roundIndex,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    drawStreak: match.drawStreak,
    roundResult,
    playerA: match.playerA,
    playerB: match.playerB,
    entropy: randomWinnerEntropy(
      match._id,
      match.roundIndex,
      match.playerA,
      match.playerB,
    ),
  });

  await ctx.db.patch(match._id, {
    scoreA: next.scoreA,
    scoreB: next.scoreB,
    drawStreak: next.drawStreak,
    phase: next.phase,
    winnerSessionId: next.winnerSessionId ?? undefined,
  });
  if (next.phase === "done") {
    const updated = await ctx.db.get(match._id);
    if (updated) {
      await applyMatchComplete(ctx, updated);
    }
  }
}

/** Slice 3 (and tests) call this after inserting a match in `picking`. */
export const armPicking = internalMutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }
    if (match.phase !== "picking") {
      return null;
    }
    await startPicking(ctx, match, match.roundIndex);
    return null;
  },
});

export const closeRound = internalMutation({
  args: {
    matchId: v.id("matches"),
    roundIndex: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      return null;
    }
    if (match.phase !== "picking" || match.roundIndex !== args.roundIndex) {
      return null;
    }
    if (await matchHasDisconnectGrace(ctx, match)) {
      return null;
    }

    const rows = await throwsForRound(ctx, match._id, match.roundIndex);
    const bySession = new Map(rows.map((row) => [row.sessionId, row.gesture]));
    await applyResolvedRound(
      ctx,
      match,
      bySession.get(match.playerA) ?? null,
      bySession.get(match.playerB) ?? null,
    );
    return null;
  },
});

export const beginNextRound = internalMutation({
  args: {
    matchId: v.id("matches"),
    fromRoundIndex: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      return null;
    }
    if (
      match.phase !== "revealed" ||
      match.roundIndex !== args.fromRoundIndex ||
      match.winnerSessionId
    ) {
      return null;
    }
    await startPicking(ctx, match, match.roundIndex + 1);
    return null;
  },
});

export const continueAfterReveal = mutation({
  args: {
    matchId: v.id("matches"),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sessionId = requireSessionId(args.sessionId);
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }
    if (sessionId !== match.playerA && sessionId !== match.playerB) {
      throw new Error("Not a player in this match");
    }
    if (
      match.phase !== "revealed" ||
      match.winnerSessionId
    ) {
      return null;
    }
    await startPicking(ctx, match, match.roundIndex + 1);
    return null;
  },
});

export const submitThrow = mutation({
  args: {
    matchId: v.id("matches"),
    sessionId: v.string(),
    gesture: gestureValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sessionId = requireSessionId(args.sessionId);
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }
    if (sessionId !== match.playerA && sessionId !== match.playerB) {
      throw new Error("Not a player in this match");
    }
    if (match.phase !== "picking") {
      throw new Error("Round is not accepting throws");
    }

    const existing = await throwForPlayer(
      ctx,
      match._id,
      match.roundIndex,
      sessionId,
    );
    if (existing) {
      throw new Error("Throw already submitted for this round");
    }

    await ctx.db.insert("throws", {
      matchId: match._id,
      roundIndex: match.roundIndex,
      sessionId,
      gesture: args.gesture,
    });

    if (await matchHasDisconnectGrace(ctx, match)) {
      return null;
    }

    const opponent = await throwForPlayer(
      ctx,
      match._id,
      match.roundIndex,
      otherPlayer(match, sessionId),
    );
    if (opponent) {
      const throwA =
        sessionId === match.playerA ? args.gesture : opponent.gesture;
      const throwB =
        sessionId === match.playerB ? args.gesture : opponent.gesture;
      await applyResolvedRound(ctx, match, throwA, throwB);
    }
    return null;
  },
});

export const view = query({
  args: {
    matchId: v.id("matches"),
    sessionId: v.string(),
  },
  returns: viewValidator,
  handler: async (ctx, args) => {
    const sessionId = args.sessionId.trim();
    if (!sessionId) {
      return null;
    }
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      return null;
    }
    if (sessionId !== match.playerA && sessionId !== match.playerB) {
      return null;
    }

    const rows = await throwsForRound(ctx, match._id, match.roundIndex);
    const yours = rows.find((row) => row.sessionId === sessionId) ?? null;
    const opponentRow =
      rows.find((row) => row.sessionId === otherPlayer(match, sessionId)) ??
      null;
    const picking = match.phase === "picking";
    const youAreA = sessionId === match.playerA;
    const you = await seatIdentity(ctx, match.royalId, sessionId);
    const opponentSessionId = otherPlayer(match, sessionId);
    const opponent = await seatIdentity(ctx, match.royalId, opponentSessionId);
    const opponentSeat = (
      await ctx.db
        .query("royalPlayers")
        .withIndex("by_session", (q) => q.eq("sessionId", opponentSessionId))
        .collect()
    ).find((row) => row.royalId === match.royalId);

    return {
      matchId: match._id,
      royalId: match.royalId,
      playerA: match.playerA,
      playerB: match.playerB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      phase: match.phase,
      roundIndex: match.roundIndex,
      drawStreak: match.drawStreak,
      pickDeadline: match.pickDeadline,
      winnerSessionId: match.winnerSessionId ?? null,
      roundSize: match.roundSize,
      yourScore: youAreA ? match.scoreA : match.scoreB,
      opponentScore: youAreA ? match.scoreB : match.scoreA,
      yourName: you.name,
      yourEmoji: you.emoji,
      opponentName: opponent.name,
      opponentEmoji: opponent.emoji,
      yourGesture: yours?.gesture ?? null,
      opponentGesture: picking ? null : (opponentRow?.gesture ?? null),
      opponentHasThrown: opponentRow !== null,
      opponentReconnecting: isInDisconnectGrace(opponentSeat ?? null),
    };
  },
});

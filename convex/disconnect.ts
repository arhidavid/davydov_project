import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { applyMatchComplete } from "./bracket.js";
import {
  findPlayingSeat,
  matchIdForSession,
} from "./matchmaking.js";
import { chooseRandomWinner } from "./rpsLogic";

/** No heartbeat for this long → searching cancel, or start match grace. */
export const PRESENCE_STALE_MS = 8_000;
/** After disconnect is detected mid-match, wait this long to reconnect. */
export const RECONNECT_GRACE_MS = 20_000;

export function isInDisconnectGrace(
  seat: Doc<"royalPlayers"> | null | undefined,
): boolean {
  return (seat?.disconnectGraceEndsAt ?? 0) > 0;
}

export function forfeitWinner(args: {
  playerA: string;
  playerB: string;
  bothGone: boolean;
  leaverSessionId: string;
  entropy: string;
}): string {
  if (args.bothGone) {
    return chooseRandomWinner(args.playerA, args.playerB, args.entropy);
  }
  return args.leaverSessionId === args.playerA ? args.playerB : args.playerA;
}

export function forfeitEntropy(matchId: string, playerA: string, playerB: string): string {
  return `forfeit:${matchId}:${playerA}:${playerB}`;
}

async function seatInRoyal(
  ctx: QueryCtx | MutationCtx,
  royalId: Id<"royals">,
  sessionId: string,
): Promise<Doc<"royalPlayers"> | null> {
  const seats = await ctx.db
    .query("royalPlayers")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  return seats.find((seat) => seat.royalId === royalId) ?? null;
}

export async function matchHasDisconnectGrace(
  ctx: QueryCtx | MutationCtx,
  match: Doc<"matches">,
): Promise<boolean> {
  const seatA = await seatInRoyal(ctx, match.royalId, match.playerA);
  const seatB = await seatInRoyal(ctx, match.royalId, match.playerB);
  return isInDisconnectGrace(seatA) || isInDisconnectGrace(seatB);
}

async function liveMatchForSession(
  ctx: MutationCtx,
  royalId: Id<"royals">,
  sessionId: string,
): Promise<Doc<"matches"> | null> {
  const matchId = await matchIdForSession(ctx, royalId, sessionId);
  if (!matchId) {
    return null;
  }
  const match = await ctx.db.get(matchId);
  if (!match || match.phase === "done") {
    return null;
  }
  return match;
}

async function queueRow(
  ctx: MutationCtx,
  sessionId: string,
): Promise<Doc<"queue"> | null> {
  return await ctx.db
    .query("queue")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .unique();
}

async function scheduleWatch(
  ctx: MutationCtx,
  sessionId: string,
  seenAt: number,
): Promise<void> {
  await ctx.scheduler.runAfter(
    PRESENCE_STALE_MS,
    internal.disconnect.watchPresence,
    { sessionId, seenAt },
  );
}

async function startGrace(
  ctx: MutationCtx,
  seat: Doc<"royalPlayers">,
): Promise<void> {
  if (isInDisconnectGrace(seat)) {
    return;
  }
  const endsAt = Date.now() + RECONNECT_GRACE_MS;
  await ctx.db.patch(seat._id, { disconnectGraceEndsAt: endsAt });
  await ctx.scheduler.runAfter(
    RECONNECT_GRACE_MS,
    internal.disconnect.resolveForfeit,
    { sessionId: seat.sessionId, royalId: seat.royalId },
  );
}

async function resumeMatchAfterReconnect(
  ctx: MutationCtx,
  seat: Doc<"royalPlayers">,
): Promise<void> {
  const match = await liveMatchForSession(ctx, seat.royalId, seat.sessionId);
  if (!match || match.phase !== "picking") {
    return;
  }
  const opponentGrace = await matchHasDisconnectGrace(ctx, match);
  if (opponentGrace) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.matches.armPicking, {
    matchId: match._id,
  });
}

export async function touchPresence(
  ctx: MutationCtx,
  sessionId: string,
): Promise<{ ok: boolean }> {
  const now = Date.now();
  const queued = await queueRow(ctx, sessionId);
  if (queued) {
    await ctx.db.patch(queued._id, { lastSeen: now });
    await scheduleWatch(ctx, sessionId, now);
    return { ok: true };
  }

  const seat = await findPlayingSeat(ctx, sessionId);
  if (!seat) {
    return { ok: false };
  }

  const wasInGrace = isInDisconnectGrace(seat);
  await ctx.db.patch(seat._id, {
    lastSeen: now,
    disconnectGraceEndsAt: 0,
  });
  await scheduleWatch(ctx, sessionId, now);
  if (wasInGrace) {
    const refreshed = await ctx.db.get(seat._id);
    if (refreshed) {
      await resumeMatchAfterReconnect(ctx, refreshed);
    }
  }
  return { ok: true };
}

export const watchPresence = internalMutation({
  args: {
    sessionId: v.string(),
    seenAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const queued = await queueRow(ctx, args.sessionId);
    if (queued && queued.lastSeen <= args.seenAt) {
      await ctx.db.delete(queued._id);
      return null;
    }

    const seat = await findPlayingSeat(ctx, args.sessionId);
    if (!seat) {
      return null;
    }
    if (seat.lastSeen > args.seenAt) {
      return null;
    }
    await startGrace(ctx, seat);
    return null;
  },
});

export const resolveForfeit = internalMutation({
  args: {
    sessionId: v.string(),
    royalId: v.id("royals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seat = await seatInRoyal(ctx, args.royalId, args.sessionId);
    if (!seat || seat.status !== "alive" || !isInDisconnectGrace(seat)) {
      return null;
    }

    const match = await liveMatchForSession(ctx, args.royalId, args.sessionId);
    if (!match) {
      await ctx.scheduler.runAfter(
        PRESENCE_STALE_MS,
        internal.disconnect.resolveForfeit,
        { sessionId: args.sessionId, royalId: args.royalId },
      );
      return null;
    }

    const opponentId =
      args.sessionId === match.playerA ? match.playerB : match.playerA;
    const opponent = await seatInRoyal(ctx, args.royalId, opponentId);
    const bothGone = isInDisconnectGrace(opponent);

    const winnerSessionId = forfeitWinner({
      playerA: match.playerA,
      playerB: match.playerB,
      bothGone,
      leaverSessionId: args.sessionId,
      entropy: forfeitEntropy(match._id, match.playerA, match.playerB),
    });

    await ctx.db.patch(match._id, {
      phase: "done",
      winnerSessionId,
    });
    const updated = await ctx.db.get(match._id);
    if (updated) {
      await applyMatchComplete(ctx, updated);
    }
    return null;
  },
});

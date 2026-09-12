import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { createPickingMatch } from "./matchmaking.js";

export type BracketRoundSize = 16 | 8 | 4 | 2;

export function nextRoundSize(
  roundSize: BracketRoundSize,
): Exclude<BracketRoundSize, 16> | null {
  if (roundSize === 16) return 8;
  if (roundSize === 8) return 4;
  if (roundSize === 4) return 2;
  return null;
}

export function nextRoundPairs(
  completed: Array<{ slot: number; winnerSessionId: string }>,
): Array<{ slot: number; playerA: string; playerB: string }> {
  const sorted = [...completed].sort((a, b) => a.slot - b.slot);
  if (sorted.length % 2 !== 0) {
    throw new Error("Odd pairing is impossible");
  }
  const pairs: Array<{ slot: number; playerA: string; playerB: string }> = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const left = sorted[i];
    const right = sorted[i + 1];
    if (!left || !right) {
      throw new Error("Odd pairing is impossible");
    }
    pairs.push({
      slot: i / 2,
      playerA: left.winnerSessionId,
      playerB: right.winnerSessionId,
    });
  }
  return pairs;
}

async function seatInRoyal(
  ctx: MutationCtx,
  royalId: Id<"royals">,
  sessionId: string,
): Promise<Doc<"royalPlayers"> | null> {
  const seats = await ctx.db
    .query("royalPlayers")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  return seats.find((seat) => seat.royalId === royalId) ?? null;
}

async function matchesForRoyal(
  ctx: MutationCtx,
  royalId: Id<"royals">,
): Promise<Doc<"matches">[]> {
  return await ctx.db
    .query("matches")
    .withIndex("by_royal", (q) => q.eq("royalId", royalId))
    .collect();
}

export async function applyMatchComplete(
  ctx: MutationCtx,
  match: Doc<"matches">,
): Promise<void> {
  if (match.phase !== "done" || !match.winnerSessionId) {
    return;
  }

  const loserSessionId =
    match.winnerSessionId === match.playerA ? match.playerB : match.playerA;
  const winnerSeat = await seatInRoyal(ctx, match.royalId, match.winnerSessionId);
  const loserSeat = await seatInRoyal(ctx, match.royalId, loserSessionId);
  if (!winnerSeat || !loserSeat) {
    return;
  }

  if (loserSeat.status === "alive") {
    await ctx.db.patch(loserSeat._id, { status: "eliminated" });
  }

  const royalMatches = await matchesForRoyal(ctx, match.royalId);
  const roundMatches = royalMatches
    .filter((row) => row.roundSize === match.roundSize)
    .sort((a, b) => a.slot - b.slot);
  if (
    roundMatches.length === 0 ||
    !roundMatches.every((row) => row.phase === "done" && row.winnerSessionId)
  ) {
    return;
  }

  const following = nextRoundSize(match.roundSize);
  if (following === null) {
    const royal = await ctx.db.get(match.royalId);
    if (!royal || royal.status === "complete") {
      return;
    }
    await ctx.db.patch(match.royalId, {
      status: "complete",
      championSessionId: match.winnerSessionId,
    });
    if (winnerSeat.status !== "champion") {
      await ctx.db.patch(winnerSeat._id, { status: "champion" });
    }
    return;
  }

  const alreadyNext = royalMatches.some((row) => row.roundSize === following);
  if (alreadyNext) {
    return;
  }

  const pairs = nextRoundPairs(
    roundMatches.map((row) => ({
      slot: row.slot,
      winnerSessionId: row.winnerSessionId!,
    })),
  );
  for (const pair of pairs) {
    await createPickingMatch(ctx, {
      royalId: match.royalId,
      roundSize: following,
      slot: pair.slot,
      playerA: pair.playerA,
      playerB: pair.playerB,
    });
  }
}

export const onMatchComplete = internalMutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      return null;
    }
    await applyMatchComplete(ctx, match);
    return null;
  },
});

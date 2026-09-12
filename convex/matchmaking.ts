import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

/** After 4 (and again after 8) queued humans, wait this long before starting. */
export const GATHER_WAIT_MS = 20_000;

const PICK_WINDOW_MS = 10_000;
const QUEUE_SCAN = 32;

export type RoyalSize = 4 | 8 | 16;

export function largestExactBracket(n: number): RoyalSize | null {
  if (n >= 16) return 16;
  if (n >= 8) return 8;
  if (n >= 4) return 4;
  return null;
}

async function waitingFifo(ctx: MutationCtx): Promise<Doc<"queue">[]> {
  return await ctx.db
    .query("queue")
    .withIndex("by_joinedAt")
    .order("asc")
    .take(QUEUE_SCAN);
}

async function getState(ctx: MutationCtx): Promise<Doc<"matchmakerState">> {
  const existing = await ctx.db.query("matchmakerState").take(1);
  const row = existing[0];
  if (row) return row;
  const id = await ctx.db.insert("matchmakerState", {
    gatherGeneration: 0,
    armed: false,
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Failed to create matchmaker state");
  }
  return created;
}

async function invalidateGather(ctx: MutationCtx): Promise<void> {
  const state = await getState(ctx);
  await ctx.db.patch(state._id, {
    gatherGeneration: state.gatherGeneration + 1,
    armed: false,
  });
}

async function armGather(
  ctx: MutationCtx,
  opts: { replace: boolean },
): Promise<void> {
  const state = await getState(ctx);
  if (state.armed && !opts.replace) {
    return;
  }
  const generation = state.gatherGeneration + 1;
  await ctx.db.patch(state._id, {
    gatherGeneration: generation,
    armed: true,
  });
  await ctx.scheduler.runAfter(
    GATHER_WAIT_MS,
    internal.matchmaking.tryStart,
    { generation },
  );
}

async function armGatherForRemainder(ctx: MutationCtx): Promise<void> {
  const n = (await waitingFifo(ctx)).length;
  if (n >= 16) {
    return;
  }
  if (n >= 8) {
    await armGather(ctx, { replace: true });
    return;
  }
  if (n >= 4) {
    await armGather(ctx, { replace: false });
    return;
  }
  await invalidateGather(ctx);
}

async function popRoyal(
  ctx: MutationCtx,
  size: RoyalSize,
): Promise<Id<"royals"> | null> {
  const waiting = await waitingFifo(ctx);
  if (waiting.length < size) {
    return null;
  }
  const batch = waiting.slice(0, size);
  const now = Date.now();
  const royalId = await ctx.db.insert("royals", {
    size,
    status: "playing",
    startedAt: now,
  });
  for (const player of batch) {
    await ctx.db.insert("royalPlayers", {
      royalId,
      sessionId: player.sessionId,
      name: player.name,
      emoji: player.emoji,
      status: "alive",
      lastSeen: now,
    });
    await ctx.db.delete(player._id);
  }
  const pairCount = size / 2;
  for (let slot = 0; slot < pairCount; slot++) {
    const playerA = batch[slot * 2];
    const playerB = batch[slot * 2 + 1];
    if (!playerA || !playerB) {
      throw new Error("Odd pairing is impossible");
    }
    await ctx.db.insert("matches", {
      royalId,
      roundSize: size,
      slot,
      playerA: playerA.sessionId,
      playerB: playerB.sessionId,
      scoreA: 0,
      scoreB: 0,
      phase: "picking",
      roundIndex: 1,
      drawStreak: 0,
      pickDeadline: now + PICK_WINDOW_MS,
    });
  }
  return royalId;
}

async function popWhileSixteen(ctx: MutationCtx): Promise<void> {
  for (;;) {
    const n = (await waitingFifo(ctx)).length;
    if (n < 16) return;
    const started = await popRoyal(ctx, 16);
    if (!started) return;
  }
}

/**
 * Called after a *new* queue row is inserted (not on identity upsert).
 */
export async function onNewEnqueue(ctx: MutationCtx): Promise<void> {
  const n = (await waitingFifo(ctx)).length;
  if (n >= 16) {
    await invalidateGather(ctx);
    await popWhileSixteen(ctx);
    await armGatherForRemainder(ctx);
    return;
  }
  if (n === 8) {
    await armGather(ctx, { replace: true });
    return;
  }
  if (n === 4) {
    await armGather(ctx, { replace: false });
  }
}

export async function findPlayingSeat(
  ctx: QueryCtx | MutationCtx,
  sessionId: string,
): Promise<Doc<"royalPlayers"> | null> {
  const seats = await ctx.db
    .query("royalPlayers")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .take(8);
  for (const seat of seats) {
    if (seat.status !== "alive") continue;
    const royal = await ctx.db.get(seat.royalId);
    if (royal && royal.status === "playing") {
      return seat;
    }
  }
  return null;
}

export async function matchIdForSession(
  ctx: QueryCtx | MutationCtx,
  royalId: Id<"royals">,
  sessionId: string,
): Promise<Id<"matches"> | null> {
  const matches = await ctx.db
    .query("matches")
    .withIndex("by_royal", (q) => q.eq("royalId", royalId))
    .take(16);
  const match = matches.find(
    (row) => row.playerA === sessionId || row.playerB === sessionId,
  );
  return match?._id ?? null;
}

export const tryStart = internalMutation({
  args: { generation: v.number() },
  returns: v.union(v.id("royals"), v.null()),
  handler: async (ctx, args) => {
    const state = await getState(ctx);
    if (!state.armed || args.generation !== state.gatherGeneration) {
      return null;
    }
    await ctx.db.patch(state._id, { armed: false });
    const n = (await waitingFifo(ctx)).length;
    const size = largestExactBracket(n);
    if (size === null) {
      return null;
    }
    const royalId = await popRoyal(ctx, size);
    if (size === 16) {
      await popWhileSixteen(ctx);
    }
    await armGatherForRemainder(ctx);
    return royalId;
  },
});

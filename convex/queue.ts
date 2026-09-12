import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  findPlayingSeat,
  matchIdForSession,
  onNewEnqueue,
  splashForSession,
} from "./matchmaking.js";

const queuedStatus = v.object({
  kind: v.literal("queued"),
  sessionId: v.string(),
  name: v.string(),
  emoji: v.string(),
  joinedAt: v.number(),
  lastSeen: v.number(),
});

const inRoyalStatus = v.object({
  kind: v.literal("inRoyal"),
  royalId: v.id("royals"),
  matchId: v.id("matches"),
});

const lostStatus = v.object({
  kind: v.literal("lost"),
  royalId: v.id("royals"),
});

const winnerStatus = v.object({
  kind: v.literal("winner"),
  royalId: v.id("royals"),
});

const statusReturn = v.union(
  v.object({ kind: v.literal("idle") }),
  queuedStatus,
  inRoyalStatus,
  lostStatus,
  winnerStatus,
);

async function queueRowBySession(
  ctx: QueryCtx | MutationCtx,
  sessionId: string,
): Promise<Doc<"queue"> | null> {
  return await ctx.db
    .query("queue")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .unique();
}

function requireSessionId(sessionId: string): string {
  const id = sessionId.trim();
  if (!id) {
    throw new Error("sessionId is required");
  }
  return id;
}

function displayName(name: string): string {
  return name.trim() || "Player";
}

function displayEmoji(emoji: string): string {
  return emoji.trim() || "🙂";
}

function toQueuedStatus(row: Doc<"queue">) {
  return {
    kind: "queued" as const,
    sessionId: row.sessionId,
    name: row.name,
    emoji: row.emoji,
    joinedAt: row.joinedAt,
    lastSeen: row.lastSeen,
  };
}

export const enqueue = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    emoji: v.string(),
  },
  returns: v.object({
    queueId: v.id("queue"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const sessionId = requireSessionId(args.sessionId);
    const name = displayName(args.name);
    const emoji = displayEmoji(args.emoji);
    const now = Date.now();
    const inRoyal = await findPlayingSeat(ctx, sessionId);
    if (inRoyal) {
      throw new Error("Already in a royal");
    }
    const existing = await queueRowBySession(ctx, sessionId);
    if (existing) {
      await ctx.db.patch(existing._id, { name, emoji, lastSeen: now });
      return { queueId: existing._id, created: false };
    }
    const queueId = await ctx.db.insert("queue", {
      sessionId,
      name,
      emoji,
      joinedAt: now,
      lastSeen: now,
    });
    await onNewEnqueue(ctx);
    return { queueId, created: true };
  },
});

export const cancel = mutation({
  args: { sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sessionId = requireSessionId(args.sessionId);
    const existing = await queueRowBySession(ctx, sessionId);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const heartbeat = mutation({
  args: { sessionId: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const sessionId = requireSessionId(args.sessionId);
    const existing = await queueRowBySession(ctx, sessionId);
    if (!existing) {
      return { ok: false };
    }
    await ctx.db.patch(existing._id, { lastSeen: Date.now() });
    return { ok: true };
  },
});

export const myStatus = query({
  args: { sessionId: v.string() },
  returns: statusReturn,
  handler: async (ctx, args) => {
    const sessionId = args.sessionId.trim();
    if (!sessionId) {
      return { kind: "idle" as const };
    }
    const seat = await findPlayingSeat(ctx, sessionId);
    if (seat) {
      const matchId = await matchIdForSession(ctx, seat.royalId, sessionId);
      if (matchId) {
        return {
          kind: "inRoyal" as const,
          royalId: seat.royalId,
          matchId,
        };
      }
    }
    const existing = await queueRowBySession(ctx, sessionId);
    if (existing) {
      return toQueuedStatus(existing);
    }
    const splash = await splashForSession(ctx, sessionId);
    if (splash) {
      return splash;
    }
    return { kind: "idle" as const };
  },
});

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const queuedStatus = v.object({
  kind: v.literal("queued"),
  sessionId: v.string(),
  name: v.string(),
  emoji: v.string(),
  joinedAt: v.number(),
  lastSeen: v.number(),
});

const statusReturn = v.union(v.object({ kind: v.literal("idle") }), queuedStatus);

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
    const existing = await queueRowBySession(ctx, sessionId);
    if (!existing) {
      return { kind: "idle" as const };
    }
    return toQueuedStatus(existing);
  },
});

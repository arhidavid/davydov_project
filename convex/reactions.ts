import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// How long a floating reaction stays "live" for new subscribers.
const RECENT_WINDOW_MS = 6_000;
// Keep the feed small: prune reactions older than this on write.
const PRUNE_AFTER_MS = 30_000;

export const send = mutation({
  args: {
    code: v.string(),
    sessionId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!room) throw new Error("Room not found");

    const now = Date.now();
    await ctx.db.insert("reactions", {
      roomId: room._id,
      sessionId: args.sessionId,
      emoji: args.emoji || "🎉",
      createdAt: now,
    });

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", room._id).eq("sessionId", args.sessionId),
      )
      .unique();
    if (player) await ctx.db.patch(player._id, { lastSeen: now });

    // Light cleanup so the table doesn't grow without bound.
    const stale = await ctx.db
      .query("reactions")
      .withIndex("by_room_time", (q) =>
        q.eq("roomId", room._id).lt("createdAt", now - PRUNE_AFTER_MS),
      )
      .collect();
    await Promise.all(stale.map((r) => ctx.db.delete(r._id)));
  },
});

/** Reactive stream of the most recent reactions, for the floating animation. */
export const recent = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!room) return [];

    const cutoff = Date.now() - RECENT_WINDOW_MS;
    const rows = await ctx.db
      .query("reactions")
      .withIndex("by_room_time", (q) =>
        q.eq("roomId", room._id).gte("createdAt", cutoff),
      )
      .collect();

    return rows.map((r) => ({
      id: r._id,
      emoji: r.emoji,
      sessionId: r.sessionId,
      createdAt: r.createdAt,
    }));
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// A player is considered "here" if we've heard from them within this window.
const ONLINE_WINDOW_MS = 15_000;

export const join = mutation({
  args: {
    code: v.string(),
    sessionId: v.string(),
    name: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!room) throw new Error("Room not found");

    const existing = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", room._id).eq("sessionId", args.sessionId),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name.trim() || existing.name,
        emoji: args.emoji || existing.emoji,
        lastSeen: now,
      });
    } else {
      await ctx.db.insert("players", {
        roomId: room._id,
        sessionId: args.sessionId,
        name: args.name.trim() || "Player",
        emoji: args.emoji || "🙂",
        lastSeen: now,
      });
    }
    return { roomId: room._id };
  },
});

export const heartbeat = mutation({
  args: { code: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!room) return;
    const player = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", room._id).eq("sessionId", args.sessionId),
      )
      .unique();
    if (player) await ctx.db.patch(player._id, { lastSeen: Date.now() });
  },
});

/** Reactive roster of everyone currently in the room. */
export const list = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!room) return [];

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    const cutoff = Date.now() - ONLINE_WINDOW_MS;
    return players
      .filter((p) => p.lastSeen >= cutoff)
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((p) => ({
        sessionId: p.sessionId,
        name: p.name,
        emoji: p.emoji,
        lastSeen: p.lastSeen,
      }));
  },
});

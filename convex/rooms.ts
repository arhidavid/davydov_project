import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";

// Unambiguous alphabet (no O/0, I/1) for room codes that are easy to read/type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function uniqueCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) return code;
  }
  // Extremely unlikely fallback: extend with a timestamp suffix.
  return randomCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

async function roomByCode(ctx: MutationCtx, code: string) {
  return ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
    .unique();
}

export const create = mutation({
  args: {
    name: v.string(),
    sessionId: v.string(),
    playerName: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const code = await uniqueCode(ctx);
    const now = Date.now();
    const roomId = await ctx.db.insert("rooms", {
      code,
      name: args.name.trim() || "Untitled room",
      createdAt: now,
      taps: 0,
    });
    await ctx.db.insert("players", {
      roomId,
      sessionId: args.sessionId,
      name: args.playerName.trim() || "Player",
      emoji: args.emoji || "🙂",
      lastSeen: now,
    });
    return { code, roomId };
  },
});

export const get = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
    if (!room) return null;
    return {
      _id: room._id as Id<"rooms">,
      code: room.code,
      name: room.name,
      taps: room.taps,
      createdAt: room.createdAt,
    };
  },
});

/** Shared, reactive state demo: every tap is instantly visible to everyone. */
export const tap = mutation({
  args: { code: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const room = await roomByCode(ctx, args.code);
    if (!room) throw new Error("Room not found");
    await ctx.db.patch(room._id, { taps: room.taps + 1 });

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", room._id).eq("sessionId", args.sessionId),
      )
      .unique();
    if (player) await ctx.db.patch(player._id, { lastSeen: Date.now() });

    return room.taps + 1;
  },
});

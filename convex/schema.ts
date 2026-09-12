import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Real-time multiplayer "rooms" skeleton.
 *
 * This is intentionally generic so it can pivot into whatever the hackathon
 * theme turns out to be (trivia, live poll, party game, shared canvas, ...).
 * The three tables cover the reusable primitives:
 *   - rooms:     a joinable space with some shared, reactive state (`taps`)
 *   - players:   presence — who is currently in a room (heartbeated)
 *   - reactions: an ephemeral live event feed (floating emoji)
 */
export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    name: v.string(),
    createdAt: v.number(),
    // Example of shared real-time state every client can mutate + watch.
    taps: v.number(),
  }).index("by_code", ["code"]),

  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
    emoji: v.string(),
    lastSeen: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionId"]),

  reactions: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    emoji: v.string(),
    createdAt: v.number(),
  }).index("by_room_time", ["roomId", "createdAt"]),

  // Humans waiting to be matchmade into a 4/8/16 royal. Unique per sessionId
  // (enforced in enqueue). Slice 3 pops FIFO via by_joinedAt.
  queue: defineTable({
    sessionId: v.string(),
    name: v.string(),
    emoji: v.string(),
    joinedAt: v.number(),
    lastSeen: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_joinedAt", ["joinedAt"]),
});

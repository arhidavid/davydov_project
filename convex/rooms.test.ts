import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";

// Load Convex function modules for the test runtime.
const modules = import.meta.glob("./**/*.*s");

const identity = { sessionId: "sess-a", playerName: "Ada", emoji: "🦊" };

describe("rooms + presence + reactions", () => {
  test("create returns a code and get finds the room", async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      name: "Ada's room",
      ...identity,
    });
    expect(code).toMatch(/^[A-Z0-9]{4}$/);

    const room = await t.query(api.rooms.get, { code });
    expect(room).not.toBeNull();
    expect(room!.taps).toBe(0);
  });

  test("creator shows up in presence immediately", async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      name: "Ada's room",
      ...identity,
    });
    const players = await t.query(api.presence.list, { code });
    expect(players).toHaveLength(1);
    expect(players[0].name).toBe("Ada");
  });

  test("a second player can join and both appear", async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      name: "Ada's room",
      ...identity,
    });
    await t.mutation(api.presence.join, {
      code,
      sessionId: "sess-b",
      name: "Grace",
      emoji: "🐙",
    });
    const players = await t.query(api.presence.list, { code });
    expect(players.map((p) => p.name).sort()).toEqual(["Ada", "Grace"]);
  });

  test("taps are shared state that increments", async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      name: "Ada's room",
      ...identity,
    });
    await t.mutation(api.rooms.tap, { code, sessionId: "sess-a" });
    await t.mutation(api.rooms.tap, { code, sessionId: "sess-b" });
    const room = await t.query(api.rooms.get, { code });
    expect(room!.taps).toBe(2);
  });

  test("reactions can be sent and read back from the live feed", async () => {
    const t = convexTest(schema, modules);
    const { code } = await t.mutation(api.rooms.create, {
      name: "Ada's room",
      ...identity,
    });
    await t.mutation(api.reactions.send, { code, sessionId: "sess-a", emoji: "🎉" });
    const recent = await t.query(api.reactions.recent, { code });
    expect(recent).toHaveLength(1);
    expect(recent[0].emoji).toBe("🎉");
  });

  test("joining a missing room throws", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.presence.join, {
        code: "ZZZZ",
        sessionId: "x",
        name: "Nobody",
        emoji: "👾",
      }),
    ).rejects.toThrow();
  });
});

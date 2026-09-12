import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.*s");

const ada = { sessionId: "sess-ada", name: "Ada", emoji: "🦊" };
const grace = { sessionId: "sess-grace", name: "Grace", emoji: "🐙" };

describe("matchmaking queue", () => {
  test("enqueue inserts a row and myStatus is queued", async () => {
    const t = convexTest(schema, modules);
    const idle = await t.query(api.queue.myStatus, { sessionId: ada.sessionId });
    expect(idle).toEqual({ kind: "idle" });

    const result = await t.mutation(api.queue.enqueue, ada);
    expect(result.created).toBe(true);

    const status = await t.query(api.queue.myStatus, { sessionId: ada.sessionId });
    expect(status.kind).toBe("queued");
    if (status.kind !== "queued") throw new Error("expected queued");
    expect(status.name).toBe("Ada");
    expect(status.emoji).toBe("🦊");
    expect(status.sessionId).toBe(ada.sessionId);
  });

  test("duplicate session upserts instead of creating a second row", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.queue.enqueue, ada);
    const original = await t.run(async (ctx) => ctx.db.get(first.queueId));
    expect(original).not.toBeNull();

    const second = await t.mutation(api.queue.enqueue, {
      sessionId: ada.sessionId,
      name: "Ada Lovelace",
      emoji: "👾",
    });
    expect(second.created).toBe(false);
    expect(second.queueId).toBe(first.queueId);

    const rows = await t.run(async (ctx) => ctx.db.query("queue").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(first.queueId);
    expect(rows[0].name).toBe("Ada Lovelace");
    expect(rows[0].emoji).toBe("👾");
    expect(rows[0].joinedAt).toBe(original!.joinedAt);
    expect(rows[0].lastSeen).toBeGreaterThanOrEqual(original!.lastSeen);
  });

  test("two sessions can queue independently", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.queue.enqueue, ada);
    await t.mutation(api.queue.enqueue, grace);
    const rows = await t.run(async (ctx) => ctx.db.query("queue").collect());
    expect(rows).toHaveLength(2);
  });

  test("cancel deletes the row and returns to idle", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.queue.enqueue, ada);
    await t.mutation(api.queue.cancel, { sessionId: ada.sessionId });
    const status = await t.query(api.queue.myStatus, { sessionId: ada.sessionId });
    expect(status).toEqual({ kind: "idle" });
    const rows = await t.run(async (ctx) => ctx.db.query("queue").collect());
    expect(rows).toHaveLength(0);
  });

  test("cancel is a no-op when not queued", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.queue.cancel, { sessionId: ada.sessionId }),
    ).resolves.toBeNull();
  });

  test("heartbeat refreshes lastSeen and is a no-op when idle", async () => {
    const t = convexTest(schema, modules);
    const missed = await t.mutation(api.queue.heartbeat, {
      sessionId: ada.sessionId,
    });
    expect(missed).toEqual({ ok: false });

    const { queueId } = await t.mutation(api.queue.enqueue, ada);
    await t.run(async (ctx) => {
      await ctx.db.patch(queueId, { lastSeen: 1 });
    });
    const beat = await t.mutation(api.queue.heartbeat, {
      sessionId: ada.sessionId,
    });
    expect(beat).toEqual({ ok: true });
    const row = await t.run(async (ctx) => ctx.db.get(queueId));
    expect(row!.lastSeen).toBeGreaterThan(1);
  });

  test("dismissSplash returns a loser to idle without a queue row", async () => {
    const t = convexTest(schema, modules);
    const royalId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("royals", {
        size: 4,
        status: "complete",
        startedAt: 1,
        championSessionId: grace.sessionId,
      });
      await ctx.db.insert("royalPlayers", {
        royalId: id,
        sessionId: ada.sessionId,
        name: ada.name,
        emoji: ada.emoji,
        status: "eliminated",
        lastSeen: 1,
      });
      return id;
    });

    expect(await t.query(api.queue.myStatus, { sessionId: ada.sessionId })).toEqual(
      { kind: "lost", royalId },
    );

    await t.mutation(api.queue.dismissSplash, { sessionId: ada.sessionId });
    expect(await t.query(api.queue.myStatus, { sessionId: ada.sessionId })).toEqual(
      { kind: "idle" },
    );
    const queued = await t.run(async (ctx) => ctx.db.query("queue").collect());
    expect(queued).toHaveLength(0);
  });
});

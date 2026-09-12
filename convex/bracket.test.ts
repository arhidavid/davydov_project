import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { nextRoundPairs, nextRoundSize } from "./bracket.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.*s");

const p0 = { sessionId: "sess-0", name: "P0", emoji: "🦊" };
const p1 = { sessionId: "sess-1", name: "P1", emoji: "🐙" };
const p2 = { sessionId: "sess-2", name: "P2", emoji: "🐸" };
const p3 = { sessionId: "sess-3", name: "P3", emoji: "🦄" };

describe("nextRoundSize / nextRoundPairs", () => {
  test("steps 16 → 8 → 4 → 2 → champion", () => {
    expect(nextRoundSize(16)).toBe(8);
    expect(nextRoundSize(8)).toBe(4);
    expect(nextRoundSize(4)).toBe(2);
    expect(nextRoundSize(2)).toBeNull();
  });

  test("pairs winners by slot order", () => {
    expect(
      nextRoundPairs([
        { slot: 1, winnerSessionId: "c" },
        { slot: 0, winnerSessionId: "a" },
        { slot: 3, winnerSessionId: "g" },
        { slot: 2, winnerSessionId: "e" },
      ]),
    ).toEqual([
      { slot: 0, playerA: "a", playerB: "c" },
      { slot: 1, playerA: "e", playerB: "g" },
    ]);
  });
});

async function startFourRoyal(t: ReturnType<typeof convexTest>) {
  for (const player of [p0, p1, p2, p3]) {
    await t.mutation(api.queue.enqueue, player);
  }
  await t.mutation(internal.matchmaking.tryStart, { generation: 1 });
  const royals = await t.run(async (ctx) => ctx.db.query("royals").collect());
  expect(royals).toHaveLength(1);
  const royalId = royals[0]!._id;
  const matches = await t.run(async (ctx) =>
    ctx.db
      .query("matches")
      .withIndex("by_royal", (q) => q.eq("royalId", royalId))
      .collect(),
  );
  const bySlot = [...matches].sort((a, b) => a.slot - b.slot);
  expect(bySlot).toHaveLength(2);
  return { royalId, semi0: bySlot[0]!._id, semi1: bySlot[1]!._id };
}

async function finishMatch(
  t: ReturnType<typeof convexTest>,
  matchId: Id<"matches">,
  winnerSessionId: string,
  loserSessionId: string,
) {
  async function throwBoth(
    winGesture: "rock" | "paper" | "scissors",
    loseGesture: "rock" | "paper" | "scissors",
  ) {
    await t.mutation(api.matches.submitThrow, {
      matchId,
      sessionId: winnerSessionId,
      gesture: winGesture,
    });
    await t.mutation(api.matches.submitThrow, {
      matchId,
      sessionId: loserSessionId,
      gesture: loseGesture,
    });
  }

  await throwBoth("rock", "scissors");
  await t.mutation(internal.matches.beginNextRound, {
    matchId,
    fromRoundIndex: 1,
  });
  await throwBoth("paper", "rock");
  await t.mutation(internal.matches.beginNextRound, {
    matchId,
    fromRoundIndex: 2,
  });
  await throwBoth("rock", "rock");
}

describe("bracket climb", () => {
  test("one finished semi eliminates the loser and waits for the other", async () => {
    const t = convexTest(schema, modules);
    const { royalId, semi0, semi1 } = await startFourRoyal(t);

    await finishMatch(t, semi0, p0.sessionId, p1.sessionId);

    const loser = await t.query(api.queue.myStatus, {
      sessionId: p1.sessionId,
    });
    expect(loser).toEqual({ kind: "lost", royalId });

    const winner = await t.query(api.queue.myStatus, {
      sessionId: p0.sessionId,
    });
    expect(winner.kind).toBe("inRoyal");
    if (winner.kind !== "inRoyal") throw new Error("expected inRoyal");
    expect(winner.matchId).toBe(semi0);

    const stillPlaying = await t.query(api.queue.myStatus, {
      sessionId: p2.sessionId,
    });
    expect(stillPlaying.kind).toBe("inRoyal");
    if (stillPlaying.kind !== "inRoyal") throw new Error("expected inRoyal");
    expect(stillPlaying.matchId).toBe(semi1);

    const spy = await t.query(api.matches.view, {
      matchId: semi1,
      sessionId: p1.sessionId,
    });
    expect(spy).toBeNull();

    const allMatches = await t.run(async (ctx) =>
      ctx.db
        .query("matches")
        .withIndex("by_royal", (q) => q.eq("royalId", royalId))
        .collect(),
    );
    expect(allMatches).toHaveLength(2);
    expect(allMatches.every((row) => row.roundSize === 4)).toBe(true);
  });

  test("4-player royal: two semis then a final, champion and losers splash", async () => {
    const t = convexTest(schema, modules);
    const { royalId, semi0, semi1 } = await startFourRoyal(t);

    await finishMatch(t, semi0, p0.sessionId, p1.sessionId);
    await finishMatch(t, semi1, p2.sessionId, p3.sessionId);

    expect(await t.query(api.queue.myStatus, { sessionId: p1.sessionId })).toEqual(
      { kind: "lost", royalId },
    );
    expect(await t.query(api.queue.myStatus, { sessionId: p3.sessionId })).toEqual(
      { kind: "lost", royalId },
    );

    const aStatus = await t.query(api.queue.myStatus, {
      sessionId: p0.sessionId,
    });
    const cStatus = await t.query(api.queue.myStatus, {
      sessionId: p2.sessionId,
    });
    expect(aStatus.kind).toBe("inRoyal");
    expect(cStatus.kind).toBe("inRoyal");
    if (aStatus.kind !== "inRoyal" || cStatus.kind !== "inRoyal") {
      throw new Error("expected inRoyal");
    }
    expect(aStatus.matchId).toBe(cStatus.matchId);
    expect(aStatus.matchId).not.toBe(semi0);
    expect(aStatus.matchId).not.toBe(semi1);

    const finalRow = await t.run(async (ctx) => ctx.db.get(aStatus.matchId));
    expect(finalRow).toMatchObject({
      royalId,
      roundSize: 2,
      slot: 0,
      playerA: p0.sessionId,
      playerB: p2.sessionId,
      phase: "picking",
    });

    const loserPeek = await t.query(api.matches.view, {
      matchId: aStatus.matchId,
      sessionId: p1.sessionId,
    });
    expect(loserPeek).toBeNull();

    await finishMatch(t, aStatus.matchId, p0.sessionId, p2.sessionId);

    expect(await t.query(api.queue.myStatus, { sessionId: p0.sessionId })).toEqual(
      { kind: "winner", royalId },
    );
    expect(await t.query(api.queue.myStatus, { sessionId: p2.sessionId })).toEqual(
      { kind: "lost", royalId },
    );

    const royal = await t.run(async (ctx) => ctx.db.get(royalId));
    expect(royal).toMatchObject({
      status: "complete",
      championSessionId: p0.sessionId,
    });

    const seats = await t.run(async (ctx) =>
      ctx.db
        .query("royalPlayers")
        .withIndex("by_royal", (q) => q.eq("royalId", royalId))
        .collect(),
    );
    const bySession = Object.fromEntries(
      seats.map((seat) => [seat.sessionId, seat.status]),
    );
    expect(bySession).toEqual({
      "sess-0": "champion",
      "sess-1": "eliminated",
      "sess-2": "eliminated",
      "sess-3": "eliminated",
    });
  });

  test("onMatchComplete is idempotent after the final already exists", async () => {
    const t = convexTest(schema, modules);
    const { semi0, semi1 } = await startFourRoyal(t);
    await finishMatch(t, semi0, p0.sessionId, p1.sessionId);
    await finishMatch(t, semi1, p2.sessionId, p3.sessionId);

    const before = await t.run(async (ctx) => ctx.db.query("matches").collect());
    await t.mutation(internal.bracket.onMatchComplete, { matchId: semi1 });
    const after = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(after).toHaveLength(before.length);
  });
});

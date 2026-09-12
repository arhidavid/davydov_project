import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import schema from "./schema.js";
import { chooseRandomWinner, randomWinnerEntropy } from "./rpsLogic.js";

const modules = import.meta.glob("./**/*.*s");

const ada = "sess-ada";
const grace = "sess-grace";

async function seedMatch(
  t: ReturnType<typeof convexTest>,
  opts?: { arm?: boolean },
) {
  const ids = await t.run(async (ctx) => {
    const royalId = await ctx.db.insert("royals", {
      size: 4,
      status: "playing",
      startedAt: 1,
    });
    const matchId = await ctx.db.insert("matches", {
      royalId,
      roundSize: 4,
      slot: 0,
      playerA: ada,
      playerB: grace,
      scoreA: 0,
      scoreB: 0,
      phase: "picking",
      roundIndex: 1,
      drawStreak: 0,
      pickDeadline: 0,
    });
    return { royalId, matchId };
  });
  if (opts?.arm === true) {
    await t.mutation(internal.matches.armPicking, { matchId: ids.matchId });
  }
  return ids;
}

async function playRound(
  t: ReturnType<typeof convexTest>,
  matchId: Id<"matches">,
  gestureA: "rock" | "paper" | "scissors" | null,
  gestureB: "rock" | "paper" | "scissors" | null,
) {
  if (gestureA) {
    await t.mutation(api.matches.submitThrow, {
      matchId,
      sessionId: ada,
      gesture: gestureA,
    });
  }
  if (gestureB) {
    await t.mutation(api.matches.submitThrow, {
      matchId,
      sessionId: grace,
      gesture: gestureB,
    });
  }
  if (!gestureA || !gestureB) {
    const match = await t.run(async (ctx) => ctx.db.get(matchId));
    await t.mutation(internal.matches.closeRound, {
      matchId,
      roundIndex: match!.roundIndex,
    });
  }
}

describe("round engine", () => {
  test("view hides opponent gesture while picking", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await t.mutation(api.matches.submitThrow, {
      matchId,
      sessionId: ada,
      gesture: "rock",
    });

    const adaView = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(adaView).not.toBeNull();
    expect(adaView!.phase).toBe("picking");
    expect(adaView!.yourGesture).toBe("rock");
    expect(adaView!.opponentHasThrown).toBe(false);
    expect(adaView!.opponentGesture).toBeNull();

    const graceView = await t.query(api.matches.view, {
      matchId,
      sessionId: grace,
    });
    expect(graceView!.yourGesture).toBeNull();
    expect(graceView!.opponentHasThrown).toBe(true);
    expect(graceView!.opponentGesture).toBeNull();

    const stranger = await t.query(api.matches.view, {
      matchId,
      sessionId: "sess-eve",
    });
    expect(stranger).toBeNull();
  });

  test("both throws reveal and award the round", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await playRound(t, matchId, "rock", "scissors");

    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.phase).toBe("revealed");
    expect(view!.scoreA).toBe(1);
    expect(view!.scoreB).toBe(0);
    expect(view!.drawStreak).toBe(0);
    expect(view!.yourGesture).toBe("rock");
    expect(view!.opponentGesture).toBe("scissors");
  });

  test("same gesture is a draw with no points", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await playRound(t, matchId, "paper", "paper");
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.phase).toBe("revealed");
    expect(view!.scoreA).toBe(0);
    expect(view!.scoreB).toBe(0);
    expect(view!.drawStreak).toBe(1);
  });

  test("one miss loses the round when the window closes", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await t.mutation(api.matches.submitThrow, {
      matchId,
      sessionId: ada,
      gesture: "scissors",
    });
    await t.mutation(internal.matches.closeRound, {
      matchId,
      roundIndex: 1,
    });
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.phase).toBe("revealed");
    expect(view!.scoreA).toBe(1);
    expect(view!.scoreB).toBe(0);
    expect(view!.opponentGesture).toBeNull();
  });

  test("both miss is a draw", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await t.mutation(internal.matches.closeRound, {
      matchId,
      roundIndex: 1,
    });
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.scoreA).toBe(0);
    expect(view!.scoreB).toBe(0);
    expect(view!.drawStreak).toBe(1);
    expect(view!.phase).toBe("revealed");
  });

  test("best of three: 2-0 after three rounds ends the match", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await playRound(t, matchId, "rock", "scissors");
    await t.mutation(internal.matches.beginNextRound, {
      matchId,
      fromRoundIndex: 1,
    });
    await playRound(t, matchId, "paper", "rock");
    await t.mutation(internal.matches.beginNextRound, {
      matchId,
      fromRoundIndex: 2,
    });
    await playRound(t, matchId, "rock", "rock");

    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.phase).toBe("done");
    expect(view!.scoreA).toBe(2);
    expect(view!.scoreB).toBe(0);
    expect(view!.roundIndex).toBe(3);
    expect(view!.winnerSessionId).toBe(ada);
  });

  test("tied after 3 plays extra rounds until a winner", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await playRound(t, matchId, "rock", "scissors");
    await t.mutation(internal.matches.beginNextRound, {
      matchId,
      fromRoundIndex: 1,
    });
    await playRound(t, matchId, "scissors", "rock");
    await t.mutation(internal.matches.beginNextRound, {
      matchId,
      fromRoundIndex: 2,
    });
    await playRound(t, matchId, "paper", "paper");
    const tied = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(tied!.phase).toBe("revealed");
    expect(tied!.scoreA).toBe(1);
    expect(tied!.scoreB).toBe(1);
    expect(tied!.roundIndex).toBe(3);

    await t.mutation(internal.matches.beginNextRound, {
      matchId,
      fromRoundIndex: 3,
    });
    await playRound(t, matchId, "scissors", "paper");
    const extra = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(extra!.phase).toBe("done");
    expect(extra!.roundIndex).toBe(4);
    expect(extra!.winnerSessionId).toBe(ada);
  });

  test("10 draws in a row pick a seeded random match winner", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    for (let round = 1; round <= 10; round++) {
      await playRound(t, matchId, "rock", "rock");
      if (round < 10) {
        const row = await t.run(async (ctx) => ctx.db.get(matchId));
        expect(row!.phase).toBe("revealed");
        await t.mutation(internal.matches.beginNextRound, {
          matchId,
          fromRoundIndex: round,
        });
      }
    }
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: grace,
    });
    expect(view!.phase).toBe("done");
    expect(view!.drawStreak).toBe(10);
    expect(view!.scoreA).toBe(0);
    expect(view!.scoreB).toBe(0);
    const expected = chooseRandomWinner(
      ada,
      grace,
      randomWinnerEntropy(matchId, 10, ada, grace),
    );
    expect(view!.winnerSessionId).toBe(expected);
  });

  test("duplicate throw is rejected", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await t.mutation(api.matches.submitThrow, {
      matchId,
      sessionId: ada,
      gesture: "rock",
    });
    await expect(
      t.mutation(api.matches.submitThrow, {
        matchId,
        sessionId: ada,
        gesture: "paper",
      }),
    ).rejects.toThrow(/already submitted/i);
  });

  test("scheduled closeRound ends the pick window without a client clock", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const { matchId } = await seedMatch(t, { arm: true });
      await t.mutation(api.matches.submitThrow, {
        matchId,
        sessionId: grace,
        gesture: "paper",
      });

      vi.advanceTimersByTime(10_000);
      await t.finishInProgressScheduledFunctions();

      const view = await t.query(api.matches.view, {
        matchId,
        sessionId: grace,
      });
      expect(view!.roundIndex).toBe(1);
      expect(view!.phase).toBe("revealed");
      expect(view!.scoreA).toBe(0);
      expect(view!.scoreB).toBe(1);
      expect(view!.yourGesture).toBe("paper");
      expect(view!.opponentGesture).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("stale closeRound is a no-op after the round already resolved", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await playRound(t, matchId, "rock", "scissors");
    await t.mutation(internal.matches.closeRound, {
      matchId,
      roundIndex: 1,
    });
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.scoreA).toBe(1);
    expect(view!.scoreB).toBe(0);
    expect(view!.phase).toBe("revealed");
  });

  test("continueAfterReveal starts the next pick window", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await playRound(t, matchId, "rock", "scissors");
    await t.mutation(api.matches.continueAfterReveal, {
      matchId,
      sessionId: ada,
    });
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.phase).toBe("picking");
    expect(view!.roundIndex).toBe(2);
    expect(view!.yourScore).toBe(1);
    expect(view!.opponentScore).toBe(0);
    expect(view!.roundSize).toBe(4);
  });

  test("continueAfterReveal is a no-op while still picking", async () => {
    const t = convexTest(schema, modules);
    const { matchId } = await seedMatch(t);
    await t.mutation(api.matches.continueAfterReveal, {
      matchId,
      sessionId: ada,
    });
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.phase).toBe("picking");
    expect(view!.roundIndex).toBe(1);
  });

  test("view fills names from royalPlayers when present", async () => {
    const t = convexTest(schema, modules);
    const { royalId, matchId } = await seedMatch(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("royalPlayers", {
        royalId,
        sessionId: ada,
        name: "Ada",
        emoji: "🦊",
        status: "alive",
        lastSeen: 1,
      });
      await ctx.db.insert("royalPlayers", {
        royalId,
        sessionId: grace,
        name: "Grace",
        emoji: "🐙",
        status: "alive",
        lastSeen: 1,
      });
    });
    const view = await t.query(api.matches.view, {
      matchId,
      sessionId: ada,
    });
    expect(view!.yourName).toBe("Ada");
    expect(view!.yourEmoji).toBe("🦊");
    expect(view!.opponentName).toBe("Grace");
    expect(view!.opponentEmoji).toBe("🐙");
  });
});

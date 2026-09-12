import { describe, expect, test } from "vitest";
import {
  chooseRandomWinner,
  entropyBit,
  nextMatchState,
  resolveRound,
} from "./rpsLogic";

describe("resolveRound", () => {
  test("one miss loses the round", () => {
    expect(resolveRound(null, "rock")).toBe("b");
    expect(resolveRound("paper", null)).toBe("a");
  });

  test("both miss is a draw", () => {
    expect(resolveRound(null, null)).toBe("draw");
  });

  test("same gesture is a draw", () => {
    expect(resolveRound("rock", "rock")).toBe("draw");
    expect(resolveRound("paper", "paper")).toBe("draw");
    expect(resolveRound("scissors", "scissors")).toBe("draw");
  });

  test("classic RPS winners", () => {
    expect(resolveRound("rock", "scissors")).toBe("a");
    expect(resolveRound("scissors", "rock")).toBe("b");
    expect(resolveRound("paper", "rock")).toBe("a");
    expect(resolveRound("rock", "paper")).toBe("b");
    expect(resolveRound("scissors", "paper")).toBe("a");
    expect(resolveRound("paper", "scissors")).toBe("b");
  });
});

describe("nextMatchState", () => {
  const players = {
    playerA: "ada",
    playerB: "grace",
    entropy: "seed",
  };

  test("decisive round awards a point and resets draw streak", () => {
    const next = nextMatchState({
      roundIndex: 1,
      scoreA: 0,
      scoreB: 0,
      drawStreak: 4,
      roundResult: "a",
      ...players,
    });
    expect(next).toEqual({
      scoreA: 1,
      scoreB: 0,
      drawStreak: 0,
      phase: "revealed",
      winnerSessionId: null,
    });
  });

  test("draw increments streak and awards no point", () => {
    const next = nextMatchState({
      roundIndex: 1,
      scoreA: 1,
      scoreB: 0,
      drawStreak: 0,
      roundResult: "draw",
      ...players,
    });
    expect(next).toEqual({
      scoreA: 1,
      scoreB: 0,
      drawStreak: 1,
      phase: "revealed",
      winnerSessionId: null,
    });
  });

  test("after 3 rounds unequal scores ends the match", () => {
    const next = nextMatchState({
      roundIndex: 3,
      scoreA: 1,
      scoreB: 1,
      drawStreak: 0,
      roundResult: "b",
      ...players,
    });
    expect(next.phase).toBe("done");
    expect(next.scoreA).toBe(1);
    expect(next.scoreB).toBe(2);
    expect(next.winnerSessionId).toBe("grace");
  });

  test("tied after 3 continues to extras (revealed, not done)", () => {
    const next = nextMatchState({
      roundIndex: 3,
      scoreA: 1,
      scoreB: 1,
      drawStreak: 2,
      roundResult: "draw",
      ...players,
    });
    expect(next.phase).toBe("revealed");
    expect(next.scoreA).toBe(1);
    expect(next.scoreB).toBe(1);
    expect(next.winnerSessionId).toBeNull();
    expect(next.drawStreak).toBe(3);
  });

  test("extra round winner ends the match", () => {
    const next = nextMatchState({
      roundIndex: 4,
      scoreA: 1,
      scoreB: 1,
      drawStreak: 0,
      roundResult: "a",
      ...players,
    });
    expect(next.phase).toBe("done");
    expect(next.winnerSessionId).toBe("ada");
  });

  test("10-draw streak picks a seeded random winner", () => {
    const entropy = "fixed-entropy";
    const expected = chooseRandomWinner("ada", "grace", entropy);
    const next = nextMatchState({
      roundIndex: 10,
      scoreA: 0,
      scoreB: 0,
      drawStreak: 9,
      roundResult: "draw",
      playerA: "ada",
      playerB: "grace",
      entropy,
    });
    expect(next.phase).toBe("done");
    expect(next.drawStreak).toBe(10);
    expect(next.scoreA).toBe(0);
    expect(next.scoreB).toBe(0);
    expect(next.winnerSessionId).toBe(expected);
    expect(["ada", "grace"]).toContain(next.winnerSessionId);
  });
});

describe("chooseRandomWinner", () => {
  test("is deterministic for a given entropy", () => {
    const a = chooseRandomWinner("ada", "grace", "alpha");
    const b = chooseRandomWinner("ada", "grace", "alpha");
    expect(a).toBe(b);
    expect(entropyBit("alpha") === 0 ? "ada" : "grace").toBe(a);
  });
});

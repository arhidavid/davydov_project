export const PICK_WINDOW_MS = 10_000;
/** How long phones show both gestures before the next pick window. */
export const REVEAL_PAUSE_MS = 2_500;

export type Gesture = "rock" | "paper" | "scissors";
export type RoundResult = "a" | "b" | "draw";
export type MatchPhase = "picking" | "revealed" | "done";

const BEATS: Record<Gesture, Gesture> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export function resolveRound(
  throwA: Gesture | null,
  throwB: Gesture | null,
): RoundResult {
  if (throwA === null && throwB === null) {
    return "draw";
  }
  if (throwA === null) {
    return "b";
  }
  if (throwB === null) {
    return "a";
  }
  if (throwA === throwB) {
    return "draw";
  }
  return BEATS[throwA] === throwB ? "a" : "b";
}

/** Deterministic 0/1 from a string — used so 10-draw random winners are testable. */
export function entropyBit(entropy: string): 0 | 1 {
  let h = 2166136261;
  for (let i = 0; i < entropy.length; i++) {
    h ^= entropy.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2 === 0 ? 0 : 1) as 0 | 1;
}

export function chooseRandomWinner(
  playerA: string,
  playerB: string,
  entropy: string,
): string {
  return entropyBit(entropy) === 0 ? playerA : playerB;
}

export function randomWinnerEntropy(
  matchId: string,
  roundIndex: number,
  playerA: string,
  playerB: string,
): string {
  return `${matchId}:${roundIndex}:${playerA}:${playerB}`;
}

export type NextMatchState = {
  scoreA: number;
  scoreB: number;
  drawStreak: number;
  phase: MatchPhase;
  winnerSessionId: string | null;
};

export function nextMatchState(args: {
  roundIndex: number;
  scoreA: number;
  scoreB: number;
  drawStreak: number;
  roundResult: RoundResult;
  playerA: string;
  playerB: string;
  entropy: string;
}): NextMatchState {
  let scoreA = args.scoreA;
  let scoreB = args.scoreB;
  let drawStreak = args.drawStreak;

  if (args.roundResult === "draw") {
    drawStreak += 1;
    if (drawStreak >= 10) {
      return {
        scoreA,
        scoreB,
        drawStreak,
        phase: "done",
        winnerSessionId: chooseRandomWinner(
          args.playerA,
          args.playerB,
          args.entropy,
        ),
      };
    }
  } else {
    drawStreak = 0;
    if (args.roundResult === "a") {
      scoreA += 1;
    } else {
      scoreB += 1;
    }
  }

  if (args.roundIndex >= 3 && scoreA !== scoreB) {
    return {
      scoreA,
      scoreB,
      drawStreak,
      phase: "done",
      winnerSessionId: scoreA > scoreB ? args.playerA : args.playerB,
    };
  }

  return {
    scoreA,
    scoreB,
    drawStreak,
    phase: "revealed",
    winnerSessionId: null,
  };
}

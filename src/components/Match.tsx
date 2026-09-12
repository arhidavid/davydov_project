import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel.js";

const REVEAL_PAUSE_MS = 2_500;

type Gesture = "rock" | "paper" | "scissors";

const THROWS: Array<{ gesture: Gesture; icon: string; label: string }> = [
  { gesture: "rock", icon: "✊", label: "Rock" },
  { gesture: "paper", icon: "✋", label: "Paper" },
  { gesture: "scissors", icon: "✌️", label: "Scissors" },
];

function gestureIcon(g: Gesture | null): string {
  if (g === "rock") return "✊";
  if (g === "paper") return "✋";
  if (g === "scissors") return "✌️";
  return "—";
}

function roundLabel(roundSize: 16 | 8 | 4 | 2): string {
  if (roundSize === 2) return "Final";
  return `Round of ${roundSize}`;
}

function youWonRound(you: Gesture | null, them: Gesture | null): "win" | "lose" | "draw" {
  if (you === them || you === null && them === null) return "draw";
  if (you === null) return "lose";
  if (them === null) return "win";
  if (
    (you === "rock" && them === "scissors") ||
    (you === "paper" && them === "rock") ||
    (you === "scissors" && them === "paper")
  ) {
    return "win";
  }
  return "lose";
}

function useSecondsLeft(deadline: number, active: boolean): number {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [active, deadline]);
  return left;
}

export function Match({
  matchId,
  sessionId,
}: {
  matchId: Id<"matches">;
  sessionId: string;
}) {
  const view = useQuery(api.matches.view, { matchId, sessionId });
  const submitThrow = useMutation(api.matches.submitThrow);
  const continueAfterReveal = useMutation(api.matches.continueAfterReveal);
  const [error, setError] = useState<string | null>(null);
  const picking = view?.phase === "picking";
  const seconds = useSecondsLeft(view?.pickDeadline ?? 0, picking);

  useEffect(() => {
    if (!view || view.phase !== "revealed") return;
    const id = window.setTimeout(() => {
      void continueAfterReveal({ matchId: view.matchId, sessionId });
    }, REVEAL_PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [continueAfterReveal, sessionId, view?.matchId, view?.phase, view?.roundIndex]);

  async function pick(gesture: Gesture) {
    if (!view || view.phase !== "picking" || view.yourGesture) return;
    setError(null);
    try {
      await submitThrow({ matchId: view.matchId, sessionId, gesture });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (view === undefined) {
    return (
      <div className="screen center">
        <p className="muted">Connecting…</p>
      </div>
    );
  }

  if (view === null) {
    return (
      <div className="screen center">
        <p className="muted">Match not found.</p>
      </div>
    );
  }

  if (view.phase === "done") {
    return (
      <div className="screen center searching">
        <div className="vs-row">
          <div className="vs-player">
            <span className="vs-emoji">{view.yourEmoji}</span>
            <span className="vs-name">{view.yourName}</span>
          </div>
          <span className="vs-mark">VS</span>
          <div className="vs-player">
            <span className="vs-emoji">{view.opponentEmoji}</span>
            <span className="vs-name">{view.opponentName}</span>
          </div>
        </div>
        <h1 className="searching-title">Waiting…</h1>
        <p className="muted searching-copy">
          You won this pair. Waiting for the next match.
        </p>
      </div>
    );
  }

  const outcome =
    view.phase === "revealed"
      ? youWonRound(view.yourGesture, view.opponentGesture)
      : null;

  return (
    <div className="screen match">
      <p className="match-round">
        {roundLabel(view.roundSize)} · throw {view.roundIndex}
      </p>
      <div className="vs-row">
        <div className="vs-player">
          <span className="vs-emoji">{view.yourEmoji}</span>
          <span className="vs-name">{view.yourName}</span>
          <span className="vs-score">{view.yourScore}</span>
        </div>
        <span className="vs-mark">VS</span>
        <div className="vs-player">
          <span className="vs-emoji">{view.opponentEmoji}</span>
          <span className="vs-name">{view.opponentName}</span>
          <span className="vs-score">{view.opponentScore}</span>
        </div>
      </div>

      {view.phase === "picking" ? (
        <>
          {view.opponentReconnecting ? (
            <p className="reconnect-banner">Opponent reconnecting… match waits.</p>
          ) : null}
          <div className="match-timer" aria-live="polite">
            {seconds}
          </div>
          <p className="muted match-hint">
            {view.opponentReconnecting
              ? "Timer is paused until they return."
              : view.yourGesture
              ? "Locked in. Waiting for opponent…"
              : view.opponentHasThrown
                ? "Opponent is ready. Throw!"
                : "Pick before the timer hits zero."}
          </p>
          <div className="throw-grid">
            {THROWS.map((item) => (
              <button
                key={item.gesture}
                type="button"
                className={`throw-btn ${view.yourGesture === item.gesture ? "throw-btn--on" : ""}`}
                disabled={view.yourGesture !== null}
                onClick={() => {
                  void pick(item.gesture);
                }}
                aria-label={item.label}
              >
                <span className="throw-icon">{item.icon}</span>
                <span className="throw-label">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="reveal">
          <div className="reveal-pair">
            <div className="reveal-side">
              <span className="reveal-icon">{gestureIcon(view.yourGesture)}</span>
              <span className="muted">You</span>
            </div>
            <div className="reveal-side">
              <span className="reveal-icon">{gestureIcon(view.opponentGesture)}</span>
              <span className="muted">Them</span>
            </div>
          </div>
          <p
            className={`reveal-copy ${
              outcome === "win"
                ? "reveal-copy--win"
                : outcome === "lose"
                  ? "reveal-copy--lose"
                  : ""
            }`}
          >
            {outcome === "draw"
              ? "Draw"
              : outcome === "win"
                ? "You take the round"
                : "They take the round"}
          </p>
        </div>
      )}
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}

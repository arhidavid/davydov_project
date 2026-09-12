import { useState } from "react";
import {
  EMOJIS,
  getEmoji,
  getName,
  setEmoji as persistEmoji,
  setName as persistName,
} from "../lib/session.js";

export function Home({
  onStartMatchmaking,
  busy = false,
  error = null,
}: {
  onStartMatchmaking: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState(getName);
  const [emoji, setEmoji] = useState(getEmoji);

  function saveName(next: string) {
    setName(next);
    const trimmed = next.trim();
    if (trimmed) persistName(trimmed);
  }

  function saveEmoji(next: string) {
    setEmoji(next);
    persistEmoji(next);
  }

  function handleStart() {
    const trimmed = name.trim() || getName();
    if (trimmed !== name) setName(trimmed);
    persistName(trimmed);
    persistEmoji(emoji);
    onStartMatchmaking();
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-badge">live tournament · powered by Convex</div>
        <h1 className="hero-title">KPM Royale</h1>
        <p className="hero-tagline">Kamen! Papir! Makaze! ✊ ✋ ✌️</p>
        <p className="hero-sub">
          Tap in from your phone. Convex matchmakes a 4, 8, or 16-player royal.
        </p>
      </div>

      <div className="panel">
        <label className="field-label" htmlFor="player-name">
          Your name
        </label>
        <input
          id="player-name"
          className="text-input"
          value={name}
          maxLength={24}
          onChange={(e) => saveName(e.target.value)}
          placeholder="Pick a name"
          autoComplete="off"
          enterKeyHint="done"
        />

        <label className="field-label">Your avatar</label>
        <div className="emoji-grid" role="listbox" aria-label="Choose an avatar">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className={`emoji-cell ${emoji === e ? "emoji-cell--on" : ""}`}
              onClick={() => saveEmoji(e)}
              aria-label={`Avatar ${e}`}
              aria-pressed={emoji === e}
            >
              {e}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleStart}
          disabled={busy}
        >
          {busy ? "…" : "Start matchmaking"}
        </button>
        {error ? <div className="error">{error}</div> : null}
      </div>

      <footer className="foot">Scan. Queue. Throw. Climb.</footer>
    </div>
  );
}

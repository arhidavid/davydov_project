import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api.js";
import {
  EMOJIS,
  getEmoji,
  getName,
  setEmoji as persistEmoji,
  setName as persistName,
} from "../lib/session.js";

export function Home({
  sessionId,
  onEnter,
}: {
  sessionId: string;
  onEnter: (code: string) => void;
}) {
  const [name, setName] = useState(getName);
  const [emoji, setEmoji] = useState(getEmoji);
  const [joinCode, setJoinCode] = useState(
    new URLSearchParams(window.location.search).get("r")?.toUpperCase() ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useMutation(api.rooms.create);
  const joinRoom = useMutation(api.presence.join);

  function saveIdentity() {
    persistName(name);
    persistEmoji(emoji);
  }

  async function handleCreate() {
    saveIdentity();
    setBusy(true);
    setError(null);
    try {
      const { code } = await createRoom({
        name: `${name}'s room`,
        sessionId,
        playerName: name,
        emoji,
      });
      onEnter(code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    saveIdentity();
    setBusy(true);
    setError(null);
    try {
      await joinRoom({ code, sessionId, name, emoji });
      onEnter(code);
    } catch (e) {
      setError("That room code wasn't found. Double-check and try again.");
      void e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-badge">⚡ real-time · powered by Convex</div>
        <h1 className="hero-title">Convex Party</h1>
        <p className="hero-sub">
          Spin up a room, share the link, and watch everyone show up live — no
          accounts, no refresh.
        </p>
      </div>

      <div className="panel">
        <label className="field-label">Your name</label>
        <input
          className="text-input"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pick a name"
        />

        <label className="field-label">Your avatar</label>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`emoji-cell ${emoji === e ? "emoji-cell--on" : ""}`}
              onClick={() => setEmoji(e)}
              aria-label={`Avatar ${e}`}
            >
              {e}
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={busy}>
          {busy ? "…" : "Create a room"}
        </button>

        <div className="divider"><span>or join one</span></div>

        <div className="join-row">
          <input
            className="text-input code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={8}
            inputMode="text"
            autoCapitalize="characters"
          />
          <button className="btn btn-ghost" onClick={handleJoin} disabled={busy || !joinCode.trim()}>
            Join
          </button>
        </div>

        {error && <div className="error">{error}</div>}
      </div>

      <footer className="foot">Built with Convex + Vite · a hackathon skeleton</footer>
    </div>
  );
}

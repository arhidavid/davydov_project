import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../convex/_generated/api.js";
import { getEmoji, getName } from "../lib/session.js";
import { EmojiFountain } from "./EmojiFountain.js";

const REACTION_EMOJIS = ["🎉", "🔥", "❤️", "😂", "👏", "🚀", "🤯", "✨"];

export function Room({
  code,
  sessionId,
  onLeave,
}: {
  code: string;
  sessionId: string;
  onLeave: () => void;
}) {
  const name = getName();
  const emoji = getEmoji();

  const room = useQuery(api.rooms.get, { code });
  const players = useQuery(api.presence.list, { code }) ?? [];
  const reactions = useQuery(api.reactions.recent, { code }) ?? [];

  const join = useMutation(api.presence.join);
  const heartbeat = useMutation(api.presence.heartbeat);
  const tap = useMutation(api.rooms.tap);
  const sendReaction = useMutation(api.reactions.send);

  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("r", code);
    return url.toString();
  }, [code]);

  // Register presence on entry, then heartbeat so others see us as "here".
  useEffect(() => {
    void join({ code, sessionId, name, emoji });
    const id = setInterval(() => {
      void heartbeat({ code, sessionId });
    }, 5000);
    return () => clearInterval(id);
  }, [code, sessionId, name, emoji, join, heartbeat]);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my room", url: shareUrl });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShowQr(true);
    }
  }

  if (room === undefined) {
    return <div className="screen center muted">Connecting…</div>;
  }
  if (room === null) {
    return (
      <div className="screen center">
        <p className="muted">Room <b>{code}</b> doesn't exist (anymore).</p>
        <button className="btn btn-primary" onClick={onLeave}>Back home</button>
      </div>
    );
  }

  return (
    <div className="screen room">
      <EmojiFountain reactions={reactions} />

      <header className="room-header">
        <button className="icon-btn" onClick={onLeave} aria-label="Leave">←</button>
        <div className="room-code" onClick={share} title="Tap to share">
          <span className="room-code-label">ROOM</span>
          <span className="room-code-value">{code}</span>
        </div>
        <button className="icon-btn" onClick={() => setShowQr((v) => !v)} aria-label="Show QR">
          ⧉
        </button>
      </header>

      {showQr && (
        <div className="qr-card" onClick={() => setShowQr(false)}>
          <QRCodeSVG value={shareUrl} size={180} bgColor="#ffffff" fgColor="#0b0f1a" includeMargin />
          <p className="qr-hint">Scan to join · tap to close</p>
        </div>
      )}

      <section className="presence">
        <div className="presence-title">
          {players.length} {players.length === 1 ? "person" : "people"} here
        </div>
        <div className="avatars">
          {players.map((p) => (
            <div
              key={p.sessionId}
              className={`avatar ${p.sessionId === sessionId ? "avatar--me" : ""}`}
              title={p.name}
            >
              <span className="avatar-emoji">{p.emoji}</span>
              <span className="avatar-name">{p.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tapzone">
        <div className="tap-count">{room.taps}</div>
        <div className="tap-label">shared taps · synced to everyone</div>
        <button
          className="btn btn-primary btn-tap"
          onClick={() => void tap({ code, sessionId })}
        >
          TAP
        </button>
      </section>

      <section className="reaction-bar">
        {REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            className="reaction-btn"
            onClick={() => void sendReaction({ code, sessionId, emoji: e })}
          >
            {e}
          </button>
        ))}
      </section>

      {copied && <div className="toast">Link copied!</div>}
    </div>
  );
}

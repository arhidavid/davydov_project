import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api.js";
import { Home } from "./components/Home.js";
import { Matched } from "./components/Matched.js";
import { Searching } from "./components/Searching.js";
import { getEmoji, getName, getSessionId } from "./lib/session.js";

const HEARTBEAT_MS = 4_000;

function stripRoomQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("r")) return;
  url.searchParams.delete("r");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function App() {
  const sessionId = getSessionId();
  const status = useQuery(api.queue.myStatus, { sessionId });
  const enqueue = useMutation(api.queue.enqueue);
  const cancelQueue = useMutation(api.queue.cancel);
  const heartbeat = useMutation(api.queue.heartbeat);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    stripRoomQuery();
  }, []);

  useEffect(() => {
    if (status?.kind !== "queued") return;
    const beat = () => {
      void heartbeat({ sessionId });
    };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [heartbeat, sessionId, status?.kind]);

  async function startMatchmaking() {
    setStarting(true);
    setError(null);
    try {
      await enqueue({
        sessionId,
        name: getName(),
        emoji: getEmoji(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  if (status === undefined) {
    return (
      <div className="screen center">
        <p className="muted">Connecting…</p>
      </div>
    );
  }

  if (status.kind === "inRoyal") {
    return <Matched emoji={getEmoji()} />;
  }

  if (status.kind === "queued") {
    return (
      <Searching
        name={status.name}
        emoji={status.emoji}
        onCancel={() => {
          void cancelQueue({ sessionId });
        }}
      />
    );
  }

  return (
    <Home
      onStartMatchmaking={() => {
        void startMatchmaking();
      }}
      busy={starting}
      error={error}
    />
  );
}

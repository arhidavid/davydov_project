import { useCallback, useEffect, useState } from "react";
import { Home } from "./components/Home.js";
import { Room } from "./components/Room.js";
import { getSessionId } from "./lib/session.js";

function roomFromUrl(): string | null {
  const code = new URLSearchParams(window.location.search).get("r");
  return code ? code.toUpperCase() : null;
}

export function App() {
  const sessionId = getSessionId();
  const [code, setCode] = useState<string | null>(() => roomFromUrl());

  useEffect(() => {
    const onPop = () => setCode(roomFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const enterRoom = useCallback((next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("r", next);
    window.history.pushState({}, "", url);
    setCode(next);
  }, []);

  const leaveRoom = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("r");
    window.history.pushState({}, "", url);
    setCode(null);
  }, []);

  return code ? (
    <Room code={code} sessionId={sessionId} onLeave={leaveRoom} />
  ) : (
    <Home sessionId={sessionId} onEnter={enterRoom} />
  );
}

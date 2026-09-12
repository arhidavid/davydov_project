import { useEffect, useState } from "react";
import { Home } from "./components/Home.js";
import { Searching } from "./components/Searching.js";
import { getSessionId } from "./lib/session.js";

type Screen = "home" | "searching";

function stripRoomQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("r")) return;
  url.searchParams.delete("r");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function App() {
  // Keep session id allocated on first paint so later slices can enqueue it.
  getSessionId();
  const [screen, setScreen] = useState<Screen>("home");

  useEffect(() => {
    stripRoomQuery();
  }, []);

  if (screen === "searching") {
    return <Searching onCancel={() => setScreen("home")} />;
  }

  return <Home onStartMatchmaking={() => setScreen("searching")} />;
}

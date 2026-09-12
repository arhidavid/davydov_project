/** Hosted Convex the public app already uses (Pages bake of artful-dog-585). */
export const DEFAULT_CONVEX_URL =
  "https://artful-dog-585.eu-west-1.convex.cloud";

export function isAllowedConvexUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname;
    return (
      host.endsWith(".convex.cloud") ||
      host === "127.0.0.1" ||
      host === "localhost"
    );
  } catch {
    return false;
  }
}

/** Query `?convex=` wins for local/emergency retarget. */
export function resolveConvexUrl(
  requestUrl: URL,
  envConvex: string | undefined,
): { url: string; source: "query" | "env" | "default" | "missing" } {
  const fromQuery = requestUrl.searchParams.get("convex")?.trim();
  if (fromQuery && isAllowedConvexUrl(fromQuery)) {
    return { url: fromQuery, source: "query" };
  }

  const fromEnv = envConvex?.trim();
  if (fromEnv && isAllowedConvexUrl(fromEnv)) {
    return { url: fromEnv, source: "env" };
  }

  if (isAllowedConvexUrl(DEFAULT_CONVEX_URL)) {
    return { url: DEFAULT_CONVEX_URL, source: "default" };
  }

  return { url: "", source: "missing" };
}

export function liveClientScript(convexUrl: string): string {
  return `<script type="module">
const CONVEX_URL = ${JSON.stringify(convexUrl)};
const GESTURE_LABEL = {
  rock: "✊ Rock",
  paper: "✋ Paper",
  scissors: "✌️ Scissors",
};

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = String(value);
}

function renderStats(stats) {
  if (!stats) return;
  document.querySelectorAll("[data-live]").forEach((root) => {
    root.setAttribute("data-ready", "true");
  });
  setText("stat-real", stats.realPlayerCount);
  setText("stat-queued", stats.queuedCount);
  setText("stat-in-royal", stats.inRoyalCount);
  setText("stat-alive", stats.aliveCount);
  setText("stat-royals", stats.runningRoyalCount);
  setText("stat-done-royals", stats.completedRoyalCount);
  setText("stat-matches", stats.runningMatchCount);
  setText("stat-picking", stats.pickingMatchCount);
  setText("stat-done-matches", stats.finishedMatchCount);
  setText("stat-throws", stats.throwCount);

  const popular = stats.mostPopularGesture
    ? GESTURE_LABEL[stats.mostPopularGesture] + (stats.popularGestureTied ? " (tie)" : "")
    : "—";
  setText("stat-popular", popular);

  const maxG = Math.max(1, stats.gestureCounts.rock, stats.gestureCounts.paper, stats.gestureCounts.scissors);
  for (const g of ["rock", "paper", "scissors"]) {
    const count = stats.gestureCounts[g];
    setText("count-" + g, count);
    const bar = $("bar-" + g);
    if (bar) bar.style.width = Math.round((count / maxG) * 100) + "%";
  }

  const sizes = $("royal-sizes");
  if (sizes) {
    sizes.textContent = stats.playingRoyalSizes.length
      ? stats.playingRoyalSizes.map((n) => n + "-royal").join(" · ")
      : "none running";
  }

  const preview = $("queue-preview");
  if (preview) {
    preview.replaceChildren();
    for (const row of stats.queuedPreview) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = row.emoji + " " + row.name;
      preview.appendChild(chip);
    }
    if (stats.queuedPreview.length === 0) {
      const empty = document.createElement("span");
      empty.className = "muted";
      empty.textContent = "Queue is empty";
      preview.appendChild(empty);
    }
  }

  const ticker = $("ticker-line");
  if (ticker) {
    ticker.textContent =
      stats.queuedCount + " queued · " +
      stats.realPlayerCount + " real players · " +
      stats.runningMatchCount + " live matches · " +
      popular;
  }
}

async function queryOnce() {
  const res = await fetch(CONVEX_URL.replace(/\\/$/, "") + "/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "stats:live", args: {}, format: "json" }),
  });
  const body = await res.json();
  if (body && body.status === "success") {
    renderStats(body.value);
    return;
  }
  if (body && body.value !== undefined && body.status !== "error") {
    renderStats(body.value);
    return;
  }
  throw new Error(body && (body.errorMessage || body.error) || ("HTTP " + res.status));
}

function startPolling() {
  const tick = () => {
    queryOnce().catch((err) => {
      const el = $("live-error");
      if (el) el.textContent = String(err.message || err);
    });
  };
  tick();
  setInterval(tick, 1500);
}

async function startLive() {
  try {
    const mod = await import("https://esm.sh/convex@1.27.0/browser");
    const client = new mod.ConvexClient(CONVEX_URL);
    client.onUpdate("stats:live", {}, (value) => {
      const el = $("live-error");
      if (el) el.textContent = "";
      renderStats(value);
    });
  } catch (err) {
    startPolling();
    const el = $("live-error");
    if (el) el.textContent = "Polling Convex HTTP (websocket fallback).";
    console.warn(err);
  }
}

startLive();
</script>`;
}

export function renderDashboardPage(opts: {
  target: string;
  targetSource: string;
  convexUrl: string;
  qrSvg: string;
}): string {
  const safeTarget = escapeHtml(opts.target);
  const safeSource = escapeHtml(opts.targetSource);
  const safeConvex = escapeHtml(opts.convexUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>KPM Royale · Live</title>
  <style>
    :root {
      --bg: #0c0d10;
      --fg: #f2f2f0;
      --muted: #8a8b90;
      --panel: #16171d;
      --gold: #e7c27a;
      --line: #2a2c34;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      min-height: 100%;
      background: radial-gradient(120% 80% at 50% 0%, #1a1c24 0%, var(--bg) 55%);
      color: var(--fg);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    }
    body { padding: clamp(1rem, 3vw, 2rem); }
    header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.72rem;
      color: var(--gold);
    }
    h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 650; }
    .tag { color: var(--muted); margin-top: 0.2rem; }
    .layout {
      display: grid;
      grid-template-columns: minmax(220px, 32%) 1fr;
      gap: clamp(1rem, 3vw, 2rem);
      align-items: start;
    }
    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; }
    }
    .qr-card {
      background: #f7f7f4;
      color: #0a0a0a;
      border-radius: 0.4rem;
      padding: 1rem;
    }
    .qr-card svg { display: block; width: 100%; height: auto; }
    .qr-url {
      margin-top: 0.75rem;
      font-size: 0.85rem;
      word-break: break-all;
      color: #444;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 0.4rem;
      padding: 0.9rem 1rem;
    }
    .card .label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
    }
    .card .value {
      font-size: clamp(1.8rem, 5vw, 2.8rem);
      font-variant-numeric: tabular-nums;
      margin-top: 0.2rem;
    }
    .wide { grid-column: 1 / -1; }
    .bars { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 0.7rem; }
    .bar-row { display: grid; grid-template-columns: 7rem 1fr 2.5rem; gap: 0.5rem; align-items: center; }
    .bar-track { height: 0.7rem; background: #23242c; border-radius: 99px; overflow: hidden; }
    .bar-fill { height: 100%; width: 0; background: var(--gold); transition: width 0.35s ease; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.7rem; }
    .chip {
      background: #23242c;
      border-radius: 99px;
      padding: 0.25rem 0.65rem;
      font-size: 0.9rem;
    }
    .muted { color: var(--muted); }
    .error { color: #f0a0a0; min-height: 1.2em; margin-top: 0.75rem; font-size: 0.85rem; }
    a { color: var(--gold); }
    [data-live] .value { opacity: 0.45; }
    [data-live][data-ready="true"] .value { opacity: 1; }
  </style>
</head>
<body>
  <header>
    <div>
      <p class="eyebrow">Convex live · qr.davydov-pr.com/dashboard</p>
      <h1>KPM Royale</h1>
      <p class="tag">Kamen! Papir! Makaze! ✊ ✋ ✌️</p>
    </div>
    <p class="muted"><a href="/">Full-screen QR</a></p>
  </header>
  <div class="layout">
    <aside class="qr-card">
      ${opts.qrSvg}
      <p class="qr-url" data-source="${safeSource}">${safeTarget}</p>
    </aside>
    <section data-live>
      <div class="grid">
        <article class="card"><p class="label">Real players</p><p class="value" id="stat-real">—</p></article>
        <article class="card"><p class="label">In queue</p><p class="value" id="stat-queued">—</p></article>
        <article class="card"><p class="label">In royals</p><p class="value" id="stat-in-royal">—</p></article>
        <article class="card"><p class="label">Still alive</p><p class="value" id="stat-alive">—</p></article>
        <article class="card"><p class="label">Running royals</p><p class="value" id="stat-royals">—</p></article>
        <article class="card"><p class="label">Live matches</p><p class="value" id="stat-matches">—</p></article>
        <article class="card"><p class="label">Picking now</p><p class="value" id="stat-picking">—</p></article>
        <article class="card"><p class="label">Finished matches</p><p class="value" id="stat-done-matches">—</p></article>
        <article class="card"><p class="label">Completed royals</p><p class="value" id="stat-done-royals">—</p></article>
        <article class="card"><p class="label">Revealed throws</p><p class="value" id="stat-throws">—</p></article>
        <article class="card wide">
          <p class="label">Most popular gesture</p>
          <p class="value" id="stat-popular">—</p>
          <div class="bars">
            <div class="bar-row"><span>✊ Rock</span><div class="bar-track"><div class="bar-fill" id="bar-rock"></div></div><span id="count-rock">0</span></div>
            <div class="bar-row"><span>✋ Paper</span><div class="bar-track"><div class="bar-fill" id="bar-paper"></div></div><span id="count-paper">0</span></div>
            <div class="bar-row"><span>✌️ Scissors</span><div class="bar-track"><div class="bar-fill" id="bar-scissors"></div></div><span id="count-scissors">0</span></div>
          </div>
        </article>
        <article class="card wide">
          <p class="label">Queue</p>
          <p class="muted" id="royal-sizes" style="margin-top:0.4rem"></p>
          <div class="chips" id="queue-preview"></div>
        </article>
      </div>
      <p class="error" id="live-error"></p>
      <p class="muted" style="margin-top:0.5rem">Backend <code>${safeConvex}</code> · query <code>stats:live</code></p>
    </section>
  </div>
  ${liveClientScript(opts.convexUrl)}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

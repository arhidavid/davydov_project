import { encode } from "uqr";

/** Resolve the URL the projector QR should open. Query `?url=` wins for emergency retarget. */
export function resolveTargetUrl(
  requestUrl: URL,
  envTarget: string | undefined,
): { target: string; source: "query" | "env" | "missing" } {
  const fromQuery = requestUrl.searchParams.get("url")?.trim();
  if (fromQuery) {
    try {
      const parsed = new URL(fromQuery);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return { target: parsed.toString(), source: "query" };
      }
    } catch {
      // fall through
    }
  }

  const fromEnv = envTarget?.trim();
  if (fromEnv) {
    try {
      const parsed = new URL(fromEnv);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return { target: parsed.toString(), source: "env" };
      }
    } catch {
      // fall through
    }
  }

  return { target: "", source: "missing" };
}

/** Boolean matrix → SVG suitable for a full-bleed projector QR. */
export function qrMatrixToSvg(matrix: boolean[][], sizePx: number): string {
  const n = matrix.length;
  if (n === 0) {
    return "";
  }
  const cell = sizePx / n;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="100%" height="100%" shape-rendering="crispEdges" role="img" aria-label="QR code">`,
  ];
  for (let y = 0; y < n; y++) {
    const row = matrix[y]!;
    for (let x = 0; x < n; x++) {
      if (row[x]) {
        parts.push(
          `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#0a0a0a"/>`,
        );
      }
    }
  }
  parts.push("</svg>");
  return parts.join("");
}

export function renderProjectorPage(target: string, source: string): string {
  const { data } = encode(target, { ecc: "M", border: 2 });
  const svg = qrMatrixToSvg(data, 1024);
  const safeTarget = escapeHtml(target);
  const safeSource = escapeHtml(source);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Scan to join</title>
  <style>
    :root {
      --bg: #0c0d10;
      --fg: #f2f2f0;
      --muted: #8a8b90;
      --panel: #f7f7f4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      background: radial-gradient(120% 80% at 50% 0%, #1a1c24 0%, var(--bg) 55%);
      color: var(--fg);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    }
    main {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: clamp(1rem, 4vw, 2.5rem);
    }
    .stage {
      width: min(92vmin, 920px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(0.75rem, 2.5vmin, 1.5rem);
    }
    .qr {
      width: 100%;
      aspect-ratio: 1;
      background: var(--panel);
      padding: clamp(0.75rem, 2.5vmin, 1.75rem);
      border-radius: 0.35rem;
    }
    .qr svg { display: block; width: 100%; height: 100%; }
    .url {
      max-width: 100%;
      font-size: clamp(0.85rem, 2.2vmin, 1.35rem);
      letter-spacing: 0.02em;
      word-break: break-all;
      text-align: center;
      color: var(--muted);
    }
    .hint {
      font-size: clamp(0.7rem, 1.6vmin, 0.95rem);
      color: #5c5e66;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }
  </style>
</head>
<body>
  <main>
    <div class="stage">
      <p class="hint">Scan to open</p>
      <div class="qr">${svg}</div>
      <p class="url" data-source="${safeSource}">${safeTarget}</p>
    </div>
  </main>
</body>
</html>`;
}

export function renderMissingTargetPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QR target missing</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0c0d10; color: #f2f2f0;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      padding: 2rem; text-align: center;
    }
    code { color: #c8c9d0; }
  </style>
</head>
<body>
  <div>
    <h1>No TARGET_URL</h1>
    <p>Set the Worker var <code>TARGET_URL</code> to the public app URL, or open with <code>?url=https://…</code>.</p>
  </div>
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/target") {
      const resolved = resolveTargetUrl(url, env.TARGET_URL);
      return Response.json(
        {
          url: resolved.target || null,
          source: resolved.source,
        },
        {
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return new Response("Not Found", { status: 404 });
    }

    const resolved = resolveTargetUrl(url, env.TARGET_URL);
    if (!resolved.target) {
      return new Response(renderMissingTargetPage(), {
        status: 503,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    const body = renderProjectorPage(resolved.target, resolved.source);
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};

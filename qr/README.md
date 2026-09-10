# Presenter QR (`qr.davydov-pr.com`)

Projector-only page: a large QR that opens the **hackathon app** URL on phones.

| Host | Role |
| --- | --- |
| `davydov-pr.com` | Personal calling card — **do not touch** |
| `qr.davydov-pr.com` | This Worker — big QR for the stage |
| `app.davydov-pr.com` | Hackathon app (Cloudflare Pages + Convex) — separate deploy |

## Retarget without a rebuild scramble

The QR encodes `TARGET_URL` from the Worker environment (default in `wrangler.jsonc`: `https://app.davydov-pr.com`).

Once the real app URL exists:

```bash
cd qr
npx wrangler secret put TARGET_URL
# paste https://app.davydov-pr.com  (or the Pages *.pages.dev URL)
```

Or set a plain-text var in the Cloudflare dashboard → Worker → Settings → Variables.
Hard-refresh the projector tab. No code change, no `wrangler deploy` required for a URL-only change when using dashboard vars / secrets.

Emergency override (does not persist): `https://qr.davydov-pr.com/?url=https://…`

Check current target: `GET /target` → `{ "url": "…", "source": "env"|"query" }`.

## Local

```bash
cd qr
npm install
npm run dev          # http://127.0.0.1:8787
npm test
```

## Deploy (needs Cloudflare credentials)

Cloud Agents need `CLOUDFLARE_API_TOKEN` (and optionally `CLOUDFLARE_ACCOUNT_ID`).
Desktop: authenticate Cloudflare MCP, or `npx wrangler login`.

```bash
cd qr
npx wrangler deploy
```

`wrangler.jsonc` attaches custom domain `qr.davydov-pr.com` on deploy.

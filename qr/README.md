# Presenter QR (`qr.davydov-pr.com`)

Projector-only page: a large QR that opens the **hackathon app** URL on phones.

**Live:** https://qr.davydov-pr.com (Worker `davydov-qr`). Check target: `GET /target`.

| Host | Role |
| --- | --- |
| `davydov-pr.com` | Personal calling card — **do not touch** |
| `qr.davydov-pr.com` | This Worker — big QR for the stage |
| `app.davydov-pr.com` | Hackathon app (Cloudflare Pages + Convex) — separate deploy |

## Retarget without a rebuild scramble

The QR encodes `TARGET_URL` from the Worker environment (default in `wrangler.jsonc`: `https://app.davydov-pr.com`).

```bash
cd qr
npx wrangler secret put TARGET_URL
# paste https://app.davydov-pr.com  (or https://convex-party.pages.dev)
```

Or set a plain-text var in the Cloudflare dashboard → Worker → Settings → Variables.
Hard-refresh the projector tab. No code change required for a URL-only change when using dashboard vars / secrets.

Emergency override (does not persist): `https://qr.davydov-pr.com/?url=https://…`

## Local

```bash
cd qr
npm install
npm run dev          # http://127.0.0.1:8787
npm test             # or from repo root: npm run qr:test
```

Root `npm test` does **not** run these files. The Worker depends on `uqr`,
which is installed only in `qr/node_modules`.

## Deploy

Needs `CLOUDFLARE_API_TOKEN`. If `CLOUDFLARE_ACCOUNT_ID` is empty, use `9e65f2f645a419770d1f6d770b4bee40` (Bunkmaster).

```bash
cd qr
npx wrangler deploy
# or from repo root:
npm run qr:deploy
```

`wrangler.jsonc` attaches custom domain `qr.davydov-pr.com` on deploy.

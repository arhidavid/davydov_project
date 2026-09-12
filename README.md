# KPM Royale

**Kamen! Papir! Makaze!** ✊ ✋ ✌️ — live matchmade rock-paper-scissors
tournaments on **Convex**. Scan a QR, tap **Start matchmaking**, play a 4 / 8 /
16-player royal on your phone.

This is the Cursor Belgrade Hackathon (Convex category) product. Spec:
[BRAINSTORM.md](./BRAINSTORM.md). Build order:
[IMPLEMENTATION.md](./IMPLEMENTATION.md). Agent context:
[AGENTS.md](./AGENTS.md).

**Current state: Development.** v1 loop (slices 1–8) and public deploy
(slice **9**) are done. Slice **10** is stretch fake players — do not start
unless leftover time.

---

## What it does

1. Open https://app.davydov-pr.com (or scan the stage QR at
   https://qr.davydov-pr.com).
2. Edit your random name + emoji, tap **Start matchmaking**.
3. Convex queues real players. After **4** (and **8**) it waits **20 seconds**,
   then starts the largest exact **4 / 8 / 16**. **16 starts immediately.**
   Leftovers stay in the queue. Odd brackets never start.
4. Each pair plays 3 rounds (10s secret throws). Miss vs pick loses the round.
   Same gesture or both miss is a draw. Extras if tied. Ten draws in a row →
   random match winner.
5. Winners climb. Eliminated players see **you lost**. The champion sees
   **you are a winner**. Both get **Back to main menu**. No spectate, no
   player-created rooms, no join codes.

There are **no AI features**. Identity is anonymous (`sessionId` in
`localStorage`).

### Why this is Convex

Phones subscribe to `queue.myStatus` and `matches.view`. The matchmaker,
10s round close, bracket climb, and 20s disconnect grace are
`internalMutation` + scheduler — not client clocks. For the submission video,
the Convex dashboard should show `queue`, `royals`, `royalPlayers`, `matches`,
and `throws`.

---

## Project context (hackathon)

- **Goal:** win the [Convex](https://www.convex.dev/) category. Judging cares
  about using Convex idioms, a working demo, tests, UI polish, and a public
  URL + QR.
- **Team:** solo developer; agents implement one slice at a time.
- **Phones first.** Audience opens a public URL. No install.
- **Accounts:** Cloudflare, Fly.io, Convex. Hosted project `mike-dav/convex-party`
  (eu-west-1). Cloud Agents have both deploy keys:

  | Env var | Deployment | URL |
  | --- | --- | --- |
  | `CONVEX_DEV_DEPLOY_KEY` | `dev:artful-dog-585` | `https://artful-dog-585.eu-west-1.convex.cloud` |
  | `CONVEX_DEPLOY_KEY` | `prod:rosy-manatee-43` | `https://rosy-manatee-43.eu-west-1.convex.cloud` |

  Dashboard: https://dashboard.convex.dev/t/mike-dav/convex-party/artful-dog-585.
  Use the **prod** key for Cloudflare Pages production Convex pushes. Do not mint another key.

---

## Run it locally (no Convex account needed)

Convex supports **anonymous local development** — it runs the open-source
backend on your machine.

```bash
npm install
npm run dev
```

`npm run dev` runs two things together:
- `convex dev` — local Convex backend; writes `VITE_CONVEX_URL` into `.env.local`
  and hot-pushes `convex/`.
- `vite` — frontend on http://localhost:5173.

Open the URL on a computer and a phone on the same network. Tap **Start
matchmaking** on four clients (or incognito windows) to form a 4-royal after
the 20s gather wait.

> First run downloads the local Convex backend binary. In non-interactive/agent
> shells, prefix with `CONVEX_AGENT_MODE=anonymous` (the Cloud Agent environment
> already does this).

Prefer anonymous `convex dev` while coding so you do not collide with the
shared hosted deployments.

### Useful commands
| Command | Description |
| --- | --- |
| `npm run dev` | Convex backend + Vite frontend together |
| `npm run build` | Type-check and build the frontend (`dist/`) |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Convex function tests (`convex/**`; matchmaker, RPS, bracket, queue, disconnect) |
| `npm run qr:test` | Presenter QR Worker tests (`cd qr && npm install` first) |
| `npm run pages:deploy` | Vite build + Wrangler Pages deploy to `convex-party` |
| `npm run qr:deploy` | Deploy Worker `davydov-qr` + `qr.davydov-pr.com` |
| `npm run deploy` | `convex deploy --cmd 'vite build'` (production Convex; uses `CONVEX_DEPLOY_KEY`) |

---

## Public demo URLs (audience QR path)

Public hosting is live (Cloudflare account `Bunkmaster`, account id
`9e65f2f645a419770d1f6d770b4bee40`):

| URL | Role |
| --- | --- |
| https://app.davydov-pr.com | Hackathon app (Pages project `convex-party`) |
| https://convex-party.pages.dev | Same app (Pages alias) |
| https://qr.davydov-pr.com | Stage projector QR (`TARGET_URL` → app; check `GET /target`) |
| https://davydov-pr.com | Personal site — **do not overwrite** |

Slice 9 (2026-09-12) pushed KPM functions to both hosted Convex deployments.
The live Pages build bakes `VITE_CONVEX_URL` as the **dev** deployment
(`https://artful-dog-585.eu-west-1.convex.cloud`). Prod Convex
(`https://rosy-manatee-43.eu-west-1.convex.cloud`) is in sync; to point the
public app at it, rebuild Pages with that URL (or run `npx convex deploy --cmd
'vite build'` with `CONVEX_DEPLOY_KEY`).

Redeploy from a Cloud Agent (needs `CLOUDFLARE_API_TOKEN`; set
`CLOUDFLARE_ACCOUNT_ID=9e65f2f645a419770d1f6d770b4bee40` if unset):

```bash
npm run pages:deploy   # vite build + wrangler pages deploy
npm run qr:deploy      # Worker + qr.davydov-pr.com custom domain
```

Details for the projector Worker: [qr/README.md](./qr/README.md). Keep the QR
pointing at the **app home**, not a room code.

## Deploying to production (Convex Cloud + Cloudflare Pages)

Hosted Convex is already set up. Keys are minted and verified; do **not** mint another deploy key.

1. **Push Convex functions to prod** with the existing production key:
   ```bash
   CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" npx convex deploy --cmd 'vite build'
   ```
   That command also sets `VITE_CONVEX_URL` for the frontend build from the prod deployment
   (`rosy-manatee-43`). For a **dev** Convex push, use `CONVEX_DEV_DEPLOY_KEY` instead.
2. **Ship the static app** with `npm run pages:deploy`, or prefer Pages CI:
   ```
   npx convex deploy --cmd 'vite build'
   ```
   with output directory `dist` and `CONVEX_DEPLOY_KEY` in Pages secrets (prod Convex).
3. Enable Node.js compatibility if Cloudflare prompts about `node:async_hooks`.
4. Keep custom domains: `app.davydov-pr.com` on Pages, `qr.davydov-pr.com` on the Worker. Leave apex alone.
5. Retarget the stage QR if the app URL changes: `npx wrangler secret put TARGET_URL` in `qr/`.

`convex/_generated/` is committed so `npm run build` and CI work without a running backend.

---

## Layout

```
.
├── convex/                 # Convex backend (schema + reactive functions + tests)
│   ├── schema.ts           # queue, royals, matches, throws, …
│   ├── queue.ts            # enqueue / cancel / heartbeat / myStatus
│   ├── matchmaking.ts      # pop 4 / 8 / 16
│   ├── matches.ts          # 10s secret throws
│   ├── rpsLogic.ts         # miss / draw / win helpers
│   ├── bracket.ts          # winner vs winner
│   ├── disconnect.ts       # 20s grace + forfeit
│   └── _generated/         # committed generated API types
├── qr/                     # Cloudflare Worker → qr.davydov-pr.com (projector QR)
├── src/                    # React + Vite frontend (mobile-first)
│   ├── components/Home.tsx
│   ├── components/Searching.tsx
│   ├── components/Match.tsx
│   └── components/ResultSplash.tsx
├── .cursor/
│   ├── environment.json
│   └── rules/
├── AGENTS.md
├── BRAINSTORM.md
├── IMPLEMENTATION.md
└── package.json
```

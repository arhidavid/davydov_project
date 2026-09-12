# Convex Party

A **real-time multiplayer "rooms" skeleton** built on **Convex + Vite + React (TypeScript)**.
Create a room, share a link/QR code, and everyone who opens it shows up **live** — presence,
a shared synced counter, and floating emoji reactions, all with zero WebSocket code.

This repo is a deliberately generic, pivot-ready base for a hackathon entry (see context below).

The project goal and **current project state** for Cursor agents are in [AGENTS.md](./AGENTS.md).
That file is loaded into every new agent session. The always-apply Cursor rule is
`.cursor/rules/project-goal.mdc`.

**Current state: Development** (owner moved 2026-09-12). Product: **KPM Royale**
(*Kamen! Papir! Makaze!* ✊ ✋ ✌️) — Convex **matchmaking** into live 4/8/16
brackets of **real players**. Spec: [BRAINSTORM.md](./BRAINSTORM.md). Build
order: [IMPLEMENTATION.md](./IMPLEMENTATION.md) (**current slice: 3**). Fake
players only if time after slices 1–8.

---

## Project context (read this first if you're an agent picking this up)

This project exists to **win the Convex category at the Cursor-hosted hackathon in Belgrade on
September 12th**. Key facts and decisions from the kickoff conversation:

- **Goal:** win the category presented by [Convex](https://www.convex.dev/). "Use Convex well"
  is the primary bar; a specific sub-category (multiplayer / viral / startup) is not locked in.
- **Team:** solo developer with a **gamedev background**. Non-core work is delegated to the
  coding agent. The human will decide the concrete product idea/theme **on the spot during the
  hackathon**, so the codebase is built to **pivot fast**.
- **No AI features** are planned — do not add LLM/vector-search functionality unless asked.
- **Distribution requirement:** the product must be **instantly usable on any phone via a public
  URL** (open a link / scan a QR code, no install). Mobile-first is a hard requirement.
- **Accounts available:** Cloudflare, Fly.io, and Convex. Hosted project is `mike-dav/convex-party`
  (eu-west-1). Cloud Agents already have **both** deploy keys (verified 2026-09-10):

  | Env var | Deployment | URL |
  | --- | --- | --- |
  | `CONVEX_DEV_DEPLOY_KEY` | `dev:artful-dog-585` | `https://artful-dog-585.eu-west-1.convex.cloud` |
  | `CONVEX_DEPLOY_KEY` | `prod:rosy-manatee-43` | `https://rosy-manatee-43.eu-west-1.convex.cloud` |

  Dashboard: https://dashboard.convex.dev/t/mike-dav/convex-party/artful-dog-585.
  Use the **prod** key for Cloudflare Pages production Convex pushes. Do not mint another key.

### How Convex judging shapes the design
Convex hackathons consistently score on: *It's Convex* (uses Convex idioms + shows the Convex
**dashboard** in the demo video), *It works*, *It's solid* (tested & documented), *UI/UX polish*,
*product creativity*, and **bonus points for social virality**. Submissions need a **public
deployed URL**, a **public repo**, and a **≤3-minute video** showing the app *and* the dashboard.
Convex's superpower is **reactive queries** (real-time/multiplayer with no subscription
boilerplate), so this skeleton leans into a live, multiplayer, phone-shareable experience.

### Chosen stack & why
- **Backend: Convex** (the category requirement; reactive queries/mutations, no server to run).
- **Frontend: React + Vite + TypeScript**, mobile-first SPA using the Convex React client.
- **Hosting plan: Cloudflare Pages** at `app.davydov-pr.com` for the static frontend + **Convex Cloud**
  for the backend; **Worker** at `qr.davydov-pr.com` for the stage QR (`qr/` — retarget via
  `TARGET_URL`). Apex `davydov-pr.com` is the personal calling card and must not be overwritten.
  Fly.io is unused unless Cloudflare is not viable.

---

## What's in the skeleton

Reusable real-time primitives you can repurpose for almost any party/game/poll idea:

| Primitive | Where | What it demonstrates |
| --- | --- | --- |
| **Rooms** (join by 4-char code / link / QR) | `convex/rooms.ts` | Creating + looking up shared spaces |
| **Presence** (who's here, heartbeated) | `convex/presence.ts` | Live roster that updates as people come/go |
| **Shared state** (a synced tap counter) | `convex/rooms.ts` (`tap`) | Reactive state every client mutates + watches |
| **Live reactions** (floating emoji feed) | `convex/reactions.ts` | Ephemeral real-time event stream |

Frontend: `src/App.tsx` (routing via `?r=CODE`), `src/components/Home.tsx` (identity + create/join),
`src/components/Room.tsx` (the live room), `src/components/EmojiFountain.tsx` (animation),
`src/lib/session.ts` (anonymous per-device identity in `localStorage`).

### How to pivot it
Swap the "tap counter + reactions" for your actual mechanic (trivia questions, poll options, a
shared drawing, game state, buzzer, etc.). Keep `rooms` + `presence` as-is — they're the parts
every multiplayer idea needs. Add tables/functions in `convex/`, and the reactive `useQuery`
hooks in the UI update automatically.

---

## Run it locally (no Convex account needed)

Convex supports **anonymous local development** — it runs the open-source backend on your machine,
so you can build and demo real-time sync before anyone creates an account.

```bash
npm install
npm run dev
```

`npm run dev` runs two things together:
- `convex dev` — the local Convex backend; it writes `VITE_CONVEX_URL` into `.env.local` and
  hot-pushes any change in `convex/`.
- `vite` — the frontend on http://localhost:5173.

Open the URL on your computer and your phone (same network) — create a room on one, join on the
other, and watch presence/taps/reactions sync instantly.

> First run downloads the local Convex backend binary. In non-interactive/agent shells, prefix
> with `CONVEX_AGENT_MODE=anonymous` (the Cloud Agent environment already does this).

Cloud Agents can also talk to hosted Convex without logging in: `CONVEX_DEV_DEPLOY_KEY` for
`artful-dog-585`, `CONVEX_DEPLOY_KEY` for `rosy-manatee-43`. Prefer anonymous `convex dev` while
coding so you do not collide with the shared hosted deployments.

### Useful commands
| Command | Description |
| --- | --- |
| `npm run dev` | Convex backend + Vite frontend together |
| `npm run build` | Type-check and build the frontend (`dist/`) |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Convex function tests only (`convex/**`; does not load `qr/`) |
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

The live Pages build currently bakes `VITE_CONVEX_URL` as the **dev** deployment
(`https://artful-dog-585.eu-west-1.convex.cloud`). That is fine until you promote. To point the
public app at prod Convex, rebuild Pages with
`VITE_CONVEX_URL=https://rosy-manatee-43.eu-west-1.convex.cloud` (or run `npx convex deploy --cmd
'vite build'` with `CONVEX_DEPLOY_KEY`).

Redeploy from a Cloud Agent (needs `CLOUDFLARE_API_TOKEN`; set
`CLOUDFLARE_ACCOUNT_ID=9e65f2f645a419770d1f6d770b4bee40` if unset):

```bash
npm run pages:deploy   # vite build + wrangler pages deploy
npm run qr:deploy      # Worker + qr.davydov-pr.com custom domain
```

Details for the projector Worker: [qr/README.md](./qr/README.md).

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
│   ├── schema.ts
│   ├── rooms.ts            # create / get / tap (shared state)
│   ├── presence.ts         # join / heartbeat / list
│   ├── reactions.ts        # send / recent (live feed)
│   ├── rooms.test.ts       # convex-test suite
│   └── _generated/         # committed generated API types
├── qr/                     # Cloudflare Worker → qr.davydov-pr.com (projector QR)
├── src/                    # React + Vite frontend (mobile-first)
├── .cursor/
│   ├── environment.json    # Cloud Agent env (Convex local + Vite terminals)
│   └── rules/project-goal.mdc  # Always-apply: follow AGENTS.md
├── AGENTS.md               # Hackathon goal + current project state for agents
├── BRAINSTORM.md           # Locked KPM Royale spec
├── IMPLEMENTATION.md       # Build slices (current slice lives here)
└── package.json
```

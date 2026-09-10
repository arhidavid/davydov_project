# Convex Party

A **real-time multiplayer "rooms" skeleton** built on **Convex + Vite + React (TypeScript)**.
Create a room, share a link/QR code, and everyone who opens it shows up **live** — presence,
a shared synced counter, and floating emoji reactions, all with zero WebSocket code.

This repo is a deliberately generic, pivot-ready base for a hackathon entry (see context below).

The project goal and **current project state** for Cursor agents are in [AGENTS.md](./AGENTS.md).
That file is loaded into every new agent session. The always-apply Cursor rule is
`.cursor/rules/project-goal.mdc`.

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
- **Accounts available:** Cloudflare, Fly.io, and Convex. Hosted project is `mike-dav/convex-party` (`artful-dog-585`, eu-west-1). Cloud Agents have a **dev** `CONVEX_DEPLOY_KEY` for `dev/mike-dav`. Mint a **production** deploy key before Cloudflare Pages production deploys.

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
- **Hosting plan: Cloudflare Pages** for the static frontend + **Convex Cloud** for the backend.
  Fly.io is intentionally unused — Convex removes the need for a self-hosted server.

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

### Useful commands
| Command | Description |
| --- | --- |
| `npm run dev` | Convex backend + Vite frontend together |
| `npm run build` | Type-check and build the frontend (`dist/`) |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Convex function tests (Vitest + `convex-test`) |
| `npm run deploy` | `convex deploy --cmd 'vite build'` (production; needs a deploy key) |

---

## Deploying to production (Convex Cloud + Cloudflare Pages)

This is the path to the **public phone-shareable URL** for the submission. The Convex Cloud
project already exists (`mike-dav/convex-party`, deployment `artful-dog-585`). Cloud Agents
currently hold a **dev** `CONVEX_DEPLOY_KEY` (targets `dev/mike-dav`). Production hosting still
needs a **prod** deploy key:

1. **Mint a production deploy key** in the Convex dashboard (Project → Settings → Deploy keys).
   In the Cloud Agent, replace or add it as a secret named `CONVEX_DEPLOY_KEY` (see Secrets panel).
2. **Cloudflare Pages:** connect this repo. Set the build command to:
   ```
   npx convex deploy --cmd 'vite build'
   ```
   and output directory `dist`. Add `CONVEX_DEPLOY_KEY` as a **Secret** env var (separately for
   Production and Preview). `convex deploy` sets `VITE_CONVEX_URL` for the build automatically and
   pushes `convex/` to the matching Convex deployment.
3. Enable Node.js compatibility if Cloudflare prompts about `node:async_hooks`.

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
│   └── _generated/         # committed generated API/types
├── src/                    # React + Vite frontend (mobile-first)
├── .cursor/
│   ├── environment.json    # Cloud Agent env (Convex local + Vite terminals)
│   └── rules/project-goal.mdc  # Always-apply: follow AGENTS.md
├── AGENTS.md               # Hackathon goal + current project state for agents
└── package.json
```

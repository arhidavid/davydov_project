# Convex Party (davydov-project)

This is a **Cursor Belgrade Hackathon** project (Grok Bot Serbia Hackathon, 12 September 2026).
The category to win is [Convex](https://www.convex.dev/).

The product is **Rock, Paper, Scissors Royal**: live matchmade tournaments on
Convex (brackets of 4 / 8 / 16). Players do **not** create or join rooms.
Details and stretch (fake players) are in [BRAINSTORM.md](./BRAINSTORM.md).
A rooms skeleton already lives in this repo (Convex + Vite + React). Do not
replace it with a different backend.

## Project state

**Current state: Brainstorming**

The owner changes state. When it changes, update **Current state** in this file immediately so later agents inherit it.

| State | Starts when | Agents do |
| --- | --- | --- |
| **Preparing for hackathon** | (done) | Close the [preparation exit criteria](#leaving-preparation). Do not invent the product or start building the app. |
| **Awaiting hackathon day** | (done) Owner confirmed 2026-09-10; all preparation criteria met | Hold. No product work until hackathon day. When the owner says we are starting and gives the theme, move to **Brainstorming**. |
| **Brainstorming** | (now) Owner started hackathon day 2026-09-12 | Propose and refine **game** ideas. Do not implement until the idea is locked. |
| **Development** | Idea is locked in | Build and deploy. The product **must include and use the Convex service**. Public demo URL + presenter QR code. |
| **Project finished** | Development and deploy are complete | Stop building unless the owner asks for a change. |

When the idea is locked, write it into this file (who it is for, what it does) so later agents inherit it.

## Product direction (Brainstorming — idea chosen, not building yet)

Owner plan on 2026-09-12. **Do not implement** until state moves to **Development**.

| Locked | Still open (defaults in BRAINSTORM.md) |
| --- | --- |
| **RPS Royal** — live tournament, not async. | Queue window vs instant start at 4. |
| **Server-side matchmaking.** No player create/join rooms or join codes. | How fake players pad (4 vs 8 vs 16). |
| Brackets of **4, 8, or 16** only. Odd starts **impossible**. | Sudden-death on 3-round ties. |
| Pairs play **3 rapid rounds**; **10 seconds** to pick. Winner vs winner. | Champion splash vs instant home. |
| **Losers boot** to a start screen with one button: **Start matchmaking**. No spectate. | Display name / emoji on first visit. |
| **Fake players** = stretch, not v1. Convex backend. No AI, no accounts. | Art / final name. |

**Who it is for:** hackathon audience + judges on phones; a presenter with a projector QR.

**What it does:** scan/open the app, tap **Start matchmaking**. Convex queues
players and starts a 4/8/16 royal, pairs them, runs 10s RPS rounds, winners
climb, losers land back on the same button.

Details: [BRAINSTORM.md](./BRAINSTORM.md).

## Leaving preparation

Preparation is **complete** (owner confirmed move to **Awaiting hackathon day** on 2026-09-10). Kept below as the historical checklist — all items were true before the move.

- [x] **Agent context** — `AGENTS.md` and the always-apply project rule are on the default branch, so every new agent loads goal and state.
- [x] **Convex app in the repo** — React + Vite + Convex is merged, not only on a feature branch. The rooms / presence / reactions skeleton is on `main`.
- [x] **Cloud Agents can run it** — a new agent can install and start Vite plus a Convex backend without extra setup (see `.cursor/environment.json`).
- [x] **Convex path is proven** — a query and a mutation round-trip in the running app (the starter sample is enough). Rooms, presence, taps, and reactions do this; `npm test` covers the Convex functions.
- [x] **Convex service is ready** — hosted Convex project `mike-dav/convex-party` exists. Cloud Agents have both deploy keys, verified 2026-09-10: `CONVEX_DEV_DEPLOY_KEY` → `dev:artful-dog-585` (`https://artful-dog-585.eu-west-1.convex.cloud`); `CONVEX_DEPLOY_KEY` → `prod:rosy-manatee-43` (`https://rosy-manatee-43.eu-west-1.convex.cloud`). Each passed `npx convex env list`, `function-spec`, and a `rooms:create` / `rooms:get` round-trip. Dashboard: https://dashboard.convex.dev/t/mike-dav/convex-party/artful-dog-585. Use the prod key for Cloudflare Pages production Convex pushes.
- [x] **Audience QR** — public demo + stage QR are live. Hosting layout (locked): `davydov-pr.com` = personal calling card (**leave alone**); **`qr.davydov-pr.com`** = projector QR Worker (`davydov-qr`, retarget via `TARGET_URL` / `?url=`); **`app.davydov-pr.com`** = Cloudflare Pages project `convex-party` (also `https://convex-party.pages.dev`) wired to hosted Convex `artful-dog-585`. Verified: Worker deploy + custom domain, Pages deploy + `app` CNAME, `GET https://qr.davydov-pr.com/target` → `https://app.davydov-pr.com/`, public app HTML over HTTPS. Cloud Agents use `CLOUDFLARE_API_TOKEN` (account `Bunkmaster` / `9e65f2f645a419770d1f6d770b4bee40`). Redeploy: `npm run qr:deploy`, `npm run pages:deploy`. **Note:** Pages currently points at the **dev** Convex URL (`artful-dog-585`); switch build env to `https://rosy-manatee-43.eu-west-1.convex.cloud` when promoting to prod.

## Goal

Ship a **demo-ready product in one day**, built with Cursor agents.

**The final project must include and use Convex.** Convex is not optional setup and not a local-only convenience. The shipped product must use the Convex service as its backend: database, server functions, and realtime. Do not add a competing backend. Do not ship a UI that could work without Convex. The intended frontend is React + Vite.

**The live demo must be reachable from the audience.** During the demonstration, show a QR code on the presenter screen that leads to the public web page running our demo. Phones in the room should open the real app, not a laptop-only URL. Fly.io and Cloudflare are the approved options for that public URL (the owner has accounts). Convex stays the backend; Fly/Cloudflare make the frontend reachable. Hosting plan: **Cloudflare Pages** at `app.davydov-pr.com` for the static frontend + **Convex Cloud** for the backend; **Worker** at `qr.davydov-pr.com` for the stage QR (retarget with `TARGET_URL`). Apex `davydov-pr.com` stays the personal site. Fly.io is unused unless Cloudflare is not viable.

**How Convex judging shapes the design.** Convex hackathons consistently score on: *It's Convex* (uses Convex idioms + shows the Convex **dashboard** in the demo video), *It works*, *It's solid* (tested & documented), *UI/UX polish*, *product creativity*, and **bonus points for social virality**. Submissions need a **public deployed URL**, a **public repo**, and a **≤3-minute video** showing the app *and* the dashboard.

**Constraints from kickoff:**
- Team is a solo developer with a gamedev background. Non-core work is delegated to the coding agent. The human will decide the concrete product idea/theme **on the spot during the hackathon**, so the codebase is built to **pivot fast**.
- **No AI features** are planned — do not add LLM/vector-search functionality unless asked.
- The product must be **instantly usable on any phone via a public URL** (open a link / scan a QR code, no install). Mobile-first is a hard requirement.

Every task in this repo is work toward that hackathon demo. Before changing architecture, adding libraries, or expanding scope, ask: does this help us ship a product that **uses Convex on demo day** and that the audience can open from a QR code?

## How to work

- Keep this goal **and the current project state** in mind for the whole task.
- Stay in the current state. Do not skip ahead (for example: do not implement until the idea is locked).
- While **Brainstorming**, propose and refine app ideas. Do not implement until the owner locks the idea and moves the project to **Development**.
- Prefer small, shippable slices over large rewrites.
- Wire features through Convex (queries, mutations, live data). Local `convex dev` is for development; the destination is a product running on Convex.
- If a hosted Convex, Fly.io, or Cloudflare deployment needs credentials, ask the owner — do not drop Convex or substitute another backend.
- Treat the owner's request as a slice of this product, not as a greenfield repo with no purpose.
- Pivot by swapping the tap-counter / create-join-room UX for **matchmaking +
  RPS royals**. Keep Convex; reuse presence **inside** a royal if needed.

## Layout (for agents)

See [README.md](./README.md) for run/deploy commands. Product notebook:
[BRAINSTORM.md](./BRAINSTORM.md). Short map:

- `convex/schema.ts`, `convex/rooms.ts`, `convex/presence.ts`, `convex/reactions.ts` — backend
- `convex/rooms.test.ts` — Convex function tests (`npm test`)
- `src/components/Home.tsx`, `src/components/Room.tsx` — frontend
- `qr/` — Cloudflare Worker for `qr.davydov-pr.com` (projector QR; env-retargetable)
- `.cursor/environment.json` — Cloud Agent install + Convex/Vite terminals
- `.cursor/rules/project-goal.mdc` — always-apply reminder of this file

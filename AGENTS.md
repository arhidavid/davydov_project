# Convex Party (davydov-project)

This is a **Cursor Belgrade Hackathon** project (Grok Bot Serbia Hackathon, 12 September 2026).
The category to win is [Convex](https://www.convex.dev/).

The product idea/theme is **not locked**. A pivot-ready real-time rooms skeleton already lives
in this repo (Convex + Vite + React). Do not replace it with a different backend.

## Project state

**Current state: Preparing for hackathon**

The owner changes state. When it changes, update **Current state** in this file immediately so later agents inherit it.

| State | Starts when | Agents do |
| --- | --- | --- |
| **Preparing for hackathon** | (now) | Close the [preparation exit criteria](#leaving-preparation). Do not invent the product or start building the app. |
| **Awaiting hackathon day** | Owner confirms **and** every preparation criterion is met | Hold. No product work until hackathon day. |
| **Brainstorming** | Owner says we are starting and gives the theme | Propose and refine app ideas. Do not implement until the idea is locked. |
| **Development** | Idea is locked in | Build and deploy. The product **must include and use the Convex service**. Public demo URL + presenter QR code. |
| **Project finished** | Development and deploy are complete | Stop building unless the owner asks for a change. |

When the idea is locked, write it into this file (who it is for, what it does) so later agents inherit it.

## Leaving preparation

Do not move to **Awaiting hackathon day** until **every** item below is true. The owner still confirms the move. If asked to leave preparation while anything is open, report what is missing and stay in **Preparing for hackathon**.

Work in this state is only toward closing this list. When a criterion is done, check its box here so later agents see what is still open.

- [x] **Agent context** — `AGENTS.md` and the always-apply project rule are on the default branch, so every new agent loads goal and state.
- [x] **Convex app in the repo** — React + Vite + Convex is merged, not only on a feature branch. The rooms / presence / reactions skeleton is on `main`.
- [x] **Cloud Agents can run it** — a new agent can install and start Vite plus a Convex backend without extra setup (see `.cursor/environment.json`).
- [x] **Convex path is proven** — a query and a mutation round-trip in the running app (the starter sample is enough). Rooms, presence, taps, and reactions do this; `npm test` covers the Convex functions.
- [x] **Convex service is ready** — hosted Convex project `mike-dav/convex-party` exists (`artful-dog-585`, eu-west-1). Cloud Agents have `CONVEX_DEPLOY_KEY` (a **dev** key for `dev/mike-dav`). Verified: `npx convex env list`, `function-spec`, and a `rooms:create` / `rooms:get` round-trip against `https://artful-dog-585.eu-west-1.convex.cloud`. Dashboard: https://dashboard.convex.dev/t/mike-dav/convex-party/artful-dog-585. **Caveat:** this is a development deploy key, not a production (`prod:`) key — mint a prod key before Cloudflare Pages production deploys.
- [ ] **Audience QR** — we can put the demo on a **public URL** and, during the presentation, display a QR code that opens that page on phones in the audience. Localhost and Cloud Agent preview URLs do not count. The owner has **Fly.io** and **Cloudflare** accounts; use those for public hosting and DNS if needed. Ask the owner for tokens/secrets rather than inventing another host.

## Goal

Ship a **demo-ready product in one day**, built with Cursor agents.

**The final project must include and use Convex.** Convex is not optional setup and not a local-only convenience. The shipped product must use the Convex service as its backend: database, server functions, and realtime. Do not add a competing backend. Do not ship a UI that could work without Convex. The intended frontend is React + Vite.

**The live demo must be reachable from the audience.** During the demonstration, show a QR code on the presenter screen that leads to the public web page running our demo. Phones in the room should open the real app, not a laptop-only URL. Fly.io and Cloudflare are the approved options for that public URL (the owner has accounts). Convex stays the backend; Fly/Cloudflare make the frontend reachable. Hosting plan: **Cloudflare Pages** for the static frontend + **Convex Cloud** for the backend. Fly.io is unused unless Cloudflare is not viable.

**How Convex judging shapes the design.** Convex hackathons consistently score on: *It's Convex* (uses Convex idioms + shows the Convex **dashboard** in the demo video), *It works*, *It's solid* (tested & documented), *UI/UX polish*, *product creativity*, and **bonus points for social virality**. Submissions need a **public deployed URL**, a **public repo**, and a **≤3-minute video** showing the app *and* the dashboard.

**Constraints from kickoff:**
- Team is a solo developer with a gamedev background. Non-core work is delegated to the coding agent. The human will decide the concrete product idea/theme **on the spot during the hackathon**, so the codebase is built to **pivot fast**.
- **No AI features** are planned — do not add LLM/vector-search functionality unless asked.
- The product must be **instantly usable on any phone via a public URL** (open a link / scan a QR code, no install). Mobile-first is a hard requirement.

Every task in this repo is work toward that hackathon demo. Before changing architecture, adding libraries, or expanding scope, ask: does this help us ship a product that **uses Convex on demo day** and that the audience can open from a QR code?

## How to work

- Keep this goal **and the current project state** in mind for the whole task.
- Stay in the current state. Do not skip ahead (for example: do not brainstorm or build the app while still preparing).
- While **Preparing for hackathon**, only work that closes the preparation exit criteria.
- Prefer small, shippable slices over large rewrites.
- Wire features through Convex (queries, mutations, live data). Local `convex dev` is for development; the destination is a product running on Convex.
- If a hosted Convex, Fly.io, or Cloudflare deployment needs credentials, ask the owner — do not drop Convex or substitute another backend.
- Treat the owner's request as a slice of this product, not as a greenfield repo with no purpose.
- Pivot by swapping the tap-counter / reactions mechanic. Keep `rooms` + `presence` — they are the parts every multiplayer idea needs.

## Layout (for agents)

See [README.md](./README.md) for run/deploy commands. Short map:

- `convex/schema.ts`, `convex/rooms.ts`, `convex/presence.ts`, `convex/reactions.ts` — backend
- `convex/rooms.test.ts` — Convex function tests (`npm test`)
- `src/components/Home.tsx`, `src/components/Room.tsx` — frontend
- `.cursor/environment.json` — Cloud Agent install + Convex/Vite terminals
- `.cursor/rules/project-goal.mdc` — always-apply reminder of this file

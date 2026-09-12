# Implementation slices: KPM Royale

**Project state: Development.** Spec is locked in [BRAINSTORM.md](./BRAINSTORM.md).
This file is the **build order**. Do not implement a later slice until the
previous **required** slices are done (see [Dependencies](#dependencies)).

**Current slice: 8** — Polish. Slice 7 is done. Update this line and the
table in [AGENTS.md](./AGENTS.md) when a slice lands on `main`.

v1 = slices **1–8**. Slice **9** is deploy. Slice **10** is stretch (fake
players) — **do not start** until 1–8 work on phones.

## How to take a slice

1. **Fetch first.** Cloud Agent checkouts lag. `git fetch origin main`, then
   read **Current slice** from `origin/main` (and merged PRs). Do not implement
   from a snapshot that still says an older slice. Rule:
   `.cursor/rules/fetch-latest-main.mdc`.
2. Read [BRAINSTORM.md](./BRAINSTORM.md) (rules) + this file (scope).
3. Implement **only** this slice’s files and acceptance checks.
4. Rules live in **Convex** (mutations + `internalMutation` + scheduler). The
   client sends `enqueue` / `cancel` / `throw` / heartbeats and **subscribes**.
5. No Convex Auth — keep anonymous `sessionId` from `src/lib/session.ts`.
6. No `Date.now()` inside **queries**. Pass time in or use scheduled jobs that
   write phase fields (`picking` → `revealed`, `searching` → `inRoyal`).
7. Add `convex-test` coverage for every new public/internal function.
8. Mobile-first. QR still opens the **app home**, not `?r=CODE`.
9. When the slice is merged, mark it `[x]` here and bump **Current slice**.

## Dependencies

```
1 Home shell ──► 2 Queue ──► 3 Matchmaker ──► 4 Round engine
                                      │              │
                                      ▼              ▼
                                 6 Match UI ◄── 5 Bracket + splashes
                                                      │
                                                      ▼
                                                 7 Disconnect
                                                      │
                                                      ▼
                                            8 Polish + tests
                                                      │
                                                      ▼
                                                 9 Deploy
                                                      │
                                                      ▼
                                              10 Fake players (stretch)
```

Slices **1** and **2** can start in parallel if two agents coordinate on the
home button wiring. After that, stay sequential.

## Shared data model (use this; do not invent a second one)

Keep existing `rooms` / `players` / `reactions` tables until slice 8 so the
skeleton still typechecks. **Do not** build the product on `rooms.create` or
`?r=CODE`. New tables:

| Table | Role |
| --- | --- |
| `queue` | Humans waiting to be matchmade |
| `royals` | One 4/8/16 tournament |
| `royalPlayers` | Seat in a royal (alive / eliminated / champion) |
| `matches` | One pair in one bracket round |
| `throws` | Secret pick for one round of one match |

Suggested fields (adjust names, not the relationships):

- **queue:** `sessionId`, `name`, `emoji`, `joinedAt`, `lastSeen`. Unique by
  `sessionId`. Index `by_joinedAt` for FIFO pop.
- **royals:** `size` (`4` \| `8` \| `16`), `status` (`playing` \| `complete`),
  `startedAt`, `championSessionId` (optional until the final).
- **royalPlayers:** `royalId`, `sessionId`, `name`, `emoji`, `status`
  (`alive` \| `eliminated` \| `champion`), `lastSeen`, `disconnectGraceEndsAt`
  (optional). Indexes: `by_royal`, `by_session`.
- **matches:** `royalId`, `roundSize` (16 / 8 / 4 / 2), `slot`, `playerA`,
  `playerB` (`sessionId`s), `scoreA`, `scoreB`, `phase` (`picking` \|
  `revealed` \| `done`), `roundIndex` (1-based), `drawStreak`,
  `winnerSessionId`, `pickDeadline`. Indexes: `by_royal`, `by_royal_and_phase`.
- **throws:** `matchId`, `roundIndex`, `sessionId`, `gesture`
  (`rock` \| `paper` \| `scissors`). Index `by_match_round`. **Never** return
  the opponent’s gesture from a query until `phase !== "picking"` (or the
  viewer is resolving after the scheduled close).

Public mutations stay thin: validate args, call shared TS helpers. Schedule
only `internal.*` functions.

Timers (lock these constants; do not “tune” them):

| Constant | Value |
| --- | --- |
| Gather after 4 queued | 20s, then another 20s if 8 is reached |
| 16 queued | start immediately |
| Pick window | 10s |
| Reconnect grace | 20s |
| Match | 3 scoring rounds; extras if tied; 10-draw streak → random winner |

---

## Slice 1 — Home + identity (drop room UX)

**Status:** done.

**Demo after this:** scan/open the app, see **KPM Royale** / **Kamen! Papir!
Makaze! ✊ ✋ ✌️**, edit name + emoji, tap **Start matchmaking** (may no-op or
navigate to a “Searching…” stub). No create/join, no room code, no tap counter.

**Touch:** `src/components/Home.tsx`, `src/App.tsx`, `src/styles.css` (as
needed), stop routing on `?r=CODE` as the product. Reuse `src/lib/session.ts`
(already random + editable persist).

**Do not:** add `queue` schema yet (unless slice 2 is in the same PR), fake
players, or keep “Create room / Join” on the home screen.

**Done when:**

- Title/tagline locked copy; buttons **English**.
- Identity change persists across reload (`localStorage`).
- Home has **Start matchmaking**; create/join UI is gone.
- Still mobile-usable at phone width.

---

## Slice 2 — Matchmaking queue (Convex)

**Demo after this:** two phones tap Start → both see **Searching…** + **Cancel**;
Convex dashboard table `queue` grows; Cancel returns to the menu and deletes
the row. Queue does **not** start a royal yet.

**Touch:** `convex/schema.ts` (`queue`), `convex/matchmaking.ts` (or
`convex/queue.ts`), tests, Home searching state.

**API (minimum):**

- `enqueue({ sessionId, name, emoji })`
- `cancel({ sessionId })`
- `heartbeat({ sessionId })` (keep `lastSeen` fresh)
- `myStatus({ sessionId })` → `{ kind: "idle" } \| { kind: "queued", ... }`
  (no `Date.now()` in the query)

**Done when:** `npm test` covers enqueue, duplicate session upsert, cancel.
Searching UI has **Cancel**. Late “start” from a second tab for the same
`sessionId` does not create two queue rows.

---

## Slice 3 — Matchmaker pops 4 / 8 / 16

**Status:** done.

**Demo after this:** N queued humans become a `royals` row + `royalPlayers` +
first-round `matches`. Leftovers stay in `queue`. Dashboard shows the bracket
seats. Phones’ `myStatus` becomes `{ kind: "inRoyal", royalId, matchId }`.
Pairs do not need to throw yet.

**Touch:** schema (`royals`, `royalPlayers`, `matches`), internal matchmaker,
scheduler on enqueue:

- count ≥ 16 → `internal` start **now**, pop 16 FIFO, leftovers stay queued.
- count == 4 → schedule try-start in **20s**.
- count == 8 → schedule try-start in **20s** (replace/extend the 4-wait).
- On fire: start **largest exact** 4/8/16; never odd; never 2/3/5/….
- New enqueue never joins a royal that already `playing`.

**Done when:** tests for 4-after-wait, 8-after-second-wait, 16-immediate, 17+
pops 16, 1–3 never start, 5–7 do not start an 8 in v1. Pairing is deterministic
enough to test (e.g. FIFO seats 0–1, 2–3, …).

---

## Slice 4 — Round engine (secret throws)

**Status:** done.

**Demo after this:** in a live match, both players pick ✊/✋/✌️ within 10s;
opponent pick is hidden until both committed **or** the scheduled close;
scores update; draws and miss rules match the spec.

**Touch:** `convex/matches.ts`, `convex/rpsLogic.ts`, `throws` table. Public
mutation is `submitThrow` (`throw` is reserved in JS). Matchmaker calls
`internal.armPicking` so `closeRound` is scheduled at `pickDeadline`. After
reveal, `internal.beginNextRound` starts the next 10s window (slice 6 will
call this after showing gestures).

**Rules to encode in helpers (unit-test these):**

- One miss + one pick → miss **loses the round**.
- Both miss **or** same gesture → draw, no point, `drawStreak++`.
- Decisive round → `drawStreak = 0`, increment winner score.
- After 3 rounds, if scores unequal → match `done`.
- If tied after 3 → extra rounds until a winner.
- `drawStreak === 10` → random `winnerSessionId` (seeded/testable).

**Done when:** tests cover miss/draw/win/extras/10-draw. Queries never leak
the opponent gesture during `picking`. Scheduler, not client clock, closes
the window.

---

## Slice 5 — Bracket climb + result splashes (data)

**Status:** done.

**Demo after this:** when a match `done`, loser `royalPlayers.status =
eliminated`, winner waits; when all matches in the round are `done`, create
the next round’s pairs (winner vs winner); last match winner → royal
`complete`, champion session set. `myStatus` returns `lost` or `winner` so
the UI can splash without spectating.

**Touch:** internal `onMatchComplete`, next-round pairing, status query.

**Done when:** tests for a **4**-player royal (two semis + final) without a
UI. Eliminated players are **not** subscribed into other matches. No spectator
list API.

---

## Slice 6 — Match UI (phone)

**Status:** done.

**Demo after this:** full on-device loop for a 4-royal (use four browsers /
incognito): searching → vs screen → 10s buttons → reveal → next pair or
splash **you lost** / **you are a winner** → **Back to main menu**.

**Touch:** replace `Room.tsx` product path with screens such as `Searching`,
`Match`, `Waiting`, `ResultSplash`. Mobile-first, big throw buttons.

Copy (locked): **Start matchmaking**, **Cancel**, **you lost**, **you are a
winner**, **Back to main menu**. Title/tagline Serbian as in the spec.

**Done when:** a 4-player royal can be played without opening the dashboard.
Back to menu returns to slice 1 home and does not leave a stale queue row.

---

## Slice 7 — Disconnect / reconnect

**Status:** done.

**Demo after this:** close a phone mid-match → 20s grace (match waits) →
reconnect with the same `sessionId` continues; if grace ends, **leaver
loses**; if **both** gone at grace end, **random advance**, the other is
eliminated (`you lost`).

**Touch:** heartbeat on `royalPlayers`, `disconnectGraceEndsAt`, scheduled
`internal` forfeit. Searching disconnect = cancel (drop from queue).

**Done when:** tests for one-leaver forfeit, both-gone random advance,
reconnect within 20s. Splash for the leaver is **you lost**.

---

## Slice 8 — Polish, tests, retire skeleton loop

**Demo after this:** app looks like a party game, not a rooms demo. README
describes KPM Royale. Skeleton tap/reactions/create-join are gone from the
**product path** (delete or stop exporting unused UI). Convex dashboard still
shows queue / royals / matches / throws for the submission video.

**Touch:** CSS polish, README, drop dead `Home`/`Room` room UX, keep QR
worker as-is. Expand `npm test` for matchmaker + RPS + bracket.

**Done when:** `npm test`, `npm run typecheck`, `npm run build` pass. Phone
layout checked. No AI features.

---

## Slice 9 — Public deploy

**Demo after this:** audience QR (`https://qr.davydov-pr.com`) opens
**KPM Royale** on `https://app.davydov-pr.com`, talking to hosted Convex.

**Touch:** `npm run pages:deploy`; Convex functions on the deployment Pages
already uses (`artful-dog-585` until promoting). Prod promotion:
`CONVEX_DEPLOY_KEY` + `VITE_CONVEX_URL=https://rosy-manatee-43.eu-west-1.convex.cloud`.
Do **not** overwrite `davydov-pr.com` apex.

**Done when:** `GET https://qr.davydov-pr.com/target` still points at the app;
two real phones can queue on the public URL.

---

## Slice 10 — Fake players (stretch only)

**Do not implement** unless slices 1–8 work and there is leftover time.

Pad-up table is in [BRAINSTORM.md](./BRAINSTORM.md). Bots must run **inside
Convex** (scheduled throws), never a second backend.

---

## Out of every slice

- Player-created rooms, join codes, byes, spectate, async/correspondence play.
- LLM / vector search.
- Replacing Convex.
- Changing gather / pick / grace timings without the owner.
- Fake players before slice 10.

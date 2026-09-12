# Brainstorm: KPM Royale

**Project state: Brainstorming.** Product notebook. Do not build until the owner
moves `AGENTS.md` to **Development**.

Last updated: 2026-09-12 (20s reconnect grace).

## Locked product

**Name:** **KPM Royale**
**Tagline:** Kamen! Papir! Makaze! ✊ ✋ ✌️

**Who it is for:** hackathon audience on phones + a presenter with a projector QR.

**What it is:** a **live** rock–paper–scissors tournament. Convex **matchmakes**
players into a bracket of **4, 8, or 16**. No player-created rooms, no join
codes, no spectators.

**Loop (owner, 2026-09-12):**

1. Open the public URL (QR or link). Main menu: **random name + random emoji**
   (same as today’s `session` helper), with an option to **change** them, plus
   **Start matchmaking**.
2. Convex queues the player. After **4** real players are waiting, the matcher
   waits **20 seconds** in case more join (for 8 or 16), then starts the
   **largest exact** bracket (4, 8, or 16). Hitting **8** during that wait
   starts another **20 seconds** in case a 16 can form. Hitting **16** starts
   immediately. Odd counts never start.
3. Each pair plays **3 rapid rounds**. **10 seconds** to pick each round. If
   you do not pick in time and the opponent did, you **lose that round**. If
   **both miss**, it is a **draw** — same as both throwing the same gesture
   (no point). If the match is still tied after 3, they play **extra rounds
   until someone wins a round**. If they **draw 10 times in a row**, Convex
   picks a **random player in the pair as the match winner**.
4. **Winner vs winner** until one champion.
5. When a player is **eliminated**, they leave the royal (no spectate) and see
   a splash: **you lost**, button **Back to main menu**. The **champion** sees
   the same layout with **you are a winner** and **Back to main menu**. Main
   menu is the start screen (**Start matchmaking**).

This is **synchronous party play**. Async correspondence is **out**. Player
create/join rooms is **out**.

## Dropped

- Asynchronous / correspondence multiplayer.
- Player-created rooms, 4-char join codes, host “Start” as the way in.
- Odd-player byes (matchmaking makes odd starts impossible).
- Spectating after a loss (boot to home instead).
- 5-second pick window (now **10 seconds**).
- Grid / dungeon / word / card shortlist.

## Fake players (out of v1)

**Do not implement** until the real-player royal works and there is leftover
time. Owner: real players first; fakes only if we have time.

If built later, **pad to nearest size up**:

| Real players in the committed batch | Bracket | Fake players |
| --- | --- | --- |
| 1, 2, 3 | 4 | 3, 2, 1 |
| 4 | 4 | 0 |
| 5, 6, 7 | 8 | 3, 2, 1 |
| 8 | 8 | 0 |
| 9 … 15 | 16 | 7 … 1 |
| 16 | 16 | 0 |
| 17+ | pop **16 humans**, 0 fakes; leftover stay in queue |

Until then, v1 waits for a **full** 4 / 8 / 16 of humans. 1–3 stay in queue.
5–7 do not start an 8; 9–15 do not start a 16.

## Why this shows Convex

- **Queue:** one matchmaking table; phones subscribe to “searching…” vs “you’re
  in a royal.”
- **Pop 4/8/16:** one mutation (or scheduled job) creates the bracket; leftover
  humans stay queued.
- **Simultaneous throws:** opponent pick is hidden until both committed or the
  10s window ends — **server-side**.
- **Parallel pairs:** all round-1 matches resolve together; dashboard shows
  `matches` / `throws`.
- **Result splash:** loser / champion is out of the royal; UI shows copy +
  **Back to main menu**, not a spectator board.

Demo: projector QR → everyone taps **Start matchmaking** → Convex fills a 4/8/16
royal → throws in the dashboard → losers get **you lost** → champion gets
**you are a winner** → **Back to main menu**.

## Proposed rules (defaults — confirm or strike)

| Topic | Default |
| --- | --- |
| Branding | Home title **KPM Royale**. Tagline **Kamen! Papir! Makaze! ✊ ✋ ✌️**. |
| Entry | **Server matchmaking only.** Main menu = identity (random, editable) + **Start matchmaking**. QR opens that screen. |
| Bracket sizes | **4, 8, or 16** only. Never 2, 3, 5, … |
| When to start (v1) | After **4** queued: wait **20 seconds**, then largest exact 4/8/16. After **8** queued: wait **20 seconds** more for a 16. **16 starts immediately.** Leftovers stay queued. |
| 17+ humans | Start a **16**; leftovers stay queued. |
| Fake players | **Out of v1.** If time: pad-up table above. Do not build bots in the first slice. |
| Odd players | **Impossible** at royal start. Matcher never commits an odd roster. |
| Late join | New taps go to the **queue**, not into a royal already playing. |
| A match | **Exactly 3 rounds**. Classic RPS. Score = rounds won. |
| Round draw | Same gesture **or both miss** the 10s window: no point. Extra rounds if still tied after 3. **10 draws in a row** (streak resets on any round that has a winner) → **random player in the pair wins the match**. |
| Pick window | **10 seconds**. Both pick in secret. One miss: that player **loses the round**. Both miss: draw (see above). Timer via Convex scheduler, not `Date.now()` in queries. |
| Reveal | Three big buttons (✊ ✋ ✌️), then both gestures + who won the round. |
| On loss | Out of the royal (no spectate). Splash: **you lost**. Button: **Back to main menu**. |
| On win (not final) | Stay; wait for the next pair (winner vs winner). |
| Champion | Splash: **you are a winner**. Button: **Back to main menu**. |
| Identity | Keep current behavior: on first visit, **random adjective+noun name** and **random emoji**, persisted in `localStorage`. Player can **change** name and emoji on the main menu before matchmaking. No accounts. |

## Bracket picture (8 humans, example)

```
Start matchmaking → Convex queue → pop 8
  Round of 8: four pairs, 3 rounds each (10s picks)
  Losers → "you lost" → Back to main menu
  Round of 4: two pairs
  Final: two remaining
  Champion → "you are a winner" → Back to main menu
```

16 = one extra round of pairs. 4 = two pairs then a final.

## Skeleton mapping (when we build — not now)

Reuse internally, **not** as create/join UX:

- Convex backend, Vite/React, anonymous session, QR worker (QR still hits the
  **app**, not a room code).
- Presence **inside a royal** (who is still alive this match) if useful.

Stop featuring:

- Home create/join + `?r=CODE` as the product.
- Tap counter, emoji fountain as the loop.
- Spectator roster of eliminated players.

Add (illustrative, not a schema to implement yet):

- `queue`: session waiting for matchmaking.
- `royals` (or keep `rooms` as the match instance): size 4/8/16, status.
- `matches`: bracket round, player A/B, scores, phase.
- `throws`: hidden until round resolve.
- Mutations: `enqueue`, `throw`, `internal` matchmaker (pop 4/8/16 **humans**)
  + round timeout + eliminate/boot.
- Fake-player inserts: **not in the first slice.**

Rules live in Convex. Clients send `enqueue` and `rock | paper | scissors`.

## Demo day story (once built)

1. Projector QR → public app (start screen).
2. Audience taps **Start matchmaking**; dashboard shows the queue growing.
3. Convex starts a 4, 8, or 16 royal; phones jump into pair UI.
4. 10s throws; eliminated players see **you lost**; champion sees **you are a
   winner**; both tap **Back to main menu**.

If time later: fake players pad 1–3 / 5–7 / 9–15 **up** to 4 / 8 / 16.

## Open questions (short)

1. If a player **disconnects or leaves** mid-match: opponent wins the match?

## Agent rules

- Stay in **Brainstorming**. Refine this doc; **do not** implement yet.
- When the owner says go: set `AGENTS.md` to **Development**, build **real-player**
  queue + royals on Convex. **Do not** add fake players unless the owner says
  there is time.

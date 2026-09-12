# Brainstorm: Rock, Paper, Scissors Royal

**Project state: Brainstorming.** Product notebook. Do not build until the owner
moves `AGENTS.md` to **Development**.

Last updated: 2026-09-12 (gather window locked).

## Locked product

**Name (working):** Rock, Paper, Scissors Royal (RPS Royal).

**Who it is for:** hackathon audience on phones + a presenter with a projector QR.

**What it is:** a **live** rock–paper–scissors tournament. Convex **matchmakes**
players into a bracket of **4, 8, or 16**. No player-created rooms, no join
codes, no spectators.

**Loop (owner, 2026-09-12):**

1. Open the public URL (QR or link). Home is one button: **Start matchmaking**.
2. Convex queues the player. After **4** real players are waiting, the matcher
   **waits a short time** in case more join (for 8 or 16), then starts the
   **largest exact** bracket (4, 8, or 16). Odd counts never start. 16 queued
   starts immediately (nothing larger to wait for).
3. Each pair plays **3 rapid rounds**. **10 seconds** to pick each round.
4. **Winner vs winner** until one champion.
5. A player who **loses is booted** to the start screen (same single button).
   They are not spectators.

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
- **Boot on loss:** mutation removes the loser from the royal; their query goes
  empty and the UI is the start button again.

Demo: projector QR → everyone taps **Start matchmaking** → Convex fills a 4/8/16
royal → throws in the dashboard → losers snap back to home → champion, then they
can queue again.

## Proposed rules (defaults — confirm or strike)

| Topic | Default |
| --- | --- |
| Entry | **Server matchmaking only.** Home = **Start matchmaking**. QR opens that screen. |
| Bracket sizes | **4, 8, or 16** only. Never 2, 3, 5, … |
| When to start (v1) | **Locked: wait a short time** after 4 (and after 8) so more people can join. Then start the **largest exact** size: 16 if 16+, else 8 if 8–15, else 4 if 4–7. Leftovers stay queued. **16 starts immediately** (cap). Exact window length still open. |
| 17+ humans | Start a **16**; leftovers stay queued. |
| Fake players | **Out of v1.** If time: pad-up table above. Do not build bots in the first slice. |
| Odd players | **Impossible** at royal start. Matcher never commits an odd roster. |
| Late join | New taps go to the **queue**, not into a royal already playing. |
| A match | **Exactly 3 rounds**. Classic RPS. Score = rounds won. |
| Round draw | No point. Tie after 3 → **sudden-death** rounds. |
| Pick window | **10 seconds**. Both pick in secret. Window end or both picked → reveal. Missed pick = **random** throw. Timer via Convex scheduler, not `Date.now()` in queries. |
| Reveal | Three big buttons (✊ ✋ ✌️), then both gestures + who won the round. |
| On loss | **Boot to start screen.** No spectate, no linger in the royal. |
| On win (not final) | Stay; wait for the next pair (winner vs winner). |
| Champion | Short win state, then the same start screen / button (no lobby to hang in). |
| Identity | Anonymous `sessionId` + display name + emoji. No accounts. |

## Bracket picture (8 humans, example)

```
Start matchmaking → Convex queue → pop 8
  Round of 8: four pairs, 3 rounds each (10s picks)
  Losers → home (Start matchmaking)
  Round of 4: two pairs
  Final: two remaining
  Champion → home after the beat
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
4. 10s throws; losers return to the button; winners climb.

If time later: fake players pad 1–3 / 5–7 / 9–15 **up** to 4 / 8 / 16.

## Open questions (short)

1. **How long** is the gather window? (asked next)
2. Sudden-death on 3-round ties?
3. Champion: brief win splash, then the same button?
4. Display name on first visit, or emoji-only until later?

## Agent rules

- Stay in **Brainstorming**. Refine this doc; **do not** implement yet.
- When the owner says go: set `AGENTS.md` to **Development**, build **real-player**
  queue + royals on Convex. **Do not** add fake players unless the owner says
  there is time.

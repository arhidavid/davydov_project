# Brainstorm: Rock, Paper, Scissors Royal

**Project state: Brainstorming.** Product notebook. Do not build until the owner
moves `AGENTS.md` to **Development**.

Last updated: 2026-09-12 (matchmaking pass).

## Locked product

**Name (working):** Rock, Paper, Scissors Royal (RPS Royal).

**Who it is for:** hackathon audience on phones + a presenter with a projector QR.

**What it is:** a **live** rock–paper–scissors tournament. Convex **matchmakes**
players into a bracket of **4, 8, or 16**. No player-created rooms, no join
codes, no spectators.

**Loop (owner, 2026-09-12):**

1. Open the public URL (QR or link). Home is one button: **Start matchmaking**.
2. Convex queues the player. When a legal bracket can start, the server opens a
   royal and **pairs** everyone. Odd counts never start — the matcher only pops
   **4 / 8 / 16**.
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

## Stretch (not v1)

**Fake players.** Server-side bots that fill a 4 / 8 / 16 bracket when too few
humans are queued (demo with 1–3 phones still runs). They throw on the timer
(random). They are not a home-screen mode. Do not build until the human matcher
+ royal loop works — then pad the queue to the next legal size.

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
| When to start | Take the **largest** legal size that is ready: **16 immediately** if 16+ queued; else **8** if 8–15; else **4** if 4–7. If fewer than 4 humans: wait (v1) or pad with **fake players** (stretch). People left over (e.g. 10 → pop 8) stay in queue. |
| Why not “start 4 as soon as 4 exist” | That would starve 8- and 16-person royals. Prefer a short **queue window** (e.g. ~20s after the 4th joiner) to try to grow to 8/16, then start the largest legal size. Strike if you want instant 4s. |
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
| Fake players | Stretch only. Pad to 4, 8, or 16. Fake loss = delete bot; human loss = boot home. |

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
- `matches`: bracket round, player A/B (human or fake), scores, phase.
- `throws`: hidden until round resolve.
- Mutations: `enqueue`, `throw`, `internal` matchmaker + round timeout +
  eliminate/boot. Stretch: insert fake players when padding.

Rules live in Convex. Clients send `enqueue` and `rock | paper | scissors`.

## Demo day story (once built)

1. Projector QR → public app (start screen).
2. Audience taps **Start matchmaking**; dashboard shows the queue growing.
3. Convex starts a 4, 8, or 16 royal; phones jump into pair UI.
4. 10s throws; losers return to the button; winners climb.
5. Stretch if the room is thin: fake players fill the bracket.

## Open questions (short)

1. Confirm **queue window** (wait to try 8/16) vs **instant start at 4**?
2. Confirm sudden-death on 3-round ties?
3. Champion: brief win splash, then the same button?
4. Fake players: pad to **4**, to **8**, or always toward **16**?
5. Display name on first visit, or emoji-only until later?

## Agent rules

- Stay in **Brainstorming**. Refine this doc; **do not** implement matchmaking
  or fake players yet.
- When the owner says go: set `AGENTS.md` to **Development**, then build on
  Convex (queue + royals), not a second backend.

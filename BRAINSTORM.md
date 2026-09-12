# Brainstorm: Rock, Paper, Scissors Royal

**Project state: Brainstorming.** Product notebook. Do not build until the owner
moves `AGENTS.md` to **Development**.

Last updated: 2026-09-12 (pad-up fake players).

## Locked product

**Name (working):** Rock, Paper, Scissors Royal (RPS Royal).

**Who it is for:** hackathon audience on phones + a presenter with a projector QR.

**What it is:** a **live** rock–paper–scissors tournament. Convex **matchmakes**
players into a bracket of **4, 8, or 16**. No player-created rooms, no join
codes, no spectators.

**Loop (owner, 2026-09-12):**

1. Open the public URL (QR or link). Home is one button: **Start matchmaking**.
2. Convex queues the player. The matcher starts a royal of **4, 8, or 16**,
   **padding up** with fake players to the next of those sizes. Odd counts never
   start.
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

## Fake players (locked pad rule)

Not a home-screen mode. Convex inserts bots into the **same** royal so the
roster is always 4, 8, or 16. Bots throw on the 10s timer (random). Human loss
→ boot home. Fake loss → bot is dropped; no start screen.

**Pad to nearest size up** (owner, 2026-09-12):

| Real players in the committed batch | Bracket | Fake players |
| --- | --- | --- |
| 1, 2, 3 | 4 | 3, 2, 1 |
| 4 | 4 | 0 |
| 5, 6, 7 | 8 | 3, 2, 1 |
| 8 | 8 | 0 |
| 9 … 15 | 16 | 7 … 1 |
| 16 | 16 | 0 |
| 17+ | pop **16 humans**, 0 fakes; the rest stay in queue (next batch pads the same way) |

Build order when Development starts: human royal loop first, then this padding
(so a full 4/8/16 of humans works before bots). The pad rule is **in scope**,
not a maybe.

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
| When to start / pad | When the matcher **commits**, size = next of {4, 8, 16} **≥** human count (cap 16). Fakes fill the gap. **Do not** pad 1→4 the instant the first player queues, or 8- and 16-human royals never happen. Proposed: a short **queue window**, then commit and pad whatever humans are there (3 humans → 1 fake → 4; 5 humans → 3 fakes → 8). Strike the window if you want instant pad. |
| 17+ humans | Start a **16** with no fakes; leftovers stay queued. |
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
| Fake players | **Pad up** as in the table above. Random throws on timeout. |

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
- Mutations: `enqueue`, `throw`, `internal` matchmaker (pad up to 4/8/16) +
  round timeout + eliminate/boot. Fake players are matcher-owned, not clients.

Rules live in Convex. Clients send `enqueue` and `rock | paper | scissors`.

## Demo day story (once built)

1. Projector QR → public app (start screen).
2. Audience taps **Start matchmaking**; dashboard shows the queue growing.
3. Convex starts a 4, 8, or 16 royal; phones jump into pair UI.
4. 10s throws; losers return to the button; winners climb.
5. If the queue is 1–3 / 5–7 / 9–15 humans at commit, fake players pad **up**
   to 4 / 8 / 16.

## Open questions (short)

1. Confirm **queue window** (gather humans, then pad) vs **instant pad** (1
   player immediately becomes a 4 with 3 fakes)?
2. Confirm sudden-death on 3-round ties?
3. Champion: brief win splash, then the same button?
4. Display name on first visit, or emoji-only until later?

## Agent rules

- Stay in **Brainstorming**. Refine this doc; **do not** implement matchmaking
  or fake players yet.
- When the owner says go: set `AGENTS.md` to **Development**, then build on
  Convex (queue + royals), not a second backend.

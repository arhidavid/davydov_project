# Brainstorm: Rock, Paper, Scissors Royal

**Project state: Brainstorming.** Product notebook. Do not build until the owner
moves `AGENTS.md` to **Development**.

Last updated: 2026-09-12. Async / correspondence play is **dropped**.

## Locked product

**Name (working):** Rock, Paper, Scissors Royal (RPS Royal).

**Who it is for:** hackathon audience on phones + a presenter with a projector QR.

**What it is:** a **live** multiplayer tournament of rock–paper–scissors in a
shared room. Everyone must be in the room at the same time. Convex is the
server: lobby, lock, pairing, throws, bracket, winner.

**Loop (owner, 2026-09-12):**

1. Players **create or join** a room (code / link / QR). Lobby stays open while
   people arrive. Presence shows who is here.
2. Once **a few people** are in, the room **closes** to new arrivals.
3. Current players are **split into pairs**.
4. Each pair plays **3 rapid rounds** of rock–paper–scissors.
5. The **winner of a pair plays the winner of another pair**. Repeat until one
   champion (single-elimination bracket).

This is **synchronous party play**, not async turns you finish later.

## Dropped

- Asynchronous / correspondence multiplayer.
- Grid duel, dungeon, word, and card shortlist from the earlier notebook.

## Why this shows Convex

- **Lobby:** `players` heartbeats; phones fill up live on the QR link.
- **Lock:** one mutation flips the room closed; late joiners are rejected.
- **Pairs + bracket:** match documents in the dashboard while phones play.
- **Simultaneous throws:** neither client sees the opponent’s pick until both
  (or the timer) have committed — that has to be **server-side**, not local.
- **Many matches at once:** round 1 pairs all throw in parallel; queries fan in.

Demo: projector QR → four (or eight) phones join → room locks → two (or four)
matches resolve on screen → winners climb → dashboard shows `matches` / `throws`.

## Proposed rules (defaults — confirm before Development)

Owner said “a few people,” “3 rapid rounds,” “winner vs winner.” These fill the
gaps so later agents share one picture. **Strike anything you disagree with.**

| Topic | Proposed default |
| --- | --- |
| Bracket size | Power of two. **Minimum 4** (two pairs → one final). **Cap 8** for demo day (quarters → semis → final). 2 players = skip bracket, one best-of-3. |
| Who closes the room | Room **creator** taps **Start royal** when the lobby looks full (not auto-lock on N). Prevents locking at 3 by accident. Create also **auto-starts** if lobby hits the cap (8). |
| Odd count at start | Need **even** count to pair. If odd, last unmatched player gets a **bye** (advances without playing) rather than blocking start. Prefer waiting for 4 or 8 on stage. |
| Late join | After lock: **no new players**. Same code shows “royal in progress” (spectate later if we have time). |
| A match | **Exactly 3 rounds**. Win = classic RPS. Score = rounds won. Highest score after 3 advances. |
| Round draw | Draw awards **no point**. If scores tie after 3, **sudden-death** extra rounds until one round has a winner. |
| Rapid | Each round has a short pick window (**~5 seconds**). Both pick in secret. When both picked, or the window ends, **reveal**. Missed pick = **random** throw (still a round, still rapid). Timer via Convex scheduler, not `Date.now()` in queries. |
| Reveal | Server reveals only when the round is locked. UI: three big buttons (✊ ✋ ✌️), then both gestures + winner. |
| Eliminated players | **Stay in the room** and watch the rest of the bracket (they are the crowd). |
| Identity | Existing anonymous `sessionId` + display name + emoji. No accounts. |
| Host | Creator is a **player**, not a referee, unless they sit out (not needed for v1). |
| Rematch | After a champion: **new lobby** or “Play again” resetting the same room to open. Nice-to-have; one royal per room is enough for v1. |

## Bracket picture (4 players)

```
Lobby (open) → Start → Room locked
  Pair A: P1 vs P2   (3 rapid rounds)  ──┐
  Pair B: P3 vs P4   (3 rapid rounds)  ──┴── Final: winner A vs winner B
Champion
```

Eight players: same idea with an extra round of pairs.

## Skeleton mapping (when we build — not now)

Keep:

- `rooms` + 4-char codes, Home create/join, `?r=CODE`, QR worker.
- `players` presence (roster + online).

Stop featuring as the product:

- Tap counter.
- Emoji fountain as the core loop (optional garnish on reveal).

Add (illustrative, not a schema to implement yet):

- Room `status`: `lobby` → `locked` / `playing` → `finished`.
- `matches`: room, bracket round, player A/B, scores, winner, phase.
- `throws`: match + round index + sessionId + choice; **do not leak** the
  opponent’s choice in any query until the round is resolved.
- Mutations: `startRoyal` (pair + close), `throw` (commit pick), maybe
  `internal` round-timeout.
- Queries: room+bracket for everyone; per-player view that hides secrets.

Rules live in Convex mutations. Clients only send `rock | paper | scissors`.

## Demo day story (once built)

1. Projector: QR → public app; presenter creates a room.
2. Audience joins on phones until 4 or 8.
3. Start royal → door closes; pairs appear on every phone and in the dashboard.
4. Rapid throws; losers become spectators; winners climb.
5. Champion screen. Dashboard: rooms, matches, throws.

## Open questions (short)

1. Confirm **4–8**, host **Start**, bye if odd?
2. Confirm **exactly 3 rounds** + sudden-death on tie, not “first to 2”?
3. Confirm **~5s** pick + random on timeout, vs wait forever for both?
4. Working title **RPS Royal** or something else?
5. After the final: freeze on champion, or one-tap rematch?

## Agent rules

- Stay in **Brainstorming**. Refine this doc; **do not** add game tables or a
  second backend.
- When the owner says go: copy the one-liner into `AGENTS.md`, set state to
  **Development**, implement on the rooms skeleton.

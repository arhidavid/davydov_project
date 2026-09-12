# Brainstorm: async multiplayer game on Convex

**Project state: Brainstorming.** This file is the product notebook. Do not build
the game until the owner locks a mechanic and sets `AGENTS.md` to **Development**.

Last updated: 2026-09-12 (owner: gamedev background; Convex hackathon, Belgrade).

## What is locked

1. **It is a game.** The shipped demo must play, not just “be in a room.”
2. **Asynchronous multiplayer.** A player can create or join, take an action, close
   the phone, and come back later. The match must not require a simultaneous lobby
   of everyone for the whole session.
3. **Rooms.** Create a game room or join an existing one (code / link / QR). This
   already exists in the skeleton (`convex/rooms.ts`, `convex/presence.ts`, Home/Room UI).
4. **Convex is the game server.** Board, turns, membership, and outcomes live in
   Convex tables + mutations. Clients subscribe with `useQuery`. No second backend.
5. **Phone-first, no install, no AI.** Audience scans `qr.davydov-pr.com` →
   `app.davydov-pr.com`. Anonymous device session is enough for demo day.

## What is not locked

- Specific genre, rules, and name.
- 1v1 vs more-than-two.
- Whether a room holds one match or many sequential matches.
- How “your turn” is signaled (in-page only vs. something louder). In-page + live
  UI is enough for the hackathon; push notifications are out of scope unless asked.

## Why async still shows off Convex

Convex’s judged strength is **reactive queries**. Async does not mean “refresh to
see the move.” It means:

- **Authoritative match documents** in the dashboard (rooms, players, moves).
- **A player may be offline** between turns; state waits on the server.
- **If they are online together**, the opponent’s move appears without polling.

That combo is the demo: two phones + Convex dashboard watching the same `games` /
`moves` rows update.

Live presence stays useful: “opponent is looking at the board right now” vs
“they’ll see this later.” Heartbeats already exist.

## Constraints that kill some game ideas

| Constraint | Implication |
| --- | --- |
| One-day ship + agents | Tiny rules surface. Prefer a known toy (grid, shots, tiles) over a novel sim. |
| Audience QR | First action in **under a minute**. No tutorial wall. |
| Mobile | Fat-finger UI: big cells/buttons, not a 64-piece RTS. |
| No AI | No generated puzzles, opponents, or captions. |
| Projector + virality | A board that **looks** different after each mutation (dashboard + phones). |
| Gamedev background | One readable “game feel” moment (turn resolve, hit/miss, capture) is enough; do not spend the day on an engine. |

Avoid for this hackathon: real-time twitch (fighting, twitch shooters), physics,
long 4X, chess with full rules+AI, anything that needs a Node tick every frame.

## Recommended shortlist

All of these reuse **create/join room + presence**. They swap the tap counter /
emoji fountain for a **turn + board** (the intended pivot).

### A — Grid duel (Sea battle / Battleship-style) — **recommended default**

- **Loop:** Place a small fleet (or a few ships) → take shots on your turn →
  wait for the opponent → hit/miss/sunk → first to sink wins.
- **Why:** Instantly understood. Native async. Two phones + a table of `shots` in
  the dashboard is a clean Convex story. UI is a pair of grids.
- **Players:** 1v1 (spectators can join the room as watch-only later if time).
- **Risk:** Feels “board-game generic” if the presentation is dry. Mitigate with
  punchy hit feedback and a named theme (not “Battleship clone” on the home screen).

### B — Five-in-a-row / Connect-style disc drop

- **Loop:** Drop or place a token; alternate; N-in-a-row wins.
- **Why:** Smallest rules, fastest to finish a match on stage.
- **Risk:** Looks like a tutorial app unless the room/social layer is excellent.
  Use only if we need maximum safety on clock.

### C — Shared-dungeon mail (tiny tactics)

- **Loop:** Same map in Convex. On your turn you move one unit or play one action;
  then it is the other player’s turn (PvE boss HP shared, or PvP).
- **Why:** Best “I have a gamedev background” flex; dashboard shows a living map.
- **Risk:** Scope. Only lock this if the owner wants a **very** small map (e.g.
  6×6, one unit each, one enemy) and will cut art to CSS shapes.

### D — Word / tile duel (Words-with-Friends-lite)

- **Loop:** Play a word or a tile set, score, pass the turn.
- **Why:** Classic async; keyboards on phones are fine.
- **Risk:** Dictionary + scoring + UI density. Easy to overrun the day.

### E — Spell / card stack (one card per turn)

- **Loop:** Hidden hand in Convex, play one card, resolve, opponent responds later.
- **Why:** Mutations-as-rules is a strong Convex demo.
- **Risk:** Needs a tiny locked card list (8 cards max) on day one or it sprawls.

**Owner pick needed:** A, B, C, D, E, or a different mechanic that still fits the
locked row (async + rooms + Convex). Until then, treat **A** as the planning default
so later agents share one picture.

## How this maps onto the skeleton (when we build)

Keep; do not replace:

- `rooms` — become **game rooms** (code, name, maybe `status`: lobby / placing /
  playing / finished).
- `players` / presence — roster + “online now” + display name/emoji.
- Home create/join + `?r=CODE` + QR worker.

Replace / stop featuring as the product:

- Room `taps` counter.
- Emoji fountain as the core loop (fine as a tiny garnish if it does not eat time).

Add (illustrative — not a schema to implement yet):

- A `games` or match fields on `rooms` (turn index, whose `sessionId`, phase).
- A `moves` (or `shots` / `tiles`) table indexed by room — append-only history.
- Queries: `getMatch`, `listMoves`. Mutations: `join`, `submitTurn` (reject if
  not your turn / illegal). Optional `internalMutation` to mark timeouts later.

Anonymous `sessionId` in `localStorage` stays the identity. Public functions stay
unguessable-ID scoped (room id + session), not email auth, unless the owner asks.

## Demo day story (once built)

1. Projector: QR → public app.
2. Presenter creates a room; audience joins on phones (or one volunteer as P2).
3. Take a turn on phone A; phone B and the **Convex dashboard** show the new row.
4. Leave and reopen the same link — state is still there (the async proof).
5. Optional: both stay in the room so the next shot feels live.

## Open questions for the owner

Answer these to lock the idea and move to **Development**:

1. Mechanic: **A / B / C / D / E / other**?
2. Strict **1v1**, or allow a spectator crowd in the same room?
3. Room = **one match**, or rematch in the same code?
4. Working title / theme (naval, space, dungeon, abstract)?
5. Confirm: still **no accounts**, just device session + display name?

## Agent rules while this file is current

- Stay in **Brainstorming**: refine this doc if the owner replies; **do not** add
  game tables, Phaser, or a new backend.
- When locked: copy the chosen one-liner into `AGENTS.md` (“who / what”), set
  current state to **Development**, then implement on the rooms skeleton.

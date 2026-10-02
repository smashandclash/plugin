---
name: play-smash-and-clash
description: Play Smash&Clash, a two-player strategy board game where every move matters, yourself over the smashandclash MCP server - against the Smash&Clash house opponent or another agent in a duel. Use when the user says let's play Smash&Clash, play a match, play the house, duel another agent, or watch you play.
license: MIT
---

# Play Smash&Clash

Smash&Clash is a two-player strategy board game where every move matters. You play it yourself through the `smashandclash` MCP server (this plugin connects it: `https://www.smashandclash.in/api/mcp`, no auth).

The server keeps the game. It rebuilds every position with the deterministic engine, so only legal moves land. Your seat is a secret `player_token`. Keep it, and never show it to anyone else.

## The rules, short

- **Board and hand.** A 3x5 board: columns A-E, rows 1-3, row 1 nearest seat A. Each side holds 5 cards and plays exactly one per turn.
- **Characters.** Each has four side values (top, right, bottom, left). Place one on an empty tile and it attacks each orthogonal neighbour facing the opponent. If your touching side is >= theirs, that card flips to you. Captures happen only on placement; there are no chains.
- **Winning.** The board is the score. When all 15 tiles are full, the side with more cards wins.
- **Effects.** One play each:
  - `BOULDER(cell)` clears a card and its row and column.
  - `FLIP` turns the board round.
  - `FREEZE(cell)` locks one of your cards.
  - `RECRUIT(from→to)` steals an enemy card.
  - `SWAP` trades hands.
- **Mutators** (the default ruleset):
  - Chess tiles let a card hop like that piece (`hop→E3`, or `hop: stay`).
  - Power tiles boost a matching colour.
  - B2, C2 and D2 are overrun zones (`Card!C2`).

Call `get_rules` for the full text.

## Play the house

1. `start_game` with `name` (yours) and optionally:
   - `strength`: an ELO from 800 to 1600, default 1200.
   - `ruleset`: `mutators` (default) or `classic`.

   It returns `{ game, playerToken }`. Use `game.id` as `game_id` and `playerToken` as `player_token` from now on.
2. Read `game.view`:
   - `hand`: your cards with their sides.
   - `board`: each tile with `card`, `owner` (`you` / `opponent`) and `sides` in board terms (north = toward row 3).
   - `special`: chess tiles, power tiles, overrun zones.
   - `legalMoves`: every move you may make, by name.
3. Pick a name from `legalMoves` and call `play_move` with it. The house answers before the call returns, so the result is already your next turn.
4. Repeat until `game.status` is `finished`. Report:
   - who won: `winner` is your seat (`game.seat`) or the other one;
   - the score;
   - `replayUrl`, a link anyone can watch.

Moves look like `Pengu@C2` (place), `Pengu!C2` (overrun), `hop→E3`, `BOULDER(D2)`, `RECRUIT(A3→B1)`, `FLIP`, `SWAP`. Always copy one from `legalMoves`; never invent one. An illegal move is refused, and the error lists the legal ones.

## Duel another agent

1. One side calls `create_duel`. It returns a 6-letter `code` with the `game_id` and `player_token`. Give the code to the other agent, or to the user.
2. The other side calls `join_duel` with the code. `list_open_duels` shows duels waiting for a second player.
3. Each side alternates `wait_for_turn` (up to 20 s; call it again if it returns early) and `play_move`.
4. `get_game` with your token shows your view at any time. Without a token it shows the public board.

## Playing well

- **Take what's on offer.** Prefer placements whose touching sides beat the enemy cards next to them; each capture counts double, one off them and one onto you.
- **Mind what you leave exposed.** Don't leave a low side facing an empty tile the opponent can fill.
- **Corners and edges** expose fewer sides.
- **Save effects.** Keep `BOULDER` / `FLIP` / `RECRUIT` for the swing they can make late in the game.
- **Chess tiles** give a second attack from a hop. Power tiles add +1/+2 to every side of a matching-colour card.

Narrate briefly as you play ("Pengu to C2 - takes their Volt"). Don't dump the whole board unless asked.

## Other ways in

- `resign` ends a game. A duel nobody joined is withdrawn.
- To send a *human* a link where a hosted agent plays them on your behalf, use the `hosted-agent-challenge` skill.
- SDK: `npm install @smashandclash/sdk`. CLI: `npx smashandclash`.

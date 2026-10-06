---
name: play-smash-and-clash
description: Play Smash&Clash, a two-player strategy board game where every move matters, yourself over the smashandclash MCP server - against the user or another person (they open an invite link and play you in their browser), another agent, the house opponent, or whoever is in the quick-match queue. Also host a match between two people, watch games, and read replays and Game Reviews. Use when the user says let's play Smash&Clash, play me, play a match, find a match, set up a game for my friends, watch a game, or review a game.
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

## Play the user (or any person)

When the user wants to play *you*, and you can keep calling tools for the length of a game (about 10-20 turns each):

1. `create_duel` with `name` (yours), `opponent: "person"` and optionally `opponent_name` (theirs). It returns `{ game, playerToken, inviteUrl }`.
2. Send them `inviteUrl`, e.g. "Tap to play me: <url>". They play in their browser, in the real game; nothing to install, no account. In a terminal: `npx smashandclash play <url>`.
3. Call `wait_for_turn` (up to 20 s; call it again if it returns early). It returns once they've opened the link and it's your turn. Then `play_move`, and repeat until `status` is `finished`.
4. Say who won, the score, and share `replayUrl`. `get_review` gives each side's accuracy and the turning point.

If you can't stay for a whole game (a quick chat reply), send a Hosted Agent Challenge instead: a hosted agent plays them on your behalf (the `hosted-agent-challenge` skill).

## Play the house

1. `start_game` with `name` (yours) and optionally:
   - `strength`: an ELO from 800 to 1600, default 1200.
   - `ruleset`: `mutators` (default) or `classic`.

   It returns `{ game, playerToken }`. Use `game.id` as `game_id` and `playerToken` as `player_token` from now on.
2. Read `game.view`:
   - `hand`: your cards with their sides (and `cardId`).
   - `board`: each tile with `card`, `owner` (`you` / `opponent`) and `sides` in board terms (north = toward row 3).
   - `special`: chess tiles, power tiles, overrun zones.
   - `legalMoves`: every move you may make, by name.
3. Pick a name from `legalMoves` and call `play_move` with it. The house answers before the call returns, so the result is already your next turn.
4. Repeat until `game.status` is `finished`. Report:
   - who won: `winner` is your seat (`game.seat`) or the other one;
   - the score;
   - `replayUrl`, a link anyone can watch.

Moves look like `Pengu@C2` (place), `Pengu!C2` (overrun), `hop→E3`, `BOULDER(D2)`, `RECRUIT(A3→B1)`, `FLIP`, `SWAP`. Names with spaces and dots play as written (`Lizzie Jr.@C2`). Always copy one from `legalMoves`; never invent one. An illegal move is refused, and the error lists the legal ones.

## Duel another agent

1. One side calls `create_duel`. It returns a 6-letter `code` with the `game_id` and `player_token`. Give the code to the other agent, or to the user.
2. The other side calls `join_duel` with the code. `list_open_duels` shows duels waiting for a second player.

Codes are the same on every client: a person can join your code on smashandclash.in (**Play a friend → Join**), in Telegram, in a terminal or in any app, and `join_duel` takes a code (or its join link, `https://www.smashandclash.in/?join=K7QF2M`) that someone made on any of them.
3. Each side alternates `wait_for_turn` (up to 20 s; call it again if it returns early) and `play_move`.
4. `get_game` with your token shows your view at any time. Without a token it shows the public board.

## Quick match

`find_match` with `name` and `opponent` (`any`, `agent` or `person`) pairs you with whoever has waited longest - on any client: people press PLAY on smashandclash.in, in Telegram or in a terminal, and wait in the same queue. If nobody is waiting, `status` is `waiting`: keep calling `wait_for_turn` to hold your place (stop and it lapses within a minute; `resign` leaves the queue). Then play as in a duel.

## Host a match between two people

When the user wants two people to play each other (friends, a group chat, a tournament):

1. `create_match` with `players: ["Ada", "Grace"]`. It returns two invite links, `invites.A` and `invites.B`. You hold no seat.
2. Send each person their own link. The match starts when both have opened theirs.
3. Follow it with `watch_game` (pass the `moveCount` you last saw), or check `get_game` without a token.
4. When it's over, report the winner and score, and offer `get_review` and the `replayUrl`.

## Watch, replays and reviews

- `list_live_games` shows public games being played (or `status: "finished"`). `watch_game` follows one.
- Every game has a live page on the real board, its `watchPage` (`https://www.smashandclash.in/watch/<game id>`): share it when the user wants to watch, or wants friends to. `https://www.smashandclash.in/tv` shows whatever game is being played now. Add `?overlay=1` (and `&delay=30`) to put either on a stream.
- `get_replay` and `get_review` read a finished game, by `game_id` or any shared `replay_url` (`https://www.smashandclash.in/replay#z=...`). Games still being played have none.
- `get_cards` lists the deck: every card's sides, colour, effect and card face.
- Public player profiles and club leaderboards are on the REST API, not MCP: `https://www.smashandclash.in/api/v1/players/<id>` and `/api/v1/clubs/<CODE>`. Read them with a web fetch if the user asks how a friend or a club is doing.

## Fair play

You only ever see your own hand and counts for the other side's; spectators see the board. Never try to learn hidden cards. Invite links are keys to a seat: send each only to its person.

## Playing well

- **Take what's on offer.** Prefer placements whose touching sides beat the enemy cards next to them; each capture counts double, one off them and one onto you.
- **Mind what you leave exposed.** Don't leave a low side facing an empty tile the opponent can fill.
- **Corners and edges** expose fewer sides.
- **Save effects.** Keep `BOULDER` / `FLIP` / `RECRUIT` for the swing they can make late in the game.
- **Chess tiles** give a second attack from a hop. Power tiles add +1/+2 to every side of a matching-colour card.

Narrate briefly as you play ("Pengu to C2 - takes their Volt"). Don't dump the whole board unless asked.

## Other ways in

- `resign` ends a game. A game nobody joined is called off.
- To send a *human* a link where a hosted agent plays them on your behalf, use the `hosted-agent-challenge` skill.
- SDK: `npm install @smashandclash/sdk`. CLI: `npx smashandclash`.

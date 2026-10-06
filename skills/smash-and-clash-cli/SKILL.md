---
name: smash-and-clash-cli
description: Drive the smashandclash CLI (beta) to play Smash&Clash from a shell - start a game, read the numbered legal moves, play by number or name, duel other agents, invite a person, join the quick-match queue, host a match for two people, watch games, read replays and reviews, send Hosted Agent Challenges - using its --json envelope and exit codes. Use when you have a shell but no MCP connection, or the user asks to play Smash&Clash in the terminal.
license: MIT
---

# Smash&Clash CLI

`smashandclash` (beta) plays Smash&Clash from a shell. Install it globally to also get the short alias `snc`:

```bash
npx smashandclash --help
```

## Rules for agents

- **Always pass `--json`.** Each command prints exactly one JSON line on stdout:
  - `{ok: true, command, data, meta}`, where `meta.next` is the command to run next;
  - or `{ok: false, error: {code, message, hint, status}}`.
- **Never run bare `smashandclash` or `smashandclash play`.** Those open a full-screen game for humans. Off a terminal they refuse with exit code 2.
- **The CLI remembers the current game** in `~/.smashandclash`, so moves need no ids.

## Play a game step by step

```bash
smashandclash start --json --name "My Agent" --strength 1200   # 800-1600; --ruleset classic|mutators
smashandclash state --json            # data.view: hand, board, legalMoves (numbered from 1)
smashandclash move 3 --json           # the 3rd legal move; the house has answered when it returns
smashandclash move Pengu@C2 --json    # or by name, copied from legalMoves
smashandclash resign --json
```

Loop `state` → choose → `move` until `data.status` is `finished`. Then report the winner, the score and `data.replayUrl`. `data.seat` is your seat; `data.winner` is the winning seat.

## Duels

```bash
smashandclash duel create --json      # data.code: give it to the other side
smashandclash duel join K7QF2M --json
smashandclash wait --json             # until it's your turn (up to 20 s; call again)
smashandclash duels --json            # duels waiting for a second player
```

## Hosted Agent Challenges (powered by AgentsORG)

```bash
smashandclash challenge claude --challenger Ada --json   # data.url: send it to the human
smashandclash result <token> --wait --json
smashandclash profile claude --json
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | ok |
| 2 | usage |
| 3 | no current game: run `start` |
| 4 | not found |
| 5 | network |
| 6 | refused: `ILLEGAL_MOVE`, `CONFLICT` (not your turn, or the game is over), `FORBIDDEN` |
| 9 | rate limited: wait for the hint's `Retry-After` |

On `ILLEGAL_MOVE`, run `state --json` and pick from `legalMoves`.

## Setup helpers

- `smashandclash doctor --json` checks Node, the API and MCP.
- `smashandclash mcp-config --client claude-code|cursor|vscode|windsurf|codex` prints the MCP setup, so you can play over MCP instead.

## People and matchmaking (0.2.0)

```bash
npx smashandclash invite --json --opponent-name Ada   # data.inviteUrl: send it; then wait / move
npx smashandclash quick --json                        # paired, or data.status "waiting": then wait
npx smashandclash claim <invite link> --json          # take the seat an invite opens
npx smashandclash match create --players "Ada,Grace" --json   # two people, data.invites.A / .B
npx smashandclash watch <game-id> --wait --json       # a spectator's wait for the next move
npx smashandclash tv --json                           # the game being played now (data.game.watchPage: its live page)
npx smashandclash live --json                         # public games (--finished)
npx smashandclash replay <game-id | replay link> --json
npx smashandclash review <game-id | replay link> --json
npx smashandclash cards --json                        # values, colours, art, attack animation
```

## Players, leaderboards and assets (0.3.0)

```bash
npx smashandclash player <id> --json                  # a public profile (id = friend code) and their clubs
npx smashandclash club ABC234 --json                  # a club's leaderboard (--limit, --offset)
npx smashandclash leaderboard discord:123456789 --json   # any board: club:<CODE>, discord:<id>, whop:<id>
npx smashandclash assets --json                       # fonts, colours, card back, attack timing, sounds, voices
```

For a person at the keyboard, `npx smashandclash` opens the full-screen game: Play the house, Quick match, Invite a friend, Open a duel, Join a game (a code or an invite link).

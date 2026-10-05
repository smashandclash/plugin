---
name: smash-and-clash-webmcp
description: Play Smash&Clash for the user inside their browser on www.smashandclash.in through the page's WebMCP tools (document.modelContext). Use when you are a browser agent on smashandclash.in and the user asks you to play a move, play a match for them, explain the position, or open a page.
license: MIT
---

# Smash&Clash in the browser (WebMCP)

On `https://www.smashandclash.in`, the game registers WebMCP tools wherever the browser gives pages a model context (`document.modelContext`).

- **You act as the player in their match.** Your moves go through the same checks a tap does.
- **You see only what the player sees.** You never see the opponent's hand.

## Tools

| Tool | What it does |
| --- | --- |
| `get_rules` | The rules, short |
| `start_match` | Start a match from the home screen |
| `get_game_state` | The board, your hand, the score, whose turn, and `legalMoves` by name |
| `play_move` | Play one move by name, e.g. `Pengu@C2`, `hop→E3`, `FLIP` |
| `open_page` | Open a page: home, how-to-play, leaderboard, friends or replays |
| `get_replay_link` | A link that replays the player's last finished match on any device |
| `get_profile` | The player's name and rating (ELO) |

## Playing for the user

1. Call `get_game_state`. If there's no match, ask whether to start one, then call `start_match`.
2. On your turn, choose from `legalMoves`. Never invent a move. (The two cards named Lizzie carry their id: `Lizzie#44@C2`.)
3. Call `play_move`, then `get_game_state` again to see the reply.
4. Narrate briefly ("Pengu to C2 - takes their Volt"). Let the user take over whenever they want.
5. At the end, offer the result and `get_replay_link`.

Strategy, the move grammar and the rules are the same as in the `play-smash-and-clash` skill.

Without WebMCP, play over MCP instead (`https://www.smashandclash.in/api/mcp`).

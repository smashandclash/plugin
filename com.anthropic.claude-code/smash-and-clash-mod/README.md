# smash-and-clash-mod

A [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview) for [Smash&Clash](https://www.smashandclash.in), a two-player strategy board game where every move matters. `/smash` opens the board in a pane, so you can play while Claude works.

```text
/plugin marketplace add smashandclash/plugin
/plugin install smash-and-clash-mod@smashandclash
```

It needs Claude Code 2.1.287 or later, with mods enabled for your account. It's tested with 2.1.287.

## Play

| Key | Does |
| --- | --- |
| `1`-`5` | Pick a card from your hand |
| `w` `a` `s` `d` | Move over the board (legal tiles are marked `+`) |
| `f` | Play the card on the tile (an effect card plays at once) |
| `g` | Suggest a move |
| `x` | Stay put when a hop is offered |
| `n` | New game, once one ends |
| Esc | Close the pane (the game stays saved) |

In the terminal the board is a colour grid: your cards are blue, theirs red, and the cursor is yellow. The Desktop app draws it as text.

While Claude works and the pane is closed, a line above the prompt shows the score and says `/smash`.

| Command | Does |
| --- | --- |
| `/smash` | Opens the board: resumes your game, or starts one against the house |
| `/smash new` | A new game against the Smash&Clash house opponent |
| `/smash duel` | Opens a duel; the other side joins with the code |
| `/smash join CODE` | Joins a duel (from the mod, the CLI, the SDK or an agent over MCP) |
| `/smash close` | Closes the pane |

## Settings

`/plugin configure smash-and-clash-mod@smashandclash`, or `/config`:

- `player_name`: your name on the board and on replays.
- `strength`: how strong the house plays, an ELO from 800 to 1600 (default 1200).
- `auto_open`: open the board when Claude starts working. It opens only in a terminal at least 144 columns wide.

## What it reaches

- **Network:** only `https://www.smashandclash.in`, the public games API, through `$.http.fetch`.
- **Saved data:** your current game id and its player token, in the mod's own `$.store`.
- **Nothing else:** no files, no processes, no model calls.

## Develop

```bash
claude --plugin-dir ./com.anthropic.claude-code/smash-and-clash-mod
claude plugin validate ./com.anthropic.claude-code/smash-and-clash-mod
claude plugin test ./com.anthropic.claude-code/smash-and-clash-mod   # tests/smash.test.ts
node --test tests/logic.test.mjs                                    # the logic, on a stand-in runtime
```

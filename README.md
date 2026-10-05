# Smash&Clash Agent Plugin

[![skills.sh](https://skills.sh/b/smashandclash/plugin)](https://skills.sh/smashandclash/plugin)
[![Agent Plugins](https://img.shields.io/badge/agent--plugins-1.0.0-0073D7)](https://agent-plugins.org)

[Smash&Clash](https://www.smashandclash.in) is a two-player strategy board game where every move matters. This repository is its [Agent Plugin](https://agent-plugins.org). It follows the Agent Plugins 1.0.0 standard, and works in Claude Code, Cursor, Codex and any other Agent Plugins client.

What it lets an agent do:

- **Play the game itself.** It plays you or any person (they open an invite link and play in their browser), another agent, the Smash&Clash house opponent, or whoever is in the quick-match queue.
- **Host and watch.** It sets up a match between two people, follows games live, and reads finished games as replays and Game Reviews.
- **Send a human a Hosted Agent Challenge,** powered by [AgentsORG](https://www.agents.org.in).
- **Build your own client** with the official card art, attack animation, sounds and fonts, plus public player profiles and club leaderboards.
- **Use the SDK, the CLI or WebMCP.**

In Claude Code, the bundled mod also lets **you** play while Claude works.

```text
MCP     https://www.smashandclash.in/api/mcp    (Streamable HTTP, no auth)
Skills  npx skills add smashandclash/plugin
Play    https://www.smashandclash.in
```

## Install

### Skills only (any agent: Claude Code, Codex, Cursor, OpenCode, ...)

```bash
npx skills add smashandclash/plugin            # pick skills and agents
npx skills add smashandclash/plugin --all      # every skill, every agent
```

| Skill | Teaches an agent to... |
| --- | --- |
| `play-smash-and-clash` | Play a match itself over MCP: against a person (invite link), another agent, the house opponent (800-1600 ELO) or the quick-match queue; host a match for two people; watch, replays and reviews |
| `hosted-agent-challenge` | Send a human a Hosted Agent Challenge (powered by AgentsORG), then read back the verified result, ELO and history |
| `smash-and-clash-sdk` | Write code with `@smashandclash/sdk`: strategies, bots, duels, profiles and leaderboards |
| `smash-and-clash-client` | Build your own client or UI: follow the game's design system ([`smashandclash.design`](https://www.smashandclash.in/smashandclash.design)) or extend it with your own flavour, draw the cards from the official art, animate attacks, play the game's sounds and voices, show profiles and leaderboards |
| `smash-and-clash-cli` | Drive the `smashandclash` CLI from a shell: its `--json` envelope and exit codes |
| `smash-and-clash-webmcp` | Play for the user in their browser through the page's WebMCP tools |
| `smash-and-clash-setup` | Get a new user from install to a first match (the onboarding skill ChatGPT and Codex run after install) |

### Claude Code

```text
/plugin marketplace add smashandclash/plugin
/plugin install smash-and-clash@smashandclash        # the MCP server and the seven skills
/plugin install smash-and-clash-mod@smashandclash    # the mod: play while Claude works
```

### Cursor and other Agent Plugins clients

Install this repository as a plugin:

- **Cursor:** Plugins → install from GitHub → `smashandclash/plugin`.
- **Other clients:** they read `plugin.json`, `mcp.json` and `skills/`.

### Chat apps (custom connector)

These clients add a remote MCP URL rather than a plugin. It's the same server.

| Client | Add it |
| --- | --- |
| **Claude** | [Add Smash&Clash](https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Smash%26Clash&connectorUrl=https%3A%2F%2Fwww.smashandclash.in%2Fapi%2Fmcp) |
| **ChatGPT** | Settings → Apps & Connectors → Developer Mode → Create. Name `Smash&Clash`, URL `https://www.smashandclash.in/api/mcp`. |
| **Grok** | [grok.com/connectors](https://grok.com/connectors) → New Connector → Custom → paste the URL |
| **Poke** | The published recipe: https://poke.com/r/4eP67qG4ou- |

Then say *"let's play Smash&Clash"*.

## Play while Claude works (Claude Code mod)

`smash-and-clash-mod` is a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview). `/smash` opens a Smash&Clash board in a pane beside the transcript, so you can play a move while Claude works.

- It works in the terminal and in the Desktop app.
- Your game is saved between sessions.
- While Claude works, a line above the prompt says it's your move.

| Key | Does |
| --- | --- |
| `1`-`5` | Pick a card |
| `w` `a` `s` `d` | Move over the board |
| `f` | Play |
| `g` | Suggest a move |
| `x` | Stay put when a hop is offered |
| `n` | New game |

Commands:

- `/smash new` starts a game against the house.
- `/smash duel` opens a duel; `/smash join CODE` joins one.
- `/smash close` closes the pane.

Settings live in `/plugin configure smash-and-clash-mod@smashandclash`:

- your name;
- the house strength (800-1600);
- whether the board opens when Claude starts working.

Mods need Claude Code 2.1.287 or later, where your account has them enabled.

## What the agent does

**Play.** It calls `start_game`, or `create_duel` / `join_duel`, then reads its hand, the board and the legal moves by name. It loops `play_move` (and `wait_for_turn` in a duel) to the end, and shares the replay link. Every position is rebuilt by the server, so only legal moves land.

**Hosted Agent Challenges.** It calls `create_challenge` with its own slug (`claude`, `chatgpt`, `gemini`, `grok`, `copilot`, `perplexity`, `poke`) and sends you the link. An agent hosted on Smash&Clash plays you on its behalf. Then it calls `get_match_result` for the verified result, and `get_agent_profile` / `get_match_history` for its record. Hosted agents are powered by AgentsORG.

## Without MCP

- **REST.** OpenAPI 3.1 at https://www.smashandclash.in/openapi.json:
  - games under `/api/v1/games` (with the cards and the asset kit);
  - players and leaderboards under `/api/v1/players`, `/api/v1/clubs` and `/api/v1/leaderboards`;
  - challenges under `/api/v1/agent`.
- **SDK.** `npm install @smashandclash/sdk`
- **CLI.** `npx smashandclash`. It's a full-screen game for humans, and `--json` for agents.
- **Developer docs.** https://www.smashandclash.in/developers

## Package layout

```text
plugin.json                              Agent Plugins 1.0.0 manifest (extensions.com.openai: the onboarding skill)
mcp.json                                 Agent Plugins MCP config (Streamable HTTP)
skills/<name>/SKILL.md                   seven Agent Skills
com.anthropic.claude-code/               Claude Code extension namespace
  smash-and-clash-mod/                   the mod (its own Claude Code plugin)
.claude-plugin/plugin.json, .mcp.json    Claude Code's manifest and MCP file
.claude-plugin/marketplace.json          Claude Code marketplace: the plugin and the mod
.cursor-plugin/plugin.json               Cursor metadata
```

There is no install script, and there are no secrets. The plugin talks to Smash&Clash's public API only.

MIT licensed. The license covers this plugin's files. The game's art, audio and characters stay Smash&Clash's: free to use in clients and apps built for Smash&Clash, never to present as your own.

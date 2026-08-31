# Smash&Clash Agent Plugin

Portable [Agent Plugins](https://agent-plugins.org/) package that adds the
**Smash&Clash Agent Arena** as a remote MCP server. After install, say
*"let's play Smash&Clash"* — the agent mints a match link, you play in the
browser, then it reads the verified result.

```
MCP:   https://www.smashandclash.in/api/mcp
Auth:  none (Streamable HTTP)
Play:  https://www.smashandclash.in
```

This repo is the plugin. There is no install script and no secrets.

## Install

### Agent Plugins clients (Cursor, Claude Code, …)

Install this repository as a plugin. The client reads `plugin.json` +
`mcp.json` and loads `skills/play-smash-and-clash/`.

**Claude Code**

```text
/plugin marketplace add smashandclash/plugin
/plugin install smash-and-clash@smashandclash
```

**Cursor** — Plugins → install from GitHub → `smashandclash/plugin`.

### Chat apps (custom connector)

These clients add a remote MCP URL rather than a plugin folder. Same server.

| Client | One-tap / one-paste |
|--------|---------------------|
| **Claude** | [Add Smash&Clash](https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Smash%26Clash&connectorUrl=https%3A%2F%2Fwww.smashandclash.in%2Fapi%2Fmcp) |
| **ChatGPT** | Settings → Apps & Connectors → enable Developer Mode → Create. Name `Smash&Clash`, URL `https://www.smashandclash.in/api/mcp`. Then turn the app on in the chat. |
| **Grok** | [grok.com/connectors](https://grok.com/connectors) → New Connector → Custom → paste `https://www.smashandclash.in/api/mcp`. |
| **Poke** | Published recipe: https://poke.com/r/4eP67qG4ou- |

Then say *"let's play Smash&Clash"*.

## What the agent does

The bundled skill is the play recipe:

1. `create_challenge` with **its own** agent slug (`claude`, `chatgpt`, `grok`, …)
   and your name as `challenger`.
2. Sends you the match URL (`https://www.smashandclash.in/?vs=<slug>&ch=<token>`).
3. Polls `get_match_result` until you finish (or the challenge expires).
4. Reads who won, the score, your in-game name + rank, and the replay link.
   Mentions its own record via `get_agent_profile`.

The agent never controls the live game. The server re-simulates every reported
result before filing it.

## Package layout

```text
plugin.json                         Agent Plugins 1.0.0 manifest
mcp.json                            Streamable HTTP → /api/mcp
skills/play-smash-and-clash/        Play recipe (Agent Skills)
.cursor-plugin/plugin.json          Cursor plugin metadata
.claude-plugin/marketplace.json     Claude Code marketplace entry
```

## REST fallback

Agents that cannot speak MCP can import
https://www.smashandclash.in/api/agent/openapi instead. Same Arena, same
challenge links.

Full player-facing docs live with the game at
https://www.smashandclash.in — challenge links, agent profiles
(`/agent/claude`, `/agent/chatgpt`, `/agent/grok`, …), and the Arena itself.

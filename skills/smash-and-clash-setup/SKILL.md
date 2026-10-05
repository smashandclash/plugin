---
name: smash-and-clash-setup
description: Set Smash&Clash up after the plugin is installed - check the connection, learn the player's name, and get them into a first match (you play, they play you via a Hosted Agent Challenge, or they play in the terminal). Use right after install, or when the user asks how to get started with Smash&Clash.
license: MIT
---

# Set up Smash&Clash

Smash&Clash is a two-player strategy board game where every move matters. Get the user from install to a first match in a minute.

1. **Check the connection.** Call `get_rules` on the `smashandclash` MCP server.
   - If it answers, you're connected. Keep the rules in mind; don't read them out.
   - If it fails, the server URL is `https://www.smashandclash.in/api/mcp` (Streamable HTTP, no auth). Ask the user to check that the plugin's MCP server is enabled.
2. **Learn their name.** Ask what to call them. You'll use it as `challenger` in Hosted Agent Challenges and as the name in duels.
3. **Offer three ways in, briefly:**
   - **Watch you play.** You start a game against the house opponent and narrate it (the `play-smash-and-clash` skill).
   - **Play you in the browser.** You send a Hosted Agent Challenge link; an agent hosted on Smash&Clash plays them under your name (the `hosted-agent-challenge` skill, powered by AgentsORG).
   - **Play in the terminal.** `npx smashandclash` opens the game; in Claude Code, the `smash-and-clash-mod` lets them play while you work (`/smash`).
4. **Do what they pick, right away.** Don't explain every option at length; one line each is enough.

Keep it friendly and short. Developers can also start with `npm install @smashandclash/sdk` (the `smash-and-clash-sdk` skill; to build their own client with the official art and sounds, the `smash-and-clash-client` skill) or https://www.smashandclash.in/developers.

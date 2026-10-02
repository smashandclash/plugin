---
name: hosted-agent-challenge
description: Send a human a Smash&Clash Hosted Agent Challenge (powered by AgentsORG) - a link where an agent hosted on Smash&Clash plays them on your behalf, under your agent's name - then read back the verified result, ELO and match history. Use when the user says challenge me, send me a match link, or wants to play against you in the browser.
license: MIT
---

# Hosted Agent Challenge

A Hosted Agent Challenge is a match link for a human. An agent hosted on Smash&Clash plays the match against them on your behalf, under your agent's name, in their browser. You read back the result afterwards. The server re-simulates every reported result before it counts. Hosted agents are powered by AgentsORG (https://www.agents.org.in).

To play a match yourself instead, use the `play-smash-and-clash` skill.

## Your agent slug

Pass your own slug to every tool. Never impersonate another agent.

| You are | `agent` |
| --- | --- |
| Claude | `claude` |
| ChatGPT / GPT | `chatgpt` |
| Gemini | `gemini` |
| Grok | `grok` |
| Copilot | `copilot` |
| Perplexity | `perplexity` |
| Poke | `poke` |

## The flow

1. **Create.** Call `create_challenge` with:
   - `agent`: your slug;
   - `challenger`: the human's name or handle, which groups their history with you;
   - optionally `ruleset`: `classic` or `mutators`.
2. **Send the link.** Send them the returned `url`, for example: "Tap to play me: <url>". The link expires at `expiresAt`.
3. **Check back.** Later, or whenever they nudge you, call `get_match_result` with the `token`:
   - `pending`: they haven't played yet. Say you're waiting.
   - `expired`: offer a fresh challenge.
   - `played`: `result` holds the winner (`agent` / `challenger` / `draw`), both scores, their in-game name and rank, your ELO change, and `replayUrl`. Tell them, and share the replay.
4. **Brag a little.** `get_agent_profile` gives your rating, rank and record. `get_match_history` with `challenger` recalls every match against this human.

## Tone

Playful, competitive, family-friendly, and short. You're the opponent, not the referee.

## Without MCP

- REST: `POST https://www.smashandclash.in/api/v1/agent/challenge` with `{"agent","challenger","ruleset"}`. Poll `GET /api/v1/agent/challenge/{token}`.
- SDK: `sc.challenges.create(...)` and `sc.challenges.waitForResult(token)`.
- CLI: `npx smashandclash challenge claude --challenger Ada`, then `npx smashandclash result <token> --wait`.

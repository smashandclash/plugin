---
name: smash-and-clash-sdk
description: Write code that plays Smash&Clash with the official TypeScript SDK, @smashandclash/sdk (beta) - against the house, agents, people (invite links) or the quick-match queue - hosts matches between two people, watches games, reads replays and Game Reviews, draws its own board with the official card art and animation, reads public player profiles and club leaderboards, or sends Hosted Agent Challenges. Use when the user wants a bot, a strategy, a script, a chat bot or an app built on Smash&Clash.
license: MIT
---

# Smash&Clash SDK

`@smashandclash/sdk` (beta) is a typed client for the Smash&Clash API:

- no dependencies;
- runs on Node 18+, Deno, Bun and in browsers;
- talks to the versioned API at `https://www.smashandclash.in/api/v1`.

```bash
npm install @smashandclash/sdk
```

## Play a game

```ts
import { SmashAndClash, greedyMove } from '@smashandclash/sdk';

const sc = new SmashAndClash();
const game = await sc.games.startHouse({ name: 'My Agent', strength: 1200 }); // 800-1600 ELO

game.view?.hand;        // your cards, each with its cardId
game.legalMoves;        // e.g. ["Pengu@A1", ...]
game.view?.moves;       // the same moves as data: { name, type, cardId, cell, ... }
await game.play(game.legalMoves[0]);   // the house has answered when this resolves

await game.playOut(greedyMove);        // or play to the end with a strategy
console.log(game.winner, game.replayUrl);   // 'you' | 'opponent' | 'draw'
```

## Write a strategy

A strategy is `(view, seat) => moveName`. `view.board` tiles carry `owner` and `sides` (`north`/`east`/`south`/`west`, in board terms: north faces row 3). Hand cards carry `top`/`right`/`bottom`/`left` as printed. For seat B, turn them round:

| Board side | Seat A reads | Seat B reads |
| --- | --- | --- |
| north | top | bottom |
| east | right | left |
| south | bottom | top |
| west | left | right |

`boardSides(card, seat)` does this turn for you. `greedyMove` from the SDK is a working starting point; read its source and improve on it.

Always return a name from `view.legalMoves`. Match hand cards to moves by `cardId`.

## Duels

```ts
const host = await sc.games.createDuel({ name: 'Alpha' });   // share host.code
await host.playOut(myStrategy);                               // waits between turns

const guest = await sc.games.joinDuel('K7QF2M', { name: 'Beta' });
await guest.playOut(myStrategy);
```

Also available:

- `sc.games.openDuels()` lists duels waiting for a second player.
- `sc.games.watch(id)` shows the public board.
- `sc.games.resume(id, playerToken)` picks a game up again later.

`game.playerToken` is a secret: store it like a password.

## Hosted Agent Challenges (powered by AgentsORG)

```ts
const ch = await sc.challenges.create({ agent: 'claude', challenger: 'Ada' });
// send ch.url to the human, then:
const done = await sc.challenges.waitForResult(ch.token);
done.result?.winner;  // 'agent' | 'challenger' | 'draw'
```

`sc.agents.profile(slug)` and `sc.agents.matches(slug, { challenger })` read public records.

## Errors and limits

Failures throw `SmashAndClashError` with `status`, `code`, `message` and `hint`:

- an illegal move is a 422, and its message lists the legal moves;
- not your turn is a 409.

Rate limits:

- A 429 is retried after `Retry-After` (2 retries by default).
- `sc.http.rateLimit` shows what the last response reported.

Docs: https://docs.smashandclash.in · Reference: https://www.smashandclash.in/openapi.json

## People, matchmaking, watching (0.2.0)

```ts
// play a person: they open the link in their browser
const duel = await sc.games.createDuel({ name: 'Bot', opponent: 'person', opponentName: 'Ada' });
send(duel.inviteUrl);
await duel.waitForOpponent();
await duel.playOut(greedyMove);

// host two people (a chat bot): one link each, read the result
const match = await sc.games.createMatch({ players: ['Ada', 'Grace'] });
const end = await match.waitForEnd();
const review = await match.review();           // accuracy, turning point, biggest blunder

// quick match: whoever is waiting
const game = await sc.games.quickMatch({ opponent: 'any' });

// watch and look back
for await (const s of sc.games.spectate(id)) console.log(s.lastMove, s.score);
for await (const m of sc.games.feed(id)) console.log(m.name, m.events);   // 0.4: each move with its events, hands as counts
const { game: onNow } = await sc.games.featured();                        // the game to stream now
// every game's live page on the real board: game.state.watchPage (?overlay=1 for a stream); /tv follows the featured game
await sc.games.replay(id);                       // finished games only
await sc.replays.read('https://www.smashandclash.in/replay#z=...');
await sc.cards();
const sync = await game.sync({ since: 0 });      // your seat's state + public events, to draw your own board
```

Pass `as: 'person'` when a person plays the seat. Nothing returns a card the seat could not see; replays and reviews open once a game is over.

## Your own client, players and leaderboards (0.3.0)

```ts
const cards = await sc.cards();   // image (card face), art (character on transparency), colorHex, versus, animation
const kit = await sc.assets();    // fonts, card back/template, badge colours, attack timing, music, sfx, voices
const { player, clubs } = await sc.players.get('p-k3j9x2m1qa');   // a public profile (id = friend code)
const board = await sc.clubs.get('ABC234');                         // or sc.leaderboards.get('discord:<id>')
cellToRC('C2'); rcToCell({ r: 1, c: 2 }); boardSides(card, 'B');   // board helpers
```

For drawing cards, animating attacks and playing the game's sounds, use the `smash-and-clash-client` skill. The art and audio are free to use in clients built for Smash&Clash, credited, never presented as the user's own.

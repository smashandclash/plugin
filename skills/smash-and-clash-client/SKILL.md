---
name: smash-and-clash-client
description: Build your own Smash&Clash client or UI - a custom board, a game client, a stream overlay, a Discord or Telegram bot that shows cards, a fan site page - with the official card art, attack animation, sounds, fonts and colours, public player profiles and club leaderboards, through @smashandclash/sdk or the REST API. Use when the user wants to draw the game themselves, show Smash&Clash cards or characters, animate attacks, play the game's sounds or voices, or display a player's profile or a leaderboard.
license: MIT
---

# Build a Smash&Clash client

The game runs on the server. A client draws it, sounds like it, and sends moves by name. Everything the official game uses is public:

```ts
import { SmashAndClash, boardSides, cellToRC } from '@smashandclash/sdk';   // 0.3.0+
const sc = new SmashAndClash({ client: 'my-client/1.0' });

const cards = await sc.cards();    // every card: values, colours, face, art, VS art, attack animation
const kit = await sc.assets();     // brand, fonts, card back/template, badge colours, attack timing, audio
```

REST: `GET https://www.smashandclash.in/api/v1/games/cards` and `/api/v1/games/assets`. Fetch both once and cache them: the files they point to never change URL.

## 1. Draw a card

| Field | Use it for |
| --- | --- |
| `image` | The finished card face, values printed on it (563×768). Show a card as the game does. |
| `art` | The character alone, on transparency (800×800). Build your own card around it. |
| `top`/`right`/`bottom`/`left` | Values 1-7, as printed from the owner's side |
| `colorHex` | The frame colour (power tiles boost cards of their colour) |
| `kit.card.sides` | Each value badge's colour: top red `#FD5656`, right yellow `#FFDE59`, bottom blue `#5271FF`, left green `#7ED957` |
| `kit.fonts.display` | Luckiest Guy, for values and titles |
| `kit.card.back` / `kit.card.template` | The face-down card / the game's card as SVG |

- Identify cards by `cardId`, never by name: #5 and #44 are both called Lizzie, with different values.
- On the board, seat B's cards are turned round. Use `boardSides(card, owner)` (north faces row 3), or the board tile's own `sides`.
- Effect cards (101-105) have `image` only.

## 2. Run the game loop

1. Start or join a game (`sc.games.startHouse`, `createDuel`, `quickMatch`, `claim`). Keep `game.playerToken` secret: it is the seat.
2. On your turn `game.view.moves` lists every legal move as data: `{ name, type, cardId, cell, effect, target, dest }`. Highlight the tiles the selected card can go to from it.
3. Play the chosen move by its `name` with `game.play(name)`. Never build a name yourself: copy it from `moves` or `legalMoves`, because the server matches names, not intentions.
4. Between turns, `game.waitForTurn()`. To animate what happened, use `game.sync({ since, wait: 20 })`: each move comes with its public events in order (`cardPlaced`, `cardsCaptured` with the cells that flipped, `cardHopped`, `effectPlayed`, `cardsDrawn`, `gameOver`).
5. Show only what the seat can see. The other hand is a count; never try to learn it.

`cellToRC('C2')` → `{ r: 1, c: 2 }` converts between move cells and sync coordinates.

## 3. Animate attacks

A card with `animation` has three drawings: rest (`art`), `windup` and `strike`, each 1088×1088 and facing right.

- Draw a frame scaled by `animation.artScale` relative to the art, with `animation.pivot` (0-1 across and down: where the character meets the ground) on the art's pivot. Mirror about the pivot to face left.
- Pick the kind from the board:
  - **strike**: the placed card attacks one enemy neighbour and captures it;
  - **stomp**: it attacks several enemy neighbours, capturing at least one;
  - **blocked**: no `cardsCaptured` follows the placement. It never reaches the strike drawing.
- `kit.animation.timing[kind]` gives which drawing shows over the attack's progress (0 to 1). Cut between drawings at those marks while the card moves.
- `animation: null` (Poe, #46, today): animate the `art` itself with a lean and a lunge.

## 4. Play the sounds

`kit.audio` has lists of MP3 URLs; pick one at random each time, as the game does.

| When | Play |
| --- | --- |
| A card is placed | `voices[id].place` |
| The attacker captured n cards | `voices[id].capture[min(n, 4)]` |
| A card attacks again in the same turn after a hop | `voices[id].chain['2'…'4']` |
| An attack captured nothing | `voices[id].blocked` |
| A card was just captured (about 300 ms after the flip) | `voices[victimId].hurt` |
| The winner is revealed | `voices[championId].win` |

One voice line at a time: capture beats hurt, hurt beats place. Music is by state (`menu`, `matchmaking`, `battle`, `victory`, `defeat`, `replay`); effects are in `sfx` (`clashHit`, `cardPlace`, `boulder`, …); the announcer in `announcer`.

## 5. Show players and leaderboards

```ts
const { player, clubs } = await sc.players.get(id);        // id = their friend code
const board = await sc.clubs.get('ABC234', { limit: 20 });  // or sc.leaderboards.get('discord:<id>' | 'whop:<id>')
```

Profiles and standings are what players publish from the game: public and read-only. Show them; never build rewards on them.

## Rules that keep a client right

- **Credit and ownership.** The art, audio, characters and the Smash&Clash name are free to use in clients built for Smash&Clash. Credit Smash&Clash where you show them, and never present the characters as the user's or your own. `kit.terms` carries the wording.
- **Fair play.** A client never shows a seat a card it could not see at the table, and never offers a move that isn't in `legalMoves`.
- **Names, not labels.** Show every player by name (the house opponent plays under one too). Never call an opponent "CPU".

Docs: https://docs.smashandclash.in/build/overview · The `smash-and-clash-sdk` skill covers the rest of the SDK.

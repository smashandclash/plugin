// Smash&Clash mod for Claude Code: play Smash&Clash, a two-player strategy
// board game where every move matters, in a pane while Claude works.
//
//   /smash              open the board (resumes your game, or starts one)
//   /smash new          a new game against the Smash&Clash house opponent
//   /smash duel         open a duel; /smash join CODE joins one
//   /smash close        close the pane (the game stays saved)
//
// Keys in the pane: 1-5 pick a card, w a s d move over the board, f plays,
// g suggests a move, x stays put when a hop is offered, n starts a new game.
// The game lives on www.smashandclash.in and is saved between sessions.

import { boardRaster, boardText, cellAt, handLabel, movesFor, outcome, parseMove, screenOf, targetsFor } from './game.js'

const PANE = 'smash'
const VERSION = '0.1.0'

let opts = { base: 'https://www.smashandclash.in', name: 'Claude Code player', strength: 1200, autoOpen: false }

/** The game as the API last returned it, and your seat's secret token. */
let game = null
let token = null
/** The hand card picked, the board cursor, and whether the cursor is in play. */
let card = 0
let cursor = { sx: 2, sy: 2 }
let onBoard = false
let recruitFrom = null
/** What the pane says: work in flight, the last thing that happened. */
let busy = ''
let note = ''
let working = false
let paneOpen = false
let polling = false

/* --------------------------------- network --------------------------------- */

async function api($, method, path, body) {
  const headers = { accept: 'application/json', 'x-sdk': `smash-and-clash-mod/${VERSION}` }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token && !path.endsWith('/games') && !path.endsWith('/join')) headers.authorization = `Bearer ${token}`
  const r = await $.http.fetch(opts.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  let data = null
  try {
    data = r.text ? JSON.parse(r.text) : null
  } catch {
    data = null
  }
  if (!r.ok) {
    const msg = typeof data?.error === 'string' ? data.error : data?.error?.message ?? `The server said ${r.status}.`
    throw new Error(msg)
  }
  return data
}

async function save($) {
  if (game && token) await $.store.set('game', { id: game.id, token, base: opts.base })
}

/** A new game, a joined duel or a resumed one: point the controls at it. */
function adopt(next, nextToken) {
  game = next
  if (nextToken) token = nextToken
  card = 0
  onBoard = false
  recruitFrom = null
  settle()
}

/** After any change: keep the picked card playable and the cursor on a legal tile. */
function settle() {
  const v = game?.view
  recruitFrom = null
  if (!v?.yourTurn) {
    onBoard = false
    return
  }
  if (v.pendingHop) {
    onBoard = true
    const first = [...targetsFor(v, card, null).keys()][0]
    if (first) cursor = screenOf(game.seat ?? 'A', first)
    return
  }
  const playable = (v.hand ?? []).map((h) => movesFor(v, h.card).length > 0)
  if (!playable[card]) card = Math.max(0, playable.indexOf(true))
  onBoard = false
}

async function startHouse($) {
  busy = 'Starting a game against the house'
  $.ui.invalidate('ui.render')
  try {
    token = null
    const r = await api($, 'POST', '/api/v1/games', { mode: 'house', name: opts.name, strength: opts.strength })
    adopt(r.game, r.playerToken)
    note = 'Your turn: pick a card (1-5), move over the board (w a s d), f plays.'
    await save($)
  } catch (err) {
    note = err.message
  }
  busy = ''
  $.ui.invalidate('ui.render')
}

async function createDuel($) {
  busy = 'Opening a duel'
  $.ui.invalidate('ui.render')
  try {
    token = null
    const r = await api($, 'POST', '/api/v1/games', { mode: 'duel', name: opts.name })
    adopt(r.game, r.playerToken)
    note = `Duel code ${r.game.code}: the other side runs /smash join ${r.game.code}, or smashandclash duel join ${r.game.code}.`
    await save($)
    pollTurn($)
  } catch (err) {
    note = err.message
  }
  busy = ''
  $.ui.invalidate('ui.render')
}

async function joinDuel($, code) {
  busy = `Joining duel ${code}`
  $.ui.invalidate('ui.render')
  try {
    token = null
    const r = await api($, 'POST', '/api/v1/games/join', { code: code.toUpperCase(), name: opts.name })
    adopt(r.game, r.playerToken)
    note = `Joined ${r.game.players?.A ?? 'the duel'}.`
    await save($)
    pollTurn($)
  } catch (err) {
    note = err.message
  }
  busy = ''
  $.ui.invalidate('ui.render')
}

/** Pick up the saved game, or start one if there is none (or it ended). */
async function resumeOrStart($) {
  const saved = await $.store.get('game')
  if (saved?.id && saved?.token && (saved.base ?? opts.base) === opts.base) {
    busy = 'Picking your game up again'
    $.ui.invalidate('ui.render')
    try {
      token = saved.token
      const g = await api($, 'GET', `/api/v1/games/${encodeURIComponent(saved.id)}`)
      if (g.status !== 'finished' && g.status !== 'abandoned') {
        adopt(g)
        note = g.view?.yourTurn ? 'Your turn.' : 'Welcome back.'
        busy = ''
        pollTurn($)
        $.ui.invalidate('ui.render')
        return
      }
    } catch {
      // gone or expired: start a new one
    }
    busy = ''
  }
  await startHouse($)
}

async function play($, move) {
  if (!game || busy) return
  const before = game
  busy = `Playing ${move}`
  $.ui.invalidate('ui.render')
  try {
    const next = await api($, 'POST', `/api/v1/games/${encodeURIComponent(game.id)}/moves`, { move })
    game = next
    const theirs = next.lastMove && next.lastMove !== move && next.moveCount - before.moveCount > 1 ? `, they played ${next.lastMove}` : ''
    note = next.status === 'finished' ? outcome(next) : `You played ${move}${theirs}.`
    settle()
    await save($)
    if (next.status === 'active' && !next.view?.yourTurn) pollTurn($)
  } catch (err) {
    note = err.message
  }
  busy = ''
  $.ui.invalidate('ui.render')
}

/** Duels: wait for the other side in the background, a long poll at a time. */
function pollTurn($) {
  if (polling) return
  polling = true
  $.clock.after(0, () => waitOnce($))
}

async function waitOnce($) {
  if (!game || game.kind !== 'duel' || game.status === 'finished' || game.status === 'abandoned' || game.view?.yourTurn) {
    polling = false
    return
  }
  try {
    const before = game
    const next = await api($, 'GET', `/api/v1/games/${encodeURIComponent(game.id)}/wait?timeout=20`)
    if (game?.id === next.id) {
      game = next
      if (next.moveCount !== before.moveCount || next.status !== before.status) {
        note = next.status === 'finished' ? outcome(next) : next.lastMove ? `They played ${next.lastMove}. Your turn.` : 'They joined. Your turn.'
        settle()
        $.ui.invalidate('ui.render')
        if (next.view?.yourTurn) $.ui.toast(paneOpen ? 'Your move.' : 'Your move in Smash&Clash: /smash')
      }
    }
  } catch (err) {
    note = err.message
    polling = false
    $.ui.invalidate('ui.render')
    return
  }
  $.clock.after(250, () => waitOnce($))
}

/* ----------------------------------- keys ---------------------------------- */

function pickCard(i) {
  const v = game?.view
  if (!v?.yourTurn || !v.hand?.[i]) return
  card = i
  recruitFrom = null
  const moves = movesFor(v, v.hand[i].card)
  if (!moves.length) {
    note = `No legal move for ${v.hand[i].card} right now.`
    onBoard = false
    return
  }
  onBoard = true
  const seat = game.seat ?? 'A'
  const targets = targetsFor(v, card, null)
  if (!targets.has(cellAt(seat, cursor.sx, cursor.sy))) {
    const first = [...targets.keys()][0]
    if (first) cursor = screenOf(seat, first)
  }
  note = moves.some((m) => m.kind === 'instant') ? `${v.hand[i].card}: f plays it.` : `${v.hand[i].card}: pick a tile (w a s d), f plays.`
}

function moveCursor(dx, dy) {
  onBoard = true
  cursor = { sx: Math.max(0, Math.min(4, cursor.sx + dx)), sy: Math.max(0, Math.min(2, cursor.sy + dy)) }
}

/** f: play the picked card on the cursor's tile (or the instant effect). */
async function playHere($) {
  const v = game?.view
  if (!v?.yourTurn || busy) return
  const seat = game.seat ?? 'A'
  const h = v.hand?.[card]
  if (!v.pendingHop && h) {
    const instant = movesFor(v, h.card).find((m) => m.kind === 'instant')
    if (instant) return play($, instant.name)
  }
  const cell = cellAt(seat, cursor.sx, cursor.sy)
  const move = targetsFor(v, card, recruitFrom).get(cell)
  if (!move) {
    note = v.pendingHop ? `Can't hop to ${cell}.` : `${h?.card ?? 'That card'} can't go to ${cell}.`
    $.ui.invalidate('ui.render')
    return
  }
  const m = parseMove(move)
  if (!v.pendingHop && m.kind === 'recruit' && !recruitFrom) {
    recruitFrom = cell
    note = `Recruit the card at ${cell}: now pick where it goes, f plays.`
    $.ui.invalidate('ui.render')
    return
  }
  return play($, move)
}

/** g: a simple suggestion - the move that wins the most touching sides. */
function suggest() {
  const v = game?.view
  if (!v?.yourTurn) return
  const seat = game.seat ?? 'A'
  let best = null
  for (const [i, h] of (v.hand ?? []).entries()) {
    if (h.kind !== 'character') continue
    const mine = seat === 'B' ? { north: h.bottom, east: h.left, south: h.top, west: h.right } : { north: h.top, east: h.right, south: h.bottom, west: h.left }
    for (const m of movesFor(v, h.card)) {
      if (m.kind !== 'place') continue
      const c = 'ABCDE'.indexOf(m.cell[0])
      const r = Number(m.cell.slice(1))
      let gain = 0
      for (const [dc, dr, my, their] of [[0, 1, 'north', 'south'], [0, -1, 'south', 'north'], [1, 0, 'east', 'west'], [-1, 0, 'west', 'east']]) {
        const t = v.board.find((b) => b.cell === `${'ABCDE'[c + dc] ?? '?'}${r + dr}`)
        if (t?.owner === 'opponent' && !t.frozen && t.sides && mine[my] >= t.sides[their]) gain++
      }
      if (!best || gain > best.gain) best = { i, cell: m.cell, gain, name: m.name }
    }
  }
  if (!best) {
    note = 'No suggestion - try an effect card.'
    return
  }
  card = best.i
  onBoard = true
  recruitFrom = null
  cursor = screenOf(seat, best.cell)
  note = `Suggestion: ${best.name}${best.gain ? ` (smashes ${best.gain})` : ''} - f plays it.`
}

/* --------------------------------- drawing --------------------------------- */

function statusLine() {
  if (!game) return 'Smash&Clash'
  const v = game.view
  const you = v?.score?.you ?? 0
  const them = v?.score?.opponent ?? 0
  const turn = game.status === 'waiting' ? `waiting for someone to join (code ${game.code})` : game.status === 'finished' || game.status === 'abandoned' ? outcome(game) : v?.yourTurn ? 'your turn' : `${v?.opponent ?? 'their'} turn`
  return `You ${you} - ${them} ${v?.opponent ?? ''}  ·  ${turn}`
}

export function register(on, options) {
  opts = {
    base: String(options?.api_base || 'https://www.smashandclash.in').replace(/\/+$/, ''),
    name: String(options?.player_name || 'Claude Code player').slice(0, 40),
    strength: Math.max(800, Math.min(1600, Number(options?.strength) || 1200)),
    autoOpen: options?.auto_open === true,
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'smash',
      description: 'Play Smash&Clash while Claude works',
      argumentHint: '[new | duel | join CODE | close]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'smash' }, async ($, e) => {
    const [verb = '', arg = ''] = String(e.args ?? '').trim().split(/\s+/)
    if (verb === 'close') {
      await $.ui.close({ id: PANE })
      paneOpen = false
      return {}
    }
    const placed = await $.ui.open({ id: PANE, title: 'Smash&Clash', focus: true, closeOnEscape: true })
    paneOpen = placed?.isPlaced !== false
    if (verb === 'new') await startHouse($)
    else if (verb === 'duel') await createDuel($)
    else if (verb === 'join' && arg) await joinDuel($, arg)
    else if (!game || game.status === 'finished' || game.status === 'abandoned') await resumeOrStart($)
    return {}
  })

  on('turn.start', async ($, e, next) => {
    working = true
    if (opts.autoOpen && !paneOpen) {
      const placed = await $.ui.open({ id: PANE, title: 'Smash&Clash' })
      paneOpen = placed?.isPlaced === true
    }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    working = false
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) paneOpen = false
    return next(e)
  })

  // The band above the prompt, while Claude works and the pane is closed.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!e.props.isWorking || paneOpen) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const theirs = await next(e)
    const line = Text({
      dimColor: true,
      wrap: 'truncate',
      children: [game && game.status === 'active' ? `Smash&Clash · ${statusLine()} · /smash to play` : 'Waiting on Claude? Play Smash&Clash: /smash'],
    })
    return Box({ flexDirection: 'column', children: theirs ? [theirs, line] : [line] })
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const redraw = () => $.ui.invalidate('ui.render')
    const width = e.props.bodyColumns ?? 60
    const rows = []

    rows.push(Text({ bold: true, color: 'blue', children: ['SMASH&CLASH'] }))
    rows.push(Text({ wrap: 'truncate', children: [statusLine()] }))
    if (working) rows.push(Text({ dimColor: true, children: ['Claude is working - your move.'] }))

    if (!game || !game.view) {
      if (game?.status === 'waiting') rows.push(Text({ children: [`Duel code ${game.code}. The other side runs /smash join ${game.code}.`] }))
      rows.push(Text({ dimColor: true, children: [busy || note || 'Starting...'] }))
      if (!busy) rows.push(Button({ key: 'new', label: 'New game', hotkey: 'n', plain: true, onPress: () => startHouse($) }))
      return Box({ flexDirection: 'column', rowGap: 1, children: rows })
    }

    const v = game.view
    const seat = game.seat ?? 'A'
    const over = game.status === 'finished' || game.status === 'abandoned'
    const targets = over ? new Map() : targetsFor(v, card, recruitFrom)
    const cellW = width >= 58 ? 9 : 7
    const drawOpts = { cellW, cursor: onBoard && v.yourTurn && !over ? cellAt(seat, cursor.sx, cursor.sy) : null, targets: new Set(targets.keys()) }
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const r = boardRaster(v, seat, drawOpts)
      rows.push(Raster({ key: 'board', columns: r.columns, rows: r.rows, cells: r.cells }))
    } else {
      rows.push(Text({ children: [boardText(v, seat, drawOpts).join('\n')] }))
    }

    if (!over && v.yourTurn && !v.pendingHop) {
      rows.push(
        Box({
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: 2,
          children: (v.hand ?? []).map((h, i) =>
            Button({
              key: `card-${i}`,
              label: `${i === card ? '>' : ''}${handLabel(h)}`,
              hotkey: String(i + 1),
              plain: true,
              dimColor: i !== card || movesFor(v, h.card).length === 0,
              onPress: () => {
                pickCard(i)
                redraw()
              },
            }),
          ),
        }),
      )
    }

    if (!over && v.yourTurn) {
      const controls = [
        Button({ key: 'up', label: 'up', hotkey: 'w', plain: true, onPress: () => (moveCursor(0, -1), redraw()) }),
        Button({ key: 'left', label: 'left', hotkey: 'a', plain: true, onPress: () => (moveCursor(-1, 0), redraw()) }),
        Button({ key: 'down', label: 'down', hotkey: 's', plain: true, onPress: () => (moveCursor(0, 1), redraw()) }),
        Button({ key: 'right', label: 'right', hotkey: 'd', plain: true, onPress: () => (moveCursor(1, 0), redraw()) }),
        Button({ key: 'play', label: 'play', hotkey: 'f', plain: true, autoFocus: true, onPress: () => playHere($) }),
      ]
      if (v.pendingHop) {
        const stay = (v.legalMoves ?? []).map(parseMove).find((m) => m.kind === 'stay')
        if (stay) controls.push(Button({ key: 'stay', label: 'stay', hotkey: 'x', plain: true, onPress: () => play($, stay.name) }))
      } else controls.push(Button({ key: 'hint', label: 'suggest', hotkey: 'g', plain: true, onPress: () => (suggest(), redraw()) }))
      rows.push(Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children: controls }))
    }

    rows.push(Text({ wrap: 'wrap', dimColor: !busy, children: [busy ? `${busy}...` : note || ' '] }))

    if (over) {
      if (game.replayUrl) rows.push(Link({ href: game.replayUrl, label: 'Watch the replay' }))
      rows.push(Button({ key: 'new', label: 'New game', hotkey: 'n', plain: true, autoFocus: true, onPress: () => startHouse($) }))
    }
    return Box({ flexDirection: 'column', rowGap: 1, children: rows })
  })
}

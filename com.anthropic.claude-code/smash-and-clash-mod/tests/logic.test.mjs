// node --test tests/logic.test.mjs
//
// The mod's logic on a small stand-in for Claude Code's mods runtime: hooks
// are registered with `on`, the `$` API answers from fakes, elements are plain
// objects, and buttons are pressed by key. `claude plugin test` runs
// tests/smash.test.ts on the real runtime wherever mods are enabled.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { base64, boardRaster, cellAt, movesFor, parseMove, screenOf, targetsFor } from '../hooks/game.js'

const EMPTY = 'ABCDE'.split('').flatMap((c) => [1, 2, 3].map((r) => ({ cell: `${c}${r}` })))
const VIEW = {
  yourTurn: true,
  score: { you: 0, opponent: 0 },
  opponent: 'Smash&Clash House',
  board: EMPTY,
  hand: [
    { card: 'Pengu', kind: 'character', top: 5, right: 3, bottom: 2, left: 4, color: 'blue' },
    { card: 'Flip!', kind: 'effect', does: 'Turn the board round.' },
  ],
  special: { chessTiles: [{ cell: 'B2', piece: 'rook' }], powerTiles: [] },
  legalMoves: [...EMPTY.map((t) => `Pengu@${t.cell}`), 'FLIP'],
}
const ACTIVE = { id: 'g_test', kind: 'house', status: 'active', seat: 'A', players: { A: 'You', B: 'House' }, moveCount: 0, lastMove: null, score: { A: 0, B: 0 }, winner: null, view: VIEW }
const FINISHED = { ...ACTIVE, status: 'finished', moveCount: 2, lastMove: 'Volt@A3', score: { A: 9, B: 6 }, winner: 'A', replayUrl: 'https://www.smashandclash.in/replay#z=abc', view: { ...VIEW, yourTurn: false, legalMoves: [] } }

let fresh = 0

/** A fresh copy of the module per runtime, as Claude Code loads it for each test. */
async function runtime(options = {}, saved = new Map()) {
  const { register } = await import(`../hooks/register.js?run=${++fresh}`)
  const hooks = []
  register((event, a, b) => hooks.push({ event, match: b ? a : null, fn: b ?? a }), options)
  const calls = []
  const store = saved
  const el = (type) => (props) => ({ type, props, children: props.children })
  const $ = {
    command: { register: async () => undefined },
    store: { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) },
    ui: {
      open: async () => ({ isPlaced: true }),
      close: async () => undefined,
      invalidate: () => undefined,
      toast: () => undefined,
      resolve: () => ({ Box: el('Box'), Text: el('Text'), Button: el('Button'), Link: el('Link'), Raster: el('Raster') }),
    },
    clock: { after: () => ({ cancel() {} }) },
    http: {
      fetch: async (url, init = {}) => {
        const method = init.method ?? 'GET'
        calls.push({ url, method, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.authorization })
        const ok = (d) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(d) })
        if (method === 'POST' && url.endsWith('/api/v1/games')) return ok({ game: ACTIVE, playerToken: 'pt_test' })
        if (method === 'POST' && url.endsWith('/moves')) {
          const move = JSON.parse(init.body).move
          if (move === 'Nobody@Z9') return { status: 422, ok: false, headers: {}, text: JSON.stringify({ error: 'Not a legal move. Legal moves: ...' }) }
          return ok(FINISHED)
        }
        if (method === 'GET' && url.endsWith('/g_saved')) return ok({ ...ACTIVE, id: 'g_saved' })
        return { status: 404, ok: false, headers: {}, text: '{"error":"no such game"}' }
      },
    },
  }
  const fire = async (event, e, filter = () => true) => {
    let result = null
    for (const h of hooks.filter((x) => x.event === event && filter(x))) result = await h.fn($, e, async (x) => ({ passed: x ?? e }))
    return result
  }
  const render = (surface = 'terminal', props = {}) =>
    fire('ui.render', { component: 'Pane', requestId: 'smash', surface, props: { bodyColumns: 60, ...props } }, (h) => h.match?.component === 'Pane')
  const all = (node, out = []) => {
    if (!node || typeof node !== 'object') return out
    out.push(node)
    for (const c of node.children ?? []) all(c, out)
    return out
  }
  const find = async (pred, surface) => all(await render(surface)).find(pred)
  const press = async (key) => {
    const b = await find((n) => n.type === 'Button' && n.props.key === key)
    assert.ok(b, `no button ${key}`)
    await b.props.onPress()
  }
  const text = async (surface) => all(await render(surface)).filter((n) => n.type === 'Text').map((n) => n.children.join('')).join('\n')
  return { hooks, calls, store, fire, render, find, press, text }
}

test('the move grammar and the seat-aware board', () => {
  assert.deepEqual(parseMove('Pengu@C2'), { name: 'Pengu@C2', card: 'Pengu', kind: 'place', cell: 'C2' })
  assert.equal(parseMove('Pengu!B2').kind, 'overrun')
  assert.deepEqual(parseMove('RECRUIT(A3→B1)'), { name: 'RECRUIT(A3→B1)', card: 'RECRUIT', kind: 'recruit', from: 'A3', cell: 'B1' })
  assert.equal(parseMove('FLIP').kind, 'instant')
  assert.equal(parseMove('hop→E3').cell, 'E3')
  assert.equal(parseMove('hop: stay').kind, 'stay')
  assert.equal(cellAt('A', 0, 0), 'A3')
  assert.equal(cellAt('B', 0, 0), 'E1')
  assert.deepEqual(screenOf('B', 'E1'), { sx: 0, sy: 0 })
  assert.deepEqual([...targetsFor(VIEW, 0, null).keys()].length, 15)
  assert.equal(targetsFor({ ...VIEW, yourTurn: false }, 0, null).size, 0)
})

test('the board Raster: one cell = code point, colour, background (3 x uint32)', () => {
  const r = boardRaster(VIEW, 'A', { cellW: 9, cursor: 'C1', targets: new Set(['A1']) })
  assert.equal(r.columns, 2 + 5 * 9 + 4)
  assert.equal(r.rows, 12)
  const bytes = Uint8Array.from(Buffer.from(r.cells, 'base64'))
  assert.equal(bytes.length, r.columns * r.rows * 12)
  const words = new Uint32Array(bytes.buffer)
  // the column letter A sits above the first tile
  const at = (x, y) => words.slice((y * r.columns + x) * 3, (y * r.columns + x) * 3 + 3)
  assert.equal(String.fromCodePoint(at(2 + 4, 0)[0]), 'A')
  // the cursor tile (C1, bottom middle) is painted yellow
  assert.equal(at(2 + 2 * 10 + 1, 1 + 2 * 4)[2], 0xffd23f)
  // base64 matches Node's
  const sample = Uint8Array.from([1, 2, 3, 250, 251])
  assert.equal(base64(sample), Buffer.from(sample).toString('base64'))
})

test('/smash starts a house game, saves it, draws the Raster and the hand', async () => {
  const rt = await runtime()
  await rt.fire('session.start', {})
  await rt.fire('command.run', { command: 'smash', args: '' })
  assert.deepEqual(rt.calls[0], { url: 'https://www.smashandclash.in/api/v1/games', method: 'POST', body: { mode: 'house', name: 'Claude Code player', strength: 1200 }, auth: undefined })
  assert.deepEqual(rt.store.get('game'), { id: 'g_test', token: 'pt_test', base: 'https://www.smashandclash.in' })
  assert.ok(await rt.find((n) => n.type === 'Raster' && n.props.key === 'board'))
  assert.match(await rt.text(), /You 0 - 0 Smash&Clash House\s+·\s+your turn/)
  assert.ok(await rt.find((n) => n.type === 'Button' && n.props.key === 'card-0' && n.props.hotkey === '1'))
  // desktop: text board, no Raster
  assert.equal(await rt.find((n) => n.type === 'Raster', 'desktop'), undefined)
  assert.match(await rt.text('desktop'), /\[rook\]/)
})

test('a card, w, f: the move goes with your token; the result and the replay show', async () => {
  const rt = await runtime({ strength: 1500, player_name: 'Ada' })
  await rt.fire('session.start', {})
  await rt.fire('command.run', { command: 'smash', args: '' })
  assert.deepEqual(rt.calls[0].body, { mode: 'house', name: 'Ada', strength: 1500 })
  await rt.press('card-0')
  assert.match(await rt.text(), /Pengu: pick a tile/)
  await rt.press('up')
  await rt.press('play')
  const move = rt.calls.find((c) => c.url.endsWith('/moves'))
  assert.deepEqual({ body: move.body, auth: move.auth }, { body: { move: 'Pengu@C2' }, auth: 'Bearer pt_test' })
  assert.match(await rt.text(), /You won 9-6!/)
  assert.ok(await rt.find((n) => n.type === 'Link' && n.props.href.includes('/replay#z=')))
  assert.ok(await rt.find((n) => n.type === 'Button' && n.props.key === 'new'))
})

test('an instant effect plays at once; suggest points at a placement', async () => {
  const rt = await runtime()
  await rt.fire('session.start', {})
  await rt.fire('command.run', { command: 'smash', args: '' })
  await rt.press('hint')
  assert.match(await rt.text(), /Suggestion: Pengu@[A-E][1-3]/)
  await rt.press('card-1')
  await rt.press('play')
  assert.deepEqual(rt.calls.find((c) => c.url.endsWith('/moves')).body, { move: 'FLIP' })
})

test('/smash resumes a saved game instead of starting one', async () => {
  const rt = await runtime({}, new Map([['game', { id: 'g_saved', token: 'pt_saved', base: 'https://www.smashandclash.in' }]]))
  await rt.fire('session.start', {})
  await rt.fire('command.run', { command: 'smash', args: '' })
  assert.equal(rt.calls.length, 1)
  assert.deepEqual(rt.calls[0], { url: 'https://www.smashandclash.in/api/v1/games/g_saved', method: 'GET', body: undefined, auth: 'Bearer pt_saved' })
})

test('the band above the prompt invites /smash while Claude works and the pane is closed', async () => {
  const rt = await runtime()
  await rt.fire('session.start', {})
  const band = await rt.fire('ui.render', { component: 'AbovePrompt', props: { isWorking: true } }, (h) => h.match?.component === 'AbovePrompt')
  const texts = JSON.stringify(band)
  assert.match(texts, /Waiting on Claude\? Play Smash&Clash: \/smash/)
  // idle: Claude Code's own band, untouched
  const idle = await rt.fire('ui.render', { component: 'AbovePrompt', props: { isWorking: false } }, (h) => h.match?.component === 'AbovePrompt')
  assert.deepEqual(Object.keys(idle), ['passed'])
})

test('Lizzie and Lizzie Jr.: each card gets only its own moves', () => {
  assert.deepEqual(parseMove('Lizzie Jr.@C2'), { name: 'Lizzie Jr.@C2', card: 'Lizzie Jr.', kind: 'place', cell: 'C2' })
  const view = {
    yourTurn: true,
    hand: [
      { card: 'Lizzie', cardId: 5, kind: 'character', top: 6, right: 6, bottom: 6, left: 6 },
      { card: 'Lizzie Jr.', cardId: 44, kind: 'character', top: 6, right: 4, bottom: 5, left: 5 },
    ],
    legalMoves: ['Lizzie@A1', 'Lizzie Jr.@B1'],
  }
  assert.deepEqual([...targetsFor(view, 0, null).entries()], [['A1', 'Lizzie@A1']])
  assert.deepEqual([...targetsFor(view, 1, null).entries()], [['B1', 'Lizzie Jr.@B1']])
  assert.equal(movesFor(view, view.hand[1]).length, 1)
  assert.equal(movesFor(view, 'Lizzie').length, 1)
})

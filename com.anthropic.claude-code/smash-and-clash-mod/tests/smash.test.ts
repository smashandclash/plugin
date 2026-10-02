import { expect, test } from 'claude-code/testing'

// A tiny stand-in for the Smash&Clash games API: one game, one move to the end.
const EMPTY = 'ABCDE'.split('').flatMap((c) => [1, 2, 3].map((r) => ({ cell: `${c}${r}` })))
const VIEW = {
  inGame: true,
  ruleset: 'mutators',
  yourTurn: true,
  gameOver: false,
  winner: null,
  score: { you: 0, opponent: 0 },
  opponent: 'Smash&Clash House',
  board: EMPTY,
  hand: [
    { card: 'Pengu', kind: 'character', top: 5, right: 3, bottom: 2, left: 4, color: 'blue' },
    { card: 'Flip!', kind: 'effect', does: 'Turn the board round.' },
  ],
  drawPile: 30,
  special: { chessTiles: [{ cell: 'B2', piece: 'rook' }], powerTiles: [], overrunZones: [] },
  legalMoves: [...EMPTY.map((t) => `Pengu@${t.cell}`), 'FLIP'],
}
const ACTIVE = {
  id: 'g_test',
  kind: 'house',
  status: 'active',
  ruleset: 'mutators',
  seat: 'A',
  players: { A: 'Claude Code player', B: 'Smash&Clash House' },
  turn: 'A',
  moveCount: 0,
  lastMove: null,
  score: { A: 0, B: 0 },
  winner: null,
  view: VIEW,
  watchUrl: 'https://www.smashandclash.in/api/v1/games/g_test',
}
const FINISHED = {
  ...ACTIVE,
  status: 'finished',
  turn: null,
  moveCount: 2,
  lastMove: 'Volt@A3',
  score: { A: 9, B: 6 },
  winner: 'A',
  replayUrl: 'https://www.smashandclash.in/replay#z=abc',
  view: { ...VIEW, yourTurn: false, gameOver: true, score: { you: 9, opponent: 6 }, legalMoves: [] },
}

const PANE = {
  plugin: 'smash-and-clash-mod',
  component: 'Pane',
  requestId: 'smash',
  viewport: { columns: 140, rows: 40 },
  props: { title: 'Smash&Clash', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

type Call = { url: string; method: string; body: unknown; auth?: string }

function server(on: (name: string, fn: (...args: any[]) => unknown) => void, calls: Call[], saved = new Map<string, unknown>()) {
  on('command.register', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('store.get', ($: unknown, e: { key: string }) => ({ value: saved.get(e.key) }))
  on('store.set', ($: unknown, e: { key: string; value: unknown }) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/work' }))
  on('http.fetch', ($: unknown, e: { url: string; init?: { method?: string; body?: string; headers?: Record<string, string> } }) => {
    const method = e.init?.method ?? 'GET'
    const body = e.init?.body ? JSON.parse(e.init.body) : undefined
    calls.push({ url: e.url, method, body, auth: e.init?.headers?.authorization })
    const ok = (data: unknown) => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify(data) } })
    if (method === 'POST' && e.url.endsWith('/api/v1/games')) return ok({ game: ACTIVE, playerToken: 'pt_test' })
    if (method === 'POST' && e.url.endsWith('/api/v1/games/g_test/moves')) return ok(FINISHED)
    if (method === 'GET' && e.url.endsWith('/api/v1/games/g_saved')) return ok({ ...ACTIVE, id: 'g_saved' })
    return { value: { status: 404, ok: false, headers: {}, text: JSON.stringify({ code: 'not_found', error: 'no such game' }) } }
  })
}

test('/smash starts a game against the house and draws the board as a Raster', async ($, on) => {
  const calls: Call[] = []
  const saved = new Map<string, unknown>()
  server(on, calls, saved)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'smash', args: '' })

  expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://www.smashandclash.in/api/v1/games', body: { mode: 'house', strength: 1200 } })
  expect(saved.get('game')).toEqual({ id: 'g_test', token: 'pt_test', base: 'https://www.smashandclash.in' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'SMASH&CLASH' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /You 0 - 0 Smash&Clash House\s+·\s+your turn/ })).toBeDefined()
  const board = await ui.find({ key: 'board' })
  expect(board?.type).toBe('Raster')
  expect((board?.props as { columns: number }).columns).toBe(2 + 5 * 9 + 4)
  expect(await ui.find({ key: 'card-0' })).toBeDefined()
  expect(await ui.find({ key: 'card-1' })).toBeDefined()
  await ui.unmount()
})

test('a card, a tile, f: the move goes to the server with your token; the result and the replay show', async ($, on) => {
  const calls: Call[] = []
  server(on, calls)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'smash', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'card-0' })
  expect(await ui.find({ type: 'Text', text: /Pengu: pick a tile/ })).toBeDefined()
  // the cursor starts mid-bottom (C1); w moves it up to C2
  await ui.press({ key: 'up' })
  await ui.press({ key: 'play' })
  const move = calls.find((c) => c.url.endsWith('/moves'))
  expect(move).toMatchObject({ method: 'POST', body: { move: 'Pengu@C2' }, auth: 'Bearer pt_test' })
  expect(await ui.find({ type: 'Text', text: /You won 9-6!/ })).toBeDefined()
  expect(await ui.find({ type: 'Link' })).toBeDefined()
  expect(await ui.find({ key: 'new' })).toBeDefined()
  await ui.unmount()
})

test('an instant effect plays at once; suggest picks a placement', async ($, on) => {
  const calls: Call[] = []
  server(on, calls)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'smash', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'hint' })
  expect(await ui.find({ type: 'Text', text: /Suggestion: Pengu@[A-E][1-3]/ })).toBeDefined()
  await ui.press({ key: 'card-1' })
  await ui.press({ key: 'play' })
  expect(calls.find((c) => c.url.endsWith('/moves'))?.body).toEqual({ move: 'FLIP' })
  await ui.unmount()
})

test('the desktop app gets the board as text (it has no Raster)', async ($, on) => {
  server(on, [])
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'smash', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'board' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /\[rook\]/ })).toBeDefined()
  await ui.unmount()
})

test('/smash picks a saved game up again instead of starting a new one', async ($, on) => {
  const calls: Call[] = []
  const saved = new Map<string, unknown>([['game', { id: 'g_saved', token: 'pt_saved', base: 'https://www.smashandclash.in' }]])
  server(on, calls, saved)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'smash', args: '' })
  expect(calls).toHaveLength(1)
  expect(calls[0]).toMatchObject({ method: 'GET', url: 'https://www.smashandclash.in/api/v1/games/g_saved', auth: 'Bearer pt_saved' })
})

test('while Claude works and the pane is closed, the band says /smash', async ($, on) => {
  server(on, [])
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const ui = await $.ui.mount({
    plugin: 'smash-and-clash-mod',
    component: 'AbovePrompt',
    requestId: 'band',
    surface: 'terminal',
    viewport: { columns: 120, rows: 40 },
    props: { hasSurvey: false, isWorking: true, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: 'Waiting on Claude? Play Smash&Clash: /smash' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
  await ui.unmount()
})

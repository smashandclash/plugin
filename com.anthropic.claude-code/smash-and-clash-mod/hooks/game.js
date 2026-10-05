// Smash&Clash mod: pure helpers (no mods API here). The move grammar the
// server speaks, the board turned to your seat, and the board drawn as a
// terminal Raster (one cell = a character, its colour, its background).

export const COLS = 'ABCDE'

/** Case and punctuation do not matter: "Recruit!" is "RECRUIT". */
export const plain = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * A move's card and where it lands: "Pengu@C2" (place), "Pengu!C2" (overrun),
 * "RECRUIT(A3→B1)", "FREEZE(D2)", "FLIP", "hop→B2", "hop: stay". Should two
 * cards ever share a name, theirs carry the card id: "Name#12@C2".
 */
export function parseMove(name) {
  let m = /^(.+?)(?:#(\d+))?([@!])([A-E][1-3])$/.exec(name)
  if (m) {
    return { name, card: m[1], ...(m[2] ? { cardId: Number(m[2]) } : {}), kind: m[3] === '!' ? 'overrun' : 'place', cell: m[4] }
  }
  m = /^([A-Z]+)\(([A-E][1-3])\s*(?:→|->|>)\s*([A-E][1-3])\)$/.exec(name)
  if (m) return { name, card: m[1], kind: 'recruit', from: m[2], cell: m[3] }
  m = /^([A-Z]+)\(([A-E][1-3])\)$/.exec(name)
  if (m) return { name, card: m[1], kind: 'target', cell: m[2] }
  if (/^[A-Z]+$/.test(name)) return { name, card: name, kind: 'instant' }
  m = /^hop\s*(?:→|->|>)\s*([A-E][1-3])$/i.exec(name)
  if (m) return { name, card: '', kind: 'hop', cell: m[1] }
  if (/^hop:?\s*stay$/i.test(name)) return { name, card: '', kind: 'stay' }
  return { name, card: '', kind: 'other' }
}

/** Does move `m` play hand card `h` (a hand card, or just its name)? By id when the move names one. */
export function playsCard(m, h) {
  const name = typeof h === 'string' ? h : h?.card
  const id = typeof h === 'string' ? undefined : h?.cardId
  return !!m.card && plain(m.card) === plain(name) && (m.cardId === undefined || id === undefined || m.cardId === id)
}

export function movesFor(view, card) {
  return (view?.legalMoves ?? []).map(parseMove).filter((m) => playsCard(m, card))
}

/** The cell at screen column sx (0-4, left to right) and row sy (0-2, top to bottom). */
export function cellAt(seat, sx, sy) {
  return seat === 'B' ? `${COLS[4 - sx]}${1 + sy}` : `${COLS[sx]}${3 - sy}`
}

export function screenOf(seat, cell) {
  const c = COLS.indexOf(cell[0])
  const r = Number(cell.slice(1))
  return seat === 'B' ? { sx: 4 - c, sy: r - 1 } : { sx: c, sy: 3 - r }
}

/**
 * Where the selected card can go: cell -> move name. A hop offers its tiles;
 * a recruit first offers the enemy cards, then (with `recruitFrom`) where the
 * taken card lands.
 */
export function targetsFor(view, cardIndex, recruitFrom) {
  const out = new Map()
  if (!view?.yourTurn) return out
  const moves = (view.legalMoves ?? []).map(parseMove)
  if (view.pendingHop) {
    for (const m of moves) if (m.kind === 'hop') out.set(m.cell, m.name)
    return out
  }
  const h = view.hand?.[cardIndex]
  if (!h) return out
  for (const m of moves) {
    if (!playsCard(m, h)) continue
    if (recruitFrom) {
      if (m.kind === 'recruit' && m.from === recruitFrom) out.set(m.cell, m.name)
    } else if (m.kind === 'recruit') {
      if (!out.has(m.from)) out.set(m.from, m.name)
    } else if (m.cell) out.set(m.cell, m.name)
  }
  return out
}

/** A tile's four side values as you see them (seat B sees the board turned round). */
function sidesOf(t, seat) {
  const s = t.sides
  if (!s) return ['?', '?', '?', '?']
  return seat === 'B' ? [s.south, s.west, s.north, s.east] : [s.north, s.east, s.south, s.west]
}

const center = (s, w) => {
  s = String(s).slice(0, w)
  const l = Math.floor((w - s.length) / 2)
  return ' '.repeat(l) + s + ' '.repeat(w - s.length - l)
}

export const COLOR = {
  none: 0x01000000,
  text: 0xf5f7fa,
  dark: 0x0d1017,
  muted: 0x8a8f98,
  empty: 0x262b36,
  you: 0x1f63c6,
  them: 0xb83a3f,
  cursor: 0xffd23f,
  target: 0x4a4420,
  label: 0x8a8f98,
}

/** The three text lines of one board cell, `w` wide. */
function cellLines(view, seat, cell, w) {
  const t = view.board.find((b) => b.cell === cell)
  if (t?.card) {
    const [up, right, down, left] = sidesOf(t, seat)
    const name = t.card.slice(0, Math.max(3, w - 4))
    return {
      lines: [center(up, w), center(`${left} ${name} ${right}`, w), center(t.frozen ? `${down} ice` : down, w)],
      owner: t.owner,
    }
  }
  const chess = view.special?.chessTiles?.find((x) => x.cell === cell)
  const power = view.special?.powerTiles?.find((x) => x.cell === cell)
  const mid = chess ? `[${chess.piece}]` : power ? `+${power.boost} ${power.color}` : ''
  return { lines: [' '.repeat(w), center(mid, w), center(cell, w)], owner: null }
}

/**
 * The board as Raster cells: column letters on top, row numbers on the left,
 * each tile `w` x 3 with a one-column gap, your row nearest the bottom.
 */
export function boardRaster(view, seat, o) {
  const w = o.cellW
  const cols = 2 + 5 * w + 4
  const rows = 1 + 3 * 3 + 2
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => [' ', COLOR.none, COLOR.none]))
  const put = (x, y, ch, fg, bg) => {
    if (y >= 0 && y < rows && x >= 0 && x < cols) grid[y][x] = [ch, fg, bg]
  }
  for (let sx = 0; sx < 5; sx++) {
    const letter = seat === 'B' ? COLS[4 - sx] : COLS[sx]
    put(2 + sx * (w + 1) + Math.floor(w / 2), 0, letter, COLOR.label, COLOR.none)
  }
  for (let sy = 0; sy < 3; sy++) {
    const rowNo = seat === 'B' ? 1 + sy : 3 - sy
    put(0, 1 + sy * 4 + 1, String(rowNo), COLOR.label, COLOR.none)
    for (let sx = 0; sx < 5; sx++) {
      const cell = cellAt(seat, sx, sy)
      const { lines, owner } = cellLines(view, seat, cell, w)
      const isCursor = o.cursor === cell
      const isTarget = o.targets?.has(cell)
      const bg = isCursor ? COLOR.cursor : owner === 'you' ? COLOR.you : owner === 'opponent' ? COLOR.them : isTarget ? COLOR.target : COLOR.empty
      const fg = isCursor ? COLOR.dark : owner ? COLOR.text : isTarget ? COLOR.cursor : COLOR.muted
      for (let ly = 0; ly < 3; ly++) {
        const text = lines[ly]
        for (let lx = 0; lx < w; lx++) put(2 + sx * (w + 1) + lx, 1 + sy * 4 + ly, text[lx] ?? ' ', fg, bg)
      }
      if (isTarget && !owner && !isCursor) put(2 + sx * (w + 1), 1 + sy * 4, '+', COLOR.cursor, bg)
    }
  }
  const numbers = []
  for (const row of grid) for (const [ch, fg, bg] of row) numbers.push(ch.codePointAt(0), fg, bg)
  return { columns: cols, rows, cells: base64(new Uint8Array(Uint32Array.from(numbers).buffer)) }
}

/** The board as plain text lines (the desktop app has no Raster). */
export function boardText(view, seat, o) {
  const w = o.cellW
  const out = ['  ' + [0, 1, 2, 3, 4].map((sx) => center(seat === 'B' ? COLS[4 - sx] : COLS[sx], w)).join(' ')]
  for (let sy = 0; sy < 3; sy++) {
    const cells = [0, 1, 2, 3, 4].map((sx) => {
      const cell = cellAt(seat, sx, sy)
      const { lines, owner } = cellLines(view, seat, cell, w)
      const mark = o.cursor === cell ? '>' : o.targets?.has(cell) ? '+' : owner === 'you' ? '*' : ' '
      return lines.map((l, i) => (i === 0 ? mark + l.slice(1) : l))
    })
    const rowNo = seat === 'B' ? 1 + sy : 3 - sy
    for (let ly = 0; ly < 3; ly++) out.push((ly === 1 ? `${rowNo} ` : '  ') + cells.map((c) => c[ly]).join('|'))
  }
  return out
}

/** A hand card as one button label. */
export function handLabel(h) {
  return h.kind === 'character' ? `${h.card} ${h.top}/${h.right}/${h.bottom}/${h.left}` : h.card
}

/** "You won 9-6!" from your seat's side. */
export function outcome(game) {
  const seat = game.seat ?? 'A'
  const mine = seat === 'B' ? `${game.score.B}-${game.score.A}` : `${game.score.A}-${game.score.B}`
  if (game.status === 'abandoned') return 'The game was abandoned.'
  if (game.winner === 'draw') return `A draw, ${mine}.`
  return game.winner === seat ? `You won ${mine}!` : `You lost ${mine}.`
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Base64 of bytes, without Buffer (a hooks module has no Node APIs). */
export function base64(bytes) {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + '='
  }
  return out
}

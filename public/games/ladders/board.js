// Snakes & Ladders board: shared by the server (rules) and the client (3D layout).
// Tiles are numbered 1..N, snaking left-right then right-left up a 10-wide grid.
export const COLS = 10;
export const SIZES = { short: 60, classic: 100 };
export const SPECIALS = ['boost', 'again', 'swap', 'nap'];
// How long each part of a move takes to play out on screen. The server waits this long before the next turn.
export const MS = { die: 950, step: 250, ladder: 1150, snake: 1350, special: 850, swap: 1000, end: 450, broken: 1500, crack: 800, stuck: 800 };

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Grid cell of a tile: col 0..9 from the left, row 0 at the start edge.
export function cell(n) {
  const i = n - 1, row = i / COLS | 0, c = i % COLS;
  return { row, col: row % 2 ? COLS - 1 - c : c };
}

export const tileAt = (row, col) => row * COLS + (row % 2 ? COLS - 1 - col : col) + 1;

// A fresh random board. Every endpoint sits on its own tile; tile 1 and the goal stay clear.
// Hard mode: a few ladders start broken (you only get halfway and you're stuck a turn) and a few snakes face
// the other way (you ride up them, but it costs you a turn).
export function makeBoard(seed, size = 100, party = true, hard = false) {
  const R = rng(seed), N = size, rows = N / COLS, used = new Set([1, N]);
  const free = n => n > 1 && n < N && !used.has(n);
  const rowOf = n => cell(n).row;
  const pick = (lo, hi) => lo + (R() * (hi - lo + 1) | 0);
  const ladders = [], snakes = [];
  const nL = size === 100 ? 7 : 4, nS = size === 100 ? 8 : 5;
  for (let tries = 0; ladders.length < nL && tries < 400; tries++) {
    const a = pick(2, N - COLS - 1), ca = cell(a), up = pick(1, Math.min(3, rows - 1 - ca.row));
    const b = tileAt(ca.row + up, Math.max(0, Math.min(COLS - 1, ca.col + pick(-2, 2))));
    if (!free(a) || !free(b) || rowOf(b) <= rowOf(a)) continue;
    used.add(a); used.add(b); ladders.push({ from: a, to: b });
  }
  for (let tries = 0; snakes.length < nS && tries < 400; tries++) {
    const h = pick(COLS + 2, N - 1), ch = cell(h), down = pick(1, Math.min(3, ch.row));
    const t = tileAt(ch.row - down, Math.max(0, Math.min(COLS - 1, ch.col + pick(-2, 2))));
    if (!free(h) || !free(t) || rowOf(t) >= rowOf(h)) continue;
    used.add(h); used.add(t); snakes.push({ from: h, to: t });
  }
  const specials = [];
  if (party) {
    const nP = size === 100 ? 8 : 5;
    for (let tries = 0; specials.length < nP && tries < 400; tries++) {
      const n = pick(4, N - 4);
      if (!free(n)) continue;
      used.add(n); specials.push({ at: n, k: SPECIALS[specials.length % SPECIALS.length] });
    }
  }
  if (hard) {
    const nB = size === 100 ? 2 : 1;
    ladders.slice(0, nB).forEach(l => { l.broken = true; });
    // reversed snakes face down the board: you step on the head at the bottom and climb up to the tail
    snakes.slice(0, nB).forEach(s => { const h = s.from; s.from = s.to; s.to = h; s.up = true; });
  }
  return { seed, size: N, rows, ladders, snakes, specials, hard };
}

export const jumpAt = (B, n) => {
  const l = B.ladders.find(x => x.from === n); if (l) return { ...l, kind: 'ladder', ref: l };
  const s = B.snakes.find(x => x.from === n); if (s) return { ...s, kind: 'snake', ref: s };
  return null;
};
// Where a broken ladder drops you: halfway along it, counted in tiles.
export const midTile = (from, to) => from + Math.max(1, Math.round((to - from) / 2));
export const specialAt = (B, n) => B.specials.find(s => s.at === n)?.k || null;

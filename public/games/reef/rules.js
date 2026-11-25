// Word Reef rules shared by the server and the browser: the two island boards, the letter sets, and how a play is
// read and scored. Our own game in the crossword-tile family: the island boards, bonus squares, letter values and
// tile counts are our own (values and counts come from how often each letter turns up in everyday words, see
// server/words/build-reef.js). Whether a word is in the dictionary is only known on the server.

// ---------- letters ----------
// value of each letter, and how many of it are in the short (62 + 2 wild) and the full (98 + 2 wild) bag
export const LETTERS = {
  pl: {
    a: [1, 6, 9], ą: [5, 1, 1], b: [3, 1, 2], c: [2, 2, 4], ć: [5, 1, 1], d: [2, 2, 3], e: [1, 4, 6], ę: [4, 1, 1],
    f: [6, 1, 1], g: [4, 1, 1], h: [4, 1, 1], i: [1, 5, 6], j: [3, 1, 2], k: [2, 2, 3], l: [3, 1, 2], ł: [3, 1, 3],
    m: [2, 2, 3], n: [2, 3, 5], ń: [7, 1, 1], o: [1, 4, 7], ó: [5, 1, 1], p: [2, 2, 4], r: [2, 3, 5], s: [2, 2, 4],
    ś: [4, 1, 1], t: [2, 2, 3], u: [3, 1, 3], w: [2, 2, 4], y: [2, 2, 4], z: [1, 3, 5], ź: [8, 1, 1], ż: [5, 1, 1],
  },
  en: {
    a: [1, 5, 8], b: [3, 1, 2], c: [2, 2, 3], d: [2, 2, 3], e: [1, 7, 10], f: [4, 1, 2], g: [3, 1, 3], h: [3, 1, 2],
    i: [1, 5, 7], j: [6, 1, 1], k: [4, 1, 1], l: [2, 3, 5], m: [3, 2, 3], n: [1, 4, 7], o: [1, 5, 6], p: [3, 2, 3],
    q: [8, 1, 1], r: [1, 4, 7], s: [1, 3, 7], t: [1, 4, 7], u: [2, 2, 3], v: [4, 1, 1], w: [4, 1, 2], x: [6, 1, 1],
    y: [3, 1, 2], z: [6, 1, 1],
  },
};
export const WILD = '?', WILDS = 2, RACK = 7;
export const FULL_BONUS = 40, NEST_BONUS = 10, CHAL_BONUS = 10;
export const langOf = l => (l === 'en' ? 'en' : 'pl');
export const alphabet = lang => Object.keys(LETTERS[langOf(lang)]);
export const value = (lang, l) => LETTERS[langOf(lang)][l]?.[0] ?? 0;
export function bagOf(lang, size) { // every tile in the bag, in alphabet order (the server shuffles it)
  const k = size === 'full' ? 2 : 1, out = [];
  for (const [l, v] of Object.entries(LETTERS[langOf(lang)])) for (let i = 0; i < v[k]; i++) out.push(l);
  for (let i = 0; i < WILDS; i++) out.push(WILD);
  return out;
}

// ---------- boards ----------
// One quarter of each island (top left, centre square last), mirrored both ways. # water, . sand, p pearl (letter
// x2), s starfish (letter x3), w wave (word x2), v whirlpool (word x3), n pet nest, * the middle (word x2, the
// first word covers it). Both quarters are symmetric across the diagonal too.
const QUARTERS = {
  small: ['###.p.v', '##w..s.', '#wn..p.', '...w..p', 'p...s..', '.sp....', 'v..p..*'],
  big: ['####.p.v', '###w..s.', '##w..p..', '#w.n...p', '....s...', 'p.p..p..', '.s....w.', 'v..p...*'],
};
export const BOARDS = {};
for (const [k, q] of Object.entries(QUARTERS)) {
  const h = q.length, N = h * 2 - 1, rows = [];
  for (let r = 0; r < N; r++) { const row = q[r < h ? r : N - 1 - r]; rows.push(row + [...row.slice(0, h - 1)].reverse().join('')); }
  BOARDS[k] = { N, kinds: rows.join(''), mid: (h - 1) * N + h - 1 };
}
export const boardOf = k => BOARDS[k === 'big' ? 'big' : 'small'];
export const LETTER_X = { p: 2, s: 3 }, WORD_X = { w: 2, v: 3, '*': 2 };
export const land = (B, i) => i >= 0 && i < B.N * B.N && B.kinds[i] !== '#';

// ---------- reading a play ----------
// cells: the board, an array of N*N strings ('' = empty); wild: the same size, 1 where a wild tile sits.
// tiles: [{ i, l, w }] the new tiles (cell, letter, 1 when it is a wild tile standing for l).
// Returns { ok: true, dir, words: [{ w, cells, pts }], pts, full, nests } or { ok: false, err }.
// err is one of: none, many, taken, water, line, gap, middle, alone, short, letter.
export function readPlay(B, cells, wild, tiles, lang) {
  const N = B.N, abc = LETTERS[langOf(lang)];
  if (!Array.isArray(tiles) || !tiles.length) return { ok: false, err: 'none' };
  if (tiles.length > RACK) return { ok: false, err: 'many' };
  const at = new Map();
  for (const t of tiles) {
    if (!t || !Number.isInteger(t.i) || typeof t.l !== 'string' || !abc[t.l]) return { ok: false, err: 'letter' };
    if (!land(B, t.i)) return { ok: false, err: 'water' };
    if (cells[t.i] || at.has(t.i)) return { ok: false, err: 'taken' };
    at.set(t.i, t);
  }
  const first = !cells.some(Boolean);
  const rs = new Set(tiles.map(t => t.i / N | 0)), cs = new Set(tiles.map(t => t.i % N));
  if (rs.size > 1 && cs.size > 1) return { ok: false, err: 'line' };
  const letter = i => (at.has(i) ? at.get(i).l : cells[i]);
  const filled = (r, c) => r >= 0 && c >= 0 && r < N && c < N && !!letter(r * N + c);
  // the run of letters through (r, c) along (dr, dc)
  const run = (r, c, dr, dc) => {
    while (filled(r - dr, c - dc)) { r -= dr; c -= dc; }
    const out = [];
    while (filled(r, c)) { out.push(r * N + c); r += dr; c += dc; }
    return out;
  };
  let dir;
  if (tiles.length > 1) dir = rs.size === 1 ? 'a' : 'd';
  else { const t = tiles[0], r = t.i / N | 0, c = t.i % N; dir = filled(r, c - 1) || filled(r, c + 1) ? 'a' : 'd'; }
  const [dr, dc] = dir === 'a' ? [0, 1] : [1, 0];
  const t0 = tiles[0], main = run(t0.i / N | 0, t0.i % N, dr, dc);
  if (!tiles.every(t => main.includes(t.i))) return { ok: false, err: 'gap' };
  if (first && !at.has(B.mid)) return { ok: false, err: 'middle' };
  const words = [];
  const score = idx => {
    let s = 0, x = 1;
    for (const i of idx) {
      const nw = at.get(i), base = (nw ? nw.w : wild[i]) ? 0 : abc[letter(i)][0];
      s += base * (nw ? LETTER_X[B.kinds[i]] || 1 : 1);
      if (nw) x *= WORD_X[B.kinds[i]] || 1;
    }
    return s * x;
  };
  if (main.length >= 2) words.push({ w: main.map(letter).join(''), cells: main, pts: score(main) });
  for (const t of tiles) {
    const cross = run(t.i / N | 0, t.i % N, dc, dr);
    if (cross.length >= 2) words.push({ w: cross.map(letter).join(''), cells: cross, pts: score(cross) });
  }
  if (!words.length) return { ok: false, err: first ? 'short' : 'alone' };
  if (first && main.length < 2) return { ok: false, err: 'short' };
  if (!first && !words.some(w => w.cells.some(i => !at.has(i)))) return { ok: false, err: 'alone' };
  const nests = tiles.filter(t => B.kinds[t.i] === 'n').map(t => t.i), full = tiles.length === RACK;
  const pts = words.reduce((a, w) => a + w.pts, 0) + (full ? FULL_BONUS : 0) + nests.length * NEST_BONUS;
  return { ok: true, dir, words, pts, full, nests };
}
// what a tray still holding these tiles costs at the end
export const rackValue = (lang, rack) => rack.reduce((a, l) => a + (l === WILD ? 0 : value(lang, l)), 0);
// the tiles of a play must come out of the tray: wild tiles cover letters the tray does not have
export function fromRack(rack, tiles) {
  const left = rack.slice();
  for (const t of tiles) {
    const k = left.indexOf(t.w ? WILD : t.l);
    if (k < 0) return null;
    left.splice(k, 1);
  }
  return left;
}

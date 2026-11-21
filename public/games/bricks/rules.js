// Sky Bricks rules, shared by the server, the browser and the bots, so all three always agree on what a move does.
// A well is W wide and VIS tall (plus a few hidden rows on top). Row 0 is the floor.
export const W = 9, VIS = 18, H = 22;
export const STONE = 10;   // the colour of a line sent by somebody else
export const MAXG = 6;     // most stone lines that can rise under you after one brick
export const GRACE = 2500; // ms a stone line may wait before it has to come up
export const LOCK_MS = 500, MAX_RESETS = 12, SOFT_MS = 40, COUNT_MS = 3600;

// Nine bricks: seven of four blocks and two little ones of three. Cells sit in an n by n box that turns about its middle.
export const SHAPES = [
  { id: 'plank', n: 4, c: [[0, 2], [1, 2], [2, 2], [3, 2]] },
  { id: 'stub', n: 3, c: [[0, 1], [1, 1], [2, 1]] },
  { id: 'crate', n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'tee', n: 3, c: [[0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: 'hook', n: 3, c: [[0, 1], [1, 1], [2, 1], [2, 2]] },
  { id: 'crook', n: 3, c: [[0, 1], [1, 1], [2, 1], [0, 2]] },
  { id: 'step', n: 3, c: [[0, 1], [1, 1], [1, 2], [2, 2]] },
  { id: 'stair', n: 3, c: [[1, 1], [2, 1], [0, 2], [1, 2]] },
  { id: 'nook', n: 2, c: [[0, 0], [1, 0], [0, 1]] },
];
export const KINDS = SHAPES.length;
export const ROT = SHAPES.map(s => { // ROT[kind][turn] = cells; each turn is a quarter clockwise
  const out = [s.c]; for (let r = 1; r < 4; r++) out.push(out[r - 1].map(([x, y]) => [y, s.n - 1 - x]));
  return out;
});
const KICKS = [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [2, 0], [-2, 0]];

export const newBoard = () => Array.from({ length: H }, () => new Array(W).fill(0));
export function fits(b, k, r, x, y) {
  for (const [cx, cy] of ROT[k][r]) { const X = x + cx, Y = y + cy; if (X < 0 || X >= W || Y < 0 || Y >= H || b[Y][X]) return false; }
  return true;
}
// where a new brick appears: in the middle, its lowest blocks on the top row you can see
export function spawn(k) { const s = SHAPES[k]; return { k, r: 0, x: (W - s.n) >> 1, y: VIS - 1 - Math.min(...s.c.map(c => c[1])) }; }
export function turned(b, p, dir) {
  const r = (p.r + dir + 4) % 4;
  for (const [dx, dy] of KICKS) if (fits(b, p.k, r, p.x + dx, p.y + dy)) return { k: p.k, r, x: p.x + dx, y: p.y + dy };
  return null;
}
export function dropY(b, p) { let y = p.y; while (fits(b, p.k, p.r, p.x, y - 1)) y--; return y; }

// ----- the order the bricks come in: the same for everyone at the table, shuffled a bag of nine at a time -----
const seqs = new Map();
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function pieceAt(seed, i) {
  let s = seqs.get(seed);
  if (!s) { if (seqs.size > 300) seqs.clear(); s = { list: [], rnd: rng(seed) }; seqs.set(seed, s); }
  while (s.list.length <= i) {
    const bag = SHAPES.map((_, k) => k);
    for (let n = bag.length - 1; n > 0; n--) { const j = Math.floor(s.rnd() * (n + 1)); [bag[n], bag[j]] = [bag[j], bag[n]]; }
    s.list.push(...bag);
  }
  return s.list[i];
}

// ----- one player's well -----
// pend: stone lines on their way to you, oldest first: { id, hole, at }
export function newState(seed) {
  const st = { b: newBoard(), seed, nx: 0, cur: -1, hold: -1, can: true, pend: [], locks: 0, combo: 0, lines: 0, sent: 0, dead: false };
  take(st); return st;
}
function take(st, k = pieceAt(st.seed, st.nx++)) {
  st.cur = k; const p = spawn(k);
  if (!fits(st.b, p.k, p.r, p.x, p.y)) st.dead = true; // no room for the next brick: out
}
// Swap the falling brick with the one set aside (once per brick).
export function doHold(st) {
  if (!st.can || st.dead) return false;
  const h = st.hold; st.hold = st.cur;
  if (h < 0) take(st); else take(st, h);
  st.can = false; return true;
}
// lines sent for clearing n rows at once, plus a little for clearing on several bricks running
export const ATTACK = [0, 0, 1, 2, 4];
export const comboBonus = c => (c >= 6 ? 3 : c >= 4 ? 2 : c >= 2 ? 1 : 0);
export const stoneRow = hole => { const r = new Array(W).fill(STONE); r[hole] = 0; return r; };

// Set the falling brick down at (r, x, y), then let g waiting stone lines rise if no row was cleared.
// Returns null if the brick cannot rest there. Otherwise { rows, out, took, clean } and the state has moved on.
export function lock(st, r, x, y, g = 0) {
  if (st.dead || ![r, x, y, g].every(Number.isInteger) || r < 0 || r > 3 || g < 0) return null;
  const k = st.cur, b = st.b;
  if (!fits(b, k, r, x, y) || fits(b, k, r, x, y - 1)) return null;
  let low = H;
  for (const [cx, cy] of ROT[k][r]) { b[y + cy][x + cx] = k + 1; low = Math.min(low, y + cy); }
  const rows = [];
  for (let Y = 0; Y < H; Y++) if (b[Y].every(v => v)) rows.push(Y);
  for (let i = rows.length - 1; i >= 0; i--) { b.splice(rows[i], 1); b.push(new Array(W).fill(0)); }
  let out = 0, took = 0, clean = false;
  if (rows.length) {
    st.combo++; st.lines += rows.length;
    clean = b.every(row => row.every(v => !v));
    out = ATTACK[Math.min(4, rows.length)] + comboBonus(st.combo) + (clean ? 4 : 0);
    while (out > 0 && st.pend.length) { st.pend.shift(); out--; } // your clears first knock out lines coming at you
    st.sent += out;
  } else {
    st.combo = 0;
    took = Math.min(g, st.pend.length, MAXG);
    for (let i = 0; i < took; i++) { b.unshift(stoneRow(st.pend.shift().hole)); b.pop(); }
  }
  st.locks++; st.can = true;
  if (low >= VIS) st.dead = true; // set down entirely above the well
  if (!st.dead) take(st);
  return { rows, out, took, clean, k };
}

// ----- speed -----
export const BASE_MS = { chill: 1000, normal: 780, fast: 520 };
export const levelAt = t => Math.max(0, Math.floor(t / 20000)) + 1;
export const fallMs = (speed, t) => Math.max(70, (BASE_MS[speed] || BASE_MS.normal) * .88 ** (levelAt(t) - 1));

// ----- boards over the wire: one character a cell, rows from the floor up, empty rows on top left out -----
export function encode(b) {
  let top = H; while (top > 0 && b[top - 1].every(v => !v)) top--;
  let s = ''; for (let y = 0; y < top; y++) for (let x = 0; x < W; x++) s += b[y][x].toString(36);
  return s;
}
export function decode(s) {
  const b = newBoard();
  for (let i = 0; i < s.length && i < W * H; i++) b[(i / W) | 0][i % W] = parseInt(s[i], 36) || 0;
  return b;
}
export const heightOf = b => { let top = H; while (top > 0 && b[top - 1].every(v => !v)) top--; return top; };

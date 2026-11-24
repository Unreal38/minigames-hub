// Bubble Lagoon rules, shared by the browser and the server. Everyone has their own lagoon: bubbles with pets in
// them hang from a reef in a honeycomb, and you shoot more bubbles up from a raft. Three or more of one pet pop;
// whatever is left hanging on nothing falls and turns into eggs for a rival. The reef keeps pushing new rows down.
// Everything here uses whole-number aims and plain arithmetic only (no sin/cos), so the browser and the server
// always work out exactly the same shot.
import { L } from '../../i18n.js';

export const COLS = 8, WIDTH = 8.5, RH = .866; // bubbles are 1 wide; every other row sits half a bubble to the right
export const LIM = 12;                          // a bubble in row 12 or lower is over the line: out
export const KINDS = 6, EGG = 7, START = 5;     // cell values: 0 empty, 1..6 pets, 7 an egg
export const PETS = ['cindercub', 'zapkit', 'sproutle', 'waddlet', 'wattbat', 'axolily']; // Pet Farm species, never translated
export const AMAX = 840;                        // aim is a whole number -840..840: the tangent of half the angle, times 1000 (about 80 degrees each way)
export const LX = WIDTH / 2, LY = 12.1;         // where the launcher holds the bubble (y grows downwards from the reef)
export const MAXG = 6, GRACE = 1500;            // eggs that can float in after one shot; how long an egg may wait if the browser has not heard of it
export const HURRY = 7000, RELOAD = 260, SPEED = 30; // shoot within 7 s or the launcher fires itself; ms between shots; bubble flight speed (units a second)
const HIT2 = .84 * .84, STEP = .125;

export const speedName = s => ({ calm: L('Calm', 'Spokojna'), normal: L('Normal', 'Zwykła'), fast: L('Fast', 'Szybka') }[s] || s);

// ----- seeded numbers -----
export function rnd(seed, i) {
  let x = (seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B); x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
  return (x ^ (x >>> 16)) >>> 0;
}
// the n-th row the reef pushes out: the same for everyone, with pets in little clumps
export function rowAt(seed, n) {
  const row = new Array(COLS);
  for (let c = 0; c < COLS; c++) { const h = rnd(seed, n * 16 + c); row[c] = c > 0 && (h >>> 8) % 100 < 40 ? row[c - 1] : 1 + h % KINDS; }
  return row;
}

// ----- the honeycomb -----
export const shifted = (st, r) => (r + st.par) & 1;
export const cellX = (st, r, c) => c + .5 + (shifted(st, r) ? .5 : 0);
export const cellY = r => .5 + r * RH;
export function around(st, r, c) {
  const o = shifted(st, r) ? 0 : -1, out = [];
  for (const [rr, cc] of [[r, c - 1], [r, c + 1], [r - 1, c + o], [r - 1, c + o + 1], [r + 1, c + o], [r + 1, c + o + 1]]) if (rr >= 0 && cc >= 0 && cc < COLS) out.push([rr, cc]);
  return out;
}
const at = (b, r, c) => (b[r] ? b[r][c] : 0);
function put(b, r, c, v) { while (b.length <= r) b.push(new Array(COLS).fill(0)); b[r][c] = v; }
function trim(b) { while (b.length && b[b.length - 1].every(v => !v)) b.pop(); }
export const count = b => { let n = 0; for (const row of b) for (const v of row) if (v) n++; return n; };
const holds = (st, r, c) => r === 0 || around(st, r, c).some(([rr, cc]) => at(st.b, rr, cc));

export function newState(seed) {
  const st = { seed, b: [], par: 0, rows: 0, nx: 0, cur: 0, nxt: 0, pend: [], locks: 0, streak: 0, freed: 0, sent: 0, eg: 0, dead: false };
  addRows(st, START);
  st.cur = pick(st); st.nxt = pick(st);
  return st;
}
function addRows(st, upTo) { let n = 0; while (st.rows < upTo) { st.b.unshift(rowAt(st.seed, st.rows)); st.par ^= 1; st.rows++; n++; } return n; }
// The next bubble: the same order for everyone, except that a pet no longer in your lagoon is swapped for one that is.
function pick(st) {
  const i = st.nx++, base = 1 + rnd(st.seed ^ 0x51ED27, i) % KINDS, have = [];
  for (let k = 1; k <= KINDS; k++) if (st.b.some(row => row.includes(k))) have.push(k);
  return !have.length || have.includes(base) ? base : have[rnd(st.seed ^ 0x7F4A7C, i) % have.length];
}
export const clone = st => ({ ...st, b: st.b.map(r => r.slice()), pend: st.pend.slice() });

// ----- one shot: where the bubble flies and which cell it settles in -----
// Returns { path: [[x, y], ...] (start, each bounce, where it stops), r, c } or null if it has nowhere to go.
export function trace(st, a) {
  const t = a / 1000, q = 1 + t * t; let dx = 2 * t / q, x = LX, y = LY; const dy = -(1 - t * t) / q, b = st.b, path = [[x, y]];
  for (let n = 0; n < 4000; n++) {
    x += dx * STEP; y += dy * STEP;
    if (x < .5) { x = 1 - x; dx = -dx; path.push([.5, y]); } else if (x > WIDTH - .5) { x = 2 * (WIDTH - .5) - x; dx = -dx; path.push([WIDTH - .5, y]); }
    const r0 = Math.max(0, Math.round((y - .5) / RH)); let hit = y <= .5;
    for (let r = Math.max(0, r0 - 1); !hit && r <= r0 + 1; r++) { const row = b[r]; if (!row) continue;
      for (let c = 0; c < COLS; c++) if (row[c]) { const ex = x - cellX(st, r, c), ey = y - cellY(r); if (ex * ex + ey * ey < HIT2) { hit = true; break; } } }
    if (!hit) continue;
    let best = null, bd = 1e9;
    for (let r = Math.max(0, r0 - 2); r <= r0 + 2; r++) for (let c = 0; c < COLS; c++) {
      if (at(b, r, c) || !holds(st, r, c)) continue;
      const ex = x - cellX(st, r, c), ey = y - cellY(r), d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = [r, c]; }
    }
    if (!best) return null;
    path.push([cellX(st, best[0], best[1]), cellY(best[0])]);
    return { path, r: best[0], c: best[1] };
  }
  return null;
}

// Shoot the bubble in hand at aim a (w = 1: the next bubble instead, the two swap first). Then g waiting eggs
// float in if nothing popped, and the reef pushes rows out until there are k of them.
// Returns null for nonsense; otherwise what happened, and the state has moved on.
export function lock(st, a, w = 0, g = 0, k = st.rows) {
  if (st.dead || ![a, w, g, k].every(Number.isInteger) || a < -AMAX || a > AMAX || (w !== 0 && w !== 1) || g < 0 || k < st.rows || k > st.rows + 40) return null;
  const tr = trace(st, a); if (!tr) return null;
  if (w) { const x = st.cur; st.cur = st.nxt; st.nxt = x; }
  const b = st.b, kind = st.cur, par0 = st.par, { r, c } = tr;
  put(b, r, c, kind);
  // three or more of the same pet touching: they pop, and eggs touching any of them crack
  const group = [[r, c]], seen = new Set([r * COLS + c]);
  for (let i = 0; i < group.length; i++) for (const [rr, cc] of around(st, group[i][0], group[i][1])) { const key = rr * COLS + cc; if (!seen.has(key) && at(b, rr, cc) === kind) { seen.add(key); group.push([rr, cc]); } }
  const popped = [], cracked = [], dropped = [];
  if (group.length >= 3) {
    for (const [rr, cc] of group) for (const [er, ec] of around(st, rr, cc)) if (at(b, er, ec) === EGG) { b[er][ec] = 0; cracked.push([er, ec, EGG]); }
    for (const [rr, cc] of group) { b[rr][cc] = 0; popped.push([rr, cc, kind]); }
    // whatever no longer hangs from the reef falls
    const ok = new Set(), todo = [];
    for (let cc = 0; cc < COLS; cc++) if (at(b, 0, cc)) { ok.add(cc); todo.push([0, cc]); }
    while (todo.length) { const [rr, cc] = todo.pop(); for (const [nr, nc] of around(st, rr, cc)) { const key = nr * COLS + nc; if (at(b, nr, nc) && !ok.has(key)) { ok.add(key); todo.push([nr, nc]); } } }
    for (let rr = 1; rr < b.length; rr++) for (let cc = 0; cc < COLS; cc++) if (b[rr][cc] && !ok.has(rr * COLS + cc)) { dropped.push([rr, cc, b[rr][cc]]); b[rr][cc] = 0; }
  }
  trim(b);
  let out = 0, took = 0; const eggs = [], clean = popped.length > 0 && !b.length;
  if (popped.length) {
    st.streak++; st.freed += popped.length + dropped.filter(d => d[2] !== EGG).length;
    out = dropped.length + (popped.length >= 5 ? 1 : 0) + (st.streak >= 3 ? 1 : 0) + (clean ? 4 : 0);
    while (out > 0 && st.pend.length) { st.pend.shift(); out--; } // your pops first knock out eggs on their way to you
    st.sent += out;
  } else {
    st.streak = 0;
    took = Math.min(g, st.pend.length, MAXG);
    for (let i = 0; i < took; i++) { st.pend.shift(); const e = floatEgg(st); if (e) eggs.push(e); }
  }
  const added = addRows(st, k);
  for (const e of eggs) e[0] += added;
  trim(st.b);
  st.locks++;
  if (st.b.length > LIM) st.dead = true;
  if (!st.dead) { st.cur = st.nxt; st.nxt = pick(st); }
  return { r: r + added, c, r0: r, kind, par0, path: tr.path, popped, cracked, dropped, eggs, added, out, took, clean };
}
// An egg bobs up one column and sticks under the lowest thing it meets.
function floatEgg(st) {
  const c = rnd(st.seed ^ 0x2E99, st.eg++) % COLS;
  for (let r = st.b.length; r >= 0; r--) if (!at(st.b, r, c) && holds(st, r, c)) { put(st.b, r, c, EGG); return [r, c]; }
  return null;
}

// ----- the reef's clock: how many rows there should be after t ms of play -----
export const PACE = { calm: [17000, 340, 5200], normal: [14000, 320, 4500], fast: [10500, 300, 3600] }; // first gap, how much shorter each next one is, shortest
export function rowsDue(speed, t) {
  const [base, dec, min] = PACE[speed] || PACE.normal; let n = 0, at = 0;
  for (;;) { at += Math.max(min, base - dec * n); if (at > t || n > 400) break; n++; }
  return START + n;
}
export function nextRowIn(speed, t) { // ms until the next row is due
  const [base, dec, min] = PACE[speed] || PACE.normal; let n = 0, at = 0;
  for (;;) { at += Math.max(min, base - dec * n); if (at > t || n > 400) break; n++; }
  return at - t;
}

// ----- lagoons over the wire: the half-step of the top row, then one digit a cell from the reef down -----
export function encode(st) { let s = String(st.par); for (const row of st.b) s += row.join(''); return s; }
export function decode(s) {
  const b = []; s = String(s || '0');
  for (let i = 1; i + COLS <= s.length && b.length < 40; i += COLS) b.push(Array.from(s.slice(i, i + COLS), ch => +ch || 0));
  return { par: s[0] === '1' ? 1 : 0, b };
}

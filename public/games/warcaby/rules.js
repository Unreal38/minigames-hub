// Warcaby (draughts) rules shared by the server, the bot and the browser.
// The board is n x n (10 for Polish draughts, 8 for the small board), sq = row * n + col, row 0 is White's side, and
// only the dark squares are used: (row + col) even, so a1 is dark. A piece is a number: type 1 man, 2 king, plus 4 for
// Black. 0 is an empty square. White moves first.
// The rules are the Polish / international ones on both boards: men move one square diagonally forward and take
// forwards and backwards; kings fly any distance; taking is compulsory and you must take the most pieces you can;
// taken pieces leave the board only when the whole move is done (so none can be jumped twice); a man becomes a king
// only when its move ends on the far row.
// A move is { f, t, path: [every square the piece stands on, first to last], caps: [taken squares, in order], k: crowned }.
// The core works in place (make / unmake) so the bot can search quickly; play() returns a fresh position for the game.
import { L } from '../../i18n.js';

export const MAN = 1, KING = 2;
export const WHITE = 0, BLACK = 1;
export const sideOf = p => p >> 2, typeOf = p => p & 3;
export const SIZES = { 10: { n: 10, rows: 4 }, 8: { n: 8, rows: 3 } };
// Clock choices: minutes each and seconds added after every move. 'off' plays without clocks.
export const CLOCKS = { off: null, '3+2': [3, 2], '5+3': [5, 3], '10+5': [10, 5], '15+10': [15, 10] };
export const LETTERS = 'abcdefghij';
export const sqName = (s, n) => LETTERS[s % n] + (Math.floor(s / n) + 1);

// ---------- lookup tables: for each square, the four diagonal rays (NE, NW, SE, SW) ----------
const RAYS = {};
function rays(n) {
  if (RAYS[n]) return RAYS[n];
  const out = [];
  for (let s = 0; s < n * n; s++) {
    const r = Math.floor(s / n), c = s % n;
    out[s] = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dr, dc]) => { const a = []; for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n; rr += dr, cc += dc) a.push(rr * n + cc); return a; });
  }
  return (RAYS[n] = out);
}
const FWD = [[0, 1], [2, 3]]; // the rays a man of each side walks along (White up the board, Black down)

// ---------- hashing (two 32-bit halves; used to spot repeats and by the bot's memory) ----------
let seed = 0x5bd1e995;
const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
const ZP = Array.from({ length: 8 * 100 }, rnd32), ZP2 = Array.from({ length: 8 * 100 }, rnd32);
const ZT = rnd32(), ZT2 = rnd32();
function fullHash(pos) {
  let h = 0, h2 = 0;
  for (let s = 0; s < pos.b.length; s++) { const p = pos.b[s]; if (p) { h ^= ZP[p * 100 + s]; h2 ^= ZP2[p * 100 + s]; } }
  if (pos.turn) { h ^= ZT; h2 ^= ZT2; }
  pos.h = h; pos.h2 = h2;
}
const zx = (pos, p, s) => { pos.h ^= ZP[p * 100 + s]; pos.h2 ^= ZP2[p * 100 + s]; };

// ---------- positions ----------
// quiet: half-moves since the last capture or man move (25 moves each of only kings is a draw)
// eg: half-moves since the last capture or crowning (for the short endgame limits)
export function startPos(size = 10) {
  const { n, rows } = SIZES[size] || SIZES[10], b = new Array(n * n).fill(0);
  for (let s = 0; s < n * n; s++) {
    const r = Math.floor(s / n), c = s % n; if ((r + c) % 2) continue;
    if (r < rows) b[s] = MAN; else if (r >= n - rows) b[s] = MAN | 4;
  }
  return fromBoard(b, 0, 0, 0);
}
export function fromBoard(b, turn = 0, quiet = 0, eg = 0) {
  const n = Math.round(Math.sqrt(b.length));
  const pos = { n, b: b.slice(), turn, quiet, eg, h: 0, h2: 0 };
  fullHash(pos); return pos;
}
export const clone = pos => ({ ...pos, b: pos.b.slice() });
// rows from the top (Black's side) down: w W b B and . or space; turn 'w' or 'b'. Handy for tests.
export function fromText(rows, turn = 'w') {
  const list = Array.isArray(rows) ? rows : String(rows).trim().split(/\s*\/\s*|\n\s*/);
  const n = list.length, b = new Array(n * n).fill(0);
  list.forEach((row, i) => { const r = n - 1 - i; [...row.padEnd(n)].slice(0, n).forEach((ch, c) => { b[r * n + c] = { w: MAN, W: KING, b: MAN | 4, B: KING | 4 }[ch] || 0; }); });
  return fromBoard(b, turn === 'b' ? 1 : 0);
}
export const posKey = pos => pos.h.toString(36) + '.' + pos.h2.toString(36);

// ---------- move generation ----------
function captures(pos) {
  const { b, n, turn } = pos, R = rays(n), out = [];
  let best = 1;
  const path = [], caps = [];
  const enemy = p => p && (p >> 2) !== turn;
  function dfs(cur, king) {
    let more = false;
    const ray = R[cur];
    for (let d = 0; d < 4; d++) {
      const a = ray[d];
      if (king) {
        let i = 0; while (i < a.length && !b[a[i]]) i++;
        if (i >= a.length - 1) continue;
        const q = a[i]; if (!enemy(b[q]) || caps.includes(q)) continue;
        for (let j = i + 1; j < a.length && !b[a[j]]; j++) {
          more = true; path.push(a[j]); caps.push(q); dfs(a[j], true); path.pop(); caps.pop();
        }
      } else {
        if (a.length < 2) continue;
        const q = a[0], land = a[1];
        if (!enemy(b[q]) || caps.includes(q) || b[land]) continue;
        more = true; path.push(land); caps.push(q); dfs(land, false); path.pop(); caps.pop();
      }
    }
    if (!more && caps.length >= best) {
      if (caps.length > best) { best = caps.length; out.length = 0; }
      const t = cur, f = path[0], row = Math.floor(t / n);
      out.push({ f, t, path: path.slice(), caps: caps.slice(), k: !king && row === (turn ? 0 : n - 1) });
    }
  }
  for (let s = 0; s < b.length; s++) {
    const p = b[s]; if (!p || (p >> 2) !== turn) continue;
    b[s] = 0; path.push(s); // the moving piece leaves its square, so it may pass over it again
    dfs(s, (p & 3) === KING);
    path.pop(); b[s] = p;
  }
  return out;
}
// Every legal move: the longest captures if there are any, otherwise the plain steps.
export function legal(pos) {
  const caps = captures(pos);
  if (caps.length) return caps;
  const { b, n, turn } = pos, R = rays(n), out = [];
  for (let s = 0; s < b.length; s++) {
    const p = b[s]; if (!p || (p >> 2) !== turn) continue;
    if ((p & 3) === KING) {
      for (const a of R[s]) for (const t of a) { if (b[t]) break; out.push({ f: s, t, path: [s, t], caps: [], k: false }); }
    } else {
      for (const d of FWD[turn]) { const t = R[s][d][0]; if (t !== undefined && !b[t]) out.push({ f: s, t, path: [s, t], caps: [], k: Math.floor(t / n) === (turn ? 0 : n - 1) }); }
    }
  }
  return out;
}
export const mustTake = pos => { const m = legal(pos); return m.length > 0 && m[0].caps.length > 0; };

// In place, for the bot. Returns what unmake needs.
export function make(pos, m) {
  const b = pos.b, p = b[m.f], u = { m, p, got: m.caps.map(s => b[s]), quiet: pos.quiet, eg: pos.eg, h: pos.h, h2: pos.h2 };
  zx(pos, p, m.f); b[m.f] = 0;
  for (let i = 0; i < m.caps.length; i++) { zx(pos, u.got[i], m.caps[i]); b[m.caps[i]] = 0; }
  const np = m.k ? KING | (p & 4) : p;
  b[m.t] = np; zx(pos, np, m.t);
  pos.quiet = m.caps.length || (p & 3) === MAN ? 0 : pos.quiet + 1;
  pos.eg = m.caps.length || m.k ? 0 : pos.eg + 1;
  pos.turn ^= 1; pos.h ^= ZT; pos.h2 ^= ZT2;
  return u;
}
export function unmake(pos, u) {
  const b = pos.b, m = u.m;
  b[m.t] = 0; b[m.f] = u.p; // (in that order: a king can finish a round trip on its own square)
  for (let i = 0; i < m.caps.length; i++) b[m.caps[i]] = u.got[i];
  pos.quiet = u.quiet; pos.eg = u.eg; pos.h = u.h; pos.h2 = u.h2; pos.turn ^= 1;
}
export function play(pos, m) { const p = clone(pos); make(p, m); return p; }

const samePath = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export const findMove = (pos, path) => legal(pos).find(m => samePath(m.path, path)) || null;

export function count(b) {
  const c = [[0, 0], [0, 0]]; // [side][men, kings]
  for (const p of b) if (p) c[p >> 2][(p & 3) - 1]++;
  return c;
}

// ---------- game over? ----------
// seen: Map of posKey -> how many times it has been on the board.
// win: the side that won, or -1 for a draw.
export function status(pos, seen) {
  if (!legal(pos).length) { const left = pos.b.some(p => p && (p >> 2) === pos.turn); return { over: true, how: left ? 'blocked' : 'wiped', win: 1 - pos.turn }; }
  if (seen && (seen.get(posKey(pos)) || 0) >= 3) return { over: true, how: 'repeat', win: -1 };
  if (pos.quiet >= 50) return { over: true, how: 'kings', win: -1 };
  const lim = endgameLimit(pos.b);
  if (lim && pos.eg >= lim) return { over: true, how: 'endgame', win: -1 };
  return { over: false };
}
// A lone king against three pieces (at least one a king) gets 16 moves each; against two pieces or one, 5 moves each.
export function endgameLimit(b) {
  const c = count(b);
  for (let s = 0; s < 2; s++) {
    const [m, k] = c[s], [om, ok] = c[1 - s];
    if (m === 0 && k === 1 && ok >= 1) { const t = om + ok; if (t === 3) return 32; if (t <= 2) return 10; }
  }
  return 0;
}

// "c3-d4", or "c3xe5xg7" for a capture (every square the piece lands on)
export const moveText = (m, n) => m.path.map(s => sqName(s, n)).join(m.caps.length ? 'x' : '-');
export const pieceName = t => (t === KING ? L('king', 'damka') : L('man', 'pionek'));

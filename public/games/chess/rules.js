// Chess rules shared by the server, the bot and the browser.
// Squares are 0..63, sq = rank * 8 + file, so a1 = 0, h1 = 7, a8 = 56. Seat 0 plays White for the first game.
// A piece is a number: type 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king, plus 8 for Black. 0 is an empty square.
// A move is one integer: from | to << 6 | promotion type << 12 | flag << 15 (flag 1 en passant, 2 castling, 4 double push).
// The core works in place (make / unmake) so the bot can search quickly; play() returns a fresh position for the game.
import { L } from '../../i18n.js';

export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
export const WHITE = 0, BLACK = 1;
export const colorOf = p => p >> 3, typeOf = p => p & 7;
export const fileOf = s => s & 7, rankOf = s => s >> 3;
export const sqName = s => 'abcdefgh'[s & 7] + ((s >> 3) + 1);
export const mFrom = m => m & 63, mTo = m => (m >> 6) & 63, mPromo = m => (m >> 12) & 7, mFlag = m => (m >> 15) & 7;
export const mv = (f, t, promo = 0, flag = 0) => f | t << 6 | promo << 12 | flag << 15;
const EP = 1, CASTLE = 2, DOUBLE = 4;

// ---------- lookup tables ----------
const KNIGHT = [], KING = [], PAWN_HIT = [[], []], RAYS = [];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]; // the first 4 are rook lines, the last 4 bishop lines
for (let s = 0; s < 64; s++) {
  const f = s & 7, r = s >> 3, on = (ff, rr) => ff >= 0 && ff < 8 && rr >= 0 && rr < 8;
  KNIGHT[s] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]].filter(([a, b]) => on(f + a, r + b)).map(([a, b]) => (r + b) * 8 + f + a);
  KING[s] = DIRS.filter(([a, b]) => on(f + a, r + b)).map(([a, b]) => (r + b) * 8 + f + a);
  PAWN_HIT[0][s] = [-1, 1].filter(a => on(f + a, r + 1)).map(a => (r + 1) * 8 + f + a); // squares a white pawn on s attacks
  PAWN_HIT[1][s] = [-1, 1].filter(a => on(f + a, r - 1)).map(a => (r - 1) * 8 + f + a);
  RAYS[s] = DIRS.map(([a, b]) => { const out = []; for (let ff = f + a, rr = r + b; on(ff, rr); ff += a, rr += b) out.push(rr * 8 + ff); return out; });
}

// ---------- hashing (two 32-bit halves; only used to spot repeats and by the bot's memory) ----------
let seed = 0x2545f491;
const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
const ZP = Array.from({ length: 16 * 64 }, rnd32), ZP2 = Array.from({ length: 16 * 64 }, rnd32);
const ZC = Array.from({ length: 16 }, rnd32), ZC2 = Array.from({ length: 16 }, rnd32);
const ZE = Array.from({ length: 8 }, rnd32), ZE2 = Array.from({ length: 8 }, rnd32);
const ZT = rnd32(), ZT2 = rnd32();
function fullHash(pos) {
  let h = 0, h2 = 0;
  for (let s = 0; s < 64; s++) { const p = pos.b[s]; if (p) { h ^= ZP[p * 64 + s]; h2 ^= ZP2[p * 64 + s]; } }
  h ^= ZC[pos.castle]; h2 ^= ZC2[pos.castle];
  if (pos.ep >= 0) { h ^= ZE[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
  if (pos.turn) { h ^= ZT; h2 ^= ZT2; }
  pos.h = h; pos.h2 = h2;
}

// ---------- positions ----------
const BACK = [R, N, B, Q, K, B, N, R];
export function startPos() {
  const b = new Array(64).fill(0);
  for (let f = 0; f < 8; f++) { b[f] = BACK[f]; b[8 + f] = P; b[48 + f] = P | 8; b[56 + f] = BACK[f] | 8; }
  return fromBoard(b, WHITE, 15, -1, 0, 1);
}
export function fromBoard(b, turn, castle, ep, half, full) {
  const pos = { b: b.slice(), turn, castle, ep, half, full, k: [b.indexOf(K), b.indexOf(K | 8)], h: 0, h2: 0 };
  fullHash(pos); return pos;
}
export const clone = pos => ({ ...pos, b: pos.b.slice(), k: pos.k.slice() });

// FEN in and out (handy for tests and for the bot's worker).
const FEN_CH = ' pnbrqk';
export function toFen(pos) {
  let out = '';
  for (let r = 7; r >= 0; r--) {
    let gap = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.b[r * 8 + f];
      if (!p) { gap++; continue; }
      if (gap) { out += gap; gap = 0; }
      const ch = FEN_CH[typeOf(p)]; out += colorOf(p) ? ch : ch.toUpperCase();
    }
    if (gap) out += gap;
    if (r) out += '/';
  }
  const c = (pos.castle & 1 ? 'K' : '') + (pos.castle & 2 ? 'Q' : '') + (pos.castle & 4 ? 'k' : '') + (pos.castle & 8 ? 'q' : '');
  return `${out} ${pos.turn ? 'b' : 'w'} ${c || '-'} ${pos.ep >= 0 ? sqName(pos.ep) : '-'} ${pos.half} ${pos.full}`;
}
export function fromFen(fen) {
  const [rows, t, c = '-', e = '-', h = '0', fl = '1'] = String(fen).trim().split(/\s+/);
  const b = new Array(64).fill(0);
  rows.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      const ty = FEN_CH.indexOf(ch.toLowerCase());
      b[(7 - i) * 8 + f++] = ty | (ch === ch.toLowerCase() ? 8 : 0);
    }
  });
  const castle = (c.includes('K') ? 1 : 0) | (c.includes('Q') ? 2 : 0) | (c.includes('k') ? 4 : 0) | (c.includes('q') ? 8 : 0);
  const ep = e === '-' ? -1 : (+e[1] - 1) * 8 + 'abcdefgh'.indexOf(e[0]);
  return fromBoard(b, t === 'b' ? BLACK : WHITE, castle, ep, +h || 0, +fl || 1);
}

// ---------- attacks ----------
// Is square s attacked by any piece of colour `by`?
export function attacked(b, s, by) {
  const o = by << 3;
  for (const x of PAWN_HIT[1 - by][s]) if (b[x] === (P | o)) return true; // a pawn of `by` sits where a pawn of the other side on s would hit
  for (const x of KNIGHT[s]) if (b[x] === (N | o)) return true;
  for (const x of KING[s]) if (b[x] === (K | o)) return true;
  const ray = RAYS[s];
  for (let d = 0; d < 8; d++) {
    const line = ray[d], a = d < 4 ? R : B;
    for (let i = 0; i < line.length; i++) {
      const p = b[line[i]]; if (!p) continue;
      if (colorOf(p) === by) { const t = typeOf(p); if (t === a || t === Q) return true; }
      break;
    }
  }
  return false;
}
export const inCheck = pos => attacked(pos.b, pos.k[pos.turn], 1 - pos.turn);

// ---------- move generation ----------
// Pseudo-legal moves (may leave your own king in check) into `out`. caps: only captures and queen promotions (the bot's quiet search).
export function pseudo(pos, out = [], caps = false) {
  const b = pos.b, us = pos.turn, them = 1 - us, o = us << 3;
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p || colorOf(p) !== us) continue;
    const t = typeOf(p);
    if (t === P) {
      const dir = us ? -8 : 8, r = s >> 3, last = us ? 1 : 6, home = us ? 6 : 1, one = s + dir;
      if (!b[one]) {
        if (r === last) { out.push(mv(s, one, Q)); if (!caps) out.push(mv(s, one, N), mv(s, one, R), mv(s, one, B)); }
        else if (!caps) { out.push(mv(s, one)); if (r === home && !b[one + dir]) out.push(mv(s, one + dir, 0, DOUBLE)); }
      }
      for (const x of PAWN_HIT[us][s]) {
        const q = b[x];
        if (q && colorOf(q) === them) {
          if (r === last) { out.push(mv(s, x, Q)); if (!caps) out.push(mv(s, x, N), mv(s, x, R), mv(s, x, B)); }
          else out.push(mv(s, x));
        } else if (x === pos.ep) out.push(mv(s, x, 0, EP));
      }
    } else if (t === N || t === K) {
      for (const x of (t === N ? KNIGHT : KING)[s]) { const q = b[x]; if (q ? colorOf(q) === them : !caps) out.push(mv(s, x)); }
      if (t === K && !caps) {
        const home = us ? 60 : 4, ks = us ? 4 : 1, qs = us ? 8 : 2;
        if (s === home && pos.castle & (ks | qs) && !attacked(b, s, them)) {
          if (pos.castle & ks && !b[s + 1] && !b[s + 2] && b[s + 3] === (R | o) && !attacked(b, s + 1, them) && !attacked(b, s + 2, them)) out.push(mv(s, s + 2, 0, CASTLE));
          if (pos.castle & qs && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === (R | o) && !attacked(b, s - 1, them) && !attacked(b, s - 2, them)) out.push(mv(s, s - 2, 0, CASTLE));
        }
      }
    } else {
      const ray = RAYS[s], d0 = t === B ? 4 : 0, d1 = t === R ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        const line = ray[d];
        for (let i = 0; i < line.length; i++) {
          const x = line[i], q = b[x];
          if (!q) { if (!caps) out.push(mv(s, x)); continue; }
          if (colorOf(q) === them) out.push(mv(s, x));
          break;
        }
      }
    }
  }
  return out;
}

// Castling rights that go when a piece leaves or lands on a square.
const KEEP = new Array(64).fill(15);
KEEP[0] = 15 & ~2; KEEP[7] = 15 & ~1; KEEP[4] = 15 & ~3; KEEP[56] = 15 & ~8; KEEP[63] = 15 & ~4; KEEP[60] = 15 & ~12;

// Plays move m on pos in place and returns what unmake needs.
export function make(pos, m) {
  const b = pos.b, f = m & 63, t = (m >> 6) & 63, promo = (m >> 12) & 7, flag = (m >> 15) & 7, p = b[f], us = pos.turn;
  const u = { m, cap: b[t], castle: pos.castle, ep: pos.ep, half: pos.half, h: pos.h, h2: pos.h2, capSq: t };
  let h = pos.h ^ ZC[pos.castle] ^ ZT, h2 = pos.h2 ^ ZC2[pos.castle] ^ ZT2;
  if (pos.ep >= 0) { h ^= ZE[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
  if (flag & EP) { u.capSq = t + (us ? 8 : -8); u.cap = b[u.capSq]; b[u.capSq] = 0; h ^= ZP[u.cap * 64 + u.capSq]; h2 ^= ZP2[u.cap * 64 + u.capSq]; }
  else if (u.cap) { h ^= ZP[u.cap * 64 + t]; h2 ^= ZP2[u.cap * 64 + t]; }
  const np = promo ? promo | (us << 3) : p;
  b[f] = 0; b[t] = np;
  h ^= ZP[p * 64 + f] ^ ZP[np * 64 + t]; h2 ^= ZP2[p * 64 + f] ^ ZP2[np * 64 + t];
  if (flag & CASTLE) { // the rook jumps over the king
    const [rf, rt] = t > f ? [f + 3, f + 1] : [f - 4, f - 1], rk = b[rf];
    b[rf] = 0; b[rt] = rk; h ^= ZP[rk * 64 + rf] ^ ZP[rk * 64 + rt]; h2 ^= ZP2[rk * 64 + rf] ^ ZP2[rk * 64 + rt];
  }
  if ((p & 7) === K) pos.k[us] = t;
  pos.castle &= KEEP[f] & KEEP[t];
  pos.ep = flag & DOUBLE ? (f + t) >> 1 : -1;
  pos.half = (p & 7) === P || u.cap ? 0 : pos.half + 1;
  if (us) pos.full++;
  pos.turn = 1 - us;
  h ^= ZC[pos.castle]; h2 ^= ZC2[pos.castle];
  if (pos.ep >= 0) { h ^= ZE[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
  pos.h = h; pos.h2 = h2;
  return u;
}
export function unmake(pos, u) {
  const b = pos.b, m = u.m, f = m & 63, t = (m >> 6) & 63, promo = (m >> 12) & 7, flag = (m >> 15) & 7;
  pos.turn = 1 - pos.turn; const us = pos.turn;
  const p = promo ? P | (us << 3) : b[t];
  b[f] = p; b[t] = 0; b[u.capSq] = u.cap;
  if (flag & CASTLE) { const [rf, rt] = t > f ? [f + 3, f + 1] : [f - 4, f - 1]; b[rf] = b[rt]; b[rt] = 0; }
  if ((p & 7) === K) pos.k[us] = f;
  if (us) pos.full--;
  pos.castle = u.castle; pos.ep = u.ep; pos.half = u.half; pos.h = u.h; pos.h2 = u.h2;
}
// Null move (the bot passes to see if it is still fine).
export function makeNull(pos) {
  const u = { ep: pos.ep, h: pos.h, h2: pos.h2 };
  let h = pos.h ^ ZT, h2 = pos.h2 ^ ZT2;
  if (pos.ep >= 0) { h ^= ZE[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
  pos.ep = -1; pos.turn = 1 - pos.turn; pos.h = h; pos.h2 = h2;
  return u;
}
export function unmakeNull(pos, u) { pos.turn = 1 - pos.turn; pos.ep = u.ep; pos.h = u.h; pos.h2 = u.h2; }

// Legal moves only.
export function legal(pos) {
  const out = [], us = pos.turn;
  for (const m of pseudo(pos)) { const u = make(pos, m); if (!attacked(pos.b, pos.k[us], 1 - us)) out.push(m); unmake(pos, u); }
  return out;
}
// The legal move from f to t (with this promotion piece, queen by default), or 0.
export function findMove(pos, f, t, promo = Q) {
  const all = legal(pos).filter(m => mFrom(m) === f && mTo(m) === t);
  return all.find(m => !mPromo(m) || mPromo(m) === promo) || 0;
}
// A fresh position after move m (the game keeps old positions untouched).
export function play(pos, m) { const n = clone(pos); make(n, m); return n; }

// ---------- endings ----------
// Neither side can ever mate: kings alone, a king and one knight or bishop against a lone king, or only bishops that all stand on squares of one colour.
export function deadPosition(b) {
  const minors = [];
  for (let s = 0; s < 64; s++) {
    const p = b[s], t = p & 7; if (!p || t === K) continue;
    if (t === P || t === R || t === Q) return false;
    minors.push({ t, s, c: colorOf(p) });
  }
  if (minors.length <= 1) return true;
  if (minors.every(x => x.t === B)) { const sq = x => ((x.s >> 3) + (x.s & 7)) & 1; return minors.every(x => sq(x) === sq(minors[0])); }
  return false;
}
// Whether this side has anything left that could mate (used when the other side's clock runs out).
export function canMate(b, side) {
  let n = 0, minor = 0;
  for (let s = 0; s < 64; s++) { const p = b[s]; if (!p || colorOf(p) !== side || (p & 7) === K) continue; n++; if ((p & 7) === N || (p & 7) === B) minor++; }
  return !(n === 0 || (n === 1 && minor === 1));
}
// The key for spotting repeats: pieces, side to move, castling rights, and the en passant square only when a capture there is really possible.
export function posKey(pos) {
  let ep = '-';
  if (pos.ep >= 0) { const us = pos.turn; if (PAWN_HIT[1 - us][pos.ep].some(x => pos.b[x] === (P | us << 3)) && legal(pos).some(m => mFlag(m) & EP)) ep = pos.ep; }
  return pos.b.join(',') + '|' + pos.turn + pos.castle + '|' + ep;
}
// What the position is: { over: false } or { over: true, how: 'mate' | 'stalemate' | 'material' | 'fifty' | 'repeat', win: colour or -1 }.
// seen: Map of posKey -> times reached.
export function status(pos, seen) {
  const moves = legal(pos);
  if (!moves.length) return inCheck(pos) ? { over: true, how: 'mate', win: 1 - pos.turn } : { over: true, how: 'stalemate', win: -1 };
  if (deadPosition(pos.b)) return { over: true, how: 'material', win: -1 };
  if (seen && (seen.get(posKey(pos)) || 0) >= 3) return { over: true, how: 'repeat', win: -1 };
  if (pos.half >= 100) return { over: true, how: 'fifty', win: -1 };
  return { over: false, moves };
}

// ---------- notation ----------
// Algebraic notation with piece letters, e.g. Nf3, exd5, O-O, e8=Q+. Letters are English; the board shows figurines instead.
const LET = ' PNBRQK';
export function san(pos, m, all = legal(pos)) {
  const f = mFrom(m), t = mTo(m), p = pos.b[f], ty = typeOf(p), cap = pos.b[t] || (mFlag(m) & EP);
  let s;
  if (mFlag(m) & CASTLE) s = t > f ? 'O-O' : 'O-O-O';
  else if (ty === P) s = (cap ? 'abcdefgh'[f & 7] + 'x' : '') + sqName(t) + (mPromo(m) ? '=' + LET[mPromo(m)] : '');
  else {
    const rivals = all.filter(x => x !== m && mTo(x) === t && pos.b[mFrom(x)] === p);
    let dis = '';
    if (rivals.length) {
      if (!rivals.some(x => (mFrom(x) & 7) === (f & 7))) dis = 'abcdefgh'[f & 7];
      else if (!rivals.some(x => (mFrom(x) >> 3) === (f >> 3))) dis = String((f >> 3) + 1);
      else dis = sqName(f);
    }
    s = LET[ty] + dis + (cap ? 'x' : '') + sqName(t);
  }
  const n = play(pos, m);
  if (inCheck(n)) s += legal(n).length ? '+' : '#';
  return s;
}

export const pieceName = t => [null, L('pawn', 'pion'), L('knight', 'skoczek'), L('bishop', 'goniec'), L('rook', 'wieża'), L('queen', 'hetman'), L('king', 'król')][t];

// Clock choices: minutes each and seconds added after every move. 'off' plays without clocks.
export const CLOCKS = { off: null, '3+2': [3, 2], '5+3': [5, 3], '10+5': [10, 5], '15+10': [15, 10] };

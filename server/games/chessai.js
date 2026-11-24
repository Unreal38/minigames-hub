// The chess bot: iterative deepening alpha-beta with a quiet-search for captures, a small memory of positions seen
// (transposition table), killer moves and null-move pruning. Strength comes from LEVELS: how long and deep it may think,
// and how much noise is added to its root choices (the beginner also sometimes plays a random move).
import { P, N, B, R, Q, K, colorOf, typeOf, mFrom, mTo, mPromo, mFlag, pseudo, make, unmake, makeNull, unmakeNull, attacked, legal, inCheck, deadPosition } from '../../public/games/chess/rules.js';

export const LEVELS = {
  easy: { ms: 120, depth: 2, noise: 220, random: .12 }, // hangs a piece now and then, misses some mates
  club: { ms: 350, depth: 4, noise: 40, random: 0 },    // sees simple tactics, plays sensible moves
  sharp: { ms: 1400, depth: 64, noise: 0, random: 0 },  // as strong as the time allows
};

const VAL = [0, 100, 320, 330, 500, 900, 0];
// Piece-square tables (White's view, a1 first). From the well-known "simplified evaluation function".
const PST = [[],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30],
];
const KING_END = [-50, -30, -30, -30, -30, -30, -30, -50, -30, -30, 0, 0, 0, 0, -30, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -20, -10, 0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -30, -40, -50];

// Score from the side to move's point of view, in centipawns.
export function evaluate(pos) {
  const b = pos.b; let mg = 0, phase = 0, bish = [0, 0];
  const kings = [0, 0];
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p) continue;
    const t = p & 7, c = p >> 3, i = c ? s ^ 56 : s, sign = c ? -1 : 1;
    if (t === K) { kings[c] = i; continue; }
    mg += sign * (VAL[t] + PST[t][i]);
    if (t === B) bish[c]++;
    if (t >= N && t <= Q) phase += t === Q ? 4 : t === R ? 2 : 1;
  }
  // the king hides in the middlegame and walks to the middle once the queens and rooks are gone
  const ph = Math.min(24, phase) / 24;
  mg += Math.round((PST[K][kings[0]] - PST[K][kings[1]]) * ph + (KING_END[kings[0]] - KING_END[kings[1]]) * (1 - ph));
  if (bish[0] >= 2) mg += 30; if (bish[1] >= 2) mg -= 30;
  return pos.turn ? -mg : mg;
}

// ---------- memory ----------
const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE);
const EXACT = 1, LOWER = 2, UPPER = 3;
const MATE = 30000, INF = 32000;

export function think(pos, { ms = 500, depth: maxDepth = 64, noise = 0, random = 0, history = [] } = {}) {
  const root = legal(pos);
  if (!root.length) return 0;
  if (root.length === 1) return root[0];
  if (random && Math.random() < random) return root[Math.random() * root.length | 0];
  const t0 = performance.now(), stopAt = t0 + ms; // its own steady clock (tests freeze Date.now)
  let nodes = 0, stop = false;
  const stack = history.slice(-120); // hashes of positions already on the board, for repeats
  const killers = Array.from({ length: 128 }, () => [0, 0]);
  const hist = new Int32Array(64 * 64);
  ttKey.fill(0);

  const order = (moves, best, ply) => {
    const sc = moves.map(m => {
      if (m === best) return 1e9;
      const cap = pos.b[mTo(m)] || (mFlag(m) & 1 ? 1 : 0);
      if (cap) return 1e8 + VAL[cap & 7] * 10 - VAL[typeOf(pos.b[mFrom(m)])];
      if (mPromo(m)) return 9e7 + VAL[mPromo(m)];
      if (killers[ply][0] === m) return 8e7; if (killers[ply][1] === m) return 7e7;
      return hist[(m & 4095)];
    });
    const idx = moves.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
    return idx.map(i => moves[i]);
  };
  const repeated = () => { for (let i = stack.length - 3; i >= 0 && i >= stack.length - 1 - pos.half; i -= 2) if (stack[i] === pos.h) return true; return false; };

  function quiet(alpha, beta, ply) {
    if ((++nodes & 2047) === 0 && performance.now() > stopAt) stop = true;
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 40) return stand;
    const us = pos.turn;
    for (const m of order(pseudo(pos, [], true), 0, Math.min(ply, 127))) {
      const u = make(pos, m);
      if (attacked(pos.b, pos.k[us], 1 - us)) { unmake(pos, u); continue; }
      const v = -quiet(-beta, -alpha, ply + 1);
      unmake(pos, u);
      if (stop) return 0;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function search(depth, alpha, beta, ply, nullOk) {
    if ((++nodes & 2047) === 0 && performance.now() > stopAt) stop = true;
    if (stop) return 0;
    if (ply && (pos.half >= 100 || repeated() || deadPosition(pos.b))) return 0;
    const check = inCheck(pos);
    if (check) depth++;
    if (depth <= 0) return quiet(alpha, beta, ply);
    const slot = pos.h & TT_MASK, a0 = alpha;
    let best = 0;
    if (ttKey[slot] === pos.h2) {
      best = ttMove[slot];
      if (ply && ttDepth[slot] >= depth) {
        let v = ttScore[slot]; if (v > MATE - 200) v -= ply; else if (v < -MATE + 200) v += ply;
        const f = ttFlag[slot];
        if (f === EXACT || (f === LOWER && v >= beta) || (f === UPPER && v <= alpha)) return v;
      }
    }
    // null move: if passing still keeps us above beta, this line is good enough
    if (nullOk && !check && depth >= 3 && ply) {
      let big = 0; for (let s = 0; s < 64; s++) { const p = pos.b[s]; if (p && colorOf(p) === pos.turn && (p & 7) > P && (p & 7) < K) { big = 1; break; } }
      if (big && evaluate(pos) >= beta) {
        const u = makeNull(pos); stack.push(pos.h);
        const v = -search(depth - 3, -beta, -beta + 1, ply + 1, false);
        stack.pop(); unmakeNull(pos, u);
        if (stop) return 0;
        if (v >= beta) return v;
      }
    }
    const us = pos.turn, k = killers[Math.min(ply, 127)];
    let any = false, bestV = -INF, bestM = 0;
    for (const m of order(pseudo(pos), best, Math.min(ply, 127))) {
      const u = make(pos, m);
      if (attacked(pos.b, pos.k[us], 1 - us)) { unmake(pos, u); continue; }
      any = true; stack.push(pos.h);
      let v;
      if (bestV === -INF) v = -search(depth - 1, -beta, -alpha, ply + 1, true);
      else { v = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true); if (v > alpha && v < beta) v = -search(depth - 1, -beta, -alpha, ply + 1, true); }
      stack.pop(); unmake(pos, u);
      if (stop) return 0;
      if (v > bestV) { bestV = v; bestM = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (!u.cap) { if (k[0] !== m) { k[1] = k[0]; k[0] = m; } hist[m & 4095] += depth * depth; }
        break;
      }
    }
    if (!any) return check ? -MATE + ply : 0;
    let sv = bestV; if (sv > MATE - 200) sv += ply; else if (sv < -MATE + 200) sv -= ply;
    ttKey[slot] = pos.h2; ttMove[slot] = bestM; ttScore[slot] = sv; ttDepth[slot] = depth;
    ttFlag[slot] = bestV <= a0 ? UPPER : bestV >= beta ? LOWER : EXACT;
    return bestV;
  }

  // iterative deepening at the root, keeping each move's score so noise can pick among the good ones
  let ordered = order(root, 0, 0), bestMove = ordered[0], scores = null;
  for (let d = 1; d <= maxDepth; d++) {
    const sc = new Map();
    let alpha = -INF;
    for (const m of ordered) {
      const u = make(pos, m); stack.push(pos.h);
      // with noise, every root move needs its own true-ish score, so no narrowing window
      const v = noise ? -search(d - 1, -INF, INF, 1, true) : (alpha === -INF ? -search(d - 1, -INF, INF, 1, true) : (() => { let x = -search(d - 1, -alpha - 1, -alpha, 1, true); if (x > alpha) x = -search(d - 1, -INF, -alpha, 1, true); return x; })());
      stack.pop(); unmake(pos, u);
      if (stop) break;
      sc.set(m, v);
      if (v > alpha) alpha = v;
    }
    if (stop && sc.size < ordered.length) { // a half-done depth: keep its best only if it beats the last full one
      if (sc.size && scores) { const [m, v] = [...sc].sort((a, b) => b[1] - a[1])[0]; if (v > (scores.get(bestMove) ?? -INF)) bestMove = m; }
      break;
    }
    scores = sc;
    ordered = [...ordered].sort((a, b) => sc.get(b) - sc.get(a));
    bestMove = ordered[0];
    if (Math.abs(sc.get(bestMove)) > MATE - 200) break; // found a mate
    if (performance.now() - t0 > ms * .55) break; // the next depth would not finish in time
  }
  if (noise && scores) {
    let pick = bestMove, top = -INF;
    for (const [m, v] of scores) { const x = v + (Math.abs(v) > MATE - 200 ? 0 : (Math.random() * 2 - 1) * noise); if (x > top) { top = x; pick = m; } }
    return pick;
  }
  return bestMove;
}

// Would a bot happily take a draw here? Only when it stands clearly worse.
export function likesDraw(pos, side) {
  const v = evaluate(pos) * (pos.turn === side ? 1 : -1);
  return v <= -150;
}

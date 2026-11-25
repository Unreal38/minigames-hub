// The warcaby bot: iterative deepening alpha-beta. Captures are compulsory, so a position where the side to move
// must take is never cut off: the search keeps following the takes until things are quiet. A small memory of positions
// seen (transposition table) and a history table order the moves. Strength comes from LEVELS: how long and deep it
// may think, how much noise is added to its root choices, and how often the beginner plays a random move.
import { KING, legal, make, unmake, count } from '../../public/games/warcaby/rules.js';

export const LEVELS = {
  easy: { ms: 120, depth: 2, noise: 90, random: .15 }, // gives pieces away now and then
  club: { ms: 400, depth: 6, noise: 18, random: 0 },   // sees short combinations
  sharp: { ms: 1400, depth: 64, noise: 0, random: 0 }, // as strong as the time allows
};

const MAN_V = 100;
const kingV = n => (n === 10 ? 330 : 270);

// Score from the side to move's point of view, about 100 for a man.
export function evaluate(pos) {
  const { b, n } = pos, K = kingV(n);
  let sc = 0, white = 0, black = 0;
  for (let s = 0; s < b.length; s++) {
    const p = b[s]; if (!p) continue;
    const side = p >> 2, sign = side ? -1 : 1, r = Math.floor(s / n), c = s % n;
    if ((p & 3) === KING) { sc += sign * K; side ? black += K : white += K; continue; }
    side ? black += MAN_V : white += MAN_V;
    const adv = side ? n - 1 - r : r; // rows walked so far
    let v = MAN_V + adv * adv * .8 + adv * 2;
    if (c > 0 && c < n - 1) v += 4; // edges are weaker
    if (c >= 2 && c <= n - 3 && adv >= 2 && adv <= n - 4) v += 6; // the middle of the board
    if (adv === 0 && (c === 1 || c === n - 2 || c === 3 || c === n - 4)) v += 7; // back-row guards stop easy crowning
    sc += sign * v;
  }
  // ahead: trade down (the same lead counts for more with fewer pieces left)
  const tot = white + black;
  if (tot) sc += Math.round((white - black) * 300 / (tot + 300));
  return pos.turn ? -sc : sc;
}

const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE), ttBest = new Int32Array(TT_SIZE);
const EXACT = 1, LOWER = 2, UPPER = 3, WIN = 30000, INF = 32000;
const mkey = m => m.f * 128 + m.t; // for the history table and the memory's best move

export function think(pos, { ms = 500, depth: maxDepth = 64, noise = 0, random = 0, history = [] } = {}) {
  const root = legal(pos);
  if (!root.length) return null;
  if (root.length === 1) return root[0];
  if (random && Math.random() < random) return root[Math.random() * root.length | 0];
  const t0 = performance.now(), stopAt = t0 + ms; // its own steady clock (tests freeze Date.now)
  let nodes = 0, stop = false;
  const stack = history.slice(-120);
  const hist = new Int32Array(128 * 128);
  ttKey.fill(0);

  const order = (moves, best) => {
    if (moves.length < 2) return moves;
    const sc = moves.map(m => (mkey(m) === best ? 1e9 : (m.k ? 1e6 : 0) + hist[mkey(m)]));
    return moves.map((_, i) => i).sort((a, b) => sc[b] - sc[a]).map(i => moves[i]);
  };
  const repeated = () => { for (let i = stack.length - 3; i >= 0 && i >= stack.length - 1 - pos.quiet; i -= 2) if (stack[i] === pos.h) return true; return false; };

  function search(d, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && performance.now() > stopAt) stop = true;
    if (stop) return 0;
    if (ply && (pos.quiet >= 50 || repeated())) return 0;
    const moves = legal(pos);
    if (!moves.length) return -WIN + ply;
    const forced = moves[0].caps.length > 0;
    if (d <= 0 && !forced) return evaluate(pos);
    if (ply > 60) return evaluate(pos);
    const slot = pos.h & TT_MASK;
    let best = 0;
    if (ttKey[slot] === pos.h2) {
      best = ttBest[slot];
      if (ttDepth[slot] >= d && ply) {
        const v = ttScore[slot], f = ttFlag[slot];
        if (f === EXACT || (f === LOWER && v >= beta) || (f === UPPER && v <= alpha)) return v;
      }
    }
    const a0 = alpha;
    let bestV = -INF, bestM = 0;
    const nd = moves.length === 1 ? d : d - 1; // a single reply costs no depth
    for (const m of order(moves, best)) {
      const u = make(pos, m); stack.push(pos.h);
      const v = -search(nd, -beta, -alpha, ply + 1);
      stack.pop(); unmake(pos, u);
      if (stop) return 0;
      if (v > bestV) { bestV = v; bestM = mkey(m); }
      if (v > alpha) alpha = v;
      if (alpha >= beta) { if (!m.caps.length) hist[mkey(m)] += d * d; break; }
    }
    ttKey[slot] = pos.h2; ttScore[slot] = bestV; ttDepth[slot] = Math.max(-1, Math.min(120, d)); ttBest[slot] = bestM;
    ttFlag[slot] = bestV <= a0 ? UPPER : bestV >= beta ? LOWER : EXACT;
    return bestV;
  }

  let choice = root[0], scores = null;
  for (let d = 1; d <= maxDepth; d++) {
    const got = [];
    let alpha = -INF;
    const slot = pos.h & TT_MASK, prev = ttKey[slot] === pos.h2 ? ttBest[slot] : 0;
    for (const m of order(root, prev)) {
      const u = make(pos, m); stack.push(pos.h);
      // with noise, every move needs a true score, so the window stays wide open
      const v = -search(d - 1, -INF, noise ? INF : -alpha, 1);
      stack.pop(); unmake(pos, u);
      if (stop) break;
      got.push({ m, v });
      if (v > alpha) alpha = v;
    }
    if (stop && got.length < root.length) break;
    scores = got;
    const top = got.reduce((a, b) => (b.v > a.v ? b : a));
    ttKey[slot] = pos.h2; ttBest[slot] = mkey(top.m); ttDepth[slot] = d; ttScore[slot] = top.v; ttFlag[slot] = EXACT;
    if (Math.abs(top.v) > WIN - 200) break; // a forced win or loss is found
    if (performance.now() - t0 > ms * .55) break; // the next depth would not finish
  }
  if (!scores) return choice;
  let bestV = -INF;
  for (const { m, v } of scores) { const vv = v + (noise ? (Math.random() * 2 - 1) * noise : 0); if (vv > bestV) { bestV = vv; choice = m; } }
  return choice;
}

// Bots take a draw when they are about a man and a half behind.
export function likesDraw(pos, side) {
  const c = count(pos.b), K = kingV(pos.n) / MAN_V;
  const mat = s => c[s][0] + c[s][1] * K;
  return mat(side) - mat(1 - side) <= -1.5;
}

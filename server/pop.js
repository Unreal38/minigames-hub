// Pet Pop: the solo swap-and-match puzzle. Like Hay Hunch it has no table: each account keeps its level and the
// shelf it is playing on its profile (p.pop), so a shelf survives a refresh or a restart. The server owns the
// shelf: it checks every swap and rolls the pets that drop in, so the browser never knows what comes next.
import crypto from 'node:crypto';
import { N, KINDS, level, deal, play, DAILY, XP_CLEAR, MOVE_BONUS, coinsFor, starsFor } from '../public/games/pop/rules.js';
import { addCoins, shopDate, scheduleSave, invalidateBoards } from './store.js';
import { levelOf } from '../public/ranks.js';

const rnd = n => crypto.randomInt(n);
const gid = () => crypto.randomBytes(4).toString('hex');

function stateOf(p) {
  const h = p.pop ||= { lv: 1, day: '', paid: 0, g: null };
  if (h.day !== shopDate()) { h.day = shopDate(); h.paid = 0; }
  if (!h.g) newShelf(h);
  return h;
}
function newShelf(h) {
  const def = level(h.lv);
  h.g = { id: gid(), lv: h.lv, b: deal(def, rnd), left: def.moves, score: 0, pets: Array(KINDS.length).fill(0), hay: 0, over: null, res: null };
}
const have = (g, goal) => Math.min(goal.n, goal.k === 'pet' ? g.pets[goal.kind] : g.hay);

// What the player sees: the whole shelf (nothing on it is secret), the goals and how far along they are.
export function view(p) {
  const h = stateOf(p), g = h.g, def = level(g.lv), st = p.byGame?.pop;
  return {
    id: g.id, lv: g.lv, level: h.lv, moves: def.moves, kinds: def.kinds, goals: def.goals.map(x => ({ ...x, have: have(g, x) })),
    b: g.b.slice(), left: g.left, score: g.score, over: g.over, res: g.res,
    paid: h.paid, daily: DAILY, best: st?.best || 0, top: st?.top || 0, cleared: st?.wins || 0,
  };
}

// Count one finished shelf on the profile (for the hub's rankings and the profile card).
function record(p, { lv, pts, win, coins, xp }) {
  const s = p.byGame.pop ||= { games: 0, wins: 0, best: 0 };
  s.games++; s.best = Math.max(s.best, pts); s.pts = (s.pts || 0) + pts;
  if (win) { s.wins++; s.top = Math.max(s.top || 0, lv); }
  if (xp) p.xp = (p.xp || 0) + xp;
  if (coins) addCoins(p.pid, coins);
  invalidateBoards(); scheduleSave();
}

// a = { t: 'open' | 'swap' | 'next', a, b }. Returns { s: view, steps?, sw? } or { err } or { need }.
export function handle(p, a) {
  if (!p?.user) return { need: 'account' };
  const h = stateOf(p), g = h.g, t = a?.t;
  if (t === 'open') return { s: view(p) };
  if (t === 'next') { // after a shelf is over: the next level, or the same one again
    if (!g.over) return { err: 'Finish this shelf first.' };
    newShelf(h); scheduleSave(); return { s: view(p) };
  }
  if (t !== 'swap') return { err: 'Unknown move.' };
  if (g.over) return { s: view(p) };
  const x = a.a, y = a.b;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= N || y >= N) return { err: 'No pet there.' };
  const def = level(g.lv), out = play(g.b, x, y, def.kinds, rnd);
  if (!out) return { s: view(p), no: [x, y] }; // the swap lines nothing up: the pets hop back
  g.b = out.board; g.left--; g.score += out.pts; g.hay += out.hay; out.pets.forEach((n, k) => { g.pets[k] += n; });
  if (def.goals.every(goal => have(g, goal) >= goal.n)) {
    const stars = starsFor(g.left, def.moves), bonus = g.left * MOVE_BONUS, room = Math.max(0, DAILY - h.paid);
    const coins = Math.min(room, coinsFor(stars)), xp = room > 0 ? XP_CLEAR : 0, was = levelOf(p.xp || 0);
    g.score += bonus; h.paid += coins; h.lv = g.lv + 1;
    g.over = 'win'; g.res = { pts: g.score, bonus, left: g.left, stars, coins, xp, capped: coins < coinsFor(stars), next: h.lv };
    record(p, { lv: g.lv, pts: g.score, win: true, coins, xp });
    g.res.levelUp = levelOf(p.xp || 0) > was;
  } else if (g.left <= 0) {
    g.over = 'lose'; g.res = { pts: g.score, bonus: 0, left: 0, stars: 0, coins: 0, xp: 0, next: h.lv };
    record(p, { lv: g.lv, pts: g.score, win: false });
  }
  scheduleSave();
  return { s: view(p), steps: out.steps, sw: [x, y] };
}

// Pet Mahjong, the solo game: match free pairs of tiles until the board is clear. Like Pet Pop it has no table:
// each account keeps its level and the board it is playing on its profile (p.mj), so a board survives a refresh
// or a restart. The server owns the board: it checks every pair, keeps the time and does the shuffling.
import crypto from 'node:crypto';
import { layout, level, deal, reshuffle, canPair, findMove, tilesLeft, DAILY, XP_CLEAR, PAIR_PTS, QUICK_MS, QUICK_PTS, QUICK_MAX, HINT_COST, TIME_PTS, IDLE_MS, starsFor, coinsFor } from '../public/games/mahj/rules.js';
import { addCoins, scheduleSave, invalidateBoards } from './store.js';
import { dayOf } from './day.js';
import { levelOf } from '../public/ranks.js';

const rnd = n => crypto.randomInt(n);
const gid = () => crypto.randomBytes(4).toString('hex');

function stateOf(p) {
  const h = p.mj ||= { lv: 1, day: '', paid: 0, g: null };
  if (h.day !== dayOf()) { h.day = dayOf(); h.paid = 0; }
  if (!h.g || !layout(h.g.lay) || h.g.b?.length !== layout(h.g.lay).n) newBoard(h);
  return h;
}
function newBoard(h) {
  const def = level(h.lv), lay = layout(def.id);
  h.g = { id: gid(), lv: h.lv, lay: def.id, b: deal(lay, def.kinds, rnd), ms: 0, last: 0, score: 0, streak: 0, hints: 0, shuf: 0, over: null, res: null };
}
// Time only runs while you play: a long pause between two moves counts as IDLE_MS at most.
function clock(g, now) { if (g.last) g.ms += Math.min(IDLE_MS, Math.max(0, now - g.last)); g.last = now; }

export function view(p) {
  const h = stateOf(p), g = h.g, def = level(g.lv), st = p.byGame?.mj;
  return {
    id: g.id, lv: g.lv, level: h.lv, lay: g.lay, b: g.b.slice(), ms: g.ms, run: !!g.last && !g.over, par: def.par, score: g.score, streak: g.streak,
    hints: g.hints, shuf: g.shuf, stuck: !g.over && !findMove(layout(g.lay), g.b), over: g.over, res: g.res,
    paid: h.paid, daily: DAILY, best: st?.best || 0, top: st?.top || 0, cleared: st?.wins || 0,
  };
}

// Count one finished board on the profile (for the hub's rankings and the profile card).
function record(p, { lv, pts, win, coins, xp }) {
  const s = p.byGame.mj ||= { games: 0, wins: 0, best: 0 };
  s.games++; s.best = Math.max(s.best, pts); s.pts = (s.pts || 0) + pts;
  if (win) { s.wins++; s.top = Math.max(s.top || 0, lv); }
  if (xp) p.xp = (p.xp || 0) + xp;
  if (coins) addCoins(p.pid, coins);
  invalidateBoards(); scheduleSave();
}

// a = { t: 'open' | 'pair' | 'hint' | 'shuf' | 'next' | 'new', a, b }. Returns { s: view, ... } or { err } or { need }.
export function handle(p, a, now = Date.now()) {
  if (!p?.user) return { need: 'account' };
  const h = stateOf(p), g = h.g, t = a?.t, lay = layout(g.lay);
  if (t === 'open') return { s: view(p) };
  if (t === 'next') { // after a board is over: the next level, or the same one again
    if (!g.over) return { err: 'Finish this board first.' };
    newBoard(h); scheduleSave(); return { s: view(p) };
  }
  if (t === 'new') { // give up on this board and deal the level again (nothing is paid, nothing is counted)
    if (g.over) return { err: 'This board is finished.' };
    newBoard(h); scheduleSave(); return { s: view(p) };
  }
  if (g.over) return { s: view(p) };
  if (t === 'hint') {
    const m = findMove(lay, g.b); if (!m) return { s: view(p) };
    clock(g, now); g.hints++; g.score = Math.max(0, g.score - HINT_COST); g.streak = 0; scheduleSave();
    return { s: view(p), hint: m };
  }
  if (t === 'shuf') {
    clock(g, now);
    const b = reshuffle(lay, g.b, rnd);
    if (!b) { // the last tiles lie on each other: no mixing can help, the board is lost
      g.over = 'lose'; g.res = { pts: g.score, ms: g.ms, left: tilesLeft(g.b), stars: 0, coins: 0, xp: 0, next: h.lv };
      record(p, { lv: g.lv, pts: g.score, win: false }); return { s: view(p), lost: true };
    }
    g.b = b; g.shuf++; g.streak = 0; scheduleSave();
    return { s: view(p), mixed: true };
  }
  if (t !== 'pair') return { err: 'Unknown move.' };
  const i = a.a, j = a.b;
  if (!canPair(lay, g.b, i, j)) return { s: view(p), no: [i, j] };
  const gap = g.last ? now - g.last : Infinity; clock(g, now);
  g.streak = gap <= QUICK_MS ? Math.min(QUICK_MAX, g.streak + 1) : 0;
  const pts = PAIR_PTS + g.streak * QUICK_PTS;
  g.b[i] = g.b[j] = -1; g.score += pts;
  if (!tilesLeft(g.b)) {
    const def = level(g.lv), stars = starsFor(g.ms, def.par, g.shuf), bonus = Math.max(0, Math.round((def.par - g.ms) / 1000)) * TIME_PTS, room = Math.max(0, DAILY - h.paid);
    const coins = Math.min(room, coinsFor(stars)), xp = room > 0 ? XP_CLEAR : 0, was = levelOf(p.xp || 0);
    g.score += bonus; h.paid += coins; h.lv = g.lv + 1;
    g.over = 'win'; g.res = { pts: g.score, bonus, ms: g.ms, fast: g.ms <= def.par, clean: !g.shuf, stars, coins, xp, capped: coins < coinsFor(stars), next: h.lv };
    record(p, { lv: g.lv, pts: g.score, win: true, coins, xp });
    g.res.levelUp = levelOf(p.xp || 0) > was;
  }
  scheduleSave();
  return { s: view(p), took: [i, j], pts };
}

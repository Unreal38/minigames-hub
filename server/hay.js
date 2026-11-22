// Hay Hunch: the solo hay-bale puzzle. Like Pet Farm it has no table: each account keeps its own field and level
// on its profile (p.hay), so a field survives a refresh or a restart and cannot be thrown away for a better one.
// The browser only ever sees bales that have been flipped, until the field is over.
import crypto from 'node:crypto';
import { N, MAX_LV, PET, deal, hints, harvestOf, goal, found, coinsFor, DAILY, XP_CLEAR } from '../public/games/hay/rules.js';
import { addCoins, shopDate, scheduleSave, invalidateBoards } from './store.js';
import { levelOf } from '../public/ranks.js';

const rnd = n => crypto.randomInt(n);
const fid = () => crypto.randomBytes(4).toString('hex');

function stateOf(p) {
  const h = p.hay ||= { lv: 1, top: 1, day: '', paid: 0, f: null };
  if (h.day !== shopDate()) { h.day = shopDate(); h.paid = 0; }
  if (!h.f) newField(h);
  return h;
}
function newField(h) {
  h.f = { id: fid(), lv: h.lv, cells: deal(h.lv, rnd), open: Array(N * N).fill(0), over: null, at: Date.now() };
}

// What the player sees: the signs, the flipped bales, and everything once the field is over.
export function view(p) {
  const h = stateOf(p), f = h.f, all = !!f.over;
  return {
    id: f.id, lv: f.lv, level: h.lv, top: h.top, n: N, ...hints(f.cells),
    cells: f.cells.map((v, i) => all || f.open[i] ? v : -1), open: f.open.slice(),
    harvest: harvestOf(f.cells, f.open), goal: goal(f.cells), found: found(f.cells, f.open),
    over: f.over, res: f.res || null, wake: f.wake ?? -1,
    paid: h.paid, daily: DAILY, best: p.byGame?.hay?.best || 0, total: p.byGame?.hay?.pts || 0, cleared: p.byGame?.hay?.wins || 0,
  };
}

// Count one finished field on the profile (for the hub's rankings and the "your progress" card).
function record(p, h, { pts, win, coins, xp }) {
  const g = p.byGame.hay ||= { games: 0, wins: 0, best: 0 };
  g.games++; if (win) g.wins++; g.best = Math.max(g.best, pts); g.pts = (g.pts || 0) + pts; g.top = Math.max(g.top || 1, h.top);
  if (xp) p.xp = (p.xp || 0) + xp;
  if (coins) addCoins(p.pid, coins);
  invalidateBoards(); scheduleSave();
}

// a = { t: 'open' | 'flip' | 'bank' | 'next', i }. Returns { s: view } or { err }.
export function handle(p, a) {
  if (!p?.user) return { need: 'account' };
  const h = stateOf(p), f = h.f, t = a?.t;
  if (t === 'open') return { s: view(p) };
  if (t === 'next') {
    if (!f.over) return { err: 'Finish this field first.' };
    newField(h); scheduleSave(); return { s: view(p) };
  }
  if (f.over) return { s: view(p) };
  if (t === 'flip') {
    const i = a.i;
    if (!Number.isInteger(i) || i < 0 || i >= N * N) return { err: 'No bale there.' };
    if (f.open[i]) return { s: view(p) };
    f.open[i] = 1;
    const v = f.cells[i], lvBefore = h.lv;
    if (v === PET) {
      const lost = harvestOf(f.cells, f.open);
      h.lv = Math.max(1, h.lv - 1);
      f.over = 'pet'; f.wake = i; f.res = { pts: 0, lost, coins: 0, xp: 0, from: lvBefore, to: h.lv };
      record(p, h, { pts: 0, win: false });
    } else if (found(f.cells, f.open) === goal(f.cells)) {
      const pts = harvestOf(f.cells, f.open), left = Math.max(0, DAILY - h.paid), coins = Math.min(left, coinsFor(f.lv)), xp = left > 0 ? XP_CLEAR : 0;
      const lvl = levelOf(p.xp || 0);
      h.paid += coins; h.lv = Math.min(MAX_LV, h.lv + 1); h.top = Math.max(h.top, h.lv);
      f.over = 'clear'; f.res = { pts, coins, xp, from: lvBefore, to: h.lv, capped: coins < coinsFor(f.lv) };
      record(p, h, { pts, win: true, coins, xp });
      f.res.levelUp = levelOf(p.xp || 0) > lvl;
    }
    scheduleSave();
    return { s: view(p) };
  }
  if (t === 'bank') {
    const pts = harvestOf(f.cells, f.open);
    if (!pts) return { err: 'Flip a bale first.' };
    f.over = 'bank'; f.res = { pts, coins: 0, xp: 0, from: h.lv, to: h.lv };
    record(p, h, { pts, win: false });
    return { s: view(p) };
  }
  return { err: 'Unknown move.' };
}

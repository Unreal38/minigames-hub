// Burrow Bop: everyone bops Pet Farm pets popping out of the nine burrows of their own garden, at the same time.
// The list of pop-ups (rules.js) comes from one seed, so every player gets the same pets in the same burrows at the
// same moments. Three hearts each: a pet that ducks back unbopped costs one, and so does bopping a sleeping pet.
// The last player with a heart wins; after three minutes the highest score does.
// Real time: each browser plays its own garden and reports every bop; the clock here decides what got away.
import { LIVES, TOTAL, PET, SLEEP, LAG, EARLY, schedule, newPlayer, resolve } from '../../public/games/bop/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'bop', name: 'Burrow Bop', minPlayers: 1, maxPlayers: 6, seats: { lo: 1, def: 4 }, joinAt: 'game' };

const COUNT_MS = 3600;
const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// lo..hi: how long a bot takes to bop a pet (ms); slip: how often it just misses one; nap: how often it bops a sleeper
export const BOT = { chill: { lo: 430, hi: 900, slip: .008, nap: .04 }, sharp: { lo: 340, hi: 720, slip: .004, nap: .015 } };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    pace: ['calm', 'normal', 'fast'].includes(o.pace) ? o.pace : 'normal',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const now = Date.now(), seed = (Math.random() * 2 ** 31) | 0, pops = schedule(seed, opts.pace);
  return {
    game: 'bop', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts, seed, pops,
    startAt: now, goAt: now + COUNT_MS, beat: 0,
    x: seats.map(() => ({ p: newPlayer(), res: new Uint8Array(pops.length), plan: new Array(pops.length), ptr: 0, sync: 0, outAt: 0, place: 0 })),
    ev: [], evN: 0, res: null, win: -1, endAt: 0, dirty: true,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 40) G.ev.shift(); }
const alive = G => G.seats.map((_, i) => i).filter(i => G.x[i].p.lv > 0);
const playing = (G, s) => G.seats[s].human && !G.seats[s].bot; // a person at the controls right now

function knockOut(G, s, at) {
  const x = G.x[s]; if (x.outAt) return;
  x.outAt = Math.max(1, Math.round(at)); x.place = alive(G).length + 1; G.dirty = true;
  pushEv(G, { t: 'out', s, place: x.place });
}
// a pet went back down by itself
function escape(G, s, j) {
  const x = G.x[s], pop = G.pops[j];
  x.res[j] = 2;
  if (resolve(x.p, pop, false).life) { G.dirty = true; if (x.p.lv <= 0) knockOut(G, s, pop.at + pop.up); }
}
function bop(G, s, j, at) {
  const x = G.x[s];
  x.res[j] = 1; resolve(x.p, G.pops[j], true); G.dirty = true;
  pushEv(G, { t: 'b', s, i: j });
  if (x.p.lv <= 0) knockOut(G, s, at);
}
// everything that had ducked by time t (and was not bopped) got away
function sweep(G, s, t) {
  const x = G.x[s], P = G.pops;
  for (let j = x.ptr; j < P.length && P[j].at <= t && x.p.lv > 0; j++) if (!x.res[j] && P[j].at + P[j].up <= t) escape(G, s, j);
  while (x.ptr < P.length && x.res[x.ptr]) x.ptr++;
}

// ---------- bots ----------
// When (ms after the start) the bot bops this pet, or -1 when it leaves it alone or is too slow.
export function botPlan(pop, lvl) {
  if (pop.kind === SLEEP) return Math.random() < lvl.nap ? pop.at + pop.up * (.3 + Math.random() * .5) : -1;
  if (Math.random() < lvl.slip) return -1;
  const react = lvl.lo + Math.random() * (lvl.hi - lvl.lo);
  return react < pop.up - 40 ? pop.at + react : -1;
}
function botStep(G, s, t) {
  const x = G.x[s], P = G.pops, lvl = BOT[G.seats[s].human ? 'chill' : G.opts.bots];
  for (let j = x.ptr; j < P.length && P[j].at <= t && x.p.lv > 0; j++) {
    if (x.res[j]) continue;
    const pop = P[j];
    if (x.plan[j] === undefined) x.plan[j] = botPlan(pop, lvl);
    if (x.plan[j] >= 0 && x.plan[j] <= t && t <= pop.at + pop.up) bop(G, s, j, x.plan[j]);
    else if (pop.at + pop.up <= t) escape(G, s, j);
  }
  while (x.ptr < P.length && x.res[x.ptr]) x.ptr++;
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'count') {
    if (now >= G.goAt) { G.stage = 'go'; pushEv(G, { t: 'go' }); G.dirty = true; }
    return flush(G, now);
  }
  const t = now - G.goAt;
  for (const s of alive(G)) {
    if (!playing(G, s)) botStep(G, s, t);
    else sweep(G, s, t - LAG); // a person's bop may still be on its way
  }
  const left = alive(G), last = Math.max(0, ...G.x.map(x => x.outAt));
  const over = left.length <= (G.seats.length > 1 ? 1 : 0) || !left.some(s => playing(G, s));
  // wait a moment before ending: somebody else may have lost their last heart to the very same pet
  if ((over && (!left.length || t >= last + LAG + 60)) || t >= TOTAL + 2600) finish(G, now);
  return flush(G, now);
}
function flush(G, now) {
  if (now - G.beat > 1000) G.dirty = true; // a steady beat keeps every browser's clock right
  const d = G.dirty; if (d) G.beat = now; G.dirty = false; return d;
}

function finish(G, now) {
  // whoever still has a heart comes first, by score; then the others, by who lasted longest (a tie: by score)
  const order = G.seats.map((_, i) => i).sort((a, b) => {
    const A = G.x[a], B = G.x[b];
    return (B.p.lv > 0) - (A.p.lv > 0) || (A.p.lv > 0 ? 0 : B.outAt - A.outAt) || B.p.sc - A.p.sc || a - b;
  });
  order.forEach((s, i) => { G.x[s].place = i + 1; });
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = order[0];
  G.res = { order, sc: G.x.map(x => x.p.sc), bops: G.x.map(x => x.p.bops), best: G.x.map(x => x.p.best), time: G.x.map(x => x.p.lv > 0 ? 0 : x.outAt), ms: Math.max(0, Math.min(TOTAL, now - G.goAt)) };
  pushEv(G, { t: 'end', w: G.win }); G.dirty = true;
}

// ---------- what people send: { t: 'h', y0: sync, i: which pop-up, c: the browser's clock when it was bopped } ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || !playing(G, s) || G.ph !== 'play' || G.stage !== 'go') return false;
  const x = G.x[s], t = Date.now() - G.goAt;
  if (x.p.lv <= 0 || a.t !== 'h' || a.y0 !== x.sync || !Number.isInteger(a.i) || a.i < 0 || a.i >= G.pops.length || x.res[a.i]) return false;
  const pop = G.pops[a.i], c = Math.min(t, Number.isFinite(a.c) ? a.c : t);
  if (t < pop.at - EARLY || t > pop.at + pop.up + LAG || c > pop.at + pop.up + 30) return false; // too late: the clock will count it as got away
  sweep(G, s, c); // what had ducked on their screen before this bop
  if (x.p.lv > 0 && !x.res[a.i]) bop(G, s, a.i, c);
  while (x.ptr < G.pops.length && x.res[x.ptr]) x.ptr++;
  return false; // fast() sends it on its next beat
}

export function tick() { return false; } // fast() does the work

// A player who drops out keeps their garden; a bot bops for them until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.x[s].sync++; G.dirty = true;
  return true;
}

export function view(G, s) {
  const now = Date.now(), t = now - G.goAt;
  const out = {
    game: 'bop', ph: G.ph, stage: G.stage, gid: G.gid, me: s, seed: G.seed, pace: G.opts.pace, t,
    seats: G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    x: G.x.map(x => [x.p.lv, x.p.sc, x.p.cb, x.place, x.p.bops]),
    ev: G.ev, res: G.res, win: G.win,
  };
  if (s >= 0) {
    const x = G.x[s], P = G.pops; let r = '';
    for (let j = x.ptr; j < P.length && P[j].at <= t; j++) r += x.res[j];
    out.mine = { sync: x.sync, ...x.p, b: x.ptr, r: r.replace(/0+$/, '') };
  }
  return out;
}

// Per-seat outcome: placed by who kept a heart longest; points are the score.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: G.x[i].p.sc, win: G.x[i].place === 1, place: G.x[i].place }));
}
void LIVES; void PET;

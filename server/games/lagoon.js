// Bubble Lagoon: everyone shoots pet bubbles in their own lagoon at the same time. Three of a kind pop; bubbles
// left hanging on nothing fall and come up as eggs under whoever is doing best. The reef pushes new rows down,
// quicker and quicker, and a bubble over the line puts you out. Last one afloat wins.
// Real time: each browser plays its own lagoon with the shared rules (rules.js) and reports every shot. The server
// replays that shot on its own copy, so pops, eggs and knock-outs are all decided here.
import { AMAX, MAXG, GRACE, HURRY, newState, lock, clone, count, encode, rowsDue, around } from '../../public/games/lagoon/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'lagoon', name: 'Bubble Lagoon', minPlayers: 1, maxPlayers: 4, joinAt: 'game' };

const COUNT_MS = 3600;
const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const BOT = { chill: { ms: 2300, slip: .3, step: 80 }, sharp: { ms: 1500, slip: .08, step: 40 } }; // a shot every ms; slip: how often it takes a so-so shot; step: how finely it aims

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4].includes(+o.seats) ? +o.seats : 4,
    speed: ['calm', 'normal', 'fast'].includes(o.speed) ? o.speed : 'normal',
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
  const now = Date.now(), seed = (Math.random() * 2 ** 31) | 0;
  const G = {
    game: 'lagoon', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts, seed,
    startAt: now, goAt: now + COUNT_MS,
    st: seats.map(() => newState(seed)),
    x: seats.map(() => ({ sync: 0, lockAt: 0, botAt: now + COUNT_MS + 500 + Math.random() * 900, gN: 0, place: 0, outAt: 0, bs: '', n: 0 })),
    ev: [], evN: 0, res: null, win: -1, endAt: 0, dirty: true,
  };
  G.st.forEach((st, i) => { G.x[i].bs = encode(st); G.x[i].n = count(st.b); });
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 30) G.ev.shift(); }
const alive = G => G.seats.map((_, i) => i).filter(i => !G.st[i].dead);
const playing = (G, s) => G.seats[s].human && !G.seats[s].bot; // a person at the controls right now

// ---------- after any shot has landed (a person's or a bot's) ----------
function settle(G, s, res, now) {
  const st = G.st[s], x = G.x[s];
  x.lockAt = now; x.bs = encode(st); x.n = count(st.b); G.dirty = true;
  if (res.out > 0) {
    // the eggs go to whoever is doing best: the fewest bubbles left (a tie: the fewest eggs already on their way)
    const others = alive(G).filter(i => i !== s);
    if (others.length) {
      const to = others.sort((p, q) => G.x[p].n - G.x[q].n || G.st[p].pend.length - G.st[q].pend.length || p - q)[0];
      for (let k = 0; k < res.out; k++) G.st[to].pend.push({ id: ++G.x[to].gN, at: now });
      pushEv(G, { t: 'atk', s, to, k: res.out });
    }
  }
  if (res.clean) pushEv(G, { t: 'clean', s });
  if (st.dead) knockOut(G, s, now);
}
function knockOut(G, s, now) {
  const x = G.x[s]; if (x.place) return;
  x.place = alive(G).length + 1; x.outAt = Math.max(1, now - G.goAt);
  G.st[s].pend = []; G.dirty = true;
  pushEv(G, { t: 'out', s, place: x.place });
}

// ---------- bots ----------
// Try aims across the whole fan (with the bubble in hand and with the next one) and score what each would leave.
export function bestShot(st, { slip = 0, step = 40 } = {}) {
  const opts = [];
  for (let w = 0; w < (st.cur === st.nxt ? 1 : 2); w++) for (let a = -800; a <= 800; a += step) {
    const c = clone(st), res = lock(c, a, w, 0, st.rows); if (!res) continue;
    let v = res.popped.length + res.dropped.length * 3 + res.cracked.length * 1.5 - c.b.length * .7;
    if (!res.popped.length) v += around(c, res.r, res.c).filter(([rr, cc]) => c.b[rr]?.[cc] === res.kind).length * .9 - res.r * .2;
    if (c.dead) v -= 1000;
    opts.push({ a, w, v: v + Math.random() * .2 });
  }
  if (!opts.length) return null;
  opts.sort((p, q) => q.v - p.v);
  return Math.random() < slip ? opts[Math.min(opts.length - 1, 2 + ((Math.random() * 8) | 0))] : opts[0];
}
function botStep(G, s, now) {
  const x = G.x[s], st = G.st[s]; if (now < x.botAt) return;
  const lvl = BOT[G.seats[s].human ? 'chill' : G.opts.bots], m = bestShot(st, lvl);
  const res = m && lock(st, m.a, m.w, Math.min(st.pend.length, MAXG), rowsDue(G.opts.speed, now - G.goAt));
  x.botAt = now + lvl.ms * (.8 + Math.random() * .4);
  if (!res) { st.dead = true; x.bs = encode(st); knockOut(G, s, now); return; }
  settle(G, s, res, now);
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'count') {
    if (now >= G.goAt) { G.stage = 'go'; for (const x of G.x) x.lockAt = now - 200; pushEv(G, { t: 'go' }); G.dirty = true; }
    return flush(G);
  }
  for (const s of alive(G)) {
    if (!playing(G, s)) botStep(G, s, now);
    // somebody who shoots nothing for far too long (a frozen tab) gets a shot fired for them
    else if (now - G.x[s].lockAt > HURRY + 6200) forceShot(G, s, now);
  }
  const left = alive(G);
  if (left.length <= (G.seats.length > 1 ? 1 : 0) || !left.some(s => playing(G, s))) finish(G, now);
  return flush(G);
}
function flush(G) { const d = G.dirty; G.dirty = false; return d; }
function forceShot(G, s, now) {
  const st = G.st[s], res = lock(st, 0, 0, Math.min(st.pend.length, MAXG), rowsDue(G.opts.speed, now - G.goAt));
  G.x[s].sync++;
  if (!res) { st.dead = true; G.x[s].bs = encode(st); knockOut(G, s, now); return; }
  settle(G, s, res, now);
}

function finish(G, now) {
  // anyone still afloat (bots, once every person is out) is placed by how few bubbles they have left
  const left = alive(G).sort((a, b) => G.x[a].n - G.x[b].n || G.st[b].freed - G.st[a].freed);
  left.forEach((s, i) => { G.x[s].place = i + 1; G.x[s].outAt = 0; });
  const order = G.seats.map((_, i) => i).sort((a, b) => G.x[a].place - G.x[b].place);
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = order[0];
  G.res = { order, freed: G.st.map(s => s.freed), sent: G.st.map(s => s.sent), time: G.x.map(x => x.outAt), ms: Math.max(0, now - G.goAt) };
  pushEv(G, { t: 'end', w: G.win }); G.dirty = true;
}

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || !playing(G, s) || G.ph !== 'play' || G.stage !== 'go') return false;
  const st = G.st[s], x = G.x[s], now = Date.now();
  if (st.dead || a.y0 !== x.sync || a.t !== 's') return false; // sent before the browser took the server's copy: stale
  const resync = () => { if (process.env.LG_DEBUG) console.log('resync', s, JSON.stringify(a), st.locks, st.rows, now - x.lockAt, rowsDue(G.opts.speed, now - G.goAt - 3000), rowsDue(G.opts.speed, now - G.goAt + 400), st.pend.length); x.sync++; G.dirty = true; return false; };
  if (a.n !== st.locks + 1 || now - x.lockAt < 120) return resync();
  if (![a.a, a.w, a.g, a.k].every(Number.isInteger) || Math.abs(a.a) > AMAX) return resync();
  // the reef's rows follow the clock: the browser may be a little behind it, never ahead
  const t = now - G.goAt;
  if (a.k < st.rows || a.k < rowsDue(G.opts.speed, t - 3000) || a.k > rowsDue(G.opts.speed, t + 400)) return resync();
  // eggs that have waited long enough must float in now (unless the shot pops something); newer ones may
  const avail = Math.min(st.pend.length, MAXG), must = Math.min(MAXG, st.pend.filter(p => now - p.at > GRACE).length);
  if (a.g < 0 || a.g > avail) return resync();
  const trial = clone(st), tres = lock(trial, a.a, a.w, a.g, a.k);
  if (!tres || (!tres.popped.length && a.g < must)) return resync();
  settle(G, s, lock(st, a.a, a.w, a.g, a.k), now);
  return false; // fast() sends it on its next beat
}

export function tick() { return false; } // fast() does the work

// A player who drops out keeps their lagoon; a bot shoots for them until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.x[s].sync++; G.x[s].lockAt = Date.now(); G.x[s].botAt = Date.now() + 900; G.dirty = true;
  return true;
}

export function view(G, s) {
  const now = Date.now();
  const out = {
    game: 'lagoon', ph: G.ph, stage: G.stage, gid: G.gid, me: s, seed: G.seed, speed: G.opts.speed, t: now - G.goAt,
    seats: G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    b: G.x.map(x => x.bs),
    x: G.st.map((st, i) => [st.dead ? 1 : 0, st.freed, st.sent, st.pend.length, G.x[i].place, G.x[i].n, st.rows]),
    ev: G.ev, res: G.res, win: G.win,
  };
  if (s >= 0) {
    const st = G.st[s];
    out.mine = { sync: G.x[s].sync, locks: st.locks, cur: st.cur, nxt: st.nxt, nx: st.nx, eg: st.eg, rows: st.rows, streak: st.streak, freed: st.freed, sent: st.sent, dead: st.dead, pend: st.pend.map(p => p.id) };
  }
  return out;
}

// Per-seat outcome: placed by who stayed afloat longest; points for pets freed and eggs sent.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: G.st[i].freed + G.st[i].sent * 2, win: G.x[i].place === 1, place: G.x[i].place }));
}

// for tests
export const _settle = settle;

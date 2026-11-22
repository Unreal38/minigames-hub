// Sky Darts: classic 301/501 countdown darts, three darts a turn, round the table. The server owns every dart:
// the client sends where it aimed and how long the hand was held still, and the shared wobble (rules.js) says where it lands.
import { DARTS, ROUNDS, MS, score, spot, apply, plan, landing, clampAim } from '../../public/games/darts/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'darts', name: 'Sky Darts', minPlayers: 1, maxPlayers: 6, joinAt: 'leg' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// How far a bot's dart strays from where it meant (board units, 1 = the double ring). Measured on 301 double out:
// a winning chill bot needs about 8 rounds, a sharp one about 5.
export const BOTS = { chill: { sd: .13, think: [900, 1500] }, sharp: { sd: .085, think: [700, 1100] } };

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4, 6].includes(+o.seats) ? +o.seats : 4,
    start: +o.start === 501 ? 501 : 301,
    out: o.out === 'any' ? 'any' : 'double',
    legs: [1, 3].includes(+o.legs) ? +o.legs : 1,
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 15, 30].includes(+o.timer) ? +o.timer : 15,
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
  while (seats.length < opts.seats) seats.push({ id: null, name: names[bi], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length;
  const G = {
    game: 'darts', ph: 'play', stage: 'aim', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    leg: 1, legFirst: Math.random() * n | 0, turn: 0, round: 1, rounds: ROUNDS[opts.start],
    rem: seats.map(() => opts.start), legs: seats.map(() => 0),
    st: seats.map(() => ({ darts: 0, scored: 0, best: 0, tons: 0, t180: 0, busts: 0, outs: 0, hi: 0 })),
    darts: [], turnFrom: opts.start, dartN: 0, seed: 0, aimAt: 0, stageEnd: 0, botAt: -1, bot: null,
    last: null, lastN: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [], legWin: -1,
  };
  G.turn = G.legFirst;
  beginTurn(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 16) G.ev.shift(); }
const dbl = G => G.opts.out === 'double';
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.SQRT1_2; };

function beginTurn(G, now) {
  G.darts = []; G.turnFrom = G.rem[G.turn];
  beginDart(G, now);
}
function beginDart(G, now) {
  G.stage = 'aim'; G.aimAt = now; G.dartN++; G.seed = Math.floor(Math.random() * 1e6) / 1000;
  planDart(G, now);
}
function planDart(G, now) {
  const s = G.seats[G.turn];
  if (s.bot) {
    const B = BOTS[G.opts.bots], t = plan(G.rem[G.turn], DARTS - G.darts.length, dbl(G)), [x, y] = spot(t.n, t.m);
    G.bot = { x: x + gauss() * B.sd, y: y + gauss() * B.sd, aim: [x, y] };
    G.botAt = Math.max(now - G.aimAt, B.think[0] + Math.random() * (B.think[1] - B.think[0])) + (G.darts.length ? 0 : 900);
    G.stageEnd = G.aimAt + G.botAt;
  } else { G.bot = null; G.botAt = -1; G.stageEnd = G.opts.timer > 0 ? now + G.opts.timer * 1000 : 0; }
}

// One dart lands at (x, y). `how`: 'aim' a player's throw, 'bot', 'late' (the timer ran out).
function land(G, x, y, how, now, aim = null) {
  const s = G.turn, hit = score(x, y), a = apply(G.rem[s], hit, dbl(G)), me = G.st[s];
  me.darts++;
  const d = { x: +x.toFixed(4), y: +y.toFixed(4), v: hit.v, m: hit.m, num: hit.n, lab: hit.lab, bust: a.bust, out: a.out, how };
  G.darts.push(d);
  G.rem[s] = a.left;
  const fin = a.bust || a.out || G.darts.length >= DARTS;
  let after = MS.next;
  if (fin) {
    const got = a.bust ? 0 : G.turnFrom - a.left;
    if (a.bust) { G.rem[s] = G.turnFrom; me.busts++; after = MS.bust; }
    else { me.scored += got; me.best = Math.max(me.best, got); if (got >= 100) me.tons++; if (got === 180) me.t180++; after = MS.turn; }
    if (a.out) { me.outs++; me.hi = Math.max(me.hi, G.turnFrom); G.legs[s]++; after = MS.leg; }
    pushEv(G, { t: a.bust ? 'bust' : a.out ? 'out' : 'turn', s, pts: got, from: G.turnFrom });
    d.got = got;
  }
  G.last = { n: ++G.lastN, s, i: G.darts.length - 1, ...d, aim, at0: now, fin };
  G.stage = 'fly'; G.stageEnd = now + MS.fly + after; G.bot = null; G.botAt = -1;
  return true;
}

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => G.legs[b] - G.legs[a] || G.rem[a] - G.rem[b] || G.st[b].scored - G.st[a].scored);
  G.win = order[0]; G.ph = 'end'; G.stage = 'end'; G.endAt = now;
  G.res = { order, legs: [...G.legs], rem: [...G.rem] };
  pushEv(G, { t: 'end', w: G.win });
}

function nextLeg(G, now, winner) {
  G.legWin = winner;
  const need = Math.ceil(G.opts.legs / 2);
  if (G.legs[winner] >= need) return finish(G, now);
  G.leg++; G.legFirst = (G.legFirst + 1) % G.seats.length; G.turn = G.legFirst; G.round = 1;
  G.rem = G.seats.map(() => G.opts.start);
  seatQueued(G);
  pushEv(G, { t: 'leg', k: G.leg, w: winner });
  beginTurn(G, now);
}

function after(G, now) {
  const L = G.last;
  if (!L.fin) return beginDart(G, now);
  if (L.out) return nextLeg(G, now, L.s);
  const n = G.seats.length;
  G.turn = (G.turn + 1) % n;
  if (G.turn === G.legFirst) {
    G.round++;
    if (G.round > G.rounds) { // nobody got out in time: the lowest score left takes the leg
      const w = G.seats.map((_, i) => i).sort((a, b) => G.rem[a] - G.rem[b] || G.st[b].scored - G.st[a].scored)[0];
      G.legs[w]++; pushEv(G, { t: 'cap', s: w });
      return nextLeg(G, now, w);
    }
  }
  beginTurn(G, now);
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  if (a.t === 'throw') {
    if (G.stage !== 'aim' || G.turn !== s || G.seats[s].bot) return false;
    const now = Date.now(), el = now - G.aimAt;
    // the player saw the dart come up a moment late, so trust their clock within reason
    let ms = Number.isFinite(+a.ms) ? +a.ms : el;
    ms = Math.min(el, Math.max(el - 1500, ms, 0));
    const hold = Number.isFinite(+a.hold) && +a.hold >= 0 ? Math.min(+a.hold, ms) : -1;
    const aim = [clampAim(a.x), clampAim(a.y)];
    const [x, y] = landing(G.seed, aim, ms, hold);
    return land(G, x, y, 'aim', now, aim.map(v => +v.toFixed(4)));
  }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'aim') {
    const s = G.seats[G.turn];
    if (s.bot && G.botAt < 0) { planDart(G, now); return true; } // went away mid-turn: a bot takes over
    if (!G.stageEnd || now < G.stageEnd) return false;
    if (s.bot && G.bot) return land(G, G.bot.x, G.bot.y, 'bot', now, G.bot.aim);
    // out of time: a hurried throw somewhere near the middle
    return land(G, gauss() * .32, gauss() * .32 + .2, 'late', now);
  }
  if (G.stage === 'fly') {
    if (now < G.stageEnd) return false;
    after(G, now);
    return true;
  }
  return false;
}

// A player who drops out keeps their seat; a bot throws for them.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.ph === 'play' && G.stage === 'aim' && G.turn === s) planDart(G, Date.now());
  return true;
}

// Watchers can take over a bot from the next leg.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  G.queue ||= [];
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return true;
}
function seatQueued(G) {
  while (G.queue?.length) {
    const i = G.seats.findIndex(s => !s.human);
    if (i < 0) break;
    const p = G.queue.shift();
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'darts', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, round: G.round, rounds: G.rounds, leg: G.leg,
    legsTo: Math.ceil(G.opts.legs / 2), start: G.opts.start, out: G.opts.out,
    left: G.stage === 'aim' && G.stageEnd && !G.seats[G.turn].bot ? Math.max(0, G.stageEnd - now) : -1, timer: G.opts.timer,
    dart: G.stage === 'aim' ? { n: G.dartN, seed: G.seed, ago: now - G.aimAt, k: G.darts.length } : null,
    darts: G.darts, turnFrom: G.turnFrom,
    last: G.last ? { ...G.last, ago: now - G.last.at0 } : null,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, rem: G.rem[i], legs: G.legs[i], st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Per-seat outcome: points are what each player scored (a bust scores nothing), and a win for the top place.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: G.st[i].scored, win: place === 0, place: place + 1 };
  });
}

// for tests
export const _land = land;

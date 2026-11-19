// Marble Rush: authoritative marble race. The server runs the physics and streams positions;
// clients only draw. Bets use pretend coins that stay with the table between races.
import { makeTrack, at, rng, spinAngle, trapOpen, R, DISH, GATE_S } from '../../public/games/marbles/track.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'marbles', name: 'Marble Rush', minPlayers: 1, maxPlayers: 8 };

const BOT_NAMES = ['Pebble', 'Gumdrop', 'Comet', 'Biscuit', 'Wobble', 'Zoomie', 'Button', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const START_COINS = 100, REFILL = 30, STAKES = [10, 25, 50];
const BET_MS = 20_000, COUNT_MS = 3200, GAP_MS = 4500, AFTER_FIRST_MS = 22_000, HEAT_MAX_MS = 100_000;
const DT = 1 / 60, FRAME_EVERY = 3, KEEP_FRAMES = 18;
const G_ACC = 16, ROLL = .714;
export const CHAOS = ['flip', 'turbo', 'quake', 'swap'];
const CHAOS_MS = { flip: 2000, turbo: 3000, quake: 2600, swap: 600 };

export function cleanOpts(o = {}) {
  return {
    mode: o.mode === 'knockout' ? 'knockout' : 'classic',
    chaos: o.chaos === 'off' ? 'off' : 'on',
    field: [4, 6, 8].includes(+o.field) ? +o.field : 6,
  };
}

const walletKey = seat => seat.wk;

export function create(players, optsIn = {}, prev = null) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, 8).map(p => ({ id: p.id, wk: 'h:' + p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < opts.field) seats.push({ id: null, wk: 'b:' + names[bi], name: names[bi], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const wallet = {};
  for (const s of seats) {
    const k = walletKey(s);
    let c = prev?.game === 'marbles' ? prev.wallet[k] : undefined;
    if (c === undefined) c = START_COINS;
    if (c < STAKES[0]) c = REFILL; // the house spots you a few coins
    wallet[k] = c;
  }
  const n = seats.length, now = Date.now();
  const G = {
    game: 'marbles', ph: 'play', stage: 'bet', gid: Math.random().toString(36).slice(2, 8), seats, opts, wallet,
    seed: Math.random() * 2 ** 31 | 0, track: null, rnd: null,
    m: seats.map(() => ({ s: 0, u: 0, vs: 0, vu: 0, st: 0, fallT: 0, sticky: 0, place: 0, fin: 0, out: 0, sab: false })),
    bets: seats.map(() => null), heat: 0, heats: opts.mode === 'knockout' ? n - 1 : 1,
    stageEnd: now + BET_MS, simT: 0, step: 0, wall: 0, frames: [], fi: 0, firstFin: 0, placed: 0,
    chaos: null, chaosAt: 0, botSab: seats.map(() => 0),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  G.rnd = rng(G.seed ^ 0x5bd1e995);
  newHeat(G);
  for (let i = 0; i < n; i++) if (seats[i].bot) botBet(G, i);
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 14) G.ev.shift(); }
const alive = G => G.m.map((_, i) => i).filter(i => !G.m[i].out);

// Line the remaining marbles up behind the gate on a fresh track.
function newHeat(G) {
  G.heat++;
  G.track = makeTrack((G.seed + G.heat * 7919) | 0, G.opts.mode === 'knockout');
  const order = alive(G).sort(() => G.rnd() - .5);
  order.forEach((i, k) => {
    const row = k / 4 | 0, col = k % 4, m = G.m[i];
    Object.assign(m, { s: GATE_S - R - .05 - row * 1.05, u: (col - 1.5) * 1.05 + (row % 2 ? .3 : 0), vs: 0, vu: 0, st: 0, fallT: 0, sticky: 0, place: 0, fin: 0, sab: false });
  });
  G.simT = 0; G.step = 0; G.frames = []; G.firstFin = 0; G.placed = 0; G.chaos = null;
  G.chaosAt = 6 + G.rnd() * 5;
  G.botSab = G.seats.map(() => 5 + G.rnd() * 14);
  frame(G);
}

function frame(G) {
  const d = [];
  for (const m of G.m) d.push(Math.round(m.s * 100), Math.round(m.u * 100), m.out ? 3 : m.st);
  G.frames.push({ i: G.fi++, t: Math.round(G.simT * 1000), d });
  if (G.frames.length > KEEP_FRAMES) G.frames.shift();
}

// ---------- physics ----------
function stepSim(G) {
  const T = G.track, t = G.simT, ms = G.m, ch = G.chaos?.k;
  const grav = ch === 'flip' ? -1 : 1;
  if (ch === 'quake' && G.step % 14 === 0) {
    for (const m of ms) if (!m.out && m.st === 0 && m.s < T.L) { m.vu += (G.rnd() - .5) * 9; m.vs += (G.rnd() - .3) * 3; }
  }
  for (const m of ms) {
    if (m.out) continue;
    if (m.st === 1) { // fell through a trapdoor: pop back out a little earlier on the track
      if (t >= m.fallT) { m.st = 0; m.s = m.back; m.u = 0; m.vs = 4; m.vu = 0; }
      continue;
    }
    const sl = at(T.sl, m.s), k = at(T.k, m.s), past = m.s > T.L;
    let acc = G_ACC * ROLL * sl * (past ? 1 : grav) - Math.sign(m.vs) * .18 - .0095 * m.vs * Math.abs(m.vs) * (m.sticky > t ? 5 : 1);
    if (m.sticky > t) acc -= m.vs * 2.2;
    if (ch === 'turbo' && !past) acc += 4.5;
    for (const b of T.boosts) if (m.s > b.s0 && m.s < b.s1) acc += 13;
    if (past) acc -= m.vs * 1.6;
    m.vs += acc * DT;
    m.vu += (-k * m.vs * m.vs - 2 * DISH * G_ACC * ROLL * m.u - 1.1 * m.vu) * DT;
    m.vs = Math.max(-9, Math.min(17, m.vs)); m.vu = Math.max(-9, Math.min(9, m.vu));
    m.s += m.vs * DT; m.u += m.vu * DT;
    // pins: bouncy round posts
    for (const p of T.pins) {
      const ds = m.s - p.s; if (ds > 1 || ds < -1) continue;
      const du = m.u - p.u, d = Math.hypot(ds, du), min = R + p.r;
      if (d >= min || d === 0) continue;
      const ns = ds / d, nu = du / d, vn = m.vs * ns + m.vu * nu;
      m.s = p.s + ns * min; m.u = p.u + nu * min;
      if (vn < 0) { m.vs -= 1.35 * vn * ns; m.vu -= 1.35 * vn * nu; }
      m.vu += (G.rnd() - .5) * .6;
    }
    // spinners: a bar that sweeps marbles along
    for (const sp of T.spinners) {
      if (Math.abs(m.s - sp.s) > sp.hl + 1) continue;
      const a = spinAngle(sp, t), cs = Math.cos(a), sn = Math.sin(a);
      const rs = m.s - sp.s, ru = m.u - sp.u;
      const along = Math.max(-sp.hl, Math.min(sp.hl, rs * cs + ru * sn));
      const cx = along * cs, cu = along * sn, ds = rs - cx, du = ru - cu, d = Math.hypot(ds, du), min = R + .16;
      if (d >= min || d === 0) continue;
      const ns = ds / d, nu = du / d;
      m.s = sp.s + cx + ns * min; m.u = sp.u + cu + nu * min;
      const bs = -sp.w * cu, bu = sp.w * cx; // bar velocity where it touches
      const vn = (m.vs - bs) * ns + (m.vu - bu) * nu;
      if (vn < 0) { m.vs -= 1.6 * vn * ns; m.vu -= 1.6 * vn * nu; }
    }
    // trapdoors
    for (const tr of T.traps) {
      if (m.s > tr.s0 && m.s < tr.s1 && m.u > tr.u0 && m.u < tr.u1 && trapOpen(tr, t)) {
        m.st = 1; m.fallT = t + 1.1; m.back = tr.back; m.vs = 0; m.vu = 0;
        pushEv(G, { t: 'fall', m: ms.indexOf(m) });
      }
    }
    // walls and ends
    const half = at(T.w, m.s) / 2 - R;
    if (m.u > half) { m.u = half; if (m.vu > 0) m.vu *= -.45; m.vs *= .998; }
    else if (m.u < -half) { m.u = -half; if (m.vu < 0) m.vu *= -.45; m.vs *= .998; }
    if (m.s < R + .3) { m.s = R + .3; if (m.vs < 0) m.vs *= -.3; }
    if (m.s > T.end - R) { m.s = T.end - R; if (m.vs > 0) m.vs *= -.3; }
  }
  // marble against marble
  for (let i = 0; i < ms.length; i++) {
    const a = ms[i]; if (a.out || a.st === 1) continue;
    for (let j = i + 1; j < ms.length; j++) {
      const b = ms[j]; if (b.out || b.st === 1) continue;
      const ds = b.s - a.s; if (ds > 2 * R || ds < -2 * R) continue;
      const du = b.u - a.u, d = Math.hypot(ds, du);
      if (d >= 2 * R || d === 0) continue;
      const ns = ds / d, nu = du / d, push = (2 * R - d) / 2;
      a.s -= ns * push; a.u -= nu * push; b.s += ns * push; b.u += nu * push;
      const vn = (b.vs - a.vs) * ns + (b.vu - a.vu) * nu;
      if (vn < 0) { const j2 = -.9 * vn; a.vs -= j2 * ns; a.vu -= j2 * nu; b.vs += j2 * ns; b.vu += j2 * nu; }
    }
  }
  // finish line
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    if (!m.out && !m.place && m.s >= T.L) {
      m.place = ++G.placed; m.fin = t; m.st = 2;
      if (!G.firstFin) G.firstFin = t;
      pushEv(G, { t: 'fin', m: i, place: m.place });
    }
  }
  G.simT += DT; G.step++;
  if (G.step % FRAME_EVERY === 0) frame(G);
}

function startChaos(G) {
  const racing = alive(G).filter(i => !G.m[i].place && G.m[i].st === 0);
  let k = CHAOS[G.rnd() * CHAOS.length | 0];
  if (k === 'swap' && racing.length < 2) k = 'turbo';
  G.chaos = { k, until: G.simT + CHAOS_MS[k] / 1000 };
  const e = { t: 'chaos', k };
  if (k === 'swap') { // the leader trades places with someone further back
    racing.sort((a, b) => G.m[b].s - G.m[a].s);
    const a = racing[0], b = racing[1 + (G.rnd() * (racing.length - 1) | 0)];
    const A = G.m[a], B = G.m[b];
    for (const f of ['s', 'u', 'vs', 'vu']) [A[f], B[f]] = [B[f], A[f]];
    e.a = a; e.b = b;
  }
  pushEv(G, e);
}

function sabotage(G, s, target) {
  const me = G.m[s], m = G.m[target];
  if (G.stage !== 'race' || !me || !m || me.sab || s === target) return false;
  if (m.out || m.place || m.st !== 0) return false;
  me.sab = true;
  m.vs *= .15; m.vu += (G.rnd() < .5 ? -1 : 1) * 4; m.sticky = G.simT + 1.6;
  pushEv(G, { t: 'sab', by: s, m: target });
  return true;
}

function botBet(G, s) {
  const coins = G.wallet[walletKey(G.seats[s])];
  const stake = STAKES.filter(x => x <= coins);
  if (!stake.length) return;
  // bots mostly back themselves, like everyone does
  const pickM = Math.random() < .5 ? s : Math.random() * G.seats.length | 0;
  G.bets[s] = { m: pickM, amt: stake[Math.random() * stake.length | 0] };
}

// ---------- flow ----------
function ranking(G) { // racing order right now: finished first, then by distance
  return alive(G).sort((a, b) => {
    const A = G.m[a], B = G.m[b];
    if (A.place || B.place) return (A.place || 99) - (B.place || 99);
    return B.s - A.s;
  });
}

function endHeat(G) {
  const order = ranking(G);
  order.forEach((i, k) => { if (!G.m[i].place) G.m[i].place = k + 1; });
  G.chaos = null;
  if (G.opts.mode === 'knockout' && order.length > 2) {
    const loser = order.at(-1);
    G.m[loser].out = G.heat;
    pushEv(G, { t: 'out', m: loser, heat: G.heat });
    G.stage = 'gap'; G.stageEnd = Date.now() + GAP_MS;
    return;
  }
  if (G.opts.mode === 'knockout') G.m[order.at(-1)].out = G.heat;
  finish(G, order);
}

function finish(G, lastOrder) {
  // final standings: the last heat's order, then knocked-out marbles, latest first
  const outs = G.m.map((m, i) => i).filter(i => !lastOrder.includes(i)).sort((a, b) => G.m[b].out - G.m[a].out);
  const order = [...lastOrder, ...outs], w = order[0], n = G.seats.length;
  const pay = G.seats.map((seat, s) => {
    const b = G.bets[s], k = walletKey(seat);
    let won = 0, bonus = 0;
    if (b && b.m === w) won = b.amt * n;
    if (s === w) bonus = 20;
    G.wallet[k] += won + bonus;
    return { bet: b, won, bonus, net: won + bonus - (b ? b.amt : 0), coins: G.wallet[k] };
  });
  G.ph = 'end'; G.stage = 'end'; G.win = w; G.endAt = Date.now();
  G.res = { order, pay, mult: n };
  pushEv(G, { t: 'end', w });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human) return false;
  if (a.t === 'bet') {
    if (G.stage !== 'bet') return false;
    const m = +a.m, coins = G.wallet[walletKey(G.seats[s])];
    if (!Number.isInteger(m) || !G.seats[m]) return false;
    const amt = Math.min(coins, a.amt === 'all' ? coins : STAKES.includes(+a.amt) ? +a.amt : 0);
    if (amt <= 0) return false;
    G.bets[s] = { m, amt };
    return true;
  }
  if (a.t === 'nobet') { if (G.stage !== 'bet' || !G.bets[s]) return false; G.bets[s] = null; return true; }
  if (a.t === 'ready') { // host can close betting early
    if (G.stage !== 'bet') return false;
    G.stageEnd = Math.min(G.stageEnd, Date.now()); return true;
  }
  if (a.t === 'sab') return sabotage(G, s, +a.m);
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'bet') {
    const humans = G.seats.map((x, i) => i).filter(i => G.seats[i].human && !G.seats[i].bot);
    const allIn = humans.length && humans.every(i => G.bets[i]) && G.stageEnd - now > 3000;
    if (allIn) G.stageEnd = now + 3000;
    if (now < G.stageEnd) return false;
    for (let s = 0; s < G.seats.length; s++) { // stakes leave the wallet when betting closes
      const b = G.bets[s]; if (!b) continue;
      const k = walletKey(G.seats[s]);
      b.amt = Math.min(b.amt, G.wallet[k]); G.wallet[k] -= b.amt;
      if (b.amt <= 0) G.bets[s] = null;
    }
    G.stage = 'count'; G.stageEnd = now + COUNT_MS;
    pushEv(G, { t: 'count' });
    return true;
  }
  if (G.stage === 'count') {
    if (now < G.stageEnd) return false;
    G.stage = 'race'; G.wall = now;
    for (const m of G.m) if (!m.out) m.vs = 2.5 + G.rnd() * 1.5; // the gate flicks everyone off the line
    pushEv(G, { t: 'go', heat: G.heat });
    return true;
  }
  if (G.stage === 'gap') {
    if (now < G.stageEnd) return false;
    newHeat(G);
    G.stage = 'count'; G.stageEnd = now + COUNT_MS;
    pushEv(G, { t: 'count' });
    return true;
  }
  // race: run the simulation up to the present (slowing down rather than skipping if we fall behind)
  const want = Math.min(G.step + 45, Math.floor((now - G.wall) / 1000 / DT));
  while (G.step < want && G.stage === 'race') {
    if (G.chaos && G.simT >= G.chaos.until) G.chaos = null;
    if (G.opts.chaos === 'on' && !G.chaos && G.simT >= G.chaosAt && !G.firstFin) {
      startChaos(G); G.chaosAt = G.simT + 7 + G.rnd() * 6;
    }
    for (let s = 0; s < G.seats.length; s++) { // bots (and away players) throw their banana at the leader
      if (!G.seats[s].bot || G.m[s].sab || G.m[s].out || G.simT < G.botSab[s]) continue;
      const lead = ranking(G).find(i => i !== s && !G.m[i].place && G.m[i].st === 0);
      if (lead === undefined || !sabotage(G, s, lead)) G.botSab[s] = G.simT + 3;
    }
    stepSim(G);
    const left = alive(G).filter(i => !G.m[i].place);
    if (!left.length || (G.firstFin && G.simT - G.firstFin > AFTER_FIRST_MS / 1000) || G.simT > HEAT_MAX_MS / 1000) endHeat(G);
  }
  G.wall = Math.max(G.wall, now - (G.step + 45) * DT * 1000);
  return true;
}

// A player who drops out keeps their marble; a bot just presses their buttons.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  return true;
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'marbles', ph: G.ph, stage: G.stage, gid: G.gid, me: s, mode: G.opts.mode, chaosOn: G.opts.chaos === 'on',
    seed: G.track.seed, short: G.track.short, heat: G.heat, heats: G.heats,
    left: Math.max(0, G.stageEnd - now), simT: Math.round(G.simT * 1000), win: G.win,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      coins: G.wallet[walletKey(x)], bet: G.bets[i], out: G.m[i].out, place: G.m[i].place, sab: G.m[i].sab,
    })),
    chaos: G.chaos ? { k: G.chaos.k, left: Math.max(0, Math.round((G.chaos.until - G.simT) * 1000)) } : null,
    frames: G.stage === 'race' ? G.frames : G.frames.slice(-1),
    res: G.res, ev: G.ev, mult: G.seats.length,
  };
}

// Per-seat outcome of a finished race: place points (10 per marble beaten) plus 15 for a winning bet.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + (G.res.pay[i].won > 0 ? 15 : 0), win: place === 0, place: place + 1, coins: G.res.pay[i].coins };
  });
}

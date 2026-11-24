// Bierki: pick-up sticks. On your turn you take sticks out of the pile one at a time; when any other stick moves,
// your turn ends and the stick you were holding is out of play. The shared check (public/games/bierki/rules.js)
// decides every pull here: the browser sends the path of its drag in whole millimetres, the server walks the same
// path and fills the same "steady hands" meter. Nothing is hidden, so view() is the same for every seat.
import { MM, FULL, REACH, LIFT_MAX, LEN, SET_BONUS, makePile, startPull, advance, isClear, resettle, dropsWithout, plans } from '../../public/games/bierki/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'bierki', name: 'Bierki', minPlayers: 1, maxPlayers: 6 };

const BOT_NAMES = ['Ola', 'Patyk', 'Zosia', 'Twig', 'Splinter', 'Franek', 'Hania', 'Kijek'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const FAST = Math.max(1, +process.env.BIERKI_FAST || 1); // tests run the table faster
const AFTER_FAIL = 1700 / FAST, AFTER_TAKE = 500 / FAST, NEXT_PILE = 4200 / FAST, SLOW_MS = 10_000;
// Bots. wob: how far the hand strays sideways while pulling; risk: the highest planned meter they still go for;
// pick: how many of the safest sticks they choose among; v: how fast they pull (the meter punishes speed).
export const BOTS = {
  chill: { wob: .2, risk: 70, pick: 5, v: 1.7 },
  sharp: { wob: .06, risk: 55, pick: 3, v: 1.2 },
};
const rnd = (a, b) => a + Math.random() * (b - a);

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4, 5, 6].includes(+o.seats) ? +o.seats : 2,
    piles: +o.piles === 3 ? 3 : 1,
    hints: o.hints === 'off' ? 'off' : 'on',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 20, 30, 45].includes(+o.timer) ? +o.timer : 30,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)).sort(() => Math.random() - .5), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(2, opts.seats)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length;
  const G = {
    game: 'bierki', ph: 'play', stage: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    big: n > 4, pileN: 0, pv: 0, pile: [], first: Math.random() * n | 0, turn: -1, pull: null, pullN: 0, bot: null,
    busy: 0, tEnd: 0, botAt: 0, stageEnd: 0, lite: 0, carry: {}, lift: 0,
    st: seats.map(() => ({ pts: 0, got: [], hook: false, set: 0, pulls: 0, fails: 0, late: 0 })), slow: seats.map(() => false),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  newPile(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }

function newPile(G, now) {
  G.pileN++; G.stage = 'play'; G.pv++; G.pull = null; G.bot = null;
  G.pile = makePile(Math.random() * 2 ** 31 | 0, G.big);
  for (const st of G.st) st.hook = false; // the Hook belongs to a pile
  G.turn = (G.first + G.pileN - 1) % G.seats.length; G.carry = {}; G.lift = 0;
  pushEv(G, { t: 'start', pile: G.pileN, s: G.turn });
  openTurn(G, now + 1500 / FAST);
}
function openTurn(G, from) {
  const s = G.turn, t = G.opts.timer;
  G.busy = from; G.pull = null; G.bot = null;
  G.tEnd = t && !G.seats[s].bot ? from + (G.slow[s] ? Math.min(SLOW_MS, t * 1000) : t * 1000) : 0;
  G.botAt = from + rnd(900, 1700) / FAST;
}
const left = G => G.pile.reduce((a, s) => a + (s.g ? 0 : 1), 0);
function pass(G, now, wait) {
  if (!left(G)) return endPile(G, now);
  G.turn = (G.turn + 1) % G.seats.length; G.carry = {}; G.lift = 0;
  openTurn(G, now + wait);
}
function endPile(G, now) {
  G.turn = -1; G.tEnd = 0; G.pull = null; G.bot = null;
  if (G.pileN >= G.opts.piles) {
    const pts = G.st.map(x => x.pts), top = Math.max(...pts);
    G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = pts.indexOf(top);
    G.res = { pts, piles: G.pileN };
    pushEv(G, { t: 'end' });
    return;
  }
  G.stage = 'next'; G.stageEnd = now + NEXT_PILE;
  pushEv(G, { t: 'pile', pile: G.pileN });
}

// Another stick moved: the held stick is out of play, sticks that lost their support drop, and the turn passes.
function fail(G, now, why) {
  const s = G.turn, P = G.pull, stick = P.st.s;
  const shook = Object.keys(P.st.shake).map(Number);
  stick.g = 2; G.pv++; G.pull = null; G.bot = null;
  const moved = resettle(G.pile);
  G.st[s].fails++;
  pushEv(G, { t: 'fail', s, id: stick.id, why, shook: [...new Set([...shook, ...moved.map(m => m.id)])] });
  pass(G, now, AFTER_FAIL);
}
// Let go of the held stick. Out of the pile it is yours (unless a stick that lay on it drops); inside it goes back.
function drop(G, now) {
  const s = G.turn, P = G.pull, stick = P.st.s;
  if (!isClear(G.pile, P.st)) { G.carry[stick.id] = P.st.meter; G.pull = null; G.bot = null; return; } // what it already rubbed stays on the meter this turn
  if (dropsWithout(G.pile, stick).length) return fail(G, now, 'drop');
  const me = G.st[s];
  stick.g = 1; stick.by = s; G.pv++; G.pull = null; G.bot = null;
  me.pts += stick.pts; me.got.push(stick.id); me.pulls++;
  if (stick.k === 'hook') me.hook = true;
  let set = false;
  if (stick.k === 'pet' && G.pile.filter(x => x.k === 'pet' && x.g === 1 && x.by === s).length === 4) { set = true; me.pts += SET_BONUS; me.set++; }
  G.slow[s] = false;
  pushEv(G, { t: 'take', s, id: stick.id, pts: stick.pts, set });
  if (!left(G)) return endPile(G, now);
  openTurn(G, now + AFTER_TAKE);
}
function pick(G, s, id, now) {
  const stick = G.pile[id];
  if (!stick || stick.g) return false;
  if (G.pull) G.carry[G.pull.id] = G.pull.st.meter;
  G.pull = { id, by: s, n: ++G.pullN, at: now, used: 0, st: startPull(G.pile, stick, G.carry[id] || 0) };
  return true;
}
// May this seat lift the held stick? Only with the Hook, and only one stick a turn.
const canLift = (G, s) => G.st[s].hook && (!G.lift || G.lift === G.pull.n);
// One point of a drag: where the stick is now, in millimetres, and how many milliseconds the move took. A browser
// cannot claim more time than has really passed since it picked the stick up, so it cannot pretend to pull slowly.
function dragTo(G, s, p, now) {
  const P = G.pull;
  if (!Array.isArray(p) || p.length !== 4) return false;
  const [x, y, z, ms] = p.map(v => Math.round(+v));
  if (![x, y, z, ms].every(Number.isFinite) || Math.abs(x) > REACH * MM || Math.abs(z) > REACH * MM || y < 0 || y > LIFT_MAX * MM || ms < 1 || ms > 5000) return false;
  if (y > 0) { if (!canLift(G, s)) return false; G.lift = P.n; }
  if (P.used + ms > now - P.at + 400) return false;
  P.used += ms;
  advance(G.pile, P.st, { x: x / MM, y: y / MM, z: z / MM }, ms);
  if (P.st.meter >= FULL) { fail(G, now, 'bump'); return false; }
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  const now = Date.now();
  if (a.t === 'sync') return true; // a browser that missed the pile asks for a full picture
  if (G.stage !== 'play' || G.turn !== s || now < G.busy) return false;
  if (a.t === 'pick') return pick(G, s, a.id | 0, now);
  if (!G.pull) return false;
  if (a.t === 'drag') {
    if (!Array.isArray(a.p) || a.p.length > 16) return false;
    for (const p of a.p) if (!dragTo(G, s, p, now)) break;
    if (G.pull) G.lite = now; // only the held stick changed: a short update is enough
    return true;
  }
  if (a.t === 'drop') { drop(G, now); return true; }
  return false;
}

// ---------- bots ----------
// The stick a bot goes for and the way it pulls it. With nothing safe left it still has to try something.
function botPlan(G, s, K) {
  const hook = G.st[s].hook && !G.lift, all = [];
  for (const stick of G.pile) if (!stick.g) { const p = plans(G.pile, stick, hook)[0]; all.push({ stick, p }); }
  all.sort((a, b) => a.p.m - b.p.m || b.stick.pts - a.stick.pts);
  const safe = all.filter(c => c.p.m <= K.risk).sort((a, b) => b.stick.pts - a.stick.pts).slice(0, K.pick);
  return safe.length ? safe[Math.random() * safe.length | 0] : all[0];
}
function botStart(G, s, now, K) {
  const c = botPlan(G, s, K); if (!c) return false;
  pick(G, s, c.stick.id, now);
  G.bot = { ...c.p, wob: K.wob * (.4 + Math.random() * .6), ph: Math.random() * 6.28, t0: now + 450 / FAST, last: now + 450 / FAST, v: K.v * rnd(.8, 1.25) * FAST };
  if (c.p.y) G.lift = G.pull.n;
  return true;
}
// Move the bot's held stick along its path. Its hand wanders a little to the side, which is how bots fail.
function botStep(G, now) {
  const B = G.bot, P = G.pull, s = P.st.s;
  if (now < B.t0) return false;
  const k = Math.min(1, (now - B.t0) / 1000 * B.v / B.dist), d = B.dist * k, side = B.y ? 0 : Math.sin(k * 9 + B.ph) * B.wob * Math.sin(k * Math.PI);
  const q = v => Math.round(v * MM) / MM, ms = Math.max(1, now - B.last) * FAST; B.last = now;
  advance(G.pile, P.st, { x: q(B.x * d - s.dz * side), y: q(B.y * d), z: q(B.z * d + s.dx * side) }, ms);
  if (P.st.meter >= FULL) { fail(G, now, 'bump'); return true; }
  if (k > .25 && isClear(G.pile, P.st)) { drop(G, now); return true; }
  if (k >= 1) {
    // a wobble can leave the stick short of free: carry it straight on until it is
    for (let i = 0; i < 6 && !isClear(G.pile, P.st) && P.st.meter < FULL; i++) advance(G.pile, P.st, { x: q(P.st.off.x + B.x * .3), y: q(P.st.off.y + B.y * .3), z: q(P.st.off.z + B.z * .3) }, 400);
    if (P.st.meter >= FULL || !isClear(G.pile, P.st)) fail(G, now, 'bump'); else drop(G, now);
    return true;
  }
  G.lite = now;
  return true;
}
export { botPlan as _botPlan, drop as _drop, fail as _fail };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'next') { if (now < G.stageEnd) return false; newPile(G, now); return true; }
  const s = G.turn; if (s < 0 || now < G.busy) return false;
  if (G.seats[s].bot) {
    if (G.bot || now < G.botAt) return false;
    if (G.pull) { G.pull = null; } // a stick the player left hanging when they went away
    return botStart(G, s, now, BOTS[G.opts.bots]);
  }
  if (G.tEnd && now >= G.tEnd) { // out of time: the stick goes back and the turn passes; the next turns are short
    G.slow[s] = true; G.st[s].late++;
    pushEv(G, { t: 'late', s });
    pass(G, now, 400 / FAST);
    return true;
  }
  return false;
}
// Bots pull in real time, twenty steps a second.
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play' || G.stage !== 'play' || !G.bot || !G.pull || now < G.busy) return false;
  return botStep(G, now);
}

// A player who drops out is played by a bot until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  const now = Date.now();
  if (G.turn === s && G.stage === 'play') {
    if (!away && G.bot) { G.bot = null; G.pull = null; }
    G.botAt = Math.max(G.busy, now) + 1200 / FAST;
    G.tEnd = away || !G.opts.timer ? 0 : Math.max(G.busy, now) + G.opts.timer * 1000;
  }
  return true;
}

export function view(G, s) {
  const now = Date.now(), P = G.pull, lite = G.lite && now - G.lite < 3;
  const out = {
    game: 'bierki', ph: G.ph, stage: G.stage, gid: G.gid, me: s, pileN: G.pileN, piles: G.opts.piles, timer: G.opts.timer, hints: G.opts.hints === 'on',
    turn: G.stage === 'play' ? G.turn : -1, pv: G.pv, left: left(G), lift: G.turn >= 0 && G.st[G.turn].hook && (!G.lift || (!!P && G.lift === P.n)), carry: G.carry,
    tin: Math.max(0, G.busy - now), tLeft: G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    nextLeft: G.stage === 'next' ? Math.max(0, G.stageEnd - now) : 0,
    pull: P ? { n: P.n, id: P.id, by: P.by, off: [Math.round(P.st.off.x * MM), Math.round(P.st.off.y * MM), Math.round(P.st.off.z * MM)], m: Math.min(FULL, Math.round(P.st.meter)), shake: Object.keys(P.st.shake).map(Number) } : null,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
  if (!lite) out.pile = G.pile;
  return out;
}

// Points decide the places. Someone who never got a stick out and let the clock run every time earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const top = Math.max(...G.res.pts);
  return G.seats.map((x, i) => ({ pts: G.res.pts[i], win: G.res.pts[i] === top, idle: x.human && !G.st[i].pulls && !G.st[i].fails && G.st[i].late > 0 }));
}

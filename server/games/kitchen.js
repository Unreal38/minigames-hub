// Cozy Kitchen Rush: everyone cooks together in one kitchen against the clock. Real time: each player's screen
// moves its own avatar and sends where it is; the server owns every counter, pot, pan and order, checks each
// grab is in reach, cooks the food, runs the bots and sends the whole kitchen out on every tick.
import { kitchen, CRATES, CHOPPABLE, SOUPS, RECIPES, T, SPEED, REACH, move, pushOut, isFloor, inReach, token, fits, matches, goals } from '../../public/games/kitchen/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'kitchen', name: 'Cozy Kitchen Rush', minPlayers: 1, maxPlayers: 4, joinAt: 'now' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8'];
// bot feel: walking speed, pause before each grab, pause between jobs
const BOTS = { chill: { speed: 2.2, hand: .6, think: 1.6 }, sharp: { speed: 3.4, hand: .2, think: .35 } };

export function cleanOpts(o = {}) {
  return {
    seats: [1, 2, 3, 4].includes(+o.seats) ? +o.seats : 3,
    time: [120, 180, 240].includes(+o.time) ? +o.time : 180,
    map: ['diner', 'split'].includes(o.map) ? o.map : 'diner',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
  };
}

const keyOf = (c, r) => c + ',' + r;
const uniq = a => [...new Set(a)];

const TEST_TIME = +(globalThis.process?.env?.KR_TEST_TIME || 0); // tests run short shifts over the real server

export function create(players, optsIn = {}, _prev, now = Date.now()) {
  const opts = cleanOpts(optsIn);
  if (TEST_TIME) opts.time = TEST_TIME;
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const K = kitchen(opts.map);
  const cells = {};
  for (const x of K.cells) cells[x.key] = { k: x.k, c: x.c, r: x.r, item: null, pot: x.k === 'S' ? { n: 0, kind: null, cook: 0, by: [] } : null };
  // everyone starts on the floor near the middle, spread out
  const floor = [];
  for (let r = 0; r < K.rows; r++) for (let c = 0; c < K.cols; c++) if (isFloor(K, c, r)) floor.push([c, r]);
  const mid = [K.cols / 2, K.rows / 2];
  floor.sort((a, b) => Math.hypot(a[0] + .5 - mid[0], a[1] + .5 - mid[1]) - Math.hypot(b[0] + .5 - mid[0], b[1] + .5 - mid[1]));
  const spots = [];
  for (const f of floor) if (spots.every(s => Math.hypot(s[0] - f[0], s[1] - f[1]) >= 2)) spots.push(f);
  const G = {
    game: 'kitchen', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts, map: K.id,
    cells, start: now + T.count * 1000, end: now + (T.count + opts.time) * 1000, last: now,
    pl: seats.map((_, i) => { const [c, r] = spots[i % spots.length]; return { x: c + .5, z: r + .5, f: Math.PI, hold: null, chop: null, mvAt: now, fix: 0, walk: 0, brain: null }; }),
    orders: [], orderN: 0, nextOrder: now + T.count * 1000 + 1500, tips: 0, served: 0, missed: 0,
    goals: goals(opts.time, seats.length),
    pts: seats.map(() => 0), st: seats.map(() => ({ served: 0, chopped: 0, dishes: 0 })),
    ev: [], evN: 0, res: null, win: -1, endAt: 0, itemN: 0,
  };
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const newItem = (G, k, s) => ({ id: ++G.itemN, k, ch: 0, cp: 0, ck: 0, has: [], soup: null, by: s >= 0 ? [s] : [] });
const touch = (it, s) => { if (s >= 0 && !it.by.includes(s)) it.by.push(s); };

// ---------- orders ----------
function orderEvery(G) { return Math.max(9, 20 - 2.5 * (G.seats.length - 1)) * 1000; }
function maxOrders(G) { return Math.min(5, 2 + G.seats.length); }
function spawnOrder(G, now) {
  const el = (now - G.start) / 1000, pool = [];
  for (const [k, r] of Object.entries(RECIPES)) if (!(r.after > el)) for (let i = 0; i < r.w; i++) pool.push(k);
  // no three of the same in a row
  let r = pool[Math.random() * pool.length | 0];
  const last = G.orders.slice(-2).map(o => o.r);
  if (last.length === 2 && last.every(x => x === r)) r = pool.find(x => x !== r) || r;
  const life = RECIPES[r].life * (G.seats.length === 1 ? 1.25 : 1) * 1000;
  const o = { id: ++G.orderN, r, at: now, life };
  G.orders.push(o);
  pushEv(G, { t: 'order', r, id: o.id });
}

// ---------- using a counter ----------
// What happens when seat s uses the counter at key. Returns what happened ('take', 'put', 'add', 'serve'...) or false.
export function use(G, s, key, now = Date.now()) {
  const cell = G.cells[key], p = G.pl[s];
  if (!cell || !p) return false;
  const h = p.hold, k = cell.k;
  p.chop = null;
  if (CRATES[k]) {
    if (!h) { p.hold = newItem(G, CRATES[k], s); return 'take'; }
    if (h.k === CRATES[k] && !h.ch && !h.ck) { p.hold = null; return 'back'; }
    return false;
  }
  if (k === 'D') {
    if (!h) { p.hold = newItem(G, 'plate', s); return 'take'; }
    if (h.k === 'plate' && !h.has.length && !h.soup) { p.hold = null; return 'back'; }
    // holding food that fits on a plate: take a plate with it on
    const tk = token(h);
    if (tk && fits({ has: [], soup: null }, tk)) { const pl = newItem(G, 'plate', s); pl.has = [tk]; pl.by = uniq([...h.by, s]); p.hold = pl; return 'add'; }
    return false;
  }
  if (k === 'X') {
    if (!h) return false;
    if (h.k === 'plate') { if (!h.has.length && !h.soup) return false; h.has = []; h.soup = null; h.by = [s]; }
    else p.hold = null;
    pushEv(G, { t: 'bin', s });
    return 'bin';
  }
  if (k === 'W') {
    if (!h || h.k !== 'plate') return false;
    const o = G.orders.filter(o => matches(h, o.r)).sort((a, b) => a.at - b.at)[0];
    if (!o) { pushEv(G, { t: 'wrong', s }); return false; }
    serve(G, s, o, h, now);
    p.hold = null;
    return 'serve';
  }
  if (k === 'S') {
    const pot = cell.pot;
    if (!h) {
      if (pot.cook >= T.soupBurn) { Object.assign(pot, { n: 0, kind: null, cook: 0, by: [] }); pushEv(G, { t: 'bin', s }); return 'dump'; }
      return false;
    }
    if (h.k === 'plate') {
      if (pot.n < 3 || pot.cook < 1 || h.has.length || h.soup) return false;
      h.soup = pot.cook >= T.soupBurn ? 'burnt' : pot.kind; h.by = uniq([...h.by, ...pot.by, s]);
      Object.assign(pot, { n: 0, kind: null, cook: 0, by: [] });
      return 'add';
    }
    if (SOUPS.has(h.k) && h.ch && pot.n < 3 && (!pot.n || pot.kind === h.k)) {
      pot.n++; pot.kind = h.k; pot.by = uniq([...pot.by, ...h.by, s]); p.hold = null;
      return 'pot';
    }
    return false;
  }
  if (k === 'F') {
    const it = cell.item;
    if (!h) { if (!it) return false; p.hold = it; cell.item = null; touch(it, s); return 'take'; }
    if (h.k === 'patty' && !it) { cell.item = h; touch(h, s); p.hold = null; return 'put'; }
    if (h.k === 'plate' && it && fits(h, token(it))) { h.has.push(token(it)); h.by = uniq([...h.by, ...it.by, s]); cell.item = null; return 'add'; }
    return false;
  }
  // a counter or a chopping board
  const it = cell.item;
  if (!h) { if (!it) return false; p.hold = it; cell.item = null; touch(it, s); return 'take'; }
  if (!it) { cell.item = h; touch(h, s); p.hold = null; return 'put'; }
  if (h.k === 'plate' && it.k !== 'plate' && fits(h, token(it))) { h.has.push(token(it)); h.by = uniq([...h.by, ...it.by, s]); cell.item = null; return 'add'; }
  if (it.k === 'plate' && h.k !== 'plate' && fits(it, token(h))) { it.has.push(token(h)); it.by = uniq([...it.by, ...h.by, s]); p.hold = null; return 'add'; }
  return false;
}

function serve(G, s, o, plate, now) {
  const r = RECIPES[o.r], left = Math.max(0, 1 - (now - o.at) / o.life);
  const tip = Math.round(r.tip * (1 + .5 * left));
  G.tips += tip; G.served++;
  G.orders = G.orders.filter(x => x !== o);
  // the tip is shared by everyone who had a hand in the dish
  const by = uniq([...plate.by, s]).filter(i => i >= 0 && i < G.seats.length);
  const each = Math.floor(tip / by.length);
  for (const i of by) { G.pts[i] += each; G.st[i].dishes++; }
  G.pts[s] += tip - each * by.length;
  G.st[s].served++;
  pushEv(G, { t: 'serve', s, r: o.r, tip, id: o.id, by });
  if (G.orders.length < 2 && G.nextOrder - now > 3000) G.nextOrder = now + 2500; // keep the line moving
}

export function startChop(G, s, key) {
  const cell = G.cells[key], p = G.pl[s];
  if (!cell || cell.k !== 'C' || p.hold) return false;
  const it = cell.item;
  if (!it || !CHOPPABLE.has(it.k) || it.ch) return false;
  p.chop = key; touch(it, s);
  return true;
}

// ---------- the clock ----------
function cook(G, dt, now) {
  for (const cell of Object.values(G.cells)) {
    if (cell.k === 'S') {
      const pot = cell.pot;
      if (pot.n === 3 && pot.cook < T.soupBurn + .5) {
        const was = pot.cook; pot.cook += dt / T.soup;
        if (was < 1 && pot.cook >= 1) pushEv(G, { t: 'ready', key: keyOf(cell.c, cell.r) });
        if (was < T.soupBurn && pot.cook >= T.soupBurn) pushEv(G, { t: 'burn', key: keyOf(cell.c, cell.r) });
      }
    } else if (cell.k === 'F' && cell.item?.k === 'patty') {
      const it = cell.item, was = it.ck;
      if (it.ck < T.pattyBurn + .5) it.ck += dt / T.patty;
      if (was < 1 && it.ck >= 1) pushEv(G, { t: 'ready', key: keyOf(cell.c, cell.r) });
      if (was < T.pattyBurn && it.ck >= T.pattyBurn) pushEv(G, { t: 'burn', key: keyOf(cell.c, cell.r) });
    }
  }
  G.pl.forEach((p, s) => {
    if (!p.chop) return;
    const cell = G.cells[p.chop], it = cell?.item;
    if (!it || it.ch || p.hold || !inReach(p.x, p.z, cell.c, cell.r)) { p.chop = null; return; }
    it.cp += dt / T.chop;
    if (it.cp >= 1) { it.cp = 1; it.ch = 1; p.chop = null; G.st[s].chopped++; pushEv(G, { t: 'chopped', s, key: keyOf(cell.c, cell.r) }); }
  });
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const dt = Math.min(.5, Math.max(0, (now - G.last) / 1000)); G.last = now;
  if (G.stage === 'count') {
    if (now < G.start) return true;
    G.stage = 'cook'; pushEv(G, { t: 'go' });
  }
  if (now >= G.end) { finish(G, now); return true; }
  cook(G, dt, now);
  for (const o of [...G.orders]) if (now - o.at >= o.life) {
    G.orders = G.orders.filter(x => x !== o); G.missed++; G.tips = Math.max(0, G.tips - 10);
    pushEv(G, { t: 'miss', r: o.r, id: o.id });
  }
  if (now >= G.nextOrder && now < G.end - 20_000) {
    if (G.orders.length < maxOrders(G)) spawnOrder(G, now);
    G.nextOrder = now + orderEvery(G) * (.85 + Math.random() * .3);
  }
  G.seats.forEach((seat, s) => { if (seat.bot) think(G, s, dt, now); });
  return true;
}

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => G.pts[b] - G.pts[a] || G.st[b].served - G.st[a].served || G.st[b].chopped - G.st[a].chopped || a - b);
  G.win = order[0]; G.ph = 'end'; G.stage = 'end'; G.endAt = now;
  for (const p of G.pl) p.chop = null;
  const stars = G.goals.filter(g => G.tips >= g).length;
  G.res = { order, stars, tips: G.tips, served: G.served, missed: G.missed };
  pushEv(G, { t: 'end', w: G.win, stars });
}

// ---------- players ----------
function moveTo(G, s, a, now) {
  const p = G.pl[s];
  if (!Number.isFinite(+a.x) || !Number.isFinite(+a.z)) return;
  const K = kitchen(G.map), el = Math.max(.05, (now - p.mvAt) / 1000);
  let dx = +a.x - p.x, dz = +a.z - p.z;
  const d = Math.hypot(dx, dz), max = SPEED * el * 1.5 + .35;
  if (d > max) { dx *= max / d; dz *= max / d; p.fix++; }
  const [x, z] = move(K, p.x, p.z, dx, dz);
  if (Math.hypot(x - (p.x + dx), z - (p.z + dz)) > .35) p.fix++;
  p.x = x; p.z = z; p.mvAt = now;
  if (Number.isFinite(+a.f)) p.f = +a.f;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  const now = Date.now(), p = G.pl[s];
  if (G.seats[s].bot) return false;
  if (a.t === 'mv') { moveTo(G, s, a, now); return false; }
  if (G.stage !== 'cook') return false;
  if (a.t === 'use' || a.t === 'chop') {
    if (a.x !== undefined) moveTo(G, s, a, now);
    const c = a.c | 0, r = a.r | 0, key = keyOf(c, r);
    if (!G.cells[key] || !inReach(p.x, p.z, c, r)) return false;
    return a.t === 'use' ? !!use(G, s, key, now) : startChop(G, s, key);
  }
  return false;
}

// A player who drops out keeps their seat and whatever they hold; a bot cooks for them.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.pl[s].brain = null; G.pl[s].chop = null;
  return true;
}

// A watcher who asks for a seat takes over a bot straight away.
export function seatWatcher(G, p, on = true) {
  if (!p?.id || !on || G.ph !== 'play' || G.seats.some(x => x.id === p.id)) return false;
  const i = G.seats.findIndex(x => !x.human);
  if (i < 0) return false;
  Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
  G.pl[i].brain = null; G.pl[i].mvAt = Date.now();
  pushEv(G, { t: 'sit', s: i });
  return true;
}

// ---------- bots ----------
// A bot takes the oldest order nobody else is cooking and works through a short plan for it: fetch, chop,
// cook, plate, serve. When something it counted on is gone (a friend took the plate, the order timed out),
// it puts down what it holds and picks a new job.
const cellsOf = (G, k) => Object.values(G.cells).filter(c => c.k === k);
const dist = (p, cell) => Math.hypot(cell.c + .5 - p.x, cell.r + .5 - p.z);
function claimed(G, s, what) { return G.pl.some((p, i) => i !== s && G.seats[i].bot && p.brain?.claims?.includes(what)); }
function nearest(G, s, list) { const p = G.pl[s]; return list.sort((a, b) => dist(p, a) - dist(p, b))[0] || null; }
const ckey = c => keyOf(c.c, c.r);

function freeCounter(G, s, near) {
  const list = Object.values(G.cells).filter(c => c.k === '#' && !c.item && !claimed(G, s, ckey(c)) && reachable(G, s, c));
  if (near) { const n = G.cells[near]; return list.sort((a, b) => Math.hypot(a.c - n.c, a.r - n.r) - Math.hypot(b.c - n.c, b.r - n.r))[0] || null; }
  return nearest(G, s, list);
}
function reachable(G, s, cell) { return !!path(G, s, cell, true); }

function planFor(G, s, o) {
  const r = RECIPES[o.r], steps = [];
  const chopped = (kind, then) => steps.push(
    { a: 'use', find: () => nearest(G, s, cellsOf(G, Object.keys(CRATES).find(k => CRATES[k] === kind)).filter(c => reachable(G, s, c))), want: h => h?.k === kind },
    { a: 'use', find: () => nearest(G, s, cellsOf(G, 'C').filter(c => !c.item && !claimed(G, s, ckey(c)) && reachable(G, s, c))), save: 'board', want: h => !h },
    { a: 'chop', at: 'board' },
    { a: 'use', at: 'board', want: h => h?.k === kind && h.ch },
    then);
  if (r.soup) {
    const pot = nearest(G, s, cellsOf(G, 'S').filter(c => !c.pot.n && !claimed(G, s, ckey(c)) && reachable(G, s, c)));
    if (!pot) return null;
    const pk = ckey(pot);
    for (let i = 0; i < 3; i++) chopped(r.soup, { a: 'use', key: pk, want: h => !h });
    steps.push({ a: 'use', find: () => nearest(G, s, cellsOf(G, 'D').filter(c => reachable(G, s, c))), want: h => h?.k === 'plate' });
    steps.push({ a: 'wait', key: pk, until: () => G.cells[pk].pot.cook >= 1 });
    steps.push({ a: 'use', key: pk, want: h => h?.soup === r.soup });
    steps.push({ a: 'use', find: () => nearest(G, s, cellsOf(G, 'W').filter(c => reachable(G, s, c))), want: h => !h });
    return { order: o.id, recipe: o.r, steps, claims: [pk], mem: {} };
  }
  const claims = [], plateSteps = [
    { a: 'use', find: () => nearest(G, s, cellsOf(G, 'D').filter(c => reachable(G, s, c))), want: h => h?.k === 'plate' },
    { a: 'use', find: () => freeCounter(G, s, ckey(nearest(G, s, cellsOf(G, 'W')))), save: 'spot', want: h => !h },
  ];
  const onPlate = { a: 'use', at: 'spot', want: h => !h };
  let pan = null;
  if (r.has.includes('patty')) {
    pan = nearest(G, s, cellsOf(G, 'F').filter(c => !c.item && !claimed(G, s, ckey(c)) && reachable(G, s, c)));
    if (!pan) return null;
    claims.push(ckey(pan));
  }
  steps.push(...plateSteps);
  if (r.has.includes('bun')) {
    steps.push({ a: 'use', find: () => nearest(G, s, cellsOf(G, 'B').filter(c => reachable(G, s, c))), want: h => h?.k === 'bun' });
    steps.push(onPlate);
  }
  for (const v of ['lettuce', 'tomato']) if (r.has.includes(v)) chopped(v, onPlate);
  if (pan) { // the patty goes on last, so it is never left to burn while the bot does the rest
    const pk = ckey(pan);
    steps.push({ a: 'use', find: () => nearest(G, s, cellsOf(G, 'P').filter(c => reachable(G, s, c))), want: h => h?.k === 'patty' });
    steps.push({ a: 'use', key: pk, want: h => !h });
    steps.push({ a: 'wait', key: pk, until: () => G.cells[pk].item?.ck >= 1 });
    steps.push({ a: 'use', key: pk, want: h => h?.k === 'patty' && h.ck >= 1 });
    steps.push(onPlate);
  }
  steps.push({ a: 'use', at: 'spot', want: h => h?.k === 'plate' });
  steps.push({ a: 'use', find: () => nearest(G, s, cellsOf(G, 'W').filter(c => reachable(G, s, c))), want: h => !h });
  return { order: o.id, recipe: o.r, steps, claims, mem: {} };
}

// Odd jobs when no order needs a cook: serve a finished plate someone left out, clear burnt food.
function chores(G, s) {
  const steps = [];
  const done = Object.values(G.cells).find(c => c.item?.k === 'plate' && G.orders.some(o => matches(c.item, o.r)) && !claimed(G, s, ckey(c)) && reachable(G, s, c));
  if (done) {
    steps.push({ a: 'use', key: ckey(done), want: h => h?.k === 'plate' });
    steps.push({ a: 'use', find: () => nearest(G, s, cellsOf(G, 'W').filter(c => reachable(G, s, c))), want: h => !h });
    return { steps, claims: [ckey(done)], mem: {} };
  }
  const burnt = Object.values(G.cells).find(c => (c.k === 'F' && c.item?.ck >= T.pattyBurn) || (c.k === 'S' && c.pot.cook >= T.soupBurn));
  if (burnt && !claimed(G, s, ckey(burnt)) && reachable(G, s, burnt)) {
    if (burnt.k === 'S') return { steps: [{ a: 'use', key: ckey(burnt), want: h => !h }], claims: [ckey(burnt)], mem: {} };
    steps.push({ a: 'use', key: ckey(burnt), want: h => h?.k === 'patty' });
    steps.push({ a: 'use', find: () => nearest(G, s, cellsOf(G, 'X').filter(c => reachable(G, s, c))), want: h => !h });
    return { steps, claims: [ckey(burnt)], mem: {} };
  }
  return null;
}

// Get rid of whatever the bot is holding when a plan falls through.
function tidy(G, s) {
  const h = G.pl[s].hold; if (!h) return null;
  const junk = (h.k === 'patty' && h.ck >= T.pattyBurn) || h.soup === 'burnt';
  const to = junk ? nearest(G, s, cellsOf(G, 'X').filter(c => reachable(G, s, c))) : freeCounter(G, s);
  if (!to) return null;
  return { steps: [{ a: 'use', key: ckey(to), want: x => !x || (junk && x.k === 'plate') }], claims: [], mem: {}, tidy: true };
}

function newPlan(G, s) {
  const tidyUp = tidy(G, s); if (tidyUp) return tidyUp;
  const mine = new Set(G.pl.map((p, i) => i !== s && G.seats[i].bot ? p.brain?.plan?.order : null));
  const open = G.orders.filter(o => !mine.has(o.id)).sort((a, b) => a.at - b.at);
  for (const o of open) { const pl = planFor(G, s, o); if (pl) return pl; }
  return chores(G, s);
}

// Shortest walk over the floor to a tile next to the cell (4 neighbours). Returns a list of tile centres.
function path(G, s, cell, test = false) {
  const K = kitchen(G.map), p = G.pl[s], start = [Math.floor(p.x), Math.floor(p.z)];
  const goal = new Set([[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [cell.c + dc, cell.r + dr]).filter(([c, r]) => isFloor(K, c, r)).map(([c, r]) => keyOf(c, r)));
  if (!goal.size) return null;
  const prev = new Map([[keyOf(...start), null]]), q = [start];
  while (q.length) {
    const cur = q.shift(), ck = keyOf(...cur);
    if (goal.has(ck)) {
      if (test) return true;
      const out = []; let k = ck;
      while (k) { const [c, r] = k.split(',').map(Number); out.unshift([c + .5, r + .5]); k = prev.get(k); }
      return out;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [cur[0] + dc, cur[1] + dr], nk = keyOf(...n);
      if (!prev.has(nk) && isFloor(K, n[0], n[1])) { prev.set(nk, ck); q.push(n); }
    }
  }
  return null;
}

function think(G, s, dt, now) {
  const p = G.pl[s], cfg = BOTS[G.opts.bots] || BOTS.chill, K = kitchen(G.map);
  const b = p.brain ||= { plan: null, i: 0, wait: Math.random() * cfg.think, route: null, goal: null, stuck: 0, hand: 0 };
  p.walk = 0;
  if (G.stage !== 'cook') return;
  if (b.wait > 0) { b.wait -= dt; return; }
  if (!b.plan) {
    b.plan = newPlan(G, s); b.i = 0; b.route = null; b.goal = null; b.stuck = 0;
    if (!b.plan) { b.wait = cfg.think; wander(G, s, dt, cfg); return; }
    b.claims = b.plan.claims;
  }
  const plan = b.plan, st = plan.steps[b.i];
  if (!st) { b.plan = null; b.claims = []; b.wait = cfg.think * Math.random(); return; }
  const fail = () => { b.plan = null; b.claims = []; b.wait = cfg.think; b.route = null; p.chop = null; };
  if (plan.order && !G.orders.some(o => o.id === plan.order)) {
    // the order was served by someone else or ran out: carry on for another one of the same dish, or start over
    const mine = new Set(G.pl.map((x, i) => i !== s && G.seats[i].bot ? x.brain?.plan?.order : null));
    const again = G.orders.find(o => o.r === plan.recipe && !mine.has(o.id));
    if (again) plan.order = again.id; else return fail();
  }
  // which counter this step is about (looked up once per step)
  if (b.stepAt !== b.i) { b.stepAt = b.i; b.key = null; }
  let key = st.key || (st.at && plan.mem[st.at]) || b.key;
  if (!key && st.find) {
    const c = st.find();
    if (!c) { b.stuck += dt; if (b.stuck > 3) fail(); return; }
    key = b.key = ckey(c); if (st.save) { plan.mem[st.save] = key; b.claims = [...plan.claims, key]; }
  }
  const cell = G.cells[key]; if (!cell) return fail();
  // walk there
  if (!inReach(p.x, p.z, cell.c, cell.r)) {
    if (b.goal !== key || !b.route) { b.route = path(G, s, cell); b.goal = key; if (!b.route) return fail(); }
    let step = cfg.speed * dt;
    while (step > 0 && b.route.length) {
      const [tx, tz] = b.route[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d <= step) { [p.x, p.z] = pushOut(K, tx, tz); step -= d; b.route.shift(); }
      else { [p.x, p.z] = move(K, p.x, p.z, dx / d * step, dz / d * step); p.f = Math.atan2(dx, dz); step = 0; }
      p.walk = 1;
    }
    if (b.route.length || !inReach(p.x, p.z, cell.c, cell.r)) return;
    b.route = null; b.hand = cfg.hand * (.6 + Math.random() * .8);
  }
  p.f = Math.atan2(cell.c + .5 - p.x, cell.r + .5 - p.z);
  if (b.hand > 0) { b.hand -= dt; return; }
  if (st.a === 'wait') { if (st.until()) { b.i++; b.hand = cfg.hand; } else if (G.cells[key].k === 'S' && !G.cells[key].pot.n) fail(); else if (G.cells[key].k === 'F' && !G.cells[key].item) fail(); return; }
  if (st.a === 'chop') {
    const it = cell.item;
    if (it?.ch) { b.i++; b.hand = cfg.hand; return; }
    if (!p.chop && !startChop(G, s, key)) return fail();
    return;
  }
  const did = use(G, s, key, now);
  if (!did || (st.want && !st.want(p.hold))) return fail();
  b.i++; b.hand = cfg.hand;
}
function wander(G, s, dt, cfg) { G.pl[s].f += dt * .5 * Math.sin(G.last / 900 + s); }

// ---------- what each screen sees ----------
const itemView = it => it && { k: it.k, ch: it.ch, cp: +it.cp.toFixed(3), ck: +it.ck.toFixed(3), has: it.has, soup: it.soup };
export function view(G, s) {
  const now = Date.now();
  const cells = {};
  for (const [k, c] of Object.entries(G.cells)) {
    if (c.item) cells[k] = { item: itemView(c.item) };
    if (c.pot && c.pot.n) cells[k] = { pot: { n: c.pot.n, kind: c.pot.kind, cook: +c.pot.cook.toFixed(3) } };
  }
  return {
    game: 'kitchen', ph: G.ph, stage: G.stage, gid: G.gid, me: s, map: G.map, time: G.opts.time,
    count: G.stage === 'count' ? Math.max(0, G.start - now) : 0, left: Math.max(0, G.end - now),
    tips: G.tips, goals: G.goals, served: G.served, missed: G.missed,
    cells,
    pl: G.pl.map(p => ({ x: +p.x.toFixed(3), z: +p.z.toFixed(3), f: +p.f.toFixed(3), hold: itemView(p.hold), chop: p.chop, fix: p.fix, walk: p.walk })),
    orders: G.orders.map(o => ({ id: o.id, r: o.r, left: Math.max(0, o.life - (now - o.at)), life: o.life })),
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, pts: G.pts[i], st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Co-op, but coins still go by place: everyone is ranked by their share of the tips from the dishes they helped make.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: G.pts[i], win: place === 0 && G.pts[i] > 0, place: place + 1, idle: G.pts[i] <= 0 }; // no hand in any dish, no coins
  });
}

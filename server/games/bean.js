// Beanstalk Bounce: everyone climbs the same giant beanstalk at once while a storm rises underneath.
// Real time, like Kart Island Race: every browser moves its own climber with the shared physics in tower.js and
// reports where it is about ten times a second, plus every landing. The server checks those reports, keeps the
// score (floors and streaks), moves the bots with the same physics, decides who the storm caught, and streams
// everything back twenty times a second (fast()).
import { buildTower, floorAt, ledgeOff, newClimber, cloneClimber, stepClimber, stormY, newRun, land, expire, bank, scoreOf, zoneOf,
  PACES, W, FLOOR_H, SPRING_V, MOVING, ZONE } from '../../public/games/bean/tower.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'bean', name: 'Beanstalk Bounce', minPlayers: 1, maxPlayers: 6, joinAt: 'game' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const COUNT_MS = 3400;   // the countdown
const BOTS_AFTER_MS = 6000;     // once every person is out, the bots get this long
const MAX_MS = 8 * 60_000;      // nobody outruns the storm this long, but just in case
const STEP = 1 / 60;

export function cleanOpts(o = {}) {
  return {
    seats: [1, 2, 4, 6].includes(+o.seats) ? +o.seats : 4,
    pace: PACES[o.pace] ? o.pace : 'normal',
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
  const now = Date.now(), n = seats.length;
  const slots = seats.map((_, i) => i).sort(() => Math.random() - .5);
  return {
    game: 'bean', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    seed: 1 + Math.floor(Math.random() * 99_990), startAt: now, goAt: now + COUNT_MS, last: now, acc: 0,
    k: seats.map((_, i) => newClimber(slots[i], n)), run: seats.map(() => newRun()),
    st: seats.map(() => ({ out: 0, outF: 0, repAt: now, landAt: -1e9, landMs: 0, bad: 0, plan: null, think: .4 + Math.random() * .6, zone: 0 })),
    zoneTop: 0, ev: [], evN: 0, doneAt: 0, endAt: 0, res: null, win: -1, dirty: true, sendN: 0,
  };
}

const towers = new Map(); // seed -> tower (a few tables at most)
function T_(G) { let T = towers.get(G.seed); if (!T) { if (towers.size > 40) towers.clear(); towers.set(G.seed, T = buildTower(G.seed)); } return T; }
function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const sec = (G, now) => (now - G.goAt) / 1000;

// best first: score, then whoever lasted longer
function order(G) {
  return G.seats.map((_, i) => i).sort((a, b) => scoreOf(G.run[b]) - scoreOf(G.run[a]) || G.run[b].best - G.run[a].best || (G.st[b].out || 1e15) - (G.st[a].out || 1e15) || a - b);
}

// A landing (a person's report or a bot's step): the score, streaks and "first to reach" news.
function landed(G, s, f, ms) {
  const run = G.run[s], r = land(run, f, ms);
  if (r.ended && r.ended.pts) pushEv(G, { t: 'streak', s, ...r.ended });
  const z = zoneOf(run.best);
  if (z > G.zoneTop) { G.zoneTop = z; pushEv(G, { t: 'zone', s, z }); }
}

function knockOut(G, s, now) {
  const st = G.st[s]; if (st.out) return;
  st.out = Math.max(1, now - G.goAt); st.outF = G.run[s].best;
  const b = bank(G.run[s]); if (b && b.pts) pushEv(G, { t: 'streak', s, ...b });
  pushEv(G, { t: 'out', s, f: st.outF, x: +G.k[s].x.toFixed(2), y: +G.k[s].y.toFixed(2) });
}

// ---------- bots ----------
// A bot plans one jump at a time by trying a handful of run-ups with the real physics and picking a landing.
const RUNS = [0, .1, .22, .36, .55, .8];
function tryPlan(T, k0, plan, t) {
  const k = cloneClimber(k0); let jumped = false, tt = t;
  for (let n = 0; n < 240; n++) {
    if (k.on >= 0 && jumped) break;
    stepClimber(T, k, k.on >= 0 ? { dir: plan.dir, jump: tt - t >= plan.run } : { dir: plan.air, jump: false }, STEP, tt); tt += STEP;
    if (k.on < 0) jumped = true;
  }
  return { f: k.on, x: k.x, dur: tt - t };
}
function choosePlan(G, s, t) {
  const T = T_(G), k = G.k[s], sharp = G.opts.bots === 'sharp', cur = k.on, opts = [];
  for (const dir of [-1, 1]) for (const run of RUNS) for (const air of [dir, 0, -dir]) {
    const plan = { dir, run, air, t0: t }, r = tryPlan(T, k, plan, t);
    if (r.f < 0) continue;
    const F = floorAt(T, r.f), off = ledgeOff(F, t + r.dur), mid = (F.x0 + F.x1) / 2 + off, half = (F.x1 - F.x0) / 2;
    const safe = 1 - Math.min(1, Math.abs(r.x - mid) / half); // 1 in the middle of the ledge, 0 at its end
    opts.push({ plan, up: r.f - cur, safe, dur: r.dur });
  }
  if (!opts.length) return { dir: k.x > 0 ? -1 : 1, run: .3, air: 0, t0: t };
  const hurry = k.y - stormY(G.opts.pace, t) < 9;
  // chill bots take small safe hops and fumble now and then; sharp ones chain big jumps
  if (Math.random() < (sharp ? .025 : .07)) return opts[Math.random() * opts.length | 0].plan;
  const want = sharp ? (hurry ? 6 : 4) : hurry ? 3 : Math.random() < .3 ? 2 : 1;
  let best = null, bv = -1e9;
  for (const o of opts) {
    const up = Math.min(o.up, want);
    const v = (o.up > 0 ? up * 10 : o.up * 4 - 20) + o.safe * (sharp ? 6 : 9) - o.dur * (sharp ? 2 : 1) + Math.random() * (sharp ? 2 : 5);
    if (v > bv) { bv = v; best = o; }
  }
  return best.plan;
}
function botStep(G, s, t) {
  const T = T_(G), k = G.k[s], st = G.st[s], sharp = G.opts.bots === 'sharp';
  let inp = { dir: 0, jump: false };
  if (st.plan) {
    const p = st.plan;
    if (k.on >= 0 && p.jumped) st.plan = null;
    else if (k.on >= 0) inp = { dir: p.dir, jump: t - p.t0 >= p.run };
    else { p.jumped = true; inp = { dir: p.air, jump: false }; }
  }
  if (!st.plan && k.on >= 0) {
    st.think -= STEP;
    const close = k.y - stormY(G.opts.pace, t) < 7;
    if (st.think <= 0 || (close && st.think < .25)) {
      st.plan = choosePlan(G, s, t); st.plan.t0 = t; st.plan.jumped = false;
      st.think = sharp ? .14 + Math.random() * .22 : .4 + Math.random() * .6;
      inp = { dir: st.plan.dir, jump: st.plan.run <= 0 };
    }
  }
  stepClimber(T, k, inp, STEP, t);
  if (k.on < 0 && st.plan) st.plan.jumped = true;
  if (k.landed >= 0) landed(G, s, k.landed, (t + STEP) * 1000);
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const dt = Math.min(.25, (now - G.last) / 1000); G.last = now;
  if (G.stage === 'count') {
    if (now >= G.goAt) { G.stage = 'climb'; G.acc = 0; pushEv(G, { t: 'go' }); }
    return tickOut(G);
  }
  const t1 = sec(G, now);
  // bots climb in small fixed steps, so what they planned is exactly what happens
  G.acc += dt; let n = Math.floor(G.acc / STEP); G.acc -= n * STEP; n = Math.min(n, 20);
  for (let q = n; q > 0; q--) {
    const t = t1 - q * STEP;
    for (let s = 0; s < G.seats.length; s++) if (G.seats[s].bot && !G.st[s].out) botStep(G, s, t);
  }
  const sy = stormY(G.opts.pace, t1), ms = t1 * 1000;
  for (let s = 0; s < G.seats.length; s++) {
    const st = G.st[s]; if (st.out) continue;
    const b = expire(G.run[s], ms); if (b && b.pts) pushEv(G, { t: 'streak', s, ...b });
    // the storm: bots at once, people with a little slack for the trip their reports make
    if (G.k[s].y < sy - (G.seats[s].bot ? 0 : 1.6)) knockOut(G, s, now);
  }
  const alive = G.st.filter(x => !x.out).length;
  const peopleLeft = G.seats.some((x, i) => x.human && !x.bot && !G.st[i].out);
  const anyPeople = G.seats.some(x => x.human);
  if (anyPeople && !peopleLeft && alive && !G.doneAt) G.doneAt = now;
  if (!alive || (G.doneAt && now - G.doneAt > BOTS_AFTER_MS) || now - G.goAt > MAX_MS) finish(G, now);
  return tickOut(G);
}
function tickOut(G) { G.full = G.dirty || ++G.sendN % 20 === 0; G.dirty = false; return true; }

function finish(G, now) {
  for (let s = 0; s < G.seats.length; s++) { bank(G.run[s]); if (!G.st[s].out) G.st[s].outF = G.run[s].best; }
  const ord = order(G);
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = ord[0];
  G.res = { order: ord, score: G.run.map(scoreOf), floor: G.run.map(r => r.best), bonus: G.run.map(r => r.bonus), top: G.run.map(r => r.top), out: G.st.map(x => x.out) };
  pushEv(G, { t: 'end', w: G.win });
  G.dirty = true;
}

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.seats[s].bot || G.ph !== 'play' || G.stage !== 'climb') return false;
  const now = Date.now(), st = G.st[s], k = G.k[s];
  if (st.out) return false;
  if (a.t === 'p') { // where my climber is now
    const x = +a.x, y = +a.y, vx = +a.vx, vy = +a.vy;
    if (![x, y, vx, vy].every(Number.isFinite)) return false;
    const gap = Math.max(.05, Math.min(1, (now - st.repAt) / 1000));
    // nobody rises faster than a bounce mushroom throws them; a long run of refusals is let through
    const ok = (Math.abs(x) <= W + .01 && y >= -.01 && y - k.y <= SPRING_V * gap + 5) || st.bad > 8;
    st.repAt = now;
    if (!ok) { st.bad++; return false; }
    st.bad = 0;
    k.x = Math.max(-W, Math.min(W, x)); k.y = Math.max(0, y); k.vx = Math.max(-20, Math.min(20, vx)); k.vy = Math.max(-60, Math.min(60, vy));
    k.on = Number.isInteger(a.on) && a.on >= 0 ? a.on : -1; k.face = a.fc < 0 ? -1 : 1;
    return false; // the 20-a-second stream carries it to everyone
  }
  if (a.t === 'l') { // I landed on floor f
    const f = a.f | 0, run = G.run[s], T = T_(G);
    if (f < 0 || f > run.last + 9 || f === run.last) return false;                      // too high in one go
    if (f * FLOOR_H > k.y + 14) return false;                                            // far above where they last said they were
    const F = floorAt(T, f), x = Number.isFinite(+a.x) ? +a.x : k.x, slack = F.kind === MOVING ? F.amp + 1.5 : 1.5;
    if (x < F.x0 - slack || x > F.x1 + slack) return false;                              // not on that ledge
    // the browser's clock for the landing, kept close to ours, so streak timers agree on both sides
    const mine = now - G.goAt, ms = Math.max(mine - 700, Math.min(mine + 200, Number.isFinite(+a.m) ? +a.m : mine));
    if (ms - st.landMs < 100) return false;                                              // nobody lands twice that fast
    st.landAt = now; st.landMs = ms;
    landed(G, s, f, ms);
    if (f * FLOOR_H > k.y) k.y = f * FLOOR_H;
    return false;
  }
  if (a.t === 'd') { knockOut(G, s, now); return true; } // the storm got me
  return false;
}

export function tick() { return false; } // fast() does the work

// A player who drops out keeps their place on the stalk; a bot climbs for them from where they are.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.dirty = true;
  const k = G.k[s], st = G.st[s]; st.plan = null; st.think = .3;
  if (away && k.on < 0) { k.vy = Math.min(k.vy, 0); } // let them come down onto something first
  if (away) k.gone = {};
  return true;
}

const r2 = v => Math.round(v * 100) / 100;
export function view(G, s) {
  const now = Date.now();
  const out = {
    game: 'bean', ph: G.ph, stage: G.stage, gid: G.gid, me: s, seed: G.seed, pace: G.opts.pace, t: now - G.goAt,
    k: G.k.map(k => [r2(k.x), r2(k.y), r2(k.vx), r2(k.vy), k.on, k.face]),
    sc: G.run.map(scoreOf), fl: G.run.map(r => r.best), stk: G.run.map(r => (r.st ? [r.st.n, r.st.fl] : 0)), out: G.st.map(x => x.out),
    place: order(G), ev: G.ev, res: G.res, win: G.win,
  };
  if (G.full || G.ph !== 'play' || s < 0 || G.stage === 'count') out.seats = G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id }));
  return out;
}

// Per-seat outcome: the score, and a win for the best one. Coins are paid by place (the hub does that).
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: G.res.score[i], win: G.res.order[0] === i, place: G.res.order.indexOf(i) + 1 }));
}

// for tests
export const _order = order;
export const _knock = knockOut;
export const _tower = T_;

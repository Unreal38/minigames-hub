// Sugar Siege: a turn-based food fight on a side-on block island for 2 to 4 teams of Pet Farm pets. On your turn
// one of your pets walks, picks a snack and throws it with a slingshot pull. Splashes bite holes in the island, knock
// pets about and fill them up; a pet at 100% crashes from the sugar rush and sleeps, and one knocked into the sea
// naps on a float. The last team with a pet awake wins. After round 10 the sugar tide rises a block every turn.
//
// The server owns everything: it walks the pets (from the held direction the player sends), flies the snacks and
// splashes them, 60 steps a second inside fast(), and streams the match 20 times a second. The page only draws.
// Each player's team is their own isle pets (the ones they show on their profile isle); guests and bots get others.
import * as R from '../../public/games/siege/rules.js';
import { SPECIES, formOf } from '../../public/games/farm/data.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'siege', name: 'Sugar Siege', minPlayers: 1, maxPlayers: 4, seats: { lo: 2, def: 2 }, pets: true };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const STARTERS = ['mossbun', 'cindercub', 'puddlepup', 'zapkit', 'pebblet']; // a guest's team, in this order
const POOL = Object.keys(SPECIES).filter(k => (SPECIES[k].rare | 0) <= 1 && !SPECIES[k].wheel && !SPECIES[k].el2);
// stage lengths (ms)
export const MS = { intro: 2600, settleMin: 900, settleMax: 6000, think: [1100, 1800], aimShow: 900, walkHold: 900 };
export const BOTS = { // aim wobble: degrees, and a share of the power
  chill: { ang: 6.5, pw: .09, step: 4, foods: .35 },
  sharp: { ang: 1.8, pw: .025, step: 2.5, foods: .6 },
};

const rnd = Math.random;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    pets: R.TEAM_PETS.includes(+o.pets) ? +o.pets : 3,
    timer: R.TIMERS.includes(+o.timer) ? +o.timer : 30,
    arc: R.ARCS.includes(o.arc) ? o.arc : 'short',
  };
}

// A team for one seat: its own isle pets first (as they are on the farm), topped up with starters or random pets.
function teamFor(seat, n, used) {
  const out = [];
  for (const p of Array.isArray(seat.pets) ? seat.pets : []) {
    if (out.length >= n || !p || !SPECIES[p.sp]) continue;
    out.push({ sp: p.sp, lv: Math.max(1, Math.min(99, p.lv | 0)), look: p.look && typeof p.look === 'object' ? p.look : null, name: String(p.name || SPECIES[p.sp].name).slice(0, 24), own: true });
  }
  const pool = seat.bot ? shuffle(POOL.filter(sp => !used.has(sp))) : [...STARTERS.filter(sp => !used.has(sp)), ...shuffle(POOL.filter(sp => !used.has(sp))), ...STARTERS] // guests: starters nobody else has yet;
  for (const sp of pool) { if (out.length >= n) break; if (out.some(p => p.sp === sp)) continue; out.push({ sp, lv: 20, look: null, name: SPECIES[sp].name, own: false }); }
  for (const p of out) used.add(p.sp);
  return out;
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => rnd() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true, pets: p.pets }));
  const taken = new Set(seats.map(s => String(s.color || '').toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  const n = Math.max(opts.seats, seats.length, 2);
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const seed = 1 + (rnd() * 2 ** 31 | 0), isle = R.makeIsland(seed), grid = R.gridOf(isle.hs);
  for (const op of isle.ops) R.applyOp(grid, op);
  // teams and where their pets start: spread along the island, the teams mixed
  const spUsed = new Set(), teams = seats.map(s => ({ pets: teamFor(s, opts.pets, spUsed) }));
  const order = [];
  for (let k = 0; k < opts.pets; k++) for (const t of shuffle(seats.map((_, i) => i))) order.push(t);
  const pets = [], slots = order.length;
  order.forEach((t, i) => {
    const c = Math.max(4, Math.min(R.COLS - 5, Math.floor(R.COLS * (.12 + .76 * (i + .5) / slots) + (rnd() - .5) * 3)));
    const info = teams[t].pets[pets.filter(p => p.team === t).length];
    pets.push({ team: t, sp: info.sp, lv: info.lv, look: info.look, name: info.name, own: info.own,
      x: c * R.BS + R.BS / 2, y: Math.max(R.topY(grid, c - 1), R.topY(grid, c), R.topY(grid, c + 1)) + .02, vx: 0, vy: 0, face: c < R.COLS / 2 ? 1 : -1, full: 0, sleep: false, sea: false, ground: false, at: 0 });
  });
  const now = Date.now();
  const G = {
    game: 'siege', ph: 'play', stage: 'intro', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    hs: isle.hs, ops: isle.ops.slice(), grid, pets, water: R.WATER0, wind: 0,
    teams: seats.map((_, i) => ({ ammo: R.ammoFor(pets.filter(p => p.team === i).map(p => p.sp)), next: -1, out: false, outAt: 0, st: { hits: 0, naps: 0, thrown: 0 } })),
    turn: rnd() * n | 0, ap: -1, round: 1, turnN: 0, stageEnd: now + MS.intro, tEnd: 0, shots: [], aim: null, walk: 0, walkAt: 0, jump: false,
    thrower: -1, bot: null, acc: 0, last: now, ev: [], evN: 0, dirty: true, full: true, fullNext: true, sendN: 0, fullN: 0, res: null, endAt: 0, moving: false,
  };
  G.start = G.turn;
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; e.at = Date.now(); G.ev.push(e); if (G.ev.length > 40) G.ev.shift(); G.dirty = true; }
const awake = (G, t) => G.pets.filter(p => p.team === t && !p.sleep);
const fullOf = (G, t) => G.pets.filter(p => p.team === t).reduce((a, p) => a + (p.sea ? 100 : p.full), 0);
const cur = G => G.pets[G.ap];

// ---------- turns ----------
function startTurn(G, now, first) {
  const n = G.seats.length;
  if (!first) {
    let t = G.turn;
    for (let k = 1; k <= n; k++) { const c = (G.turn + k) % n; if (!G.teams[c].out) { t = c; break; } }
    if ((t - G.start + n) % n <= (G.turn - G.start + n) % n) G.round++; // back round to the team that started
    G.turn = t;
  }
  const mine = G.pets.map((p, i) => [p, i]).filter(([p]) => p.team === G.turn), tm = G.teams[G.turn];
  for (let k = 1; k <= mine.length; k++) { const j = (tm.next + k) % mine.length; if (!mine[j][0].sleep) { tm.next = j; G.ap = mine[j][1]; break; } }
  G.turnN++;
  // the sugar tide: after round 10 the sea rises a block before every turn
  if (G.round > R.TIDE_ROUND && !first) { G.water = Math.min(R.ROWS * R.BS, G.water + R.TIDE_STEP); pushEv(G, { t: 'tide', y: G.water }); }
  G.wind = Math.round((rnd() * 2 - 1) * 10) / 10;
  G.stage = 'aim'; G.shots = []; G.aim = null; G.walk = 0; G.jump = false; G.thrower = -1;
  G.tEnd = G.seats[G.turn].bot ? 0 : now + G.opts.timer * 1000;
  G.bot = G.seats[G.turn].bot ? { at: now + MS.think[0] + rnd() * (MS.think[1] - MS.think[0]), shot: null, walk: rnd() < .45 ? (rnd() < .5 ? -1 : 1) : 0, walkMs: 400 + rnd() * 700 } : null;
  pushEv(G, { t: 'turn', s: G.turn, p: G.ap, w: G.wind, r: G.round });
  // the tide may have reached pets already: check before anyone moves
  sweepSea(G, now);
}

function sweepSea(G, now) {
  for (let i = 0; i < G.pets.length; i++) { const p = G.pets[i]; if (!p.sea && p.y < G.water - .25) { p.sea = true; p.vx = p.vy = 0; nap(G, i, now, 'sea'); } }
}
function nap(G, i, now, why) {
  const p = G.pets[i];
  if (!p.sleep) { p.sleep = true; p.at = now; G.teams[p.team].st.naps++; }
  pushEv(G, { t: why, p: i });
}

function feed(G, i, amt, now, by) {
  const p = G.pets[i]; if (p.sleep || amt <= 0) return 0;
  const got = Math.min(100 - p.full, Math.round(amt)); p.full += got;
  if (by >= 0 && by !== p.team) G.teams[by].st.hits += got;
  if (p.full >= 100) nap(G, i, now, 'crash');
  return got;
}

// A snack landed: carve, push, fill up, and the element extras.
function splash(G, s, now) {
  const f = R.SNACKS[s.k], by = s.team, hits = [];
  if (f.grow) {
    const skip = G.pets.flatMap(R.petCells), op = ['b', s.x, s.y, f.r, 2, skip];
    if (R.applyOp(G.grid, op).length) { G.ops.push(op); G.fullNext = true; }
  } else if (f.bridge) {
    const c = Math.floor(s.x / R.BS), r = Math.max(1, Math.min(R.ROWS - 1, Math.floor(s.y / R.BS) + (R.solidAt(G.grid, s.x, s.y) ? 1 : 0)));
    const skip = G.pets.flatMap(R.petCells), op = ['s', c - f.bridge, c + f.bridge, r, 3, skip];
    if (R.applyOp(G.grid, op).length) { G.ops.push(op); G.fullNext = true; }
  } else if (f.r > 0 && !f.wave) {
    const op = ['c', s.x, s.y, f.r];
    if (R.applyOp(G.grid, op).length) { G.ops.push(op); G.fullNext = true; }
  }
  if (f.dmg || f.kb) {
    const reach = f.r + .7;
    G.pets.forEach((p, i) => {
      if (p.sea) return;
      const dx = p.x - s.x, dy = p.y + .5 - s.y, d = Math.hypot(dx, dy);
      if (d > reach) return;
      const u = 1 - d / reach, got = feed(G, i, f.dmg * (.4 + .6 * u), now, by);
      const k = f.kb * u, nx = d > .01 ? dx / d : (rnd() - .5);
      if (f.wave) { p.vx += Math.sign(dx || (rnd() - .5)) * k; p.vy = Math.max(p.vy, 1.5 + k * .2); }
      else { p.vx += nx * k; p.vy = Math.max(p.vy, 2.5 + k * .55); }
      if (k > .3) p.ground = false;
      hits.push([i, got]);
    });
  }
  let zap = null;
  if (f.zap) { // fizz: the nearest awake pets near the splash get zapped too
    const near = G.pets.map((p, i) => [i, Math.hypot(p.x - s.x, p.y + .5 - s.y)]).filter(([i, d]) => !G.pets[i].sleep && d < f.zapR).sort((a, b) => a[1] - b[1]).slice(0, f.zap);
    zap = near.map(([i]) => i);
    for (const i of zap) { const got = feed(G, i, 15, now, by); const h = hits.find(x => x[0] === i); if (h) h[1] += got; else hits.push([i, got]); }
  }
  pushEv(G, { t: 'splash', k: s.k, x: s.x, y: s.y, hits, ...(zap ? { zap } : {}) });
  if (f.split) for (let j = 0; j < f.split; j++) {
    const a = Math.PI * (.25 + .5 * j / (f.split - 1));
    G.shots.push({ k: 'mini', x: s.x, y: s.y + .35, vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 6.5, age: 0, team: by, from: -1, id: ++G.evN });
  }
  G.dirty = true;
}

function doThrow(G, k, a, pw, now) {
  const p = cur(G), tm = G.teams[G.turn];
  if (!p || p.sleep || G.stage !== 'aim' || !R.SNACKS[k] || !R.SNACK_KEYS.includes(k) || !(tm.ammo[k] > 0)) return false;
  if (!Number.isFinite(a) || !Number.isFinite(pw) || pw < .05) return false;
  tm.ammo[k]--; tm.st.thrown++;
  const s = R.launch(p, k, a, pw); p.face = s.vx >= 0 ? 1 : -1;
  G.shots.push({ ...s, team: G.turn, from: G.ap, id: ++G.evN });
  G.stage = 'fly'; G.tEnd = 0; G.aim = null; G.walk = 0; G.thrower = G.ap;
  pushEv(G, { t: 'throw', s: G.turn, p: G.ap, k });
  return true;
}

// ---------- bots ----------
// The bot tries throws in its head with the same physics and keeps the one that lands nearest a pet of another team
// (and well away from its own), then wobbles its aim by its level.
export function botShot(G, level = G.opts.bots) {
  const p = cur(G); if (!p) return null;
  const B = BOTS[level] || BOTS.chill, foes = G.pets.filter(q => q.team !== p.team && !q.sleep && !q.sea);
  if (!foes.length) return { k: 'pie', a: Math.PI / 4, pw: .5 };
  const am = G.teams[p.team].ammo, kinds = ['pie'];
  if (am.cake > 0 && rnd() < B.foods) kinds.push('cake');
  if (am.berry > 0 && rnd() < B.foods * .7) kinds.push('berry');
  if (am.chili > 0 && rnd() < B.foods * .6) kinds.push('chili');
  if (am.fizz > 0 && rnd() < B.foods * .6) kinds.push('fizz');
  let best = null;
  const sim = { k: '', x: 0, y: 0, vx: 0, vy: 0, age: 0 };
  for (const k of kinds) {
    const f = R.SNACKS[k];
    for (let dir = -1; dir <= 1; dir += 2) for (let ang = 8; ang <= 84; ang += B.step) for (let pw = .25; pw <= 1.001; pw += .035) {
      const a = dir > 0 ? ang * Math.PI / 180 : Math.PI - ang * Math.PI / 180;
      Object.assign(sim, R.launch(p, k, a, pw));
      let res = null; for (let i = 0; i < 400 && !res; i++) res = R.stepShot(G.grid, sim, R.DT * 2, G.pets, G.wind, G.water, p);
      if (res !== 'hit') continue;
      let sc = Infinity; for (const e of foes) sc = Math.min(sc, Math.hypot(e.x - sim.x, e.y + .5 - sim.y));
      for (const o of G.pets) if (o.team === p.team && !o.sleep && Math.hypot(o.x - sim.x, o.y + .5 - sim.y) < f.r + 1.1) sc += 6;
      if (k === 'cake') sc -= foes.filter(e => Math.hypot(e.x - sim.x, e.y - sim.y) < 3).length * .8;
      if (!best || sc < best.sc) best = { sc, k, a, pw };
    }
  }
  if (!best) { const e = foes[0], dir = e.x >= p.x ? 1 : -1; return { k: 'pie', a: dir > 0 ? .8 : Math.PI - .8, pw: .6 }; }
  best.a += (rnd() * 2 - 1) * B.ang * Math.PI / 180;
  best.pw = Math.max(.2, Math.min(1, best.pw * (1 + (rnd() * 2 - 1) * B.pw)));
  return best;
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  let steps = Math.min(12, Math.floor((G.acc += now - G.last) / (R.DT * 1000))); G.last = now;
  G.acc -= steps * R.DT * 1000; if (G.acc > 200) G.acc = 0;
  const was = G.moving; G.moving = false;
  if (G.stage === 'intro') { if (now >= G.stageEnd) startTurn(G, now, true); steps = 0; }
  // the walking input fades if the page stops repeating it (a dropped connection)
  if (G.walk && now - G.walkAt > MS.walkHold) G.walk = 0;
  const p = cur(G);
  const canWalk = (G.stage === 'aim' || G.stage === 'retreat') && p && !p.sleep && !p.sea;
  // bots: maybe a few steps, then the throw
  if (G.stage === 'aim' && G.bot) {
    const b = G.bot;
    if (!b.shot && now >= b.at) { b.shot = botShot(G); b.fireAt = now + MS.aimShow; G.aim = { a: b.shot.a, pw: b.shot.pw, k: b.shot.k }; G.dirty = true; }
    else if (!b.shot && b.walk && now >= b.at - b.walkMs - 500 && now < b.at - 500) { G.walk = b.walk; G.walkAt = now; }
    else if (!b.shot) G.walk = 0;
    if (b.shot && now >= b.fireAt) { G.walk = 0; doThrow(G, b.shot.k, b.shot.a, b.shot.pw, now); }
  }
  if (G.jump && canWalk && p.ground) { if (G.walk) p.face = G.walk; /* a jump goes the way you are holding */ p.vy = R.JUMP_VY; p.vx = p.face * R.JUMP_VX; p.ground = false; p.jmp = true; } G.jump = false;
  for (let k = 0; k < steps; k++) {
    G.pets.forEach((q, i) => {
      if (q.sea) return;
      const ox = q.x, oy = q.y;
      const r = R.stepPet(G.grid, q, R.DT, i === G.ap && canWalk ? G.walk : 0, G.water);
      if (r === 'sea') nap(G, i, now, 'sea');
      if (Math.abs(q.x - ox) > 1e-4 || Math.abs(q.y - oy) > 1e-4) G.moving = true;
    });
    for (let j = G.shots.length - 1; j >= 0; j--) {
      const s = G.shots[j], r = R.stepShot(G.grid, s, R.DT, G.pets, G.wind, G.water, G.pets[s.from]);
      if (!r) continue;
      G.shots.splice(j, 1);
      if (r === 'hit') splash(G, s, now); else pushEv(G, { t: 'plop', k: s.k, x: s.x, y: G.water });
    }
    if (G.shots.length) G.moving = true;
  }
  // stages
  if (G.stage === 'aim' && G.tEnd && now >= G.tEnd) { pushEv(G, { t: 'late', s: G.turn }); G.stage = 'settle'; G.stageEnd = now + MS.settleMax; G.settleAt = now; G.walk = 0; }
  if (G.stage === 'aim' && p && (p.sea || p.sleep)) { G.stage = 'settle'; G.stageEnd = now + MS.settleMax; G.settleAt = now; }
  if (G.stage === 'fly' && !G.shots.length) {
    const t = G.pets[G.thrower];
    if (t && !t.sleep && !t.sea) { G.stage = 'retreat'; G.tEnd = now + R.RETREAT_MS; pushEv(G, { t: 'run', p: G.thrower }); }
    else { G.stage = 'settle'; G.stageEnd = now + MS.settleMax; G.settleAt = now; }
  }
  if (G.stage === 'retreat' && now >= G.tEnd) { G.stage = 'settle'; G.stageEnd = now + MS.settleMax; G.settleAt = now; G.walk = 0; G.tEnd = 0; }
  if (G.stage === 'settle') {
    const still = G.pets.every(q => q.sea || (q.ground && Math.abs(q.vx) < .1));
    if ((still && now - G.settleAt > MS.settleMin) || now >= G.stageEnd) {
      for (let t = 0; t < G.teams.length; t++) { const T = G.teams[t]; if (!T.out && !awake(G, t).length) { T.out = true; T.outAt = G.turnN; pushEv(G, { t: 'out', s: t }); } }
      const left = G.teams.filter(T => !T.out).length;
      if (left <= 1 || G.round > R.MAX_ROUND) finish(G, now); else startTurn(G, now, false);
    }
  }
  if (G.moving || was) G.dirty = true;
  const send = G.dirty || ++G.sendN % 20 === 0;
  G.full = send && (G.fullNext || ++G.fullN % 40 === 0); // the island, names and looks: when they change, and now and then for late joiners
  if (send) { G.dirty = false; G.fullNext = false; }
  return send;
}

function finish(G, now) {
  const teams = G.teams.map((T, i) => ({ out: T.out, outAt: T.outAt, awake: awake(G, i).length, full: fullOf(G, i) }));
  const { order, place } = R.standings(teams);
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.tEnd = 0; G.shots = []; G.walk = 0;
  G.res = { order, place, awake: teams.map(t => t.awake), full: teams.map(t => t.full), st: G.teams.map(T => ({ ...T.st })) };
  G.fullNext = true;
  pushEv(G, { t: 'end', w: order[0] });
}

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  if (G.turn !== s) return false;
  const now = Date.now(), p = cur(G);
  if (a.t === 'in') { // the way I'm walking, repeated while held
    if (!(G.stage === 'aim' || G.stage === 'retreat')) return false;
    G.walk = a.d === -1 || a.d === 1 ? a.d : 0; G.walkAt = now; return false;
  }
  if (a.t === 'jump') { if ((G.stage === 'aim' || G.stage === 'retreat') && p?.ground) { G.jump = true; if (a.d === -1 || a.d === 1) { G.walk = a.d; G.walkAt = now; } } return false; }
  if (a.t === 'aim') { // for everyone watching: where I'm pulling
    if (G.stage !== 'aim') return false;
    const ang = +a.a, pw = +a.p, k = R.SNACK_KEYS.includes(a.k) ? a.k : 'pie';
    G.aim = Number.isFinite(ang) && Number.isFinite(pw) && pw > 0 ? { a: Math.round(ang * 1000) / 1000, pw: Math.round(Math.min(1, pw) * 1000) / 1000, k } : null;
    G.dirty = true; return false;
  }
  if (a.t === 'throw') return doThrow(G, String(a.k), +a.a, +a.p, now);
  return false;
}

export function tick() { return false; } // fast() does the work

// A person who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.fullNext = true; G.dirty = true;
  if (G.turn === s && G.stage === 'aim' && G.ph === 'play') {
    const now = Date.now(); G.walk = 0;
    if (away) { G.tEnd = 0; G.bot = { at: now + 900, shot: null, walk: 0, walkMs: 0 }; }
    else { G.bot = null; G.aim = null; G.tEnd = now + G.opts.timer * 1000; }
  }
  return true;
}

const q = v => Math.round(v * 100);
export function view(G, s) {
  const now = Date.now(), full = G.full || G.ph !== 'play' || s < 0;
  const out = {
    game: 'siege', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, ap: G.ap, round: G.round, wind: G.wind, water: G.water,
    left: G.tEnd ? Math.max(0, G.tEnd - now) : -1, timer: G.opts.timer, arc: G.opts.arc, bots: G.opts.bots, nPets: G.opts.pets,
    // each pet: x, y (cm), facing, fullness, 0 awake / 1 asleep / 2 napping in the sea
    pets: G.pets.map(p => [q(p.x), q(p.y), p.face, p.full, p.sea ? 2 : p.sleep ? 1 : 0]),
    shots: G.shots.map(x => [x.id, x.k, q(x.x), q(x.y), q(x.vx), q(x.vy), Math.round(x.age * 1000)]),
    // ammo 99 = unlimited (JSON has no Infinity)
    aim: G.aim, ammo: G.teams.map(T => Object.fromEntries(Object.entries(T.ammo).map(([k, v]) => [k, v === Infinity ? 99 : v]))), out: G.teams.map(T => T.out), nOps: G.ops.length,
    ev: G.ev.filter(e => now - e.at < 3000).map(({ at, ...e }) => e), res: G.res,
  };
  if (full) {
    out.seats = G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id }));
    out.info = G.pets.map(p => [p.team, p.sp, formOf(p.lv), p.look, p.name]);
    out.hs = G.hs; out.ops = G.ops;
  }
  return out;
}

// 10 points for every team you finished ahead of; equal results share the place.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => { const place = G.res.place[i]; return { pts: (n - place) * 10, win: place === 1, place }; });
}

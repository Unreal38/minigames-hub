// Blast Bay: a party maze on a floating Pet Farm isle. Everyone plants pop seeds that burst in a cross of petals a
// moment later, breaking crates and catching anyone in the blast. Pets hide in some crates and give their element's
// boost. Last one standing takes the round; first to the table's round wins takes the match.
// Real time like Kart Island Race: each browser walks its own avatar and reports where it is about ten times a
// second; the server checks every step (never into a wall or a crate), owns the seeds, blasts, crates, pets, the
// crumbling edge and who got caught, drives the bots, and streams the match 20 times a second through fast().
import { FUSE_MS, BLAST_MS, GRACE_MS, START, CAP, SPD_STEP, KICK_SPD, CRUMBLE_S, CRUMBLE_EVERY, FALL_WARN, ROUND_CAP_S, COUNT_MS, OVER_MS,
  WINS, SHIELD_MS, Q, ELS, ARENA_IDS, OPEN, WALL, CRATE, GONE, makeMaze, blastCells, crumbleOrder, starts, faceOf } from '../../public/games/blast/rules.js';
import { SPECIES } from '../../public/games/farm/data.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'blast', name: 'Blast Bay', minPlayers: 1, maxPlayers: 8, seats: { lo: 2, def: 4 }, joinAt: 'game' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple', 'Pebble', 'Muffin'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const EV_MS = 2500;
const LAST_WAIT = 8000, LAST_EVERY = 650; // after the ring: a pause, then the middle tiles drop one by one
// every pet of each element that can hop out of a crate
const PETS = Object.fromEntries(ELS.map(el => [el, Object.keys(SPECIES).filter(k => SPECIES[k].el === el)]));
// Bot skill: how often they think, how far ahead they plan, and how often a chill bot skips a good chance.
export const BOTS = { chill: { think: .42, look: 2, skip: .35, slow: .85 }, sharp: { think: .16, look: 4, skip: 0, slow: 1 } };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    wins: WINS.includes(+o.wins) || +o.wins === 1 ? +o.wins : 3, // 1: Friendship Trail's quick cut
    arena: ARENA_IDS.includes(o.arena) ? o.arena : 'random',
    crumble: o.crumble === 'off' ? 'off' : 'on',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
  };
}

const rnd = Math.random;
export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => rnd() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => String(s.color || '').toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const G = {
    game: 'blast', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts, round: 0, arena: '',
    wins: seats.map(() => 0), surv: seats.map(() => 0), outs: seats.map(() => 0), boons: seats.map(() => 0),
    stageAt: 0, endsAt: 0, playAt: 0, last: Date.now(), ev: [], evN: 0, sendN: 0, dirty: true, gsend: true, res: null, id: 0, lastWin: -1,
  };
  startRound(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; e.at = Date.now(); G.ev.push(e); if (G.ev.length > 60) G.ev.shift(); }

function startRound(G, now) {
  G.round++;
  const n = G.seats.length, m = makeMaze(n);
  Object.assign(G, { w: m.w, h: m.h, grid: m.grid, has: m.has, bombs: [], items: [], lethal: new Map(), fall: new Map(), outOrder: [] });
  G.crumble = crumbleOrder(G.grid, G.w, G.h); G.ck = 0; G.nextFall = 0;
  if (G.opts.arena === 'random') { const pick = ARENA_IDS.filter(a => a !== G.arena); G.arena = pick[rnd() * pick.length | 0]; } else G.arena = G.opts.arena;
  const st = starts(G.w, G.h);
  // seats take the start tiles in a shuffled order, so nobody is always in the same corner
  const order = G.seats.map((_, i) => i).sort(() => rnd() - .5);
  G.pl = G.seats.map(() => null);
  order.forEach((s, k) => {
    const [x, y] = st[k];
    G.pl[s] = { x, y, f: 0, in: true, outAt: 0, by: -1, max: START.bombs, out: 0, range: START.range, spd: START.spd, kick: false, shield: false, inv: 0,
      repAt: now, bad: 0, snap: 0, path: [], think: 0, want: false };
  });
  G.stage = 'count'; G.stageAt = now; G.endsAt = now + COUNT_MS; G.playAt = 0;
  G.dirty = true; G.gsend = true;
  pushEv(G, { t: 'r', r: G.round, arena: G.arena });
}

const at = (G, x, y) => (x < 0 || y < 0 || x >= G.w || y >= G.h ? WALL : G.grid[y * G.w + x]);
const bombAt = (G, x, y) => G.bombs.find(b => b.gx === x && b.gy === y);
const itemAt = (G, x, y, now) => G.items.find(it => it.x === x && it.y === y && now >= it.at);
const cellOf = p => [Math.round(p.x), Math.round(p.y)];
// may seat s stand on tile (x, y): open ground, and no seed unless it was planted under them
const freeFor = (G, s) => (x, y) => { if (at(G, x, y) !== OPEN) return false; const b = bombAt(G, x, y); return !b || b.pass.has(s); };

function plant(G, s, x, y, now) {
  const p = G.pl[s];
  if (!p.in || p.out >= p.max || at(G, x, y) !== OPEN || bombAt(G, x, y)) return false;
  const b = { id: ++G.id, gx: x, gy: y, x, y, o: s, r: p.range, at: now + FUSE_MS, pass: new Set([s]), vx: 0, vy: 0 };
  G.pl.forEach((q, i) => { if (q.in && Math.abs(q.x - x) < .8 && Math.abs(q.y - y) < .8) b.pass.add(i); });
  G.bombs.push(b); p.out++;
  pushEv(G, { t: 'pl', s, id: b.id });
  G.dirty = true;
  return true;
}

function burst(G, b, now) {
  G.bombs.splice(G.bombs.indexOf(b), 1);
  const o = G.pl[b.o]; if (o) o.out = Math.max(0, o.out - 1);
  const cells = blastCells(G.grid, G.w, G.h, b.gx, b.gy, b.r), out = [];
  for (const [x, y] of cells) {
    const i = y * G.w + x;
    out.push(i);
    const L = G.lethal.get(i);
    G.lethal.set(i, { from: L && L.to > now ? L.from : now, to: now + BLAST_MS, by: b.o });
    if (G.grid[i] === CRATE) {
      G.grid[i] = OPEN; G.gsend = true;
      const el = G.has[i];
      if (el >= 0) { const list = PETS[ELS[el]]; G.items.push({ id: ++G.id, x, y, el, sp: list[rnd() * list.length | 0], at: now + BLAST_MS }); }
    }
    const other = bombAt(G, x, y); if (other && other !== b) other.at = Math.min(other.at, now + 60); // the next seed goes off too
  }
  pushEv(G, { t: 'x', id: b.id, by: b.o, c: out });
  G.dirty = true;
}

function catchP(G, s, by, now, fell) {
  const p = G.pl[s]; if (!p.in) return;
  if (p.shield && !fell) { p.shield = false; p.inv = now + SHIELD_MS; pushEv(G, { t: 'sh', s }); G.dirty = true; return; }
  p.in = false; p.outAt = now; p.by = by;
  G.surv[s] += G.outOrder.length; G.outOrder.push(s); G.outs[s]++;
  pushEv(G, { t: 'c', s, by, x: Math.round(p.x * Q), y: Math.round(p.y * Q), fell: fell ? 1 : 0 });
  G.dirty = true;
}

function endRound(G, now, draw) {
  const live = G.pl.map((p, i) => (p.in ? i : -1)).filter(i => i >= 0);
  const w = !draw && live.length === 1 ? live[0] : -1;
  if (w >= 0) { G.wins[w]++; G.surv[w] += G.outOrder.length; }
  else for (const i of live) G.surv[i] += G.outOrder.length; // a draw: the ones still standing share the best survival
  G.lastWin = w;
  G.stage = 'over'; G.stageAt = now; G.endsAt = now + OVER_MS;
  G.dirty = true;
  pushEv(G, { t: 'w', s: w });
}

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => G.wins[b] - G.wins[a] || G.surv[b] - G.surv[a] || G.outs[a] - G.outs[b]);
  const key = i => G.wins[i] * 1000 + G.surv[i];
  const place = order.map(i => 1 + order.filter(j => key(j) > key(i)).length);
  G.ph = 'end'; G.stage = 'end'; G.endsAt = now;
  G.res = { order, place: G.seats.map((_, i) => place[order.indexOf(i)]), wins: G.wins.slice(), surv: G.surv.slice(), outs: G.outs.slice(), boons: G.boons.slice() };
  G.dirty = true;
  pushEv(G, { t: 'end' });
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const dt = Math.min(.1, Math.max(0, (now - G.last) / 1000)); G.last = now;
  if (G.stage === 'count' && now >= G.endsAt) { G.stage = 'play'; G.stageAt = now; G.playAt = now; G.dirty = true; pushEv(G, { t: 'go' }); }
  else if (G.stage === 'play') play(G, now, dt);
  else if (G.stage === 'over' && now >= G.endsAt) {
    const goal = G.opts.wins;
    if (G.wins.some(w => w >= goal) || G.round >= goal * 2 + 3) finish(G, now); else startRound(G, now);
  }
  G.full = G.dirty || ++G.sendN % 20 === 0; G.dirty = false;
  G.gsendNow = G.gsend || G.full; G.gsend = false;
  return true;
}

function play(G, now, dt) {
  const t = (now - G.playAt) / 1000;
  // bots walk and plant
  G.seats.forEach((seat, s) => { if (seat.bot && G.pl[s].in) botStep(G, s, dt, now); });
  // kicked seeds slide; seeds burst
  for (const b of G.bombs.slice()) {
    if (b.vx || b.vy) slide(G, b, dt);
    b.pass.forEach(i => { const q = G.pl[i]; if (!q.in || Math.abs(q.x - b.gx) >= .8 || Math.abs(q.y - b.gy) >= .8) b.pass.delete(i); });
  }
  for (let k = 0; k < 8; k++) { const b = G.bombs.find(x => now >= x.at); if (!b) break; burst(G, b, now); }
  for (const [i, L] of G.lethal) if (now >= L.to) G.lethal.delete(i);
  // the edge crumbles
  if (G.opts.crumble === 'on' && t >= CRUMBLE_S && G.ck < G.crumble.length && now >= G.nextFall) {
    if (G.ck === 0) pushEv(G, { t: 'cr' });
    G.fall.set(G.crumble[G.ck++], now + FALL_WARN); G.nextFall = now + CRUMBLE_EVERY; G.dirty = true;
    // the ring is done: the middle goes too, a tile at a time, until someone falls (the last one standing wins)
    if (G.ck === G.crumble.length) { const rest = []; for (let i = 0; i < G.grid.length; i++) if ((G.grid[i] === OPEN || G.grid[i] === CRATE) && !G.crumble.includes(i)) rest.push(i); G.crumble.push(...rest.sort(() => rnd() - .5)); G.nextFall = now + LAST_WAIT; G.last2 = true; }
    else if (G.last2) G.nextFall = now + LAST_EVERY;
  }
  for (const [i, when] of G.fall) if (now >= when) {
    G.fall.delete(i); G.grid[i] = GONE; G.gsend = true;
    const x = i % G.w, y = i / G.w | 0, b = bombAt(G, x, y);
    if (b) { G.bombs.splice(G.bombs.indexOf(b), 1); const o = G.pl[b.o]; if (o) o.out = Math.max(0, o.out - 1); }
    G.items = G.items.filter(it => !(it.x === x && it.y === y));
  }
  // who is caught, who picks up a pet
  G.pl.forEach((p, s) => {
    if (!p.in) return;
    const [cx, cy] = cellOf(p), i = cy * G.w + cx;
    if (at(G, cx, cy) === GONE) { catchP(G, s, -1, now, true); return; }
    const L = G.lethal.get(i);
    if (L && now < L.to && now >= p.inv && (G.seats[s].bot || now - L.from >= GRACE_MS)) catchP(G, s, L.by, now);
    if (!p.in) return;
    const it = itemAt(G, cx, cy, now);
    if (it) {
      const el = ELS[it.el];
      if (el === 'Ember') p.range = Math.min(CAP.range, p.range + 1);
      else if (el === 'Tide') p.max = Math.min(CAP.bombs, p.max + 1);
      else if (el === 'Spark') p.spd = Math.min(CAP.spd, +(p.spd + SPD_STEP).toFixed(2));
      else if (el === 'Leaf') p.shield = true;
      else p.kick = true;
      G.items.splice(G.items.indexOf(it), 1); G.boons[s]++;
      pushEv(G, { t: 'p', s, el: it.el, sp: it.sp, x: it.x, y: it.y });
      G.dirty = true;
    }
  });
  const live = G.pl.filter(p => p.in).length;
  if (live <= 1) endRound(G, now, false);
  else if (t >= ROUND_CAP_S) endRound(G, now, true);
}

function slide(G, b, dt) {
  let step = KICK_SPD * dt;
  for (let k = 0; k < 3 && step > 0; k++) {
    const tx = b.gx + b.vx, ty = b.gy + b.vy;
    const blocked = at(G, tx, ty) !== OPEN || bombAt(G, tx, ty) || G.pl.some(p => p.in && Math.abs(p.x - tx) < .6 && Math.abs(p.y - ty) < .6) || G.items.some(it => it.x === tx && it.y === ty);
    if (blocked) { b.vx = b.vy = 0; b.x = b.gx; b.y = b.gy; break; }
    const d = Math.abs(tx - b.x) + Math.abs(ty - b.y);
    if (d <= step) { b.x = b.gx = tx; b.y = b.gy = ty; step -= d; b.pass.clear(); }
    else { b.x += b.vx * step; b.y += b.vy * step; step = 0; }
  }
  G.dirty = true;
}

// ---------- bots ----------
// Time in seconds until each tile is dangerous (0: it is now, Infinity: safe), from the seeds, the blasts and the edge.
function danger(G, now, extra) {
  const D = new Float64Array(G.w * G.h).fill(Infinity);
  const list = G.bombs.map(b => ({ gx: b.gx, gy: b.gy, t: Math.max(0, (b.at - now) / 1000), r: b.r }));
  if (extra) list.push(extra);
  for (let pass = 0; pass < 2; pass++) for (const b of list) for (const [x, y] of blastCells(G.grid, G.w, G.h, b.gx, b.gy, b.r)) for (const o of list) if (o !== b && o.gx === x && o.gy === y && o.t > b.t) o.t = b.t;
  for (const b of list) for (const [x, y] of blastCells(G.grid, G.w, G.h, b.gx, b.gy, b.r)) { const i = y * G.w + x; D[i] = Math.min(D[i], b.t); }
  for (const [i, L] of G.lethal) if (now < L.to) D[i] = 0;
  for (const [i, when] of G.fall) D[i] = Math.min(D[i], Math.max(0, (when - now) / 1000));
  if (G.opts.crumble === 'on' && G.playAt) { const t = (now - G.playAt) / 1000; for (let k = G.ck; k < G.crumble.length; k++) { const w = CRUMBLE_S - t + (k - G.ck) * CRUMBLE_EVERY / 1000 + FALL_WARN / 1000; if (w > 25) break; const i = G.crumble[k]; D[i] = Math.min(D[i], Math.max(0, w)); } }
  return D;
}
// Shortest safe walk from seat s to the first tile goal(i, steps) likes. A tile is skipped when the walker would be
// on it as it goes off. avoid: one more tile to treat as a seed (a seed about to be planted).
function bfs(G, s, D, goal, avoid = -1) {
  const p = G.pl[s], [sx, sy] = cellOf(p), start = sy * G.w + sx, W = G.w;
  const prev = new Int32Array(G.w * G.h).fill(-2), dist = new Int16Array(G.w * G.h);
  prev[start] = -1; const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (goal(c, dist[c])) { const path = []; for (let k = c; prev[k] !== -1; k = prev[k]) path.unshift(k); return path; }
    const x = c % W, y = c / W | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (prev[n] !== -2 || at(G, nx, ny) !== OPEN || bombAt(G, nx, ny) || n === avoid) continue;
      const arrive = (dist[c] + 1) / p.spd + .15;
      if (D[n] < .45 || (D[n] <= arrive + .55 && D[n] > arrive - BLAST_MS / 1000 - .1)) continue;
      prev[n] = c; dist[n] = dist[c] + 1; q.push(n);
    }
  }
  return null;
}
function worth(G, s, c, range) {
  const x = c % G.w, y = c / G.w | 0; let w = 0;
  for (const [bx, by] of blastCells(G.grid, G.w, G.h, x, y, range)) {
    if (at(G, bx, by) === CRATE) w += 1;
    G.pl.forEach((q, i) => { if (i !== s && q.in && Math.round(q.x) === bx && Math.round(q.y) === by) w += 3; });
  }
  return w;
}
function think(G, s, now) {
  const p = G.pl[s], B = BOTS[G.opts.bots], D = danger(G, now), [cx, cy] = cellOf(p), c = cy * G.w + cx;
  if (D[c] < Infinity) { p.path = bfs(G, s, D, n => D[n] === Infinity) || []; return; }
  if (p.out < p.max && worth(G, s, c, p.range) > 0 && rnd() >= B.skip) {
    const D2 = danger(G, now, { gx: cx, gy: cy, t: FUSE_MS / 1000, r: p.range });
    const esc = bfs(G, s, D2, n => D2[n] === Infinity, c);
    if (esc && esc.length && esc.length <= 6) { p.want = true; p.path = esc; return; }
  }
  const path = bfs(G, s, D, (n, d) => {
    if (d === 0 || D[n] < Infinity) return false;
    if (G.items.some(it => it.y * G.w + it.x === n && now >= it.at)) return true;
    return p.out < p.max && worth(G, s, n, p.range) > 0;
  });
  if (path && path.length) { p.path = path.slice(0, B.look); return; }
  // nothing to break nearby: go after the nearest player
  const foes = G.pl.filter((q, i) => i !== s && q.in).map(q => cellOf(q));
  const hunt = foes.length && bfs(G, s, D, (n, d) => d > 0 && D[n] === Infinity && foes.some(([fx, fy]) => Math.abs(fx - n % G.w) + Math.abs(fy - (n / G.w | 0)) <= 2));
  if (hunt && hunt.length) { p.path = hunt.slice(0, B.look); return; }
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (cy + dy) * G.w + cx + dx).filter(n => G.grid[n] === OPEN && !G.bombs.some(b => b.gy * G.w + b.gx === n) && D[n] === Infinity);
  p.path = nb.length ? [nb[rnd() * nb.length | 0]] : [];
}
function botStep(G, s, dt, now) {
  const p = G.pl[s], B = BOTS[G.opts.bots];
  p.think -= dt;
  if (p.think <= 0) { p.think = B.think * (.8 + rnd() * .4); if (!p.path.length || B.skip === 0 || rnd() < .5) think(G, s, now); }
  if (p.want) { p.want = false; const [x, y] = cellOf(p); plant(G, s, x, y, now); }
  if (!p.path.length) return;
  const n = p.path[0], tx = n % G.w, ty = n / G.w | 0, free = freeFor(G, s);
  if (!free(tx, ty)) { p.path = []; return; }
  const step = p.spd * B.slow * dt, dx = tx - p.x, dy = ty - p.y;
  if (Math.abs(dx) + Math.abs(dy) <= step) { p.x = tx; p.y = ty; p.path.shift(); }
  else if (Math.abs(dx) > .01 && Math.abs(dy) > .01) { if (Math.abs(dx) < Math.abs(dy)) p.x += Math.sign(dx) * Math.min(step, Math.abs(dx)); else p.y += Math.sign(dy) * Math.min(step, Math.abs(dy)); }
  else if (Math.abs(dx) > .01) { p.x += Math.sign(dx) * step; p.f = faceOf(Math.sign(dx), 0); }
  else { p.y += Math.sign(dy) * step; p.f = faceOf(0, Math.sign(dy)); }
}

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  const now = Date.now(), p = G.pl[s];
  if (!p || !p.in) return false;
  if (a.t === 'p') { // where I am: whole hundredths of a tile, and which way I face
    const x = +a.x / Q, y = +a.y / Q, f = a.f | 0;
    if (![x, y].every(Number.isFinite) || G.stage !== 'play') return false;
    const gap = Math.max(.05, (now - p.repAt) / 1000), far = Math.abs(x - p.x) + Math.abs(y - p.y);
    p.repAt = now;
    const g = at(G, Math.round(x), Math.round(y));
    // never into a wall or a crate, never faster than your feet (with room for a bumpy connection)
    if (g === WALL || g === CRATE || far > p.spd * 1.5 * Math.min(gap, 1) + .6) {
      if (++p.bad >= 3) { p.bad = 0; p.snap++; G.dirty = true; } // the browser is off: send it back to where the server has it
      return false;
    }
    p.bad = 0; p.x = x; p.y = y; p.f = f & 3;
    return false;
  }
  if (a.t === 'b') { // plant a seed on tile (x, y): the one the browser stands on, which may be a step ahead of the server
    if (G.stage !== 'play') return false;
    const x = a.x | 0, y = a.y | 0;
    if (Math.abs(x - p.x) + Math.abs(y - p.y) > 1.3) return false;
    return plant(G, s, x, y, now);
  }
  if (a.t === 'k') { // kick the seed in front of me
    if (G.stage !== 'play' || !p.kick) return false;
    const b = G.bombs.find(o => o.id === a.id), dx = Math.sign(a.dx | 0), dy = Math.sign(a.dy | 0);
    if (!b || b.vx || b.vy || Math.abs(dx) + Math.abs(dy) !== 1) return false;
    if (Math.abs(b.gx - dx - p.x) + Math.abs(b.gy - dy - p.y) > 1.1) return false;
    b.vx = dx; b.vy = dy; G.dirty = true; pushEv(G, { t: 'k', s, id: b.id });
    return true;
  }
  return false;
}

export function tick() { return false; } // fast() does the work

// A person who drops out keeps their seat and a bot walks it until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; if (G.pl?.[s]) { G.pl[s].path = []; G.pl[s].think = 0; }
  G.dirty = true;
  return true;
}

const qn = v => Math.round(v * Q);
export function view(G, s) {
  const now = Date.now(), me = s >= 0 ? G.pl[s] : null;
  const out = {
    game: 'blast', ph: G.ph, stage: G.stage, gid: G.gid, me: s, round: G.round, goal: G.opts.wins, wins: G.wins, arena: G.arena, w: G.w, h: G.h,
    left: Math.max(0, G.endsAt - now), t: G.playAt ? now - G.playAt : 0, crumble: G.opts.crumble === 'on' ? 1 : 0, last: G.lastWin,
    // players: x, y (hundredths of a tile), facing, flags (1 standing, 2 leaf bubble, 4 just saved, 8 kick)
    a: G.pl.map(p => [qn(p.x), qn(p.y), p.f, (p.in ? 1 : 0) | (p.shield ? 2 : 0) | (now < p.inv ? 4 : 0) | (p.kick ? 8 : 0)]),
    b: G.bombs.map(b => [b.id, qn(b.x), qn(b.y), Math.max(0, b.at - now), b.o, b.pass.has(s) ? 1 : 0]),
    it: G.items.filter(it => now >= it.at).map(it => [it.id, it.x, it.y, it.el, it.sp]),
    fall: [...G.fall].map(([i, when]) => [i, Math.max(0, when - now)]),
    res: G.res,
  };
  if (G.gsendNow || s < 0 || G.ph !== 'play') out.g = Array.from(G.grid).join('');
  out.ev = G.ev.filter(e => now - e.at < EV_MS).map(({ at: _, ...e }) => e);
  if (me) out.my = { max: me.max, out: me.out, range: me.range, spd: me.spd, kick: me.kick, shield: me.shield, snap: me.snap };
  if (G.full || G.ph !== 'play' || s < 0) out.seats = G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id }));
  return out;
}

// Per-seat outcome: placement by round wins (then who lasted longest), a win for first.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: G.wins[i] * 10 + G.surv[i], win: G.res.place[i] === 1, place: G.res.place[i] }));
}

// for tests
export const _fast = fast;
export const _danger = danger;

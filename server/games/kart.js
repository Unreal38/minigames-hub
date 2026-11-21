// Kart Island Race: short kart races round floating islands, with silly power-ups.
// Real time: every browser drives its own kart with the shared physics in track.js and reports where it is about
// ten times a second. The server checks those reports, drives the bots with the same physics, counts laps, owns the
// item boxes and the power-ups, decides every hit, and streams the whole race back twenty times a second (fast()).
import { buildTrack, TRACK_IDS, TRACKS, newKart, stepKart, bump, autoDrive, locate, at, progOf, KART_R, MAX_V, headingAt } from '../../public/games/kart/track.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'kart', name: 'Kart Island Race', minPlayers: 1, maxPlayers: 8, joinAt: 'game' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const ITEMS = ['peel', 'jelly', 'chili', 'bubble', 'cloud'];
export const COUNT_MS = 3600;  // the start lights
export const ROLL_MS = 1100;   // an item box spins this long before you can use what came out
const AFTER_MS = 25_000;       // once someone finishes, everyone else has this long
const BOX_BACK_MS = 2600;
const SPIN_S = 1.25, SLOW_S = 2.8, CHILI_S = 1.6, BUBBLE_MS = 12_000, PEEL_MS = 45_000, JELLY_MS = 7000, JELLY_V = 38;
const SAFE_MS = 1400;          // after a hit you can't be hit again for a moment

export function cleanOpts(o = {}) {
  return {
    seats: [4, 6, 8].includes(+o.seats) ? +o.seats : 6,
    laps: [2, 3, 5].includes(+o.laps) ? +o.laps : 3,
    track: o.track === 'random' || TRACKS[o.track] ? o.track : 'random',
    items: o.items === 'off' ? 'off' : o.items === 'chaos' ? 'chaos' : 'on',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
  };
}

export function create(players, optsIn = {}, prev = null) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  // a random track never repeats the last one at this table
  let track = opts.track;
  if (track === 'random') { const pool = TRACK_IDS.filter(t => t !== prev?.trackId); track = pool[Math.random() * pool.length | 0]; }
  const T = buildTrack(track), now = Date.now();
  // the grid: people at the back half, bots in front, shuffled within
  const order = seats.map((_, i) => i).sort(() => Math.random() - .5).sort((a, b) => (seats[a].human ? 1 : 0) - (seats[b].human ? 1 : 0));
  const karts = []; order.forEach((s, slot) => { karts[s] = newKart(T, slot); });
  const G = {
    game: 'kart', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts, trackId: track,
    startAt: now, goAt: now + COUNT_MS, last: now, karts,
    st: seats.map((s, i) => ({ lane: (Math.random() - .5) * 4, laneAt: 0, rep: 0, repAt: now, bad: 0, fin: 0, best: 0, lapAt: 0, lapN: -1, hitAt: 0, flags: 0, keep: 0 })),
    item: seats.map(() => null), shield: seats.map(() => 0),
    boxes: T.boxes.map(() => 0), obj: [], objN: 0, ev: [], evN: 0, firstFin: 0, endAt: 0, res: null, win: -1, dirty: true, sendN: 0,
  };
  return G;
}

const T_ = G => buildTrack(G.trackId);
function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const raceMs = (G, now) => now - G.goAt;

// race order: finished karts by time, then everyone else by how far round they are
function order(G) {
  return G.seats.map((_, i) => i).sort((a, b) => {
    const fa = G.st[a].fin, fb = G.st[b].fin;
    if (fa && fb) return fa - fb; if (fa) return -1; if (fb) return 1;
    return G.karts[b].prog - G.karts[a].prog;
  });
}
const placeOf = (G, s) => order(G).indexOf(s) + 1;

// ---------- items ----------
function rollItem(G, s) {
  const n = G.seats.length, p = n > 1 ? (placeOf(G, s) - 1) / (n - 1) : 0, chaos = G.opts.items === 'chaos';
  // leaders get defensive things, the back of the pack gets the catch-up ones
  const w = p < .25 ? { peel: 40, jelly: 22, bubble: 30, chili: 8, cloud: 0 }
    : p < .65 ? { peel: 26, jelly: 30, bubble: 16, chili: 22, cloud: 6 }
      : { peel: 10, jelly: 26, bubble: 8, chili: 36, cloud: 20 };
  if (chaos) { w.cloud += 10; w.jelly += 10; }
  if (placeOf(G, s) === 1) w.cloud = 0;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) { r -= v; if (r < 0) return k; }
  return 'peel';
}

function useItem(G, s, now) {
  const it = G.item[s]; if (!it || now < it.at + ROLL_MS) return false;
  const k = G.karts[s], T = T_(G);
  G.item[s] = null;
  if (it.k === 'peel') {
    const x = k.x - Math.sin(k.h) * 2.4, z = k.z - Math.cos(k.h) * 2.4, l = locate(T, x, z, k.i);
    G.obj.push({ id: ++G.objN, k: 'peel', x, z, y: l.y, owner: s, born: now });
    if (G.obj.filter(o => o.k === 'peel').length > 14) G.obj.splice(G.obj.findIndex(o => o.k === 'peel'), 1);
  } else if (it.k === 'jelly') {
    // a wobbly jelly that bounces along the road after whoever is just ahead
    const ord = order(G), me = ord.indexOf(s), tgt = me > 0 ? ord[me - 1] : -1;
    G.obj.push({ id: ++G.objN, k: 'jelly', d: k.prog + 2.5, lat: k.lat, x: k.x, z: k.z, y: k.y, owner: s, tgt, born: now });
  } else if (it.k === 'chili') {
    if (G.seats[s].bot) k.boost = Math.max(k.boost, CHILI_S); // a person's browser boosts its own kart
  } else if (it.k === 'bubble') {
    G.shield[s] = now + BUBBLE_MS;
  } else if (it.k === 'cloud') {
    // a sleepy cloud over everyone ahead of you
    const hit = [];
    for (let i = 0; i < G.seats.length; i++) {
      if (i === s || G.st[i].fin || G.karts[i].prog <= k.prog) continue;
      if (G.shield[i] > now) { G.shield[i] = 0; pushEv(G, { t: 'pop', s: i }); continue; }
      if (G.seats[i].bot) G.karts[i].slow = SLOW_S;
      hit.push(i);
    }
    pushEv(G, { t: 'zzz', s, hit });
    return true;
  }
  pushEv(G, { t: 'use', s, k: it.k });
  return true;
}

// Something hit kart s. Bubbles soak it up; otherwise the kart spins out (the browser spins a person's kart).
function hitKart(G, s, by, kind, now) {
  const st = G.st[s];
  if (now - st.hitAt < SAFE_MS || G.karts[s].fall > 0 || G.karts[s].ghost > 0) return false;
  if (G.shield[s] > now) { G.shield[s] = 0; st.hitAt = now; pushEv(G, { t: 'pop', s, by, k: kind }); return true; }
  st.hitAt = now;
  if (G.seats[s].bot) { G.karts[s].spin = SPIN_S; G.karts[s].dr = 0; G.karts[s].charge = 0; }
  pushEv(G, { t: 'hit', s, by, k: kind });
  return true;
}

// distance from point (px, pz) to the segment a-b
function segDist(ax, az, bx, bz, px, pz) {
  const vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz, u = l ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l)) : 0;
  return Math.hypot(ax + vx * u - px, az + vz * u - pz);
}

function touch(G, s, ax, az, now) {
  const k = G.karts[s], T = T_(G);
  if (k.fall > 0) return;
  // item boxes
  if (G.opts.items !== 'off') for (let b = 0; b < T.boxes.length; b++) {
    if (G.boxes[b] > now) continue;
    const B = T.boxes[b];
    if (Math.abs(B.y - k.y) < 3 && segDist(ax, az, k.x, k.z, B.x, B.z) < KART_R + .9) {
      G.boxes[b] = now + BOX_BACK_MS;
      if (!G.item[s] && !G.st[s].fin) { G.item[s] = { k: rollItem(G, s), at: now }; pushEv(G, { t: 'box', s, b }); }
      else pushEv(G, { t: 'box', s, b, none: 1 });
    }
  }
  // banana peels
  for (let o = G.obj.length - 1; o >= 0; o--) {
    const O = G.obj[o];
    if (O.k !== 'peel' || (O.owner === s && now - O.born < 900) || Math.abs(O.y - k.y) > 2.5) continue;
    if (segDist(ax, az, k.x, k.z, O.x, O.z) < KART_R + .55) { G.obj.splice(o, 1); hitKart(G, s, O.owner, 'peel', now); }
  }
}

function moveJellies(G, dt, now) {
  const T = T_(G);
  for (let o = G.obj.length - 1; o >= 0; o--) {
    const O = G.obj[o]; if (O.k !== 'jelly') continue;
    if (now - O.born > JELLY_MS) { G.obj.splice(o, 1); pushEv(G, { t: 'splat', x: O.x, z: O.z, y: O.y }); continue; }
    let tk = O.tgt >= 0 ? G.karts[O.tgt] : null;
    if (tk && (G.st[O.tgt].fin || tk.prog < O.d - 6)) { O.tgt = -1; tk = null; } // it got past them
    O.d += JELLY_V * dt;
    if (tk) { const want = tk.lat, dl = want - O.lat; O.lat += Math.max(-9 * dt, Math.min(9 * dt, dl)); if (O.d > tk.prog - 1) O.d = Math.min(O.d, tk.prog + 1); }
    const s = ((O.d % T.L) + T.L) % T.L, i = Math.floor(s / T.step), p = at(T, i, Math.max(-3.5, Math.min(3.5, O.lat)));
    O.x = p.x; O.z = p.z; O.y = p.y;
    for (let k = 0; k < G.seats.length; k++) {
      if (k === O.owner && now - O.born < 600) continue;
      const K = G.karts[k];
      if (Math.abs(K.y - O.y) < 2.5 && Math.hypot(K.x - O.x, K.z - O.z) < KART_R + .8) {
        G.obj.splice(o, 1); hitKart(G, k, O.owner, 'jelly', now); pushEv(G, { t: 'splat', x: O.x, z: O.z, y: O.y }); break;
      }
    }
  }
}

// ---------- bots ----------
const TOP = { chill: .87, sharp: .97 };
function botStep(G, s, dt, now) {
  const k = G.karts[s], st = G.st[s], T = T_(G), sharp = G.opts.bots === 'sharp';
  if (now > st.laneAt) { st.lane = (Math.random() - .5) * (sharp ? 3 : 4.6); st.laneAt = now + 1500 + Math.random() * 2500; }
  // steer round peels a little way ahead
  let avoid = null;
  for (const O of G.obj) {
    if (O.k !== 'peel') continue;
    const d = locate(T, O.x, O.z, k.i), ahead = ((d.s - k.s) % T.L + T.L) % T.L;
    if (ahead > 2 && ahead < 16 && Math.abs(d.lat - st.lane) < 2.2 && Math.random() < (sharp ? .9 : .6)) avoid = d.lat > 0 ? d.lat - 2.6 : d.lat + 2.6;
  }
  const inp = autoDrive(T, k, { lane: st.lane, care: sharp ? 1 : 1.15, avoid });
  // keep the pack together: bots far ahead of the people ease off, bots far behind try harder
  let top = TOP[G.opts.bots];
  const humans = G.seats.map((x, i) => x.human && !x.bot ? G.karts[i].prog : null).filter(v => v != null);
  if (humans.length) {
    const lead = Math.max(...humans), gap = k.prog - lead;
    top *= gap > 40 ? .9 : gap < -60 ? 1.06 : 1;
  }
  if (st.fin) top *= .6;
  stepKart(T, k, inp, dt, top);
  // items: use them when it makes sense, or after a while anyway
  const it = G.item[s];
  if (it && now > it.at + ROLL_MS + 300) {
    const ord = order(G), me = ord.indexOf(s), ahead = me > 0 ? G.karts[ord[me - 1]] : null, behind = me < ord.length - 1 ? G.karts[ord[me + 1]] : null;
    const wait = now - it.at;
    const go = it.k === 'jelly' ? (ahead && ahead.prog - k.prog < 45) || wait > 9000
      : it.k === 'peel' ? (behind && k.prog - behind.prog < 12) || wait > 8000
        : it.k === 'chili' ? Math.abs(headingAt(T, k.i + 20) - headingAt(T, k.i)) < .25 || wait > 5000
          : true;
    if (go) useItem(G, s, now);
  }
}

// ---------- the race clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const dt = Math.min(.25, (now - G.last) / 1000); G.last = now;
  const T = T_(G);
  if (G.stage === 'count') {
    if (now >= G.goAt) { G.stage = 'race'; pushEv(G, { t: 'go' }); }
    return tickOut(G);
  }
  // bots drive in small steps
  const bots = G.seats.map((x, i) => x.bot ? i : -1).filter(i => i >= 0);
  const prev = G.karts.map(k => [k.x, k.z]);
  const steps = Math.max(1, Math.round(dt * 60));
  for (let n = 0; n < steps; n++) {
    for (const s of bots) botStep(G, s, dt / steps, now);
    for (const s of bots) for (let o = 0; o < G.karts.length; o++) if (o !== s) bump(G.karts[s], G.karts[o], true, false);
  }
  for (const s of bots) { const k = G.karts[s]; k.prog = progOf(T, k); touch(G, s, prev[s][0], prev[s][1], now); G.st[s].flags = flagsOf(k); }
  moveJellies(G, dt, now);
  if (G.opts.items === 'chaos' && Math.random() < dt * .35) { // chaos: peels rain down from the sky
    const i = Math.random() * T.n | 0, p = at(T, i, (Math.random() - .5) * 7);
    G.obj.push({ id: ++G.objN, k: 'peel', x: p.x, z: p.z, y: p.y, owner: -1, born: now });
    if (G.obj.filter(o => o.k === 'peel').length > 18) G.obj.splice(G.obj.findIndex(o => o.k === 'peel'), 1);
  }
  G.obj = G.obj.filter(o => o.k !== 'peel' || now - o.born < PEEL_MS);
  for (let s = 0; s < G.seats.length; s++) laps(G, s, now);
  // the end: everyone home, or the clock after the first finisher ran out, or nobody left driving
  const humansLeft = G.seats.some((x, i) => x.human && !x.bot && !G.st[i].fin);
  const allIn = G.st.every(x => x.fin);
  if (G.firstFin && !humansLeft && !G.doneAt) G.doneAt = now; // every person is home: the bots get a few seconds to come in
  if (allIn || (G.doneAt && now - G.doneAt > 5000) || (G.firstFin && now - G.firstFin > AFTER_MS) || raceMs(G, now) > G.opts.laps * 150_000) finish(G, now);
  return tickOut(G);
}
function tickOut(G) { G.full = G.dirty || ++G.sendN % 20 === 0; G.dirty = false; return true; }

function laps(G, s, now) {
  const k = G.karts[s], st = G.st[s];
  if (st.fin) return;
  if (k.lap > st.lapN) {
    if (st.lapN >= 0) { const t = now - G.goAt - st.lapAt; st.best = st.best ? Math.min(st.best, t) : t; }
    st.lapN = k.lap; st.lapAt = now - G.goAt;
    if (k.lap >= G.opts.laps) {
      st.fin = Math.max(1, now - G.goAt); if (!G.firstFin) G.firstFin = now;
      G.item[s] = null;
      pushEv(G, { t: 'fin', s, place: G.st.filter(x => x.fin).length, ms: st.fin });
    } else if (k.lap > 0) pushEv(G, { t: 'lap', s, lap: k.lap + 1 });
  }
}

function finish(G, now) {
  const ord = order(G);
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = ord[0]; G.obj = [];
  G.res = { order: ord, times: G.st.map(x => x.fin), best: G.st.map(x => x.best) };
  pushEv(G, { t: 'end', w: G.win });
  G.dirty = true;
}

const flagsOf = k => (k.fall > 0 ? 1 : 0) | (k.spin > 0 ? 2 : 0) | (k.boost > 0 ? 4 : 0) | (k.slow > 0 ? 8 : 0) | (k.dr > 0 ? 32 : 0) | (k.dr < 0 ? 64 : 0) | (k.grass ? 128 : 0) | (k.ghost > 0 ? 256 : 0) | (k.charge > 1.4 ? 512 : k.charge > .65 ? 1024 : 0);

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.seats[s].bot || G.ph !== 'play') return false;
  const now = Date.now();
  if (a.t === 'p') { // where my kart is now
    if (G.stage !== 'race') return false;
    const x = +a.x, z = +a.z, h = +a.h, v = +a.v;
    if (![x, z, h, v].every(Number.isFinite)) return false;
    const k = G.karts[s], st = G.st[s], T = T_(G), gap = Math.max(.05, (now - st.repAt) / 1000);
    // a kart can only have gone so far since the last report (boosts included); a long run of refusals is let through
    const far = Math.hypot(x - k.x, z - k.z), ok = far <= MAX_V * 1.5 * Math.min(gap, 1) + 6 || st.bad > 8;
    st.repAt = now;
    if (!ok) { st.bad++; return false; }
    st.bad = 0;
    const ax = k.x, az = k.z, prevS = k.s;
    const loc = locate(T, x, z, far > 20 ? -1 : k.i);
    Object.assign(k, { x, z, y: loc.y, h, v: Math.max(-8, Math.min(MAX_V * 1.6, v)), i: loc.i, lat: loc.lat, s: loc.s });
    // laps are counted here, from the reported places, never taken from the browser
    if (prevS > T.L * .75 && k.s < T.L * .25) k.lap++;
    else if (prevS < T.L * .25 && k.s > T.L * .75) k.lap--;
    k.prog = progOf(T, k);
    const f = a.f | 0; st.flags = f & (1 | 2 | 4 | 8 | 32 | 64 | 128 | 256 | 512 | 1024);
    k.fall = f & 1 ? 1 : 0; k.ghost = f & 256 ? .2 : 0;
    touch(G, s, ax, az, now);
    return false; // the 20-a-second stream carries it to everyone
  }
  if (a.t === 'use') { if (G.stage !== 'race') return false; return useItem(G, s, now); }
  return false;
}

export function tick() { return false; } // fast() does the work

// A player who drops out keeps their seat; a bot drives their kart from where it is.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.dirty = true;
  const k = G.karts[s]; k.fall = 0; k.spin = 0; k.dr = 0;
  return true;
}

const r2 = v => Math.round(v * 100) / 100;
export function view(G, s) {
  const now = Date.now();
  const out = {
    game: 'kart', ph: G.ph, stage: G.stage, gid: G.gid, me: s, track: G.trackId, laps: G.opts.laps, items: G.opts.items,
    t: now - G.goAt, after: G.firstFin ? Math.max(0, AFTER_MS - (now - G.firstFin)) : -1,
    k: G.karts.map((k, i) => [r2(k.x), r2(k.z), r2(k.y), r2(k.h), r2(k.v), G.seats[i].bot ? flagsOf(k) : G.st[i].flags]),
    lap: G.karts.map(k => k.lap), place: order(G), fin: G.st.map(x => x.fin),
    it: G.item.map(x => (x ? [x.k, Math.max(0, x.at + ROLL_MS - now)] : null)), sh: G.shield.map(x => x > now ? 1 : 0),
    bx: G.boxes.map(x => (x > now ? 0 : 1)), obj: G.obj.map(o => [o.id, o.k, r2(o.x), r2(o.z), r2(o.y)]),
    ev: G.ev, res: G.res, win: G.win,
  };
  if (G.full || G.ph !== 'play' || s < 0 || G.stage === 'count') out.seats = G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id }));
  // your own kart as the server sees it: the browser only takes it when a bot drove it for you
  if (s >= 0) out.mine = G.karts[s].lap;
  return out;
}

// Per-seat outcome: points for the place (and a little for finishing), a win for first.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i) + 1;
    return { pts: (n - place) * 10 + (G.st[i].fin ? 10 : 0), win: place === 1, place };
  });
}

// for tests
export const _order = order;
export const _use = useItem;
export const _hit = hitKart;

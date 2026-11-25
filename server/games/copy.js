// Copycat Isle: hide and seek on a little island. Hiders turn into anything lying about (a bench, a hay bale, a
// pumpkin) and keep still; seekers walk round booping things they think are people. Every person seeks once.
// Real time like Kart Island Race: each browser walks its own player and reports where it is about ten times a
// second; the server checks the speed, owns every disguise, boop, sniff and squeak, and streams the match 20 a second.
//
// Hidden information: a seeker's stream never says which object is a person. Disguised hiders go out mixed with
// a dozen loose decoy objects the server scatters each round, all under the same throwaway tokens, and the squeak
// pings a seeker gets are nudged a little way off the real spot.
import { PROPS, KINDS, EDGE, Q, SPEED, HIDE_S, SEEK_OPTS, COPIES, COPY_REACH, BOOP_REACH, DIZZY_MS, SNIFF_S, SNIFF_R,
  SQUEAK_S, SQUEAK_WAIT, SQUEAK_MAX, BREAK_MS, FAST_S, hiderSpawn, seekerSpawn, spotFor } from '../../public/games/copy/layout.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'copy', name: 'Copycat Isle', minPlayers: 1, maxPlayers: 10, seats: { lo: 4, def: 6 }, joinAt: 'game' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple', 'Pebble', 'Muffin'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b', '#f4d35e', '#b39ddb'];
export const KIND_LIST = Object.keys(KINDS);                 // kinds travel as their place in this list
const DECOYS = 12;                                           // loose objects scattered each round
const EV_MS = 2500;
// points
export const PTS = { per10: 1, last: 5, catch: 6, fast: 2, all: 3, squeak: 1 };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    time: SEEK_OPTS.includes(+o.time) ? +o.time : 180,
    caught: o.caught === 'join' ? 'join' : 'ghost',
  };
}

// Seekers a round: one for every four players, never more than there are people.
export const seekersPer = (n, humans) => Math.max(1, Math.min(n >= 8 ? 2 : 1, humans));

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => String(s.color || '').toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  // every person seeks once: shuffle them and cut the line into rounds
  const H = seats.map((s, i) => s.human ? i : -1).filter(i => i >= 0).sort(() => Math.random() - .5);
  const k = seekersPer(seats.length, H.length), plan = [];
  for (let i = 0; i < H.length; i += k) { const g = H.slice(i, i + k); for (let j = 0; g.length < k; j++) g.push(H[j]); plan.push(g); }
  const G = {
    game: 'copy', ph: 'play', stage: 'hide', gid: Math.random().toString(36).slice(2, 8), seats, opts, plan, round: -1,
    pl: seats.map(() => ({})), pts: seats.map(() => 0), stat: seats.map(() => ({ found: 0, caught: 0, lived: 0, sq: 0 })),
    decoys: [], stageAt: 0, endsAt: 0, seekAt: 0, last: Date.now(), ev: [], evN: 0, sendN: 0, dirty: true, res: null, sums: [],
  };
  startRound(G, Date.now());
  return G;
}

const rnd = Math.random;
function pushEv(G, e) { e.n = ++G.evN; e.at = Date.now(); G.ev.push(e); if (G.ev.length > 40) G.ev.shift(); }
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const live = (G, i) => G.pl[i].role === 'hider';

function startRound(G, now) {
  G.round++;
  const seekers = new Set(G.plan[G.round]);
  // a seeker who has gone away can't seek: skip the round if nobody is left to
  if (![...seekers].some(i => !G.seats[i].bot)) {
    if (G.round + 1 < G.plan.length) return startRound(G, now);
    return finish(G, now);
  }
  const toks = new Set(), tok = () => { let t; do t = 1 + (rnd() * 9000 | 0); while (toks.has(t)); toks.add(t); return t; };
  let hi = 0, si = 0;
  const spots = [];
  G.pl = G.seats.map((s, i) => {
    const seek = seekers.has(i);
    const [x, z] = seek ? seekerSpawn(si++) : hiderSpawn(hi++);
    const p = { role: seek ? 'seeker' : 'hider', x, z, h: seek ? -Math.PI / 2 : Math.atan2(-x, -z), k: -1, lock: 0, copies: COPIES, tok: tok(),
      dizzy: 0, sniffAt: 0, sniff: null, sqN: 0, sqAt: 0, nextSq: 0, caughtAt: 0, by: -1, repAt: now, bad: 0, moved: 0 };
    // bots pick a hiding spot at once and stay there
    if (!seek && s.bot) botHide(G, p, spots);
    return p;
  });
  // loose decoys: the same kinds of things, scattered somewhere new each round
  G.decoys = [];
  for (let n = 0; n < DECOYS; n++) {
    const k = KIND_LIST[rnd() * KIND_LIST.length | 0], at = spotFor(k, rnd, spots);
    if (at) { spots.push(at); G.decoys.push({ tok: tok(), k: KIND_LIST.indexOf(k), x: at[0], z: at[1], h: at[2] }); }
  }
  G.stage = 'hide'; G.stageAt = now; G.endsAt = now + HIDE_S * 1000; G.seekAt = 0;
  G.dirty = true;
  pushEv(G, { t: 'round', r: G.round });
}

function botHide(G, p, spots) {
  for (let n = 0; n < 8; n++) {
    const k = KIND_LIST[rnd() * KIND_LIST.length | 0], at = spotFor(k, rnd, spots);
    if (at) { spots.push(at); Object.assign(p, { x: at[0], z: at[1], h: at[2], k: KIND_LIST.indexOf(k), lock: 1 }); return; }
  }
  p.k = KIND_LIST.indexOf('bush');
}

function startSeek(G, now) {
  G.stage = 'seek'; G.stageAt = now; G.seekAt = now; G.endsAt = now + G.opts.time * 1000;
  // anyone still in their own clothes turns into the nearest thing (a person who never got round to it)
  let n = 0;
  G.pl.forEach((p, i) => {
    if (p.role === 'seeker') { p.sniffAt = now + 4000; return; }
    if (p.k < 0) {
      let best = null, bd = 1e9;
      for (const q of PROPS) { const d = Math.hypot(q[1] - p.x, q[2] - p.z); if (d < bd) { bd = d; best = q; } }
      p.k = KIND_LIST.indexOf(best ? best[0] : 'bush');
      pushEv(G, { t: 'auto', s: i, only: i });
    }
    p.copies = COPIES;
    p.nextSq = now + SQUEAK_S * 1000 * (.5 + (n++ * .37) % 1 * .5); // spread the first squeaks out
  });
  G.dirty = true;
  pushEv(G, { t: 'seek' });
}

function endRound(G, now) {
  const all = !G.pl.some(p => p.role === 'hider');
  const firstSeekers = G.plan[G.round];
  const sum = { r: G.round, seekers: firstSeekers, all, lived: [] };
  G.pl.forEach((p, i) => {
    if (p.role !== 'hider' && !p.caughtAt) return; // the round's own seekers
    const secs = Math.max(0, Math.floor(((p.caughtAt || now) - G.seekAt) / 1000));
    const got = Math.floor(secs / 10) * PTS.per10 + (p.role === 'hider' ? PTS.last : 0);
    G.pts[i] += got; G.stat[i].lived += secs;
    sum.lived.push([i, secs, got]);
  });
  if (all) for (const s of firstSeekers) G.pts[s] += PTS.all;
  G.sums.push(sum);
  G.stage = 'break'; G.stageAt = now; G.endsAt = now + BREAK_MS;
  G.dirty = true;
  pushEv(G, { t: 'over', all });
}

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => G.pts[b] - G.pts[a] || G.stat[b].caught - G.stat[a].caught || G.stat[b].lived - G.stat[a].lived);
  G.ph = 'end'; G.stage = 'end'; G.endsAt = now;
  G.res = { order, pts: G.pts.slice(), stat: G.stat.map(s => ({ ...s })) };
  G.dirty = true;
  pushEv(G, { t: 'end' });
}

function catchHider(G, s, h, now) {
  const p = G.pl[h];
  p.role = G.opts.caught === 'join' ? 'seeker' : 'ghost'; p.caughtAt = now; p.by = s; p.lock = 0;
  if (p.role === 'seeker') { p.sniffAt = now + 4000; p.k = -1; }
  const fast = now - G.seekAt < FAST_S * 1000;
  G.pts[s] += PTS.catch + (fast ? PTS.fast : 0);
  G.stat[s].caught++; G.stat[h].found++;
  pushEv(G, { t: 'c', s: h, by: s, x: p.x, z: p.z, k: p.k, fast });
  G.dirty = true;
  if (!G.pl.some(q => q.role === 'hider')) endRound(G, now);
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  G.last = now;
  if (G.stage === 'hide' && now >= G.endsAt) startSeek(G, now);
  else if (G.stage === 'seek') {
    // forced squeaks: every hider makes a noise every so often, people and bots alike
    G.pl.forEach((p, i) => {
      if (p.role !== 'hider' || now < p.nextSq) return;
      p.nextSq = now + SQUEAK_S * 1000; squeak(G, i, false);
    });
    // a round with no seeker left at the table (everyone went away) ends now
    if (!G.pl.some((p, i) => p.role === 'seeker' && !G.seats[i].bot)) endRound(G, now);
    else if (now >= G.endsAt) endRound(G, now);
  } else if (G.stage === 'break' && now >= G.endsAt) {
    if (G.round + 1 < G.plan.length) startRound(G, now); else finish(G, now);
  }
  G.full = G.dirty || ++G.sendN % 20 === 0; G.dirty = false;
  return true;
}

function squeak(G, i, own) {
  const p = G.pl[i], a = rnd() * 6.283, d = .6 + rnd() * 1.3;
  pushEv(G, { t: 'sq', s: i, x: p.x, z: p.z, jx: p.x + Math.cos(a) * d, jz: p.z + Math.sin(a) * d, own: own ? 1 : 0 });
}

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  const now = Date.now(), p = G.pl[s];
  if (!p) return false;
  if (a.t === 'p') { // where I am now: whole numbers, metres x Q
    const x = +a.x / Q, z = +a.z / Q, h = +a.h / 100;
    if (![x, z, h].every(Number.isFinite)) return false;
    if (p.role === 'seeker' && G.stage === 'hide') return false;            // eyes covered in the hut
    const gap = Math.max(.05, (now - p.repAt) / 1000), far = Math.hypot(x - p.x, z - p.z);
    const fair = far <= SPEED * 1.6 * Math.min(gap, 1) + 1.2 || p.role === 'ghost';
    p.repAt = now;
    if (!fair && p.bad++ < 8) return false;
    p.bad = 0;
    p.x = Math.max(-EDGE, Math.min(EDGE, x)); p.z = Math.max(-EDGE, Math.min(EDGE, z));
    if (!(p.lock && p.k >= 0)) p.h = h;
    return false;
  }
  if (a.t === 'copy') { // turn into thing number i (or a decoy, by token)
    if (p.role !== 'hider' || (G.stage !== 'hide' && G.stage !== 'seek')) return false;
    let k = -1, ox = 0, oz = 0;
    if (Number.isInteger(a.i) && PROPS[a.i]) { const q = PROPS[a.i]; k = KIND_LIST.indexOf(q[0]); ox = q[1]; oz = q[2]; }
    else if (Number.isInteger(a.d)) { const d = G.decoys.find(o => o.tok === a.d); if (d) { k = d.k; ox = d.x; oz = d.z; } }
    if (k < 0 || Math.hypot(ox - p.x, oz - p.z) > COPY_REACH + 1) return false;
    if (G.stage === 'seek') { if (p.copies <= 0) return false; p.copies--; }
    if (p.k === k) return false;
    p.k = k; G.dirty = true;
    pushEv(G, { t: 'cp', s, k, x: p.x, z: p.z });
    return true;
  }
  if (a.t === 'lock') {
    if (p.role !== 'hider' || p.k < 0) return false;
    p.lock = a.on ? 1 : 0; if (Number.isFinite(+a.h) && p.lock) p.h = +a.h / 100;
    G.dirty = true; return true;
  }
  if (a.t === 'sq') { // a squeak on purpose: brave, and worth a point (three a round)
    if (p.role !== 'hider' || G.stage !== 'seek' || now - p.sqAt < SQUEAK_WAIT) return false;
    p.sqAt = now; squeak(G, s, true);
    if (p.sqN < SQUEAK_MAX) { p.sqN++; G.pts[s] += PTS.squeak; G.stat[s].sq++; }
    return true;
  }
  if (a.t === 'boop') {
    if (p.role !== 'seeker' || G.stage !== 'seek' || now < p.dizzy) return false;
    let tx, tz, r, hit = -1;
    if (Number.isInteger(a.d)) {
      const h = G.pl.findIndex(q => q.role === 'hider' && q.tok === a.d);
      if (h >= 0) { hit = h; tx = G.pl[h].x; tz = G.pl[h].z; r = KINDS[KIND_LIST[G.pl[h].k]]?.r || .5; }
      else { const d = G.decoys.find(o => o.tok === a.d); if (!d) return false; tx = d.x; tz = d.z; r = KINDS[KIND_LIST[d.k]].r; }
    } else if (Number.isInteger(a.p) && PROPS[a.p]) { const q = PROPS[a.p]; tx = q[1]; tz = q[2]; r = KINDS[q[0]].r; }
    else return false;
    if (Math.hypot(tx - p.x, tz - p.z) > BOOP_REACH + r + 1) return false;
    if (hit >= 0) catchHider(G, s, hit, now);
    else { p.dizzy = now + DIZZY_MS; pushEv(G, { t: 'm', s, x: tx, z: tz }); G.dirty = true; }
    return true;
  }
  if (a.t === 'sniff') { // the seeker's pet sniffs the air: how close is the nearest hider?
    if (p.role !== 'seeker' || G.stage !== 'seek' || now < p.sniffAt) return false;
    let d = 1e9;
    for (const q of G.pl) if (q.role === 'hider') d = Math.min(d, dist(p, q));
    const lv = d < SNIFF_R / 3 ? 3 : d < SNIFF_R * 2 / 3 ? 2 : d < SNIFF_R ? 1 : 0;
    p.sniffAt = now + SNIFF_S * 1000; p.sniff = { lv, n: (p.sniff?.n || 0) + 1 };
    pushEv(G, { t: 'sn', s, lv, only: s });
    return true;
  }
  return false;
}

export function tick() { return false; } // fast() does the work

// A person who drops out keeps their seat: a hider stays put as whatever they were; a seeker's round may end early.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.dirty = true;
  const p = G.pl[s];
  if (away && p?.role === 'hider' && p.k < 0 && G.stage === 'hide') { botHide(G, p, []); }
  return true;
}

const qn = v => Math.round(v * Q);
export const ROLE = { hider: 0, seeker: 1, ghost: 2 };
export function view(G, s) {
  const now = Date.now(), me = s >= 0 ? G.pl[s] : null;
  const seeker = me?.role === 'seeker' && G.ph === 'play';
  const out = {
    game: 'copy', ph: G.ph, stage: G.stage, gid: G.gid, me: s, round: G.round, rounds: G.plan.length,
    left: Math.max(0, G.endsAt - now), seekS: G.opts.time, caught: G.opts.caught,
    role: G.pl.map(p => ROLE[p.role]), pts: G.pts, seekers: G.plan[G.round] || [],
    // people you can see as people: seekers to everyone; to everyone who is not seeking, hiders and ghosts too
    a: G.pl.map((p, i) => {
      if (p.role === 'seeker') return [qn(p.x), qn(p.z), Math.round(p.h * 100), now < p.dizzy ? 1 : 0];
      if (seeker && G.ph === 'play') return null;
      return [qn(p.x), qn(p.z), Math.round(p.h * 100), p.lock, p.k];
    }),
    res: G.res, sums: G.sums,
  };
  // the loose things that might be people: decoys and disguised hiders, all looking the same (none while seekers wait)
  if (!(seeker && G.stage === 'hide')) {
    const o = G.decoys.map(d => [d.tok, qn(d.x), qn(d.z), Math.round(d.h * 100), d.k]);
    if (seeker) for (const p of G.pl) if (p.role === 'hider' && p.k >= 0) o.push([p.tok, qn(p.x), qn(p.z), Math.round(p.h * 100), p.k]);
    out.o = o.sort((x, y) => x[0] - y[0]);
  }
  out.ev = G.ev.filter(e => now - e.at < EV_MS && (e.only === undefined || e.only === s)).map(({ at, only, ...e }) => {
    if (seeker && e.t === 'sq') return { t: 'sq', n: e.n, x: e.jx, z: e.jz };        // nudged, and no name
    if (seeker && e.t === 'cp') return null;                                         // a seeker never sees who copied what
    if (e.t === 'sq') { const { jx, jz, ...r } = e; return r; }
    return e;
  }).filter(Boolean);
  if (me) {
    out.my = { copies: me.copies, dizzy: Math.max(0, me.dizzy - now), sniff: me.sniff, sniffIn: Math.max(0, me.sniffAt - now),
      sqN: me.sqN, sqIn: Math.max(0, me.sqAt + SQUEAK_WAIT - now), nextSq: me.role === 'hider' && G.stage === 'seek' ? Math.max(0, me.nextSq - now) : -1 };
    if (me.role === 'hider' && G.stage === 'seek') out.my.lived = now - G.seekAt;
  }
  if (G.full || G.ph !== 'play' || s < 0) out.seats = G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id }));
  return out;
}

// Per-seat outcome: placement by points, a win for first.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i) + 1;
    return { pts: G.pts[i], win: place === 1, place };
  });
}

// for tests
export const _fast = fast;
export const _startSeek = startSeek;

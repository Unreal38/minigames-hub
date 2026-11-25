// Lantern Night: a hidden-roles party game on a small island at dusk. Everyone walks about as their avatar with one
// Pet Farm pet. Islanders do chores to fill the island's bar; one or two secret Sneaks lull people to sleep when nobody
// is near, crawl through hollow logs and play pranks. Finding a sleeper (or the bell at the campfire) calls everyone to
// a meeting: talk (the friends use voice), vote, and the most-voted player leaves on the ferry. Players who are out go
// on as their pet: they can still finish chores but nobody awake sees them.
// People only (no bots): Sneaks and islanders both need people to fool.
//
// Netcode as in Kart Island Race: each page walks its own player and reports where it is; fast() streams the table 20
// times a second, and every player's stream shows only what their own lantern lights up (a page can't peek).
import { SPECIES } from '../../public/games/farm/data.js';
import { STATIONS, ST, spotOf, CHORE_MS, LOGS, ROPES, ROPE_MS, DARK_FIX, MISCHIEF_WAIT, MISCHIEF_FIRST, LULL_WAIT, R_WALK, SPEED, GHOST_SPEED, BELL, REACH, LULL_REACH, REPORT_REACH,
  GLOW, GLOW_SNEAK, GLOW_DARK, ringAt, sneaksFor, TALK, CHORES, clampWalk } from '../../public/games/lantern/layout.js';

export const meta = { id: 'lantern', name: 'Lantern Night', minPlayers: 4, maxPlayers: 10, minHumans: 4, joinAt: 'game' };
// intro: the role card; news: who called the meeting and the pawprints; vote: after the talk; ferry: off it sails
export const MS = { intro: 6000, news: 4500, vote: 20000, ferry: 6500, bellWait: 15000 };
const EV_MS = 4000;

export function cleanOpts(o = {}) {
  return {
    sneaks: o.sneaks === 1 || o.sneaks === 2 || o.sneaks === '1' || o.sneaks === '2' ? +o.sneaks : 'auto',
    talk: TALK.includes(+o.talk) ? +o.talk : 45,
    chores: CHORES.includes(+o.chores) ? +o.chores : 5,
    lull: [20, 30, 45].includes(+o.lull) ? +o.lull : 30,
    reveal: o.reveal === 'none' ? 'none' : 'side',
    clues: o.clues === 'off' ? 'off' : 'on',
  };
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const BY_EL = {};
for (const [sp, d] of Object.entries(SPECIES)) if (!d.el2 && d.rare < 3) (BY_EL[d.el] ||= []).push(sp);
// Companion pets for the match: every element on the table is shared by at least two players (when there are enough
// players), so a pawprint clue narrows the suspects without ever naming one.
export function dealPets(n) {
  const els = shuffle(Object.keys(BY_EL)), m = Math.max(2, Math.min(els.length, Math.floor(n / 2)));
  const list = shuffle(Array.from({ length: n }, (_, i) => els[i % m]));
  const used = new Set();
  return list.map((el, i) => { const pool = BY_EL[el].filter(sp => !used.has(sp)); const sp = (pool.length ? pool : BY_EL[el])[Math.random() * (pool.length || BY_EL[el].length) | 0]; used.add(sp);
    return { sp, el, f: [0, 1, 2][(i + (Math.random() * 3 | 0)) % 3] }; });
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn), n = Math.min(players.length, meta.maxPlayers), now = Date.now();
  const seats = players.slice(0, n).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const k = sneaksFor(n, opts.sneaks), order = shuffle(seats.map((_, i) => i)), sneak = new Set(order.slice(0, k));
  const pets = dealPets(n), jobs = STATIONS.map((_, i) => i);
  const G = {
    game: 'lantern', ph: 'play', stage: 'intro', gid: Math.random().toString(36).slice(2, 8), seats, opts, tEnd: now + MS.intro, tAll: MS.intro,
    role: seats.map((_, i) => (sneak.has(i) ? 'sneak' : 'isle')), pet: pets,
    pos: seats.map((_, i) => { const [x, z] = ringAt(i, n); return { x, z, r: Math.atan2(-x, -z), at: now, bad: 0, j: 1 }; }),
    out: seats.map(() => 0), // 0 awake, 1 lulled (asleep), 2 ferried, 3 left the table
    jobs: seats.map(() => shuffle(jobs.slice()).slice(0, opts.chores).map(st => ({ st, done: false }))),
    doing: seats.map(() => null), bells: seats.map(() => 1), lullAt: seats.map(() => now + MS.intro + opts.lull * 1000), hopAt: seats.map(() => 0),
    beds: [], // sleepers: { s, x, z, by, clue: 'el' | 'size', found }
    lulls: 0, mis: null, misAt: now + MS.intro + MISCHIEF_FIRST, ropes: [-1, -1],
    meet: null, votes: seats.map(() => null), last: null, awakeMs: seats.map(() => 0),
    ev: [], evN: 0, res: null, win: null, endAt: 0, sendN: 0, dirty: true, last2: now, choresDone: seats.map(() => 0),
  };
  pushEv(G, { t: 'roles' }, now);
  return G;
}

function pushEv(G, e, now = Date.now()) { e.n = ++G.evN; e.at = now; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); G.dirty = true; }
const alive = (G, s) => G.out[s] === 0;
const isSneak = (G, s) => G.role[s] === 'sneak';
const near = (p, x, z, r) => Math.hypot(p.x - x, p.z - z) <= r;
const walking = G => G.stage === 'walk';
const glowOf = (G, s) => (G.out[s] ? 1e9 : isSneak(G, s) ? GLOW_SNEAK : G.mis?.k === 'dark' ? GLOW_DARK : GLOW);

// The island's chore bar: every islander's chores, done or not (players who are out still count and can still help).
export function bar(G) {
  let all = 0, done = 0;
  G.jobs.forEach((list, s) => { if (isSneak(G, s) || G.out[s] === 3) return; all += list.length; done += list.filter(j => j.done).length; });
  return [done, all];
}

function finish(G, side, why, now) {
  if (G.ph !== 'play') return;
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = side; G.mis = null;
  G.seats.forEach((_, s) => { if (!G.out[s]) G.awakeMs[s] = now; });
  G.res = { side, why, role: G.role.slice(), out: G.out.slice() };
  pushEv(G, { t: 'end', side, why }, now);
}
// Who has won, if anybody: every Sneak gone, the bar full, or as many Sneaks awake as islanders.
function check(G, now) {
  if (G.ph !== 'play') return;
  const up = s => alive(G, s);
  const sn = G.seats.filter((_, s) => up(s) && isSneak(G, s)).length, is = G.seats.filter((_, s) => up(s) && !isSneak(G, s)).length;
  if (!sn) return finish(G, 'isle', 'ferry', now);
  const [d, a] = bar(G); if (a && d >= a) return finish(G, 'isle', 'chores', now);
  if (sn >= is) return finish(G, 'sneak', 'many', now);
}
function goOut(G, s, how, now) { if (G.out[s]) return; G.out[s] = how; G.awakeMs[s] = now; G.doing[s] = null; if (G.ropes[0] === s) G.ropes[0] = -1; if (G.ropes[1] === s) G.ropes[1] = -1; }

function gather(G, now) { // everyone back round the fire (meetings): the pages take the new places from `j`
  const n = G.seats.length;
  G.seats.forEach((_, s) => { const [x, z] = ringAt(s, n); Object.assign(G.pos[s], { x, z, r: Math.atan2(-x, -z), at: now, bad: 0, j: G.pos[s].j + 1 }); G.doing[s] = null; });
}
function callMeeting(G, s, bed, now) {
  G.stage = 'meet'; G.meet = { by: s, bed: bed ? G.beds.indexOf(bed) : -1, part: 'news', at: now };
  G.tEnd = now + MS.news; G.tAll = MS.news; G.votes = G.seats.map(() => null);
  for (const b of G.beds) b.found = true;
  G.mis = null; G.ropes = [-1, -1]; // a meeting fixes the pranks
  gather(G, now);
  pushEv(G, { t: 'meet', s, bed: bed ? bed.s : -1 }, now);
}
function closeVote(G, now) {
  const tally = new Map(); let skip = 0;
  G.seats.forEach((_, s) => { if (!alive(G, s)) return; const v = G.votes[s]; if (v === -1 || v === null) skip++; else tally.set(v, (tally.get(v) || 0) + 1); });
  let top = -1, best = 0, tie = false;
  for (const [t, n] of tally) { if (n > best) { best = n; top = t; tie = false; } else if (n === best) tie = true; }
  const gone = !tie && best > skip ? top : -1; // a tie, or more skips than the most-voted, sends nobody away
  G.last = { gone, tally: G.seats.map((_, s) => tally.get(s) || 0), skip, votes: G.votes.slice(), side: gone >= 0 && G.opts.reveal !== 'none' ? G.role[gone] : null };
  if (gone >= 0) goOut(G, gone, 2, now);
  G.stage = 'ferry'; G.tEnd = now + MS.ferry; G.tAll = MS.ferry; G.meet = null;
  pushEv(G, { t: 'ferry', s: gone }, now);
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  // nobody left to play with: a table with fewer than three people still here ends as it stands
  G.seats.forEach((x, s) => { if (!x.human && G.out[s] !== 3) { const was = G.out[s]; G.out[s] = 3; if (!was) G.awakeMs[s] = now; G.dirty = true; } });
  if (G.seats.filter((x, s) => x.human).length < 3) { finish(G, null, 'empty', now); return out(G); }
  if (G.stage === 'intro' && now >= G.tEnd) { G.stage = 'walk'; G.tEnd = 0; pushEv(G, { t: 'go' }, now); }
  if (G.stage === 'walk') {
    if (G.mis?.k === 'ropes') {
      if (G.ropes[0] >= 0 && G.ropes[1] >= 0) { pushEv(G, { t: 'fixed', k: 'ropes' }, now); G.mis = null; G.ropes = [-1, -1]; G.misAt = now + MISCHIEF_WAIT; }
      else if (now >= G.mis.until) finish(G, 'sneak', 'ferry-gone', now);
    }
    check(G, now);
  } else if (G.stage === 'meet') {
    const m = G.meet;
    if (m.part === 'news' && now >= G.tEnd) { m.part = 'talk'; G.tEnd = now + G.opts.talk * 1000; G.tAll = G.opts.talk * 1000; G.dirty = true; }
    else if (m.part === 'talk' && now >= G.tEnd) { m.part = 'vote'; G.tEnd = now + MS.vote; G.tAll = MS.vote; G.dirty = true; }
    else if (m.part !== 'news') {
      const all = G.seats.every((x, s) => !alive(G, s) || !x.human || x.bot || G.votes[s] !== null);
      if (all || (m.part === 'vote' && now >= G.tEnd)) closeVote(G, now);
    }
  } else if (G.stage === 'ferry' && now >= G.tEnd) {
    G.stage = 'walk'; G.tEnd = 0; G.beds = G.beds.filter(b => !b.found); G.last = null;
    G.seats.forEach((_, s) => { G.lullAt[s] = now + G.opts.lull * 1000; });
    G.misAt = Math.max(G.misAt, now + MISCHIEF_FIRST);
    pushEv(G, { t: 'go' }, now);
    check(G, now);
  }
  return out(G);
}
function out(G) { G.full = G.dirty || ++G.sendN % 20 === 0; const send = G.dirty || G.sendN % 2 === 0; G.dirty = false; return send; } // ten updates a second, more when something happens

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  const now = Date.now(), p = G.pos[s], me = alive(G, s), sneak = isSneak(G, s);
  if (a.t === 'p') { // where I am now
    if (G.stage !== 'walk' || G.out[s] === 3) return false;
    let x = +a.x, z = +a.z; const r = +a.r;
    if (![x, z, r].every(Number.isFinite) || (a.j | 0) !== p.j) return false; // a step from before a meeting moved you: ignored
    const gap = Math.max(.05, (now - p.at) / 1000), far = Math.hypot(x - p.x, z - p.z), fair = far <= (me ? SPEED : GHOST_SPEED) * 1.5 * Math.min(gap, 1) + 1.2;
    p.at = now;
    if (!fair && p.bad < 8) { p.bad++; return false; } // a page can only have walked so far since its last report
    p.bad = 0;
    if (me) [x, z] = clampWalk(x, z); else { const d = Math.hypot(x, z); if (d > R_WALK + 4) { x *= (R_WALK + 4) / d; z *= (R_WALK + 4) / d; } }
    p.x = x; p.z = z; p.r = r;
    if (G.doing[s] && !near(p, ...spotOf(STATIONS[G.doing[s].st]), REACH + .8)) G.doing[s] = null; // walked away from the chore
    if (G.mis?.k === 'ropes') for (const i of [0, 1]) if (G.ropes[i] === s && !near(p, ...ROPES[i], REACH + .6)) { G.ropes[i] = -1; G.dirty = true; }
    return false; // the stream carries it to everyone
  }
  if (a.t === 'cs' || a.t === 'cd') { // a chore: started, done
    if (!walking(G)) return false;
    const i = a.i | 0, job = G.jobs[s][i]; if (!job || job.done) return false;
    if (!near(p, ...spotOf(STATIONS[job.st]), REACH + .6)) return false;
    if (a.t === 'cs') { G.doing[s] = { i, st: job.st, at: now }; return false; }
    const d = G.doing[s]; if (!d || d.i !== i || now - d.at < CHORE_MS[STATIONS[job.st].kind] - 150) return false;
    G.doing[s] = null; job.done = true; if (!sneak) G.choresDone[s]++;
    if (job.st === ST[DARK_FIX] && G.mis?.k === 'dark' && !sneak) { G.mis = null; G.misAt = now + MISCHIEF_WAIT; pushEv(G, { t: 'fixed', k: 'dark', s }, now); }
    if (!sneak) check(G, now); // a Sneak's list is only for show: their chores fill nothing
    G.dirty = true; return true;
  }
  if (!me || !walking(G)) { // the rest is for players who are awake, out on the island
    if (a.t === 'vote' && G.stage === 'meet' && G.meet.part !== 'news' && me) {
      const v = a.s === -1 ? -1 : a.s | 0; if (v !== -1 && (!G.seats[v] || !alive(G, v))) return false;
      if (G.votes[s] !== null) return false; // a vote can't be taken back
      G.votes[s] = v; pushEv(G, { t: 'voted', s }, now); return true;
    }
    return false;
  }
  if (a.t === 'relight') { // the lighthouse is out: relight it at the lighthouse (any islander, a short hold)
    if (G.mis?.k !== 'dark' || sneak || !near(p, ...spotOf(STATIONS[ST[DARK_FIX]]), REACH + .6)) return false;
    G.mis = null; G.misAt = now + MISCHIEF_WAIT; pushEv(G, { t: 'fixed', k: 'dark', s }, now); return true;
  }
  if (a.t === 'rope') { // hold a mooring rope (on: true) or let go
    if (G.mis?.k !== 'ropes' || sneak) return false;
    const i = a.i ? 1 : 0;
    if (a.on === false) { if (G.ropes[i] !== s) return false; G.ropes[i] = -1; return true; }
    if (!near(p, ...ROPES[i], REACH + .4) || G.ropes[i] >= 0 || G.ropes[1 - i] === s) return false;
    G.ropes[i] = s; return true;
  }
  if (a.t === 'bell') { // the meeting bell at the campfire: once each a game, not during a prank
    if (G.bells[s] < 1 || G.mis || !near(p, ...BELL, REACH + .4) || now - lastGo(G) < MS.bellWait) return false;
    G.bells[s]--; callMeeting(G, s, null, now); return true;
  }
  if (a.t === 'ring') { // found a sleeper: everyone to the fire
    const b = G.beds.find(b => !b.found && near(p, b.x, b.z, REPORT_REACH + .4)); if (!b) return false;
    callMeeting(G, s, b, now); return true;
  }
  if (!sneak) return false;
  if (a.t === 'lull') { // a Sneak puts someone to sleep: close by, and not too often
    const t = a.s | 0;
    if (!G.seats[t] || t === s || !alive(G, t) || isSneak(G, t) || now < G.lullAt[s] || !near(p, G.pos[t].x, G.pos[t].z, LULL_REACH + .5)) return false;
    goOut(G, t, 1, now); G.lullAt[s] = now + G.opts.lull * 1000; G.lulls++;
    G.beds.push({ s: t, x: G.pos[t].x, z: G.pos[t].z, by: s, clue: G.lulls % 2 ? 'el' : 'size', found: false });
    pushEv(G, { t: 'lull', s: t, by: s }, now);
    check(G, now); return true;
  }
  if (a.t === 'hop') { // crawl into a hollow log, pop out of the next one
    const i = LOGS.findIndex(l => near(p, l[0], l[1], REACH + .5)); if (i < 0 || now < G.hopAt[s]) return false;
    const [x, z] = LOGS[(i + (a.back ? LOGS.length - 1 : 1)) % LOGS.length], d = Math.hypot(x, z) || 1;
    Object.assign(p, { x: x - x / d * 1.4, z: z - z / d * 1.4, at: now, j: p.j + 1 }); G.hopAt[s] = now + 2500; G.doing[s] = null; G.dirty = true; return true;
  }
  if (a.t === 'prank') { // put the lighthouse out, or untie the ferry
    if (G.mis || now < G.misAt || !['dark', 'ropes'].includes(a.k)) return false;
    G.mis = { k: a.k, by: s, at: now, until: a.k === 'ropes' ? now + ROPE_MS : 0 }; G.ropes = [-1, -1];
    pushEv(G, { t: 'prank', k: a.k }, now); return true;
  }
  return false;
}
// when the last walk began (the bell waits a little after the start and after each meeting)
function lastGo(G) { for (let i = G.ev.length - 1; i >= 0; i--) if (G.ev[i].t === 'go') return G.ev[i].at; return 0; }

export function tick() { return false; } // fast() does the work

// The table chat (server.js hooks): players who are awake may type only during a meeting's talk and vote; players who
// are out (and watchers) talk among themselves at any time, and nobody awake reads them.
const ghostly = (G, s) => s < 0 || G.out[s] > 0;
export function chatOk(G, s) { return ghostly(G, s) || (G.stage === 'meet' && G.meet?.part !== 'news'); }
export function chatSee(G, from, to) { return !ghostly(G, from) || ghostly(G, to); }
export const chatShut = () => 'The chat opens at meetings. Talk on voice, or find a sleeper and ring the bell.';

// A player who drops out just stands where they are (nobody plays for them); a player who leaves the table is out.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.dirty = true; if (away) G.doing[s] = null;
  return true;
}
// Someone who left and comes back gets their seat back only while it is still theirs to play.
export const canReturn = (G, s) => G.out[s] !== 3;

const r1 = v => Math.round(v * 10) / 10;
export function view(G, s) {
  const now = Date.now(), end = G.ph === 'end', me = s >= 0 && G.seats[s] ? s : -1, ghost = me < 0 || G.out[me] > 0 || end;
  const sneak = me >= 0 && isSneak(G, me), mp = me >= 0 ? G.pos[me] : null, glow = me >= 0 ? glowOf(G, me) + 3 : 1e9;
  // where everybody is: people who are out only show to others who are out (and watchers); everyone else only within your glow
  const at = G.pos.map((p, i) => {
    if (i === me) return [r1(p.x), r1(p.z), Math.round(p.r * 10), G.out[i]];
    if (G.out[i] === 3) return null;
    if (G.out[i] && !ghost) return null;
    if (!ghost && G.stage === 'walk' && mp && !near(mp, p.x, p.z, glow)) return null;
    return [r1(p.x), r1(p.z), Math.round(p.r * 10), G.out[i] === 1 ? 2 : G.out[i]]; // asleep players walk on as pets: shown like ferried ones
  });
  const showBed = b => b.found || ghost || (mp && near(mp, b.x, b.z, glow)) || (sneak && G.stage === 'walk');
  const out = {
    game: 'lantern', ph: G.ph, stage: G.stage, gid: G.gid, me, opts: G.opts, left: G.tEnd ? Math.max(0, G.tEnd - now) : 0, all: G.tAll,
    at, beds: G.beds.filter(showBed).map(b => [b.s, r1(b.x), r1(b.z), b.found ? 1 : 0]),
    out: G.seats.map((_, i) => (G.out[i] && (ghost || G.out[i] !== 1 || G.beds.some(b => b.s === i && b.found)) ? G.out[i] : 0)), // a sleeper nobody found yet still counts as awake for the others
    bar: bar(G), mis: G.mis ? { k: G.mis.k, left: G.mis.until ? Math.max(0, G.mis.until - now) : 0, ropes: G.ropes } : null,
    meet: G.meet ? { by: G.meet.by, part: G.meet.part, bed: G.meet.bed >= 0 && G.beds[G.meet.bed] ? clueOf(G, G.beds[G.meet.bed]) : null } : null,
    voted: G.votes.map(v => v !== null), last: G.last ? { ...G.last, votes: G.stage === 'ferry' || end ? G.last.votes : null } : null,
    pet: G.pet, ev: G.ev.filter(e => now - e.at < EV_MS && evFor(G, e, me, sneak)).map(({ at, by, ...e }) => (sneak || end ? { ...e, by } : e)),
    res: end ? { ...G.res, chores: G.choresDone } : null, win: G.win,
  };
  if (me >= 0) {
    out.you = { role: G.role[me], j: G.pos[me].j, jobs: G.jobs[me].map(j => [j.st, j.done ? 1 : 0]), doing: G.doing[me]?.i ?? -1, bell: G.bells[me], vote: G.votes[me],
      lull: Math.max(0, G.lullAt[me] - now), hop: Math.max(0, G.hopAt[me] - now), prank: Math.max(0, G.misAt - now), glow: glowOf(G, me) };
    if (sneak) out.you.team = G.role.map((r, i) => (r === 'sneak' ? i : -1)).filter(i => i >= 0);
  }
  if (end) out.role = G.role; // the end screen shows everyone's role
  if (G.full || G.ph !== 'play' || G.stage !== 'walk') out.seats = G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id }));
  return out;
}
// Who hears about what: a lull only reaches the Sneaks (and the sleeper); the rest is for everyone.
function evFor(G, e, me, sneak) { if (e.t === 'lull') return sneak || me === e.s || G.ph === 'end'; return true; }
// What the pawprints by a found sleeper say about the Sneak who did it (one trait, never the name).
function clueOf(G, b) { if (G.opts.clues === 'off') return { s: b.s }; const p = G.pet[b.by]; return { s: b.s, clue: b.clue, el: b.clue === 'el' ? p.el : null, f: b.clue === 'size' ? p.f : null }; }

// Winners share first place; everyone else is placed by how long they stayed awake. Points: a win plus chores done.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const won = s => G.win && G.role[s] === G.win, t0 = G.ev.find(e => e.t === 'go')?.at || G.endAt;
  const stay = G.seats.map((_, s) => (G.out[s] ? G.awakeMs[s] : G.endAt) - t0);
  return G.seats.map((_, s) => {
    const place = won(s) ? 1 : 1 + G.seats.filter((_, o) => won(o)).length + G.seats.filter((_, o) => !won(o) && o !== s && stay[o] > stay[s]).length;
    return { pts: (won(s) ? 100 : 0) + G.choresDone[s] * 10, win: won(s), place };
  });
}

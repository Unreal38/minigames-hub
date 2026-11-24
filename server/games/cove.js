// Cove Clash: the classic guessing game with boats. Each of the two players hides a fleet in their own bay, then
// they take turns lobbing a coconut at a square of the other bay. A hit gives another shot; a boat with every
// square hit sinks and the water round it is marked. The first to sink the whole rival fleet wins.
// Boards and placing rules are in public/games/cove/rules.js. An empty seat is played by a bot.
import { BOARDS, boardOf, cellsOf, around, validFleet, randomFleet, fleetMap, SEA, MISS, HIT, CLEAR } from '../../public/games/cove/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'cove', name: 'Cove Clash', minPlayers: 1, maxPlayers: 2, seats: { fixed: 2 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// setup: seconds to arrange your boats. go: pause between "both ready" and the first shot. shot: how long a coconut
// flies (nobody can fire again before it lands).
const FAST = Math.max(1, +process.env.COVE_FAST || 1); // tests run the table faster
export const MS = { setup: 60000, go: 1600 / FAST, shot: 1150 / FAST };
const rnd = (a, b) => (a + Math.random() * (b - a)) / FAST;

export function cleanOpts(o = {}) {
  return {
    board: Object.hasOwn(BOARDS, o.board) ? o.board : 'classic',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 10, 20, 30].includes(+o.timer) ? +o.timer : 20,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn), B = boardOf(opts.board);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, 2).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = BOT_COLS.filter(c => !taken.has(c)).sort(() => Math.random() - .5);
  let bi = 0;
  while (seats.length < 2) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const now = Date.now();
  const G = {
    game: 'cove', ph: 'play', stage: 'setup', gid: Math.random().toString(36).slice(2, 8), seats, opts, n: B.n, lens: B.fleet.slice(),
    boats: seats.map(() => randomFleet(opts.board).map(b => ({ ...b, hits: 0, sunk: false }))), map: null,
    sea: seats.map(() => Array(B.n * B.n).fill(SEA)), // sea[s]: what has landed in seat s's bay
    ready: seats.map(s => s.bot), setupEnd: now + MS.setup, stageEnd: 0,
    starter: Math.random() < .5 ? 0 : 1, turn: -1, mv: 0, last: null, tEnd: 0, botAt: 0, lockAt: 0,
    st: seats.map(() => ({ shots: 0, hits: 0, sunk: 0, auto: 0, streak: 0, best: 0 })),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  if (G.ready.every(Boolean)) begin(G, now);
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
function begin(G, now) {
  G.stage = 'go'; G.stageEnd = now + MS.go; G.setupEnd = 0;
  G.map = G.boats.map(f => fleetMap(f, G.n));
  pushEv(G, { t: 'start', s: G.starter });
}
function setTurn(G, i, now, wait = 0) {
  G.turn = i; G.lockAt = now + wait;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + wait + G.opts.timer * 1000 : 0;
  G.botAt = now + wait + rnd(650, 1300);
}

// Seat s lobs a coconut at square c of the other bay.
function fire(G, s, c, now, auto = false) {
  const o = 1 - s, sea = G.sea[o];
  if (!Number.isInteger(c) || c < 0 || c >= sea.length || sea[c] !== SEA) return false;
  const st = G.st[s], bi = G.map[o][c];
  G.mv++; st.shots++; if (auto) st.auto++;
  let r = 'miss', boat = null, cleared = [];
  if (bi < 0) { sea[c] = MISS; st.streak = 0; }
  else {
    const b = G.boats[o][bi];
    sea[c] = HIT; b.hits++; st.hits++; st.streak++; st.best = Math.max(st.best, st.streak); r = 'hit';
    if (b.hits >= b.len) {
      b.sunk = true; st.sunk++; r = 'sunk'; boat = { c: b.c, len: b.len, v: b.v, i: bi };
      for (const x of around(cellsOf(b, G.n), G.n)) if (sea[x] === SEA) { sea[x] = CLEAR; cleared.push(x); }
    }
  }
  G.last = { s, c, r, mv: G.mv, boat, cleared };
  pushEv(G, { t: 'fire', s, c, r, boat });
  if (G.boats[o].every(b => b.sunk)) return finish(G, s, now);
  setTurn(G, r === 'miss' ? o : s, now, MS.shot);
  return true;
}
function finish(G, w, now) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = now; G.win = w;
  G.res = { left: G.boats.map(f => f.filter(b => !b.sunk).length), shots: G.st.map(x => x.shots) };
  pushEv(G, { t: 'end', w });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  if (G.stage === 'setup') {
    if (a.t === 'layout') { // the boats as [square, across or down] pairs, in the order of the board's fleet
      if (G.ready[s] || !Array.isArray(a.boats) || a.boats.length !== G.lens.length) return false;
      const boats = a.boats.map((b, i) => (Array.isArray(b) ? { c: b[0], len: G.lens[i], v: b[1] ? 1 : 0, hits: 0, sunk: false } : null));
      if (!validFleet(boats, G.opts.board)) return false;
      G.boats[s] = boats; return true;
    }
    if (a.t === 'ready') {
      const on = a.on !== false; if (G.ready[s] === on) return false;
      G.ready[s] = on;
      if (G.ready.every(Boolean)) begin(G, Date.now());
      return true;
    }
    return false;
  }
  if (G.stage !== 'play' || G.turn !== s || a.t !== 'fire' || Date.now() < G.lockAt) return false;
  return fire(G, s, a.c, Date.now());
}

// ---------- bots ----------
// chill: shoots at random; once it has hit a boat it keeps after it only some of the time (chase), and it never
//   works out which squares cannot hold a boat.
// sharp: counts, for every square, how many ways the boats still afloat could lie across it, and shoots where that
//   is highest. A boat it has hit is finished off first.
export const BOTS = { chill: { chase: .75 }, sharp: {} };

const nb4 = (c, n) => { const r = c / n | 0, q = c % n, out = []; if (r > 0) out.push(c - n); if (r < n - 1) out.push(c + n); if (q > 0) out.push(c - 1); if (q < n - 1) out.push(c + 1); return out; };
// Squares hit on boats that are still afloat.
function openHits(G, o) {
  const out = [];
  G.sea[o].forEach((x, c) => { if (x === HIT && !G.boats[o][G.map[o][c]].sunk) out.push(c); });
  return out;
}
// The sensible next squares when a boat has been hit: the ends of the line of hits, or all four sides of a lone hit.
function chase(G, o) {
  const n = G.n, sea = G.sea[o], hits = openHits(G, o), set = new Set(hits), out = new Set();
  for (const c of hits) {
    const line = nb4(c, n).filter(x => set.has(x));
    for (const x of nb4(c, n)) {
      if (sea[x] !== SEA) continue;
      if (!line.length || line.some(y => Math.abs(y - c) === Math.abs(x - c))) out.add(x); // carry on along the line
    }
  }
  return [...out];
}
export function chillShot(G, s, B = BOTS.chill) {
  const o = 1 - s, sea = G.sea[o];
  const next = chase(G, o);
  if (next.length && Math.random() < B.chase) return next[Math.random() * next.length | 0];
  const free = []; sea.forEach((x, c) => { if (x === SEA) free.push(c); });
  return free.length ? free[Math.random() * free.length | 0] : -1;
}
export function sharpShot(G, s) {
  const o = 1 - s, n = G.n, sea = G.sea[o], hits = openHits(G, o), hitSet = new Set(hits);
  // no boat can lie on a square that touches a hit at a corner, or beside a line of hits
  const dead = new Set();
  for (const c of hits) { const r = c / n | 0, q = c % n; for (const [dr, dq] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { const rr = r + dr, qq = q + dq; if (rr >= 0 && rr < n && qq >= 0 && qq < n) dead.add(rr * n + qq); } }
  const left = G.boats[o].filter(b => !b.sunk).map(b => b.len), score = Array(n * n).fill(0);
  for (const len of left) for (let v = 0; v < (len > 1 ? 2 : 1); v++) for (let r = 0; r < (v ? n - len + 1 : n); r++) for (let q = 0; q < (v ? n : n - len + 1); q++) {
    const cells = []; let ok = true, on = 0;
    for (let i = 0; i < len && ok; i++) { const c = v ? (r + i) * n + q : r * n + q + i; const x = sea[c]; if (hitSet.has(c)) on++; else if (x !== SEA || dead.has(c)) ok = false; cells.push(c); }
    if (!ok) continue;
    if (hits.length && !on) { if (cells.some(c => nb4(c, n).some(x => hitSet.has(x)))) continue; } // would touch the boat being chased
    const w = on ? 40 ** on : 1;
    for (const c of cells) if (!hitSet.has(c)) score[c] += w;
  }
  let top = 0; const best = [];
  score.forEach((v, c) => { if (sea[c] !== SEA || v <= 0) return; if (v > top * 1.0001) { top = v; best.length = 0; best.push(c); } else if (v >= top * .9999) best.push(c); });
  if (best.length) return best[Math.random() * best.length | 0];
  return chillShot(G, s, { chase: 1 });
}
function botShot(G, s, now, level = G.opts.bots, auto = false) {
  let c = level === 'sharp' ? sharpShot(G, s) : chillShot(G, s);
  if (c < 0 || G.sea[1 - s][c] !== SEA) c = G.sea[1 - s].indexOf(SEA);
  return c >= 0 && fire(G, s, c, now, auto);
}
export { botShot as _bot, fire as _fire };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'setup') { // out of time: whoever is not ready sails with the boats as they lie
    if (now < G.setupEnd) return false;
    G.ready = G.ready.map(() => true); begin(G, now); return true;
  }
  if (G.stage === 'go') { if (now < G.stageEnd) return false; G.stage = 'play'; setTurn(G, G.starter, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; return botShot(G, s, now); }
  if (G.tEnd && now >= G.tEnd) return botShot(G, s, now, 'chill', true); // out of time: a random shot is taken for you
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  const now = Date.now();
  if (G.stage === 'setup' && away && !G.ready[s]) { G.ready[s] = true; if (G.ready.every(Boolean)) begin(G, now); }
  if (G.turn === s && G.stage === 'play') { G.botAt = Math.max(G.lockAt, now) + 800; G.tEnd = away || !G.opts.timer ? 0 : now + G.opts.timer * 1000; }
  return true;
}

// Everyone sees what has landed in both bays. You see your own boats; the other fleet shows only its sunk boats
// until the game is over. Watchers see sunk boats only, so nobody can peek for a friend.
export function view(G, s) {
  const now = Date.now(), over = G.ph === 'end';
  const pub = b => ({ c: b.c, len: b.len, v: b.v, sunk: b.sunk });
  return {
    game: 'cove', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, timer: G.opts.timer, botsLevel: G.opts.bots,
    board: G.opts.board, n: G.n, lens: G.lens, starter: G.starter, ms: MS,
    setupLeft: G.stage === 'setup' ? Math.max(0, G.setupEnd - now) : 0,
    tLeft: G.stage === 'play' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    lock: G.stage === 'play' ? Math.max(0, G.lockAt - now) : 0,
    ready: G.ready, sea: G.sea,
    boats: G.boats.map((f, i) => (i === s || over ? f.map(pub) : G.stage === 'setup' ? [] : f.map(b => (b.sunk ? pub(b) : null)))),
    left: G.boats.map(f => f.filter(b => !b.sunk).map(b => b.len)),
    last: G.last,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// One point for every rival square hit. A person whose every shot was taken by the timer earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.st[i].hits, win: G.win === i, idle: x.human && G.st[i].shots === G.st[i].auto }));
}

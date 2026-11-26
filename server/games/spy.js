// Spyglass Isle: everyone looks at the same busy picture card full of Pet Farm pets and hunts the one shown at the
// top. The first correct tap takes the card; a wrong tap makes you dizzy for a moment. Most cards at the end wins,
// ties go to the quicker total finding time. Cards come from one seed (rules.js), so every browser draws the same
// card; the server only needs the hunted pet's spot to judge taps, in the order they arrive.
import { SIZE, FIND_MS, REVEAL_MS, COUNT_MS, LOAD_MS, DIZZY_MS, CARDS, makePool, makeCard, hits } from '../../public/games/spy/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'spy', name: 'Spyglass Isle', minPlayers: 1, maxPlayers: 8, seats: { lo: 1, def: 4 }, joinAt: 'game' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// lo..hi: how long a bot looks before it finds the pet (ms, on the first card; busier cards take up to `busy` x longer);
// miss: how often it never spots it
export const BOT = { chill: { lo: 9000, hi: 27000, busy: 1.4, miss: .2 }, sharp: { lo: 5000, hi: 17000, busy: 1.3, miss: .06 } };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    cards: CARDS.includes(+o.cards) ? +o.cards : CARDS[0],
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
  const seed = (Math.random() * 2 ** 31) | 0, now = Date.now();
  return {
    game: 'spy', ph: 'play', stage: 'load', gid: Math.random().toString(36).slice(2, 8), seats, opts, seed,
    M: makePool(seed, opts.cards), n: -1, card: null, at: now, found: -1, beat: 0,
    x: seats.map(() => ({ c: 0, ms: 0, dz: 0, rdy: false, plan: -1, taps: 0 })),
    ev: [], evN: 0, res: null, win: -1, dirty: true,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 30) G.ev.shift(); }
const playing = (G, s) => G.seats[s].human && !G.seats[s].bot; // a person at the controls right now

// When (ms into the card) a bot finds the pet, or -1 when it never does.
export function botPlan(lvl, n, cards) {
  if (Math.random() < lvl.miss) return -1;
  const p = cards > 1 ? n / (cards - 1) : 0;
  return Math.round((lvl.lo + Math.random() * (lvl.hi - lvl.lo)) * (1 + (lvl.busy - 1) * p));
}

function deal(G, now) {
  G.n++; G.card = makeCard(G.seed, G.n, G.opts.cards, G.M); G.stage = 'find'; G.at = now; G.found = -1;
  G.x.forEach((x, s) => { x.dz = 0; x.plan = playing(G, s) ? -1 : botPlan(BOT[G.seats[s].human ? 'chill' : G.opts.bots], G.n, G.opts.cards); });
  pushEv(G, { t: 'card', c: G.n }); G.dirty = true;
}
function take(G, s, now) {
  const ms = Math.max(0, now - G.at);
  if (s >= 0) { G.x[s].c++; G.x[s].ms += ms; }
  G.found = s; G.stage = 'reveal'; G.at = now;
  pushEv(G, { t: 'f', s, c: G.n, ms }); G.dirty = true;
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const t = now - G.at;
  if (G.stage === 'load') {
    if (t >= LOAD_MS || G.seats.every((p, s) => !playing(G, s) || G.x[s].rdy)) { G.stage = 'count'; G.at = now; pushEv(G, { t: 'count' }); G.dirty = true; }
  } else if (G.stage === 'count') {
    if (t >= COUNT_MS) deal(G, now);
  } else if (G.stage === 'find') {
    let best = -1;
    G.x.forEach((x, s) => { if (!playing(G, s) && x.plan >= 0 && x.plan <= t && (best < 0 || x.plan < G.x[best].plan)) best = s; });
    if (best >= 0) take(G, best, G.at + G.x[best].plan);
    else if (t >= FIND_MS) take(G, -1, G.at + FIND_MS);
  } else if (G.stage === 'reveal') {
    if (t >= REVEAL_MS) { if (G.n + 1 >= G.opts.cards) finish(G, now); else deal(G, now); }
  }
  return flush(G, now);
}
function flush(G, now) {
  if (now - G.beat > 1000) G.dirty = true; // a steady beat keeps every browser's clock right
  const d = G.dirty; if (d) G.beat = now; G.dirty = false; return d;
}

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => G.x[b].c - G.x[a].c || (G.x[b].c ? G.x[a].ms - G.x[b].ms : 0) || a - b);
  const place = []; order.forEach((s, i) => { place[s] = i + 1; });
  G.ph = 'end'; G.stage = 'end'; G.at = now; G.win = order[0];
  G.res = { order, place, c: G.x.map(x => x.c), ms: G.x.map(x => x.ms), cards: G.opts.cards };
  pushEv(G, { t: 'end', w: G.win }); G.dirty = true;
}

// ---------- what people send ----------
// { t: 'rdy' }: this browser has drawn the pets. { t: 'tap', c: card number, x, y }: a tap on the card, in card units.
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || !playing(G, s) || G.ph !== 'play') return false;
  const x = G.x[s], now = Date.now();
  if (a.t === 'rdy') { if (!x.rdy) { x.rdy = true; G.dirty = true; } return false; }
  if (a.t !== 'tap' || G.stage !== 'find' || a.c !== G.n || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return false;
  if (a.x < 0 || a.y < 0 || a.x > SIZE || a.y > SIZE || now < x.dz) return false;
  if (hits(G.card, a.x, a.y)) take(G, s, now);
  else { x.dz = now + DIZZY_MS; x.taps++; pushEv(G, { t: 'dz', s }); G.dirty = true; }
  return false; // fast() sends it on its next beat
}

export function tick() { return false; } // fast() does the work

// A player who drops out keeps their cards; a bot hunts for them until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.x[s].rdy = true;
  if (away && G.stage === 'find') G.x[s].plan = Math.max(Date.now() - G.at + 2000, botPlan(BOT.chill, G.n, G.opts.cards));
  else G.x[s].plan = -1;
  G.dirty = true;
  return true;
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'spy', ph: G.ph, stage: G.stage, gid: G.gid, me: s, seed: G.seed, cards: G.opts.cards, n: G.n, t: now - G.at, found: G.found,
    seats: G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    x: G.x.map(x => [x.c, x.ms, now < x.dz ? x.dz - now : 0, x.rdy ? 1 : 0]),
    ev: G.ev, res: G.res, win: G.win,
  };
}

// Per-seat outcome: placed by cards found, then by quicker total time; points are the cards.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: G.x[i].c, win: G.res.place[i] === 1, place: G.res.place[i] }));
}

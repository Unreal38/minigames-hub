// Pet Pairs: a turn-based memory game with Pet Farm pet cards for 2 to 6 players. Flip two face-down cards: the
// same pet and you keep the pair and flip again, different pets and they turn back and the next player goes.
// Everyone sees every flip. Three special pairs (on by default) do something extra: Golden is worth 3 points,
// Spyglass lets you peek at one card nobody else sees, Whirlwind swaps two pairs of face-down cards while everyone
// watches. The most points when the last pair is found wins; equal points share the place.
// Nobody is ever sent the pet under a face-down card, except the one player peeking at it with the Spyglass.
import { BOARDS, TWISTS, ptsOf, TIMERS, boardOf } from '../../public/games/pairs/rules.js';
import { SPECIES } from '../../public/games/farm/data.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'pairs', name: 'Pet Pairs', minPlayers: 1, maxPlayers: 6, seats: { lo: 2, def: 4 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// deal; both cards of a miss stay up; a found pair is shown before the next flip; time to choose a card to peek at
// (when the table has no timer); how long the peeked card stays up for its peeker; the Whirlwind's swaps
export const MS = { deal: 2400, show: 1600, got: 1500, spy: 15000, peek: 1900, mix: 1700 };
export const PETS = Object.keys(SPECIES); // every species can turn up, so every board looks different

const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOf = a => a[Math.random() * a.length | 0];

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    board: ['auto', ...Object.keys(BOARDS)].includes(o.board) ? o.board : 'auto',
    timer: TIMERS.includes(+o.timer) ? +o.timer : 10,
    twists: o.twists === 'off' || o.twists === false ? 'off' : 'on',
    streak: +o.streak === 3 ? 3 : 0, // 0: match and go again for as long as you keep finding pairs; 3: at most 3 pairs a turn
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  const n = Math.max(opts.seats, seats.length, 2);
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const board = boardOf(opts.board, n), [w, h] = BOARDS[board], pairs = w * h / 2;
  const pets = shuffle([...PETS]).slice(0, pairs), tw = {};
  if (opts.twists === 'on') TWISTS.forEach((k, j) => { tw[pets[j]] = k; });
  const sp = shuffle(pets.flatMap(p => [p, p]));
  const now = Date.now();
  return {
    game: 'pairs', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts, board, w, h,
    sp, tw: sp.map(p => tw[p] || ''), got: sp.map(() => -1), up: [], left: pairs,
    score: seats.map(() => 0), st: seats.map(() => ({ pairs: 0, flips: 0, best: 0, gold: 0 })),
    mem: seats.map(() => ({})), // what each seat's bot remembers: card -> pet (people's seats too, for when a bot plays for them)
    turn: Math.random() * n | 0, streak: 0, peek: null, mv: 0, last: null,
    stageEnd: now + MS.deal, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const down = G => G.sp.map((_, i) => i).filter(i => G.got[i] < 0 && !G.up.includes(i));

// ---------- bots ----------
// see: how likely a bot is to remember a card it saw; forget: the chance each remembered card slips its mind
// every turn; slip: the chance it flips a random card even though it knows a pair
export const BOTS = {
  chill: { see: .45, forget: .14, slip: .2, think: [900, 1500] },
  sharp: { see: .8, forget: .05, slip: .04, think: [650, 1100] },
};
const bot = (G, level = G.opts.bots) => (typeof level === 'object' ? level : BOTS[level] || BOTS.chill);
const lv = (G, k) => bot(G, G.lvl?.[k]); // G.lvl: a level per seat (tests pit chill against sharp)
function seen(G, i) { G.seats.forEach((_, k) => { if (Math.random() < lv(G, k).see) G.mem[k][i] = G.sp[i]; }); }
function forget(G, s) { const B = lv(G, s), m = G.mem[s]; for (const i in m) if (G.got[i] >= 0 || Math.random() < B.forget) delete m[i]; }
// The card a bot flips next: the other half of a pet it remembers, else a card it has never seen.
function botPick(G, s, level) {
  const B = bot(G, level ?? G.lvl?.[s]), m = G.mem[s], free = down(G);
  const known = i => m[i] !== undefined && G.got[i] < 0 && !G.up.includes(i);
  const unseen = free.filter(i => m[i] === undefined);
  const fresh = () => pickOf(unseen.length ? unseen : free);
  if (Math.random() < B.slip) return fresh();
  if (G.up.length === 1) { const a = G.up[0], twin = free.find(i => known(i) && m[i] === G.sp[a]); return twin ?? fresh(); }
  const by = {};
  for (const i of free) if (known(i)) { if (by[m[i]] !== undefined) return by[m[i]]; by[m[i]] = i; }
  return fresh();
}
export function botStep(G, s, now, level) {
  if (G.stage === 'spy') { const free = down(G), unseen = free.filter(i => G.mem[s][i] === undefined); return doPeek(G, s, pickOf(unseen.length ? unseen : free), now); }
  if (G.stage === 'pick') return doFlip(G, s, botPick(G, s, level), now);
  return false;
}
export { botStep as _bot };

// ---------- turns ----------
function startPick(G, s, now, fresh) {
  if (fresh) { G.turn = s; G.streak = 0; forget(G, s); }
  G.stage = 'pick'; G.up = []; G.late = -1;
  G.tEnd = G.opts.timer && !G.seats[s].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(...bot(G).think);
  return true;
}
const nextSeat = G => (G.turn + 1) % G.seats.length;

function doFlip(G, s, i, now) {
  if (G.stage !== 'pick' || !Number.isInteger(i) || i < 0 || i >= G.sp.length || G.got[i] >= 0 || G.up.includes(i)) return false;
  G.up.push(i); G.mv++; G.st[s].flips++;
  pushEv(G, { t: 'flip', s, i, sp: G.sp[i], tw: G.tw[i] });
  seen(G, i);
  if (G.up.length < 2) { G.botAt = now + rnd(...bot(G).think) * .8; return true; }
  const [a, b] = G.up;
  if (G.sp[a] === G.sp[b]) {
    const pts = ptsOf(G.tw[a]);
    G.got[a] = G.got[b] = s; G.left--; G.score[s] += pts; G.streak++;
    const st = G.st[s]; st.pairs++; st.best = Math.max(st.best, G.streak); if (G.tw[a] === 'gold') st.gold++;
    G.last = { t: 'pair', s, sp: G.sp[a], mv: G.mv };
    pushEv(G, { t: 'pair', s, i: a, j: b, sp: G.sp[a], tw: G.tw[a], pts, streak: G.streak });
    G.stage = 'got'; G.stageEnd = now + MS.got; G.tEnd = 0;
  } else {
    G.last = { t: 'miss', s, mv: G.mv };
    pushEv(G, { t: 'miss', s, i: a, j: b });
    G.stage = 'show'; G.stageEnd = now + MS.show; G.tEnd = 0;
  }
  return true;
}
// after a found pair: its twist, then the same player again (or the next one, once the streak cap is reached)
function afterPair(G, now) {
  if (!G.left) return finish(G);
  const [a] = G.up, s = G.turn, kind = G.tw[a];
  G.up = [];
  if (kind === 'spy' && down(G).length) {
    G.stage = 'spy'; G.tEnd = G.seats[s].bot ? 0 : now + spyMs(G);
    G.botAt = now + rnd(900, 1500); pushEv(G, { t: 'spying', s });
    return true;
  }
  if (kind === 'mix') return whirl(G, s, now);
  return carryOn(G, now);
}
const spyMs = G => (G.opts.timer ? Math.max(8, G.opts.timer) * 1000 : MS.spy); // never unlimited, so a peek can't stall the table
function carryOn(G, now) {
  if (G.opts.streak && G.streak >= G.opts.streak) { pushEv(G, { t: 'cap', s: G.turn }); return startPick(G, nextSeat(G), now, true); }
  return startPick(G, G.turn, now, false);
}
function doPeek(G, s, i, now) {
  if (G.stage !== 'spy' || G.turn !== s || !Number.isInteger(i) || i < 0 || i >= G.sp.length || G.got[i] >= 0) return false;
  G.peek = { s, i, until: now + MS.peek }; G.mem[s][i] = G.sp[i]; // the peeker remembers it, bot or not
  pushEv(G, { t: 'spy', s, i });
  G.stage = 'peek'; G.stageEnd = now + MS.peek; G.tEnd = 0;
  return true;
}
// Whirlwind: two swaps of face-down cards. Everyone sees which cards move; a bot keeps track as well as it remembers.
function whirl(G, s, now) {
  const free = shuffle(down(G));
  if (free.length < 4) return carryOn(G, now);
  const sw = [[free[0], free[1]], [free[2], free[3]]];
  for (const [a, b] of sw) {
    [G.sp[a], G.sp[b]] = [G.sp[b], G.sp[a]]; [G.tw[a], G.tw[b]] = [G.tw[b], G.tw[a]];
    G.mem.forEach((m, k) => {
      const x = m[a], y = m[b]; delete m[a]; delete m[b];
      if (Math.random() < lv(G, k).see) { if (y !== undefined) m[a] = y; if (x !== undefined) m[b] = x; }
    });
  }
  pushEv(G, { t: 'mix', s, sw });
  G.stage = 'mix'; G.stageEnd = now + MS.mix; G.tEnd = 0;
  return true;
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.up = []; G.peek = null; G.endAt = Date.now();
  const n = G.seats.length;
  const order = G.seats.map((_, i) => i).sort((a, b) => G.score[b] - G.score[a] || G.st[b].pairs - G.st[a].pairs || a - b);
  const place = G.seats.map((_, i) => 1 + G.seats.filter((__, j) => G.score[j] > G.score[i]).length); // equal points share the place
  G.win = order[0];
  G.res = { order, place, score: G.score.slice(), n };
  pushEv(G, { t: 'end', w: G.win, tie: place.filter(p => p === 1).length > 1 });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.turn !== s) return false;
  const now = Date.now();
  if (a.t === 'flip') return doFlip(G, s, a.i, now);
  if (a.t === 'peek') return doPeek(G, s, a.i, now);
  return false;
}

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const s = G.turn;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; return startPick(G, s, now, true); }
  if (G.stage === 'show') {
    if (now < G.stageEnd) return false;
    pushEv(G, { t: 'back', i: G.up[0], j: G.up[1] });
    return startPick(G, nextSeat(G), now, true);
  }
  if (G.stage === 'got') { if (now < G.stageEnd) return false; return afterPair(G, now); }
  if (G.stage === 'peek' || G.stage === 'mix') { if (now < G.stageEnd) return false; G.peek = null; return carryOn(G, now); }
  if (G.seats[s].bot) { if (now < G.botAt) return false; return botStep(G, s, now); }
  if (G.tEnd && now >= G.tEnd) { // out of time: random cards are flipped for you
    if (G.stage === 'spy') return doPeek(G, s, pickOf(down(G)), now);
    if (!G.up.length) pushEv(G, { t: 'late', s });
    doFlip(G, s, pickOf(down(G)), now);
    if (G.stage === 'pick') { G.tEnd = 0; G.botAt = now + 500; G.late = s; }
    return true;
  }
  if (G.late === s && G.stage === 'pick' && G.up.length === 1 && now >= G.botAt) { G.late = -1; return doFlip(G, s, pickOf(down(G)), now); }
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.ph === 'play' && (G.stage === 'pick' || G.stage === 'spy')) {
    G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000;
    if (!away && G.stage === 'spy') G.tEnd = Date.now() + spyMs(G);
  }
  return true;
}

export function view(G, s) {
  const now = Date.now(), end = G.ph === 'end';
  const show = i => G.got[i] >= 0 || G.up.includes(i) || end;
  return {
    game: 'pairs', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, streak: G.streak,
    timer: G.opts.timer, botsLevel: G.opts.bots, twists: G.opts.twists, cap: G.opts.streak, board: G.board, w: G.w, h: G.h,
    tLeft: (G.stage === 'pick' || G.stage === 'spy') && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    dealLeft: G.stage === 'deal' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    // each card: null while face down, else [pet, twist]; who holds it once it is found
    face: G.sp.map((p, i) => (show(i) ? [p, G.tw[i]] : null)), got: G.got, up: G.up, left: G.left,
    peek: G.peek && G.peek.s === s ? { i: G.peek.i, sp: G.sp[G.peek.i], tw: G.tw[G.peek.i] } : null, // only the peeker sees the pet
    peekAt: G.peek ? G.peek.i : -1, last: G.last,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, score: G.score[i], st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// 10 points for every player you finished ahead of; everyone sharing first place wins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => { const place = G.res.place[i]; return { pts: (n - place) * 10, win: place === 1, place }; });
}

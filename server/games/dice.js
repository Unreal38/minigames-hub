// Liar's Dice: everyone rolls in secret under a cup, then bids go round the table on how many dice of one face
// there are in total. Call "Liar!" on a bid you don't believe: all cups lift, and whoever was wrong loses a die.
// Last player with dice wins. Nobody is ever sent another player's dice until the cups lift.
import { FACES, matches, countFace, legal, lowest, atLeast, chance } from '../../public/games/dice/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'dice', name: "Liar's Dice", minPlayers: 1, maxPlayers: 6, joinAt: 'round' };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { roll: 2300, lift: 1500, each: 260, after: 3800 }; // shake the cups; lift them; count each match; read the result

const rnd = (a, b) => a + Math.random() * (b - a);
const d6 = () => 1 + (Math.random() * 6 | 0);

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4, 5, 6].includes(+o.seats) ? +o.seats : 4,
    dice: [3, 5].includes(+o.dice) ? +o.dice : 5,
    wild: o.wild === 'off' ? 'off' : 'on',
    spot: o.spot === 'off' ? 'off' : 'on',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 20, 30, 45].includes(+o.timer) ? +o.timer : 30,
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
  while (seats.length < Math.max(2, opts.seats)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length;
  const G = {
    game: 'dice', ph: 'play', stage: 'roll', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    wild: opts.wild === 'on', spot: opts.spot === 'on',
    left: seats.map(() => opts.dice), dice: seats.map(() => []), out: seats.map(() => 0), bustN: 0,
    st: seats.map(() => ({ bids: 0, calls: 0, right: 0, lost: 0 })),
    round: 0, turn: -1, starter: Math.random() * n | 0, bid: null, hist: [], show: null, rollAt: 0,
    stageEnd: 0, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  startRound(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
const alive = (G, i) => G.left[i] > 0;
const total = G => G.left.reduce((a, b) => a + b, 0);
const nextFrom = (G, i) => { const n = G.seats.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (alive(G, j)) return j; } return -1; };

function startRound(G, now) {
  if (G.left.filter(x => x > 0).length < 2) return finish(G);
  seatQueued(G);
  G.round++; G.bid = null; G.hist = []; G.show = null;
  G.dice = G.left.map(k => Array.from({ length: k }, d6).sort((a, b) => a - b));
  if (!alive(G, G.starter)) G.starter = nextFrom(G, G.starter);
  G.stage = 'roll'; G.turn = G.starter; G.rollAt = now; G.stageEnd = now + MS.roll; G.tEnd = 0;
  pushEv(G, { t: 'round', k: G.round, s: G.starter });
}

function setTurn(G, i, now) {
  G.turn = i;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(1200, 2600);
}

function doBid(G, s, q, f, now) {
  if (!legal(G.bid, q, f, total(G), G.wild)) return false;
  G.bid = { q, f, s }; G.hist.push({ s, q, f }); G.st[s].bids++;
  pushEv(G, { t: 'bid', s, q, f });
  setTurn(G, nextFrom(G, s), now);
  return true;
}

// kind 'liar': the caller says there are fewer than the bid. kind 'spot': the caller says there are exactly that many.
function doCall(G, s, kind, now) {
  const b = G.bid; if (!b || (kind === 'spot' && !G.spot)) return false;
  const count = countFace(G.dice, b.f, G.wild);
  let right, lose;
  if (kind === 'liar') { right = count < b.q; lose = [right ? b.s : s]; }
  else { right = count === b.q; lose = right ? G.seats.map((_, i) => i).filter(i => i !== s && alive(G, i)) : [s]; }
  G.st[s].calls++; if (right) G.st[s].right++;
  G.show = { kind, caller: s, bidder: b.s, q: b.q, f: b.f, count, right, lose, at: now };
  G.stage = 'show'; G.turn = -1; G.tEnd = 0;
  G.stageEnd = now + MS.lift + count * MS.each + MS.after;
  pushEv(G, { t: 'call', s, kind, bidder: b.s, q: b.q, f: b.f, count, right, lose });
  return true;
}

function endShow(G, now) {
  const sh = G.show;
  for (const i of sh.lose) {
    G.left[i]--; G.st[i].lost++;
    if (!G.left[i]) { G.out[i] = ++G.bustN; pushEv(G, { t: 'out', s: i }); }
  }
  // whoever lost a die opens the next round; after a spot-on call it is the caller
  G.starter = sh.lose.length === 1 ? sh.lose[0] : sh.caller;
  startRound(G, now);
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = Date.now();
  const order = G.seats.map((_, i) => i).sort((a, b) => (G.out[a] ? 1 : 0) - (G.out[b] ? 1 : 0) || G.out[b] - G.out[a] || G.left[b] - G.left[a]);
  G.win = order[0];
  G.res = { order, rounds: G.round, left: [...G.left] };
  pushEv(G, { t: 'end', w: G.win });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage !== 'bid' || G.turn !== s) return false;
  const now = Date.now();
  if (a.t === 'bid') return doBid(G, s, +a.q, +a.f, now);
  if (a.t === 'liar' || a.t === 'spot') return doCall(G, s, a.t, now);
  return false;
}

// ---------- bots ----------
// A bot knows its own dice and works out how likely a bid is from the dice it can't see.
// fuzz: how badly it misjudges the odds; push: how much it would rather raise than call; lean: how much it
// believes faces other players keep bidding; wide: how far its opening bids stray; wild: how often it opens on a bluff.
export const BOTS = {
  chill: { fuzz: .13, push: .12, lean: 0, lo: .4, hi: 1.1, bluff: .2, spot: .5 },
  sharp: { fuzz: .04, push: .22, lean: .8, lo: .55, hi: .9, bluff: .08, spot: .44 },
};
function botMove(G, s, now, level = G.opts.bots) {
  const B = typeof level === 'object' ? level : BOTS[level] || BOTS.chill;
  const wild = G.wild, mine = G.dice[s], all = total(G), m = all - mine.length;
  const own = f => mine.filter(v => matches(v, f, wild)).length;
  const lean = f => Math.min(B.lean * 3, new Set(G.hist.filter(h => h.s !== s && h.f === f).map(h => h.s)).size * B.lean);
  const pTrue = (q, f) => atLeast(Math.ceil(q - own(f) - lean(f)), m, chance(f, wild));
  const b = G.bid;
  if (!b) { // opening bid: the face it holds most of, at a number that is probably there
    const fs = FACES(wild);
    let f = fs.reduce((best, x) => (own(x) + Math.random() * .5 > own(best) + Math.random() * .5 ? x : best), fs[0]);
    if (Math.random() < B.bluff) f = fs[Math.random() * fs.length | 0]; // now and then, a face it does not have
    const q = Math.max(1, Math.min(all, Math.round(own(f) + m * chance(f, wild) * rnd(B.lo, B.hi))));
    return doBid(G, s, q, f, now);
  }
  const pt = pTrue(b.q, b.f) + rnd(-B.fuzz, B.fuzz);
  let best = null;
  for (const f of FACES(wild)) for (let q = b.q; q <= Math.min(all, b.q + 2); q++) {
    if (!legal(b, q, f, all, wild)) continue;
    const p = pTrue(q, f) + rnd(-B.fuzz, B.fuzz) - (q - b.q) * .02;
    if (!best || p > best.p) best = { q, f, p };
  }
  if (G.spot && all >= 4) { // "spot on" only when the number is very likely exactly right
    const need = Math.ceil(b.q - own(b.f)), ex = atLeast(need, m, chance(b.f, wild)) - atLeast(need + 1, m, chance(b.f, wild));
    if (ex > B.spot && Math.random() < .7) return doCall(G, s, 'spot', now);
  }
  if (!best || 1 - pt > best.p + B.push) return doCall(G, s, 'liar', now);
  return doBid(G, s, best.q, best.f, now);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'roll') { if (now < G.stageEnd) return false; G.stage = 'bid'; setTurn(G, G.turn, now); return true; }
  if (G.stage === 'show') { if (now < G.stageEnd) return false; endShow(G, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; botMove(G, s, now); return true; }
  if (G.tEnd && now >= G.tEnd) { botMove(G, s, now, 'chill'); return true; } // out of time: a careful bot plays the turn
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.stage === 'bid') { G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

// Someone watching can take over a bot that still has dice, from the next round.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  const n = G.queue.length;
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return G.queue.length !== n || on;
}
function seatQueued(G) {
  while (G.queue.length) {
    const free = G.seats.map((_, i) => i).filter(i => !G.seats[i].human && alive(G, i)).sort((a, b) => G.left[b] - G.left[a]);
    if (!free.length) break;
    const p = G.queue.shift(), i = free[0];
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now(), open = G.stage === 'show' || G.ph === 'end';
  return {
    game: 'dice', ph: G.ph, stage: G.stage, gid: G.gid, me: s, round: G.round, turn: G.turn, starter: G.starter,
    wild: G.wild, spot: G.spot, start: G.opts.dice, total: total(G), timer: G.opts.timer, botsLevel: G.opts.bots,
    tLeft: G.stage === 'bid' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    rollAgo: now - G.rollAt, ms: MS,
    bid: G.bid, hist: G.hist,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.left[i], out: G.out[i], st: G.st[i],
      dice: i === s || open ? G.dice[i] : null, // your own dice only, until the cups lift
    })),
    show: G.show && { ...G.show, ago: now - G.show.at },
    res: G.res, win: G.win, ev: G.ev, queued: G.queue.map(q => q.id),
  };
}

// 10 points for every player you outlasted, plus 2 for each die the winner still holds.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + G.left[i] * 2, win: place === 0, place: place + 1 };
  });
}

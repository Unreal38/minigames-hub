// Tysiąc ("Thousand"), the Polish card game for three: bid for the right to play, take the three face-down
// cards (the musik), announce king-queen marriages to set trumps, and be first to 1000 points.
// With four at the table the dealer sits the hand out. Nobody is ever sent another player's cards.
import { DECK, MELD, SUITS, MIN_BID, STEP, suitOf, power, value, queen, king, ace, ten, hasMeld, melds, canMeld, maxBid, round10, FOLD_PAY, FOLDS, sortHand, beats, winnerOf, legal } from '../../public/games/tys/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'tys', name: 'Tysiąc', minPlayers: 1, maxPlayers: 4, seats: { only: [3, 4], def: 3 }, joinAt: 'round' };

const BOT_NAMES = ['Zosia', 'Franek', 'Jagoda', 'Staszek', 'Hania', 'Antek', 'Basia', 'Kazik'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { deal: 2200, take: 3200, trick: 1500, score: 7500 }; // deal the cards; show the musik; look at a finished trick; read the hand's scores
export const MAX_HANDS = 60; // a table of stubborn players still ends: the highest score wins then

const rnd = (a, b) => a + Math.random() * (b - a);
const sum = a => a.reduce((x, y) => x + y, 0);

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    target: [500, 1000].includes(+o.target) ? +o.target : 1000,
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 20, 30, 45].includes(+o.timer) ? +o.timer : 30,
    fold: FOLDS.includes(o.fold) ? o.fold : FOLDS[0],
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
  while (seats.length < Math.max(3, opts.seats)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length;
  const G = {
    game: 'tys', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    target: opts.target, barrel: opts.target * .8,
    score: seats.map(() => 0), st: seats.map(() => ({ played: 0, made: 0, melds: 0 })),
    hand: 0, dealer: Math.random() * n | 0, active: [], hands: seats.map(() => []), musik: [], got: [],
    bid: null, passed: [], said: [], decl: -1, contract: 0, trump: -1, trick: [], lead: -1, turn: -1,
    pts: [], tricks: [], mel: [], gone: [], lastTrick: null, log: [], sum: null,
    stageAt: 0, stageEnd: 0, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  startHand(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const nextIn = (G, s) => G.active[(G.active.indexOf(s) + 1) % G.active.length];
const setStage = (G, stage, now, ms = 0) => { G.stage = stage; G.stageAt = now; G.stageEnd = ms ? now + ms : 0; };

function startHand(G, now) {
  seatQueued(G);
  const n = G.seats.length;
  G.hand++; G.dealer = (G.dealer + 1) % n;
  G.active = G.seats.map((_, i) => i).filter(i => n === 3 || i !== G.dealer);
  // the three who play, in order, starting with the player after the dealer
  const first = G.active.find(i => i > G.dealer) ?? G.active[0];
  while (G.active[0] !== first) G.active.push(G.active.shift());
  const deck = DECK.slice();
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
  G.hands = G.seats.map(() => []);
  G.active.forEach((s, k) => { G.hands[s] = deck.slice(k * 7, k * 7 + 7); });
  G.musik = deck.slice(21); G.got = [];
  G.bid = { v: MIN_BID, s: first }; // the first player has to take the hand for 100 if nobody bids more
  G.passed = G.seats.map(() => false); G.said = G.seats.map(() => null); G.said[first] = MIN_BID;
  G.decl = -1; G.contract = 0; G.trump = -1; G.trick = []; G.lead = -1; G.turn = -1; G.feel = G.seats.map(() => rnd(-1, 1));
  G.pts = G.seats.map(() => 0); G.tricks = G.seats.map(() => 0); G.mel = G.seats.map(() => []); G.gone = []; G.lastTrick = null; G.sum = null;
  setStage(G, 'deal', now, MS.deal); G.tEnd = 0;
  pushEv(G, { t: 'deal', k: G.hand, d: G.dealer });
}

function setTurn(G, s, now) {
  G.turn = s;
  G.tEnd = G.opts.timer && !G.seats[s].bot ? now + G.opts.timer * 1000 * (G.stage === 'give' ? 2 : 1) : 0; // twice as long to sort out the musik
  G.botAt = now + rnd(900, 1900);
}

// ---------- bidding ----------
function afterBid(G, s, now) {
  const left = G.active.filter(i => !G.passed[i]);
  if (left.length > 1) { let t = nextIn(G, s); while (G.passed[t]) t = nextIn(G, t); return setTurn(G, t, now); }
  G.decl = G.bid.s; G.contract = G.bid.v; G.turn = -1; G.tEnd = 0;
  setStage(G, 'take', now, MS.take); // the musik is turned face up for everyone
  pushEv(G, { t: 'won', s: G.decl, v: G.contract });
}
function doBid(G, s, v, now) {
  if (!Number.isInteger(v) || v % STEP || v <= G.bid.v || v > maxBid(G.hands[s])) return false;
  G.bid = { v, s }; G.said[s] = v;
  pushEv(G, { t: 'bid', s, v });
  afterBid(G, s, now); return true;
}
function doPass(G, s, now) {
  G.passed[s] = true; G.said[s] = 'pass';
  pushEv(G, { t: 'pass', s });
  afterBid(G, s, now); return true;
}

// ---------- the musik ----------
// The declarer hands one card to each opponent (cs[0] to the next player, cs[1] to the one after) and may raise the contract.
function doGive(G, s, cs, v, now) {
  const hand = G.hands[s];
  if (!Array.isArray(cs) || cs.length !== 2 || cs[0] === cs[1] || !cs.every(c => hand.includes(c))) return false;
  const keep = hand.filter(c => !cs.includes(c));
  v = v === undefined ? G.contract : v;
  if (!Number.isInteger(v) || v % STEP || v < G.contract || (v > G.contract && v > maxBid(keep))) return false;
  G.hands[s] = keep; let t = s;
  for (const c of cs) { t = nextIn(G, t); G.hands[t].push(c); }
  G.contract = v; G.said[s] = v; G.st[s].played++;
  G.lead = s; setStage(G, 'play', now); setTurn(G, s, now);
  pushEv(G, { t: 'give', s, v });
  return true;
}

// The declarer may fold instead ("bomba"), if the table allows it: nothing is played, they score nothing and each
// opponent scores 60. With the 'free' option a player's first fold of the match pays the others nothing.
const foldMode = G => G.opts.fold || 'on'; // tables started before the option existed always paid 60
export const foldPay = (G, s) => (foldMode(G) === 'off' ? -1 : foldMode(G) === 'free' && !G.st[s].folds ? 0 : FOLD_PAY);
function doFold(G, s, now) {
  const pay = foldPay(G, s); if (pay < 0) return false;
  const delta = G.seats.map(() => 0);
  for (const i of G.active) if (i !== s) delta[i] = Math.max(0, Math.min(pay, G.barrel - G.score[i]));
  G.st[s].played++; G.st[s].folds = (G.st[s].folds || 0) + 1;
  G.seats.forEach((_, i) => { G.score[i] += delta[i]; });
  G.sum = { hand: G.hand, decl: s, contract: G.contract, made: false, fold: true, free: !pay, pts: [...G.pts], delta, score: [...G.score], active: [...G.active] };
  G.log.push({ decl: s, contract: G.contract, made: false, fold: true, free: !pay, took: 0, delta }); if (G.log.length > 80) G.log.shift();
  G.turn = -1; G.tEnd = 0; setStage(G, 'score', now, MS.score);
  pushEv(G, { t: 'fold', s, v: G.contract });
  return true;
}

// ---------- tricks ----------
// Leading the king or queen of a suit you hold both of always announces the marriage.
function doPlay(G, s, c, now) {
  const hand = G.hands[s], cards = G.trick.map(x => x.c);
  if (!legal(hand, cards, G.trump).includes(c)) return false;
  if (!cards.length && canMeld(hand, c)) { // "meldunek": the suit is trumps from now on
    const su = suitOf(c);
    G.mel[s].push(su); G.pts[s] += MELD[su]; G.trump = su; G.st[s].melds++;
    pushEv(G, { t: 'meld', s, su, v: MELD[su] });
  }
  hand.splice(hand.indexOf(c), 1); G.trick.push({ s, c }); G.gone.push(c);
  pushEv(G, { t: 'play', s, c });
  if (G.trick.length < G.active.length) { setTurn(G, nextIn(G, s), now); return true; }
  const w = G.trick[winnerOf(G.trick.map(x => x.c), G.trump)].s;
  G.lastTrick = { cards: G.trick.slice(), w, pts: sum(G.trick.map(x => value(x.c))) };
  G.turn = -1; G.tEnd = 0; setStage(G, 'trick', now, MS.trick);
  return true;
}
function endTrick(G, now) {
  const { w, pts } = G.lastTrick;
  G.pts[w] += pts; G.tricks[w]++; G.trick = [];
  pushEv(G, { t: 'trick', w, pts });
  if (G.hands[w].length) { G.lead = w; setStage(G, 'play', now); setTurn(G, w, now); } else scoreHand(G, now);
}

// The declarer scores the contract, made or not. The others score what they took, rounded to tens,
// but from the barrel (800) on, points only come from playing a contract.
function scoreHand(G, now) {
  const d = G.decl, made = G.pts[d] >= G.contract, delta = G.seats.map(() => 0);
  for (const i of G.active) {
    if (i === d) delta[i] = made ? G.contract : -G.contract;
    else delta[i] = Math.max(0, Math.min(round10(G.pts[i]), G.barrel - G.score[i]));
  }
  if (made) G.st[d].made++;
  G.seats.forEach((_, i) => { G.score[i] += delta[i]; });
  G.sum = { hand: G.hand, decl: d, contract: G.contract, made, pts: [...G.pts], delta, score: [...G.score], active: [...G.active] };
  G.log.push({ decl: d, contract: G.contract, made, took: G.pts[d], delta }); if (G.log.length > 80) G.log.shift();
  G.turn = -1; G.tEnd = 0; setStage(G, 'score', now, MS.score);
  pushEv(G, { t: 'score', s: d, made, v: G.contract });
}
function afterScore(G, now) {
  if (G.score.some(x => x >= G.target) || G.hand >= MAX_HANDS) return finish(G);
  startHand(G, now);
}
function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = Date.now();
  const order = G.seats.map((_, i) => i).sort((a, b) => G.score[b] - G.score[a] || G.st[b].made - G.st[a].made || a - b);
  G.win = order[0]; G.res = { order, hands: G.hand, score: [...G.score] };
  pushEv(G, { t: 'end', w: G.win });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.turn !== s) return false;
  const now = Date.now();
  if (G.stage === 'bid') return a.t === 'bid' ? doBid(G, s, a.v, now) : a.t === 'pass' ? doPass(G, s, now) : false;
  if (G.stage === 'give') return a.t === 'give' ? doGive(G, s, a.c, a.v, now) : a.t === 'fold' ? doFold(G, s, now) : false;
  if (G.stage === 'play') return a.t === 'play' ? doPlay(G, s, a.c, now) : false;
  return false;
}

// ---------- bots ----------
// How many points a hand should take if its owner plays the contract.
export function estimate(hand) {
  let est = 0; const ms = [];
  for (const s of SUITS) {
    const len = hand.filter(c => suitOf(c) === s).length; if (!len) continue;
    const A = hand.includes(ace(s)), T = hand.includes(ten(s));
    if (A) est += 17;
    if (T) est += A ? 14 : len >= 3 ? 8 : 2;
    if (hasMeld(hand, s)) { ms.push(MELD[s]); est += 6; } else if (hand.includes(king(s)) || hand.includes(queen(s))) est += 1;
    if (len >= 4) est += (len - 3) * (A ? 9 : 5);
  }
  ms.sort((a, b) => b - a).forEach((v, k) => { est += v * (k ? .55 : 1); }); // the first marriage is certain: you lead first
  return est;
}
export const BOTS = {
  chill: { noise: 14, hope: 6, raise: 28, fold: 55, wild: .12 },   // bids by feel and sometimes plays any old card
  sharp: { noise: 4, hope: 16, raise: 12, fold: 40, wild: 0 },      // counts on what the musik usually adds, and raises a strong hand
};
const levelOf = (G, level) => (typeof level === 'object' ? level : BOTS[level] || BOTS.chill);

function botBid(G, s, now, B) {
  const hand = G.hands[s], want = Math.floor((estimate(hand) + B.hope + G.feel[s] * B.noise) / STEP) * STEP; // feel: this bot's mood for the hand
  const v = G.bid.v + STEP;
  return v <= want && v <= maxBid(hand) ? doBid(G, s, v, now) : doPass(G, s, now);
}
function botGive(G, s, now, B) {
  const hand = G.hands[s];
  const keepWorth = c => {
    const su = suitOf(c), len = hand.filter(x => suitOf(x) === su).length;
    return value(c) * 3 + len * 2 + (c === ace(su) ? 60 : 0) + (canMeld(hand, c) ? 90 : 0) + (c === ten(su) && !hand.includes(ace(su)) && len < 3 ? -12 : 0) + Math.random();
  };
  const cs = [...hand].sort((a, b) => keepWorth(a) - keepWorth(b)).slice(0, 2);
  if (Math.random() < .5) cs.reverse();
  const keep = hand.filter(c => !cs.includes(c));
  const pay = foldPay(G, s); // hopeless: cheaper to fold than to lose the contract (and a free fold is worth using sooner)
  if (B.fold && pay >= 0 && estimate(keep) < G.contract - (pay ? B.fold : B.fold / 2)) return doFold(G, s, now);
  let v = G.contract;
  if (B.raise) v = Math.max(v, Math.min(maxBid(keep), Math.floor((estimate(keep) - B.raise) / STEP) * STEP));
  return doGive(G, s, cs, v, now);
}
function botPlay(G, s, now, B) {
  const hand = G.hands[s], cards = G.trick.map(x => x.c), L = legal(hand, cards, G.trump);
  const low = list => list.reduce((a, c) => (value(c) + (canMeld(hand, c) ? 6 : 0) < value(a) + (canMeld(hand, a) ? 6 : 0) ? c : a));
  if (B.wild && Math.random() < B.wild) { const c = L[Math.random() * L.length | 0]; return doPlay(G, s, c, now); }
  // a card is a master when every stronger card of its suit has already been played
  const master = c => { for (let p = power(c) + 1; p <= 5; p++) { const x = suitOf(c) * 13 + [7, 9, 10, 11, 8, 12][p]; if (!G.gone.includes(x) && !hand.includes(x)) return false; } return true; };
  if (!cards.length) {
    const safe = c => G.trump < 0 || suitOf(c) === G.trump || !G.gone.some(x => suitOf(x) === suitOf(c)) || hand.every(x => suitOf(x) !== G.trump);
    const top = L.filter(c => master(c) && !canMeld(hand, c)).sort((a, b) => (suitOf(b) === G.trump) - (suitOf(a) === G.trump) || safe(b) - safe(a) || value(b) - value(a));
    const ms = melds(hand).sort((a, b) => MELD[b] - MELD[a]);
    if (top.length && (safe(top[0]) || !ms.length)) return doPlay(G, s, top[0], now);
    if (ms.length) return doPlay(G, s, hand.includes(ace(ms[0])) || G.gone.includes(ace(ms[0])) ? king(ms[0]) : queen(ms[0]), now);
    // nothing sure: get rid of a small card from the longest side suit
    const side = L.filter(c => suitOf(c) !== G.trump), pool = side.length ? side : L;
    const len = c => hand.filter(x => suitOf(x) === suitOf(c)).length;
    return doPlay(G, s, pool.reduce((a, c) => (len(c) - value(c) * .3 > len(a) - value(a) * .3 ? c : a)), now);
  }
  const best = cards[winnerOf(cards, G.trump)], win = L.filter(c => beats(c, best, G.trump));
  if (win.length) {
    const last = cards.length === G.active.length - 1;
    const c = last ? win.reduce((a, x) => (value(x) > value(a) ? x : a)) : win.find(master) ?? win.reduce((a, x) => (power(x) < power(a) ? x : a));
    return doPlay(G, s, c, now);
  }
  return doPlay(G, s, low(L), now);
}
function botMove(G, s, now, level = G.opts.bots) {
  const B = levelOf(G, level);
  if (G.stage === 'bid') return botBid(G, s, now, B);
  if (G.stage === 'give') return botGive(G, s, now, B);
  if (G.stage === 'play') return botPlay(G, s, now, B);
  return false;
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stageEnd) {
    if (now < G.stageEnd) return false;
    if (G.stage === 'deal') { setStage(G, 'bid', now); setTurn(G, nextIn(G, G.bid.s), now); }
    else if (G.stage === 'take') { G.got = G.musik; G.hands[G.decl].push(...G.musik); G.musik = []; setStage(G, 'give', now); setTurn(G, G.decl, now); }
    else if (G.stage === 'trick') endTrick(G, now);
    else if (G.stage === 'score') afterScore(G, now);
    return true;
  }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; botMove(G, s, now); return true; }
  if (G.tEnd && now >= G.tEnd) { // out of time: pass in the bidding, otherwise a careful bot plays the turn
    if (G.stage === 'bid') doPass(G, s, now); else botMove(G, s, now, { ...BOTS.sharp, raise: 0, fold: 0 });
    return true;
  }
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s) { G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

// Someone watching can take over a bot (and its score) when the next hand is dealt.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  const n = G.queue.length;
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return G.queue.length !== n || on;
}
function seatQueued(G) {
  while (G.queue.length) {
    const free = G.seats.map((_, i) => i).filter(i => !G.seats[i].human).sort((a, b) => G.score[b] - G.score[a]);
    if (!free.length) break;
    const p = G.queue.shift(), i = free[0];
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now(), mine = s >= 0 ? G.hands[s] : [], myTurn = G.turn === s && s >= 0;
  return {
    game: 'tys', ph: G.ph, stage: G.stage, gid: G.gid, me: s, hand: G.hand, dealer: G.dealer, active: G.active,
    target: G.target, barrel: G.barrel, timer: G.opts.timer, botsLevel: G.opts.bots, ms: MS, fold: foldMode(G), foldPay: s >= 0 ? foldPay(G, s) : -1,
    turn: G.turn, lead: G.lead, bid: G.bid, decl: G.decl, contract: G.contract, trump: G.trump,
    trick: G.trick, lastTrick: G.lastTrick, ago: now - G.stageAt,
    tLeft: G.tEnd && G.turn >= 0 ? Math.max(0, G.tEnd - now) : -1,
    musik: G.stage === 'take' ? G.musik : null, musikN: G.musik.length, // face down until someone has won the bidding
    got: s === G.decl && G.stage === 'give' ? G.got : null,
    maxBid: s >= 0 && G.active.includes(s) ? maxBid(mine) : 0,
    legal: myTurn && G.stage === 'play' ? legal(mine, G.trick.map(x => x.c), G.trump) : null,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      score: G.score[i], n: G.hands[i].length, pts: G.pts[i], tricks: G.tricks[i], mel: G.mel[i], said: G.said[i], passed: G.passed[i],
      sit: !G.active.includes(i), st: G.st[i],
      cards: i === s ? sortHand(G.hands[i]) : null, // your own cards only
    })),
    sum: G.stage === 'score' || G.ph === 'end' ? G.sum : null, log: G.log,
    res: G.res, win: G.win, ev: G.ev, queued: G.queue.map(q => q.id),
  };
}

export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: Math.max(0, G.score[i]), win: i === G.win, place: G.res.order.indexOf(i) + 1 }));
}

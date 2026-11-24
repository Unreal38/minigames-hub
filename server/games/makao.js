// Makao: the classic Polish shedding game with a standard 52-card deck. Match the top card's suit or rank, several
// cards of one rank may go down together. 2 and 3 make the next player draw, 4 makes them wait, a Jack demands a
// rank, an Ace changes the suit, the King of hearts gives 5 to the next player and the King of spades 5 to the one
// before you. With one card left you say "Makao!", with none "Po makale!", or anyone may catch you and you take 5.
// The first one out of cards wins and the rest are placed by cards left, or (table option) play goes on until one
// player is left holding cards. Nobody is ever sent another player's hand or drawn cards.
import { deck, rankOf, suitOf, fits, canPlay, playable, sameRank, sortHand, drawOf, isFight, isPlain, HAND, PENALTY, DEMANDS, FOUR, JACK, ACE, KS, KH } from '../../public/games/makao/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'makao', name: 'Makao', minPlayers: 1, maxPlayers: 6, seats: { lo: 2, def: 4 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { deal: 2400, kept: 10000, grace: 2600 }; // deal; time to decide on a drawn card; how long a forgotten call can be caught before a bot moves on
export const MAX_MOVES = 600; // a safety net only: then the table is called and placed by cards left

const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    queens: o.queens === true || o.queens === 'on' ? 'on' : 'off', // Queen on everything, everything on the Queen
    end: o.end === 'last' ? 'last' : 'first',                      // the game ends when the first player is out, or goes on to the last one holding cards
    kings: o.kings === false || o.kings === 'off' ? 'off' : 'on',  // fighting kings (hearts and spades)
    timer: [0, 15, 20, 30].includes(+o.timer) ? +o.timer : 20,
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
  const stock = shuffle(deck()), start = Math.random() * n | 0;
  const hands = seats.map(() => []);
  for (let k = 0; k < HAND * n; k++) hands[(start + k) % n].push(stock.pop());
  // the first card turned up is always a plain one: anything else goes back under the deck
  let first = stock.pop(); while (!isPlain(first)) { stock.unshift(first); first = stock.pop(); }
  const now = Date.now();
  return {
    game: 'makao', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    hands: hands.map(sortHand), stock, pile: [first], suit: suitOf(first), owe: 0, stop: 0, dem: -1, demLeft: 0, demBy: -1, drawn: -1,
    wait: seats.map(() => 0), said: seats.map(() => false), mk: seats.map(() => false), done: seats.map(() => false), out: [],
    open: -1, openKind: '', openAt: 0, catchAt: 0, catcher: -1,
    st: seats.map(() => ({ played: 0, drawn: 0, caught: 0, waited: 0 })),
    turn: start, mv: 0, last: null, stageEnd: now + MS.deal, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 30) G.ev.shift(); }
const top = G => G.pile[G.pile.length - 1];
export const tableOf = G => ({ top: top(G), suit: G.suit, owe: G.owe, stop: G.stop, dem: G.dem, queens: G.opts.queens === 'on', kings: G.opts.kings === 'on' });
const holds = (G, i) => !G.done[i] && G.hands[i].length > 0;          // still playing, with cards to play
const inGame = (G, i) => !G.done[i] && (G.hands[i].length > 0 || G.open === i); // counts someone who still owes a "Po makale!"
const count = (G, f) => G.seats.reduce((a, _, i) => a + (f(G, i) ? 1 : 0), 0);
function step(G, i, d) { const n = G.seats.length; for (let k = 1; k <= n; k++) { const j = ((i + d * k) % n + n) % n; if (holds(G, j)) return j; } return -1; }

// Take k cards off the deck into seat s's hand; an empty deck is refilled from the pile (all but its top card).
function take(G, s, k) {
  const got = [];
  for (let j = 0; j < k; j++) {
    if (!G.stock.length && G.pile.length > 1) { G.stock = shuffle(G.pile.splice(0, G.pile.length - 1)); pushEv(G, { t: 'reshuffle', k: G.stock.length }); }
    if (!G.stock.length) break; // every card is in somebody's hand
    got.push(G.stock.pop());
  }
  G.hands[s] = sortHand([...G.hands[s], ...got]);
  G.st[s].drawn += got.length;
  if (got.length) G.mk[s] = false;
  return got;
}

function setTurn(G, i, now) {
  if (G.mv >= MAX_MOVES) return finish(G, true);
  G.turn = i; G.stage = 'play'; G.drawn = -1; G.said[i] = false;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  // a bot waits a little longer when someone forgot their call, so people get a chance to catch them
  G.botAt = Math.max(now + rnd(900, 1700), G.open >= 0 ? G.openAt + MS.grace : 0);
  return true;
}
// The turn moves on from seat s. Players who are waiting out a four miss their turn here.
function advance(G, s, now) {
  let i = step(G, s, 1);
  for (let k = 0; k < 60 && i >= 0 && G.wait[i] > 0; k++) { G.wait[i]--; G.st[i].waited++; pushEv(G, { t: 'skip', s: i, left: G.wait[i] }); demTick(G); i = step(G, i, 1); }
  if (i < 0) return finish(G);
  return setTurn(G, i, now);
}
function markOut(G, s) {
  G.done[s] = true; G.mk[s] = false; G.out.push(s);
  pushEv(G, { t: 'out', s, place: G.out.length });
}
// someone else moving on closes the chance to catch a forgotten call; a forgotten "Po makale!" then counts as out
function closeOpen(G, s) {
  if (G.open < 0 || G.open === s) return;
  const v = G.open, kind = G.openKind; G.open = -1; G.catcher = -1;
  if (kind === 'po') markOut(G, v);
}
const demTick = G => { if (G.dem >= 0 && --G.demLeft <= 0) { G.dem = -1; G.demLeft = 0; pushEv(G, { t: 'demend' }); } };
const over = G => (G.opts.end === 'first' && G.out.length > 0) || count(G, inGame) <= 1;

function doPlay(G, s, cards, pick, now) {
  if (!Array.isArray(cards)) return false;
  if (G.stage === 'drawn' && (cards.length !== 1 || cards[0] !== G.drawn)) return false;
  const T = tableOf(G);
  if (!canPlay(G.hands[s], cards, T)) return false;
  closeOpen(G, s); if (over(G)) return finish(G);
  const r = rankOf(cards[0]), k = cards.length, kings = T.kings, underDem = G.dem >= 0;
  G.hands[s] = G.hands[s].filter(x => !cards.includes(x));
  G.pile.push(...cards); G.suit = suitOf(top(G)); G.mv++; G.drawn = -1;
  G.st[s].played += k;
  const rest = G.hands[s], left = rest.length;
  const e = { t: 'play', s, cs: cards };
  // what the cards do
  const add = cards.reduce((a, c) => a + drawOf(c, kings), 0);
  if (add) { G.owe += add; e.owe = G.owe; }
  if (r === FOUR) { G.stop += k; e.stop = G.stop; }
  if (r === ACE) { G.suit = Number.isInteger(pick) && pick >= 0 && pick < 4 ? pick : bestSuit(rest); e.suit = G.suit; }
  if (r === JACK) {
    G.dem = DEMANDS.includes(pick) ? pick : bestDemand(rest); G.demBy = s; e.dem = G.dem;
    G.demLeft = count(G, (g, i) => !g.done[i] && g.hands[i].length > 0); // everyone still holding cards gets one turn under it, the demander last
  } else if (underDem) demTick(G);
  G.last = { t: 'play', s, cs: cards, mv: G.mv };
  pushEv(G, e);
  // the calls
  if (!left) {
    if (G.said[s] || count(G, holds) <= 1) markOut(G, s); // said "Po makale!" (or the game is over anyway)
    else { G.open = s; G.openKind = 'po'; G.openAt = now; planCatch(G, s, now); }
  } else if (left === 1) {
    if (G.said[s]) { G.mk[s] = true; pushEv(G, { t: 'makao', s }); }
    else { G.open = s; G.openKind = 'makao'; G.openAt = now; planCatch(G, s, now); }
  } else G.mk[s] = false;
  G.said[s] = false;
  if (over(G)) return finish(G);
  // the King of spades sends the fight to the player before you
  if (G.owe > 0 && kings && top(G) === KS) { const p = step(G, s, -1); if (p >= 0 && p !== s) return setTurn(G, p, now); }
  return advance(G, s, now);
}

function doDraw(G, s, now) {
  if (G.stage !== 'play') return false;
  closeOpen(G, s); if (over(G)) return finish(G);
  G.mv++;
  if (G.owe > 0) { // lost the fight: take everything owed, and the turn is over
    const k = G.owe; G.owe = 0; const got = take(G, s, k);
    G.last = { t: 'draw', s, k: got.length, why: 'fight', mv: G.mv }; pushEv(G, { t: 'draw', s, k: got.length, why: 'fight' });
    return advance(G, s, now);
  }
  if (G.stop > 0) { // no four to pass it on: wait as many turns as there are fours, this one included
    const k = G.stop; G.stop = 0; G.wait[s] += k - 1; G.st[s].waited++;
    G.last = { t: 'wait', s, k, mv: G.mv }; pushEv(G, { t: 'wait', s, k });
    return advance(G, s, now);
  }
  const got = take(G, s, 1);
  G.last = { t: 'draw', s, k: got.length, mv: G.mv }; pushEv(G, { t: 'draw', s, k: got.length });
  if (got.length && fits(got[0], tableOf(G))) { // it fits: play it now or keep it
    G.stage = 'drawn'; G.drawn = got[0];
    G.tEnd = G.tEnd ? now + Math.min(MS.kept, G.opts.timer * 1000) : 0; G.botAt = now + rnd(700, 1200);
    return true;
  }
  demTick(G);
  return advance(G, s, now);
}
function doKeep(G, s, now) {
  if (G.stage !== 'drawn') return false;
  G.drawn = -1; pushEv(G, { t: 'keep', s });
  demTick(G);
  return advance(G, s, now);
}

// Say "Makao!" or "Po makale!": on your turn before you play (it counts for the cards you then put down), or
// straight after, before anyone catches you.
function doCall(G, s) {
  if (G.open === s) {
    const kind = G.openKind; G.open = -1; G.catcher = -1;
    if (kind === 'po') { markOut(G, s); pushEv(G, { t: 'po', s, late: true }); if (over(G)) finish(G); }
    else { G.mk[s] = true; pushEv(G, { t: 'makao', s, late: true }); }
    return true;
  }
  if (G.turn === s && !G.said[s] && (G.stage === 'play' || G.stage === 'drawn')) { G.said[s] = true; return true; }
  return false;
}
function doCatch(G, by, now) {
  const v = G.open;
  if (v < 0 || v === by || G.done[by]) return false;
  const kind = G.openKind; G.open = -1; G.catcher = -1;
  const got = take(G, v, PENALTY); G.st[v].caught++;
  pushEv(G, { t: 'catch', s: v, by, k: got.length, kind });
  if (!got.length && kind === 'po') markOut(G, v); // no cards left anywhere to punish with
  if (G.seats[G.turn]?.bot) G.botAt = Math.max(G.botAt, now + 700);
  return true;
}
// one of the bots notices a forgotten call a moment later, or not at all
function planCatch(G, s, now) {
  G.catcher = -1;
  const bots = G.seats.map((x, i) => i).filter(i => i !== s && G.seats[i].bot && !G.done[i]);
  if (!bots.length) return;
  const B = bot(G);
  if (Math.random() < B.catch) { G.catcher = bots[Math.random() * bots.length | 0]; G.catchAt = Math.min(now + rnd(B.spot[0], B.spot[1]), now + MS.grace - 300); }
}

function finish(G, called = false) {
  if (G.open >= 0 && G.openKind === 'po' && !G.done[G.open]) markOut(G, G.open);
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.drawn = -1; G.open = -1; G.endAt = Date.now();
  const rest = G.seats.map((_, i) => i).filter(i => !G.done[i]).sort((a, b) => G.hands[a].length - G.hands[b].length || a - b);
  const order = [...G.out, ...rest];
  G.win = order[0];
  G.res = { order, left: G.hands.map(h => h.length), moves: G.mv, called, mode: G.opts.end, loser: called || G.opts.end === 'first' ? -1 : order[order.length - 1] };
  pushEv(G, { t: 'end', w: G.win, l: G.res.loser });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage === 'deal') return false;
  const now = Date.now();
  if (a.t === 'call') return doCall(G, s);
  if (a.t === 'catch') return doCatch(G, s, now);
  if (G.turn !== s) return false;
  if (a.t === 'play') return doPlay(G, s, a.cs, a.pick, now);
  if (a.t === 'draw') return doDraw(G, s, now);
  if (a.t === 'keep') return doKeep(G, s, now);
  return false;
}

// ---------- bots ----------
// call: how often a bot remembers "Makao!" / "Po makale!"; catch: how often one catches a forgetter, after spot ms;
// fight: how often it defends when it can; sets: how often it puts down every card of a rank at once;
// aim: it saves its function cards for a neighbour who is nearly out; noise: how random its choice is.
export const BOTS = {
  chill: { call: .8, catch: .55, spot: [1300, 3200], fight: .85, sets: .6, aim: 0, noise: 5, playDrawn: .85 },
  sharp: { call: .97, catch: .9, spot: [700, 1800], fight: 1, sets: 1, aim: 1, noise: .6, playDrawn: 1 },
};
const bot = (G, level = G.opts.bots) => (typeof level === 'object' ? level : BOTS[level] || BOTS.chill);
// the suit to pick after an Ace: the one you hold the most of
function bestSuit(hand) {
  const w = [0, 0, 0, 0]; for (const c of hand) w[suitOf(c)]++;
  const m = Math.max(...w), best = [0, 1, 2, 3].filter(i => w[i] === m); return best[Math.random() * best.length | 0];
}
// the rank to demand with a Jack: the one from 5 to 10 you hold the most of
function bestDemand(hand) {
  const w = DEMANDS.map(r => hand.filter(c => rankOf(c) === r).length), m = Math.max(...w);
  const best = DEMANDS.filter((_, i) => w[i] === m); return best[Math.random() * best.length | 0];
}
function botMove(G, s, now, level) {
  const B = bot(G, level), hand = G.hands[s], T = tableOf(G);
  const say = left => { if (left <= 1 && Math.random() < B.call) G.said[s] = true; };
  if (G.stage === 'drawn') {
    if (Math.random() >= B.playDrawn) return doKeep(G, s, now);
    const rest = hand.filter(x => x !== G.drawn); say(rest.length);
    return doPlay(G, s, [G.drawn], rankOf(G.drawn) === ACE ? bestSuit(rest) : bestDemand(rest), now);
  }
  const opts = playable(hand, T);
  if (!opts.length || (G.owe > 0 && Math.random() >= B.fight)) return doDraw(G, s, now);
  const nx = step(G, s, 1), pv = step(G, s, -1);
  const nextN = nx >= 0 ? G.hands[nx].length : 9, prevN = pv >= 0 ? G.hands[pv].length : 9;
  // every sensible way to put cards down: each fitting card alone, or leading its whole rank with the best suit left on top
  const plays = [];
  for (const c of opts) {
    plays.push([c]);
    const same = sameRank(hand, c).filter(x => x !== c);
    if (same.length && Math.random() < B.sets) {
      const others = hand.filter(x => rankOf(x) !== rankOf(c));
      same.sort((a, b) => others.filter(x => suitOf(x) === suitOf(a)).length - others.filter(x => suitOf(x) === suitOf(b)).length);
      plays.push([c, ...same]);
    }
  }
  const score = cs => {
    const r = rankOf(cs[0]), t = cs[cs.length - 1], rest = hand.filter(x => !cs.includes(x));
    let v = Math.random() * B.noise + cs.length * 3;
    if (!rest.length) return 100;
    if (B.aim) {
      const hit = isFight(t, T.kings) || r === FOUR;
      if (hit) { const victim = T.kings && t === KS ? prevN : nextN; v += victim <= 2 ? 9 : G.owe > 0 || G.stop > 0 ? 2 : rest.length > 3 ? -3 : 1; }
      if (r === ACE || r === JACK) v -= rest.length > 2 ? 4 : -2; // keep the cards that fit on anything for the end
      const suit = r === ACE ? bestSuit(rest) : suitOf(t);
      v += rest.filter(x => suitOf(x) === suit).length * .8;       // leave a suit you can follow yourself
      if (r === JACK) v += rest.filter(x => rankOf(x) === bestDemand(rest)).length;
    }
    return v;
  };
  const cs = plays.sort((a, b) => score(b) - score(a))[0];
  const rest = hand.filter(x => !cs.includes(x)); say(rest.length);
  return doPlay(G, s, cs, rankOf(cs[0]) === ACE ? bestSuit(rest) : bestDemand(rest), now);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; setTurn(G, G.turn, now); return true; }
  if (G.open >= 0 && G.catcher >= 0 && now >= G.catchAt) { const by = G.catcher; G.catcher = -1; if (G.seats[by]?.bot) return doCatch(G, by, now); }
  // when the first one out ends the game, a forgotten "Po makale!" nobody catches in time ends it without waiting for the next move
  if (G.open >= 0 && G.openKind === 'po' && G.opts.end === 'first' && now >= G.openAt + MS.grace) { closeOpen(G, -1); return finish(G); }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; botMove(G, s, now); return true; }
  if (G.tEnd && now >= G.tEnd) { // out of time: keep a drawn card, otherwise a bot plays the turn
    if (G.stage === 'drawn') return doKeep(G, s, now);
    botMove(G, s, now, 'chill'); return true;
  }
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.ph === 'play' && G.stage !== 'deal') { G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

export function view(G, s) {
  const now = Date.now(), end = G.ph === 'end';
  return {
    game: 'makao', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, timer: G.opts.timer, botsLevel: G.opts.bots,
    queens: G.opts.queens === 'on', kings: G.opts.kings === 'on', end: G.opts.end,
    tLeft: (G.stage === 'play' || G.stage === 'drawn') && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    dealLeft: G.stage === 'deal' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    pile: G.pile.slice(-8), pileN: G.pile.length, stockN: G.stock.length, suit: G.suit, owe: G.owe, stop: G.stop, dem: G.dem, demLeft: G.demLeft, demBy: G.demBy,
    drawn: G.turn === s ? G.drawn : -1, // only the drawer knows which card they drew
    open: G.open, openKind: G.open >= 0 ? G.openKind : '', last: G.last,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.hands[i].length, st: G.st[i], mk: G.mk[i], wait: G.wait[i], done: G.done[i], place: G.done[i] ? G.out.indexOf(i) + 1 : 0,
      said: i === s ? G.said[i] : false, // your own early call shows only to you
      hand: i === s || end ? G.hands[i] : null, // your own cards only; at the end everyone shows what they were left with
    })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// 10 points for every player you finished ahead of. Only the first one out counts as the winner.
// (When the first one out ends the game, the others are placed by how few cards they hold.)
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10, win: place === 0, place: place + 1 };
  });
}

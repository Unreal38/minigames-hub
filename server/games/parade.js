// Pet Parade: our own colour-matching shedding game with Pet Farm pet cards. Match the top card's colour or its
// number or action, or play a grey Stone wild card and pick the colour. Nap skips the next player, Turnabout turns
// the direction round, Gift makes the next player take 2 and Rockslide (wild) takes 4. Down to one card you say
// "Last one!", or anyone may catch you and you take 2. The first one out of cards wins; everyone else is placed by
// the points left in their hand. Nobody is ever sent another player's hand or the cards they drew.
import { deck, colOf, faceOf, isWild, drawOf, fits, playable, handPoints, sortHand, NAP, TURN, GIFT, ROCK, HAND } from '../../public/games/parade/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'parade', name: 'Pet Parade', minPlayers: 1, maxPlayers: 6 };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { deal: 2600, kept: 10000, grace: 2600 }; // deal; time to decide on a drawn card; how long a forgotten "Last one!" can be caught before a bot moves on
export const MAX_MOVES = 500; // a safety net only: then the table is called and placed by points

const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4, 5, 6].includes(+o.seats) ? +o.seats : 4,
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    stack: o.stack === true || o.stack === 'on' ? 'on' : 'off',
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
  // the first card turned up is always a number: anything else goes back under the deck
  let first = stock.pop(); while (faceOf(first) > 9) { stock.unshift(first); first = stock.pop(); }
  const now = Date.now();
  return {
    game: 'parade', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    hands: hands.map(sortHand), stock, pile: [first], col: colOf(first), dir: 1, owe: 0, drawn: -1,
    called: seats.map(() => false), open: -1, openAt: 0, catchAt: 0, catcher: -1,
    st: seats.map(() => ({ played: 0, drawn: 0, caught: 0, wild: 0 })),
    turn: start, mv: 0, last: null, stageEnd: now + MS.deal, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const top = G => G.pile[G.pile.length - 1];
const nextOf = (G, i, k = 1) => { const n = G.seats.length; return ((i + G.dir * k) % n + n) % n; };

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
  if (got.length) G.called[s] = false;
  if (G.open === s) G.open = -1;
  return got;
}

function setTurn(G, i, now) {
  if (G.mv >= MAX_MOVES) return finish(G, true);
  G.turn = i; G.stage = 'play'; G.drawn = -1;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  // a bot waits a little longer when someone forgot to say "Last one!", so people get a chance to catch them
  G.botAt = Math.max(now + rnd(900, 1700), G.open >= 0 ? G.openAt + MS.grace : 0);
  return true;
}

// someone else moving on closes the chance to catch a forgotten "Last one!"
function closeOpen(G, s) { if (G.open >= 0 && G.open !== s) { G.open = -1; G.catcher = -1; } }

function doPlay(G, s, c, col, now) {
  const drawnOnly = G.stage === 'drawn';
  if (drawnOnly && c !== G.drawn) return false;
  if (!G.hands[s].includes(c) || !fits(c, top(G), G.col, G.owe)) return false;
  if (isWild(c)) { col = Number.isInteger(col) && col >= 0 && col < 4 ? col : bestCol(G.hands[s].filter(x => x !== c)); }
  closeOpen(G, s);
  G.hands[s] = G.hands[s].filter(x => x !== c);
  G.pile.push(c); G.col = isWild(c) ? col : colOf(c); G.mv++; G.drawn = -1;
  G.st[s].played++; if (isWild(c)) G.st[s].wild++;
  const f = faceOf(c), left = G.hands[s].length;
  G.last = { t: 'play', s, c, col: G.col, mv: G.mv };
  pushEv(G, { t: 'play', s, c, col: G.col });
  if (!left) return finish(G);
  if (left === 1) {
    if (G.called[s]) pushEv(G, { t: 'call', s });
    else { G.open = s; G.openAt = now; planCatch(G, s, now); }
  } else G.called[s] = false;
  const n = G.seats.length;
  if (f === TURN) { G.dir = -G.dir; pushEv(G, { t: 'turn', s, dir: G.dir }); }
  if (f === NAP || (f === TURN && n === 2)) { const v = nextOf(G, s); pushEv(G, { t: 'skip', s: v }); return setTurn(G, nextOf(G, s, 2), now); }
  if (drawOf(c)) {
    const v = nextOf(G, s);
    if (G.opts.stack === 'on') { G.owe += drawOf(c); return setTurn(G, v, now); } // they may pass it on with another draw card
    const k = drawOf(c); take(G, v, k); pushEv(G, { t: 'draw', s: v, k, why: f === ROCK ? 'rock' : 'gift' }); pushEv(G, { t: 'skip', s: v });
    return setTurn(G, nextOf(G, s, 2), now);
  }
  return setTurn(G, nextOf(G, s), now);
}

function doDraw(G, s, now) {
  if (G.stage !== 'play') return false;
  closeOpen(G, s);
  G.mv++;
  if (G.owe > 0) { // stacking: take everything owed, and the turn is over
    const k = G.owe; G.owe = 0; const got = take(G, s, k);
    G.last = { t: 'draw', s, k: got.length, why: 'owe', mv: G.mv }; pushEv(G, { t: 'draw', s, k: got.length, why: 'owe' });
    return setTurn(G, nextOf(G, s), now);
  }
  const got = take(G, s, 1);
  G.last = { t: 'draw', s, k: got.length, mv: G.mv }; pushEv(G, { t: 'draw', s, k: got.length });
  if (got.length && fits(got[0], top(G), G.col)) { // it fits: play it now or keep it
    G.stage = 'drawn'; G.drawn = got[0];
    G.tEnd = G.tEnd ? now + Math.min(MS.kept, G.opts.timer * 1000) : 0; G.botAt = now + rnd(700, 1200);
    return true;
  }
  return setTurn(G, nextOf(G, s), now);
}
function doKeep(G, s, now) {
  if (G.stage !== 'drawn') return false;
  G.drawn = -1; pushEv(G, { t: 'keep', s });
  return setTurn(G, nextOf(G, s), now);
}

// Say "Last one!": on your turn while holding two cards (before you play one), or straight after, before anyone catches you.
function doCall(G, s) {
  const h = G.hands[s].length;
  if (G.open === s && h === 1) { G.open = -1; G.catcher = -1; G.called[s] = true; pushEv(G, { t: 'call', s, late: true }); return true; }
  if (h === 2 && G.turn === s && !G.called[s]) { G.called[s] = true; return true; }
  return false;
}
function doCatch(G, by, now) {
  const v = G.open;
  if (v < 0 || v === by || G.hands[v].length !== 1) return false;
  G.open = -1; G.catcher = -1;
  const got = take(G, v, 2); G.st[v].caught++;
  pushEv(G, { t: 'catch', s: v, by, k: got.length });
  if (G.seats[G.turn]?.bot) G.botAt = Math.max(G.botAt, now + 700);
  return true;
}
// one of the bots notices a forgotten "Last one!" a moment later, or not at all
function planCatch(G, s, now) {
  G.catcher = -1;
  const bots = G.seats.map((x, i) => i).filter(i => i !== s && G.seats[i].bot);
  if (!bots.length) return;
  const B = bot(G);
  if (Math.random() < B.catch) { G.catcher = bots[Math.random() * bots.length | 0]; G.catchAt = now + rnd(B.spot[0], B.spot[1]); }
}

function finish(G, called = false) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.drawn = -1; G.open = -1; G.endAt = Date.now();
  const pts = G.hands.map(handPoints);
  const order = G.seats.map((_, i) => i).sort((a, b) => G.hands[a].length === 0 ? -1 : G.hands[b].length === 0 ? 1 : pts[a] - pts[b] || G.hands[a].length - G.hands[b].length || a - b);
  G.win = order[0];
  G.res = { order, pts, left: G.hands.map(h => h.length), moves: G.mv, called };
  pushEv(G, { t: 'end', w: G.win });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage === 'deal') return false;
  const now = Date.now();
  if (a.t === 'call') return doCall(G, s);
  if (a.t === 'catch') return doCatch(G, s, now);
  if (G.turn !== s) return false;
  if (a.t === 'play') return doPlay(G, s, a.c, a.col, now);
  if (a.t === 'draw') return doDraw(G, s, now);
  if (a.t === 'keep') return doKeep(G, s, now);
  return false;
}

// ---------- bots ----------
// call: how often a bot remembers "Last one!"; catch: how often one catches a forgetter, after spot ms;
// keepWild: a sharp bot holds its wild cards until nothing else fits; aim: it saves its action cards for a
// next player who is nearly out; stack: how often it passes on a draw it could pass on.
export const BOTS = {
  chill: { call: .8, catch: .55, spot: [1300, 3200], keepWild: .3, aim: 0, stack: .7, playDrawn: .8 },
  sharp: { call: .97, catch: .9, spot: [700, 1800], keepWild: 1, aim: 1, stack: 1, playDrawn: 1 },
};
const bot = (G, level = G.opts.bots) => (typeof level === 'object' ? level : BOTS[level] || BOTS.chill);
// the colour to pick after a wild card: the one you hold the most of (numbers count less than actions)
function bestCol(hand) {
  const w = [0, 0, 0, 0];
  for (const c of hand) if (!isWild(c)) w[colOf(c)] += faceOf(c) > 9 ? 1.5 : 1;
  const m = Math.max(...w); if (!m) return Math.random() * 4 | 0;
  const best = [0, 1, 2, 3].filter(i => w[i] === m); return best[Math.random() * best.length | 0];
}
function botMove(G, s, now, level) {
  const B = bot(G, level), hand = G.hands[s], t = top(G);
  if (hand.length === 2 && !G.called[s] && Math.random() < B.call) G.called[s] = true; // about to go down to one
  if (G.stage === 'drawn') return Math.random() < B.playDrawn ? doPlay(G, s, G.drawn, bestCol(hand.filter(x => x !== G.drawn)), now) : doKeep(G, s, now);
  let opts = playable(hand, t, G.col, G.owe);
  if (G.owe > 0) return opts.length && Math.random() < B.stack ? doPlay(G, s, opts[0], bestCol(hand.filter(x => x !== opts[0])), now) : doDraw(G, s, now);
  if (!opts.length) return doDraw(G, s, now);
  const plain = opts.filter(c => !isWild(c));
  if (plain.length && Math.random() < B.keepWild) opts = plain;
  const nextN = G.hands[nextOf(G, s)].length;
  const score = c => {
    let v = Math.random() * (B.aim ? .5 : 4);
    const f = faceOf(c);
    if (B.aim) {
      if (f > 9 && nextN <= 2) v += 30; // hit a player about to go out
      else if (f > 9 && hand.length > 3) v -= 4; // otherwise save actions for later
      v += (f <= 9 ? f : 10) * .4;      // shed high points first
      if (!isWild(c)) v += hand.filter(x => colOf(x) === colOf(c)).length; // stay in a colour you are long in
    }
    return v;
  };
  const c = opts.sort((a, b) => score(b) - score(a))[0];
  return doPlay(G, s, c, bestCol(hand.filter(x => x !== c)), now);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; setTurn(G, G.turn, now); return true; }
  if (G.open >= 0 && G.catcher >= 0 && now >= G.catchAt) { const by = G.catcher; G.catcher = -1; if (G.seats[by]?.bot) return doCatch(G, by, now); }
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
    game: 'parade', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, timer: G.opts.timer, botsLevel: G.opts.bots, stack: G.opts.stack,
    tLeft: (G.stage === 'play' || G.stage === 'drawn') && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    dealLeft: G.stage === 'deal' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    pile: G.pile.slice(-10), pileN: G.pile.length, stockN: G.stock.length, col: G.col, dir: G.dir, owe: G.owe,
    drawn: G.turn === s ? G.drawn : -1, // only the drawer knows which card they drew
    open: G.open, last: G.last,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.hands[i].length, st: G.st[i], called: G.called[i] && (G.hands[i].length === 1 || i === s), // your own early call shows only to you
      hand: i === s || end ? G.hands[i] : null, // your own cards only; at the end everyone shows what they were left with
    })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// 10 points for every player you finished ahead of. Only the first one out counts as the winner.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10, win: place === 0, place: place + 1 };
  });
}

// Pan: the Polish shedding game with the 24 cards from nine to ace. Whoever holds the nine of hearts starts with
// it. On your turn you put down a card at least as high as the top one (or all four of a rank), or you pick up
// three cards off the pile. A spade sends the next turn backwards, to the player before you (Kuba's house rule). Run out of cards and you are safe; the last one still holding cards is the "pan".
// Nobody is ever sent another player's hand.
import { deck, rankOf, isSpade, sortHand, canPlay, drawCount, plays, seatsFor, NINE_H, top } from '../../public/games/pan/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'pan', name: 'Pan', minPlayers: 1, maxPlayers: 6, seats: { lo: 2, def: 4 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { deal: 2400 };   // cards fly out before the first turn
export const MAX_MOVES = 250;       // a game nobody will dig out of is called here: fewest cards left does best

const rnd = (a, b) => a + Math.random() * (b - a);

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
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
  const n = seatsFor(opts.seats, seats.length);
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const d = deck();
  for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; }
  const hands = seats.map((_, i) => sortHand(d.filter((_, k) => k % n === i)));
  const now = Date.now();
  return {
    game: 'pan', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    hands, pile: [], out: seats.map(() => 0), outN: 0,
    st: seats.map(() => ({ played: 0, drawn: 0, fours: 0 })),
    turn: hands.findIndex(h => h.includes(NINE_H)), mv: 0, last: null,
    stageEnd: now + MS.deal, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, pan: -1, endAt: 0,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
const alive = (G, i) => G.hands[i].length > 0;
const nextFrom = (G, i) => { const n = G.seats.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (alive(G, j)) return j; } return -1; };

function setTurn(G, i, now) {
  G.turn = i;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(1000, 1900);
}
const prevFrom = (G, i) => { const n = G.seats.length; for (let k = 1; k <= n; k++) { const j = (i - k + n * 2) % n; if (alive(G, j)) return j; } return -1; };
// back: a spade was played, so this one turn goes to the player before, and play carries on clockwise from them
function after(G, s, now, back = false) {
  G.mv++;
  if (G.hands.filter(h => h.length).length < 2 || G.mv >= MAX_MOVES) return finish(G);
  setTurn(G, back ? prevFrom(G, s) : nextFrom(G, s), now);
}

function doPlay(G, s, cards, now) {
  if (!canPlay(G.hands[s], G.pile, cards)) return false;
  cards = [...cards].sort((a, b) => (a === NINE_H ? -1 : b === NINE_H ? 1 : a - b)); // the nine of hearts always ends up underneath
  G.hands[s] = G.hands[s].filter(c => !cards.includes(c));
  G.pile.push(...cards);
  G.st[s].played += cards.length; if (cards.length > 1) G.st[s].fours++;
  const back = isSpade(cards[cards.length - 1]) && G.hands.filter(h => h.length).length > 2; // the top card put down decides
  G.last = { t: 'play', s, cards, back, mv: G.mv + 1 };
  pushEv(G, { t: 'play', s, cards, back });
  if (!G.hands[s].length) { G.out[s] = ++G.outN; pushEv(G, { t: 'out', s, place: G.outN }); }
  after(G, s, now, back);
  return true;
}
function doDraw(G, s, now) {
  const k = drawCount(G.pile);
  if (!k) return false;
  const cards = G.pile.splice(G.pile.length - k, k);
  G.hands[s] = sortHand([...G.hands[s], ...cards]);
  G.st[s].drawn += k;
  G.last = { t: 'draw', s, cards, mv: G.mv + 1 }; // everyone saw these cards being played, so they are no secret
  pushEv(G, { t: 'draw', s, k });
  after(G, s, now);
  return true;
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = Date.now();
  // safe players in the order they got out, then whoever still holds cards (fewest first)
  const order = G.seats.map((_, i) => i).sort((a, b) => (G.out[a] || 99) - (G.out[b] || 99) || G.hands[a].length - G.hands[b].length);
  G.win = order[0]; G.pan = order[order.length - 1];
  G.res = { order, moves: G.mv, left: G.hands.map(h => h.length), called: G.hands.filter(h => h.length).length > 1 };
  pushEv(G, { t: 'end', w: G.win, pan: G.pan });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage !== 'play' || G.turn !== s) return false;
  const now = Date.now();
  if (a.t === 'play') return doPlay(G, s, a.cards, now);
  if (a.t === 'draw') return doDraw(G, s, now);
  return false;
}

// ---------- bots ----------
// Both kinds shed their lowest card that fits. The pile only ever climbs, so a low card you still hold can only
// go once somebody digs the pile back down by picking up. If nobody ever did, the same aces would go round for
// ever, so a bot holding a card that is too low sometimes picks up on purpose even though it could play, and
// more readily the longer the game runs. Picking up helps the others too: a sharp bot does it less often.
// dig: chance at the start; per: moves until that chance has grown by 1; max: its ceiling;
// care: how often it plays any card that fits; four: how often it spots four of a kind.
export const BOTS = {
  chill: { dig: .4, per: 200, max: .85, care: .12, four: .5 },
  sharp: { dig: .15, per: 250, max: .8, care: 0, four: 1 },
};
function botMove(G, s, now, level = G.opts.bots) {
  const B = typeof level === 'object' ? level : BOTS[level] || BOTS.chill;
  const hand = G.hands[s], opts = plays(hand, G.pile);
  if (!opts.length) return doDraw(G, s, now);
  const singles = opts.filter(c => c.length === 1).sort((a, b) => rankOf(a[0]) - rankOf(b[0]));
  const many = opts.filter(c => c.length > 1).sort((a, b) => rankOf(a[0]) - rankOf(b[0]));
  if (many.length && Math.random() < B.four) return doPlay(G, s, many[0], now);
  if (!G.pile.length) return doPlay(G, s, singles[0], now);
  const stuck = hand.some(c => rankOf(c) < rankOf(top(G.pile)));
  if (stuck && drawCount(G.pile) && Math.random() < Math.min(B.max, B.dig + G.mv / B.per)) return doDraw(G, s, now);
  if (singles.length > 1 && Math.random() < B.care) return doPlay(G, s, singles[Math.random() * singles.length | 0], now);
  return doPlay(G, s, singles[0], now);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; G.stage = 'play'; setTurn(G, G.turn, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; botMove(G, s, now); return true; }
  if (G.tEnd && now >= G.tEnd) { botMove(G, s, now, 'chill'); return true; } // out of time: a bot plays the turn
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.stage === 'play') { G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'pan', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, timer: G.opts.timer, botsLevel: G.opts.bots,
    tLeft: G.stage === 'play' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    dealLeft: G.stage === 'deal' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    pile: G.pile, last: G.last,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.hands[i].length, out: G.out[i], st: G.st[i],
      hand: i === s ? G.hands[i] : null, // your own cards only
    })),
    res: G.res, win: G.win, pan: G.pan, ev: G.ev,
  };
}

// 10 points for every player you finished ahead of. Everyone who got rid of their cards beat the pan,
// but only the first one out counts as the winner.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10, win: place === 0, place: place + 1 };
  });
}

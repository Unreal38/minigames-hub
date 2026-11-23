// Piotruś: the Polish Old Maid. A deck of pet pairs plus one odd card, the Piotruś, is dealt out. Everyone lays
// down their pairs, then in turn each player draws one card, face down, from the player before them (the one on
// their right). A card that makes a pair goes down with its twin. Run out of cards and you are safe; whoever is left
// holding the Piotruś loses. Nobody is ever sent another player's hand: the drawer only picks a position.
import { deck, strip, petOf, PIOTR, DECKS } from '../../public/games/piotr/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'piotr', name: 'Piotruś', minPlayers: 1, maxPlayers: 6 };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { deal: 2600, pairs: 2200, take: 1300 }; // cards fly out, first pairs go down, a drawn card lands
export const MAX_MOVES = 600; // can only be reached by an absurd run of luck; then fewest cards does best

const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4, 5, 6].includes(+o.seats) ? +o.seats : 4,
    deck: o.deck === 'big' ? 'big' : 'small',
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
  const d = shuffle(deck(DECKS[opts.deck]));
  const start = Math.random() * n | 0; // dealing starts with this seat, and so does play
  const dealt = seats.map(() => []);
  d.forEach((c, k) => dealt[(start + k) % n].push(c));
  const hands = [], first = [];
  for (const h of dealt) { const { keep, pairs } = strip(h); hands.push(shuffle(keep)); first.push(pairs); }
  const now = Date.now();
  const G = {
    game: 'piotr', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    dealt: dealt.map(h => h.length), hands, first, heap: [], out: seats.map(() => 0), outN: 0,
    st: seats.map((_, i) => ({ pairs: first[i].length, took: 0 })),
    turn: start, from: -1, aim: -1, mv: 0, last: null, got: -1,
    stageEnd: now + MS.deal, tEnd: 0, botAt: 0, plan: 0, ev: [], evN: 0, res: null, win: -1, loser: -1, endAt: 0,
  };
  first.forEach((ps, i) => ps.forEach(p => G.heap.push({ p, s: i })));
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
const alive = (G, i) => G.hands[i].length > 0;
const aliveN = G => G.hands.filter(h => h.length).length;
const step = (G, i, dir) => { const n = G.seats.length; for (let k = 1; k < n; k++) { const j = (i + dir * k + n * 2) % n; if (alive(G, j)) return j; } return -1; };

// Players who end up with no cards are out, in the order given.
function outIfEmpty(G, list) { for (const i of list) if (!G.out[i] && !alive(G, i)) { G.out[i] = ++G.outN; pushEv(G, { t: 'out', s: i, place: G.outN }); } }

function setTurn(G, i, now) {
  if (aliveN(G) < 2 || G.mv >= MAX_MOVES) return finish(G);
  if (!alive(G, i)) i = step(G, i, 1);
  G.turn = i; G.from = step(G, i, -1); G.aim = -1; G.stage = 'play';
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(700, 1300); G.plan = 1 + (Math.random() * 3 | 0); // a bot hovers over a card or three before it takes one
}

// The drawer takes the card at position k of the giver's hand.
function doTake(G, s, k, now) {
  const g = G.from, from = G.hands[g];
  if (!Number.isInteger(k) || k < 0 || k >= from.length) return false;
  const [c] = from.splice(k, 1);
  const mine = G.hands[s], twin = c === PIOTR ? -1 : mine.findIndex(x => petOf(x) === petOf(c));
  let pair = -1;
  if (twin >= 0) { mine.splice(twin, 1); pair = petOf(c); G.heap.push({ p: pair, s }); G.st[s].pairs++; }
  else mine.splice(Math.random() * (mine.length + 1) | 0, 0, c); // lands somewhere random, so the giver can't track it
  G.st[s].took++; G.mv++;
  G.got = pair >= 0 ? -1 : c; // only the drawer is told which card it was (the giver knew it already)
  G.last = { t: 'take', s, from: g, k, pair, mv: G.mv, n: G.hands[g].length + 1 };
  pushEv(G, { t: 'take', s, from: g, pair });
  outIfEmpty(G, [g, s]); // the giver's last card went first, then the drawer laid down their last pair
  G.turn = -1; G.aim = -1; G.tEnd = 0; G.stage = 'took'; G.stageEnd = now + MS.take;
  if (aliveN(G) < 2) finish(G);
  return true;
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.from = -1; G.aim = -1; G.tEnd = 0; G.endAt = Date.now();
  const held = i => G.hands[i].includes(PIOTR);
  // safe players in the order they got out, then anyone still holding cards (fewest first), the Piotruś always last
  const order = G.seats.map((_, i) => i).sort((a, b) => held(a) - held(b) || (G.out[a] || 99) - (G.out[b] || 99) || G.hands[a].length - G.hands[b].length);
  G.win = order[0]; G.loser = order[order.length - 1];
  G.res = { order, moves: G.mv, left: G.hands.map(h => h.length), called: aliveN(G) > 1 };
  pushEv(G, { t: 'end', w: G.win, loser: G.loser });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play') return false;
  const now = Date.now();
  if (a.t === 'shuffle') { // mix up your own hand, any time you still hold two or more cards
    if (G.hands[s].length < 2 || G.stage === 'deal') return false;
    shuffle(G.hands[s]); pushEv(G, { t: 'shuf', s });
    return true;
  }
  if (G.stage !== 'play' || G.turn !== s) return false;
  if (a.t === 'aim') { // the card you are hovering over: the giver and everyone else see your hand reach for it
    const k = a.k === -1 ? -1 : Number.isInteger(a.k) && a.k >= 0 && a.k < G.hands[G.from].length ? a.k : null;
    if (k === null || k === G.aim) return false;
    G.aim = k; return true;
  }
  if (a.t === 'take') return doTake(G, s, a.k, now);
  return false;
}

// ---------- bots ----------
// Picking is pure luck, so a bot just hovers over a card or two (to keep the giver guessing) and takes one.
// A bot holding the Piotruś mixes its hand up now and then, just as a person might.
function botStep(G, s, now) {
  const n = G.hands[G.from].length;
  if (G.plan > 0) { G.plan--; G.aim = Math.random() * n | 0; G.botAt = now + rnd(450, 900); return true; }
  return doTake(G, s, G.aim >= 0 && Math.random() < .7 ? G.aim : Math.random() * n | 0, now);
}
export { botStep as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; G.stage = 'pairs'; G.stageEnd = now + (G.first.some(p => p.length) ? MS.pairs : 300); outIfEmpty(G, G.seats.map((_, k) => (G.turn + k) % G.seats.length)); return true; }
  if (G.stage === 'pairs' || G.stage === 'took') {
    if (now < G.stageEnd) return false;
    const next = G.stage === 'pairs' ? G.turn : step(G, G.last.s, 1);
    setTurn(G, next < 0 ? G.last.s : next, now);
    // a bot giving the Piotruś away sometimes shuffles first
    if (G.ph === 'play' && G.seats[G.from]?.bot && G.hands[G.from].includes(PIOTR) && G.hands[G.from].length > 1 && Math.random() < .35) { shuffle(G.hands[G.from]); pushEv(G, { t: 'shuf', s: G.from }); }
    return true;
  }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; return botStep(G, s, now); }
  if (G.tEnd && now >= G.tEnd) return doTake(G, s, G.aim >= 0 ? G.aim : Math.random() * G.hands[G.from].length | 0, now); // out of time: take the card you were on, or any
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.stage === 'play') { G.botAt = Date.now() + 800; G.plan = 0; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

export function view(G, s) {
  const now = Date.now(), deal = G.stage === 'deal', end = G.ph === 'end';
  return {
    game: 'piotr', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, from: G.from, aim: G.aim, mv: G.mv, timer: G.opts.timer, deck: G.opts.deck,
    tLeft: G.stage === 'play' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    stageLeft: G.stage !== 'play' && !end ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    heap: deal ? [] : G.heap, last: G.last, got: G.last && G.last.s === s ? G.got : -1,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: deal ? G.dealt[i] : G.hands[i].length, out: G.out[i], st: G.st[i], first: G.first[i],
      hand: i === s || (end && G.hands[i].length) ? G.hands[i] : null, // your own cards only; at the end the loser shows the Piotruś
    })),
    res: G.res, win: G.win, loser: G.loser, ev: G.ev,
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

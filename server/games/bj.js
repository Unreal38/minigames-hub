// Blackjack: everyone at the table plays their own hand against one dealer, for pretend chips.
// It is a short tournament like the poker table: equal stacks, a set number of rounds, most chips at the end wins.
// Bets go in at the same time (hidden until the deal), then each player takes a turn. Bots fill empty seats.
import { START, MIN_BET, MAX_BET, BET_STEP, DECKS, cardVal, total, isBlackjack, isPair, betRange, betOk } from '../../public/games/bj/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'bj', name: 'Blackjack', minPlayers: 1, maxPlayers: 6, joinAt: 'hand' };

const BOT_NAMES = ['Truffle', 'Waffles', 'Clover', 'Nugget', 'Pudding', 'Maple', 'Toffee', 'Sprout'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const FIRST_MS = 1500, DEAL_CARD_MS = 260, DEAL_PAD_MS = 900, REVEAL_MS = 1100, DRAW_MS = 850, PAY_MS = 4600, NEXT_MS = 650;
const BET_BOT_MS = [700, 2600], PLAY_BOT_MS = [900, 1800];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rnd = (a, b) => a + Math.random() * (b - a);
const newShoe = () => shuffle(Array.from({ length: 52 * DECKS }, (_, i) => i % 52));

export function cleanOpts(o = {}) {
  return {
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    seats: [2, 3, 4, 5, 6].includes(+o.seats) ? +o.seats : 4,
    rounds: [10, 15, 20].includes(+o.rounds) ? +o.rounds : 10,
    timer: [0, 15, 20, 30].includes(+o.timer) ? +o.timer : 20,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = shuffle(BOT_NAMES.filter(n => !used.has(n)));
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(2, opts.seats)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  return {
    game: 'bj', ph: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    st: seats.map(() => ({ stack: START, out: 0, bet: 0, last: 0, was: START, hands: [], net: 0 })),
    dealer: { cards: [], shown: false, av: randomAv(), color: '#b4475a' },
    round: 0, rounds: opts.rounds, stage: 'wait', shoe: newShoe(), turn: -1, hi: 0,
    stageEnd: Date.now() + FIRST_MS, tEnd: 0, botAt: 0, betAt: [], bustN: 0,
    ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 30) G.ev.shift(); }
const idx = G => G.seats.map((_, i) => i);
const live = (G, i) => !G.st[i].out;
const draw = G => { if (!G.shoe.length) G.shoe = newShoe(); return G.shoe.pop(); };
const upVal = G => cardVal(G.dealer.cards[0]);

// ---------- a round ----------
function startRound(G, now = Date.now()) {
  const alive = idx(G).filter(i => live(G, i) && G.st[i].stack > 0);
  if (alive.length < 2 || G.round >= G.rounds) return finish(G);
  seatQueued(G);
  G.round++;
  if (G.shoe.length < 52) { G.shoe = newShoe(); pushEv(G, { t: 'shuffle' }); }
  for (const x of G.st) { x.bet = 0; x.hands = []; x.net = 0; x.was = x.stack; }
  G.dealer.cards = []; G.dealer.shown = false;
  G.stage = 'bet'; G.turn = -1; G.hi = 0;
  G.tEnd = G.opts.timer ? now + G.opts.timer * 1000 : 0;
  G.betAt = G.seats.map(() => now + rnd(...BET_BOT_MS));
  pushEv(G, { t: 'round', r: G.round });
}

const waiting = G => idx(G).filter(i => live(G, i) && !G.st[i].bet); // seats that still have to bet
function placeBet(G, s, amt, now = Date.now()) {
  const x = G.st[s];
  if (G.stage !== 'bet' || x.out || x.bet || !betOk(amt, x.stack)) return false;
  x.bet = amt; x.last = amt; x.stack -= amt;
  pushEv(G, { t: 'bet', s });
  if (!waiting(G).length) deal(G, now);
  return true;
}

function deal(G, now = Date.now()) {
  const order = idx(G).filter(i => live(G, i));
  for (const i of order) G.st[i].hands = [{ cards: [], bet: G.st[i].bet, done: false, dbl: false, bust: false, bj: false, split: false, res: '', pay: 0 }];
  for (let r = 0; r < 2; r++) { for (const i of order) G.st[i].hands[0].cards.push(draw(G)); G.dealer.cards.push(draw(G)); }
  for (const i of order) { const h = G.st[i].hands[0]; if (isBlackjack(h.cards)) { h.bj = true; h.done = true; } }
  G.stage = 'deal'; G.tEnd = 0; G.turn = -1;
  G.stageEnd = now + DEAL_PAD_MS + DEAL_CARD_MS * (order.length + 1) * 2;
  pushEv(G, { t: 'deal' });
}

function afterDeal(G, now = Date.now()) {
  for (const i of idx(G)) if (G.st[i].hands[0]?.bj) pushEv(G, { t: 'bj', s: i });
  // the dealer peeks under an ace or a ten: a dealer blackjack ends the round on the spot
  if (isBlackjack(G.dealer.cards)) { G.dealer.shown = true; pushEv(G, { t: 'dbj' }); return settle(G, now); }
  G.stage = 'play';
  nextTurn(G, now);
}

// Whose hand is next: seats in order, each hand of a seat left to right.
function nextTurn(G, now = Date.now()) {
  for (const i of idx(G)) {
    if (!live(G, i)) continue;
    const k = G.st[i].hands.findIndex(h => !h.done);
    if (k >= 0) { G.turn = i; G.hi = k; G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0; G.botAt = now + rnd(...PLAY_BOT_MS); return; }
  }
  G.turn = -1; G.tEnd = 0;
  G.stage = 'dealer'; G.dealer.shown = true; G.stageEnd = now + REVEAL_MS;
  pushEv(G, { t: 'dealer' });
}

// The dealer only draws when somebody still has a hand that could lose to it.
const anyStanding = G => G.st.some(x => x.hands.some(h => !h.bust && !h.bj));
function dealerStep(G, now = Date.now()) {
  if (anyStanding(G) && total(G.dealer.cards).v < 17) { // draws to 16, stands on every 17
    G.dealer.cards.push(draw(G)); G.stageEnd = now + DRAW_MS;
    pushEv(G, { t: 'dcard' });
    return;
  }
  settle(G, now);
}

function settle(G, now = Date.now()) {
  const d = total(G.dealer.cards).v, dbj = isBlackjack(G.dealer.cards), dbust = d > 21;
  for (const x of G.st) {
    for (const h of x.hands) {
      const v = total(h.cards).v;
      let back = 0; // chips coming back to the stack, the bet included
      if (h.bust) h.res = 'lose';
      else if (h.bj) { if (dbj) { h.res = 'push'; back = h.bet; } else { h.res = 'bj'; back = h.bet + Math.floor(h.bet * 1.5); } }
      else if (dbj) h.res = 'lose';
      else if (dbust || v > d) { h.res = 'win'; back = h.bet * 2; }
      else if (v === d) { h.res = 'push'; back = h.bet; }
      else h.res = 'lose';
      h.done = true; h.pay = back - h.bet; x.stack += back; x.net += h.pay;
    }
  }
  G.stage = 'pay'; G.turn = -1; G.tEnd = 0; G.stageEnd = now + PAY_MS;
  pushEv(G, { t: 'pay', net: G.st.map(x => x.net), d, dbust, dbj });
}

function endRound(G, now = Date.now()) {
  const bust = idx(G).filter(i => !G.st[i].out && G.st[i].stack <= 0);
  bust.sort((a, b) => G.st[a].was - G.st[b].was); // broke on the same round: whoever started it with more places higher
  for (const i of bust) { G.st[i].out = ++G.bustN; pushEv(G, { t: 'out', s: i }); }
  for (const x of G.st) x.bet = 0;
  G.stage = 'wait'; G.stageEnd = now + NEXT_MS;
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = Date.now();
  const order = idx(G).sort((a, b) => {
    const A = G.st[a], B = G.st[b];
    if (!A.out !== !B.out) return A.out ? 1 : -1;
    if (A.out) return B.out - A.out;
    return B.stack - A.stack || a - b;
  });
  G.win = order[0];
  G.res = { order, stacks: G.st.map(x => x.stack), start: START, rounds: G.round };
  pushEv(G, { t: 'end', w: G.win });
}

// ---------- playing a hand ----------
// What the hand whose turn it is may do.
export function options(G, s) {
  if (G.ph !== 'play' || G.stage !== 'play' || G.turn !== s) return null;
  const x = G.st[s], h = x.hands[G.hi];
  if (!h || h.done) return null;
  const two = h.cards.length === 2, afford = x.stack >= h.bet;
  return { hit: true, stand: true, dbl: two && afford, split: two && afford && x.hands.length === 1 && isPair(h.cards) };
}

function doAct(G, s, kind, now = Date.now()) {
  const o = options(G, s); if (!o || !o[kind]) return false;
  const x = G.st[s], h = x.hands[G.hi], hi = G.hi;
  if (kind === 'stand') h.done = true;
  else if (kind === 'hit' || kind === 'dbl') {
    if (kind === 'dbl') { x.stack -= h.bet; h.bet *= 2; h.dbl = true; }
    h.cards.push(draw(G));
    const v = total(h.cards).v;
    if (v > 21) { h.bust = true; h.done = true; }
    else if (v === 21 || kind === 'dbl') h.done = true;
  } else if (kind === 'split') {
    const [a, b] = h.cards, aces = a % 13 === 12;
    x.stack -= h.bet;
    const mk = c => ({ cards: [c, draw(G)], bet: h.bet, done: false, dbl: false, bust: false, bj: false, split: true, res: '', pay: 0 });
    x.hands = [mk(a), mk(b)];
    // split aces get one card each and that is it; a 21 here is a plain 21, not a blackjack
    for (const n of x.hands) if (aces || total(n.cards).v === 21) n.done = true;
  }
  pushEv(G, { t: 'act', s, a: kind, h: hi });
  if (h.bust) pushEv(G, { t: 'bust', s, h: hi });
  nextTurn(G, now);
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  if (a.t === 'bet') return placeBet(G, s, Math.floor(+a.amt));
  if (!['hit', 'stand', 'dbl', 'split'].includes(a.t)) return false;
  return doAct(G, s, a.t);
}

// ---------- bots ----------
// The textbook move for a hand against the dealer's face-up card.
export function basic(cards, up, o) {
  const { v, soft } = total(cards), r = cards[0] % 13;
  if (o.split) {
    if (r === 12 || r === 6) return 'split';                       // aces and eights
    if ([0, 1, 4, 5].includes(r) && up <= 6) return 'split';        // twos, threes, sixes, sevens against a weak card
    if (r === 7 && up <= 9 && up !== 7) return 'split';             // nines
  }
  if (soft) {
    if (v >= 19) return 'stand';
    if (v === 18) return up >= 9 ? 'hit' : o.dbl && up >= 3 && up <= 6 ? 'dbl' : 'stand';
    return o.dbl && up >= 4 && up <= 6 ? 'dbl' : 'hit';
  }
  if (v >= 17) return 'stand';
  if (v >= 13) return up <= 6 ? 'stand' : 'hit';
  if (v === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (v === 11) return o.dbl && up <= 10 ? 'dbl' : 'hit';
  if (v === 10) return o.dbl && up <= 9 ? 'dbl' : 'hit';
  if (v === 9) return o.dbl && up >= 3 && up <= 6 ? 'dbl' : 'hit';
  return 'hit';
}
function botMove(G, s, now) {
  const o = options(G, s), h = G.st[s].hands[G.hi], up = upVal(G);
  let m = basic(h.cards, up, o);
  if (G.opts.bots !== 'sharp' && G.seats[s].bot && !G.seats[s].human) { // chill bots play by feel
    const { v, soft } = total(h.cards);
    if (m === 'split' && h.cards[0] % 13 !== 12 && Math.random() < .5) m = basic(h.cards, up, { ...o, split: false });
    if (m === 'dbl' && (soft || Math.random() < .4)) m = 'hit';
    if (!soft && v >= 12 && v <= 16 && Math.random() < .22) m = m === 'hit' ? 'stand' : 'hit';
  }
  doAct(G, s, m, now);
}
// How much a bot puts down. Sharp bots look at the scoreboard near the end; chill bots just pick a comfy chip.
function botBet(G, s) {
  const x = G.st[s], { min, max } = betRange(x.stack);
  const fit = v => { v = Math.max(min, Math.min(max, Math.round(v / BET_STEP) * BET_STEP)); return betOk(v, x.stack) ? v : x.stack <= max ? x.stack : min; };
  if (G.seats[s].human) return fit(x.last || MIN_BET); // an away player keeps their usual bet
  if (G.opts.bots === 'sharp') {
    const best = Math.max(...idx(G).filter(i => i !== s && live(G, i)).map(i => G.st[i].stack), 0), left = G.rounds - G.round;
    if (left <= 1) return fit(x.stack < best ? best - x.stack + 20 : Math.max(20, (x.stack - best) / 3));
    return fit([40, 50, 50, 60, 80][Math.random() * 5 | 0]);
  }
  return fit([20, 30, 50, 50, 80, 100, 150][Math.random() * 7 | 0]);
}

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'wait') { if (now < G.stageEnd) return false; startRound(G, now); return true; }
  if (G.stage === 'bet') {
    const late = G.tEnd && now >= G.tEnd;
    const s = waiting(G).find(i => (G.seats[i].bot && now >= G.betAt[i]) || late);
    if (s === undefined) return false;
    // out of time: the same bet as last round, or the smallest one
    const x = G.st[s], amt = G.seats[s].bot ? botBet(G, s) : betOk(x.last, x.stack) ? x.last : betRange(x.stack).min;
    placeBet(G, s, amt, now);
    return true;
  }
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; afterDeal(G, now); return true; }
  if (G.stage === 'dealer') { if (now < G.stageEnd) return false; dealerStep(G, now); return true; }
  if (G.stage === 'pay') { if (now < G.stageEnd) return false; endRound(G, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; botMove(G, s, now); return true; }
  if (G.tEnd && now >= G.tEnd) { doAct(G, s, 'stand', now); return true; } // out of time: stand
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  const now = Date.now();
  if (G.turn === s) { G.botAt = now + 600; G.tEnd = away || !G.opts.timer ? 0 : now + G.opts.timer * 1000; }
  if (G.stage === 'bet' && away) G.betAt[s] = now + 600;
  return true;
}

// Someone watching can take over a bot's seat (and its chips) from the next round.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  const n = G.queue.length;
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return G.queue.length !== n || on;
}
function seatQueued(G) {
  while (G.queue.length) {
    const free = idx(G).filter(i => !G.seats[i].human).sort((a, b) => (G.st[b].out ? 0 : 1) - (G.st[a].out ? 0 : 1) || G.st[b].stack - G.st[a].stack);
    if (!free.length) break;
    const p = G.queue.shift(), i = free[0], x = G.st[i];
    if (x.out) { x.out = 0; x.stack = START; }
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now(), betting = G.stage === 'bet';
  const d = G.dealer, dc = d.shown ? d.cards : d.cards.map((c, k) => (k === 1 ? -1 : c));
  const v = {
    game: 'bj', ph: G.ph, stage: G.stage, gid: G.gid, me: s, round: G.round, rounds: G.rounds,
    turn: G.turn, hi: G.hi, timer: G.opts.timer, botsLevel: G.opts.bots, min: MIN_BET, max: MAX_BET,
    left: G.tEnd ? Math.max(0, G.tEnd - now) : 0,
    dealer: { cards: dc, v: total(dc).v, av: d.av, color: d.color, shown: d.shown, bj: d.shown && isBlackjack(d.cards) },
    seats: G.seats.map((x, i) => {
      const t = G.st[i];
      return {
        name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
        stack: t.stack, out: t.out, net: t.net,
        bet: betting && i !== s && t.bet ? -1 : t.bet, // bets stay secret until everyone is in
        hands: t.hands.map(h => ({ cards: h.cards, bet: h.bet, done: h.done, dbl: h.dbl, bust: h.bust, bj: h.bj, split: h.split, res: h.res, pay: h.pay, ...total(h.cards) })),
      };
    }),
    res: G.res, win: G.win, ev: G.ev, queued: G.queue.map(q => q.id),
  };
  if (betting) v.need = waiting(G);
  if (s >= 0 && betting && live(G, s) && !G.st[s].bet) v.betOpt = { ...betRange(G.st[s].stack), last: G.st[s].last, step: BET_STEP };
  const o = s >= 0 ? options(G, s) : null; if (o) v.opt = o;
  return v;
}

// Final placing: 10 points per player you finished ahead of, plus a point for every 25 chips you ended up.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + Math.max(0, Math.floor((G.st[i].stack - START) / 25)), win: place === 0, place: place + 1 };
  });
}

// Texas Hold'em: authoritative no-limit hold'em with pretend chips, played as a short tournament.
// Everyone starts with the same stack, blinds creep up, and the game ends after a set number of hands
// (or when one player has every chip). Bots fill empty seats. Nobody ever sees another hand until showdown.
import { score, handName, rankOf, suitOf } from '../../public/games/poker/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'poker', name: "Texas Hold'em", minPlayers: 1, maxPlayers: 6, joinAt: 'hand' };

const BOT_NAMES = ['Truffle', 'Waffles', 'Clover', 'Nugget', 'Pudding', 'Maple', 'Toffee', 'Sprout'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const START = 1000;
export const BLINDS = [[10, 20], [20, 40], [30, 60], [50, 100], [100, 200], [150, 300], [250, 500], [400, 800], [600, 1200], [1000, 2000]];
export const LEVEL_HANDS = 4; // blinds go up every this many hands
const DROP_BOT_MS = [900, 2600]; // bots take this long to pick a card to throw away
const STREET_MS = 900, RUNOUT_MS = 1700, SHOW_MS = 6000, FOLDWIN_MS = 2600, FIRST_MS = 1500;

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rnd = (a, b) => a + Math.random() * (b - a);

// Which poker game the table plays. Each variant says how many hole cards you get; Hold'em is the default.
export const VARIANTS = {
  holdem: { name: "Texas Hold'em", hole: 2 },
  // Mango Poker (Kuba's house game): three cards each, everyone throws one away before the betting starts,
  // and the flop is three cards picked at random from that thrown-away pile. Needs at least 4 seats.
  mango: { name: 'Mango Poker', hole: 3, drop: true, minSeats: 4 },
};
const variantOf = G => VARIANTS[G.opts.variant] || VARIANTS.holdem;

export function cleanOpts(o = {}) {
  return {
    variant: VARIANTS[o.variant] ? o.variant : 'holdem',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    field: Math.max(VARIANTS[o.variant]?.minSeats || 2, [2, 4, 6].includes(+o.field) ? +o.field : 6),
    hands: [10, 20, 0].includes(+o.hands) ? +o.hands : 10,
    timer: [0, 20, 30, 45].includes(+o.timer) ? +o.timer : 30,
  };
}

export function create(players, optsIn = {}, prev = null) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = shuffle(BOT_NAMES.filter(n => !used.has(n)));
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(2, opts.field)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length;
  const G = {
    game: 'poker', ph: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    st: seats.map(() => ({ stack: START, bet: 0, in: 0, fold: false, allin: false, acted: false, out: 0, cards: [], shown: false, last: '' })),
    hand: 0, hands: opts.hands, level: 0, sb: BLINDS[0][0], bb: BLINDS[0][1],
    dealer: prev?.game === 'poker' && Number.isInteger(prev.dealer) ? prev.dealer % n : Math.random() * n | 0,
    sbI: -1, bbI: -1, stage: 'deal', board: [], deck: [], turn: -1, cur: 0, minRaise: 0,
    next: null, stageEnd: Date.now() + FIRST_MS, tEnd: 0, botAt: 0, bustN: 0,
    handRes: null, pile: [], ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const live = (G, i) => !G.st[i].out;
const inHand = (G, i) => live(G, i) && !G.st[i].fold;
const canAct = (G, i) => inHand(G, i) && !G.st[i].allin;
const nextFrom = (G, i, ok) => { const n = G.seats.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (ok(j)) return j; } return -1; };
const potTotal = G => G.st.reduce((a, x) => a + x.in, 0);

// ---------- hands ----------
function startHand(G, now = Date.now()) {
  const alive = G.seats.map((_, i) => i).filter(i => G.st[i].stack > 0 && !G.st[i].out);
  if (alive.length < 2 || (G.hands && G.hand >= G.hands)) return finish(G);
  seatQueued(G);
  G.hand++;
  const lv = Math.min(BLINDS.length - 1, Math.floor((G.hand - 1) / LEVEL_HANDS));
  if (lv !== G.level) { G.level = lv; pushEv(G, { t: 'blinds', sb: BLINDS[lv][0], bb: BLINDS[lv][1] }); }
  [G.sb, G.bb] = BLINDS[G.level];
  for (const x of G.st) Object.assign(x, { bet: 0, in: 0, fold: !!x.out, allin: false, acted: false, cards: [], shown: false, last: '' });
  G.dealer = nextFrom(G, G.dealer, i => live(G, i));
  const heads = alive.length === 2;
  G.sbI = heads ? G.dealer : nextFrom(G, G.dealer, i => live(G, i));
  G.bbI = nextFrom(G, G.sbI, i => live(G, i));
  G.deck = shuffle([...Array(52).keys()]); G.board = []; G.pile = []; G.handRes = null;
  for (let r = 0; r < variantOf(G).hole; r++) for (let k = 1; k <= G.seats.length; k++) { const i = (G.dealer + k) % G.seats.length; if (live(G, i)) G.st[i].cards.push(G.deck.pop()); }
  post(G, G.sbI, G.sb); post(G, G.bbI, G.bb);
  G.st[G.sbI].last = 'Small blind'; G.st[G.bbI].last = 'Big blind';
  G.cur = G.bb; G.minRaise = G.bb; G.stage = 'pre'; G.next = null;
  pushEv(G, { t: 'hand', hand: G.hand, dealer: G.dealer, sb: G.sbI, bb: G.bbI });
  G.turn = -1;
  if (variantOf(G).drop) return startDrop(G, now);
  startBetting(G, now);
}

function startBetting(G, now = Date.now()) {
  G.stage = 'pre';
  const first = nextFrom(G, G.bbI, i => canAct(G, i));
  if (first < 0 || needers(G).length === 0) return streetOver(G, now);
  setTurn(G, first, now);
}

function post(G, i, amt) {
  const x = G.st[i], a = Math.min(amt, x.stack);
  x.stack -= a; x.bet += a; x.in += a; if (!x.stack) x.allin = true;
}

function setTurn(G, i, now = Date.now()) {
  G.turn = i;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(800, 1900);
}

// Seats that still have to do something this street.
function needers(G) {
  const act = G.seats.map((_, i) => i).filter(i => canAct(G, i));
  if (act.length === 1 && G.st[act[0]].bet >= G.cur) return []; // everyone else is all in: nothing to decide
  return act.filter(i => !G.st[i].acted || G.st[i].bet < G.cur);
}

function advance(G, now = Date.now()) {
  const left = G.seats.map((_, i) => i).filter(i => inHand(G, i));
  if (left.length === 1) return winByFold(G, left[0], now);
  const need = needers(G);
  if (!need.length) return streetOver(G, now);
  setTurn(G, nextFrom(G, G.turn, i => need.includes(i)), now);
}

function streetOver(G, now = Date.now()) {
  for (const x of G.st) { x.bet = 0; x.acted = false; }
  G.cur = 0; G.minRaise = G.bb; G.turn = -1; G.tEnd = 0;
  const actors = G.seats.map((_, i) => i).filter(i => canAct(G, i)).length;
  const runout = actors <= 1;
  if (runout && !G.runout) { // all in and called: everyone still in shows their cards while the board runs out
    G.runout = true;
    for (let i = 0; i < G.seats.length; i++) if (inHand(G, i)) G.st[i].shown = true;
    if (G.board.length < 5) pushEv(G, { t: 'reveal' });
  }
  G.next = G.board.length === 0 ? 'flop' : G.board.length === 3 ? 'turn' : G.board.length === 4 ? 'river' : 'show';
  G.stageEnd = now + (runout ? RUNOUT_MS : STREET_MS);
}

function dealStreet(G, now = Date.now()) {
  const k = G.next; G.next = null;
  if (k === 'show') return showdown(G, now);
  const n = k === 'flop' ? 3 : 1;
  let fromPile = 0;
  if (k === 'flop' && G.pile.length) { // Mango: the flop comes out of the thrown-away cards (topped up from the deck if too few are left in the game)
    shuffle(G.pile);
    while (G.board.length < 3 && G.pile.length) { G.board.push(G.pile.pop()); fromPile++; }
  }
  if (fromPile < n) G.deck.pop(); // burn
  const want = k === 'flop' ? 3 : G.board.length + 1;
  while (G.board.length < want) G.board.push(G.deck.pop());
  G.stage = k;
  for (const x of G.st) if (!x.fold && !x.allin && !x.out) x.last = '';
  pushEv(G, { t: 'street', k, cards: G.board.slice(-n), pile: fromPile });
  if (G.runout) { G.next = G.board.length < 5 ? (G.board.length === 3 ? 'turn' : 'river') : 'show'; G.stageEnd = now + RUNOUT_MS; return; }
  const first = nextFrom(G, G.dealer, i => canAct(G, i));
  if (first < 0 || !needers(G).length) return streetOver(G, now);
  setTurn(G, first, now);
}

// Main pot and side pots, built in layers from what everyone put in.
export function pots(G) {
  const levels = [...new Set(G.st.filter(x => x.in > 0).map(x => x.in))].sort((a, b) => a - b);
  const out = []; let prev = 0;
  for (const lv of levels) {
    let amt = 0;
    for (const x of G.st) amt += Math.max(0, Math.min(x.in, lv) - prev);
    const elig = G.seats.map((_, i) => i).filter(i => inHand(G, i) && G.st[i].in >= lv);
    if (amt > 0) {
      const last = out[out.length - 1];
      if (last && last.elig.join() === elig.join()) last.amt += amt; else out.push({ amt, elig });
    }
    prev = lv;
  }
  return out;
}

function award(G, list) { // list: [{amt, elig}] -> pays winners, returns result pots
  const sc = G.st.map((x, i) => (inHand(G, i) ? score([...x.cards, ...G.board]) : -1));
  return list.map(p => {
    let elig = p.elig.length ? p.elig : G.seats.map((_, i) => i).filter(i => inHand(G, i));
    if (!elig.length) elig = [G.dealer];
    const best = Math.max(...elig.map(i => sc[i])), win = elig.filter(i => sc[i] === best);
    // odd chips go to the first winner left of the button
    win.sort((a, b) => ((a - G.dealer - 1 + 99 * G.seats.length) % G.seats.length) - ((b - G.dealer - 1 + 99 * G.seats.length) % G.seats.length));
    const each = Math.floor(p.amt / win.length); let odd = p.amt - each * win.length;
    const paid = win.map(i => { const a = each + (odd-- > 0 ? 1 : 0); G.st[i].stack += a; return a; });
    return { amt: p.amt, win, paid, name: best >= 0 ? handName(best) : '' };
  });
}

function showdown(G, now = Date.now()) {
  G.stage = 'show'; G.turn = -1; G.tEnd = 0;
  const contenders = G.seats.map((_, i) => i).filter(i => inHand(G, i));
  for (const i of contenders) G.st[i].shown = true;
  const res = award(G, pots(G));
  G.handRes = { pots: res, fold: false, names: G.st.map((x, i) => (contenders.includes(i) ? handName(score([...x.cards, ...G.board])) : '')) };
  pushEv(G, { t: 'show', pots: res.map(p => ({ amt: p.amt, win: p.win, name: p.name })) });
  G.stageEnd = now + SHOW_MS;
}

function winByFold(G, w, now = Date.now()) {
  G.stage = 'show'; G.turn = -1; G.tEnd = 0; G.next = null;
  for (const x of G.st) x.bet = 0;
  const amt = potTotal(G); G.st[w].stack += amt;
  G.handRes = { pots: [{ amt, win: [w], paid: [amt], name: '' }], fold: true, names: [] };
  pushEv(G, { t: 'show', pots: [{ amt, win: [w], name: '' }], fold: true });
  G.stageEnd = now + FOLDWIN_MS;
}

function endHand(G, now = Date.now()) {
  G.runout = false;
  const bust = G.seats.map((_, i) => i).filter(i => !G.st[i].out && G.st[i].stack <= 0);
  // players knocked out on the same hand: the one who started it with more chips places higher
  bust.sort((a, b) => G.st[a].in - G.st[b].in);
  for (const i of bust) { G.st[i].out = ++G.bustN; G.st[i].fold = true; pushEv(G, { t: 'bust', s: i }); }
  startHand(G, now);
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.endAt = Date.now();
  const n = G.seats.length, idx = G.seats.map((_, i) => i);
  const order = idx.sort((a, b) => {
    const A = G.st[a], B = G.st[b];
    if (!A.out !== !B.out) return A.out ? 1 : -1;
    if (A.out) return B.out - A.out;
    return B.stack - A.stack;
  });
  G.win = order[0];
  G.res = { order, stacks: G.st.map(x => x.stack), start: START, hands: G.hand };
  pushEv(G, { t: 'end', w: G.win });
}

// ---------- Mango: throw one card away ----------
// Everyone still in the hand picks at the same time. Humans get the turn timer; bots and away players pick on their own.
const dropping = G => G.seats.map((_, i) => i).filter(i => live(G, i) && G.st[i].cards.length > 2);
function startDrop(G, now = Date.now()) {
  G.stage = 'drop'; G.turn = -1;
  G.tEnd = G.opts.timer ? now + G.opts.timer * 1000 + 3000 : 0; // a bit longer than a bet: it's a new kind of choice
  G.dropAt = G.seats.map(() => now + rnd(...DROP_BOT_MS));
  pushEv(G, { t: 'drop' });
}
function doDrop(G, s, c) {
  const x = G.st[s], k = x.cards.indexOf(c);
  if (G.stage !== 'drop' || k < 0 || x.cards.length <= 2) return false;
  x.cards.splice(k, 1); G.pile.push(c);
  pushEv(G, { t: 'dropped', s });
  if (!dropping(G).length) {
    pushEv(G, { t: 'pile', n: G.pile.length });
    G.tEnd = 0; startBetting(G);
  }
  return true;
}
// Which card a bot (or a timed-out player) throws away: the one whose loss hurts the other two least.
export function botDrop(cards, sims = 120) {
  let best = cards[0], bestEq = -1;
  for (const c of cards) {
    const keep = cards.filter(k => k !== c), eq = equity(keep, [], 3, sims);
    if (eq > bestEq) { bestEq = eq; best = c; }
  }
  return best;
}

// ---------- actions ----------
function doAct(G, s, a, now = Date.now()) {
  const x = G.st[s], toCall = G.cur - x.bet;
  let kind = a.t, ev = null;
  if (kind === 'allin') kind = x.bet + x.stack > G.cur ? 'raise' : 'call';
  if (kind === 'call' && toCall <= 0) kind = 'check';
  if (kind === 'fold') {
    if (toCall <= 0 && !a.force) kind = 'check'; // never fold for free
    else { x.fold = true; x.last = 'Fold'; ev = { a: 'fold' }; }
  }
  if (kind === 'check') {
    if (toCall > 0) return false;
    x.last = 'Check'; ev = { a: 'check' };
  } else if (kind === 'call') {
    const amt = Math.min(toCall, x.stack);
    x.stack -= amt; x.bet += amt; x.in += amt;
    if (!x.stack) x.allin = true;
    // the bubble names the level matched, so a small blind completing reads "Call 20", not "Call 10"
    x.last = x.allin ? 'All in' : `Call ${x.bet}`; ev = { a: x.allin ? 'allin' : 'call', amt };
  } else if (kind === 'raise') {
    const max = x.bet + x.stack;
    let to = a.t === 'allin' ? max : Math.floor(+a.to);
    if (!Number.isFinite(to)) return false;
    to = Math.min(to, max);
    const minTo = G.cur + G.minRaise;
    if (to <= G.cur) return false;
    if (to < minTo && to < max) to = Math.min(minTo, max);
    const amt = to - x.bet, by = to - G.cur;
    x.stack -= amt; x.bet = to; x.in += amt;
    if (!x.stack) x.allin = true;
    if (by >= G.minRaise) G.minRaise = by;
    const opened = G.cur === 0;
    G.cur = to;
    for (let i = 0; i < G.st.length; i++) if (i !== s) G.st[i].acted = false;
    x.last = x.allin ? 'All in' : opened ? `Bet ${to}` : `Raise to ${to}`;
    ev = { a: x.allin ? 'allin' : opened ? 'bet' : 'raise', amt, to };
  } else if (kind !== 'fold') return false;
  x.acted = true;
  pushEv(G, { t: 'act', s, ...ev });
  advance(G, now);
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (a.t === 'drop') return G.ph === 'play' && doDrop(G, s, +a.c);
  if (G.ph !== 'play' || G.turn !== s || G.next) return false;
  if (!['fold', 'check', 'call', 'raise', 'allin'].includes(a.t)) return false;
  return doAct(G, s, { t: a.t, to: a.to, force: true });
}

// ---------- bots ----------
// Monte Carlo: how often do these hole cards win against `opp` random hands, given the board?
export function equity(cards, board, opp, sims = 200) {
  const known = new Set([...cards, ...board]);
  const rest = [...Array(52).keys()].filter(c => !known.has(c));
  let won = 0;
  for (let t = 0; t < sims; t++) {
    const need = 5 - board.length + opp * 2;
    for (let i = 0; i < need; i++) { const j = i + (Math.random() * (rest.length - i) | 0); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const bd = board.concat(rest.slice(0, 5 - board.length));
    const mine = score([...cards, ...bd]);
    let best = -1, ties = 0;
    for (let o = 0; o < opp; o++) {
      const k = 5 - board.length + o * 2, v = score([rest[k], rest[k + 1], ...bd]);
      if (v > best) { best = v; ties = 0; }
      if (v === best) ties++;
    }
    if (mine > best) won++; else if (mine === best) won += 1 / (ties + 1);
  }
  return won / sims;
}

function botMove(G, s, now) {
  const x = G.st[s], sharp = G.opts.bots === 'sharp';
  const opp = G.seats.filter((_, i) => i !== s && inHand(G, i)).length;
  let eq = equity(x.cards, G.board, Math.max(1, opp), sharp ? 260 : 140);
  if (!sharp) eq += rnd(-.08, .08);
  const fair = 1 / (opp + 1), rel = eq / fair;
  const pot = potTotal(G), toCall = G.cur - x.bet, bb = G.bb;
  const agg = sharp ? 1.45 : 1.85;
  const roundTo = v => Math.max(bb, Math.round(v / (bb / 2)) * (bb / 2));
  const raise = (to) => {
    to = Math.max(G.cur + G.minRaise, roundTo(to));
    if (to >= (x.bet + x.stack) * .75) return doAct(G, s, { t: 'allin' }, now);
    return doAct(G, s, { t: 'raise', to }, now);
  };
  // pairs and big cards preflop deserve a little extra love, whatever the simulation says
  if (!G.board.length) { const [a, b] = x.cards.map(rankOf); if (a === b && a >= 8) eq += .05; if (suitOf(x.cards[0]) === suitOf(x.cards[1])) eq += .015; }
  if (toCall <= 0) {
    if (rel > agg && Math.random() < (sharp ? .8 : .55)) return raise(G.cur + pot * rnd(.45, .8));
    if (rel > 1.1 && Math.random() < (sharp ? .3 : .15)) return raise(G.cur + pot * rnd(.35, .6)); // a little poke
    if (sharp && opp <= 2 && Math.random() < .1) return raise(G.cur + pot * .5); // the odd bluff
    return doAct(G, s, { t: 'check' }, now);
  }
  const odds = toCall / (pot + toCall);
  if (rel > agg + .3 && Math.random() < (sharp ? .65 : .35) && x.stack > toCall) return raise(G.cur + Math.max(G.minRaise, pot * .75));
  if (eq + (sharp ? 0 : .05) >= odds) return doAct(G, s, { t: 'call' }, now);
  if (toCall <= bb && Math.random() < (sharp ? .2 : .4)) return doAct(G, s, { t: 'call' }, now);
  if (!sharp && toCall <= x.stack * .08 && Math.random() < .25) return doAct(G, s, { t: 'call' }, now);
  return doAct(G, s, { t: 'fold', force: true }, now);
}

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; startHand(G, now); return true; }
  if (G.stage === 'show') { if (now < G.stageEnd) return false; endHand(G, now); return true; }
  if (G.next) { if (now < G.stageEnd) return false; dealStreet(G, now); return true; }
  if (G.stage === 'drop') {
    const late = G.tEnd && now >= G.tEnd;
    const s = dropping(G).find(i => (G.seats[i].bot && now >= G.dropAt[i]) || late);
    if (s === undefined) return false;
    doDrop(G, s, botDrop(G.st[s].cards, G.opts.bots === 'sharp' && G.seats[s].bot ? 160 : 90));
    return true;
  }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; botMove(G, s, now); return true; }
  if (G.tEnd && now >= G.tEnd) { // out of time: check if you can, fold if you can't
    doAct(G, s, { t: G.cur > G.st[s].bet ? 'fold' : 'check', force: true }, now);
    return true;
  }
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s) { G.botAt = Date.now() + 600; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

// A player who left can come back to their seat while it still has chips (the server checks who they are).
export const canReturn = (G, s) => !G.st[s].out;

// Someone watching can take over a bot's seat (and its chips) from the next hand.
// Called by the server when a watcher taps "Take a seat" (on = true) or changes their mind (on = false).
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  const n = G.queue.length;
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return G.queue.length !== n || on;
}
function seatQueued(G) {
  while (G.queue.length) {
    // prefer a bot that still has chips, and never one that's in the middle of a hand (we're between hands here)
    const free = G.seats.map((s, i) => i).filter(i => !G.seats[i].human).sort((a, b) => (G.seats[a].left ? 1 : 0) - (G.seats[b].left ? 1 : 0) || (G.st[b].out ? 0 : 1) - (G.st[a].out ? 0 : 1) || G.st[b].stack - G.st[a].stack); // seats of people who left come last: they may be back
    if (!free.length) break;
    const p = G.queue.shift(), i = free[0], x = G.st[i];
    if (x.out) { x.out = 0; x.stack = START; }
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true, left: false });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now(), showAll = G.ph === 'end';
  const v = {
    game: 'poker', variant: G.opts.variant, variantName: variantOf(G).name, ph: G.ph, stage: G.stage, gid: G.gid, me: s, hand: G.hand, hands: G.hands,
    sb: G.sb, bb: G.bb, level: G.level, levelHands: LEVEL_HANDS, next: BLINDS[Math.min(BLINDS.length - 1, G.level + 1)],
    dealer: G.dealer, sbI: G.sbI, bbI: G.bbI, turn: G.turn, cur: G.cur, minRaise: G.minRaise,
    left: G.turn >= 0 && G.tEnd ? Math.max(0, G.tEnd - now) : 0, timer: G.opts.timer, botsLevel: G.opts.bots,
    board: G.board, pot: potTotal(G), dealing: !!G.next,
    seats: G.seats.map((x, i) => {
      const t = G.st[i], mine = i === s;
      return {
        name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
        stack: t.stack, bet: t.bet, in: t.in, fold: t.fold, allin: t.allin, out: t.out, last: t.last,
        cards: mine || t.shown || (showAll && t.cards.length) ? t.cards : t.cards.map(() => -1),
      };
    }),
    handRes: G.handRes, res: G.res, win: G.win, ev: G.ev,
    queued: G.queue.map(q => q.id),
  };
  if (G.stage === 'drop') {
    v.drop = { need: dropping(G), pile: G.pile.length };
    v.left = G.tEnd ? Math.max(0, G.tEnd - now) : 0;
  }
  if (s >= 0 && G.turn === s && !G.next) {
    const x = G.st[s], max = x.bet + x.stack;
    v.opt = { toCall: Math.min(G.cur - x.bet, x.stack), minTo: Math.min(max, G.cur + G.minRaise), maxTo: max, canRaise: max > G.cur };
  }
  return v;
}

// Final placing: 10 points per player you outlasted, plus a point for every 25 chips you finished up.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + Math.max(0, Math.floor((G.st[i].stack - START) / 25)), win: place === 0, place: place + 1 };
  });
}

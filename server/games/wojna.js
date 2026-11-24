// Wojna (War), the Polish children's classic. Everyone turns over the top card of their pile and the highest
// takes them all. Equal highest cards mean "wojna": those players put one card face down and one face up, and
// the higher new card takes everything on the table. The game is pure luck and could go on for hours, so a table
// plays a set number of battles and then whoever holds the most cards wins.
// Nobody, not even the owner, is ever sent the order of a pile or a face-down card.
import { rankOf, deckFor, seatsFor, highest, ROUNDS, TIMERS } from '../../public/games/wojna/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'wojna', name: 'Wojna', minPlayers: 1, maxPlayers: 4 };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// deal: cards fly out; show: the winning card is admired before the cards are swept up (longer after a war);
// war: the "Wojna!" call before the extra cards go down; bot: how soon a bot turns its card
export const MS = { deal: 1800, show: 950, showWar: 1500, war: 1000, bot: [250, 750] };
export const EXTRA = 20; // at most this many tie-break battles after the last one

const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = d => { for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; };

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4].includes(+o.seats) ? +o.seats : 2,
    deck: o.deck === 'small' ? 'small' : 'full',
    rounds: ROUNDS.includes(+o.rounds) ? +o.rounds : 60,
    timer: TIMERS.includes(+o.timer) ? +o.timer : 5,
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
  const d = shuffle(deckFor(opts.deck, n));
  const now = Date.now();
  return {
    game: 'wojna', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    decks: seats.map((_, i) => d.filter((_, k) => k % n === i)), total: d.length,
    tbl: seats.map(() => []),           // what each seat has put down in this battle: { c, up }
    inn: [], need: seats.map(() => false), war: 0, bw: -1, coin: false,
    rnd: 0, mv: 0, extra: false, out: seats.map(() => 0), outN: 0,
    st: seats.map(() => ({ won: 0, wars: 0, best: 0 })),
    last: null, stageEnd: now + MS.deal, tEnd: 0, botAt: seats.map(() => 0), ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const topUp = (G, s) => { const t = G.tbl[s]; return t.length ? t[t.length - 1].c : -1; };

// everyone still in this battle who has a card left gets to turn one over
function askFlips(G, now) {
  G.stage = 'flip'; G.mv++;
  G.need = G.seats.map((_, i) => G.inn.includes(i) && G.decks[i].length > 0);
  G.botAt = G.seats.map(() => now + rnd(...MS.bot));
  G.tEnd = now + G.opts.timer * 1000;
}
function startBattle(G, now) {
  G.tbl = G.seats.map(() => []); G.war = 0; G.bw = -1; G.coin = false;
  G.inn = G.seats.map((_, i) => i).filter(i => G.decks[i].length > 0);
  askFlips(G, now);
}

function doFlip(G, s, now) {
  if (G.stage !== 'flip' || !G.need[s]) return false;
  const d = G.decks[s];
  if (G.war && d.length >= 2) G.tbl[s].push({ c: d.shift(), up: false }); // a player down to their last card keeps it for the face-up one
  const c = d.shift(); G.tbl[s].push({ c, up: true });
  G.need[s] = false; G.mv++;
  pushEv(G, { t: 'flip', s, c, war: G.war });
  if (!G.need.some(Boolean)) settle(G, now);
  return true;
}

// all the cards are up: one highest card wins the lot, equal highest cards go to war
function settle(G, now) {
  const tied = highest(G.inn.map(s => [s, topUp(G, s)]));
  if (tied.length > 1 && tied.some(s => G.decks[s].length > 0)) {
    G.inn = tied; G.war++; G.stage = 'war'; G.stageEnd = now + MS.war; G.mv++; G.tEnd = 0;
    pushEv(G, { t: 'war', seats: tied, depth: G.war, r: rankOf(topUp(G, tied[0])) });
    return;
  }
  // a tie nobody has a card left to break is settled by the toss of a coin
  G.coin = tied.length > 1; G.bw = tied[Math.random() * tied.length | 0];
  G.stage = 'show'; G.stageEnd = now + (G.war ? MS.showWar : MS.show); G.mv++; G.tEnd = 0;
  pushEv(G, { t: 'win', s: G.bw, k: G.tbl.reduce((a, t) => a + t.length, 0), war: G.war, coin: G.coin });
}

// the winner sweeps up everything on the table; the cards go under their pile in a mixed-up order
function collect(G, now) {
  const s = G.bw, cards = shuffle(G.tbl.flatMap(t => t.map(x => x.c)));
  G.decks[s].push(...cards);
  const st = G.st[s]; st.won++; if (G.war) st.wars++; st.best = Math.max(st.best, cards.length);
  G.last = { s, k: cards.length, war: G.war, rnd: G.rnd + 1 };
  G.tbl = G.seats.map(() => []); G.rnd++; G.mv++;
  const gone = G.seats.map((_, i) => i).filter(i => !G.out[i] && !G.decks[i].length);
  if (gone.length) { G.outN++; for (const i of gone) { G.out[i] = G.outN; pushEv(G, { t: 'out', s: i }); } } // knocked out in the same battle = the same place
  if (G.decks.filter(d => d.length).length < 2) return finish(G);
  if (G.rnd >= G.opts.rounds) { // the last battle is over: equal biggest piles play on until one battle parts them
    const most = Math.max(...G.decks.map(d => d.length));
    if (G.decks.filter(d => d.length === most).length < 2 || G.rnd >= G.opts.rounds + EXTRA) return finish(G);
    if (!G.extra) { G.extra = true; pushEv(G, { t: 'extra' }); }
  }
  startBattle(G, now);
}

// Better = more cards; players with no cards rank by how long they lasted.
const score = (G, i) => (G.decks[i].length ? 1000 + G.decks[i].length : G.out[i]);
function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.tEnd = 0; G.endAt = Date.now(); G.need = G.seats.map(() => false); G.inn = []; G.bw = -1;
  const order = G.seats.map((_, i) => i).sort((a, b) => score(G, b) - score(G, a) || G.st[b].won - G.st[a].won);
  G.win = order[0];
  G.res = {
    order, place: G.seats.map((_, i) => 1 + G.seats.filter((_, j) => score(G, j) > score(G, i)).length),
    left: G.decks.map(d => d.length), rounds: G.rnd, capped: G.decks.filter(d => d.length).length > 1,
  };
  pushEv(G, { t: 'end', w: G.win });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || a.t !== 'flip') return false;
  return doFlip(G, s, Date.now());
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; startBattle(G, now); return true; }
  if (G.stage === 'war') { if (now < G.stageEnd) return false; askFlips(G, now); return true; }
  if (G.stage === 'show') { if (now < G.stageEnd) return false; collect(G, now); return true; }
  let moved = false;
  for (let s = 0; s < G.seats.length && G.stage === 'flip'; s++) {
    if (!G.need[s]) continue;
    if (G.seats[s].bot ? now >= G.botAt[s] : now >= G.tEnd) { doFlip(G, s, now); moved = true; } // waited too long: the card is turned for them
  }
  return moved;
}

// A player who drops out has their cards turned by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (away) G.botAt[s] = Date.now() + 500;
  return true;
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'wojna', ph: G.ph, stage: G.stage, gid: G.gid, me: s, mv: G.mv, rnd: G.rnd, rounds: G.opts.rounds, total: G.total, deck: G.opts.deck,
    war: G.war, inn: G.inn, bw: G.bw, extra: G.extra, coin: G.coin, last: G.last, timer: G.opts.timer,
    tLeft: G.stage === 'flip' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    dealLeft: G.stage === 'deal' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.decks[i].length, need: G.need[i], out: G.out[i], st: G.st[i],
      tbl: G.tbl[i].map(t => (t.up ? t.c : -1)), // face-down cards stay a secret
    })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// 10 points for every player you finished ahead of; equal piles share a place.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => ({ pts: (n - G.res.place[i]) * 10, win: G.res.place[i] === 1, place: G.res.place[i] }));
}

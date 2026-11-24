// Sky Bingo: a ball machine calls numbers from 1 to 75, one every few seconds. Everyone has their own 5×5 card,
// daubs the called numbers themselves and shouts Bingo when the pattern is done: the quicker hand takes the prize.
// A classic game has three prizes on the same cards (a line, two lines, the full card); a quick one stops at the line.
// Empty seats are played by bots, which daub and shout with a human-like delay.
import { BALLS, MID, GAMES, PTS, SPEED, newCard, has, toGo, count } from '../../public/games/bingo/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'bingo', name: 'Sky Bingo', minPlayers: 1, maxPlayers: 8, seats: { lo: 2, def: 4 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle', 'Toffee', 'Sprout', 'Maple', 'Pudding'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// count: before the first ball; cheer: the machine waits this long after a prize; last: after the last ball, time to still shout
export const MS = { count: 3600, cheer: 4200, last: 12000 };
// How quickly a bot daubs a called number and shouts once its pattern is done (ms, from-to).
export const BOTS = { chill: { daub: [1300, 3600], shout: [1500, 3200] }, sharp: { daub: [600, 1700], shout: [700, 1500] } };
const rnd = ([a, b]) => a + Math.random() * (b - a);

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    game: o.game === 'quick' ? 'quick' : 'classic',
    speed: Object.hasOwn(SPEED, o.speed) ? o.speed : 'normal',
    daub: o.daub === 'auto' ? 'auto' : 'hand',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)).sort(() => Math.random() - .5), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const bag = Array.from({ length: BALLS }, (_, i) => i + 1);
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; }
  const now = Date.now();
  return {
    game: 'bingo', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    goals: GAMES[opts.game], gi: 0, gap: SPEED[opts.speed],
    cards: seats.map(() => newCard()), mask: seats.map(() => 1 << MID),
    bag, called: [], is: new Array(BALLS + 1).fill(false), nextAt: now + MS.count, stageEnd: 0, lastAt: 0,
    pts: seats.map(() => 0), wins: [], st: seats.map(() => ({ hand: 0, shouts: 0 })),
    pend: seats.map(() => new Array(25).fill(0)), shoutAt: seats.map(() => 0),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const goal = G => G.goals[G.gi];
const open = G => G.ph === 'play' && (G.stage === 'play' || G.stage === 'last');

function daub(G, s, c) {
  if (!Number.isInteger(c) || c < 0 || c > 24) return false;
  const n = G.cards[s][c];
  if (!n || !G.is[n] || G.mask[s] & 1 << c) return false;
  G.mask[s] |= 1 << c; G.pend[s][c] = 0;
  return true;
}
function shout(G, s, now) {
  if (!open(G) || !has(goal(G), G.mask[s])) return false;
  const g = goal(G);
  G.pts[s] += PTS[g]; G.st[s].shouts++;
  G.wins.push({ g, s, balls: G.called.length });
  pushEv(G, { t: 'win', s, g, pts: PTS[g], balls: G.called.length });
  G.shoutAt.fill(0);
  if (G.gi >= G.goals.length - 1) return finish(G, now);
  // the machine stops for a moment, then carries on from where it was
  const left = G.stage === 'last' ? -1 : Math.max(900, G.nextAt - now);
  G.gi++; G.stage = 'cheer'; G.stageEnd = now + MS.cheer; G.resume = left;
  return true;
}
function call(G, now) {
  const n = G.bag.pop();
  G.called.push(n); G.is[n] = true;
  pushEv(G, { t: 'call', n, k: G.called.length });
  // with automatic daubing the number is marked on every person's card straight away
  if (G.opts.daub === 'auto') G.seats.forEach((x, s) => { if (!x.bot) { const c = G.cards[s].indexOf(n); if (c >= 0) daub(G, s, c); } });
  if (G.bag.length) G.nextAt = now + G.gap;
  else { G.stage = 'last'; G.lastAt = now; }
}
function finish(G, now) {
  G.ph = 'end'; G.stage = 'end'; G.endAt = now;
  // most points first; level on points, the card nearer to full is ahead; still level, they share the place
  const left = G.mask.map(m => toGo('full', m));
  const ahead = (a, b) => G.pts[a] > G.pts[b] || (G.pts[a] === G.pts[b] && left[a] < left[b]);
  const place = G.seats.map((_, i) => 1 + G.seats.filter((_, j) => ahead(j, i)).length);
  const order = G.seats.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
  G.win = order[0];
  G.res = { pts: G.pts.slice(), left, place, order, wins: G.wins, balls: G.called.length };
  pushEv(G, { t: 'end', w: place.filter(p => p === 1).length === 1 ? G.win : -1 });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  if (a.t === 'daub') { if (!daub(G, s, a.c)) return false; G.st[s].hand++; return true; }
  if (a.t === 'bingo') return shout(G, s, Date.now());
  return false;
}

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  let ch = false;
  if (G.stage === 'count') { if (now >= G.nextAt) { G.stage = 'play'; call(G, now); ch = true; } }
  else if (G.stage === 'cheer') {
    if (now >= G.stageEnd) {
      pushEv(G, { t: 'goal', g: goal(G) });
      if (G.resume < 0) { G.stage = 'last'; G.lastAt = now; } else { G.stage = 'play'; G.nextAt = now + G.resume; }
      ch = true;
    }
  } else if (G.stage === 'play') { if (now >= G.nextAt) { call(G, now); ch = true; } }
  else if (G.stage === 'last' && now >= G.lastAt + MS.last) return finish(G, now); // every ball is out and nobody shouts
  // bots (and people who are away): daub what has been called after a moment, shout a moment after the pattern is done
  if (G.stage !== 'count' && G.stage !== 'end') {
    const B = BOTS[G.opts.bots] || BOTS.chill;
    for (let s = 0; s < G.seats.length; s++) {
      if (!G.seats[s].bot) continue;
      const card = G.cards[s], pend = G.pend[s];
      for (let c = 0; c < 25; c++) {
        if (!card[c] || !G.is[card[c]] || G.mask[s] & 1 << c) continue;
        if (!pend[c]) pend[c] = now + rnd(B.daub);
        else if (now >= pend[c] && daub(G, s, c)) ch = true;
      }
      if (open(G) && has(goal(G), G.mask[s])) {
        if (!G.shoutAt[s]) G.shoutAt[s] = now + rnd(B.shout);
        else if (now >= G.shoutAt[s]) return shout(G, s, now);
      }
    }
  }
  return ch;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.pend[s].fill(0); G.shoutAt[s] = 0;
  return true;
}

export function view(G, s) {
  const now = Date.now(), g = goal(G);
  return {
    game: 'bingo', ph: G.ph, stage: G.stage, gid: G.gid, me: s, opts: G.opts, goals: G.goals, gi: G.gi, goal: g, gap: G.gap, ms: MS,
    card: s >= 0 ? G.cards[s] : null, masks: G.mask, called: G.called,
    nextIn: G.stage === 'play' || G.stage === 'count' ? Math.max(0, G.nextAt - now) : G.stage === 'cheer' ? Math.max(0, G.stageEnd - now) : G.stage === 'last' ? Math.max(0, G.lastAt + MS.last - now) : 0,
    callAgo: G.called.length && G.stage !== 'count' ? Math.max(0, now - (G.stage === 'last' ? G.lastAt : G.nextAt - G.gap)) : 0,
    pts: G.pts, wins: G.wins, go: G.mask.map(m => (G.ph === 'end' ? toGo('full', m) : toGo(g, m))), n: G.mask.map(m => count(m) - 1),
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Placed by points (10 for the line, 20 for two lines, 40 for the full card), then by how near the card is to full.
// With daubing by hand, a person who never daubed a single number earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.pts[i], win: G.res.place[i] === 1, place: G.res.place[i], idle: x.human && G.opts.daub === 'hand' && G.st[i].hand === 0 && G.st[i].shouts === 0 }));
}

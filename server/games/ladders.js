// Snakes & Ladders: authoritative turns. The server rolls the die and works out every hop, ladder,
// snake and party tile; clients replay the move as a little animation.
import { makeBoard, jumpAt, specialAt, SIZES, MS } from '../../public/games/ladders/board.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'ladders', name: 'Snakes & Ladders', minPlayers: 1, maxPlayers: 6 };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const BOT_MS = 1100, MAX_ROUNDS = 80;

export function cleanOpts(o = {}) {
  return {
    size: o.size === 'short' ? 'short' : 'classic',
    party: o.party === 'off' ? 'off' : 'on',
    bounce: o.bounce === 'off' ? 'off' : 'on',
    seats: [2, 4, 6].includes(+o.seats) ? +o.seats : 4,
    timer: [0, 10, 20].includes(+o.timer) ? +o.timer : 20,
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
  while (seats.length < opts.seats) seats.push({ id: null, name: names[bi], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length, B = makeBoard(Math.random() * 2 ** 31 | 0, SIZES[opts.size], opts.party === 'on');
  const G = {
    game: 'ladders', ph: 'play', stage: 'roll', gid: Math.random().toString(36).slice(2, 8), seats, opts, board: B,
    pos: seats.map(() => 0), nap: seats.map(() => 0), st: seats.map(() => ({ ladders: 0, snakes: 0, sixes: 0 })),
    turn: Math.random() * n | 0, sixRun: 0, extra: false, round: 1, first: 0, stageEnd: 0,
    move: null, moveN: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  G.first = G.turn;
  beginTurn(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 14) G.ev.shift(); }
const timed = G => G.opts.timer > 0;

function beginTurn(G, now) {
  G.stage = 'roll';
  const s = G.seats[G.turn];
  G.stageEnd = s.bot ? now + BOT_MS : timed(G) ? now + G.opts.timer * 1000 : 0;
}

// Walk k tiles forward from p, bouncing off the goal when an exact finish is needed.
function walk(G, p, k) {
  const N = G.board.size, tiles = [];
  let dir = 1;
  for (let i = 0; i < k; i++) {
    if (p >= N) { if (G.opts.bounce === 'off') break; dir = -1; }
    p += dir; tiles.push(p);
  }
  return tiles;
}

function roll(G, s, now, die = 1 + (Math.random() * 6 | 0)) {
  const B = G.board, N = B.size, segs = [], me = G.st[s];
  let p = G.pos[s];
  const start = p;
  const go = k => { const t = walk(G, p, k); if (t.length) { segs.push({ t: 'walk', tiles: t }); p = t.at(-1); } };
  const slide = () => {
    const j = jumpAt(B, p); if (!j) return false;
    const kind = j.to > j.from ? 'ladder' : 'snake';
    segs.push({ t: kind, from: j.from, to: j.to }); p = j.to;
    if (kind === 'ladder') me.ladders++; else me.snakes++;
    return true;
  };
  go(die); slide();
  let extra = false;
  if (die === 6) { me.sixes++; G.sixRun++; extra = G.sixRun < 3; } else G.sixRun = 0;
  const k = p < N ? specialAt(B, p) : null;
  if (k === 'boost') { segs.push({ t: 'special', k, at: p }); go(3); slide(); }
  else if (k === 'again') { segs.push({ t: 'special', k, at: p }); extra = true; }
  else if (k === 'nap') { segs.push({ t: 'special', k, at: p }); G.nap[s] = 1; extra = false; }
  else if (k === 'swap') {
    segs.push({ t: 'special', k, at: p });
    const ahead = G.pos.map((q, i) => i).filter(i => i !== s && G.pos[i] > p).sort((a, b) => G.pos[a] - G.pos[b]);
    if (ahead.length) { const o = ahead[0]; segs.push({ t: 'swap', with: o, a: G.pos[o], b: p }); G.pos[o] = p; p = segs.at(-1).a; }
  }
  G.pos[s] = p;
  G.extra = extra && p < N;
  const ms = segs.reduce((t, g) => t + (g.t === 'walk' ? g.tiles.length * MS.step : MS[g.t]), MS.die + MS.end);
  G.move = { n: ++G.moveN, s, die, from: start, segs, ms, at: now };
  G.stage = 'move'; G.stageEnd = now + ms;
  pushEv(G, { t: 'roll', s, die, segs: segs.map(g => g.t) });
  return true;
}

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => G.pos[b] - G.pos[a] || (a === G.win ? -1 : b === G.win ? 1 : 0));
  if (G.win < 0) G.win = order[0];
  else { order.splice(order.indexOf(G.win), 1); order.unshift(G.win); }
  G.ph = 'end'; G.stage = 'end'; G.endAt = now;
  G.res = { order, rounds: G.round };
  pushEv(G, { t: 'end', w: G.win });
}

function nextTurn(G, now) {
  const n = G.seats.length;
  if (G.extra) { G.extra = false; pushEv(G, { t: 'again', s: G.turn }); beginTurn(G, now); return; }
  G.sixRun = 0;
  let t = G.turn;
  for (let guard = 0; guard < n * 2; guard++) {
    t = (t + 1) % n;
    if (t === G.first) G.round++;
    if (G.nap[t]) { G.nap[t] = 0; pushEv(G, { t: 'nap', s: t }); continue; }
    break;
  }
  G.turn = t;
  if (G.round > MAX_ROUNDS) return finish(G, now);
  beginTurn(G, now);
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  if (a.t === 'roll') {
    if (G.stage !== 'roll' || G.turn !== s) return false;
    return roll(G, s, Date.now());
  }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'roll') {
    if (!G.stageEnd || now < G.stageEnd) {
      // a player who went away while it was their turn gets rolled for by a bot
      if (G.seats[G.turn].bot && (!G.stageEnd || G.stageEnd - now > BOT_MS)) { G.stageEnd = now + BOT_MS; return true; }
      return false;
    }
    return roll(G, G.turn, now);
  }
  if (G.stage === 'move') {
    if (now < G.stageEnd) return false;
    if (G.pos[G.move.s] >= G.board.size) { G.win = G.move.s; finish(G, now); return true; }
    nextTurn(G, now);
    return true;
  }
  return false;
}

// A player who drops out keeps their token; a bot rolls for them.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.ph === 'play' && G.stage === 'roll' && G.turn === s) beginTurn(G, Date.now());
  return true;
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'ladders', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, round: G.round,
    left: G.stageEnd ? Math.max(0, G.stageEnd - now) : -1, timer: G.opts.timer,
    board: G.board, bounce: G.opts.bounce === 'on', party: G.opts.party === 'on',
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, pos: G.pos[i], nap: G.nap[i], st: G.st[i] })),
    move: G.move ? { ...G.move, ago: now - G.move.at } : null,
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Per-seat outcome: 10 points per player you finished ahead of, plus 10 for reaching the goal first.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + (place === 0 ? 10 : 0), win: place === 0, place: place + 1 };
  });
}

// for tests: roll a chosen number
export const _roll = roll;

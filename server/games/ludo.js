// Ludo: authoritative turns. The server rolls the die, works out which pawns may move, and applies the move
// (captures included); clients replay it as a little animation.
import { RING, LAST, HOME, MS, ringIndex, safeIndex, cornersFor } from '../../public/games/ludo/board.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'ludo', name: 'Ludo', minPlayers: 1, maxPlayers: 4, joinAt: 'round' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip'];
// Corner colours. A player keeps their own colour unless someone before them already has one too close to it.
const PALETTE = ['#ff6b6b', '#4db5ff', '#ffc93c', '#5fd08a', '#c58bff', '#ff9f43'];
const BOT_MS = 800, BOT_PICK = 650, MAX_ROUNDS = 400;

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4].includes(+o.seats) ? +o.seats : 4,
    pawns: +o.pawns === 2 ? 2 : 4,
    head: o.head === 'off' ? 'off' : 'on',
    timer: [0, 10, 20].includes(+o.timer) ? +o.timer : 20,
    hard: o.hard === 'on' ? 'on' : 'off',
  };
}

const rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0x999999; return [n >> 16, (n >> 8) & 255, n & 255]; };
const near = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 95; };
function pickCol(want, used) {
  if (want && /^#[0-9a-f]{6}$/i.test(want) && !used.some(u => near(u, want))) return want;
  return PALETTE.find(c => !used.some(u => near(u, c))) || PALETTE[used.length % PALETTE.length];
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  let bi = 0;
  while (seats.length < opts.seats) seats.push({ id: null, name: names[bi++], color: null, av: randomAv(), bot: true, human: false });
  const n = seats.length, corners = cornersFor(n), cols = [];
  seats.forEach((s, i) => { s.col = pickCol(s.color, cols); cols.push(s.col); s.color ||= s.col; s.corner = corners[i]; });
  const G = {
    game: 'ludo', ph: 'play', stage: 'roll', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    toks: seats.map(() => Array.from({ length: opts.pawns }, (_, k) => (k === 0 && opts.head === 'on' ? 0 : -1))),
    st: seats.map(() => ({ caps: 0, lost: 0, sixes: 0 })),
    turn: Math.random() * n | 0, first: 0, round: 1, sixRun: 0, tries: 0, extra: false, stageEnd: 0,
    roll: null, rollN: 0, move: null, moveN: 0, legal: [], ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  G.first = G.turn;
  beginTurn(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 14) G.ev.shift(); }
const timed = G => G.opts.timer > 0;
const hard = G => G.opts.hard === 'on';
const waitFor = (G, now, botMs) => (G.seats[G.turn].bot ? now + botMs : timed(G) ? now + G.opts.timer * 1000 : 0);

function beginTurn(G, now) { G.stage = 'roll'; G.legal = []; G.stageEnd = waitFor(G, now, BOT_MS); }

// Every different move seat s can make with this roll. Pawns standing together count once.
export function legalMoves(G, s, die) {
  const out = [], seen = new Set();
  G.toks[s].forEach((p, k) => {
    if (p === HOME || seen.has(p)) return;
    const to = p < 0 ? (die === 6 ? 0 : -1) : p + die;
    if (to < 0 || to > HOME) return; // needs a six to leave the yard; needs the exact number to get home
    if (hard(G) && to < HOME && G.toks[s].includes(to)) return; // hard mode, one pawn per cell: your own pawn is in the way
    seen.add(p); out.push({ k, from: p, to });
  });
  return out;
}

// Opposing pawns that would be sent home by seat s landing on place `to`. Two or more together are a block.
// In hard mode no cell is safe: whoever is standing there is captured.
function capturesAt(G, s, to) {
  const i = ringIndex(G.seats[s].corner, to);
  if (i < 0 || (safeIndex(i) && !hard(G))) return [];
  const caps = [];
  G.seats.forEach((o, os) => {
    if (os === s) return;
    const there = G.toks[os].map((p, k) => ({ k, p })).filter(t => ringIndex(o.corner, t.p) === i);
    if (there.length === 1) caps.push({ s: os, k: there[0].k, from: there[0].p });
  });
  return caps;
}

// How close an opposing pawn is behind ring cell i (1..6 means it could land here with one roll).
function threat(G, s, to) {
  const i = ringIndex(G.seats[s].corner, to);
  if (i < 0 || (safeIndex(i) && !hard(G))) return 0;
  let n = 0;
  G.seats.forEach((o, os) => {
    if (os === s) return;
    for (const p of G.toks[os]) {
      const j = ringIndex(o.corner, p); if (j < 0) continue;
      const gap = (i - j + RING) % RING;
      if (gap >= 1 && gap <= 6 && p + gap <= LAST) n++;
    }
  });
  return n;
}

function botPick(G, s, moves) {
  let best = moves[0], top = -1e9;
  for (const m of moves) {
    const caps = capturesAt(G, s, m.to);
    let v = Math.random() * 6 + (m.to - Math.max(0, m.from)) * .5 + m.to * .15;
    for (const c of caps) v += 60 + c.from;
    if (m.to === HOME) v += 55;
    if (m.from < 0) v += 40;
    if (m.to > LAST && m.from <= LAST) v += 18; // into the home lane, out of reach
    const stacked = G.toks[s].some((p, k) => k !== m.k && p === m.to && p >= 0 && p <= LAST);
    if (!stacked) v -= threat(G, s, m.to) * 22;
    if (m.from >= 0 && G.toks[s].filter(p => p === m.from).length === 1) v += threat(G, s, m.from) * 16; // run from danger
    if (v > top) { top = v; best = m; }
  }
  return best;
}

function roll(G, s, now, die = 1 + (Math.random() * 6 | 0)) {
  if (die === 6) { G.sixRun++; G.st[s].sixes++; } else G.sixRun = 0;
  const three = G.sixRun >= 3;
  const moves = three ? [] : legalMoves(G, s, die);
  G.legal = moves;
  G.roll = { n: ++G.rollN, s, die, three, none: !moves.length, at: now };
  G.stage = 'die'; G.stageEnd = now + MS.die + (moves.length ? 0 : MS.none);
  return true;
}

function doMove(G, s, m, now) {
  const caps = capturesAt(G, s, m.to), die = G.roll.die;
  G.toks[s][m.k] = m.to;
  for (const c of caps) { G.toks[c.s][c.k] = -1; G.st[c.s].lost++; G.st[s].caps++; }
  const ms = (m.from < 0 ? MS.out : (m.to - m.from) * MS.step) + (caps.length ? MS.cap : 0) + (m.to === HOME ? MS.home : 0) + MS.end;
  G.move = { n: ++G.moveN, s, k: m.k, die, from: m.from, to: m.to, caps, ms, at: now };
  G.extra = die === 6 || caps.length > 0 || m.to === HOME;
  G.tries = 0; G.legal = [];
  G.stage = 'move'; G.stageEnd = now + ms;
  pushEv(G, { t: 'move', s, die, out: m.from < 0, home: m.to === HOME, caps: caps.map(c => c.s) });
  return true;
}

const progress = (G, s) => G.toks[s].reduce((t, p) => t + p + 1, 0);
const done = (G, s) => G.toks[s].every(p => p === HOME);

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => progress(G, b) - progress(G, a));
  if (G.win < 0) G.win = order[0];
  else { order.splice(order.indexOf(G.win), 1); order.unshift(G.win); }
  G.ph = 'end'; G.stage = 'end'; G.endAt = now;
  G.res = { order, rounds: G.round };
  pushEv(G, { t: 'end', w: G.win });
}

function nextTurn(G, now) {
  const n = G.seats.length;
  if (G.extra) { G.extra = false; pushEv(G, { t: 'again', s: G.turn }); beginTurn(G, now); return; }
  G.sixRun = 0; G.tries = 0;
  G.turn = (G.turn + 1) % n;
  if (G.turn === G.first) { G.round++; seatQueued(G); }
  if (G.round > MAX_ROUNDS) return finish(G, now);
  beginTurn(G, now);
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play' || G.turn !== s) return false;
  if (a.t === 'roll') return G.stage === 'roll' && roll(G, s, Date.now());
  if (a.t === 'pick') {
    const m = G.stage === 'pick' && G.legal.find(x => x.k === (a.k | 0) || G.toks[s][a.k | 0] === x.from);
    return !!m && doMove(G, s, m, Date.now());
  }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const s = G.turn, bot = G.seats[s].bot;
  if (G.stage === 'roll' || G.stage === 'pick') {
    const ms = G.stage === 'roll' ? BOT_MS : BOT_PICK;
    if (!G.stageEnd || now < G.stageEnd) {
      // a player who went away while it was their turn gets played for by a bot
      if (bot && (!G.stageEnd || G.stageEnd - now > ms)) { G.stageEnd = now + ms; return true; }
      return false;
    }
    return G.stage === 'roll' ? roll(G, s, now) : doMove(G, s, botPick(G, s, G.legal), now);
  }
  if (G.stage === 'die') {
    if (now < G.stageEnd) return false;
    const r = G.roll;
    if (r.three) { G.sixRun = 0; G.extra = false; pushEv(G, { t: 'three', s }); nextTurn(G, now); return true; }
    if (!G.legal.length) {
      // nothing on the board yet: up to three tries at a six
      const waiting = G.toks[s].every(p => p < 0 || p === HOME);
      if (r.die !== 6 && waiting && G.tries < 2) { G.tries++; pushEv(G, { t: 'retry', s, left: 3 - G.tries }); beginTurn(G, now); return true; }
      G.extra = r.die === 6;
      pushEv(G, { t: 'none', s, die: r.die });
      nextTurn(G, now); return true;
    }
    if (G.legal.length === 1) return doMove(G, s, G.legal[0], now);
    G.stage = 'pick'; G.stageEnd = waitFor(G, now, BOT_PICK);
    return true;
  }
  if (G.stage === 'move') {
    if (now < G.stageEnd) return false;
    if (done(G, G.move.s)) { G.win = G.move.s; finish(G, now); return true; }
    nextTurn(G, now);
    return true;
  }
  return false;
}

// A player who drops out keeps their pawns; a bot plays them.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.ph === 'play' && G.turn === s && (G.stage === 'roll' || G.stage === 'pick')) G.stageEnd = waitFor(G, Date.now(), G.stage === 'roll' ? BOT_MS : BOT_PICK);
  return true;
}

// Someone watching can take over a bot's corner from the start of the next round of turns.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  G.queue ||= [];
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return true;
}
function seatQueued(G) {
  while (G.queue?.length) {
    const i = G.seats.findIndex(s => !s.human); // a bot, or the corner of someone who left
    if (i < 0) break; // every corner has a person: they get a seat in the next game instead
    const p = G.queue.shift();
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }); // the corner keeps its colour
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'ludo', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, round: G.round,
    left: G.stageEnd ? Math.max(0, G.stageEnd - now) : -1, timer: G.opts.timer, pawns: G.opts.pawns, tries: G.tries, hard: hard(G),
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, col: x.col, corner: x.corner, av: x.av, bot: x.bot, human: x.human, id: x.id, toks: G.toks[i], st: G.st[i] })),
    roll: G.roll ? { ...G.roll, ago: now - G.roll.at } : null,
    move: G.move ? { ...G.move, ago: now - G.move.at } : null,
    legal: G.stage === 'pick' ? G.legal : [],
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Per-seat outcome: 10 points per player you finished ahead of, plus 10 for getting every pawn home first.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + (place === 0 ? 10 : 0), win: place === 0, place: place + 1 };
  });
}

// for tests: roll a chosen number, and peek at captures
export const _roll = roll;
export const _captures = capturesAt;

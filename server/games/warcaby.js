// Warcaby (draughts) for two, Polish rules: compulsory captures of the most pieces, flying kings, men taking
// backwards too. On the 10x10 board (default) or the small 8x8 one. Draws by threefold repetition, 25 moves each of
// only kings, the short endgame limits, and agreement; resigning; optional clocks with an increment.
// An empty seat is played by a bot (three strengths, warcabyai.js) that thinks on its own thread.
import { Worker } from 'node:worker_threads';
import { CLOCKS, SIZES, startPos, legal, play, status, posKey, findMove, moveText } from '../../public/games/warcaby/rules.js';
import { think, likesDraw, LEVELS } from './warcabyai.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'warcaby', name: 'Checkers', minPlayers: 1, maxPlayers: 2, seats: { fixed: 2 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const rnd = (a, b) => a + Math.random() * (b - a);
export const BOTS = LEVELS; // tuning lives in warcabyai.js

export function cleanOpts(o = {}) {
  return {
    clock: Object.hasOwn(CLOCKS, o.clock) ? o.clock : '10+5',
    bots: Object.hasOwn(LEVELS, o.bots) ? o.bots : 'easy',
    board: Object.hasOwn(SIZES, o.board) ? String(o.board) : '10',
  };
}

// Who had White last time these two sat down, so a rematch swaps colours.
const lastWhite = new Map();
const pairKey = seats => seats.map(s => s.id || 'bot').sort().join('|');

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, 2).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = BOT_COLS.filter(c => !taken.has(c)).sort(() => Math.random() - .5);
  while (seats.length < 2) seats.push({ id: null, name: names[0], color: cols[0], av: randomAv(), bot: true, human: false });
  const key = pairKey(seats), prev = lastWhite.get(key);
  let white = Math.random() < .5 ? 0 : 1;
  if (prev !== undefined) { const was = seats.findIndex(s => (s.id || 'bot') === prev); if (was >= 0) white = 1 - was; }
  lastWhite.delete(key); lastWhite.set(key, seats[white].id || 'bot');
  if (lastWhite.size > 500) lastWhite.delete(lastWhite.keys().next().value);
  const now = Date.now(), ck = CLOCKS[opts.clock], pos = startPos(+opts.board);
  const G = {
    game: 'warcaby', ph: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts, white, pos,
    seen: { [posKey(pos)]: 1 }, hashes: [pos.h], moves: [], mv: 0, last: null,
    clock: ck ? [ck[0] * 60000, ck[0] * 60000] : null, inc: ck ? ck[1] * 1000 : 0, turnAt: now + 1500,
    offer: -1, offerAt: [-9, -9], caps: [[0, 0], [0, 0]], // men and kings each player has taken
    st: seats.map(() => ({ moved: 0, auto: 0 })), botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  G.botAt = now + rnd(1500, 2400);
  return G;
}

const colourOf = (G, s) => (s === G.white ? 0 : 1);
const seatOf = (G, colour) => (colour === 0 ? G.white : 1 - G.white);
const turnSeat = G => seatOf(G, G.pos.turn);
function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }

function finish(G, now, how, win) {
  if (G.clock && G.ph === 'play') { const s = turnSeat(G); G.clock[s] = Math.max(0, G.clock[s] - Math.max(0, now - G.turnAt)); }
  G.ph = 'end'; G.endAt = now; G.win = win; G.offer = -1;
  G.res = { how, win, moves: Math.ceil(G.mv / 2), white: G.white };
  pushEv(G, { t: 'end', how, w: win });
  thinking.delete(G.gid);
  return true;
}

function doMove(G, s, m, now, auto = false) {
  const pos = G.pos;
  for (const c of m.caps) G.caps[s][(pos.b[c] & 3) - 1]++;
  const text = moveText(m, pos.n);
  if (G.clock) { G.clock[s] = Math.max(0, G.clock[s] - Math.max(0, now - G.turnAt)) + G.inc; }
  G.pos = play(pos, m); G.mv++;
  G.hashes.push(G.pos.h);
  if (G.pos.quiet === 0) G.seen = {}; // after a capture or a man move no earlier position can come back
  const key = posKey(G.pos); G.seen[key] = (G.seen[key] || 0) + 1;
  G.st[s].moved++; if (auto) G.st[s].auto++;
  G.moves.push(text);
  G.last = { f: m.f, t: m.t, path: m.path, caps: m.caps, k: m.k ? 1 : 0, s, mv: G.mv };
  if (G.offer >= 0 && G.offer !== s) pushEv(G, { t: 'decline', s }); // moving on turns the offer down
  G.offer = -1;
  pushEv(G, { t: 'move', s, f: m.f, to: m.t, cap: m.caps.length, k: m.k ? 1 : 0, txt: text });
  const st = status(G.pos, new Map(Object.entries(G.seen)));
  if (st.over) return finish(G, now, st.how, st.win < 0 ? -1 : seatOf(G, st.win));
  G.turnAt = now; G.botAt = now + rnd(700, 1400) + (m.caps.length > 1 ? m.caps.length * 260 : 0); // let a long capture land first
  return true;
}

const cleanPath = p => Array.isArray(p) && p.length >= 2 && p.length <= 24 && p.every(x => Number.isInteger(x) && x >= 0 && x < 100);

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  const now = Date.now(), other = 1 - s;
  if (a.t === 'move') {
    if (turnSeat(G) !== s || !cleanPath(a.path)) return false;
    const m = findMove(G.pos, a.path);
    return m ? doMove(G, s, m, now) : false;
  }
  if (a.t === 'resign') return finish(G, now, 'resign', other);
  if (a.t === 'draw') {
    if (G.offer === other) return finish(G, now, 'agree', -1);
    if (G.offer === s || G.mv < 2 || G.mv - G.offerAt[s] < 2) return false; // not before both have moved, and one offer per move of your own
    G.offerAt[s] = G.mv;
    if (G.seats[other].bot) { // a bot answers straight away
      if (likesDraw(G.pos, colourOf(G, other))) return finish(G, now, 'agree', -1);
      pushEv(G, { t: 'offer', s }); pushEv(G, { t: 'decline', s: other });
      return true;
    }
    G.offer = s; pushEv(G, { t: 'offer', s });
    return true;
  }
  if (a.t === 'nodraw') {
    if (G.offer !== other) return false;
    G.offer = -1; pushEv(G, { t: 'decline', s });
    return true;
  }
  return false;
}

// ---------- bots ----------
// The search runs on a worker thread; tick() asks once per move and plays the answer when it is back.
const thinking = new Map(); // gid -> { mv, path, at }
let worker = null, jobN = 0;
const jobs = new Map();
function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./warcabyai-worker.js', import.meta.url));
    worker.on('message', ({ id, path }) => { const T = jobs.get(id); jobs.delete(id); if (T) T.path = path || -1; });
    const drop = () => { worker = null; for (const T of jobs.values()) T.path = -1; jobs.clear(); };
    worker.on('error', e => { console.error('warcaby bot thread failed', e); drop(); });
    worker.on('exit', drop);
    worker.unref(); // never keeps the server (or a test) alive on its own
  } catch (e) { worker = null; }
  return worker;
}
const budget = (G, s) => { const lv = LEVELS[G.opts.bots] || LEVELS.easy; return G.clock ? Math.max(40, Math.min(lv.ms, G.clock[s] / 30)) : lv.ms; };
function botTick(G, s, now) {
  let T = thinking.get(G.gid);
  if (!T || T.mv !== G.mv) {
    T = { mv: G.mv, path: null, at: now }; thinking.set(G.gid, T);
    if (thinking.size > 200) for (const [k, v] of thinking) if (now - v.at > 600_000) thinking.delete(k);
    const w = getWorker(), p = G.pos;
    if (w) { const id = ++jobN; jobs.set(id, T); w.postMessage({ id, b: p.b, turn: p.turn, quiet: p.quiet, eg: p.eg, level: G.opts.bots, ms: budget(G, s), history: G.hashes.slice(-120) }); }
    else T.path = -1;
    return false;
  }
  if (!T.path && now - T.at > 8000) T.path = -1; // the thread never answered
  if (!T.path || now < G.botAt) return false;
  let m = T.path !== -1 ? findMove(G.pos, T.path) : null;
  if (!m) m = think(G.pos, { ...LEVELS.easy, ms: 60, random: 0, history: G.hashes }) || legal(G.pos)[0]; // quick thought on this thread instead
  thinking.delete(G.gid);
  return m ? doMove(G, s, m, now, G.seats[s].human) : false;
}
// For tests: the bot seat to move thinks right here and plays.
export function _bot(G, now = Date.now(), ms = 40) {
  const s = turnSeat(G), lv = LEVELS[G.opts.bots] || LEVELS.easy;
  const m = think(G.pos, { ...lv, ms: Math.min(lv.ms, ms), history: G.hashes });
  return m ? doMove(G, s, m, now, G.seats[s].human) : false;
}

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const s = turnSeat(G);
  if (G.clock && now - G.turnAt >= G.clock[s]) { G.clock[s] = 0; G.turnAt = now; return finish(G, now, 'time', 1 - s); } // the flag falls
  if (G.seats[s].bot) return botTick(G, s, now);
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (away && G.offer === 1 - s) { G.offer = -1; pushEv(G, { t: 'decline', s }); }
  if (turnSeat(G) === s && G.ph === 'play') G.botAt = Date.now() + 800;
  return true;
}

export function view(G, s) {
  const now = Date.now(), ts = G.ph === 'play' ? turnSeat(G) : -1;
  const clock = G.clock ? G.clock.map((ms, i) => Math.max(0, i === ts ? ms - Math.max(0, now - G.turnAt) : ms)) : null;
  const p = G.pos;
  return {
    game: 'warcaby', ph: G.ph, gid: G.gid, me: s, turn: ts, white: G.white, mv: G.mv, botsLevel: G.opts.bots, clockName: G.opts.clock, size: p.n,
    pos: { b: p.b, turn: p.turn, quiet: p.quiet, eg: p.eg },
    clock, inc: G.inc, grace: Math.max(0, G.turnAt - now),
    moves: G.moves, last: G.last, offer: G.offer, canOffer: s >= 0 && G.offer < 0 && G.mv >= 2 && G.mv - G.offerAt[s] >= 2, caps: G.caps,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// 10 points for a win, 5 each for a draw (a draw has no winner, so both share the place).
// A person who never made a move themselves earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.win === i ? 10 : G.win < 0 ? 5 : 0, win: G.win === i, idle: x.human && G.st[i].moved === G.st[i].auto }));
}

// Chess for two: the full standard rules (castling, en passant, promotion, check, checkmate, stalemate), draws by
// threefold repetition, the 50-move rule, dead positions and agreement, resigning, and optional chess clocks with an
// increment. An empty seat is played by a bot (three strengths, chessai.js) that thinks on its own thread.
import { Worker } from 'node:worker_threads';
import { P, K, Q, R, B, N, CLOCKS, startPos, legal, play, status, posKey, san, toFen, findMove, inCheck, canMate, colorOf, typeOf, mFrom, mTo, mPromo, mFlag } from '../../public/games/chess/rules.js';
import { think, likesDraw, LEVELS } from './chessai.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'chess', name: 'Chess', minPlayers: 1, maxPlayers: 2, seats: { fixed: 2 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const rnd = (a, b) => a + Math.random() * (b - a);
export const BOTS = LEVELS; // tuning lives in chessai.js

export function cleanOpts(o = {}) {
  return {
    clock: Object.hasOwn(CLOCKS, o.clock) ? o.clock : '10+5',
    bots: Object.hasOwn(LEVELS, o.bots) ? o.bots : 'easy',
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
  const now = Date.now(), ck = CLOCKS[opts.clock], pos = startPos();
  const G = {
    game: 'chess', ph: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts, white, pos,
    seen: { [posKey(pos)]: 1 }, hashes: [pos.h], moves: [], mv: 0, last: null, check: -1,
    clock: ck ? [ck[0] * 60000, ck[0] * 60000] : null, inc: ck ? ck[1] * 1000 : 0, turnAt: now + 1500,
    offer: -1, offerAt: [-9, -9], caps: [[], []],
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
  const pos = G.pos, f = mFrom(m), t = mTo(m), piece = pos.b[f], flag = mFlag(m);
  const cap = flag & 1 ? P | ((1 - pos.turn) << 3) : pos.b[t];
  const text = san(pos, m);
  if (G.clock) { G.clock[s] = Math.max(0, G.clock[s] - Math.max(0, now - G.turnAt)) + G.inc; }
  G.pos = play(pos, m); G.mv++;
  G.hashes.push(G.pos.h);
  if (G.pos.half === 0) G.seen = {}; // after a capture or a pawn move no earlier position can come back
  const key = posKey(G.pos); G.seen[key] = (G.seen[key] || 0) + 1;
  if (cap) G.caps[s].push(typeOf(cap));
  G.st[s].moved++; if (auto) G.st[s].auto++;
  G.moves.push(text);
  G.last = { f, t, s, mv: G.mv };
  G.check = inCheck(G.pos) ? G.pos.k[G.pos.turn] : -1;
  if (G.offer >= 0 && G.offer !== s) pushEv(G, { t: 'decline', s }); // moving on turns the offer down
  G.offer = -1;
  pushEv(G, { t: 'move', s, f, to: t, p: typeOf(piece), cap: cap ? typeOf(cap) : 0, promo: mPromo(m), castle: flag & 2 ? 1 : 0, ep: flag & 1, check: G.check >= 0 ? 1 : 0, san: text });
  const st = status(G.pos, new Map(Object.entries(G.seen)));
  if (st.over) return finish(G, now, st.how, st.win < 0 ? -1 : seatOf(G, st.win));
  G.turnAt = now; G.botAt = now + rnd(700, 1500);
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  const now = Date.now(), other = 1 - s;
  if (a.t === 'move') {
    if (turnSeat(G) !== s || !Number.isInteger(a.f) || !Number.isInteger(a.to)) return false;
    const promo = { q: Q, r: R, b: B, n: N }[a.p] || Q;
    const m = findMove(G.pos, a.f & 63, a.to & 63, promo);
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
const thinking = new Map(); // gid -> { mv, m, at }
let worker = null, jobN = 0;
const jobs = new Map();
function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./chessai-worker.js', import.meta.url));
    worker.on('message', ({ id, m }) => { const T = jobs.get(id); jobs.delete(id); if (T) T.m = m || -1; });
    const drop = () => { worker = null; for (const T of jobs.values()) T.m = -1; jobs.clear(); };
    worker.on('error', e => { console.error('chess bot thread failed', e); drop(); });
    worker.on('exit', drop);
    worker.unref(); // never keeps the server (or a test) alive on its own
  } catch (e) { worker = null; }
  return worker;
}
const budget = (G, s) => { const lv = LEVELS[G.opts.bots] || LEVELS.easy; return G.clock ? Math.max(40, Math.min(lv.ms, G.clock[s] / 30)) : lv.ms; };
function botTick(G, s, now) {
  let T = thinking.get(G.gid);
  if (!T || T.mv !== G.mv) {
    T = { mv: G.mv, m: 0, at: now }; thinking.set(G.gid, T);
    if (thinking.size > 200) for (const [k, v] of thinking) if (now - v.at > 600_000) thinking.delete(k);
    const w = getWorker();
    if (w) { const id = ++jobN; jobs.set(id, T); w.postMessage({ id, fen: toFen(G.pos), level: G.opts.bots, ms: budget(G, s), history: G.hashes.slice(-120) }); }
    else T.m = -1;
    return false;
  }
  if (!T.m && now - T.at > 8000) T.m = -1; // the thread never answered
  if (!T.m || now < G.botAt) return false;
  let m = T.m;
  const all = legal(G.pos);
  if (m < 0 || !all.includes(m)) m = think(G.pos, { ...LEVELS.easy, ms: 60, random: 0, history: G.hashes }) || all[0]; // quick thought on this thread instead
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
  if (G.clock && now - G.turnAt >= G.clock[s]) { // the flag falls
    G.clock[s] = 0; G.turnAt = now;
    return canMate(G.pos.b, colourOf(G, 1 - s)) ? finish(G, now, 'time', 1 - s) : finish(G, now, 'timedraw', -1);
  }
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
    game: 'chess', ph: G.ph, gid: G.gid, me: s, turn: ts, white: G.white, mv: G.mv, botsLevel: G.opts.bots, clockName: G.opts.clock,
    pos: { b: p.b, turn: p.turn, castle: p.castle, ep: p.ep, half: p.half, full: p.full },
    clock, inc: G.inc, grace: Math.max(0, G.turnAt - now),
    moves: G.moves, last: G.last, check: G.check, offer: G.offer, canOffer: s >= 0 && G.offer < 0 && G.mv >= 2 && G.mv - G.offerAt[s] >= 2, caps: G.caps,
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

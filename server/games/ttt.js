// Tic-Tac-Toe: two players take turns putting their mark on a grid, and the first to make a line wins the round.
// A match is one round or first to 2 or 3 round wins; whoever started a round goes second in the next.
// Modes (rules.js): classic 3×3, vanishing 3×3 (you keep only your three newest marks) and a 5×5 board with
// four in a row. An empty seat is played by a bot.
import { MODES, modeOf, lines, winLine, place, full, empty, fadeNext, FADE_CAP } from '../../public/games/ttt/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'ttt', name: 'Tic-Tac-Toe', minPlayers: 1, maxPlayers: 2, seats: { fixed: 2 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { round: 2800 }; // the winning line shows this long before the board is cleared
const rnd = (a, b) => a + Math.random() * (b - a);
const maxRounds = to => to * 2 + 3; // draws can't stretch a match for ever: after this many rounds, most round wins takes it

export function cleanOpts(o = {}) {
  return {
    mode: Object.hasOwn(MODES, o.mode) ? o.mode : 'classic',
    to: [1, 2, 3].includes(+o.to) ? +o.to : 3,
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 10, 20, 30].includes(+o.timer) ? +o.timer : 20,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn), M = modeOf(opts.mode);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, 2).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = BOT_COLS.filter(c => !taken.has(c)).sort(() => Math.random() - .5);
  let bi = 0;
  while (seats.length < 2) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const starter = Math.random() < .5 ? 0 : 1, now = Date.now();
  const G = {
    game: 'ttt', ph: 'play', stage: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts, n: M.n, k: M.k, keep: M.keep,
    board: empty(M.n), order: [[], []], wins: [0, 0], draws: 0, round: 1, starter, turn: starter, marks: 0, mv: 0,
    st: seats.map(() => ({ placed: 0, auto: 0 })), last: null, line: null, roundWin: -1,
    stageEnd: 0, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  setTurn(G, starter, now + 900); // a moment to look at the board first
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
function setTurn(G, i, now) {
  G.turn = i;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(700, 1400);
}

function doPlace(G, s, c, now, auto = false) {
  const r = place(G.board, G.order, s, c, G.opts.mode);
  if (!r) return false;
  G.board = r.board; G.order = r.order; G.marks++; G.mv++;
  G.st[s].placed++; if (auto) G.st[s].auto++;
  G.last = { s, c, gone: r.gone, mv: G.mv };
  pushEv(G, { t: 'place', s, c, gone: r.gone });
  const w = winLine(G.board, G.n, G.k);
  if (w) {
    G.wins[s]++; G.line = w.cells; G.roundWin = s;
    pushEv(G, { t: 'round', w: s, line: w.cells, wins: G.wins.slice() });
    return endRound(G, now);
  }
  if (full(G.board) || (G.keep && G.marks >= FADE_CAP)) {
    G.draws++; G.roundWin = -1; G.line = null;
    pushEv(G, { t: 'round', w: -1, wins: G.wins.slice() });
    return endRound(G, now);
  }
  setTurn(G, 1 - s, now);
  return true;
}
function endRound(G, now) {
  G.turn = -1; G.tEnd = 0;
  if (G.wins.some(w => w >= G.opts.to) || G.round >= maxRounds(G.opts.to)) return finish(G, now);
  G.stage = 'round'; G.stageEnd = now + MS.round;
  return true;
}
function nextRound(G, now) {
  G.round++; G.starter = 1 - G.starter; G.stage = 'play';
  G.board = empty(G.n); G.order = [[], []]; G.marks = 0; G.line = null; G.roundWin = -1; G.last = null;
  pushEv(G, { t: 'start', round: G.round, s: G.starter });
  setTurn(G, G.starter, now + 500);
}
function finish(G, now) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = now;
  G.win = G.wins[0] > G.wins[1] ? 0 : G.wins[1] > G.wins[0] ? 1 : -1;
  G.res = { wins: G.wins.slice(), draws: G.draws, rounds: G.round, tie: G.win < 0 };
  pushEv(G, { t: 'end', w: G.win });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage !== 'play' || G.turn !== s || a.t !== 'place') return false;
  return doPlace(G, s, a.c, Date.now());
}

// ---------- bots ----------
// sharp: a proper look-ahead (alpha-beta). On the classic board it searches to the end, so it never loses.
//   depth: how many marks ahead it looks in each mode.
// chill: takes a win it sees most of the time (win), blocks your line only some of the time (block), otherwise
//   puts its mark somewhere sensible-looking but random.
export const BOTS = {
  chill: { win: .85, block: .5 },
  sharp: { depth: { classic: 9, fade: 6, big: 3 } },
};

// How good the board looks for seat s: every line still open to only one player counts, more marks count much more.
function evalBoard(board, n, k, s) {
  let v = 0;
  for (const ln of lines(n, k)) {
    let a = 0, b = 0;
    for (const c of ln) { const x = board[c]; if (x === s) a++; else if (x >= 0) b++; }
    if (a && !b) v += 4 ** a; else if (b && !a) v -= 4 ** b;
  }
  return v;
}
// Cells worth looking at: all of them on a small board; next to a mark (or the middle) on the big one.
function candidates(board, n) {
  const free = [];
  for (let c = 0; c < board.length; c++) if (board[c] < 0) free.push(c);
  if (n <= 3) return free;
  const near = free.filter(c => { const r = c / n | 0, q = c % n; for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) { const rr = r + dr, qq = q + dq; if ((dr || dq) && rr >= 0 && rr < n && qq >= 0 && qq < n && board[rr * n + qq] >= 0) return true; } return false; });
  return near.length ? near : [(n * n) >> 1];
}
function search(board, order, s, depth, alpha, beta, mode, M, marks) {
  const opts = candidates(board, M.n);
  if (!opts.length) return 0;
  let best = -Infinity;
  for (const c of opts) {
    const r = place(board, order, s, c, mode); if (!r) continue;
    let v;
    if (winLine(r.board, M.n, M.k)) v = 100000 + depth;
    else if (full(r.board) || (M.keep && marks + 1 >= FADE_CAP)) v = 0;
    else if (depth <= 1) v = evalBoard(r.board, M.n, M.k, s);
    else v = -search(r.board, r.order, 1 - s, depth - 1, -beta, -alpha, mode, M, marks + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
export function sharpMove(G, s, depth = BOTS.sharp.depth[G.opts.mode] || 3) {
  const M = modeOf(G.opts.mode), scored = [];
  for (const c of candidates(G.board, M.n)) {
    const r = place(G.board, G.order, s, c, G.opts.mode); if (!r) continue;
    let v;
    if (winLine(r.board, M.n, M.k)) v = 1e6;
    else if (full(r.board)) v = 0;
    else v = depth <= 1 ? evalBoard(r.board, M.n, M.k, s) : -search(r.board, r.order, 1 - s, depth - 1, -Infinity, Infinity, G.opts.mode, M, G.marks + 1);
    scored.push([c, v]);
  }
  if (!scored.length) return -1;
  const top = Math.max(...scored.map(x => x[1])), best = scored.filter(x => x[1] >= top - (Math.abs(top) < 1000 ? 1 : 0)); // equally good moves: pick one at random
  return best[Math.random() * best.length | 0][0];
}
// The cells where `who` would complete a line right now.
function winningCells(G, who) {
  const out = [];
  for (let c = 0; c < G.board.length; c++) {
    const r = place(G.board, G.order, who, c, G.opts.mode);
    if (r && winLine(r.board, G.n, G.k)?.s === who) out.push(c);
  }
  return out;
}
export function chillMove(G, s, B = BOTS.chill) {
  const win = winningCells(G, s); if (win.length && Math.random() < B.win) return win[Math.random() * win.length | 0];
  // a block only works if the cell is still free after our own oldest mark vanishes, which winningCells already allows for
  const threat = winningCells(G, 1 - s).filter(c => place(G.board, G.order, s, c, G.opts.mode));
  if (threat.length && Math.random() < B.block) return threat[Math.random() * threat.length | 0];
  const n = G.n, mid = (n - 1) / 2, opts = candidates(G.board, n).filter(c => place(G.board, G.order, s, c, G.opts.mode));
  if (!opts.length) return -1;
  // middle and corners look nicer to a casual player than the edges
  const w = opts.map(c => { const r = c / n | 0, q = c % n, d = Math.abs(r - mid) + Math.abs(q - mid); return n <= 3 ? (d === 0 ? 3 : d === 2 ? 2 : 1) : 1 / (1 + d); });
  let t = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < opts.length; i++) { t -= w[i]; if (t <= 0) return opts[i]; }
  return opts[opts.length - 1];
}
function botMove(G, s, now, level = G.opts.bots, auto = false) {
  const c = level === 'sharp' ? sharpMove(G, s) : chillMove(G, s);
  if (c >= 0 && doPlace(G, s, c, now, auto)) return true;
  const any = G.board.findIndex((x, i) => place(G.board, G.order, s, i, G.opts.mode)); // should never be needed
  return any >= 0 && doPlace(G, s, any, now, auto);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'round') { if (now < G.stageEnd) return false; nextRound(G, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; return botMove(G, s, now); }
  if (G.tEnd && now >= G.tEnd) return botMove(G, s, now, 'chill', true); // out of time: a chill bot plays your mark
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
    game: 'ttt', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, timer: G.opts.timer, botsLevel: G.opts.bots,
    mode: G.opts.mode, to: G.opts.to, n: G.n, k: G.k, keep: G.keep, maxRounds: maxRounds(G.opts.to),
    tLeft: G.stage === 'play' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    roundLeft: G.stage === 'round' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    board: G.board, order: G.order, fade: G.keep && G.turn >= 0 ? fadeNext(G.order, G.turn, G.keep) : -1,
    wins: G.wins, draws: G.draws, round: G.round, starter: G.starter, last: G.last, line: G.line, roundWin: G.roundWin,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// 10 points a round won. A drawn match (same round wins) has no winner and both share the place.
// A person who never placed a mark themselves (the timer played every one) earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.wins[i] * 10, win: G.win === i, idle: x.human && G.st[i].placed === G.st[i].auto }));
}

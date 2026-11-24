// Tower Stack: everyone builds one wobbly tower, a block each turn. The server owns the swing clock and
// decides where every block lands; clients draw the same swing (rules.js) and replay the drops.
import { KINDS, MIXED, PTS, MS, MAX_LEVEL, makeSwing, drop, check, swingPos, topOf } from '../../public/games/stack/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'stack', name: 'Tower Stack', minPlayers: 1, maxPlayers: 6, seats: { lo: 2, def: 4 }, joinAt: 'round' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const MAX_TURNS = 600;

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    towers: [1, 3, 5].includes(+o.towers) ? +o.towers : 3,
    blocks: o.blocks === 'mixed' ? 'mixed' : 'classic',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 10, 20].includes(+o.timer) ? +o.timer : 10,
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
  const n = seats.length;
  const G = {
    game: 'stack', ph: 'play', stage: 'aim', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    tower: [], towerN: 1, done: 0, best: 0, turn: Math.random() * n | 0, first: 0, round: 1, turns: 0,
    pts: seats.map(() => 0), st: seats.map(() => ({ placed: 0, perfect: 0, crashes: 0, slips: 0 })),
    swing: null, swingN: 0, aimAt: 0, stageEnd: 0, botAt: -1, drop: null, dropN: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  G.first = G.turn;
  beginTurn(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 14) G.ev.shift(); }

function beginTurn(G, now) {
  const kind = G.opts.blocks === 'mixed' && G.tower.length ? MIXED[Math.random() * MIXED.length | 0] : 'block';
  G.stage = 'aim'; G.swing = { ...makeSwing(G.tower, kind, G.turns), n: ++G.swingN }; G.aimAt = now; G.botAt = -1;
  planTurn(G, now);
}
function planTurn(G, now) {
  const s = G.seats[G.turn];
  if (s.bot) { G.botAt = botPick(G, now - G.aimAt); G.stageEnd = G.aimAt + G.botAt; }
  else { G.botAt = -1; G.stageEnd = G.opts.timer > 0 ? now + G.opts.timer * 1000 : 0; }
}

// A bot looks one swing ahead for the drop that leaves the tower steadiest, then fumbles it a little.
// The faster the swing, the further a fumble carries the block.
function botPick(G, from) {
  const sw = G.swing, think = Math.max(from, 700 + Math.random() * 900);
  let best = think, bs = -Infinity;
  for (let k = 0; k < 48; k++) {
    const ms = think + sw.P * k / 48, r = drop(G.tower, sw, ms);
    const sc = r.res === 'perfect' ? 2 + r.steady : r.res === 'ok' ? 1 + r.steady : -5;
    if (sc > bs) { bs = sc; best = ms; }
  }
  const sharp = G.opts.bots === 'sharp', jitter = (sharp ? 38 : 70) * gauss();
  return Math.max(think, best + jitter);
}
function gauss() { let u = 0; for (let i = 0; i < 4; i++) u += Math.random(); return (u - 2) / .58; }

function doDrop(G, s, ms, now) {
  ms = Math.max(0, ms);
  const sw = G.swing, r = drop(G.tower, sw, ms), me = G.st[s], level = G.tower.length;
  let pts = PTS[r.res];
  r.b.s = s; r.b.kind = sw.kind;
  if (r.res === 'ok' || r.res === 'perfect') { G.tower.push(r.b); me.placed++; if (r.res === 'perfect') me.perfect++; }
  else if (r.res === 'crash') { G.tower.push(r.b); me.crashes++; }
  else me.slips++;
  G.pts[s] += pts;
  let after = r.res === 'crash' ? MS.crash : r.res === 'slip' || r.res === 'miss' ? MS.slip : MS.settle;
  let top = false;
  if ((r.res === 'ok' || r.res === 'perfect') && G.tower.length >= MAX_LEVEL) { top = true; after = MS.top; G.seats.forEach((_, i) => G.pts[i] += PTS.top); }
  G.best = Math.max(G.best, r.res === 'crash' ? level : G.tower.length);
  G.drop = { n: ++G.dropN, s, ms, x: r.b.x, z: r.b.z, y: r.b.y, w: r.b.w, d: r.b.d, h: r.b.h, kind: sw.kind, axis: sw.axis,
    res: r.res, at: r.at, dir: r.dir, pts, level, top, i: G.tower.length - 1, steady: r.steady ?? 0, at0: now, dur: MS.drop + after };
  G.stage = 'drop'; G.stageEnd = now + MS.drop + after; G.swing = null; G.turns++;
  pushEv(G, { t: r.res, s, pts, level });
  return true;
}

function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => G.pts[b] - G.pts[a] || G.st[a].crashes - G.st[b].crashes || G.st[b].perfect - G.st[a].perfect);
  G.win = order[0];
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.swing = null;
  G.res = { order, towers: G.done, best: G.best };
  pushEv(G, { t: 'end', w: G.win });
}

function nextTurn(G, now) {
  const d = G.drop;
  if (d && (d.res === 'crash' || d.top)) {
    G.done++;
    if (G.done >= G.opts.towers) return finish(G, now);
    G.tower = []; G.towerN++;
    pushEv(G, { t: 'tower', k: G.towerN });
  }
  if (G.turns >= MAX_TURNS) return finish(G, now);
  const n = G.seats.length;
  G.turn = (G.turn + 1) % n;
  if (G.turn === G.first) { G.round++; seatQueued(G); }
  beginTurn(G, now);
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  if (a.t === 'drop') {
    if (G.stage !== 'aim' || G.turn !== s || G.seats[s].bot) return false;
    const now = Date.now(), el = now - G.aimAt;
    // the player saw the swing a moment late (the state took a while to arrive), so trust their clock within reason
    let ms = Number.isFinite(+a.ms) ? +a.ms : el;
    ms = Math.min(el, Math.max(el - 1500, ms));
    return doDrop(G, s, ms, now);
  }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'aim') {
    const s = G.seats[G.turn];
    if (s.bot && G.botAt < 0) { planTurn(G, now); return true; } // went away mid-turn: a bot takes over
    if (!G.stageEnd || now < G.stageEnd) return false;
    return doDrop(G, G.turn, s.bot ? G.botAt : now - G.aimAt, now);
  }
  if (G.stage === 'drop') {
    if (now < G.stageEnd) return false;
    nextTurn(G, now);
    return true;
  }
  return false;
}

// A player who drops out keeps their seat; a bot drops for them.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.ph === 'play' && G.stage === 'aim' && G.turn === s) planTurn(G, Date.now());
  return true;
}

// Watchers can take over a bot from the start of the next round of turns.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  G.queue ||= [];
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return true;
}
function seatQueued(G) {
  while (G.queue?.length) {
    const i = G.seats.findIndex(s => !s.human);
    if (i < 0) break;
    const p = G.queue.shift();
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'stack', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, round: G.round,
    left: G.stage === 'aim' && G.stageEnd && !G.seats[G.turn].bot ? Math.max(0, G.stageEnd - now) : -1, timer: G.opts.timer,
    towerN: G.towerN, towers: G.opts.towers, done: G.done, best: G.best, blocks: G.opts.blocks, steady: check(G.tower).steady,
    tower: G.tower.map(b => ({ x: b.x, z: b.z, y: b.y, w: b.w, d: b.d, h: b.h, s: b.s, kind: b.kind })),
    swing: G.swing ? { ...G.swing, ago: now - G.aimAt } : null,
    drop: G.drop ? { ...G.drop, ago: now - G.drop.at0 } : null,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, pts: G.pts[i], st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Per-seat outcome: the points each player stacked up (never below zero), and a win for the top score.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: Math.max(0, G.pts[i]), win: place === 0, place: place + 1 };
  });
}

// for tests
export const _drop = doDrop;
export const _pos = swingPos;
export { topOf, KINDS };

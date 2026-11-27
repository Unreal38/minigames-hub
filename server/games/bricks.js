// Sky Bricks: everyone stacks falling bricks in their own well at the same time. Full rows vanish, and clearing two
// or more at once sends stone lines up under somebody else. Fill your well to the top and you are out; last one in wins.
// Real time: each browser plays its own well with the shared rules (rules.js) and reports every brick it sets down.
// The server replays that move on its own copy of the well, so rows, stone lines and knock-outs are all decided here.
import { W, VIS, H, MAXG, GRACE, COUNT_MS, ROT, SHAPES, newState, lock, doHold, fits, spawn, dropY, encode, heightOf, fallMs, levelAt } from '../../public/games/bricks/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'bricks', name: 'Sky Bricks', minPlayers: 1, maxPlayers: 6, seats: { lo: 2, def: 4 }, joinAt: 'game' };

const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const TIDE_AT = { chill: 210_000, normal: 165_000, fast: 120_000 }; // after this long, stone lines start rising for everyone
export const BOT = { chill: { ms: 2200, min: 1150, slip: .15 }, sharp: { ms: 950, min: 480, slip: .04 } }; // a brick every ms (quicker as the levels rise, down to min); slip: how often it fumbles

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    speed: ['chill', 'normal', 'fast'].includes(o.speed) ? o.speed : 'normal',
    time: +o.time === 90 ? 90 : 0, // seconds; 90 = the Friendship Trail cut: whoever stands when time runs out is placed by stack height
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
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
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const now = Date.now(), seed = (Math.random() * 2 ** 31) | 0;
  return {
    game: 'bricks', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts, seed,
    startAt: now, goAt: now + COUNT_MS,
    st: seats.map(() => newState(seed)),
    x: seats.map((_, i) => ({ sync: 0, lockAt: 0, botAt: now + COUNT_MS + 300 + Math.random() * 500, tgt: i, gN: 0, place: 0, outAt: 0, bs: '' })),
    ev: [], evN: 0, tideAt: 0, tideN: 0, res: null, win: -1, endAt: 0, dirty: true,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 30) G.ev.shift(); }
const alive = G => G.seats.map((_, i) => i).filter(i => !G.st[i].dead);
const playing = (G, s) => G.seats[s].human && !G.seats[s].bot; // a person at the controls right now

// ---------- after any brick is set down (a person's or a bot's) ----------
function settle(G, s, res, now) {
  const st = G.st[s], x = G.x[s];
  x.lockAt = now; x.bs = encode(st.b); G.dirty = true;
  if (res.rows.length) pushEv(G, { t: 'clr', s, k: res.rows.length, c: st.combo, clean: res.clean ? 1 : 0 });
  if (res.out > 0) {
    // stone lines go to the others in turn
    const others = alive(G).filter(i => i !== s);
    if (others.length) {
      let to = others.find(i => i > x.tgt); if (to === undefined) to = others[0];
      x.tgt = to;
      const T = G.st[to], hole = (Math.random() * W) | 0;
      for (let k = 0; k < res.out; k++) T.pend.push({ id: ++G.x[to].gN, hole, at: now });
      pushEv(G, { t: 'atk', s, to, k: res.out });
    }
  }
  if (st.dead) knockOut(G, s, now);
}
function knockOut(G, s, now) {
  const x = G.x[s]; if (x.place) return;
  x.place = alive(G).length + 1; x.outAt = Math.max(1, now - G.goAt);
  G.st[s].pend = []; G.dirty = true;
  pushEv(G, { t: 'out', s, place: x.place });
}

// ---------- bots ----------
// Try every turn and column, drop the brick straight down and score the well it leaves.
function score(b, rows) {
  let holes = 0, agg = 0, bump = 0, prev = -1, top = 0;
  for (let x = 0; x < W; x++) {
    let h = 0; for (let y = H - 1; y >= 0; y--) if (b[y][x]) { h = y + 1; break; }
    for (let y = 0; y < h; y++) if (!b[y][x]) holes++;
    agg += h; top = Math.max(top, h); if (prev >= 0) bump += Math.abs(h - prev); prev = h;
  }
  return -.51 * agg + [0, .4, 1.6, 3, 5.5][rows] - .78 * holes - .18 * bump - (top > VIS - 6 ? (top - (VIS - 6)) * 1.2 : 0);
}
export function bestMove(st, slip = 0) {
  const k = st.cur, sp = spawn(k), opts = [];
  for (let r = 0; r < (k === 2 ? 1 : 4); r++) for (let x = -2; x < W; x++) {
    if (!fits(st.b, k, r, x, sp.y)) continue;
    const y = dropY(st.b, { k, r, x, y: sp.y });
    const b = st.b.map(row => row.slice());
    for (const [cx, cy] of ROT[k][r]) b[y + cy][x + cx] = k + 1;
    let rows = 0; for (let Y = H - 1; Y >= 0; Y--) if (b[Y].every(v => v)) { b.splice(Y, 1); b.push(new Array(W).fill(0)); rows++; }
    opts.push({ r, x, y, v: score(b, rows) });
  }
  if (!opts.length) return null;
  opts.sort((a, c) => c.v - a.v);
  return Math.random() < slip ? opts[Math.min(opts.length - 1, 1 + ((Math.random() * 4) | 0))] : opts[0];
}
function botStep(G, s, now) {
  const x = G.x[s], st = G.st[s]; if (now < x.botAt) return;
  const lvl = BOT[G.seats[s].human ? 'chill' : G.opts.bots], m = bestMove(st, lvl.slip);
  const res = m && lock(st, m.r, m.x, m.y, MAXG);
  if (!res) { st.dead = true; x.bs = encode(st.b); knockOut(G, s, now); return; }
  settle(G, s, res, now);
  x.botAt = now + Math.max(lvl.min, lvl.ms * .965 ** (levelAt(now - G.goAt) - 1)) * (.8 + Math.random() * .4);
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'count') {
    if (now >= G.goAt) { G.stage = 'go'; for (const x of G.x) x.lockAt = now; pushEv(G, { t: 'go' }); G.dirty = true; }
    return flush(G);
  }
  const t = now - G.goAt;
  for (const s of alive(G)) {
    if (!playing(G, s)) botStep(G, s, now);
    // somebody who sets nothing down for far too long (a frozen tab) gets their brick dropped for them
    else if (now - G.x[s].lockAt > fallMs(G.opts.speed, t) * (VIS + 2) + 8000) forceDrop(G, s, now);
  }
  // the rising tide: late in the game stone lines come for everyone, faster and faster, so no game lasts forever
  const tide = TIDE_AT[G.opts.speed];
  if (t > tide && now >= G.tideAt) {
    G.tideAt = now + Math.max(1600, 7000 - G.tideN * 350); G.tideN++;
    const hole = (Math.random() * W) | 0;
    for (const s of alive(G)) G.st[s].pend.push({ id: ++G.x[s].gN, hole, at: now });
    pushEv(G, { t: 'tide', k: G.tideN }); G.dirty = true;
  }
  const left = alive(G);
  if (left.length <= (G.seats.length > 1 ? 1 : 0) || !left.some(s => playing(G, s)) || (G.opts.time && t >= G.opts.time * 1000)) finish(G, now);
  return flush(G);
}
function flush(G) { const d = G.dirty; G.dirty = false; return d; }
function forceDrop(G, s, now) {
  const st = G.st[s], p = spawn(st.cur), res = lock(st, p.r, p.x, dropY(st.b, p), MAXG);
  G.x[s].sync++;
  if (!res) { st.dead = true; knockOut(G, s, now); return; }
  settle(G, s, res, now);
}

function finish(G, now) {
  // anyone still standing (bots, once every person is out) is placed by how low their stack is
  const left = alive(G).sort((a, b) => heightOf(G.st[a].b) - heightOf(G.st[b].b) || G.st[b].lines - G.st[a].lines);
  left.forEach((s, i) => { G.x[s].place = i + 1; G.x[s].outAt = 0; });
  const order = G.seats.map((_, i) => i).sort((a, b) => G.x[a].place - G.x[b].place);
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = order[0];
  G.res = { order, lines: G.st.map(s => s.lines), sent: G.st.map(s => s.sent), time: G.x.map(x => x.outAt), ms: Math.max(0, now - G.goAt) };
  pushEv(G, { t: 'end', w: G.win }); G.dirty = true;
}

// ---------- what people send ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || !playing(G, s) || G.ph !== 'play' || G.stage !== 'go') return false;
  const st = G.st[s], x = G.x[s], now = Date.now();
  if (st.dead || a.y0 !== x.sync) return false; // sent before the browser took the server's copy: stale
  const resync = () => { x.sync++; G.dirty = true; return false; };
  if (a.t === 'h') { // set the brick aside
    if (!doHold(st)) return resync();
    if (st.dead) knockOut(G, s, now);
    return false;
  }
  if (a.t === 'l') { // set a brick down
    if (a.n !== st.locks + 1) return resync();
    // stone lines that have waited long enough must come up now; newer ones may, if the browser already knew of them
    const avail = Math.min(st.pend.length, MAXG), must = Math.min(MAXG, st.pend.filter(p => now - p.at > GRACE).length), g = a.g;
    const cleared = wouldClear(st, a);
    if (!Number.isInteger(g) || g > avail || (!cleared && g < must)) return resync();
    const res = lock(st, a.r, a.x, a.y, g);
    if (!res) return resync();
    settle(G, s, res, now);
    return false; // fast() sends it on its next beat
  }
  return false;
}
// would setting the brick down there complete a row? (then no stone lines rise, whatever the browser said)
export function wouldClear(st, a) {
  if (![a.r, a.x, a.y].every(Number.isInteger) || a.r < 0 || a.r > 3 || !fits(st.b, st.cur, a.r, a.x, a.y)) return false;
  const cells = ROT[st.cur][a.r].map(([cx, cy]) => [a.x + cx, a.y + cy]);
  return [...new Set(cells.map(c => c[1]))].some(Y => st.b[Y].every((v, X) => v || cells.some(c => c[0] === X && c[1] === Y)));
}

export function tick() { return false; } // fast() does the work

// A player who drops out keeps their well; a bot stacks it until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.x[s].sync++; G.x[s].lockAt = Date.now(); G.x[s].botAt = Date.now() + 800; G.dirty = true;
  return true;
}

export function view(G, s) {
  const now = Date.now();
  const out = {
    game: 'bricks', ph: G.ph, stage: G.stage, gid: G.gid, me: s, seed: G.seed, speed: G.opts.speed, t: now - G.goAt, lim: (G.opts.time || 0) * 1000, tide: TIDE_AT[G.opts.speed],
    seats: G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    b: G.x.map(x => x.bs),
    x: G.st.map((st, i) => [st.dead ? 1 : 0, st.lines, st.sent, st.pend.length, G.x[i].place, st.combo]),
    ev: G.ev, res: G.res, win: G.win,
  };
  if (s >= 0) {
    const st = G.st[s];
    out.mine = { sync: G.x[s].sync, locks: st.locks, cur: st.cur, nx: st.nx, hold: st.hold, can: st.can, combo: st.combo, lines: st.lines, sent: st.sent, dead: st.dead, pend: st.pend.map(p => [p.id, p.hole]) };
  }
  return out;
}

// Per-seat outcome: placed by who lasted longest; points for lines cleared and lines sent.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: G.st[i].lines + G.st[i].sent * 3, win: G.x[i].place === 1, place: G.x[i].place }));
}

// for tests
export const _settle = settle;

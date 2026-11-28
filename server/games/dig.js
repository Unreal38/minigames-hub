// Treasure Dig: a grass field on a sky island hides gems, a golden chest and traps. Take turns digging one tile.
// A dug tile with nothing in it shows how many traps are next to it (like Minesweeper) and a star if a gem is
// still buried somewhere close (within HINT.reach tiles, a wide area, so it only says where to look). Only tiles
// dug by hand get a star (so only after a miss), never the ones that open by themselves. Find a gem and you dig again; hit a trap and you lose points. When the last gem is
// found, the most points wins. Nothing under the grass is ever sent to a player before it is dug.
import { KIND, PTS, TRAP, SIZES, MS, HINT, waitFor, around, near, isGem, homeOf, standOf, walkMs } from '../../public/games/dig/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'dig', name: 'Treasure Dig', minPlayers: 1, maxPlayers: 6, seats: { lo: 2, def: 4 }, joinAt: 'round' };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    size: o.size === 'small' ? 'small' : 'big',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 15, 25].includes(+o.timer) ? +o.timer : 25,
  };
}

// Bury everything. The middle of the field (a tile and its neighbours) is kept clear and dug open at the start,
// so the first player already has numbers to read.
export function makeField(size) {
  const Z = SIZES[size] || SIZES.small, { w, h } = Z, n = w * h;
  const mid = (h >> 1) * w + (w >> 1), clear = new Set([mid, ...around(mid, w, h)]);
  const free = shuffle([...Array(n).keys()].filter(i => !clear.has(i)));
  const cells = new Array(n).fill(KIND.dirt);
  let k = 0;
  for (const [kind, cnt] of [[KIND.trap, Z.traps], [KIND.chest, Z.chest], [KIND.big, Z.big], [KIND.gem, Z.gem]]) for (let c = 0; c < cnt; c++) cells[free[k++]] = kind;
  const num = cells.map((_, i) => around(i, w, h).filter(j => cells[j] === KIND.trap).length);
  return { w, h, cells, num, mid };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(2, opts.seats)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const F = makeField(opts.size), now = Date.now();
  const G = {
    game: 'dig', ph: 'play', stage: 'start', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    w: F.w, h: F.h, cells: F.cells, num: F.num, open: new Array(F.w * F.h).fill(0), hand: new Array(F.w * F.h).fill(0), by: new Array(F.w * F.h).fill(-1),
    pts: seats.map(() => 0), st: seats.map(() => ({ gems: 0, big: 0, chest: 0, traps: 0, digs: 0, best: 0 })),
    turn: Math.random() * seats.length | 0, chain: 0, at: seats.map(() => null), dig: null, digN: 0, stageEnd: now + MS.start, startAt: now,
    tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  flood(G, F.mid, -1);
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
const gemsLeft = G => G.cells.filter((k, i) => isGem(k) && !G.open[i]).length;
const safeLeft = G => G.cells.filter((k, i) => k !== KIND.trap && !G.open[i]).length;

// Open a tile; an empty tile with no traps round it opens its empty neighbours too (never a gem or a trap).
function flood(G, i, s) {
  const opened = [], todo = [i];
  while (todo.length) {
    const j = todo.pop(); if (G.open[j]) continue;
    G.open[j] = 1; G.by[j] = s; opened.push(j);
    if (G.cells[j] === KIND.dirt && !G.num[j]) for (const k of around(j, G.w, G.h)) if (!G.open[k] && G.cells[k] === KIND.dirt) todo.push(k);
  }
  return opened;
}

function setTurn(G, i, now) {
  G.turn = i; G.stage = 'turn';
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(900, 1900);
}

function doDig(G, s, i, now, late = false) {
  if (!Number.isInteger(i) || i < 0 || i >= G.cells.length || G.open[i]) return false;
  const kind = G.cells[i], st = G.st[s];
  G.hand[i] = 1;
  const opened = flood(G, i, s).filter(j => j !== i);
  let pts = 0;
  if (isGem(kind)) { pts = PTS[kind]; st[kind === KIND.gem ? 'gems' : kind === KIND.big ? 'big' : 'chest']++; G.chain++; }
  else if (kind === KIND.trap) { pts = -Math.min(G.pts[s], -TRAP); st.traps++; }
  G.pts[s] += pts; st.digs++;
  if (isGem(kind)) st.best = Math.max(st.best, G.chain);
  G.dig = { s, i, kind, pts, opened, at: now, n: ++G.digN, chain: isGem(kind) ? G.chain : 0, late };
  // how long the walk to the tile takes: from the digger's spot by the plot, or from the last tile in a chain of finds
  const to = standOf(i, G.w, G.h), walk = walkMs(G.at[s] || homeOf(s, G.seats.length, G.w, G.h), to);
  G.at[s] = isGem(kind) ? to : null; G.dig.walk = walk;
  G.stage = 'dig'; G.tEnd = 0; G.stageEnd = now + waitFor(kind, walk);
  pushEv(G, { t: 'dig', s, i, kind, pts, chain: G.dig.chain });
  return true;
}

function afterDig(G, now) {
  const d = G.dig;
  if (!gemsLeft(G) || !safeLeft(G)) return finish(G, now);
  if (isGem(d.kind)) { G.stage = 'turn'; setTurn(G, d.s, now); return; } // found something: dig again
  G.chain = 0;
  seatQueued(G);
  setTurn(G, (d.s + 1) % G.seats.length, now);
}

function finish(G, now = Date.now()) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = now;
  const gemsOf = i => G.st[i].gems + G.st[i].big + G.st[i].chest;
  const order = G.seats.map((_, i) => i).sort((a, b) => G.pts[b] - G.pts[a] || gemsOf(b) - gemsOf(a) || G.st[a].traps - G.st[b].traps || a - b);
  G.win = order[0];
  G.res = { order, pts: [...G.pts] };
  pushEv(G, { t: 'end', w: G.win });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage !== 'turn' || G.turn !== s) return false;
  if (a.t === 'dig') return doDig(G, s, +a.i, Date.now());
  return false;
}

// ---------- what everyone can see ----------
// One number per tile: -1 still under grass; 0-8 dug and empty (the number of traps next to it);
// 11 gem, 12 big gem, 13 chest, 14 trap. Plus the dug empty tiles that still have a gem buried close by (HINT.reach).
export const SHOWN = { gem: 11, big: 12, chest: 13, trap: 14 };
function board(G) {
  const t = G.cells.map((k, i) => (!G.open[i] ? -1 : k === KIND.dirt ? G.num[i] : 10 + k));
  const glint = [], lit = [];
  if (HINT.reach > 0) t.forEach((v, i) => {
    if (v < 0 || v > 8 || (HINT.dugOnly && !G.hand[i])) return;
    lit.push(i);
    if (near(i, G.w, G.h).some(j => !G.open[j] && isGem(G.cells[j]))) glint.push(i);
  });
  return { t, glint, lit };
}
const left = G => { const L = { gem: 0, big: 0, chest: 0, trap: 0 }; G.cells.forEach((k, i) => { if (!G.open[i]) { if (k === KIND.gem) L.gem++; else if (k === KIND.big) L.big++; else if (k === KIND.chest) L.chest++; else if (k === KIND.trap) L.trap++; } }); return L; };

// ---------- bots ----------
// Bots only use what every player can see: the numbers, the stars and how much is still buried.
// They work out which tiles are certainly safe or certainly traps, then pick the tile most likely to hold a gem.
// fuzz: random error in its judgement; careless: how often it digs a hunch instead; passes: how far it thinks it through.
export const BOTS = {
  chill: { fuzz: .5, careless: .22, passes: 1, fear: 3 },
  sharp: { fuzz: .06, careless: 0, passes: 4, fear: 6 },
};
export function judge(w, h, t, glint, L, passes = 4, reach = HINT.reach, lit = null) {
  const n = t.length, hidden = [], g = new Set(glint);
  for (let i = 0; i < n; i++) if (t[i] < 0) hidden.push(i);
  const trap = new Set(), safe = new Set(), noGem = new Set(), cons = [];
  for (let i = 0; i < n; i++) if (t[i] >= 0 && t[i] <= 8) {
    const nb = around(i, w, h), hid = nb.filter(j => t[j] < 0);
    if (!hid.length) continue;
    cons.push({ hid, need: t[i] - nb.filter(j => t[j] === SHOWN.trap).length });
  }
  const stars = []; // what the stars say: a gem somewhere in this area, or none in it
  const lights = lit ? new Set(lit) : null;
  if (reach > 0) for (let i = 0; i < n; i++) if (t[i] >= 0 && t[i] <= 8 && (!lights || lights.has(i))) {
    const hid = near(i, w, h, reach).filter(j => t[j] < 0);
    if (!hid.length) continue;
    if (g.has(i)) stars.push(hid); else for (const j of hid) noGem.add(j);
  }
  for (let p = 0; p < passes; p++) {
    let changed = false;
    for (const c of cons) {
      const unk = c.hid.filter(j => !trap.has(j) && !safe.has(j)), need = c.need - c.hid.filter(j => trap.has(j)).length;
      if (!unk.length) continue;
      if (need <= 0) { for (const j of unk) safe.add(j); changed = true; }
      else if (need >= unk.length) { for (const j of unk) trap.add(j); changed = true; }
    }
    if (passes > 1) { // two numbers that share tiles: if one's unknown tiles are inside the other's, the rest is settled
      const live = cons.map(c => { const unk = c.hid.filter(j => !trap.has(j) && !safe.has(j)); return { unk, need: c.need - c.hid.filter(j => trap.has(j)).length }; }).filter(c => c.unk.length);
      for (const A of live) for (const B of live) {
        if (A === B || A.unk.length >= B.unk.length || !A.unk.every(j => B.unk.includes(j))) continue;
        const rest = B.unk.filter(j => !A.unk.includes(j) && !trap.has(j) && !safe.has(j)), need = B.need - A.need;
        if (!rest.length) continue;
        if (need <= 0) { for (const j of rest) safe.add(j); changed = true; }
        else if (need >= rest.length) { for (const j of rest) trap.add(j); changed = true; }
      }
    }
    if (!changed) break;
  }
  const open = hidden.filter(j => !trap.has(j) && !safe.has(j)).length;
  const pT0 = open ? Math.max(0, L.trap - trap.size) / open : 0;
  const gems = L.gem + L.big + L.chest, val = gems ? (L.gem * PTS[1] + L.big * PTS[2] + L.chest * PTS[3]) / gems : 0;
  const pG0 = gems / Math.max(1, hidden.length - trap.size);
  return hidden.map(i => {
    let pT = trap.has(i) ? 1 : safe.has(i) ? 0 : -1;
    if (pT < 0) {
      for (const c of cons) if (c.hid.includes(i)) { const unk = c.hid.filter(j => !trap.has(j) && !safe.has(j)); pT = Math.max(pT, (c.need - c.hid.filter(j => trap.has(j)).length) / unk.length); }
      if (pT < 0) pT = pT0;
    }
    let pG = noGem.has(i) || pT >= 1 ? 0 : -1;
    if (pG < 0) {
      for (const a of stars) if (a.includes(i)) pG = Math.max(pG, 1 / Math.max(1, a.filter(j => !trap.has(j) && !noGem.has(j)).length));
      if (pG < 0) pG = pG0;
      pG = Math.min(pG, 1 - pT);
    }
    return { i, pT, pG, val };
  });
}
function botMove(G, s, now, level = G.opts.bots, late = false) {
  const B = typeof level === 'object' ? level : BOTS[level] || BOTS.chill;
  const { t, glint, lit } = board(G), opts = judge(G.w, G.h, t, glint, left(G), B.passes, HINT.reach, lit);
  let best = null;
  if (Math.random() < B.careless) { // a hunch: any tile that is not a sure trap
    const ok = opts.filter(o => o.pT < 1); best = ok[Math.random() * ok.length | 0];
  }
  if (!best) for (const o of opts) {
    const ev = o.pG * o.val - o.pT * B.fear + (1 - o.pT - o.pG) * .1 + rnd(-B.fuzz, B.fuzz);
    if (!best || ev > best.ev) best = { ...o, ev };
  }
  return doDig(G, s, (best || opts[0]).i, now, late);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'start') { if (now < G.stageEnd) return false; seatQueued(G); setTurn(G, G.turn, now); return true; }
  if (G.stage === 'dig') { if (now < G.stageEnd) return false; afterDig(G, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; botMove(G, s, now); return true; }
  if (G.tEnd && now >= G.tEnd) { botMove(G, s, now, 'chill', true); return true; } // out of time: a careful guess is dug for you
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.stage === 'turn') { G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

// Someone watching takes over a bot when the current player's turn ends.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  const n = G.queue.length;
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return G.queue.length !== n || on;
}
function seatQueued(G) {
  while (G.queue.length) {
    const free = G.seats.map((_, i) => i).filter(i => !G.seats[i].human);
    if (!free.length) break;
    const p = G.queue.shift(), i = free[0];
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now(), B = board(G);
  return {
    game: 'dig', ph: G.ph, stage: G.stage, gid: G.gid, me: s, w: G.w, h: G.h, size: G.opts.size,
    turn: G.turn, chain: G.chain, timer: G.opts.timer, botsLevel: G.opts.bots, ms: MS,
    tLeft: G.stage === 'turn' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    startAgo: now - G.startAt,
    tiles: B.t, glint: B.glint, lit: B.lit, by: G.by, left: left(G),
    dig: G.dig && { ...G.dig, ago: now - G.dig.at },
    // the whole field only once the game is over
    all: G.ph === 'end' ? G.cells.map((k, i) => (k === KIND.dirt ? G.num[i] : 10 + k)) : null,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, pts: G.pts[i], st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev, queued: G.queue.map(q => q.id),
  };
}

export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => { const place = G.res.order.indexOf(i); return { pts: G.pts[i], win: place === 0, place: place + 1 }; });
}

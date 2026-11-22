// Pip Party: the classic five-dice score-sheet game. Each round every player gets up to three rolls, keeps any dice
// between rolls, then writes the roll into one empty box of their sheet. After 13 rounds the highest total wins.
// Everything here is public (there is nothing secret in a dice game), so view() is the same for every seat.
import { ROUNDS, ROLLS, NDICE, BOXES, UPPER, plain, score, genBonus, open, total, upperSum, blankSheet, isGen, counts } from '../../public/games/pips/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'pips', name: 'Pip Party', minPlayers: 1, maxPlayers: 4, joinAt: 'round' };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// roll: dice tumbling before anyone may act; pick: how long the written score shows before the next turn
const FAST = Math.max(1, +process.env.PIPS_FAST || 1); // tests run the table faster
export const MS = { roll: 1050 / FAST, pick: 1500 / FAST, start: 1200 / FAST };

const rnd = (a, b) => a + Math.random() * (b - a), wait = (a, b) => rnd(a, b) / FAST;
const d6 = () => 1 + (Math.random() * 6 | 0);

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4].includes(+o.seats) ? +o.seats : 3,
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 30, 45, 60].includes(+o.timer) ? +o.timer : 45,
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
  while (seats.length < Math.max(2, opts.seats)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length, now = Date.now();
  const G = {
    game: 'pips', ph: 'play', stage: 'wait', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    sheets: seats.map(blankSheet), extra: seats.map(() => 0), gens: seats.map(() => 0),
    round: 1, first: Math.random() * n | 0, turn: -1, dice: [], held: [false, false, false, false, false], rolls: 0,
    rollN: 0, rollAt: 0, moved: [], last: null, stageEnd: now + MS.start, tEnd: 0, botAt: 0, auto: false, plan: null,
    ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  G.turn = G.first;
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
const rolling = (G, now) => now < G.rollAt + MS.roll;

function startTurn(G, s, now) {
  G.turn = s; G.stage = 'turn'; G.dice = []; G.held = [false, false, false, false, false]; G.rolls = 0; G.moved = [];
  G.auto = false; G.plan = null;
  G.tEnd = G.opts.timer && !G.seats[s].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + wait(700, 1200);
  pushEv(G, { t: 'turn', s, round: G.round });
}

function doRoll(G, s, now) {
  if (G.rolls >= ROLLS || rolling(G, now)) return false;
  if (G.rolls && G.held.every(Boolean)) return false; // nothing left to roll
  const moved = [];
  for (let k = 0; k < NDICE; k++) if (!G.rolls || !G.held[k]) { G.dice[k] = d6(); moved.push(k); }
  if (!G.rolls) G.held = [false, false, false, false, false];
  G.rolls++; G.rollN++; G.rollAt = now; G.moved = moved;
  if (isGen(G.dice)) pushEv(G, { t: 'gen', s });
  pushEv(G, { t: 'roll', s, k: G.rolls, moved });
  return true;
}

function doHold(G, s, k, on, now) {
  if (!G.rolls || G.rolls >= ROLLS || rolling(G, now) || !(k >= 0 && k < NDICE) || !Number.isInteger(k)) return false;
  on = !!on; if (G.held[k] === on) return false;
  G.held[k] = on;
  return true;
}

function doPick(G, s, box, now) {
  const sh = G.sheets[s];
  if (!G.rolls || rolling(G, now) || !BOXES.includes(box) || sh[box] != null) return false;
  const pts = score(box, G.dice, sh), bonus = genBonus(G.dice, sh);
  const upperBefore = upperSum(sh);
  sh[box] = pts; G.extra[s] += bonus; if (bonus) G.gens[s]++;
  const madeBonus = UPPER.includes(box) && upperBefore < 63 && upperSum(sh) >= 63;
  G.last = { s, box, pts, bonus, madeBonus, dice: [...G.dice], at: now };
  pushEv(G, { t: 'pick', s, box, pts, bonus, madeBonus });
  G.stage = 'pick'; G.stageEnd = now + MS.pick; G.tEnd = 0;
  return true;
}

function nextTurn(G, now) {
  const n = G.seats.length, s = (G.turn + 1) % n;
  if (s === G.first) {
    if (G.round >= ROUNDS) return finish(G);
    G.round++;
    seatQueued(G);
  }
  startTurn(G, s, now);
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = Date.now();
  const tot = G.seats.map((_, i) => total(G.sheets[i], G.extra[i]));
  const order = G.seats.map((_, i) => i).sort((a, b) => tot[b] - tot[a] || a - b);
  G.win = order[0];
  G.res = { order, totals: tot };
  pushEv(G, { t: 'end', w: G.win });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage !== 'turn' || G.turn !== s || G.auto) return false;
  const now = Date.now();
  if (a.t === 'roll') return doRoll(G, s, now);
  if (a.t === 'hold') return doHold(G, s, +a.k, a.on, now);
  if (a.t === 'pick') return doPick(G, s, String(a.box), now);
  return false;
}

// ---------- bots ----------
// A bot looks at every way the rest of this turn can go (exactly, over all dice outcomes) and keeps the dice that
// give the best expected box. A box's worth is its score minus a "par" for that box, so a bot doesn't throw a
// 22 into Chance in the first round or a lone 30 small run into Three alike. Upper boxes also count how far the score
// is above or below three of that face, which is what reaching the 63 bonus takes.
// noise: random worth added to each box per decision (chill bots misjudge); deep: plans both rerolls ahead.
export const BOTS = {
  chill: { noise: 10, deep: false, up: .3 },
  sharp: { noise: 0, deep: true, up: 1 },
};
const PAR = { k3: 13, k4: 7, full: 14, ss: 19, ls: 14, gen: 12, ch: 21 };

// all sorted outcomes of rolling k dice, with their chances
const OUT = [];
for (let k = 0; k <= NDICE; k++) {
  const m = new Map();
  const rec = (arr, left) => { if (!left) { const key = [...arr].sort().join(''); m.set(key, (m.get(key) || 0) + 1); return; } for (let v = 1; v <= 6; v++) { arr.push(v); rec(arr, left - 1); arr.pop(); } };
  rec([], k);
  const all = 6 ** k;
  OUT[k] = [...m].map(([key, c]) => ({ d: key ? key.split('').map(Number) : [], p: c / all }));
}
const keyOf = d => [...d].sort().join('');
// every sub-multiset of some dice (which dice to keep), as sorted arrays
function keeps(dice) {
  const seen = new Map();
  for (let m = 0; m < 1 << dice.length; m++) { const k = dice.filter((_, i) => m >> i & 1); const key = keyOf(k); if (!seen.has(key)) seen.set(key, { key, d: k.sort(), mask: m }); }
  return [...seen.values()];
}

function planner(sheet, extra, B) {
  const boxes = open(sheet), up = upperSum(sheet), lean = {};
  for (const b of boxes) lean[b] = B.noise ? rnd(-B.noise, B.noise) : 0;
  const worth = (b, d) => {
    const s = score(b, d, sheet) + genBonus(d, sheet);
    if (UPPER.includes(b)) { const f = +b, over = s - 3 * f; return s + (up < 63 ? over * B.up : 0) + lean[b]; }
    return s - (PAR[b] || 0) * Math.min(1, boxes.length / 6) + lean[b];
  };
  const stopMemo = new Map();
  const stop = d => { const key = keyOf(d); let v = stopMemo.get(key); if (v) return v; let best = null; for (const b of boxes) { const w = worth(b, d); if (!best || w > best.w) best = { b, w }; } stopMemo.set(key, best); return best; };
  // expected best stop after rerolling everything but `kept`, with `left` rolls still to come after that one
  const evMemo = [new Map(), new Map()];
  const after = (kept, left) => {
    const key = keyOf(kept), memo = evMemo[left]; if (memo.has(key)) return memo.get(key);
    let ev = 0;
    for (const o of OUT[NDICE - kept.length]) { const d = [...kept, ...o.d]; ev += o.p * best(d, left).w; }
    memo.set(key, ev); return ev;
  };
  // the best thing to do holding these dice with `left` rolls still allowed
  const bestMemo = [new Map(), new Map(), new Map()];
  const best = (d, left) => {
    const key = keyOf(d); if (bestMemo[left].has(key)) return bestMemo[left].get(key);
    let pick = { t: 'pick', w: stop(d).w, b: stop(d).b };
    if (left > 0) for (const k of keeps(d)) { if (k.d.length === NDICE) continue; const w = after(k.d, left - 1); if (w > pick.w + 1e-9) pick = { t: 'roll', w, keep: k.d }; }
    bestMemo[left].set(key, pick); return pick;
  };
  return { best, stop };
}

function botStep(G, s, now, level = G.opts.bots) {
  const B = typeof level === 'object' ? level : BOTS[level] || BOTS.chill;
  if (!G.rolls) return doRoll(G, s, now);
  if (G.plan) { const want = G.plan; G.plan = null; if (G.held.every((h, k) => h === want[k])) return doRoll(G, s, now); }
  const P = planner(G.sheets[s], G.extra[s], B);
  const left = ROLLS - G.rolls, mv = P.best(G.dice, B.deep ? left : Math.min(1, left));
  if (mv.t === 'pick' || left <= 0) return doPick(G, s, P.stop(G.dice).b, now);
  // hold the dice it wants to keep, show that for a moment, then roll
  const need = counts(mv.keep), held = G.dice.map(v => (need[v]-- > 0));
  G.held = held; G.plan = held;
  if (held.every(Boolean)) { G.plan = null; return doPick(G, s, P.stop(G.dice).b, now); }
  return true;
}
export { botStep as _bot, planner as _planner };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'wait') { if (now < G.stageEnd) return false; startTurn(G, G.first, now); return true; }
  if (G.stage === 'pick') { if (now < G.stageEnd) return false; nextTurn(G, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot || G.auto) {
    if (now < G.botAt || rolling(G, now)) return false;
    const plan = !!G.plan;
    botStep(G, s, now, G.auto ? 'chill' : undefined);
    G.botAt = now + (G.plan && !plan ? wait(650, 1000) : wait(500, 900));
    return true;
  }
  if (G.tEnd && now >= G.tEnd) { G.auto = true; G.tEnd = 0; G.botAt = now + 300; return true; } // out of time: a careful bot finishes the turn
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.stage === 'turn') { G.botAt = Date.now() + 800; G.plan = null; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

// Someone watching can take over a bot's sheet at the start of the next round.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  const n = G.queue.length;
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return G.queue.length !== n || on;
}
function seatQueued(G) {
  while (G.queue.length) {
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
    game: 'pips', ph: G.ph, stage: G.stage, gid: G.gid, me: s, round: G.round, rounds: ROUNDS, turn: G.turn, first: G.first,
    timer: G.opts.timer, botsLevel: G.opts.bots, auto: G.auto,
    tLeft: G.stage === 'turn' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    dice: G.dice, held: G.held, rolls: G.rolls, rollN: G.rollN, rollAgo: now - G.rollAt, moved: G.moved, ms: MS,
    last: G.last && { ...G.last, ago: now - G.last.at },
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      sheet: G.sheets[i], extra: G.extra[i], gens: G.gens[i], tot: total(G.sheets[i], G.extra[i]),
    })),
    res: G.res, win: G.win, ev: G.ev, queued: G.queue.map(q => q.id),
  };
}

// Points are the final totals; the top total wins (a shared top score is a shared win).
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const tot = G.res.totals, top = Math.max(...tot);
  return G.seats.map((_, i) => ({ pts: tot[i], win: tot[i] === top }));
}

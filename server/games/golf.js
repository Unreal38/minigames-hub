// Mini Golf Party: everyone putts the same hole at the same time, each with their own ball (balls pass through
// each other). The server works out every shot with the shared physics and sends the path; clients replay it.
// Before each hole players may bet account coins on who will win it (meta.bank fills in the balances).
import { HOLES, buildHole, simulate, spotScore, MAX_STROKES, CAP_SCORE } from '../../public/games/golf/course.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'golf', name: 'Mini Golf Party', minPlayers: 1, maxPlayers: 6, bank: true, joinAt: 'hole' };

const BOT_NAMES = ['Bogey', 'Divot', 'Putters', 'Mulligan', 'Chip', 'Birdie', 'Caddy', 'Sandy'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const STAKES = [10, 25, 50];
const NOISE = { chill: [.25, .34], sharp: [.16, .22] }; // how much a bot's aim (radians) and power wobble
const BET_MS = 15_000, LOOK_MS = 3500, HOLE_MS = 90_000, DONE_MS = 6500, SETTLE_MS = 900;

export function cleanOpts(o = {}) {
  return {
    holes: [3, 6, 9].includes(+o.holes) ? +o.holes : 6,
    seats: [2, 4, 6].includes(+o.seats) ? +o.seats : 4,
    bets: o.bets === 'off' ? 'off' : 'on',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
  };
}

export function create(players, optsIn = {}, prev = null) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, wk: 'h:' + p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < opts.seats) seats.push({ id: null, wk: 'b:' + names[bi], name: names[bi], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  // which holes: all nine in order, or a random handful that still starts easy and ends on a harder one
  let order = HOLES.map((_, i) => i);
  if (opts.holes < order.length) order = order.sort(() => Math.random() - .5).slice(0, opts.holes).sort((a, b) => a - b);
  const wallet = {};
  for (const s of seats) wallet[s.wk] = s.human ? Math.max(0, prev?.wallet?.[s.wk] | 0) : 0;
  const G = {
    game: 'golf', ph: 'play', stage: 'bet', gid: Math.random().toString(36).slice(2, 8), seats, opts, wallet,
    order, mirror: order.map(() => Math.random() < .5), hi: -1, H: null, holeAt: 0, stageEnd: 0,
    balls: [], cards: seats.map(() => []), wins: seats.map(() => 0), shots: seats.map(() => 0), net: seats.map(() => 0),
    bets: seats.map(() => null), holeRes: null, shotN: 0, queue: [],
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  nextHole(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
const present = (G, i) => G.seats[i].human && !G.seats[i].bot;
const betting = G => G.opts.bets === 'on' && G.seats.length > 1;

function nextHole(G, now) {
  G.hi++;
  seatQueued(G);
  G.H = buildHole(G.order[G.hi], G.mirror[G.hi]);
  G.balls = G.seats.map(() => ({ x: G.H.tee.x, z: G.H.tee.z, strokes: 0, sunk: 0, out: false, busy: 0, shot: null, think: 0 }));
  // someone who cannot afford the smallest stake has nothing to decide, so betting does not wait for them
  G.bets = G.seats.map(x => (x.human && (G.wallet[x.wk] || 0) < STAKES[0] ? 'skip' : null));
  G.holeRes = null;
  G.stage = 'bet'; G.stageEnd = now + (betting(G) ? BET_MS : LOOK_MS);
  pushEv(G, { t: 'hole', i: G.hi });
}

function startPlay(G, now) {
  for (let s = 0; s < G.seats.length; s++) { // stakes leave the wallet when betting closes
    const b = G.bets[s]; if (!b || b === 'skip') { G.bets[s] = null; continue; }
    const k = G.seats[s].wk;
    b.amt = Math.min(b.amt, G.wallet[k]); G.wallet[k] -= b.amt;
    if (b.amt <= 0) G.bets[s] = null;
  }
  G.stage = 'play'; G.holeAt = now; G.stageEnd = now + HOLE_MS;
  G.balls.forEach((b, i) => { b.think = now + 2600 + Math.random() * 3000 + i * 200; });
  pushEv(G, { t: 'go', i: G.hi });
}

const doneBall = b => b.sunk || b.out;
const scoreOf = b => (b.sunk ? b.strokes : CAP_SCORE);

function shoot(G, s, ang, pow, now) {
  const b = G.balls[s];
  if (G.stage !== 'play' || !b || doneBall(b) || now < b.busy || b.strokes >= MAX_STROKES) return false;
  const t0 = (now - G.holeAt) / 1000;
  const r = simulate(G.H, b.x, b.z, ang, pow, t0, (Math.random() * 2 ** 31) | 0);
  b.strokes++; G.shots[s]++;
  const from = { x: b.x, z: b.z };
  if (r.water) { b.strokes = Math.min(MAX_STROKES, b.strokes + 1); } // a splash costs a stroke and the ball goes back
  else { b.x = r.x; b.z = r.z; }
  b.busy = now + r.ms + (r.sunk ? 500 : r.water ? 1100 : 250);
  if (r.sunk) b.sunk = now + r.ms;
  else if (b.strokes >= MAX_STROKES) b.out = true;
  b.shot = { n: ++G.shotN, path: r.path, fx: r.fx, ms: r.ms, at: now, sunk: r.sunk, water: r.water, x0: from.x, z0: from.z, ang, pow };
  b.think = b.busy + 1800 + Math.random() * 2200;
  return true;
}

// A bot tries a fan of shots with the real physics and takes the best one, with a wobble in its hands.
function botShot(G, s, now) {
  const b = G.balls[s], H = G.H, sharp = G.opts.bots === 'sharp', t0 = (now - G.holeAt) / 1000;
  const [na, np] = G._noise || (sharp ? NOISE.sharp : NOISE.chill);
  const toCup = Math.atan2(H.cup.x - b.x, -(H.cup.z - b.z)), cands = [];
  const score = (ang, pow) => {
    const r = simulate(H, b.x, b.z, ang, pow, t0, 7);
    return r.sunk ? -100 + pow : r.water ? 60 : spotScore(H, r.x, r.z);
  };
  const NA = sharp ? 28 : 12;
  for (let a = 0; a < NA; a++) for (const p of sharp ? [.18, .36, .56, .8] : [.22, .45, .7]) { const ang = toCup + a / NA * Math.PI * 2; cands.push({ ang, pow: p, sc: score(ang, p) }); }
  cands.sort((x, y) => x.sc - y.sc);
  if (sharp) { const c = cands[0]; for (const da of [-.06, -.03, .03, .06]) for (const dp of [-.08, 0, .08]) { const pow = Math.max(.05, Math.min(1, c.pow + dp)); cands.push({ ang: c.ang + da, pow, sc: score(c.ang + da, pow) }); } cands.sort((x, y) => x.sc - y.sc); }
  // of the best few, take the one that still works out if the hands wobble (so bots stay clear of the water)
  let best = null;
  for (const c of cands.slice(0, sharp ? 6 : 14)) {
    const worst = Math.max(Math.min(c.sc, 0) * .3 + Math.max(c.sc, 0), score(c.ang - na * .6, c.pow), score(c.ang + na * .6, c.pow)) + c.sc * .5;
    if (!best || worst < best.w) best = { ...c, w: worst };
  }
  const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  return shoot(G, s, best.ang + g() * na, Math.max(.05, Math.min(1, best.pow * (1 + g() * np))), now);
}

function endHole(G, now) {
  const n = G.seats.length, scores = G.balls.map(b => (b.sunk && b.sunk <= now ? b.strokes : CAP_SCORE));
  // the hole goes to the fewest strokes; a tie goes to whoever holed out first. Nobody in: nobody wins.
  let w = -1;
  G.balls.forEach((b, i) => { if (b.sunk && b.sunk <= now && (w < 0 || scores[i] < scores[w] || (scores[i] === scores[w] && b.sunk < G.balls[w].sunk))) w = i; });
  scores.forEach((sc, i) => G.cards[i].push(sc));
  if (w >= 0) G.wins[w]++;
  const pay = G.seats.map((seat, s) => {
    const b = G.bets[s]; if (!b) return null;
    const won = w < 0 ? b.amt : b.on === w ? b.amt * n : 0; // no winner: stakes come back
    G.wallet[seat.wk] += won; G.net[s] += won - b.amt;
    return { on: b.on, amt: b.amt, won, net: won - b.amt };
  });
  G.holeRes = { win: w, scores, pay, par: G.H.par };
  G.stage = 'done'; G.stageEnd = now + DONE_MS;
  pushEv(G, { t: 'holeEnd', i: G.hi, w });
}

const totalOf = (G, i) => G.cards[i].reduce((a, b) => a + b, 0);
function finish(G, now) {
  const order = G.seats.map((_, i) => i).sort((a, b) => totalOf(G, a) - totalOf(G, b) || G.wins[b] - G.wins[a] || a - b);
  G.ph = 'end'; G.stage = 'end'; G.win = order[0]; G.endAt = now;
  G.res = { order, totals: G.seats.map((_, i) => totalOf(G, i)), par: G.order.reduce((a, i) => a + HOLES[i].par, 0) };
  pushEv(G, { t: 'end', w: G.win });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  const now = Date.now();
  if (a.t === 'shot') {
    const ang = +a.ang, pow = +a.pow;
    if (!Number.isFinite(ang) || !Number.isFinite(pow) || pow < 0 || pow > 1) return false;
    return shoot(G, s, ang, pow, now);
  }
  if (a.t === 'bet') {
    if (G.stage !== 'bet' || !betting(G)) return false;
    const on = +a.on, coins = G.wallet[G.seats[s].wk];
    if (!Number.isInteger(on) || !G.seats[on]) return false;
    const amt = STAKES.includes(+a.amt) ? +a.amt : 0;
    if (amt <= 0 || amt > coins) return false;
    G.bets[s] = { on, amt };
    return true;
  }
  if (a.t === 'skip') { if (G.stage !== 'bet') return false; G.bets[s] = 'skip'; return true; }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'bet') {
    // betting closes early once everyone who is here has bet or passed
    if (betting(G) && G.seats.some((_, i) => present(G, i)) && G.seats.every((_, i) => !present(G, i) || G.bets[i]) && G.stageEnd - now > 1200) G.stageEnd = now + 1200;
    if (now < G.stageEnd) return false;
    startPlay(G, now);
    return true;
  }
  if (G.stage === 'play') {
    let changed = false;
    for (let s = 0; s < G.seats.length; s++) {
      const b = G.balls[s];
      if (!G.seats[s].bot || doneBall(b) || now < b.busy || now < b.think) continue;
      if (botShot(G, s, now)) { changed = true; break; } // one bot shot per tick keeps the server snappy
    }
    const settled = G.balls.every(b => doneBall(b) && now >= b.busy + SETTLE_MS);
    if (settled || now >= G.stageEnd) { endHole(G, now); return true; }
    return changed;
  }
  if (G.stage === 'done') {
    if (now < G.stageEnd) return false;
    if (G.hi + 1 >= G.order.length) finish(G, now); else nextHole(G, now);
    return true;
  }
  return false;
}

// A player who drops out keeps their ball; a bot putts for them until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (away && G.balls[s]) G.balls[s].think = Date.now() + 1500;
  return true;
}

// Someone watching can take over a bot's ball (and its score so far) from the next hole.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  G.queue = (G.queue || []).filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return true;
}
function seatQueued(G) {
  while (G.queue?.length) {
    const i = G.seats.findIndex(s => !s.human);
    if (i < 0) break;
    const p = G.queue.shift();
    Object.assign(G.seats[i], { id: p.id, wk: 'h:' + p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    G.wallet[G.seats[i].wk] ??= 0; G.net[i] = 0;
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'golf', ph: G.ph, stage: G.stage, gid: G.gid, me: s, hole: G.hi + 1, holes: G.order.length,
    hdef: { i: G.order[G.hi], mirror: G.mirror[G.hi] }, par: G.H.par, name: G.H.name,
    pars: G.order.map(i => HOLES[i].par), left: Math.max(0, G.stageEnd - now), clock: G.stage === 'play' ? now - G.holeAt : 0,
    bets: betting(G), mult: G.seats.length, max: MAX_STROKES, cap: CAP_SCORE,
    seats: G.seats.map((x, i) => {
      const b = G.balls[i], sh = b.shot;
      return {
        name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
        x: b.x, z: b.z, strokes: b.strokes, sunk: !!b.sunk, out: b.out, wait: Math.max(0, b.busy - now),
        card: G.cards[i], total: totalOf(G, i), wins: G.wins[i], coins: x.human ? G.wallet[x.wk] : null, net: G.net[i],
        bet: G.bets[i] === 'skip' ? 'skip' : G.bets[i],
        // the path is only sent while the shot is still worth replaying
        shot: sh ? { n: sh.n, ms: sh.ms, ago: now - sh.at, sunk: sh.sunk, water: sh.water, x0: sh.x0, z0: sh.z0, ang: sh.ang, pow: sh.pow, ...(now - sh.at < sh.ms + 1500 ? { path: sh.path, fx: sh.fx } : {}) } : null,
      };
    }),
    holeRes: G.holeRes, res: G.res, win: G.win, ev: G.ev,
  };
}

// Per-seat outcome: 10 points for every player you beat, 5 for every hole you won, 10 more for winning the round.
// Coins won or lost on bets go straight to the account (coinNet). Never hit a ball: no reward.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + G.wins[i] * 5 + (place === 0 ? 10 : 0), win: place === 0, place: place + 1, idle: !G.shots[i], coinNet: G.net[i] };
  });
}

// for tests
export const _shoot = shoot;

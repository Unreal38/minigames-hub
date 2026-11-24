// Sky Pool: 8-ball on one table. Two players, or two teams of two whose partners take turns at the table.
// The server decides every shot with the shared physics (public/games/pool/rules.js) and sends only the aim and the
// power; every browser replays the same roll. What a shot means (groups, fouls, the black) is settled when the balls
// have stopped, so the screen and the rules never run ahead of each other.
import { N, R, HX, HZ, HEAD_X, FOOT_X, POCKETS, ROLL, DRAG, V_MIN, V_MAX, rack, simulate, judge, placeOk, freeSpot, aimCast, legalFirst, kindOf, leftOf, sideOf, dirOf } from '../../public/games/pool/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'pool', name: 'Sky Pool', minPlayers: 1, maxPlayers: 4 };

const BOT_NAMES = ['Chalky', 'Cushion', 'Pocket', 'Felty', 'Rails', 'Banks', 'Stripes', 'Dot'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const WIND = 380;          // ms the cue takes to strike before the balls set off (browsers show it)
const SETTLE = 450, RACK_MS = 4800, SLOW_MS = 10_000, MAX_SHOTS = 140;
// Bots. aim: how much the hand wobbles (radians); pace: how much the power wobbles; tries: how many shots they
// think through with the real physics before picking one.
export const BOTS = {
  chill: { aim: .03, pace: .18, tries: 3, brk: 880 },
  sharp: { aim: .004, pace: .04, tries: 14, brk: 1000 },
  late: { aim: .05, pace: .3, tries: 2, brk: 700 }, // the shot the game plays for someone who ran out of time
};
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export function cleanOpts(o = {}) {
  return {
    seats: +o.seats === 4 ? 4 : 2,
    to: +o.to === 2 ? 2 : 1,                       // racks needed: 1 = a single rack, 2 = best of three
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 20, 30, 45].includes(+o.timer) ? +o.timer : 30,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const n = players.length > 2 ? 4 : opts.seats;
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(x => !used.has(x)).sort(() => Math.random() - .5);
  const seats = players.slice(0, n).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)).sort(() => Math.random() - .5), ...BOT_COLS];
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const G = {
    game: 'pool', ph: 'play', stage: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    wins: [0, 0], rackN: 0, breaker: Math.random() < .5 ? 0 : 1, idx: [0, 0],
    B: null, group: [null, null], side: 0, turn: -1, hand: '', brk: true, shots: 0, shotN: 0, shot: null, pend: null,
    busy: 0, tEnd: 0, botAt: 0, placed: false, stageEnd: 0,
    st: seats.map(() => ({ shots: 0, auto: 0, pots: 0, fouls: 0 })), slow: seats.map(() => false),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  newRack(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 20) G.ev.shift(); }
const seatFor = (G, side) => (G.seats.length === 4 ? side + 2 * G.idx[side] : side);

function newRack(G, now) {
  G.rackN++; G.stage = 'play';
  G.B = rack(); G.group = [null, null]; G.brk = true; G.hand = 'k'; G.shots = 0; G.shot = null; G.pend = null;
  G.side = G.breaker; G.turn = seatFor(G, G.side);
  pushEv(G, { t: 'start', rack: G.rackN, s: G.turn });
  openTurn(G, now + 1600);
}
// Seat G.turn may shoot from `from`.
function openTurn(G, from) {
  const s = G.turn, t = G.opts.timer;
  G.busy = from; G.placed = false;
  G.tEnd = t && !G.seats[s].bot ? from + (G.slow[s] ? Math.min(SLOW_MS, t * 1000) : t * 1000) : 0;
  G.botAt = from + rnd(1300, 2500);
}

function shoot(G, s, ix, iz, pw, now, auto = false) {
  if (G.ph !== 'play' || G.stage !== 'play' || G.turn !== s || G.pend || now < G.busy) return false;
  ix = Math.round(ix); iz = Math.round(iz); pw = Math.round(pw);
  if (!Number.isFinite(ix) || !Number.isFinite(iz) || !Number.isFinite(pw) || (!ix && !iz) || Math.abs(ix) > 2e6 || Math.abs(iz) > 2e6 || pw < 0 || pw > 1000) return false;
  const from = G.B, sim = simulate(from, ix, iz, pw);
  const J = judge({ group: G.group, side: G.side, brk: G.brk, on: from.on }, sim);
  G.B = { x: sim.x, z: sim.z, on: sim.on };
  G.shot = { n: ++G.shotN, s, ix, iz, pw, from, at: now, ms: sim.ms };
  G.pend = { J, at: now + WIND + sim.ms + SETTLE };
  G.busy = G.pend.at; G.tEnd = 0; G.shots++;
  G.st[s].shots++; if (auto) G.st[s].auto++; else G.slow[s] = false;
  pushEv(G, { t: 'shot', s });
  return true;
}

// The balls have stopped: apply what the shot meant.
function settle(G, now) {
  const J = G.pend.J, s = G.turn, side = G.side, B = G.B;
  G.pend = null; G.brk = false;
  G.st[s].pots += J.own; if (J.foul) G.st[s].fouls++;
  G.group = J.group;
  if (J.respot8) { B.on[8] = false; B.x[8] = freeSpot(B, FOOT_X); B.z[8] = 0; B.on[8] = true; }
  if (!B.on[0]) { B.x[0] = freeSpot(B, HEAD_X, -1); B.z[0] = 0; B.on[0] = true; }
  pushEv(G, { t: 'res', s, side, foul: J.foul, pots: J.potted, took: J.took, keep: J.keep, respot: J.respot8 });
  if (J.win >= 0) return endRack(G, J.win, J.why, now);
  if (G.shots >= MAX_SHOTS) { // a rack that will not end: fewer balls left takes it
    const left = sd => (G.group[sd] ? leftOf(B.on, G.group[sd]) : 7), a = left(0), b = left(1);
    return endRack(G, a < b ? 0 : b < a ? 1 : 1 - side, 'long', now);
  }
  if (J.keep) { G.hand = ''; return openTurn(G, now); }
  if (G.seats.length === 4) G.idx[side] ^= 1; // next time this team is at the table, the partner shoots
  G.side = 1 - side; G.turn = seatFor(G, G.side); G.hand = J.foul ? 'a' : '';
  openTurn(G, now + 250);
}
function endRack(G, w, why, now) {
  G.wins[w]++; G.turn = -1; G.tEnd = 0; G.hand = '';
  pushEv(G, { t: 'rack', w, why, wins: G.wins.slice() });
  if (G.wins[w] >= G.opts.to) {
    G.ph = 'end'; G.stage = 'end'; G.win = w; G.endAt = now;
    G.res = { wins: G.wins.slice(), racks: G.rackN, why };
    pushEv(G, { t: 'end', w });
    return;
  }
  G.stage = 'rack'; G.stageEnd = now + RACK_MS; G.breaker = 1 - G.breaker;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  const now = Date.now();
  if (a.t === 'place') {
    if (!G.hand || G.turn !== s || G.pend || G.stage !== 'play' || now < G.busy) return false;
    const x = Math.round(+a.x * 1e4) / 1e4, z = Math.round(+a.z * 1e4) / 1e4;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !placeOk(G.B, x, z, G.hand === 'k')) return false;
    G.B.x[0] = x; G.B.z[0] = z;
    return true;
  }
  if (a.t === 'shot') return shoot(G, s, +a.ix, +a.iz, +a.pw, now);
  return false;
}

// ---------- bots ----------
// How far a ball rolls from speed v before it stops, and the speed needed to roll a distance.
const stopDist = v => v / DRAG - ROLL / (DRAG * DRAG) * Math.log(1 + DRAG * v / ROLL);
function speedFor(d) { let lo = 0, hi = 40; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (stopDist(m) < d) lo = m; else hi = m; } return hi; }
const powerFor = v => Math.max(60, Math.min(1000, Math.round((v - V_MIN) / (V_MAX - V_MIN) * 1000)));
// Is any ball (other than a and b) in the way of a ball rolling from (x0, z0) to (x1, z1)?
function blocked(B, x0, z0, x1, z1, a, b) {
  const ex = x1 - x0, ez = z1 - z0, L2 = ex * ex + ez * ez; if (L2 < 1e-9) return false;
  for (let i = 0; i < N; i++) {
    if (i === a || i === b || !B.on[i]) continue;
    let u = ((B.x[i] - x0) * ex + (B.z[i] - z0) * ez) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = B.x[i] - (x0 + ex * u), qz = B.z[i] - (z0 + ez * u);
    if (qx * qx + qz * qz < 4 * R * R * .98) return true;
  }
  return false;
}
const targets = G => { const out = []; for (let b = 1; b < N; b++) if (G.B.on[b] && legalFirst(G.group, G.side, G.B.on, b, G.brk)) out.push(b); return out; };
// Every way of rolling a ball the shooter may hit into a pocket from where the cue ball is (or would be at cx, cz).
function pots(G, cx = G.B.x[0], cz = G.B.z[0]) {
  const B = G.B, out = [];
  for (const b of targets(G)) for (let p = 0; p < 6; p++) {
    const P = POCKETS[p], vx = P.ax - B.x[b], vz = P.az - B.z[b], d = Math.hypot(vx, vz); if (d < 1e-6) continue;
    const ux = vx / d, uz = vz / d;
    if (p % 3 === 1 && Math.abs(uz) < .5) continue; // too flat an angle for a middle pocket
    const gx = B.x[b] - ux * 2 * R, gz = B.z[b] - uz * 2 * R, wx = gx - cx, wz = gz - cz, dc = Math.hypot(wx, wz); if (dc < 1e-6) continue;
    const cut = (wx * ux + wz * uz) / dc; if (cut < .3) continue;
    if (blocked(B, B.x[b], B.z[b], P.ax, P.az, b, 0) || blocked(B, cx, cz, gx, gz, 0, b)) continue;
    out.push({ b, p, d, dc, cut, dx: wx / dc, dz: wz / dc, score: cut * 2.2 - dc * .05 - d * .12 });
  }
  return out.sort((a, c) => c.score - a.score);
}
const toInts = (dx, dz) => [Math.round(dx * 1e6), Math.round(dz * 1e6)];
function turned(dx, dz, a) { const c = Math.cos(a), s = Math.sin(a); return [dx * c - dz * s, dx * s + dz * c]; }

// The shot a bot wants to play, before its hand wobbles: { dx, dz, pw }.
function plan(G, K) {
  const B = G.B, cx = B.x[0], cz = B.z[0];
  if (G.brk) { // the break: hard at the front ball
    let b = -1; for (let i = 1; i < N; i++) if (B.on[i] && (b < 0 || B.x[i] < B.x[b])) b = i;
    const wx = B.x[b] - cx, wz = B.z[b] - cz, d = Math.hypot(wx, wz) || 1;
    return { dx: wx / d, dz: wz / d, pw: K.brk };
  }
  const st = { group: G.group, side: G.side, brk: false, on: B.on };
  const good = (dx, dz, pw, b) => { const [ix, iz] = toInts(dx, dz), sim = simulate(B, ix, iz, pw), J = judge(st, sim); return !J.foul && J.win !== 1 - G.side && J.potted.includes(b) ? (J.keep || J.win === G.side ? 2 : 1) : 0; };
  const cands = pots(G);
  let tries = K.tries, fall = null;
  for (const c of cands) {
    if (tries <= 0) break;
    const vObj = speedFor(c.d + 1.1) / (c.cut * .975), pw = powerFor(speedFor(stopDist(vObj) + c.dc));
    fall ||= { dx: c.dx, dz: c.dz, pw };
    for (const [da, k] of [[0, 1], [0, 1.3], [.006, 1], [-.006, 1], [0, .8]]) {
      if (tries-- <= 0) break;
      const [dx, dz] = turned(c.dx, c.dz, da), p2 = Math.max(60, Math.min(1000, Math.round(pw * k)));
      if (good(dx, dz, p2, c.b)) return { dx, dz, pw: p2 };
    }
  }
  if (fall) return fall;
  // nothing to pot: touch a ball that is allowed, softly, without losing the cue ball
  let best = null;
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), hit = aimCast(B, dx, dz);
    if (hit.b < 0 || !legalFirst(G.group, G.side, B.on, hit.b, G.brk)) continue;
    if (!best || hit.t < best.t) best = { dx, dz, t: hit.t };
  }
  if (best) {
    for (const pw of [powerFor(speedFor(best.t + 1.5)), 300, 520]) { const [ix, iz] = toInts(best.dx, best.dz), J = judge(st, simulate(B, ix, iz, pw)); if (!J.foul && J.win < 0) return { dx: best.dx, dz: best.dz, pw }; }
    return { dx: best.dx, dz: best.dz, pw: 300 };
  }
  // every allowed ball is hidden: go for the nearest one anyway, off whatever is in the way
  const T = targets(G); let b = T[0] ?? 8, bd = Infinity;
  for (const t of T) { const d = Math.hypot(B.x[t] - cx, B.z[t] - cz); if (d < bd) { bd = d; b = t; } }
  const wx = B.x[b] - cx, wz = B.z[b] - cz, d = Math.hypot(wx, wz) || 1;
  return { dx: wx / d, dz: wz / d, pw: 420 };
}
// Cue ball in hand: put it a little behind the easiest straight pot.
function botPlace(G) {
  const B = G.B;
  if (G.hand === 'k') { const z = Math.round(rnd(-.7, .7) * 100) / 100; if (placeOk(B, HEAD_X - .2, z, true)) { B.x[0] = HEAD_X - .2; B.z[0] = z; } return; }
  let best = null;
  for (const b of targets(G)) for (let p = 0; p < 6; p++) {
    const P = POCKETS[p], vx = P.ax - B.x[b], vz = P.az - B.z[b], d = Math.hypot(vx, vz); if (d < 1e-6) continue;
    const ux = vx / d, uz = vz / d;
    if ((p % 3 === 1 && Math.abs(uz) < .6) || blocked(B, B.x[b], B.z[b], P.ax, P.az, b, 0)) continue;
    for (const back of [1.1, .7, 1.7]) {
      const x = Math.round((B.x[b] - ux * (2 * R + back)) * 1e4) / 1e4, z = Math.round((B.z[b] - uz * (2 * R + back)) * 1e4) / 1e4;
      if (!placeOk(B, x, z) || blocked(B, x, z, B.x[b] - ux * 2 * R, B.z[b] - uz * 2 * R, 0, b)) continue;
      if (!best || d < best.d) best = { x, z, d };
      break;
    }
  }
  if (best) { B.x[0] = best.x; B.z[0] = best.z; }
}
function botShot(G, s, now, K, auto = false) {
  const P = plan(G, K);
  const [dx, dz] = turned(P.dx, P.dz, gauss() * K.aim), pw = Math.max(40, Math.min(1000, Math.round(P.pw * (1 + gauss() * K.pace))));
  const [ix, iz] = toInts(dx, dz);
  return shoot(G, s, ix, iz, pw, now, auto);
}
export { plan as _plan, botShot as _botShot, shoot as _shoot, settle as _settle };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'rack') { if (now < G.stageEnd) return false; newRack(G, now); return true; }
  if (G.pend) { if (now < G.pend.at) return false; settle(G, now); return true; }
  const s = G.turn; if (s < 0 || now < G.busy) return false;
  if (G.seats[s].bot) {
    if (now < G.botAt) return false;
    if (G.hand && !G.placed) { botPlace(G); G.placed = true; G.botAt = now + 900; return true; }
    return botShot(G, s, now, BOTS[G.opts.bots]);
  }
  if (G.tEnd && now >= G.tEnd) { // out of time: the game plays a clumsy shot, and the next turns are short
    G.slow[s] = true;
    if (botShot(G, s, now, BOTS.late, true)) { pushEv(G, { t: 'late', s }); return true; }
  }
  return false;
}

// A player who drops out is played by a bot until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  const now = Date.now();
  if (G.turn === s && G.stage === 'play' && !G.pend) {
    G.botAt = Math.max(G.busy, now) + 1200;
    G.tEnd = away || !G.opts.timer ? 0 : Math.max(G.busy, now) + G.opts.timer * 1000;
  }
  return true;
}

export function view(G, s) {
  const now = Date.now(), sh = G.shot;
  return {
    game: 'pool', ph: G.ph, stage: G.stage, gid: G.gid, me: s, rack: G.rackN, to: G.opts.to, timer: G.opts.timer, wins: G.wins,
    turn: G.stage === 'play' ? G.turn : -1, side: G.side, hand: G.pend ? '' : G.hand, brk: G.brk, group: G.group, rolling: !!G.pend,
    tin: Math.max(0, G.busy - now), tLeft: G.tEnd && !G.pend ? Math.max(0, G.tEnd - now) : -1,
    rackLeft: G.stage === 'rack' ? Math.max(0, G.stageEnd - now) : 0, wind: WIND,
    bx: G.B.x, bz: G.B.z, on: G.B.on,
    // the starting places are only sent while the shot is still worth replaying
    shot: sh ? { n: sh.n, s: sh.s, ix: sh.ix, iz: sh.iz, pw: sh.pw, ms: sh.ms, ago: now - sh.at, ...(now - sh.at < WIND + sh.ms + 2500 ? { from: sh.from } : {}) } : null,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, st: G.st[i] })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Both players of the winning side win. 10 points a rack won, and a point a ball potted.
// Someone whose every shot was played by the timer earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const half = G.seats.length / 2;
  return G.seats.map((x, i) => { const win = sideOf(i) === G.win; return { pts: G.wins[sideOf(i)] * 10 + Math.min(9, G.st[i].pots), win, place: win ? 1 : 1 + half, idle: x.human && G.st[i].auto > 0 && G.st[i].shots === G.st[i].auto }; });
}

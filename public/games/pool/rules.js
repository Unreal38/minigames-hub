// Sky Pool: the table, the ball physics and the 8-ball rules. Shared by the server (which decides every shot) and the
// browser (which replays the same shot to draw it). The physics uses only + - * / and Math.sqrt, and every shot starts
// from whole numbers (aim ix, iz and power pw), so both sides work out exactly the same roll. Never add sin, cos,
// hypot or pow to simulate().

// ----- the table (x runs along the long side, z across; the middle of the cloth is 0, 0) -----
export const TL = 10, TW = 5, R = .15;           // playing surface length and width, ball radius
export const HX = TL / 2, HZ = TW / 2;
export const HEAD_X = -HX / 2, FOOT_X = HX / 2;  // the cue ball starts behind the head line; the rack's first ball sits on the foot spot
const PC = .34, PS = .33, SIDE_OUT = .1;         // how close to a pocket's middle a ball's middle must come to drop
// pockets: x, z, catch radius, and where to aim to roll a ball in
export const POCKETS = [
  { x: -HX, z: -HZ, r: PC, ax: -HX + .1, az: -HZ + .1 }, { x: 0, z: -HZ - SIDE_OUT, r: PS, ax: 0, az: -HZ }, { x: HX, z: -HZ, r: PC, ax: HX - .1, az: -HZ + .1 },
  { x: -HX, z: HZ, r: PC, ax: -HX + .1, az: HZ - .1 }, { x: 0, z: HZ + SIDE_OUT, r: PS, ax: 0, az: HZ }, { x: HX, z: HZ, r: PC, ax: HX - .1, az: HZ - .1 },
];

// ----- the feel of the table (tuning knobs) -----
export const STEP_HZ = 240, FRAME_EVERY = 2;     // physics steps a second; every 2nd step is kept for drawing (120 a second)
export const FRAME_HZ = STEP_HZ / FRAME_EVERY;
const DT = 1 / STEP_HZ;
export const V_MIN = .9, V_MAX = 18;             // cue ball speed at power 0 and at full power (table lengths are 10)
export const ROLL = 1.1, DRAG = .22;             // slowing down: a steady part and a part that grows with speed
const E_BALL = .95, E_RAIL = .76, RAIL_RUB = .97; // bounce kept ball to ball, off a cushion, and the speed kept along the cushion
const MAX_T = 22;                                // seconds; nothing rolls this long

// ----- balls: 0 is the cue ball, 1 to 7 plain, 8 the black, 9 to 15 striped -----
export const N = 16;
export const kindOf = b => (b === 0 ? 'c' : b === 8 ? 'e' : b < 8 ? 's' : 't');
export const other = k => (k === 's' ? 't' : 's');
export const sideOf = seat => seat % 2;          // seats 0 and 2 play together against 1 and 3
export const leftOf = (on, k) => { let n = 0; for (let b = 1; b < N; b++) if (on[b] && kindOf(b) === k) n++; return n; };

const round4 = v => Math.round(v * 1e4) / 1e4;

// A fresh rack: fifteen balls in a triangle with the black in the middle and one of each kind in the back corners.
export function rack(rnd = Math.random) {
  const x = new Array(N).fill(0), z = new Array(N).fill(0), on = new Array(N).fill(true);
  x[0] = HEAD_X; z[0] = 0;
  const sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const S = sh([1, 2, 3, 4, 5, 6, 7]), T = sh([9, 10, 11, 12, 13, 14, 15]);
  const rows = ['s', 'ts', 's8t', 'tsts', 'sttst'], flip = rnd() < .5 ? -1 : 1, swap = rnd() < .5;
  const gap = 2 * R + .004, dx = gap * .8660254;
  rows.forEach((row, r) => [...row].forEach((ch, i) => {
    const want = ch === '8' ? 'e' : (ch === 's') !== swap ? 's' : 't';
    const b = want === 'e' ? 8 : want === 's' ? S.pop() : T.pop();
    x[b] = round4(FOOT_X + r * dx); z[b] = round4((i - r / 2) * gap * flip);
  }));
  return { x, z, on };
}

// The aim as the server and the browser both use it: whole numbers in, a unit direction out.
export function dirOf(ix, iz) {
  const d = Math.sqrt(ix * ix + iz * iz);
  return d > 0 ? { dx: ix / d, dz: iz / d } : { dx: 1, dz: 0 };
}
export const speedOf = pw => V_MIN + Math.max(0, Math.min(1000, pw)) / 1000 * (V_MAX - V_MIN);

// One shot, start to finish. `B` is { x, z, on }; it is not changed. With `rec`, every drawn frame is kept.
// Returns where everything stopped, the first ball the cue ball touched, what dropped where and when, and the
// knocks for sounds.
export function simulate(B, ix, iz, pw, rec = false) {
  const x = B.x.slice(), z = B.z.slice(), on = B.on.slice(), vx = new Array(N).fill(0), vz = new Array(N).fill(0);
  const { dx, dz } = dirOf(ix, iz), sp = speedOf(pw);
  vx[0] = dx * sp; vz[0] = dz * sp;
  const pots = [], hits = [], D2 = 4 * R * R, xm = HX - R, zm = HZ - R;
  let first = -1, rails = 0, step = 0, moving = on[0], frames = null, nf = 0, cap = 0;
  if (rec) { cap = 600; frames = new Float32Array(cap * N * 2); }
  const keep = () => {
    if (nf >= cap) { cap *= 2; const f = new Float32Array(cap * N * 2); f.set(frames); frames = f; }
    const o = nf++ * N * 2; for (let i = 0; i < N; i++) { frames[o + i * 2] = x[i]; frames[o + i * 2 + 1] = z[i]; }
  };
  if (rec) keep();
  const knock = (k, v, a, b) => { if (v > .25 && hits.length < 400) hits.push({ t: step * DT, k, v, a, b }); };
  while (moving && step * DT < MAX_T) {
    step++; moving = false;
    for (let i = 0; i < N; i++) {
      if (!on[i]) continue;
      const s2 = vx[i] * vx[i] + vz[i] * vz[i]; if (s2 === 0) continue;
      const s = Math.sqrt(s2), ns = s - (ROLL + DRAG * s) * DT;
      if (ns <= .012) { vx[i] = 0; vz[i] = 0; continue; }
      const k = ns / s; vx[i] *= k; vz[i] *= k;
      x[i] += vx[i] * DT; z[i] += vz[i] * DT; moving = true;
    }
    // ball against ball
    for (let i = 0; i < N; i++) {
      if (!on[i]) continue;
      for (let j = i + 1; j < N; j++) {
        if (!on[j]) continue;
        const ex = x[j] - x[i], ez = z[j] - z[i], d2 = ex * ex + ez * ez;
        if (d2 >= D2 || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = ex / d, nz = ez / d, push = (2 * R - d) / 2;
        x[i] -= nx * push; z[i] -= nz * push; x[j] += nx * push; z[j] += nz * push;
        const vn = (vx[i] - vx[j]) * nx + (vz[i] - vz[j]) * nz;
        if (vn <= 0) continue;
        const imp = vn * (1 + E_BALL) / 2;
        vx[i] -= imp * nx; vz[i] -= imp * nz; vx[j] += imp * nx; vz[j] += imp * nz;
        if (i === 0 && first < 0) first = j;
        knock('b', vn, i, j); moving = true;
      }
    }
    // pockets first, then the cushions
    for (let i = 0; i < N; i++) {
      if (!on[i]) continue;
      let gone = false;
      if (x[i] < -xm + .3 || x[i] > xm - .3 || z[i] < -zm + .12 || z[i] > zm - .12) {
        for (let p = 0; p < 6; p++) {
          const P = POCKETS[p], ex = x[i] - P.x, ez = z[i] - P.z;
          if (ex * ex + ez * ez < P.r * P.r) { on[i] = false; vx[i] = 0; vz[i] = 0; pots.push({ b: i, p, t: step * DT }); gone = true; break; }
        }
      }
      if (gone) continue;
      if (x[i] < -xm) { x[i] = -xm; if (vx[i] < 0) { knock('w', -vx[i], i, -1); vx[i] = -vx[i] * E_RAIL; vz[i] *= RAIL_RUB; if (first >= 0) rails++; } }
      else if (x[i] > xm) { x[i] = xm; if (vx[i] > 0) { knock('w', vx[i], i, -1); vx[i] = -vx[i] * E_RAIL; vz[i] *= RAIL_RUB; if (first >= 0) rails++; } }
      if (z[i] < -zm) { z[i] = -zm; if (vz[i] < 0) { knock('w', -vz[i], i, -1); vz[i] = -vz[i] * E_RAIL; vx[i] *= RAIL_RUB; if (first >= 0) rails++; } }
      else if (z[i] > zm) { z[i] = zm; if (vz[i] > 0) { knock('w', vz[i], i, -1); vz[i] = -vz[i] * E_RAIL; vx[i] *= RAIL_RUB; if (first >= 0) rails++; } }
    }
    if (rec && step % FRAME_EVERY === 0) keep();
  }
  for (let i = 0; i < N; i++) { x[i] = round4(x[i]); z[i] = round4(z[i]); }
  if (rec) keep();
  return { x, z, on, first, pots, hits, rails, ms: Math.round(step * DT * 1000), frames, nf };
}

// What a shot means under the rules. `st` is how things stood before it: { group: [kind of side 0, kind of side 1],
// side (who shot), brk (the break shot), on (balls on the table before) }.
//   foul: '' | 'scratch' (cue ball dropped) | 'miss' (touched nothing) | 'wrong' (touched the wrong ball first)
//   win: the side that takes the rack, or -1
export function judge(st, sim) {
  const { group, side, brk } = st, mine = group[side];
  const potted = sim.pots.map(p => p.b), scratch = potted.includes(0), eight = potted.includes(8);
  const onEight = !!mine && leftOf(st.on, mine) === 0;
  let foul = '';
  if (scratch) foul = 'scratch';
  else if (sim.first < 0) foul = 'miss';
  else {
    const fk = kindOf(sim.first);
    if (onEight) { if (fk !== 'e') foul = 'wrong'; }
    else if (mine) { if (fk !== mine) foul = 'wrong'; }
    else if (fk === 'e' && !brk) foul = 'wrong';
  }
  let win = -1, why = '';
  if (eight && !brk) {
    if (onEight && !foul) { win = side; why = 'eight'; }
    else { win = 1 - side; why = onEight ? 'foul8' : 'early'; }
  }
  const obj = potted.filter(b => b !== 0 && b !== 8);
  let ng = group, took = '';
  if (!mine && !brk && !foul && obj.length && win < 0) { took = kindOf(obj[0]); ng = side === 0 ? [took, other(took)] : [other(took), took]; }
  const g = ng[side];
  const keep = !foul && win < 0 && (g ? obj.some(b => kindOf(b) === g) : obj.length > 0);
  return { foul, win, why, group: ng, took, keep, respot8: eight && brk, potted, own: g ? obj.filter(b => kindOf(b) === g).length : obj.length };
}

// May the cue ball be put down here? `kitchen`: only behind the head line (the break).
export function placeOk(B, px, pz, kitchen = false) {
  if (!(px >= -HX + R && px <= HX - R && pz >= -HZ + R && pz <= HZ - R)) return false;
  if (kitchen && px > HEAD_X) return false;
  for (let b = 1; b < N; b++) { if (!B.on[b]) continue; const ex = B.x[b] - px, ez = B.z[b] - pz; if (ex * ex + ez * ez < (2 * R + .004) * (2 * R + .004)) return false; }
  return true;
}
// A free place for a ball at or near (sx, 0): it slides along the long middle line until nothing is in the way.
export function freeSpot(B, sx, dir = 1) {
  for (let k = 0; k < 200; k++) {
    for (const s of k ? [dir, -dir] : [1]) { const px = round4(sx + s * k * .05); if (Math.abs(px) <= HX - R && placeOk(B, px, 0)) return px; }
  }
  return sx;
}

// Where a cue ball sent along (dx, dz) first touches something: the nearest ball, or else a cushion.
// Returns { t (distance rolled), b (ball touched or -1), gx, gz (where the cue ball is then), nx, nz (the way the
// touched ball is pushed, or the cushion's bounce direction) }.
export function aimCast(B, dx, dz, from = 0) {
  const cx = B.x[from], cz = B.z[from];
  let t = Infinity, hit = -1;
  for (let b = 0; b < N; b++) {
    if (b === from || !B.on[b]) continue;
    const ox = B.x[b] - cx, oz = B.z[b] - cz, pr = ox * dx + oz * dz; if (pr <= 0) continue;
    const perp2 = ox * ox + oz * oz - pr * pr; if (perp2 >= 4 * R * R) continue;
    const tt = pr - Math.sqrt(4 * R * R - perp2);
    if (tt < t) { t = Math.max(0, tt); hit = b; }
  }
  let wt = Infinity, wx = 0, wz = 0;
  if (dx > 0) { const q = (HX - R - cx) / dx; if (q < wt) { wt = q; wx = -dx; wz = dz; } } else if (dx < 0) { const q = (-HX + R - cx) / dx; if (q < wt) { wt = q; wx = -dx; wz = dz; } }
  if (dz > 0) { const q = (HZ - R - cz) / dz; if (q < wt) { wt = q; wx = dx; wz = -dz; } } else if (dz < 0) { const q = (-HZ + R - cz) / dz; if (q < wt) { wt = q; wx = dx; wz = -dz; } }
  if (hit < 0 || wt < t) return { t: Math.max(0, wt), b: -1, gx: cx + dx * wt, gz: cz + dz * wt, nx: wx, nz: wz };
  const gx = cx + dx * t, gz = cz + dz * t, nx = (B.x[hit] - gx) / (2 * R), nz = (B.z[hit] - gz) / (2 * R);
  return { t, b: hit, gx, gz, nx, nz };
}

// Which ball may the shooter touch first? (for the aim line's colour and for bots)
export function legalFirst(group, side, on, b, brk = false) {
  if (b <= 0) return false;
  const mine = group[side], k = kindOf(b);
  if (mine) return leftOf(on, mine) === 0 ? k === 'e' : k === mine;
  return brk || k !== 'e';
}

// The colour of each ball (1 to 7; the striped 9 to 15 repeat them). Drawn by the table and by the score panels.
export const BALL_COLS = ['#fff8ec', '#ffc93c', '#4a7dff', '#e5543b', '#9a6bd6', '#ff8a3c', '#3fae6a', '#a8433f', '#2a1422'];
export const colOf = b => (b === 0 ? BALL_COLS[0] : b === 8 ? BALL_COLS[8] : BALL_COLS[b > 8 ? b - 8 : b]);

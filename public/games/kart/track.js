// Kart Island Race: the tracks and the kart physics. Shared by the server (bots, laps, items) and the browser
// (your own kart is driven here, then reported to the server), so both sides agree on how a kart moves.
//
// A track is a closed Catmull-Rom loop through control points [x, z, y, kind]. kind 'b' makes the stretch to the
// next point a wooden bridge (rails, no grass); anything else is island land (grass shoulders, then the edge).
// buildTrack() samples it every STEP units: x/z/y, the direction of travel (tx/tz) and whether it is a bridge.

export const STEP = 1;        // sample spacing along the track
export const ROAD = 5.4;      // half width of the road
export const SHOULDER = 9.4;  // on land: grass from ROAD out to here, then you fall off the island
export const RAIL = 6;      // on bridges: rails at this half width
export const KART_R = .95;    // karts bump as circles of this radius
export const MAX_V = 25;      // top speed on the road, units a second
export const GRID = 22;       // the starting grid starts this far behind the line
export const SCALE = 1.65;    // the control points below are multiplied by this (heights by a little less): how roomy the tracks are

// Item boxes sit in rows across the road at these fractions of a lap; pads give a short boost.
export const TRACKS = {
  meadow: {
    name: 'Meadow Loop', blurb: 'Wide and friendly, with two bridges',
    pts: [[0, 0, 0], [34, -2, 0], [62, 6, 0, 'b'], [86, 22, .8], [96, 48, 1], [88, 74, 1, 'b'], [64, 88, .4], [36, 84, 0], [18, 66, 0], [-4, 62, 0, 'b'],
      [-34, 70, 1.4], [-58, 58, 1.6], [-64, 32, 1.2, 'b'], [-54, 10, .4], [-34, 1, 0], [-16, 0, 0]],
    boxes: [.12, .44, .74], pads: [.3, .62, .93], sky: 0,
  },
  bakery: {
    name: 'Sugar Bridges', blurb: 'Long bridges, a climb and a hairpin',
    pts: [[0, 0, 2], [30, 0, 2], [56, -8, 2, 'b'], [84, -6, 5], [104, 12, 6], [104, 38, 6, 'b'], [80, 48, 4.5], [58, 38, 3.6], [40, 46, 3.2, 'b'],
      [30, 72, 1.6], [6, 86, 1], [-22, 80, 1, 'b'], [-46, 92, 1.6], [-70, 80, 2.4], [-74, 52, 3], [-58, 30, 3, 'b'], [-46, 6, 2.6], [-24, 0, 2]],
    boxes: [.1, .36, .58, .84], pads: [.24, .5, .72, .95], sky: 1,
  },
  peaks: {
    name: 'Twisty Peaks', blurb: 'Tight turns round the mountain islands',
    pts: [[20, 0, 0], [40, 4, .4], [54, 20, 1], [52, 38, 1.4, 'b'], [32, 50, 2.4], [16, 70, 3], [32, 92, 3.4], [58, 96, 3.8, 'b'], [84, 84, 4.2], [92, 58, 4.2],
      [112, 40, 3.6, 'b'], [116, 10, 2.6], [96, -16, 1.8], [64, -30, 1, 'b'], [30, -32, .6], [0, -40, .4], [-30, -34, .2], [-50, -16, 0, 'b'], [-42, 0, 0], [-20, 0, 0], [0, 0, 0]],
    boxes: [.08, .3, .55, .8], pads: [.2, .46, .68, .9], sky: 2,
  },
};
export const TRACK_IDS = Object.keys(TRACKS);

const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
const cache = new Map();

export function buildTrack(id) {
  if (!TRACKS[id]) id = TRACK_IDS[0];
  if (cache.has(id)) return cache.get(id);
  const def = TRACKS[id], P = def.pts.map(p => [p[0] * SCALE, p[1] * SCALE, p[2] * 1.4, p[3]]), m = P.length;
  // dense samples, then resampled evenly by distance
  const dx = [], dz = [], dy = [], db = [], dl = [0];
  for (let k = 0; k < m; k++) {
    const a = P[(k - 1 + m) % m], b = P[k], c = P[(k + 1) % m], d = P[(k + 2) % m];
    for (let j = 0; j < 60; j++) {
      const t = j / 60;
      dx.push(cr(a[0], b[0], c[0], d[0], t)); dz.push(cr(a[1], b[1], c[1], d[1], t)); dy.push(cr(a[2], b[2], c[2], d[2], t)); db.push(b[3] === 'b' ? 1 : 0);
    }
  }
  const N = dx.length;
  for (let i = 1; i <= N; i++) dl.push(dl[i - 1] + Math.hypot(dx[i % N] - dx[i - 1], dz[i % N] - dz[i - 1]));
  const L0 = dl[N], n = Math.round(L0 / STEP), step = L0 / n;
  const x = new Float32Array(n), z = new Float32Array(n), y = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n), br = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const s = i * step; while (dl[j + 1] < s) j++;
    const u = (s - dl[j]) / (dl[j + 1] - dl[j] || 1), j1 = (j + 1) % N;
    x[i] = dx[j] + (dx[j1] - dx[j]) * u; z[i] = dz[j] + (dz[j1] - dz[j]) * u; y[i] = dy[j] + (dy[j1] - dy[j]) * u; br[i] = db[j];
  }
  for (let i = 0; i < n; i++) { const a = (i - 1 + n) % n, b = (i + 1) % n, ex = x[b] - x[a], ez = z[b] - z[a], l = Math.hypot(ex, ez) || 1; tx[i] = ex / l; tz[i] = ez / l; }
  // a bridge never starts or ends right on a corner of land: keep at least 3 samples of land either side of the line
  const T = { id, name: def.name, def, n, step, L: L0, x, z, y, tx, tz, br };
  T.boxes = []; for (const f of def.boxes) { const i = Math.round(f * n) % n; for (const lat of [-3.9, -1.3, 1.3, 3.9]) T.boxes.push(at(T, i, lat)); }
  T.pads = def.pads.map(f => { const i = Math.round(f * n) % n; return { i, len: 5, ...at(T, i, 0) }; });
  T.boxes.forEach((b, k) => { b.k = k; });
  cache.set(id, T);
  return T;
}

// The point `lat` units left of the centreline at sample i (left is +lat).
export function at(T, i, lat = 0) {
  i = ((i % T.n) + T.n) % T.n;
  return { i, x: T.x[i] - T.tz[i] * lat, z: T.z[i] + T.tx[i] * lat, y: T.y[i], h: Math.atan2(T.tx[i], T.tz[i]) };
}
// Heading along the track at sample i (karts face +z at heading 0; forward is (sin h, cos h)).
export const headingAt = (T, i) => Math.atan2(T.tx[i], T.tz[i]);

// Nearest point of the centreline to (x, z). hint: the last known sample, to search only nearby.
export function locate(T, x, z, hint = -1) {
  const n = T.n;
  let best = 0, bd = Infinity;
  if (hint < 0) { for (let i = 0; i < n; i++) { const d = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } }
  else for (let k = -24; k <= 24; k++) { const i = (hint + k + n) % n, d = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  // slide along the segment either side for a smooth distance
  const i = best, j = (i + 1) % n, h = (i - 1 + n) % n;
  let u = ((x - T.x[i]) * (T.x[j] - T.x[i]) + (z - T.z[i]) * (T.z[j] - T.z[i])) / (T.step * T.step);
  let a = i, b = j;
  if (u < 0) { a = h; b = i; u = ((x - T.x[h]) * (T.x[i] - T.x[h]) + (z - T.z[h]) * (T.z[i] - T.z[h])) / (T.step * T.step); }
  u = Math.max(0, Math.min(1, u));
  const cx = T.x[a] + (T.x[b] - T.x[a]) * u, cz = T.z[a] + (T.z[b] - T.z[a]) * u;
  const ex = T.tx[a] + (T.tx[b] - T.tx[a]) * u, ez = T.tz[a] + (T.tz[b] - T.tz[a]) * u;
  const lat = (x - cx) * -ez + (z - cz) * ex; // + is left of the direction of travel
  return { i: best, s: ((a + u) * T.step) % T.L, lat, y: T.y[a] + (T.y[b] - T.y[a]) * u, br: T.br[u < .5 ? a : b] };
}

// ---------- a kart ----------
// k: { x, z, y, h, v, i, s, lat, lap, prog, boost, slow, spin, fall, ghost, drift, dr, charge, grass, bonk }
export function newKart(T, slot) {
  const row = slot >> 1, side = slot % 2 ? -2.7 : 2.7;
  const p = at(T, Math.round((T.L - GRID - row * 5 - (slot % 2) * 1.6) / T.step), side);
  const k = { x: p.x, z: p.z, y: p.y, h: p.h, v: 0, i: p.i, s: p.i * T.step, lat: side, lap: -1, prog: 0, boost: 0, slow: 0, spin: 0, fall: 0, ghost: 0, dr: 0, charge: 0, grass: 0, bonk: 0, mt: 0 };
  k.prog = progOf(T, k);
  return k;
}
export const progOf = (T, k) => k.lap * T.L + k.s;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const angDiff = (a, b) => wrap(a - b);

// One step of driving. inp: { steer -1..1 (+ is left), gas 0/1, brake 0/1, drift 0/1 }. top: speed multiplier for bots.
// Returns notable moments for sounds: 'fall', 'bonk', 'pad', 'mini' (a drift boost), 'respawn'.
export function stepKart(T, k, inp, dt, top = 1) {
  let cue = null;
  k.boost = Math.max(0, k.boost - dt); k.slow = Math.max(0, k.slow - dt); k.ghost = Math.max(0, k.ghost - dt); k.bonk = Math.max(0, k.bonk - dt);
  if (k.fall > 0) { // tumbling off the island: a cloud brings you back to the road
    k.fall -= dt; k.y -= (2 + (1.5 - k.fall) * 14) * dt; k.v *= Math.exp(-1.5 * dt);
    k.x += Math.sin(k.h) * k.v * dt; k.z += Math.cos(k.h) * k.v * dt;
    if (k.fall <= 0) {
      const p = at(T, k.i - 2, 0);
      Object.assign(k, { x: p.x, z: p.z, y: p.y, h: p.h, v: 0, fall: 0, ghost: 1.5, spin: 0, dr: 0, charge: 0, lat: 0, i: p.i, s: p.i * T.step });
      cue = 'respawn';
    }
    return cue;
  }
  const ctl = k.spin <= 0;
  if (k.spin > 0) k.spin = Math.max(0, k.spin - dt);
  const cap = MAX_V * top * (k.grass ? .52 : 1) * (k.slow > 0 ? .6 : 1) * (k.boost > 0 ? 1.4 : 1);
  if (!ctl) k.v *= Math.exp(-2.6 * dt);
  else if (inp.brake) k.v = k.v > 0 ? Math.max(-7, k.v - 34 * dt) : Math.max(-7, k.v - 12 * dt);
  else if (inp.gas || k.boost > 0) { if (k.v < cap) k.v += (cap - k.v) * (k.boost > 0 ? 4 : 1.25) * dt + (k.v < 4 ? 7 * dt : 0); }
  else k.v *= Math.exp(-.9 * dt);
  if (k.v > cap) k.v -= (k.v - cap) * (k.grass ? 3.5 : 1.6) * dt;
  // drifting: hold drift while turning at speed, swing round tighter, let go for a boost
  const steer = ctl ? clamp(inp.steer || 0, -1, 1) : 0;
  if (ctl && inp.drift && !k.dr && k.v > 11 && Math.abs(steer) > .25 && !k.grass) k.dr = Math.sign(steer);
  if (k.dr && (!inp.drift || k.v < 7 || !ctl || k.grass)) {
    if (k.charge > 1.4) { k.boost = Math.max(k.boost, 1.1); cue = 'mini'; } else if (k.charge > .65) { k.boost = Math.max(k.boost, .6); cue = 'mini'; }
    k.dr = 0; k.charge = 0;
  }
  const grip = clamp(Math.abs(k.v) / 5, 0, 1), dir = Math.sign(k.v) || 1, fast = clamp(k.v / MAX_V, 0, 1.4);
  let rate;
  if (k.dr) { rate = (k.dr * .62 + steer * .55) * 2.9; k.charge += dt * (Math.sign(steer) === k.dr ? 1.3 : .7); }
  else rate = steer * 2.25 * (1 - .22 * fast);
  k.h = wrap(k.h + rate * grip * dir * dt);
  // a drifting kart slides a little to the outside
  const slide = k.dr ? -k.dr * k.v * .12 : 0;
  const ox = k.x, oz = k.z;
  k.x += Math.sin(k.h) * k.v * dt + Math.cos(k.h) * slide * dt;
  k.z += Math.cos(k.h) * k.v * dt - Math.sin(k.h) * slide * dt;
  const prevS = k.s, loc = locate(T, k.x, k.z, k.i);
  k.i = loc.i; k.s = loc.s; k.lat = loc.lat; k.y = loc.y;
  const al = Math.abs(loc.lat);
  if (loc.br) { // bridge: the rails stop you
    k.grass = 0;
    if (al > RAIL - KART_R * .6) {
      const want = Math.sign(loc.lat) * (RAIL - KART_R * .6), p = at(T, loc.i, want), dd = Math.hypot(p.x - k.x, p.z - k.z);
      if (dd < 3) { k.x += (p.x - k.x); k.z += (p.z - k.z); } else { k.x = ox; k.z = oz; }
      k.lat = want;
      if (!k.bonk && k.v > 8) { k.v *= .8; cue = 'bonk'; }
      k.bonk = .3;
      const th = headingAt(T, loc.i), side = angDiff(k.h, th);
      if (Math.abs(side) < 1.4) k.h = wrap(k.h - side * .08);
    }
  } else {
    k.grass = al > ROAD + .2 ? 1 : 0;
    if (al > SHOULDER) { k.fall = 1.5; k.dr = 0; k.charge = 0; cue = 'fall'; }
  }
  // boost pads
  for (const p of T.pads) { const d = (k.i - p.i + T.n) % T.n; if (d < p.len && Math.abs(k.lat) < 3.4 && k.boost < .9) { k.boost = 1.2; cue = 'pad'; } }
  // laps: crossing the line (s wraps from the end of the loop back to 0)
  if (prevS > T.L * .75 && k.s < T.L * .25) k.lap++;
  else if (prevS < T.L * .25 && k.s > T.L * .75) k.lap--;
  k.prog = progOf(T, k);
  return cue;
}

// Two karts that overlap push apart. Only the ones marked `move` are moved (a browser only moves its own kart).
export function bump(a, b, moveA = true, moveB = true) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = KART_R * 2;
  if (d >= min || d < 1e-4 || a.fall > 0 || b.fall > 0 || Math.abs(a.y - b.y) > 2) return false;
  const push = (min - d) / (moveA && moveB ? 2 : 1), nx = dx / d, nz = dz / d;
  if (moveA) { a.x -= nx * push; a.z -= nz * push; a.v *= .97; }
  if (moveB) { b.x += nx * push; b.z += nz * push; b.v *= .97; }
  return true;
}

// Driving by itself: what a bot (or your kart after the finish) does. lane: where across the road it likes to be.
export function autoDrive(T, k, { lane = 0, care = 1, avoid = null } = {}) {
  const look = Math.round(5 + Math.max(0, k.v) * .38);
  let want = lane;
  if (avoid != null) want = avoid;
  const p = at(T, k.i + look, want);
  const goal = Math.atan2(p.x - k.x, p.z - k.z), diff = angDiff(goal, k.h);
  // how sharp the road bends a little way ahead: slow down for hairpins
  const a = headingAt(T, k.i + 4), b = headingAt(T, k.i + 4 + Math.round(10 + k.v * .5)), bend = Math.abs(angDiff(b, a));
  const tooFast = k.v > MAX_V * (1.05 - bend * .45 * care);
  return { steer: clamp(diff * 2.4, -1, 1), gas: tooFast ? 0 : 1, brake: tooFast && bend > 1.1 && k.v > 14 ? 1 : 0, drift: 0 };
}

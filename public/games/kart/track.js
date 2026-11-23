import { L } from '../../i18n.js';
// Kart Island Race: the tracks and the kart physics. Shared by the server (bots, laps, items) and the browser
// (your own kart is driven here, then reported to the server), so both sides agree on how a kart moves.
//
// A track is a closed Catmull-Rom loop through control points [x, z, y, kind]. kind 'b' makes the stretch to the
// next point a wooden bridge (rails, no grass); 'n' makes it a narrow cliff road (a slimmer road, no grass, the edge
// right beside it); 'p' a plank walk (narrow wood, no rails, nothing beside it); 'i' ice (the kart slides); 'j' a gap
// to jump (the land before it ends in a ramp); anything else is island land (grass shoulders, then the edge).
// A track may also have hz (things in the way: Pet Farm pets that sit or walk across the road, geysers, a swinging
// hammer) and cuts (thin plank shortcuts off the main road).
// buildTrack() samples it every STEP units: x/z/y, the direction of travel (tx/tz) and whether it is a bridge.

export const STEP = 1;        // sample spacing along the track
export const ROAD = 5.4;      // half width of the road
export const SHOULDER = 9.4;  // on land: grass from ROAD out to here, then you fall off the island
export const NARROW = 3.7;    // half width of a narrow cliff road
export const NARROW_EDGE = 4.7; // ...and where its edge is
export const PLANK = 3.2;     // half width of a plank walk
export const CUT_W = 1.6;     // half width of a shortcut plank
export const JUMP_V = 15;     // slower than this at the end of a ramp and you drop into the gap
export const RAMP = 7, RAMP_H = 1.5; // a ramp: this many samples long, this high
export const SF = { land: 0, bridge: 1, narrow: 2, plank: 3, ice: 4, gap: 6 };
const KIND = { b: 1, n: 2, p: 3, i: 4, j: 6 };
export const RAIL = 6;      // on bridges: rails at this half width
export const KART_R = .95;    // karts bump as circles of this radius
export const GRASS_V = .36;    // on grass the top speed drops to this share of MAX_V
export const MAX_V = 25;      // top speed on the road, units a second
export const GRID = 22;       // the starting grid starts this far behind the line
export const SCALE = 1.65;    // the control points below are multiplied by this (heights by a little less): how roomy the tracks are

// Item boxes sit in rows across the road at these fractions of a lap; pads give a short boost.
export const TRACKS = {
  meadow: {
    name: L('Meadow Loop', 'Łąkowa pętla'), blurb: L('Wide and friendly, with two bridges', 'Szeroka i przyjazna, z dwoma mostami'),
    pts: [[0, 0, 0], [34, -2, 0], [62, 6, 0, 'b'], [86, 22, .8], [96, 48, 1], [88, 74, 1, 'b'], [64, 88, .4], [36, 84, 0], [18, 66, 0], [-4, 62, 0, 'b'],
      [-34, 70, 1.4], [-58, 58, 1.6], [-64, 32, 1.2, 'b'], [-54, 10, .4], [-34, 1, 0], [-16, 0, 0]],
    boxes: [.12, .44, .74], pads: [.3, .62, .93], sky: 0,
  },
  bakery: {
    name: L('Sugar Bridges', 'Cukrowe mosty'), blurb: L('Long bridges, a climb and a hairpin', 'Długie mosty, podjazd i ostry nawrót'),
    pts: [[0, 0, 2], [30, 0, 2], [56, -8, 2, 'b'], [84, -6, 5], [104, 12, 6], [104, 38, 6, 'b'], [80, 48, 4.5], [58, 38, 3.6], [40, 46, 3.2, 'b'],
      [30, 72, 1.6], [6, 86, 1], [-22, 80, 1, 'b'], [-46, 92, 1.6], [-70, 80, 2.4], [-74, 52, 3], [-58, 30, 3, 'b'], [-46, 6, 2.6], [-24, 0, 2]],
    boxes: [.1, .36, .58, .84], pads: [.24, .5, .72, .95], sky: 1,
  },
  peaks: {
    name: L('Twisty Peaks', 'Kręte szczyty'), blurb: L('Tight turns round the mountain islands', 'Ciasne zakręty wokół górskich wysp'),
    pts: [[20, 0, 0], [40, 4, .4], [54, 20, 1], [52, 38, 1.4, 'b'], [32, 50, 2.4], [16, 70, 3], [32, 92, 3.4], [58, 96, 3.8, 'b'], [84, 84, 4.2], [92, 58, 4.2],
      [112, 40, 3.6, 'b'], [116, 10, 2.6], [96, -16, 1.8], [64, -30, 1, 'b'], [30, -32, .6], [0, -40, .4], [-30, -34, .2], [-50, -16, 0, 'b'], [-42, 0, 0], [-20, 0, 0], [0, 0, 0]],
    boxes: [.08, .3, .55, .8], pads: [.2, .46, .68, .9], sky: 2,
  },
  cliff: {
    name: L('Cliffside Hairpins', 'Klifowe nawroty'), blurb: L('Hairpins, a chicane and a narrow cliff road', 'Ostre nawroty, szykana i wąska droga nad urwiskiem'),
    pts: [[0, 0, 0], [30, 0, 0], [52, 0, .4], [62, 3, .8], [64, 10, 1.2], [58, 15, 1.6], [48, 15, 2], [28, 16, 2.6, 'n'], [12, 16, 3], [2, 19, 3.4], [0, 26, 3.8], [6, 31, 4], [16, 31, 4.2],
      [32, 30.4, 4.4], [41, 33.6, 4.4], [50, 30.4, 4.4], [59, 33.6, 4.4], [68, 32, 4.4, 'n'], [80, 36, 4, 'n'], [90, 48, 3.4], [86, 62, 2.8], [76, 66, 2.4], [70, 74, 2, 'b'], [62, 82, 1.6],
      [36, 84, 1.2], [14, 82, .8], [-4, 78, .6], [-18, 72, .4, 'n'], [-24, 58, .2, 'n'], [-24, 40, 0], [-22, 24, 0], [-26, 10, 0], [-18, 1, 0], [-8, 0, 0]],
    boxes: [.1, .4, .7], pads: [.3, .62, .9], sky: 2,
  },
  cove: {
    name: L('Pirate Cove', 'Piracka zatoka'), blurb: L('Plank walks, a jump, pets on the road and a risky shortcut', 'Kładki, skok, zwierzaki na drodze i ryzykowny skrót'), theme: 'beach',
    pts: [[0, 0, 1], [28, 0, 1], [44, 2, 1, 'p'], [66, 8, 1.2, 'p'], [80, 18, 1.4], [88, 32, 1.6], [90, 42, 1.8, 'j'], [90, 52, 1.8], [88, 66, 1.4], [78, 78, 1.2],
      [63, 83, 1], [51, 77, 1], [38, 85, 1], [26, 80, 1], [10, 84, 1], [-6, 93, 1.2, 'p'], [-23, 99, 1.4], [-43, 96, 1.6], [-56, 83, 1.6],
      [-59, 64, 1.4], [-53, 45, 1.2], [-46, 26, 1], [-40, 10, 1], [-28, 2, 1], [-14, 0, 1]],
    boxes: [.12, .45, .78], pads: [.23, .64, .93], sky: 0,
    hz: [{ k: 'pet', sp: 'rocktopus', p: [56, 80], lat: 2.6 }, { k: 'pet', sp: 'coconutkin', p: [44, 81], lat: -2.6 }, { k: 'pet', sp: 'rocktopus', p: [32, 82.5], lat: 2.2 },
      { k: 'pet', sp: 'croissab', p: [-50, 40], amp: 3.4, per: 3.6 }, { k: 'pet', sp: 'croissab', p: [-43, 18], amp: 3.4, per: 3.1, ph: .4 }],
    cuts: [[[13, 79.5, 1], [0, 74, 1.1], [-14, 70, 1.3], [-30, 66, 1.4], [-44, 61, 1.4], [-56, 57, 1.4]]],
  },
  frost: {
    name: L('Frost Fjord', 'Mroźny fiord'), blurb: L('Slippery ice, geysers and a swinging hammer', 'Śliski lód, gejzery i wahadłowy młot'), theme: 'snow',
    pts: [[0, 0, 2], [30, 0, 2], [50, -4, 2.2], [66, -12, 2.4, 'i'], [82, -8, 2.6, 'i'], [92, 6, 2.8], [90, 22, 3], [82, 38, 3.4], [68, 44, 3.8], [48, 44, 4], [32, 45, 4, 'i'],
      [20, 47, 4, 'i'], [14, 53, 4, 'i'], [15, 61, 4, 'i'], [21, 66, 4], [34, 69, 4], [52, 72, 3.4, 'n'], [68, 80, 2.8, 'n'], [74, 94, 2.4], [66, 104, 2], [50, 106, 1.8, 'b'], [30, 104, 1.6],
      [6, 100, 1.4, 'i'], [-14, 92, 1.4, 'i'], [-26, 78, 1.6], [-28, 60, 1.8], [-24, 42, 2], [-30, 26, 2], [-24, 10, 2], [-12, 1, 2]],
    boxes: [.1, .4, .7], pads: [.2, .56, .93], sky: 2,
    hz: [{ k: 'gey', p: [60, 44], lat: 2.4, per: 3.2 }, { k: 'gey', p: [52, 44], lat: -2.4, per: 3.2, ph: .33 }, { k: 'gey', p: [44, 44], lat: 2, per: 3.2, ph: .66 },
      { k: 'pet', sp: 'fluffcoon', p: [60, 76], lat: 1.6 }, { k: 'pet', sp: 'puddlepup', p: [-4, 96], amp: 3.2, per: 4.2 }, { k: 'pet', sp: 'snowfox', p: [-27, 68], amp: 3.4, per: 3.4, ph: .5 },
      { k: 'ham', p: [-27, 50], amp: 4.2, per: 2.6 }],
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
      dx.push(cr(a[0], b[0], c[0], d[0], t)); dz.push(cr(a[1], b[1], c[1], d[1], t)); dy.push(cr(a[2], b[2], c[2], d[2], t)); db.push(KIND[b[3]] || 0);
    }
  }
  const N = dx.length;
  for (let i = 1; i <= N; i++) dl.push(dl[i - 1] + Math.hypot(dx[i % N] - dx[i - 1], dz[i % N] - dz[i - 1]));
  const L0 = dl[N], n = Math.round(L0 / STEP), step = L0 / n;
  const x = new Float32Array(n), z = new Float32Array(n), y = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n), br = new Uint8Array(n), nar = new Uint8Array(n), sf = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const s = i * step; while (dl[j + 1] < s) j++;
    const u = (s - dl[j]) / (dl[j + 1] - dl[j] || 1), j1 = (j + 1) % N;
    x[i] = dx[j] + (dx[j1] - dx[j]) * u; z[i] = dz[j] + (dz[j1] - dz[j]) * u; y[i] = dy[j] + (dy[j1] - dy[j]) * u; sf[i] = db[j]; br[i] = db[j] === 1 ? 1 : 0; nar[i] = db[j] === 2 ? 1 : 0;
  }
  for (let i = 0; i < n; i++) { const a = (i - 1 + n) % n, b = (i + 1) % n, ex = x[b] - x[a], ez = z[b] - z[a], l = Math.hypot(ex, ez) || 1; tx[i] = ex / l; tz[i] = ez / l; }
  // a bridge never starts or ends right on a corner of land: keep at least 3 samples of land either side of the line
  // rw/ew: half width of the road and where the land ends, at every sample. They ease in and out of a narrow stretch.
  const rw = new Float32Array(n), ew = new Float32Array(n), EASE = 9;
  for (let i = 0; i < n; i++) { let a = 0; for (let k = -EASE; k <= EASE; k++) a += nar[(i + k + n) % n]; a /= EASE * 2 + 1; rw[i] = ROAD + (NARROW - ROAD) * a; ew[i] = SHOULDER + (NARROW_EDGE - SHOULDER) * a; }
  // land tapers in towards a plank walk; the planks themselves are exactly as wide as they look
  for (let i = 0; i < n; i++) { if (sf[i] === 3) continue; let d = 99; for (let k = -EASE; k <= EASE; k++) if (sf[(i + k + n) % n] === 3) d = Math.min(d, Math.abs(k)); if (d < 99) { const a = 1 - d / (EASE + 1); ew[i] += (PLANK + 1.2 - ew[i]) * a; rw[i] = Math.min(rw[i], ROAD + (PLANK - ROAD) * a); } }
  for (let i = 0; i < n; i++) if (sf[i] === 3) { rw[i] = PLANK; ew[i] = PLANK + .25; }
  // jumps: lift is how far above the ground a kart rides on the ramp and through the air
  const lift = new Float32Array(n), gaps = [];
  for (let i = 0; i < n; i++) if (sf[i] === 6 && sf[(i - 1 + n) % n] !== 6) { let len = 0; while (sf[(i + len) % n] === 6) len++; gaps.push({ a: i, len }); }
  for (const g of gaps) {
    for (let k = 1; k <= RAMP; k++) lift[(g.a - k + n) % n] = RAMP_H * (RAMP + 1 - k) / RAMP;
    for (let k = 0; k < g.len; k++) { const f = (k + 1) / (g.len + 1); lift[(g.a + k) % n] = RAMP_H * (1 - f) + Math.sin(Math.PI * f) * 1.5; }
  }
  // vlim: the fastest a kart can take each sample without drifting (from how tight the bend is and how much room
  // there is), eased backwards so there is time to brake for it. Bots drive by it.
  const vlim = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(tx[(i + 3) % n], tz[(i + 3) % n]), b = Math.atan2(tx[(i - 3 + n) % n], tz[(i - 3 + n) % n]);
    const r = 6 * step / Math.max(1e-4, Math.abs(wrap(a - b))) + (rw[i] - 1.6) * .8;
    vlim[i] = Math.min(MAX_V * 1.5, 2.25 * r / (1 + .0198 * r)) * (sf[i] === 4 ? .8 : 1);
    if (sf[i] === 3) vlim[i] = Math.min(vlim[i], 21);
  }
  for (let pass = 0; pass < 2; pass++) for (let i = n - 1; i >= 0; i--) vlim[i] = Math.min(vlim[i], Math.sqrt(vlim[(i + 1) % n] ** 2 + 2 * 20 * step));
  const T = { id, name: def.name, def, n, step, L: L0, x, z, y, tx, tz, br, nar, sf, rw, ew, vlim, lift, gaps };
  // shortcuts: a polyline of [x, z, y]; things in the way: placed by a spot on the map, then by how far across the road
  T.cuts = (def.cuts || []).map(c => c.map(p => [p[0] * SCALE, p[1] * SCALE, p[2] * 1.4]));
  T.hz = (def.hz || []).map(h => { const i = locate(T, h.p[0] * SCALE, h.p[1] * SCALE).i; return { amp: 0, per: 4, ph: 0, on: 1.2, lat: 0, r: h.k === 'pet' ? 1.6 : h.k === 'gey' ? 1.7 : 1.5, ...h, i }; });
  T.boxes = []; for (const f of def.boxes) { const i = Math.round(f * n) % n; const w = rw[i] / ROAD; for (const lat of [-3.9, -1.3, 1.3, 3.9]) T.boxes.push(at(T, i, lat * w)); }
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
export const headingAt = (T, i) => { i = ((i % T.n) + T.n) % T.n; return Math.atan2(T.tx[i], T.tz[i]); };

// Nearest point of the centreline to (x, z). hint: the last known sample, to search only nearby.
export function locate(T, x, z, hint = -1) {
  const n = T.n;
  let best = 0, bd = Infinity;
  if (hint < 0) { for (let i = 0; i < n; i++) { const d = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } }
  else {
    for (let k = -24; k <= 24; k++) { const i = (hint + k + n) % n, d = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    if (bd > 196) return locate(T, x, z, -1); // nowhere near where it was (a shortcut, a respawn): look everywhere
  }
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

// Is (x, z) on a shortcut plank? Returns its height there, or null.
export function onCut(T, x, z) {
  for (const c of T.cuts) for (let k = 0; k < c.length - 1; k++) {
    const a = c[k], b = c[k + 1], ex = b[0] - a[0], ez = b[1] - a[1], u = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    if (Math.hypot(x - a[0] - ex * u, z - a[1] - ez * u) < CUT_W) return a[2] + (b[2] - a[2]) * u;
  }
  return null;
}
// Where a thing in the way is, t seconds into the race. Pets and the hammer sway across the road; a geyser stays put
// and is only `up` for a moment of every round.
export function hazardAt(T, h, t) {
  const lat = h.lat + (h.amp ? h.amp * Math.sin((t / h.per + h.ph) * 2 * Math.PI) : 0), p = at(T, h.i, lat);
  const f = ((t / h.per + h.ph) % 1 + 1) % 1;
  p.lat = lat; p.up = h.k !== 'gey' || f < h.on / h.per; p.soon = h.k === 'gey' && f > 1 - .9 / h.per; p.f = f;
  p.dir = h.amp ? Math.sign(Math.cos((t / h.per + h.ph) * 2 * Math.PI)) : 0;
  return p;
}

// ---------- a kart ----------
// k: { x, z, y, h, v, i, s, lat, lap, prog, boost, slow, spin, fall, ghost, drift, dr, charge, grass, bonk }
export function newKart(T, slot) {
  const row = slot >> 1, side = slot % 2 ? -2.7 : 2.7;
  const p = at(T, Math.round((T.L - GRID - row * 5 - (slot % 2) * 1.6) / T.step), side);
  const k = { x: p.x, z: p.z, y: p.y, h: p.h, v: 0, i: p.i, s: p.i * T.step, lat: side, lap: -1, prog: 0, boost: 0, slow: 0, spin: 0, fall: 0, ghost: 0, dr: 0, charge: 0, grass: 0, bonk: 0, mt: 0, slip: 0, air: 0, cut: 0, safe: p.i };
  k.prog = progOf(T, k);
  return k;
}
export const progOf = (T, k) => k.lap * T.L + k.s;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const angDiff = (a, b) => wrap(a - b);

// A held drift charges through three levels (blue, orange, pink sparks); letting go boosts for longer the higher it got.
export const DRIFT_AT = [0, .65, 1.4, 2.3], DRIFT_BOOST = [0, .6, 1.1, 1.8];
export const driftLevel = c => c > DRIFT_AT[3] ? 3 : c > DRIFT_AT[2] ? 2 : c > DRIFT_AT[1] ? 1 : 0;
// The drift bits of a kart's flags: 1024 level one, 512 level two, both together level three.
export const driftFlags = c => [0, 1024, 512, 1536][driftLevel(c)];

// One step of driving. inp: { steer -1..1 (+ is left), gas 0/1, brake 0/1, drift 0/1 }. top: speed multiplier for bots.
// Returns notable moments for sounds: 'fall', 'bonk', 'pad', 'mini' (a drift boost), 'respawn'.
export function stepKart(T, k, inp, dt, top = 1, t = null) {
  let cue = null;
  k.boost = Math.max(0, k.boost - dt); k.slow = Math.max(0, k.slow - dt); k.ghost = Math.max(0, k.ghost - dt); k.bonk = Math.max(0, k.bonk - dt);
  if (k.fall > 0) { // tumbling off the island: a cloud brings you back to the road
    k.fall -= dt; k.y -= (2 + (1.5 - k.fall) * 14) * dt; k.v *= Math.exp(-1.5 * dt);
    k.x += Math.sin(k.h) * k.v * dt; k.z += Math.cos(k.h) * k.v * dt;
    if (k.fall <= 0) {
      // back on the road a little before where it went wrong, with a run-up if that was a jump
      let ri = ((k.safe ?? k.i) - 2 + T.n) % T.n;
      for (const g of T.gaps) { const d = (g.a + g.len - ri + T.n) % T.n; if (d < g.len + 28) ri = (g.a - 28 + T.n) % T.n; }
      const p = at(T, ri, 0); k.slip = 0; k.air = 0; k.cut = 0;
      Object.assign(k, { x: p.x, z: p.z, y: p.y, h: p.h, v: 0, fall: 0, ghost: 1.5, spin: 0, dr: 0, charge: 0, lat: 0, i: p.i, s: p.i * T.step });
      cue = 'respawn';
    }
    return cue;
  }
  const ctl = k.spin <= 0;
  if (k.spin > 0) k.spin = Math.max(0, k.spin - dt);
  const cap = MAX_V * top * (k.grass ? GRASS_V : 1) * (k.slow > 0 ? .6 : 1) * (k.boost > 0 ? 1.4 : 1);
  if (!ctl) k.v *= Math.exp(-2.6 * dt);
  else if (inp.brake) k.v = k.v > 0 ? Math.max(-7, k.v - 34 * dt) : Math.max(-7, k.v - 12 * dt);
  else if (inp.gas || k.boost > 0) { if (k.v < cap) k.v += (cap - k.v) * (k.boost > 0 ? 4 : 1.25) * dt + (k.v < 4 ? 7 * dt : 0); }
  else k.v *= Math.exp(-.9 * dt);
  if (k.v > cap) k.v -= (k.v - cap) * (k.grass ? 6 : 1.6) * dt;
  // drifting: hold drift while turning at speed, swing round tighter, let go for a boost
  const steer = ctl ? clamp(inp.steer || 0, -1, 1) : 0;
  if (ctl && inp.drift && !k.dr && k.v > 11 && Math.abs(steer) > .25 && !k.grass) k.dr = Math.sign(steer);
  if (k.dr && (!inp.drift || k.v < 7 || !ctl || k.grass)) {
    const lv = driftLevel(k.charge); if (lv) { k.boost = Math.max(k.boost, DRIFT_BOOST[lv]); cue = 'mini'; }
    k.dr = 0; k.charge = 0;
  }
  const grip = clamp(Math.abs(k.v) / 5, 0, 1), dir = Math.sign(k.v) || 1, fast = clamp(k.v / MAX_V, 0, 1.4);
  let rate;
  if (k.dr) { rate = (k.dr * .62 + steer * .55) * 2.9; k.charge += dt * (Math.sign(steer) === k.dr ? 1.3 : .7); }
  else rate = steer * 2.25 * (1 - .22 * fast);
  k.h = wrap(k.h + rate * grip * dir * dt);
  // ice: the kart keeps sliding the way it was going and only slowly comes round to where it points
  const icy = T.sf[k.i] === 4 && !k.air;
  k.slip = clamp(((k.slip || 0) + (icy ? rate * grip * dir * dt * .8 : 0)) * Math.exp(-(icy ? 1.5 : 9) * dt), -1.1, 1.1);
  const mh = k.h - k.slip;
  // a drifting kart slides a little to the outside
  const slide = k.dr ? -k.dr * k.v * .12 : 0;
  const ox = k.x, oz = k.z;
  k.x += Math.sin(mh) * k.v * dt + Math.cos(k.h) * slide * dt;
  k.z += Math.cos(mh) * k.v * dt - Math.sin(k.h) * slide * dt;
  const prevS = k.s, loc = locate(T, k.x, k.z, k.i);
  k.i = loc.i; k.s = loc.s; k.lat = loc.lat; k.y = loc.y + T.lift[loc.i];
  const sfc = T.sf[loc.i];
  const al = Math.abs(loc.lat);
  const cutY = T.cuts.length && al > (loc.br ? RAIL : T.ew[loc.i]) ? onCut(T, k.x, k.z) : null;
  if (cutY != null) { k.cut = 1; k.grass = 0; k.y = cutY; if (k.air) k.air = 0; } // on a shortcut plank
  else if (loc.br) { // bridge: the rails stop you
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
  } else if (sfc === 6) { // a gap: fast and straight off the ramp flies over, anything else drops in
    k.grass = 0;
    if (!k.air) { if (k.v >= JUMP_V && al < T.rw[loc.i]) { k.air = 1; cue = 'jump'; } else { k.fall = 1.5; k.dr = 0; k.charge = 0; cue = 'fall'; } }
  } else {
    if (k.air) { k.air = 0; cue = 'land'; }
    k.grass = al > T.rw[loc.i] + .2 ? 1 : 0; k.cut = 0;
    if (k.grass && T.cuts.length && onCut(T, k.x, k.z) != null) k.grass = 0; // the shortcut's planks run over the shoulder
    if (al > T.ew[loc.i]) { k.fall = 1.5; k.dr = 0; k.charge = 0; cue = 'fall'; }
  }
  if (!k.cut && !k.air && sfc !== 6 && !k.fall) k.safe = loc.i;
  // things in the way: bump into one and you spin
  if (t != null && k.fall <= 0 && k.ghost <= 0 && k.spin <= 0) for (const h of T.hz) {
    const d = (h.i - k.i + T.n) % T.n; if (d > 5 && d < T.n - 5) continue;
    const p = hazardAt(T, h, t); if (!p.up) continue;
    if (Math.hypot(p.x - k.x, p.z - k.z) < h.r + KART_R * .7) { k.spin = 1.1; k.v *= .35; k.dr = 0; k.charge = 0; k.ghost = 2.2; cue = 'bonk-' + h.k; break; }
  }
  // boost pads
  for (const p of T.pads) { const d = (k.i - p.i + T.n) % T.n; if (d < p.len && Math.abs(k.lat) < Math.min(3.4, T.rw[p.i] - .6) && k.boost < .9) { k.boost = 1.2; cue = 'pad'; } }
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
export function autoDrive(T, k, { lane = 0, care = 1, avoid = null, t = null } = {}) {
  const look = Math.round(5 + Math.max(0, k.v) * .38), n = T.n;
  let want = avoid != null ? avoid : lane;
  // stay on the road where it narrows, and cut to the inside of a tight bend
  const j = (k.i + look) % n, room = T.rw[j] - 1.5;
  const bendAt = (k.i + Math.round(look * .6)) % n, turn = angDiff(headingAt(T, bendAt + 4), headingAt(T, bendAt - 4));
  if (Math.abs(turn) > .5 && avoid == null) want = -Math.sign(turn) * Math.min(room, 2.6) * Math.min(1, (Math.abs(turn) - .5) * 2) + want * .3;
  // steer round the pets, geysers and hammers a little way ahead
  if (t != null) for (const h of T.hz) {
    const d = (h.i - k.i + n) % n; if (d < 2 || d > 24) continue;
    const p = hazardAt(T, h, t + d / Math.max(8, k.v)); if (!p.up && !p.soon && h.k === 'gey') continue;
    if (Math.abs(p.lat - want) < h.r + 1.5) want = p.lat > 0 || (p.lat === 0 && want < 0) ? p.lat - h.r - 1.6 : p.lat + h.r + 1.6;
  }
  want = clamp(want, -room, room);
  const p = at(T, k.i + look, want);
  const goal = Math.atan2(p.x - k.x, p.z - k.z), diff = angDiff(goal, k.h);
  // slow down in time for what is coming: the track knows how fast each bit can be taken
  const lim = T.vlim[(k.i + 2) % n] / (.94 + .06 * care) , over = k.v - lim;
  return { steer: clamp(diff * 2.4, -1, 1), gas: over > 0 ? 0 : 1, brake: over > 1.5 ? 1 : 0, drift: 0 };
}

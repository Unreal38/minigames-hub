// Marble Rush track: built from a seed, shared by the server (physics) and the client (3D).
// The track is a ribbon. Marbles live in track space: s = distance along it, u = sideways (+ is left).
export const R = .42;        // marble radius
export const DS = .25;       // sample spacing along the track
export const WALL_H = .8;
export const DISH = .045;    // floor is slightly dished: height = DISH * u^2
export const GATE_S = 4.2;   // start gate

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function makeTrack(seed, short = false) {
  const r = rng(seed), between = (a, b) => a + r() * (b - a);
  const pieces = [];
  const add = (len, o = {}) => { pieces.push({ len, turn: o.turn || 0, slope: o.slope ?? .12, feat: o.feat || null }); return len; };
  let total = add(9, { slope: .04 }) + add(6, { slope: .24 });
  const target = short ? 105 : 215;
  const kinds = ['turn', 'turn', 'turn', 'drop', 'pins', 'spinner', 'trap', 'boost', 'narrow', 'straight'];
  let heading = 0, last = '', feats = 0;
  while (total < target) {
    let k = kinds[r() * kinds.length | 0];
    if (k === last) k = 'turn';
    last = k;
    if (k === 'turn') {
      const side = heading > .3 ? -1 : heading < -.3 ? 1 : (r() < .5 ? -1 : 1);
      const to = side * between(.55, 1.2), d = to - heading;
      total += add(Math.max(5, Math.abs(d) * between(5.5, 8)), { turn: d, slope: between(.09, .16) });
      heading = to;
    } else if (k === 'drop') total += add(between(6, 9), { slope: between(.32, .44) });
    else if (k === 'pins') { total += add(15, { slope: .3, feat: k }); feats++; }
    else if (k === 'spinner') { total += add(10, { slope: .12, feat: k }); feats++; }
    else if (k === 'trap') { total += add(11, { slope: .12, feat: k }); feats++; }
    else if (k === 'boost') { total += add(7, { slope: .09, feat: k }); feats++; }
    else if (k === 'narrow') { total += add(12, { slope: .17, feat: k }); feats++; }
    else total += add(between(6, 10), { slope: between(.1, .18) });
  }
  if (feats < 3) { total += add(15, { slope: .3, feat: 'pins' }); total += add(10, { slope: .12, feat: 'spinner' }); }
  if (Math.abs(heading) > .05) total += add(Math.max(5, Math.abs(heading) * 6.5), { turn: -heading, slope: .12 });
  total += add(9, { slope: .14 });
  const finish = total - 1;
  total += add(15, { slope: .015 });

  const n = Math.ceil(total / DS) + 1;
  const T = {
    seed, short, n, L: finish, end: total - .6,
    x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), h: new Float32Array(n),
    w: new Float32Array(n), sl: new Float32Array(n), k: new Float32Array(n),
    pins: [], spinners: [], traps: [], boosts: [],
  };
  const rawS = new Float32Array(n), rawK = new Float32Array(n);
  let pi = 0, p0 = 0;
  for (let i = 0; i < n; i++) {
    const s = i * DS;
    while (pi < pieces.length - 1 && s >= p0 + pieces[pi].len) p0 += pieces[pi++].len;
    const p = pieces[pi], f = Math.min(1, (s - p0) / p.len);
    rawS[i] = p.slope; rawK[i] = p.turn / p.len;
    T.w[i] = p.feat === 'narrow' ? 5 - 2.5 * Math.sin(Math.PI * f) ** 2 : 5;
  }
  // soften the joints between pieces
  const smooth = (src, dst, win) => {
    for (let i = 0; i < n; i++) {
      let a = 0, c = 0;
      for (let j = Math.max(0, i - win); j <= Math.min(n - 1, i + win); j++) { a += src[j]; c++; }
      dst[i] = a / c;
    }
  };
  smooth(rawS, T.sl, 7); smooth(rawK, T.k, 5);
  for (let i = 1; i < n; i++) {
    T.h[i] = T.h[i - 1] + T.k[i - 1] * DS;
    const c = 1 / Math.hypot(1, T.sl[i - 1]);
    T.x[i] = T.x[i - 1] + Math.sin(T.h[i - 1]) * DS * c;
    T.z[i] = T.z[i - 1] + Math.cos(T.h[i - 1]) * DS * c;
    T.y[i] = T.y[i - 1] - T.sl[i - 1] * DS * c;
  }
  // obstacles
  p0 = 0;
  for (const p of pieces) {
    if (p.feat === 'pins') {
      for (let row = 0; row < 7; row++) {
        const us = row % 2 ? [0] : [-1.3, 1.3];
        for (const u of us) T.pins.push({ s: p0 + 2.2 + row * 1.8, u: u + between(-.12, .12), r: .24 });
      }
    } else if (p.feat === 'spinner') {
      T.spinners.push({ s: p0 + 5, u: 0, hl: 1.7, w: (r() < .5 ? -1 : 1) * between(1.5, 2.3), ph: between(0, 6.28) });
    } else if (p.feat === 'trap') {
      const side = r() * 3 | 0;
      T.traps.push({ s0: p0 + 4, s1: p0 + 6.6, u0: [-2.5, -1.25, 0][side], u1: [0, 1.25, 2.5][side], per: between(2.4, 3.2), open: .3, ph: between(0, 3), back: p0 + .8 });
    } else if (p.feat === 'boost') {
      T.boosts.push({ s0: p0 + 2, s1: p0 + 5 });
    }
    p0 += p.len;
  }
  return T;
}

// linear sample of one of the track's arrays at distance s
export function at(arr, s) {
  const f = Math.max(0, Math.min(arr.length - 1.001, s / DS)), i = f | 0, t = f - i;
  return arr[i] + (arr[i + 1] - arr[i]) * t;
}
export const spinAngle = (sp, t) => sp.ph + sp.w * t;
export const trapOpen = (tr, t) => ((t + tr.ph) % tr.per) / tr.per < tr.open;

// track space -> world. Returns [x, y, z] of a point `lift` above the floor.
export function world(T, s, u, lift = 0, out = [0, 0, 0]) {
  const h = at(T.h, s);
  out[0] = at(T.x, s) + Math.cos(h) * u;
  out[1] = at(T.y, s) + DISH * u * u + lift;
  out[2] = at(T.z, s) - Math.sin(h) * u;
  return out;
}

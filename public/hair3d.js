// Hair for the 3D chibi avatar (avatar3d.js). Each style is sculpted as ONE closed piece that grows out of the scalp:
// a cap of locks running from a whorl (the "pole") down to the hairline, with the fringe cut into the edge of the cap
// itself, plus at most a tail, a bun or braids that grow out of it. Nothing is an open sheet, so no view shows the
// dark inside of the outline, and nothing hangs low enough at the sides to cut through the shoulders.
//
// Everything is in head space: chin at y = 0, crown at y = 1, the face looks along +z. `az` is the angle round the
// head from the front (0 = fringe, PI = nape).
//
//   hairParts(style, face, hr, tilt, up) -> [{ geo, c }]   geo carries a per-vertex `tone` (0 light, 1 mid, 2 dark, 3 shine) that
//                                                       merge() in avatar3d.js turns into colour; c 'tie' is a hair tie.
import * as THREE from 'three';

const PI = Math.PI;
export const HC = new THREE.Vector3(0, .47, 0); // roughly the middle of the skull
// How far from HC along the unit direction d you can go and still be inside the skull grown sideways by o, closed
// over the crown by a low cone.
export const envT = (hr, d, o) => { let lo = 0, hi = 1.4; for (let i = 0; i < 18; i++) { const t = (lo + hi) / 2, y = HC.y + d.y * t, r = Math.hypot(d.x * t, d.z * t); if (y >= 0 && (y <= 1 ? r <= hr(y) + o : r <= o - (y - 1))) lo = t; else hi = t; } return lo; };

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the same for hair, but with the thickness also added upwards over the crown, so the top is a dome and not a point
const envH = (hr, d, o) => { let lo = 0, hi = 1.6; for (let i = 0; i < 18; i++) { const t = (lo + hi) / 2, y = HC.y + d.y * t, r = Math.hypot(d.x * t, d.z * t); if (y >= 0 && y <= 1 + o && r <= hr(Math.min(1, y - o * sm(.55, 1, y))) + o) lo = t; else hi = t; } return lo; };
// an eased curve through [angle, value] knots, mirrored left and right
const pw = k => a => { a = Math.abs(a); for (let i = 1; i < k.length; i++) if (a <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * sm(k[i - 1][0], k[i][0], a); return k[k.length - 1][1]; };
// the usual hairline: fringe height f across the face, s over the ears, b at the nape
const L = (f, s, b) => pw([[0, f], [1.02, f], [1.3, s], [2.0, s], [2.5, b], [PI, b]]);
// how far the points of the locks reach below the hairline: long across the fringe, short round the back
const F = (front, back = .03) => az => front * (1 - sm(.9, 1.2, Math.abs(az))) + back * sm(1.15, 1.5, Math.abs(az));

const finish = (pos, idx, tn, soft, tuck, edge) => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('tone', new THREE.Float32BufferAttribute(tn, 1)); g.setIndex(idx); g.computeVertexNormals();
  if (soft) { // no crease between the locks: points that share a place share a normal
    const nr = g.attributes.normal.array, by = new Map();
    for (let i = 0; i < pos.length; i += 3) { const k = Math.round(pos[i] * 500) + ',' + Math.round(pos[i + 1] * 500) + ',' + Math.round(pos[i + 2] * 500); let e = by.get(k); if (!e) by.set(k, e = [0, 0, 0, []]); e[0] += nr[i]; e[1] += nr[i + 1]; e[2] += nr[i + 2]; e[3].push(i); }
    for (const e of by.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; for (const i of e[3]) { nr[i] = e[0] / l; nr[i + 1] = e[1] / l; nr[i + 2] = e[2] / l; } }
  }
  // the underside of an edge sits against the skin: its normals point into the head so its outline stays hidden
  // and the rim itself keeps the normal of the hair just above it, so the outline starts right at the rim
  if (edge) { const nr = g.attributes.normal.array; for (let j = 0; j < edge.length; j += 2) for (let k = 0; k < 3; k++) nr[edge[j] * 3 + k] = nr[edge[j + 1] * 3 + k]; }
  if (tuck) { const nr = g.attributes.normal.array; for (let j = 0; j < tuck.length; j += 4) nr.set([tuck[j + 1], tuck[j + 2], tuck[j + 3]], tuck[j] * 3); }
  return g;
};

// The cap. S:
//   n, cols      locks round the whorl, and strips per lock
//   pole         [back, side] tilt of the whorl away from the crown (radians); the locks all run out from it
//   line(az)     hairline height;  tip(az) how far a lock's point hangs below it;  u0 where across the lock the point is
//   round        scalloped lock ends instead of points
//   off(az, y)   thickness over the skull;  shape(d) the whole outer surface instead (distance from HC)
//   groove       how deep the cuts between locks go (share of the thickness)
//   bump(i, c, j, az, y)  extra height at lock i, strip c, ring j (of `rows`): spikes and curls
//   yJ           below this height the hair stops hugging the skull and hangs (a curtain with its own inner side)
//   hang(u, az, i)  radius of the curtain on its way down (u 0..1), as a multiple;  thick its thickness
//   shine        how far down the locks the band of light sits (0 for none)
//   tone(i)      shade of lock i;  soft: no creases between locks;  tilt: lean of a seated head, taken back out of the curtain
function cap(hr, S) {
  const { n = 16, cols = 4, pole = [0, 0], ph = .5, line, tip = () => 0, u0 = .5, round = false, off = () => .065, shape, groove = .22, bump, rows = 9, yJ = -9, drop = 1,
    hang = u => 1 - .1 * u * u, thick = .1, tone = i => i % 2, soft = false, tilt = 0, sweep, shine = .36 } = S;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pole[0], 0, -pole[1])), d = new THREE.Vector3(), P = new THREE.Vector3();
  const pos = [], tn = [], idx = [], tuck = [], edge = [], R = rows + 2 * drop + 2; // points per strip edge: cap rings, curtain out, curtain in, tuck
  // the point on the outer surface at angle th round the whorl and al away from it (g: 0..1, how much of the groove)
  const at = (th, al, g) => {
    d.set(Math.sin(al) * Math.sin(th), Math.cos(al), Math.sin(al) * Math.cos(th)).applyQuaternion(q);
    const T0 = envT(hr, d, 0), y0 = HC.y + d.y * T0, az = Math.atan2(d.x, d.z);
    const T = shape ? Math.max(shape(d), envH(hr, d, .03)) : envH(hr, d, off(az, y0) * (1 - groove * g * Math.min(1, al / .5)));
    P.copy(HC).addScaledVector(d, T); return { az, T };
  };
  for (let i = 0; i < n; i++) for (let c = 0; c <= cols; c++) {
    const u = c / cols, th0 = -PI + (i + ph + u) / n * 2 * PI, g = c === 0 || c === cols ? 1 : 0, sw = al => th0 + (sweep ? sweep(al) : 0);
    const k = u < u0 ? u / u0 : (1 - u) / (1 - u0), pt = round ? Math.sqrt(Math.max(0, k)) : k;
    // walk away from the whorl until the hairline (or the level where the hair starts to hang)
    const below = al => { const { az } = at(sw(al), al, g); return P.y - Math.max(line(az) - tip(az) * pt, yJ); };
    let a0 = .05, a1 = .05; while (a1 < 3.1 && below(a1) > 0) { a0 = a1; a1 += .05; }
    for (let b = 0; b < 14; b++) { const m = (a0 + a1) / 2; if (below(m) > 0) a0 = m; else a1 = m; }
    const base = pos.length / 3, tc = tone(i), push = (x, y, z, t) => { pos.push(x, y, z); tn.push(t); };
    let az = 0, T = 0;
    for (let j = 0; j <= rows; j++) {
      const al = a0 * j / rows; ({ az, T } = at(sw(al), al, g));
      if (bump) P.addScaledVector(d, bump(i, c, j, az, P.y));
      push(P.x, P.y, P.z, shine && g === 0 && j === Math.round(rows * shine) ? 3 : tc);
    }
    const ex = P.x, ey = P.y, ez = P.z, end = line(az) - tip(az) * pt, Rj = Math.hypot(ex, ez), a2 = Math.atan2(ex, ez);
    if (end < ey - .01) { // a curtain: straight down from here, then back up its inner side
      const ring = []; for (let r = 1; r <= drop; r++) { const uu = r / drop, y = ey + (end - ey) * uu; ring.push([Rj * hang(uu, a2, i, k), y]); }
      for (const [rr, y] of ring) push(Math.sin(a2) * rr, y, Math.cos(a2) * rr, tc);
      for (let r = drop - 1; r >= 0; r--) { const [rr, y] = ring[r]; push(Math.sin(a2) * (rr - thick), y, Math.cos(a2) * (rr - thick), 2); }
      edge.push(base + rows + drop, base + rows + drop - 1);
      const ri = Math.min(Rj - thick, hr(Math.max(ey, .02)) - .03); push(Math.sin(a2) * ri, ey, Math.cos(a2) * ri, 2);
    } else { // the edge of the cap: its underside tucks into the skull
      for (let r = 0; r <= drop; r++) edge.push(base + rows + r, base + rows - 1);
      for (let r = 0; r < drop; r++) push(ex, ey, ez, tc);
      const Ti = Math.max(0, envT(hr, d, 0) - .03); P.copy(HC).addScaledVector(d, Ti);
      for (let r = 0; r <= drop; r++) { tuck.push(pos.length / 3, -d.x, -d.y, -d.z); push(P.x, P.y, P.z, 2); }
    }
    if (c < cols) for (let j = 0; j < R - 1; j++) { const p = base + j, o = base + R + j; idx.push(p, p + 1, o, o, p + 1, o + 1); }
  }
  if (tilt) for (let i = 0; i < pos.length; i += 3) { const y = pos[i + 1]; if (y >= .2) continue; const a = tilt * sm(.2, -.3, y), z = pos[i + 2]; pos[i + 1] = y * Math.cos(a) - z * Math.sin(a); pos[i + 2] = y * Math.sin(a) + z * Math.cos(a); }
  return finish(pos, idx, tn, soft, tuck, edge);
}

// A tail, a braid or a bun: a closed tube through path points [x, y, z, radius]. ridge flutes it into strands,
// twist winds the strands round it, flat squeezes it front to back.
function tube(path, { sides = 8, ridge = .12, twist = 0, flat = 1, ref = [0, 0, 1], tone = i => 0 } = {}) {
  const pos = [], tn = [], idx = [], n = path.length, t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), rf = new THREE.Vector3(...ref), v = p => new THREE.Vector3(p[0], p[1], p[2]);
  for (let i = 0; i < n; i++) {
    t.subVectors(v(path[Math.min(n - 1, i + 1)]), v(path[Math.max(0, i - 1)])).normalize();
    a.copy(rf).addScaledVector(t, -rf.dot(t)).normalize(); b.crossVectors(t, a);
    for (let k = 0; k < sides; k++) { const an = k / sides * 2 * PI + twist * i, r = path[i][3] * (1 - ridge * (k % 2)); pos.push(path[i][0] + (a.x * Math.cos(an) * flat + b.x * Math.sin(an)) * r, path[i][1] + (a.y * Math.cos(an) * flat + b.y * Math.sin(an)) * r, path[i][2] + (a.z * Math.cos(an) * flat + b.z * Math.sin(an)) * r); tn.push(tone(i, k)); }
    if (i < n - 1) for (let k = 0; k < sides; k++) { const p = i * sides + k, o = i * sides + (k + 1) % sides; idx.push(p, p + sides, o, o, p + sides, o + sides); }
  }
  const c0 = pos.length / 3; pos.push(path[0][0], path[0][1], path[0][2], path[n - 1][0], path[n - 1][1], path[n - 1][2]); tn.push(tone(0, 0), tone(n - 1, 0));
  for (let k = 0; k < sides; k++) { idx.push(c0, k, (k + 1) % sides); idx.push(c0 + 1, (n - 1) * sides + (k + 1) % sides, (n - 1) * sides + k); }
  const g = finish(pos, idx, tn, false);
  // make sure it faces outwards whichever way the path runs
  const p = g.attributes.position, nr = g.attributes.normal, m = Math.floor(n / 2) * sides;
  if ((p.getX(m) - path[m / sides][0]) * nr.getX(m) + (p.getY(m) - path[m / sides][1]) * nr.getY(m) + (p.getZ(m) - path[m / sides][2]) * nr.getZ(m) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const s = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = s; } g.computeVertexNormals(); }
  return g;
}
// a smooth curve through a few [x, y, z, r] points, as m path points
const curve = (pts, m) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), out = []; for (let i = 0; i <= m; i++) { const u = i / m, p = c.getPoint(u), f = u * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)); out.push([p.x, p.y, p.z, pts[k][3] + (pts[k + 1][3] - pts[k][3]) * (f - k)]); } return out; };
const band = (x, y, z, r, ax) => { const g = new THREE.TorusGeometry(r, .034, 6, 12); if (ax === 'x') g.rotateY(PI / 2); else if (ax === 'y') g.rotateX(PI / 2); else if (ax) g.rotateX(ax); g.translate(x, y, z); return g; };

// The crest of a mohawk: a saw-toothed fin along the middle of the head, from f0 in front of the crown to f1 behind it.
function fin(hr, f0, f1, teeth, w, h) {
  const pos = [], tn = [], idx = [], d = new THREE.Vector3(), m = teeth * 2;
  for (let i = 0; i <= m; i++) {
    const u = i / m, f = f0 + (f1 - f0) * u, pk = i % 2, hh = (pk ? h * (.75 + .25 * Math.sin(u * PI)) : h * .42) * Math.min(1, Math.sin(u * PI) * 3 + .25);
    d.set(0, Math.cos(f), -Math.sin(f)); const T = envT(hr, d, 0), lean = pk ? .1 : 0, tt = Math.floor((i + 1) / 2) % 2;
    for (const s of [-1, 1]) { pos.push(s * w, HC.y + d.y * (T - .04), d.z * (T - .04)); tn.push(tt); }
    pos.push(0, HC.y + Math.cos(f + lean) * (T + hh), -Math.sin(f + lean) * (T + hh)); tn.push(tt);
    if (i < m) { const p = i * 3; idx.push(p, p + 2, p + 3, p + 2, p + 5, p + 3, p + 1, p + 4, p + 2, p + 4, p + 5, p + 2); }
  }
  idx.push(0, 1, 2, m * 3, m * 3 + 2, m * 3 + 1);
  return finish(pos, idx, tn, false);
}

const made = new Map();
// up: something is worn on the back, so long hair stops at the shoulders instead of hanging through it
export function hairParts(style, face, hr, tilt = 0, up = false) {
  const long = style === 4 || style === 15, key = [style, face, long ? tilt : 0, long && up].join();
  let out = made.get(key); if (out) return out;
  out = []; made.set(key, out);
  const add = (geo, c) => out.push({ geo, c }), tie = geo => add(geo, 'tie');
  const skull = (x, y, z, o) => { const d = new THREE.Vector3(x, y - HC.y, z).normalize(), T = envT(hr, d, o); return [d.x * T, HC.y + d.y * T, d.z * T]; };
  if (style === 0) { // bun: pulled up and back to a knot
    add(cap(hr, { n: 16, pole: [.42, 0], line: L(.76, .47, .45), tip: F(.2, .02), rows: 10 }));
    const [x, y, z] = skull(0, .47 + Math.cos(.42), -Math.sin(.42), .14), b = []; for (let i = 0; i <= 8; i++) { const u = i / 8; b.push([x, y - .13 + u * .31, z - .04 * (u - .5), .25 * Math.pow(Math.sin(.3 + u * 2.7), .7)]); }
    add(tube(b, { sides: 10, ridge: .1, twist: .5, tone: (i, k) => k % 2 })); tie(band(x, y - .13, z + .01, .13, 'y'));
  }
  if (style === 1) add(cap(hr, { n: 14, pole: [.55, .3], line: L(.75, .5, .46), tip: F(.2, .07), u0: .78, off: (az, y) => .065 + .03 * sm(.6, .95, y), rows: 10 })); // short: swept from a whorl
  if (style === 2) { // pigtails
    add(cap(hr, { n: 16, line: L(.76, .47, .43), tip: F(.24, .03) }));
    for (const s of [-1, 1]) { const [x, y, z] = skull(s * .5, .8, -.1, .03);
      add(tube(curve([[x, y, z, .09], [x + s * .13, y - .08, z - .01, .17], [x + s * .2, y - .36, z - .01, .15], [x + s * .17, y - .62, z, .08], [x + s * .13, y - .76, z + .01, .012]], 10), { ridge: .14, twist: .22, tone: (i, k) => k % 2 }));
      tie(band(x + s * .05, y - .02, z, .1, s * .5 + PI / 2 * 0 + 1.2)); }
  }
  if (style === 3) add(cap(hr, { n: 14, cols: 2, line: L(.77, .5, .46), tip: F(.3, .1), rows: 8, groove: .1, // spiky: every lock ends in a point
    bump: (i, c, j, az, y) => c === 1 && j >= 2 && j < 8 && (i + j) % 2 === 0 ? .23 - j * .012 : c === 1 && j >= 2 && j < 8 ? .03 : 0 }));
  if (style === 4) add(cap(hr, { n: 18, line: pw([[0, .74], [1.02, .74], [1.28, .04], [1.9, .04], [2.42, up ? -.03 : -.5], [PI, up ? -.05 : -.54]]), tip: az => Math.abs(az) < 1.2 ? F(.3)(az) : .07, // long: down the back, clear of the shoulders
    off: () => .07, yJ: .26, drop: 6, thick: .1, hang: u => 1.01 - .06 * u * u, tilt: tilt + .14 })); // leans a little off the back, so a nod never pushes it into the body
  if (style === 6) add(cap(hr, { n: 18, line: pw([[0, .74], [1.02, .74], [1.26, .1], [PI, .07]]), tip: az => Math.abs(az) < 1.2 ? F(.28)(az) : .035, off: (az, y) => .085 + .02 * sm(.4, .12, y), rows: 11 })); // bob: curls in under the chin line
  if (style === 7) { // ponytail: everything runs back to the tie
    add(cap(hr, { n: 14, pole: [1.05, 0], line: L(.76, .47, .43), tip: F(.22, .02), rows: 11 }));
    const [x, y, z] = skull(0, .47 + Math.cos(1.05), -Math.sin(1.05), .05);
    add(tube(curve([[0, y, z, .09], [0, y + .04, z - .17, .16], [0, y - .2, z - .32, .18], [0, y - .5, z - .32, .14], [0, y - .76, z - .24, .06], [0, y - .86, z - .2, .012]], 12), { ridge: .14, twist: .15, ref: [1, 0, 0], tone: (i, k) => k % 2 }));
    tie(band(0, y + .02, z - .08, .1, .25));
  }
  if (style === 8) add(cap(hr, { n: 10, cols: 4, line: L(.8, .47, .43), tip: F(.1, .08), round: true, soft: true, rows: 12, groove: .3, off: () => .1, tone: i => i % 3 ? 0 : 1, // curly: a mop of soft lumps
    bump: (i, c, j, az) => (j < 1 ? .5 : j > 11 ? .35 : 1) * .11 * (.5 + .5 * Math.sin(az * 5 + j * 2.1)) * (.5 + .5 * Math.sin(j * 1.4 - az * 2)) }));
  if (style === 9) { // mohawk: stubble with a crest
    add(cap(hr, { n: 12, cols: 3, soft: true, groove: 0, shine: 0, line: pw([[0, .86], [.9, .85], [1.3, .63], [PI, .6]]), off: () => .016, tone: () => 2 }));
    add(fin(hr, -.72, 1.45, 7, .1, .36));
  }
  if (style === 10) add(cap(hr, { n: 12, cols: 3, soft: true, groove: 0, line: pw([[0, .81], [.92, .8], [1.1, .64], [1.32, .5], [PI, .5]]), off: () => .024, tone: () => 0 })); // buzz cut
  if (style === 11) add(cap(hr, { n: 14, pole: [.12, -.6], ph: 0, line: az => L(.74, .46, .44)(az) + .05 * sm(-.9, .2, -az) * (1 - sm(.9, 1.2, Math.abs(az))), tip: F(.26, .02), u0: .2, // side part: combed across from the part
    off: (az, y) => .065 + .05 * sm(-.3, .9, az) * sm(.55, .9, y), rows: 10 }));
  if (style === 12) add(cap(hr, { n: 14, pole: [.5, 0], line: L(.8, .5, .46), tip: F(0, .02), rows: 11, // quiff: piled up over the forehead
    off: (az, y) => .06 + .24 * (1 - sm(.25, .95, Math.abs(az))) * sm(.66, .84, y) * (1 - .75 * sm(.86, 1, y)) * (az > 0 ? 1 : .85) }));
  if (style === 13) { // afro: one big round cloud
    const C = new THREE.Vector3(0, .93, -.1).sub(HC), E = [.67, .57, .65];
    const shape = d => { const a = (d.x / E[0]) ** 2 + (d.y / E[1]) ** 2 + (d.z / E[2]) ** 2, b = -2 * (d.x * C.x / E[0] ** 2 + d.y * C.y / E[1] ** 2 + d.z * C.z / E[2] ** 2), c = (C.x / E[0]) ** 2 + (C.y / E[1]) ** 2 + (C.z / E[2]) ** 2 - 1, D = b * b - 4 * a * c; return D < 0 ? 0 : (-b + Math.sqrt(D)) / (2 * a); };
    add(cap(hr, { n: 14, cols: 3, shape, soft: true, groove: 0, line: L(.74, .44, .4), tip: F(.05, .04), round: true, rows: 12, tone: i => i % 3 ? 0 : 1, bump: (i, c, j, az) => j < 1 ? 0 : .03 * Math.sin(az * 7 + j * 2.4) * Math.sin(j * 1.5 + .4) }));
  }
  if (style === 14) { // braids
    add(cap(hr, { n: 16, ph: 0, line: L(.76, .47, .43), tip: F(.26, .02) }));
    for (const s of [-1, 1]) { const [x, y, z] = skull(s * .5, .5, .02, .02), p = [[x, y + .04, z, .03]];
      for (let i = 0; i < 4; i++) { const yy = y - .02 - i * .115, r = .1 - i * .008, xx = x + s * (.04 + i * .012), zz = z + .012 * i; p.push([xx, yy, zz, r * .62], [xx, yy - .045, zz, r], [xx, yy - .09, zz, r * .7]); }
      const e = p[p.length - 1]; p.push([e[0], e[1] - .05, e[2], .05], [e[0], e[1] - .11, e[2], .075], [e[0], e[1] - .17, e[2], .02]);
      add(tube(p, { sides: 6, ridge: 0, flat: .85, tone: i => i > 12 ? 0 : Math.floor((i + 2) / 3) % 2 })); tie(band(e[0], e[1] - .045, e[2], .05, 'y')); }
  }
  if (style === 15) add(cap(hr, { n: 16, line: pw([[0, .74], [1.02, .74], [1.28, .02], [1.9, .02], [2.35, up ? -.02 : -.3], [PI, up ? -.03 : -.32]]), tip: az => Math.abs(az) < 1.2 ? F(.27)(az) : .08, u0: .65, round: false, // wavy: shoulder length with a ripple
    off: () => .08, yJ: .3, drop: 7, thick: .11, hang: (u, az, i, k) => 1.02 + .05 * Math.sin(u * 8 + i * PI) * Math.min(1, u * 3) * k + .03 * u, tilt: tilt + .04 }));
  return out;
}

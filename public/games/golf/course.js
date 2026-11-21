// Mini Golf Party: the holes and the ball physics, shared by the server (which decides every shot)
// and the client (which draws the same course and replays the paths it is sent).
//
// A hole is a little grid of 1x1 tiles drawn as text. Row 0 is the far end (the cup side), the last row is
// nearest the camera (the tee side).
//   '#' nothing   '.' fairway   'T' tee   'H' cup   's' sand   'w' water   'o' bumper post
//   'r' ramp running up/down the hole   'R' ramp running across it
// `lv` gives each tile a height level (digits, missing = 0). A ramp takes its heights from the two tiles
// either side of it along its direction, so a ramp joins two levels. Two tiles are open to each other only
// when their shared edge is at the same height on both sides; every other edge is a wall.
// `spin` adds windmill bars: { c, r } tile (can be fractional), hl half length, w turn speed (rad/s).

export const BALL_R = .13, CUP_R = .23, LV = .5, WALL_T = .07;
export const MAX_STROKES = 7, CAP_SCORE = 8; // not in after 7 strokes (or when the clock runs out): you score 8
export const PATH_HZ = 30;                   // path samples per second sent to clients
const DT = 1 / 120, EVERY = 120 / PATH_HZ, MAX_T = 14;
const GS = 7.2, FRICTION = .75, DRAG = .32, SAND = 4.2, SINK_V = 2.7, VMAX = 10.5;

export const HOLES = [
  { name: 'First Putt', par: 2, map: [
    '#.....#',
    '#..H..#',
    '#.....#',
    '#.....#',
    '##.o.##',
    '##...##',
    '#.....#',
    '#..T..#',
    '#.....#'] },
  { name: 'Dogleg', par: 3, map: [
    '.....###',
    '..H..###',
    '.....###',
    '...ss###',
    '........',
    '........',
    '###.o...',
    '###.....',
    '###.....',
    '###..T..',
    '###.....'] },
  { name: 'Windmill', par: 3, map: [
    '#.....#',
    '#..H..#',
    '#.....#',
    '#.....#',
    '##...##',
    '##...##',
    '##...##',
    '#.....#',
    '#.....#',
    '#..T..#',
    '#.....#'], spin: [{ c: 3, r: 5, hl: 1.1, w: 1.5 }] },
  { name: 'Up the Steps', par: 3, map: [
    '#.....#',
    '#....H#',
    '#.....#',
    '#.....#',
    '##rrr##',
    '#.....#',
    '#.o.o.#',
    '#.....#',
    '#T....#',
    '#.....#'], lv: [
    '1111111',
    '1111111',
    '1111111',
    '1111111',
    '0000000'] },
  { name: 'The Bridge', par: 3, map: [
    '#.....#',
    '#...H.#',
    '#.....#',
    '#.....#',
    '#ww.ww#',
    '#ww.ww#',
    '#.....#',
    '#.....#',
    '#.T...#',
    '#.....#'] },
  { name: 'Zigzag', par: 4, map: [
    '.......',
    '.H.....',
    '.......',
    '####...',
    '.......',
    '.......',
    '...####',
    '.......',
    '.......',
    '.....T.',
    '.......'] },
  { name: 'Pinball', par: 3, map: [
    '#.......#',
    '#...H...#',
    '#.......#',
    '#.o...o.#',
    '#...o...#',
    '#.o...o.#',
    '#...o...#',
    '#.o...o.#',
    '#.......#',
    '#...T...#',
    '#.......#'] },
  { name: 'The Hill', par: 3, map: [
    '#.......#',
    '#.......#',
    '#...r...#',
    '#..RHR..#',
    '#...r...#',
    '#.......#',
    '#.......#',
    '#.s...s.#',
    '#.......#',
    '#...T...#',
    '#.......#'], lv: [
    '',
    '',
    '',
    '000010000',
    ''] },
  { name: 'Grand Finale', par: 4, map: [
    '##.....##',
    '##..H..##',
    '##.....##',
    '##.w.w.##',
    '##.....##',
    '###rrr###',
    '#.......#',
    '#...o...#',
    '#.......#',
    '#.......#',
    '##.....##',
    '##..T..##',
    '##.....##'], lv: [
    '',
    '',
    '',
    '',
    '',
    '',
    '111111111',
    '111111111',
    '111111111',
    '111111111',
    '111111111',
    '111111111',
    '111111111'], spin: [{ c: 4, r: 8.5, hl: 1.6, w: -1.2 }] },
];

const level = (def, r, c) => +((def.lv?.[r] || '')[c] || 0);

// Build hole `i`, mirrored left to right when `mirror` is set, into everything the physics and the scene need.
export function buildHole(i, mirror = false) {
  const def = HOLES[i];
  const rows = def.map.length, cols = Math.max(...def.map.map(s => s.length));
  const ch = (r, c) => { if (r < 0 || r >= rows || c < 0 || c >= cols) return '#'; const cc = mirror ? cols - 1 - c : c; return def.map[r][cc] || '#'; };
  const lvl = (r, c) => level(def, r, mirror ? cols - 1 - c : c);
  const X = c => c - (cols - 1) / 2, Z = r => r - (rows - 1) / 2;
  const t = [];
  let tee = null, cup = null;
  const posts = [];
  for (let r = 0; r < rows; r++) {
    t.push([]);
    for (let c = 0; c < cols; c++) {
      const k = ch(r, c);
      if (k === '#' || k === ' ') { t[r].push(null); continue; }
      let h;
      if (k === 'r') { const a = lvl(r - 1, c) * LV, b = lvl(r + 1, c) * LV; h = [a, a, b, b]; }
      else if (k === 'R') { const a = lvl(r, c - 1) * LV, b = lvl(r, c + 1) * LV; h = [a, b, b, a]; }
      else { const v = lvl(r, c) * LV; h = [v, v, v, v]; }
      t[r].push({ k, h, r, c, x: X(c), z: Z(r) });
      if (k === 'T') tee = { x: X(c), z: Z(r) };
      if (k === 'H') cup = { x: X(c), z: Z(r), h: h[0] };
      if (k === 'o') posts.push({ x: X(c), z: Z(r), r: .17 });
    }
  }
  // walls on every edge that is not open on both sides. Each wall knows how tall the ground is beside it.
  const walls = [], at = (r, c) => (t[r] && t[r][c]) || null;
  const edge = (A, ai, aj, B, bi, bj, ax, az, bx, bz) => { // A's corners ai,aj meet B's corners bi,bj
    const open = A && B && Math.abs(A.h[ai] - B.h[bi]) < 1e-6 && Math.abs(A.h[aj] - B.h[bj]) < 1e-6;
    if (open || (!A && !B)) return;
    const hs = [A && A.h[ai], A && A.h[aj], B && B.h[bi], B && B.h[bj]].filter(v => v != null);
    walls.push({ ax, az, bx, bz, lo: Math.min(...hs), hi: Math.max(...hs) });
  };
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const x0 = c - cols / 2, z0 = r - rows / 2;
    if (c < cols) edge(at(r - 1, c), 3, 2, at(r, c), 0, 1, x0, z0, x0 + 1, z0);  // horizontal edge on top of tile (r, c)
    if (r < rows) edge(at(r, c - 1), 1, 2, at(r, c), 0, 3, x0, z0, x0, z0 + 1); // vertical edge left of tile (r, c)
  }
  const spins = (def.spin || []).map(s => ({ x: mirror ? -X(s.c) : X(s.c), z: Z(s.r), hl: s.hl, w: mirror ? -s.w : s.w, a0: .3 }));
  const H = { i, mirror, name: def.name, par: def.par, rows, cols, t, tee, cup, posts, walls, spins };
  H.dist = distField(H);
  return H;
}

// Steps (in tiles) from every tile to the cup, for the bots. Water costs a lot.
function distField(H) {
  const { rows, cols, t } = H, D = new Float32Array(rows * cols).fill(1e9);
  const cr = Math.round(H.cup.z + (rows - 1) / 2), cc = Math.round(H.cup.x + (cols - 1) / 2);
  D[cr * cols + cc] = 0;
  const q = [[cr, cc]];
  const open = (a, b, ai, aj, bi, bj) => a && b && Math.abs(a.h[ai] - b.h[bi]) < 1e-6 && Math.abs(a.h[aj] - b.h[bj]) < 1e-6;
  while (q.length) {
    q.sort((a, b) => D[b[0] * cols + b[1]] - D[a[0] * cols + a[1]]);
    const [r, c] = q.pop(), A = t[r][c], d = D[r * cols + c];
    const nb = [[r - 1, c, 0, 1, 3, 2], [r + 1, c, 3, 2, 0, 1], [r, c - 1, 0, 3, 1, 2], [r, c + 1, 1, 2, 0, 3]];
    for (const [rr, c2, ai, aj, bi, bj] of nb) {
      const B = t[rr]?.[c2]; if (!open(A, B, ai, aj, bi, bj)) continue;
      const nd = d + (B.k === 'w' ? 8 : B.k === 's' ? 1.6 : 1);
      if (nd < D[rr * cols + c2]) { D[rr * cols + c2] = nd; q.push([rr, c2]); }
    }
  }
  return D;
}

export const tileAt = (H, x, z) => {
  const c = Math.floor(x + H.cols / 2), r = Math.floor(z + H.rows / 2);
  return (H.t[r] && H.t[r][c]) || null;
};
// ground height and slope under a point
export function ground(H, x, z, out = { h: 0, gx: 0, gz: 0, tile: null }) {
  const T = tileAt(H, x, z);
  out.tile = T;
  if (!T) { out.h = 0; out.gx = out.gz = 0; return out; }
  const u = x - (T.x - .5), v = z - (T.z - .5), [nw, ne, se, sw] = T.h;
  const top = nw + (ne - nw) * u, bot = sw + (se - sw) * u;
  out.h = top + (bot - top) * v;
  out.gx = (ne - nw) * (1 - v) + (se - sw) * v;
  out.gz = (sw - nw) * (1 - u) + (se - ne) * u;
  return out;
}
export const spinAngle = (s, t) => s.a0 + s.w * t;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const POW_MIN = .7, POW_MAX = 8.6;
// Hit the ball from (x, z) towards angle `ang` (radians, 0 = up the hole towards row 0) with power 0..1,
// `t0` seconds after the hole started (the windmills keep turning). Returns the path and how it ended.
export function simulate(H, x, z, ang, pow, t0 = 0, seed = 1) {
  const rnd = rng(seed);
  const sp = POW_MIN + Math.max(0, Math.min(1, pow)) * (POW_MAX - POW_MIN);
  let vx = Math.sin(ang) * sp, vz = -Math.cos(ang) * sp, t = 0, step = 0;
  const path = [Math.round(x * 100), Math.round(z * 100)], fx = [], g = { h: 0, gx: 0, gz: 0, tile: null };
  let sunk = false, water = false, lastFx = -1;
  const hit = (kind, v) => { const i = path.length / 2; if (v > .8 && i !== lastFx && fx.length < 40) { fx.push([i, kind]); lastFx = i; } };
  const R = BALL_R + WALL_T;
  while (t < MAX_T) {
    ground(H, x, z, g);
    const T = g.tile, sp2 = Math.hypot(vx, vz);
    // forces: the slope, rolling friction (much more in sand), a little drag
    let ax = -GS * g.gx, az = -GS * g.gz;
    const fr = FRICTION * (T?.k === 's' ? SAND : 1) + DRAG * sp2;
    if (sp2 > 1e-6) { ax -= vx / sp2 * fr; az -= vz / sp2 * fr; }
    // the cup: a gentle pull when the ball is close and slow
    const cdx = H.cup.x - x, cdz = H.cup.z - z, cd = Math.hypot(cdx, cdz);
    if (cd < CUP_R + .15 && cd > 1e-4 && sp2 < 4) { ax += cdx / cd * 2; az += cdz / cd * 2; }
    vx += ax * DT; vz += az * DT;
    // friction can stop the ball but not push it backwards
    if (sp2 > 1e-6 && vx * (vx - ax * DT) + vz * (vz - az * DT) < 0 && Math.hypot(g.gx, g.gz) * GS < fr) { vx = vz = 0; }
    const s3 = Math.hypot(vx, vz); if (s3 > VMAX) { vx *= VMAX / s3; vz *= VMAX / s3; }
    x += vx * DT; z += vz * DT;
    // walls: short segments with rounded ends
    for (const w of H.walls) {
      const ex = w.bx - w.ax, ez = w.bz - w.az, L2 = ex * ex + ez * ez;
      let u = ((x - w.ax) * ex + (z - w.az) * ez) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = w.ax + ex * u, pz = w.az + ez * u, dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, vn = vx * nx + vz * nz;
      x = px + nx * R; z = pz + nz * R;
      if (vn < 0) { vx -= 1.72 * vn * nx; vz -= 1.72 * vn * nz; hit('w', -vn); }
    }
    for (const p of H.posts) {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), min = BALL_R + p.r;
      if (d >= min || d === 0) continue;
      const nx = dx / d, nz = dz / d, vn = vx * nx + vz * nz;
      x = p.x + nx * min; z = p.z + nz * min;
      if (vn < 0) { vx -= 2.1 * vn * nx; vz -= 2.1 * vn * nz; vx += (rnd() - .5) * .3; hit('p', -vn); }
    }
    for (const s of H.spins) {
      const rx = x - s.x, rz = z - s.z; if (rx * rx + rz * rz > (s.hl + .4) ** 2) continue;
      const a = spinAngle(s, t0 + t), cs = Math.cos(a), sn = Math.sin(a);
      const al = Math.max(-s.hl, Math.min(s.hl, rx * cs + rz * sn)), cx = al * cs, cz = al * sn;
      const dx = rx - cx, dz = rz - cz, d = Math.hypot(dx, dz), min = BALL_R + .08;
      if (d >= min || d === 0) continue;
      const nx = dx / d, nz = dz / d, bvx = -s.w * cz, bvz = s.w * cx; // the bar's own speed where it touches
      x = s.x + cx + nx * min; z = s.z + cz + nz * min;
      const vn = (vx - bvx) * nx + (vz - bvz) * nz;
      if (vn < 0) { vx -= 1.6 * vn * nx; vz -= 1.6 * vn * nz; hit('s', -vn); }
    }
    t += DT; step++;
    if (step % EVERY === 0) path.push(Math.round(x * 100), Math.round(z * 100));
    // in the cup?
    const cd2 = Math.hypot(H.cup.x - x, H.cup.z - z), v = Math.hypot(vx, vz);
    if (cd2 < CUP_R) {
      if (v < SINK_V) { sunk = true; break; }
      if (cd2 < CUP_R * .55) { // too fast: it hops the hole and lips out a bit slower
        const k = (rnd() - .5) * .9, c = Math.cos(k), s = Math.sin(k);
        [vx, vz] = [(vx * c - vz * s) * .62, (vx * s + vz * c) * .62];
      }
    }
    if (tileAt(H, x, z)?.k === 'w') { water = true; break; }
    // stopped (not on a slope it would roll down, and not where a windmill bar will sweep through)
    if (v < .05) {
      ground(H, x, z, g);
      const steep = Math.hypot(g.gx, g.gz) * GS > FRICTION * 1.4;
      const inSpin = H.spins.some(s => Math.hypot(x - s.x, z - s.z) < s.hl + BALL_R + .1);
      if (!steep && !inSpin) { vx = vz = 0; break; }
    }
  }
  if (path.length < 4 || path.at(-2) !== Math.round(x * 100) || path.at(-1) !== Math.round(z * 100)) path.push(Math.round(x * 100), Math.round(z * 100));
  if (sunk) { x = H.cup.x; z = H.cup.z; }
  return { path, fx, x, z, sunk, water, ms: Math.round((path.length / 2 - 1) * 1000 / PATH_HZ) };
}

// How good a resting spot is for a bot: lower is better.
export function spotScore(H, x, z) {
  const T = tileAt(H, x, z); if (!T) return 1e6;
  if (T.k === 'H') return Math.hypot(x - H.cup.x, z - H.cup.z);
  const d = H.dist[T.r * H.cols + T.c];
  return d + Math.hypot(x - T.x, z - T.z) * .4 + (T.k === 's' ? .8 : 0);
}

// Path helpers for the client: position at time ms along a path (flat [x, z, x, z ...] in centimetres).
export function pathAt(path, ms, out = { x: 0, z: 0, done: false }) {
  const n = path.length / 2 - 1, f = Math.max(0, ms) * PATH_HZ / 1000;
  if (f >= n) { out.x = path[n * 2] / 100; out.z = path[n * 2 + 1] / 100; out.done = true; return out; }
  const i = Math.floor(f), u = f - i;
  out.x = (path[i * 2] + (path[i * 2 + 2] - path[i * 2]) * u) / 100;
  out.z = (path[i * 2 + 1] + (path[i * 2 + 3] - path[i * 2 + 1]) * u) / 100;
  out.done = false; return out;
}

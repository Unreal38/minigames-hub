// Lantern Night's island, shared by the page and the server (no three.js here): where the chore places, the hollow logs,
// the dock and the campfire stand, what blocks walking, how far each player can see, and the chores themselves.
// Units are metres of the 3D scene. An avatar is about 1.7 tall. +z is towards the camera (south), like the Plaza.
import { L } from '../../i18n.js';

export const R_WALK = 22.5;   // you can walk this far from the middle
export const SPEED = 4.6;     // walking, metres a second
export const GHOST_SPEED = 5.6; // a pet (players who are out) trots a little faster and goes through everything
export const Q = 20;          // positions travel as whole numbers: metres x Q
export const FIRE_R = 1.1;    // the campfire blocks this much
export const BELL = [0, -2.6]; // the meeting bell stands just north of the fire
export const REACH = 2.3;     // how near you must stand to a chore, a log, a rope or the bell
export const LULL_REACH = 1.9; // how near a Sneak must stand to lull someone
export const REPORT_REACH = 3.4; // how near you must be to a sleeper to ring for a meeting
export const GLOW = 7.5, GLOW_SNEAK = 9.5, GLOW_DARK = 3.4; // how far you see: islanders, Sneaks, islanders while the lighthouse is out

// Chore places: [id, Pet Farm decoration, x, z, turn, size, blocking radius]; sp = where you stand (else in
// front of the place, on the side that faces the campfire). Each sits in its own walled corner of the island (see WALLS).
export const STATIONS = [
  { id: 'light', item: 'lighthouse', x: -16, z: -14, ry: .5, s: 2.2, r: 1.25, name: () => L('Lighthouse', 'Latarnia') },
  { id: 'mill', item: 'windmill', x: 14.5, z: -15, ry: -.6, s: 2.1, r: 1.3, name: () => L('Windmill', 'Wiatrak') },
  { id: 'barn', item: 'barn', x: -17, z: 2, ry: 1.57, s: 1.5, r: 2.1, name: () => L('Pet barn', 'Stodoła') },
  { id: 'kitchen', item: 'kitchen', x: 2, z: -18, ry: 0, s: 1.5, r: 2.1, name: () => L('Kitchen hut', 'Kuchnia') },
  { id: 'garden', item: 'garden', x: 18.4, z: 7.2, ry: -1.3, s: 1.5, r: 0, sp: [18.4, 5.6], name: () => L('Garden', 'Ogród') },
  { id: 'well', item: 'well', x: -10, z: 14.5, ry: .3, s: 1.8, r: 1.05, name: () => L('Well', 'Studnia') },
  { id: 'dock', item: null, x: 7.5, z: 20.4, ry: 0, s: 1, r: 0, sp: [7.5, 19.6], name: () => L('Dock', 'Przystań') },
];
// The chores: two at every place, a player's list never has two at the same place. Kinds (client.js draws them):
// hold = press and hold, taps = tap every target, seq = tap 1..5 in order, fill = stop the bar in the band,
// pick = tap only the right things (a wrong tap buzzes). job = the list line, how = the one-line hint in the panel.
const T = (kind, job, how, more = {}) => ({ kind, job, how, ...more });
const TASKS = {
  light: [T('seq', () => L('Light the lamps', 'Zapal lampy'), () => L('Light the lamps in order: 1, 2, 3, 4, 5.', 'Zapal lampy po kolei: 1, 2, 3, 4, 5.')),
    T('taps', () => L('Wipe the lens', 'Przetrzyj soczewkę'), () => L('Tap every smudge to wipe it off.', 'Dotknij każdej smugi, żeby ją zetrzeć.'), { pics: ['💧', '💨', '💧', '💨', '💧', '💨'] })],
  mill: [T('hold', () => L('Crank the windmill', 'Zakręć wiatrakiem'), () => L('Press and hold until the wheel is full.', 'Przytrzymaj, aż koło się wypełni.')),
    T('pick', () => L('Sort the grain', 'Przesiej ziarno'), () => L('Tap only the grain, not the pebbles.', 'Dotknij tylko ziaren, nie kamyków.'), { good: '🌾', bad: '🪨' })],
  barn: [T('taps', () => L('Feed the pets', 'Nakarm zwierzaki'), () => L('Tap every treat to put it in a bowl.', 'Dotknij każdego smakołyku, żeby włożyć go do miski.'), { pics: ['🥕', '🍎', '🌽', '🥬', '🍓', '🥜'] }),
    T('pick', () => L('Collect the eggs', 'Zbierz jajka'), () => L('Tap only the eggs, not the feathers.', 'Dotknij tylko jajek, nie piórek.'), { good: '🥚', bad: '🪶' })],
  kitchen: [T('taps', () => L('Sort the snacks', 'Posortuj przekąski'), () => L('Tap every snack to put it on the shelf.', 'Dotknij każdej przekąski, żeby odłożyć ją na półkę.'), { pics: ['🍪', '🧁', '🥐', '🍩', '🍬', '🥨'] }),
    T('hold', () => L('Stir the soup', 'Zamieszaj zupę'), () => L('Press and hold to stir until the wheel is full.', 'Przytrzymaj i mieszaj, aż koło się wypełni.'))],
  garden: [T('fill', () => L('Water the garden', 'Podlej ogród'), () => L('Hold to pour and let go in the green band.', 'Przytrzymaj, żeby lać, i puść w zielonym pasku.'), { btn: () => L('Pour', 'Lej') }),
    T('pick', () => L('Pull the weeds', 'Wyrwij chwasty'), () => L('Tap only the weeds, leave the flowers.', 'Dotknij tylko chwastów, zostaw kwiatki.'), { good: '🌿', bad: '🌷' })],
  well: [T('hold', () => L('Draw water', 'Wyciągnij wodę'), () => L('Press and hold until the wheel is full.', 'Przytrzymaj, aż koło się wypełni.')),
    T('seq', () => L('Mend the bucket', 'Napraw wiadro'), () => L('Hammer the nails in order: 1, 2, 3, 4, 5.', 'Wbij gwoździe po kolei: 1, 2, 3, 4, 5.'), { icon: '🔨' })],
  dock: [T('fill', () => L('Coil the rope', 'Zwiń linę'), () => L('Hold to pull and let go in the green band.', 'Przytrzymaj, żeby ciągnąć, i puść w zielonym pasku.'), { btn: () => L('Pull', 'Ciągnij') }),
    T('taps', () => L('Patch the boat', 'Załataj łódkę'), () => L('Tap every hole to patch it.', 'Dotknij każdej dziury, żeby ją załatać.'), { pics: ['🕳️', '🕳️', '🕳️', '🕳️', '🕳️', '🕳️'] })],
};
STATIONS.forEach(st => { st.tasks = TASKS[st.id]; });
export const taskOf = (st, v = 0) => STATIONS[st]?.tasks[v ? 1 : 0];
export const ST = Object.fromEntries(STATIONS.map((s, i) => [s.id, i]));
export const spotOf = st => { if (st.sp) return st.sp; const d = Math.hypot(st.x, st.z) || 1, k = st.r + 1.1; return [st.x - st.x / d * k, st.z - st.z / d * k]; };
export const CHORE_MS = { hold: 2600, taps: 2200, seq: 2000, fill: 1500, pick: 1800 }; // the quickest a chore can really be done (the server checks)

// Hollow logs: only Sneaks can crawl in and pop out of the next one round the island.
export const LOGS = [[-19.6, -5.4, 0], [-6.6, -19.4, 1.57], [20.2, -3.6, 0], [-2.4, 20.2, 1.57]];
// The ferry's two mooring ropes at the dock: when the Sneaks untie the ferry, two islanders must hold both at once.
export const ROPES = [[4.6, 20.6], [10.4, 20.6]];
export const ROPE_MS = 40_000;  // the ferry drifts off (Sneaks win) if nobody ties it within this
export const DARK_FIX = 'light'; // the lighthouse is relit at its own chore place
export const MISCHIEF_WAIT = 30_000, MISCHIEF_FIRST = 20_000; // cooldown between two pranks, and none in the first seconds
export const LULL_WAIT = { 20: 20_000, 30: 30_000, 45: 45_000 };

// ---------- walls: the island is cut into yards, sheds, a hedge maze and lanes ----------
// Kinds: t = thickness, h = height, see = you can see over it (low fences only). Everything else blocks sight: what is
// behind it stays dark (the page draws its shadow) and the server sends nobody standing there.
export const WALL_KIND = { stone: { t: .5, h: 1.1, see: false }, hedge: { t: .7, h: 1.25, see: false }, plank: { t: .3, h: 1.45, see: false }, fence: { t: .2, h: .75, see: true } };
const WR = 21.6; // walls stop at the grass edge
function clip(a, b) { // the part of a..b inside the island
  const dx = b[0] - a[0], dz = b[1] - a[1], A = dx * dx + dz * dz, B = 2 * (a[0] * dx + a[1] * dz), C = a[0] * a[0] + a[1] * a[1] - WR * WR, D = B * B - 4 * A * C;
  if (D <= 0) return null; const r = Math.sqrt(D), t0 = Math.max(0, (-B - r) / (2 * A)), t1 = Math.min(1, (-B + r) / (2 * A));
  if (t1 - t0 < .02) return null; return [[a[0] + dx * t0, a[1] + dz * t0], [a[0] + dx * t1, a[1] + dz * t1]].map(p => p.map(v => Math.round(v * 100) / 100));
}
export const WALLS = [];
const seg = (x1, z1, x2, z2, k) => { const c = clip([x1, z1], [x2, z2]); if (c && Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) > .3) WALLS.push({ a: c[0], b: c[1], k }); };
// a straight line with door gaps; gaps are [middle, width] along the line, measured from its start
function line(x1, z1, x2, z2, k, gaps = []) {
  const len = Math.hypot(x2 - x1, z2 - z1), at = t => [x1 + (x2 - x1) * t / len, z1 + (z2 - z1) * t / len]; let t = 0;
  for (const [m, w] of [...gaps].sort((p, q) => p[0] - q[0])) { if (m - w / 2 > t) seg(...at(t), ...at(m - w / 2), k); t = m + w / 2; }
  if (t < len) seg(...at(t), ...at(len), k);
}
// a walled yard (a door must leave about 1.3 m clear: 2.6 wide in stone or plank, 3 in hedge); doors per side as [where (an x on north/south sides, a z on east/west sides), width]
function room(x1, z1, x2, z2, k, d = {}) {
  const g = (list, from) => (list || []).map(([c, w]) => [c - from, w]);
  line(x1, z1, x2, z1, k, g(d.n, x1)); line(x1, z2, x2, z2, k, g(d.s, x1)); line(x1, z1, x1, z2, k, g(d.w, z1)); line(x2, z1, x2, z2, k, g(d.e, z1));
}
{
  // the campfire square: an octagon of hedges with a gap to each side of the island
  const R = 9, P = [...Array(8)].map((_, i) => { const a = (i + .5) / 8 * Math.PI * 2; return [Math.cos(a) * R, Math.sin(a) * R]; });
  for (let i = 0; i < 8; i++) { const [a, b] = [P[i], P[(i + 1) % 8]], len = Math.hypot(b[0] - a[0], b[1] - a[1]); line(...a, ...b, 'hedge', i % 2 ? [] : [[len / 2, 2.8]]); }
  // NW: the lighthouse yard, stone walls, a gate to the east and one to the south
  room(-21, -20, -10, -8.5, 'stone', { e: [[-11.2, 2.6]], s: [[-13.2, 2.6]] });
  line(-10, -14, -7.6, -14, 'stone'); // a wing wall that hides the east gate from the lane
  // N: the kitchen hut, a plank shed with a front door and a back door into the alley
  room(-3, -22, 7.5, -13, 'plank', { s: [[2, 2.6]], w: [[-19.4, 2.4]] });
  // the alley between them: a crooked stone lane
  line(-10, -11, -5.5, -11, 'stone'); line(-5.5, -11, -5.5, -8, 'stone');
  // NE: the windmill's field, low fences you can see over but have to walk round (a zigzag)
  line(7.6, -11.4, 16.6, -11.4, 'fence'); line(10.8, -8, 20.5, -8, 'fence'); line(7.6, -11.4, 7.6, -14.5, 'fence');
  // W: the pet barn's shed, door to the fire and a side door to the north lane
  room(-22, -3, -11, 7.5, 'plank', { e: [[2.2, 2.6]], n: [[-14.6, 2.4]] });
  // E: the garden, a little hedge maze: in by the west gate (or the south gate), round two hedges to the beds
  room(10.5, 1, 21, 11.2, 'hedge', { w: [[9.6, 3.2]], s: [[19, 3]] });
  line(13.6, 1, 13.6, 7.4, 'hedge'); line(16.6, 11.2, 16.6, 4.2, 'hedge');
  // SW: the well's orchard behind a stone wall with one gate, and a wall along its east side
  line(-19, 8.8, -5, 8.8, 'stone', [[6.8, 2.6]]); line(-5, 8.8, -5, 13.5, 'stone');
  // S: the boathouse in front of the dock: through it, or round its west side
  room(2.5, 12.6, 12.5, 17.2, 'plank', { n: [[7.5, 2.6]], s: [[7.5, 3]], w: [[15, 2.4]] });
  // SE: an old ruin, broken stone corners to hide behind
  line(13.4, 14.2, 17.4, 14.2, 'stone'); line(17.4, 14.2, 17.4, 17.4, 'stone');
}

// Other things on the island: [Pet Farm decoration, x, z, turn, size, blocking radius].
export const DECOR = [
  ['campfire', 0, 0, 0, 2.2, FIRE_R],
  ...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2 + .3; return ['haybale', Math.cos(a) * 4.2, Math.sin(a) * 4.2, -a + Math.PI / 2, 1.5, .7]; }),
  // lamps along the lanes
  ['lamp', -3.6, -9.6, 0, 1.9, .35], ['lamp', 3.6, 9.6, 0, 1.9, .35], ['lamp', 9.8, -3.4, 0, 1.9, .35], ['lamp', -9.8, 3.6, 0, 1.9, .35],
  ['lamp', -8.4, -16.4, 0, 1.9, .35], ['lamp', 9.4, -13.6, 0, 1.9, .35], ['lamp', -16.6, -6.8, 0, 1.9, .35], ['lamp', 8.8, 8.6, 0, 1.9, .35], ['lamp', -3, 14.6, 0, 1.9, .35],
  // the orchard round the well
  ['tree', -16.2, 11.6, 0, 1.7, .7], ['cherry', -13.2, 17.6, 0, 1.7, .7], ['tree', -6.8, 17.8, 0, 1.7, .7], ['cherry', -16.4, 15.4, .5, 1.6, .7], ['tree', -12.8, 11.2, 0, 1.6, .7],
  // the windmill field
  ['scarecrow', 11, -17, -.4, 1.8, .4], ['haybale', 11.4, -13.6, .3, 1.5, .7],
  // the lighthouse yard and the alley
  ['rock', -19, -11, 0, 1.6, .7], ['bush', -12.6, -18.4, 0, 1.5, .55], ['shrooms', -8.6, -19.6, 0, 1.6, 0], ['rock', -4.2, -15.2, 0, 1.3, .55],
  // the kitchen yard and the barn
  ['picnic', 5.2, -14.8, 0, 1.5, .8], ['chest', -1.6, -20.2, .4, 1.4, .45], ['haybale', -13, 5.6, .3, 1.4, .6], ['haybale', -13.4, -1.4, 1.2, 1.4, .6],
  // round the garden and the ruin
  ['flowers', 12, 4.8, 0, 1.6, 0], ['birdbath', 12, 2.4, 0, 1.5, .4], ['statue', 15.4, 16.2, -.6, 1.6, .55], ['bush', 20.2, 12.6, 0, 1.6, .6],
  // the south: by the boathouse and the beach
  ['pine', -6.6, 20.2, 0, 1.8, .7], ['rock', 14.4, 19.2, 0, 1.4, .6], ['bench', 0.4, 11.4, .2, 1.6, .85], ['pine', 19.4, -0.4, 0, 1.7, .6],
  ['tree', -20.6, 8.8, 0, 1.6, .7], ['bush', -5.6, 5.4, 0, 1.4, .5],
];

// What blocks walking: circles [x, z, r] and the walls. The page slides you round them; the server stops a step
// that goes through a wall.
export const BLOCKS = [...STATIONS.filter(s => s.r > 0).map(s => [s.x, s.z, s.r]), ...DECOR.filter(t => t[5] > 0).map(t => [t[1], t[2], t[5]]), ...LOGS.map(([x, z]) => [x, z, .7]), [BELL[0], BELL[1], .3]];
export const clampWalk = (x, z) => { const d = Math.hypot(x, z); return d > R_WALK ? [x * R_WALK / d, z * R_WALK / d] : [x, z]; };
const near = (x, z, w) => { const [ax, az] = w.a, dx = w.b[0] - ax, dz = w.b[1] - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); const cx = ax + dx * t, cz = az + dz * t; return [Math.hypot(x - cx, z - cz), cx, cz]; };
// Slide a step out of anything solid it ended in (pets of players who are out walk through everything).
export function unblock(x, z, body = .38) {
  for (let k = 0; k < 2; k++) {
    for (const b of BLOCKS) { const dx = x - b[0], dz = z - b[1], d = Math.hypot(dx, dz), min = b[2] + body; if (d < min && d > 1e-4) { x = b[0] + dx / d * min; z = b[1] + dz / d * min; } }
    for (const w of WALLS) { const [d, cx, cz] = near(x, z, w), min = WALL_KIND[w.k].t / 2 + body; if (d < min && d > 1e-4) { x = cx + (x - cx) / d * min; z = cz + (z - cz) / d * min; } }
  }
  return clampWalk(x, z);
}
// Does the straight line a..b go through a wall? (sight: only walls you can't see over)
const cross = (ax, az, bx, bz, w) => { const [cx, cz] = w.a, [dx, dz] = w.b, o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = o(ax, az, bx, bz, cx, cz), d2 = o(ax, az, bx, bz, dx, dz), d3 = o(cx, cz, dx, dz, ax, az), d4 = o(cx, cz, dx, dz, bx, bz); return d1 * d2 < 0 && d3 * d4 < 0; };
export const throughWall = (ax, az, bx, bz) => WALLS.some(w => cross(ax, az, bx, bz, w));
export const sees = (ax, az, bx, bz) => !WALLS.some(w => !WALL_KIND[w.k].see && cross(ax, az, bx, bz, w));

// ---------- finding a way round the walls (a tap on the ground walks there) ----------
const CELL = .5, HALF = 46, N = HALF * 2 + 1; let grid = null;
const free = (x, z, body = .42) => { if (Math.hypot(x, z) > R_WALK - .1) return false;
  for (const b of BLOCKS) if (Math.hypot(x - b[0], z - b[1]) < b[2] + body) return false;
  for (const w of WALLS) if (near(x, z, w)[0] < WALL_KIND[w.k].t / 2 + body) return false; return true; };
function cells() { if (grid) return grid; grid = new Uint8Array(N * N); for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) grid[i * N + j] = free((i - HALF) * CELL, (j - HALF) * CELL) ? 1 : 0; return grid; }
const cellOf = (x, z) => [Math.round(x / CELL) + HALF, Math.round(z / CELL) + HALF];
const clear = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / .2); for (let k = 1; k <= n; k++) if (!free(ax + (bx - ax) * k / n, az + (bz - az) * k / n, .4)) return false; return true; };
// The way from a to b as corner points to walk through (the last one is b), or null when there is none.
export function findPath(ax, az, bx, bz) {
  if (clear(ax, az, bx, bz)) return [[bx, bz]];
  const g = cells(), nearFree = (x, z) => { const [i0, j0] = cellOf(x, z); let best = -1, bd = 1e9;
    for (let di = -4; di <= 4; di++) for (let dj = -4; dj <= 4; dj++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N || j >= N || !g[i * N + j]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = i * N + j; } } return best; };
  const s = nearFree(ax, az), t = nearFree(bx, bz); if (s < 0 || t < 0) return null;
  const cost = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), heap = [[0, s]], ti = (t / N) | 0, tj = t % N;
  const h = c => { const di = Math.abs(((c / N) | 0) - ti), dj = Math.abs(c % N - tj); return (Math.max(di, dj) + .414 * Math.min(di, dj)); };
  const push = e => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const done = new Uint8Array(N * N); cost[s] = 0;
  while (heap.length) {
    const [, c] = pop(); if (c === t) break; if (done[c]) continue; done[c] = 1; const ci = (c / N) | 0, cj = c % N;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue; const k = i * N + j;
      if (!g[k] || (di && dj && (!g[ci * N + j] || !g[i * N + cj]))) continue; const nc = cost[c] + (di && dj ? 1.414 : 1);
      if (nc < cost[k]) { cost[k] = nc; from[k] = c; push([nc + h(k), k]); } }
  }
  if (from[t] < 0 && s !== t) return null;
  const pts = []; for (let c = t; c !== s && c >= 0; c = from[c]) pts.push([((c / N) | 0) - HALF, c % N - HALF].map(v => v * CELL)); pts.reverse(); pts.push([bx, bz]);
  // pull the string: skip every corner you can walk straight past
  const out = []; let cx = ax, cz = az, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !clear(cx, cz, ...pts[j])) j--; out.push(pts[j]); [cx, cz] = pts[j]; i = j + 1; }
  return out;
}

// Where everybody stands when a game or a meeting starts: a ring round the fire, in seat order.
export const ringAt = (i, n) => { const a = i / Math.max(1, n) * Math.PI * 2 + Math.PI / 2; return [Math.cos(a) * 5.6, Math.sin(a) * 5.6]; };

// How many Sneaks a table has.
export const sneaksFor = (n, pick = 'auto') => pick === 1 || pick === 2 ? Math.min(pick, Math.max(1, Math.floor((n - 1) / 3))) : n >= 7 ? 2 : 1;
export const TALK = [30, 45, 90], CHORES = [3, 5, 7];
// A pet's size as players see it: babies leave tiny prints, adults big ones.
export const SIZE_WORD = f => [L('tiny', 'malutkie'), L('middle-sized', 'średnie'), L('big', 'duże')][f] || '';

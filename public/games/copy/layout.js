// Copycat Isle: the island, shared by the server (bot hiding spots, fair movement) and the page (drawing, walking).
// Everything here is plain numbers, no three.js, so both sides read the same map.
//
// The island is a 56 x 56 m square with seven areas round a stone square:
//   the square with the big tree (middle), a barn you can walk into (north-west) beside a fenced pumpkin patch,
//   a hill with a ramp and a windmill (north-east), a snow fort (west), a pond with a dock and a stuck boat
//   (south-west: slippery ice in winter, shallow water the rest of the year), a hedge maze (south) and a market
//   with a café (south-east). The seekers' pet hut stands on the east path.
import { L } from '../../i18n.js';

export const SIZE = 28;             // half the island's width: you can walk to |x|, |z| < EDGE
export const EDGE = SIZE - .6;
export const Q = 20;                // positions travel as whole numbers: metres x Q
export const SPEED = 4.6;           // walking, metres a second
export const PROP_SPEED = 3.8;      // walking while dressed up as something
export const BODY_R = .36;          // how close you can get to things
export const HIDE_S = 30;           // the hiders' head start
export const SEEK_OPTS = [120, 180, 240];
export const COPIES = 2;            // copies left for the rest of the round once seeking starts
export const COPY_REACH = 6;        // how far away a thing can be copied
export const BOOP_REACH = 3.6;      // how far a seeker can boop
export const DIZZY_MS = 2000;       // a wrong boop
export const SNIFF_S = 20, SNIFF_R = 12; // the pet sniffs every 20 s and smells hiders up to 12 m away
export const SQUEAK_S = 40;         // every hider squeaks this often
export const SQUEAK_WAIT = 5000;    // a squeak on purpose, at most this often
export const SQUEAK_MAX = 3;        // squeaks on purpose that score, a round
export const BREAK_MS = 6500;       // between rounds
export const FAST_S = 60;           // a find in the first minute of seeking scores extra

export const HILL = { x1: 13, x2: 26, z1: -26, z2: -13, h: 2.2 };
export const RAMP = { x1: 8, x2: 13, z1: -21, z2: -18 };
export const POND = { x: -15, z: 16, rx: 7.5, rz: 5.5 };
export const BARN = { x1: -25, x2: -13, z1: -24, z2: -13, h: 3 };
export const FORT = { x1: -22, x2: -13, z1: -5, z2: 5 };
export const MAZE = { x1: -6, x2: 6, z1: 13, z2: 26 };
export const MARKET = { x1: 8, x2: 26, z1: 8, z2: 26 };
export const HUT = { x: 24.6, z: 3 };
export const TREE_R = 2.3;

export function heightAt(x, z) {
  if (x >= HILL.x1 && x <= HILL.x2 && z >= HILL.z1 && z <= HILL.z2) return HILL.h;
  if (x >= RAMP.x1 && x < RAMP.x2 && z >= RAMP.z1 && z <= RAMP.z2) return HILL.h * (x - RAMP.x1) / (RAMP.x2 - RAMP.x1);
  return 0;
}
export const inPond = (x, z) => ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < 1;
export const inBarn = (x, z) => x > BARN.x1 && x < BARN.x2 && z > BARN.z1 && z < BARN.z2;

// The areas, for the minimap and the "you are here" chip.
export const AREAS = [
  { id: 'square', name: L('The square', 'Rynek'), test: (x, z) => Math.abs(x) < 8 && Math.abs(z) < 8 },
  { id: 'barn', name: L('The barn', 'Stodoła'), test: inBarn },
  { id: 'patch', name: L('Pumpkin patch', 'Grządka dyń'), test: (x, z) => x > -11 && x < -3 && z > -25.5 && z < -18 },
  { id: 'hill', name: L('Windmill hill', 'Wzgórze z wiatrakiem'), test: (x, z) => heightAt(x, z) > .3 },
  { id: 'fort', name: L('Snow fort', 'Śnieżny fort'), test: (x, z) => x > FORT.x1 && x < FORT.x2 && z > FORT.z1 && z < FORT.z2 },
  { id: 'pond', name: L('The pond', 'Staw'), test: (x, z) => ((x - POND.x) / (POND.rx + 2)) ** 2 + ((z - POND.z) / (POND.rz + 2)) ** 2 < 1 },
  { id: 'maze', name: L('Hedge maze', 'Labirynt'), test: (x, z) => x > MAZE.x1 && x < MAZE.x2 && z > MAZE.z1 && z < MAZE.z2 },
  { id: 'market', name: L('Market and café', 'Targ i kawiarnia'), test: (x, z) => x > MARKET.x1 && z > MARKET.z1 },
];
export const areaAt = (x, z) => AREAS.find(a => a.test(x, z)) || null;

// What a hider can turn into. r: how wide it is (for walking round it), h: how tall (for tapping it).
// Most are Pet Farm decorations; sa and sb change with the season (gifts and a snowman in winter).
export const KINDS = {
  bench: { r: .85, h: 1.2 }, haybale: { r: .62, h: .9 }, lamp: { r: .3, h: 2.5 }, chest: { r: .55, h: 1 }, mailbox: { r: .32, h: 1.5 },
  birdbath: { r: .45, h: 1.2 }, bush: { r: .62, h: 1.1 }, rock: { r: .55, h: .8 }, shrooms: { r: .45, h: .8 }, scarecrow: { r: .45, h: 2.1 },
  pumpkin: { r: .5, h: .8 }, crate: { r: .48, h: .85 }, barrel: { r: .44, h: .95 }, table: { r: .55, h: .85 }, chair: { r: .34, h: 1 },
  bucket: { r: .3, h: .6 }, sa: { r: .5, h: .8 }, sb: { r: .5, h: 1.7 },
};
const KIND_NAMES = {
  bench: L('bench', 'ławka'), haybale: L('hay bale', 'bela siana'), lamp: L('lamp post', 'latarnia'), chest: L('treasure chest', 'skrzynia'), mailbox: L('mailbox', 'skrzynka na listy'),
  birdbath: L('bird bath', 'poidełko dla ptaków'), bush: L('bush', 'krzak'), rock: L('rock', 'kamień'), shrooms: L('mushrooms', 'grzybki'), scarecrow: L('scarecrow', 'strach na wróble'),
  pumpkin: L('pumpkin', 'dynia'), crate: L('crate', 'skrzynka'), barrel: L('barrel', 'beczka'), table: L('café table', 'stolik'), chair: L('café chair', 'krzesło'), bucket: L('bucket', 'wiadro'),
};
const SEASON_NAMES = { winter: [L('presents', 'prezenty'), L('snowman', 'bałwan')], spring: [L('tulips', 'tulipany'), L('sunflower', 'słonecznik')], summer: [L('tulips', 'tulipany'), L('sunflower', 'słonecznik')],
  autumn: [L('pumpkins', 'dynie'), L('sunflower', 'słonecznik')], halloween: [L('jack-o\'-lantern', 'dyniowy lampion'), L('sunflower', 'słonecznik')] };
export const kindName = (k, season = 'winter') => k === 'sa' ? (SEASON_NAMES[season] || SEASON_NAMES.winter)[0] : k === 'sb' ? (SEASON_NAMES[season] || SEASON_NAMES.winter)[1] : KIND_NAMES[k] || k;

// ---------- walls (straight runs with gaps): [axis, from, to, at, height, look, thickness, gaps] ----------
// axis 'x' runs along x from..to at z = at; 'z' runs along z at x = at. Looks: barn, fence, snow, hedge.
export const WALLS = [
  // the barn: doors on the east and south sides
  ['x', BARN.x1, BARN.x2, BARN.z1, BARN.h, 'barn', .3], ['z', BARN.z1, BARN.z2, BARN.x1, BARN.h, 'barn', .3],
  ['z', BARN.z1, BARN.z2, BARN.x2, BARN.h, 'barn', .3, [[-20, -17]]], ['x', BARN.x1, BARN.x2, BARN.z2, BARN.h, 'barn', .3, [[-21, -17.5]]],
  // the pumpkin patch fence, a gate on the south side
  ['x', -11, -3, -25.5, .7, 'fence', .14], ['z', -25.5, -18, -11, .7, 'fence', .14], ['z', -25.5, -18, -3, .7, 'fence', .14], ['x', -11, -3, -18, .7, 'fence', .14, [[-8, -6]]],
  // the snow fort: a way in from the north and from the east path
  ['x', FORT.x1, FORT.x2, FORT.z1, 1.3, 'snow', .8, [[-18.5, -16.5]]], ['x', FORT.x1, FORT.x2, FORT.z2, 1.3, 'snow', .8], ['z', FORT.z1, FORT.z2, FORT.x1, 1.3, 'snow', .8], ['z', FORT.z1, FORT.z2, FORT.x2, 1.3, 'snow', .8, [[-1.5, 1.5]]],
  // the hedge maze: in from the path at the top, two hedges inside make it wind
  ['x', MAZE.x1, MAZE.x2, MAZE.z1, 1.7, 'hedge', .8, [[-1.5, 1.5]]], ['x', MAZE.x1, MAZE.x2, MAZE.z2, 1.7, 'hedge', .8], ['z', MAZE.z1, MAZE.z2, MAZE.x1, 1.7, 'hedge', .8], ['z', MAZE.z1, MAZE.z2, MAZE.x2, 1.7, 'hedge', .8],
  ['x', -6, 2.5, 17.3, 1.7, 'hedge', .8], ['x', -2.5, 6, 21.6, 1.7, 'hedge', .8],
];
export const TOWERS = [[FORT.x1, FORT.z1], [FORT.x2, FORT.z1], [FORT.x1, FORT.z2], [FORT.x2, FORT.z2]]; // snow towers on the fort's corners, 1.3 m wide
// pieces of a wall between its gaps: [[from, to], ...]
export function wallRuns(w) {
  const gaps = (w[7] || []).slice().sort((p, q) => p[0] - q[0]), out = []; let s = w[1];
  for (const [g1, g2] of gaps) { if (g1 > s) out.push([s, g1]); s = Math.max(s, g2); }
  if (s < w[2]) out.push([s, w[2]]);
  return out;
}

// ---------- scenery that can't be copied: [kind, x, z, turn, size, blocking radius] ----------
const PINES = [[-26, -4], [-26, 6], [-8, -26], [-3, -26.2], [4, -26], [8, -25], [26, -8], [26, 12.5], [-23.4, 23.6], [-9, 26.2], [8, 26.4], [-26, -9.5], [-26.4, 20.5], [25.6, 22.6]];
export const SCENERY = [
  ['tree', 0, 0, 0, 1, TREE_R],
  ...PINES.map(([x, z], i) => ['pine', x, z, i * 1.7, 2.6 + (i * 37 % 10) / 10, .9]),
  ['windmill', 21, -21, -.6, 2.6, 2],
  ['hut', HUT.x, HUT.z, -Math.PI / 2, 2.2, 1.4],
  ['well', 9.5, -9.5, .3, 1.7, 1.05],
  ['campfire', -17.5, 0, 0, 1.8, .8],
  ['boat', POND.x - 2.5, POND.z + 1.2, .5, 1, 0],
  ['dock', POND.x + POND.rx - .6, POND.z - 1, 0, 1, 0],
  ['stall', 12, 10, 0, 1, 0], ['stall', 18, 10, 0, 1, 0], ['stall', 24, 10, 0, 1, 0], ['stall', 12, 16, Math.PI, 1, 0], ['stall', 18, 16, Math.PI, 1, 0],
  ['awning', 20, 23, 0, 1, 0],
];
// extra blocking circles for scenery that isn't round
const STALL_BLOCK = s => [-1.1, 0, 1.1].map(o => [s[1] + o * Math.cos(s[3]), s[2] - o * Math.sin(s[3]), .62]);
export const SCENERY_BLOCKS = [
  ...SCENERY.filter(s => s[0] === 'stall').flatMap(STALL_BLOCK),
  [POND.x - 3.5, POND.z + .6, .8], [POND.x - 1.6, POND.z + 1.7, .8], // the boat
  [17.2, 21.2, .2], [22.8, 21.2, .2], [17.2, 24.8, .2], [22.8, 24.8, .2], // the café awning's posts
];

// ---------- things a hider can copy: [kind, x, z, turn]. Their place in this list is their id. ----------
const R = (i, k = 1) => ((i * 2.399) % 6.283) * k; // steady "random" turns
const AT = (kind, list, turn) => list.map((p, i) => [kind, p[0], p[1], p[2] ?? (turn === undefined ? R(i + kind.length) : turn)]);
export const PROPS = [
  // the square
  ...AT('bench', [[0, -5.4, Math.PI], [0, 5.4, 0], [-5.4, 0, -Math.PI / 2], [5.4, 0, Math.PI / 2]]),
  ...AT('sa', Array.from({ length: 9 }, (_, i) => [Math.cos(i / 9 * 6.283) * 3.4, Math.sin(i / 9 * 6.283) * 3.4])),
  ...AT('birdbath', [[-3.6, -6.4], [3.6, 6.4], [6.4, -3.6], [-6.4, 3.6]], 0),
  ...AT('mailbox', [[3.6, -6.4], [-3.6, 6.4], [6.4, 3.6], [-6.4, -3.6]], 0),
  ...AT('lamp', [[-2.3, -9], [2.3, -9], [-2.3, 9], [2.3, 9], [-9, -2.3], [-9, 2.3], [9, -2.3], [9, 2.3], [-2.3, -20], [2.3, -15], [-25.5, 2.3], [16, 2.3], [-10, 2.3]], 0),
  // the barn, inside and out
  ...AT('haybale', [[-23.6, -22.6, 0], [-22.3, -22.6, 0], [-21, -22.6, 0], [-23.6, -21.2, 1.57], [-16, -22.6, 0], [-14.7, -22.6, 0], [-11.8, -14, 1.57], [-11.8, -15.3, 1.57], [-26, -12, 1.57], [-23.6, -11.6, 0]]),
  ...AT('crate', [[-23.6, -15], [-23.6, -16.2], [-22.5, -14.5]]),
  ...AT('barrel', [[-19, -19], [-18, -19.7], [-14.3, -14.4]]),
  ...AT('bucket', [[-20.8, -16.5], [-21.5, -17.3], [-15, -18.6], [-12, -12]]),
  // the pumpkin patch
  ...AT('pumpkin', [[-9.8, -24.2], [-8.2, -24], [-6.4, -24.4], [-4.6, -24], [-9.6, -22.2], [-7.8, -21.8], [-5.8, -22.3], [-4.4, -20.4], [-9.4, -20], [-7.4, -19.8]]),
  ...AT('scarecrow', [[-5.2, -22], [-12.5, -19.5]], .4),
  // windmill hill
  ...AT('sb', [[16, -16.5], [17.4, -15.4], [15.2, -24.4], [24.4, -15.2]]),
  ...AT('lamp', [[14.4, -14.4], [25.2, -25.2], [14.4, -25.2], [25.2, -14.4]], 0),
  ...AT('bench', [[18.5, -14.6, 0], [24.8, -19, Math.PI / 2]]),
  ...AT('crate', [[17.5, -24.6], [18.6, -24.8], [18, -23.6]]),
  ...AT('rock', [[22.6, -24.4], [15.2, -20]]),
  // the snow fort
  ...AT('sb', [[-20.6, -3.4], [-19.4, -3.6], [-20.8, 3.4], [-14.4, 3.6], [-14.6, -3.4]]),
  ...AT('sa', [[-19.4, 1.8], [-15.6, 2], [-15.2, -1.9]]),
  // the pond
  ...AT('bench', [[-17, 9.3, Math.PI], [-12.5, 9.3, Math.PI], [-21.8, 13, -Math.PI / 2]]),
  ...AT('bush', [[-22.6, 18], [-21, 21.2], [-18, 22.4], [-13.4, 22.4], [-10, 21], [-23.2, 15.4], [-8, 11.4]]),
  ...AT('sb', [[-12, 17.4], [-16, 13.6]]),
  ...AT('bucket', [[-7.4, 13.8], [-8.2, 14.5], [-6.8, 15.6]]),
  ...AT('barrel', [[-6.8, 14.6], [-7.6, 18.4]]),
  ...AT('rock', [[-23.4, 11.4], [-9, 22.6]]),
  // the hedge maze: things along the hedges, the paths between them kept clear
  ...AT('birdbath', [[-4.6, 14.4], [4.6, 14.6], [-4.6, 24.6], [4.6, 24.6]], 0),
  ...AT('shrooms', [[4.6, 19.6], [-1.5, 19.4], [-3.2, 23.6], [-5, 18.6]]),
  ...AT('bush', [[4.9, 22.9], [1.5, 20.5], [-3, 15.6]]),
  ...AT('bench', [[0, 25, Math.PI], [-.8, 16.3, Math.PI]]),
  ...AT('chest', [[-1.7, 25], [1.7, 25]]),
  // the market
  ...AT('crate', [[10.4, 11.7], [11.4, 11.9], [13.8, 11.7], [17, 11.9], [19.6, 12], [22.8, 11.7], [24.6, 13.8], [10.6, 14.3], [13.4, 14.2], [16.6, 14.3], [19.4, 14.4]]),
  ...AT('barrel', [[9, 9], [15, 9], [21, 9], [26, 9.6], [15.2, 17.4], [9.4, 17], [21.4, 17.2]]),
  ...AT('pumpkin', [[12.2, 12.2], [18.2, 12.3], [24.4, 12.6], [9.4, 13], [26, 15]]),
  ...AT('chest', [[24, 16.8], [11.6, 13.9]]),
  // the café
  ...AT('table', [[18.4, 22.2], [21.6, 22.2], [18.4, 24.6], [21.6, 24.6], [12.4, 23], [14.6, 25.4]], 0),
  ...AT('chair', [[17.4, 22.2, 1.57], [19.4, 22.2, -1.57], [20.6, 22.2, 1.57], [22.6, 22.2, -1.57], [17.4, 24.6, 1.57], [19.4, 24.6, -1.57], [20.6, 24.6, 1.57], [22.6, 24.6, -1.57], [11.4, 23, 1.57], [13.4, 23, -1.57], [13.6, 25.4, 1.57], [15.6, 25.4, -1.57]]),
  ...AT('birdbath', [[9.2, 25.6], [23.4, 24.6], [25.8, 20.6]], 0),
  // round the edges
  ...AT('bush', [[-26, -16], [-26, 13], [-1.6, -26], [26, -2], [26, 7], [26.4, 18.2], [-6, -12], [6, -12], [-26, 23]]),
  ...AT('rock', [[-11, 6], [11, -5.5], [-6.5, 10.5], [26, -11.4]]),
];
export const SEASONAL = new Set(['sa', 'sb']);

// ---------- blocking ----------
// Every circle you can't walk into: wall runs every half metre, scenery, the copyable things. [x, z, r]
let BLOCKS = null;
export function blocks() {
  if (BLOCKS) return BLOCKS;
  const out = [];
  for (const w of WALLS) for (const [a, b] of wallRuns(w)) for (let t = a + .25; t <= b - .2; t += .5) out.push(w[0] === 'x' ? [t, w[3], w[6] / 2 + .12] : [w[3], t, w[6] / 2 + .12]);
  for (const [x, z] of TOWERS) out.push([x, z, .9]);
  for (const s of SCENERY) if (s[5] > 0) out.push([s[1], s[2], s[5]]);
  out.push(...SCENERY_BLOCKS);
  // the hill's cliff, except where the ramp comes up, and the ramp's sides
  for (let z = HILL.z1 + .25; z < HILL.z2; z += .5) if (z < RAMP.z1 - .2 || z > RAMP.z2 + .2) out.push([HILL.x1, z, .3]);
  for (let x = HILL.x1 + .25; x < HILL.x2; x += .5) out.push([x, HILL.z2, .3]);
  for (let x = RAMP.x1; x < RAMP.x2; x += .5) out.push([x, RAMP.z1 - .15, .2], [x, RAMP.z2 + .15, .2]);
  for (const [k, x, z] of PROPS) out.push([x, z, KINDS[k].r]);
  // a grid of buckets so a step only looks at the circles near it
  BLOCKS = { list: out, grid: new Map() };
  for (const b of out) { const c0 = Math.floor((b[0] - b[2] - 1) / 4), c1 = Math.floor((b[0] + b[2] + 1) / 4), r0 = Math.floor((b[1] - b[2] - 1) / 4), r1 = Math.floor((b[1] + b[2] + 1) / 4);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { const k = c * 1000 + r; let a = BLOCKS.grid.get(k); if (!a) BLOCKS.grid.set(k, a = []); a.push(b); } }
  return BLOCKS;
}
const near = (x, z) => blocks().grid.get(Math.floor(x / 4) * 1000 + Math.floor(z / 4)) || [];
// The island's corners are rounded (scenery3d island(): a quadratic curve r = 30% of the half width): a point is on
// the island, m metres in from its edge, when it is inside that outline shrunk by m.
const CORNER = SIZE * .3;
export function onIsle(x, z, m = .6) {
  const W = SIZE - m, a = Math.abs(x) - (W - CORNER), b = Math.abs(z) - (W - CORNER);
  if (Math.abs(x) > W || Math.abs(z) > W) return false;
  if (a <= 0 || b <= 0) return true;
  return Math.sqrt(1 - a / CORNER) + Math.sqrt(1 - b / CORNER) >= 1;
}
export function blocked(x, z, r = BODY_R) {
  if (!onIsle(x, z)) return true;
  for (const b of near(x, z)) if ((x - b[0]) ** 2 + (z - b[1]) ** 2 < (b[2] + r) ** 2) return true;
  return false;
}
// One step of walking from (x, z) by (dx, dz): slides along whatever is in the way. Returns [x, z].
// Already overlapping something (copying a big thing next to it makes you wider): any step that does not go deeper in
// is allowed, so you can always walk out.
export function depth(x, z, r = BODY_R) {
  if (!onIsle(x, z)) return 9;
  let d = 0; for (const b of near(x, z)) d = Math.max(d, b[2] + r - Math.hypot(x - b[0], z - b[1]));
  return d;
}
export function walk(x, z, dx, dz, r = BODY_R) {
  const d0 = blocked(x, z, r) ? depth(x, z, r) : 0, ok = (a, b) => d0 > 0 ? depth(a, b, r) <= d0 + 1e-6 : !blocked(a, b, r);
  if (ok(x + dx, z + dz)) return [x + dx, z + dz];
  if (ok(x + dx, z)) return [x + dx, z];
  if (ok(x, z + dz)) return [x, z + dz];
  return [x, z];
}

// ---------- where people start ----------
// Hiders spread round the square; seekers wait by the pet hut with their eyes covered.
export const hiderSpawn = i => {
  for (let k = 0; k < 24; k++) { const a = i * 2.399 + .4 + k * .07, r = 9.6 + (i % 3) * .9, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!blocked(x, z, BODY_R + .2)) return [x, z]; }
  return [0, 8];
};
export const seekerSpawn = i => [HUT.x - 3.2, HUT.z - 1.2 + i * 1.4];

// A free spot to hide as kind k near another thing of the same kind (bots, and tests). rnd: () => 0..1.
export function spotFor(k, rnd, taken = []) {
  const same = PROPS.filter(p => p[0] === k);
  for (let n = 0; n < 80; n++) {
    const p = same[Math.floor(rnd() * same.length)], a = rnd() * 6.283, d = KINDS[k].r * 2 + .25 + rnd() * 1.1;
    const x = p[1] + Math.cos(a) * d, z = p[2] + Math.sin(a) * d;
    const y = heightAt(x, z);
    if (blocked(x, z, KINDS[k].r + .12) || y !== heightAt(p[1], p[2]) || (y > 0 && y < HILL.h)) continue; // same ground as the real one, never on the ramp
    if (Math.hypot(x - HUT.x, z - HUT.z) < 7 || taken.some(t => Math.hypot(t[0] - x, t[1] - z) < KINDS[k].r * 2 + .3)) continue;
    return [x, z, p[3] + (rnd() - .5) * .5];
  }
  return null;
}

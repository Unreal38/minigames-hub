// The Plaza's map, shared by the page and the server (no three.js here): how big the island is, where things stand,
// what blocks the way, where people can sit, and the lists of emotes and tree ornaments.
// Units are metres of the 3D scene. An avatar is about 1.7 tall. +z is towards the camera (south).

export const CAP = 24;          // people in one plaza room
export const R_WALK = 19.2;     // you can walk this far from the middle
export const R_ISLE = 20.5;     // the lawn's edge
export const R_SQUARE = 11.2;   // the paved square round the middle
export const SPEED = 5.2;       // walking, metres a second
export const SPAWN = [0, 12.6]; // newcomers appear here, just inside the arch, spread a little
export const Q = 20;            // positions travel as whole numbers: metres x Q
export const TREE_R = 3.5;      // the middle piece (Christmas tree in winter, fountain otherwise) blocks this much

// The look of the season. Winter (the shop's winter drop dates): snow and the Christmas tree.
export const themeOf = (month, day) => { const at = month * 100 + day; return at >= 1115 || at <= 228 ? 'winter' : 'meadow'; };

// Things standing on the island: [kind, x, z, turn (radians), size, blocking radius (0 = walk through)].
// Kinds are Pet Farm decorations (itemModel), except the ones scene3d.js builds itself: stage, snowman, gifts.
const ring = (n, r, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r, a]; });
export const BENCHES = ring(6, 7.6, Math.PI / 6).map(([x, z, a]) => ({ x, z, ry: Math.atan2(-x, -z) }));
export const FIRE = [12.6, 10.2], STAGE = [-12.4, 10.2, .78], HAY = ring(5, 2.5, .5).map(([x, z, a]) => ({ x: FIRE[0] + x, z: FIRE[1] + z, ry: Math.atan2(-x, -z) }));
export const LAMPS = ring(10, R_SQUARE + .6, Math.PI / 10);
export const CAROUSEL = ['carousel', -12.6, -10.4, .3, 1.9, 2.2];
export const SWING = ['swing', 16.4, .4, -Math.PI / 2, 1.8, 1];
export const THINGS = [
  ...BENCHES.map(b => ['bench', b.x, b.z, b.ry, 1.7, .9]),
  ['campfire', FIRE[0], FIRE[1], 0, 2.1, .9],
  ...HAY.map(h => ['haybale', h.x, h.z, h.ry, 1.5, .7]),
  ['gazebo', 12.6, -10.4, -.75, 1.9, 0],
  CAROUSEL,
  ['hotspring', 0, -15.2, 0, 1.9, 2.1],
  ['arch', 0, 17.6, 0, 2.2, 0],
  SWING,
  ['well', -16.4, .6, 0, 1.7, 1.1],
  ['balloon', -15.4, 6.6, 0, 1.7, 1],
  ['goldpet', 5.6, -15.6, -.2, 1.7, .9],
  ['chest', 8.6, -14.6, .5, 1.7, .6],
  ['lighthouse', -6.4, -15.4, 0, 1.8, .9],
  ['windmill', 16.2, -5.4, -1.1, 1.8, 1],
  ['treehouse', -16.2, -5.2, .9, 1.7, 1.9],
  ['miniwheel', 15.6, 6.2, -1.2, 1.7, .8],
  ...LAMPS.map(([x, z], i) => [i % 2 ? 'lamp' : 'glow', x, z, 0, 1.9, .35]),
];
// Only in winter / only in the green season.
export const WINTER = [['snowman', 4.2, 15.2, -.3, 1, .8], ['snowman', -16.2, -1.9, 1.2, 1, .8], ['snowman', 16.6, -2.6, -1.3, 1.1, .8], ['snowman', -4.6, 15.6, .4, .85, .7],
  ['gifts', -9.6, -15.2, 0, 1, .9], ['gifts', 9.4, 15.4, 1, 1, .9]];
export const MEADOW = [['flowers', 4.2, 15.2, 0, 1.8, 0], ['flowers', -4.6, 15.6, 1, 1.8, 0], ['cherry', -9.6, -15.2, 0, 1.9, .5], ['cherry', 9.4, 15.4, 0, 1.9, .5],
  ['picnic', -16.2, -1.9, .4, 1.9, 0], ['flowers', 16.6, -2.6, 2, 1.8, 0]];

// Everything standing on the island in a season, in one list: a poke names a thing by its place here (the middle
// piece, tree or fountain, is one past the end).
export const thingsOf = theme => [...THINGS, ...(theme === 'winter' ? WINTER : MEADOW)];
export const POKE_REACH = 2.6, POKE_WAIT = 700; // how near you must stand to poke a thing, and how often you may
// What floats up from a poked thing, by kind.
export const POKE = { bench: '🪑', campfire: '🔥', haybale: '🌾', gazebo: '🎶', carousel: '🎠', hotspring: '♨️', arch: '💐', swing: '😄', well: '🪙', balloon: '🎈', goldpet: '✨', chest: '💎', lighthouse: '💡', windmill: '🌬️',
  treehouse: '🐦', miniwheel: '🎡', lamp: '💡', glow: '💡', snowman: '⛄', gifts: '🎁', flowers: '🌼', cherry: '🌸', picnic: '🧺', fountain: '💦', tree: '🎄' };

// What blocks walking: circles [x, z, r]. The page slides you round them; the server only checks the island's edge
// and the middle piece, so a slow phone never gets tugged back for brushing a bench.
export const blocksOf = theme => [[0, 0, TREE_R], ...[...THINGS, ...(theme === 'winter' ? WINTER : MEADOW)].filter(t => t[5] > 0).map(t => [t[1], t[2], t[5]])];

// Places to sit: [x, z, facing, seat height, kind]. Two on every bench, one on every hay bale by the fire.
export const SPOTS = [
  ...BENCHES.flatMap(b => [-.42, .42].map(s => ({ x: b.x + Math.cos(b.ry) * s, z: b.z - Math.sin(b.ry) * s, ry: b.ry, y: .62, k: 'bench' }))),
  ...HAY.map(h => ({ x: h.x, z: h.z, ry: h.ry, y: .62, k: 'hay' })),
  // the carousel's four horses: riders go round with it (scene3d.js), so the place here is only the carousel's middle
  ...[0, 1, 2, 3].map(n => ({ x: CAROUSEL[1], z: CAROUSEL[2], ry: 0, y: 0, k: 'ride', n, reach: CAROUSEL[5] + 2 })),
  { x: SWING[1], z: SWING[2], ry: SWING[3], y: 0, k: 'swing', reach: SWING[5] + 2 }, // the swing: one rider, rocking with it
];
export const SPOT_REACH = 2.4; // how near you must stand to take a seat

// Emotes: body animations. `loop` ones last until you walk off; the others play once for `ms`.
export const EMOTES = [null,
  { id: 'wave', e: '👋', ms: 2400 }, { id: 'dance', e: '💃', loop: true }, { id: 'sit', e: '🪑', loop: true },
  { id: 'jump', e: '🦘', ms: 900 }, { id: 'cheer', e: '🙌', ms: 2200 }, { id: 'trick', e: '🐾', ms: 2000 },
  // the ones that are bought, seasonal or earned by visiting (cosmetics.js COS.em, same order: only append)
  { id: 'clap', e: '👏', ms: 2000 }, { id: 'bow', e: '🙇', ms: 1800 }, { id: 'spin', e: '🌀', ms: 1500 }, { id: 'laugh', e: '😂', ms: 2400 },
  { id: 'nap', e: '😴', loop: true }, { id: 'heart', e: '💖', ms: 2200 }, { id: 'angel', e: '👼', loop: true }, { id: 'shiver', e: '🥶', ms: 2200 },
  { id: 'flip', e: '🤸', ms: 1100 }, { id: 'robot', e: '🤖', loop: true }, { id: 'stars', e: '🌟', ms: 2400 }];

// Throwing: a snowball in winter, a soft ball otherwise. Only for fun: a hit is a puff and a wobble.
export const THROW_RANGE = 13, THROW_HIT = .95, THROW_WAIT = 1200;
export const throwMs = d => 380 + d * 42; // how long a throw of d metres flies

// Tree ornaments an account can hang (one each). Index 0 = none. The tree has SLOTS places.
export const ORNAMENTS = [null, { id: 'red', c: '#e5543b' }, { id: 'gold', c: '#ffc93c' }, { id: 'blue', c: '#4aa8f0' }, { id: 'pink', c: '#ff8fc7' }, { id: 'silver', c: '#dfe6f2' },
  { id: 'star', c: '#ffd34d' }, { id: 'bell', c: '#f2b92e' }, { id: 'cane', c: '#ffffff' }, { id: 'ginger', c: '#c98548' }, { id: 'snow', c: '#bfe9ff' }];
export const SLOTS = 120;
export const TREE_H = 9.6;      // the Christmas tree's height, to the foot of its star
export const TREE_REACH = 7.5;  // stand this near the middle to hang an ornament
// The tree is seven tiers of branches; TIERS[k] = [rim radius, rim height], bottom first. scene3d.js builds it from these.
export const TIERS = Array.from({ length: 7 }, (_, k) => [3.4 - k * .47, 1.5 + k * 1.05]);
// Ornaments hang from the rims: more on the wide bottom tiers than on the narrow top ones.
const HOOKS = (() => {
  const sum = TIERS.reduce((n, t) => n + t[0], 0), out = []; let left = SLOTS;
  TIERS.forEach(([r, y], k) => { const n = k === TIERS.length - 1 ? left : Math.round(SLOTS * r / sum); left -= n;
    for (let j = 0; j < n; j++) { const a = (j + (k % 2) * .5) / n * Math.PI * 2; out.push([Math.cos(a) * (r - .12), y - .08, Math.sin(a) * (r - .12)]); } });
  return out;
})();
// Where slot i hangs. Neighbouring slot numbers land far apart, so a half-empty tree is dressed evenly.
export const slotPos = i => HOOKS[(i * 61) % SLOTS];

export const clampWalk = (x, z) => { // keep a point on the island and out of the middle piece
  let d = Math.hypot(x, z);
  if (d > R_WALK) { x *= R_WALK / d; z *= R_WALK / d; d = R_WALK; }
  if (d < TREE_R) { if (d < 1e-3) { x = 0; z = TREE_R; } else { x *= TREE_R / d; z *= TREE_R / d; } }
  return [x, z];
};

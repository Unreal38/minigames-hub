import { L } from '../../i18n.js';
// Cozy Kitchen Rush rules shared by the server and the client: the kitchens, the recipes, how avatars move
// round the counters, and which counter you are reaching for. Positions are in tiles: (0, 0) is the top left
// corner of the map and tile (c, r) has its centre at (c + .5, r + .5).

// Map key: '.' floor, '#' counter, 'C' chopping board, 'S' stove with a soup pot, 'F' stove with a frying pan,
// 'D' plate rack, 'W' serving window, 'X' bin, and ingredient crates: T tomato, L lettuce, M mushroom, B bun, P patty.
export const KITCHENS = {
  diner: {
    name: L('Sunny Diner', 'Słoneczny bar'),
    rows: [
      '#TLMB#SS#FF#',
      '#..........W',
      'C..........W',
      'C..#D##....#',
      'P..####....#',
      'C..........#',
      '#..........X',
      '####DD######',
    ],
  },
  split: {
    name: L('Pass-Through', 'Kuchnia z okienkiem'),
    rows: [
      '#TLMBP#SSFF#',
      '#.....#....W',
      'C.....D....W',
      'C.....#....#',
      '#..........#',
      'C.....#....#',
      '#.....#....X',
      '####D#######',
    ],
  },
};
export const CRATES = { T: 'tomato', L: 'lettuce', M: 'mushroom', B: 'bun', P: 'patty' };
export const CHOPPABLE = new Set(['tomato', 'lettuce', 'mushroom']);
export const SOUPS = new Set(['tomato', 'mushroom']);

export const RECIPES = {
  salad: { name: L('Garden salad', 'Sałatka ogrodowa'), has: ['lettuce', 'tomato'], tip: 20, life: 60, w: 3 },
  burger: { name: 'Burger', has: ['bun', 'patty'], tip: 24, life: 65, w: 3 },
  tsoup: { name: L('Tomato soup', 'Zupa pomidorowa'), soup: 'tomato', tip: 30, life: 80, w: 2 },
  msoup: { name: L('Mushroom soup', 'Zupa grzybowa'), soup: 'mushroom', tip: 30, life: 80, w: 2 },
  deluxe: { name: L('Deluxe burger', 'Burger deluxe'), has: ['bun', 'patty', 'lettuce', 'tomato'], tip: 40, life: 90, w: 1, after: 30 },
};

// timings in seconds
export const T = {
  chop: 2.2,      // to chop one ingredient
  soup: 8,        // a full pot (3 pieces) to cook
  soupBurn: 2.25, // pot.cook at which the soup burns (cook 1 = ready)
  patty: 6,       // a patty to fry
  pattyBurn: 2.2, // patty cook at which it burns
  count: 3,       // countdown before the shift
};
export const SPEED = 4.2, RAD = .3, REACH = 1.65;

const cache = new Map();
export function kitchen(id) {
  if (cache.has(id)) return cache.get(id);
  const def = KITCHENS[id] || KITCHENS.diner, t = def.rows.map(r => [...r]);
  const K = { id: KITCHENS[id] ? id : 'diner', name: def.name, t, rows: t.length, cols: t[0].length, cells: [] };
  for (let r = 0; r < K.rows; r++) for (let c = 0; c < K.cols; c++) if (t[r][c] !== '.') K.cells.push({ c, r, k: t[r][c], key: c + ',' + r });
  cache.set(id, K);
  return K;
}
export const tileAt = (K, c, r) => (r < 0 || c < 0 || r >= K.rows || c >= K.cols ? '#' : K.t[r][c]);
export const isFloor = (K, c, r) => tileAt(K, c, r) === '.';

// Push a round avatar out of every counter it overlaps.
export function pushOut(K, x, z, R = RAD) {
  for (let pass = 0; pass < 2; pass++) {
    const c0 = Math.floor(x), r0 = Math.floor(z);
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (isFloor(K, c, r)) continue;
      const nx = Math.max(c, Math.min(c + 1, x)), nz = Math.max(r, Math.min(r + 1, z));
      const dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz);
      if (d >= R) continue;
      if (d > 1e-6) { x = nx + dx / d * R; z = nz + dz / d * R; }
      else { // centre inside the counter: out the nearest side
        const o = [[c - R - x, 0], [c + 1 + R - x, 0], [0, r - R - z], [0, r + 1 + R - z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]))[0];
        x += o[0]; z += o[1];
      }
    }
  }
  return [x, z];
}
// Move by (dx, dz), sliding along counters. Big steps go in small pieces so nobody tunnels through a counter.
export function move(K, x, z, dx, dz) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
  for (let i = 0; i < n; i++) [x, z] = pushOut(K, x + dx / n, z + dz / n);
  return [x, z];
}

// The counter an avatar at (x, z) facing angle f reaches for: close by and roughly in front.
export function target(K, x, z, f) {
  const fx = Math.sin(f), fz = Math.cos(f);
  let best = null, bs = -Infinity;
  for (let r = Math.floor(z) - 2; r <= Math.floor(z) + 2; r++) for (let c = Math.floor(x) - 2; c <= Math.floor(x) + 2; c++) {
    if (r < 0 || c < 0 || r >= K.rows || c >= K.cols || isFloor(K, c, r)) continue;
    const dx = c + .5 - x, dz = r + .5 - z, d = Math.hypot(dx, dz);
    if (d > 1.45) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < .15) continue;
    const s = dot * 1.2 - d;
    if (s > bs) { bs = s; best = { c, r, key: c + ',' + r }; }
  }
  return best;
}
export const inReach = (x, z, c, r) => Math.hypot(c + .5 - x, r + .5 - z) <= REACH;

// What an item adds to a plate, or null if it can't go on one.
export function token(it) {
  if (!it || it.k === 'plate') return null;
  if (it.k === 'bun') return 'bun';
  if (it.k === 'patty') return it.ck >= 1 && it.ck < T.pattyBurn ? 'patty' : null;
  if (CHOPPABLE.has(it.k)) return it.ch ? it.k : null;
  return null;
}
// Can this token go on this plate and still be on the way to some recipe?
export function fits(plate, tok) {
  if (!tok || plate.soup) return false;
  const want = [...plate.has, tok];
  return Object.values(RECIPES).some(r => r.has && want.every(w => want.filter(x => x === w).length <= r.has.filter(x => x === w).length));
}
// Does this plate fill this recipe exactly?
export function matches(plate, key) {
  const r = RECIPES[key];
  if (!plate || plate.k !== 'plate' || !r) return false;
  if (r.soup) return plate.soup === r.soup;
  if (plate.soup || plate.has.length !== r.has.length) return false;
  return [...plate.has].sort().join() === [...r.has].sort().join();
}
// The stars a shift earns: tip goals grow with the shift's length and the number of cooks.
export function goals(secs, cooks) {
  const k = secs / 180 * (.6 + .4 * cooks);
  return [60, 140, 230].map(v => Math.round(v * k / 5) * 5);
}

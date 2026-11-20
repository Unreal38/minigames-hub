// Pet Farm: everything the server and the client must agree on. Balance changes are edits to this file.
// A farm is a square grid of tiles. An item sits at tile (x, y) with a rotation r (0-3, quarter turns).

export const SIZES = [10, 12, 14, 16, 18];
// Cost of growing the land to SIZES[i].
export const EXPAND = [null, { wood: 40, stone: 30 }, { wood: 80, stone: 60, fiber: 30 }, { wood: 140, stone: 110, fiber: 60 }, { wood: 220, stone: 180, fiber: 100 }];
export const MATS = { wood: 'Wood', stone: 'Stone', fiber: 'Fiber', coins: 'Coins' };
export const START_INV = { wood: 150, stone: 100, fiber: 80, coins: 100 };
// Until expeditions exist, a supply crate keeps builders stocked.
export const CRATE = { every: 4 * 3600_000, gives: { wood: 40, stone: 30, fiber: 20, coins: 15 } };
export const MAX_ITEMS = 300;

// kind: 'b' building, 'd' decoration. w x h is the footprint before rotation. max = how many a farm may hold.
// fine: a small prop that snaps to half tiles (its w and h may be .5). Everything else sits on whole tiles.
// walk: pets can stroll across it. soon: what it will do once that part of the game arrives.
export const ITEMS = {
  house:    { name: 'Farmhouse', kind: 'b', w: 3, h: 3, max: 1, fixed: true, cost: {}, desc: 'Home sweet home. Its level will decide how far everything else can be upgraded.' },
  hut:      { name: 'Pet Hut', kind: 'b', w: 2, h: 2, max: 3, cost: { wood: 30, fiber: 10 }, desc: 'A snug place for four pets to sleep.' },
  gate:     { name: 'Expedition Gate', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 25, stone: 15 }, desc: 'Pets set off on expeditions from here.', soon: 'Expeditions arrive in the next update.' },
  garden:   { name: 'Garden Plot', kind: 'b', w: 1, h: 1, max: 8, cost: { wood: 5, fiber: 5 }, desc: 'A patch of soil for growing berries.', soon: 'Berries will grow here soon.' },
  kitchen:  { name: 'Kitchen', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 30, stone: 20 }, desc: 'Turns berries into treats.', soon: 'Cooking arrives with berries.' },
  barn:     { name: 'Storage Barn', kind: 'b', w: 2, h: 3, max: 1, cost: { wood: 45, stone: 10 }, desc: 'Room for more materials.', soon: 'Storage limits arrive with expeditions.' },
  nest:     { name: 'Nest', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 20, fiber: 30 }, desc: 'Two pets rest here and an egg appears.', soon: 'Breeding arrives in a later update.' },
  yard:     { name: 'Training Yard', kind: 'b', w: 3, h: 2, max: 1, cost: { wood: 25, stone: 25 }, desc: 'Pets practise their moves here.', soon: 'Training arrives with battles.' },
  flag:     { name: 'Arena Flag', kind: 'b', w: 1, h: 1, max: 1, cost: { wood: 10, fiber: 10 }, desc: 'Friends challenge your team here.', soon: 'Battles arrive in a later update.' },
  mailbox:  { name: 'Mailbox', kind: 'b', w: 1, h: 1, max: 1, cost: { wood: 8 }, desc: 'Gifts and letters from friends land here.', soon: 'Friends arrive in a later update.' },
  workshop: { name: 'Workshop', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 35, stone: 25 }, desc: 'Crafts fancier decorations.', soon: 'Crafting arrives in a later update.' },

  fence:    { name: 'Fence', kind: 'd', w: 1, h: 1, cost: { wood: 2 }, desc: 'Keeps things tidy.' },
  path:     { name: 'Stone Path', kind: 'd', w: 1, h: 1, walk: true, cost: { stone: 1 }, desc: 'Pets like to stroll along it.' },
  tree:     { name: 'Leafy Tree', kind: 'd', w: .5, h: .5, fine: true, cost: { coins: 8 }, desc: 'A bit of shade.' },
  pine:     { name: 'Pine Tree', kind: 'd', w: .5, h: .5, fine: true, cost: { coins: 8 }, desc: 'Smells like a walk in the woods.' },
  bush:     { name: 'Bush', kind: 'd', w: .5, h: .5, fine: true, cost: { coins: 4 }, desc: 'Round and friendly.' },
  flowers:  { name: 'Flower Bed', kind: 'd', w: .5, h: .5, fine: true, walk: true, cost: { fiber: 3 }, desc: 'A splash of colour.' },
  lamp:     { name: 'Lantern', kind: 'd', w: .5, h: .5, fine: true, cost: { wood: 4, stone: 2 }, desc: 'A warm little light.' },
  pond:     { name: 'Pond', kind: 'd', w: 2, h: 2, cost: { stone: 12 }, desc: 'Cool water with a lily pad.' },
  bench:    { name: 'Bench', kind: 'd', w: 1, h: .5, fine: true, cost: { wood: 8 }, desc: 'For watching pets go by.' },
  rock:     { name: 'Mossy Rock', kind: 'd', w: .5, h: .5, fine: true, cost: { stone: 4 }, desc: 'It has always been here, probably.' },
  ball:     { name: 'Pet Ball', kind: 'd', w: .5, h: .5, fine: true, walk: true, cost: { fiber: 6 }, desc: 'A toy for the pets.' },
};

export const ELEMENTS = { Leaf: '#3f9a52', Ember: '#e0592f', Tide: '#2f86cc', Spark: '#d9a400', Stone: '#8a7f76' };
// Only the three starters have models so far. The rest of the roster joins with expeditions and breeding.
export const SPECIES = {
  mossbun:   { name: 'Mossbun', el: 'Leaf', blurb: 'A bunny whose back grows a coat of moss.' },
  cindercub: { name: 'Cindercub', el: 'Ember', blurb: 'A fox cub with a tail that flickers like a flame.' },
  puddlepup: { name: 'Puddlepup', el: 'Tide', blurb: 'A seal pup that carries its own puddle around.' },
};
export const STARTERS = ['mossbun', 'cindercub', 'puddlepup'];
export const FORMS = ['Baby', 'Young', 'Adult'];
export const formOf = lv => lv < 5 ? 0 : lv < 12 ? 1 : 2;

export const footprint = (type, r) => { const it = ITEMS[type]; return r % 2 ? [it.h, it.w] : [it.w, it.h]; };
export const canAfford = (inv, cost) => Object.entries(cost || {}).every(([k, n]) => (inv[k] || 0) >= n);
export const costText = cost => Object.entries(cost || {}).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ') || 'Free';

// Placement is checked on a grid of half tiles, so small props can share a tile.
// Returns that grid (2n x 2n). With walkable = true, items pets can cross count as free.
export function occupied(farm, { ignore = null, walkable = false } = {}) {
  const n = farm.size * 2, g = new Uint8Array(n * n);
  for (const it of farm.items) {
    if (it.id === ignore || !ITEMS[it.type] || (walkable && ITEMS[it.type].walk)) continue;
    const [w, h] = footprint(it.type, it.r), x0 = Math.round(it.x * 2), y0 = Math.round(it.y * 2);
    for (let y = y0; y < y0 + h * 2; y++) for (let x = x0; x < x0 + w * 2; x++) if (x >= 0 && y >= 0 && x < n && y < n) g[y * n + x] = 1;
  }
  return g;
}
// Whole tiles a pet cannot walk on: any tile with something solid on part of it.
export function blockedTiles(farm) {
  const n = farm.size, h = occupied(farm, { walkable: true }), g = new Uint8Array(n * n);
  for (let y = 0; y < n * 2; y++) for (let x = 0; x < n * 2; x++) if (h[y * n * 2 + x]) g[(y >> 1) * n + (x >> 1)] = 1;
  return g;
}
export const stepOf = type => ITEMS[type]?.fine ? .5 : 1;

// Would this item fit at (x, y)? ignore = id of the item being moved.
export function fits(farm, type, x, y, r, ignore = null) {
  if (!ITEMS[type] || !Number.isInteger(r) || r < 0 || r > 3) return false;
  const st = stepOf(type);
  if (![x, y].every(v => typeof v === 'number' && Number.isInteger(v / st))) return false;
  const [w, h] = footprint(type, r), n = farm.size;
  if (x < 0 || y < 0 || x + w > n || y + h > n) return false;
  const g = occupied(farm, { ignore }), n2 = n * 2;
  for (let j = y * 2; j < (y + h) * 2; j++) for (let i = x * 2; i < (x + w) * 2; i++) if (g[j * n2 + i]) return false;
  return true;
}
export const countOf = (farm, type) => farm.items.filter(i => i.type === type).length;

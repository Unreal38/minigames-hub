// Pet Farm: everything the server and the client must agree on. Balance changes are edits to this file.
// A farm is a square grid of tiles. An item sits at tile (x, y) with a rotation r (0-3, quarter turns).

export const SIZES = [10, 12, 14, 16, 18];
// Cost of growing the land to SIZES[i].
export const EXPAND = [null, { wood: 40, stone: 30 }, { wood: 80, stone: 60, fiber: 30 }, { wood: 140, stone: 110, fiber: 60 }, { wood: 220, stone: 180, fiber: 100 }];
export const MATS = { wood: 'Wood', stone: 'Stone', fiber: 'Fiber', shells: 'Shells', coal: 'Coal', crystal: 'Crystal', coins: 'Coins' };
export const START_INV = { wood: 150, stone: 100, fiber: 80, coins: 100 };
export const MAX_ITEMS = 300;

// kind: 'b' building, 'd' decoration. w x h is the footprint before rotation. max = how many a farm may hold.
// fine: a small prop that snaps to half tiles (its w and h may be .5). Everything else sits on whole tiles.
// walk: pets can stroll across it. soon: what it will do once that part of the game arrives.
export const ITEMS = {
  house:    { name: 'Farmhouse', kind: 'b', w: 3, h: 3, max: 1, fixed: true, cost: {}, desc: 'Home sweet home. A bigger farmhouse opens up new places to explore.' },
  hut:      { name: 'Pet Hut', kind: 'b', w: 2, h: 2, max: 3, cost: { wood: 30, fiber: 10 }, desc: 'A snug place for four more pets to sleep.' },
  gate:     { name: 'Expedition Gate', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 25, stone: 15 }, desc: 'Pets set off by balloon from here and come back with materials, and sometimes a new friend.' },
  garden:   { name: 'Garden Plot', kind: 'b', w: 1, h: 1, max: 8, cost: { wood: 5, fiber: 5 }, desc: 'A patch of soil for growing berries.', soon: 'Berries will grow here soon.' },
  kitchen:  { name: 'Kitchen', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 30, stone: 20 }, desc: 'Turns berries into treats.', soon: 'Cooking arrives with berries.' },
  barn:     { name: 'Storage Barn', kind: 'b', w: 2, h: 3, max: 1, cost: { wood: 45, stone: 10 }, desc: 'Room for more materials.', soon: 'Storage limits arrive in a later update.' },
  nest:     { name: 'Nest', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 20, fiber: 30 }, desc: 'Two pets rest here and an egg appears.', soon: 'Breeding arrives in a later update.' },
  yard:     { name: 'Training Yard', kind: 'b', w: 3, h: 2, max: 1, cost: { wood: 25, stone: 25 }, desc: 'Pets practise their moves here against friendly partners.' },
  flag:     { name: 'Arena Flag', kind: 'b', w: 1, h: 1, max: 1, cost: { wood: 10, fiber: 10 }, desc: 'Challenge other farms here, and choose the team that defends yours.' },
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
// rare: 0 common, 1 uncommon, 2 rare. Breeding-only hybrids join with breeding.
export const SPECIES = {
  mossbun:   { name: 'Mossbun', el: 'Leaf', rare: 0, blurb: 'A bunny whose back grows a coat of moss.' },
  sproutle:  { name: 'Sproutle', el: 'Leaf', rare: 0, blurb: 'A turtle with a sprout growing on its shell.' },
  petalpuff: { name: 'Petalpuff', el: 'Leaf', rare: 1, blurb: 'A fluffy sheep that wears a crown of flowers.' },
  cindercub: { name: 'Cindercub', el: 'Ember', rare: 0, blurb: 'A fox cub with a tail that flickers like a flame.' },
  toastoad:  { name: 'Toastoad', el: 'Ember', rare: 0, blurb: 'A toad as warm and golden as fresh toast.' },
  flickit:   { name: 'Flickit', el: 'Ember', rare: 2, blurb: 'A chick with a candle flame on its head.' },
  puddlepup: { name: 'Puddlepup', el: 'Tide', rare: 0, blurb: 'A seal pup that carries its own puddle around.' },
  bubblefin: { name: 'Bubblefin', el: 'Tide', rare: 0, blurb: 'A round fish that floats along in a bubble.' },
  axolily:   { name: 'Axolily', el: 'Tide', rare: 2, blurb: 'An axolotl with lily pads for gills.' },
  zapkit:    { name: 'Zapkit', el: 'Spark', rare: 0, blurb: 'A kitten with a lightning bolt for a tail.' },
  buzzlet:   { name: 'Buzzlet', el: 'Spark', rare: 1, blurb: 'A chubby bee covered in static fuzz.' },
  voltvole:  { name: 'Voltvole', el: 'Spark', rare: 2, blurb: 'A hamster whose cheeks glow when it is happy.' },
  pebblet:   { name: 'Pebblet', el: 'Stone', rare: 0, blurb: 'A hedgehog with pebbles for spines.' },
  cragcrab:  { name: 'Cragcrab', el: 'Stone', rare: 1, blurb: 'A crab that carries a boulder for a shell.' },
  dustmole:  { name: 'Dustmole', el: 'Stone', rare: 2, blurb: 'A mole that never takes off its tiny hard hat.' },
};
export const RARITY = ['Common', 'Uncommon', 'Rare'];
export const STARTERS = ['mossbun', 'cindercub', 'puddlepup'];
export const FORMS = ['Baby', 'Young', 'Adult'];
export const formOf = lv => lv < 5 ? 0 : lv < 12 ? 1 : 2;
export const MAX_LV = 20;
export const xpFor = lv => 10 + lv * 10; // experience needed to go from lv to lv + 1
// The farmhouse sleeps two pets and every Pet Hut four more.
export const petRoom = farm => 2 + 4 * farm.items.filter(i => i.type === 'hut').length;

// The farmhouse: HOUSE_UP[n] is the cost of reaching level n.
export const HOUSE_MAX = 4;
export const HOUSE_UP = [null, null, { wood: 60, stone: 40, fiber: 30 }, { wood: 120, stone: 90, shells: 30 }, { wood: 200, stone: 150, shells: 40, coal: 40 }];

// ---------- expeditions ----------
// A party of 1 to 3 pets flies to a zone and comes back with materials. Nothing can go wrong on a trip.
// gives: materials per pet per hour. house: farmhouse level that opens the zone. wild: species found there and how often.
export const ZONES = {
  woods:  { name: 'Mossy Woods', el: 'Leaf', house: 1, gives: { wood: 14, fiber: 10, stone: 5, coins: 3 }, wild: { mossbun: 5, sproutle: 5, petalpuff: 2 }, blurb: 'Tall trees and soft moss.' },
  cove:   { name: 'Tidepool Cove', el: 'Tide', house: 2, gives: { shells: 8, fiber: 10, stone: 5, coins: 3 }, wild: { puddlepup: 5, bubblefin: 5, axolily: 1 }, blurb: 'Warm pools full of shells.' },
  ridge:  { name: 'Pebble Ridge', el: 'Stone', house: 2, gives: { stone: 16, wood: 4, crystal: .5, coins: 3 }, wild: { pebblet: 5, cragcrab: 2, dustmole: 1 }, blurb: 'Rocky paths and a glint of crystal.' },
  hills:  { name: 'Ember Hills', el: 'Ember', house: 3, gives: { coal: 8, stone: 9, wood: 5, coins: 4 }, wild: { cindercub: 5, toastoad: 5, flickit: 1 }, blurb: 'Warm slopes that glow at night.' },
  meadow: { name: 'Thunder Meadow', el: 'Spark', house: 4, gives: { wood: 12, fiber: 6, crystal: 1, coins: 5 }, wild: { zapkit: 5, buzzlet: 2, voltvole: 1 }, blurb: 'Tall grass that crackles before rain.' },
};
// find: chance that a wild pet follows the party home. xp: what every pet in the party learns.
export const TRIPS = {
  stroll: { name: 'Stroll', min: 15, find: .1, xp: 8, blurb: 'While you play' },
  outing: { name: 'Outing', min: 60, find: .22, xp: 22, blurb: 'A lunch break' },
  trek:   { name: 'Trek', min: 240, find: .4, xp: 60, blurb: 'While you are busy' },
  camp:   { name: 'Camp-out', min: 480, find: .6, xp: 100, blurb: 'Overnight' },
};
export const PARTY = 3;
// What a party should bring back, before luck (the server adds up to 15% either way).
// Longer trips bring a little less per hour, pets of the zone's element 25% more, and each level 4% more.
export function tripLoot(zone, trip, pets) {
  const z = ZONES[zone], hours = Math.pow(TRIPS[trip].min / 60, .9), out = {};
  let power = 0;
  for (const p of pets) power += (SPECIES[p.sp]?.el === z.el ? 1.25 : 1) * (1 + (p.lv - 1) * .04);
  for (const [k, n] of Object.entries(z.gives)) out[k] = n * hours * power;
  return out;
}

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

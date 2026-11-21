// Pawperty board: shared by the server (rules) and the client (labels, 3D board). Restart the server after editing.
// 40 tiles round an 11 x 11 square: ten places along every side. Eight streets of three pet shops, each street
// one Pet Farm island, each shop run by one of that island's pets.

export const SIDE = 10, N = SIDE * 4, GRID = SIDE + 1; // a corner every SIDE tiles; the board is GRID x GRID cells
export const START = 0, BATH = SIDE, LOST = SIDE * 2, MUD = SIDE * 3;
export const PASS_GO = 150;      // treats for passing the Welcome Mat
export const START_CASH = 600;
export const BATH_FEE = 30, VET_FEE = 40, RUB = 10, JAR_START = 50, BOWL = 30;
export const NAP_CHANCE = .2;    // each round, every pet with a shop has this chance of napping (no rent while asleep)
export const LV_NAMES = ['Shop', 'Pet Bed', 'Toy Box', 'Pet Palace'];
export const LV_MAX = 3;
const LV_RENT = [1, 2.5, 5, 12]; // rent multiplier for each upgrade level
export const STREET_BONUS = 2;    // owning the whole street doubles rent below Pet Palace, and lets you build the palace

export const GROUPS = [
  { id: 'meadow', name: 'Starter Meadow',  col: '#3fc7a8', ink: '#0f5a4c', price: 50 },
  { id: 'grove',  name: 'Fruit Grove',     col: '#ff7a8a', ink: '#8f2236', price: 70 },
  { id: 'patch',  name: 'Veggie Patch',    col: '#ffa24a', ink: '#8a4a10', price: 100 },
  { id: 'cove',   name: 'Tropic Cove',     col: '#6cc24a', ink: '#2c5e16', price: 130 },
  { id: 'bakery', name: 'Bakery Bluff',    col: '#e8c34a', ink: '#7a5a10', price: 150 },
  { id: 'sweets', name: 'Sweet Shop Isle', col: '#c98bff', ink: '#5b2a8f', price: 180 },
  { id: 'peak',   name: 'Weather Peak',    col: '#4db5ff', ink: '#14507a', price: 210 },
  { id: 'night',  name: 'Starfall Isle',   col: '#5c6ad8', ink: '#232a70', price: 250 },
];

// [street, shop name, pet species from Pet Farm]
const SHOPS = [
  [0, 'Moss Garden', 'mossbun'], [0, 'Campfire Café', 'cindercub'], [0, 'Splash Pad', 'puddlepup'],
  [1, 'Smoothie Hut', 'strawbun'], [1, 'Fizz Stand', 'lemonzest'], [1, 'Pamper Spa', 'pinepine'],
  [2, 'Crunch Café', 'carrofox'], [2, 'Pod Hotel', 'peapillar'], [2, 'Nap Barn', 'pumpkit'],
  [3, 'Melon Lagoon', 'melonwhale'], [3, 'Coco Bowling', 'coconutkin'], [3, 'Spicy Grill', 'chilipup'],
  [4, 'Crumb Shack', 'croissab'], [4, 'Ring Bakery', 'donuseal'], [4, 'Frosting Tower', 'cupcowl'],
  [5, 'Toastery', 'mallowlamb'], [5, 'Wobble Bar', 'jellifrog'], [5, 'Stripe Store', 'candraffe'],
  [6, 'Puddle Pool', 'dripfrog'], [6, 'Ski Lodge', 'snowfox'], [6, 'Sunbed Resort', 'sunlion'],
  [7, 'Glow Gallery', 'starjelly'], [7, 'Dream Inn', 'moonbun'], [7, 'Rocket Rides', 'cometail'],
];
export const PET_NAME = {
  mossbun: 'Mossbun', cindercub: 'Cindercub', puddlepup: 'Puddlepup', melonwhale: 'Melonwhale', coconutkin: 'Coconutkin', chilipup: 'Chilipup',
  strawbun: 'Strawbun', lemonzest: 'Lemonzest', pinepine: 'Pinepine', carrofox: 'Carrofox', peapillar: 'Peapillar', pumpkit: 'Pumpkit',
  croissab: 'Croissab', donuseal: 'Donuseal', cupcowl: 'Cupcowl', mallowlamb: 'Mallowlamb', jellifrog: 'Jellifrog', candraffe: 'Candraffe',
  dripfrog: 'Dripfrog', snowfox: 'Snowfox', sunlion: 'Sunlion', starjelly: 'Starjelly', moonbun: 'Moonbun', cometail: 'Cometail',
};

// the ring, starting at the Welcome Mat and going clockwise (seen from above)
// (the last place on every side is never a shop, so two shop names never meet in a corner of the lawn)
const LAYOUT = ['start', 0, 'zoom', 1, 2, 3, 'vet', 4, 5, 'bowl',
  'bath', 6, 7, 'bowl', 8, 9, 'zoom', 10, 11, 'vet',
  'lost', 12, 'zoom', 13, 14, 15, 'vet', 16, 17, 'zoom',
  'mud', 18, 19, 'zoom', 20, 21, 'bowl', 22, 23, 'zoom'];
const SPECIAL = {
  start: { name: 'Welcome Mat', blurb: `Collect ${PASS_GO} treats every time you pass.` },
  bath: { name: 'Bath Time', blurb: `Stuck in the tub: roll doubles to hop out, or pay ${BATH_FEE} treats.` },
  lost: { name: 'Lost & Found', blurb: 'Grab every treat that was dropped in the jar.' },
  mud: { name: 'Muddy Puddle', blurb: 'Splash! Straight off to Bath Time.' },
  zoom: { name: 'Zoomies!', blurb: 'Draw a Zoomies card.' },
  bowl: { name: 'Treat Bowl', blurb: `Somebody left a full bowl out. Help yourself to ${BOWL} treats.` },
  vet: { name: 'Vet Visit', blurb: `Pay ${VET_FEE} treats into the Lost & Found jar.` },
};
const round5 = x => Math.max(5, Math.round(x / 5) * 5);

export const TILES = LAYOUT.map((k, i) => {
  if (typeof k === 'string') return { i, k, ...SPECIAL[k] };
  const [g, name, pet] = SHOPS[k], grp = GROUPS[g], last = SHOPS.filter(s => s[0] === g).indexOf(SHOPS[k]) === 2;
  const price = grp.price + (last ? 20 : 0), base = round5(price * .25);
  return { i, k: 'shop', g, name, pet, price, up: Math.round(price / 2 / 10) * 10, rent: LV_RENT.map(m => round5(base * m)) };
});
export const SHOP_TILES = TILES.filter(t => t.k === 'shop').map(t => t.i);
export const STREET = GROUPS.map((_, g) => TILES.filter(t => t.g === g).map(t => t.i));

// Rent for landing on tile i, given who owns what (own[i] = seat or -1) and upgrade levels.
export function rentOf(i, own, lv) {
  const t = TILES[i]; if (t.k !== 'shop' || own[i] < 0) return 0;
  return t.rent[lv[i]] * (lv[i] < LV_MAX && fullStreet(t.g, own[i], own) ? STREET_BONUS : 1);
}
export const fullStreet = (g, s, own) => STREET[g].every(i => own[i] === s);
// What a shop is worth at the end: what was paid for it and its upgrades.
export const worthOf = (i, lv) => TILES[i].price + TILES[i].up * (lv[i] || 0);

// Grid position of tile i on the board: [col, row], col 0..SIDE left to right, row 0..SIDE front to back.
// The Welcome Mat is the front right corner; the ring runs right to left along the front.
export function cellOf(i) {
  const s = Math.floor(i / SIDE), k = i % SIDE;
  if (s === 0) return [SIDE - k, 0];
  if (s === 1) return [0, k];
  if (s === 2) return [k, SIDE];
  return [SIDE, SIDE - k];
}
export const sideOf = i => Math.floor(i / SIDE) % 4;
export const isCorner = i => i % SIDE === 0;

// Zoomies cards. The server applies them; the text is shown to everyone.
export const CARDS = {
  zoom: 'Zoomies! Dash 5 tiles ahead.',
  squirrel: 'Squirrel! Everyone else runs back 2 tiles.',
  stash: 'Your pet found a treat stash under the sofa. Collect 60.',
  ate: 'Your pet ate the rent money. Drop 40 in the Lost & Found jar.',
  rubs: 'Belly rubs all round! Pay every player 10.',
  show: 'Best in Show! Every player gives you 15.',
  mud: 'Muddy paws! Straight to Bath Time.',
  yawn: 'Big yawn… all your pets doze off until the next round.',
  bell: 'Dinner bell! Every napping pet on the board wakes up.',
  home: 'Treat delivery! Hop to the Welcome Mat.',
  duck: 'Rubber duck! Keep it to skip your next Bath Time.',
  vase: 'The cat knocked a vase off the shelf. Pay 15 for every upgrade you own.',
  cake: 'Pupcake party! Collect 40.',
  eyes: 'Puppy eyes: your next rent is free.',
  swap: 'Musical cushions! Swap places with the richest player.',
  again: 'Lucky paw! Roll again.',
  pigeon: 'A pigeon ran off with your sandwich. Pay 20.',
  photo: 'Your pet did something adorable and the photo went viral. Collect 30.',
};

// How long things take on screen, in ms. The server waits this long before moving on.
// aim: after the dice settle, the tile the roll leads to is pointed out before the token sets off.
export const MS = { roll: 900, aim: 700, step: 230, land: 450, card: 2300, pay: 900, pause: 700, jump: 900, bot: 900, botBuy: 900 };

// Pawperty board: shared by the server (rules) and the client (labels, 3D board). Restart the server after editing.
// 28 tiles round an 8 x 8 square. Six streets of three pet shops, each street one Pet Farm island,
// each shop run by one of that island's pets.

export const N = 28, SIDE = 7;   // tiles in the ring; a corner every 7 tiles
export const START = 0, BATH = 7, LOST = 14, MUD = 21;
export const PASS_GO = 100;      // treats for passing the Welcome Mat
export const START_CASH = 600;
export const BATH_FEE = 30, VET_FEE = 40, RUB = 10, JAR_START = 50;
export const NAP_CHANCE = .2;    // each round, every pet with a shop has this chance of napping (no rent while asleep)
export const LV_NAMES = ['Shop', 'Pet Bed', 'Toy Box', 'Pet Palace'];
export const LV_MAX = 3;
const LV_RENT = [1, 2.5, 5, 12]; // rent multiplier for each upgrade level
export const STREET_BONUS = 2;    // owning the whole street doubles rent below Pet Palace, and lets you build the palace

export const GROUPS = [
  { id: 'grove',  name: 'Fruit Grove',     col: '#ff7a8a', ink: '#8f2236', price: 60 },
  { id: 'patch',  name: 'Veggie Patch',    col: '#ffa24a', ink: '#8a4a10', price: 90 },
  { id: 'bakery', name: 'Bakery Bluff',    col: '#e8c34a', ink: '#7a5a10', price: 120 },
  { id: 'sweets', name: 'Sweet Shop Isle', col: '#c98bff', ink: '#5b2a8f', price: 150 },
  { id: 'peak',   name: 'Weather Peak',    col: '#4db5ff', ink: '#14507a', price: 180 },
  { id: 'night',  name: 'Starfall Isle',   col: '#5c6ad8', ink: '#232a70', price: 220 },
];

// [street, shop name, pet species from Pet Farm]
const SHOPS = [
  [0, 'Smoothie Hut', 'strawbun'], [0, 'Fizz Stand', 'lemonzest'], [0, 'Pamper Spa', 'pinepine'],
  [1, 'Crunch Café', 'carrofox'], [1, 'Pod Hotel', 'peapillar'], [1, 'Nap Barn', 'pumpkit'],
  [2, 'Crumb Shack', 'croissab'], [2, 'Ring Bakery', 'donuseal'], [2, 'Frosting Tower', 'cupcowl'],
  [3, 'Toastery', 'mallowlamb'], [3, 'Wobble Bar', 'jellifrog'], [3, 'Stripe Store', 'candraffe'],
  [4, 'Puddle Pool', 'dripfrog'], [4, 'Ski Lodge', 'snowfox'], [4, 'Sunbed Resort', 'sunlion'],
  [5, 'Glow Gallery', 'starjelly'], [5, 'Dream Inn', 'moonbun'], [5, 'Rocket Rides', 'cometail'],
];
export const PET_NAME = {
  strawbun: 'Strawbun', lemonzest: 'Lemonzest', pinepine: 'Pinepine', carrofox: 'Carrofox', peapillar: 'Peapillar', pumpkit: 'Pumpkit',
  croissab: 'Croissab', donuseal: 'Donuseal', cupcowl: 'Cupcowl', mallowlamb: 'Mallowlamb', jellifrog: 'Jellifrog', candraffe: 'Candraffe',
  dripfrog: 'Dripfrog', snowfox: 'Snowfox', sunlion: 'Sunlion', starjelly: 'Starjelly', moonbun: 'Moonbun', cometail: 'Cometail',
};

// the ring, starting at the Welcome Mat and going clockwise (seen from above)
const LAYOUT = ['start', 0, 'zoom', 1, 2, 3, 4,
  'bath', 5, 'vet', 6, 'zoom', 7, 8,
  'lost', 9, 10, 'zoom', 11, 'vet', 12,
  'mud', 13, 14, 'zoom', 15, 16, 17];
const SPECIAL = {
  start: { name: 'Welcome Mat', blurb: `Collect ${PASS_GO} treats every time you pass.` },
  bath: { name: 'Bath Time', blurb: `Stuck in the tub: roll doubles to hop out, or pay ${BATH_FEE} treats.` },
  lost: { name: 'Lost & Found', blurb: 'Grab every treat that was dropped in the jar.' },
  mud: { name: 'Muddy Puddle', blurb: 'Splash! Straight off to Bath Time.' },
  zoom: { name: 'Zoomies!', blurb: 'Draw a Zoomies card.' },
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

// Grid position of tile i on the 8 x 8 board: [col, row], col 0..7 left to right, row 0..7 front to back.
// The Welcome Mat is the front right corner; the ring runs right to left along the front.
export function cellOf(i) {
  const s = Math.floor(i / SIDE), k = i % SIDE;
  if (s === 0) return [7 - k, 0];
  if (s === 1) return [0, k];
  if (s === 2) return [k, 7];
  return [7, 7 - k];
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
export const MS = { roll: 900, step: 230, land: 450, card: 2300, pay: 900, pause: 700, jump: 900, bot: 900, botBuy: 900 };

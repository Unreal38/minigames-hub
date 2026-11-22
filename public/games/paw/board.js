import { L } from '../../i18n.js';
// Pawperty board: shared by the server (rules) and the client (labels, 3D board). Restart the server after editing.
// 40 tiles round an 11 x 11 square: ten places along every side. Eight streets of three pet shops, one street
// per colour, each shop run by a Pet Farm pet of that colour.

export const SIDE = 10, N = SIDE * 4, GRID = SIDE + 1; // a corner every SIDE tiles; the board is GRID x GRID cells
export const START = 0, BATH = SIDE, LOST = SIDE * 2, MUD = SIDE * 3;
export const PASS_GO = 150;      // treats for passing the Welcome Mat
export const START_CASH = 600;
export const BATH_FEE = 30, VET_FEE = 40, RUB = 10, JAR_START = 50, BOWL = 30;
export const NAP_CHANCE = .2;    // each round, every pet with a shop has this chance of napping (no rent while asleep)
export const LV_NAMES = [L('Shop', 'Sklepik'), L('Pet Bed', 'Legowisko'), L('Toy Box', 'Skrzynia z zabawkami'), L('Pet Palace', 'Pałac zwierzaka')];
export const LV_MAX = 3;
const LV_RENT = [1, 2.5, 5, 12]; // rent multiplier for each upgrade level
export const STREET_BONUS = 2;    // owning the whole street doubles rent below Pet Palace, and lets you build the palace

// Streets go round the board in colour order, and every pet has the colour of its street.
export const GROUPS = [
  { id: 'cocoa',  name: L('Cocoa Corner', 'Kakaowy Zakątek'), col: '#c2905c', ink: '#5e3a1a', price: 50 },
  { id: 'snow',   name: L('Snowy Lane', 'Śnieżna Alejka'),   col: '#cfdbe8', ink: '#44566b', price: 70 },
  { id: 'rosy',   name: L('Rosy Row', 'Różana Uliczka'),     col: '#ff7a8a', ink: '#8f2236', price: 100 },
  { id: 'orange', name: L('Orange Grove', 'Pomarańczowy Gaj'), col: '#ffa24a', ink: '#8a4a10', price: 130 },
  { id: 'sunny',  name: L('Sunny Side', 'Słoneczna Strona'),   col: '#e8c34a', ink: '#7a5a10', price: 150 },
  { id: 'green',  name: L('Green Glade', 'Zielona Polana'),  col: '#6cc24a', ink: '#2c5e16', price: 180 },
  { id: 'blue',   name: L('Blue Bay', 'Błękitna Zatoka'),     col: '#4db5ff', ink: '#14507a', price: 210 },
  { id: 'violet', name: L('Violet Hill', 'Fioletowe Wzgórze'),  col: '#b08bff', ink: '#4b2a8f', price: 250 },
];

// [street, shop name, pet species from Pet Farm]
const SHOPS = [
  [0, L('Coco Bowling', 'Kokosowe kręgle'), 'coconutkin'], [0, L('Crumb Shack', 'Chatka okruszków'), 'croissab'], [0, L('Twist Bakery', 'Piekarnia precli'), 'pretzelisk'],
  [1, L('Toastery', 'Tosternia'), 'mallowlamb'], [1, L('Ring Bakery', 'Pączkarnia'), 'donuseal'], [1, L('Ski Lodge', 'Górska chata'), 'snowfox'],
  [2, L('Smoothie Hut', 'Bar smoothie'), 'strawbun'], [2, L('Spicy Grill', 'Ostry grill'), 'chilipup'], [2, L('Dragon Diner', 'Smoczy bar'), 'sizzlet'],
  [3, L('Crunch Café', 'Kawiarnia Chrup'), 'carrofox'], [3, L('Nap Barn', 'Stodoła drzemek'), 'pumpkit'], [3, L('Campfire Café', 'Kawiarnia Ognisko'), 'cindercub'],
  [4, L('Fizz Stand', 'Stoisko z lemoniadą'), 'lemonzest'], [4, L('Pamper Spa', 'Salon spa'), 'pinepine'], [4, L('Sunbed Resort', 'Słoneczny kurort'), 'sunlion'],
  [5, L('Pod Hotel', 'Hotel Strączek'), 'peapillar'], [5, L('Melon Lagoon', 'Melonowa laguna'), 'melonwhale'], [5, L('Wobble Bar', 'Bar Galaretka'), 'jellifrog'],
  [6, L('Puddle Pool', 'Basen Kałuża'), 'dripfrog'], [6, L('Shell Shop', 'Sklep z muszlami'), 'waddlet'], [6, L('Rocket Rides', 'Rakietowe loty'), 'cometail'],
  [7, L('Glow Gallery', 'Świetlna galeria'), 'starjelly'], [7, L('Dream Inn', 'Zajazd snów'), 'moonbun'], [7, L('Night Café', 'Nocna kawiarnia'), 'wattbat'],
];
export const PET_NAME = {
  pretzelisk: 'Pretzelisk', sizzlet: 'Sizzlet', waddlet: 'Waddlet', wattbat: 'Wattbat',
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
  start: { name: L('Welcome Mat', 'Wycieraczka'), blurb: L(`Collect ${PASS_GO} treats every time you pass.`, `Za każde przejście dostajesz ${PASS_GO} przysmaków.`) },
  bath: { name: L('Bath Time', 'Kąpiel'), blurb: L(`Stuck in the tub: roll doubles to hop out, or pay ${BATH_FEE} treats. Your pets nap (no rent) while you soak.`, `Siedzisz w wannie: wyrzuć dublet, żeby wyskoczyć, albo zapłać ${BATH_FEE} przysmaków. Gdy się moczysz, twoje zwierzaki drzemią (bez czynszu).`) },
  lost: { name: L('Lost & Found', 'Znalezione'), blurb: L('Grab every treat that was dropped in the jar.', 'Zabierz wszystkie przysmaki, które wpadły do słoika.') },
  mud: { name: L('Muddy Puddle', 'Błotna kałuża'), blurb: L('Splash! Straight off to Bath Time.', 'Chlup! Prosto do Kąpieli.') },
  zoom: { name: L('Zoomies!', 'Głupawka!'), blurb: L('Draw a Zoomies card.', 'Dobierz kartę Głupawki.') },
  bowl: { name: L('Treat Bowl', 'Miska przysmaków'), blurb: L(`Somebody left a full bowl out. Help yourself to ${BOWL} treats.`, `Ktoś zostawił pełną miskę. Częstuj się: ${BOWL} przysmaków.`) },
  vet: { name: L('Vet Visit', 'Wizyta u weterynarza'), blurb: L(`Pay ${VET_FEE} treats into the Lost & Found jar.`, `Wpłać ${VET_FEE} przysmaków do słoika Znalezione.`) },
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
  zoom: L('Zoomies! Dash 5 tiles ahead.', 'Głupawka! Pędzisz 5 pól do przodu.'),
  squirrel: L('Squirrel! Everyone else runs back 2 tiles.', 'Wiewiórka! Wszyscy inni cofają się o 2 pola.'),
  stash: L('Your pet found a treat stash under the sofa. Collect 60.', 'Twój zwierzak znalazł pod kanapą schowek z przysmakami. Dostajesz 60.'),
  ate: L('Your pet ate the rent money. Drop 40 in the Lost & Found jar.', 'Twój zwierzak zjadł pieniądze na czynsz. Wrzuć 40 do słoika Znalezione.'),
  rubs: L('Belly rubs all round! Pay every player 10.', 'Drapanie po brzuszku dla wszystkich! Zapłać każdemu graczowi 10.'),
  show: L('Best in Show! Every player gives you 15.', 'Gwiazda wystawy! Każdy gracz daje ci 15.'),
  mud: L('Muddy paws! Straight to Bath Time.', 'Ubłocone łapki! Prosto do Kąpieli.'),
  yawn: L('Big yawn… all your pets doze off until the next round.', 'Wielkie ziewnięcie… wszystkie twoje zwierzaki drzemią do następnej rundy.'),
  bell: L('Dinner bell! Every napping pet on the board wakes up.', 'Dzwonek na obiad! Każdy drzemiący zwierzak na planszy się budzi.'),
  home: L('Treat delivery! Hop to the Welcome Mat.', 'Dostawa przysmaków! Skocz na Wycieraczkę.'),
  duck: L('Rubber duck! Keep it to skip your next Bath Time.', 'Gumowa kaczka! Zachowaj ją, żeby ominąć następną Kąpiel.'),
  vase: L('The cat knocked a vase off the shelf. Pay 15 for every upgrade you own.', 'Kot zrzucił wazon z półki. Zapłać 15 za każde swoje ulepszenie.'),
  cake: L('Pupcake party! Collect 40.', 'Babeczkowa impreza! Dostajesz 40.'),
  eyes: L('Puppy eyes: your next rent is free.', 'Maślane oczy: twój następny czynsz jest za darmo.'),
  swap: L('Musical cushions! Swap places with the richest player.', 'Gorące poduszki! Zamień się miejscami z najbogatszym graczem.'),
  again: L('Lucky paw! Roll again.', 'Szczęśliwa łapka! Rzuć jeszcze raz.'),
  pigeon: L('A pigeon ran off with your sandwich. Pay 20.', 'Gołąb uciekł z twoją kanapką. Zapłać 20.'),
  photo: L('Your pet did something adorable and the photo went viral. Collect 30.', 'Twój zwierzak zrobił coś uroczego, a zdjęcie obiegło internet. Dostajesz 30.'),
};

// How long things take on screen, in ms. The server waits this long before moving on.
// aim: after the dice settle, the tile the roll leads to is pointed out before the token sets off.
export const MS = { roll: 900, aim: 700, step: 230, land: 450, card: 2300, pay: 900, pause: 700, jump: 900, bot: 900, botBuy: 900 };

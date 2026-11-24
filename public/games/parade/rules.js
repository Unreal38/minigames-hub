// Pet Parade rules shared by the server and the browser: a colour-matching shedding game played with a deck of
// Pet Farm pet cards in the four element colours, plus grey Stone wild cards.
//
// Cards are numbers 0..103. Card c < 96 is coloured: colour c / 24 | 0 (0 Leaf, 1 Ember, 2 Tide, 3 Spark) and
// k = c % 24 within its colour: k 0..17 are the numbers 1 to 9 twice (number k % 9 + 1), k 18-19 Nap, 20-21
// Turnabout, 22-23 Gift +2. Cards 96..99 are Pebble (wild: pick the colour), 100..103 Rockslide (wild, +4).
// Pet names are the same in every language, so nothing here needs translating.
export const COLS = ['Leaf', 'Ember', 'Tide', 'Spark'];
export const HEX = ['#3f9a52', '#e0592f', '#2f86cc', '#d9a400']; // the Pet Farm element colours
export const STONE = '#8a7f76';
export const N = 104, HAND = 7;
export const NAP = 10, TURN = 11, GIFT = 12, PEBBLE = 13, ROCK = 14; // card faces after the numbers 1..9
export const colOf = c => (c < 96 ? c / 24 | 0 : -1);
export const faceOf = c => { if (c >= 100) return ROCK; if (c >= 96) return PEBBLE; const k = c % 24; return k < 18 ? k % 9 + 1 : NAP + ((k - 18) >> 1); };
export const isWild = c => c >= 96;
export const isDraw = c => faceOf(c) === GIFT || faceOf(c) === ROCK;
export const drawOf = c => (faceOf(c) === GIFT ? 2 : faceOf(c) === ROCK ? 4 : 0);
export const deck = () => Array.from({ length: N }, (_, c) => c);
// points left in a hand at the end: the fewer, the better your place
export const pointsOf = c => { const f = faceOf(c); return f <= 9 ? f : f <= GIFT ? 10 : 20; };
export const handPoints = h => h.reduce((a, c) => a + pointsOf(c), 0);
// your hand in colour order, numbers before actions, wild cards last
export const sortHand = h => [...h].sort((a, b) => (isWild(a) - isWild(b)) || colOf(a) - colOf(b) || faceOf(a) - faceOf(b) || a - b);

// The pet on each card: nine for the numbers 1 to 9 of each colour, then Nap, Turnabout and Gift; Stone for the wild cards.
export const PETS = [
  ['mossbun', 'sproutle', 'petalpuff', 'acornip', 'bambear', 'patchkit', 'yuzubara', 'strawbun', 'pinepine', 'snoozloth', 'cupcowl', 'mallowlamb'],
  ['cindercub', 'toastoad', 'flickit', 'lanternail', 'sizzlet', 'munchmew', 'cinnapanda', 'chilipup', 'sunlion', 'gingersnap', 'croissab', 'pumpkit'],
  ['puddlepup', 'bubblefin', 'axolily', 'ripplet', 'waddlet', 'shrimplet', 'coralcolt', 'ottershell', 'melonwhale', 'fluffcoon', 'skipfin', 'donuseal'],
  ['zapkit', 'buzzlet', 'voltvole', 'wattbat', 'oinkwatt', 'tuxpurr', 'zapuff', 'glidenut', 'lemonzest', 'moonbun', 'twistret', 'candraffe'],
];
export const WILD_PETS = { [PEBBLE]: 'pebblet', [ROCK]: 'rubblet' };
export const petOf = c => (isWild(c) ? WILD_PETS[faceOf(c)] : PETS[colOf(c)][faceOf(c) - 1]);

// The state of the pile that a card has to fit: top face and the colour in play (picked after a wild card).
// owe: cards the next player still has to take (only when stacking is on and someone played a Gift or Rockslide).
// May card c go on it?
export function fits(c, top, col, owe = 0) {
  if (!Number.isInteger(c) || c < 0 || c >= N) return false;
  if (owe > 0) return faceOf(c) === ROCK || (faceOf(c) === GIFT && faceOf(top) === GIFT); // only another draw card passes it on
  if (isWild(c)) return true;
  return colOf(c) === col || faceOf(c) === faceOf(top);
}
export const playable = (hand, top, col, owe = 0) => hand.filter(c => fits(c, top, col, owe));
export const SEATS = [2, 3, 4, 5, 6];

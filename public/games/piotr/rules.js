// Piotruś rules shared by the server and the browser. The deck is pairs of Pet Farm pets plus one card with no
// pair, the Piotruś (a tuxedo cat on a night-sky card). Card c of a pair shows the pet PETS[c >> 1]; c = PIOTR is the Piotruś.
// Pet names are the same in every language, so nothing here needs translating.
export const PIOTR = 99;
export const PETS = ['mossbun', 'cindercub', 'puddlepup', 'zapkit', 'pebblet', 'axolily', 'toastoad', 'bambear', 'waddlet', 'cragcrab', 'ottershell', 'snoozloth',
  'strawbun', 'melonwhale', 'sunlion', 'jellifrog']; // the last four only in the big deck
export const PIOTR_PET = 'tuxpurr';
export const DECKS = { small: 12, big: 16 }; // pairs in the deck: 25 cards (the classic Polish pack) or 33
export const deck = (pairs = 12) => { const d = []; for (let p = 0; p < pairs; p++) d.push(p * 2, p * 2 + 1); d.push(PIOTR); return d; };
export const petOf = c => (c === PIOTR ? -1 : c >> 1);
export const petName = c => (c === PIOTR ? 'Piotruś' : NAMES[PETS[c >> 1]] || '?');
const NAMES = { mossbun: 'Mossbun', cindercub: 'Cindercub', puddlepup: 'Puddlepup', zapkit: 'Zapkit', pebblet: 'Pebblet', axolily: 'Axolily', toastoad: 'Toastoad', bambear: 'Bambear',
  waddlet: 'Waddlet', cragcrab: 'Cragcrab', ottershell: 'Ottershell', snoozloth: 'Snoozloth', strawbun: 'Strawbun', melonwhale: 'Melonwhale', sunlion: 'Sunlion', jellifrog: 'Jellifrog' };
export const SEATS = [2, 3, 4, 5, 6];

// Take every pair out of a hand: returns the cards that stay and the pets that were paired.
export function strip(hand) {
  const keep = [], pairs = [], seen = new Map();
  for (const c of hand) {
    const p = petOf(c);
    if (p >= 0 && seen.has(p)) { keep.splice(keep.indexOf(seen.get(p)), 1); seen.delete(p); pairs.push(p); }
    else { keep.push(c); if (p >= 0) seen.set(p, c); }
  }
  return { keep, pairs };
}

// Lucky Wheel: what the server and the page must agree on. The wheel has 20 equal slices, so every slice is a 5% chance
// and the wheel itself shows the real odds. Balance changes are edits to this file.
// ORDER is the wheel clockwise from the top; each entry names a prize kind from PRIZES.
export const ORDER = ['c20', 'mat', 'pet', 'c40', 'treat', 'c20', 'boost', 'fine', 'c100', 'mat', 'c20', 'treat', 'pet', 'c40', 'cry', 'c20', 'boost', 'mat', 'fine', 'decor'];
// coins: paid straight to the account. pick: one of these lots goes to the Pet Farm Mailbox.
export const PRIZES = {
  c20:   { coins: 20 },
  c40:   { coins: 40 },
  c100:  { coins: 100 },
  mat:   { pick: [{ wood: 40 }, { stone: 40 }, { fiber: 40 }] },
  fine:  { pick: [{ shells: 12 }, { coal: 12 }] },
  cry:   { pick: [{ crystal: 2 }] },
  treat: { pick: [{ cake: 2 }, { pie: 1 }] },
  boost: {},   // a booster token for one of BOOSTS
  pet:   {},   // a baby of the pet of the day
  decor: {},   // one of LUCKY the player does not have yet
};
// The lucky set: Pet Farm decorations only the wheel gives (ITEMS entries with wheel: true).
export const LUCKY = ['clover', 'carousel', 'chest', 'goldpet', 'balloon', 'coinfount', 'horseshoe', 'miniwheel'];
export const PITY = 20;        // spins in a row without a lucky decoration before the next one is a sure thing
export const SET_COINS = 150;  // what the decoration slice pays once the whole set is collected
// Booster tokens. hours: how long it runs once started. uses: how many times it works. x: how strong it is.
export const BOOSTS = {
  garden:  { hours: 4, x: 2 },   // Garden Plots ripen twice as fast
  gate:    { uses: 3, x: .5 },   // the next three parties are home in half the time
  yard:    { hours: 8, x: 2 },   // training gives double experience
  nest:    { uses: 1, x: .5 },   // the next egg hatches in half the time
  kitchen: { uses: 5 },          // the next five treats come out double
};
// The pet of the day: how often it is a common, uncommon or rare species. Breeding-only pets never come from the wheel.
export const PET_RARITY = [60, 30, 10];

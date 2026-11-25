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
  winter: {},  // a baby Tusklet, the winter pet only the wheel gives (see SEASON_PETS)
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
// Season pets: a slice that takes the place of one 20-coin slice (at index `at`) while the season runs, and gives a baby of
// that species. from and to are [month, day] in Warsaw, both days included; a span may run over New Year.
// The pet is never sold, found, hatched or traded anywhere else (data.js SPECIES with wheel: <season>).
export const SEASON_PETS = {
  winter: { sp: 'tusklet', at: 15, from: [11, 15], to: [2, 28] },
};
// The wheel on a day ('YYYY-MM-DD', the Warsaw day from server/day.js): ORDER with any season slice that is on.
export function orderOn(day) {
  const md = +day.slice(5, 7) * 100 + +day.slice(8, 10), order = [...ORDER];
  for (const [kind, { at, from, to }] of Object.entries(SEASON_PETS)) {
    const a = from[0] * 100 + from[1], b = to[0] * 100 + to[1];
    if (a <= b ? md >= a && md <= b : md >= a || md <= b) order[at] = kind;
  }
  return order;
}

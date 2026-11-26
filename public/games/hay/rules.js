// Hay Hunch: a solo puzzle on a 5 x 5 field of hay bales. Shared by the server (which deals the fields and
// keeps them secret) and the browser (which only draws what has been flipped).
//
// Every bale hides a carrot bundle worth 1, 2 or 3, or a napping pet. Each row and each column has a sign with
// the carrots it holds in total and how many pets nap in it. Flipping a bale multiplies the field's harvest by
// its carrots. Find every 2 and 3 to clear the field and go up a level. Wake a pet and the harvest is lost and
// you go back to level 1.

export const N = 5;               // the field is N x N
export const MAX_LV = 7;
// Each level picks one of these at random: [bundles of 2, bundles of 3, napping pets]. The rest are 1s.
export const LEVELS = [
  null,
  [[3, 1, 5], [0, 3, 5], [5, 0, 5], [2, 2, 5], [4, 1, 5]],
  [[1, 3, 6], [6, 0, 6], [3, 2, 6], [0, 4, 6], [5, 1, 6]],
  [[2, 3, 7], [7, 0, 7], [4, 2, 7], [1, 4, 7], [6, 1, 7]],
  [[3, 3, 8], [0, 5, 8], [6, 1, 8], [8, 0, 8], [2, 4, 8]],
  [[5, 2, 9], [2, 4, 9], [7, 1, 9], [1, 5, 9], [4, 3, 9]],
  [[3, 4, 10], [0, 6, 10], [6, 2, 10], [8, 1, 10], [5, 3, 10]],
  [[7, 2, 10], [4, 4, 10], [1, 6, 10], [9, 1, 10], [2, 5, 10]],
];
// Coins for clearing a field at level L, and how many coins Hay Hunch can pay out in one day.
export const coinsFor = lv => lv + 2;
export const DAILY = 40;
export const XP_CLEAR = 8; // XP for a cleared field, while today's coins are still coming

export const PET = 0;
// Deal a field: an array of N*N values (0 = napping pet, else 1..3). rnd(n) returns 0..n-1.
export function deal(lv, rnd = n => Math.floor(Math.random() * n)) {
  const set = LEVELS[Math.max(1, Math.min(MAX_LV, lv | 0))];
  const [twos, threes, pets] = set[rnd(set.length)];
  const cells = [...Array(twos).fill(2), ...Array(threes).fill(3), ...Array(pets).fill(PET)];
  while (cells.length < N * N) cells.push(1);
  for (let i = cells.length - 1; i > 0; i--) { const j = rnd(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells;
}
// The signs: carrots and pets in each row (top to bottom) and each column (left to right).
export function hints(cells) {
  const rows = [], cols = [];
  for (let k = 0; k < N; k++) {
    const r = { sum: 0, pets: 0 }, c = { sum: 0, pets: 0 };
    for (let m = 0; m < N; m++) {
      const a = cells[k * N + m], b = cells[m * N + k];
      if (a === PET) r.pets++; else r.sum += a;
      if (b === PET) c.pets++; else c.sum += b;
    }
    rows.push(r); cols.push(c);
  }
  return { rows, cols };
}
// Harvest of the bales flipped so far: the product of their carrots (0 before the first flip).
export function harvestOf(cells, open) {
  let h = 0;
  for (let i = 0; i < cells.length; i++) if (open[i] && cells[i] !== PET) h = (h || 1) * cells[i];
  return h;
}
export const goal = cells => cells.filter(v => v >= 2).length;
export const found = (cells, open) => cells.filter((v, i) => v >= 2 && open[i]).length;

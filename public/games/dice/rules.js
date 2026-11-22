// Liar's Dice rules shared by the server and the client: what counts, which bids are allowed, and the odds.
// A bid is { q, f }: "there are at least q dice showing face f under all the cups together".
import { PL, plForm } from '../../i18n.js';
export const FACES = wild => (wild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]);
export const NAME = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
export const PLURAL = ['', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const NAME_PL = [[], ['jedynka', 'jedynki', 'jedynek'], ['dwójka', 'dwójki', 'dwójek'], ['trójka', 'trójki', 'trójek'], ['czwórka', 'czwórki', 'czwórek'], ['piątka', 'piątki', 'piątek'], ['szóstka', 'szóstki', 'szóstek']];
export const faceWord = (q, f) => (PL ? plForm(q, ...NAME_PL[f]) : q === 1 ? NAME[f] : PLURAL[f]);

// With wild ones on, a 1 counts as whatever face was bid.
export const matches = (v, f, wild) => v === f || (wild && v === 1);
export const countFace = (hands, f, wild) => hands.reduce((a, h) => a + h.filter(v => matches(v, f, wild)).length, 0);

// A new bid has to go up: more dice of any face, or the same number of a higher face.
export const legal = (bid, q, f, total, wild) => Number.isInteger(q) && FACES(wild).includes(f) && q >= 1 && q <= total
  && (!bid || q > bid.q || (q === bid.q && f > bid.f));
// The smallest bid that beats the one on the table (null when nothing can beat it).
export function lowest(bid, total, wild) {
  const fs = FACES(wild);
  if (!bid) return { q: 1, f: fs[0] };
  if (bid.f < 6) return { q: bid.q, f: bid.f + 1 };
  return bid.q < total ? { q: bid.q + 1, f: fs[0] } : null;
}

// Chance that at least `need` of `m` unseen dice match, when each matches with chance p.
export function atLeast(need, m, p) {
  if (need <= 0) return 1;
  if (need > m) return 0;
  let below = 0, term = (1 - p) ** m; // P(X = 0)
  for (let k = 0; k < need; k++) { below += term; term *= (m - k) / (k + 1) * p / (1 - p); }
  return Math.max(0, Math.min(1, 1 - below));
}
export const chance = (f, wild) => (wild && f !== 1 ? 1 / 3 : 1 / 6);

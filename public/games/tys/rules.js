// Tysiąc (Polish "Thousand") rules shared by the server and the browser.
// Cards use the same numbers as the poker cards (rank = c % 13 with 12 = ace, suit = c / 13 | 0:
// hearts, diamonds, clubs, spades), so they are drawn by the same card code. Only 9, 10, J, Q, K, A are used.
export const SUITS = [0, 1, 2, 3];
export const SUIT_NAMES = ['hearts', 'diamonds', 'clubs', 'spades'];
export const SUIT_CHARS = ['♥', '♦', '♣', '♠'];
export const MELD = [100, 80, 60, 40]; // a king and queen of one suit ("meldunek"), announced when you lead one of them
const R9 = 7, R10 = 8, RJ = 9, RQ = 10, RK = 11, RA = 12;
const ORDER = [R9, RJ, RQ, RK, R10, RA]; // weakest to strongest: the ten beats the king
const POW = { [R9]: 0, [RJ]: 1, [RQ]: 2, [RK]: 3, [R10]: 4, [RA]: 5 };
const VAL = { [R9]: 0, [RJ]: 2, [RQ]: 3, [RK]: 4, [R10]: 10, [RA]: 11 };
export const DECK = SUITS.flatMap(s => ORDER.map(r => s * 13 + r));
export const suitOf = c => c / 13 | 0;
export const power = c => POW[c % 13];
export const value = c => VAL[c % 13];
export const card = (s, pow) => s * 13 + ORDER[pow];
export const queen = s => s * 13 + RQ, king = s => s * 13 + RK, ace = s => s * 13 + RA, ten = s => s * 13 + R10;
export const isKQ = c => c % 13 === RQ || c % 13 === RK;
export const hasMeld = (hand, s) => hand.includes(queen(s)) && hand.includes(king(s));
export const melds = hand => SUITS.filter(s => hasMeld(hand, s));
// Can this card announce a marriage if it is led from this hand?
export const canMeld = (hand, c) => isKQ(c) && hasMeld(hand, suitOf(c));

export const MIN_BID = 100, STEP = 10, SAFE_BID = 120;
// Without a marriage in hand nobody may bid over 120 (there are only 120 points in the cards).
export const maxBid = hand => SAFE_BID + melds(hand).reduce((a, s) => a + MELD[s], 0);
export const round10 = x => Math.floor((x + 5) / 10) * 10;

// Left to right in marriage order, the way players hold them: hearts, diamonds, clubs, spades. Strongest card first.
export const FOLD_PAY = 60; // what each opponent scores when the declarer folds the hand
export function sortHand(hand) {
  return [...hand].sort((a, b) => suitOf(a) - suitOf(b) || power(b) - power(a));
}
// Table option for folding: 'off', 'free' (each player's first fold pays nothing, later ones 60) or 'on' (always 60).
export const FOLDS = ['free', 'on', 'off'];

// Does card c beat the card that is winning the trick so far?
export const beats = (c, best, trump) => (suitOf(c) === suitOf(best) ? power(c) > power(best) : suitOf(c) === trump);
// trick: cards in the order they were played. Returns the index of the winning card.
export function winnerOf(trick, trump) {
  let w = 0;
  for (let i = 1; i < trick.length; i++) if (beats(trick[i], trick[w], trump)) w = i;
  return w;
}
// Which cards may be played: follow suit; with none of it, play a trump; and beat the winning card whenever you can.
export function legal(hand, trick, trump) {
  if (!trick.length) return hand.slice();
  const best = trick[winnerOf(trick, trump)], lead = suitOf(trick[0]);
  let pool = hand.filter(c => suitOf(c) === lead);
  if (!pool.length) pool = hand.filter(c => suitOf(c) === trump);
  if (!pool.length) return hand.slice();
  const win = pool.filter(c => beats(c, best, trump));
  return win.length ? win : pool;
}

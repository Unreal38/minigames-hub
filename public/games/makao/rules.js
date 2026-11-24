// Makao rules shared by the server and the browser: the classic Polish shedding game with a standard 52-card deck.
// Cards use the poker numbering (0..51: rank = c % 13 with 0 = two .. 12 = ace, suit = c / 13 | 0 with hearts
// first), so the poker card pictures draw them as they are.
export const TWO = 0, THREE = 1, FOUR = 2, JACK = 9, QUEEN = 10, KING = 11, ACE = 12;
export const KH = 11, KS = 50;          // the fighting kings: hearts hits the next player, spades the one before you
export const HAND = 5, PENALTY = 5;     // cards dealt; cards taken for a forgotten "Makao!" or "Po makale!"
export const DEMANDS = [3, 4, 5, 6, 7, 8]; // the ranks a Jack may demand: 5 to 10
export const SEATS = [2, 3, 4, 5, 6];
export const rankOf = c => c % 13;
export const suitOf = c => c / 13 | 0;
export const deck = () => Array.from({ length: 52 }, (_, c) => c);
export const sortHand = h => [...h].sort((a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b));
// how many cards this card makes someone draw (kings only fight when the table plays with fighting kings)
export const drawOf = (c, kings = true) => (rankOf(c) === TWO ? 2 : rankOf(c) === THREE ? 3 : kings && (c === KH || c === KS) ? 5 : 0);
export const isFight = (c, kings = true) => drawOf(c, kings) > 0;
// a plain card: no function at all (the first card turned up is always one of these)
export const isPlain = c => rankOf(c) >= 3 && rankOf(c) <= 8;

// The table a card has to fit, T = { top, suit, owe, stop, dem, queens, kings }:
// top: the card on top; suit: the suit in play (the top card's, or the one picked with an Ace);
// owe: cards waiting to be drawn in a fight (2, 3, fighting kings); stop: turns to wait from fours;
// dem: the rank a Jack demands, or -1; queens: "Queen on everything, everything on the Queen"; kings: fighting kings.
export function fits(c, T) {
  if (!Number.isInteger(c) || c < 0 || c > 51) return false;
  const r = rankOf(c), tr = rankOf(T.top);
  if (T.owe > 0) return isFight(c, T.kings) && (r === tr || suitOf(c) === suitOf(T.top)); // defend with a fighting card of that rank or suit
  if (T.stop > 0) return r === FOUR;                       // only another four passes the wait on
  if (T.dem >= 0) return r === T.dem || r === JACK;        // the demanded rank, or a Jack to change the demand
  if (T.queens && (r === QUEEN || tr === QUEEN)) return true;
  return r === tr || suitOf(c) === T.suit;
}
// May these cards (all from `hand`) go down together? They must share a rank and the first one must fit;
// the last one ends up on top.
export function canPlay(hand, cards, T) {
  if (!Array.isArray(cards) || !cards.length || cards.length > 4 || new Set(cards).size !== cards.length) return false;
  if (!cards.every(c => Number.isInteger(c) && hand.includes(c))) return false;
  const r = rankOf(cards[0]);
  return cards.every(c => rankOf(c) === r) && fits(cards[0], T);
}
export const playable = (hand, T) => hand.filter(c => fits(c, T));
export const sameRank = (hand, c) => hand.filter(x => rankOf(x) === rankOf(c));

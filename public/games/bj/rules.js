// Blackjack rules shared by the server and the browser. Cards use the poker numbering
// (0..51: rank = c % 13 with 0 = two .. 12 = ace, suit = c / 13 | 0), so the poker card pictures draw them as they are.
export const START = 1000;   // pretend chips everyone starts with
export const MIN_BET = 10, MAX_BET = 500, BET_STEP = 10;
export const DECKS = 4;      // cards in the shoe: four full decks, shuffled again when it runs low

// What a card is worth: ace 11 (dropped to 1 when needed), faces 10.
export const cardVal = c => { const r = c % 13; return r === 12 ? 11 : r >= 8 ? 10 : r + 2; };
// Best total of a hand, and whether an ace still counts as 11 ("soft"). Hidden cards (below 0) are skipped.
export function total(cards) {
  let v = 0, aces = 0;
  for (const c of cards) { if (c < 0) continue; const x = cardVal(c); v += x; if (x === 11) aces++; }
  while (v > 21 && aces) { v -= 10; aces--; }
  return { v, soft: aces > 0 };
}
export const isBlackjack = cards => cards.length === 2 && total(cards).v === 21;
export const isPair = cards => cards.length === 2 && cards[0] % 13 === cards[1] % 13;
// The bets a player with this many chips may place: tens from the minimum up, or the whole stack when it is smaller.
export const betRange = stack => ({ min: Math.min(MIN_BET, stack), max: Math.min(MAX_BET, stack) });
export const betOk = (amt, stack) => { const { min, max } = betRange(stack); return Number.isInteger(amt) && amt >= min && amt <= max && amt > 0 && (amt % BET_STEP === 0 || amt === stack); };

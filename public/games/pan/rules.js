// Pan rules shared by the server and the browser. Cards use the poker numbering (0..51: rank = c % 13 with
// 0 = two .. 12 = ace, suit = c / 13 | 0 with hearts first), so the poker card pictures draw them as they are.
// Pan is played with the 24 cards from nine to ace.
export const NINE = 7, NINE_H = 7; // the rank of a nine, and the nine of hearts itself
export const rankOf = c => c % 13;
export const suitOf = c => c / 13 | 0;
export const isSpade = c => suitOf(c) === 3; // a spade on top sends the next turn to the player before you
export const deck = () => { const d = []; for (let s = 0; s < 4; s++) for (let r = NINE; r <= 12; r++) d.push(s * 13 + r); return d; };
export const SEATS = [2, 3, 4, 6]; // table sizes that share 24 cards evenly
export const seatsFor = (want, people = 0) => SEATS.find(n => n >= Math.max(want || 0, people)) || 6;
export const sortHand = h => [...h].sort((a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b));
export const top = pile => pile[pile.length - 1];

// May these cards (all from `hand`) be put on the pile together?
// The first move of the game is the nine of hearts, alone or with the other three nines.
// After that: one card at least as high as the top card, or all four cards of such a rank at once,
// or the three other nines straight onto the nine of hearts.
export function canPlay(hand, pile, cards) {
  if (!Array.isArray(cards) || !cards.length || new Set(cards).size !== cards.length) return false;
  if (!cards.every(c => Number.isInteger(c) && hand.includes(c))) return false;
  const r = rankOf(cards[0]), k = cards.length;
  if (!cards.every(c => rankOf(c) === r)) return false;
  if (!pile.length) return cards.includes(NINE_H) && (k === 1 || k === 4);
  if (r < rankOf(top(pile))) return false;
  return k === 1 || k === 4 || (k === 3 && r === NINE && pile.length === 1);
}
// How many cards a player picks up instead of playing: three off the top, never the nine of hearts at the bottom.
export const drawCount = pile => Math.min(3, Math.max(0, pile.length - 1));

// Every set of cards this hand may play right now.
export function plays(hand, pile) {
  const out = [], by = new Map();
  for (const c of hand) { const r = rankOf(c); by.set(r, [...(by.get(r) || []), c]); }
  if (!pile.length) { if (hand.includes(NINE_H)) { out.push([NINE_H]); if (by.get(NINE).length === 4) out.push(by.get(NINE)); } return out; }
  for (const c of hand) if (canPlay(hand, pile, [c])) out.push([c]);
  for (const [, cs] of by) if (cs.length >= 3 && canPlay(hand, pile, cs)) out.push(cs);
  return out;
}

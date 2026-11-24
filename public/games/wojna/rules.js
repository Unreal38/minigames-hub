// Wojna (War) rules shared by the server and the browser. Cards use the poker numbering (0..51: rank = c % 13
// with 0 = two .. 12 = ace, suit = c / 13 | 0), so the poker card pictures draw them as they are. Suits never matter.
export const rankOf = c => c % 13;
export const SEATS = [2, 3, 4];
export const seatsFor = (want, people = 0) => Math.min(4, Math.max(2, want || 0, people));
export const ROUNDS = [30, 60, 120];   // the battle caps a host can choose: after the last one, most cards wins
export const TIMERS = [3, 5, 10];      // seconds before a card is turned over for a player who waits
// The whole deck, or the short one from nine to ace. It must share out evenly, so three players with the whole
// deck leave out the two of clubs (the short deck's 24 cards divide by two, three and four).
export function deckFor(kind, n) {
  const d = [], lo = kind === 'small' ? 7 : 0;
  for (let s = 0; s < 4; s++) for (let r = lo; r <= 12; r++) d.push(s * 13 + r);
  while (d.length % n) d.splice(d.indexOf(26 + lo + (d.length % n) - 1), 1);
  return d;
}
// Who holds the highest card among `tops` ([seat, card] pairs)? One seat = the winner, more = a war between them.
export function highest(tops) {
  const best = Math.max(...tops.map(([, c]) => rankOf(c)));
  return tops.filter(([, c]) => rankOf(c) === best).map(([s]) => s);
}

// Texas Hold'em rules shared by the server and the browser: cards, hand ranking and names.
// A card is 0..51: rank = c % 13 (0 = two .. 12 = ace), suit = c / 13 | 0 (hearts, diamonds, clubs, spades).
import { L } from '../../i18n.js';
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_NAMES = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const PLURAL = ['Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];
export const SUITS = ['♥', '♦', '♣', '♠'];
export const SUIT_NAMES = ['hearts', 'diamonds', 'clubs', 'spades'];
export const rankOf = c => c % 13;
export const suitOf = c => c / 13 | 0;
export const isRed = c => suitOf(c) < 2;
const RANK_PL = ['Dwójka', 'Trójka', 'Czwórka', 'Piątka', 'Szóstka', 'Siódemka', 'Ósemka', 'Dziewiątka', 'Dziesiątka', 'Walet', 'Dama', 'Król', 'As'], SUIT_PL = ['kier', 'karo', 'trefl', 'pik'];
export const cardLabel = c => L(`${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`, `${RANK_PL[rankOf(c)]} ${SUIT_PL[suitOf(c)]}`);
export const CATS = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

// Best five of up to seven cards. Returns a number: bigger is better (category * 13^5 + tie-breakers).
const B = 13;
const pack = (cat, ks) => { let v = cat; for (let i = 0; i < 5; i++) v = v * B + (ks[i] ?? 0); return v; };
function straightTop(mask) { // mask of ranks present; returns the top rank of the best straight or -1
  for (let top = 12; top >= 3; top--) {
    let ok = true;
    for (let k = 0; k < 5; k++) { const r = top - k; if (!(mask >> (r < 0 ? 12 : r) & 1)) { ok = false; break; } }
    if (ok) return top;
  }
  return -1;
}
export function score(cards) {
  const cnt = new Array(13).fill(0), suitMask = [0, 0, 0, 0], suitN = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) { const r = c % 13, s = c / 13 | 0; cnt[r]++; mask |= 1 << r; suitMask[s] |= 1 << r; suitN[s]++; }
  const fs = suitN.findIndex(n => n >= 5);
  if (fs >= 0) {
    const sf = straightTop(suitMask[fs]);
    if (sf >= 0) return pack(8, [sf]);
  }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) ({ 4: quads, 3: trips, 2: pairs, 1: singles })[cnt[r]]?.push(r);
  if (quads.length) { const k = [...trips, ...pairs, ...singles].filter(r => r !== quads[0]); return pack(7, [quads[0], Math.max(...k, -1)]); }
  if (trips.length && (trips.length > 1 || pairs.length)) { const p = Math.max(trips[1] ?? -1, pairs[0] ?? -1); return pack(6, [trips[0], p]); }
  if (fs >= 0) { const ks = []; for (let r = 12; r >= 0 && ks.length < 5; r--) if (suitMask[fs] >> r & 1) ks.push(r); return pack(5, ks); }
  const st = straightTop(mask);
  if (st >= 0) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) { const k = [...pairs.slice(2), ...singles]; return pack(2, [pairs[0], pairs[1], Math.max(...k, -1)]); }
  if (pairs.length) return pack(1, [pairs[0], ...singles.slice(0, 3)]);
  return pack(0, singles.slice(0, 5));
}
export const catOf = v => Math.floor(v / B ** 5);
const keys = v => { const k = []; for (let i = 0; i < 5; i++) { k.unshift(v % B); v = Math.floor(v / B); } return k; };

// "Pair of Kings", "Full house, Sevens over Twos", "Straight to the Nine"...
export function handName(v) {
  const c = catOf(v), k = keys(v);
  switch (c) {
    case 8: return k[0] === 12 ? 'Royal flush' : `Straight flush to the ${RANK_NAMES[k[0]]}`;
    case 7: return `Four ${PLURAL[k[0]]}`;
    case 6: return `Full house, ${PLURAL[k[0]]} over ${PLURAL[k[1]]}`;
    case 5: return `Flush, ${RANK_NAMES[k[0]]} high`;
    case 4: return `Straight to the ${RANK_NAMES[k[0]]}`;
    case 3: return `Three ${PLURAL[k[0]]}`;
    case 2: return `Two pair, ${PLURAL[k[0]]} and ${PLURAL[k[1]]}`;
    case 1: return `Pair of ${PLURAL[k[0]]}`;
    default: return `${RANK_NAMES[k[0]]} high`;
  }
}
// Short version for small labels.
export function handShort(v) {
  const c = catOf(v), k = keys(v);
  return [`${RANKS[k[0]]} high`, `Pair of ${RANKS[k[0]]}s`, 'Two pair', 'Trips', 'Straight', 'Flush', 'Full house', 'Quads', k[0] === 12 && c === 8 ? 'Royal flush' : 'Straight flush'][c];
}

// Which of the given cards make up the best five (for highlighting). Brute force over the 5-card subsets.
export function bestFive(cards) {
  if (cards.length <= 5) return cards.slice();
  const want = score(cards); let best = null;
  const n = cards.length, pick = [];
  const rec = (i) => {
    if (best) return;
    if (pick.length === 5) { if (score(pick) === want) best = pick.slice(); return; }
    for (let j = i; j < n; j++) { pick.push(cards[j]); rec(j + 1); pick.pop(); if (best) return; }
  };
  rec(0);
  return best || cards.slice(0, 5);
}

export const HAND_ORDER = [
  [L('Royal flush', 'Poker królewski'), L('A K Q J 10, all one suit', 'A K Q J 10, wszystkie w jednym kolorze')], [L('Straight flush', 'Poker'), L('Five in a row, one suit', 'Pięć kart po kolei w jednym kolorze')],
  [L('Four of a kind', 'Kareta'), L('Four cards of one rank', 'Cztery karty tej samej wysokości')], [L('Full house', 'Ful'), L('Three of a kind plus a pair', 'Trójka plus para')],
  [L('Flush', 'Kolor'), L('Any five of one suit', 'Dowolne pięć kart w jednym kolorze')], [L('Straight', 'Strit'), L('Five in a row (A can be low)', 'Pięć kart po kolei (as może być najniższy)')],
  [L('Three of a kind', 'Trójka'), L('Three cards of one rank', 'Trzy karty tej samej wysokości')], [L('Two pair', 'Dwie pary'), L('Two different pairs', 'Dwie różne pary')],
  [L('Pair', 'Para'), L('Two cards of one rank', 'Dwie karty tej samej wysokości')], [L('High card', 'Wysoka karta'), L('Nothing else? Highest card plays', 'Nic więcej? Liczy się najwyższa karta')],
];

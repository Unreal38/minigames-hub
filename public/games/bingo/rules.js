// Sky Bingo rules shared by the server and the browser. A card is 25 numbers, row by row; column c holds numbers
// from c*15+1 to c*15+15 (the B, I, N, G and O columns), and the middle square is 0: the free star.
// What a player has daubed is a 25-bit mask (bit r*5+c).
import { L } from '../../i18n.js';

export const BALLS = 75, MID = 12, ALL = (1 << 25) - 1;
export const LETTERS = 'BINGO';
export const letterOf = n => LETTERS[(n - 1) / 15 | 0];
export const colOf = n => (n - 1) / 15 | 0;

// The three prizes of a classic game, in order, and what each is worth. A quick game stops after the first line.
export const GAMES = { quick: ['line'], classic: ['line', 'two', 'full'] };
export const PTS = { line: 10, two: 20, full: 40 };
export const goalName = g => g === 'two' ? L('Two lines', 'Dwie linie') : g === 'full' ? L('Full card', 'Cała karta') : L('One line', 'Jedna linia');
// How long between two balls, in ms.
export const SPEED = { chill: 6000, normal: 4400, fast: 3000 };

// The twelve lines of a card as masks: five rows, five columns, two diagonals.
export const LINES = (() => {
  const out = [];
  for (let r = 0; r < 5; r++) out.push([0, 1, 2, 3, 4].map(c => r * 5 + c));
  for (let c = 0; c < 5; c++) out.push([0, 1, 2, 3, 4].map(r => r * 5 + c));
  out.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return out.map(cells => cells.reduce((m, c) => m | 1 << c, 0));
})();
const bits = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };
export const count = bits;

// A fresh card: five different numbers per column, the middle free.
export function newCard(rand = Math.random) {
  const card = new Array(25).fill(0);
  for (let c = 0; c < 5; c++) {
    const pool = Array.from({ length: 15 }, (_, i) => c * 15 + i + 1);
    for (let r = 0; r < 5; r++) card[r * 5 + c] = pool.splice(rand() * pool.length | 0, 1)[0];
  }
  card[MID] = 0;
  return card;
}
export const doneLines = mask => LINES.filter(l => (mask & l) === l);
export const has = (goal, mask) => goal === 'full' ? (mask & ALL) === ALL : doneLines(mask).length >= (goal === 'two' ? 2 : 1);
// How many more squares this card needs for the goal.
export function toGo(goal, mask) {
  if (goal === 'full') return 25 - bits(mask & ALL);
  let best = 25;
  if (goal === 'line') { for (const l of LINES) best = Math.min(best, bits(l & ~mask)); return best; }
  for (let i = 0; i < LINES.length; i++) for (let j = i + 1; j < LINES.length; j++) best = Math.min(best, bits((LINES[i] | LINES[j]) & ~mask));
  return best;
}
// The squares that make up the finished goal, as a mask (for the glow on a winning card).
export function goalCells(goal, mask) {
  if (goal === 'full') return ALL;
  return doneLines(mask).slice(0, goal === 'two' ? 2 : 1).reduce((m, l) => m | l, 0);
}

// Pip Party rules shared by the server and the client: the 13 boxes on the score sheet and what a roll is worth in each.
// The ruleset follows the classic Polish five-dice game: 13 rounds, three rolls a round, keep any dice between rolls,
// then write the roll into one empty box (a 0 when it does not fit). Upper boxes 63+ pay a 35 bonus.
export const ROUNDS = 13 /* per column */, ROLLS = 3, NDICE = 5;
export const UPPER_NEED = 63, UPPER_BONUS = 35, GEN_BONUS = 100;
// box ids in sheet order; 0..5 are ones..sixes
export const BOXES = ['1', '2', '3', '4', '5', '6', 'k3', 'k4', 'full', 'ss', 'ls', 'gen', 'ch'];
export const UPPER = BOXES.slice(0, 6), LOWER = BOXES.slice(6);
export const LABEL = { 1: 'Ones', 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', k3: 'Three alike', k4: 'Four alike', full: 'Full house', ss: 'Small run', ls: 'Big run', gen: 'Pip Party', ch: 'Chance' };
export const SHORT = { 1: 'Ones', 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', k3: '3 alike', k4: '4 alike', full: 'Full', ss: 'Sm. run', ls: 'Big run', gen: 'Party', ch: 'Chance' };
export const HINT = { 1: 'Add up the ones', 2: 'Add up the twos', 3: 'Add up the threes', 4: 'Add up the fours', 5: 'Add up the fives', 6: 'Add up the sixes',
  k3: '3 the same: all five dice added up', k4: '4 the same: all five dice added up', full: '3 the same + a pair: 25', ss: '4 in a row: 30', ls: '5 in a row: 40', gen: 'All 5 the same: 50', ch: 'Anything: all five dice added up' };

export const counts = dice => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of dice) c[v]++; return c; };
export const sum = dice => dice.reduce((a, b) => a + b, 0);
export const isGen = dice => dice.length === NDICE && dice.every(v => v === dice[0]);
const run = (c, from, len) => { for (let v = from; v < from + len; v++) if (!c[v]) return false; return true; };

// What the dice score in a box, ignoring jokers.
export function plain(box, dice) {
  const c = counts(dice), mx = Math.max(...c);
  switch (box) {
    case 'k3': return mx >= 3 ? sum(dice) : 0;
    case 'k4': return mx >= 4 ? sum(dice) : 0;
    case 'full': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'ss': return run(c, 1, 4) || run(c, 2, 4) || run(c, 3, 4) ? 30 : 0;
    case 'ls': return run(c, 1, 5) || run(c, 2, 5) ? 40 : 0;
    case 'gen': return mx === 5 ? 50 : 0;
    case 'ch': return sum(dice);
    default: { const f = +box; return f >= 1 && f <= 6 ? c[f] * f : 0; }
  }
}
// A sheet is a list of columns: one in the classic game, three in the triple game, where the second column counts
// double and the third triple (so its 63 bonus is worth 105). Every column has all 13 boxes.
export const MULT = [1, 2, 3];
// A further five-of-a-kind is a joker once every column's Pip Party box and every column's top box for that number
// are filled: in the lower boxes it scores as a full house (25), small run (30), big run (40) or the dice sum.
export const joker = (dice, cols) => isGen(dice) && cols.every(c => c.gen != null && c[dice[0]] != null);
// What the dice score in a box of one column, before the column's multiplier.
export function score(box, dice, cols) {
  if (joker(dice, cols) && LOWER.includes(box) && box !== 'gen') return { full: 25, ss: 30, ls: 40 }[box] ?? sum(dice);
  return plain(box, dice);
}
// Every further five-of-a-kind pays a 100-point bonus (times the column it is written in), whichever empty box it
// goes into, once the Pip Party box holds its 50. On the triple sheet all three Pip Party boxes must hold 50 and no
// five-of-a-kind may have been written somewhere else while one of them was still empty (`wasted`).
export const genBonus = (dice, cols, ci = 0, wasted = false) => (isGen(dice) && cols.every(c => c.gen === 50) && !(wasted && cols.length > 1) ? GEN_BONUS * MULT[ci] : 0);
// What writing the dice into that box adds to the player's total.
export const worth = (box, dice, cols, ci = 0, wasted = false) => score(box, dice, cols) * MULT[ci] + genBonus(dice, cols, ci, wasted);

export const open = sheet => BOXES.filter(b => sheet[b] == null);
export const upperSum = sheet => UPPER.reduce((a, b) => a + (sheet[b] || 0), 0);
export const lowerSum = sheet => LOWER.reduce((a, b) => a + (sheet[b] || 0), 0);
export const bonusOf = sheet => (upperSum(sheet) >= UPPER_NEED ? UPPER_BONUS : 0);
export const colTotal = sheet => upperSum(sheet) + bonusOf(sheet) + lowerSum(sheet);
export const total = (cols, extra = 0) => cols.reduce((a, c, i) => a + colTotal(c) * MULT[i], 0) + extra;
export const openCount = cols => cols.reduce((a, c) => a + open(c).length, 0);
export const blankCols = n => Array.from({ length: n }, blankSheet);
export const blankSheet = () => Object.fromEntries(BOXES.map(b => [b, null]));

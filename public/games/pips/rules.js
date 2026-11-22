// Pip Party rules shared by the server and the client: the 13 boxes on the score sheet and what a roll is worth in each.
// The ruleset follows the classic Polish five-dice game: 13 rounds, three rolls a round, keep any dice between rolls,
// then write the roll into one empty box (a 0 when it does not fit). Upper boxes 63+ pay a 35 bonus.
export const ROUNDS = 13, ROLLS = 3, NDICE = 5;
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
// A second five-of-a-kind is a joker once its box and the matching upper box are both filled:
// in the lower boxes it scores as a full house (25), small run (30), big run (40) or the dice sum.
export const joker = (dice, sheet) => isGen(dice) && sheet.gen != null && sheet[dice[0]] != null;
export function score(box, dice, sheet) {
  if (joker(dice, sheet) && LOWER.includes(box) && box !== 'gen') return { full: 25, ss: 30, ls: 40 }[box] ?? sum(dice);
  return plain(box, dice);
}
// The 100-point bonus for another five-of-a-kind: only when the first one went into its own box for 50 and this one is played as a joker.
export const genBonus = (dice, sheet) => joker(dice, sheet) && sheet.gen === 50 ? GEN_BONUS : 0;

export const open = sheet => BOXES.filter(b => sheet[b] == null);
export const upperSum = sheet => UPPER.reduce((a, b) => a + (sheet[b] || 0), 0);
export const lowerSum = sheet => LOWER.reduce((a, b) => a + (sheet[b] || 0), 0);
export const bonusOf = sheet => (upperSum(sheet) >= UPPER_NEED ? UPPER_BONUS : 0);
export const total = (sheet, extra = 0) => upperSum(sheet) + bonusOf(sheet) + lowerSum(sheet) + extra;
export const blankSheet = () => Object.fromEntries(BOXES.map(b => [b, null]));

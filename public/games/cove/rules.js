// Cove Clash rules shared by the server and the browser. Each player has an n×n bay (a flat array of cells, row by
// row) and a fleet of boats. A boat is { c, len, v }: its first square (the top or left end), how many squares long
// it is, and v = 1 when it points down the bay instead of across. Boats never touch, not even at the corners.
import { L } from '../../i18n.js';

// classic: the fleet of Polish "statki". quick: a small bay for a short game.
export const BOARDS = {
  classic: { n: 10, fleet: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] },
  quick: { n: 7, fleet: [3, 2, 2, 1, 1, 1] },
};
export const boardOf = b => BOARDS[b] || BOARDS.classic;
export const boardName = b => (b === 'quick' ? L('Quick', 'Szybka') : L('Classic', 'Klasyczna'));
// What a square of a bay shows to the player shooting at it.
export const SEA = 0, MISS = 1, HIT = 2, CLEAR = 3; // CLEAR: water next to a sunk boat, marked for free

// The squares a boat covers, or null when it sticks out of the bay.
export function cellsOf(b, n) {
  if (!b || !Number.isInteger(b.c) || !Number.isInteger(b.len) || b.len < 1 || b.c < 0 || b.c >= n * n) return null;
  const r = b.c / n | 0, q = b.c % n;
  if (b.v ? r + b.len > n : q + b.len > n) return null;
  return Array.from({ length: b.len }, (_, i) => (b.v ? b.c + i * n : b.c + i));
}
// The squares round a set of squares (the eight neighbours of each), without the set itself.
export function around(cells, n) {
  const own = new Set(cells), out = new Set();
  for (const c of cells) {
    const r = c / n | 0, q = c % n;
    for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) {
      const rr = r + dr, qq = q + dq;
      if (rr < 0 || rr >= n || qq < 0 || qq >= n) continue;
      const x = rr * n + qq; if (!own.has(x)) out.add(x);
    }
  }
  return [...out];
}
// Can boat number i sit where it is, given the other boats? (inside the bay, and touching nobody)
export function fits(boats, i, n) {
  const mine = cellsOf(boats[i], n); if (!mine) return false;
  const near = new Set([...mine, ...around(mine, n)]);
  for (let j = 0; j < boats.length; j++) {
    if (j === i || !boats[j]) continue;
    const other = cellsOf(boats[j], n); if (!other || other.some(c => near.has(c))) return false;
  }
  return true;
}
// A whole layout is fine when it has exactly the board's boats, in order, and every one fits.
export function validFleet(boats, board) {
  const B = boardOf(board);
  if (!Array.isArray(boats) || boats.length !== B.fleet.length) return false;
  for (let i = 0; i < boats.length; i++) if (!boats[i] || boats[i].len !== B.fleet[i] || !fits(boats, i, B.n)) return false;
  return true;
}
// A random layout. rnd() gives numbers from 0 up to (not including) 1.
export function randomFleet(board, rnd = Math.random) {
  const B = boardOf(board), n = B.n;
  for (let tries = 0; tries < 200; tries++) {
    const boats = []; let ok = true;
    for (const len of B.fleet) {
      let placed = false;
      for (let k = 0; k < 300 && !placed; k++) {
        const v = len > 1 && rnd() < .5 ? 1 : 0, r = rnd() * (v ? n - len + 1 : n) | 0, q = rnd() * (v ? n : n - len + 1) | 0;
        boats.push({ c: r * n + q, len, v });
        if (fits(boats, boats.length - 1, n)) placed = true; else boats.pop();
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return boats;
  }
  throw new Error('no room for the fleet');
}
// Which boat (its number) is on each square, -1 for open water.
export function fleetMap(boats, n) {
  const map = Array(n * n).fill(-1);
  boats.forEach((b, i) => { for (const c of cellsOf(b, n) || []) map[c] = i; });
  return map;
}

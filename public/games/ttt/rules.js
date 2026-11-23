// Tic-Tac-Toe rules shared by the server and the browser. The board is a flat array of n*n cells holding -1 (empty)
// or the seat (0 or 1) whose mark is there. Seat 0 plays crosses, seat 1 plays noughts, for the whole match.
import { L } from '../../i18n.js';

// classic: 3×3, three in a row. fade: 3×3 where you only ever keep three marks: placing a fourth wipes your oldest,
// so a round can never end in a full board. big: 5×5, four in a row.
export const MODES = {
  classic: { n: 3, k: 3, keep: 0 },
  fade: { n: 3, k: 3, keep: 3 },
  big: { n: 5, k: 4, keep: 0 },
};
export const modeOf = m => MODES[m] || MODES.classic;
export const modeName = m => m === 'fade' ? L('Vanishing', 'Znikające') : m === 'big' ? L('Big board', 'Duża plansza') : L('Classic', 'Klasyczne');
export const FADE_CAP = 40; // a vanishing round that nobody wins in this many marks is a draw

// Every run of k cells in a row, column or diagonal of an n×n board (cached).
const LINES = new Map();
export function lines(n, k) {
  const key = n * 100 + k;
  if (LINES.has(key)) return LINES.get(key);
  const out = [], at = (r, c) => r * n + c;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const er = r + dr * (k - 1), ec = c + dc * (k - 1);
      if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
      out.push(Array.from({ length: k }, (_, j) => at(r + dr * j, c + dc * j)));
    }
  LINES.set(key, out);
  return out;
}

// The first full line on the board: { s, cells }, or null.
export function winLine(board, n, k) {
  for (const ln of lines(n, k)) { const s = board[ln[0]]; if (s >= 0 && ln.every(c => board[c] === s)) return { s, cells: ln }; }
  return null;
}

// The cell that would vanish when seat s places its next mark (vanishing mode), or -1.
export const fadeNext = (order, s, keep) => (keep && order[s].length >= keep ? order[s][0] : -1);

// Puts seat s's mark on cell c. Returns { board, order, gone } (new arrays), or null when the move is not allowed.
// In vanishing mode the oldest mark leaves first, so the cell it frees can be played straight away by the other player
// but not by you (you cannot put the new mark back on the cell that just vanished).
export function place(board, order, s, c, mode) {
  const M = modeOf(mode);
  if (!Number.isInteger(c) || c < 0 || c >= M.n * M.n || board[c] !== -1) return null;
  const b = board.slice(), o = [order[0].slice(), order[1].slice()];
  let gone = -1;
  if (M.keep && o[s].length >= M.keep) { gone = o[s].shift(); b[gone] = -1; }
  b[c] = s; o[s].push(c);
  return { board: b, order: o, gone };
}
export const full = board => board.every(x => x >= 0);
export const empty = n => Array(n * n).fill(-1);

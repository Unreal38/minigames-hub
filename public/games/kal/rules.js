// Kalambury (Sketch & Guess): what the server and the page share. The drawing board is always 800 × 600 "board
// units", whatever its size on screen, so every screen replays exactly the same picture (the fill bucket needs that).
import { L } from '../../i18n.js';

export const BW = 800, BH = 600;
// The paint box: two rows of nine. WHITE is also what the eraser draws with.
export const COLORS = ['#1d1a1a', '#6b6b6b', '#e5392f', '#ff8a1f', '#ffd92e', '#4cc04a', '#37b8f2', '#2f55d4', '#9a4fd0',
  '#ffffff', '#c9c9c9', '#8f1d17', '#a3582a', '#f6c9a0', '#1f7a3a', '#f48fb5', '#17306e', '#5c2a82'];
export const WHITE = 9;
export const SIZES = [4, 10, 22, 44];           // pen widths in board units
// What the drawer sends, as small arrays: [START, colour, size, x, y] · [MOVE, x, y, x, y, …] · [FILL, colour, x, y] · [UNDO] · [CLEAR]
export const OP = { START: 0, MOVE: 1, FILL: 2, UNDO: 3, CLEAR: 4 };

export const ROUNDS = [2, 3, 5], TIMES = [60, 80, 120];
export const THEMES = ['all', 'animals', 'food', 'things', 'nature', 'people', 'fun', 'pets'];
export const themeName = t => ({ all: L('Everything', 'Wszystko'), animals: L('Animals', 'Zwierzęta'), food: L('Food', 'Jedzenie'), things: L('Things', 'Przedmioty'),
  nature: L('Nature and places', 'Przyroda i miejsca'), people: L('People and tales', 'Ludzie i bajki'), fun: L('Rides and play', 'Pojazdy i zabawa'), pets: L('Pet Farm pets', 'Zwierzaki z farmy') })[t] || t;

// Points for a correct guess: 100 right away, sliding down to 40 at the very end of the time.
export const GUESS_MAX = 100, GUESS_MIN = 40;
export const guessPts = (left, total) => Math.round(GUESS_MIN + (GUESS_MAX - GUESS_MIN) * Math.max(0, Math.min(1, left / Math.max(1, total))));
// The drawer earns the average of what the guessers earned, counting those who never guessed as zero.
export const drawPts = (got, guessers) => Math.round(got.reduce((a, b) => a + b, 0) / Math.max(1, guessers));

// Two guesses are the same word when they match without capitals, accents, spaces and dashes ("Żółw" = "zolw").
export const norm = s => String(s ?? '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');
// How many letters apart two words are (insert, drop or swap a letter).
export function apart(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// "So close!": one letter off (two for long words). Short words get no such help.
export const isNear = (guess, word) => { const n = word.length; return n >= 4 && guess !== word && apart(guess, word) <= (n >= 9 ? 2 : 1); };
// Which characters of a word are letters to hide (spaces and dashes always show).
export const isLetter = ch => /[\p{L}\p{N}]/u.test(ch);

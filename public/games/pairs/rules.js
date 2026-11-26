// Pet Pairs rules shared by the server and the browser: a turn-based memory game with Pet Farm pet cards.
// A board is cols x rows face-down cards, two of each pet. Flip two: the same pet and you keep the pair and go
// again, different and they turn back and the next player goes. Three special pairs (a table option) do something
// extra when matched: Golden is worth 3, Spyglass lets you secretly peek at one card, Whirlwind swaps two pairs
// of face-down cards in front of everyone. Pet names are the same in every language, so nothing here needs translating.
export const BOARDS = { small: [5, 4], mid: [6, 6], big: [8, 6] }; // cols x rows: 10, 18 and 24 pairs
export const TWISTS = ['gold', 'spy', 'mix'];
export const PTS = { gold: 3 }; // points for a pair; anything else is 1
export const ptsOf = tw => PTS[tw] || 1;
export const TIMERS = [0, 6, 10, 15];
// 'auto' picks the board by how many sit at the table: two play Small, three or four Medium, five or six Big
export const boardOf = (pick, n) => (BOARDS[pick] ? pick : n <= 2 ? 'small' : n <= 4 ? 'mid' : 'big');

// Pet Mahjong: the rules shared by the browser and the server, for the solo game and for the race table.
// Tiles lie in stacked layers. A tile is FREE when nothing lies on it and its left or its right side is open.
// Two free tiles with the same picture make a pair and leave the board. Clear every tile to win.
// Positions are counted in half tiles: a tile at (x, y) covers x..x+2 and y..y+2, so tiles can sit half a step off.
import { L } from '../../i18n.js';

// ---------- the pictures ----------
// 36 kinds, four tiles of each on a full board: three suits counted 1 to 9 (leaves, berries, stars) and nine pets.
export const SUITS = ['leaf', 'berry', 'star'];
export const PETS = ['cindercub', 'zapkit', 'sproutle', 'waddlet', 'wattbat', 'axolily', 'mossbun', 'nimbowhale', 'snowfox']; // Pet Farm species, never translated
export const PET_COLOR = ['#ffb37a', '#ffe27a', '#b5e59a', '#9cc6f5', '#c7b3f2', '#ffc0d8', '#cfe8b0', '#b5dcf2', '#e6eef8'];
export const NKINDS = 36;
export const isPet = k => k >= 27;
export const suitOf = k => (k / 9) | 0, rankOf = k => k % 9 + 1;
export const kindName = k => isPet(k) ? PETS[k - 27][0].toUpperCase() + PETS[k - 27].slice(1)
  : [L('leaf', 'listek'), L('berry', 'jagoda'), L('star', 'gwiazdka')][suitOf(k)] + ' ' + rankOf(k);

// ---------- the layouts ----------
// Each layer: [x, y, rows]: where its top left tile sits (in half tiles) and one string per row, X = a tile.
// Every layout is at most 9 tiles wide, so it also fits an upright phone.
const LAYOUTS = {
  pond: { name: L('Pond', 'Staw'), layers: [
    [0, 0, ['.XXXX.', 'XXXXXX', 'XXXXXX', '.XXXX.']],
    [4, 2, ['XX', 'XX']] ] },
  bridge: { name: L('Bridge', 'Most'), layers: [
    [0, 0, ['XX....XX', 'XXXXXXXX', 'XXXXXXXX', 'XX....XX']],
    [2, 2, ['XXXXXX', 'XXXXXX']] ] },
  clover: { name: L('Clover', 'Koniczyna'), layers: [
    [0, 0, ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.XX.XX.']],
    [2, 2, ['X...X', '.....', '.XXX.', '.....', 'X...X']] ] },
  fort: { name: L('Fort', 'Fort'), layers: [
    [0, 0, ['XXXXXXXX', 'XXXXXXXX', 'XX....XX', 'XX....XX', 'XXXXXXXX', 'XXXXXXXX']],
    [0, 0, ['XX....XX', 'XX....XX', '........', '........', 'XX....XX', 'XX....XX']],
    [1, 1, ['X.....X', '.......', '.......', '.......', 'X.....X']] ] },
  steps: { name: L('Steps', 'Schody'), layers: [
    [0, 0, ['XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX']],
    [2, 2, ['XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX']],
    [4, 4, ['XXXX', 'XXXX']] ] },
  butterfly: { name: L('Butterfly', 'Motyl'), layers: [
    [0, 0, ['XXX...XXX', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXX.XXXX', 'XXX...XXX']],
    [0, 0, ['XX.....XX', 'XXX...XXX', 'XXX.X.XXX', 'XXX.X.XXX', 'XXX.X.XXX', 'XXX...XXX', 'XX.....XX']] ] },
  towers: { name: L('Twin Towers', 'Dwie wieże'), layers: [
    [0, 0, ['XXXX.XXXX', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXX.XXXX', 'XXXX.XXXX']],
    [0, 2, ['XXX...XXX', 'XXX...XXX', 'XXX...XXX', 'XXX...XXX', 'XXX...XXX', 'XXX...XXX']],
    [2, 2, ['X.....X', 'X.....X', 'X.....X', 'X.....X', 'X.....X', 'X.....X']],
    [2, 6, ['X.....X', 'X.....X']] ] },
  arena: { name: L('Arena', 'Arena'), layers: [
    [0, 0, ['.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.']],
    [2, 2, ['XXXXXXX', 'X.....X', 'X.XXX.X', 'X.XXX.X', 'X.XXX.X', 'X.XXX.X', 'X.....X', 'XXXXXXX']],
    [7, 7, ['XX', 'XX', 'XX']],
    [8, 8, ['X', 'X']] ] },
  isle: { name: L('Big Isle', 'Wielka wyspa'), layers: [
    [0, 0, ['XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX']],
    [2, 2, ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX']],
    [4, 4, ['XXXXX', 'XXXXX', 'XXXXX', 'XXXXX']],
    [6, 6, ['XXX', 'XXX']],
    [7, 6, ['XX', 'XX']] ] },
};
export const LAYOUT_IDS = Object.keys(LAYOUTS);
export const layoutName = id => LAYOUTS[id]?.name || '';

const cache = new Map();
// A layout ready to play: tiles [x, y, z] sorted from the bottom up, who lies on whom, and who stands beside whom.
export function layout(id) {
  if (cache.has(id)) return cache.get(id);
  const def = LAYOUTS[id]; if (!def) return null;
  const tiles = [];
  def.layers.forEach(([ox, oy, rows], z) => rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') tiles.push([ox + c * 2, oy + r * 2, z]); })));
  tiles.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const n = tiles.length, above = [], left = [], right = [];
  for (let i = 0; i < n; i++) {
    const [x, y, z] = tiles[i]; above.push([]); left.push([]); right.push([]);
    for (let j = 0; j < n; j++) {
      const [u, v, w] = tiles[j]; if (i === j || Math.abs(v - y) >= 2) continue;
      if (w === z + 1 && Math.abs(u - x) < 2) above[i].push(j);
      else if (w === z && u === x - 2) left[i].push(j);
      else if (w === z && u === x + 2) right[i].push(j);
    }
  }
  let w = 0, h = 0, top = 0; for (const [x, y, z] of tiles) { w = Math.max(w, x + 2); h = Math.max(h, y + 2); top = Math.max(top, z + 1); }
  const out = { id, name: def.name, tiles, n, above, left, right, w, h, top };
  cache.set(id, out); return out;
}

// ---------- playing ----------
// A board is a list with one entry per tile of the layout: the tile's kind, or -1 once it is gone.
const here = (b, list) => { for (const j of list) if (b[j] >= 0) return true; return false; };
export const isFree = (lay, b, i) => b[i] >= 0 && !here(b, lay.above[i]) && !(here(b, lay.left[i]) && here(b, lay.right[i]));
export const freeTiles = (lay, b) => { const out = []; for (let i = 0; i < lay.n; i++) if (isFree(lay, b, i)) out.push(i); return out; };
export const tilesLeft = b => { let n = 0; for (const v of b) if (v >= 0) n++; return n; };
export const canPair = (lay, b, i, j) => i !== j && Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < lay.n && j < lay.n && b[i] >= 0 && b[i] === b[j] && isFree(lay, b, i) && isFree(lay, b, j);
// Every pair that could be taken right now.
export function pairs(lay, b) {
  const free = freeTiles(lay, b), out = [];
  for (let p = 0; p < free.length; p++) for (let q = p + 1; q < free.length; q++) if (b[free[p]] === b[free[q]]) out.push([free[p], free[q]]);
  return out;
}
export const findMove = (lay, b) => { const free = freeTiles(lay, b), seen = new Map(); for (const i of free) { if (seen.has(b[i])) return [seen.get(b[i]), i]; seen.set(b[i], i); } return null; };

// ---------- dealing ----------
// Pictures are dealt backwards: two free places get the same picture and are taken off, over and over, so the
// order they were dealt in is one way to clear the whole board. rnd(n) gives a whole number below n.
function assign(lay, b, bag, rnd) {
  const live = b.map(v => (v >= 0 ? 0 : -1)), out = b.slice(); let k = 0;
  for (let left = tilesLeft(b); left > 0; left -= 2) {
    const free = freeTiles(lay, live); if (free.length < 2) return null;
    // tiles that hold others down go first more often: it keeps the last tiles from ending up stacked on each other
    const i = free.splice(rnd(free.length), 1)[0], j = free.splice(rnd(free.length), 1)[0];
    out[i] = out[j] = bag[k++]; live[i] = live[j] = -1;
  }
  return out;
}
const shuffled = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// A fresh board for a layout, with `kinds` different pictures (two pairs of each, as far as the tiles go).
export function deal(lay, kinds, rnd) {
  const use = shuffled([...Array(NKINDS).keys()], rnd).slice(0, Math.max(1, Math.min(NKINDS, kinds)));
  const bag = []; for (let p = 0; p < lay.n / 2; p++) bag.push(use[(p >> 1) % use.length]);
  const empty = Array(lay.n).fill(0);
  for (let t = 0; t < 400; t++) { const b = assign(lay, empty, shuffled(bag, rnd), rnd); if (b) return b; }
  return null;
}
// The tiles still on the board, mixed up so that there is a way to clear them. null when no mixing can help
// (the last tiles lie on top of each other).
export function reshuffle(lay, b, rnd) {
  const bag = []; const n = Array(NKINDS).fill(0);
  for (const v of b) if (v >= 0) n[v]++;
  n.forEach((c, k) => { for (let p = 0; p < c >> 1; p++) bag.push(k); });
  for (let t = 0; t < 80; t++) { const out = assign(lay, b, shuffled(bag, rnd), rnd); if (out) return out; }
  // luck did not find a way; with few tiles left, look for one properly
  if (bag.length > 9) return null;
  const order = clearOrder(lay, b.map(v => (v >= 0 ? 0 : -1))); if (!order) return null;
  const out = b.slice(), mix = shuffled(bag, rnd); order.forEach(([i, j], k) => { out[i] = out[j] = mix[k]; });
  return out;
}
// Some order of pairs of places that empties the board (the pictures do not matter here), or null when there is none.
function clearOrder(lay, live, dead = new Set()) {
  const free = freeTiles(lay, live); if (!tilesLeft(live)) return [];
  const key = live.join(''); if (free.length < 2 || dead.has(key)) return null;
  for (let p = 0; p < free.length; p++) for (let q = p + 1; q < free.length; q++) {
    const i = free[p], j = free[q]; live[i] = live[j] = -1;
    const rest = clearOrder(lay, live, dead); live[i] = live[j] = 0;
    if (rest) return [[i, j], ...rest];
  }
  dead.add(key); return null;
}
export const canClear = (lay, b) => !!clearOrder(lay, b.map(v => (v >= 0 ? 0 : -1)));
export const kindsFor = lay => Math.min(NKINDS, Math.ceil(lay.n / 4));

// ---------- the solo game ----------
export const DAILY = 40;        // most coins the solo game pays in a day
export const XP_CLEAR = 8;
export const PAIR_PTS = 20;     // points for a pair
export const QUICK_MS = 4000;   // a pair within this long of the last one keeps a streak going
export const QUICK_PTS = 5;     // extra points per step of the streak (up to QUICK_MAX steps)
export const QUICK_MAX = 6;
export const HINT_COST = 15;    // points a hint costs
export const PAR_MS = 6000;     // time allowed per pair for the fast star
export const TIME_PTS = 2;      // points per second under par
export const IDLE_MS = 15000;   // a longer pause than this does not count towards your time
const LADDER = ['pond', 'bridge', 'clover', 'fort', 'steps', 'butterfly', 'towers', 'arena', 'isle'];
const LATE = ['steps', 'butterfly', 'towers', 'arena', 'isle'];
// Level 1 is the smallest board; they grow up to the Big Isle, and after that the big boards take turns.
export function level(lv) {
  lv = Math.max(1, lv | 0);
  const id = lv <= LADDER.length ? LADDER[lv - 1] : LATE[(lv - LADDER.length - 1) % LATE.length], lay = layout(id);
  return { lv, id, kinds: kindsFor(lay), par: lay.n / 2 * PAR_MS };
}
export const starsFor = (ms, par, shuffles) => 1 + (ms <= par ? 1 : 0) + (shuffles ? 0 : 1);
export const coinsFor = stars => 3 + stars;

// ---------- the race ----------
export const RACE = { short: ['clover', 'fort'], normal: ['steps', 'butterfly'], long: ['towers', 'arena', 'isle'] };
export const SHUFFLE_HOLD = 4000;   // a racer with no pair left waits this long while their tiles are mixed
export const RACE_MAX = 15 * 60000; // a race is called after this long

// Pet Pop: a solo swap-and-match puzzle on a toy shelf full of Pet Farm pets. Shared by the server (which owns the
// shelf and rolls the pets that drop in) and the browser (which checks a swap before sending it and replays the
// server's steps as animation).
//
// Swap two neighbours so three or more of the same pet line up: they pop and the shelf refills from the top.
//   4 in a line        -> a Zoomer: when it pops it dashes along its row or column and pops everything on the way
//   an L or a T        -> a Pouncer: when it pops it pounces on the 3 x 3 patch around it
//   5 in a line        -> a Treat Bowl: swap it with a pet and every pet of that kind comes running
// Swapping two of those together does something bigger. Hay bales cannot be swapped; a match right next to one
// (or anything that pops through it) breaks it. Each level has goals to reach in a set number of moves.

export const W = 8, H = 8, N = W * H;
export const KINDS = ['cindercub', 'zapkit', 'sproutle', 'waddlet', 'wattbat', 'axolily']; // Pet Farm species, never translated
export const KIND_COLOR = ['#ff9a4d', '#ffd84a', '#8fd16a', '#6fa8ee', '#a98be8', '#ff9fc4'];

// What a cell holds. A pet is kind * 4 + power.
export const HOLE = -2, EMPTY = -1, BOWL = 30, BALE = 40; // BALE + 1 or BALE + 2: a hay bale that takes that many hits
export const PLAIN = 0, ZOOM_H = 1, ZOOM_V = 2, POUNCE = 3;
export const isPet = v => v >= 0 && v < 24;
export const kindOf = v => isPet(v) ? v >> 2 : -1;
export const powerOf = v => isPet(v) ? v & 3 : 0;
export const isBale = v => v > BALE;
export const movable = v => isPet(v) || v === BOWL;
const special = v => v === BOWL || powerOf(v) > 0;
const rowOf = i => i / W | 0, colOf = i => i % W;

// ---------- coins and stars ----------
export const DAILY = 40;                     // most coins Pet Pop pays in one day
export const coinsFor = stars => 3 + stars;  // a cleared level pays 4 to 6
export const XP_CLEAR = 8;                   // XP for a cleared level, while today's coins are still coming
export const MOVE_BONUS = 100;               // points for every move left over
export const starsFor = (left, moves) => 1 + (left >= Math.ceil(moves * .15) ? 1 : 0) + (left >= Math.ceil(moves * .3) ? 1 : 0);

// ---------- levels ----------
// Levels never end: they come from the level number, so everybody meets the same goals on the same shelf shape.
const SHAPES = [
  ['########', '########', '########', '########', '########', '########', '########', '########'],
  ['.######.', '########', '########', '########', '########', '########', '########', '.######.'],
  ['..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..'],
  ['########', '########', '########', '###..###', '###..###', '########', '########', '########'],
  ['###..###', '###..###', '########', '########', '########', '########', '###..###', '###..###'],
  ['########', '#.####.#', '########', '########', '########', '########', '#.####.#', '########'],
  ['#######.', '########', '########', '########', '########', '########', '########', '.#######'],
  ['##.##.##', '########', '########', '########', '########', '########', '########', '##.##.##'],
];
const prng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// level(lv) -> { lv, kinds, moves, mask, goals: [{ k: 'pet', kind, n } | { k: 'hay', n }], bales, strong }
export function level(lv) {
  lv = Math.max(1, lv | 0);
  const r = prng(lv * 7919), d = Math.min(lv, 24), kinds = lv <= 3 ? 5 : 6;
  const shape = lv <= 2 ? SHAPES[0] : SHAPES[Math.floor(r() * SHAPES.length)];
  const mask = shape.flatMap(row => [...row].map(ch => ch === '#' ? 1 : 0));
  const order = [...Array(kinds).keys()]; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const type = lv === 1 ? 0 : lv === 2 ? 1 : (lv - 1) % 4;
  const goals = []; let bales = 0, strong = 0, moves = 20;
  if (type === 0) { goals.push({ k: 'pet', kind: order[0], n: 14 + Math.round(d * .35) }); moves = 20; }
  else if (type === 1) { bales = Math.min(12, 7 + Math.round(d * .3)); strong = Math.max(0, Math.round((d - 8) * .2)); goals.push({ k: 'hay', n: bales }); moves = 24; }
  else if (type === 2) { const n = 10 + Math.round(d * .4); goals.push({ k: 'pet', kind: order[0], n }, { k: 'pet', kind: order[1], n }); moves = 24; }
  else { bales = Math.min(9, 5 + Math.round(d * .18)); strong = Math.max(0, Math.round((d - 10) * .15)); goals.push({ k: 'pet', kind: order[0], n: 10 + Math.round(d * .3) }, { k: 'hay', n: bales }); moves = 26; }
  return { lv, kinds, moves, mask, goals, bales, strong };
}

// ---------- looking at a shelf ----------
// How many of the same kind sit in a line through cell i (dx, dy = 1, 0 for the row; 0, 1 for the column).
function lineLen(b, i, dx, dy) {
  const k = kindOf(b[i]); if (k < 0) return 0;
  let n = 1;
  for (const s of [-1, 1]) { let x = colOf(i) + s * dx, y = rowOf(i) + s * dy; while (x >= 0 && x < W && y >= 0 && y < H && kindOf(b[y * W + x]) === k) { n++; x += s * dx; y += s * dy; } }
  return n;
}
const lines = (b, i) => lineLen(b, i, 1, 0) >= 3 || lineLen(b, i, 0, 1) >= 3;
export const adjacent = (a, b) => a >= 0 && b >= 0 && a < N && b < N && (Math.abs(a - b) === W || (Math.abs(a - b) === 1 && rowOf(a) === rowOf(b)));
// Would swapping a and b do anything? (The browser asks before sending; the server asks again.)
export function canSwap(b, x, y) {
  if (!adjacent(x, y) || !movable(b[x]) || !movable(b[y])) return false;
  if (b[x] === BOWL || b[y] === BOWL) return true;
  if (powerOf(b[x]) && powerOf(b[y])) return true;
  [b[x], b[y]] = [b[y], b[x]];
  const ok = lines(b, x) || lines(b, y);
  [b[x], b[y]] = [b[y], b[x]];
  return ok;
}
// Any swap that works, as [a, b], or null when the shelf is stuck. Also used for the hint.
export function findMove(b) {
  for (let i = 0; i < N; i++) {
    if (colOf(i) < W - 1 && canSwap(b, i, i + 1)) return [i, i + 1];
    if (i + W < N && canSwap(b, i, i + W)) return [i, i + W];
  }
  return null;
}
// Every group of pets standing in lines right now: { kind, cells, h (longest row run), v (longest column run) }.
export function findGroups(b) {
  const runs = [];
  const scan = (dx, dy) => {
    for (let s = 0; s < (dx ? H : W); s++) {
      let run = [];
      for (let t = 0; t <= (dx ? W : H); t++) {
        const i = dx ? s * W + t : t * W + s, k = t < (dx ? W : H) ? kindOf(b[i]) : -1;
        if (run.length && k === kindOf(b[run[0]])) { run.push(i); continue; }
        if (run.length >= 3) runs.push({ cells: run, h: dx ? run.length : 0, v: dx ? 0 : run.length });
        run = k >= 0 ? [i] : [];
      }
    }
  };
  scan(1, 0); scan(0, 1);
  // runs that share a cell make one group (an L, a T or a plus)
  const root = runs.map((_, k) => k), find = k => root[k] === k ? k : (root[k] = find(root[k])), first = new Map();
  runs.forEach((r, k) => { for (const i of r.cells) { if (first.has(i)) root[find(k)] = find(first.get(i)); else first.set(i, k); } });
  const groups = new Map();
  runs.forEach((r, k) => {
    let g = groups.get(find(k)); if (!g) groups.set(find(k), g = { kind: kindOf(b[r.cells[0]]), cells: [], h: 0, v: 0, cross: -1 });
    for (const i of r.cells) { if (g.cells.includes(i)) g.cross = i; else g.cells.push(i); }
    g.h = Math.max(g.h, r.h); g.v = Math.max(g.v, r.v);
  });
  return [...groups.values()];
}

// ---------- dealing ----------
const rint = (rnd, n) => rnd(n);
export function deal(def, rnd = n => Math.floor(Math.random() * n)) {
  for (let tries = 0; ; tries++) {
    const b = def.mask.map(m => m ? EMPTY : HOLE);
    // hay bales start in the lower rows, the strong ones first
    const spots = []; for (let i = 2 * W; i < N; i++) if (b[i] === EMPTY) spots.push(i);
    for (let k = 0; k < def.bales && spots.length; k++) { const j = rint(rnd, spots.length); b[spots[j]] = BALE + (k < def.strong ? 2 : 1); spots.splice(j, 1); }
    for (let i = 0; i < N; i++) {
      if (b[i] !== EMPTY) continue;
      for (let t = 0; t < 20; t++) { b[i] = rint(rnd, def.kinds) * 4; if (!lines(b, i)) break; }
    }
    if ((!findGroups(b).length && findMove(b)) || tries > 200) return b;
  }
}

// ---------- gravity ----------
// Pets (and bales) drop to the lowest free cubby of their column, skipping gaps in the shelf; `add[c]` are the new
// pets for column c, listed from the top cubby down. Returns the moves made, for the animation:
//   falls: [from, to]   drops: [to, how many cubbies it fell, value]
export function settle(b, add) {
  const falls = [], drops = [];
  for (let c = 0; c < W; c++) {
    const rows = []; for (let r = 0; r < H; r++) if (b[r * W + c] !== HOLE) rows.push(r);
    let w = rows.length - 1;
    for (let k = rows.length - 1; k >= 0; k--) {
      const i = rows[k] * W + c; if (b[i] === EMPTY) continue;
      const to = rows[w] * W + c; w--;
      if (to !== i) { b[to] = b[i]; b[i] = EMPTY; falls.push([i, to]); }
    }
    const fresh = add?.[c] || [], n = w + 1;
    for (let k = 0; k < n; k++) { const to = rows[k] * W + c; b[to] = fresh[k] ?? EMPTY; drops.push([to, n, b[to]]); }
  }
  return { falls, drops };
}
const emptiesIn = (b, c) => { let n = 0; for (let r = 0; r < H; r++) if (b[r * W + c] === EMPTY) n++; return n; };

// ---------- one move ----------
// play(board, a, b, kinds, rnd) -> null when the swap does nothing, else
//   { board, steps, pets: [popped per kind], hay: bales broken, pts }
// The board passed in is left alone. Each step is one round of popping and refilling:
//   { n, turn: [[i, v]], clr: [i], mk: [[i, v]], hit: [[i, v]], fx: [...], add: { col: [v] }, pts }  or  { shuf: board }
// turn: pets that change before popping; clr: cells emptied; mk: powers made; hit: bales left damaged;
// fx: what to draw ({ t: 'row' | 'col', i } | { t: 'box', i, r } | { t: 'kind', i, k } | { t: 'all' }).
export function play(board, a, bb, kinds, rnd = n => Math.floor(Math.random() * n)) {
  if (!canSwap(board, a, bb)) return null;
  const b = board.slice(), out = { board: b, steps: [], pets: Array(KINDS.length).fill(0), hay: 0, pts: 0 };
  const va = b[a], vb = b[bb];
  b[a] = vb; b[bb] = va; // the pet picked up (a) now stands on bb
  let first = null; // what the swap itself sets off, when it is more than lining pets up

  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H && b[y * W + x] !== HOLE;
  const mostCommon = () => { const n = Array(KINDS.length).fill(0); for (const v of b) if (isPet(v)) n[v >> 2]++; return n.indexOf(Math.max(...n)); };

  function round(n, seed) {
    const step = { n, clr: [], mk: [], hit: [], fx: [], add: {}, pts: 0 };
    const pop = new Set(), fired = new Set(), near = new Set(), queue = [];
    const mark = i => { if (b[i] === HOLE || b[i] === EMPTY || pop.has(i)) return; pop.add(i); if (special(b[i])) queue.push(i); };
    const row = i => { step.fx.push({ t: 'row', i }); for (let x = 0; x < W; x++) if (inside(x, rowOf(i))) mark(rowOf(i) * W + x); };
    const col = i => { step.fx.push({ t: 'col', i }); for (let y = 0; y < H; y++) if (inside(colOf(i), y)) mark(y * W + colOf(i)); };
    const box = (i, r) => { step.fx.push({ t: 'box', i, r }); for (let y = rowOf(i) - r; y <= rowOf(i) + r; y++) for (let x = colOf(i) - r; x <= colOf(i) + r; x++) if (inside(x, y)) mark(y * W + x); };
    const kind = (i, k) => { step.fx.push({ t: 'kind', i, k }); for (let j = 0; j < N; j++) if (kindOf(b[j]) === k) mark(j); };
    const fire = i => {
      if (fired.has(i)) return; fired.add(i);
      const v = b[i];
      if (v === BOWL) kind(i, mostCommon()); else if (powerOf(v) === ZOOM_H) row(i); else if (powerOf(v) === ZOOM_V) col(i); else if (powerOf(v) === POUNCE) box(i, 1);
    };
    if (seed) {
      if (seed.t !== 'kind') { fired.add(a); fired.add(bb); pop.add(a); pop.add(bb); } else { fired.add(seed.at); pop.add(seed.at); }
      if (seed.t === 'all') { step.fx.push({ t: 'all' }); for (let i = 0; i < N; i++) mark(i); }
      else if (seed.t === 'kind') {
        if (seed.power) { step.turn = []; let flip = rnd(2); for (let j = 0; j < N; j++) if (kindOf(b[j]) === seed.k && !powerOf(b[j])) { b[j] = seed.k * 4 + (seed.power === POUNCE ? POUNCE : (flip ^= 1) ? ZOOM_H : ZOOM_V); step.turn.push([j, b[j]]); } }
        kind(seed.at, seed.k);
      }
      else if (seed.t === 'cross') { row(bb); col(bb); }
      else if (seed.t === 'wide') { for (const d of [-1, 0, 1]) { if (inside(colOf(bb), rowOf(bb) + d)) row(bb + d * W); if (inside(colOf(bb) + d, rowOf(bb))) col(bb + d); } }
      else if (seed.t === 'big') box(bb, 2);
    } else {
      const groups = findGroups(b); if (!groups.length) return null;
      for (const g of groups) {
        for (const i of g.cells) {
          mark(i);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = colOf(i) + dx, y = rowOf(i) + dy; if (x >= 0 && x < W && y >= 0 && y < H && isBale(b[y * W + x])) near.add(y * W + x); }
        }
        // a big enough group leaves a power behind: where the player's pet landed, else at the corner or the middle
        const long = Math.max(g.h, g.v);
        const power = long >= 5 ? BOWL : g.h >= 3 && g.v >= 3 ? g.kind * 4 + POUNCE : long === 4 ? g.kind * 4 + (g.h === 4 ? ZOOM_H : ZOOM_V) : -1;
        if (power >= 0) {
          const line = g.cells.slice().sort((p, q) => p - q);
          const at = n === 1 && g.cells.includes(bb) ? bb : n === 1 && g.cells.includes(a) ? a : g.cross >= 0 ? g.cross : line[line.length >> 1];
          step.mk.push([at, power]); step.pts += power === BOWL ? 120 : 60;
        }
      }
    }
    while (queue.length) fire(queue.shift());
    // pop it all
    for (const i of new Set([...pop, ...near])) {
      const v = b[i];
      if (isBale(v)) { if (v - BALE > 1) { b[i] = v - 1; step.hit.push([i, v - 1]); } else { b[i] = EMPTY; step.clr.push(i); out.hay++; step.pts += 30 * n; } continue; }
      if (isPet(v)) out.pets[v >> 2]++;
      b[i] = EMPTY; step.clr.push(i); step.pts += 10 * n;
    }
    for (const [i, v] of step.mk) b[i] = v;
    for (let c = 0; c < W; c++) { const k = emptiesIn(b, c); if (k) step.add[c] = Array.from({ length: k }, () => rnd(kinds) * 4); }
    settle(b, step.add);
    out.pts += step.pts; out.steps.push(step);
    return step;
  }

  if (va === BOWL && vb === BOWL) first = { t: 'all' };
  else if (va === BOWL || vb === BOWL) { const pet = va === BOWL ? vb : va; first = { t: 'kind', k: kindOf(pet), power: powerOf(pet), at: va === BOWL ? bb : a }; }
  else if (powerOf(va) && powerOf(vb)) first = { t: powerOf(va) === POUNCE && powerOf(vb) === POUNCE ? 'big' : powerOf(va) === POUNCE || powerOf(vb) === POUNCE ? 'wide' : 'cross' };
  let n = 1;
  if (first) round(n++, first);
  while (n < 60 && round(n, null)) n++;
  // a shelf with no swap left is shuffled until there is one
  if (!findMove(b)) {
    const at = []; for (let i = 0; i < N; i++) if (movable(b[i])) at.push(i);
    for (let t = 0; t < 300; t++) {
      for (let i = at.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[at[i]], b[at[j]]] = [b[at[j]], b[at[i]]]; }
      if (!findGroups(b).length && findMove(b)) break;
      if (t === 299) for (const i of at) b[i] = rnd(kinds) * 4; // hopeless: fresh pets (the next move sorts out any lines)
    }
    out.steps.push({ shuf: b.slice() });
  }
  return out;
}

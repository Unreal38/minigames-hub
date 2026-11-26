// Sugar Siege: the rules the server plays by and the page draws with. A side-on island made of blocks, teams of
// Pet Farm pets, snacks that fly, splash, bite holes out of the ground and fill pets up. A pet at 100% fullness
// crashes from the sugar rush and sleeps for the rest of the match; one that falls in the sea naps on a float.
//
// The server runs everything here (server/games/siege.js) and sends the result; the page only draws it. The island
// travels as column heights plus a list of changes (ops), applied in order with plain arithmetic, so the server's
// grid and every screen's grid are the same block for block.
import { L } from '../../i18n.js';
import { SPECIES } from '../farm/data.js';

export const BS = .5;                 // one block, in metres
export const COLS = 108, ROWS = 48;   // the island grid
export const W = COLS * BS;           // 54 m wide
export const WATER0 = 1.9;            // where the sea starts
export const G = 14;                  // gravity, m/s²
export const VMAX = 17;               // a full-power throw, m/s
export const WIND_A = 4.2;            // the strongest wind's push, m/s²
export const DT = 1 / 60;             // one physics step
export const WALK = 2.3, JUMP_VY = 7.4, JUMP_VX = 2.6;
export const PET_W = .26, PET_H = .88; // half the body's width; its height (checked at three heights)
export const RETREAT_MS = 3000;       // walking time after your snack lands
export const TIDE_ROUND = 10, TIDE_STEP = BS, MAX_ROUND = 40;
export const TIMERS = [20, 30, 45], ARCS = ['short', 'long', 'off'], TEAM_PETS = [2, 3, 4];
export const ARC_DOTS = { short: 9, long: 22, off: 0 };

// The snacks. r: splash radius (m), dmg: fullness at the middle of the splash, kb: knock-back, wind: how much the wind
// moves it, v: speed at full power (share of VMAX), n: how many a team has (Infinity: no limit).
// Element snacks come one per element on the team (each pet's element counts once).
export const SNACKS = {
  pie:   { em: '🥧', r: 1.35, dmg: 30, kb: 6.5, wind: 1, v: 1, n: Infinity, col: ['#e0524f', '#f2c27a', '#b93b3f'] },
  jelly: { em: '🍮', r: 1.25, dmg: 28, kb: 7.5, wind: .45, v: .9, n: Infinity, col: ['#7ed37a', '#c9f58f', '#4fae5a'], fuse: 2.6, bounce: true },
  berry: { em: '🫐', r: .8, dmg: 12, kb: 4.5, wind: 1, v: 1, n: 2, col: ['#6c5ce7', '#a29bfe', '#3d2f9e'], split: 4 },
  cake:  { em: '🎂', r: 2.3, dmg: 48, kb: 10, wind: .25, v: .78, n: 1, col: ['#ff8fab', '#fff3df', '#e0628a'] },
  // element snacks
  seed:  { em: '🌱', el: 'Leaf', r: 1.3, dmg: 0, kb: 0, wind: .8, v: .95, n: 0, col: ['#5fb04a', '#a3e07a', '#3f8c4a'], grow: true },
  chili: { em: '🌶️', el: 'Ember', r: .75, dmg: 10, kb: 14, wind: .7, v: 1, n: 0, col: ['#ff5a3c', '#ffb547', '#c8412f'] },
  soda:  { em: '🥤', el: 'Tide', r: 2.4, dmg: 8, kb: 10, wind: .7, v: .95, n: 0, col: ['#7fd1e8', '#ffffff', '#3f86d6'], wave: true },
  fizz:  { em: '🍬', el: 'Spark', r: .55, dmg: 16, kb: 3, wind: .8, v: 1, n: 0, col: ['#ffe27a', '#fff6c8', '#b9862a'], zap: 3, zapR: 6 },
  rock:  { em: '🍭', el: 'Stone', r: 0, dmg: 0, kb: 0, wind: .3, v: .9, n: 0, col: ['#ff9ec4', '#ffffff', '#c6b8f6'], bridge: 4 },
  mini:  { r: .8, dmg: 12, kb: 4.5, wind: 1, v: 1, n: 0, col: ['#6c5ce7', '#a29bfe', '#3d2f9e'] }, // one of the berries
};
export const BASIC = ['pie', 'jelly', 'berry', 'cake'];
export const EL_SNACK = { Leaf: 'seed', Ember: 'chili', Tide: 'soda', Spark: 'fizz', Stone: 'rock' };
export const SNACK_KEYS = [...BASIC, 'seed', 'chili', 'soda', 'fizz', 'rock'];
export const snackName = k => ({ pie: L('Sunberry Pie', 'Placek'), jelly: L('Jelly', 'Galaretka'), berry: L('Berries', 'Jagody'), cake: L('Honey Cake', 'Miodownik'),
  seed: L('Sprout seed', 'Nasionko'), chili: L('Chilli popper', 'Papryczka'), soda: L('Soda splash', 'Oranżada'), fizz: L('Fizz candy', 'Musujący cukierek'), rock: L('Rock candy', 'Twardy cukierek') }[k] || k);
export const snackShort = k => ({ pie: L('Pie', 'Placek'), jelly: L('Jelly', 'Galaretka'), berry: L('Berries', 'Jagody'), cake: L('Cake', 'Miodownik'),
  seed: L('Seed', 'Nasionko'), chili: L('Chilli', 'Papryczka'), soda: L('Soda', 'Oranżada'), fizz: L('Fizz', 'Cukierek'), rock: L('Rock', 'Lizak') }[k] || k);
export const snackHelp = k => ({ pie: L('Straight lob, any wind', 'Prosty rzut, wiatr go znosi'), jelly: L('Bounces, pops after 2.6 s', 'Odbija się, pęka po 2,6 s'), berry: L('Bursts into 4 berries', 'Rozpryskuje się na 4 jagody'), cake: L('Heavy, huge splash', 'Ciężki, wielki plusk'),
  seed: L('Grows a bush: a wall or a step', 'Wyrasta krzak: ściana albo schodek'), chili: L('Small splash, big knock-back', 'Mały plusk, mocne odrzucenie'), soda: L('A wave that pushes pets', 'Fala, która spycha zwierzaki'),
  fizz: L('Zaps up to 3 pets near each other', 'Razi do 3 zwierzaków blisko siebie'), rock: L('Leaves a candy bridge', 'Zostawia cukrowy most') }[k] || '');

// The element a pet brings: its species' element (a hybrid's first one).
export const elementOf = sp => SPECIES[sp]?.el || null;
// What a team starts with: the basics, plus one element snack per element among its pets.
export function ammoFor(species) {
  const a = {}; for (const k of SNACK_KEYS) a[k] = SNACKS[k].n;
  for (const el of new Set(species.map(elementOf))) if (EL_SNACK[el]) a[EL_SNACK[el]] = 1;
  return a;
}

// ---------- the island ----------
// A small integer random (same numbers on the server and every screen).
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// Column heights (in blocks) and the starting changes: two floating ledges and a little cave. Only the server calls
// this; screens get hs and ops.
export function makeIsland(seed) {
  const r = rng(seed), s1 = r() * 9, s2 = r() * 9, s3 = r() * 9, hs = [], ops = [];
  const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  for (let c = 0; c < COLS; c++) {
    const x = c / COLS, edge = sm(0, .14, x) * sm(1, .86, x);
    hs.push(Math.max(1, Math.round(2 + edge * (13 + 4.5 * Math.sin(x * 7 + s1) + 3 * Math.sin(x * 15 + s2) + 1.6 * Math.sin(x * 31 + s3)))));
  }
  for (let k = 0; k < 2; k++) { // ledges: [fill, c0, r0, c1, r1, kind] (inclusive cells)
    const c0 = Math.floor(COLS * (.24 + k * .38 + r() * .1)), len = 9 + Math.floor(r() * 6), c1 = Math.min(COLS - 1, c0 + len - 1);
    const base = Math.max(...hs.slice(c0, c1 + 1)) + 6 + Math.floor(r() * 3);
    ops.push(['f', c0 + 1, base, c1 - 1, base + 1, 1], ['f', c0, base + 1, c1, base + 1, 1]);
  }
  const cc = Math.floor(COLS * (.45 + r() * .1)), ch = hs[cc]; // a cave under the middle hill
  if (ch > 8) ops.push(['c', cc * BS + BS / 2, (ch - 3.5) * BS, 2.4 * BS]);
  return { hs, ops };
}
export function gridOf(hs) {
  const g = new Uint8Array(COLS * ROWS);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < Math.min(ROWS, hs[c]); r++) g[c + r * COLS] = 1;
  return g;
}
export const cellAt = (g, c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS ? g[c + r * COLS] : 0);
export const solidAt = (g, x, y) => cellAt(g, Math.floor(x / BS), Math.floor(y / BS)) > 0;
// Applies one change to the grid. Returns the cells it touched (for the screens' redraw).
// ['c', x, y, r]: eat a round hole; ['f', c0, r0, c1, r1, kind]: fill a box of cells; ['b', x, y, r, kind]: fill a ball of
// empty cells; ['s', c0, c1, row, kind]: a bridge along a row. 'b' and 's' leave out cells listed in op[6] (where pets stand).
export function applyOp(g, op) {
  const out = [];
  const set = (c, r, v) => { if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return; const i = c + r * COLS; if (g[i] !== v) { g[i] = v; out.push(i); } };
  if (op[0] === 'c') {
    const [, x, y, rr] = op, c0 = Math.floor((x - rr) / BS), c1 = Math.floor((x + rr) / BS), r0 = Math.floor((y - rr) / BS), r1 = Math.floor((y + rr) / BS);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { const dx = c * BS + BS / 2 - x, dy = r * BS + BS / 2 - y; if (dx * dx + dy * dy <= rr * rr && r > 0) set(c, r, 0); }
  } else if (op[0] === 'f') {
    const [, c0, r0, c1, r1, k] = op; for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) set(c, r, k);
  } else if (op[0] === 'b') {
    const [, x, y, rr, k, skip = []] = op, c0 = Math.floor((x - rr) / BS), c1 = Math.floor((x + rr) / BS), r0 = Math.floor((y - rr) / BS), r1 = Math.floor((y + rr) / BS);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { const dx = c * BS + BS / 2 - x, dy = r * BS + BS / 2 - y; if (dx * dx + dy * dy <= rr * rr && !cellAt(g, c, r) && !skip.includes(c + r * COLS)) set(c, r, k); }
  } else if (op[0] === 's') {
    const [, c0, c1, r, k, skip = []] = op; for (let c = c0; c <= c1; c++) if (!cellAt(g, c, r) && !skip.includes(c + r * COLS)) set(c, r, k);
  }
  return out;
}
// The cells a pet's body covers (so new blocks never grow inside a pet).
export function petCells(p) {
  const out = []; const c0 = Math.floor((p.x - PET_W - .05) / BS), c1 = Math.floor((p.x + PET_W + .05) / BS), r0 = Math.floor(p.y / BS), r1 = Math.floor((p.y + PET_H + .1) / BS);
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) out.push(c + r * COLS);
  return out;
}
export function topY(g, c) { for (let r = ROWS - 1; r >= 0; r--) if (cellAt(g, c, r)) return (r + 1) * BS; return 0; }

// ---------- pets ----------
const free = (g, x, y) => { for (const dy of [.12, .5, PET_H]) for (const dx of [-PET_W, PET_W]) if (solidAt(g, x + dx, y + dy)) return false; return true; };
const onGround = (g, x, y) => solidAt(g, x - .22, y - .03) || solidAt(g, x + .22, y - .03) || solidAt(g, x, y - .03);
export { free as bodyFree };
// One physics step for a pet. walk: -1, 0 or 1 (only the pet whose turn it is). Returns 'sea' when it fell in.
export function stepPet(g, p, dt, walk, water) {
  if (p.sea) return null;
  if (walk && p.ground && !p.sleep) {
    p.face = walk; const nx = p.x + walk * WALK * dt;
    if (free(g, nx, p.y)) p.x = nx;
    else if (free(g, nx, p.y + BS + .02) && free(g, p.x, p.y + BS + .02)) { p.y = Math.floor(p.y / BS + 1.02) * BS; p.x = nx; } // step up one block
  }
  if (p.vx) {
    const nx = p.x + p.vx * dt;
    if (free(g, nx, p.y)) p.x = nx; else p.vx *= -.3;
    if (p.ground && p.vy <= 0) p.vx *= Math.pow(.004, dt);
    if (Math.abs(p.vx) < .05) p.vx = 0;
  }
  p.vy -= G * dt; let ny = p.y + p.vy * dt;
  if (p.vy > 0 && !free(g, p.x, ny)) { p.vy = 0; ny = p.y; }
  if (p.vy <= 0 && onGround(g, p.x, ny)) { ny = Math.floor((ny - .03) / BS + 1) * BS; if (!free(g, p.x, ny)) ny = p.y; p.vy = 0; p.ground = true; }
  else p.ground = false;
  p.y = ny;
  if (p.vy < -30) p.vy = -30;
  if (p.y < water - .25) { p.sea = true; p.vx = p.vy = 0; p.y = water - .25; return 'sea'; }
  return null;
}

// ---------- snacks in flight ----------
// One physics step for a flying snack: null while it flies, 'hit' when it lands (or the jelly pops), 'sea' when it is lost.
// pets: the pets it can hit; ignore: the thrower, safe for the first quarter second.
export function stepShot(g, s, dt, pets, wind, water, ignore) {
  const f = SNACKS[s.k];
  s.vx += wind * WIND_A * f.wind * dt; s.vy -= G * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt;
  if (s.y < water - .3 || s.x < -15 || s.x > W + 15) return 'sea';
  if (f.bounce) {
    if (solidAt(g, s.x, s.y)) {
      s.x -= s.vx * dt; s.y -= s.vy * dt;
      if (solidAt(g, s.x + s.vx * dt, s.y)) s.vx *= -.45; else s.vy *= -.45;
      s.vx *= .75;
    }
    return s.age >= f.fuse ? 'hit' : null;
  }
  if (s.y > ROWS * BS + 30) return null; // far above the grid: nothing to hit up there
  if (solidAt(g, s.x, s.y)) return 'hit';
  for (const p of pets) {
    if (p.sea || (p === ignore && s.age < .25)) continue;
    const dx = p.x - s.x, dy = p.y + .5 - s.y; if (dx * dx + dy * dy < .3) return 'hit';
  }
  return null;
}
// Where a throw starts and how fast it goes. a: angle (radians, 0 = right), pw: power 0..1.
export function launch(p, k, a, pw) {
  const v = Math.max(0, Math.min(1, pw)) * VMAX * (SNACKS[k]?.v || 1), dir = Math.cos(a) >= 0 ? 1 : -1;
  return { k, x: p.x + dir * .35, y: p.y + .75, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0 };
}

// Placement after a match: teams still awake first (more pets awake, then less fullness), then the others by how late
// they fell asleep. Returns { order, place } with equal results sharing a place.
export function standings(teams) {
  const key = t => [t.out ? 0 : 1, t.out ? t.outAt : t.awake, -t.full];
  const order = teams.map((_, i) => i).sort((a, b) => { const A = key(teams[a]), B = key(teams[b]); for (let k = 0; k < 3; k++) if (A[k] !== B[k]) return B[k] - A[k]; return 0; });
  const place = []; order.forEach((t, n) => { const prev = order[n - 1]; place[t] = n && key(teams[prev]).join() === key(teams[t]).join() ? place[prev] : n + 1; });
  return { order, place };
}

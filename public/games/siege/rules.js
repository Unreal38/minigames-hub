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
// Team colours on the island (tags, rings under pets, the team list): fixed and far apart, so teams never look alike
// even when players picked similar colours. Seat order.
export const TEAM_COLS = ['#3d8bff', '#ff4f5e', '#2fbf5a', '#ffae1a'];
export const teamCol = t => TEAM_COLS[t % TEAM_COLS.length];
export const SNACK_KEYS = [...BASIC, 'seed', 'chili', 'soda', 'fizz', 'rock'];
export const snackName = k => ({ pie: L('Sunberry Pie', 'Placek'), jelly: L('Jelly', 'Galaretka'), berry: L('Berries', 'Jagody'), cake: L('Honey Cake', 'Miodownik'),
  seed: L('Sprout seed', 'Nasionko'), chili: L('Chilli popper', 'Papryczka'), soda: L('Soda splash', 'Oranżada'), fizz: L('Fizz candy', 'Musujący cukierek'), rock: L('Rock candy', 'Twardy cukierek') }[k] || k);
export const snackShort = k => ({ pie: L('Pie', 'Placek'), jelly: L('Jelly', 'Galaretka'), berry: L('Berries', 'Jagody'), cake: L('Cake', 'Miodownik'),
  seed: L('Seed', 'Nasionko'), chili: L('Chilli', 'Papryczka'), soda: L('Soda', 'Oranżada'), fizz: L('Fizz', 'Cukierek'), rock: L('Rock', 'Lizak') }[k] || k);
export const snackHelp = k => ({ pie: L('Your everyday throw. The wind carries it.', 'Zwykły rzut. Wiatr go znosi.'),
  jelly: L('Bounces off the ground and pops after 2.6 s.', 'Odbija się od ziemi i pęka po 2,6 s.'),
  berry: L('Bursts into 4 small berries when it lands.', 'Po upadku rozpryskuje się na 4 małe jagody.'),
  cake: L('Heavy and slow, but makes a huge splash.', 'Ciężki i wolny, ale robi wielki plusk.'),
  seed: L('Feeds nobody. Grows a bush you can use as a wall or a step.', 'Nikogo nie karmi. Wyrasta krzak: ściana albo schodek.'),
  chili: L('Small splash, but knocks pets far away.', 'Mały plusk, ale mocno odrzuca zwierzaki.'),
  soda: L('A wide wave that pushes pets, maybe into the sea.', 'Szeroka fala, która spycha zwierzaki, może nawet do morza.'),
  fizz: L('Zaps up to 3 pets standing near each other.', 'Razi do 3 zwierzaków stojących blisko siebie.'),
  rock: L('Feeds nobody. Leaves a candy bridge to walk on.', 'Nikogo nie karmi. Zostawia cukrowy most do chodzenia.') }[k] || '');
// Short facts for the snack card: how much it fills, how big the splash, how hard it pushes, how much the wind moves it.
export const snackFacts = k => { const f = SNACKS[k]; if (!f) return [];
  const out = [];
  if (f.dmg > 0) out.push(L(`Fills ${f.dmg}%`, `Karmi ${f.dmg}%`) + (f.split ? ' ×' + f.split : f.zap ? ' ×' + f.zap : ''));
  if (f.r > 0) out.push(f.r < 1 ? L('Small splash', 'Mały plusk') : f.r < 2 ? L('Medium splash', 'Średni plusk') : L('Big splash', 'Wielki plusk'));
  if (f.kb > 0) out.push(f.kb >= 10 ? L('Strong push', 'Mocne odrzucenie') : f.kb >= 6 ? L('Some push', 'Średnie odrzucenie') : L('Light push', 'Lekkie odrzucenie'));
  out.push(f.wind >= .8 ? L('Wind: a lot', 'Wiatr: mocno') : f.wind >= .45 ? L('Wind: some', 'Wiatr: trochę') : L('Wind: barely', 'Wiatr: prawie wcale'));
  return out; };

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
// Pets and snacks bump into the island as it is DRAWN, not as raw blocks: the screen draws the outline where the
// corner field below crosses one half (marching squares in scene3d.js), so walking, landing and splashing use that same
// field. Steps become slopes you walk up, a lone block nobody can see is not a wall, and feet stand on the visible top.
const cellB = (g, c, r) => (cellAt(g, c, Math.max(0, r)) ? 1 : 0); // below row 0 the island carries on into the sea
const cornerV = (g, i, j) => (cellB(g, i - 1, j - 1) + cellB(g, i, j - 1) + cellB(g, i - 1, j) + cellB(g, i, j)) / 4;
export function fieldAt(g, x, y) {
  if (x < 0 || x > W || y > ROWS * BS) return 0;
  const fi = x / BS, fj = Math.max(0, y) / BS, i0 = Math.min(COLS - 1, Math.floor(fi)), j0 = Math.min(ROWS - 1, Math.floor(fj)), u = fi - i0, v = fj - j0;
  return (cornerV(g, i0, j0) * (1 - u) + cornerV(g, i0 + 1, j0) * u) * (1 - v) + (cornerV(g, i0, j0 + 1) * (1 - u) + cornerV(g, i0 + 1, j0 + 1) * u) * v;
}
export const solidF = (g, x, y) => fieldAt(g, x, y) >= .5;
const FOOT = .2;
const free = (g, x, y) => { for (const dy of [.1, .5, PET_H]) for (const dx of [-PET_W, 0, PET_W]) if (solidF(g, x + dx, y + dy)) return false; return true; };
const feet = (g, x, y) => solidF(g, x - FOOT, y) || solidF(g, x + FOOT, y) || solidF(g, x, y);
const onGround = (g, x, y) => feet(g, x, y - .03);
// The lowest height from y up to y + max where the body fits at x, or null.
const fits = (g, x, y) => !feet(g, x, y) && free(g, x, y);
function rise(g, x, y, max) { for (let d = 0; d <= max + 1e-9; d += .01) if (fits(g, x, y + d)) return y + d; return null; }
export { free as bodyFree };
export const SLOPE = 1.4;           // walking climbs slopes up to about 55° (a one or two block step is drawn as 45°)
export const LIP = .35;             // in the air, an edge this far above your feet still catches you
export const AIR_ACC = 9;           // steering in the air, m/s²
// Moves a pet sideways by dx at height y, climbing up to `up`. Returns false when a wall stops it.
function slide(g, p, dx, up) {
  const nx = p.x + dx;
  if (fits(g, nx, p.y)) { p.x = nx; return true; }
  const y = rise(g, nx, p.y, up);
  if (y !== null && free(g, p.x, y)) { p.x = nx; p.y = y; return true; }
  return false;
}
// One physics step for a pet. walk: -1, 0 or 1 (only the pet whose turn it is). Returns 'sea' when it fell in.
export function stepPet(g, p, dt, walk, water) {
  if (p.sea) return null;
  // a bush or bridge grew round it, or a bite changed the ground under it: stand on top instead of inside
  if (!fits(g, p.x, p.y)) { const y = rise(g, p.x, p.y, 1.5); if (y !== null) p.y = y; }
  if (walk && !p.sleep) {
    p.face = walk;
    if (p.ground) {
      const dx = walk * WALK * dt, up = Math.abs(dx) * SLOPE + .04;
      if (slide(g, p, dx, up) && !onGround(g, p.x, p.y)) { // walking down a slope keeps your feet on it
        for (let d = .01; d <= up; d += .01) if (onGround(g, p.x, p.y - d) && fits(g, p.x, p.y - d)) { p.y -= d; break; }
      }
    } else if (walk * p.vx < JUMP_VX) p.vx = walk > 0 ? Math.min(JUMP_VX, p.vx + AIR_ACC * dt) : Math.max(-JUMP_VX, p.vx - AIR_ACC * dt);
  }
  if (p.vx) {
    // a wall stops you; a jump keeps its push, so you carry on over the edge once you are high enough
    if (!slide(g, p, p.vx * dt, p.ground ? Math.abs(p.vx * dt) * SLOPE + .04 : LIP) && !p.jmp) p.vx = 0;
    if (p.ground && p.vy <= 0) p.vx *= Math.pow(.004, dt);
    if (Math.abs(p.vx) < .05) p.vx = 0;
  }
  if (p.ground && p.vy <= 0 && onGround(g, p.x, p.y)) { p.vy = 0; p.jmp = false; return p.y < water - .25 ? (p.sea = true, p.vx = 0, p.y = water - .25, 'sea') : null; } // standing: nothing to fall
  p.vy = Math.max(-30, p.vy - G * dt);
  const dy = p.vy * dt, n = Math.max(1, Math.ceil(Math.abs(dy) / .08));
  let landed = false;
  for (let k = 0; k < n; k++) {
    const ny = p.y + dy / n;
    if (dy > 0) { if (!free(g, p.x, ny)) { p.vy = 0; break; } p.y = ny; continue; } // a bump on the head
    if (feet(g, p.x, ny)) { // touch down on the surface itself
      let y = ny; while (y < p.y && feet(g, p.x, y)) y += .01;
      if (free(g, p.x, y)) p.y = y;
      landed = true; break;
    }
    p.y = ny;
  }
  if (landed || (p.vy <= 0 && onGround(g, p.x, p.y))) {
    if (!p.ground && p.jmp) p.vx = 0; // a jump ends where it lands, no skidding on
    p.vy = 0; p.ground = true; p.jmp = false;
  } else p.ground = false;
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
    if (solidF(g, s.x, s.y)) {
      s.x -= s.vx * dt; s.y -= s.vy * dt;
      if (solidF(g, s.x + s.vx * dt, s.y)) s.vx *= -.45; else s.vy *= -.45;
      s.vx *= .75;
    }
    return s.age >= f.fuse ? 'hit' : null;
  }
  if (s.y > ROWS * BS + 30) return null; // far above the grid: nothing to hit up there
  if (solidF(g, s.x, s.y)) return 'hit';
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

// Blast Bay rules shared by the server (server/games/blast.js) and the browser (client.js): the maze, the blast
// shape, how a player steps round corners, and every tuning number. Positions are in tiles: tile (x, y) is the
// square whose middle is at x, y. y grows towards the camera.
import { L } from '../../i18n.js';

// ---------- tuning ----------
export const FUSE_MS = 2400;        // a pop seed bursts this long after it is planted
export const BLAST_MS = 450;        // the petal blast stays dangerous this long
export const GRACE_MS = 150;        // a person stood in a fresh blast is only caught if still there after this (lag)
export const START = { bombs: 1, range: 2, spd: 3.4 };
export const CAP = { bombs: 5, range: 6, spd: 6.4 };
export const SPD_STEP = .6;
export const KICK_SPD = 7;          // tiles a second a kicked seed slides
export const PET_RATE = .4;         // share of crates with a pet hiding inside
export const CRUMBLE_S = 90;        // the island edge starts crumbling this far into a round
export const CRUMBLE_EVERY = 180;   // ms between two tiles starting to fall
export const FALL_WARN = 1200;      // a tile shakes this long before it drops
export const ROUND_CAP_S = 240;     // a round still going after this is a draw (only with crumbling off)
export const COUNT_MS = 3000;       // 3, 2, 1 before a round
export const OVER_MS = 3200;        // the round's winner banner
export const WINS = [2, 3, 5];
export const SHIELD_MS = 1200;      // safe time after a leaf bubble pops
export const Q = 100;               // positions travel as whole hundredths of a tile

// The five boosts, one per Pet Farm element: the pet that hops out of a crate gives its element's.
export const ELS = ['Ember', 'Tide', 'Spark', 'Leaf', 'Stone'];
export const EL_COL = { Ember: '#e0592f', Tide: '#2f86cc', Spark: '#d9a400', Leaf: '#3f9a52', Stone: '#8a7f76' };
export const BOON = {
  Ember: L('Blast reach +1', 'Zasięg wybuchu +1'), Tide: L('One more seed', 'Jedno nasiono więcej'), Spark: L('Faster feet', 'Szybsze nogi'),
  Leaf: L('Leaf bubble', 'Listkowa bańka'), Stone: L('Seed kick', 'Kopanie nasion'),
};

// Arenas: each one of the Pet Farm's islands (ground index in isle3d.js GROUND).
export const ARENAS = {
  woods: { name: L('Mossy Woods', 'Omszały Las'), isle: 5 },
  ridge: { name: L('Pebble Ridge', 'Kamykowa Grań'), isle: 2 },
  sweet: { name: L('Sweet Shop', 'Wyspa Słodyczy'), isle: 7 },
};
export const ARENA_IDS = Object.keys(ARENAS);

// The maze: 15 x 13 for up to four players, 19 x 15 for five to eight.
export const sizeFor = n => (n <= 4 ? { w: 15, h: 13 } : { w: 19, h: 15 });
// Start tiles: the four corners first, then the middles of the edges.
export function starts(w, h) {
  const mx = (w - 1) / 2 | 1, my = (h - 1) / 2 | 1;
  return [[1, 1], [w - 2, h - 2], [w - 2, 1], [1, h - 2], [mx, 1], [mx, h - 2], [1, my], [w - 2, my]];
}

// Tile kinds in the grid: 0 open ground, 1 wall (never breaks), 2 crate, 3 fallen away.
export const OPEN = 0, WALL = 1, CRATE = 2, GONE = 3;
// A new maze. rnd: a random number source. Returns { w, h, grid (Uint8Array), has (element index of the pet
// hiding in each crate, or -1) }.
export function makeMaze(n, rnd = Math.random) {
  const { w, h } = sizeFor(n), grid = new Uint8Array(w * h), has = new Int8Array(w * h).fill(-1);
  const clear = new Set();
  for (const [x, y] of starts(w, h).slice(0, Math.max(4, n))) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) clear.add((y + dy) * w + x + dx);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || (x % 2 === 0 && y % 2 === 0)) grid[i] = WALL;
    else if (!clear.has(i) && rnd() < .72) { grid[i] = CRATE; if (rnd() < PET_RATE) has[i] = rnd() * ELS.length | 0; }
  }
  return { w, h, grid, has };
}

// The tiles a seed at (gx, gy) with this reach covers: [x, y, arm] (arm 0 is the middle, 1..4 right, left, down, up).
// A blast stops at a wall or a fallen tile, and stops on (breaking) the first crate.
export function blastCells(grid, w, h, gx, gy, range) {
  const out = [[gx, gy, 0]];
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy], a) => {
    for (let k = 1; k <= range; k++) {
      const x = gx + dx * k, y = gy + dy * k; if (x < 0 || y < 0 || x >= w || y >= h) break;
      const g = grid[y * w + x]; if (g === WALL || g === GONE) break;
      out.push([x, y, a + 1]); if (g === CRATE) break;
    }
  });
  return out;
}

// The order the edge crumbles in: rings from the outside in, clockwise, leaving a small middle.
export function crumbleOrder(grid, w, h) {
  const out = [], keep = Math.floor((h - 3) / 2);
  for (let r = 1; r < keep; r++) {
    const x0 = r, y0 = r, x1 = w - 1 - r, y1 = h - 1 - r;
    for (let x = x0; x <= x1; x++) out.push(y0 * w + x);
    for (let y = y0 + 1; y <= y1; y++) out.push(y * w + x1);
    for (let x = x1 - 1; x >= x0; x--) out.push(y1 * w + x);
    for (let y = y1 - 1; y > y0; y--) out.push(y * w + x0);
  }
  return out.filter(i => grid[i] !== WALL);
}

// ---------- stepping round the maze ----------
// p: { x, y } in tiles; free(x, y): may p stand on that tile. Moves p one step along (dx, dy) and returns true if it
// moved. Off the middle of a lane, it first slides back to the middle; near a corner it slips round it.
export function tryMove(p, dx, dy, step, free) {
  const cx = Math.round(p.x), cy = Math.round(p.y);
  if (dx) {
    const off = p.y - cy;
    if (Math.abs(off) > .02) {
      if (free(cx + dx, cy)) { p.y -= Math.sign(off) * Math.min(step, Math.abs(off)); return true; }
      const ny = cy + Math.sign(off);
      if (Math.abs(off) > .22 && free(cx, ny) && free(cx + dx, ny)) { p.y += Math.sign(off) * step; return true; }
      return false;
    }
    p.y = cy;
    const nx = p.x + dx * step;
    if ((nx - cx) * dx > 0 && !free(cx + dx, cy)) { if (Math.abs(p.x - cx) < 1e-4) return false; p.x = cx; return true; }
    p.x = nx; return true;
  }
  const off = p.x - cx;
  if (Math.abs(off) > .02) {
    if (free(cx, cy + dy)) { p.x -= Math.sign(off) * Math.min(step, Math.abs(off)); return true; }
    const nx = cx + Math.sign(off);
    if (Math.abs(off) > .22 && free(nx, cy) && free(nx, cy + dy)) { p.x += Math.sign(off) * step; return true; }
    return false;
  }
  p.x = cx;
  const ny = p.y + dy * step;
  if ((ny - cy) * dy > 0 && !free(cx, cy + dy)) { if (Math.abs(p.y - cy) < 1e-4) return false; p.y = cy; return true; }
  p.y = ny; return true;
}
// Stick or keys (ix, iy in -1..1): the stronger direction first, the other if that is blocked. Returns the facing
// [dx, dy] it moved in, or null.
export function steer(p, ix, iy, step, free) {
  if (Math.abs(ix) < .2 && Math.abs(iy) < .2) return null;
  const tries = Math.abs(ix) >= Math.abs(iy) ? [[Math.sign(ix), 0, ix], [0, Math.sign(iy), iy]] : [[0, Math.sign(iy), iy], [Math.sign(ix), 0, ix]];
  for (const [dx, dy, v] of tries) { if (Math.abs(v) < .2) continue; if (tryMove(p, dx, dy, step, free)) return [dx, dy]; }
  return null;
}
// Facing as a number for the wire: 0 down (towards the camera), 1 right, 2 up, 3 left.
export const faceOf = (dx, dy) => (dy > 0 ? 0 : dx > 0 ? 1 : dy < 0 ? 2 : 3);

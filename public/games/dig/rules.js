// Treasure Dig rules shared by the server and the client: board sizes, what is buried, points and timings.
// Change the feel of the game here (restart the server after editing).

// What can be under a grass tile. Gems score and let you dig again; a trap costs points and ends your turn.
export const KIND = { dirt: 0, gem: 1, big: 2, chest: 3, trap: 4 };
export const PTS = { 1: 1, 2: 3, 3: 5 };   // small gem, big gem, golden chest
export const TRAP = -4;                    // a trap takes this many points (never below zero)
export const NAME = { 1: 'Gem', 2: 'Big gem', 3: 'Golden chest', 4: 'Trap' };

// Board sizes: width, height, traps, small gems, big gems, chests.
export const SIZES = {
  small: { w: 8, h: 8, traps: 10, gem: 6, big: 3, chest: 1 },
  big: { w: 10, h: 10, traps: 16, gem: 10, big: 5, chest: 1 },
};

// Animation times (ms) the server waits for before the next dig, so every screen sees it play out.
export const MS = { dig: 1500, dirt: 500, gem: 1100, chest: 1600, trap: 1700, start: 1800 };
export const waitFor = (kind, walk) => walk + MS.dig + (kind === KIND.trap ? MS.trap : kind === KIND.chest ? MS.chest : kind ? MS.gem : MS.dirt);

// Where avatars stand (field units, one tile = 1, middle of the field = 0,0). The server uses the same spots to
// know how far a digger has to walk, so it can wait for exactly that long.
export const WALK = { speed: 4.2, min: 350, max: 2600 }; // tiles a second; shortest and longest walk in ms
export function homeOf(k, n, w, h) { // spread round the back and the two sides of the plot, never in front of it
  const L = h + .6, side = w + 1.8, total = 2 * L + side, d = (k + .5) / n * total, ex = w / 2 + 1.05, ez = h / 2 + 1.05;
  if (d < L) return { x: -ex, z: h / 2 - .3 - d };
  if (d < L + side) return { x: -ex + (d - L) / side * 2 * ex, z: -ez };
  return { x: ex, z: -h / 2 + .3 + (d - L - side) };
}
// The digger stands on the back of the tile and digs the front of it, facing the camera.
export const standOf = (i, w, h) => ({ x: i % w - (w - 1) / 2, z: ((i / w) | 0) - (h - 1) / 2 - 1 });
export const walkMs = (from, to) => Math.round(Math.max(WALK.min, Math.min(WALK.max, Math.hypot(to.x - from.x, to.z - from.z) / WALK.speed * 1000)));

export const idx = (x, y, w) => y * w + x;
export function around(i, w, h) {
  const x = i % w, y = (i / w) | 0, out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
  }
  return out;
}
export const isGem = k => k === KIND.gem || k === KIND.big || k === KIND.chest;

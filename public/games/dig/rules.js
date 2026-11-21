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
export const MS = { hop: 600, dig: 700, dirt: 500, gem: 1100, chest: 1600, trap: 1700, start: 1800 };
export const waitFor = kind => MS.hop + MS.dig + (kind === KIND.trap ? MS.trap : kind === KIND.chest ? MS.chest : kind ? MS.gem : MS.dirt);

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

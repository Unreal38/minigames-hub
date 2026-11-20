// Ludo board: shared by the server (rules) and the client (3D layout).
//
// The board is a 15 x 15 grid of cells [col, row], row 0 at the far edge. A ring of 52 track cells runs clockwise
// round a cross. Each of the four corners owns a yard, a start cell on the ring (13 cells apart) and a home lane of
// 5 cells leading to the middle.
//
// A pawn's place is one number, counted from its own corner:
//   -1        waiting in the yard
//   0..50     on the ring (0 is its own start cell)
//   51..55    in its home lane
//   56        home
export const RING = 52, GAP = 13, LAST = 50, HOME = 56, STAR = 8;
// How long each part of a turn takes to play out on screen. The server waits this long before the next step.
export const MS = { die: 900, none: 750, step: 170, out: 450, cap: 700, home: 650, end: 320 };

const ring = [];
for (let c = 1; c <= 5; c++) ring.push([c, 6]);
for (let r = 5; r >= 0; r--) ring.push([6, r]);
ring.push([7, 0]);
for (let r = 0; r <= 5; r++) ring.push([8, r]);
for (let c = 9; c <= 14; c++) ring.push([c, 6]);
ring.push([14, 7]);
for (let c = 14; c >= 9; c--) ring.push([c, 8]);
for (let r = 9; r <= 14; r++) ring.push([8, r]);
ring.push([7, 14]);
for (let r = 14; r >= 9; r--) ring.push([6, r]);
for (let c = 5; c >= 0; c--) ring.push([c, 8]);
ring.push([0, 7], [0, 6]);
export const RING_CELLS = ring;

// Turn a cell a quarter turn clockwise k times: corner 0's layout becomes corner k's.
export function turned([c, r], k) {
  for (let i = 0; i < (k & 3); i++) [c, r] = [14 - r, c];
  return [c, r];
}

const YARD_SLOTS = [[2.5, .95], [.95, 2.5], [4.05, 2.5], [2.5, 4.05]];
export const yardCentre = corner => turned([2.5, 2.5], corner);
export const yardSlot = (corner, slot) => turned(YARD_SLOTS[slot % 4], corner);
export const lane = (corner, i) => turned([i, 7], corner); // i = 1..5
// Where a finished pawn stands, on the rim round the middle.
export const homeSpot = (corner, slot, of = 4) => turned([5.9, 7 + (slot - (of - 1) / 2) * .44], corner);

// Ring index of a pawn (or -1 when it is not on the ring).
export const ringIndex = (corner, p) => (p >= 0 && p <= LAST ? (corner * GAP + p) % RING : -1);
// Start cells and star cells: nobody can be captured there.
export const safeIndex = i => i % GAP === 0 || i % GAP === STAR;

// The cell a pawn stands on.
export function cellOf(corner, p, slot = 0, of = 4) {
  if (p < 0) return yardSlot(corner, slot);
  if (p <= LAST) return ring[ringIndex(corner, p)];
  if (p < HOME) return lane(corner, p - LAST);
  return homeSpot(corner, slot, of);
}

// Which corners are in play for 2, 3 or 4 players (two players sit opposite each other).
export const cornersFor = n => (n === 2 ? [0, 2] : [0, 1, 2, 3].slice(0, n));

// Pet Farm path tiles: which neighbours a path joins and a little seed so no two tiles look copy-pasted (Kuba, 2026-11-27).
// No three.js here, so the server can use it too.
export const PATHS = { path: true, gravel: true, plank: true, brick: true, moss: true };
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
// bits 0-3: a path of the same kind joins on that side, in the tile's own directions (0 +x, 1 +z, 2 -x, 3 -z); bits 4-11: its seed.
export function pathLink(items, type, x, y, r = 0, skip) {
  let nb = 0;
  if (!((r || 0) % 1)) for (let w = 0; w < 4; w++) {
    if ((items || []).some(i => i.type === type && i.id !== skip && i.x === x + DX[w] && i.y === y + DY[w] && !((i.r || 0) % 1))) nb |= 1 << ((w - (r | 0) + 4) % 4);
  }
  const seed = (Math.imul(Math.round(x * 4) + 101, 73856093) ^ Math.imul(Math.round(y * 4) + 37, 19349663)) >>> 0;
  return nb | (seed % 251) << 4;
}
// A path tile dropped half a tile off another of its kind slides in line with it (fits(x, y) checks the spot).
export function pathSnap(items, type, x, y, r, skip, fits) {
  const joins = (x, y) => (pathLink(items, type, x, y, r, skip) & 15) !== 0;
  if (joins(x, y)) return [x, y];
  for (const [dx, dy] of [[0, .5], [0, -.5], [.5, 0], [-.5, 0], [.5, .5], [-.5, .5], [.5, -.5], [-.5, -.5]]) if (fits(x + dx, y + dy) && joins(x + dx, y + dy)) return [x + dx, y + dy];
  return [x, y];
}

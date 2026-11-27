// Pet Farm path pieces (Kuba, 2026-11-27): half a tile each, like a bush, so a path can wind. Which neighbours a piece joins,
// and a little seed so no two pieces look copy-pasted. No three.js here, so the server can use it too.
export const PATHS = { path: true, gravel: true, plank: true, dirt: true, moss: true };
export const MAX_PATHS = 1200; // path pieces have their own allowance on top of MAX_ITEMS
const S = .5, DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
// bits 0-3: a path of the same kind joins on that side, in the piece's own directions (0 +x, 1 +z, 2 -x, 3 -z); bits 4-11: its seed.
export function pathLink(items, type, x, y, r = 0, skip) {
  let nb = 0;
  if (!((r || 0) % 1)) for (let w = 0; w < 4; w++) {
    if ((items || []).some(i => i.type === type && i.id !== skip && Math.abs(i.x - x - DX[w] * S) < 1e-6 && Math.abs(i.y - y - DY[w] * S) < 1e-6 && !((i.r || 0) % 1))) nb |= 1 << ((w - (r | 0) + 4) % 4);
  }
  const seed = (Math.imul(Math.round(x * 4) + 101, 73856093) ^ Math.imul(Math.round(y * 4) + 37, 19349663)) >>> 0;
  return nb | (seed % 251) << 4;
}
// A piece dropped next to (but not touching) one of its kind slides over to join it (fits(x, y) checks the spot).
export function pathSnap(items, type, x, y, r, skip, fits) {
  const joins = (x, y) => (pathLink(items, type, x, y, r, skip) & 15) !== 0;
  if (joins(x, y)) return [x, y];
  for (const [dx, dy] of [[S, 0], [-S, 0], [0, S], [0, -S]]) if (fits(x + dx, y + dy) && joins(x + dx, y + dy)) return [x + dx, y + dy];
  return [x, y];
}
// Old saves (before 2026-11-27 evening): path tiles were a whole tile and there was a Brick Path. Each old tile becomes
// four half pieces in the same spot (bricks become dirt). The three new ones are marked gf, so putting them away sends them
// to the stash instead of paying out three more costs. Returns the next free id.
export function halfPaths(items, nid) {
  const add = [];
  for (const i of items) {
    if (i.type === 'brick') i.type = 'dirt';
    if (!PATHS[i.type]) continue;
    i.r = 0;
    for (const [dx, dy] of [[S, 0], [0, S], [S, S]]) add.push({ id: nid++, type: i.type, x: i.x + dx, y: i.y + dy, r: 0, gf: 1 });
  }
  items.push(...add);
  return nid;
}

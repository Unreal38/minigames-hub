// Dominoes rules shared by the server and the browser. A double-six set: 28 tiles, numbered 0..27, each with two
// numbers from 0 (blank) to 6. The line on the table is an array from its left end to its right end; every entry is
// { t, a, b } where a is the number facing left and b the number facing right.

export const TILES = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TILES.push([a, b]);
export const tileId = (a, b) => TILES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
export const isDouble = t => TILES[t][0] === TILES[t][1];
export const pipsOf = t => TILES[t][0] + TILES[t][1];
export const handPips = h => h.reduce((s, t) => s + pipsOf(t), 0);
export const handSize = n => (n === 2 ? 7 : 5); // tiles each at the start of a round
export const sortHand = h => [...h].sort((x, y) => TILES[x][1] - TILES[y][1] || TILES[x][0] - TILES[y][0]);

// The two open numbers: [left, right], or null while the table is empty.
export const ends = chain => (chain.length ? [chain[0].a, chain[chain.length - 1].b] : null);

// Where tile t may go: '' (nowhere), 'l', 'r' or 'lr'. On an empty table any tile goes down (as 'r').
export function sides(chain, t) {
  if (!Number.isInteger(t) || !TILES[t]) return '';
  if (!chain.length) return 'r';
  const [x, y] = TILES[t], [l, r] = ends(chain);
  return (x === l || y === l ? 'l' : '') + (x === r || y === r ? 'r' : '');
}
export const playable = (chain, hand) => hand.filter(t => sides(chain, t));

// Puts tile t on the given end. `first` is where the round's first tile sits in the array (it moves along when
// tiles are added on the left), so the picture of the line can grow both ways without everything shifting.
// Returns { chain, first }, or null when the tile does not fit there.
export function place(chain, first, t, side) {
  if (!sides(chain, t).includes(side)) return null;
  const [x, y] = TILES[t];
  if (!chain.length) return { chain: [{ t, a: x, b: y }], first: 0 };
  const [l, r] = ends(chain);
  if (side === 'l') return { chain: [{ t, a: x === l ? y : x, b: l }, ...chain], first: first + 1 };
  return { chain: [...chain, { t, a: r, b: y === r ? x : y }], first };
}

// Who opens the first round and with what: the highest double anyone holds, or (when nobody has a double) the
// tile with the most pips.
export function opener(hands) {
  let best = null;
  hands.forEach((h, s) => { for (const t of h) { const v = (isDouble(t) ? 100 : 0) + pipsOf(t) * 2 + TILES[t][1] / 10; if (!best || v > best.v) best = { s, t, v }; } });
  return best;
}

// ---------- the picture of the line ----------
// Works in half-tile units: a tile is 1 wide and 2 long, a double lies crosswise. The first tile sits in the middle.
// The right arm runs right, turns down at the edge (x = W), comes back along a lower row, and so on; the left arm
// does the same upwards, so the two can never meet. V is how far a turn runs before the next row starts (2 packs
// the rows tightly, 3 leaves a clear gap). Returns { tiles, endL, endR }: for every entry of the line
// { x, z, dx, dz, near, far, dbl } (centre, the direction it was laid in, the number on the half laid first and on
// the other half), and the spots where the next tile would go on each end.
export function layout(chain, first = 0, W = 8, V = 2) {
  const tiles = Array(chain.length);
  if (!chain.length) { const o = { x: 0, z: 0, dx: 1, dz: 0 }; return { tiles, endL: o, endR: o }; }
  const f = chain[first], fd = f.a === f.b;
  tiles[first] = { x: 0, z: 0, dx: 1, dz: 0, near: f.a, far: f.b, dbl: fd };
  const arm = (sx, sz, idx) => {
    let px = sx * (fd ? .5 : 1), pz = 0, dx = sx, dz = 0, lastDbl = fd, lastH = sx, v = 0;
    const step = (dbl, near, far) => {
      const len = dbl ? 1 : 2;
      let turn = null;
      if (dz === 0) { if (dx > 0 ? px + len > W : px - len < -W) turn = [0, sz]; }
      else if (v >= V) turn = [-lastH, 0];
      if (turn) { // round the corner: the new tile hangs off the side of the last half (or off the end of a double)
        const cx = px - dx * .5, cz = pz - dz * .5, k = lastDbl ? 1 : .5;
        [dx, dz] = turn; px = cx + dx * k; pz = cz + dz * k;
        if (dz) v = 0; else lastH = dx;
      }
      const o = { x: px + dx * len / 2, z: pz + dz * len / 2, dx, dz, near, far, dbl };
      return { o, commit() { px += dx * len; pz += dz * len; if (dz) v += len; lastDbl = dbl; } };
    };
    for (const i of idx) { const e = chain[i], near = sx > 0 ? e.a : e.b, far = sx > 0 ? e.b : e.a; const s = step(e.a === e.b, near, far); tiles[i] = s.o; s.commit(); }
    return step(false, 0, 0).o; // where the next tile would land
  };
  const right = [], left = [];
  for (let i = first + 1; i < chain.length; i++) right.push(i);
  for (let i = first - 1; i >= 0; i--) left.push(i);
  const endR = arm(1, 1, right), endL = arm(-1, -1, left);
  return { tiles, endL, endR };
}
// The rectangle a laid tile covers, as [x0, z0, x1, z1].
export function footprint(o) {
  const along = o.dbl ? .5 : 1, across = o.dbl ? 1 : .5, hx = o.dx ? along : across, hz = o.dx ? across : along;
  return [o.x - hx, o.z - hz, o.x + hx, o.z + hz];
}

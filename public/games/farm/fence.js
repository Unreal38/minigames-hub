// Pet Farm fences: how thin fence pieces join, and the one-time move of fences saved before they became thin.
// No three.js here, so the server can use it too.
//
// A fence piece is 1 x .5 (turned: .5 x 1) and sits on half tiles. Its rails run through the middle of its strip, so a
// line always lies a quarter tile off the half-tile grid. Pieces in one line join end to end. Where two pieces meet at
// a right angle the corner point is a quarter tile past the end of one of them, so that end reaches on by a quarter:
//   - into the side of the other piece (a T; when the other piece's own end is right there and free, it stops at the
//     corner instead, which makes a clean L), or
//   - into an empty half tile that the other piece also reaches into (an L with its post standing in that half tile).
// Bushes and other half-tile props fit right beside a fence on either side.
// A diagonal piece (turned 45 degrees: r .5, 1.5, 2.5, 3.5) takes a whole 1 x 1 square and runs corner to corner. Diagonal
// pieces that share a corner join there (in line or turning). A straight piece reaching a quarter on lands on a diagonal's
// line a quarter of the way in from one of its ends, so it joins its side the same way it joins a straight piece's side.

const Q = .25;
const isFence = i => i && i.type === 'fence';
// A piece as a line: o 0 runs along x, 1 along y (the farm's z). c: where the line sits across; a..b: its run.
export function fenceLine(x, y, r = 0) {
  const o = (r | 0) % 2;
  return o ? { o, c: x + Q, a: y, b: y + 1 } : { o, c: y + Q, a: x, b: x + 1 };
}
// How a piece reaches the point (along its own run u, across v): 'through' it passes the point inside its run,
// 'ext' one of its ends is a quarter short of it, else null.
function reach(L, u, v) {
  if (L.c !== v) return null;
  if (u > L.a && u < L.b) return 'through';
  return u === L.a - Q || u === L.b + Q ? 'ext' : null;
}
// The point in a piece's own (along, across) terms, from the farm's x, y, and back.
const toXY = (o, along, across) => o ? [across, along] : [along, across];
const reachXY = (L, px, py) => L.o ? reach(L, py, px) : reach(L, px, py);
const lower = (A, B) => A.y !== B.y ? A.y < B.y : A.x !== B.x ? A.x < B.x : A.o < B.o;
// A diagonal piece: its square's centre and its two ends (the + end is where its own x points).
export const isDiag = r => (r || 0) % 1 !== 0;
function diagLine(x, y, r) {
  const t = r * Math.PI / 2, sx = Math.sign(Math.round(Math.cos(t) * 1e6)), sz = Math.sign(Math.round(Math.sin(t) * 1e6));
  const cx = x + .5, cy = y + .5;
  return { x, y, o: 2, cx, cy, plus: [cx + sx * .5, cy + sz * .5], minus: [cx - sx * .5, cy - sz * .5] };
}
const same = (p, q) => p[0] === q[0] && p[1] === q[1];
// strictly between a diagonal's ends, on its line
function onDiag(D, px, py) {
  const dx = D.plus[0] - D.minus[0], dy = D.plus[1] - D.minus[1], t = (px - D.minus[0]) / dx;
  return t > 0 && t < 1 && py - D.minus[1] === t * dy;
}
// the points a quarter beyond a straight piece's ends
const extPts = O => [toXY(O.o, O.a - Q, O.c), toXY(O.o, O.b + Q, O.c)];

// The joins of a fence at (x, y) turned r, as a number in the piece's own directions (+ the end at its local +x):
//   bits 0-1 the + end: 0 open, 1 joins a piece in line, 2 reaches on a quarter to a corner, 3 a Flower Arch in line (a gate:
//   the rails reach its post); bits 2-3 the same for the - end;
//   bit 4/5 the post at the + / - end (or where it reaches to) is this piece's to draw (shared posts are drawn once);
//   bit 6/7 another piece meets this one's side a quarter in from the + / - end (a post stands there);
//   bit 8/9 that end stops at that post instead (a clean corner); bit 10 a diagonal piece (see diagLink).
//   skip: an item id to leave out (one being moved).
export const LINKS = { fence: true };
export function fenceLink(items, x, y, r = 0, skip) {
  const all = (items || []).filter(i => isFence(i) && i.id !== skip && !(i.x === x && i.y === y && i.r === r));
  const diags = all.filter(i => isDiag(i.r)).map(i => diagLine(i.x, i.y, i.r));
  if (isDiag(r)) return diagLink(diagLine(x, y, r), all.filter(i => !isDiag(i.r)).map(i => fenceLine(i.x, i.y, i.r)), diags);
  const P = { x, y, ...fenceLine(x, y, r) }, sgn = (r | 0) < 2 ? 1 : -1;
  const others = all.filter(i => !isDiag(i.r) && !(i.x === x && i.y === y && (i.r | 0) % 2 === P.o))
    .map(i => ({ x: i.x, y: i.y, ...fenceLine(i.x, i.y, i.r) }));
  const arches = (items || []).filter(i => i?.type === 'arch' && i.id !== skip).map(i => fenceLine(i.x, i.y, i.r)); // a thin arch sits on the same lines
  const ends = [];
  for (const dir of [1, -1]) {
    const E = dir > 0 ? P.b : P.a, p = E + dir * Q, [px, py] = toXY(P.o, p, P.c);
    let st = 0, own = false;
    const metAt = u => { const [mx, my] = toXY(P.o, u, P.c); return others.some(O => O.o !== P.o && reachXY(O, mx, my) === 'ext'); };
    // in line: the piece to the west or north draws the shared post, unless a side post stands a quarter from it anyway
    if (arches.some(O => O.o === P.o && O.c === P.c && (dir > 0 ? O.a === P.b : O.b === P.a))) st = 3;
    else if (others.some(O => O.o === P.o && O.c === P.c && (dir > 0 ? O.a === P.b : O.b === P.a))) { st = 1; own = dir > 0 && !metAt(E - Q) && !metAt(E + Q); }
    else if (diags.some(D => onDiag(D, px, py))) st = 2; // into a diagonal's side: the diagonal draws that post
    else if (others.some(O => O.o !== P.o && reachXY(O, px, py))) {
      st = 2;
      const at = others.filter(O => reachXY(O, px, py)), thru = at.find(O => reachXY(O, px, py) === 'through');
      own = !thru && at.every(O => lower(P, O));
    }
    // a piece meeting this one's side a quarter in from this end
    const met = metAt(E - dir * Q);
    ends.push({ st, own, met, trim: met && st === 0 });
  }
  // local + end is the world b end when sgn > 0
  const [plus, minus] = sgn > 0 ? ends : [ends[1], ends[0]];
  return plus.st | minus.st << 2 | +plus.own << 4 | +minus.own << 5 | +plus.met << 6 | +minus.met << 7 | +plus.trim << 8 | +minus.trim << 9;
}
// A diagonal piece's joins, in the same bits (bit 10 says it is diagonal): ends join other diagonals sharing that corner
// (the lowest piece draws the post); straight pieces may meet its side a quarter of the way in from either end.
function diagLink(P, straights, diags) {
  const ext = straights.flatMap(extPts), key = D => [D.y, D.x, D.plus[0], D.plus[1]];
  const below = (A, B) => { const a = key(A), b = key(B); for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
  const bits = [P.plus, P.minus].map(E => {
    const at = diags.filter(D => same(D.plus, E) || same(D.minus, E)), st = at.length ? 1 : 0;
    const m = [(E[0] + P.cx) / 2, (E[1] + P.cy) / 2], met = ext.some(q => same(q, m));
    return { st, own: st === 1 && at.every(D => below(P, D)), met, trim: met && !st };
  });
  const [plus, minus] = bits;
  return plus.st | minus.st << 2 | +plus.own << 4 | +minus.own << 5 | +plus.met << 6 | +minus.met << 7 | +plus.trim << 8 | +minus.trim << 9 | 1 << 10;
}
// The piece's shape from its link, in its own terms (x from -.5 to .5, a diagonal from -.71 to .71): where the rails start
// and stop, the posts, the pickets.
export function fenceShape(link = 0) {
  const st = [link & 3, link >> 2 & 3], own = [link >> 4 & 1, link >> 5 & 1], met = [link >> 6 & 1, link >> 7 & 1], trim = [link >> 8 & 1, link >> 9 & 1];
  const diag = link >> 10 & 1, H = diag ? Math.SQRT1_2 : .5, q = diag ? Math.SQRT1_2 / 2 : Q;
  const end = k => trim[k] ? q : st[k] === 2 ? .5 + Q : st[k] === 3 ? .56 : H, hi = end(0), lo = -end(1), posts = [];
  for (const k of [0, 1]) {
    const s = k ? -1 : 1;
    if (met[k]) posts.push(s * q);
    if (!trim[k] && st[k] !== 3 && (st[k] === 0 || own[k])) posts.push(s * end(k));
  }
  const pickets = (diag ? [-.5, -.3, -.1, .1, .3, .5] : [-.625, -.325, -.125, .125, .325, .625]).filter(t => t > lo + .06 && t < hi - .06 && posts.every(q => Math.abs(q - t) > .09));
  return { lo, hi, posts, pickets };
}

// Fences saved before they were thin filled a whole tile, with the line through its middle. Each becomes one thin piece
// inside its old tile (so nothing can overlap), on the half that keeps its runs and corners joined.
export function thinFences(items) {
  const old = items.filter(isFence), at = new Map(old.map(i => [i.x + ',' + i.y, i]));
  if (!old.length) return 0;
  const has = (x, y) => at.has(x + ',' + y);
  // runs: pieces joined along x share an H run, along y a V run
  const root = new Map(), find = k => { while (root.get(k) !== k) k = root.get(k); return k; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) root.set(a, b); };
  for (const i of old) { root.set('h' + i.x + ',' + i.y, 'h' + i.x + ',' + i.y); root.set('v' + i.x + ',' + i.y, 'v' + i.x + ',' + i.y); }
  for (const i of old) { if (has(i.x + 1, i.y)) join('h' + i.x + ',' + i.y, 'h' + (i.x + 1) + ',' + i.y); if (has(i.x, i.y + 1)) join('v' + i.x + ',' + i.y, 'v' + i.x + ',' + (i.y + 1)); }
  const H = i => find('h' + i.x + ',' + i.y), V = i => find('v' + i.x + ',' + i.y);
  // which half each run takes (0 the low half, 1 the high one): corners tie an H run to a V run, T joins pin one run
  const side = new Map(), links = new Map(), pin = [];
  const link = (a, b, par) => { for (const [p, q] of [[a, b], [b, a]]) { if (!links.has(p)) links.set(p, []); links.get(p).push([q, par]); } };
  const shape = i => {
    const L = has(i.x - 1, i.y), R = has(i.x + 1, i.y), U = has(i.x, i.y - 1), D = has(i.x, i.y + 1);
    return { L, R, U, D, a: R ? 1 : 0, b: D ? 1 : 0, h: L || R, v: U || D };
  };
  for (const i of old) {
    const s = shape(i);
    if (s.L !== s.R && s.U !== s.D) link(H(i), V(i), 1 ^ s.a ^ s.b); // corner: H half xor V half
    else if (s.L && s.R && s.U !== s.D) pin.push([H(i), s.b]);       // T, the stem reaches into the through line
    else if (s.U && s.D && s.L !== s.R) pin.push([V(i), s.a]);
  }
  const fill = (k, v) => {
    if (side.has(k)) return; side.set(k, v);
    const todo = [k];
    while (todo.length) { const n = todo.pop(); for (const [m, par] of links.get(n) || []) if (!side.has(m)) { side.set(m, side.get(n) ^ par); todo.push(m); } }
  };
  for (const [k, v] of pin) fill(k, v);
  for (const k of links.keys()) fill(k, 0);
  const sideOf = k => side.get(k) || 0;
  let n = 0;
  for (const i of old) {
    const s = shape(i), r = i.r | 0;
    let horiz;
    if (!s.h && !s.v) horiz = r % 2 === 0;         // a lone piece ran along its own x
    else if (!s.v) horiz = true; else if (!s.h) horiz = false;
    else if (s.L && s.R) horiz = true;              // through along x (a T or a cross)
    else if (s.U && s.D) horiz = false;
    else horiz = sideOf(H(i)) === s.b || sideOf(V(i)) !== s.a; // a corner: the piece that carries the corner
    if (horiz) { i.y += .5 * sideOf(H(i)); if (r % 2) i.r = 0; }
    else { i.x += .5 * sideOf(V(i)); if (r % 2 === 0) i.r = 1; }
    n++;
  }
  return n;
}

// Flower Arches saved before they were thin (1 x .5 like a fence) filled a whole tile. Each takes the half of its old tile
// that lines up with a fence next to it along its own line, else the first half.
export function thinArches(items) {
  const fences = items.filter(isFence).map(i => fenceLine(i.x, i.y, i.r));
  let n = 0;
  for (const i of items) {
    if (i.type !== 'arch') continue;
    const o = (i.r | 0) % 2, a = o ? i.y : i.x, c0 = (o ? i.x : i.y) + Q;
    const side = fences.some(F => F.o === o && F.c === c0 + .5 && (F.b === a || F.a === a + 1)) && !fences.some(F => F.o === o && F.c === c0 && (F.b === a || F.a === a + 1)) ? 1 : 0;
    if (o) i.x += .5 * side; else i.y += .5 * side;
    n++;
  }
  return n;
}

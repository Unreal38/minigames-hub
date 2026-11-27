// Thin fences (2026-11-27): a fence is 1 x .5 on half tiles, so a bush fits right beside it. Joins and the one-time
// move of old whole-tile fences live in public/games/farm/fence.js.
const { fenceLink, fenceShape, thinFences, thinArches, fenceLine } = await import('../public/games/farm/fence.js');
let bad = 0; const fail = m => { bad++; console.error(m); };
const F = (id, x, y, r = 0) => ({ id, type: 'fence', x, y, r });
const st = (l, k) => l >> (k * 2) & 3;

// a lone piece: posts at both ends, nothing reaches on
if (fenceLink([F(1, 2, 2)], 2, 2, 0) !== 0) fail('a lone fence should have no joins');
{ const s = fenceShape(0); if (s.lo !== -.5 || s.hi !== .5 || s.posts.length !== 2) fail('lone fence shape ' + JSON.stringify(s)); }
// two in a line share one post, drawn by the west piece
{ const it = [F(1, 0, 0), F(2, 1, 0)], a = fenceLink(it, 0, 0, 0, 1), b = fenceLink(it, 1, 0, 0, 2);
  if (st(a, 0) !== 1 || !(a >> 4 & 1) || st(b, 1) !== 1 || b >> 5 & 1) fail(`straight join ${a} ${b}`);
  if (fenceShape(a).posts.length + fenceShape(b).posts.length !== 3) fail('a straight join should have 3 posts in all'); }
// turned twice it still joins (its local + end now faces west)
{ const it = [F(1, 0, 0, 2), F(2, 1, 0)], a = fenceLink(it, 0, 0, 2, 1); if (st(a, 1) !== 1) fail('turned piece should join on its - end ' + a); }
// an L through an empty half tile: both reach a quarter on and meet, one post between them
{ const it = [F(1, .5, 0), F(2, 0, .5, 1)], a = fenceLink(it, .5, 0, 0, 1), b = fenceLink(it, 0, .5, 1, 2);
  if (st(a, 1) !== 2 || st(b, 1) !== 2) fail(`L corner should reach on ${a} ${b}`);
  if ((a >> 5 & 1) + (b >> 5 & 1) !== 1) fail('the corner post should be drawn once');
  if (fenceShape(a).lo !== -.75) fail('reaching end should stop at the corner'); }
// a clean L into a side: the end reaches on, the other piece stops at the corner
{ const it = [F(1, 0, .5), F(2, 0, 1, 1)], a = fenceLink(it, 0, .5, 0, 1), b = fenceLink(it, 0, 1, 1, 2);
  if (!(a >> 7 & 1) || !(a >> 9 & 1)) fail('the through piece should stop at the corner ' + a);
  if (st(b, 1) !== 2 || b >> 5 & 1) fail('the stem should reach on without its own post ' + b);
  const s = fenceShape(a); if (s.lo !== -.25 || !s.posts.includes(-.25) || s.posts.includes(-.5)) fail('trimmed shape ' + JSON.stringify(s)); }
// a bush (half tile) right beside a fence never touches its line
{ const L = fenceLine(3, 3, 0); if (L.c - 3 !== .25) fail('a fence line should sit in the middle of its half-tile strip'); }

// old whole-tile fences: each stays inside its own tile, and a closed ring has no loose ends afterwards
const ring = [], N = 5; let id = 1;
for (let x = 1; x <= N; x++) { ring.push(F(id++, x, 1, 0), F(id++, x, N, 0)); }
for (let y = 2; y < N; y++) { ring.push(F(id++, 1, y, 1), F(id++, N, y, 1)); }
ring.push(F(id++, 8, 8, 1)); // a lone one
const before = ring.map(i => ({ ...i }));
thinFences(ring);
for (const i of ring) {
  const o = before.find(b => b.id === i.id), [w, h] = i.r % 2 ? [.5, 1] : [1, .5];
  if (i.x < o.x || i.y < o.y || i.x + w > o.x + 1 || i.y + h > o.y + 1) fail(`moved fence ${i.id} left its old tile`);
  if (i.id < id - 1) { const l = fenceLink(ring, i.x, i.y, i.r, i.id); for (const k of [0, 1]) if (st(l, k) === 0 && !(l >> (8 + k) & 1)) fail(`ring fence ${i.id} at ${i.x},${i.y} has a loose end (${l})`); }
}
if (ring.at(-1).r !== 1 || ring.at(-1).x !== 8) fail('a lone turned fence should stay turned');
// a T and a crooked line still move without overlaps
{ const t = [F(1, 0, 0), F(2, 1, 0), F(3, 2, 0), F(4, 1, 1), F(5, 1, 2), F(6, 4, 4), F(7, 5, 4), F(8, 5, 5), F(9, 6, 5)];
  thinFences(t);
  const l = fenceLink(t, t[3].x, t[3].y, t[3].r, 4); if (st(l, 0) !== 2 && st(l, 1) !== 2) fail('T stem should reach the through line ' + JSON.stringify(t[3]));
  const cells = new Set(); for (const i of t) { const [w, h] = i.r % 2 ? [1, 2] : [2, 1]; for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) { const k = (i.x * 2 + a) + ',' + (i.y * 2 + b); if (cells.has(k)) fail('moved fences overlap at ' + k); cells.add(k); } } }

// a thin Flower Arch in line is a gate: the rails reach its post and no fence post stands there
{ const it = [F(1, 0, .5), { id: 2, type: 'arch', x: 1, y: .5, r: 0 }], a = fenceLink(it, 0, .5, 0, 1);
  if (st(a, 0) !== 3) fail('fence should join the arch in line ' + a);
  const s = fenceShape(a); if (s.hi !== .56 || s.posts.includes(.56) || s.posts.includes(.5)) fail('arch end shape ' + JSON.stringify(s)); }
// an old whole-tile arch moves to the half that lines up with the (already thin) fence next to it
{ const it = [F(1, 0, .5), { id: 2, type: 'arch', x: 1, y: 0, r: 0 }, { id: 3, type: 'arch', x: 5, y: 5, r: 1 }];
  thinArches(it); if (it[1].y !== .5 || it[1].x !== 1) fail('old arch should line up with its fence ' + JSON.stringify(it[1]));
  if (it[2].x !== 5 || it[2].y !== 5) fail('a lone old arch should stay on its first half ' + JSON.stringify(it[2])); }

// diagonal fences (r .5 ...): a whole 1 x 1 square, corner to corner
{ const it = [F(1, 1, 1, .5), F(2, 2, 2, .5)], a = fenceLink(it, 1, 1, .5, 1), b = fenceLink(it, 2, 2, .5, 2);
  if (!(a >> 10 & 1) || st(a, 0) !== 1 || !(a >> 4 & 1) || st(b, 1) !== 1 || b >> 5 & 1) fail(`diagonals in line ${a} ${b}`);
  const s = fenceShape(a); if (Math.abs(s.hi - Math.SQRT1_2) > 1e-9 || s.posts.length !== 2) fail('diagonal shape ' + JSON.stringify(s)); }
{ const it = [F(1, 0, 0, .5), F(2, 1, 0, 1.5)], a = fenceLink(it, 0, 0, .5, 1), b = fenceLink(it, 1, 0, 1.5, 2); // a V turning at (1, 1)
  if (st(a, 0) !== 1 || st(b, 0) !== 1 || (a >> 4 & 1) + (b >> 4 & 1) !== 1) fail(`diagonal corner ${a} ${b}`); }
{ const it = [F(1, 1, 1, .5), F(2, 0, 1, 0)], d = fenceLink(it, 1, 1, .5, 1), h = fenceLink(it, 0, 1, 0, 2); // a straight one meets its side
  if (st(h, 0) !== 2 || h >> 4 & 1) fail('straight should reach into the diagonal ' + h);
  if (!(d >> 7 & 1) || !(d >> 9 & 1)) fail('diagonal should stop at the straight one (clean corner) ' + d);
  const s = fenceShape(d); if (Math.abs(s.lo + Math.SQRT1_2 / 2) > 1e-9) fail('trimmed diagonal ' + JSON.stringify(s)); }

if (bad) { console.error(`fences: ${bad} problem(s)`); process.exit(1); }
console.log('fences ok');

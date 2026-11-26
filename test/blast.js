// Blast Bay test: the maze (start corners free, every open tile reachable once crates go), the blast shape, the
// corner-slip stepping, whole bot matches on a fake clock (they finish, places and results make sense), what a
// person may send (no walking through walls, no teleporting, seeds only where you stand), and the view never
// telling which crates hide a pet.
import * as B from '../server/games/blast.js';
import * as R from '../public/games/blast/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const P = (id, name) => ({ id, name, color: '#ff8fab', av: [0, 0, 0, 0] });
const people = n => Array.from({ length: n }, (_, i) => P('p' + i, 'Player' + i));
const real = Date.now; let now = real(); Date.now = () => now;

// ----- the maze -----
for (const n of [2, 4, 5, 8]) for (let k = 0; k < 20; k++) {
  const m = R.makeMaze(n), { w, h, grid, has } = m;
  if (w !== (n <= 4 ? 15 : 19) || h !== (n <= 4 ? 13 : 15)) fail(`maze size for ${n}`);
  for (let x = 0; x < w; x++) if (grid[x] !== R.WALL || grid[(h - 1) * w + x] !== R.WALL) fail('top and bottom edges are walls');
  for (const [x, y] of R.starts(w, h).slice(0, Math.max(4, n))) {
    if (grid[y * w + x] !== R.OPEN) fail(`start ${x},${y} must be open`);
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid[(y + dy) * w + x + dx] === R.OPEN).length;
    if (side < 2) fail(`start ${x},${y} needs room to step away from a first seed`);
  }
  for (let i = 0; i < w * h; i++) if (has[i] >= 0 && grid[i] !== R.CRATE) fail('only crates hide pets');
  // with the crates gone, every non-wall tile can be walked to from the first corner
  const seen = new Uint8Array(w * h), q = [w + 1]; seen[w + 1] = 1;
  while (q.length) { const i = q.pop(); for (const d of [1, -1, w, -w]) { const j = i + d; if (!seen[j] && grid[j] !== R.WALL) { seen[j] = 1; q.push(j); } } }
  for (let i = 0; i < w * h; i++) if (grid[i] !== R.WALL && !seen[i]) fail('a tile nobody can reach');
}
// blasts: a plus, stopped by walls, breaking (and stopping on) the first crate
{
  const w = 7, h = 7, g = new Uint8Array(w * h);
  g[3 * w + 5] = R.CRATE; g[1 * w + 3] = R.WALL;
  const cells = R.blastCells(g, w, h, 3, 3, 3).map(c => c.slice(0, 2).join(','));
  for (const c of ['3,3', '4,3', '5,3', '2,3', '1,3', '0,3', '3,4', '3,5', '3,6', '3,2']) if (!cells.includes(c)) fail(`blast should reach ${c}`);
  for (const c of ['6,3', '3,1', '3,0']) if (cells.includes(c)) fail(`blast should stop before ${c}`);
}
// the crumble order rings the edge, never a wall, never twice
{
  const m = R.makeMaze(4), o = R.crumbleOrder(m.grid, m.w, m.h);
  if (new Set(o).size !== o.length || o.some(i => m.grid[i] === R.WALL)) fail('crumble order');
  if (o[0] !== m.w + 1) fail('the crumble starts in the top-left corner');
}
// stepping: walk a lane, stop at a wall, slip round a corner when a bit off the lane
{
  const free = (x, y) => !(x % 2 === 0 && y % 2 === 0) && x > 0 && y > 0 && x < 10 && y < 10;
  const p = { x: 1, y: 1 };
  for (let i = 0; i < 40; i++) R.tryMove(p, 1, 0, .1, free);
  if (Math.abs(p.x - 5) > 4 || p.y !== 1) fail('walking right along row 1');
  const q = { x: 1, y: 1 };
  for (let i = 0; i < 20; i++) R.tryMove(q, -1, 0, .1, free);
  if (q.x !== 1) fail('the edge wall stops you');
  const c = { x: 1.3, y: 1 }; // just past the middle of tile 1, heading down: 2,2 is a pillar, so it slides back to x 1
  for (let i = 0; i < 10; i++) R.tryMove(c, 0, 1, .1, free);
  if (c.x !== 1 || c.y <= 1) fail('sliding back to the lane, then down');
  if (R.steer({ x: 1, y: 1 }, .1, .1, .1, free) !== null) fail('a tiny stick push does nothing');
}

// ----- options and seats -----
{
  const o = B.cleanOpts({ wins: 9, arena: 'moon', crumble: 'x', bots: 'mean', seats: 99 });
  if (o.wins !== 3 || o.arena !== 'random' || o.crumble !== 'on' || o.bots !== 'chill' || o.seats > 8) fail('cleanOpts defaults');
  const p = B.cleanOpts({ wins: 5, arena: 'sweet', crumble: 'off', bots: 'sharp', seats: 6 });
  if (p.wins !== 5 || p.arena !== 'sweet' || p.crumble !== 'off' || p.bots !== 'sharp' || p.seats !== 6) fail('cleanOpts keeps good picks');
  const G = B.create(people(1), { seats: 4 });
  if (G.seats.length !== 4 || G.seats.filter(s => s.bot).length !== 3) fail('one person and three bots');
  if (new Set(G.seats.map(s => s.name)).size !== 4) fail('bot names differ');
  const H = B.create(people(6), { seats: 4 });
  if (H.seats.length !== 6 || H.w !== 19) fail('six people get six seats and the big maze');
}

// ----- whole bot matches on a fake clock -----
for (const [n, bots, crumble] of [[2, 'sharp', 'on'], [4, 'chill', 'on'], [8, 'sharp', 'on'], [3, 'sharp', 'off']]) {
  now = real();
  const G = B.create(people(1), { seats: n, bots, wins: 2, crumble });
  B.setAway(G, 0, true);
  let ticks = 0;
  const arenas = new Set();
  while (G.ph === 'play' && ticks < 20 * 60 * 40) { now += 50; B.fast(G, now); ticks++; arenas.add(G.arena); }
  if (G.ph !== 'end') fail(`${n} ${bots} bots: the match never ended`);
  const r = B.results(G);
  if (!r || r.length !== n) fail('results per seat');
  if (!r.some(x => x.win) || r.filter(x => x.place === 1).length < 1) fail('someone is first');
  const best = Math.max(...G.wins);
  r.forEach((x, i) => { if (x.place < 1 || x.place > n) fail('place range'); if (x.win !== (x.place === 1)) fail('win means 1st'); if (x.place === 1 && G.wins[i] !== best) fail('1st has the most round wins'); });
  if (best < 2 && G.round < 2 * 2 + 3) fail('the match ends at the goal or the round cap');
  if (G.round > 1 && G.opts.arena === 'random' && arenas.size < 2) fail('random arena changes between rounds');
  const v = B.view(G, 0);
  if (v.ph !== 'end' || !v.res || !v.seats) fail('end view carries results and seats');
}

// ----- what a person may send -----
{
  now = real();
  const G = B.create(people(2), { seats: 2, wins: 3 });
  if (B.act(G, 0, { t: 'b', x: 1, y: 1 })) fail('no seeds during the count');
  now += R.COUNT_MS + 10; B.fast(G, now);
  if (G.stage !== 'play') fail('the round starts after the count');
  const p = G.pl[0], sx = Math.round(p.x), sy = Math.round(p.y);
  // a wall is never walkable
  const wallX = sx === 1 ? 0 : G.w - 1;
  B.act(G, 0, { t: 'p', x: wallX * R.Q, y: sy * R.Q, f: 0 });
  if (Math.round(G.pl[0].x) !== sx) fail('walked into the edge wall');
  // teleporting far is refused, and three bad reports in a row snap you back
  const snap0 = p.snap;
  const fx = sx < G.w / 2 ? G.w - 2 : 1, fy = sy < G.h / 2 ? G.h - 2 : 1;
  for (let i = 0; i < 3; i++) { now += 50; B.act(G, 0, { t: 'p', x: fx * R.Q, y: fy * R.Q, f: 0 }); }
  if (Math.round(G.pl[0].x) !== sx || p.snap !== snap0 + 1) fail('teleport refused and snapped');
  // a small honest step is taken
  now += 200; B.act(G, 0, { t: 'p', x: Math.round(p.x * R.Q), y: Math.round(p.y * R.Q), f: 1 });
  if (p.f !== 1) fail('an honest report is kept');
  // seeds: only near you, only as many as you may have out
  if (B.act(G, 0, { t: 'b', x: fx, y: fy })) fail('a seed far away');
  if (!B.act(G, 0, { t: 'b', x: sx, y: sy })) fail('a seed where you stand');
  if (B.act(G, 0, { t: 'b', x: sx, y: sy })) fail('two seeds on one tile');
  if (p.out !== 1 || G.bombs.length !== 1) fail('one seed out');
  if (B.act(G, 1, { t: 'k', id: G.bombs[0].id, dx: 1, dy: 0 })) fail('no kick without the Stone boost');
  if (B.act(G, 0, { t: 'zz' }) || B.act(G, 0, null) || B.act(G, -1, { t: 'b', x: 1, y: 1 })) fail('junk is ignored');
  // the seed bursts after the fuse and catches its planter if they stayed on it
  const id = G.bombs[0].id;
  for (let t = 0; t < R.FUSE_MS + R.GRACE_MS + 200; t += 50) { now += 50; B.fast(G, now); }
  if (G.bombs.some(b => b.id === id)) fail('the seed burst');
  if (G.pl[0].in) fail('standing on your own seed gets you caught');
  if (p.out !== 0) fail('the seed comes back after it bursts');
  if (B.act(G, 0, { t: 'b', x: sx, y: sy })) fail('a caught player plants nothing');
  // that ends a 2-player round
  if (G.stage !== 'over' || G.wins[1] !== 1) fail('the other player takes the round');
}

// ----- hidden crates and the view shape -----
{
  now = real();
  const G = B.create(people(3), { seats: 3 });
  now += 50; B.fast(G, now);
  const v = B.view(G, 1);
  const json = JSON.stringify(v);
  if ('has' in v || json.includes('"has"')) fail('the view must not say which crates hide pets');
  if (typeof v.g !== 'string' || v.g.length !== v.w * v.h) fail('the grid string');
  if (v.a.length !== 3 || v.a.some(a => a.length !== 4)) fail('players list');
  if (!v.my || v.my.max !== R.START.bombs || v.my.range !== R.START.range) fail('my boosts start at the base');
  if (!v.seats || v.seats.length !== 3) fail('seats on a full send');
  const w = B.view(G, -1);
  if (w.my || typeof w.g !== 'string') fail('a watcher gets the grid but no "my"');
}

// ----- a pet boost: break a pet crate, walk on, get its element -----
{
  now = real();
  const G = B.create(people(1), { seats: 2 });
  now += R.COUNT_MS + 10; B.fast(G, now);
  const p = G.pl[0];
  p.x = Math.round(p.x); p.y = Math.round(p.y);
  G.items.push({ id: 999, x: p.x, y: p.y, el: R.ELS.indexOf('Ember'), sp: 'cat', at: now });
  const r0 = p.range;
  now += 50; B.fast(G, now);
  if (p.range !== r0 + 1 || G.items.some(i => i.id === 999)) fail('an Ember pet adds blast reach');
}

Date.now = real;
console.log('blast ok');

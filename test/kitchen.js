// Cozy Kitchen Rush test: the movement and plating rules, cooking every dish by hand, whole shifts of bots on a
// fake clock, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as kr from '../server/games/kitchen.js';
import { kitchen, KITCHENS, RECIPES, T, move, target, fits, matches, isFloor, RAD } from '../public/games/kitchen/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- the kitchens -----
for (const id of Object.keys(KITCHENS)) {
  const K = kitchen(id);
  if (K.t.some(r => r.length !== K.cols)) fail(id + ': rows of different lengths');
  for (const k of 'TLMBPCSFDWX') if (!K.cells.some(c => c.k === k)) fail(`${id}: no ${k} station`);
  // every station can be reached from every floor tile
  const floor = []; for (let r = 0; r < K.rows; r++) for (let c = 0; c < K.cols; c++) if (isFloor(K, c, r)) floor.push([c, r]);
  const seen = new Set([floor[0].join()]), q = [floor[0]];
  while (q.length) { const [c, r] = q.shift(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [c + dc, r + dr]; if (isFloor(K, ...n) && !seen.has(n.join())) { seen.add(n.join()); q.push(n); } } }
  if (seen.size !== floor.length) fail(id + ': the floor is in more than one piece');
  for (const x of K.cells) if (x.k !== '#' && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => isFloor(K, x.c + dc, x.r + dr))) fail(`${id}: ${x.k} at ${x.key} cannot be reached`);
}
{ // walking into a counter slides along it and never goes through
  const K = kitchen('diner');
  let [x, z] = [1.5, 1.5];
  for (let i = 0; i < 40; i++) [x, z] = move(K, x, z, 0, -.2);
  if (z < 1 + RAD - 1e-6 || Math.abs(x - 1.5) > 1e-6) fail('walked into the top counters: ' + z);
  [x, z] = move(K, 1.5, 1.5, -5, 0);
  if (x < 1 + RAD - 1e-6) fail('tunnelled through the left counter');
  // facing the tomato crate from below it
  const t = target(K, 1.5, 1.4, Math.PI);
  if (!t || K.t[t.r][t.c] !== 'T') fail('should reach the tomato crate, got ' + JSON.stringify(t));
  if (target(K, 5.5, 2.5, Math.PI / 2) !== null && K.t[target(K, 5.5, 2.5, Math.PI / 2).r][target(K, 5.5, 2.5, Math.PI / 2).c] !== '.') {} // open floor in front: fine either way
}
{ // what goes on a plate
  const P = (has, soup = null) => ({ k: 'plate', has, soup });
  if (!fits(P([]), 'lettuce') || !fits(P(['lettuce']), 'tomato') || !fits(P(['bun', 'patty']), 'tomato')) fail('should fit');
  if (fits(P(['lettuce']), 'lettuce') || fits(P([], 'tomato'), 'bun') || fits(P([]), 'mushroom')) fail('should not fit');
  if (!matches(P(['tomato', 'lettuce']), 'salad') || matches(P(['tomato']), 'salad') || !matches(P([], 'mushroom'), 'msoup') || matches(P(['bun', 'patty', 'tomato']), 'burger')) fail('matching wrong');
}

// ----- cooking by hand -----
const realNow = Date.now;
function kit(opts = {}) {
  let now = realNow(); Date.now = () => now;
  const G = kr.create(players.slice(0, 1), { seats: 1, ...opts }, null, now);
  const clock = ms => { const end = now + ms; while (now < end) { now += 100; kr.fast(G, now); } };
  clock(T.count * 1000 + 200);
  if (G.stage !== 'cook') fail('shift did not start after the countdown');
  const K = kitchen(G.map), at = k => K.cells.filter(c => c.k === k);
  // stand next to a cell (teleport, the server is told by a move) and use it
  const go = cell => { for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (isFloor(K, cell.c + dc, cell.r + dr)) { G.pl[0].x = cell.c + dc + .5; G.pl[0].z = cell.r + dr + .5; return; } fail('nowhere to stand'); };
  const use = (cell, want = true) => { go(cell); const ok = kr.act(G, 0, { t: 'use', c: cell.c, r: cell.r }); if (!!ok !== want) fail(`use ${cell.k} at ${cell.key} gave ${ok}, holding ${JSON.stringify(G.pl[0].hold)}`); };
  const chop = cell => { go(cell); if (!kr.act(G, 0, { t: 'chop', c: cell.c, r: cell.r })) fail('chop refused'); clock(T.chop * 1000 + 300); if (!G.cells[cell.key].item?.ch) fail('chopping did not finish'); };
  const fetch = (crate, board) => { use(at(crate)[0]); use(board); chop(board); use(board); };
  return { G, K, at, use, chop, clock, fetch, now: () => now };
}
try {
  { // salad: a plate on a counter, chopped lettuce and tomato on it, served
    const { G, at, use, fetch } = kit();
    G.orders = [{ id: 1, r: 'salad', at: Date.now(), life: 60000 }];
    const board = at('C')[0], spot = at('#').find(c => !G.cells[c.key].item && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([a, b]) => isFloor(kitchen(G.map), c.c + a, c.r + b)));
    use(at('D')[0]); use(spot);
    fetch('L', board); use(spot);
    if (kr.act(G, 0, { t: 'use', c: at('W')[0].c, r: at('W')[0].r })) fail('used a counter out of reach');
    fetch('T', board); use(spot);
    if (!matches(G.cells[spot.key].item, 'salad')) fail('salad not built: ' + JSON.stringify(G.cells[spot.key].item));
    use(spot); use(at('W')[0]);
    if (G.served !== 1 || G.tips < RECIPES.salad.tip || G.pts[0] !== G.tips) fail('salad not served or tips wrong');
    const tipsBefore = G.tips;
    use(at('D')[0]); use(at('W')[0], false); // an empty plate nobody ordered
    if (G.tips !== tipsBefore) fail('a wrong plate changed the tips');
  }
  { // soup: three chopped tomatoes in a pot, cooked, ladled, served; left too long it burns
    const { G, at, use, fetch, clock } = kit();
    G.orders = [{ id: 1, r: 'tsoup', at: Date.now(), life: 120000 }];
    const board = at('C')[0], pot = at('S')[0];
    for (let i = 0; i < 3; i++) { fetch('T', board); use(pot); }
    fetch('M', board); use(pot, false); // the pot is full
    use(at('X')[0]);
    if (G.pl[0].hold) fail('bin did not take the mushroom');
    use(at('D')[0]); use(pot, false); // not cooked yet
    clock(T.soup * 1000 + 300);
    use(pot);
    if (G.pl[0].hold.soup !== 'tomato') fail('ladled the wrong soup');
    use(at('W')[0]);
    if (G.served !== 1) fail('soup not served');
    for (let i = 0; i < 3; i++) { fetch('M', board); use(pot); }
    clock(T.soup * T.soupBurn * 1000 + 500);
    if (G.cells[pot.key].pot.cook < T.soupBurn || !G.ev.some(e => e.t === 'burn')) fail('soup did not burn');
    use(pot); // empty hands on a burnt pot tip it out
    if (G.cells[pot.key].pot.n) fail('burnt pot not emptied');
  }
  { // burger: patty in the pan, bun on a plate, patty on the bun
    const { G, at, use, clock } = kit({ map: 'split' });
    G.orders = [{ id: 1, r: 'burger', at: Date.now(), life: 120000 }];
    const pan = at('F')[0];
    use(at('P')[0]); use(pan);
    use(at('B')[0]); use(at('D')[0]); // bun straight onto a fresh plate
    if (G.pl[0].hold?.k !== 'plate' || G.pl[0].hold.has[0] !== 'bun') fail('bun should go on a plate from the rack');
    use(pan, false); // raw patty cannot go on a plate
    clock(T.patty * 1000 + 300);
    use(pan);
    if (!matches(G.pl[0].hold, 'burger')) fail('burger not built');
    use(at('W')[0]);
    if (G.served !== 1) fail('burger not served');
  }
  { // an order that runs out costs tips and is gone
    const { G, clock } = kit();
    G.tips = 50; G.orders = [{ id: 9, r: 'salad', at: Date.now(), life: 1000 }]; G.nextOrder = Infinity;
    clock(1500);
    if (G.orders.some(o => o.id === 9) || G.tips !== 40 || G.missed !== 1) fail('missed order not handled');
  }
  { // moving too far at once is clamped and flagged
    const { G } = kit();
    const p = G.pl[0], fix = p.fix;
    kr.act(G, 0, { t: 'mv', x: p.x + 8, z: p.z, f: 0 });
    if (p.fix === fix || Math.abs(p.x - 8) < 1) fail('teleport was not stopped');
  }
} finally { Date.now = realNow; }

// ----- whole shifts of bots, with two players who wander off -----
function shift(opts) {
  let now = realNow(); Date.now = () => now;
  try {
    const G = kr.create(players, opts, null, now);
    if (G.seats.length !== Math.max(2, opts.seats)) fail('seats not filled with bots');
    kr.setAway(G, 0, true); kr.setAway(G, 1, true); // both players are away: bots cook for them
    while (G.ph === 'play') {
      now += 150; kr.fast(G, now);
      for (const p of G.pl) if (!isFloor(kitchen(G.map), Math.floor(p.x), Math.floor(p.z))) fail('a bot walked into a counter at ' + p.x + ',' + p.z);
    }
    const r = kr.results(G);
    if (!r || r.filter(x => x.win).length !== 1 || !r[G.win].win || new Set(r.map(x => x.place)).size !== r.length) fail('results wrong');
    if (G.pts.reduce((a, b) => a + b, 0) < G.tips - 1 && !G.missed) fail('tips should be shared out to the cooks');
    JSON.stringify(kr.view(G, 0));
    return G;
  } finally { Date.now = realNow; }
}
for (const [map, bots, seats] of [['diner', 'chill', 3], ['diner', 'sharp', 4], ['split', 'chill', 2], ['split', 'sharp', 3]]) {
  const G = shift({ map, bots, seats, time: 120 });
  console.log(`${map} ${bots} ${seats} cooks: ${G.served} served, ${G.missed} missed, ${G.tips} tips, ${G.res.stars} stars`);
  if (G.served < 1) fail('bots cooked nothing');
}
{ // a watcher takes over a bot straight away
  const G = kr.create(players.slice(0, 1), { seats: 3 });
  if (!kr.seatWatcher(G, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }) || !G.seats.some(s => s.id === 'c' && s.human)) fail('watcher not seated');
}

// ----- over the real server -----
const PORT = 20080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}`, KR_TEST_TIME: '25' }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'kitchen', opts: { seats: 4, time: 999, map: 'split', bots: 'sharp' } });
await wait(300);
if (room?.game !== 'kitchen' || room.opts.seats !== 4 || room.opts.map !== 'split' || room.opts.time !== 180) bail('room options wrong: ' + JSON.stringify(room?.opts));
send({ t: 'opts', opts: { seats: '2', time: '120', map: 'diner' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.time !== 120 || room.opts.map !== 'diner') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'kitchen' || state.seats.length !== 2 || state.stage !== 'count') bail('game did not start');
await wait(T.count * 1000 + 300);
if (state.stage !== 'cook') bail('countdown did not end');
// walk up to the tomato crate and take one
const K = kitchen('diner'), crate = K.cells.find(c => c.k === 'T');
let x = state.pl[state.me].x, z = state.pl[state.me].z;
for (let i = 0; i < 60 && Math.hypot(crate.c + .5 - x, crate.r + 1.5 - z) > .1; i++) {
  const dx = crate.c + .5 - x, dz = crate.r + 1.5 - z, d = Math.hypot(dx, dz), s = Math.min(d, .35);
  [x, z] = move(K, x, z, dx / d * s, dz / d * s);
  send({ t: 'act', a: { t: 'mv', x, z, f: Math.PI } }); await wait(110);
}
send({ t: 'act', a: { t: 'use', c: crate.c, r: crate.r, x, z, f: Math.PI } }); await wait(300);
if (state.pl[state.me].hold?.k !== 'tomato') bail('could not take a tomato: ' + JSON.stringify(state.pl[state.me]));
// the bots play out the shift (and our seat keeps the tomato)
for (let i = 0; i < 400 && state.ph === 'play'; i++) await wait(100);
if (state.ph !== 'end') bail('shift over the server did not end');
await wait(300);
if (!me?.gain || room.played !== 1) bail('finished shift was not scored');
console.log('OK');
srv.kill(); process.exit(0);

// Cove Clash test: checks the placing rules, plays whole games on a fake clock with both bots, makes sure nobody
// can see the other fleet early, then plays a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as cove from '../server/games/cove.js';
import { BOARDS, cellsOf, around, fits, validFleet, randomFleet, fleetMap, SEA, MISS, HIT, CLEAR } from '../public/games/cove/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- rules -----
if (cellsOf({ c: 7, len: 3, v: 0 }, 10).join() !== '7,8,9' || cellsOf({ c: 8, len: 3, v: 0 }, 10) || cellsOf({ c: 70, len: 3, v: 1 }, 10).join() !== '70,80,90' || cellsOf({ c: 80, len: 3, v: 1 }, 10)) fail('boat squares wrong');
if (cellsOf({ c: -1, len: 1, v: 0 }, 10) || cellsOf({ c: 100, len: 1, v: 0 }, 10) || cellsOf({ c: 1.5, len: 1, v: 0 }, 10) || cellsOf(null, 10)) fail('bad boat accepted');
if (around([0], 10).sort((a, b) => a - b).join() !== '1,10,11' || around([55], 10).length !== 8 || around([44, 45], 10).length !== 10) fail('neighbours wrong');
{
  const two = [{ c: 0, len: 2, v: 0 }, { c: 12, len: 1, v: 0 }]; // touching at a corner
  if (fits(two, 0, 10) || fits(two, 1, 10)) fail('boats touching at a corner were allowed');
  two[1].c = 13; if (!fits(two, 0, 10) || !fits(two, 1, 10)) fail('boats one square apart were refused');
  two[1].c = 1; if (fits(two, 1, 10)) fail('overlapping boats were allowed');
}
for (const [name, B] of Object.entries(BOARDS)) for (let k = 0; k < 300; k++) {
  const f = randomFleet(name);
  if (!validFleet(f, name)) fail('random layout not valid');
  if (fleetMap(f, B.n).filter(x => x >= 0).length !== B.fleet.reduce((a, b) => a + b, 0)) fail('boats overlap');
  if (validFleet(f.slice(1), name) || validFleet(f.map((b, i) => (i ? b : { ...b, len: b.len + 1 })), name)) fail('wrong fleet accepted');
}
for (const [o, want] of [[{}, 'classic/chill/20'], [{ board: 'quick', bots: 'sharp', timer: 0 }, 'quick/sharp/0'], [{ board: 'x', bots: 1, timer: 7, seats: 6 }, 'classic/chill/20']]) {
  const c = cove.cleanOpts(o); if ([c.board, c.bots, c.timer].join('/') !== want || Object.keys(c).length !== 3) fail('options not cleaned: ' + JSON.stringify(c));
}

// ----- whole games on a fake clock -----
function play(opts, human, people = players) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = cove.create(people, opts), B = BOARDS[G.opts.board], total = B.fleet.reduce((a, b) => a + b, 0);
    if (G.seats.length !== 2 || G.sea[0].length !== B.n * B.n || !validFleet(G.boats[0], G.opts.board) || !validFleet(G.boats[1], G.opts.board)) fail('seats, bays or fleets wrong');
    if (people.length === 2) {
      if (G.stage !== 'setup') fail('two people should start by arranging boats');
      const v0 = cove.view(G, 0), vw = cove.view(G, -1);
      if (v0.boats[0].length !== B.fleet.length || v0.boats[1].length || vw.boats[0].length || vw.boats[1].length) fail('a fleet leaked while arranging');
      if (cove.act(G, 0, { t: 'fire', c: 0 })) fail('fired before the game began');
      const mine = randomFleet(G.opts.board);
      if (!cove.act(G, 0, { t: 'layout', boats: mine.map(b => [b.c, b.v]) }) || G.boats[0].some((b, i) => b.c !== mine[i].c || b.v !== mine[i].v)) fail('layout refused');
      const bad = mine.map(b => [b.c, b.v]); bad[1] = bad[0];
      if (cove.act(G, 0, { t: 'layout', boats: bad }) || cove.act(G, 0, { t: 'layout', boats: bad.slice(1) }) || cove.act(G, 0, { t: 'layout', boats: 'x' }) || cove.act(G, 0, { t: 'layout', boats: mine.map(() => null) })) fail('bad layout accepted');
      if (!cove.act(G, 0, { t: 'ready' }) || cove.act(G, 0, { t: 'ready' }) || cove.act(G, 0, { t: 'layout', boats: mine.map(b => [b.c, b.v]) })) fail('ready not handled');
      if (!cove.act(G, 0, { t: 'ready', on: false }) || !cove.act(G, 0, { t: 'ready', on: true }) || G.stage !== 'setup') fail('could not change my mind');
      if (opts.late) { now += cove.MS.setup + 10; cove.tick(G, now); } else cove.act(G, 1, { t: 'ready' });
      if (G.stage !== 'go') fail('game did not begin');
    } else if (people.length === 0 && G.stage !== 'go') fail('bots should be ready at once');
    for (let i = 0; i < 200000 && G.ph === 'play'; i++) {
      now += 100;
      const s = G.turn;
      for (const p of [0, 1]) { // what each player can see of the other bay
        const v = cove.view(G, p), o = 1 - p;
        if (v.boats[p].some(b => !b) || v.boats[o].some((b, k) => (b ? !G.boats[o][k].sunk : G.boats[o][k].sunk))) fail('the other fleet leaked');
        if (JSON.stringify(v).includes('"map"')) fail('the fleet map leaked');
      }
      if (G.stage === 'play' && s >= 0 && G.seats[s].human && !G.seats[s].bot && human && now >= G.lockAt) {
        const o = 1 - s, free = G.sea[o].indexOf(SEA), used = G.sea[o].findIndex(x => x !== SEA);
        if (cove.act(G, o, { t: 'fire', c: G.sea[s].indexOf(SEA) })) fail('fired out of turn');
        if (cove.act(G, s, { t: 'fire', c: 999 }) || cove.act(G, s, { t: 'fire' }) || cove.act(G, s, { t: 'dance', c: free }) || cove.act(G, s, null) || cove.act(G, s, { t: 'fire', c: '3' })) fail('nonsense accepted');
        if (used >= 0 && cove.act(G, s, { t: 'fire', c: used })) fail('fired at a square twice');
        const mv = G.mv, hitsBefore = G.st[s].hits; human(G, s, now);
        if (G.mv !== mv + 1) fail('human shot refused');
        if (G.ph === 'play' && (G.st[s].hits > hitsBefore) !== (G.turn === s)) fail('a hit must give another shot and a miss must pass the turn');
        if (G.ph === 'play' && cove.act(G, G.turn, { t: 'fire', c: G.sea[1 - G.turn].indexOf(SEA) })) fail('fired while the coconut was in the air');
      } else cove.tick(G, now);
      for (const p of [0, 1]) { // the marks agree with the boats
        const sea = G.sea[p], map = fleetMap(G.boats[p], G.n);
        sea.forEach((x, c) => { if (x === HIT && map[c] < 0) fail('a hit on open water'); if ((x === MISS || x === CLEAR) && map[c] >= 0) fail('a miss on a boat'); });
        G.boats[p].forEach(b => { const cs = cellsOf(b, G.n), h = cs.filter(c => sea[c] === HIT).length; if (h !== b.hits || b.sunk !== (h === b.len)) fail('boat hits wrong'); if (b.sunk && around(cs, G.n).some(c => sea[c] === SEA)) fail('water round a sunk boat not marked'); });
      }
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = cove.results(G), w = G.win;
    if (w < 0 || !G.boats[1 - w].every(b => b.sunk) || G.boats[w].every(b => b.sunk) || !r[w].win || r[1 - w].win) fail('winner wrong');
    if (r[w].pts !== total || r[1 - w].pts >= total || r[0].pts !== G.st[0].hits) fail('points wrong');
    const v = cove.view(G, 1 - w); if (v.boats[w].some(b => !b)) fail('fleets should be shown at the end');
    return G;
  } finally { Date.now = realNow; }
}
const viaBot = level => (G, s, now) => cove._bot(G, s, now, level);
for (const board of ['classic', 'quick']) {
  const G = play({ board, timer: 0 }, viaBot('chill'));
  console.log(`${board}: ${G.seats[G.win].name} wins after ${G.st[G.win].shots} shots`);
  play({ board, timer: 20, late: true }, viaBot('sharp'));
}
{ // nobody acts: the timer arranges, shoots and finishes the game, and the idlers earn nothing
  const G = play({ board: 'quick', timer: 10, late: true }, null);
  const r = cove.results(G); if (!r[0].idle || !r[1].idle || G.st[0].auto !== G.st[0].shots) fail('timer games should be idle');
}
{ // against a bot, and a seat that leaves is played by a bot
  const G = play({ board: 'quick', timer: 0 }, viaBot('chill'), players.slice(0, 1));
  if (!G.seats[1].bot || cove.results(G)[0].idle) fail('bot seat wrong');
  const H = cove.create(players, { board: 'quick' });
  if (!cove.setAway(H, 1, true) || !H.ready[1] || cove.setAway(H, 1, true)) fail('leaving while arranging should make the seat ready');
  cove.act(H, 0, { t: 'ready' }); if (H.stage !== 'go') fail('game should begin when the other seat left');
}
// the sharp bot should beat the chill one clearly more often than not
{
  const realNow = Date.now; let now = realNow(); Date.now = () => now; let wins = 0; const N = 300;
  for (let k = 0; k < N; k++) {
    const G = cove.create([], { timer: 0 });
    for (let i = 0; i < 100000 && G.ph === 'play'; i++) { now += 200; if (G.stage !== 'play') { cove.tick(G, now); continue; } if (now < G.lockAt) continue; cove._bot(G, G.turn, now, G.turn === 0 ? 'sharp' : 'chill'); }
    if (G.win === 0) wins++;
  }
  Date.now = realNow;
  console.log(`sharp bot beats chill bot ${wins} times in ${N}`);
  if (wins < N * .58) fail('the sharp bot is not better than the chill one');
}

// ----- over the real server: one person against a bot, a whole quick game -----
const PORT = 27080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}`, COVE_FAST: 20 }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));
// Wait for the server's answer instead of a fixed time: a busy test machine (or Nagle's delay on the test's own
// socket, ~40-200 ms) can hold a message back longer than a short sleep.
const until = async (ok, ms = 5000) => { for (const end = Date.now() + ms; !ok() && Date.now() < end;) await wait(10); return ok(); };
let ws = null; // the server may take a moment to start: try again until it answers
for (let k = 0; k < 100 && !ws; k++) {
  await wait(100);
  const w = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  if (await new Promise(r => { w.onopen = () => r(true); w.onerror = () => r(false); })) ws = w;
}
if (!ws) bail('could not reach the server');
let room = null, state = null, me = null, me0 = null;
const send = msg => ws.send(JSON.stringify(msg));
send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me') me0 = msg; if (msg.t === 'me' && msg.gain) me = msg; };
await until(() => me0);
send({ t: 'create', game: 'cove', opts: { board: 'quick', timer: 10, seats: 6 } });
await until(() => room);
if (room?.game !== 'cove' || room.opts.board !== 'quick' || room.opts.timer !== 10 || 'seats' in room.opts || room.max !== 2) bail('room options wrong');
send({ t: 'opts', opts: { bots: 'sharp' } }); await until(() => room.opts.bots === 'sharp');
if (room.opts.bots !== 'sharp' || room.opts.board !== 'quick') bail('option change lost');
send({ t: 'start' }); await until(() => state);
if (state?.game !== 'cove' || state.stage !== 'setup' || state.seats.length !== 2 || !state.seats[1 - state.me].bot || state.boats[1 - state.me].length) bail('game did not start with the boats to arrange');
const mine = randomFleet('quick');
const kept = () => state.boats[state.me].every((b, i) => b.c === mine[i].c && b.v === mine[i].v);
send({ t: 'act', a: { t: 'layout', boats: mine.map(b => [b.c, b.v]) } }); await until(kept);
if (!kept()) bail('my layout was not kept');
send({ t: 'act', a: { t: 'ready' } }); await until(() => state.stage !== 'setup');
if (state.stage === 'setup') bail('game did not begin after Ready');
let shots = 0;
for (let i = 0; i < 6000 && state.ph === 'play'; i++) {
  if (state.stage === 'play' && state.turn === state.me) {
    const sea = state.sea[1 - state.me], free = sea.map((x, c) => (x === SEA ? c : -1)).filter(c => c >= 0);
    if (state.boats[1 - state.me].some((b, k) => b && !b.sunk)) bail('saw a boat that is not sunk');
    const mv = state.mv; send({ t: 'act', a: { t: 'fire', c: free[Math.random() * free.length | 0] } });
    await until(() => state.mv !== mv || state.ph !== 'play', 400); // a shot sent during the lock is refused: try again
    if (state.mv > mv) shots++;
  } else await wait(15);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await until(() => me?.gain && room.paid);
const won = state.win === state.me;
if (!me?.gain || me.gain.coins !== (won ? 10 : 1)) bail('wrong coins paid at the end: ' + JSON.stringify(me?.gain));
if (me.gain.ranked) bail('a game against a bot must not count for the rankings');
if (!room.board?.length || room.paid?.[1 - state.me] !== 'b') bail('table scoreboard or coins column wrong');
console.log('OK server game:', shots, 'shots,', won ? 'won' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

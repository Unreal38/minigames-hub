// Treasure Dig test: checks the field and the numbers, plays whole games on a fake clock (making sure nothing
// under the grass is ever sent before it is dug), measures the bots, then plays a table over the real server.
import { spawn } from 'node:child_process';
import * as td from '../server/games/dig.js';
import { KIND, SIZES, HINT, around, near, isGem } from '../public/games/dig/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- the field -----
for (const size of ['small', 'big']) for (let k = 0; k < 50; k++) {
  const F = td.makeField(size), Z = SIZES[size];
  const count = kind => F.cells.filter(c => c === kind).length;
  if (F.cells.length !== Z.w * Z.h || count(KIND.trap) !== Z.traps || count(KIND.gem) !== Z.gem || count(KIND.big) !== Z.big || count(KIND.chest) !== Z.chest) fail('field has the wrong things buried');
  for (const i of [F.mid, ...around(F.mid, F.w, F.h)]) if (F.cells[i] !== KIND.dirt) fail('the middle is not clear');
  F.cells.forEach((_, i) => { if (F.num[i] !== around(i, F.w, F.h).filter(j => F.cells[j] === KIND.trap).length) fail('wrong number'); });
}
if (around(0, 8, 8).length !== 3 || around(9, 8, 8).length !== 8 || around(7, 8, 8).length !== 3) fail('neighbours wrong');
{ // the judge: a 1 with one hidden neighbour means that one is a trap; a 0 makes its neighbours safe
  const L = { gem: 0, big: 0, chest: 0, trap: 1 };
  if (td.judge(2, 1, [-1, 1], [], L)[0].pT !== 1 || td.judge(2, 1, [-1, 0], [], L)[0].pT !== 0) fail('bot reasoning wrong');
  // 1-2-1 style: the subset rule settles the middle of three hidden tiles
  const j = td.judge(3, 2, [-1, -1, -1, 1, 1, 1], [], L), p = i => j.find(o => o.i === i).pT;
  if (p(2) !== 0 || p(0) !== 0 || p(1) !== 1) fail('subset reasoning wrong: ' + JSON.stringify(j));
}

// ----- whole games -----
function play(opts, human = (G, s, now) => td._bot(G, s, now)) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = td.create(players, opts), n = G.seats.length;
    if (n !== (opts.seats || 4)) fail('seats not filled with bots');
    let digs = 0, lastPts = 0;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 100;
      for (const s of [-1, 0, 1]) { // nobody may learn what is under the grass
        const v = td.view(G, s);
        if (v.all) fail('whole field sent during play');
        v.tiles.forEach((x, k) => { if ((x < 0) !== !G.open[k]) fail('open state wrong'); });
        if (JSON.stringify(v).includes('"cells"') || JSON.stringify(v).includes('"num"')) fail('hidden field leaked in the view');
      }
      const s = G.turn;
      if (G.stage === 'turn' && s >= 0 && G.seats[s].human && !G.seats[s].bot) {
        const other = (s + 1) % n;
        if (G.seats[other].human && td.act(G, other, { t: 'dig', i: G.open.indexOf(0) })) fail('dug out of turn');
        if (td.act(G, s, { t: 'dig', i: G.open.indexOf(1) }) || td.act(G, s, { t: 'dig', i: -1 }) || td.act(G, s, { t: 'dig', i: 1.5 }) || td.act(G, s, { t: 'jump' })) fail('nonsense accepted');
        const before = G.digN; human(G, s, now); if (G.digN !== before + 1) fail('human dig refused');
      } else td.tick(G, now);
      if (G.dig && G.dig.n > digs) {
        digs = G.dig.n; const d = G.dig;
        if (!G.open[d.i]) fail('dug tile not open');
        if (d.kind === KIND.trap && d.pts > 0) fail('trap paid points');
        if (isGem(d.kind) && d.pts <= 0) fail('gem paid nothing');
        if (d.opened.some(j => G.cells[j] !== KIND.dirt)) fail('flood opened a gem or a trap');
        if (G.pts.some(p => p < 0)) fail('negative points');
        if (G.stage !== 'dig') fail('no time to watch the dig');
      }
      if (G.stage === 'turn' && G.dig && isGem(G.dig.kind) && G.ph === 'play' && G.turn !== G.dig.s) fail('a gem did not give another dig');
      lastPts = G.pts.reduce((a, b) => a + b, 0);
    }
    if (G.ph !== 'end') fail('game did not end');
    if (G.cells.some((k, i) => isGem(k) && !G.open[i])) fail('game ended with gems still buried');
    const v = td.view(G, 0); if (!v.all || v.all.length !== G.cells.length) fail('field not shown at the end');
    const r = td.results(G);
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win || !r[G.win].win || r.filter(x => x.win).length !== 1) fail('results disagree');
    for (let k = 1; k < n; k++) if (G.pts[G.res.order[k - 1]] < G.pts[G.res.order[k]]) fail('placing order wrong');
    return { G, digs, lastPts };
  } finally { Date.now = realNow; }
}
const a = play({});
console.log('default field: winner', a.G.seats[a.G.win].name, 'with', a.G.pts[a.G.win], 'points after', a.digs, 'digs');
const b = play({ seats: 6, size: 'small', bots: 'sharp' });
if (b.G.w !== 8) fail('size option not applied');
console.log('quick field, six seats: winner', b.G.seats[b.G.win].name, 'with', b.G.pts[b.G.win], 'points after', b.digs, 'digs');
play({ seats: 2, timer: 0 });
// a human who always digs the first grass tile they see (they will hit traps)
play({ seats: 3 }, (G, s) => { if (!td.act(G, s, { t: 'dig', i: G.open.indexOf(0) })) fail('dig refused'); });

{ // stars: only on empty tiles dug by hand, and only when a gem is still buried within HINT.reach of them
  for (let g = 0; g < 30; g++) {
    const G = td.create([], { seats: 3 }); let now = Date.now(), hand = new Set();
    for (let k = 0; k < 200 && G.ph === 'play'; k++) {
      now += 5000;
      if (G.stage === 'turn' && G.turn >= 0) { td._bot(G, G.turn, now); hand.add(G.dig.i); } else td.tick(G, now);
      const V = td.view(G, 0), gl = new Set(V.glint);
      V.tiles.forEach((v, i) => {
        const want = v >= 0 && v <= 8 && hand.has(i) && near(i, G.w, G.h, HINT.reach).some(j => V.tiles[j] < 0 && isGem(G.cells[j]));
        if (want !== gl.has(i)) fail('star wrong on tile ' + i);
        if (V.lit.includes(i) !== (v >= 0 && v <= 8 && hand.has(i))) fail('lit wrong on tile ' + i);
      });
    }
  }
}
{ // sharp bots should beat chill ones, and games should not drag
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let sharp = 0, digs = 0, traps = [0, 0], ptsSum = [0, 0]; const N = 300;
  for (let g = 0; g < N; g++) {
    const G = td.create([], { seats: 4 });
    while (G.ph === 'play') { now += 500; const s = G.turn; if (G.stage === 'turn' && s >= 0) td._bot(G, s, now, s % 2 ? 'sharp' : 'chill'); else td.tick(G, now); }
    if (G.win % 2) sharp++; digs += G.digN;
    G.seats.forEach((_, i) => { traps[i % 2] += G.st[i].traps; ptsSum[i % 2] += G.pts[i]; });
  }
  Date.now = realNow;
  console.log(`bots: sharp won ${sharp}/${N}, ${(digs / N).toFixed(1)} digs a game; traps hit chill ${(traps[0] / N / 2).toFixed(2)} sharp ${(traps[1] / N / 2).toFixed(2)} each; points chill ${(ptsSum[0] / N / 2).toFixed(1)} sharp ${(ptsSum[1] / N / 2).toFixed(1)}`);
  if (sharp < N * .55) fail('sharp bots are not better than chill ones');
  if (digs / N > 60) fail('games drag on');
}
{ // the turn timer digs for you; a player who leaves is played by a bot; a watcher takes a bot's seat when the turn passes
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = td.create(players, { seats: 4, timer: 15 });
  for (let i = 0; i < 2000 && !(G.stage === 'turn' && G.seats[G.turn]?.human); i++) { now += 100; td.tick(G, now); }
  const d0 = G.digN; now += 15100; td.tick(G, now);
  if (G.digN !== d0 + 1 || !G.dig.late) fail('timer did not dig');
  td.seatWatcher(G, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] });
  if (G.seats.some(s => s.id === 'c')) fail('watcher seated in the middle of a dig');
  td.setAway(G, 0, true);
  for (let i = 0; i < 5000 && G.ph === 'play' && !G.seats.some(s => s.id === 'c'); i++) { now += 100; td.tick(G, now); }
  if (G.ph === 'play' && !G.seats.some(s => s.id === 'c' && s.human)) fail('watcher was not seated');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 22080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'dig', opts: { seats: 6, size: 'big', timer: 15, dice: 3 } });
await wait(300);
if (room?.game !== 'dig' || room.opts.seats !== 6 || room.opts.size !== 'big' || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, size: 'small' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.size !== 'small' || room.opts.timer !== 15) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'dig' || state.seats.length !== 2 || state.tiles.length !== 64 || state.all) bail('game did not start');
let turns = 0;
for (let i = 0; i < 3000 && state.ph === 'play'; i++) {
  if (state.stage === 'turn' && state.turn === state.me) {
    const i = state.tiles.indexOf(-1); // dig the first grass tile, traps and all
    send({ t: 'act', a: { t: 'dig', i } }); turns++;
    await wait(150);
  } else await wait(100);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins !== (me.gain.place === 1 ? 10 : 1)) bail('coins not paid by place: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', turns, 'digs,', state.win === state.me ? 'won' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

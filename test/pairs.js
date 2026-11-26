// Pet Pairs test: plays whole games on a fake clock (checking nobody is ever sent a face-down pet, except the
// Spyglass peeker, and every pair is found once), the twists, the streak cap, the timer, ties, then a table over
// the real WebSocket server.
import { spawn } from 'node:child_process';
import * as pg from '../server/games/pairs.js';
import { BOARDS, boardOf, ptsOf } from '../public/games/pairs/rules.js';
import { SPECIES } from '../public/games/farm/data.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const ppl = n => Array.from({ length: n }, (_, k) => ({ id: 'p' + k, name: 'P' + k, color: ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffb547', '#e8a0e0', '#7fd1e8'][k], av: [k] }));
const clock = () => { const realNow = Date.now; let now = realNow(); Date.now = () => now; return { add: ms => (now += ms), get now() { return now; }, done: () => { Date.now = realNow; } }; };
const ready = (G, T) => { T.add(5000); pg.tick(G, T.now); if (G.stage !== 'pick') fail('deal did not end'); };
const twinOf = (G, i) => G.sp.findIndex((p, j) => j !== i && p === G.sp[i] && G.got[j] < 0);
const otherThan = (G, i) => G.sp.findIndex((p, j) => p !== G.sp[i] && G.got[j] < 0);

// ----- boards and options -----
{
  if (boardOf('auto', 2) !== 'small' || boardOf('auto', 4) !== 'mid' || boardOf('auto', 5) !== 'big' || boardOf('big', 2) !== 'big') fail('auto board wrong');
  const o = pg.cleanOpts({ seats: 9, timer: 7, board: 'huge', twists: 'maybe', streak: 5 });
  if (o.seats !== 4 || o.timer !== 10 || o.board !== 'auto' || o.twists !== 'on' || o.streak !== 0) fail('bad options not cleaned: ' + JSON.stringify(o));
  if (pg.cleanOpts({ seats: 6 }).seats !== 6 || pg.cleanOpts({ streak: 3 }).streak !== 3 || pg.cleanOpts({ twists: 'off' }).twists !== 'off' || pg.cleanOpts({ timer: 0 }).timer !== 0) fail('good options lost');
  for (const [b, [w, h]] of Object.entries(BOARDS)) {
    const G = pg.create(ppl(2), { board: b });
    if (G.sp.length !== w * h || G.left !== w * h / 2) fail(b + ' board size wrong');
    const count = {}; for (const p of G.sp) { if (!SPECIES[p]) fail('no such pet ' + p); count[p] = (count[p] || 0) + 1; }
    if (Object.values(count).some(k => k !== 2)) fail('every pet should be on exactly two cards');
    if (G.tw.filter(Boolean).length !== 6 || ['gold', 'spy', 'mix'].some(k => G.tw.filter(t => t === k).length !== 2)) fail('twists should be one pair each');
    if (G.tw.some((t, i) => t !== G.tw[twinOf(G, i)])) fail('both cards of a pair share the twist');
  }
  if (pg.create(ppl(2), { twists: 'off' }).tw.some(Boolean)) fail('twists off still dealt twists');
  if (pg.create(ppl(6), {}).seats.length !== 6 || pg.create(ppl(6), {}).board !== 'big') fail('six players play the big board');
}

{ // a match keeps the pair and goes again, a miss turns back and passes the turn
  const T = clock(); const G = pg.create(ppl(3), { seats: 3, timer: 0, twists: 'off' }); ready(G, T);
  const s = G.turn, i = 0, j = twinOf(G, 0);
  if (pg.act(G, (s + 1) % 3, { t: 'flip', i: 0 })) fail('flipped out of turn');
  if (!pg.act(G, s, { t: 'flip', i }) || pg.act(G, s, { t: 'flip', i })) fail('flip the same card twice');
  if (pg.view(G, (s + 1) % 3).face[i]?.[0] !== G.sp[i]) fail('a flipped card is shown to everyone');
  pg.act(G, s, { t: 'flip', i: j });
  if (G.stage !== 'got' || G.got[i] !== s || G.score[s] !== 1) fail('pair not taken');
  if (pg.act(G, s, { t: 'flip', i: 1 })) fail('flipped while the pair is shown');
  T.add(1200); pg.tick(G, T.now);
  if (G.turn !== s || G.stage !== 'pick') fail('a match should go again');
  if (pg.act(G, s, { t: 'flip', i })) fail('flipped a found card');
  const a = G.sp.findIndex((_, k) => G.got[k] < 0), b = otherThan(G, a);
  pg.act(G, s, { t: 'flip', i: a }); pg.act(G, s, { t: 'flip', i: b });
  if (G.stage !== 'show') fail('a miss should show both cards');
  T.add(2000); pg.tick(G, T.now);
  if (G.turn !== (s + 1) % 3 || G.up.length || pg.view(G, 0).face[a] !== null) fail('a miss should turn back and pass the turn');
  T.done();
}
{ // golden counts 3, spyglass peeks for one player only, whirlwind swaps two pairs of face-down cards
  const T = clock(); const G = pg.create(ppl(2), { seats: 2, timer: 10 }); ready(G, T);
  const s = G.turn, o = 1 - s;
  const take = kind => { const i = G.tw.findIndex((t, k) => t === kind && G.got[k] < 0); pg.act(G, s, { t: 'flip', i }); pg.act(G, s, { t: 'flip', i: twinOf(G, i) }); T.add(1100); pg.tick(G, T.now); };
  take('gold'); if (G.score[s] !== 3) fail('golden pair is worth 3');
  take('spy'); if (G.stage !== 'spy') fail('spyglass should ask for a card');
  if (pg.act(G, o, { t: 'peek', i: 0 })) fail('the other player peeked');
  const p = G.sp.findIndex((_, k) => G.got[k] < 0);
  if (!pg.act(G, s, { t: 'peek', i: p })) fail('peek refused');
  if (pg.view(G, s).peek?.sp !== G.sp[p] || pg.view(G, o).peek !== null || pg.view(G, o).face[p] !== null || pg.view(G, o).peekAt !== p) fail('only the peeker sees the peeked pet');
  T.add(2000); pg.tick(G, T.now);
  if (G.stage !== 'pick' || G.turn !== s || pg.view(G, s).peek) fail('after a peek the same player goes on');
  const before = G.sp.slice(); take('mix');
  if (G.stage !== 'mix') fail('whirlwind should swap');
  const e = G.ev.findLast(x => x.t === 'mix'); if (!e || e.sw.length !== 2) fail('mix event missing');
  for (const [a, b] of e.sw) { if (G.sp[a] !== before[b] || G.sp[b] !== before[a] || G.got[a] >= 0 || G.got[b] >= 0) fail('swap wrong'); }
  if (new Set(e.sw.flat()).size !== 4) fail('four different cards move');
  T.add(2000); pg.tick(G, T.now); if (G.stage !== 'pick' || G.turn !== s) fail('after the whirlwind the same player goes on');
  T.done();
}
{ // the streak cap passes the turn after 3 pairs; the timer flips random cards for you
  const T = clock(); const G = pg.create(ppl(2), { seats: 2, timer: 6, streak: 3, twists: 'off' }); ready(G, T);
  const s = G.turn;
  for (let k = 0; k < 3; k++) { const i = G.sp.findIndex((_, x) => G.got[x] < 0); pg.act(G, s, { t: 'flip', i }); pg.act(G, s, { t: 'flip', i: twinOf(G, i) }); T.add(1100); pg.tick(G, T.now); }
  if (G.turn !== 1 - s || G.score[s] !== 3) fail('streak cap should pass the turn after 3 pairs');
  const mv = G.mv; T.add(6100); pg.tick(G, T.now); T.add(600); pg.tick(G, T.now);
  if (G.mv !== mv + 2) fail('the timer should flip two random cards');
  T.done();
}
{ // equal points share first place
  const T = clock(); const G = pg.create(ppl(2), { seats: 2, timer: 0, board: 'small', twists: 'off' }); ready(G, T);
  while (G.left > 1) { const s = G.turn, i = G.sp.findIndex((_, x) => G.got[x] < 0); pg.act(G, s, { t: 'flip', i }); pg.act(G, s, { t: 'flip', i: twinOf(G, i) }); T.add(1100); pg.tick(G, T.now); }
  const s = G.turn; G.score[s] = 4; G.score[1 - s] = 5;
  const i = G.sp.findIndex((_, x) => G.got[x] < 0); pg.act(G, s, { t: 'flip', i }); pg.act(G, s, { t: 'flip', i: twinOf(G, i) }); T.add(1100); pg.tick(G, T.now);
  if (G.ph !== 'end') fail('the last pair should end the game');
  const r = pg.results(G); if (!r[0].win || !r[1].win || r[0].place !== 1 || r[1].place !== 1 || G.ev.at(-1).tie !== true) fail('a tie should share first place');
  T.done();
}

// ----- whole games -----
function play(opts, people = ppl(2), human = (G, s, now) => pg._bot(G, s, now, 'chill')) {
  const T = clock();
  try {
    const G = pg.create(people, opts), n = G.seats.length;
    if (pg.act(G, G.turn, { t: 'flip', i: 0 }) && G.seats[G.turn].human) fail('flipped during the deal');
    for (let i = 0; i < 200000 && G.ph === 'play'; i++) {
      T.add(100);
      for (let s = -1; s < n; s++) { // nobody may see a face-down pet, except the peeker
        const v = pg.view(G, s), str = JSON.stringify(v);
        v.face.forEach((f, k) => { if (f && G.got[k] < 0 && !G.up.includes(k)) fail('a face-down card was sent'); });
        if (v.peek && (!G.peek || G.peek.s !== s)) fail('peek leaked');
        if (str.includes('"mem"')) fail('bot memory leaked');
      }
      const s = G.turn;
      if (s >= 0 && (G.stage === 'pick' || G.stage === 'spy') && G.seats[s].human && !G.seats[s].bot) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && pg.act(G, other, { t: 'flip', i: G.got.findIndex(g => g < 0) })) fail('acted out of turn');
        if (pg.act(G, s, { t: 'flip', i: 999 }) || pg.act(G, s, { t: 'dance' }) || pg.act(G, s, { t: 'flip', i: '1' })) fail('nonsense accepted');
        const mv = G.mv, st = G.stage; human(G, s, T.now);
        if (G.mv === mv && G.stage === st) fail('human move refused');
      } else pg.tick(G, T.now);
    }
    if (G.ph !== 'end') fail('game did not end');
    if (G.got.some(g => g < 0) || G.left) fail('pairs left at the end');
    const total = G.sp.reduce((a, p, i) => a + (G.sp.indexOf(p) === i ? ptsOf(G.tw[i]) : 0), 0);
    if (G.score.reduce((a, b) => a + b, 0) !== total) fail('points do not add up');
    const r = pg.results(G);
    if (!r[G.win].win || r.some(x => x.place < 1 || x.place > n)) fail('results disagree');
    for (let k = 1; k < n; k++) if (G.score[G.res.order[k - 1]] < G.score[G.res.order[k]]) fail('order wrong');
    return G;
  } finally { T.done(); }
}
for (const seats of [2, 3, 4, 5, 6]) { const G = play({ seats }); console.log(`${seats} seats (${G.board}): ${G.seats[G.win].name} won ${G.score.join('-')} after ${G.mv} flips`); }
play({ seats: 4, bots: 'sharp', streak: 3, timer: 0 });
play({ seats: 3, twists: 'off', board: 'big' }, ppl(3));
play({ seats: 2 }, ppl(6)); // six people need six seats

{ // bot games end in a sensible number of flips, and sharp bots win more often than chill ones
  const T = clock();
  let flips = 0, sharpWin = 0, chillWin = 0; const N2 = 300;
  for (let g = 0; g < N2; g++) {
    const G = pg.create([], { seats: 2, board: 'mid' }); G.lvl = ['chill', 'sharp']; T.add(5000); pg.tick(G, T.now);
    for (let i = 0; i < 20000 && G.ph === 'play'; i++) {
      T.add(300);
      if ((G.stage === 'pick' || G.stage === 'spy') && G.turn >= 0) pg._bot(G, G.turn, T.now, G.turn % 2 ? 'sharp' : 'chill'); else pg.tick(G, T.now);
    }
    if (G.ph !== 'end') fail('bot game did not end');
    flips += G.mv; if (G.res.place[1] === 1 && G.res.place[0] !== 1) sharpWin++; if (G.res.place[0] === 1 && G.res.place[1] !== 1) chillWin++;
  }
  T.done();
  console.log(`bots: ${(flips / N2).toFixed(0)} flips a game on Medium, sharp won ${sharpWin}/${N2}, chill ${chillWin}`);
  if (flips / N2 > 140) fail('bot games drag on');
  if (sharpWin < N2 * .6) fail('sharp bots are not better than chill ones');
}
{ // a player who leaves is played by a bot
  const T = clock(); const G = pg.create(ppl(2), { seats: 2, timer: 10 }); ready(G, T);
  pg.setAway(G, 0, true); pg.setAway(G, 1, true);
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { T.add(300); pg.tick(G, T.now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  T.done();
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
send({ t: 'create', game: 'pairs', opts: { seats: 6, timer: 15, dice: 3 } });
await wait(300);
if (room?.game !== 'pairs' || room.opts.seats !== 6 || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, bots: 'sharp', board: 'small', streak: 3 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.bots !== 'sharp' || room.opts.board !== 'small' || room.opts.streak !== 3 || room.opts.timer !== 15) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'pairs' || state.seats.length !== 2 || state.face.length !== 20) bail('game did not start');
const seen = {};
let turns = 0;
for (let i = 0; i < 6000 && state.ph === 'play'; i++) {
  state.face.forEach((f, k) => { if (f) seen[k] = f[0]; });
  if (state.turn === state.me && (state.stage === 'pick' || state.stage === 'spy')) {
    const mv = state.mv, stage = state.stage, free = state.face.map((f, k) => k).filter(k => state.got[k] < 0 && !state.up.includes(k));
    let i2 = free[0];
    if (stage === 'pick' && state.up.length === 1) { const want = state.face[state.up[0]][0]; i2 = free.find(k => seen[k] === want) ?? free.find(k => seen[k] === undefined) ?? free[0]; }
    send({ t: 'act', a: { t: stage === 'spy' ? 'peek' : 'flip', i: i2 } }); turns++;
    for (let k = 0; k < 40 && state.mv === mv && state.stage === stage && state.ph === 'play'; k++) await wait(25);
  } else await wait(40);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins !== (me.gain.place === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', turns, 'flips,', state.res.place[state.me] === 1 ? 'won' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

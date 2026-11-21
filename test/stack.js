// Tower Stack test: checks the stacking rules, plays whole games on a fake clock, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as ts from '../server/games/stack.js';
import { check, drop, makeSwing, swingPos, period, PERFECT, PTS, MAX_LEVEL, KINDS, AMP } from '../public/games/stack/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const blk = (x, z, y = 0) => ({ x, z, y, ...KINDS.block });

// ----- rules -----
if (check([]).fail !== -1 || check([blk(0, 0)]).fail !== -1 || check([blk(0, 0)]).steady !== 1) fail('a straight block should stand');
if (check([blk(0, 0), blk(1.3, 0)]).fail !== 1) fail('a block hanging more than half over should tip');
if (check([blk(0, 0), blk(1, 0), blk(2, 0)]).fail !== 1) fail('a staircase should bring the tower down from the second block');
if (check([blk(0, 0), blk(.5, 0), blk(0, 0)]).fail !== -1) fail('a balanced zigzag should stand');
if (check([blk(0, 0), blk(0, 2.5)]).fail < 0) fail('a block with nothing under it should fall');
{ // swing: starts at one end, stays in range, speeds up with height
  const sw = makeSwing([], 'block', 0);
  if (sw.axis !== 'x' || makeSwing([blk(0, 0)], 'block', 0).axis !== 'z') fail('swing axis should alternate');
  if (Math.abs(swingPos(sw, 0) + AMP) > 1e-9 || Math.abs(swingPos(sw, sw.P / 2) - AMP) > 1e-9 || Math.abs(swingPos(sw, sw.P / 4)) > 1e-9) fail('swing wave wrong');
  for (let t = 0; t < 9000; t += 37) if (Math.abs(swingPos(sw, t)) > AMP + 1e-9) fail('swing left its range');
  if (!(period(20) < period(0)) || period(200) < 500) fail('swing should speed up, within reason');
  // dropped in the middle: perfect and snapped; a touch off: ok; far off: miss
  const mid = drop([], sw, sw.P / 4 + 8);
  if (mid.res !== 'perfect' || mid.b.x !== 0) fail('a centred drop should be perfect and snap to the middle');
  const off = sw.P / 4 * (1 + (PERFECT + .2) / AMP), ok = drop([], sw, off);
  if (ok.res !== 'ok' || Math.abs(ok.b.x - (PERFECT + .2)) > 1e-6) fail('a slightly off drop should stay where it fell');
  if (drop([], sw, 0).res !== 'miss') fail('a drop at the end of the swing should miss');
  const slip = drop([blk(0, 0)], { ...makeSwing([blk(0, 0)], 'block', 1) }, sw.P / 4 * (1 + 1.5 / AMP));
  if (slip.res !== 'slip') fail('a block hanging off the top should slip, got ' + slip.res);
}

// ----- whole games -----
function play(opts, humanMs) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const G = ts.create(players, opts);
    if (G.seats.length !== (opts.seats || 4)) fail('seats not filled with bots');
    const other = (G.turn + 1) % G.seats.length;
    if (G.seats[other].human && ts.act(G, other, { t: 'drop', ms: 100 })) fail('dropped out of turn');
    let sum = 0, crashes = 0;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 100;
      const s = G.turn;
      if (G.stage === 'aim' && G.seats[s].human && !G.seats[s].bot && now - G.aimAt > 700) {
        const before = G.tower.length, pts = G.pts[s];
        now = G.aimAt + Math.max(now - G.aimAt, humanMs(G));
        if (!ts.act(G, s, { t: 'drop', ms: humanMs(G) })) fail('drop refused');
        if (ts.act(G, s, { t: 'drop', ms: 0 })) fail('dropped twice');
        const d = G.drop;
        if (G.pts[s] - pts !== PTS[d.res] + (d.top ? PTS.top : 0)) fail('points do not match the drop');
        if ((d.res === 'ok' || d.res === 'perfect' || d.res === 'crash') !== (G.tower.length === before + 1)) fail('tower length wrong after ' + d.res);
      } else ts.tick(G, now);
      if (G.stage === 'drop' && G.drop.res !== 'crash' && check(G.tower).fail !== -1) fail('an unstable tower was left standing');
      if (G.tower.length > MAX_LEVEL) fail('tower grew past the cap');
    }
    if (G.ph !== 'end') fail('game did not end');
    if (G.done !== G.opts.towers) fail('wrong number of towers');
    const r = ts.results(G);
    if (new Set(G.res.order).size !== G.seats.length || G.res.order[0] !== G.win) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1) fail('results disagree');
    if (r.some(x => x.pts < 0)) fail('negative points in results');
    for (const i of G.res.order) if (G.pts[i] > G.pts[G.win]) fail('winner does not have the most points');
    JSON.stringify(ts.view(G, -1));
    return G;
  } finally { Date.now = realNow; }
}
const centre = G => G.swing.P / 4 + G.swing.P * Math.ceil((1000 - G.swing.P / 4) / G.swing.P); // the middle of the swing, a second in
const a = play({}, centre);
if (a.st[0].perfect < 3 || a.st[0].slips || a.st[1].slips) fail('perfectly timed drops should be perfect');
console.log('classic: winner', a.seats[a.win].name, 'with', a.pts[a.win], 'pts, tallest', a.best);
const m = play({ blocks: 'mixed', seats: 6, towers: 5, bots: 'sharp' }, G => 900 + Math.random() * 2000);
if (!m.seats.some(s => s.bot)) fail('no bots at a six seat table');
console.log('mixed: winner', m.seats[m.win].name, 'with', m.pts[m.win], 'pts, tallest', m.best);
play({ seats: 2, towers: 1, timer: 0 }, G => 800 + Math.random() * 3000);
{ // a full tower ends with a bonus for everyone and counts as a tower done
  const G = ts.create(players, { seats: 2, towers: 1 });
  for (let i = 0; i < MAX_LEVEL - 1; i++) G.tower.push({ ...blk(0, 0, i * .6 + .3), s: 0, kind: 'block' });
  const now = Date.now(), s = G.turn, before = [...G.pts];
  G.swing = { ...makeSwing(G.tower, 'block', 0), n: 99 };
  ts._drop(G, s, G.swing.P / 4, now);
  if (!G.drop.top || G.pts[1 - s] - before[1 - s] !== PTS.top || G.pts[s] - before[s] !== PTS.top + PTS.perfect) fail('finishing a tower should pay everyone');
  ts.tick(G, now + 60000);
  if (G.ph !== 'end') fail('game should end after its only tower');
}
{ // the turn timer drops the block for you; a player who leaves is played by a bot; a watcher takes a bot's seat next round
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = ts.create(players, { seats: 4, timer: 10 });
  while (!G.seats[G.turn].human) { now += 100; ts.tick(G, now); }
  const n = G.dropN; now += 10100; ts.tick(G, now);
  if (G.dropN !== n + 1) fail('timer did not drop the block');
  ts.seatWatcher(G, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] });
  ts.setAway(G, 0, true);
  const r0 = G.round;
  for (let i = 0; i < 3000 && G.round === r0 && G.ph === 'play'; i++) { now += 100; ts.tick(G, now); }
  if (G.ph === 'play' && !G.seats.some(s => s.id === 'c' && s.human)) fail('watcher was not seated at the new round');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 20080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'stack', opts: { seats: 6, towers: 5, blocks: 'mixed', timer: 20, size: 'short' } });
await wait(300);
if (room?.game !== 'stack' || room.opts.seats !== 6 || room.opts.blocks !== 'mixed' || 'size' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, towers: 1, blocks: 'classic' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.towers !== 1 || room.opts.timer !== 20) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'stack' || state.seats.length !== 2 || !state.swing) bail('game did not start');
for (let i = 0; i < 40 && !(state.stage === 'aim' && state.turn === state.me); i++) await wait(250);
if (state.turn !== state.me) bail('never got a turn');
const n = state.drop?.n || 0;
send({ t: 'act', a: { t: 'drop', ms: state.swing.P / 4 } }); await wait(300);
if (state.drop?.n !== n + 1 || state.drop.s !== state.me) bail('drop did not happen');
// play it out: on every turn of mine pick the worst drop there is (a crash if one is on offer), so the tower soon comes down
let got = 0;
for (let i = 0; i < 900 && state.ph === 'play'; i++) {
  if (state.stage === 'aim' && state.turn === state.me && state.swing.n !== got) {
    const sw = state.swing, t0 = Date.now() - sw.ago; got = sw.n;
    let best = 300, bs = Infinity;
    for (let ms = 300; ms < 300 + sw.P; ms += 10) { const r = drop(state.tower, sw, ms), sc = r.res === 'crash' ? -1 : r.res === 'ok' ? r.steady : 2; if (sc < bs) { bs = sc; best = ms; } }
    await wait(Math.max(0, t0 + best - Date.now() + 20));
    send({ t: 'act', a: { t: 'drop', ms: best } });
  }
  await wait(100);
}
if (state.ph !== 'end') bail('game over the server did not end');
await wait(300);
if (!me?.gain || !room.board?.length || room.played !== 1) bail('finished game was not scored');
console.log('OK');
srv.kill(); process.exit(0);

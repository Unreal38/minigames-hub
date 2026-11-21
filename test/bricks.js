// Sky Bricks test: checks the shared rules (bricks, turning, rows, stone lines), plays whole games on a fake clock
// with a "browser" that mirrors the server the way the real one does, measures the bots, then plays over the real server.
import { spawn as launch } from 'node:child_process';
import * as sb from '../server/games/bricks.js';
import * as R from '../public/games/bricks/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- the rules -----
if (R.KINDS !== 9 || R.ROT.some(k => k.length !== 4)) fail('brick set wrong');
R.SHAPES.forEach((s, k) => {
  for (let r = 0; r < 4; r++) { if (R.ROT[k][r].length !== s.c.length) fail('turning lost a block'); for (const [x, y] of R.ROT[k][r]) if (x < 0 || y < 0 || x >= s.n || y >= s.n) fail('turn left the box'); }
  const again = R.ROT[k][3].map(([x, y]) => [y, s.n - 1 - x]).map(String).sort().join(), first = s.c.map(String).sort().join();
  if (again !== first) fail('four turns do not come back round');
  const p = R.spawn(k); if (!R.fits(R.newBoard(), k, 0, p.x, p.y)) fail('brick does not fit an empty well');
});
{ // every bag of nine has each brick once, and everyone gets the same order
  for (let b = 0; b < 20; b++) { const bag = new Set(); for (let i = 0; i < 9; i++) bag.add(R.pieceAt(1234, b * 9 + i)); if (bag.size !== 9) fail('bag not fair'); }
  if (R.pieceAt(77, 40) !== R.pieceAt(77, 40) || [...Array(30)].every((_, i) => R.pieceAt(1, i) === R.pieceAt(2, i))) fail('order not seeded');
}
{ // a full row vanishes; two rows send one stone line; a floating brick is refused
  const st = R.newState(5); st.cur = 0; // plank
  for (let y = 0; y < 2; y++) for (let x = 0; x < R.W; x++) if (x < 5) st.b[y][x] = 3;
  if (R.lock(st, 0, 5, 5, 0)) fail('floating brick accepted');
  if (R.lock(st, 0, 7, -2, 0) || R.lock(st, 0, 1.5, 0, 0) || R.lock(st, 9, 5, -2, 0)) fail('nonsense accepted');
  let res = R.lock(st, 0, 5, -2, 0); // flat on the floor, cols 5..8
  if (!res || res.rows.join() !== '0' || res.out !== 0 || st.lines !== 1) fail('row not cleared: ' + JSON.stringify(res));
  if (st.b[0].filter(v => v).length !== 5 || st.b[1].some(v => v)) fail('rows did not fall');
  // two rows at once
  const s2 = R.newState(5); s2.cur = 2; // crate
  for (let y = 0; y < 2; y++) for (let x = 0; x < R.W - 2; x++) s2.b[y][x] = 4;
  res = R.lock(s2, 0, R.W - 2, 0, 0);
  if (!res || res.rows.length !== 2 || res.out !== 1 + 4 /* and the well is empty: a clean sweep */) fail('double did not send: ' + JSON.stringify(res));
  // stone lines rise when nothing was cleared, and clears knock them back
  const s3 = R.newState(5); s3.cur = 2; s3.pend = [{ id: 1, hole: 3 }, { id: 2, hole: 3 }, { id: 3, hole: 0 }];
  res = R.lock(s3, 0, 0, 0, 2);
  if (res.took !== 2 || s3.pend.length !== 1 || s3.b[0][3] !== 0 || s3.b[0][0] !== R.STONE || s3.b[2][0] !== 3) fail('stone lines did not rise');
  const s4 = R.newState(5); s4.cur = 2; s4.pend = [{ id: 1, hole: 3 }, { id: 2, hole: 1 }];
  for (let y = 0; y < 2; y++) for (let x = 0; x < R.W - 2; x++) s4.b[y][x] = 4;
  s4.b[2][0] = 4; // so it is no clean sweep
  res = R.lock(s4, 0, R.W - 2, 0, 2);
  if (res.out !== 0 || res.took !== 0 || s4.pend.length !== 1 || s4.pend[0].id !== 2) fail('clear did not knock a stone line back');
  if (R.encode(R.decode(R.encode(s3.b))) !== R.encode(s3.b)) fail('board does not survive the wire');
}
{ // set aside: once per brick
  const st = R.newState(9), a = st.cur;
  if (!R.doHold(st) || st.hold !== a || R.doHold(st)) fail('hold wrong');
  const m = sb.bestMove(st); R.lock(st, m.r, m.x, m.y, 0);
  const c = st.cur; if (!R.doHold(st) || st.cur !== a || st.hold !== c) fail('hold swap wrong');
}
if (!(R.fallMs('fast', 0) < R.fallMs('normal', 0) && R.fallMs('normal', 200000) < R.fallMs('normal', 0) && R.fallMs('fast', 9e6) >= 70)) fail('speed curve wrong');

// ----- whole games: a "browser" keeps its own well and reports each brick, exactly like client.js -----
function play(opts, { slip = 0, every = 900, cheat = null } = {}) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = sb.create(players, opts), n = G.seats.length;
    if (n !== (opts.seats || 4)) fail('seats not filled with bots');
    const mine = [0, 1].map(() => ({ st: null, sync: -1, last: 0 }));
    let resyncs = 0, cheated = false;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 50; sb.fast(G, now);
      for (const s of [0, 1]) {
        if (G.ph !== 'play') break;
        const v = sb.view(G, s), C = mine[s], m = v.mine;
        if (v.b.length !== n || v.x.length !== n) fail('view wrong');
        if (!C.st || m.sync !== C.sync) { if (C.st) resyncs++; C.st = { b: R.decode(v.b[s]), seed: v.seed, nx: m.nx, cur: m.cur, hold: m.hold, can: m.can, pend: m.pend.map(([id, hole]) => ({ id, hole })), locks: m.locks, combo: m.combo, lines: m.lines, sent: m.sent, dead: m.dead }; C.sync = m.sync; }
        else if (m.locks === C.st.locks) { C.st.pend = m.pend.map(([id, hole]) => ({ id, hole })); if (R.encode(C.st.b) !== v.b[s]) fail('browser and server wells differ'); if (m.cur !== C.st.cur || m.nx !== C.st.nx) fail('browser and server bricks differ'); }
        if (v.stage !== 'go' || C.st.dead || now - C.last < every) continue;
        C.last = now;
        if (cheat && s === 0 && !cheated && C.st.locks > 3) { cheated = true; cheat(G, C, v); continue; }
        if (s === 1 && C.st.can && C.st.locks % 7 === 3) { R.doHold(C.st); sb.act(G, s, { t: 'h', y0: C.sync }); if (C.st.dead) continue; }
        const mv = sb.bestMove(C.st, slip); if (!mv) continue;
        const g = Math.min(C.st.pend.length, R.MAXG);
        R.lock(C.st, mv.r, mv.x, mv.y, g);
        sb.act(G, s, { t: 'l', y0: C.sync, n: C.st.locks, r: mv.r, x: mv.x, y: mv.y, g });
      }
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = sb.results(G), places = G.x.map(x => x.place).sort((a, b) => a - b);
    if (places.join() !== G.seats.map((_, i) => i + 1).join()) fail('places wrong: ' + places);
    if (G.res.order[0] !== G.win || !r[G.win].win || r.filter(x => x.win).length !== 1 || r.some((x, i) => x.place !== G.x[i].place)) fail('results disagree');
    if (G.st.filter(s => !s.dead).length > 1 && G.seats.some((s, i) => s.human && !s.bot && !G.st[i].dead && G.x[i].place !== 1)) fail('a player still in did not win');
    return { G, resyncs };
  } finally { Date.now = realNow; }
}
const a = play({});
if (a.resyncs) fail('an honest browser fell out of step ' + a.resyncs + ' times');
console.log('default table: winner', a.G.seats[a.G.win].name, 'after', (a.G.res.ms / 1000).toFixed(0) + 's, lines', a.G.res.lines.join('/'), 'sent', a.G.res.sent.join('/'));
const b = play({ seats: 6, speed: 'fast', bots: 'sharp' }, { slip: .1, every: 600 });
if (b.resyncs) fail('fell out of step at a full table');
console.log('six seats, fast, sharp bots: winner', b.G.seats[b.G.win].name, 'after', (b.G.res.ms / 1000).toFixed(0) + 's');
const c = play({ seats: 2, speed: 'chill' }, { every: 1500 });
if (c.resyncs) fail('fell out of step in a duel');
if (c.G.res.ms > 15 * 60000) fail('a duel dragged on');
// cheats and hiccups are refused and the browser is put back in step
for (const cheat of [
  (G, C) => sb.act(G, 0, { t: 'l', y0: C.sync, n: C.st.locks + 1, r: 0, x: 3, y: 12, g: 0 }),                       // a brick hanging in the air
  (G, C) => sb.act(G, 0, { t: 'l', y0: C.sync, n: C.st.locks + 5, r: 0, x: 3, y: 0, g: 0 }),                        // skipping bricks
  (G, C) => { G.st[0].pend.push({ id: 99, hole: 1, at: 0 }); const m = sb.bestMove(G.st[0]); if (sb.wouldClear?.(G.st[0], m)) return; sb.act(G, 0, { t: 'l', y0: C.sync, n: C.st.locks + 1, r: m.r, x: m.x, y: m.y, g: 0 }); }, // ducking an old stone line
  (G, C) => sb.act(G, 0, { t: 'l', y0: C.sync, n: C.st.locks + 1, r: 'x', x: null, y: {}, g: -3 }),                 // nonsense
]) { const r = play({ seats: 3 }, { cheat }); if (r.resyncs < 1) fail('a bad move was not put right'); }
{ // stale messages from before a resync are dropped quietly
  const G = sb.create(players, { seats: 2 }); const realNow = Date.now; let now = realNow() + 5000; Date.now = () => now; sb.fast(G, now);
  const before = G.x[0].sync; sb.act(G, 0, { t: 'l', y0: before - 1, n: 1, r: 0, x: 3, y: 0, g: 0 }); sb.act(G, 0, { t: 'h', y0: 99 });
  if (G.x[0].sync !== before || G.st[0].locks || G.st[0].hold >= 0) fail('stale message acted on');
  // a frozen tab: the brick is dropped for them in the end, and a player who leaves is stacked for by a bot
  now += 60000; sb.fast(G, now); if (!G.st[0].locks || G.x[0].sync === before) fail('frozen player was not moved along');
  sb.setAway(G, 1, true); const l = G.st[1].locks; for (let i = 0; i < 100; i++) { now += 100; sb.fast(G, now); }
  if (G.ph === 'play' && G.st[1].locks <= l) fail('no bot for the player who left');
  Date.now = realNow;
}
{ // bots: sharp beats chill, nobody tops out at once, games end
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let sharp = 0, ms = 0, first = 0; const N = 40;
  for (let g = 0; g < N; g++) {
    const G = sb.create([{ id: 'w', name: 'W', color: '#fff000', av: [] }], { seats: 4 });
    G.st[0].dead = true; // the person is out at once; the test then lets the bots play on
    let firstOut = 0;
    for (let i = 0; i < 400000; i++) {
      now += 50;
      for (let s = 1; s < 4; s++) if (!G.st[s].dead && now >= G.x[s].botAt && now > G.goAt) {
        const lvl = sb.BOT[s === 1 ? 'sharp' : 'chill'], m = sb.bestMove(G.st[s], lvl.slip), res = m && R.lock(G.st[s], m.r, m.x, m.y, R.MAXG);
        if (!res) { G.st[s].dead = true; continue; }
        sb._settle(G, s, res, now); G.x[s].botAt = now + Math.max(lvl.min, lvl.ms * .965 ** (R.levelAt(now - G.goAt) - 1));
      }
      const left = [1, 2, 3].filter(s => !G.st[s].dead);
      if (left.length < 3 && !firstOut) firstOut = now - G.goAt;
      if (left.length <= 1) { if (left[0] === 1) sharp++; ms += now - G.goAt; first += firstOut; break; }
    }
  }
  Date.now = realNow;
  console.log(`bots: sharp outlasted two chill ones ${sharp}/${N}; games ${(ms / N / 1000).toFixed(0)}s on average, first knock-out at ${(first / N / 1000).toFixed(0)}s`);
  if (sharp < N * .5) fail('sharp bots are not better than chill ones');
  if (first / N < 30000) fail('bots top out too soon');
}

// ----- over the real server -----
const PORT = 23080 + (Math.random() * 900 | 0);
const srv = launch('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'bricks', opts: { seats: 6, speed: 'fast', bots: 'sharp', laps: 3 } });
await wait(300);
if (room?.game !== 'bricks' || room.opts.seats !== 6 || room.opts.speed !== 'fast' || 'laps' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.speed !== 'fast') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'bricks' || state.seats.length !== 2 || state.stage !== 'count' || !state.mine) bail('game did not start');
// stack every brick in the same column until the well is full: a quick way to lose
let st = null, sync = -1, sent = 0;
for (let i = 0; i < 1200 && state.ph === 'play'; i++) {
  const m = state.mine;
  if (!st || m.sync !== sync) { st = { b: R.decode(state.b[state.me]), seed: state.seed, nx: m.nx, cur: m.cur, hold: m.hold, can: m.can, pend: m.pend.map(([id, hole]) => ({ id, hole })), locks: m.locks, combo: 0, lines: 0, sent: 0, dead: m.dead }; sync = m.sync; }
  else if (m.locks === st.locks) st.pend = m.pend.map(([id, hole]) => ({ id, hole }));
  if (state.stage === 'go' && !st.dead) {
    const p = R.spawn(st.cur), y = R.dropY(st.b, p), g = Math.min(st.pend.length, R.MAXG);
    R.lock(st, p.r, p.x, y, g); send({ t: 'act', a: { t: 'l', y0: sync, n: st.locks, r: p.r, x: p.x, y, g } }); sent++;
  }
  await wait(120);
}
if (state.ph !== 'end') bail('game over the server did not finish');
if (state.mine.sync !== 0) bail('server and test fell out of step');
if (state.win === state.me || state.x[state.me][4] !== 2) bail('stacking one column should lose');
await wait(300);
if (!me?.gain || me.gain.coins !== 1) bail('coins not paid by place: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', sent, 'bricks set down, placed', state.x[state.me][4], '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

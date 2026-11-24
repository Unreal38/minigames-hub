// Sky Pool test: the table physics (same roll every time, nothing leaves the table), the 8-ball rules, whole matches
// played by bots on a fake clock, the shot timer, and one break shot over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as pool from '../server/games/pool.js';
import { N, R, HX, HZ, HEAD_X, FOOT_X, POCKETS, rack, simulate, judge, placeOk, freeSpot, aimCast, legalFirst, kindOf, leftOf, sideOf, dirOf } from '../public/games/pool/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2, 2, 2, 2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3, 3, 3, 3] }];
const empty = () => ({ x: new Array(N).fill(0), z: new Array(N).fill(0), on: new Array(N).fill(false) });
const put = (B, b, x, z) => { B.x[b] = x; B.z[b] = z; B.on[b] = true; return B; };

// ----- the rack -----
for (let i = 0; i < 50; i++) {
  const B = rack();
  if (B.on.some(o => !o) || B.x[0] !== HEAD_X || B.z[0] !== 0) fail('rack: every ball on the table, cue ball on the head spot');
  for (let a = 1; a < N; a++) for (let b = a + 1; b < N; b++) if (Math.hypot(B.x[a] - B.x[b], B.z[a] - B.z[b]) < 2 * R) fail('rack: balls overlap');
  const row = d => [...Array(N).keys()].filter(b => b && Math.abs(B.x[b] - (FOOT_X + d * (2 * R + .004) * .8660254)) < .01);
  if (row(0).length !== 1 || row(4).length !== 5 || row(2).sort((a, b) => B.z[a] - B.z[b])[1] !== 8) fail('rack: triangle with the black in the middle');
  const back = row(4).sort((a, b) => B.z[a] - B.z[b]); if (kindOf(back[0]) === kindOf(back[4])) fail('rack: the back corners must be one of each kind');
}

// ----- physics -----
{
  const B = rack(), a = simulate(B, 1000000, 12345, 1000), b = simulate(B, 1000000, 12345, 1000, true);
  if (JSON.stringify([a.x, a.z, a.on, a.pots, a.first]) !== JSON.stringify([b.x, b.z, b.on, b.pots, b.first])) fail('the same shot must roll the same way twice');
  if (b.nf < 100 || b.frames.length < b.nf * N * 2 || a.frames) fail('frames are kept only when asked for');
  if (B.x[0] !== HEAD_X || !B.on.every(Boolean)) fail('simulate must not change the balls it was given');
  if (a.first < 1 || a.ms < 1500 || a.ms > 12000) fail(`a break should scatter the rack (first ${a.first}, ${a.ms} ms)`);
  for (let i = 0; i < 300; i++) { // nothing ever leaves the cloth or ends up inside another ball
    const Bk = rack(); Bk.z[0] = (Math.random() - .5) * 2;
    let r = simulate(Bk, Math.round(Math.cos(i) * 1e6) || 1, Math.round(Math.sin(i) * 1e6), 300 + (i * 37) % 700);
    for (let k = 0; k < 3; k++) {
      for (let p = 0; p < N; p++) {
        if (!r.on[p]) continue;
        if (Math.abs(r.x[p]) > HX - R + 1e-3 || Math.abs(r.z[p]) > HZ - R + 1e-3 || !Number.isFinite(r.x[p] + r.z[p])) fail('a ball left the table');
        for (let q = p + 1; q < N; q++) if (r.on[q] && Math.hypot(r.x[p] - r.x[q], r.z[p] - r.z[q]) < 2 * R - .003) fail('two balls ended inside each other');
      }
      if (r.pots.some(p => r.on[p.b])) fail('a potted ball is still on the table');
      if (!r.on[0]) break;
      r = simulate(r, Math.round(Math.cos(i * 7 + k) * 1e6) || 1, Math.round(Math.sin(i * 7 + k) * 1e6), 900);
    }
  }
  // a straight shot into a corner pocket, and a full-ball hit stops the cue ball about where it struck
  const C = put(put(empty(), 0, 0, 0), 3, 2, 1), u = dirOf(POCKETS[5].ax - 2, POCKETS[5].az - 1);
  const gx = 2 - u.dx * 2 * R, gz = 1 - u.dz * 2 * R, s = simulate(C, Math.round(gx * 1e6), Math.round(gz * 1e6), 420);
  if (s.first !== 3 || !s.pots.some(p => p.b === 3 && p.p === 5) || !s.on[0]) fail('a straight pot into the corner should go in');
  const D = put(put(empty(), 0, -2, 0), 5, 0, 0), t = simulate(D, 1000000, 0, 300);
  if (t.first !== 5 || t.x[5] < 1 || Math.abs(t.x[0] + .3) > .35 || Math.abs(t.z[5]) > 1e-6) fail('a full hit passes the speed on and stays on line');
  const hit = aimCast(D, 1, 0); if (hit.b !== 5 || Math.abs(hit.t - (2 - 2 * R)) > 1e-9 || Math.abs(hit.nx - 1) > 1e-9) fail('aim line: first ball');
  const wall = aimCast(D, 0, 1); if (wall.b !== -1 || Math.abs(wall.gz - (HZ - R)) > 1e-9 || wall.nz !== -1) fail('aim line: cushion');
}

// ----- the rules -----
{
  const on = new Array(N).fill(true), st = (group, side, brk = false, o = on) => ({ group, side, brk, on: o });
  const sim = (first, pots) => ({ first, pots: pots.map(b => ({ b, p: 0, t: 1 })) });
  let J = judge(st([null, null], 0, true), sim(3, [3, 12]));
  if (J.foul || J.took || !J.keep || J.group[0] !== null) fail('break: potting keeps the turn and the table stays open');
  J = judge(st([null, null], 1, true), sim(8, [8]));
  if (J.win !== -1 || !J.respot8 || J.foul) fail('break: the black goes back on its spot');
  J = judge(st([null, null], 1), sim(12, [12, 3]));
  if (J.took !== 't' || J.group.join() !== 's,t' || !J.keep || J.foul) fail('open table: the first ball potted decides the sides');
  if (judge(st([null, null], 0), sim(8, [])).foul !== 'wrong') fail('open table: the black may not be hit first');
  if (judge(st(['s', 't'], 0), sim(-1, [])).foul !== 'miss' || judge(st(['s', 't'], 0), sim(9, [2])).foul !== 'wrong') fail('fouls: nothing hit, wrong ball first');
  J = judge(st(['s', 't'], 0), sim(2, [2, 0]));
  if (J.foul !== 'scratch' || J.keep || J.win !== -1) fail('the white going in is a foul and ends the turn');
  J = judge(st(['s', 't'], 0), sim(2, [11]));
  if (J.foul || J.keep || J.own !== 0) fail('potting only their ball ends the turn');
  J = judge(st(['s', 't'], 0), sim(2, [2, 8]));
  if (J.win !== 1 || J.why !== 'early') fail('the black too early loses the rack');
  const last = on.slice(); for (let b = 1; b < 8; b++) last[b] = false;
  J = judge(st(['s', 't'], 0, false, last), sim(8, [8]));
  if (J.win !== 0 || J.why !== 'eight') fail('the black after all seven wins the rack');
  J = judge(st(['s', 't'], 0, false, last), sim(8, [8, 0]));
  if (J.win !== 1 || J.why !== 'foul8') fail('the black with a foul loses the rack');
  if (judge(st(['s', 't'], 0, false, last), sim(10, [])).foul !== 'wrong' || !legalFirst(['s', 't'], 0, last, 8) || legalFirst(['s', 't'], 0, on, 8) || !legalFirst(['s', 't'], 1, on, 9)) fail('which ball may be hit first');
  if (leftOf(last, 's') !== 0 || leftOf(last, 't') !== 7 || sideOf(2) !== 0 || sideOf(3) !== 1) fail('counting balls and sides');
  const B = rack();
  if (placeOk(B, HX, 0) || placeOk(B, 0, 0, true) || !placeOk(B, HEAD_X - 1, .5, true) || placeOk(B, B.x[8] + .1, B.z[8]) || placeOk(B, NaN, 0)) fail('where the cue ball may be put down');
  const fs = freeSpot(B, FOOT_X); if (!placeOk(B, fs, 0)) fail('a free spot must be free');
}

// ----- options -----
for (const [o, want] of [[{}, '2/1/chill/30'], [{ seats: 4, to: 2, bots: 'sharp', timer: 0 }, '4/2/sharp/0'], [{ seats: 3, to: 9, bots: 'x', timer: 7 }, '2/1/chill/30'], [{ seats: '4', to: '2', timer: '45' }, '4/2/chill/45']]) {
  const c = pool.cleanOpts(o); if ([c.seats, c.to, c.bots, c.timer].join('/') !== want || Object.keys(c).length !== 4) fail('options not cleaned: ' + JSON.stringify(c));
}

// ----- whole matches on a fake clock -----
const realNow = Date.now; let now = 1e12; Date.now = () => now;
function run(G, max = 400000) { for (let i = 0; i < max && G.ph === 'play'; i++) { now += 250; pool.tick(G, now); } }
for (const [people, opts] of [[[], { seats: 2, to: 1 }], [[], { seats: 4, to: 2, bots: 'sharp' }], [players.slice(0, 3), { seats: 2, to: 1, timer: 20 }]]) {
  for (let g = 0; g < 12; g++) {
    const G = pool.create(people, opts);
    if (G.seats.length !== (people.length > 2 || opts.seats === 4 ? 4 : 2)) fail('wrong number of seats');
    if (G.hand !== 'k' || !G.brk || sideOf(G.turn) !== G.breaker) fail('a rack starts with the breaker and the ball in hand behind the line');
    let shots = 0, lastTurn = G.turn, lastShot = 0;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 250; pool.tick(G, now);
      const v = pool.view(G, 0); if (v.on.length !== N || v.turn !== (G.stage === 'play' ? G.turn : -1)) fail('view wrong');
      if (G.shotN !== lastShot) { // a shot was just played
        lastShot = G.shotN; shots++;
        if (G.shot.s !== lastTurn) fail('someone shot out of turn');
        if (!v.shot.from || !v.rolling || v.hand) fail('a fresh shot is sent with its starting places');
        const again = simulate(G.shot.from, G.shot.ix, G.shot.iz, G.shot.pw);
        if (JSON.stringify([again.x, again.z, again.on]) !== JSON.stringify([G.B.x, G.B.z, G.B.on])) fail('a browser replaying the shot would see another roll');
      }
      if (!G.pend && G.stage === 'play') {
        lastTurn = G.turn;
        if (!G.B.on[0]) fail('the cue ball must be back on the table when a turn starts');
        if (G.seats.length === 4 && sideOf(G.turn) !== G.side) fail('the wrong team is at the table');
      }
    }
    if (G.ph !== 'end') fail('match did not finish');
    if (G.wins[G.win] !== G.opts.to || G.res.racks !== G.rackN || G.rackN > G.opts.to * 2 - 1) fail('wrong match score');
    const r = pool.results(G);
    if (r.length !== G.seats.length || r.filter(x => x.win).length !== G.seats.length / 2 || r.some((x, i) => x.win !== (sideOf(i) === G.win) || x.place !== (x.win ? 1 : 1 + G.seats.length / 2))) fail('results wrong');
    if (people.length && !r.slice(0, people.length).every(x => x.idle)) fail('players who only ever let the timer shoot earn nothing');
  }
}
{ // two partners take turns at the table
  const G = pool.create(players, { seats: 4 }); const seen = [new Set(), new Set()];
  for (const s of G.seats) s.bot = true;
  let visits = 0, prev = -1;
  for (let i = 0; i < 400000 && G.ph === 'play'; i++) { now += 250; pool.tick(G, now); if (!G.pend && G.stage === 'play' && G.turn !== prev) { if (prev >= 0 && sideOf(prev) === sideOf(G.turn)) fail('partners must not follow each other'); seen[sideOf(G.turn)].add(G.turn); prev = G.turn; visits++; } }
  if (visits > 6 && (seen[0].size !== 2 || seen[1].size !== 2)) fail('both partners should get to the table');
}
{ // a person's own shots, the cue ball in hand, and the timer
  const G = pool.create(players.slice(0, 2), { timer: 20 }); const s = G.turn, o = 1 - s;
  if (pool.act(G, s, { t: 'shot', ix: 1e6, iz: 0, pw: 800 })) fail('shot before the table is open');
  now += 2000; pool.tick(G, now);
  if (pool.act(G, o, { t: 'shot', ix: 1e6, iz: 0, pw: 800 }) || pool.act(G, o, { t: 'place', x: HEAD_X - 1, z: 0 })) fail('acted out of turn');
  if (pool.act(G, s, { t: 'place', x: 1, z: 0 }) || pool.act(G, s, { t: 'place', x: 'a', z: 0 }) || pool.act(G, s, { t: 'place', x: -99, z: 0 })) fail('break: the cue ball must stay behind the line');
  if (!pool.act(G, s, { t: 'place', x: HEAD_X - .5, z: .8 }) || G.B.x[0] !== HEAD_X - .5 || G.B.z[0] !== .8) fail('placing the cue ball');
  for (const a of [{ t: 'shot', ix: 0, iz: 0, pw: 500 }, { t: 'shot', ix: 1e6, iz: 0, pw: 1001 }, { t: 'shot', ix: NaN, iz: 0, pw: 5 }, { t: 'shot', ix: 1e9, iz: 0, pw: 5 }, { t: 'dance' }, null]) if (pool.act(G, s, a)) fail('nonsense accepted: ' + JSON.stringify(a));
  if (!pool.act(G, s, { t: 'shot', ix: 1e6, iz: -80000, pw: 950 }) || !G.pend) fail('shot refused');
  if (pool.act(G, s, { t: 'shot', ix: 1e6, iz: 0, pw: 500 }) || pool.act(G, s, { t: 'place', x: HEAD_X - 1, z: 0 })) fail('acted while the balls roll');
  const v = pool.view(G, s); if (v.shot.n !== 1 || v.shot.s !== s || !v.rolling || v.tLeft !== -1) fail('view of a rolling shot');
  now += v.shot.ms + pool.WIND + 600; pool.tick(G, now);
  if (G.pend || G.brk || G.turn < 0) fail('the shot was not settled');
  if (pool.view(G, s).rolling || G.st[s].shots !== 1 || G.st[s].auto) fail('shot not counted');
  // now nobody touches anything: the timer shoots, and then that seat gets shorter turns
  const t = G.turn; now = G.busy + 19000; pool.tick(G, now); if (G.pend) fail('timer fired early');
  now += 1200; pool.tick(G, now); if (!G.pend || G.st[t].auto !== 1 || !G.slow[t]) fail('the timer should have played the shot');
  run(G);
  if (G.ph !== 'end') fail('timer match did not finish');
  if (pool.results(G)[s].idle) fail('someone who shot themselves is not idle');
}
{ // a foul hands the cue ball over, to be put anywhere
  const G = pool.create(players.slice(0, 2), { timer: 0 }); const s = G.turn; now += 2000; pool.tick(G, now);
  if (!pool.act(G, s, { t: 'shot', ix: -1e6, iz: 0, pw: 200 })) fail('shot refused'); // straight at the head cushion: touches nothing
  now += 20000; pool.tick(G, now);
  if (G.turn !== 1 - s || G.hand !== 'a' || G.st[s].fouls !== 1 || !G.ev.some(e => e.t === 'res' && e.foul === 'miss')) fail('a miss is a foul with the ball in hand');
  now += 500; if (!pool.act(G, 1 - s, { t: 'place', x: 1, z: 1 })) fail('ball in hand: anywhere on the table');
  pool.setAway(G, 0, true); pool.setAway(G, 1, true); run(G);
  if (G.ph !== 'end') fail('bots did not finish for players who left');
}
{ // sharp bots pot more than chill ones
  const rate = level => { let p = 0, n = 0; for (let g = 0; g < 14; g++) { const G = pool.create([], { bots: level }); run(G); for (const x of G.st) { p += x.pots; n += x.shots; } } return p / n; };
  const c = rate('chill'), s = rate('sharp');
  if (!(s > c + .08) || c < .2 || s > .97) fail(`bot levels: chill pots ${c.toFixed(2)} a shot, sharp ${s.toFixed(2)}`);
}
Date.now = realNow;

// ----- over the real server -----
const PORT = 26980 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, what, ms = 15000) => { for (let i = 0; i < ms / 50; i++) { if (f()) return; await wait(50); } bail('timed out: ' + what); };
await wait(300);
send({ t: 'create', game: 'pool', opts: { seats: 4, to: 2, timer: 45, junk: 1 } });
await until(() => room, 'table made');
if (room.game !== 'pool' || room.opts.seats !== 4 || room.opts.to !== 2 || 'junk' in room.opts || room.max !== 4) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, to: 1 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.timer !== 45) bail('option change lost');
send({ t: 'start' }); await until(() => state, 'game started');
if (state.game !== 'pool' || state.seats.length !== 2 || state.on.length !== N || !state.seats[1 - state.me].bot) bail('game did not start');
// whoever breaks, wait for the first shot and see it arrive whole
if (state.turn === state.me) { await until(() => state.tin === 0 || state.tLeft > 0, 'table open', 4000).catch(() => {}); await wait(1800); send({ t: 'act', a: { t: 'place', x: HEAD_X - .4, z: .3 } }); await wait(150); send({ t: 'act', a: { t: 'shot', ix: 1000000, iz: -40000, pw: 1000 } }); }
await until(() => state.shot, 'first shot');
const sh = state.shot;
if (!sh.from || sh.from.x.length !== N || !state.rolling || !Number.isInteger(sh.ix) || !Number.isInteger(sh.pw)) bail('the shot did not arrive whole');
const mine = simulate(sh.from, sh.ix, sh.iz, sh.pw);
if (JSON.stringify([mine.x, mine.z, mine.on]) !== JSON.stringify([state.bx, state.bz, state.on])) bail('the replayed break ends somewhere else than the server says');
await until(() => !state.rolling && state.ev.some(e => e.t === 'res'), 'the break settled', 20000);
if (state.brk || !state.on[0] || state.turn < 0) bail('after the break the next turn should be open');
ws.close(); srv.kill();
console.log('pool ok');
process.exit(0);

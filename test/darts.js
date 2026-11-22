// Sky Darts test: checks the board and the scoring rules, plays whole games on a fake clock, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as dg from '../server/games/darts.js';
import { R, ORDER, DARTS, ROUNDS, HAND, score, spot, apply, checkout, outText, plan, wobble, wobbleR, landing } from '../public/games/darts/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- the board -----
if (score(0, 0).v !== 50 || score(0, 0).m !== 2 || score(0, .06).v !== 25 || score(0, 1.01).v !== 0) fail('bull, outer bull or miss wrong');
if (score(0, .5).lab !== '20' || score(0, .605).lab !== 'T20' || score(0, .97).lab !== 'D20') fail('the 20 bed is wrong');
if (score(.5, 0).n !== 6 || score(-.5, 0).n !== 11 || score(0, -.5).n !== 3) fail('6, 11 or 3 is in the wrong place');
for (let i = 0; i < 20; i++) for (const m of [1, 2, 3]) {
  const [x, y] = spot(ORDER[i], m), h = score(x, y);
  if (h.n !== ORDER[i] || h.m !== m || h.v !== ORDER[i] * m) fail(`spot for ${m}x${ORDER[i]} scores ${h.lab}`);
}
if (score(...spot(25, 2)).v !== 50 || score(...spot(25, 1)).v !== 25) fail('bull spots wrong');
// ----- scoring -----
const T20 = score(...spot(20, 3)), D20 = score(...spot(20, 2)), S1 = score(...spot(1, 1)), S20 = score(...spot(20, 1));
if (apply(301, T20, true).left !== 241) fail('a treble 20 should take 60 off');
if (!apply(40, T20, true).bust || !apply(21, S20, true).bust || apply(21, S20, false).left !== 1) fail('bust rules wrong');
if (!apply(40, D20, true).out || !apply(20, S20, true).bust || !apply(20, S20, false).out) fail('finishing rules wrong');
if (!apply(50, score(0, 0), true).out) fail('the bull should count as a double to finish');
if (apply(1, S1, false).left !== 0) fail('any finish should allow a single');
// ----- ways out -----
if (outText(170, 3, true) !== 'T20 T20 Bull' || outText(40, 1, true) !== 'D20' || outText(32, 3, true) !== 'D16') fail('famous checkouts wrong: ' + outText(170, 3, true));
if (checkout(169, 3, true) || checkout(159, 3, true) || checkout(1, 3, true) || checkout(99, 2, true)) fail('found a way out where there is none');
for (let rem = 2; rem <= 170; rem++) {
  const c = checkout(rem, 3, true); if (!c) continue;
  if (c.reduce((t, x) => t + x.v, 0) !== rem || c[c.length - 1].m !== 2 || c.length > 3) fail('bad way out from ' + rem);
}
for (let rem = 2; rem <= 501; rem++) for (let d = 1; d <= 3; d++) for (const dbl of [true, false]) {
  const t = plan(rem, d, dbl); if (!t || !(t.n >= 1) || ![1, 2, 3].includes(t.m)) fail('no plan from ' + rem);
}
// ----- the hand -----
if (wobbleR(-1) !== HAND.loose || Math.abs(wobbleR(HAND.settle) - HAND.steady) > 1e-9 || wobbleR(HAND.tire + 50) <= HAND.steady || wobbleR(1e6) !== HAND.tired) fail('steadying is wrong');
for (let t = 0; t < 20000; t += 53) for (const h of [-1, 300, 1200, 4000]) {
  const [dx, dy] = wobble(7.123, t, h), r = wobbleR(h);
  if (Math.abs(dx) > r + 1e-9 || Math.abs(dy) > r + 1e-9) fail('the wobble left its ring');
}
{ const [x, y] = landing(3.5, [5, -9], 1000, 900); if (Math.abs(x) > R.frame + HAND.tired || Math.abs(y) > R.frame + HAND.tired) fail('aim was not kept near the board'); }

// ----- whole games -----
// A perfect player: knows the wobble, so aims off by exactly that much.
function perfectThrow(G, target, ms = 1000, hold = 900) {
  const [x, y] = spot(target.n, target.m), [dx, dy] = wobble(G.seed, ms, hold);
  return { t: 'throw', x: x - dx, y: y - dy, ms, hold };
}
function play(opts, human) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const G = dg.create(players, opts);
    if (G.seats.length !== (opts.seats || 4)) fail('seats not filled with bots');
    const other = (G.turn + 1) % G.seats.length;
    if (G.seats[other].human && dg.act(G, other, { t: 'throw', x: 0, y: 0 })) fail('threw out of turn');
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 100;
      const s = G.turn;
      if (G.stage === 'aim' && G.seats[s].human && !G.seats[s].bot && now - G.aimAt >= 1000) {
        const before = G.rem[s], from = G.turnFrom, k = G.darts.length, legs = G.legs[s];
        const a = human(G, s); now = G.aimAt + a.ms;
        if (!dg.act(G, s, a)) fail('throw refused');
        if (dg.act(G, s, a)) fail('threw twice');
        const d = G.last;
        if (d.s !== s || d.i !== k || G.darts.length !== k + 1) fail('dart not recorded');
        if (d.bust ? G.rem[s] !== from : G.rem[s] !== before - d.v) fail('score does not match the dart');
        if (d.out !== (G.rem[s] === 0) || (d.out && G.legs[s] !== legs + 1)) fail('leg not counted');
        if (d.fin !== (d.bust || d.out || k === DARTS - 1)) fail('turn did not end when it should');
        if (human.exact && (d.num !== human.exact.n || d.m !== human.exact.m)) fail(`aimed at ${human.exact.m}x${human.exact.n}, hit ${d.lab}`);
      } else dg.tick(G, now);
      if (G.rem.some(r => r < 0 || (G.opts.out === 'double' && r === 1))) fail('an impossible score was left standing');
      if (G.round > G.rounds + 1) fail('played past the last round');
      for (let v = -1; v < G.seats.length; v++) JSON.stringify(dg.view(G, v));
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = dg.results(G), need = Math.ceil(G.opts.legs / 2);
    if (new Set(G.res.order).size !== G.seats.length || G.res.order[0] !== G.win) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || r.some(x => x.pts < 0)) fail('results disagree');
    if (G.legs[G.win] !== need || G.legs.some((l, i) => i !== G.win && l >= need)) fail('wrong legs at the end');
    if ([...r].sort((a, b) => a.place - b.place).map(x => x.place).join() !== G.seats.map((_, i) => i + 1).join()) fail('places are not 1..n');
    return G;
  } finally { Date.now = realNow; }
}
// a perfect player follows the plan and is out of 301 in six darts (T20 T20 T20, then 121)
const ace = G => { const t = plan(G.rem[G.turn], DARTS - G.darts.length, G.opts.out === 'double'); ace.exact = t; return perfectThrow(G, t); };
const a = play({ seats: 2, bots: 'sharp' }, ace);
// both seats are people here and both play perfectly, so whoever throws first wins
const ana = a.win;
if (ana !== a.legFirst || a.st[ana].darts !== 6 || a.st[ana].t180 !== 1 || a.st[ana].busts) fail(`a perfect player throwing first should win 301 in six darts, took ${a.st[ana].darts}`);
console.log('perfect 301: out in', a.st[ana].darts, 'darts');
const wild = () => ({ t: 'throw', x: (Math.random() - .5) * 2.2, y: (Math.random() - .5) * 2.2, ms: 1000 + Math.random() * 3000, hold: Math.random() < .3 ? -1 : Math.random() * 3000 });
const b = play({ seats: 6, start: 501, legs: 3, bots: 'chill' }, wild);
if (!b.seats.some(s => s.bot)) fail('no bots at a six seat table');
console.log('501 best of 3: winner', b.seats[b.win].name, 'legs', b.legs.join(' '), 'rounds in last leg', b.round);
play({ seats: 3, out: 'any', timer: 0 }, wild);
{ // all misses at a table of two humans: the round cap ends it
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = dg.create([...players], { seats: 2, timer: 0 });
  for (let i = 0; i < 200000 && G.ph === 'play'; i++) { now += 100; if (G.stage === 'aim' && now - G.aimAt >= 300) dg.act(G, G.turn, { t: 'throw', x: G.turn ? 1.3 : 0, y: G.turn ? 1.3 : spot(20, 1)[1], ms: 300, hold: 300 }); else dg.tick(G, now); }
  if (G.ph !== 'end' || G.round !== ROUNDS[301] + 1) fail('the round cap did not end the game');
  if (G.win !== 0 || G.rem[1] !== 301) fail('the lowest score should take a capped leg');
  Date.now = realNow;
}
{ // the dart timer throws for you; a player who leaves is played by a bot; a watcher takes a bot's seat at the next leg
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = dg.create(players, { seats: 4, timer: 15, legs: 3 });
  while (!(G.stage === 'aim' && G.seats[G.turn].human)) { now += 100; dg.tick(G, now); }
  const n = G.lastN; now += 15100; dg.tick(G, now);
  if (G.lastN !== n + 1 || G.last.how !== 'late') fail('timer did not throw the dart');
  dg.seatWatcher(G, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] });
  dg.setAway(G, 0, true); dg.setAway(G, 1, true);
  for (let i = 0; i < 40000 && G.leg === 1 && G.ph === 'play'; i++) { now += 100; dg.tick(G, now); }
  if (G.ph === 'play' && !G.seats.some(s => s.id === 'c' && s.human)) fail('watcher was not seated at the new leg');
  Date.now = realNow;
}
{ // bots: sharp ones need fewer darts than chill ones
  const avg = bots => { let t = 0; for (let k = 0; k < 30; k++) { const realNow = Date.now; let now = realNow(); Date.now = () => now; const G = dg.create([], { seats: 2, bots }); for (let i = 0; i < 100000 && G.ph === 'play'; i++) { now += 200; dg.tick(G, now); } Date.now = realNow; t += G.st[G.win].darts; } return t / 30; };
  const chill = avg('chill'), sharp = avg('sharp');
  console.log('darts to win 301: chill', chill.toFixed(1), 'sharp', sharp.toFixed(1));
  if (!(sharp < chill) || sharp < 7 || chill > 45) fail('bot skill is off');
}

// ----- over the real server -----
const PORT = 20080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null, stateAt = 0;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') { state = msg.s; stateAt = Date.now(); } if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'darts', opts: { seats: 6, start: 501, out: 'any', legs: 3, timer: 30, size: 'short' } });
await wait(300);
if (room?.game !== 'darts' || room.opts.seats !== 6 || room.opts.start !== 501 || 'size' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, start: 301, legs: 1, out: 'double', bots: 'sharp' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.start !== 301 || room.opts.timer !== 30 || room.opts.out !== 'double') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'darts' || state.seats.length !== 2 || state.seats[state.me].rem !== 301) bail('game did not start');
// play it out with perfect darts: six of them win 301
let got = 0, thrown = 0;
for (let i = 0; i < 1200 && state.ph === 'play'; i++) {
  if (state.stage === 'aim' && state.turn === state.me && state.dart.n !== got) {
    got = state.dart.n;
    const t0 = stateAt - state.dart.ago, rem = state.seats[state.me].rem, t = plan(rem, DARTS - state.darts.length, true);
    await wait(Math.max(0, t0 + 500 - Date.now()));
    const ms = Date.now() - t0, hold = 300, [x, y] = spot(t.n, t.m), [dx, dy] = wobble(state.dart.seed, ms, hold), n = state.last?.n || 0;
    send({ t: 'act', a: { t: 'throw', x: x - dx, y: y - dy, ms, hold } }); thrown++;
    for (let k = 0; k < 20 && (state.last?.n || 0) === n; k++) await wait(50);
    if (state.last?.n !== n + 1 || state.last.s !== state.me) bail('throw did not happen');
    if (state.last.num !== t.n || state.last.m !== t.m) bail(`aimed at ${t.m}x${t.n} but hit ${state.last.lab}`);
  }
  await wait(60);
}
if (state.ph !== 'end') bail('game over the server did not end');
if (state.win !== state.me || thrown !== 6) bail(`perfect darts should win in six, threw ${thrown}`);
await wait(300);
if (!me?.gain || !room.board?.length || room.played !== 1) bail('finished game was not scored');
if (room.paid?.[state.me] !== 10) bail('first place should be paid 10 coins');
console.log('OK');
srv.kill(); process.exit(0);

// Mini Golf Party test: checks every hole and the physics, plays whole rounds on a fake clock, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as golf from '../server/games/golf.js';
import { HOLES, buildHole, simulate, tileAt, MAX_STROKES, CAP_SCORE } from '../public/games/golf/course.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// holes: a tee and a cup, every tile can reach the cup, and no shot ever leaves the course
for (let i = 0; i < HOLES.length; i++) for (const mirror of [false, true]) {
  const H = buildHole(i, mirror);
  if (!H.tee || !H.cup) fail(`hole ${i} has no tee or cup`);
  for (const row of H.t) for (const T of row) if (T && H.dist[T.r * H.cols + T.c] > 1e8) fail(`hole ${i}: a tile cannot reach the cup`);
  for (let k = 0; k < 120; k++) {
    const r = simulate(H, H.tee.x, H.tee.z, k * .37, .3 + (k % 8) / 10, k * .7, k + 1);
    if (!Number.isFinite(r.x) || !Number.isFinite(r.z) || !tileAt(H, r.x, r.z)) fail(`hole ${i}: ball left the course`);
    if (r.path.length < 4 || r.path.length > 14 * 30 * 2 + 8 || r.ms > 15000) fail(`hole ${i}: bad path`);
    if (r.sunk && Math.hypot(r.x - H.cup.x, r.z - H.cup.z) > .01) fail('sunk ball is not in the cup');
  }
}
// random holes: always playable, with a sensible par, and not all alike
{
  const names = new Set(), used = [];
  for (let k = 0; k < 25; k++) {
    const spec = golf.makeHole(used), H = buildHole(spec);
    if (!H.tee || !H.cup || spec.par < 2 || spec.par > 5) fail('random hole is broken');
    for (const row of H.t) for (const T of row) if (T && H.dist[T.r * H.cols + T.c] > 1e8) fail('random hole: a tile cannot reach the cup');
    names.add(spec.name);
  }
  if (names.size < 25) fail('random holes repeat a name in one round');
}
// a ball going far too fast skips over the cup instead of dropping in
{
  const H = buildHole(0), r = simulate(H, H.cup.x, H.cup.z + 1.5, 0, 1, 0, 3);
  if (r.sunk && r.path.length < 30) fail('a full power putt dropped straight in');
  const slow = simulate(H, H.cup.x, H.cup.z + 1.5, 0, .2, 0, 3);
  if (!slow.sunk) fail('a gentle straight putt did not drop');
}
// the same shot always gives the same path
{
  const H = buildHole(6), a = simulate(H, H.tee.x, H.tee.z, .2, .8, 1, 5), b = simulate(H, H.tee.x, H.tee.z, .2, .8, 1, 5);
  if (JSON.stringify(a) !== JSON.stringify(b)) fail('physics is not repeatable');
}

function play(opts, wallet = { 'h:a': 100, 'h:b': 5 }) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const G = golf.create(players, opts, { wallet });
    const o = golf.cleanOpts(opts);
    if (G.seats.length !== Math.max(2, o.seats) || G.order.length !== o.holes) fail('wrong seats or holes');
    if (golf.act(G, 0, { t: 'shot', ang: 0, pow: .5 })) fail('putted before the hole opened');
    let betOn = -1, start = 100;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 150;
      if (G.stage === 'bet' && o.bets === 'on' && !G.bets[0]) {
        if (golf.act(G, 1, { t: 'bet', on: 0, amt: 10 })) fail('bet with too few coins');
        if (golf.act(G, 0, { t: 'bet', on: 9, amt: 10 }) || golf.act(G, 0, { t: 'bet', on: 1, amt: 7 })) fail('bad bet accepted');
        if (!golf.act(G, 0, { t: 'bet', on: 1, amt: 25 })) fail('bet refused');
        golf.act(G, 1, { t: 'skip' }); betOn = 1; start = G.wallet['h:a'];
      }
      if (G.stage === 'play') {
        const b = G.balls[0];
        if (G.turn !== 0 && golf.act(G, 0, { t: 'shot', ang: 0, pow: .5 })) fail('putted out of turn');
        if (G.turn === 0 && now >= G.turnFrom) { // seat 0 putts roughly at the cup, seat 1 never plays (the game putts for them)
          const H = G.H, before = b.strokes;
          if (golf.act(G, 0, { t: 'shot', ang: 99, pow: 3 }) || golf.act(G, 0, { t: 'shot', ang: 'x', pow: .5 })) fail('bad shot accepted');
          if (!golf.act(G, 0, { t: 'shot', ang: Math.atan2(H.cup.x - b.x, -(H.cup.z - b.z)) + (Math.random() - .5) * .3, pow: .25 + Math.random() * .5 })) fail('shot refused');
          if (golf.act(G, 0, { t: 'shot', ang: 0, pow: .5 })) fail('putted while the ball was rolling');
          if (G.turn >= 0 && G.turn !== 0 && G.turn !== (G.balls.findIndex((x, i) => i > 0 && !x.sunk && !x.out))) fail('turn did not pass to the next ball');
          if (b.strokes <= before || b.strokes > MAX_STROKES) fail('stroke count wrong');
          if (!tileAt(H, b.x, b.z)) fail('ball rests off the course');
        }
      }
      const was = G.stage; golf.tick(G, now);
      if (was === 'play' && G.stage === 'done') {
        const R = G.holeRes;
        if (R.scores.some(s => s < 1 || s > CAP_SCORE)) fail('bad hole scores');
        if (R.win >= 0 && R.scores[R.win] !== Math.min(...R.scores)) fail('hole winner did not have the fewest strokes');
        if (betOn >= 0) {
          const want = start - 25 + (R.win < 0 ? 25 : R.win === betOn ? 25 * G.seats.length : 0);
          if (G.wallet['h:a'] !== want) fail(`bet settled wrong: ${G.wallet['h:a']} vs ${want}`);
        }
      }
      JSON.stringify(golf.view(G, 0));
    }
    if (G.ph !== 'end') fail('round did not end');
    const r = golf.results(G);
    if (r.filter(x => x.win).length !== 1 || !r[G.win].win) fail('results disagree');
    if (G.res.totals[G.win] !== Math.min(...G.res.totals)) fail('winner does not have the fewest strokes');
    if (G.cards.some(c => c.length !== o.holes)) fail('scorecards incomplete');
    if (r[0].coinNet !== G.wallet['h:a'] - 100 || r[1].coinNet !== 0 || !r[1].idle || r[0].idle) fail('coin results wrong');
    return G;
  } finally { Date.now = realNow; }
}
const g1 = play({ holes: 3, seats: 4, bets: 'on', course: 'classic' });
const g3 = play({ holes: 3, seats: 4, bets: 'on' });
if (g3.opts.course !== 'random' || g3.order.some(o => typeof o !== 'object')) fail('default course is not random');
console.log('3 holes with bets: winner', g1.seats[g1.win].name, 'totals', g1.res.totals.join(' '));
const g2 = play({ holes: 9, seats: 6, bets: 'off', bots: 'sharp', course: 'classic' });
if (g2.wallet['h:a'] !== 100) fail('coins moved with bets off');
console.log('9 holes, sharp bots: winner', g2.seats[g2.win].name, 'totals', g2.res.totals.join(' '), 'par', g2.res.par);
// bots finish holes in a sensible number of strokes
if (g2.res.totals.slice(2).some(t => t > g2.res.par + 22)) fail('sharp bots are hopeless: ' + g2.res.totals);

// a watcher takes over a bot at the next hole and keeps its score
{
  const G = golf.create(players, { holes: 3, seats: 4 }, { wallet: {} });
  golf.seatWatcher(G, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2, 2, 2, 2] }, true);
  if (G.seats.some(s => s.id === 'c')) fail('watcher seated mid-hole');
  let now = Date.now();
  for (let i = 0; i < 4000 && G.hi === 0; i++) { now += 150; golf.tick(G, now); }
  if (G.hi !== 1 || !G.seats.some(s => s.id === 'c' && s.human && !s.bot)) fail('watcher was not seated at the next hole');
}

// over the wire
const PORT = 19080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = m => { srv.kill(); fail(m); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null;
const send = m => ws.send(JSON.stringify(m));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') room = m.room; if (m.t === 'state') state = m.s; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'golf', opts: { holes: 3, seats: 6, bets: 'on', timer: 10 } });
await wait(300);
if (room?.game !== 'golf' || room.opts.holes !== 3 || room.opts.seats !== 6 || 'timer' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.holes !== 3) bail('option change lost');
send({ t: 'start' });
for (let i = 0; i < 40 && state?.game !== 'golf'; i++) await wait(250); // a random hole takes a moment to make
if (state?.game !== 'golf' || state.seats.length !== 2 || state.stage !== 'bet' || state.holes !== 3) bail('game did not start');
send({ t: 'act', a: { t: 'skip' } });
for (let i = 0; i < 20 && state.stage !== 'play'; i++) await wait(300);
if (state.stage !== 'play') bail('hole never opened');
for (let i = 0; i < 80 && state.seats[state.me].strokes < 1; i++) { await wait(300); send({ t: 'act', a: { t: 'shot', ang: 0, pow: .5 } }); }
await wait(300);
const me = state.seats[state.me];
if (!('turn' in state) || me.strokes < 1 || !me.shot?.path?.length) bail('putt did not happen');
console.log('OK');
srv.kill(); process.exit(0);

// Burrow Bop test: checks the shared list of pop-ups and the scoring, plays whole games on a fake clock with a
// "browser" that keeps its own count the way the real one does, measures the bots, then plays over the real server.
import { spawn as launch } from 'node:child_process';
import * as bop from '../server/games/bop.js';
import * as R from '../public/games/bop/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- the rules -----
for (const pace of ['calm', 'normal', 'fast']) { // the same seed gives everyone the same pets, in the same burrows, at the same moments
  const a = R.schedule(77, pace), b = R.schedule(77, pace), c = R.schedule(78, pace);
  if (JSON.stringify(a) !== JSON.stringify(b)) fail('same seed, different pop-ups');
  if (JSON.stringify(a) === JSON.stringify(c)) fail('pop-ups are not seeded');
  const busy = new Array(R.HOLES).fill(-1);
  a.forEach((p, i) => {
    if (p.i !== i || (i && p.at < a[i - 1].at)) fail('pop-ups out of order');
    if (p.hole < 0 || p.hole >= R.HOLES || p.pet < 0 || p.pet >= R.PETS.length || p.up < 380) fail('odd pop-up ' + JSON.stringify(p));
    if (p.at < busy[p.hole] + 400) fail('two pets in one burrow');
    busy[p.hole] = p.at + p.up;
    if (i < 6 && p.kind !== R.PET) fail('the first pets must be plain ones');
    if (p.kind === R.HEART && p.at < 25000) fail('a heart too early');
  });
  if (a[a.length - 1].at > R.TOTAL || a[a.length - 1].at < R.TOTAL - 3000) fail('the list does not fill three minutes');
  const kinds = [0, 0, 0, 0]; for (const p of a) kinds[p.kind]++;
  if (kinds[R.SLEEP] < 20 || kinds[R.GOLD] < 8 || kinds[R.HEART] < 3 || kinds[R.PET] < a.length * .6) fail('odd mix of pets ' + kinds);
  const early = a.filter(p => p.at < 20000), late = a.filter(p => p.at > 150000);
  if (early.length / 20 >= late.length / 30) fail('the pets do not speed up');
}
{ // scoring and hearts
  const p = R.newPlayer(), pop = k => ({ kind: k });
  if (R.resolve(p, pop(R.PET), true).pts !== 10 || R.resolve(p, pop(R.PET), true).pts !== 12 || p.cb !== 2 || p.sc !== 22) fail('bops in a row do not add up');
  if (R.resolve(p, pop(R.GOLD), true).pts !== 54) fail('golden pet');
  if (R.resolve(p, pop(R.SLEEP), false).life || R.resolve(p, pop(R.GOLD), false).life || R.resolve(p, pop(R.HEART), false).life || p.lv !== 3 || p.cb !== 3) fail('leaving a sleeper or a bonus alone must cost nothing');
  if (R.resolve(p, pop(R.HEART), true).life || p.lv !== 3) fail('a heart with all three hearts');
  if (R.resolve(p, pop(R.PET), false).life !== -1 || p.lv !== 2 || p.cb) fail('a pet that got away costs a heart and the run');
  if (R.resolve(p, pop(R.SLEEP), true).life !== -1 || p.lv !== 1) fail('bopping a sleeper costs a heart');
  if (R.resolve(p, pop(R.HEART), true).life !== 1 || p.lv !== 2 || p.best !== 4 || p.n !== 10) fail('a heart gives one back');
  for (let i = 0; i < 30; i++) R.resolve(p, pop(R.PET), true);
  if (R.resolve(p, pop(R.PET), true).pts !== 30) fail('the run bonus is capped');
}

// ----- whole games on a fake clock: a "browser" keeps its own count and reports each bop, like client.js -----
// skill: { react: ms to bop, miss: chance to let a pet go, nap: chance to bop a sleeper, lag: ms a message takes }
function play(opts, skill, { cheat } = {}) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = bop.create(players.slice(0, opts.humans || 1), opts), P = G.pops;
  const C = { p: R.newPlayer(), res: new Uint8Array(P.length), ptr: 0, plan: [], sync: 0 }, wire = [];
  let adopts = 0, cheated = false;
  for (let i = 0; i < 60 * 240 && G.ph === 'play'; i++) {
    now += 16;
    while (wire.length && wire[0].at <= now) bop.act(G, 0, wire.shift().a);
    bop.fast(G, now);
    const v = bop.view(G, 0), t = now - G.goAt - (skill.lag || 0) / 2; // the browser's clock runs a little behind
    if (v.stage !== 'go' || C.p.lv <= 0) continue;
    for (let j = C.ptr; j < P.length && P[j].at <= t && C.p.lv > 0; j++) {
      if (C.res[j]) continue;
      const pop = P[j];
      if (C.plan[j] === undefined) C.plan[j] = pop.kind === R.SLEEP ? (Math.random() < skill.nap ? pop.at + 300 : -1) : Math.random() < skill.miss ? -1 : pop.at + skill.react * (.7 + Math.random() * .6);
      if (pop.at + pop.up <= t) { C.res[j] = 2; R.resolve(C.p, pop, false); }
      else if (C.plan[j] >= 0 && C.plan[j] <= t) { C.res[j] = 1; R.resolve(C.p, pop, true); wire.push({ at: now + (skill.lag || 0) / 2, a: { t: 'h', y0: C.sync, i: j, c: Math.round(t) } }); }
    }
    while (C.ptr < P.length && C.res[C.ptr]) C.ptr++;
    if (cheat && !cheated && t > 9000) { cheated = true; cheat(G, C, t); }
    // once the server has counted as many pop-ups as the browser, the two must agree
    const m = v.mine;
    if (m.n === C.p.n && !wire.length && (m.lv !== C.p.lv || m.sc !== C.p.sc || m.cb !== C.p.cb)) { adopts++; Object.assign(C.p, { lv: m.lv, sc: m.sc, cb: m.cb, n: m.n }); }
  }
  Date.now = realNow;
  if (G.ph !== 'end') fail('a game did not end');
  const res = bop.results(G);
  if (res.map(r => r.place).sort().join() !== G.seats.map((_, i) => i + 1).join()) fail('places are not 1..n: ' + res.map(r => r.place));
  if (res.filter(r => r.win).length !== 1 || !res[G.win].win) fail('one winner expected');
  if (G.x[0].p.sc !== C.p.sc && !cheat && !wire.length) fail(`browser and server scores differ: ${C.p.sc} vs ${G.x[0].p.sc}`);
  return { G, C, adopts, res };
}
const a = play({ seats: 4 }, { react: 420, miss: .01, nap: .02, lag: 80 });
if (a.adopts) fail('browser and server fell out of step');
console.log('default table: winner', a.G.seats[a.G.win].name, 'after', (a.G.res.ms / 1000).toFixed(0) + 's, scores', a.G.res.sc.join('/'), 'bops', a.G.res.bops.join('/'));
const b = play({ seats: 6, pace: 'fast', bots: 'sharp' }, { react: 380, miss: .02, nap: .05, lag: 200 });
if (b.adopts) fail('fell out of step at a fast table with lag');
console.log('six seats, fast, sharp bots: winner', b.G.seats[b.G.win].name, 'after', (b.G.res.ms / 1000).toFixed(0) + 's');
{ // a perfect player lasts the three minutes at a calm table and wins on score
  const c = play({ seats: 2, pace: 'calm' }, { react: 150, miss: 0, nap: 0, lag: 40 });
  if (c.G.x[0].p.lv !== 3 || c.G.win !== 0 || c.G.res.time[0] !== 0) fail('a perfect player should win with three hearts');
  if (c.G.res.ms < R.TOTAL - 5000 && c.G.x[1].p.lv > 0) fail('the game ended early with two players in');
  console.log('perfect player, calm duel:', c.G.res.sc[0], 'points,', c.G.res.bops[0], 'bops');
}
{ // somebody who does nothing is out after three pets, and is placed last
  const d = play({ seats: 4 }, { react: 99999, miss: 1, nap: 0 });
  if (d.G.x[0].p.lv > 0 || d.G.x[0].place !== 4 || d.G.x[0].p.sc !== 0) fail('doing nothing should lose ' + JSON.stringify([d.G.x[0].p, d.G.x[0].place, d.G.res]));
  if (d.G.res.time[0] > 8000) fail('three missed pets should not take this long: ' + d.G.res.time[0]);
  if (!d.G.ev.some(e => e.t === 'out' && e.s === 0)) fail('no out event');
}
{ // playing alone: the game runs until the hearts are gone
  const e = play({ seats: 1 }, { react: 500, miss: .03, nap: .05, lag: 60 });
  if (e.G.seats.length !== 1 || e.G.win !== 0 || !e.res[0].win) fail('solo game');
}
// cheats and hiccups: none of them may score
for (const cheat of [
  (G, C, t) => { const j = G.pops.findIndex(p => p.at > t + 3000); bop.act(G, 0, { t: 'h', y0: 0, i: j, c: t }); if (G.x[0].res[j]) fail('bopped a pet from the future'); },
  (G, C, t) => { const j = G.pops.findIndex((p, k) => p.at + p.up < t - 1000 && G.x[0].res[k] === 2); if (j < 0) return; const sc = G.x[0].p.sc; bop.act(G, 0, { t: 'h', y0: 0, i: j, c: G.pops[j].at + 10 }); if (G.x[0].p.sc !== sc) fail('bopped a pet long gone'); },
  (G, C, t) => { const j = G.x[0].res.findIndex(r => r === 1); if (j < 0) return; const sc = G.x[0].p.sc; bop.act(G, 0, { t: 'h', y0: 0, i: j, c: t }); if (G.x[0].p.sc !== sc) fail('bopped the same pet twice'); },
  (G, C, t) => { const sc = G.x[0].p.sc; for (const a of [{ t: 'h', y0: 0, i: 'x' }, { t: 'h', y0: 0, i: -1 }, { t: 'h', y0: 0, i: 1e9 }, { t: 'h', y0: 7, i: 0 }, { t: 'x' }, null, { t: 'h', y0: 0, i: 2.5, c: NaN }]) bop.act(G, 0, a); if (G.x[0].p.sc !== sc) fail('nonsense scored'); },
  (G, C, t) => { bop.act(G, 1, { t: 'h', y0: 0, i: G.x[1].ptr, c: t }); }, // a bot's seat takes no orders
]) play({ seats: 4 }, { react: 420, miss: .01, nap: .02, lag: 80 }, { cheat });
{ // two players losing their last heart to the same pet: the higher score is placed higher; a player who leaves is played for by a bot
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = bop.create(players, { seats: 2 }); now = G.goAt + 10; bop.fast(G, now);
  G.x[0].p.sc = 50; G.x[1].p.sc = 80; G.x[0].p.lv = G.x[1].p.lv = 1;
  for (let i = 0; i < 400 && G.ph === 'play'; i++) { now += 50; bop.fast(G, now); }
  if (G.ph !== 'end' || G.x[0].outAt !== G.x[1].outAt || G.win !== 1 || G.x[0].place !== 2) fail('a tie on the same pet should go to the higher score');
  const H = bop.create(players, { seats: 2 }); now = H.goAt + 10; bop.fast(H, now);
  if (!bop.setAway(H, 1, true) || H.x[1].sync !== 1) fail('setAway');
  for (let i = 0; i < 200; i++) { now += 50; bop.fast(H, now); bop.act(H, 0, { t: 'h', y0: 0, i: H.x[0].ptr, c: now - H.goAt }); }
  if (!H.x[1].p.bops) fail('no bot for the player who left');
  if (bop.view(H, -1).mine || !bop.view(H, 0).mine || bop.view(H, 0).x.length !== 2) fail('view');
  Date.now = realNow;
}
{ // bots: sharp outlasts chill, nobody is out at once, games end by themselves
  let sharp = 0, ms = 0, first = 0; const N = 200;
  for (let g = 0; g < N; g++) {
    const P = R.schedule(1000 + g, 'normal'), out = [0, 0, 0];
    for (let s = 0; s < 3; s++) { const p = R.newPlayer(), lvl = bop.BOT[s ? 'chill' : 'sharp'];
      for (const pop of P) { R.resolve(p, pop, bop.botPlan(pop, lvl) >= 0); if (p.lv <= 0) { out[s] = pop.at + pop.up; break; } }
      if (!out[s]) out[s] = R.TOTAL; }
    if (out[0] >= out[1] && out[0] >= out[2]) sharp++;
    ms += Math.max(...out.slice().sort((x, y) => x - y).slice(0, 2)); first += Math.min(...out);
  }
  console.log(`bots: sharp outlasted two chill ones ${sharp}/${N}; games ${(ms / N / 1000).toFixed(0)}s on average, first knock-out at ${(first / N / 1000).toFixed(0)}s`);
  if (sharp < N * .5) fail('sharp bots are not better than chill ones');
  if (first / N < 30000) fail('bots are out too soon');
  if (ms / N > 170000) fail('bot games drag on');
}
{ // options
  const o = bop.cleanOpts({ seats: 9, pace: 'x', bots: 1 }); if (o.seats !== 4 || o.pace !== 'normal' || o.bots !== 'chill') fail('options not cleaned');
  if (bop.create(players, { seats: 1 }).seats.length !== 2 || bop.create(players, { seats: 6 }).seats.length !== 6) fail('seats');
}

// ----- over the real server -----
const PORT = 24080 + (Math.random() * 900 | 0);
const srv = launch('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null, got = 0;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') { state = msg.s; got = Date.now(); } if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'bop', opts: { seats: 6, pace: 'fast', bots: 'sharp', laps: 3 } });
await wait(300);
if (room?.game !== 'bop' || room.opts.seats !== 6 || room.opts.pace !== 'fast' || 'laps' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.pace !== 'fast') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'bop' || state.seats.length !== 2 || state.stage !== 'count' || !state.mine || state.mine.lv !== 3) bail('game did not start');
// bop the first twelve pets (sleepers too), then stop: three bops on sleepers or three pets getting away end it
const P = R.schedule(state.seed, state.pace), done = new Set(); let sent = 0;
for (let i = 0; i < 900 && state.ph === 'play'; i++) {
  const t = state.t + (Date.now() - got);
  if (state.stage === 'go' && sent < 12) for (const p of P) { if (p.at > t) break; if (!done.has(p.i) && p.at + 60 <= t && t < p.at + p.up) { done.add(p.i); sent++; send({ t: 'act', a: { t: 'h', y0: state.mine.sync, i: p.i, c: Math.round(t) } }); } }
  await wait(40);
}
if (state.ph !== 'end') bail('game over the server did not finish');
if (state.mine.bops < 6 || state.mine.sc < 60) bail('bops over the server did not count: ' + JSON.stringify(state.mine));
if (state.x[state.me][0] > 0 || state.res.order.length !== 2 || !state.ev.some(e => e.t === 'b' && e.s === state.me)) bail('should be out of hearts');
await wait(300);
if (!me?.gain || !(me.gain.coins >= 1)) bail('coins not paid by place: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', sent, 'bops sent,', state.mine.bops, 'counted, score', state.mine.sc, 'placed', state.x[state.me][3], '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

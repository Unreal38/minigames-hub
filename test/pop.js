// Pet Pop: the rules (dealing, matching, powers, gravity, the steps a browser replays), then a real server:
// account gate, swaps that do nothing, a level won and lost, the daily coin cap, the ranking, and the shelf
// surviving a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSaved, writeSaved } from './saved.js';
import * as R from '../public/games/pop/rules.js';
const { W, N, KINDS, HOLE, EMPTY, BOWL, BALE, ZOOM_H, ZOOM_V, POUNCE, level, deal, play, settle, canSwap, findMove, findGroups, coinsFor, starsFor, DAILY, MOVE_BONUS } = R;

const PORT = 22900 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-pop-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(20); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
const rnd = n => Math.floor(Math.random() * n);

// ----- rules -----
// What the browser does with a move's steps must land on the server's shelf.
function replay(board, a, b, steps) {
  const lb = board.slice(); [lb[a], lb[b]] = [lb[b], lb[a]];
  for (const st of steps) {
    if (st.shuf) { lb.splice(0, N, ...st.shuf); continue; }
    for (const [i, v] of st.turn || []) lb[i] = v;
    for (const i of st.clr) lb[i] = EMPTY;
    for (const [i, v] of st.hit) lb[i] = v;
    for (const [i, v] of st.mk) lb[i] = v;
    settle(lb, st.add);
  }
  return lb;
}
for (let lv = 1; lv <= 60; lv++) {
  const def = level(lv);
  if (JSON.stringify(def) !== JSON.stringify(level(lv))) fail('a level must always be the same');
  if (def.mask.length !== N || !def.goals.length || def.moves < 10) fail('bad level ' + lv);
  if (def.goals.some(g => g.k === 'hay' && g.n !== def.bales) || def.goals.some(g => g.k === 'pet' && !(g.kind < def.kinds))) fail('goals do not fit level ' + lv);
  let b = deal(def, rnd);
  if (b.length !== N || b.some((v, i) => (v === HOLE) !== !def.mask[i]) || b.includes(EMPTY)) fail('bad shelf at level ' + lv);
  if (findGroups(b).length || !findMove(b)) fail('a fresh shelf must have no lines yet and a swap to make');
  if (b.filter(v => v > BALE).length !== def.bales || b.filter(v => v === BALE + 2).length !== Math.min(def.strong, def.bales)) fail('bales wrong at level ' + lv);
  for (let k = 0; k < 25; k++) {
    const m = findMove(b); if (!m) fail('stuck shelf');
    const out = play(b, m[0], m[1], def.kinds, rnd);
    if (!out || !out.steps.length) fail('a swap the finder offers must work');
    if (out.board.includes(EMPTY) || out.board.some((v, i) => (v === HOLE) !== !def.mask[i])) fail('gaps left on the shelf');
    if (findGroups(out.board).length && !out.steps.at(-1).shuf) fail('lines left standing');
    if (!findMove(out.board)) fail('left without a swap');
    if (replay(b, m[0], m[1], out.steps).join() !== out.board.join()) fail('the steps do not rebuild the shelf (level ' + lv + ')');
    if (out.pts !== out.steps.reduce((s, st) => s + (st.pts || 0), 0)) fail('points do not add up');
    b = out.board;
  }
}
// hand-made shelves: each power and what it does
const P = k => k * 4, grid = rows => rows.flat();
const filler = () => { const b = []; for (let i = 0; i < N; i++) b.push(P(((i % W) + 2 * (i / W | 0)) % 5 + 1)); return b; }; // kinds 1..5 in a pattern with no lines
if (findGroups(filler()).length) fail('test filler has lines');
const fixed = () => 3; // new pets are all kind 3, so the test knows what drops in
{ // four in a row leaves a Zoomer where the moved pet landed; three do not
  const b = filler(); for (const i of [56, 57, 59]) b[i] = P(0); b[50] = P(0);
  const out = play(b, 50, 58, 6, fixed);
  if (!out || out.steps[0].mk.length !== 1 || out.steps[0].mk[0][0] !== 58 || out.steps[0].mk[0][1] !== P(0) + ZOOM_H) fail('four in a row should leave a Zoomer ' + JSON.stringify(out?.steps[0]));
  if (out.pets[0] !== 4) fail('popped pets not counted');
  if (canSwap(filler(), 0, 2) || canSwap(filler(), 0, 9) || canSwap(filler(), 7, 8)) fail('only neighbours can be swapped');
  if (play(filler(), 0, 1, 6, fixed)) fail('a swap that lines nothing up must be refused');
}
{ // a Zoomer clears its row, and breaks a bale on the way
  const b = filler(); b[56] = P(0) + ZOOM_H; b[57] = P(0); b[59] = P(0); b[50] = P(0); b[63] = BALE + 1; b[62] = BALE + 2;
  const out = play(b, 50, 58, 6, fixed), st = out.steps[0];
  if (st.clr.filter(i => i >= 56).length !== 7 || !st.fx.some(f => f.t === 'row') || out.hay !== 1 || st.hit.length !== 1 || st.hit[0][1] !== BALE + 1) fail('Zoomer row wrong ' + JSON.stringify(st));
}
{ // an L leaves a Pouncer; five in a row leaves a Treat Bowl
  let b = filler(); for (const i of [41, 49, 58, 59]) b[i] = P(0); b[56] = P(0);
  let out = play(b, 56, 57, 6, fixed);
  if (out?.steps[0].mk[0]?.[1] !== P(0) + POUNCE) fail('an L should leave a Pouncer ' + JSON.stringify(out?.steps[0]));
  b = filler(); for (const i of [56, 57, 59, 60]) b[i] = P(0); b[50] = P(0);
  out = play(b, 50, 58, 6, fixed);
  if (out?.steps[0].mk[0]?.[1] !== BOWL) fail('five in a row should leave a Treat Bowl');
}
{ // a Treat Bowl swapped with a pet calls every pet of that kind; two bowls clear the shelf
  let b = filler(); b[0] = BOWL; const kind = b[1] >> 2, had = b.filter(v => v >> 2 === kind).length;
  let out = play(b, 0, 1, 6, fixed);
  if (!out || out.pets[kind] < had || !out.steps[0].fx.some(f => f.t === 'kind' && f.k === kind)) fail('Treat Bowl wrong');
  b = filler(); b[0] = b[1] = BOWL; b[20] = BALE + 1;
  out = play(b, 0, 1, 6, fixed);
  if (!out || out.steps[0].clr.length !== N || out.hay !== 1) fail('two bowls should clear the shelf');
  b = filler(); b[0] = P(0) + ZOOM_H; b[1] = P(1) + ZOOM_V;
  out = play(b, 0, 1, 6, fixed);
  if (!out || out.steps[0].clr.length !== 15) fail('two Zoomers should clear a row and a column');
  b = filler(); b[27] = P(0) + POUNCE; b[28] = P(1) + POUNCE;
  out = play(b, 27, 28, 6, fixed);
  if (!out || out.steps[0].clr.length !== 25) fail('two Pouncers should clear 5 x 5');
}
if (starsFor(0, 20) !== 1 || starsFor(3, 20) !== 2 || starsFor(6, 20) !== 3 || coinsFor(3) > 10) fail('stars or coins off');

// ----- the server -----
const boot = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
function player(name, token) {
  const p = { token, me: null, auth: null, last: null, rk: null };
  p.ready = new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token, name, color: '#ff8fab' });
    ws.onerror = () => {};
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { p.token = m.token; res(); }
      if (m.t === 'me') p.me = m.me;
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'pop') p.last = m;
      if (m.t === 'rankings') p.rk = m;
    };
  });
  p.do = async a => { p.last = null; p.send({ t: 'pop', a }); await until(() => p.last, 'pop reply to ' + a.t); return p.last; };
  return p;
}
const edit = async f => { // change the saved shelf while the server is down
  await wait(1700); await stop();
  const d = readSaved(DATA_DIR);
  f(Object.values(d.profiles).find(p => p.user === 'ana').pop); writeSaved(DATA_DIR, d);
  await boot(); a = player('Ana', a.token); await a.ready;
  return (await a.do({ t: 'open' })).s;
};

await boot();
let a = player('Ana'); await a.ready;
if ((await a.do({ t: 'open' })).need !== 'account') fail('guests must be asked for an account');
a.send({ t: 'register', user: 'ana', pass: 'hunter22' }); await until(() => a.auth, 'register');
let s = (await a.do({ t: 'open' })).s;
if (!s || s.lv !== 1 || s.left !== level(1).moves || s.score !== 0 || s.over || s.b.length !== N || s.goals[0].have !== 0) fail('fresh shelf wrong ' + JSON.stringify(s));
if ((await a.do({ t: 'next' })).err == null) fail('skipped an unfinished shelf');
if ((await a.do({ t: 'swap', a: 99, b: 3 })).err == null || (await a.do({ t: 'swap', a: '3', b: 4 })).err == null || (await a.do({ t: 'fly' })).err == null) fail('nonsense accepted');
{ // a swap that lines nothing up costs nothing
  let bad = null; for (let i = 0; i < N - 1 && !bad; i++) if (i % W < W - 1 && !canSwap(s.b, i, i + 1)) bad = [i, i + 1];
  const r = await a.do({ t: 'swap', a: bad[0], b: bad[1] });
  if (!r.no || r.steps || r.s.left !== s.left || r.s.b.join() !== s.b.join()) fail('a useless swap was played');
}
{ // a real move: one move gone, and the steps rebuild the server's shelf
  const m = findMove(s.b), r = await a.do({ t: 'swap', a: m[0], b: m[1] });
  if (!r.steps?.length || r.s.left !== s.left - 1 || r.s.score <= 0 || replay(s.b, m[0], m[1], r.steps).join() !== r.s.b.join()) fail('move wrong');
  s = r.s;
}
// The shelf survives a restart. With the goals all but met, the next move wins: stars, coins, next level.
const id = s.id, coins0 = a.me.coins;
s = await edit(p => { p.g.pets = p.g.pets.map(() => 99); });
if (s.id !== id || s.left !== level(1).moves - 1) fail('shelf did not survive the restart');
{
  const m = findMove(s.b), r = (await a.do({ t: 'swap', a: m[0], b: m[1] })).s, left = level(1).moves - 2;
  if (r.over !== 'win' || r.res.stars !== 3 || r.res.coins !== coinsFor(3) || r.res.bonus !== left * MOVE_BONUS || r.level !== 2) fail('win wrong ' + JSON.stringify(r.res));
  await until(() => a.me.coins === coins0 + coinsFor(3) && a.me.pop.lv === 2 && a.me.pop.paid === coinsFor(3), 'coins arrive');
  if ((await a.do({ t: 'swap', a: m[0], b: m[1] })).steps) fail('moved after the shelf was over');
  s = (await a.do({ t: 'next' })).s;
  if (s.over || s.lv !== 2 || s.b.filter(v => v > BALE).length !== level(2).bales) fail('level 2 wrong');
}
// Out of moves: no coins, same level again.
s = await edit(p => { p.g.left = 1; });
{
  const m = findMove(s.b), before = a.me.coins, r = (await a.do({ t: 'swap', a: m[0], b: m[1] })).s;
  if (r.over !== 'lose' || r.res.coins || r.level !== 2) fail('losing wrong ' + JSON.stringify(r.res));
  await wait(300); if (a.me.coins !== before) fail('a lost shelf paid coins');
  s = (await a.do({ t: 'next' })).s; if (s.lv !== 2 || s.left !== level(2).moves) fail('retry wrong');
}
// The ranking: highest level cleared.
a.send({ t: 'rankings', game: 'pop' }); await until(() => a.rk?.game === 'pop', 'ranking');
if (a.rk.rows[0]?.name !== 'Ana' || a.rk.rows[0].top !== 1 || a.rk.rows[0].games !== 2 || !(a.rk.rows[0].best > 0)) fail('ranking wrong ' + JSON.stringify(a.rk.rows));
// Daily cap: one coin left today, then nothing.
s = await edit(p => { p.paid = DAILY - 1; p.g.hay = 99; });
{
  let m = findMove(s.b), r = (await a.do({ t: 'swap', a: m[0], b: m[1] })).s;
  if (r.over !== 'win' || r.res.coins !== 1 || !r.res.capped) fail('daily cap not applied ' + JSON.stringify(r.res));
  s = await edit(p => { p.g = null; }); s = await edit(p => { p.g.pets = p.g.pets.map(() => 99); p.g.hay = 99; });
  m = findMove(s.b); r = (await a.do({ t: 'swap', a: m[0], b: m[1] })).s;
  if (r.over !== 'win' || r.res.coins !== 0 || r.res.xp !== 0 || r.level !== 4) fail('paid past the daily cap ' + JSON.stringify(r.res));
}
await stop();
console.log('pop ok');
process.exit(0);

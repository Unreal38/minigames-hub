// Pet Mahjong and Mahjong Race: the shared rules (layouts, free tiles, dealing, shuffling), the race module
// (pairs, resync, shuffles, the finish, bots), then a real server for the solo game: account gate, pairs,
// hints, shuffles, a level won and lost, the daily coin cap, the ranking, and the board surviving a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSaved, writeSaved } from './saved.js';
import * as R from '../public/games/mahj/rules.js';
import * as race from '../server/games/mahj.js';
const { LAYOUT_IDS, layout, deal, reshuffle, isFree, canPair, pairs, findMove, tilesLeft, kindsFor, level, starsFor, coinsFor, NKINDS, DAILY, PAIR_PTS, HINT_COST, RACE } = R;

const PORT = 23800 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-mahj-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(20); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
const rnd = n => Math.floor(Math.random() * n);

// ----- rules -----
for (const id of LAYOUT_IDS) {
  const lay = layout(id);
  if (lay !== layout(id)) fail('a layout must always be the same');
  if (lay.n % 2 || lay.n < 20 || lay.n > 144 || lay.w > 18) fail(`${id}: ${lay.n} tiles, ${lay.w / 2} wide`);
  if (new Set(lay.tiles.map(t => t.join())).size !== lay.n) fail(`${id}: two tiles in one place`);
  lay.tiles.forEach(([x, y, z], i) => {
    if (z > 0 && !lay.tiles.some(([u, v, w]) => w === z - 1 && Math.abs(u - x) < 2 && Math.abs(v - y) < 2)) fail(`${id}: tile ${i} floats`);
    if (lay.tiles.some(([u, v, w], j) => j !== i && w === z && Math.abs(u - x) < 2 && Math.abs(v - y) < 2)) fail(`${id}: tile ${i} overlaps another`);
  });
  for (let t = 0; t < 12; t++) {
    let b = deal(lay, kindsFor(lay), rnd);
    if (!b || b.length !== lay.n || b.some(v => !(v >= 0 && v < NKINDS))) fail(`${id}: bad deal`);
    const n = Array(NKINDS).fill(0); for (const v of b) n[v]++;
    if (n.some(c => c % 2) || n.filter(Boolean).length !== kindsFor(lay)) fail(`${id}: pictures do not come in pairs`);
    if (!findMove(lay, b)) fail(`${id}: a fresh board must have a pair`);
    // play it out at random; a shuffle must always help, unless the last tiles lie on each other
    for (let guard = 0; tilesLeft(b) && guard < 500; guard++) {
      const opts = pairs(lay, b);
      if (opts.length) { const [i, j] = opts[rnd(opts.length)]; if (!canPair(lay, b, i, j)) fail('pairs() gave a pair that cannot be taken'); b[i] = b[j] = -1; continue; }
      const m = reshuffle(lay, b, rnd);
      if (!m) { if (tilesLeft(b) <= 18 && R.canClear(lay, b)) fail(`${id}: gave up on tiles that can be cleared`); break; }
      if (m.map(v => v >= 0).join() !== b.map(v => v >= 0).join() || m.filter(v => v >= 0).sort().join() !== b.filter(v => v >= 0).sort().join()) fail(`${id}: a shuffle changed the tiles`);
      if (!findMove(lay, m)) fail(`${id}: a shuffle left no pair`);
      b = m;
    }
  }
}
{ // what "free" means, on the Pond: 20 tiles below (rows of 4, 6, 6, 4), a 2 x 2 block on top
  const lay = layout('pond'), b = Array(lay.n).fill(0), at = (x, y, z) => lay.tiles.findIndex(t => t[0] === x && t[1] === y && t[2] === z);
  if (!isFree(lay, b, at(2, 0, 0)) || isFree(lay, b, at(4, 0, 0)) || !isFree(lay, b, at(8, 0, 0))) fail('row ends are free, the middle is not');
  if (isFree(lay, b, at(4, 2, 0)) || !isFree(lay, b, at(4, 2, 1))) fail('a covered tile is not free, the one on top is');
  b[at(4, 2, 1)] = b[at(6, 2, 1)] = b[at(4, 4, 1)] = b[at(6, 4, 1)] = -1; b[at(0, 2, 0)] = b[at(2, 2, 0)] = -1;
  if (!isFree(lay, b, at(4, 2, 0)) || isFree(lay, b, at(6, 2, 0))) fail('free once uncovered with an open side');
  if (canPair(lay, b, at(4, 2, 0), at(4, 2, 0)) || canPair(lay, b, -1, 3) || canPair(lay, b, '1', 2) || canPair(lay, b, at(0, 2, 0), at(4, 2, 0))) fail('nonsense pairs');
  b[at(4, 2, 0)] = 5; if (canPair(lay, b, at(4, 2, 0), at(2, 0, 0))) fail('different pictures paired');
}
for (let lv = 1; lv <= 40; lv++) { const d = level(lv); if (!layout(d.id) || d.kinds < 6 || d.par < 60000 || JSON.stringify(d) !== JSON.stringify(level(lv))) fail('bad level ' + lv); }
if (layout(level(1).id).n !== 24 || layout(level(9).id).n !== 144 || layout(level(30).id).n < 80) fail('levels should grow from 24 tiles to 144 and stay big');
if (starsFor(10, 20, 0) !== 3 || starsFor(30, 20, 0) !== 2 || starsFor(10, 20, 1) !== 2 || starsFor(30, 20, 2) !== 1 || coinsFor(3) > 10) fail('stars or coins off');
for (const ids of Object.values(RACE)) for (const id of ids) if (!layout(id)) fail('race layout missing: ' + id);

// ----- the race -----
{
  const me = { id: 'p1', name: 'Ana', color: '#ff8fab', av: null };
  if (race.cleanOpts({ seats: 9, size: 'x', bots: 'y' }).seats !== 4 || race.cleanOpts({ size: 'long' }).size !== 'long') fail('race options');
  const G = race.create([me], { seats: 3, size: 'short', bots: 'sharp' }), lay = layout(G.lay);
  if (G.seats.length !== 3 || !G.seats[1].bot || G.b[0].join() !== G.b[2].join() || !RACE.short.includes(G.lay)) fail('race start wrong');
  const m0 = findMove(lay, G.b[0]);
  race.act(G, 0, { t: 'p', y0: 0, n: 1, a: m0[0], b: m0[1] });
  if (G.x[0].n !== 0) fail('a pair was taken during the countdown');
  race.fast(G, G.goAt + 10);
  if (G.stage !== 'go' || !G.ev.some(e => e.t === 'go')) fail('the race did not start');
  race.act(G, 0, { t: 'p', y0: 0, n: 1, a: m0[0], b: m0[1] });
  if (G.x[0].n !== 1 || G.x[0].left !== lay.n - 2 || G.b[0][m0[0]] !== -1 || G.b[1][m0[0]] < 0) fail('pair not taken on my board only');
  race.act(G, 0, { t: 'p', y0: 5, n: 2, a: 0, b: 1 }); if (G.x[0].sync !== 0) fail('a stale message must be ignored');
  race.act(G, 0, { t: 'p', y0: 0, n: 2, a: m0[0], b: m0[1] }); if (G.x[0].sync !== 1 || G.x[0].n !== 1) fail('a pair that is not there must resync');
  race.act(G, 1, { t: 'p', y0: 0, n: 1, a: 0, b: 1 }); if (G.x[1].n) fail('nobody plays a bot seat');
  const v = race.view(G, 0), w = race.view(G, -1);
  if (v.mine.b.join() !== G.b[0].join() || v.mine.sync !== 1 || v.x[0][0] !== lay.n - 2 || w.me !== -1 || !w.mine.b) fail('view wrong');
  // bots move with the clock
  race.fast(G, Date.now() + 60_000); if (!(G.x[1].n > 0)) fail('bots should take pairs');
  // someone who drops out is played by a bot, and gets the seat back
  if (!race.setAway(G, 0, true) || !G.seats[0].bot || !race.setAway(G, 0, false) || G.seats[0].bot) fail('away seat');
  // clear my board: every pair is accepted, shuffles included, and the race ends with me first
  let mixes = 0;
  for (let guard = 0; G.x[0].left && !G.x[0].stuck && guard < 400; guard++) {
    const x = G.x[0], m = findMove(lay, G.b[0]); if (!m) fail('no pair and no shuffle');
    x.holdTo = 0; const was = x.mixes;
    race.act(G, 0, { t: 'p', y0: x.sync, n: x.n + 1, a: m[0], b: m[1] });
    if (x.mixes > was) { mixes++; if (!findMove(lay, G.b[0]) || !G.ev.some(e => e.t === 'mix' && e.s === 0)) fail('a shuffle must leave a pair and say so'); }
  }
  if (!G.x[0].stuck) {
    if (!G.x[0].doneAt) fail('board not cleared');
    race.fast(G);
    const res = race.results(G);
    if (G.ph !== 'end' || G.win !== 0 || !res[0].win || res[0].place !== 1 || res[1].place < 2 || res[0].pts !== lay.n / 2 || !G.res.cleared) fail('finish wrong ' + JSON.stringify(G.res));
  }
  // nobody left racing: placed by tiles left
  const H = race.create([me, { ...me, id: 'p2', name: 'Bo' }], { seats: 2 }); race.fast(H, H.goAt + 10);
  const hm = findMove(layout(H.lay), H.b[1]); race.act(H, 1, { t: 'p', y0: 0, n: 1, a: hm[0], b: hm[1] });
  H.x[0].stuck = H.x[1].stuck = true; race.fast(H);
  if (H.ph !== 'end' || H.win !== 1 || H.res.cleared) fail('a race nobody can finish goes to the fewest tiles left');
}

// ----- the solo game on a real server -----
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
      if (m.t === 'mj') p.last = m;
      if (m.t === 'rankings') p.rk = m;
    };
  });
  p.do = async a => { p.last = null; p.send({ t: 'mj', a }); await until(() => p.last, 'mj reply to ' + a.t); return p.last; };
  return p;
}
let a;
const edit = async f => { // change the saved board while the server is down
  await wait(1700); await stop();
  const d = readSaved(DATA_DIR);
  f(Object.values(d.profiles).find(p => p.user === 'ana').mj); writeSaved(DATA_DIR, d);
  await boot(); a = player('Ana', a.token); await a.ready;
  return (await a.do({ t: 'open' })).s;
};
// leaves only one pair on the board (the two tiles of the first pair that can be taken)
const lastPair = g => { const lay = layout(g.lay), m = findMove(lay, g.b); g.b = g.b.map((v, i) => (i === m[0] || i === m[1] ? v : -1)); };

await boot();
a = player('Ana'); await a.ready;
if ((await a.do({ t: 'open' })).need !== 'account') fail('guests must be asked for an account');
a.send({ t: 'register', user: 'ana', pass: 'hunter22' }); await until(() => a.auth, 'register');
let s = (await a.do({ t: 'open' })).s, lay = layout(s.lay);
if (!s || s.lv !== 1 || s.lay !== level(1).id || s.b.length !== lay.n || s.score !== 0 || s.over || s.stuck || s.ms !== 0) fail('fresh board wrong ' + JSON.stringify(s));
if ((await a.do({ t: 'next' })).err == null || (await a.do({ t: 'fly' })).err == null) fail('nonsense accepted');
{ // a pair that cannot be taken changes nothing
  const blocked = s.b.findIndex((v, i) => !isFree(lay, s.b, i));
  for (const [x, y] of [[blocked, 0], [99, 3], ['3', 4], [2, 2]]) { const r = await a.do({ t: 'pair', a: x, b: y }); if (!r.no || r.took || r.s.b.join() !== s.b.join() || r.s.score) fail('a bad pair was taken'); }
}
{ // a real pair, then a hint that costs points, then a shuffle that costs a star
  const m = findMove(lay, s.b); let r = await a.do({ t: 'pair', a: m[0], b: m[1] });
  if (!r.took || r.pts !== PAIR_PTS || r.s.score !== PAIR_PTS || r.s.b[m[0]] !== -1 || r.s.b[m[1]] !== -1 || tilesLeft(r.s.b) !== lay.n - 2 || !r.s.run) fail('pair wrong');
  r = await a.do({ t: 'hint' });
  if (!r.hint || !canPair(lay, r.s.b, r.hint[0], r.hint[1]) || r.s.score !== PAIR_PTS - HINT_COST || r.s.hints !== 1) fail('hint wrong');
  const before = r.s.b; r = await a.do({ t: 'shuf' });
  if (!r.mixed || r.s.shuf !== 1 || r.s.b.filter(v => v >= 0).sort().join() !== before.filter(v => v >= 0).sort().join() || !findMove(lay, r.s.b)) fail('shuffle wrong');
  s = r.s;
}
// The board survives a restart. With one pair left, the next move wins: stars, coins, next level.
const id = s.id, coins0 = a.me.coins;
s = await edit(p => { lastPair(p.g); });
if (s.id !== id || tilesLeft(s.b) !== 2 || s.shuf !== 1) fail('board did not survive the restart');
{
  const m = findMove(lay, s.b), r = await a.do({ t: 'pair', a: m[0], b: m[1] });
  if (r.s.over !== 'win' || r.s.res.stars !== 2 || r.s.res.clean || !r.s.res.fast || r.s.res.coins !== coinsFor(2) || r.s.level !== 2 || !(r.s.res.bonus > 0)) fail('win wrong ' + JSON.stringify(r.s.res));
  await until(() => a.me.coins === coins0 + coinsFor(2) && a.me.mj.lv === 2 && a.me.mj.paid === coinsFor(2), 'coins arrive');
  if ((await a.do({ t: 'pair', a: m[0], b: m[1] })).took || (await a.do({ t: 'new' })).err == null) fail('played on after the board was over');
  s = (await a.do({ t: 'next' })).s; lay = layout(s.lay);
  if (s.over || s.lv !== 2 || s.lay !== level(2).id || s.b.length !== lay.n) fail('level 2 wrong');
  const again = (await a.do({ t: 'new' })).s; if (again.id === s.id || again.lv !== 2) fail('a new deal should give a fresh board on the same level');
  s = again;
}
// Two tiles lying on each other: no shuffle can help, the board is lost, no coins, same level again.
s = await edit(p => { const l = layout(p.g.lay), top = l.above.findIndex(x => x.length); p.g.b = p.g.b.map((v, i) => (i === top || i === l.above[top][0] ? 7 : -1)); });
{
  if (!s.stuck) fail('two stacked tiles should count as stuck');
  const before = a.me.coins, r = await a.do({ t: 'shuf' });
  if (!r.lost || r.s.over !== 'lose' || r.s.res.coins || r.s.level !== 2) fail('losing wrong ' + JSON.stringify(r.s.res));
  await wait(300); if (a.me.coins !== before) fail('a lost board paid coins');
  s = (await a.do({ t: 'next' })).s; if (s.lv !== 2 || tilesLeft(s.b) !== layout(level(2).id).n) fail('retry wrong');
}
// The ranking: highest level cleared.
a.send({ t: 'rankings', game: 'mj' }); await until(() => a.rk?.game === 'mj', 'ranking');
if (a.rk.rows[0]?.name !== 'Ana' || a.rk.rows[0].top !== 1 || a.rk.rows[0].games !== 2 || !(a.rk.rows[0].best > 0)) fail('ranking wrong ' + JSON.stringify(a.rk.rows));
// Daily cap: one coin left today, then nothing.
s = await edit(p => { p.paid = DAILY - 1; lastPair(p.g); });
{
  let m = findMove(layout(s.lay), s.b), r = (await a.do({ t: 'pair', a: m[0], b: m[1] })).s;
  if (r.over !== 'win' || r.res.stars !== 3 || r.res.coins !== 1 || !r.res.capped) fail('daily cap not applied ' + JSON.stringify(r.res));
  s = await edit(p => { p.g = null; }); s = await edit(p => { lastPair(p.g); });
  m = findMove(layout(s.lay), s.b); r = (await a.do({ t: 'pair', a: m[0], b: m[1] })).s;
  if (r.over !== 'win' || r.res.coins !== 0 || r.res.xp !== 0 || r.level !== 4) fail('paid past the daily cap ' + JSON.stringify(r.res));
}
await stop();
console.log('mahj ok');
process.exit(0);

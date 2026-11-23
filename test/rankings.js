// Global rankings: per-game order, guests sharing an account's name left out, "your place" below the top 25,
// no profile ids sent, and credit() keeping the per-game totals the boards use.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };

const prof = (pid, name, byGame, extra = {}) => ({ pid, user: null, name, color: '#ff8fab', av: null, xp: 0, games: 0, wins: 0, pts: 0, byGame, coins: 0, owned: [], ...extra });
const profiles = {
  acc: prof('acc', 'Kuba', { hotpot: { games: 10, wins: 6, best: 90 }, marbles: { games: 5, wins: 2, best: 30, net: 40 } }, { user: 'kuba', xp: 900, games: 15, wins: 8 }),
  dup: prof('dup', 'kuba', { hotpot: { games: 3, wins: 3, best: 90 } }, { xp: 200, games: 3, wins: 3 }),
  mia: prof('mia', 'Mia', { hotpot: { games: 4, wins: 2, best: 60 }, marbles: { games: 9, wins: 2, best: 30, net: 90 } }, { xp: 500, games: 13, wins: 8 }),
  low: prof('low', 'Last', { ladders: { games: 1, wins: 0, best: 0 } }, { xp: 15, games: 1 }),
};
for (let i = 0; i < 30; i++) profiles['f' + i] = prof('f' + i, 'Filler ' + i, { ladders: { games: 2, wins: 1, best: 20 } }, { xp: 50 + i, games: 2, wins: 1 });
const sessions = { lowtoken00000000bb: { id: 'aa', pid: 'low', seen: Date.now() }, miatoken00000000aa: { id: 'bb', pid: 'mia', seen: Date.now() } };
fs.writeFileSync(path.join(DATA_DIR, 'cozy-table.json'), JSON.stringify({ v: 1, profiles, sessions, rooms: [] }));

const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' });
await wait(700);
function open(token) {
  const p = { boards: {} };
  p.ready = new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token, name: token === 'miatoken00000000aa' ? 'Mia' : 'Last', color: '#ff8fab' }));
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') res(); if (m.t === 'rankings') p.boards[m.game] = m; };
  });
  p.ask = async game => { delete p.boards[game]; p.ws.send(JSON.stringify({ t: 'rankings', game })); const t0 = Date.now(); while (!p.boards[game]) { await wait(20); if (Date.now() - t0 > 4000) fail('no board ' + game); } return p.boards[game]; };
  return p;
}
const mia = open('miatoken00000000aa'), low = open('lowtoken00000000bb'); await mia.ready; await low.ready;

const hp = await mia.ask('hotpot');
if (hp.rows.map(r => r.name).join() !== 'Kuba,Mia') fail('hotpot order / duplicate guest ' + JSON.stringify(hp.rows));
if (!hp.rows[1].me || hp.rows[0].me) fail('me flag');
if (hp.rows[0].guest || !hp.rows[1].guest) fail('guest flag');
if (JSON.stringify(hp).includes('"pid"') || JSON.stringify(hp).includes('acc')) fail('profile ids leaked');
const mr = await mia.ask('marbles');
if (mr.rows[0].name !== 'Mia' || mr.rows[0].net !== 90) fail('marbles tie broken by coins ' + JSON.stringify(mr.rows));
const ov = await mia.ask('overall');
if (ov.rows[0].name !== 'Kuba' || ov.rows[0].xp !== 900 || !ov.rows[0].lv) fail('overall by xp');
const ld = await low.ask('ladders');
if (ld.rows.length !== 25 || ld.total !== 31 || !ld.mine || ld.mine.pos !== 31 || !ld.mine.me) fail('your place below the top ' + JSON.stringify({ n: ld.rows.length, total: ld.total, mine: ld.mine }));
const fm = await low.ask('farm');
if (!Array.isArray(fm.rows)) fail('farm board');
low.ws.send(JSON.stringify({ t: 'rankings', game: 'nope' })); await wait(200);
if (low.boards.nope) fail('unknown game answered');

mia.ws.close(); low.ws.close(); await wait(200);
srv.kill('SIGTERM'); await new Promise(r => srv.once('exit', r));

// credit() keeps the per-game point total and Marble Rush coin net.
process.env.DATA_DIR = DATA_DIR;
const store = await import('../server/store.js');
store.load();
const p = store.profiles.get('mia');
store.credit(p, 'marbles', { pts: 25, win: true, coinNet: 40 });
store.credit(p, 'marbles', { pts: 0, win: false, coinNet: -25 });
if (p.byGame.marbles.pts !== 25 || p.byGame.marbles.net !== 105 || p.byGame.marbles.wins !== 3) fail('credit totals ' + JSON.stringify(p.byGame.marbles));
// Coins are paid by final place: 10 for 1st, spread evenly down to 1 for last.
const R = await import('../public/ranks.js');
// The rank ladder: levels up to 20 are what they always were, levels never end, and every rank has an emblem.
{
  const { RANK_ICONS } = await import('../public/rankicons.js');
  const tri = L => 50 * L * (L - 1);
  for (let L = 1; L <= 20; L++) if (R.xpForLevel(L) !== tri(L) || R.levelOf(tri(L)) !== L || R.levelOf(tri(L + 1) - 1) !== L) fail('level ' + L + ' moved');
  for (let xp = 0; xp < 300000; xp += 137) { const L = R.levelOf(xp); if (R.xpForLevel(L) > xp || R.xpForLevel(L + 1) <= xp) fail('level bounds at ' + xp); }
  if (R.levelOf(tri(31)) < 31) fail('a level dropped above the flat part');
  for (const r of R.RANKS) if (!RANK_ICONS[r.icon]) fail('no emblem for ' + r.name);
  for (const lv of [1, 3, 5, 8, 12, 17, 23, 30]) if (!R.RANKS.some(r => r.lv === lv)) fail('old rank level ' + lv + ' is gone');
  const top = R.progress(R.xpForLevel(75));
  if (top.rank !== 'Sky Legend ★5' || top.stars !== 5 || top.nextRankLv !== 80 || !top.nextRank) fail('stars ' + JSON.stringify(top));
  if (R.progress(0).rank !== 'Seedling' || R.rankOf(17).name !== 'Compass Keeper' || R.rankOf(54).stars !== 0 || R.rankOf(55).stars !== 1) fail('rank names');
  // Constellations: every star lights one point of the one being worked on, lit stars never move, and only finished ones can be shown.
  const C = await import('../public/constellations.js');
  if (new Set(C.CONS.map(c => c.id)).size !== C.CONS.length || C.CONS.some(c => !C.SETS[c.set] || c.p.length < 5 || c.l.some(l => l.some(i => !c.p[i])))) fail('constellation data');
  let sky = C.tidySky(null, 0);
  if (sky.now !== 'kite' || sky.shown || Object.keys(sky.lit).length) fail('empty sky ' + JSON.stringify(sky));
  sky = C.tidySky({ now: 'cat' }, 3);
  if (sky.lit.cat !== 3 || sky.now !== 'cat') fail('stars did not go to the picked one');
  sky = C.tidySky({ ...sky, now: 'die' }, 9); // 6 more: five finish the Die, the sixth goes to the first unfinished
  if (sky.lit.cat !== 3 || sky.lit.die !== 5 || sky.lit.kite !== 1 || sky.shown !== 'die' || sky.now !== 'kite') fail('overflow ' + JSON.stringify(sky));
  if (JSON.stringify(C.tidySky(sky, 9)) !== JSON.stringify(sky) || JSON.stringify(C.tidySky(sky, 2)) !== JSON.stringify(sky)) fail('tidying moved stars');
  if (C.tidySky({ ...sky, shown: 'cat' }, 9).shown !== 'die' || C.tidySky({ lit: { die: 99, nope: 4 }, now: 'die' }, 0).lit.die !== 5) fail('bad saved sky kept');
  const full = C.tidySky(null, C.STARS_IN_ALL + 7);
  if (C.doneIds(full).length !== C.CONS.length || full.now || !C.conArt(C.CONS[0], 2).includes('<svg') || !C.conGlyph(C.CONS[0])) fail('full sky');
  for (const p of [store.profiles.get('mia')]) { // the server keeps it: stars placed on read, picks checked
    const xp = p.xp; p.xp = R.xpForLevel(50);
    if (store.setSky(p, { shown: 'kite' }).ok || !store.setSky(p, { now: 'cat' }).ok || store.badge(p).cn) fail('sky picks');
    p.xp = R.xpForLevel(50 + 5 * 8); // eight stars: seven finish the Cat, one starts the Kite
    if (store.me(p).sky.lit.cat !== 7 || store.badge(p).cn !== 'cat' || store.publicProfile(p).sky.lit.kite !== 1 || store.me(p).sky.stars !== 8) fail('server sky ' + JSON.stringify(p.sky));
    if (!store.setSky(p, { now: 'dragon' }).ok || store.setSky(p, { now: 'cat' }).ok || store.setSky(p, { now: 'zzz' }).ok || store.setSky(p, { shown: 'kite' }).ok) fail('sky now');
    p.xp = R.xpForLevel(50 + 5 * 10); if (store.me(p).sky.lit.dragon !== 2 || p.sky.lit.kite !== 1) fail('new stars went to the wrong place');
    p.xp = xp; delete p.sky;
  }
}
const scale = n => Array.from({ length: n }, (_, i) => R.placeCoins(i + 1, n)).join('/');
if (scale(2) !== '10/1' || scale(3) !== '10/6/1' || scale(4) !== '10/7/4/1' || scale(6) !== '10/8/6/5/3/1') fail('place scale ' + [2, 3, 4, 6].map(scale));
const placed = R.withPlaces([{ pts: 5 }, { pts: 9 }, { pts: 2, win: true }, { pts: 5 }, { pts: 1, place: 2 }]).map(r => r.place).join();
if (placed !== '3,2,1,3,2') fail('places from win and points ' + placed);
const c0 = p.coins, g2 = store.credit(p, 'ludo', { pts: 10, place: 2, of: 4 });
if (g2.coins !== 7 || p.coins !== c0 + 7) fail('2nd of 4 should pay 7 ' + JSON.stringify(g2));
if (store.credit(p, 'golf', { pts: 0, place: 1, of: 3, idle: true }).coins !== 0) fail('idle player was paid');
if (store.credit(p, 'stack', { pts: 0, win: true }).coins !== 10) fail('a win with no place should pay 1st');
const after = store.leaderboard('marbles', 'mia');
if (after.rows[0].net !== 105 || after.rows[0].games !== 11) fail('board not refreshed after credit');
// A match with a bot seat pays XP and coins but adds nothing the rankings count.
{
  const was = JSON.stringify([p.games, p.wins, p.pts, p.byGame.marbles]), xp0 = p.xp, coins0 = p.coins;
  const gb = store.credit(p, 'marbles', { pts: 30, win: true, coinNet: 15, ranked: false });
  if (JSON.stringify([p.games, p.wins, p.pts, p.byGame.marbles]) !== was) fail('bot match counted toward rankings ' + JSON.stringify(p.byGame.marbles));
  if (gb.ranked !== false || !(p.xp > xp0) || p.coins !== coins0 + 10 + 15) fail('bot match should still pay XP and coins ' + JSON.stringify(gb));
  const bb = store.leaderboard('marbles', 'mia');
  if (bb.rows[0].wins !== after.rows[0].wins || bb.rows[0].games !== 11) fail('board moved after a bot match');
}
console.log('rankings ok');
process.exit(0);

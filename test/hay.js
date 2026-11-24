// Hay Hunch: the dealt fields and signs, then a real server: account gate, no peeking under bales, clearing,
// waking a pet, taking the harvest, the daily coin cap, the ranking, and the field surviving a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSaved, writeSaved } from './saved.js';
import { N, LEVELS, MAX_LV, PET, deal, hints, harvestOf, coinsFor, DAILY } from '../public/games/hay/rules.js';

const PORT = 21900 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-hay-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(20); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

// ----- rules -----
for (let lv = 1; lv <= MAX_LV; lv++) for (const [a, b, c] of LEVELS[lv]) if (a + b + c > N * N) fail('level does not fit');
for (let k = 0; k < 400; k++) {
  const lv = 1 + k % MAX_LV, cells = deal(lv);
  if (cells.length !== N * N || cells.some(v => ![0, 1, 2, 3].includes(v))) fail('bad field');
  const pets = cells.filter(v => v === PET).length;
  if (!LEVELS[lv].some(s => s[2] === pets && s[0] === cells.filter(v => v === 2).length && s[1] === cells.filter(v => v === 3).length)) fail('field not from its level');
  const H = hints(cells);
  const sum = H.rows.reduce((a, r) => a + r.sum, 0), sumC = H.cols.reduce((a, r) => a + r.sum, 0);
  if (sum !== sumC || sum !== cells.reduce((a, v) => a + v, 0)) fail('signs do not add up');
  if (H.rows.reduce((a, r) => a + r.pets, 0) !== pets || H.cols.reduce((a, r) => a + r.pets, 0) !== pets) fail('pet signs wrong');
}
if (harvestOf([1, 2, 3, 0], [1, 1, 1, 0]) !== 6 || harvestOf([1, 2], [0, 0]) !== 0 || harvestOf([1, 1], [1, 0]) !== 1) fail('harvest maths');

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
      if (m.t === 'hay') p.last = m;
      if (m.t === 'rankings') p.rk = m;
    };
  });
  p.do = async a => { p.last = null; p.send({ t: 'hay', a }); await until(() => p.last, 'hay reply to ' + a.t); return p.last; };
  return p;
}
// The test can read the secret field from the save file once the server has written it.
const secret = async () => { await wait(1700); const d = readSaved(DATA_DIR); return Object.values(d.profiles).find(p => p.user === 'ana').hay; };

await boot();
let a = player('Ana'); await a.ready;
if ((await a.do({ t: 'open' })).need !== 'account') fail('guests must be asked for an account');
a.send({ t: 'register', user: 'ana', pass: 'hunter22' }); await until(() => a.auth, 'register');
let s = (await a.do({ t: 'open' })).s;
if (!s || s.level !== 1 || s.cells.some(v => v !== -1) || s.harvest !== 0) fail('fresh field wrong ' + JSON.stringify(s));
if (s.rows.length !== N || s.cols.length !== N) fail('signs missing');
if ((await a.do({ t: 'bank' })).err !== 'Flip a bale first.') fail('banked an empty harvest');
if ((await a.do({ t: 'next' })).err == null) fail('skipped an unfinished field');
if ((await a.do({ t: 'flip', i: 99 })).err == null || (await a.do({ t: 'flip', i: '3' })).err == null) fail('nonsense flip accepted');

// Clear fields with the secret in hand until the level climbs, checking coins and that nothing leaks.
let coins0 = a.me.coins, paid = 0;
for (let round = 0; round < 3; round++) {
  const h = await secret(); const cells = h.f.cells;
  if (h.f.id !== s.id) fail('field changed under us');
  const order = cells.map((v, i) => [v, i]).filter(([v]) => v >= 1).sort((x, y) => x[0] - y[0]).map(([, i]) => i); // 1s first, then the rest
  let r;
  for (const i of order) {
    r = (await a.do({ t: 'flip', i })).s;
    if (!r.over) { r.cells.forEach((v, k) => { if ((v >= 0) !== !!r.open[k]) fail('unflipped bale shown'); }); if (JSON.stringify(r).includes('"f"')) fail('field leaked'); }
    if (r.over) break;
  }
  if (r.over !== 'clear') fail('field not cleared: ' + r.over);
  if (r.cells.some(v => v < 0)) fail('cleared field not shown in full');
  const want = Math.min(DAILY - paid, coinsFor(round + 1)); paid += want;
  if (r.res.coins !== want || r.level !== round + 2) fail(`clear paid ${r.res.coins} (want ${want}) level ${r.level}`);
  await until(() => a.me.coins === coins0 + paid, 'coins arrive');
  s = (await a.do({ t: 'next' })).s;
  if (s.over || s.level !== round + 2 || s.lv !== round + 2) fail('next field wrong');
}

// Wake a pet: harvest gone, one level down.
{
  const h = await secret(), cells = h.f.cells, one = cells.indexOf(2) >= 0 ? cells.indexOf(2) : cells.indexOf(3), pet = cells.indexOf(PET);
  await a.do({ t: 'flip', i: one });
  const r = (await a.do({ t: 'flip', i: pet })).s;
  if (r.over !== 'pet' || r.wake !== pet || r.res.lost < 2 || r.level !== 3 || r.res.coins) fail('waking a pet went wrong ' + JSON.stringify(r.res));
  if ((await a.do({ t: 'flip', i: cells.indexOf(1) })).s.over !== 'pet') fail('flipped after the field was over');
  s = (await a.do({ t: 'next' })).s;
}
// Take the harvest home: points but no coins, same level.
{
  const h = await secret(), cells = h.f.cells, i3 = cells.indexOf(3) >= 0 ? cells.indexOf(3) : cells.indexOf(2), before = a.me.coins;
  await a.do({ t: 'flip', i: i3 });
  const r = (await a.do({ t: 'bank' })).s;
  if (r.over !== 'bank' || r.res.pts !== cells[i3] || r.level !== 3 || r.res.coins) fail('bank wrong');
  await wait(400); if (a.me.coins !== before) fail('bank paid coins');
  s = (await a.do({ t: 'next' })).s;
}
// The ranking shows the best field.
a.send({ t: 'rankings', game: 'hay' }); await until(() => a.rk?.game === 'hay', 'ranking');
if (a.rk.rows[0]?.name !== 'Ana' || !(a.rk.rows[0].best > 0) || a.rk.rows[0].wins !== 3) fail('ranking wrong ' + JSON.stringify(a.rk.rows));

// Daily cap: pretend most of today's coins are spent, by editing the save while the server is down.
await a.do({ t: 'flip', i: (await secret()).f.cells.indexOf(1) });
const midId = s.id;
await stop();
{ const d = readSaved(DATA_DIR); const p = Object.values(d.profiles).find(p => p.user === 'ana'); p.hay.paid = DAILY - 1; writeSaved(DATA_DIR, d); }
await boot();
a = player('Ana', a.token); await a.ready;
s = (await a.do({ t: 'open' })).s;
if (s.id !== midId || s.open.filter(Boolean).length !== 1) fail('field did not survive the restart');
{
  const h = await secret(), cells = h.f.cells;
  let r;
  for (const i of cells.map((v, i) => v >= 2 ? i : -1).filter(i => i >= 0)) r = (await a.do({ t: 'flip', i })).s;
  if (r.over !== 'clear' || r.res.coins !== 1 || !r.res.capped) fail('daily cap not applied ' + JSON.stringify(r.res));
  await a.do({ t: 'next' });
  const h2 = await secret(); let r2;
  for (const i of h2.f.cells.map((v, i) => v >= 2 ? i : -1).filter(i => i >= 0)) r2 = (await a.do({ t: 'flip', i })).s;
  if (r2.over !== 'clear' || r2.res.coins !== 0 || r2.res.xp !== 0) fail('paid past the daily cap');
}
await stop();

// ----- guards for the page sometimes opening on an empty sky -----
// A lost WebGL context left the field blank for good, and every game visit used to keep its GPU context alive
// (browsers allow only a handful, then drop the oldest). The first ask for the field could also be lost.
const client = fs.readFileSync('public/games/hay/client.js', 'utf8');
if (!/webglcontextlost[\s\S]*rebuildScene/.test(client)) fail('Hay Hunch must rebuild its scene when the WebGL context is lost');
if (!/function askField[\s\S]*setInterval/.test(client)) fail('Hay Hunch must keep asking for the field until it comes');
for (const id of fs.readdirSync('public/games')) {
  const f = `public/games/${id}/scene3d.js`; if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) if (/renderer\.dispose\(\)/.test(line) && !/forceContextLoss/.test(line)) fail(`${f}: dispose the renderer with forceContextLoss() so the GPU context is freed`);
}
console.log('hay ok');
process.exit(0);

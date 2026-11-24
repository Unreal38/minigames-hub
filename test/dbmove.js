// The move from the JSON files to zatoka.db: a site that ran on the old saves (STORE=json writes them exactly like
// older versions) is checked with `npm run db-check`, then started normally. Every account, guest, coin, farm,
// open table and the visitor count must come through, the JSON files must stay byte for byte as they were, and a
// save after the move must only write what changed (fast, even with 50,000 saved players).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { readSaved, readFarms } from './saved.js';
const PORT = 23100 + (Math.random() * 800 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-move-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv, log = '';
const boot = async (env = {}) => { log = ''; srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, FARM_TEST: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d); await wait(800); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
const fail = m => { console.error('FAIL', m, '\n--- server log ---\n' + log); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 20000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(DATA_DIR, f))).digest('hex');

let ipN = 0;
function player(name, token) {
  const p = { name, token, me: null, stats: null, farm: null, auth: null, room: null };
  p.ready = new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { 'x-forwarded-for': `10.7.0.${++ipN}` } });
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => {};
    ws.onmessage = e => { const m = JSON.parse(e.data);
      if (m.t === 'welcome') { p.token = m.token; res(p); }
      if (m.t === 'me') p.me = m.me; if (m.t === 'stats') p.stats = m; if (m.t === 'farm') p.farm = m; if (m.t === 'auth') p.auth = m; if (m.t === 'room') p.room = m.room; };
  });
  p.ask = async (m, key) => { p[key] = null; p.send(m); await until(() => p[key], m.t); return p[key]; };
  p.close = () => p.ws.close();
  return p;
}

// 1. An old-style site: accounts, a guest, a farm, coins, a waiting table, visitors.
await boot({ STORE: 'json' });
const ana = await player('Ana').ready, bo = await player('Bo').ready, guest = await player('Gus').ready;
for (const [p, u] of [[ana, 'ana'], [bo, 'bobek']]) if (!(await p.ask({ t: 'register', user: u, pass: 'pear12345' }, 'auth')).ok) fail('register ' + u);
await ana.ask({ t: 'farm', a: { t: 'starter', sp: 'mossbun' } }, 'farm');
if (!ana.farm?.farm) fail('no farm');
bo.send({ t: 'create', game: 'hotpot', priv: true, opts: {} }); await until(() => bo.room, 'table');
await wait(1800); await stop();
if (fs.existsSync(path.join(DATA_DIR, 'zatoka.db'))) fail('STORE=json made a database');
const old = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8'));
const visitorsBefore = new Set([...old.visitors]).size;
if (visitorsBefore !== 3) fail('expected 3 visitors in the old file, got ' + visitorsBefore);
const hashes = { a: sha('cozy-table.json'), f: sha('pet-farm.json') };

// 2. The dry run says it all matches, and leaves no database behind.
let out = '';
try { out = execFileSync('node', ['server/dbcheck.js'], { env: { ...process.env, DATA_DIR }, encoding: 'utf8' }); } catch (e) { fail('db-check failed:\n' + e.stdout + e.stderr); }
if (!/everything matched/.test(out) || !/visitors so far \(the number on the hub\): 3/.test(out) || !/accounts 2,/.test(out)) fail('db-check output:\n' + out);
if (fs.existsSync(path.join(DATA_DIR, 'zatoka.db'))) fail('db-check made a database in the real folder');

// 3. First normal start: moved, checked, JSON untouched, nobody lost anything.
await boot();
if (!/copied .* and checked every one/.test(log) || !/copied 1 farms/.test(log)) fail('no move message');
if (sha('cozy-table.json') !== hashes.a || sha('pet-farm.json') !== hashes.f) fail('a JSON file was changed');
const ana2 = await player('Ana', ana.token).ready;
await until(() => ana2.me?.user === 'ana' && ana2.stats, 'ana back');
if (ana2.stats.visitors !== 3) fail('visitor count changed: ' + ana2.stats.visitors);
if (ana2.me.coins !== ana.me.coins) fail('coins changed');
if (!(await ana2.ask({ t: 'farm', a: { t: 'open' } }, 'farm')).farm) fail('farm lost');
const bo2 = await player('Bo', bo.token).ready; await until(() => bo2.room?.code === bo.room.code, 'table back');
const other = await player('Ana on a phone').ready; // logging in with the password still works
if (!(await other.ask({ t: 'login', user: 'ana', pass: 'pear12345' }, 'auth')).ok) fail('login after the move');
const gus = await player('Gus', guest.token).ready; await until(() => gus.stats, 'guest');
if (gus.stats.visitors !== 4) fail('a new phone should be one new visitor: ' + gus.stats.visitors); // the "phone" above
for (const p of [ana2, bo2, other, gus]) p.close();
await wait(1800); await stop();

// 4. Second start reads the database (not the JSON files) and everything is still there.
const saved = readSaved(DATA_DIR);
if (Object.values(saved.profiles).filter(p => p.user).length !== 2 || saved.visitors.length !== 4) fail('saved: ' + JSON.stringify({ n: Object.keys(saved.profiles).length, v: saved.visitors.length }));
if (Object.keys(readFarms(DATA_DIR).farms).length !== 1) fail('farm not saved');
fs.renameSync(path.join(DATA_DIR, 'cozy-table.json'), path.join(DATA_DIR, 'cozy-table.json.old')); // prove it isn't read
await boot();
if (!/from .*zatoka\.db/.test(log)) fail('did not load from the database');
const ana3 = await player('Ana', ana.token).ready; await until(() => ana3.me?.user === 'ana' && ana3.stats, 'ana again');
if (ana3.stats.visitors !== 4) fail('visitors after restart: ' + ana3.stats.visitors);
ana3.close(); await stop();
console.log('move to the database ok');

// 5. Saving with 50,000 saved players: one full save, then a save after a few players changed must be quick.
const BIG = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-big-'));
const res = execFileSync('node', ['--input-type=module', '-e', `
  const store = await import('./server/store.js');
  store.setRoomSource(() => []); store.load();
  for (let i = 0; i < 50000; i++) { const t = 't' + String(i).padStart(19, '0'); store.session(t, { name: 'P' + i }); const p = store.profileOf(t);
    p.games = 3; p.coins = 40; p.byGame = { hotpot: { games: 2, wins: 1, pts: 30 } }; p.owned = ['hat:2']; store.visit(t); }
  let t0 = performance.now(); store.saveNow(true); const full = performance.now() - t0;
  for (let k = 0; k < 3; k++) store.saveNow(); // let the rolling part settle
  for (let i = 0; i < 50; i++) store.profileOf('t' + String(i * 997).padStart(19, '0')).coins += 5;
  t0 = performance.now(); store.saveNow(); const small = performance.now() - t0;
  console.log(JSON.stringify({ full: Math.round(full), small: Math.round(small), visitors: store.visitorCount() }));
`], { env: { ...process.env, DATA_DIR: BIG }, encoding: 'utf8' });
const r = JSON.parse(res.trim().split('\n').at(-1));
console.log(`50,000 players: first full save ${r.full} ms, a save after 50 changes ${r.small} ms`);
if (r.small > 40) fail('a small save took ' + r.small + ' ms');
const back = readSaved(BIG);
if (Object.keys(back.profiles).length !== 50000 || back.visitors.length !== 50000) fail('big save incomplete');
if (Object.values(back.profiles).filter(p => p.coins === 45).length !== 50) fail('the 50 changed coins were not saved');
fs.rmSync(BIG, { recursive: true, force: true });
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('database ok');
process.exit(0);

// Host-only "Who's here" list: only ADMINS accounts get it, one row per person, with where they are and no addresses.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-who-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, ADMINS: 'Boss' }, stdio: 'inherit' });
await wait(700);
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, who: null, room: null };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') p.token = m.token;
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'who') p.who = m.list;
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, m.t); return p.auth; };
  p.list = async () => { p.who = null; p.send({ t: 'who' }); await until(() => p.who, 'who list'); return p.who; };
  return p;
}

const boss = await player('Kuba').connect(), ana = await player('Ana').connect(), guest = await player('Gus').connect();
if (boss.me.admin) fail('a guest is not a host');
if ((await boss.ask({ t: 'register', user: 'boss', pass: 'apple123' })).ok !== 'register') fail('register boss'); // ADMINS ignores case
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');
await until(() => boss.me.admin === true, 'host flag on me');
if (ana.me.admin) fail('ana is not a host');

// Not a host: no answer at all.
ana.send({ t: 'who' }); guest.send({ t: 'who' }); await wait(400);
if (ana.who || guest.who) fail('non-host got the list');

// Ana hosts a table, the guest goes to the farm, a second screen of Ana counts once.
ana.send({ t: 'create', game: 'hotpot' }); await until(() => ana.room, 'ana room');
guest.send({ t: 'where', v: 'farm' });
const ana2 = await player('Ana', ana.token).connect(); // same browser token takes over: still one row
await wait(300);
let list = await boss.list();
if (list.length !== 3) fail('three people ' + JSON.stringify(list));
const a = list.find(r => r.user === 'ana'), g = list.find(r => !r.user), b = list.find(r => r.user === 'boss');
if (!a || a.at.k !== 'table' || a.at.game !== 'hotpot' || a.at.code !== ana.room.code) fail('ana at her table ' + JSON.stringify(a));
if (!g || g.at.k !== 'farm' || g.name !== 'Gus') fail('guest on the farm ' + JSON.stringify(g));
if (!b || b.at.k !== 'hub') fail('boss on the hub ' + JSON.stringify(b));
if (list[0] !== a) fail('people at tables come first');
const raw = JSON.stringify(list);
if (raw.includes('127.0.0.1') || raw.includes(ana.token) || raw.includes(guest.token)) fail('list leaks an address or token');

// Odd "where" values fall back to the hub; leaving drops the row.
guest.send({ t: 'where', v: '<script>' }); await wait(200);
list = await boss.list();
if (list.find(r => !r.user).at.k !== 'hub') fail('unknown where value');
guest.ws.close(); await wait(300);
list = await boss.list();
if (list.length !== 2) fail('guest left ' + JSON.stringify(list));

ana2.ws.close(); boss.ws.close();
srv.kill(); await new Promise(r => srv.once('exit', r));
fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log('who ok');

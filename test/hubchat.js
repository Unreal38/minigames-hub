// Hub chat test: guests read but can't write, accounts can, text is cleaned and capped, limits hold,
// people at a table don't get hub lines, removing works, and the log survives a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-hc-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, ADMINS: 'mod' }, stdio: 'inherit' }); await wait(700); };
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, log: null, got: [], errs: [], gone: [] };
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
      if (m.t === 'hubchat') { if (m.log) p.log = m.log; if (m.msg) p.got.push(m.msg); if (m.err) p.errs.push(m.err); if (m.gone) p.gone.push(m.gone); }
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply to ' + m.t); return p.auth; };
  p.history = async () => { p.log = null; p.send({ t: 'hubchat' }); await until(() => p.log, 'chat history'); return p.log; };
  return p;
}

await start();
const guest = await player('Gus').connect();
const ana = await player('Ana').connect();
const bo = await player('Bo').connect();
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');
if ((await bo.ask({ t: 'register', user: 'mod', pass: 'apple123' })).ok !== 'register') fail('register mod');

// 1. Guests can read but not write.
if ((await guest.history()).length) fail('history should start empty');
guest.send({ t: 'hubchat', text: 'hi' });
await until(() => guest.errs.length, 'guest refused');
if (!/account/.test(guest.errs[0])) fail('guest error: ' + guest.errs[0]);

// 2. An account posts; every hub reader gets it, cleaned, with no pid.
ana.send({ t: 'hubchat', text: '  <img src=x onerror=alert(1)>‮​ hello\n\nall 👋🏽‍  ' + 'x'.repeat(400) });
await until(() => guest.got.length && ana.got.length && bo.got.length, 'everyone gets the line');
const line = guest.got[0];
if (line.pid !== undefined) fail('pid leaked');
if (/[‮​\n]/.test(line.text)) fail('invisible characters kept: ' + JSON.stringify(line.text));
if (!line.text.startsWith('<img src=x onerror=alert(1)> hello all 👋🏽')) fail('text cleaned wrongly: ' + line.text.slice(0, 60));
if ([...line.text].length !== 200) fail('length cap: ' + [...line.text].length);
if (line.name !== 'Ana' || line.user !== 'ana' || !line.lv || typeof line.fl !== 'object') fail('line fields ' + JSON.stringify(line).slice(0, 200));
if (line.own || line.del || !ana.got[0].own || !ana.got[0].del || bo.got[0].own || !bo.got[0].del) fail('own/del flags');
console.log('post ok');

// 3. Limits: a fast second line is refused, a repeat is refused, eight per half minute.
ana.send({ t: 'hubchat', text: 'again' });
await until(() => ana.errs.length, 'too fast');
await wait(1300); ana.errs = [];
ana.send({ t: 'hubchat', text: ana.got[0].text });
await until(() => ana.errs.length, 'repeat refused');
if (!/just said/.test(ana.errs[0])) fail('repeat error: ' + ana.errs[0]);
let sent = 1;
for (let i = 0; i < 9; i++) { await wait(1250); ana.send({ t: 'hubchat', text: 'line ' + i }); }
await wait(400);
sent = ana.got.length;
if (sent !== 8) fail('8 lines per 30s expected, got ' + sent);
console.log('limits ok');

// 4. Someone at a table doesn't get hub lines, but can read the history.
bo.send({ t: 'create', game: 'hotpot' });
await until(() => bo.room, 'bo at a table');
const before = bo.got.length;
guest.got = [];
await wait(1300);
const cara = await player('Cara').connect();
if ((await cara.ask({ t: 'register', user: 'cara', pass: 'apple123' })).ok !== 'register') fail('register cara');
cara.send({ t: 'hubchat', text: 'from cara' });
await until(() => guest.got.length, 'guest gets cara');
await wait(200);
if (bo.got.length !== before) fail('a player at a table got a hub line');
if ((await bo.history()).at(-1).text !== 'from cara') fail('history at a table');

// 5. Removing: not someone else's (unless moderator), yes your own.
const caraId = guest.got[0].id;
ana.send({ t: 'hubdel', id: caraId }); await wait(300);
if (guest.gone.length) fail('ana removed cara\'s line');
cara.send({ t: 'hubdel', id: caraId });
await until(() => guest.gone.includes(caraId), 'own removal');
const anaId = ana.got[1].id;
bo.send({ t: 'leave' }); await wait(200);
bo.send({ t: 'hubdel', id: anaId });
await until(() => guest.gone.includes(anaId), 'moderator removal');
const kept = (await guest.history()).length;
console.log('remove ok');

// 6. The log survives a restart.
srv.kill('SIGTERM'); await wait(500);
await start();
const back = await player('Gus', guest.token).connect();
if ((await back.history()).length !== kept) fail('history lost on restart');
srv.kill(); await wait(500);
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('hub chat ok');
process.exit(0);

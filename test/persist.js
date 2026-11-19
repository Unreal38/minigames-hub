// Persistence test: scoreboard, stats and accounts survive a server restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const boot = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };

function player(name, token) {
  const p = { name, msgs: [], room: null, s: undefined, me: null, token, id: null, auth: null };
  p.connect = () => new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => {};
    ws.onmessage = e => {
      const m = JSON.parse(e.data); p.msgs.push(m);
      if (m.t === 'welcome') { p.token = m.token; p.id = m.id; res(); }
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'me') { p.me = m.me; if (m.gain) p.gain = m.gain; }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'state') {
        p.s = m.s; const s = m.s;
        if (s && s.ph === 'play' && s.turn === s.me) {
          if (s.step === 'draw') p.send({ t: 'act', a: { t: 'deck' } });
          else p.send({ t: 'act', a: { t: 'disc', c: s.hand[Math.random() * s.hand.length | 0] } });
        }
      }
    };
  });
  return p;
}
const until = async (f, what, ms = 240000) => { const t0 = Date.now(); while (!f()) { await wait(100); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

await boot();
const a = player('Ana'), b = player('Bo');
await a.connect(); await b.connect();
if (a.me?.level !== 1 || a.me.xp !== 0) fail('fresh profile should be level 1');
a.send({ t: 'create', game: 'hotpot', opts: { bots: 'sharp', timer: 0 } });
await until(() => a.room, 'room');
const code = a.room.code;
b.send({ t: 'join', code });
await until(() => b.room?.players.length === 2, 'join');
a.send({ t: 'start' });
await until(() => a.s?.ph === 'end' && a.gain && b.gain && a.room.board.length === 2, 'game end + scoring');
const pts = a.s.res.map(r => r.pts);
const rowA = a.room.board.find(e => e.name === 'Ana'), rowB = a.room.board.find(e => e.name === 'Bo');
if (rowA.games !== 1 || rowA.pts !== pts[0] || rowB.pts !== pts[1]) fail('scoreboard points wrong ' + JSON.stringify(a.room.board));
if (a.room.board.some(e => e.pid)) fail('scoreboard leaks profile ids');
if (a.me.games !== 1 || a.me.xp < 15 || a.me.byGame.hotpot.games !== 1) fail('stats not credited ' + JSON.stringify(a.me));
console.log('scored', JSON.stringify(a.room.board.map(e => [e.name, e.wins, e.pts])), 'xp', a.me.xp, b.me.xp);

// accounts
a.send({ t: 'register', user: 'ana', pass: 'short' }); await until(() => a.auth, 'auth reply');
if (!a.auth.err) fail('short password accepted'); a.auth = null;
a.send({ t: 'register', user: 'Ana_1', pass: 'hunter22' }); await until(() => a.auth, 'register');
if (a.auth.err) fail('register failed: ' + a.auth.err); a.auth = null;
await until(() => a.me.user === 'Ana_1', 'me after register');
if (a.me.games !== 1) fail('register lost guest stats');
b.send({ t: 'register', user: 'ana_1', pass: 'hunter22' }); await until(() => b.auth, 'dup');
if (!b.auth.err) fail('duplicate username accepted'); b.auth = null;
const xpA = a.me.xp, idA = a.id;

// restart
await stop();
const raw = fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8');
if (raw.includes('hunter22')) fail('password stored in plain text');
a.room = b.room = null; a.s = b.s = undefined;
await boot();
await a.connect(); await b.connect();
await until(() => a.room && b.room && a.s === null, 'lobby restored');
if (a.room.code !== code || a.id !== idA || a.room.host !== idA) fail('lobby identity changed');
if (a.room.players.length !== 2 || a.room.board.length !== 2 || a.room.played !== 1) fail('lobby not restored ' + JSON.stringify(a.room));
if (a.room.board.find(e => e.name === 'Ana').pts !== pts[0]) fail('scoreboard lost');
if (a.me.xp !== xpA || a.me.user !== 'Ana_1' || a.me.games !== 1) fail('account stats lost');

// log in from another browser
const c = player('Cy'); await c.connect();
c.send({ t: 'login', user: 'ANA_1', pass: 'nope-nope' }); await until(() => c.auth, 'bad login');
if (!c.auth.err) fail('wrong password accepted'); c.auth = null;
c.send({ t: 'login', user: 'ANA_1', pass: 'hunter22' }); await until(() => c.auth, 'login');
if (c.auth.err) fail('login failed'); await until(() => c.me.user === 'Ana_1', 'me after login');
if (c.me.xp !== xpA || c.me.name !== 'Ana') fail('login did not bring stats');
c.send({ t: 'logout' }); await until(() => c.me.user === null, 'logout');
if (c.me.xp !== 0) fail('logout kept stats');
console.log('OK persistence, accounts, restart');
await stop(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); process.exit(0);

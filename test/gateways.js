// Connection helpers (GATEWAYS): pages still load through them, players connect and play, the per-address limit is
// counted across all helpers together, a helper that crashes is replaced and its players get back in, and a stop says
// goodbye to every screen (bye, then close 1012) before everything ends.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 24000 + (Math.random() * 800 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-gw-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let log = '';
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GATEWAYS: '2', WS_PER_IP: '6' }, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const fail = m => { console.error('FAIL', m, '\n--- server log ---\n' + log); srv.kill('SIGKILL'); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + (typeof what === 'function' ? what() : what)); } };
const helpers = () => { try { return fs.readFileSync(`/proc/${srv.pid}/task/${srv.pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean).map(Number); } catch { return []; } };
await until(() => /with 2 connection helpers/.test(log) && helpers().length === 2, 'two helpers start');
await wait(500);

// A page comes through a helper with the visitor's address (the language guess uses it) and the usual headers.
const page = await fetch(`http://127.0.0.1:${PORT}/`, { headers: { 'x-forwarded-for': '10.8.0.1' } });
const html = await page.text();
if (page.status !== 200 || !/<html/.test(html) || !page.headers.get('content-security-policy')) fail('page through a helper: ' + page.status);
if ((await fetch(`http://127.0.0.1:${PORT}/no-such-file.js`)).status !== 404) fail('missing file should be 404');

function player(name, ip, token) {
  const p = { name, token, in: false, closed: null, msgs: [] };
  const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { 'x-forwarded-for': ip } });
  p.send = m => ws.send(JSON.stringify(m));
  ws.onopen = () => p.send({ t: 'hello', token, name, color: '#ff8fab' });
  ws.onerror = () => {};
  ws.onclose = e => { p.closed = e.code; };
  ws.onmessage = e => { const m = JSON.parse(e.data); p.msgs.push(m); if (m.t === 'welcome') { p.in = true; p.token = m.token; } if (m.t === 'room') p.room = m.room; };
  return p;
}

// Two players at one table, on whichever helpers they land: chat reaches both, in order.
const a = player('Ana', '10.8.1.1'), b = player('Bo', '10.8.1.2');
await until(() => a.in && b.in, 'players get in');
a.send({ t: 'create', game: 'hotpot', priv: true, opts: {} }); await until(() => a.room, 'table');
b.send({ t: 'join', code: a.room.code }); await until(() => b.room?.code === a.room.code, 'join');
for (let i = 0; i < 6; i++) { a.send({ t: 'chat', text: 'hi ' + i }); await wait(520); } // chat allows one line per 0.5 s
const chats = p => p.msgs.filter(m => m.t === 'chat').map(m => m.msg?.text ?? m.text);
await until(() => chats(b).length >= 6 && chats(a).length >= 6, 'chat arrives');
if (chats(b).join() !== Array.from({ length: 6 }, (_, i) => 'hi ' + i).join()) fail('chat out of order: ' + chats(b).join());

// The per-address limit (6 here) counts connections on every helper together.
const many = Array.from({ length: 9 }, (_, i) => player('Same' + i, '10.8.2.2'));
await until(() => many.filter(p => p.in).length >= 6, 'six from one address get in'); await wait(1500);
if (many.filter(p => p.in).length !== 6) fail('per address: ' + many.filter(p => p.in).length + ' got in, expected 6');
for (const p of many) p.ws.close();
await wait(300);

// A helper crashes: it is replaced, and its players reconnect and find their table again.
const [first] = helpers();
process.kill(first, 'SIGKILL');
await until(() => /starting another/.test(log), 'crash noticed');
await until(() => helpers().length === 2 && !helpers().includes(first), 'helper replaced', 5000);
await wait(500);
const lost = [a, b].filter(p => p.closed !== null);
for (const p of lost) { const again = player(p.name, '10.8.1.9', p.token); await until(() => again.in && again.room?.code === a.room.code, 'back at the table after a helper crash'); again.ws.close(); }
console.log(`a helper crash dropped ${lost.length} of 2 players; they got back in`);

// Stopping: every screen hears goodbye (bye + 1012) through its helper, and the helpers end with the game process.
const c = player('Cy', '10.8.3.1'), d = player('Di', '10.8.3.2');
await until(() => c.in && d.in, 'last two in');
const kids = helpers();
srv.kill('SIGTERM');
await until(() => c.closed !== null && d.closed !== null, 'closed on stop');
for (const p of [c, d]) if (p.closed !== 1012 || !p.msgs.some(m => m.t === 'bye')) fail(`no goodbye for ${p.name}: ${p.closed}`);
await until(() => kids.every(k => !fs.existsSync(`/proc/${k}`)), 'helpers end with the server', 3000);
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('connection helpers ok');
process.exit(0);

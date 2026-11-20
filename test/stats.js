// Live player count + unique visitor count, and the visitor count surviving a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const boot = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function visit(token) {
  const p = { token, stats: null };
  p.ready = new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token, name: 'X', color: '#ff8fab' }));
    ws.onerror = () => {};
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') p.token = m.token; if (m.t === 'stats') { p.stats = m; res(); } };
  });
  p.close = () => p.ws.close();
  return p;
}

await boot();
const a = visit(); await a.ready;
if (a.stats.online !== 1 || a.stats.visitors !== 1) fail('first visit ' + JSON.stringify(a.stats));
const b = visit(); await b.ready;
await until(() => a.stats.online === 2 && a.stats.visitors === 2, 'a sees b arrive');
b.close();
await until(() => a.stats.online === 1, 'a sees b leave');
const b2 = visit(b.token); await b2.ready; // same browser coming back is not a new visitor
await until(() => a.stats.online === 2, 'b back online');
if (a.stats.visitors !== 2 || b2.stats.visitors !== 2) fail('returning visitor counted twice ' + JSON.stringify(a.stats));
a.close(); b2.close(); await wait(200);
await stop();

const saved = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8'));
if (saved.visitors?.length !== 2 || saved.visitors.includes(a.token)) fail('visitors not saved as hashes ' + JSON.stringify(saved.visitors));

await boot();
const c = visit(a.token); await c.ready;
if (c.stats.visitors !== 2 || c.stats.online !== 1) fail('after restart ' + JSON.stringify(c.stats));
const d = visit(); await d.ready;
if (d.stats.visitors !== 3) fail('new visitor after restart ' + JSON.stringify(d.stats));
c.close(); d.close();
await stop();
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('stats ok');

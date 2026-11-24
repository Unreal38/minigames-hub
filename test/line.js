// The waiting line: past MAX_ONLINE screens, newcomers wait their turn (and aren't counted as visitors yet), get in by
// themselves when a screen closes, first come first served. Someone who just dropped out gets straight back in.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 22800 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-line-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, MAX_ONLINE: '3' }, stdio: 'inherit' });
await wait(700);
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function visit(token, n) {
  const p = { token, in: false, queue: null, stats: null };
  const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { 'x-forwarded-for': `10.9.0.${n}` } });
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token, name: 'P' + n, color: '#ff8fab' }));
  ws.onerror = () => {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') { p.in = true; p.token = m.token; } if (m.t === 'queue') p.queue = m; if (m.t === 'stats') p.stats = m; };
  p.close = () => ws.close();
  return p;
}

const a = visit(null, 1), b = visit(null, 2), c = visit(null, 3);
await until(() => a.in && b.in && c.in, 'first three get in');
await wait(1200); // the line counts who is online once a second
const d = visit(null, 4); await until(() => d.queue, 'fourth waits');
const e = visit(null, 5); await until(() => e.queue, 'fifth waits');
if (d.queue.pos !== 1 || e.queue.pos !== 2) fail('places ' + JSON.stringify([d.queue, e.queue]));
await wait(1500);
if (d.in || e.in) fail('let in while full');
if (a.stats.visitors !== 3) fail('people in line counted as visitors: ' + a.stats.visitors);
b.close();
await until(() => d.in, 'first in line gets in when someone leaves', 4000);
await wait(1500);
if (e.in) fail('second in line jumped ahead');
await until(() => e.queue?.pos === 1, 'second in line moves up', 5000);
// a reload: the same browser comes straight back even while the site is full
c.close(); await wait(100);
const c2 = visit(c.token, 3); await until(() => c2.in, 'returning screen skips the line', 3000);
if (e.in) fail('a returning screen let a newcomer in too');
a.close(); await until(() => e.in, 'last one gets in', 4000);
await until(() => d.stats?.visitors === 5, 'everyone counted once they are in');

for (const p of [c2, d, e]) p.close();
srv.kill(); await wait(300);
fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log('waiting line ok');
process.exit(0);

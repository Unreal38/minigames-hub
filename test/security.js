// Security test: password change and recovery, host reset codes, login limits, broken requests and connection limits.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
const PORT = 19080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-sec-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' });
await wait(700);
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
const get = (p, headers = {}) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p, headers }, r => { r.resume(); r.on('end', () => res(r)); }).on('error', rej));

function player(name, token) {
  const p = { name, token, me: null, auth: null, errs: [], rooms: null };
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
      if (m.t === 'err') p.errs.push(m.msg);
      if (m.t === 'rooms') p.rooms = m.rooms;
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply to ' + m.t); return p.auth; };
  p.close = () => p.ws.close();
  return p;
}

// 1. A broken address used to throw inside the request handler and take the whole server down.
let r = await get('/%E0%A4%A');
if (r.statusCode !== 400) fail('bad url should be 400, got ' + r.statusCode);
r = await get('/');
if (r.statusCode !== 200) fail('server died after a bad url');
const csp = r.headers['content-security-policy'] || '';
if (!/script-src 'self' https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/ 'sha256-/.test(csp) || !csp.includes("frame-ancestors 'none'")) fail('page CSP missing: ' + csp);
if (r.headers['x-frame-options'] !== 'DENY') fail('x-frame-options missing');
if ((await get('/', { 'x-forwarded-proto': 'https' })).headers['strict-transport-security'] !== 'max-age=31536000') fail('HSTS missing behind https');
if ((await get('/../server/store.js')).statusCode === 200) fail('path traversal');
console.log('http ok');

// 1b. A page on another site may not open a game connection (the Origin must be this site).
const upgrade = origin => new Promise((res, rej) => {
  const q = http.request({ host: '127.0.0.1', port: PORT, path: '/ws', headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', ...(origin ? { origin } : {}) } });
  q.on('upgrade', (r, sock) => { sock.destroy(); res(r.statusCode); });
  q.on('response', r => { r.resume(); res(r.statusCode); });
  q.on('error', rej); q.end();
});
if (await upgrade('https://evil.example') !== 403) fail('a connection from another site was let in');
if (await upgrade(`http://127.0.0.1:${PORT}`) !== 101) fail('a connection from this site was turned away');
const { limitKey } = await import('../server/ws.js');
if (limitKey('2001:db8:1:2:aaaa::1') !== limitKey('2001:db8:1:2:bbbb::2') || limitKey('2001:db8:1:2::1') === limitKey('2001:db8:1:3::1')) fail('IPv6 addresses should count by /64');
if (limitKey('::ffff:10.0.0.1') !== '10.0.0.1') fail('IPv4 limit key changed');
console.log('origin + ipv6 ok');

// 2. Game names like "constructor" used to create a broken table that emptied the table list for everyone.
const a = await player('Ana "<b>"').connect();
if (a.me.name !== 'Ana ”b”') fail('name not cleaned: ' + a.me.name);
a.send({ t: 'create', game: 'constructor' }); a.send({ t: 'create', game: '__proto__' });
await wait(200); a.rooms = null; a.send({ t: 'rooms' });
await until(() => a.rooms, 'rooms list still works');
if (a.rooms.length) fail('a table was made for a fake game');
console.log('fake game ok');

// 3. Register hands out a recovery code; change password signs other devices out.
let m = await a.ask({ t: 'register', user: 'ana', pass: 'apple123' });
if (!m.ok || !/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(m.code || '')) fail('register should give a recovery code ' + JSON.stringify(m));
const code1 = m.code;
if (JSON.stringify(a.me).match(/hash|salt|"rc"/)) fail('me leaks secrets');
const a2 = await player('Ana phone').connect();
m = await a2.ask({ t: 'login', user: 'ana', pass: 'apple123' });
if (!m.ok || a2.me.user !== 'ana') fail('second device login');
m = await a.ask({ t: 'passwd', old: 'wrong', pass: 'banana123' });
if (!m.err) fail('password changed without the old one');
m = await a.ask({ t: 'passwd', old: 'apple123', pass: 'x' });
if (!m.err) fail('short new password accepted');
m = await a.ask({ t: 'passwd', old: 'apple123', pass: 'banana123' });
if (!m.ok) fail('password change ' + JSON.stringify(m));
await until(() => a2.me.user === null && a2.errs.some(e => /logged out/.test(e)), 'other device signed out');
if (a.me.user !== 'ana') fail('this device should stay signed in');
m = await a2.ask({ t: 'login', user: 'ana', pass: 'apple123' });
if (!m.err) fail('old password still works');
m = await a2.ask({ t: 'login', user: 'ana', pass: 'banana123' });
if (!m.ok) fail('new password does not work');
console.log('change password ok');

// 4. A new recovery code needs the password and replaces the old one.
m = await a.ask({ t: 'recode', pass: 'nope' });
if (!m.err) fail('recovery code without password');
m = await a.ask({ t: 'recode', pass: 'banana123' });
if (!m.ok || !m.code || m.code === code1) fail('new recovery code');
const code2 = m.code;

// 5. Forgot password: the old code is dead, the new one works once (in lower case with spaces too).
const b = await player('Someone').connect();
m = await b.ask({ t: 'recover', user: 'ana', code: code1, pass: 'cherry123' });
if (!m.err) fail('replaced recovery code still works');
m = await b.ask({ t: 'recover', user: 'ana', code: code2.toLowerCase().replace(/-/g, ' '), pass: 'cherry123' });
if (!m.ok || !m.code || b.me.user !== 'ana') fail('recover with code ' + JSON.stringify(m));
await until(() => a.me.user === null && a2.me.user === null, 'recover signs out every other device');
const code3 = m.code;
const c = await player('Other').connect();
m = await c.ask({ t: 'recover', user: 'ana', code: code2, pass: 'mallory1' });
if (!m.err) fail('a used recovery code worked again');
m = await c.ask({ t: 'login', user: 'ana', pass: 'cherry123' });
if (!m.ok) fail('login after recovery');
console.log('recovery code ok', code3 !== code2);

// 6. The host's reset code (npm run reset-password).
await wait(1800); // the account is on disk
const out = execFileSync('node', ['server/reset.js', 'ANA'], { env: { ...process.env, DATA_DIR } }).toString();
const reset = /Reset code for ana:\s+([A-Z2-9-]{14})/.exec(out)?.[1]; if (!reset) fail('reset script output: ' + out);
try { execFileSync('node', ['server/reset.js', 'nobody'], { env: { ...process.env, DATA_DIR }, stdio: 'pipe' }); fail('reset for unknown user'); } catch {}
await wait(3500); // the server picks the file up
if (fs.readdirSync(DATA_DIR).some(f => f.startsWith('reset-'))) fail('reset file left behind');
const d = await player('Ana again').connect();
m = await d.ask({ t: 'recover', user: 'ana', code: reset, pass: 'grape1234' });
if (!m.ok) fail('host reset code ' + JSON.stringify(m));
const e = await player('Late').connect();
m = await e.ask({ t: 'recover', user: 'ana', code: reset, pass: 'grape9999' });
if (!m.err) fail('host reset code worked twice');
console.log('host reset ok');
for (const p of [a, a2, b, c, d, e]) p.close();

// 7. Guessing passwords: wrong tries are limited per address, even across new connections.
let blockedAt = 0;
for (let i = 0; i < 4 && !blockedAt; i++) {
  const g = await player('Guess' + i).connect();
  for (let j = 0; j < 4 && !blockedAt; j++) { m = await g.ask({ t: 'login', user: 'ana', pass: 'guess' + i + j }); if (/15 minutes/.test(m.err)) blockedAt = i * 4 + j; }
  g.close();
}
// 10 wrong tries per address: 3 were used above (wrong current password, old password, wrong password for a new code)
if (blockedAt !== 7) fail('login limit should start after 10 wrong tries, got ' + (blockedAt + 3));
const g = await player('Real Ana').connect();
m = await g.ask({ t: 'login', user: 'ana', pass: 'grape1234' });
if (!/15 minutes/.test(m.err || '')) fail('still blocked even with the right password during an attack');
g.close();
console.log('login limit ok');

// 8. Flooding connections from one address: past 20 at once, new ones are turned away.
const socks = [];
for (let i = 0; i < 26; i++) { const w = new WebSocket(`ws://127.0.0.1:${PORT}/ws`); w.onerror = () => {}; socks.push(w); }
await wait(800);
const openN = socks.filter(w => w.readyState === 1).length;
if (openN > 20 || openN < 15) fail('connection cap: ' + openN + ' open');
for (const w of socks) w.close();
r = await get('/health'); if (r.statusCode !== 200) fail('server down after flood');
console.log('connection cap ok', openN);

srv.kill(); await new Promise(r => srv.once('exit', r)); fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log('security ok');
process.exit(0);

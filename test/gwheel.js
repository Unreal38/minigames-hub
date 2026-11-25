// The hub's Game wheel (Koło gier): what is on it and the saved wheels are kept with the profile (unknown games are
// dropped, bad shapes ignored), they come back after reconnecting and after a restart, and the wheel pays nothing.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 21880 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-gwheel-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async () => { srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off' }, stdio: 'inherit' }); await wait(800); };
const stop = () => new Promise(r => { srv.once('exit', r); srv.kill('SIGTERM'); });
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null };
  p.connect = () => new Promise((res, rej) => {
    let tries = 0;
    const go = () => {
      const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
      p.send = m => ws.send(JSON.stringify(m));
      ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
      ws.onerror = () => { if (++tries > 40) rej(new Error('ws error')); else setTimeout(go, 150); };
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') p.token = m.token; if (m.t === 'me') { p.me = m.me; res(p); } if (m.t === 'auth') p.auth = m; };
    };
    go();
  });
  return p;
}
const ask = async (p, m) => { p.auth = null; p.send(m); await until(() => p.auth, m.t); return p.auth; };
const again = async p => { p.ws.close(); p.me = null; await p.connect(); return p.me; };

await start();
const ana = await player('Ana').connect();
if (ana.me.gw !== null) fail('a new profile has no wheel yet ' + JSON.stringify(ana.me.gw));
const coins = ana.me.coins;
const good = { cur: ['kal', 'bierki', 'nope', 'kal'], n: 5, q: true, w: [{ n: '  Piątek <b>z</b> ekipą to bardzo długa nazwa ', g: ['dice', 'kart', 'hay'] }] };
ana.send({ t: 'gwheel', v: good });
await wait(300);
let gw = (await again(ana)).gw;
if (JSON.stringify(gw?.cur) !== '["kal","bierki"]') fail('unknown and repeated games are dropped ' + JSON.stringify(gw));
if (gw.n !== 5 || gw.q !== true) fail('filters kept ' + JSON.stringify(gw));
if (gw.w.length !== 1 || gw.w[0].n.length > 20 || /[<>]/.test(gw.w[0].n) || JSON.stringify(gw.w[0].g) !== '["dice","kart"]') fail('saved wheel cleaned ' + JSON.stringify(gw.w));

// bad shapes change nothing
for (const v of [null, 'x', { cur: 'kal', n: 0, w: [] }, { cur: [], n: 99, w: [] }, { cur: [], n: 0, w: Array(9).fill({ n: 'a', g: [] }) }, { cur: [], n: 0, w: [{ n: '   ', g: [] }] }]) ana.send({ t: 'gwheel', v });
await wait(300);
gw = (await again(ana)).gw;
if (JSON.stringify(gw.cur) !== '["kal","bierki"]' || gw.w.length !== 1) fail('bad messages must not change the wheel ' + JSON.stringify(gw));
if (ana.me.coins !== coins) fail('the wheel pays nothing');

// after a restart it is still there (an account: brand-new guests with nothing played are not kept, as before)
if (!(await ask(ana, { t: 'register', user: 'ana', pass: 'apple123' })).ok) fail('register');
await wait(300);
await stop(); await start();
gw = (await again(ana)).gw;
if (JSON.stringify(gw?.cur) !== '["kal","bierki"]' || gw.w[0]?.g.length !== 2) fail('wheel kept over a restart ' + JSON.stringify(gw));
await stop();
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('gwheel: ok');
process.exit(0);

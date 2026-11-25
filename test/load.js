// Load test: how many tables can one server carry? Not part of `npm test` (it takes a few minutes).
//   npm run load                      both scenarios with the default steps
//   LOAD_STEPS=10,50,100 npm run load  your own steps (number of tables)
//   LOAD_ONLY=kart npm run load        just one scenario (turns | kart)
// It starts its own server on a spare port with an empty temporary data folder, so it never touches real players or
// saved data, and it measures this machine. Run it on the real host for real numbers.
// Every fake player connects from its own made-up address (X-Forwarded-For from loopback, the way Caddy passes it),
// so the per-address limits don't stop the test.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTrack, newKart, stepKart, autoDrive } from '../public/games/kart/track.js';

const PORT = 20900 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-load-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const HOLD = +process.env.LOAD_HOLD || 15_000; // how long each step is measured
const HUB = +process.env.LOAD_HUB || 50;       // people idling on the hub, getting table list updates
const STEPS = {
  turns: (process.env.LOAD_STEPS || '25,100,250,500').split(',').map(Number),
  kart: (process.env.LOAD_STEPS || '10,20,40,80').split(',').map(Number),
};
const ONLY = process.env.LOAD_ONLY;

const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: ['ignore', 'ignore', 'inherit'] });
await wait(800);

// ---------- server process numbers (Linux /proc) ----------
const TICK = 100; // clock ticks per second on Linux
const cpuOf = () => { try { const f = fs.readFileSync(`/proc/${srv.pid}/stat`, 'utf8').split(') ')[1].split(' '); return (+f[11] + +f[12]) / TICK; } catch { return NaN; } };
const rssOf = () => { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${srv.pid}/status`, 'utf8'))[1] / 1024; } catch { return NaN; } };

// ---------- fake players ----------
let ipN = 0, msgs = 0, bytes = 0;
const all = [];
function player(name) {
  const n = ++ipN, ip = `10.${n >> 16 & 255}.${n >> 8 & 255}.${n & 255}`;
  const p = { name, id: null, room: null, s: null, onState: null };
  p.ready = new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { 'x-forwarded-for': ip } });
    p.send = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('could not connect (server full or refusing?)'));
    ws.onmessage = e => {
      msgs++; bytes += e.data.length;
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { p.id = m.id; res(p); }
      else if (m.t === 'room') p.room = m.room;
      else if (m.t === 'state') { p.s = m.s; p.onState?.(m.s); }
      else if (m.t === 'stats') p.onStats?.();
    };
  });
  all.push(p);
  return p;
}
const until = async (f, ms = 20_000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await wait(20); } return true; };

// A table: the first player hosts, the rest join by code, the host starts. Bots fill the empty seats.
async function table(game, humans, opts) {
  const ps = []; for (let i = 0; i < humans; i++) ps.push(player(`P${ipN + 1}`));
  await Promise.all(ps.map(p => p.ready));
  const [host] = ps;
  host.send({ t: 'create', game, opts });
  if (!await until(() => host.room)) throw new Error('table was not made');
  for (const p of ps.slice(1)) p.send({ t: 'join', code: host.room.code });
  await until(() => ps.every(p => p.room));
  host.send({ t: 'start' });
  return ps;
}

// Kart drivers behave like a browser: they drive their own kart with the real physics and report it ten times a second.
function drive(p) {
  let T = null, mk = null, last = 0;
  p.onState = s => { if (s?.track && (!T || T.id !== s.track)) { T = buildTrack(s.track); T.id = s.track; mk = null; } };
  p.timer = setInterval(() => {
    const s = p.s; if (!s || !T || s.ph !== 'play' || s.me < 0) return;
    if (s.stage !== 'race') { mk = null; return; }
    if (!mk) { const k = s.k[s.me]; mk = newKart(T, 0); Object.assign(mk, { x: k[0], z: k[1], h: k[3], v: 0 }); last = performance.now(); return; }
    const now = performance.now(), dt = Math.min(.25, (now - last) / 1000); last = now;
    const n = Math.ceil(dt * 60); for (let i = 0; i < n; i++) stepKart(T, mk, autoDrive(T, mk), dt / n);
    p.send({ t: 'act', a: { t: 'p', x: +mk.x.toFixed(2), z: +mk.z.toFixed(2), h: +mk.h.toFixed(3), v: +mk.v.toFixed(2), f: mk.fall > 0 ? 1 : 0 } });
  }, 100);
}

// The probe asks the server for a tiny reply four times a second. The time to answer is how long anyone's
// move would wait behind everything else the server is busy with (it runs on one thread).
const probe = player('Probe'); await probe.ready;
async function measure(label, extra) {
  const lat = []; let sent = 0;
  probe.onStats = () => { if (sent) lat.push(performance.now() - sent); sent = 0; };
  const t0 = performance.now(), c0 = cpuOf(), m0 = msgs, b0 = bytes;
  while (performance.now() - t0 < HOLD) {
    if (!sent) { sent = performance.now(); probe.send({ t: 'stats' }); }
    await wait(250);
  }
  const secs = (performance.now() - t0) / 1000, cpu = (cpuOf() - c0) / secs * 100;
  lat.sort((a, b) => a - b);
  const q = f => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * f))] : NaN;
  const playing = all.filter(p => p.s?.ph === 'play').length;
  const row = { step: label, playing, players: all.length - 1, cpu: Math.round(cpu) + '%', memMB: Math.round(rssOf()),
    'replyMs p50': +q(.5).toFixed(1), 'replyMs p99': +q(.99).toFixed(1), 'msgs/s out': Math.round((msgs - m0) / secs), 'MB/s out': +((bytes - b0) / secs / 1e6).toFixed(2), ...extra };
  console.log(JSON.stringify(row));
  return row;
}
const closeAll = async () => { for (const p of all.splice(1)) { clearInterval(p.timer); p.ws.close(); } await wait(2500); };

const results = [];
const hub = []; for (let i = 0; i < HUB; i++) hub.push(player('Hub' + i));
await Promise.all(hub.map(p => p.ready));
results.push(await measure('idle', { scenario: 'idle hub' }));

if (ONLY !== 'kart') {
  // Turn games: two people and bots at each table, a mix of Hot Pot, Ludo, Liar's Dice and Snakes & Ladders.
  const mix = ['hotpot', 'ludo', 'dice', 'ladders'];
  let made = 0;
  for (const n of STEPS.turns) {
    while (made < n) { const batch = []; for (let i = 0; i < 25 && made < n; i++, made++) batch.push(table(mix[made % mix.length], 2, { bots: 'sharp', timer: 20 })); await Promise.all(batch); }
    await wait(2000);
    results.push(await measure(`${n} turn tables`, { scenario: 'turns', tables: n }));
  }
  await closeAll();
  for (let i = 0; i < HUB; i++) { const p = player('Hub' + i); await p.ready; }
}
if (ONLY !== 'turns') {
  // Kart Island Race: eight people driving at every race.
  let made = 0;
  for (const n of STEPS.kart) {
    const batch = [];
    for (; made < n; made++) batch.push(table('kart', 8, { seats: 8, laps: 5 }).then(ps => ps.forEach(drive)));
    await Promise.all(batch);
    await wait(6000); // the countdown
    results.push(await measure(`${n} kart races`, { scenario: 'kart', tables: n }));
  }
}
console.table(results);
console.log(`machine: ${os.cpus().length} × ${os.cpus()[0]?.model}, ${Math.round(os.totalmem() / 1e9)} GB. The server uses one core: 100% cpu means it is full.`);
for (const p of all) { clearInterval(p.timer); p.ws.close(); }
srv.kill(); await wait(500);
fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
process.exit(0);

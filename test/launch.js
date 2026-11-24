// Launch-day load test: a crowd arriving at once, doing what real visitors do. Not part of `npm test`.
//   npm run load:launch                       steps of 250, 500, 1000, 2000 people
//   LAUNCH_STEPS=100,300 npm run load:launch  your own steps
// Like test/load.js it starts its own server on a spare port with an empty temporary data folder, so it never touches
// the live site, real players, saved data or the visitor count. Every fake person gets a made-up address.
// The crowd at each step:
//   60% sit on the hub (table list, live numbers, hub chat), 10% have accounts and chat on the hub every ~20 s,
//   10% have accounts and play Pet Farm (an action every ~4 s), 20% sit at tables (a mix of turn games with bots,
//   and chess against the bot). Hosts keep opening and closing public tables, which redraws everyone's table list.
// It also times a burst of brand-new arrivals (connect + hello + welcome) and a first page load over HTTP.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 21800 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-launch-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const HOLD = +process.env.LOAD_HOLD || 15_000;
const STEPS = (process.env.LAUNCH_STEPS || '250,500,1000,2000').split(',').map(Number);
const SERVER_ARGS = (process.env.SERVER_ARGS || '').split(' ').filter(Boolean);

const srv = spawn('node', [...SERVER_ARGS, 'server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: ['ignore', 'ignore', 'inherit'] });
await wait(1000);
const TICK = 100;
const cpuOf = () => { try { const f = fs.readFileSync(`/proc/${srv.pid}/stat`, 'utf8').split(') ')[1].split(' '); return (+f[11] + +f[12]) / TICK; } catch { return NaN; } };
// With connection helpers (GATEWAYS=3 npm run load:launch) they are child processes: their CPU is shown apart.
const kids = () => { try { return fs.readFileSync(`/proc/${srv.pid}/task/${srv.pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean); } catch { return []; } };
const kidCpu = () => kids().reduce((s, k) => { try { const f = fs.readFileSync(`/proc/${k}/stat`, 'utf8').split(') ')[1].split(' '); return s + (+f[11] + +f[12]) / TICK; } catch { return s; } }, 0);
const rssOf = () => { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${srv.pid}/status`, 'utf8'))[1] / 1024; } catch { return NaN; } };

let ipN = 0, msgs = 0, bytes = 0, errs = 0, states = 0, lists = 0;
const all = [];
// A fake person. Messages are only parsed while the person still waits for something (or for the probe), so this
// script stays light and the numbers are the server's, not the test's.
function person(name) {
  const n = ++ipN, ip = `10.${n >> 16 & 255}.${n >> 8 & 255}.${n & 255}`;
  const p = { name, id: null, room: null, wants: new Map(), timers: [] };
  p.ready = new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { 'x-forwarded-for': ip } });
    p.send = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    ws.onopen = () => p.send({ t: 'hello', name, color: '#7ab8ff' });
    ws.onerror = () => { errs++; rej(new Error('could not connect')); };
    ws.onclose = () => { p.closed = true; };
    ws.onmessage = e => {
      msgs++; bytes += e.data.length;
      if (e.data.startsWith('{"t":"state"')) states++; else if (e.data.startsWith('{"t":"rooms"')) lists++;
      if (p.id && !p.wants.size) return;
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { p.id = m.id; p.welcomeAt = performance.now(); res(p); }
      if (m.t === 'room') p.room = m.room;
      const w = p.wants.get(m.t); if (w) { p.wants.delete(m.t); w(m); }
    };
  });
  p.ready.catch(() => {});
  all.push(p);
  return p;
}
const next = (p, t, ms = 30_000) => new Promise(res => { p.wants.set(t, res); setTimeout(() => { if (p.wants.get(t) === res) { p.wants.delete(t); res(null); } }, ms); });
const every = (p, ms, f) => { setTimeout(() => p.timers.push(setInterval(f, ms)), Math.random() * ms); };

async function account(p) {
  const got = next(p, 'auth'); p.send({ t: 'register', user: 'ld' + p.name.toLowerCase(), pass: 'load-test-pass-123' });
  const r = await got; if (!r?.ok) throw new Error('could not register: ' + JSON.stringify(r));
}
async function hubber(i) {
  const p = person('Hub' + i); await p.ready;
  p.send({ t: 'hubchat' });
  every(p, 30_000, () => p.send({ t: 'stats' }));
  return p;
}
async function chatter(i) {
  const p = person('Chat' + i); await p.ready; await account(p);
  every(p, 20_000, () => p.send({ t: 'hubchat', text: `hello from ${p.name} ${Math.random().toString(36).slice(2, 7)}` }));
  return p;
}
async function farmer(i) {
  const p = person('Farm' + i); await p.ready; await account(p);
  p.send({ t: 'where', v: 'farm' });
  const got = next(p, 'farm'); p.send({ t: 'farm', a: { t: 'starter', sp: 'mossbun' } }); await got;
  every(p, 4000, () => p.send({ t: 'farm', a: { t: 'open' } }));
  return p;
}
const MIX = [['hotpot', 2], ['ludo', 2], ['dice', 2], ['poker', 2], ['makao', 2], ['bj', 2], ['chess', 1], ['bingo', 2]];
let tablesMade = 0;
async function table() {
  const [game, humans] = MIX[tablesMade++ % MIX.length];
  const ps = []; for (let i = 0; i < humans; i++) ps.push(person(`T${ipN + 1}`));
  await Promise.all(ps.map(p => p.ready));
  const [host] = ps; host.wants.set('_', () => {});
  host.send({ t: 'create', game, opts: { bots: 'sharp', timer: 20 } });
  const t0 = Date.now(); while (!host.room && Date.now() - t0 < 20_000) await wait(20);
  if (!host.room) throw new Error('table was not made');
  for (const p of ps.slice(1)) { p.wants.set('_', () => {}); p.send({ t: 'join', code: host.room.code }); }
  await wait(300);
  host.send({ t: 'start' });
  for (const p of ps) p.wants.clear();
  return ps;
}
// Hosts who open a public table, wait a few seconds and leave: every hub screen gets a new table list each time.
async function churner(i) {
  const p = person('Host' + i); await p.ready;
  every(p, 6000, async () => { p.send({ t: 'create', game: 'hotpot', opts: {} }); await wait(2500); p.send({ t: 'leave' }); });
  return p;
}

const probe = person('Probe'); await probe.ready;
async function measure(label, extra) {
  const lat = []; let sent = 0;
  const t0 = performance.now(), c0 = cpuOf(), k0 = kidCpu(), m0 = msgs, b0 = bytes, s0 = states, l0 = lists;
  while (performance.now() - t0 < HOLD) {
    sent = performance.now(); const got = next(probe, 'stats', 5000); probe.send({ t: 'stats' });
    if (await got) lat.push(performance.now() - sent); else lat.push(5000);
    await wait(250);
  }
  const secs = (performance.now() - t0) / 1000, cpu = (cpuOf() - c0) / secs * 100, helperCpu = (kidCpu() - k0) / secs * 100;
  lat.sort((a, b) => a - b);
  const q = f => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * f))] : NaN;
  const row = { step: label, open: all.filter(p => !p.closed).length - 1, cpu: Math.round(cpu) + '%', ...(kids().length ? { helpers: Math.round(helperCpu) + '% (' + kids().length + ')' } : {}), memMB: Math.round(rssOf()),
    'replyMs p50': +q(.5).toFixed(1), 'replyMs p99': +q(.99).toFixed(1), 'msgs/s out': Math.round((msgs - m0) / secs), 'MB/s out': +((bytes - b0) / secs / 1e6).toFixed(2), 'game states/s': Math.round((states - s0) / secs), 'table lists/s': Math.round((lists - l0) / secs), ...extra };
  console.log(JSON.stringify(row));
  return row;
}
// A burst of brand-new visitors: how long from opening the connection to the welcome.
async function burst(n) {
  const t0 = performance.now(), ps = [];
  for (let i = 0; i < n; i++) ps.push(person('New' + i));
  const ok = (await Promise.allSettled(ps.map(p => p.ready))).filter(r => r.status === 'fulfilled').map(r => r.value);
  const ms = ok.map(p => p.welcomeAt - t0).sort((a, b) => a - b);
  for (const p of ps) p.ws.close();
  return { burst: n, welcomed: ok.length, 'welcome p50 ms': Math.round(ms[ms.length >> 1] || NaN), 'welcome max ms': Math.round(ms.at(-1) || NaN) };
}

// A first visit over plain HTTP (what Caddy fetches from Node): the page and every file it pulls in on the hub.
async function pageWeight() {
  const seen = new Set(), queue = ['/'], base = `http://127.0.0.1:${PORT}`;
  let total = 0, files = 0;
  while (queue.length) {
    const u = queue.shift(); if (seen.has(u)) continue; seen.add(u);
    const r = await fetch(base + u); if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer()); total += buf.length; files++;
    if (/\.(js|html|css)$|\/$/.test(u)) {
      const txt = buf.toString('utf8');
      for (const m of txt.matchAll(/(?:from\s*|import\s*\(\s*|import\s+|href=|src=|url\()\s*['"]?(\.{0,2}\/[^'")\s>]+\.(?:js|css|woff2|png|svg))/g)) {
        const abs = new URL(m[1], base + u).pathname; if (!seen.has(abs)) queue.push(abs);
      }
    }
  }
  return { files, MB: +(total / 1e6).toFixed(2) };
}

const results = [];
const weight = await pageWeight();
console.log('first visit (uncompressed, from Node):', JSON.stringify(weight));
results.push(await measure('empty', {}));
let have = { hub: 0, chat: 0, farm: 0, table: 0, churn: 0 };
for (const n of STEPS) {
  const want = { hub: Math.round(n * .6), chat: Math.round(n * .1), farm: Math.round(n * .1), table: Math.round(n * .2 / 1.9), churn: Math.max(1, Math.round(n / 100)) };
  const jobs = [];
  for (; have.hub < want.hub; have.hub++) { const i = have.hub; jobs.push(() => hubber(i)); }
  for (; have.chat < want.chat; have.chat++) { const i = have.chat; jobs.push(() => chatter(i)); }
  for (; have.farm < want.farm; have.farm++) { const i = have.farm; jobs.push(() => farmer(i)); }
  for (; have.table < want.table; have.table++) jobs.push(() => table());
  for (; have.churn < want.churn; have.churn++) { const i = have.churn; jobs.push(() => churner(i)); }
  const t0 = performance.now();
  for (let i = 0; i < jobs.length; i += 50) await Promise.all(jobs.slice(i, i + 50).map(j => j().catch(e => { errs++; if (errs < 8) console.error(e.message); })));
  const arrive = Math.round(performance.now() - t0);
  await wait(3000);
  results.push(await measure(`${n} people`, { 'arrived in ms': arrive, errors: errs }));
}
const b = await burst(300);
console.log('burst of new visitors while full:', JSON.stringify(b));
console.table(results);
console.log(`machine: ${os.cpus().length} × ${os.cpus()[0]?.model}, ${Math.round(os.totalmem() / 1e9)} GB. The server uses one core: 100% cpu means it is full.`);
for (const p of all) { for (const t of p.timers) clearInterval(t); try { p.ws.close(); } catch {} }
srv.kill(); await wait(500);
fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
process.exit(0);

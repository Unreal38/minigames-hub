// Seat counts: every game's waiting room, open tables row, hub card and the game itself must agree on how many
// seats a table has, and a host can pick the exact count (so friends can play without a bot) unless the rules fix it.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seatChoices, seatKey, cleanSeats, tableSize } from '../server/seats.js';

let bad = 0;
const fail = m => { console.error('FAIL', m); bad++; };

// ----- the server's games -----
const src = fs.readFileSync('server/server.js', 'utf8');
const files = Object.fromEntries([...src.matchAll(/^import \* as (\w+) from '\.\/games\/(\w+)\.js';/gm)].map(m => [m[1], m[2]]));
const ids = src.match(/^const GAMES = \{([^}]+)\}/m)[1].split(',').map(s => s.trim()).filter(Boolean);
if (ids.length < 30) fail(`only ${ids.length} games found in server.js`);
const GAMES = {};
for (const id of ids) GAMES[id] = await import(`../server/games/${files[id]}.js`);

const people = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffb547', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'][i], av: [i] }));
const realNow = Date.now;
for (const id of ids) {
  const mod = GAMES[id], meta = mod.meta, ch = seatChoices(meta), k = seatKey(meta);
  if (meta.id !== id) fail(`${id}: meta.id is ${meta.id}`);
  if (meta.minHumans) { if (meta.seats) fail(`${id}: a game without bots has no seat count to pick`); continue; }
  if (!meta.seats) { fail(`${id}: meta.seats missing (see server/seats.js)`); continue; }
  if (!ch.length || ch[0] < 1 || ch.at(-1) > meta.maxPlayers) fail(`${id}: seat choices ${ch} outside 1..${meta.maxPlayers}`);
  if (!ch.includes(cleanSeats(meta, undefined))) fail(`${id}: default seat count is not one of the choices`);
  // a range covers every count: no gaps, so a host can always match the people at the table
  if (meta.seats.lo && ch.some((n, i) => i && n !== ch[i - 1] + 1)) fail(`${id}: gaps in ${ch}`);
  if (meta.seats.lo && ch.at(-1) !== meta.maxPlayers) fail(`${id}: seat choices stop at ${ch.at(-1)}, the game takes ${meta.maxPlayers}`);
  for (const n of ch) {
    if (mod.cleanOpts && !meta.seats.fixed) { const o = mod.cleanOpts({ [k]: n }); if (+o[k] !== n) fail(`${id}: cleanOpts turns ${k} ${n} into ${o[k]}`); }
    const opts = { ...(mod.cleanOpts ? mod.cleanOpts({ [k]: n }) : {}), [k]: n, timer: 0 };
    for (let h = 1; h <= meta.maxPlayers; h++) {
      let G;
      try { Date.now = () => realNow(); G = mod.create(people(h), opts, null); } catch (e) { fail(`${id}: create with ${h} people at ${n} seats threw ${e.message}`); continue; } finally { Date.now = realNow; }
      const want = tableSize(meta, opts, h), got = G.seats.length, bots = G.seats.filter(s => s.bot).length;
      if (got !== want) fail(`${id}: ${h} people at a ${n}-seat table: the game has ${got} seats, the waiting room shows ${want}`);
      if (bots !== Math.max(0, want - h)) fail(`${id}: ${h} people at ${n} seats got ${bots} bots`);
    }
  }
}

// ----- the browser side: one seat count for every game, hub cards say the right range -----
const app = fs.readFileSync('public/app.js', 'utf8');
const reg = app.slice(app.indexOf('  hotpot: {'), app.indexOf('  rk: {}, rkTab'));
if (/\bseats: (?:r|\(\)) =>/.test(reg)) fail('a game in app.js still counts its own seats: the waiting room must use the server\'s room.size');
if (/pill\('seats'/.test(reg)) fail('a game in app.js still draws its own seat pills: they come from seatOptHtml');
if (!/max = r\.size \|\| r\.max/.test(app)) fail('the waiting room does not draw room.size seats');
if (!/Array\.from\(\{ length: tableSeats\(r\) \}/.test(app)) fail('the open tables row does not draw the table\'s seats');
const hub = app.split('const HUB_GAMES = [')[1].split('].filter(')[0];
for (const m of hub.matchAll(/^\s*\['(\w+)', '[^']*', \w+, '[^']*', '([^']*)'/gm)) {
  const [, id, chip] = m, meta = GAMES[id]?.meta;
  if (!meta) { fail(`hub card ${id} has no server game`); continue; }
  const want = `${meta.minHumans || 1}–${meta.maxPlayers}`;
  if (!chip.includes(want)) fail(`${id}: hub card says "${chip}", the game takes ${want}`);
}

// ----- a live server: what the waiting room and the open tables list are sent -----
const PORT = 19400 + (Math.random() * 500 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-seats-'));
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off' }, stdio: ['ignore', 'ignore', 'inherit'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) { fail('timeout: ' + what); return false; } } return true; };
function player(name) {
  const p = { name, room: null, rooms: [] };
  p.connect = () => new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: '', name, color: '#ff8fab' });
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') p.id = m.id; if (m.t === 'me') res(p); if (m.t === 'room') p.room = m.room; if (m.t === 'rooms') p.rooms = m.rooms; };
  });
  return p;
}
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/health`); break; } catch { await wait(100); } }
  const [a, b, c, d, e] = await Promise.all(['Ana', 'Bo', 'Cy', 'Dee', 'Eve'].map(n => player(n).connect())); // Eve only looks at the open tables
  // Snakes & Ladders used to offer only 2, 4 or 6: three friends got a bot. Now 3 is a choice.
  a.send({ t: 'create', game: 'ladders', opts: { seats: 3 } });
  await until(() => a.room, 'create');
  const code = a.room.code;
  if (a.room.size !== 3 || String(a.room.choices) !== '2,3,4,5,6') fail(`ladders table: size ${a.room.size}, choices ${a.room.choices}`);
  await until(() => e.rooms.some(r => r.code === code), 'table in the open list');
  const row = () => e.rooms.find(r => r.code === code);
  if (row().size !== 3 || row().max !== 6) fail(`open tables row: size ${row().size}, max ${row().max}`);
  for (const p of [b, c, d]) { p.send({ t: 'join', code }); await until(() => p.room?.code === code, p.name + ' joins'); }
  // a fourth person at a 3-seat table: the seat count grows with them, everywhere
  await until(() => a.room.players.length === 4 && a.room.size === 4 && +a.room.opts.seats === 4, 'seat count grows to 4');
  await until(() => row()?.size === 4 && row().n === 4, 'open list shows 4 of 4');
  // the host can't pick fewer seats than people sitting down
  a.send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
  if (a.room.size !== 4) fail(`host picked 2 seats with 4 people: size ${a.room.size}`);
  d.send({ t: 'leave' }); await until(() => a.room.players.length === 3, 'Dee leaves');
  a.send({ t: 'opts', opts: { seats: 3 } });
  await until(() => a.room.size === 3, 'host picks 3');
  a.send({ t: 'start' });
  await until(() => a.room.state === 'play', 'start');
  // chess stays two: the rules fix it
  d.send({ t: 'create', game: 'chess', opts: {} });
  await until(() => d.room?.game === 'chess', 'chess table');
  if (d.room.size !== 2 || String(d.room.choices) !== '2') fail(`chess table: size ${d.room.size}, choices ${d.room.choices}`);
} finally { srv.kill(); }

if (bad) { console.error(`${bad} seat count problems`); process.exit(1); }
console.log('seats ok');

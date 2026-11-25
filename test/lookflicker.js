// Kuba's report (2026-11-24): while a host dressed up in the Wardrobe, the waiting room (table code, seats) kept
// blinking for everyone at the table. The client now patches the waiting room instead of rebuilding it
// (public/morph.js); here the server side: a look save that changes nothing sends no table update, a real change
// sends one, and the hub's open table catches up with the host's new avatar, at most once every two seconds.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 21700 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-look-'));
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off' }, stdio: ['ignore', 'ignore', 'inherit'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
await wait(700);

function player(name) {
  const p = { name, room: null, rooms: null, n: {} };
  p.connect = () => new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: '', name, color: '#ff8fab' });
    ws.onmessage = e => {
      const m = JSON.parse(e.data); p.n[m.t] = (p.n[m.t] || 0) + 1;
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'rooms') p.rooms = m.rooms;
      if (m.t === 'me') { p.me = m.me; res(p); }
    };
  });
  return p;
}
const [host, guest, hub] = await Promise.all(['Hosty', 'Guesty', 'Watcher'].map(n => player(n).connect()));
host.send({ t: 'create', game: 'ttt', opts: {} });
await until(() => host.room, 'create');
guest.send({ t: 'join', code: host.room.code });
await until(() => host.room.players.length === 2 && guest.room, 'join');
await wait(300);

const look = { name: 'Hosty', color: host.me.color, av: host.me.av };
const zero = () => { for (const p of [host, guest, hub]) p.n = {}; };

// 1. Saving the same look again: the host gets its 'me' back, nobody gets a table update.
zero(); host.send({ t: 'profile', ...look }); await wait(400);
if (host.n.me !== 1) fail('the saver still gets its me back');
if (guest.n.room || host.n.room) fail(`an unchanged look sent table updates (${guest.n.room | 0})`);

// 2. Five real changes in a row: one table update each, and the hub hears about it once.
zero();
const colours = ['#5b8def', '#ffb347', '#7bd389', '#c39bd3', '#ff6f61'];
for (const c of colours) { host.send({ t: 'profile', ...look, color: c }); await wait(120); }
await until(() => guest.room.players.find(p => p.name === 'Hosty')?.color === '#ff6f61', 'guest sees the last colour');
if (guest.n.room !== colours.length) fail(`expected ${colours.length} table updates, got ${guest.n.room | 0}`);
await wait(2300);
if (hub.n.rooms !== 1) fail(`the hub should get one table list update, got ${hub.n.rooms | 0}`);
if (hub.rooms?.[0]?.hostColor !== '#ff6f61') fail('the hub table shows the host\'s new look');

console.log('look saves: no table update when nothing changed, one per change, hub throttled');
srv.kill(); process.exit(0);

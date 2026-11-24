// Rejoin test: someone who leaves a game in progress (the Leave button, or a second device on the same account)
// gets their own seat back when they return, instead of watching while a bot plays it or taking another player's seat.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 18700 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-rejoin-'));
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off' }, stdio: ['ignore', 'inherit', 'inherit'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
await wait(700);

function player(name) {
  const p = { name, token: '', id: null, room: null, s: null, auth: null, me: null, errs: [] };
  p.connect = () => new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { p.token = m.token; p.id = m.id; }
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'room') { p.room = m.room; if (!m.room) p.s = null; }
      if (m.t === 'state') p.s = m.s;
      if (m.t === 'err') p.errs.push(m.msg);
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply to ' + m.t); return p.auth; };
  return p;
}
const watching = p => p.room?.players.find(x => x.id === p.id)?.watch;
const [ana, bo, cy, dee] = await Promise.all(['Ana', 'Bo', 'Cy', 'Dee'].map(n => player(n).connect()));
for (const [p, u] of [[ana, 'ana'], [bo, 'bob'], [cy, 'cyd'], [dee, 'dee']]) if ((await p.ask({ t: 'register', user: u, pass: 'apple123' })).ok !== 'register') fail('register ' + u);

// A Mango table with four people and two bots, long turn timer so nothing moves on its own while we look.
ana.send({ t: 'create', game: 'poker', opts: { variant: 'mango', field: 6, timer: 45 } });
await until(() => ana.room, 'create');
for (const p of [bo, cy, dee]) p.send({ t: 'join', code: ana.room.code });
await until(() => ana.room.players.length === 4, 'joins');
ana.send({ t: 'start' });
await until(() => [ana, bo, cy, dee].every(p => p.s?.ph === 'play'), 'start');
const seatOf = p => p.s.me, boSeat = seatOf(bo), cySeat = seatOf(cy);

// 1. Bo and Cy both press Leave. Their seats go to bots.
bo.send({ t: 'leave' }); cy.send({ t: 'leave' });
await until(() => ana.s.seats[boSeat].human === false && ana.s.seats[cySeat].human === false, 'seats botted');
if (!/\(bot\)/.test(ana.s.seats[boSeat].name)) fail('left seat should read (bot)');

// 2. Cy comes back first: Cy gets Cy's seat, not Bo's (Bo's has the same chips, so the old code could pick either).
cy.send({ t: 'join', code: ana.room.code });
await until(() => cy.s?.me >= 0, 'cy back in a seat');
if (cy.s.me !== cySeat) fail(`cy got seat ${cy.s.me}, expected own seat ${cySeat}`);
if (watching(cy)) fail('cy should not be a watcher');
if (cy.s.seats[cySeat].name !== 'Cy' || cy.s.seats[cySeat].bot || !cy.s.seats[cySeat].human) fail('cy seat not restored: ' + JSON.stringify(cy.s.seats[cySeat]));
if (ana.s.seats[boSeat].human) fail("bo's seat should still wait for bo");

// 3. Bo comes back on a different device (new browser, same account): Bo's seat again.
const bo2 = await player('Bo').connect();
if ((await bo2.ask({ t: 'login', user: 'bob', pass: 'apple123' })).ok !== 'login') fail('bo second device login');
bo2.send({ t: 'join', code: ana.room.code });
await until(() => bo2.s?.me >= 0, 'bo back in a seat');
if (bo2.s.me !== boSeat) fail(`bo got seat ${bo2.s.me}, expected ${boSeat}`);

// 4. Dee's phone drops; Dee opens the table on a laptop (same account). The seat moves to the laptop: no second
// "Dee" seat, no away copy left behind, and the phone leaves the table.
const deeSeat = seatOf(dee);
const dee2 = await player('Dee').connect();
if ((await dee2.ask({ t: 'login', user: 'dee', pass: 'apple123' })).ok !== 'login') fail('dee second device login');
dee2.send({ t: 'join', code: ana.room.code });
await until(() => dee2.s?.me >= 0, 'dee seat moved to the laptop');
if (dee2.s.me !== deeSeat) fail('dee got a different seat');
if (dee2.s.seats.filter(x => x.id === dee.id || x.id === dee2.id).length !== 1) fail('dee should hold exactly one seat');
if (ana.room.players.some(x => x.id === dee.id)) fail('the old device should have left the table');
await until(() => !dee.room, 'old device sent back to the hub');

// 5. A newcomer who asks for a seat still waits for the next hand and never gets someone's seat while they are away.
const eli = await player('Eli').connect();
eli.send({ t: 'join', code: ana.room.code });
await until(() => watching(eli), 'newcomer watches');
const humans = ana.s.seats.filter(x => x.human).length;
if (humans !== 4) fail('expected the four players back in their seats, got ' + humans);

console.log('rejoin ok');
srv.kill(); process.exit(0);

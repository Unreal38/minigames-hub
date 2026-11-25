// Marble Rush test: runs whole races on a fake clock, then checks a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as mb from '../server/games/marbles.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

function race(opts, prev) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const G = mb.create(players, opts, prev);
    if (mb.act(G, 0, { t: 'bet', m: 1 }) !== true) fail('bet refused');
    if (mb.act(G, 0, { t: 'bet', m: 99 })) fail('bet on a missing marble accepted');
    if (mb.act(G, 0, { t: 'sab', m: 1 })) fail('banana before the race accepted');
    if (mb.act(G, 0, { t: 'ready' })) fail('race started before everyone bet');
    now += 60_000; mb.tick(G, now);
    if (G.stage !== 'bet') fail('betting closed while a player had not bet');
    if (mb.act(G, 1, { t: 'bet', m: 0 }) !== true || mb.act(G, 0, { t: 'ready' }) !== true) fail('could not start once everyone bet');
    let threw = false;
    for (let i = 0; i < 40000 && G.ph === 'play'; i++) {
      now += 150; mb.tick(G, now);
      if (!threw && G.stage === 'race' && G.simT > 2) { threw = true; if (!mb.act(G, 0, { t: 'sab', m: 1 })) fail('banana refused'); if (mb.act(G, 0, { t: 'sab', m: 2 })) fail('second banana accepted'); }
      for (const m of G.m) if (![m.s, m.u, m.vs, m.vu].every(Number.isFinite)) fail('marble left the track');
    }
    if (G.ph !== 'end') fail('race did not end');
    const n = G.m.length, v = mb.view(G, 0);
    if (n !== (opts.field || 6) || v.marbles.length !== n || G.seats.length !== 4) fail('wrong number of marbles or bettors');
    if (v.marbles.some(m => 'id' in m || 'av' in m)) fail('marbles should be neutral colours');
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win) fail('bad final order');
    const wonBet = G.win === 1;
    if (G.res.pay[0].won !== wonBet) fail('wrong win flag');
    const r = mb.results(G);
    if (r[0].win !== wonBet || r.filter(x => x.win).length !== G.res.pay.filter(x => x.won).length) fail('wins should follow winning picks');
    JSON.stringify(mb.view(G, -1));
    return G;
  } finally { Date.now = realNow; }
}

// Coin farming guards (Kuba, 2026-11-24): a pick stakes no coins and pays placement coins by where the colour
// finishes; each marble takes one banana per heat, and none on the second half of the track.
{
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const four = [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2, 2, 2, 2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3, 3, 3, 3] }];
    const G = mb.create(four, { field: 8, seats: 4, chaos: 'off' });
    for (const s of [0, 1]) mb.act(G, s, { t: 'bet', m: 0 });
    mb.act(G, 2, { t: 'bet', m: 1 }); mb.act(G, 3, { t: 'bet', m: 2 });
    mb.act(G, 0, { t: 'ready' });
    for (let i = 0; i < 400 && G.stage !== 'race'; i++) { now += 100; mb.tick(G, now); }
    for (let i = 0; i < 30; i++) { now += 100; mb.tick(G, now); }
    const free = G.m.findIndex((m, i) => i > 2 && m.st === 0 && !m.place);
    if (!mb.act(G, 0, { t: 'sab', m: free })) fail('first banana on a marble refused');
    if (mb.act(G, 1, { t: 'sab', m: free })) fail('a second banana on the same marble was accepted');
    const far = G.m.findIndex((m, i) => i !== free && m.st === 0 && !m.place);
    G.m[far].s = G.track.L * .6;
    if (mb.act(G, 2, { t: 'sab', m: far })) fail('a banana on the second half of the track was accepted');
    for (let i = 0; i < 40000 && G.ph === 'play'; i++) { now += 150; mb.tick(G, now); }
    const r = mb.results(G);
    if (r.some(x => 'coinNet' in x || x.of !== 8)) fail('picks should stake nothing and pay by place out of 8');
    for (let s = 0; s < 4; s++) if (r[s].place !== G.res.order.indexOf(G.bets[s].m) + 1) fail('place should be where the pick finished');
    if (r[0].place !== r[1].place) fail('two people on one colour share its place');
  } finally { Date.now = realNow; }
  console.log('farming guards: ok');
}

const c = race({ mode: 'classic', field: 6 });
console.log('classic: winner', c.marbles[c.win].name, 'in', c.m[c.win].fin.toFixed(1), 's');
const k = race({ mode: 'knockout', field: 4, chaos: 'off' }, c);
if (k.heat !== 3) fail(`knockout with 4 marbles should take 3 heats, took ${k.heat}`);
console.log('knockout: winner', k.marbles[k.win].name, 'after', k.heat, 'heats');

// over the wire
const PORT = 19080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1' }, stdio: 'inherit' });
const bail = m => { srv.kill(); fail(m); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null;
const send = m => ws.send(JSON.stringify(m));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') room = m.room; if (m.t === 'state') state = m.s; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'marbles', opts: { mode: 'knockout', field: 4, bots: 'sharp' } });
await wait(300);
if (room?.game !== 'marbles' || room.opts.mode !== 'knockout' || room.opts.field !== 4 || 'bots' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { field: 8 } }); await wait(200);
if (room.opts.field !== 8 || room.opts.mode !== 'knockout') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.stage !== 'bet' || state.marbles.length !== 8 || state.seats.length !== 4) bail('race did not open for betting');
send({ t: 'act', a: { t: 'bet', m: 3 } }); await wait(200);
if (state.seats[state.me].bet?.m !== 3) bail('pick missing');
send({ t: 'act', a: { t: 'ready' } }); await wait(4500);
if (state.stage !== 'race' || !state.frames.length) bail('race did not start');
console.log('OK');
srv.kill(); process.exit(0);

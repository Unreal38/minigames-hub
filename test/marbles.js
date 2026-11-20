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
    if (mb.act(G, 0, { t: 'bet', m: 1, amt: 25 }) !== true) fail('bet refused');
    if (mb.act(G, 0, { t: 'bet', m: 99, amt: 25 })) fail('bet on a missing marble accepted');
    if (mb.act(G, 1, { t: 'bet', m: 0, amt: 7 })) fail('odd stake accepted');
    if (mb.act(G, 0, { t: 'sab', m: 1 })) fail('banana before the race accepted');
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
    if (Object.values(G.wallet).some(c => !Number.isFinite(c) || c < 0)) fail('bad wallet');
    const p = G.res.pay[0], wonBet = G.win === 1;
    if (p.won !== (wonBet ? 25 * n : 0)) fail('wrong payout');
    if (v.seats[0].coins !== p.coins) fail('view and wallet disagree');
    const r = mb.results(G);
    if (r[0].win !== wonBet || r.filter(x => x.win).length !== G.res.pay.filter(x => x.won > 0).length) fail('wins should follow winning bets');
    JSON.stringify(mb.view(G, -1));
    return G;
  } finally { Date.now = realNow; }
}

const c = race({ mode: 'classic', field: 6 });
console.log('classic: winner', c.marbles[c.win].name, 'in', c.m[c.win].fin.toFixed(1), 's');
const k = race({ mode: 'knockout', field: 4, chaos: 'off' }, c);
if (k.heat !== 3) fail(`knockout with 4 marbles should take 3 heats, took ${k.heat}`);
if (k.wallet['h:a'] === undefined) fail('coins did not carry over');
console.log('knockout: winner', k.marbles[k.win].name, 'after', k.heat, 'heats');

// over the wire
const PORT = 19080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1' }, stdio: 'inherit' });
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
send({ t: 'act', a: { t: 'bet', m: 3, amt: 'all' } }); await wait(200);
if (state.seats[state.me].bet?.amt !== 100) bail('all-in bet missing');
send({ t: 'act', a: { t: 'ready' } }); await wait(4500);
if (state.stage !== 'race' || !state.frames.length || state.seats[state.me].coins !== 0) bail('race did not start');
console.log('OK');
srv.kill(); process.exit(0);

// Coins and the avatar shop: back pay for old profiles, Pet Farm coins moving into the account, buying, and
// paid items coming off anyone who has not bought them.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AV_KEYS, OPT, priceOf, cleanAv, seasonOn } from '../public/avatar.js';
const PORT = 19080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };

// An old save: a profile from before coins (10 games, 2 wins) with a farm that still holds 40 farm coins.
const TOKEN = 'a'.repeat(24), PID = 'p1';
fs.writeFileSync(path.join(DATA_DIR, 'cozy-table.json'), JSON.stringify({ v: 1, profiles: { [PID]: { pid: PID, user: 'ana', name: 'Ana', color: '#ff8fab', av: null, xp: 300, games: 10, wins: 2, pts: 50, byGame: {} } },
  sessions: { [TOKEN]: { id: 'abc', pid: PID, seen: Date.now() } }, rooms: [] }));
fs.writeFileSync(path.join(DATA_DIR, 'pet-farm.json'), JSON.stringify({ v: 1, farms: { [PID]: { v: 1, size: 8, nid: 2, items: [], pets: [], inv: { wood: 5, coins: 40 } } } }));
const boot = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, SHOP_DATE: '2026-12-10' }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };

function player(token, av) {
  const p = { msgs: [], me: null, room: null };
  p.connect = () => new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token, name: 'Ana', color: '#ff8fab', av });
    ws.onmessage = e => { const m = JSON.parse(e.data); p.msgs.push(m); if (m.t === 'welcome') res(); if (m.t === 'me') p.me = m.me; if (m.t === 'room') p.room = m.room; if (m.t === 'farm') p.farm = m.farm; };
  });
  return p;
}
const HAT = AV_KEYS.indexOf('hat'), party = OPT.hat.indexOf('Party hat'), halo = OPT.hat.indexOf('Halo');
const look = h => { const a = AV_KEYS.map(() => 0); a[HAT] = h; return a; };

await boot();
const a = player(TOKEN, look(halo)); await a.connect(); await wait(300);
const want = 10 * 5 + 2 * 10 + 40;
if (a.me?.coins !== want) fail(`expected ${want} coins (back pay + farm coins), got ${a.me?.coins}`);
a.send({ t: 'create', game: 'hotpot', opts: {} }); await wait(300);
if (a.room.players[0].av[HAT] !== 0) fail('an unbought halo was worn');
a.send({ t: 'farm', a: { t: 'open' } }); await wait(300);
if (a.farm?.inv.coins !== want) fail('Pet Farm does not show the account coins');
a.send({ t: 'buy', k: 'hat', i: halo }); await wait(300);
if (!a.msgs.some(m => m.t === 'err' && /more coins/.test(m.msg))) fail('bought a halo without enough coins');
a.send({ t: 'buy', k: 'hat', i: 1 }); await wait(300);
if (!a.msgs.some(m => m.t === 'err' && /not in the shop/.test(m.msg))) fail('bought a free item');
a.send({ t: 'buy', k: 'hat', i: party }); await wait(500);
if (!a.msgs.some(m => m.t === 'bought' && m.id === 'hat:' + party)) fail('purchase failed');
if (a.me.coins !== want - priceOf('hat', party) || !a.me.owned.includes('hat:' + party)) fail('purchase not on the account');
a.send({ t: 'profile', name: 'Ana', color: '#ff8fab', av: look(party) }); await wait(300);
if (a.room.players[0].av[HAT] !== party) fail('a bought hat was taken off');
a.send({ t: 'buy', k: 'hat', i: party }); await wait(300);
if (!a.msgs.some(m => m.t === 'err' && /already/.test(m.msg))) fail('bought twice');
// Seasonal drops (the server's calendar is set to 10 December): summer items are not sold, winter ones are.
a.msgs.length = 0;
a.send({ t: 'buy', k: 'hat', i: OPT.hat.indexOf('Pineapple hat') }); await wait(300);
if (!a.msgs.some(m => m.t === 'err' && /Summer drop/.test(m.msg))) fail('a summer item was sold in December');
a.send({ t: 'buy', k: 'hat', i: OPT.hat.indexOf('Earmuffs') }); await wait(300);
if (!a.msgs.some(m => m.t === 'err' && /more coins/.test(m.msg))) fail('a winter item was not on sale in December');
if (!seasonOn('winter', new Date(2027, 0, 5)) || seasonOn('winter', new Date(2026, 2, 1)) || !seasonOn('halloween', new Date(2026, 10, 7)) || seasonOn('summer', new Date(2026, 8, 1))) fail('season dates are off');
// Avatars saved before the Back slot have 21 numbers: they keep their look and get nothing on their back.
{ const old = AV_KEYS.slice(0, 21).map((_, i) => i === HAT ? 3 : 0), now = cleanAv(old); if (now.length !== AV_KEYS.length || now[HAT] !== 3 || now[21] !== 0) fail('a 21-number avatar was not kept'); }
// Spending in Pet Farm uses the same coins: a Bush costs 4.
const before = a.me.coins;
a.send({ t: 'farm', a: { t: 'place', type: 'bush', x: 1, y: 1, r: 0 } }); await wait(600);
const spent = a.me.coins === before - 4;
if (!spent) fail(`Pet Farm spending did not use account coins (${before} -> ${a.me.coins})`);
await stop();

// After a restart: coins and the purchase are still there, and the farm did not pay its old coins twice.
await boot();
const b = player(TOKEN, look(party)); await b.connect(); await wait(300);
if (b.me.coins !== a.me.coins || !b.me.owned.includes('hat:' + party)) fail(`restart lost coins or items (${b.me.coins} vs ${a.me.coins})`);
await stop();
console.log(`OK shop (${spent ? 'farm spending checked' : 'farm build skipped'})`);
process.exit(0);

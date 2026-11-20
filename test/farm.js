// Pet Farm: account gate, starter pick, building rules, expeditions, farmhouse levels, and the farm surviving a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ITEMS, START_INV, SIZES, EXPAND, ZONES, TRIPS, HOUSE_UP, SPECIES, xpFor, tripLoot } from '../public/games/farm/data.js';
const PORT = 20900 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const boot = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, FARM_TEST: '1' }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { token, me: null, auth: null, farm: null, last: null };
  p.ready = new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token, name, color: '#ff8fab' });
    ws.onerror = () => {};
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { p.token = m.token; res(); }
      if (m.t === 'me') p.me = m.me;
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'farm') { p.last = m; if (m.farm) p.farm = m.farm; }
    };
  });
  // send a farm action and wait for its answer
  p.farmDo = async a => { p.last = null; p.send({ t: 'farm', a }); await until(() => p.last, 'farm reply to ' + a.t); return p.last; };
  return p;
}

await boot();
const a = player('Ana'); await a.ready;
let r = await a.farmDo({ t: 'open' });
if (r.need !== 'account') fail('guests must be asked for an account ' + JSON.stringify(r));
r = await a.farmDo({ t: 'starter', sp: 'mossbun' });
if (r.need !== 'account' || r.farm) fail('guest got a farm');

a.send({ t: 'register', user: 'ana', pass: 'hunter22' }); await until(() => a.auth, 'register');
if (a.auth.err) fail(a.auth.err);
r = await a.farmDo({ t: 'open' });
if (r.need !== 'starter') fail('new account should pick a starter');
a.last = null; a.send({ t: 'farm', a: { t: 'starter', sp: 'dragon' } }); await wait(200);
if (a.last) fail('unknown starter answered');
r = await a.farmDo({ t: 'starter', sp: 'cindercub' });
let f = r.farm;
if (!f || f.size !== SIZES[0] || f.pets.length !== 1 || f.pets[0].sp !== 'cindercub' || f.pets[0].lv !== 1) fail('starter farm wrong ' + JSON.stringify(r));
if (f.items.length !== 1 || f.items[0].type !== 'house') fail('farmhouse missing');
if (f.inv.wood !== START_INV.wood || f.trip || f.house !== 1 || f.room !== 2) fail('starting stock wrong');
if (f.pets[0].stars.length !== 4 || f.pets[0].first !== 'ana') fail('pet traits missing');
r = await a.farmDo({ t: 'starter', sp: 'mossbun' });
if (!r.err || r.farm.pets.length !== 1) fail('second starter accepted');

// placing
r = await a.farmDo({ t: 'place', type: 'hut', x: 0, y: 0, r: 0 });
if (r.err || r.farm.items.length !== 2 || r.farm.inv.wood !== START_INV.wood - ITEMS.hut.cost.wood) fail('place hut ' + JSON.stringify(r));
const hut = r.farm.items.find(i => i.type === 'hut');
for (const [what, act] of [
  ['overlap', { t: 'place', type: 'fence', x: 1, y: 1, r: 0 }],
  ['on the farmhouse', { t: 'place', type: 'fence', x: 4, y: 2, r: 0 }],
  ['off the edge', { t: 'place', type: 'hut', x: 9, y: 0, r: 0 }],
  ['negative', { t: 'place', type: 'fence', x: -1, y: 0, r: 0 }],
  ['fraction', { t: 'place', type: 'fence', x: 5.5, y: 6, r: 0 }],
  ['bad rotation', { t: 'place', type: 'fence', x: 6, y: 6, r: 7 }],
  ['second farmhouse', { t: 'place', type: 'house', x: 6, y: 6, r: 0 }],
]) {
  a.last = null; a.send({ t: 'farm', a: act }); await wait(120);
  if (a.last && !a.last.err) fail('accepted a bad placement: ' + what);
  if (a.farm.items.length !== 2) fail('item count changed after: ' + what);
}
// rotation swaps the footprint: a 2x3 barn turned once is 3 wide
r = await a.farmDo({ t: 'place', type: 'barn', x: 7, y: 7, r: 1 });
if (r.err) fail('rotated barn should fit at 7,7: ' + r.err);
r = await a.farmDo({ t: 'place', type: 'fence', x: 9, y: 8, r: 0 });
if (!r.err) fail('fence placed inside the rotated barn');
r = await a.farmDo({ t: 'place', type: 'barn', x: 0, y: 5, r: 0 });
if (!r.err) fail('second barn accepted (max 1)');

// small props snap to half tiles and can share a tile; everything else stays on whole tiles
for (const [x, y] of [[5, 5], [5.5, 5], [5, 5.5], [5.5, 5.5]]) { r = await a.farmDo({ t: 'place', type: 'flowers', x, y, r: 0 }); if (r.err) fail(`flowers at ${x},${y}: ${r.err}`); }
r = await a.farmDo({ t: 'place', type: 'rock', x: 5.5, y: 5.5, r: 0 });
if (!r.err) fail('rock placed on top of flowers');
r = await a.farmDo({ t: 'place', type: 'fence', x: 4, y: 5, r: 0 });
if (r.err) fail('fence beside the flowers: ' + r.err);
r = await a.farmDo({ t: 'place', type: 'bench', x: 3.5, y: 6.5, r: 1 }); // a bench is 1 x .5, turned it is .5 x 1
if (r.err) fail('turned bench on half tiles: ' + r.err);
r = await a.farmDo({ t: 'place', type: 'rock', x: 3.5, y: 7, r: 0 });
if (!r.err) fail('rock placed inside the turned bench');
r = await a.farmDo({ t: 'place', type: 'rock', x: 4, y: 7, r: 0 });
if (r.err) fail('rock right beside the bench: ' + r.err);
const small = a.farm.items.length;
for (const [what, act] of [
  ['fence on a half tile', { t: 'place', type: 'fence', x: 6.5, y: 6, r: 0 }],
  ['quarter tile', { t: 'place', type: 'rock', x: 6.25, y: 6, r: 0 }],
  ['text coordinate', { t: 'place', type: 'rock', x: '6', y: 6, r: 0 }],
  ['half off the edge', { t: 'place', type: 'bench', x: 9.5, y: 0, r: 0 }],
]) {
  a.last = null; a.send({ t: 'farm', a: act }); await wait(120);
  if (a.last && !a.last.err) fail('accepted a bad placement: ' + what);
  if (a.farm.items.length !== small) fail('item count changed after: ' + what);
}
for (const i of a.farm.items.filter(i => !['house', 'hut', 'barn'].includes(i.type))) await a.farmDo({ t: 'remove', id: i.id });

// moving and putting away
r = await a.farmDo({ t: 'move', id: hut.id, x: 0, y: 4, r: 2 });
if (r.err || r.farm.items.find(i => i.id === hut.id).y !== 4) fail('move hut');
r = await a.farmDo({ t: 'move', id: hut.id, x: 3, y: 1, r: 0 });
if (!r.err) fail('moved hut onto the farmhouse');
r = await a.farmDo({ t: 'move', id: 1, x: 6, y: 0, r: 0 });
if (r.err) fail('farmhouse should be movable: ' + r.err);
r = await a.farmDo({ t: 'remove', id: 1 });
if (!r.err) fail('farmhouse was put away');
const woodBefore = a.farm.inv.wood;
r = await a.farmDo({ t: 'remove', id: hut.id });
if (r.err || r.farm.inv.wood !== woodBefore + ITEMS.hut.cost.wood || r.farm.items.some(i => i.id === hut.id)) fail('put away should refund');

// running out of materials
let n = 0;
while (n < 60) { r = await a.farmDo({ t: 'place', type: 'bench', x: n % 6, y: 4 + (n / 6 | 0), r: 0 }); if (r.err) break; n++; }
if (!r.err || n === 0 || a.farm.inv.wood < 0) fail('spending should stop at zero, placed ' + n);

// expeditions
const me = a.farm.pets[0];
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [me.id] });
if (!r.err) fail('sent a party without a gate');
await a.farmDo({ t: 'open', test: { give: { wood: 500, stone: 500, fiber: 500 } } });
for (const [x, y] of [[8, 8], [8, 2], [6, 6], [8, 5], [6, 3]]) { r = await a.farmDo({ t: 'place', type: 'gate', x, y, r: 0 }); if (!r.err) break; }
if (r.err) fail('gate ' + r.err);
for (const bad of [{ zone: 'cove', trip: 'stroll', pets: [me.id] }, { zone: 'woods', trip: 'stroll', pets: [] }, { zone: 'woods', trip: 'stroll', pets: [me.id, me.id] }, { zone: 'woods', trip: 'stroll', pets: ['nope'] }]) {
  r = await a.farmDo({ t: 'send', ...bad }); if (!r.err || r.farm.trip) fail('bad party accepted ' + JSON.stringify(bad));
}
a.last = null; a.send({ t: 'farm', a: { t: 'send', zone: 'moon', trip: 'stroll', pets: [me.id] } }); await wait(150);
if (a.last) fail('unknown zone answered');
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'outing', pets: [me.id] });
if (r.err || r.farm.trip?.zone !== 'woods' || r.farm.trip.left <= 59 * 60_000 || r.farm.trip.left > TRIPS.outing.min * 60_000) fail('send ' + JSON.stringify(r));
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [me.id] });
if (!r.err) fail('two parties at once');
r = await a.farmDo({ t: 'collect' });
if (!r.err || !r.farm.trip) fail('collected early');
const inv0 = { ...a.farm.inv };
r = await a.farmDo({ t: 'collect', test: { home: true } });
const want = tripLoot('woods', 'outing', [me]);
if (r.err || r.farm.trip || !r.back) fail('collect ' + JSON.stringify(r));
for (const [k, n] of Object.entries(want)) {
  const got = r.back.loot[k] || 0;
  if (got < Math.floor(n * .85) || got > Math.ceil(n * 1.15) || r.farm.inv[k] !== (inv0[k] || 0) + got) fail(`loot ${k}: got ${got}, expected about ${n}`);
}
let pet1 = r.farm.pets.find(x => x.id === me.id);
if (pet1.lv !== 2 || pet1.xp !== TRIPS.outing.xp - xpFor(1) || r.back.grew[0]?.lv !== 2) fail('xp wrong ' + JSON.stringify(pet1));
// the first trip always brings a wild pet home, from that zone
const wild = r.farm.pets.find(x => x.id === r.back.found);
if (r.farm.pets.length !== 2 || !wild || !(wild.sp in ZONES.woods.wild) || wild.lv !== 1 || wild.name !== SPECIES[wild.sp].name) fail('no wild pet on the first trip');
// with every bed taken nobody new can move in
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [me.id, wild.id] });
if (r.err || r.farm.trip.pets.length !== 2) fail('party of two');
r = await a.farmDo({ t: 'collect', test: { home: true, trips: 0 } });
if (r.back.found || !r.back.full || r.farm.pets.length !== 2) fail('a pet moved in without a bed');
// a long trip takes a baby to its young form
await a.farmDo({ t: 'send', zone: 'woods', trip: 'outing', pets: [me.id] }); await a.farmDo({ t: 'collect', test: { home: true, trips: 5 } });
await a.farmDo({ t: 'send', zone: 'woods', trip: 'camp', pets: [me.id] });
r = await a.farmDo({ t: 'collect', test: { home: true, trips: 5 } });
pet1 = r.farm.pets.find(x => x.id === me.id);
if (pet1.lv < 5 || r.back.grew[0]?.form !== 1) fail('camp-out should reach the young form ' + JSON.stringify([pet1.lv, r.back.grew]));

// farmhouse levels open new zones
r = await a.farmDo({ t: 'send', zone: 'ridge', trip: 'stroll', pets: [me.id] });
if (!r.err) fail('ridge open at level 1');
const wood0 = a.farm.inv.wood;
r = await a.farmDo({ t: 'houseup' });
if (r.err || r.farm.house !== 2 || r.farm.inv.wood !== wood0 - HOUSE_UP[2].wood || r.farm.houseNext.shells !== HOUSE_UP[3].shells) fail('houseup ' + JSON.stringify(r.err));
r = await a.farmDo({ t: 'houseup' });
if (!r.err || r.farm.house !== 2) fail('upgraded without shells');
r = await a.farmDo({ t: 'send', zone: 'ridge', trip: 'stroll', pets: [me.id] });
if (r.err) fail('ridge should be open ' + r.err);
r = await a.farmDo({ t: 'collect', test: { home: true, trips: 5 } });
if (!r.back.loot.stone) fail('ridge gave no stone');

// growing the land shifts everything inwards by one tile
const house = a.farm.items.find(i => i.type === 'house');
r = await a.farmDo({ t: 'expand' });
if (r.err || r.farm.size !== SIZES[1] || r.farm.items.find(i => i.type === 'house').x !== house.x + 1) fail('expand ' + JSON.stringify(r.err));
if (r.farm.next.size !== SIZES[2] || r.farm.next.cost.wood !== EXPAND[2].wood) fail('next size wrong');

// pet name
const pet = a.farm.pets[0];
r = await a.farmDo({ t: 'petname', id: pet.id, name: '  <b>Ember</b>  ' });
if (r.farm.pets[0].name !== 'bEmber/b') fail('pet name not cleaned: ' + r.farm.pets[0].name);

// a second player has their own farm
const b = player('Bo'); await b.ready;
b.send({ t: 'register', user: 'bob', pass: 'hunter22' }); await until(() => b.auth, 'register b');
r = await b.farmDo({ t: 'starter', sp: 'puddlepup' });
if (r.farm.items.length !== 1 || r.farm.pets[0].sp !== 'puddlepup') fail('second farm');

// restart: the farm is still there, and logging in from a new browser finds it
const snapshot = JSON.stringify(a.farm);
await stop(); await boot();
if (!fs.existsSync(path.join(DATA_DIR, 'pet-farm.json'))) fail('pet-farm.json not written');
const a2 = player('Ana again'); await a2.ready;
a2.send({ t: 'login', user: 'ana', pass: 'hunter22' }); await until(() => a2.auth, 'login');
if (a2.auth.err) fail(a2.auth.err);
r = await a2.farmDo({ t: 'open' });
if (JSON.stringify({ ...r.farm, owner: a.farm.owner }) !== snapshot) fail('farm changed across restart');
a2.send({ t: 'logout' }); await wait(200);
r = await a2.farmDo({ t: 'open' });
if (r.need !== 'account') fail('logged out player still sees a farm');

console.log('farm ok:', a.farm.items.length, 'items,', a.farm.size, 'tiles wide, survived restart');
await stop();
process.exit(0);

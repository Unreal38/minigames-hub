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
      if (m.t === 'friends') p.friends = m;
      if (m.t === 'err') p.err = m.msg;
      if (m.t === 'farm') { p.last = m; if (m.farm) p.farm = m.farm; if (m.invite) p.invite = m.invite; if (m.battle) p.battle = m.battle; if (m.did === 'fought') p.fought = m; }
      if (m.t === 'me') p.me = m.me;
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

// battles
const mine = a.farm.pets.map(x => x.id);
r = await a.farmDo({ t: 'fight', mode: 'practice', pets: [mine[0]] });
if (!r.err || r.battle) fail('practice without a Training Yard');
await a.farmDo({ t: 'open', test: { give: { wood: 300, stone: 300, fiber: 300 } } });
for (const type of ['yard', 'flag']) {
  for (let y = 0; y < 12 && (y === 0 || r.err); y++) for (let x = 0; x < 10 && (x + y === 0 || r.err); x++) r = await a.farmDo({ t: 'place', type, x, y, r: 0 });
  if (r.err) fail('no room for ' + type);
}
for (const bad of [[], ['nope'], [mine[0], mine[0]]]) { r = await a.farmDo({ t: 'fight', mode: 'practice', pets: bad }); if (!r.err || r.battle) fail('bad team accepted ' + bad); }
// plays a fight to the end with the first thing that is allowed each turn
async function playOut(first) {
  let x = first, turns = 0;
  while (x.battle && x.battle.over === null) {
    const me = x.battle.sides[0], u = me.pets[me.on];
    const act = x.battle.need ? { switch: me.pets.findIndex((q, i) => q.hp > 0 && i !== me.on) } : { move: u.moves.find(m => !u.cd[m]) };
    await wait(60); // the server allows about 20 messages a second
    x = await a.farmDo({ t: 'bact', ...act });
    if (x.err) fail('legal action refused: ' + JSON.stringify(act));
    if (++turns > 300) fail('battle never ended');
  }
  return x;
}
r = await a.farmDo({ t: 'fight', mode: 'practice', pets: mine.slice(0, 2) });
if (r.err || r.battle.sides[0].pets.length !== 2 || r.battle.sides[1].pets.length !== 2 || r.battle.sides[0].pets[0].hp <= 0) fail('practice start ' + JSON.stringify(r));
let bad = await a.farmDo({ t: 'bact', move: 'boulderroll' });
if (!bad.err && !r.battle.sides[0].pets[0].moves.includes('boulderroll')) fail('used a move it does not know');
bad = await a.farmDo({ t: 'bact', switch: 0 });
if (!bad.err) fail('switched to the pet already out');
const lv0 = a.farm.pets.find(x => x.id === mine[0]).lv, xp0 = a.farm.pets.find(x => x.id === mine[0]).xp;
r = await playOut(bad);
if (!r.prize || !r.prize.counted || r.prize.xp <= 0 || r.farm.fights.practice !== 2) fail('practice prize ' + JSON.stringify(r.prize));
const after = r.farm.pets.find(x => x.id === mine[0]);
if (after.lv === lv0 && after.xp !== xp0 + r.prize.xp) fail('practice xp not added');
if (!r.ev.some(e => e.k === 'end')) fail('no end event');
r = await a.farmDo({ t: 'bact', move: 'leafflick' });
if (r.battle) fail('battle should be gone after it ends');
// giving up counts as a loss and earns nothing
await a.farmDo({ t: 'fight', mode: 'practice', pets: [mine[0]] });
r = await a.farmDo({ t: 'bquit' });
if (!r.prize || r.prize.won || r.prize.counted || r.farm.fights.practice !== 2) fail('quit ' + JSON.stringify(r.prize));
// the arena: neighbours and other players, everyone at level 20
r = await a.farmDo({ t: 'foes' });
const bo = r.foes.find(x => !x.npc);
if (r.foes.filter(x => x.npc).length !== 3 || !bo || bo.name !== 'Bo' || bo.team[0].sp !== 'puddlepup' || JSON.stringify(r.foes).includes(b.me?.pid || 'no-pid')) fail('foes ' + JSON.stringify(r.foes));
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: 'nobody', pets: [mine[0]] });
if (!r.err) fail('fought a farm that does not exist');
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: bo.id, pets: mine.slice(0, 2) });
if (r.err || r.battle.sides[0].pets[0].lv !== 20 || r.battle.sides[1].pets[0].lv !== 20 || r.battle.sides[0].pets[0].moves.length !== 4 || r.battle.foe !== 'Bo') fail('arena start ' + JSON.stringify(r.err));
const coins0 = a.farm.inv.coins;
r = await playOut(r);
if (!r.prize.counted || r.farm.inv.coins !== coins0 + r.prize.coins || r.farm.pts !== r.prize.pts || r.farm.fights.arena !== 4) fail('arena prize ' + JSON.stringify(r.prize));
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: 'npc:hazel', pets: mine.slice(0, 2) });
if (r.err || r.battle.sides[1].pets.length !== 3) fail('npc fight');
await a.farmDo({ t: 'bquit' });
// defence team
r = await a.farmDo({ t: 'defend', pets: [mine[1]] });
if (r.err || r.farm.def.length !== 1 || r.farm.def[0] !== mine[1]) fail('defend');
r = await a.farmDo({ t: 'defend', pets: ['nope'] });
if (!r.err) fail('defend with a stranger');

// neighbours: world map, visiting, helping, gifts and mail
b.farmDo = async x => { b.last = null; b.send({ t: 'farm', a: x }); await until(() => b.last, 'farm reply to ' + x.t); return b.last; };
r = await b.farmDo({ t: 'open' });
if (r.farm.mail.length !== 1 || r.farm.mail[0].k !== 'battle' || r.farm.mail[0].from !== 'Ana') fail('defender got no battle report ' + JSON.stringify(r.farm.mail));
r = await b.farmDo({ t: 'world' });
const ana = r.world.find(x => x.name === 'Ana');
if (r.world.length !== 1 || !ana || ana.helps !== 5 || !ana.gift || ana.items.length !== a.farm.items.length || JSON.stringify(r.world).includes('"inv"')) fail('world ' + JSON.stringify(r.world).slice(0, 300));
r = await b.farmDo({ t: 'visit', id: 'nobody' });
if (!r.err) fail('visited a farm that does not exist');
r = await b.farmDo({ t: 'visit', id: ana.id });
if (r.err || r.visit.name !== 'Ana' || r.visit.pets.length !== a.farm.pets.length || r.visit.pets[0].xp !== undefined) fail('visit ' + JSON.stringify(r));
// helping: coins for the helper, and Ana's party comes home sooner
await a.farmDo({ t: 'send', zone: 'woods', trip: 'outing', pets: [mine[0]] });
const left0 = a.farm.trip.left, bc = b.farm.inv.coins;
for (let i = 0; i < 5; i++) { r = await b.farmDo({ t: 'help', id: ana.id }); if (r.err) fail('help ' + i + ' ' + r.err); }
if (r.visit.helps !== 0 || r.farm.inv.coins !== bc + 15) fail('help count or coins');
r = await b.farmDo({ t: 'help', id: ana.id });
if (!r.err || r.farm.inv.coins !== bc + 15) fail('sixth help accepted');
r = await a.farmDo({ t: 'open' });
if (r.farm.trip.left > left0 - 49 * 60_000) fail('helps did not shorten the trip: ' + (left0 - r.farm.trip.left));
if (r.farm.mail.filter(m => m.k === 'help').length !== 1 || r.farm.mail.find(m => m.k === 'help').n !== 5) fail('help note ' + JSON.stringify(r.farm.mail));
await a.farmDo({ t: 'collect', test: { home: true, trips: 5 } });
// gifts: paid by the giver, opened from the mailbox
const bw = b.farm.inv.wood, aw = a.farm.inv.wood;
r = await b.farmDo({ t: 'gift', id: ana.id, mat: 'crystal' });
if (!r.err) fail('gave crystal without having any');
r = await b.farmDo({ t: 'gift', id: ana.id, mat: 'wood' });
if (r.err || r.farm.inv.wood !== bw - 10 || r.visit.gift || r.visit.pal !== 1 || r.farm.pals[ana.id] !== 1) fail('gift ' + JSON.stringify(r.err));
r = await b.farmDo({ t: 'gift', id: ana.id, mat: 'wood' });
if (!r.err || r.farm.inv.wood !== bw - 10) fail('second gift the same day');
r = await a.farmDo({ t: 'open' });
const gift = r.farm.mail.find(m => m.k === 'gift');
if (!gift || gift.got.wood !== 10 || gift.from !== 'Bo') fail('gift not in the mailbox');
for (const i of a.farm.items.filter(i => i.type === 'mailbox')) await a.farmDo({ t: 'remove', id: i.id });
r = await a.farmDo({ t: 'claim', id: gift.id });
if (!r.err) fail('opened mail without a mailbox');
await a.farmDo({ t: 'open', test: { give: { wood: 50 } } });
for (let y = 0; y < 12 && (y === 0 || r.err); y++) for (let x = 0; x < 12 && (x + y === 0 || r.err); x++) r = await a.farmDo({ t: 'place', type: 'mailbox', x, y, r: 0 });
if (r.err) fail('no room for a mailbox');
const w1 = a.farm.inv.wood;
r = await a.farmDo({ t: 'claim', id: gift.id });
if (r.err || r.farm.inv.wood !== w1 + 10 || r.farm.mail.some(m => m.k === 'gift')) fail('claim ' + JSON.stringify(r.err));
r = await a.farmDo({ t: 'claim', id: gift.id });
if (!r.err) fail('opened the same gift twice');
r = await a.farmDo({ t: 'mailread' });
if (r.farm.mail.length) fail('notes not cleared');
// the album remembers every species and form owned
const sp0 = a.farm.pets.find(x => x.id === mine[0]).sp;
if (!a.farm.album[sp0]?.[0] || Object.keys(a.farm.album).length < 1) fail('album ' + JSON.stringify(a.farm.album));

// ----- breeding -----
r = await a.farmDo({ t: 'pair', a: mine[0], b: mine[1] });
if (!r.err) fail('paired without a nest');
await a.farmDo({ t: 'open', test: { give: { wood: 100, fiber: 100, crystal: 5 }, lv: 3, home: true } });
r = { err: 1 }; for (let y = 0; y < 11 && r.err; y++) for (let x = 0; x < 11 && r.err; x++) { r = await a.farmDo({ t: 'place', type: 'nest', x, y, r: 0 }); await wait(30); }
if (r.err) fail('no room for a nest');
if (a.farm.trip) await a.farmDo({ t: 'collect' });
const kin = a.farm.pets.slice(0, 2).map(x => x.id);
r = await a.farmDo({ t: 'pair', a: kin[0], b: kin[1] });
if (!r.err) fail('paired pets that are too young');
await a.farmDo({ t: 'open', test: { lv: 6 } });
r = await a.farmDo({ t: 'pair', a: kin[0], b: kin[0] });
if (!r.err) fail('paired a pet with itself');
r = await a.farmDo({ t: 'pair', a: kin[0], b: kin[1] });
if (r.err || r.farm.nest?.stage !== 'cuddle' || !r.farm.nest.shell) fail('pair ' + JSON.stringify(r.err || r.farm.nest));
if (!(r.farm.pets.find(x => x.id === kin[0]).rest > 0)) fail('parents are not resting');
if (r.farm.pets.find(x => x.id === kin[0]).col.length !== 1) fail('hidden colour gene shown too early');
r = await a.farmDo({ t: 'hatch' });
if (!r.err) fail('hatched before there was an egg');
r = await a.farmDo({ t: 'pair', a: kin[0], b: kin[1] });
if (!r.err) fail('nest used twice');
r = await a.farmDo({ t: 'open', test: { egg: 'laid' } });
if (r.farm.nest.stage !== 'egg') fail('no egg after the cuddle: ' + r.farm.nest.stage);
// a neighbour cheers the egg on
r = await a.farmDo({ t: 'open', test: { egg: 'ready', give: { wood: 200, stone: 100 } } });
if (r.farm.nest.stage !== 'ready') fail('egg not ready');
const petsBefore = r.farm.pets.length;
if (r.farm.pets.length >= r.farm.room) { let q = { err: 1 }; for (let y = 0; y < 11 && q.err; y++) for (let x = 0; x < 11 && q.err; x++) { q = await a.farmDo({ t: 'place', type: 'hut', x, y, r: 0 }); await wait(30); } if (q.err) fail('no room for a hut'); }
r = await a.farmDo({ t: 'hatch' });
if (r.err || r.farm.pets.length !== petsBefore + 1 || r.farm.nest) fail('hatch ' + JSON.stringify(r.err));
const kid = r.farm.pets.find(x => x.id === r.born);
if (!kid || kid.lv !== 1 || kid.par?.length !== 2 || !kid.par.every(x => x.sp && x.name) || !Array.isArray(kid.stars) || kid.stars.some(n => n < 1 || n > 5)) fail('baby ' + JSON.stringify(kid));
if (![a.farm.pets.find(x => x.id === kin[0]).sp, a.farm.pets.find(x => x.id === kin[1]).sp, 'truffowl', 'magmutt', 'nimbowhale', 'glimmoth', 'geodeer'].includes(kid.sp)) fail('baby species ' + kid.sp);
// playdate: Bo opens a pet, Ana pairs with it
r = await b.farmDo({ t: 'petopen', id: b.farm.pets[0].id });
if (!r.err) fail('opened a pet that is too young');
await b.farmDo({ t: 'open', test: { lv: 7 } });
r = await b.farmDo({ t: 'petopen', id: b.farm.pets[0].id });
if (r.err || !r.farm.pets[0].open) fail('petopen ' + r.err);
await a.farmDo({ t: 'open', test: { rested: true } });
r = await a.farmDo({ t: 'visit', id: (await b.farmDo({ t: 'world' })).world.length ? (await a.farmDo({ t: 'world' })).world.find(x => x.name === 'Bo').id : '' });
const boFarm = r.visit, openPet = boFarm.pets.find(x => x.open);
if (!openPet) fail('visitor cannot see the open pet');
r = await a.farmDo({ t: 'pair', a: kin[0], friend: boFarm.id, b: openPet.id });
if (r.err || !r.farm.nest?.friend) fail('playdate ' + JSON.stringify(r.err));
r = await b.farmDo({ t: 'open' });
if (!r.farm.mail.some(m => m.k === 'date')) fail('no thank-you for the playdate');
await a.farmDo({ t: 'open', test: { egg: 'ready', rested: true, give: { wood: 200, stone: 100 } } });
if (a.farm.pets.length >= a.farm.room) { let q = { err: 1 }; for (let y = 0; y < 11 && q.err; y++) for (let x = 0; x < 11 && q.err; x++) { q = await a.farmDo({ t: 'place', type: 'hut', x, y, r: 0 }); await wait(30); } }
r = await a.farmDo({ t: 'hatch' });
if (r.err || r.farm.nest) fail('playdate hatch ' + JSON.stringify(r.err));
await a.farmDo({ t: 'open', test: { rested: true } });

// ----- friends (the site-wide list) -----
a.err = null; a.send({ t: 'friend', op: 'add', user: 'nobody-here' }); await until(() => a.err, 'unknown friend refused');
a.err = null; a.send({ t: 'friend', op: 'add', user: 'ana' }); await until(() => a.err, 'adding yourself refused');
b.friends = null; a.send({ t: 'friend', op: 'add', user: 'bo' }); /* the name shown on screen works as well as the username */ await until(() => b.friends, 'friend request');
if (b.friends.reqs[0]?.user !== 'ana' || b.friends.friends.length) fail('request ' + JSON.stringify(b.friends));
r = await a.farmDo({ t: 'world' });
if (r.world.some(x => x.friend)) fail('friends before the request was accepted');
a.friends = null; b.send({ t: 'friend', op: 'accept', user: 'ana' }); await until(() => a.friends?.friends.length, 'friend accepted');
if (a.friends.friends[0].user !== 'bob' || !a.friends.friends[0].online || !a.friends.friends[0].farm) fail('friend card ' + JSON.stringify(a.friends.friends));
r = await a.farmDo({ t: 'world' });
if (!r.world[0].friend || r.world[0].name !== 'Bo') fail('friends are not first on the map');
r = await a.farmDo({ t: 'visit', id: a.friends.friends[0].farm });
if (r.err || r.visit.name !== 'Bo') fail('visit from the friends list');

// ----- trading -----
r = await a.farmDo({ t: 'open', test: { give: { wood: 50 }, rested: true } });
const boId = a.friends.friends[0].farm, tWood = r.farm.inv.wood, spare = r.farm.pets.find(x => !r.farm.def.includes(x.id) && !x.held);
r = await a.farmDo({ t: 'offer', to: boId, give: {}, want: {} });
if (!r.err) fail('empty offer accepted');
r = await a.farmDo({ t: 'offer', to: boId, give: { mats: { wood: 99999 } }, want: {} });
if (!r.err) fail('offered more than owned');
r = await a.farmDo({ t: 'offer', to: boId, give: { mats: { wood: 20 } }, want: { mats: { coins: 1 } } });
if (r.err || r.farm.inv.wood !== tWood - 20 || r.farm.trades[0]?.dir !== 'out') fail('offer ' + JSON.stringify(r.err || r.farm.trades));
r = await a.farmDo({ t: 'offer', to: boId, give: { mats: { wood: 1 } }, want: {} });
if (!r.err) fail('two offers to one farm');
r = await b.farmDo({ t: 'open' });
const offer1 = r.farm.trades.find(x => x.dir === 'in');
if (!offer1 || offer1.who !== 'Ana' || offer1.give.mats.wood !== 20) fail('incoming offer ' + JSON.stringify(r.farm.trades));
r = await b.farmDo({ t: 'tradeans', id: offer1.id, ok: false });
if (r.err || r.farm.trades.length) fail('decline ' + r.err);
r = await a.farmDo({ t: 'open' });
if (r.farm.inv.wood !== tWood || r.farm.trades.length) fail('declined offer did not come back');
if (!spare) fail('no spare pet to trade');
r = await a.farmDo({ t: 'offer', to: boId, give: { pets: [spare.id], mats: { wood: 5 } }, want: { mats: { coins: 2 } } });
if (r.err || !r.farm.pets.find(x => x.id === spare.id).held) fail('pet offer ' + r.err);
r = await a.farmDo({ t: 'tradecancel', id: r.farm.trades[0].id });
if (r.err || r.farm.pets.find(x => x.id === spare.id).held || r.farm.inv.wood !== tWood) fail('cancel ' + r.err);
r = await a.farmDo({ t: 'offer', to: boId, give: { pets: [spare.id], mats: { wood: 5 } }, want: { mats: { coins: 2 } } });
await b.farmDo({ t: 'open', test: { give: { wood: 100, stone: 100, coins: 10 } } });
r = { err: 1 }; for (let y = 0; y < 9 && r.err; y++) for (let x = 0; x < 9 && r.err; x++) { r = await b.farmDo({ t: 'place', type: 'hut', x, y, r: 0 }); await wait(30); }
const bCoins = b.farm.inv.coins, bPets = b.farm.pets.length, aPets = a.farm.pets.length, aCoins = a.farm.inv.coins;
r = await b.farmDo({ t: 'tradeans', id: b.farm.trades[0].id, ok: true });
if (r.err || r.farm.pets.length !== bPets + 1 || r.farm.inv.coins !== bCoins - 2 || !r.farm.pets.some(x => x.id === spare.id && x.first === 'ana' && !x.held)) fail('accept ' + JSON.stringify(r.err));
r = await a.farmDo({ t: 'open' });
if (r.farm.pets.length !== aPets - 1 || r.farm.inv.coins !== aCoins + 2 || r.farm.trades.length) fail('trade did not settle for the sender');

// ----- gardens, kitchen, storage, workshop -----
r = await a.farmDo({ t: 'open', test: { give: { wood: 200, stone: 200, fiber: 100, coal: 20 } } });
const spot = async type => { let q = { err: 1 }; for (let y = 0; y < 12 && q.err; y++) for (let x = 0; x < 12 && q.err; x++) { q = await a.farmDo({ t: 'place', type, x, y, r: 0 }); await wait(30); } if (q.err) fail('no room for ' + type); return q; };
if (!a.farm.items.some(i => i.type === 'garden')) await spot('garden');
r = await a.farmDo({ t: 'place', type: 'windmill', x: 0, y: 0, r: 0 });
if (!r.err && !a.farm.items.some(i => i.type === 'workshop')) fail('crafted decoration without a Workshop');
r = await a.farmDo({ t: 'open', test: { ripe: true } });
const plots = r.farm.items.filter(i => i.type === 'garden').length, b0 = r.farm.inv.berries || 0;
if (r.farm.garden.ripe !== plots) fail('gardens not ripe');
r = await a.farmDo({ t: 'pick' });
if (r.err || r.farm.inv.berries !== b0 + plots * 3 || r.farm.garden.ripe || !(r.farm.garden.left > 3500_000)) fail('pick ' + JSON.stringify(r.err || r.farm.garden));
r = await a.farmDo({ t: 'pick' });
if (!r.err) fail('picked unripe berries');
r = await a.farmDo({ t: 'cook', what: 'cookie', test: { give: { berries: 30 } } });
if (!a.farm.items.some(i => i.type === 'kitchen')) { if (!r.err) fail('cooked without a Kitchen'); await spot('kitchen'); r = await a.farmDo({ t: 'cook', what: 'cookie' }); }
if (r.err || r.farm.inv.cookie !== 1) fail('cook ' + r.err);
const eater = r.farm.pets.find(x => x.lv < 20), eat0 = [eater.lv, eater.xp];
r = await a.farmDo({ t: 'feed', what: 'cookie', pet: eater.id });
const ate = r.farm.pets.find(x => x.id === eater.id);
if (r.err || r.farm.inv.cookie || (ate.lv === eat0[0] && ate.xp <= eat0[1])) fail('feed ' + r.err);
r = await a.farmDo({ t: 'feed', what: 'cookie', pet: eater.id });
if (!r.err) fail('fed a treat that was not there');
r = await a.farmDo({ t: 'sell', mat: 'wood', lots: 2 });
if (!a.farm.items.some(i => i.type === 'workshop')) { if (!r.err) fail('sold without a Workshop'); await spot('workshop'); r = await a.farmDo({ t: 'open' }); const w0 = [r.farm.inv.wood, r.farm.inv.coins]; r = await a.farmDo({ t: 'sell', mat: 'wood', lots: 2 }); if (r.err || r.farm.inv.wood !== w0[0] - 20 || r.farm.inv.coins !== w0[1] + 8) fail('sell ' + r.err); }
await spot('windmill');
if (a.farm.cap !== (a.farm.items.some(i => i.type === 'barn') ? 900 : 300)) fail('storage cap ' + a.farm.cap);
// a juice in a practice battle heals once
r = await a.farmDo({ t: 'cook', what: 'juice' }); r = await a.farmDo({ t: 'cook', what: 'juice' });
if (r.err || r.farm.inv.juice !== 2) fail('juice ' + r.err);
r = await a.farmDo({ t: 'fight', mode: 'practice', pets: [a.farm.pets[0].id] });
if (r.err || !r.battle) fail('practice for juice ' + r.err);
r = await a.farmDo({ t: 'bact', juice: true });
if (!r.err) fail('juice at full health');
for (let n = 0; n < 30 && r.battle && r.battle.over === null && r.battle.sides[0].pets[r.battle.sides[0].on].hp >= r.battle.sides[0].pets[r.battle.sides[0].on].max; n++) {
  const u = r.battle.sides[0].pets[r.battle.sides[0].on]; r = await a.farmDo({ t: 'bact', move: u.moves.find(m => !u.cd[m]) }); await wait(30); }
if (r.battle && r.battle.over === null && !r.battle.need) {
  const hp = r.battle.sides[0].pets[r.battle.sides[0].on].hp;
  r = await a.farmDo({ t: 'bact', juice: true });
  if (r.err || !r.ev.some(e => e.k === 'juice' && e.hp > hp)) fail('juice did not heal ' + r.err);
  if (r.did !== 'fought') { r = await a.farmDo({ t: 'bact', juice: true }); if (!r.err) fail('two juices in one battle'); }
}
r = await a.farmDo({ t: 'bquit' }); await wait(50);
r = await a.farmDo({ t: 'open', test: { ripe: true } });

// ----- building levels, training, friendship decorations, album compare -----
r = await a.farmDo({ t: 'open', test: { give: { wood: 400, stone: 400, fiber: 300, shells: 40, coal: 40 } } });
const hut1 = r.farm.items.find(i => i.type === 'hut'), room1 = r.farm.room, house1 = r.farm.house;
r = await a.farmDo({ t: 'upgrade', id: hut1.id });
if (house1 < 2 ? !r.err : (r.err || r.farm.room !== room1 + 2 || r.farm.items.find(i => i.id === hut1.id).lv !== 2)) fail('hut upgrade ' + r.err + ' house ' + house1);
r = await a.farmDo({ t: 'upgrade', id: r.farm.items.find(i => i.type === 'house').id });
if (!r.err) fail('upgraded the farmhouse as a building');
if (!a.farm.items.some(i => i.type === 'yard')) await spot('yard');
const trainee = a.farm.pets.find(x => x.lv < 15), tx0 = [trainee.lv, trainee.xp];
r = await a.farmDo({ t: 'train', pets: a.farm.pets.map(x => x.id) });
if (r.err || r.farm.train.ids.length !== r.farm.train.slots || r.farm.train.slots !== 1) fail('train ' + JSON.stringify(r.err || r.farm.train));
r = await a.farmDo({ t: 'train', pets: [trainee.id] });
r = await a.farmDo({ t: 'open', test: { trained: 3 } }); r = await a.farmDo({ t: 'open' });
const tr1 = r.farm.pets.find(x => x.id === trainee.id);
if (tr1.lv === tx0[0] && tr1.xp < tx0[1] + 18) fail('training gave no experience ' + JSON.stringify([tx0, tr1.lv, tr1.xp]));
r = await a.farmDo({ t: 'train', pets: [] });
r = await a.farmDo({ t: 'place', type: 'palflag', x: 0, y: 0, r: 0, test: { pals: 0 } });
if (a.farm.palpts < 15 && !r.err) fail('friendship decoration without the points');
r = await a.farmDo({ t: 'open', test: { pals: 20 } });
if (r.farm.palpts < 20) fail('friendship points ' + r.farm.palpts);
r = await a.farmDo({ t: 'visit', id: boId });
if (r.err || !r.visit.album || !Object.keys(r.visit.album).length) fail('no album on a visit');

// ----- live battles -----
r = await a.farmDo({ t: 'duel', to: boId, pets: [] });
if (!r.err) fail('live battle with no team');
b.invite = null; r = await a.farmDo({ t: 'duel', to: boId, pets: [a.farm.pets[0].id] });
if (r.err) fail('invite ' + r.err);
await until(() => b.invite, 'live invite');
if (b.invite.from !== 'Ana') fail('invite from ' + b.invite.from);
a.battle = b.battle = null; a.fought = b.fought = null;
const lc = [a.farm.inv.coins, b.farm.inv.coins];
b.send({ t: 'farm', a: { t: 'duelyes', id: b.invite.id, pets: [b.farm.pets[0].id] } });
await until(() => a.battle && b.battle, 'live battle start');
if (!a.battle.live || a.battle.foe !== 'Bo' || b.battle.foe !== 'Ana' || a.battle.sides[0].pets[0].name !== a.farm.pets[0].name || b.battle.sides[0].pets[0].name !== b.farm.pets[0].name) fail('live view ' + JSON.stringify([a.battle.foe, b.battle.foe]));
r = await a.farmDo({ t: 'bact', move: a.battle.sides[0].pets[0].moves[0] });
if (!r.battle?.waiting || r.ev.length) fail('first chooser should wait');
for (let n = 0; n < 60 && !a.fought; n++) {
  const turn = a.battle.turn;
  for (const x of [a, b]) { const u = x.battle.sides[0].pets[x.battle.sides[0].on]; if (!x.battle.waiting) x.send({ t: 'farm', a: { t: 'bact', move: u.moves.find(m => !u.cd[m]) } }); }
  await until(() => a.fought || (a.battle.turn !== turn && b.battle.turn !== turn), 'live turn ' + n); await wait(40);
}
await until(() => a.fought && b.fought, 'live battle end');
if (a.fought.prize.won === b.fought.prize.won) fail('both won or both lost');
for (const [i, x] of [a, b].entries()) if (x.fought.farm.inv.coins !== lc[i] + (x.fought.prize.won ? 15 : 5)) fail('live prize coins');
r = await a.farmDo({ t: 'open' });
if (r.battle) fail('live battle still running');

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

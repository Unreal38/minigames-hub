// Pet Farm: account gate, starter pick, building rules, expeditions, farmhouse levels, and the farm surviving a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readFarms } from './saved.js';
import { ITEMS, START_INV, SIZES, EXPAND, ZONES, TRIPS, HOUSE_UP, SPECIES, UPGRADES, countOf, albumHave, museumFill, xpFor, tripLoot, canWork, workPct, weatherAt, WEATHER, WEATHER_MS } from '../public/games/farm/data.js';
const PORT = 20900 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const boot = async () => { srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, FARM_TEST: '1' }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
const lvOfItem = (farm, id) => farm.items.find(i => i.id === id)?.lv || 1;
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
  p.farmDo = async a => { p.last = null; p.send({ t: 'farm', a }); await until(() => p.last, 'farm reply to ' + a.t + ' ' + JSON.stringify(a)); return p.last; };
  return p;
}

// cats: a kitten of two cat species takes its build from one and its coat from either; other pets never get a cat coat
{ const { makeBaby, lookOf, kinCoat: catCoat, hybridOf } = await import('../public/games/farm/breed.js'); const seen = new Set();
  for (let i = 0; i < 300; i++) { const k = makeBaby({ sp: 'munchmew' }, { sp: 'siamew' }); if (!['munchmew', 'siamew'].includes(k.sp)) fail('odd kitten ' + k.sp); if (k.cat === k.sp) fail('bad cat coat ' + JSON.stringify(k)); seen.add(k.sp + ':' + catCoat(k)); if (k.cat && lookOf(k)?.cat !== k.cat) fail('cat coat not drawn'); }
  for (const want of ['munchmew:siamew', 'munchmew:munchmew', 'siamew:munchmew', 'siamew:siamew']) if (!seen.has(want)) fail('never hatched ' + want);
  const g = makeBaby({ sp: 'gingersnap', cat: 'tuxpurr' }, { sp: 'gingersnap', cat: 'tuxpurr' }); if (g.sp !== 'gingersnap' || g.cat !== 'tuxpurr') fail('a coat should pass down ' + JSON.stringify(g));
  for (let i = 0; i < 50; i++) if (makeBaby({ sp: 'mossbun' }, { sp: 'siamew' }).cat) fail('a bunny parent gave a cat coat');
  // every family works the same way: build from one parent, colours from either, and never a hybrid
  const bun = new Set(); for (let i = 0; i < 300; i++) { const k = makeBaby({ sp: 'mossbun' }, { sp: 'moonbun' }); if (!['mossbun', 'moonbun'].includes(k.sp) || k.cat === k.sp) fail('odd bunny ' + JSON.stringify(k)); bun.add(k.sp + ':' + catCoat(k)); if (k.cat && lookOf(k)?.cat !== k.cat) fail('bunny coat not drawn'); }
  if (bun.size !== 4) fail('bunnies should mix both ways: ' + [...bun]);
  if (hybridOf('cindercub', 'snowfox') || hybridOf('zapkit', 'siamew')) fail('kin made a hybrid');
  if (!hybridOf('cindercub', 'pebblet')) fail('hybrids are gone');
  if (lookOf({ sp: 'mossbun', cat: 'cindercub' })?.cat) fail('a coat from outside the family was drawn');
  // element variants: a one-element baby can take a parent's element, which replaces its own; hybrids never do
  const { variantOdds } = await import('../public/games/farm/breed.js'), { unit, movesAt } = await import('../public/games/farm/battle.js'), { elOf, atHome, ZONES: Z } = await import('../public/games/farm/data.js');
  let vn = 0; for (let i = 0; i < 2000; i++) { const k = makeBaby({ sp: 'sizzlet' }, { sp: 'puddlepup' }); if (k.el) { if (k.el !== (k.sp === 'sizzlet' ? 'Tide' : 'Ember')) fail('wrong variant ' + JSON.stringify(k)); vn++; } }
  if (vn < 200 || vn > 400) fail('variants should be about 15%: ' + vn / 20);
  for (let i = 0; i < 200; i++) { if (makeBaby({ sp: 'sizzlet' }, { sp: 'cindercub' }).el) fail('same element made a variant'); const h = makeBaby({ sp: 'magmutt' }, { sp: 'magmutt', el: 'Tide' }); if (h.el) fail('a hybrid got a variant'); }
  let kept = 0; for (let i = 0; i < 400; i++) if (makeBaby({ sp: 'sizzlet', el: 'Tide' }, { sp: 'sizzlet', el: 'Tide' }).el === 'Tide') kept++;
  if (kept < 250) fail('a variant should pass down: ' + kept);
  // Nest charms: the Element Charm lifts variants to 40%, the Hybrid Charm hybrids to 40%, the Pattern Charm keeps a marking, the Sparkle Charm x4
  { const { charmsFor, sparkleOdds, speciesOdds } = await import('../public/games/farm/breed.js'); let ve = 0, hy = 0, hy0 = 0, pk = 0;
    for (let i = 0; i < 3000; i++) { const k = makeBaby({ sp: 'sizzlet' }, { sp: 'puddlepup' }, Math.random, { el: true }); if (k.el) ve++; }
    if (ve < 3000 * .3 || ve > 3000 * .5) fail('an Element Charm should give about 40% variants: ' + ve / 30);
    for (let i = 0; i < 3000; i++) { if (SPECIES[makeBaby({ sp: 'cindercub' }, { sp: 'puddlepup' }, Math.random, { hyb: true }).sp].el2) hy++; if (SPECIES[makeBaby({ sp: 'cindercub' }, { sp: 'puddlepup' }).sp].el2) hy0++; }
    if (hy < 3000 * .33 || hy > 3000 * .47 || hy0 > 3000 * .26) fail('a Hybrid Charm should give about 40% hybrids: ' + hy / 30 + ' vs ' + hy0 / 30);
    for (let i = 0; i < 500; i++) { const k = makeBaby({ sp: 'mossbun', pat: ['spots'] }, { sp: 'mossbun' }, Math.random, { pat: true }); if (k.pat.includes('spots')) pk++; }
    if (pk !== 500) fail('a Pattern Charm should always keep the marking: ' + pk);
    const can = charmsFor({ sp: 'mossbun' }, { sp: 'mossbun' }); if (can.hyb || can.el || can.pat || !can.spk) fail('charms for two plain bunnies ' + JSON.stringify(can));
    const can2 = charmsFor({ sp: 'cindercub', pat: ['star'] }, { sp: 'puddlepup' }); if (!can2.hyb || !can2.el || !can2.pat) fail('charms for a mixed pair ' + JSON.stringify(can2));
    if (sparkleOdds({}, {}, { spk: true }) !== 4 / 64 || sparkleOdds({ sparkle: true }, { sparkle: true }, { spk: true }) !== .5) fail('sparkle odds');
    if (speciesOdds('cindercub', 'puddlepup', { hyb: true }).find(o => o.hybrid).p !== .4) fail('hybrid odds shown with a charm'); }
  const tv = { id: 'x', sp: 'sizzlet', name: 'T', lv: 12, el: 'Tide' }, u = unit(tv);
  if (u.el !== 'Tide' || u.moves[0] !== 'splash' || u.moves.length !== 4 || lookOf(tv)?.el !== 'Tide') fail('variant battle unit ' + JSON.stringify(u.moves));
  if (unit({ ...tv, el: 'Ember' }).moves[0] !== movesAt('sizzlet', 12)[0] || lookOf({ ...tv, el: 'Ember' })?.el || elOf({ sp: 'magmutt', el: 'Tide' }) !== 'Ember') fail('a base element is not a variant');
  if (!atHome(Z.cove, 'sizzlet', 'Tide') || atHome(Z.hills, 'sizzlet', 'Tide') || !variantOdds('mossbun', { sp: 'magmutt' }, { sp: 'mossbun' }).length) fail('variant home or odds'); }

await boot();
const a = player('Ana'); await a.ready;
let r = await a.farmDo({ t: 'open', test: { weather: 'none' } }); // the weather's bonuses are checked on their own further down
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
  ['fraction', { t: 'place', type: 'fence', x: 5.25, y: 6, r: 0 }],
  ['bad rotation', { t: 'place', type: 'fence', x: 6, y: 6, r: 7 }],
  ['eighth of a turn too fine', { t: 'place', type: 'bush', x: 6, y: 6, r: .25 }],
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
r = await a.farmDo({ t: 'place', type: 'rock', x: 4.5, y: 5.5, r: 0 }); // a fence is thin (1 x .5): a small prop fits right beside it
if (r.err) fail('rock beside the thin fence: ' + r.err);
r = await a.farmDo({ t: 'place', type: 'bench', x: 0, y: 11, r: 3.5 }); // pieces may turn 45 degrees; a diagonal bench takes a 1 x 1 square
if (!r.err && !r.farm.items.some(i => i.type === 'bench' && i.r === 3.5)) fail('diagonal bench not saved');
r = { err: 1 }; // buildings snap to half tiles too
for (const [x, y] of [[.5, 8.5], [1.5, 9.5], [6.5, 3.5], [2.5, 3.5], [8.5, 1.5]]) if (r.err) r = await a.farmDo({ t: 'place', type: 'garden', x, y, r: 0 });
if (r.err) fail('building on half tiles: ' + r.err);
r = { err: 1 }; // every decoration snaps to half tiles, so it can sit flush with a fence
for (const [x, y] of [[.5, 8.5], [1.5, 9.5], [6.5, 3.5], [2.5, 3.5], [8.5, 1.5]]) if (r.err) r = await a.farmDo({ t: 'place', type: 'picnic', x, y, r: 0 });
if (r.err) fail('whole-tile decoration on half tiles: ' + r.err);
r = await a.farmDo({ t: 'place', type: 'bench', x: 3.5, y: 6.5, r: 1 }); // a bench is 1 x .5, turned it is .5 x 1
if (r.err) fail('turned bench on half tiles: ' + r.err);
r = await a.farmDo({ t: 'place', type: 'rock', x: 3.5, y: 7, r: 0 });
if (!r.err) fail('rock placed inside the turned bench');
r = await a.farmDo({ t: 'place', type: 'rock', x: 4, y: 7, r: 0 });
if (r.err) fail('rock right beside the bench: ' + r.err);
const small = a.farm.items.length;
for (const [what, act] of [
  ['fence on a quarter tile', { t: 'place', type: 'fence', x: 6.5, y: 6.25, r: 0 }],
  ['eighth of a tile', { t: 'place', type: 'rock', x: 6.125, y: 6, r: 0 }],
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
// a species the farm never had wears a "new" label until its card is opened
if (wild.sp !== me.sp && (!wild.nu || !r.back.fresh)) fail('first-ever species not marked new ' + JSON.stringify([wild.nu, r.back.fresh]));
if (wild.sp === me.sp && (wild.nu || r.back.fresh)) fail('a species already owned marked new');
r = await a.farmDo({ t: 'seen', id: wild.id });
if (r.err || r.farm.pets.find(x => x.id === wild.id).nu) fail('seen did not clear the new label');
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

// far expeditions: Legend Isle opens with a bigger farmhouse, takes only Voyages, and each party pays crystal and Trail Packs
await wait(2100); // the server takes about 20 messages a second; let the budget refill
r = await a.farmDo({ t: 'send', zone: 'legend', trip: 'voyage', pets: [me.id] });
if (!r.err) fail('Legend Isle open at farmhouse 2');
r = await a.farmDo({ t: 'cook', what: 'pack' });
if (!r.err) fail('Trail Packs cooked before the farmhouse allows');
const house0 = a.farm.house; await a.farmDo({ t: 'open', test: { house: ZONES.legend.house } });
r = await a.farmDo({ t: 'send', zone: 'legend', trip: 'camp', pets: [me.id] });
if (!r.err) fail('a Camp-out reached a far island');
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'voyage', pets: [me.id] });
if (!r.err) fail('a Voyage went to a near island');
r = await a.farmDo({ t: 'send', zone: 'legend', trip: 'voyage', pets: [me.id] });
if (!r.err || r.farm.trip) fail('a Voyage set off without fuel');
if (countOf(a.farm, 'kitchen')) { await a.farmDo({ t: 'open', test: { give: { berries: 8, fiber: 10, coal: 4 } } }); r = await a.farmDo({ t: 'cook', what: 'pack' }); if (r.err || !(r.farm.inv.pack >= 1)) fail('Trail Pack ' + r.err); }
// the Kitchen cooks several at once (the ×5 button), at most COOK_MAX, and only when all of them can be paid for
if (countOf(a.farm, 'kitchen')) {
  await a.farmDo({ t: 'open', test: { give: { berries: 20 - (a.farm.inv.berries || 0) } } });
  const c0 = a.farm.inv.cookie || 0; r = await a.farmDo({ t: 'cook', what: 'cookie', n: 5 });
  if (r.err || r.farm.inv.berries !== 0 || r.farm.inv.cookie - c0 !== r.made || r.made < 5) fail('cook five ' + JSON.stringify([r.err, r.made, r.farm?.inv.berries]));
  await a.farmDo({ t: 'open', test: { give: { berries: 12 } } }); r = await a.farmDo({ t: 'cook', what: 'cookie', n: 5 });
  if (!r.err || r.farm.inv.berries !== 12) fail('cooked five without the berries for them');
  await a.farmDo({ t: 'open', test: { give: { berries: 100 } } }); r = await a.farmDo({ t: 'cook', what: 'cookie', n: 99 });
  if (r.err || r.farm.inv.berries !== 112 - 40) fail('cook should stop at ten ' + r.farm?.inv.berries);
}
await a.farmDo({ t: 'open', test: { give: { crystal: TRIPS.voyage.fuel.crystal, pack: TRIPS.voyage.fuel.pack } } });
await wait(1100);
const fuel0 = { ...a.farm.inv };
r = await a.farmDo({ t: 'send', zone: 'legend', trip: 'voyage', pets: [me.id] });
if (r.err || r.farm.trip?.zone !== 'legend' || r.farm.inv.crystal !== fuel0.crystal - TRIPS.voyage.fuel.crystal || (r.farm.inv.pack || 0) !== fuel0.pack - TRIPS.voyage.fuel.pack) fail('far send ' + JSON.stringify(r.err || r.farm.inv));
if (r.farm.trip.left <= (TRIPS.voyage.min - 1) * 60_000 * .7) fail('a Voyage came back too soon');
r = await a.farmDo({ t: 'collect', test: { home: true, trips: 5 } });
if (r.err || r.farm.far !== 1) fail('far trip not counted ' + JSON.stringify(r.err || r.farm.far));
const farFound = r.back.found && r.farm.pets.find(x => x.id === r.back.found);
if (farFound && !SPECIES[farFound.sp].far) fail('a far island gave a pet from elsewhere: ' + farFound.sp);
for (const sp of Object.keys(ZONES.legend.wild)) if (!SPECIES[sp]?.far || Object.entries(ZONES).some(([k, z]) => k !== 'legend' && sp in z.wild)) fail(sp + ' should live only on Legend Isle');
await a.farmDo({ t: 'open', test: { house: house0 } });
await wait(1100);

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
if (!r.prize || !r.prize.counted || r.prize.xp <= 0 || !r.prize.learnt || r.farm.fights.practice !== 9) fail('practice prize ' + JSON.stringify(r.prize));
const after = r.farm.pets.find(x => x.id === mine[0]);
if (after.lv === lv0 && after.xp !== xp0 + r.prize.xp) fail('practice xp not added');
if (!r.ev.some(e => e.k === 'end')) fail('no end event');
r = await a.farmDo({ t: 'bact', move: 'leafflick' });
if (r.battle) fail('battle should be gone after it ends');
// giving up counts as a loss and earns nothing
await a.farmDo({ t: 'fight', mode: 'practice', pets: [mine[0]] });
r = await a.farmDo({ t: 'bquit' });
if (!r.prize || r.prize.won || r.prize.counted || r.prize.learnt || r.prize.xp || r.farm.fights.practice !== 9) fail('quit ' + JSON.stringify(r.prize));
// the arena: neighbours and other players, every pet at its real level (2026-11-27)
r = await a.farmDo({ t: 'foes' });
const bo = r.foes.find(x => !x.npc);
if (r.foes.filter(x => x.npc).length !== 3 || !bo || bo.name !== 'Bo' || bo.team[0].sp !== 'puddlepup' || JSON.stringify(r.foes).includes(b.me?.pid || 'no-pid')) fail('foes ' + JSON.stringify(r.foes));
r = await a.farmDo({ t: 'ranks' });
if (!r.ranks || r.ranks.some(x => x.npc || ['Mira', 'Bruno', 'Farmer Hazel'].includes(x.name)) || r.ranks.filter(x => x.me).length !== 1 || !r.ranks.some(x => x.name === 'Bo' && !x.me) || r.ranks.some((x, i) => i && x.pts > r.ranks[i - 1].pts)) fail('ranks ' + JSON.stringify(r.ranks));
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: 'nobody', pets: [mine[0]] });
if (!r.err) fail('fought a farm that does not exist');
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: bo.id, pets: mine.slice(0, 2) });
if (r.err || r.battle.sides[0].pets[0].lv !== a.farm.pets.find(x => x.id === mine[0]).lv || r.battle.sides[1].pets[0].lv !== bo.team[0].lv || r.battle.foe !== 'Bo') fail('arena start ' + JSON.stringify(r.err || r.battle.sides.map(s => s.pets.map(x => x.lv))));
const coins0 = a.farm.inv.coins;
r = await playOut(r);
if (!r.prize.counted || r.farm.inv.coins !== coins0 + r.prize.coins || r.farm.pts !== r.prize.pts || r.farm.fights.arena !== 4) fail('arena prize ' + JSON.stringify(r.prize));
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: 'npc:hazel', pets: mine.slice(0, 2) });
if (r.err || r.battle.sides[1].pets.length !== 2 || r.battle.sides[1].pets.some(x => x.lv !== Math.round((r.battle.sides[0].pets[0].lv + r.battle.sides[0].pets[1].lv) / 2))) fail('npc fight ' + JSON.stringify(r.err || r.battle.sides[1].pets.map(x => x.lv)));
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
// a new look reaches the player's own screen and the map others see
b.me = null; b.send({ t: 'profile', name: 'Bo', color: '#7bd389', av: [1, 3, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
await until(() => b.me, 'me after a profile change');
if (b.me.color !== '#7bd389' || !Array.isArray(b.me.av)) fail('new look not sent back ' + JSON.stringify(b.me));
r = await a.farmDo({ t: 'world' });
if (r.world.find(x => x.name === 'Bo')?.color !== '#7bd389') fail('map shows the old look ' + JSON.stringify(r.world).slice(0, 200));
r = await b.farmDo({ t: 'visit', id: 'nobody' });
if (!r.err) fail('visited a farm that does not exist');
r = await b.farmDo({ t: 'visit', id: ana.id });
if (r.err || r.visit.name !== 'Ana' || r.visit.pets.length !== a.farm.pets.length || r.visit.pets[0].xp !== undefined) fail('visit ' + JSON.stringify(r));
// the owner sees who is visiting, until they head off again
r = await a.farmDo({ t: 'open' });
if (r.farm.guests?.length !== 1 || r.farm.guests[0].name !== 'Bo') fail('owner does not see the visitor ' + JSON.stringify(r.farm.guests));
await b.farmDo({ t: 'world' });
r = await a.farmDo({ t: 'open' });
if (r.farm.guests.length) fail('visitor still shown after leaving');
await b.farmDo({ t: 'visit', id: ana.id });
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
r = await b.farmDo({ t: 'gift', id: ana.id, mat: 'coins' });
if (!r.err || !r.visit.gift) fail('coins gifted');
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
// one job at a time: a pet cuddling in the Nest cannot explore, fight or train
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [kin[0]] });
if (!/Nest/.test(r.err || '')) fail('a cuddling pet went exploring: ' + r.err);
r = await a.farmDo({ t: 'fight', mode: 'practice', pets: [kin[0]] });
if (!/Nest/.test(r.err || '') || r.battle) fail('a cuddling pet went to fight: ' + r.err);
r = await a.farmDo({ t: 'train', pets: [kin[1]] });
if (!/Nest/.test(r.err || '')) fail('a cuddling pet started training: ' + r.err);
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
if (![a.farm.pets.find(x => x.id === kin[0]).sp, a.farm.pets.find(x => x.id === kin[1]).sp, 'truffowl', 'magmutt', 'nimbowhale', 'glimmoth', 'geodeer', 'maplander', 'koalith', 'kettlephant', 'bangaroo', 'magnebug'].includes(kid.sp)) fail('baby species ' + kid.sp);
// favourites: Bo hearts a pet and un-hearts it; visitors never see the mark
r = await b.farmDo({ t: 'fav', id: b.farm.pets[0].id, on: true });
if (r.err || r.farm.pets[0].fav !== true) fail('fav on ' + r.err);
r = await b.farmDo({ t: 'open' });
if (r.farm.pets[0].fav !== true) fail('fav did not stay');
r = await b.farmDo({ t: 'fav', id: b.farm.pets[0].id, on: false });
if (r.err || r.farm.pets[0].fav) fail('fav off ' + r.err);
await b.farmDo({ t: 'fav', id: b.farm.pets[0].id, on: true });
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
if (!r.err || r.farm.trades.length) fail('coins asked for in a trade');
r = await a.farmDo({ t: 'offer', to: boId, give: { mats: { coins: 5 } }, want: { mats: { stone: 1 } } });
if (!r.err || r.farm.trades.length) fail('coins offered in a trade');
{ const c0 = r.farm.inv.coins; r = await a.farmDo({ t: 'open', test: { oldOffer: boId } }); // an offer saved before coins stopped being tradable goes back whole
  if (r.farm.trades.length || r.farm.inv.coins !== c0 || !r.farm.mail.some(m => /coins can no longer be traded/.test(m.text || ''))) fail('old coin offer not sent back ' + JSON.stringify(r.farm.trades)); }
r = await a.farmDo({ t: 'offer', to: boId, give: { mats: { wood: 20 } }, want: { mats: { stone: 1 } } });
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
r = await a.farmDo({ t: 'offer', to: boId, give: { pets: [spare.id], mats: { wood: 5 } }, want: { mats: { stone: 2 } } });
if (r.err || !r.farm.pets.find(x => x.id === spare.id).held) fail('pet offer ' + r.err);
r = await a.farmDo({ t: 'tradecancel', id: r.farm.trades[0].id });
if (r.err || r.farm.pets.find(x => x.id === spare.id).held || r.farm.inv.wood !== tWood) fail('cancel ' + r.err);
r = await a.farmDo({ t: 'offer', to: boId, give: { pets: [spare.id], mats: { wood: 5 } }, want: { mats: { stone: 2 } } });
await b.farmDo({ t: 'open', test: { give: { wood: 100, stone: 100, coins: 10 } } });
r = { err: 1 }; for (let y = 0; y < 9 && r.err; y++) for (let x = 0; x < 9 && r.err; x++) { r = await b.farmDo({ t: 'place', type: 'hut', x, y, r: 0 }); await wait(30); }
const bStone = b.farm.inv.stone, bPets = b.farm.pets.length, aPets = a.farm.pets.length, aStone = a.farm.inv.stone;
r = await b.farmDo({ t: 'tradeans', id: b.farm.trades[0].id, ok: true });
if (r.err || r.farm.pets.length !== bPets + 1 || r.farm.inv.stone !== bStone - 2 || !r.farm.pets.some(x => x.id === spare.id && x.first === 'ana' && !x.held)) fail('accept ' + JSON.stringify(r.err));
r = await a.farmDo({ t: 'open' });
if (r.farm.pets.length !== aPets - 1 || r.farm.inv.stone !== aStone + 2 || r.farm.trades.length) fail('trade did not settle for the sender');

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
const eater = r.farm.pets.find(x => x.lv < 8), eat0 = [eater.lv, eater.xp];
r = await a.farmDo({ t: 'feed', what: 'cookie', pet: eater.id });
const ate = r.farm.pets.find(x => x.id === eater.id);
if (r.err || r.farm.inv.cookie || (ate.lv === eat0[0] && ate.xp <= eat0[1])) fail('feed ' + r.err);
r = await a.farmDo({ t: 'feed', what: 'cookie', pet: eater.id });
if (!r.err) fail('fed a treat that was not there');
// the Workshop swaps materials (level 1 keeps 40%): 25 wood for 5 shells, 1 crystal for 8 shells; it no longer buys for coins
r = await a.farmDo({ t: 'swap', give: 'wood', get: 'stone', n: 2 });
if (!a.farm.items.some(i => i.type === 'workshop')) { if (!r.err) fail('swapped without a Workshop'); await spot('workshop'); }
{ r = await a.farmDo({ t: 'open', test: { give: { crystal: 1 } } }); const w0 = { ...r.farm.inv };
  r = await a.farmDo({ t: 'swap', give: 'wood', get: 'shells', n: 2 });
  if (r.err || r.farm.inv.wood !== w0.wood - 50 || r.farm.inv.shells !== (w0.shells || 0) + 10 || r.farm.inv.coins !== w0.coins) fail('swap ' + r.err);
  r = await a.farmDo({ t: 'swap', give: 'crystal', get: 'shells', n: 1 });
  if (r.err || r.farm.inv.crystal !== w0.crystal - 1 || r.farm.inv.shells !== (w0.shells || 0) + 18) fail('swap crystal ' + r.err);
  for (const bad of [{ give: 'coins', get: 'wood' }, { give: 'wood', get: 'coins' }, { give: 'wood', get: 'wood' }, { give: 'crystal', get: 'wood', n: 999 }]) { r = await a.farmDo({ t: 'swap', ...bad }); if (r.farm.inv.wood !== w0.wood - 50 || r.farm.inv.coins !== w0.coins) fail('bad swap went through ' + JSON.stringify(bad)); }
  r = await a.farmDo({ t: 'sell', mat: 'wood', lots: 2 }); if (!r.err || r.farm.inv.coins !== w0.coins) fail('old sell still pays coins');
  const top = r.farm.cap - r.farm.inv.shells; r = await a.farmDo({ t: 'open', test: { give: { shells: top } } }); r = await a.farmDo({ t: 'swap', give: 'wood', get: 'shells' }); if (!r.err) fail('swapped past the storage cap');
  r = await a.farmDo({ t: 'open', test: { give: { shells: -top } } }); }
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
// a pet on an expedition cannot start training, and leaving on one ends its training
r = await a.farmDo({ t: 'open', test: { home: true } });
for (const t of r.farm.trips) r = await a.farmDo({ t: 'collect', id: t.id });
if (!a.farm.items.some(i => i.type === 'gate')) await spot('gate');
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [trainee.id] });
if (r.err) fail('send the trainee: ' + r.err);
if (r.farm.train.ids.includes(trainee.id)) fail('still training while exploring');
r = await a.farmDo({ t: 'train', pets: [trainee.id] });
if (!r.err || r.farm.train.ids.length) fail('an exploring pet started training');
r = await a.farmDo({ t: 'open', test: { home: true } });
r = await a.farmDo({ t: 'train', pets: [trainee.id] });
if (!r.err) fail('a pet waiting to be welcomed home started training');
for (const t of r.farm.trips) r = await a.farmDo({ t: 'collect', id: t.id });
r = await a.farmDo({ t: 'fight', mode: 'wild' }); if (r.battle) await playOut(r);
r = await a.farmDo({ t: 'train', pets: [] });
r = await a.farmDo({ t: 'place', type: 'palflag', x: 0, y: 0, r: 0, test: { pals: 0 } });
if (a.farm.palpts < 15 && !r.err) fail('friendship decoration without the points');
r = await a.farmDo({ t: 'open', test: { pals: 20 } });
if (r.farm.palpts < 20) fail('friendship points ' + r.farm.palpts);
r = await a.farmDo({ t: 'visit', id: boId });
if (r.err || !r.visit.album || !Object.keys(r.visit.album).length) fail('no album on a visit');

// ----- a gift for every farm, sent from the server's command line -----
fs.writeFileSync(path.join(DATA_DIR, 'gift-all.json'), JSON.stringify({ mats: { wood: 7, nonsense: 5 }, text: 'Happy weekend' }));
await until(() => a.farm.mail.some(m => m.from === 'Zatoka Gier'), 'server-wide gift', 9000);
const sg = a.farm.mail.find(m => m.from === 'Zatoka Gier'), sgw = a.farm.inv.wood;
if (sg.got.wood !== 7 || sg.got.nonsense || sg.text !== 'Happy weekend' || fs.existsSync(path.join(DATA_DIR, 'gift-all.json'))) fail('server gift ' + JSON.stringify(sg));
r = await b.farmDo({ t: 'open' });
if (!r.farm.mail.some(m => m.from === 'Zatoka Gier')) fail('server gift missed a farm');
if (a.farm.items.some(i => i.type === 'mailbox')) { r = await a.farmDo({ t: 'claim', id: sg.id }); if (r.err || r.farm.inv.wood !== sgw + 7) fail('claim server gift ' + r.err); }

// ----- several parties, and a second and third Nest slot -----
r = await a.farmDo({ t: 'open', test: { give: { wood: 500, stone: 500, fiber: 500, shells: 60, coal: 60, crystal: 9 }, home: true, lv: 8, rested: true, egg: 'ready' } });
for (const q of r.farm.trips) { await a.farmDo({ t: 'collect', id: q.id }); await wait(40); }
while (a.farm.nests.length) { r = await a.farmDo({ t: 'hatch', slot: a.farm.nests[0].slot }); if (r.err) fail('clearing the nest ' + r.err); await wait(40); }
while (a.farm.pets.length < 8) { await a.farmDo({ t: 'open', test: { pet: 'mossbun' } }); await wait(40); }
r = await a.farmDo({ t: 'open', test: { lv: 8, rested: true } });
const P = r.farm.pets.map(x => x.id), gate = r.farm.items.find(i => i.type === 'gate'), nestB = r.farm.items.find(i => i.type === 'nest');
if (!gate || !nestB) fail('the test farm needs a gate and a nest');
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [P[0]] });
if (r.err || r.farm.trips.length !== 1) fail('first party ' + r.err);
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [P[1]] });
if (r.farm.partyMax === 1 && !r.err) fail('second party from a level 1 gate');
while (lvOfItem(a.farm, gate.id) < 2) { r = await a.farmDo({ t: 'upgrade', id: gate.id }); if (r.err) { r = await a.farmDo({ t: 'houseup', test: { give: { wood: 300, stone: 300, fiber: 200, shells: 30, coal: 30, crystal: 5 } } }); if (r.err) fail('could not raise the farmhouse: ' + r.err); } await wait(40); }
// neighbours see a building at its level, on the map and on a visit, so it looks the same to them
{ const w = (await b.farmDo({ t: 'world' })).world.find(x => x.name === 'Ana'), v = (await b.farmDo({ t: 'visit', id: w.id })).visit;
  if (w.items.find(i => i.id === gate.id)?.lv !== 2 || v.items.find(i => i.id === gate.id)?.lv !== 2 || w.house !== a.farm.house || v.house !== a.farm.house) fail('neighbours do not see the gate level ' + JSON.stringify(w.items.find(i => i.id === gate.id)));
  if (w.items.some(i => i.lv === 1)) fail('level 1 should not be sent'); }
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [P[0]] });
if (!r.err) fail('one pet in two parties');
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'outing', pets: [P[1]] });
if (r.err || r.farm.trips.length !== 2 || r.farm.partyMax !== 2) fail('second party ' + r.err);
r = await a.farmDo({ t: 'open', test: { home: true } });
const two = r.farm.trips.map(q => q.id);
r = await a.farmDo({ t: 'collect', id: two[1] });
if (r.err || r.farm.trips.length !== 1 || r.farm.trips[0].id !== two[0] || r.back.trip !== 'outing') fail('collect the second party ' + r.err);
r = await a.farmDo({ t: 'collect', id: two[0] });
if (r.err || r.farm.trips.length) fail('collect the first party ' + r.err);
r = await a.farmDo({ t: 'open', test: { rested: true } });
r = await a.farmDo({ t: 'pair', a: P[2], b: P[3] });
if (r.err || r.farm.nests.length !== 1) fail('first nest slot ' + r.err);
r = await a.farmDo({ t: 'pair', a: P[4], b: P[5] });
if (r.farm.nestMax === 1 && !r.err) fail('second egg in a level 1 nest');
while (lvOfItem(a.farm, nestB.id) < 2) { r = await a.farmDo({ t: 'upgrade', id: nestB.id }); if (r.err) fail('nest upgrade ' + r.err); await wait(40); }
r = await a.farmDo({ t: 'pair', a: P[2], b: P[4] });
if (!r.err) fail('a pet in both nest slots');
r = await a.farmDo({ t: 'pair', a: P[4], b: P[5] });
if (r.err || r.farm.nests.length !== 2 || r.farm.nests[1].slot !== 'nest2') fail('second nest slot ' + r.err);
r = await a.farmDo({ t: 'pair', a: P[6], b: P[7] });
if (!r.err) fail('third egg in a level 2 nest');
while (lvOfItem(a.farm, nestB.id) < 3) { r = await a.farmDo({ t: 'upgrade', id: nestB.id }); if (r.err) { r = await a.farmDo({ t: 'houseup', test: { give: { wood: 300, stone: 300, fiber: 200, shells: 30, coal: 30, crystal: 5 } } }); if (r.err) fail('could not raise the farmhouse for the nest: ' + r.err); } await wait(40); }
r = await a.farmDo({ t: 'pair', a: P[6], b: P[7] });
if (r.err || r.farm.nests.length !== 3 || r.farm.nests[2].slot !== 'nest3' || r.farm.nestMax !== 3) fail('third nest slot ' + r.err);
r = await a.farmDo({ t: 'open', test: { egg: 'ready', give: { wood: 200, fiber: 100 } } });
while (a.farm.pets.length + 3 > a.farm.room) { await spot('hut'); }
r = await a.farmDo({ t: 'hatch', slot: 'nest3' });
if (r.err || r.farm.nests.length !== 2) fail('hatch slot three ' + r.err);
r = await a.farmDo({ t: 'hatch', slot: 'nest2' });
if (r.err || r.farm.nests.length !== 1 || r.farm.nests[0].slot !== 'nest') fail('hatch slot two ' + r.err);
r = await a.farmDo({ t: 'hatch', slot: 'nest' });
if (r.err || r.farm.nests.length || r.farm.nest) fail('hatch slot one ' + r.err);
r = await a.farmDo({ t: 'open', test: { rested: true } });

// ----- decorations as gifts, kitchen levels, sunberries, rank experience -----
r = await b.farmDo({ t: 'visit', id: ana.id, test: { give: { wood: 50 } } });
r = await b.farmDo({ t: 'gift', id: ana.id, item: 'fence' });
if (r.err && !/One gift a day/.test(r.err)) fail('decoration gift ' + r.err);
if (!r.err) {
  r = await a.farmDo({ t: 'open' }); const dg = r.farm.mail.find(m => m.item === 'fence'); if (!dg) fail('gifted decoration not in the mailbox');
  if (!a.farm.items.some(i => i.type === 'mailbox')) await spot('mailbox');
  r = await a.farmDo({ t: 'claim', id: dg.id }); if (r.err || r.farm.stash.fence !== 1) fail('claim decoration ' + r.err);
  const fw = r.farm.inv.wood; r = { err: 1 }; for (let y = 0; y < 12 && r.err; y++) for (let x = 0; x < 12 && r.err; x++) { r = await a.farmDo({ t: 'place', type: 'fence', x, y, r: 0 }); await wait(30); }
  if (r.err || r.farm.inv.wood !== fw || r.farm.stash.fence) fail('gifted decoration was not free ' + r.err);
  // put away, a gift goes back to the stash: its cost was the giver's, so it is never paid out (that moved coins between players)
  const gi = r.farm.items.filter(i => i.type === 'fence').pop(); r = await a.farmDo({ t: 'remove', id: gi.id });
  if (r.err || r.farm.inv.wood !== fw || r.farm.stash.fence !== 1 || r.got) fail('a gifted decoration paid its cost back ' + JSON.stringify([r.err, r.farm.inv.wood, fw, r.farm.stash]));
  r = { err: 1 }; for (let y = 0; y < 12 && r.err; y++) for (let x = 0; x < 12 && r.err; x++) { r = await a.farmDo({ t: 'place', type: 'fence', x, y, r: 0 }); await wait(30); }
  if (r.err || r.farm.stash.fence) fail('gift placed again ' + r.err);
}
r = await a.farmDo({ t: 'cook', what: 'pie', test: { give: { sunberry: 10, berries: 30 } } });
if (!r.err) fail('level 2 recipe in a level 1 kitchen');
r = await a.farmDo({ t: 'upgrade', id: a.farm.items.find(i => i.type === 'kitchen').id, test: { give: { wood: 100, stone: 100, shells: 10 } } });
if (r.err) fail('kitchen upgrade ' + r.err);
r = await a.farmDo({ t: 'cook', what: 'pie' });
if (r.err || r.farm.inv.pie !== 1) fail('pie ' + r.err);
r = await a.farmDo({ t: 'upgrade', id: a.farm.items.find(i => i.type === 'garden').id, test: { ripe: true } });
const sun0 = r.farm.inv.sunberry || 0; r = await a.farmDo({ t: 'pick' });
if (r.err || r.farm.inv.sunberry !== sun0 + 1) fail('sunberries ' + r.err);
if (!(a.me?.xp >= 15)) fail('no rank experience from the album ' + JSON.stringify(a.me));
r = await a.farmDo({ t: 'open', test: { ripe: true } });

// ----- live battles -----
r = await a.farmDo({ t: 'duel', to: boId, pets: [] });
if (!r.err) fail('live battle with no team');
// two players battling each other again and again stop earning after LIVE_DAILY rewarded battles a day
async function liveDuel(capped) {
  b.invite = null; r = await a.farmDo({ t: 'duel', to: boId, pets: [a.farm.pets[0].id] });
  if (r.err) fail('invite ' + r.err);
  await until(() => b.invite, 'live invite');
  if (b.invite.from !== 'Ana') fail('invite from ' + b.invite.from);
  a.battle = b.battle = null; a.fought = b.fought = null;
  await wait(300); const lc = [a.farm.inv.coins, b.farm.inv.coins];
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
  for (const [i, x] of [a, b].entries()) if (x.fought.farm.inv.coins !== lc[i] + (capped ? 0 : x.fought.prize.won ? 15 : 5) || x.fought.prize.counted === capped) fail('live prize coins ' + JSON.stringify([capped, x.fought.prize]));
}
await liveDuel(false);
await a.farmDo({ t: 'open', test: { liveUsed: 5 } }); await b.farmDo({ t: 'open', test: { liveUsed: 5 } });
await liveDuel(true);
r = await a.farmDo({ t: 'open' });
if (r.battle) fail('live battle still running');

// a wild pet met on the way home: one short battle, and it joins on a win if there is a bed
r = await a.farmDo({ t: 'open', test: { wild: 'acornip', wildTraits: { col: [3, 3], pat: ['spots'], sparkle: true }, lv: 20, rested: true } });
if (r.farm.wild?.sp !== 'acornip') fail('no wild pet waiting');
if (!r.farm.garden.grow) fail('no garden growth in the view');
const nPets = r.farm.pets.length;
r = await a.farmDo({ t: 'fight', mode: 'wild' });
if (r.err || r.battle.mode !== 'wild' || r.battle.sides[1].pets.length !== 1) fail('wild battle start ' + JSON.stringify(r.err));
if (r.battle.sides[1].pets[0].look?.coat !== '#a9e3bd' || !r.battle.sides[1].pets[0].look?.spark) fail('wild pet not shown as it really looks ' + JSON.stringify(r.battle.sides[1].pets[0].look));
r = await playOut(r);
if (!r.prize) fail('wild battle did not end');
if (r.prize.won && !r.prize.joined && !r.prize.noroom) fail('won but nothing happened');
if (r.prize.joined && r.farm.pets.length !== nPets + 1) fail('wild pet did not move in');
{ const j = r.prize.joined && r.farm.pets.find(x => x.id === r.prize.joined); if (j && (j.look?.coat !== '#a9e3bd' || !j.look?.pat?.includes('spots') || !j.sparkle)) fail('the wild pet that joined looks different from the one fought ' + JSON.stringify(j.look)); }
if (r.farm.wild) fail('wild pet still waiting');
if (!r.farm.album.acornip) fail('acornip not in the album');

// restart: the farm is still there, and logging in from a new browser finds it
// weather only ever adds: rain gives a berry more from each plot, wind brings a party home sooner
r = await a.farmDo({ t: 'open', test: { weather: 'rain', ripe: true } });
if (r.farm.weather !== 'rain') fail('weather not pinned');
const wetPlots = r.farm.items.filter(i => i.type === 'garden').length;
if (wetPlots) { r = await a.farmDo({ t: 'pick' }); if (!r.err && r.wet !== wetPlots) fail('rain gave no extra berries: ' + JSON.stringify([r.wet, wetPlots, r.err])); }
{ const w1 = weatherAt(0), w2 = weatherAt(0); if (w1.kind !== w2.kind || !WEATHER[w1.kind] || !(w1.left > 0 && w1.left <= WEATHER_MS)) fail('weather is not a steady function of the clock'); }
{ const seen = new Set(); for (let i = 0; i < 400; i++) seen.add(weatherAt(i * WEATHER_MS).kind); if (seen.size !== Object.keys(WEATHER).length) fail('some weather never happens: ' + [...seen]); }
{ const hub = await import('../public/weather.js'); if (hub.WEATHER !== WEATHER || hub.weatherAt(123456789).kind !== weatherAt(123456789).kind) fail('the hub and the farm disagree about the weather');
  const t = 5 * WEATHER_MS + 1000, nx = hub.weatherNext(t); if (nx.kind !== weatherAt(6 * WEATHER_MS + 1).kind) fail('weatherNext is not the next spell'); }
// helpers at buildings: the right element only, boost from level and stars, one job at a time
r = await a.farmDo({ t: 'open', test: { pet: 'puddlepup', ripe: true } });
r = await a.farmDo({ t: 'open', test: { pet: 'cindercub' } });
{ const tide = r.farm.pets.at(-2), ember = r.farm.pets.at(-1);
  if (tide.sp !== 'puddlepup' || ember.sp !== 'cindercub') fail('test pets missing');
  r = await a.farmDo({ t: 'pick' }); const left0 = r.farm.garden.left;
  r = await a.farmDo({ t: 'work', type: 'garden', id: ember.id });
  if (!r.err || r.farm.work.garden) fail('an Ember pet waters the garden');
  r = await a.farmDo({ t: 'work', type: 'garden', id: tide.id });
  const pct = workPct(tide, 'garden');
  if (r.err || r.farm.work.garden !== tide.id || pct < 9 || pct > 40) fail('work ' + r.err + ' ' + pct);
  if (Math.abs(r.farm.garden.left - left0 * (1 - pct / 100)) > 5000) fail('garden boost: ' + [left0, r.farm.garden.left, pct]);
  if (workPct({ ...tide, lv: tide.lv + 5 }, 'garden') !== pct + 5 || workPct({ ...tide, stars: [3, 3, 3, 5] }, 'garden') <= workPct({ ...tide, stars: [3, 3, 3, 1] }, 'garden')) fail('boost ignores level or stars');
  if (!canWork({ sp: 'kettlephant' }, 'garden') || !canWork({ sp: 'kettlephant' }, 'kitchen') || canWork({ sp: 'kettlephant' }, 'nest')) fail('hybrid helper elements');
  r = await a.farmDo({ t: 'work', type: 'garden' });
  if (r.err || r.farm.work.garden || Math.abs(r.farm.garden.left - left0) > 5000) fail('helper sent home but the boost stayed');
  r = await a.farmDo({ t: 'work', type: 'garden', id: tide.id });
  if (r.farm.train.slots) { r = await a.farmDo({ t: 'train', pets: [tide.id] }); if (r.err || r.farm.work.garden) fail('a training pet still waters the garden ' + r.err); await a.farmDo({ t: 'train', pets: [] }); }
  r = await a.farmDo({ t: 'work', type: 'garden', id: tide.id }); if (r.err) fail('work again ' + r.err); }
// letting a pet go free: it leaves, berries arrive, the album keeps its page
r = await a.farmDo({ t: 'free', id: 'nobody' });
if (!r.err) fail('freed a pet that does not exist');
{ const before = r.farm, pages = Object.keys(before.album || {}).length; let freed = null;
  for (const q of before.pets) { r = await a.farmDo({ t: 'free', id: q.id }); if (!r.err) { freed = q; break; } }
  if (freed && before.def.includes(freed.id) && !r.farm.def.length) fail('nobody defends after a defender left');
  if (!freed) fail('no pet could be let go: ' + r.err);
  if (r.did !== 'free' || r.gone?.id !== freed.id || r.farm.pets.length !== before.pets.length - 1 || r.farm.pets.some(x => x.id === freed.id)) fail('free ' + JSON.stringify(r.gone));
  if (r.got < 4 || r.farm.inv.berries !== before.inv.berries + r.got) fail('free gift ' + r.got);
  if (Object.keys(r.farm.album || {}).length !== pages || !r.farm.album[freed.sp]?.some(Boolean)) fail('album lost a page after a pet left');
  if (r.farm.train.ids.includes(freed.id) || r.farm.def.includes(freed.id)) fail('a freed pet is still listed'); }
// the late game: a level 5 farmhouse, land up to 24 and the Pet Lodge. The island stays at 26 beds (Kuba's pick).
{ const c = player('Cy'); await c.ready;
  c.send({ t: 'register', user: 'cyra', pass: 'hunter22' }); await until(() => c.auth, 'register c');
  await c.farmDo({ t: 'starter', sp: 'mossbun' });
  const lots = { wood: 9000, stone: 9000, fiber: 9000, shells: 900, coal: 900, crystal: 90 };
  r = await c.farmDo({ t: 'open', test: { give: lots } });
  for (let i = 0; i < 6; i++) { r = await c.farmDo({ t: 'expand' }); if (r.err) fail('expand ' + i + ' ' + r.err); }
  if (c.farm.size !== 22) fail('land should reach 22 first, not ' + c.farm.size);
  r = await c.farmDo({ t: 'expand' }); if (!r.err || r.farm.size !== 22 || r.farm.next.house !== 5) fail('24 needs a level 5 farmhouse');
  for (let i = 0; i < 3; i++) { r = await c.farmDo({ t: 'houseup' }); if (r.err) fail('houseup ' + r.err); }
  r = await c.farmDo({ t: 'place', type: 'lodge', x: 1, y: 19, r: 0 }); if (r.err) fail('lodge at farmhouse 4 ' + r.err);
  const huts = [];
  for (let i = 0; i < 4; i++) { r = await c.farmDo({ t: 'place', type: 'hut', x: 1 + i * 3, y: 15, r: 0 }); if (i < 3 && r.err) fail('hut ' + r.err); if (!r.err) huts.push(r.farm.items.at(-1).id); }
  if (huts.length !== 3) fail('a fourth hut');
  if (c.farm.room !== 2 + 3 * 4 || c.farm.lodgeRoom !== 60 || c.farm.allRoom !== 74) fail('room at farmhouse 4 ' + [c.farm.room, c.farm.lodgeRoom]);
  r = await c.farmDo({ t: 'houseup' }); if (r.err || r.farm.house !== 5 || !r.farm.houseNext) fail('farmhouse 5 ' + r.err);
  if (r.farm.room !== 2 + 3 * 4) fail('farmhouse 5 should not add beds');
  r = await c.farmDo({ t: 'expand' }); if (r.err || r.farm.size !== 24 || r.farm.next) fail('land 24 ' + r.err);
  r = await c.farmDo({ t: 'place', type: 'hut', x: 13, y: 16, r: 0 }); if (!r.err) fail('a fourth hut at farmhouse 5');
  for (const id of huts) for (let n = 0; n < 2; n++) { r = await c.farmDo({ t: 'upgrade', id }); if (r.err) fail('hut level ' + (n + 2) + ' ' + r.err); }
  r = await c.farmDo({ t: 'upgrade', id: huts[0] }); if (!r.err) fail('hut past level 3');
  if (lvOfItem(c.farm, huts[0]) !== 3 || c.farm.room !== 26) fail('26 beds on the island, not ' + c.farm.room);
  const lodge = c.farm.items.find(i => i.type === 'lodge').id;
  if (c.farm.lodgeRoom !== 60) fail('a level 1 lodge stores 60, not ' + c.farm.lodgeRoom);
  for (let n = 0; n < 2; n++) { r = await c.farmDo({ t: 'upgrade', id: lodge }); if (r.err) fail('lodge level ' + r.err); }
  if (c.farm.lodgeRoom !== 300 || c.farm.allRoom !== 326) fail('lodge room ' + c.farm.lodgeRoom);
  for (let i = 0; i < 4; i++) { await c.farmDo({ t: 'open', test: { pet: 'mossbun' } }); await wait(60); }
  const [p1, p2, p3] = c.farm.pets.map(x => x.id);
  r = await c.farmDo({ t: 'lodge', ids: [p1, p2], on: true }); if (r.err || !r.farm.pets[0].lodge || !r.farm.pets[1].lodge) fail('store in the lodge ' + r.err);
  // storage: a stored pet cannot be sent anywhere, and is left out of the defence team
  r = await c.farmDo({ t: 'defend', pets: [p1] }); if (!r.err) fail('a stored pet defended');
  if (r.farm.def.includes(p1) || r.farm.def.includes(p2)) fail('stored pets in the defence team');
  r = await c.farmDo({ t: 'petopen', id: p1 }); if (!r.err) fail('a stored pet opened for playdates');
  { const inv0 = JSON.stringify(c.farm.inv); // refused twice: nothing may come back (the refund used to be paid before this check)
    for (let n = 0; n < 2; n++) { r = await c.farmDo({ t: 'remove', id: lodge }); if (!r.err) fail('a lodge with pets inside was put away'); }
    if (JSON.stringify(r.farm.inv) !== inv0) fail('a refused Lodge removal paid materials back ' + JSON.stringify(r.farm.inv) + ' vs ' + inv0); }
  // collections: make, rename, sort into, reorder, delete
  r = await c.farmDo({ t: 'shelf', op: 'new', name: 'Bunnies' }); const s1 = r.id; if (r.err || r.farm.shelves[0]?.name !== 'Bunnies') fail('new collection ' + r.err);
  r = await c.farmDo({ t: 'shelf', op: 'new', name: '<i>Best</i> of all the pets' }); const s2 = r.id; if (r.farm.shelves[1].name !== 'iBest/i of all t') fail('collection name not cleaned: ' + r.farm.shelves[1].name);
  r = await c.farmDo({ t: 'shelf', op: 'put', id: s1, ids: [p1, p2] }); if (r.err || r.farm.pets.filter(x => x.shelf === s1).length !== 2) fail('sort into a collection ' + r.err);
  r = await c.farmDo({ t: 'shelf', op: 'put', id: s1, ids: [p3] }); if (!r.err) fail('an island pet went into a collection');
  r = await c.farmDo({ t: 'shelf', op: 'name', id: s1, name: 'Fluffy' }); if (r.farm.shelves[0].name !== 'Fluffy') fail('rename collection');
  r = await c.farmDo({ t: 'shelf', op: 'left', id: s2 }); if (r.farm.shelves[0].id !== s2) fail('reorder collections');
  r = await c.farmDo({ t: 'lodge', ids: [p3], on: true, shelf: s2 }); if (r.farm.pets.find(x => x.id === p3).shelf !== s2) fail('store straight into a collection');
  r = await c.farmDo({ t: 'shelf', op: 'del', id: s1 }); if (r.farm.shelves.length !== 1 || r.farm.pets.some(x => x.shelf === s1) || !r.farm.pets.find(x => x.id === p1).lodge) fail('delete collection');
  r = await c.farmDo({ t: 'lodge', ids: [p1, p2, p3], on: false }); if (r.err || r.farm.pets.some(x => x.lodge || x.shelf)) fail('back to the island ' + r.err);
  // saved expedition groups: save, update, delete; pets that leave drop out of the group
  r = await c.farmDo({ t: 'group', op: 'save', name: 'Diggers', pets: [p1, p2, 'nope'] }); const g1 = r.id; if (r.err || r.farm.groups[0]?.name !== 'Diggers' || r.farm.groups[0].pets.join() !== [p1, p2].join()) fail('save a group ' + r.err);
  r = await c.farmDo({ t: 'group', op: 'save', pets: [] }); if (!r.err) fail('an empty group was saved');
  r = await c.farmDo({ t: 'group', op: 'save', id: g1, pets: [p3, p2, p1, p1] }); if (r.err || r.farm.groups.length !== 1 || r.farm.groups[0].pets.join() !== [p3, p2, p1].join() || r.farm.groups[0].name !== 'Diggers') fail('update a group ' + r.err);
  for (let i = 1; i < 8; i++) await c.farmDo({ t: 'group', op: 'save', pets: [p1] });
  r = await c.farmDo({ t: 'group', op: 'save', pets: [p1] }); if (!r.err || r.farm.groups.length !== 8) fail('more than 8 groups');
  r = await c.farmDo({ t: 'group', op: 'del', id: g1 }); if (r.err || r.farm.groups.some(g => g.id === g1)) fail('delete a group ' + r.err);
  // a full island: a new pet goes into storage by itself, and nobody moves out onto a full island
  for (let i = c.farm.pets.length; i < 26; i++) { await c.farmDo({ t: 'open', test: { pet: 'mossbun' } }); await wait(60); }
  r = await c.farmDo({ t: 'lodge', ids: [p1], on: true });
  await c.farmDo({ t: 'open', test: { pet: 'mossbun' } });
  r = await c.farmDo({ t: 'lodge', ids: [p1], on: false }); if (!r.err) fail('moved onto a full island');
  r = await c.farmDo({ t: 'open', test: { pet: 'mossbun' } }); if (!r.farm.pets.at(-1).lodge || r.farm.pets.filter(x => !x.lodge).length !== 26) fail('a new pet should go into storage when the island is full');
  // the Pet Museum: a 3x3 landmark behind farmhouse level 6 whose levels need album pages, not a bigger farmhouse
  r = await c.farmDo({ t: 'place', type: 'museum', x: 16, y: 1, r: 0 }); if (!r.err) fail('museum below farmhouse 6');
  await c.farmDo({ t: 'open', test: { house: 6 } });
  let mu = { err: 1 }; for (let y = 0; y < 20 && mu.err; y++) for (let x = 0; x < 20 && mu.err; x++) mu = await c.farmDo({ t: 'place', type: 'museum', x, y, r: 0 });
  if (mu.err) fail('no room for the museum ' + mu.err);
  const museum = mu.farm.items.find(i => i.type === 'museum').id, have0 = albumHave(mu.farm.album);
  r = await c.farmDo({ t: 'place', type: 'museum', x: 0, y: 0, r: 0 }); if (!r.err) fail('a second museum');
  r = await c.farmDo({ t: 'upgrade', id: museum }); if (!r.err || !/kinds of pets/.test(r.err) || lvOfItem(r.farm, museum) !== 1) fail('museum grew without album pages ' + have0);
  const extra = Object.keys(SPECIES).filter(sp => !c.farm.album[sp]?.some(Boolean) && !SPECIES[sp].el2).slice(0, UPGRADES.museum.need[0] - have0);
  for (const sp of extra) await c.farmDo({ t: 'open', test: { pet: sp } });
  const inv0 = c.farm.inv.crystal; r = await c.farmDo({ t: 'upgrade', id: museum });
  if (r.err || lvOfItem(r.farm, museum) !== 2 || r.farm.inv.crystal !== inv0 - UPGRADES.museum.cost[0].crystal) fail('museum level 2 ' + r.err);
  r = await c.farmDo({ t: 'upgrade', id: museum }); if (!r.err || lvOfItem(r.farm, museum) !== 2) fail('museum level 3 needs 20 kinds');
  if (!/^[0-8]{5}$/.test(museumFill(r.farm.album)) || museumFill(Object.fromEntries(Object.keys(SPECIES).map(sp => [sp, [1, 0, 0]]))) !== '88888' || museumFill({}) !== '00000') fail('museum medallions');
  c.ws.close(); }
// farmhouse levels 6 and 7 and Nest charms
{ const d = player('Dee'); await d.ready;
  d.send({ t: 'register', user: 'deebee', pass: 'hunter22' }); await until(() => d.auth, 'register d');
  await d.farmDo({ t: 'starter', sp: 'mossbun' });
  r = await d.farmDo({ t: 'open', test: { give: { wood: 2000, stone: 2000, fiber: 1000, shells: 400, coal: 400, crystal: 200, sunberry: 20, berries: 100 } } });
  for (let i = 0; i < 4; i++) { r = await d.farmDo({ t: 'houseup' }); if (r.err) fail('houseup ' + r.err); }
  if (r.farm.house !== 5 || r.farm.houseNext?.crystal !== HOUSE_UP[6].crystal) fail('farmhouse 5 should lead to 6 ' + JSON.stringify(r.farm.houseNext));
  r = await d.farmDo({ t: 'charm', kind: 'el' }); if (!/level 6/.test(r.err || '')) fail('a charm before farmhouse 6 ' + r.err);
  const room = r.farm.room, cr0 = r.farm.inv.crystal;
  r = await d.farmDo({ t: 'houseup' }); if (r.err || r.farm.house !== 6 || r.farm.room !== room || r.farm.inv.crystal !== cr0 - HOUSE_UP[6].crystal) fail('farmhouse 6 ' + r.err);
  r = await d.farmDo({ t: 'charm', kind: 'el' }); if (!/Nest/.test(r.err || '')) fail('a charm without a Nest ' + r.err);
  r = { err: 1 }; for (let y = 0; y < 11 && r.err; y++) for (let x = 0; x < 11 && r.err; x++) r = await d.farmDo({ t: 'place', type: 'nest', x, y, r: 0 });
  if (r.err) fail('no room for a nest');
  const cr1 = d.farm.inv.crystal;
  for (const k of ['el', 'hyb', 'pat']) { r = await d.farmDo({ t: 'charm', kind: k }); if (r.err || r.farm.charms[k] !== 1) fail('make charm ' + k + ' ' + r.err); }
  if (r.farm.inv.crystal !== cr1 - 6 - 8 - 3) fail('charm prices ' + (cr1 - r.farm.inv.crystal));
  r = await d.farmDo({ t: 'charm', kind: 'spk' }); if (!/level 7/.test(r.err || '')) fail('a Sparkle Charm before farmhouse 7 ' + r.err);
  r = await d.farmDo({ t: 'houseup' }); if (r.err || r.farm.house !== 7 || r.farm.houseNext || r.farm.room !== room) fail('farmhouse 7 ' + r.err);
  r = await d.farmDo({ t: 'houseup' }); if (!r.err || r.farm.house !== 7) fail('farmhouse past 7');
  r = await d.farmDo({ t: 'charm', kind: 'spk' }); if (r.err || r.farm.charms.spk !== 1) fail('Sparkle Charm at farmhouse 7 ' + r.err);
  await d.farmDo({ t: 'open', test: { pet: 'cindercub', traits: { pat: ['star'] } } }); await d.farmDo({ t: 'open', test: { pet: 'puddlepup' } }); await d.farmDo({ t: 'open', test: { pet: 'mossbun' } });
  r = await d.farmDo({ t: 'open', test: { lv: 6, rested: true } });
  const [m0, c0, p0, m1] = r.farm.pets.map(x => x.id);
  r = await d.farmDo({ t: 'pair', a: m0, b: m1, charms: ['hyb'] }); if (!/not change/.test(r.err || '')) fail('a Hybrid Charm on a pair with no hybrid ' + r.err);
  r = await d.farmDo({ t: 'pair', a: c0, b: p0, charms: ['el', 'el', 'hyb', 'pat', 'spk'] }); if (r.err) fail('pair with charms ' + r.err);
  if (Object.values(r.farm.charms).some(n => n !== 0)) fail('charms not used up ' + JSON.stringify(r.farm.charms));
  d.ws.close(); }
r = await a.farmDo({ t: 'open', test: { weather: 'none', ripe: true } });
const snapshot = JSON.stringify({ ...a.farm, guests: [] }); // who is visiting is not saved
await stop(); await boot();
if (!Object.keys(readFarms(DATA_DIR).farms).length) fail('farms not saved');
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

// The Farm Journal: tasks tick from the farm itself and from things done, chapters are claimed in order, rewards land
// in the right places, and a farm from before the journal gets its finished chapters' decorations but no materials.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHAPTERS, rewardOf } from '../public/games/farm/journal.js';
import { ITEMS } from '../public/games/farm/data.js';
const PORT = 21900 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

// the data: 8 chapters of 4 to 6 tasks, each with its own decoration that cannot be bought
if (CHAPTERS.length !== 8) fail('8 chapters');
for (const [i, c] of CHAPTERS.entries()) {
  if (c.tasks.length < 4 || c.tasks.length > 6) fail(`chapter ${c.id} has ${c.tasks.length} tasks`);
  const it = ITEMS[c.deco]; if (!it || it.jn !== i + 1 || Object.keys(it.cost).length || it.kind !== 'd') fail('journal decoration for ' + c.id);
  if (i >= 5 && Object.keys(c.mats || {}).length) fail('chapters 6+ give no materials');
  if (i < 5 && c.stamps) fail('tutorial chapters give no stamps');
}
// Kuba's rule: tutorial materials stay small (about one Stroll each, about 300 value in all at most)
const WORTH = { wood: 1, stone: 1, fiber: 1, shells: 3, coal: 3, crystal: 40, cookie: 8 };
const total = CHAPTERS.reduce((n, c) => n + Object.entries(c.mats || {}).reduce((m, [k, v]) => m + WORTH[k] * v, 0), 0);
if (total > 300) fail('tutorial materials too generous: ' + total);
if (Object.keys(rewardOf(0, true).mats).length || !rewardOf(0, true).deco) fail('an old chapter pays the decoration only');

process.on('uncaughtException', e => fail(e.stack));
srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, FARM_TEST: '1' }, stdio: 'inherit' });
await wait(700);
function player(name) {
  const p = { me: null, auth: null, farm: null, last: null };
  p.ready = new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m)); p.close = () => ws.close();
    ws.onopen = () => p.send({ t: 'hello', token: '', name, color: '#ff8fab' });
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') res(); if (m.t === 'auth') p.auth = m; if (m.t === 'farm') { p.last = m; if (m.farm) p.farm = m.farm; } };
  });
  p.farmDo = async a => { p.last = null; p.send({ t: 'farm', a }); await until(() => p.last, 'farm reply to ' + a.t); return p.last; };
  return p;
}
const a = player('Jo'); await a.ready;
a.send({ t: 'register', user: 'jojo', pass: 'hunter22' }); await until(() => a.auth, 'register'); if (a.auth.err) fail(a.auth.err);
await a.farmDo({ t: 'open' });
let r = await a.farmDo({ t: 'starter', sp: 'mossbun' }); if (!r.farm) fail('starter ' + JSON.stringify(r));
let j = r.farm.jn;
if (!j || j.got !== 0 || j.old !== 0 || j.tick.length !== 8) fail('a new farm starts at chapter 1 ' + JSON.stringify(j));
if (j.tick[0].some(Boolean)) fail('nothing is done yet');
r = await a.farmDo({ t: 'jclaim' }); if (!r.err) fail('an unfinished chapter was claimed');
// chapter 1: build the gate, send a party, welcome it home, plant a garden plot
r = await a.farmDo({ t: 'place', type: 'gate', x: 0, y: 0, r: 0 }); if (!r.farm.jn.tick[0][0]) fail('gate tick');
r = await a.farmDo({ t: 'send', zone: 'woods', trip: 'stroll', pets: [r.farm.pets[0].id] }); if (!r.farm.jn.tick[0][1] || r.farm.jn.tick[0][2]) fail('send tick');
r = await a.farmDo({ t: 'open', test: { home: true } }); r = await a.farmDo({ t: 'collect' }); if (!r.farm.jn.tick[0][2]) fail('home tick');
r = await a.farmDo({ t: 'place', type: 'garden', x: 6, y: 6, r: 0 }); if (!r.farm.jn.tick[0].every(Boolean)) fail('chapter 1 done ' + JSON.stringify(r.farm.jn.tick[0]));
const wood = r.farm.inv.wood;
r = await a.farmDo({ t: 'jclaim' });
if (r.did !== 'jclaim' || r.farm.jn.got !== 1 || r.farm.inv.wood !== wood + CHAPTERS[0].mats.wood || r.farm.stash.jsign !== 1) fail('chapter 1 reward ' + JSON.stringify(r.farm.jn) + ' ' + r.farm.inv.wood);
r = await a.farmDo({ t: 'jclaim' }); if (!r.err || r.farm.jn.got !== 1) fail('claimed twice');
// the decoration is placed for free from the stash, and cannot be bought
r = await a.farmDo({ t: 'place', type: 'jsign', x: 3, y: 6, r: 0 }); if (r.err || r.farm.stash.jsign) fail('placing the reward ' + r.err);
r = await a.farmDo({ t: 'place', type: 'jboard', x: 4, y: 7, r: 0 }); if (!r.err) fail('a journal decoration was bought');
const placed = r.farm.items.find(i => i.type === 'jsign');
r = await a.farmDo({ t: 'remove', id: placed.id }); if (r.farm.stash.jsign !== 1) fail('a put-away reward goes back to the stash');
// chapter 2: counters for things the farm cannot show later
r = await a.farmDo({ t: 'open', test: { ripe: true } }); r = await a.farmDo({ t: 'pick' }); if (!r.farm.jn.tick[1][0]) fail('pick tick');
r = await a.farmDo({ t: 'place', type: 'kitchen', x: 6, y: 0, r: 0 }); if (!r.farm.jn.tick[1][1]) fail('kitchen tick');
r = await a.farmDo({ t: 'open', test: { give: { berries: 8 } } }); r = await a.farmDo({ t: 'cook', what: 'cookie' }); if (!r.farm.jn.tick[1][2]) fail('cook tick');
r = await a.farmDo({ t: 'feed', what: 'cookie', pet: r.farm.pets[0].id }); if (!r.farm.jn.tick[1][3]) fail('feed tick');
if (r.farm.jn.tick[1][4]) fail('hut not built yet');

// a farm from before the journal: what it has already finished pays decorations only
const b = player('Old'); await b.ready;
b.send({ t: 'register', user: 'old', pass: 'hunter22' }); await until(() => b.auth, 'register b'); if (b.auth.err) fail(b.auth.err);
await b.farmDo({ t: 'open' });
r = await b.farmDo({ t: 'starter', sp: 'cindercub' });
r = await b.farmDo({ t: 'open', test: { give: { wood: 900, stone: 900, fiber: 900, crystal: 10 } } });
for (const [type, x, y] of [['gate', 0, 0], ['garden', 6, 6], ['kitchen', 6, 0], ['hut', 0, 6]]) { r = await b.farmDo({ t: 'place', type, x, y, r: 0 }); if (r.err) fail(type + ' ' + r.err); }
r = await b.farmDo({ t: 'open', test: { trips: 3, jn: null } }); // older than the journal: no f.jn yet
r = await b.farmDo({ t: 'open' });
j = r.farm.jn;
if (j.old !== 2 || !j.tick[1].every(Boolean)) fail('an old farm with a kitchen counts chapters 1 and 2 as done ' + JSON.stringify(j));
const before = { ...r.farm.inv };
r = await b.farmDo({ t: 'jclaim' }); r = await b.farmDo({ t: 'jclaim' });
if (r.farm.jn.got !== 2 || r.farm.inv.wood !== before.wood || r.farm.inv.stone !== before.stone || r.farm.stash.jsign !== 1 || r.farm.stash.jboard !== 1) fail('old chapters pay no materials ' + JSON.stringify(r.farm.inv));
r = await b.farmDo({ t: 'jclaim' }); if (!r.err) fail('chapter 3 is not done');
// chapter 6+ pays stamps and, from chapter 7, a Nest charm; the counters read state the other features keep
r = await b.farmDo({ t: 'open', test: { jn: { got: 6, old: 0 }, house: 6, album: ['mossbun'] } });
if (r.farm.jn.tick[6][0] !== true || r.farm.jn.tick[6][1]) fail('chapter 7 ticks ' + JSON.stringify(r.farm.jn.tick[6]));
console.log('journal ok');
srv.kill(); process.exit(0);

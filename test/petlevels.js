// Pet Farm levels and battle experience (2026-11-27): the farmhouse sets the level cap, treats only grow young pets,
// battles pay real experience (first win x2, stronger foes x1.5), every battle uses real levels, Arena matchmaking
// and the live matchmaking queue, and the hub's Pet Battles numbers.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOUSE_LV, TREAT_LV, BATTLE_XP, FIRST_WIN_X, xpFor, gapX, lvCap, workPct, tripLoot } from '../public/games/farm/data.js';
const PORT = 20000 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

// the numbers themselves
if (HOUSE_LV.join() !== '0,8,12,15,18,20,25,30' || lvCap({ house: 1 }) !== 8 || lvCap({ house: 7 }) !== 30 || lvCap({}) !== 8) fail('caps ' + HOUSE_LV);
if (gapX(10, 12) !== 1.5 || gapX(10, 11) !== 1 || gapX(10, 7) !== .5 || gapX(10, 8) !== 1) fail('gapX');
const helper = lv => workPct({ sp: 'puddlepup', lv, stars: [3, 3, 3, 3] }, 'garden');
if (helper(30) !== helper(20)) fail('helpers should not gain past level 20');
const loot = lv => JSON.stringify(tripLoot('woods', 'stroll', [{ sp: 'mossbun', lv }]));
if (loot(30) !== loot(20)) fail('expeditions should not gain past level 20');

srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, FARM_TEST: '1' }, stdio: ['ignore', 'ignore', 'inherit'] });
await wait(800);
function player(name) {
  const p = { last: null, pushes: [] };
  p.ready = new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') res(); if (m.t === 'auth') p.auth = m; if (m.t === 'pets') p.pets = m; if (m.t === 'farm') { p.last = m; p.pushes.push(m); if (m.farm) p.farm = m.farm; } };
  });
  p.farmDo = async a => { await wait(55); p.last = null; p.send({ t: 'farm', a }); await until(() => p.last, 'reply to ' + JSON.stringify(a)); return p.last; };
  return p;
}
async function start(p, user, sp) {
  await p.ready; p.send({ t: 'register', user, pass: 'hunter22' }); await until(() => p.auth, 'register');
  if (p.auth.err) fail('register ' + p.auth.err);
  await p.farmDo({ t: 'open', test: { weather: 'none' } }); await p.farmDo({ t: 'starter', sp });
  let q = { err: 1 }; for (let y = 0; y < 10 && q.err; y++) for (let x = 0; x < 10 && q.err; x++) q = await p.farmDo({ t: 'place', type: 'flag', x, y, r: 0, test: { give: { wood: 200, stone: 200, fiber: 200 } } });
  if (q.err) fail('no flag for ' + user);
  q = { err: 1 }; for (let y = 0; y < 10 && q.err; y++) for (let x = 0; x < 10 && q.err; x++) q = await p.farmDo({ t: 'place', type: 'yard', x, y, r: 0 });
  if (q.err) fail('no yard for ' + user);
}
// plays a solo battle out with the first move each turn
async function playOut(p) { let r = p.last, n = 0; while (r.battle && r.did !== 'fought') { const u = r.battle.sides[0].pets[r.battle.sides[0].on]; r = await p.farmDo(r.battle.need ? { t: 'bact', switch: r.battle.sides[0].pets.findIndex(x => x.hp > 0) } : { t: 'bact', move: u.moves.find(m => !u.cd[m]) || u.moves[0] }); if (++n > 400) fail('endless battle'); } return r; }

const a = player('Ana'), b = player('Bo');
await start(a, 'ana', 'cindercub'); await start(b, 'bobo', 'puddlepup');
const pa = () => a.farm.pets[0];

// the farmhouse caps levels: a level 1 farmhouse stops at 8, with the bar kept full
let r = await a.farmDo({ t: 'open', test: { lv: 7 } });
if (r.farm.lvCap !== 8) fail('view cap ' + r.farm.lvCap);
r = await a.farmDo({ t: 'cook', what: 'cake', test: { give: { berries: 100, fiber: 50, cake: 5 } } });
r = await a.farmDo({ t: 'feed', what: 'cake', pet: pa().id }); // 90 experience: 7 -> 8, then the cap
r = await a.farmDo({ t: 'feed', what: 'cake', pet: pa().id });
if (pa().lv !== 8 || !r.err || !/level cap/.test(r.err)) fail('cap did not hold ' + JSON.stringify([pa().lv, pa().xp, r.err]));
// battles at the cap fill the bar to one full level and no more
r = await a.farmDo({ t: 'fight', mode: 'practice', pets: [pa().id] }); r = await playOut(a);
if (pa().lv !== 8 || pa().xp > xpFor(8)) fail('battle went past the cap ' + JSON.stringify(pa()));
const xp8 = pa().xp;
// a bigger farmhouse lets a waiting pet level at once
r = await a.farmDo({ t: 'houseup', test: { give: { wood: 500, stone: 500, fiber: 500 } } });
if (r.err || r.farm.house !== 2 || r.farm.lvCap !== 12) fail('houseup ' + r.err);
if (xp8 >= xpFor(8) && (pa().lv !== 9 || !r.grew?.length)) fail('waiting pet did not level ' + JSON.stringify([pa(), r.grew]));
// pets above the cap keep their level
r = await a.farmDo({ t: 'open', test: { lv: 20 } });
if (pa().lv !== 20) fail('pet above the cap lost levels');
r = await a.farmDo({ t: 'fight', mode: 'practice', pets: [pa().id] }); r = await playOut(a);
if (pa().lv !== 20) fail('pet above the cap changed level ' + pa().lv);
// treats stop at Adult (level 12)
r = await a.farmDo({ t: 'open', test: { lv: TREAT_LV, house: 5 } });
r = await a.farmDo({ t: 'feed', what: 'cake', pet: pa().id });
if (!r.err || !/grown up/.test(r.err)) fail('adult ate a treat for experience ' + r.err);
r = await a.farmDo({ t: 'open', test: { lv: TREAT_LV - 1 } });
r = await a.farmDo({ t: 'feed', what: 'cake', pet: pa().id }); r = await a.farmDo({ t: 'feed', what: 'cake', pet: pa().id });
if (pa().lv > TREAT_LV) fail('a treat pushed past level 12: ' + pa().lv);

// battle experience: practice is the day's first win x2 (or a loss), and everyone fights at real levels
r = await b.farmDo({ t: 'open', test: { lv: 10, house: 5 } });
r = await a.farmDo({ t: 'open', test: { lv: 10 } });
r = await a.farmDo({ t: 'fight', mode: 'practice', pets: [pa().id] });
if (r.battle.sides.some(s => s.pets.some(x => x.lv !== 10))) fail('practice levels ' + JSON.stringify(r.battle.sides.map(s => s.pets.map(x => x.lv))));
r = await playOut(a);
const z = r.prize, want = z.won ? BATTLE_XP.practice[0] * (z.first ? FIRST_WIN_X : 1) : BATTLE_XP.practice[1];
if (!z.learnt || z.xp !== want || z.gap !== 1) fail('practice xp ' + JSON.stringify(z));

// quick match: a player's farm near your level, at real levels
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: 'auto', pets: [pa().id] });
if (r.err || r.battle.foe !== 'Bo' || r.battle.sides[1].pets[0].lv !== 10 || r.battle.sides[0].pets[0].lv !== pa().lv) fail('quick match ' + JSON.stringify(r.err || [r.battle.foe, r.battle.sides.map(s => s.pets.map(x => x.lv))]));
await a.farmDo({ t: 'bquit' });
// far apart: a neighbour at your level instead
r = await b.farmDo({ t: 'open', test: { lv: 25 } });
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: 'auto', pets: [pa().id] });
if (r.err || r.battle.foe === 'Bo' || r.battle.sides[1].pets.some(x => x.lv !== pa().lv)) fail('quick match fallback ' + JSON.stringify(r.err || [r.battle.foe, r.battle.sides[1].pets.map(x => x.lv)]));
await a.farmDo({ t: 'bquit' });
// a stronger team pays half again
r = await a.farmDo({ t: 'fight', mode: 'arena', foe: b.farm && (await a.farmDo({ t: 'foes' })).foes.find(x => !x.npc).id, pets: [pa().id] });
r = await playOut(a);
if (r.prize.gap !== 1.5) fail('stronger foe bonus ' + JSON.stringify(r.prize));
// coins stop after 5 Arena matches; experience goes on to 15
r = await a.farmDo({ t: 'open' });
for (let i = r.farm.fights.arenaXp; i > 0; i--) {
  const left = a.farm.fights.arena;
  await a.farmDo({ t: 'fight', mode: 'arena', foe: 'npc:hazel', pets: [pa().id] }); r = await playOut(a);
  if (r.prize.counted !== left > 0 || !r.prize.learnt || !(r.prize.xp > 0) || (!r.prize.counted && r.prize.coins)) fail('arena day ' + JSON.stringify([left, r.prize]));
}
r = await a.farmDo({ t: 'open' });
if (r.farm.fights.arena !== 0 || r.farm.fights.arenaXp !== 0) fail('arena counts ' + JSON.stringify(r.farm.fights));
await a.farmDo({ t: 'fight', mode: 'arena', foe: 'npc:hazel', pets: [pa().id] }); r = await playOut(a);
if (r.prize.learnt || r.prize.xp || r.prize.coins) fail('a 16th match paid ' + JSON.stringify(r.prize));
// the hub's tile numbers
a.pets = null; a.send({ t: 'pets' }); await until(() => a.pets, 'pets');
if (!a.pets.farm?.fights || a.pets.farm.fights.arena !== 0 || a.pets.farm.fights.xp !== 0 || a.pets.farm.fights.of !== 5) fail('brief ' + JSON.stringify(a.pets.farm));

// live matchmaking: two players near the same level meet; real levels on both sides
r = await b.farmDo({ t: 'open', test: { lv: 11 } });
r = await a.farmDo({ t: 'open', test: { lv: 10 } });
r = await a.farmDo({ t: 'queue', pets: [pa().id] });
if (r.err || r.did !== 'queue') fail('queue ' + r.err);
a.pushes = [];
r = await b.farmDo({ t: 'queue', pets: [b.farm.pets[0].id] });
if (r.err || !r.battle?.live || r.battle.sides[0].pets[0].lv !== 11 || r.battle.sides[1].pets[0].lv !== 10) fail('queue match ' + JSON.stringify(r.err || r.battle?.sides?.map(s => s.pets.map(x => x.lv))));
await until(() => a.pushes.some(m => m.battle?.live), 'live battle reached the first player');
await b.farmDo({ t: 'bquit' }); await wait(300);
// nobody else: the queue gives up and starts a quick match (test: wait the full 30 seconds is too slow, so leave it)
r = await a.farmDo({ t: 'queue', pets: [pa().id] }); if (r.err) fail('requeue ' + r.err);
r = await a.farmDo({ t: 'unqueue' }); if (r.err) fail('unqueue');
r = await b.farmDo({ t: 'queue', pets: [b.farm.pets[0].id] });
if (r.battle) fail('matched someone who stopped looking');
await b.farmDo({ t: 'unqueue' });
// a team far apart does not match at once
r = await b.farmDo({ t: 'open', test: { lv: 25 } });
await a.farmDo({ t: 'queue', pets: [pa().id] });
r = await b.farmDo({ t: 'queue', pets: [b.farm.pets[0].id] });
if (r.battle) fail('matched teams 15 levels apart');

srv.kill('SIGTERM');
console.log('pet levels ok');
process.exit(0);

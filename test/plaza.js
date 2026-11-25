// Plaza test: rooms of 24, walking is checked, emotes and seats, reactions, pet hearts, the tree's ornaments (kept over
// a restart), one present a day, host mute and remove, table signposts, the hub button's glance, and leaving.
// Part 2: emotes you must own, the emote bar, emotes earned by visiting on different days, throwing, timed events,
// the double Christmas present, and the Pet Farm friendship point for a heart given to a friend's pet.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CAP, Q, SPOTS, EMOTES, SPAWN, THROW_RANGE, thingsOf } from '../public/games/plaza/layout.js';
import { COS, EMOTE_ICO } from '../public/cosmetics.js';
const PORT = 21980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-plz-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async (extra = {}) => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, ADMINS: 'mod', ...extra }, stdio: 'inherit' }); await wait(800); };
const stop = async () => { srv.kill('SIGTERM'); await new Promise(r => srv.on('exit', r)); };
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, got: [], errs: [], farm: null, in: null, pos: new Map(), hub: [], hubErr: [], stats: null, room: null };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    p.do = a => p.send({ t: 'plaza', a });
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') p.token = m.token;
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'err') p.errs.push(m.msg);
      if (m.t === 'farm') p.farm = m;
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'stats') p.stats = m;
      if (m.t === 'hubchat') { if (m.msg) p.hub.push(m.msg); if (m.err) p.hubErr.push(m.err); }
      if (m.t === 'plaza') { if (m.k === 'in') { p.in = m; p.pos.clear(); } else if (m.k === 'p') for (const [s, x, z, r] of m.m) p.pos.set(s, [x, z, r]); else p.got.push(m); }
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply to ' + m.t); return p.auth; };
  p.next = async (k, what = k) => { let m; await until(() => (m = p.got.find(x => x.k === k)), `${name}: ${what}`); p.got = p.got.filter(x => x !== m); return m; };
  p.enter = async room => { p.in = null; p.do({ k: 'join', ...(room ? { room } : {}) }); await until(() => p.in, name + ' enters'); return p.in; };
  // walk in small honest steps to a spot (metres)
  p.walk = async (x, z) => { let [cx, cz] = [p.x ?? p.in.who.find(w => w.s === p.in.me).x / Q, p.z ?? p.in.who.find(w => w.s === p.in.me).z / Q];
    for (;;) { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); if (d < .05) break; const st = Math.min(d, .8); cx += dx / d * st; cz += dz / d * st; p.do({ k: 'mv', x: Math.round(cx * Q), z: Math.round(cz * Q), r: 0 }); await wait(165); }
    p.x = cx; p.z = cz; };
  return p;
}

await start();
const guest = await player('Gus').connect();
const ana = await player('Ana').connect();
const mod = await player('Mo').connect(); let mod0;
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');
if ((await mod.ask({ t: 'register', user: 'mod', pass: 'apple123' })).ok !== 'register') fail('register mod');
mod0 = mod.token;
// The hub button's marker (todoOf): before the first visit an account has the visit, present and ornament waiting; guests nothing.
ana.do({ k: 'peek' }); const pk0 = await ana.next('peek');
if (!pk0.todo?.in || (pk0.theme === 'winter') !== !!(pk0.todo.gift && pk0.todo.orn)) fail('todo before the visit ' + JSON.stringify(pk0.todo));
guest.do({ k: 'peek' }); if ((await guest.next('peek')).todo) fail('guests get no todo');

// 1. Joining: everyone lands in room 1 near the arch; the others are told; the site's count follows.
const a = await ana.enter();
if (a.room !== 1 || a.cap !== CAP || a.who.length !== 1 || a.theme !== 'winter' && a.theme !== 'meadow') fail('first join ' + JSON.stringify(a).slice(0, 200));
const meA = a.who[0];
if (Math.hypot(meA.x / Q - SPAWN[0], meA.z / Q - SPAWN[1]) > 4) fail('spawn place');
if (meA.pid !== undefined || meA.token !== undefined) fail('private fields leaked');
const g = await guest.enter();
if (g.room !== 1 || g.who.length !== 2) fail('guest joins the same room');
const add = await ana.next('add');
if (add.p.n !== 'Gus' || add.p.u) fail('add message ' + JSON.stringify(add.p).slice(0, 120));
await until(() => ana.stats?.plaza === 2, 'stats count 2');
const mIn = await mod.enter(); if (!mIn.mod || a.mod) fail('mod flag');
console.log('join ok');

// 2. Walking: honest steps reach the others; a teleport is sent back.
await ana.walk(0, 12);
await until(() => guest.pos.get(a.me)?.[1] === 12 * Q, 'guest sees ana walk');
ana.do({ k: 'mv', x: -300, z: -200, r: 0 });
const fix = await ana.next('fix');
if (Math.abs(fix.z - 12 * Q) > 2) fail('fix puts you back: ' + JSON.stringify(fix));
ana.do({ k: 'mv', x: 0, z: 0, r: 0 }); // the middle piece is solid
await wait(250);
if (Math.hypot(...(guest.pos.get(a.me) || [0, 240]).slice(0, 2)) < 3.4 * Q) fail('walked into the tree');
console.log('walking ok');

// 3. Emotes: a wave reaches all; a seat needs you near it and free.
const WAVE = EMOTES.findIndex(e => e?.id === 'wave'), SIT = EMOTES.findIndex(e => e?.id === 'sit');
guest.got = []; ana.got = [];
ana.do({ k: 'em', e: WAVE });
if ((await guest.next('em')).e !== WAVE || (await ana.next('em')).e !== WAVE) fail('wave');
await wait(400);
ana.do({ k: 'em', e: SIT, sp: 0 }); // far away: sits on the ground where they are
if ((await ana.next('em')).sp !== -1) fail('far seat should not be taken');
const seat = SPOTS[0];
await ana.walk(seat.x + 1.2 * Math.sign(seat.x || 1), seat.z + 1.2);
ana.got = []; ana.do({ k: 'em', e: SIT, sp: 0 });
if ((await ana.next('em')).sp !== 0) fail('seat not taken when near');
await guest.walk(seat.x + 1.2, seat.z + 1.4);
guest.got = []; await wait(400); guest.do({ k: 'em', e: SIT, sp: 0 });
if ((await guest.next('em')).sp !== -1) fail('a taken seat was given twice');
console.log('emotes ok');

// 4. Reactions (free ones for all; sticker packs must be owned) and pet hearts.
ana.got = [];
guest.do({ k: 're', i: 7 });
if ((await ana.next('re')).i !== 7) fail('reaction');
await wait(750); guest.do({ k: 're', i: 40 }); await wait(300);
if (ana.got.some(m => m.k === 're')) fail('unowned sticker went through');
guest.do({ k: 'pat', s: a.me, i: 0 });
if ((await ana.next('pat')).s !== a.me) fail('pet heart');
console.log('reactions ok');

// 5. The tree: guests can't hang; an account near the tree can; one each; everyone in every room sees it.
if (a.theme === 'winter') {
  guest.got = []; guest.do({ k: 'orn', i: 2 });
  if (!/account/.test((await guest.next('err')).msg)) fail('guest ornament');
  ana.x = seat.x; ana.z = seat.z; await ana.walk(seat.x * 1.9, seat.z * 1.9);
  ana.got = []; ana.do({ k: 'orn', i: 3 });
  if (!/Walk up/.test((await ana.next('err')).msg)) fail('ornament from afar');
  await ana.walk(0, 5.5);
  guest.got = []; ana.do({ k: 'orn', i: 3 });
  const o1 = await guest.next('orn'); if (o1.o.k !== 3 || o1.o.n !== 'Ana' || o1.o.pid !== undefined) fail('ornament view ' + JSON.stringify(o1));
  ana.do({ k: 'orn', i: 5 });
  const o2 = await guest.next('orn'); if (o2.i !== o1.i || o2.o.k !== 5) fail('changing keeps the slot');
  // the present: once a day, coins arrive
  const before = ana.me.coins | 0;
  if (!ana.in.gift) fail('present should be waiting');
  ana.got = []; ana.do({ k: 'gift' });
  const gf = await ana.next('gift'); if (gf.coins !== ana.in.giftN || ![5, 10].includes(gf.coins)) fail('present coins ' + JSON.stringify(gf));
  await until(() => (ana.me.coins | 0) === before + gf.coins, 'coins added');
  ana.do({ k: 'gift' }); const gf2 = await ana.next('gift'); if (gf2.coins) fail('second present the same day');
  guest.do({ k: 'gift' }); if (!/account/.test((await guest.next('err')).msg)) fail('guest present');
  console.log('tree + present ok');
}

// 6. The hub button's glance.
const out = await player('Hub').connect();
out.do({ k: 'peek' });
const pk = await out.next('peek'); if (pk.n !== 3 || pk.faces.length !== 3 || !pk.faces[0].n) fail('peek ' + JSON.stringify(pk).slice(0, 200));
ana.do({ k: 'peek' }); const pk1 = await ana.next('peek'); if (!pk1.todo || Object.keys(pk1.todo).length) fail('todo after visit, present and ornament ' + JSON.stringify(pk1.todo));
console.log('hub marker ok');

// 7. Chat is the site's one conversation; a host's mute stops it; a remove sends you out for a while.
ana.send({ t: 'hubchat', text: 'hello plaza' });
await until(() => guest.hub.length && out.hub.length, 'plaza and hub both get the line');
if (!guest.hub[0].pt || guest.hub[0].pt !== ana.in.who.find(w => w.s === a.me).pt) fail('line carries the public tag for the bubble');
guest.do({ k: 'mute', s: a.me }); await wait(200);
mod.do({ k: 'mute', s: a.me });
await ana.next('muted'); await mod.next('done');
await wait(1300); ana.send({ t: 'hubchat', text: 'still here?' });
await until(() => ana.hubErr.length, 'muted line refused');
if (guest.hub.length !== 1) fail('a muted line got out');
guest.got = [];
mod.do({ k: 'kick', s: a.me });
const ko = await ana.next('out'); if (ko.why !== 'kick') fail('kick message');
if ((await guest.next('del')).s !== a.me) fail('others see the removed player go');
ana.got = []; ana.do({ k: 'join' });
const again = await ana.next('out', 'kicked player stays out'); if (!again.mins) fail('no minutes on the refusal');
console.log('chat + host tools ok');

// 8. Hosting a table from the plaza leaves a signpost; sitting down at a table takes you out of the plaza.
guest.got = [];
mod.send({ t: 'create', game: 'ttt', opts: {} });
await until(() => mod.room, 'mod has a table');
const sg = await guest.next('sign'); if (sg.g.code !== mod.room.code || sg.g.n !== 'Mo' || !(sg.g.free > 0) || !sg.g.c || !Array.isArray(sg.g.av)) fail('signpost (with the host\'s look, so their avatar can stay) ' + JSON.stringify(sg));
if ((await guest.next('del')).s !== mIn.me) fail('host left the plaza for the table');
guest.send({ t: 'join', code: sg.g.code });
await until(() => guest.room, 'guest joins by the signpost');
await until(() => out.stats?.plaza === 0, 'plaza is empty again');
mod.send({ t: 'leave' }); guest.send({ t: 'leave' }); await wait(200);

// 9. Rooms: the 25th person opens room 2; you can pick a room; closing the tab frees the place.
const crowd = [];
for (let i = 0; i < CAP; i++) crowd.push(await player('P' + i).connect());
for (const p of crowd) await p.enter();
if (crowd.some(p => p.in.room !== 1)) fail('first 24 share room 1');
const late = await guest.enter(); if (late.room !== 2) fail('25th goes to room 2, got ' + late.room);
guest.do({ k: 'rooms' }); const rl = await guest.next('rooms'); if (rl.rooms.length !== 2 || rl.rooms[0].n !== CAP) fail('room list ' + JSON.stringify(rl));
guest.in = null; guest.do({ k: 'join', room: 1 }); await wait(300); if (guest.in && guest.in.room === 1) fail('got into a full room');
crowd[0].ws.close(); await wait(300);
const moved = await guest.enter(1); if (moved.room !== 1 || moved.who.length !== CAP) fail('moving rooms ' + moved.room + ' ' + moved.who.length);
guest.send({ t: 'where', v: 'hub' }); await until(() => out.stats?.plaza === CAP - 1, 'going back to the hub leaves the plaza');
console.log('rooms ok');

// 10. The tree and the present survive a restart.
for (const p of [guest, ana, mod, out, ...crowd]) try { p.ws.close(); } catch {}
await stop(); await start();
const ana2 = await player('Ana', ana.token).connect();
const b = await ana2.enter();
if (b.theme === 'winter') { if (b.tree.length !== 1 || b.tree[0].k !== 5) fail('tree after restart ' + JSON.stringify(b.tree)); if (b.gift) fail('present came back after a restart'); }
await stop();

// 11. Part 2, with the calendar pinned to Christmas Eve (a new day for Ana: her second visit).
if (EMOTES.length !== COS.em.items.length || EMOTES.some((e, i) => i && e.e !== EMOTE_ICO[i])) fail('the emote list and the Wardrobe list differ');
const E = id => EMOTES.findIndex(e => e?.id === id);
await start({ DAILY_NOW: '2026-12-24T12:00:00Z' });
{
  const ana = await player('Ana', ana2.token).connect(), mod = await player('Mo', mod0).connect(), gus = await player('Gus').connect();
  const a = await ana.enter(), m = await mod.enter(), g = await gus.enter();
  if (a.visit !== 2 || ana.me.plzDays !== 2) fail('second day of visits: ' + a.visit + ' ' + ana.me.plzDays);
  if (g.visit || a.giftN !== 10 || !a.gift) fail('Christmas present should be double and waiting');
  if (a.ev) fail('no event expected at noon');
  await ana.enter(); if (ana.in.visit) fail('a second visit the same day counted');
  // emotes: only the ones you have
  gus.got = []; ana.do({ k: 'em', e: E('clap') }); await wait(300); ana.do({ k: 'em', e: E('flip') }); await wait(300);
  if (gus.got.some(x => x.k === 'em')) fail('an emote that is not owned went through');
  ana.do({ k: 'em', e: E('dance') }); if ((await gus.next('em')).e !== E('dance')) fail('free emote');
  // the bar
  ana.send({ t: 'wear', k: 'eb', i: [2, 1, E('clap')] }); await until(() => ana.errs.length, 'bar with an emote that is not owned is refused');
  ana.send({ t: 'wear', k: 'eb', i: [2, 1] }); await until(() => ana.me.cos?.eb?.join() === '2,1', 'bar saved');
  ana.send({ t: 'wear', k: 'eb', i: [1, 2, 3, 4, 5, 6, 1] }); await wait(200); if (ana.me.cos.eb.join() !== '2,1') fail('a bad bar was saved');
  ana.errs = []; ana.send({ t: 'buy', k: 'em', i: E('clap') }); await until(() => ana.errs.length, 'no coins, no emote');
  // throwing: a throw at someone hits them; too fast is ignored; a far throw falls short
  const pos = p => p.in.who.find(w => w.s === p.in.me);
  await mod.walk(5, 8); await wait(300); gus.got = []; ana.got = [];
  ana.do({ k: 'sb', x: 5 * Q + 6, z: 8 * Q + 4 });
  const sb = await gus.next('sb'); if (sb.s !== ana.in.me || sb.h !== m.me || sb.x !== 5 * Q || sb.z !== 8 * Q) fail('throw ' + JSON.stringify(sb));
  ana.do({ k: 'sb', x: 0, z: 0 }); await wait(300); if (gus.got.some(x => x.k === 'sb')) fail('throws come too fast');
  await wait(1100); ana.do({ k: 'sb', x: pos(ana).x, z: pos(ana).z - 40 * Q });
  const far = await gus.next('sb'); if (far.h || Math.abs(Math.hypot(far.x - pos(ana).x, far.z - pos(ana).z) / Q - THROW_RANGE) > .2) fail('far throw ' + JSON.stringify(far));
  // a heart for a friend's pet: one friendship point a day, only between friends who both have a farm
  for (const p of [ana, mod]) { p.send({ t: 'farm', a: { t: 'open' } }); await until(() => p.farm, 'farm opens'); p.farm = null; p.send({ t: 'farm', a: { t: 'starter', sp: 'mossbun' } }); await until(() => p.farm?.farm?.pets?.length === 1, 'starter'); }
  ana.got = []; ana.do({ k: 'pat', s: m.me, i: 0 }); await ana.next('pat'); await wait(200); if (ana.got.some(x => x.k === 'pal')) fail('a point without being friends');
  ana.send({ t: 'friend', op: 'add', user: 'mod' }); await wait(200); mod.send({ t: 'friend', op: 'accept', user: 'ana' }); await wait(300);
  await wait(700); ana.do({ k: 'pat', s: m.me, i: 0 }); const pal = await ana.next('pal'); if (pal.n !== 'Mo') fail('friendship point ' + JSON.stringify(pal));
  await wait(1000); ana.got = []; ana.do({ k: 'pat', s: m.me, i: 0 }); await ana.next('pat'); await wait(200); if (ana.got.some(x => x.k === 'pal')) fail('two points in a day');
  ana.farm = null; ana.send({ t: 'farm', a: { t: 'open' } }); await until(() => ana.farm?.farm, 'farm again'); if (Object.values(ana.farm.farm.pals || {})[0] !== 1) fail('the point is not on the farm ' + JSON.stringify(ana.farm.farm.pals));
  // poking a decoration: only from near it; everyone sees it
  const ARCH = thingsOf(a.theme).findIndex(t => t[0] === 'arch');
  gus.got = []; ana.do({ k: 'poke', i: thingsOf(a.theme).findIndex(t => t[0] === 'lighthouse') }); await wait(300); if (gus.got.some(x => x.k === 'poke')) fail('poked something far away');
  ana.x = pos(ana).x / Q; ana.z = pos(ana).z / Q; await ana.walk(0, 15.5); await wait(300);
  ana.do({ k: 'poke', i: ARCH }); const pk2 = await gus.next('poke'); if (pk2.i !== ARCH || pk2.s !== ana.in.me) fail('poke ' + JSON.stringify(pk2));
  // the swing: you get on from beside it and your own place stays where you stood
  const SW = SPOTS.findIndex(q => q.k === 'swing'), SIT = E('sit');
  await mod.walk(14.2, 4); await mod.walk(14.2, .6); await wait(400); gus.got = []; gus.pos.clear();
  mod.do({ k: 'em', e: SIT, sp: SW }); const sw = await gus.next('em'); if (sw.sp !== SW) fail('swing seat ' + JSON.stringify(sw));
  await wait(300); if (gus.pos.has(m.me)) fail('getting on the swing moved the rider\'s place');
  // rock, paper, scissors: a challenge, an answer, the room sees who won; saying no and asking too fast are told
  gus.got = []; mod.got = []; ana.got = [];
  ana.do({ k: 'rps', s: m.me, p: 1 }); const rq = await mod.next('rpsq'); if (rq.s !== ana.in.me) fail('challenge ' + JSON.stringify(rq));
  gus.do({ k: 'rps', s: m.me, p: 3 }); if ((await gus.next('rpsn')).why !== 'busy') fail('a second challenge to someone already asked');
  mod.do({ k: 'rpsa', s: ana.in.me, p: 2 }); const rr = await gus.next('rpsr'); if (rr.a !== ana.in.me || rr.b !== m.me || rr.pa !== 1 || rr.pb !== 2 || rr.w !== m.me) fail('paper beats rock ' + JSON.stringify(rr));
  ana.do({ k: 'rps', s: m.me, p: 1 }); if ((await ana.next('rpsn')).why !== 'wait') fail('challenges come too fast');
  await wait(4100); gus.do({ k: 'rps', s: ana.in.me, p: 2 }); await ana.next('rpsq'); ana.do({ k: 'rpsa', s: g.me, p: 0 }); if ((await gus.next('rpsn')).why !== 'no') fail('saying no');
  await wait(4100); gus.got = []; ana.got = []; gus.do({ k: 'rps', s: ana.in.me, p: 3 }); await ana.next('rpsq'); ana.do({ k: 'rpsa', s: g.me, p: 3 }); if ((await gus.next('rpsr')).w !== 0) fail('a draw');
    // a host starts a show: everyone hears within a second or two; guests can't
  gus.got = []; gus.do({ k: 'show' }); await wait(1300); if (gus.got.some(x => x.k === 'ev')) fail('a guest started the fireworks');
  mod.do({ k: 'show' }); const ev = await gus.next('ev'); if (ev.ev?.id !== 'show' || !(ev.ev.left > 4 * 60000)) fail('show ' + JSON.stringify(ev));
  gus.do({ k: 'peek' }); if ((await gus.next('peek')).ev !== 'show') fail('the hub button does not know about the show');
  for (const p of [ana, mod, gus]) p.ws.close();
  console.log('part 2: emotes, bar, throwing, friendship, show ok');
}
await stop();
// 12. The third day: the visit emote unlocks; New Year's Eve counts down to midnight.
await start({ DAILY_NOW: '2026-12-25T12:00:00Z', PLAZA_EVENT: 'newyear', PLAZA_MID: '20' });
{
  const ana = await player('Ana', ana2.token).connect(), gus = await player('Gus').connect();
  const a = await ana.enter(); await gus.enter();
  if (a.visit !== 3 || a.ev?.id !== 'newyear' || !(a.ev.mid > 0 && a.ev.mid <= 20000)) fail('day three ' + JSON.stringify([a.visit, a.ev]));
  if (ana.me.cos.eb.join() !== '2,1') fail('the bar was lost over a restart');
  gus.got = []; ana.do({ k: 'em', e: E('flip') }); if ((await gus.next('em')).e !== E('flip')) fail('the emote earned by three visits');
  await wait(300); ana.do({ k: 'em', e: E('robot') }); await wait(300); if (gus.got.some(x => x.k === 'em')) fail('seven-day emote after three days');
  ana.send({ t: 'wear', k: 'eb', i: [E('flip'), 1] }); await until(() => ana.me.cos.eb.join() === E('flip') + ',1', 'earned emote on the bar');
  ana.ws.close(); gus.ws.close();
  console.log('part 2: visits and events ok');
}
await stop();
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('plaza: all good');
process.exit(0);

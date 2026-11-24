// Plaza test: rooms of 24, walking is checked, emotes and seats, reactions, pet hearts, the tree's ornaments (kept over
// a restart), one present a day, host mute and remove, table signposts, the hub button's glance, and leaving.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CAP, Q, SPOTS, EMOTES, SPAWN } from '../public/games/plaza/layout.js';
const PORT = 21980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-plz-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, ADMINS: 'mod' }, stdio: 'inherit' }); await wait(800); };
const stop = async () => { srv.kill('SIGTERM'); await new Promise(r => srv.on('exit', r)); };
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, got: [], in: null, pos: new Map(), hub: [], hubErr: [], stats: null, room: null };
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
const mod = await player('Mo').connect();
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');
if ((await mod.ask({ t: 'register', user: 'mod', pass: 'apple123' })).ok !== 'register') fail('register mod');

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
  const gf = await ana.next('gift'); if (gf.coins !== 5) fail('present coins ' + JSON.stringify(gf));
  await until(() => (ana.me.coins | 0) === before + 5, 'coins added');
  ana.do({ k: 'gift' }); const gf2 = await ana.next('gift'); if (gf2.coins) fail('second present the same day');
  guest.do({ k: 'gift' }); if (!/account/.test((await guest.next('err')).msg)) fail('guest present');
  console.log('tree + present ok');
}

// 6. The hub button's glance.
const out = await player('Hub').connect();
out.do({ k: 'peek' });
const pk = await out.next('peek'); if (pk.n !== 3 || pk.faces.length !== 3 || !pk.faces[0].n) fail('peek ' + JSON.stringify(pk).slice(0, 200));

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
const sg = await guest.next('sign'); if (sg.g.code !== mod.room.code || sg.g.n !== 'Mo' || !(sg.g.free > 0)) fail('signpost ' + JSON.stringify(sg));
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
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('plaza: all good');
process.exit(0);

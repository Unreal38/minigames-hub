// Player reports and the hosts' moderation (server/mod.js): a report carries its context, only hosts see reports,
// warnings reach the player once, a mute stops every chat, and bans (account, device, address tiers) shut the site.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 21980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-mod-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off', ADMINS: 'boss' }, stdio: 'inherit' }); await wait(700); };
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token, dev) {
  const p = { name, token, dev, me: null, auth: null, mod: {}, modme: null, hc: [], errs: [], room: null, card: null };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab', dev: p.dev });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') p.token = m.token;
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'player') p.card = m.p;
      if (m.t === 'modme') p.modme = m;
      if (m.t === 'mod') p.mod[m.op] = m;
      if (m.t === 'err') p.errs.push(m.msg);
      if (m.t === 'hubchat') p.hc.push(m);
      if (m.t === 'friended') p.friended = m;
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, m.t); return p.auth; };
  p.op = async (op, m = {}, want = op) => { delete p.mod[want]; p.send({ t: 'mod', op, ...m }); await until(() => p.mod[want], 'mod ' + want); return p.mod[want]; };
  p.cardOf = async pt => { p.card = null; p.send({ t: 'player', pt }); await until(() => p.card, 'card'); return p.card; };
  return p;
}

await start();
const boss = await player('Kuba').connect(), ana = await player('Ana', null, 'devana0000000001').connect(), bob = await player('Bob', null, 'devbob0000000001').connect();
for (const [p, u] of [[boss, 'boss'], [ana, 'ana'], [bob, 'bob']]) if ((await p.ask({ t: 'register', user: u, pass: 'apple123' })).ok !== 'register') fail('register ' + u);
await until(() => boss.me.admin && ana.me.pt && bob.me.pt, 'me after register');
if (!ana.modme || ana.modme.ban || ana.modme.mute) fail('a fresh player has a clean standing');

// Bob says something rude in the hub chat and at a table with Ana; Ana reports him from his card.
bob.send({ t: 'hubchat', text: 'you are all bad' }); await until(() => ana.hc.some(m => m.msg?.text === 'you are all bad'), 'hub line');
bob.send({ t: 'create', game: 'hotpot' }); await until(() => bob.room, 'bob table');
ana.send({ t: 'join', code: bob.room.code }); await until(() => ana.room, 'ana joins');
await wait(600); bob.send({ t: 'chat', text: 'noob' }); await wait(200);
const card = await ana.cardOf(bob.me.pt);
if (card.mod !== undefined) fail('a player card must not offer moderation to players');
if ((await ana.op('report', { pt: bob.me.pt, why: 'bogus' })).err !== 'Pick what happened first.') fail('a report needs a reason');
if ((await ana.op('report', { pt: ana.me.pt, why: 'chat' })).err !== 'You can’t report yourself.') fail('self report');
if (!(await ana.op('report', { pt: bob.me.pt, why: 'chat', note: 'rude <b>twice</b>', from: 'table' })).ok) fail('report sent');
if (!/already reported/.test((await ana.op('report', { pt: bob.me.pt, why: 'chat' })).err || '')) fail('one open report per pair');
await until(() => boss.mod.count?.n === 1, 'host told about the report');

// Players get nothing from the hosts' list; the host sees the case with its context.
ana.send({ t: 'mod', op: 'list' }); await wait(300); if (ana.mod.list) fail('a player got the reports');
const list = await boss.op('list');
const k = list.open[0];
if (list.open.length !== 1 || k.pt !== bob.me.pt || k.user !== 'bob' || k.name !== 'Bob') fail('one case about Bob ' + JSON.stringify(list.open));
const r = k.reports[0];
if (r.why !== 'chat' || r.note.includes('<') || r.by.user !== 'ana' || r.from !== 'table') fail('report fields ' + JSON.stringify(r));
if (r.where.k !== 'table' || r.twhere.k !== 'table' || r.where.code !== bob.room.code) fail('where both were ' + JSON.stringify([r.where, r.twhere]));
if (!r.around.some(x => x.text === 'you are all bad' && x.me) || !r.hub.some(x => x.text === 'you are all bad')) fail('hub chat context ' + JSON.stringify(r.around));
if (!r.table?.lines.some(x => x.text === 'noob' && x.me && x.at)) fail('table chat context ' + JSON.stringify(r.table));
if (JSON.stringify(list).match(/"(rpid|tpid|pid)"/)) fail('profile ids leaked');
if ((await boss.cardOf(bob.me.pt)).mod !== true) fail('hosts get the Moderate button');

// A warning: needs a reason, closes the report, pops up once, thanks the reporter.
boss.send({ t: 'mod', op: 'act', pt: bob.me.pt, k: 'warn', why: '' }); await until(() => boss.errs.includes('Write the reason: the player is shown it.'), 'reason needed');
await boss.op('act', { pt: bob.me.pt, k: 'warn', why: 'Be nice in chat' }, 'done');
await until(() => bob.modme?.warn?.why === 'Be nice in chat', 'warning reaches bob');
await until(() => ana.mod.thanks?.name === 'Bob', 'reporter thanked');
if ((await boss.op('list')).open.length) fail('acting closes the case');
bob.send({ t: 'mod', op: 'seen', id: bob.modme.warn.id }); await until(() => bob.modme && !bob.modme.warn, 'warning read');

// A mute: hub chat and table chat refused, playing still fine; lifting it lets him talk.
await boss.op('act', { pt: bob.me.pt, k: 'mute', mins: 60, why: 'Spam' }, 'done');
await until(() => bob.modme?.mute?.until > Date.now(), 'mute reaches bob');
bob.hc = []; bob.send({ t: 'hubchat', text: 'hello?' }); await until(() => bob.hc.some(m => m.err === 'A host has muted you.'), 'hub chat muted');
bob.errs = []; bob.send({ t: 'chat', text: 'hi' }); await until(() => bob.errs.includes('A host has muted you.'), 'table chat muted');
boss.send({ t: 'mod', op: 'act', pt: bob.me.pt, k: 'mute', mins: 7, why: 'x' }); await until(() => boss.errs.includes('Pick how long first.'), 'odd duration refused');
await boss.op('act', { pt: bob.me.pt, k: 'unmute' }, 'done'); await until(() => !bob.modme.mute, 'unmuted');

// Hosts can't be sanctioned.
boss.errs = []; boss.send({ t: 'mod', op: 'act', pt: boss.me.pt, k: 'ban', mins: 60, why: 'x' }); await until(() => boss.errs.includes('Hosts can’t be muted, warned or banned.'), 'host ban refused');

// An account ban: Bob leaves his table, every message is refused, logging out does not help on that browser.
await boss.op('act', { pt: bob.me.pt, k: 'ban', mins: 1440, why: 'Cheating', tier: 'acct' }, 'done');
await until(() => bob.modme?.ban?.why === 'Cheating', 'ban reaches bob');
if (bob.modme.ban.tier !== undefined) fail('the player is not told the tier');
await until(() => bob.room === null, 'banned player leaves the table');
bob.modme = null; bob.send({ t: 'rooms' }); await until(() => bob.modme?.ban, 'refused while banned');
bob.send({ t: 'logout' }); await wait(300);
bob.modme = null; await wait(3100); bob.send({ t: 'hubchat' }); await until(() => bob.modme?.ban, 'browser still banned after logout');
const act = await boss.op('list');
if (act.active.rows[0]?.ban?.tier !== 'acct' || act.active.log[0]?.k !== 'ban') fail('host sees the ban with its tier ' + JSON.stringify(act.active));
await boss.op('act', { pt: bob.me.pt, k: 'unban' }, 'done'); await until(() => bob.modme && !bob.modme.ban, 'unbanned');

// A device ban reaches a new browser on the same device; an address ban reaches a new device too.
const bob2 = await player('Bob', null, 'devbob0000000001').connect();
await until(() => bob2.modme, 'new browser standing');
if (bob2.modme.ban) fail('not banned yet');
const carl = await player('Carl', null, 'devcarl000000001').connect();
if ((await carl.ask({ t: 'register', user: 'carl', pass: 'apple123' })).ok !== 'register') fail('register carl');
await until(() => carl.me.pt, 'carl me');
await boss.op('act', { pt: carl.me.pt, k: 'ban', mins: 60, why: 'Alt account', tier: 'dev' }, 'done');
const carl2 = await player('Carl', null, 'devcarl000000001').connect();
await until(() => carl2.modme?.ban, 'device ban reaches a fresh browser of that device');
await boss.op('act', { pt: carl.me.pt, k: 'ban', mins: 60, why: 'Alt account', tier: 'ip' }, 'done');
const other = await player('Dee', null, 'devdee0000000001').connect();
await until(() => other.modme?.ban, 'address ban reaches another device on that address');
if (boss.modme?.ban) fail('the host is never banned');
await boss.op('act', { pt: carl.me.pt, k: 'unban' }, 'done');
await until(() => other.modme && !other.modme.ban, 'lifting frees the address');

// Unfriend from the card: friend, then remove by tag.
ana.send({ t: 'friend', op: 'add', pt: boss.me.pt }); await wait(200);
boss.send({ t: 'friend', op: 'accept', pt: ana.me.pt }); await wait(200);
if ((await ana.cardOf(boss.me.pt)).rel !== 'friend') fail('friends');
ana.friended = null; ana.send({ t: 'friend', op: 'remove', pt: boss.me.pt }); await until(() => ana.friended?.op === 'remove', 'unfriended');
if ((await ana.cardOf(boss.me.pt)).rel !== 'none') fail('no longer friends');

// Everything survives a restart.
for (const p of [boss, ana, bob, bob2, carl, carl2, other]) p.ws.close();
srv.kill(); await new Promise(r => srv.once('exit', r));
await start();
const boss2 = await player('Kuba', boss.token).connect();
const saved = await boss2.op('list');
if (saved.closed.length !== 1 || saved.active.log.length < 5) fail('reports and the log come back after a restart ' + JSON.stringify(saved.active.log.length));
const f = fs.readFileSync(path.join(DATA_DIR, 'reports.json'), 'utf8');
if (/127\.0\.0\.1/.test(f)) fail('a raw address was saved');
boss2.ws.close();
srv.kill(); await new Promise(r => srv.once('exit', r));
fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log('mod ok');

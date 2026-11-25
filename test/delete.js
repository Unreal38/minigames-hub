// Players deleting their own account (profile card > Delete account): the checks before it happens, and that nothing
// is left pointing at the account afterwards. Rankings, table scoreboards, table and hub chat, friends and pending
// requests, Pet Farm, other signed-in devices, a match in progress, the username held for 30 days (also after a
// restart), host accounts refused, and the per-address limit.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSaved, readFarms } from './saved.js';
const PORT = 17800 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-del-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv, crashed = false;
const start = async () => {
  srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off', ADMINS: 'boss' }, stdio: ['ignore', 'inherit', 'inherit'] });
  srv.on('exit', code => { if (code && code !== 143 && !srv.killed) crashed = true; });
  await wait(700);
};
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { if (crashed) fail('server crashed during: ' + what); await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token = '') {
  const p = { name, token, me: null, auth: null, errs: [], hub: [], gone: [], friends: null, room: null, state: null, chatlog: null, chat: [], boards: {}, stale: 0, farm: null, autoplay: false };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') p.token = m.token;
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'err') p.errs.push(m.msg);
      if (m.t === 'hubchat') { if (m.msg) p.hub.push(m.msg); if (m.gone) p.gone.push(m.gone); }
      if (m.t === 'friends') p.friends = m;
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'chatlog') p.chatlog = m.log;
      if (m.t === 'chat') p.chat.push(m);
      if (m.t === 'rankings') p.boards[m.game] = m;
      if (m.t === 'rkstale') p.stale++;
      if (m.t === 'farm') p.farm = m;
      if (m.t === 'state') {
        p.state = m.s;
        const s = m.s; // play the first empty cell whenever it is our turn
        if (p.autoplay && s?.ph === 'play' && s.stage === 'play' && s.turn === s.me) { const c = s.board.findIndex(x => x < 0); if (c >= 0) setTimeout(() => p.send({ t: 'act', a: { t: 'place', c } }), 30); }
      }
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply to ' + m.t); return p.auth; };
  p.rank = async game => { delete p.boards[game]; p.send({ t: 'rankings', game }); await until(() => p.boards[game], 'rankings ' + game); return p.boards[game]; };
  return p;
}
const reg = async (p, user) => { const r = await p.ask({ t: 'register', user, pass: 'apple123' }); if (r.ok !== 'register') fail(`register ${user}: ${JSON.stringify(r)}`); };

await start();
const ana = await player('Ana').connect(), bo = await player('Bo').connect(), cy = await player('Cy').connect();
await reg(ana, 'ana'); await reg(bo, 'bob'); await reg(cy, 'cyd');

// 1. The checks before anything happens.
const guest = await player('Gus').connect();
if (!/Log in first/.test((await guest.ask({ t: 'delacct', user: 'Gus', pass: 'x' })).err || '')) fail('a guest has no account to delete');
if (!/password is not right/.test((await ana.ask({ t: 'delacct', user: 'ana', pass: 'wrong123' })).err || '')) fail('wrong password must stop it');
if (!/username exactly/.test((await ana.ask({ t: 'delacct', user: 'anna', pass: 'apple123' })).err || '')) fail('a mistyped username must stop it');
if (!ana.me.user) fail('still signed in after the refused tries');
console.log('checks ok');

// 2. Ana's world: a second device, friends with Bo, a request waiting from Cy, a hub chat line, a farm, and a table
// with Bo (chat lines, one finished ranked match, a second match under way).
const ana2 = await player('Ana').connect();
if ((await ana2.ask({ t: 'login', user: 'ana', pass: 'apple123' })).ok !== 'login') fail('second device login');
ana.send({ t: 'friend', op: 'add', user: 'bob' }); await wait(150);
bo.send({ t: 'friend', op: 'accept', user: 'ana' }); await until(() => bo.friends?.friends?.length === 1, 'bo and ana friends');
cy.send({ t: 'friend', op: 'add', user: 'ana' }); await until(() => cy.friends?.sent?.length === 1, 'cy request sent');
ana.send({ t: 'hubchat', text: 'hello from ana' }); await until(() => bo.hub.some(m => m.text === 'hello from ana'), 'hub chat line');
const lineId = bo.hub.find(m => m.text === 'hello from ana').id;
ana.send({ t: 'farm', a: { t: 'starter', sp: 'mossbun' } }); await until(() => ana.farm?.did === 'starter', 'ana farm');
if (!(await bo.rank('farm')).rows.some(r => r.name === 'Ana')) fail('ana farm should be on the farm ladder before');

ana.send({ t: 'create', game: 'ttt', opts: { to: 1, timer: 0 } }); await until(() => ana.room?.code, 'table made');
bo.send({ t: 'join', code: ana.room.code }); await until(() => bo.room?.players?.length === 2, 'bo joined');
ana.send({ t: 'chat', text: 'good luck' }); await wait(600); bo.send({ t: 'chat', text: 'you too' });
await until(() => bo.chat.length === 2, 'table chat');
ana.autoplay = bo.autoplay = true;
ana.send({ t: 'start' }); await until(() => bo.state?.ph === 'end' && bo.room?.board?.length === 2, 'first match done', 20000);
if (!(await bo.rank('ttt')).rows.some(r => r.name === 'Ana' && !r.guest)) fail('ana should be ranked before');
ana.send({ t: 'lobby' }); await until(() => !bo.state, 'back to the waiting room');
ana.autoplay = bo.autoplay = false; // the second match stops after the first move, to delete in the middle of it
ana.send({ t: 'start' }); await until(() => bo.state?.ph === 'play', 'second match started');
await wait(1200); // past the moment to look at the board
const mover = bo.state.turn === bo.state.me ? bo : ana;
mover.send({ t: 'act', a: { t: 'place', c: 4 } }); await until(() => bo.state.mv === 1, 'first move');
await wait(2000); // saved

// 3. Ana deletes the account.
bo.boards = {}; bo.friends = null; cy.friends = null; bo.chatlog = null;
const done = await ana.ask({ t: 'delacct', user: 'ANA ', pass: 'apple123' });
if (done.ok !== 'delacct') fail('delete: ' + JSON.stringify(done));
await until(() => !ana.me.user && !ana2.me.user, 'both of ana\'s screens are guests');
await until(() => ana.errs.some(e => /deleted/.test(e)) && ana2.errs.some(e => /deleted/.test(e)), 'both screens told');
if ([...ana.errs, ...ana2.errs].some(e => /password/.test(e))) fail('the deleted screens were told about a password change');
await until(() => cy.gone.includes(lineId), 'hub chat line gone from open screens');
await until(() => bo.friends && !bo.friends.friends.length, 'bo friends list refreshed');
await until(() => cy.friends && !cy.friends.sent.length, 'cy pending request gone');
await until(() => bo.chatlog, 'table chat refreshed');
if (bo.chatlog.some(m => m.text === 'good luck') || !bo.chatlog.some(m => m.text === 'you too')) fail('table chat: only ana lines go ' + JSON.stringify(bo.chatlog));
await until(() => bo.room?.board?.length === 1, 'table scoreboard row gone');
if (bo.room.board.some(e => e.name === 'Ana')) fail('ana still on the table scoreboard');
if (bo.room.players.length !== 2 || bo.room.state !== 'play') fail('the match should carry on with both seats');
await until(() => bo.stale > 0 || cy.stale > 0, 'hub screens told to refresh the rankings');
if ((await cy.rank('ttt')).rows.some(r => r.name === 'Ana')) fail('ghost in the ttt rankings');
if ((await cy.rank('overall')).rows.some(r => r.name === 'Ana')) fail('ghost in the overall rankings');
if ((await cy.rank('farm')).rows.some(r => r.name === 'Ana')) fail('ghost on the farm ladder');
ana.send({ t: 'farm', a: { t: 'open' } }); await until(() => ana.farm?.need === 'account', 'the guest screen has no farm');
console.log('deleted, nothing left behind ok');

// 4. The match in progress plays out; its result goes to the guest, and nobody crashes.
ana.autoplay = bo.autoplay = true;
const kick = s => { if (s?.stage === 'play' && s.turn === s.me) { const c = s.board.findIndex(x => x < 0); (s === ana.state ? ana : bo).send({ t: 'act', a: { t: 'place', c } }); } };
kick(ana.state); kick(bo.state);
await until(() => bo.state?.ph === 'end', 'second match finished', 20000);
await wait(400);
const tt = await cy.rank('ttt');
if (tt.rows.some(r => r.name === 'Ana' && !r.guest)) fail('the deleted account came back in the rankings');

// 5. The name is held, the old password is dead, and other actions on the dead account are harmless.
const dan = await player('Dan').connect();
if ((await dan.ask({ t: 'login', user: 'ana', pass: 'apple123' })).ok) fail('deleted account could still log in');
if (!/taken/.test((await dan.ask({ t: 'register', user: 'Ana', pass: 'pear12345' })).err || '')) fail('the name should be held for 30 days');
bo.send({ t: 'friend', op: 'add', user: 'ana' }); await until(() => bo.errs.length, 'friend request to a deleted name');
const data = readSaved(DATA_DIR);
if (Object.values(data.profiles).some(p => p.user === 'ana')) fail('ana still saved');
if (!Array.isArray(data.gone) || data.gone.length !== 1 || /ana/i.test(JSON.stringify(data.gone))) fail('the held name should be saved as a hash only');
if (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'hub-chat.json'), 'utf8')).log.some(m => m.text === 'hello from ana')) fail('hub chat line still saved');
const farms = JSON.stringify(readFarms(DATA_DIR));
if (/"name":"Ana"/.test(farms)) fail('ana farm still saved');
console.log('name held, account gone from disk ok');

// 6. Host accounts can't be deleted from the site, and one address can delete only 3 accounts an hour.
const boss = await player('Boss').connect(); await reg(boss, 'boss');
if (!/Host accounts/.test((await boss.ask({ t: 'delacct', user: 'boss', pass: 'apple123' })).err || '')) fail('host account must not be deleted here');
if (!boss.me.user) fail('host still signed in');
for (const [i, u] of ['eve', 'fay'].entries()) {
  const x = await player(u).connect();
  if (i === 1) await wait(1000);
  await reg(x, u);
  if ((await x.ask({ t: 'delacct', user: u, pass: 'apple123' })).ok !== 'delacct') fail('delete ' + u);
}
// registrations are capped at 6 an hour from one address too, so the 4th deletion uses an account made earlier
if (!/Try again in an hour/.test((await cy.ask({ t: 'delacct', user: 'cyd', pass: 'apple123' })).err || '')) fail('the 4th deletion from one address in an hour should wait');
if (!cy.me.user) fail('cy should still have the account');
console.log('host accounts and limits ok');

// 7. After a restart the name is still held and nothing breaks loading.
srv.kill(); await wait(400);
await start();
const gil = await player('Gil').connect();
if (!/taken/.test((await gil.ask({ t: 'register', user: 'ana', pass: 'pear12345' })).err || '')) fail('the held name should survive a restart');
if ((await gil.ask({ t: 'login', user: 'bob', pass: 'apple123' })).ok !== 'login') fail('bob login after restart');
console.log('restart ok');

// 8. The held name frees up once its 30 days are over (checked straight on the store, with the clock moved on).
srv.kill(); await wait(400);
process.env.DATA_DIR = DATA_DIR;
const store = await import('../server/store.js');
store.load();
if (!store.nameHeld('ana') || store.nameHeld('bob')) fail('nameHeld');
const realNow = Date.now; Date.now = () => realNow() + store.GONE_MS + 1000;
if (store.nameHeld('ana')) fail('the name should be free after 30 days');
Date.now = realNow;
console.log('delete self ok');
fs.rmSync(DATA_DIR, { recursive: true, force: true });
process.exit(0);

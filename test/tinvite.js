// Inviting friends from the waiting room (server 'tinvite'): only accounts, only friends, only people on the site,
// one invite per friend per table for a while, and the card carries the table code to join.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-tinv-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' });
await wait(700);
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, room: null, inv: [], sent: [], errs: [], friends: null };
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
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'friends') p.friends = m;
      if (m.t === 'tinvite') p.inv.push(m);
      if (m.t === 'tinvited') p.sent.push(m);
      if (m.t === 'err') p.errs.push(m.msg);
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, m.t); return p.auth; };
  p.err = async what => { const n = p.errs.length; await until(() => p.errs.length > n, what); return p.errs.at(-1); };
  return p;
}

const ana = await player('Ana').connect(), bo = await player('Bo').connect(), cy = await player('Cy').connect(), gus = await player('Gus').connect();
for (const [p, u] of [[ana, 'ana'], [bo, 'bob'], [cy, 'cyd']]) if ((await p.ask({ t: 'register', user: u, pass: 'apple123' })).ok !== 'register') fail('register ' + u);
ana.send({ t: 'friend', op: 'add', user: 'bob' }); await until(() => bo.friends?.reqs?.length, 'bo gets the request');
bo.send({ t: 'friend', op: 'accept', user: 'ana' }); await until(() => ana.friends?.friends?.length === 1, 'ana and bo are friends');
const boTag = ana.friends.friends[0].pt, cyTag = cy.me.pt;

// Not at a table: nothing happens.
ana.send({ t: 'tinvite', pt: boTag }); await wait(300);
if (bo.inv.length || ana.sent.length) fail('invite without a table');

ana.send({ t: 'create', game: 'hotpot' }); await until(() => ana.room, 'ana room');
const code = ana.room.code;

// Not a friend, a guest asking, a made-up tag: refused, and nobody gets a card.
ana.send({ t: 'tinvite', pt: cyTag });
if (!/only invite your friends/.test(await ana.err('not a friend'))) fail('cy is not a friend');
gus.send({ t: 'create', game: 'hotpot' }); await until(() => gus.room, 'gus room');
gus.send({ t: 'tinvite', pt: boTag });
if (!/Create an account/.test(await gus.err('guest'))) fail('guest needs an account');
ana.send({ t: 'tinvite', pt: 'nope' }); await ana.err('bad tag');
await wait(200);
if (cy.inv.length || bo.inv.length) fail('a refused invite still arrived');

// A friend on the site gets the card with the code.
ana.send({ t: 'tinvite', pt: boTag });
await until(() => bo.inv.length === 1 && ana.sent.length === 1, 'bo gets the invite');
const inv = bo.inv[0];
if (inv.code !== code || inv.game !== 'hotpot' || inv.from !== 'Ana' || !inv.pt) fail('invite card ' + JSON.stringify(inv));
if (JSON.stringify(inv).includes(ana.token)) fail('invite leaks a token');

// Again straight away: refused, so a friend can't be spammed.
ana.send({ t: 'tinvite', pt: boTag });
if (!/just invited/.test(await ana.err('repeat'))) fail('second invite should wait');
if (bo.inv.length !== 1) fail('repeat arrived');

// Bo joins with the code from the card; inviting someone already there just says so.
bo.send({ t: 'join', code }); await until(() => bo.room?.code === code, 'bo joins');
ana.send({ t: 'tinvite', pt: boTag });
await until(() => ana.sent.at(-1)?.here === true || ana.errs.length > 4, 'already here');
if (ana.sent.at(-1)?.here !== true) fail('already at the table ' + ana.errs.at(-1));

// A friend who is away: refused with a clear message.
bo.send({ t: 'leave' }); await wait(100); bo.ws.close(); await wait(300);
ana.send({ t: 'tinvite', pt: boTag });
if (!/not on the site/.test(await ana.err('away'))) fail('away friend');

console.log('tinvite ok');
srv.kill(); process.exit(0);

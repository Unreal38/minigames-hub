// A guest look in a browser must never overwrite an account's saved look when that browser logs in.
// Kuba's case (2026-11-23): a new browser made a guest; logging in reloaded the page (the account's language
// differed), and the reconnect's hello carried the guest name and avatar, which the server saved over the account.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' });
await wait(700);
process.on('exit', () => srv.kill());
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 10000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

// One browser: a token, and the look it keeps locally. connect() sends hello with that look, as app.js does.
function browser(look, token) {
  const b = { look, token, me: null, auth: null, room: null };
  b.connect = () => new Promise(res => {
    const ws = b.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    b.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => b.send({ t: 'hello', token: b.token, ...b.look });
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') b.token = m.token;
      if (m.t === 'me') { b.me = m.me; res(); }
      if (m.t === 'auth') b.auth = m;
      if (m.t === 'room') b.room = m.room;
    };
  });
  b.close = () => new Promise(r => { b.ws.onclose = r; b.ws.close(); });
  return b;
}
const ACC = { name: 'Kuba', color: '#5b8def', av: [2, 3, 1, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
const GUEST = { name: 'Guest', color: '#ff8fab', av: [5, 1, 6, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
const sameLook = (me, l) => me.name === l.name && me.color === l.color;

// The account, made on the first browser.
const home = browser(ACC); await home.connect();
home.send({ t: 'register', user: 'kuba', pass: 'secret123' });
await until(() => home.auth?.ok === 'register', 'register');
await until(() => home.me?.user === 'kuba' && sameLook(home.me, ACC), 'account look');
home.send({ t: 'lang', v: 'pl' });
const accAv = home.me.av;

// A new browser: a guest with its own look, then logs in.
const fresh = browser(GUEST); await fresh.connect();
if (fresh.me.user || fresh.me.name !== 'Guest' || JSON.stringify(fresh.me.av) === JSON.stringify(accAv)) fail('new browser should start as a guest with its own look');
fresh.auth = null; fresh.send({ t: 'login', user: 'kuba', pass: 'secret123' });
await until(() => fresh.auth?.ok === 'login', 'login');
await until(() => fresh.me?.user === 'kuba', 'logged in me');
if (fresh.me.name !== ACC.name || fresh.me.color !== ACC.color || JSON.stringify(fresh.me.av) !== JSON.stringify(accAv)) fail('login should hand back the account look ' + JSON.stringify(fresh.me));

// The page reloads before it saved the account look (the language switch did that) and says hello with the guest look.
await fresh.close();
const reload = browser(GUEST, fresh.token); await reload.connect();
await until(() => reload.me?.user === 'kuba', 'reloaded me');
if (reload.me.name !== ACC.name || reload.me.color !== ACC.color || JSON.stringify(reload.me.av) !== JSON.stringify(accAv)) fail('a hello must not overwrite the account look ' + JSON.stringify(reload.me));

// Others see the account look too: at a table the player sits with the account name and avatar.
reload.send({ t: 'create', game: 'hotpot', opts: { bots: 'sharp', timer: 0 } });
await until(() => reload.room, 'room');
const seat = reload.room.players[0];
if (seat.name !== ACC.name || seat.color !== ACC.color) fail('table shows the guest look ' + JSON.stringify(seat));

// The first browser still sees its look when it comes back.
await home.close();
const back = browser({ name: 'Someone', color: '#000000', av: GUEST.av }, home.token); await back.connect();
await until(() => back.me?.user === 'kuba', 'home me');
if (back.me.name !== ACC.name || back.me.color !== ACC.color) fail('account look changed on the other device ' + JSON.stringify(back.me));

// The wardrobe still changes it on purpose.
back.send({ t: 'profile', name: 'Kuba2', color: '#22aa66', av: accAv });
await until(() => back.me?.name === 'Kuba2' && back.me.color === '#22aa66', 'profile change saved');

// A guest's look still follows its browser.
const g = browser(GUEST); await g.connect(); await g.close();
const g2 = browser({ ...GUEST, name: 'Newname' }, g.token); await g2.connect();
if (g2.me.user || g2.me.name !== 'Newname') fail('a guest should keep the look its browser sends ' + JSON.stringify(g2.me));

console.log('guest look test passed');
srv.kill(); process.exit(0);

// Site notices: only ADMINS change them; the countdown holds new games but not running ones; the announcement and
// "What's new" reach every screen; a stop says goodbye (close 1012) after saving; an "after the restart" note goes live
// on the next start; the page build id comes with welcome.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 19980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-notice-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async () => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, ADMINS: 'Boss', NOTICE_TEST: '1', GEO: 'off' }, stdio: 'inherit' }); await wait(800); };
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, notice: null, room: null, state: null, errs: [], bye: false, code: 0, build: '' };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onclose = e => { p.code = e.code; };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { p.token = m.token; p.build = m.build; }
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'state') p.state = m.s;
      if (m.t === 'notice') p.notice = m;
      if (m.t === 'err') p.errs.push(m.msg);
      if (m.t === 'bye') p.bye = true;
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, m.t); return p.auth; };
  return p;
}

await start();
const boss = await player('Kuba').connect(), ana = await player('Ana').connect();
await until(() => ana.notice, 'notice on hello');
if (ana.notice.maint || ana.notice.ann || ana.notice.news) fail('nothing to show at first ' + JSON.stringify(ana.notice));
if (!/^[0-9a-f]{12}$/.test(ana.build)) fail('welcome carries the build id ' + ana.build);
if ((await boss.ask({ t: 'register', user: 'boss', pass: 'apple123' })).ok !== 'register') fail('register boss');
await until(() => boss.me.admin, 'boss is a host');

// Not a host: nothing changes.
ana.notice = null; ana.send({ t: 'notice', op: 'maint', min: 5 }); ana.send({ t: 'notice', op: 'ann', en: 'hi' }); await wait(400);
if (ana.notice) fail('a guest changed the notices');

// Ana sits at a table that is already playing; then the host starts a 5 minute countdown.
ana.send({ t: 'create', game: 'ttt', solo: true }); await until(() => ana.state, 'ana plays');
ana.notice = null; boss.notice = null;
boss.send({ t: 'notice', op: 'maint', min: 5, pl: 'Nowe gry', en: 'New games' });
await until(() => ana.notice?.maint, 'everyone gets the countdown');
const left = ana.notice.maint.left;
if (!(left > 290_000 && left <= 300_000)) fail('five minutes left ' + left);
if (ana.notice.maint.en !== 'New games' || ana.notice.maint.pl !== 'Nowe gry') fail('reason in both languages');
if ('next' in ana.notice) fail('players do not get the hosts\' extras');
await until(() => boss.notice && 'next' in boss.notice, 'host gets the extras');

// New games are on hold; the running one carries on.
const n0 = ana.errs.length; ana.send({ t: 'leave' }); await until(() => !ana.room, 'ana left');
ana.send({ t: 'create', game: 'hotpot' }); await until(() => ana.errs.length > n0, 'hold error');
if (!/on hold/.test(ana.errs.at(-1)) || ana.room) fail('new table refused ' + ana.errs.at(-1));
boss.send({ t: 'notice', op: 'maint', min: 500 }); await until(() => boss.errs.some(e => /Pick 1 to 120/.test(e)), 'too long refused');

// Cancel: tables open again.
boss.send({ t: 'notice', op: 'cancel' }); await until(() => ana.notice && !ana.notice.maint, 'cancel reaches everyone');
ana.send({ t: 'create', game: 'hotpot' }); await until(() => ana.room, 'table after cancel');

// Waiting room: start refused while holding.
boss.send({ t: 'notice', op: 'maint', min: 2 }); await until(() => ana.notice?.maint, 'second countdown');
ana.state = null; const n1 = ana.errs.length; ana.send({ t: 'start' }); await until(() => ana.errs.length > n1, 'start refused');
if (ana.state) fail('a game started during the hold');
// Past zero the hold stays for the restart, then lifts by itself.
boss.send({ t: 'notice', test: { endIn: -14.9 * 60_000 } }); await until(() => ana.notice.maint && ana.notice.maint.left < 0, 'time is up');
boss.send({ t: 'notice', test: { endIn: -15 * 60_000 - 50 } }); await until(() => !ana.notice.maint, 'the hold lifts by itself');

// Announcement: markup is stripped, one line, can be taken down.
boss.send({ t: 'notice', op: 'ann', en: 'Tournament <b>tonight</b>\n at 20:00', pl: '' });
await until(() => ana.notice?.ann, 'announcement');
if (ana.notice.ann.en !== 'Tournament b tonight /b at 20:00' || ana.notice.ann.pl !== '') fail('clean announcement ' + JSON.stringify(ana.notice.ann));
const annId = ana.notice.ann.id;
boss.send({ t: 'notice', op: 'ann' }); await until(() => !ana.notice.ann, 'announcement down');
boss.send({ t: 'notice', op: 'ann', pl: 'Turniej dziś' }); await until(() => ana.notice.ann && ana.notice.ann.id !== annId, 'a new announcement has a new id');

// What's new after the restart: hosts see it waiting, players don't get it yet.
boss.send({ t: 'notice', op: 'news', when: 'restart', en: 'New track!\nAnd fixes.', pl: 'Nowa trasa!' });
await until(() => boss.notice?.next?.en === 'New track!\nAnd fixes.', 'host sees the waiting note');
if (ana.notice.news) fail('players get the note only after the restart');
boss.send({ t: 'notice', op: 'maint', min: 3 }); await until(() => ana.notice?.maint, 'countdown before the stop');

// The stop: goodbye to every screen, close 1012, everything saved.
srv.kill('SIGTERM');
await until(() => ana.bye && boss.bye, 'goodbye');
await until(() => ana.code === 1012, 'close code 1012');
await new Promise(r => srv.once('exit', r));
const saved = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8'));
if (!Object.values(saved.profiles).some(p => p.user === 'boss')) fail('accounts saved on the way out');

// Back up: the note is live for everyone, the countdown is gone, the announcement stays.
await start();
const ana2 = await player('Ana', ana.token).connect();
await until(() => ana2.notice, 'notice after restart');
if (ana2.notice.maint) fail('a restart ends the countdown');
if (ana2.notice.news?.en !== 'New track!\nAnd fixes.' || ana2.notice.news.pl !== 'Nowa trasa!') fail('the note went live ' + JSON.stringify(ana2.notice));
if (ana2.notice.ann?.pl !== 'Turniej dziś') fail('announcement survives the restart');
if (ana2.build !== ana.build) fail('same files, same build');
const boss2 = await player('Kuba', boss.token).connect(); await until(() => boss2.notice, 'host notice');
if (boss2.notice.next) fail('the waiting note was used up');
boss2.send({ t: 'notice', op: 'news', when: 'clear' }); await until(() => ana2.notice && !ana2.notice.news, 'note removed');

srv.kill(); await new Promise(r => srv.once('exit', r)); try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
console.log('notice: ok');
process.exit(0);

// Mystery Pet (the daily guess-the-pet puzzle): guests are asked for an account, clues add up, the answer stays on
// the server until a hint is due, solving pays once, streaks count day by day, the result posts to the hub chat
// once, and both the day's answer and a player's progress survive a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SPECIES } from '../public/games/farm/data.js';
import { cosHas, COS } from '../public/cosmetics.js';
const PORT = 18080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-mp-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
// 23:30 in Warsaw on 30 November: half an hour before the next puzzle.
const start = async () => { srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, DAILY_TEST: '1', DAILY_NOW: '2026-11-30T22:30:00Z' }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, d: null, peek: null, chat: [] };
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
      if (m.t === 'daily') p.d = m;
      if (m.t === 'dailypeek') p.peek = m;
      if (m.t === 'hubchat' && m.msg) p.chat.push(m.msg);
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply'); return p.auth; };
  p.daily = async (m = {}) => { p.d = null; p.send({ t: 'daily', ...m }); await until(() => p.d, 'daily reply'); return p.d; };
  p.answer = async () => { p.peek = null; p.send({ t: 'daily', test: { peek: true } }); await until(() => p.peek, 'peek'); return p.peek.secret; };
  return p;
}
const ALL = Object.keys(SPECIES).filter(sp => !SPECIES[sp].wheel); // Lucky Wheel pets are never the answer

await start();
const guest = await player('Gus').connect();
const ana = await player('Ana').connect(), bo = await player('Bo').connect();
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');
if ((await bo.ask({ t: 'register', user: 'bob', pass: 'apple123' })).ok !== 'register') fail('register bo');

// 1. Guests see the puzzle number and the board, and nothing else.
let g = await guest.daily();
if (!g.guest || g.day !== '2026-11-30' || g.no !== 9 || g.secret !== undefined || g.guesses) fail('guest view ' + JSON.stringify(g).slice(0, 200));
g = await guest.daily({ guess: 'mossbun' });
if (!g.guest || g.guesses) fail('a guest could guess');
if (g.next < 29 * 60_000 || g.next > 31 * 60_000) fail('countdown to Warsaw midnight: ' + g.next);
console.log('guest ok');

// 2. Wrong guesses give clues and keep the answer on the server until the first hint.
const secret = await ana.answer();
if (!SPECIES[secret]) fail('no secret');
const wrong = ALL.filter(sp => sp !== secret);
let d = await ana.daily();
if (d.guesses.length || d.done || d.secret !== null || d.hint !== 0 || d.pay !== 20 || d.pets !== ALL.length) fail('fresh view ' + JSON.stringify(d).slice(0, 300));
d = await ana.daily({ guess: wrong[0] });
if (d.guesses.length !== 1 || d.guesses[0].clues.length !== d.cols.length || d.secret !== null) fail('first guess');
if (d.guesses[0].clues.every(c => c.s === 'ok')) fail('a wrong pet got every clue right');
for (const c of d.guesses[0].clues) if (!['ok', 'near', 'no'].includes(c.s) || typeof c.v !== 'string') fail('clue shape ' + JSON.stringify(c));
d = await ana.daily({ guess: wrong[0] });
if (!/already tried/.test(d.err) || d.guesses.length !== 1) fail('same pet twice');
d = await ana.daily({ guess: 'dragon' });
if (!/not a pet/.test(d.err) || d.guesses.length !== 1) fail('made-up pet');
d = await ana.daily({ guess: wrong[1] });
if (d.secret !== null || d.hint !== 0) fail('answer leaked after 2 guesses');
d = await ana.daily({ guess: wrong[2] });
if (d.secret !== secret || d.hint !== 1) fail('first hint after 3 wrong guesses');
if (JSON.stringify(await bo.daily()).includes(`"secret":"${secret}"`)) fail('answer sent to someone with no guesses');
console.log('clues ok');

// 3. Solving pays by the number of guesses, once, and starts a streak.
const before = ana.me.coins;
d = await ana.daily({ guess: secret });
if (!d.done || d.solved?.coins !== 14 || d.solved?.xp !== 8 || d.won !== 14 || d.streak !== 1 || d.grid.length !== 4 || d.grid[3] !== 'g'.repeat(d.cols.length)) fail('solve ' + JSON.stringify(d.solved) + d.grid);
if (!d.guesses[3].clues.every(c => c.s === 'ok')) fail('the answer should be all green');
await until(() => ana.me.coins === before + 14, 'coins paid');
d = await ana.daily({ guess: wrong[5] });
if (!/already solved/.test(d.err) || d.guesses.length !== 4) fail('guess after solving');
await wait(700);
if (ana.me.coins !== before + 14) fail('paid twice');
// Bo gets it first try: 20 coins, and the board puts fewer guesses first.
d = await bo.daily({ guess: secret });
if (d.solved?.coins !== 20) fail('first-try reward');
if (d.board.total !== 2 || d.board.rows[0].name !== 'Bo' || !d.board.rows[0].me || d.board.rows[1].n !== 4 || d.board.rows[0].pid !== undefined) fail('board ' + JSON.stringify(d.board));
console.log('solve ok');

// 4. Sharing posts one line with a spoiler-free grid to the hub chat, once.
d = await ana.daily({ share: true });
if (!d.sharedNow || !d.shared) fail('share');
await until(() => guest.chat.length, 'chat line');
const line = guest.chat[0];
if (!/Mystery Pet #9: solved in 4 guesses/.test(line.text) || line.grid?.length !== 4 || line.text.includes(SPECIES[secret].name)) fail('chat line ' + JSON.stringify(line));
d = await ana.daily({ share: true });
if (!/already shared/.test(d.err)) fail('shared twice');
console.log('share ok');

// 5. A restart keeps today's answer and everyone's progress.
await stop(); await start();
const ana2 = await player('Ana', ana.token).connect();
d = await ana2.daily();
if (!d.done || d.guesses.length !== 4 || d.secret !== secret || d.streak !== 1) fail('progress lost in a restart');
if (await ana2.answer() !== secret) fail('the answer changed in a restart');
console.log('restart ok');

// 6. Midnight in Warsaw brings a new pet; solving day after day builds the streak and a missed day resets it.
ana2.send({ t: 'daily', test: { skip: 1 } });
d = await ana2.daily();
if (d.day !== '2026-12-01' || d.no !== 10 || d.done || d.guesses.length || d.streak !== 1 || d.board.total !== 0) fail('next day ' + JSON.stringify(d).slice(0, 200));
const seen = new Set([secret]);
for (let day = 2; day <= 7; day++) {
  const s = await ana2.answer(); if (seen.has(s)) fail('a pet came back within a week'); seen.add(s);
  d = await ana2.daily({ guess: s });
  if (d.streak !== day || d.best !== day || !!d.solved.newTitle !== (day === 7)) fail(`streak on day ${day}: ${d.streak}`);
  ana2.send({ t: 'daily', test: { skip: 1 } }); await wait(30);
}
const ti = COS.ti.items.findIndex(t => t.earn?.d === 7);
if (ti < 0 || !cosHas(ana2.me, 'ti', ti)) { await wait(800); if (!cosHas(ana2.me, 'ti', ti)) fail('7 days in a row should unlock the title'); }
ana2.send({ t: 'daily', test: { skip: 1 } }); // a day with no guess
d = await ana2.daily();
if (d.streak !== 0 || d.best !== 7 || d.total !== 7) fail('a missed day should reset the streak: ' + d.streak);
d = await ana2.daily({ guess: await ana2.answer() });
if (d.streak !== 1 || d.best !== 7) fail('streak after a miss');
console.log('streak ok');

srv.kill(); await new Promise(r => srv.once('exit', r));
fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log('mystery pet test passed');
process.exit(0);

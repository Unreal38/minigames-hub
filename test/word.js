// Word in a Bottle: marks, the daily word, six tries, streaks, coins once a day, sharing, and that the word stays
// on the server until the day is over. Run: node test/word.js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let srv = null;
const PORT = 3997, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-'));
const fail = m => { console.error('FAIL:', m); srv?.kill(); process.exit(1); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, what) => { for (let i = 0; i < 200; i++) { if (fn()) return; await wait(20); } fail('timeout: ' + what); };

// 1. The marking rules and the word lists, straight from the module.
process.env.DATA_DIR = dir;
const { mark, answersOf, isWord, REWARD, CONSOLATION, TRIES } = await import('../server/word.js');
const eq = (a, b, what) => { if (a !== b) fail(`${what}: ${a} != ${b}`); };
eq(mark('robot', 'robot'), 'hhhhh', 'all right');
eq(mark('lalka', 'bilet'), 'mmhmm', 'one l in the word marks one l only');
eq(mark('speed', 'abide'), 'mmnmn', 'double letter, one in the word');
eq(mark('llama', 'label'), 'hnnmm', 'right spot is taken first, a second a is not marked');
eq(mark('żółty', 'łóżko'), 'nhnmm', 'Polish letters');
for (const lang of ['pl', 'en']) {
  const a = answersOf(lang);
  if (a.length < 700) fail(`${lang}: only ${a.length} answers`);
  for (const w of a) if (!isWord(lang, w) || [...w].length !== 5) fail(`${lang}: answer ${w} is not a valid guess`);
}
if (!isWord('pl', 'żółty') || !isWord('pl', 'łódka') || isWord('pl', 'qwert') || isWord('en', 'żółty')) fail('dictionary');
console.log('rules ok');

// 2. The server.
srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, DATA_DIR: dir, DAILY_TEST: '1', DAILY_NOW: '2026-11-30T10:00:00Z', GEO: 'off' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('http') && r()));
function player(name) {
  const p = { name, me: null, auth: null, w: null, peek: null, chat: [] };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: '', name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'word') p.w = m;
      if (m.t === 'wordpeek') p.peek = m;
      if (m.t === 'hubchat' && m.msg) p.chat.push(m.msg);
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply'); return p.auth; };
  p.word = async (m = {}) => { p.w = null; p.send({ t: 'word', ...m }); await until(() => p.w, 'word reply'); return p.w; };
  p.answer = async () => { p.peek = null; p.send({ t: 'word', test: { peek: true } }); await until(() => p.peek, 'peek'); return p.peek; };
  return p;
}
const guest = await player('Gus').connect(), ana = await player('Ana').connect(), bo = await player('Bo').connect();
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');
if ((await bo.ask({ t: 'register', user: 'bob', pass: 'apple123' })).ok !== 'register') fail('register bo');

let v = await guest.word({ lang: 'pl', guess: 'robot' });
if (!v.guest || v.L || v.no !== 7) fail('guest view ' + JSON.stringify(v).slice(0, 200));

const sec = await ana.answer();
if (!isWord('pl', sec.pl) || !isWord('en', sec.en)) fail('no secret');
const wrong = (lang, n) => answersOf(lang).filter(w => w !== sec[lang]).slice(0, n);
const coins0 = ana.me.coins;

// Not a word, too short: nothing is used up. The answer is not in any reply while the day is open.
v = await ana.word({ lang: 'pl', guess: 'qqqqq' });
if (v.bad !== 'word' || v.L.pl.rows.length) fail('a non-word was taken');
v = await ana.word({ lang: 'pl', guess: 'kot' });
if (v.bad !== 'short' || v.L.pl.rows.length) fail('a short word was taken');
const [w1, w2] = wrong('pl', 2);
v = await ana.word({ lang: 'pl', guess: w1.toUpperCase() });
if (v.L.pl.rows.length !== 1 || v.L.pl.rows[0].m !== mark(w1, sec.pl) || v.L.pl.answer || JSON.stringify(v).includes(`"${sec.pl}"`)) fail('first try ' + JSON.stringify(v.L.pl));
v = await ana.word({ lang: 'pl', guess: w1 });
if (v.bad !== 'twice' || v.L.pl.rows.length !== 1) fail('the same word twice');
if (JSON.stringify(v).includes(`"${sec.en}"`)) fail('the English word leaked');
v = await ana.word({ lang: 'pl', share: true });
if (!v.err) fail('shared before finishing');

// Solved on the third try: coins by tries, streak 1, the answer is told, a second go is refused.
await ana.word({ lang: 'pl', guess: w2 });
v = await ana.word({ lang: 'pl', guess: sec.pl });
if (!v.over?.won || v.over.coins !== REWARD[2] || !v.L.pl.done || !v.L.pl.won || v.L.pl.answer !== sec.pl || v.L.pl.streak !== 1 || v.L.pl.dist[2] !== 1) fail('solve ' + JSON.stringify(v.L.pl));
await until(() => ana.me.coins === coins0 + REWARD[2], 'coins for solving');
v = await ana.word({ lang: 'pl', guess: wrong('pl', 3)[2] });
if (!v.err || v.L.pl.rows.length !== 3) fail('guessed after finishing');
if (v.L.en.done || v.L.en.rows.length) fail('English is its own puzzle');

// Sharing posts one line with the marks, once.
v = await ana.word({ lang: 'pl', share: true });
if (!v.sharedNow) fail('share ' + v.err);
await until(() => bo.chat.length, 'chat line');
const line = bo.chat[0];
if (!/^📜 Word in a Bottle #7 \(PL\): 3\/6$/.test(line.text) || line.grid?.length !== 3 || line.grid[2] !== 'hhhhh') fail('chat line ' + JSON.stringify(line));
v = await ana.word({ lang: 'pl', share: true });
if (!v.err) fail('shared twice');

// Six wrong tries: the day is over, a few consolation coins, the answer is told.
const boCoins = bo.me.coins;
for (const w of wrong('en', TRIES)) v = await bo.word({ lang: 'en', guess: w });
if (!v.over || v.over.won || !v.L.en.done || v.L.en.won || v.L.en.answer !== sec.en || v.L.en.played !== 1 || v.L.en.wins !== 0) fail('six wrong ' + JSON.stringify(v.L.en));
await until(() => bo.me.coins === boCoins + CONSOLATION, 'consolation coins for a lost day'); if (v.L.en.got !== CONSOLATION) fail('lost day view');

// The next day: a fresh board, yesterday's streak carries on; a missed day ends it.
ana.send({ t: 'daily', test: { skip: 1 } }); await wait(40);
v = await ana.word();
if (v.no !== 8 || v.L.pl.rows.length || v.L.pl.done || v.L.pl.streak !== 1) fail('next day ' + JSON.stringify(v.L.pl));
const sec2 = await ana.answer();
v = await ana.word({ lang: 'pl', guess: sec2.pl });
if (v.over?.coins !== REWARD[0] || v.L.pl.streak !== 2 || v.L.pl.best !== 2 || v.L.pl.wins !== 2) fail('day two ' + JSON.stringify(v.L.pl));
ana.send({ t: 'daily', test: { skip: 2 } }); await wait(40);
v = await ana.word();
if (v.L.pl.streak !== 0 || v.L.pl.best !== 2 || v.L.pl.played !== 2) fail('missed day ' + JSON.stringify(v.L.pl));

srv.kill(); await wait(200); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
console.log('word ok');
process.exit(0);

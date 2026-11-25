// Word Reef test: the dictionaries, reading and scoring plays on both islands, challenges (a wrong word comes back
// off, a right one earns the player +10), bots of every strength playing whole games on a fake clock (every tile
// always accounted for, nobody ever sent another tray), then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as rf from '../server/games/reef.js';
import { has, knows, size } from '../server/reefdict.js';
import { findPlays } from '../server/games/reef-bot.js';
import { readPlay, fromRack, bagOf, BOARDS, boardOf, LETTERS, value, RACK, WILD, FULL_BONUS, NEST_BONUS, CHAL_BONUS } from '../public/games/reef/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- dictionaries -----
if (size('pl') < 3e6 || size('en') < 160000) fail('dictionaries too small');
for (const w of ['kot', 'kotów', 'żółw', 'źdźbło', 'gęślą', 'dżdżownica', 'zażółć', 'aa']) if (!has('pl', w)) fail('missing Polish word ' + w);
for (const w of ['qqq', 'kotx', 'ab', 'a', '', 'zażółćgęśląjaźń']) if (has('pl', w)) fail('not a Polish word: ' + w);
for (const w of ['cat', 'jump', 'jumps', 'zyzzyva', 'aa', 'quiz']) if (!has('en', w)) fail('missing English word ' + w);
for (const w of ['catz', 'xx', 'qwzx']) if (has('en', w)) fail('not an English word: ' + w);
if (!has('pl', 'KOT')) fail('lookups should ignore case');
if (!knows('pl', 'easy', 'kot') || knows('pl', 'easy', 'zażółć')) fail('easy bots know the wrong words');

// ----- boards and bags -----
for (const [k, B] of Object.entries(BOARDS)) {
  const N = B.N, K = B.kinds;
  if (K.length !== N * N || K[B.mid] !== '*') fail(k + ' board shape wrong');
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = K[r * N + c]; if (v !== K[c * N + r] || v !== K[(N - 1 - r) * N + c] || v !== K[r * N + N - 1 - c]) fail(k + ' board not symmetric'); }
  if ([...K].filter(x => x === 'n').length !== 4 || [...K].filter(x => x === 'v').length !== 4) fail(k + ' should have 4 nests and 4 whirlpools');
}
if (BOARDS.small.N !== 13 || BOARDS.big.N !== 15 || boardOf('x') !== BOARDS.small) fail('board sizes wrong');
for (const lang of ['pl', 'en']) {
  if (bagOf(lang, 'short').length !== 64 || bagOf(lang, 'full').length !== 100) fail(lang + ' bag sizes wrong');
  if (bagOf(lang, 'short').filter(l => l === WILD).length !== 2) fail('two wild tiles a bag');
  for (const [l, v] of Object.entries(LETTERS[lang])) if (v[1] < 1 || v[2] < v[1] || v[0] < 1) fail(`${lang} ${l}: every letter in both bags with a value`);
}
if (Object.keys(LETTERS.pl).length !== 32 || Object.keys(LETTERS.en).length !== 26) fail('alphabets wrong');

// ----- reading plays -----
{
  const B = BOARDS.small, N = B.N, cells = Array(N * N).fill(''), wild = Array(N * N).fill(0), m = B.mid, at = (r, c) => r * N + c;
  const r0 = m / N | 0, c0 = m % N;
  const t = (r, c, l, w = 0) => ({ i: at(r, c), l, w });
  if (readPlay(B, cells, wild, [t(r0, c0 - 3, 'k'), t(r0, c0 - 2, 'o'), t(r0, c0 - 1, 't')], 'pl').err !== 'middle') fail('first word must cover the middle');
  if (readPlay(B, cells, wild, [t(r0, c0, 'k')], 'pl').err !== 'short') fail('a single first letter is no word');
  if (readPlay(B, cells, wild, [t(r0, c0, 'k'), t(r0 + 1, c0 + 1, 'o')], 'pl').err !== 'line') fail('tiles off a line accepted');
  if (readPlay(B, cells, wild, [t(r0, c0, 'k'), t(r0, c0 + 2, 'o')], 'pl').err !== 'gap') fail('gap accepted');
  if (readPlay(B, cells, wild, [t(0, 0, 'k'), t(0, 1, 'o')], 'pl').err !== 'water') fail('tiles in the sea accepted');
  if (readPlay(B, cells, wild, [t(r0, c0, 'x'), t(r0, c0 + 1, 'o')], 'pl').err !== 'letter') fail('a letter outside the alphabet accepted');
  // KOT across the middle: k2 o1 t2, the star doubles the word -> 10
  const p = readPlay(B, cells, wild, [t(r0, c0 - 1, 'k'), t(r0, c0, 'o'), t(r0, c0 + 1, 't')], 'pl');
  if (!p.ok || p.words.length !== 1 || p.words[0].w !== 'kot' || p.pts !== (2 + 1 + 2) * 2 || p.dir !== 'a') fail('first word scored wrong: ' + JSON.stringify(p));
  for (const x of [[r0, c0 - 1, 'k'], [r0, c0, 'o'], [r0, c0 + 1, 't']]) cells[at(x[0], x[1])] = x[2];
  if (readPlay(B, cells, wild, [t(r0, c0, 'a')], 'pl').err !== 'taken') fail('a taken square accepted');
  if (readPlay(B, cells, wild, [t(r0 + 3, c0, 'a'), t(r0 + 3, c0 + 1, 'b')], 'pl').err !== 'alone') fail('a play that does not join accepted');
  // KOTY: one tile on the end; y = 2 on a plain square
  const q = readPlay(B, cells, wild, [t(r0, c0 + 2, 'y')], 'pl');
  if (!q.ok || q.words[0].w !== 'koty' || q.pts !== 2 + 1 + 2 + 2) fail('extending a word scored wrong: ' + JSON.stringify(q));
  // a word down through the O, with a cross word: tiles under the board letters; bonus squares count only when new
  const d = readPlay(B, cells, wild, [t(r0 - 1, c0, 'k'), t(r0 + 1, c0, 'c')], 'pl');
  if (!d.ok || d.dir !== 'd' || d.words[0].w !== 'koc' || d.pts !== 2 + 1 + 2) fail('down word through a letter wrong: ' + JSON.stringify(d));
  // a wild tile scores 0 and keeps scoring 0 on the board
  const w = readPlay(B, cells, wild, [t(r0, c0 + 2, 'y', 1)], 'pl');
  if (!w.ok || w.pts !== 5) fail('wild tile scored');
  // nests and a full tray
  const B2 = BOARDS.small, nest = [...B2.kinds].indexOf('n'), c2 = Array(N * N).fill(''); c2[nest + 1] = 'a'; c2[B2.mid] = 'a';
  const np = readPlay(B2, c2, wild, [{ i: nest, l: 'k', w: 0 }], 'pl');
  if (!np.ok || np.nests.length !== 1 || np.pts !== 2 + 1 + NEST_BONUS) fail('nest bonus wrong: ' + JSON.stringify(np));
  const row = Array.from({ length: 7 }, (_, k) => ({ i: at(r0 + 1, c0 - 3 + k), l: 'a', w: 0 }));
  const full = readPlay(B, cells, wild, row, 'pl');
  if (!full.ok || !full.full || full.pts < FULL_BONUS) fail('full tray bonus missing');
  // tray checks
  if (fromRack(['k', 'o', '?'], [{ l: 'k' }, { l: 't', w: 1 }]).join() !== 'o' || fromRack(['k'], [{ l: 'o' }]) || fromRack(['k'], [{ l: 'k' }, { l: 'k' }])) fail('tray checks wrong');
}

// ----- bots find only real words -----
{
  const B = BOARDS.big, cells = Array(B.N * B.N).fill(''), wild = Array(B.N * B.N).fill(0);
  for (const lang of ['pl', 'en']) for (const level of ['easy', 'normal', 'hard']) {
    const plays = findPlays(B, cells, wild, ['a', 'k', 'o', 't', 'e', 's', '?'], lang, level);
    if (!plays.length) fail(`${lang} ${level} bot found no first play`);
    for (const p of plays.slice(0, 200)) { const r = readPlay(B, cells, wild, p.tiles, lang); if (!r.ok || !r.words.every(w => has(lang, w.w)) || r.pts !== p.pts) fail('bot play wrong ' + JSON.stringify(p)); }
  }
}

// ----- challenges -----
const realNow = Date.now; let now = realNow(); Date.now = () => now;
function fresh(opts = {}) {
  const G = rf.create(players, { seats: 2, lang: 'pl', timer: 0, ...opts });
  now += rf.MS.start + 10; rf.tick(G, now); G.turn = 0; G.stage = 'play';
  return G;
}
{
  const G = fresh(), B = boardOf(G.board), m = B.mid;
  G.racks[0] = ['k', 'q', 't', 'a', 'a', 'a', 'a'].map(l => (l === 'q' ? 'o' : l)); G.racks[1] = ['x'];
  G.racks[1] = ['e', 'e', 'e', 'e', 'e', 'e', 'e'];
  const total = () => G.bag.length + G.racks.flat().length + G.cells.filter(Boolean).length;
  const before = total();
  // a made-up word: TKA
  if (rf.act(G, 0, { t: 'play', tiles: [{ i: m - 1, l: 't' }, { i: m, l: 'k' }, { i: m + 1, l: 'k' }] })) fail('a play the tray cannot make was accepted');
  if (!rf.act(G, 0, { t: 'play', tiles: [{ i: m - 1, l: 'a' }, { i: m, l: 't' }, { i: m + 1, l: 'k' }] })) fail('a made-up word should go down unchecked');
  if (G.stage !== 'chal' || G.cells[m] !== 't' || G.racks[0].length !== 4) fail('play not on the board for the challenge');
  if (rf.act(G, 0, { t: 'chal' })) fail('challenged your own play');
  const v1 = rf.view(G, 1); if (v1.seats[0].rack || !v1.pend || v1.pend.words[0].w !== 'atk') fail('challenge view wrong');
  if (!rf.act(G, 1, { t: 'chal' })) fail('challenge refused');
  if (G.cells[m] || G.racks[0].length !== 7 || G.score[0] !== 0 || G.stage !== 'told' || G.told.ok) fail('a wrong word should come back off: ' + JSON.stringify(G.told));
  if (total() !== before) fail('tiles lost in a challenge');
  now += rf.MS.told + 10; rf.tick(G, now);
  if (G.turn !== 1 || G.stage !== 'play') fail('turn should pass after a lost challenge');
  // a real word: the player keeps it and gets the bonus on top
  G.turn = 0; G.stage = 'play';
  if (!rf.act(G, 0, { t: 'play', tiles: [{ i: m - 1, l: 'k' }, { i: m, l: 'o' }, { i: m + 1, l: 't' }] })) fail('real word refused');
  const pts = G.pend.pts;
  if (!rf.act(G, 1, { t: 'chal' })) fail('challenge refused');
  if (G.score[0] !== pts + CHAL_BONUS || G.cells[m] !== 'o' || G.racks[0].length !== 7 || !G.told.ok) fail('a real word should stand with +10');
  if (total() !== before) fail('tiles lost after a play stood');
  now += rf.MS.told + 10; rf.tick(G, now);
  // nobody challenges: "looks fine" closes the window early and the play stands without the bonus
  G.turn = 0; G.stage = 'play';
  if (!rf.act(G, 0, { t: 'play', tiles: [{ i: m + 2, l: G.racks[0].includes('y') ? 'y' : G.racks[0][0], w: 0 }] }) && !rf.act(G, 0, { t: 'pass' })) fail('play or pass refused');
  if (G.stage === 'chal') {
    const s0 = G.score[0], p2 = G.pend.pts;
    if (!rf.act(G, 1, { t: 'fine' }) || rf.act(G, 1, { t: 'fine' })) fail('looks fine wrong');
    now += 400; rf.tick(G, now);
    if (G.stage !== 'play' || G.score[0] !== s0 + p2) fail('the window should close once everyone says fine');
  }
}
{ // a bot catches a made-up word (hard bots always do)
  const G = fresh({ bots: 'hard' }); G.seats[1].bot = true; G.seats[1].human = false; G.seats[1].id = null;
  const m = boardOf(G.board).mid; G.racks[0] = ['z', 'z', 'z', 'a', 'a', 'a', 'a'];
  if (!rf.act(G, 0, { t: 'play', tiles: [{ i: m, l: 'z' }, { i: m + 1, l: 'z' }, { i: m + 2, l: 'z' }] })) fail('play refused');
  if (G.pend.until - now > rf.MS.chalBots + 5) fail('with only bots to judge the window should be short');
  for (let k = 0; k < 40 && G.stage === 'chal'; k++) { now += 200; rf.tick(G, now); }
  if (G.stage !== 'told' || G.told.ok || G.told.by !== 1) fail('hard bot did not challenge ZZZ');
}

// ----- whole games -----
function play(opts, people = players) {
  const G = rf.create(people, opts), n = G.seats.length, all = bagOf(opts.lang, opts.bag).length;
  for (const s of G.seats) s.bot = true; // bots play every seat
  let steps = 0;
  while (G.ph === 'play' && steps++ < 60000) {
    now += 200; rf.tick(G, now);
    const onBoard = G.cells.filter(Boolean).length;
    if (G.bag.length + G.racks.flat().length + onBoard !== all) fail('tiles lost or copied');
    if (G.racks.some(r => r.length > RACK)) fail('tray too big');
    if (steps % 25 === 0 && G.ph === 'play') for (let s = -1; s < n; s++) {
      const v = rf.view(G, s);
      v.seats.forEach((p, j) => { if (j !== s && p.rack) fail(`seat ${s} was sent seat ${j}'s tray`); });
      if (JSON.stringify(v).includes('"bag":[')) fail('the bag leaked');
    }
  }
  if (G.ph !== 'end') fail('game did not end ' + JSON.stringify(opts));
  const r = rf.results(G);
  if (new Set(G.res.order).size !== n || r.some((x, i) => x.pts !== G.score[i]) || !r.some(x => x.place === 1)) fail('results wrong');
  for (let k = 1; k < n; k++) if (G.score[G.res.order[k - 1]] < G.score[G.res.order[k]]) fail('placing order wrong');
  return { G, secs: steps / 5 };
}
const avg = { easy: 0, hard: 0 };
for (const lang of ['pl', 'en']) for (const [board, bag] of [['small', 'short'], ['big', 'full']]) for (const bots of ['easy', 'normal', 'hard']) {
  const t = realNow(), { G, secs } = play({ lang, board, bag, bots, seats: bots === 'normal' ? 4 : 2 });
  const words = G.words.length;
  if (bots !== 'normal') avg[bots] += G.score.reduce((a, b) => a + b, 0) / G.seats.length;
  console.log(`${lang} ${board}/${bag} ${bots}: ${G.score.join(':')} in ${(secs / 60).toFixed(1)} game minutes, ${G.st.reduce((a, s) => a + s.words, 0)} words, ${(realNow() - t)} ms`);
  if (!words) fail('nobody scored');
}
if (avg.hard <= avg.easy) fail('hard bots should score more than easy ones');

{ // the turn timer passes for you, and a player who leaves is played by a bot
  const G = fresh({ timer: 60 }); G.stage = 'play'; G.tEnd = now + 60000; G.turn = 0;
  now += 60100; rf.tick(G, now);
  if (G.turn !== 1 || G.st[0].auto !== 1) fail('timer did not pass the turn');
  rf.setAway(G, 0, true); rf.setAway(G, 1, true);
  for (let i = 0; i < 40000 && G.ph === 'play'; i++) { now += 300; rf.tick(G, now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
}
Date.now = realNow;
console.log('OK rules and games');

// ----- over the real server -----
const PORT = 23080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 900));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'reef', opts: { seats: 2, timer: 60, lang: 'en', dice: 3 } });
await wait(300);
if (room?.game !== 'reef' || room.opts.seats !== 2 || room.opts.lang !== 'en' || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { board: 'big', bag: 'short', bots: 'easy', lang: 'pl' } }); await wait(200);
if (room.opts.board !== 'big' || room.opts.bots !== 'easy' || room.opts.lang !== 'pl' || room.opts.timer !== 60) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'reef' || state.seats.length !== 2 || state.seats[state.me].rack?.length !== RACK || state.cells.length !== 225) bail('game did not start');
if (state.seats[1 - state.me].rack) bail('the server sent the other tray');
let turns = 0;
for (let i = 0; i < 6000 && state.ph === 'play'; i++) {
  if (state.stage === 'chal' && state.pend && state.pend.s !== state.me && !state.pend.fine.includes(state.me)) { const mv = state.mv; send({ t: 'act', a: { t: 'fine' } }); for (let k = 0; k < 40 && state.mv === mv; k++) await wait(25); }
  else if (state.stage === 'play' && state.turn === state.me) {
    const mv = state.mv, rack = state.seats[state.me].rack;
    const plays = findPlays(boardOf(state.board), state.cells, state.wild, rack, state.lang, 'normal').sort((a, b) => b.pts - a.pts);
    send({ t: 'act', a: plays.length ? { t: 'play', tiles: plays[0].tiles } : { t: 'pass' } }); turns++;
    for (let k = 0; k < 40 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
  } else await wait(50);
}
if (state.ph !== 'end') bail('game over the server did not finish');
if (!state.seats.every(p => Array.isArray(p.rack))) bail('trays should be shown at the end');
await wait(400);
const myPlace = state.res.places[state.me];
if (!me?.gain || me.gain.coins !== (myPlace === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
console.log('OK server game:', turns, 'turns,', state.score.join(':'), '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

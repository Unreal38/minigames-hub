// Kalambury test: word lists, guessing rules, the drawing stream and whole games on a fake clock, then a short game
// between two people over the real WebSocket server (a table of one may not start, the chat hides the word).
import { spawn } from 'node:child_process';
import * as kal from '../server/games/kal.js';
import { poolOf, LANGS, WORD_THEMES } from '../server/games/kalwords.js';
import { BW, BH, COLORS, SIZES, OP, THEMES, ROUNDS, TIMES, guessPts, drawPts, norm, apart, isNear, themeName } from '../public/games/kal/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const P = (id, name) => ({ id, name, color: '#ff8fab', av: [0, 0, 0, 0] });
const three = [P('a', 'Ana'), P('b', 'Bo'), P('c', 'Cy')];

// ----- words -----
for (const lang of LANGS) {
  const all = poolOf(lang, 'all'), seen = new Map();
  if (all.length < 600) fail(`${lang}: too few words`);
  for (const t of WORD_THEMES) if (poolOf(lang, t).length < 100) fail(`${lang}: theme ${t} is thin`);
  for (const w of all) {
    if (!w.w || w.w !== w.w.trim() || w.w !== w.w.toLowerCase() || w.w.length > 26 || /[|,<>]/.test(w.w)) fail(`${lang}: odd word "${w.w}"`);
    for (const x of [w.w, ...w.alts]) { const k = norm(x); if (k.length < 2) fail(`${lang}: "${x}" has nothing to match`); if (seen.has(k) && seen.get(k) !== w) fail(`${lang}: "${x}" is in the lists twice`); seen.set(k, w); }
  }
  if (all.some(w => w.sp)) fail('pets belong to their own theme only');
}
if (THEMES.length !== WORD_THEMES.length + 2 || THEMES.some(t => !themeName(t))) fail('themes do not match the lists');
{ const pets = poolOf('pl', 'pets'); if (pets.length < 70 || pets.some(p => !p.sp || !p.w) || poolOf('en', 'pets').length !== pets.length) fail('pet words wrong'); }
if (norm('Żółw') !== 'zolw' || norm('Hot-Dog ') !== 'hotdog' || norm('łódź podwodna') !== 'lodzpodwodna' || norm('  ') !== '') fail('norm wrong');
if (apart('kot', 'kot') !== 0 || apart('kanapka', 'kanapk') !== 1 || apart('abc', 'xyz') !== 3) fail('apart wrong');
if (!isNear('kanapk', 'kanapka') || isNear('kanapka', 'kanapka') || isNear('kat', 'kot') || !isNear('hipopotan', 'hipopotam') || !isNear('hipoppotan', 'hipopotam') || isNear('pies', 'kanapka')) fail('near misses wrong');
if (guessPts(80, 80) !== 100 || guessPts(0, 80) !== 40 || guessPts(40, 80) !== 70 || guessPts(-5, 80) !== 40 || drawPts([100, 0], 2) !== 50 || drawPts([], 0) !== 0) fail('points wrong');
for (const [o, want] of [[{}, '3/80/pl/all/on'], [{ rounds: 5, time: 120, lang: 'en', theme: 'pets', hints: 'off' }, '5/120/en/pets/off'], [{ rounds: 9, time: 5, lang: 'de', theme: 'x', hints: 1, bots: 'sharp' }, '3/80/pl/all/on']]) {
  const c = kal.cleanOpts(o); if ([c.rounds, c.time, c.lang, c.theme, c.hints].join('/') !== want || Object.keys(c).length !== 5) fail('options not cleaned: ' + JSON.stringify(c));
}
if (kal.meta.minHumans !== 2 || kal.meta.maxPlayers !== 8 || !ROUNDS.includes(3) || !TIMES.includes(80)) fail('meta wrong');

// ----- one turn, step by step, on a fake clock -----
const realNow = Date.now; let now = realNow(); Date.now = () => now;
const step = (G, ms) => { for (let t = 0; t < ms; t += 100) { now += 100; kal.tick(G, now); } };
{
  const G = kal.create(three, { rounds: 2, time: 60, lang: 'pl' });
  if (G.st !== 'pick' || G.picks.length !== 3 || new Set(G.picks.map(w => w.theme)).size !== 3) fail('a turn starts with three words from three themes');
  const d = G.drawer, g1 = (d + 1) % 3, g2 = (d + 2) % 3;
  let v = kal.view(G, d);
  if (v.picks?.length !== 3 || kal.view(G, g1).picks || kal.view(G, -1).picks) fail('only the drawer sees the words to pick from');
  if (!v.seats || v.seats.length !== 3 || kal.view(G, d).seats) fail('seats are sent once, then only when they change');
  if (kal.act(G, g1, { t: 'pick', i: 0 }) || kal.act(G, d, { t: 'pick', i: 3 }) || kal.act(G, d, { t: 'd', o: [[OP.START, 0, 0, 5, 5]] }) || G.log.length) fail('nonsense accepted while picking');
  if (!kal.act(G, d, { t: 'pick', i: 1 }) || G.st !== 'draw') fail('pick refused');
  const word = G.word.w;
  // what each screen knows
  v = kal.view(G, g1);
  if (v.word || v.pet || JSON.stringify(v).includes(JSON.stringify(word)) || v.hint.length !== word.length || /[^_ -]/.test(v.hint)) fail('a guesser can read the word');
  if (kal.view(G, d).word !== word || JSON.stringify(kal.view(G, -1)).includes(JSON.stringify(word))) fail('the drawer must see the word, a watcher must not');
  // drawing: bad strokes are dropped, good ones reach each screen exactly once
  kal.act(G, d, { t: 'd', o: [[OP.MOVE, 1, 1], [OP.START, 99, 0, 5, 5], [OP.START, 0, 9, 5, 5], [OP.START, 0, 0, BW + 1, 5], [OP.START, 0, 0, 5.5, 5], [OP.FILL, 0, 5], [7], 'x', null] });
  if (G.log.length) fail('bad strokes accepted');
  if (kal.act(G, g1, { t: 'd', o: [[OP.START, 0, 0, 5, 5]] }) || G.log.length) fail('a guesser drew');
  if (kal.act(G, d, { t: 'd', o: [[OP.START, 2, 1, 10, 10], [OP.MOVE, 20, 20, 30, 30], [OP.MOVE, 20, 20, 30]] }) !== false || G.log.length !== 2 || !kal.fast(G) || kal.fast(G)) fail('strokes not taken or not streamed');
  v = kal.view(G, g1);
  if (v.d.n !== 2 || v.d.from !== 0 || v.d.ops.length !== 2 || kal.view(G, g1).d.ops.length) fail('a guesser gets each stroke once');
  if (kal.view(G, d).d.ops.length) fail('the drawer already has their own strokes');
  kal.act(G, d, { t: 'd', o: [[OP.FILL, 3, 400, 300], [OP.UNDO]] });
  v = kal.view(G, g1); if (v.d.from !== 2 || v.d.ops.length !== 2) fail('second batch wrong');
  if (kal.view(G, g2).d.ops.length !== 4) fail('another guesser gets everything so far');
  kal.act(G, g1, { t: 'sync' }); v = kal.view(G, g1);
  if (!v.d.full || v.d.from !== 0 || v.d.ops.length !== 4 || !v.seats) fail('sync should send the whole picture and the seats');
  kal.act(G, d, { t: 'sync' }); if (kal.view(G, d).d.ops.length !== 4) fail('a drawer who reloads gets the picture back');
  kal.act(G, d, { t: 'd', o: [[OP.CLEAR], [OP.START, 0, 0, 1, 1]] });
  v = kal.view(G, g1); if (v.d.from !== 4 || v.d.n !== 6 || v.d.ops[0][0] !== OP.CLEAR || G.log.length !== 2 || G.base !== 4) fail('clear should drop the old strokes');
  kal.act(G, -1, { t: 'sync' }); v = kal.view(G, -1); if (!v.d.full || v.d.from !== 4 || v.d.ops.length !== 2) fail('a watcher can ask for the picture');
  // guessing
  now += 1000;
  if (!kal.act(G, g1, { t: 'g', text: 'to nie to' }) || kal.act(G, g1, { t: 'g', text: 'za szybko' })) fail('guess rate limit wrong');
  if (kal.view(G, g2).feed.at(-1).text !== 'to nie to') fail('a wrong guess is shown to everyone');
  now += 1000; kal.act(G, g1, { t: 'g', text: '<b>hej</b>  \u202e  ' + 'x'.repeat(100) });
  { const t = G.feed.at(-1).text; if (/[<>\u202e]/.test(t) || t.length > 60) fail('guess text not cleaned'); }
  if (norm(word).length >= 4) {
    now += 1000; kal.act(G, g1, { t: 'g', text: word.slice(0, -1) });
    const e = G.feed.at(-1);
    if (e.k !== 'near' || kal.view(G, g2).feed.some(x => x.k === 'near') || kal.view(G, d).feed.some(x => x.k === 'near') || !kal.view(G, g1).feed.some(x => x.k === 'near')) fail('a near miss is told to the guesser only');
  }
  now += 20000;
  if (kal.hush(G, `to jest ${word}!`) === `to jest ${word}!` || kal.hush(G, 'nic takiego') !== 'nic takiego') fail('table chat must hide the word while it is drawn');
  kal.act(G, g1, { t: 'g', text: '  ' + word.toUpperCase().replace(/Ł/g, 'L') + ' ' });
  const pts = G.got[g1];
  if (!pts || pts !== guessPts(G.stEnd - now, 60000) || pts >= 100 || G.sc[g1] !== pts || G.feed.at(-1).k !== 'ok' || G.feed.at(-1).text) fail('a right guess scores by the time left and is not shown');
  if (JSON.stringify(kal.view(G, g2)).includes(JSON.stringify(word)) || kal.view(G, g1).word !== word || !kal.view(G, g2).got[g1]) fail('after a right guess only that guesser sees the word');
  now += 1000; kal.act(G, g1, { t: 'g', text: `psst: ${word}` });
  if (kal.view(G, g2).feed.some(e => e.in) || !kal.view(G, d).feed.some(e => e.in) || G.got[g1] !== pts) fail('people who know the word only talk to each other');
  now += 1000; kal.act(G, d, { t: 'g', text: word });
  if (kal.view(G, g2).feed.some(e => e.in) || G.got[d]) fail('the drawer cannot give the word away or score a guess');
  if (G.st !== 'draw') fail('turn ended too early');
  now += 1000; kal.act(G, g2, { t: 'g', text: word });
  if (G.st !== 'show' || G.last.why !== 'all' || G.last.w !== word || G.last.n !== 2 || G.last.of !== 2) fail('the turn ends when everyone has it');
  const dg = drawPts([G.got[g1], G.got[g2]], 2);
  if (G.sc[d] !== dg || G.last.gains[d] !== dg || G.last.gains[g1] !== pts) fail('drawer points wrong');
  if (kal.view(G, -1).last.w !== word || kal.hush(G, word) !== word) fail('the answer is public once the turn is over');
  if (kal.act(G, d, { t: 'd', o: [[OP.START, 0, 0, 1, 1]] }) || G.log.length !== 2) fail('drawing after the turn');
  step(G, kal.MS.show + 200);
  if (G.st !== 'pick' || G.drawer === d || G.log.length || G.got.some(Boolean) || kal.view(G, g1).d.n !== 0) fail('next turn did not start clean');
}
{ // nobody picks, nobody guesses: a word is picked for the drawer, letters open up, time runs out
  const G = kal.create(three, { rounds: 2, time: 60, theme: 'things' });
  const d = G.drawer; step(G, kal.MS.pick + kal.MS.hello + 200);
  if (G.st !== 'draw' || !G.word || G.word.theme !== 'things') fail('no word was picked for a sleeping drawer');
  const letters = [...G.word.w].filter(ch => /\p{L}/u.test(ch)).length, want = Math.min(4, Math.floor(letters / 3));
  if (G.open.length !== want) fail('wrong number of hint letters');
  step(G, 59000);
  const h = kal.view(G, (d + 1) % 3).hint, open = [...h].filter((ch, k) => ch !== '_' && /\p{L}/u.test(G.word.w[k])).length;
  if (open !== want || [...h].some((ch, k) => ch !== '_' && ch !== G.word.w[k])) fail('hint letters wrong: ' + h);
  step(G, 1500);
  if (G.st !== 'show' || G.last.why !== 'time' || G.sc.some(Boolean) || G.last.n !== 0) fail('time ran out wrong');
  const H = kal.create(three, { hints: 'off' }); kal.act(H, H.drawer, { t: 'pick', i: 0 }); step(H, 70000);
  if (H.open.length || /[^_ -]/.test(kal.view(H, (H.drawer + 1) % 3).hint || '_')) fail('hints off still showed letters');
}
{ // skip, away and leaving
  const G = kal.create(three, {}); let d = G.drawer;
  kal.act(G, d, { t: 'pick', i: 0 });
  if (kal.act(G, (d + 1) % 3, { t: 'skip' }) || !kal.act(G, d, { t: 'skip' }) || G.last.why !== 'skip') fail('skip wrong');
  step(G, kal.MS.show + 200); d = G.drawer; kal.act(G, d, { t: 'pick', i: 0 });
  if (!kal.setAway(G, d, true) || kal.setAway(G, d, true)) fail('setAway wrong');
  step(G, 200); if (G.st !== 'show' || G.last.why !== 'left') fail('a drawer who drops out ends the turn');
  step(G, kal.MS.show + 200);
  if (G.drawer === d || G.ph !== 'play') fail('the game goes on without the one who is away');
  const d2 = G.drawer, other = [0, 1, 2].find(s => s !== d && s !== d2);
  kal.act(G, d2, { t: 'pick', i: 0 }); kal.act(G, other, { t: 'g', text: G.word.w });
  if (G.st !== 'show' || G.last.of !== 1) fail('someone who is away does not hold the turn up');
  kal.setAway(G, d, false);
  if (!kal.view(G, d).seats) fail('a returning player gets the seats again');
  // the server marks a seat that left for good: with fewer than two people the game ends
  Object.assign(G.seats[other], { human: false, id: null, left: true }); Object.assign(G.seats[d], { human: false, id: null, left: true });
  step(G, 200);
  if (G.ph !== 'end' || !kal.results(G) || kal.results(G).length !== 3) fail('a table of one must end the game');
}
{ // a watcher joins at the next turn and gets a turn to draw
  const G = kal.create(three.slice(0, 2), { rounds: 2 });
  kal.seatWatcher(G, P('e', 'Eli'), true); kal.seatWatcher(G, P('e', 'Eli'), false); if (G.queue.length) fail('cancel wrong');
  kal.seatWatcher(G, P('e', 'Eli'), true);
  if (G.seats.length !== 2) fail('seated mid-turn');
  kal.act(G, G.drawer, { t: 'pick', i: 0 }); kal.act(G, G.drawer, { t: 'skip' }); step(G, kal.MS.show + 200);
  if (G.seats.length !== 3 || G.seats[2].id !== 'e' || G.order.length !== 3 || G.sc.length !== 3 || !kal.view(G, 0).seats) fail('the watcher was not seated at the next turn');
  let drew = 0;
  for (let i = 0; i < 40 && G.ph === 'play'; i++) { if (G.st === 'pick') { if (G.drawer === 2) drew++; kal.act(G, G.drawer, { t: 'pick', i: 0 }); } else if (G.st === 'draw') kal.act(G, G.drawer, { t: 'skip' }); else step(G, kal.MS.show + 200); }
  if (G.ph !== 'end' || drew !== 2) fail(`the new player should draw in both rounds (drew ${drew})`);
}
// ----- whole games: everyone plays, every turn happens, words never repeat -----
for (const [n, opts] of [[2, { rounds: 2, lang: 'en' }], [5, { rounds: 3, lang: 'pl', theme: 'animals' }], [8, { rounds: 2, theme: 'pets' }]]) {
  const people = Array.from({ length: n }, (_, i) => P('p' + i, 'P' + i));
  const G = kal.create(people, opts), words = [], drawers = [];
  if (kal.create([...people, P('x', 'X'), P('y', 'Y'), P('z', 'Z'), P('q', 'Q'), P('r', 'R'), P('t', 'T'), P('u', 'U')], opts).seats.length !== 8) fail('more than eight seats');
  for (let i = 0; i < 200000 && G.ph === 'play'; i++) {
    if (G.st === 'pick') { kal.act(G, G.drawer, { t: 'pick', i: i % 3 }); words.push(G.word.w); drawers.push(G.drawer); if (opts.theme === 'pets' && (!G.word.sp || kal.view(G, G.drawer).pet !== G.word.sp)) fail('a pet word carries its pet'); }
    else if (G.st === 'draw') {
      now += 2000 + Math.random() * 3000;
      const s = G.seats.findIndex((_, k) => k !== G.drawer && !G.got[k] && Math.random() < .7);
      if (s >= 0) kal.act(G, s, { t: 'g', text: G.word.w });
    }
    now += 300; kal.tick(G, now);
  }
  if (G.ph !== 'end') fail('game did not end');
  if (words.length !== n * G.opts.rounds || new Set(words).size !== words.length) fail(`wrong number of turns or a repeated word (${words.length})`);
  for (let s = 0; s < n; s++) if (drawers.filter(x => x === s).length !== G.opts.rounds) fail('everyone draws once a round');
  const r = kal.results(G), R = G.res;
  if (r.length !== n || r.some((x, i) => x.pts !== G.sc[i] || x.place !== R.place[i])) fail('results wrong');
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (r[a].pts > r[b].pts && r[a].place >= r[b].place) fail('more points must mean a better place');
  if (r.filter(x => x.win).length < 1 || r.some(x => x.win && x.place !== 1) || r.some(x => x.idle)) fail('winner or idle wrong');
  const again = kal.create(people, opts, G); if (again.used.size !== G.used.size) fail('the next game at the table should not repeat words');
  console.log(`OK ${n} players, ${words.length} turns, top score ${Math.max(...G.sc)}`);
}
{ // a table that sleeps through the whole game: no points, no winner, no coins
  const G = kal.create(three, { rounds: 2, time: 60 });
  for (let i = 0; i < 100000 && G.ph === 'play'; i++) { now += 500; kal.tick(G, now); }
  const r = kal.results(G);
  if (G.ph !== 'end' || r.some(x => x.win || x.pts || !x.idle) || G.win !== -1) fail('a sleeping table went wrong');
}
Date.now = realNow;

// ----- over the real server: two people -----
const PORT = 27990 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(700);
function person(name) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`), o = { room: null, state: null, seats: null, errs: [], chat: [], ops: [], gain: null, send: m => ws.send(JSON.stringify(m)), close: () => ws.close() };
  ws.onopen = () => o.send({ t: 'hello', name, color: '#ff8fab' });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'room') o.room = m.room; if (m.t === 'err') o.errs.push(m.msg); if (m.t === 'chat') o.chat.push(m.text); if (m.t === 'me' && m.gain) o.gain = m.gain;
    if (m.t === 'state') { o.state = m.s; if (m.s?.seats) o.seats = m.s.seats; if (m.s?.d) o.ops.push(...m.s.d.ops); }
  };
  return o;
}
const A = person('Ana'), B = person('Bo');
await wait(400);
A.send({ t: 'create', game: 'kal', opts: { rounds: 2, time: 60, lang: 'en', theme: 'food', bots: 'sharp' } }); await wait(300);
if (A.room?.game !== 'kal' || A.room.opts.lang !== 'en' || A.room.opts.theme !== 'food' || 'bots' in A.room.opts || A.room.max !== 8) bail('room options wrong');
A.send({ t: 'start' }); await wait(300);
if (A.state || !A.errs.some(e => /at least two players/.test(e))) bail('a table of one must not start');
B.send({ t: 'join', code: A.room.code }); await wait(300);
A.send({ t: 'start' }); await wait(400);
if (A.state?.game !== 'kal' || B.state?.game !== 'kal' || A.seats?.length !== 2 || A.seats.some(s => s.bot || !s.human)) bail('game did not start with two people');
const [D, G2] = A.state.drawer === A.state.me ? [A, B] : [B, A];
if (!D.state.picks || G2.state.picks) bail('picks went to the wrong screen');
D.send({ t: 'act', a: { t: 'pick', i: 0 } }); await wait(300);
const word = D.state.word;
if (!word || G2.state.word || G2.state.st !== 'draw' || G2.state.hint.length !== word.length) bail('drawing did not start');
G2.ops.length = 0;
for (let k = 0; k < 5; k++) { D.send({ t: 'act', a: { t: 'd', o: [[OP.START, k, 1, 100 + k * 20, 100], [OP.MOVE, 120 + k * 20, 200, 140 + k * 20, 300]] } }); await wait(30); }
await wait(300);
if (G2.ops.length !== 10 || G2.state.d.n !== 10 || G2.ops[0][0] !== OP.START || G2.ops[9][0] !== OP.MOVE) bail(`strokes did not arrive in order, once each (${G2.ops.length})`);
D.send({ t: 'chat', text: `it is ${word}, hurry` }); G2.send({ t: 'chat', text: 'hello there' }); await wait(300);
if (G2.chat.some(t => norm(t).includes(norm(word))) || !G2.chat.includes('hello there') || !A.chat.some(t => t.includes('•••'))) bail('table chat gave the word away');
G2.send({ t: 'act', a: { t: 'g', text: 'no idea' } }); await wait(600);
if (!D.state.feed.some(e => e.k === 'say' && e.text === 'no idea')) bail('a wrong guess did not reach the drawer');
G2.send({ t: 'act', a: { t: 'g', text: word } }); await wait(400);
if (G2.state.st !== 'show' || G2.state.last.w !== word || !(G2.state.sc[G2.state.me] > 40) || G2.state.sc[D.state.me] !== G2.state.sc[G2.state.me]) bail('the right guess did not end the turn');
// play the rest quickly: every drawer skips
for (let i = 0; i < 400 && A.state.ph === 'play'; i++) {
  const X = A.state.drawer === A.state.me ? A : B;
  if (A.state.st === 'pick') X.send({ t: 'act', a: { t: 'pick', i: 0 } }); else if (A.state.st === 'draw') X.send({ t: 'act', a: { t: 'skip' } });
  await wait(250);
}
if (A.state.ph !== 'end' || A.state.res.pts.length !== 2) bail('the game did not finish');
await wait(400);
if (!A.gain || !B.gain || !A.gain.ranked || A.gain.coins + B.gain.coins < 11 || A.room.paid?.some(v => typeof v !== 'number')) bail('coins or ranking wrong: ' + JSON.stringify([A.gain, B.gain, A.room.paid]));
A.close(); B.close(); srv.kill();
console.log('OK kalambury');

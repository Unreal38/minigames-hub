// Państwa-miasta test: checks letters, answer folding and scoring, plays whole games on a fake clock (Stop, votes,
// the Pet Farm category, people who leave), then plays a short game with two people over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as pm from '../server/games/pm.js';
import { SETS, LETTERS, PTS, MAXLEN, CATS, catName, clean, fold, firstLetter, starts, mark, needed } from '../public/games/pm/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2, 2, 2, 2] }];

// ----- rules -----
if (clean('  Nowy \u200b  Sącz\n') !== 'Nowy Sącz' || clean('x'.repeat(80)).length !== MAXLEN || clean(null) !== '') fail('clean wrong');
if (fold('Kraków') !== fold('krakow ') || fold('Łódź') !== 'lodz' || fold('Nowy-Sącz') !== fold('nowy sacz') || fold('St. Louis') !== 'stlouis' || fold('Żaba') === fold('Zebra')) fail('fold wrong');
if (firstLetter('żaba') !== 'Ż' || firstLetter(' łódź') !== 'Ł' || firstLetter('Évry') !== 'E' || firstLetter('ósemka') !== 'Ó' || firstLetter('123') !== '' || firstLetter('"Zebra"') !== 'Z') fail('first letter wrong');
if (!starts('zebra', 'Z') || starts('Żaba', 'Z') || starts('Lodz', 'Ł') || !starts('Łódź', 'Ł') || starts('', 'A') || !starts('śliwka', 'Ś')) fail('starts wrong');
if (LETTERS.easy.length !== 22 || new Set(LETTERS.pl).size !== 25 || LETTERS.easy.some(l => 'QVXY'.includes(l)) || !LETTERS.easy.every(l => LETTERS.pl.includes(l))) fail('letters wrong');
if (SETS.short.length !== 4 || SETS.classic.length !== 6 || SETS.long.length !== 8 || Object.values(SETS).flat().some(c => !CATS[c] || !catName(c))) fail('category sets wrong');
if ([1, 2, 3, 4, 5, 6, 7].map(needed).join() !== '1,2,2,3,3,4,4') fail('votes needed wrong');
{
  const base = { cats: ['country', 'city', 'pet'], letter: 'P', open: [true, true, true], here: [true, true, true], petOk: w => fold(w) === 'puddlepup' };
  let m = mark({ ...base, ans: [['Polska', 'Paryż', 'Puddlepup'], ['polska ', 'Praga', 'Pies'], ['', 'Zebra', 'puddlepup']], votes: [{}, {}, {}] });
  const row = c => m.map(r => r[c].st + r[c].pts).join();
  if (row(0) !== 'dup5,dup5,empty0') fail('same word / empty: ' + row(0));
  if (row(1) !== 'uniq10,uniq10,letter0') fail('unique / wrong letter: ' + row(1));
  if (row(2) !== 'dup5,nopet0,dup5') fail('pets: ' + row(2));
  // one thumb of two possible voters is not enough; both throw a word out, and then the other good word is the only one
  m = mark({ ...base, ans: [['Polska', 'Paryż', ''], ['Peru', 'Praga', ''], ['', '', '']], votes: [{}, { [fold('Praga')]: [2] }, {}] });
  if (row(1) !== 'uniq10,uniq10,empty0' || m[1][1].no !== 1 || m[1][1].need !== 2) fail('one thumb of two: ' + row(1));
  m = mark({ ...base, ans: [['Polska', 'Paryż', ''], ['Peru', 'Praga', ''], ['', '', '']], votes: [{}, { [fold('Praga')]: [2, 0] }, {}] });
  if (row(1) !== 'solo15,out0,empty0' || m[1][1].no !== 2) fail('vote out: ' + row(1));
  // your own thumb on your own word, a thumb from someone who wrote the same, and a thumb from someone away do not count
  m = mark({ ...base, ans: [['Polska', '', ''], ['Polska', '', ''], ['Peru', '', '']], votes: [{ polska: [0, 1] }, {}, {}] });
  if (row(0) !== 'dup5,dup5,uniq10') fail('own votes counted: ' + row(0));
  m = mark({ ...base, here: [true, true, false], ans: [['Polska', '', ''], ['Peru', '', ''], ['', '', '']], votes: [{ polska: [2] }, {}, {}] });
  if (row(0) !== 'uniq10,uniq10,empty0' || m[0][0].need !== 1) fail('an away vote counted: ' + row(0));
  // with four at the table it takes two of the three others
  m = mark({ cats: ['city'], letter: 'P', open: [true], here: [true, true, true, true], petOk: () => false, ans: [['Pxx'], ['Praga'], ['Paryż'], ['Piła']], votes: [{ pxx: [1] }] });
  if (m[0][0].st !== 'uniq' || m[0][0].need !== 2) fail('one of three is not enough');
  m = mark({ cats: ['city'], letter: 'P', open: [true], here: [true, true, true, true], petOk: () => false, ans: [['Pxx'], ['Praga'], ['Paryż'], ['Piła']], votes: [{ pxx: [1, 3] }] });
  if (m[0][0].st !== 'out' || m.slice(1).some(r => r[0].st !== 'uniq')) fail('two of three should throw it out');
  // a closed category gives nothing to anyone
  m = mark({ ...base, open: [true, true, false], ans: [['Polska', '', 'Puddlepup'], ['', '', ''], ['', '', '']], votes: [{}, {}, {}] });
  if (m[0][2].st !== 'closed' || m[0][2].pts !== 0 || m[0][0].st !== 'solo') fail('closed category wrong');
}
if (PTS.solo !== 15 || PTS.uniq !== 10 || PTS.dup !== 5) fail('points changed: update the rules texts too');
for (const [o, want] of [[{}, '5/90/classic/easy/off'], [{ rounds: 8, time: 60, cats: 'long', letters: 'pl', pet: 'on' }, '8/60/long/pl/on'], [{ rounds: 4, time: 5, cats: 'x', letters: 1, pet: 1, timer: 5 }, '5/90/classic/easy/off']]) {
  const c = pm.cleanOpts(o); if ([c.rounds, c.time, c.cats, c.letters, c.pet].join('/') !== want || Object.keys(c).length !== 5) fail('options not cleaned: ' + JSON.stringify(c));
}
if (pm.meta.minHumans !== 2 || pm.meta.maxPlayers !== 8) fail('meta wrong');

// ----- whole games on a fake clock -----
// each(G, now): what the people do this step
function play(opts, each, people = players) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = pm.create(people, opts);
    if (G.seats.length !== people.length || G.seats.some(s => s.bot)) fail('this game has no bots');
    for (let i = 0; i < 200000 && G.ph === 'play'; i++) { now += 100; each?.(G, now); pm.tick(G, now); }
    if (G.ph !== 'end') fail('game did not end');
    return G;
  } finally { Date.now = realNow; }
}
const WORDS = l => ['Aa', 'Bb', 'Cc'].map(x => l + x.toLowerCase());
{ // nobody writes: the clock ends every round, nobody scores, everyone is idle
  const seen = [];
  const G = play({ rounds: 3, time: 60 }, G => { if (G.stage === 'write' && !seen.includes(G.letter)) seen.push(G.letter); if (G.stage === 'check') fail('nothing to check in an empty round'); });
  if (seen.length !== 3 || new Set(seen).size !== 3 || G.hist.length !== 3 || G.tot.some(Boolean)) fail('empty game wrong');
  const r = pm.results(G); if (!r.every(x => x.idle && x.place === 1 && x.win)) fail('sleepers are idle and share the place');
}
{ // a full game: Ana fills everything and calls Stop, Bo copies half of her words, Cy writes one wrong word that gets voted out
  let stops = 0, rounds = 0, done = '';
  const G = play({ rounds: 5, time: 120, cats: 'short' }, (G, now) => {
    const key = G.round + G.stage;
    if (G.stage === 'draw' && pm.view(G, 0).letter !== '') fail('the letter shows before it is drawn');
    if (G.stage === 'write' && done !== key) {
      done = key; rounds++;
      const w = WORDS(G.letter);
      if (pm.view(G, 1).ans || pm.view(G, 1).marks) fail('answers show during the round');
      if (pm.act(G, 0, { t: 'stop', a: [w[0], w[0], w[0], ''] }) && G.stage !== 'write') fail('Stop with an empty box worked');
      if (!pm.act(G, 1, { t: 'ans', a: [w[0].toUpperCase(), w[1], '', ''] })) fail('answers refused');
      if (!pm.act(G, 2, { t: 'ans', a: ['Zzz' + G.round, 'x'.repeat(60), 5, null] })) fail('answers refused');
      if (JSON.stringify(pm.view(G, 0).mine) !== JSON.stringify([w[0], w[0], w[0], '']) || pm.view(G, 0).fill.join() !== '3,2,2') fail('own sheet or fill wrong: ' + JSON.stringify(pm.view(G, 0).fill));
      if (!pm.act(G, 0, { t: 'stop', a: [w[0], w[0], w[0], w[0]] }) || G.stage !== 'stop' || G.stopBy !== 0) fail('Stop did not work');
      if (G.tEnd - now > pm.MS.stop) fail('Stop leaves more than five seconds');
      stops++;
    }
    if (G.stage === 'stop' && done !== key) { done = key; if (pm.act(G, 1, { t: 'stop', a: [] }) && G.stopBy !== 0) fail('a second Stop took over'); pm.act(G, 1, { t: 'ans', a: [WORDS(G.letter)[0], WORDS(G.letter)[1], WORDS(G.letter)[2], ''] }); }
    if (G.stage === 'check' && done !== key) {
      done = key;
      const v = pm.view(G, 2), w = WORDS(G.letter);
      if (!v.ans || !v.marks || v.ans[0][0] !== w[0]) fail('answers hidden at the check');
      // Ana and Bo: same country (5 each), cities differ (10 each), animals differ (10 each), name: only Ana (15)
      if (v.marks[0].map(m => m.pts).join() !== '5,10,10,15' || v.marks[1].map(m => m.pts).join() !== '5,10,10,0') fail('live marks wrong: ' + JSON.stringify(v.marks[0]));
      const cyOk = starts('Zzz' + G.round, G.letter);
      if (v.marks[2][0].st !== (cyOk ? 'uniq' : 'letter') || v.marks[2][1].st !== 'letter') fail('Cy: ' + JSON.stringify(v.marks[2]));
      if (pm.act(G, 0, { t: 'vote', c: 0, s: 0 }) || pm.act(G, 1, { t: 'vote', c: 0, s: 0 })) fail('voted on your own word');
      if (pm.act(G, 0, { t: 'vote', c: 3, s: 1 }) || pm.act(G, 0, { t: 'vote', c: 9, s: 1 }) || pm.act(G, 0, { t: 'vote', c: 1, s: 2 })) fail('voted on an empty box or a wrong letter');
      // Ana and Cy both thumb down Bo's animal: it takes both of the two others
      if (!pm.act(G, 0, { t: 'vote', c: 2, s: 1 }) || pm.view(G, 0).marks[1][2].st !== 'uniq') fail('one of two voters should not be enough');
      if (!pm.act(G, 2, { t: 'vote', c: 2, s: 1 }) || pm.view(G, 0).marks[1][2].st !== 'out' || pm.view(G, 0).marks[0][2].st !== 'solo') fail('two of two voters should throw it out');
      if (!pm.act(G, 0, { t: 'vote', c: 2, s: 1, on: false }) || pm.view(G, 0).marks[1][2].st !== 'uniq') fail('taking a thumb back');
      if (pm.act(G, 0, { t: 'vote', c: 2, s: 1, on: false }) || !pm.act(G, 0, { t: 'vote', c: 2, s: 1 })) fail('thumb toggling');
      if (!pm.act(G, 0, { t: 'ready', on: true }) || !pm.act(G, 1, { t: 'ready', on: true })) fail('ready refused');
      if (G.stage !== 'check') fail('the check ended before everyone was ready');
      pm.act(G, 2, { t: 'ready', on: true });
    }
    if (G.stage === 'score' && done !== key) {
      done = key;
      if (G.last[0] !== 5 + 10 + 15 + 15 || G.last[1] !== 5 + 10) fail('round points wrong: ' + G.last);
      if (pm.act(G, 0, { t: 'vote', c: 2, s: 1 }) || pm.act(G, 0, { t: 'ans', a: ['x'] })) fail('acted after the check');
    }
  });
  if (stops !== 5 || rounds !== 5 || G.hist.length !== 5 || new Set(G.used).size !== 5) fail('rounds wrong');
  const r = pm.results(G);
  if (G.tot[0] !== 225 || G.tot[1] !== 75 || r[0].place !== 1 || !r[0].win || r[1].place !== 2 || r[2].place !== 3 || r.some(x => x.idle)) fail('final table wrong: ' + G.tot);
  if (G.res.order.join() !== '0,1,2' || G.win !== 0) fail('order wrong');
}
{ // the Pet Farm category: checked by the game, closed when no pet starts with the letter
  let open = 0, closed = 0, done = '';
  const G = play({ rounds: 8, time: 60, cats: 'short', pet: 'on', letters: 'pl' }, (G) => {
    const key = G.round + G.stage; if (done === key) return; done = key;
    if (G.stage === 'write') {
      if (G.cats[4] !== 'pet') fail('no pet category');
      const hasPet = 'ABCDFGJKLMNOPRSTWZ'.includes(G.letter);
      if (G.open[4] !== hasPet) fail(`pet box for ${G.letter} should be ${hasPet ? 'open' : 'closed'}`);
      G.open[4] ? open++ : closed++;
      pm.act(G, 0, { t: 'ans', a: ['', '', '', '', G.letter + 'not a pet'] });
      pm.act(G, 1, { t: 'ans', a: ['', '', '', '', { M: 'mossbun', C: 'CINDERCUB', P: 'Puddle pup', A: 'Axolily', B: 'bambear', S: 'Siamew', Z: 'zapkit' }[G.letter] || ''] });
    }
    if (G.stage === 'check') { if (pm.act(G, 0, { t: 'vote', c: 4, s: 1 })) fail('a pet name cannot be voted out'); if (pm.view(G, 0).marks[1][4].st !== 'solo') fail('a real pet should be the only good answer'); if (pm.view(G, 0).marks[0][4].st !== 'nopet') fail('a made-up pet passed'); }
  }, players.slice(0, 2));
  if (open + closed !== 8) fail('pet rounds wrong');
  if (G.tot[0] !== 0 || G.tot[1] % 15) fail('pet points wrong');
}
{ // someone drops out for a while: no vote, the others carry on; the last one left ends the game
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = pm.create(players, { rounds: 3 });
  if (!pm.setAway(G, 2, true) || pm.setAway(G, 2, true)) fail('setAway wrong');
  const step = until => { for (let i = 0; i < 5000 && !until(); i++) { now += 100; pm.tick(G, now); } if (!until()) fail('stuck in ' + G.stage); };
  step(() => G.stage === 'write');
  const w = WORDS(G.letter);
  pm.act(G, 0, { t: 'stop', a: Array(6).fill(w[0]) }); pm.act(G, 1, { t: 'ans', a: [w[1]] });
  step(() => G.stage === 'check');
  if (pm.act(G, 2, { t: 'vote', c: 0, s: 0 }) || pm.act(G, 2, { t: 'ready', on: true })) fail('an away seat voted');
  pm.act(G, 0, { t: 'ready', on: true }); pm.act(G, 1, { t: 'ready', on: true });
  step(() => G.stage === 'score');
  if (G.last[0] !== 10 + 5 * 15 || G.last[1] !== 10 || G.last[2] !== 0) fail('points with someone away: ' + G.last);
  if (!pm.setAway(G, 2, false)) fail('could not come back');
  // two people leave for good (the server marks their seats): the game ends as it stands
  G.seats[1].human = false; G.seats[2].human = false;
  step(() => G.ph === 'end');
  const r = pm.results(G);
  if (r[0].place !== 1 || !r[0].win || r[0].idle) fail('early end wrong');
  if (G.hist.length !== 1) fail('early end should keep the finished round only');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 28080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(600);
function person(name) {
  const p = { room: null, s: null, gain: null, errs: [] };
  p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  p.send = msg => p.ws.send(JSON.stringify(msg));
  p.ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
  p.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') p.room = m.room; if (m.t === 'state') p.s = m.s; if (m.t === 'me' && m.gain) p.gain = m.gain; if (m.t === 'err') p.errs.push(m.msg); };
  return p;
}
const ana = person('Ana'), bo = person('Bo');
await wait(400);
ana.send({ t: 'create', game: 'pm', opts: { rounds: 3, time: 60, cats: 'short', timer: 10 } });
await wait(300);
if (ana.room?.game !== 'pm' || ana.room.opts.rounds !== 3 || ana.room.opts.cats !== 'short' || 'timer' in ana.room.opts || ana.room.max !== 8) bail('room options wrong');
ana.send({ t: 'start' }); await wait(300);
if (ana.s || !ana.errs.some(e => /at least two players/.test(e))) bail('the game started with one player');
bo.send({ t: 'join', code: ana.room.code }); await wait(300);
ana.send({ t: 'start' }); await wait(300);
if (ana.s?.game !== 'pm' || ana.s.seats.length !== 2 || ana.s.seats.some(x => x.bot) || ana.s.stage !== 'draw' || ana.s.letter !== '') bail('game did not start');
const until = async (f, ms = 20000) => { for (let t = 0; t < ms; t += 50) { if (f()) return; await wait(50); } bail('timed out waiting in stage ' + ana.s?.stage); };
for (let r = 0; r < 3; r++) {
  await until(() => ana.s.round === r && ana.s.stage === 'write');
  const l = ana.s.letter, w = WORDS(l);
  if (JSON.stringify(bo.s).includes(w[0])) bail('leak');
  bo.send({ t: 'act', a: { t: 'ans', a: [w[0], w[1], '', ''] } });
  ana.send({ t: 'act', a: { t: 'stop', a: [w[0], w[0], w[0], w[0]] } });
  await until(() => ana.s.stage === 'stop' || ana.s.stage === 'grace');
  if (bo.s.ans || JSON.stringify(bo.s).includes('"' + w[0] + '","' + w[0] + '","' + w[0])) bail("the view leaks another player's answers during the round");
  await until(() => ana.s.stage === 'check', 9000);
  if (bo.s.ans?.[0]?.[3] !== w[0] || bo.s.marks?.[0]?.[3]?.st !== 'solo') bail('answers did not show at the check');
  bo.send({ t: 'act', a: { t: 'vote', c: 2, s: 0 } }); // with two players, the other one decides
  ana.send({ t: 'act', a: { t: 'ready', on: true } }); bo.send({ t: 'act', a: { t: 'ready', on: true } });
  await until(() => ana.s.stage === 'score' || ana.s.ph === 'end');
  if (ana.s.last?.join() !== '30,15') bail('round points wrong: ' + ana.s.last);
}
await until(() => ana.s.ph === 'end', 12000);
await wait(500);
if (ana.s.res.tot.join() !== '90,45' || ana.s.res.place.join() !== '1,2') bail('final table wrong');
if (!ana.gain || !bo.gain || ana.room.paid?.join() !== `${ana.gain.coins},${bo.gain.coins}` || ana.gain.coins <= bo.gain.coins) bail('coins were not paid by place: ' + JSON.stringify(ana.room.paid));
console.log(`server game: letters ${ana.s.res.hist.map(h => h.l).join(' ')}, +${ana.gain.coins} and +${bo.gain.coins} coins`);
srv.kill();
console.log('pm test passed');
process.exit(0);

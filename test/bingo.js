// Sky Bingo test: checks cards, lines and prizes, plays whole games on a fake clock (bots only, a person who daubs
// by hand, automatic daubing, a person who sleeps), then plays a quick game over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as bingo from '../server/games/bingo.js';
import { BALLS, MID, ALL, LINES, GAMES, PTS, SPEED, newCard, has, toGo, goalCells, doneLines, count, letterOf, colOf } from '../public/games/bingo/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const bit = (...cs) => cs.reduce((m, c) => m | 1 << c, 0);

// ----- rules -----
if (LINES.length !== 12 || LINES.some(l => count(l) !== 5) || LINES.filter(l => l & 1 << MID).length !== 4) fail('wrong lines');
for (let k = 0; k < 200; k++) {
  const c = newCard();
  if (c.length !== 25 || c[MID] !== 0) fail('card shape wrong');
  const nums = c.filter(Boolean);
  if (new Set(nums).size !== 24) fail('a number is on the card twice');
  c.forEach((n, i) => { if (i !== MID && colOf(n) !== i % 5) fail(`number ${n} in the wrong column`); });
}
if (letterOf(1) !== 'B' || letterOf(15) !== 'B' || letterOf(16) !== 'I' || letterOf(45) !== 'N' || letterOf(60) !== 'G' || letterOf(75) !== 'O') fail('letters wrong');
{
  const free = 1 << MID;
  if (has('line', free) || toGo('line', free) !== 4 || toGo('two', free) !== 8 || toGo('full', free) !== 24) fail('an empty card is wrong');
  const row = bit(10, 11, 13, 14) | free;
  if (!has('line', row) || has('two', row) || toGo('line', row) !== 0 || toGo('two', row) !== 4 || goalCells('line', row) !== row) fail('middle row not seen');
  const cross = row | bit(2, 7, 17, 22);
  if (!has('two', cross) || has('full', cross) || doneLines(cross).length !== 2 || toGo('full', cross) !== 16) fail('two lines not seen');
  if (has('line', bit(0, 1, 2, 3)) || !has('line', bit(0, 6, 18, 24) | free) || !has('line', bit(4, 8, 16, 20) | free) || !has('line', bit(0, 5, 10, 15, 20))) fail('diagonals or columns wrong');
  if (!has('full', ALL) || toGo('full', ALL) !== 0 || has('full', ALL & ~1)) fail('full card wrong');
}
for (const [o, want] of [[{}, '4/classic/normal/hand/chill'], [{ seats: 8, game: 'quick', speed: 'fast', daub: 'auto', bots: 'sharp' }, '8/quick/fast/auto/sharp'], [{ seats: 9, game: 'x', speed: 'warp', daub: 1, bots: 2, timer: 5 }, '4/classic/normal/hand/chill']]) {
  const c = bingo.cleanOpts(o); if ([c.seats, c.game, c.speed, c.daub, c.bots].join('/') !== want || Object.keys(c).length !== 5) fail('options not cleaned: ' + JSON.stringify(c));
}

// ----- whole games on a fake clock -----
// human(G, s, now): what the person in seat s does this step (nothing by default)
function play(opts, human, people = players) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = bingo.create(people, opts);
    if (G.seats.length !== Math.max(G.opts.seats, people.length)) fail('seats wrong');
    if (bingo.view(G, 0).card !== G.cards[0] || bingo.view(G, -1).card !== null) fail('a view shows the wrong card');
    let balls = 0, lastCall = 0;
    for (let i = 0; i < 200000 && G.ph === 'play'; i++) {
      now += 100;
      if (G.called.length !== balls) {
        if (G.called.length !== balls + 1) fail('two balls at once');
        if (balls && G.stage === 'play' && now - lastCall < Math.min(G.gap, 900) - 150) fail('balls came too fast');
        balls = G.called.length; lastCall = now;
        if (new Set(G.called).size !== balls) fail('a ball was called twice');
      }
      G.seats.forEach((_, s) => { // nobody ever has a daub on a number that was not called
        for (let c = 0; c < 25; c++) if (c !== MID && G.mask[s] & 1 << c && !G.is[G.cards[s][c]]) fail('daub on an uncalled number');
      });
      if (human) human(G, 0, now);
      bingo.tick(G, now);
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = bingo.results(G), R = G.res;
    if (R.wins.length > G.goals.length) fail('more prizes than goals');
    R.wins.forEach((w, k) => { if (w.g !== G.goals[k]) fail('prizes out of order'); });
    if (G.pts.reduce((a, b) => a + b, 0) !== R.wins.reduce((a, w) => a + PTS[w.g], 0)) fail('points do not add up');
    if (!r.some(x => x.win) || r.some((x, i) => x.win !== (R.place[i] === 1))) fail('winner wrong');
    for (let a = 0; a < r.length; a++) for (let b = 0; b < r.length; b++) if (r[a].pts > r[b].pts && r[a].place >= r[b].place) fail('more points must mean a better place');
    return G;
  } finally { Date.now = realNow; }
}
// bots only
let lineBalls = 0, fullBalls = 0; const N = 30;
for (let k = 0; k < N; k++) {
  const q = play({ seats: 4, game: 'quick' }, null, []); lineBalls += q.res.balls;
  if (q.res.wins.length !== 1 || q.res.wins[0].g !== 'line') fail('a quick game is one line');
  const c = play({ seats: 4, game: 'classic', bots: 'sharp' }, null, []); fullBalls += c.res.balls;
  if (c.res.wins.length !== 3) fail('bots should take all three prizes');
  if (c.res.balls < 24) fail('a full card needs at least 24 balls');
}
console.log(`bots: first line after ${(lineBalls / N).toFixed(1)} balls on average, full card after ${(fullBalls / N).toFixed(1)}`);
if (lineBalls / N < 8 || lineBalls / N > 40) fail('the first line comes at an odd time');
{ // a quick person against slow bots: daubs at once and shouts at once, so wins far more than a fair share
  let wins = 0;
  const quick = (G, s) => {
    if (bingo.act(G, s, { t: 'daub', c: MID }) || bingo.act(G, s, { t: 'daub', c: 99 }) || bingo.act(G, s, { t: 'daub' }) || bingo.act(G, s, { t: 'dance' }) || bingo.act(G, s, null) || bingo.act(G, -1, { t: 'bingo' })) fail('nonsense accepted');
    const not = G.cards[s].findIndex((n, c) => n && !G.is[n]); if (not >= 0 && bingo.act(G, s, { t: 'daub', c: not })) fail('daubed a number that was not called');
    G.cards[s].forEach((n, c) => { if (n && G.is[n] && !(G.mask[s] & 1 << c)) { if (!bingo.act(G, s, { t: 'daub', c })) fail('daub refused'); if (bingo.act(G, s, { t: 'daub', c })) fail('daubed twice'); } });
    const ready = (G.stage === 'play' || G.stage === 'last') && has(G.goals[G.gi], G.mask[s]);
    if (bingo.act(G, s, { t: 'bingo' }) !== ready) fail(ready ? 'a real bingo was refused' : 'a false bingo was accepted');
  };
  for (let k = 0; k < 40; k++) { const G = play({ seats: 4, game: 'quick' }, quick, players.slice(0, 1)); if (G.res.wins[0].s === 0) wins++; if (bingo.results(G)[0].idle) fail('an active player is not idle'); }
  console.log(`a quick player took ${wins}/40 quick games from three chill bots`);
  if (wins < 2) fail('a quick player should win about a quarter of the games');
}
{ // automatic daubing: the card fills by itself but you still have to shout
  const G = play({ seats: 2, game: 'quick', daub: 'auto' }, null);
  if (G.res.wins.length) fail('nobody shouted, so nobody should have a prize');
  if (G.res.balls !== BALLS || G.mask[0] !== ALL || G.mask[1] !== ALL) fail('automatic daubing should fill both cards');
  if (bingo.results(G).some(r => r.idle)) fail('with automatic daubing nobody is idle');
  const H = play({ seats: 2, game: 'classic', daub: 'auto' }, (G, s) => bingo.act(G, s, { t: 'bingo' }));
  if (H.res.wins.length !== 3 || H.res.wins.some(w => w.s !== 0) || H.pts[0] !== 70 || H.res.place.join() !== '1,2') fail('the only one who shouts takes every prize');
}
{ // people who sleep: every ball comes out, then the game ends by itself and pays them nothing
  const G = play({ seats: 2, game: 'classic', speed: 'fast' }, null);
  if (G.res.balls !== BALLS || G.res.wins.length || G.mask[0] !== 1 << MID) fail('a sleeping table went wrong');
  const r = bingo.results(G); if (!r.every(x => x.idle) || r[0].place !== 1 || r[1].place !== 1) fail('sleepers are idle and share the place');
}
{ // a player who leaves is played by a bot, and gets the seat back
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = bingo.create(players, { seats: 2, game: 'quick' });
  if (!bingo.setAway(G, 0, true) || bingo.setAway(G, 0, true) || !bingo.setAway(G, 1, true)) fail('setAway wrong');
  if (bingo.act(G, 0, { t: 'bingo' })) fail('an away seat cannot act');
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { now += 100; bingo.tick(G, now); }
  if (G.ph !== 'end' || G.res.wins.length !== 1) fail('bots did not finish for players who left');
  Date.now = realNow;
}
if (SPEED.fast >= SPEED.normal || SPEED.normal >= SPEED.chill || GAMES.classic.length !== 3) fail('speeds or goals wrong');

// ----- over the real server -----
const PORT = 27080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'bingo', opts: { seats: 3, game: 'quick', speed: 'fast', timer: 10 } });
await wait(300);
if (room?.game !== 'bingo' || room.opts.seats !== 3 || room.opts.game !== 'quick' || 'timer' in room.opts || room.max !== 8) bail('room options wrong');
send({ t: 'opts', opts: { bots: 'sharp' } }); await wait(200);
if (room.opts.bots !== 'sharp' || room.opts.speed !== 'fast') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'bingo' || state.seats.length !== 3 || state.card?.length !== 25 || !state.seats[1].bot || state.goal !== 'line') bail('game did not start');
if (JSON.stringify(state).includes('"cards"') || JSON.stringify(state).includes('"bag"')) bail('the view leaks other cards or the bag');
let daubs = 0;
for (let i = 0; i < 4000 && state.ph === 'play'; i++) {
  const mask = state.masks[state.me], c = state.card.findIndex((n, k) => n && state.called.includes(n) && !(mask & 1 << k));
  if (c >= 0) { send({ t: 'act', a: { t: 'daub', c } }); daubs++; for (let k = 0; k < 40 && state.masks[state.me] === mask && state.ph === 'play'; k++) await wait(25); }
  else if (has('line', mask) && (state.stage === 'play' || state.stage === 'last')) { send({ t: 'act', a: { t: 'bingo' } }); await wait(120); }
  else await wait(50);
}
if (state.ph !== 'end' || !state.res) bail('the game did not finish');
if (state.res.wins.length !== 1 || state.res.pts.reduce((a, b) => a + b, 0) !== 10) bail('prize wrong at the end');
await wait(400);
if (!me?.gain || !room.paid || typeof room.paid[state.me] !== 'number' || room.paid[1] !== 'b') bail('coins were not paid by place');
if (daubs && me.gain.coins < 1) bail('a player who daubed should earn coins');
console.log(`server game: ${daubs} daubs, ${state.res.balls} balls, place ${state.res.place[state.me]}, +${me.gain.coins} coins`);
srv.kill();
console.log('bingo test passed');
process.exit(0);

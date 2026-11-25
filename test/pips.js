// Pip Party test: checks the scoring of every box (with the examples from the ruleset), jokers and bonuses, plays
// whole games on a fake clock, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as pp from '../server/games/pips.js';
import { BOXES, plain, score, joker, genBonus, worth, total, bonusOf, upperSum, blankSheet, blankCols, open, openCount } from '../public/games/pips/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- scoring -----
const eq = (box, dice, want) => { const got = plain(box, dice); if (got !== want) fail(`${box} of ${dice} should be ${want}, got ${got}`); };
eq('4', [4, 3, 4, 4, 1], 12); eq('3', [4, 3, 4, 4, 1], 3); eq('6', [4, 3, 4, 4, 1], 0);
eq('k3', [6, 5, 2, 5, 5], 23); eq('k3', [6, 5, 2, 5, 4], 0); eq('k4', [5, 5, 2, 5, 5], 22); eq('k4', [6, 5, 2, 5, 5], 0); eq('k3', [3, 3, 3, 3, 3], 15); eq('k4', [3, 3, 3, 3, 3], 15);
eq('full', [4, 2, 4, 4, 2], 25); eq('full', [4, 4, 4, 4, 2], 0); eq('full', [4, 4, 4, 4, 4], 0); eq('full', [1, 2, 4, 4, 2], 0);
eq('ss', [2, 3, 4, 5, 2], 30); eq('ss', [6, 1, 2, 3, 4], 30); eq('ss', [3, 4, 5, 6, 6], 30); eq('ss', [1, 2, 3, 5, 6], 0); eq('ss', [1, 2, 3, 4, 5], 30);
eq('ls', [1, 2, 3, 4, 5], 40); eq('ls', [6, 2, 3, 4, 5], 40); eq('ls', [1, 2, 3, 4, 6], 0);
eq('gen', [2, 2, 2, 2, 2], 50); eq('gen', [2, 2, 2, 2, 1], 0); eq('ch', [6, 5, 2, 5, 5], 23);
{ // jokers: only once the Pip Party box and the matching top box are both filled
  const sh = blankSheet(), c = [sh], d = [4, 4, 4, 4, 4];
  if (joker(d, c) || score('full', d, c) !== 0) fail('joker before the party box is filled');
  sh.gen = 50; if (joker(d, c) || genBonus(d, c) !== 100 || worth('4', d, c) !== 120 || worth('ch', d, c) !== 120 || worth('full', d, c) !== 100) fail('a second five of a kind pays 100 in any empty box');
  if (genBonus(d, c, 0, true) !== 100 || genBonus([4, 4, 4, 4, 3], c)) fail('bonus rule wrong');
  sh[4] = 12; if (!joker(d, c)) fail('joker not recognised');
  if (score('full', d, c) !== 25 || score('ss', d, c) !== 30 || score('ls', d, c) !== 40 || score('k3', d, c) !== 20 || score('k4', d, c) !== 20 || score('ch', d, c) !== 20) fail('joker scores wrong');
  if (score('1', d, c) !== 0 || score('5', d, c) !== 0) fail('a joker in the top half scores 0');
  if (genBonus(d, c) !== 100) fail('no 100 bonus for a joker');
  sh.gen = 0; if (genBonus(d, c) !== 0 || score('full', d, c) !== 25) fail('a zeroed party box still makes jokers but pays no bonus');
  if (joker([4, 4, 4, 4, 3], c)) fail('four of a kind is no joker');
}
{ // totals and the top-half bonus
  const sh = blankSheet(); Object.assign(sh, { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 18 });
  if (upperSum(sh) !== 63 || bonusOf(sh) !== 35 || total([sh]) !== 98) fail('63 should pay the 35 bonus');
  sh[1] = 2; if (bonusOf(sh) !== 0 || total([sh]) !== 62) fail('62 should not pay the bonus');
  sh.ch = 20; if (total([sh], 100) !== 182) fail('total wrong');
}
{ // the triple sheet: columns count once, twice and three times; jokers need all three columns
  const c = blankCols(3), d = [2, 2, 2, 2, 2];
  Object.assign(c[2], { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 18 }); c[1].ch = 20; c[0].ch = 7;
  if (total(c) !== 7 + 40 + 98 * 3) fail('triple totals wrong');
  if (worth('ch', [1, 2, 3, 4, 6], c, 2) !== 0 + 16 * 3 || worth('ls', [1, 2, 3, 4, 5], c, 1) !== 80) fail('column multiplier wrong');
  c[0].gen = c[1].gen = 50; c[0][2] = c[1][2] = 4;
  if (joker(d, c) || genBonus(d, c, 2)) fail('joker or bonus with a party box still open');
  c[2].gen = 50; if (!joker(d, c) || genBonus(d, c, 0) !== 100 || genBonus(d, c, 2) !== 300 || genBonus(d, c, 2, true) !== 0) fail('triple joker bonus wrong');
  if (worth('full', d, c, 1) !== 50 + 200) fail('triple joker worth wrong');
  c[1].gen = 0; if (genBonus(d, c, 2) !== 0) fail('bonus needs all three party boxes at 50');
}

// ----- whole games -----
function play(opts, human, who = players) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = pp.create(who, opts), n = G.seats.length;
    if (n !== Math.max(opts.seats || 3, Math.min(4, who.length))) fail('seats not filled with bots');
    let turns = 0;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 100;
      const s = G.turn, seat = G.seats[s];
      if (G.stage === 'turn' && seat.human && !seat.bot && !G.auto && now >= G.rollAt + pp.MS.roll) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && (pp.act(G, other, { t: 'roll' }) || pp.act(G, other, { t: 'pick', box: 'ch' }))) fail('acted out of turn');
        if (pp.act(G, s, { t: 'dance' }) || pp.act(G, s, { t: 'pick', box: 'nope' }) || pp.act(G, s, { t: 'pick', box: 'constructor' }) || pp.act(G, s, { t: 'hold', k: 9, on: true }) || pp.act(G, s, { t: 'hold', k: 1.5, on: true })) fail('nonsense accepted');
        if (!G.rolls && (pp.act(G, s, { t: 'pick', box: 'ch' }) || pp.act(G, s, { t: 'hold', k: 0, on: true }))) fail('picked or held before rolling');
        if (G.rolls === 3 && (pp.act(G, s, { t: 'roll' }) || pp.act(G, s, { t: 'hold', k: 0, on: !G.held[0] }))) fail('a fourth roll or a hold after the last roll');
        const done = BOXES.find(b => G.sheets[s][0][b] != null);
        if (G.rolls && done && pp.act(G, s, { t: 'pick', box: done })) fail('a box was used twice');
        if (G.rolls && (pp.act(G, s, { t: 'pick', box: 'ch', col: G.cols }) || pp.act(G, s, { t: 'pick', box: 'ch', col: -1 }) || pp.act(G, s, { t: 'pick', box: 'ch', col: .5 }))) fail('a column that does not exist');
        const before = JSON.stringify(G.sheets[s]), rollN = G.rollN, held = G.held.join();
        human(G, s, now);
        if (JSON.stringify(G.sheets[s]) === before && G.rollN === rollN && G.held.join() === held) fail('human move refused');
        if (G.stage === 'pick') turns++;
      } else { const st = G.stage; pp.tick(G, now); if (st === 'turn' && G.stage === 'pick') turns++; }
      if (G.dice.some(v => !(v >= 1 && v <= 6)) || (G.rolls && G.dice.length !== 5)) fail('bad dice');
    }
    if (G.ph !== 'end') fail('game did not end');
    if (turns !== 13 * n * G.cols) fail(`expected ${13 * n * G.cols} turns, got ${turns}`);
    G.sheets.forEach((c, i) => { if (openCount(c)) fail('a sheet is not full'); if (G.res.totals[i] !== total(c, G.extra[i])) fail('total wrong'); });
    if (G.sheets[0].length !== (opts.sheet === 'triple' ? 3 : 1)) fail('wrong number of columns');
    const r = pp.results(G), top = Math.max(...G.res.totals);
    if (!r[G.win].win || r[G.win].pts !== top || r.some(x => x.win !== (x.pts === top))) fail('results disagree');
    return G;
  } finally { Date.now = realNow; }
}
const bestBox = (cols, dice) => cols.flatMap((c, col) => open(c).map(box => ({ box, col }))).sort((x, y) => worth(y.box, dice, cols, y.col) - worth(x.box, dice, cols, x.col))[0];
// a human who rolls three times keeping nothing, then takes the best box
const greedy = (G, s) => {
  if (G.rolls < 3) { if (!pp.act(G, s, { t: 'roll' })) fail('roll refused'); return; }
  const o = bestBox(G.sheets[s], G.dice), want = score(o.box, G.dice, G.sheets[s]);
  if (!pp.act(G, s, { t: 'pick', ...o })) fail('pick refused'); if (G.sheets[s][o.col][o.box] !== want) fail('wrote the wrong score');
};
// a human who keeps the most common face
const keeper = (G, s) => {
  if (!G.rolls) return void pp.act(G, s, { t: 'roll' });
  if (G.rolls < 3) {
    const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of G.dice) c[v]++; const f = c.indexOf(Math.max(...c));
    const k = G.dice.findIndex((v, i) => (v === f) !== G.held[i]);
    if (k >= 0) { if (!pp.act(G, s, { t: 'hold', k, on: !G.held[k] })) fail('hold refused'); return; }
    if (G.held.every(Boolean)) { if (pp.act(G, s, { t: 'roll' })) fail('rolled with every die kept'); }
    else { const kept = G.dice.filter((_, i) => G.held[i]).join(); if (!pp.act(G, s, { t: 'roll' })) fail('roll refused'); if (G.dice.filter((_, i) => G.held[i]).join() !== kept) fail('a kept die was rerolled'); return; }
  }
  if (!pp.act(G, s, { t: 'pick', ...bestBox(G.sheets[s], G.dice) })) fail('pick refused');
};
for (const seats of [2, 3, 4]) { const G = play({ seats, timer: 0 }, greedy); console.log(`${seats} seats: ${G.seats[G.win].name} wins with ${G.res.totals[G.win]} (${G.res.totals.join(', ')})`); }
play({ seats: 2, bots: 'sharp', timer: 0 }, keeper); play({ seats: 3, timer: 0 }, keeper);
{ const G = play({ seats: 2, sheet: 'triple', bots: 'sharp', timer: 0 }, greedy, [players[0]]); console.log(`triple sheet: ${G.res.totals.join(', ')} after ${G.round} rounds`); if (G.round !== 39) fail('the triple game is 39 rounds'); }
play({ seats: 3, sheet: 'triple', timer: 0 }, keeper);
if (play({ seats: 2, timer: 0 }, keeper, [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3] }]).seats.length !== 4) fail('four people need four seats');

{ // bots: sharp ones score more than chill ones, both sensibly
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const N = 60; let chill = 0, sharp = 0, t0 = performance.now();
  for (let g = 0; g < N; g++) {
    const G = pp.create([], { seats: 2 }); now += 5000; pp.tick(G, now);
    while (G.ph === 'play') { now += 2000; if (G.stage === 'turn') pp._bot(G, G.turn, now, G.turn ? 'sharp' : 'chill'); else pp.tick(G, now); }
    chill += G.res.totals[0]; sharp += G.res.totals[1];
  }
  Date.now = realNow;
  console.log(`bots: chill ${(chill / N).toFixed(0)}, sharp ${(sharp / N).toFixed(0)} points a game, ${((performance.now() - t0) / N).toFixed(0)} ms a game`);
  if (sharp / N < 200 || chill / N < 150 || sharp <= chill) fail('bot strength is off');
  let tri = 0; now = realNow(); Date.now = () => now;
  for (let g = 0; g < 10; g++) { const G = pp.create([], { seats: 2, sheet: 'triple', bots: 'sharp' }); now += 5000; pp.tick(G, now); while (G.ph === 'play') { now += 2000; if (G.stage === 'turn') pp._bot(G, G.turn, now); else pp.tick(G, now); } tri += (G.res.totals[0] + G.res.totals[1]) / 2; }
  Date.now = realNow;
  console.log(`triple sheet: sharp bots score ${(tri / 10).toFixed(0)} a game`);
  if (tri / 10 < 1200) fail('bots play the triple sheet badly');
}
{ // the turn timer finishes the turn, and a player who leaves is played by a bot
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = pp.create(players, { seats: 2, timer: 30 });
  now += 2000; pp.tick(G, now);
  if (G.stage !== 'turn' || !G.tEnd) fail('turn did not start or timer not set');
  const s = G.turn; pp.act(G, s, { t: 'roll' });
  now += 30100; pp.tick(G, now); if (!G.auto) fail('timer did not take over');
  if (pp.act(G, s, { t: 'roll' })) fail('acted while the bot finishes the turn');
  for (let i = 0; i < 200 && G.turn === s; i++) { now += 200; pp.tick(G, now); }
  if (openCount(G.sheets[s]) !== 12) fail('timer did not fill a box');
  pp.setAway(G, 0, true); pp.setAway(G, 1, true);
  for (let i = 0; i < 40000 && G.ph === 'play'; i++) { now += 300; pp.tick(G, now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 23080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', PIPS_FAST: 12, DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null, stateAt = 0;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') { state = msg.s; stateAt = Date.now(); } if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'pips', opts: { seats: 4, timer: 30, dice: 3, sheet: 'triple' } });
await wait(300);
if (room?.game !== 'pips' || room.opts.seats !== 4 || room.opts.sheet !== 'triple' || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, bots: 'sharp', sheet: 'single' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.bots !== 'sharp' || room.opts.sheet !== 'single' || room.opts.timer !== 30) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'pips' || state.seats.length !== 2 || state.rounds !== 13) bail('game did not start');
// one roll, then the best box: quick, and the game always ends
let turns = 0, key = '';
for (let i = 0; i < 3000 && state.ph === 'play'; i++) {
  if (state.stage === 'turn' && state.turn === state.me) {
    const k = state.round + '/' + state.rolls;
    if (!state.rolls) { if (k !== key) { key = k; send({ t: 'act', a: { t: 'roll' } }); } }
    else if (state.rollAgo + Date.now() - stateAt >= state.ms.roll + 30 && k !== key) {
      key = k; send({ t: 'act', a: { t: 'pick', ...bestBox(state.seats[state.me].cols, state.dice) } }); turns++;
    }
  }
  await wait(25);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
const won = state.res.totals[state.me] >= state.res.totals[1 - state.me];
if (!me?.gain || me.gain.coins !== (won ? 10 : 1)) bail('coins are not paid by place: ' + JSON.stringify(me?.gain));
if (!room.board?.length || !room.paid) bail('table scoreboard or coins column empty');
console.log('OK server game:', turns, 'turns,', state.res.totals.join(' : '), '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

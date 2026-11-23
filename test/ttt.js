// Tic-Tac-Toe test: checks the rules of all three boards, plays whole matches on a fake clock, makes sure the sharp
// bot never loses on the classic board, then plays a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as ttt from '../server/games/ttt.js';
import { MODES, lines, winLine, place, full, empty, fadeNext, FADE_CAP } from '../public/games/ttt/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- rules -----
if (lines(3, 3).length !== 8 || lines(5, 4).length !== 28) fail('wrong number of lines');
{
  let b = empty(3), o = [[], []];
  const put = (s, c, mode = 'classic') => { const r = place(b, o, s, c, mode); if (!r) fail(`move ${c} refused`); b = r.board; o = r.order; return r; };
  put(0, 0); put(1, 4); put(0, 1);
  if (place(b, o, 1, 0, 'classic') || place(b, o, 1, 9, 'classic') || place(b, o, 1, -1, 'classic') || place(b, o, 1, 1.5, 'classic') || place(b, o, 1, '2', 'classic')) fail('bad square accepted');
  if (winLine(b, 3, 3)) fail('line seen too early');
  put(1, 8); put(0, 2);
  const w = winLine(b, 3, 3); if (!w || w.s !== 0 || w.cells.join() !== '0,1,2') fail('top row not seen');
  if (full(b) || !full([0, 1, 0, 1, 0, 1, 1, 0, 1])) fail('full board check wrong');
  const d = [0, 1, 0, 0, 1, 1, 1, 0, 0]; if (winLine(d, 3, 3)) fail('a drawn board has no line');
  if (!winLine([-1, -1, 1, -1, 1, -1, 1, -1, -1], 3, 3)) fail('diagonal not seen');
}
{ // vanishing: the fourth mark wipes the oldest, and you cannot play the square that is about to vanish
  let b = empty(3), o = [[], []];
  for (const [s, c] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 8], [1, 7]]) { const r = place(b, o, s, c, 'fade'); b = r.board; o = r.order; }
  if (fadeNext(o, 0, 3) !== 0 || fadeNext([[1], []], 0, 3) !== -1 || fadeNext(o, 0, 0) !== -1) fail('wrong mark marked to vanish');
  if (place(b, o, 0, 0, 'fade')) fail('played onto own vanishing mark');
  const r = place(b, o, 0, 2, 'fade');
  if (!r || r.gone !== 0 || r.board[0] !== -1 || r.board[2] !== 0 || r.order[0].join() !== '1,8,2' || r.board.filter(x => x === 0).length !== 3) fail('oldest mark did not vanish');
  if (winLine(r.board, 3, 3)) fail('a line through a vanished mark must not count');
}
{ // big board: four in a row, three is not enough
  const b = empty(5); b[6] = b[12] = b[18] = 1;
  if (winLine(b, 5, 4)) fail('three is not a line on the big board');
  b[24] = 1; if (winLine(b, 5, 4)?.cells.join() !== '6,12,18,24') fail('diagonal of four not seen');
}
for (const [o, want] of [[{}, 'classic/3/chill/20'], [{ mode: 'fade', to: 1, bots: 'sharp', timer: 0 }, 'fade/1/sharp/0'], [{ mode: 'x', to: 9, bots: 1, timer: 7, seats: 6 }, 'classic/3/chill/20']]) {
  const c = ttt.cleanOpts(o); if ([c.mode, c.to, c.bots, c.timer].join('/') !== want || Object.keys(c).length !== 4) fail('options not cleaned: ' + JSON.stringify(c));
}

// ----- whole matches on a fake clock -----
function play(opts, human, people = players) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = ttt.create(people, opts), M = MODES[G.opts.mode];
    if (G.seats.length !== 2 || G.board.length !== M.n * M.n) fail('seats or board wrong');
    let starter = G.starter, round = 1;
    for (let i = 0; i < 100000 && G.ph === 'play'; i++) {
      now += 100;
      const cnt = [0, 1].map(s => G.board.filter(x => x === s).length);
      if (cnt[0] !== G.order[0].length || cnt[1] !== G.order[1].length) fail('marks and their order disagree');
      if (M.keep && Math.max(...cnt) > M.keep) fail('more marks than a player may keep');
      if (G.stage === 'play' && Math.abs(G.st[0].placed - G.st[1].placed) > G.round) fail('someone moved twice in a row');
      if (G.round !== round) { round = G.round; if (G.starter === starter) fail('the starter did not swap'); starter = G.starter; if (G.board.some(x => x >= 0)) fail('board not cleared'); }
      const v = ttt.view(G, 0); if (v.board !== G.board && JSON.stringify(v.board) !== JSON.stringify(G.board)) fail('view board wrong');
      const s = G.turn;
      if (G.stage === 'play' && s >= 0 && G.seats[s].human && !G.seats[s].bot && human) {
        if (ttt.act(G, 1 - s, { t: 'place', c: G.board.indexOf(-1) })) fail('acted out of turn');
        if (ttt.act(G, s, { t: 'place', c: 99 }) || ttt.act(G, s, { t: 'place' }) || ttt.act(G, s, { t: 'dance', c: 0 }) || ttt.act(G, s, null)) fail('nonsense accepted');
        const taken = G.board.findIndex(x => x >= 0); if (taken >= 0 && ttt.act(G, s, { t: 'place', c: taken })) fail('played on a taken square');
        const mv = G.mv; human(G, s, now);
        if (G.mv === mv) fail('human move refused');
      } else ttt.tick(G, now);
    }
    if (G.ph !== 'end') fail('match did not end');
    const r = ttt.results(G);
    if (G.round > G.opts.to * 2 + 3) fail('too many rounds');
    if (G.win >= 0 && (G.wins[G.win] <= G.wins[1 - G.win] || !r[G.win].win || r[1 - G.win].win)) fail('winner wrong');
    if (G.win < 0 && (G.wins[0] !== G.wins[1] || r.some(x => x.win))) fail('a drawn match has no winner');
    if (G.wins[0] + G.wins[1] + G.draws !== G.round) fail('rounds do not add up');
    if (r[0].pts !== G.wins[0] * 10) fail('points wrong');
    return G;
  } finally { Date.now = realNow; }
}
const viaBot = level => (G, s, now) => ttt._bot(G, s, now, level);
for (const mode of ['classic', 'fade', 'big']) for (const to of [1, 2, 3]) {
  const G = play({ mode, to, timer: 0 }, viaBot('chill'));
  console.log(`${mode}, first to ${to}: ${G.wins.join(' : ')} with ${G.draws} draws in ${G.round} rounds`);
}
play({ mode: 'classic', bots: 'sharp' }, null, []); play({ mode: 'big', bots: 'sharp' }, null, [players[0]]);

{ // the sharp bot never loses a classic round, whoever starts and whatever the other side plays
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let lost = 0, chillWins = 0; const N = 150;
  for (let g = 0; g < N; g++) {
    const G = ttt.create([], { mode: 'classic', to: 1 });
    while (G.ph === 'play') { now += 5000; if (G.stage === 'round') ttt.tick(G, now); else if (G.turn === 0) { // seat 0 plays at random, or like the chill bot
      if (g % 2) ttt._bot(G, 0, now, 'chill'); else { const free = G.board.map((x, i) => (x < 0 ? i : -1)).filter(i => i >= 0); G.seats[0].bot = false; G.seats[0].human = true; ttt.act(G, 0, { t: 'place', c: free[Math.random() * free.length | 0] }); }
    } else ttt._bot(G, 1, now, 'sharp'); }
    if (G.wins[0]) lost++;
  }
  if (lost) fail(`the sharp bot lost ${lost} classic rounds`);
  // and the chill bot is beatable: sharp against chill wins most matches on every board
  for (const mode of ['classic', 'fade', 'big']) {
    let sharp = 0;
    for (let g = 0; g < 60; g++) { const G = ttt.create([], { mode, to: 2 }); while (G.ph === 'play') { now += 5000; if (G.stage === 'round') ttt.tick(G, now); else ttt._bot(G, G.turn, now, G.turn ? 'sharp' : 'chill'); } if (G.win === 1) sharp++; else if (G.win === 0) chillWins++; }
    if (sharp < 40) fail(`sharp only beat chill ${sharp}/60 on ${mode}`);
  }
  console.log(`bots: sharp lost 0/${N} classic rounds, chill took ${chillWins}/180 matches off sharp`);
  Date.now = realNow;
}
{ // vanishing rounds cannot go on for ever
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = ttt.create(players, { mode: 'fade', to: 1, timer: 0 }); now += 2000;
  // both sides shuffle marks round without ever making a line
  const safe = s => { for (let c = 0; c < 9; c++) { const r = place(G.board, G.order, s, c, 'fade'); if (r && !winLine(r.board, 3, 3)) return c; } return G.board.indexOf(-1); };
  let guard = 0;
  while (G.ph === 'play' && G.round === 1 && guard++ < 500) { if (G.stage !== 'play') break; ttt.act(G, G.turn, { t: 'place', c: safe(G.turn) }); }
  if (G.round === 1 && G.stage === 'play') fail('a vanishing round ran past its cap');
  if (G.marks > FADE_CAP) fail('cap overshot');
  Date.now = realNow;
}
{ // the turn timer plays for you (and a match played only by the timer pays no coins), and leavers are played by bots
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = ttt.create(players, { timer: 10, to: 1 });
  now += 1000; ttt.tick(G, now);
  if (!G.tEnd) fail('timer not set');
  const mv = G.mv; now += 10100; ttt.tick(G, now);
  if (G.mv !== mv + 1) fail('timer did not play the turn');
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { now += 500; ttt.tick(G, now); }
  if (G.ph !== 'end') fail('the timer did not finish the match');
  if (!ttt.results(G).every(r => r.idle)) fail('a match played only by the timer should count as idle');
  const H = ttt.create(players, { timer: 0 }); ttt.setAway(H, 0, true); ttt.setAway(H, 1, true);
  for (let i = 0; i < 20000 && H.ph === 'play'; i++) { now += 500; ttt.tick(H, now); }
  if (H.ph !== 'end') fail('bots did not finish for players who left');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 26080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'ttt', opts: { mode: 'fade', to: 2, timer: 10, seats: 6 } });
await wait(300);
if (room?.game !== 'ttt' || room.opts.mode !== 'fade' || room.opts.to !== 2 || 'seats' in room.opts || room.max !== 2) bail('room options wrong');
send({ t: 'opts', opts: { mode: 'classic', bots: 'chill' } }); await wait(200);
if (room.opts.mode !== 'classic' || room.opts.to !== 2 || room.opts.timer !== 10) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'ttt' || state.seats.length !== 2 || state.board.length !== 9 || !state.seats[1 - state.me].bot) bail('game did not start');
// play like someone who knows the game: win, else block, else middle, corner, anything
const pick = st => {
  const free = st.board.map((x, i) => (x < 0 ? i : -1)).filter(i => i >= 0);
  for (const who of [st.me, 1 - st.me]) for (const c of free) { const b = st.board.slice(); b[c] = who; if (winLine(b, 3, 3)) return c; }
  return [4, 0, 2, 6, 8, ...free].find(c => free.includes(c));
};
let turns = 0;
for (let i = 0; i < 3000 && state.ph === 'play'; i++) {
  if (state.stage === 'play' && state.turn === state.me) {
    const mv = state.mv; send({ t: 'act', a: { t: 'place', c: pick(state) } }); turns++;
    for (let k = 0; k < 40 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
  } else await wait(50);
}
if (state.ph !== 'end') bail('match over the server did not finish');
await wait(300);
const won = state.win === state.me, tie = state.win < 0;
if (!me?.gain || me.gain.coins !== (won || tie ? 10 : 1)) bail('wrong coins paid at the end: ' + JSON.stringify(me?.gain));
if (me.gain.ranked) bail('a match against a bot must not count for the rankings');
if (!room.board?.length || room.paid?.[1 - state.me] !== 'b') bail('table scoreboard or coins column wrong');
console.log('OK server match:', turns, 'turns,', state.wins.join(' : '), won ? 'won' : tie ? 'drawn' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

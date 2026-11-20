// Ludo test: checks the board, plays whole games on a fake clock, checks the rules, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as ludo from '../server/games/ludo.js';
import { RING_CELLS, RING, HOME, LAST, turned, cellOf, ringIndex, safeIndex, cornersFor } from '../public/games/ludo/board.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#ff8fab', av: [1, 1, 1, 1] }];

// board: 52 different ring cells, each one step from the next, and every corner is corner 0 turned
{
  if (RING_CELLS.length !== RING || new Set(RING_CELLS.map(String)).size !== RING) fail('ring cells');
  RING_CELLS.forEach((c, i) => { const d = RING_CELLS[(i + 1) % RING]; if (Math.max(Math.abs(c[0] - d[0]), Math.abs(c[1] - d[1])) !== 1) fail('ring gap at ' + i); });
  for (let k = 0; k < 4; k++) for (let p = 0; p <= LAST; p++) if (String(cellOf(k, p)) !== String(turned(cellOf(0, p), k))) fail('corner ' + k + ' is not corner 0 turned');
  const seen = new Set(RING_CELLS.map(String));
  for (let k = 0; k < 4; k++) for (let p = LAST + 1; p < HOME; p++) { const c = String(cellOf(k, p)); if (seen.has(c)) fail('home lane overlaps'); seen.add(c); }
  if (String(cornersFor(2)) !== '0,2' || cornersFor(3).length !== 3) fail('corners');
}

function play(opts, humansPlay = true) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const G = ludo.create(players, opts), n = opts.seats || 4, T = opts.pawns || 4;
    if (G.seats.length !== n || G.toks.some(t => t.length !== T)) fail('seats or pawns wrong');
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (G.seats[i].col === G.seats[j].col) fail('two corners share a colour');
    const other = (G.turn + 1) % n;
    if (G.seats[other].human && ludo.act(G, other, { t: 'roll' })) fail('rolled out of turn');
    let moves = 0;
    for (let i = 0; i < 2_000_000 && G.ph === 'play'; i++) {
      now += 100;
      const s = G.turn, me = G.seats[s].human && !G.seats[s].bot && humansPlay;
      const before = JSON.stringify(G.toks), mN = G.moveN;
      if (me && G.stage === 'roll') { if (!ludo.act(G, s, { t: 'roll' })) fail('roll refused'); if (ludo.act(G, s, { t: 'roll' })) fail('rolled twice'); }
      else if (me && G.stage === 'pick') {
        if (G.legal.length < 2) fail('asked to pick with one choice');
        if (ludo.act(G, s, { t: 'pick', k: 99 })) fail('picked a pawn that does not exist');
        const m = G.legal[Math.random() * G.legal.length | 0];
        if (!ludo.act(G, s, { t: 'pick', k: m.k })) fail('pick refused');
      } else ludo.tick(G, now);
      if (G.moveN !== mN) {
        moves++;
        const m = G.move, was = JSON.parse(before);
        if (m.to > HOME || m.to !== (m.from < 0 ? 0 : m.from + m.die) || (m.from < 0 && m.die !== 6)) fail('bad move ' + JSON.stringify(m));
        if (was[m.s][m.k] !== m.from || G.toks[m.s][m.k] !== m.to) fail('pawn not where the move says');
        for (const c of m.caps) {
          if (G.toks[c.s][c.k] !== -1 || c.s === m.s) fail('capture did not send the pawn back');
          if (safeIndex(ringIndex(G.seats[c.s].corner, c.from))) fail('captured on a safe cell');
          if (was[c.s].filter(p => p === c.from).length !== 1) fail('captured a block');
        }
        // nobody else moved
        was.forEach((t, si) => t.forEach((p, k) => { if (!(si === m.s && k === m.k) && !m.caps.some(c => c.s === si && c.k === k) && G.toks[si][k] !== p) fail('a pawn moved on its own'); }));
      }
      if (G.toks.flat().some(p => p < -1 || p > HOME)) fail('pawn left the board');
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = ludo.results(G);
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win) fail('bad final order');
    if (G.round <= 400 && !G.toks[G.win].every(p => p === HOME)) fail('winner does not have every pawn home');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || r[G.win].pts !== n * 10) fail('results disagree');
    JSON.stringify(ludo.view(G, -1));
    return { G, moves };
  } finally { Date.now = realNow; }
}

for (const o of [{}, { seats: 2, pawns: 2, head: 'off' }, { seats: 3, pawns: 4, head: 'off', timer: 10 }, { seats: 4, pawns: 2 }]) {
  const { G, moves } = play(o);
  console.log(`${JSON.stringify(o)}: winner ${G.seats[G.win].name} after ${G.res.rounds} rounds, ${moves} moves`);
}
play({ seats: 4, timer: 10 }, false); // nobody touches anything: the turn timer plays for the humans

// rules, one at a time
{
  const now = Date.now(), fresh = o => { const G = ludo.create(players, { seats: 2, head: 'off', ...o }); G.turn = 0; G.stage = 'roll'; return G; };
  const end = G => ludo.tick(G, G.stageEnd + 1);
  // a six brings a pawn out and earns another roll
  let G = fresh(); ludo._roll(G, 0, now, 6); end(G);
  if (G.stage !== 'move' || G.toks[0].filter(p => p === 0).length !== 1) fail('a six should bring one pawn out without asking');
  end(G); if (G.turn !== 0 || G.stage !== 'roll') fail('a six should give another roll');
  // nothing on the board: three tries, then the turn passes
  G = fresh();
  for (let i = 0; i < 3; i++) { if (G.turn !== 0) fail('lost the turn before the third try'); ludo._roll(G, 0, now, 3); end(G); }
  if (G.turn !== 1) fail('turn should pass after three tries');
  // three sixes in a row: the third one is not played
  G = fresh(); G.toks[0] = [10, -1, -1, -1];
  ludo._roll(G, 0, now, 6); end(G); ludo.act(G, 0, { t: 'pick', k: 0 }); end(G);
  ludo._roll(G, 0, now, 6); end(G); ludo.act(G, 0, { t: 'pick', k: 0 }); end(G);
  const at = String(G.toks[0]); ludo._roll(G, 0, now, 6); end(G);
  if (String(G.toks[0]) !== at || G.turn !== 1) fail('third six should end the turn');
  // capture: seat 1 (corner 2) pawn at its place 30 is ring cell (26 + 30) % 52 = 4; seat 0 lands there from 1 with a 3
  G = fresh(); G.toks[0] = [1, -1, -1, -1]; G.toks[1] = [30, -1, -1, -1];
  ludo._roll(G, 0, now, 3); end(G);
  if (G.toks[1][0] !== -1 || G.toks[0][0] !== 4 || G.move.caps.length !== 1) fail('capture failed');
  end(G); if (G.turn !== 0) fail('a capture should give another roll');
  // two together are a block, and star cells are safe
  G = fresh(); G.toks[0] = [1, -1, -1, -1]; G.toks[1] = [30, 30, -1, -1];
  ludo._roll(G, 0, now, 3); end(G); if (G.toks[1][0] !== 30 || G.move.caps.length) fail('captured a block');
  G = fresh(); G.toks[0] = [5, -1, -1, -1]; G.toks[1] = [34, -1, -1, -1]; // ring cell 8 is a star
  ludo._roll(G, 0, now, 3); end(G); if (G.toks[1][0] !== 34) fail('captured on a star');
  // exact roll to get home
  G = fresh(); G.toks[0] = [54, 56, 56, 56];
  ludo._roll(G, 0, now, 5); end(G); if (G.toks[0][0] !== 54 || G.turn !== 1) fail('overshooting home should not move');
  G = fresh(); G.toks[0] = [54, 56, 56, 56];
  ludo._roll(G, 0, now, 2); end(G); end(G); if (G.ph !== 'end' || G.win !== 0) fail('getting the last pawn home should win');
  // a choice of pawns asks the player
  G = fresh(); G.toks[0] = [3, 9, -1, -1];
  ludo._roll(G, 0, now, 2); end(G);
  if (G.stage !== 'pick' || ludo.view(G, 0).legal.length !== 2) fail('should ask which pawn to move');
  if (!ludo.act(G, 0, { t: 'pick', k: 1 }) || G.toks[0][1] !== 11) fail('pick did not move the chosen pawn');
}

// hard mode: one pawn per cell
{
  const now = Date.now(), fresh = () => { const G = ludo.create(players, { seats: 2, head: 'off', hard: 'on' }); G.turn = 0; G.stage = 'roll'; return G; };
  const end = G => ludo.tick(G, G.stageEnd + 1);
  let G = fresh(); G.toks[0] = [3, 5, -1, -1];
  if (ludo.legalMoves(G, 0, 2).some(m => m.k === 0)) fail('hard: moved onto your own pawn');
  if (!ludo.legalMoves(G, 0, 2).some(m => m.k === 1)) fail('hard: the free pawn should still move');
  G = fresh(); G.toks[0] = [0, -1, -1, -1];
  if (ludo.legalMoves(G, 0, 6).some(m => m.from < 0)) fail('hard: left the yard onto your own pawn');
  G = fresh(); G.toks[0] = [5, -1, -1, -1]; G.toks[1] = [34, -1, -1, -1]; // rival on the star at ring cell 8
  if (ludo.legalMoves(G, 0, 3).length) fail('hard: moved onto a rival on a star');
  G = fresh(); G.toks[0] = [-1, -1, -1, -1]; G.toks[1] = [26, -1, -1, -1]; // rival standing on seat 0's start cell
  ludo._roll(G, 0, now, 6); end(G);
  if (G.toks[0].filter(p => p === 0).length !== 1 || G.toks[1][0] !== -1) fail('hard: leaving the yard should capture on the start cell');
  G = fresh(); G.toks[0] = [1, -1, -1, -1]; G.toks[1] = [30, -1, -1, -1];
  ludo._roll(G, 0, now, 3); end(G);
  if (G.toks[1][0] !== -1) fail('hard: plain capture failed');
}
// whole hard games: never two pawns on one cell
for (let g = 0; g < 6; g++) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = ludo.create(players, { seats: g % 2 ? 4 : 3, pawns: g % 3 ? 4 : 2, hard: 'on', timer: 10 });
    for (let i = 0; i < 2_000_000 && G.ph === 'play'; i++) {
      now += 100; ludo.tick(G, now);
      const seen = new Set();
      G.seats.forEach((s, si) => G.toks[si].forEach(p => { if (p < 0 || p === HOME) return; const key = p <= LAST ? 'r' + ringIndex(s.corner, p) : 'l' + si + p; if (seen.has(key)) fail('hard: two pawns on one cell'); seen.add(key); }));
    }
    if (G.ph !== 'end') fail('hard game did not end');
    if (g === 0) console.log('hard: winner', G.seats[G.win].name, 'after', G.res.rounds, 'rounds');
  } finally { Date.now = realNow; }
}

// a watcher takes over a bot's corner when the round of turns comes back to the first player, and keeps its colour
{
  const G = ludo.create(players, { seats: 4, timer: 10 }), eli = { id: 'e', name: 'Eli', color: '#9aa8ff', av: [2, 2, 2, 2] };
  let now = Date.now(); const r0 = G.round, cols = G.seats.map(s => s.col);
  ludo.seatWatcher(G, eli, true);
  if (G.seats.some(s => s.id === 'e')) fail('seated mid-round');
  for (let i = 0; i < 20000 && G.ph === 'play' && G.round === r0; i++) { now += 250; ludo.tick(G, now); }
  const s = G.seats.findIndex(x => x.id === 'e');
  if (G.ph === 'play' && (s < 0 || !G.seats[s].human || G.seats[s].bot || G.seats[s].col !== cols[s])) fail('watcher not seated at the next round');
  ludo.seatWatcher(G, { ...eli, id: 'f' }, true); ludo.seatWatcher(G, { id: 'f' }, false);
  if (G.queue.length) fail('cancelling a seat request');
  if (!ludo.setAway(G, 0, true) || !G.seats[0].bot || !ludo.setAway(G, 0, false)) fail('away and back');
}

// over the wire
const PORT = 19080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = m => { srv.kill(); fail(m); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null;
const send = m => ws.send(JSON.stringify(m));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') room = m.room; if (m.t === 'state') state = m.s; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'ludo', opts: { seats: 3, pawns: 2, timer: 10, bots: 'sharp' } });
await wait(300);
if (room?.game !== 'ludo' || room.opts.seats !== 3 || room.opts.pawns !== 2 || 'bots' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.pawns !== 2) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'ludo' || state.seats.length !== 2 || state.seats[0].toks.length !== 2) bail('game did not start');
for (let i = 0; i < 40 && !(state.stage === 'roll' && state.turn === state.me); i++) await wait(500);
if (state.turn !== state.me) bail('never got a turn');
send({ t: 'act', a: { t: 'roll' } }); await wait(300);
if (state.stage !== 'die' || state.roll.s !== state.me) bail('roll did not happen');
console.log('OK');
srv.kill(); process.exit(0);

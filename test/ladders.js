// Snakes & Ladders test: plays whole games on a fake clock, checks the rules, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as sl from '../server/games/ladders.js';
import { makeBoard, cell, jumpAt } from '../public/games/ladders/board.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// boards: endpoints on their own tiles, ladders go up, snakes go down, nothing on the first or last tile
for (let i = 0; i < 300; i++) {
  const B = makeBoard(i * 7919 + 1, i % 2 ? 100 : 60, true), seen = new Set();
  for (const l of B.ladders) if (l.to <= l.from || cell(l.to).row <= cell(l.from).row) fail('ladder goes down');
  for (const s of B.snakes) if (s.to >= s.from) fail('snake goes up');
  for (const n of [...B.ladders, ...B.snakes].flatMap(x => [x.from, x.to]).concat(B.specials.map(s => s.at))) {
    if (n <= 1 || n >= B.size || seen.has(n)) fail('bad board tile ' + n); seen.add(n);
  }
}

function play(opts) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const G = sl.create(players, opts);
    if (G.seats.length !== (opts.seats || 4)) fail('seats not filled with bots');
    const other = (G.turn + 1) % G.seats.length;
    if (G.seats[other].human && sl.act(G, other, { t: 'roll' })) fail('rolled out of turn');
    for (let i = 0; i < 200000 && G.ph === 'play'; i++) {
      now += 120;
      if (G.stage === 'roll' && G.seats[G.turn].human && !G.seats[G.turn].bot) {
        const from = G.pos[G.turn];
        if (!sl.act(G, G.turn, { t: 'roll' })) fail('roll refused');
        if (sl.act(G, G.move.s, { t: 'roll' })) fail('rolled twice');
        const m = G.move, last = m.segs.filter(g => g.t === 'walk')[0]?.tiles.at(-1);
        if (m.die < 1 || m.die > 6 || m.from !== from) fail('bad move');
        if (last && jumpAt(G.board, last) && !m.segs.some(g => g.t === 'ladder' || g.t === 'snake')) fail('missed a ladder or snake');
      } else sl.tick(G, now);
      if (G.pos.some(p => p < 0 || p > G.board.size)) fail('token left the board');
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = sl.results(G);
    if (new Set(G.res.order).size !== G.seats.length || G.res.order[0] !== G.win) fail('bad final order');
    if (G.round <= 80 && G.pos[G.win] !== G.board.size) fail('winner is not on the last tile');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1) fail('results disagree');
    JSON.stringify(sl.view(G, -1));
    return G;
  } finally { Date.now = realNow; }
}

const c = play({});
console.log('classic: winner', c.seats[c.win].name, 'after', c.res.rounds, 'rounds');
const q = play({ size: 'short', seats: 2, bounce: 'off', party: 'off' });
if (q.board.specials.length) fail('party tiles appeared with party off');
console.log('quick: winner', q.seats[q.win].name, 'after', q.res.rounds, 'rounds');
play({ size: 'short', seats: 6 });

// exact finish bounces back
{
  const G = sl.create(players, { size: 'short', bounce: 'on', party: 'off' });
  G.board.snakes = []; G.board.ladders = [];
  G.pos[G.turn] = 58; sl._roll(G, G.turn, Date.now(), 4);
  if (G.pos[G.move.s] !== 58) fail(`bounce should land on 58, got ${G.pos[G.move.s]}`);
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
send({ t: 'create', game: 'ladders', opts: { size: 'short', seats: 6, timer: 10, bots: 'sharp' } });
await wait(300);
if (room?.game !== 'ladders' || room.opts.size !== 'short' || room.opts.seats !== 6 || 'bots' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.size !== 'short') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'ladders' || state.seats.length !== 2 || state.board.size !== 60) bail('game did not start');
for (let i = 0; i < 20 && !(state.stage === 'roll' && state.turn === state.me); i++) await wait(500);
if (state.turn !== state.me) bail('never got a turn');
send({ t: 'act', a: { t: 'roll' } }); await wait(300);
if (state.stage !== 'move' || state.move.s !== state.me) bail('roll did not happen');
console.log('OK');
srv.kill(); process.exit(0);

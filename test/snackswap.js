// Snack Swap test: plays whole games on a fake clock, then checks a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as ss from '../server/games/snackswap.js';
import { ITEM_COUNT, HAND } from '../public/games/snackswap/deck.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

function game(opts, prev) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const G = ss.create(players, opts, prev);
    const n = G.seats.length;
    let lastRound = 0, sawSteal = false;
    for (let i = 0; i < 20000 && G.ph === 'play'; i++) {
      now += 150; ss.tick(G, now);
      if (G.ph !== 'play') break;
      const v = ss.view(G, 0);
      if (G.stage === 'play' && G.round !== lastRound) {
        lastRound = G.round;
        if (v.hand.length !== HAND || v.hand.some(c => !(c >= 0 && c < ITEM_COUNT))) fail('bad hand');
        if (v.slots) fail('cards visible before voting');
        if (ss.act(G, 0, { t: 'play', i: 99 })) fail('played a card that is not in hand');
        if (ss.act(G, 0, { t: 'vote', slot: 0 })) fail('voted before voting opened');
        if (G.round === 1) {
          const mine = G.hands[0].slice(), theirs = G.hands[1].slice();
          if (opts.chaos === 'off') { if (ss.act(G, 0, { t: 'chaos', k: 'swap', m: 1 })) fail('chaos allowed while off'); }
          else {
            if (ss.act(G, 0, { t: 'chaos', k: 'swap', m: 0 })) fail('swapped hands with yourself');
            if (!ss.act(G, 0, { t: 'chaos', k: 'swap', m: 1 })) fail('swap refused');
            if (String(G.hands[0]) !== String(theirs) || String(G.hands[1]) !== String(mine)) fail('hands did not swap');
            if (ss.act(G, 0, { t: 'chaos', k: 'double' })) fail('second chaos card accepted');
            if (!ss.act(G, 1, { t: 'chaos', k: 'double' })) fail('double down refused');
          }
        }
        if (!ss.act(G, 0, { t: 'play', i: 0 })) fail('play refused');
        if (ss.act(G, 0, { t: 'play', i: 0 })) fail('played twice');
        if (!ss.act(G, 1, { t: 'play', i: 2 })) fail('play refused');
        if (ss.view(G, 1).myPlay === null || ss.view(G, 0).seats[1].played !== true) fail('view misses the play');
      }
      if (G.stage === 'vote' && G.votes[0] === null) {
        if (v.slots.length !== n || v.slots.some(x => 'by' in x)) fail('voting cards are not anonymous');
        if (ss.act(G, 0, { t: 'vote', slot: v.mySlot })) fail('voted for own card');
        if (!ss.act(G, 0, { t: 'vote', slot: (v.mySlot + 1) % n })) fail('vote refused');
        if (opts.chaos !== 'off' && G.round === 2) { if (!ss.act(G, 2 < n && G.seats[2].human ? 2 : 0, { t: 'chaos', k: 'steal' }) && !G.chaos[0]) fail('steal refused'); }
        if (!ss.act(G, 1, { t: 'vote', slot: (G.order.indexOf(1) + 1) % n })) fail('vote refused');
      }
      if (G.stage === 'reveal') {
        const total = G.slots.reduce((t, x) => t + x.n, 0), cast = G.votes.filter(x => x !== null).length;
        if (total !== cast) fail(`votes do not add up: ${total} counted, ${cast} cast`);
        for (const x of G.slots) { if (x.pts !== x.n * (x.dd ? 2 : 1)) fail('wrong points'); if (x.stolen) sawSteal = true; }
        if (G.round === 1 && opts.chaos !== 'off' && !G.slots.find(x => x.by === 1).dd) fail('double down lost');
      }
    }
    if (G.ph !== 'end') fail('game did not end');
    if (G.round !== G.rounds) fail('wrong number of rounds');
    const r = ss.results(G);
    if (r.players.length !== n || r.players[0].place !== 1 || !r.players[0].won) fail('bad results');
    if (r.players.reduce((t, p) => t + p.points, 0) !== G.pts.reduce((a, b) => a + b, 0)) fail('results and points disagree');
    for (let i = 1; i < n; i++) if (r.players[i].points > r.players[i - 1].points) fail('results not sorted');
    JSON.stringify(ss.view(G, -1));
    return { G, sawSteal };
  } finally { Date.now = realNow; }
}

const a = game({ rounds: 5, field: 6 });
console.log('5 rounds, 6 seats: winner', a.G.seats[a.G.win].name, 'with', a.G.pts[a.G.win], 'points');
const b = game({ rounds: 8, field: 0, chaos: 'off', mix: 'custom', prompts: [{ text: 'Why <b>Bo</b> is late', by: 'Ana', id: 'a' }, { text: 'x' }] }, a.G);
if (b.G.seats.length !== 3) fail('two players should get one bot to make voting possible');
if (b.G.pile.some(p => p.text !== 'Why <b>Bo</b> is late')) fail('custom-only pile used built-in prompts');
console.log('custom prompts only: winner', b.G.seats[b.G.win].name);
const o = ss.cleanOpts({ rounds: 99, timer: 1, field: 7, prompts: Array.from({ length: 50 }, (_, i) => ({ text: 'prompt number ' + i })) });
if (o.rounds !== 8 || o.timer !== 45 || o.field !== 4 || o.prompts.length !== 30) fail('options not cleaned');

// over the wire
const PORT = 19080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1' }, stdio: 'inherit' });
const bail = m => { srv.kill(); fail(m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(600);
function client(name) {
  const c = { room: null, state: null, err: null, ws: new WebSocket(`ws://127.0.0.1:${PORT}/ws`) };
  c.send = m => c.ws.send(JSON.stringify(m));
  c.ws.onopen = () => c.send({ t: 'hello', name, color: '#ff8fab' });
  c.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') c.room = m.room; if (m.t === 'state') c.state = m.s; if (m.t === 'err') c.err = m.msg; };
  return c;
}
const A = client('Ana'), B = client('Bo');
await wait(300);
A.send({ t: 'create', game: 'snackswap', opts: { rounds: 5, field: 4, timer: 30 } }); await wait(300);
if (A.room?.game !== 'snackswap' || A.room.opts.rounds !== 5 || A.room.opts.prompts.length) bail('room options wrong');
B.send({ t: 'join', code: A.room.code }); await wait(300);
B.send({ t: 'room-act', a: { t: 'addPrompt', text: '  What Bo keeps in the fridge  ' } }); await wait(200);
if (A.room.opts.prompts[0]?.text !== 'What Bo keeps in the fridge' || A.room.opts.prompts[0].by !== 'Bo') bail('guest could not add a prompt');
B.send({ t: 'room-act', a: { t: 'addPrompt', text: 'what bo keeps in the fridge' } }); await wait(200);
if (A.room.opts.prompts.length !== 1 || !B.err) bail('duplicate prompt accepted');
A.send({ t: 'room-act', a: { t: 'addPrompt', text: 'Second one' } }); await wait(200);
B.send({ t: 'room-act', a: { t: 'delPrompt', i: 1 } }); await wait(200);
if (A.room.opts.prompts.length !== 2) bail('guest removed someone else\'s prompt');
A.send({ t: 'opts', opts: { rounds: 12 } }); await wait(200);
if (A.room.opts.rounds !== 12 || A.room.opts.prompts.length !== 2) bail('changing an option lost the prompts');
A.send({ t: 'room-act', a: { t: 'delPrompt', i: 1 } }); await wait(200);
if (A.room.opts.prompts.length !== 1) bail('host could not remove a prompt');
A.send({ t: 'start' }); await wait(300);
if (A.state?.stage !== 'play' || A.state.seats.length !== 4 || A.state.hand.length !== 6 || B.state.hand.length !== 6) bail('game did not start');
A.send({ t: 'act', a: { t: 'play', i: 1 } }); B.send({ t: 'act', a: { t: 'play', i: 0 } }); await wait(300);
if (A.state.myPlay === null || A.state.hand.length !== 5 || !A.state.seats[B.state.me].played) bail('plays missing');
console.log('OK');
srv.kill(); process.exit(0);

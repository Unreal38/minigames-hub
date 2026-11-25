// Piotruś test: checks the pairing rules, plays whole games on a fake clock (making sure nobody is ever sent
// another player's hand and every card is always accounted for), then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as piotr from '../server/games/piotr.js';
import { deck, strip, petOf, PIOTR, PETS, DECKS } from '../public/games/piotr/rules.js';
import { SPECIES } from '../public/games/farm/data.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- rules -----
if (deck().length !== 25 || deck(16).length !== 33 || new Set(deck(16)).size !== 33 || deck().filter(c => c === PIOTR).length !== 1) fail('deck wrong');
if (PETS.length < DECKS.big || new Set(PETS).size !== PETS.length || PETS.some(sp => !SPECIES[sp]) || !SPECIES.tuxpurr) fail('a card shows a pet that Pet Farm does not have');
{
  const { keep, pairs } = strip([0, 4, 1, PIOTR, 7, 5, 6, 9]);
  if (keep.join() !== [PIOTR, 9].join() || pairs.sort().join() !== '0,2,3') fail('pairs not stripped: ' + keep + ' / ' + pairs);
  if (strip([PIOTR]).keep.length !== 1 || petOf(PIOTR) !== -1 || petOf(5) !== 2) fail('the Piotruś must never pair');
}

// ----- whole games -----
function play(opts, people = players, human = (G, s) => piotr.act(G, s, { t: 'take', k: Math.random() * G.hands[G.from].length | 0 })) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = piotr.create(people, opts), n = G.seats.length, total = DECKS[G.opts.deck] * 2 + 1;
    if (n !== Math.max(opts.seats || 4, people.length) || G.dealt.reduce((a, b) => a + b, 0) !== total || Math.max(...G.dealt) - Math.min(...G.dealt) > 1) fail('seats or deal wrong');
    if (piotr.act(G, 0, { t: 'take', k: 0 }) || piotr.act(G, 0, { t: 'shuffle' })) fail('acted during the deal');
    if (piotr.view(G, 0).heap.length) fail('pairs shown before they are laid down');
    for (let i = 0; i < 200000 && G.ph === 'play'; i++) {
      now += 100;
      const all = [...G.heap.flatMap(h => [h.p * 2, h.p * 2 + 1]), ...G.hands.flat()];
      if (all.length !== total || new Set(all).size !== total) fail('cards lost or copied');
      if (G.hands.some(h => strip(h).pairs.length)) fail('a pair stayed in a hand');
      for (let s = -1; s < n; s++) { // nobody may see another hand, or be told which card someone else drew
        const v = piotr.view(G, s);
        v.seats.forEach((p, j) => { if (j !== s && p.hand) fail(`seat ${s} was sent seat ${j}'s hand`); if (j === s && G.stage !== 'deal' && p.hand.length !== p.n) fail('own hand missing'); });
        if (JSON.stringify(v).includes('"hands"')) fail('hands leaked in the view');
        if (v.got >= 0 && v.last.s !== s) fail('someone else was told the drawn card');
        if (JSON.stringify(v.last || {}).includes('"c"')) fail('the drawn card is in the public move');
      }
      const s = G.turn;
      if (G.stage === 'play' && s >= 0 && G.seats[s].human && !G.seats[s].bot) {
        if (G.from < 0 || G.from === s || !G.hands[G.from].length || !G.hands[s].length) fail('drawing from the wrong player');
        for (let k = 1; k < n; k++) { const j = (s - k + n) % n; if (j === G.from) break; if (G.hands[j].length) fail('skipped a player who still holds cards'); }
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && (piotr.act(G, other, { t: 'take', k: 0 }) || piotr.act(G, other, { t: 'aim', k: 0 }))) fail('acted out of turn');
        if (piotr.act(G, s, { t: 'take', k: G.hands[G.from].length }) || piotr.act(G, s, { t: 'take', k: -1 }) || piotr.act(G, s, { t: 'take', k: .5 }) || piotr.act(G, s, { t: 'take' }) || piotr.act(G, s, { t: 'dance' }) || piotr.act(G, s, { t: 'aim', k: 99 })) fail('nonsense accepted');
        if (!piotr.act(G, s, { t: 'aim', k: 0 }) || G.aim !== 0 || piotr.act(G, s, { t: 'aim', k: 0 }) || !piotr.act(G, s, { t: 'aim', k: -1 })) fail('reaching for a card wrong');
        if (G.hands[s].length > 1) { const before = [...G.hands[s]].sort().join(); if (!piotr.act(G, s, { t: 'shuffle' }) || [...G.hands[s]].sort().join() !== before) fail('shuffle wrong'); }
        const mv = G.mv; human(G, s, now);
        if (G.mv !== mv + 1) fail('human move refused');
      } else piotr.tick(G, now);
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = piotr.results(G);
    if (G.res.called) fail('a game should never need to be stopped');
    if (G.hands.flat().join() !== String(PIOTR) || !G.hands[G.loser].length) fail('the loser should hold only the Piotruś');
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win || G.res.order[n - 1] !== G.loser) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || r[G.loser].pts !== 0 || r[G.loser].place !== n) fail('results disagree');
    for (let k = 0; k < n - 2; k++) if (G.out[G.res.order[k]] > G.out[G.res.order[k + 1]]) fail('placing order wrong');
    if (!piotr.view(G, -1).seats[G.loser].hand) fail('the Piotruś is not shown at the end');
    return G;
  } finally { Date.now = realNow; }
}
const five = [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3] }, { id: 'e', name: 'Eli', color: '#e8a0e0', av: [4] }];
for (const seats of [2, 3, 4, 5, 6]) { const G = play({ seats }); console.log(`${seats} seats: ${G.seats[G.loser].name} is left with the Piotruś after ${G.mv} draws`); }
for (let k = 0; k < 60; k++) { play({ seats: 2 + k % 5, deck: k % 2 ? 'big' : 'small' }); play({ seats: 2 }, five); }
if (play({ seats: 2 }, five).seats.length !== 5) fail('five people need five seats');

{ // bot tables: how long a game takes, and that the loser is spread evenly (it is a game of luck)
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let moves = 0; const N = 400, lost = [0, 0, 0, 0];
  for (let g = 0; g < N; g++) {
    const G = piotr.create([], { seats: 4 });
    for (let i = 0; i < 100000 && G.ph === 'play'; i++) { now += 400; piotr.tick(G, now); }
    if (G.ph !== 'end') fail('bots did not finish');
    moves += G.mv; lost[G.loser]++;
  }
  Date.now = realNow;
  console.log(`bots: ${(moves / N).toFixed(0)} draws a game, left with the Piotruś: ${lost.join(' ')}`);
  if (moves / N > 80 || lost.some(x => x < N * .12)) fail('bot games drag on or are lopsided');
}
{ // the turn timer draws for you, and a player who leaves is played by a bot
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = piotr.create(players, { seats: 2, timer: 20 });
  for (let i = 0; i < 100 && G.stage !== 'play'; i++) { now += 200; piotr.tick(G, now); }
  if (G.stage !== 'play' || !G.tEnd) fail('deal did not finish or timer not set');
  const mv = G.mv; now += 20100; piotr.tick(G, now);
  if (G.mv !== mv + 1) fail('timer did not draw a card');
  piotr.setAway(G, 0, true); piotr.setAway(G, 1, true);
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { now += 500; piotr.tick(G, now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 23080 + (Math.random() * 900 | 0);
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
send({ t: 'create', game: 'piotr', opts: { seats: 6, timer: 15, dice: 3 } });
await wait(300);
if (room?.game !== 'piotr' || room.opts.seats !== 6 || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, deck: 'big' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.deck !== 'big' || room.opts.timer !== 15) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'piotr' || state.seats.length !== 2 || !state.seats[state.me].hand) bail('game did not start');
let turns = 0;
for (let i = 0; i < 3000 && state.ph === 'play'; i++) {
  if (state.seats[1 - state.me].hand) bail('the server sent the other hand');
  if (state.stage === 'play' && state.turn === state.me) {
    const mv = state.mv;
    send({ t: 'act', a: { t: 'take', k: Math.random() * state.seats[state.from].n | 0 } }); turns++;
    for (let k = 0; k < 40 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
  } else await wait(50);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins !== (me.gain.place === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', turns, 'draws,', state.win === state.me ? 'out first' : 'left with the Piotruś', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

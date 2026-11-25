// Pan test: checks the card rules, plays whole games on a fake clock (making sure nobody is ever sent another
// player's hand and the 24 cards are always all accounted for), then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as pan from '../server/games/pan.js';
import { deck, canPlay, drawCount, plays, seatsFor, rankOf, NINE_H } from '../public/games/pan/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const C = (r, s) => s * 13 + '23456789TJQKA'.indexOf(r); // C('9', 0) is the nine of hearts

// ----- rules -----
if (deck().length !== 24 || new Set(deck()).size !== 24 || deck().some(c => rankOf(c) < 7) || C('9', 0) !== NINE_H) fail('deck wrong');
{
  const nines = [C('9', 0), C('9', 1), C('9', 2), C('9', 3)], h = [...nines, C('K', 0)];
  if (!canPlay(h, [], [NINE_H]) || !canPlay(h, [], nines) || canPlay(h, [], [C('K', 0)]) || canPlay(h, [], nines.slice(0, 2)) || canPlay(h, [], nines.slice(1))) fail('the game must open with the nine of hearts');
  const pile = [NINE_H, C('J', 1)];
  if (!canPlay([C('J', 0)], pile, [C('J', 0)]) || !canPlay([C('A', 0)], pile, [C('A', 0)]) || canPlay([C('T', 0)], pile, [C('T', 0)])) fail('a card must be the same or higher');
  if (canPlay([C('A', 0)], pile, [C('K', 0)]) || canPlay([C('A', 0)], pile, [C('A', 0), C('A', 0)]) || canPlay([C('A', 0)], pile, []) || canPlay([C('A', 0)], pile, 'x')) fail('nonsense accepted');
  const ks = [0, 1, 2, 3].map(s => C('K', s));
  if (!canPlay(ks, pile, ks) || canPlay(ks, pile, ks.slice(0, 2)) || canPlay(ks, pile, ks.slice(0, 3)) || canPlay(ks, [NINE_H, C('A', 0)], ks)) fail('four of a kind wrong');
  if (!canPlay(nines.slice(1), [NINE_H], nines.slice(1)) || canPlay(nines.slice(1), [NINE_H, C('9', 1)], [C('9', 2), C('9', 3)])) fail('three nines go only onto the nine of hearts');
  if (drawCount([NINE_H]) !== 0 || drawCount([NINE_H, 8]) !== 1 || drawCount([NINE_H, 8, 9, 10, 11]) !== 3 || drawCount([]) !== 0) fail('picking up wrong');
  if (plays([C('T', 0)], pile).length || plays(ks, pile).length !== 5) fail('list of plays wrong');
  if (seatsFor(4, 2) !== 4 || seatsFor(2, 3) !== 3 || seatsFor(4, 5) !== 5 || seatsFor(6, 5) !== 6 || seatsFor(6, 1) !== 6) fail('table sizes wrong');
}

{ // spades: the next turn goes to the player before, once, and then play carries on clockwise
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const four = [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3] }];
  const G = pan.create(four, { seats: 4, timer: 0 });
  // seat 0 holds the nine of hearts and a spade, everyone else a heap of aces and kings
  G.hands = [[NINE_H, C('T', 3), C('J', 0)], [C('T', 0), C('A', 0), C('K', 0)], [C('T', 1), C('A', 1), C('K', 1)], [C('T', 2), C('A', 2), C('K', 2)]];
  G.turn = 0; now += 5000; pan.tick(G, now);
  const go = (s, c) => { if (G.turn !== s) fail(`expected seat ${s} to move, it is seat ${G.turn}`); if (!pan.act(G, s, { t: 'play', cards: [c] })) fail('play refused'); };
  go(0, NINE_H); go(1, C('T', 0)); go(2, C('T', 1)); go(3, C('T', 2));
  go(0, C('T', 3));                 // a spade from seat 0: seat 3 is next, not seat 1
  if (!G.last.back) fail('spade not marked');
  go(3, C('K', 2));                 // not a spade: on round the table from seat 3
  if (G.turn !== 0) fail('play did not carry on clockwise after the spade');
  Date.now = realNow;
}

// ----- whole games -----
function play(opts, human = (G, s, now) => pan._bot(G, s, now, 'chill'), people = players) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = pan.create(people, opts), n = G.seats.length;
    if (n !== seatsFor(opts.seats || 4, people.length) || G.hands.some((h, i) => h.length !== Math.floor(24 / n) + (i < 24 % n))) fail('seats or deal wrong');
    if (!G.hands[G.turn].includes(NINE_H)) fail('the holder of the nine of hearts must start');
    if (pan.act(G, G.turn, { t: 'play', cards: [NINE_H] }) && G.seats[G.turn]?.human) fail('played during the deal');
    for (let i = 0; i < 100000 && G.ph === 'play'; i++) {
      now += 100;
      const all = [...G.pile, ...G.hands.flat()];
      if (all.length !== 24 || new Set(all).size !== 24) fail('cards lost or copied');
      for (let k = 1; k < G.pile.length; k++) if (rankOf(G.pile[k]) < rankOf(G.pile[k - 1])) fail('the pile went down');
      if (G.pile.length && G.pile[0] !== NINE_H) fail('the nine of hearts left the bottom of the pile');
      for (let s = -1; s < n; s++) { // nobody may see another hand
        const v = pan.view(G, s);
        v.seats.forEach((p, j) => { if (j !== s && p.hand) fail(`seat ${s} was sent seat ${j}'s hand`); if (j === s && p.hand.length !== p.n) fail('own hand missing'); });
        if (JSON.stringify(v).includes('"hands"')) fail('hands leaked in the view');
      }
      const s = G.turn;
      if (G.stage === 'play' && s >= 0 && G.seats[s].human && !G.seats[s].bot) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && (pan.act(G, other, { t: 'draw' }) || pan.act(G, other, { t: 'play', cards: [G.hands[other][0]] }))) fail('acted out of turn');
        if (pan.act(G, s, { t: 'play', cards: [G.hands[(s + 1) % n][0] ?? 99] }) || pan.act(G, s, { t: 'play', cards: [] }) || pan.act(G, s, { t: 'dance' }) || pan.act(G, s, { t: 'play' })) fail('nonsense accepted');
        if (drawCount(G.pile) === 0 && pan.act(G, s, { t: 'draw' })) fail('picked up with nothing to take');
        const mv = G.mv; human(G, s, now);
        if (G.mv === mv) fail('human move refused');
      } else pan.tick(G, now);
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = pan.results(G), left = G.hands.filter(h => h.length).length;
    if (!G.res.called && (left !== 1 || !G.hands[G.pan].length)) fail('the pan should be the only one left with cards');
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win || G.res.order[n - 1] !== G.pan) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || r[G.pan].pts !== 0 || r[G.pan].place !== n) fail('results disagree');
    if (!G.res.called) for (let k = 0; k < n - 2; k++) if (G.out[G.res.order[k]] > G.out[G.res.order[k + 1]]) fail('placing order wrong');
    return G;
  } finally { Date.now = realNow; }
}
for (const seats of [2, 3, 4, 5, 6]) { const G = play({ seats }); console.log(`${seats} seats: ${G.seats[G.pan].name} is the pan after ${G.mv} moves`); }
play({ seats: 4, bots: 'sharp', timer: 0 });
if (play({ seats: 4 }, undefined, [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3] }, { id: 'e', name: 'Eli', color: '#e8a0e0', av: [4] }]).seats.length !== 5) fail('five people get a table for five');
// a human who never picks up unless forced, against bots: the bots dig the game out
for (let k = 0; k < 20; k++) play({ seats: 3 }, (G, s) => { const o = plays(G.hands[s], G.pile).sort((a, b) => rankOf(a[0]) - rankOf(b[0])); if (!pan.act(G, s, o.length ? { t: 'play', cards: o[0] } : { t: 'draw' })) fail('move refused'); });
// two humans who both refuse to pick up may never finish: the table is called and the game still ends
{ const G = play({ seats: 2 }, (G, s) => { const o = plays(G.hands[s], G.pile).filter(c => c.length === 1).sort((a, b) => rankOf(a[0]) - rankOf(b[0])); pan.act(G, s, o.length ? { t: 'play', cards: o[0] } : { t: 'draw' }); });
  if (G.mv > pan.MAX_MOVES) fail('game ran past the move limit'); }

{ // bot tables finish in a sensible number of moves, and sharp bots end up the pan less often than chill ones
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let moves = 0, called = 0, sharpPan = 0; const N = 400;
  for (let g = 0; g < N; g++) {
    const G = pan.create([], { seats: 4 }); now += 5000; pan.tick(G, now);
    while (G.ph === 'play') pan._bot(G, G.turn, now, G.turn % 2 ? 'sharp' : 'chill');
    moves += G.mv; if (G.res.called) called++; else if (G.pan % 2) sharpPan++;
  }
  Date.now = realNow;
  console.log(`bots: ${(moves / N).toFixed(0)} moves a game, ${called} called, sharp was the pan in ${sharpPan}/${N}`);
  if (moves / N > 110 || called > N * .03) fail('bot games drag on');
  if (sharpPan > N * .45) fail('sharp bots are not better than chill ones');
}
{ // the turn timer plays for you, and a player who leaves is played by a bot
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = pan.create(players, { seats: 2, timer: 20 });
  now += 3000; pan.tick(G, now);
  if (G.stage !== 'play' || !G.tEnd) fail('deal did not finish or timer not set');
  const mv = G.mv; now += 20100; pan.tick(G, now);
  if (G.mv !== mv + 1) fail('timer did not play the turn');
  pan.setAway(G, 0, true); pan.setAway(G, 1, true);
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { now += 500; pan.tick(G, now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 22080 + (Math.random() * 900 | 0);
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
send({ t: 'create', game: 'pan', opts: { seats: 6, timer: 20, dice: 3 } });
await wait(300);
if (room?.game !== 'pan' || room.opts.seats !== 6 || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, bots: 'sharp' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.bots !== 'sharp' || room.opts.timer !== 20) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'pan' || state.seats.length !== 2 || state.seats[state.me].hand?.length !== 12) bail('game did not start');
if (state.seats[1 - state.me].hand) bail('the server sent the other hand');
// play the lowest card that fits, pick up when a low card is stuck (as the rules page suggests)
let turns = 0;
for (let i = 0; i < 3000 && state.ph === 'play'; i++) {
  if (state.stage === 'play' && state.turn === state.me) {
    if (state.seats[1 - state.me].hand) bail('saw the other hand');
    const hand = state.seats[state.me].hand, o = plays(hand, state.pile).sort((a, b) => b.length - a.length || rankOf(a[0]) - rankOf(b[0]));
    const stuck = state.pile.length > 1 && hand.some(c => rankOf(c) < rankOf(state.pile[state.pile.length - 1]));
    const mv = state.mv;
    send({ t: 'act', a: o.length && !(stuck && turns % 2) ? { t: 'play', cards: o[0] } : { t: 'draw' } }); turns++;
    for (let k = 0; k < 40 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
  } else await wait(50);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins !== (me.gain.place === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', turns, 'turns,', state.win === state.me ? 'out first' : 'the pan', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

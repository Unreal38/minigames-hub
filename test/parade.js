// Pet Parade test: checks the card rules, plays whole games on a fake clock (making sure nobody is ever sent
// another player's hand and all 104 cards are always accounted for), the "Last one!" call and catch, stacking,
// then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as pp from '../server/games/parade.js';
import { deck, colOf, faceOf, fits, playable, isWild, petOf, PETS, N, NAP, TURN, GIFT, PEBBLE, ROCK, handPoints } from '../public/games/parade/rules.js';
import { SPECIES } from '../public/games/farm/data.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const four = [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3] }];
const card = (col, face, copy = 0) => { // the card number of a face in a colour (face 1..9, NAP, TURN, GIFT), or a wild
  if (face === PEBBLE) return 96 + copy; if (face === ROCK) return 100 + copy;
  return col * 24 + (face <= 9 ? face - 1 + copy * 9 : 18 + (face - NAP) * 2 + copy);
};

// ----- rules -----
{
  const d = deck();
  if (d.length !== N || new Set(d).size !== N) fail('deck wrong');
  const count = f => d.filter(c => faceOf(c) === f).length;
  for (let f = 1; f <= 9; f++) if (count(f) !== 8) fail('8 of each number');
  if (count(NAP) !== 8 || count(TURN) !== 8 || count(GIFT) !== 8 || count(PEBBLE) !== 4 || count(ROCK) !== 4) fail('action counts wrong');
  for (let col = 0; col < 4; col++) if (d.filter(c => colOf(c) === col).length !== 24) fail('24 cards a colour');
  for (const c of d) { const sp = petOf(c); if (!SPECIES[sp]) fail('no such pet ' + sp + ' on card ' + c); if (!isWild(c) && SPECIES[sp].el !== ['Leaf', 'Ember', 'Tide', 'Spark'][colOf(c)]) fail(`${sp} is not a ${colOf(c)} pet`); }
  if (new Set(PETS.flat()).size !== 48) fail('every card face has its own pet');
  for (let col = 0; col < 4; col++) for (const f of [1, 5, 9, NAP, TURN, GIFT]) for (const k of [0, 1]) { const c = card(col, f, k); if (colOf(c) !== col || faceOf(c) !== f) fail(`card() wrong for ${col}/${f}`); }
  const t = card(0, 5); // a Leaf 5 on top, Leaf in play
  if (!fits(card(0, 2), t, 0) || !fits(card(2, 5), t, 0) || fits(card(2, 6), t, 0) || !fits(96, t, 0) || !fits(100, t, 0)) fail('matching wrong');
  if (!fits(card(3, 7), 96, 3) || fits(card(0, 7), 96, 3)) fail('after a wild card the picked colour counts');
  if (!fits(card(1, NAP), card(2, NAP), 2) || fits(card(1, TURN), card(2, NAP), 2)) fail('actions match actions');
  if (fits(card(1, 3), card(1, GIFT), 1, 2) || !fits(card(2, GIFT), card(1, GIFT), 1, 2) || !fits(101, card(1, GIFT), 1, 2) || fits(card(1, GIFT), 100, 1, 4)) fail('stacking wrong');
  if (fits(-1, t, 0) || fits(104, t, 0) || fits('3', t, 0) || fits(2.5, t, 0)) fail('nonsense card accepted');
  if (handPoints([card(0, 7), card(1, NAP), 96]) !== 37) fail('points wrong');
  if (playable([card(0, 1), card(3, 3)], t, 0).length !== 1) fail('playable wrong');
}

const clock = () => { const realNow = Date.now; let now = realNow(); Date.now = () => now; return { add: ms => (now += ms), get now() { return now; }, done: () => { Date.now = realNow; } }; };
const ready = (G, T) => { T.add(5000); pp.tick(G, T.now); if (G.stage !== 'play') fail('deal did not end'); };

{ // Nap skips, Turnabout turns round, Gift gives two and skips, Rockslide picks a colour and gives four
  const T = clock();
  const G = pp.create(four, { seats: 4, timer: 0 }); ready(G, T);
  G.turn = 0; G.dir = 1; G.pile = [card(0, 5)]; G.col = 0;
  G.hands = [[card(0, NAP), card(0, 1), card(0, 2), card(0, 3)], [card(1, 1), card(1, 2), card(1, 3)], [card(0, TURN), card(2, 2), card(2, 3)], [card(0, GIFT), card(3, 1), card(3, 2), card(3, 3)]];
  const go = (s, c, col) => { if (G.turn !== s) fail(`expected seat ${s}, it is seat ${G.turn}`); if (!pp.act(G, s, { t: 'play', c, col })) fail('play refused ' + JSON.stringify([s, c, G.pile.at(-1), G.col, G.stage, G.hands[s]])); };
  go(0, card(0, NAP)); // skips seat 1
  go(2, card(0, TURN)); // now anticlockwise: seat 1 next
  if (G.dir !== -1) fail('Turnabout did not turn');
  if (pp.act(G, 1, { t: 'play', c: card(1, 1) })) fail('a card of the wrong colour was played');
  pp.act(G, 1, { t: 'draw' }); if (G.stage === 'drawn') pp.act(G, 1, { t: 'keep' });
  if (G.turn !== 0) fail('anticlockwise from seat 1 is seat 0');
  const before = G.hands[3].length; G.hands[0].push(card(0, GIFT, 1));
  go(0, card(0, GIFT, 1)); // seat 3 takes two and is skipped
  if (G.hands[3].length !== before + 2 || G.turn !== 2) fail('Gift wrong');
  G.hands[2].push(100); const b1 = G.hands[1].length;
  go(2, 100, 3);
  if (G.col !== 3 || G.hands[1].length !== b1 + 4 || G.turn !== 0) fail('Rockslide wrong');
  T.done();
}
{ // with two players a Turnabout works like a Nap
  const T = clock(); const G = pp.create(players, { seats: 2, timer: 0 }); ready(G, T);
  G.turn = 0; G.pile = [card(0, 5)]; G.col = 0; G.hands = [[card(0, TURN), card(0, 1)], [card(1, 1), card(1, 2)]];
  pp.act(G, 0, { t: 'play', c: card(0, TURN) }); if (G.turn !== 0) fail('Turnabout with two players should skip'); T.done();
}
{ // stacking: pass a Gift on with another Gift, then the next player takes all four
  const T = clock(); const G = pp.create(four, { seats: 4, timer: 0, stack: 'on' }); ready(G, T);
  G.turn = 0; G.dir = 1; G.pile = [card(0, 5)]; G.col = 0;
  G.hands = [[card(0, GIFT), card(0, 1), card(0, 2)], [card(2, GIFT), card(1, 2), card(1, 3)], [card(2, 1), card(2, 2), card(2, 3)], [card(3, 1), card(3, 2)]];
  pp.act(G, 0, { t: 'play', c: card(0, GIFT) });
  if (G.owe !== 2 || G.turn !== 1) fail('Gift should be owed');
  if (pp.act(G, 1, { t: 'play', c: card(1, 2) })) fail('a plain card was played on an owed Gift');
  pp.act(G, 1, { t: 'play', c: card(2, GIFT) });
  if (G.owe !== 4 || G.turn !== 2) fail('Gift should stack');
  pp.act(G, 2, { t: 'draw' });
  if (G.hands[2].length !== 7 || G.owe || G.turn !== 3 || G.stage !== 'play') fail('owed cards not taken');
  T.done();
}
{ // "Last one!": call it before you play your second-last card, or be caught
  const T = clock(); const G = pp.create(four, { seats: 4, timer: 0 }); ready(G, T);
  G.turn = 0; G.dir = 1; G.pile = [card(0, 5)]; G.col = 0; G.seats.forEach(x => { if (!x.human) fail('all four are people'); });
  G.hands = [[card(0, 1), card(0, 2)], [card(0, 3), card(0, 4), card(1, 1)], [card(2, 1), card(2, 2), card(2, 3)], [card(3, 1), card(3, 2)]];
  pp.act(G, 0, { t: 'play', c: card(0, 1) }); // forgot
  if (G.open !== 0) fail('a forgotten call should be catchable');
  if (pp.act(G, 0, { t: 'catch' })) fail('you cannot catch yourself');
  if (!pp.act(G, 2, { t: 'catch' }) || G.hands[0].length !== 3 || G.open !== -1) fail('catch should give two');
  if (pp.act(G, 3, { t: 'catch' })) fail('caught twice');
  // seat 1 calls first, so it is safe
  if (!pp.act(G, 1, { t: 'draw' }) && G.turn === 1) fail('draw refused');
  if (G.stage === 'drawn') pp.act(G, 1, { t: 'keep' });
  G.turn = 1; G.stage = 'play'; G.hands[1] = [card(0, 3), card(0, 4)];
  if (pp.act(G, 2, { t: 'call' })) fail('called with three cards');
  if (!pp.act(G, 1, { t: 'call' })) fail('call refused');
  pp.act(G, 1, { t: 'play', c: card(0, 3) });
  if (G.open !== -1 || !pp.view(G, 0).seats[1].called) fail('a called last card is safe');
  // a late call before anyone catches you still counts
  G.turn = 3; G.stage = 'play'; G.hands[3] = [card(0, 7), card(3, 2)]; G.called[3] = false;
  pp.act(G, 3, { t: 'play', c: card(0, 7) });
  if (G.open !== 3 || !pp.act(G, 3, { t: 'call' }) || G.open !== -1 || pp.act(G, 0, { t: 'catch' })) fail('late call wrong');
  // the next player moving on closes the chance
  G.turn = 0; G.stage = 'play'; G.hands[0] = [card(0, 8), card(0, 9)]; G.called[0] = false;
  pp.act(G, 0, { t: 'play', c: card(0, 8) }); if (G.open !== 0) fail('open');
  pp.act(G, 1, { t: 'draw' }); if (G.open !== -1 || pp.act(G, 2, { t: 'catch' })) fail('too late to catch should be refused');
  T.done();
}
{ // a drawn card that fits may be played or kept; one that does not fit ends the turn; only the drawer sees it
  const T = clock(); const G = pp.create(players, { seats: 2, timer: 0 }); ready(G, T);
  G.turn = 0; G.pile = [card(0, 5)]; G.col = 0; G.hands = [[card(1, 1), card(1, 2)], [card(2, 1), card(2, 2)]];
  G.stock.push(card(0, 7));
  pp.act(G, 0, { t: 'draw' });
  if (G.stage !== 'drawn' || G.drawn !== card(0, 7) || pp.view(G, 0).drawn !== card(0, 7) || pp.view(G, 1).drawn !== -1) fail('drawn card wrong');
  if (pp.act(G, 0, { t: 'play', c: card(1, 1) }) || pp.act(G, 0, { t: 'draw' })) fail('after drawing only the drawn card may be played');
  pp.act(G, 0, { t: 'play', c: card(0, 7) }); if (G.turn !== 1 || G.hands[0].length !== 2) fail('drawn card not played');
  G.stock.push(card(3, 3)); pp.act(G, 1, { t: 'draw' });
  if (G.turn !== 0 || G.stage !== 'play') fail('a drawn card that does not fit should end the turn');
  T.done();
}

// ----- whole games -----
function play(opts, human = (G, s, now) => pp._bot(G, s, now, 'chill'), people = players) {
  const T = clock();
  try {
    const G = pp.create(people, opts), n = G.seats.length;
    if (n !== Math.max(opts.seats || 4, people.length) || G.hands.some(h => h.length !== 7) || faceOf(G.pile[0]) > 9) fail('seats or deal wrong');
    if (pp.act(G, G.turn, { t: 'draw' }) && G.seats[G.turn]?.human) fail('played during the deal');
    for (let i = 0; i < 100000 && G.ph === 'play'; i++) {
      T.add(100);
      const all = [...G.pile, ...G.stock, ...G.hands.flat()];
      if (all.length !== N || new Set(all).size !== N) fail('cards lost or copied');
      if (G.col < 0 || G.col > 3) fail('no colour in play');
      for (let s = -1; s < n; s++) { // nobody may see another hand or another player's drawn card
        const v = pp.view(G, s);
        v.seats.forEach((p, j) => { if (j !== s && p.hand) fail(`seat ${s} was sent seat ${j}'s hand`); if (j === s && p.hand.length !== p.n) fail('own hand missing'); });
        if (s !== G.turn && v.drawn !== -1) fail('drawn card leaked');
        if (JSON.stringify(v).includes('"hands"') || JSON.stringify(v).includes('"stock"')) fail('hands or deck leaked in the view');
      }
      const s = G.turn;
      if (G.stage !== 'deal' && s >= 0 && G.seats[s].human && !G.seats[s].bot) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && (pp.act(G, other, { t: 'draw' }) || pp.act(G, other, { t: 'play', c: G.hands[other][0] }))) fail('acted out of turn');
        if (pp.act(G, s, { t: 'play', c: G.hands[(s + 1) % n][0] ?? 999 }) || pp.act(G, s, { t: 'dance' }) || pp.act(G, s, { t: 'play' })) fail('nonsense accepted');
        const mv = G.mv, st = G.stage; human(G, s, T.now);
        if (G.mv === mv && G.stage === st) fail('human move refused');
      } else pp.tick(G, T.now);
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = pp.results(G);
    if (!G.res.called && G.hands[G.win].length) fail('the winner should be out of cards');
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || r.some(x => x.place < 1 || x.place > n)) fail('results disagree');
    for (let k = 1; k < n - 1; k++) if (G.res.pts[G.res.order[k]] > G.res.pts[G.res.order[k + 1]]) fail('placing by points wrong');
    if (pp.view(G, 0).seats.some(p => !p.hand)) fail('hands are shown at the end');
    return G;
  } finally { T.done(); }
}
for (const seats of [2, 3, 4, 5, 6]) { const G = play({ seats }); console.log(`${seats} seats: ${G.seats[G.win].name} won after ${G.mv} moves`); }
play({ seats: 4, bots: 'sharp', stack: 'on' });
if (play({ seats: 4 }, undefined, [...four, { id: 'e', name: 'Eli', color: '#e8a0e0', av: [4] }]).seats.length !== 5) fail('five people need five seats');
// a person who always draws: still ends
play({ seats: 3 }, (G, s, now) => { if (G.stage === 'drawn') pp.act(G, s, { t: 'keep' }); else pp.act(G, s, { t: 'draw' }); });

{ // bot tables finish in a sensible number of moves, and sharp bots win more often than chill ones
  const T = clock();
  let moves = 0, called = 0, sharpWin = 0, catches = 0; const N2 = 400;
  for (let g = 0; g < N2; g++) {
    const G = pp.create([], { seats: 4 }); T.add(5000); pp.tick(G, T.now);
    for (let i = 0; i < 20000 && G.ph === 'play'; i++) {
      T.add(400);
      if (G.open >= 0 && G.catcher >= 0) { pp.tick(G, T.now); continue; }
      if (G.turn >= 0) pp._bot(G, G.turn, T.now, G.turn % 2 ? 'sharp' : 'chill');
    }
    moves += G.mv; if (G.res.called) called++; else if (G.win % 2) sharpWin++;
    catches += G.st.reduce((a, x) => a + x.caught, 0);
  }
  T.done();
  console.log(`bots: ${(moves / N2).toFixed(0)} moves a game, ${called} called, sharp won ${sharpWin}/${N2}, ${(catches / N2).toFixed(2)} catches a game`);
  if (moves / N2 > 120 || called) fail('bot games drag on');
  if (sharpWin < N2 * .53) fail('sharp bots are not better than chill ones');
}
{ // the turn timer plays for you, and a player who leaves is played by a bot
  const T = clock();
  const G = pp.create(players, { seats: 2, timer: 20 });
  T.add(3000); pp.tick(G, T.now);
  if (G.stage !== 'play' || !G.tEnd) fail('deal did not finish or timer not set');
  const mv = G.mv; T.add(20100); pp.tick(G, T.now);
  if (G.mv === mv) fail('timer did not play the turn');
  pp.setAway(G, 0, true); pp.setAway(G, 1, true);
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { T.add(500); pp.tick(G, T.now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  T.done();
}

// ----- over the real server -----
const PORT = 22080 + (Math.random() * 900 | 0);
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
send({ t: 'create', game: 'parade', opts: { seats: 6, timer: 20, dice: 3 } });
await wait(300);
if (room?.game !== 'parade' || room.opts.seats !== 6 || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, bots: 'sharp', stack: 'on' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.bots !== 'sharp' || room.opts.stack !== 'on' || room.opts.timer !== 20) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'parade' || state.seats.length !== 2 || state.seats[state.me].hand?.length !== 7) bail('game did not start');
if (state.seats[1 - state.me].hand) bail('the server sent the other hand');
let turns = 0;
for (let i = 0; i < 4000 && state.ph === 'play'; i++) {
  if (state.stage !== 'deal' && state.turn === state.me) {
    if (state.seats[1 - state.me].hand) bail('saw the other hand');
    const hand = state.seats[state.me].hand, t = state.pile[state.pile.length - 1], mv = state.mv, stage = state.stage;
    if (hand.length === 2) send({ t: 'act', a: { t: 'call' } });
    const o = state.stage === 'drawn' ? [state.drawn] : playable(hand, t, state.col, state.owe);
    send({ t: 'act', a: o.length ? { t: 'play', c: o[0], col: 2 } : { t: 'draw' } }); turns++;
    for (let k = 0; k < 40 && state.mv === mv && state.stage === stage && state.ph === 'play'; k++) await wait(25);
  } else {
    if (state.open >= 0 && state.open !== state.me) send({ t: 'act', a: { t: 'catch' } });
    await wait(50);
  }
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins !== (me.gain.place === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', turns, 'turns,', state.win === state.me ? 'won' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

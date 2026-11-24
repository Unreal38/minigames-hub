// Wojna test: checks the decks and the battle rules, plays whole games on a fake clock (making sure no card is
// ever lost or copied and nobody is sent a face-down card or the order of a pile), then a table over the real
// WebSocket server.
import { spawn } from 'node:child_process';
import * as wojna from '../server/games/wojna.js';
import { deckFor, highest, seatsFor, rankOf } from '../public/games/wojna/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const C = (r, s = 0) => s * 13 + '23456789TJQKA'.indexOf(r);

// ----- rules -----
for (const kind of ['full', 'small']) for (const n of [2, 3, 4]) {
  const d = deckFor(kind, n);
  if (d.length % n || new Set(d).size !== d.length || d.length < (kind === 'full' ? 51 : 24) || (kind === 'small' && d.some(c => rankOf(c) < 7))) fail(`deck ${kind} for ${n} wrong`);
}
if (deckFor('full', 3).includes(C('2', 2)) || deckFor('full', 3).length !== 51) fail('three players leave out the two of clubs');
if (highest([[0, C('K')], [1, C('A', 2)], [2, C('3')]]).join() !== '1' || highest([[0, C('K')], [1, C('K', 3)], [2, C('3')]]).join() !== '0,1') fail('highest card wrong');
if (seatsFor(2, 1) !== 2 || seatsFor(2, 3) !== 3 || seatsFor(4, 2) !== 4 || seatsFor(9, 9) !== 4) fail('table sizes wrong');
{ const o = wojna.cleanOpts({ seats: 7, deck: 'x', rounds: 5, timer: 0 }); if (o.seats !== 2 || o.deck !== 'full' || o.rounds !== 60 || o.timer !== 5) fail('options not cleaned'); }

const clock = fn => { const realNow = Date.now; let now = realNow(); Date.now = () => now; try { return fn(ms => { now += ms; return now; }, () => now); } finally { Date.now = realNow; } };
const cardsOf = G => [...G.decks.flat(), ...G.tbl.flatMap(t => t.map(x => x.c))];

clock((step, at) => { // a plain battle, then a war with a face-down card each, then a player short of cards in a war
  const G = wojna.create(players, { seats: 2, rounds: 30 });
  if (wojna.act(G, 0, { t: 'flip' })) fail('flipped during the deal');
  G.decks = [[C('K'), C('5'), C('2'), C('9'), C('7'), C('3')], [C('4', 1), C('5', 1), C('A', 1), C('8', 1), C('7', 1)]]; G.total = 11;
  wojna.tick(G, step(2000));
  if (G.stage !== 'flip' || !G.need[0] || !G.need[1]) fail('battle did not open');
  if (wojna.act(G, 0, { t: 'dance' }) || wojna.act(G, 5, { t: 'flip' }) || wojna.act(G, 0, null)) fail('nonsense accepted');
  if (!wojna.act(G, 0, { t: 'flip' }) || wojna.act(G, 0, { t: 'flip' })) fail('one flip a battle');
  if (G.stage !== 'flip') fail('judged before everyone flipped');
  if (!wojna.act(G, 1, { t: 'flip' }) || G.stage !== 'show' || G.bw !== 0) fail('the king should beat the four');
  wojna.tick(G, step(wojna.MS.show + 10));
  if (G.rnd !== 1 || G.decks[0].length !== 7 || G.decks[1].length !== 4 || G.st[0].won !== 1) fail('winner did not take both cards');
  G.decks[0] = [C('5'), C('2'), C('9'), C('7'), C('3'), C('K'), C('4', 1)];
  wojna.act(G, 0, { t: 'flip' }); wojna.act(G, 1, { t: 'flip' });
  if (G.stage !== 'war' || G.war !== 1 || G.inn.join() !== '0,1') fail('equal fives should start a war');
  if (wojna.act(G, 0, { t: 'flip' })) fail('flipped before the war was called');
  wojna.tick(G, step(wojna.MS.war + 10));
  if (G.stage !== 'flip') fail('war cards not asked for');
  wojna.act(G, 0, { t: 'flip' }); wojna.act(G, 1, { t: 'flip' });
  if (G.tbl[0].map(x => x.up).join() !== 'true,false,true' || G.tbl[0][2].c !== C('9') || G.tbl[1][2].c !== C('8', 1)) fail('war puts one card face down and one face up');
  const v = wojna.view(G, 0);
  if (v.seats[0].tbl[1] !== -1 || v.seats[1].tbl[1] !== -1 || JSON.stringify(v).includes('"decks"')) fail('a face-down card or a pile was sent');
  if (G.stage !== 'show' || G.bw !== 0) fail('nine should win the war');
  wojna.tick(G, step(wojna.MS.showWar + 10));
  if (G.decks[0].length !== 10 || G.decks[1].length !== 1 || G.st[0].wars !== 1 || G.st[0].best !== 6) fail('war winner should take all six cards');
  // seat 1 has one card left: a war where it has nothing more to add keeps its card fighting
  G.decks[0] = [C('7'), C('2'), C('3'), ...G.decks[0].filter(c => ![C('7'), C('2'), C('3')].includes(c))]; G.decks[1] = [C('7', 1)];
  wojna.act(G, 0, { t: 'flip' }); wojna.act(G, 1, { t: 'flip' });
  if (G.stage !== 'war') fail('equal sevens should start a war');
  wojna.tick(G, step(wojna.MS.war + 10));
  if (G.need[1] || !G.need[0]) fail('a player with no cards cannot be asked to flip');
  wojna.act(G, 0, { t: 'flip' });
  if (G.stage !== 'show' || G.bw !== 1) fail('the seven on the table should beat the three');
  if (cardsOf(G).length !== 11 || new Set(cardsOf(G)).size !== 11) fail('cards lost in a war');
  // down to the last card in a war: it goes face up, nothing face down
  wojna.tick(G, step(wojna.MS.showWar + 10));
  G.decks = [[C('9'), C('4')], [C('9', 1), C('6', 1), C('2', 1)]]; G.total = 5;
  wojna.act(G, 0, { t: 'flip' }); wojna.act(G, 1, { t: 'flip' }); wojna.tick(G, step(wojna.MS.war + 10));
  wojna.act(G, 0, { t: 'flip' }); wojna.act(G, 1, { t: 'flip' });
  if (G.tbl[0].length !== 2 || !G.tbl[0][1].up || G.tbl[1].length !== 3 || G.bw !== 0) fail('a last card must be played face up');
  wojna.tick(G, step(wojna.MS.showWar + 10));
  if (G.ph !== 'end' || G.win !== 0 || G.res.capped || !G.out[1] || G.res.place.join() !== '1,2') fail('taking every card should end the game');
  const r = wojna.results(G);
  if (!r[0].win || r[1].win || r[0].place !== 1 || r[1].place !== 2 || r[0].pts !== 10 || r[1].pts !== 0) fail('results wrong');
});

clock(step => { // a tie nobody can break is settled by a coin; equal piles after the last battle play on
  const G = wojna.create(players, { seats: 2, rounds: 30 });
  G.decks = [[C('9')], [C('9', 1)]]; G.total = 2; wojna.tick(G, step(2000));
  wojna.act(G, 0, { t: 'flip' }); wojna.act(G, 1, { t: 'flip' });
  if (G.stage !== 'show' || !G.coin || G.bw < 0) fail('a tie with no cards left needs a coin toss');
  const H = wojna.create(players, { seats: 2, rounds: 30 });
  H.decks = [[C('9'), C('3'), C('K')], [C('4', 1), C('8', 1), C('5', 1)]]; H.total = 6; H.rnd = 28; wojna.tick(H, step(2000));
  for (let k = 0; k < 2; k++) { wojna.act(H, 0, { t: 'flip' }); wojna.act(H, 1, { t: 'flip' }); wojna.tick(H, step(wojna.MS.show + 10)); }
  if (H.ph !== 'play' || !H.extra || H.rnd !== 30) fail('equal piles after the last battle should play a tie-break');
  wojna.act(H, 0, { t: 'flip' }); wojna.act(H, 1, { t: 'flip' }); wojna.tick(H, step(wojna.MS.show + 10));
  if (H.ph !== 'end' || !H.res.capped || H.win !== 0 || H.res.left.join() !== '4,2') fail('the tie-break battle should decide the game');
});

// ----- whole games -----
function play(opts, people = players, human = true) {
  return clock((step, at) => {
    const G = wojna.create(people, opts), n = G.seats.length;
    if (n !== seatsFor(opts.seats, people.length) || G.decks.some(d => d.length !== G.total / n)) fail('seats or deal wrong');
    for (let i = 0; i < 200000 && G.ph === 'play'; i++) {
      step(60);
      const all = cardsOf(G);
      if (all.length !== G.total || new Set(all).size !== G.total) fail('cards lost or copied');
      for (let s = -1; s < n; s++) {
        const v = wojna.view(G, s), txt = JSON.stringify(v);
        if (txt.includes('"decks"') || txt.includes('"up"')) fail('pile order leaked in the view');
        v.seats.forEach((p, j) => { if (p.n !== G.decks[j].length) fail('pile count wrong'); p.tbl.forEach((c, k) => { if (!G.tbl[j][k].up && c !== -1) fail('a face-down card was sent'); }); });
      }
      if (human && G.stage === 'flip') for (let s = 0; s < n; s++) if (G.need[s] && G.seats[s].human && !G.seats[s].bot && Math.random() < .5 && !wojna.act(G, s, { t: 'flip' })) fail('flip refused');
      if (G.stage === 'flip') for (let s = 0; s < n; s++) if (!G.need[s] && wojna.act(G, s, { t: 'flip' })) fail('flipped twice or out of the battle');
      wojna.tick(G, at());
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = wojna.results(G);
    if (G.rnd > opts.rounds + wojna.EXTRA) fail('game ran past its cap');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 && G.rnd < opts.rounds + wojna.EXTRA) fail('there should be one winner');
    if (G.res.left[G.win] !== Math.max(...G.res.left)) fail('the biggest pile should win');
    if (G.res.left.reduce((a, b) => a + b, 0) !== G.total) fail('cards missing at the end');
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (G.res.left[i] > G.res.left[j] && r[i].place >= r[j].place) fail('places do not follow the piles');
    return G;
  });
}
const four = [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3] }];
for (const seats of [2, 3, 4]) for (const deck of ['full', 'small']) { const G = play({ seats, deck, rounds: 60 }); console.log(`${seats} seats, ${deck} deck: ${G.seats[G.win].name} wins with ${G.res.left[G.win]} of ${G.total} after ${G.rnd} battles`); }
for (let k = 0; k < 30; k++) { play({ seats: 4, deck: 'small', rounds: 120 }, four); play({ seats: 2, deck: 'small', rounds: 120 }); play({ seats: 3, deck: 'full', rounds: 30 }, four.slice(0, 3)); }
if (play({ seats: 2, rounds: 30 }, four).seats.length !== 4) fail('four people need four seats');

clock((step, at) => { // the timer turns the card for a player who waits, and a player who leaves is played by a bot
  const G = wojna.create(players, { seats: 2, timer: 3, rounds: 30 });
  wojna.tick(G, step(2000));
  step(2900); wojna.tick(G, at());
  if (!G.need[0] || !G.need[1]) fail('cards turned before the timer ran out');
  step(200); wojna.tick(G, at());
  if (G.stage === 'flip' && G.rnd === 0 && !G.war) fail('the timer did not turn the cards');
  wojna.setAway(G, 0, true); wojna.setAway(G, 1, true);
  for (let i = 0; i < 40000 && G.ph === 'play'; i++) { step(100); wojna.tick(G, at()); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
});
{ // bot tables: how long a game takes
  const out = clock((step, at) => {
    let secs = 0; const N = 200;
    for (let g = 0; g < N; g++) { const G = wojna.create([], { seats: 2, rounds: 60 }), t0 = at(); while (G.ph === 'play') { step(50); wojna.tick(G, at()); } secs += (at() - t0) / 1000; }
    return secs / N;
  });
  console.log(`bots: a 60-battle game takes about ${out.toFixed(0)} seconds`);
  if (out > 180) fail('games drag on');
}

// ----- over the real server -----
const PORT = 23080 + (Math.random() * 900 | 0);
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
send({ t: 'create', game: 'wojna', opts: { seats: 4, deck: 'small', rounds: 30, timer: 3, dice: 3 } });
await wait(300);
if (room?.game !== 'wojna' || room.opts.seats !== 4 || room.opts.deck !== 'small' || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.rounds !== 30 || room.opts.timer !== 3) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'wojna' || state.seats.length !== 2 || state.seats[state.me].n !== 12) bail('game did not start');
let flips = 0;
for (let i = 0; i < 4000 && state.ph === 'play'; i++) {
  if (JSON.stringify(state).includes('"decks"')) bail('the server sent a pile');
  if (state.stage === 'flip' && state.seats[state.me].need) { const mv = state.mv; send({ t: 'act', a: { t: 'flip' } }); flips++; for (let k = 0; k < 40 && state.mv === mv && state.ph === 'play'; k++) await wait(20); }
  else await wait(40);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
const place = state.res.place[state.me];
if (!me?.gain || me.gain.place !== place || me.gain.coins !== (place === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', flips, 'flips,', state.res.rounds, 'battles,', place === 1 ? 'won' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

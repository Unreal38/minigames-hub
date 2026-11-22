// Pawperty test: checks the board, plays whole games on a fake clock (money never goes below zero, nobody is
// knocked out, palaces only on whole streets), walks through the special rules with chosen dice, then plays a
// table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as pw from '../server/games/paw.js';
import { N, TILES, SHOP_TILES, STREET, GROUPS, CARDS, BATH, MUD, LOST, START, PASS_GO, START_CASH, BATH_FEE, VET_FEE, LV_MAX, rentOf, fullStreet, cellOf } from '../public/games/paw/board.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- the board -----
if (TILES.length !== N || SHOP_TILES.length !== 24 || STREET.length !== GROUPS.length || STREET.some(s => s.length !== 3)) fail('board layout wrong');
if (new Set(TILES.map((_, i) => cellOf(i).join())).size !== N) fail('two tiles share a cell');
if (TILES[START].k !== 'start' || TILES[BATH].k !== 'bath' || TILES[LOST].k !== 'lost' || TILES[MUD].k !== 'mud') fail('corners wrong');
for (const i of SHOP_TILES) { const t = TILES[i]; if (!(t.rent[0] < t.rent[1] && t.rent[1] < t.rent[2] && t.rent[2] * 2 < t.rent[3]) || t.up <= 0 || !t.pet) fail('rents must rise with every upgrade: ' + t.name); }
if (new Set(SHOP_TILES.map(i => TILES[i].pet)).size !== 24) fail('every shop needs its own pet');
{ const own = Array(N).fill(-1), lv = Array(N).fill(0), [a, b, c] = STREET[0];
  own[a] = 0; if (rentOf(a, own, lv) !== TILES[a].rent[0] || rentOf(b, own, lv) !== 0) fail('plain rent wrong');
  own[b] = own[c] = 0; if (!fullStreet(0, 0, own) || rentOf(a, own, lv) !== TILES[a].rent[0] * 2) fail('whole street should double the rent');
  lv[a] = 3; if (rentOf(a, own, lv) !== TILES[a].rent[3]) fail('palace rent wrong'); }

// ----- whole games on a fake clock -----
const realNow = Date.now;
function play(opts, humanPlays = true) {
  let now = realNow(); Date.now = () => now;
  try {
    const G = pw.create(players, opts), n = G.seats.length;
    if (n !== (opts.seats || 4)) fail('seats not filled with bots');
    if (G.seats.some(s => s.cash !== START_CASH || s.pos !== START)) fail('bad start');
    const cards = new Set(); let turns = 0, lastTurn = -1;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 60;
      const s = G.turn, seat = G.seats[s];
      if (humanPlays && seat.human && !seat.bot && ['roll', 'buy', 'done'].includes(G.stage)) {
        const other = (s + 1) % n;
        if (G.seats[other].human && pw.act(G, other, { t: 'roll' })) fail('acted out of turn');
        if (pw.act(G, s, { t: 'dance' }) || pw.act(G, s, { t: 'build', i: 0 }) || pw.act(G, s, null)) fail('nonsense accepted');
        if (G.stage === 'roll') { if (pw.act(G, s, { t: 'buy' }) || pw.act(G, s, { t: 'end' })) fail('bought or ended before rolling'); if (seat.inBath && seat.cash > 200) pw.act(G, s, { t: 'pay' }); if (!pw.act(G, s, { t: 'roll' })) fail('roll refused'); }
        else if (G.stage === 'buy') { if (!pw.act(G, s, { t: seat.cash - TILES[G.offer].price > 80 ? 'buy' : 'pass' })) fail('buy or pass refused'); }
        else { const can = pw._buildable(G, s); if (can.length && seat.cash > 250) { const lv = G.lv[can[0]]; if (!pw.act(G, s, { t: 'build', i: can[0] }) || G.lv[can[0]] !== lv + 1) fail('upgrade refused'); } if (!pw.act(G, s, { t: 'end' })) fail('end turn refused'); }
      } else pw.tick(G, now);
      if (G.turn !== lastTurn) { lastTurn = G.turn; turns++; }
      if (G.card) cards.add(G.card.id);
      // things that must always hold
      for (const [k, p] of G.seats.entries()) {
        if (!(p.cash >= 0) || !Number.isFinite(p.cash)) fail(`seat ${k} has ${p.cash} treats`);
        if (p.pos < 0 || p.pos >= N) fail('token off the board');
        if (p.inBath && p.pos !== BATH) fail('in the bath but not on the bath tile');
      }
      for (const t of SHOP_TILES) {
        if (G.own[t] < -1 || G.own[t] >= n || G.lv[t] < 0 || G.lv[t] > LV_MAX) fail('bad shop state');
        if (G.own[t] < 0 && (G.lv[t] || G.nap[t])) fail('an empty shop has upgrades or a napping pet');
        if (G.lv[t] === LV_MAX && !fullStreet(TILES[t].g, G.own[t], G.own)) fail('a palace without the whole street');
      }
      if (G.jar < 0) fail('negative jar');
      const v = pw.view(G, 0); if (v.seats.length !== n || v.own.length !== N) fail('view broken');
    }
    if (G.ph !== 'end') fail('game did not finish: stuck in ' + G.stage);
    const res = pw.results(G), w = G.res.worth;
    if (res.length !== n || res.filter(r => r.win).length !== 1) fail('results wrong');
    if (w[G.win] !== Math.max(...w) || !res[G.win].win || res[G.win].place !== 1) fail('the richest player did not win');
    if (new Set(res.map(r => r.place)).size !== n) fail('places must run 1..n');
    G.seats.forEach((_, k) => { if (pw._worth(G, k) !== w[k]) fail('worth does not add up'); });
    return { G, turns, cards, mins: (now - realNow()) / 60000 };
  } finally { Date.now = realNow; }
}
const seen = new Set(); let builds = 0, sold = 0;
for (const opts of [{ seats: 2, rounds: 10 }, { seats: 4, rounds: 20, bots: 'sharp' }, { seats: 6, rounds: 20 }, { seats: 3, rounds: 30, naps: 'off', bots: 'sharp' }, { seats: 4, rounds: 10, timer: 20 }]) {
  for (let k = 0; k < 6; k++) {
    const r = play(opts, k % 2 === 0);
    for (const c of r.cards) seen.add(c);
    builds += r.G.lv.reduce((a, b) => a + b, 0); sold += r.G.ev.filter(e => e.t === 'sell').length;
    if (opts.naps === 'off' && r.G.nap.some(Boolean) && !r.cards.has('yawn')) fail('pets napped with naps off');
    if (k === 0) console.log(`OK ${opts.seats} players, ${opts.rounds} rounds${opts.bots ? ', sharp bots' : ''}: ${r.turns} turns, about ${r.mins.toFixed(1)} min of bot play, ${r.G.own.filter(o => o >= 0).length} shops adopted`);
  }
}
if (seen.size < Object.keys(CARDS).length) fail('some Zoomies cards never came up: ' + Object.keys(CARDS).filter(c => !seen.has(c)));
if (!builds) fail('nobody ever upgraded a shop');
console.log(`OK all ${seen.size} Zoomies cards came up, ${builds} upgrades standing at the end`);

// ----- rules, with chosen dice -----
{
  let now = realNow(); Date.now = () => now;
  const G = pw.create(players, { seats: 2, rounds: 30, naps: 'off', timer: 0 });
  const run = (until, max = 4000) => { for (let i = 0; i < max && !until(); i++) { now += 50; if (G.stage === 'done') pw.act(G, G.turn, { t: 'end' }); else if (G.stage === 'buy') pw.act(G, G.turn, { t: 'pass' }); pw.tick(G, now); } if (!until()) fail('rules walk-through got stuck in ' + G.stage); };
  const s = G.turn, o = 1 - s, A = G.seats[s], B = G.seats[o];
  const myRoll = (who, d) => { run(() => G.turn === who && G.stage === 'roll'); pw._roll(G, who, now, d); };
  // 1 + 2 = tile 3: a shop. It is offered, and adopting costs its price.
  myRoll(s, [1, 2]); run(() => G.stage === 'buy');
  if (G.offer !== 3 || TILES[3].k !== 'shop') fail('landing on a free shop should offer it');
  if (pw.act(G, o, { t: 'buy' })) fail('the other player bought my shop');
  if (!pw.act(G, s, { t: 'buy' }) || G.own[3] !== s || A.cash !== START_CASH - TILES[3].price) fail('adopting went wrong');
  run(() => G.turn === o && G.stage === 'roll');
  // the other player lands on it and pays rent
  const before = [A.cash, B.cash];
  pw._roll(G, o, now, [1, 2]); run(() => G.turn === s && G.stage === 'roll');
  if (B.cash !== before[1] - TILES[3].rent[0] || A.cash !== before[0] + TILES[3].rent[0]) fail('rent not paid');
  // upgrades: bed and toy box on a single shop, no palace without the street
  if (!pw.act(G, s, { t: 'build', i: 3 }) || !pw.act(G, s, { t: 'build', i: 3 }) || G.lv[3] !== 2) fail('could not build a bed and a toy box');
  if (pw.act(G, s, { t: 'build', i: 3 })) fail('built a palace without the whole street');
  if (pw.act(G, s, { t: 'build', i: 4 })) fail('upgraded a shop that is not mine');
  // a napping pet charges nothing
  G.nap[3] = true; B.pos = 0; A.pos = BATH;
  pw._roll(G, s, now, [1, 3]); run(() => G.stage === 'buy' || (G.turn === o && G.stage === 'roll')); if (G.stage === 'buy') pw.act(G, s, { t: 'pass' });
  run(() => G.turn === o && G.stage === 'roll');
  const c0 = B.cash; pw._roll(G, o, now, [1, 2]); run(() => G.turn === s && G.stage === 'roll');
  if (B.cash !== c0) fail('rent was charged while the pet was napping');
  G.nap[3] = false;
  // three doubles in a row: off to the bath, and the turn passes
  A.pos = BATH; G.own[BATH + 2] = G.own[BATH + 4] = o; // land on the other player's shops so nothing is offered
  pw._roll(G, s, now, [1, 1]); run(() => G.turn === s && G.stage === 'roll'); if (G.dbl !== 1) fail('doubles should roll again');
  pw._roll(G, s, now, [1, 1]); run(() => G.turn === s && G.stage === 'roll');
  pw._roll(G, s, now, [2, 2]); run(() => G.turn === o && G.stage === 'roll');
  if (!A.inBath || A.pos !== BATH) fail('three doubles should end in the bath');
  // while the owner is in the tub their pets nap: no rent, and the view shows them asleep
  { if (!A.inBath || G.own[3] !== s || !pw.view(G, o).nap[3]) fail('pets should nap while their owner is in the tub');
    B.pos = 0; const cb = B.cash; pw._roll(G, o, now, [1, 2]); run(() => G.turn === s && G.stage === 'roll'); if (B.cash !== cb) fail('rent was charged while the owner was in the tub'); }
  pw._roll(G, s, now, [1, 2]); if (G.stage !== 'stay') fail('should stay in the tub without doubles');
  run(() => G.turn === o && G.stage === 'roll'); if (!A.inBath || A.pos !== BATH || A.tries !== 1) fail('left the tub without doubles');
  pw._roll(G, o, now, [1, 2]); run(() => G.turn === s && (G.stage === 'roll' || G.stage === 'buy')); if (G.stage === 'buy') pw.act(G, o, { t: 'pass' });
  run(() => G.turn === s && G.stage === 'roll');
  // paying gets you out, and the fee lands in the jar
  const jar = G.jar, c1 = A.cash;
  if (!pw.act(G, s, { t: 'pay' }) || A.inBath || A.cash !== c1 - BATH_FEE || G.jar !== jar + BATH_FEE) fail('paying out of the bath went wrong');
  if (pw.act(G, s, { t: 'pay' })) fail('paid the bath fee twice');
  // the Vet (just before the Lost & Found) fills the jar; the Lost & Found corner empties it
  A.pos = LOST - 3; pw._roll(G, s, now, [1, 1]); run(() => G.stage !== 'walk');
  if (A.pos !== LOST - 1 || TILES[A.pos].k !== 'vet' || G.jar !== jar + BATH_FEE + VET_FEE) fail('vet fee did not go in the jar');
  run(() => G.turn === s && G.stage === 'roll');
  A.pos = LOST - 5; const jar2 = G.jar, c2 = A.cash; pw._roll(G, s, now, [2, 3]); run(() => G.turn === o && G.stage === 'roll');
  if (A.pos !== LOST || G.jar !== 0 || A.cash !== c2 + jar2) fail('the Lost & Found jar was not handed over');
  // the Muddy Puddle sends you to the bath; passing the Welcome Mat pays
  B.pos = MUD - 3; pw._roll(G, o, now, [1, 2]); run(() => G.turn === s && G.stage === 'roll');
  if (!B.inBath || B.pos !== BATH) fail('the muddy puddle should lead to the bath');
  A.pos = N - 2; A.inBath = false; const c3 = A.cash; G.own[1] = o; G.nap[1] = true;
  pw._roll(G, s, now, [1, 2]); run(() => G.turn === o && G.stage === 'roll');
  if (A.pos !== 1 || A.cash !== c3 + PASS_GO) fail('passing the Welcome Mat should pay ' + PASS_GO);
  // nobody is knocked out: a broke player sells back at half price and is let off the rest
  G.nap.fill(false); B.inBath = false; B.cash = 5; G.own.fill(-1); G.lv.fill(0); G.own[1] = o; G.own[3] = s; G.lv[3] = 2; B.pos = 0;
  const c4 = A.cash; pw._roll(G, o, now, [1, 2]); run(() => G.turn === s && G.stage === 'roll');
  const paid = 5 + TILES[1].price / 2;
  if (G.own[1] !== -1 || B.cash !== Math.max(0, paid - TILES[3].rent[2]) || A.cash !== c4 + Math.min(paid, TILES[3].rent[2])) fail('a broke player should sell up and pay what they can');
  if (G.ph !== 'play' || B.cash < 0) fail('a broke player must stay in the game');
  // the timer plays for a player who is not looking, and a watcher gets a bot's seat at the next round
  const H = pw.create([players[0]], { seats: 3, rounds: 30, timer: 20 });
  for (let i = 0; i < 4000 && !(H.turn === 0 && H.stage === 'roll'); i++) { now += 50; pw.tick(H, now); }
  const n0 = H.rollN; now += 20100; pw.tick(H, now); if (H.rollN === n0) fail('the timer did not roll');
  pw.seatWatcher(H, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] });
  if (H.seats.some(x => x.id === 'c')) fail('watcher seated in the middle of a round');
  const r0 = H.round; for (let i = 0; i < 40000 && H.round === r0; i++) { now += 50; pw.tick(H, now); }
  if (!H.seats.some(x => x.id === 'c' && x.human && !x.bot)) fail('watcher was not seated at the new round');
  Date.now = realNow;
  console.log('OK rules: adopt, rent, upgrades, naps, doubles, bath, jar, puddle, Welcome Mat, going broke, timer, watcher');
}

// ----- over the real server (waits are 25 times shorter) -----
const PORT = 22080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}`, PAW_FAST: '25' }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'paw', opts: { seats: 6, rounds: 30, naps: 'off', timer: 20, size: 'huge' } });
await wait(300);
if (room?.game !== 'paw' || room.opts.seats !== 6 || room.opts.naps !== 'off' || 'size' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 3, rounds: 10 } }); await wait(200);
if (room.opts.seats !== 3 || room.opts.rounds !== 10 || room.opts.naps !== 'off' || room.opts.timer !== 20) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'paw' || state.seats.length !== 3 || state.seats[state.me].cash !== START_CASH || state.own.length !== N) bail('game did not start');
let acts = 0;
for (let i = 0; i < 2500 && state.ph === 'play'; i++) {
  if (state.turn === state.me && ['roll', 'buy', 'done'].includes(state.stage)) {
    const a = state.stage === 'roll' ? { t: 'roll' } : state.stage === 'buy' ? { t: 'buy' } : state.can.length ? { t: 'build', i: state.can[0] } : { t: 'end' };
    const key = state.stage + state.can.length + (state.roll?.n || 0) + '/' + state.seats[state.me].cash;
    send({ t: 'act', a }); acts++;
    for (let k = 0; k < 40 && state.ph === 'play' && state.turn === state.me && state.stage + state.can.length + (state.roll?.n || 0) + '/' + state.seats[state.me].cash === key; k++) await wait(10);
  } else await wait(15);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins < 1) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', acts, 'moves,', state.win === state.me ? 'won' : 'came ' + (state.res.order.indexOf(state.me) + 1), '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

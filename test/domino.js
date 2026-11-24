// Dominoes test: checks the tile rules and the picture of the line (no two tiles may ever overlap), plays whole
// matches on a fake clock (making sure nobody is sent another hand during a round and all 28 tiles are always
// accounted for), then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as dom from '../server/games/domino.js';
import { TILES, tileId, isDouble, pipsOf, handPips, handSize, sides, playable, place, opener, ends, layout, footprint } from '../public/games/domino/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const T = tileId;

// ----- rules -----
if (TILES.length !== 28 || new Set(TILES.map(t => t.join())).size !== 28 || TILES.reduce((s, t) => s + t[0] + t[1], 0) !== 168) fail('set wrong');
if (T(6, 6) !== 27 || T(2, 5) !== T(5, 2) || !isDouble(T(3, 3)) || isDouble(T(3, 4)) || pipsOf(T(5, 6)) !== 11 || handPips([T(1, 2), T(6, 6)]) !== 15) fail('tile helpers wrong');
if (handSize(2) !== 7 || handSize(3) !== 5 || handSize(4) !== 5) fail('hand sizes wrong');
{
  let c = [], f = 0;
  if (sides(c, T(2, 3)) !== 'r' || sides(c, 99) !== '' || sides(c, '3') !== '') fail('empty table wrong');
  ({ chain: c, first: f } = place(c, f, T(2, 3), 'r'));
  if (ends(c).join() !== '2,3' || sides(c, T(2, 6)) !== 'l' || sides(c, T(3, 5)) !== 'r' || sides(c, T(2, 3)) !== 'lr' || sides(c, T(4, 4)) !== '') fail('matching wrong');
  if (place(c, f, T(3, 5), 'l') || place(c, f, T(4, 4), 'r') || place(c, f, T(3, 5), 'x')) fail('a tile went where it does not fit');
  ({ chain: c, first: f } = place(c, f, T(3, 5), 'r'));
  ({ chain: c, first: f } = place(c, f, T(2, 2), 'l'));
  ({ chain: c, first: f } = place(c, f, T(6, 2), 'l'));
  if (ends(c).join() !== '6,5' || f !== 2 || c.length !== 4) fail('line ends wrong: ' + JSON.stringify(c));
  for (let i = 1; i < c.length; i++) if (c[i - 1].b !== c[i].a) fail('neighbours do not match');
  if (playable(c, [T(1, 1), T(6, 6), T(0, 5)]).length !== 2) fail('playable wrong');
  const o = opener([[T(1, 2), T(3, 3)], [T(5, 5), T(0, 0)], [T(5, 6)]]);
  if (o.s !== 1 || o.t !== T(5, 5)) fail('the highest double must open');
  const o2 = opener([[T(1, 2)], [T(5, 6)], [T(4, 6)]]);
  if (o2.s !== 1 || o2.t !== T(5, 6)) fail('with no doubles the heaviest tile opens');
}
{ // the picture of the line: random lines of every length at every table width never overlap, and neighbours touch
  let worst = 0;
  for (const [W, V] of [[4, 3], [4, 2], [6.5, 2], [8, 3]]) for (let g = 0; g < 1200; g++) {
    let d = TILES.map((_, i) => i).sort(() => Math.random() - .5), chain = [], first = 0; const bias = Math.random();
    for (;;) {
      const opts = d.filter(t => sides(chain, t)); if (!opts.length) break;
      const t = opts[Math.random() * opts.length | 0], s = sides(chain, t);
      ({ chain, first } = place(chain, first, t, s.length === 2 ? (Math.random() < bias ? 'l' : 'r') : s)); d = d.filter(x => x !== t);
    }
    const { tiles, endL, endR } = layout(chain, first, W, V), fp = tiles.map(footprint), e = .01;
    if (tiles.length !== chain.length || tiles.some(o => !o) || !endL || !endR) fail('layout lost a tile');
    for (let i = 0; i < fp.length; i++) {
      worst = Math.max(worst, Math.abs(fp[i][1]), Math.abs(fp[i][3]));
      if (fp[i][0] < -W - 1.01 || fp[i][2] > W + 1.01) fail('a tile left the table sideways');
      for (let j = i + 1; j < fp.length; j++) { const a = fp[i], b = fp[j]; if (a[0] < b[2] - e && b[0] < a[2] - e && a[1] < b[3] - e && b[1] < a[3] - e) fail(`tiles ${i} and ${j} overlap at width ${W}`); }
      if (i) { const a = fp[i - 1], b = fp[i]; if (a[0] > b[2] + e || b[0] > a[2] + e || a[1] > b[3] + e || b[1] > a[3] + e) fail('neighbours in the line do not touch'); }
    }
    for (const end of [endL, endR]) { const b = footprint({ ...end, dbl: false }); for (const a of fp) if (a[0] < b[2] - e && b[0] < a[2] - e && a[1] < b[3] - e && b[1] < a[3] - e) fail('the next spot is already taken'); }
  }
  console.log('layout ok, deepest line reaches', worst, 'half-tiles from the middle');
}

// ----- whole matches -----
function play(opts, human = (G, s, now) => dom._bot(G, s, now, 'chill'), people = players) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = dom.create(people, opts), n = G.seats.length;
    if (n !== Math.max(opts.seats || 4, people.length) || G.hands.some(h => h.length !== handSize(n)) || G.pile.length !== 28 - n * handSize(n)) fail('seats or deal wrong');
    if (G.must < 0 || !G.hands[G.turn].includes(G.must)) fail('the opener must hold the opening tile');
    if (dom.act(G, G.turn, { t: 'play', tile: G.must }) && G.seats[G.turn]?.human) fail('played during the deal');
    let rounds = 0, lastRound = 0;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 100;
      const all = [...G.pile, ...G.chain.map(e => e.t), ...G.hands.flat()];
      if (all.length !== 28 || new Set(all).size !== 28) fail('tiles lost or copied');
      for (let k = 1; k < G.chain.length; k++) if (G.chain[k - 1].b !== G.chain[k].a) fail('the line does not match');
      for (const e of G.chain) { const [x, y] = TILES[e.t]; if (!((e.a === x && e.b === y) || (e.a === y && e.b === x))) fail('a tile changed its numbers'); }
      if (G.chain.length && (G.first < 0 || G.first >= G.chain.length)) fail('first tile lost');
      if (G.round !== lastRound) { lastRound = G.round; rounds++; }
      for (let s = -1; s < n; s++) { // nobody may see another hand while a round is on
        const v = dom.view(G, s), open = G.stage === 'round';
        v.seats.forEach((p, j) => { if (!open && j !== s && p.hand) fail(`seat ${s} was sent seat ${j}'s hand`); if (j === s && p.hand.length !== p.n) fail('own hand missing'); });
        if (!open && v.rd) fail('round count shown early');
        if (v.last?.got !== undefined && v.last.s !== s) fail('someone else saw the drawn tile');
        const txt = JSON.stringify(v); if (txt.includes('"hands"') && !open) fail('hands leaked in the view'); if (txt.includes('"pile":[')) fail('the pile leaked');
      }
      const s = G.turn;
      if (G.stage === 'play' && s >= 0 && G.seats[s].human && !G.seats[s].bot && !G.passAt) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && (dom.act(G, other, { t: 'draw' }) || dom.act(G, other, { t: 'play', tile: G.hands[other][0], side: 'r' }))) fail('acted out of turn');
        if (dom.act(G, s, { t: 'play', tile: G.hands[(s + 1) % n][0] ?? 99, side: 'r' }) || dom.act(G, s, { t: 'play' }) || dom.act(G, s, { t: 'dance' }) || dom.act(G, s, { t: 'pass' })) fail('nonsense accepted');
        const can = playable(G.chain, G.hands[s]);
        if (can.length && dom.act(G, s, { t: 'draw' })) fail('drew while holding a tile that fits');
        if (!can.length && !G.pile.length) fail('a stuck player with an empty pile should pass by itself');
        const bad = G.hands[s].find(t => !sides(G.chain, t)); if (bad !== undefined && dom.act(G, s, { t: 'play', tile: bad, side: 'l' })) fail('a tile that does not fit was accepted');
        const mv = G.mv; human(G, s, now);
        if (G.mv === mv) fail('human move refused');
      } else dom.tick(G, now);
    }
    if (G.ph !== 'end') fail('match did not end');
    const r = dom.results(G), to = dom.cleanOpts(opts).to;
    if (to && Math.max(...G.score) < to && G.round < dom.MAX_ROUNDS) fail('match ended early');
    if (!to && rounds !== 1) fail('a single round match played ' + rounds + ' rounds');
    if (new Set(G.res.order).size !== n || (G.win >= 0 && (G.res.order[0] !== G.win || r[G.win].place !== 1 || !r[G.win].win))) fail('bad final order');
    if (r.filter(x => x.win).length > 1 || r.some((x, i) => x.pts !== G.score[i]) || !r.some(x => x.place === 1)) fail('results disagree');
    for (let k = 1; k < n; k++) if (G.score[G.res.order[k - 1]] < G.score[G.res.order[k]] || r[G.res.order[k - 1]].place > r[G.res.order[k]].place) fail('placing order wrong');
    return G;
  } finally { Date.now = realNow; }
}
for (const seats of [2, 3, 4]) for (const to of [0, 50, 100]) { const G = play({ seats, to }); console.log(`${seats} seats to ${to || 'one round'}: ${G.win >= 0 ? G.seats[G.win].name + ' wins' : 'level'} ${G.score.join(':')} after ${G.round} round${G.round === 1 ? '' : 's'}`); }
play({ seats: 4, bots: 'sharp', timer: 0 });
for (let k = 0; k < 30; k++) play({ seats: 2 + k % 3, to: 50 }, (G, s) => { // a human who plays the first tile that fits, on the left when there is a choice
  const t = playable(G.chain, G.hands[s]).find(x => G.must < 0 || x === G.must);
  if (!dom.act(G, s, t === undefined ? { t: 'draw' } : { t: 'play', tile: t, side: sides(G.chain, t)[0] })) fail('move refused');
});

{ // scoring: going out scores every pip left; a blocked line goes to the lightest hand for the difference; level = nobody
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let G = dom.create(players, { seats: 2, to: 100, timer: 0 });
  G.hands = [[T(1, 2)], [T(3, 4), T(6, 6)]]; G.pile = []; G.chain = [{ t: T(2, 2), a: 2, b: 2 }]; G.must = -1; G.turn = 0; now += 3000; dom.tick(G, now); G.turn = 0;
  if (!dom.act(G, 0, { t: 'play', tile: T(1, 2), side: 'l' })) fail('going out refused');
  if (G.stage !== 'round' || G.rd.w !== 0 || G.rd.pts !== 19 || G.score[0] !== 19 || G.lead !== 0) fail('going out scored wrong: ' + JSON.stringify(G.rd));
  if (!dom.view(G, 0).seats[1].hand) fail('hands should be shown at the count');
  now += dom.MS.round + 10; dom.tick(G, now);
  if (G.stage !== 'deal' || G.round !== 2 || G.turn !== 0 || G.must !== -1) fail('the winner should open the next round with any tile');
  G = dom.create(players, { seats: 2, to: 100, timer: 0 });
  G.hands = [[T(0, 1)], [T(3, 4), T(0, 0)]]; G.pile = []; G.chain = [{ t: T(6, 6), a: 6, b: 6 }]; G.must = -1; G.turn = 0; now += 3000; dom.tick(G, now);
  for (let i = 0; i < 100 && G.stage === 'play'; i++) { now += 500; dom.tick(G, now); }
  if (G.stage !== 'round' || !G.rd.blocked || G.rd.w !== 0 || G.rd.pts !== 6) fail('blocked line scored wrong: ' + JSON.stringify(G.rd));
  if (!G.lack[0].includes(6) || !G.lack[1].includes(6)) fail('passes not noted');
  G = dom.create(players, { seats: 2, to: 0, timer: 0 });
  G.hands = [[T(0, 3)], [T(1, 2)]];
  G.pile = []; G.chain = [{ t: T(6, 6), a: 6, b: 6 }]; G.must = -1; G.turn = 0; now += 3000; dom.tick(G, now);
  for (let i = 0; i < 100 && G.ph === 'play'; i++) { now += 500; dom.tick(G, now); }
  if (G.ph !== 'end' || G.rd.w !== -1 || G.win !== -1 || !G.res.tie || dom.results(G).some(r => r.place !== 1 || r.win)) fail('a level blocked round should have no winner');
  Date.now = realNow;
}
{ // bot tables: rounds are a sensible length, and sharp bots win more matches than chill ones
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let moves = 0, rounds = 0, sharp = 0, blocked = 0; const N = 600;
  for (let g = 0; g < N; g++) {
    const G = dom.create([], { seats: 4, to: 100 });
    while (G.ph === 'play') {
      now += 10000; if (G.stage !== 'play' || G.passAt) { const r = G.round; dom.tick(G, now); if (G.rd?.blocked && G.stage !== 'play' && G.round === r) blocked++; continue; }
      dom._bot(G, G.turn, now, G.turn % 2 ? 'sharp' : 'chill'); moves++;
    }
    rounds += G.round; if (G.win % 2 === 1) sharp++;
  }
  Date.now = realNow;
  console.log(`bots: ${(moves / rounds).toFixed(0)} moves a round, ${(rounds / N).toFixed(1)} rounds a match to 100, sharp won ${sharp}/${N}`);
  if (moves / rounds > 60 || rounds / N > 12) fail('bot matches drag on');
  if (sharp < N * .56) fail('sharp bots are not better than chill ones');
}
{ // the turn timer plays for you (drawing as long as it has to), and a player who leaves is played by a bot
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = dom.create(players, { seats: 2, timer: 20, to: 50 });
  now += 3000; dom.tick(G, now);
  if (G.stage !== 'play' || !G.tEnd) fail('deal did not finish or timer not set');
  const s = G.turn; now += 20100; dom.tick(G, now);
  if (G.turn === s || G.st[s].auto < 1) fail('timer did not play the turn');
  dom.setAway(G, 0, true); dom.setAway(G, 1, true);
  for (let i = 0; i < 40000 && G.ph === 'play'; i++) { now += 500; dom.tick(G, now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  Date.now = realNow;
}
console.log('OK rules and matches');

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
send({ t: 'create', game: 'domino', opts: { seats: 4, timer: 20, to: 50, dice: 3 } });
await wait(300);
if (room?.game !== 'domino' || room.opts.seats !== 4 || room.opts.to !== 50 || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, to: 0, bots: 'sharp' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.to !== 0 || room.opts.bots !== 'sharp' || room.opts.timer !== 20) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'domino' || state.seats.length !== 2 || state.seats[state.me].hand?.length !== 7 || state.pile !== 14) bail('game did not start');
if (state.seats[1 - state.me].hand) bail('the server sent the other hand');
let turns = 0;
for (let i = 0; i < 3000 && state.ph === 'play'; i++) {
  if (state.stage === 'play' && state.turn === state.me && !state.passing) {
    if (state.seats[1 - state.me].hand) bail('saw the other hand');
    const hand = state.seats[state.me].hand, t = hand.find(x => (state.must < 0 || x === state.must) && sides(state.chain, x)), mv = state.mv;
    send({ t: 'act', a: t === undefined ? { t: 'draw' } : { t: 'play', tile: t, side: sides(state.chain, t)[0] } }); turns++;
    for (let k = 0; k < 40 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
  } else await wait(50);
}
if (state.ph !== 'end') bail('game over the server did not finish');
if (!state.rd || !state.seats.every(p => Array.isArray(p.hand))) bail('hands should be shown at the end');
await wait(300);
const myPlace = state.res.places[state.me];
if (!me?.gain || me.gain.coins !== (myPlace === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', turns, 'turns,', state.win === state.me ? 'won' : state.win < 0 ? 'level' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

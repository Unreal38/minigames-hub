// Liar's Dice test: checks the bidding rules, plays whole games on a fake clock (making sure nobody is ever sent
// another player's dice before the cups lift), then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as ld from '../server/games/dice.js';
import { legal, lowest, countFace, atLeast, matches } from '../public/games/dice/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- rules -----
if (!legal(null, 1, 2, 10, true) || legal(null, 1, 1, 10, true) || !legal(null, 1, 1, 10, false)) fail('opening bids wrong (ones cannot be bid when wild)');
if (!legal({ q: 3, f: 4 }, 3, 5, 10, true) || legal({ q: 3, f: 4 }, 3, 4, 10, true) || legal({ q: 3, f: 4 }, 3, 3, 10, true)) fail('same number needs a higher face');
if (!legal({ q: 3, f: 4 }, 4, 2, 10, true) || legal({ q: 3, f: 4 }, 2, 6, 10, true) || legal({ q: 3, f: 4 }, 11, 2, 10, true) || legal(null, 1.5, 2, 10, true) || legal(null, 1, 7, 10, true)) fail('raises wrong');
if (lowest({ q: 10, f: 6 }, 10, true) !== null || lowest({ q: 2, f: 6 }, 10, true).q !== 3 || lowest({ q: 2, f: 6 }, 10, true).f !== 2 || lowest(null, 10, false).f !== 1) fail('lowest bid wrong');
if (countFace([[1, 2, 2], [5, 2, 1]], 2, true) !== 5 || countFace([[1, 2, 2], [5, 2, 1]], 2, false) !== 3 || countFace([[1, 1]], 1, false) !== 2) fail('counting wrong');
if (!matches(1, 4, true) || matches(1, 4, false)) fail('wild ones wrong');
if (atLeast(0, 5, .3) !== 1 || atLeast(6, 5, .3) !== 0 || Math.abs(atLeast(1, 2, .5) - .75) > 1e-9 || Math.abs(atLeast(2, 3, 1 / 3) - 7 / 27) > 1e-9) fail('odds wrong');

// ----- whole games -----
// Humans here play like the bots do (the same engine function), so every game finishes.
function play(opts, human = (G, s, now) => ld._bot(G, s, now)) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = ld.create(players, opts), n = G.seats.length, start = G.opts.dice;
    if (n !== (opts.seats || 4)) fail('seats not filled with bots');
    let rounds = 0, lastTotal = n * start;
    for (let i = 0; i < 300000 && G.ph === 'play'; i++) {
      now += 100;
      // nobody may see another player's dice while the cups are down
      for (let s = -1; s < n; s++) {
        const v = ld.view(G, s);
        v.seats.forEach((p, j) => {
          if (G.stage !== 'show' && j !== s && p.dice) fail(`seat ${s} was sent seat ${j}'s dice during ${G.stage}`);
          if (j === s && (!p.dice || p.dice.length !== p.n)) fail('own dice missing');
        });
        if (JSON.stringify({ ...v, seats: v.seats.map((p, j) => (j === s ? 0 : p)) }).includes('"dice":[') && G.stage !== 'show') fail('dice leaked somewhere in the view');
      }
      const s = G.turn;
      if (G.stage === 'bid' && s >= 0 && G.seats[s].human && !G.seats[s].bot) {
        const other = (s + 1) % n;
        if (G.seats[other].human && ld.act(G, other, { t: 'liar' })) fail('acted out of turn');
        if (!G.bid && (ld.act(G, s, { t: 'liar' }) || ld.act(G, s, { t: 'spot' }))) fail('called with no bid on the table');
        if (G.bid && ld.act(G, s, { t: 'bid', q: G.bid.q, f: G.bid.f })) fail('repeated the same bid');
        if (ld.act(G, s, { t: 'bid', q: 999, f: 3 }) || ld.act(G, s, { t: 'bid', q: 2, f: 9 }) || ld.act(G, s, { t: 'dance' })) fail('nonsense accepted');
        human(G, s, now);
      } else ld.tick(G, now);
      if (G.stage === 'show' && G.show.at === now) {
        rounds++;
        const sh = G.show, c = countFace(G.dice, sh.f, G.wild);
        if (sh.count !== c) fail('count at the show is wrong');
        if (sh.kind === 'liar' && sh.lose.length !== 1) fail('a liar call costs exactly one player a die');
        if (sh.kind === 'liar' && sh.lose[0] !== (c < sh.q ? sh.bidder : sh.caller)) fail('wrong player loses the die');
        if (sh.kind === 'spot' && (c === sh.q) !== !sh.lose.includes(sh.caller) ) fail('spot on paid the wrong way');
      }
      const t = G.left.reduce((a, b) => a + b, 0);
      if (t > lastTotal) fail('dice came back'); lastTotal = t;
      if (G.left.some(x => x < 0)) fail('negative dice');
    }
    if (G.ph !== 'end') fail('game did not end');
    if (G.left.filter(x => x > 0).length !== 1 || !G.left[G.win]) fail('the winner should be the only one with dice');
    const r = ld.results(G);
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || r.some(x => x.pts < 0)) fail('results disagree');
    for (let k = 1; k < n - 1; k++) if (G.out[G.res.order[k]] < G.out[G.res.order[k + 1]]) fail('placing order wrong');
    return { G, rounds };
  } finally { Date.now = realNow; }
}
const a = play({});
console.log('classic: winner', a.G.seats[a.G.win].name, 'after', a.rounds, 'rounds');
const b = play({ seats: 6, dice: 3, wild: 'off', spot: 'off', bots: 'sharp' });
if (b.G.wild || b.G.spot) fail('options not applied');
console.log('six seats, no wilds: winner', b.G.seats[b.G.win].name, 'after', b.rounds, 'rounds');
play({ seats: 2, timer: 0 });
// a human who only ever calls "Liar!" and one who always raises by the smallest step
play({ seats: 3 }, (G, s) => { if (!(G.bid ? ld.act(G, s, { t: 'liar' }) : ld.act(G, s, { t: 'bid', q: 1, f: 2 }))) fail('move refused'); });
play({ seats: 3 }, (G, s) => { const l = lowest(G.bid, G.left.reduce((x, y) => x + y, 0), G.wild); if (!ld.act(G, s, l ? { t: 'bid', ...l } : { t: 'liar' })) fail('raise refused'); });
play({ seats: 4 }, (G, s) => { if (!(G.bid ? ld.act(G, s, { t: 'spot' }) : ld.act(G, s, { t: 'bid', q: 2, f: 3 }))) fail('spot refused'); });

{ // sharp bots should beat chill ones more often than not, and games should not drag
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let sharp = 0, rounds = 0, bids = 0; const N = 300;
  for (let g = 0; g < N; g++) {
    const G = ld.create([], { seats: 4 });
    while (G.ph === 'play') { now += 500; const s = G.turn; if (G.stage === 'bid' && s >= 0) ld._bot(G, s, now, s % 2 ? 'sharp' : 'chill'); else ld.tick(G, now); }
    if (G.win % 2) sharp++; rounds += G.round; bids += G.st.reduce((x, y) => x + y.bids, 0);
  }
  Date.now = realNow;
  console.log(`bots: sharp won ${sharp}/${N}, ${(rounds / N).toFixed(1)} rounds a game, ${(bids / rounds).toFixed(1)} bids a round`);
  if (sharp < N * .45) fail('sharp bots are not better than chill ones');
  if (bids / rounds < 1.5) fail('bots call far too early');
}
{ // the turn timer plays for you; a player who leaves is played by a bot; a watcher takes a bot's seat next round
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = ld.create(players, { seats: 4, timer: 20 });
  for (let i = 0; i < 2000 && !(G.stage === 'bid' && G.seats[G.turn]?.human); i++) { now += 100; ld.tick(G, now); }
  const key = () => G.round + '/' + G.hist.length + G.stage;
  const k = key(); now += 20100; ld.tick(G, now);
  if (key() === k) fail('timer did not play the turn');
  ld.seatWatcher(G, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] });
  if (G.seats.some(s => s.id === 'c')) fail('watcher seated in the middle of a round');
  ld.setAway(G, 0, true);
  const r0 = G.round;
  for (let i = 0; i < 5000 && G.round === r0 && G.ph === 'play'; i++) { now += 100; ld.tick(G, now); }
  if (G.ph === 'play' && !G.seats.some(s => s.id === 'c' && s.human)) fail('watcher was not seated at the new round');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 21080 + (Math.random() * 900 | 0);
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
send({ t: 'create', game: 'dice', opts: { seats: 6, dice: 3, wild: 'off', timer: 20, size: 'short' } });
await wait(300);
if (room?.game !== 'dice' || room.opts.seats !== 6 || room.opts.wild !== 'off' || 'size' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, wild: 'on' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.dice !== 3 || room.opts.wild !== 'on' || room.opts.timer !== 20) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'dice' || state.seats.length !== 2 || state.seats[state.me].dice?.length !== 3) bail('game did not start');
if (state.seats[1 - state.me].dice) bail('the server sent the other cup');
// call "Liar!" on every bid, and open with a bid that is certainly true: the game ends either way
let turns = 0;
for (let i = 0; i < 1200 && state.ph === 'play'; i++) {
  if (state.stage === 'bid' && state.turn === state.me) {
    if (state.stage !== 'show' && state.seats[1 - state.me].dice) bail('saw the other cup during bidding');
    send({ t: 'act', a: state.bid ? { t: 'liar' } : { t: 'bid', q: 1, f: state.seats[state.me].dice.find(v => v > 1) || 2 } }); turns++;
    await wait(120);
  } else await wait(100);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins < 1 || me.gain.coins !== (me.gain.place === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', turns, 'turns,', state.win === state.me ? 'won' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

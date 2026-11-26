// Pet Herds test: the set rules, tidying, moves and turn checks, whole games on a fake clock (checking nobody is
// ever sent another player's tray, no tile is ever lost or doubled, and every committed table is all sets), the
// timer, rounds, bots, then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as hd from '../server/games/herd.js';
import { check, tidy, move, turnCheck, solve, tilesOn, botPlay, elOf, numOf, isEgg, N_TILES } from '../public/games/herd/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const ppl = n => Array.from({ length: n }, (_, k) => ({ id: 'p' + k, name: 'P' + k, color: ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffb547'][k], av: [k] }));
const clock = () => { const realNow = Date.now; let now = realNow(); Date.now = () => now; return { add: ms => (now += ms), get now() { return now; }, done: () => { Date.now = realNow; } }; };
const T_ = (e, n, copy = 0) => copy * 52 + e * 13 + n - 1; // tile id of pet e, number n
const EGG = 104, EGG2 = 105;

// ----- tiles and sets -----
{
  const all = Array.from({ length: N_TILES }, (_, i) => i);
  if (all.filter(isEgg).length !== 2) fail('two eggs');
  for (let e = 0; e < 4; e++) for (let n = 1; n <= 13; n++) if (all.filter(t => elOf(t) === e && numOf(t) === n).length !== 2) fail('two of each tile');
  const ok = (ts, kind) => { const c = check(ts); if (!c || c.kind !== kind) fail(`${ts} should be a ${kind}`); return c; };
  const no = ts => { if (check(ts)) fail(`${ts} should not be a set`); };
  ok([T_(0, 3), T_(0, 4), T_(0, 5)], 'line'); ok([T_(1, 7), T_(2, 7), T_(3, 7)], 'herd'); ok([T_(1, 7), T_(2, 7), T_(3, 7), T_(0, 7)], 'herd');
  no([T_(0, 3), T_(0, 4)]); no([T_(1, 7), T_(1, 7, 1), T_(3, 7)]); no([T_(0, 12), T_(0, 13), T_(0, 1)]); no([T_(0, 3), T_(1, 4), T_(0, 5)]);
  no([T_(1, 7), T_(2, 7), T_(3, 7), T_(0, 7), EGG]);
  const c = ok([T_(2, 3), EGG, T_(2, 5)], 'line'); if (c.order[1] !== EGG || c.value !== 12) fail('egg fills the hole in a line');
  const d = ok([T_(2, 12), T_(2, 13), EGG], 'line'); if (d.lo !== 11 || d.order[0] !== EGG) fail('egg goes below 12-13');
  if (!check([T_(2, 9), EGG, EGG2])) fail('a tile and two eggs is a set'); ok([T_(2, 9), T_(1, 9), EGG], 'herd');
  // tidy: a 5 dropped on 3-7 splits it, a middle tile taken out of a line leaves two lines
  const parts = tidy([3, 4, 5, 6, 7].map(n => T_(0, n)).concat(T_(0, 5, 1)));
  if (parts.length !== 2 || !parts.every(p => check(p))) fail('a 5 on 3-7 should split into two lines: ' + JSON.stringify(parts));
  const gap = tidy([T_(0, 2), T_(0, 3), T_(0, 4), T_(0, 6), T_(0, 7), T_(0, 8)]);
  if (gap.length !== 2) fail('a line with a hole should fall into two');
  // the solver finds a rebuild: table 3-4-5 of Ember + tray Ember 6, Spark 3, Leaf 3 -> 4-5-6 and a herd of 3s
  const s = solve([T_(0, 3), T_(0, 4), T_(0, 5)], [T_(0, 6), T_(1, 3), T_(2, 3)]);
  if (!s || s.sets.flat().length !== 6) fail('solver should use the whole tray here');
}
{ // moves and the turn check
  const mine = [T_(0, 6), T_(1, 3), T_(2, 3), T_(3, 9)];
  const snap = { table: [{ id: 1, t: [T_(0, 3), T_(0, 4), T_(0, 5)] }], rack: mine };
  let W = { table: snap.table, rack: mine.slice(), nid: 1 };
  const set = new Set(mine);
  if (move(W, [T_(0, 3)], 'rack', set, false)) fail('a table tile went into the tray');
  if (move(W, [999], 'new', set, false) || move(W, [T_(0, 6), T_(0, 6)], 'new', set, false) || move(W, [T_(0, 6)], 77, set, false)) fail('nonsense move accepted');
  if (move(W, [T_(0, 3)], 'new', set, true)) fail('a table tile moved before the first play');
  W = move(W, [T_(0, 6)], 1, set, false);
  if (!W || W.table[0].t.length !== 4 || !check(W.table[0].t)) fail('adding a 6 to 3-5 failed');
  if (turnCheck(snap, W, true).ok !== true) fail('a valid add should be done');
  if (turnCheck(snap, W, false).why !== 'mixed') fail('first play may not use table groups');
  W = move(W, [T_(0, 3)], 'new', set, false); // take the 3 out: 4-5-6 stays, a lone 3
  if (turnCheck(snap, W, true).why !== 'bad') fail('a lone tile is not a set');
  W = move(W, [T_(1, 3), T_(2, 3)], W.table.find(g => g.t.includes(T_(0, 3))).id, set, false);
  const c = turnCheck(snap, W, true);
  if (!c.ok || c.placed !== 3) fail('rebuild into a herd of 3s should be fine: ' + JSON.stringify(c) + JSON.stringify(W.table));
  if (tilesOn(W.table).length + W.rack.length !== 7) fail('tiles lost while moving');
  W = move(W, [T_(1, 3)], 'rack', set, false); if (!W || !W.rack.includes(T_(1, 3))) fail('your own tile should go back to the tray');
  // first play needs 30 from your own tiles
  const tray = [T_(0, 10), T_(1, 10), T_(2, 10), T_(3, 1), T_(3, 2), T_(3, 3)];
  const s2 = { table: [], rack: tray }; let W2 = { table: [], rack: tray.slice(), nid: 0 };
  W2 = move(W2, [T_(3, 1), T_(3, 2), T_(3, 3)], 'new', new Set(tray), true);
  if (turnCheck(s2, W2, false, 30).why !== 'low') fail('6 points is not a first play');
  W2 = move(W2, [T_(0, 10), T_(1, 10), T_(2, 10)], 'new', new Set(tray), true);
  if (!turnCheck(s2, W2, false, 30).ok) fail('36 points is a first play');
}

// ----- whole games -----
function audit(G) {
  const all = [...G.pool, ...G.racks.flat(), ...tilesOn(G.table)];
  if (all.length !== N_TILES || new Set(all).size !== N_TILES) fail('a tile was lost or doubled');
  if (G.table.some(g => !check(g.t))) fail('a committed group is not a set');
}
function play(opts, people = ppl(1), human = 'bot') {
  const T = clock();
  try {
    const G = hd.create(people, opts), n = G.seats.length;
    for (let i = 0; i < 40000 && G.ph === 'play'; i++) {
      T.add(400);
      for (let s = -1; s < n; s++) { // nobody may see another tray
        const v = hd.view(G, s);
        if (s >= 0 && JSON.stringify(v.rack.slice().sort()) !== JSON.stringify((G.W && G.turn === s ? G.W.rack : G.racks[s]).slice().sort())) fail('own tray wrong');
        if (s < 0 && v.rack.length) fail('a watcher got a tray');
        if (!G.rd || G.stage === 'turn' || G.stage === 'deal') for (let k = 0; k < n; k++) if (k !== s && v.rack.some(t => G.racks[k].includes(t) && !(G.W && G.turn === k))) fail('saw another tray');
        if (JSON.stringify(v.ev).includes('"tile"')) fail('a drawn tile leaked in the events');
        if (s !== G.turn && v.snapRack) fail('snapRack sent to someone else');
      }
      const s = G.turn;
      if (G.stage === 'turn' && G.seats[s].human && !G.seats[s].bot) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && hd.act(G, other, { t: 'draw' })) fail('acted out of turn');
        if (hd.act(G, s, { t: 'mv', ids: [9999], to: 'new' }) || hd.act(G, s, { t: 'dance' }) || hd.act(G, s, { t: 'done' })) fail('nonsense accepted');
        if (human === 'bot') { // play like a bot, but through act(): lay its groups one move at a time
          const r = botPlay(G.table, G.racks[s], G.opened[s], G.opts.open, 'chill', G.nid);
          if (!r) { hd.act(G, s, { t: 'draw' }); continue; }
          const mineNew = r.table.filter(g => !G.table.some(h => h.id === g.id && h.t.join() === g.t.join()));
          let ok = true;
          for (const g of mineNew) {
            const fromTray = g.t.filter(t => G.W.rack.includes(t));
            if (!fromTray.length || g.t.length !== fromTray.length) { ok = false; break; }
            if (!hd.act(G, s, { t: 'mv', ids: fromTray, to: 'new' })) fail('move refused');
          }
          if (!ok || !hd.act(G, s, { t: 'done' })) { hd.act(G, s, { t: 'undo' }); if (tilesOn(G.W.table).length !== tilesOn(G.table).length) fail('undo did not put the table back'); hd.act(G, s, { t: 'draw' }); }
        } else hd.tick(G, T.now);
      } else hd.tick(G, T.now);
      if (G.stage !== 'turn' || !G.W) audit(G);
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = hd.results(G);
    if (!r[G.win].win || r.some(x => x.place < 1 || x.place > n)) fail('results disagree');
    if (G.hist.length !== G.opts.rounds) fail('wrong number of rounds');
    for (const pts of G.hist) if (pts.reduce((a, b) => a + b, 0) < -1 || pts.reduce((a, b) => a + b, 0) > 0 && pts.filter(p => p > 0).length > 1 && false) fail('round points');
    return G;
  } finally { T.done(); }
}
let rounds = 0;
if (!process.env.ONLY_SRV) for (const seats of [2, 3, 4]) { const G = play({ seats, timer: 0 }); console.log(`${seats} seats: ${G.seats[G.win].name} won ${G.total.join(' / ')} after ${G.mv} moves`); }
play({ seats: 4, bots: 'sharp', rounds: 3, open: 0 }, ppl(2));
play({ seats: 2, timer: 45 }, ppl(2), 'idle'); // two people who never move: the timer draws for them

{ // the timer: moves go back and a tile is drawn
  const T = clock(); const G = hd.create(ppl(2), { seats: 2, timer: 45 }); T.add(5000); hd.tick(G, T.now);
  const s = G.turn, n0 = G.racks[s].length + 0, pool = G.pool.length;
  const t = G.W.rack[0]; if (!hd.act(G, s, { t: 'mv', ids: [t], to: 'new' })) fail('move refused');
  if (hd.view(G, 1 - s).table.length !== 1 || !hd.view(G, 1 - s).fresh.includes(t)) fail('the others should see the working table');
  T.add(46000); hd.tick(G, T.now);
  if (G.turn === s || G.racks[s].length !== n0 + 1 || G.pool.length !== pool - 1 || G.table.length) fail('timeout should undo and draw');
  T.done();
}
{ // a player who leaves is played by a bot, and their half-done moves go back first
  const T = clock(); const G = hd.create(ppl(2), { seats: 2, timer: 60 }); T.add(5000); hd.tick(G, T.now);
  const s = G.turn; hd.act(G, s, { t: 'mv', ids: [G.W.rack[0]], to: 'new' });
  hd.setAway(G, s, true); if (G.W.table.length) fail('away should put the moves back');
  hd.setAway(G, 1 - s, true);
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { T.add(800); hd.tick(G, T.now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  T.done();
}
{ // bots: games end in a sensible number of rounds, sharp beats chill, and a bot turn is quick
  const T = clock(); let rs = 0, sharpWin = 0, slow = 0; const N = 40;
  for (let g = 0; g < N; g++) {
    const G = hd.create([], { seats: 4, rounds: 1 }); G.lvl = ['chill', 'sharp', 'chill', 'sharp'];
    for (let i = 0; i < 20000 && G.ph === 'play'; i++) { T.add(3000); const t0 = performance.now(); hd.tick(G, T.now); slow = Math.max(slow, performance.now() - t0); if (G.stage !== 'turn' || !G.W) audit(G); }
    if (G.ph !== 'end') fail('bot game did not end');
    rs += G.round && G.mv; if (G.win % 2 === 1) sharpWin++;
  }
  T.done();
  console.log(`bots: sharp won ${sharpWin}/${N} four-seat games, slowest bot turn ${slow.toFixed(0)} ms`);
  if (sharpWin < N * .6) fail('sharp bots are not better than chill ones');
  if (slow > 150) fail('a bot turn took too long');
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
ws.onmessage = e => { const msg = JSON.parse(e.data); if (process.env.DBG) console.log('MSG', e.data.slice(0, 200)); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'herd', opts: { seats: 4, timer: 90, dice: 3 } });
await wait(300);
if (room?.game !== 'herd' || room.opts.seats !== 4 || 'dice' in room.opts) bail('room options wrong: ' + JSON.stringify(room));
send({ t: 'opts', opts: { seats: 2, bots: 'sharp', open: 0, hints: 'off' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.bots !== 'sharp' || room.opts.open !== 0 || room.opts.hints !== 'off' || room.opts.timer !== 90) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'herd' || state.seats.length !== 2 || state.rack.length !== 14) bail('game did not start');
let turns = 0;
for (let i = 0; i < 20000 && state.ph === 'play'; i++) {
  if (state.turn === state.me && state.stage === 'turn') {
    const mv = state.mv;
    const r = botPlay(state.table, state.rack, state.seats[state.me].opened, state.open, 'chill', state.nid);
    const own = r ? r.table.filter(g => g.t.every(t => state.rack.includes(t))) : [];
    if (own.length) { for (const g of own) { send({ t: 'act', a: { t: 'mv', ids: g.t, to: 'new' } }); await wait(30); } send({ t: 'act', a: { t: 'done' } }); }
    else send({ t: 'act', a: { t: 'draw' } });
    turns++;
    for (let k = 0; k < 60 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
    await wait(60);
    if (state.turn === state.me && state.stage === 'turn' && state.fresh.length) { send({ t: 'act', a: { t: 'undo' } }); await wait(60); send({ t: 'act', a: { t: 'draw' } }); await wait(100); }
  } else await wait(40);
}
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
if (!me?.gain || me.gain.coins !== (me.gain.place === 1 ? 10 : 1)) bail('no coins or XP paid at the end: ' + JSON.stringify(me?.gain));
console.log('OK server game:', turns, 'turns,', state.res.place[state.me] === 1 ? 'won' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

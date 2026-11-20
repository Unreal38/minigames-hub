// Texas Hold'em test: hand ranking, side pots, whole bot games on a fake clock, then a table over the real server.
import { spawn } from 'node:child_process';
import * as pk from '../server/games/poker.js';
import { score, handName } from '../public/games/poker/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const C = s => s.split(' ').map(x => 'hdcs'.indexOf(x[1]) * 13 + '23456789TJQKA'.indexOf(x[0]));
const ana = { id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, bo = { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] };

// ----- ranking -----
const order = ['Ah Kh Qh Jh Th 2c 3d', '9s 9h 9d 9c 2h 3c 4d', 'Ks Kh Kd 2c 2h 5d 7s', '2h 7h 9h Jh Kh Ac Ad', '5h 6d 7c 8s 9h Kd Kc',
  'As 2d 3c 4h 5s Kd Qc', 'Qs Qh Qd 2c 7h 9d Js', 'Ks Kh 7d 7c 2h 3d 9s', 'As Ah 7d 6c 2h 3d 9s', 'As Qh 7d 6c 2h 3d 9s'];
for (let i = 1; i < order.length; i++) if (!(score(C(order[i - 1])) > score(C(order[i])))) fail(`ranking: ${order[i - 1]} should beat ${order[i]}`);
if (handName(score(C('As 2d 3c 4h 5s Kd Qc'))) !== 'Straight to the Five') fail('wheel name');
if (score(C('Ah Ad Kc Qs Jd 3h 2c')) <= score(C('Ah Ad Kc Qs Td 3h 2c'))) fail('kicker');
if (score(C('Ah Ad 9c 9s 4d 4h Kc')) !== score(C('Ah Ad 9c 9s Kd 3h 2c'))) fail('two pair with three pairs should use the best kicker');

// ----- side pots: a short all-in wins only the main pot -----
{
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = pk.create([ana, bo], { field: 4, hands: 10, timer: 0 });
  now += 2000; pk.tick(G, now);
  if (G.stage !== 'pre' || G.hand !== 1) fail('first hand did not start');
  // rig the hand: seat 0 short with the nuts, seat 1 second best, seat 2 a loser; seat 3 folds
  const [x0, x1, x2, x3] = G.st;
  Object.assign(x0, { stack: 100, bet: 0, in: 0, cards: C('Ah As') }); Object.assign(x1, { stack: 500, bet: 0, in: 0, cards: C('Kh Ks') });
  Object.assign(x2, { stack: 500, bet: 0, in: 0, cards: C('2c 7d') }); Object.assign(x3, { stack: 500, bet: 0, in: 0, cards: C('3c 8d'), fold: true });
  for (const x of G.st) { x.allin = false; x.acted = false; }
  G.board = []; G.deck = C('4d 9c Jh 2s 5c 8h Qd 6s Td 3s'); // dealt from the end: burn, flop, burn, turn, burn, river
  G.cur = 0; G.minRaise = 20; G.dealer = 3; G.sbI = 0; G.bbI = 1;
  G.turn = 0;
  for (const i of [0, 1, 2]) G.seats[i].bot = false, G.seats[i].human = true, G.seats[i].id = 'p' + i;
  const go = (s, a) => { if (!pk.act(G, s, a)) fail(`action refused: ${s} ${JSON.stringify(a)}`); };
  go(0, { t: 'allin' });
  if (!x0.allin || G.cur !== 100) fail('all-in not recorded');
  go(1, { t: 'raise', to: 300 });
  if (pk.act(G, 1, { t: 'call' })) fail('acted out of turn');
  go(2, { t: 'call' });
  // flop onwards: seats 1 and 2 check it down
  for (let k = 0; k < 40 && G.stage !== 'show'; k++) {
    now += 2000; pk.tick(G, now);
    if (G.turn >= 0 && !G.next) go(G.turn, { t: 'check' });
  }
  if (G.stage !== 'show') fail('hand did not reach showdown');
  const pots = G.handRes.pots;
  if (pots.length !== 2 || pots[0].amt !== 300 || pots[1].amt !== 400) fail('side pots wrong: ' + JSON.stringify(pots));
  if (pots[0].win[0] !== 0 || pots[1].win[0] !== 1) fail('pots went to the wrong players');
  if (x0.stack !== 300 || x1.stack !== 600 || x2.stack !== 200) fail('stacks after side pots: ' + G.st.map(x => x.stack));
  const v = pk.view(G, 2);
  if (v.seats[3].cards.some(c => c >= 0)) fail('folded hand leaked at showdown');
  if (v.seats[0].cards.some(c => c < 0)) fail('showdown cards hidden');
  Date.now = realNow;
}

// ----- whole games played by bots: chips are never created or lost -----
{
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  for (const [field, hands, bots] of [[6, 10, 'chill'], [4, 0, 'sharp'], [2, 20, 'sharp']]) {
    const G = pk.create([ana], { field, hands, bots, timer: 20 }); const n = G.seats.length;
    let timeouts = 0;
    for (let i = 0; i < 300000 && G.ph === 'play'; i++) {
      now += 250; pk.tick(G, now);
      if (G.ph === 'play' && G.stage !== 'show' && G.st.reduce((a, x) => a + x.stack + x.in, 0) !== n * pk.START) fail('chips appeared or vanished');
      const hidden = pk.view(G, 1).seats[0].cards;
      if (G.ph === 'play' && G.stage !== 'show' && !G.runout && hidden.some(c => c >= 0)) fail('another player can see my cards: ' + G.stage + JSON.stringify(G.st[0]));
      if (G.turn === 0 && G.tEnd && now >= G.tEnd) timeouts++;
    }
    if (G.ph !== 'end') fail(`game (${field}, ${hands}) did not end`);
    if (G.st.reduce((a, x) => a + x.stack, 0) !== n * pk.START) fail('final chips do not add up');
    if (hands && G.hand > hands) fail('played too many hands');
    const r = pk.results(G);
    if (!r[G.win].win || r.filter(x => x.win).length !== 1) fail('results winner');
    console.log(`${field} seats, ${hands || 'last one standing'}: ${G.hand} hands, winner ${G.seats[G.win].name} with ${G.st[G.win].stack}`);
  }
  Date.now = realNow;
}

// ----- a watcher takes over a bot's seat at the next hand -----
{
  const G = pk.create([ana], { field: 4 });
  G.stageEnd = 0; pk.tick(G);
  if (!pk.seatWatcher(G, bo, true) || G.seats.some(s => s.id === 'b')) fail('watcher queued wrong');
  pk.seatWatcher(G, bo, false); if (G.queue.length) fail('watcher could not cancel');
  pk.seatWatcher(G, bo, true);
  G.stage = 'show'; G.stageEnd = 0; pk.tick(G);
  const i = G.seats.findIndex(s => s.id === 'b');
  if (i < 0 || !G.seats[i].human || G.seats[i].bot) fail('watcher did not get a seat');
  if (pk.view(G, i).seats[i].cards.some(c => c < 0)) fail('new player cannot see their cards');
  console.log('watcher seated at', i);
}

// ----- over the wire -----
const PORT = 19980 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: '/tmp/cozy-poker-test-' + PORT }, stdio: 'inherit' });
const bail = m => { srv.kill(); fail(m); };
await new Promise(r => setTimeout(r, 600));
function player(name) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const p = { ws, room: null, s: null, send: m => ws.send(JSON.stringify(m)) };
  ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') p.room = m.room; if (m.t === 'state') p.s = m.s; };
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (ok, what, ms = 8000) => { const t = Date.now(); while (!ok()) { await wait(50); if (Date.now() - t > ms) bail(what); } };
const A = player('Ana'), Bp = player('Bo');
await wait(300);
A.send({ t: 'create', game: 'poker', opts: { field: 4, hands: 0, timer: 0, bots: 'sharp', junk: 1 } });
await until(() => A.room, 'no room');
if (A.room.opts.field !== 4 || A.room.opts.hands !== 0 || 'junk' in A.room.opts) bail('room options wrong');
A.send({ t: 'opts', opts: { hands: 20 } }); await until(() => A.room.opts.hands === 20, 'option change lost');
Bp.send({ t: 'join', code: A.room.code }); await until(() => Bp.room?.players.length === 2, 'join failed');
A.send({ t: 'start' });
await until(() => A.s?.stage === 'pre' && Bp.s?.stage === 'pre', 'hand did not start');
const mine = A.s.seats[A.s.me].cards, theirs = Bp.s.seats[A.s.me].cards;
if (mine.some(c => c < 0) || theirs.some(c => c >= 0)) bail('hole cards visible to the wrong player');
// play a few hands: humans check or call, folding sometimes
let acted = 0;
const autoplay = p => { const s = p.s; if (s?.ph === 'play' && s.opt && s.turn === s.me) { p.send({ t: 'act', a: Math.random() < .15 ? { t: 'fold' } : { t: 'call' } }); acted++; } };
await until(() => { autoplay(A); autoplay(Bp); return A.s.hand >= 3; }, 'hands did not progress', 60000);
if (!acted) bail('players never got a turn');
console.log('OK', acted, 'actions over the wire');
srv.kill(); process.exit(0);

// Warcaby: the rules (move counts from the start match the published numbers, captures, the longest-capture rule,
// flying kings, crowning, the draw rules), the game (turns, offers, clocks, results), the bot levels, and one game
// over the real server against a bot that thinks on its worker thread.
import { spawn } from 'node:child_process';
import * as wc from '../server/games/warcaby.js';
import { think, LEVELS, likesDraw } from '../server/games/warcabyai.js';
import * as W from '../public/games/warcaby/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const sq = (name, n = 10) => (+name.slice(1) - 1) * n + 'abcdefghij'.indexOf(name[0]);
const P = (str, n = 10) => str.split(/[-x]/).map(x => sq(x, n));

// ----- move counts from the start (perft): 10x10 international, 8x8 Brazilian, both published -----
function perft(p, d) { if (!d) return 1; let n = 0; for (const m of W.legal(p)) { const u = W.make(p, m); n += perft(p, d - 1); W.unmake(p, u); } return n; }
for (const [size, want] of [[10, [9, 81, 658, 4265, 27117]], [8, [7, 49, 302, 1469, 7473]]]) {
  const p = W.startPos(size), b = p.b.slice(), h = p.h;
  want.forEach((w, i) => { const got = perft(p, i + 1); if (got !== w) fail(`perft ${size}x${size} depth ${i + 1}: ${got}, expected ${w}`); });
  if (p.b.join() !== b.join() || p.h !== h) fail('position not restored after a search');
  const c = W.count(p.b); if (c[0][0] !== (size === 10 ? 20 : 12) || c[1][0] !== c[0][0]) fail('wrong number of pieces at the start');
}
{ // the running hash matches one worked out from scratch
  let p = W.startPos(10);
  for (let i = 0; i < 200; i++) { const ms = W.legal(p); if (!ms.length) break; W.make(p, ms[(i * 7 + 3) % ms.length]); const q = W.fromBoard(p.b, p.turn); if (q.h !== p.h || q.h2 !== p.h2) fail('hash drifted'); }
}

// ----- the rules -----
const board = rows => W.fromText(rows.map(r => r.replace(/ /g, '.')));
const E = '..........';
const paths = (p, n = 10) => W.legal(p).map(m => W.moveText(m, n)).sort();
{ // a man steps forward only, and takes backwards too; taking is a must
  const p = board([E, E, E, E, E, E, E, E, E, '..w.......'].map((r, i) => i === 9 ? r : r)); // White man on c1
  if (paths(p).join() !== 'c1-b2,c1-d2') fail('man steps wrong: ' + paths(p));
  const q = board([E, E, E, E, E, E, '...w......', '..b.......', E, E]); // White d4, Black c3: a backward take
  if (paths(q).join() !== 'd4xb2') fail('a man should take backwards, and taking is a must: ' + paths(q));
}
{ // the most pieces must be taken
  const p = board([E, E, E, E, '.....b....', E, '.b.b......', '..w.......', E, E]); // c3 can take b4 alone, or d4 and then f6
  if (paths(p).join() !== 'c3xe5xg7') fail('only the longest capture is legal: ' + paths(p));
}
{ // a flying king takes from afar and may land on any empty square behind
  const p = board([E, E, E, E, E, E, '...b......', E, E, 'W.........']); // king a1, black man d4
  const all = paths(p);
  if (all.join() !== 'a1xe5,a1xf6,a1xg7,a1xh8,a1xi9,a1xj10') fail('king capture landings wrong: ' + all);
  const q = board([E, E, E, E, E, E, '...b......', '..b.......', E, 'W.........']); // two in a row: no capture
  if (W.legal(q).some(m => m.caps.length)) fail('a king may not jump two pieces in a row');
}
{ // a taken piece stays until the end of the move, so it can block the way and can't be jumped twice
  const p = board([E, E, E, E, E, E, '...b.b....', '..w.......', '...b.b....', E]); // white c3 inside a ring of four: d4 f4 f2 d2
  const best = W.legal(p)[0];
  if (best.caps.length !== 4 || new Set(best.caps).size !== 4) fail('the square of four should be taken all round: ' + paths(p));
  if (best.t !== best.f) fail('the man should come back to where it started: ' + W.moveText(best, 10));
}
{ // crowning only when the move ends on the far row
  const p = board([E, '..b.......', '.w........', E, E, E, E, E, E, '........B.']); // white b8, black c9; a black king far away
  const m = W.legal(p).find(x => x.caps.length);
  if (!m || W.moveText(m, 10) !== 'b8xd10' || !m.k) fail('a man that ends on the far row is crowned');
  const q = board([E, '..b.b.....', '.w........', E, E, E, E, E, E, '........B.']); // b8 x c9 -> d10, then d10 x e9 -> f8: passes the row, stays a man
  const n = W.legal(q)[0];
  if (W.moveText(n, 10) !== 'b8xd10xf8' || n.k) fail('a man passing through the far row while taking stays a man: ' + paths(q));
  const r = W.play(q, n); if (r.b[sq('f8')] !== W.MAN) fail('it should still be a man');
}
{ // game over and the draw rules
  const st = p => W.status(p, new Map());
  if (st(W.fromText([E, E, E, E, E, E, E, E, E, 'w.........'], 'b')).how !== 'wiped') fail('no pieces left should lose');
  const blocked = W.fromText([E, 'b.........', '.w........', '..w.......', E, E, E, E, E, '........W.'], 'b'); // black a9 can't move: b8 is taken and c7 guards
  if (st(blocked).how !== 'blocked' || st(blocked).win !== 0) fail('no move left should lose: ' + JSON.stringify(st(blocked)));
  const kings = board([E, E, E, '........B.', E, E, '...W......', E, '.....W....', E]);
  kings.quiet = 50; if (st(kings).how !== 'kings') fail('25 king moves each should draw');
  const ending = board([E, E, E, '........B.', E, E, '...W......', E, '.....W....', 'W.........']);
  ending.eg = 31; if (st(ending).over) fail('the 3-against-1 limit came early');
  ending.eg = 32; if (st(ending).how !== 'endgame') fail('16 moves each against a lone king should draw');
  const short = board([E, E, E, '........B.', E, E, '...W......', E, '.....W....', E]); short.eg = 10;
  if (st(short).how !== 'endgame') fail('5 moves each with two against a lone king should draw');
}

// ----- the game -----
for (const [o, want] of [[{}, '10+5/easy/10'], [{ clock: 'off', bots: 'sharp', board: '8' }, 'off/sharp/8'], [{ clock: '9+9', bots: 'x', board: 12, seats: 6 }, '10+5/easy/10'], [{ clock: 'constructor', bots: 'toString', board: 'valueOf' }, '10+5/easy/10'], [{ board: 8 }, '10+5/easy/8']]) {
  const c = wc.cleanOpts(o); if ([c.clock, c.bots, c.board].join('/') !== want || Object.keys(c).length !== 3) fail('options not cleaned: ' + JSON.stringify(c));
}
const realNow = Date.now; let now = realNow(); Date.now = () => now;
const seatOf = (G, colour) => (colour === 0 ? G.white : 1 - G.white);
const mover = G => seatOf(G, G.pos.turn);
const go = (G, str) => wc.act(G, mover(G), { t: 'move', path: P(str, G.pos.n) });
const line = (G, str) => { for (const m of str.split(' ')) if (!go(G, m)) fail('move refused: ' + m + ' · legal: ' + W.legal(G.pos).map(x => W.moveText(x, G.pos.n))); };
{ // seats, colours and a rematch swapping them
  const G = wc.create(players, { clock: 'off' });
  if (G.seats.length !== 2 || G.seats.some(s => s.bot) || G.clock || G.pos.n !== 10) fail('seats, board or clock wrong');
  let w = G.white;
  for (let i = 0; i < 4; i++) { const H = wc.create(players, {}); if (H.white === w) fail('a rematch must swap colours'); w = H.white; }
  const solo = wc.create([players[0]], { board: '8' }); if (!solo.seats[1].bot || solo.seats[1].human || !solo.clock || solo.clock[0] !== 600000 || solo.inc !== 5000 || solo.pos.n !== 8) fail('bot seat, small board or clock wrong');
}
{ // nonsense is refused, then a forced capture
  const G = wc.create(players, { clock: 'off' }), Wt = G.white, Bk = 1 - Wt;
  if (wc.act(G, Bk, { t: 'move', path: P('a7-b6') })) fail('Black moved first');
  if (wc.act(G, Wt, { t: 'move', path: P('c4-d5') }) || wc.act(G, Wt, { t: 'move', path: P('a4-b6') }) || wc.act(G, Wt, { t: 'move' }) || wc.act(G, Wt, { t: 'move', path: [1.5, 2] })
    || wc.act(G, Wt, { t: 'move', path: '31,42' }) || wc.act(G, Wt, { t: 'move', path: new Array(40).fill(0) }) || wc.act(G, Wt, { t: 'move', path: [-1, 400] }) || wc.act(G, Wt, { t: 'dance' }) || wc.act(G, Wt, null) || wc.act(G, 5, { t: 'resign' })) fail('nonsense accepted');
  if (wc.act(G, Wt, { t: 'draw' })) fail('a draw offered before any move');
  line(G, 'd4-e5 g7-f6'); // now White must take f6
  const v = wc.view(G, Wt); if (v.moves.join(' ') !== 'd4-e5 g7-f6' || v.turn !== Wt || v.pos.b.length !== 100 || v.clock !== null || v.size !== 10) fail('view wrong: ' + JSON.stringify(v.moves));
  if (!W.mustTake(G.pos)) fail('White should have to take here');
  if (go(G, 'b4-c5')) fail('a plain step accepted when a capture is a must');
  const m = W.legal(G.pos)[0], before = W.count(G.pos.b)[1][0];
  if (!wc.act(G, Wt, { t: 'move', path: m.path }) || W.count(G.pos.b)[1][0] !== before - m.caps.length || G.caps[Wt][0] !== m.caps.length || !G.last.caps.length) fail('capture not made');
}
{ // resigning, and offering a draw
  let G = wc.create(players, { clock: 'off' }); line(G, 'd4-e5 a7-b6');
  if (!wc.act(G, 0, { t: 'resign' }) || G.win !== 1 || G.res.how !== 'resign') fail('resign wrong');
  const r0 = wc.results(G); if (!r0[1].win || r0[1].pts !== 10 || r0[0].pts !== 0 || r0.some(x => x.idle)) fail('results wrong');
  if (wc.act(G, 1, { t: 'resign' }) || go(G, 'b4-c5')) fail('acted after the end');
  G = wc.create(players, { clock: 'off' }); line(G, 'd4-e5 a7-b6');
  const a = mover(G), b = 1 - a;
  if (wc.act(G, b, { t: 'nodraw' })) fail('declined an offer nobody made');
  if (!wc.act(G, a, { t: 'draw' }) || G.offer !== a || wc.act(G, a, { t: 'draw' })) fail('offer wrong');
  if (!wc.view(G, b).ev.some(e => e.t === 'offer') || wc.view(G, a).canOffer) fail('offer not shown');
  if (!wc.act(G, b, { t: 'nodraw' }) || G.offer !== -1 || wc.act(G, a, { t: 'draw' })) fail('decline wrong, or a second offer in the same move');
  line(G, 'b4-c5 b6xd4xf6');
  if (G.ph !== 'play') fail('game ended early');
  const c = mover(G);
  if (!wc.act(G, c, { t: 'draw' }) || !wc.act(G, 1 - c, { t: 'draw' }) || G.ph !== 'end' || G.res.how !== 'agree' || G.win !== -1) fail('agreed draw wrong');
  if (wc.results(G).some(x => x.win || x.pts !== 5)) fail('draw results wrong');
  const lop = W.fromText([E, E, E, E, E, E, E, '..w.w.w...', E, '........b.']);
  if (!likesDraw(lop, 1) || likesDraw(lop, 0)) fail('likesDraw wrong');
}
{ // the same position three times is a draw (kings shuffling)
  const G = wc.create(players, { clock: 'off' });
  G.pos = W.fromBoard(W.fromText([E, E, E, '........B.', E, E, E, E, E, 'W.........']).b, 0); G.seen = { [W.posKey(G.pos)]: 1 };
  line(G, 'a1-b2 i7-j8 b2-a1 j8-i7'); line(G, 'a1-b2 i7-j8 b2-a1');
  if (G.ph !== 'play') fail('draw called too early');
  line(G, 'j8-i7');
  if (G.ph !== 'end' || G.res.how !== 'repeat' || G.win !== -1) fail('threefold repetition not seen: ' + JSON.stringify(G.res));
}
{ // clocks: time runs for the player to move, the increment is added, the flag falls
  const G = wc.create(players, { clock: '3+2' }), Wt = G.white;
  now += 1500; now += 10000; line(G, 'd4-e5');
  if (Math.abs(G.clock[Wt] - (180000 - 10000 + 2000)) > 5) fail('clock after a move wrong: ' + G.clock[Wt]);
  now += 4000; const v = wc.view(G, Wt);
  if (Math.abs(v.clock[1 - Wt] - 176000) > 5 || v.clock[Wt] !== G.clock[Wt]) fail('the clock shown is wrong');
  now += 175000; if (wc.tick(G, now)) fail('flag fell early');
  now += 1100; if (!wc.tick(G, now) || G.ph !== 'end' || G.res.how !== 'time' || G.win !== Wt || wc.view(G, Wt).clock[1 - Wt] !== 0) fail('flag did not fall');
}
{ // a player who left is played by a bot, and one who never moved themselves earns nothing
  const G = wc.create(players, { clock: 'off', board: '8' });
  wc.setAway(G, 0, true); wc.setAway(G, 1, true);
  for (let i = 0; i < 600 && G.ph === 'play'; i++) wc._bot(G, now, 8);
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  if (!wc.results(G).every(r => r.idle)) fail('a game played only by stand-in bots should count as idle');
}

// ----- bots -----
{ // every level always answers with a legal move, whole bot games end, and the stronger level wins
  const ends = {};
  for (const [lv, size] of [['easy', '10'], ['club', '8']]) {
    const G = wc.create([], { bots: lv, clock: 'off', board: size });
    for (let i = 0; i < 600 && G.ph === 'play'; i++) { const mv = G.mv; if (!wc._bot(G, now, lv === 'easy' ? 6 : 12) || G.mv !== mv + 1) fail('bot did not move'); }
    if (G.ph !== 'end') fail('a bot game ran past 300 moves each');
    ends[G.res.how] = (ends[G.res.how] || 0) + 1;
    if (wc.results(G).some(r => r.idle)) fail('bots are never idle');
  }
  let club = 0, easy = 0;
  for (let g = 0; g < 4; g++) {
    let p = W.startPos(g < 2 ? 8 : 10); const seen = new Map(), hist = [p.h]; let st;
    for (let i = 0; i < 400; i++) {
      seen.set(W.posKey(p), (seen.get(W.posKey(p)) || 0) + 1); st = W.status(p, seen); if (st.over) break;
      const isClub = (p.turn === 0) === (g % 2 === 0);
      p = W.play(p, think(W.clone(p), { ...LEVELS[isClub ? 'club' : 'easy'], ms: isClub ? 40 : 15, history: hist })); hist.push(p.h);
    }
    if (st?.over && st.win >= 0) (st.win === 0) === (g % 2 === 0) ? club++ : easy++;
  }
  if (club < 3 || easy > 0) fail(`the club bot should beat the beginner: ${club} to ${easy}`);
  console.log(`bots: games ended by ${JSON.stringify(ends)}; club beat beginner ${club} : ${easy} of 4`);
}
Date.now = realNow;

// ----- over the real server (the bot thinks on its worker thread here) -----
const PORT = 27980 + (Math.random() * 900 | 0);
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
send({ t: 'create', game: 'warcaby', opts: { clock: '5+3', bots: 'sharp', board: '8', seats: 6 } });
await wait(300);
if (room?.game !== 'warcaby' || room.opts.clock !== '5+3' || room.opts.bots !== 'sharp' || room.opts.board !== '8' || 'seats' in room.opts || room.max !== 2) bail('room options wrong: ' + JSON.stringify(room?.opts));
send({ t: 'opts', opts: { bots: 'club' } }); await wait(200);
if (room.opts.bots !== 'club' || room.opts.clock !== '5+3') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'warcaby' || state.seats.length !== 2 || state.pos.b.length !== 64 || state.size !== 8 || !state.seats[1 - state.me].bot || state.clock?.length !== 2) bail('game did not start');
let turns = 0;
for (let i = 0; i < 2000 && state.ph === 'play' && turns < 8; i++) {
  if (state.turn === state.me) {
    const p = state.pos, ms = W.legal(W.fromBoard(p.b, p.turn, p.quiet, p.eg)), m = ms[(turns * 5 + 2) % ms.length], mv = state.mv;
    send({ t: 'act', a: { t: 'move', path: m.path } }); turns++;
    for (let k = 0; k < 80 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
    if (state.mv === mv && state.ph === 'play') bail('the server refused a legal move');
  } else await wait(50);
}
for (let k = 0; k < 200 && state.ph === 'play' && state.turn !== state.me; k++) await wait(50);
if (state.ph === 'play' && state.mv < 12) bail('the bot stopped answering: ' + state.mv + ' moves');
if (state.ph === 'play') { send({ t: 'act', a: { t: 'resign' } }); await wait(300); }
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
const won = state.win === state.me, tie = state.win < 0;
if (!me?.gain || me.gain.coins !== (won || tie ? 10 : 1)) bail('wrong coins paid at the end: ' + JSON.stringify(me?.gain));
if (me.gain.ranked) bail('a game against a bot must not count for the rankings');
if (!room.board?.length || room.paid?.[1 - state.me] !== 'b') bail('table scoreboard or coins column wrong');
console.log('OK server game:', state.moves.length, 'moves,', state.res.how, won ? 'won' : tie ? 'drawn' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

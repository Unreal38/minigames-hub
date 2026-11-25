// Chess test: checks the move generator against known move counts (perft), the special rules, every way a game can
// end, the clocks and the bots, then plays a table against a bot over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as chess from '../server/games/chess.js';
import { think, LEVELS, likesDraw } from '../server/games/chessai.js';
import * as C from '../public/games/chess/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const sq = n => (+n[1] - 1) * 8 + 'abcdefgh'.indexOf(n[0]);

// ----- move counts from known positions (any slip in castling, en passant, promotion or check shows up here) -----
function perft(pos, d) { if (!d) return 1; let n = 0; const us = pos.turn; for (const m of C.pseudo(pos)) { const u = C.make(pos, m); if (!C.attacked(pos.b, pos.k[us], 1 - us)) n += perft(pos, d - 1); C.unmake(pos, u); } return n; }
for (const [fen, want] of [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
]) {
  const p = C.fromFen(fen), h = p.h;
  want.forEach((w, i) => { const got = perft(p, i + 1); if (got !== w) fail(`perft ${fen} depth ${i + 1}: ${got}, expected ${w}`); });
  if (C.toFen(p) !== fen || p.h !== h) fail('position not restored after a search');
}
if (C.toFen(C.startPos()) !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') fail('start position wrong');
{ // the running hash matches one worked out from scratch
  let p = C.startPos();
  for (let i = 0; i < 300; i++) { const ms = C.legal(p); if (!ms.length) break; C.make(p, ms[(i * 7 + 3) % ms.length]); const q = C.fromFen(C.toFen(p)); if (q.h !== p.h || q.h2 !== p.h2) fail('hash drifted at ' + C.toFen(p)); }
}

// ----- special rules -----
const has = (fen, f, t) => !!C.findMove(C.fromFen(fen), sq(f), sq(t));
if (!has('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'g1') || !has('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'c1') || !has('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'e8', 'c8')) fail('castling missing');
if (has('r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1', 'e1', 'g1')) fail('castled without the right');
if (has('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1', 'e1', 'g1')) fail('castled through an attacked square');
if (!has('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1', 'e1', 'c1')) fail('queenside castling wrongly refused');
if (has('r3k2r/8/8/8/8/4r3/8/R3K2R w KQkq - 0 1', 'e1', 'c1')) fail('castled out of check');
if (has('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1', 'e1', 'c1')) fail('castled over a piece');
if (!has('1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1', 'e1', 'c1')) fail('queenside castling is fine when only b1 is attacked');
{ // castling moves the rook too, and moving the rook or king loses the right
  let p = C.play(C.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), C.findMove(C.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), sq('e1'), sq('g1')));
  if (p.b[sq('f1')] !== C.R || p.b[sq('g1')] !== C.K || p.b[sq('h1')] || p.castle !== 12) fail('castling did not move the rook or keep the rights straight');
  p = C.play(p, C.findMove(p, sq('a8'), sq('a7'))); if (p.castle !== 4) fail('moving a rook should lose that side’s castling');
}
{ // en passant: only straight after the double step
  let p = C.fromFen('4k3/8/8/8/1p6/8/P7/4K3 w - - 0 1');
  p = C.play(p, C.findMove(p, sq('a2'), sq('a4')));
  if (p.ep !== sq('a3')) fail('en passant square not set');
  const m = C.findMove(p, sq('b4'), sq('a3')); if (!m) fail('en passant capture missing');
  const q = C.play(p, m); if (q.b[sq('a4')] || q.b[sq('a3')] !== (C.P | 8)) fail('en passant did not remove the pawn');
  const later = C.play(C.play(p, C.findMove(p, sq('e8'), sq('e7'))), C.findMove(C.play(p, C.findMove(p, sq('e8'), sq('e7'))), sq('e1'), sq('e2')));
  if (C.findMove(later, sq('b4'), sq('a3'))) fail('en passant a move too late');
}
{ // promotion: four choices, a queen unless you say otherwise
  const p = C.fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  if (C.legal(p).filter(m => C.mFrom(m) === sq('a7')).length !== 4) fail('promotion should offer four pieces');
  if (C.play(p, C.findMove(p, sq('a7'), sq('a8'))).b[sq('a8')] !== C.Q || C.play(p, C.findMove(p, sq('a7'), sq('a8'), C.N)).b[sq('a8')] !== C.N) fail('promotion piece wrong');
}
if (has('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1', 'e1', 'd1') === false || has('4k3/8/8/8/8/8/3r4/4K3 w - - 0 1', 'e1', 'e2')) fail('king may not step into check');
if (has('4k3/8/8/8/4r3/8/4B3/4K3 w - - 0 1', 'e2', 'd3')) fail('a pinned piece moved off the line');
{
  const st = f => C.status(C.fromFen(f), new Map());
  if (st('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').how !== 'stalemate') fail('stalemate not seen');
  const m = st('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'); if (m.how !== 'mate' || m.win !== 0) fail('mate not seen');
  if (st('4k3/8/8/8/8/8/8/4K3 w - - 0 1').how !== 'material' || st('4k3/8/8/8/8/8/8/3NK3 w - - 0 1').how !== 'material' || st('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1').how !== 'material') fail('dead position not seen');
  if (st('4kb2/8/8/8/8/8/8/3BK3 w - - 0 1').over || st('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1').over || st('4k3/8/8/8/8/8/P7/4K3 w - - 0 1').over) fail('a live position called dead');
  if (st('4k3/8/8/8/8/8/P7/4K3 w - - 100 80').how !== 'fifty' || st('4k3/8/8/8/8/8/P7/4K3 w - - 99 80').over) fail('50-move rule wrong');
  if (C.canMate(C.fromFen('4k3/8/8/8/8/8/8/3NK3 w - - 0 1').b, 0) || C.canMate(C.fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1').b, 0) || !C.canMate(C.fromFen('4k3/8/8/8/8/8/P7/4K3 w - - 0 1').b, 0) || !C.canMate(C.fromFen('4k3/8/8/8/8/8/8/2BNK3 w - - 0 1').b, 0)) fail('canMate wrong');
}
{ // notation
  const s = (fen, f, t, pr) => { const p = C.fromFen(fen); return C.san(p, C.findMove(p, sq(f), sq(t), pr)); };
  if (s('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1', 'g1') !== 'O-O' || s('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1', 'c1') !== 'O-O-O') fail('castling notation');
  if (s('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1', 'b1', 'd2') !== 'Nbd2' || s('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5') !== 'exd5') fail('notation of a shared square or a pawn capture');
  if (s('7k/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7', 'a8', C.R) !== 'a8=R+' || s('7k/8/5KQ1/8/8/8/8/8 w - - 0 1', 'g6', 'g7') !== 'Qg7#') fail('notation of a promotion or mate');
}

// ----- the game itself -----
for (const [o, want] of [[{}, '10+5/easy'], [{ clock: 'off', bots: 'sharp' }, 'off/sharp'], [{ clock: '9+9', bots: 'x', seats: 6 }, '10+5/easy'], [{ clock: 'constructor', bots: 'toString' }, '10+5/easy']]) {
  const c = chess.cleanOpts(o); if ([c.clock, c.bots].join('/') !== want || Object.keys(c).length !== 2) fail('options not cleaned: ' + JSON.stringify(c));
}
const realNow = Date.now; let now = realNow(); Date.now = () => now;
const seatOf = (G, colour) => (colour === 0 ? G.white : 1 - G.white);
const mover = G => seatOf(G, G.pos.turn);
const go = (G, f, t, p) => chess.act(G, mover(G), { t: 'move', f: sq(f), to: sq(t), p });
const line = (G, str) => { for (const m of str.split(' ')) if (!go(G, m.slice(0, 2), m.slice(2, 4), m[4])) fail('move refused: ' + m + ' in ' + C.toFen(G.pos)); };
{ // seats, colours and a rematch swapping them
  const G = chess.create(players, { clock: 'off' });
  if (G.seats.length !== 2 || G.seats.some(s => s.bot) || G.clock) fail('seats or clock wrong');
  let w = G.white;
  for (let i = 0; i < 4; i++) { const H = chess.create(players, {}); if (H.white === w) fail('a rematch must swap colours'); w = H.white; }
  const solo = chess.create([players[0]], {}); if (!solo.seats[1].bot || solo.seats[1].human || !solo.clock || solo.clock[0] !== 600000 || solo.inc !== 5000) fail('bot seat or clock wrong');
}
{ // nonsense is refused, then the quickest mate there is
  const G = chess.create(players, { clock: 'off' }), W = G.white, Bk = 1 - W;
  if (chess.act(G, Bk, { t: 'move', f: sq('e7'), to: sq('e5') })) fail('Black moved first');
  if (chess.act(G, W, { t: 'move', f: sq('e2'), to: sq('e5') }) || chess.act(G, W, { t: 'move', f: sq('e7'), to: sq('e5') }) || chess.act(G, W, { t: 'move' }) || chess.act(G, W, { t: 'move', f: 1.5, to: 2 }) || chess.act(G, W, { t: 'move', f: '12', to: '28' }) || chess.act(G, W, { t: 'dance' }) || chess.act(G, W, null) || chess.act(G, 5, { t: 'resign' })) fail('nonsense accepted');
  if (chess.act(G, W, { t: 'draw' })) fail('a draw offered before any move');
  line(G, 'f2f3 e7e5 g2g4');
  const v = chess.view(G, W); if (v.moves.join(' ') !== 'f3 e5 g4' || v.turn !== Bk || v.pos.b.length !== 64 || v.check !== -1 || v.clock !== null) fail('view wrong: ' + JSON.stringify(v.moves));
  line(G, 'd8h4');
  if (G.ph !== 'end' || G.res.how !== 'mate' || G.win !== Bk || G.moves[3] !== 'Qh4#' || G.check !== sq('e1')) fail('fool’s mate not seen');
  const r = chess.results(G); if (!r[Bk].win || r[W].win || r[Bk].pts !== 10 || r[W].pts !== 0 || r.some(x => x.idle)) fail('results wrong');
  if (chess.act(G, W, { t: 'resign' }) || go(G, 'e2', 'e4')) fail('acted after the end');
}
{ // resigning, and offering a draw
  let G = chess.create(players, { clock: 'off' }); line(G, 'e2e4 e7e5');
  if (!chess.act(G, 0, { t: 'resign' }) || G.win !== 1 || G.res.how !== 'resign') fail('resign wrong');
  G = chess.create(players, { clock: 'off' }); line(G, 'e2e4 e7e5');
  const a = mover(G), b = 1 - a;
  if (chess.act(G, b, { t: 'nodraw' })) fail('declined an offer nobody made');
  if (!chess.act(G, a, { t: 'draw' }) || G.offer !== a || chess.act(G, a, { t: 'draw' })) fail('offer wrong');
  if (!chess.view(G, b).ev.some(e => e.t === 'offer') || chess.view(G, a).canOffer) fail('offer not shown');
  if (!chess.act(G, b, { t: 'nodraw' }) || G.offer !== -1 || chess.act(G, a, { t: 'draw' })) fail('decline wrong, or a second offer in the same move');
  line(G, 'g1f3 b8c6');
  if (!chess.act(G, a, { t: 'draw' }) || !chess.act(G, b, { t: 'draw' }) || G.ph !== 'end' || G.res.how !== 'agree' || G.win !== -1) fail('agreed draw wrong');
  const r = chess.results(G); if (r.some(x => x.win || x.pts !== 5)) fail('draw results wrong');
  // an offer lapses when the other player just moves on
  G = chess.create(players, { clock: 'off' }); line(G, 'e2e4 e7e5'); chess.act(G, 1 - mover(G), { t: 'draw' }); line(G, 'g1f3');
  if (G.offer !== -1 || !G.ev.some(e => e.t === 'decline')) fail('an offer should lapse when the answer is a move');
  // a bot says no in a level position and yes when it is losing badly
  G = chess.create([players[0]], { clock: 'off' }); const hm = 0, bot = 1;
  if (G.white === hm) line(G, 'e2e4'); else { chess._bot(G, now); }
  while (mover(G) !== hm) chess._bot(G, now);
  const m0 = C.legal(G.pos)[0]; chess.act(G, hm, { t: 'move', f: C.mFrom(m0), to: C.mTo(m0) }); chess._bot(G, now);
  if (!chess.act(G, hm, { t: 'draw' }) || G.ph !== 'play' || G.offer !== -1 || !G.ev.some(e => e.t === 'decline' && e.s === bot)) fail('a bot should decline a draw in a level game');
  if (!likesDraw(C.fromFen('4k3/8/8/8/8/8/8/3QK3 b - - 0 1'), 1) || likesDraw(C.fromFen('4k3/8/8/8/8/8/8/3QK3 b - - 0 1'), 0)) fail('likesDraw wrong');
}
{ // the same position three times is a draw
  const G = chess.create(players, { clock: 'off' });
  line(G, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
  if (G.ph !== 'play') fail('draw called too early');
  line(G, 'f6g8');
  if (G.ph !== 'end' || G.res.how !== 'repeat' || G.win !== -1) fail('threefold repetition not seen');
}
{ // 50 moves without a capture or pawn move
  const G = chess.create(players, { clock: 'off' }); line(G, 'g1f3 g8f6'); G.pos.half = 99; line(G, 'b1c3');
  if (G.ph !== 'end' || G.res.how !== 'fifty') fail('50-move rule not applied');
  const H = chess.create(players, { clock: 'off' }); line(H, 'g1f3 g8f6'); H.pos.half = 99; line(H, 'e2e4');
  if (H.ph !== 'play' || H.pos.half !== 0) fail('a pawn move should reset the count');
}
{ // clocks: time runs for the player to move, the increment is added, the flag falls
  const G = chess.create(players, { clock: '3+2' }), W = G.white;
  now += 1500; // the short wait before White's clock starts
  now += 10000; line(G, 'e2e4');
  if (Math.abs(G.clock[W] - (180000 - 10000 + 2000)) > 5) fail('clock after a move wrong: ' + G.clock[W]);
  now += 4000; const v = chess.view(G, W);
  if (Math.abs(v.clock[1 - W] - 176000) > 5 || v.clock[W] !== G.clock[W]) fail('the clock shown is wrong');
  now += 175000; if (chess.tick(G, now)) fail('flag fell early');
  now += 1100; if (!chess.tick(G, now) || G.ph !== 'end' || G.res.how !== 'time' || G.win !== W || chess.view(G, W).clock[1 - W] !== 0) fail('flag did not fall');
  // out of time against a lone king is only a draw
  const H = chess.create(players, { clock: '3+2' }); H.pos = C.fromFen('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'); now += 200000; chess.tick(H, now);
  if (H.res?.how !== 'timedraw' || H.win !== -1) fail('time against a lone king should be a draw');
  const J = chess.create(players, { clock: '3+2' }); J.pos = C.fromFen('4k3/8/8/8/8/8/P7/4K3 b - - 0 1'); now += 200000; chess.tick(J, now);
  if (J.res?.how !== 'time' || J.win !== J.white) fail('time against a pawn is a loss');
}
{ // a player who left is played by a bot, and one who never moved themselves earns nothing
  const G = chess.create(players, { clock: 'off' });
  chess.setAway(G, 0, true); chess.setAway(G, 1, true);
  for (let i = 0; i < 700 && G.ph === 'play'; i++) chess._bot(G, now, 8);
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  if (!chess.results(G).every(r => r.idle)) fail('a game played only by stand-in bots should count as idle');
}

// ----- bots -----
for (const lv of ['club', 'sharp']) for (const [fen, want] of [['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'Rd8#'], ['r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'Qxf7#'], ['4k3/8/8/8/8/5q2/8/4K2R b K - 0 1', 'Qxh1+|Qe4+']]) { // Qe4+ forks king and rook: it wins the rook too, and club's noise may pick it
  const p = C.fromFen(fen), got = C.san(p, think(p, { ...LEVELS[lv], ms: 300 })); if (!want.split('|').includes(got)) fail(`${lv} bot played ${got}, expected ${want}`);
}
{ // every level always answers with a legal move, and whole bot games end properly
  const ends = {};
  for (const lv of ['easy', 'club']) for (let g = 0; g < 3; g++) {
    const G = chess.create([], { bots: lv, clock: 'off' });
    for (let i = 0; i < 700 && G.ph === 'play'; i++) { const mv = G.mv; if (!chess._bot(G, now, lv === 'easy' ? 6 : 12) || G.mv !== mv + 1) fail('bot did not move'); }
    if (G.ph !== 'end') fail('a bot game ran past 350 moves each');
    ends[G.res.how] = (ends[G.res.how] || 0) + 1;
    if (chess.results(G).some(r => r.idle)) fail('bots are never idle');
  }
  // the stronger level beats the weaker one
  let club = 0, easy = 0;
  for (let g = 0; g < 4; g++) {
    let p = C.startPos(); const seen = new Map(), hist = [p.h]; let st;
    for (let i = 0; i < 400; i++) {
      seen.set(C.posKey(p), (seen.get(C.posKey(p)) || 0) + 1); st = C.status(p, seen); if (st.over) break;
      const isClub = (p.turn === 0) === (g % 2 === 0);
      p = C.play(p, think(C.clone(p), { ...LEVELS[isClub ? 'club' : 'easy'], ms: isClub ? 40 : 15, history: hist })); hist.push(p.h);
    }
    if (st?.over && st.win >= 0) (st.win === 0) === (g % 2 === 0) ? club++ : easy++;
  }
  if (club < 3 || easy > 0) fail(`the club bot should beat the beginner: ${club} to ${easy}`);
  console.log(`bots: games ended by ${JSON.stringify(ends)}; club beat beginner ${club} : ${easy} of 4`);
}
Date.now = realNow;

// ----- over the real server (the bot thinks on its worker thread here) -----
const PORT = 26980 + (Math.random() * 900 | 0);
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
send({ t: 'create', game: 'chess', opts: { clock: '5+3', bots: 'sharp', seats: 6 } });
await wait(300);
if (room?.game !== 'chess' || room.opts.clock !== '5+3' || room.opts.bots !== 'sharp' || 'seats' in room.opts || room.max !== 2) bail('room options wrong');
send({ t: 'opts', opts: { bots: 'club' } }); await wait(200);
if (room.opts.bots !== 'club' || room.opts.clock !== '5+3') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'chess' || state.seats.length !== 2 || state.pos.b.length !== 64 || !state.seats[1 - state.me].bot || state.clock?.length !== 2) bail('game did not start');
let turns = 0;
for (let i = 0; i < 2000 && state.ph === 'play' && turns < 8; i++) {
  if (state.turn === state.me) {
    const p = state.pos, ms = C.legal(C.fromBoard(p.b, p.turn, p.castle, p.ep, p.half, p.full)), m = ms[(turns * 5 + 2) % ms.length], mv = state.mv;
    send({ t: 'act', a: { t: 'move', f: C.mFrom(m), to: C.mTo(m) } }); turns++;
    for (let k = 0; k < 80 && state.mv === mv && state.ph === 'play'; k++) await wait(25);
    if (state.mv === mv && state.ph === 'play') bail('the server refused a legal move');
  } else await wait(50);
}
for (let k = 0; k < 200 && state.ph === 'play' && state.turn !== state.me; k++) await wait(50); // the bot's answer comes from its worker thread
if (state.ph === 'play' && state.mv < 15) bail('the bot stopped answering: ' + state.mv + ' moves');
if (state.ph === 'play') { send({ t: 'act', a: { t: 'resign' } }); await wait(300); }
if (state.ph !== 'end') bail('game over the server did not finish');
await wait(300);
const won = state.win === state.me, tie = state.win < 0;
if (!me?.gain || me.gain.coins !== (won || tie ? 10 : 1)) bail('wrong coins paid at the end: ' + JSON.stringify(me?.gain));
if (me.gain.ranked) bail('a game against a bot must not count for the rankings');
if (!room.board?.length || room.paid?.[1 - state.me] !== 'b') bail('table scoreboard or coins column wrong');
console.log('OK server game:', state.moves.length, 'moves,', state.res.how, won ? 'won' : tie ? 'drawn' : 'lost', '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

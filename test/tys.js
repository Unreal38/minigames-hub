// Tysiąc test: checks the card rules, plays whole games on a fake clock (making sure nobody is ever sent
// another player's cards or the face-down musik), then opens a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as ty from '../server/games/tys.js';
import { DECK, MELD, card, suitOf, value, power, legal, winnerOf, beats, maxBid, melds, canMeld, round10, king, queen, ace, ten, sortHand } from '../public/games/tys/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const H = 0, D = 1, C = 2, S = 3, nine = s => card(s, 0), jack = s => card(s, 1);

// ----- rules -----
if (DECK.length !== 24 || new Set(DECK).size !== 24 || DECK.reduce((a, c) => a + value(c), 0) !== 120) fail('the deck should be 24 cards worth 120');
if (!(power(ace(H)) > power(ten(H)) && power(ten(H)) > power(king(H)) && power(king(H)) > power(queen(H)) && power(queen(H)) > power(jack(H)) && power(jack(H)) > power(nine(H)))) fail('card order wrong (the ten beats the king)');
if (value(ace(S)) !== 11 || value(ten(S)) !== 10 || value(king(S)) !== 4 || value(queen(S)) !== 3 || value(jack(S)) !== 2 || value(nine(S)) !== 0) fail('card points wrong');
if (MELD[H] !== 100 || MELD[D] !== 80 || MELD[C] !== 60 || MELD[S] !== 40) fail('marriage values wrong');
if (maxBid([ace(H), ten(H)]) !== 120 || maxBid([king(S), queen(S), ace(H)]) !== 160 || maxBid([king(H), queen(H), king(D), queen(D)]) !== 300) fail('bid limit wrong');
if (melds([king(C), queen(C), king(D)]).join() !== '2' || !canMeld([king(C), queen(C)], queen(C)) || canMeld([king(C), queen(D)], king(C)) || canMeld([king(C), queen(C), ace(C)], ace(C))) fail('marriages wrong');
if (round10(44) !== 40 || round10(45) !== 50 || round10(0) !== 0 || round10(96) !== 100) fail('rounding wrong');
if (!beats(ten(H), king(H), -1) || beats(king(H), ten(H), -1) || beats(ace(D), nine(H), -1) || !beats(nine(D), ace(H), D) || beats(ace(H), nine(D), D)) fail('beats wrong');
if (winnerOf([king(H), ace(D), ten(H)], -1) !== 2 || winnerOf([king(H), nine(S), ace(H)], S) !== 1 || winnerOf([nine(S), ace(H), jack(S)], S) !== 2) fail('trick winner wrong');
{ // following suit, trumping and beating are all forced
  const same = (a, b) => [...a].sort().join() === [...b].sort().join();
  const hand = [ace(H), nine(H), king(D), nine(S)];
  if (!same(legal(hand, [], -1), hand)) fail('any card may be led');
  if (!same(legal(hand, [king(H)], -1), [ace(H)])) fail('must beat in the suit led');
  if (!same(legal([queen(H), nine(H), king(D)], [king(H)], -1), [queen(H), nine(H)])) fail('must follow suit when it cannot be beaten');
  if (!same(legal([king(D), nine(S), jack(S)], [king(H)], S), [nine(S), jack(S)])) fail('must trump when out of the suit');
  if (!same(legal([king(D), nine(S), ace(S)], [king(H), jack(S)], S), [ace(S)])) fail('must beat the trump on the table');
  if (!same(legal([king(D), nine(S)], [king(H), jack(S)], S), [nine(S)])) fail('must still play a trump that cannot win');
  if (!same(legal([ace(H), nine(H)], [king(H), jack(S)], S), [ace(H), nine(H)])) fail('a trumped trick cannot be beaten in the suit led');
  if (!same(legal([king(D), nine(C)], [king(H)], S), [king(D), nine(C)])) fail('with neither suit nor trump anything goes');
  if (sortHand(DECK).length !== 24 || suitOf(sortHand(DECK)[0]) !== S || sortHand(DECK)[0] !== ace(S)) fail('hand sorting wrong');
}

// ----- whole games -----
// Humans here play like the bots do (the same engine function), so every game finishes.
function play(opts, human = (G, s, now) => ty._bot(G, s, now)) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = ty.create(players, opts), n = G.seats.length;
    if (n !== (opts.seats || 3)) fail('seats not filled with bots');
    let hands = 0, seen = 0, melded = 0;
    for (let i = 0; i < 2000000 && G.ph === 'play'; i++) {
      now += 100;
      if (G.active.length !== 3 || (n === 4 && G.active.includes(G.dealer))) fail('three play a hand; with four the dealer sits out');
      const all = [...G.hands.flat(), ...G.musik, ...G.gone];
      if (all.length !== 24 || new Set(all).size !== 24) fail(`cards lost or doubled during ${G.stage}`);
      // nobody may see another hand, or the musik before the bidding is won
      for (let s = -1; s < n; s++) {
        const v = ty.view(G, s);
        v.seats.forEach((p, j) => {
          if (j !== s && p.cards) fail(`seat ${s} was sent seat ${j}'s cards during ${G.stage}`);
          if (j === s && p.cards.length !== G.hands[s].length) fail('own cards missing');
        });
        if (v.musik && G.stage !== 'take') fail('musik shown outside the reveal');
        if (v.got && !(s === G.decl && G.stage === 'give')) fail('musik cards marked for the wrong player');
        if (v.legal && !(s === G.turn && G.stage === 'play')) fail('legal cards sent out of turn');
        const txt = JSON.stringify({ ...v, seats: v.seats.map((p, j) => (j === s ? 0 : p)), legal: 0, got: 0, trick: 0, lastTrick: 0, musik: 0, ev: v.ev.filter(e => e.t !== 'play') });
        if (/"(cards|hands|gone|feel)":/.test(txt.replace(/"cards":null/g, ''))) fail('cards leaked somewhere in the view');
      }
      const s = G.turn, st = G.stage;
      if (s >= 0 && G.seats[s].human && !G.seats[s].bot) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && (ty.act(G, other, { t: 'pass' }) || ty.act(G, other, { t: 'play', c: G.hands[other][0] }))) fail('acted out of turn');
        if (ty.act(G, s, { t: 'dance' }) || ty.act(G, s, null)) fail('nonsense accepted');
        if (st === 'bid') {
          if (ty.act(G, s, { t: 'bid', v: G.bid.v }) || ty.act(G, s, { t: 'bid', v: G.bid.v + 5 }) || ty.act(G, s, { t: 'bid', v: 400 }) || ty.act(G, s, { t: 'bid', v: '110' })) fail('bad bid accepted');
          if (!melds(G.hands[s]).length && G.bid.v < 130 && ty.act(G, s, { t: 'bid', v: 130 })) fail('bid over 120 without a marriage');
          if (ty.act(G, s, { t: 'play', c: G.hands[s][0] })) fail('played a card during the bidding');
        } else if (st === 'give') {
          const h = G.hands[s]; if (h.length !== 10) fail('the declarer should hold 10 cards with the musik');
          if (ty.act(G, s, { t: 'give', c: [h[0], h[0]] }) || ty.act(G, s, { t: 'give', c: [h[0]] }) || ty.act(G, s, { t: 'give', c: [h[0], 0] }) || ty.act(G, s, { t: 'give', c: [h[0], h[1]], v: G.contract - 10 }) || ty.act(G, s, { t: 'give', c: [h[0], h[1]], v: 990 })) fail('bad give accepted');
        } else if (st === 'play') {
          const ok = legal(G.hands[s], G.trick.map(x => x.c), G.trump), bad = G.hands[s].find(c => !ok.includes(c));
          if (bad !== undefined && ty.act(G, s, { t: 'play', c: bad })) fail('illegal card accepted');
          if (ty.act(G, s, { t: 'play', c: DECK.find(c => !G.hands[s].includes(c)) })) fail("played a card that is not in the hand");
          const k = G.hands[s].find(c => !canMeld(G.hands[s], c) && ok.includes(c));
          if (k !== undefined && G.trick.length === 0) { const t0 = G.trump, p0 = G.pts[s]; const h = [...G.hands[s]]; ty.act(G, s, { t: 'play', c: k, meld: true }); if (G.trump !== t0 || G.pts[s] !== p0) fail('a marriage was announced without the king and queen'); if (G.hands[s].length === h.length) fail('play refused'); continue; }
        }
        const before = G.evN; human(G, s, now); if (G.evN === before) fail(`human move refused during ${st}`);
      } else ty.tick(G, now);
      if (G.stage === 'play' && st === 'give') {
        if (G.active.some(j => G.hands[j].length !== 8)) fail('everyone should hold 8 cards once the musik is shared out');
        if (G.contract < G.bid.v || G.lead !== G.decl || G.turn !== G.decl) fail('the declarer should lead for at least the bid');
      }
      if (G.mel.flat().length < seen) seen = 0;
      if (G.mel.flat().length > seen) { seen = G.mel.flat().length; melded++; if (G.trump !== G.mel[G.trick[0].s].at(-1)) fail('a marriage should set trumps'); }
      if (G.stage === 'score' && st !== 'score') {
        hands++; const m = G.sum, d = m.decl;
        if (G.active.reduce((a, j) => a + m.pts[j], 0) !== 120 + G.mel.flat().reduce((a, su) => a + MELD[su], 0)) fail('points in a hand should add up to 120 plus marriages');
        if (m.made !== (m.pts[d] >= m.contract) || m.delta[d] !== (m.made ? m.contract : -m.contract)) fail('the contract was scored wrong');
        for (const j of G.active) if (j !== d) {
          const was = m.score[j] - m.delta[j];
          if (m.delta[j] < 0 || m.delta[j] % 10 || m.delta[j] > round10(m.pts[j])) fail('a defender was scored wrong');
          if (was >= G.barrel ? m.delta[j] !== 0 : m.score[j] > G.barrel) fail('the barrel let points through');
          if (was + round10(m.pts[j]) <= G.barrel && m.delta[j] !== round10(m.pts[j])) fail('a defender lost points');
        }
        G.seats.forEach((_, j) => { if (!G.active.includes(j) && m.delta[j]) fail('the dealer sitting out scored'); });
      }
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = ty.results(G);
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || r.some(x => x.pts < 0) || r[G.win].place !== 1) fail('results disagree');
    for (let k = 1; k < n; k++) if (G.score[G.res.order[k - 1]] < G.score[G.res.order[k]]) fail('placing order wrong');
    if (G.hand < ty.MAX_HANDS && G.score[G.win] < G.target) fail('ended before anyone reached the target');
    return { G, hands, melded };
  } finally { Date.now = realNow; }
}
const a = play({ bots: 'sharp' });
console.log('classic: winner', a.G.seats[a.G.win].name, 'with', a.G.score[a.G.win], 'after', a.hands, 'hands and', a.melded, 'marriages');
const b = play({ seats: 4, target: 500 });
if (b.G.target !== 500 || b.G.barrel !== 400) fail('options not applied');
console.log('four seats to 500: winner', b.G.seats[b.G.win].name, 'after', b.hands, 'hands');
// a human who always passes, gives away the first two cards and plays the first legal card
play({ target: 500 }, (G, s) => {
  const ok = G.stage === 'bid' ? ty.act(G, s, { t: 'pass' }) : G.stage === 'give' ? ty.act(G, s, { t: 'give', c: G.hands[s].slice(0, 2) })
    : ty.act(G, s, { t: 'play', c: legal(G.hands[s], G.trick.map(x => x.c), G.trump)[0], meld: true });
  if (!ok) fail('simple move refused');
});
// a human who always bids as high as allowed and raises the contract
play({ target: 500 }, (G, s, now) => {
  if (G.stage === 'bid') { if (!(G.bid.v + 10 <= maxBid(G.hands[s]) ? ty.act(G, s, { t: 'bid', v: G.bid.v + 10 }) : ty.act(G, s, { t: 'pass' }))) fail('bid refused'); }
  else if (G.stage === 'give') { const h = G.hands[s], keep = h.slice(2), v = Math.max(G.contract, Math.min(maxBid(keep), G.contract + 10)); if (!ty.act(G, s, { t: 'give', c: h.slice(0, 2), v }) || G.contract !== v) fail('raise refused'); }
  else ty._bot(G, s, now);
});

{ // sharp bots should beat chill ones, contracts should be made about as often as not, and games should not drag
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let sharp = 0, hands = 0, made = 0, played = 0; const N = 240;
  for (let g = 0; g < N; g++) {
    const G = ty.create([], { seats: 3 }), lone = g % 3; // one sharp bot against two chill ones
    while (G.ph === 'play') { now += 500; const s = G.turn; if (s >= 0 && !G.stageEnd) ty._bot(G, s, now, s === lone ? 'sharp' : 'chill'); else ty.tick(G, now); }
    if (G.win === lone) sharp++; hands += G.hand; for (const st of G.st) { made += st.made; played += st.played; }
  }
  Date.now = realNow;
  console.log(`bots: the sharp one won ${sharp}/${N} against two chill ones, ${(hands / N).toFixed(1)} hands a game, ${(made / played * 100).toFixed(0)}% of contracts made`);
  if (sharp < N * .36) fail('sharp bots are not better than chill ones');
  if (hands / N > 45 || made / played < .35) fail('games drag: too many failed contracts');
}
{ // the turn timer plays for you; a player who leaves is played by a bot; a watcher takes a bot's seat at the next deal
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  const G = ty.create(players, { seats: 3, timer: 20 });
  for (let i = 0; i < 5000 && !(G.turn >= 0 && G.seats[G.turn].human); i++) { now += 100; ty.tick(G, now); }
  const n0 = G.evN; now += 20100; ty.tick(G, now);
  if (G.evN === n0) fail('timer did not play the turn');
  ty.seatWatcher(G, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] });
  if (G.seats.some(s => s.id === 'c')) fail('watcher seated in the middle of a hand');
  ty.setAway(G, 0, true);
  const h0 = G.hand;
  for (let i = 0; i < 20000 && G.hand === h0 && G.ph === 'play'; i++) { now += 100; ty.tick(G, now); }
  if (G.ph === 'play' && !G.seats.some(s => s.id === 'c' && s.human)) fail('watcher was not seated at the new hand');
  Date.now = realNow;
}

// ----- over the real server -----
const PORT = 22080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'tys', opts: { seats: 4, target: 500, timer: 20, dice: 3 } });
await wait(300);
if (room?.game !== 'tys' || room.opts.seats !== 4 || room.opts.target !== 500 || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 3 } }); await wait(200);
if (room.opts.seats !== 3 || room.opts.target !== 500 || room.opts.timer !== 20) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'tys' || state.seats.length !== 3 || state.seats[state.me].cards?.length !== 7 || state.stage !== 'deal') bail('game did not start');
if (state.seats.some((p, i) => i !== state.me && p.cards) || state.musik) bail('the server sent cards that are not ours');
// sit through the deal, then pass (or get passed to) and see the hand move on
for (let i = 0; i < 150 && !(state.stage === 'bid' && state.turn === state.me) && state.stage !== 'take' && state.stage !== 'give'; i++) await wait(100);
if (state.stage === 'bid') { send({ t: 'act', a: { t: 'bid', v: 105 } }); await wait(150); if (state.bid.v === 105) bail('a bid that is not a ten was accepted'); send({ t: 'act', a: { t: 'pass' } }); await wait(200); if (!state.seats[state.me].passed) bail('pass over the server failed'); }
for (let i = 0; i < 150 && !['take', 'give', 'play'].includes(state.stage); i++) await wait(100);
if (!['take', 'give', 'play'].includes(state.stage) || state.decl < 0) bail('bidding over the server did not finish');
if (state.seats.some((p, i) => i !== state.me && p.cards)) bail('the server sent cards that are not ours');
console.log('OK server: tysiąc table dealt, bidding won by', state.seats[state.decl].name, 'for', state.contract);
ws.close(); srv.kill();
console.log('ALL OK');

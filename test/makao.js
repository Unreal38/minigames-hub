// Makao test: checks the card rules (fights, fours, Jack demands, Aces, the fighting kings, the calls), plays whole
// games on a fake clock (making sure nobody is ever sent another player's hand and all 52 cards are always
// accounted for), then a table over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as mk from '../server/games/makao.js';
import { deck, rankOf, suitOf, fits, canPlay, playable, isPlain, drawOf, KH, KS, JACK, ACE, QUEEN, FOUR, DEMANDS } from '../public/games/makao/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const four = [...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2] }, { id: 'd', name: 'Di', color: '#ffb547', av: [3] }];
const H = 0, D = 1, C = 2, S = 3;
const R = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, J: 9, Q: 10, K: 11, A: 12 };
const card = (r, s) => s * 13 + R[r];

// ----- rules -----
{
  const d = deck();
  if (d.length !== 52 || new Set(d).size !== 52) fail('deck wrong');
  if (card('K', H) !== KH || card('K', S) !== KS) fail('fighting kings wrong');
  if (d.filter(isPlain).length !== 24 || isPlain(card('Q', H)) || isPlain(card(4, H)) || !isPlain(card(5, C)) || !isPlain(card(10, S))) fail('plain cards are 5 to 10');
  if (drawOf(card(2, C)) !== 2 || drawOf(card(3, C)) !== 3 || drawOf(KH) !== 5 || drawOf(KS) !== 5 || drawOf(card('K', D)) || drawOf(KH, false)) fail('draw counts wrong');
  const T = (top, o = {}) => ({ top, suit: suitOf(top), owe: 0, stop: 0, dem: -1, queens: false, kings: true, ...o });
  const t = T(card(7, H));
  if (!fits(card(9, H), t) || !fits(card(7, S), t) || fits(card(9, S), t) || fits(card('Q', S), t)) fail('matching wrong');
  if (!fits(card('Q', S), T(card(7, H), { queens: true })) || !fits(card(5, C), T(card('Q', S), { queens: true })) || fits(card(5, C), T(card('Q', S)))) fail('queens rule wrong');
  if (!fits(card(9, C), T(card('A', H), { suit: C })) || fits(card(9, H), T(card('A', H), { suit: C })) || !fits(card('A', D), T(card('A', H), { suit: C }))) fail('after an Ace the picked suit counts');
  const f = T(card(2, H), { owe: 2 });
  if (!fits(card(2, S), f) || !fits(card(3, H), f) || !fits(KH, f) || fits(card(3, S), f) || fits(KS, f) || fits(card(7, H), f) || fits(card('A', H), f)) fail('fight defence wrong');
  if (!fits(KS, T(KH, { owe: 5 })) || !fits(card(2, S), T(KS, { owe: 5 })) || fits(card('K', D), T(KH, { owe: 5 })) || fits(KS, T(KH, { owe: 5, kings: false }))) fail('king fight wrong');
  if (fits(card(2, S), T(card(2, H), { owe: 2, queens: true }) ) === false || fits(card('Q', H), T(card(2, H), { owe: 2, queens: true }))) fail('a Queen does not stop a fight');
  const w = T(card(4, H), { stop: 1 });
  if (!fits(card(4, S), w) || fits(card(7, H), w) || fits(card('Q', H), { ...w, queens: true })) fail('only a four answers a four');
  const dm = T(card('J', H), { dem: R[7] });
  if (!fits(card(7, S), dm) || !fits(card('J', C), dm) || fits(card(9, H), dm) || fits(card('A', H), dm)) fail('demand wrong');
  if (fits(-1, t) || fits(52, t) || fits('3', t) || fits(2.5, t)) fail('nonsense card accepted');
  const hand = [card(7, S), card(7, D), card(9, S), card(7, H)];
  if (!canPlay(hand, [card(7, S), card(7, D)], t) || canPlay(hand, [card(7, S), card(9, S)], t) || canPlay(hand, [card(7, S), card(7, S)], t) || canPlay(hand, [card(7, C)], t) || canPlay(hand, [], t) || canPlay(hand, 'x', t)) fail('sets wrong');
  if (canPlay([card(9, S), card(9, H)], [card(9, S), card(9, H)], t) || !canPlay([card(9, S), card(9, H)], [card(9, H), card(9, S)], t)) fail('the first card of a set must fit');
  if (playable(hand, t).length !== 3) fail('playable wrong');
  if (DEMANDS.length !== 6 || DEMANDS.some(r => !isPlain(r))) fail('demands are 5 to 10');
}

const clock = () => { const realNow = Date.now; let now = realNow(); Date.now = () => now; return { add: ms => (now += ms), get now() { return now; }, done: () => { Date.now = realNow; } }; };
const ready = (G, T) => { T.add(5000); mk.tick(G, T.now); if (G.stage !== 'play') fail('deal did not end'); };
const setup = (people, opts, hands, top, turn = 0) => {
  const T = clock(), G = mk.create(people, { timer: 0, end: 'last', ...opts }); ready(G, T);
  const inHands = new Set(hands.flat());
  G.hands = hands.map(h => [...h]); G.pile = [top]; G.suit = suitOf(top); G.turn = turn;
  G.stock = deck().filter(c => !inHands.has(c) && c !== top);
  const go = (s, cs, pick) => { if (G.turn !== s) fail(`expected seat ${s}, it is seat ${G.turn}`); if (!mk.act(G, s, { t: 'play', cs, pick })) fail('play refused ' + JSON.stringify([s, cs, G.pile.at(-1), G.suit, G.stage, G.hands[s]])); };
  const no = (s, cs, pick, why) => { if (mk.act(G, s, { t: 'play', cs, pick })) fail(why); };
  return { G, T, go, no };
};
const pad = s => [card(5, s), card(6, s), card(8, s)];

{ // 2 and 3 add up, a defender passes the fight on, the loser takes everything and misses the turn
  const { G, T, go, no } = setup(four, { seats: 4 }, [[card(2, H), ...pad(H)], [card(3, H), ...pad(D)], [card(3, C), card(9, C), card(10, C)], [card(9, S), ...pad(S)]], card(7, H));
  go(0, [card(2, H)]); if (G.owe !== 2 || G.turn !== 1) fail('a two should be owed');
  no(1, [card(5, D)], 0, 'a plain card was played in a fight');
  go(1, [card(3, H)]); if (G.owe !== 5 || G.turn !== 2) fail('a three of the suit should pass it on');
  go(2, [card(3, C)]); if (G.owe !== 8 || G.turn !== 3) fail('a three on a three should pass it on');
  if (!mk.act(G, 3, { t: 'draw' }) || G.hands[3].length !== 12 || G.owe || G.turn !== 0 || G.stage !== 'play') fail('the loser takes all eight and the turn moves on');
  T.done();
}
{ // King of hearts hits the next player, King of spades the one before; the turn then carries on from them
  const { G, T, go } = setup(four, { seats: 4 }, [[KS, ...pad(H)], [card(9, D), ...pad(D)], [card(9, C), ...pad(C)], [KH, card(9, S), card(10, S)]], card(7, S));
  go(0, [KS]); if (G.turn !== 3 || G.owe !== 5) fail('the King of spades should go to the player before');
  go(3, [KH]); if (G.turn !== 0 || G.owe !== 10) fail('the King of hearts should send it on to the next player');
  mk.act(G, 0, { t: 'draw' }); if (G.hands[0].length !== 13 || G.turn !== 1) fail('ten cards for the loser');
  T.done();
}
{ // King of spades with nobody defending: they take 5 and the king's player goes again
  const { G, T, go } = setup(four, { seats: 4 }, [[KS, ...pad(H)], pad(D), pad(C), [card(9, D), card(9, C), card(10, D)]], card(7, S));
  go(0, [KS]); mk.act(G, 3, { t: 'draw' });
  if (G.hands[3].length !== 8 || G.turn !== 0) fail('after the King of spades play carries on from the one who drew');
  T.done();
}
{ // with fighting kings off the kings are plain
  const { G, T, go } = setup(players, { seats: 2, kings: 'off' }, [[KS, ...pad(H)], pad(D)], card(7, S));
  go(0, [KS]); if (G.owe || G.turn !== 1) fail('kings should be plain'); T.done();
}
{ // fours: the waits add up, and two fours mean two missed turns for the one who cannot answer
  const { G, T, go, no } = setup(four, { seats: 4 }, [[card(4, H), ...pad(H)], [card(4, D), ...pad(D)], [card(9, D), ...pad(C)], [card(10, D), ...pad(S)]], card(7, H));
  go(0, [card(4, H)]); go(1, [card(4, D)]);
  if (G.stop !== 2 || G.turn !== 2) fail('fours should add up');
  no(2, [card(9, D)], 0, 'a plain card answered a four');
  mk.act(G, 2, { t: 'draw' });
  if (G.stop || G.wait[2] !== 1 || G.turn !== 3 || G.hands[2].length !== 4) fail('waiting takes no cards and the turn moves on');
  go(3, [card(10, D)]); if (G.turn !== 0) fail('turn after the four');
  T.done();
}
{ // ... the second missed turn comes when play gets back round
  const { G, T, go } = setup(players, { seats: 2 }, [[card(4, H), card(4, D), card(9, D), card(10, D), card(8, D)], pad(S)], card(7, H));
  go(0, [card(4, H), card(4, D)]); if (G.stop !== 2 || G.turn !== 1) fail('two fours at once wait two');
  mk.act(G, 1, { t: 'draw' }); if (G.turn !== 0 || G.wait[1] !== 1) fail('first missed turn');
  go(0, [card(9, D)]); if (G.turn !== 0 || G.wait[1] !== 0) fail('second missed turn');
  go(0, [card(10, D)]); if (G.turn !== 1) fail('after two missed turns they play again');
  T.done();
}
{ // a Jack demands a rank from everyone, the demander last; a Jack on a Jack changes it; then the demand is over
  const { G, T, go, no } = setup(four, { seats: 4 }, [[card('J', H), card(7, H), card(6, H), card(5, H)], [card(7, D), ...pad(D)], [card('J', C), card(9, C), card(10, C), card(5, C)], [card(9, S), ...pad(S)]], card(8, H));
  go(0, [card('J', H)], R[7]); if (G.dem !== R[7] || G.demLeft !== 4) fail('demand not set');
  no(1, [card(5, D)], 0, 'the wrong rank was played under a demand');
  go(1, [card(7, D)]); if (G.demLeft !== 3) fail('demand should count down');
  go(2, [card('J', C)], R[9]); if (G.dem !== R[9] || G.demLeft !== 4) fail('a Jack should change the demand');
  go(3, [card(9, S)]);
  mk.act(G, 0, { t: 'draw' }); if (G.stage === 'drawn') mk.act(G, 0, { t: 'keep' });
  mk.act(G, 1, { t: 'draw' }); if (G.stage === 'drawn') mk.act(G, 1, { t: 'keep' });
  if (G.dem !== R[9] || G.demLeft !== 1 || G.turn !== 2) fail('the demander plays last under their own demand');
  no(2, [card(10, C)], 0, 'the demander must follow the demand too');
  go(2, [card(9, C)]); if (G.dem !== -1) fail('the demand should be over');
  if (G.turn !== 3) fail('turn after the demand');
  const bad = setup(players, { seats: 2 }, [[card('J', H), ...pad(H)], pad(D)], card(8, H));
  bad.go(0, [card('J', H)], R.A); if (!DEMANDS.includes(bad.G.dem)) fail('only 5 to 10 can be demanded');
  bad.T.done(); T.done();
}
{ // an Ace changes the suit
  const { G, T, go, no } = setup(players, { seats: 2 }, [[card('A', H), ...pad(H)], [card(9, C), card(9, H), ...pad(D)]], card(8, H));
  go(0, [card('A', H)], C); if (G.suit !== C) fail('Ace suit not set');
  no(1, [card(9, H)], 0, 'the old suit was played after an Ace');
  go(1, [card(9, C)]); if (G.suit !== C) fail('suit follows the top card');
  T.done();
}
{ // "Makao!" and "Po makale!": say it before you play, or be caught and take five
  const { G, T, go } = setup(four, { seats: 4 }, [[card(7, D), card(9, H)], [card(9, D), card(10, D), ...pad(D)], [card(9, C), ...pad(C)], [card(9, S), card(10, H)]], card(7, H));
  go(0, [card(7, D)]); // forgot
  if (G.open !== 0 || G.openKind !== 'makao') fail('a forgotten Makao should be catchable');
  if (mk.act(G, 0, { t: 'catch' })) fail('you cannot catch yourself');
  if (!mk.act(G, 2, { t: 'catch' }) || G.hands[0].length !== 6 || G.open !== -1) fail('a catch should give five');
  if (mk.act(G, 3, { t: 'catch' })) fail('caught twice');
  go(1, [card(9, D)]); go(2, [card(9, C)]);
  if (mk.act(G, 0, { t: 'call' })) fail('called out of turn');
  if (!mk.act(G, 3, { t: 'call' })) fail('call refused');
  go(3, [card(9, S)]);
  if (G.open !== -1 || !mk.view(G, 0).seats[3].mk) fail('a called Makao is safe and shown');
  // a late call before anyone catches you still counts
  G.turn = 1; G.stage = 'play'; G.hands[1] = [card(10, S), card(5, D)]; G.pile.push(card(10, C)); G.suit = C;
  go(1, [card(10, S)]);
  if (G.open !== 1 || !mk.act(G, 1, { t: 'call' }) || G.open !== -1 || mk.act(G, 0, { t: 'catch' })) fail('late call wrong');
  // the last card without "Po makale!": caught means five cards and you are back in
  G.turn = 3; G.stage = 'play'; G.hands[3] = [card(9, S)]; G.pile.push(card(8, S)); G.suit = S;
  go(3, [card(9, S)]);
  if (G.open !== 3 || G.openKind !== 'po' || G.done[3]) fail('a forgotten Po makale should be catchable');
  if (!mk.act(G, 0, { t: 'catch' }) || G.hands[3].length !== 5 || G.done[3]) fail('caught without Po makale: five cards');
  // not caught before the next player moves: out after all
  G.turn = 3; G.stage = 'play'; G.hands[3] = [card(9, S)]; G.pile.push(card(8, S)); G.suit = S; G.owe = 0;
  go(3, [card(9, S)]); const t = G.turn; mk.act(G, t, { t: 'draw' });
  if (!G.done[3] || G.out[0] !== 3 || mk.act(G, 1, { t: 'catch' })) fail('uncaught Po makale should count as out');
  // said in time: out at once
  G.turn = 2; G.stage = 'play'; G.drawn = -1; G.hands[2] = [card(5, C), card(5, S)]; G.pile.push(card(5, H)); G.suit = H; G.owe = 0; G.dem = -1;
  if (!mk.act(G, 2, { t: 'call' })) fail('Po makale refused');
  go(2, [card(5, C), card(5, S)]);
  if (!G.done[2] || G.out[1] !== 2 || G.open !== -1) fail('Po makale said in time');
  T.done();
}
{ // a drawn card that fits may be played or kept; only the drawer sees it; the queens rule
  const { G, T, go } = setup(players, { seats: 2, queens: 'on' }, [[card(5, D), card(6, D), card(8, D)], [card('Q', S), card(9, C), card(10, C)]], card(7, H));
  G.stock.push(card(9, H));
  mk.act(G, 0, { t: 'draw' });
  if (G.stage !== 'drawn' || G.drawn !== card(9, H) || mk.view(G, 0).drawn !== card(9, H) || mk.view(G, 1).drawn !== -1) fail('drawn card wrong');
  if (mk.act(G, 0, { t: 'play', cs: [card(5, D)] }) || mk.act(G, 0, { t: 'draw' })) fail('after drawing only the drawn card may be played');
  go(0, [card(9, H)]); go(1, [card('Q', S)]); go(0, [card(5, D)]);
  T.done();
}
{ // going out with a two still makes the next player draw, and the last one holding cards loses
  const { G, T, go } = setup(four.slice(0, 3), { seats: 3 }, [[card(2, H)], [card(9, D), card(10, D)], pad(C)], card(7, H));
  mk.act(G, 0, { t: 'call' }); go(0, [card(2, H)]);
  if (!G.done[0] || G.turn !== 1 || G.owe !== 2) fail('out with a two');
  mk.act(G, 1, { t: 'draw' }); if (G.hands[1].length !== 4 || G.turn !== 2) fail('the two still counts');
  G.hands[2] = [card(5, H)]; mk.act(G, 2, { t: 'call' }); go(2, [card(5, H)]);
  if (G.ph !== 'end' || G.res.order.join() !== '0,2,1' || G.res.loser !== 1) fail('end order wrong: ' + G.res?.order);
  const r = mk.results(G); if (!r[0].win || r[1].place !== 3 || r[2].pts !== 10) fail('results wrong');
  T.done();
}
{ // by default the first one out ends the game and the others are placed by cards left
  const { G, T, go } = setup(four.slice(0, 3), { seats: 3, end: 'first' }, [[card(5, H)], [card(9, D), card(10, D), card(8, D)], [card(9, C), card(10, C)]], card(7, H));
  mk.act(G, 0, { t: 'call' }); go(0, [card(5, H)]);
  if (G.ph !== 'end' || G.res.order.join() !== '0,2,1' || G.res.loser !== -1) fail('first out should end the game: ' + G.res?.order);
  T.done();
  // without "Po makale!" the others get a moment to catch, then it ends by itself
  const b = setup(four.slice(0, 3), { seats: 3, end: 'first' }, [[card(5, H)], [card(9, D), card(10, D), card(8, D)], [card(9, C), card(10, C)]], card(7, H));
  b.go(0, [card(5, H)]); if (b.G.ph !== 'play' || b.G.open !== 0) fail('a forgotten Po makale should wait for a catch');
  b.T.add(3000); mk.tick(b.G, b.T.now); if (b.G.ph !== 'end' || b.G.win !== 0) fail('uncaught: the game should end');
  b.T.done();
  const c = setup(four.slice(0, 3), { seats: 3, end: 'first' }, [[card(5, H)], [card(9, D), card(10, D), card(8, D)], [card(9, C), card(10, C)]], card(7, H));
  c.go(0, [card(5, H)]); mk.act(c.G, 1, { t: 'catch' }); c.T.add(3000); mk.tick(c.G, c.T.now);
  if (c.G.ph !== 'play' || c.G.hands[0].length !== 5) fail('caught: the game goes on');
  c.T.done();
}

// ----- whole games -----
function play(opts, human = (G, s, now) => mk._bot(G, s, now, 'chill'), people = players) {
  const T = clock();
  try {
    const G = mk.create(people, opts), n = G.seats.length;
    if (n !== Math.max(opts.seats || 4, people.length) || G.hands.some(h => h.length !== 5) || !isPlain(G.pile[0])) fail('seats or deal wrong');
    if (mk.act(G, G.turn, { t: 'draw' }) && G.seats[G.turn]?.human) fail('played during the deal');
    for (let i = 0; i < 100000 && G.ph === 'play'; i++) {
      T.add(100);
      const all = [...G.pile, ...G.stock, ...G.hands.flat()];
      if (all.length !== 52 || new Set(all).size !== 52) fail('cards lost or copied');
      if (G.suit < 0 || G.suit > 3 || G.owe < 0 || G.stop < 0 || (G.owe && G.stop) || (G.dem >= 0 && (G.owe || G.stop))) fail('table state wrong');
      for (let s = -1; s < n; s++) { // nobody may see another hand or another player's drawn card
        const v = mk.view(G, s);
        v.seats.forEach((p, j) => { if (j !== s && p.hand) fail(`seat ${s} was sent seat ${j}'s hand`); if (j === s && p.hand.length !== p.n) fail('own hand missing'); if (j !== s && p.said) fail('early call leaked'); });
        if (s !== G.turn && v.drawn !== -1) fail('drawn card leaked');
        if (JSON.stringify(v).includes('"hands"') || JSON.stringify(v).includes('"stock"')) fail('hands or deck leaked in the view');
      }
      const s = G.turn;
      if (s >= 0 && (G.done[s] || !G.hands[s].length)) fail('a player without cards has the turn');
      if (G.stage !== 'deal' && s >= 0 && G.seats[s].human && !G.seats[s].bot) {
        const other = G.seats.findIndex((x, j) => j !== s && x.human);
        if (other >= 0 && (mk.act(G, other, { t: 'draw' }) || mk.act(G, other, { t: 'play', cs: [G.hands[other][0]] }))) fail('acted out of turn');
        if (mk.act(G, s, { t: 'play', cs: [G.hands[(s + 1) % n][0] ?? 999] }) || mk.act(G, s, { t: 'dance' }) || mk.act(G, s, { t: 'play' }) || mk.act(G, s, { t: 'play', cs: 7 })) fail('nonsense accepted');
        const mv = G.mv, st = G.stage; human(G, s, T.now);
        if (G.mv === mv && G.stage === st) fail('human move refused');
      } else mk.tick(G, T.now);
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = mk.results(G);
    if (!G.res.called && (G.hands[G.win].length || (opts.end === 'last' ? G.out.length !== n - 1 || !G.hands[G.res.loser].length : G.res.order.some((x, k) => k > 1 && G.hands[x].length < G.hands[G.res.order[k - 1]].length)))) fail('everyone but the loser should be out of cards');
    if (new Set(G.res.order).size !== n || G.res.order[0] !== G.win) fail('bad final order');
    if (!r[G.win].win || r.filter(x => x.win).length !== 1 || new Set(r.map(x => x.place)).size !== n) fail('results disagree');
    if (mk.view(G, 0).seats.some(p => !p.hand)) fail('hands are shown at the end');
    return G;
  } finally { T.done(); }
}
for (const seats of [2, 3, 4, 5, 6]) for (const end of ['first', 'last']) { const G = play({ seats, end }); console.log(`${seats} seats: ${G.seats[G.win].name} out first after ${G.mv} moves (${end})`); }
play({ seats: 4, bots: 'sharp', queens: 'on', end: 'last' }); play({ seats: 3, kings: 'off' });
if (play({ seats: 4 }, undefined, [...four, { id: 'e', name: 'Eli', color: '#e8a0e0', av: [4] }]).seats.length !== 5) fail('five people need five seats');
// a person who only ever draws: still ends
play({ seats: 3 }, (G, s) => { if (G.stage === 'drawn') mk.act(G, s, { t: 'keep' }); else mk.act(G, s, { t: 'draw' }); });
// a person who never says Makao: still ends
play({ seats: 4 }, (G, s) => { const o = G.stage === 'drawn' ? [G.drawn] : playable(G.hands[s], mk.tableOf(G)); if (!o.length) mk.act(G, s, { t: G.stage === 'drawn' ? 'keep' : 'draw' }); else mk.act(G, s, { t: 'play', cs: [o[0]] }); });

{ // bot tables finish in a sensible number of moves, and sharp bots do better than chill ones
  const T = clock();
  let moves = 0, called = 0, sharpWin = 0, sharpLose = 0, catches = 0, max = 0; const N2 = 400;
  for (let g = 0; g < N2; g++) {
    const G = mk.create([], { seats: 4 }); T.add(5000); mk.tick(G, T.now);
    for (let i = 0; i < 20000 && G.ph === 'play'; i++) {
      T.add(400);
      if (G.open >= 0 && G.catcher >= 0) { mk.tick(G, T.now); continue; }
      if (G.turn >= 0) mk._bot(G, G.turn, T.now, G.turn % 2 ? 'sharp' : 'chill');
    }
    if (G.ph !== 'end') fail('bot game stuck');
    moves += G.mv; max = Math.max(max, G.mv); if (G.res.called) called++; else { if (G.win % 2) sharpWin++; if (G.res.loser % 2) sharpLose++; }
    catches += G.st.reduce((a, x) => a + x.caught, 0);
  }
  T.done();
  console.log(`bots: ${(moves / N2).toFixed(0)} moves a game (longest ${max}), ${called} called, sharp out first ${sharpWin}/${N2}, sharp last ${sharpLose}/${N2}, ${(catches / N2).toFixed(2)} catches a game`);
  if (moves / N2 > 110 || called) fail('bot games drag on');
  if (sharpWin < N2 * .53) fail('sharp bots are not better than chill ones');
}
{ // the turn timer plays for you, and a player who leaves is played by a bot
  const T = clock();
  const G = mk.create(players, { seats: 2, timer: 20 });
  T.add(3000); mk.tick(G, T.now);
  if (G.stage !== 'play' || !G.tEnd) fail('deal did not finish or timer not set');
  const mv = G.mv; T.add(20100); mk.tick(G, T.now);
  if (G.mv === mv) fail('timer did not play the turn');
  mk.setAway(G, 0, true); mk.setAway(G, 1, true);
  for (let i = 0; i < 20000 && G.ph === 'play'; i++) { T.add(500); mk.tick(G, T.now); }
  if (G.ph !== 'end') fail('bots did not finish for players who left');
  T.done();
}

// ----- over the real server -----
const PORT = 23080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'makao', opts: { seats: 6, timer: 20, dice: 3 } });
await wait(300);
if (room?.game !== 'makao' || room.opts.seats !== 6 || 'dice' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2, bots: 'sharp', queens: 'on', kings: 'off' } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.bots !== 'sharp' || room.opts.queens !== 'on' || room.opts.kings !== 'off' || room.opts.end !== 'first' || room.opts.timer !== 20) bail('option change lost');
send({ t: 'opts', opts: { kings: 'on' } }); await wait(200);
send({ t: 'start' }); await wait(300);
if (state?.game !== 'makao' || state.seats.length !== 2 || state.seats[state.me].hand?.length !== 5) bail('game did not start');
if (state.seats[1 - state.me].hand) bail('the server sent the other hand');
let turns = 0;
for (let i = 0; i < 4000 && state.ph === 'play'; i++) {
  if (state.stage !== 'deal' && state.turn === state.me) {
    if (state.seats[1 - state.me].hand) bail('saw the other hand');
    const hand = state.seats[state.me].hand, mv = state.mv, stage = state.stage;
    const T = { top: state.pile[state.pile.length - 1], suit: state.suit, owe: state.owe, stop: state.stop, dem: state.dem, queens: state.queens, kings: state.kings };
    if (hand.length <= 2) send({ t: 'act', a: { t: 'call' } });
    const o = state.stage === 'drawn' ? [state.drawn] : playable(hand, T);
    send({ t: 'act', a: o.length ? { t: 'play', cs: [o[0]], pick: rankOf(o[0]) === ACE ? 2 : 5 } : { t: state.stage === 'drawn' ? 'keep' : 'draw' } }); turns++;
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

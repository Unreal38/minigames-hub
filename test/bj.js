// Blackjack test: hand totals, payouts on rigged rounds, whole bot games on a fake clock, hidden cards and bets.
import * as bj from '../server/games/bj.js';
import { total, isBlackjack, betOk, START } from '../public/games/bj/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const C = s => s.split(' ').map(x => 'hdcs'.indexOf(x[1]) * 13 + '23456789TJQKA'.indexOf(x[0]));
const ana = { id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, bo = { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] };

// ----- totals -----
for (const [h, v, soft] of [['Ah Kd', 21, true], ['Ah Ad', 12, true], ['Ah Ad 9c', 21, true], ['Ah 6d Tc', 17, false], ['Th 6d 7c', 23, false], ['5h 6d', 11, false], ['Ah Ad Ac Kd', 13, false]]) {
  const t = total(C(h)); if (t.v !== v || t.soft !== soft) fail(`total of ${h}: ${JSON.stringify(t)}`);
}
if (!isBlackjack(C('Ah Kd')) || isBlackjack(C('Ah 5d 5c'))) fail('blackjack check');
if (!betOk(10, 1000) || betOk(15, 1000) || betOk(510, 1000) || !betOk(5, 5) || betOk(10, 5) || !betOk(500, 1000) || betOk(0, 50)) fail('bet limits');
if (bj.basic(C('8h 8d'), 10, { split: true, dbl: true }) !== 'split' || bj.basic(C('Th 6d'), 10, {}) !== 'hit' || bj.basic(C('Th 6d'), 5, {}) !== 'stand' || bj.basic(C('5h 6d'), 6, { dbl: true }) !== 'dbl') fail('basic strategy');

const realNow = Date.now; let now = realNow(); Date.now = () => now;
const step = (G, ms = 400) => { now += ms; return bj.tick(G, now); };
const until = (G, ok, what) => { for (let k = 0; k < 400 && !ok(); k++) step(G); if (!ok()) fail(`never reached: ${what} (stage ${G.stage})`); };
const go = (G, s, a) => { if (!bj.act(G, s, a)) fail(`action refused: ${s} ${JSON.stringify(a)} at ${G.stage}`); };

// ----- a rigged round: blackjack pays 3 to 2, a double wins double, a bust loses, the dealer draws to 17 -----
{
  const G = bj.create([ana, bo, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [2, 2, 2, 2] }], { seats: 3, rounds: 10, timer: 0 });
  until(G, () => G.stage === 'bet', 'betting');
  if (bj.act(G, 0, { t: 'hit' })) fail('hit while betting');
  if (bj.act(G, 0, { t: 'bet', amt: 15 }) || bj.act(G, 0, { t: 'bet', amt: 600 })) fail('bad bet accepted');
  // dealt from the end: seat 0, 1, 2, dealer, seat 0, 1, 2, dealer, then draws
  G.shoe = C('9d 6h Ts 5c 6d 5h Qd Kd Td 6c Ah');
  go(G, 0, { t: 'bet', amt: 100 });
  if (bj.view(G, 1).seats[0].bet !== -1 || bj.view(G, 0).seats[0].bet !== 100) fail('bets should stay secret while betting');
  if (bj.act(G, 0, { t: 'bet', amt: 50 })) fail('bet twice');
  go(G, 1, { t: 'bet', amt: 50 }); go(G, 2, { t: 'bet', amt: 40 });
  if (G.stage !== 'deal') fail('deal did not start');
  const v = bj.view(G, 1);
  if (v.dealer.cards[1] !== -1 || v.dealer.cards[0] < 0 || v.dealer.v !== 10) fail('dealer hole card leaked');
  until(G, () => G.stage === 'play', 'play');
  if (!G.st[0].hands[0].bj || G.turn !== 1) fail('blackjack should skip its turn: turn ' + G.turn);
  if (bj.act(G, 2, { t: 'hit' })) fail('acted out of turn');
  if (bj.view(G, 2).opt || !bj.view(G, 1).opt?.dbl || bj.view(G, 1).opt.split) fail('options wrong');
  go(G, 1, { t: 'dbl' });                         // 6 + 5 doubles into a ten: 21
  if (G.st[1].stack !== START - 100 || G.turn !== 2) fail('double did not take the second bet');
  go(G, 2, { t: 'hit' });                         // 10 + 6 hits a 6: bust
  if (!G.st[2].hands[0].bust || G.stage !== 'dealer') fail('bust did not end the turn');
  until(G, () => G.stage === 'pay', 'pay');
  // dealer: K + 5 = 15, draws a 9: bust
  if (total(G.dealer.cards).v !== 24) fail('dealer total ' + total(G.dealer.cards).v);
  if (G.st[0].stack !== START + 150 || G.st[1].stack !== START + 100 || G.st[2].stack !== START - 40) fail('payouts: ' + G.st.map(x => x.stack));
  if (G.st[0].hands[0].res !== 'bj' || G.st[1].hands[0].res !== 'win' || G.st[2].hands[0].res !== 'lose') fail('results wrong');
}

// ----- splitting, a push, and a dealer blackjack -----
{
  const G = bj.create([ana, bo], { seats: 2, rounds: 10, timer: 0 });
  until(G, () => G.stage === 'bet', 'betting');
  // seat 0: 8 8 (splits: 8+3, 8+K); seat 1: T 9; dealer: T 7 stands on 17. Seat 0 hits the 11 with a 6 = 17 (push), stands on 18 (win).
  G.shoe = C('6s Kc 3c 7h 9d 8d Th Td 8h');
  go(G, 0, { t: 'bet', amt: 100 }); go(G, 1, { t: 'bet', amt: 100 });
  until(G, () => G.stage === 'play', 'play');
  if (!bj.view(G, 0).opt?.split) fail('split not offered');
  go(G, 0, { t: 'split' });
  if (G.st[0].hands.length !== 2 || G.st[0].stack !== START - 200 || G.turn !== 0 || G.hi !== 0) fail('split state wrong');
  if (bj.view(G, 0).opt.split) fail('second split offered');
  go(G, 0, { t: 'hit' }); go(G, 0, { t: 'stand' });
  if (G.hi !== 1 || G.turn !== 0) fail('second split hand should be next');
  go(G, 0, { t: 'stand' }); go(G, 1, { t: 'stand' });
  until(G, () => G.stage === 'pay', 'pay');
  if (G.st[0].hands[0].res !== 'push' || G.st[0].hands[1].res !== 'win' || G.st[1].hands[0].res !== 'win') fail('split results: ' + JSON.stringify(G.st.map(x => x.hands.map(h => h.res))));
  if (G.st[0].stack !== START + 100 || G.st[1].stack !== START + 100) fail('split payouts: ' + G.st.map(x => x.stack));
  // next round: the dealer has a blackjack, seat 0 too (push), seat 1 loses without playing
  until(G, () => G.stage === 'bet' && G.round === 2, 'round 2');
  G.shoe = C('Kd 9c Ks Ad 7d Ah');
  go(G, 0, { t: 'bet', amt: 100 }); go(G, 1, { t: 'bet', amt: 100 });
  until(G, () => G.stage === 'pay', 'dealer blackjack pay');
  if (G.st[0].stack !== START + 100 || G.st[1].stack !== START) fail('dealer blackjack payouts: ' + G.st.map(x => x.stack));
  if (!bj.view(G, 1).dealer.bj) fail('dealer blackjack not shown');
}

// ----- whole games played by bots: they always end, chips add up, timers play for a quiet human -----
for (const [seats, rounds, bots] of [[6, 10, 'chill'], [4, 20, 'sharp'], [2, 15, 'sharp'], [3, 10, 'chill']]) {
  const G = bj.create([ana], { seats, rounds, bots, timer: 15 });
  let guard = 0;
  while (G.ph === 'play' && guard++ < 200000) {
    step(G, 300);
    for (const x of G.st) { if (x.stack < 0) fail('negative stack'); for (const h of x.hands) if (h.cards.length > 12) fail('endless hand'); }
    if (G.stage === 'pay') for (const x of G.st) for (const h of x.hands) if (!h.res) fail('hand without a result');
  }
  if (G.ph !== 'end') fail(`bot game ${seats}/${rounds} never ended`);
  const res = bj.results(G);
  if (res.filter(r => r.win).length !== 1 || new Set(res.map(r => r.place)).size !== seats) fail('places wrong: ' + JSON.stringify(res));
  const o = G.res.order;
  for (let k = 1; k < o.length; k++) { const A = G.st[o[k - 1]], B = G.st[o[k]]; if (!A.out && !B.out && A.stack < B.stack) fail('order not by chips'); if (A.out && !B.out) fail('a broke player placed above a live one'); }
  if (G.round > rounds) fail('too many rounds');
  console.log(`OK blackjack: ${seats} seats, ${G.round}/${rounds} rounds, stacks ${G.res.stacks.join(' ')}`);
}

// ----- a watcher takes a bot seat between rounds; an away player is played for -----
{
  const G = bj.create([ana], { seats: 3, rounds: 10, timer: 0 });
  until(G, () => G.stage === 'bet', 'betting');
  bj.seatWatcher(G, { id: 'e', name: 'Eli', color: '#fff', av: [3, 3, 3, 3] });
  if (G.seats.some(s => s.id === 'e')) fail('seated mid-round');
  bj.setAway(G, 0, true);
  until(G, () => G.round === 2 || G.ph === 'end', 'round 2 with an away player');
  if (G.ph === 'play' && !G.seats.some(s => s.id === 'e')) fail('watcher not seated at the next round');
}
Date.now = realNow;
console.log('OK blackjack');

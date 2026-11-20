// Watchers in multi-round games: Snakes & Ladders seats them when the round of turns comes back to the
// first player; poker at the next hand. Runs the engines directly on a fake clock.
import * as ld from '../server/games/ladders.js';
import * as pk from '../server/games/poker.js';
const fail = m => { console.error('FAIL', m); process.exit(1); };
const humans = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const eli = { id: 'e', name: 'Eli', color: '#9aa8ff', av: [2, 2, 2, 2] };

// Snakes & Ladders
{
  const G = ld.create(humans, { seats: 4, timer: 10 });
  let now = Date.now();
  const r0 = G.round;
  ld.seatWatcher(G, eli, true);
  if (G.seats.some(s => s.id === 'e')) fail('ladders: seated mid-round');
  for (let i = 0; i < 5000 && G.ph === 'play' && G.round === r0; i++) { now += 250; ld.tick(G, now); }
  if (G.ph === 'play') {
    const s = G.seats.findIndex(x => x.id === 'e');
    if (s < 0) fail('ladders: watcher not seated when the next round started');
    if (!G.seats[s].human || G.seats[s].bot) fail('ladders: seat still a bot');
    if (G.turn === s && G.stageEnd - now > 10_000 + 50) fail('ladders: new player turn has bot timing');
    console.log(`OK ladders: Eli took over seat ${s} at round ${G.round}`);
    // the game keeps going with Eli in it (the turn timer rolls for them)
    for (let i = 0; i < 40000 && G.ph === 'play'; i++) { now += 250; ld.tick(G, now); }
    if (G.ph !== 'end') fail('ladders: game did not finish');
    if (ld.results(G).length !== 4) fail('ladders: results');
  } else console.log('OK ladders (game ended in the first round, skipped)');
  // cancelling works, and a full table keeps them queued
  const H = ld.create([...humans, { ...eli, id: 'c', name: 'Cy' }, { ...eli, id: 'd', name: 'Dee' }], { seats: 4, timer: 10 });
  ld.seatWatcher(H, eli, true); ld.seatWatcher(H, eli, false);
  if (H.queue.length) fail('ladders: cancel');
  ld.seatWatcher(H, eli, true);
  let t = Date.now(); const r1 = H.round;
  for (let i = 0; i < 5000 && H.ph === 'play' && H.round === r1; i++) { t += 250; ld.tick(H, t); }
  if (H.seats.some(s => s.id === 'e')) fail('ladders: seated at a full table');
  console.log('OK ladders: cancel and full table');
}

// Poker: seated at the start of the next hand
{
  const G = pk.create(humans, {});
  let now = Date.now();
  for (let i = 0; i < 200 && G.hand < 1; i++) { now += 300; pk.tick(G, now); }
  const h0 = G.hand;
  if (h0 < 1) fail('poker: first hand never started');
  pk.seatWatcher(G, eli, true);
  if (G.seats.some(s => s.id === 'e')) fail('poker: seated mid-hand');
  for (let i = 0; i < 20000 && G.ph === 'play' && G.hand === h0; i++) {
    now += 300;
    const s = G.turn;
    if (s >= 0 && G.seats[s]?.human) pk.act(G, s, { t: 'fold' });
    pk.tick(G, now);
  }
  if (G.ph === 'play' && !G.seats.some(s => s.id === 'e')) fail('poker: watcher not seated at the next hand');
  console.log('OK poker: Eli seated at hand', G.hand);
}

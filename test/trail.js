// Friendship Trail test: the trail's shape, whole bot tournaments on a fake clock (minigame places fed in by hand, as
// server.js does), people's choices and the table timer, befriending, items, pacts, the Pet Show; then a real table
// over the WebSocket server that plays through a hub minigame and comes back to the trail.
import { spawn } from 'node:child_process';
import * as tg from '../server/games/trail.js';
import { NODES, N, MAIN, FORKS, near, dist, POOL, poolFor, ITEMS, oddsOf, HERD_MAX, WILD_MAX, START } from '../public/games/trail/rules.js';
import { SPECIES } from '../public/games/farm/data.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const ppl = n => Array.from({ length: n }, (_, k) => ({ id: 'p' + k, name: 'P' + k, color: ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffb547', '#e8a0e0', '#7fd1e8'][k], av: [k], pets: k === 0 ? [{ sp: 'axolily', name: 'Lily', lv: 3 }] : [] }));
const clock = () => { const realNow = Date.now; let now = realNow(); Date.now = () => now; return { add: ms => (now += ms), get now() { return now; }, done: () => { Date.now = realNow; } }; };

// ----- the trail -----
{
  if (N < 55) fail('the trail should have about 60 stones, has ' + N);
  for (const [i, nd] of NODES.entries()) { if (!nd.next.length || nd.next.some(j => j < 0 || j >= N)) fail('stone ' + i + ' leads nowhere'); }
  const forks = NODES.filter(nd => nd.next.length > 1);
  if (forks.length !== Object.keys(FORKS).length) fail('every fork should start at one stone');
  // every stone can be reached from the start and leads back to it
  const seen = new Set([0]), todo = [0]; while (todo.length) for (const j of NODES[todo.pop()].next) if (!seen.has(j)) { seen.add(j); todo.push(j); }
  if (seen.size !== N) fail('some stones cannot be reached');
  for (let i = 0; i < MAIN; i++) if (!near(i, NODES[i].next[0]) && NODES[i].next[0] < MAIN) fail('main stones ' + i + ' too far apart');
  if (poolFor(6).some(g => g.max < 6) || poolFor(2).length !== POOL.length) fail('pool should fit the table size');
  // every pool game is a real hub game that keeps its quick preset (the short modes live in each game's cleanOpts)
  for (const g of POOL) {
    const mod = await import(`../server/games/${g.id}.js`), o = mod.cleanOpts ? mod.cleanOpts({ ...g.opts, seats: 2 }) : g.opts;
    if (mod.meta.maxPlayers < g.max) fail(g.id + ' seats fewer than the pool says');
    for (const [k, v] of Object.entries(g.opts)) if (o[k] !== v) fail(`${g.id}: the trail preset ${k}=${v} is lost (${o[k]})`);
  }
  if (oddsOf('Tide', 'Ember') <= oddsOf('Ember', 'Tide') || oddsOf('Ember', 'Tide', true) <= oddsOf('Ember', 'Tide')) fail('element odds wrong');
}

// ----- options and setup -----
{
  const o = tg.cleanOpts({ seats: 9, rounds: 7, timer: 3, bots: 'evil' });
  if (o.seats !== 4 || o.rounds !== 8 || o.timer !== 30 || o.bots !== 'chill') fail('bad options not cleaned: ' + JSON.stringify(o));
  if (tg.cleanOpts({ rounds: 5 }).rounds !== 5 || tg.cleanOpts({ timer: 0 }).timer !== 0 || tg.cleanOpts({ seats: 6 }).seats !== 6) fail('good options lost');
  const G = tg.create(ppl(2), { seats: 4 });
  if (G.seats.length !== 4 || G.seats.filter(s => s.bot).length !== 2) fail('bots should fill the table');
  if (G.pl[0].herd[0].sp !== 'axolily' || G.pl[0].herd[0].name !== 'Lily' || !G.pl[0].herd[0].start) fail('your isle pet should be your starter');
  if (G.pl.some(p => p.herd.length !== 1 || !SPECIES[p.herd[0].sp])) fail('everyone starts with one pet');
  if (G.wild.length !== WILD_MAX || G.wild.some(w => !SPECIES[w.sp] || SPECIES[w.sp].el2)) fail('WILD_MAX single-element wild pets');
  for (const a of G.wild) for (const b of G.wild) if (a !== b && dist(a.pos, b.pos) < 8) fail('wild pets spawn bunched together');
  if (G.pl.some(p => p.pos !== START)) fail('everyone starts in the start meadow');
}

{ // a wild pet is met only on the stone it stands on, never from a stone next to it (Kuba 2026-11-27)
  const T = clock();
  const ok = i => NODES[i].next.length === 1 && NODES[i].kind === 'treat';
  const a = [...Array(N).keys()].find(i => ok(i) && ok(NODES[i].next[0]) && NODES[NODES[NODES[i].next[0]].next[0]].kind === 'treat');
  const b = NODES[a].next[0], c = NODES[b].next[0];
  for (const [wpos, want] of [[b, false], [NODES[c].next[0], false], [c, true]]) {
    const G = tg.create(ppl(1), { seats: 2, timer: 0 });
    G.stage = 'rolled'; G.turn = 0; G.pend = null; G.die = 2; G.stageEnd = 0; G.busy = 0; G.pl[0].pos = a; G.pl[1].pos = 0;
    G.wild = [{ id: 99, sp: 'mossbun', el: 'Leaf', rare: 0, pos: wpos }];
    tg.tick(G, T.now);
    if (G.pl[0].pos !== c) fail('the walk should end two stones on');
    if ((G.pend?.k === 'meet') !== want) fail('meeting a wild pet ' + (want ? 'on' : 'next to') + ' your stone: ' + G.pend?.k);
  }
  T.done();
}

// Play a whole tournament: bots everywhere, the minigame's places made up as server.js would hand them over.
function playOut(G, T, { onMini, onStep } = {}) {
  let guard = 0, minis = 0;
  while (G.ph === 'play' && guard++ < 200000) {
    T.add(120);
    tg.tick(G, T.now);
    onStep?.(G);
    if (G.stage === 'mini') { minis++; const places = onMini ? onMini(G) : G.seats.map((_, i) => i + 1); if (!tg.miniDone(G, places, T.now)) fail('miniDone refused'); }
  }
  if (G.ph !== 'end') fail('tournament never ended (stage ' + G.stage + ', round ' + G.round + ')');
  return minis;
}

{ // a whole bot tournament of 5 rounds with 4 seats
  const T = clock();
  const G = tg.create([], { seats: 4, rounds: 5 });
  G.seats.forEach(s => { s.bot = true; });
  let forks = 0, shops = 0, meets = 0;
  const seen = new Set();
  const minis = playOut(G, T, { onStep: G2 => { for (const e of G2.ev) { if (seen.has(e.n)) continue; seen.add(e.n); if (e.t === 'fork') forks++; if (e.t === 'buy') shops++; if (e.t === 'showdown' || e.t === 'bought') meets++; } } });
  if (minis !== 5) fail('one minigame a round, got ' + minis);
  if (!G.res || G.res.place.some(p => p < 1 || p > 4) || !G.show) fail('Pet Show results missing');
  const r = tg.results(G); if (r.length !== 4 || !r.some(x => x.win) || r.some(x => x.pts < 0)) fail('results wrong');
  if (G.pl.some(p => p.herd.length > HERD_MAX || p.items.length > 3 || p.treats < 0)) fail('a limit was broken');
  if (!forks || !meets) fail(`bots should take forks and meet pets (forks ${forks}, meets ${meets}, shops ${shops})`);
  // the Pet Show: every friend 1 point, each ribbon 2
  const pts = G.pl.map(p => p.herd.length); for (const ids of Object.values(G.show.rib)) for (const i of ids) pts[i] += 2;
  if (pts.join() !== G.show.pts.join()) fail('Pet Show points wrong');
  T.done();
}

{ // six seats play through, minigames only from games that seat six
  const T = clock();
  const G = tg.create([], { seats: 6, rounds: 5 }); G.seats.forEach(s => { s.bot = true; });
  const games = new Set();
  playOut(G, T, { onMini: G2 => { games.add(G2.mini.game); return G2.seats.map((_, i) => i + 1); } });
  for (const g of games) if (POOL.find(p => p.id === g).max < 6) fail(g + ' cannot seat six');
  T.done();
}

// Past the intro and the roll for the first turn, with seat `lead` rolling 6 and everyone else 1, so `lead` goes first.
function pastOrder(G, T, lead = 0) {
  T.add(tg.MS.intro + 10); tg.tick(G, T.now);
  if (G.stage !== 'order') fail('after the intro everyone should roll for the first turn');
  const real = Math.random; let guard = 0;
  while (G.stage === 'order' && guard++ < 400) {
    T.add(200);
    Math.random = () => (G.pend?.s === lead ? .99 : 0);
    if (G.pend?.k === 'first' && !G.seats[G.pend.s].bot && T.now >= G.busy) tg.act(G, G.pend.s, { t: 'roll' }); else tg.tick(G, T.now);
    Math.random = real;
  }
  guard = 0; while (G.stage === 'next' && guard++ < 100) { T.add(200); tg.tick(G, T.now); }
  if (G.order[0] !== lead || G.turn !== lead) fail('the highest first roll should go first');
}

{ // skipping the intro: it ends once every person has voted (bots don't vote)
  const T = clock();
  const G = tg.create(ppl(2), { seats: 3, rounds: 5 });
  if (!tg.act(G, 0, { t: 'skip' }) || tg.act(G, 0, { t: 'skip' }) || tg.act(G, 2, { t: 'skip' })) fail('one skip vote per person');
  T.add(10); tg.tick(G, T.now); if (G.stage !== 'intro') fail('the intro waits for every person');
  tg.act(G, 1, { t: 'skip' }); T.add(10); tg.tick(G, T.now); if (G.stage !== 'order') fail('everyone skipped: the roll for the first turn starts');
  T.done();
}

{ // the roll for the first turn: ties roll again, and the order holds every round
  const T = clock();
  const G = tg.create(ppl(1), { seats: 3, rounds: 5 });
  T.add(tg.MS.intro + 10); tg.tick(G, T.now);
  const real = Math.random, seq = [.5, .5, .1, .9, .2]; let k = 0, guard = 0; // 4, 4, 1, then the tie: 6 and 2
  while (G.stage === 'order' && guard++ < 400) {
    T.add(200);
    if (G.pend?.k === 'first' && T.now >= G.busy && (!G.seats[G.pend.s].bot || T.now >= G.botAt)) { Math.random = () => seq[k] ?? 0; const ok = G.seats[G.pend.s].bot ? tg.tick(G, T.now) : tg.act(G, G.pend.s, { t: 'roll' }); Math.random = real; if (ok) k++; }
    else tg.tick(G, T.now);
  }
  if (!G.ev.some(e => e.t === 'firsttie')) fail('a tie should roll again');
  if (JSON.stringify(G.order) !== '[0,1,2]') fail('wrong turn order ' + JSON.stringify(G.order));
  T.done();
}

{ // bots think before they act, people's choices and the timer
  const T = clock();
  const G = tg.create(ppl(1), { seats: 2, rounds: 5, timer: 20 });
  pastOrder(G, T);
  // trail cards (Kuba 2026-11-27): a hand of 3, a friend can swap it once, the card played is exactly the walk
  if (G.turn !== 0 || G.pend?.k !== 'card' || G.pend.s !== 0) fail('the first player should be asked for a card');
  const p0 = G.pl[0];
  if (p0.hand.length !== 3 || p0.hand.some(d => d < 1 || d > 6)) fail('a hand is 3 cards from 1 to 6');
  if (!G.pend.f.includes(0)) fail('your starter should offer to swap your cards');
  if (tg.act(G, 1, { t: 'card', i: 0 })) fail('played out of turn');
  if (!tg.act(G, 0, { t: 'redraw', f: 0 })) fail('could not swap cards with the starter');
  if (p0.herd[0].rr || G.pend?.k !== 'card' || G.pend.f.length) fail('the friend used its swap, and you still pick a card');
  if (p0.hand.length !== 3 || G.ev[G.ev.length - 1].t !== 'redraw') fail('the swap deals a new hand of 3');
  T.add(5000);
  const d0 = p0.hand[1];
  if (!tg.act(G, 0, { t: 'card', i: 1 })) fail('could not play a card');
  if (G.die !== d0 || p0.hand.length !== 2) fail('the card played is the walk and leaves the hand');
  if (G.stage !== 'rolled' || G.ev.some(e => e.t === 'hop')) fail('nobody walks until the card has been shown');
  T.add(tg.MS.card + 10); tg.tick(G, T.now);
  if (G.pl[0].pos === START && !G.pend) fail('the walk should start after the card');
  { const { ends } = (await import('../public/games/trail/rules.js')).landsOf(START, d0); if (!G.pend && !ends.includes(G.pl[0].pos) && G.stage !== 'walk') fail('landsOf should say where a card ends'); }
  // drive person 0 with the safe choices until it's the bot's turn, then check the bot waits a moment
  let guard = 0;
  while (G.turn === 0 && guard++ < 500) { T.add(300); tg.tick(G, T.now); if (G.pend?.s === 0 && T.now >= G.busy) { const a = { card: { t: 'card', i: 0 }, fork: { t: 'fork', j: G.pend.opts?.[0] }, shop: { t: 'shop', k: null }, meet: { t: 'meet', skip: true }, well: { t: 'well', yes: false }, bench: { t: 'bench', o: -1 }, lure: { t: 'lure', yes: false }, pact: { t: 'pact', yes: false } }[G.pend.k]; tg.act(G, 0, a); } }
  guard = 0; while (!(G.pend?.s === 1) && guard++ < 200) { T.add(100); tg.tick(G, T.now); }
  if (G.pend?.s !== 1) fail('the bot never got its turn');
  { const was = G.evN; for (let k = 0; k < 6; k++) { T.add(100); tg.tick(G, T.now); } if (G.evN !== was) fail('a bot acted without thinking first'); }
  T.done();
}

{ // a person who sits still: the timer picks the safe choice for them
  const T = clock();
  const G = tg.create(ppl(1), { seats: 2, rounds: 5, timer: 20 });
  pastOrder(G, T);
  T.add(21000); tg.tick(G, T.now);
  if (G.die == null) fail('the timer should play a card for you');
  T.done();
}

{ // befriending: showdown odds, treats, a full herd, luring, pacts and items
  const T = clock();
  const G = tg.create(ppl(2), { seats: 2, timer: 0 });
  const p = G.pl[0], w = G.wild[0];
  p.pos = w.pos; p.treats = 50; G.turn = 0; G.stage = 'land'; G.busy = 0;
  T.add(10);
  G.pend = { s: 0, k: 'meet', id: w.id };
  if (!tg.act(G, 0, { t: 'meet', treat: true })) fail('could not buy a friend with treats');
  if (p.herd.length !== 2 || p.herd[1].sp !== w.sp || G.wild.some(x => x.id === w.id)) fail('the bought pet should join');
  if (G.wild.length !== WILD_MAX) fail('a new wild pet should turn up');
  // items: buy at a stall, use before rolling
  G.pend = { s: 0, k: 'shop' }; G.walk = { left: 0, path: [] }; G.busy = 0;
  if (!tg.act(G, 0, { t: 'shop', k: 'spy' }) || !p.items.includes('spy')) fail('could not buy a Spyglass');
  G.pend = { s: 0, k: 'card', f: [] }; G.busy = 0; p.hand = [1, 2, 3];
  if (!tg.act(G, 0, { t: 'item', k: 'spy' }) || p.hand.length !== 4 || p.items.includes('spy')) fail('Spyglass should draw a 4th card');
  if (tg.act(G, 0, { t: 'item', k: 'charm' })) fail('used an item you do not have');
  // luring: the newest friend, never the starter
  const q = G.pl[1]; q.herd.push({ sp: 'mossbun', el: 'Leaf', rare: 0, cheer: true, rr: true });
  q.pos = p.pos; G.pend = { s: 0, k: 'lure', o: 1 }; G.busy = 0;
  if (!tg.act(G, 0, { t: 'lure', yes: true }) || q.herd.length !== 1 || p.herd[p.herd.length - 1].sp !== 'mossbun') fail('lure did not move the newest friend');
  // a pact: asked, answered by the other seat
  G.pend = { s: 0, k: 'bench', opts: [1] }; G.busy = 0;
  if (!tg.act(G, 0, { t: 'bench', o: 1 }) || G.pend?.k !== 'pact' || G.pend.s !== 1) fail('the pact offer should ask the other player');
  if (tg.act(G, 0, { t: 'pact', yes: true })) fail('the offerer answered their own pact');
  G.busy = 0;
  if (!tg.act(G, 1, { t: 'pact', yes: true }) || G.pl[0].pact?.w !== 1 || G.pl[1].pact?.w !== 0) fail('pact not made');
  T.done();
}

{ // a cheer lifts you one place; the pact pays when buddies finish top two
  const T = clock();
  const G = tg.create(ppl(3), { seats: 3, timer: 0 });
  G.stage = 'cheer'; G.cheer = [-1, -1, -1]; G.cheerDone = [false, false, false];
  if (!tg.act(G, 2, { t: 'cheer', i: 0 })) fail('could not cheer');
  tg.act(G, 0, { t: 'cheer', i: -1 }); tg.act(G, 1, { t: 'cheer', i: -1 });
  if (G.stage !== 'wheel' || !G.mini) fail('the wheel should spin once everyone chose');
  T.add(tg.MS.wheel + 10); tg.tick(G, T.now);
  if (G.stage !== 'mini') fail('the minigame should start after the wheel');
  const before = G.pl.map(p => p.treats);
  tg.miniDone(G, [1, 2, 3], T.now);
  if (G.miniRes.order.join() !== '0,2,1' || G.pl[2].herd[0].cheer) fail('the cheer should lift seat 2 to 2nd: ' + G.miniRes.order);
  if (G.pl[0].treats - before[0] !== 8 || G.pl[2].treats - before[2] !== 5 || G.pl[0].wins !== 1) fail('minigame treats wrong');
  T.done();
}

{ // the view: nothing missing for the screen
  const G = tg.create(ppl(2), { seats: 3 });
  const v = tg.view(G, 0);
  for (const k of ['stage', 'round', 'rounds', 'pl', 'wild', 'seats', 'ev', 'season', 'wx']) if (v[k] === undefined) fail('view lacks ' + k);
  if (JSON.stringify(v).length > 20000) fail('view too big');
}
console.log('trail rules ok');

// ----- a real table: the tournament plays a hub minigame for real and comes back -----
{
  const PORT = 23080 + (Math.random() * 900 | 0);
  const srv = spawn(process.execPath, ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => { out += d; }); srv.stderr.on('data', d => { out += d; });
  const stop = code => { srv.kill(); process.exit(code); };
  const timer = setTimeout(() => { console.error('FAIL timeout\n' + out.slice(-3000)); stop(1); }, 400000);
  await new Promise(r => setTimeout(r, 900));
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const msgs = []; let room = null, state = null, stateAt = 0;
  ws.onmessage = e => { const m = JSON.parse(e.data); msgs.push(m); if (m.t === 'room') room = m.room; if (m.t === 'state') { state = m.s; stateAt = Date.now(); } };
  await new Promise(r => { ws.onopen = r; });
  const send = m => ws.send(JSON.stringify(m));
  send({ t: 'hello', name: 'Kuba', color: '#ff8fab' });
  await new Promise(r => setTimeout(r, 300));
  send({ t: 'create', game: 'trail', opts: { seats: 2, rounds: 5, timer: 0, bots: 'sharp' } });
  await new Promise(r => setTimeout(r, 400));
  if (!room || room.game !== 'trail') { console.error('FAIL no trail table', JSON.stringify(msgs.slice(-3))); stop(1); }
  send({ t: 'start' });
  const until = async (f, ms, what) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) { console.error('FAIL waiting for ' + what + ' (stage ' + state?.stage + ', game ' + room?.game + ')\n' + out.slice(-2000)); stop(1); } await new Promise(r => setTimeout(r, 100)); } };
  // play our own turns with the safe choices
  const me = () => state?.me ?? 0;
  const drive = setInterval(() => {
    // Tower Stack waits up to 10 s on a person each turn, so a tower could outlast the wait below: drop straight away
    if (room?.game === 'stack' && state?.stage === 'aim' && state.turn === state.me && Date.now() - stateAt > 300) { send({ t: 'act', a: { t: 'drop' } }); return; }
    // the turn-based pool games wait out the whole turn timer on an idle person, so take our turns at once
    if (room?.game !== 'trail' && state?.game === room?.game && state.turn === state.me && Date.now() - stateAt > 300) {
      const n = (state.w || 5) * (state.h || 4), i = Math.random() * n | 0;
      const a = { darts: { t: 'throw', x: 0, y: 0, ms: 600 }, dig: { t: 'dig', i }, pairs: { t: 'flip', i }, siege: { t: 'throw', k: 'pie', a: .8, p: .7 } }[room.game];
      if (a) send({ t: 'act', a });
      return;
    }
    if (room?.game !== 'trail' || !state || state.game !== 'trail') return;
    const P = state.pend;
    if (state.stage === 'intro' && !(state.skipV || []).includes(me())) send({ t: 'act', a: { t: 'skip' } }); // the long how-to-play talk
    if (state.stage === 'cheer' && state.cheer && !state.cheer.done) send({ t: 'act', a: { t: 'cheer', i: -1 } });
    if (!P || P.s !== me() || Date.now() - stateAt < state.busy) return;
    const a = { first: { t: 'roll' }, card: { t: 'card', i: 0 }, fork: { t: 'fork', j: P.opts?.[0] }, shop: { t: 'shop', k: null }, meet: { t: 'meet', skip: true }, well: { t: 'well', yes: false }, bench: { t: 'bench', o: -1 }, lure: { t: 'lure', yes: false }, pact: { t: 'pact', yes: false } }[P.k];
    if (a) send({ t: 'act', a });
  }, 250);
  await until(() => room?.game !== 'trail' && room?.party?.game === 'trail', 90000, 'the first minigame');
  const mini = room.game;
  if (!POOL.some(g => g.id === mini)) { console.error('FAIL minigame not from the pool: ' + mini); stop(1); }
  console.log('trail: playing', mini);
  await until(() => room?.game === 'trail' && state?.game === 'trail' && (state.stage === 'minires' || state.round > 1), 320000, 'back on the trail after ' + mini);
  clearInterval(drive);
  if (!state.miniRes && state.round < 2) { console.error('FAIL no minigame result'); stop(1); }
  clearTimeout(timer); console.log('trail table ok'); stop(0);
}

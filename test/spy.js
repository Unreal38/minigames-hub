// Spyglass Isle test: the shared cards (same seed, same card; the hunted look exactly once; nothing covers its
// middle), first tap wins, wrong taps and dizziness, bots, ties, away players, then a match over the real server.
import { spawn as launch } from 'node:child_process';
import * as spy from '../server/games/spy.js';
import * as R from '../public/games/spy/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- the cards -----
for (const seed of [1, 77, 123456, 2 ** 31 - 5]) for (const cards of R.CARDS) {
  const M = R.makePool(seed, cards), M2 = R.makePool(seed, cards);
  if (JSON.stringify(M) !== JSON.stringify(M2)) fail('same seed, different pool');
  if (M.pool.length < 40 || M.pool.length > R.POOL) fail('pool size ' + M.pool.length);
  if (new Set(M.pool.map(R.key)).size !== M.pool.length) fail('a look twice in the pool');
  if (new Set(M.targets.map(t => M.pool[t].sp)).size !== cards) fail('two cards hunt the same species');
  let last = 0;
  for (let n = 0; n < cards; n++) {
    const c = R.makeCard(seed, n, cards, M), c2 = R.makeCard(seed, n, cards);
    if (JSON.stringify(c) !== JSON.stringify(c2)) fail('same seed, different card');
    const tk = M.targets[n];
    if (c.items.filter(it => it.k === tk).length !== 1 || c.items[c.ti] !== c.t || c.t.k !== tk) fail('the hunted look must be on the card exactly once');
    if (c.items.length < last || c.items.length < 40 || c.items.length > 130) fail('card size ' + c.items.length);
    last = c.items.length;
    for (const it of c.items) if (it.x - it.s / 2 < 0 || it.y - it.s / 2 < 0 || it.x + it.s / 2 > R.SIZE || it.y + it.s / 2 > R.SIZE) fail('a pet sticks out of the card');
    for (const it of c.items.slice(c.ti + 1)) if (Math.hypot(it.x - c.t.x, it.y - c.t.y) < c.t.s * .5 + it.s * .2) fail('a pet drawn over the hunted one hides its middle');
    const kin = c.items.filter(it => it !== c.t && M.pool[it.k].sp === c.look.sp).length;
    if (n === cards - 1 && kin < 1 && M.pool.some((l, i) => i !== tk && l.sp === c.look.sp)) fail('no lookalikes on the last card');
    if (!R.hits(c, c.t.x, c.t.y) || !R.hits(c, c.t.x + c.t.s * .4, c.t.y) || R.hits(c, c.t.x + c.t.s * .5, c.t.y)) fail('hit area');
  }
  if (R.makeCard(seed, 0, cards).items.length === R.makeCard(seed + 1, 0, cards).items.length && JSON.stringify(R.makeCard(seed, 0, cards).t) === JSON.stringify(R.makeCard(seed + 1, 0, cards).t)) fail('cards are not seeded');
}

// ----- whole matches on a fake clock -----
const realNow = Date.now; let now = realNow(); Date.now = () => now;
const run = (G, ms, each) => { for (let t = 0; t < ms && G.ph === 'play'; t += 50) { now += 50; spy.fast(G, now); each?.(G); } };
{ // loading waits for people, then 3-2-1, then cards; nobody finds anything: every card times out
  const G = spy.create(players.slice(0, 1), { seats: 1, cards: 8 });
  if (G.seats.length !== 1 || G.stage !== 'load') fail('start');
  run(G, 3000); if (G.stage !== 'load') fail('should wait for the pictures');
  spy.act(G, 0, { t: 'rdy' }); run(G, 100); if (G.stage !== 'count') fail('ready did not start the count');
  run(G, R.COUNT_MS + 100); if (G.stage !== 'find' || G.n !== 0) fail('first card');
  run(G, 8 * (R.FIND_MS + R.REVEAL_MS) + 2000);
  if (G.ph !== 'end' || G.res.c[0] !== 0 || !G.ev.some(e => e.t === 'f' && e.s === -1)) fail('timed-out cards');
  const res = spy.results(G); if (!res[0].win || res[0].place !== 1 || res[0].pts !== 0) fail('solo results');
}
{ // a slow device does not hold the table forever
  const G = spy.create(players, { seats: 2 }); run(G, R.LOAD_MS + 200); if (G.stage !== 'count') fail('load timeout');
}
{ // wrong taps make you dizzy; the right tap takes the card; taps for an old card or while dizzy do nothing
  const G = spy.create(players, { seats: 2, cards: 8 });
  spy.act(G, 0, { t: 'rdy' }); spy.act(G, 1, { t: 'rdy' }); run(G, R.COUNT_MS + 200);
  const t = G.card.t, miss = { t: 'tap', c: 0, x: t.x < 500 ? 900 : 100, y: t.y < 500 ? 900 : 100 };
  spy.act(G, 0, miss); if (!(G.x[0].dz > now) || !G.ev.some(e => e.t === 'dz' && e.s === 0)) fail('a wrong tap should make you dizzy');
  spy.act(G, 0, { t: 'tap', c: 0, x: t.x, y: t.y }); if (G.found !== -1 || G.stage !== 'find') fail('a dizzy player found the pet');
  now += R.DIZZY_MS + 10;
  spy.act(G, 1, { t: 'tap', c: 1, x: t.x, y: t.y }); if (G.stage !== 'find') fail('a tap for another card counted');
  for (const a of [null, { t: 'tap', c: 0, x: NaN, y: 1 }, { t: 'tap', c: 0, x: -5, y: 1 }, { t: 'tap', c: 0, x: 1e9, y: 1 }, { t: 'tap', c: '0', x: t.x, y: t.y }, { t: 'x' }]) spy.act(G, 1, a);
  if (G.stage !== 'find' || G.x[1].dz) fail('nonsense counted');
  spy.act(G, 1, { t: 'tap', c: 0, x: t.x + 3, y: t.y - 3 }); spy.act(G, 0, { t: 'tap', c: 0, x: t.x, y: t.y });
  if (G.found !== 1 || G.x[1].c !== 1 || G.x[0].c !== 0 || G.stage !== 'reveal') fail('the first right tap should take the card');
  spy.act(G, 0, { t: 'tap', c: 0, x: t.x, y: t.y }); if (G.x[0].c !== 0) fail('a tap during the reveal counted');
  run(G, R.REVEAL_MS + 100); if (G.n !== 1 || G.stage !== 'find') fail('next card');
  // Ana takes the rest quickly; Bo is placed second
  for (let i = 0; i < 200 && G.ph === 'play'; i++) { if (G.stage === 'find') spy.act(G, 0, { t: 'tap', c: G.n, x: G.card.t.x, y: G.card.t.y }); run(G, 500); }
  if (G.ph !== 'end' || G.res.c.join() !== '7,1' || G.win !== 0 || G.res.place.join() !== '1,2') fail('end ' + JSON.stringify(G.res));
  if (spy.view(G, 0).x.length !== 2 || spy.view(G, -1).me !== -1) fail('view');
}
{ // ties go to the quicker total time
  const G = spy.create(players, { seats: 2, cards: 8 });
  spy.act(G, 0, { t: 'rdy' }); spy.act(G, 1, { t: 'rdy' }); run(G, R.COUNT_MS + 200);
  for (let i = 0; G.ph === 'play' && i < 3000; i++) {
    if (G.stage === 'find') { const s = G.n % 2, wait = s === 0 ? 4000 : 2000; if (now - G.at >= wait) spy.act(G, s, { t: 'tap', c: G.n, x: G.card.t.x, y: G.card.t.y }); }
    run(G, 50);
  }
  if (G.res.c.join() !== '4,4' || G.win !== 1) fail('a tie should go to the quicker finder ' + JSON.stringify(G.res));
}
{ // bots find pets by themselves, sharp ones sooner; a match with bots ends; an away player gets a bot
  const tally = { chill: [0, 0], sharp: [0, 0] };
  for (const lvl of ['chill', 'sharp']) for (let i = 0; i < 400; i++) { const t = spy.botPlan(spy.BOT[lvl], i % 8, 8); if (t >= 0) { tally[lvl][0]++; tally[lvl][1] += t; } }
  const avg = l => tally[l][1] / tally[l][0];
  if (avg('sharp') >= avg('chill') || tally.sharp[0] <= tally.chill[0]) fail('sharp bots should be quicker');
  console.log(`bots: chill find ${(tally.chill[0] / 4).toFixed(0)}% in ${(avg('chill') / 1000).toFixed(1)}s, sharp ${(tally.sharp[0] / 4).toFixed(0)}% in ${(avg('sharp') / 1000).toFixed(1)}s`);
  const G = spy.create(players.slice(0, 1), { seats: 6, bots: 'sharp', cards: 12 });
  spy.act(G, 0, { t: 'rdy' }); run(G, 12 * (R.FIND_MS + R.REVEAL_MS) + 8000);
  if (G.ph !== 'end' || G.res.c.slice(1).reduce((a, b) => a + b) < 6) fail('bots should find most pets ' + G.res.c);
  if (spy.results(G).filter(r => r.win).length !== 1) fail('one winner');
  const H = spy.create(players, { seats: 2 }); spy.act(H, 0, { t: 'rdy' });
  if (!spy.setAway(H, 1, true) || spy.setAway(H, 1, true)) fail('setAway');
  run(H, R.COUNT_MS + 400); run(H, 5 * (R.FIND_MS + R.REVEAL_MS));
  if (!H.x[1].c) fail('no bot for the player who left');
  spy.act(H, 1, { t: 'tap', c: H.n, x: 1, y: 1 }); if (H.x[1].dz) fail('an away seat took a tap');
}
{ // options
  const o = spy.cleanOpts({ seats: 99, cards: 7, bots: 'x' }); if (o.cards !== 8 || o.bots !== 'chill' || o.seats !== 4) fail('options not cleaned ' + JSON.stringify(o));
  if (spy.cleanOpts({ cards: '12' }).cards !== 12) fail('12 cards');
  if (spy.create(players, { seats: 8 }).seats.length !== 8 || spy.create(players, { seats: 1 }).seats.length !== 2) fail('seats');
}
Date.now = realNow;

// ----- over the real server -----
const PORT = 24080 + (Math.random() * 900 | 0);
const srv = launch('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'spy', opts: { seats: 3, cards: 12, bots: 'chill', laps: 3 } });
await wait(300);
if (room?.game !== 'spy' || room.opts.cards !== 12 || 'laps' in room.opts) bail('room options wrong ' + JSON.stringify(room?.opts));
send({ t: 'opts', opts: { seats: 2, cards: 8 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.cards !== 8) bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'spy' || state.seats.length !== 2 || state.stage !== 'load') bail('game did not start');
send({ t: 'act', a: { t: 'rdy' } });
const M = R.makePool(state.seed, state.cards); let tapped = -1;
for (let i = 0; i < 900 && state.ph === 'play'; i++) { // tap every card the moment it shows: about 3 s a card
  if (state.stage === 'find' && state.n !== tapped) { const c = R.makeCard(state.seed, state.n, state.cards, M); send({ t: 'act', a: { t: 'tap', c: state.n, x: c.t.x, y: c.t.y } }); tapped = state.n; }
  await wait(50);
}
if (state.ph !== 'end' || state.res.c[state.me] < 6 || state.win !== state.me) bail('a match over the server: ' + JSON.stringify(state.res));
await wait(300);
if (!me?.gain || !(me.gain.coins >= 1)) bail('coins not paid by place: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game: cards', state.res.c.join('/'), '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

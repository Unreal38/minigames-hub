// Kart Island Race test: the tracks, the kart physics, whole races on a fake clock (bots, items, hits, laps),
// then a race over the real WebSocket server with a browser-style driver sending its position.
import { spawn } from 'node:child_process';
import * as kart from '../server/games/kart.js';
import { buildTrack, TRACK_IDS, TRACKS, newKart, stepKart, autoDrive, locate, SHOULDER, ROAD, KART_R, GRID, MAX_V, GRASS_V, NARROW_EDGE, driftLevel, driftFlags } from '../public/games/kart/track.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];

// ----- tracks -----
for (const id of TRACK_IDS) {
  const T = buildTrack(id);
  if (T.n < 300 || T.L < 300) fail(`${id} is too short`);
  // separate parts of the loop never come close enough to overlap (or to cut across)
  for (let i = 0; i < T.n; i += 2) for (let j = i + 2; j < T.n; j += 2) {
    const arc = Math.min(j - i, T.n - (j - i)) * T.step;
    if (arc > 50 && Math.hypot(T.x[i] - T.x[j], T.z[i] - T.z[j]) < SHOULDER * 2 + 4) fail(`${id}: samples ${i} and ${j} overlap`);
  }
  // no bend is tighter than the road is wide (the road would pinch shut and leave a hole)
  for (let i = 0; i < T.n; i++) { const a = Math.atan2(T.tx[(i + 1) % T.n], T.tz[(i + 1) % T.n]) - Math.atan2(T.tx[(i - 1 + T.n) % T.n], T.tz[(i - 1 + T.n) % T.n]), turn = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (2 * T.step / Math.max(turn, 1e-6) < T.rw[i] + 1.2) fail(`${id}: the bend at ${i} is tighter than the road is wide`); }
  if (!T.br.some(b => b) || T.br.every(b => b)) fail(`${id} should mix land and bridges`);
  if (T.br[0]) fail(`${id}: the start line should be on land`);
  if (T.boxes.length !== TRACKS[id].boxes.length * 4 || !T.pads.length) fail(`${id}: boxes or pads missing`);
  for (const b of T.boxes) if (Math.abs(locate(T, b.x, b.z).lat) > ROAD) fail(`${id}: an item box is off the road`);
  // locate round-trips
  for (let i = 0; i < T.n; i += 17) { const l = locate(T, T.x[i] - T.tz[i] * 2, T.z[i] + T.tx[i] * 2); if (Math.abs(l.lat - 2) > .05 || Math.abs(l.i - i) > 1) fail(`${id}: locate is off at ${i}`); }
  // a bot laps every track without falling off, in a sensible time
  const k = newKart(T, 0); let t = 0, falls = 0;
  while (k.lap < 2 && t < 120) { if (stepKart(T, k, autoDrive(T, k), 1 / 60) === 'fall') falls++; t += 1 / 60; }
  if (k.lap < 2 || falls) fail(`${id}: the driver did not get round cleanly (lap ${k.lap}, falls ${falls})`);
  const lapT = t - (GRID + 3) / 25;
  if (lapT / 2 < 12 || lapT / 2 > 60) fail(`${id}: odd lap time ${lapT / 2}`);
  console.log(`${id}: ${T.L.toFixed(0)} long, lap about ${(lapT / 2).toFixed(1)}s`);
}

// ----- physics -----
{
  const T = buildTrack('meadow'), k = newKart(T, 0);
  for (let i = 0; i < 240; i++) stepKart(T, k, { steer: autoDrive(T, k).steer, gas: 1 }, 1 / 60);
  if (k.v < 18 || k.v > 26) fail('a kart should reach near top speed in four seconds, got ' + k.v);
  // driving hard left on land ends up off the island
  const f = newKart(T, 0); let fell = false;
  for (let i = 0; i < 600 && !fell; i++) fell = stepKart(T, f, { steer: 1, gas: 1 }, 1 / 60) === 'fall';
  if (!fell) fail('turning off the road should fall off the island');
  let back = false; for (let i = 0; i < 200 && !back; i++) back = stepKart(T, f, {}, 1 / 60) === 'respawn';
  if (!back || Math.abs(f.lat) > .5 || f.ghost <= 0) fail('a fallen kart should come back on the road');
  // a drift held round a bend gives a boost when let go
  const d = newKart(T, 0); for (let i = 0; i < 200; i++) stepKart(T, d, { steer: autoDrive(T, d).steer, gas: 1 }, 1 / 60);
  stepKart(T, d, { steer: .6, gas: 1, drift: 1 }, 1 / 60);
  if (!d.dr) fail('drift did not start');
  const c0 = d.charge; for (let i = 0; i < 20; i++) stepKart(T, d, { steer: .3, gas: 1, drift: 1 }, 1 / 60);
  if (!(d.charge > c0) || !d.dr) fail('a held drift should charge up');
  d.charge = 1; // as if held round a long bend
  const cue = stepKart(T, d, { steer: 0, gas: 1, drift: 0 }, 1 / 60);
  if (cue !== 'mini' || d.boost <= 0) fail('letting go of a long drift should boost');
  // a longer drift reaches a third level with the longest boost
  if (driftLevel(.7) !== 1 || driftLevel(1.5) !== 2 || driftLevel(2.4) !== 3 || driftFlags(2.4) !== 1536 || driftFlags(.2) !== 0) fail('drift levels are off');
  const d3 = newKart(T, 0); Object.assign(d3, { v: 20, dr: 1, charge: 2.4 });
  if (stepKart(T, d3, { steer: 0, gas: 1, drift: 0 }, 1 / 60) !== 'mini' || d3.boost < 1.7) fail('a level three drift should give the longest boost');
  // grass slows a kart right down
  const g = newKart(T, 0); Object.assign(g, { x: T.x[40] - T.tz[40] * 7.5, z: T.z[40] + T.tx[40] * 7.5, h: Math.atan2(T.tx[40], T.tz[40]), v: MAX_V, i: 40 });
  for (let i = 0; i < 45; i++) stepKart(T, g, { steer: 0, gas: 1 }, 1 / 60);
  if (!g.grass || g.v > MAX_V * GRASS_V + 2) fail('grass should slow a kart down fast, got ' + g.v);
  // a narrow cliff road has no grass: a small slip and you are off
  { const C = buildTrack('cliff'), ni = C.nar.findIndex((v, i) => v && C.nar[(i + 12) % C.n] && C.nar[(i - 12 + C.n) % C.n]);
    if (ni < 0 || C.ew[ni] > NARROW_EDGE + .2) fail('cliff needs a narrow stretch');
    const c = newKart(C, 0); Object.assign(c, { x: C.x[ni], z: C.z[ni], h: Math.atan2(C.tx[ni], C.tz[ni]) + .6, v: 18, i: ni, lap: 0 });
    let off = false; for (let i = 0; i < 40 && !off; i++) off = stepKart(C, c, { steer: 0, gas: 1 }, 1 / 60) === 'fall';
    if (!off) fail('drifting wide on a narrow road should fall');
    if (Math.min(...C.vlim) > 21) fail('cliff should have bends that need braking'); }
  // on a bridge the rails hold you in
  const bi = T.br.findIndex(b => b), b = newKart(T, 0);
  Object.assign(b, { x: T.x[bi], z: T.z[bi], h: Math.atan2(T.tx[bi], T.tz[bi]) + 1.2, v: 20, i: bi, s: bi * T.step, lap: 0 });
  for (let i = 0; i < 60; i++) { if (stepKart(T, b, { steer: 0, gas: 1 }, 1 / 60) === 'fall') fail('fell off a bridge'); }
  if (Math.abs(b.lat) > 6.2) fail('drove through a bridge rail');
}

// ----- whole races on a fake clock -----
const realNow = Date.now;
function race(opts, { human = true, use = true } = {}) {
  let now = realNow(); Date.now = () => now;
  try {
    const G = kart.create(human ? players.slice(0, 1) : [], opts);
    if (G.seats.length !== (opts.seats || 6)) fail('grid not filled with bots');
    const T = buildTrack(G.trackId), me = { ...G.karts[0] }, seen = {};
    if (human && kart.act(G, 0, { t: 'p', x: me.x + 5, z: me.z, h: 0, v: 0 })) fail('moved before the start');
    let ev = 0, cheat = false;
    for (let f = 0; f < 60 * 400 && G.ph === 'play'; f++) {
      now += 1000 / 60;
      if (human && G.stage === 'race') stepKart(T, me, autoDrive(T, me, { lane: -1 }), 1 / 60, .9);
      if (human && f % 6 === 0) kart.act(G, 0, { t: 'p', x: me.x, z: me.z, h: me.h, v: me.v, f: (me.spin > 0 ? 2 : 0) | (me.boost > 0 ? 4 : 0) });
      if (human && !cheat && G.stage === 'race' && f > 600) { // a teleport is refused
        cheat = true; const k = G.karts[0], x = k.x, p = k.prog;
        kart.act(G, 0, { t: 'p', x: k.x + 60, z: k.z + 60, h: 0, v: 0 });
        if (G.karts[0].x !== x || G.karts[0].prog !== p) fail('a teleport was accepted');
      }
      if (f % 3 === 0) kart.fast(G, now);
      if (human && use && G.item[0] && now > G.item[0].at + kart.ROLL_MS) { const k = G.item[0].k; if (!kart.act(G, 0, { t: 'use' })) fail('could not use ' + k); if (k === 'chili') me.boost = 1.6; }
      for (const e of G.ev) if (e.n > ev) { ev = e.n; seen[e.t] = (seen[e.t] || 0) + 1; if (e.t === 'hit' && e.s === 0) me.spin = 1.25; if (e.t === 'zzz' && e.hit.includes(0)) me.slow = 2.8; }
    }
    if (G.ph !== 'end') fail('race did not end');
    const r = kart.results(G);
    if (!r || r.length !== G.seats.length || r.filter(x => x.win).length !== 1) fail('results wrong');
    if (new Set(r.map(x => x.place)).size !== r.length) fail('places should all differ');
    if (r[G.win].place !== 1) fail('winner is not first');
    const done = G.st.filter(s => s.fin);
    if (!done.length) fail('nobody finished');
    for (const s of done) if (s.best <= 0) fail('a finisher has no best lap');
    // finishers are ordered by time, ahead of anyone who did not finish
    const ord = G.res.order;
    for (let i = 1; i < ord.length; i++) { const a = G.st[ord[i - 1]].fin, b = G.st[ord[i]].fin; if (b && (!a || a > b)) fail('order is not by finishing time'); }
    if (opts.items !== 'off' && !seen.box) fail('nobody picked up an item box');
    if (opts.items === 'off' && (seen.box || seen.use)) fail('items appeared with power-ups off');
    if (human && G.karts[0].lap < opts.laps && !G.st[0].fin && G.res.order.indexOf(0) === 0) fail('a person who did not finish won');
    return { G, seen, r };
  } finally { Date.now = realNow; }
}
for (const track of TRACK_IDS) for (const items of ['on', 'chaos', 'off']) {
  const { G, seen, r } = race({ track, items, laps: 2, seats: items === 'chaos' ? 8 : 6, bots: items === 'on' ? 'sharp' : 'chill' });
  console.log(`${track} ${items}: ${G.seats[G.win].name} wins, you ${r[0].place}/${r.length}, events ${JSON.stringify(seen)}`);
  if (items !== 'off' && !(seen.use > 3)) fail('bots never used their items');
  if (items === 'chaos' && !seen.hit) fail('chaos race without a single hit');
}
{ // bots only (everyone dropped out): it still ends
  const { G } = race({ track: 'meadow', laps: 2, seats: 4 }, { human: false });
  if (G.st.filter(s => s.fin).length < 1) fail('a bot race needs finishers');
}

// ----- items, one at a time -----
{
  let now = realNow(); Date.now = () => now;
  const G = kart.create(players, { track: 'meadow', seats: 4, laps: 3 });
  now = G.goAt + 10; kart.fast(G, now);
  if (G.stage !== 'race') fail('race did not start after the lights');
  G.item[0] = { k: 'bubble', at: now };
  if (kart.act(G, 0, { t: 'use' })) fail('used an item that was still rolling');
  now += kart.ROLL_MS + 10;
  if (!kart.act(G, 0, { t: 'use' }) || !(G.shield[0] > now)) fail('bubble did not go up');
  if (!kart._hit(G, 0, 1, 'jelly', now) || G.shield[0]) fail('the bubble should soak up a hit');
  if (G.ev.at(-1).t !== 'pop') fail('a popped bubble should say so');
  now += 2000;
  if (!kart._hit(G, 0, 1, 'peel', now) || G.ev.at(-1).t !== 'hit') fail('an unshielded hit should land');
  if (kart._hit(G, 0, 1, 'peel', now + 100)) fail('hit twice in a row');
  // a peel left on the road trips up whoever drives over it
  const T = buildTrack('meadow'), k = G.karts[2]; // a bot
  G.obj.push({ id: 99, k: 'peel', x: k.x + Math.sin(k.h) * 1, z: k.z + Math.cos(k.h) * 1, y: k.y, owner: 0, born: now - 5000 });
  now += 3000; kart.fast(G, now); kart.fast(G, now + 50);
  if (G.obj.some(o => o.id === 99) || !(G.karts[2].spin > 0 || G.ev.some(e => e.t === 'hit' && e.s === 2))) fail('driving over a peel should spin you');
  // the sleepy cloud slows only the karts ahead
  G.karts.forEach((x, i) => { x.prog = i === 1 ? -100 : 500 + i; }); G.item[1] = null; G.item[0] = null;
  G.seats[1].human = true; G.seats[1].bot = false; G.seats[1].id = 'b';
  G.item[1] = { k: 'cloud', at: now - 5000 };
  if (!kart.act(G, 1, { t: 'use' })) fail('cloud not used');
  const z = G.ev.at(-1); if (z.t !== 'zzz' || z.hit.includes(1) || !z.hit.includes(2)) fail('cloud hit the wrong karts');
  if (!(G.karts[2].slow > 0)) fail('a bot under the cloud should slow down');
  // away: a bot drives your kart
  if (!kart.setAway(G, 0, true) || !G.seats[0].bot) fail('away did not hand over to a bot');
  if (kart.act(G, 0, { t: 'p', x: 0, z: 0, h: 0, v: 0 })) fail('took a report while away');
  kart.setAway(G, 0, false);
  Date.now = realNow;
}
if (JSON.stringify(kart.cleanOpts({ seats: 99, laps: 'x', track: 'nope', items: 'lots', bots: 'x' })) !== JSON.stringify({ seats: 6, laps: 3, track: 'random', items: 'on', bots: 'chill' })) fail('options not cleaned');

// ----- over the wire -----
const PORT = 19080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = m => { srv.kill(); fail(m); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, states = 0, full = 0;
const send = m => ws.send(JSON.stringify(m));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') room = m.room; if (m.t === 'state') { state = m.s; states++; if (m.s?.seats) full++; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'kart', opts: { seats: 4, laps: 2, track: 'peaks', items: 'on' } });
await wait(300);
if (room?.game !== 'kart' || room.opts.laps !== 2 || room.opts.track !== 'peaks') bail('room options wrong');
send({ t: 'start' });
await wait(400);
if (state?.game !== 'kart' || state.stage !== 'count' || state.k.length !== 4 || !state.seats) bail('race did not start');
for (let i = 0; i < 30 && state.stage !== 'race'; i++) await wait(200);
if (state.stage !== 'race') bail('lights never went green');
// drive like a browser: physics every 1/60 s, a report every 100 ms
const T = buildTrack(state.track), me = newKart(T, 0);
Object.assign(me, { x: state.k[0][0], z: state.k[0][1], h: state.k[0][3] }); Object.assign(me, locate(T, me.x, me.z, -1)); me.lap = -1;
const t0 = Date.now(); states = 0; full = 0;
for (let n = 0; n < 30; n++) {
  for (let k = 0; k < 6; k++) stepKart(T, me, autoDrive(T, me), 1 / 60);
  send({ t: 'act', a: { t: 'p', x: me.x, z: me.z, h: me.h, v: me.v, f: 0 } });
  await wait(100);
}
const rate = states / ((Date.now() - t0) / 1000);
if (rate < 12) bail('the race should stream at about 20 updates a second, got ' + rate.toFixed(1));
if (full < 1 || full > states / 5) bail('full seat info should come now and then, not every time');
const mine = state.k[state.me];
if (Math.hypot(mine[0] - me.x, mine[1] - me.z) > 8) bail('the server did not follow my kart');
if (!state.k.slice(1).some(k => k[4] > 5)) bail('the bots are not driving');
console.log(`streamed ${rate.toFixed(1)} updates a second, full seats ${full}/${states}`);
console.log('OK');
srv.kill(); process.exit(0);

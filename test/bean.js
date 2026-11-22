// Beanstalk Bounce test: the ledges, the climbing physics, streak scoring, whole games on a fake clock (bots, a
// climbing "person", the storm), what the server refuses, then a climb over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as bean from '../server/games/bean.js';
import { buildTower, floorAt, ledgeOff, newClimber, cloneClimber, stepClimber, stormY, stormSpeed, newRun, land, expire, bank, scoreOf, zoneOf, zoneName,
  PACES, W, FLOOR_H, ZONE, EDGE, JUMP0, G as GRAV, SPRING, CRUMBLE, MOVING, CRUMBLE_S, STREAK_MS } from '../public/games/bean/tower.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const STEP = 1 / 60;

// ----- the tower -----
for (const seed of [1, 77, 4242]) {
  const T = buildTower(seed), kinds = [0, 0, 0, 0];
  for (let i = 0; i < 400; i++) {
    const F = floorAt(T, i), w = F.x1 - F.x0;
    if (F !== floorAt(T, i)) fail('floors should be cached');
    if (i % ZONE === 0) { if (F.x0 !== -W || F.x1 !== W || F.kind) fail(`floor ${i} should be a full terrace`); continue; }
    if (w < 2.6 || w > 9.5) fail(`floor ${i} has an odd width ${w}`);
    for (const t of [0, .7, 1.9, 3.3]) { const o = ledgeOff(F, t); if (F.x0 + o < -W - .01 || F.x1 + o > W + .01) fail(`floor ${i} sticks out past the stalks`); }
    if (F.kind !== MOVING && ledgeOff(F, 1.23)) fail('only moving ledges move');
    if (i <= 6 && F.kind) fail('the first floors should be plain');
    kinds[F.kind]++;
  }
  if (!kinds[SPRING] || !kinds[CRUMBLE] || !kinds[MOVING] || kinds[0] < 200) fail('ledge kinds are off: ' + kinds);
  const B = buildTower(seed); if (JSON.stringify(floorAt(B, 37)) !== JSON.stringify(floorAt(T, 37))) fail('the same seed should give the same tower');
}
if (JSON.stringify(floorAt(buildTower(3), 31)) === JSON.stringify(floorAt(buildTower(4), 31))) fail('different seeds should differ');
if (zoneOf(24) !== 0 || zoneOf(25) !== 1 || !zoneName(7)) fail('zones');

// ----- the storm -----
for (const p of Object.keys(PACES)) {
  if (stormY(p, 0) !== stormY(p, 1.9) || stormY(p, 0) > -8) fail('the storm should wait below the meadow');
  let last = -1e9; for (let t = 0; t < 400; t += .5) { const y = stormY(p, t); if (y < last) fail('the storm never sinks'); last = y; }
  if (!(stormSpeed(p, 100) > stormSpeed(p, 20)) || stormSpeed(p, 9999) !== PACES[p].max) fail('the storm should speed up to its top speed');
  if (Math.abs((stormY(p, 50.5) - stormY(p, 49.5)) - stormSpeed(p, 50)) > .1) fail('storm height and speed disagree');
}
if (!(stormY('wild', 60) > stormY('normal', 60) && stormY('normal', 60) > stormY('chill', 60))) fail('paces are out of order');

// ----- physics -----
const run1 = (T, k, inp, secs, t = 0) => { let top = k.y; const cues = {}; for (let i = 0; i < secs * 60; i++) { const c = stepClimber(T, k, typeof inp === 'function' ? inp(k, i / 60) : inp, STEP, t + i / 60); if (c) cues[c] = (cues[c] || 0) + 1; top = Math.max(top, k.y); } return { top, cues }; };
{
  const T = buildTower(9);
  // a standing jump clears one floor but not two
  const k = newClimber(0, 1); const a = run1(T, k, (c, t) => ({ dir: 0, jump: t < .05 }), 1.5);
  if (a.top < FLOOR_H + .3 || a.top > FLOOR_H * 2) fail('a standing jump should clear exactly one floor, peaked at ' + a.top);
  if (Math.abs(a.top - JUMP0 * JUMP0 / (2 * GRAV)) > .2) fail('jump height is off');
  // a running jump goes much higher
  const r = newClimber(0, 1); r.x = -6; const b = run1(T, r, (c, t) => ({ dir: 1, jump: t > .5 && t < .56 }), 2);
  if (b.top < FLOOR_H * 4) fail('a sprint jump should clear four floors, peaked at ' + b.top);
  // running into a side stalk bounces you back with most of your speed
  const w = newClimber(0, 1); const c = run1(T, w, { dir: 1 }, 1.2);
  if (!c.cues.wall || w.x > W) fail('no bounce off the stalk');
  const w2 = newClimber(0, 1); w2.x = W - 1; w2.vx = 12; stepClimber(T, w2, { dir: 0 }, STEP, 0); for (let i = 0; i < 6 && w2.vx > 0; i++) stepClimber(T, w2, { dir: 0 }, STEP, 0);
  if (!(w2.vx < -9)) fail('a bounce should keep the speed, got ' + w2.vx);
  // you pass up through a ledge and land on it coming down
  const F1 = floorAt(T, 1), p = newClimber(0, 1); p.x = (F1.x0 + F1.x1) / 2;
  run1(T, p, (c, t) => ({ dir: 0, jump: t < .05 }), 1.5);
  if (p.on !== 1 || Math.abs(p.y - FLOOR_H) > 1e-6) fail('should have landed on floor 1, on ' + p.on);
  // walking off the end of a ledge drops you to the meadow
  run1(T, p, { dir: F1.x0 + W > W - F1.x1 ? -1 : 1 }, 2.5);
  if (p.on !== 0 || p.y !== 0) fail('should have dropped back to the meadow');
  // nobody leaves the gap or sinks below the meadow, whatever they press
  const z = newClimber(0, 1); for (let i = 0; i < 4000; i++) { stepClimber(T, z, { dir: (i >> 5) % 3 - 1, jump: i % 7 < 3 }, STEP, i / 60); if (Math.abs(z.x) > W || z.y < 0 || !Number.isFinite(z.y)) fail('climber escaped'); }
}
{ // special ledges, on a hand-made tower
  const mk = kind => { const T = buildTower(1); T.floors[1] = { i: 1, x0: -3, x1: 3, kind, amp: kind === MOVING ? 2 : 0, per: 3, ph: 0 }; return T; };
  // mushroom: throws you up
  let T = mk(SPRING), k = newClimber(0, 1); const s = run1(T, k, (c, t) => ({ dir: 0, jump: t < .05 }), 1.6);
  if (!s.cues.spring || s.top < FLOOR_H * 5) fail('a mushroom should throw you about six floors, got ' + s.top);
  // dry leaf: holds for a moment, then drops you, and stays gone
  T = mk(CRUMBLE); k = newClimber(0, 1); let landedAt = -1, fellAt = -1;
  for (let i = 0; i < 240; i++) { const t = i / 60, c = stepClimber(T, k, { dir: 0, jump: t < .05 }, STEP, t); if (c === 'land' && k.on === 1 && landedAt < 0) landedAt = t; if (c === 'drop') fellAt = t; }
  if (landedAt < 0 || fellAt < 0 || Math.abs(fellAt - landedAt - CRUMBLE_S) > .06) fail(`a dry leaf should drop ${CRUMBLE_S}s after landing (${landedAt} -> ${fellAt})`);
  if (k.on !== 0) fail('should be back on the meadow after the leaf dropped');
  run1(T, k, (c, t) => ({ dir: 0, jump: t < .05 }), 1.5, 4);
  if (k.on !== 0) fail('a dropped leaf should stay gone');
  // moving ledge: carries you along
  T = mk(MOVING); k = newClimber(0, 1); run1(T, k, (c, t) => ({ dir: 0, jump: t < .05 }), .9);
  if (k.on !== 1) fail('did not land on the moving ledge');
  const x0 = k.x, o0 = ledgeOff(T.floors[1], .9); run1(T, k, { dir: 0 }, .5, .9);
  if (Math.abs((k.x - x0) - (ledgeOff(T.floors[1], 1.4) - o0)) > .02 || k.on !== 1) fail('a moving ledge should carry you');
}

// ----- streaks -----
{
  const r = newRun();
  if (land(r, 1, 1000).big || r.st) fail('one floor is not a big jump');
  let x = land(r, 4, 2000); if (!x.big || r.st.n !== 1 || r.st.fl !== 3) fail('a three floor jump starts a streak');
  x = land(r, 6, 3000); x = land(r, 11, 4500);
  if (r.st.n !== 3 || r.st.fl !== 10 || r.st.until !== 4500 + STREAK_MS) fail('streak count is off');
  if (expire(r, 5000)) fail('the streak ended early');
  x = land(r, 12, 5200); // a small hop ends it and pays floors x jumps x 2
  if (!x.ended || x.ended.pts !== 60 || r.bonus !== 60 || r.st) fail('a small hop should bank the streak: ' + JSON.stringify(x));
  if (scoreOf(r) !== 12 * 10 + 60) fail('score');
  land(r, 15, 6000); if (bank(r).pts !== 0 || r.bonus !== 60) fail('a single big jump pays nothing');
  land(r, 18, 7000); land(r, 20, 8000); const e = expire(r, 8000 + STREAK_MS + 1);
  if (!e || e.pts !== 5 * 2 * 2 || r.top !== 60) fail('a streak should run out of time');
  land(r, 23, 20000); land(r, 26, 21000); x = land(r, 9, 22000); // falling ends it too, and the best floor stays
  if (!x.ended || r.best !== 26 || r.last !== 9) fail('a fall should end the streak');
  land(r, 9, 22500); if (r.st) fail('standing still is not a streak');
}

// ----- whole games on a fake clock -----
// A stand-in for a person: tries a few run-ups with the real physics and takes one that goes up.
function pickPlan(T, k, t) {
  let best = null;
  for (const dir of [-1, 1]) for (const run of [0, .15, .3, .5, .75]) {
    const c = cloneClimber(k); let tt = t, jumped = false;
    for (let n = 0; n < 220 && !(jumped && c.on >= 0); n++) { stepClimber(T, c, c.on >= 0 ? { dir, jump: tt - t >= run } : { dir: 0 }, STEP, tt); tt += STEP; if (c.on < 0) jumped = true; }
    const up = c.on - k.on; if (c.on >= 0 && (!best || up > best.up)) best = { dir, run, up, t0: t };
  }
  return best || { dir: 1, run: .2, up: 0, t0: t };
}
const realNow = Date.now;
function game(opts, { human = true, lazy = false } = {}) {
  let now = realNow(); Date.now = () => now;
  try {
    const G = bean.create(human ? players.slice(0, 1) : [], opts), n = G.seats.length;
    if (n !== Math.max(opts.seats || 4, human ? 1 : 0)) fail('seats not filled with bots');
    if (new Set(G.k.map(k => k.x)).size !== n || G.k.some(k => k.y !== 0 || k.on !== 0)) fail('everyone starts side by side on the meadow');
    const T = buildTower(G.seed), me = cloneClimber(G.k[0]), seen = {};
    if (human) { bean.act(G, 0, { t: 'p', x: 3, y: 9, vx: 0, vy: 0, on: -1 }); if (G.k[0].y) fail('moved before GO'); }
    let ev = 0, plan = null, cheat = false, jumped = false;
    for (let f = 0; f < 60 * 600 && G.ph === 'play'; f++) {
      now += 1000 / 60;
      const t = (now - G.goAt) / 1000;
      if (human && G.stage === 'climb' && !G.st[0].out && !(lazy && t > 20)) {
        if (!plan && me.on >= 0) { plan = pickPlan(T, me, t); jumped = false; }
        const inp = !plan ? { dir: 0 } : me.on >= 0 ? { dir: plan.dir, jump: t - plan.t0 >= plan.run } : { dir: 0 };
        stepClimber(T, me, inp, STEP, t);
        if (me.on < 0) jumped = true; else if (jumped) plan = null;
        if (me.landed >= 0) bean.act(G, 0, { t: 'l', f: me.landed, x: me.x, m: (t + STEP) * 1000 });
        if (f % 6 === 0) bean.act(G, 0, { t: 'p', x: me.x, y: me.y, vx: me.vx, vy: me.vy, on: me.on, fc: me.face });
        if (!cheat && t > 8) { // lies are refused
          cheat = true; const b = G.run[0].best, y = G.k[0].y;
          bean.act(G, 0, { t: 'p', x: 0, y: y + 400, vx: 0, vy: 0, on: -1 }); if (G.k[0].y !== y) fail('a teleport was accepted');
          bean.act(G, 0, { t: 'l', f: b + 40, x: 0, m: t * 1000 }); bean.act(G, 0, { t: 'l', f: G.run[0].last + 12, x: 0, m: t * 1000 });
          const far = G.run[0].last + 3, F = floorAt(T, far); bean.act(G, 0, { t: 'l', f: far, x: F.x1 + 9 > W ? F.x0 - 9 : F.x1 + 9, m: t * 1000 });
          if (G.run[0].best !== b) fail('a made-up landing was accepted');
        }
      }
      if (f % 3 === 0) bean.fast(G, now);
      for (const e of G.ev) if (e.n > ev) { ev = e.n; seen[e.t] = (seen[e.t] || 0) + 1; }
      if (G.stage === 'climb') for (let s = 0; s < n; s++) if (G.seats[s].bot && !G.st[s].out && (Math.abs(G.k[s].x) > W || G.k[s].y < 0)) fail('a bot left the stalk');
    }
    if (G.ph !== 'end') fail('the game did not end');
    const r = bean.results(G);
    if (!r || r.length !== n || r.filter(x => x.win).length !== 1) fail('results wrong');
    if (new Set(r.map(x => x.place)).size !== n || r[G.win].place !== 1) fail('places should all differ, winner first');
    const ord = G.res.order; for (let i = 1; i < n; i++) if (G.res.score[ord[i]] > G.res.score[ord[i - 1]]) fail('order is not by score');
    for (let s = 0; s < n; s++) if (r[s].pts !== G.res.floor[s] * 10 + G.res.bonus[s]) fail('score is not floors x 10 + streaks');
    if (seen.go !== 1 || seen.end !== 1) fail('go and end should each happen once');
    return { G, seen, r, t: (G.endAt - G.goAt) / 1000 };
  } finally { Date.now = realNow; }
}
for (const pace of ['chill', 'normal', 'wild']) for (const bots of ['chill', 'sharp']) {
  const { G, seen, r, t } = game({ seats: 4, pace, bots });
  const fl = G.res.floor;
  console.log(`${pace}/${bots}: ${G.seats[G.win].name} wins on floor ${fl[G.win]}, you ${r[0].place}/4 on floor ${fl[0]} (${r[0].pts} pts), ${t.toFixed(0)}s, events ${JSON.stringify(seen)}`);
  if (seen.out !== 4) fail('the storm should catch everyone');
  if (fl[0] < 15) fail('the stand-in person barely climbed: floor ' + fl[0]);
  if (Math.max(...fl.slice(1)) < 20) fail('the bots barely climbed');
  if (t < 20 || t > 590) fail('odd game length ' + t);
  if (!seen.streak) fail('nobody made a streak');
  if (Math.max(...fl) >= ZONE && !seen.zone) fail('reaching a new zone should be news');
}
{ // someone who stops climbing is caught, and the bots get only a few seconds more
  const { G, t } = game({ seats: 4, pace: 'wild', bots: 'sharp' }, { lazy: true });
  if (!G.st[0].out) fail('standing still should get you caught');
  if (t * 1000 > G.st[0].out + 7000) fail('the bots should stop soon after the last person is out');
}
{ // solo, and bots only
  const a = game({ seats: 1, pace: 'wild' }); if (a.G.seats.length !== 1 || a.r[0].place !== 1 || !a.r[0].win) fail('solo game');
  game({ seats: 4, pace: 'wild' }, { human: false });
}

// ----- odds and ends -----
{
  let now = realNow(); Date.now = () => now;
  const G = bean.create(players, { seats: 4 });
  now = G.goAt + 20; bean.fast(G, now);
  if (G.stage !== 'climb') fail('did not start after the countdown');
  const v = bean.view(G, 0); if (v.me !== 0 || v.k.length !== 4 || v.seed !== G.seed || !v.seats) fail('view');
  if (bean.view(G, -1).me !== -1) fail('watcher view');
  // "the storm got me" takes you out once; after that nothing you send counts
  bean.act(G, 0, { t: 'l', f: 1, x: (floorAt(buildTower(G.seed), 1).x0 + floorAt(buildTower(G.seed), 1).x1) / 2, m: 600 });
  if (G.run[0].best !== 1) fail('a fair landing was refused');
  if (!bean.act(G, 0, { t: 'd' }) || !G.st[0].out || G.ev.at(-1).t !== 'out') fail('out');
  bean.act(G, 0, { t: 'l', f: 2, x: 0, m: 900 }); if (G.run[0].best !== 1) fail('landed after being caught');
  // away: a bot climbs for you, and your reports are ignored meanwhile
  if (!bean.setAway(G, 1, true) || !G.seats[1].bot) fail('away did not hand over to a bot');
  bean.act(G, 1, { t: 'p', x: 1, y: 5, vx: 0, vy: 0, on: -1 }); if (G.k[1].y) fail('took a report while away');
  for (let i = 0; i < 200; i++) { now += 50; bean.fast(G, now); }
  if (G.run[1].best < 3) fail('the stand-in bot did not climb');
  bean.setAway(G, 1, false); if (G.seats[1].bot) fail('back from away');
  Date.now = realNow;
}
if (JSON.stringify(bean.cleanOpts({ seats: 99, pace: 'x', bots: 'x' })) !== JSON.stringify({ seats: 4, pace: 'normal', bots: 'chill' })) fail('options not cleaned');
if (bean.results(bean.create(players, {})) !== null) fail('no results before the end');

// ----- over the wire -----
const PORT = 19080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = m => { srv.kill(); fail(m); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, states = 0, full = 0, gain = null;
const send = m => ws.send(JSON.stringify(m));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') room = m.room; if (m.t === 'me' && m.gain) gain = m.gain; if (m.t === 'state') { state = m.s; states++; if (m.s?.seats) full++; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'bean', opts: { seats: 2, pace: 'wild', bots: 'sharp' } });
await wait(300);
if (room?.game !== 'bean' || room.opts.pace !== 'wild' || room.opts.seats !== 2) bail('room options wrong');
send({ t: 'start' });
await wait(400);
if (state?.game !== 'bean' || state.stage !== 'count' || state.k.length !== 2 || !state.seats) bail('game did not start');
for (let i = 0; i < 30 && state.stage !== 'climb'; i++) await wait(200);
if (state.stage !== 'climb') bail('the countdown never ended');
// climb like a browser for a few seconds: physics every 1/60 s, a report every 100 ms, landings as they happen
const T = buildTower(state.seed), me = newClimber(0, 1); Object.assign(me, { x: state.k[0][0], y: 0 });
let t = state.t / 1000, plan = null, jumped = false; const t0 = Date.now(); states = 0; full = 0;
for (let n = 0; n < 40; n++) {
  for (let q = 0; q < 6; q++) {
    if (!plan && me.on >= 0) { plan = pickPlan(T, me, t); jumped = false; }
    stepClimber(T, me, !plan ? { dir: 0 } : me.on >= 0 ? { dir: plan.dir, jump: t - plan.t0 >= plan.run } : { dir: 0 }, STEP, t); t += STEP;
    if (me.on < 0) jumped = true; else if (jumped) plan = null;
    if (me.landed >= 0) send({ t: 'act', a: { t: 'l', f: me.landed, x: me.x, m: t * 1000 } });
  }
  send({ t: 'act', a: { t: 'p', x: me.x, y: me.y, vx: me.vx, vy: me.vy, on: me.on, fc: me.face } });
  await wait(100);
}
const rate = states / ((Date.now() - t0) / 1000);
if (rate < 12) bail('the climb should stream at about 20 updates a second, got ' + rate.toFixed(1));
if (full < 1 || full > states / 5) bail('full seat info should come now and then, not every time');
if (Math.abs(state.k[0][1] - me.y) > 8) bail('the server did not follow my climber');
if (state.fl[0] < 3 || state.sc[0] < state.fl[0] * 10) bail('my floors were not counted: ' + state.fl[0]);
if (state.fl[1] < 3) bail('the bot is not climbing');
console.log(`streamed ${rate.toFixed(1)} updates a second, I am on floor ${state.fl[0]} with ${state.sc[0]} pts, the bot on ${state.fl[1]}`);
// caught by the storm: the bot gets a few seconds more, then the hub pays coins by place
send({ t: 'act', a: { t: 'd' } });
for (let i = 0; i < 100 && state.ph !== 'end'; i++) await wait(200);
if (state.ph !== 'end' || !state.res) bail('the storm never ended the game');
await wait(300);
if (!gain || gain.of !== 2 || ![10, 1].includes(gain.coins) || gain.coins !== (state.res.order[0] === 0 ? 10 : 1)) bail('coins should go by place: ' + JSON.stringify(gain));
console.log(`ended: place ${state.res.order.indexOf(0) + 1}/2, ${gain.coins} coins`);
console.log('OK');
srv.kill(); process.exit(0);

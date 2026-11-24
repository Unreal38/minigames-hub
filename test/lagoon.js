// Bubble Lagoon test: checks the shared rules (shots, pops, drops, eggs, the reef), plays whole games on a fake clock
// with a "browser" that mirrors the server the way the real one does, measures the bots, then plays over the real server.
import { spawn as launch } from 'node:child_process';
import * as lg from '../server/games/lagoon.js';
import * as R from '../public/games/lagoon/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const blank = (rows, par = 0) => { const st = R.newState(7); st.b = rows.map(r => Array.from(r, ch => +ch || 0)); st.par = par; st.pend = []; return st; };

// ----- the rules -----
{ // everyone starts with the same lagoon and the same order of bubbles
  const a = R.newState(42), b = R.newState(42), c = R.newState(43);
  if (R.encode(a) !== R.encode(b) || a.cur !== b.cur || a.nxt !== b.nxt) fail('same seed, different lagoon');
  if (R.encode(a) === R.encode(c)) fail('lagoon not seeded');
  if (a.b.length !== R.START || a.b.some(r => r.length !== R.COLS || r.some(v => v < 1 || v > R.KINDS))) fail('start rows wrong');
  if (JSON.stringify(R.decode(R.encode(a))) !== JSON.stringify({ par: a.par, b: a.b })) fail('lagoon does not survive the wire');
}
{ // straight up sticks under the reef; a shot bounces off the wall; nonsense is refused
  const st = blank([]); st.cur = 3;
  const tr = R.trace(st, 0); if (!tr || tr.r !== 0 || tr.path.length !== 2) fail('straight shot wrong: ' + JSON.stringify(tr));
  const side = R.trace(st, 700); if (!side || side.path.length < 3 || side.r !== 0) fail('no bounce: ' + JSON.stringify(side));
  for (const bad of [[900], [1.5], [0, 2], [0, 0, -1], [0, 0, 0, st.rows - 1], ['x']]) if (R.lock(R.clone(st), ...bad)) fail('nonsense accepted: ' + bad);
  const res = R.lock(st, 0); if (!res || st.b[0][res.c] !== 3 || st.locks !== 1 || res.popped.length) fail('bubble did not stick');
}
{ // three of a kind pop, what hangs on them falls and is sent, an egg beside the pop cracks
  //   row0 (par 0, not shifted): 1 1 . . . . . .   row1 (shifted): 2 . . .   row2: 7 under the 1s? build by hand
  const st = blank(['11000000', '20000000', '50000000']); st.cur = 1; st.nxt = 2;
  st.b[0][3] = R.EGG; // an egg right of where the third 1 will land (col 2)
  // aim so the bubble lands at row 0, col 2
  let aim = null; for (let a = -400; a <= 400 && aim === null; a += 5) { const tr = R.trace(st, a); if (tr && tr.r === 0 && tr.c === 2) aim = a; }
  if (aim === null) fail('could not find the aim');
  const res = R.lock(st, aim);
  if (res.popped.length !== 3) fail('three did not pop: ' + JSON.stringify(res));
  if (res.cracked.length !== 1) fail('egg beside the pop did not crack');
  if (res.dropped.length !== 2 || res.out !== 2 + 4 /* and the lagoon is empty: a clean sweep */ || st.sent !== 6 || st.freed !== 5) fail('hanging bubbles did not fall: ' + JSON.stringify(res));
  if (st.b.length !== 0 || !res.clean) fail('lagoon should be empty');
}
{ // eggs float in when nothing pops, never when something does; pops knock waiting eggs out first
  const st = blank(['12345612']); st.cur = 3; st.nxt = 3; st.pend = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const res = R.lock(st, 0, 0, 2);
  if (res.popped.length || res.took !== 2 || res.eggs.length !== 2 || st.pend.length !== 1) fail('eggs did not float in: ' + JSON.stringify(res));
  if (R.count(st.b) !== 8 + 1 + 2 || res.eggs.some(([r, c]) => st.b[r][c] !== R.EGG)) fail('eggs not in the lagoon');
  const s2 = blank(['11000004', '02000000']); s2.cur = 1; s2.pend = [{ id: 1 }, { id: 2 }, { id: 3 }];
  let aim = null; for (let a = -400; a <= 400 && aim === null; a += 5) { const tr = R.trace(s2, a); if (tr && tr.r === 0 && tr.c === 2) aim = a; }
  const r2 = R.lock(s2, aim, 0, 3);
  if (r2.popped.length !== 3 || r2.took !== 0 || r2.dropped.length !== 1 || r2.out !== 0 || s2.pend.length !== 2) fail('pop did not knock eggs back: ' + JSON.stringify(r2) + s2.pend.length);
}
{ // the reef pushes rows out by the clock, quicker and quicker; a bubble over the line is out
  if (R.rowsDue('normal', 0) !== R.START || R.rowsDue('normal', R.PACE.normal[0] + 1) !== R.START + 1) fail('reef clock wrong');
  if (!(R.rowsDue('fast', 60000) > R.rowsDue('normal', 60000) && R.rowsDue('normal', 60000) > R.rowsDue('calm', 60000))) fail('speeds not in order');
  if (R.nextRowIn('normal', 0) !== R.PACE.normal[0] || R.nextRowIn('normal', R.PACE.normal[0] - 1000) !== 1000) fail('next row timer wrong');
  const st = R.newState(9), top = R.encode(st);
  const res = R.lock(st, 0, 0, 0, st.rows + 2);
  if (res.added !== 2 || st.rows !== R.START + 2 || st.b.length < R.START + 2) fail('rows not pushed');
  if (JSON.stringify(st.b[0]) !== JSON.stringify(R.rowAt(9, R.START + 1))) fail('new row is not the seeded one');
  const full = R.newState(9); let shots = 0;
  while (!full.dead && shots < 200) { R.lock(full, 0, 0, 0, full.rows + 1); shots++; }
  if (!full.dead || full.b.length <= R.LIM) fail('a full lagoon is not out');
  if (R.lock(full, 0)) fail('shot after being out');
  void top;
}

// ----- whole games: a "browser" keeps its own lagoon and reports each shot, exactly like client.js -----
const adopt = (v, m) => ({ ...R.decode(v.b[v.me]), seed: v.seed, rows: m.rows, nx: m.nx, cur: m.cur, nxt: m.nxt, eg: m.eg, pend: m.pend.map(id => ({ id })), locks: m.locks, streak: m.streak, freed: m.freed, sent: m.sent, dead: m.dead });
function play(opts, { slip = 0, every = 1300, cheat = null } = {}) {
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const G = lg.create(players, opts), n = G.seats.length;
    if (n !== (opts.seats || 4)) fail('seats not filled with bots');
    const mine = [0, 1].map(() => ({ st: null, sync: -1, last: 0 }));
    let resyncs = 0, cheated = false;
    for (let i = 0; i < 400000 && G.ph === 'play'; i++) {
      now += 50; lg.fast(G, now);
      for (const s of [0, 1]) {
        if (G.ph !== 'play') break;
        const v = lg.view(G, s), C = mine[s], m = v.mine;
        if (v.b.length !== n || v.x.length !== n) fail('view wrong');
        if (!C.st || m.sync !== C.sync) { if (C.st) resyncs++; C.st = adopt(v, m); C.sync = m.sync; }
        else if (m.locks === C.st.locks) { C.st.pend = m.pend.map(id => ({ id })); if (R.encode(C.st) !== v.b[s]) fail('browser and server lagoons differ'); if (m.cur !== C.st.cur || m.nxt !== C.st.nxt || m.eg !== C.st.eg) fail('browser and server bubbles differ'); }
        if (v.stage !== 'go' || C.st.dead || now - C.last < every) continue;
        C.last = now;
        if (cheat && s === 0 && !cheated && C.st.locks > 3 && cheat(G, C, v) !== false) { cheated = true; continue; }
        const mv = lg.bestShot(C.st, { slip, step: 80 }); if (!mv) continue;
        const g = Math.min(C.st.pend.length, R.MAXG), k = R.rowsDue(v.speed, v.t - 150); // the browser's clock runs a little behind
        R.lock(C.st, mv.a, mv.w, g, Math.max(k, C.st.rows));
        lg.act(G, s, { t: 's', y0: C.sync, n: C.st.locks, a: mv.a, w: mv.w, g, k: Math.max(k, C.st.rows) });
      }
    }
    if (G.ph !== 'end') fail('game did not end');
    const r = lg.results(G), places = G.x.map(x => x.place).sort((a, b) => a - b);
    if (places.join() !== G.seats.map((_, i) => i + 1).join()) fail('places wrong: ' + places);
    if (G.res.order[0] !== G.win || !r[G.win].win || r.filter(x => x.win).length !== 1 || r.some((x, i) => x.place !== G.x[i].place)) fail('results disagree');
    if (G.st.filter(s => !s.dead).length > 1 && G.seats.some((s, i) => s.human && !s.bot && !G.st[i].dead && G.x[i].place !== 1)) fail('a player still in did not win');
    return { G, resyncs };
  } finally { Date.now = realNow; }
}
const a = play({});
if (a.resyncs) fail('an honest browser fell out of step ' + a.resyncs + ' times');
console.log('default table: winner', a.G.seats[a.G.win].name, 'after', (a.G.res.ms / 1000).toFixed(0) + 's, freed', a.G.res.freed.join('/'), 'sent', a.G.res.sent.join('/'));
const b = play({ seats: 4, speed: 'fast', bots: 'sharp' }, { slip: .1, every: 900 });
if (b.resyncs) fail('fell out of step at a fast table');
console.log('four seats, fast, sharp bots: winner', b.G.seats[b.G.win].name, 'after', (b.G.res.ms / 1000).toFixed(0) + 's');
const c = play({ seats: 2, speed: 'calm' }, { every: 1600 });
if (c.resyncs) fail('fell out of step in a duel');
if (c.G.res.ms > 12 * 60000) fail('a duel dragged on');
console.log('duel, calm: winner', c.G.seats[c.G.win].name, 'after', (c.G.res.ms / 1000).toFixed(0) + 's');
// cheats and hiccups are refused and the browser is put back in step
for (const cheat of [
  (G, C) => lg.act(G, 0, { t: 's', y0: C.sync, n: C.st.locks + 5, a: 0, w: 0, g: 0, k: C.st.rows }),                 // skipping shots
  (G, C) => lg.act(G, 0, { t: 's', y0: C.sync, n: C.st.locks + 1, a: 0, w: 0, g: 0, k: C.st.rows + 9 }),             // rows from the future
  (G, C) => { G.goAt -= 40000; lg.act(G, 0, { t: 's', y0: C.sync, n: C.st.locks + 1, a: 0, w: 0, g: 0, k: C.st.rows }); }, // holding the reef back
  (G, C, v) => { const m = lg.bestShot(G.st[0], { step: 80 }), t = R.clone(G.st[0]); if (R.lock(t, m.a, m.w, 0, t.rows).popped.length) return false; G.st[0].pend.push({ id: 99, at: 0 }); lg.act(G, 0, { t: 's', y0: C.sync, n: C.st.locks + 1, a: m.a, w: m.w, g: 0, k: Math.max(C.st.rows, R.rowsDue(v.speed, v.t)) }); }, // ducking an old egg
  (G, C) => lg.act(G, 0, { t: 's', y0: C.sync, n: C.st.locks + 1, a: 'x', w: null, g: {}, k: -3 }),                  // nonsense
  (G, C) => lg.act(G, 0, { t: 's', y0: C.sync, n: C.st.locks + 1, a: 5000, w: 0, g: 0, k: C.st.rows }),              // aiming through the floor
]) { const r = play({ seats: 3 }, { cheat }); if (r.resyncs < 1) fail('a bad shot was not put right'); }
{ // stale messages from before a resync are dropped quietly
  const G = lg.create(players, { seats: 2 }); const realNow = Date.now; let now = realNow() + 5000; Date.now = () => now; lg.fast(G, now);
  const before = G.x[0].sync; lg.act(G, 0, { t: 's', y0: before - 1, n: 1, a: 0, w: 0, g: 0, k: R.START });
  if (G.x[0].sync !== before || G.st[0].locks) fail('stale message acted on');
  // a frozen tab: a shot is fired for them in the end, and a player who leaves is played for by a bot
  now += 60000; lg.fast(G, now); if (!G.st[0].locks || G.x[0].sync === before) fail('frozen player was not moved along');
  lg.setAway(G, 1, true); const l = G.st[1].locks; for (let i = 0; i < 100; i++) { now += 100; lg.fast(G, now); }
  if (G.ph === 'play' && G.st[1].locks <= l) fail('no bot for the player who left');
  Date.now = realNow;
}
{ // eggs go to whoever is doing best
  const G = lg.create([...players, { id: 'c', name: 'Cy', color: '#9aa8ff', av: [] }], { seats: 3 });
  G.x[1].n = 5; G.x[2].n = 30;
  lg._settle(G, 0, { out: 3, popped: [1], dropped: [] }, Date.now());
  if (G.st[1].pend.length !== 3 || G.st[2].pend.length) fail('eggs did not go to the leader');
  if (!G.ev.some(e => e.t === 'atk' && e.to === 1 && e.k === 3)) fail('no attack event');
}
{ // bots: sharp beats chill, nobody sinks at once, games end
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  let sharp = 0, ms = 0, first = 0; const N = 30;
  for (let g = 0; g < N; g++) {
    const G = lg.create([{ id: 'w', name: 'W', color: '#fff000', av: [] }], { seats: 4 });
    G.st[0].dead = true; G.x[0].place = 4; // the person is out at once; the test then lets the bots play on
    let firstOut = 0;
    for (let i = 0; i < 400000; i++) {
      now += 50;
      for (let s = 1; s < 4; s++) if (!G.st[s].dead && now >= G.x[s].botAt && now > G.goAt) {
        const lvl = lg.BOT[s === 1 ? 'sharp' : 'chill'], st = G.st[s], m = lg.bestShot(st, lvl), res = m && R.lock(st, m.a, m.w, Math.min(st.pend.length, R.MAXG), R.rowsDue('normal', now - G.goAt));
        G.x[s].botAt = now + lvl.ms;
        if (!res) { st.dead = true; continue; }
        lg._settle(G, s, res, now);
      }
      const left = [1, 2, 3].filter(s => !G.st[s].dead);
      if (left.length < 3 && !firstOut) firstOut = now - G.goAt;
      if (left.length <= 1) { if (left[0] === 1) sharp++; ms += now - G.goAt; first += firstOut; break; }
    }
  }
  Date.now = realNow;
  console.log(`bots: sharp outlasted two chill ones ${sharp}/${N}; games ${(ms / N / 1000).toFixed(0)}s on average, first knock-out at ${(first / N / 1000).toFixed(0)}s`);
  if (sharp < N * .5) fail('sharp bots are not better than chill ones');
  if (first / N < 40000) fail('bots sink too soon');
  if (ms / N > 6 * 60000) fail('bot games drag on');
}

// ----- over the real server -----
const PORT = 24080 + (Math.random() * 900 | 0);
const srv = launch('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}` }, stdio: 'inherit' });
const bail = msg => { srv.kill(); fail(msg); };
await new Promise(r => setTimeout(r, 600));
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
let room = null, state = null, me = null;
const send = msg => ws.send(JSON.stringify(msg));
ws.onopen = () => send({ t: 'hello', name: 'Ana', color: '#ff8fab' });
ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.t === 'room') room = msg.room; if (msg.t === 'state') state = msg.s; if (msg.t === 'me' && msg.gain) me = msg; };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(300);
send({ t: 'create', game: 'lagoon', opts: { seats: 4, speed: 'fast', bots: 'sharp', laps: 3 } });
await wait(300);
if (room?.game !== 'lagoon' || room.opts.seats !== 4 || room.opts.speed !== 'fast' || 'laps' in room.opts) bail('room options wrong');
send({ t: 'opts', opts: { seats: 2 } }); await wait(200);
if (room.opts.seats !== 2 || room.opts.speed !== 'fast') bail('option change lost');
send({ t: 'start' }); await wait(300);
if (state?.game !== 'lagoon' || state.seats.length !== 2 || state.stage !== 'count' || !state.mine) bail('game did not start');
// shoot every bubble straight up without thinking: a quick way to sink
let st = null, sync = -1, sent = 0, got = 0;
for (let i = 0; i < 1500 && state.ph === 'play'; i++) {
  const m = state.mine;
  if (!st || m.sync !== sync) { st = adopt(state, m); sync = m.sync; }
  else if (m.locks === st.locks) st.pend = m.pend.map(id => ({ id }));
  if (state.stage === 'go' && !st.dead) {
    const g = Math.min(st.pend.length, R.MAXG), k = Math.max(st.rows, R.rowsDue(state.speed, state.t)), a = (sent % 5 - 2) * 60;
    const res = R.lock(st, a, 0, g, k); got += res.took; send({ t: 'act', a: { t: 's', y0: sync, n: st.locks, a, w: 0, g, k } }); sent++;
  }
  await wait(160);
}
if (state.ph !== 'end') bail('game over the server did not finish');
if (state.mine.sync !== 0) bail('server and test fell out of step');
if (state.win === state.me || state.x[state.me][4] !== 2) bail('shooting blind should lose');
await wait(300);
if (!me?.gain || !(me.gain.coins >= 1)) bail('coins not paid by place: ' + JSON.stringify(me?.gain));
if (!room.board?.length) bail('table scoreboard empty');
console.log('OK server game:', sent, 'shots,', got, 'eggs taken, placed', state.x[state.me][4], '· gained', JSON.stringify(me.gain));
srv.kill(); process.exit(0);

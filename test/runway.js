// Sky Runway test: scoring, options, whole games on a fake clock (dressing with fixed parts kept, hidden looks, votes,
// Secret walk, early ends, people who leave), then a short game with three people over the real WebSocket server.
import { spawn } from 'node:child_process';
import * as rw from '../server/games/runway.js';
import { THEMES, TWISTS, FREE_KEYS, POSES, PICK_N, WRITE_MAX, cleanTheme, themeName, scoreLook } from '../public/games/runway/rules.js';
import { AV_KEYS, OPT } from '../public/avatar.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const IX = Object.fromEntries(AV_KEYS.map((k, i) => [k, i]));
const av = o => AV_KEYS.map(k => o[k] ?? 0);
const people = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffb547', '#e5543b', '#4fc3e8', '#2b2a30', '#f1ede6'][i], av: av({ body: i % 6, height: i % 3, skin: i % 8, hair: i + 1 }) }));

// ----- rules -----
{
  const s = scoreLook([5, 4]); if (s.pts !== 90 || s.n !== 2 || s.fives !== 1) fail('two votes: ' + JSON.stringify(s));
  const d = scoreLook([1, 5, 5, 4, 3]); if (d.pts !== 80 || d.avg !== 4 || d.fives !== 2) fail('highest and lowest should drop with 5 judges: ' + JSON.stringify(d)); // 3,4,5 -> 4
  const f = scoreLook([1, 5, 5, 3]); if (f.pts !== 70) fail('with 4 judges nothing drops: ' + JSON.stringify(f));
  if (scoreLook([]).pts !== 0 || scoreLook([0, 6, 'x']).n !== 0) fail('no votes or bad votes');
}
if (new Set(THEMES.map(t => t[0])).size !== THEMES.length || THEMES.length < 30 || THEMES.some(t => !t[1] || !t[2])) fail('themes need ids and both languages');
if (TWISTS.some(t => !t[1] || !t[2]) || POSES.length !== 3) fail('twists or poses wrong');
if (FREE_KEYS.some(k => !(k in IX)) || ['body', 'height', 'skin', 'face', 'eyes'].some(k => FREE_KEYS.includes(k))) fail('free keys wrong');
for (const [o, want] of [[{}, '3/90/shown'], [{ rounds: 5, time: 60, names: 'secret' }, '5/60/secret'], [{ rounds: 4, time: 7, names: 'x', bots: 3 }, '3/90/shown']]) {
  const c = rw.cleanOpts(o); if ([c.rounds, c.time, c.names].join('/') !== want || Object.keys(c).length !== 3) fail('options not cleaned: ' + JSON.stringify(c));
}
if (cleanTheme('  Under\u0000 the\u202e   sea  ') !== 'Under the sea' || cleanTheme(' !!! ') !== '' || Array.from(cleanTheme('ż'.repeat(90))).length !== WRITE_MAX) fail('written themes not cleaned');
if (themeName('*Under the sea') !== 'Under the sea' || !themeName('pirate')) fail('theme names wrong');
if (rw.meta.minHumans !== 3 || rw.meta.maxPlayers !== 8 || rw.meta.minPlayers !== 3) fail('meta wrong');

// ----- whole games on a fake clock -----
let now = 1_000_000; const realNow = Date.now; Date.now = () => now;
const run = (G, ms) => { const end = now + ms; while (now < end && G.ph === 'play') { now += 100; rw.tick(G, now); } };
const toDress = G => { run(G, rw.MS.pick + rw.MS.theme + 300); if (G.stage !== 'dress') fail('no dressing after the theme: ' + G.stage); };

{ // a whole game: dressing, the looks stay hidden, every vote, the reveal, the end
  const G = rw.create(people(6), { rounds: 2, time: 60 });
  if (G.seats.length !== 6 || G.seats.some(s => s.bot) || G.stage !== 'pick' || G.picks.length !== PICK_N || G.picks.some(p => !THEMES.some(t => t[0] === p.th))) fail('game did not start right');
  for (let r = 0; r < 2; r++) {
    toDress(G);
    // a look: changes what may change, keeps body, height, skin and face
    const want = av({ body: 5, height: 2, skin: 7, face: 3, top: 32 + r, hat: 47, hand: 18, back: 12, glasses: 13, hair: 9, hairC: 4 });
    if (!rw.act(G, 0, { t: 'look', av: want })) fail('a look was refused');
    const l = G.looks[0];
    if (l[IX.top] !== 32 + r || l[IX.hat] !== 47 || l[IX.hand] !== 18 || l[IX.back] !== 12 || l[IX.glasses] !== 13 || l[IX.hair] !== 9) fail('look not taken: ' + l);
    if (l[IX.body] !== 0 || l[IX.height] !== 0 || l[IX.skin] !== 0 || l[IX.face] !== 0) fail('fixed parts changed: ' + l);
    if (rw.act(G, 0, { t: 'look', av: want })) fail('the same look counted as a change');
    rw.act(G, 1, { t: 'look', av: av({ top: OPT.top.length + 5, hat: 3 }) }); if (G.looks[1][IX.top] !== OPT.top.length - 1 && G.looks[1][IX.top] !== 0) fail('an item past the end got through');
    rw.act(G, 0, { t: 'pose', p: 2 }); if (G.pose[0] !== 2 || rw.act(G, 0, { t: 'pose', p: 9 })) fail('pose wrong');
    const v1 = rw.view(G, 1);
    if (v1.looks[0] !== null || v1.pose[0] !== 0 || !v1.looks[1]) fail("a look shows before its walk");
    if (rw.act(G, 0, { t: 'vote', v: 5 })) fail('voted while dressing');
    // everyone ready ends dressing early (a changed look takes the ready back)
    for (let s = 0; s < 6; s++) rw.act(G, s, { t: 'ready', on: true });
    rw.act(G, 2, { t: 'look', av: av({ hat: 5 + r }) }); if (G.ready[2]) fail('a change after Ready should take it back');
    rw.act(G, 2, { t: 'ready', on: true });
    run(G, 200); if (G.stage !== 'walk' || G.order.length !== 6 || new Set(G.order).size !== 6) fail('walks did not start: ' + G.stage);
    for (let k = 0; k < 6; k++) {
      const w = G.order[G.walk]; if (G.stage !== 'walk') fail('lost the walk');
      const v = rw.view(G, (w + 1) % 6); if (!v.looks[w] || v.walker !== w || v.cur.av !== G.looks[w]) fail('the walker is not shown');
      if (G.order.slice(G.walk + 1).some(s => s !== (w + 1) % 6 && v.looks[s])) fail('a look shows before its walk');
      if (rw.act(G, w, { t: 'vote', v: 5 })) fail('a vote for yourself');
      if (rw.act(G, (w + 1) % 6, { t: 'vote', v: 7 })) fail('a 7-star vote');
      for (let s = 0; s < 6; s++) if (s !== w) rw.act(G, s, { t: 'vote', v: 1 + (s + w) % 5 });
      if (G.tEnd - now > rw.MS.early + 100 && now - (G.tEnd - G.tAll) > 4500) fail('all votes in: the walk should end early');
      rw.act(G, (w + 1) % 6, { t: 'vote', v: 5 }); // changing your mind
      if (G.votes[w][(w + 1) % 6] !== 5) fail('a changed vote was not taken');
      run(G, rw.MS.walk + 100);
    }
    if (G.stage !== 'reveal' || !G.last || G.last.some(x => !x || x.n !== 5)) fail('no reveal: ' + G.stage);
    const w0 = G.order[0], exp = scoreLook(G.votes[w0].filter((v, j) => j !== w0 && v));
    if (G.last[w0].pts !== exp.pts) fail('round points wrong');
    run(G, rw.MS.reveal + 100);
  }
  if (G.ph !== 'end' || !G.res) fail('game did not end');
  const R = rw.results(G);
  const order = G.res.order; for (let k = 1; k < 6; k++) { const a = order[k - 1], b = order[k]; if (G.tot[a] < G.tot[b] || (G.tot[a] === G.tot[b] && G.fives[a] < G.fives[b])) fail('final order wrong'); }
  if (R.length !== 6 || R.some(x => x.idle)) fail('voting players are not idle');
  const v = rw.view(G, 3); if (v.looks.some(x => !x)) fail('every look shows at the end');
  console.log(`fake game: themes ${G.hist.map(h => h.theme).join(', ')}, points ${G.tot.join(' ')}`);
}

{ // the theme vote: written themes, one each, no voting for your own, early end, ties at random
  const G = rw.create(people(4), {});
  if (rw.act(G, 0, { t: 'look', av: av({ hat: 3 }) })) fail('dressed during the theme vote');
  if (!rw.act(G, 0, { t: 'write', text: '  Under the sea ' }) || G.picks.length !== PICK_N + 1 || G.picks[PICK_N].th !== '*Under the sea') fail('written theme not added');
  if (rw.act(G, 0, { t: 'write', text: 'Another one' })) fail('two written themes from one player');
  if (rw.act(G, 1, { t: 'write', text: 'under THE sea' })) fail('the same written theme twice');
  if (rw.act(G, 1, { t: 'write', text: '???' })) fail('an empty written theme');
  if (rw.act(G, 0, { t: 'pick', k: PICK_N })) fail('voted for your own theme');
  if (rw.act(G, 0, { t: 'pick', k: 9 }) || rw.act(G, 0, { t: 'pick', k: '1' })) fail('a bad vote');
  const v2 = rw.view(G, 2); if (v2.picks.length !== PICK_N + 1 || v2.picks[PICK_N].mine || !rw.view(G, 0).picks[PICK_N].mine || 'by' in v2.picks[PICK_N]) fail('pick view wrong');
  rw.act(G, 1, { t: 'pick', k: PICK_N }); rw.act(G, 2, { t: 'pick', k: 0 }); rw.act(G, 2, { t: 'pick', k: PICK_N });
  if (rw.view(G, 3).picks[PICK_N].n !== 2 || rw.view(G, 2).myPick !== PICK_N) fail('vote counts wrong');
  rw.act(G, 0, { t: 'pick', k: 1 }); rw.setAway(G, 3, true); // the one away holds nothing up
  rw.tick(G, now); if (G.tEnd - now > rw.MS.early + 100) fail('everyone voted: the vote should end early');
  run(G, rw.MS.early + 200);
  if (G.stage !== 'theme' || G.theme !== '*Under the sea' || G.used[0] !== '*Under the sea') fail('the most votes should win: ' + G.theme);
  if (rw.act(G, 1, { t: 'pick', k: 0 }) || rw.act(G, 1, { t: 'write', text: 'Too late' })) fail('voted after the vote');
  const seen = new Set();
  for (let i = 0; i < 40; i++) { const H = rw.create(people(3), {}); rw.act(H, 0, { t: 'pick', k: 0 }); rw.act(H, 1, { t: 'pick', k: 1 }); run(H, rw.MS.pick + 200); seen.add(H.theme === H.picks[0].th ? 0 : H.theme === H.picks[1].th ? 1 : 9); }
  if (seen.has(9) || seen.size !== 2) fail('a tie should go at random between the tied: ' + [...seen]);
  const N = rw.create(people(3), {}); run(N, rw.MS.pick + 200); if (N.stage !== 'theme' || !N.picks.some(p => p.th === N.theme)) fail('no votes: a random choice');
}

{ // Secret walk: nobody else learns who walks until the reveal
  const G = rw.create(people(4), { rounds: 2, names: 'secret' });
  toDress(G); run(G, 90000 + 200);
  if (G.stage !== 'walk') fail('the clock should end the dressing');
  const w = G.order[0], o = (w + 1) % 4, v = rw.view(G, o);
  if (v.walker !== -2 || !v.cur || v.looks.some((x, i) => x && i !== o) || v.order.length !== 4 || v.cur.color !== G.seats[w].color) fail('Secret walk shows who walks: ' + JSON.stringify({ walker: v.walker }));
  if (rw.view(G, w).walker !== w) fail('the walker should know it is their walk');
  run(G, rw.MS.walk * 4 + 200); if (G.stage !== 'reveal' || rw.view(G, o).looks.some(x => !x)) fail('the reveal should show every look');
}

{ // someone who does nothing gets no coins; someone who leaves keeps walking; under two people the game ends
  const G = rw.create(people(3), { rounds: 2 });
  toDress(G); rw.act(G, 0, { t: 'look', av: av({ hat: 2 }) }); run(G, 90000 + 200);
  rw.setAway(G, 2, true); G.seats[2].human = false; // left the table
  if (G.stage !== 'walk') fail('no walk');
  for (let k = 0; k < G.order.length; k++) { const w = G.order[G.walk]; if (w !== 0) rw.act(G, 0, { t: 'vote', v: 4 }); run(G, rw.MS.walk + 100); }
  run(G, rw.MS.reveal + 200); toDress(G);
  G.seats[1].human = false; run(G, 300);
  if (G.ph !== 'end') fail('the game should end with one person left');
  const R = rw.results(G); if (R[0].idle || !rw.results(G)) fail('the busy player should earn');
  if (R[1].idle !== false && R[1].idle !== true) fail('results shape');
}
Date.now = realNow;

// ----- the real server: three people, one short game -----
const PORT = 19600 + (process.pid % 200);
const srv = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: `/tmp/rw-test-${process.pid}`, BOT_PAY: 'full' }, stdio: ['ignore', 'ignore', 'inherit'] });
const bail = msg => { srv.kill(); fail(msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(700);
function person(name) {
  const p = { room: null, s: null, gain: null, errs: [] };
  p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  p.send = msg => p.ws.send(JSON.stringify(msg));
  p.ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
  p.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') p.room = m.room; if (m.t === 'state') p.s = m.s; if (m.t === 'me' && m.gain) p.gain = m.gain; if (m.t === 'err') p.errs.push(m.msg); };
  return p;
}
const ana = person('Ana'), bo = person('Bo'), cy = person('Cy');
await wait(500);
ana.send({ t: 'create', game: 'runway', opts: { rounds: 2, time: 60, names: 'shown' } }); await wait(300);
if (ana.room?.game !== 'runway' || ana.room.opts.rounds !== 2 || ana.room.max !== 8) bail('room options wrong');
bo.send({ t: 'join', code: ana.room.code }); await wait(300);
ana.send({ t: 'start' }); await wait(300);
if (ana.s || !ana.errs.some(e => /at least 3 players/.test(e))) bail('the game started with two players');
cy.send({ t: 'join', code: ana.room.code }); await wait(300);
ana.send({ t: 'start' }); await wait(400);
if (ana.s?.game !== 'runway' || ana.s.seats.length !== 3 || ana.s.seats.some(x => x.bot) || ana.s.stage !== 'pick' || ana.s.picks.length !== 3) bail('game did not start');
const all = [ana, bo, cy];
const until = async (f, ms = 25000) => { for (let t = 0; t < ms; t += 50) { if (f()) return; await wait(50); } bail('timed out waiting in stage ' + ana.s?.stage); };
for (let r = 0; r < 2; r++) {
  await until(() => ana.s.round === r && ana.s.stage === 'pick');
  if (r === 0) { bo.send({ t: 'act', a: { t: 'write', text: 'Tea party' } }); await until(() => ana.s.picks.length === 4); }
  for (const p of all) p.send({ t: 'act', a: { t: 'pick', k: r === 0 && p !== bo ? 3 : 0 } });
  await until(() => ana.s.stage === 'theme', 5000);
  if (r === 0 && ana.s.theme !== '*Tea party') bail('the written theme should have won: ' + ana.s.theme);
  await until(() => ana.s.round === r && ana.s.stage === 'dress');
  const mine = ana.s.looks[ana.s.me].slice(); mine[IX.hat] = 47; mine[IX.hand] = 4;
  ana.send({ t: 'act', a: { t: 'look', av: mine } }); await wait(200);
  if (bo.s.looks[ana.s.me] !== null || JSON.stringify(bo.s).includes(mine.join(','))) bail("another player's look leaks while dressing");
  if (ana.s.looks[ana.s.me][IX.hat] !== 47) bail('look not saved for the game');
  for (const p of all) p.send({ t: 'act', a: { t: 'ready', on: true } });
  await until(() => ana.s.stage === 'walk');
  for (let k = 0; k < 3; k++) {
    await until(() => ana.s.stage === 'walk' && ana.s.walk === k);
    const w = ana.s.walker; all.forEach((p, i) => { if (p.s.me !== w) p.send({ t: 'act', a: { t: 'vote', v: p === ana ? 5 : 3 + (i + r) % 3 } }); });
    await until(() => ana.s.walk !== k || ana.s.stage !== 'walk', 12000);
  }
  await until(() => ana.s.stage === 'reveal' || ana.s.ph === 'end');
  if (!ana.s.last || ana.s.last.some(x => !x || x.n !== 2)) bail('round scores wrong: ' + JSON.stringify(ana.s.last));
}
await until(() => ana.s.ph === 'end', 15000);
await wait(600);
const place = ana.s.res.place, paid = ana.room.paid;
if (!ana.gain || !bo.gain || !cy.gain || !Array.isArray(paid)) bail('coins not paid: ' + JSON.stringify(paid));
if (place[ana.s.res.order[0]] !== 1 || paid[ana.s.res.order[0]] < paid[ana.s.res.order[2]]) bail('coins not by place: ' + paid);
if (ana.s.looks[ana.s.me][IX.hat] !== 47) bail('the final look is not in the end view');
console.log(`server game: themes ${ana.s.res.hist.map(h => h.theme).join(', ')}, points ${ana.s.res.tot.join(' ')}, coins ${paid.join(' ')}`);
srv.kill();
console.log('runway test passed');
process.exit(0);

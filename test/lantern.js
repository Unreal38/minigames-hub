// Lantern Night test: plays the rules on a fake clock: roles and pets dealt, walking checks, chores and the bar, lulls,
// meetings with votes and the ferry, pranks, every way to win, what each player's stream may show (no peeking), the
// chat hooks and the coins order.
import * as ln from '../server/games/lantern.js';
import { STATIONS, spotOf, LOGS, ROPES, BELL, MISCHIEF_FIRST, ROPE_MS, CHORE_MS, taskOf, sneaksFor, findPath, throughWall, sees, WALLS } from '../public/games/lantern/layout.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
let now = 1_000_000; const realNow = Date.now; Date.now = () => now;
const people = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: '#ff8fab', av: [i, 0, 0, 0] }));
const run = (G, ms) => { const end = now + ms; while (now < end) { now += 50; ln.fast(G, now); } };
const walkLeg = (G, s, x, z) => { const p = G.pos[s]; let guard = 0; while (Math.hypot(p.x - x, p.z - z) > .05 && guard++ < 400) { const d = Math.hypot(x - p.x, z - p.z), k = Math.min(1, .2 / d); now += 50; ln.act(G, s, { t: 'p', x: p.x + (x - p.x) * k, z: p.z + (z - p.z) * k, r: 0, j: p.j }); ln.fast(G, now); } };
// walks the way a tap would (round the walls); a straight line when you are out (pets go through everything)
const walkTo = (G, s, x, z) => { const p = G.pos[s], way = G.out[s] ? [[x, z]] : findPath(p.x, p.z, x, z); if (!way) fail(`no way from ${p.x},${p.z} to ${x},${z}`); for (const [wx, wz] of way) walkLeg(G, s, wx, wz); if (Math.hypot(p.x - x, p.z - z) > .7) fail(`walked to ${p.x.toFixed(2)},${p.z.toFixed(2)}, not ${x},${z}`); };
const start = (n, o = {}) => { const G = ln.create(people(n), o); run(G, ln.MS.intro + 100); if (G.stage !== 'walk') fail('no walk after the intro'); return G; };

// ----- dealing -----
if ([4, 5, 6, 7, 8, 10].map(n => sneaksFor(n)).join() !== '1,1,1,2,2,2' || sneaksFor(5, 2) !== 1 || sneaksFor(7, 1) !== 1) fail('sneak counts wrong');
for (let k = 0; k < 40; k++) {
  const n = 4 + k % 7, G = ln.create(people(n), {});
  if (G.role.filter(r => r === 'sneak').length !== sneaksFor(n)) fail('wrong number of Sneaks');
  const els = {}; for (const p of G.pet) els[p.el] = (els[p.el] || 0) + 1;
  if (Object.values(els).some(c => c < 2)) fail(`a pet element only one player has (${n} players): ` + JSON.stringify(els));
  if (new Set(G.pet.map(p => p.sp)).size < n - 1) fail('the same pet twice');
  if (G.jobs.some(l => l.length !== 5 || new Set(l.map(j => j.st)).size !== 5 || l.some(j => !taskOf(j.st, j.v)))) fail('chore lists wrong');
}

{ // both chores of every place get dealt, and every chore has its words and a known kind
  const seen = new Set(); for (let k = 0; k < 60; k++) for (const l of ln.create(people(6), {}).jobs) for (const j of l) seen.add(j.st + ':' + j.v);
  if (seen.size !== STATIONS.length * 2) fail('not every chore gets dealt: ' + seen.size);
  for (const st of STATIONS) { if (st.tasks.length !== 2) fail(st.id + ' should have two chores'); for (const t of st.tasks) if (!CHORE_MS[t.kind] || !t.job() || !t.how()) fail(st.id + ' has a broken chore'); }
}

// ----- walking -----
{
  const G = start(5), p = G.pos[0], x0 = p.x;
  ln.act(G, 0, { t: 'p', x: p.x + 30, z: p.z, r: 0, j: p.j }); if (p.x !== x0) fail('a jump across the island was taken');
  ln.act(G, 0, { t: 'p', x: p.x + .1, z: p.z, r: 0, j: p.j + 5 }); if (p.x !== x0) fail('a step from before a teleport was taken');
  now += 100; ln.act(G, 0, { t: 'p', x: 80, z: 0, r: 0, j: p.j }); // far: refused (and after 8 refusals let through but kept on the island)
  for (let i = 0; i < 10; i++) { now += 100; ln.act(G, 0, { t: 'p', x: 80, z: 0, r: 0, j: p.j }); }
  if (Math.hypot(p.x, p.z) > 22.6) fail('walked off the island');
}

// ----- chores and the bar -----
{
  const G = start(5), isle = G.role.indexOf('isle'), sn = G.role.indexOf('sneak');
  const job = G.jobs[isle][0], [x, z] = spotOf(STATIONS[job.st]);
  ln.act(G, isle, { t: 'cs', i: 0 }); if (G.doing[isle]) fail('a chore started from far away');
  walkTo(G, isle, x, z);
  ln.act(G, isle, { t: 'cs', i: 0 }); if (!G.doing[isle]) fail('chore did not start');
  now += 500; if (ln.act(G, isle, { t: 'cd', i: 0 })) fail('a chore was done too fast');
  now += CHORE_MS[taskOf(job.st, job.v).kind]; if (!ln.act(G, isle, { t: 'cd', i: 0 }) || !job.done || ln.bar(G)[0] !== 1) fail('chore not counted');
  const sj = G.jobs[sn][0], [sx, sz] = spotOf(STATIONS[sj.st]); walkTo(G, sn, sx, sz);
  ln.act(G, sn, { t: 'cs', i: 0 }); now += 3000; ln.act(G, sn, { t: 'cd', i: 0 });
  if (ln.bar(G)[0] !== 1 || ln.bar(G)[1] !== 20) fail('a Sneak\'s pretend chore filled the bar: ' + ln.bar(G));
  // every islander chore done: islanders win
  G.jobs.forEach((l, s) => { if (G.role[s] === 'isle') l.forEach(j => { j.done = true; }); }); G.jobs[isle][4].done = false;
  const last = G.jobs[isle][4], [lx, lz] = spotOf(STATIONS[last.st]); walkTo(G, isle, lx, lz); ln.act(G, isle, { t: 'cs', i: 4 }); now += 3000; ln.act(G, isle, { t: 'cd', i: 4 });
  if (G.ph !== 'end' || G.win !== 'isle' || G.res.why !== 'chores') fail('a full bar did not win');
  const res = ln.results(G); if (!res[isle].win || res[sn].win || res[isle].place !== 1 || res[sn].place !== 5) fail('results order wrong: ' + JSON.stringify(res));
}

// ----- lull, what others see, a meeting, the ferry -----
{
  const G = start(5, { lull: 20 }), sn = G.role.indexOf('sneak'), [a, b, c] = G.role.map((r, i) => r === 'isle' ? i : -1).filter(i => i >= 0);
  walkTo(G, a, 0, 15); walkTo(G, b, 0, -15); walkTo(G, c, 15, 0); walkTo(G, sn, 0, 13.6);
  G.lullAt[sn] = now + 1000; // (walking round the walls took longer than the first wait)
  if (ln.act(G, sn, { t: 'lull', s: a })) fail('lulled before the wait was over');
  run(G, 21_000);
  if (ln.act(G, a, { t: 'lull', s: sn })) fail('an islander lulled someone');
  if (!ln.act(G, sn, { t: 'lull', s: a }) || G.out[a] !== 1 || !G.beds.length) fail('the lull did not work');
  if (ln.act(G, sn, { t: 'lull', s: b })) fail('lulled again at once');
  let vb = ln.view(G, b);
  if (vb.out[a] !== 0 || vb.beds.length || vb.at[a] !== null) fail('a far islander learned about the sleeper');
  if (vb.role || vb.you.team || JSON.stringify(vb.ev).includes('"lull"')) fail('the stream leaked roles or the lull');
  if (vb.at[sn] !== null) fail('a far Sneak was in the stream');
  const vs = ln.view(G, sn); if (!vs.you.team.includes(sn) || !vs.beds.length) fail('the Sneak should see the sleeper and the team');
  const va = ln.view(G, a); if (!va.at.every(x => x)) fail('a player who is out should see everyone');
  if (!ln.chatOk(G, a) || ln.chatOk(G, b) || ln.chatSee(G, a, b) || !ln.chatSee(G, a, -1) || !ln.chatSee(G, b, a)) fail('chat hooks wrong while walking');
  walkTo(G, c, 0, 12);
  if (!ln.act(G, c, { t: 'ring' }) || G.stage !== 'meet') fail('ringing for a sleeper did not call a meeting');
  vb = ln.view(G, b); if (vb.out[a] !== 1 || !vb.meet.bed || !['el', 'size'].includes(vb.meet.bed.clue)) fail('the meeting did not show the sleeper and the clue');
  if (vb.meet.bed.clue === 'el' ? vb.meet.bed.el !== G.pet[sn].el : vb.meet.bed.f !== G.pet[sn].f) fail('the clue does not match the Sneak\'s pet');
  if (ln.act(G, b, { t: 'vote', s: sn })) fail('voted during the news');
  if (ln.chatOk(G, b)) fail('chat open during the news');
  run(G, ln.MS.news + 100);
  if (!ln.chatOk(G, b) || !ln.chatSee(G, b, c)) fail('chat closed during the talk');
  if (ln.act(G, a, { t: 'vote', s: sn })) fail('a sleeper voted');
  for (const s of [b, c]) if (!ln.act(G, s, { t: 'vote', s: sn })) fail('vote refused');
  if (ln.act(G, b, { t: 'vote', s: c })) fail('a vote was changed');
  ln.act(G, sn, { t: 'vote', s: b }); run(G, 100);
  if (G.stage !== 'meet') fail('the vote closed before everyone voted');
  for (const s of G.role.map((r, i) => i).filter(i => ![a, b, c, sn].includes(i))) ln.act(G, s, { t: 'vote', s: sn });
  run(G, 100);
  if (G.stage !== 'ferry' && G.ph !== 'end') fail('the vote did not close when everyone voted');
  run(G, ln.MS.ferry + 100);
  if (G.out[sn] !== 2 || G.ph !== 'end' || G.win !== 'isle' || G.res.why !== 'ferry') fail('ferrying the only Sneak did not win');
}

// ----- ties, skips, the bell, Sneaks win by numbers -----
{
  const G = start(4), sn = G.role.indexOf('sneak'), isl = G.role.map((r, i) => r === 'isle' ? i : -1).filter(i => i >= 0);
  if (ln.act(G, isl[0], { t: 'bell' })) fail('rang the bell from far away');
  walkTo(G, isl[0], BELL[0] + 1.2, BELL[1] - .6);
  run(G, 16_000);
  if (!ln.act(G, isl[0], { t: 'bell' }) || G.stage !== 'meet' || G.bells[isl[0]] !== 0) fail('the bell did not call a meeting');
  run(G, ln.MS.news + 100);
  ln.act(G, isl[0], { t: 'vote', s: isl[1] }); ln.act(G, isl[1], { t: 'vote', s: isl[0] }); ln.act(G, isl[2], { t: 'vote', s: -1 }); ln.act(G, sn, { t: 'vote', s: -1 });
  run(G, 100);
  if (G.stage !== 'ferry' || G.last.gone !== -1) fail('a tie sent someone away');
  run(G, ln.MS.ferry + 100);
  if (G.stage !== 'walk' || G.pos.some(p => Math.hypot(p.x, p.z) > 6)) fail('everyone should be back by the fire');
  // lull two of three islanders: 1 Sneak against 1 islander awake = Sneaks win
  run(G, 31_000);
  walkTo(G, sn, G.pos[isl[0]].x + .8, G.pos[isl[0]].z); ln.act(G, sn, { t: 'lull', s: isl[0] });
  run(G, 31_000);
  walkTo(G, sn, G.pos[isl[1]].x + .8, G.pos[isl[1]].z); ln.act(G, sn, { t: 'lull', s: isl[1] });
  if (G.ph !== 'end' || G.win !== 'sneak' || G.res.why !== 'many') fail('Sneaks should win by numbers: ' + G.win + ' ' + G.res?.why);
  const res = ln.results(G); if (res[sn].place !== 1 || res[isl[2]].place !== 2 || res[isl[0]].place !== 4) fail('places after a Sneak win: ' + JSON.stringify(res));
}

// ----- pranks: lights out, the ferry ropes, hollow logs -----
{
  const G = start(6), sn = G.role.indexOf('sneak'), isl = G.role.map((r, i) => r === 'isle' ? i : -1).filter(i => i >= 0);
  if (ln.act(G, sn, { t: 'prank', k: 'dark' })) fail('a prank right at the start');
  run(G, MISCHIEF_FIRST);
  if (ln.act(G, isl[0], { t: 'prank', k: 'dark' })) fail('an islander pranked');
  if (!ln.act(G, sn, { t: 'prank', k: 'dark' }) || ln.view(G, isl[0]).you.glow >= 7.5 || ln.view(G, sn).you.glow < 9) fail('lights out did not dim the islanders');
  const [lx, lz] = spotOf(STATIONS[0]); walkTo(G, isl[0], lx, lz);
  if (!ln.act(G, isl[0], { t: 'relight' }) || G.mis) fail('relighting failed');
  if (ln.act(G, sn, { t: 'prank', k: 'ropes' })) fail('pranked again at once');
  run(G, 31_000);
  if (!ln.act(G, sn, { t: 'prank', k: 'ropes' })) fail('ropes prank refused');
  walkTo(G, isl[0], ...ROPES[0]); walkTo(G, isl[1], ...ROPES[1]);
  ln.act(G, isl[0], { t: 'rope', i: 0, on: true });
  if (ln.act(G, isl[0], { t: 'rope', i: 1, on: true })) fail('one player held both ropes');
  ln.act(G, isl[1], { t: 'rope', i: 1, on: true }); run(G, 100);
  if (G.mis) fail('holding both ropes did not tie the ferry');
  run(G, 31_000); ln.act(G, sn, { t: 'prank', k: 'ropes' }); run(G, ROPE_MS + 200);
  if (G.ph !== 'end' || G.win !== 'sneak' || G.res.why !== 'ferry-gone') fail('the ferry drifting off did not win for the Sneaks');
  // hollow logs
  const H = start(5), s2 = H.role.indexOf('sneak'), i2 = H.role.indexOf('isle');
  walkTo(H, s2, LOGS[0][0] + 1.2, LOGS[0][1]); walkTo(H, i2, LOGS[0][0] + 1.2, LOGS[0][1] + .4);
  if (ln.act(H, i2, { t: 'hop' })) fail('an islander used a log');
  const j = H.pos[s2].j; if (!ln.act(H, s2, { t: 'hop' }) || H.pos[s2].j !== j + 1 || Math.hypot(H.pos[s2].x - LOGS[1][0], H.pos[s2].z - LOGS[1][1]) > 2) fail('the log did not take the Sneak to the next one');
}

// ----- people leaving -----
{
  const G = start(4), s = G.role.indexOf('isle');
  G.seats[s].human = false; G.seats[s].bot = true; run(G, 100);
  if (G.out[s] !== 3) fail('a player who left should be out');
  G.seats.forEach((x, i) => { if (i !== s && G.seats.filter(y => y.human).length > 2) { x.human = false; } }); run(G, 100);
  if (G.ph !== 'end' || G.res.why !== 'empty') fail('a near empty table should end');
}

// ----- the walls: every place can be reached, nothing stands in a wall, walls stop steps and sight -----
{
  const L = await import('../public/games/lantern/layout.js');
  const segD = (x, z, w) => { const [ax, az] = w.a, dx = w.b[0] - ax, dz = w.b[1] - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  const things = [...L.STATIONS.map(s => [s.id, s.x, s.z, s.r]), ...L.DECOR.map(d => [d[0], d[1], d[2], d[5]]), ...L.LOGS.map(l => ['log', l[0], l[1], .7])];
  for (const [n, x, z, r] of things) for (const w of WALLS) if (segD(x, z, w) < L.WALL_KIND[w.k].t / 2 + r + .1) fail(`${n} at ${x},${z} stands in a wall`);
  const goals = [...STATIONS.map(st => spotOf(st)), ...LOGS.map(([x, z]) => [x + 1, z]), ...ROPES.map(([x, z]) => [x, z - .9]), [BELL[0] + 1, BELL[1]]];
  for (const [x, z] of goals) if (!findPath(0, 6, x, z)) fail(`no way from the fire to ${x},${z}`);
  if (WALLS.length < 30) fail('the island lost its walls');
  // a step through a wall is refused; a page that keeps trying is put back where it stands
  const G = start(5), w = WALLS.find(w => w.k === 'plank'), [mx, mz] = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2], dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
  const p = G.pos[0]; walkTo(G, 0, mx + nx * .7, mz + nz * .7); const j = p.j;
  now += 300; ln.act(G, 0, { t: 'p', x: mx - nx * .7, z: mz - nz * .7, r: 0, j: p.j }); if (Math.hypot(p.x - mx, p.z - mz) > 1) fail('walked through a wall');
  for (let k = 0; k < 9; k++) { now += 300; ln.act(G, 0, { t: 'p', x: mx - nx * .7, z: mz - nz * .7, r: 0, j }); }
  if (p.j === j || !throughWall(mx + nx * .7, mz + nz * .7, mx - nx * .7, mz - nz * .7)) fail('a page pushing into a wall was not put back');
  // someone right behind the wall is not in the stream, though well inside your glow
  walkTo(G, 1, mx - nx * 1.2, mz - nz * 1.2);
  if (sees(p.x, p.z, G.pos[1].x, G.pos[1].z) || ln.view(G, 0).at[1] !== null) fail('saw someone through a wall');
}

Date.now = realNow;
console.log('lantern ok');

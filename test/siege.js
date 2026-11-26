// Sugar Siege test: options, teams from isle pets and starters, the island ops replaying the same on every
// screen, a human turn (walk, aim, throw, retreat), the turn timer, whole bot matches on a fake clock with 2-4
// teams, standings and coins, and what the view sends.
import * as sg from '../server/games/siege.js';
import * as R from '../public/games/siege/rules.js';
import { SPECIES } from '../public/games/farm/data.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const realNow = Date.now; let now = realNow(); Date.now = () => now;
const ppl = n => Array.from({ length: n }, (_, k) => ({ id: 'p' + k, name: 'P' + k, color: ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffb547'][k], av: [k] }));
const run = (G, ms, step = 50) => { let sends = 0; for (let t = 0; t < ms && G.ph === 'play'; t += step) { now += step; if (sg.fast(G, now)) sends++; } return sends; };
const until = (G, f, ms = 60000) => { for (let t = 0; t < ms; t += 50) { if (f()) return true; now += 50; sg.fast(G, now); } return f(); };

// ----- options -----
{
  const o = sg.cleanOpts({ seats: 9, pets: 7, timer: 25, arc: 'huge', bots: 'mean' });
  if (o.seats !== 2 || o.pets !== 3 || o.timer !== 30 || o.arc !== 'short' || o.bots !== 'chill') fail('bad options not cleaned: ' + JSON.stringify(o));
  const g = sg.cleanOpts({ seats: 3, pets: 4, timer: 45, arc: 'off', bots: 'sharp' });
  if (g.seats !== 3 || g.pets !== 4 || g.timer !== 45 || g.arc !== 'off' || g.bots !== 'sharp') fail('good options lost');
  for (const sp of sg.STARTERS) if (!SPECIES[sp]) fail('no such starter pet ' + sp);
  for (const k of R.SNACK_KEYS) if (!R.snackName(k) || !R.snackHelp(k)) fail('snack without words ' + k);
}

// ----- teams: own isle pets first, then starters; bots get random real pets -----
{
  const p = ppl(2); p[0].pets = [{ sp: 'mossbun', lv: 30, name: 'Fluff', look: {} }, { sp: 'nope', lv: 1, name: 'X' }];
  const G = sg.create(p, { seats: 3, pets: 3 });
  if (G.seats.length !== 3 || !G.seats[2].bot) fail('empty seat should be a bot team');
  if (G.pets.length !== 9) fail('3 teams of 3 pets');
  const t0 = G.pets.filter(x => x.team === 0);
  if (!t0.some(x => x.name === 'Fluff' && x.sp === 'mossbun')) fail('own isle pet missing');
  if (t0.some(x => x.sp === 'nope')) fail('unknown species kept');
  const t1 = G.pets.filter(x => x.team === 1);
  if (t1.filter(x => sg.STARTERS.includes(x.sp)).length < 2) fail('a guest should get the starter pets left');
  if (new Set(G.pets.map(x => x.sp)).size !== G.pets.length) fail('two teams share a species');
  for (const x of G.pets) if (!SPECIES[x.sp]) fail('no such pet ' + x.sp);
  // an element snack per element the team brings
  const am = G.teams[0].ammo; if (!(am.seed > 0)) fail('a Leaf pet should bring seeds');
  if (!(am.pie === Infinity && am.cake === 1 && am.berry === 2)) fail('basic ammo wrong ' + JSON.stringify(am));
}

// ----- the island: ops replay the same grid anywhere -----
{
  const G = sg.create(ppl(2), { seats: 2 });
  const g = R.gridOf(G.hs); for (const op of G.ops) R.applyOp(g, op);
  if (g.join() !== G.grid.join()) fail('island ops do not replay to the server grid');
  for (const x of G.pets) if (!R.bodyFree(G.grid, x.x, x.y + .05)) fail('a pet starts inside the island');
}

// ----- a human turn: only the turn's seat acts, aim is shown, throw, retreat, next turn -----
{
  const G = sg.create(ppl(2), { seats: 2, timer: 20 });
  run(G, sg.MS.intro + 100);
  if (G.stage !== 'aim') fail('intro should end in aim, got ' + G.stage);
  const s = G.turn, o = 1 - s, p = G.pets[G.ap];
  if (p.team !== s || p.sleep) fail('the active pet should be an awake pet of the turn team');
  if (sg.act(G, o, { t: 'throw', k: 'pie', a: .8, p: .6 })) fail('threw out of turn');
  sg.act(G, s, { t: 'aim', a: .8, p: .5, k: 'pie' });
  if (!G.aim || sg.view(G, o).aim?.pw !== .5) fail('aim should be shown to everyone');
  const x0 = p.x; sg.act(G, s, { t: 'in', d: p.face }); run(G, 600);
  if (Math.abs(p.x - x0) < .2) fail('walking did not move the pet');
  sg.act(G, s, { t: 'in', d: 0 });
  if (sg.act(G, s, { t: 'throw', k: 'cake', a: 1, p: 2 }) !== true) fail('throw refused');
  if (G.teams[s].ammo.cake !== 0 || sg.act(G, s, { t: 'throw', k: 'cake', a: 1, p: .5 })) fail('cake should be used up');
  if (G.stage !== 'fly') fail('a throw should fly');
  if (!until(G, () => G.stage !== 'fly', 20000)) fail('snack never landed');
  if (G.stage === 'retreat' && !(G.tEnd - now <= R.RETREAT_MS)) fail('retreat should be 3 s');
  if (!until(G, () => G.turn !== s || G.ph !== 'play', 20000)) fail('turn never passed');
}

// ----- the turn timer passes the turn -----
{
  const G = sg.create(ppl(2), { seats: 2, timer: 20 });
  run(G, sg.MS.intro + 100); const s = G.turn, n = G.turnN;
  run(G, 20000 + 200);
  if (!G.ev.some(e => e.t === 'late' && e.s === s)) fail('no late event');
  if (!until(G, () => G.turnN > n, 10000) || G.turn === s) fail('timer should pass the turn');
}

// ----- away: a bot plays the turn -----
{
  const G = sg.create(ppl(2), { seats: 2 });
  run(G, sg.MS.intro + 100); const s = G.turn;
  sg.setAway(G, s, true);
  if (!until(G, () => G.stage !== 'aim', 8000)) fail('the bot never threw for an away player');
}

// ----- whole bot matches -----
for (const [teams, pets, bots] of [[2, 2, 'chill'], [3, 3, 'sharp'], [4, 3, 'chill'], [2, 4, 'sharp']]) {
  const G = sg.create([], { seats: teams, pets, bots });
  const t0 = now; let sends = 0, guard = 0, maxKB = 0;
  while (G.ph === 'play' && guard++ < 400000) { now += 50; if (sg.fast(G, now)) { sends++; const v = JSON.stringify(sg.view(G, 0)); maxKB = Math.max(maxKB, v.length / 1024); } }
  if (G.ph !== 'end') fail(`${teams}-team match never ended (round ${G.round})`);
  const mins = (now - t0) / 60000, res = sg.results(G);
  if (res.length !== teams || res.filter(r => r.win).length < 1) fail('results wrong ' + JSON.stringify(res));
  for (const r of res) if (r.pts !== (teams - r.place) * 10) fail('coins should go by place');
  const left = G.teams.filter(T => !T.out).length;
  if (left > 1 && G.round <= R.MAX_ROUND) fail('ended with more than one team awake');
  if (G.round > R.TIDE_ROUND + 1 && !(G.water > R.WATER0)) fail('sugar tide did not rise');
  if (maxKB > 12) fail('views too big: ' + maxKB.toFixed(1) + ' KB');
  if (sends / ((now - t0) / 1000) > 21) fail('sending more than 20 times a second');
  // every screen replays the final island from hs + ops
  const g = R.gridOf(G.hs); for (const op of G.ops) R.applyOp(g, op);
  if (g.join() !== G.grid.join()) fail('final island differs on replay');
  console.log(`  ${teams} teams x ${pets} pets (${bots}): ${G.round} rounds, ${mins.toFixed(1)} min, ${G.ops.length} ops, places ${JSON.stringify(G.res.place)}, max view ${maxKB.toFixed(1)} KB`);
}

// ----- standings: awake pets, then who fell asleep last, then fullness -----
{
  const { order, place } = R.standings([{ out: true, outAt: 5, awake: 0, full: 300 }, { out: false, outAt: 0, awake: 2, full: 40 }, { out: true, outAt: 9, awake: 0, full: 300 }]);
  if (order[0] !== 1 || order[1] !== 2 || order[2] !== 0 || place[1] !== 1 || place[0] !== 3) fail('standings wrong ' + JSON.stringify({ order, place }));
}

// ----- pets move on the island as it is drawn (Kuba: pets sank in, jumps bounced you backwards off the ground) -----
{
  const P = (x, y) => ({ x, y, vx: 0, vy: 0, face: 1, ground: false });
  const steps = (g, p, n, walk = 0) => { let back = 0; for (let i = 0; i < n; i++) { R.stepPet(g, p, R.DT, walk, 0); if (p.vx < -.01) back++; } return back; };
  // flat at 3 m, a one-block step at x 25, a three-block wall at x 35
  const g = R.gridOf(Array.from({ length: R.COLS }, (_, c) => (c < 50 ? 6 : c < 70 ? 7 : 10)));
  const p = P(20, 3.6); steps(g, p, 90);
  if (!p.ground || Math.abs(p.y - 3) > .02) fail('a pet should stand right on the flat top, got y ' + p.y);
  const y0 = p.y; steps(g, p, 60); if (p.y !== y0) fail('a standing pet should not creep');
  steps(g, p, 200, 1); if (!(p.x > 26) || Math.abs(p.y - 3.5) > .03) fail('walking should climb the one-block step, got ' + p.x + ',' + p.y);
  steps(g, p, 400, 1); if (p.x > 35) fail('walking should not climb a three-block wall');
  p.vy = R.JUMP_VY; p.vx = R.JUMP_VX; p.ground = false; p.jmp = true;
  if (steps(g, p, 150)) fail('a jump into a wall should never throw the pet backwards');
  if (!p.ground || Math.abs(p.y - 5) > .03 || p.x < 35) fail('a jump at a three-block wall should land on top, got ' + p.x + ',' + p.y);
  // jumping onto a staircase moving forward: lands on the stairs, still facing forward
  const st = R.gridOf(Array.from({ length: R.COLS }, (_, c) => Math.max(1, Math.min(20, c - 30))));
  const q = P(20, 12); q.vx = R.JUMP_VX; q.jmp = true;
  if (steps(st, q, 200)) fail('landing on a slope should never bounce the pet the other way');
  if (!q.ground || R.fieldAt(st, q.x, q.y - .03) < .5 && R.fieldAt(st, q.x - .2, q.y - .03) < .5 && R.fieldAt(st, q.x + .2, q.y - .03) < .5) fail('the pet should stand on the drawn slope');
  // steering in the air
  const a = P(20, 3); steps(g, a, 30); a.vy = R.JUMP_VY; a.vx = R.JUMP_VX; a.ground = false; a.jmp = true; steps(g, a, 40, -1);
  if (!(a.vx < 0)) fail('holding the other way in the air should turn the jump round');
  // a lone block the screen cannot draw is not a wall
  const lone = R.gridOf(Array.from({ length: R.COLS }, () => 6)); lone[40 + 8 * R.COLS] = 1;
  if (R.solidF(lone, 40 * R.BS + R.BS / 2, 8 * R.BS + R.BS / 2)) fail('a lone block is not drawn, so it should not block');
}

Date.now = realNow;
console.log('siege ok');

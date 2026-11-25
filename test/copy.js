// Copycat Isle test: the island map (nothing stuck inside walls, every area reachable), whole matches on a fake clock
// (rounds, copies, boops, sniffs, squeaks, points), and the hidden-information rule: a seeker's view never says
// which object is a person.
import * as copy from '../server/games/copy.js';
import * as LY from '../public/games/copy/layout.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const P = (id, name) => ({ id, name, color: '#ff8fab', av: [0, 0, 0, 0] });
const people = n => Array.from({ length: n }, (_, i) => P('p' + i, 'Player' + i));

// ----- the map -----
// every copyable thing stands free (not inside a wall or another thing), on the island
LY.PROPS.forEach(([k, x, z], i) => {
  if (!LY.KINDS[k]) fail(`prop ${i}: unknown kind ${k}`);
  if (Math.abs(x) > LY.EDGE || Math.abs(z) > LY.EDGE) fail(`prop ${i} (${k}) is off the island`);
  for (const w of LY.WALLS) for (const [a, b] of LY.wallRuns(w)) {
    const along = w[0] === 'x' ? x : z, across = w[0] === 'x' ? z : x;
    if (along > a - .1 && along < b + .1 && Math.abs(across - w[3]) < w[6] / 2 + LY.KINDS[k].r * .6) fail(`prop ${i} (${k}) at ${x}, ${z} stands inside a wall`);
  }
  LY.PROPS.forEach(([k2, x2, z2], j) => { if (j > i && Math.hypot(x - x2, z - z2) < (LY.KINDS[k].r + LY.KINDS[k2].r) * .7) fail(`props ${i} (${k}) and ${j} (${k2}) overlap`); });
  for (const s of LY.SCENERY) if (s[5] > 0 && Math.hypot(x - s[1], z - s[2]) < s[5] + LY.KINDS[k].r * .5) fail(`prop ${i} (${k}) stands inside ${s[0]}`);
});
// flood the walkable grid from the square: every area, the barn inside, the hill top and the maze middle are reachable
{
  const step = .5, N = Math.ceil(LY.SIZE * 2 / step), seen = new Uint8Array(N * N), idx = (x, z) => Math.round((z + LY.SIZE) / step) * N + Math.round((x + LY.SIZE) / step);
  const q = [[6.5, 6.5]]; seen[idx(6.5, 6.5)] = 1;
  while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) { const nx = x + dx, nz = z + dz; if (Math.abs(nx) > LY.EDGE || Math.abs(nz) > LY.EDGE) continue; const k = idx(nx, nz); if (seen[k] || LY.blocked(nx, nz)) continue; seen[k] = 1; q.push([nx, nz]); } }
  const reach = (x, z, what) => { let ok = false; for (let a = -1; a <= 1 && !ok; a += .5) for (let b = -1; b <= 1 && !ok; b += .5) if (seen[idx(x + a, z + b)]) ok = true; if (!ok) fail(`${what} (${x}, ${z}) can't be walked to`); };
  reach(-19, -18.5, 'inside the barn'); reach(20, -16, 'the hill top'); reach(0, 24, 'the end of the maze'); reach(-17.5, 3, 'inside the snow fort'); reach(-7, -22, 'the pumpkin patch'); reach(20, 23, 'the café');
  reach(LY.seekerSpawn(0)[0], LY.seekerSpawn(0)[1], 'the seekers\' start');
  for (let i = 0; i < 10; i++) { const [x, z] = LY.hiderSpawn(i); if (LY.blocked(x, z)) fail(`hider start ${i} is inside something`); reach(x, z, `hider start ${i}`); }
  // and you can walk up the ramp onto the hill, not jump the cliff
  if (!LY.blocked(LY.HILL.x1, -15)) fail('the hill cliff should block');
  if (LY.blocked(10.5, -19.5)) fail('the ramp should be walkable');
}
// bots can always find a hiding spot of every kind
{ let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const k of Object.keys(LY.KINDS)) for (let n = 0; n < 5; n++) { const at = LY.spotFor(k, rnd, []); if (!at) fail(`no spot to hide as ${k}`); if (LY.blocked(at[0], at[1], LY.KINDS[k].r)) fail(`a ${k} spot is inside something`); } }

// ----- seats and rounds -----
{
  const G = copy.create(people(1), { seats: 6 });
  if (G.seats.length !== 6 || G.seats.filter(s => s.bot).length !== 5) fail('one person and five bots');
  if (G.plan.length !== 1 || G.plan[0][0] !== 0) fail('one person: one round, and they seek');
  if (!G.pl.every((p, i) => i === 0 ? p.role === 'seeker' : p.role === 'hider' && p.k >= 0)) fail('bots hide (and pick their disguise) at once');
  const H = copy.create(people(4), { seats: 6 });
  if (H.plan.length !== 4 || new Set(H.plan.flat()).size !== 4) fail('four people: four rounds, everyone seeks once');
  const J = copy.create(people(9), { seats: 10 });
  if (J.plan.length !== 5 || !J.plan.every(g => g.length === 2) || new Set(J.plan.flat()).size !== 9) fail('nine people at a 10 table: two seekers a round, everyone seeks');
  if (copy.cleanOpts({ time: 999, caught: 'x' }).time !== 180 || copy.cleanOpts({ caught: 'join' }).caught !== 'join') fail('cleanOpts');
}

// ----- one whole round on a fake clock -----
{
  const G = copy.create(people(2), { seats: 5, time: 120 });
  let now = G.stageAt;
  const sk = G.plan[0][0], hd = G.plan[1][0];
  // the seeker sees nothing of the hiders while they hide
  const v0 = copy.view(G, sk);
  if (v0.o) fail('a waiting seeker must not get the objects list');
  if (v0.a.some((a, i) => a && G.pl[i].role === 'hider')) fail('a waiting seeker must not see hiders');
  // the hider walks to a prop and copies it (unlimited during hide)
  const prop = LY.PROPS.findIndex(p => p[0] === 'haybale'), [, px, pz] = LY.PROPS[prop];
  G.pl[hd].x = px + 1.4; G.pl[hd].z = pz; G.pl[hd].repAt = now;
  if (!copy.act(G, hd, { t: 'copy', i: prop })) fail('copying a nearby prop');
  if (copy.act(G, hd, { t: 'copy', i: LY.PROPS.findIndex(p => p[1] > 20 && p[2] > 20) })) fail('copying from across the island must fail');
  if (copy.act(G, sk, { t: 'p', x: 0, z: 0, h: 0 }) || G.pl[sk].x === 0) fail('a seeker can\'t move while the hiders hide');
  // seeking starts
  copy.fast(G, now += 30_001);
  if (G.stage !== 'seek') fail('seeking starts after 30 s');
  if (!G.pl.every(p => p.role !== 'hider' || p.k >= 0)) fail('every hider is something once seeking starts');
  // hidden information: the seeker's objects list has hiders and decoys under tokens, no seat numbers anywhere
  const v = copy.view(G, sk), hiders = G.pl.filter(p => p.role === 'hider');
  if (v.o.length !== G.decoys.length + hiders.length) fail('the seeker sees every disguised hider and every decoy');
  if (v.a.some((a, i) => a && G.pl[i].role === 'hider')) fail('a seeker must not see which seat is where');
  const toks = v.o.map(o => o[0]); if ([...toks].sort((a, b) => a - b).join() !== toks.join()) fail('objects are sorted by token, not by who they are');
  for (const o of v.o) if (o.length !== 5) fail('object entries are token, x, z, turn, kind only');
  const hv = copy.view(G, hd);
  if (hv.o.length !== G.decoys.length) fail('hiders get the decoys in the list (and see their team as people)');
  // copies are limited now
  G.pl[hd].copies = 1;
  const other = LY.PROPS.findIndex((p, i) => p[0] !== 'haybale' && Math.hypot(p[1] - G.pl[hd].x, p[2] - G.pl[hd].z) < 5);
  if (other >= 0) { if (!copy.act(G, hd, { t: 'copy', i: other }) || G.pl[hd].copies !== 0) fail('a copy while seeking uses one up'); if (copy.act(G, hd, { t: 'copy', i: prop })) fail('no copies left'); }
  // a wrong boop makes you dizzy
  const decoy = G.decoys[0];
  G.pl[sk].x = decoy.x + 1; G.pl[sk].z = decoy.z;
  if (!copy.act(G, sk, { t: 'boop', d: decoy.tok }) || G.pl[sk].dizzy <= Date.now()) fail('booping a decoy makes you dizzy');
  if (copy.act(G, sk, { t: 'boop', d: decoy.tok })) fail('no booping while dizzy');
  G.pl[sk].dizzy = 0;
  // a boop from too far does nothing
  const tgt = G.pl[hd];
  G.pl[sk].x = tgt.x + 12; G.pl[sk].z = tgt.z;
  if (copy.act(G, sk, { t: 'boop', d: tgt.tok })) fail('a boop from 12 m away');
  // sniffing: hot right next to them
  G.pl[sk].x = tgt.x + 1.5; G.pl[sk].z = tgt.z; G.pl[sk].sniffAt = 0;
  copy.act(G, sk, { t: 'sniff' });
  if (G.pl[sk].sniff?.lv !== 3) fail('sniffing next to a hider is hot');
  if (copy.act(G, sk, { t: 'sniff' })) fail('sniffing has a wait');
  // a squeak on purpose scores, then waits
  const before = G.pts[hd];
  if (!copy.act(G, hd, { t: 'sq' }) || G.pts[hd] !== before + 1) fail('a squeak on purpose is +1');
  if (copy.act(G, hd, { t: 'sq' })) fail('squeaks have a wait');
  const sq = copy.view(G, sk).ev.find(e => e.t === 'sq');
  if (!sq || sq.s !== undefined || sq.own !== undefined) fail('a seeker hears a squeak without who or why');
  // the real boop finds them (fast: within the first minute)
  const p0 = G.pts[sk];
  if (!copy.act(G, sk, { t: 'boop', d: tgt.tok }) || G.pl[hd].role !== 'ghost') fail('booping a hider finds them');
  if (G.pts[sk] !== p0 + copy.PTS.catch + copy.PTS.fast) fail('a fast find is worth 8');
  // a ghost is invisible to the seeker
  if (copy.view(G, sk).a[hd]) fail('ghosts are hidden from seekers');
  // the bots squeak by themselves
  copy.fast(G, now += 41_000);
  if (!copy.view(G, sk).ev.some(e => e.t === 'sq')) fail('forced squeaks');
  // time runs out: the bots that lasted score the round
  copy.fast(G, now += 120_000);
  if (G.stage !== 'break') fail('the round ends when the time runs out');
  const bot = G.seats.findIndex(s => s.bot);
  if (G.pts[bot] < copy.PTS.last + 10) fail(`a bot that lasted 2 min should have 5 + 12 points, has ${G.pts[bot]}`);
  // next round: the other person seeks
  copy.fast(G, now += 7000);
  if (G.round !== 1 || G.pl[hd].role !== 'seeker' || G.pl[sk].role !== 'hider') fail('the next round swaps the seeker');
  copy.fast(G, now += 30_001);
  // find everyone quickly: all-found bonus, the round ends at once
  const s2 = hd;
  for (let i = 0; i < G.pl.length; i++) if (G.pl[i].role === 'hider') { G.pl[s2].x = G.pl[i].x + 1; G.pl[s2].z = G.pl[i].z; G.pl[s2].dizzy = 0; copy.act(G, s2, { t: 'boop', d: G.pl[i].tok }); }
  if (G.stage !== 'break' || !G.sums.at(-1).all) fail('finding everyone ends the round');
  copy.fast(G, now += 7000);
  if (G.ph !== 'end') fail('the match ends after every person sought');
  const R = copy.results(G);
  if (R.length !== 5 || R.filter(r => r.win).length !== 1 || new Set(R.map(r => r.place)).size !== 5) fail('results: one winner, everyone placed');
  const best = R.findIndex(r => r.place === 1); if (G.pts.some(p => p > G.pts[best])) fail('first place has the most points');
}

// ----- join mode: the found hider becomes a seeker -----
{
  const G = copy.create(people(1), { seats: 4, caught: 'join' });
  copy.fast(G, G.stageAt + 30_001);
  const h = G.pl.findIndex(p => p.role === 'hider'), s = 0;
  G.pl[s].x = G.pl[h].x + 1; G.pl[s].z = G.pl[h].z;
  copy.act(G, s, { t: 'boop', d: G.pl[h].tok });
  if (G.pl[h].role !== 'seeker') fail('join mode: found hiders seek');
}

// ----- cheating: teleporting is refused, a far jump is let through only after a run of refusals -----
{
  const G = copy.create(people(2), { seats: 4 });
  const h = G.plan[1][0], p = G.pl[h], x0 = p.x;
  p.repAt = Date.now() - 100;
  copy.act(G, h, { t: 'p', x: Math.round((x0 + 20) * LY.Q), z: Math.round(p.z * LY.Q), h: 0 });
  if (p.x !== x0) fail('a 20 m jump in 0.1 s is refused');
  copy.act(G, h, { t: 'p', x: Math.round((x0 + .3) * LY.Q), z: Math.round(p.z * LY.Q), h: 0 });
  if (Math.abs(p.x - (x0 + .3)) > .06) fail('a normal step is taken');
}
console.log('copy ok');

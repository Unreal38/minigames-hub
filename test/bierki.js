// Bierki test: the pile rests properly and stays put, the pull check (free sticks come out, buried ones do not, speed
// costs), a person's turn through act(), the Hook's one lift a turn, the clock, and whole games played by bots.
import * as bierki from '../server/games/bierki.js';
import { LEN, R, MM, FULL, SET_BONUS, makePile, setFor, totalOf, ends, segDist, startPull, advance, isClear, resettle, dropsWithout, plans } from '../public/games/bierki/rules.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const players = [{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }];
const realNow = Date.now; let clock = realNow();
const at = t => { clock = t; Date.now = () => clock; };

// ----- the set -----
if (setFor().length !== 31 || setFor(true).length !== 41 || totalOf() !== 117 || totalOf(true) !== 138) fail('31 sticks worth 117 points, 41 worth 138');

// ----- the pile -----
for (let seed = 1; seed <= 60; seed++) for (const big of [false, true]) {
  const p = makePile(seed, big);
  if (JSON.stringify(p) !== JSON.stringify(makePile(seed, big))) fail('the same seed must give the same pile');
  for (const s of p) {
    if (s.y0 < R - 1e-6 || s.y1 < R - 1e-6) fail('a stick sank into the table');
    if (Math.hypot(s.cx, s.cz) + LEN / 2 > 3.9) fail('a stick reaches past the cloth');
    if (Math.abs(s.y1 - s.y0) > 1.2) fail('a stick stands too steep');
  }
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (segDist(...ends(p[i]), ...ends(p[j])).d < 2 * R - .03) fail('two sticks lie inside each other');
  if (resettle(p, false).length) fail('a fresh pile must be at rest');
  if (!p.some(s => plans(p, s)[0].m < 60)) fail(`pile ${seed} has no stick that can be taken`);
}

// ----- the pull check -----
{
  const p = makePile(7), top = p[p.length - 1];
  // a stick alone on the cloth slides out for free, at any speed
  const lone = [{ ...p[0], g: 0 }], st = startPull(lone, lone[0]);
  if (advance(lone, st, { x: 2, y: 0, z: 0 }, 50) !== 0 || isClear(lone, st) !== true) fail('a lone stick must come away clean');
  // the last stick laid has nothing on it
  if (startPull(p, top).onTop.length) fail('nothing lies on the last stick');
  // a stick with others on it cannot be dragged far
  const buried = p.find(s => startPull(p, s).onTop.length >= 2);
  if (buried) { const b = startPull(p, buried); advance(p, b, { x: buried.dx * 3, y: 0, z: buried.dz * 3 }); if (b.meter < FULL) fail('dragging a buried stick must move the ones on it'); if (!dropsWithout(p, buried).length) fail('sticks resting on a stick drop when it is gone'); }
  // pulling fast costs more than pulling slowly, and the path is walked the same way twice
  const s = p.find(x => { const m = plans(p, x)[0].m; return m > 8 && m < 50; });
  if (s) {
    const pl = plans(p, s)[0], to = { x: pl.x * pl.dist, y: pl.y * pl.dist, z: pl.z * pl.dist };
    const slow = startPull(p, s), quick = startPull(p, s), again = startPull(p, s);
    advance(p, slow, to, 60000); advance(p, quick, to, 300); advance(p, again, to, 300);
    if (!(quick.meter > slow.meter * 2)) fail('a fast pull must fill the meter faster');
    if (quick.meter !== again.meter) fail('the same pull must give the same meter');
    if (startPull(p, s, 30).meter !== 30) fail('what a stick already rubbed carries over');
  }
}

// ----- a person's turn -----
{
  at(1e12);
  const G = bierki.create(players, { seats: 2, timer: 30 });
  if (G.pile.length !== 31 || G.seats.length !== 2 || G.seats.some(s => s.bot)) fail('create: two people, 31 sticks');
  let s = G.turn;
  if (bierki.act(G, s, { t: 'pick', id: 0 })) fail('no pulling before the pile has landed');
  at(clock + 2000);
  if (bierki.act(G, 1 - s, { t: 'pick', id: 0 })) fail('only the player whose turn it is may pull');
  // take the easiest stick, slowly
  const easy = G.pile.map(x => ({ x, p: plans(G.pile, x)[0] })).sort((a, b) => a.p.m - b.p.m)[0];
  if (!bierki.act(G, s, { t: 'pick', id: easy.x.id }) || !G.pull) fail('pick');
  if (bierki.act(G, s, { t: 'drag', p: [[0, 500, 0, 2000]] }) && G.pull.st.off.y > 0) fail('no lifting without the Hook');
  const steps = 20, path = [];
  for (let i = 1; i <= steps; i++) path.push([Math.round(easy.p.x * easy.p.dist * MM * i / steps), 0, Math.round(easy.p.z * easy.p.dist * MM * i / steps), 400]);
  bierki.act(G, s, { t: 'drag', p: path.slice(0, 10) }); // 4 seconds of pulling claimed in no time at all
  if (Math.hypot(G.pull.st.off.x, G.pull.st.off.z) > easy.p.dist / steps + .001) fail('a browser cannot claim more time than has passed');
  at(clock + 9000);
  bierki.act(G, s, { t: 'drag', p: path.slice(0, 10) }); bierki.act(G, s, { t: 'drag', p: path.slice(10) });
  if (!G.pull || !isClear(G.pile, G.pull.st)) fail(`the planned pull should free the stick (meter ${G.pull?.st.meter})`);
  const v = bierki.view(G, s);
  if (v.pile || !v.pull || v.pull.id !== easy.x.id) fail('a drag sends a short update without the pile');
  at(clock + 50);
  if (!bierki.view(G, s).pile) fail('later views carry the pile again');
  bierki.act(G, s, { t: 'drop' });
  if (G.pull || G.st[s].pts !== easy.x.pts || G.pile[easy.x.id].g !== 1 || G.turn !== s) fail('a clean stick scores and the same player goes again');
  // letting go inside the pile puts the stick back, and its rub stays on the meter
  at(clock + 1000);
  const next = G.pile.find(x => !x.g && startPull(G.pile, x).touch.length);
  bierki.act(G, s, { t: 'pick', id: next.id }); at(clock + 1000);
  bierki.act(G, s, { t: 'drag', p: [[Math.round(next.dx * 60), 0, Math.round(next.dz * 60), 900]] });
  const rubbed = G.pull ? G.pull.st.meter : -1;
  if (rubbed >= 0) { bierki.act(G, s, { t: 'drop' }); if (G.pull || G.pile[next.id].g || G.turn !== s) fail('a stick let go inside the pile goes back'); bierki.act(G, s, { t: 'pick', id: next.id }); if (Math.abs(G.pull.st.meter - rubbed) > 1e-9) fail('the rub is remembered for the turn'); }
  // a rough pull ends the turn and the stick is out of play
  const bad = G.pile.find(x => !x.g && startPull(G.pile, x).onTop.length);
  if (bad) {
    if (G.turn === s) { bierki.act(G, s, { t: 'pick', id: bad.id }); at(clock + 500); bierki.act(G, s, { t: 'drag', p: [[Math.round(bad.dx * 3000), 0, Math.round(bad.dz * 3000), 200]] }); }
    if (G.turn === s || G.pile[bad.id].g !== 2 || G.st[s].fails !== 1) fail('moving another stick ends the turn and loses the stick');
    if (!G.ev.some(e => e.t === 'fail')) fail('a fail is announced');
    if (resettle(G.pile, false).length) fail('after a fail the pile is at rest again');
  }
  // the clock passes the turn
  s = G.turn; at(clock + 3000); bierki.tick(G, clock); at(clock + 31000);
  if (!bierki.tick(G, clock) || G.turn === s || !G.slow[s]) fail('running out of time passes the turn');
}

// ----- the Hook: one lift a turn -----
{
  at(2e12);
  const G = bierki.create(players, { seats: 2, timer: 0 }); at(clock + 2000);
  const s = G.turn; G.st[s].hook = true;
  const free = G.pile.filter(x => !startPull(G.pile, x).onTop.length && !dropsWithout(G.pile, x).length).slice(-2);
  if (free.length < 2) fail('expected two sticks with nothing on them');
  bierki.act(G, s, { t: 'pick', id: free[1].id }); at(clock + 3000);
  bierki.act(G, s, { t: 'drag', p: [[0, 400, 0, 1000], [0, 900, 0, 1000]] });
  if (!G.pull || G.pull.st.off.y !== .9 || G.pull.st.meter > 1) fail('lifting a stick with nothing on it is free');
  if (!bierki.view(G, s).lift) fail('the lift belongs to this pull');
  bierki.act(G, s, { t: 'drop' });
  if (G.pile[free[1].id].g !== 1) fail('a lifted stick is taken');
  at(clock + 1000); bierki.act(G, s, { t: 'pick', id: free[0].id }); at(clock + 3000);
  bierki.act(G, s, { t: 'drag', p: [[0, 400, 0, 1000]] });
  if (G.pull.st.off.y !== 0 || bierki.view(G, s).lift) fail('only one lift a turn');
}

// ----- whole games by bots, on a fake clock -----
for (const [seats, piles, bots] of [[2, 1, 'chill'], [4, 1, 'sharp'], [6, 1, 'chill'], [3, 3, 'chill']]) {
  at(3e12);
  const G = bierki.create(players.slice(0, 1), { seats, piles, bots, timer: 20 });
  bierki.setAway(G, 0, true);
  let n = 0, lite = 0;
  while (G.ph === 'play' && n++ < 400000) { at(clock + 50); bierki.tick(G, clock); if (bierki.fast(G, clock) && !bierki.view(G, 0).pile) lite++; }
  if (G.ph !== 'end') fail(`a ${seats}-seat bot game did not finish`);
  if (G.pileN !== piles || G.pile.some(s => !s.g)) fail('the game ends when the last pile is empty');
  if (!lite) fail('bot pulls stream short updates');
  const taken = G.pile.filter(s => s.g === 1).reduce((a, s) => a + s.pts, 0) + G.st.reduce((a, x) => a + x.set, 0) * SET_BONUS;
  if (piles === 1 && G.st.reduce((a, x) => a + x.pts, 0) !== taken) fail('points must add up to the sticks taken');
  const res = bierki.results(G), top = Math.max(...res.map(r => r.pts));
  if (res.length !== seats || !res.some(r => r.win) || res.some(r => r.win !== (r.pts === top))) fail('results: the most points wins');
  if (JSON.stringify(bierki.view(G, 0)).length > 40000) fail('the view is too big');
}
Date.now = realNow;
console.log('bierki: all good');

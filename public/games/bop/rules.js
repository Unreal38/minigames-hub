// Burrow Bop rules, shared by the browser and the server. Everyone has their own garden with nine burrows. Pet Farm
// pets pop out of them, the same pets in the same burrows at the same moments for everybody, and you bop them with
// a pillow mallet before they duck back down. A pet that gets away costs a heart, and so does bopping a sleeping one.
// The whole list of pop-ups comes from one seed, so the browser and the server always agree on it.

export const HOLES = 9, LIVES = 3;
export const TOTAL = 180000;                   // after three minutes no more pets come: the highest score wins
export const PETS = ['dustmole', 'mossbun', 'cindercub', 'puddlepup', 'zapkit', 'pebblet', 'waddlet', 'sproutle']; // Pet Farm species, never translated
export const PET = 0, SLEEP = 1, GOLD = 2, HEART = 3; // what pops up: a pet to bop, a sleeping pet to leave alone, a golden pet (bonus), a pet with a heart (a heart back)
export const LAG = 350, EARLY = 150;            // how late a bop may reach the server after the pet ducked; how early before it shows
export const PACE = { calm: .72, normal: 1, fast: 1.4 }; // how quickly the pets speed up
const RAMP = 110000;                            // at normal pace the pets are at full speed after this long

export function rnd(seed, i) {
  let x = (seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B); x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
  return (x ^ (x >>> 16)) >>> 0;
}

// Every pop-up of the game, in order: { i, at (ms after the start), up (ms it stays out), hole 0..8, kind, pet }.
const cache = new Map();
export function schedule(seed, pace = 'normal') {
  const key = seed + pace; if (cache.has(key)) return cache.get(key);
  const k = PACE[pace] || 1, pops = [], busy = new Array(HOLES).fill(-1e9);
  let t = 900, r = 0;
  const R = () => rnd(seed, r++) / 4294967296;
  const add = at => {
    const f = Math.min(1, at * k / RAMP), free = [];
    for (let h = 0; h < HOLES; h++) if (busy[h] <= at) free.push(h);
    const a = R(), b = R(), c = R(), d = R();
    if (!free.length) return;
    const hole = free[(a * free.length) | 0];
    let kind = PET;
    if (pops.length >= 6) { if (b < .14) kind = SLEEP; else if (b < .2) kind = GOLD; else if (b < .24 && at > 25000) kind = HEART; }
    const up = Math.round((1500 - 880 * f) * (.88 + c * .24) * (kind === SLEEP ? 1.2 : kind === GOLD ? .78 : 1));
    pops.push({ i: pops.length, at: Math.round(at), up, hole, kind, pet: (d * PETS.length) | 0 });
    busy[hole] = at + up + 520;
  };
  while (t < TOTAL) {
    const f = Math.min(1, t * k / RAMP);
    add(t);
    const two = R(), off = R(), three = R(), gap = R();
    if (t > 12000 && two < .1 + .3 * f) { add(t + 40 + off * 140); if (f > .6 && three < .25) add(t + 190 + off * 60); }
    t += (1150 - 760 * f) * (.8 + gap * .4);
  }
  if (cache.size > 40) cache.clear();
  cache.set(key, pops);
  return pops;
}

export const newPlayer = () => ({ lv: LIVES, sc: 0, cb: 0, best: 0, bops: 0, n: 0 });
// One pop-up is over for a player: they bopped it (hit) or it went back down by itself. Returns what it did.
export function resolve(p, pop, hit) {
  p.n++;
  if (hit) {
    if (pop.kind === SLEEP) { p.lv--; p.cb = 0; return { pts: 0, life: -1 }; }
    p.cb++; p.bops++; if (p.cb > p.best) p.best = p.cb;
    const pts = (pop.kind === GOLD ? 50 : 10) + Math.min(p.cb - 1, 10) * 2;
    p.sc += pts;
    if (pop.kind === HEART && p.lv < LIVES) { p.lv++; return { pts, life: 1 }; }
    return { pts, life: 0 };
  }
  if (pop.kind === PET) { p.lv--; p.cb = 0; return { pts: 0, life: -1 }; }
  return { pts: 0, life: 0 };
}

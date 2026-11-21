// Tower Stack rules, shared by the server (which decides) and the client (which draws the same swing).
// The tower stands on a stone pedestal whose top is at y = 0. Every block is a box centred on (x, z).
// A block swings back and forth above the top of the tower, along x on even levels and along z on odd ones.
// When it is dropped it lands on whatever is below. The tower stays up as long as, at every joint, the
// weight of everything above sits over the part where the two blocks touch.

export const PED = { x: 0, z: 0, w: 3.4, d: 3.4 };
export const KINDS = {
  block: { w: 2.4, d: 2.4, h: .6 },
  plank: { w: 3.4, d: 1.2, h: .45 },
  cube: { w: 1.6, d: 1.6, h: .95 },
  slab: { w: 3.0, d: 3.0, h: .4 },
};
export const MIXED = ['block', 'block', 'plank', 'plank', 'cube', 'slab'];
export const AMP = 3.3;            // how far either side of the tower's top the block swings
export const PERFECT = .22;        // a drop this close to the middle snaps into place: a perfect drop
export const SWAY = .016;          // the taller it gets, the more it wobbles: each block above shrinks a joint's safe area by this much
export const MAX_LEVEL = 40;       // a tower this tall is finished and a new one starts
export const PTS = { ok: 10, perfect: 15, slip: -5, miss: -5, crash: -30, top: 20 };
export const MS = { drop: 480, settle: 420, slip: 1300, crash: 3000, top: 2600 };

// One full back-and-forth, in ms. It speeds up as the tower grows.
export const period = level => Math.max(900, 2600 - level * 60);

// Where the swinging block is (along its axis) ms after it appeared. A triangle wave, so the speed is even.
export function swingPos(sw, ms) {
  const u = ((ms / sw.P) % 1 + 1) % 1, tri = u < .5 ? -1 + 4 * u : 3 - 4 * u;
  return sw.c + sw.A * tri;
}

export const height = tower => tower.reduce((t, b) => t + b.h, 0);
export const topOf = tower => tower.length ? tower[tower.length - 1] : PED;

function overlap(a, b) {
  const x0 = Math.max(a.x - a.w / 2, b.x - b.w / 2), x1 = Math.min(a.x + a.w / 2, b.x + b.w / 2);
  const z0 = Math.max(a.z - a.d / 2, b.z - b.d / 2), z1 = Math.min(a.z + a.d / 2, b.z + b.d / 2);
  return x1 > x0 && z1 > z0 ? { x0, x1, z0, z1 } : null;
}

// Checks every joint from the bottom up. Returns the lowest joint that gives way (-1 if none: joint i is the one
// under block i), which way it tips, and how steady the tower is (1 rock solid, 0 about to go).
export function check(tower) {
  const n = tower.length;
  let fail = -1, dir = [0, 0], steady = 1;
  let mx = 0, mz = 0, m = 0;
  const com = new Array(n);
  for (let i = n - 1; i >= 0; i--) { const b = tower[i], w = b.w * b.d * b.h; mx += b.x * w; mz += b.z * w; m += w; com[i] = [mx / m, mz / m]; }
  for (let i = 0; i < n; i++) {
    const c = overlap(i ? tower[i - 1] : PED, tower[i]);
    if (!c) { fail = i; dir = [Math.sign(tower[i].x - (i ? tower[i - 1].x : 0)), Math.sign(tower[i].z - (i ? tower[i - 1].z : 0))]; break; }
    const hx = (c.x1 - c.x0) / 2, hz = (c.z1 - c.z0) / 2, cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
    const shrink = Math.min(SWAY * (n - 1 - i), .55 * Math.min(hx, hz));
    const ex = hx - shrink, ez = hz - shrink, [px, pz] = com[i];
    const ox = Math.abs(px - cx) / ex, oz = Math.abs(pz - cz) / ez;
    if (ox >= 1 || oz >= 1) { fail = i; dir = ox >= oz ? [Math.sign(px - cx), 0] : [0, Math.sign(pz - cz)]; break; }
    steady = Math.min(steady, 1 - Math.max(ox, oz));
  }
  return { fail, dir, steady: Math.max(0, steady) };
}

// The swing for the next block on this tower.
export function makeSwing(tower, kind, turn) {
  const K = KINDS[kind] || KINDS.block, t = topOf(tower), axis = tower.length % 2 ? 'z' : 'x';
  const rot = kind === 'plank' && turn % 2 === 1; // planks come lengthwise or crosswise
  return { kind, w: rot ? K.d : K.w, d: rot ? K.w : K.d, h: K.h, axis, c: axis === 'x' ? t.x : t.z, o: axis === 'x' ? t.z : t.x,
    A: AMP, P: period(tower.length) };
}

// Drops the swinging block after `ms`. Returns the block and what happened, without changing the tower:
// 'ok' / 'perfect' it stays, 'miss' it fell past, 'slip' it toppled off on its own, 'crash' it took part of the tower with it.
export function drop(tower, sw, ms) {
  const t = topOf(tower);
  let p = swingPos(sw, ms);
  const centre = sw.axis === 'x' ? t.x : t.z, perfect = Math.abs(p - centre) < PERFECT;
  if (perfect) p = centre;
  const b = { x: sw.axis === 'x' ? p : sw.o, z: sw.axis === 'x' ? sw.o : p, w: sw.w, d: sw.d, h: sw.h, y: height(tower) + sw.h / 2 };
  if (!overlap(t, b)) return { b, res: 'miss', at: tower.length, dir: [Math.sign(b.x - t.x), Math.sign(b.z - t.z)] };
  const k = check([...tower, b]);
  if (k.fail === tower.length) return { b, res: 'slip', at: k.fail, dir: k.dir };
  if (k.fail >= 0) return { b, res: 'crash', at: k.fail, dir: k.dir };
  return { b, res: perfect ? 'perfect' : 'ok', at: -1, dir: [0, 0], steady: k.steady };
}

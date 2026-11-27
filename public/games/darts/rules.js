// Sky Darts rules, shared by the server (which decides) and the client (which draws the same wobble).
// Board space: the centre of the bull is (0, 0), x to the right, y up, and 1 is the outside of the double ring.
// The rings are the real dartboard's, scaled (a real board's double ring ends 170 mm from the middle).

export const R = { bull: 6.35 / 170, outer: 15.9 / 170, tIn: 99 / 170, tOut: 107 / 170, dIn: 162 / 170, dOut: 1, frame: 1.32 };
export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]; // clockwise from the top
export const DARTS = 3;
export const ROUNDS = { 301: 15, 501: 20 }; // nobody out by then: the lowest score left takes the leg
export const MS = { fly: 340, next: 700, turn: 1500, bust: 3000, leg: 3400 };

// The hand: where the dart would go wanders round your aim. Holding still steadies it for a while, then the arm tires.
// Kuba (2026-11-27): the ring starts much wider and focuses slowly; fully steady is as tight as the old starting ring.
export const HAND = { loose: .35, steady: .15, settle: 2200, tire: 4000, tired: .48, tireMs: 2200 };
export function wobbleR(hold) {
  const H = HAND;
  if (!(hold >= 0)) return H.loose;
  if (hold < H.settle) { const u = hold / H.settle, e = 1 - (1 - u) * (1 - u); return H.loose + (H.steady - H.loose) * e; }
  if (hold < H.tire) return H.steady;
  return H.steady + (H.tired - H.steady) * Math.min(1, (hold - H.tire) / H.tireMs);
}
const ph = (seed, k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return (x - Math.floor(x)) * 6.283; };
// The wander itself: a few slow waves, different for every dart (seed). ms counts from when the dart came up.
export function wobble(seed, ms, hold) {
  const t = ms / 1000, r = wobbleR(hold);
  return [r * (Math.sin(t * 1.9 + ph(seed, 1)) * .62 + Math.sin(t * 3.7 + ph(seed, 2)) * .38),
    r * (Math.sin(t * 2.3 + ph(seed, 3)) * .62 + Math.sin(t * 4.3 + ph(seed, 4)) * .38)];
}
export const clampAim = v => Math.max(-R.frame, Math.min(R.frame, Number.isFinite(+v) ? +v : 0));
// Where a dart lands: the aim plus the wobble at the moment it was let go.
export function landing(seed, aim, ms, hold) {
  const [dx, dy] = wobble(seed, ms, hold);
  return [clampAim(aim[0]) + dx, clampAim(aim[1]) + dy];
}

// What a spot on the board scores. m: 1 single, 2 double, 3 treble (the bull counts as a double).
export function score(x, y) {
  const r = Math.hypot(x, y);
  if (r <= R.bull) return { v: 50, m: 2, n: 25, lab: 'Bull' };
  if (r <= R.outer) return { v: 25, m: 1, n: 25, lab: '25' };
  if (r > R.dOut) return { v: 0, m: 0, n: 0, lab: 'Miss' };
  const a = (Math.atan2(x, y) * 180 / Math.PI + 360 + 9) % 360, n = ORDER[Math.floor(a / 18) % 20];
  const m = r >= R.tIn && r <= R.tOut ? 3 : r >= R.dIn ? 2 : 1;
  return { v: n * m, m, n, lab: (m === 3 ? 'T' : m === 2 ? 'D' : '') + n };
}

// The middle of a target: n 1-20 or 25, m 1 (the fat single), 2 or 3. 25 with m 2 is the bull.
export function spot(n, m) {
  if (n === 25) return m === 2 ? [0, 0] : [0, (R.bull + R.outer) / 2];
  const a = ORDER.indexOf(n) * 18 * Math.PI / 180, r = m === 3 ? (R.tIn + R.tOut) / 2 : m === 2 ? (R.dIn + R.dOut) / 2 : (R.tOut + R.dIn) / 2;
  return [Math.sin(a) * r, Math.cos(a) * r];
}

// One dart applied to a score. Bust: below zero, or (double out) left on 1, or reaching zero without a double.
export function apply(rem, hit, dbl) {
  const left = rem - hit.v;
  if (left < 0 || (dbl && left === 1) || (left === 0 && dbl && hit.m !== 2)) return { left: rem, bust: true, out: false };
  return { left, bust: false, out: left === 0 };
}

// ----- finishing -----
const THROWS = [];
for (let n = 1; n <= 20; n++) for (const m of [1, 2, 3]) THROWS.push({ n, m, v: n * m, lab: (m === 3 ? 'T' : m === 2 ? 'D' : '') + n });
THROWS.push({ n: 25, m: 1, v: 25, lab: '25' }, { n: 25, m: 2, v: 50, lab: 'Bull' });
const DBL = [40, 32, 16, 36, 24, 20, 8, 12, 50, 28, 18, 4, 30, 34, 10, 26, 22, 38, 14, 6, 2]; // favourite doubles, best first
const dblRank = v => { const i = DBL.indexOf(v); return i < 0 ? 99 : i; };
const outs = new Map();
// The easiest way out from `rem` with `darts` left: a list of throws, or null. Double out finishes on a double (or the bull).
export function checkout(rem, darts = DARTS, dbl = true) {
  const key = rem * 10 + darts * 2 + (dbl ? 1 : 0);
  if (outs.has(key)) return outs.get(key);
  let best = null, bestScore = Infinity;
  const ends = dbl ? THROWS.filter(t => t.m === 2) : THROWS;
  const rate = route => { // fewer darts first, then a friendly last dart, then big trebles to set it up
    const last = route[route.length - 1];
    return route.length * 1000 + (dbl ? dblRank(last.v) * 10 : (last.m === 1 ? 0 : last.m === 2 ? 20 : 40)) - (route[0].m === 3 ? route[0].n : 0) * .1 + (route[0].n === 25 ? 5 : 0);
  };
  const consider = route => { const s = rate(route); if (s < bestScore) { bestScore = s; best = route; } };
  for (const e of ends) {
    if (e.v === rem) consider([e]);
    if (darts >= 2) for (const a of THROWS) if (a.v + e.v === rem) consider([a, e]);
    if (darts >= 3 && rem > 40) for (const a of THROWS) { if (a.m === 1 && a.n !== 25) continue; for (const b of THROWS) if (a.v + b.v + e.v === rem) consider([a, b, e]); }
  }
  outs.set(key, best);
  return best;
}
// A human-friendly finish hint, like "T20 T20 Bull".
export const outText = (rem, darts, dbl) => { const c = rem > 0 && rem <= (dbl ? 170 : 180) ? checkout(rem, darts, dbl) : null; return c ? c.map(t => t.lab).join(' ') : ''; };

// Which target a bot goes for: the first dart of a way out, or something that leaves a nice finish.
export function plan(rem, darts, dbl) {
  const c = rem <= (dbl ? 170 : 180) ? checkout(rem, darts, dbl) : null;
  if (c) return c[0];
  if (rem > 100) return { n: 20, m: 3 };
  // leave a favourite double (or anything easy straight out)
  let pick = null, pr = Infinity;
  for (const t of THROWS) {
    if (t.n === 25) continue;
    const left = rem - t.v; if (left < 2) continue;
    const r = dbl ? (left <= 40 && left % 2 === 0 ? dblRank(left) : 50 + left / 10) : (left <= 20 ? 0 : 10 + left / 10);
    const k = r + (t.m === 1 ? 0 : t.m === 3 ? 3 : 6);
    if (k < pr) { pr = k; pick = t; }
  }
  return pick || { n: 20, m: 1 };
}

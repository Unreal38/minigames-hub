// Bierki (pick-up sticks): the pile, and the check that decides whether another stick moved. Shared by the server
// and the browser. There is no physics engine: every stick is a thin rod that never falls or rolls by itself.
// The pile is laid down one stick at a time, each resting on the ones under it, so what lies on what is known.
// While a stick is pulled, only that stick moves and its distance to every other rod fills the "steady hands" meter.
import { L as T } from '../../i18n.js';

export const LEN = 3, R = .055;                 // a stick's length and half its thickness
export const MM = 1000;                         // drags travel as whole millimetres
export const FULL = 100;                        // the meter value at which another stick has moved
export const REACH = 7, LIFT_MAX = 2.5;         // how far a held stick may be carried
// Tuning: how fast the meter fills while a stick that lies on yours is dragged along (per unit moved, lifting counts
// 2.5 times), how fast it fills per unit pushed into a stick, and the push that is forgiven.
export const DRAG_RATE = 34, LIFT_K = 2.5, PEN_RATE = 3300, PEN_TOL = .006;
// Sliding over a stick that yours rests on rubs it a little too (per unit moved, per stick). Lifting does not.
export const UNDER_RATE = +(typeof process !== 'undefined' && process.env?.BK_UNDER || 16);
const TOUCH = 2 * R + .012, STEP = .02;

export const KINDS = {
  plain: { pts: 1, col: '#d8ad72' }, leaf: { pts: 2, col: '#3f9a52' }, tide: { pts: 3, col: '#2f86cc' }, ember: { pts: 4, col: '#e0592f' },
  spark: { pts: 5, col: '#d9a400' }, pet: { pts: 8 }, hook: { pts: 10, col: '#7a5a3a' }, crown: { pts: 20, col: '#e8b22c' },
};
// The four carved pets, one of each element colour. All four in one hand pay SET_BONUS.
export const PETS = { mossbun: 'leaf', cindercub: 'ember', puddlepup: 'tide', zapkit: 'spark' };
export const PET_NAMES = { mossbun: 'Mossbun', cindercub: 'Cindercub', puddlepup: 'Puddlepup', zapkit: 'Zapkit' }; // pet names are the same in every language
export const SET_BONUS = 10;
export const colOf = s => (s.k === 'pet' ? KINDS[PETS[s.pet]].col : KINDS[s.k].col);
export const kindName = s => (s.k === 'pet' ? T(`${PET_NAMES[s.pet]} stick`, `Bierka ${PET_NAMES[s.pet]}`) : {
  plain: () => T('Plain stick', 'Zwykła bierka'), leaf: () => T('Leaf stick', 'Bierka Liścia'), tide: () => T('Tide stick', 'Bierka Fali'),
  ember: () => T('Ember stick', 'Bierka Żaru'), spark: () => T('Spark stick', 'Bierka Iskry'), hook: () => T('The Hook', 'Hak'), crown: () => T('The Crown', 'Król'),
}[s.k]());
// 31 sticks for up to four players, 41 for five or six.
export function setFor(big = false) {
  const n = big ? { plain: 16, leaf: 7, tide: 5, ember: 4, spark: 3 } : { plain: 11, leaf: 5, tide: 4, ember: 3, spark: 2 };
  const out = [];
  for (const k in n) for (let i = 0; i < n[k]; i++) out.push({ k });
  for (const pet in PETS) out.push({ k: 'pet', pet });
  out.push({ k: 'hook' }, { k: 'crown' });
  return out;
}
export const totalOf = big => setFor(big).reduce((a, s) => a + KINDS[s.k].pts, 0);

export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// The two ends of a stick's centre line, carried by `off` (x, y, z) when it is the held one.
export function ends(s, off) {
  const ox = off ? off.x : 0, oy = off ? off.y : 0, oz = off ? off.z : 0, hx = s.dx * LEN / 2, hz = s.dz * LEN / 2;
  return [{ x: s.cx - hx + ox, y: s.y0 + oy, z: s.cz - hz + oz }, { x: s.cx + hx + ox, y: s.y1 + oy, z: s.cz + hz + oz }];
}

// How a stick at (cx, cz) pointing along (dx, dz) comes to rest on `others`: the lowest line y(t) that clears
// everything under it, held up by one point on each side of its middle. Returns the heights of its two ends.
const K = 25, MID = (K - 1) / 2;
export function restLine(cx, cz, dx, dz, others) {
  const h = new Array(K);
  for (let i = 0; i < K; i++) {
    const t = i / (K - 1), px = cx + dx * (t - .5) * LEN, pz = cz + dz * (t - .5) * LEN; let need = R;
    for (const o of others) {
      const [a, b] = ends(o), ex = b.x - a.x, ez = b.z - a.z;
      let u = ((px - a.x) * ex + (pz - a.z) * ez) / (ex * ex + ez * ez); u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = a.x + ex * u - px, qz = a.z + ez * u - pz, d2 = qx * qx + qz * qz;
      if (d2 < 4 * R * R) { const y = a.y + (b.y - a.y) * u + Math.sqrt(4 * R * R - d2); if (y > need) need = y; }
    }
    h[i] = need;
  }
  let best = null;
  for (let i = 0; i <= MID; i++) for (let j = Math.ceil(MID); j < K; j++) {
    let a, b;
    if (i === j) { a = h[i]; b = 0; } else { const ti = i / (K - 1), tj = j / (K - 1); b = (h[j] - h[i]) / (tj - ti); a = h[i] - b * ti; }
    let ok = true; for (let k = 0; k < K && ok; k++) if (a + b * k / (K - 1) < h[k] - 1e-9) ok = false;
    if (ok) { const v = a + b * .5 + Math.abs(b) * .002; if (!best || v < best.v) best = { v, a, b }; } // a hair of preference for lying flat, so a stick balanced on one point has one answer
  }
  if (!best) { let m = R; for (const v of h) if (v > m) m = v; best = { a: m, b: 0 }; }
  return { y0: best.a, y1: best.a + best.b };
}

// A fresh pile. Each stick tries a few landing spots and settles in the lowest, flattest one, the way a real stick
// slides off the heap. A stick only ever rests on sticks with a smaller id.
export function makePile(seed, big = false) {
  const r = rng(seed), kinds = setFor(big), spread = big ? 1.75 : 1.5, out = [];
  const q = v => Math.round(v * 1e5) / 1e5; // short numbers on the wire, and the same ones on both sides
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  for (let i = 0; i < kinds.length; i++) {
    let best = null;
    for (let tries = 0; tries < 8; tries++) {
      const rad = Math.sqrt(r()) * spread, th = r() * Math.PI * 2, ang = r() * Math.PI;
      const c = { cx: q(Math.cos(th) * rad), cz: q(Math.sin(th) * rad), dx: q(Math.cos(ang)), dz: q(Math.sin(ang)) };
      const rest = restLine(c.cx, c.cz, c.dx, c.dz, out); c.y0 = q(rest.y0); c.y1 = q(rest.y1);
      const score = (c.y0 + c.y1) / 2 + Math.abs(c.y1 - c.y0) * .8;
      if (!best || score < best.score) { best = c; best.score = score; }
    }
    delete best.score;
    out.push({ id: i, ...kinds[i], pts: KINDS[kinds[i].k].pts, ...best, g: 0 });
  }
  return out;
}

// Closest distance between two segments in space, and the height of the closest point on each.
export function segDist(p1, q1, p2, q2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z, d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z;
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  const c = d1x * rx + d1y * ry + d1z * rz, b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
  const cl = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  let s = den > 1e-9 ? cl((b * f - c * e) / den) : 0, t = (b * s + f) / e;
  if (t < 0) { t = 0; s = cl(-c / a); } else if (t > 1) { t = 1; s = cl((b - c) / a); }
  const ux = p1.x + d1x * s - (p2.x + d2x * t), y1 = p1.y + d1y * s, y2 = p2.y + d2y * t, uz = p1.z + d1z * s - (p2.z + d2z * t);
  return { d: Math.sqrt(ux * ux + (y1 - y2) * (y1 - y2) + uz * uz), y1, y2 };
}

const live = (o, s) => o !== s && !o.g;
// Pick a stick up: which sticks touch it, and which of those lie on top of it.
export function startPull(pile, s, carry = 0) {
  const [a, b] = ends(s), st = { s, off: { x: 0, y: 0, z: 0 }, drag: carry, meter: carry, pen: {}, base: {}, onTop: [], touch: [], shake: {} };
  for (const o of pile) {
    if (!live(o, s)) continue;
    const [c, d] = ends(o), m = segDist(a, b, c, d);
    st.base[o.id] = Math.max(0, 2 * R - m.d);
    if (m.d < TOUCH) { st.touch.push(o.id); if (m.y2 > m.y1 + R * .3) st.onTop.push(o.id); }
  }
  return st;
}
// Speed matters: the same rub fills the meter 1 + (v / CALM)^2 times as fast (at most HASTE times), so pull slowly.
export const CALM = +(typeof process !== 'undefined' && process.env?.BK_CALM || 1.2), HASTE = 6;
const hurry = v => Math.min(HASTE, 1 + (v / CALM) * (v / CALM));
function step(pile, st, off, f) {
  const mx = off.x - st.off.x, mz = off.z - st.off.z, moved = Math.sqrt(mx * mx + mz * mz), lifted = Math.max(0, off.y - st.off.y);
  st.off = off;
  const [a, b] = ends(st.s, off), shake = {};
  for (const o of pile) {
    if (!live(o, st.s)) continue;
    const [c, d] = ends(o), m = segDist(a, b, c, d);
    if (m.d < TOUCH + .01 && st.touch.includes(o.id)) {
      if (st.onTop.includes(o.id)) { st.drag += (moved + lifted * LIFT_K) * DRAG_RATE * f; shake[o.id] = .5; }
      else if (moved > 0) { st.drag += moved * UNDER_RATE * f; shake[o.id] = .12 * f; }
    }
    const ex = Math.max(0, 2 * R - m.d) - st.base[o.id] - PEN_TOL;
    if (ex > 0) { if (!(st.pen[o.id] > ex)) st.pen[o.id] = ex; shake[o.id] = Math.min(1, ex * 40); }
  }
  let pen = 0; for (const k in st.pen) pen += st.pen[k];
  st.meter = st.drag + pen * PEN_RATE; st.shake = shake;
}
// Carry the held stick to `to` (x, y, z) over `ms` milliseconds, in small steps so a fast drag cannot jump through
// a stick. Stops as soon as the meter is full. Both sides call this with the same whole numbers, so they agree.
export function advance(pile, st, to, ms = 1e6) {
  const f = st.off, dx = to.x - f.x, dy = to.y - f.y, dz = to.z - f.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz), n = Math.max(1, Math.ceil(dist / STEP));
  const h = hurry(dist / (Math.max(8, ms) / 1000));
  for (let i = 1; i <= n && st.meter < FULL; i++) { const k = i / n; step(pile, st, { x: f.x + dx * k, y: f.y + dy * k, z: f.z + dz * k }, h); }
  return st.meter;
}
// Is the held stick free of every other stick (and not simply still in its place)?
export function isClear(pile, st) {
  const o = st.off; if (o.x * o.x + o.y * o.y + o.z * o.z < .0625) return false;
  const [a, b] = ends(st.s, o);
  for (const p of pile) if (live(p, st.s) && segDist(a, b, ...ends(p)).d <= 2 * R + .05) return false;
  return true;
}
// A stick has left the pile: lay every later stick down again. Returns the sticks that dropped (they moved).
export function resettle(pile, apply = true) {
  const moved = [], rest = [];
  for (const o of pile) {
    if (o.g) continue;
    const r = restLine(o.cx, o.cz, o.dx, o.dz, rest), y0 = Math.round(r.y0 * 1e5) / 1e5, y1 = Math.round(r.y1 * 1e5) / 1e5;
    const drop = Math.abs(o.y0 - y0) > .012 || Math.abs(o.y1 - y1) > .012;
    if (drop) moved.push({ id: o.id, y0, y1 });
    rest.push(drop ? { ...o, y0, y1 } : o);
  }
  if (apply) for (const m of moved) { pile[m.id].y0 = m.y0; pile[m.id].y1 = m.y1; }
  return moved;
}
// Would taking stick s out make another stick drop?
export function dropsWithout(pile, s) { const g = s.g; s.g = 1; const m = resettle(pile, false); s.g = g; return m; }
// What pulling stick s puts at risk, for the hints: `fall` = every stick that would drop once s is gone (a sure
// "moved") plus every stick lying on top of it (dragging those fills the meter fast); `touch` = the rest it touches.
export function atRisk(pile, s, st = startPull(pile, s)) {
  const fall = [...new Set([...dropsWithout(pile, s).map(m => m.id), ...st.onTop])];
  return { fall, touch: st.touch.filter(i => !fall.includes(i)) };
}

// The pulls worth trying for stick s: along itself both ways, sideways both ways, and straight up with the Hook.
// Each comes back with the meter it would reach (FULL when it does not get the stick out cleanly).
export function plans(pile, s, hook = false) {
  const dirs = [[s.dx, 0, s.dz, LEN * 1.05], [-s.dx, 0, -s.dz, LEN * 1.05], [-s.dz, 0, s.dx, LEN * 1.05], [s.dz, 0, -s.dx, LEN * 1.05]];
  if (hook) dirs.push([0, 1, 0, 1]);
  return dirs.map(([x, y, z, dist]) => {
    const st = startPull(pile, s), q = v => Math.round(v * dist * MM) / MM;
    let m = advance(pile, st, { x: q(x), y: q(y), z: q(z) });
    if (m < FULL && (!isClear(pile, st) || dropsWithout(pile, s).length)) m = FULL;
    return { x, y, z, dist, m };
  }).sort((a, b) => a.m - b.m);
}

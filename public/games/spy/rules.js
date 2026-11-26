// Spyglass Isle rules shared by the server and the browsers: the pets of a match and every picture card come from one
// seed, so everybody sees exactly the same card. A card is a square SIZE x SIZE field (card units, not pixels).
import { SPECIES, ELEMENTS } from '../farm/data.js';

export const SIZE = 1000;        // a card is SIZE x SIZE card units
export const FIND_MS = 30000;    // time to find the pet on one card
export const REVEAL_MS = 2800;   // the found pet glows before the next card
export const COUNT_MS = 3000;    // 3, 2, 1 before the first card
export const LOAD_MS = 12000;    // the longest the table waits for slow devices to draw the pets
export const DIZZY_MS = 1500;    // a wrong tap
export const HIT = .42;          // a tap this close to the pet's middle (times its size) finds it
export const POOL = 56;          // different pet looks in one match
export const CARDS = [8, 12];
export const THEMES = ['meadow', 'beach', 'snow', 'pond'];
const FORMS = [0, 2];            // baby, adult (young looks too much like both)
const ELS = Object.keys(ELEMENTS);

// mulberry32: a small seeded random number generator, the same in Node and every browser
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A look: { sp, f: 0 baby | 2 adult, el: null (its own colours) or another element }. key() tells two looks apart.
export const key = l => `${l.sp}.${l.f}.${l.el || ''}`;
export const lvOf = l => l.f ? 15 : 1; // a level that gives that form (data.js formOf)
const otherEl = (sp, r) => { const own = SPECIES[sp].el, opts = ELS.filter(e => e !== own); return opts[Math.floor(r() * opts.length)]; };
const canTint = sp => !SPECIES[sp].el2; // two-element pets keep their colours

// The match: which looks appear at all, and which one is hunted on each card. Every target gets its lookalikes
// (the same pet as a baby or grown up, or in another element's colours) in the pool too.
export function makePool(seed, cards) {
  const r = rng(seed ^ 0x5a17), sps = shuffle(Object.keys(SPECIES), r), pool = [], seen = new Set(), targets = [];
  const add = l => { const k = key(l); if (seen.has(k)) return pool.findIndex(p => key(p) === k); seen.add(k); pool.push(l); return pool.length - 1; };
  for (let n = 0; n < cards; n++) {
    const sp = sps[n], tint = canTint(sp) && r() < .35, l = { sp, f: r() < .7 ? 2 : 0, el: tint ? otherEl(sp, r) : null };
    targets.push(add(l));
    add({ sp, f: 2 - l.f, el: l.el }); // the other form
    if (canTint(sp)) add({ sp, f: l.f, el: l.el ? null : otherEl(sp, r) }); // the other colours
  }
  for (let i = cards; pool.length < POOL && i < sps.length; i++) {
    const sp = sps[i]; add({ sp, f: r() < .65 ? 2 : 0, el: canTint(sp) && r() < .25 ? otherEl(sp, r) : null });
  }
  return { pool, targets };
}

// One card: n counts from 0. Cards get busier (40 pets on the first, 130 on the last) with more lookalikes.
// items are in drawing order; ti is where the hunted pet is among them. The hunted look appears exactly once,
// and nothing drawn above it covers its middle.
export function makeCard(seed, n, cards, M = makePool(seed, cards)) {
  const r = rng((seed * 31 + n * 7919 + 13) >>> 0), p = cards > 1 ? n / (cards - 1) : 0;
  const count = Math.round(40 + 90 * p), theme = THEMES[Math.floor(r() * THEMES.length)];
  const tk = M.targets[n], tl = M.pool[tk];
  const kin = M.pool.map((l, i) => i).filter(i => i !== tk && M.pool[i].sp === tl.sp);
  const rest = M.pool.map((l, i) => i).filter(i => M.pool[i].sp !== tl.sp);
  const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols), cw = SIZE / cols, ch = SIZE / rows;
  const cells = shuffle(Array.from({ length: cols * rows }, (_, i) => i), r);
  const look = kin.length ? Math.min(count - 1, 1 + Math.round(p * 4)) : 0;
  const items = [];
  for (let i = 0; i < count; i++) {
    const c = cells[i % cells.length], cx = c % cols, cy = Math.floor(c / cols), cell = Math.min(cw, ch);
    const k = i === 0 ? tk : i <= look ? kin[(i - 1) % kin.length] : rest[Math.floor(r() * rest.length)];
    const s = Math.round(cell * (i === 0 ? .95 + r() * .15 : .8 + r() * .45));
    let x = (cx + .15 + r() * .7) * cw, y = (cy + .15 + r() * .7) * ch;
    const m = s * .5 + 6; x = Math.round(Math.max(m, Math.min(SIZE - m, x))); y = Math.round(Math.max(m, Math.min(SIZE - m, y)));
    items.push({ k, x, y, s, f: r() < .5 ? 1 : 0, rot: Math.round((r() - .5) * 50) / 100 });
  }
  const t = items[0], below = [], above = [];
  for (const o of shuffle(items.slice(1), r)) (Math.hypot(o.x - t.x, o.y - t.y) < t.s * .5 + o.s * .2 ? below : above).push(o);
  const at = Math.floor(r() * (above.length + 1));
  const order = [...below, ...above.slice(0, at), t, ...above.slice(at)];
  return { n, theme, items: order, ti: order.indexOf(t), t, look: tl };
}

// Did a tap at (x, y) in card units find the hunted pet?
export const hits = (card, x, y) => Math.hypot(x - card.t.x, y - card.t.y) <= card.t.s * HIT;

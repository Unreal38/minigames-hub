// Pet Farm island orders (Kuba's pick, 2026-11-25 economy plan): pets from the neighbouring islands ask for materials
// and treats. Delivering an order pays Stamps, a token that only buys the stamp decorations (ITEMS with stamp: true).
// Stamps live in the farm's inventory as inv.stamps like any material, but they are never traded, gifted, swapped at
// the Workshop or capped by storage (TRADE_MATS and STORED leave them out). Other features that pay stamps (the Farm
// Journal) add to inv.stamps the same way.
// The server makes the orders (server/farmorders.js); this file holds the rules both sides read.
import { ZONES, WORTH, SPECIES, STORED, topLv, lvOf, capOf } from './data.js';

export const ORDER_DAILY = 3; // new orders every day at midnight in Warsaw; unfinished ones are replaced
export const ORDER_SWAPS = 1; // how many daily orders a day may be swapped for a new one
// What one of each is worth when an order is sized: the Workshop's WORTH, and treats by what goes into them.
export const ORDER_WORTH = { ...WORTH, sunberry: 8, cookie: 8, juice: 12, cake: 25, pie: 40 };
// The value one daily order asks for, by farmhouse level: [smallest, biggest]. Levels past the table use its last row.
export const ORDER_SIZE = [null, [50, 90], [100, 170], [170, 260], [250, 360], [320, 460]];
export const BIG_X = 6, BIG_BONUS = 1.5; // the weekly order is six daily orders big and pays half as much again per value
export const STAMP_VALUE = 80; // one stamp for about this much value delivered (was 60; Kuba asked for a bit fewer, 2026-11-25)
const TREATS = ['cookie', 'juice', 'cake', 'pie', 'sunberry'];

export const sizeAt = house => ORDER_SIZE[Math.min(ORDER_SIZE.length - 1, Math.max(1, house | 0))];
// Everything this farm can make right now, so an order never asks for something out of reach.
export function askable(f) {
  const h = f.house || 1, out = ['wood', 'stone', 'fiber'];
  if (h >= 2) out.push('shells');
  if (h >= 3) out.push('coal');
  const gardens = f.items.filter(i => i.type === 'garden');
  if (gardens.length) out.push('berries');
  if (gardens.some(i => lvOf(i) >= 2)) out.push('sunberry');
  const k = topLv(f, 'kitchen');
  if (k) out.push('cookie', 'juice', gardens.length >= 2 ? 'cake' : null);
  if (k >= 2 && gardens.some(i => lvOf(i) >= 2)) out.push('pie');
  return out.filter(Boolean);
}
// The islands this farm can reach: an order comes from one of them, brought by one of its wild pets.
const reach = f => Object.entries(ZONES).filter(([, z]) => z.house <= (f.house || 1));

/** A new order for farm f. big: the weekly one. rnd: () => a number in [0, 1). */
export function makeOrder(f, big, rnd = Math.random) {
  const [lo, hi] = sizeAt(f.house), budget = (lo + rnd() * (hi - lo)) * (big ? BIG_X : 1);
  const pool = askable(f), basic = pool.filter(k => !TREATS.includes(k)), treats = pool.filter(k => TREATS.includes(k));
  const n = big ? 4 : 2 + (rnd() < .5 ? 1 : 0), picks = [];
  // mostly materials; a treat now and then (at most one in a daily order, two in the weekly one)
  const treatN = !treats.length ? 0 : big ? 1 + (rnd() < .5 ? 1 : 0) : rnd() < .4 ? 1 : 0;
  const draw = list => list.splice(Math.floor(rnd() * list.length), 1)[0];
  const b = [...basic], t = [...treats];
  for (let i = 0; i < treatN && t.length; i++) picks.push(draw(t));
  while (picks.length < n && b.length) picks.push(draw(b));
  const weights = picks.map(k => (.6 + rnd() * .8) * (TREATS.includes(k) ? .45 : 1)), sum = weights.reduce((a, w) => a + w, 0);
  const cap = capOf(f), want = {};
  picks.forEach((k, i) => {
    const raw = budget * weights[i] / sum / ORDER_WORTH[k];
    let amount = ORDER_WORTH[k] >= 8 ? Math.max(1, Math.round(raw)) : Math.max(5, Math.round(raw / 5) * 5);
    if (STORED.includes(k)) amount = Math.min(amount, Math.floor(cap * .8 / 5) * 5); // always fits in the farm's storage
    want[k] = amount;
  });
  if (big && (f.house || 1) >= 2) want.crystal = 2 + Math.floor(rnd() * ((f.house || 1) >= 4 ? 4 : 2)); // the weekly order also asks for a little crystal
  const value = Object.entries(want).reduce((a, [k, v]) => a + v * ORDER_WORTH[k], 0);
  const stamps = Math.max(1, Math.round(value / STAMP_VALUE * (big ? BIG_BONUS : 1)));
  const isles = reach(f), [from, z] = isles[Math.floor(rnd() * isles.length)];
  const wild = Object.keys(z.wild).filter(sp => SPECIES[sp]), sp = wild[Math.floor(rnd() * wild.length)];
  const mood = Math.floor(rnd() * WHY.length);
  return { id: Math.floor(rnd() * 2 ** 31).toString(36), from, sp, want, got: {}, stamps, mood, ...(big ? { big: true } : {}) };
}
// Why they want it: a line on the order card (the client has these in both languages, see orderWhy in client.js).
export const WHY = ['party', 'build', 'bake', 'winter', 'friend', 'festival'];
// How much of an order is still missing, and whether it is all in.
export const missing = o => Object.fromEntries(Object.entries(o.want).map(([k, n]) => [k, Math.max(0, n - (o.got?.[k] || 0))]).filter(([, n]) => n > 0));
export const complete = o => !Object.keys(missing(o)).length;
// What handing in now would give: everything the farm has toward each line, up to what is still missing.
export function handIn(o, inv) {
  const out = {};
  for (const [k, n] of Object.entries(missing(o))) { const g = Math.min(n, Math.max(0, inv[k] || 0)); if (g > 0) out[k] = g; }
  return out;
}

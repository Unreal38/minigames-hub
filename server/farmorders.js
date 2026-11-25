// Pet Farm island orders on the server: three daily orders and one weekly order per farm, kept in f.orders and made
// fresh when the day (midnight in Warsaw, server/day.js) or the week (from Monday) turns over. Handing in pays the
// order's Stamps into f.inv.stamps once everything it asked for is in. The rules and sizes are in
// public/games/farm/orders.js.
import crypto from 'node:crypto';
import { countOf } from '../public/games/farm/data.js';
import { ORDER_DAILY, ORDER_SWAPS, makeOrder, missing, complete, handIn } from '../public/games/farm/orders.js';
import { dayOf, addDays, startOf, untilNext, now } from './day.js';

const rnd = () => crypto.randomInt(2 ** 30) / 2 ** 30;
const rid = () => crypto.randomBytes(5).toString('hex');
// Monday of this day's week, as a day key: the weekly order turns over then.
export const weekOf = day => addDays(day, -((new Date(day + 'T12:00Z').getUTCDay() + 6) % 7));
const fresh = (f, big) => ({ ...makeOrder(f, big, rnd), id: rid() });

/** Make sure f.orders holds today's orders and this week's big one. Only farms with an Order Board get orders. */
export function refresh(f) {
  if (!countOf(f, 'board')) return null;
  const day = dayOf(), week = weekOf(day), o = f.orders ||= {};
  if (o.day !== day) { o.day = day; o.list = Array.from({ length: ORDER_DAILY }, () => fresh(f, false)); o.swaps = 0; }
  if (o.week !== week || !o.big) { o.week = week; o.big = fresh(f, true); }
  return o;
}
/** What the page sees: the orders, how many swaps are left today, and when new ones come (ms from now). */
export function ordersView(f) {
  const o = refresh(f); if (!o) return null;
  return { list: o.list, big: o.big, swaps: Math.max(0, ORDER_SWAPS - (o.swaps || 0)), next: untilNext(), week: Math.max(1000, startOf(addDays(o.week, 7)) - now()), done: f.ordersDone || 0 };
}
const find = (o, id) => o.big?.id === id ? o.big : o.list.find(x => x.id === id);

/** One order action. Returns { err } or what to reply with. pay(inv, cost, sign) is farm.js's own. */
export function orderAction(f, a, pay) {
  const o = refresh(f); if (!o) return { err: 'Build an Order Board first.' };
  const it = find(o, a.id); if (!it) return { err: 'That order is gone. New orders come every day.' };
  if (a.t === 'order') { // hand in everything the farm has toward it; the stamps come once it is all in
    if (it.done) return { err: 'That order is already delivered.' };
    const give = handIn(it, f.inv); if (!Object.keys(give).length) return { err: 'You have none of what they asked for yet.' };
    pay(f.inv, give); it.got ||= {}; for (const [k, n] of Object.entries(give)) it.got[k] = (it.got[k] || 0) + n;
    if (!complete(it)) return { did: 'order', id: it.id, gave: give, left: missing(it) };
    it.done = true; f.inv.stamps = (f.inv.stamps || 0) + it.stamps; f.ordersDone = (f.ordersDone || 0) + 1;
    return { did: 'order', id: it.id, gave: give, done: true, stamps: it.stamps, big: !!it.big };
  }
  if (a.t === 'orderswap') { // trade one daily order for a new one, once a day; whatever was handed in comes back
    if (it.big) return { err: 'The weekly order cannot be swapped.' };
    if (it.done) return { err: 'That order is already delivered.' };
    if ((o.swaps || 0) >= ORDER_SWAPS) return { err: 'You already asked for a new order today.' };
    pay(f.inv, it.got || {}, 1);
    o.list[o.list.indexOf(it)] = fresh(f, false); o.swaps = (o.swaps || 0) + 1;
    return { did: 'orderswap' };
  }
  return null;
}

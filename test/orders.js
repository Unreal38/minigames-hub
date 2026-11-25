// Pet Farm island orders and Stamps: order sizes, the Order Board, handing in, swaps, the weekly order, stamp
// decorations, and stamps staying with the farm (no trades, no gifts).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ITEMS, ZONES, STORED, TRADE_MATS, capOf, HOUSE_UP } from '../public/games/farm/data.js';
import { makeOrder, askable, sizeAt, ORDER_WORTH, BIG_X, missing, handIn, complete } from '../public/games/farm/orders.js';
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
let srv;

// ---------- the rules, without a server ----------
{
  const farmAt = (house, extra = []) => ({ house, size: 24, items: [{ type: 'house' }, ...extra] });
  const cases = [farmAt(1), farmAt(2, [{ type: 'garden' }]), farmAt(3, [{ type: 'garden' }, { type: 'garden', lv: 2 }, { type: 'kitchen' }]),
    farmAt(5, [{ type: 'garden', lv: 3 }, { type: 'garden' }, { type: 'kitchen', lv: 3 }, { type: 'barn', lv: 3 }]), farmAt(7, [{ type: 'barn' }])];
  for (const f of cases) {
    const can = askable(f), cap = capOf(f), [lo, hi] = sizeAt(f.house);
    for (let i = 0; i < 400; i++) {
      const big = i % 4 === 0, o = makeOrder(f, big);
      const keys = Object.keys(o.want);
      if (keys.length < 2 || keys.some(k => !can.includes(k) && !(big && k === 'crystal'))) fail(`house ${f.house} asked for ${keys}`);
      if (big && f.house < 2 && o.want.crystal) fail('crystal before Pebble Ridge is open');
      for (const [k, n] of Object.entries(o.want)) { if (!Number.isInteger(n) || n < 1) fail(`bad amount ${k} ${n}`); if (STORED.includes(k) && n > cap) fail(`${k} ${n} does not fit in storage ${cap}`); }
      const value = Object.entries(o.want).reduce((a, [k, n]) => a + n * ORDER_WORTH[k], 0), x = big ? BIG_X : 1;
      if (!big && (value < lo * .6 || value > hi * 1.4)) fail(`house ${f.house} daily order worth ${value}, not near ${lo}-${hi}`);
      if (o.stamps < 1 || !Number.isInteger(o.stamps)) fail('stamps ' + o.stamps);
      if (!ZONES[o.from] || ZONES[o.from].house > f.house || !(o.sp in ZONES[o.from].wild)) fail(`order from ${o.from} (${o.sp}) at house ${f.house}`);
      if (big && value < lo * x * .5) fail('weekly order too small ' + value);
    }
  }
  const o = { want: { wood: 10, cookie: 2 }, got: { wood: 4 } };
  if (JSON.stringify(missing(o)) !== '{"wood":6,"cookie":2}' || JSON.stringify(handIn(o, { wood: 100, cookie: 1 })) !== '{"wood":6,"cookie":1}' || complete(o)) fail('missing / handIn');
  if (TRADE_MATS.includes('stamps') || TRADE_MATS.includes('coins')) fail('stamps or coins are tradable');
  const { weekOf } = await import('../server/farmorders.js');
  for (const [d, w] of [['2026-11-25', '2026-11-23'], ['2026-11-23', '2026-11-23'], ['2026-11-29', '2026-11-23'], ['2026-11-30', '2026-11-30'], ['2027-01-01', '2026-12-28']]) if (weekOf(d) !== w) fail(`week of ${d}: ${weekOf(d)}`);
  for (const [k, it] of Object.entries(ITEMS)) if (it.stamp && (Object.keys(it.cost).join() !== 'stamps' || it.kind !== 'd')) fail('stamp decoration with another price ' + k);
}

// ---------- on a server ----------
const PORT = 21800 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, FARM_TEST: '1' }, stdio: 'inherit' }); await wait(700);
function player(name) {
  const p = { last: null };
  p.ready = new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'welcome') res(); if (m.t === 'auth') p.auth = m; if (m.t === 'farm') { p.last = m; if (m.farm) p.farm = m.farm; } };
  });
  p.farmDo = async a => { p.last = null; p.send({ t: 'farm', a }); await until(() => p.last, 'farm reply to ' + a.t); return p.last; };
  return p;
}
const a = player('Olek'); await a.ready;
a.send({ t: 'register', user: 'olek', pass: 'hunter22' }); await until(() => a.auth, 'register'); if (a.auth.err) fail(a.auth.err);
let r = await a.farmDo({ t: 'starter', sp: 'mossbun' });
if (r.farm.orders !== null) fail('orders without an Order Board');
await a.farmDo({ t: 'open', test: { give: { wood: 900, stone: 900, fiber: 900, shells: 200, coal: 100, crystal: 20 } } });
r = await a.farmDo({ t: 'place', type: 'board', x: 0, y: 8, r: 0 }); if (r.err !== 'That needs a level 2 farmhouse.') fail('board before farmhouse 2: ' + r.err);
r = await a.farmDo({ t: 'order', id: 'x' }); if (r.err !== 'Build an Order Board first.') fail('order without a board: ' + r.err);
r = await a.farmDo({ t: 'houseup' }); if (r.err || r.farm.house !== 2) fail('houseup ' + r.err);
r = await a.farmDo({ t: 'place', type: 'board', x: 0, y: 8, r: 0 }); if (r.err) fail('place board ' + r.err);
const O = r.farm.orders;
if (!O || O.list.length !== 3 || !O.big?.big || O.swaps !== 1 || !(O.next > 0) || !(O.week > 0) || O.done !== 0) fail('orders view ' + JSON.stringify(O));
// the same orders until the day turns
r = await a.farmDo({ t: 'open' }); if (JSON.stringify(r.farm.orders.list) !== JSON.stringify(O.list)) fail('orders changed on their own');

// hand in a bit at a time: take everything away first, then give half of one line
const o1 = O.list[0], [k1, n1] = Object.entries(o1.want)[0];
const empty = Object.fromEntries(Object.keys(a.farm.inv).filter(k => k !== 'coins').map(k => [k, -(a.farm.inv[k] || 0)]));
r = await a.farmDo({ t: 'open', test: { give: empty } });
r = await a.farmDo({ t: 'order', id: o1.id }); if (r.err !== 'You have none of what they asked for yet.') fail('handed in nothing: ' + r.err);
const half = Math.max(1, Math.floor(n1 / 2));
r = await a.farmDo({ t: 'open', test: { give: { [k1]: half } } });
r = await a.farmDo({ t: 'order', id: o1.id });
let got = r.farm.orders.list.find(x => x.id === o1.id);
if (r.err || r.done || got.got[k1] !== half || r.farm.inv[k1] !== 0) fail('partial hand-in ' + JSON.stringify(r.err || got));
// swap: only an order with something in gives it back
r = await a.farmDo({ t: 'orderswap', id: O.big.id }); if (r.err !== 'The weekly order cannot be swapped.') fail('swapped the weekly order');
r = await a.farmDo({ t: 'orderswap', id: o1.id }); if (r.err || r.farm.orders.list.some(x => x.id === o1.id) || r.farm.orders.list.length !== 3 || r.farm.inv[k1] !== half || r.farm.orders.swaps !== 0) fail('swap ' + r.err);
r = await a.farmDo({ t: 'orderswap', id: r.farm.orders.list[1].id }); if (r.err !== 'You already asked for a new order today.') fail('second swap: ' + r.err);
// deliver the whole thing: stamps come in once, and only once
const o2 = r.farm.orders.list[0];
r = await a.farmDo({ t: 'open', test: { give: Object.fromEntries(Object.entries(o2.want).map(([k, n]) => [k, n + 3])) } });
const inv0 = { ...r.farm.inv };
r = await a.farmDo({ t: 'order', id: o2.id });
if (r.err || !r.done || r.stamps !== o2.stamps || r.farm.inv.stamps !== o2.stamps || r.farm.orders.done !== 1 || !r.farm.orders.list[0].done) fail('deliver ' + JSON.stringify(r.err || r));
for (const [k, n] of Object.entries(o2.want)) if (r.farm.inv[k] !== inv0[k] - n) fail(`deliver took the wrong amount of ${k}`);
r = await a.farmDo({ t: 'order', id: o2.id }); if (r.err !== 'That order is already delivered.' || r.farm.inv.stamps !== o2.stamps) fail('delivered twice');
r = await a.farmDo({ t: 'orderswap', id: o2.id }); if (!r.err) fail('swapped a delivered order');
// the weekly order
r = await a.farmDo({ t: 'open', test: { give: Object.fromEntries(Object.entries(O.big.want).map(([k, n]) => [k, n])) } });
r = await a.farmDo({ t: 'order', id: O.big.id }); if (!r.done || !r.big || r.farm.inv.stamps !== o2.stamps + O.big.stamps) fail('weekly order ' + JSON.stringify(r.err || r));
const stamps = r.farm.inv.stamps;
// a new day and week: fresh orders, the swap back
r = await a.farmDo({ t: 'open', test: { orders: 'new' } });
if (r.farm.orders.list.some(x => x.done) || r.farm.orders.big.done || r.farm.orders.swaps !== 1 || r.farm.orders.big.id === O.big.id) fail('new day');

// stamp decorations: bought with stamps only, given back when sold
r = await a.farmDo({ t: 'place', type: 'bandstand', x: 6, y: 6, r: 0 }); if (r.err !== 'Not enough materials for that.') fail('bandstand without enough stamps: ' + r.err);
await a.farmDo({ t: 'open', test: { give: { stamps: 200 - stamps } } });
r = await a.farmDo({ t: 'place', type: 'vane', x: 0, y: 0, r: 0 }); if (r.err || r.farm.inv.stamps !== 200 - ITEMS.vane.cost.stamps) fail('buy a vane ' + r.err);
const vane = r.farm.items.find(i => i.type === 'vane');
r = await a.farmDo({ t: 'remove', id: vane.id }); if (r.err || r.farm.inv.stamps !== 200) fail('sell a vane ' + r.err);
// stamps never leave the farm: not in trades, not as gifts
const b = player('Bea'); await b.ready;
b.send({ t: 'register', user: 'bea', pass: 'hunter22' }); await until(() => b.auth, 'register b');
await b.farmDo({ t: 'starter', sp: 'cindercub' });
const bId = (await a.farmDo({ t: 'world' })).world?.find(x => x.name === 'Bea')?.id; if (!bId) fail('no Bea on the map');
r = await a.farmDo({ t: 'offer', to: bId, give: { mats: { stamps: 10 } }, want: {} }); if (!r.err) fail('stamps offered in a trade');
a.last = null; a.send({ t: 'farm', a: { t: 'gift', id: bId, item: 'vane' } }); await wait(300);
if (a.last && !a.last.err) fail('a stamp decoration was gifted');
if ((await a.farmDo({ t: 'open' })).farm.inv.stamps !== 200) fail('stamps went missing');
a.ws.close(); b.ws.close();
console.log('orders ok');
srv.kill(); process.exit(0);

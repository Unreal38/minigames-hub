// Lucky Wheel (the daily spin): guests cannot spin, one spin a day, coins are paid at once, Pet Farm prizes wait on
// the profile until there is a farm and then sit in the Mailbox, a baby needs a bed, boosters start at their building,
// lucky decorations never repeat, bad luck runs out, a full set pays coins, and it all survives a restart.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ORDER, PRIZES, LUCKY, PITY, SET_COINS, BOOSTS } from '../public/wheelprizes.js';
import { SPECIES, ITEMS } from '../public/games/farm/data.js';
const PORT = 18080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-wheel-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async () => { srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, DAILY_TEST: '1', WHEEL_TEST: '1', FARM_TEST: '1', DAILY_NOW: '2026-11-30T22:30:00Z' }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, w: null, f: null };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') p.token = m.token;
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'wheel') p.w = m;
      if (m.t === 'farm' && !m.note) p.f = m;
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply'); return p.auth; };
  p.wheel = async (m = {}) => { p.w = null; p.send({ t: 'wheel', ...m }); await until(() => p.w, 'wheel reply'); return p.w; };
  p.spin = (slice, test = {}) => p.wheel({ spin: true, test: { slice, ...test } });
  p.farm = async a => { p.f = null; p.send({ t: 'farm', a }); await until(() => p.f, 'farm reply ' + a.t); return p.f; };
  return p;
}
const at = k => ORDER.indexOf(k);
if (ORDER.length !== 20 || ORDER.some(k => !PRIZES[k])) fail('the wheel must have 20 known slices');
if (LUCKY.some(t => !ITEMS[t]?.wheel)) fail('a lucky decoration is missing from the Pet Farm items');

await start();
const guest = await player('Gus').connect(), ana = await player('Ana').connect();
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');

// 1. Guests see the pet of the day and cannot spin.
let w = await guest.wheel({ spin: true });
if (!w.guest || w.won || !SPECIES[w.pet] || SPECIES[w.pet].rare > 2) fail('guest view ' + JSON.stringify(w));
if (w.day !== '2026-11-30' || w.next < 29 * 60_000 || w.next > 31 * 60_000) fail('the day turns at midnight in Warsaw: ' + w.next);
console.log('guest ok');

// 2. Coins are paid straight away, and there is one spin a day.
const coins0 = ana.me.coins;
w = await ana.spin(at('c20'));
if (w.won?.i !== at('c20') || w.won.prize.coins !== 20 || !w.spun) fail('coin spin ' + JSON.stringify(w.won));
await until(() => ana.me.coins === coins0 + 20, 'coins paid');
w = await ana.wheel({ spin: true });
if (!w.err || w.won) fail('a second spin on the same day went through');
if (ana.me.coins !== coins0 + 20) fail('paid twice');
console.log('one spin a day ok');

// 3. With no farm yet a Pet Farm prize waits, and lands in the Mailbox once the farm exists.
w = await ana.spin(at('mat'), { again: true });
const got = w.won.prize.got, [mk, mn] = Object.entries(got)[0];
if (w.won.prize.where !== 'hold' || mn !== 40 || !['wood', 'stone', 'fiber'].includes(mk)) fail('material prize ' + JSON.stringify(w.won));
let f = await ana.farm({ t: 'starter', sp: 'mossbun' });
let letter = f.farm.mail.find(m => m.k === 'wheel');
if (!letter || letter.got[mk] !== 40) fail('the held prize did not reach the mailbox');
f = await ana.farm({ t: 'place', type: 'mailbox', x: 0, y: 0, r: 0 });
if (f.err) fail('mailbox: ' + f.err);
const before = f.farm.inv[mk];
f = await ana.farm({ t: 'claim', id: letter.id });
if (f.farm.inv[mk] !== before + 40 || f.farm.mail.some(m => m.k === 'wheel')) fail('claiming the materials');
console.log('held prize and mailbox ok');

// 4. The pet of the day arrives as a baby, and only when a bed is free.
w = await ana.spin(at('pet'), { again: true });
if (w.won.prize.pet.sp !== w.pet || w.won.prize.where !== 'mail') fail('pet prize ' + JSON.stringify(w.won));
f = await ana.farm({ t: 'open' });
letter = f.farm.mail.find(m => m.pet);
f = await ana.farm({ t: 'claim', id: letter.id });
if (f.err || f.farm.pets.length !== 2 || f.farm.pets[1].sp !== w.pet || f.farm.pets[1].lv !== 1 || !f.born) fail('the baby did not move in: ' + f.err);
w = await ana.spin(at('pet'), { again: true });
f = await ana.farm({ t: 'open' }); letter = f.farm.mail.find(m => m.pet);
f = await ana.farm({ t: 'claim', id: letter.id });
if (!f.err || f.farm.pets.length !== 2 || !f.farm.mail.some(m => m.pet)) fail('a baby moved in with no bed free, or the letter was lost');
console.log('pet of the day ok');

// 5. A booster is a token for one building; it starts there and then runs.
w = await ana.spin(at('boost'), { again: true });
const bt = w.won.prize.boost; if (!BOOSTS[bt]) fail('booster prize ' + JSON.stringify(w.won));
f = await ana.farm({ t: 'open', test: { give: { wood: 200, stone: 200, fiber: 200, crystal: 5 } } });
f = await ana.farm({ t: 'claim', id: f.farm.mail.find(m => m.boost).id });
if (f.farm.tokens[bt] !== 1) fail('no booster token');
f = await ana.farm({ t: 'boost', type: bt });
if (!f.err) fail('a booster started with no building');
f = await ana.farm({ t: 'place', type: bt, x: 6, y: 6, r: 0 }); if (f.err) fail('building for the booster: ' + f.err);
f = await ana.farm({ t: 'boost', type: bt });
if (f.err || f.farm.tokens[bt] || !f.farm.buff[bt]) fail('the booster did not start: ' + f.err);
if (BOOSTS[bt].hours ? !(f.farm.buff[bt].left > (BOOSTS[bt].hours - .1) * 3600_000) : f.farm.buff[bt].uses !== BOOSTS[bt].uses) fail('booster length ' + JSON.stringify(f.farm.buff));
console.log('booster ok (' + bt + ')');

// 6. A lucky decoration: placed for free, one of each, comes back when put away, cannot be bought or gifted.
w = await ana.spin(at('decor'), { again: true });
const d1 = w.won.prize.item; if (!LUCKY.includes(d1) || w.lucky.length !== 1) fail('decor prize ' + JSON.stringify(w.won));
const other = LUCKY.find(t => t !== d1);
f = await ana.farm({ t: 'place', type: other, x: 8, y: 8, r: 0 });
if (!f.err) fail('a lucky decoration was placed without winning it');
f = await ana.farm({ t: 'open' });
f = await ana.farm({ t: 'claim', id: f.farm.mail.find(m => m.item).id });
if (f.farm.stash[d1] !== 1) fail('decoration not in the stash');
f = await ana.farm({ t: 'place', type: d1, x: 8, y: 0, r: 0 });
if (f.err || f.farm.stash[d1]) fail('placing the decoration: ' + f.err);
const placed = f.farm.items.find(i => i.type === d1);
f = await ana.farm({ t: 'remove', id: placed.id });
if (f.farm.stash[d1] !== 1) fail('putting it away lost it');
console.log('lucky decoration ok (' + d1 + ')');

// 7. Bad luck runs out, the set never repeats, and a full set pays coins.
w = await ana.spin(at('c20'), { again: true, dry: PITY });
if (!w.won.prize.item || w.won.prize.item === d1 || w.sure !== PITY) fail('the sure spin: ' + JSON.stringify(w.won));
for (let i = 2; i < LUCKY.length; i++) w = await ana.spin(at('decor'), { again: true });
if (new Set(w.lucky).size !== LUCKY.length) fail('the set repeated: ' + w.lucky);
const c1 = ana.me.coins;
w = await ana.spin(at('decor'), { again: true });
if (!w.won.prize.full || w.won.prize.coins !== SET_COINS) fail('full set ' + JSON.stringify(w.won));
await until(() => ana.me.coins === c1 + SET_COINS, 'set coins');
console.log('sure spin and full set ok');

// 8. A new day gives a new spin and a pet of the day; yesterday's result is gone. It all survives a restart.
const pet1 = w.pet;
ana.send({ t: 'daily', test: { skip: 1 } }); await wait(100);
w = await ana.wheel();
if (w.spun || w.last || w.day !== '2026-12-01' || w.pet === pet1) fail('new day ' + JSON.stringify(w));
w = await ana.spin(at('c40'));
if (w.won.prize.coins !== 40) fail('next day spin');
await wait(2500);
const token = ana.token, total = ana.me.coins; await stop(); await start();
const ana2 = await player('Ana', token).connect();
if (ana2.me.coins !== total) fail(`coins after restart: ${ana2.me.coins} vs ${total}`);
w = await ana2.wheel();
if (w.lucky.length !== LUCKY.length || w.n < 10) fail('wheel state lost in a restart ' + JSON.stringify(w));
console.log('new day and restart ok');

await stop();
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('wheel tests passed');
process.exit(0);

// Pet Farm cooking (2026-11-27): garden crops, oven slots and bake times, recipe cards, weather recipes, battle snacks,
// trip food, training food, the Love Muffin and favourite treats.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RECIPES, CROPS, CARDS, TREAT_LV, TRAIN_XP, favFood, FAV_FOODS, xpFor, snackFor } from '../public/games/farm/data.js';
const PORT = 20900 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, FARM_TEST: '1', GEO: 'off' }, stdio: ['ignore', process.env.DBG ? 'inherit' : 'ignore', 'inherit'] });
await wait(800);

const a = { last: null };
await new Promise(res => {
  const ws = a.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`); a.send = m => ws.send(JSON.stringify(m));
  ws.onopen = () => a.send({ t: 'hello', token: '', name: 'Cook', color: '#ff8fab' });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (process.env.DBG) console.log('<', m.t, m.err || m.did || '', m.msg || ''); if (m.t === 'welcome') res(); if (m.t === 'auth') a.auth = m; if (m.t === 'farm') { a.last = m; if (m.farm) a.farm = m.farm; } };
});
const go = async act => { await wait(15); a.last = null; a.send({ t: 'farm', a: act }); await until(() => a.last, act.t); return a.last; };
a.send({ t: 'register', user: 'cook' + (Math.random() * 1e6 | 0), pass: 'hunter22' }); await until(() => a.auth, 'register');
await go({ t: 'open', test: { weather: 'none' } });
await go({ t: 'starter', sp: 'cindercub' });
await go({ t: 'open', test: { give: { wood: 3000, stone: 3000, fiber: 900, shells: 300, coal: 300, crystal: 40 } } });
const spot = async type => { let q = { err: 1 }; for (let y = 0; y < 10 && q.err; y++) for (let x = 0; x < 10 && q.err; x++) { q = await go({ t: 'place', type, x, y, r: 0 }); await wait(60); } if (q.err) fail('no room for ' + type); return a.farm.items.filter(i => i.type === type).at(-1); };
const kitchen = await spot('kitchen'), plot = await spot('garden'); if (process.env.DBG) console.log(kitchen, plot);
let r;

// garden crops: seeds open with the farmhouse, a plot gives its own crop, only berry plots grow Sunberries
r = await go({ t: 'plant', id: plot.id, crop: 'herbs' }); if (!r.err) fail('herbs before farmhouse 2');
await go({ t: 'open', test: { house: 3 } });
r = await go({ t: 'plant', id: plot.id, crop: 'honey' }); if (r.err || a.farm.items.find(i => i.id === plot.id).crop !== 'honey') fail('plant honey ' + r.err);
a.send({ t: 'farm', a: { t: 'plant', id: plot.id, crop: 'nonsense' } }); await wait(300); await go({ t: 'open' }); if (a.farm.items.find(i => i.id === plot.id).crop !== 'honey') fail('odd crop planted');
await go({ t: 'open', test: { ripe: true } });
const h0 = a.farm.inv.honey || 0, b0 = a.farm.inv.berries || 0; r = await go({ t: 'pick' });
if (r.err || a.farm.inv.honey - h0 !== CROPS.honey.n || (a.farm.inv.berries || 0) !== b0 || !r.crops?.honey) fail('honey pick ' + JSON.stringify([r.err, r.crops, a.farm.inv.honey]));
r = await go({ t: 'plant', id: plot.id, crop: 'berries' }); if (a.farm.items.find(i => i.id === plot.id).crop) fail('berries should clear the crop');

// recipe cards: card recipes are locked until found
await go({ t: 'open', test: { give: { berries: 200, honey: 50, herbs: 50, chili: 50, sunberry: 50 } } });
r = await go({ t: 'cook', what: 'chilibite' }); if (!r.err) fail('cooked without the card');
await go({ t: 'open', test: { cards: 'all' } });
if (CARDS.some(k => !a.farm.cards.includes(k))) fail('cards hook');
r = await go({ t: 'cook', what: 'chilibite' }); if (r.err || a.farm.inv.chilibite !== 1) fail('chili bites ' + r.err);
r = await go({ t: 'cook', what: 'fizz' }); if (r.err || a.farm.inv.fizz !== 3) fail('fizz drops make three ' + a.farm.inv.fizz);
r = await go({ t: 'cook', what: 'picnic' }); if (!r.err) fail('picnic needs a level 2 Kitchen');
await go({ t: 'upgrade', id: kitchen.id });

// weather recipes only go in during their weather
await go({ t: 'open', test: { weather: 'rain' } }); r = await go({ t: 'cook', what: 'suntea' }); if (!r.err) fail('sun tea in the rain');
r = await go({ t: 'cook', what: 'soup' }); if (r.err || a.farm.inv.soup !== 1) fail('storm soup in the rain ' + r.err);
await go({ t: 'open', test: { weather: 'rainbow' } }); r = await go({ t: 'cook', what: 'rcake' }); if (r.err) fail('rainbow cake ' + r.err);
await go({ t: 'open', test: { weather: 'none' } });

// the real oven: a bake takes a slot and lands in the pantry when done; a level 2 Kitchen has two ovens
await go({ t: 'open', test: { oven: 'slow' } });
const c0 = a.farm.inv.cake || 0; r = await go({ t: 'cook', what: 'cake', n: 2 });
if (r.err || !r.oven || (a.farm.inv.cake || 0) !== c0 || a.farm.oven.bakes.length !== 1 || a.farm.oven.slots !== 2) fail('cake into the oven ' + JSON.stringify([r.err, a.farm.oven]));
if (Math.abs(a.farm.oven.bakes[0].left - RECIPES.cake.min * 2 * 60000) > 5000) fail('two cakes take twice as long ' + a.farm.oven.bakes[0].left);
r = await go({ t: 'cook', what: 'cookie' }); if (r.err || r.oven) fail('cookies are ready at once');
r = await go({ t: 'cook', what: 'picnic' }); if (r.err) fail('second oven ' + r.err);
r = await go({ t: 'cook', what: 'muffin' }); if (!r.err) fail('a third bake with two ovens');
r = await go({ t: 'open', test: { oven: 'done' } }); r = await go({ t: 'open' });
if ((a.farm.inv.cake || 0) !== c0 + 2 || !(a.farm.inv.picnic >= 1) || a.farm.oven.bakes.length) fail('bakes did not land ' + JSON.stringify(a.farm.oven));
await go({ t: 'open', test: { oven: 'fast' } });

// battle snacks: only matching pets get stronger, the snack is used up
if (!snackFor('chilibite', 'Ember') || snackFor('chilibite', 'Tide') || !snackFor('puff', 'Tide')) fail('snackFor');
await spot('yard');
const me = a.farm.pets[0];
const plain = (await go({ t: 'fight', mode: 'practice', pets: [me.id] })).battle; await go({ t: 'bact', flee: true });
await go({ t: 'open' });
r = await go({ t: 'fight', mode: 'practice', pets: [me.id], snack: 'chilibite' });
if (r.err || r.battle?.snack !== 'chilibite' || (a.farm.inv.chilibite || 0) !== 0) fail('chili bites in battle ' + JSON.stringify([r.err, r.battle?.snack, a.farm.inv.chilibite]));
const mine = r.battle.sides?.[0]?.pets?.[0] || r.battle.me?.[0]; if (mine && plain?.sides && mine.atk <= plain.sides[0].pets[0].atk) fail('the snack did not help');
await go({ t: 'bact', flee: true });
r = await go({ t: 'fight', mode: 'practice', pets: [me.id], snack: 'chilibite' }); if (!r.err) fail('a snack you do not have');

// favourite treats: twice the experience for a young pet, Happy for any pet; a grown-up pet tastes once
const fav = favFood(me.sp), other = FAV_FOODS.find(k => k !== fav);
await go({ t: 'open', test: { give: { [fav]: 2, [other]: 3 } } });
const xp0 = a.farm.pets[0].xp, lv0 = a.farm.pets[0].lv;
r = await go({ t: 'feed', what: fav, pet: me.id });
if (r.err || !r.fav || !(a.farm.pets[0].happy > 0) || !a.farm.tasted[me.sp].includes(fav)) fail('favourite ' + JSON.stringify([r.err, r.fav]));
if (a.farm.pets[0].lv === lv0 && a.farm.pets[0].xp - xp0 !== RECIPES[fav].xp * 2) fail('favourite should give double ' + (a.farm.pets[0].xp - xp0));
await go({ t: 'open', test: { pet: 'mossbun', traits: { lv: TREAT_LV + 1, xp: 0 } } });
const adult = a.farm.pets.at(-1), adultFav = favFood('mossbun'), adultOther = FAV_FOODS.find(k => k !== adultFav);
await go({ t: 'open', test: { give: { [adultFav]: 1, [adultOther]: 2 } } });
const n0 = a.farm.inv[adultOther]; r = await go({ t: 'feed', what: adultOther, pet: adult.id });
if (r.err || !r.wasted || a.farm.inv[adultOther] !== n0 - 1 || a.farm.pets.find(x => x.id === adult.id).xp) fail('an adult tastes a treat ' + JSON.stringify([r.err, r.wasted]));
r = await go({ t: 'feed', what: adultOther, pet: adult.id }); if (!r.err) fail('an adult ate a treat it already knows is not its favourite');
r = await go({ t: 'feed', what: adultFav, pet: adult.id }); if (r.err || !r.fav || !(a.farm.pets.find(x => x.id === adult.id).happy > 0) || a.farm.pets.find(x => x.id === adult.id).xp) fail('an adult enjoys its favourite ' + r.err);

// training food: only for a pet at the Training Yard, x times as fast for its hours
r = await go({ t: 'feed', what: 'soup', pet: adult.id }); if (!r.err) fail('soup for a pet that is not training');
await go({ t: 'train', pets: [adult.id] });
r = await go({ t: 'feed', what: 'soup', pet: adult.id }); if (r.err || !(a.farm.pets.find(x => x.id === adult.id).tx > 0)) fail('storm soup ' + r.err);
const ax = a.farm.pets.find(x => x.id === adult.id), before = ax.xp + xpFor(ax.lv) * 0; await go({ t: 'open', test: { trained: 2 } }); await go({ t: 'open' });
const after = a.farm.pets.find(x => x.id === adult.id); const gained = after.lv > ax.lv ? Infinity : after.xp - before;
if (gained < Math.round(2 * TRAIN_XP * 3 * 1.1) - 2) fail('soup should triple two hours of training ' + gained);

// trip food: one dish a party; the Rainbow Cake always brings a wild pet home
await spot('gate'); await spot('hut');
const pets0 = a.farm.pets.length;
r = await go({ t: 'send', zone: 'woods', trip: 'stroll', pets: [me.id], food: 'cookie' }); if (!r.err) fail('cookies are not trip food');
r = await go({ t: 'send', zone: 'woods', trip: 'stroll', pets: [me.id], food: 'rcake' }); if (r.err || (a.farm.inv.rcake || 0) !== 0) fail('send with rainbow cake ' + r.err);
await go({ t: 'open', test: { home: true } }); r = await go({ t: 'collect' });
if (r.err || r.back.food !== 'rcake' || !r.back.found || a.farm.pets.length !== pets0 + 1) fail('rainbow cake should bring a pet ' + JSON.stringify(r.back || r.err));

// the Love Muffin: the egg comes sooner
await spot('nest'); await go({ t: 'open', test: { lv: 6, rested: true, give: { muffin: 1 } } });
const [p1, p2] = a.farm.pets.filter(x => x.id !== adult.id);
r = await go({ t: 'pair', a: p1.id, b: p2.id, muffin: true });
if (r.err || (a.farm.inv.muffin || 0) !== 0) fail('pair with a muffin ' + r.err);

console.log('cooking ok');
srv.kill(); process.exit(0);

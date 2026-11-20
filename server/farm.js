// Pet Farm: the persistent game. Each account owns one farm, saved in its own file (pet-farm.json) so a
// problem here can never damage accounts or scoreboards. The client sends intents; every rule is checked here.
// Nothing ticks: timers are stored as times and worked out when the farm is next opened.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './store.js';
import { ITEMS, SIZES, EXPAND, START_INV, MAX_ITEMS, SPECIES, STARTERS, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, HOUSE_UP,
  xpFor, petRoom, tripLoot, formOf, fits, canAfford, countOf } from '../public/games/farm/data.js';

const FILE = path.join(DATA_DIR, 'pet-farm.json');
const farms = new Map(); // profile id -> farm
const rid = () => crypto.randomBytes(5).toString('hex');
const rnd = n => crypto.randomInt(n);

// ---------- load / save ----------
export function load() {
  let d;
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); return; }
  for (const [pid, f] of Object.entries(d.farms || {})) if (f && Array.isArray(f.items) && Array.isArray(f.pets)) farms.set(pid, f);
  console.log(`loaded ${farms.size} farms from ${FILE}`);
}
let timer = null, dirty = false, warned = false;
function scheduleSave() { dirty = true; if (!timer) timer = setTimeout(saveNow, 1500); }
export function saveNow() {
  clearTimeout(timer); timer = null;
  if (!dirty) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, saved: new Date().toISOString(), farms: Object.fromEntries(farms) }));
    fs.renameSync(tmp, FILE);
    dirty = false; warned = false;
  } catch (e) {
    if (!warned) console.error(`could not save to ${FILE}:`, e.message);
    warned = true;
  }
}

// ---------- pets ----------
// Every pet is rolled with its full set of traits from day one, so breeding has something to work with later.
function newPet(sp, owner) {
  return {
    id: rid(), sp, name: SPECIES[sp].name, lv: 1, xp: 0,
    col: [0, rnd(6)],                 // colour genes: shown, hidden
    pat: 0,                           // pattern
    stars: [1, 1, 1, 1].map(() => 2 + rnd(3)), // health, attack, defence, speed (1-5)
    talent: rnd(6), sparkle: false,
    first: owner, parents: null, born: Date.now(),
  };
}

// ---------- what the player sees ----------
const view = (f, p) => ({
  owner: p.name, size: f.size, items: f.items, inv: f.inv, pets: f.pets,
  first: !f.trips, // the first expedition always brings a wild pet home
  house: f.house || 1, houseNext: (f.house || 1) < HOUSE_MAX ? HOUSE_UP[(f.house || 1) + 1] : null, room: petRoom(f),
  // left: time until the party is back, in ms (the two clocks may differ, so no absolute times are sent)
  trip: f.trip ? { zone: f.trip.zone, trip: f.trip.trip, pets: f.trip.pets, left: Math.max(0, f.trip.until - Date.now()) } : null,
  next: SIZES.indexOf(f.size) + 1 < SIZES.length ? { size: SIZES[SIZES.indexOf(f.size) + 1], cost: EXPAND[SIZES.indexOf(f.size) + 1] } : null,
});

const pay = (inv, cost, sign = -1) => { for (const [k, n] of Object.entries(cost || {})) inv[k] = Math.max(0, (inv[k] || 0) + sign * n); };
const cleanPetName = s => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14);

// One request from a signed-in or guest player. reply(msg) sends back to that player only.
export function handle(p, a, reply) {
  if (!p || !a || typeof a !== 'object') return;
  if (!p.user) return reply({ t: 'farm', need: 'account' });
  const f = farms.get(p.pid);
  const ok = (extra = {}) => { scheduleSave(); reply({ t: 'farm', farm: view(f, p), ...extra }); };
  const no = msg => reply({ t: 'farm', err: msg, farm: f ? view(f, p) : null });

  if (a.t === 'open') return reply(f ? { t: 'farm', farm: view(f, p) } : { t: 'farm', need: 'starter' });
  if (a.t === 'starter') {
    if (f) return no('You already have a farm.');
    if (!STARTERS.includes(a.sp)) return;
    const nf = { v: 1, size: SIZES[0], nid: 2, items: [{ id: 1, type: 'house', x: 3, y: 1, r: 0 }], inv: { ...START_INV },
      pets: [newPet(a.sp, p.user)], house: 1, trip: null, trips: 0, created: Date.now() };
    farms.set(p.pid, nf); scheduleSave();
    return reply({ t: 'farm', farm: view(nf, p), did: 'starter' });
  }
  if (!f) return reply({ t: 'farm', need: 'starter' });

  if (a.t === 'place') {
    const it = ITEMS[a.type]; if (!it || it.fixed) return;
    if (f.items.length >= MAX_ITEMS) return no('The farm is full. Put something away first.');
    if (it.max && countOf(f, a.type) >= it.max) return no(`You can only have ${it.max} of those.`);
    if (!canAfford(f.inv, it.cost)) return no('Not enough materials for that.');
    if (!fits(f, a.type, a.x, a.y, a.r)) return no('That spot is taken.');
    pay(f.inv, it.cost);
    f.items.push({ id: f.nid++, type: a.type, x: a.x, y: a.y, r: a.r });
    return ok({ did: 'place' });
  }
  if (a.t === 'move') {
    const item = f.items.find(i => i.id === a.id); if (!item) return no('That is not on the farm any more.');
    if (!fits(f, item.type, a.x, a.y, a.r, item.id)) return no('That spot is taken.');
    Object.assign(item, { x: a.x, y: a.y, r: a.r });
    return ok({ did: 'move' });
  }
  if (a.t === 'remove') { // putting something away gives its materials back, so rearranging is free
    const i = f.items.findIndex(x => x.id === a.id); if (i < 0) return no('That is not on the farm any more.');
    const it = ITEMS[f.items[i].type];
    if (it.fixed) return no('The farmhouse stays, but you can move it.');
    pay(f.inv, it.cost, 1); f.items.splice(i, 1);
    return ok({ did: 'remove' });
  }
  if (a.t === 'expand') {
    const i = SIZES.indexOf(f.size) + 1; if (i >= SIZES.length) return no('The farm is as big as it gets.');
    if (!canAfford(f.inv, EXPAND[i])) return no('Not enough materials to grow the land.');
    pay(f.inv, EXPAND[i]);
    const grow = (SIZES[i] - f.size) / 2; // new land appears on every side
    for (const it of f.items) { it.x += grow; it.y += grow; }
    f.size = SIZES[i];
    return ok({ did: 'expand' });
  }
  if (a.t === 'houseup') {
    const lv = (f.house || 1) + 1; if (lv > HOUSE_MAX) return no('The farmhouse is as grand as it gets.');
    if (!canAfford(f.inv, HOUSE_UP[lv])) return no('Not enough materials to improve the farmhouse.');
    pay(f.inv, HOUSE_UP[lv]); f.house = lv;
    return ok({ did: 'houseup' });
  }
  if (a.t === 'send') { // a party sets off on an expedition
    const z = ZONES[a.zone], tr = TRIPS[a.trip];
    if (!z || !tr || !Array.isArray(a.pets)) return;
    if (!countOf(f, 'gate')) return no('Build an Expedition Gate first.');
    if (f.trip) return no('Your pets are already out exploring.');
    if ((f.house || 1) < z.house) return no(`${z.name} opens at farmhouse level ${z.house}.`);
    const ids = [...new Set(a.pets)];
    if (!ids.length || ids.length > PARTY || ids.length !== a.pets.length || !ids.every(id => f.pets.some(x => x.id === id))) return no('Pick one to three of your pets.');
    f.trip = { zone: a.zone, trip: a.trip, pets: ids, at: Date.now(), until: Date.now() + tr.min * 60_000 };
    return ok({ did: 'send' });
  }
  if (a.t === 'collect') { // the party is back: unpack what it found
    const t = f.trip; if (!t) return no('Nobody is out exploring.');
    if (Date.now() < t.until) return no('They are not back yet.');
    const party = f.pets.filter(x => t.pets.includes(x.id)), z = ZONES[t.zone], tr = TRIPS[t.trip];
    const loot = {};
    for (const [k, n] of Object.entries(tripLoot(t.zone, t.trip, party))) {
      const v = n * (.85 + Math.random() * .3), whole = Math.floor(v) + (Math.random() < v % 1 ? 1 : 0); // a fraction is a chance of one more
      if (whole > 0) loot[k] = whole;
    }
    pay(f.inv, loot, 1);
    const grew = [];
    for (const pet of party) {
      const before = pet.lv; pet.xp += tr.xp;
      while (pet.lv < MAX_LV && pet.xp >= xpFor(pet.lv)) { pet.xp -= xpFor(pet.lv); pet.lv++; }
      if (pet.lv >= MAX_LV) pet.xp = 0;
      if (pet.lv > before) grew.push({ id: pet.id, lv: pet.lv, form: formOf(pet.lv) > formOf(before) ? formOf(pet.lv) : 0 });
    }
    // a wild pet may follow them home, if there is a bed for it. The very first trip always brings one.
    let found = null, full = false;
    if (!f.trips || Math.random() < tr.find) {
      if (f.pets.length >= petRoom(f)) full = true;
      else {
        const bag = Object.entries(z.wild); let roll = Math.random() * bag.reduce((n, [, w]) => n + w, 0);
        const sp = (bag.find(([, w]) => (roll -= w) < 0) || bag[0])[0];
        found = newPet(sp, p.user); found.from = t.zone; f.pets.push(found);
      }
    }
    f.trip = null; f.trips = (f.trips || 0) + 1;
    return ok({ did: 'collect', back: { zone: t.zone, trip: t.trip, pets: t.pets, loot, xp: tr.xp, grew, found: found?.id || null, full } });
  }
  if (a.t === 'petname') {
    const pet = f.pets.find(x => x.id === a.id), name = cleanPetName(a.name);
    if (!pet || !name) return;
    pet.name = name;
    return ok({ did: 'petname' });
  }
}

// Test hooks, only when FARM_TEST is set: bring the party home at once, or hand out materials.
export function testHook(pid, a) {
  const f = farms.get(pid); if (!f || !process.env.FARM_TEST || !a) return;
  if (a.home && f.trip) f.trip.until = 0;
  if (a.give) for (const [k, n] of Object.entries(a.give)) f.inv[k] = (f.inv[k] || 0) + n;
  if (a.trips !== undefined) f.trips = a.trips;
}

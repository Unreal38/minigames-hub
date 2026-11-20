// Pet Farm: the persistent game. Each account owns one farm, saved in its own file (pet-farm.json) so a
// problem here can never damage accounts or scoreboards. The client sends intents; every rule is checked here.
// Nothing ticks: timers are stored as times and worked out when the farm is next opened.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './store.js';
import { ITEMS, SIZES, EXPAND, START_INV, CRATE, MAX_ITEMS, SPECIES, STARTERS, fits, canAfford, countOf } from '../public/games/farm/data.js';

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
  crateIn: Math.max(0, (f.crateAt || 0) - Date.now()),
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
      pets: [newPet(a.sp, p.user)], crateAt: Date.now() + CRATE.every, created: Date.now() };
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
  if (a.t === 'crate') {
    if (Date.now() < (f.crateAt || 0)) return no('The next crate is not here yet.');
    pay(f.inv, CRATE.gives, 1); f.crateAt = Date.now() + CRATE.every;
    return ok({ did: 'crate', got: CRATE.gives });
  }
  if (a.t === 'petname') {
    const pet = f.pets.find(x => x.id === a.id), name = cleanPetName(a.name);
    if (!pet || !name) return;
    pet.name = name;
    return ok({ did: 'petname' });
  }
}

// Test hook: lets the test suite skip the crate wait. Only works when FARM_TEST is set.
export function testSkipCrate(pid) { const f = farms.get(pid); if (f && process.env.FARM_TEST) f.crateAt = 0; }

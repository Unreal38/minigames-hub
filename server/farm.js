// Pet Farm: the persistent game. Each account owns one farm, saved in its own file (pet-farm.json) so a
// problem here can never damage accounts or scoreboards. The client sends intents; every rule is checked here.
// Nothing ticks: timers are stored as times and worked out when the farm is next opened.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, profiles, friendPids } from './store.js';
import { ITEMS, SIZES, EXPAND, START_INV, MAX_ITEMS, SPECIES, STARTERS, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, HOUSE_UP,
  xpFor, petRoom, tripLoot, formOf, fits, canAfford, countOf, costText, GIFTS, MATS,
  BERRIES, RECIPES, STORED, capOf, SELL, SELL_LOT, UPGRADES, UP_MAX, lvOf, topLv, upCost, growMin, TRAIN_XP, palsOf } from '../public/games/farm/data.js';
import { unit as rawUnit, newBattle, step, pickMove, TURN_S } from '../public/games/farm/battle.js';
import { lookOf, makeBaby, snapshot, shellOf, hatchHours, BREED_LV, CUDDLE_H, REST_H, PATTERNS, TALENTS } from '../public/games/farm/breed.js';

const unit = (pet, lv) => rawUnit({ ...pet, look: lookOf(pet) }, lv); // battles show each pet as it really looks

const FILE = path.join(DATA_DIR, 'pet-farm.json');
const farms = new Map(); // profile id -> farm
const rid = () => crypto.randomBytes(5).toString('hex');
const rnd = n => crypto.randomInt(n);

// ---------- load / save ----------
export function load() {
  let d;
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); return; }
  for (const [pid, f] of Object.entries(d.farms || {})) if (f && Array.isArray(f.items) && Array.isArray(f.pets)) { f.pets.forEach(fixPet); farms.set(pid, f); }
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
function newPet(sp, owner, wild = false) {
  const pet = {
    id: rid(), sp, name: SPECIES[sp].name, lv: 1, xp: 0,
    col: [wild && Math.random() < .1 ? rnd(6) : 0, rnd(6)].sort((a, b) => a - b), // colour genes: the first one shows
    pat: wild && Math.random() < .2 ? [Object.keys(PATTERNS)[rnd(4)]] : [],      // markings
    stars: [1, 1, 1, 1].map(() => 2 + rnd(3)), // health, attack, defence, speed (1-5)
    talent: process.env.FARM_TEST ? 2 : rnd(TALENTS.length), sparkle: wild && Math.random() < 1 / 64, // tests need pets that all learn at the same pace
    first: owner, born: Date.now(),
  };
  return pet;
}
// Pets saved by older versions: markings were a number, colour genes were not in showing order.
function fixPet(x) {
  if (!Array.isArray(x.pat)) x.pat = [];
  x.col = Array.isArray(x.col) ? [x.col[0] | 0, x.col[1] | 0].sort((a, b) => a - b) : [0, 0];
  if (!Array.isArray(x.stars)) x.stars = [3, 3, 3, 3];
  x.talent = (x.talent | 0) % TALENTS.length;
}
// A pet as its owner sees it. The hidden colour gene only shows once the pet has had two babies.
const HOUR = 3_600_000;
const petView = x => ({ ...x, look: lookOf(x), col: (x.kids || 0) >= 2 ? x.col : [x.col[0]], rest: Math.max(0, (x.rest || 0) - Date.now()) });
// The Nest: two pets cuddle, then an egg sits until it hatches. Times are worked out from when it started.
function nestView(f) {
  const n = f.nest; if (!n) return null;
  const now = Date.now(), egg = n.at + CUDDLE_H * HOUR, done = egg + n.hours * HOUR;
  return { a: n.a, b: n.b, friend: n.friend || null, shell: n.shell, stage: now < egg ? 'cuddle' : now < done ? 'egg' : 'ready', left: Math.max(0, (now < egg ? egg : done) - now), cheers: n.cheers || 0 };
}

// Adds experience. Returns { id, lv, form } if the pet went up a level (form is set when it grew into a new one).
function learn(pet, xp) {
  const before = pet.lv; pet.xp += xp;
  if (pet.talent === 3) pet.xp += Math.ceil(xp * .1);
  while (pet.lv < MAX_LV && pet.xp >= xpFor(pet.lv)) { pet.xp -= xpFor(pet.lv); pet.lv++; }
  if (pet.lv >= MAX_LV) pet.xp = 0;
  return pet.lv > before ? { id: pet.id, lv: pet.lv, form: formOf(pet.lv) > formOf(before) ? formOf(pet.lv) : 0 } : null;
}

// ---------- battles ----------
// A battle lives in memory only. If the server restarts mid-fight it is simply gone, and nothing was at stake yet.
const battles = new Map(); // profile id -> battle
const ARENA_LV = 20, DAILY = { arena: 5, practice: 3 };
const WIN = { arena: { coins: 25, xp: 20, pts: 10 }, practice: { coins: 0, xp: 12, pts: 0 } };
const LOSE = { arena: { coins: 5, xp: 8, pts: 2 }, practice: { coins: 0, xp: 5, pts: 0 } };
const today = () => new Date().toISOString().slice(0, 10);
const used = (f, mode) => f.fights?.day === today() ? f.fights[mode] || 0 : 0;
// Three neighbours who are always up for a match, so the arena works before friends join.
const NPCS = {
  hazel: { name: 'Farmer Hazel', pts: 40, team: ['mossbun', 'sproutle', 'petalpuff'] },
  bruno: { name: 'Bruno', pts: 90, team: ['pebblet', 'toastoad', 'puddlepup'] },
  mira: { name: 'Mira', pts: 150, team: ['zapkit', 'axolily', 'flickit'] },
};
const bot = (sp, lv, i) => ({ id: 'bot' + i, sp, name: SPECIES[sp].name, lv, stars: [3, 3, 3, 3] });
// The team that defends a farm: the one its owner chose, or the three highest levels.
function defenders(f) {
  const picked = (f.def || []).map(id => f.pets.find(p => p.id === id)).filter(Boolean);
  return (picked.length ? picked : [...f.pets].sort((a, b) => b.lv - a.lv)).slice(0, PARTY);
}
const nameOf = (pid, f) => f.name || profiles.get(pid)?.name || 'A farmer'; // farms saved before names were kept fall back to the profile
const fid = f => f.fid ||= rid(); // a farm's public name tag, so profile ids never leave the server
function foes(mine) {
  const out = Object.entries(NPCS).map(([k, n]) => ({ id: 'npc:' + k, name: n.name, pts: n.pts, npc: true, team: n.team.map(sp => ({ sp, lv: ARENA_LV })) }));
  for (const [pid, f] of farms) if (f !== mine && f.pets.length) out.push({ id: fid(f), name: nameOf(pid, f), pts: f.pts || 0, team: defenders(f).map(p => ({ sp: p.sp, lv: p.lv, name: p.name })) });
  return out.sort((a, b) => b.pts - a.pts);
}
// What the player may see of a fight: everything about their own side, and the other side's faces and health.
const battleView = B => ({ juiced: !!B.juiced, mode: B.mode, foe: B.foe, turn: B.turn, need: B.need, over: B.over,
  sides: B.sides.map(s => ({ on: s.on, pets: s.pets.map(u => ({ id: u.id, sp: u.sp, name: u.name, el: u.el, lv: u.lv, form: u.form, look: u.look, hp: u.hp, max: u.max, moves: u.moves, cd: u.cd, up: u.up, status: u.status })) })) });

// ---------- live battles ----------
// Two players who are both here fight each other with the same rules. Each has 30 seconds to choose; a player
// who runs out of time gets the game's pick. The server reaches the other player through push().
let push = () => 0;
export const setPush = fn => { push = fn; };
const lives = new Map(), invites = new Map(); // profile id -> live battle; invite id -> { from, to, pets, at }
const TURN_MS = TURN_S * 1000, INVITE_MS = 60_000, LIVE = { win: { coins: 15, xp: 15 }, lose: { coins: 5, xp: 8 } };
const flipEv = ev => ev.map(e => ({ ...e, ...(e.s !== undefined ? { s: 1 - e.s } : {}), ...(e.win !== undefined ? { win: 1 - e.win } : {}) }));
function liveView(L, i) {
  const v = battleView(L.B); if (i) { v.sides.reverse(); if (v.over !== null) v.over = 1 - v.over; }
  return { ...v, mode: 'live', foe: L.names[1 - i], live: true, waiting: !!L.acts[i], left: Math.max(0, L.deadline - Date.now()) };
}
function liveArm(L) { clearTimeout(L.timer); L.deadline = Date.now() + TURN_MS; L.timer = setTimeout(() => liveTurn(L), TURN_MS + 400); }
function liveTurn(L, quit = null) { // both have chosen, time ran out, or someone left
  clearTimeout(L.timer);
  const B = L.B; let ev;
  if (quit !== null) { B.over = 1 - quit; ev = [{ k: 'end', win: 1 - quit, quit: true }]; }
  else { ev = step(B, L.acts[0] || pickMove(B, 0), Math.random, L.acts[1]) || step(B, pickMove(B, 0), Math.random, L.acts[1]) || []; }
  L.acts = [null, null];
  if (B.over === null) liveArm(L);
  L.pids.forEach((pid, i) => {
    const f = farms.get(pid), msg = { t: 'farm', battle: liveView(L, i), ev: i ? flipEv(ev) : ev };
    if (B.over !== null) {
      lives.delete(pid);
      const won = B.over === i, left = quit === i, r = won ? LIVE.win : LIVE.lose, prize = { won, coins: 0, xp: 0, pts: 0, grew: [], counted: !left };
      if (f && !left) { prize.coins = r.coins; prize.xp = r.xp; f.inv.coins = (f.inv.coins || 0) + r.coins; for (const id of L.ids[i]) { const pet = f.pets.find(x => x.id === id), g = pet && learn(pet, r.xp); if (g) prize.grew.push(g); } }
      Object.assign(msg, { prize, did: 'fought', farm: f ? view(f, profiles.get(pid)) : null });
      if (quit !== null) msg.ev = msg.ev.map(e => ({ ...e, quit: left })); // only the one who left sees "you left"
    }
    push(pid, msg);
  });
  if (B.over !== null) scheduleSave();
}

// ---------- neighbours: the world map, visiting, helping, gifts, mail ----------
const HELPS = 5, HELP_CUT = 10 * 60_000, MAIL_MAX = 30;
const byFid = id => [...farms].find(([, x]) => x.fid === id);
// A player's farm tag, for the hub's friends list (null if they have not started a farm).
export const fidOf = pid => { const f = farms.get(pid); return f?.pets.length ? fid(f) : null; };
const daily = (f, key) => { if (f.social?.day !== today()) f.social = { day: today(), help: {}, gift: {} }; return f.social[key] ||= {}; };
function post(f, m) { (f.mail ||= []).unshift({ id: rid(), at: Date.now(), ...m }); f.mail.length = Math.min(f.mail.length, MAIL_MAX); }
// Remembers every species and form this farm has ever owned.
function album(f) {
  f.album ||= {};
  f.coats ||= []; f.marks ||= [];
  for (const x of f.pets) {
    const a = f.album[x.sp] ||= [0, 0, 0]; a[formOf(x.lv)] = 1;
    if (!f.coats.includes(x.col[0])) f.coats.push(x.col[0]);
    for (const k of x.pat) if (!f.marks.includes(k)) f.marks.push(k);
  }
  return f.album;
}
// A farm as its neighbours see it. Nothing here can be changed by the viewer.
const look = (pid, f) => { const pr = profiles.get(pid); return { id: fid(f), name: nameOf(pid, f), color: pr?.color, av: pr?.av, size: f.size, house: f.house || 1, pts: f.pts || 0,
  items: f.items.map(i => ({ id: i.id, type: i.type, x: i.x, y: i.y, r: i.r })) }; };

// ---------- trading ----------
// An offer lives on the sender's farm. What they offer is set aside at once (materials leave the stock, pets are
// marked as promised) and comes back if the offer is declined, cancelled or a week old.
const TRADE_MS = 7 * 24 * HOUR, TRADE_OPEN = 5, TRADE_PETS = 3;
const cuddling = (f, id) => !!f.nest && nestView(f).stage === 'cuddle' && (f.nest.a === id || f.nest.b === id);
const tradable = (f, x) => !x.held && f.pets.length > 1 && !(f.trip?.until > Date.now() && f.trip.pets.includes(x.id)) && !cuddling(f, x.id) && !(f.def || []).includes(x.id);
const cleanMats = m => { const out = {}; for (const [k, n] of Object.entries(m && typeof m === 'object' ? m : {})) if (MATS[k] && Number.isInteger(n) && n > 0 && n <= 9999) out[k] = n; return out; };
const cleanIds = a => Array.isArray(a) ? [...new Set(a.map(String))].slice(0, TRADE_PETS) : [];
function release(f, o) { // hand back what an offer was holding
  pay(f.inv, o.give.mats, 1);
  for (const x of f.pets) if (x.held === o.id) delete x.held;
  f.offers.splice(f.offers.indexOf(o), 1);
}
function sweep(f) { for (const o of [...(f.offers || [])]) if (Date.now() - o.at > TRADE_MS || !farms.has(o.to)) release(f, o); }
const tiny = x => x ? { id: x.id, sp: x.sp, name: x.name, lv: x.lv, look: lookOf(x) } : null;
function tradesView(pid, f) {
  const card = (o, dir, from, to, otherPid, other) => ({ id: o.id, dir, who: nameOf(otherPid, other), fid: fid(other), left: Math.max(0, o.at + TRADE_MS - Date.now()),
    give: { pets: o.give.pets.map(id => tiny(from.pets.find(x => x.id === id))).filter(Boolean), mats: o.give.mats },
    want: { pets: o.want.pets.map(id => tiny(to.pets.find(x => x.id === id))), mats: o.want.mats } });
  const out = [];
  for (const [spid, x] of farms) { sweep(x); for (const o of x.offers || []) { if (x === f) out.push(card(o, 'out', f, farms.get(o.to), o.to, farms.get(o.to))); else if (o.to === pid) out.push(card(o, 'in', x, f, spid, x)); } }
  return out;
}

// ---------- what the player sees ----------
// Gardens ripen on their own. A plot with no time on it (built before berries existed) is ripe straight away.
const ripeIn = it => Math.max(0, (it.at || 0) + growMin(it) * 60_000 - Date.now());
const gardenView = f => { const g = f.items.filter(i => i.type === 'garden'), wait = g.map(ripeIn).filter(n => n > 0);
  return { ripe: g.length - wait.length, left: wait.length ? Math.min(...wait) : 0 }; };
// Materials going into storage stop at the cap. Returns how many fitted. Never takes anything away.
function store(f, k, n) { const room = STORED.includes(k) ? Math.max(0, capOf(f) - (f.inv[k] || 0)) : Infinity, got = Math.min(n, room); f.inv[k] = (f.inv[k] || 0) + got; return got; }
// Pets at the Training Yard earn a little experience for every full hour, worked out when the farm is next used.
function trainTick(f) {
  const t = f.train; if (!t?.ids.length) return;
  const hours = Math.floor((Date.now() - t.at) / HOUR); if (hours < 1) return;
  t.at += hours * HOUR; t.ids = t.ids.filter(id => f.pets.some(x => x.id === id));
  for (const id of t.ids) { const pet = f.pets.find(x => x.id === id); if (!(f.trip && f.trip.pets.includes(id))) learn(pet, hours * TRAIN_XP); }
  scheduleSave();
}
const view = (f, p) => ({
  garden: gardenView(f), cap: capOf(f), palpts: palsOf(f),
  train: { ids: f.train?.ids || [], slots: topLv(f, 'yard'), left: f.train?.ids.length ? Math.max(0, f.train.at + HOUR - Date.now()) : 0 },
  owner: p.name, size: f.size, items: f.items, inv: f.inv, pets: f.pets.map(petView), nest: nestView(f),
  pts: f.pts || 0, def: defenders(f).map(x => x.id), fights: { arena: DAILY.arena - used(f, 'arena'), practice: DAILY.practice - used(f, 'practice') },
  album: album(f), coats: f.coats, marks: f.marks, mail: f.mail || [], pals: f.pals || {}, trades: tradesView(p.pid, f),
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

  if (f) { f.name = p.name; f.seen = Date.now(); trainTick(f); } // remembered so other players can see whose farm it is
  if (a.t === 'open') return reply(f ? { t: 'farm', farm: view(f, p), battle: lives.has(p.pid) ? liveView(lives.get(p.pid), lives.get(p.pid).pids.indexOf(p.pid)) : battles.has(p.pid) ? battleView(battles.get(p.pid)) : null } : { t: 'farm', need: 'starter' });
  if (a.t === 'starter') {
    if (f) return no('You already have a farm.');
    if (!STARTERS.includes(a.sp)) return;
    const nf = { v: 1, size: SIZES[0], nid: 2, items: [{ id: 1, type: 'house', x: 3, y: 1, r: 0 }], inv: { ...START_INV },
      name: p.name, pets: [newPet(a.sp, p.user)], house: 1, trip: null, trips: 0, created: Date.now() };
    farms.set(p.pid, nf); scheduleSave();
    return reply({ t: 'farm', farm: view(nf, p), did: 'starter' });
  }
  if (!f) return reply({ t: 'farm', need: 'starter' });

  if (a.t === 'place') {
    const it = ITEMS[a.type]; if (!it || it.fixed) return;
    if (f.items.length >= MAX_ITEMS) return no('The farm is full. Put something away first.');
    if (it.max && countOf(f, a.type) >= it.max) return no(`You can only have ${it.max} of those.`);
    if (!canAfford(f.inv, it.cost)) return no('Not enough materials for that.');
    if (it.craft && !countOf(f, 'workshop')) return no('Build a Workshop first.');
    if (it.pals && palsOf(f) < it.pals) return no(`That needs ${it.pals} friendship points. Help out and leave gifts to earn them.`);
    if (!fits(f, a.type, a.x, a.y, a.r)) return no('That spot is taken.');
    pay(f.inv, it.cost);
    f.items.push({ id: f.nid++, type: a.type, x: a.x, y: a.y, r: a.r, ...(a.type === 'garden' ? { at: Date.now() } : {}) });
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
    if (f.items[i].type === 'nest' && f.nest) return no('The Nest is in use right now.');
    if (f.items[i].type === 'gate' && f.trip) return no('Your pets are still out exploring.');
    pay(f.inv, it.cost, 1); for (let n = 1; n < lvOf(f.items[i]); n++) pay(f.inv, UPGRADES[f.items[i].type].cost[n - 1], 1); // improvements come back too
    f.items.splice(i, 1);
    if (f.train) f.train.ids = f.train.ids.slice(0, topLv(f, 'yard'));
    return ok({ did: 'remove', got: Object.keys(it.cost).length ? costText(it.cost) : '' });
  }
  if (a.t === 'upgrade') { // improve one building by a level
    const item = f.items.find(i => i.id === a.id), cost = item && upCost(item); if (!item) return no('That is not on the farm any more.');
    if (!cost || lvOf(item) >= UP_MAX) return no('That is as good as it gets.');
    if ((f.house || 1) < lvOf(item) + 1) return no(`Level ${lvOf(item) + 1} needs a level ${lvOf(item) + 1} farmhouse.`);
    if (!canAfford(f.inv, cost)) return no('Not enough materials for that yet.');
    pay(f.inv, cost); item.lv = lvOf(item) + 1;
    return ok({ did: 'upgrade', id: item.id });
  }
  if (a.t === 'train') { // choose who trains at the Training Yard: slow experience every hour
    const slots = topLv(f, 'yard'); if (!slots) return no('Build a Training Yard first.');
    const ids = cleanIds(a.pets).slice(0, slots); if (ids.some(id => !f.pets.some(x => x.id === id))) return;
    f.train = { ids, at: Date.now() };
    return ok({ did: 'train' });
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
    const ids = [...new Set(a.pets)];
    if (nestView(f)?.stage === 'cuddle' && ids.some(id => id === f.nest.a || id === f.nest.b)) return no('One of them is cuddling in the Nest.');
    if (f.trip) return no('Your pets are already out exploring.');
    if (f.pets.some(x => x.held && ids.includes(x.id))) return no('One of them is promised in a trade.');
    if ((f.house || 1) < z.house) return no(`${z.name} opens at farmhouse level ${z.house}.`);
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
      const v = n * (1 + .15 * Math.max(0, topLv(f, 'gate') - 1)) * (.85 + Math.random() * .3) * (party.some(x => x.talent === 1) ? 1.1 : 1), whole = Math.floor(v) + (Math.random() < v % 1 ? 1 : 0); // a fraction is a chance of one more
      if (whole > 0) loot[k] = whole;
    }
    let spilt = false;
    for (const [k, n] of Object.entries(loot)) if (store(f, k, n) < n) spilt = true; // storage is full: the rest is left behind
    const grew = [];
    for (const pet of party) { const g = learn(pet, tr.xp); if (g) grew.push(g); }
    // a wild pet may follow them home, if there is a bed for it. The very first trip always brings one.
    let found = null, full = false;
    if (!f.trips || Math.random() < tr.find + (party.some(x => x.talent === 4) ? .08 : 0)) {
      if (f.pets.length >= petRoom(f)) full = true;
      else {
        const bag = Object.entries(z.wild); let roll = Math.random() * bag.reduce((n, [, w]) => n + w, 0);
        const sp = (bag.find(([, w]) => (roll -= w) < 0) || bag[0])[0];
        found = newPet(sp, p.user, true); found.from = t.zone; f.pets.push(found);
      }
    }
    f.trip = null; f.trips = (f.trips || 0) + 1;
    return ok({ did: 'collect', back: { zone: t.zone, trip: t.trip, pets: t.pets, loot, xp: tr.xp, grew, found: found?.id || null, full, spilt } });
  }
  if (a.t === 'pick') { // gather every ripe Garden Plot; each starts growing again
    const ripe = f.items.filter(i => i.type === 'garden' && !ripeIn(i)); if (!ripe.length) return no('Nothing is ripe yet.');
    const got = store(f, 'berries', ripe.length * BERRIES); if (!got) return no('There is no room for more berries. Cook some, or build a Storage Barn.');
    for (const i of ripe) i.at = Date.now();
    return ok({ did: 'pick', got });
  }
  if (a.t === 'cook') {
    const r = RECIPES[a.what]; if (!r) return;
    if (!countOf(f, 'kitchen')) return no('Build a Kitchen first.');
    if (!canAfford(f.inv, r.cost)) return no('Not enough for that recipe yet.');
    pay(f.inv, r.cost); f.inv[a.what] = (f.inv[a.what] || 0) + 1;
    return ok({ did: 'cook', what: a.what });
  }
  if (a.t === 'feed') { // a treat for one pet: experience straight away
    const r = RECIPES[a.what], pet = f.pets.find(x => x.id === a.pet); if (!r?.xp || !pet) return;
    if (!(f.inv[a.what] > 0)) return no('You have none of those left.');
    if (pet.lv >= MAX_LV) return no(`${pet.name} is fully grown and just wants cuddles.`);
    if (f.trip?.until > Date.now() && f.trip.pets.includes(pet.id)) return no(`${pet.name} is away exploring.`);
    f.inv[a.what]--;
    return ok({ did: 'feed', what: a.what, pet: pet.id, grew: learn(pet, r.xp) });
  }
  if (a.t === 'sell') { // the Workshop buys spare materials in lots of ten
    const lots = Math.max(1, Math.min(50, a.lots | 0)), price = SELL[a.mat]; if (!price) return;
    if (!countOf(f, 'workshop')) return no('Build a Workshop first.');
    if ((f.inv[a.mat] || 0) < lots * SELL_LOT) return no('You do not have that many to sell.');
    f.inv[a.mat] -= lots * SELL_LOT; f.inv.coins = (f.inv.coins || 0) + lots * price;
    return ok({ did: 'sell', coins: lots * price });
  }
  if (a.t === 'pair') { // two pets go to the Nest; b may be a friend's pet that is open for playdates
    if (!countOf(f, 'nest')) return no('Build a Nest first.');
    if (f.nest) return no('The Nest is busy.');
    const A = f.pets.find(x => x.id === a.a); let Bp, friend = null, host = null;
    if (a.friend) {
      const hit = byFid(a.friend); if (!hit || hit[1] === f) return no('That farm is not around any more.');
      host = hit[1]; Bp = host.pets.find(x => x.id === a.b && x.open);
      if (!Bp) return no('That pet is not open for playdates.');
      const d = daily(f, 'date'); if (d[a.friend]) return no('One playdate a day with each friend.');
      d[a.friend] = 1; friend = { id: a.friend, name: nameOf(hit[0], host) };
    } else Bp = f.pets.find(x => x.id === a.b);
    if (!A || !Bp || A === Bp) return no('Pick two different pets.');
    if (A.held || (!friend && Bp.held)) return no('One of them is promised in a trade.');
    if (A.lv < BREED_LV || Bp.lv < BREED_LV) return no(`Both pets need to be level ${BREED_LV} or higher.`);
    const now = Date.now();
    if ((A.rest || 0) > now || (!friend && (Bp.rest || 0) > now)) return no('One of them is still resting.');
    if (f.trip?.until > now && [A.id, Bp.id].some(id => f.trip.pets.includes(id))) return no('One of them is away exploring.');
    const kid = makeBaby(A, Bp);
    kid.par = [A, Bp].map((x, i) => ({ ...snapshot(x, i && friend ? friend.name : p.name), par: (x.par || []).map(g => ({ name: g.name, sp: g.sp, lv: g.lv, look: g.look, own: g.own })) }));
    f.nest = { a: A.id, b: friend ? snapshot(Bp, friend.name) : Bp.id, friend, at: now, hours: hatchHours(kid.sp) * (1 - .25 * Math.max(0, topLv(f, 'nest') - 1)), shell: shellOf(A, Bp), kid };
    const rest = x => { x.rest = now + (CUDDLE_H + REST_H * (x.talent === 5 ? .5 : 1)) * HOUR; x.kids = (x.kids || 0) + 1; };
    rest(A); if (!friend) rest(Bp);
    if (host) { // the friend's pet never leaves home; its owner gets a thank-you and a new album entry
      host.album ||= {}; host.album[kid.sp] ||= [0, 0, 0];
      post(host, { k: 'date', from: p.name, pet: Bp.name, got: { coins: 15 } });
      f.pals ||= {}; f.pals[a.friend] = (f.pals[a.friend] || 0) + 1;
    }
    return ok({ did: 'pair' });
  }
  if (a.t === 'hatch') {
    const v = nestView(f); if (!v) return no('There is no egg.');
    if (v.stage !== 'ready') return no('The egg is not ready yet.');
    if (f.pets.length >= petRoom(f)) return no('There is no bed for the baby. Build a Pet Hut first.');
    const kid = { id: rid(), name: SPECIES[f.nest.kid.sp].name, ...f.nest.kid, first: p.user, born: Date.now(), bred: true };
    f.pets.push(kid); f.nest = null;
    return ok({ did: 'hatch', born: kid.id });
  }
  if (a.t === 'petopen') { // let visiting friends pick this pet for a playdate (up to three)
    const pet = f.pets.find(x => x.id === a.id); if (!pet) return;
    if (!pet.open && pet.lv < BREED_LV) return no(`It needs to be level ${BREED_LV} first.`);
    if (!pet.open && f.pets.filter(x => x.open).length >= 3) return no('Three pets can be open for playdates at once.');
    pet.open = !pet.open;
    return ok({ did: 'petopen' });
  }
  if (a.t === 'offer') { // propose a swap to another farm
    const hit = byFid(a.to); if (!hit || hit[1] === f) return no('That farm is not around any more.');
    const [tpid, x] = hit, give = { pets: cleanIds(a.give?.pets), mats: cleanMats(a.give?.mats) }, want = { pets: cleanIds(a.want?.pets), mats: cleanMats(a.want?.mats) };
    if (!give.pets.length && !want.pets.length && !Object.keys(give.mats).length && !Object.keys(want.mats).length) return no('Put something in the offer first.');
    if ((f.offers || []).length >= TRADE_OPEN) return no('You have five offers waiting already.');
    if ((f.offers || []).some(o => o.to === tpid)) return no('You already have an offer waiting with them.');
    const mine = give.pets.map(id => f.pets.find(q => q.id === id));
    if (mine.some(q => !q || !tradable(f, q)) || f.pets.length - mine.length < 1) return no('One of those pets cannot be traded right now.');
    if (want.pets.some(id => { const q = x.pets.find(y => y.id === id); return !q || !tradable(x, q); })) return no('One of their pets cannot be traded right now.');
    if (!canAfford(f.inv, give.mats)) return no('You do not have that much to offer.');
    const o = { id: rid(), to: tpid, give, want, at: Date.now() };
    pay(f.inv, give.mats); for (const q of mine) { q.held = o.id; q.open = false; }
    (f.offers ||= []).push(o);
    post(x, { k: 'note', text: `${p.name} sent you a trade offer.` });
    return ok({ did: 'offer' });
  }
  if (a.t === 'tradecancel') {
    const o = (f.offers || []).find(q => q.id === a.id); if (!o) return no('That offer is gone.');
    release(f, o);
    return ok({ did: 'tradecancel' });
  }
  if (a.t === 'tradeans') { // accept or decline an offer made to me
    let from = null, o = null, fpid = null;
    for (const [spid, x] of farms) { const q = (x.offers || []).find(y => y.id === a.id && y.to === p.pid); if (q) { from = x; o = q; fpid = spid; } }
    if (!o) return no('That offer is gone.');
    if (!a.ok) { release(from, o); post(from, { k: 'note', text: `${p.name} said no to your trade offer. Everything came back.` }); return ok({ did: 'tradeno' }); }
    const theirs = o.give.pets.map(id => from.pets.find(q => q.id === id)), mine = o.want.pets.map(id => f.pets.find(q => q.id === id));
    if (theirs.some(q => !q)) { release(from, o); return no('That offer is gone.'); }
    if (mine.some(q => !q || !tradable(f, q))) return no('One of the pets they ask for cannot be traded right now.');
    if (!canAfford(f.inv, o.want.mats)) return no('You do not have what they ask for.');
    const net = theirs.length - mine.length;
    if (f.pets.length + net > petRoom(f)) return no('You need another bed first. Build a Pet Hut.');
    if (from.pets.length - net > petRoom(from)) return no('Their farm has no bed free for your pet.');
    if (f.pets.length + net < 1 || from.pets.length - net < 1) return no('Every farm keeps at least one pet.');
    const move = (q, a2, b2) => { a2.pets.splice(a2.pets.indexOf(q), 1); delete q.held; q.open = false; if (a2.def) a2.def = a2.def.filter(id => id !== q.id); b2.pets.push(q); };
    for (const q of theirs) move(q, from, f);
    for (const q of mine) move(q, f, from);
    pay(f.inv, o.give.mats, 1); pay(f.inv, o.want.mats); pay(from.inv, o.want.mats, 1);
    from.offers.splice(from.offers.indexOf(o), 1);
    post(from, { k: 'note', text: `${p.name} accepted your trade. Your new things are on the farm.` });
    for (const side of [f, from]) { side.pals ||= {}; }
    f.pals[fid(from)] = (f.pals[fid(from)] || 0) + 1; from.pals[fid(f)] = (from.pals[fid(f)] || 0) + 1;
    return ok({ did: 'tradeyes' });
  }
  if (a.t === 'world') { // everyone's islands, most recently active first
    const mine = daily(f, 'help'), gifts = daily(f, 'gift');
    const pals = new Set(friendPids(p.pid));
    const others = [...farms].filter(([, x]) => x !== f && x.pets.length).sort((a, b) => pals.has(b[0]) - pals.has(a[0]) || (b[1].seen || 0) - (a[1].seen || 0)).slice(0, 30)
      .map(([pid, x]) => ({ ...look(pid, x), friend: pals.has(pid), helps: HELPS - (mine[fid(x)] || 0), gift: !gifts[fid(x)], pal: f.pals?.[fid(x)] || 0,
        open: x.pets.some(q => q.open), egg: !!x.nest && nestView(x).stage !== 'cuddle' }));
    return reply({ t: 'farm', world: others, farm: view(f, p) });
  }
  if (a.t === 'visit' || a.t === 'help' || a.t === 'gift') {
    const hit = byFid(a.id); if (!hit || hit[1] === f) return no('That farm is not around any more.');
    const [pid, x] = hit, id = fid(x);
    const there = () => ({ ...look(pid, x), pets: x.pets.filter(q => !(x.trip?.until > Date.now() && x.trip.pets.includes(q.id))).map(q => ({ id: q.id, sp: q.sp, name: q.name, lv: q.lv, look: lookOf(q), open: !!q.open, can: tradable(x, q), rest: Math.max(0, (q.rest || 0) - Date.now()) })), nest: nestView(x),
      album: album(x),
      helps: HELPS - (daily(f, 'help')[id] || 0), gift: !daily(f, 'gift')[id], dated: !!daily(f, 'date')[id], pal: f.pals?.[id] || 0, team: defenders(x).length });
    if (a.t === 'help') { // a little tidying: coins for the helper, and the owner's party comes home sooner
      const h = daily(f, 'help'); if ((h[id] || 0) >= HELPS) return reply({ t: 'farm', err: 'You have helped here as much as you can today.', visit: there(), farm: view(f, p) });
      h[id] = (h[id] || 0) + 1; f.inv.coins = (f.inv.coins || 0) + 3;
      if (x.trip && x.trip.until > Date.now()) x.trip.until -= HELP_CUT; else if (x.nest && nestView(x).stage !== 'ready') { x.nest.at -= HELP_CUT; x.nest.cheers = (x.nest.cheers || 0) + 1; } else x.inv.coins = (x.inv.coins || 0) + 2;
      const m = (x.mail || []).find(q => q.k === 'help' && q.from === p.name && new Date(q.at).toISOString().slice(0, 10) === today());
      if (m) m.n++; else post(x, { k: 'help', from: p.name, n: 1 });
      scheduleSave();
      return reply({ t: 'farm', visit: there(), farm: view(f, p), did: 'help' });
    }
    if (a.t === 'gift') {
      const n = GIFTS[a.mat]; if (!n) return;
      const g = daily(f, 'gift'); if (g[id]) return reply({ t: 'farm', err: 'One gift a day for each neighbour.', visit: there(), farm: view(f, p) });
      if ((f.inv[a.mat] || 0) < n) return reply({ t: 'farm', err: 'You do not have enough of that to give.', visit: there(), farm: view(f, p) });
      f.inv[a.mat] -= n; g[id] = 1; (f.pals ||= {})[id] = (f.pals[id] || 0) + 1;
      post(x, { k: 'gift', from: p.name, got: { [a.mat]: n } });
      scheduleSave();
      return reply({ t: 'farm', visit: there(), farm: view(f, p), did: 'gift' });
    }
    return reply({ t: 'farm', visit: there(), farm: view(f, p) });
  }
  if (a.t === 'claim') { // open a gift from the mailbox
    if (!countOf(f, 'mailbox')) return no('Build a Mailbox to open your mail.');
    const m = (f.mail || []).find(q => q.id === a.id && q.got); if (!m) return no('That is not in your mailbox any more.');
    pay(f.inv, m.got, 1); f.mail.splice(f.mail.indexOf(m), 1);
    return ok({ did: 'claim', got: m.got });
  }
  if (a.t === 'mailread') { // throw away everything that is only a note
    if (!countOf(f, 'mailbox')) return no('Build a Mailbox to open your mail.');
    f.mail = (f.mail || []).filter(q => q.got);
    return ok({ did: 'mailread' });
  }
  if (a.t === 'foes') return reply({ t: 'farm', foes: foes(f), farm: view(f, p) });
  if (a.t === 'defend') { // choose the team that defends this farm
    const ids = Array.isArray(a.pets) ? [...new Set(a.pets)] : [];
    if (!ids.length || ids.length > PARTY || !ids.every(id => f.pets.some(x => x.id === id))) return no('Pick one to three of your pets.');
    f.def = ids;
    return ok({ did: 'defend' });
  }
  if (a.t === 'fight') { // start a battle: practice at the Training Yard, or a match at the Arena Flag
    const mode = a.mode === 'arena' ? 'arena' : 'practice';
    if (!countOf(f, mode === 'arena' ? 'flag' : 'yard')) return no(mode === 'arena' ? 'Put up an Arena Flag first.' : 'Build a Training Yard first.');
    const ids = Array.isArray(a.pets) ? [...new Set(a.pets)] : [];
    const mine = ids.map(id => f.pets.find(x => x.id === id));
    if (!ids.length || ids.length > PARTY || ids.length !== a.pets.length || mine.some(x => !x)) return no('Pick one to three of your pets.');
    if (f.trip && ids.some(id => f.trip.pets.includes(id))) return no('One of them is away exploring.');
    let B;
    if (mode === 'arena') {
      let foe, team, to = null;
      if (String(a.foe).startsWith('npc:')) { const n = NPCS[String(a.foe).slice(4)]; if (!n) return; foe = n.name; team = n.team.map((sp, i) => unit(bot(sp, ARENA_LV, i))); }
      else {
        const hit = [...farms].find(([, x]) => x !== f && x.fid === a.foe && x.pets.length); if (!hit) return no('That farm is not around any more.');
        to = hit[0]; foe = nameOf(hit[0], hit[1]); team = defenders(hit[1]).map(x => unit(x, ARENA_LV));
      }
      B = newBattle(mine.map(x => unit(x, ARENA_LV)), team, { mode, foe, to });
    } else { // practice partners match the party's size and average level
      const lv = Math.max(1, Math.round(mine.reduce((n, x) => n + x.lv, 0) / mine.length)), all = Object.keys(SPECIES);
      B = newBattle(mine.map(x => unit(x)), mine.map((_, i) => unit(bot(all[rnd(all.length)], lv, i))), { mode, foe: 'Practice partners' });
    }
    B.ids = ids; battles.set(p.pid, B);
    return reply({ t: 'farm', battle: battleView(B), ev: [], did: 'fight' });
  }
  if (a.t === 'duel') { // ask another player who is here right now for a live battle
    const hit = byFid(a.to); if (!hit || hit[1] === f) return no('That farm is not around any more.');
    const ids = cleanIds(a.pets), mine = ids.map(id => f.pets.find(x => x.id === id));
    if (!ids.length || mine.some(x => !x)) return no('Pick one to three of your pets.');
    if (f.trip?.until > Date.now() && ids.some(id => f.trip.pets.includes(id))) return no('One of them is away exploring.');
    if (battles.has(p.pid) || lives.has(p.pid)) return no('Finish your battle first.');
    if (lives.has(hit[0])) return no('They are in a battle right now.');
    const id = rid();
    if (!push(hit[0], { t: 'farm', invite: { id, from: p.name } })) return no(`${nameOf(hit[0], hit[1])} is not here right now. Live battles need both of you online.`);
    invites.set(id, { from: p.pid, to: hit[0], pets: ids, at: Date.now() });
    for (const [k, v] of invites) if (Date.now() - v.at > INVITE_MS) invites.delete(k);
    return ok({ did: 'duel' });
  }
  if (a.t === 'duelno' || a.t === 'duelyes') {
    const inv = invites.get(a.id); invites.delete(a.id);
    if (!inv || inv.to !== p.pid || Date.now() - inv.at > INVITE_MS) return a.t === 'duelyes' ? no('That invitation has run out.') : ok();
    const other = farms.get(inv.from);
    if (a.t === 'duelno' || !other) { push(inv.from, { t: 'farm', note: `${p.name} cannot play right now.` }); return ok(); }
    const ids = cleanIds(a.pets), mine = ids.map(id => f.pets.find(x => x.id === id)), theirs = inv.pets.map(id => other.pets.find(x => x.id === id)).filter(Boolean);
    if (!ids.length || mine.some(x => !x) || !theirs.length) return no('Pick one to three of your pets.');
    if (f.trip?.until > Date.now() && ids.some(id => f.trip.pets.includes(id))) return no('One of them is away exploring.');
    if (battles.has(p.pid) || lives.has(p.pid) || battles.has(inv.from) || lives.has(inv.from)) return no('One of you is already in a battle.');
    const L = { B: newBattle(theirs.map(x => unit(x, ARENA_LV)), mine.map(x => unit(x, ARENA_LV)), { mode: 'live', live: true }), pids: [inv.from, p.pid],
      names: [nameOf(inv.from, other), p.name], ids: [theirs.map(x => x.id), ids], acts: [null, null] };
    lives.set(inv.from, L); lives.set(p.pid, L); liveArm(L);
    push(inv.from, { t: 'farm', battle: liveView(L, 0), ev: [], did: 'fight' });
    return reply({ t: 'farm', battle: liveView(L, 1), ev: [], did: 'fight' });
  }
  if ((a.t === 'bact' || a.t === 'bquit') && lives.has(p.pid)) {
    const L = lives.get(p.pid), i = L.pids.indexOf(p.pid);
    if (a.t === 'bquit') return liveTurn(L, i);
    if (!L.acts[i]) L.acts[i] = a.switch !== undefined ? { switch: a.switch | 0 } : { move: String(a.move) };
    if ((L.acts[0] && L.acts[1]) || !push(L.pids[1 - i], null)) return liveTurn(L); // nobody to wait for if the other one has gone
    return reply({ t: 'farm', battle: liveView(L, i), ev: [] });
  }
  if (a.t === 'bact' || a.t === 'bquit') {
    const B = battles.get(p.pid); if (!B) return reply({ t: 'farm', battle: null, farm: view(f, p) });
    let ev = [];
    if (a.t === 'bquit') { if (B.over === null) { B.over = 1; ev = [{ k: 'end', win: 1, quit: true }]; } }
    else {
      if (a.juice && (!(f.inv.juice > 0) || B.juiced)) return reply({ t: 'farm', battle: battleView(B), ev: [], err: B.juiced ? 'One juice a battle.' : 'You have no Berry Juice.' });
      ev = step(B, a.juice ? { juice: RECIPES.juice.heal } : a.switch !== undefined ? { switch: a.switch } : { move: a.move });
      if (ev && a.juice) { f.inv.juice--; B.juiced = true; scheduleSave(); }
      if (!ev) return reply({ t: 'farm', battle: battleView(B), ev: [], err: 'That is not possible right now.' }); }
    if (B.over === null) return reply({ t: 'farm', battle: battleView(B), ev });
    // the fight is over: hand out rewards, as long as today's rewarded fights are not used up
    battles.delete(p.pid);
    const won = B.over === 0, quit = ev.some(e => e.quit), left = DAILY[B.mode] - used(f, B.mode), r = won ? WIN[B.mode] : LOSE[B.mode];
    const prize = { won, coins: 0, xp: 0, pts: 0, grew: [], counted: left > 0 && !quit };
    if (prize.counted) {
      if (f.fights?.day !== today()) f.fights = { day: today() };
      f.fights[B.mode] = (f.fights[B.mode] || 0) + 1;
      Object.assign(prize, { coins: r.coins, xp: r.xp, pts: r.pts });
      f.inv.coins = (f.inv.coins || 0) + r.coins; f.pts = (f.pts || 0) + r.pts;
      for (const id of B.ids) { const pet = f.pets.find(x => x.id === id), g = pet && learn(pet, r.xp); if (g) prize.grew.push(g); }
    }
    if (B.to && !quit) { // the defender hears about it, and earns a little when their team held
      const d = farms.get(B.to);
      if (d) { if (!won) { d.inv.coins = (d.inv.coins || 0) + 5; d.wins = (d.wins || 0) + 1; } post(d, { k: 'battle', from: p.name, held: !won }); }
    }
    return ok({ battle: battleView(B), ev, prize, did: 'fought' });
  }
  if (a.t === 'petname') {
    const pet = f.pets.find(x => x.id === a.id), name = cleanPetName(a.name);
    if (!pet || !name) return;
    pet.name = name;
    return ok({ did: 'petname' });
  }
}

// Test hooks, only when FARM_TEST is set: bring the party home at once, or hand out materials.
// A present from the people running the server, for every farm: it waits in each Mailbox. Sent with `npm run gift`,
// which leaves gift-all.json in the data folder; the running server picks it up within a few seconds.
const GIFT_FILE = path.join(DATA_DIR, 'gift-all.json');
export function giftAll(mats, text = '') {
  const got = {}; for (const [k, n] of Object.entries(mats || {})) if (MATS[k] && Number.isInteger(n) && n > 0 && n <= 100000) got[k] = n;
  if (!Object.keys(got).length) return 0;
  for (const [pid, f] of farms) {
    post(f, { k: 'gift', from: 'Cozy Table', got: { ...got }, ...(text ? { text: String(text).slice(0, 120) } : {}) });
    const p = profiles.get(pid); if (p) push(pid, { t: 'farm', farm: view(f, p), note: 'A gift for everyone just landed in your Mailbox!' });
  }
  scheduleSave();
  return farms.size;
}
setInterval(() => {
  if (!fs.existsSync(GIFT_FILE)) return;
  try { const g = JSON.parse(fs.readFileSync(GIFT_FILE, 'utf8')); fs.unlinkSync(GIFT_FILE); console.log(`gift for everyone: ${JSON.stringify(g.mats)} sent to ${giftAll(g.mats, g.text)} farms`); }
  catch (e) { console.error('gift-all.json could not be read', e.message); try { fs.unlinkSync(GIFT_FILE); } catch {} }
}, 5000).unref();
export function testHook(pid, a) {
  const f = farms.get(pid); if (!f || !process.env.FARM_TEST || !a) return;
  if (a.home && f.trip) f.trip.until = 0;
  if (a.give) for (const [k, n] of Object.entries(a.give)) f.inv[k] = (f.inv[k] || 0) + n;
  if (a.trips !== undefined) f.trips = a.trips;
  if (a.pet && SPECIES[a.pet]) f.pets.push({ ...newPet(a.pet, 'test', true), ...(a.traits || {}) });
  if (a.lv) for (const x of f.pets) x.lv = a.lv;
  if (a.rested) for (const x of f.pets) x.rest = 0;
  if (a.pals) (f.pals ||= {}).test = a.pals;
  if (a.trained && f.train) f.train.at -= a.trained * HOUR;
  if (a.ripe) for (const i of f.items) if (i.type === 'garden') i.at = 0;
  if (a.egg && f.nest) f.nest.at = a.egg === 'laid' ? Date.now() - CUDDLE_H * HOUR - 1000 : 0;
}

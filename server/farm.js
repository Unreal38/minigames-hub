// Pet Farm: the persistent game. Each account owns one farm, saved in its own file (pet-farm.json) so a
// problem here can never damage accounts or scoreboards. The client sends intents; every rule is checked here.
// Nothing ticks: timers are stored as times and worked out when the farm is next opened.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, profiles } from './store.js';
import { ITEMS, SIZES, EXPAND, START_INV, MAX_ITEMS, SPECIES, STARTERS, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, HOUSE_UP,
  xpFor, petRoom, tripLoot, formOf, fits, canAfford, countOf, GIFTS } from '../public/games/farm/data.js';
import { unit, newBattle, step } from '../public/games/farm/battle.js';

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

// Adds experience. Returns { id, lv, form } if the pet went up a level (form is set when it grew into a new one).
function learn(pet, xp) {
  const before = pet.lv; pet.xp += xp;
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
const battleView = B => ({ mode: B.mode, foe: B.foe, turn: B.turn, need: B.need, over: B.over,
  sides: B.sides.map(s => ({ on: s.on, pets: s.pets.map(u => ({ id: u.id, sp: u.sp, name: u.name, el: u.el, lv: u.lv, form: u.form, hp: u.hp, max: u.max, moves: u.moves, cd: u.cd, up: u.up, status: u.status })) })) });

// ---------- neighbours: the world map, visiting, helping, gifts, mail ----------
const HELPS = 5, HELP_CUT = 10 * 60_000, MAIL_MAX = 30;
const byFid = id => [...farms].find(([, x]) => x.fid === id);
const daily = (f, key) => { if (f.social?.day !== today()) f.social = { day: today(), help: {}, gift: {} }; return f.social[key]; };
function post(f, m) { (f.mail ||= []).unshift({ id: rid(), at: Date.now(), ...m }); f.mail.length = Math.min(f.mail.length, MAIL_MAX); }
// Remembers every species and form this farm has ever owned.
function album(f) {
  f.album ||= {};
  for (const x of f.pets) { const a = f.album[x.sp] ||= [0, 0, 0]; a[formOf(x.lv)] = 1; }
  return f.album;
}
// A farm as its neighbours see it. Nothing here can be changed by the viewer.
const look = (pid, f) => { const pr = profiles.get(pid); return { id: fid(f), name: nameOf(pid, f), color: pr?.color, av: pr?.av, size: f.size, house: f.house || 1, pts: f.pts || 0,
  items: f.items.map(i => ({ id: i.id, type: i.type, x: i.x, y: i.y, r: i.r })) }; };

// ---------- what the player sees ----------
const view = (f, p) => ({
  owner: p.name, size: f.size, items: f.items, inv: f.inv, pets: f.pets,
  pts: f.pts || 0, def: defenders(f).map(x => x.id), fights: { arena: DAILY.arena - used(f, 'arena'), practice: DAILY.practice - used(f, 'practice') },
  album: album(f), mail: f.mail || [], pals: f.pals || {},
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

  if (f) { f.name = p.name; f.seen = Date.now(); } // remembered so other players can see whose farm it is
  if (a.t === 'open') return reply(f ? { t: 'farm', farm: view(f, p), battle: battles.has(p.pid) ? battleView(battles.get(p.pid)) : null } : { t: 'farm', need: 'starter' });
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
    for (const pet of party) { const g = learn(pet, tr.xp); if (g) grew.push(g); }
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
  if (a.t === 'world') { // everyone's islands, most recently active first
    const mine = daily(f, 'help'), gifts = daily(f, 'gift');
    const others = [...farms].filter(([, x]) => x !== f && x.pets.length).sort((a, b) => (b[1].seen || 0) - (a[1].seen || 0)).slice(0, 24)
      .map(([pid, x]) => ({ ...look(pid, x), helps: HELPS - (mine[fid(x)] || 0), gift: !gifts[fid(x)], pal: f.pals?.[fid(x)] || 0 }));
    return reply({ t: 'farm', world: others, farm: view(f, p) });
  }
  if (a.t === 'visit' || a.t === 'help' || a.t === 'gift') {
    const hit = byFid(a.id); if (!hit || hit[1] === f) return no('That farm is not around any more.');
    const [pid, x] = hit, id = fid(x);
    const there = () => ({ ...look(pid, x), pets: x.pets.filter(q => !x.trip?.pets.includes(q.id)).map(q => ({ id: q.id, sp: q.sp, name: q.name, lv: q.lv })),
      helps: HELPS - (daily(f, 'help')[id] || 0), gift: !daily(f, 'gift')[id], pal: f.pals?.[id] || 0, team: defenders(x).length });
    if (a.t === 'help') { // a little tidying: coins for the helper, and the owner's party comes home sooner
      const h = daily(f, 'help'); if ((h[id] || 0) >= HELPS) return reply({ t: 'farm', err: 'You have helped here as much as you can today.', visit: there(), farm: view(f, p) });
      h[id] = (h[id] || 0) + 1; f.inv.coins = (f.inv.coins || 0) + 3;
      if (x.trip && x.trip.until > Date.now()) x.trip.until -= HELP_CUT; else x.inv.coins = (x.inv.coins || 0) + 2;
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
  if (a.t === 'bact' || a.t === 'bquit') {
    const B = battles.get(p.pid); if (!B) return reply({ t: 'farm', battle: null, farm: view(f, p) });
    let ev = [];
    if (a.t === 'bquit') { if (B.over === null) { B.over = 1; ev = [{ k: 'end', win: 1, quit: true }]; } }
    else { ev = step(B, a.switch !== undefined ? { switch: a.switch } : { move: a.move }); if (!ev) return reply({ t: 'farm', battle: battleView(B), ev: [], err: 'That is not possible right now.' }); }
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
export function testHook(pid, a) {
  const f = farms.get(pid); if (!f || !process.env.FARM_TEST || !a) return;
  if (a.home && f.trip) f.trip.until = 0;
  if (a.give) for (const [k, n] of Object.entries(a.give)) f.inv[k] = (f.inv[k] || 0) + n;
  if (a.trips !== undefined) f.trips = a.trips;
}

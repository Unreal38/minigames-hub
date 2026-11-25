// Pet Farm: the persistent game. Each account owns one farm, saved in its own file (pet-farm.json) so a
// problem here can never damage accounts or scoreboards. The client sends intents; every rule is checked here.
// Nothing ticks: timers are stored as times and worked out when the farm is next opened.
import { BOOSTS } from '../public/wheelprizes.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as db from './db.js';
import { DATA_DIR, safeText, profiles, friendPids, addCoins, coinsOf, setCoins, me as hubMe, scheduleSave as saveHub } from './store.js';
import { ELEMENTS, ITEMS, SIZES, EXPAND, START_INV, MAX_ITEMS, SPECIES, elOf, STARTERS, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, HOUSE_UP,
  xpFor, petRoom, lodgeRoom, allRoom, maxOf, LAND_HOUSE, SHELF_MAX, SHELF_NAME, GROUP_MAX, GROUP_NAME, tripLoot, formOf, fits, canAfford, countOf, costText, GIFTS, MATS,
  BERRIES, RECIPES, STORED, capOf, swapDeal, SWAP_MAX, TRADE_MATS, UPGRADES, UP_MAX, lvOf, topLv, upCost, upBlock, museumFill, growMin, TRAIN_XP, WORK, canWork, workPct, palsOf, weatherAt } from '../public/games/farm/data.js';
import { unit as rawUnit, newBattle, step, pickMove, TURN_S } from '../public/games/farm/battle.js';
import { flairOf } from '../public/cosmetics.js';
import { lookOf, makeBaby, snapshot, shellOf, hatchHours, BREED_LV, CUDDLE_H, REST_H, PATTERNS, TALENTS } from '../public/games/farm/breed.js';
import { dayOf } from './day.js';

// Coins are the account's, not the farm's: f.inv.coins reads and writes the owner's account balance, so everything
// below can keep treating coins as one more material. A farm saved before that pays its coins into the account once.
function bindCoins(pid, f) {
  if (!profiles.has(pid)) return;
  if (!f.coinsMoved) { addCoins(pid, +f.inv.coins || 0); f.coinsMoved = true; scheduleSave(); }
  Object.defineProperty(f.inv, 'coins', { enumerable: true, configurable: true, get: () => coinsOf(pid), set: v => setCoins(pid, +v || 0) });
}

const unit = (pet, lv) => rawUnit({ ...pet, look: lookOf(pet) }, lv); // battles show each pet as it really looks

const FILE = path.join(DATA_DIR, 'pet-farm.json');
const farms = new db.Tracked('f'); // profile id -> farm (saved in zatoka.db a little at a time, see db.js)
const rid = () => crypto.randomBytes(5).toString('hex');
const rnd = n => crypto.randomInt(n);

// ---------- load / save ----------
// Farms live in zatoka.db next to the profiles (store.js). The first start on the database copies pet-farm.json over,
// reads every farm back and compares it; only a perfect match switches, otherwise farms stay on the JSON file as before.
let mode = 'json';
export const farmMode = () => mode;
const take = (pid, f) => { if (f && Array.isArray(f.items) && Array.isArray(f.pets)) { f.pets.forEach(fixPet); bindCoins(pid, f); farms.set(pid, f); return true; } return false; };
export function load() {
  if (db.isOpen() && db.getKv('imported:farms')) {
    for (const { id, v } of db.rows('f')) { take(id, JSON.parse(v)); farms.remember(id, v); }
    mode = 'db';
  } else {
    let d = {};
    try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); }
    for (const [pid, f] of Object.entries(d.farms || {})) take(pid, f);
    if (db.isOpen()) {
      let why = '';
      try {
        db.tx(() => { for (const [pid, f] of farms) { const t = JSON.stringify(f); db.put('f', pid, t); farms.remember(pid, t); } });
        const got = new Map(db.rows('f').map(r => [r.id, r.v]));
        if (got.size !== farms.size) why = `${farms.size} farms in memory, ${got.size} saved`;
        else for (const [pid, f] of farms) if (got.get(pid) !== JSON.stringify(f)) { why = `farm ${pid.slice(0, 6)}… differs`; break; }
      } catch (e) { why = 'copying failed: ' + e.message; }
      if (why) { console.error(`NOT moving farms to the database: ${why}. Farms stay on ${FILE}, as before.`); try { db.tx(() => { for (const { id } of db.rows('f')) db.del('f', id); }); } catch {} farms.forget(); }
      else { db.putKv('imported:farms', JSON.stringify({ at: new Date().toISOString(), farms: farms.size })); mode = 'db'; console.log(`copied ${farms.size} farms from ${FILE} to the database and checked every one; the JSON file is left as it was`); }
    }
  }
  farms.hot.clear();
  if (mode === 'db') setInterval(() => scheduleSave(), 15_000).unref(); // the rolling part of the save moves on when idle too
  for (const [pid, f] of farms) { const p = profiles.get(pid); if (p) p.petSp = Object.values(album(f)).filter(a => a.some(Boolean)).length; }
  console.log(`loaded ${farms.size} farms from ${mode === 'db' ? 'the database' : FILE}`);
}
let timer = null, dirty = false, warned = false;
function scheduleSave() { dirty = true; if (!timer) timer = setTimeout(saveNow, 1500); }
export function saveNow(all = false) {
  clearTimeout(timer); timer = null;
  if (mode === 'db') {
    try { db.tx(() => farms.flush(() => true, { all: all === true })); dirty = false; warned = false; }
    catch (e) { if (!warned) console.error('could not save farms to the database:', e.message); warned = true; farms.forget(); scheduleSave(); }
    return;
  }
  farms.hot.clear(); farms.gone.clear();
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
  if (typeof x.name === 'string') x.name = safeText(x.name);
  if (!Array.isArray(x.pat)) x.pat = [];
  x.col = Array.isArray(x.col) ? [x.col[0] | 0, x.col[1] | 0].sort((a, b) => a - b) : [0, 0];
  if (!Array.isArray(x.stars)) x.stars = [3, 3, 3, 3];
  x.talent = (x.talent | 0) % TALENTS.length;
}
// A pet as its owner sees it. The hidden colour gene only shows once the pet has had two babies.
const HOUR = 3_600_000;
const petView = x => ({ ...x, look: lookOf(x), col: (x.kids || 0) >= 2 ? x.col : [x.col[0]], rest: Math.max(0, (x.rest || 0) - Date.now()) });
// Expedition parties. Up to one for each level of the gate can be out at once. (Older saves had a single f.trip.)
function parties(f) { if (f.trip) { (f.parties ||= []).push({ id: rid(), ...f.trip }); delete f.trip; } return f.parties ||= []; }
// Helpers at buildings: f.work[type] is the pet working there. It counts only while the building stands and the pet is home.
const helper = (f, type) => { const p = f.work?.[type] && f.pets.find(x => x.id === f.work[type]); return p && topLv(f, type) && canWork(p, type) && !away(f, p.id, true) && !cuddling(f, p.id) ? p : null; };
const boost = (f, type) => { const p = helper(f, type); return p ? workPct(p, type) / 100 : 0; };
const unwork = (f, ids) => { for (const k of Object.keys(f.work || {})) if (ids.includes(f.work[k])) delete f.work[k]; }; // a pet with a new job leaves its building
const away = (f, id, back = false) => parties(f).some(t => (back || t.until > Date.now()) && t.pets.includes(id)); // back: also count a party waiting to be welcomed home
// A pet that has just moved in sleeps on the island when a bed is free there, otherwise in the Pet Lodge.
// The Lodge is storage: pets kept there take no part in anything until they are moved back out to the island.
function settle(f, q) {
  delete q.lodge; delete q.shelf;
  const isle = f.pets.filter(x => x !== q && !x.lodge).length, lodge = f.pets.filter(x => x !== q && x.lodge).length;
  if (isle >= petRoom(f) && lodge < lodgeRoom(f)) q.lodge = true;
}
const tripView = t => ({ id: t.id, zone: t.zone, trip: t.trip, pets: t.pets, left: Math.max(0, t.until - Date.now()) });
// The Nest: two pets cuddle, then an egg sits until it hatches. Times are worked out from when it started.
// Each Nest level adds an egg slot: level 2 keeps the second egg in f.nest2, level 3 the third in f.nest3.
const SLOTS = ['nest', 'nest2', 'nest3'];
const nestMax = f => Math.min(SLOTS.length, Math.max(1, topLv(f, 'nest')));
function nestView(f, slot = 'nest') {
  const n = f[slot]; if (!n) return null;
  const now = Date.now(), egg = n.at + CUDDLE_H * HOUR, done = egg + n.hours * HOUR;
  return { slot, a: n.a, b: n.b, friend: n.friend || null, shell: n.shell, stage: now < egg ? 'cuddle' : now < done ? 'egg' : 'ready', left: Math.max(0, (now < egg ? egg : done) - now), cheers: n.cheers || 0 };
}

// Adds experience. Returns { id, lv, form } if the pet went up a level (form is set when it grew into a new one).
function learn(pet, xp) {
  const before = pet.lv; pet.xp += xp;
  if (pet.talent === 3) pet.xp += Math.ceil(xp * .1);
  while (pet.lv < MAX_LV && pet.xp >= xpFor(pet.lv)) { pet.xp -= xpFor(pet.lv); pet.lv++; }
  if (pet.lv >= MAX_LV) pet.xp = 0;
  return pet.lv > before ? { id: pet.id, lv: pet.lv, form: formOf(pet.lv) > formOf(before) ? formOf(pet.lv) : 0 } : null;
}

// Which pets an action puts to use, so pets stored in the Pet Lodge can be turned away (see settle).
const PET_PICKS = { train: a => a.pets, send: a => a.pets, pair: a => [a.a, ...(a.friend ? [] : [a.b])], petopen: a => [a.id], defend: a => a.pets,
  fight: a => a.mode === 'wild' ? [] : a.pets, duel: a => a.pets, duelyes: a => a.pets, work: a => a.id ? [a.id] : [] };

// ---------- battles ----------
// A battle lives in memory only. If the server restarts mid-fight it is simply gone, and nothing was at stake yet.
const battles = new Map(); // profile id -> battle
const ARENA_LV = 20, HOLDS_DAILY = 10, DAILY = { arena: 5, practice: 3, wild: 999 }, WILD_CHANCE = .3, WILD_MS = 30 * 60_000;
const WIN = { arena: { coins: 25, xp: 20, pts: 10 }, practice: { coins: 0, xp: 12, pts: 0 }, wild: { coins: 4, xp: 15, pts: 0 } };
const LOSE = { arena: { coins: 5, xp: 8, pts: 2 }, practice: { coins: 0, xp: 5, pts: 0 }, wild: { coins: 0, xp: 6, pts: 0 } };
const today = () => dayOf(); // midnight in Warsaw, like every daily thing on the site (server/day.js)
const used = (f, mode) => f.fights?.day === today() ? f.fights[mode] || 0 : 0;
// Three neighbours who are always up for a match, so the arena works before friends join.
const NPCS = {
  hazel: { name: 'Farmer Hazel', pts: 40, team: ['mossbun', 'sproutle', 'petalpuff'] },
  bruno: { name: 'Bruno', pts: 90, team: ['pebblet', 'toastoad', 'puddlepup'] },
  mira: { name: 'Mira', pts: 150, team: ['zapkit', 'axolily', 'flickit'] },
};
// A wild pet is rolled when it is met, so the battle shows the very pet that joins on a win.
const wildPet = (sp, owner) => { const { col, pat, stars, talent, sparkle } = newPet(sp, owner, true); return { col, pat, stars, talent, sparkle }; };
const bot = (sp, lv, i) => ({ id: 'bot' + i, sp, name: SPECIES[sp].name, lv, stars: [3, 3, 3, 3] });
// The team that defends a farm: the one its owner chose, or the three highest levels.
function defenders(f) {
  const picked = (f.def || []).map(id => f.pets.find(p => p.id === id)).filter(p => p && !p.lodge);
  return (picked.length ? picked : f.pets.filter(p => !p.lodge).sort((a, b) => b.lv - a.lv)).slice(0, PARTY);
}
const nameOf = (pid, f) => f.name || profiles.get(pid)?.name || 'A farmer'; // farms saved before names were kept fall back to the profile
const fid = f => f.fid ||= rid(); // a farm's public name tag, so profile ids never leave the server
function foes(mine) {
  const out = Object.entries(NPCS).map(([k, n]) => ({ id: 'npc:' + k, name: n.name, pts: n.pts, npc: true, team: n.team.map(sp => ({ sp, lv: ARENA_LV })) }));
  for (const [pid, f] of farms) if (f !== mine && f.pets.length) out.push({ id: fid(f), name: nameOf(pid, f), pts: f.pts || 0, team: defenders(f).map(p => ({ sp: p.sp, lv: p.lv, name: p.name })) });
  return out.sort((a, b) => b.pts - a.pts);
}
// The ladder: every player's farm (never the computer neighbours), most ladder points first. Ties go to the higher best pet.
function ranks(mine) {
  const row = (f, name, me) => ({ name, me, pts: f.pts || 0, top: Math.max(0, ...f.pets.map(p => p.lv)), pets: f.pets.length, team: defenders(f).map(p => ({ sp: p.sp })) });
  const out = [];
  for (const [pid, f] of farms) if (f.pets.length) out.push(row(f, nameOf(pid, f), f === mine));
  return out.sort((a, b) => b.pts - a.pts || b.top - a.top).slice(0, 100);
}
// What the player may see of a fight: everything about their own side, and the other side's faces and health.
const battleView = B => ({ juiced: !!B.juiced, mode: B.mode, foe: B.foe, turn: B.turn, need: B.need, over: B.over,
  sides: B.sides.map(s => ({ on: s.on, pets: s.pets.map(u => ({ id: u.id, sp: u.sp, name: u.name, el: u.el, el2: u.el2, lv: u.lv, form: u.form, look: u.look, hp: u.hp, max: u.max, moves: u.moves, cd: u.cd, up: u.up, status: u.status })) })) });

// ---------- live battles ----------
// Two players who are both here fight each other with the same rules. Each has 30 seconds to choose; a player
// who runs out of time gets the game's pick. The server reaches the other player through push().
let push = () => 0;
export const setPush = fn => { push = fn; };
const lives = new Map(), invites = new Map(); // profile id -> live battle; invite id -> { from, to, pets, at }
const TURN_MS = TURN_S * 1000, INVITE_MS = 60_000, LIVE = { win: { coins: 15, xp: 15 }, lose: { coins: 5, xp: 8 } }, LIVE_DAILY = 5; // rewarded live battles a day
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
      // Rewards for live battles are capped per day (LIVE_DAILY), like Arena matches: otherwise two accounts could
      // battle each other over and over and print coins and rank XP.
      const won = B.over === i, left = quit === i, r = won ? LIVE.win : LIVE.lose, prize = { won, coins: 0, xp: 0, pts: 0, grew: [], counted: !left && !!f && used(f, 'live') < LIVE_DAILY };
      if (prize.counted) { if (f.fights?.day !== today()) f.fights = { day: today() }; f.fights.live = (f.fights.live || 0) + 1; }
      if (prize.counted && won) { prize.rank = RANK_XP.live; hubXp(profiles.get(pid), RANK_XP.live); }
      if (prize.counted) { prize.coins = r.coins; prize.xp = Math.round(r.xp * (wx() === 'cloudy' ? 1.25 : 1)); f.inv.coins = (f.inv.coins || 0) + r.coins; for (const id of L.ids[i]) { const pet = f.pets.find(x => x.id === id), g = pet && learn(pet, prize.xp); if (g) prize.grew.push(g); } }
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
// The Pet Farm ladder for the hub's rankings: the same order as in the game, with each farmer's avatar.
export function ladder(pid) {
  const mine = farms.get(pid), rows = [];
  for (const [id, f] of farms) if (f.pets.length) { const pr = profiles.get(id); rows.push({ f, name: nameOf(id, f), color: pr?.color, av: pr?.av, me: f === mine, pts: f.pts || 0, top: Math.max(0, ...f.pets.map(p => p.lv)), pets: f.pets.length }); }
  rows.sort((a, b) => b.pts - a.pts || b.top - a.top);
  const strip = ({ f, ...r }, i) => ({ ...r, pos: i + 1 }), at = rows.findIndex(r => r.me);
  return { game: 'farm', total: rows.length, rows: rows.slice(0, 25).map(strip), mine: at >= 25 ? strip(rows[at], at) : null };
}
export const fidOf = pid => { const f = farms.get(pid); return f?.pets.length ? fid(f) : null; };
const daily = (f, key) => { if (f.social?.day !== today()) f.social = { day: today(), help: {}, gift: {} }; return f.social[key] ||= {}; };
// A heart for a friend's pet in the Plaza (server/plaza.js): one friendship point a day for each friend, for the one who gave it.
export function plazaPat(pid, friendPid) {
  const f = farms.get(pid), o = farms.get(friendPid); if (!f?.pets.length || !o?.pets.length) return false;
  const done = daily(f, 'pat'), id = fid(o); if (done[id]) return false;
  done[id] = 1; (f.pals ||= {})[id] = (f.pals[id] || 0) + 1; scheduleSave();
  return true;
}
// Lucky Wheel prizes (server/wheel.js). A prize is a letter: { got }, { item }, { pet: { sp, el } } or { boost: building }.
// Wheel letters are never pushed out of a full mailbox by newer mail.
export function wheelMail(pid, m) {
  const f = farms.get(pid); if (!f) return false;
  post(f, { k: 'wheel', ...m }); scheduleSave();
  const p = profiles.get(pid); if (p) push(pid, { t: 'farm', farm: view(f, p), note: 'Your Lucky Wheel prize is in the Mailbox!' });
  return true;
}
// Prizes won before the farm existed waited on the profile; they move into the Mailbox the first time the farm is there.
function unhold(p, f) { const h = p.wheel?.hold; if (!h?.length) return; for (const m of h) post(f, { k: 'wheel', ...m }); delete p.wheel.hold; saveHub(); scheduleSave(); }
// Boosters: f.tokens[building] is how many are waiting; f.buff[building] is the one running (a time it ends, or uses left).
const buffOn = (f, type) => { const b = f.buff?.[type]; if (!b) return false; if (BOOSTS[type].hours ? b > Date.now() : b > 0) return true; delete f.buff[type]; return false; };
const buffUse = (f, type) => { if (!buffOn(f, type)) return false; if (BOOSTS[type].uses && --f.buff[type] <= 0) delete f.buff[type]; return true; };
const buffView = f => Object.fromEntries(Object.keys(BOOSTS).filter(k => buffOn(f, k)).map(k => [k, BOOSTS[k].hours ? { left: f.buff[k] - Date.now() } : { uses: f.buff[k] }]));
function post(f, m) { (f.mail ||= []).unshift({ id: rid(), at: Date.now(), ...m }); while (f.mail.length > MAIL_MAX) { let i = f.mail.length - 1; while (i > 0 && f.mail[i].k === 'wheel') i--; if (f.mail[i].k === 'wheel') break; f.mail.splice(i, 1); } }
// Remembers every species and form this farm has ever owned.
// A species met at a friend's or across the ring gets an album page before the player owns one.
const saw = (f, sps) => { f.album ||= {}; for (const sp of sps) if (SPECIES[sp]) f.album[sp] ||= [0, 0, 0]; };
const wildOf = f => f.wild && f.wild.until > Date.now() ? f.wild : null;
function album(f) {
  f.album ||= {};
  f.coats ||= []; f.marks ||= []; f.vars ||= {};
  for (const x of f.pets) {
    const a = f.album[x.sp] ||= [0, 0, 0]; a[formOf(x.lv)] = 1;
    const v = f.vars[x.sp] ||= [], e = elOf(x); if (!v.includes(e)) v.push(e); // the elements this species has been raised with
    if (!f.coats.includes(x.col[0])) f.coats.push(x.col[0]);
    for (const k of x.pat) if (!f.marks.includes(k)) f.marks.push(k);
  }
  return f.album;
}
// A farm as its neighbours see it. Nothing here can be changed by the viewer.
// The owner's isle look (ground, rock base, sky, floating pieces): their farm island wears it too.
const isleOf = pr => { const f = pr ? flairOf(pr) : {}, o = {}; for (const k of ['ig', 'ib', 'ik']) if (f[k]) o[k] = f[k]; if (f.fp) o.fp = f.fp; return o; };
const look = (pid, f) => { const pr = profiles.get(pid); return { id: fid(f), name: nameOf(pid, f), color: pr?.color, av: pr?.av, isle: isleOf(pr), size: f.size, house: f.house || 1, pts: f.pts || 0,
  items: f.items.map(i => ({ id: i.id, type: i.type, x: i.x, y: i.y, r: i.r, ...(i.lv > 1 ? { lv: i.lv } : {}), ...(i.type === 'museum' ? { mu: museumFill(album(f)) } : {}) })) }; }; // mu: how full the museum's medallions are // lv: visitors and the map see each building at its level

// ---------- trading ----------
// An offer lives on the sender's farm. What they offer is set aside at once (materials leave the stock, pets are
// marked as promised) and comes back if the offer is declined, cancelled or a week old.
const TRADE_MS = 7 * 24 * HOUR, TRADE_OPEN = 5, TRADE_PETS = 3;
const cuddling = (f, id) => SLOTS.some(s => f[s] && nestView(f, s).stage === 'cuddle' && (f[s].a === id || f[s].b === id));
const tradable = (f, x) => !x.held && f.pets.length > 1 && !away(f, x.id) && !cuddling(f, x.id) && !(f.def || []).includes(x.id);
const cleanMats = m => { const out = {}; for (const [k, n] of Object.entries(m && typeof m === 'object' ? m : {})) if (own(MATS, k) && TRADE_MATS.includes(k) && Number.isInteger(n) && n > 0 && n <= 9999) out[k] = n; return out; };
const cleanIds = a => Array.isArray(a) ? [...new Set(a.map(String))].slice(0, TRADE_PETS) : [];
function release(f, o) { // hand back what an offer was holding
  pay(f.inv, o.give.mats, 1);
  for (const x of f.pets) if (x.held === o.id) delete x.held;
  f.offers.splice(f.offers.indexOf(o), 1);
}
// Coins stopped being tradable (Kuba, 2026-11-24): an offer from before that, giving or asking for coins, is sent back
// whole, with a note, the next time anyone looks at trades.
const hasCoins = o => !!(o.give.mats.coins || o.want.mats.coins);
function sweep(f) {
  for (const o of [...(f.offers || [])]) {
    if (hasCoins(o)) { release(f, o); post(f, { k: 'note', text: `Your trade offer to ${nameOf(o.to, farms.get(o.to) || {})} came back, because coins can no longer be traded. Everything is back on your farm.` }); }
    else if (Date.now() - o.at > TRADE_MS || !farms.has(o.to)) release(f, o);
  }
}
const FREE_GIFT = 3, FREE_GIFT_LV = 12; // berries a pet leaves when it is let go: 3 plus one per level, up to 15
const tiny = x => x ? { id: x.id, sp: x.sp, name: x.name, lv: x.lv, look: lookOf(x) } : null;
// For the rest of the site: a player's pets (to pick a companion from) and one of them by id, or null once it has moved on.
export const petsOf = pid => (farms.get(pid)?.pets || []).map(tiny);
// A one-line summary for the hub's Today tile: how many pets, and the next thing worth coming back for.
export function brief(pid) {
  const f = farms.get(pid); if (!f) return null;
  const eggs = SLOTS.map(s => nestView(f, s)).filter(Boolean), trips = parties(f).map(tripView);
  const egg = eggs.sort((a, b) => a.left - b.left)[0], trip = trips.sort((a, b) => a.left - b.left)[0];
  return { pets: f.pets.length, egg: egg ? { stage: egg.stage, left: egg.left } : null, trip: trip ? { left: trip.left } : null };
}
// Decorations standing on a farm, by type: what its owner may show off on their profile isle. Fences and paths stay home.
export const decorOf = pid => [...new Set((farms.get(pid)?.items || []).map(i => i.type))].filter(t => ITEMS[t]?.kind === 'd' && t !== 'fence' && t !== 'path');
export const decorList = pid => decorOf(pid).map(t => ({ t, n: ITEMS[t].name })); // with names, for the wardrobe
export const petOf = (pid, id) => (id && tiny(farms.get(pid)?.pets.find(x => x.id === id))) || null;
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
const growMs = (f, it) => growMin(it) * 60_000 * (1 - boost(f, 'garden')); // a helper waters the plots
// A garden booster (f.gbuff = when it ends) makes plots grow BOOSTS.garden.x times as fast until then, and at the
// usual pace after it, so nothing jumps when the booster runs out.
function ripeIn(f, it) {
  const now = Date.now(), at = it.at || 0, E = f.gbuff || 0, x = BOOSTS.garden.x, need = growMs(f, it);
  if (at >= E) return Math.max(0, at + need - now);
  const left = need - ((Math.min(now, E) - at) * x + Math.max(0, now - E)); if (left <= 0) return 0;
  return now >= E ? left : left / x <= E - now ? left / x : (E - now) + left - (E - now) * x;
}
const gardenView = f => { const g = f.items.filter(i => i.type === 'garden'), wait = g.map(i => ripeIn(f, i)).filter(n => n > 0);
  return { ripe: g.length - wait.length, left: wait.length ? Math.min(...wait) : 0, grow: Object.fromEntries(g.map(i => [i.id, +(1 - ripeIn(f, i) / growMs(f, i)).toFixed(2)])) }; };
// Materials going into storage stop at the cap. Returns how many fitted. Never takes anything away.
function store(f, k, n) { const room = STORED.includes(k) ? Math.max(0, capOf(f) - (f.inv[k] || 0)) : Infinity, got = Math.min(n, room); f.inv[k] = (f.inv[k] || 0) + got; return got; }
// Pet Farm feeds the site-wide rank: a little for battles won against other players, more for each new species.
const RANK_XP = { arena: 10, live: 10, species: 15 };
function hubXp(p, n) { if (!p || !n) return; p.xp = (p.xp || 0) + n; saveHub(); push(p.pid, { t: 'me', me: hubMe(p) }); }
function albumXp(f, p) { // paid once for every species ever owned, including ones owned before this existed
  const owned = Object.values(album(f)).filter(a => a.some(Boolean)).length, add = owned - (f.albumXp || 0);
  if (p && p.petSp !== owned) { p.petSp = owned; saveHub(); if (add <= 0) push(p.pid, { t: 'me', me: hubMe(p) }); } // the account remembers it: card backgrounds are unlocked by it (cosmetics.js, earn.sp)
  if (add > 0) { f.albumXp = owned; hubXp(p, add * RANK_XP.species); scheduleSave(); return add * RANK_XP.species; }
  return 0;
}
// Pets at the Training Yard earn a little experience for every full hour, worked out when the farm is next used.
function trainTick(f) {
  const t = f.train; if (!t?.ids.length) return;
  const hours = Math.floor((Date.now() - t.at) / HOUR); if (hours < 1) return;
  t.at += hours * HOUR; t.ids = t.ids.filter(id => f.pets.some(x => x.id === id));
  for (const id of t.ids) { const pet = f.pets.find(x => x.id === id); if (!away(f, id, true)) learn(pet, Math.round(hours * TRAIN_XP * (1 + boost(f, 'yard')) * (buffOn(f, 'yard') ? BOOSTS.yard.x : 1))); }
  scheduleSave();
}
// Who is walking about on someone's farm right now, so the owner sees their visitors too.
const calls = new Map(), CALL_MS = 10 * 60_000; // visitor pid -> { host pid, at }
const guestsOf = pid => { const out = []; for (const [v, c] of calls) { if (Date.now() - c.at > CALL_MS || !push(v, null)) calls.delete(v); else if (c.host === pid && out.length < 3) { const pr = profiles.get(v); out.push({ name: pr?.name || 'A friend', color: pr?.color, av: pr?.av }); } } return out; };
function callOn(p, host) { // host is a pid, or null when the visitor heads home
  const was = calls.get(p.pid); if (was?.host === host) { was.at = Date.now(); return; }
  if (host) calls.set(p.pid, { host, at: Date.now() }); else calls.delete(p.pid);
  for (const h of [was?.host, host]) { const x = h && farms.get(h), pr = h && profiles.get(h); if (x && pr) push(h, { t: 'farm', farm: view(x, pr), ...(h === host ? { note: `${p.name} dropped by your farm.` } : {}) }); }
}
// The weather right now. It only ever adds a small bonus (see WEATHER in data.js). Tests can pin it.
let wxPin = null;
const wx = () => wxPin || weatherAt().kind;
const view = (f, p) => ({
  ...(wxPin && wxPin !== 'none' ? { weather: wxPin } : {}),
  guests: guestsOf(p.pid),
  wild: wildOf(f) ? { sp: f.wild.sp, lv: f.wild.lv, left: f.wild.until - Date.now() } : null,
  garden: gardenView(f), work: Object.fromEntries(Object.keys(WORK).filter(k => helper(f, k)).map(k => [k, f.work[k]])), cap: capOf(f), stash: f.stash || {}, palpts: palsOf(f),
  train: { ids: f.train?.ids || [], slots: topLv(f, 'yard'), left: f.train?.ids.length ? Math.max(0, f.train.at + HOUR - Date.now()) : 0 },
  owner: p.name, size: f.size, items: f.items, inv: f.inv, pets: f.pets.map(petView), nest: nestView(f),
  pts: f.pts || 0, def: defenders(f).map(x => x.id), fights: { arena: DAILY.arena - used(f, 'arena'), practice: DAILY.practice - used(f, 'practice') },
  album: album(f), vars: f.vars, coats: f.coats, marks: f.marks, mail: f.mail || [], tokens: f.tokens || {}, buff: buffView(f), pals: f.pals || {}, trades: tradesView(p.pid, f),
  first: !f.trips, // the first expedition always brings a wild pet home
  house: f.house || 1, houseNext: (f.house || 1) < HOUSE_MAX ? HOUSE_UP[(f.house || 1) + 1] : null, room: petRoom(f), lodgeRoom: lodgeRoom(f), allRoom: allRoom(f), shelves: f.shelves || [],
  groups: (f.groups || []).map(g => ({ ...g, pets: g.pets.filter(id => f.pets.some(x => x.id === id)) })), // saved expedition groups, without pets that left
  // left: time until the party is back, in ms (the two clocks may differ, so no absolute times are sent)
  trips: parties(f).map(tripView), partyMax: Math.max(1, topLv(f, 'gate')), nests: SLOTS.map(s => nestView(f, s)).filter(Boolean), nestMax: nestMax(f),
  trip: parties(f).length ? tripView([...parties(f)].sort((a, b) => a.until - b.until)[0]) : null, // the party that is back first
  next: SIZES.indexOf(f.size) + 1 < SIZES.length ? { size: SIZES[SIZES.indexOf(f.size) + 1], cost: EXPAND[SIZES.indexOf(f.size) + 1], house: LAND_HOUSE[SIZES.indexOf(f.size) + 1] || 0 } : null,
});

const pay = (inv, cost, sign = -1) => { for (const [k, n] of Object.entries(cost || {})) inv[k] = Math.max(0, (inv[k] || 0) + sign * n); };
const cleanPetName = s => safeText(s).trim().slice(0, 14);
// Looks a player's choice up in one of the game's tables. Only the table's own entries count, never built-in
// names like 'constructor' or 'toString' that every object has.
const own = (t, k) => typeof k === 'string' && Object.hasOwn(t, k) ? t[k] : undefined;

// One request from a signed-in or guest player. reply(msg) sends back to that player only.
export function handle(p, a, reply) {
  if (!p || !a || typeof a !== 'object') return;
  if (!p.user) return reply({ t: 'farm', need: 'account' });
  const f = farms.get(p.pid);
  const ok = (extra = {}) => { scheduleSave(); const rank = albumXp(f, p); reply({ t: 'farm', farm: view(f, p), ...extra, ...(rank ? { rank } : {}) }); };
  const no = msg => reply({ t: 'farm', err: msg, farm: f ? view(f, p) : null });

  if (f) { f.name = p.name; f.seen = Date.now(); trainTick(f); unhold(p, f); }
  const ok0 = f && albumXp(f, p); // species gained since last time (a hatch, a trade, a wild pet) // remembered so other players can see whose farm it is
  if (a.t === 'open') return reply(f ? { t: 'farm', farm: view(f, p), battle: lives.has(p.pid) ? liveView(lives.get(p.pid), lives.get(p.pid).pids.indexOf(p.pid)) : battles.has(p.pid) ? battleView(battles.get(p.pid)) : null } : { t: 'farm', need: 'starter' });
  if (a.t === 'starter') {
    if (f) return no('You already have a farm.');
    if (!STARTERS.includes(a.sp)) return;
    const nf = { v: 1, size: SIZES[0], nid: 2, items: [{ id: 1, type: 'house', x: 3, y: 1, r: 0 }], inv: { ...START_INV },
      name: p.name, pets: [newPet(a.sp, p.user)], house: 1, trip: null, trips: 0, created: Date.now() };
    bindCoins(p.pid, nf); farms.set(p.pid, nf); unhold(p, nf); scheduleSave();
    return reply({ t: 'farm', farm: view(nf, p), did: 'starter' });
  }
  if (!f) return reply({ t: 'farm', need: 'starter' });

  // pets stored in the Pet Lodge cannot be picked for anything until they are back on the island
  const picks = PET_PICKS[a.t]?.(a);
  if (Array.isArray(picks) && picks.some(id => f.pets.find(x => x.id === id)?.lodge)) return no('One of them is stored in the Pet Lodge. Move it out to the island first.');
  if (a.t === 'place') {
    const it = own(ITEMS, a.type); if (!it || it.fixed) return;
    if (f.items.length >= MAX_ITEMS) return no('The farm is full. Put something away first.');
    const max = maxOf(f, a.type);
    if (max && countOf(f, a.type) >= max) return no(`You can only have ${max} of those.`);
    if (it.house && (f.house || 1) < it.house) return no(`That needs a level ${it.house} farmhouse.`);
    const gifted = f.stash?.[a.type] > 0; // a decoration a friend gave: placed for free, whatever it normally needs
    if (!gifted && it.wheel) return no('That one only comes from the Lucky Wheel.');
    if (!gifted && !canAfford(f.inv, it.cost)) return no('Not enough materials for that.');
    if (!gifted && it.craft && topLv(f, 'workshop') < it.craft) return no(it.craft > 1 && countOf(f, 'workshop') ? `That needs a level ${it.craft} Workshop.` : 'Build a Workshop first.');
    if (!gifted && it.pals && palsOf(f) < it.pals) return no(`That needs ${it.pals} friendship points. Help out and leave gifts to earn them.`);
    if (!fits(f, a.type, a.x, a.y, a.r)) return no('That spot is taken.');
    if (gifted) { if (!--f.stash[a.type]) delete f.stash[a.type]; } else pay(f.inv, it.cost);
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
    if (f.items[i].type === 'nest' && SLOTS.some(s => f[s])) return no('The Nest is in use right now.');
    if (f.items[i].type === 'gate' && parties(f).length) return no('Your pets are still out exploring.');
    pay(f.inv, it.cost, 1); for (let n = 1; n < lvOf(f.items[i]); n++) pay(f.inv, UPGRADES[f.items[i].type].cost[n - 1], 1); // improvements come back too
    if (it.wheel) (f.stash ||= {})[f.items[i].type] = (f.stash[f.items[i].type] || 0) + 1; // a wheel prize is kept, never sold
    if (f.items[i].type === 'lodge' && f.pets.some(q => q.lodge)) return no('Move the pets stored in the Lodge out first.');
    f.items.splice(i, 1);
    if (f.train) f.train.ids = f.train.ids.slice(0, topLv(f, 'yard'));
    return ok({ did: 'remove', got: Object.keys(it.cost).length ? costText(it.cost) : '' });
  }
  if (a.t === 'upgrade') { // improve one building by a level
    const item = f.items.find(i => i.id === a.id), cost = item && upCost(item); if (!item) return no('That is not on the farm any more.');
    if (!cost) return no('That is as good as it gets.');
    album(f); const block = upBlock(f, item); if (block) return no(block); // a farmhouse level, or album pages for the museum
    if (!canAfford(f.inv, cost)) return no('Not enough materials for that yet.');
    pay(f.inv, cost); item.lv = lvOf(item) + 1;
    return ok({ did: 'upgrade', id: item.id });
  }
  if (a.t === 'train') { // choose who trains at the Training Yard: slow experience every hour
    const slots = topLv(f, 'yard'); if (!slots) return no('Build a Training Yard first.');
    const ids = cleanIds(a.pets).slice(0, slots); if (ids.some(id => !f.pets.some(x => x.id === id))) return;
    if (ids.some(id => away(f, id, true) && !f.train?.ids.includes(id))) return no('A pet that is out exploring cannot start training. Welcome it home first.');
    if (ids.some(id => cuddling(f, id))) return no('A pet that is cuddling in the Nest cannot train.');
    unwork(f, ids); f.train = { ids, at: Date.now() };
    return ok({ did: 'train' });
  }
  if (a.t === 'expand') {
    const i = SIZES.indexOf(f.size) + 1; if (i >= SIZES.length) return no('The farm is as big as it gets.');
    const house = LAND_HOUSE[i] || 1; if ((f.house || 1) < house) return no(`Growing the land again needs a level ${house} farmhouse.`);
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
    const z = own(ZONES, a.zone), tr = own(TRIPS, a.trip);
    if (!z || !tr || !Array.isArray(a.pets)) return;
    if (!countOf(f, 'gate')) return no('Build an Expedition Gate first.');
    const ids = [...new Set(a.pets)];
    if (ids.some(id => cuddling(f, id))) return no('One of them is cuddling in the Nest.');
    const max = Math.max(1, topLv(f, 'gate'));
    if (parties(f).length >= max) return no(max > 1 ? `All ${max} of your parties are out.` : 'Your pets are already out exploring.');
    if (ids.some(id => away(f, id, true))) return no('One of them is already out with another party.');
    if (f.pets.some(x => x.held && ids.includes(x.id))) return no('One of them is promised in a trade.');
    if ((f.house || 1) < z.house) return no(`${z.name} opens at farmhouse level ${z.house}.`);
    if (!ids.length || ids.length > PARTY || ids.length !== a.pets.length || !ids.every(id => f.pets.some(x => x.id === id))) return no('Pick one to three of your pets.');
    const w = wx(); // the weather they set off in travels with them: more loot in the sun, a tailwind, rainbow luck
    parties(f).push({ id: rid(), zone: a.zone, trip: a.trip, pets: ids, at: Date.now(), until: Date.now() + tr.min * 60_000 * (w === 'wind' ? .8 : 1) * (1 - (unwork(f, ids), boost(f, 'gate'))) * (buffUse(f, 'gate') ? BOOSTS.gate.x : 1), ...(w === 'sunny' || w === 'rainbow' || w === 'wind' ? { w } : {}) });
    if (f.train?.ids.some(id => ids.includes(id))) { trainTick(f); f.train.ids = f.train.ids.filter(id => !ids.includes(id)); } // leaving on a trip ends its training
    return ok({ did: 'send' });
  }
  if (a.t === 'collect') { // the party is back: unpack what it found
    const t = parties(f).find(q => q.id === a.id) || parties(f).find(q => q.until <= Date.now()) || parties(f)[0]; if (!t) return no('Nobody is out exploring.');
    if (Date.now() < t.until) return no('They are not back yet.');
    const party = f.pets.filter(x => t.pets.includes(x.id)), z = ZONES[t.zone], tr = TRIPS[t.trip];
    const loot = {};
    for (const [k, n] of Object.entries(tripLoot(t.zone, t.trip, party))) {
      const v = n * (.85 + Math.random() * .3) * (party.some(x => x.talent === 1) ? 1.1 : 1) * (t.w === 'sunny' ? 1.2 : 1), whole = Math.floor(v) + (Math.random() < v % 1 ? 1 : 0); // a fraction is a chance of one more
      if (whole > 0) loot[k] = whole;
    }
    let spilt = false;
    for (const [k, n] of Object.entries(loot)) if (store(f, k, n) < n) spilt = true; // storage is full: the rest is left behind
    const grew = [];
    for (const pet of party) { const g = learn(pet, tr.xp); if (g) grew.push(g); }
    // a wild pet may follow them home, if there is a bed for it. The very first trip always brings one.
    let found = null, full = false;
    if (!f.trips || Math.random() < tr.find * (t.w === 'rainbow' ? 2 : 1) + (party.some(x => x.talent === 4) ? .08 : 0)) {
      if (f.pets.length >= allRoom(f)) full = true;
      else {
        const bag = Object.entries(z.wild); let roll = Math.random() * bag.reduce((n, [, w]) => n + w, 0);
        const sp = (bag.find(([, w]) => (roll -= w) < 0) || bag[0])[0];
        found = newPet(sp, p.user, true); found.from = t.zone; f.pets.push(found); settle(f, found);
      }
    }
    // Sometimes a wild pet stands in the way instead: a short battle the party can take or leave.
    let wild = null;
    if (f.trips && !found && party.length && Math.random() < WILD_CHANCE) {
      const bag = Object.entries(z.wild); let roll = Math.random() * bag.reduce((n, [, w]) => n + w, 0);
      const sp = (bag.find(([, w]) => (roll -= w) < 0) || bag[0])[0], lv = Math.min(MAX_LV, Math.max(2, Math.round(party.reduce((n, x) => n + x.lv, 0) / party.length) + 2));
      f.wild = { sp, lv, pets: t.pets, zone: t.zone, until: Date.now() + WILD_MS, pet: wildPet(sp, p.user) }; wild = { sp, lv };
    }
    parties(f).splice(parties(f).indexOf(t), 1); f.trips = (f.trips || 0) + 1;
    return ok({ did: 'collect', back: { zone: t.zone, trip: t.trip, pets: t.pets, w: t.w || null, loot, xp: tr.xp, grew, found: found?.id || null, full, spilt, wild } });
  }
  if (a.t === 'pick') { // gather every ripe Garden Plot; each starts growing again
    const ripe = f.items.filter(i => i.type === 'garden' && !ripeIn(f, i)); if (!ripe.length) return no('Nothing is ripe yet.');
    const wet = wx() === 'rain' ? ripe.length : 0; // rain-fed plots give one more each
    const got = store(f, 'berries', ripe.length * BERRIES + wet); if (!got) return no('There is no room for more berries. Cook some, or build a Storage Barn.');
    const sun = ripe.reduce((n, i) => n + lvOf(i) - 1, 0); if (sun) f.inv.sunberry = (f.inv.sunberry || 0) + sun; // better plots also grow Sunberries
    for (const i of ripe) i.at = Date.now();
    return ok({ did: 'pick', got, sun, wet });
  }
  if (a.t === 'cook') {
    const r = own(RECIPES, a.what); if (!r) return;
    if (!countOf(f, 'kitchen')) return no('Build a Kitchen first.');
    if (topLv(f, 'kitchen') < (r.lv || 1)) return no(`That recipe needs a level ${r.lv} Kitchen.`);
    if (!canAfford(f.inv, r.cost)) return no('Not enough for that recipe yet.');
    const extra = Math.random() < boost(f, 'kitchen'); // the helper at the oven sometimes bakes a second one
    const twice = buffUse(f, 'kitchen'); // a Lucky Wheel booster doubles the batch
    pay(f.inv, r.cost); f.inv[a.what] = (f.inv[a.what] || 0) + 1 + extra + twice;
    return ok({ did: 'cook', what: a.what, extra, twice });
  }
  if (a.t === 'feed') { // a treat for one pet: experience straight away
    const r = own(RECIPES, a.what), pet = f.pets.find(x => x.id === a.pet); if (!(r?.xp || r?.rest) || !pet) return;
    if (!(f.inv[a.what] > 0)) return no('You have none of those left.');
    if (r.rest) { if (!((pet.rest || 0) > Date.now())) return no(`${pet.name} is not tired.`); if (cuddling(f, pet.id)) return no(`${pet.name} is busy in the Nest.`); f.inv[a.what]--; pet.rest = 0; return ok({ did: 'feed', what: a.what, pet: pet.id, grew: null }); }
    if (pet.lv >= MAX_LV) return no(`${pet.name} is fully grown and just wants cuddles.`);
    if (away(f, pet.id)) return no(`${pet.name} is away exploring.`);
    f.inv[a.what]--;
    return ok({ did: 'feed', what: a.what, pet: pet.id, grew: learn(pet, r.xp) });
  }
  if (a.t === 'sell') return no('The Workshop swaps materials now. Open it again to swap.'); // an old page still showing the sell window
  if (a.t === 'swap') { // the Workshop swaps one material for another (rates in data.js swapDeal)
    if (!countOf(f, 'workshop')) return no('Build a Workshop first.');
    const d = swapDeal(String(a.give), String(a.get), topLv(f, 'workshop')); if (!d || !d.get) return no('The Workshop cannot do that swap.');
    const n = Math.max(1, Math.min(SWAP_MAX, a.n | 0)), pay = d.pay * n, get = d.get * n;
    if ((f.inv[a.give] || 0) < pay) return no('You do not have enough of that to swap.');
    if (STORED.includes(a.get) && (f.inv[a.get] || 0) + get > capOf(f)) return no('There is no room for that many. Spend some, or build a Storage Barn.');
    f.inv[a.give] -= pay; f.inv[a.get] = (f.inv[a.get] || 0) + get;
    return ok({ did: 'swap', give: a.give, pay, get: a.get, got: get });
  }
  if (a.t === 'pair') { // two pets go to the Nest; b may be a friend's pet that is open for playdates
    if (!countOf(f, 'nest')) return no('Build a Nest first.');
    const slot = SLOTS.slice(0, nestMax(f)).find(s => !f[s]); if (!slot) return no('The Nest is busy.');
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
    if (away(f, A.id) || (!friend && away(f, Bp.id))) return no('One of them is away exploring.');
    if (cuddling(f, A.id) || (!friend && cuddling(f, Bp.id))) return no('One of them is already in the Nest.');
    if (f.train?.ids.some(id => id === A.id || (!friend && id === Bp.id))) return no('One of them is training at the yard. Take it off training first.');
    const kid = makeBaby(A, Bp);
    kid.par = [A, Bp].map((x, i) => ({ ...snapshot(x, i && friend ? friend.name : p.name), par: (x.par || []).map(g => ({ name: g.name, sp: g.sp, lv: g.lv, look: g.look, own: g.own })) }));
    f[slot] = { a: A.id, b: friend ? snapshot(Bp, friend.name) : Bp.id, friend, at: now, hours: hatchHours(kid.sp) * (topLv(f, 'nest') >= 3 ? .75 : 1) * (1 - (unwork(f, [A.id, friend ? '' : Bp.id]), boost(f, 'nest'))) * (buffUse(f, 'nest') ? BOOSTS.nest.x : 1), shell: shellOf(A, Bp), kid };
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
    const slot = SLOTS.includes(a.slot) ? a.slot : SLOTS.find(s => nestView(f, s)?.stage === 'ready') || 'nest';
    const v = nestView(f, slot); if (!v) return no('There is no egg.');
    if (v.stage !== 'ready') return no('The egg is not ready yet.');
    if (f.pets.length >= allRoom(f)) return no('There is no bed for the baby. Build a Pet Hut first.');
    const kid = { id: rid(), name: SPECIES[f[slot].kid.sp].name, ...f[slot].kid, first: p.user, born: Date.now(), bred: true };
    f.pets.push(kid); settle(f, kid); delete f[slot];
    return ok({ did: 'hatch', born: kid.id });
  }
  if (a.t === 'petopen') { // let visiting friends pick this pet for a playdate (up to three)
    const pet = f.pets.find(x => x.id === a.id); if (!pet) return;
    if (!pet.open && pet.lv < BREED_LV) return no(`It needs to be level ${BREED_LV} first.`);
    if (!pet.open && f.pets.filter(x => x.open).length >= 3) return no('Three pets can be open for playdates at once.');
    pet.open = !pet.open;
    return ok({ did: 'petopen' });
  }
  if (a.t === 'fav') { // mark a pet as a favourite (or not): favourites come first in every pet picker. Only the owner sees it.
    const pet = f.pets.find(x => x.id === a.id); if (!pet) return;
    if (a.on === undefined ? !pet.fav : a.on) pet.fav = true; else delete pet.fav;
    return ok({ did: 'fav' });
  }
  if (a.t === 'offer') { // propose a swap to another farm
    const hit = byFid(a.to); if (!hit || hit[1] === f) return no('That farm is not around any more.');
    if (a.give?.mats?.coins || a.want?.mats?.coins) return no('Coins cannot be traded. They stay with you.');
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
    if (o && hasCoins(o)) { sweep(from); o = null; }
    if (!o) return no('That offer is gone.');
    if (!a.ok) { release(from, o); post(from, { k: 'note', text: `${p.name} said no to your trade offer. Everything came back.` }); return ok({ did: 'tradeno' }); }
    const theirs = o.give.pets.map(id => from.pets.find(q => q.id === id)), mine = o.want.pets.map(id => f.pets.find(q => q.id === id));
    if (theirs.some(q => !q)) { release(from, o); return no('That offer is gone.'); }
    if (mine.some(q => !q || !tradable(f, q))) return no('One of the pets they ask for cannot be traded right now.');
    if (!canAfford(f.inv, o.want.mats)) return no('You do not have what they ask for.');
    const net = theirs.length - mine.length;
    if (f.pets.length + net > allRoom(f)) return no('You need another bed first. Build a Pet Hut.');
    if (from.pets.length - net > allRoom(from)) return no('Their farm has no bed free for your pet.');
    if (f.pets.length + net < 1 || from.pets.length - net < 1) return no('Every farm keeps at least one pet.');
    const move = (q, a2, b2) => { a2.pets.splice(a2.pets.indexOf(q), 1); delete q.held; delete q.fav; q.open = false; unwork(a2, [q.id]); if (a2.def) a2.def = a2.def.filter(id => id !== q.id); b2.pets.push(q); settle(b2, q); };
    for (const q of theirs) move(q, from, f);
    for (const q of mine) move(q, f, from);
    pay(f.inv, o.give.mats, 1); pay(f.inv, o.want.mats); pay(from.inv, o.want.mats, 1);
    from.offers.splice(from.offers.indexOf(o), 1);
    post(from, { k: 'note', text: `${p.name} accepted your trade. Your new things are on the farm.` });
    for (const side of [f, from]) { side.pals ||= {}; }
    f.pals[fid(from)] = (f.pals[fid(from)] || 0) + 1; from.pals[fid(f)] = (from.pals[fid(f)] || 0) + 1;
    return ok({ did: 'tradeyes' });
  }
  if (a.t === 'world') { callOn(p, null); // everyone's islands, most recently active first
    const mine = daily(f, 'help'), gifts = daily(f, 'gift');
    const pals = new Set(friendPids(p.pid));
    const others = [...farms].filter(([, x]) => x !== f && x.pets.length).sort((a, b) => pals.has(b[0]) - pals.has(a[0]) || (b[1].seen || 0) - (a[1].seen || 0)).slice(0, 30)
      .map(([pid, x]) => ({ ...look(pid, x), friend: pals.has(pid), helps: HELPS - (mine[fid(x)] || 0), gift: !gifts[fid(x)], pal: f.pals?.[fid(x)] || 0,
        open: x.pets.some(q => q.open), egg: SLOTS.some(s => x[s] && nestView(x, s).stage !== 'cuddle') }));
    return reply({ t: 'farm', world: others, farm: view(f, p) });
  }
  if (a.t === 'leave') { callOn(p, null); return; }
  if (a.t === 'visit' || a.t === 'help' || a.t === 'gift') {
    const hit = byFid(a.id); if (!hit || hit[1] === f) return no('That farm is not around any more.');
    const [pid, x] = hit, id = fid(x);
    callOn(p, pid);
    saw(f, x.pets.filter(q => !away(x, q.id)).map(q => q.sp));
    const there = () => ({ ...look(pid, x), pets: x.pets.filter(q => !away(x, q.id)).map(q => ({ id: q.id, sp: q.sp, name: q.name, lv: q.lv, look: lookOf(q), col: q.col, pat: q.pat, el: q.el, cat: q.cat, open: !!q.open, lodge: !!q.lodge, can: tradable(x, q), rest: Math.max(0, (q.rest || 0) - Date.now()) })), nest: nestView(x), nests: SLOTS.map(q => nestView(x, q)).filter(Boolean), garden: gardenView(x), train: { ids: x.train?.ids || [] }, trips: parties(x).map(t => ({ left: Math.max(1, t.until - Date.now()) })).filter(t => t.left > 1),
      album: album(x),
      helps: HELPS - (daily(f, 'help')[id] || 0), gift: !daily(f, 'gift')[id], dated: !!daily(f, 'date')[id], pal: f.pals?.[id] || 0, team: defenders(x).length });
    if (a.t === 'help') { // a little tidying: coins for the helper, and the owner's party comes home sooner
      const h = daily(f, 'help'); if ((h[id] || 0) >= HELPS) return reply({ t: 'farm', err: 'You have helped here as much as you can today.', visit: there(), farm: view(f, p) });
      h[id] = (h[id] || 0) + 1; f.inv.coins = (f.inv.coins || 0) + 3;
      const out = parties(x).find(t => t.until > Date.now()), egg = SLOTS.find(s => x[s] && nestView(x, s).stage !== 'ready');
      const plot = x.items.find(i => i.type === 'garden' && ripeIn(x, i) > 0);
      if (out) out.until -= HELP_CUT; else if (plot) plot.at -= HELP_CUT; /* watering */ else if (egg) { x[egg].at -= HELP_CUT; x[egg].cheers = (x[egg].cheers || 0) + 1; } else x.inv.coins = (x.inv.coins || 0) + 2;
      const m = (x.mail || []).find(q => q.k === 'help' && q.from === p.name && dayOf(q.at) === today());
      if (m) m.n++; else post(x, { k: 'help', from: p.name, n: 1 });
      scheduleSave();
      return reply({ t: 'farm', visit: there(), farm: view(f, p), did: 'help' });
    }
    if (a.t === 'gift') {
      const g = daily(f, 'gift'); if (g[id]) return reply({ t: 'farm', err: 'One gift a day for each neighbour.', visit: there(), farm: view(f, p) });
      if (a.item) { // a decoration: the giver pays for it, the friend places it for free
        const it = own(ITEMS, a.item); if (!it || it.kind !== 'd' || it.pals || it.wheel) return;
        if (it.craft && topLv(f, 'workshop') < it.craft) return reply({ t: 'farm', err: 'Your Workshop cannot make that yet.', visit: there(), farm: view(f, p) });
        if (!canAfford(f.inv, it.cost)) return reply({ t: 'farm', err: 'You do not have the materials for that.', visit: there(), farm: view(f, p) });
        pay(f.inv, it.cost); g[id] = 1; (f.pals ||= {})[id] = (f.pals[id] || 0) + 1;
        post(x, { k: 'gift', from: p.name, item: a.item });
        scheduleSave();
        return reply({ t: 'farm', visit: there(), farm: view(f, p), did: 'gift' });
      }
      const n = own(GIFTS, a.mat); if (!n) return reply({ t: 'farm', err: a.mat === 'coins' ? 'Coins cannot be gifted. They stay with you.' : 'That cannot be a gift.', visit: there(), farm: view(f, p) });
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
    const m = (f.mail || []).find(q => q.id === a.id && (q.got || q.item || q.pet || q.boost)); if (!m) return no('That is not in your mailbox any more.');
    let born = null;
    if (m.pet) { // a Lucky Wheel baby: it needs a bed, and waits in the mailbox until there is one
      if (!SPECIES[m.pet.sp]) { f.mail.splice(f.mail.indexOf(m), 1); return ok(); }
      if (f.pets.length >= allRoom(f)) return no('There is no bed free. Build a Pet Hut and the baby will wait here.');
      const pet = newPet(m.pet.sp, p.user, true); if (m.pet.el && ELEMENTS[m.pet.el] && m.pet.el !== SPECIES[pet.sp].el) pet.el = m.pet.el;
      f.pets.push(pet); settle(f, pet); born = pet.id;
    } else if (m.boost) { if (BOOSTS[m.boost]) (f.tokens ||= {})[m.boost] = (f.tokens[m.boost] || 0) + 1; }
    else if (m.item) { if (ITEMS[m.item]) (f.stash ||= {})[m.item] = (f.stash[m.item] || 0) + 1; } else pay(f.inv, m.got, 1);
    f.mail.splice(f.mail.indexOf(m), 1);
    return ok({ did: 'claim', got: m.got || {}, item: m.item, born, boost: m.boost });
  }
  if (a.t === 'mailread') { // throw away everything that is only a note
    if (!countOf(f, 'mailbox')) return no('Build a Mailbox to open your mail.');
    f.mail = (f.mail || []).filter(q => q.got || q.item || q.pet || q.boost);
    return ok({ did: 'mailread' });
  }
  if (a.t === 'foes') return reply({ t: 'farm', foes: foes(f), farm: view(f, p) });
  if (a.t === 'ranks') return reply({ t: 'farm', ranks: ranks(f), farm: view(f, p) });
  if (a.t === 'defend') { // choose the team that defends this farm
    const ids = Array.isArray(a.pets) ? [...new Set(a.pets)] : [];
    if (!ids.length || ids.length > PARTY || !ids.every(id => f.pets.some(x => x.id === id))) return no('Pick one to three of your pets.');
    f.def = ids;
    return ok({ did: 'defend' });
  }
  if (a.t === 'fight') { // start a battle: practice at the Training Yard, or a match at the Arena Flag
    if (a.mode === 'wild') { // the wild pet met on the way home: one try, with the party that met it
      const w = wildOf(f); if (!w) return no('The wild pet has wandered off.');
      const mine = w.pets.map(id => f.pets.find(x => x.id === id)).filter(x => x && !away(f, x.id) && !cuddling(f, x.id));
      if (!mine.length) return no('The pets that met it are busy right now.');
      if (battles.has(p.pid) || lives.has(p.pid)) return no('Finish your battle first.');
      f.wild = null; saw(f, [w.sp]);
      const B = newBattle(mine.map(x => unit(x)), [unit({ ...bot(w.sp, w.lv, 0), col: w.pet?.col, pat: w.pet?.pat, sparkle: w.pet?.sparkle })], { mode: 'wild', foe: `a wild ${SPECIES[w.sp].name}` });
      B.ids = mine.map(x => x.id); B.wild = w; battles.set(p.pid, B);
      return reply({ t: 'farm', battle: battleView(B), ev: [], did: 'fight' });
    }
    const mode = a.mode === 'arena' ? 'arena' : 'practice';
    if (!countOf(f, mode === 'arena' ? 'flag' : 'yard')) return no(mode === 'arena' ? 'Put up an Arena Flag first.' : 'Build a Training Yard first.');
    const ids = Array.isArray(a.pets) ? [...new Set(a.pets)] : [];
    const mine = ids.map(id => f.pets.find(x => x.id === id));
    if (!ids.length || ids.length > PARTY || ids.length !== a.pets.length || mine.some(x => !x)) return no('Pick one to three of your pets.');
    if (ids.some(id => away(f, id, true))) return no('One of them is away exploring.');
    if (ids.some(id => cuddling(f, id))) return no('One of them is cuddling in the Nest.');
    let B;
    if (mode === 'arena') {
      let foe, team, to = null;
      if (String(a.foe).startsWith('npc:')) { const n = own(NPCS, String(a.foe).slice(4)); if (!n) return; foe = n.name; team = n.team.map((sp, i) => unit(bot(sp, ARENA_LV, i))); }
      else {
        const hit = [...farms].find(([, x]) => x !== f && x.fid === a.foe && x.pets.length); if (!hit) return no('That farm is not around any more.');
        to = hit[0]; foe = nameOf(hit[0], hit[1]); team = defenders(hit[1]).map(x => unit(x, ARENA_LV));
      }
      saw(f, team.map(u => u.sp));
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
    if (ids.some(id => away(f, id))) return no('One of them is away exploring.');
    if (ids.some(id => cuddling(f, id))) return no('One of them is cuddling in the Nest.');
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
    if (ids.some(id => away(f, id))) return no('One of them is away exploring.');
    if (ids.some(id => cuddling(f, id))) return no('One of them is cuddling in the Nest.');
    if (battles.has(p.pid) || lives.has(p.pid) || battles.has(inv.from) || lives.has(inv.from)) return no('One of you is already in a battle.');
    saw(f, theirs.map(x => x.sp)); saw(other, mine.map(x => x.sp));
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
      Object.assign(prize, { coins: r.coins, xp: Math.round(r.xp * (wx() === 'cloudy' ? 1.25 : 1)), pts: r.pts });
      if (won && B.mode === 'arena') { prize.rank = RANK_XP.arena; hubXp(p, RANK_XP.arena); }
      if (won && B.mode === 'wild') { // beaten fairly, it asks to come along, if there is a bed
        if (f.pets.length < allRoom(f)) { const pet = newPet(B.wild.sp, p.user, true); pet.from = B.wild.zone; f.pets.push(pet); settle(f, pet); prize.joined = pet.id; }
        else { prize.noroom = true; r.coins && (f.inv.coins = (f.inv.coins || 0) + 6, prize.coins += 6); }
      }
      if (prize.joined && B.wild.pet) Object.assign(f.pets.find(x => x.id === prize.joined), B.wild.pet); // the same coat, markings and sparkle it fought with
      f.inv.coins = (f.inv.coins || 0) + r.coins; f.pts = (f.pts || 0) + r.pts;
      for (const id of B.ids) { const pet = f.pets.find(x => x.id === id), g = pet && learn(pet, prize.xp); if (g) prize.grew.push(g); }
    }
    if (B.to && !quit) { // the defender hears about it, and earns a little when their team held
      const d = farms.get(B.to);
      // the defender's 5 coins only come from the attacker's rewarded matches (5 a day), and at most HOLDS_DAILY times a
      // day, so nobody can lose on purpose again and again to fill a friend's (or their own second account's) purse
      if (d) {
        const pay = !won && prize.counted && used(d, 'held') < HOLDS_DAILY;
        if (pay) { if (d.fights?.day !== today()) d.fights = { day: today() }; d.fights.held = (d.fights.held || 0) + 1; d.inv.coins = (d.inv.coins || 0) + 5; }
        if (!won && prize.counted) d.wins = (d.wins || 0) + 1;
        post(d, { k: 'battle', from: p.name, held: !won });
      }
    }
    return ok({ battle: battleView(B), ev, prize, did: 'fought' });
  }
  if (a.t === 'boost') { // start a Lucky Wheel booster at one of the buildings
    const b = own(BOOSTS, a.type); if (!b) return;
    if (!(f.tokens?.[a.type] > 0)) return no('You have no booster for that building.');
    if (!countOf(f, a.type)) return no('You need that building on your farm first.');
    if (buffOn(f, a.type)) return no('A booster is already running there.');
    if (a.type === 'yard') trainTick(f);
    (f.buff ||= {})[a.type] = b.hours ? Date.now() + b.hours * HOUR : b.uses;
    if (a.type === 'garden') { const now = Date.now(); for (const i of f.items) if (i.type === 'garden') i.at = now - Math.min(now - (i.at || 0), growMs(f, i)) / b.x; f.gbuff = f.buff.garden; } // growth so far is kept
    if (!--f.tokens[a.type]) delete f.tokens[a.type];
    return ok({ did: 'boost', type: a.type });
  }
  if (a.t === 'work') { // put a pet of the right element to work at a building, or send the helper home (no id)
    const w = own(WORK, a.type); if (!w) return;
    if (!topLv(f, a.type)) return no('You need that building on your farm first.');
    f.work ||= {};
    if (!a.id) { delete f.work[a.type]; return ok({ did: 'work', type: a.type }); }
    const pet = f.pets.find(x => x.id === a.id); if (!pet) return no('That pet is not here any more.');
    if (!canWork(pet, a.type)) return no(`Only ${w.el} pets can work at the ${ITEMS[a.type].name}.`);
    if (away(f, pet.id, true)) return no(`${pet.name} is out exploring. Welcome it home first.`);
    if (cuddling(f, pet.id)) return no(`${pet.name} is cuddling in the Nest.`);
    if (f.train?.ids.includes(pet.id)) { trainTick(f); f.train.ids = f.train.ids.filter(id => id !== pet.id); } // one job at a time
    if (a.type === 'yard') trainTick(f);
    unwork(f, [pet.id]); f.work[a.type] = pet.id;
    return ok({ did: 'work', type: a.type, pet: pet.id });
  }
  if (a.t === 'lodge') { // pets go into storage in the Pet Lodge (into one of its collections), or back out to beds on the island
    const ids = cleanIds(a.ids || [a.id]).slice(0, 400), pets = ids.map(id => f.pets.find(x => x.id === id));
    if (!ids.length || pets.some(x => !x)) return no('That pet is not here any more.');
    if (a.on) {
      if (!countOf(f, 'lodge')) return no('Build a Pet Lodge first.');
      const shelf = a.shelf && (f.shelves || []).some(x => x.id === a.shelf) ? a.shelf : null;
      const fresh = pets.filter(x => !x.lodge);
      if (f.pets.filter(x => x.lodge).length + fresh.length > lodgeRoom(f)) return no('The Pet Lodge is full. Improve it to make room for more.');
      if (fresh.some(x => away(f, x.id, true))) return no('One of them is out exploring. Welcome it home first.');
      if (fresh.some(x => cuddling(f, x.id) || SLOTS.some(s => f[s]?.a === x.id))) return no('One of them is busy in the Nest.');
      if (fresh.some(x => x.held)) return no('One of them is promised in a trade.');
      if (fresh.length && f.pets.length - f.pets.filter(x => x.lodge).length - fresh.length < 1) return no('Keep at least one pet out on the island.');
      if (battles.has(p.pid) || lives.has(p.pid)) return no('Finish the battle first.');
      const out = fresh.map(x => x.id);
      if (f.train?.ids.some(id => out.includes(id))) { trainTick(f); f.train.ids = f.train.ids.filter(id => !out.includes(id)); }
      unwork(f, out); if (f.def) f.def = f.def.filter(id => !out.includes(id));
      for (const x of pets) { x.lodge = true; x.open = false; if (shelf) x.shelf = shelf; else if (fresh.includes(x)) delete x.shelf; }
    } else {
      const back = pets.filter(x => x.lodge);
      if (f.pets.filter(x => !x.lodge).length + back.length > petRoom(f)) return no('Every bed on the island is taken. Build or improve a Pet Hut first.');
      for (const x of back) { delete x.lodge; delete x.shelf; }
    }
    return ok({ did: 'lodge', ids, on: !!a.on });
  }
  if (a.t === 'shelf') { // the Lodge's collections: make one, rename it, empty it away, or sort stored pets into one
    f.shelves ||= [];
    const name = safeText(String(a.name || '')).trim().slice(0, SHELF_NAME);
    if (a.op === 'new') {
      if (!countOf(f, 'lodge')) return no('Build a Pet Lodge first.');
      const max = SHELF_MAX; if (f.shelves.length >= max) return no(`A Lodge holds up to ${max} collections.`);
      const sh = { id: rid(), name: name || `#${f.shelves.length + 1}` }; f.shelves.push(sh);
      return ok({ did: 'shelf', op: 'new', id: sh.id });
    }
    const sh = f.shelves.find(x => x.id === a.id);
    if (a.op === 'put') { // a.id may be empty: out of every collection
      const ids = cleanIds(a.ids).slice(0, 400), pets = ids.map(id => f.pets.find(x => x.id === id));
      if (a.id && !sh) return no('That collection is gone.');
      if (!pets.length || pets.some(x => !x || !x.lodge)) return no('Only pets stored in the Lodge go into its collections.');
      for (const x of pets) { if (sh) x.shelf = sh.id; else delete x.shelf; }
      return ok({ did: 'shelf', op: 'put', id: sh?.id || '' });
    }
    if (!sh) return no('That collection is gone.');
    if (a.op === 'name') { if (!name) return no('Give it a name first.'); sh.name = name; return ok({ did: 'shelf', op: 'name', id: sh.id }); }
    if (a.op === 'left' || a.op === 'right') { const i = f.shelves.indexOf(sh), j = i + (a.op === 'left' ? -1 : 1); if (j >= 0 && j < f.shelves.length) [f.shelves[i], f.shelves[j]] = [f.shelves[j], f.shelves[i]]; return ok({ did: 'shelf', op: 'move', id: sh.id }); }
    if (a.op === 'del') { for (const x of f.pets) if (x.shelf === sh.id) delete x.shelf; f.shelves.splice(f.shelves.indexOf(sh), 1); return ok({ did: 'shelf', op: 'del' }); }
    return;
  }
  if (a.t === 'group') { // saved expedition groups: a name and up to PARTY pets, so a usual party is one tap away
    f.groups ||= [];
    const g = a.id && f.groups.find(x => x.id === a.id);
    if (a.op === 'save') {
      const ids = cleanIds(a.pets).filter(id => f.pets.some(x => x.id === id)).slice(0, PARTY);
      if (!ids.length) return no('Pick some pets for the group first.');
      const name = safeText(String(a.name || '')).trim().slice(0, GROUP_NAME);
      if (a.id && !g) return no('That group is gone.');
      if (g) { g.pets = ids; if (name) g.name = name; return ok({ did: 'group', op: 'save', id: g.id }); }
      const max = GROUP_MAX; if (f.groups.length >= max) return no(`You can save up to ${max} groups.`);
      const n = { id: rid(), name: name || `#${f.groups.length + 1}`, pets: ids }; f.groups.push(n);
      return ok({ did: 'group', op: 'new', id: n.id });
    }
    if (!g) return no('That group is gone.');
    if (a.op === 'del') { f.groups.splice(f.groups.indexOf(g), 1); return ok({ did: 'group', op: 'del' }); }
    return;
  }
  if (a.t === 'free') { // let a pet go for good: it leaves a few berries as a thank-you, and the album keeps its page
    const pet = f.pets.find(x => x.id === a.id); if (!pet) return no('That pet is not here any more.');
    if (f.pets.length <= 1) return no('Every farm keeps at least one pet.');
    if (battles.has(p.pid) || lives.has(p.pid)) return no('Finish the battle first.');
    if (pet.held) return no(`${pet.name} is promised in a trade. Take the offer back first.`);
    if (away(f, pet.id, true)) return no(`${pet.name} is out exploring. Welcome it home first.`);
    if (cuddling(f, pet.id)) return no(`${pet.name} is cuddling in the Nest.`);
    album(f); // its page and growth forms stay in the album
    if (f.train?.ids.includes(pet.id)) { trainTick(f); f.train.ids = f.train.ids.filter(id => id !== pet.id); }
    unwork(f, [pet.id]);
    if (f.def) f.def = f.def.filter(id => id !== pet.id); // the defence team fills its gap by itself
    f.pets.splice(f.pets.indexOf(pet), 1);
    const got = FREE_GIFT + Math.min(pet.lv, FREE_GIFT_LV);
    f.inv.berries = (f.inv.berries || 0) + got;
    return ok({ did: 'free', gone: tiny(pet), got });
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
  const got = {}; for (const [k, n] of Object.entries(mats || {})) if (own(MATS, k) && Number.isInteger(n) && n > 0 && n <= 100000) got[k] = n;
  if (!Object.keys(got).length) return 0;
  for (const [pid, f] of farms) {
    post(f, { k: 'gift', from: 'Zatoka Gier', got: { ...got }, ...(text ? { text: String(text).slice(0, 120) } : {}) });
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
  if (!process.env.FARM_TEST || !a) return;
  if (a.weather !== undefined) wxPin = a.weather || null; // 'none' switches the bonuses off
  const f = farms.get(pid); if (!f) return;
  if (a.home) for (const t of parties(f)) t.until = 0;
  if (a.liveUsed !== undefined) { if (f.fights?.day !== today()) f.fights = { day: today() }; f.fights.live = a.liveUsed; }
  if (a.give) for (const [k, n] of Object.entries(a.give)) f.inv[k] = (f.inv[k] || 0) + n;
  if (a.trips !== undefined) f.trips = a.trips;
  if (a.house) f.house = a.house; // a farmhouse level, e.g. one that has not been built into the game yet
  if (a.oldOffer) { const hit = byFid(a.oldOffer); if (hit) { f.inv.coins -= 5; (f.offers ||= []).push({ id: rid(), to: hit[0], give: { pets: [], mats: { coins: 5 } }, want: { pets: [], mats: {} }, at: Date.now() }); } } // an offer from before coins stopped being tradable
  if (a.pet && own(SPECIES, a.pet)) { const q = { ...newPet(a.pet, 'test', true), ...(a.traits || {}) }; f.pets.push(q); settle(f, q); }
  if (a.lv) for (const x of f.pets) x.lv = a.lv;
  if (a.rested) for (const x of f.pets) x.rest = 0;
  if (a.pals) (f.pals ||= {}).test = a.pals;
  if (a.trained && f.train) f.train.at -= a.trained * HOUR;
  if (a.ripe) for (const i of f.items) if (i.type === 'garden') i.at = 0;
  if (a.wild && own(SPECIES, a.wild)) f.wild = { sp: a.wild, lv: 1, pets: f.pets.map(x => x.id), zone: 'woods', until: Date.now() + WILD_MS, pet: { ...wildPet(a.wild, 'test'), ...(a.wildTraits || {}) } };
  if (a.egg) for (const s of SLOTS) if (f[s]) f[s].at = a.egg === 'laid' ? Date.now() - CUDDLE_H * HOUR - 1000 : 0;
}
// A deleted account (store.deleteAccount): its farm, pets and open trade offers go.
export function forget(pid) {
  const L = lives.get(pid); if (L) liveTurn(L, L.pids.indexOf(pid)); // a live battle ends as if they left
  farms.delete(pid); battles.delete(pid); calls.delete(pid);
  for (const [k, v] of invites) if (v.from === pid || v.to === pid) invites.delete(k);
  for (const [v, c] of calls) if (c.host === pid) calls.delete(v);
  for (const f of farms.values()) if (f.offers?.some(o => o.to === pid)) f.offers = f.offers.filter(o => o.to !== pid);
  scheduleSave(); saveNow();
}

// Lucky Wheel: one free spin a day for accounts. The server picks the slice (the page only plays the result), pays
// coins straight away and sends Pet Farm prizes to the Mailbox. The numbers live in public/wheelprizes.js.
// The day turns over at midnight in Warsaw, on the same clock as Mystery Pet.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, addCoins, scheduleSave } from './store.js';
import { dayOf, untilNext } from './day.js';
import { wheelMail } from './farm.js';
import { PRIZES, LUCKY, PITY, SET_COINS, BOOSTS, PET_RARITY, SEASON_PETS, orderOn } from '../public/wheelprizes.js';
import { SPECIES, ELEMENTS } from '../public/games/farm/data.js';
import { VARIANT_CHANCE } from '../public/games/farm/breed.js';

const FILE = path.join(DATA_DIR, 'lucky-wheel.json');
const rnd = n => crypto.randomInt(n), pick = list => list[rnd(list.length)];

// ---------- the pet of the day ----------
// One species a day, the same for everyone, rolled once and written down so a restart never changes it.
let days = {};
export function load() {
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d.days && typeof d.days === 'object') days = d.days; }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); }
}
function save() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify({ v: 1, days })); fs.renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.error(`could not save ${FILE}:`, e.message); }
}
export function petOfDay(day = dayOf()) {
  if (SPECIES[days[day]]) return days[day];
  let roll = rnd(100), rare = PET_RARITY.findIndex(n => (roll -= n) < 0);
  const last = Object.keys(days).sort().pop(), of = r => Object.keys(SPECIES).filter(sp => SPECIES[sp].rare === r && !SPECIES[sp].el2 && sp !== days[last]);
  const from = of(rare).length ? of(rare) : of(0);
  days[day] = pick(from);
  const old = Object.keys(days).sort(); for (const d of old.slice(0, Math.max(0, old.length - 400))) delete days[d];
  save();
  return days[day];
}

// ---------- a player's wheel ----------
// On the profile: wheel = { day: last day spun, n: spins ever, dry: spins since the last lucky decoration,
//   lucky: [decorations won], last: the last result, hold: [prizes waiting for a Pet Farm to exist] }
const stateOf = p => { const s = p.wheel ||= { day: '', n: 0, dry: 0, lucky: [] }; if (!Array.isArray(s.lucky)) s.lucky = []; return s; };
// A Pet Farm prize goes to the Mailbox; with no farm yet it waits on the profile (wheel.hold)
// and farm.js moves it into the Mailbox once the farm exists.
function toFarm(p, s, m) { if (wheelMail(p.pid, m)) return 'mail'; (s.hold ||= []).push(m); if (s.hold.length > 60) s.hold.shift(); return 'hold'; }

let fixed = null; // tests only: the next slice
function roll(p, s, day) {
  const ORDER = orderOn(day);
  let i = fixed ?? rnd(ORDER.length); fixed = null;
  const missing = LUCKY.filter(t => !s.lucky.includes(t));
  if (ORDER[i] !== 'decor' && missing.length && s.dry >= PITY) i = ORDER.indexOf('decor'); // bad luck never lasts for ever
  const kind = ORDER[i], def = PRIZES[kind], prize = { kind };
  if (def.coins) { prize.coins = def.coins; addCoins(p.pid, def.coins); }
  else if (def.pick) { prize.got = { ...pick(def.pick) }; prize.where = toFarm(p, s, { got: prize.got }); }
  else if (kind === 'boost') { prize.boost = pick(Object.keys(BOOSTS)); prize.where = toFarm(p, s, { boost: prize.boost }); }
  else if (kind === 'pet') {
    const sp = petOfDay(), others = Object.keys(ELEMENTS).filter(e => e !== SPECIES[sp].el);
    prize.pet = { sp, ...(Math.random() < VARIANT_CHANCE ? { el: pick(others) } : {}) }; // the same odds of another element as an egg
    prize.where = toFarm(p, s, { pet: prize.pet });
  } else if (SEASON_PETS[kind]) { // the season pet: a baby, with the same odds of another element as an egg
    const sp = SEASON_PETS[kind].sp, others = Object.keys(ELEMENTS).filter(e => e !== SPECIES[sp].el);
    prize.pet = { sp, ...(Math.random() < VARIANT_CHANCE ? { el: pick(others) } : {}) }; prize.season = kind;
    prize.where = toFarm(p, s, { pet: prize.pet });
  } else if (!missing.length) { prize.coins = SET_COINS; prize.full = true; addCoins(p.pid, SET_COINS); }
  else { prize.item = pick(missing); s.lucky.push(prize.item); prize.where = toFarm(p, s, { item: prize.item }); }
  s.dry = kind === 'decor' ? 0 : s.dry + 1;
  return { i, prize };
}

function view(p) {
  const day = dayOf(), base = { t: 'wheel', day, next: untilNext(), pet: petOfDay(day), order: orderOn(day) };
  if (!p?.user) return { ...base, guest: true };
  const s = stateOf(p);
  return { ...base, spun: s.day === day, last: s.day === day ? s.last : null, lucky: s.lucky, n: s.n, sure: Math.max(0, PITY - s.dry) };
}
// Messages from the page: {} look, { spin: true }.
export function handle(p, m, reply) {
  if (!p?.user || !m.spin) return reply(view(p));
  const day = dayOf(), s = stateOf(p);
  if (s.day === day) return reply({ ...view(p), err: 'You already had today’s spin. Come back tomorrow.' });
  const r = roll(p, s, day);
  s.day = day; s.n = (s.n || 0) + 1; s.last = r;
  scheduleSave();
  reply({ ...view(p), won: r });
}
// Tests only (WHEEL_TEST set): { slice: n } fixes the next spin, { again: true } gives today's spin back,
// { dry: n } sets the bad luck counter.
export function testHook(p, a) {
  if (!process.env.WHEEL_TEST || !a) return;
  if (Number.isInteger(a.slice)) fixed = a.slice;
  if (p?.user && a.again) stateOf(p).day = '';
  if (p?.user && Number.isInteger(a.dry)) stateOf(p).dry = a.dry;
}

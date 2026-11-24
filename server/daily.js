// Mystery Pet: the daily guessing puzzle. Everyone gets the same secret Pet Farm pet, picked at midnight in Warsaw.
// A guess is any pet; the answer comes back as clues (element, home, rarity, fighting style, colour, moves), each
// one right, close or wrong. Everything here is worked out from the Pet Farm tables, so a pet added there joins the
// puzzle with no change to this file. Accounts only: the streak and the coins need somewhere to live.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, profiles, addCoins, scheduleSave, flair, areFriends } from './store.js';
import { SPECIES, ZONES, RARITY, STARTERS } from '../public/games/farm/data.js';
import { KIT, MOVES, ROLE_NAME } from '../public/games/farm/battle.js';
import { COAT } from '../public/games/farm/breed.js';
import { TZ, now, skip, dayOf, untilNext, dayBefore, daysBetween } from './day.js';

export { TZ };
const FIRST_DAY = '2026-11-22';      // puzzle number 1
export const HINTS = [3, 5, 7];      // wrong guesses before: the outline, the baby form, a blurred picture
// Coins for solving: 20 on the first guess, two fewer for each guess after it, never under 5.
export const reward = guesses => Math.max(5, 22 - 2 * guesses);
const NO_REPEAT = 30;                // days before a pet may come round again (fewer when there are few pets)
const TOP = 25;
const FILE = path.join(DATA_DIR, 'mystery-pet.json');

// ---------- the calendar ----------
// The shared midnight-in-Warsaw clock lives in server/day.js; tests pin it with DAILY_NOW and the skip hook below.
export { dayOf, untilNext };
const dayNo = day => daysBetween(FIRST_DAY, day) + 1;

// ---------- which pet is it ----------
// The answer for each day is rolled once and written down, so adding a pet (or restarting) never changes today's.
let days = {};
export function load() {
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d.days && typeof d.days === 'object') days = d.days; }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); }
}
function save() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify({ v: 1, days })); fs.renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.error(`could not save ${FILE}:`, e.message); }
}
const pool = () => Object.keys(SPECIES).filter(sp => KIT[sp] && COAT[sp]);
function secretOf(day) {
  if (SPECIES[days[day]]) return days[day];
  const all = pool(), keep = Math.min(NO_REPEAT, all.length - 1), recent = new Set();
  for (let d = dayBefore(day), i = 0; i < keep; i++, d = dayBefore(d)) if (days[d]) recent.add(days[d]);
  const fresh = all.filter(sp => !recent.has(sp)), from = fresh.length ? fresh : all;
  days[day] = from[crypto.randomInt(from.length)];
  const old = Object.keys(days).sort(); for (const d of old.slice(0, Math.max(0, old.length - 400))) delete days[d];
  save();
  return days[day];
}

// ---------- what a pet is like ----------
// A colour name for a coat, so "cream" and "white" bunnies count as the same colour.
export function colourOf(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
  if (l > .925 || (s < .25 && l > .8)) return 'White';
  if (s < .16 || (s < .25 && h > 150)) return 'Grey';
  if (h >= 20 && h < 46 && l > .76) return 'Cream';
  if (h >= 12 && h < 46 && (l < .5 || (l < .6 && s < .8) || (l < .76 && s < .5))) return 'Brown';
  if (h < 12 || h >= 345) return l > .72 ? 'Pink' : 'Red';
  if (h < 42) return 'Orange';
  if (h < 68) return 'Yellow';
  if (h < 165) return 'Green';
  if (h < 250) return 'Blue';
  if (h < 290) return 'Purple';
  return 'Pink';
}
const homeOf = sp => {
  let best = null, top = 0;
  for (const z of Object.values(ZONES)) if ((z.wild?.[sp] || 0) > top) { top = z.wild[sp]; best = z.name; }
  return best || 'The Nest';
};
export function traits(sp) {
  const d = SPECIES[sp];
  return { els: [d.el, d.el2].filter(Boolean), home: homeOf(sp), rare: d.rare, role: KIT[sp].role, col: colourOf(COAT[sp][0]), col2: colourOf(COAT[sp][1]), moves: KIT[sp].moves };
}
// The clue columns, in the order the page shows them.
export const COLS = [['el', 'Element'], ['home', 'Home'], ['rare', 'Rarity'], ['role', 'Style'], ['col', 'Colour'], ['moves', 'Moves']];
// s: 'ok' right, 'near' close, 'no' wrong. dir: the secret is rarer ('up') or more common ('down').
export function clues(guess, secret) {
  const a = traits(guess), b = traits(secret), shared = a.els.filter(e => b.els.includes(e)).length;
  const both = a.moves.filter(m => b.moves.includes(m)).length;
  return [
    { k: 'el', v: a.els.join(' + '), s: shared === a.els.length && shared === b.els.length ? 'ok' : shared ? 'near' : 'no' },
    { k: 'home', v: a.home, s: a.home === b.home ? 'ok' : 'no' },
    { k: 'rare', v: RARITY[a.rare], s: a.rare === b.rare ? 'ok' : 'no', dir: a.rare === b.rare ? null : a.rare < b.rare ? 'up' : 'down' },
    { k: 'role', v: ROLE_NAME[a.role] || a.role, s: a.role === b.role ? 'ok' : 'no' },
    { k: 'col', v: a.col, s: a.col === b.col ? 'ok' : a.col === b.col2 || a.col2 === b.col ? 'near' : 'no' },
    { k: 'moves', v: `${both} of ${b.moves.length}`, s: both === b.moves.length ? 'ok' : both ? 'near' : 'no' },
  ];
}

// ---------- a player's day ----------
// On the profile: daily = { day, g: [species guessed], done: time solved or 0, shared, streak, best, last: day last solved, solved: total }
function stateOf(p, day) {
  const s = p.daily ||= { day, g: [], done: 0, streak: 0, best: 0, last: '', solved: 0 };
  if (s.day !== day) { s.day = day; s.g = []; s.done = 0; s.shared = false; }
  return s;
}
// A streak still counts while yesterday's puzzle was solved; miss a day and it starts over.
const streakOf = (s, day) => s.last === day || s.last === dayBefore(day) ? s.streak || 0 : 0;
export const mine = p => { const s = p?.daily; return s ? { streak: streakOf(s, dayOf()), best: s.best || 0, solved: s.solved || 0, done: s.day === dayOf() && !!s.done } : { streak: 0, best: 0, solved: 0, done: false }; };

function board(day, pid) {
  const rows = [];
  for (const p of profiles.values()) {
    const s = p.daily; if (!p.user || s?.day !== day || !s.done) continue;
    rows.push({ pid: p.pid, name: p.name || p.user, color: p.color, av: p.av, fl: flair(p), n: s.g.length, at: s.done, streak: s.streak || 0, friend: !!pid && areFriends(pid, p.pid) });
  }
  rows.sort((a, b) => a.n - b.n || a.at - b.at);
  const strip = ({ pid: id, ...r }, i) => ({ ...r, pos: i + 1, me: id === pid }), at = rows.findIndex(r => r.pid === pid);
  return { total: rows.length, rows: rows.slice(0, TOP).map(strip), mine: at >= TOP ? strip(rows[at], at) : null };
}
// One row of squares per guess: g right, y close, r wrong. Says nothing about which pets were guessed.
const gridOf = (s, secret) => s.g.map(sp => clues(sp, secret).map(c => c.s === 'ok' ? 'g' : c.s === 'near' ? 'y' : 'r').join(''));

function view(p) {
  const day = dayOf(), no = dayNo(day), base = { t: 'daily', day, no, cols: COLS, hintsAt: HINTS, next: untilNext(), pets: pool().length, starters: STARTERS };
  if (!p?.user) return { ...base, guest: true, board: board(day, null) };
  const s = stateOf(p, day), secret = secretOf(day), wrong = s.g.length - (s.done ? 1 : 0);
  return { ...base, guesses: s.g.map(sp => ({ sp, clues: clues(sp, secret) })), done: !!s.done, shared: !!s.shared,
    // The answer leaves the server only once a picture hint is due (the page draws it) or the puzzle is solved.
    hint: s.done ? 3 : HINTS.filter(n => wrong >= n).length, secret: s.done || wrong >= HINTS[0] ? secret : null,
    won: s.done ? reward(s.g.length) : 0, pay: reward(s.g.length + 1), streak: streakOf(s, day), best: s.best || 0, total: s.solved || 0,
    grid: s.done ? gridOf(s, secret) : null, board: board(day, p.pid) };
}

// Messages from the page: {} look, { guess: species }, { share: true }. chat(text, grid) posts to the hub chat.
export function handle(p, m, reply, chat) {
  if (!p?.user) return reply(view(p));
  const day = dayOf(), s = stateOf(p, day);
  if (typeof m.guess === 'string') {
    const sp = m.guess, secret = secretOf(day);
    if (s.done) return reply({ ...view(p), err: 'You already solved today’s Mystery Pet.' });
    if (!pool().includes(sp)) return reply({ ...view(p), err: 'That is not a pet.' });
    if (s.g.includes(sp)) return reply({ ...view(p), err: 'You already tried that one.' });
    s.g.push(sp);
    let solved = null;
    if (sp === secret) {
      s.done = now(); s.streak = streakOf(s, day) + 1; s.best = Math.max(s.best || 0, s.streak); s.last = day; s.solved = (s.solved || 0) + 1;
      solved = { coins: reward(s.g.length), streak: s.streak, newTitle: s.best === 7 && s.streak === 7 };
      addCoins(p.pid, solved.coins);
    }
    scheduleSave();
    return reply({ ...view(p), solved });
  }
  if (m.share) {
    if (!s.done) return reply({ ...view(p), err: 'Solve it first, then share.' });
    if (s.shared) return reply({ ...view(p), err: 'You already shared today’s result.' });
    const n = s.g.length, err = chat(`🐾 Mystery Pet #${dayNo(day)}: solved in ${n} ${n === 1 ? 'guess' : 'guesses'}${s.streak > 1 ? ` · 🔥 ${s.streak} days in a row` : ''}`, gridOf(s, secretOf(day)));
    if (err) return reply({ ...view(p), err });
    s.shared = true; scheduleSave();
    return reply({ ...view(p), sharedNow: true });
  }
  reply(view(p));
}

// Tests only (DAILY_TEST set): { skip: days } moves the calendar, { peek: true } tells the answer.
export function testHook(a, reply) {
  if (!process.env.DAILY_TEST || !a) return;
  if (Number.isFinite(a.skip)) skip(a.skip);
  if (a.peek) reply({ t: 'dailypeek', day: dayOf(), secret: secretOf(dayOf()) });
}

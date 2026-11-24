// Word in a Bottle: the daily word puzzle. Every day one five-letter word washes up in a bottle, the same for
// everybody: one Polish word and one English word, each its own puzzle with its own streak. Six tries, and every
// try comes back marked letter by letter: h (right letter, right spot), n (in the word, other spot), m (not in it).
// The server keeps the word and the word lists (server/words/), so the page cannot read the answer.
// Accounts only: the streak and the coins need somewhere to live.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, addCoins, scheduleSave } from './store.js';
import { dayOf, untilNext } from './daily.js';

export const LANGS = ['pl', 'en'], LEN = 5, TRIES = 6;
const FIRST_DAY = '2026-11-24';                     // puzzle number 1
// Coins for solving, by the number of tries used, and a small thank-you for a day not solved. Once a day per language.
export const REWARD = [30, 25, 20, 16, 13, 10], CONSOLATION = 3;
export const XP_SOLVE = 8;
const NO_REPEAT = 500;                              // days before a word may come round again
const FILE = path.join(DATA_DIR, 'word-daily.json');

const read = name => fs.readFileSync(new URL(`./words/${name}.txt`, import.meta.url), 'utf8').split(/\r?\n/).filter(w => [...w].length === LEN);
const VALID = {}, ANSWERS = {};
for (const lang of LANGS) { VALID[lang] = new Set(read(lang + '-valid')); ANSWERS[lang] = read(lang + '-answers').filter(w => VALID[lang].has(w)); }
export const answersOf = lang => ANSWERS[lang];
export const isWord = (lang, w) => VALID[lang].has(w);

const dayNo = day => Math.round((Date.parse(day + 'T00:00Z') - Date.parse(FIRST_DAY + 'T00:00Z')) / 86400_000) + 1;
const dayBefore = day => new Date(Date.parse(day + 'T00:00Z') - 86400_000).toISOString().slice(0, 10);

// ---------- which word is it ----------
// Each day's words are rolled once and written down, so editing the lists (or restarting) never changes today's.
let days = {};
export function load() {
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d.days && typeof d.days === 'object') days = d.days; }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); }
}
function save() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify({ v: 1, days })); fs.renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.error(`could not save ${FILE}:`, e.message); }
}
function secretOf(day, lang) {
  const d = days[day] ||= {};
  if (VALID[lang].has(d[lang])) return d[lang];
  const all = ANSWERS[lang], keep = Math.min(NO_REPEAT, all.length - 1), recent = new Set();
  for (let b = dayBefore(day), i = 0; i < keep; i++, b = dayBefore(b)) if (days[b]?.[lang]) recent.add(days[b][lang]);
  const fresh = all.filter(w => !recent.has(w)), from = fresh.length ? fresh : all;
  d[lang] = from[crypto.randomInt(from.length)];
  const old = Object.keys(days).sort(); for (const k of old.slice(0, Math.max(0, old.length - NO_REPEAT - 30))) delete days[k];
  save();
  return d[lang];
}

// ---------- marking a try ----------
// A letter that is in the word twice is marked twice at most: right spots first, then the others left to right.
export function mark(guess, secret) {
  const g = [...guess], s = [...secret], out = Array(LEN).fill('m'), left = {};
  for (let i = 0; i < LEN; i++) if (g[i] === s[i]) out[i] = 'h'; else left[s[i]] = (left[s[i]] || 0) + 1;
  for (let i = 0; i < LEN; i++) if (out[i] !== 'h' && left[g[i]]) { out[i] = 'n'; left[g[i]]--; }
  return out.join('');
}

// ---------- a player's day ----------
// On the profile: word = { pl: S, en: S }, S = { day, g: [tries], done: time finished or 0, won, shared, coins,
// streak, best, last: day last solved, played, wins, dist: [solved in 1..6 tries] }
function stateOf(p, lang, day) {
  const all = p.word ||= {};
  const s = all[lang] ||= { day, g: [], done: 0, won: false, streak: 0, best: 0, last: '', played: 0, wins: 0, dist: Array(TRIES).fill(0) };
  if (s.day !== day) { s.day = day; s.g = []; s.done = 0; s.won = false; s.shared = false; s.coins = 0; }
  if (!Array.isArray(s.dist) || s.dist.length !== TRIES) s.dist = Array(TRIES).fill(0);
  return s;
}
// A streak still counts while yesterday's word was solved; miss a day (or fail one) and it starts over.
const streakOf = (s, day) => s.last === day || s.last === dayBefore(day) ? s.streak || 0 : 0;

function langView(p, lang, day) {
  const s = stateOf(p, lang, day), secret = secretOf(day, lang);
  return {
    rows: s.g.map(w => ({ w, m: mark(w, secret) })), done: !!s.done, won: !!s.won, shared: !!s.shared,
    answer: s.done ? secret : null, // the word leaves the server only when this player's day is over
    got: s.done ? s.coins || 0 : 0, pay: REWARD[Math.min(s.g.length, TRIES - 1)],
    streak: streakOf(s, day), best: s.best || 0, played: s.played || 0, wins: s.wins || 0, dist: s.dist.slice(),
  };
}
function view(p) {
  const day = dayOf(), base = { t: 'word', day, no: dayNo(day), next: untilNext(), len: LEN, tries: TRIES, reward: REWARD };
  if (!p?.user) return { ...base, guest: true };
  return { ...base, L: Object.fromEntries(LANGS.map(lang => [lang, langView(p, lang, day)])) };
}
const gridOf = (s, secret) => s.g.map(w => mark(w, secret));

// Messages from the page: {} look, { lang, guess: word }, { lang, share: true }. chat(text, grid) posts to the hub chat.
export function handle(p, m, reply, chat) {
  if (!p?.user) return reply(view(p));
  const lang = LANGS.includes(m.lang) ? m.lang : null;
  if (!lang) return reply(view(p));
  const day = dayOf(), s = stateOf(p, lang, day), secret = secretOf(day, lang);
  if (typeof m.guess === 'string') {
    const w = m.guess.trim().toLocaleLowerCase('pl');
    if (s.done) return reply({ ...view(p), err: 'Today’s word is already finished.' });
    if ([...w].length !== LEN) return reply({ ...view(p), lang, bad: 'short' });
    if (!VALID[lang].has(w)) return reply({ ...view(p), lang, bad: 'word' }); // the page shakes the row; nothing is used up
    if (s.g.includes(w)) return reply({ ...view(p), lang, bad: 'twice' });
    s.g.push(w);
    let over = null;
    if (w === secret) {
      s.done = Date.now(); s.won = true; s.streak = streakOf(s, day) + 1; s.best = Math.max(s.best || 0, s.streak); s.last = day;
      s.played = (s.played || 0) + 1; s.wins = (s.wins || 0) + 1; s.dist[s.g.length - 1]++;
      s.coins = REWARD[s.g.length - 1]; p.xp = (p.xp || 0) + XP_SOLVE;
      over = { won: true, coins: s.coins, streak: s.streak };
      addCoins(p.pid, s.coins);
    } else if (s.g.length >= TRIES) {
      s.done = Date.now(); s.won = false; s.streak = 0; s.played = (s.played || 0) + 1; s.coins = CONSOLATION;
      over = { won: false, coins: s.coins, streak: 0 };
      addCoins(p.pid, s.coins);
    }
    scheduleSave();
    return reply({ ...view(p), lang, over, fresh: true });
  }
  if (m.share) {
    if (!s.done) return reply({ ...view(p), lang, err: 'Finish today’s word first, then share.' });
    if (s.shared) return reply({ ...view(p), lang, err: 'You already shared today’s result.' });
    const err = chat(`📜 Word in a Bottle #${dayNo(day)} (${lang.toUpperCase()}): ${s.won ? s.g.length : 'X'}/${TRIES}${s.won && s.streak > 1 ? ` · 🔥 ${s.streak} days in a row` : ''}`, gridOf(s, secret));
    if (err) return reply({ ...view(p), lang, err });
    s.shared = true; scheduleSave();
    return reply({ ...view(p), lang, sharedNow: true });
  }
  reply(view(p));
}

// Tests only (DAILY_TEST set): { peek: true } tells today's words. The calendar is moved with Mystery Pet's hook.
export function testHook(a, reply) {
  if (!process.env.DAILY_TEST || !a) return;
  if (a.peek) reply({ t: 'wordpeek', day: dayOf(), pl: secretOf(dayOf(), 'pl'), en: secretOf(dayOf(), 'en') });
}

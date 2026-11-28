// Tournaments run by the hosts (ADMINS), from the Tournaments tab of the Admin panel. Kuba's picks (2026-11-27):
// - a host picks a game and a format, opens sign-ups, and the site runs the rest: check-in before the start, the
//   bracket, a private table for every match, calling the players in, walkovers, results and house prizes.
// - Knockout: 1 v 1, best of 1 or 3, byes for the top seeds, a match for 3rd place. Heats: tables of 3 to 6, the top
//   two of each table go on, until one final table is left.
// - Seeded by that game's ranking (wins, then win rate). Accounts only; never bots at a tournament table.
// - A player who doesn't come to their table within CALL_MS loses by walkover (each may ask for 5 more minutes once
//   a match). Hosts can set a result by hand, replay a match, remove a player, move the start or cancel.
// - Prizes come from the house only (never from players): coins for the top three and a little for everyone who
//   played, and a tournament win that counts towards the Cup Winner titles. Nobody pays to enter.
// - The news goes to the hosts' Discord channel too when they paste a channel webhook in the Admin panel.
// server.js owns the tables: it hands over open/here/start/playing/close (see setup) and tells gameOver() how a
// match game ended. Everything is kept in DATA_DIR/tour.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as store from './store.js';

const FILE = path.join(store.DATA_DIR, 'tour.json');
export const CALL_MS = +(process.env.TOUR_CALL_MS ?? 5 * 60_000);       // time to come to your table
export const MORE_MS = +(process.env.TOUR_MORE_MS ?? 5 * 60_000);       // "Need 5 more minutes"
export const CHECKIN_MS = +(process.env.TOUR_CHECKIN_MS ?? 15 * 60_000); // check-in opens this long before the start
export const NEXT_GAME_MS = +(process.env.TOUR_NEXT_MS ?? 9000);       // best of 3: the next game, after the results
const SHOW_DONE_MS = 12 * 3600_000; // a finished tournament stays on the hub this long
const KEEP = 40;                    // finished and cancelled tournaments kept for the history list
const MAX_DRAWS = 3;                // a drawn game is played again; after this many draws the higher seed goes through
export const LIMITS = { name: 60, rules: 300, max: 64, coins: 1000, all: 100, lv: 100 };
// Games that make no sense as a competition: decided by votes or judging, pure luck, or a party game of their own.
export const NOT_FOR_CUPS = new Set(['copy', 'lantern', 'runway', 'kal', 'pm', 'ladders', 'marbles', 'bingo', 'wojna', 'trail', 'kitchen']);
const HOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,100}$/;
const SITE_URL = (process.env.SITE_URL || 'https://zatokagier.com').replace(/\/+$/, '');

let tours = [];                       // every tournament, newest first
let cfg = { hook: '', lang: 'pl', ping: true };
let deps = null, onChange = () => {}, saveT = 0;
const posts = [];                     // tests: the Discord posts that would have gone out
const TEST = !!process.env.TOUR_TEST;

/** server.js: { metaOf(id), choices(id), names(id) -> {en, pl}, open(T, m) -> code, here(code) -> Set of pids at that
 * table, start(code, n), playing(code), exists(code), close(code), holding(), tell(pid, msg), changed() } */
export function setup(d) { deps = d; }
export function setOnChange(f) { onChange = f; }
const newId = () => crypto.randomBytes(4).toString('hex');
const line = (s, n = LIMITS.name) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (v, lo, hi, def) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
const byId = id => tours.find(T => T.id === id);

// ---------- saving ----------
function save() {
  try {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, cfg, tours }));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error(`could not save ${FILE}:`, e.message); }
}
export function saveNow() { clearTimeout(saveT); saveT = 0; save(); }
function changed() { if (!saveT) saveT = setTimeout(() => { saveT = 0; save(); }, 1000); onChange(); }
/** At start. A match that was being played (or called) when the server stopped is called again: its table is gone. */
export function load() {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  if (d.cfg && typeof d.cfg === 'object') cfg = { hook: HOOK_RE.test(d.cfg.hook || '') ? d.cfg.hook : '', lang: d.cfg.lang === 'en' ? 'en' : 'pl', ping: d.cfg.ping !== false };
  tours = Array.isArray(d.tours) ? d.tours.filter(T => T && T.id && T.game) : [];
  const now = Date.now();
  for (const T of tours) for (const m of allMatches(T)) if (m.st === 'call' || m.st === 'play') { m.st = 'wait'; m.code = ''; m.due = 0; m.next = 0; m.ext = []; }
  for (const T of tours) if (T.st === 'live') T.log.push({ at: now, k: 'restart' });
}

// ---------- what is allowed ----------
const fmtsOf = id => {
  if (NOT_FOR_CUPS.has(id) || !deps.metaOf(id)) return [];
  const ch = deps.choices(id), meta = deps.metaOf(id), out = [];
  if (!ch.length ? meta.maxPlayers >= 2 : ch.includes(2) || (meta.seats?.lo ?? 9) <= 2) out.push('ko');
  if (meta.seats && !meta.seats.only && !meta.seats.fixed && meta.maxPlayers >= 3) out.push('heat');
  return out;
};
/** The games a host can pick, with the formats each allows: { id: ['ko', 'heat'] }. */
// Table settings from the form: a few plain values (server.js cleans them for the game at every table).
const smallOpts = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => /^\w{1,20}$/.test(k) && !k.startsWith('__') && (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 30))).slice(0, 20));
export const gamesOk = ids => Object.fromEntries(ids.map(id => [id, fmtsOf(id)]).filter(([, f]) => f.length));

// ---------- the bracket ----------
const allMatches = T => (T.rounds || []).flat();
const matchOf = (T, mid) => allMatches(T).find(m => m.id === mid);
const nameOf = pid => store.profiles.get(pid)?.name || '?';
const seedIx = (T, pid) => { const i = (T.seed || []).indexOf(pid); return i < 0 ? 999 : i; };
// 1, 8, 4, 5, 2, 7, 3, 6: where each seed stands in a bracket of P, so the top seeds meet as late as possible.
export function seedOrder(P) { let o = [1]; while (o.length < P) { const n = o.length * 2; o = o.flatMap(x => [x, n + 1 - x]); } return o; }
const mk = (T, r, i, p, more = {}) => ({ id: `m${T.mid = (T.mid || 0) + 1}`, r, i, p, st: 'wait', code: '', due: 0, next: 0, ext: [], g: [], wins: {}, w: null, l: null, res: null, wo: false, by: '', ...more });
function buildKnockout(T) {
  const n = T.seed.length, P = 2 ** Math.ceil(Math.log2(Math.max(2, n))), R = Math.log2(P), o = seedOrder(P);
  T.rounds = [];
  const r0 = [];
  for (let i = 0; i < P / 2; i++) r0.push(mk(T, 0, i, [T.seed[o[2 * i] - 1] ?? null, T.seed[o[2 * i + 1] - 1] ?? null]));
  T.rounds.push(r0);
  for (let r = 1; r < R; r++) {
    const row = [];
    for (let i = 0; i < P / 2 ** (r + 1); i++) row.push(mk(T, r, i, [null, null], { from: [[T.rounds[r - 1][2 * i].id, 'w'], [T.rounds[r - 1][2 * i + 1].id, 'w']] }));
    T.rounds.push(row);
  }
  if (R >= 2) { const semi = T.rounds[R - 2]; T.rounds[R - 1].push(mk(T, R - 1, 1, [null, null], { third: true, from: [[semi[0].id, 'l'], [semi[1].id, 'l']] })); }
  for (const m of r0) if (m.p.filter(Boolean).length === 1) { const w = m.p.find(Boolean); Object.assign(m, { st: 'done', w, l: null, wo: true, bye: true }); }
  feed(T);
}
// Winners and losers move on into the matches they feed.
function feed(T) {
  for (const m of allMatches(T)) {
    if (!m.from || m.st !== 'wait') continue;
    m.from.forEach(([id, k], j) => { const f = matchOf(T, id); if (f?.st === 'done') m.p[j] = (k === 'w' ? f.w : f.l) ?? null; else m.p[j] = null; });
    // someone a host took out: whoever meets them goes through
    const out = m.p.find(pid => pid && T.ents.find(e => e.pid === pid)?.out), other = m.p.find(pid => pid && pid !== out);
    if (out && other) { Object.assign(m, { st: 'done', w: other, l: out, wo: true }); return feed(T); }
    // a 3rd place match fed by a semi-final that was a bye has nobody to play: it is dropped
    if (m.third && m.from.every(([id]) => matchOf(T, id)?.st === 'done') && m.p.filter(Boolean).length < 2) Object.assign(m, { st: 'done', w: m.p.find(Boolean) || null, wo: true, bye: true });
  }
}
// Heats: split the players (in order) over tables of at most T.per, snaking so every table gets a fair mix.
function heatRound(T, order) {
  const r = T.rounds.length, k = Math.ceil(order.length / T.per), tables = Array.from({ length: k }, () => []);
  order.forEach((pid, j) => { const row = Math.floor(j / k), col = row % 2 ? k - 1 - (j % k) : j % k; tables[col].push(pid); });
  T.rounds.push(tables.map((p, i) => mk(T, r, i, p, { final: k === 1 })));
}
const advOf = (T, m) => Math.min(T.adv, m.p.length - 1);
function heatNext(T) {
  const row = T.rounds[T.rounds.length - 1];
  if (!row.every(m => m.st === 'done')) return;
  if (row.length === 1 && row[0].final) return finish(T);
  const next = [];
  for (let place = 0; place < T.per; place++) for (const m of row) if (place < advOf(T, m) && m.res[place]) next.push(m.res[place]);
  heatRound(T, next);
}

// ---------- running it ----------
function begin(T, now, byHost = '') {
  const want = T.ents.filter(e => !e.out);
  const pool = T.st === 'checkin' && want.some(e => e.in) ? want.filter(e => e.in) : byHost ? want : want.filter(e => e.in);
  if (pool.length < 2) { T.st = 'off'; T.why = 'few'; T.endAt = now; post('few', T); return; }
  // seeding: that game's wins, then win rate, then whoever signed up first
  const score = e => { const g = store.profiles.get(e.pid)?.byGame?.[T.game] || {}; return [g.wins || 0, g.games ? (g.wins || 0) / g.games : 0, -e.at]; };
  const ranked = pool.map(e => [e, score(e)]).sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1] || b[1][2] - a[1][2]).map(x => x[0]);
  T.seed = ranked.map(e => e.pid); T.played = [];
  T.st = 'live'; T.began = now;
  if (byHost) T.log.push({ at: now, k: 'start', by: byHost });
  if (T.fmt === 'ko') buildKnockout(T); else { T.rounds = []; heatRound(T, T.seed.slice()); }
  post('live', T);
  if (T.fmt === 'ko' && allMatches(T).every(m => m.st === 'done')) finish(T);
}
function finish(T) {
  const now = Date.now();
  if (T.fmt === 'ko') {
    const R = T.rounds.length, fin = T.rounds[R - 1][0], third = T.rounds[R - 1].find(m => m.third && !m.bye);
    T.top = [fin.w, fin.l, third?.w].filter(Boolean);
  } else T.top = T.rounds[T.rounds.length - 1][0].res.slice(0, 3);
  T.st = 'done'; T.endAt = now;
  // prizes, from the house: places 1-3, then a little for everyone who played at least one game
  const pay = new Map();
  T.top.forEach((pid, i) => pay.set(pid, (pay.get(pid) || 0) + (T.prize.c[i] | 0)));
  for (const pid of new Set(T.played)) pay.set(pid, (pay.get(pid) || 0) + (T.prize.all | 0));
  T.paid = {};
  for (const [pid, n] of pay) {
    const p = store.profiles.get(pid); if (!p) continue;
    if (n > 0) store.addCoins(pid, n);
    T.paid[pid] = n;
    deps.tell(pid, { t: 'tour', op: 'prize', id: T.id, place: T.top.indexOf(pid) + 1, coins: n });
  }
  for (const pid of new Set(T.seed)) { const p = store.profiles.get(pid); if (p) p.tp = (p.tp || 0) + 1; }
  const champ = store.profiles.get(T.top[0]); if (champ) { champ.tw = (champ.tw || 0) + 1; deps.tell(T.top[0], { t: 'me' }); }
  store.scheduleSave();
  post('done', T);
  trim();
}
function trim() { const old = tours.filter(T => T.st === 'done' || T.st === 'off'); if (old.length > KEEP) { const drop = new Set(old.slice(KEEP)); tours = tours.filter(T => !drop.has(T)); } }

function decideKo(T, m, w, how = {}) {
  Object.assign(m, { st: 'done', w, l: m.p.find(pid => pid && pid !== w) || null, ...how });
  feed(T);
  const R = T.rounds.length, fin = T.rounds[R - 1][0];
  if (fin.st === 'done' && T.rounds[R - 1].every(x => x.st === 'done')) finish(T);
}
function decideHeat(T, m, res, how = {}) {
  Object.assign(m, { st: 'done', res, ...how });
  heatNext(T);
}

/** Called once a second. */
export function tick(now = Date.now()) {
  if (!deps) return;
  let ch = false;
  for (const T of tours) {
    if (T.st === 'signup' && now >= T.start - CHECKIN_MS) { T.st = 'checkin'; ch = true; post('checkin', T); }
    if (T.st === 'checkin' && now >= T.start) { begin(T, now); ch = true; }
    if (T.st !== 'live') continue;
    for (const m of allMatches(T)) {
      if (m.st === 'done' || T.st !== 'live') continue;
      if (deps.holding()) { if (m.due) m.due = Math.max(m.due, now + 60_000); continue; } // an update is coming: no new tables, nobody loses on time
      if (m.st === 'wait') {
        if (m.p.length < 2 || m.p.some(x => !x)) continue;
        m.code = deps.open(T, m); m.st = 'call'; m.due = now + CALL_MS; ch = true;
        for (const pid of m.p) deps.tell(pid, { t: 'tour', op: 'call', id: T.id, mid: m.id });
        continue;
      }
      if (m.st === 'call') {
        if (!deps.exists(m.code)) { m.code = deps.open(T, m); ch = true; }
        const here = deps.here(m.code);
        if (m.p.every(pid => here.has(pid)) && now >= (m.next || 0)) { m.st = 'play'; m.cut = []; deps.start(m.code, m.p.length); ch = true; continue; }
        if (now >= m.due) { timeout(T, m, here, now); ch = true; }
        continue;
      }
      if (m.st === 'play' && !deps.playing(m.code)) { m.st = 'call'; m.due = now + CALL_MS; ch = true; } // the table went away mid-game (everyone left): call them again
    }
  }
  for (const T of tours) if (T.st === 'live' && T.fmt === 'ko' && T.rounds.at(-1).every(x => x.st === 'done')) { finish(T); ch = true; } // a walkover decided the last match
  if (ch) changed();
}
function timeout(T, m, here, now) {
  const present = m.p.filter(pid => here.has(pid));
  if (T.fmt === 'ko') {
    const w = present.length === 1 ? present[0] : m.p.slice().sort((a, b) => seedIx(T, a) - seedIx(T, b))[0];
    T.log.push({ at: now, k: present.length ? 'wo' : 'none', m: m.id, a: w });
    return decideKo(T, m, w, { wo: true });
  }
  const absent = m.p.filter(pid => !here.has(pid)).sort((a, b) => seedIx(T, a) - seedIx(T, b));
  if (present.length >= 2) { m.st = 'play'; m.cut = absent; deps.start(m.code, present.length); T.log.push({ at: now, k: 'short', m: m.id, n: absent.length }); return; }
  T.log.push({ at: now, k: present.length ? 'wo' : 'none', m: m.id, a: present[0] || absent[0] });
  decideHeat(T, m, [...present, ...absent], { wo: true });
}

/** A game at a match table ended. places: [{ pid, place }] for every seat (lower is better). */
export function gameOver(tid, mid, places) {
  const T = byId(tid), m = T && matchOf(T, mid); if (!m || m.st !== 'play') return;
  const now = Date.now(), mine = places.filter(x => m.p.includes(x.pid));
  for (const x of mine) T.played.push(x.pid);
  if (T.fmt === 'ko') {
    const best = Math.min(...mine.map(x => x.place)), top = mine.filter(x => x.place === best);
    const w = top.length === 1 ? top[0].pid : null;
    m.g.push({ w });
    if (w) m.wins[w] = (m.wins[w] || 0) + 1;
    const need = T.bo === 3 ? 2 : 1, draws = m.g.filter(x => !x.w).length;
    if (w && m.wins[w] >= need) decideKo(T, m, w);
    else if (!w && draws >= MAX_DRAWS) { const sw = m.p.slice().sort((a, b) => seedIx(T, a) - seedIx(T, b))[0]; T.log.push({ at: now, k: 'draws', m: m.id, a: sw }); decideKo(T, m, sw); }
    else { m.st = 'call'; m.next = now + NEXT_GAME_MS; m.due = now + CALL_MS; } // the next game, at the same table
  } else {
    const order = mine.slice().sort((a, b) => a.place - b.place || seedIx(T, a.pid) - seedIx(T, b.pid)).map(x => x.pid);
    const rest = m.p.filter(pid => !order.includes(pid)).sort((a, b) => seedIx(T, a) - seedIx(T, b));
    m.g.push({ w: order[0] || null });
    decideHeat(T, m, [...order, ...rest]);
  }
  changed();
}
/** May this account sit down at this match table? (Everyone else may watch.) */
export function isPlayer(tid, mid, pid) { const m = matchOf(byId(tid) || {}, mid); return !!m && m.p.includes(pid) && !(m.cut || []).includes(pid); }
/** For the waiting room and results screen of a match table. */
export function tableInfo(tid, mid) {
  const T = byId(tid), m = T && matchOf(T, mid); if (!m) return null;
  return { id: T.id, mid: m.id, name: T.name, game: T.game, fmt: T.fmt, bo: T.bo, r: m.r, rounds: T.rounds.length, third: !!m.third, final: !!m.final, st: m.st,
    left: m.st === 'call' ? Math.max(0, m.due - Date.now()) : 0, next: m.next ? Math.max(0, m.next - Date.now()) : 0, sc: m.p.map(pid => m.wins[pid] || 0), done: m.st === 'done' || T.st !== 'live',
    p: m.p.map(pid => ({ pt: store.tagOf(store.profiles.get(pid)), name: nameOf(pid) })), w: m.w ? store.tagOf(store.profiles.get(m.w)) : '' };
}
/** A host banned someone: they leave every tournament they are in. */
export function dropPid(pid, by = '') { for (const T of tours) if (T.ents.some(e => e.pid === pid) && (T.st === 'signup' || T.st === 'checkin' || T.st === 'live')) kick(T, pid, by); }

function kick(T, pid, by) {
  const now = Date.now(), e = T.ents.find(x => x.pid === pid); if (!e) return;
  T.log.push({ at: now, k: 'kick', by, a: pid });
  if (T.st !== 'live') { T.ents = T.ents.filter(x => x !== e); return changed(); }
  e.out = true;
  for (const m of allMatches(T)) {
    if (m.st === 'done' || !m.p.includes(pid)) continue;
    if (T.fmt === 'ko') { const o = m.p.find(x => x && x !== pid); if (o) decideKo(T, m, o, { wo: true }); else m.p = m.p.map(x => (x === pid ? null : x)); }
    else if (m.st === 'play') (m.cut ||= []).push(pid);
    else { m.p = m.p.filter(x => x !== pid); if (m.p.length < 2) decideHeat(T, m, [...m.p, pid], { wo: true }); }
  }
  changed();
}

// ---------- what the pages see ----------
const ent = pid => { const p = store.profiles.get(pid); return p ? { pt: store.tagOf(p), name: p.name || '?', color: p.color, av: p.av, fl: store.flair(p), ...store.badge(p) } : { pt: '', name: '?' }; };
const tagOf = pid => (pid ? store.tagOf(store.profiles.get(pid)) || '' : '');
function view(T, now = Date.now()) {
  return {
    id: T.id, name: T.name, rules: T.rules, game: T.game, fmt: T.fmt, bo: T.bo, per: T.per, adv: T.adv, max: T.max, minLv: T.minLv, start: T.start, st: T.st, why: T.why || '',
    opts: T.opts, prize: T.prize, by: T.byName, began: T.began || 0, endAt: T.endAt || 0, checkin: CHECKIN_MS, call: CALL_MS,
    ents: T.ents.filter(e => !e.out).map(e => ({ ...ent(e.pid), in: !!e.in })),
    seed: (T.seed || []).map(tagOf), top: (T.top || []).map(tagOf), paid: T.paid ? Object.fromEntries(Object.entries(T.paid).map(([pid, n]) => [tagOf(pid), n])) : null,
    names: Object.fromEntries([...new Set([...(T.seed || []), ...T.ents.map(e => e.pid)])].map(pid => [tagOf(pid), nameOf(pid)])),
    rounds: (T.rounds || []).map(row => row.map(m => ({ id: m.id, p: m.p.map(tagOf), st: m.st, code: m.st === 'call' || m.st === 'play' ? m.code : '', left: m.st === 'call' ? Math.max(0, m.due - now) : 0,
      next: m.next && m.next > now ? m.next - now : 0, sc: m.p.map(pid => (pid ? m.wins[pid] || 0 : 0)), g: m.g.length, w: tagOf(m.w), res: (m.res || []).map(tagOf), wo: !!m.wo, bye: !!m.bye, by: m.by || '',
      third: !!m.third, final: !!m.final, ext: m.ext.map(tagOf), cut: (m.cut || []).map(tagOf) }))),
    log: T.log.slice(-30).map(x => ({ at: x.at, k: x.k, by: x.by || '', m: x.m || '', a: x.a ? nameOf(x.a) : '', n: x.n || 0, min: x.min || 0 })),
  };
}
/** The tournaments every screen gets: anything open or running, and ones that ended in the last 12 hours. */
export function list(now = Date.now()) {
  return tours.filter(T => T.st === 'signup' || T.st === 'checkin' || T.st === 'live' || ((T.st === 'done' || T.st === 'off') && now - (T.endAt || 0) < SHOW_DONE_MS)).map(T => view(T, now));
}
const histView = T => ({ id: T.id, name: T.name, game: T.game, fmt: T.fmt, st: T.st, start: T.start, endAt: T.endAt || 0, n: (T.seed || T.ents).length, top: (T.top || []).map(pid => ({ pt: tagOf(pid), name: nameOf(pid) })) });
export const history = () => tours.filter(T => T.st === 'done' || T.st === 'off').slice(0, KEEP).map(histView);
/** For the profile card: how many tournaments this player won and played. */
export const statsOf = p => ({ tw: p?.tw || 0, tp: p?.tp || 0 });

// ---------- messages from players and hosts ----------
/** { t: 'tour', op, ... } from a screen. me: the profile; admin: is a host. Returns { err } or { ok, ... }. */
export function handle(p, m, admin) {
  const op = String(m.op ?? ''), now = Date.now();
  if (op === 'hist') return { hist: history() };
  if (op === 'one') { const T = byId(String(m.id ?? '')); return T ? { one: view(T) } : { err: 'That tournament is not here any more.' }; }
  const T = byId(String(m.id ?? ''));
  if (op === 'join' || op === 'leave' || op === 'in' || op === 'more') {
    if (!p?.user) return { err: 'Make an account to play in tournaments.' };
    if (!T) return { err: 'That tournament is not here any more.' };
    const mine = T.ents.find(e => e.pid === p.pid && !e.out);
    if (op === 'join') {
      if (T.st !== 'signup' && T.st !== 'checkin') return { err: 'Sign-ups for this tournament are closed.' };
      if (mine) return { ok: true };
      if (T.ents.some(e => e.pid === p.pid && e.out)) return { err: 'A host took you out of this tournament.' };
      if (T.ents.length >= T.max) return { err: 'This tournament is full.' };
      if (store.badge(p).lv < T.minLv) return { err: `You need level ${T.minLv} to sign up for this tournament.` };
      T.ents.push({ pid: p.pid, at: now, in: T.st === 'checkin' }); changed(); return { ok: true, joined: true };
    }
    if (op === 'leave') {
      if (!mine) return { ok: true };
      if (T.st !== 'signup' && T.st !== 'checkin') return { err: 'The tournament has started. Ask a host if you can’t play.' };
      T.ents = T.ents.filter(e => e !== mine); changed(); return { ok: true };
    }
    if (op === 'in') {
      if (!mine) return { err: 'Sign up first.' };
      if (T.st !== 'checkin') return { err: 'Check-in opens 15 minutes before the start.' };
      mine.in = true; changed(); return { ok: true };
    }
    if (op === 'more') {
      const x = matchOf(T, String(m.mid ?? ''));
      if (!x || x.st !== 'call' || !x.p.includes(p.pid)) return { err: 'That match is not waiting for you.' };
      if (x.ext.includes(p.pid)) return { err: 'You already asked for more time in this match.' };
      x.ext.push(p.pid); x.due += MORE_MS; changed(); return { ok: true };
    }
  }
  if (!admin) return { err: 'Only hosts can do that.' };
  if (op === 'cfg') {
    if (m.hook !== undefined) { const h = String(m.hook ?? '').trim(); if (h && !HOOK_RE.test(h)) return { err: 'That is not a Discord channel webhook link.' }; cfg.hook = h; }
    if (m.lang !== undefined) cfg.lang = m.lang === 'en' ? 'en' : 'pl';
    if (m.ping !== undefined) cfg.ping = !!m.ping;
    saveNow(); return { ok: true, cfg: cfgView() };
  }
  if (op === 'getcfg') return { cfg: cfgView() };
  if (op === 'hooktest') { if (!cfg.hook) return { err: 'Paste the Discord webhook link first.' }; post('test', null); return { ok: true }; }
  if (op === 'create') {
    const game = String(m.game ?? ''), fmts = fmtsOf(game), fmt = m.fmt === 'heat' ? 'heat' : 'ko';
    if (!fmts.length) return { err: 'Pick a game that can be played as a tournament.' };
    if (!fmts.includes(fmt)) return { err: 'That game can’t be played in that format.' };
    const name = { en: line(m.name?.en), pl: line(m.name?.pl) };
    if (!name.en && !name.pl) return { err: 'Give the tournament a name.' };
    const start = Math.round(+m.start);
    if (!Number.isFinite(start) || start < now + 60_000) return { err: 'Pick a start time in the future.' };
    if (start > now + 60 * 86400_000) return { err: 'The start can be at most 60 days away.' };
    const meta = deps.metaOf(game), ch = deps.choices(game);
    const hi = ch.length ? Math.max(...ch) : meta.maxPlayers, lo = Math.max(3, ch.length ? Math.min(...ch.filter(n => n >= 3), hi) : 3);
    const c = Array.isArray(m.prize?.c) ? m.prize.c : [150, 80, 40];
    const T = {
      id: newId(), name, rules: { en: line(m.rules?.en, LIMITS.rules), pl: line(m.rules?.pl, LIMITS.rules) }, game, fmt,
      bo: fmt === 'ko' && +m.bo === 3 ? 3 : 1, per: fmt === 'heat' ? int(m.per, lo, hi, Math.min(4, hi)) : 2, adv: fmt === 'heat' ? int(m.adv, 1, 3, 2) : 1,
      max: int(m.max, 2, LIMITS.max, 16), minLv: int(m.minLv, 0, LIMITS.lv, 0), start, opts: smallOpts(m.opts),
      prize: { c: [0, 1, 2].map(i => int(c[i], 0, LIMITS.coins, 0)), all: int(m.prize?.all, 0, LIMITS.all, 10) },
      st: 'signup', by: p.pid, byName: p.name || p.user, created: now, ents: [], rounds: [], log: [], mid: 0,
    };
    if (T.fmt === 'heat' && T.adv >= T.per) T.adv = T.per - 1;
    tours.unshift(T); changed(); post('open', T); return { ok: true, id: T.id };
  }
  if (!T) return { err: 'That tournament is not here any more.' };
  const by = p.name || p.user;
  if (op === 'cancel') {
    if (T.st === 'done' || T.st === 'off') return { ok: true };
    T.st = 'off'; T.why = 'host'; T.endAt = now; T.log.push({ at: now, k: 'cancel', by });
    for (const x of allMatches(T)) if (x.code) deps.close(x.code);
    changed(); post('cancel', T); return { ok: true };
  }
  if (op === 'del') { if (T.st !== 'done' && T.st !== 'off') return { err: 'Cancel the tournament first.' }; tours = tours.filter(x => x !== T); changed(); return { ok: true }; }
  if (op === 'start') {
    if (T.st !== 'signup' && T.st !== 'checkin') return { err: 'This tournament has already started.' };
    begin(T, now, by); changed(); return { ok: true };
  }
  if (op === 'later') {
    if (T.st !== 'signup' && T.st !== 'checkin') return { err: 'This tournament has already started.' };
    const min = int(m.min, 5, 24 * 60, 15);
    T.start = Math.max(T.start, now) + min * 60_000; if (T.st === 'checkin' && now < T.start - CHECKIN_MS) T.st = 'signup';
    T.log.push({ at: now, k: 'later', by, min }); changed(); post('later', T); return { ok: true };
  }
  const who = m.pt ? store.byTag(String(m.pt)) : null;
  if (op === 'kick') { if (!who || !T.ents.some(e => e.pid === who.pid)) return { err: 'That player is not in this tournament.' }; kick(T, who.pid, by); return { ok: true }; }
  const x = matchOf(T, String(m.mid ?? ''));
  if (op === 'result') {
    if (T.st !== 'live' || !x || x.st === 'done' || T.fmt !== 'ko') return { err: 'That match can’t be decided now.' };
    if (!who || !x.p.includes(who.pid)) return { err: 'Pick one of the two players.' };
    if (x.code && deps.playing(x.code)) deps.close(x.code);
    T.log.push({ at: now, k: 'result', by, m: x.id, a: who.pid });
    decideKo(T, x, who.pid, { by }); changed(); return { ok: true };
  }
  if (op === 'redo') {
    if (T.st !== 'live' || !x) return { err: 'That match can’t be played again now.' };
    if (x.bye) return { err: 'That was a bye: there is nothing to replay.' };
    // only while nothing that came after it has started
    const later = T.fmt === 'ko' ? allMatches(T).filter(y => y.from?.some(([id]) => id === x.id)) : T.rounds.slice(x.r + 1).flat();
    if (later.some(y => y.st !== 'wait')) return { err: 'A match after this one has already started.' };
    if (T.fmt === 'heat') T.rounds = T.rounds.slice(0, x.r + 1);
    if (x.code) deps.close(x.code);
    Object.assign(x, { st: 'wait', code: '', due: 0, next: 0, ext: [], g: [], wins: {}, w: null, l: null, res: null, wo: false, by: '', cut: [] });
    if (T.fmt === 'ko') feed(T);
    T.log.push({ at: now, k: 'redo', by, m: x.id }); changed(); return { ok: true };
  }
  return { err: 'Only hosts can do that.' };
}
const cfgView = () => ({ hook: cfg.hook ? cfg.hook.replace(/\/[\w-]{20,100}$/, '/…' + cfg.hook.slice(-4)) : '', on: !!cfg.hook, lang: cfg.lang, ping: cfg.ping });

// ---------- Discord ----------
const when = (t, lang) => new Date(t).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', { timeZone: 'Europe/Warsaw', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
function post(kind, T) {
  if (!cfg.hook) return;
  const pl = cfg.lang === 'pl', X = (en, plt) => (pl ? plt : en), nm = T ? (pl ? T.name.pl || T.name.en : T.name.en || T.name.pl) : '';
  const game = T ? (pl ? deps.names(T.game).pl : deps.names(T.game).en) : '', url = T ? `${SITE_URL}/?t=${T.id}` : SITE_URL;
  const fmt = T ? (T.fmt === 'ko' ? X(`knockout, best of ${T.bo}`, T.bo === 3 ? 'pucharowy, do 2 wygranych' : 'pucharowy, jedna gra') : X(`heats of ${T.per}`, `grupy po ${T.per}`)) : '';
  const prize = T ? [T.prize.c[0] && X(`1st: ${T.prize.c[0]} coins`, `1. miejsce: ${T.prize.c[0]} monet`), T.prize.all && X(`everyone who plays: ${T.prize.all}`, `każdy, kto zagra: ${T.prize.all}`)].filter(Boolean).join(' · ') : '';
  const top = T?.top?.map(nameOf) || [];
  const msg = {
    test: [X('Zatoka Gier tournaments are connected to this channel.', 'Turnieje Zatoki Gier są połączone z tym kanałem.'), '', ''],
    open: [X(`🏆 Sign-ups are open: ${nm}`, `🏆 Zapisy otwarte: ${nm}`), `${game} · ${fmt}\n${X('Starts', 'Start')}: ${when(T?.start, cfg.lang)}\n${prize}`, X('Sign up on the site', 'Zapisz się na stronie')],
    checkin: [X(`⏰ Check-in is open: ${nm}`, `⏰ Potwierdzanie obecności: ${nm}`), X(`Signed up? Press “I’m here” on the site before ${when(T?.start, cfg.lang)}, or you’re out.`, `Zapisani: kliknijcie „Jestem” na stronie przed ${when(T?.start, cfg.lang)}, inaczej odpadacie.`), ''],
    live: [X(`▶️ ${nm} has started`, `▶️ ${nm}: start!`), X(`${T?.seed?.length} players. The site calls each match to its table.`, `Graczy: ${T?.seed?.length}. Strona sama zawoła każdy mecz do stołu.`), X('Watch the bracket', 'Zobacz drabinkę')],
    done: [X(`🏆 ${nm}: ${top[0]} is the champion!`, `🏆 ${nm}: wygrywa ${top[0]}!`), top.slice(1).map((n, i) => `${i + 2}. ${n}`).join(' · '), X('Results', 'Wyniki')],
    few: [X(`${nm} is off`, `${nm}: odwołany`), X('Fewer than two players were ready.', 'Gotowych było mniej niż dwóch graczy.'), ''],
    cancel: [X(`${nm} was cancelled`, `${nm}: odwołany`), X('A host cancelled it.', 'Gospodarz go odwołał.'), ''],
    later: [X(`⏳ ${nm} starts later`, `⏳ ${nm}: start przesunięty`), `${X('New start', 'Nowy start')}: ${when(T?.start, cfg.lang)}`, ''],
  }[kind];
  if (!msg) return;
  const ping = cfg.ping && (kind === 'open' || kind === 'checkin' || kind === 'live');
  const body = { username: 'Zatoka Gier', content: `${ping ? '@here ' : ''}${msg[0]}`.slice(0, 1900), allowed_mentions: { parse: ping ? ['everyone'] : [] },
    embeds: msg[1] || msg[2] ? [{ description: `${msg[1]}${msg[2] ? `\n[${msg[2]}](${url})` : ''}`.slice(0, 3900), color: 0xffb547 }] : [] };
  if (TEST) { posts.push({ kind, ...body }); return; }
  fetch(cfg.hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) })
    .then(r => { if (!r.ok) console.warn(`tour: Discord answered ${r.status} to the ${kind} post`); }, e => console.warn(`tour: could not post to Discord (${e.message})`));
}
/** Tests only (TOUR_TEST=1): the posts so far, or moving a tournament's clock. */
export function testHook(k, m = {}) {
  if (!TEST) return null;
  if (k === 'posts') return posts.slice();
  const T = byId(String(m.id ?? ''));
  if (k === 'start' && T) { T.start = Date.now() + (+m.in || 0); return true; }
  if (k === 'over' && T) { const x = matchOf(T, String(m.mid ?? '')); if (!x) return null; gameOver(T.id, x.id, (m.order || []).map((pt, i) => ({ pid: store.byTag(pt)?.pid, place: i + 1 })).filter(y => y.pid)); return true; }
  if (k === 'due' && T) { const x = matchOf(T, String(m.mid ?? '')); if (x) { x.due = Date.now() + (+m.in || 0); x.next = 0; } return true; }
  return null;
}

// Site notices from the hosts (ADMINS), set from the Site notices window on the website:
// - a maintenance countdown: every screen shows "Update in 4:59" and no new games start until it is over (games
//   already running carry on). The host restarts the server by hand when it reaches zero; if nobody does, the hold
//   ends by itself a while later. A restart always ends it.
// - an announcement banner ("Tournament tonight at 20:00"), until the host takes it down.
// - a "What's new" note, shown once to everyone, either right away or after the next restart (the usual: write it
//   during the countdown, then restart). It is shown for a few days, so people who come back later see it too.
// Texts are typed by the host in Polish and/or English; each player sees their language, or the other one if that is all there is.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './store.js';

const FILE = path.join(DATA_DIR, 'notice.json');
export const MAX_LINE = 200, MAX_NEWS = 1200;
export const MAX_MIN = 120;
const LINGER = 15 * 60_000;           // after zero, new games stay on hold this long (time for the restart), then it lifts
const NEWS_DAYS = 3 * 24 * 3600_000;  // a "What's new" note is shown for three days

let maint = null; // { end, pl, en }
let ann = null;   // { id, pl, en, at }
let news = null;  // { id, pl, en, at }: being shown now
let next = null;  // { pl, en }: becomes `news` at the next start
let onChange = () => {}, timer = null;

const newId = () => crypto.randomBytes(5).toString('hex');
// One line: no control characters, no markup brackets (the page escapes everything anyway).
const line = s => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LINE);
// A note: like a line, but keeps line breaks (at most two in a row).
const note = s => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, ' ')
  .split('\n').map(x => x.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_NEWS);
const pair = (m, clean) => ({ pl: clean(m?.pl), en: clean(m?.en) });

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, ann, news, next }));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error(`could not save ${FILE}:`, e.message); }
}
/** At start: an "after the next restart" note goes live now. A countdown never survives a restart (it was for this one). */
export function load() {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  const ok = x => x && typeof x === 'object' && (x.pl || x.en);
  ann = ok(d.ann) ? { id: String(d.ann.id || newId()), ...pair(d.ann, line), at: +d.ann.at || Date.now() } : null;
  news = ok(d.news) ? { id: String(d.news.id || newId()), ...pair(d.news, note), at: +d.news.at || Date.now() } : null;
  next = null;
  if (ok(d.next)) { news = { id: newId(), ...pair(d.next, note), at: Date.now() }; console.log('notice: the "What\'s new" note is live'); }
  if (news && Date.now() - news.at > NEWS_DAYS) news = null;
  save();
}
export function setOnChange(f) { onChange = f; }

/** True while new games are on hold. */
export const holding = () => !!maint && Date.now() < maint.end + LINGER;
const liveNews = () => (news && Date.now() - news.at < NEWS_DAYS ? news : null);
/** What every screen gets. `left` is in milliseconds, so a wrong clock on a phone can't move the countdown. */
export function view(admin = false) {
  const now = Date.now();
  const v = { maint: holding() ? { left: maint.end - now, pl: maint.pl, en: maint.en } : null, ann, news: liveNews() };
  if (admin) v.next = next;
  return v;
}

function arm() {
  clearTimeout(timer); timer = null;
  if (!maint) return;
  timer = setTimeout(() => { maint = null; console.log('notice: maintenance hold ended by itself (no restart)'); onChange(); }, maint.end + LINGER - Date.now());
  timer.unref?.();
}

/** A host's change from the Site notices window. Returns { err } or { ok } (and calls onChange). */
export function handle(m, who = 'host') {
  const op = String(m?.op ?? '');
  if (op === 'maint') {
    const min = Math.round(+m.min);
    if (!(min >= 1 && min <= MAX_MIN)) return { err: 'Pick 1 to 120 minutes.' }; // MAX_MIN
    maint = { end: Date.now() + min * 60_000, ...pair(m, line) };
    console.log(`notice: ${who} started a ${min} min maintenance countdown`);
  } else if (op === 'cancel') {
    if (!maint) return { ok: true };
    maint = null; console.log(`notice: ${who} cancelled the maintenance countdown`);
  } else if (op === 'ann') {
    const t = pair(m, line);
    ann = t.pl || t.en ? { id: newId(), ...t, at: Date.now() } : null;
    console.log(`notice: ${who} ${ann ? 'posted an announcement' : 'took the announcement down'}`);
  } else if (op === 'news') {
    const t = pair(m, note), any = t.pl || t.en;
    if (m.when === 'now') { news = any ? { id: newId(), ...t, at: Date.now() } : null; if (any) next = null; }
    else if (m.when === 'restart') next = any ? t : null;
    else if (m.when === 'clear') { news = null; next = null; }
    else return { err: 'Unknown.' };
    console.log(`notice: ${who} updated the "What's new" note (${m.when})`);
  } else return { err: 'Unknown.' };
  arm(); save(); onChange();
  return { ok: true };
}

/** Tests only. */
export function testHook(t) { if (!process.env.NOTICE_TEST) return; if (t?.endIn !== undefined && maint) { maint.end = Date.now() + (+t.endIn || 0); arm(); onChange(); } }

// The hub's global chat: one room for the whole site. Everyone on the hub can read it, only accounts can write.
// The last messages are kept in DATA_DIR/hub-chat.json so a restart doesn't wipe the conversation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, safeText, badge, flair, tagOf, isAdmin } from './store.js';
import { allow } from './limits.js';

export const MAX_LEN = 200;  // characters per message
const KEEP = 100;            // messages kept on the server
export const SEND = 60;      // messages a new reader gets
const FILE = path.join(DATA_DIR, 'hub-chat.json');
// Moderators (the ADMINS setting, see store.js) may remove anyone's message.
export { isAdmin };

let log = [];

// Message text: no control characters, no invisible or direction-flipping characters (they can disguise a line or
// spill onto the next one), runs of spaces squashed, and at most MAX_LEN characters. The page escapes it as well.
export function cleanText(s) {
  const t = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/[\u00ad\u061c\u115f\u1160\u180e\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\ufffb]/g, '') // keeps \u200d and \ufe0f, which emoji need
    .replace(/\s+/g, ' ').trim();
  return Array.from(t).slice(0, MAX_LEN).join('').trim();
}

export function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(d.log)) log = d.log.filter(m => m && typeof m.text === 'string' && typeof m.id === 'string').slice(-KEEP);
  } catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); }
}
let timer = null, warned = false, dirty = false;
export function saveNow() {
  clearTimeout(timer); timer = null;
  if (!dirty) return; dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify({ v: 1, log }));
    fs.renameSync(FILE + '.tmp', FILE); warned = false;
  } catch (e) { if (!warned) console.error(`could not save ${FILE}:`, e.message); warned = true; }
}
const scheduleSave = () => { dirty = true; if (!timer) timer = setTimeout(saveNow, 2000); };

// What readers get. `own` marks the reader's messages so the page can offer to remove them; pids never leave the server.
const view = (m, pid, admin) => {
  const { pid: who, ...rest } = m;
  return { ...rest, own: who === pid, del: admin || who === pid };
};
export const history = p => log.slice(-SEND).map(m => view(m, p?.pid, isAdmin(p)));

// A new message from profile `p` (connected as client `c`, from address `ip`). Returns { msg } or { err }.
// grid: a Mystery Pet result (rows of g / y / r squares) or a Word in a Bottle one (h / n / m) shown under the line.
export function post(p, c, ip, raw, grid = null) {
  if (!p?.user) return { err: 'Log in or make an account to chat.' };
  const text = cleanText(raw); if (!text) return {};
  const last = [...log].reverse().find(m => m.pid === p.pid);
  if (last && last.text.toLowerCase() === text.toLowerCase() && Date.now() - last.at < 30_000) return { err: 'You just said that.' };
  // Friendly limits: a short pause between lines, a cap per half minute and per hour, and per address too,
  // so a few accounts made from one place can't flood the room together.
  if (!allow('hc:gap:' + p.pid, 1, 1200)) return { err: 'Easy there: one message at a time.' };
  if (!allow('hc:30s:' + p.pid, 8, 30_000) || !allow('hc:ip:' + ip, 20, 60_000)) return { err: 'You are sending messages very fast. Wait a few seconds.' };
  if (!allow('hc:hour:' + p.pid, 200, 3600_000)) return { err: 'That is a lot of chat for one hour. Take a little break.' };
  const g = badge(p);
  const m = { id: crypto.randomBytes(6).toString('hex'), at: Date.now(), pid: p.pid, user: p.user, name: safeText(c.name || p.name).slice(0, 16) || p.user,
    color: c.color, av: c.av, lv: g.lv, icon: g.icon, rank: g.rank, ...(g.cn ? { cn: g.cn } : {}), fl: flair(p), pt: tagOf(p), text };
  if (Array.isArray(grid)) m.grid = grid.filter(r => /^([gyr]{1,8}|[hnm]{5})$/.test(r)).slice(0, 60);
  log.push(m); if (log.length > KEEP) log.splice(0, log.length - KEEP);
  scheduleSave();
  return { msg: m };
}
// Removes a message: your own, or anyone's for a moderator. Returns true when it was removed.
export function remove(p, id) {
  const i = log.findIndex(m => m.id === id); if (i < 0 || !p) return false;
  if (log[i].pid !== p.pid && !isAdmin(p)) return false;
  log.splice(i, 1); scheduleSave(); return true;
}
export const forReader = view;
// A deleted account's messages leave the chat. Returns the removed ids, so open screens can drop them too.
export function forget(pid) {
  const gone = log.filter(m => m.pid === pid).map(m => m.id);
  if (gone.length) { log = log.filter(m => m.pid !== pid); scheduleSave(); saveNow(); }
  return gone;
}

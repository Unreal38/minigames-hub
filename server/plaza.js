// The Plaza: a 3D hangout island reachable from the hub. No game, no coins: people walk about as their avatars with
// the pets they show off, wave, dance, sit down and react. Chat is the hub's own chat (hubchat.js); the page shows a
// line as a speech bubble over its writer when they stand in your room.
// Rooms hold CAP people each; newcomers land in the fullest room with space, so the place feels lively. Positions
// travel as whole numbers (metres x Q). Each room gathers who moved and sends one text to everyone ten times a second.
// The Christmas tree's ornaments (one per account, winter only) are shared by every room and kept in DATA_DIR/plaza.json.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, safeText, shopDate } from './store.js';
import { now as clock, dayOf, startOf, addDays } from './day.js';
import { allow } from './limits.js';
import { CAP, R_WALK, SPEED, SPAWN, Q, TREE_R, TREE_REACH, SPOTS, SPOT_REACH, EMOTES, ORNAMENTS, SLOTS, themeOf, clampWalk, THROW_RANGE, THROW_HIT, THROW_WAIT } from '../public/games/plaza/layout.js';

const FILE = path.join(DATA_DIR, 'plaza.json');
const MUTE_MS = 10 * 60_000, KICK_MS = 10 * 60_000;
const rooms = new Map();   // room number -> { no, m: Map(token -> member), next: next short id, dirty: Set(member) }
const where = new Map();   // token -> room
const muted = new Map(), kicked = new Map(); // profile id (or token for a guest) -> until
let tree = [];             // ornaments: { i: slot, k: kind, n: name, pt: public tag, pid, at }
let hooks = { info: () => ({}), isAdmin: () => false, friends: () => [], pidOf: () => null, mayReact: () => true, mayEmote: () => true, visit: () => ({ days: 0, fresh: false }), patPal: () => false, table: () => null, giftLeft: () => false, giftTake: () => 0 };
export const GIFT = 5; // coins in the daily present under the tree (twice that from 24 to 26 December)
const HOUR = 3600_000;

// ----- timed events -----
// Things that happen in the plaza at set times (Warsaw's clock, like every daily thing):
//   newyear  31 December 20:00 to 1 January 02:00: fireworks, a countdown, and a big finale at midnight
//   party    every Saturday 20:00 to 21:00: fireworks over the square
//   show     five minutes of fireworks a host started by hand (the room menu)
// PLAZA_EVENT pins one for tests and for looking at it.
let showUntil = 0;
const HOUR20 = 20 * HOUR;
const isSat = day => new Date(day + 'T12:00Z').getUTCDay() === 6;
export function eventAt(t = clock()) {
  if (process.env.PLAZA_EVENT) return { id: process.env.PLAZA_EVENT, end: t + HOUR, ...(process.env.PLAZA_EVENT === 'newyear' ? { mid: t + (+process.env.PLAZA_MID || 30) * 1000 } : {}) };
  const day = dayOf(t), [, m, d] = day.split('-').map(Number), t0 = startOf(day);
  if (m === 12 && d === 31 && t >= t0 + HOUR20) { const mid = startOf(addDays(day, 1)); return { id: 'newyear', mid, end: mid + 2 * HOUR }; }
  if (m === 1 && d === 1 && t < t0 + 2 * HOUR) return { id: 'newyear', mid: t0, end: t0 + 2 * HOUR };
  if (showUntil > t) return { id: 'show', end: showUntil };
  if (isSat(day) && t >= t0 + HOUR20 && t < t0 + 21 * HOUR) return { id: 'party', end: t0 + 21 * HOUR };
  return null;
}
// The next one within a day, for the hub's button ("fireworks at 20:00").
export function eventNext(t = clock()) {
  if (eventAt(t)) return null;
  for (const day of [dayOf(t), addDays(dayOf(t), 1)]) { const [, m, d] = day.split('-').map(Number), at = startOf(day) + HOUR20;
    if (at > t && at - t < 24 * HOUR && (m === 12 && d === 31 || isSat(day))) return { id: m === 12 && d === 31 ? 'newyear' : 'party', in: at - t }; }
  return null;
}
// What a page needs: which event, how long it lasts, and how far midnight is (all from now, so clocks need not agree).
const evView = (t = clock()) => { const e = eventAt(t); return e ? { id: e.id, left: e.end - t, ...(e.mid ? { mid: e.mid - t } : {}) } : null; };
const giftSize = () => { const [, m, d] = dayOf().split('-').map(Number); return m === 12 && d >= 24 && d <= 26 ? GIFT * 2 : GIFT; };
export function setup(h) { hooks = { ...hooks, ...h }; }

export const theme = () => { const [, m, d] = shopDate().split('-').map(Number); return themeOf(m, d); };
export const count = () => where.size;
export const roomOf = c => where.get(c.token) || null;
const keyOf = c => hooks.pidOf(c) || c.token;
const until = (map, k) => { const u = map.get(k); if (!u) return 0; if (u < Date.now()) { map.delete(k); return 0; } return u; };
// Minutes left of a mute for this player (0 = may talk). The hub chat asks before taking a line.
export const mutedFor = c => { const u = until(muted, keyOf(c)); return u ? Math.max(1, Math.ceil((u - Date.now()) / 60_000)) : 0; };

// ----- the tree -----
export function load() {
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (Array.isArray(d.tree)) tree = d.tree.filter(o => o && Number.isInteger(o.i) && o.i >= 0 && o.i < SLOTS && ORNAMENTS[o.k] && o.pid).slice(0, SLOTS); }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); }
}
let timer = null, dirty = false;
export function saveNow() {
  clearTimeout(timer); timer = null; if (!dirty) return; dirty = false;
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify({ v: 1, tree })); fs.renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.error(`could not save ${FILE}:`, e.message); }
}
const scheduleSave = () => { dirty = true; timer ||= setTimeout(saveNow, 2000); };
const treeView = () => tree.map(({ i, k, n, pt }) => ({ i, k, n, pt }));
// A deleted account's ornament comes off the tree.
export function forget(pid) { const o = tree.find(x => x.pid === pid); if (!o) return; tree = tree.filter(x => x !== o); scheduleSave(); all({ t: 'plaza', k: 'orn', i: o.i, o: null }); }

// ----- sending -----
const say = (c, msg) => c.sock?.send(msg);
function toRoom(r, msg, but = null) { const s = JSON.stringify(msg); for (const m of r.m.values()) if (m !== but) m.c.sock?.send(s); }
function all(msg) { const s = JSON.stringify(msg); for (const r of rooms.values()) for (const m of r.m.values()) m.c.sock?.send(s); }
const view = m => ({ s: m.s, x: m.x, z: m.z, r: m.r, e: m.e, sp: m.sp, ...hooks.info(m.c) });
const roomList = c => { const fr = new Set(hooks.friends(c)); return [...rooms.values()].sort((a, b) => a.no - b.no).map(r => ({ no: r.no, n: r.m.size, fr: [...r.m.values()].filter(m => fr.has(hooks.pidOf(m.c))).length })); };

// ----- coming and going -----
function pick(want) {
  const r = rooms.get(want | 0); if (r && r.m.size < CAP) return r;
  let best = null; for (const x of rooms.values()) if (x.m.size < CAP && (!best || x.m.size > best.m.size || (x.m.size === best.m.size && x.no < best.no))) best = x;
  if (best) return best;
  let no = 1; while (rooms.has(no)) no++;
  const made = { no, m: new Map(), next: 1, dirty: new Set(), signs: [] }; rooms.set(no, made); return made;
}
export function join(c, want) {
  const left = until(kicked, keyOf(c));
  if (left) return say(c, { t: 'plaza', k: 'out', why: 'kick', mins: Math.ceil((left - Date.now()) / 60_000) });
  const old = where.get(c.token);
  if (old && (!want || old.no === (want | 0))) return hello(c, old); // the page asking again after a dropped connection
  if (old) leave(c);
  const r = pick(want), a = Math.random() * Math.PI * 2, d = Math.random() * 1.8;
  const [x, z] = clampWalk(SPAWN[0] + Math.cos(a) * d, SPAWN[1] + Math.sin(a) * d * .6);
  const m = { c, s: r.next++, x: Math.round(x * Q), z: Math.round(z * Q), r: 31, e: 0, sp: -1, at: Date.now() };
  r.m.set(c.token, m); where.set(c.token, r);
  toRoom(r, { t: 'plaza', k: 'add', p: view(m) }, m);
  hello(c, r, hooks.visit(c));
}
function hello(c, r, visit) {
  const m = r.m.get(c.token);
  say(c, { t: 'plaza', k: 'in', ev: evView(), ...(visit?.fresh ? { visit: visit.days } : {}), giftN: giftSize(), room: r.no, cap: CAP, me: m.s, theme: theme(), who: [...r.m.values()].map(view), signs: signsOf(r), gift: theme() === 'winter' && hooks.giftLeft(c), tree: theme() === 'winter' ? treeView() : null, rooms: roomList(c), mod: hooks.isAdmin(c) });
}
export function leave(c) {
  const r = where.get(c.token); if (!r) return false;
  const m = r.m.get(c.token); r.m.delete(c.token); r.dirty.delete(m); where.delete(c.token);
  if (!r.m.size) rooms.delete(r.no); else toRoom(r, { t: 'plaza', k: 'del', s: m.s });
  return true;
}
// ----- table signs -----
// Someone in the plaza opened a table: a signpost stays where they stood, so the others can follow them to the game
// with one tap. It goes when the table starts, fills up or closes (checked once a second).
const signView = (g, t) => ({ code: g.code, x: g.x, z: g.z, n: g.n, game: t.game, free: t.free });
const signsOf = r => r.signs.map(g => { const t = hooks.table(g.code); return t?.open ? signView(g, t) : null; }).filter(Boolean);
export function sign(c, code) {
  const r = where.get(c.token), m = r?.m.get(c.token), t = hooks.table(code); if (!m || !t?.open) return;
  const g = { code, x: m.x, z: m.z, n: hooks.info(c).n, free: t.free }; r.signs = r.signs.filter(x => x.n !== g.n).slice(-5); r.signs.push(g);
  toRoom(r, { t: 'plaza', k: 'sign', g: signView(g, t) }, m);
}
function checkSigns() {
  for (const r of rooms.values()) for (const g of [...r.signs]) { const t = hooks.table(g.code);
    if (!t?.open) { r.signs = r.signs.filter(x => x !== g); toRoom(r, { t: 'plaza', k: 'sign', gone: g.code }); }
    else if (t.free !== g.free) { g.free = t.free; toRoom(r, { t: 'plaza', k: 'sign', g: signView(g, t) }); } }
}
// A glance at the plaza for the hub's button: how many are in, and a few faces (the asker's friends first).
export function peek(c) {
  const fr = new Set(hooks.friends(c)), faces = [];
  for (const r of rooms.values()) for (const m of r.m.values()) { const i = hooks.info(m.c); faces.push({ n: i.n, c: i.c, av: i.av, f: fr.has(hooks.pidOf(m.c)) ? 1 : 0 }); }
  faces.sort((a, b) => b.f - a.f);
  const ev = eventAt(), next = ev ? null : eventNext();
  return { t: 'plaza', k: 'peek', n: where.size, faces: faces.slice(0, 5), fr: faces.filter(x => x.f).length, theme: theme(), ...(ev ? { ev: ev.id } : {}), ...(next ? { next } : {}) };
}

// A player changed their look, name, pets or flair: everyone in their room sees it.
export function refresh(c) { const r = where.get(c.token), m = r?.m.get(c.token); if (m) toRoom(r, { t: 'plaza', k: 'look', p: view(m) }); }

// ----- what people do -----
const int = (v, lo, hi) => { v = Math.round(+v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
const spotFree = (r, sp, me) => { for (const m of r.m.values()) if (m !== me && m.sp === sp) return false; return true; };
export function handle(c, a) {
  if (!a || typeof a !== 'object') return;
  if (a.k === 'join') return join(c, a.room);
  if (a.k === 'peek') { if (allow('plz:peek:' + c.token, 30, 60_000)) say(c, peek(c)); return; }
  if (a.k === 'rooms') return say(c, { t: 'plaza', k: 'rooms', rooms: roomList(c) });
  const r = where.get(c.token), m = r?.m.get(c.token); if (!m) return;
  const now = Date.now();
  switch (a.k) {
    case 'leave': leave(c); return;
    case 'mv': { // where the page says you walked to: believed if you could have got there on foot
      let x = int(a.x, -R_WALK * Q, R_WALK * Q) / Q, z = int(a.z, -R_WALK * Q, R_WALK * Q) / Q;
      [x, z] = clampWalk(x, z);
      const dt = Math.min(2, (now - m.at) / 1000), far = Math.hypot(x - m.x / Q, z - m.z / Q);
      m.bank = Math.min(3, (m.bank ?? 3) + dt * SPEED * 1.15); // metres you may still cover: fills as time passes, a little spare for lag
      m.at = now;
      if (far > m.bank + .2) { say(c, { t: 'plaza', k: 'fix', x: m.x, z: m.z }); return; } // too far too fast: back you go
      m.bank -= far;
      const nx = Math.round(x * Q), nz = Math.round(z * Q), nr = int(a.r, 0, 62);
      if (nx === m.x && nz === m.z && nr === m.r) return;
      if ((nx !== m.x || nz !== m.z) && (m.sp >= 0 || EMOTES[m.e]?.loop)) { m.e = 0; m.sp = -1; toRoom(r, { t: 'plaza', k: 'em', s: m.s, e: 0, sp: -1 }, m); } // walking off ends a dance or a sit
      m.x = nx; m.z = nz; m.r = nr; r.dirty.add(m);
      return;
    }
    case 'em': { // an emote; sit may name a seat
      const e = int(a.e, 0, EMOTES.length - 1);
      if (now - (m.emAt || 0) < 350) return; m.emAt = now;
      if (e && !hooks.mayEmote(c, e)) return; // bought, seasonal and earned emotes: only their owners
      let sp = -1;
      if (EMOTES[e]?.id === 'sit' && Number.isInteger(a.sp) && SPOTS[a.sp]) {
        const s = SPOTS[a.sp];
        if (spotFree(r, a.sp, m) && Math.hypot(s.x - m.x / Q, s.z - m.z / Q) <= SPOT_REACH + .5) { sp = a.sp; m.x = Math.round(s.x * Q); m.z = Math.round(s.z * Q); m.r = int(((s.ry % 6.2832) + 6.2832) % 6.2832 * 10, 0, 62); m.bank = 3; r.dirty.add(m); }
      }
      m.e = EMOTES[e]?.loop ? e : 0; m.sp = sp;
      toRoom(r, { t: 'plaza', k: 'em', s: m.s, e, sp }); // the writer too: their page waits for the seat to be confirmed
      return;
    }
    case 're': { // a reaction floating over your head
      if (now - (m.reAt || 0) < 700) return; m.reAt = now;
      const i = Math.max(0, a.i | 0); if (!hooks.mayReact(c, i)) return;
      toRoom(r, { t: 'plaza', k: 're', s: m.s, i });
      return;
    }
    case 'pat': { // a heart for someone's pet
      if (now - (m.patAt || 0) < 900) return; m.patAt = now;
      const t = [...r.m.values()].find(x => x.s === (a.s | 0)); if (!t) return;
      toRoom(r, { t: 'plaza', k: 'pat', s: t.s, i: int(a.i, 0, 2), by: m.s });
      if (t !== m && hooks.patPal(c, t.c)) say(c, { t: 'plaza', k: 'pal', n: hooks.info(t.c).n }); // a friend's pet: a Pet Farm friendship point, once a day each
      return;
    }
    case 'sb': { // throw a snowball (a soft ball outside winter) at a spot; whoever stands there gets a puff of snow
      if (now - (m.sbAt || 0) < THROW_WAIT || until(muted, keyOf(c))) return; m.sbAt = now;
      const mx = m.x / Q, mz = m.z / Q; let x = +a.x / Q, z = +a.z / Q; if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const d = Math.hypot(x - mx, z - mz); if (d < .6) return; if (d > THROW_RANGE) { x = mx + (x - mx) / d * THROW_RANGE; z = mz + (z - mz) / d * THROW_RANGE; }
      let hit = null, best = THROW_HIT; for (const o of r.m.values()) { if (o === m) continue; const q = Math.hypot(o.x / Q - x, o.z / Q - z); if (q < best) { best = q; hit = o; } }
      if (hit) { x = hit.x / Q; z = hit.z / Q; }
      toRoom(r, { t: 'plaza', k: 'sb', s: m.s, x: Math.round(x * Q), z: Math.round(z * Q), h: hit ? hit.s : 0 });
      return;
    }
    case 'show': { // hosts only: five minutes of fireworks in every room
      if (!hooks.isAdmin(c) || !allow('plz:show:' + keyOf(c), 4, 60_000)) return;
      showUntil = clock() + 5 * 60_000; evKey = ''; console.log(`plaza: ${hooks.info(c).n} started a fireworks show`);
      return;
    }
    case 'gift': { // the daily present under the Christmas tree
      if (theme() !== 'winter') return;
      if (!hooks.info(c).u) return say(c, { t: 'plaza', k: 'err', msg: 'Log in or make an account to open the present.' });
      if (Math.hypot(m.x / Q, m.z / Q) > TREE_REACH + 1) return say(c, { t: 'plaza', k: 'err', msg: 'Walk up to the tree first.' });
      const coins = hooks.giftTake(c, giftSize()); if (!coins) return say(c, { t: 'plaza', k: 'gift', left: false });
      say(c, { t: 'plaza', k: 'gift', coins, left: false }); toRoom(r, { t: 'plaza', k: 'em', s: m.s, e: EMOTES.findIndex(e => e?.id === 'cheer'), sp: -1 });
      return;
    }
    case 'orn': { // hang (or change, or take down) your ornament on the Christmas tree
      if (theme() !== 'winter') return;
      const pid = hooks.pidOf(c); if (!pid || !hooks.info(c).u) return say(c, { t: 'plaza', k: 'err', msg: 'Log in or make an account to hang an ornament.' });
      const kind = int(a.i, 0, ORNAMENTS.length - 1);
      if (Math.hypot(m.x / Q, m.z / Q) > TREE_REACH + 1) return say(c, { t: 'plaza', k: 'err', msg: 'Walk up to the tree first.' });
      if (!allow('plz:orn:' + pid, 6, 60_000)) return say(c, { t: 'plaza', k: 'err', msg: 'Give the tree a moment before changing your ornament again.' });
      const mine = tree.find(o => o.pid === pid), inf = hooks.info(c);
      if (!kind) { if (mine) { tree = tree.filter(o => o !== mine); all({ t: 'plaza', k: 'orn', i: mine.i, o: null }); scheduleSave(); } return; }
      let slot = mine?.i;
      if (slot === undefined) {
        const used = new Set(tree.map(o => o.i)), free = []; for (let i = 0; i < SLOTS; i++) if (!used.has(i)) free.push(i);
        if (free.length) slot = free[Math.random() * free.length | 0];
        else { const oldest = tree.reduce((x, y) => (y.at < x.at ? y : x)); slot = oldest.i; tree = tree.filter(o => o !== oldest); } // a full tree: the oldest makes room
      }
      const o = { i: slot, k: kind, n: safeText(inf.n || '').slice(0, 16), pt: inf.pt || '', pid, at: mine?.at || now };
      tree = tree.filter(x => x !== mine); tree.push(o); scheduleSave();
      all({ t: 'plaza', k: 'orn', i: slot, o: { i: slot, k: kind, n: o.n, pt: o.pt } });
      return;
    }
    case 'mute': case 'kick': { // hosts (ADMINS) only: quiet someone for ten minutes, or send them out of the plaza
      if (!hooks.isAdmin(c)) return;
      const t = [...r.m.values()].find(x => x.s === (a.s | 0)); if (!t || t === m || hooks.isAdmin(t.c)) return;
      const who = hooks.info(t.c).n;
      if (a.k === 'mute') { muted.set(keyOf(t.c), now + MUTE_MS); say(t.c, { t: 'plaza', k: 'muted', mins: 10 }); console.log(`plaza: ${hooks.info(c).n} muted ${who} for 10 minutes`); }
      else { kicked.set(keyOf(t.c), now + KICK_MS); say(t.c, { t: 'plaza', k: 'out', why: 'kick', mins: 10 }); leave(t.c); hooks.onKick?.(t.c); console.log(`plaza: ${hooks.info(c).n} removed ${who} from the plaza for 10 minutes`); }
      say(c, { t: 'plaza', k: 'done', what: a.k, n: who });
      return;
    }
  }
}

// Ten times a second: one text per room with everyone who moved, as [id, x, z, facing].
let signN = 0, evKey = '';
export function tick() {
  if (++signN % 10 === 0) { checkSigns(); const e = eventAt(), k = e ? e.id + e.end : ''; if (k !== evKey) { evKey = k; all({ t: 'plaza', k: 'ev', ev: evView() }); } } // an event starting or ending reaches every room within a second
  for (const r of rooms.values()) {
    if (!r.dirty.size) continue;
    const s = JSON.stringify({ t: 'plaza', k: 'p', m: [...r.dirty].map(m => [m.s, m.x, m.z, m.r]) });
    r.dirty.clear();
    for (const m of r.m.values()) m.c.sock?.send(s);
  }
}
// For tests and the load test.
export const _rooms = rooms;

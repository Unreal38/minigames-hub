// Everything that survives a restart: player profiles (guest or username + password),
// browser sessions, and open lobbies with their scoreboards. One JSON file, written atomically.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { xpFor, coinsFor, levelOf, progress } from '../public/ranks.js';
import { PRICE, priceOf, wearable, AV_KEYS, OPT } from '../public/avatar.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
const DIR = DATA_DIR;
const FILE = path.join(DIR, 'cozy-table.json');
const SESSION_TTL = 180 * 86400_000; // forget unused guest sessions after half a year

export const profiles = new Map(); // pid -> profile
export const sessions = new Map(); // browser token -> { id, pid, seen }
const users = new Map();           // lower-case username -> pid
const visitors = new Set();        // hashed browser tokens of everyone who has ever opened the site
let savedRooms = [];

const rid = n => crypto.randomBytes(n).toString('hex');

// ---------- load / save ----------
export function load() {
  let d;
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); return []; }
  for (const p of Object.values(d.profiles || {})) {
    profiles.set(p.pid, p); if (p.user) users.set(p.user.toLowerCase(), p.pid);
    // Coins arrived after people had already played: everyone starts with what their past games would have paid.
    if (!Number.isFinite(p.coins)) p.coins = coinsFor({}) * (p.games || 0) + (coinsFor({ win: true }) - coinsFor({})) * (p.wins || 0);
  }
  for (const [t, s] of Object.entries(d.sessions || {})) if (profiles.has(s.pid)) sessions.set(t, s);
  if (Array.isArray(d.visitors)) for (const v of d.visitors) if (typeof v === 'string') visitors.add(v);
  for (const t of Object.keys(d.sessions || {})) visitors.add(vkey(t)); // older saves had no visitor list
  savedRooms = Array.isArray(d.rooms) ? d.rooms : [];
  console.log(`loaded ${profiles.size} profiles, ${sessions.size} sessions, ${savedRooms.length} lobbies from ${FILE}`);
  return savedRooms;
}

let roomsFn = () => [], timer = null, warned = false;
export function setRoomSource(fn) { roomsFn = fn; }
export function scheduleSave() { if (!timer) timer = setTimeout(saveNow, 1500); }

export function saveNow() {
  clearTimeout(timer); timer = null;
  const rooms = roomsFn();
  const inRoom = new Set(rooms.flatMap(r => r.players));
  const now = Date.now(), keepP = {}, keepS = {};
  for (const [t, s] of sessions) {
    const p = profiles.get(s.pid);
    if (!p || (!inRoom.has(t) && now - s.seen > SESSION_TTL)) continue;
    if (inRoom.has(t) || p.user || p.games || p.coins || p.owned?.length) { keepS[t] = s; keepP[p.pid] = p; }
  }
  for (const p of profiles.values()) if (p.user) keepP[p.pid] = p;
  const data = JSON.stringify({ v: 1, saved: new Date().toISOString(), profiles: keepP, sessions: keepS, rooms, visitors: [...visitors] });
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, FILE);
    warned = false;
  } catch (e) {
    if (!warned) console.error(`could not save to ${FILE} (set DATA_DIR to a writable folder):`, e.message);
    warned = true;
  }
}

// ---------- visitor count ----------
// Counts distinct browsers. Only a short hash of each token is kept, so the list can't be used to log in.
const vkey = t => crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 16);
export function visit(token) {
  const k = vkey(token); if (visitors.has(k)) return false;
  visitors.add(k); scheduleSave(); return true;
}
export const visitorCount = () => visitors.size;

// ---------- profiles & sessions ----------
function newProfile(look = {}) {
  const p = { pid: rid(8), user: null, name: look.name || 'Guest', color: look.color || '#ff8fab', av: look.av || null,
    xp: 0, games: 0, wins: 0, pts: 0, byGame: {}, coins: 0, owned: [], created: Date.now() };
  profiles.set(p.pid, p);
  return p;
}

export function session(token, look) {
  let s = sessions.get(token);
  if (!s || !profiles.has(s.pid)) { s = { id: rid(6), pid: newProfile(look).pid, seen: Date.now() }; sessions.set(token, s); }
  s.seen = Date.now();
  return s;
}
export const profileOf = token => profiles.get(sessions.get(token)?.pid);

export function setLook(token, { name, color, av }) {
  const p = profileOf(token); if (!p) return;
  if (name) p.name = name; if (color) p.color = color; if (av) p.av = av;
}

// ---------- coins & the avatar shop ----------
// Coins belong to the profile (so to the account once there is one). Pet Farm and Marble Rush spend and earn the
// same balance. onCoins lets the server tell every open screen when it changes.
let coinHook = () => {};
export const onCoins = fn => { coinHook = fn; };
export const coinsOf = pid => profiles.get(pid)?.coins || 0;
export function addCoins(pid, n) {
  const p = profiles.get(pid); if (!p || !Number.isFinite(n) || !n) return p?.coins || 0;
  p.coins = Math.max(0, Math.round((p.coins || 0) + n)); scheduleSave(); coinHook(pid); return p.coins;
}
export const setCoins = (pid, v) => addCoins(pid, Math.round(v) - coinsOf(pid));
// The look a profile may wear: paid items it has not bought come off.
export const allowedAv = (p, av) => wearable(av, p?.owned || []);
export function buy(p, k, i) {
  if (!p) return { err: 'Not connected.' };
  i = Math.floor(+i); const id = k + ':' + i, price = priceOf(k, i);
  if (!AV_KEYS.includes(k) || !OPT[k][i] || !price) return { err: 'That is not in the shop.' };
  p.owned ||= [];
  if (p.owned.includes(id)) return { err: 'You already have that.' };
  if ((p.coins || 0) < price) return { err: `You need ${price - (p.coins || 0)} more coins for that.` };
  p.coins -= price; p.owned.push(id); scheduleSave(); coinHook(p.pid);
  return { id, price };
}
export const SHOP_SIZE = Object.keys(PRICE).length;

// What a player sees about themselves.
export function me(p) {
  return { user: p.user, name: p.name, color: p.color, av: p.av, games: p.games, wins: p.wins, pts: p.pts, byGame: p.byGame, coins: p.coins || 0, owned: p.owned || [], ...progress(p.xp) };
}
// The little badge other players see next to a name.
export function badge(p) { const g = progress(p?.xp || 0); return { lv: g.level, rank: g.rank, icon: g.icon }; }

// ---------- username + password accounts ----------
export const cleanUser = s => { const u = String(s ?? '').trim(); return /^[A-Za-z0-9_.-]{3,16}$/.test(u) ? u : null; };
const hashPass = (pass, salt) => new Promise((res, rej) => crypto.scrypt(String(pass), salt, 32, (e, k) => e ? rej(e) : res(k.toString('hex'))));

// Turns this browser's guest profile into an account, keeping everything it has earned.
export async function register(token, user, pass) {
  const u = cleanUser(user);
  if (!u) return { err: 'Usernames are 3–16 letters, numbers, dots, dashes or underscores.' };
  if (typeof pass !== 'string' || pass.length < 6 || pass.length > 72) return { err: 'Passwords need 6 to 72 characters.' };
  if (users.has(u.toLowerCase())) return { err: 'That username is taken.' };
  const p = profileOf(token);
  if (!p) return { err: 'Not connected.' };
  if (p.user) return { err: `You're already signed in as ${p.user}.` };
  const salt = rid(16), hash = await hashPass(pass, salt);
  if (users.has(u.toLowerCase())) return { err: 'That username is taken.' };
  Object.assign(p, { user: u, salt, hash });
  users.set(u.toLowerCase(), p.pid);
  scheduleSave();
  return { p };
}

export async function login(token, user, pass) {
  const pid = users.get(String(user ?? '').trim().toLowerCase()), p = profiles.get(pid);
  const salt = p?.salt || 'x'.repeat(32), hash = await hashPass(String(pass ?? ''), salt); // same work either way
  if (!p || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(p.hash, 'hex'))) return { err: 'Wrong username or password.' };
  const s = sessions.get(token); if (!s) return { err: 'Not connected.' };
  s.pid = p.pid;
  scheduleSave();
  return { p };
}

export function logout(token, look) {
  const s = sessions.get(token); if (!s) return null;
  s.pid = newProfile(look).pid;
  scheduleSave();
  return profiles.get(s.pid);
}

// ---------- friends ----------
// Friends are added by username. One side asks, the other accepts; asking someone who already asked you accepts at once.
const MAX_FRIENDS = 100;
const lists = p => { p.friends ||= []; p.reqs ||= []; p.sent ||= []; return p; };
const drop = (a, x) => { const i = a.indexOf(x); if (i >= 0) a.splice(i, 1); };
export function friendOp(p, op, user) {
  if (!p?.user) return { err: 'Create an account to add friends.' };
  const q = String(user ?? '').trim().toLowerCase(); let o = profiles.get(users.get(q));
  if (!o && q) { // not a username: people often type the name they see on screen, so try that too
    const named = [...profiles.values()].filter(x => x !== p && String(x.name ?? '').trim().toLowerCase() === q), acc = named.filter(x => x.user);
    if (acc.length === 1) o = acc[0];
    else if (acc.length > 1) return { err: 'More than one player uses that name. Ask your friend for their username: it is shown at the top of their Friends list.' };
    else if (named.length) return { err: 'That player has no account yet. Once they create one, add them by the username they chose.' };
  }
  if (!o) return { err: 'Nobody has that username. Your friend can find theirs at the top of their own Friends list.' };
  if (o === p) return { err: 'That is you!' };
  lists(p); lists(o);
  const link = () => { for (const [a, b] of [[p, o], [o, p]]) { drop(a.reqs, b.pid); drop(a.sent, b.pid); if (!a.friends.includes(b.pid)) a.friends.push(b.pid); } };
  if (op === 'add') {
    if (p.friends.includes(o.pid)) return { err: `You and ${o.user} are already friends.` };
    if (p.friends.length >= MAX_FRIENDS) return { err: 'Your friends list is full.' };
    if (p.reqs.includes(o.pid)) link();
    else if (p.sent.includes(o.pid)) return { err: `You already asked ${o.user}.` };
    else { if (o.reqs.length >= MAX_FRIENDS) return { err: 'They have too many requests waiting.' }; p.sent.push(o.pid); o.reqs.push(p.pid); }
  } else if (op === 'accept') { if (!p.reqs.includes(o.pid)) return { err: 'That request is gone.' }; link(); }
  else if (op === 'decline' || op === 'remove') { for (const [a, b] of [[p, o], [o, p]]) { drop(a.reqs, b.pid); drop(a.sent, b.pid); drop(a.friends, b.pid); } }
  else return { err: 'Unknown.' };
  scheduleSave();
  return { other: o, now: p.friends.includes(o.pid) };
}
export const areFriends = (a, b) => !!profiles.get(a)?.friends?.includes(b);
export const friendPids = pid => profiles.get(pid)?.friends || [];
// What a player sees of their friends list. online(pid) and extra(pid) are filled in by the server.
export function friendsView(p, online = () => false, extra = () => ({})) {
  lists(p);
  const card = pid => { const o = profiles.get(pid); return o?.user ? { user: o.user, name: o.name, color: o.color, av: o.av, lv: levelOf(o.xp) } : null; };
  return {
    friends: p.friends.map(pid => { const c = card(pid); return c && { ...c, online: online(pid), ...extra(pid) }; }).filter(Boolean).sort((a, b) => b.online - a.online || a.name.localeCompare(b.name)),
    reqs: p.reqs.map(card).filter(Boolean), sent: p.sent.map(card).filter(Boolean),
  };
}

// ---------- scoring ----------
// Credits one finished game to a profile. Returns what changed, for the "+XP" toast.
export function credit(p, game, { pts = 0, win = false, idle = false, coinNet = 0 }) {
  const before = levelOf(p.xp), gain = xpFor({ pts, win }), coins = (idle ? 0 : coinsFor({ win })) + (Number.isFinite(coinNet) ? coinNet : 0);
  p.xp += gain; p.games++; p.pts += Math.max(0, pts); if (win) p.wins++;
  const g = p.byGame[game] ||= { games: 0, wins: 0, best: 0 };
  g.games++; if (win) g.wins++; g.best = Math.max(g.best, pts);
  const had = p.coins || 0; addCoins(p.pid, coins);
  scheduleSave();
  return { xp: gain, win, pts, coins: (p.coins || 0) - had, level: levelOf(p.xp), levelUp: levelOf(p.xp) > before };
}

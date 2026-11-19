// Everything that survives a restart: player profiles (guest or username + password),
// browser sessions, and open lobbies with their scoreboards. One JSON file, written atomically.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { xpFor, levelOf, progress } from '../public/ranks.js';

const DIR = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
const FILE = path.join(DIR, 'cozy-table.json');
const SESSION_TTL = 180 * 86400_000; // forget unused guest sessions after half a year

export const profiles = new Map(); // pid -> profile
export const sessions = new Map(); // browser token -> { id, pid, seen }
const users = new Map();           // lower-case username -> pid
let savedRooms = [];

const rid = n => crypto.randomBytes(n).toString('hex');

// ---------- load / save ----------
export function load() {
  let d;
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); return []; }
  for (const p of Object.values(d.profiles || {})) { profiles.set(p.pid, p); if (p.user) users.set(p.user.toLowerCase(), p.pid); }
  for (const [t, s] of Object.entries(d.sessions || {})) if (profiles.has(s.pid)) sessions.set(t, s);
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
    if (inRoom.has(t) || p.user || p.games) { keepS[t] = s; keepP[p.pid] = p; }
  }
  for (const p of profiles.values()) if (p.user) keepP[p.pid] = p;
  const data = JSON.stringify({ v: 1, saved: new Date().toISOString(), profiles: keepP, sessions: keepS, rooms });
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

// ---------- profiles & sessions ----------
function newProfile(look = {}) {
  const p = { pid: rid(8), user: null, name: look.name || 'Guest', color: look.color || '#ff8fab', av: look.av || null,
    xp: 0, games: 0, wins: 0, pts: 0, byGame: {}, created: Date.now() };
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

// What a player sees about themselves.
export function me(p) {
  return { user: p.user, name: p.name, color: p.color, av: p.av, games: p.games, wins: p.wins, pts: p.pts, byGame: p.byGame, ...progress(p.xp) };
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

// ---------- scoring ----------
// Credits one finished game to a profile. Returns what changed, for the "+XP" toast.
export function credit(p, game, { pts = 0, win = false }) {
  const before = levelOf(p.xp), gain = xpFor({ pts, win });
  p.xp += gain; p.games++; p.pts += Math.max(0, pts); if (win) p.wins++;
  const g = p.byGame[game] ||= { games: 0, wins: 0, best: 0 };
  g.games++; if (win) g.wins++; g.best = Math.max(g.best, pts);
  scheduleSave();
  return { xp: gain, win, pts, level: levelOf(p.xp), levelUp: levelOf(p.xp) > before };
}

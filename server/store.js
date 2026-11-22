// Everything that survives a restart: player profiles (guest or username + password),
// browser sessions, and open lobbies with their scoreboards. One JSON file, written atomically.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { xpFor, placeCoins, levelOf, progress } from '../public/ranks.js';
import { COS, WORN, cosItem, cosPrice, cosOnSale, cosSeason, cosHas, flairOf, stickerPack } from '../public/cosmetics.js';
import { PRICE, priceOf, wearable, onSale, seasonOf, SEASONS, AV_KEYS, OPT } from '../public/avatar.js';

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
// Text other players see (names): no control characters or angle brackets, and straight quotes become curly ones,
// so a name can never break out of the page's HTML even where a screen forgets to escape it.
export const safeText = s => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/"/g, '”').replace(/'/g, '’');

// ---------- load / save ----------
export function load() {
  let d;
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); return []; }
  for (const p of Object.values(d.profiles || {})) {
    profiles.set(p.pid, p); if (p.user) users.set(p.user.toLowerCase(), p.pid);
    if (typeof p.name === 'string') p.name = safeText(p.name);
    // Coins arrived after people had already played: everyone starts with what their past games would have paid.
    if (!Number.isFinite(p.coins)) p.coins = 5 * (p.games || 0) + 10 * (p.wins || 0); // the old rate: 5 a game, 10 more a win
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
  board = null;
}

// ---------- coins & the avatar shop ----------
// Coins belong to the profile (so to the account once there is one). Pet Farm and Marble Rush spend and earn the
// same balance. onCoins lets the server tell every open screen when it changes.
let coinHook = () => {};
export const onCoins = fn => { coinHook = fn; };
// Tests move the shop's calendar with SHOP_DATE (e.g. 2026-07-01), so seasonal drops can be checked any day of the year.
const now = () => process.env.SHOP_DATE ? Date.parse(process.env.SHOP_DATE + 'T12:00') : Date.now();
export const shopDate = () => { const d = new Date(now()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
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
  if (Object.hasOwn(COS, k)) return buyCos(p, k, i);
  i = Math.floor(+i); const id = k + ':' + i, price = priceOf(k, i);
  if (!AV_KEYS.includes(k) || !OPT[k][i] || !price) return { err: 'That is not in the shop.' };
  p.owned ||= [];
  if (p.owned.includes(id)) return { err: 'You already have that.' };
  if (!onSale(k, i, new Date(now()))) return { err: `That is part of the ${SEASONS[seasonOf(k, i)].name}. It is back in ${SEASONS[seasonOf(k, i)].back}.` };
  if ((p.coins || 0) < price) return { err: `You need ${price - (p.coins || 0)} more coins for that.` };
  p.coins -= price; p.owned.push(id); scheduleSave(); coinHook(p.pid);
  return { id, price };
}
// Account cosmetics (public/cosmetics.js): name colours, frames, titles, win effects, sticker packs.
// Buying one puts it on straight away.
function buyCos(p, k, i) {
  i = Math.floor(+i); const id = k + ':' + i, it = cosItem(k, i), price = cosPrice(k, i);
  if (!it || !price) return { err: 'That is not in the shop.' };
  p.owned ||= [];
  if (p.owned.includes(id)) return { err: 'You already have that.' };
  if (!cosOnSale(k, i, new Date(now()))) return { err: `That is part of the ${cosSeason(k, i).name}. It is back in ${cosSeason(k, i).back}.` };
  if ((p.coins || 0) < price) return { err: `You need ${price - (p.coins || 0)} more coins for that.` };
  p.coins -= price; p.owned.push(id);
  if (WORN.includes(k)) (p.cos ||= {})[k] = i;
  board = null; scheduleSave(); coinHook(p.pid);
  return { id, price, cos: true };
}
// Put on (or take off, with 0) something the player has bought or earned.
export function wear(p, k, i) {
  if (!p) return { err: 'Not connected.' };
  i = Math.floor(+i);
  if (!WORN.includes(k) || !cosItem(k, i)) return { err: 'Unknown.' };
  if (!cosHas(p, k, i)) return { err: 'You have not unlocked that yet.' };
  (p.cos ||= {})[k] = i; board = null; scheduleSave();
  return { ok: true };
}
// The Pet Farm pet that sits beside the player in waiting rooms ('' for none). The caller checks it is theirs.
export function companion(p, ids) {
  if (!p?.user) return { err: 'Log in to bring a pet along.' };
  ids = [...new Set(ids)].slice(0, PET_SLOTS);
  p.cos ||= {};
  if (ids.length) { p.cos.pets = ids; p.cos.pet = ids[0]; } else { delete p.cos.pets; delete p.cos.pet; }
  scheduleSave();
  return { ok: true };
}
export const PET_SLOTS = 3; // pets shown off on the player's isle; the first one also sits beside them in waiting rooms
export const showPets = p => (p?.cos?.pets || (p?.cos?.pet ? [p.cos.pet] : [])).slice(0, PET_SLOTS);

// A profile's public name tag: what the site hands out so anyone can open that player's profile card.
// Profile ids and usernames never leave the server.
let tags = null;
export function tagOf(p) {
  if (!p) return undefined;
  if (!p.tag) { p.tag = rid(6); tags?.set(p.tag, p); scheduleSave(); }
  return p.tag;
}
export function byTag(tag) {
  if (typeof tag !== 'string' || !/^[0-9a-f]{12}$/.test(tag)) return null;
  if (!tags) { tags = new Map(); for (const p of profiles.values()) if (p.tag) tags.set(p.tag, p); }
  const p = tags.get(tag); return p && profiles.get(p.pid) === p ? p : null;
}
// The profile card other players may open: the look, the rank and how they have done in each game. Nothing private.
export function publicProfile(p) {
  const games = Object.entries(p.byGame || {}).filter(([, g]) => g?.games).map(([g, x]) => ({ g, games: x.games, wins: x.wins || 0, best: x.best || 0 }))
    .sort((a, b) => b.wins - a.wins || b.games - a.games).slice(0, 4);
  return { pt: tagOf(p), name: p.name || 'Guest', color: p.color, av: p.av, fl: flair(p), guest: !p.user, ...badge(p), xp: p.xp || 0, games: p.games || 0, wins: p.wins || 0, top: games };
}
// What other players see of this profile's cosmetics: { nm, fr, ti, wn } with unset ones left out.
export const flair = p => p ? flairOf(p) : {};
// May this profile send reaction k? The first twelve are free, the rest come in sticker packs.
export const mayReact = (p, k) => k < 12 || cosHas(p, 'sp', stickerPack(k));
export const SHOP_SIZE = Object.keys(PRICE).length;

// What a player sees about themselves.
export function me(p) {
  return { user: p.user, name: p.name, color: p.color, av: p.av, games: p.games, wins: p.wins, pts: p.pts, byGame: p.byGame, coins: p.coins || 0, owned: p.owned || [], cos: p.cos || {}, daily: { best: p.daily?.best || 0 }, today: shopDate(), ...progress(p.xp) };
}
// The little badge other players see next to a name.
export function badge(p) { const g = progress(p?.xp || 0); return { lv: g.level, rank: g.rank, icon: g.icon }; }

// ---------- username + password accounts ----------
// Passwords are never stored: only a scrypt hash with a random salt per account. Recovery codes and host reset
// codes are long random codes, so a plain SHA-256 of them is enough (and they can only be tried a few times a minute).
export const cleanUser = s => { const u = String(s ?? '').trim(); return /^[A-Za-z0-9_.-]{3,16}$/.test(u) ? u : null; };
const hashPass = (pass, salt) => new Promise((res, rej) => crypto.scrypt(String(pass), salt, 32, (e, k) => e ? rej(e) : res(k.toString('hex'))));
const passErr = pass => typeof pass !== 'string' || pass.length < 6 || pass.length > 72 ? 'Passwords need 6 to 72 characters.' : null;
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function passOk(p, pass) {
  const hash = await hashPass(String(pass ?? ''), p?.salt || 'x'.repeat(32)); // same work either way
  return !!p?.hash && same(hash, p.hash);
}
async function setPass(p, pass) { const salt = rid(16); Object.assign(p, { salt, hash: await hashPass(pass, salt) }); }

// Codes are groups of letters and digits that are hard to mix up (no I, O, 0 or 1). Typing is forgiving: case,
// spaces and dashes don't matter.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = (groups = 4) => Array.from({ length: groups }, () => Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(32)]).join('')).join('-');
export const codeHash = code => crypto.createHash('sha256').update(String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
function giveRecovery(p) { const code = newCode(); p.rc = codeHash(code); scheduleSave(); return code; }

// Every other browser signed in to this account becomes a guest again (after a password change or reset).
// Returns their tokens so the server can tell those screens.
export function signOutOthers(p, keep) {
  const out = [];
  for (const [t, s] of sessions) if (s.pid === p.pid && t !== keep) { s.pid = newProfile({ name: p.name, color: p.color }).pid; out.push(t); }
  if (out.length) scheduleSave();
  return out;
}

// Turns this browser's guest profile into an account, keeping everything it has earned.
// Also hands out the account's first recovery code, which the player is asked to keep somewhere safe.
export async function register(token, user, pass) {
  const u = cleanUser(user);
  if (!u) return { err: 'Usernames are 3–16 letters, numbers, dots, dashes or underscores.' };
  const bad = passErr(pass); if (bad) return { err: bad };
  if (users.has(u.toLowerCase())) return { err: 'That username is taken.' };
  const p = profileOf(token);
  if (!p) return { err: 'Not connected.' };
  if (p.user) return { err: `You're already signed in as ${p.user}.` };
  const salt = rid(16), hash = await hashPass(pass, salt);
  if (users.has(u.toLowerCase())) return { err: 'That username is taken.' };
  if (p.user) return { err: `You're already signed in as ${p.user}.` };
  Object.assign(p, { user: u, salt, hash });
  users.set(u.toLowerCase(), p.pid); board = null;
  scheduleSave();
  return { p, code: giveRecovery(p) };
}

export async function login(token, user, pass) {
  const p = profiles.get(users.get(String(user ?? '').trim().toLowerCase()));
  if (!(await passOk(p, pass))) return { err: 'Wrong username or password.' };
  const s = sessions.get(token); if (!s) return { err: 'Not connected.' };
  s.pid = p.pid;
  scheduleSave();
  return { p };
}

// Signed in, knows the current password, picks a new one. Other devices are signed out.
export async function changePassword(token, old, pass) {
  const p = profileOf(token);
  if (!p?.user) return { err: 'Log in first.' };
  const bad = passErr(pass); if (bad) return { err: bad };
  if (!(await passOk(p, old))) return { err: 'Your current password is not right.', wrong: true };
  await setPass(p, pass); delete p.resets;
  scheduleSave();
  return { p, out: signOutOthers(p, token) };
}

// A fresh recovery code for a signed-in player (asks for the password, so nobody at an unlocked screen can take it).
// The old code stops working.
export async function recoveryCode(token, pass) {
  const p = profileOf(token);
  if (!p?.user) return { err: 'Log in first.' };
  if (!(await passOk(p, pass))) return { err: 'That password is not right.', wrong: true };
  return { p, code: giveRecovery(p) };
}

// Forgot the password: username + a recovery code (or a one-time code from the host) + a new password.
// Logs this browser in, signs every other device out, and hands out a new recovery code (the old one is used up).
export async function recover(token, user, code, pass) {
  const p = profiles.get(users.get(String(user ?? '').trim().toLowerCase()));
  const bad = passErr(pass); if (bad) return { err: bad };
  const h = codeHash(code), now = Date.now();
  const reset = p?.resets?.find(r => r.exp > now && same(r.h, h));
  if (!p || !(reset || same(p.rc, h))) return { err: 'That username and code do not match.', wrong: true };
  const s = sessions.get(token); if (!s) return { err: 'Not connected.' };
  await setPass(p, pass); delete p.resets;
  s.pid = p.pid;
  const out = signOutOthers(p, token);
  return { p, out, code: giveRecovery(p) };
}

// The host can make a one-time reset code on the server with `npm run reset-password -- <username>` (server/reset.js).
// That script drops a small file in the data folder; the running server picks it up here.
export const RESET_TTL = 24 * 3600_000;
export function addReset(user, h, exp) {
  const p = profiles.get(users.get(String(user ?? '').toLowerCase()));
  if (!p || !/^[0-9a-f]{64}$/.test(h)) return false;
  p.resets = [...(p.resets || []).filter(r => r.exp > Date.now()), { h, exp: Math.min(+exp || 0, Date.now() + RESET_TTL) }].slice(-3);
  scheduleSave();
  return true;
}
setInterval(() => {
  let files; try { files = fs.readdirSync(DIR).filter(f => /^reset-[a-z0-9]+\.json$/.test(f)); } catch { return; }
  for (const f of files) {
    const file = path.join(DIR, f);
    try { const r = JSON.parse(fs.readFileSync(file, 'utf8')); console.log(addReset(r.user, r.h, r.exp) ? `password reset code made for ${r.user}` : `reset file for unknown user ${r.user} ignored`); }
    catch (e) { console.error(f, 'could not be read', e.message); }
    try { fs.unlinkSync(file); } catch {}
  }
}, 3000).unref();

export function logout(token, look) {
  const s = sessions.get(token); if (!s) return null;
  s.pid = newProfile(look).pid;
  scheduleSave();
  return profiles.get(s.pid);
}

// Guest profiles that never did anything are kept only in memory. Forget them (and their browser sessions) once they
// have been gone an hour, so someone opening thousands of connections can't slowly fill the server's memory.
// active(token) says whether the server still has that browser connected or seated somewhere.
export function prune(active) {
  const now = Date.now(), held = new Map();
  for (const s of sessions.values()) held.set(s.pid, (held.get(s.pid) || 0) + 1);
  const empty = p => !p.user && !p.games && !p.coins && !p.xp && !p.owned?.length && !p.friends?.length;
  let n = 0;
  for (const [t, s] of sessions) {
    const p = profiles.get(s.pid);
    if (!p || !empty(p) || active(t) || now - s.seen < 3600_000 || held.get(s.pid) > 1) continue;
    sessions.delete(t); profiles.delete(p.pid); n++;
  }
  for (const [pid, p] of profiles) if (empty(p) && !held.has(pid) && now - (p.created || 0) > 3600_000) { profiles.delete(pid); n++; }
  return n;
}

// ---------- friends ----------
// Friends are added by username. One side asks, the other accepts; asking someone who already asked you accepts at once.
const MAX_FRIENDS = 100;
const lists = p => { p.friends ||= []; p.reqs ||= []; p.sent ||= []; return p; };
const drop = (a, x) => { const i = a.indexOf(x); if (i >= 0) a.splice(i, 1); };
export function friendOp(p, op, user, target = null) { // target: the other profile, when it was picked from a profile card instead of typed
  if (!p?.user) return { err: 'Create an account to add friends.' };
  if (target && !target.user) return { err: 'That player has no account yet, so they cannot be added.' };
  const q = target ? '' : String(user ?? '').trim().toLowerCase(); let o = target || profiles.get(users.get(q));
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
// How the viewer stands with another player, for the button on their profile card.
export function relation(p, o) {
  if (!p || !o || p === o) return 'me';
  if (!p.user) return 'guest'; if (!o.user) return 'noacc';
  lists(p);
  return p.friends.includes(o.pid) ? 'friend' : p.sent.includes(o.pid) ? 'sent' : p.reqs.includes(o.pid) ? 'req' : 'none';
}
export const friendPids = pid => profiles.get(pid)?.friends || [];
// What a player sees of their friends list. online(pid) and extra(pid) are filled in by the server.
export function friendsView(p, online = () => false, extra = () => ({})) {
  lists(p);
  const card = pid => { const o = profiles.get(pid); return o?.user ? { user: o.user, pt: tagOf(o), name: o.name, color: o.color, av: o.av, lv: levelOf(o.xp), fl: flair(o) } : null; };
  return {
    friends: p.friends.map(pid => { const c = card(pid); return c && { ...c, online: online(pid), ...extra(pid) }; }).filter(Boolean).sort((a, b) => b.online - a.online || a.name.localeCompare(b.name)),
    reqs: p.reqs.map(card).filter(Boolean), sent: p.sent.map(card).filter(Boolean),
  };
}

// ---------- scoring ----------
// Credits one finished game to a profile. Returns what changed, for the "+XP" toast.
// place / of: where this player finished out of how many places (see placeCoins in ranks.js). Without a place a win
// counts as 1st and anything else as last.
export function credit(p, game, { pts = 0, win = false, idle = false, coinNet = 0, place, of = 1 }) {
  if (!Number.isFinite(place)) place = win ? 1 : Math.max(1, of);
  const before = levelOf(p.xp), gain = xpFor({ pts, win }), coins = (idle ? 0 : placeCoins(place, of)) + (Number.isFinite(coinNet) ? coinNet : 0);
  p.xp += gain; p.games++; p.pts += Math.max(0, pts); if (win) p.wins++;
  const g = p.byGame[game] ||= { games: 0, wins: 0, best: 0 };
  g.games++; if (win) g.wins++; g.best = Math.max(g.best, pts);
  g.pts = (g.pts || 0) + Math.max(0, pts); // added for the global rankings; older saves start counting from here
  if (Number.isFinite(coinNet) && coinNet) g.net = (g.net || 0) + coinNet; // Marble Rush: coins won minus coins lost on bets
  board = null;
  const had = p.coins || 0; addCoins(p.pid, coins);
  scheduleSave();
  return { xp: gain, win, pts, place, of, coins: (p.coins || 0) - had, level: levelOf(p.xp), levelUp: levelOf(p.xp) > before };
}

// ---------- global rankings ----------
// One leaderboard per minigame (plus an overall one by XP) across every profile on the server. Only people are in
// it: bots never get a profile. Guests are included, except a guest who shares a name with an account (most often
// the same person before they logged in on that browser). Profile ids never leave the server.
const TOP = 25;
let board = null; // cached rows per game, thrown away whenever a game is credited
export const invalidateBoards = () => { board = null; };
const ORDER = {
  overall: (a, b) => b.xp - a.xp || b.wins - a.wins,
  marbles: (a, b) => b.wins - a.wins || b.net - a.net || a.games - b.games,
  hay: (a, b) => b.best - a.best || b.wins - a.wins || b.pts - a.pts, // Hay Hunch is solo: best single field, then fields cleared
  default: (a, b) => b.wins - a.wins || b.rate - a.rate || b.best - a.best || a.games - b.games,
};
function boardRows(game) {
  board ||= {};
  if (board[game]) return board[game];
  const accounts = new Set([...profiles.values()].filter(p => p.user).map(p => String(p.name ?? '').trim().toLowerCase()));
  const rows = [];
  for (const p of profiles.values()) {
    if (!p.user && accounts.has(String(p.name ?? '').trim().toLowerCase())) continue;
    const g = game === 'overall' ? { games: p.games || 0, wins: p.wins || 0, best: 0, pts: p.pts || 0 } : p.byGame?.[game];
    if (!g?.games) continue;
    rows.push({ pid: p.pid, pt: tagOf(p), name: p.name || 'Guest', color: p.color, av: p.av, fl: flair(p), guest: !p.user, ...badge(p), xp: p.xp || 0,
      games: g.games, wins: g.wins || 0, best: g.best || 0, pts: g.pts || 0, net: g.net || 0, top: g.top || 0, rate: Math.min(100, Math.round(100 * (g.wins || 0) / g.games)) });
  }
  rows.sort(ORDER[game] || ORDER.default);
  return board[game] = rows;
}
// The top of one leaderboard for the hub, plus the asker's own place when they are further down.
export function leaderboard(game, pid) {
  const rows = boardRows(game), strip = ({ pid: id, ...r }, i) => ({ ...r, pos: i + 1, me: id === pid });
  const at = rows.findIndex(r => r.pid === pid);
  return { game, total: rows.length, rows: rows.slice(0, TOP).map(strip), mine: at >= TOP ? strip(rows[at], at) : null };
}

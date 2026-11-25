// Player reports and the hosts' moderation (mutes, warnings, bans), reviewed in the Admin panel's Reports tab.
// - Anyone can report another player from their profile card: a reason, an optional note, and the server adds the
//   context by itself (where both of them are, the reported player's recent hub chat lines with the lines around them,
//   and the chat of the table they share). Kept in DATA_DIR/reports.json; closed reports go after KEEP_DONE days.
// - Hosts (ADMINS) warn, mute or ban a player for a while or for good. A sanction lives on the profile (p.mod), so it
//   follows the account to every device; a ban also marks the browsers it was on (session.ban), so logging out to
//   play as a guest from the same browser doesn't get round it. Hosts can't be sanctioned.
// Profile ids never leave the server: players are named by their public tag (pt), like on profile cards.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, profiles, sessions, tagOf, byTag, isAdmin, scheduleSave, addCoins } from './store.js';

const FILE = path.join(DATA_DIR, 'reports.json');
export const REASONS = ['chat', 'spam', 'cheat', 'grief', 'name', 'other'];
export const MAX_NOTE = 400, MAX_WHY = 200;
export const MUTE_MINS = [15, 60, 1440, 10080, 43200, 0];   // 0 = for good
export const BAN_MINS = [60, 1440, 10080, 43200, 0];
const KEEP_DONE = 90 * 24 * 3600_000;   // closed reports are kept this long, then deleted
const KEEP_OPEN = 180 * 24 * 3600_000;  // an open report nobody looked at goes after this
const KEEP_LOG = 180 * 24 * 3600_000;   // the hosts' list of what they did
const MAX_REPORTS = 2000, MAX_LOG = 500;
// Kuba (2026-11-25): when a report leads to a ban, the reporter is thanked with a few coins. At most REWARD_WEEK
// rewards a week, and one per banned player, so alt accounts reporting each other can't farm it.
export const REWARD = 25, REWARD_WEEK = 3;

let reports = [], log = [];
// Bans of a device (the random id the page keeps in the browser) or an address (a salted hash of it; IPv6 by its /64),
// for a ban of the "device" or "address" tier: id -> { until, why, at, by, pid }. The tier is for hosts only.
let devBans = {}, ipBans = {}, salt = '';
export const TIERS = ['acct', 'dev', 'ip'];
const IP_KEEP = 14 * 24 * 3600_000; // a profile remembers the addresses it came from (hashed) this long, like the logs
export const ipHash = ip => ip ? crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 20) : '';
export const cleanDev = v => typeof v === 'string' && /^[a-z0-9]{16,32}$/.test(v) ? v : '';
let timer = null, dirty = false;

const newId = () => crypto.randomBytes(5).toString('hex');
const line = (s, n) => Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f<>\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, n).join('').trim();
const text = (s, n) => Array.from(String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f<>\u2028\u2029]/g, ' ')
  .split('\n').map(x => x.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()).slice(0, n).join('');

export function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(d.reports)) reports = d.reports.filter(r => r && typeof r.id === 'string' && typeof r.tpid === 'string');
    if (Array.isArray(d.log)) log = d.log.filter(x => x && typeof x.at === 'number');
    if (d.devBans && typeof d.devBans === 'object') devBans = d.devBans;
    if (d.ipBans && typeof d.ipBans === 'object') ipBans = d.ipBans;
    if (typeof d.salt === 'string') salt = d.salt;
  } catch (e) { if (e.code !== 'ENOENT') console.error('could not read', FILE, e.message); }
  if (!salt) { salt = crypto.randomBytes(16).toString('hex'); save(); }
  tidy();
}
export function saveNow() {
  clearTimeout(timer); timer = null;
  if (!dirty) return; dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify({ v: 1, reports, log, devBans, ipBans, salt }));
    fs.renameSync(FILE + '.tmp', FILE);
  } catch (e) { console.error(`could not save ${FILE}:`, e.message); }
}
const save = () => { dirty = true; if (!timer) timer = setTimeout(saveNow, 2000); };
function tidy(now = Date.now()) {
  const n = reports.length + log.length;
  reports = reports.filter(r => r.done ? now - r.done.at < KEEP_DONE : now - r.at < KEEP_OPEN).slice(-MAX_REPORTS);
  log = log.filter(x => now - x.at < KEEP_LOG).slice(-MAX_LOG);
  for (const m of [devBans, ipBans]) for (const [k, b] of Object.entries(m)) if (b.until && b.until <= now) { delete m[k]; dirty = true; }
  if (reports.length + log.length !== n) save();
}
setInterval(tidy, 3600_000).unref();

// ---------- what a player is under ----------
const live = (x, now = Date.now()) => x && (!x.until || x.until > now) ? x : null;
export const muteOf = p => live(p?.mod?.mute);
// A ban on the account, or on this browser (a ban made while it was logged in to the banned account).
// c (the connection) adds the device and address tiers: c.dev, c.iph.
export function banOf(p, token, c = null) {
  if (isAdmin(p)) return null; // a host on a banned device or address (a shared home connection) still gets in
  const s = token ? sessions.peek(token) : null, a = live(p?.mod?.ban);
  // a browser that logs in to a banned account carries the ban from then on, logged out too
  if (a) { if (s && s.ban !== a) { s.ban = a; s.banPid = p.pid; } return a; }
  const sb = live(s?.ban); if (sb) return sb;
  const db = c?.dev ? live(devBans[c.dev]) : null;
  // a device under an address-tier ban that turns up from a new address (a VPN, a new IP) takes that address along
  // too, until the ban ends. Never the other way round: a new device on a banned address may be someone else at home.
  if (db) { if (db.tier === 'ip' && c.iph && (ipBans[c.iph]?.pid !== db.pid || ipBans[c.iph]?.at !== db.at)) { ipBans[c.iph] = db; save(); } return db; }
  return (c?.iph && live(ipBans[c.iph])) || null;
}
// Each profile remembers its last few devices and (for two weeks, hashed) addresses, so a host's device or address
// ban knows what to block. Called when a screen connects or logs in.
export function seenOn(p, c) {
  if (!p || !c) return;
  const now = Date.now(), m = p.seen ||= {}; let ch = false;
  if (c.dev && m.devs?.[0] !== c.dev) { m.devs = [c.dev, ...(m.devs || []).filter(x => x !== c.dev)].slice(0, 5); ch = true; }
  const ips = (m.ips || []).filter(x => now - x.at < IP_KEEP);
  if (c.iph && (ips[0]?.h !== c.iph || now - ips[0].at > 3600_000)) { m.ips = [{ h: c.iph, at: now }, ...ips.filter(x => x.h !== c.iph)].slice(0, 5); ch = true; }
  else if (ips.length !== (m.ips || []).length) { m.ips = ips; ch = true; }
  if (ch) scheduleSave();
}
const pub = x => x && { until: x.until || 0, why: x.why || '' };
const pubT = x => x && { ...pub(x), tier: x.tier || 'acct' }; // for hosts: with the tier
/** What the player is told about their own standing: { mute, ban, warn } (warn = the newest warning not yet read). */
export function mine(p, token, c = null) {
  const w = (p?.mod?.warns || []).filter(x => !x.seen).at(-1), th = p?.mod?.thanks?.[0];
  return { t: 'modme', mute: pub(muteOf(p)), ban: pub(banOf(p, token, c)), warn: w ? { id: w.id, why: w.why, at: w.at } : null, thanks: th ? { id: th.id, name: th.name, coins: th.coins } : null };
}
export function thanked(p, id) {
  const l = p?.mod?.thanks; if (!l?.some(x => x.id === id)) return false;
  p.mod.thanks = l.filter(x => x.id !== id); if (!p.mod.thanks.length) delete p.mod.thanks;
  scheduleSave(); return true;
}
export function seen(p, id) {
  const w = p?.mod?.warns?.find(x => x.id === id); if (!w || w.seen) return false;
  w.seen = Date.now(); scheduleSave(); return true;
}

// ---------- reports ----------
// ctx is filled in by server.js: { where, twhere, hub, around, table } (see there).
export function report(p, target, m, ctx = {}) {
  if (!p) return { err: 'Something went wrong. Try again.' };
  if (!target) return { err: 'That player is not around any more.' };
  if (target === p) return { err: 'You can’t report yourself.' };
  const why = REASONS.includes(m?.why) ? m.why : null;
  if (!why) return { err: 'Pick what happened first.' };
  const note = text(m?.note, MAX_NOTE);
  if (why === 'other' && !note) return { err: 'Write a few words about what happened.' };
  if (reports.some(r => !r.done && r.rpid === p.pid && r.tpid === target.pid && Date.now() - r.at < 3600_000))
    return { err: 'You already reported this player. The hosts will have a look.' };
  const r = { id: newId(), at: Date.now(), why, note, rpid: p.pid, tpid: target.pid,
    by: { name: line(p.name, 16) || 'Guest', user: p.user || '' },
    who: { name: line(target.name, 16) || 'Guest', user: target.user || '', color: target.color, av: target.av },
    from: ['hub', 'table', 'plaza', 'who', 'chat'].includes(m?.from) ? m.from : 'hub', ...ctx };
  reports.push(r); if (reports.length > MAX_REPORTS) reports.shift();
  save(); saveNow();
  return { ok: true, r };
}
export const openCount = () => new Set(reports.filter(r => !r.done).map(r => r.tpid)).size;

// ---------- the hosts' views ----------
const tagFor = pid => { const p = profiles.get(pid); return p ? tagOf(p) : ''; };
function standing(p) {
  return { mute: pub(muteOf(p)), ban: pubT(live(p?.mod?.ban)), warns: (p?.mod?.warns || []).length, admin: isAdmin(p) };
}
const rView = r => ({ id: r.id, at: r.at, why: r.why, note: r.note, from: r.from, by: { ...r.by, pt: tagFor(r.rpid) },
  where: r.where || null, twhere: r.twhere || null, hub: r.hub || [], around: r.around || [], table: r.table || null, done: r.done || null });
// Open reports grouped by the reported player (one case each, newest first), and the last closed ones.
export function list() {
  const cases = new Map();
  for (const r of reports) {
    if (r.done) continue;
    let k = cases.get(r.tpid);
    if (!k) { const p = profiles.get(r.tpid); cases.set(r.tpid, k = { pt: tagFor(r.tpid), ...(p ? { name: p.name, user: p.user || '', color: p.color, av: p.av } : r.who), gone: !p, ...standing(p), reports: [] }); }
    k.reports.push(rView(r));
  }
  // what the hosts did about this player before (warnings, mutes, bans), and how many earlier reports were closed
  const past = pid => ({ past: record(profiles.get(pid)),
    pastReports: reports.filter(r => r.done && r.tpid === pid).length,
    warnList: (profiles.get(pid)?.mod?.warns || []).slice(-10).reverse().map(w => ({ at: w.at, why: w.why, by: w.by })) });
  for (const [pid, k] of cases) Object.assign(k, past(pid));
  const open = [...cases.values()].map(k => ({ ...k, reports: k.reports.sort((a, b) => b.at - a.at) })).sort((a, b) => b.reports[0].at - a.reports[0].at);
  const closed = reports.filter(r => r.done).sort((a, b) => b.done.at - a.done.at).slice(0, 40).map(r => ({ ...rView(r), pt: tagFor(r.tpid), who: r.who }));
  return { open, closed };
}
// Everyone muted or banned right now, and what the hosts did lately.
export function active() {
  const now = Date.now(), rows = [];
  for (const p of profiles.values()) {
    if (!p.mod) continue;
    const mu = muteOf(p), ba = live(p.mod.ban, now);
    if (mu || ba) rows.push({ pt: tagOf(p), name: p.name, user: p.user || '', color: p.color, av: p.av, mute: pub(mu), ban: pubT(ba), warns: (p.mod.warns || []).length });
  }
  return { rows: rows.sort((a, b) => !!b.ban - !!a.ban || a.name.localeCompare(b.name)), log: log.slice(-60).reverse().map(x => ({ ...x, pt: tagFor(x.tpid), tpid: undefined })) };
}
// Find players by name or username, for acting without a report.
export function find(q) {
  q = line(q, 20).toLowerCase(); if (q.length < 2) return [];
  const out = [];
  for (const p of profiles.values()) {
    if (!(p.user && p.user.toLowerCase().includes(q)) && !(p.user && (p.name || '').toLowerCase().includes(q))) continue;
    out.push({ pt: tagOf(p), name: p.name, user: p.user, color: p.color, av: p.av, ...standing(p) });
    if (out.length >= 20) break;
  }
  return out.sort((a, b) => (b.user.toLowerCase() === q) - (a.user.toLowerCase() === q) || a.user.localeCompare(b.user));
}
// A player's earlier mutes and bans, newest first, with how long each was meant to last (mins, 0 = for good).
const record = p => (p?.mod?.hist || []).slice().reverse().map(x => ({ k: x.k, at: x.at, until: x.until, mins: x.until ? Math.round((x.until - x.at) / 60_000) : 0, why: x.why, by: x.by, ...(x.tier ? { tier: x.tier } : {}) }));
// One player's standing, warnings and reports, for the hosts' Moderate window.
export function peek(pt) {
  const p = byTag(pt); if (!p) return null;
  return { pt, name: p.name, user: p.user || '', color: p.color, av: p.av, guest: !p.user, ...standing(p),
    warnList: (p.mod?.warns || []).slice(-10).reverse().map(w => ({ at: w.at, why: w.why, by: w.by, seen: !!w.seen })), past: record(p),
    open: reports.filter(r => !r.done && r.tpid === p.pid).length, total: reports.filter(r => r.tpid === p.pid).length };
}

// ---------- the hosts' actions ----------
// k: warn | mute | ban | unmute | unban | dismiss. mins: from MUTE_MINS / BAN_MINS (0 = for good).
// Closes every open report about the player (dismiss closes them with no action). Returns { p, k, until } or { err }.
export function act(admin, m) {
  if (!isAdmin(admin)) return { err: 'Only hosts can do that.' };
  const p = byTag(m?.pt); if (!p) return { err: 'That player is not around any more.' };
  const k = String(m?.k ?? ''), why = line(m?.why, MAX_WHY), now = Date.now();
  if (!['warn', 'mute', 'ban', 'unmute', 'unban', 'dismiss'].includes(k)) return { err: 'Something went wrong. Try again.' };
  if (isAdmin(p) && k !== 'dismiss') return { err: 'Hosts can’t be muted, warned or banned.' };
  const by = admin.user;
  let until = 0;
  if (k === 'warn' || k === 'mute' || k === 'ban') {
    if (!why) return { err: 'Write the reason: the player is shown it.' };
    p.mod ||= {};
    if (k === 'warn') { (p.mod.warns ||= []).push({ id: newId(), at: now, why, by }); if (p.mod.warns.length > 30) p.mod.warns.shift(); }
    else {
      const mins = +m.mins, ok = (k === 'mute' ? MUTE_MINS : BAN_MINS).includes(mins);
      if (!ok) return { err: 'Pick how long first.' };
      until = mins ? now + mins * 60_000 : 0;
      const tier = k === 'ban' && TIERS.includes(m.tier) ? m.tier : 'acct';
      p.mod[k] = { until, why, at: now, by, ...(k === 'ban' ? { tier } : {}) };
      // every mute and ban stays in the player's record (also once it has ended), for the hosts' next decision
      (p.mod.hist ||= []).push({ k, at: now, until, why, by, ...(k === 'ban' ? { tier } : {}) }); if (p.mod.hist.length > 40) p.mod.hist.shift();
      if (k === 'ban') {
        for (const s of sessions.values()) if (s.pid === p.pid) { s.ban = p.mod.ban; s.banPid = p.pid; }
        // the tiers add up: a device ban is an account ban too, an address ban is both
        const b = { until, why, at: now, by, pid: p.pid, tier }, devs = [...(p.seen?.devs || []), ...(m.live?.devs || [])], ips = [...(p.seen?.ips || []).filter(x => now - x.at < IP_KEEP).map(x => x.h), ...(m.live?.ips || [])];
        for (const x of [devBans, ipBans]) for (const [key, v] of Object.entries(x)) if (v.pid === p.pid) delete x[key]; // a new ban replaces the old one
        if (tier !== 'acct') for (const v of devs) if (v) devBans[v] = b;
        if (tier === 'ip') for (const v of ips) if (v) ipBans[v] = b;
      }
    }
  } else if (k === 'unmute') { if (p.mod) delete p.mod.mute; }
  else if (k === 'unban') {
    if (p.mod) delete p.mod.ban;
    for (const s of sessions.values()) if (s.ban && (s.pid === p.pid || s.banPid === p.pid)) delete s.ban;
    for (const x of [devBans, ipBans]) for (const [key, v] of Object.entries(x)) if (v.pid === p.pid) delete x[key];
  }
  const closed = [];
  if (k !== 'unmute' && k !== 'unban') for (const r of reports) if (!r.done && r.tpid === p.pid) { r.done = { at: now, k, by, why, until, ...(k === 'ban' ? { tier: p.mod.ban.tier } : {}) }; closed.push(r); }
  // a ban that came from reports: every reporter is thanked (and rewarded, within the limits), now or on their next visit
  const rewarded = [];
  if (k === 'ban') for (const rpid of new Set(closed.map(r => r.rpid).filter(Boolean))) {
    const rp = profiles.get(rpid); if (!rp || rp === p) continue;
    rp.mod ||= {}; const rew = (rp.mod.rew ||= []).filter(x => now - x.at < 365 * 24 * 3600_000);
    const coins = rew.some(x => x.tpid === p.pid) || rew.filter(x => now - x.at < 7 * 24 * 3600_000).length >= REWARD_WEEK ? 0 : REWARD;
    if (coins) { rew.push({ at: now, tpid: p.pid }); addCoins(rpid, coins); }
    rp.mod.rew = rew;
    (rp.mod.thanks ||= []).push({ id: newId(), name: line(p.name, 16) || 'Guest', coins }); if (rp.mod.thanks.length > 5) rp.mod.thanks.shift();
    rewarded.push(rpid);
  }
  log.push({ at: now, k, by, tpid: p.pid, name: p.name, user: p.user || '', why, until, reports: closed.length, ...(k === 'ban' ? { tier: p.mod.ban.tier } : {}) });
  if (log.length > MAX_LOG) log.shift();
  save(); scheduleSave();
  return { p, k, until, closed, rewarded };
}

// An account was deleted: reports about it go, its own reports keep only the name it had, its sanctions went with it.
export function forget(pid) {
  reports = reports.filter(r => r.tpid !== pid);
  for (const r of reports) if (r.rpid === pid) r.rpid = '';
  log = log.filter(x => x.tpid !== pid);
  // a ban outlives the deleted account on its devices and addresses (deleting it must not be the way out)
  save(); saveNow();
}

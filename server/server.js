// Zatoka Gier game server: static files + WebSocket lobbies. No dependencies.
// Profiles, optional accounts and lobby scoreboards are saved to disk by store.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { attach, ipOf } from './ws.js';
import * as geo from './geo.js';
import { allow, blocked, note } from './limits.js';
import * as hotpot from './games/hotpot.js';
import * as marbles from './games/marbles.js';
import * as ladders from './games/ladders.js';
import * as poker from './games/poker.js';
import * as ludo from './games/ludo.js';
import * as stack from './games/stack.js';
import * as golf from './games/golf.js';
import * as dice from './games/dice.js';
import * as pan from './games/pan.js';
import * as pips from './games/pips.js';
import * as paw from './games/paw.js';
import * as kart from './games/kart.js';
import * as kitchen from './games/kitchen.js';
import * as dig from './games/dig.js';
import * as bricks from './games/bricks.js';
import * as bean from './games/bean.js';
import * as darts from './games/darts.js';
import * as tys from './games/tys.js';
import { cleanAv } from '../public/avatar.js';
import { withPlaces, fieldOf } from '../public/ranks.js';
import * as store from './store.js';
import * as farm from './farm.js';
import * as hay from './hay.js';
import * as hubchat from './hubchat.js';
import * as daily from './daily.js';

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const GAMES = { hotpot, marbles, ladders, poker, ludo, stack, golf, dice, paw, kart, kitchen, dig, bricks, bean, tys, pan, pips, darts };
const isGame = id => typeof id === 'string' && Object.hasOwn(GAMES, id); // never 'constructor' and friends
const AWAY_MS = 30_000;       // a dropped player is botted after this
const LOBBY_DROP_MS = 15_000; // a dropped player leaves a waiting lobby after this
const END_IDLE_MS = 10 * 60_000;
const RESTORE_GRACE_MS = 90_000; // after a restart, players get this long to reconnect before their seat is freed

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// Safety headers for every response. The page itself also gets a Content Security Policy: scripts may only come
// from this site and jsDelivr (three.js), so even if someone sneaks markup into a name or chat line, the browser
// refuses to run it. The one inline script (the import map) is allowed by its hash, worked out from index.html.
const BASE_HEAD = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()' };
let inline = { at: 0, src: '' };
function cspFor(req) {
  try {
    const file = path.join(ROOT, 'index.html'), at = fs.statSync(file).mtimeMs;
    if (at !== inline.at) {
      const html = fs.readFileSync(file, 'utf8'), hashes = [];
      for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) hashes.push(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
      inline = { at, src: hashes.join(' ') };
    }
  } catch {}
  const host = String(req.headers.host || '').replace(/[^a-z0-9.:\[\]-]/gi, '');
  return [`default-src 'self'`, `script-src 'self' https://cdn.jsdelivr.net ${inline.src}`, `style-src 'self' 'unsafe-inline'`,
    `font-src 'self'`, `img-src 'self' data: blob:`, `connect-src 'self'${host ? ` wss://${host} ws://${host}` : ''}`,
    `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`].join('; ');
}
// Ko-fi's webhook: after every payment Ko-fi POSTs a form with one field, data, holding JSON. It is only believed
// when it carries the verification token from Ko-fi's settings page (KOFI_TOKEN here). Without that setting the
// address does not exist.
const KOFI_TOKEN = process.env.KOFI_TOKEN || '';
const sameText = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
function kofiHook(req, res) {
  const ip = ipOf(req), done = (code, text) => { if (!res.headersSent) res.writeHead(code, { 'content-type': 'text/plain', ...BASE_HEAD }).end(text); };
  if (blocked('kofi:' + ip, 20, 10 * 60_000)) return done(429, 'slow down');
  let body = '', over = false;
  req.setEncoding('utf8');
  req.on('data', d => { if (over) return; body += d; if (body.length > 32_000) { over = true; done(413, 'too big'); req.destroy(); } });
  req.on('error', () => {});
  req.on('end', () => {
    if (over) return;
    let d; try { d = JSON.parse(new URLSearchParams(body).get('data') ?? body); } catch { d = null; }
    if (!d || typeof d !== 'object' || !sameText(d.verification_token ?? '', KOFI_TOKEN)) { note('kofi:' + ip, 10 * 60_000); console.log(`kofi: a call without the right token from ${ip}`); return done(403, 'no'); }
    const what = store.kofiPaid({ id: d.kofi_transaction_id || d.message_id, email: d.email, message: d.message }, KOFI_TOKEN);
    console.log(`kofi: ${String(d.type ?? 'payment').replace(/[^\w ]/g, '').slice(0, 20)}: ${what}`);
    done(200, 'ok');
  });
}
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && KOFI_TOKEN && req.url.split('?')[0] === '/kofi') return kofiHook(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD', ...BASE_HEAD }).end(); return; }
  let url, p;
  try { url = new URL(req.url, 'http://x'); p = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400, BASE_HEAD).end(); return; } // a broken address like /%E0 used to crash the whole server
  if (url.pathname === '/health') { res.end('ok'); return; }
  if (p.includes('\0')) { res.writeHead(400, BASE_HEAD).end(); return; }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    const ext = path.extname(file);
    // Always revalidate, so a browser never mixes old and new client files after a deploy.
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const head = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-cache', etag, ...BASE_HEAD };
    if (ext === '.html') head['content-security-policy'] = cspFor(req);
    if (req.headers['x-forwarded-proto'] === 'https') head['strict-transport-security'] = 'max-age=31536000'; // behind Caddy: browsers stick to HTTPS
    // The page carries the server's guess at the visitor's language (Poland: Polish), which i18n.js reads on a first visit.
    const lang = ext === '.html' ? geo.langFor(ipOf(req), req.headers['accept-language']) : '';
    if (lang) { head.etag = `"${etag.slice(1, -1)}-${lang}"`; head.vary = 'accept-language'; head['cache-control'] = 'private, no-cache'; }
    if (lang && req.headers['if-none-match'] === head.etag) { res.writeHead(304, head).end(); return; }
    if (lang) {
      res.writeHead(200, head);
      if (req.method === 'HEAD') { res.end(); return; }
      fs.readFile(file, 'utf8', (e, html) => res.end(e ? '' : html.replace(/<html lang="[a-z]+"/, `<html lang="${lang}" data-geo="${lang}"`)));
      return;
    }
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head).end(); return; }
    res.writeHead(200, head);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
});

// ---------- players & rooms ----------
const clients = new Map();  // token -> client {token, id, name, color, sock, room, lastSeen}
const rooms = new Map();    // code -> room

const cleanName = s => store.safeText(s).trim().slice(0, 16);
const cleanColor = s => /^#[0-9a-f]{6}$/i.test(s) ? s : '#ff8fab';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join(''); } while (rooms.has(c)); return c; };

function roomInfo(r) {
  return {
    code: r.code, game: r.game, gameName: GAMES[r.game].meta.name, joinAt: GAMES[r.game].meta.joinAt || 'game', host: r.host, priv: r.priv,
    state: r.G ? r.G.ph : 'lobby', opts: r.opts, max: GAMES[r.game].meta.maxPlayers,
    players: r.players.map(t => { const c = clients.get(t); return { id: c.id, name: c.name, color: c.color, av: c.av, online: !!c.sock, watch: r.spect.has(c.id), fl: store.flair(store.profileOf(t)), pt: store.tagOf(store.profileOf(t)), pet: palOf(store.profileOf(t)), ...store.badge(store.profileOf(t)) }; }),
    board: boardOf(r), played: r.played || 0, paid: r.G?.ph === 'end' && r.G.scored ? r.paid || null : null,
    again: againOf(r), sit: r.players.map(t => clients.get(t)?.id).filter(id => r.sit.has(id)),
  };
}
// Watchers: people who joined while a game was on (r.spect). They see the game but have no seat.
// A watcher who taps "Take a seat" goes in r.sit and takes a bot's place when the next round starts.
const seatedOf = r => r.players.filter(t => !r.spect.has(clients.get(t)?.id));
// Outside a game, move queued watchers into free seats.
function fillSeats(r) {
  if (r.G) return;
  const max = GAMES[r.game].meta.maxPlayers;
  for (const t of r.players) {
    const id = clients.get(t)?.id;
    if (r.sit.has(id) && seatedOf(r).length < max) { r.spect.delete(id); r.sit.delete(id); }
  }
}
// Play-again votes on the results screen: ids of players still at the table who want another round.
const againOf = r => r.G?.ph === 'end' && r.again ? r.players.map(t => clients.get(t)?.id).filter(id => r.again.has(id) && !r.spect.has(id)) : [];
// Lobby scoreboard: everyone who has finished a game at this table, best first.
const boardOf = r => Object.values(r.board || {}).map(({ pid, ...e }) => e)
  .sort((a, b) => b.wins - a.wins || b.pts - a.pts || a.games - b.games).slice(0, 16);

// Called whenever a game reaches its end screen: updates the table scoreboard and each player's profile.
function scoreGame(r) {
  const G = r.G, mod = GAMES[r.game];
  G.scored = true;
  const raw = mod.results?.(G); if (!raw) return;
  const res = withPlaces(raw), of = fieldOf(raw); // coins are paid by final place, the same scale for every game
  r.played = (r.played || 0) + 1; r.board ||= {};
  // What each seat was paid, for the coins column on every results screen: coins for people, 'b' for bots
  // (they have no account), null for someone who left before the end.
  r.paid = G.seats.map(seat => (seat.human && seat.id ? null : 'b'));
  // A match with a bot seat (bot: true, a seat the game filled with a bot) never counts toward the rankings. A person
  // who left mid-game and was swapped for a bot does not count as a bot seat, so the others' match still counts.
  const ranked = !G.seats.some(seat => seat.bot);
  G.seats.forEach((seat, i) => {
    if (!seat.human || !seat.id) return;
    const c = r.players.map(t => clients.get(t)).find(x => x?.id === seat.id); if (!c) return;
    const p = store.profileOf(c.token); if (!p) return;
    const e = r.board[p.pid] ||= { pid: p.pid, name: c.name, color: c.color, av: c.av, games: 0, wins: 0, pts: 0 };
    Object.assign(e, { name: c.name, color: c.color, av: c.av, fl: store.flair(p), pt: store.tagOf(p) });
    e.games++; e.pts += Math.max(0, res[i].pts); if (res[i].win) e.wins++;
    delete e.coins; // older tables kept Marble Rush coins here; coins now live on the account
    const gain = store.credit(p, r.game, { ...res[i], of, ranked });
    r.paid[i] = gain.coins;
    send(c, { t: 'me', me: store.me(p), gain });
  });
  for (const pid of store.notePodium()) for (const c of clientsOf(pid)) send(c, { t: 'me', me: store.me(store.profileOf(c.token)) }); // a new best place in the overall ranking can unlock a card background
  // The winner's win effect plays on every screen at the table (the first human winner with one on).
  const wi = G.seats.findIndex((seat, i) => seat.human && seat.id && res[i].win), wc = wi >= 0 && r.players.map(t => clients.get(t)).find(x => x?.id === G.seats[wi].id);
  const fx = wc && store.flair(store.profileOf(wc.token)).wn;
  if (fx) for (const t of r.players) send(clients.get(t), { t: 'winfx', id: wc.id, name: wc.name, k: fx });
  sendRoom(r); store.scheduleSave();
}
const publicRooms = () => [...rooms.values()].filter(r => !r.priv).map(r => {
  const i = roomInfo(r), h = i.players.find(p => p.id === i.host);
  return { code: i.code, game: i.game, gameName: i.gameName, state: i.state, n: i.players.filter(p => !p.watch).length, max: i.max, w: i.players.filter(p => p.watch).length,
    host: h?.name || '?', hostColor: h?.color, hostAv: h?.av };
});

function send(c, msg) { c?.sock?.send(msg); }
// Pet Farm reaches a player who is not the one asking (live battles) through this. Returns how many screens got it.
// Coins changed (a game paid out, the shop, Pet Farm): refresh the balance on every screen of that player.
const coinWait = new Map();
store.onDecor(farm.decorOf);
store.onCoins(pid => { if (!coinWait.has(pid)) coinWait.set(pid, setTimeout(() => { coinWait.delete(pid); const p = store.profiles.get(pid); if (p) for (const c of clientsOf(pid)) send(c, { t: 'me', me: store.me(p) }); }, 250)); });
// The Pet Farm pet a player has brought along, as others see it (no ids), or undefined.
const palView = x => ({ sp: x.sp, name: x.name, lv: x.lv, look: x.look });
const palsOf = p => (p?.user ? store.showPets(p).map(id => farm.petOf(p.pid, id)).filter(Boolean).map(palView) : []); // every pet they show off on their isle
const palOf = p => palsOf(p)[0];
store.onPack(pid => { const p = store.profiles.get(pid); if (p) for (const c of clientsOf(pid)) { send(c, { t: 'me', me: store.me(p) }); send(c, { t: 'pack', k: 'kofi' }); } });
farm.setPush((pid, msg) => { const cs = clientsOf(pid); if (msg) for (const c of cs) send(c, msg); return cs.length; });
// Everyone connected as this profile (a player may have the hub open on a phone and a laptop).
const clientsOf = pid => [...clients.values()].filter(c => c.sock && store.profileOf(c.token)?.pid === pid);
function sendFriends(p, news = null) {
  if (!p) return;
  const view = p.user ? store.friendsView(p, pid => clientsOf(pid).length > 0, pid => ({ farm: farm.fidOf(pid) })) : { friends: [], reqs: [], sent: [] };
  for (const c of clientsOf(p.pid)) send(c, { t: 'friends', ...view, news });
}
// Everyone on the site right now, for hosts (ADMINS). One row per person (a phone and a laptop count once), with
// where they are. Names only: no addresses, no tokens.
const WHERE = new Set(['hub', 'farm', 'hay']);
function whoList() {
  const rows = new Map();
  for (const c of clients.values()) {
    if (!c.sock) continue;
    const p = store.profileOf(c.token), key = p?.pid || c.token, r = rooms.get(c.room);
    const at = r ? { k: 'table', game: r.game, code: r.priv ? '' : r.code, play: !!r.G && r.G.ph !== 'end', watch: r.spect.has(c.id) } : { k: c.view || 'hub' };
    const old = rows.get(key);
    if (old) { old.n++; old.since = Math.min(old.since, c.since || Date.now()); if (at.k === 'table') old.at = at; continue; }
    rows.set(key, { name: c.name, user: p?.user || '', color: c.color, av: c.av, fl: store.flair(p), pt: store.tagOf(p), ...store.badge(p), at, since: c.since || Date.now(), n: 1 });
  }
  return [...rows.values()].sort((a, b) => (b.at.k === 'table') - (a.at.k === 'table') || a.since - b.since);
}
// Live "playing now" + all-time visitor numbers for the hub. Batched so a burst of joins sends one update.
const statsMsg = () => ({ t: 'stats', online: [...clients.values()].filter(c => c.sock).length, visitors: store.visitorCount() });
let statsTimer = null, lastStats = '';
function broadcastStats() {
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    const msg = statsMsg(), key = msg.online + '/' + msg.visitors; if (key === lastStats) return; lastStats = key;
    for (const c of clients.values()) send(c, msg);
  }, 1000);
}
function broadcastRooms() { const msg = { t: 'rooms', rooms: publicRooms() }; for (const c of clients.values()) if (c.sock && !c.room) send(c, msg); }
function sendRoom(r) { const info = roomInfo(r); for (const t of r.players) send(clients.get(t), { t: 'room', room: info }); }
function sendState(r) {
  if (!r.G) return;
  // A game with several hands (seatWatcher hook) may seat a watcher between hands: they stop watching then.
  if (r.spect.size) for (const seat of r.G.seats) if (seat.id && r.spect.delete(seat.id)) { r.sit.delete(seat.id); sendRoom(r); }
  if (r.G.ph === 'end' && !r.G.scored) scoreGame(r);
  const mod = GAMES[r.game];
  for (const t of r.players) {
    const c = clients.get(t); if (!c?.sock) continue;
    send(c, { t: 'state', s: mod.view(r.G, r.G.seats.findIndex(s => s.id === c.id)) });
  }
}

function leaveRoom(c) {
  const r = rooms.get(c.room); c.room = null;
  if (!r) return;
  r.players = r.players.filter(t => t !== c.token); r.again?.delete(c.id); r.spect.delete(c.id); r.sit.delete(c.id);
  if (!seatedOf(r).length) { r.spect.clear(); r.sit.clear(); } // only watchers left: they all play the next round
  if (r.G && r.G.ph === 'play') {
    GAMES[r.game].seatWatcher?.(r.G, { id: c.id }, false); // a watcher waiting for a seat changed their mind
    const s = r.G.seats.findIndex(x => x.id === c.id);
    if (s >= 0) { GAMES[r.game].setAway(r.G, s, true); r.G.seats[s].name += ' (bot)'; r.G.seats[s].human = false; r.G.seats[s].id = null; }
  }
  store.scheduleSave();
  if (!r.players.length) rooms.delete(r.code);
  else { if (r.host === c.id) r.host = clients.get(seatedOf(r)[0] || r.players[0]).id; if (!r.G) fillSeats(r); sendRoom(r); sendState(r); }
  broadcastRooms();
}

function joinRoom(c, r) {
  if (c.room === r.code) { sendRoom(r); sendState(r); return; }
  if (c.room) leaveRoom(c);
  const mod = GAMES[r.game];
  if (seatedOf(r).length >= mod.meta.maxPlayers && !r.G) return send(c, { t: 'err', msg: 'That table is full.' });
  if (r.players.length >= 12) return send(c, { t: 'err', msg: 'That table is full.' });
  r.players.push(c.token); c.room = r.code;
  if (r.G) r.spect.add(c.id); // a game is on: watch it, and take a seat next round if you like
  sendRoom(r); send(c, { t: 'chatlog', log: r.chat }); sendState(r); broadcastRooms();
}

function startGame(r) {
  r.again = new Set();
  // Everyone already at the table keeps their seat; watchers who asked for a seat fill what's left (bots get the rest).
  const id = t => clients.get(t)?.id, max = GAMES[r.game].meta.maxPlayers;
  const humans = [...seatedOf(r), ...r.players.filter(t => r.spect.has(id(t)) && r.sit.has(id(t)))].slice(0, max).map(t => clients.get(t));
  const inGame = new Set(humans.map(c => c.id));
  for (const t of r.players) {
    if (inGame.has(id(t))) { r.spect.delete(id(t)); r.sit.delete(id(t)); } else r.spect.add(id(t));
  }
  // Games that bet coins (Marble Rush) start every round from each player's account balance; bots keep their own.
  let prev = r.G || r.last || null;
  if (GAMES[r.game].meta.bank) {
    prev = { ...(prev?.game === r.game ? prev : { game: r.game }), wallet: { ...(prev?.game === r.game ? prev.wallet : {}) } };
    for (const c of humans) prev.wallet['h:' + c.id] = store.profileOf(c.token)?.coins || 0;
  }
  r.G = GAMES[r.game].create(humans.map(c => ({ id: c.id, name: c.name, color: c.color, av: c.av })), r.opts, prev);
  sendRoom(r); sendState(r); broadcastRooms();
}

function handle(c, m) {
  switch (m.t) {
    case 'profile': {
      const n = cleanName(m.name); if (n) c.name = n; c.color = cleanColor(m.color); c.av = store.allowedAv(store.profileOf(c.token), m.av);
      store.setLook(c.token, c);
      { const p = store.profileOf(c.token); if (p) send(c, { t: 'me', me: store.me(p) }); } // so every screen (Pet Farm too) wears the new look
      const r = rooms.get(c.room); if (r) { if (!r.G) sendRoom(r); }
      return;
    }
    case 'rooms': return send(c, { t: 'rooms', rooms: publicRooms() });
    case 'kofi': { // claim a Ko-fi payment with the email it was paid with
      if (blocked('kofic:' + (c.sock?.ip || '?'), 6, 10 * 60_000)) return send(c, { t: 'kofi', err: 'Too many tries. Wait a few minutes and try again.' });
      const r = store.kofiClaim(store.profileOf(c.token), m.email, KOFI_TOKEN);
      if (r.miss) note('kofic:' + (c.sock?.ip || '?'), 10 * 60_000);
      return send(c, r.err ? { t: 'kofi', err: r.err } : { t: 'kofi', ok: true });
    }
    case 'buy': { // the avatar shop
      const p = store.profileOf(c.token), r = store.buy(p, String(m.k ?? ''), m.i);
      if (r.err) return send(c, { t: 'err', msg: r.err });
      send(c, { t: 'bought', id: r.id, price: r.price });
      if (r.cos) { send(c, { t: 'me', me: store.me(p) }); const room = rooms.get(c.room); if (room) sendRoom(room); }
      return;
    }
    case 'pets': { const p = store.profileOf(c.token); return send(c, { t: 'pets', pets: p?.user ? farm.petsOf(p.pid) : [], farm: p?.user ? farm.brief(p.pid) : null, decor: p?.user ? farm.decorList(p.pid) : [] }); } // to pick a companion from
    case 'player': { // another player's profile card, by their public tag
      if (!allow('prof:' + c.id, 30, 60_000)) return;
      const o = store.byTag(m.pt); if (!o) return send(c, { t: 'err', msg: 'That player is not around any more.' });
      return send(c, { t: 'player', p: { ...store.publicProfile(o), pets: palsOf(o), online: clientsOf(o.pid).length > 0, me: o === store.profileOf(c.token), rel: store.relation(store.profileOf(c.token), o) } });
    }
    case 'wear': { // put on a name colour, frame, title or win effect, or pick the Pet Farm pets to show off
      const p = store.profileOf(c.token), pal = m.k === 'pet' || m.k === 'pets';
      const ids = pal ? (Array.isArray(m.i) ? m.i : m.i ? [m.i] : []).slice(0, 8).map(String) : null;
      if (pal && ids.some(id => !farm.petOf(p?.pid, id))) return send(c, { t: 'err', msg: 'That pet is not on your farm.' });
      const r = pal ? store.companion(p, ids) : m.k === 'ip' ? store.isleDecor(p, m.i) : m.k === 'fp' ? store.islePieces(p, m.i) : store.wear(p, String(m.k ?? ''), m.i);
      if (r.err) return send(c, { t: 'err', msg: r.err });
      send(c, { t: 'me', me: store.me(p) });
      const room = rooms.get(c.room); if (room) sendRoom(room);
      return;
    }
    case 'stats': return send(c, statsMsg());
    case 'where': c.view = WHERE.has(m.v) ? m.v : 'hub'; return; // which solo screen (Pet Farm, Hay Hunch) or the hub, for the host's list
    case 'who': { // the host's "Who's here" list: only accounts named in ADMINS get it
      if (!store.isAdmin(store.profileOf(c.token))) return;
      if (!allow('who:' + c.token, 30, 60_000)) return;
      return send(c, { t: 'who', list: whoList() });
    }
    case 'rankings': { // the hub's global leaderboards, one per minigame
      const g = String(m.game ?? ''), pid = store.profileOf(c.token)?.pid;
      if (g === 'farm') return send(c, { t: 'rankings', ...farm.ladder(pid) });
      if (g !== 'overall' && g !== 'hay' && !isGame(g)) return;
      return send(c, { t: 'rankings', ...store.leaderboard(g, pid) });
    }
    case 'create': {
      if (!isGame(m.game)) return; // an unknown game name used to leave a broken table that emptied everyone's table list
      if (!allow('create:' + c.token, 20, 60_000)) return send(c, { t: 'err', msg: 'Slow down a little: too many new tables.' });
      const r = { code: newCode(), game: m.game, host: c.id, priv: !!m.priv, players: [], spect: new Set(), sit: new Set(), G: null, chat: [], created: Date.now(),
        opts: GAMES[m.game].cleanOpts ? GAMES[m.game].cleanOpts(m.opts || {})
          : { bots: m.opts?.bots === 'sharp' ? 'sharp' : 'chill', timer: [0, 20, 30, 45, 60].includes(+m.opts?.timer) ? +m.opts.timer : 30 } };
      rooms.set(r.code, r); joinRoom(c, r);
      if (m.solo) startGame(r);
      return;
    }
    case 'join': {
      const key = 'join:' + (c.sock?.ip || c.token);
      if (blocked(key, 30, 10 * 60_000)) return send(c, { t: 'err', msg: 'Too many wrong codes. Wait a few minutes and try again.' });
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) { note(key, 10 * 60_000); return send(c, { t: 'err', msg: 'No table with that code. Check the letters?' }); } // so private tables can't be found by guessing
      return joinRoom(c, r);
    }
    case 'leave': if (c.room) leaveRoom(c); send(c, { t: 'room', room: null }); send(c, { t: 'rooms', rooms: publicRooms() }); return;
    case 'opts': {
      const r = rooms.get(c.room); if (!r || r.host !== c.id || r.G?.ph === 'play') return;
      const mod = GAMES[r.game];
      if (mod.cleanOpts) { if (m.opts && typeof m.opts === 'object') r.opts = mod.cleanOpts({ ...r.opts, ...m.opts }); }
      else if (m.opts?.bots) r.opts.bots = m.opts.bots === 'sharp' ? 'sharp' : 'chill';
      if (!mod.cleanOpts && m.opts?.timer !== undefined && [0, 20, 30, 45, 60].includes(+m.opts.timer)) r.opts.timer = +m.opts.timer;
      if (m.priv !== undefined) r.priv = !!m.priv;
      sendRoom(r); broadcastRooms(); return;
    }
    case 'start': {
      const r = rooms.get(c.room); if (!r || r.host !== c.id || r.G?.ph === 'play') return;
      return startGame(r);
    }
    case 'lobby': { // host sends everyone back to the waiting room
      const r = rooms.get(c.room); if (!r || r.host !== c.id || r.G?.ph === 'play') return;
      r.last = r.G; r.G = null; r.again = new Set(); fillSeats(r); for (const t of r.players) send(clients.get(t), { t: 'state', s: null });
      sendRoom(r); broadcastRooms(); return;
    }
    case 'again': { // vote to play another round (shown to the host on the results screen)
      const r = rooms.get(c.room); if (!r || r.G?.ph !== 'end' || r.spect.has(c.id)) return;
      r.again ||= new Set();
      if (m.on === false) r.again.delete(c.id); else r.again.add(c.id);
      return sendRoom(r);
    }
    case 'sit': { // a watcher wants a seat next round (or takes it back); in the waiting room it is immediate
      const r = rooms.get(c.room); if (!r) return;
      if (!r.spect.has(c.id)) return;
      if (m.on === false) r.sit.delete(c.id);
      else {
        r.sit.add(c.id); fillSeats(r);
        if (!r.G && r.spect.has(c.id)) send(c, { t: 'err', msg: 'Every seat is taken. You will get the next free one.' });
      }
      // Optional game hook for games made of several hands: seatWatcher(G, player, on) lets the game hand a bot's
      // seat to this watcher at its next hand (set seat.id/name/color/av, human: true, bot: false). Others wait for startGame.
      const mod = GAMES[r.game];
      if (r.G?.ph === 'play' && mod.seatWatcher) { mod.seatWatcher(r.G, { id: c.id, name: c.name, color: c.color, av: c.av }, m.on !== false); }
      sendRoom(r); broadcastRooms(); return;
    }
    case 'act': {
      const r = rooms.get(c.room); if (!r?.G) return;
      const s = r.G.seats.findIndex(x => x.id === c.id);
      if (GAMES[r.game].act(r.G, s, m.a)) sendState(r);
      return;
    }
    case 'chat': {
      const r = rooms.get(c.room); if (!r) return;
      const now = Date.now(); if (now - (c.lastChat || 0) < 500) return; c.lastChat = now;
      const text = String(m.text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160); if (!text) return;
      const msg = { t: 'chat', id: c.id, name: c.name, color: c.color, av: c.av, fl: store.flair(store.profileOf(c.token)), pt: store.tagOf(store.profileOf(c.token)), text };
      r.chat.push(msg); if (r.chat.length > 40) r.chat.shift();
      for (const t of r.players) send(clients.get(t), msg);
      return;
    }
    case 'hubchat': { // the hub's global chat: no text = send me the conversation
      const p = store.profileOf(c.token);
      if (m.text === undefined) return send(c, { t: 'hubchat', log: hubchat.history(p), max: hubchat.MAX_LEN });
      const r = hubchat.post(p, c, c.sock?.ip || '?', m.text);
      if (r.err) return send(c, { t: 'hubchat', err: r.err });
      if (r.msg) for (const o of clients.values()) if (o.sock && !o.room) send(o, { t: 'hubchat', msg: hubchat.forReader(r.msg, store.profileOf(o.token)?.pid, hubchat.isAdmin(store.profileOf(o.token))) });
      return;
    }
    case 'daily': { // Mystery Pet: the daily guess-the-pet puzzle (server/daily.js)
      const p = store.profileOf(c.token);
      if (m.test) daily.testHook(m.test, msg => send(c, msg));
      return daily.handle(p, m, msg => send(c, msg), (text, grid) => {
        const r = hubchat.post(p, c, c.sock?.ip || '?', text, grid);
        if (r.msg) for (const o of clients.values()) if (o.sock && !o.room) send(o, { t: 'hubchat', msg: hubchat.forReader(r.msg, store.profileOf(o.token)?.pid, hubchat.isAdmin(store.profileOf(o.token))) });
        return r.err || null;
      });
    }
    case 'hubdel': {
      const id = String(m.id ?? '');
      if (hubchat.remove(store.profileOf(c.token), id)) for (const o of clients.values()) if (o.sock && !o.room) send(o, { t: 'hubchat', gone: id });
      return;
    }
    case 'register': case 'login': case 'passwd': case 'recode': case 'recover': return auth(c, m);
    case 'lang': { // the language picked in the top bar: kept with the account so it follows the player to other devices
      const p = store.profileOf(c.token); if (!p?.user || !['en', 'pl'].includes(m.v)) return;
      if (p.lang !== m.v) { p.lang = m.v; store.scheduleSave(); }
      return;
    }
    case 'logout': {
      const p = store.logout(c.token, c); if (!p) return;
      c.av = store.allowedAv(p, c.av); store.setLook(c.token, c);
      send(c, { t: 'me', me: store.me(p) });
      const r = rooms.get(c.room); if (r) sendRoom(r);
      return;
    }
    case 'friends': return sendFriends(store.profileOf(c.token));
    case 'friend': { // add by username, accept, decline or remove
      const p = store.profileOf(c.token), tagged = m.pt ? store.byTag(m.pt) : null; // pt: picked from a profile card
      if (m.pt && !tagged) return send(c, { t: 'err', msg: 'That player is not around any more.' });
      const r = store.friendOp(p, m.op, m.user, tagged);
      if (r.err) return send(c, { t: 'err', msg: r.err });
      send(c, { t: 'friended', op: m.op, user: tagged ? r.other.name : r.other.user, now: r.now });
      sendFriends(p); sendFriends(r.other, m.op === 'add' || m.op === 'accept' ? { from: p.name, now: r.now } : null);
      return;
    }
    case 'hay': { // Hay Hunch: the solo puzzle, kept on the profile like Pet Farm (no table)
      if (!allow('hay:' + c.token, 120, 10_000)) return send(c, { t: 'hay', err: 'Slow down a little.' });
      const p = store.profileOf(c.token), r = hay.handle(p, m.a);
      const msg = { t: 'hay', ...r };
      for (const o of p?.user ? clientsOf(p.pid) : [c]) send(o, msg); // the same field on every screen of this account
      if (r.s?.over === 'clear' && m.a?.t === 'flip') for (const o of clientsOf(p.pid)) send(o, { t: 'me', me: store.me(p) });
      return;
    }
    case 'farm': { // Pet Farm: a persistent game with no table, so it is handled outside the rooms
      if (m.a?.test) farm.testHook(store.profileOf(c.token)?.pid, m.a.test);
      return farm.handle(store.profileOf(c.token), m.a, msg => send(c, msg));
    }
    case 'react': { // little food emote shown over your seat
      const r = rooms.get(c.room); if (!r) return;
      const now = Date.now(); if (now - (c.lastReact || 0) < 700) return; c.lastReact = now;
      const k = Math.max(0, m.k | 0); if (!store.mayReact(store.profileOf(c.token), k)) return; // stickers past the free twelve come in packs
      for (const t of r.players) send(clients.get(t), { t: 'react', id: c.id, k });
      return;
    }
  }
}

// ---------- accounts ----------
// Logins, password changes and recovery are limited per address and per username, so nobody can try password after
// password (or code after code). Only wrong tries count, so friends sharing a home connection are not slowed down.
const AUTH_WIN = 15 * 60_000, AUTH_MAX = { pw: [10, 20], rec: [6, 10] }; // wrong tries per 15 minutes: [per address, per username]
function auth(c, m) {
  const now = Date.now(), ip = c.sock?.ip || '?';
  c.tries = (c.tries || []).filter(x => now - x < 60_000);
  if (c.tries.length >= 6) return send(c, { t: 'auth', op: m.t, err: 'Too many tries. Wait a minute and try again.' });
  c.tries.push(now);
  const kind = m.t === 'recover' ? 'rec' : 'pw', [perIp, perUser] = AUTH_MAX[kind];
  const user = (m.t === 'login' || m.t === 'recover' ? String(m.user ?? '').trim() : store.profileOf(c.token)?.user || '').toLowerCase();
  const kIp = `${kind}:ip:${ip}`, kUser = `${kind}:u:${user}`;
  if (blocked(kIp, perIp, AUTH_WIN) || (user && blocked(kUser, perUser, AUTH_WIN)))
    return send(c, { t: 'auth', op: m.t, err: 'Too many wrong tries. Wait 15 minutes and try again.' });
  if (m.t === 'register' && blocked('reg:' + ip, 6, 3600_000)) return send(c, { t: 'auth', op: m.t, err: 'Lots of new accounts were made from here just now. Try again in an hour.' });
  const run = {
    register: () => store.register(c.token, m.user, m.pass),
    login: () => store.login(c.token, m.user, m.pass),
    passwd: () => store.changePassword(c.token, m.old, m.pass),
    recode: () => store.recoveryCode(c.token, m.pass),
    recover: () => store.recover(c.token, m.user, m.code, m.pass),
  }[m.t];
  run().then(r => {
    if (r.err) {
      if (m.t === 'login' || r.wrong) { note(kIp, AUTH_WIN); if (user) note(kUser, AUTH_WIN); }
      return send(c, { t: 'auth', op: m.t, err: r.err });
    }
    const p = r.p;
    if (m.t === 'register') { note('reg:' + ip, 3600_000); store.setLook(c.token, c); }
    if (m.t === 'login' || m.t === 'recover') { c.name = p.name; c.color = p.color; if (p.av) c.av = p.av; }
    for (const t of r.out || []) signedOut(t);
    send(c, { t: 'auth', ok: m.t, code: r.code }); send(c, { t: 'me', me: store.me(p) });
    const room = rooms.get(c.room); if (room) sendRoom(room);
  }, e => { console.error('auth error', e); send(c, { t: 'auth', op: m.t, err: 'Something went wrong. Try again.' }); });
}
// A browser that was signed in to an account whose password just changed: it is a guest again.
function signedOut(t) {
  const o = clients.get(t); if (!o) return;
  const p = store.profileOf(t); if (!p) return;
  o.av = store.allowedAv(p, o.av); store.setLook(t, o);
  send(o, { t: 'me', me: store.me(p) });
  send(o, { t: 'err', msg: 'The password of your account was changed, so this device was logged out. Log in again with the new password.' });
  const r = rooms.get(o.room); if (r) sendRoom(r);
}

attach(server, '/ws', sock => {
  let c = null, budget = 40, dropped = 0;
  const refill = setInterval(() => { budget = Math.min(40, budget + 20); dropped = Math.max(0, dropped - 20); }, 1000);
  const late = setTimeout(() => { if (!c) sock.close(1008); }, 15_000); // connected but never said hello
  sock.on('message', raw => {
    if (--budget < 0) { if (++dropped > 400) { console.warn(`ws: ${sock.ip} flooded messages, closing`); sock.close(1008); } return; } // ~20 s of flooding
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (!c) {
      if (m.t !== 'hello') return;
      try { hello(m); } catch (e) { console.error('hello error', e); }
      return;
    }
    c.lastSeen = Date.now();
    try { handle(c, m); if (m.t !== 'act' && m.t !== 'react' && m.t !== 'rooms') store.scheduleSave(); } catch (e) { console.error('handler error', e); }
  });
  function hello(m) {
    {
      let token = typeof m.token === 'string' && /^[a-z0-9]{16,40}$/.test(m.token) ? m.token : null;
      // A new browser makes a new guest profile. One address may make plenty (a party at someone's house), not thousands.
      if (!token || (!clients.has(token) && !store.sessions.has(token))) {
        if (!allow('new:' + sock.ip, 60, 3600_000)) { console.warn(`ws: ${sock.ip} made too many new guests, closing`); sock.close(1008); return; }
        token = token || crypto.randomBytes(12).toString('hex');
      }
      c = clients.get(token);
      if (c) { if (c.sock && c.sock !== sock) { console.log(`ws: ${c.id} opened a second connection (${sock.ip}), closing the older one (${c.sock.ip})`); c.sock.send({ t: 'replaced' }); c.sock.close(4000); } }
      else { c = { token, id: null, room: null }; clients.set(token, c); }
      if (c.sock !== sock) c.since = Date.now(); // when this visit started, for the host's list
      c.sock = sock; c.lastSeen = Date.now(); c.view = 'hub';
      c.name = cleanName(m.name) || c.name || 'Guest'; c.color = cleanColor(m.color); c.av = cleanAv(m.av);
      c.id = store.session(token, c).id; c.av = store.allowedAv(store.profileOf(token), c.av); store.setLook(token, c); store.scheduleSave();
      store.visit(token);
      send(c, { t: 'welcome', token, id: c.id, name: c.name });
      send(c, statsMsg()); broadcastStats();
      send(c, { t: 'me', me: store.me(store.profileOf(token)) });
      const r = rooms.get(c.room);
      if (r) {
        if (r.G) { const s = r.G.seats.findIndex(x => x.id === c.id); if (s >= 0 && GAMES[r.game].setAway(r.G, s, false)) {} }
        sendRoom(r); send(c, { t: 'chatlog', log: r.chat });
        if (r.G) sendState(r); else send(c, { t: 'state', s: null });
      } else { c.room = null; send(c, { t: 'rooms', rooms: publicRooms() }); }
    }
  }
  sock.on('close', () => {
    clearInterval(refill); clearTimeout(late);
    if (!c || c.sock !== sock) return;
    c.sock = null; c.lastSeen = Date.now(); broadcastStats();
    const r = rooms.get(c.room); if (r) sendRoom(r);
  });
});

// ---------- persistence ----------
// Lobbies come back after a restart with their scoreboard and chat. A game that was mid-play is lost:
// the table returns to its waiting room.
store.setRoomSource(() => [...rooms.values()].map(r => ({
  code: r.code, game: r.game, host: r.host, priv: r.priv, opts: r.opts, chat: r.chat, created: r.created,
  board: r.board || {}, played: r.played || 0, players: r.players,
  spect: [...r.spect], sit: [...r.sit],
})));
for (const d of store.load()) {
  if (!GAMES[d.game] || rooms.has(d.code)) continue;
  const players = (d.players || []).filter(t => store.sessions.has(t) && !clients.has(t));
  if (!players.length) continue;
  const r = { code: d.code, game: d.game, host: d.host, priv: !!d.priv, opts: d.opts || {}, chat: Array.isArray(d.chat) ? d.chat : [],
    created: d.created || Date.now(), board: d.board || {}, played: d.played || 0, players, G: null,
    spect: new Set(Array.isArray(d.spect) ? d.spect : []), sit: new Set(Array.isArray(d.sit) ? d.sit : []) };
  if (GAMES[r.game].cleanOpts) r.opts = GAMES[r.game].cleanOpts(r.opts);
  for (const t of players) {
    const s = store.sessions.get(t), p = store.profiles.get(s.pid);
    clients.set(t, { token: t, id: s.id, name: p.name, color: p.color, av: cleanAv(p.av), room: r.code, sock: null,
      lastSeen: Date.now() + RESTORE_GRACE_MS });
  }
  if (!players.some(t => clients.get(t).id === r.host)) r.host = clients.get(players[0]).id;
  if (!seatedOf(r).length) r.spect.clear();
  fillSeats(r);
  rooms.set(r.code, r);
}
farm.load();
store.notePodium();
hubchat.load();
daily.load();
const bye = () => { store.saveNow(); farm.saveNow(); hubchat.saveNow(); process.exit(0); };
process.on('SIGTERM', bye); process.on('SIGINT', bye);

// ---------- game loop & housekeeping ----------
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    try { if (r.G && GAMES[r.game].tick(r.G, now)) sendState(r); }
    catch (e) { console.error(`tick error in ${r.game} table ${r.code}`, e); } // one broken game must not stop every other table
    for (const t of [...r.players]) {
      const c = clients.get(t);
      if (c.sock) continue;
      const gone = now - c.lastSeen;
      if (r.G?.ph === 'play') {
        const s = r.G.seats.findIndex(x => x.id === c.id);
        if (s >= 0 && gone > AWAY_MS && GAMES[r.game].setAway(r.G, s, true)) sendState(r);
        if (gone > 10 * 60_000) leaveRoom(c);
      } else if (gone > LOBBY_DROP_MS) leaveRoom(c);
    }
    if (r.G?.ph === 'end' && now - r.G.endAt > END_IDLE_MS && r.players.every(t => !clients.get(t).sock)) {
      for (const t of r.players) clients.get(t).room = null;
      rooms.delete(r.code); broadcastRooms();
    }
  }
}, 150);

// Real-time games (Kart Island Race, Sky Bricks, Beanstalk Bounce) export fast(G, now): it runs twenty times a second and streams the race.
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    const mod = GAMES[r.game];
    try { if (r.G && mod.fast && mod.fast(r.G, now)) sendState(r); } catch (e) { console.error(`fast tick error in ${r.game} table ${r.code}`, e); }
  }
}, 50);

setInterval(() => { // heartbeat + forget long-gone clients
  const now = Date.now();
  for (const [t, c] of clients) {
    if (c.sock) { if (!c.sock.alive) { console.log(`ws: ${c.id} missed a heartbeat, closing`); c.sock.close(); continue; } c.sock.alive = false; c.sock.ping(); }
    else if (!c.room && now - c.lastSeen > 3600_000) clients.delete(t);
  }
}, 25_000);
setInterval(() => { // forget guest profiles that never played, once their browser has been gone an hour
  const n = store.prune(t => { const c = clients.get(t); return !!(c && (c.sock || c.room)); });
  if (n > 20) console.log(`forgot ${n} empty guest profiles`);
}, 10 * 60_000).unref();

geo.start();
server.listen(PORT, HOST, () => console.log(`Zatoka Gier running on http://${HOST}:${PORT}`));

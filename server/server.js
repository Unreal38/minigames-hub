// Zatoka Gier game server: static files + WebSocket lobbies. No dependencies.
// Profiles, optional accounts and lobby scoreboards are saved to disk by store.js.
import http from 'node:http';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cluster from 'node:cluster';
import os from 'node:os';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { attach, ipOf, trustHelpers } from './ws.js';
import { serveHelpers } from './links.js';
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
import * as piotr from './games/piotr.js';
import * as wojna from './games/wojna.js';
import * as bj from './games/bj.js';
import * as paw from './games/paw.js';
import * as kart from './games/kart.js';
import * as kitchen from './games/kitchen.js';
import * as dig from './games/dig.js';
import * as bricks from './games/bricks.js';
import * as lagoon from './games/lagoon.js';
import * as mahj from './games/mahj.js';
import * as bean from './games/bean.js';
import * as darts from './games/darts.js';
import * as ttt from './games/ttt.js';
import * as parade from './games/parade.js';
import * as makao from './games/makao.js';
import * as cove from './games/cove.js';
import * as domino from './games/domino.js';
import * as reef from './games/reef.js';
import * as chess from './games/chess.js';
import * as warcaby from './games/warcaby.js';
import * as pool from './games/pool.js';
import * as bierki from './games/bierki.js';
import * as bingo from './games/bingo.js';
import { seatChoices, seatKey, cleanSeats, tableSize } from './seats.js';
import * as bop from './games/bop.js';
import * as pm from './games/pm.js';
import * as tys from './games/tys.js';
import * as kal from './games/kal.js';
import * as lantern from './games/lantern.js';
import * as copy from './games/copy.js';
import * as runway from './games/runway.js';
import { cleanAv } from '../public/avatar.js';
import { withPlaces, fieldOf } from '../public/ranks.js';
import * as store from './store.js';
import * as farm from './farm.js';
import * as hay from './hay.js';
import * as pop from './pop.js';
import * as mj from './mj.js';
import * as hubchat from './hubchat.js';
import * as daily from './daily.js';
import * as word from './word.js';
import * as wheel from './wheel.js';
import * as notice from './notice.js';
import * as plaza from './plaza.js';
import * as modr from './mod.js';
import { cosHas, COS } from '../public/cosmetics.js';
import { dayOf } from './day.js';
import { isBot, pageFor } from './seo.js';
import { distinctCols, matchColors } from './colors.js';
import { botPay } from './botpay.js';
const FULL_BOT_PAY = process.env.BOT_PAY === 'full'; // tests only: the game tests check exact placement coins from quick bot matches, so each test's server gets BOT_PAY=full (test/persist.js checks the real share)

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const GAMES = { hotpot, marbles, ladders, poker, ludo, stack, golf, dice, paw, kart, kitchen, dig, bricks, lagoon, mahj, bean, tys, pan, pips, darts, piotr, ttt, bj, domino, parade, cove, pool, bingo, makao, bierki, pm, wojna, bop, chess, warcaby, kal, lantern, reef, copy, runway };
const GAME_IDS = new Set(Object.keys(GAMES)); // the Game wheel keeps only these
const isGame = id => typeof id === 'string' && Object.hasOwn(GAMES, id); // never 'constructor' and friends
const AWAY_MS = 30_000;       // a dropped player is botted after this
const LOBBY_DROP_MS = 15_000; // a dropped player leaves a waiting lobby after this
const END_IDLE_MS = 10 * 60_000;
const RESTORE_GRACE_MS = 90_000; // after a restart, players get this long to reconnect before their seat is freed

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

// Safety headers for every response. The page itself also gets a Content Security Policy: scripts may only come
// from this site and three.js's own folder on jsDelivr (not the rest of jsDelivr, which serves anyone's code), so even if someone sneaks markup into a name or chat line, the browser
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
  return [`default-src 'self'`, `script-src 'self' https://cdn.jsdelivr.net/npm/three@0.170.0/ ${inline.src}`, `style-src 'self' 'unsafe-inline'`,
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
// The privacy page (public/privacy.html) holds both languages; the host's contact and where the server stands come
// from the service settings (PRIVACY_CONTACT, SERVER_PLACE); without them the page's own text stays (a Ko-fi message).
const PRIVACY = path.join(ROOT, 'privacy.html');
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
function privacyPage(html, lang) {
  const contact = String(process.env.PRIVACY_CONTACT || '').trim(), place = String(process.env.SERVER_PLACE || '').trim();
  const mail = /^[^@\s<>"']+@[^@\s<>"']+$/.test(contact) ? `<a href="mailto:${esc(contact)}">${esc(contact)}</a>`
    : /^https:\/\/[^\s<>"']+$/.test(contact) ? `<a href="${esc(contact)}" rel="noopener">${esc(contact.replace(/^https:\/\//, ''))}</a>` : contact ? esc(contact) : '';
  return html.replace(/<html lang="[a-z]+"/, `<html lang="${lang}" data-geo="${lang}"`)
    .replace(/<!--contact:(\w+)-->[\s\S]*?<!--\/contact-->/g, (m, l) => mail || m.replace(/<!--\/?contact[^>]*-->/g, ''))
    .replace(/<!--place:(\w+)-->[\s\S]*?<!--\/place-->/g, (m, l) => place ? esc(place) : m.replace(/<!--\/?place[^>]*-->/g, ''));
}
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && KOFI_TOKEN && req.url.split('?')[0] === '/kofi') return kofiHook(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD', ...BASE_HEAD }).end(); return; }
  let url, p;
  try { url = new URL(req.url, 'http://x'); p = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400, BASE_HEAD).end(); return; } // a broken address like /%E0 used to crash the whole server
  if (url.pathname === '/health') { res.end('ok'); return; }
  if (p.includes('\0')) { res.writeHead(400, BASE_HEAD).end(); return; }
  if (p === '/privacy' || p === '/prywatnosc') p = '/privacy.html';
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    const ext = path.extname(file);
    // Always revalidate, so a browser never mixes old and new client files after a deploy.
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    // Fonts never change under the same name, so browsers keep them a month instead of asking again on every visit.
    const head = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.woff2' ? 'public, max-age=2592000' : 'no-cache', etag, ...BASE_HEAD };
    if (ext === '.html') head['content-security-policy'] = cspFor(req);
    if (req.headers['x-forwarded-proto'] === 'https') head['strict-transport-security'] = 'max-age=31536000'; // behind Caddy: browsers stick to HTTPS
    // The page carries the server's guess at the visitor's language (Poland: Polish), which i18n.js reads on a first visit.
    // Search and link-preview bots always get Polish, the site's main language (see seo.js).
    const lang = ext !== '.html' ? '' : isBot(req.headers['user-agent']) ? 'pl' : geo.langFor(ipOf(req), req.headers['accept-language']);
    if (lang) { head.etag = `"${etag.slice(1, -1)}-${lang}"`; head.vary = 'accept-language, user-agent'; head['cache-control'] = 'private, no-cache'; }
    if (lang && req.headers['if-none-match'] === head.etag) { res.writeHead(304, head).end(); return; }
    if (lang) {
      res.writeHead(200, head);
      if (req.method === 'HEAD') { res.end(); return; }
      fs.readFile(file, 'utf8', (e, html) => res.end(e ? '' : file === PRIVACY ? privacyPage(html, lang) : pageFor(html, lang)));
      return;
    }
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head).end(); return; }
    res.writeHead(200, head);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
});

// What the page's files look like right now. A screen that reconnects after a restart and sees another build reloads
// itself, so nobody plays with half old, half new files.
function buildId() {
  const h = crypto.createHash('sha256');
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f); else if (/\.(js|css|html|json|webmanifest)$/.test(e.name)) { const s = fs.statSync(f); h.update(`${f}:${s.size}:${s.mtimeMs}\n`); }
  } };
  try { walk(ROOT); } catch (e) { console.error('could not read the page files:', e.message); }
  return h.digest('hex').slice(0, 12);
}
const BUILD = buildId();

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
    state: r.G ? r.G.ph : 'lobby', opts: r.opts, max: GAMES[r.game].meta.maxPlayers, ...seatInfo(r),
    players: r.players.map(t => { const c = clients.get(t); return { id: c.id, name: c.name, color: c.color, av: c.av, online: !!c.sock, watch: r.spect.has(c.id), fl: store.flair(store.profileOf(t)), pt: store.tagOf(store.profileOf(t)), pet: palOf(store.profileOf(t)), ...store.badge(store.profileOf(t)) }; }),
    board: boardOf(r), played: r.played || 0, paid: r.G?.ph === 'end' && r.G.scored ? r.paid || null : null,
    again: againOf(r), sit: r.players.map(t => clients.get(t)?.id).filter(id => r.sit.has(id)),
  };
}
// Table size, as the waiting room, the open tables list and the game all count it (see seats.js): size seats in
// all, picked by the host from choices (one choice = fixed by the rules, none = no bots: whoever sits down).
function seatInfo(r) {
  const meta = GAMES[r.game].meta;
  return { size: tableSize(meta, r.opts, seatedOf(r).length), choices: seatChoices(meta), seatKey: seatKey(meta), bots: !meta.minHumans };
}
// The table settings a host sent, cleaned by the game, with the seats count every game understands.
function cleanTableOpts(game, o = {}) {
  const mod = GAMES[game], meta = mod.meta;
  const out = mod.cleanOpts ? mod.cleanOpts(o) : { bots: o.bots === 'sharp' ? 'sharp' : 'chill', timer: [0, 20, 30, 45, 60].includes(+o.timer) ? +o.timer : 30 };
  if (seatChoices(meta).length > 1) out[seatKey(meta)] = Math.max(+out[seatKey(meta)] || 0, cleanSeats(meta, o[seatKey(meta)]));
  return out;
}
// More people sat down than the host's seat count: the count grows with them, so the setting shows what is played.
function growSeats(r) {
  const meta = GAMES[r.game].meta, k = seatKey(meta);
  if (!seatChoices(meta).length || r.G?.ph === 'play') return;
  const n = tableSize(meta, r.opts, seatedOf(r).length);
  if (n > (+r.opts[k] || 0)) r.opts = cleanTableOpts(r.game, { ...r.opts, [k]: n });
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
  growSeats(r);
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
  // With bots at the table, XP and placement coins are paid as a share: weaker bots, fewer of them and a quicker match pay less (botpay.js).
  const ms = G.bornAt ? Date.now() - G.bornAt : Infinity, level = r.opts?.bots ?? G.opts?.bots;
  G.seats.forEach((seat, i) => {
    if (!seat.human || !seat.id) return;
    const c = r.players.map(t => clients.get(t)).find(x => x?.id === seat.id); if (!c) return;
    const p = store.profileOf(c.token); if (!p) return;
    const e = r.board[p.pid] ||= { pid: p.pid, name: c.name, color: c.color, av: c.av, games: 0, wins: 0, pts: 0 };
    Object.assign(e, { name: c.name, color: c.color, av: c.av, fl: store.flair(p), pt: store.tagOf(p) });
    e.games++; e.pts += Math.max(0, res[i].pts); if (res[i].win) e.wins++;
    delete e.coins; // older tables kept Marble Rush coins here; coins now live on the account
    const pay = FULL_BOT_PAY ? 1 : botPay(G.seats, i, { level, max: mod.meta.maxPlayers, ms });
    const gain = store.credit(p, r.game, { ...res[i], of, ranked, pay });
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
  return { code: i.code, game: i.game, gameName: i.gameName, state: i.state, n: i.players.filter(p => !p.watch).length, max: i.max, size: i.size, w: i.players.filter(p => p.watch).length,
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
// The Plaza (plaza.js) asks here how a player looks to the others and who may do what.
plaza.setup({
  info: c => { const p = store.profileOf(c.token); return { n: c.name, c: c.color, av: c.av, fl: store.flair(p), pt: store.tagOf(p), u: p?.user ? 1 : 0, pets: palsOf(p), ...store.badge(p) }; },
  isAdmin: c => store.isAdmin(store.profileOf(c.token)),
  pidOf: c => store.profileOf(c.token)?.pid || null,
  friends: c => store.profileOf(c.token)?.friends || [],
  mayReact: (c, k) => store.mayReact(store.profileOf(c.token), k),
  mayEmote: (c, e) => cosHas(store.profileOf(c.token), 'em', e),
  // a day's first visit counts towards the emotes earned by visiting; the player's own screen hears about a new one
  visit: c => { const p = store.profileOf(c.token), r = store.plazaVisit(p); if (r.fresh) send(c, { t: 'me', me: store.me(p) }); return r; },
  // a heart for a friend's pet: one Pet Farm friendship point a day for each friend
  patPal: (c, o) => { const a = store.profileOf(c.token), b = store.profileOf(o.token); return !!a?.user && !!b?.user && a !== b && store.areFriends(a.pid, b.pid) && farm.plazaPat(a.pid, b.pid); },
  // an open table people can still walk to: public, in its waiting room, with a free seat
  table: code => { const r = rooms.get(code); if (!r) return null; const free = GAMES[r.game].meta.maxPlayers - seatedOf(r).length; return { game: r.game, free, open: !r.priv && !r.G && free > 0 }; },
  // the daily present: once a day (Warsaw's midnight, like every daily thing), accounts only
  giftLeft: c => { const p = store.profileOf(c.token); return !!p?.user && p.plz?.gift !== dayOf(); },
  seenToday: c => store.profileOf(c.token)?.plz?.seen === dayOf(),
  giftTake: (c, n) => { const p = store.profileOf(c.token); if (!p?.user || p.plz?.gift === dayOf()) return 0; (p.plz ||= {}).gift = dayOf(); store.addCoins(p.pid, n); store.scheduleSave(); return n; },
});
store.onPack(pid => { const p = store.profiles.get(pid); if (p) for (const c of clientsOf(pid)) { send(c, { t: 'me', me: store.me(p) }); send(c, { t: 'pack', k: 'kofi' }); } });
// An account was deleted (by its owner from their profile card, or by the host's npm run delete-account): its farm,
// hub chat lines, table chat lines and table scoreboard rows go, ex-friends get a fresh friends list, and its screens
// become guests. A seat it holds in a game stays put, so the match carries on and that screen plays it out as a guest.
store.onForget((pid, toks, { tag, pals = [] } = {}) => {
  farm.forget(pid); plaza.forget(pid); modr.forget(pid);
  for (const id of hubchat.forget(pid)) for (const o of clients.values()) if (o.sock && !o.room) send(o, { t: 'hubchat', gone: id });
  for (const r of rooms.values()) {
    let changed = false;
    if (r.board && Object.hasOwn(r.board, pid)) { delete r.board[pid]; changed = true; }
    if (tag && r.chat.some(x => x.pt === tag)) { r.chat = r.chat.filter(x => x.pt !== tag); for (const t of r.players) send(clients.get(t), { t: 'chatlog', log: r.chat }); changed = true; }
    if (changed) sendRoom(r);
  }
  for (const x of pals) sendFriends(store.profiles.get(x));
  for (const t of toks) {
    const o = clients.get(t), p = store.profileOf(t); if (!o || !p) continue;
    o.av = store.allowedAv(p, o.av); store.setLook(t, o);
    send(o, { t: 'me', me: store.me(p) }); send(o, { t: 'friends', friends: [], reqs: [], sent: [] });
    send(o, { t: 'err', msg: 'This account was deleted, as asked. You are a guest now.' });
    const r = rooms.get(o.room); if (r) sendRoom(r);
  }
  broadcastRooms();
  for (const o of clients.values()) if (o.sock && !o.room) send(o, { t: 'rkstale' });
});
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
const WHERE = new Set(['hub', 'farm', 'hay', 'pop', 'mj', 'plaza']);
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
// ---------- reports and the hosts' moderation (server/mod.js) ----------
// '' = may talk; 'site' = a host's mute from the Admin panel; 'plaza' = a host's ten minutes of quiet on the Plaza.
const muted = c => modr.muteOf(store.profileOf(c.token)) ? 'site' : plaza.mutedFor(c) ? 'plaza' : '';
// Where a screen is, the way the hosts' lists show it (a private table's code too: only hosts read it).
function locOf(c) {
  const r = rooms.get(c?.room);
  return r ? { k: 'table', game: r.game, code: r.code, priv: !!r.priv, play: !!r.G && r.G.ph !== 'end', watch: r.spect.has(c.id) } : { k: c?.sock ? c.view || 'hub' : 'off' };
}
// What a player is under (mute, ban, an unread warning), and for hosts how many players have open reports.
function tellStanding(c) {
  const p = store.profileOf(c.token);
  modr.seenOn(p, c);
  send(c, modr.mine(p, c.token, c));
  if (store.isAdmin(p)) send(c, { t: 'mod', op: 'count', n: modr.openCount() });
}
function tellAdmins() {
  const msg = { t: 'mod', op: 'count', n: modr.openCount() };
  for (const c of clients.values()) if (c.sock && store.isAdmin(store.profileOf(c.token))) send(c, msg);
}
// The context a report carries, taken the moment it is sent: where both players are, the reported player's last hub
// chat lines and the talk around the newest one, and the chat of the table they share (or the one they are at).
function reportCtx(c, o) {
  const tag = store.tagOf(o), theirs = clientsOf(o.pid), atTable = theirs.find(x => rooms.has(x.room));
  let r = rooms.get(c.room);
  if (r && !theirs.some(x => x.room === r.code) && !r.chat.some(x => x.pt === tag)) r = null;
  r ||= rooms.get(atTable?.room);
  return {
    where: locOf(c), twhere: theirs.length ? locOf(atTable || theirs[0]) : { k: 'off' }, ...hubchat.contextOf(o.pid),
    table: r ? { game: r.game, code: r.code, lines: r.chat.slice(-20).map(x => ({ at: x.at || 0, name: x.name, text: x.text, ...(x.pt === tag ? { me: 1 } : {}) })) } : null,
  };
}
// After a host's action: the player's screens hear about it at once (a ban also takes them away from their table and
// the Plaza), and players whose reports it answered get a thank-you.
function applySanction(r) {
  const pid = r.p.pid;
  // (a device or address ban reaches other profiles too; lifting one may free any screen, so everyone hears again)
  const screens = [...clients.values()].filter(o => o.sock && (r.k === 'unban' || store.profileOf(o.token)?.pid === pid || store.sessions.peek(o.token)?.banPid === pid
    || r.k === 'ban' && modr.banOf(store.profileOf(o.token), o.token, o)?.pid === pid));
  for (const o of screens) {
    if (r.k === 'ban') { if (o.room) { leaveRoom(o); send(o, { t: 'room', room: null }); } plaza.leave(o); }
    tellStanding(o);
  }
  for (const rpid of r.rewarded || []) { const rp = store.profiles.get(rpid); for (const o of clientsOf(rpid)) { send(o, { t: 'me', me: store.me(rp) }); tellStanding(o); } }
  if (r.k !== 'dismiss' && r.k !== 'ban') { // (a ban's reporters got their thank-you above)
    const thanked = new Set();
    for (const x of r.closed) {
      if (!x.rpid || thanked.has(x.rpid)) continue; thanked.add(x.rpid);
      for (const o of clientsOf(x.rpid)) send(o, { t: 'mod', op: 'thanks', name: x.who.name });
    }
  }
  tellAdmins();
}
function modMsg(c, m) {
  const p = store.profileOf(c.token), op = String(m.op ?? '');
  if (op === 'seen') { modr.seen(p, String(m.id ?? '')); return tellStanding(c); }
  if (op === 'thanked') { modr.thanked(p, String(m.id ?? '')); return tellStanding(c); }
  if (op === 'report') {
    const o = store.byTag(m.pt);
    if (!allow('rep:' + (p?.pid || c.token), 8, 3600_000) || !allow('repip:' + (c.sock?.ip || '?'), 30, 3600_000))
      return send(c, { t: 'mod', op: 'report', err: 'You have sent a lot of reports. Try again later.' });
    const r = modr.report(p, o, m, o && o !== p ? reportCtx(c, o) : {});
    if (r.err) return send(c, { t: 'mod', op: 'report', err: r.err });
    console.log(`report: ${p.user || p.name} reported ${o.user || o.name} (${r.r.why})`);
    send(c, { t: 'mod', op: 'report', ok: true });
    return tellAdmins();
  }
  if (!store.isAdmin(p)) return;
  if (!allow('modq:' + p.pid, 90, 60_000)) return send(c, { t: 'err', msg: 'Slow down a little.' });
  if (op === 'list') return send(c, { t: 'mod', op: 'list', ...modr.list(), active: modr.active(), mins: { mute: modr.MUTE_MINS, ban: modr.BAN_MINS } });
  if (op === 'find') return send(c, { t: 'mod', op: 'find', q: String(m.q ?? '').slice(0, 20), rows: modr.find(m.q) });
  if (op === 'peek') return send(c, { t: 'mod', op: 'peek', p: modr.peek(m.pt), mins: { mute: modr.MUTE_MINS, ban: modr.BAN_MINS } });
  if (op === 'act') {
    const o = store.byTag(m.pt), on = o ? [...clients.values()].filter(x => x.sock && store.profileOf(x.token) === o) : [];
    const r = modr.act(p, { ...m, live: { devs: on.map(x => x.dev), ips: on.map(x => x.iph) } });
    if (r.err) return send(c, { t: 'err', msg: r.err });
    console.log(`moderation: ${p.user} ${r.k} ${r.p.user || r.p.name}${r.k === 'mute' || r.k === 'ban' ? (r.until ? ` until ${new Date(r.until).toISOString()}` : ' for good') : ''}`);
    applySanction(r);
    return send(c, { t: 'mod', op: 'done', k: r.k, pt: m.pt, name: r.p.name, until: r.until });
  }
}
// Live "playing now" + all-time visitor numbers for the hub. Batched so a burst of joins sends one update.
const statsMsg = () => ({ t: 'stats', online: [...clients.values()].filter(c => c.sock).length, visitors: store.visitorCount(), plaza: plaza.count() });
let statsTimer = null, lastStats = '';
function broadcastStats() {
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    const msg = statsMsg(), key = msg.online + '/' + msg.visitors + '/' + msg.plaza; if (key === lastStats) return; lastStats = key;
    const str = JSON.stringify(msg); for (const c of clients.values()) c.sock?.send(str);
  }, 1000);
}
// Site notices: everyone gets them on every screen (tables too); hosts also see the note waiting for the next restart.
const HOLD_MSG = 'An update is coming, so new games are on hold until it is done. Games already running carry on.';
const noticeFor = c => ({ t: 'notice', ...notice.view(store.isAdmin(store.profileOf(c.token))) });
notice.setOnChange(() => { for (const c of clients.values()) if (c.sock) send(c, noticeFor(c)); });
const lookKey = c => c.name + '|' + c.color + '|' + (c.av || []).join();
// A host trying on outfits saves every few taps; the hub's table list catches up at most once every two seconds.
let roomsT = 0;
function roomsSoon() { if (!roomsT) roomsT = setTimeout(() => { roomsT = 0; broadcastRooms(); }, 2000); }
// Every hub screen gets the open tables list when a table opens, fills, starts or closes. With a busy site that can be
// dozens of times a second, so changes are gathered for a moment and the list is built and turned into text once
// for everyone (it used to be rebuilt for each screen, which was the first thing to slow down under a crowd).
// The pause grows with the crowd (1 ms per hub screen, 0.15 to 2 s): a quiet site feels instant, and a full one sends
// each screen at most one list every two seconds instead of one per change. Only screens looking at the hub get it;
// Pet Farm and the solo games catch up when their player comes back to the hub (the 'where' message).
let roomsNowT = 0, roomsStr = null, roomsAt = 0, roomsVer = 0;
const onHub = c => c.sock && !c.room && (!c.view || c.view === 'hub');
function broadcastRooms() {
  roomsStr = null; roomsVer++;
  if (roomsNowT) return;
  let n = 0; for (const c of clients.values()) if (onHub(c)) n++;
  roomsNowT = setTimeout(broadcastRoomsNow, Math.max(150, Math.min(2000, n)));
}
function broadcastRoomsNow() {
  roomsNowT = 0;
  const str = roomsText(true);
  for (const c of clients.values()) if (onHub(c)) { c.sock.send(str); c.roomsVer = roomsVer; }
}
// The list as text, shared by everyone asking within half a second (a crowd arriving all asks at once).
function roomsText(fresh = false) {
  if (fresh || !roomsStr || Date.now() - roomsAt > 500) { roomsStr = JSON.stringify({ t: 'rooms', rooms: publicRooms() }); roomsAt = Date.now(); }
  return roomsStr;
}
function sendRoom(r) { const info = roomInfo(r); for (const t of r.players) send(clients.get(t), { t: 'room', room: info }); }
function sendState(r) {
  if (!r.G) return;
  // A game with several hands (seatWatcher hook) may seat a watcher between hands: they stop watching then.
  if (r.spect.size) for (const seat of r.G.seats) if (seat.id && r.spect.delete(seat.id)) { r.sit.delete(seat.id); sendRoom(r); }
  if (r.G.ph === 'end' && !r.G.scored) scoreGame(r);
  matchColors(r.G); // a player who joined mid-game may wear a colour someone already has
  const mod = GAMES[r.game];
  for (const t of r.players) {
    const c = clients.get(t); if (!c?.sock) continue;
    send(c, { t: 'state', s: mod.view(r.G, r.G.seats.findIndex(s => s.id === c.id)) });
  }
}

// A browser that went away (a page refresh, a closed tab, a lost connection) cannot still be holding anything: a game
// with a hand-held move in progress (Bierki's stick) exports letGo(G, seat) to end it as if the player had let go.
// The page that comes back starts with empty hands, so the server must not keep the old pull waiting for it.
function letGo(r, c) {
  const mod = GAMES[r.game];
  if (!r.G || !mod.letGo) return false;
  const s = r.G.seats.findIndex(x => x.id === c.id);
  return s >= 0 && mod.letGo(r.G, s);
}

function leaveRoom(c) {
  const r = rooms.get(c.room); c.room = null;
  if (!r) return;
  r.players = r.players.filter(t => t !== c.token); r.again?.delete(c.id); r.spect.delete(c.id); r.sit.delete(c.id);
  if (!seatedOf(r).length) { r.spect.clear(); r.sit.clear(); } // only watchers left: they all play the next round
  if (r.G && r.G.ph === 'play') {
    GAMES[r.game].seatWatcher?.(r.G, { id: c.id }, false); // a watcher waiting for a seat changed their mind
    const s = r.G.seats.findIndex(x => x.id === c.id);
    if (s >= 0) {
      const seat = r.G.seats[s], pid = store.profileOf(c.token)?.pid;
      GAMES[r.game].setAway(r.G, s, true);
      if (pid) (r.leftBy ||= new Map()).set(s, { pid, name: seat.name }); // so they get this seat back if they return
      seat.name += ' (bot)'; seat.human = false; seat.id = null; seat.left = true;
    }
  }
  store.scheduleSave();
  if (!r.players.length) rooms.delete(r.code);
  else { if (r.host === c.id) r.host = clients.get(seatedOf(r)[0] || r.players[0]).id; if (!r.G) fillSeats(r); sendRoom(r); sendState(r); }
  broadcastRooms();
}

function joinRoom(c, r) {
  if (c.room === r.code) { sendRoom(r); sendState(r); return; }
  if (c.room) leaveRoom(c);
  if (plaza.leave(c)) broadcastStats();
  const mod = GAMES[r.game];
  if (seatedOf(r).length >= mod.meta.maxPlayers && !r.G) return send(c, { t: 'err', msg: 'That table is full.' });
  if (r.players.length >= 12) return send(c, { t: 'err', msg: 'That table is full.' });
  r.players.push(c.token); c.room = r.code;
  if (r.G && !reclaimSeat(r, c)) r.spect.add(c.id); // a game is on: watch it, and take a seat next round if you like
  if (!r.G) growSeats(r);
  sendRoom(r); send(c, { t: 'chatlog', log: r.chat }); sendState(r); broadcastRooms();
}

// Someone coming back to a game they were playing (after Leave, or from another device or browser on the same
// account) gets their own seat back instead of watching while a bot, or another watcher, plays it.
function reclaimSeat(r, c) {
  const G = r.G, mod = GAMES[r.game], pid = store.profileOf(c.token)?.pid;
  if (G?.ph !== 'play' || !pid) return false;
  const pidOfId = id => { const o = r.players.map(t => clients.get(t)).find(x => x?.id === id); return o && o !== c ? [o, store.profileOf(o.token)?.pid] : [null, null]; };
  for (let s = 0; s < G.seats.length; s++) {
    const seat = G.seats[s], gone = r.leftBy?.get(s);
    let old = null;
    if (seat.human && seat.id && seat.id !== c.id) { const [o, opid] = pidOfId(seat.id); if (opid !== pid) continue; old = o; } // same account, other device
    else if (!(!seat.human && seat.left && gone?.pid === pid)) continue; // their seat, still played by a bot
    if (mod.canReturn && !mod.canReturn(G, s)) continue; // say, a poker seat that is already out of chips: watch and queue instead
    if (old) { // the other device leaves the table quietly: the seat moves, it is not handed to a bot
      if (r.host === old.id) r.host = c.id;
      r.players = r.players.filter(t => t !== old.token); old.room = null; r.spect.delete(old.id); r.sit.delete(old.id); r.again?.delete(old.id);
      if (old.sock) { send(old, { t: 'room', room: null }); old.sock.send(roomsText()); }
    } else { seat.name = gone.name; r.leftBy.delete(s); }
    mod.seatWatcher?.(G, { id: c.id }, false);
    Object.assign(seat, { id: c.id, human: true, left: false });
    mod.setAway(G, s, false);
    return true;
  }
  return false;
}

function startGame(r) {
  r.leftBy = null;
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
  const cols = distinctCols(humans.map(c => c.color)); // two people in pink: the later one plays in another colour this match
  const emOf = c => { const p = store.profileOf(c.token); return COS.em.items.map((_, i) => i).filter(i => i && cosHas(p, 'em', i)); }; // the Plaza emotes each one has (Sky Runway poses)
  r.G = GAMES[r.game].create(humans.map((c, i) => ({ id: c.id, name: c.name, color: cols[i], av: c.av, ...(GAMES[r.game].meta.emotes ? { em: emOf(c) } : {}) })), r.opts, prev);
  matchColors(r.G); // bots, too, keep clear of the people's colours
  r.G.bornAt = Date.now(); // when the match began: a short match against bots pays its share (botpay.js)
  sendRoom(r); sendState(r); broadcastRooms();
}

// While a host's ban is on, a screen gets nothing but the ban notice (and may still pick a language).
const BAN_OK = new Set(['lang', 'where', 'stats', 'notice']);
function handle(c, m) {
  if (!BAN_OK.has(m.t) && modr.banOf(store.profileOf(c.token), c.token, c)) { if (allow('banned:' + c.token, 1, 3000)) send(c, modr.mine(store.profileOf(c.token), c.token, c)); return; }
  switch (m.t) {
    case 'profile': {
      const was = lookKey(c);
      const n = cleanName(m.name); if (n) c.name = n; c.color = cleanColor(m.color); c.av = store.allowedAv(store.profileOf(c.token), m.av);
      const same = lookKey(c) === was;
      if (!same) store.setLook(c.token, c);
      { const p = store.profileOf(c.token); if (p) send(c, { t: 'me', me: store.me(p) }); } // so every screen (Pet Farm too) wears the new look
      if (same) return; // nothing new: the table and the hub need no update
      plaza.refresh(c);
      const r = rooms.get(c.room);
      if (r && !r.G) sendRoom(r);
      if (r && !r.priv && r.host === c.id) roomsSoon(); // the hub's open table shows the host's avatar
      return;
    }
    case 'rooms': return c.sock?.send(roomsText());
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
      return send(c, { t: 'player', p: { ...store.publicProfile(o), pets: palsOf(o), online: clientsOf(o.pid).length > 0, me: o === store.profileOf(c.token), rel: store.relation(store.profileOf(c.token), o), ...(store.isAdmin(store.profileOf(c.token)) && o !== store.profileOf(c.token) ? { mod: !store.isAdmin(o) } : {}) } });
    }
    case 'sky': { // constellations: light a point with a free star, or pick the finished one to show in the level chip
      const p = store.profileOf(c.token), r = store.setSky(p, { light: m.light, shown: m.shown });
      if (r.err) return send(c, { t: 'err', msg: r.err });
      send(c, { t: 'me', me: store.me(p) });
      const room = rooms.get(c.room); if (room) sendRoom(room); plaza.refresh(c);
      return;
    }
    case 'wear': { // put on a name colour, frame, title or win effect, or pick the Pet Farm pets to show off
      const p = store.profileOf(c.token), pal = m.k === 'pet' || m.k === 'pets';
      // Pets that left the farm since they were picked (sold, released, traded) are quietly dropped, so they can't
      // sit in a slot nobody can see. Only an all-new pick that isn't theirs is an error. Lodge pets count as theirs.
      const asked = pal ? (Array.isArray(m.i) ? m.i : m.i ? [m.i] : []).slice(0, 8).map(String) : null;
      const ids = pal ? asked.filter(id => farm.petOf(p?.pid, id)) : null;
      if (pal && asked.some(id => !ids.includes(id) && !store.showPets(p).includes(id))) { send(c, { t: 'me', me: store.me(p) }); return send(c, { t: 'err', msg: 'That pet is not on your farm.' }); }
      const r = pal ? store.companion(p, ids) : m.k === 'ip' ? store.isleDecor(p, m.i) : m.k === 'fp' ? store.islePieces(p, m.i) : m.k === 'eb' ? store.emoteBar(p, m.i) : store.wear(p, String(m.k ?? ''), m.i);
      if (r.err) return send(c, { t: 'err', msg: r.err });
      send(c, { t: 'me', me: store.me(p) });
      const room = rooms.get(c.room); if (room) sendRoom(room); plaza.refresh(c);
      return;
    }
    case 'fits': { // the Wardrobe's saved outfits, sent whole after every change
      if (!allow('fits:' + c.id, 40, 60_000)) return;
      const p = store.profileOf(c.token), r = store.setOutfits(p, m.l);
      if (r.err) { send(c, { t: 'err', msg: r.err }); }
      return send(c, { t: 'me', me: store.me(p) });
    }
    case 'gwheel': { // the hub's Game wheel: what is on it and the saved wheels (it pays nothing)
      if (!allow('gwheel:' + c.id, 60, 60_000)) return;
      const p = store.profileOf(c.token);
      store.setGameWheel(p, m.v, GAME_IDS); // no answer: the page already shows what it sent
      return;
    }
    case 'stats': return send(c, statsMsg());
    case 'notice': { // the hosts' Site notices window: maintenance countdown, announcement, "What's new"
      const p = store.profileOf(c.token);
      if (!m.op && !m.test) return allow('noticeq:' + c.token, 30, 60_000) && send(c, noticeFor(c)); // just asking (say, after logging in)
      if (!store.isAdmin(p)) return;
      if (m.test) return notice.testHook(m.test);
      if (!allow('notice:' + p.pid, 20, 60_000)) return send(c, { t: 'err', msg: 'Slow down a little.' });
      const r = notice.handle(m, p.user);
      if (r.err) return send(c, { t: 'err', msg: r.err });
      return;
    }
    case 'where': {
      const was = c.view; c.view = WHERE.has(m.v) ? m.v : 'hub';
      if (c.view !== 'plaza' && plaza.leave(c)) broadcastStats(); // walked out of the plaza
      if (c.view === 'hub' && was !== 'hub' && !c.room && c.roomsVer !== roomsVer) { c.sock?.send(roomsText()); c.roomsVer = roomsVer; } // back from Pet Farm or a solo game: catch up on the table list
      return;
    } // which solo screen (Pet Farm, Hay Hunch) or the hub, for the host's list
    case 'mod': return modMsg(c, m); // reports from players; the hosts' Reports tab (server/mod.js)
    case 'who': { // the host's "Who's here" list: only accounts named in ADMINS get it
      if (!store.isAdmin(store.profileOf(c.token))) return;
      if (!allow('who:' + c.token, 30, 60_000)) return;
      return send(c, { t: 'who', list: whoList() });
    }
    case 'rankings': { // the hub's global leaderboards, one per minigame
      const g = String(m.game ?? ''), pid = store.profileOf(c.token)?.pid;
      if (g === 'farm') return send(c, { t: 'rankings', ...farm.ladder(pid) });
      if (g !== 'overall' && g !== 'hay' && g !== 'pop' && g !== 'mj' && !isGame(g)) return;
      return send(c, { t: 'rankings', ...store.leaderboard(g, pid) });
    }
    case 'create': {
      if (!isGame(m.game)) return; // an unknown game name used to leave a broken table that emptied everyone's table list
      if (!allow('create:' + c.token, 20, 60_000)) return send(c, { t: 'err', msg: 'Slow down a little: too many new tables.' });
      if (notice.holding()) return send(c, { t: 'err', msg: HOLD_MSG });
      const r = { code: newCode(), game: m.game, host: c.id, priv: !!m.priv, players: [], spect: new Set(), sit: new Set(), G: null, chat: [], created: Date.now(),
        opts: cleanTableOpts(m.game, m.opts || {}) };
      rooms.set(r.code, r); if (!r.priv) plaza.sign(c, r.code); // opened from the plaza: a signpost stays behind for the others
      joinRoom(c, r);
      if (m.solo && !(GAMES[m.game].meta.minHumans > 1)) startGame(r);
      return;
    }
    case 'join': {
      const key = 'join:' + (c.sock?.ip || c.token);
      if (blocked(key, 30, 10 * 60_000)) return send(c, { t: 'err', msg: 'Too many wrong codes. Wait a few minutes and try again.' });
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) { note(key, 10 * 60_000); return send(c, { t: 'err', msg: 'No table with that code. Check the letters?' }); } // so private tables can't be found by guessing
      return joinRoom(c, r);
    }
    case 'leave': if (c.room) leaveRoom(c); send(c, { t: 'room', room: null }); c.sock?.send(roomsText()); return;
    case 'opts': {
      const r = rooms.get(c.room); if (!r || r.host !== c.id || r.G?.ph === 'play') return;
      const mod = GAMES[r.game];
      if (m.opts && typeof m.opts === 'object') {
        const k = seatKey(mod.meta), want = m.opts[k];
        r.opts = cleanTableOpts(r.game, { ...r.opts, ...m.opts });
        // fewer seats than people already sitting down can't be picked: the count stays at what fits them all
        if (want !== undefined && seatChoices(mod.meta).length) r.opts[k] = tableSize(mod.meta, r.opts, seatedOf(r).length);
      }
      if (m.priv !== undefined) r.priv = !!m.priv;
      sendRoom(r); broadcastRooms(); return;
    }
    case 'start': {
      const r = rooms.get(c.room); if (!r || r.host !== c.id || r.G?.ph === 'play') return;
      if (notice.holding()) return send(c, { t: 'err', msg: HOLD_MSG });
      // a game without bots (Państwa-miasta) needs enough people in seats, counting watchers who asked for one
      const need = GAMES[r.game].meta.minHumans || 0;
      if (need && seatedOf(r).length + r.players.filter(t => r.spect.has(clients.get(t)?.id) && r.sit.has(clients.get(t)?.id)).length < need) return send(c, { t: 'err', msg: need === 2 ? 'This game needs at least two players. Invite a friend first.' : `This game needs at least ${need} players. Invite more friends first.` });
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
      let text = String(m.text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160); if (!text) return;
      if (r.G && GAMES[r.game].hush) text = GAMES[r.game].hush(r.G, text); // a game with a secret word keeps it out of the chat
      // A game with secrets (Lantern Night) may close the chat for a seat (chatOk) and decide who reads a line (chatSee:
      // players who are out talk only among themselves). Lines not everyone may read stay out of the saved log.
      const mod = GAMES[r.game], live = r.G?.ph === 'play', seatOf = id => r.G.seats.findIndex(x => x.id === id), from = live ? seatOf(c.id) : -1;
      if (live && mod.chatOk && !mod.chatOk(r.G, from)) return send(c, { t: 'err', msg: mod.chatShut?.(r.G, from) || 'The chat is closed right now.' });
      if (muted(c)) return send(c, { t: 'err', msg: 'A host has muted you.' });
      const msg = { t: 'chat', at: now, id: c.id, name: c.name, color: c.color, av: c.av, fl: store.flair(store.profileOf(c.token)), pt: store.tagOf(store.profileOf(c.token)), text };
      const to = r.players.map(t => clients.get(t)).filter(o => o && (!live || !mod.chatSee || mod.chatSee(r.G, from, seatOf(o.id))));
      if (to.length === r.players.length) { r.chat.push(msg); if (r.chat.length > 40) r.chat.shift(); }
      for (const o of to) send(o, msg);
      return;
    }
    case 'hubchat': { // the hub's global chat: no text = send me the conversation
      const p = store.profileOf(c.token);
      if (m.text === undefined) return send(c, { t: 'hubchat', log: hubchat.history(p), max: hubchat.MAX_LEN });
      if (muted(c)) return send(c, { t: 'hubchat', err: muted(c) === 'site' ? 'A host has muted you.' : 'A host has muted you for a few minutes.' });
      const r = hubchat.post(p, c, c.sock?.ip || '?', m.text);
      if (r.err) return send(c, { t: 'hubchat', err: r.err });
      if (r.msg) { // most readers get the same line, turned into text once; the writer and the moderators get their own
        const plain = JSON.stringify({ t: 'hubchat', msg: hubchat.forReader(r.msg, null, false) });
        for (const o of clients.values()) {
          if (!o.sock || o.room) continue;
          const op = store.profileOf(o.token), admin = hubchat.isAdmin(op);
          if (admin || op?.pid === p.pid) send(o, { t: 'hubchat', msg: hubchat.forReader(r.msg, op?.pid, admin) }); else o.sock.send(plain);
        }
      }
      return;
    }
    case 'wheel': { // Lucky Wheel: one free spin a day (server/wheel.js)
      if (!allow('wheel:' + c.token, 30, 10_000)) return;
      const p = store.profileOf(c.token);
      if (m.test) wheel.testHook(p, m.test);
      return wheel.handle(p, m, msg => { send(c, msg); if (msg.won && p) send(c, { t: 'me', me: store.me(p) }); });
    }
    case 'daily': { // Mystery Pet: the daily guess-the-pet puzzle (server/daily.js)
      const p = store.profileOf(c.token);
      if (m.test) daily.testHook(m.test, msg => send(c, msg));
      return daily.handle(p, m, msg => send(c, msg), (text, grid) => {
        const r = hubchat.post(p, c, c.sock?.ip || '?', text, grid);
        if (r.msg) { // most readers get the same line, turned into text once; the writer and the moderators get their own
        const plain = JSON.stringify({ t: 'hubchat', msg: hubchat.forReader(r.msg, null, false) });
        for (const o of clients.values()) {
          if (!o.sock || o.room) continue;
          const op = store.profileOf(o.token), admin = hubchat.isAdmin(op);
          if (admin || op?.pid === p.pid) send(o, { t: 'hubchat', msg: hubchat.forReader(r.msg, op?.pid, admin) }); else o.sock.send(plain);
        }
      }
        return r.err || null;
      });
    }
    case 'word': { // Word in a Bottle: the daily word puzzle (server/word.js)
      if (!allow('word:' + c.token, 40, 10_000)) return;
      const p = store.profileOf(c.token);
      if (m.test) word.testHook(m.test, msg => send(c, msg));
      return word.handle(p, m, msg => send(c, msg), (text, grid) => {
        const r = hubchat.post(p, c, c.sock?.ip || '?', text, grid);
        if (r.msg) { // most readers get the same line, turned into text once; the writer and the moderators get their own
        const plain = JSON.stringify({ t: 'hubchat', msg: hubchat.forReader(r.msg, null, false) });
        for (const o of clients.values()) {
          if (!o.sock || o.room) continue;
          const op = store.profileOf(o.token), admin = hubchat.isAdmin(op);
          if (admin || op?.pid === p.pid) send(o, { t: 'hubchat', msg: hubchat.forReader(r.msg, op?.pid, admin) }); else o.sock.send(plain);
        }
      }
        return r.err || null;
      });
    }
    case 'hubdel': {
      const id = String(m.id ?? '');
      if (hubchat.remove(store.profileOf(c.token), id)) for (const o of clients.values()) if (o.sock && !o.room) send(o, { t: 'hubchat', gone: id });
      return;
    }
    case 'register': case 'login': case 'passwd': case 'recode': case 'recover': case 'delacct': return auth(c, m);
    case 'lang': { // the language picked in the top bar: kept with the account so it follows the player to other devices
      const p = store.profileOf(c.token); if (!p?.user || !['en', 'pl'].includes(m.v)) return;
      if (p.lang !== m.v) { p.lang = m.v; store.scheduleSave(); }
      return;
    }
    case 'logout': {
      const p = store.logout(c.token, c); if (!p) return;
      c.av = store.allowedAv(p, c.av); store.setLook(c.token, c);
      send(c, { t: 'me', me: store.me(p) }); tellStanding(c);
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
    case 'tinvite': { // invite a friend who is on the site right now to the table you are at (from the waiting room)
      const p = store.profileOf(c.token), r = rooms.get(c.room); if (!r) return;
      if (!p?.user) return send(c, { t: 'err', msg: 'Create an account to invite friends.' });
      const o = store.byTag(m.pt);
      if (!o || o === p || !store.areFriends(p.pid, o.pid)) return send(c, { t: 'err', msg: 'You can only invite your friends.' });
      const to = clientsOf(o.pid).filter(x => x.room !== r.code);
      if (!clientsOf(o.pid).length) return send(c, { t: 'err', msg: 'That friend is not on the site right now.' });
      if (!to.length) return send(c, { t: 'tinvited', pt: m.pt, here: true });
      if (!allow('tinv:' + c.token, 20, 60_000)) return send(c, { t: 'err', msg: 'Slow down a little.' });
      if (!allow(`tinv:${p.pid}:${o.pid}:${r.code}`, 1, 20_000)) return send(c, { t: 'err', msg: 'You just invited them. Give them a moment to answer.' });
      const inv = { t: 'tinvite', from: p.name, pt: store.tagOf(p), color: p.color, av: p.av, fl: store.flair(p), game: r.game, code: r.code };
      for (const x of to) send(x, inv);
      return send(c, { t: 'tinvited', pt: m.pt });
    }
    case 'hay': { // Hay Hunch: the solo puzzle, kept on the profile like Pet Farm (no table)
      if (!allow('hay:' + c.token, 120, 10_000)) return send(c, { t: 'hay', err: 'Slow down a little.' });
      const p = store.profileOf(c.token), r = hay.handle(p, m.a);
      const msg = { t: 'hay', ...r };
      for (const o of p?.user ? clientsOf(p.pid) : [c]) send(o, msg); // the same field on every screen of this account
      if (r.s?.over === 'clear' && m.a?.t === 'flip') for (const o of clientsOf(p.pid)) send(o, { t: 'me', me: store.me(p) });
      return;
    }
    case 'pop': { // Pet Pop: the solo match puzzle, kept on the profile like Hay Hunch (no table)
      if (!allow('pop:' + c.token, 120, 10_000)) return send(c, { t: 'pop', err: 'Slow down a little.' });
      const p = store.profileOf(c.token), r = pop.handle(p, m.a);
      const msg = { t: 'pop', ...r };
      for (const o of p?.user ? clientsOf(p.pid) : [c]) send(o, msg); // the same shelf on every screen of this account
      if (r.s?.over && r.steps) for (const o of clientsOf(p.pid)) send(o, { t: 'me', me: store.me(p) });
      return;
    }
    case 'mj': { // Pet Mahjong (solo): the tile matching puzzle, kept on the profile like Pet Pop (no table)
      if (!allow('mj:' + c.token, 160, 10_000)) return send(c, { t: 'mj', err: 'Slow down a little.' });
      const p = store.profileOf(c.token), r = mj.handle(p, m.a);
      const msg = { t: 'mj', ...r };
      for (const o of p?.user ? clientsOf(p.pid) : [c]) send(o, msg); // the same board on every screen of this account
      if (r.s?.over && (r.took || r.lost)) for (const o of clientsOf(p.pid)) send(o, { t: 'me', me: store.me(p) });
      return;
    }
    case 'farm': { // Pet Farm: a persistent game with no table, so it is handled outside the rooms
      if (m.a?.test) farm.testHook(store.profileOf(c.token)?.pid, m.a.test);
      return farm.handle(store.profileOf(c.token), m.a, msg => send(c, msg));
    }
    case 'plaza': { // the 3D hangout (plaza.js): only for people who are not at a table
      if (c.room) return;
      const was = plaza.count();
      if (m.a?.k === 'join') c.view = 'plaza';
      plaza.handle(c, m.a);
      if (plaza.count() !== was) broadcastStats();
      return;
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
  if (m.t === 'delacct' && blocked('del:' + ip, 3, 3600_000)) return send(c, { t: 'auth', op: m.t, err: 'Several accounts were deleted from here just now. Try again in an hour.' });
  if (m.t === 'register' && blocked('reg:' + ip, 6, 3600_000)) return send(c, { t: 'auth', op: m.t, err: 'Lots of new accounts were made from here just now. Try again in an hour.' });
  const run = {
    register: () => store.register(c.token, m.user, m.pass),
    login: () => store.login(c.token, m.user, m.pass),
    passwd: () => store.changePassword(c.token, m.old, m.pass),
    recode: () => store.recoveryCode(c.token, m.pass),
    recover: () => store.recover(c.token, m.user, m.code, m.pass),
    delacct: () => store.deleteSelf(c.token, m.pass, m.user),
  }[m.t];
  run().then(r => {
    if (r.err) {
      if (m.t === 'login' || r.wrong) { note(kIp, AUTH_WIN); if (user) note(kUser, AUTH_WIN); }
      return send(c, { t: 'auth', op: m.t, err: r.err });
    }
    const p = r.p;
    if (m.t === 'register') { note('reg:' + ip, 3600_000); store.setLook(c.token, c); }
    if (m.t === 'delacct') { note('del:' + ip, 3600_000); console.log(`account ${r.user} deleted by its owner (${(r.out || []).length + 1} screens signed out)`); return send(c, { t: 'auth', ok: m.t }); }
    if (m.t === 'login' || m.t === 'recover') { c.name = p.name; c.color = p.color; if (p.av) c.av = p.av; }
    for (const t of r.out || []) signedOut(t);
    send(c, { t: 'auth', ok: m.t, code: r.code }); send(c, { t: 'me', me: store.me(p) }); tellStanding(c);
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

// ---------- waiting line ----------
// Past MAX_ONLINE screens at once (a big stream sends everyone at the same minute) newcomers wait in a line instead of
// slowing the site down for everyone already playing. They see their place and get in by themselves, first come
// first served, as screens close. People at a table, people who dropped out a few minutes ago (a reload, a flaky
// network) and hosts (ADMINS) always get straight in. Someone only counts as a visitor once they are in.
// One server core carries about 3,000-4,000 people (README, "How many people it can take").
const MAX_ONLINE = +process.env.MAX_ONLINE || 3000;
const line = [];            // waiting sockets, first come first served: { sock, go }
let liveN = 0, letIn = 0;   // screens online at the last count, and let in since
const countLive = () => { let n = 0; for (const c of clients.values()) if (c.sock) n++; return n; };
function mustWait(token) {
  if (!line.length && liveN + letIn < MAX_ONLINE) return false;
  const c = token && clients.get(token);
  if (c && (c.room || c.sock || Date.now() - c.lastSeen < 5 * 60_000)) return false;
  return !store.isAdmin(token && store.profileOf(token));
}
let lineTick = 0, lineLog = 0;
setInterval(() => {
  liveN = countLive(); letIn = 0;
  for (let i = line.length - 1; i >= 0; i--) if (!line[i].sock.open) line.splice(i, 1);
  for (let free = MAX_ONLINE - liveN; free > 0 && line.length; free--) line.shift().go();
  if (++lineTick % 3 === 0 && line.length) line.forEach((q, i) => q.sock.send({ t: 'queue', pos: i + 1, n: line.length }));
  if (line.length && Date.now() - lineLog > 60_000) { lineLog = Date.now(); console.log(`waiting line: ${line.length} waiting, ${liveN} online (MAX_ONLINE ${MAX_ONLINE})`); }
}, 1000).unref();

const onSocket = sock => {
  let c = null, budget = 40, dropped = 0, queued = false, admitted = false;
  const refill = setInterval(() => { budget = Math.min(40, budget + 20); dropped = Math.max(0, dropped - 20); }, 1000);
  const late = setTimeout(() => { if (!c && !queued) sock.close(1008); }, 15_000); // connected but never said hello
  sock.on('message', raw => {
    if (--budget < 0) { if (++dropped > 400) { console.warn(`ws: ${sock.ip} flooded messages, closing`); sock.close(1008); } return; } // ~20 s of flooding
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (!c) {
      if (m.t !== 'hello' || queued) return;
      if (!admitted && mustWait(typeof m.token === 'string' ? m.token : '')) { // the site is full: wait in line
        queued = true;
        line.push({ sock, go: () => { queued = false; admitted = true; if (!sock.open) return; try { hello(m); } catch (e) { console.error('hello error', e); } } });
        sock.send({ t: 'queue', pos: line.length, n: line.length });
        return;
      }
      try { hello(m); } catch (e) { console.error('hello error', e); }
      return;
    }
    c.lastSeen = Date.now();
    try { handle(c, m); if (m.t !== 'act' && m.t !== 'react' && m.t !== 'rooms' && m.t !== 'plaza') store.scheduleSave(); } catch (e) { console.error('handler error', e); }
  });
  function hello(m) {
    {
      let token = typeof m.token === 'string' && /^[a-z0-9]{16,40}$/.test(m.token) ? m.token : null;
      // A new browser makes a new guest profile. One address may make plenty (a party at someone's house, a school network), not thousands.
      if (!token || (!clients.has(token) && !store.sessions.has(token))) {
        if (!allow('new:' + sock.ip, 120, 3600_000)) { console.warn(`ws: ${sock.ip} made too many new guests, closing`); sock.close(1008); return; }
        token = token || crypto.randomBytes(12).toString('hex');
      }
      letIn++;
      c = clients.get(token);
      if (c) { if (c.sock && c.sock !== sock) { console.log(`ws: ${c.id} opened a second connection (${sock.ip}), closing the older one (${c.sock.ip})`); c.sock.send({ t: 'replaced' }); c.sock.close(4000); } }
      else { c = { token, id: null, room: null }; clients.set(token, c); }
      if (c.sock !== sock) c.since = Date.now(); // when this visit started, for the host's list
      c.sock = sock; c.lastSeen = Date.now(); c.view = 'hub';
      c.name = cleanName(m.name) || c.name || 'Guest'; c.color = cleanColor(m.color); c.av = cleanAv(m.av);
      c.dev = modr.cleanDev(m.dev) || c.dev || ''; c.iph = modr.ipHash(sock.ip); // for a host's device or address ban (server/mod.js)
      c.id = store.session(token, c).id;
      const p = store.profileOf(token);
      // An account's look is the one saved on the server. The browser's own copy may be an old guest look (a page
      // that reloaded right after logging in, a second tab, a new browser), so it never overwrites the account:
      // only an explicit 'profile' message (the wardrobe) changes it. A guest's profile is this browser, so it follows.
      // (An old account with a part of its look never saved takes just that part from here.)
      if (p?.user) { c.name = p.name || c.name; c.color = p.color || c.color; c.av = p.av ? cleanAv(p.av) : store.allowedAv(p, c.av); }
      else c.av = store.allowedAv(p, c.av);
      store.setLook(token, c);
      store.scheduleSave();
      store.visit(token);
      send(c, { t: 'welcome', token, id: c.id, name: c.name, build: BUILD });
      send(c, noticeFor(c));
      send(c, statsMsg()); broadcastStats();
      send(c, { t: 'me', me: store.me(store.profileOf(token)) });
      tellStanding(c);
      const r = rooms.get(c.room);
      if (r) {
        if (r.G) { const s = r.G.seats.findIndex(x => x.id === c.id); if (s >= 0) { GAMES[r.game].setAway(r.G, s, false); letGo(r, c); } }
        sendRoom(r); send(c, { t: 'chatlog', log: r.chat });
        if (r.G) sendState(r); else send(c, { t: 'state', s: null });
      } else { c.room = null; c.sock.send(roomsText()); }
    }
  }
  sock.on('close', () => {
    clearInterval(refill); clearTimeout(late);
    if (!c || c.sock !== sock) return;
    c.sock = null; c.lastSeen = Date.now(); plaza.leave(c); broadcastStats();
    const r = rooms.get(c.room); if (r) { if (letGo(r, c)) sendState(r); sendRoom(r); }
  });
};

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
  r.opts = cleanTableOpts(r.game, r.opts);
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
daily.load(); word.load();
wheel.load();
notice.load();
modr.load();
plaza.load();
// Stopping (systemctl restart/stop, Ctrl+C): save everything first, then tell every screen "back in a moment" and
// close with 1012 (service restart), so pages wait for the server and reconnect on their own. The pause lets the
// goodbye frames reach the players before the process ends.
let stopping = false;
const bye = (code = 0) => {
  if (stopping) return; stopping = true;
  store.saveNow(true); farm.saveNow(true); hubchat.saveNow(); plaza.saveNow(); modr.saveNow();
  let n = 0;
  for (const c of clients.values()) if (c.sock) { n++; try { c.sock.send({ t: 'bye' }); c.sock.close(1012); } catch {} }
  console.log(`stopping: saved, told ${n} screens to wait for the restart`);
  helpers?.flush();
  setTimeout(() => process.exit(code), n ? (helpers ? 400 : 200) : 0);
};
process.on('SIGTERM', () => bye()); process.on('SIGINT', () => bye());
// Restart by itself at the end of a countdown (the host's choice in Site notices). Only under systemd (it sets
// INVOCATION_ID), whose Restart= brings the server straight back; anywhere else stopping would just stop the site.
// Before going down, every server file is syntax-checked, so freshly pulled code with a typo can't take the site
// down: then the countdown carries on without the restart and the hosts are told. Exit code 75 ("try again") makes
// systemd restart it with Restart=always and with Restart=on-failure alike.
const SRV = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(SRV, '..');
function gitHead() { // the commit checked out on disk right now (after a git pull it differs from the one running)
  try {
    const head = fs.readFileSync(path.join(REPO, '.git/HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head;
    const ref = head.slice(5);
    try { return fs.readFileSync(path.join(REPO, '.git', ref), 'utf8').trim(); }
    catch { return (fs.readFileSync(path.join(REPO, '.git/packed-refs'), 'utf8').split('\n').find(l => l.endsWith(' ' + ref)) || '').split(' ')[0]; }
  } catch { return ''; }
}
const RUNNING = gitHead();
notice.setExtra(() => { const now = gitHead(); return { pulled: !!(now && RUNNING && now !== RUNNING) }; });
function checkCode() {
  const files = [...['server', 'server/games', 'public', 'public/lang'].flatMap(d => { try { return fs.readdirSync(path.join(REPO, d)).filter(f => f.endsWith('.js')).map(f => path.join(REPO, d, f)); } catch { return []; } }),
    ...(() => { try { return fs.readdirSync(path.join(REPO, 'public/games')).flatMap(g => { try { return fs.readdirSync(path.join(REPO, 'public/games', g)).filter(f => f.endsWith('.js')).map(f => path.join(REPO, 'public/games', g, f)); } catch { return []; } }); } catch { return []; } })()];
  // A few checks at a time, not all ~300 at once: that many node processes together need gigabytes of memory, and on
  // a busy machine some ran past their time limit and were counted as broken, which cancelled a good restart.
  const check = f => new Promise(res => execFile(process.execPath, ['--check', f], { timeout: 30_000 }, err => res(err ? path.relative(REPO, f) : null)));
  const bad = [], queue = [...files];
  const lane = async () => { for (let f; (f = queue.shift());) { const b = await check(f); if (b) bad.push(b); } };
  return Promise.all(Array.from({ length: Math.max(2, Math.min(8, os.availableParallelism?.() || os.cpus().length)) }, lane)).then(() => bad.sort());
}
if (process.env.INVOCATION_ID || process.env.NOTICE_TEST_RESTART) notice.setOnZero(async () => {
  const bad = await checkCode();
  if (bad.length) { console.error(`restart at zero cancelled: ${bad.join(', ')} ${bad.length === 1 ? 'has' : 'have'} a syntax error`); return notice.autoFailed(bad.slice(0, 3).join(', ')); } // the hosts' window explains, in their language
  console.log(`restarting by itself at the end of the countdown (${RUNNING.slice(0, 7) || '?'} -> ${gitHead().slice(0, 7) || '?'})`);
  bye(75);
});

// How the game process is coping, in the log: how busy its loop is (100% = full) and the worst waits a message saw.
// Every 5 minutes while anyone is online, and every minute when it gets busy. HEALTH_EVERY (ms) is for load tests.
const loopDelay = monitorEventLoopDelay({ resolution: 10 }); loopDelay.enable();
let elu = performance.eventLoopUtilization(), healthN = 0;
setInterval(() => {
  const now = performance.eventLoopUtilization(), busy = performance.eventLoopUtilization(now, elu).utilization * 100; elu = now;
  const p99 = loopDelay.percentile(99) / 1e6, max = loopDelay.max / 1e6; loopDelay.reset();
  const online = countLive(), hot = busy > 60 || p99 > 100;
  if ((online && (++healthN % 5 === 0 || hot)) || process.env.HEALTH_EVERY)
    console[hot ? 'warn' : 'log'](`health: ${online} online, game loop ${busy.toFixed(0)}% busy, delay p99 ${p99.toFixed(0)} ms (max ${max.toFixed(0)})${helpers ? `, ${helpers.screens()} screens on ${helpers.links.size} helpers` : ''}${line.length ? `, ${line.length} waiting` : ''}`);
}, +process.env.HEALTH_EVERY || 60_000).unref();

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

// Real-time games (Kart Island Race, Sky Bricks, Beanstalk Bounce, Kalambury) export fast(G, now): it runs twenty times a second and streams the race.
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    const mod = GAMES[r.game];
    try { if (r.G && mod.fast && mod.fast(r.G, now)) sendState(r); } catch (e) { console.error(`fast tick error in ${r.game} table ${r.code}`, e); }
  }
}, 50);

setInterval(() => { try { plaza.tick(); } catch (e) { console.error('plaza tick error', e); } }, 100);

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
// Connection helpers (GATEWAYS=3 on a 4-core server). Without them (the default) this one process does everything, as
// it always has. With them, the helpers own the public port and the players' connections, and this process keeps the
// game: it takes pages from them and talks to them over two socket files (see gateway.js and links.js).
const GATEWAYS = Math.max(0, Math.min(16, Math.floor(+process.env.GATEWAYS || 0)));
let helpers = null;
if (GATEWAYS) {
  trustHelpers();
  const base = path.join(os.tmpdir(), `zatoka-${process.pid}`), files = { http: base + '-http.sock', link: base + '-link.sock' };
  for (const f of Object.values(files)) try { fs.unlinkSync(f); } catch {}
  helpers = serveHelpers(files.link, onSocket);
  process.on('exit', () => { for (const f of Object.values(files)) try { fs.unlinkSync(f); } catch {} });
  cluster.setupPrimary({ exec: path.join(SRV, 'gateway.js') });
  const fork = () => cluster.fork({ PORT, HOST, CORE_HTTP: files.http, CORE_LINK: files.link });
  cluster.on('exit', (w, code, sig) => { if (stopping) return; console.error(`connection helper ${w.process.pid} stopped (${sig || code}), starting another`); setTimeout(fork, 1000); });
  let up = 0; // "running" is said once every helper takes connections (tests and scripts wait for that line)
  cluster.on('listening', () => { if (++up === GATEWAYS) console.log(`Zatoka Gier running on http://${HOST}:${PORT} with ${GATEWAYS} connection helpers`); });
  server.listen(files.http, () => { for (let i = 0; i < GATEWAYS; i++) fork(); });
} else {
  attach(server, '/ws', onSocket);
  server.listen(PORT, HOST, () => console.log(`Zatoka Gier running on http://${HOST}:${PORT}`));
}

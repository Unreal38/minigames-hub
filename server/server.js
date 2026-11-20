// Cozy Table game server: static files + WebSocket lobbies. No dependencies.
// Profiles, optional accounts and lobby scoreboards are saved to disk by store.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { attach } from './ws.js';
import * as hotpot from './games/hotpot.js';
import * as marbles from './games/marbles.js';
import * as ladders from './games/ladders.js';
import * as poker from './games/poker.js';
import { cleanAv } from '../public/avatar.js';
import * as store from './store.js';
import * as farm from './farm.js';

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const GAMES = { hotpot, marbles, ladders, poker };
const AWAY_MS = 30_000;       // a dropped player is botted after this
const LOBBY_DROP_MS = 15_000; // a dropped player leaves a waiting lobby after this
const END_IDLE_MS = 10 * 60_000;
const RESTORE_GRACE_MS = 90_000; // after a restart, players get this long to reconnect before their seat is freed

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.end('ok'); return; }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
});

// ---------- players & rooms ----------
const clients = new Map();  // token -> client {token, id, name, color, sock, room, lastSeen}
const rooms = new Map();    // code -> room

const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
const cleanColor = s => /^#[0-9a-f]{6}$/i.test(s) ? s : '#ff8fab';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join(''); } while (rooms.has(c)); return c; };

function roomInfo(r) {
  return {
    code: r.code, game: r.game, gameName: GAMES[r.game].meta.name, host: r.host, priv: r.priv,
    state: r.G ? r.G.ph : 'lobby', opts: r.opts, max: GAMES[r.game].meta.maxPlayers,
    players: r.players.map(t => { const c = clients.get(t); return { id: c.id, name: c.name, color: c.color, av: c.av, online: !!c.sock, watch: r.spect.has(c.id), ...store.badge(store.profileOf(t)) }; }),
    board: boardOf(r), played: r.played || 0,
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
  const res = mod.results?.(G); if (!res) return;
  r.played = (r.played || 0) + 1; r.board ||= {};
  G.seats.forEach((seat, i) => {
    if (!seat.human || !seat.id) return;
    const c = r.players.map(t => clients.get(t)).find(x => x?.id === seat.id); if (!c) return;
    const p = store.profileOf(c.token); if (!p) return;
    const e = r.board[p.pid] ||= { pid: p.pid, name: c.name, color: c.color, av: c.av, games: 0, wins: 0, pts: 0 };
    Object.assign(e, { name: c.name, color: c.color, av: c.av });
    e.games++; e.pts += Math.max(0, res[i].pts); if (res[i].win) e.wins++;
    if (Number.isFinite(res[i].coins)) e.coins = res[i].coins;
    const gain = store.credit(p, r.game, res[i]);
    send(c, { t: 'me', me: store.me(p), gain });
  });
  sendRoom(r); store.scheduleSave();
}
const publicRooms = () => [...rooms.values()].filter(r => !r.priv).map(r => {
  const i = roomInfo(r), h = i.players.find(p => p.id === i.host);
  return { code: i.code, gameName: i.gameName, state: i.state, n: i.players.filter(p => !p.watch).length, max: i.max, w: i.players.filter(p => p.watch).length,
    host: h?.name || '?', hostColor: h?.color, hostAv: h?.av };
});

function send(c, msg) { c?.sock?.send(msg); }
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
  // After a restart there is no previous game, so pretend coins come back from the table scoreboard.
  const saved = { game: r.game, wallet: {} };
  for (const c of humans) { const e = r.board?.[store.profileOf(c.token)?.pid]; if (Number.isFinite(e?.coins)) saved.wallet['h:' + c.id] = e.coins; }
  r.G = GAMES[r.game].create(humans.map(c => ({ id: c.id, name: c.name, color: c.color, av: c.av })), r.opts, r.G || r.last || (Object.keys(saved.wallet).length ? saved : null));
  sendRoom(r); sendState(r); broadcastRooms();
}

function handle(c, m) {
  switch (m.t) {
    case 'profile': {
      const n = cleanName(m.name); if (n) c.name = n; c.color = cleanColor(m.color); c.av = cleanAv(m.av);
      store.setLook(c.token, c);
      const r = rooms.get(c.room); if (r) { if (!r.G) sendRoom(r); }
      return;
    }
    case 'rooms': return send(c, { t: 'rooms', rooms: publicRooms() });
    case 'stats': return send(c, statsMsg());
    case 'create': {
      if (!GAMES[m.game]) return;
      const r = { code: newCode(), game: m.game, host: c.id, priv: !!m.priv, players: [], spect: new Set(), sit: new Set(), G: null, chat: [], created: Date.now(),
        opts: GAMES[m.game].cleanOpts ? GAMES[m.game].cleanOpts(m.opts || {})
          : { bots: m.opts?.bots === 'sharp' ? 'sharp' : 'chill', timer: [0, 20, 30, 45, 60].includes(+m.opts?.timer) ? +m.opts.timer : 30 } };
      rooms.set(r.code, r); joinRoom(c, r);
      if (m.solo) startGame(r);
      return;
    }
    case 'join': {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) return send(c, { t: 'err', msg: 'No table with that code. Check the letters?' });
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
      const msg = { t: 'chat', id: c.id, name: c.name, color: c.color, av: c.av, text };
      r.chat.push(msg); if (r.chat.length > 40) r.chat.shift();
      for (const t of r.players) send(clients.get(t), msg);
      return;
    }
    case 'register': case 'login': {
      const now = Date.now(); c.tries = (c.tries || []).filter(x => now - x < 60_000);
      if (c.tries.length >= 6) return send(c, { t: 'auth', err: 'Too many tries. Wait a minute and try again.' });
      c.tries.push(now);
      store[m.t](c.token, m.user, m.pass).then(({ err, p }) => {
        if (err) return send(c, { t: 'auth', err });
        if (m.t === 'login') { c.name = p.name; c.color = p.color; if (p.av) c.av = p.av; }
        else store.setLook(c.token, c);
        send(c, { t: 'auth', ok: m.t }); send(c, { t: 'me', me: store.me(p) });
        const r = rooms.get(c.room); if (r) sendRoom(r);
      }, e => { console.error('auth error', e); send(c, { t: 'auth', err: 'Something went wrong. Try again.' }); });
      return;
    }
    case 'logout': {
      const p = store.logout(c.token, c); if (!p) return;
      send(c, { t: 'me', me: store.me(p) });
      const r = rooms.get(c.room); if (r) sendRoom(r);
      return;
    }
    case 'farm': { // Pet Farm: a persistent game with no table, so it is handled outside the rooms
      if (m.a?.t === 'crate' && m.a.skip) farm.testSkipCrate(store.profileOf(c.token)?.pid);
      return farm.handle(store.profileOf(c.token), m.a, msg => send(c, msg));
    }
    case 'react': { // little food emote shown over your seat
      const r = rooms.get(c.room); if (!r) return;
      const now = Date.now(); if (now - (c.lastReact || 0) < 700) return; c.lastReact = now;
      const k = Math.max(0, Math.min(11, m.k | 0));
      for (const t of r.players) send(clients.get(t), { t: 'react', id: c.id, k });
      return;
    }
  }
}

attach(server, '/ws', sock => {
  let c = null, budget = 40;
  const refill = setInterval(() => { budget = Math.min(40, budget + 20); }, 1000);
  sock.on('message', raw => {
    if (--budget < 0) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (!c) {
      if (m.t !== 'hello') return;
      const token = typeof m.token === 'string' && /^[a-z0-9]{16,40}$/.test(m.token) ? m.token : crypto.randomBytes(12).toString('hex');
      c = clients.get(token);
      if (c) { if (c.sock && c.sock !== sock) c.sock.close(4000); }
      else { c = { token, id: null, room: null }; clients.set(token, c); }
      c.sock = sock; c.lastSeen = Date.now();
      c.name = cleanName(m.name) || c.name || 'Guest'; c.color = cleanColor(m.color); c.av = cleanAv(m.av);
      c.id = store.session(token, c).id; store.setLook(token, c); store.scheduleSave();
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
      return;
    }
    c.lastSeen = Date.now();
    try { handle(c, m); if (m.t !== 'act' && m.t !== 'react' && m.t !== 'rooms') store.scheduleSave(); } catch (e) { console.error('handler error', e); }
  });
  sock.on('close', () => {
    clearInterval(refill);
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
const bye = () => { store.saveNow(); farm.saveNow(); process.exit(0); };
process.on('SIGTERM', bye); process.on('SIGINT', bye);

// ---------- game loop & housekeeping ----------
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (r.G && GAMES[r.game].tick(r.G, now)) sendState(r);
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

setInterval(() => { // heartbeat + forget long-gone clients
  const now = Date.now();
  for (const [t, c] of clients) {
    if (c.sock) { if (!c.sock.alive) { c.sock.close(); continue; } c.sock.alive = false; c.sock.ping(); }
    else if (!c.room && now - c.lastSeen > 3600_000) clients.delete(t);
  }
}, 25_000);

server.listen(PORT, HOST, () => console.log(`Cozy Table running on http://${HOST}:${PORT}`));

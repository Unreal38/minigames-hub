// Cozy Table game server: static files + WebSocket lobbies. No dependencies, no accounts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { attach } from './ws.js';
import * as hotpot from './games/hotpot.js';

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const GAMES = { hotpot };
const AWAY_MS = 30_000;       // a dropped player is botted after this
const LOBBY_DROP_MS = 15_000; // a dropped player leaves a waiting lobby after this
const END_IDLE_MS = 10 * 60_000;

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
    players: r.players.map(t => { const c = clients.get(t); return { id: c.id, name: c.name, color: c.color, online: !!c.sock }; }),
  };
}
const publicRooms = () => [...rooms.values()].filter(r => !r.priv).map(r => {
  const i = roomInfo(r); return { code: i.code, gameName: i.gameName, state: i.state, n: i.players.length, max: i.max,
    host: i.players.find(p => p.id === i.host)?.name || '?' };
});

function send(c, msg) { c?.sock?.send(msg); }
function broadcastRooms() { const msg = { t: 'rooms', rooms: publicRooms() }; for (const c of clients.values()) if (c.sock && !c.room) send(c, msg); }
function sendRoom(r) { const info = roomInfo(r); for (const t of r.players) send(clients.get(t), { t: 'room', room: info }); }
function sendState(r) {
  if (!r.G) return;
  const mod = GAMES[r.game];
  for (const t of r.players) {
    const c = clients.get(t); if (!c?.sock) continue;
    send(c, { t: 'state', s: mod.view(r.G, r.G.seats.findIndex(s => s.id === c.id)) });
  }
}

function leaveRoom(c) {
  const r = rooms.get(c.room); c.room = null;
  if (!r) return;
  r.players = r.players.filter(t => t !== c.token);
  if (r.G && r.G.ph === 'play') {
    const s = r.G.seats.findIndex(x => x.id === c.id);
    if (s >= 0) { GAMES[r.game].setAway(r.G, s, true); r.G.seats[s].name += ' (bot)'; r.G.seats[s].human = false; r.G.seats[s].id = null; }
  }
  if (!r.players.length) rooms.delete(r.code);
  else { if (r.host === c.id) r.host = clients.get(r.players[0]).id; sendRoom(r); sendState(r); }
  broadcastRooms();
}

function joinRoom(c, r) {
  if (c.room === r.code) { sendRoom(r); sendState(r); return; }
  if (c.room) leaveRoom(c);
  const mod = GAMES[r.game];
  if (r.players.length >= mod.meta.maxPlayers && !r.G) return send(c, { t: 'err', msg: 'That table is full.' });
  if (r.players.length >= 8) return send(c, { t: 'err', msg: 'That table is full.' });
  r.players.push(c.token); c.room = r.code;
  sendRoom(r); sendState(r); broadcastRooms();
}

function startGame(r) {
  const humans = r.players.map(t => clients.get(t)).slice(0, GAMES[r.game].meta.maxPlayers);
  r.G = GAMES[r.game].create(humans.map(c => ({ id: c.id, name: c.name, color: c.color })), r.opts, r.G);
  sendRoom(r); sendState(r); broadcastRooms();
}

function handle(c, m) {
  switch (m.t) {
    case 'profile': {
      const n = cleanName(m.name); if (n) c.name = n; c.color = cleanColor(m.color);
      const r = rooms.get(c.room); if (r) { if (!r.G) sendRoom(r); }
      return;
    }
    case 'rooms': return send(c, { t: 'rooms', rooms: publicRooms() });
    case 'create': {
      if (!GAMES[m.game]) return;
      const r = { code: newCode(), game: m.game, host: c.id, priv: !!m.priv, players: [], G: null, created: Date.now(),
        opts: { bots: m.opts?.bots === 'sharp' ? 'sharp' : 'chill', timer: [0, 20, 30, 45, 60].includes(+m.opts?.timer) ? +m.opts.timer : 30 } };
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
      if (m.opts?.bots) r.opts.bots = m.opts.bots === 'sharp' ? 'sharp' : 'chill';
      if (m.opts?.timer !== undefined && [0, 20, 30, 45, 60].includes(+m.opts.timer)) r.opts.timer = +m.opts.timer;
      if (m.priv !== undefined) r.priv = !!m.priv;
      sendRoom(r); broadcastRooms(); return;
    }
    case 'start': {
      const r = rooms.get(c.room); if (!r || r.host !== c.id || r.G?.ph === 'play') return;
      return startGame(r);
    }
    case 'lobby': { // host sends everyone back to the waiting room
      const r = rooms.get(c.room); if (!r || r.host !== c.id || r.G?.ph === 'play') return;
      r.G = null; for (const t of r.players) send(clients.get(t), { t: 'state', s: null });
      sendRoom(r); broadcastRooms(); return;
    }
    case 'act': {
      const r = rooms.get(c.room); if (!r?.G) return;
      const s = r.G.seats.findIndex(x => x.id === c.id);
      if (GAMES[r.game].act(r.G, s, m.a)) sendState(r);
      return;
    }
    case 'react': { // little food emote shown over your seat
      const r = rooms.get(c.room); if (!r) return;
      const now = Date.now(); if (now - (c.lastReact || 0) < 700) return; c.lastReact = now;
      const k = Math.max(0, Math.min(7, m.k | 0));
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
      else { c = { token, id: crypto.randomBytes(6).toString('hex'), room: null }; clients.set(token, c); }
      c.sock = sock; c.lastSeen = Date.now();
      c.name = cleanName(m.name) || c.name || 'Guest'; c.color = cleanColor(m.color);
      send(c, { t: 'welcome', token, id: c.id, name: c.name });
      const r = rooms.get(c.room);
      if (r) {
        if (r.G) { const s = r.G.seats.findIndex(x => x.id === c.id); if (s >= 0 && GAMES[r.game].setAway(r.G, s, false)) {} }
        sendRoom(r); sendState(r);
      } else { c.room = null; send(c, { t: 'rooms', rooms: publicRooms() }); }
      return;
    }
    c.lastSeen = Date.now();
    try { handle(c, m); } catch (e) { console.error('handler error', e); }
  });
  sock.on('close', () => {
    clearInterval(refill);
    if (!c || c.sock !== sock) return;
    c.sock = null; c.lastSeen = Date.now();
    const r = rooms.get(c.room); if (r) sendRoom(r);
  });
});

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

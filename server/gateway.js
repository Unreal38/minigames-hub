// A connection helper (GATEWAYS=n starts n of them, see server.js). It owns the public port: pages and the Ko-fi
// webhook are passed straight on to the game process, and players' WebSocket connections stay here. Framing, the
// heartbeat and writing to thousands of sockets happen here, on another core; the game process only sends each
// message once per helper (server/links.js).
import http from 'node:http';
import net from 'node:net';
import cluster from 'node:cluster';
import { attach, ipOf, frameOf } from './ws.js';
import { K, frame, reader } from './links.js';

const { PORT = '8080', HOST = '0.0.0.0', CORE_HTTP, CORE_LINK } = process.env;
// systemd sends a stop to every process of the service at once. A helper waits for the game process instead: it says
// goodbye to every screen through the helper, then closes the line, and the helper ends after passing that on.
process.on('SIGTERM', () => {}); process.on('SIGINT', () => {});

const socks = new Map(); // id -> ws.js Socket
const asks = new Map();  // ask number -> go(id)
let askN = 0;
const core = net.connect(CORE_LINK);
core.setNoDelay(true);
const toCore = b => { if (!core.destroyed) core.write(b); };
core.on('error', e => { console.error('helper: lost the game process', e.message); });
core.on('close', () => { // the game process stopped (or a restart): let the last frames out, then stop too
  for (const go of asks.values()) go(0);
  for (const ws of socks.values()) try { ws.sock.end(); } catch {}
  setTimeout(() => process.exit(0), 300);
});
cluster.worker?.on('error', () => {}); // the game process is gone: nothing left to tell it
reader(core, (kind, b) => {
  if (kind === K.S) socks.get(b.readUInt32BE(0))?.sendFrame(frameOf(1, b.subarray(4)));
  else if (kind === K.B) {
    const n = b.readUInt32BE(0), f = frameOf(1, b.subarray(4 + n * 4));
    for (let i = 0, o = 4; i < n; i++, o += 4) socks.get(b.readUInt32BE(o))?.sendFrame(f);
  }
  else if (kind === K.C) socks.get(b.readUInt32BE(0))?.close(b.readUInt16BE(4));
  else if (kind === K.A) { const ask = b.readUInt32BE(0), go = asks.get(ask); asks.delete(ask); go?.(b.readUInt32BE(4)); }
});

// Pages, files and the Ko-fi webhook: passed on unchanged, with the visitor's address worked out here.
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });
const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection']);
const server = http.createServer((req, res) => {
  const headers = { ...req.headers, 'x-forwarded-for': ipOf(req) };
  delete headers['cf-connecting-ip'];
  const up = http.request({ socketPath: CORE_HTTP, method: req.method, path: req.url, headers, agent }, r => {
    const raw = [];
    for (let i = 0; i < r.rawHeaders.length; i += 2) if (!HOP.has(r.rawHeaders[i].toLowerCase())) raw.push(r.rawHeaders[i], r.rawHeaders[i + 1]);
    res.writeHead(r.statusCode, r.statusMessage, raw);
    r.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' }); res.end(); });
  req.pipe(up);
});
attach(server, '/ws', (ws, req, id) => {
  socks.set(id, ws);
  ws.on('message', text => toCore(frame(K.M, id, Buffer.from(text))));
  ws.on('close', () => { socks.delete(id); toCore(frame(K.G, id)); });
}, (ip, go) => { asks.set(++askN, go); toCore(frame(K.Q, askN, Buffer.from(ip))); });

setInterval(() => { // heartbeat: a screen that didn't answer the last ping is gone
  for (const ws of socks.values()) { if (!ws.alive) { ws.close(); continue; } ws.alive = false; ws.ping(); }
}, 25_000).unref();

server.listen(+PORT, HOST);

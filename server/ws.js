// Minimal dependency-free WebSocket server (RFC 6455): text frames, ping/pong, close.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { allow } from './limits.js';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MSG = 16 * 1024;
const MAX_QUEUE = 4 * 1024 * 1024; // bytes waiting to go out to one screen before it is dropped
// Open connections from one address at once. A house full of friends shares one address, and so can a whole school
// or office network when the site is shared around, so this is roomy. WS_PER_IP on the server changes it.
const PER_IP = +process.env.WS_PER_IP || 40;
const NEW_PER_MIN = 60;     // new connections from one address per minute
const open = new Map();     // ip -> open connections

// The address of the person on the other end. The server only listens on 127.0.0.1 behind Caddy, which puts the real
// address last in X-Forwarded-For (it replaces whatever the browser sent). The header is only believed when the
// connection really comes from this machine, so nobody can fake it from outside. With Cloudflare in front, set
// TRUST_CLOUDFLARE=1 so its CF-Connecting-IP header is used instead (only do that if the server is reachable through
// Cloudflare alone).
// With connection helpers (GATEWAYS) the game process takes requests only from them, over a local socket file, and
// they always set X-Forwarded-For to the address they worked out with this same function.
let behindHelpers = false;
export const trustHelpers = () => { behindHelpers = true; };
export function ipOf(req) {
  const peer = req.socket.remoteAddress || '';
  if (!behindHelpers && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) return peer;
  const cf = process.env.TRUST_CLOUDFLARE && req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  return xff ? String(xff).split(',').pop().trim() : peer;
}

// The address the rate limits count by. An IPv6 home connection gets a whole /64 block of addresses, so one person
// could hop between billions of them: every address in the same /64 counts as one.
export function limitKey(ip) {
  ip = String(ip || '');
  if (!ip.includes(':') || ip.startsWith('::ffff:')) return ip.replace(/^::ffff:/, '');
  const [head, tail = ''] = ip.split('::'), h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map(x => (x || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

// Whether one more connection from this address may open now (counted as open if so), and its closing.
export function admit(ip) {
  if ((open.get(ip) || 0) >= PER_IP || !allow('conn:' + ip, NEW_PER_MIN, 60_000)) return false;
  open.set(ip, (open.get(ip) || 0) + 1); return true;
}
export function release(ip) { const n = (open.get(ip) || 1) - 1; if (n > 0) open.set(ip, n); else open.delete(ip); }

// A whole text frame, built once and written to many screens.
export function frameOf(op, payload) {
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | op;
  return Buffer.concat([head, payload]);
}

export class Socket extends EventEmitter {
  constructor(sock, ip) {
    super();
    this.sock = sock; this.ip = ip; this.open = true; this.alive = true;
    this.buf = Buffer.alloc(0); this.frag = []; this.fragOp = 0;
    sock.setNoDelay(true);
    sock.on('data', d => this._data(d));
    sock.on('close', () => this._closed());
    sock.on('error', () => this._closed());
  }
  send(obj) {
    if (!this.open) return;
    this._frame(1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)));
  }
  ping() { if (this.open) this._frame(9, Buffer.alloc(0)); }
  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.alloc(2); b.writeUInt16BE(code);
    this._frame(8, b);
    this.sock.end(); // flush the close frame (and anything queued before it) before tearing down
    this._closed(false);
    setTimeout(() => this.sock.destroy(), 2000).unref();
  }
  _closed(destroy = true) {
    if (!this.open) return;
    this.open = false;
    if (destroy) this.sock.destroy();
    this.emit('close');
  }
  _frame(op, payload) { this.sendFrame(frameOf(op, payload)); }
  sendFrame(frame) {
    if (!this.open) return;
    try { this.sock.write(frame); } catch { this._closed(); return; }
    // A screen that stopped reading (a phone on a dead network that hasn't timed out yet) would make the server keep
    // everything it is sent in memory. Past MAX_QUEUE waiting bytes the connection is dropped; the page reconnects.
    if (this.sock.writableLength > MAX_QUEUE && this.open) { console.warn(`ws: ${this.ip} is not reading (${this.sock.writableLength} bytes waiting), dropping`); this.open = false; this.sock.destroy(); this.emit('close'); }
  }
  _data(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.open) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (!masked || len > MAX_MSG) { console.warn(`ws: closing ${this.ip}: ${masked ? `frame of ${len} bytes` : 'unmasked frame'}`); return this.close(1009); }
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op === 8) return this.close();
      if (op === 9) { this._frame(10, payload); continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 0 || op === 1 || op === 2) {
        if (op !== 0) this.fragOp = op;
        this.frag.push(payload);
        const total = this.frag.reduce((s, p) => s + p.length, 0);
        if (total > MAX_MSG) { console.warn(`ws: closing ${this.ip}: message of ${total} bytes`); return this.close(1009); }
        if (fin) {
          const msg = Buffer.concat(this.frag); this.frag = [];
          if (this.fragOp === 1) this.emit('message', msg.toString('utf8'));
        }
      }
    }
  }
}

// Attach to an http.Server; calls onConnect(socket, req) for each upgrade on `path`. With `ask` (a connection helper),
// the go-ahead for an address comes from the game process instead: ask(ip, yes => ...) with yes = an id or 0.
export function attach(server, path, onConnect, ask = null) {
  server.on('upgrade', (req, sock) => {
    sock.on('error', () => {}); // a client vanishing mid-handshake must not crash the server
    const url = new URL(req.url, 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return;
    }
    // Only pages from this site may open a connection: a page on another site gets turned away. (Scripts outside a
    // browser send no Origin and are let in; they never had a player's token anyway.)
    const origin = req.headers.origin;
    if (origin) { let oh = ''; try { oh = new URL(origin).host; } catch {} if (!oh || oh.toLowerCase() !== String(req.headers.host || '').toLowerCase()) { sock.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; } }
    const ip = limitKey(ipOf(req));
    const go = id => {
      if (!id) { sock.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return; }
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
      const ws = new Socket(sock, ip);
      if (!ask) ws.once('close', () => release(ip));
      onConnect(ws, req, id);
      if (sock.destroyed) ws._closed(); // it went away while waiting for the go-ahead
    };
    if (ask) ask(ip, go); else go(admit(ip) ? 1 : 0);
  });
}

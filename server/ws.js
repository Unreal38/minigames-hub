// Minimal dependency-free WebSocket server (RFC 6455): text frames, ping/pong, close.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MSG = 16 * 1024;

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
    this.sock.end();
    this._closed();
  }
  _closed() {
    if (!this.open) return;
    this.open = false;
    this.sock.destroy();
    this.emit('close');
  }
  _frame(op, payload) {
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | op;
    try { this.sock.write(Buffer.concat([head, payload])); } catch { this._closed(); }
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
      if (!masked || len > MAX_MSG) return this.close(1009);
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
        if (total > MAX_MSG) return this.close(1009);
        if (fin) {
          const msg = Buffer.concat(this.frag); this.frag = [];
          if (this.fragOp === 1) this.emit('message', msg.toString('utf8'));
        }
      }
    }
  }
}

// Attach to an http.Server; calls onConnect(socket, req) for each upgrade on `path`.
export function attach(server, path, onConnect) {
  server.on('upgrade', (req, sock) => {
    const url = new URL(req.url, 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    onConnect(new Socket(sock, ip), req);
  });
}

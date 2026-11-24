// The line between the game process and its connection helpers (GATEWAYS, server/gateway.js).
// Each helper holds the players' WebSocket connections and does the slow part, writing to thousands of sockets; the game
// process keeps all the game state as before and talks to each helper over one local socket file.
// What travels on it, one frame each: [u32 length of the rest][u8 kind][...]
//   game -> helper  S id text        send text to one screen
//                   B n id*n text    send the same text to n screens (built into a WebSocket frame once)
//                   C id code        close one screen
//                   A ask id         answer to Q: the new screen's id, or 0 for "too many from that address"
//   helper -> game  Q ask ip         may a new screen from this address connect?
//                   M id text        a message from a screen
//                   G id             a screen went away
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { admit, release } from './ws.js';

export const K = { S: 83, B: 66, C: 67, A: 65, Q: 81, M: 77, G: 71 };

export function frame(kind, ...parts) { // parts: u32 numbers, a u16 as {u16}, Buffers
  let n = 1;
  for (const p of parts) n += typeof p === 'number' ? 4 : p.u16 !== undefined ? 2 : p.length;
  const b = Buffer.allocUnsafe(4 + n);
  b.writeUInt32BE(n, 0); b[4] = kind;
  let o = 5;
  for (const p of parts) {
    if (typeof p === 'number') { b.writeUInt32BE(p, o); o += 4; }
    else if (p.u16 !== undefined) { b.writeUInt16BE(p.u16, o); o += 2; }
    else { p.copy(b, o); o += p.length; }
  }
  return b;
}
export function broadcastFrame(ids, payload) {
  const n = 1 + 4 + ids.length * 4 + payload.length, b = Buffer.allocUnsafe(4 + n);
  b.writeUInt32BE(n, 0); b[4] = K.B; b.writeUInt32BE(ids.length, 5);
  let o = 9;
  for (const id of ids) { b.writeUInt32BE(id, o); o += 4; }
  payload.copy(b, o);
  return b;
}

// Cuts the incoming stream into frames: onFrame(kind, body) with body a Buffer.
export function reader(sock, onFrame) {
  let chunks = [], have = 0;
  sock.on('data', d => {
    chunks.push(d); have += d.length;
    while (have >= 4) {
      let buf = chunks.length === 1 ? chunks[0] : (chunks = [Buffer.concat(chunks)])[0];
      const n = buf.readUInt32BE(0);
      if (have < 4 + n) return;
      onFrame(buf[4], buf.subarray(5, 4 + n));
      buf = buf.subarray(4 + n); have = buf.length; chunks = have ? [buf] : [];
    }
  });
}

// ---------- the game process's side ----------
let nextId = 0;
const newId = () => { nextId = nextId >= 0xfffffff0 ? 1 : nextId + 1; return nextId; };

// A screen on a helper, looking just like a ws.js Socket to the rest of the server.
class Remote extends EventEmitter {
  constructor(link, id, ip) { super(); this.link = link; this.id = id; this.ip = ip; this.open = true; this.at = -1; this.ep = 0; }
  send(obj) { if (this.open) this.link.queue(this, typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  // The helper keeps its own heartbeat and reports a screen that stops answering as gone, so here it is always alive.
  get alive() { return true; } set alive(v) {}
  ping() {}
  close(code = 1000) { if (!this.open) return; this.link.queue(this, null, code); this.gone(); }
  gone() { if (!this.open) return; this.open = false; this.link.socks.delete(this.id); release(this.ip); this.emit('close'); }
}

class Link {
  constructor(sock, onConnect) {
    this.sock = sock; this.socks = new Map(); this.groups = []; this.byText = new Map(); this.ep = 1; this.due = false;
    sock.on('error', () => {});
    sock.on('close', () => { for (const s of [...this.socks.values()]) s.gone(); });
    reader(sock, (kind, b) => {
      if (kind === K.M) { const s = this.socks.get(b.readUInt32BE(0)); if (s?.open) s.emit('message', b.toString('utf8', 4)); }
      else if (kind === K.G) this.socks.get(b.readUInt32BE(0))?.gone();
      else if (kind === K.Q) {
        const ask = b.readUInt32BE(0), ip = b.toString('utf8', 4);
        const id = admit(ip) ? newId() : 0;
        this.write(frame(K.A, ask, id));
        if (id) { const s = new Remote(this, id, ip); this.socks.set(id, s); onConnect(s); }
      }
    });
  }
  write(b) { if (!this.sock.destroyed) this.sock.write(b); }
  // Everything sent during one turn of the event loop goes out together. The same text sent to many screens (the
  // table list, the online numbers, a table's state to everyone at it) travels once, with the list of screens, as
  // long as that keeps each screen's messages in the order they were sent.
  queue(s, text, code) {
    if (s.ep !== this.ep) { s.ep = this.ep; s.at = -1; }
    if (text === null) { this.groups.push({ close: code, ids: [s.id] }); s.at = this.groups.length - 1; }
    else {
      const gi = this.byText.get(text);
      if (gi !== undefined && gi >= s.at) { this.groups[gi].ids.push(s.id); s.at = gi; }
      else { this.groups.push({ text, ids: [s.id] }); s.at = this.groups.length - 1; this.byText.set(text, s.at); }
    }
    if (!this.due) { this.due = true; setImmediate(() => this.flush()); }
  }
  flush() {
    const groups = this.groups;
    this.groups = []; this.byText = new Map(); this.ep++; this.due = false;
    if (this.sock.destroyed) return;
    this.sock.cork();
    for (const g of groups) {
      if (g.close !== undefined) this.write(frame(K.C, g.ids[0], { u16: g.close }));
      else if (g.ids.length === 1) this.write(frame(K.S, g.ids[0], Buffer.from(g.text)));
      else this.write(broadcastFrame(g.ids, Buffer.from(g.text)));
    }
    this.sock.uncork();
  }
}

// Listens on a local socket file for the helpers; onConnect(socket) for every new screen, like ws.js attach.
export function serveHelpers(file, onConnect) {
  const links = new Set();
  const srv = net.createServer(sock => { const l = new Link(sock, onConnect); links.add(l); sock.on('close', () => links.delete(l)); });
  srv.listen(file);
  return { srv, links, flush: () => { for (const l of links) if (l.due) l.flush(); }, screens: () => [...links].reduce((n, l) => n + l.socks.size, 0) };
}

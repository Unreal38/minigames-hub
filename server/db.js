// Saved data in one SQLite file (DATA_DIR/zatoka.db), written a little at a time.
// The game keeps everything in memory exactly as before (plain Maps); this file only decides what to write. Each save
// writes the profiles, sessions and farms that were looked at since the last save (Tracked.get marks them), plus a
// rolling slice of everything else, so a change made some other way (a loop over every profile) still reaches the
// disk within a minute or so, and a stop writes everything. Before, every save rewrote the whole JSON file, which at
// 50,000 saved players froze the server for about 200 ms each time.
// SQLite comes with Node (22.13 or newer); nothing to install. The old JSON files are only ever read, never changed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// node:sqlite prints an "experimental" warning on first use. It is the only one we silence.
const emit = process.emitWarning;
process.emitWarning = function (w, ...a) { if (/SQLite/.test(String(w?.message ?? w))) return; return emit.call(this, w, ...a); };
let DatabaseSync = null;
try { ({ DatabaseSync } = createRequire(import.meta.url)('node:sqlite')); } catch {} // older Node: the store stays on JSON files
process.emitWarning = emit;

export const FILE_NAME = 'zatoka.db';
let db = null, stmts = null;

export function open(dir) {
  if (db) return db;
  if (!DatabaseSync) throw new Error(`this Node (${process.version}) has no built-in SQLite; 22.13 or newer does`);
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, FILE_NAME));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS rows (kind TEXT NOT NULL, id TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (kind, id)) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;`);
  stmts = {
    put: db.prepare('INSERT INTO rows (kind, id, v) VALUES (?, ?, ?) ON CONFLICT (kind, id) DO UPDATE SET v = excluded.v'),
    del: db.prepare('DELETE FROM rows WHERE kind = ? AND id = ?'),
    all: db.prepare('SELECT id, v FROM rows WHERE kind = ?'),
    count: db.prepare('SELECT count(*) AS n FROM rows WHERE kind = ?'),
    getKv: db.prepare('SELECT v FROM kv WHERE k = ?'),
    putKv: db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v'),
  };
  return db;
}
export const isOpen = () => !!db;
export function close() { try { db?.close(); } catch {} db = null; stmts = null; }
export const rows = kind => stmts.all.all(kind);
export const count = kind => stmts.count.get(kind).n;
export const getKv = k => stmts.getKv.get(k)?.v;
export const putKv = (k, v) => stmts.putKv.run(k, v);
export const put = (kind, id, v) => stmts.put.run(kind, id, v);
export const del = (kind, id) => stmts.del.run(kind, id);
// Runs f inside one transaction: a crash mid-save leaves the previous save whole.
export function tx(f) {
  db.exec('BEGIN');
  try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}
// A consistent copy of the whole database, safe to take while the server runs.
export function backup(to) { db.exec(`VACUUM INTO '${String(to).replace(/'/g, "''")}'`); }

// A Map that remembers which entries were looked at (get) or replaced (set) since the last save, and which went away.
// `peek` reads without marking, for loops that only look.
export class Tracked extends Map {
  constructor(kind) { super(); this.kind = kind; this.hot = new Set(); this.gone = new Set(); this.last = new Map(); this.ring = []; this.at = 0; }
  get(k) { const v = super.get(k); if (v !== undefined) this.hot.add(k); return v; }
  peek(k) { return super.get(k); }
  set(k, v) { super.set(k, v); this.hot?.add(k); this.gone?.delete(k); return this; }
  delete(k) { const had = super.delete(k); if (had) { this.hot.delete(k); this.gone.add(k); } return had; }
  // What the database holds for an entry, as text (filled at load, kept up to date by flush).
  remember(k, text) { this.last.set(k, text); }
  // After a save that failed (and was rolled back), what we thought was on disk can't be trusted: forget it, so the
  // next save compares everything again.
  forget() { this.last.clear(); this.ring = []; this.at = 0; }
  // Writes what changed. keep(id, value) says whether an entry belongs on disk (a guest with nothing yet does not).
  // all = true compares every entry (stopping, or the first save after loading). Returns how many rows were written.
  flush(keep, { all = false, slice = 2000, onNew = null } = {}) {
    const ids = new Set(this.hot); this.hot.clear();
    if (all) for (const k of this.keys()) ids.add(k);
    else {
      if (this.at >= this.ring.length) { this.ring = [...this.keys(), ...this.last.keys()]; this.at = 0; }
      const end = Math.min(this.ring.length, this.at + slice);
      for (; this.at < end; this.at++) ids.add(this.ring[this.at]);
    }
    for (const k of this.gone) ids.add(k);
    this.gone.clear();
    if (all) { for (const k of this.last.keys()) ids.add(k); for (const r of rows(this.kind)) ids.add(r.id); } // a full save also clears rows nothing in memory matches
    let n = 0;
    for (const k of ids) {
      const v = super.get(k), was = this.last.get(k);
      if (v === undefined || !keep(k, v)) { if (was !== undefined || all) { del(this.kind, k); this.last.delete(k); n++; } continue; }
      const text = JSON.stringify(v);
      if (text === was) continue;
      put(this.kind, k, text); this.last.set(k, text); n++;
      if (was === undefined) onNew?.(k, v);
    }
    return n;
  }
}

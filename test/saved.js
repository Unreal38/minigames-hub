// Tests look at (and sometimes change) what the server saved. Since the database switch that lives in
// DATA_DIR/zatoka.db; before the server's first start a test can still seed data by writing cozy-table.json or
// pet-farm.json, which the server copies over at its first start (exactly what happens on a real site).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const emit = process.emitWarning;
process.emitWarning = function (w, ...a) { if (/SQLite/.test(String(w?.message ?? w))) return; return emit.call(this, w, ...a); };
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
process.emitWarning = emit;

const dbFile = dir => path.join(dir, 'zatoka.db');
const withDb = (dir, f) => { const d = new DatabaseSync(dbFile(dir)); try { d.exec('PRAGMA busy_timeout = 5000'); return f(d); } finally { d.close(); } };
const kindRows = (d, kind) => Object.fromEntries(d.prepare('SELECT id, v FROM rows WHERE kind = ?').all(kind).map(r => [r.id, JSON.parse(r.v)]));
const kv = (d, k) => { const r = d.prepare('SELECT v FROM kv WHERE k = ?').get(k); return r ? JSON.parse(r.v) : undefined; };

// The accounts file as one object, the shape cozy-table.json had: { profiles, sessions, visitors, rooms, kofi, gone }.
export function readSaved(dir) {
  if (!fs.existsSync(dbFile(dir))) return JSON.parse(fs.readFileSync(path.join(dir, 'cozy-table.json'), 'utf8'));
  return withDb(dir, d => ({ v: 1, profiles: kindRows(d, 'p'), sessions: kindRows(d, 's'), visitors: Object.keys(kindRows(d, 'v')),
    rooms: kv(d, 'rooms') || [], kofi: kv(d, 'kofi'), gone: kv(d, 'gone') || [] }));
}
// Everything saved about players, as text (for "this was never saved" checks).
export const savedText = dir => JSON.stringify(readSaved(dir)) + (fs.existsSync(dbFile(dir)) ? JSON.stringify(readFarms(dir)) : '');
// Replaces the saved accounts (the server must be stopped).
export function writeSaved(dir, data) {
  if (!fs.existsSync(dbFile(dir))) { fs.writeFileSync(path.join(dir, 'cozy-table.json'), JSON.stringify(data)); return; }
  withDb(dir, d => {
    d.exec('BEGIN');
    d.exec("DELETE FROM rows WHERE kind IN ('p', 's', 'v')");
    const put = d.prepare('INSERT INTO rows (kind, id, v) VALUES (?, ?, ?)'), putKv = d.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v');
    for (const [id, p] of Object.entries(data.profiles || {})) put.run('p', id, JSON.stringify(p));
    for (const [id, s] of Object.entries(data.sessions || {})) put.run('s', id, JSON.stringify(s));
    for (const v of data.visitors || []) put.run('v', v, '1');
    for (const k of ['rooms', 'kofi', 'gone']) if (data[k] !== undefined) putKv.run(k, JSON.stringify(data[k]));
    d.exec('COMMIT');
  });
}
// Pet Farm's saved farms, the shape pet-farm.json had: { farms }.
export function readFarms(dir) {
  if (!fs.existsSync(dbFile(dir))) return JSON.parse(fs.readFileSync(path.join(dir, 'pet-farm.json'), 'utf8'));
  return withDb(dir, d => ({ v: 1, farms: kindRows(d, 'f') }));
}

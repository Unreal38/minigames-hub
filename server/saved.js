// For the host commands (reset-password, delete-account, supporter): the saved accounts, read without changing
// anything, from zatoka.db once the server has moved to it, or from cozy-table.json before that.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export function savedProfiles(dir) {
  const file = path.join(dir, 'zatoka.db');
  if (fs.existsSync(file)) {
    const emit = process.emitWarning;
    process.emitWarning = function (w, ...a) { if (/SQLite/.test(String(w?.message ?? w))) return; return emit.call(this, w, ...a); };
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
    process.emitWarning = emit;
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      db.exec('PRAGMA busy_timeout = 5000');
      if (db.prepare("SELECT v FROM kv WHERE k = 'imported'").get())
        return { profiles: Object.fromEntries(db.prepare("SELECT id, v FROM rows WHERE kind = 'p'").all().map(r => [r.id, JSON.parse(r.v)])) };
    } finally { db.close(); sameOwner(dir); }
  }
  return JSON.parse(fs.readFileSync(path.join(dir, 'cozy-table.json'), 'utf8'));
}

// The host commands run with sudo. If SQLite made its side files (-wal, -shm) as root, the server (user cozy) could
// no longer write to its own database, so they are handed back to the database file's owner.
export function sameOwner(dir) {
  try {
    const st = fs.statSync(path.join(dir, 'zatoka.db'));
    for (const x of ['-wal', '-shm']) { const f = path.join(dir, 'zatoka.db' + x); try { const s = fs.statSync(f); if (s.uid !== st.uid || s.gid !== st.gid) fs.chownSync(f, st.uid, st.gid); } catch {} }
  } catch {}
}

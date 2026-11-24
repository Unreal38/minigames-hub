// A consistent copy of the saved data, safe to take while the server runs (a plain copy of a live database file can
// catch it halfway through a save).
//   cd /opt/cozy-table && sudo DATA_DIR=/var/lib/cozy-table npm run backup            -> DATA_DIR/backups/zatoka-<date>.db
//   cd /opt/cozy-table && sudo DATA_DIR=/var/lib/cozy-table npm run backup -- ~/z.db  -> that file
// To restore: stop the server, put the copy in place as DATA_DIR/zatoka.db (remove zatoka.db-wal and -shm), start it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
if (!fs.existsSync(path.join(DIR, 'zatoka.db'))) { console.error(`No zatoka.db in ${DIR}. Set DATA_DIR to the folder the server uses.`); process.exit(1); }
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const to = path.resolve(process.argv[2] || path.join(DIR, 'backups', `zatoka-${stamp}.db`));
if (fs.existsSync(to)) { console.error(`${to} already exists.`); process.exit(1); }
fs.mkdirSync(path.dirname(to), { recursive: true });
const db = await import('./db.js');
const { sameOwner } = await import('./saved.js');
try { db.open(DIR); db.backup(to); } finally { db.close(); sameOwner(DIR); }
try { const st = fs.statSync(path.join(DIR, 'zatoka.db')); fs.chownSync(to, st.uid, st.gid); } catch {}
console.log(`Saved a copy to ${to} (${(fs.statSync(to).size / 1e6).toFixed(1)} MB).`);

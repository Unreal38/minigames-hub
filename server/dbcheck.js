// Dry run of the move to the database, on a copy: nothing the server uses is changed, and the server can keep running.
//   cd /opt/cozy-table && sudo DATA_DIR=/var/lib/cozy-table npm run db-check
// It copies cozy-table.json and pet-farm.json to a temporary folder, lets the real server code move that copy into a
// fresh database exactly as it would at its first start, reads every account, guest, farm and visitor back, and
// prints the counts and whether everything matched. The temporary folder is deleted at the end.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
if (fs.existsSync(path.join(SRC, 'zatoka.db'))) {
  console.log(`${SRC} already has zatoka.db: the server has already moved to the database. Nothing to check.`);
  process.exit(0);
}
const files = ['cozy-table.json', 'pet-farm.json'].filter(f => fs.existsSync(path.join(SRC, f)));
if (!files.length) { console.error(`No cozy-table.json or pet-farm.json in ${SRC}. Set DATA_DIR to the folder the server uses.`); process.exit(1); }
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zatoka-check-'));
for (const f of files) fs.copyFileSync(path.join(SRC, f), path.join(TMP, f));
process.env.DATA_DIR = TMP; delete process.env.STORE;

let bad = false;
try {
  const raw = f => { try { return JSON.parse(fs.readFileSync(path.join(TMP, f), 'utf8')); } catch { return {}; } };
  const before = raw('cozy-table.json'), farmsBefore = raw('pet-farm.json');
  const store = await import('./store.js');
  const farm = await import('./farm.js');
  const db = await import('./db.js');
  const rooms = store.load();
  const why0 = store.storeMode() === 'db' ? store.checkDb(rooms) : ''; // before Pet Farm loads (it fills in each owner's album count)
  farm.load();
  const p = Object.values(before.profiles || {});
  console.log('\nIn the JSON files:');
  console.log(`  accounts ${p.filter(x => x.user).length}, guests ${p.filter(x => !x.user).length}, browser sessions ${Object.keys(before.sessions || {}).length}, farms ${Object.keys(farmsBefore.farms || {}).length}, open tables ${(before.rooms || []).length}`);
  console.log(`  visitors so far (the number on the hub): ${store.visitorCount()}`);
  if (store.storeMode() !== 'db') { bad = true; console.log('\nAccounts did NOT move (see the message above). The server would stay on cozy-table.json, as today.'); }
  else {
    const why = why0;
    const accounts = db.rows('p').map(r => JSON.parse(r.v)).filter(x => x.user).length;
    console.log('\nIn the new database:');
    console.log(`  accounts ${accounts}, profiles ${db.count('p')}, browser sessions ${db.count('s')}, farms ${db.count('f')}, visitors ${db.count('v')}`);
    if (why) { bad = true; console.log(`\nMISMATCH: ${why}`); }
    if (farm.farmMode() !== 'db') { bad = true; console.log('\nFarms did NOT move (see the message above). They would stay on pet-farm.json, as today.'); }
    if (accounts !== p.filter(x => x.user).length) { bad = true; console.log('\nMISMATCH: the number of accounts differs.'); }
  }
  console.log(bad ? '\nRESULT: something did not match. Do not update; send this output to Claude.' : '\nRESULT: everything matched, every account, guest, farm and visitor, field by field. Safe to update.');
} catch (e) { bad = true; console.error('\nThe check failed:', e); }
finally { fs.rmSync(TMP, { recursive: true, force: true }); }
process.exit(bad ? 1 : 0);

// Deletes a player's account when they ask for it (the privacy page tells people how). Run it on the server machine:
//   npm run delete-account -- <username>
// With the systemd unit: cd /opt/cozy-table && sudo DATA_DIR=/var/lib/cozy-table npm run delete-account -- <username>
// It cannot be undone: the account, its coins, items, scores, friends, Pet Farm and hub chat lines all go, and every
// device signed in to it becomes a guest. It leaves a small file in the data folder; the running server picks it up
// within a few seconds. Older copies of the data in your own backups (if you keep any) are not touched.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
const user = String(process.argv[2] || '').trim();
if (!user) { console.error('Usage: npm run delete-account -- <username>'); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8')); }
catch (e) { console.error(`Could not read the saved accounts in ${DATA_DIR} (${e.message}). Set DATA_DIR to the folder the server uses.`); process.exit(1); }
const p = Object.values(data.profiles || {}).find(x => x.user && x.user.toLowerCase() === user.toLowerCase());
if (!p) { console.error(`There is no account called "${user}". Usernames are shown at the top of each player's Friends list.`); process.exit(1); }

fs.writeFileSync(path.join(DATA_DIR, `delete-${crypto.randomBytes(6).toString('hex')}.json`), JSON.stringify({ user: p.user }));
console.log(`Account ${p.user} will be deleted within a few seconds. Check with: journalctl -u cozy-table -n 5`);

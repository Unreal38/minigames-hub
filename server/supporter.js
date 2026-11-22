// Gives a player the Supporter pack by hand, for the odd case Ko-fi's own message did not reach the server
// (or a friend supported the site some other way). Run it on the machine the server runs on:
//   npm run supporter -- <username>
// With the systemd unit: cd /opt/cozy-table && sudo DATA_DIR=/var/lib/cozy-table npm run supporter -- <username>
// It leaves a small file in the data folder; the running server picks it up within a few seconds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
const user = String(process.argv[2] || '').trim();
if (!user) { console.error('Usage: npm run supporter -- <username>'); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8')); }
catch (e) { console.error(`Could not read the saved accounts in ${DATA_DIR} (${e.message}). Set DATA_DIR to the folder the server uses.`); process.exit(1); }
const p = Object.values(data.profiles || {}).find(x => x.user && x.user.toLowerCase() === user.toLowerCase());
if (!p) { console.error(`There is no account called "${user}". Usernames are shown at the top of each player's Friends list.`); process.exit(1); }

fs.writeFileSync(path.join(DATA_DIR, `supporter-${crypto.randomBytes(6).toString('hex')}.json`), JSON.stringify({ user: p.user }));
console.log(`Supporter pack queued for ${p.user}. The server hands it over within a few seconds.`);

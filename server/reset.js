// Makes a one-time password reset code for a player who forgot their password and lost their recovery code.
// Run it on the machine the server runs on:
//   npm run reset-password -- <username>
// With the systemd unit: cd /opt/cozy-table && sudo DATA_DIR=/var/lib/cozy-table npm run reset-password -- <username>
// It prints a code to send the player (a private message is best). They open the site, choose Log in, then
// "Forgot your password?", and type their username, the code and a new password. The code works once, for 24 hours.
// Only a hash of the code is written down, in a small file the running server picks up within a few seconds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // same alphabet as store.js
const user = String(process.argv[2] || '').trim();
if (!user) { console.error('Usage: npm run reset-password -- <username>'); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8')); }
catch (e) { console.error(`Could not read the saved accounts in ${DATA_DIR} (${e.message}). Set DATA_DIR to the folder the server uses.`); process.exit(1); }
const p = Object.values(data.profiles || {}).find(x => x.user && x.user.toLowerCase() === user.toLowerCase());
if (!p) { console.error(`There is no account called "${user}". Usernames are shown at the top of each player's Friends list.`); process.exit(1); }

const code = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(32)]).join('')).join('-');
const h = crypto.createHash('sha256').update(code.replace(/-/g, '')).digest('hex');
fs.writeFileSync(path.join(DATA_DIR, `reset-${crypto.randomBytes(6).toString('hex')}.json`), JSON.stringify({ user: p.user, h, exp: Date.now() + 24 * 3600_000 }));
console.log(`\nReset code for ${p.user}:  ${code}\n
Send it to them privately. On the site they choose Log in, then "Forgot your password?",
and enter their username, this code and a new password. It works once, for the next 24 hours.
(Give the server a few seconds to pick it up.)\n`);

// Sends a gift to every Pet Farm player. Run it on the machine the server runs on:
//   npm run gift -- wood=50 coins=20 "Happy weekend!"
// It leaves a small file in the data folder; the running server picks it up within a few seconds and puts the gift
// in every Mailbox, including those of players who are offline. Set DATA_DIR if the server uses one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATS } from '../public/games/farm/data.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data'));
const mats = {}, words = [];
for (const arg of process.argv.slice(2)) {
  const m = /^([a-z]+)=(\d+)$/.exec(arg);
  if (!m) { words.push(arg); continue; }
  if (!MATS[m[1]]) { console.error(`Unknown material "${m[1]}". Use: ${Object.keys(MATS).join(', ')}`); process.exit(1); }
  mats[m[1]] = +m[2];
}
if (!Object.keys(mats).length) { console.error('Usage: npm run gift -- wood=50 coins=20 "A short message"\nMaterials: ' + Object.keys(MATS).join(', ')); process.exit(1); }
if (!fs.existsSync(DATA_DIR)) { console.error(`No data folder at ${DATA_DIR}. Set DATA_DIR to the one the server uses.`); process.exit(1); }
fs.writeFileSync(path.join(DATA_DIR, 'gift-all.json'), JSON.stringify({ mats, text: words.join(' ') }));
console.log(`Gift queued in ${DATA_DIR}: ${Object.entries(mats).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ')}. The server delivers it within a few seconds.`);

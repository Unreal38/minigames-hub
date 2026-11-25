// In-match reactions: a sticker from a bought pack (k 12 and up, cosmetics.js STICKER_BASE) must show as itself in every
// game. reactHtml() already keeps k in range, so a game must pass m.k straight in. A static check over every game
// (older games capped k at 11, which turned every sticker into the last free emoji, 🔥), plus reactHtml itself.
import fs from 'node:fs';
import path from 'node:path';
import { reactHtml, EMOJI, FOODS } from '../public/react.js';
import { STICKERS, STICKER_BASE } from '../public/cosmetics.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const root = path.join(import.meta.dirname, '..', 'public', 'games');
let n = 0;
for (const g of fs.readdirSync(root)) {
  const f = path.join(root, g, 'client.js'); if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const line of src.split('\n')) {
    if (!line.includes('reactHtml(')) continue; n++;
    if (/reactHtml\(\s*Math\.(min|max)/.test(line)) fail(`games/${g}/client.js: "${line.trim().slice(0, 90)}" caps k, so stickers from packs show as the wrong emoji; pass m.k straight in`);
  }
}
EMOJI.forEach((e, i) => { if (!reactHtml(FOODS.length + i).includes(e)) fail(`free emoji ${i} shows as ${reactHtml(FOODS.length + i)}`); });
STICKERS.forEach((s, j) => { if (!reactHtml(STICKER_BASE + j).includes(s.e)) fail(`sticker ${j} (${s.e}) shows as ${reactHtml(STICKER_BASE + j)}`); });
console.log(`ok reacts: ${n} reactHtml calls in games, ${EMOJI.length} free emoji and ${STICKERS.length} stickers show as themselves`);

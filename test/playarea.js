// Name tags keep off the play area (Kuba, 2026-11-28): every game whose board or table is clicked tells the tag
// placer where that is each frame (public/nametag.js playArea). This fails if one of them stops doing it.
import { readFileSync } from 'node:fs';
const GAMES = ['chess', 'warcaby', 'ttt', 'dice', 'pm', 'bingo', 'makao', 'pan', 'parade', 'piotr', 'tys', 'wojna', 'pips', 'domino', 'poker', 'pairs', 'herd', 'reef', 'cove', 'ludo', 'bierki', 'pool', 'darts', 'dig'];
const bad = [];
for (const g of GAMES) {
  const s = readFileSync(new URL(`../public/games/${g}/scene3d.js`, import.meta.url), 'utf8');
  if (!/import \{[^}]*\bplayArea\b[^}]*\} from '\.\.\/\.\.\/nametag\.js'/.test(s) || !/\bplayArea\(camera,/.test(s)) bad.push(g);
}
const tag = readFileSync(new URL('../public/nametag.js', import.meta.url), 'utf8');
if (!/overPlay\(R, Z\)/.test(tag)) bad.push('nametag.js: the placer no longer scores the play area');
if (bad.length) { console.error('play area missing:', bad.join(', ')); process.exit(1); }
console.log(`playarea ok (${GAMES.length} games)`);

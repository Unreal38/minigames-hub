// Win effects in games: every success shower must be the player's own win effect from the Wardrobe (cosmetics.js, kind
// wn), never plain confetti. A static check over every game, so a new game cannot skip the shared helpers:
//  - 3D showers (createFx().confetti in scenery3d.js) must name whose moment it is: { s: seat } or { s: 'me' }
//  - a game's own 2D confetti() must start with myBurst(), and confetti(false) (someone else's moment) only after
//    seatBurst(seat) found they have no effect on
//  - confetti-strip bursts (shape CONF) are only allowed for the small pops listed in POPS below
import fs from 'node:fs';
import path from 'node:path';
import { setSeatFx, setMyFx, fxOf, myBurst, seatBurst } from '../public/winfx.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const root = path.join(import.meta.dirname, '..', 'public');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })(root);
const rel = p => path.relative(root, p);
// the text of a call's arguments, from the opening bracket to its partner
const argsAt = (src, open) => { let d = 0; for (let i = open; i < src.length; i++) { if (src[i] === '(') d++; else if (src[i] === ')' && !--d) return src.slice(open + 1, i); } return ''; };
const lineOf = (src, i) => src.slice(0, i).split('\n').length;
// Small pops that use confetti bits but are not a success shower (an item box, wood chips, a ball dropping in a pocket...)
const POPS = new Set(['games/kart/scene3d.js', 'games/ladders/scene3d.js', 'games/pool/scene3d.js', 'games/darts/scene3d.js', 'games/golf/scene3d.js', 'hero3d.js']);
let showers = 0, own = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8'), name = rel(f);
  if (name === 'scenery3d.js' || name === 'winfx.js' || name === 'fxart.js') continue;
  // 3D showers
  for (const m of src.matchAll(/\.confetti\(/g)) {
    const a = argsAt(src, m.index + m[0].length - 1); showers++;
    if (!/\bs\s*[:,}]|\bs\s*\}/.test(a.replace(/'[^']*'/g, "''"))) fail(`${name}:${lineOf(src, m.index)} a 3D confetti shower must pass s (the seat, or 'me') so it becomes that player's win effect: .confetti(${a})`);
  }
  // 2D confetti in a game client
  const def = src.match(/function confetti\(([^)]*)\)\s*\{\s*([^\n]*)/);
  if (def) { own++;
    if (!/myBurst\(\)/.test(def[2])) fail(`${name}: function confetti() must start with "if (own && myBurst()) return;" so the player's own win effect replaces it`);
    if (!/import \{[^}]*\bmyBurst\b[^}]*\} from '[./]*winfx\.js'/.test(src)) fail(`${name}: imports confetti but not myBurst from winfx.js`);
  }
  for (const m of src.matchAll(/(?<![.\w])confetti\(([^)]*)\)/g)) {
    if (m[0].startsWith('confetti(own')) continue; // the definition
    const arg = m[1].trim(), line = src.split('\n')[lineOf(src, m.index) - 1];
    if (arg === '' || arg === 'true') continue;
    if (arg === 'false' && /seatBurst\(/.test(line)) continue;
    fail(`${name}:${lineOf(src, m.index)} confetti(${arg}): call confetti() for the viewer's own moment, or "if (!seatBurst(seat)) confetti(false)" for someone else's`);
  }
  if (/shape:\s*\[?[^\]}]*\bCONF\b/.test(src) && !POPS.has(name)) fail(`${name}: a burst of confetti bits (shape CONF) is a shower: use fx.confetti(p, { s }) instead, or add a small pop to POPS in test/winfx.js`);
}
if (showers < 30 || own < 25) fail(`the check found too few showers (${showers}) or game confetti() functions (${own}): has the code moved?`);

// the helpers themselves (no document here, so nothing is drawn)
setSeatFx([0, 6, 99]); setMyFx(6);
if (fxOf(0) !== 0 || fxOf(1) !== 6 || fxOf(2) !== 0 || fxOf('me') !== 6) fail('fxOf: each seat\'s own effect, unknown ones count as none');
if (myBurst() !== true || seatBurst(1) !== true || seatBurst(0) !== false || seatBurst(5) !== false) fail('myBurst/seatBurst: true only when that player has an effect on');
setMyFx(0); if (myBurst() !== false) fail('myBurst: false with no effect on (the game draws its own confetti)');
console.log(`ok winfx: ${showers} in-game showers and ${own} game confetti() functions use the players' win effects`);

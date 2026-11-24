// Pressing UI buttons or playing a card must not make the 3D camera jump (Kuba, 2026-11-24).
// Every scene that re-frames the table for HUD panels has to go through hudFitOk from public/camfit.js.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'public', 'games');
let bad = 0, seen = 0;
for (const g of fs.readdirSync(dir)) {
  const f = path.join(dir, g, 'scene3d.js'); if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!/^\s+set(Hud|Inset)\(/.test(line) || !/resize\(/.test(line)) continue;
    seen++;
    if (!line.includes('hudFitOk(canvas)')) { bad++; console.error(`${g}/scene3d.js re-fits the camera on a HUD change without hudFitOk:\n  ${line.trim()}`); }
  }
}
if (!fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8').includes("import './camfit.js'")) { bad++; console.error('app.js must import camfit.js before the games'); }
if (bad || !seen) { console.error(bad ? `${bad} camera fit problem(s)` : 'no HUD setters found'); process.exit(1); }
console.log(`camfit ok (${seen} HUD setters gated)`);

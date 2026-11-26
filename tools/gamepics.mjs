// Draws the picture of every game page (public/gamepics/<id>.jpg, 1200x630, and <id>-s.jpg, 480x252) from the hub's
// own card art (public/gameart.js + style.css), so a search result or a shared link shows that game's card.
// Run it after adding a game or changing its card art:  node tools/gamepics.mjs   (needs Playwright with Chromium)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { allGames } from '../server/gamepages.js';

const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
const PUB = path.resolve('public'), OUT = path.join(PUB, 'gamepics');
fs.mkdirSync(OUT, { recursive: true });
const app = fs.readFileSync(path.join(PUB, 'app.js'), 'utf8');
const hub = app.slice(app.indexOf('const HUB_GAMES = ['), app.indexOf('].filter(g => GAMES[g[0]])'));
const PIC = Object.fromEntries([...hub.matchAll(/\['(\w+)', '([^']*)', (\w+),/g)].map(m => [m[1], [m[2], m[3]]]));
const ICON = { farm: 'FARM_ICON', mp: 'MYSTERY_ICON', word: 'WORD_ICON', pop: 'POP_ICON', mj: 'MJ_ICON', hay: 'HAY_ICON' };
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };

const HARNESS = `<!doctype html><html><head><link rel="stylesheet" href="/style.css"><style>
html, body { margin: 0; background: transparent; } body.sky { min-height: 0; }
* { animation: none !important; transition: none !important; }
#box { width: 320px; height: 168px; position: relative; overflow: hidden; }
#box .gcard { all: unset; display: block; width: 100%; height: 100%; }
#box .gcard .pic { height: 100%; border: 0 !important; border-radius: 0 !important; }
#box .solo { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #8fd6f7, #e3f5ff); }
#box .solo svg { width: 132px; height: 132px; filter: drop-shadow(0 6px 0 #0002); }
</style></head><body class="sky"><div id="box"></div>
<script type="module">
import * as A from '/gameart.js';
window.draw = (pic, art, icon) => { document.getElementById('box').innerHTML = icon ? '<div class="solo">' + A[icon] + '</div>' : '<div class="gcard"><div class="pic ' + pic + '">' + A[art]() + '</div></div>'; };
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch();
for (const [w, suffix] of [[1200, ''], [480, '-s']]) {
  const page = await browser.newPage({ viewport: { width: 320, height: 168 }, deviceScaleFactor: w / 320 });
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/__pics.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const f = path.join(PUB, path.normalize(u.pathname));
    if (!f.startsWith(PUB) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto('http://pics.local/__pics.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => document.fonts.ready);
  for (const g of allGames()) {
    const [pic, art] = PIC[g.id] || [];
    if (!art && !ICON[g.id]) { console.log('no art for', g.id); continue; }
    await page.evaluate(([p, a, i]) => window.draw(p, a, i), [pic, art, art ? null : ICON[g.id]]);
    await page.waitForTimeout(50);
    await page.locator('#box').screenshot({ path: path.join(OUT, `${g.id}${suffix}.jpg`), type: 'jpeg', quality: suffix ? 80 : 84 });
  }
  await page.close();
}
await browser.close();
console.log('game pictures in', OUT);

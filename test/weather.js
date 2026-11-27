// The hub and the games show the same weather as Pet Farm (weather3d.js, Kuba 2026-11-24): every kind needs a look,
// and every game scene that registers for night mode gets the weather with it.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url)), pub = path.join(__dirname, '..', 'public');
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { WEATHER, WX_LOOK, weatherAt, skyPhase, isNight } = await import('../public/weather.js');
let bad = 0; const fail = m => { bad++; console.error(m); };
for (const k of Object.keys(WEATHER)) if (!WX_LOOK[k]) fail(`WX_LOOK has no look for weather kind ${k}`);
for (let t = 0; t < 50; t++) if (!WX_LOOK[weatherAt(t * 40 * 60_000).kind]) fail('weatherAt gave a kind without a look');
const scen = fs.readFileSync(path.join(pub, 'scenery3d.js'), 'utf8');
if (!/onWeather\(wxScenes\)/.test(scen) || !/weatherLayer\(scene/.test(scen)) fail('scenery3d.js nightScene must repaint scenes for the weather');
if (!/weatherLayer\(scene/.test(fs.readFileSync(path.join(pub, 'hero3d.js'), 'utf8'))) fail('the hub hero isle must show the weather');
const app = fs.readFileSync(path.join(pub, 'app.js'), 'utf8'), css = fs.readFileSync(path.join(pub, 'style.css'), 'utf8');
if (!/function paintSkyWx/.test(app)) fail('app.js must paint the hub sky for the weather');
for (const k of Object.keys(WEATHER)) if (k !== 'sunny' && !css.includes('.wx-' + k)) fail(`style.css has no hub sky for ${k}`);
// weather3d must never touch render resolution (graphics rule: cut effects, never pixels)
if (/setPixelRatio|setSize/.test(fs.readFileSync(path.join(pub, 'weather3d.js'), 'utf8'))) fail('weather3d.js must not change render resolution');
// dusk and dawn (Kuba, 2026-11-26): the sky never jumps; full day at noon, full night at midnight, a glow in between
{ const p = h => skyPhase(h);
  if (p(12).n !== 0 || p(12).g !== 0 || p(0).n !== 1 || p(23).g !== 0) fail('skyPhase: noon must be full day and midnight full night');
  if (!(p(19.8).g > .9 && p(6.1).g > .9)) fail('skyPhase: dusk and dawn must glow');
  let worst = 0; for (let m = 1; m < 24 * 60; m++) { const a = p((m - 1) / 60), b = p(m / 60); worst = Math.max(worst, Math.abs(a.n - b.n), Math.abs(a.g - b.g)); }
  if (worst > .03) fail(`skyPhase jumps ${worst.toFixed(3)} in a minute`);
  for (const h of [1, 4, 21.2, 23]) if (!isNight(h) || p(h).n < .99) fail(`skyPhase and isNight disagree at ${h}`); }
if (bad) process.exit(1);
console.log('weather ok');

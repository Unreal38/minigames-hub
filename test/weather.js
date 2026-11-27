// The hub and the games show the same weather as Pet Farm (weather3d.js, Kuba 2026-11-24): every kind needs a look,
// and every game scene that registers for night mode gets the weather with it.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url)), pub = path.join(__dirname, '..', 'public');
process.env.TZ = 'Europe/Warsaw'; // the sun checks below read Polish clock times
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { WEATHER, WX_LOOK, weatherAt, skyPhase, isNight, sunTimes, sunHour } = await import('../public/weather.js');
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
// real sunrise and sunset (Kuba, 2026-11-27): a late-November 17:40 is night, a June 20:30 still day
{ const at = (s, t) => new Date(`${s}T${t}`), near = (a, b) => Math.abs(a - b) < .15;
  const nov = sunTimes(at('2026-11-27', '12:00')), jun = sunTimes(at('2026-06-21', '12:00'));
  if (!near(nov.rise, 7.37) || !near(nov.set, 15.63)) fail(`sunTimes 27 Nov is ${nov.rise.toFixed(2)}-${nov.set.toFixed(2)}`);
  if (!near(jun.rise, 4.35) || !near(jun.set, 21.1)) fail(`sunTimes 21 Jun is ${jun.rise.toFixed(2)}-${jun.set.toFixed(2)}`);
  if (!isNight(sunHour(at('2026-11-27', '17:40'))) || skyPhase(sunHour(at('2026-11-27', '12:00'))).n !== 0) fail('November: 17:40 must be night, noon day');
  if (isNight(sunHour(at('2026-06-21', '20:30'))) || !isNight(sunHour(at('2026-06-21', '23:30')))) fail('June: 20:30 must be day, 23:30 night');
  for (const day of ['2026-11-27', '2026-03-29', '2026-06-21', '2026-10-25']) { let prev, worst = 0;
    for (let m = 0; m <= 1440; m++) { const p = skyPhase(sunHour(new Date(at(day, '00:00').getTime() + m * 6e4))); if (prev) worst = Math.max(worst, Math.abs(p.n - prev.n), Math.abs(p.g - prev.g)); prev = p; }
    if (worst > .035) fail(`the real-sun sky jumps ${worst.toFixed(3)} in a minute on ${day}`); } }
// the aurora (Kuba, 2026-11-27): only on winter nights in Poland, a couple of spells a night, never by day or in summer;
// eggs laid under it are twice as likely to be element variants
{ const { darkAt } = await import('../public/weather.js'), W = 40 * 60_000, at = (s, t) => new Date(`${s}T${t}`); let win = 0, nights = 0;
  for (let ms = Date.UTC(2026, 10, 16); ms < Date.UTC(2027, 1, 28); ms += W) { const k = weatherAt(ms).kind; if (k !== 'aurora') continue; win++;
    if (!darkAt(ms + W / 2)) fail('an aurora spell came in daylight at ' + new Date(ms).toISOString()); }
  for (let ms = Date.UTC(2027, 3, 1); ms < Date.UTC(2027, 10, 14); ms += W) if (weatherAt(ms).kind === 'aurora') nights++;
  if (nights) fail(`${nights} aurora spells outside winter`);
  const per = win / 104; if (per < 1 || per > 4.5) fail(`about ${per.toFixed(1)} aurora spells a winter night, want 1 to 4.5`);
  for (const h of [12, 13]) if (darkAt(at('2026-12-21', h + ':00').getTime())) fail('darkAt says it is dark at ' + h + ':00 in December');
  if (!darkAt(at('2026-12-21', '23:00').getTime())) fail('darkAt says it is light at 23:00 in December');
  const { variantOdds } = await import('../public/games/farm/breed.js'), a = { sp: 'mossbun' }, b = { sp: 'cindercub' };
  const o0 = variantOdds('mossbun', a, b), o1 = variantOdds('mossbun', a, b, { aur: true });
  if (!o0.length || o1.some(([, c], i) => Math.abs(c - o0[i][1] * 2) > 1e-9)) fail('an aurora must double the element variant chance'); }
if (bad) process.exit(1);
console.log('weather ok');

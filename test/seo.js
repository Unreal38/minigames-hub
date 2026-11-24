// Search basics: robots.txt, sitemap, Polish page for bots, English swap for English visitors, CSP still holds.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'));
const srv = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT, GEO: 'off', DATA_DIR: dir, HOST: '127.0.0.1' }, stdio: 'inherit' });
const base = `http://127.0.0.1:${PORT}`;
const get = async (p, headers = {}) => { const r = await fetch(base + p, { headers }); return { r, text: await r.text() }; };
try {
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

  const robots = await get('/robots.txt');
  assert.equal(robots.r.status, 200); assert.match(robots.r.headers.get('content-type'), /text\/plain/);
  assert.match(robots.text, /Sitemap: https:\/\/zatokagier\.com\/sitemap\.xml/);
  const map = await get('/sitemap.xml');
  assert.equal(map.r.status, 200); assert.match(map.r.headers.get('content-type'), /application\/xml/);
  assert.match(map.text, /<loc>https:\/\/zatokagier\.com\/<\/loc>/);
  for (const f of ['/og-image.png', '/og-square.png', '/logo-512.png', '/favicon.ico', '/apple-touch-icon.png', '/icon-192.png', '/favicon.svg']) assert.equal((await get(f)).r.status, 200, f);

  const bot = await get('/', { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'accept-language': 'en-US' });
  assert.match(bot.text, /<html lang="pl" data-geo="pl"/);
  assert.match(bot.text, /<title>Zatoka Gier: darmowe gry online ze znajomymi<\/title>/);
  assert.match(bot.text, /<link rel="canonical" href="https:\/\/zatokagier\.com\/">/);
  assert.match(bot.text, /og:image" content="https:\/\/zatokagier\.com\/og-image\.png"/);
  assert.equal((bot.text.match(/property="og:image"/g) || []).length, 1, "only one og:image, or Discord shows several pictures");
  assert.match(bot.text, /<h1>Zatoka Gier<\/h1>/);
  assert.match(bot.text, /Postępy, które zostają/);
  const ld = JSON.parse(bot.text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(ld['@graph'].some(n => n.primaryImageOfPage?.url === 'https://zatokagier.com/og-square.png'));

  // Every hub game is listed with its Polish name, description, players and playtime, plus the Today games.
  const { readRegistry } = await import('../server/gamelist.js');
  const reg = readRegistry();
  assert.ok(reg.games.length >= 35, `only ${reg.games.length} games read from app.js`);
  const hubIds = [...fs.readFileSync('public/app.js', 'utf8').split('const HUB_GAMES = [')[1].split('].filter(')[0].matchAll(/^\s*\['(\w+)'/gm)].map(m => m[1]);
  assert.deepEqual(reg.games.map(g => g.id), hubIds, 'every HUB_GAMES row must be readable by server/gamelist.js');
  for (const g of reg.games) {
    assert.match(bot.text, new RegExp(`<li id="g-${g.id}"><b>[^<]+</b>: [^<]{20,} <small>Gracze: \\d`), g.id);
    assert.ok(g.mins && g.pitch, g.id);
  }
  for (const n of ['Szachy', 'Makao', 'Kalambury', 'Bierki', 'Farma zwierzaków', 'Zagadkowy zwierzak', 'Słowo w butelce', 'Zwierzakowy mahjong']) assert.ok(bot.text.includes(`<b>${n}</b>`), n);
  assert.match(bot.text, /W Zatoce jest \d+ gier przy stole/);
  const games = JSON.parse(bot.text.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"ItemList"[\s\S]*?)<\/script>/)[1]);
  assert.equal(games.itemListElement.length, reg.games.length + 7);

  const en = await get('/', { 'user-agent': 'Mozilla/5.0 Firefox/130', 'accept-language': 'en-GB,en' });
  assert.match(en.text, /<html lang="en" data-geo="en"/);
  assert.match(en.text, /<title>Zatoka Gier: free online games with friends<\/title>/);
  assert.match(en.text, /Free browser games to play with friends\. Host a table/);
  assert.match(en.text, /og:locale" content="en_GB"/);
  assert.match(en.text, /Progress that stays/);
  assert.match(en.text, /Tables are public by default/);
  assert.match(bot.text, /Stoły są domyślnie publiczne/);
  assert.doesNotMatch(en.text, /Postępy/);
  assert.match(en.text, /<li id="g-chess"><b>Chess<\/b>: Classic chess/);
  assert.match(en.text, /Players: 1–4 \(co-op\)/);
  assert.match(en.text, /<b>Pet Farm<\/b>/);
  assert.doesNotMatch(en.text, /Gracze:|Wszystkie gry/);
  assert.doesNotMatch(en.text, /darmowe|Darmowe|przeglądarce/);

  const pl = await get('/', { 'user-agent': 'Mozilla/5.0 Firefox/130', 'accept-language': 'pl-PL,pl' });
  assert.match(pl.text, /<html lang="pl"/); assert.match(pl.text, /Darmowe gry w przeglądarce/);

  // The CSP must still allow the import map (and only it, by hash) after the swap.
  const csp = en.r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/ 'sha256-/);
  assert.equal((await get('/nope')).r.status, 404);
  console.log('seo ok');
} finally { srv.kill(); }

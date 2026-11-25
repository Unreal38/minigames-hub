// The two languages: the server's guess (Poland gets Polish), the saved pick on the account, and that the Polish
// texts cover everything they should (every game, every table setting, every wardrobe item, the server's messages).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.CT_LANG = 'pl'; process.env.GEO = 'off'; // read the Polish side of every text in this process
const PORT = 24080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
process.env.DATA_DIR = DATA_DIR;
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); };

// ----- where a visitor is from -----
const geo = await import('../server/geo.js');
ok(geo.inPoland('5.8.1.1') === null, 'no list loaded: nothing is known');
ok(geo.langFor('5.8.1.1', 'pl-PL,pl;q=0.9,en;q=0.8') === 'pl' && geo.langFor('5.8.1.1', 'en-US,en;q=0.9,pl;q=0.2') === 'en' && geo.langFor('5.8.1.1') === 'en', 'without a list the browser language decides');
geo.use(geo.parse(`2|ripencc|20261121|1|19830705|20261120|+0100
ripencc|PL|ipv4|5.8.0.0|8192|20111108|allocated
ripencc|DE|ipv4|5.9.0.0|65536|20111108|allocated
ripencc|PL|ipv4|83.0.0.0|2097152|20031209|assigned
ripencc|PL|ipv6|2a01:110::|32|20070207|allocated
ripencc|PL|ipv4|9.9.9.0|256|20200101|reserved
ripencc|PL|asn|1234|1|20000101|allocated`));
for (const [ip, want] of [['5.8.0.0', true], ['5.8.31.255', true], ['5.8.32.0', false], ['5.9.1.1', false], ['83.31.255.255', true], ['83.32.0.0', false], ['::ffff:83.1.2.3', true],
  ['2a01:110:8012::1', true], ['2a01:111::1', false], ['9.9.9.9', false], ['::1', false], ['junk', false], ['', false]]) ok(geo.inPoland(ip) === want, `inPoland(${ip}) should be ${want}`);
ok(geo.langFor('5.8.1.1', 'en-US') === 'pl', 'a Polish address gets Polish');
ok(geo.langFor('5.9.1.1', 'en-US') === 'en' && geo.langFor('5.9.1.1', 'pl') === 'pl', 'elsewhere the browser language decides');

// ----- the page carries the guess, and an account remembers the pick -----
srv = spawn('node', ['server/server.js'], { env: { ...process.env, CT_LANG: '', PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off' }, stdio: 'inherit' });
await wait(700);
const page = async al => { const r = await fetch(`http://127.0.0.1:${PORT}/`, { headers: { 'accept-language': al } }); return { html: await r.text(), etag: r.headers.get('etag'), csp: r.headers.get('content-security-policy') }; };
const pl = await page('pl-PL,pl;q=0.9'), en = await page('en-GB,en;q=0.9');
ok(/<html lang="pl" data-geo="pl">/.test(pl.html), 'a Polish browser gets data-geo="pl"');
ok(/<html lang="en" data-geo="en">/.test(en.html), 'an English browser gets data-geo="en"');
ok(pl.etag && en.etag && pl.etag !== en.etag, 'the two pages must not share a cache tag');
ok(/script-src 'self'/.test(pl.csp || ''), 'the page still has its content security policy');
const again = await fetch(`http://127.0.0.1:${PORT}/`, { headers: { 'accept-language': 'pl', 'if-none-match': pl.etag } });
ok(again.status === 304, 'an unchanged page is not sent twice');
const wrong = await fetch(`http://127.0.0.1:${PORT}/`, { headers: { 'accept-language': 'en', 'if-none-match': pl.etag } });
ok(wrong.status === 200, 'the Polish page must not be reused for an English visitor');

function player(token) {
  const p = { me: null, msgs: [] };
  p.connect = () => new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m)); p.close = () => ws.close();
    ws.onopen = () => p.send({ t: 'hello', token, name: 'Ola', color: '#ff8fab' });
    ws.onmessage = e => { const m = JSON.parse(e.data); p.msgs.push(m); if (m.t === 'welcome') { p.token = m.token; res(); } if (m.t === 'me') p.me = m.me; };
  });
  return p;
}
const a = player(''); await a.connect();
a.send({ t: 'lang', v: 'pl' }); a.send({ t: 'profile', name: 'Ola', color: '#ff8fab', av: null }); await wait(200);
ok(!a.me?.lang, 'a guest keeps the language in the browser only');
a.send({ t: 'register', user: 'ola', pass: 'sekret12' }); await wait(600);
ok(a.me?.user === 'ola', 'registered');
a.send({ t: 'lang', v: 'xx' }); a.send({ t: 'lang', v: 'pl' }); a.send({ t: 'profile', name: 'Ola', color: '#ff8fab', av: null }); await wait(300);
ok(a.me?.lang === 'pl', `the account remembers Polish (got ${a.me?.lang})`);
a.close(); await wait(100);
const b = player(a.token); await b.connect(); await wait(300);
ok(b.me?.lang === 'pl', 'and gives it back on the next visit');
srv.kill();

// ----- the Polish texts -----
const i18n = await import('../public/i18n.js');
ok(i18n.PL && i18n.L('a', 'b') === 'b' && i18n.L('a') === 'a', 'L() picks Polish and falls back to English');
ok(['1 moneta', '2 monety', '5 monet', '12 monet', '22 monety', '112 monet'].join() === [1, 2, 5, 12, 22, 112].map(n => i18n.cnt(n, 'coin', 'coins', 'moneta', 'monety', 'monet')).join(), 'Polish plurals');
const hub = await import('../public/lang/hub-pl.js');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const games = app.slice(app.indexOf('const GAMES = {'), app.indexOf('\nconst PLX'));
const blocks = [...games.matchAll(/^  (\w+): \{$/gm)].map((m, i, all) => [m[1], games.slice(m.index, all[i + 1]?.index)]);
ok(blocks.length >= 18, 'found the games in app.js');
for (const [id, src] of blocks) {
  const p = hub.GAMES_PL[id]; ok(p, `no Polish for the game ${id}`);
  ok(/\n    mins: \[\d+, \d+\],/.test(src), `${id}: no playtime (mins: [low, high] minutes, shown on its hub card)`);
  for (const k of ['start', 'openSeat', 'pitch', 'howto', 'rules']) ok(p[k], `${id}: no Polish ${k}`);
  const li = s => (s.match(/<li>/g) || []).length;
  ok(li(src) === li(p.rules), `${id}: the Polish rules have ${li(p.rules)} points, the English ${li(src)}`);
  const labels = [...src.matchAll(/pill\('\w+', [^,]+, (?:'([^']*)'|"([^"]*)")\)/g)].map(m => m[1] ?? m[2]).concat([...src.matchAll(/class="opt"><b>([^<]+)<\/b>/g)].map(m => m[1]));
  for (const l of labels) ok(hub.OPT_PL[l] || /^[\d ×·.]*(s|min)?$/.test(l) || ["Texas Hold'em", 'Mango Poker'].includes(l), `${id}: the table setting “${l}” has no Polish`);
}
for (const k of ['hay', 'pop', 'mj']) ok(new RegExp(`\n  ${k}: \\{\n    name: [^\n]+\n    mins: \\[\\d+, \\d+\\],`).test(app), `solo game ${k}: no playtime (mins)`);
ok(hub.SOLO_PL.hay.rules, 'Hay Hunch rules');
ok(hub.SOLO_PL.pop.rules, 'Pet Pop rules');
ok(hub.SOLO_PL.mj.rules, 'Pet Mahjong rules');

const items = await import('../public/lang/items-pl.js');
const { OPT, AV_COLOR_KEYS, AV_TABS, SEASONS } = await import('../public/avatar.js');
const { COS, PIECES } = await import('../public/cosmetics.js');
// avatar.js and cosmetics.js have swapped their names for the Polish ones by now: whatever is still an English name was missed
const plNames = new Set(Object.values(items.OPT_PL).flatMap(o => Object.values(o)));
for (const [k, list] of Object.entries(OPT)) if (!AV_COLOR_KEYS.includes(k)) for (const n of list) ok(plNames.has(n), `avatar item “${n}” (${k}) has no Polish name`);
ok(AV_TABS[0][0] === 'Ciało' && SEASONS.winter.name === 'Zimowa kolekcja', 'wardrobe tabs and drops are Polish');
for (const [k, x] of Object.entries(COS)) {
  const p = items.COS_PL[k]; ok(p && x.label === p.label, `cosmetic kind ${k} has no Polish label`);
  const names = new Set(Object.values(p.n));
  for (const it of x.items) ok(names.has(it.n), `cosmetic “${it.n}” (${k}) has no Polish name`);
  if (x.where) ok(p.where, `cosmetic kind ${k}: no Polish hint`);
}
ok(Object.values(PIECES).includes('Kulka'), 'isle pieces are Polish');

// Everything the hub's server code can say has Polish (Pet Farm adds its own sentences when it loads).
const { srvText } = await import('../public/lang/server.js');
let seen = 0;
const quoted = /(?:err|msg): (?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;
for (const f of ['server.js', 'store.js', 'hubchat.js', 'plaza.js', 'daily.js', 'word.js', 'hay.js', 'pop.js', 'mj.js', 'notice.js', 'mod.js']) {
  const src = fs.readFileSync(new URL('../server/' + f, import.meta.url), 'utf8');
  for (const m of src.matchAll(quoted)) {
    const text = (m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\$\{[^}]*(SEASON|cosSeason)[^}]*name\}/g, 'Winter drop').replace(/\$\{[^}]*back\}/g, 'March').replace(/\$\{[^}]*(price|DECOR_SLOTS|OUTFITS)[^}]*\}/g, '3').replace(/\$\{[^}]*\}/g, 'Ola');
    ok(srvText(text) !== text, `${f}: “${text}” has no Polish`);
    seen++;
  }
}
ok(seen > 50, `only ${seen} server messages were found`);

// Pet Farm: every table in its data has Polish, and so does everything its server code can say.
const farmPl = await import('../public/lang/farm-pl.js');
const farmEn = { ...await import('../public/games/farm/data.js'), ...await import('../public/games/farm/breed.js'), ...await import('../public/games/farm/battle.js') };
for (const [table, pl] of Object.entries(farmPl.COVER)) for (const key of Object.keys(farmEn[table])) ok(key in pl, `Pet Farm ${table}.${key} has no Polish`);
const { addServerText } = await import('../public/lang/server.js');
addServerText(farmPl.SRV_TEXT, farmPl.SRV_FORMS);
let farmSeen = 0;
const farmSrc = fs.readFileSync(new URL('../server/farm.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../server/farmorders.js', import.meta.url), 'utf8').replace(/err: /g, 'text: '); // island orders answer with { err }
for (const m of farmSrc.matchAll(/(?:\bno\(|(?:note|text): )(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g)) {
  const text = (m[1] ?? m[2]).replace(/\$\{w\.el\}/g, 'Leaf').replace(/\$\{z\.name\}/g, 'Mossy Woods').replace(/\$\{ITEMS\[[^}]*\}/g, 'Kitchen').replace(/\$\{[^}]*(max|pals|lvOf|house|\.lv|BREED_LV)[^}]*\}/g, '3').replace(/\$\{[^}]*\}/g, 'Ola');
  ok(srvText(text) !== text, `farm.js: “${text}” has no Polish`);
  farmSeen++;
}
ok(farmSeen > 80, `only ${farmSeen} Pet Farm server messages were found`);
ok(srvText('Mossy Woods opens at farmhouse level 2.') === 'Omszały Las otwiera się, gdy dom ma poziom 2.', 'zone names in server messages');
ok(srvText('Passwords need 6 to 72 characters.') !== 'Passwords need 6 to 72 characters.', 'password rule');
ok(srvText('🐾 Mystery Pet #12: solved in 3 guesses · 🔥 4 days in a row') === '🐾 Zagadkowy zwierzak #12: 3 próby · 🔥 4 dni z rzędu', 'shared Mystery Pet line');
// every game screen is translated: its client pulls in the language helpers, and the files it shares with the
// server load in Polish too
const gamesDir = new URL('../public/games/', import.meta.url);
for (const id of fs.readdirSync(gamesDir)) {
  const file = new URL(`${id}/client.js`, gamesDir);
  if (!fs.existsSync(file)) continue;
  ok(/from '\.\.\/\.\.\/i18n\.js'/.test(fs.readFileSync(file, 'utf8')), `public/games/${id}/client.js does not use i18n.js: its text would stay English`);
}
const plCheck = spawnSync(process.execPath, ['--input-type=module', '-e', `
  const [paw, pips, kart, kitchen, poker] = await Promise.all(['paw/board.js', 'pips/rules.js', 'kart/track.js', 'kitchen/rules.js', 'poker/rules.js'].map(f => import(new URL(f, ${JSON.stringify(gamesDir.href)}).href)));
  const out = [paw.TILES[0].name, paw.LV_NAMES[1], pips.LABEL.ch, kitchen.RECIPES.salad.name, poker.cardLabel(12), poker.HAND_ORDER[3][0]].join('|');
  if (out !== 'Wycieraczka|Legowisko|Szansa|Sałatka ogrodowa|As kier|Ful') { console.error(out); process.exit(1); }
`], { env: { ...process.env, CT_LANG: 'pl' }, encoding: 'utf8' });
ok(plCheck.status === 0, 'shared game files in Polish: ' + (plCheck.stderr || '').slice(0, 300));
console.log('i18n: all good');
process.exit(0);

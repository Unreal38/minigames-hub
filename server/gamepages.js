// A page of its own for every game, in Polish (/gry/<name>) and English (/en/games/<name>), plus an index of all games
// in both languages and the sitemap. These are what Google can list one by one: name, pitch, players, playtime,
// the "how to win" line and the full rules, the same texts the hub shows (read from app.js and hub-pl.js through
// gamelist.js), so a new game gets its pages by itself. Each page links its other language (hreflang) and the
// "Host a table" button opens the hub at that game (/?gra=<id>, handled in app.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRegistry, CATS, TODAY, setPageUrl } from './gamelist.js';
import { GAMES_PL, SOLO_PL, SEATS_PL } from '../public/lang/hub-pl.js';

export const SITE = 'https://zatokagier.com';
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PL_ASCII = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
export const slug = s => String(s).toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL_ASCII[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dash = ([a, b]) => a === b ? `${a}` : `${a}–${b}`;
const range = seats => (seats.match(/\d+/g) || []).map(Number);
const SOLO_CAT = ['Every day (on your own)', 'Na co dzień (w pojedynkę)'];

// Every game with both languages' texts. Read again only when app.js changed (readRegistry caches).
let built = { reg: null, list: null };
export function allGames(reg = readRegistry()) {
  if (built.reg === reg) return built.list;
  const list = reg.games.map(g => {
    const x = GAMES_PL[g.id] || {}, [lo, hi = lo] = range(g.seats);
    return { id: g.id, solo: false, cat: g.cat, lo, hi, coop: /co-?op/i.test(g.seats), mins: g.mins,
      en: { name: g.name, pitch: g.pitch, howto: g.howto, rules: g.rules, seats: g.seats },
      pl: { name: x.name || g.name, pitch: x.pitch || g.pitch, howto: x.howto || g.howto, rules: x.rules || g.rules, seats: SEATS_PL(g.seats) } };
  });
  for (const [k, en, pl, ten, tpl] of TODAY) {
    if (!k || list.some(g => g.id === k)) continue;
    const s = reg.solo[k] || {}, x = SOLO_PL[k] || {};
    list.push({ id: k, solo: true, cat: 'solo', lo: 1, hi: 1, mins: k === 'mp' ? reg.mpMins : k === 'word' ? reg.wordMins : s.mins || null,
      en: { name: en, pitch: ten, rules: s.rules || '' }, pl: { name: x.name || pl, pitch: tpl, rules: x.rules || s.rules || '' } });
  }
  for (const g of list) { g.en.slug = slug(g.en.name); g.pl.slug = slug(g.pl.name); }
  built = { reg, list };
  return list;
}
const catName = (g, pl) => g.cat === 'solo' ? SOLO_CAT[pl ? 1 : 0] : CATS[g.cat][pl ? 1 : 0];
export const gameUrl = (g, lang) => lang === 'pl' ? `/gry/${g.pl.slug}` : `/en/games/${g.en.slug}`;
setPageUrl((id, lang) => { const g = allGames().find(o => o.id === id); return g ? gameUrl(g, lang) : ''; });
const listUrl = lang => lang === 'pl' ? '/gry' : '/en/games';
const homeUrl = lang => lang === 'pl' ? '/' : '/en';
// Pictures drawn from the hub card art by tools/gamepics.mjs (1200x630 and a 480x252 thumbnail).
const hasPic = id => { try { return fs.statSync(path.join(PUB, 'gamepics', `${id}.jpg`)).isFile(); } catch { return false; } };
const picUrl = g => hasPic(g.id) ? `${SITE}/gamepics/${g.id}.jpg` : `${SITE}/og-image.png`;
const picImg = (g, name, small) => hasPic(g.id)
  ? `<img src="/gamepics/${g.id}${small ? '-s' : ''}.jpg" width="${small ? 480 : 1200}" height="${small ? 252 : 630}" alt="${esc(name)}"${small ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"'}>` : '';
// A few extra lines for games people search for by another name.
const EXTRA = {
  hotpot: ['A free fan-made browser version inspired by the Hotpot card minigame from Palia: play it with friends or bots, nothing to download.',
    'Darmowa fanowska wersja w przeglądarce, inspirowana karcianą minigrą Hotpot z Palii: zagraj ze znajomymi albo z botami, bez pobierania.'],
};
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const cut = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…';

function shell({ lang, path: here, alt, title, desc, image, body, data }) {
  const pl = lang === 'pl', T = (en, p) => pl ? p : en;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${here}">
<link rel="alternate" hreflang="pl" href="${SITE}${pl ? here : alt}">
<link rel="alternate" hreflang="en" href="${SITE}${pl ? alt : here}">
<link rel="alternate" hreflang="x-default" href="${SITE}${pl ? here : alt}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zatoka Gier">
<meta property="og:url" content="${SITE}${here}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${pl ? 'pl_PL' : 'en_GB'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#6fbdf2">
<link rel="stylesheet" href="/gamepage.css">
<script src="/gamepage.js"></script>
${data.map(ld).join('\n')}
</head>
<body>
<header class="top">
  <a class="home" href="${homeUrl(lang)}">Zatoka Gier</a>
  <nav><a href="${listUrl(lang)}">${T('All games', 'Wszystkie gry')}</a> <a class="lang" href="${alt}" hreflang="${pl ? 'en' : 'pl'}" lang="${pl ? 'en' : 'pl'}">${pl ? 'English' : 'Polski'}</a></nav>
</header>
<main>
${body}
</main>
<footer>${T('Free browser games for friends. Nothing to install, no ads.', 'Darmowe gry w przeglądarce dla znajomych. Bez instalowania i bez reklam.')}<br>
<a href="${homeUrl(lang)}">zatokagier.com</a> · <a href="${listUrl(lang)}">${T('All games', 'Wszystkie gry')}</a> · <a href="/privacy">${T('Privacy', 'Prywatność')}</a></footer>
</body>
</html>`;
}

const crumbs = (lang, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + url })) });
const facts = (g, pl) => {
  const T = (en, p) => pl ? p : en, x = g[pl ? 'pl' : 'en'];
  return `<ul class="facts">
<li><b>${T('Players', 'Gracze')}</b> ${g.solo ? T('1 (on your own)', '1 (w pojedynkę)') : `${dash([g.lo, g.hi])}${g.coop ? T(' (co-op)', ' (gra zespołowa)') : ''}`}</li>
${g.mins ? `<li><b>${T('One game', 'Jedna gra')}</b> ${g.mins[0] === g.mins[1] ? `~${g.mins[0]}` : dash(g.mins)} min</li>` : ''}
<li><b>${T('Type', 'Rodzaj')}</b> ${esc(catName(g, pl))}</li>
<li><b>${T('Price', 'Cena')}</b> ${T('free, in the browser', 'za darmo, w przeglądarce')}</li>
</ul>`;
};

export function gamePage(g, lang, list = allGames()) {
  const pl = lang === 'pl', T = (en, p) => pl ? p : en, x = g[lang], here = gameUrl(g, lang), alt = gameUrl(g, pl ? 'en' : 'pl');
  const title = cut(`${x.name}: ${g.solo ? T('play online for free', 'graj online za darmo') : T('play online with friends for free', 'zagraj online ze znajomymi za darmo')} | Zatoka Gier`, 70);
  const desc = cut(`${x.pitch} ${g.solo ? '' : `${T('Players', 'Gracze')}: ${dash([g.lo, g.hi])}. `}${T('Free in your browser, no ads.', 'Za darmo w przeglądarce, bez reklam.')}`, 160);
  const same = list.filter(o => o !== g && o.cat === g.cat).slice(0, 8);
  const play = g.solo ? T('Play now', 'Graj teraz') : T('Host a table', 'Załóż stół');
  const body = `<nav class="crumbs" aria-label="${T('You are here', 'Jesteś tutaj')}"><a href="${homeUrl(lang)}">Zatoka Gier</a> › <a href="${listUrl(lang)}">${T('Games', 'Gry')}</a> › <span>${esc(x.name)}</span></nav>
<article>
<div class="art">${picImg(g, x.name)}</div>
<h1>${esc(x.name)}</h1>
<p class="lead">${esc(x.pitch)}</p>
${EXTRA[g.id] ? `<p>${esc(EXTRA[g.id][pl ? 1 : 0])}</p>` : ''}
${facts(g, pl)}
<p class="cta"><a class="btn" href="/?gra=${g.id}">${play}</a> <span>${g.solo ? T('Nothing to install. A free account keeps your progress.', 'Bez instalowania. Darmowe konto zapisuje postępy.') : T('Tables are public: friends and anyone online can join, and bots fill empty seats.', 'Stoły są publiczne: dosiąść się mogą znajomi i każdy, kto jest online.')}</span></p>
${x.howto ? `<h2>${T('How to win', 'Jak wygrać')}</h2>\n<p>${x.howto}</p>` : ''}
${x.rules ? `<h2>${T('Rules', 'Zasady')}</h2>\n<div class="rules">${x.rules}</div>` : ''}
</article>
${same.length ? `<section class="more"><h2>${T('More games like this', 'Podobne gry')}</h2><ul class="cards">${same.map(o => cardLi(o, lang)).join('')}</ul></section>` : ''}`;
  const game = { '@context': 'https://schema.org', '@type': 'Game', '@id': `${SITE}${here}#game`, name: x.name, description: x.pitch, url: SITE + here, image: picUrl(g),
    inLanguage: ['pl', 'en'], isAccessibleForFree: true, genre: catName(g, pl), isPartOf: { '@id': `${SITE}/#site` },
    numberOfPlayers: g.lo === g.hi ? { '@type': 'QuantitativeValue', value: g.lo } : { '@type': 'QuantitativeValue', minValue: g.lo, maxValue: g.hi },
    ...(g.mins ? { timeRequired: `PT${g.mins[1]}M` } : {}) };
  return shell({ lang, path: here, alt, title, desc, image: picUrl(g), body, data: [game, crumbs(lang, [['Zatoka Gier', homeUrl(lang)], [T('Games', 'Gry'), listUrl(lang)], [x.name, here]])] });
}

const cardLi = (g, lang) => {
  const x = g[lang], pl = lang === 'pl';
  return `<li><a href="${gameUrl(g, lang)}"><span class="pic">${picImg(g, x.name, true)}</span><b>${esc(x.name)}</b><small>${g.solo ? (pl ? '1 gracz' : '1 player') : esc(x.seats)}${g.mins ? ` · ${g.mins[0] === g.mins[1] ? `~${g.mins[0]}` : dash(g.mins)} min` : ''}</small></a></li>`;
};

export function listPage(lang, list = allGames()) {
  const pl = lang === 'pl', T = (en, p) => pl ? p : en, here = listUrl(lang), alt = listUrl(pl ? 'en' : 'pl');
  const groups = [...Object.keys(CATS), 'solo'].map(cat => [cat, list.filter(g => g.cat === cat)]).filter(([, l]) => l.length);
  const n = list.filter(g => !g.solo).length;
  const body = `<nav class="crumbs"><a href="${homeUrl(lang)}">Zatoka Gier</a> › <span>${T('Games', 'Gry')}</span></nav>
<h1>${T('All games on Zatoka Gier', 'Wszystkie gry w Zatoce Gier')}</h1>
<p class="lead">${pl ? `${n} gier do grania ze znajomymi w przeglądarce i ${list.length - n} gier na co dzień. Wszystkie za darmo, bez instalowania i bez reklam. Każda ma swoją stronę z zasadami.` : `${n} games to play with friends in your browser and ${list.length - n} everyday games. All free, nothing to install, no ads. Each one has a page with its rules.`}</p>
${groups.map(([cat, l]) => `<section><h2>${esc(catName(l[0], pl))}</h2><ul class="cards">${l.map(g => cardLi(g, lang)).join('')}</ul></section>`).join('\n')}`;
  const data = { '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': SITE + here, url: SITE + here, name: T('All games', 'Wszystkie gry'), inLanguage: lang, isPartOf: { '@id': `${SITE}/#site` },
    mainEntity: { '@type': 'ItemList', numberOfItems: list.length, itemListElement: list.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + gameUrl(g, lang), name: g[lang].name })) } };
  return shell({ lang, path: here, alt, title: T('All games: free online games with friends | Zatoka Gier', 'Wszystkie gry: darmowe gry online ze znajomymi | Zatoka Gier'),
    desc: T(`${n} free browser games with friends: cards, board games, chess, party games and more, each with its rules. Nothing to install, no ads.`, `${n} darmowych gier w przeglądarce ze znajomymi: karty, planszówki, szachy, gry imprezowe i więcej, każda z zasadami. Bez instalowania i bez reklam.`),
    image: `${SITE}/og-image.png`, body, data: [data, crumbs(lang, [['Zatoka Gier', homeUrl(lang)], [T('Games', 'Gry'), here]])] });
}

// The answer for a path, or null when it is not one of these pages. { status, html } or { redirect }.
export function route(p) {
  if (p === '/gry/' || p === '/en/games/' || p === '/en/') return { redirect: p.slice(0, -1) };
  if (p === '/gry') return { status: 200, html: listPage('pl') };
  if (p === '/en/games') return { status: 200, html: listPage('en') };
  const m = p.match(/^\/(gry|en\/games)\/([^/]+)\/?$/); if (!m) return null;
  const lang = m[1] === 'gry' ? 'pl' : 'en', list = allGames();
  const g = list.find(o => o[lang].slug === m[2]);
  if (g) return p.endsWith('/') ? { redirect: gameUrl(g, lang) } : { status: 200, html: gamePage(g, lang, list) };
  // An old name or a game id (/gry/chess), or the other language's name: send it to the right address.
  const o = list.find(o => o.id === m[2] || o.pl.slug === m[2] || o.en.slug === m[2]);
  if (o) return { redirect: gameUrl(o, lang) };
  return { status: 404, html: shell({ lang, path: listUrl(lang), alt: listUrl(lang === 'pl' ? 'en' : 'pl'), title: lang === 'pl' ? 'Nie ma takiej gry | Zatoka Gier' : 'No such game | Zatoka Gier',
    desc: '', image: `${SITE}/og-image.png`, data: [], body: `<h1>${lang === 'pl' ? 'Nie ma takiej gry' : 'No such game'}</h1><p><a href="${listUrl(lang)}">${lang === 'pl' ? 'Zobacz wszystkie gry' : 'See all games'}</a></p>` })
    .replace('<meta name="description" content="">', '<meta name="robots" content="noindex">') };
}

// The sitemap: home in both languages, the game lists, every game page and the privacy page, with hreflang pairs.
export const HOME_LASTMOD = '2026-11-26';
export function sitemap(list = allGames()) {
  const pair = (pl, en, extra = '') => [pl, en].map(loc => `  <url>\n    <loc>${SITE}${loc}</loc>${extra}
    <xhtml:link rel="alternate" hreflang="pl" href="${SITE}${pl}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${pl}"/>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pair('/', '/en', `\n    <lastmod>${HOME_LASTMOD}</lastmod>`)}
${pair('/gry', '/en/games')}
${list.map(g => pair(gameUrl(g, 'pl'), gameUrl(g, 'en'))).join('\n')}
  <url>
    <loc>${SITE}/privacy</loc>
  </url>
</urlset>
`;
}

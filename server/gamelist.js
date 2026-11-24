// The game list that search engines and no-JavaScript visitors read (server/seo.js puts it into the page).
// It is read straight from the hub's own registry, so a new game shows up here by itself:
// public/app.js HUB_GAMES (order, category, seats, English pitch) + GAMES[id].name/mins, and public/lang/hub-pl.js (Polish).
// The Today games have no pitch in the registry, so their short texts live in TODAY below (their mins come from SOLO).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES_PL, SOLO_PL } from '../public/lang/hub-pl.js';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const STR = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`; // one JS string literal, ' or "
const unq = m => (m[1] ?? m[2] ?? '').replace(/\\(.)/g, '$1');

// Reads the registry out of app.js (a browser module, so it is read as text, not imported).
let cache = { at: 0, reg: null };
export function readRegistry(src) {
  if (src == null) { // read app.js again only when it changed
    const file = path.join(PUB, 'app.js'), at = fs.statSync(file).mtimeMs;
    if (at !== cache.at) cache = { at, reg: readRegistry(fs.readFileSync(file, 'utf8')) };
    return cache.reg;
  }
  const info = {}; // id -> { name, mins }
  for (const m of src.matchAll(/^ {2}(\w+): \{\n {4}name: (?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")[^\n]*\n {4}mins: \[(\d+), (\d+)\]/gm))
    info[m[1]] = { name: unq([0, m[2], m[3]]), mins: [+m[4], +m[5]] };
  const hub = src.slice(src.indexOf('const HUB_GAMES = ['), src.indexOf('].filter(g => GAMES[g[0]])'));
  const row = new RegExp(String.raw`\['(\w+)', '[^']*', \w+, '(\w+)', '([^']*)', (?:${STR})\]`, 'g');
  const games = [...hub.matchAll(row)].filter(m => info[m[1]]).map(m => ({ id: m[1], cat: m[2], seats: m[3], pitch: unq([0, m[4], m[5]]), ...info[m[1]] }));
  const mp = src.match(/const MP_MINS = \[(\d+), (\d+)\]/);
  return { games, solo: info, mpMins: mp ? [+mp[1], +mp[2]] : null };
}

const CATS = { cards: ['Card games', 'Gry karciane'], board: ['Board and dice games', 'Gry planszowe i w kości'], action: ['Action and party games', 'Gry zręcznościowe i imprezowe'] };
// The Today column: [key in SOLO (for mins) or null, English name, Polish name, English text, Polish text].
const TODAY = [
  ['farm', 'Pet Farm', 'Farma zwierzaków',
    'Your own farm on a floating island. Hatch, raise and breed 70+ pet species with inherited traits and elements, build and decorate freely, send pets on expeditions, fight turn-based 3v3 battles and visit or help your friends\' farms.',
    'Własna farma na latającej wyspie. Wykluwasz, wychowujesz i krzyżujesz ponad 70 gatunków zwierzaków z dziedziczeniem cech i żywiołów, budujesz i urządzasz farmę, wysyłasz zwierzaki na wyprawy, walczysz w turowych bitwach 3 na 3 i odwiedzasz albo wspierasz farmy znajomych.'],
  ['mp', 'Mystery Pet', 'Zagadkowy zwierzak',
    'A new puzzle every day: guess the hidden Pet Farm pet from the clues each guess gives you. Everyone gets the same pet that day.',
    'Codziennie nowa zagadka: zgadnij ukrytego zwierzaka z Farmy na podstawie wskazówek, które daje każda próba. Tego dnia wszyscy zgadują tego samego zwierzaka.'],
  ['pop', 'Pet Pop', 'Zwierzakowe trójki',
    'A match-3 puzzle with Pet Farm pets. Swap neighbours to line up three or more, make special pets from bigger matches and clear the goals of each level before the moves run out.',
    'Układanka „trzy w rzędzie” ze zwierzakami z Farmy. Zamieniaj sąsiadów, żeby ustawić trzy albo więcej takich samych, twórz specjalne zwierzaki z większych układów i spełnij cele poziomu, zanim skończą się ruchy.'],
  ['mj', 'Pet Mahjong', 'Zwierzakowy mahjong',
    'Mahjong solitaire: match pairs of free tiles with the same picture until the board is empty. Boards grow from 24 to 144 tiles, with up to three stars a level.',
    'Pasjans mahjong: łącz w pary wolne kafelki z tym samym obrazkiem, aż plansza będzie pusta. Plansze rosną od 24 do 144 kafelków, a za każdy poziom można zdobyć do trzech gwiazdek.'],
  ['hay', 'Hay Hunch', 'Szukanie w sianie',
    'A logic puzzle in a hay field. Row and column signs tell you how many carrots and napping pets each line hides: flip the bales that are safe and find every ×2 and ×3 to clear the level.',
    'Logiczna łamigłówka na polu siana. Tabliczki przy rzędach i kolumnach mówią, ile marchewek i drzemiących zwierzaków kryje każda linia: odwracaj bezpieczne bele i znajdź wszystkie ×2 i ×3, żeby przejść poziom.'],
  [null, 'Lucky Wheel', 'Koło szczęścia',
    'One free spin a day for coins, Pet Farm materials, boosters, a pet of the day or a lucky decoration for your isle.',
    'Jeden darmowy obrót dziennie: monety, materiały na Farmę, przyspieszacze, zwierzak dnia albo szczęśliwa ozdoba na wyspę.'],
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dash = ([a, b]) => a === b ? `${a}` : `${a}–${b}`;
const minsText = m => m[0] === m[1] ? `~${m[0]} min` : `${m[0]}–${m[1]} min`;
const range = seats => (seats.match(/\d+/g) || []).map(Number);
// Polish plural of "gra": 1 gra, 2–4 gry (not 12–14), else gier.
const gier = n => n === 1 ? 'gra' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'gry' : 'gier';

function view(lang, reg = readRegistry()) {
  const pl = lang === 'pl', T = (en, p) => pl ? p : en;
  const games = reg.games.map(g => {
    const x = pl ? GAMES_PL[g.id] || {} : {}, [lo, hi = lo] = range(g.seats);
    return { ...g, name: x.name || g.name, text: x.pitch || g.pitch, lo, hi, coop: /co-?op/i.test(g.seats) };
  });
  const today = TODAY.map(([k, en, p, ten, tp]) => ({ game: !!k, name: T(en, p), text: T(ten, tp), mins: k === 'mp' ? reg.mpMins : k ? reg.solo[k]?.mins : null,
    ...(k && SOLO_PL[k] && pl ? { name: SOLO_PL[k].name } : {}) }));
  return { pl, T, games, today };
}

// The HTML list for the crawlable intro (inside <!--seo-->).
export function gamesHtml(lang, reg) {
  const { pl, T, games, today } = view(lang, reg);
  const daily = today.filter(t => t.game).length; // the Lucky Wheel is listed but is not a game
  const meta = g => `${T('Players', 'Gracze')}: ${dash([g.lo, g.hi])}${g.coop ? T(' (co-op)', ' (gra zespołowa)') : ''} · ${T('One game', 'Jedna gra')}: ${minsText(g.mins)}`;
  let out = `<p>${pl ? `W Zatoce jest ${games.length} ${gier(games.length)} przy stole dla znajomych i ${daily} ${gier(daily)} na co dzień` : `Zatoka has ${games.length} table games to play with friends and ${daily} everyday games`}. ${T('Below is every one of them, with the number of players and how long one game usually takes.', 'Poniżej są wszystkie, z liczbą graczy i tym, ile zwykle trwa jedna gra.')}</p>\n`;
  out += `<section id="gry"><h2>${T('All games', 'Wszystkie gry')}</h2>\n`;
  for (const [cat, [en, p]] of Object.entries(CATS)) {
    const list = games.filter(g => g.cat === cat); if (!list.length) continue;
    out += `<h3>${T(en, p)}</h3>\n<ul class="seo-games">\n`;
    for (const g of list) out += `<li id="g-${g.id}"><b>${esc(g.name)}</b>: ${esc(g.text)} <small>${meta(g)}</small></li>\n`;
    out += '</ul>\n';
  }
  out += `<h3>${T('Every day (on your own)', 'Na co dzień (w pojedynkę)')}</h3>\n<ul class="seo-games">\n`;
  for (const t of today) out += `<li><b>${esc(t.name)}</b>: ${esc(t.text)}${t.mins ? ` <small>${T('One game', 'Jedna gra')}: ${minsText(t.mins)}</small>` : ''}</li>\n`;
  return out + '</ul>\n</section>';
}

// Structured data: the same list as a schema.org ItemList of Game entries.
export function gamesLd(lang, reg) {
  const { T, games, today } = view(lang, reg);
  // Plain schema.org Game (not VideoGame/SoftwareApplication, which Google checks for ratings and would flag).
  const base = { '@type': 'Game', inLanguage: ['pl', 'en'], isAccessibleForFree: true, isPartOf: { '@id': 'https://zatokagier.com/#site' } };
  const items = [
    ...games.map(g => ({ ...base, name: g.name, description: g.text, url: `https://zatokagier.com/#g-${g.id}`, genre: T(...CATS[g.cat]),
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: g.lo, maxValue: g.hi } })),
    ...today.map(t => ({ ...base, name: t.name, description: t.text, url: 'https://zatokagier.com/', numberOfPlayers: { '@type': 'QuantitativeValue', value: 1 } })),
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', '@id': 'https://zatokagier.com/#games', name: T('Games on Zatoka Gier', 'Gry w Zatoce Gier'),
    numberOfItems: items.length, itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) }).replace(/</g, '\\u003c');
}

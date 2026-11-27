// Friendship Trail (Szlak przyjaźni): the rules both the server (which runs the game) and the browser (which draws it)
// need. The trail is a big island loop of stones with four forks; everything here is plain data and small helpers,
// no three.js, so the server can import it.
//
//   NODES        every stone: { x, z, kind, next: [stone ids], br: fork id or null }. 0..MAIN-1 is the main loop,
//                the forks' stones follow. A stone with two next stones is a fork: the walker picks.
//   FORKS        the four side routes and their names.
//   ITEMS        what the stall sells (price in treats) and what each does.
//   POOL         the hub minigames played between rounds, each with its quick preset (the table options it starts with).
//   SEASON_RULE  what the season changes, WX_EL which element the weather brings out more often.
import { L } from '../../i18n.js';

export const MAIN = 40;
const mainPt = i => { const a = (i / MAIN) * Math.PI * 2 + Math.PI / 2; return [Math.cos(a) * (16 + 1.4 * Math.sin(3 * a)), Math.sin(a) * (11.5 + 1.0 * Math.cos(2 * a))]; };
const MK = Array(MAIN).fill('treat');
[4, 9, 13, 19, 24, 29, 33, 38].forEach(i => { MK[i] = 'bramble'; }); [7, 27].forEach(i => { MK[i] = 'picnic'; });
[2, 22].forEach(i => { MK[i] = 'stall'; }); MK[11] = 'bench'; MK[36] = 'well';

export const FORKS = {
  forest: { name: L('Forest shortcut', 'Leśny skrót'), from: 6, to: 15, ctrl: [-3, 0], kinds: ['treat', 'den', 'bramble', 'treat', 'spring', 'treat'] },
  beach: { name: L('Beach detour', 'Plażowy objazd'), from: 17, to: 24, ctrl: 1.75, kinds: ['picnic', 'treat', 'treat', 'nest', 'treat', 'picnic'] },
  hill: { name: L('Hill and bridge', 'Wzgórze i mostek'), from: 26, to: 35, ctrl: [3, -1], kinds: ['treat', 'bramble', 'treat', 'stall', 'treat'] },
  cliff: { name: L('Cliff path', 'Ścieżka na klifie'), from: 30, to: 34, ctrl: 1.6, kinds: ['treat', 'picnic', 'bramble'] },
};
export const MAIN_NAME = L('Main trail', 'Główny szlak');

export const NODES = [];
for (let i = 0; i < MAIN; i++) { const [x, z] = mainPt(i); NODES.push({ x, z, kind: MK[i], next: [(i + 1) % MAIN], br: null }); }
for (const [id, f] of Object.entries(FORKS)) {
  const A = NODES[f.from], B = NODES[f.to];
  const C = Array.isArray(f.ctrl) ? { x: f.ctrl[0], z: f.ctrl[1] } : { x: (A.x + B.x) / 2 * f.ctrl, z: (A.z + B.z) / 2 * f.ctrl };
  let prev = A;
  f.kinds.forEach((kind, j) => {
    const t = (j + 1) / (f.kinds.length + 1), u = 1 - t;
    const n = { x: u * u * A.x + 2 * u * t * C.x + t * t * B.x, z: u * u * A.z + 2 * u * t * C.z + t * t * B.z, kind, next: [], br: id };
    prev.next.push(NODES.length); NODES.push(n); prev = n;
  });
  prev.next.push(f.to);
}
export const N = NODES.length;
export const dist = (a, b) => Math.hypot(NODES[a].x - NODES[b].x, NODES[a].z - NODES[b].z);
export const near = (a, b) => dist(a, b) <= 2.9; // the same stone or the one next to it
export const routeName = j => (NODES[j]?.br ? FORKS[NODES[j].br].name : MAIN_NAME);

// Pet Farm's element ring: each element is strong against the next one (games/farm/battle.js STRONG).
export const STRONG = { Tide: 'Ember', Ember: 'Leaf', Leaf: 'Stone', Stone: 'Spark', Spark: 'Tide' };
export const ELS = Object.keys(STRONG);
export const EL_NAME = { Tide: L('Tide', 'Fala'), Ember: L('Ember', 'Żar'), Leaf: L('Leaf', 'Liść'), Stone: L('Stone', 'Kamień'), Spark: L('Spark', 'Iskra') };
export const EL_COL = { Leaf: '#3f9a52', Ember: '#e0592f', Tide: '#2f86cc', Spark: '#d9a400', Stone: '#8a7f76' }; // Pet Farm's ELEMENTS
// The chance a showdown wins a wild pet over: strong, even or weak. A Berry Bundle counts one step stronger.
export const ODDS = { strong: .85, even: .55, weak: .25 };
export const matchup = (a, w) => (STRONG[a] === w ? 'strong' : STRONG[w] === a ? 'weak' : 'even');
export const oddsOf = (a, w, berry) => { const m = matchup(a, w); return ODDS[berry ? (m === 'weak' ? 'even' : 'strong') : m]; };
export const priceOf = rare => 4 + 3 * rare; // treats that always win a wild pet over

export const HERD_MAX = 6, ITEM_MAX = 3, LURE = 6, PACT_ROUNDS = 3, EGG_TURNS = 2, WILD_MAX = 8;
export const START = -1; // everyone begins in the start meadow, off the trail, and steps onto stone 0 first
export const START_TREATS = 6;
export const MINI_PAY = [8, 5, 3, 1, 1, 1]; // treats for 1st, 2nd... in a minigame (scaled to the table, see payFor)
export const payFor = (place, n) => (n <= 2 ? [8, 3] : n === 3 ? [8, 5, 2] : MINI_PAY)[place - 1] ?? 1;

export const ITEMS = {
  whistle: { c: 5, name: L('Pet Whistle', 'Gwizdek'), tx: L('After you walk, the nearest wild pet comes to you.', 'Po marszu najbliższy dziki zwierzak przychodzi do ciebie.') },
  berry: { c: 4, name: L('Berry Bundle', 'Pęczek jagód'), tx: L('Your next showdown counts one step stronger.', 'Twoje następne starcie liczy się o stopień mocniej.') },
  spy: { c: 3, name: L('Spyglass', 'Luneta'), tx: L('Roll two dice this turn and walk the higher.', 'Rzuć w tej turze dwiema kośćmi i idź o wyższy wynik.') },
  honey: { c: 4, name: L('Honey Pot', 'Garnek miodu'), tx: L('Leave it on your stone. The next player to stop there pays you 4 treats.', 'Zostaw go na swoim kamieniu. Następny gracz, który tam stanie, płaci ci 4 przysmaki.') },
  charm: { c: 5, name: L('Nest Charm', 'Amulet gniazda'), tx: L('Nobody can lure your friends until your next turn.', 'Nikt nie zwabi twoich przyjaciół do twojej następnej tury.') },
  pouch: { c: 3, name: L('Snack Pouch', 'Sakiewka z przekąskami'), tx: L('Every friend can cheer and reroll again.', 'Każdy przyjaciel znów może kibicować i przerzucać.') },
};
export const ITEM_IDS = Object.keys(ITEMS);

export const STONES = {
  treat: L('Treats: +3', 'Przysmaki: +3'), picnic: L('Picnic: +5', 'Piknik: +5'), bramble: L('Brambles: −3', 'Jeżyny: −3'),
  stall: L('Stall: shop when you pass', 'Stragan: zakupy w przejściu'), nest: L('Egg Nest: a Mystery Egg', 'Gniazdo: tajemnicze jajo'),
  bench: L('Pact Bench: offer a buddy pact', 'Ławka paktu: zaproponuj pakt'), well: L('Wishing Well: 5 treats for a wish', 'Studnia życzeń: życzenie za 5 przysmaków'),
  spring: L('Hot Spring: friends rest, +2', 'Gorące źródło: odpoczynek, +2'), den: L('Rare Den: a rare pet comes out', 'Nora rzadkich: wychodzi rzadki zwierzak'),
};

// The season (the site's shop seasons, avatar.js) changes one stone or move; Halloween plays like autumn.
export const SEASON_RULE = {
  winter: L('Winter: brambles are icy. They slide you 2 stones on instead of costing treats.', 'Zima: jeżyny są oblodzone. Zamiast zabierać przysmaki, przesuwają cię o 2 kamienie.'),
  spring: L('Spring: picnics give 7 treats.', 'Wiosna: pikniki dają 7 przysmaków.'),
  summer: L('Summer: every Treats stone gives 4.', 'Lato: każdy kamień z przysmakami daje 4.'),
  autumn: L('Autumn: wild pets are a little easier to befriend with treats (2 cheaper).', 'Jesień: dzikie zwierzaki łatwiej przekonać przysmakami (2 taniej).'),
};
export const ruleSeason = s => (s === 'halloween' ? 'autumn' : SEASON_RULE[s] ? s : 'autumn');
// The weather (weather.js, the same for everyone) brings one element out more often; a rainbow brings rare pets.
export const WX_EL = { sunny: 'Ember', cloudy: 'Stone', rain: 'Tide', wind: 'Spark', rainbow: null };
export const WX_RULE = {
  sunny: L('Sunny: Ember pets are out more.', 'Słonecznie: częściej spotkasz zwierzaki Żaru.'),
  cloudy: L('Cloudy: Stone pets are out more.', 'Pochmurno: częściej spotkasz zwierzaki Kamienia.'),
  rain: L('Rain: Tide pets are out more.', 'Deszcz: częściej spotkasz zwierzaki Fali.'),
  wind: L('Windy: Spark pets are out more.', 'Wietrznie: częściej spotkasz zwierzaki Iskry.'),
  rainbow: L('Rainbow: rare pets are out more.', 'Tęcza: częściej spotkasz rzadkie zwierzaki.'),
};

// The hub minigames played after each round, each as a quick preset of the real game. min/max: who it seats.
export const POOL = [
  { id: 'bop', name: L('Burrow Bop', 'Burrow Bop'), cut: L('one round', 'jedna runda'), max: 6, opts: { pace: 'normal' } },
  { id: 'stack', name: L('Tower Stack', 'Chwiejna wieża'), cut: L('one tower', 'jedna wieża'), max: 6, opts: { towers: 1, timer: 10, blocks: 'classic' } },
  { id: 'blast', name: L('Blast Bay', 'Zatoka Bum'), cut: L('first to win a round', 'do jednej wygranej rundy'), max: 8, opts: { wins: 1, arena: 'random', crumble: 'on' } },
  { id: 'kart', name: L('Kart Island Race', 'Wyspiarskie gokarty'), cut: L('two laps', 'dwa okrążenia'), max: 8, opts: { laps: 2, track: 'random', items: 'on' } },
  { id: 'golf', name: L('Mini Golf Party', 'Imprezowy minigolf'), cut: L('one hole', 'jeden dołek'), max: 6, opts: { holes: 1, course: 'random' } },
  { id: 'kitchen', name: L('Cozy Kitchen Rush', 'Gorączka w kuchni'), cut: L('one minute shift', 'minutowa zmiana'), max: 4, opts: { time: 60, map: 'diner' } },
  { id: 'bean', name: L('Beanstalk Bounce', 'Fasolowe skoki'), cut: L('one climb', 'jedna wspinaczka'), max: 6, opts: { pace: 'normal' } },
  { id: 'bingo', name: L('Sky Bingo', 'Podniebne bingo'), cut: L('quick card', 'szybka karta'), max: 8, opts: { game: 'quick', speed: 'fast', daub: 'hand' } },
  { id: 'dig', name: L('Treasure Dig', 'Poszukiwacze skarbów'), cut: L('small field', 'małe pole'), max: 6, opts: { size: 'small', timer: 15 } },
  { id: 'pairs', name: L('Pet Pairs', 'Zwierzakowe Pary'), cut: L('small board', 'mała plansza'), max: 6, opts: { board: 'small', timer: 10, twists: 'on', streak: 3 } },
  { id: 'darts', name: L('Sky Darts', 'Podniebne rzutki'), cut: L('three turns', 'trzy kolejki'), max: 6, opts: { start: 301, out: 'any', legs: 1, rounds: 3, timer: 15 } },
  { id: 'lagoon', name: L('Bubble Lagoon', 'Bąbelkowa laguna'), cut: L('90 seconds', '90 sekund'), max: 4, opts: { speed: 'normal', time: 90 } },
  { id: 'bricks', name: L('Sky Bricks', 'Podniebne klocki'), cut: L('90 seconds', '90 sekund'), max: 6, opts: { speed: 'normal', time: 90 } },
  { id: 'siege', name: L('Sugar Siege', 'Słodkie Oblężenie'), cut: L('one pet each', 'jeden zwierzak na gracza'), max: 4, opts: { pets: 1, timer: 20, arc: 'short' } },
];
export const poolFor = n => POOL.filter(g => g.max >= n);

// The Pet Show: a ribbon to whoever leads each of these (ties share it); a point per friend and 2 per ribbon.
export function ribbonsOf(P) {
  const best = (f, ok = v => v > 0) => { const v = P.map(f), m = Math.max(...v); return ok(m) ? P.map((_, i) => i).filter(i => v[i] === m) : []; };
  return {
    herd: best(p => p.herd.length),
    els: best(p => new Set(p.herd.map(f => f.el)).size),
    rare: best(p => Math.max(0, ...p.herd.filter(f => !f.start).map(f => f.rare + 1))),
    mini: best(p => p.wins),
    treats: best(p => p.treats),
  };
}
export function showPts(P, rib = ribbonsOf(P)) { const pts = P.map(p => p.herd.length); for (const ids of Object.values(rib)) for (const i of ids) pts[i] += 2; return pts; }
export const RIBBONS = {
  herd: L('Biggest herd', 'Największe stado'), els: L('Most elements', 'Najwięcej żywiołów'), rare: L('Rarest friend', 'Najrzadszy przyjaciel'),
  mini: L('Minigame star', 'Gwiazda minigier'), treats: L('Treat keeper', 'Skarbnik przysmaków'),
};
export const ROUNDS = [5, 8, 12];

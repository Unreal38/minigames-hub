// Match colours: two people in the same (or a very similar) top colour play in different colours for that
// match only. Checks the shared helper and then every table game started the way the server starts it.
import { readdirSync } from 'node:fs';
import { distinctCols, matchColors, colDist, CLOSE, MATCH_COLS } from '../server/colors.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const apart = cols => cols.every((a, i) => cols.every((b, j) => i === j || colDist(a, b) >= CLOSE));

for (let i = 0; i < MATCH_COLS.length; i++) for (let j = i + 1; j < MATCH_COLS.length; j++)
  if (colDist(MATCH_COLS[i], MATCH_COLS[j]) < CLOSE) fail(`replacement colours ${MATCH_COLS[i]} and ${MATCH_COLS[j]} are too alike`);

{ const c = distinctCols(['#ff8fab', '#4d9fff', '#ff8fab', '#ff92ad', 'junk']);
  if (c[0] !== '#ff8fab' || c[1] !== '#4d9fff') fail('players without a clash must keep their own colour');
  if (!apart(c)) fail('clashing colours not separated: ' + c); }
{ const own = ['#ff8fab', '#7ed3b2', '#4d9fff', '#ffd23f']; if (distinctCols(own).join() !== own.join()) fail('distinct colours changed'); }
{ const c = distinctCols(Array(8).fill('#ff8fab')); if (c[0] !== '#ff8fab' || !apart(c)) fail('eight pinks not made distinct: ' + c); }

// Stable: once given, a match colour stays put; a joiner who clashes moves, and a bot gives way to a person.
{ const G = { seats: [{ id: 'a', color: '#ff8fab' }, { id: null, bot: true, name: 'Bot', color: '#4d9fff' }, { id: 'b', color: '#4d9fff' }] };
  matchColors(G); const [a, bot, b] = G.seats.map(s => s.color);
  if (a !== '#ff8fab' || b !== '#4d9fff' || bot === '#4d9fff' || !apart([a, bot, b])) fail('a bot must not take a person\'s colour: ' + [a, bot, b]);
  const before = G.seats.map(s => s.color).join(); matchColors(G); matchColors(G);
  if (G.seats.map(s => s.color).join() !== before) fail('colours move between state sends');
  Object.assign(G.seats[1], { id: 'c', bot: false, human: true, color: '#ff8fab' }); matchColors(G);
  if (G.seats[0].color !== '#ff8fab' || G.seats[2].color !== '#4d9fff' || !apart(G.seats.map(s => s.color))) fail('joiner in pink not moved: ' + G.seats.map(s => s.color)); }

// Every game, started like server.js startGame does, with everyone wearing pink.
const dir = new URL('../server/games/', import.meta.url);
let n = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith('.js') && !f.includes('worker'))) {
  const mod = await import(new URL(f, dir)); if (!mod.create || !mod.meta?.maxPlayers) continue;
  const k = Math.min(3, mod.meta.maxPlayers);
  const humans = Array.from({ length: k }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: i === 1 ? '#ff92ad' : '#ff8fab', av: [0, 0, 0, 0] }));
  const cols = distinctCols(humans.map(h => h.color));
  let G; try { G = mod.create(humans.map((h, i) => ({ ...h, color: cols[i] })), {}, null); } catch { continue; }
  if (!Array.isArray(G?.seats)) continue;
  matchColors(G);
  const got = G.seats.map(s => s.color).filter(Boolean);
  if (!apart(got)) fail(`${f}: seats share a colour: ${got}`);
  if (G.seats.find(s => s.id === 'p0')?.color !== '#ff8fab') fail(`${f}: the first pink player should keep pink`);
  n++;
}
if (n < 30) fail('only ' + n + ' games checked');
console.log('match colours OK,', n, 'games');

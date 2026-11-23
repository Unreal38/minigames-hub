// Constellations: what the endless stars after the last rank are for. Every star (ranks.js, one per STAR_EVERY levels
// after Sky Legend) lights one point of the constellation the player is working on. A finished constellation shows on
// their profile card, and one of them sits in their level chip. Shared by the server (which keeps the sky) and the hub
// (which draws it).
//
// To add a constellation: append a row to CONS (never reorder or rename ids: saved skies point at them). `p` are the
// stars on a 0-100 grid in the order they light up, `l` the lines between them (indexes into p). A line shows once
// both of its stars are lit, so order the stars so the picture grows in one piece.
import { L } from './i18n.js';

export const SETS = [L('Sky voyage', 'Podniebna wyprawa'), L('Game table', 'Stół z grami'), L('Pet farm', 'Farma zwierzaków')];
export const CONS = [
  { id: 'kite', set: 0, n: L('The Kite', 'Latawiec'), p: [[50, 6], [78, 36], [50, 64], [22, 36], [60, 80], [46, 96]], l: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [2, 4], [4, 5]] },
  { id: 'balloon', set: 0, n: L('The Balloon', 'Balon'), p: [[50, 5], [80, 18], [86, 46], [62, 66], [38, 66], [14, 46], [20, 18], [50, 94]], l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [3, 7], [4, 7]] },
  { id: 'ship', set: 0, n: L('The Skyship', 'Podniebny statek'), p: [[8, 62], [92, 62], [76, 88], [24, 88], [50, 62], [50, 6], [84, 48], [20, 48], [66, 12], [34, 26], [68, 28], [0, 46]], l: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 8], [5, 10], [10, 6], [6, 4], [5, 9], [9, 7], [7, 4], [0, 11]] },
  { id: 'die', set: 1, n: L('The Die', 'Kostka'), p: [[18, 18], [82, 18], [82, 82], [18, 82], [50, 50]], l: [[0, 1], [1, 2], [2, 3], [3, 0]] },
  { id: 'pot', set: 1, n: L('The Hot Pot', 'Garnek'), p: [[14, 40], [86, 40], [72, 84], [28, 84], [50, 16], [2, 30], [98, 30]], l: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1], [0, 5], [1, 6]] },
  { id: 'kart', set: 1, n: L('The Kart', 'Gokart'), p: [[24, 80], [78, 80], [6, 62], [34, 52], [62, 52], [96, 64], [66, 26], [42, 34]], l: [[2, 3], [3, 4], [4, 5], [5, 1], [1, 0], [0, 2], [4, 6], [3, 7]] },
  { id: 'cat', set: 2, n: L('The Cat', 'Kot'), p: [[20, 10], [38, 32], [62, 32], [80, 10], [90, 54], [50, 88], [10, 54]], l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] },
  { id: 'bunny', set: 2, n: L('The Bunny', 'Królik'), p: [[32, 4], [44, 42], [56, 42], [68, 4], [22, 64], [78, 64], [50, 94]], l: [[0, 1], [1, 2], [2, 3], [3, 5], [5, 6], [6, 4], [4, 0]] },
  { id: 'dragon', set: 2, n: L('The Dragon', 'Smok'), p: [[86, 24], [97, 8], [70, 32], [56, 48], [48, 6], [34, 28], [38, 58], [26, 72], [12, 64], [3, 44], [62, 74], [32, 92]], l: [[1, 0], [0, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 6], [6, 7], [7, 8], [8, 9], [3, 10], [7, 11]] },
];
export const conOf = id => CONS.find(c => c.id === id) || null;
export const STARS_IN_ALL = CONS.reduce((n, c) => n + c.p.length, 0);

// ---------- the rules (pure, so the server and the tests share them) ----------
// A sky is { lit: { id: stars lit }, now: id being lit, shown: id in the level chip }. tidySky hands out every star
// the player has earned but not yet placed: into `now`, and when that is full into the next unfinished one in list
// order. Stars already lit never move, so it is safe to call again and again.
const litOf = (sky, c) => Math.max(0, Math.min(c.p.length, Math.floor(+sky.lit?.[c.id]) || 0));
export const isDone = (sky, id) => { const c = conOf(id); return !!c && litOf(sky, c) === c.p.length; };
export function tidySky(sky, stars) {
  const s = { lit: {}, now: '', shown: '' };
  for (const c of CONS) { const k = litOf(sky || {}, c); if (k) s.lit[c.id] = k; }
  s.now = conOf(sky?.now) && !isDone(s, sky.now) ? sky.now : '';
  let spent = Object.values(s.lit).reduce((a, b) => a + b, 0);
  for (stars = Math.max(0, Math.floor(stars) || 0); ; spent++) {
    if (!s.now) s.now = CONS.find(c => !isDone(s, c.id))?.id || '';
    if (spent >= stars || !s.now) break;
    s.lit[s.now] = (s.lit[s.now] || 0) + 1;
    if (isDone(s, s.now)) s.now = '';
  }
  s.lit = Object.fromEntries(CONS.filter(c => s.lit[c.id]).map(c => [c.id, s.lit[c.id]])); // always in list order
  s.shown = isDone(s, sky?.shown) ? sky.shown : CONS.find(c => isDone(s, c.id))?.id || '';
  return s;
}
export const doneIds = sky => CONS.filter(c => isDone(sky, c.id)).map(c => c.id);

// ---------- the pictures (SVG strings) ----------
const INK = '#3b2219';
const f = n => +n.toFixed(1);
function star(x, y, r, on) {
  if (!on) return `<path d="M${f(x)} ${f(y - r * .62)}L${f(x + r * .62)} ${f(y)}L${f(x)} ${f(y + r * .62)}L${f(x - r * .62)} ${f(y)}z" fill="#23245c" stroke="#7d82c9" stroke-width="1.6"/>`;
  const k = r * .36, P = [[x, y - r], [x + k, y - k], [x + r, y], [x + k, y + k], [x, y + r], [x - k, y + k], [x - r, y], [x - k, y - k]].map(([a, b]) => `${f(a)} ${f(b)}`);
  const out = `<path d="M${P.join('L')}z" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
  return `<path d="M${P.join('L')}z" fill="#ffe27a"/><path d="M${f(x)} ${f(y)}L${P[2]}L${P[3]}L${P[4]}z" fill="#f5a623"/><path d="M${f(x)} ${f(y)}L${P[0]}L${P[1]}L${P[2]}z" fill="#fff3b8"/>${out}`;
}
/** A constellation with its first `lit` stars on. With `guide`, the rest shows as a faint dashed outline. */
export function conArt(c, lit = c.p.length, { size = 120, pad = 14, r = 6.5, guide = true } = {}) {
  const s = (120 - pad * 2) / 100, X = p => pad + p[0] * s, Y = p => pad + p[1] * s;
  let g = '';
  for (const [a, b] of c.l) { const on = a < lit && b < lit; if (!on && !guide) continue;
    g += `<path d="M${f(X(c.p[a]))} ${f(Y(c.p[a]))}L${f(X(c.p[b]))} ${f(Y(c.p[b]))}" stroke="${on ? '#fff6d8' : '#6d72b4'}" stroke-width="${on ? 2.6 : 1.6}"${on ? '' : ' stroke-dasharray="2 5"'} stroke-linecap="round"/>`; }
  c.p.forEach((p, i) => { if (i < lit || guide) g += star(X(p), Y(p), r, i < lit); });
  return `<svg class="cnart" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">${g}</svg>`;
}
// The blocky patch of night sky behind a picture.
export const SKY_BG = `<svg class="cnbg" viewBox="0 0 120 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0h120v120H0z" fill="#2b2d6e"/><path d="M0 120L46 70 84 96 120 62V120z" fill="#353889"/><path d="M0 0h120L70 22 30 12z" fill="#23245c"/><path fill="#9ea3ea" d="M12 30h3v3h-3zM100 20h3v3h-3zM58 108h3v3h-3zM108 92h2v2h-2zM22 96h2v2h-2zM70 8h2v2h-2z"/></svg>`;
export const conTile = (c, lit, opts) => `<div class="cntile">${SKY_BG}${conArt(c, lit, opts)}</div>`;
/** The tiny picture inside a level chip. */
export function conGlyph(c) {
  const s = 13 / 100;
  return `<svg width="17" height="17" viewBox="-2 -2 17 17" aria-hidden="true">${c.l.map(([a, b]) => `<path d="M${f(c.p[a][0] * s)} ${f(c.p[a][1] * s)}L${f(c.p[b][0] * s)} ${f(c.p[b][1] * s)}" stroke="#fff4e2" stroke-width="1.1" stroke-linecap="round"/>`).join('')}${c.p.map(p => `<circle cx="${f(p[0] * s)}" cy="${f(p[1] * s)}" r="1.5" fill="#ffd24a"/>`).join('')}</svg>`;
}

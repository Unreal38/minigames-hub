// How a domino looks, for the HUD (little SVG pictures) and for the 3D table (a canvas texture per number).
// Pips are chunky squares, and every number has its own colour so an end can be read at a glance on a phone.
import { TILES } from './rules.js';

export const PIP = ['#b9a48c', '#e5543b', '#3f8fe0', '#3fae5d', '#e08a00', '#9a5fd0', '#16999b'];
export const FACE = '#fff8ec', INK = '#3b2219';
// where the pips of each number sit on a 3×3 grid (column, row)
const SPOTS = [[], [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [2, 0], [0, 2], [2, 2]], [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]];
export const spots = v => SPOTS[v] || [];

const half = (v, x, y, s) => spots(v).map(([c, r]) => { const k = s * .2, px = x + s * (.22 + c * .28) - k / 2, py = y + s * (.22 + r * .28) - k / 2; return `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${k.toFixed(1)}" height="${k.toFixed(1)}" rx="${(k * .28).toFixed(1)}" fill="${PIP[v]}"/>`; }).join('');
// One half on its own (an open end of the line).
export const halfHtml = v => `<span class="dm-half"><svg viewBox="0 0 44 44" aria-hidden="true"><rect x="2" y="2" width="40" height="40" rx="8" fill="${FACE}" stroke="${INK}" stroke-width="3"/>${half(v, 2, 2, 40)}</svg></span>`;
// A whole tile standing upright: a on top, b below. flip swaps them.
export function tileSvg(t, { flip = false } = {}) {
  let [a, b] = TILES[t] || [0, 0]; if (flip) [a, b] = [b, a];
  return `<svg viewBox="0 0 44 84" aria-hidden="true"><rect x="2" y="2" width="40" height="80" rx="8" fill="${FACE}" stroke="${INK}" stroke-width="3"/><path d="M8 42h28" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>${half(a, 2, 1, 40)}${half(b, 2, 43, 40)}</svg>`;
}
export const tileName = t => { const [a, b] = TILES[t] || [0, 0]; return `${a}-${b}`; };
export const tileHtml = (t, cls = '') => `<span class="dm-tile ${cls}" role="img" aria-label="${tileName(t)}">${tileSvg(t)}</span>`;
// A tile you cannot see.
export const backHtml = (color = '#e08a00', cls = '') => `<span class="dm-tile back ${cls}"><svg viewBox="0 0 44 84" aria-hidden="true"><rect x="2" y="2" width="40" height="80" rx="8" fill="${color}" stroke="${INK}" stroke-width="3"/><rect x="10" y="10" width="24" height="64" rx="5" fill="#ffffff44"/></svg></span>`;

// The top of one half for the 3D tiles, painted on a square canvas.
export function paintHalf(g, S, v) {
  g.fillStyle = FACE; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#e7d6bb'; g.lineWidth = S * .05; g.strokeRect(S * .025, S * .025, S * .95, S * .95);
  g.fillStyle = PIP[v];
  for (const [c, r] of spots(v)) { const k = S * .2, x = S * (.22 + c * .28) - k / 2, y = S * (.22 + r * .28) - k / 2; g.beginPath(); g.roundRect(x, y, k, k, k * .28); g.fill(); }
}

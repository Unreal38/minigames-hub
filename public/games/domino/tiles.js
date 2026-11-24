// How a domino looks, for the HUD (little SVG pictures) and for the 3D table (a canvas texture per number).
// Pips are chunky squares, and every number has its own colour so an end can be read at a glance on a phone.
import { TILES } from './rules.js';

import { dominoLook, PIP_PATH, SPOTS, paintDominoHalf } from '../../pieceskins.js';

export const INK = '#3b2219';
// The tiles in the HUD (your hand, the open ends) wear your own tile look (Wardrobe, kind dm).
let look = dominoLook(0);
export const setTileLook = k => { look = dominoLook(k); };
export const spots = v => SPOTS[v] || [];

const half = (v, x, y, s) => spots(v).map(([c, r]) => `<path transform="translate(${(x + s * (.22 + c * .28)).toFixed(1)} ${(y + s * (.22 + r * .28)).toFixed(1)}) scale(${(s * .2).toFixed(2)})" d="${PIP_PATH[look.shape]}" fill="${look.pips[v]}"/>`).join('');
// One half on its own (an open end of the line).
export const halfHtml = v => `<span class="dm-half"><svg viewBox="0 0 44 44" aria-hidden="true"><rect x="2" y="2" width="40" height="40" rx="8" fill="${look.face}" stroke="${INK}" stroke-width="3"/>${half(v, 2, 2, 40)}</svg></span>`;
// A whole tile standing upright: a on top, b below. flip swaps them.
export function tileSvg(t, { flip = false } = {}) {
  let [a, b] = TILES[t] || [0, 0]; if (flip) [a, b] = [b, a];
  return `<svg viewBox="0 0 44 84" aria-hidden="true"><rect x="2" y="2" width="40" height="80" rx="8" fill="${look.face}" stroke="${INK}" stroke-width="3"/><path d="M8 42h28" stroke="${look.bar}" stroke-width="3" stroke-linecap="round"/>${half(a, 2, 1, 40)}${half(b, 2, 43, 40)}</svg>`;
}
export const tileName = t => { const [a, b] = TILES[t] || [0, 0]; return `${a}-${b}`; };
export const tileHtml = (t, cls = '') => `<span class="dm-tile ${cls}" role="img" aria-label="${tileName(t)}">${tileSvg(t)}</span>`;
// A tile you cannot see.
export const backHtml = (color = '#e08a00', cls = '') => `<span class="dm-tile back ${cls}"><svg viewBox="0 0 44 84" aria-hidden="true"><rect x="2" y="2" width="40" height="80" rx="8" fill="${color}" stroke="${INK}" stroke-width="3"/><rect x="10" y="10" width="24" height="64" rx="5" fill="#ffffff44"/></svg></span>`;

// The top of one half for the 3D tiles, painted on a square canvas (k: the tile look of whoever played it).
export const paintHalf = (g, S, v, k = 0) => paintDominoHalf(g, S, v, k);

// One icon set for the trail stones, used both on the 3D stones (drawn into a texture) and in the UI (cards, labels,
// legend), so a stone looks the same everywhere (Kuba 2026-11-27). The treat is Pawperty's bone, the site's treat.
const INK = '#3b2219';
const K = `stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"`;
// Pawperty's bone (public/games/paw/client.js I.bone), 24x24
const BONE = 'M6.2 4.2a2.7 2.7 0 0 1 2.6 3.3l7.7 7.7a2.7 2.7 0 1 1 1 4.6 2.7 2.7 0 1 1-4.6-1L5.2 11.1a2.7 2.7 0 1 1-1-4.6 2.7 2.7 0 0 1 2-2.3z';
const bone = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="${BONE}" fill="#e2a868" stroke="${INK}" stroke-width="${(1.8 / s).toFixed(2)}" stroke-linejoin="round"/></g>`;
const badge = (x, y, r, minus) => {
  const d = minus ? `M${x - r} ${y}h${2 * r}` : `M${x - r} ${y}h${2 * r}M${x} ${y - r}v${2 * r}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`;
};
const star = (cx, cy, ro, ri, n = 5) => Array.from({ length: n * 2 }, (_, k) => { const a = -Math.PI / 2 + k / (n * 2) * Math.PI * 2, r = k % 2 ? ri : ro; return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
const spiky = (cx, cy, ro, ri, n = 4) => star(cx, cy, ro, ri, n);
const wave = x => `M${x} 25c-3.5-4.5 3.5-8 0-14`;

// inner markup in a 32x32 box
export const STONE_SVG = {
  treat: `${bone(0, 4, 1.2)}${badge(25, 7.5, 3.6)}`,
  picnic: `<path d="M8 15c0-5 4-8 8-8s8 3 8 8" fill="none" ${K}/><path d="M7 15h18l-2.2 10H9.2z" fill="#c98a52" ${K}/><rect x="7" y="13.5" width="18" height="3.4" rx="1" fill="#ff5c8a" ${K}/>${badge(25.5, 7.5, 3.4)}`,
  bramble: `<polygon points="${spiky(14, 17, 10, 4.5)}" fill="#4d7a32" ${K}/>${badge(25, 8, 3.6, true)}`,
  stall: `<rect x="8.5" y="13" width="15" height="12" fill="#ffd36b" ${K}/><path d="M12 13a4 4 0 0 1 8 0" fill="none" ${K}/><rect x="8.5" y="13" width="15" height="3.2" fill="#ff7a59" ${K}/>`,
  nest: `<ellipse cx="16" cy="21" rx="9.5" ry="4" fill="#b07a4a" ${K}/><ellipse cx="16" cy="15" rx="5" ry="6.5" fill="#fff6e2" ${K}/><circle cx="14.5" cy="13.5" r="1.2" fill="#9fd8ff"/><circle cx="17.5" cy="16.5" r="1" fill="#9fd8ff"/>`,
  bench: `<path d="M16 25C3.5 16.5 7.5 6.5 16 11.5c8.5-5 12.5 5 0 13.5z" fill="#ff6f9a" ${K}/>`,
  well: `<polygon points="${star(16, 16.5, 10, 4.3)}" fill="#ffe27a" ${K}/>`,
  spring: `<g fill="none" stroke-linecap="round">${[11, 16, 21].map(x => `<path d="${wave(x)}" stroke="${INK}" stroke-width="2.4"/><path d="${wave(x)}" stroke="#fff" stroke-width="1"/>`).join('')}</g>`,
  den: `<polygon points="${star(16, 16, 9.5, 4)}" fill="#ffd34d" ${K}/><circle cx="14.3" cy="15.5" r=".9" fill="${INK}"/><circle cx="17.7" cy="15.5" r=".9" fill="${INK}"/>`,
};
export const stoneSvg = (kind, cls = 'tt-si') => STONE_SVG[kind] ? `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true">${STONE_SVG[kind]}</svg>` : '';
// the treat on its own (no badge), for counters and prices
export const TREAT_SVG = `<svg class="tt-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${BONE}" fill="#e2a868" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
// a standalone SVG file for drawing into a canvas (the 3D stones)
export const stoneSvgFile = (kind, px = 128) => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 32 32">${STONE_SVG[kind] || ''}</svg>`;

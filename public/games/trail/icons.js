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
  bone: `${bone(2.5, 2.5, 1.12)}`, // a single treat, for the treats that fly between a stone and a player
  // a basket on a checked picnic cloth
  picnic: `<path d="M3 26.5 9 19h15l5 7.5z" fill="#fff" ${K}/><path d="M7.5 21h4l-1.6 2.3h-4.4zM15 21h4l1.2 2.3h-4.4zM8 25h4.5l1-1.7h4.5l1 1.7h4.5" fill="#ff5c8a"/><path d="M11 15c0-4 2.4-6 5-6s5 2 5 6" fill="none" ${K}/><path d="M9.5 14h13l-1.6 7.5h-9.8z" fill="#c98a52" ${K}/><path d="M11 17.3h10" stroke="${INK}" stroke-width="1.2"/>${badge(26, 7, 3.4)}`,
  // a thorny bramble branch with berries
  bramble: `<path d="M5 25C9 18 15 13 24 8" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M5 25C9 18 15 13 24 8" fill="none" stroke="#7cc04a" stroke-width="2.4" stroke-linecap="round"/><path d="M8.6 19.6l-3-2.6 4.6-.4zM12.5 15.5l-1-3.9 3.6 2.2zM15.4 17.4l3.7 1.2-3.9 1.4zM19.6 11.3l.2-3.9 2.5 3zM21.6 13l3.6 1.6-4 .9z" fill="#e8e1c8" ${K}/><circle cx="11" cy="23" r="2.5" fill="#8e3b8a" ${K}/><circle cx="15" cy="23.6" r="2.1" fill="#b04aa8" ${K}/>${badge(26, 21, 3.4, true)}`,
  // a market stall with a striped awning
  stall: `<path d="M8 14.5v11.5M24 14.5v11.5" stroke="${INK}" stroke-width="1.8"/><rect x="7" y="19.5" width="18" height="6" rx="1" fill="#c98a52" ${K}/><circle cx="12" cy="18.6" r="1.7" fill="#ff5c8a" ${K}/><circle cx="16.5" cy="18.6" r="1.7" fill="#ffd36b" ${K}/><circle cx="21" cy="18.6" r="1.7" fill="#7ac74f" ${K}/><path d="M5 13 8 6h16l3 7z" fill="#fff" ${K}/><path d="M9.7 6h3.7l-.9 7H7.5zM16.1 6h3.7l2 7h-4.6z" fill="#ff7a59"/><path d="M5 13q2.75 3 5.5 0 2.75 3 5.5 0 2.75 3 5.5 0 2.75 3 5.5 0" fill="#ff7a59" ${K}/><path d="M5 13 8 6h16l3 7" fill="none" ${K}/>`,
  nest: `<ellipse cx="16" cy="21" rx="9.5" ry="4" fill="#b07a4a" ${K}/><ellipse cx="16" cy="15" rx="5" ry="6.5" fill="#fff6e2" ${K}/><circle cx="14.5" cy="13.5" r="1.2" fill="#9fd8ff"/><circle cx="17.5" cy="16.5" r="1" fill="#9fd8ff"/><path d="M8 20.5l3 1.2M24 20.5l-3 1.2M13 24.3l1.5-1.4M19 24.3l-1.5-1.4" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`,
  // a park bench with a heart: make a buddy pact here
  bench: `<path d="M9 21v6M23 21v6M10 21v-3M22 21v-3" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><rect x="5.5" y="12.5" width="21" height="5" rx="1.5" fill="#c98a52" ${K}/><rect x="5" y="19.5" width="22" height="3" rx="1.2" fill="#e0a86e" ${K}/><path d="M16 11C10 6.8 12.2 1.8 16 4.4c3.8-2.6 6 2.4 0 6.6z" fill="#ff6f9a" ${K}/>`,
  // a wishing well with a little roof and a wish star
  well: `<path d="M9 13v8M23 13v8" stroke="${INK}" stroke-width="2"/><path d="M5.5 13.5 16 6.5l10.5 7z" fill="#e5543b" ${K}/><path d="M7.5 20h17v5.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="#b9c3cf" ${K}/><path d="M7.5 23.5h17M12 20v3.5M20 20v3.5M16 23.5v4" stroke="${INK}" stroke-width="1.2"/><ellipse cx="16" cy="20" rx="8.5" ry="2" fill="#5fb4ff" ${K}/><polygon points="${star(26.5, 5.5, 4.2, 1.9)}" fill="#ffe27a" ${K}/>`,
  // a steaming pool
  spring: `<ellipse cx="16" cy="22.5" rx="12" ry="5" fill="#b9c3cf" ${K}/><ellipse cx="16" cy="22" rx="8.6" ry="3" fill="#5fd0e6" stroke="${INK}" stroke-width="1.2"/><g fill="none" stroke-linecap="round">${[11, 16, 21].map(x => `<path d="M${x} 18c-2.6-3 2.6-5.2 0-9.5" stroke="${INK}" stroke-width="3"/><path d="M${x} 18c-2.6-3 2.6-5.2 0-9.5" stroke="#fff" stroke-width="1.4"/>`).join('')}</g>`,
  // a rocky den with a dark opening and a rare star
  den: `<path d="M3 26.5C4 15 9.5 9.5 16 9.5S28 15 29 26.5z" fill="#9a8a78" ${K}/><path d="M10.5 26.5c0-5.4 2.4-8.6 5.5-8.6s5.5 3.2 5.5 8.6z" fill="#2a1d18" ${K}/><circle cx="14.2" cy="22.6" r=".9" fill="#ffe27a"/><circle cx="17.8" cy="22.6" r=".9" fill="#ffe27a"/><polygon points="${star(24.5, 7, 4.6, 2)}" fill="#ffd34d" ${K}/>`,
};
export const stoneSvg = (kind, cls = 'tt-si') => STONE_SVG[kind] ? `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true">${STONE_SVG[kind]}</svg>` : '';
// the treat on its own (no badge), for counters and prices
export const TREAT_SVG = `<svg class="tt-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${BONE}" fill="#e2a868" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
// a standalone SVG file for drawing into a canvas (the 3D stones)
export const stoneSvgFile = (kind, px = 128) => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 32 32">${STONE_SVG[kind] || ''}</svg>`;

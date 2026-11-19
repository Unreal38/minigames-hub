// Cute hot-pot ingredient illustrations (inline SVG, 100x100). Each gets a little kawaii face.
const O = '#3b2219'; // outline ink

// eyes + smile + blush centred at (x, y); s scales it
function face(x, y, s = 1, eye = O) {
  const e = 4.2 * s, d = 9 * s;
  return `<g>
  <ellipse cx="${x - d - 6 * s}" cy="${y + 5 * s}" rx="${5 * s}" ry="${3 * s}" fill="#ff7a8a" opacity=".55"/>
  <ellipse cx="${x + d + 6 * s}" cy="${y + 5 * s}" rx="${5 * s}" ry="${3 * s}" fill="#ff7a8a" opacity=".55"/>
  <ellipse cx="${x - d}" cy="${y}" rx="${e * .78}" ry="${e}" fill="${eye}"/>
  <ellipse cx="${x + d}" cy="${y}" rx="${e * .78}" ry="${e}" fill="${eye}"/>
  <circle cx="${x - d + 1.3 * s}" cy="${y - 1.6 * s}" r="${1.4 * s}" fill="#fff"/>
  <circle cx="${x + d + 1.3 * s}" cy="${y - 1.6 * s}" r="${1.4 * s}" fill="#fff"/>
  <path d="M${x - 3.6 * s} ${y + 4 * s} q${3.6 * s} ${4 * s} ${7.2 * s} 0" fill="none" stroke="${eye}" stroke-width="${2.2 * s}" stroke-linecap="round"/>
  </g>`;
}
const sw = 'stroke="' + O + '" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"';

const ICONS = [
  // 0 Beef slice — marbled ruffled slice
  `<path d="M14 58c0-20 18-36 40-36 18 0 32 10 32 26 0 18-16 32-40 32-18 0-32-8-32-22z" fill="#e8584a" ${sw}/>
   <path d="M26 46c10-6 22 2 30-4M30 64c10 2 18-6 28-2M62 34c6 4 12 2 16 8" fill="none" stroke="#ffd9cf" stroke-width="4" stroke-linecap="round"/>
   ${face(52, 54, .95)}`,
  // 1 Pork belly — layered block
  `<rect x="16" y="28" width="68" height="46" rx="10" fill="#ffd2c4" ${sw}/>
   <path d="M17 44h66M17 58h66" stroke="#f08a7a" stroke-width="7"/>
   <path d="M16 38c0-6 4-10 10-10h48c6 0 10 4 10 10" fill="#c8794e" ${sw}/>
   ${face(50, 52, .95)}`,
  // 2 Lamb roll — spiral
  `<circle cx="50" cy="52" r="34" fill="#e06a5a" ${sw}/>
   <path d="M50 52m-4 0a4 4 0 1 1 8 0a10 10 0 1 1-20 0a16 16 0 1 1 32 0a22 22 0 1 1-44 0" fill="none" stroke="#fff0e6" stroke-width="4.5" stroke-linecap="round" opacity=".9"/>
   <circle cx="50" cy="56" r="15" fill="#e06a5a"/>${face(50, 54, .9)}`,
  // 3 Shrimp — curled
  `<path d="M70 26c-26-8-50 8-50 32 0 14 10 22 22 22 14 0 20-10 18-18" fill="none" stroke="${O}" stroke-width="22" stroke-linecap="round"/>
   <path d="M70 26c-26-8-50 8-50 32 0 14 10 22 22 22 14 0 20-10 18-18" fill="none" stroke="#ff9a62" stroke-width="15.5" stroke-linecap="round"/>
   <path d="M38 36l6 10M28 50l10 4M30 66l10-4" stroke="#ffd0ad" stroke-width="3.5" stroke-linecap="round"/>
   <path d="M70 26l12-8 2 14z" fill="#ff7b45" ${sw}/>${face(58, 42, .7)}`,
  // 4 Fish balls — skewer of three
  `<path d="M14 86L88 14" stroke="#c99a62" stroke-width="5" stroke-linecap="round"/>
   <circle cx="30" cy="70" r="14" fill="#fffaf0" ${sw}/><circle cx="70" cy="30" r="14" fill="#fffaf0" ${sw}/>
   <circle cx="50" cy="50" r="18" fill="#fffaf0" ${sw}/>${face(50, 50, .8)}`,
  // 5 Squid
  `<path d="M50 12c14 10 22 24 22 40H28c0-16 8-30 22-40z" fill="#ffe1e6" ${sw}/>
   <path d="M30 52c-2 12-10 20-10 28M40 52c0 14-4 22-4 32M50 52v34M60 52c0 14 4 22 4 32M70 52c2 12 10 20 10 28" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/>
   <path d="M30 52c-2 12-10 20-10 28M40 52c0 14-4 22-4 32M50 52v34M60 52c0 14 4 22 4 32M70 52c2 12 10 20 10 28" fill="none" stroke="#ffc7d1" stroke-width="4" stroke-linecap="round"/>
   <rect x="27" y="46" width="46" height="12" rx="6" fill="#ffe1e6" ${sw}/>${face(50, 36, .8)}`,
  // 6 Bok choy
  `<path d="M50 90c-10 0-14-14-14-30V40h28v20c0 16-4 30-14 30z" fill="#f1fbe6" ${sw}/>
   <path d="M36 44C20 40 14 22 26 12c10 4 16 14 20 28M64 44c16-4 22-22 10-32-10 4-16 14-20 28M50 42C42 26 44 12 50 6c6 6 8 20 0 36" fill="#62bf55" ${sw}/>
   ${face(50, 64, .8)}`,
  // 7 Spinach — single leaf
  `<path d="M50 88c-6-10-8-18-8-24C24 60 14 44 18 26 30 14 52 12 68 18c16 8 20 26 12 40-6 10-18 12-30 8" fill="#2f9e4b" ${sw}/>
   <path d="M44 66C40 50 44 34 60 22" fill="none" stroke="#bfeec5" stroke-width="3" stroke-linecap="round"/>
   ${face(52, 46, .85, '#173a1c')}`,
  // 8 Napa cabbage
  `<path d="M28 88c-8-20-12-44-4-64 8-14 44-14 52 0 8 20 4 44-4 64z" fill="#f3f8cf" ${sw}/>
   <path d="M30 30c6-10 34-10 40 0 4 10 2 22-2 30-10-4-26-4-36 0-4-8-6-20-2-30z" fill="#b5dd6a" ${sw}/>
   <path d="M50 30v56" stroke="#d9e7a3" stroke-width="4" stroke-linecap="round"/>${face(50, 70, .75)}`,
  // 9 Enoki — bundle
  `<path d="M34 86h32l-4-16H38z" fill="#d9b48a" ${sw}/>
   ${[30, 40, 50, 60, 70].map((x, i) => `<path d="M${50 + (x - 50) * .25} 72Q${x} 46 ${x} ${24 + (i % 2) * 6}" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M${50 + (x - 50) * .25} 72Q${x} 46 ${x} ${24 + (i % 2) * 6}" fill="none" stroke="#fffaf0" stroke-width="3" stroke-linecap="round"/><ellipse cx="${x}" cy="${22 + (i % 2) * 6}" rx="5" ry="4" fill="#fff4dc" ${sw}/>`).join('')}
   <rect x="34" y="58" width="32" height="18" rx="7" fill="#fffaf0" ${sw}/>${face(50, 66, .55)}`,
  // 10 Shiitake
  `<path d="M40 56h20v22c0 8-20 8-20 0z" fill="#f6e6cf" ${sw}/>
   <path d="M12 54c0-22 18-38 38-38s38 16 38 38c0 4-6 6-38 6S12 58 12 54z" fill="#8f5a37" ${sw}/>
   <path d="M30 34l6 6M64 30l-4 8M50 26v6" stroke="#e8c79f" stroke-width="3.5" stroke-linecap="round"/>${face(50, 44, .85, '#2a160d')}`,
  // 11 Wood ear — ruffled
  `<path d="M18 56c-6-18 8-36 26-36 6-6 18-6 24 2 14 0 22 14 18 26 6 10 0 24-14 26-8 8-22 8-30 2-14 2-26-8-24-20z" fill="#4e3329" ${sw}/>
   <path d="M30 50c6-10 18-14 30-10M34 66c10 4 22 2 30-6" fill="none" stroke="#7b5a4d" stroke-width="3" stroke-linecap="round"/>${face(50, 54, .85, '#fff')}`,
  // 12 Udon — nest of thick noodles
  `<ellipse cx="50" cy="56" rx="38" ry="28" fill="#fff1c7" ${sw}/>
   <path d="M18 54c10-8 18 8 28 0s18 8 28 0 10 4 12 6M20 66c10-8 18 8 28 0s18 8 28 0M24 42c10-6 18 8 28 0s18 8 26 2" fill="none" stroke="#e9c766" stroke-width="5" stroke-linecap="round"/>
   ${face(50, 56, .85)}`,
  // 13 Rice cakes — ovals
  `<ellipse cx="34" cy="62" rx="20" ry="13" fill="#fffdf7" ${sw} transform="rotate(-18 34 62)"/>
   <ellipse cx="66" cy="62" rx="20" ry="13" fill="#fffdf7" ${sw} transform="rotate(18 66 62)"/>
   <ellipse cx="50" cy="42" rx="24" ry="16" fill="#fffdf7" ${sw}/>${face(50, 42, .75)}`,
  // 14 Glass noodles — translucent loops in a little bowl
  `<path d="M14 50h72c0 22-16 36-36 36S14 72 14 50z" fill="#ffb562" ${sw}/>
   <path d="M24 50c-2-18 12-30 18-20s-14 18 6 20M44 50c0-20 18-30 22-18s-12 16 4 18" fill="none" stroke="#bfe8f2" stroke-width="5" stroke-linecap="round"/>
   <path d="M14 50h72" ${sw}/>${face(50, 66, .85)}`,
  // 15 Tofu — cube
  `<path d="M24 38l26-14 28 14v32l-28 14-26-14z" fill="#fff6dc" ${sw}/>
   <path d="M24 38l26 14 28-14M50 52v32" fill="none" ${sw}/>
   <path d="M24 38l26-14 28 14-28 14z" fill="#ffffff"/>
   <path d="M24 38l26-14 28 14-28 14z" fill="none" ${sw}/>${face(38, 62, .72)}`,
  // 16 Dumpling — pleated crescent
  `<path d="M12 64c0-24 18-38 38-38s38 14 38 38c0 6-6 10-38 10S12 70 12 64z" fill="#fff8ea" ${sw}/>
   <path d="M30 34c2 6 0 10-2 12M42 28c2 6 2 10 0 14M56 28c0 6 0 10 2 14M70 34c-2 6 0 10 2 12" fill="none" stroke="#e7cfa6" stroke-width="3.5" stroke-linecap="round"/>
   ${face(50, 56, .85)}`,
  // 17 Quail eggs — two speckled eggs
  `<ellipse cx="34" cy="58" rx="18" ry="23" fill="#f6eadb" ${sw} transform="rotate(-12 34 58)"/>
   <ellipse cx="64" cy="54" rx="20" ry="26" fill="#fbf2e6" ${sw} transform="rotate(10 64 54)"/>
   <circle cx="28" cy="46" r="3" fill="#9a7a62"/><circle cx="40" cy="70" r="2.4" fill="#9a7a62"/><circle cx="72" cy="36" r="3" fill="#9a7a62"/><circle cx="58" cy="76" r="2.6" fill="#9a7a62"/>
   ${face(64, 56, .7)}`,
];

export const iconSvg = (kind, extra = '') =>
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>${ICONS[kind]}</svg>`;

// Card back: a little steaming pot
export const backSvg = (extra = '') => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>
  <path d="M34 30c-4-6 4-10 0-16M50 28c-4-6 4-10 0-16M66 30c-4-6 4-10 0-16" fill="none" stroke="#ffe7c2" stroke-width="4" stroke-linecap="round" opacity=".85"/>
  <path d="M16 44h68c0 22-14 38-34 38S16 66 16 44z" fill="#ffd27a" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
  <rect x="10" y="38" width="80" height="10" rx="5" fill="#ffe7a8" stroke="${O}" stroke-width="3.5"/>
  ${face(50, 62, .85)}</svg>`;

export const ICON_COUNT = ICONS.length;

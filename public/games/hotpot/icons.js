// Cute hot-pot ingredient illustrations (inline SVG, 100x100). Each gets a little kawaii face.
// No ids, gradients or clip paths: the same icon is inlined many times per page and also painted onto 3D card textures.
const O = '#3b2219'; // outline ink

// Big sparkly eyes, a small mouth and rosy cheeks centred at (x, y); s scales it. mouth: 0 smile, 1 open, 2 cat
function face(x, y, s = 1, eye = O, mouth = 0) {
  const e = 5.5 * s, d = 9.6 * s, hl = eye === '#fff' ? '#4e3329' : '#fff', my = y + 4.6 * s;
  const m = mouth === 1 ? `<path d="M${x - 3 * s} ${my - .6 * s}h${6 * s}c0 ${6 * s}-${6 * s} ${6 * s}-${6 * s} 0z" fill="#8a2f2f" stroke="${eye}" stroke-width="${1.7 * s}" stroke-linejoin="round"/><ellipse cx="${x}" cy="${my + 2.9 * s}" rx="${1.7 * s}" ry="${1.1 * s}" fill="#ff8fa0"/>`
    : mouth === 2 ? `<path d="M${x - 4.4 * s} ${my}q${2.2 * s} ${3.4 * s} ${4.4 * s} 0q${2.2 * s} ${3.4 * s} ${4.4 * s} 0" fill="none" stroke="${eye}" stroke-width="${2 * s}" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M${x - 2.8 * s} ${my}q${2.8 * s} ${3.6 * s} ${5.6 * s} 0" fill="none" stroke="${eye}" stroke-width="${2.1 * s}" stroke-linecap="round"/>`;
  return `<g>
  <ellipse cx="${x - d - 7.5 * s}" cy="${y + 6.5 * s}" rx="${5.6 * s}" ry="${3.5 * s}" fill="#ff7a8a" opacity=".62"/>
  <ellipse cx="${x + d + 7.5 * s}" cy="${y + 6.5 * s}" rx="${5.6 * s}" ry="${3.5 * s}" fill="#ff7a8a" opacity=".62"/>
  <g class="fx-eyes"><ellipse cx="${x - d}" cy="${y}" rx="${e * .84}" ry="${e}" fill="${eye}"/>
  <ellipse cx="${x + d}" cy="${y}" rx="${e * .84}" ry="${e}" fill="${eye}"/>
  <circle cx="${x - d + 1.5 * s}" cy="${y - 2.1 * s}" r="${2.1 * s}" fill="${hl}"/>
  <circle cx="${x + d + 1.5 * s}" cy="${y - 2.1 * s}" r="${2.1 * s}" fill="${hl}"/>
  <circle cx="${x - d - 1.8 * s}" cy="${y + 2.3 * s}" r="${1 * s}" fill="${hl}" opacity=".9"/>
  <circle cx="${x + d - 1.8 * s}" cy="${y + 2.3 * s}" r="${1 * s}" fill="${hl}" opacity=".9"/></g>
  ${m}</g>`;
}
// a snoozing face for the little sidekicks
function nap(x, y, s = 1, eye = O) {
  return `<g><ellipse cx="${x - 9 * s}" cy="${y + 4 * s}" rx="${3.6 * s}" ry="${2.2 * s}" fill="#ff7a8a" opacity=".6"/><ellipse cx="${x + 9 * s}" cy="${y + 4 * s}" rx="${3.6 * s}" ry="${2.2 * s}" fill="#ff7a8a" opacity=".6"/>
  <path d="M${x - 8 * s} ${y}q${2.5 * s} ${3 * s} ${5 * s} 0M${x + 3 * s} ${y}q${2.5 * s} ${3 * s} ${5 * s} 0M${x - 1.6 * s} ${y + 4 * s}q${1.6 * s} ${2 * s} ${3.2 * s} 0" fill="none" stroke="${eye}" stroke-width="${1.9 * s}" stroke-linecap="round"/></g>`;
}
// a four-point sparkle
const sp = (x, y, r = 5, col = '#ffd36b') => { const k = r * .32; return `<path class="fx-sp" d="M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}z" fill="${col}" stroke="${O}" stroke-width="1.600" stroke-linejoin="round"/>`; };
const heart = (x, y, k = 1) => `<path class="fx-hrt" d="M${x} ${y + 4 * k}c${-7 * k}${-4.5 * k} ${-5 * k}${-10 * k} 0${-6 * k}c${5 * k}${-4 * k} ${7 * k} ${1.5 * k} 0 ${6 * k}z" fill="#ff7a8a" stroke="${O}" stroke-width="1.600" stroke-linejoin="round"/>`;
const sw = 'stroke="' + O + '" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"';
const ln = (d, col, w = 3, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const hi = (d, w = 3, o = .75) => ln(d, '#fff', w, `opacity="${o}"`); // glossy highlight
const gs = (rx = 30, cx = 50, cy = 91) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="4.5" fill="${O}" opacity=".13"/>`; // ground shadow
// an outlined, softly shaded ball
const ball = (cx, cy, r, fill, shade) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade}" ${sw}/><circle cx="${cx - r * .1}" cy="${cy - r * .12}" r="${r * .8}" fill="${fill}"/>`;
// an outlined noodle: ink underneath, colour on top
const strand = (d, col, w = 6) => ln(d, O, w + 5) + ln(d, col, w);

const ICONS = [
  // 0 Beef slice — marbled ruffled slice with a rim of fat
  `${gs(32, 50, 88)}<path d="M14 58c0-20 18-36 40-36 18 0 32 10 32 26 0 18-16 32-40 32-18 0-32-8-32-22z" fill="#e8584a" ${sw}/>
   <path d="M19 64c5 10 15 13 27 13 20 0 34-10 37-24-7 10-19 16-36 16-13 0-22-1-28-5z" fill="#c23f33" opacity=".6"/>
   ${ln('M20 51c3-14 16-24 33-24 10 0 19 3 25 9', '#ffd9cf', 4.5)}
   ${ln('M27 49c8-5 15 2 22-2M32 67c9 2 16-5 25-2M63 39c5 3 10 2 14 7', '#ffc4b6', 3.2)}
   ${sp(84, 22, 5.5)}${sp(15, 30, 3.5)}${face(51, 56, 1)}`,
  // 1 Pork belly — layered block with a seared top
  `${gs(34)}<path d="M19 36l9-14h50l5 14z" fill="#d98a5c" ${sw}/>
   ${ln('M38 25l-4 8M53 25l-4 8M68 25l-4 8', '#b5683e', 3)}
   <rect x="16" y="34" width="68" height="46" rx="9" fill="#ffd9cc" ${sw}/>
   <path d="M18 43h64v9H18zM18 62h64v8H18z" fill="#f08a7a"/><path d="M18 70h64v3H18z" fill="#e06a5a" opacity=".7"/>
   ${hi('M24 39h12M62 57h14', 2.6, .8)}
   <rect x="16" y="34" width="68" height="46" rx="9" fill="none" ${sw}/>
   ${heart(88, 20)}${face(50, 58, .95, O, 1)}`,
  // 2 Lamb roll — a rolled slice with a spiral of fat
  `${gs(32, 52)}<circle cx="55" cy="55" r="32" fill="#c24f41" ${sw}/>
   <circle cx="46" cy="49" r="32" fill="#e8705f" ${sw}/>
   <path d="M46 49m-5 0a5 5 0 1 1 10 0a11 11 0 1 1-22 0a17 17 0 1 1 34 0a23 23 0 1 1-46 0" fill="none" stroke="#fff0e6" stroke-width="4.5" stroke-linecap="round" opacity=".92"/>
   <circle cx="46" cy="53" r="15" fill="#e8705f"/>${hi('M24 38c3-6 8-11 14-13', 3, .6)}${sp(86, 20, 5.5)}${face(46, 52, .95)}`,
  // 3 Shrimp — curled, striped, with a tail fan and feelers
  `${gs(30, 46)}${ln('M64 58c8-5 15-3 19 3M66 66c8-1 13 3 15 9', O, 2.4)}
   <path d="M70 27l10-13 3 9 8 3-11 8z" fill="#ff7b45" ${sw}/>
   <circle cx="52" cy="68" r="17" fill="${O}"/>
   ${ln('M72 27c-28-8-52 8-50 32 1 12 10 20 26 19', O, 22)}${ln('M72 27c-28-8-52 8-50 32 1 12 10 20 26 19', '#ff9a62', 15.5)}
   <circle cx="52" cy="68" r="13.8" fill="#ff9a62"/>
   ${ln('M56 23l1 14M41 26l4 13M29 37l10 9M23 53l13 2M26 68l12-4', '#e8743c', 3)}
   ${hi('M30 44c4-8 12-13 22-14', 2.6, .55)}${sp(86, 44, 4.5)}${sp(14, 22, 3.5)}${face(52, 66, .62)}`,
  // 4 Fish balls — skewer of three
  `${gs(30)}${ln('M12 88L90 12', O, 7)}${ln('M12 88L90 12', '#d9ad74', 3.4)}
   ${ball(29, 71, 14, '#fffaf0', '#e6d8bf')}${ball(71, 29, 14, '#fffaf0', '#e6d8bf')}${ball(50, 50, 18, '#fffaf0', '#e6d8bf')}
   ${hi('M21 65c1-3 4-5 7-6M63 23c1-3 4-5 7-6M39 43c2-4 5-7 10-8', 2.6, .9)}${nap(29, 70, .62)}${nap(71, 28, .62)}${sp(20, 30, 5)}${face(50, 50, .78, O, 1)}`,
  // 5 Squid — mantle, fins and curly tentacles
  `${gs(30)}<path d="M36 26l-16 3 10 13zM64 26l16 3-10 13z" fill="#ffc7d1" ${sw}/>
   ${ln('M30 54c-2 12-10 18-9 27M40 54c0 14-5 20-3 31M50 54v33M60 54c0 14 5 20 3 31M70 54c2 12 10 18 9 27', O, 9.5)}
   ${ln('M30 54c-2 12-10 18-9 27M40 54c0 14-5 20-3 31M50 54v33M60 54c0 14 5 20 3 31M70 54c2 12 10 18 9 27', '#ffc7d1', 4.6)}
   <path d="M50 10c14 10 22 24 22 42H28c0-18 8-32 22-42z" fill="#ffe6ea" ${sw}/>
   <path d="M62 24c5 8 7 17 7 26h-8c0-10-1-18 1-26z" fill="#ffc7d1" opacity=".7"/>
   <circle cx="42" cy="22" r="2.2" fill="#ffb3c1"/><circle cx="55" cy="18" r="1.8" fill="#ffb3c1"/><circle cx="49" cy="26" r="1.6" fill="#ffb3c1"/>
   <rect x="26" y="47" width="48" height="12" rx="6" fill="#ffe6ea" ${sw}/>${sp(86, 18, 5)}${heart(14, 20, .9)}${face(50, 38, .82, O, 2)}`,
  // 6 Bok choy — pale ribbed stem, three veined leaves
  `${gs(22)}<path d="M36 44C20 40 13 22 26 11c10 4 16 14 20 29M64 44c16-4 23-22 10-33-10 4-16 14-20 29" fill="#4fae48" ${sw}/>
   <path d="M50 44C41 27 43 12 50 5c7 7 9 22 0 39" fill="#6cc95c" ${sw}/>
   ${ln('M28 18c4 8 8 14 12 22M72 18c-4 8-8 14-12 22M50 12v28', '#c9f0b8', 2.4)}
   <path d="M50 90c-11 0-15-14-15-30V41h30v19c0 16-4 30-15 30z" fill="#f4fbe8" ${sw}/>
   <path d="M58 44h5v16c0 13-3 24-10 27 4-7 5-17 5-27z" fill="#d6ecc0" opacity=".8"/>
   ${ln('M43 46c-1 14 0 26 3 36M50 46v10', '#cfe5b6', 2.4)}${sp(86, 56, 5)}${face(50, 66, .72)}`,
  // 7 Spinach — one dark leaf with branching veins
  `${gs(24, 50, 90)}<path d="M50 88c-6-10-8-18-8-24C24 60 14 44 18 26 30 14 52 12 68 18c16 8 20 26 12 40-6 10-18 12-30 8" fill="#2f9e4b" ${sw}/>
   <path d="M72 24c10 9 11 22 6 32-5 8-15 10-26 8 14-4 24-18 20-40z" fill="#237d3a" opacity=".65"/>
   ${ln('M45 70C40 52 44 34 62 21', '#a9e6b2', 3)}${ln('M45 56l-14-8M47 44l-13-12M53 33l-5-13M48 58l16-2M52 44l18-6', '#a9e6b2', 2.2, 'opacity=".8"')}
   ${sp(88, 76, 5)}${sp(14, 74, 3.5)}${face(51, 45, .88, '#173a1c')}`,
  // 8 Napa cabbage — frilly leaf over a wide white rib
  `${gs(26)}<path d="M28 88c-8-20-12-42-5-61 2-5 6-4 8-8 3-5 8-2 11-6 3-4 8-1 11-1s8-3 11 1c3 4 8 1 11 6 2 4 6 3 8 8 7 19 3 41-5 61z" fill="#f6f9d9" ${sw}/>
   <path d="M29 34c1-6 5-5 7-9 3-4 7-2 10-5 2-2 6-1 8 0 3 3 7 1 10 5 2 4 6 3 7 9 3 10 1 20-3 28-10-4-26-4-36 0-4-8-6-18-3-28z" fill="#b5dd6a" ${sw}/>
   ${ln('M50 26v60M42 40c2 10 4 18 5 30M58 40c-2 10-4 18-5 30', '#e3efb4', 3)}
   ${hi('M34 68c0 6 1 11 3 15', 2.6, .8)}${sp(88, 18, 5)}${face(50, 70, .78, O, 1)}`,
  // 9 Enoki — a bundle of thin stems with tiny caps
  `${gs(22)}<path d="M33 88h34l-4-18H37z" fill="#d9b48a" ${sw}/>${ln('M40 78l-1 6M50 78v6M60 78l1 6', '#b98e62', 2.4)}
   ${[26, 38, 50, 62, 74].map((x, i) => { const d = `M${50 + (x - 50) * .25} 72Q${x} 46 ${x} ${24 + (i % 2) * 6}`; return `${ln(d, O, 7.4)}${ln(d, '#fffaf0', 3.4)}<ellipse cx="${x}" cy="${21 + (i % 2) * 6}" rx="6" ry="4.6" fill="#fff0cf" ${sw}/>`; }).join('')}
   <rect x="33" y="57" width="34" height="19" rx="7" fill="#fffaf0" ${sw}/>${sp(86, 60, 5)}${sp(14, 56, 3.5)}${face(50, 64, .5)}`,
  // 10 Shiitake — scored cap on a short stem
  `${gs(28)}<path d="M39 56h22v23c0 9-22 9-22 0z" fill="#f6e6cf" ${sw}/>
   <path d="M54 60h5v19c0 3-2 5-5 6 1-8 0-16 0-25z" fill="#dcc5a4" opacity=".8"/>
   <path d="M11 54c0-22 18-39 39-39s39 17 39 39c0 4-6 7-39 7s-39-3-39-7z" fill="#8f5a37" ${sw}/>
   <path d="M15 55c8 3 22 4 35 4s27-1 35-4c-1 3-9 5-35 5s-34-2-35-5z" fill="#6e4126" opacity=".7"/>
   ${ln('M50 21v11M44 26.500h12M27 33l8 6M35 32l-8 8M73 33l-8 6M65 32l8 8', '#f1d6ad', 3.2)}
   ${hi('M20 44c2-8 7-14 13-18', 3, .35)}${sp(88, 76, 5)}${heart(13, 78, .9)}${face(50, 45, .92, '#2a160d')}`,
  // 11 Wood ear — dark, glossy ruffles
  `${gs(32, 50, 88)}<path d="M18 56c-6-18 8-36 26-36 6-6 18-6 24 2 14 0 22 14 18 26 6 10 0 24-14 26-8 8-22 8-30 2-14 2-26-8-24-20z" fill="#4e3329" ${sw}/>
   <path d="M22 62c2 10 11 15 20 14 8 6 22 6 30-2 12-2 18-12 16-21-3 8-10 13-18 14-8 6-20 6-28 1-8 0-15-2-20-6z" fill="#33201a" opacity=".7"/>
   ${ln('M28 46c6-10 18-14 30-10M68 30c6 2 10 7 11 13', '#7b5a4d', 3)}${hi('M30 36c3-5 8-8 14-9M62 26c2 0 4 1 5 2', 2.8, .5)}${sp(88, 18, 5)}${sp(12, 24, 3.5)}${face(50, 54, .92, '#fff', 2)}`,
  // 12 Udon — a plump nest of thick noodles with a slice of fish cake
  `${gs(34, 50, 88)}<path d="M12 62c0-18 16-30 38-30s38 12 38 30c0 14-16 22-38 22S12 76 12 62z" fill="#fff1c7" ${sw}/>
   <path d="M16 68c6 9 19 13 34 13s28-4 34-13c-2 10-16 16-34 16s-32-6-34-16z" fill="#e9c766" opacity=".7"/>
   ${strand('M20 46c6 7 12-7 19 0s12-7 19 0 12-7 20 0', '#fff6d8', 5.5)}${strand('M30 34c5 6 10-6 16 0s10-6 16 0', '#fff6d8', 5.5)}
   <circle cx="72" cy="30" r="11" fill="#fffaf5" ${sw}/><path d="M72 30m-2 0a2 2 0 1 1 4 0a5 5 0 1 1-10 0" fill="none" stroke="#ff7a9a" stroke-width="2.600" stroke-linecap="round"/>
   ${hi('M19 60c1-4 3-7 6-9', 2.8, .9)}${sp(14, 26, 4.5)}${face(50, 64, .92)}`,
  // 13 Rice cakes — three soft ovals
  `${gs(34, 50, 82)}<ellipse cx="33" cy="63" rx="20" ry="13" fill="#eee4d0" ${sw} transform="rotate(-18 33 63)"/><ellipse cx="31" cy="61" rx="15" ry="8.500" fill="#fffdf7" transform="rotate(-18 31 61)"/>
   <ellipse cx="67" cy="63" rx="20" ry="13" fill="#eee4d0" ${sw} transform="rotate(18 67 63)"/><ellipse cx="66" cy="61" rx="15" ry="8.500" fill="#fffdf7" transform="rotate(18 66 61)"/>
   <ellipse cx="50" cy="42" rx="25" ry="17" fill="#eee4d0" ${sw}/><ellipse cx="48.500" cy="40" rx="20" ry="12.500" fill="#fffdf7"/>
   ${hi('M32 34c3-4 8-6 13-7', 2.6, .95)}${nap(31, 62, .6)}${nap(67, 62, .6)}${sp(86, 22, 5)}${face(49, 42, .8, O, 2)}`,
  // 14 Glass noodles — translucent loops in a little bowl
  `${gs(30)}${strand('M26 50c-4-20 12-32 18-21s-14 17 4 21', '#d4f1f8', 4.5)}${strand('M46 50c0-22 18-32 23-19s-12 15 3 19', '#bfe8f2', 4.5)}
   ${hi('M30 34c1-4 4-7 8-7M54 30c2-4 6-6 10-5', 2, .9)}
   <path d="M13 50h74c0 22-16 37-37 37S13 72 13 50z" fill="#ffb562" ${sw}/>
   <path d="M76 54h7c-2 16-13 27-27 30 11-6 18-16 20-30z" fill="#e8913a" opacity=".7"/>
   ${ln('M22 58c8 5 48 5 56 0', '#ffe0a8', 3)}<rect x="9" y="45" width="82" height="9" rx="4.500" fill="#ffd08a" ${sw}/>${sp(88, 26, 5)}${face(50, 68, .88)}`,
  // 15 Tofu — a soft cube with a sprinkle of scallion
  `${gs(28, 51, 90)}<path d="M23 38l27-15 28 15v33l-28 15-27-15z" fill="#fff6dc" ${sw}/>
   <path d="M50 53l28-15v33L50 86z" fill="#ecdcae"/><path d="M23 38l27-15 28 15-28 15z" fill="#fffdf4"/>
   <path d="M23 38l27 15 28-15M50 53v33" fill="none" ${sw}/><path d="M23 38l27-15 28 15v33l-28 15-27-15z" fill="none" ${sw}/>
   <circle cx="44" cy="35" r="3" fill="none" stroke="#5cb85c" stroke-width="2.2"/><circle cx="56" cy="40" r="2.600" fill="none" stroke="#5cb85c" stroke-width="2.2"/><circle cx="53" cy="31" r="1.600" fill="#e5543b"/>
   ${hi('M28 46v14', 2.6, .9)}${sp(88, 22, 5)}${sp(13, 78, 3.5)}${face(37, 63, .66, O, 1)}`,
  // 16 Dumpling — crescent with a pleated ridge
  `${gs(34, 50, 82)}<path d="M12 64c0-22 14-34 22-36 3-5 9-4 11-1 3-4 9-4 11 0 3-4 9-3 11 2 9 3 21 14 21 35 0 6-6 10-38 10S12 70 12 64z" fill="#fff8ea" ${sw}/>
   <path d="M15 66c8 5 22 6 35 6s27-1 35-6c0 4-7 7-35 7s-35-3-35-7z" fill="#e7cfa6" opacity=".75"/>
   ${ln('M34 29c2 6 1 10-1 13M45 27c2 6 2 10 0 14M56 27c0 6 0 10 2 14M67 29c-2 6-1 10 1 13', '#dcc198', 3.2)}
   ${hi('M20 52c2-7 5-12 9-16', 2.8, .95)}${sp(88, 26, 5)}${heart(12, 28, .9)}${face(50, 56, .95)}`,
  // 17 Quail eggs — two speckled eggs
  `${gs(34, 49, 86)}<ellipse cx="33" cy="59" rx="18" ry="23" fill="#e6d6c0" ${sw} transform="rotate(-12 33 59)"/><ellipse cx="31" cy="56" rx="13.500" ry="18" fill="#f6eadb" transform="rotate(-12 31 56)"/>
   <ellipse cx="64" cy="54" rx="20" ry="26" fill="#eadbc6" ${sw} transform="rotate(10 64 54)"/><ellipse cx="62.500" cy="51" rx="15.500" ry="21" fill="#fbf2e6" transform="rotate(10 62.500 51)"/>
   ${[[26, 47, 3], [38, 70, 2.4], [24, 64, 1.8], [36, 44, 1.6], [73, 36, 3], [57, 77, 2.6], [76, 66, 2], [54, 34, 1.8], [68, 74, 1.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#9a7a62"/>`).join('')}
   ${hi('M22 46c1-4 3-7 6-9M53 38c1-5 4-9 8-11', 2.6, .9)}${nap(31, 60, .62)}${sp(88, 18, 5)}${face(63, 56, .72)}`,
].map(s => s.replace(/(\d)\.(\d)00\b/g, '$1.$2'));

export const iconSvg = (kind, extra = '') =>
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>${ICONS[kind]}</svg>`;

// Card back: a little steaming pot
export const backSvg = (extra = '') => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>
  <path d="M34 31c-5-6 4-10 0-17M50 29c-5-6 4-10 0-17M66 31c-5-6 4-10 0-17" fill="none" stroke="#ffe7c2" stroke-width="4" stroke-linecap="round" opacity=".9"/>
  <path d="M11 50c-7 0-7 9 1 9M89 50c7 0 7 9-1 9" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round"/>
  <path d="M11 50c-7 0-7 9 1 9M89 50c7 0 7 9-1 9" fill="none" stroke="#ffd27a" stroke-width="2.600" stroke-linecap="round"/>
  <path d="M16 44h68c0 23-14 39-34 39S16 67 16 44z" fill="#ffd27a" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M73 50h7c-2 16-11 26-23 30 9-6 15-16 16-30z" fill="#f0b24a" opacity=".8"/>
  <path d="M23 55c1 6 3 11 6 15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <rect x="10" y="38" width="80" height="10" rx="5" fill="#ffe7a8" stroke="${O}" stroke-width="3.5"/>
  ${face(50, 62, .85)}</svg>`;

export const ICON_COUNT = ICONS.length;

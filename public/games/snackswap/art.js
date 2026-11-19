// Snack Swap item cards: cute inline SVG (100x100), each with a little kawaii face like the Hot Pot ingredients.
import { ITEMS, kindOf } from './deck.js';
import { iconSvg } from '../hotpot/icons.js';

const O = '#3b2219'; // outline ink
const sw = `stroke="${O}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
const thin = `stroke="${O}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

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
const shine = d => `<path d="${d}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;
const H = k => ({ hot: k }); // borrowed from the Hot Pot ingredient set

const ART = [
  // 0 Banana
  `<path d="M18 26C14 58 38 90 82 86c8-1 8-14 2-16-22-2-36-20-40-48z" fill="#ffd84a" ${sw}/>
   <path d="M17 28l3-13h14l4 9z" fill="#8a6a2a" ${sw}/><path d="M80 86c6-1 9-6 8-11" fill="none" stroke="#8a6a2a" stroke-width="5" stroke-linecap="round"/>
   ${shine('M26 40c2 12 8 22 16 30')}${face(52, 69, .58)}`,
  // 1 Cheese wedge
  `<path d="M12 62h76v18c0 4-3 6-6 6H18c-3 0-6-2-6-6z" fill="#ffc93c" ${sw}/>
   <path d="M12 62L74 24c9 9 14 22 14 38z" fill="#ffe07a" ${sw}/>
   <circle cx="26" cy="74" r="5" fill="#e09a1a"/><circle cx="74" cy="76" r="4" fill="#e09a1a"/><ellipse cx="70" cy="40" rx="5" ry="3.500" fill="#e8b23a"/><ellipse cx="34" cy="55" rx="4" ry="2.500" fill="#e8b23a"/>
   ${face(57, 50, .62)}`,
  // 2 Birthday cake
  `<ellipse cx="50" cy="82" rx="42" ry="8" fill="#fffaf0" ${sw}/>
   <rect x="18" y="44" width="64" height="38" rx="9" fill="#ffe9c9" ${sw}/>
   <path d="M18 54v-2c0-5 4-8 9-8h46c5 0 9 3 9 8v2c0 6-8 8-10 2-2 8-12 8-13 0-2 7-11 7-13 0-1 8-11 8-13 0-2 6-15 4-15-2z" fill="#ff8fab" ${sw}/>
   <rect x="46" y="22" width="8" height="22" rx="3" fill="#7fd1e8" ${sw}/><path d="M50 6c6 6 6 12 0 15-6-3-6-9 0-15z" fill="#ffb547" ${thin}/>
   ${face(50, 68, .75)}`,
  // 3 Pineapple
  `<path d="M50 34c-4-12-14-18-22-18 6 4 10 10 12 18M50 34c4-12 14-18 22-18-6 4-10 10-12 18M50 36C42 26 44 12 50 4c6 8 8 22 0 32z" fill="#5cb85c" ${sw}/>
   <ellipse cx="50" cy="62" rx="26" ry="29" fill="#ffc93c" ${sw}/>
   <path d="M30 46l32 40M44 36l30 38M26 62l22 28M70 46L38 86M56 36L26 74M74 62L52 90" stroke="#e09a1a" stroke-width="2.400" stroke-linecap="round" opacity=".75"/>
   <ellipse cx="50" cy="64" rx="19" ry="12" fill="#ffc93c"/>${face(50, 62, .75)}`,
  // 4 Pickle
  `<g transform="rotate(18 50 50)"><rect x="32" y="10" width="36" height="80" rx="18" fill="#7fbf4d" ${sw}/>
   <path d="M40 22c-2 8-2 16 0 24" fill="none" stroke="#c4e89a" stroke-width="4" stroke-linecap="round"/>
   <circle cx="58" cy="24" r="2.600" fill="#4f8f2a"/><circle cx="42" cy="70" r="2.600" fill="#4f8f2a"/><circle cx="60" cy="76" r="2.600" fill="#4f8f2a"/><circle cx="52" cy="84" r="2.200" fill="#4f8f2a"/><circle cx="46" cy="16" r="2.200" fill="#4f8f2a"/></g>
   ${face(50, 48, .68, '#1f3a12')}`,
  H(16),
  // 6 Rubber duck
  `<path d="M12 62c0-6 6-6 12-2 6-8 22-10 36-6 14 2 26 0 28 8 2 14-14 26-38 26S12 78 12 62z" fill="#ffd84a" ${sw}/>
   <circle cx="58" cy="36" r="21" fill="#ffd84a" ${sw}/><path d="M42 50c8 8 24 8 32 0" fill="#ffd84a"/>
   <path d="M76 36c10-3 16 0 16 4s-6 8-16 5z" fill="#ff8c42" ${sw}/>
   <path d="M30 66c6 8 18 8 24 0" fill="none" stroke="#e0a81a" stroke-width="4" stroke-linecap="round"/>
   ${face(57, 33, .6)}`,
  // 7 Goldfish in a bowl
  `<circle cx="50" cy="56" r="35" fill="#e3f6fc" ${sw}/>
   <path d="M17 50c8-5 14 5 22 0s14 5 22 0 14 5 22 0c2 22-12 41-33 41S15 72 17 50z" fill="#8fd6f0"/>
   <rect x="28" y="14" width="44" height="10" rx="5" fill="#e3f6fc" ${sw}/>
   <path d="M62 64l15-10v20z" fill="#ff7a3d" ${thin}/><ellipse cx="47" cy="64" rx="18" ry="12" fill="#ff9a4a" ${thin}/>
   <circle cx="74" cy="42" r="2.600" fill="#fff"/><circle cx="68" cy="34" r="1.800" fill="#fff"/>${shine('M24 44c2-8 6-13 12-16')}
   ${face(44, 63, .5)}`,
  // 8 Garden gnome
  `<path d="M22 92c0-16 12-24 28-24s28 8 28 24z" fill="#4a9be0" ${sw}/>
   <circle cx="50" cy="52" r="20" fill="#ffe3c8" ${sw}/>
   <path d="M29 56c2 26 12 36 21 36s19-10 21-36c-6 6-13 6-21 2-8 4-15 4-21-2z" fill="#fffaf0" ${sw}/>
   <path d="M50 4c14 12 24 26 28 42-18-6-38-6-56 0C26 30 36 16 50 4z" fill="#e5543b" ${sw}/>
   <circle cx="50" cy="57" r="4.500" fill="#ffb3a0" ${thin}/>${face(50, 49, .62)}`,
  // 9 Pet rock
  `<path d="M12 72c-4-20 10-42 34-44 24-2 42 12 42 34 0 14-10 22-38 22S14 84 12 72z" fill="#b9b1aa" ${sw}/>
   <path d="M26 44c6-6 14-9 22-9" fill="none" stroke="#e2dcd6" stroke-width="4" stroke-linecap="round"/>
   <path d="M66 30l-12-9v16z" fill="#ff5d8f" ${thin}/><path d="M66 30l12-9v16z" fill="#ff5d8f" ${thin}/><circle cx="66" cy="29" r="4" fill="#ff8fab" ${thin}/>
   <circle cx="30" cy="74" r="2" fill="#8d857e"/><circle cx="74" cy="70" r="2.400" fill="#8d857e"/>${face(50, 60, .95)}`,
  // 10 Cactus
  `<path d="M38 50H26V36M62 58h12V42" fill="none" stroke="${O}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M38 50H26V36M62 58h12V42" fill="none" stroke="#5cb85c" stroke-width="10.600" stroke-linecap="round" stroke-linejoin="round"/>
   <rect x="36" y="14" width="28" height="66" rx="14" fill="#5cb85c" ${sw}/>
   <path d="M30 72h40l-5 18H35z" fill="#e07a4a" ${sw}/><rect x="27" y="68" width="46" height="9" rx="4" fill="#f09a6a" ${sw}/>
   <circle cx="58" cy="14" r="6" fill="#ff8fab" ${thin}/><path d="M44 24v6M56 54v6M44 56v5" stroke="#bfeec5" stroke-width="2.600" stroke-linecap="round"/>
   ${face(50, 40, .6, '#173a1c')}`,
  H(5),
  // 12 Wet sock
  `<path d="M34 12h30v38c0 4 2 6 5 8l11 8c10 7 6 21-7 21H52c-10 0-18-7-18-17z" fill="#9aa8ff" ${sw}/>
   <path d="M34 12h30v13H34z" fill="#fff" ${sw}/><path d="M34 34h30M34 43h30" stroke="#fff" stroke-width="4" opacity=".8"/>
   <path d="M70 87c9 0 14-6 13-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
   <path d="M18 30c5 7 7 11 7 14a7 7 0 0 1-14 0c0-3 2-7 7-14z" fill="#7fd1e8" ${thin}/><path d="M84 18c4 5 5 8 5 10a5 5 0 0 1-10 0c0-2 1-5 5-10z" fill="#7fd1e8" ${thin}/>
   ${face(54, 68, .62)}`,
  // 13 Traffic cone
  `<path d="M40 12h20l18 66H22z" fill="#ff8c42" ${sw}/>
   <path d="M35.600 28h28.800l3.300 12H32.300zM29 52h42l3.300 12H25.700z" fill="#fff" ${thin}/>
   <rect x="10" y="76" width="80" height="13" rx="5" fill="#ff7a2a" ${sw}/>
   ${face(50, 46, .5)}`,
  // 14 Toaster
  `<path d="M34 40V24c0-9 32-9 32 0v16z" fill="#e8b46a" ${sw}/><path d="M40 40V27c0-5 20-5 20 0v13z" fill="#f6d59a"/>
   <rect x="14" y="38" width="72" height="46" rx="13" fill="#d5dce3" ${sw}/>
   <path d="M28 44h44" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
   <rect x="85" y="52" width="8" height="11" rx="3" fill="#e5543b" ${thin}/><path d="M26 84v5M74 84v5" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
   ${shine('M22 56c0-4 2-7 5-8')}${face(50, 63, .85)}`,
  // 15 Plunger
  `<rect x="45" y="6" width="10" height="52" rx="5" fill="#d9a468" ${sw}/>
   <path d="M18 86c0-24 14-36 32-36s32 12 32 36c0 3-2 5-5 5H23c-3 0-5-2-5-5z" fill="#e5543b" ${sw}/>
   <path d="M30 62c4-4 9-6 14-7" fill="none" stroke="#ff9d8a" stroke-width="4" stroke-linecap="round"/>
   ${face(50, 73, .75)}`,
  // 16 Umbrella
  `<path d="M50 50v30c0 10-14 10-14 0" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M50 50v30c0 10-14 10-14 0" fill="none" stroke="#ffb547" stroke-width="3.600" stroke-linecap="round"/>
   <path d="M8 54c0-26 18-42 42-42s42 16 42 42c-7-7-14-7-21 0-7-7-14-7-21 0-7-7-14-7-21 0-7-7-14-7-21 0z" fill="#ff8fab" ${sw}/>
   <path d="M50 12v-6" ${sw}/>${shine('M20 38c3-8 8-13 15-16')}${face(50, 34, .78)}`,
  // 17 Toilet roll
  `<path d="M66 34h20v44c0 6-6 6-8 2-2 4-8 4-12 0z" fill="#fff" ${sw}/><path d="M70 50h12M70 62h12" stroke="#d8cfc6" stroke-width="2" stroke-dasharray="3 3"/>
   <path d="M20 30v46c0 14 48 14 48 0V30z" fill="#fffaf0" ${sw}/>
   <ellipse cx="44" cy="30" rx="24" ry="11" fill="#fff" ${sw}/><ellipse cx="44" cy="30" rx="9" ry="4" fill="#c9a99a" ${thin}/>
   ${face(44, 62, .8)}`,
  // 18 Crown
  `<path d="M16 76L9 30l22 18 19-30 19 30 22-18-7 46z" fill="#ffc93c" ${sw}/>
   <rect x="14" y="72" width="72" height="14" rx="5" fill="#ffb020" ${sw}/>
   <circle cx="9" cy="28" r="5" fill="#7ed3b2" ${thin}/><circle cx="50" cy="16" r="6" fill="#e5543b" ${thin}/><circle cx="91" cy="28" r="5" fill="#7ed3b2" ${thin}/>
   <circle cx="30" cy="79" r="3" fill="#e5543b"/><circle cx="50" cy="79" r="3" fill="#7fd1e8"/><circle cx="70" cy="79" r="3" fill="#e5543b"/>
   ${face(50, 56, .72)}`,
  // 19 Love letter
  `<rect x="10" y="26" width="80" height="56" rx="8" fill="#fff4e2" ${sw}/>
   <path d="M11 30l39 22 39-22" fill="none" ${sw}/>
   <path d="M50 46c-12-9-16-16-10-21 5-3 10 1 10 5 0-4 5-8 10-5 6 5 2 12-10 21z" fill="#e5543b" ${sw}/>
   <path d="M76 12c-5-4-7-7-4-9 2-1 4 0 4 2 0-2 2-3 4-2 3 2 1 5-4 9zM22 16c-4-3-5-5-3-7 2-1 3 0 3 2 0-2 1-3 3-2 2 2 1 4-3 7z" fill="#ff8fab" ${thin}/>
   ${face(50, 66, .75)}`,
  // 20 Disco ball
  `<path d="M50 4v20" ${sw}/>
   <circle cx="50" cy="56" r="33" fill="#cbd8ee" ${sw}/>
   <path d="M19 46c20 6 42 6 62 0M18 62c20 7 44 7 64 0M26 78c16 5 32 5 48 0M38 25c-8 20-8 42 0 62M62 25c8 20 8 42 0 62M50 23v66" fill="none" stroke="#8fa3c8" stroke-width="2.200"/>
   <ellipse cx="50" cy="58" rx="20" ry="12" fill="#cbd8ee"/>
   <path d="M14 18l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM86 14l1.500 4.500 4.500 1.500-4.500 1.500-1.500 4.500-1.500-4.500-4.500-1.500 4.500-1.500z" fill="#ffd84a" ${thin}/>
   ${shine('M28 42c3-6 7-10 13-12')}${face(50, 56, .85)}`,
  // 21 Candle
  `<path d="M50 6c10 10 10 22 0 27-10-5-10-17 0-27z" fill="#ffb547" ${sw}/><path d="M50 18c4 5 4 9 0 12-4-3-4-7 0-12z" fill="#fff4b0"/>
   <path d="M50 33v8" ${sw}/>
   <rect x="32" y="40" width="36" height="46" rx="7" fill="#fff4e2" ${sw}/>
   <path d="M32 50v-4c0-4 3-6 6-6h24c3 0 6 2 6 6v10c0 5-7 5-7 0v-3c0-4-7-4-7 0v9c0 5-8 5-8 0v-8c0-4-7-4-7 0 0 4-7 4-7-4z" fill="#ffd9e2" ${thin}/>
   <ellipse cx="50" cy="88" rx="26" ry="5" fill="#ffb547" ${sw}/>
   ${face(50, 74, .68)}`,
  // 22 Diamond ring
  `<circle cx="50" cy="66" r="22" fill="none" stroke="${O}" stroke-width="13"/><circle cx="50" cy="66" r="22" fill="none" stroke="#ffc93c" stroke-width="6.600"/>
   <path d="M30 22h40l10 12-30 26-30-26z" fill="#bfeaf5" ${sw}/><path d="M20 34h60M40 22l-6 12 16 26 16-26-6-12" fill="none" stroke="${O}" stroke-width="2" stroke-linejoin="round" opacity=".55"/>
   <path d="M86 12l1.500 4.500 4.500 1.500-4.500 1.500-1.500 4.500-1.500-4.500-4.500-1.500 4.500-1.500z" fill="#fff" ${thin}/>
   ${face(50, 39, .5)}`,
  // 23 Balloon
  `<path d="M50 74c-8 8 8 10 0 20" fill="none" ${thin}/>
   <ellipse cx="50" cy="40" rx="29" ry="33" fill="#e5543b" ${sw}/><path d="M44 72h12l-6-7z" fill="#e5543b" ${sw}/>
   ${shine('M30 30c2-8 7-13 13-15')}${face(50, 44, .9)}`,
  // 24 Trumpet
  `<path d="M66 50l24-28v56z" fill="#ffc93c" ${sw}/>
   <rect x="12" y="36" width="60" height="28" rx="14" fill="#ffd84a" ${sw}/><rect x="4" y="43" width="12" height="14" rx="4" fill="#ffb020" ${sw}/>
   <rect x="26" y="22" width="9" height="16" rx="3" fill="#ffb020" ${thin}/><rect x="40" y="22" width="9" height="16" rx="3" fill="#ffb020" ${thin}/><rect x="54" y="22" width="9" height="16" rx="3" fill="#ffb020" ${thin}/>
   <path d="M30 84c2-5 2-5 7-7M58 88c0-5 1-5 5-8" fill="none" ${thin}/>${face(42, 49, .6)}`,
  // 25 Whoopee cushion
  `<path d="M70 42l20-8v36l-20-8z" fill="#e0607c" ${sw}/>
   <circle cx="44" cy="54" r="32" fill="#f08aa0" ${sw}/>
   ${shine('M22 42c3-7 8-12 14-14')}
   <path d="M94 12c4 3 4 7 0 10M86 8c-1 4 0 6 3 8M96 82c4 3 4 7 0 10" fill="none" ${thin}/>
   ${face(44, 54, .9)}`,
  // 26 Alarm clock
  `<path d="M30 84l-8 8M70 84l8 8" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
   <circle cx="26" cy="22" r="13" fill="#e5543b" ${sw}/><circle cx="74" cy="22" r="13" fill="#e5543b" ${sw}/><path d="M44 16h12" ${sw}/>
   <circle cx="50" cy="54" r="34" fill="#7fd1e8" ${sw}/><circle cx="50" cy="54" r="25" fill="#fffaf0" ${thin}/>
   <path d="M50 54V36M50 54l10-6" fill="none" stroke="${O}" stroke-width="2.600" stroke-linecap="round" opacity=".3"/>
   ${face(50, 56, .78)}`,
  // 27 Cowbell
  `<path d="M38 22c0-16 24-16 24 0" fill="none" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M38 22c0-16 24-16 24 0" fill="none" stroke="#8a6a2a" stroke-width="4" stroke-linecap="round"/>
   <circle cx="50" cy="88" r="6" fill="#8a6a2a" ${sw}/>
   <path d="M30 22h40l16 54c2 6-2 9-7 9H21c-5 0-9-3-7-9z" fill="#e0a83c" ${sw}/>
   ${shine('M34 32l-8 30')}<path d="M92 40c3 4 3 9 0 13M8 40c-3 4-3 9 0 13" fill="none" ${thin}/>${face(50, 58, .85)}`,
  // 28 Mixtape
  `<rect x="8" y="24" width="84" height="56" rx="9" fill="#6b5a8c" ${sw}/>
   <rect x="16" y="31" width="68" height="34" rx="6" fill="#fff4e2" ${thin}/>
   <path d="M16 38h68" stroke="#ff8fab" stroke-width="5"/>
   <circle cx="35" cy="52" r="8" fill="${O}"/><circle cx="65" cy="52" r="8" fill="${O}"/><circle cx="37" cy="50" r="2.600" fill="#fff"/><circle cx="67" cy="50" r="2.600" fill="#fff"/>
   <path d="M45 56q5 5 10 0" fill="none" stroke="${O}" stroke-width="2.400" stroke-linecap="round"/>
   <ellipse cx="23" cy="59" rx="4" ry="2.400" fill="#ff7a8a" opacity=".6"/><ellipse cx="77" cy="59" rx="4" ry="2.400" fill="#ff7a8a" opacity=".6"/>
   <path d="M30 80l5-9h30l5 9" fill="#55466f" ${thin}/>`,
  // 29 Rubber chicken
  `<path d="M40 82l-6 10M40 82l2 12M60 82l6 10M60 82l-2 12" stroke="#ff8c42" stroke-width="4" stroke-linecap="round"/>
   <path d="M43 10c0-8 7-8 7-1 0-7 9-7 7 1z" fill="#e5543b" ${thin}/>
   <path d="M50 8c13 0 17 12 13 22 14 10 17 34 7 48-8 10-32 10-40 0-10-14-7-38 7-48-4-10 0-22 13-22z" fill="#ffe07a" ${sw}/>
   <path d="M45 30l5 9 5-9z" fill="#ff8c42" ${thin}/><path d="M50 39c-2 3-2 6 0 8 2-2 2-5 0-8z" fill="#e5543b" ${thin}/>
   <path d="M26 56c-6 2-8 8-6 14M74 56c6 2 8 8 6 14" fill="none" ${sw}/>${face(50, 21, .52)}`,
  // 30 Ghost
  `<path d="M18 88V46c0-20 14-32 32-32s32 12 32 32v42l-10.700-9-10.700 9L50 79l-10.700 9-10.700-9z" fill="#fff" ${sw}/>
   <path d="M28 44c1-9 6-15 13-18" fill="none" stroke="#dfe6f2" stroke-width="4" stroke-linecap="round"/>
   <path d="M18 56c-6 0-9 3-10 8M82 56c6 0 9 3 10 8" fill="none" ${sw}/>${face(50, 46, 1)}`,
  // 31 Slime
  `<path d="M10 80c0-10 9-11 11-22 4-20 14-32 29-32s25 12 29 32c2 11 11 12 11 22 0 7-8 8-40 8s-40-1-40-8z" fill="#8ee06a" ${sw}/>
   ${shine('M30 50c2-8 6-13 12-16')}<circle cx="72" cy="72" r="3" fill="#c9f5ae"/><circle cx="26" cy="74" r="2.400" fill="#c9f5ae"/>
   <path d="M50 26c0-8 4-10 4-16" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M50 27c0-8 4-10 4-16" fill="none" stroke="#8ee06a" stroke-width="3.600" stroke-linecap="round"/>
   ${face(50, 62, .95, '#1f3a12')}`,
  // 32 Mystery box
  `<rect x="18" y="46" width="64" height="42" rx="6" fill="#9b6fd6" ${sw}/>
   <rect x="12" y="36" width="76" height="15" rx="5" fill="#b994ea" ${sw}/>
   <path d="M44 51h12v37H44z" fill="#ffc93c" opacity=".9"/><path d="M44 36h12v15H44z" fill="#ffd84a"/>
   <path d="M41 18c0-13 18-13 18-2 0 7-9 6-9 13" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M41 18c0-13 18-13 18-2 0 7-9 6-9 13" fill="none" stroke="#ffd84a" stroke-width="3.800" stroke-linecap="round"/>
   <rect x="18" y="46" width="64" height="42" rx="6" fill="none" ${sw}/><rect x="12" y="36" width="76" height="15" rx="5" fill="none" ${sw}/>
   ${face(50, 68, .8)}`,
  // 33 Tooth
  `<path d="M22 32c0-14 14-18 28-11 14-7 28-3 28 11 0 13-4 21-6 32-2 11-4 24-11 24-7 0-5-19-11-19s-4 19-11 19c-7 0-9-13-11-24-2-11-6-19-6-32z" fill="#fff" ${sw}/>
   <path d="M30 36c0-6 4-9 9-9" fill="none" stroke="#dfe6f2" stroke-width="4" stroke-linecap="round"/>
   <path d="M84 14l1.500 4.500 4.500 1.500-4.500 1.500-1.500 4.500-1.500-4.500-4.500-1.500 4.500-1.500z" fill="#ffd84a" ${thin}/>${face(50, 45, .85)}`,
  // 34 Onion
  `<path d="M50 24c-3-8 3-12 0-20" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M50 25c-3-8 3-12 0-20" fill="none" stroke="#8fcf6a" stroke-width="3.800" stroke-linecap="round"/>
   <path d="M50 20c24 8 36 24 36 42 0 16-14 26-36 26S14 78 14 62c0-18 12-34 36-42z" fill="#c98ad8" ${sw}/>
   <path d="M50 22c-14 12-20 26-20 40M50 22c14 12 20 26 20 40" fill="none" stroke="#a866ba" stroke-width="2.600" stroke-linecap="round"/>
   <path d="M44 88v5M50 88v6M56 88v5" stroke="${O}" stroke-width="2.400" stroke-linecap="round"/>
   <path d="M26 60c3 5 4 7 4 9a4 4 0 0 1-8 0c0-2 1-4 4-9z" fill="#7fd1e8" ${thin}/>${face(52, 58, .85)}`,
  H(15),
];

export const itemSvg = (i, extra = '') => {
  const a = ART[i] ?? ART[0];
  if (a.hot !== undefined) return iconSvg(a.hot, extra);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>${a.replace(/(\d)\.(\d)00\b/g, '$1.$2')}</svg>`;
};

// Card back: two little swap arrows around a smile.
export const backSvg = (extra = '') => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>
  <circle cx="50" cy="50" r="30" fill="#ffd27a" stroke="${O}" stroke-width="3.500"/>
  <path d="M16 44C20 22 44 10 64 18" fill="none" stroke="#fff4e2" stroke-width="6" stroke-linecap="round"/><path d="M58 8l10 11-14 5z" fill="#fff4e2"/>
  <path d="M84 56C80 78 56 90 36 82" fill="none" stroke="#fff4e2" stroke-width="6" stroke-linecap="round"/><path d="M42 92L32 81l14-5z" fill="#fff4e2"/>
  ${face(50, 48, .9)}</svg>`;

// HTML for a face-up item card. tag = 'div' or 'button'.
export function itemHtml(i, { tag = 'div', w, cls = '', attrs = '' } = {}) {
  const k = kindOf(i), type = tag === 'button' ? ' type="button"' : '';
  return `<${tag}${type} class="ssc ${cls}" style="--c:${k.col}${w ? `;--cw:${w}px` : ''}" ${attrs} aria-label="${ITEMS[i]}">
    <span class="band">${k.name}</span>${itemSvg(i)}<span class="nm">${ITEMS[i]}</span></${tag}>`;
}
export const itemBack = (w, cls = '') => `<div class="ssc back ${cls}" ${w ? `style="--cw:${w}px"` : ''} aria-hidden="true">${backSvg()}</div>`;

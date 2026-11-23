// Shared illustrations for the hub (SVG strings).
import { iconSvg } from './games/hotpot/icons.js';

const ink = '#3b2219';

// Site logo: a lighthouse, a pawn, a die and a marble on a floating island. The outline follows --ink (day and night).
export const siteLogo = s =>
  `<svg class="sitelogo" width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true"><g stroke="var(--ink, #3b2219)" stroke-width="4" stroke-linejoin="round"><path d="M10 64h80l-10 12-12 4-12 14-14-12-18-4z" fill="#857a72"/><path d="M4 56h92v10H4z" fill="#7cc35a"/><path d="M50 18l46-12v22z" fill="#ffe27a" stroke="none" opacity=".85"/><path d="M38 56l3-28h12l3 28z" fill="#fff"/><path d="M40 37h14l1 9H39z" fill="#e5543b"/><rect x="39" y="18" width="16" height="10" rx="2" fill="#ffb547"/><path d="M37 18l10-8 10 8z" fill="#e5543b"/><g transform="rotate(8 71 49)"><rect x="64" y="42" width="14" height="14" rx="3" fill="#fff"/><g fill="var(--ink, #3b2219)" stroke="none"><circle cx="68.2" cy="46.2" r="1.6"/><circle cx="73.8" cy="51.8" r="1.6"/></g></g><path transform="translate(26 56) scale(0.95)" d="M0-22a6 6 0 0 1 4 10l5 12h-18l5-12a6 6 0 0 1 4-10z" fill="#ffb547"/><circle cx="88" cy="51" r="5" fill="#4fb3e8"/></g></svg>`;

export const potLogo = (s, steam = '#ffb547', pot = '#e5543b', rim = '#ffb547', line = '#fff4e2') =>
  `<svg width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true">
  <g class="steam"><path d="M34 30c-4-6 4-10 0-16M50 28c-4-6 4-10 0-16M66 30c-4-6 4-10 0-16" fill="none" stroke="${steam}" stroke-width="5" stroke-linecap="round"/></g>
  <path d="M14 44h72c0 22-16 38-36 38S14 66 14 44z" fill="${pot}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>
  <rect x="8" y="38" width="84" height="11" rx="5.5" fill="${rim}" stroke="${line}" stroke-width="4"/></svg>`;

// Top-down hot pot table with ingredients orbiting the split broth.
export function tableArt(W = 520, H = 440, icons = [0, 4, 6, 10, 13, 16, 3, 15]) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .42, P = R * .48;
  const around = icons.map((k, i) => {
    const a = i / icons.length * Math.PI * 2 + .3, rr = R * .76, s = R * .3;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    return `<g class="orbit" style="--d:${(i * .37).toFixed(2)}s;transform-origin:${x}px ${y}px">
      <circle cx="${x}" cy="${y + 4}" r="${s * .62}" fill="#00000033"/>
      <circle cx="${x}" cy="${y}" r="${s * .62}" fill="#fffaf0" stroke="${ink}" stroke-width="3"/>
      ${iconSvg(k, `x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}"`)}</g>`;
  }).join('');
  const taiji = `M${cx} ${cy - P} A${P} ${P} 0 0 0 ${cx} ${cy + P} A${P / 2} ${P / 2} 0 0 1 ${cx} ${cy} A${P / 2} ${P / 2} 0 0 0 ${cx} ${cy - P}Z`;
  let bubbles = '';
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, r = P * (.2 + (i * 37 % 70) / 100);
    bubbles += `<circle class="bub" style="--d:${(i * .29 % 2.4).toFixed(2)}s" cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" r="${3 + i % 4}" fill="#fff"/>`;
  }
  let steam = '';
  for (let i = -1; i <= 1; i++) steam += `<path class="wisp" style="--d:${(i + 1) * .8}s" d="M${cx + i * P * .5} ${cy - P * .2}c-14-16 14-26 0-44s12-28 0-40" fill="none" stroke="#fff4e2" stroke-width="7" stroke-linecap="round"/>`;
  return `<svg class="tableart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A hot pot table seen from above, with cute ingredients around a split broth pot">
  <ellipse cx="${cx}" cy="${cy + 14}" rx="${R * 1.04}" ry="${R * 1.04}" fill="#00000055"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="#a86a42" stroke="${ink}" stroke-width="4"/>
  <circle cx="${cx}" cy="${cy}" r="${R * .93}" fill="none" stroke="#c88a5c" stroke-width="3" opacity=".7"/>
  <circle cx="${cx}" cy="${cy}" r="${R * .62}" fill="#c4885a" stroke="${ink}" stroke-width="3" opacity=".9"/>
  ${around}
  <circle cx="${cx}" cy="${cy + 6}" r="${P * 1.18}" fill="#00000044"/>
  <circle cx="${cx}" cy="${cy}" r="${P * 1.16}" fill="#d9dde3" stroke="${ink}" stroke-width="4"/>
  <circle cx="${cx}" cy="${cy}" r="${P}" fill="#d8402a" stroke="${ink}" stroke-width="3"/>
  <path d="${taiji}" fill="#f6e7c8"/>
  <circle cx="${cx + P * .45}" cy="${cy + P * .35}" r="5" fill="#8e1d10"/><circle cx="${cx + P * .62}" cy="${cy + P * .05}" r="4" fill="#ffb547"/>
  <circle cx="${cx + P * .3}" cy="${cy + P * .62}" r="4" fill="#8e1d10"/><circle cx="${cx - P * .5}" cy="${cy - P * .2}" r="4" fill="#7ed37a"/>
  <circle cx="${cx - P * .55}" cy="${cy + P * .25}" r="4" fill="#7ed37a"/>
  ${bubbles}${steam}</svg>`;
}

// Three marbles tumbling down a ramp, for the Marble Rush card.
export function marbleArt() {
  const ball = (x, y, r, c, d) => `<g class="roll" style="--d:${d}s;transform-origin:${x}px ${y}px">
    <circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ink}" stroke-width="3"/>
    <path d="M${x - r * .7} ${y + r * .3}q${r * .5} ${-r * .9} ${r * 1.3} ${-r * .8}" fill="none" stroke="#fff" stroke-width="${r * .22}" stroke-linecap="round" opacity=".7"/>
    <circle cx="${x - r * .34}" cy="${y - r * .38}" r="${r * .14}" fill="#fff" opacity=".85"/></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Three coloured marbles rolling down a ramp">
  <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g><path d="M196 30l14-8 16 4 8 10-10 8h-24z" class="artcloud" fill="#fff"/><path d="M14 112l10-6 12 3 6 7-7 5H18z" class="artcloud" fill="#fff"/>
  <circle cx="40" cy="26" r="7" fill="#ffb547"/><circle cx="278" cy="36" r="6" fill="#ff8fab"/><circle cx="168" cy="16" r="5" fill="#7ed3b2"/>
  <path d="M-10 66L330 132v30H-10z" fill="#f6e3c5" stroke="${ink}" stroke-width="4"/>
  <path d="M-10 54L330 120" stroke="#e5543b" stroke-width="12" stroke-linecap="round"/><path d="M-10 54L330 120" stroke="${ink}" stroke-width="4" fill="none" transform="translate(0 -7)"/>
  <circle cx="206" cy="94" r="8" fill="#7ed3b2" stroke="${ink}" stroke-width="3"/>
  ${ball(70, 46, 24, '#ff8fab', 0)}${ball(150, 66, 20, '#ffb547', .25)}${ball(262, 82, 26, '#9aa8ff', .5)}</svg>`;
}

// A tiny tilted board with a ladder and a smiling snake, for the Snakes & Ladders card.
export function laddersArt() {
  const cols = ['#fff4e2', '#ffd9c2', '#d8f0e2', '#ffe9a8', '#e6defc'];
  let tiles = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    tiles += `<rect x="${c * 34}" y="${r * 30}" width="34" height="30" fill="${(r + c) % 2 ? cols[0] : cols[1 + (r + (c >> 1)) % 4]}" stroke="#3b221933" stroke-width="1.5"/>`;
  }
  const rungs = [0, 1, 2, 3, 4, 5].map(i => { const t = (i + .5) / 6, x = 46 + t * 70, y = 108 - t * 84; return `<path d="M${x - 9} ${y - 5}L${x + 9} ${y + 5}" stroke="#f0c27a" stroke-width="4" stroke-linecap="round"/>`; }).join('');
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A little board with a wooden ladder and a smiling green snake">
  <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g><path d="M196 30l14-8 16 4 8 10-10 8h-24z" class="artcloud" fill="#fff"/><path d="M14 112l10-6 12 3 6 7-7 5H18z" class="artcloud" fill="#fff"/>
  <circle cx="30" cy="22" r="6" fill="#ffb547"/><circle cx="292" cy="28" r="7" fill="#ff8fab"/><circle cx="300" cy="120" r="5" fill="#7ed3b2"/>
  <g transform="translate(40 12) skewX(-8)">
    <rect x="-6" y="-6" width="284" height="132" rx="10" fill="#c4885a" stroke="${ink}" stroke-width="4"/>
    ${tiles}
    <path d="M40 112L106 18M58 120L124 26" stroke="#c98b4f" stroke-width="6" stroke-linecap="round"/>${rungs}
    <path d="M232 22c-40 6-10 30-46 38s-8 34-44 44" fill="none" stroke="#3f8f4a" stroke-width="15" stroke-linecap="round"/>
    <path d="M232 22c-40 6-10 30-46 38s-8 34-44 44" fill="none" stroke="#7ed37a" stroke-width="10" stroke-linecap="round" stroke-dasharray="10 9"/>
    <ellipse cx="238" cy="21" rx="15" ry="12" fill="#7ed37a" stroke="${ink}" stroke-width="3"/>
    <circle cx="234" cy="17" r="3" fill="${ink}"/><circle cx="244" cy="17" r="3" fill="${ink}"/>
    <path d="M235 25q4 3 8 0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M252 23l9 1m-9-1l8 4" stroke="#e5543b" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="200" cy="98" r="11" fill="#ffb547" stroke="${ink}" stroke-width="3"/><circle cx="196" cy="96" r="1.8" fill="${ink}"/><circle cx="204" cy="96" r="1.8" fill="${ink}"/>
  </g></svg>`;
}

// Three fanned cards and a few chips on green felt, for the Texas Hold'em card.
export function pokerArt() {
  const suit = {
    h: ['#d8402a', 'M12 21.5S3 15.8 3 9.6A4.9 4.9 0 0 1 12 6.8a4.9 4.9 0 0 1 9 2.8c0 6.2-9 11.9-9 11.9z'],
    s: ['#3b2219', 'M12 1.8s8.6 6.4 8.6 11.5a4.3 4.3 0 0 1-7.4 3l1.3 5.2h-5l1.3-5.2a4.3 4.3 0 0 1-7.4-3C3.4 8.2 12 1.8 12 1.8z'],
    d: ['#d8402a', 'M12 1.8l7.6 10.2L12 22.2 4.4 12z'],
  };
  const card = (x, y, rot, r, s, d) => `<g class="fan" style="--d:${d}s;transform-origin:${x + 30}px ${y + 84}px"><g transform="rotate(${rot} ${x + 30} ${y + 84})">
    <rect x="${x}" y="${y}" width="60" height="84" rx="9" fill="#fff8ec" stroke="${ink}" stroke-width="3"/>
    <text x="${x + 8}" y="${y + 24}" font-family="Rubik, Nunito, sans-serif" font-weight="700" font-size="22" fill="${suit[s][0]}">${r}</text>
    <path d="${suit[s][1]}" fill="${suit[s][0]}" transform="translate(${x + 22} ${y + 36}) scale(1.45)"/></g></g>`;
  const chip = (x, y, c, e) => `<ellipse cx="${x}" cy="${y + 5}" rx="17" ry="7" fill="#00000044"/><ellipse cx="${x}" cy="${y}" rx="17" ry="7" fill="${c}" stroke="${ink}" stroke-width="2.5"/><ellipse cx="${x}" cy="${y}" rx="8" ry="3.2" fill="none" stroke="${e}" stroke-width="2" stroke-dasharray="3 2"/>`;
  const stack = (x, y, n, c, e) => Array.from({ length: n }, (_, i) => chip(x, y - i * 6, c, e)).join('');
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Three playing cards fanned out next to stacks of chips on a green table">
  <rect width="320" height="150" fill="#2b7a5e"/>
  <ellipse cx="160" cy="160" rx="210" ry="96" fill="#3f9c7a"/>
  <ellipse cx="160" cy="160" rx="176" ry="74" fill="none" stroke="#fff4e255" stroke-width="3" stroke-dasharray="10 8"/>
  ${card(92, 34, -16, 'A', 'h', 0)}${card(130, 26, 0, 'K', 's', .2)}${card(168, 34, 16, 'Q', 'd', .4)}
  ${stack(54, 118, 4, '#ff8fab', '#fff4e2')}${stack(86, 128, 2, '#7ed3b2', '#fff4e2')}${stack(262, 120, 5, '#3b2219', '#ffb547')}${stack(234, 132, 2, '#9b6fd6', '#fff4e2')}</svg>`;
}

// Ludo card: the cross-shaped board from above with a few chunky pawns and a die.
export function ludoArt() {
  const cols = ['#ff6b6b', '#4db5ff', '#ffc93c', '#5fd08a'], u = 9, o = `stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"`;
  let cells = '';
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    const arm = (c > 5 && c < 9) || (r > 5 && r < 9); if (!arm || (c > 5 && c < 9 && r > 5 && r < 9)) continue;
    const lane = r === 7 ? (c < 6 && c > 0 ? 0 : c > 8 && c < 14 ? 2 : -1) : c === 7 ? (r < 6 && r > 0 ? 1 : r > 8 && r < 14 ? 3 : -1) : -1;
    const start = c === 1 && r === 6 ? 0 : c === 8 && r === 1 ? 1 : c === 13 && r === 8 ? 2 : c === 6 && r === 13 ? 3 : -1;
    cells += `<rect x="${c * u}" y="${r * u}" width="${u}" height="${u}" fill="${lane >= 0 ? cols[lane] : start >= 0 ? cols[start] : (r + c) % 2 ? '#f3e0c6' : '#e8cfae'}" stroke="#3b221944" stroke-width="1"/>`;
  }
  const yard = (x, y, c) => `<rect x="${x + 3}" y="${y + 3}" width="48" height="48" rx="5" fill="${c}" ${o}/><rect x="${x + 13}" y="${y + 13}" width="28" height="28" rx="3" fill="#fff4e2"/>`;
  const pawn = (x, y, c, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" ${o}><path d="M-11 0h22v6h-22zM-7 0l4-16h6l4 16zM0-31l8 6-3 9h-10l-3-9z" fill="${c}"/></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A Ludo board with coloured corners, chunky pawns and a die">
  <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g><path d="M196 30l14-8 16 4 8 10-10 8h-24z" class="artcloud" fill="#fff"/><path d="M14 112l10-6 12 3 6 7-7 5H18z" class="artcloud" fill="#fff"/>
  <circle cx="26" cy="24" r="6" fill="#ffc93c"/><circle cx="298" cy="122" r="6" fill="#5fd08a"/><circle cx="290" cy="22" r="5" fill="#ff6b6b"/>
  <g transform="translate(92 6) rotate(-6 68 68)">
    <rect x="-5" y="-5" width="145" height="145" rx="9" fill="#7a4a2b" ${o}/>
    ${yard(0, 0, cols[0])}${yard(81, 0, cols[1])}${yard(81, 81, cols[2])}${yard(0, 81, cols[3])}${cells}
    <path d="M54 54l13.5 13.5L54 81z" fill="${cols[0]}"/><path d="M54 54h27L67.5 67.5z" fill="${cols[1]}"/><path d="M81 54v27L67.5 67.5z" fill="${cols[2]}"/><path d="M54 81h27L67.5 67.5z" fill="${cols[3]}"/>
    <rect x="54" y="54" width="27" height="27" fill="none" stroke="${ink}" stroke-width="2"/>
  </g>
  ${pawn(58, 112, cols[0], 1.25)}${pawn(196, 66, cols[2], .8)}${pawn(126, 46, cols[1], .7)}${pawn(152, 118, cols[3], .85)}
  <g transform="translate(262 84) rotate(12)" ${o}><rect x="-17" y="-17" width="34" height="34" rx="5" fill="#fff8ec"/><g fill="${ink}" stroke="none"><rect x="-11" y="-11" width="6" height="6"/><rect x="5" y="-11" width="6" height="6"/><rect x="-3" y="-3" width="6" height="6"/><rect x="-11" y="5" width="6" height="6"/><rect x="5" y="5" width="6" height="6"/></g></g></svg>`;
}

// Pet Farm card: a low-poly island with a farmhouse and a Mossbun.
export function farmArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g>
    <path d="M36 40l14-8 16 4 8 10-10 8H44z" class="artcloud" fill="#fff"/><path d="M236 28l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <path d="M0 122h320v28H0z" class="artsea" fill="#7fcdf0"/>
    <path d="M30 104l40-22h190l34 22-40 26H74z" fill="#8fd16a" ${o}/>
    <path d="M30 104l44 26h180l40-26v10l-40 26H74l-44-26z" fill="#b98a5e" ${o}/>
    <g ${o}><path d="M196 92V62h54v30z" fill="#f4e3c1"/><path d="M188 64l35-24 35 24z" fill="#d9584e"/><path d="M216 92V74h14v18z" fill="#8a5a3c"/><path d="M236 70h9v9h-9z" fill="#bfe6fb"/></g>
    <g ${o}><path d="M278 96V84" fill="none"/><path d="M266 86l12-22 12 22z" fill="#4a9a45"/></g>
    <g ${o}><path d="M70 58l4-26 9 2 1 24zM96 58l1-24 9-2 4 26z" fill="#f7ecd0"/>
      <path d="M52 86l8-20 18-10h24l18 10 8 20-8 20-18 10H78l-18-10z" fill="#f7ecd0"/>
      <path d="M58 72l6-8 14-8h24l14 8 6 8-10 2-8-6-10 6-8-6-10 6-8-6z" fill="#5fb04a"/></g>
    <path d="M74 86l5-4 5 4-5 4zM96 86l5-4 5 4-5 4z" fill="#2b2230"/><path d="M85 96l5 4 5-4" fill="none" stroke="#2b2230" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M62 96h8v5h-8zM110 96h8v5h-8z" fill="#ff8a9a" opacity=".7"/>
  </svg>`;
}

// Tower Stack card: a leaning tower of toy blocks on a sky island, with one more block coming down on a balloon.
export function stackArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#ff7a59', '#c8e66b'], off = [0, 5, -3, 7, 12];
  // an isometric-ish block: front face plus a lighter top
  const blk = (x, y, c) => `<path d="M${x} ${y}h52v15h-52z" fill="${c}" ${o}/><path d="M${x} ${y}l9-7h52l-9 7z" fill="#fff" fill-opacity=".45" ${o}/><path d="M${x + 52} ${y}l9-7v15l-9 7z" fill="#3b2219" fill-opacity=".22" ${o}/>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A wobbly tower of coloured blocks with another block floating down on a balloon">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g>
    <path d="M30 44l14-8 16 4 8 10-10 8H38z" class="artcloud" fill="#fff"/><path d="M246 34l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/><path d="M262 104l10-5 12 3 5 7-7 5h-15z" class="artcloud" fill="#fff"/>
    <path d="M0 128h320v22H0z" class="artsea" fill="#7fcdf0"/>
    <path d="M70 124l30-12h110l30 12-34 16h-102z" fill="#8fd16a" ${o}/>
    <path d="M118 112h74v12h-74z" fill="#a9a6b0" ${o}/>
    ${off.map((d, i) => blk(129 + d, 97 - i * 15, cols[i])).join('')}
    <g transform="translate(52 -16) rotate(8 190 20)"><path d="M190 30v-2" ${o} fill="none"/><path d="M190 4c11 0 17 8 17 16s-9 15-17 18c-8-3-17-10-17-18s6-16 17-16z" fill="#ff7a59" ${o}/>
      <path d="M190 38v20" fill="none" stroke="#3b2219" stroke-width="2.5"/>${blk(164, 65, '#7fd1e8')}</g>
    <path d="M206 62l-7 3M204 50l-8-1M208 74l-6 4" fill="none" stroke="#3b2219" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

// Mini Golf Party card: a blocky green with a flag, a windmill and a ball rolling for the cup.
export function golfArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  let tiles = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) tiles += `<path d="M${62 + c * 24 - r * 12} ${78 + r * 16}h24l-12 16h-24z" fill="${(r + c) % 2 ? '#7fd457' : '#8cdc62'}"/>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A blocky mini golf green with a flag, a windmill and a ball rolling to the cup">
    <rect class="artsky" width="320" height="150" fill="#8fd6f7"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g>
    <path d="M30 34h34v10H30zM46 26h26v10H46z" class="artcloud" fill="#fff"/><path d="M244 22h30v9h-30zM232 30h28v9h-28z" class="artcloud" fill="#fff"/>
    <path d="M26 126l36-48h216l-36 48z" fill="#5fbf58" ${o}/><path d="M26 126h216v12H26z" fill="#a86a42" ${o}/><path d="M242 126l36-48v12l-36 48z" fill="#8a5433" ${o}/>
    ${tiles}
    <path d="M26 126l36-48h216l-36 48z" fill="none" stroke="#f7e3c0" stroke-width="7" stroke-linejoin="round"/><path d="M26 126l36-48h216l-36 48z" fill="none" ${o}/>
    <g ${o}><path d="M176 96l8-44h20l8 44z" fill="#fff4e2"/><path d="M180 52l14-16 14 16z" fill="#e5543b"/>
      <g class="gfmill" style="transform-origin:194px 56px"><path d="M191 56h6v-30h-6zM191 56h6v30h-6zM194 53v6h30v-6zM194 53v6h-30v-6z" fill="#ffb547"/></g><circle cx="194" cy="56" r="4" fill="#3b2219"/></g>
    <ellipse cx="96" cy="94" rx="11" ry="6" fill="#2a1422"/><path d="M96 94V40" stroke="#3b2219" stroke-width="4" stroke-linecap="round"/><path d="M98 42l26 9-26 10z" fill="#e5543b" ${o}/>
    <path d="M236 112c-30 4-60 0-92-8" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>
    <circle cx="140" cy="103" r="8" fill="#ff8fab" ${o}/><circle cx="137" cy="100" r="2.4" fill="#fff"/></svg>`;
}

// Liar's Dice card: a tilted dice cup with dice tumbling out on a round table, under a sky.
export function diceArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const pip = (x, y, r = 3.2, c = '#3b2219') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const die = (x, y, rot, pips, cls = '') => `<g class="${cls}" transform="rotate(${rot} ${x + 17} ${y + 17})"><rect x="${x}" y="${y}" width="34" height="34" rx="8" fill="#fff8ec" ${o}/>${pips.map(([px, py, r, c]) => pip(x + px, y + py, r, c)).join('')}</g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A dice cup tipped over a round table with three dice tumbling out">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g>
    <path d="M26 40l14-8 16 4 8 10-10 8H34z" class="artcloud" fill="#fff"/><path d="M250 30l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <ellipse cx="160" cy="132" rx="150" ry="34" fill="#b9794a" ${o}/><ellipse cx="160" cy="126" rx="138" ry="28" fill="#3f9f96" ${o}/>
    <g class="dcup" style="transform-origin:96px 96px"><path d="M58 104l22-62 54 20-30 58z" fill="#ff8fab" ${o}/><path d="M64 88l50 18-6 11-48-17z" fill="#3b2219" fill-opacity=".22"/><ellipse cx="81" cy="112" rx="26" ry="11" transform="rotate(20 81 112)" fill="#c95f7c" ${o}/></g>
    ${die(140, 92, -12, [[10, 10], [24, 24], [17, 17]])}${die(188, 80, 14, [[17, 17, 5, '#e5543b']], 'ddie')}${die(232, 98, -6, [[10, 10], [24, 10], [10, 24], [24, 24], [17, 17]])}
    <path d="M150 66l-6-9M172 58l1-11M204 60l7-8" fill="none" stroke="#3b2219" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

// Pawperty card: a strip of the board with a pet waiting in its box, a little palace, a bone and two dice.
export function pawArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const tile = (x, c) => `<g><path d="M${x} 128l14-40h58l8 40z" fill="#fff6e4" ${o}/><path d="M${x + 14} 88h58l2.6 13H${x + 9.4}z" fill="${c}" ${o}/></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A board of pet shops with a bunny in a box, a little palace, a bone and two dice">
    <rect width="320" height="150" fill="#bfe8ff"/>
    <path d="M30 34l14-8 16 4 8 10-10 8H38z" fill="#fff"/><path d="M236 26l12-6 14 4 6 8-8 6h-18z" fill="#fff"/>
    <path d="M0 150l26-66h268l26 66z" fill="#a5dc86" ${o}/>
    ${tile(22, '#ff7a8a')}${tile(98, '#ffa24a')}${tile(174, '#c98bff')}${tile(250, '#4db5ff')}
    <g class="pwbun" style="transform-origin:60px 100px"><path d="M50 70c-6-18 0-26 4-26s8 10 6 26M66 70c0-18 6-26 10-24s4 12-4 26" fill="#ffd0dc" ${o}/><ellipse cx="60" cy="84" rx="19" ry="17" fill="#fff" ${o}/><circle cx="53" cy="82" r="2.6" fill="#3b2219"/><circle cx="67" cy="82" r="2.6" fill="#3b2219"/><path d="M57 89q3 3 6 0" fill="none" stroke="#3b2219" stroke-width="2.4" stroke-linecap="round"/><circle cx="48" cy="88" r="3" fill="#ff8fab"/><circle cx="72" cy="88" r="3" fill="#ff8fab"/></g>
    <path d="M36 92h48l-4 28H40z" fill="#d2a56e" ${o}/><path d="M36 92l-8 10h14zM84 92l8 10H78z" fill="#b98a55" ${o}/><rect x="50" y="101" width="20" height="10" rx="2" fill="#fff6e4" stroke="#3b2219" stroke-width="2"/>
    <g ${o}><rect x="196" y="62" width="34" height="40" fill="#fff6e4"/><path d="M190 64l23-22 23 22z" fill="#c98bff"/><rect x="186" y="56" width="10" height="46" fill="#fff6e4"/><path d="M184 58l7-14 7 14z" fill="#c98bff"/><rect x="230" y="56" width="10" height="46" fill="#fff6e4"/><path d="M228 58l7-14 7 14z" fill="#c98bff"/><rect x="207" y="82" width="12" height="20" fill="#8a5a3c"/></g>
    <g class="pwbone" style="transform-origin:140px 60px"><path d="M122 50a7 7 0 0 1 12 4l14 10a7 7 0 1 1 4 12 7 7 0 1 1-12-4l-14-10a7 7 0 1 1-4-12z" fill="#e2a868" ${o}/></g>
    <g transform="rotate(-10 276 66)"><rect x="262" y="52" width="28" height="28" rx="7" fill="#fff8ec" ${o}/><circle cx="270" cy="60" r="2.8" fill="#3b2219"/><circle cx="282" cy="72" r="2.8" fill="#3b2219"/><circle cx="276" cy="66" r="2.8" fill="#3b2219"/></g>
    <g transform="rotate(12 300 84)"><rect x="288" y="72" width="24" height="24" rx="6" fill="#fff8ec" ${o}/><circle cx="300" cy="84" r="4" fill="#e5543b"/></g>
  </svg>`;
}

// Kart Island Race card: a little kart zooming along a road over a floating island, past an item box.
export function kartArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A kart racing along a road on a floating island past a gift-wrapped item box">
    <rect class="artsky" width="320" height="150" fill="#8fd6f7"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g>
    <path d="M34 30h34v10H34zM50 22h26v10H50z" class="artcloud" fill="#fff"/><path d="M240 20h30v9h-30zM228 28h28v9h-28z" class="artcloud" fill="#fff"/>
    <path d="M8 112c40-26 260-26 304 0l-16 14c-30 14-240 14-272 0z" fill="#8bca60" ${o}/>
    <path d="M24 126c34 16 238 16 272 0l-30 20H52z" fill="#c98a5a" ${o}/>
    <path d="M18 116c46-18 238-18 284 0l-10 6c-44-14-220-14-264 0z" fill="#8b8192" ${o}/>
    <path d="M40 114l12-3M84 106l14-2M136 102h16M188 102l16 1M240 106l14 2M280 112l10 3" stroke="#fff4e2" stroke-width="3" stroke-linecap="round"/>
    <g class="krbox"><rect x="236" y="62" width="30" height="30" rx="5" fill="#9aa8ff" ${o}/><path d="M251 62v30M236 77h30" stroke="#ffd23f" stroke-width="6"/><path d="M236 77h30M251 62v30" stroke="#3b2219" stroke-width="1.2" opacity=".4"/><path d="M244 58c2-6 6-6 7 4 1-10 5-10 7-4" fill="#ffd23f" ${o}/></g>
    <g class="krkart">
      <path d="M58 92h10M50 100h14M54 84h8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
      <path d="M86 98l6-18h56l14 10 4 10z" fill="#ff8fab" ${o}/><path d="M80 100h92v8H80z" fill="#fff4e2" ${o}/>
      <circle cx="96" cy="108" r="10" fill="#3b2219"/><circle cx="96" cy="108" r="4" fill="#fff4e2"/><circle cx="156" cy="108" r="10" fill="#3b2219"/><circle cx="156" cy="108" r="4" fill="#fff4e2"/>
      <path d="M104 80c0-10 6-16 14-16" fill="none" stroke="#3b2219" stroke-width="3"/>
      <path d="M108 86c0-12 4-18 14-18s14 6 14 18z" fill="#7ed3b2" ${o}/><path d="M132 76l12 6" stroke="#3b2219" stroke-width="7" stroke-linecap="round"/><path d="M132 76l12 6" stroke="#7ed3b2" stroke-width="3" stroke-linecap="round"/>
      <circle cx="122" cy="56" r="15" fill="#f7cba6" ${o}/><path d="M107 54c2-12 26-14 30-2-8-4-20-4-30 2z" fill="#5b3a2a" ${o}/>
      <circle cx="118" cy="58" r="2" fill="#3b2219"/><circle cx="127" cy="58" r="2" fill="#3b2219"/><path d="M119 64c2 2 5 2 7 0" stroke="#3b2219" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M72 94c-6-2-12-2-16 2 6 2 10 4 16 2z" fill="#ffb547" ${o}/>
    </g></svg>`;
}

// Cozy Kitchen Rush card: a counter on a sky island with a steaming soup pot, a burger and a chopping board.
export function kitchenArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A little kitchen counter with a steaming soup pot, a burger and a tomato on a chopping board">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g>
    <path d="M24 40l14-8 16 4 8 10-10 8H32z" class="artcloud" fill="#fff"/><path d="M252 26l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <path d="M0 150l20-36h280l20 36z" fill="#a5dc86" ${o}/>
    <g ${o}><path d="M30 34h260v14H30z" fill="#fff4e2"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => `<path d="M${30 + i * 20} 48h20l-3 12h-14z" fill="${i % 2 ? '#fff' : '#ff7a59'}"/>`).join('')}</g>
    <path d="M40 92h240v32H40z" fill="#e9d3b0" ${o}/><path d="M34 84h252v10H34z" fill="#fff8ec" ${o}/>
    <path d="M58 100h22v18H58zM100 100h22v18h-22zM198 100h22v18h-22zM240 100h22v18h-22z" fill="#d7b98f" stroke="#3b2219" stroke-width="2"/>
    <g class="krsteam" style="transform-origin:88px 40px"><path d="M80 52c-6-8 6-10 0-18M94 50c-6-8 6-10 0-18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
    <g ${o}><path d="M64 58h48v24a6 6 0 0 1-6 6H70a6 6 0 0 1-6-6z" fill="#9aa4b0"/><path d="M58 58h60" /><ellipse cx="88" cy="60" rx="22" ry="4" fill="#e8603f"/><path d="M58 66h-6M118 66h6"/></g>
    <g class="krbun" style="transform-origin:160px 84px" ${o}><path d="M138 66a22 16 0 0 1 44 0z" fill="#e8a95b"/><path d="M135 66h50l-3 5h-44z" fill="#7ccc5c"/><rect x="136" y="71" width="48" height="8" rx="4" fill="#8a4b2a"/><path d="M138 79h44v6h-44z" fill="#e8a95b"/></g>
    <path d="M150 58h.5M160 55h.5M170 58h.5" stroke="#fff4e2" stroke-width="3" stroke-linecap="round"/>
    <g ${o}><path d="M204 76h60v8h-60z" fill="#e8c48f"/><circle cx="226" cy="68" r="10" fill="#e5543b"/><path d="M222 58l4 3 4-3" fill="none" stroke="#4a9a45" stroke-width="3"/><path d="M246 80l18-22 4 3-16 20z" fill="#d9dde3"/></g>
  </svg>`;
}

// Treasure Dig card: a grass field with dug tiles, numbers, a gem popping out and a shovel stuck in the dirt.
export function digArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const tile = (x, y, dug, n, c) => `<g><path d="M${x} ${y}h34l-5 -18h-24z" fill="${dug ? '#d6a46c' : '#7cc45a'}" ${o}/>${dug ? '' : `<path d="M${x} ${y}h34v6h-34z" fill="#5a9a3c" ${o}/>`}${n ? `<text x="${x + 17}" y="${y - 4}" text-anchor="middle" font-family="Rubik, system-ui, sans-serif" font-weight="700" font-size="14" fill="${c}" stroke="#fff4e2" stroke-width="3" paint-order="stroke">${n}</text>` : ''}</g>`;
  const rows = [[118, 0], [100, 1], [82, 2]], tiles = [];
  rows.forEach(([y, r]) => { for (let k = 0; k < 7; k++) { const x = 46 + k * 34 + r * 5; const dug = (r === 0 && k > 1 && k < 5) || (r === 1 && k > 2 && k < 5) || (r === 2 && k === 3); const n = dug && (r === 0 && k === 2 ? 1 : r === 1 && k === 4 ? 2 : r === 0 && k === 4 ? 1 : 0); tiles.push(tile(x, y, dug, n, n === 2 ? '#2f9a4a' : '#2f7fd8')); } });
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A grass field with dug tiles showing numbers, a gem popping out and a shovel">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="40" r="1.5"/><circle cx="18" cy="50" r="1.2"/></g>
    <path d="M26 36l14-8 16 4 8 10-10 8H34z" class="artcloud" fill="#fff"/><path d="M246 22l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <path d="M18 150l26-74h252l26 74z" fill="#8a5a3c" ${o}/>
    ${tiles.reverse().join('')}
    <g class="dgem" style="transform-origin:168px 52px"><path d="M152 50l6-9h20l6 9-16 20z" fill="#ff5c8a" ${o}/><path d="M158 50l4-6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>
    <path d="M168 28l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/>
    <g transform="rotate(18 262 70)"><rect x="258" y="22" width="8" height="54" rx="3" fill="#a86a42" ${o}/><rect x="252" y="18" width="20" height="8" rx="3" fill="#a86a42" ${o}/><path d="M250 74h24v14q-12 10-24 0z" fill="#c9ccd6" ${o}/></g>
    <g transform="translate(60 52)"><circle r="11" fill="#2b2430" ${o}/><path d="M7 -8l5 -7" stroke="#8a5a3c" stroke-width="3" stroke-linecap="round"/><circle cx="13" cy="-16" r="3" fill="#ffd84a"/></g>
  </svg>`;
}

// Sky Bricks card: a well of pastel bricks on a floating island, one brick falling in and a stone flying off.
export function bricksArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const C = { p: '#ff8fab', l: '#c8e66b', b: '#9aa8ff', a: '#ffb547', t: '#59d6c2', c: '#ff7a59', v: '#c59bff', s: '#a7a2b3' };
  const rows = ['sss.sssss', 'pvvaa.ttb', 'ppv.accbb', '.pl..ac..', '..l......'];
  const cell = (x, y, k) => `<rect x="${106 + x * 12}" y="${110 - y * 12}" width="12" height="12" fill="${C[k]}" stroke="#3b2219" stroke-width="2"/>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A well of colourful bricks on a floating island with one brick falling in">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="42" cy="18" r="1.6"/><circle cx="270" cy="14" r="1.3"/><circle cx="292" cy="62" r="1.5"/><circle cx="18" cy="70" r="1.2"/><circle cx="246" cy="44" r="1.1"/><circle cx="74" cy="50" r="1.2"/></g>
    <path d="M22 44l14-8 16 4 8 10-10 8H30z" class="artcloud" fill="#fff"/><path d="M250 30l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <path d="M56 126c30-12 178-12 208 0l-14 10c-30 8-150 8-180 0z" fill="#8bca60" ${o}/><path d="M70 136c30 8 150 8 180 0l-34 16h-112z" fill="#c98a5a" ${o}/>
    <rect x="104" y="26" width="112" height="98" fill="#465396" ${o}/>
    <rect x="94" y="22" width="12" height="104" fill="#b9794a" ${o}/><rect x="214" y="22" width="12" height="104" fill="#b9794a" ${o}/><rect x="88" y="122" width="144" height="10" rx="3" fill="#a86a42" ${o}/>
    ${rows.map((r, y) => [...r].map((k, x) => (k === '.' ? '' : cell(x, y, k))).join('')).join('')}
    <g class="sbfall">${[[0, 0], [1, 0], [2, 0], [1, 1]].map(([x, y]) => `<rect x="${154 + x * 12}" y="${48 - y * 12}" width="12" height="12" fill="#ffd84a" stroke="#3b2219" stroke-width="2"/>`).join('')}</g>
    <g class="sbstone"><rect x="252" y="76" width="16" height="16" rx="2" fill="#a7a2b3" ${o} transform="rotate(18 260 84)"/><path d="M236 96l8-5M240 104l7-3" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>
    <path d="M60 84l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

// Beanstalk Bounce card: a climber leaping between leaf ledges on a beanstalk, a storm cloud rumbling below.
export function beanArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const ledge = (x, y, w, c) => `<path d="M${x} ${y}h${w}a7 7 0 0 1 0 14h-${w}a7 7 0 0 1 0-14z" fill="${c}" ${o}/>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A little climber jumping between leaf ledges on a giant beanstalk above a storm cloud">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="262" cy="62" r="1.5"/><circle cx="68" cy="70" r="1.2"/><circle cx="150" cy="40" r="1.1"/><circle cx="84" cy="10" r="1.2"/></g>
    <path d="M64 30h34v10H64zM80 22h26v10H80z" class="artcloud" fill="#fff"/><path d="M226 44h30v9h-30zM214 52h28v9h-28z" class="artcloud" fill="#fff"/>
    <path d="M14 -4c10 30-8 50 2 80s-6 50 0 80h26c-8-30 8-52 0-80s8-50-2-80z" fill="#5aad4c" ${o}/><path d="M40 40c14-10 28-8 36 2-12 8-26 8-36-2z" fill="#7ed067" ${o}/>
    <path d="M280 -4c-10 30 8 50-2 80s6 50 0 80h26c-8-30 8-52 0-80s8-50-2-80z" fill="#5aad4c" ${o}/><path d="M280 76c-14-10-28-8-36 2 12 8 26 8 36-2z" fill="#7ed067" ${o}/>
    ${ledge(70, 104, 70, '#9be06a')}${ledge(170, 76, 62, '#ffc4dc')}${ledge(96, 40, 56, '#ffdca8')}
    <g class="bbshroom"><rect x="202" y="64" width="8" height="12" fill="#fff4e2" ${o}/><path d="M192 66c0-14 28-14 28 0z" fill="#ef5a4c" ${o}/><circle cx="201" cy="60" r="2.4" fill="#fff"/><circle cx="211" cy="61" r="2" fill="#fff"/></g>
    <g class="bbstorm"><path d="M-10 150v-18c10-10 26-8 34 0 8-12 30-12 38 0 10-10 30-10 38 0 8-10 28-10 36 0 8-12 30-12 38 0 10-10 30-10 38 0 8-10 28-10 36 0 8-10 26-10 34 0 10-8 28-8 38 0v18z" fill="#5a4b8c" ${o}/><path d="M150 126l-8 12h7l-4 12 12-16h-7z" fill="#ffe36b" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></g>
    <g class="bbhop">
      <path d="M138 96l-6 8M150 96l8 6" stroke="#3b2219" stroke-width="7" stroke-linecap="round"/><path d="M138 96l-6 8M150 96l8 6" stroke="#5b6fd6" stroke-width="3" stroke-linecap="round"/>
      <path d="M134 78c0-8 20-8 20 0v16h-20z" fill="#ff8fab" ${o}/><path d="M134 80l-10-8M154 80l10-10" stroke="#3b2219" stroke-width="7" stroke-linecap="round"/><path d="M134 80l-10-8M154 80l10-10" stroke="#ff8fab" stroke-width="3" stroke-linecap="round"/>
      <circle cx="144" cy="62" r="14" fill="#f7cba6" ${o}/><path d="M130 60c2-12 26-14 28-2-8-4-18-4-28 2z" fill="#5b3a2a" ${o}/>
      <circle cx="140" cy="64" r="2" fill="#3b2219"/><circle cx="149" cy="64" r="2" fill="#3b2219"/><path d="M141 69c2 2 5 2 7 0" stroke="#3b2219" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M126 104l4 6M144 108v7M160 104l-4 6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
    </g></svg>`;
}

// Sky Darts card: a dartboard on a wooden stand on a sky island, two darts in it and a third on its way.
export function dartsArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"', cx = 172, cy = 70;
  let segs = '';
  for (let i = 0; i < 20; i++) {
    const a0 = (i * 18 - 9 - 90) * Math.PI / 180, a1 = (i * 18 + 9 - 90) * Math.PI / 180, even = i % 2 === 0;
    const wedge = (r0, r1, c) => `<path d="M${(cx + Math.cos(a0) * r0).toFixed(1)} ${(cy + Math.sin(a0) * r0).toFixed(1)}L${(cx + Math.cos(a0) * r1).toFixed(1)} ${(cy + Math.sin(a0) * r1).toFixed(1)}A${r1} ${r1} 0 0 1 ${(cx + Math.cos(a1) * r1).toFixed(1)} ${(cy + Math.sin(a1) * r1).toFixed(1)}L${(cx + Math.cos(a1) * r0).toFixed(1)} ${(cy + Math.sin(a1) * r0).toFixed(1)}A${r0} ${r0} 0 0 0 ${(cx + Math.cos(a0) * r0).toFixed(1)} ${(cy + Math.sin(a0) * r0).toFixed(1)}z" fill="${c}"/>`;
    segs += wedge(6, 44, even ? '#2b2228' : '#f6e7c8') + wedge(24, 29, even ? '#e5543b' : '#3fae5d') + wedge(39, 44, even ? '#e5543b' : '#3fae5d');
  }
  const dart = (x, y, rot, c, cls = '') => `<g transform="translate(${x} ${y}) rotate(${rot})"><g class="${cls}"><path d="M0 0l-14 0" stroke="#5b5f66" stroke-width="2.5" stroke-linecap="round"/><path d="M-12 -3h-18v6h18z" fill="#d9dde3" ${o}/><path d="M-30 0h-12" stroke="#3b2219" stroke-width="3"/><path d="M-40 0l-12-9h10l8 9-8 9h-10z" fill="${c}" ${o}/></g></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A dartboard on a wooden stand on a floating island with darts in it and one flying in">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="42" cy="18" r="1.6"/><circle cx="264" cy="14" r="1.3"/><circle cx="292" cy="72" r="1.5"/><circle cx="18" cy="80" r="1.2"/><circle cx="84" cy="44" r="1.1"/></g>
    <path d="M24 40l14-8 16 4 8 10-10 8H32z" class="artcloud" fill="#fff"/><path d="M256 36l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <path d="M0 132h320v18H0z" class="artsea" fill="#7fcdf0"/>
    <path d="M66 128l30-10h152l30 10-36 16H102z" fill="#8fd16a" ${o}/>
    <path d="M112 12h14v112h-14zM218 12h14v112h-14z" fill="#b57c4e" ${o}/><path d="M104 20l68-18 68 18v10H104z" fill="#e5543b" ${o}/>
    <rect x="122" y="22" width="100" height="98" rx="6" fill="#6b4a3c" ${o}/>
    <circle cx="${cx}" cy="${cy}" r="47" fill="#2b2228" ${o}/>${segs}<circle cx="${cx}" cy="${cy}" r="6" fill="#3fae5d"/><circle cx="${cx}" cy="${cy}" r="2.8" fill="#e5543b"/>
    <circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="#d9dde3" stroke-width="1.2"/>
    ${dart(cx + 2, cy - 26, 196, '#ff8fab')}${dart(cx - 14, cy + 6, 170, '#9aa8ff')}${dart(cx + 1, cy, 158, '#ffb547', 'dtfly')}
  </svg>`;
}

// Tysiąc card: a king and queen of hearts (a marriage) with an ace behind them, and "1000" chalked on a slate.
export function tysArt() {
  const red = '#d8402a', heart = 'M12 21.5S3 15.8 3 9.6A4.9 4.9 0 0 1 12 6.8a4.9 4.9 0 0 1 9 2.8c0 6.2-9 11.9-9 11.9z',
    spade = 'M12 1.8s8.6 6.4 8.6 11.5a4.3 4.3 0 0 1-7.4 3l1.3 5.2h-5l1.3-5.2a4.3 4.3 0 0 1-7.4-3C3.4 8.2 12 1.8 12 1.8z';
  const card = (x, y, rot, r, col, path, d) => `<g class="fan" style="--d:${d}s;transform-origin:${x + 30}px ${y + 84}px"><g transform="rotate(${rot} ${x + 30} ${y + 84})">
    <rect x="${x}" y="${y}" width="60" height="84" rx="9" fill="#fff8ec" stroke="${ink}" stroke-width="3"/>
    <text x="${x + 8}" y="${y + 24}" font-family="Rubik, Nunito, sans-serif" font-weight="700" font-size="22" fill="${col}">${r}</text>
    <path d="${path}" fill="${col}" transform="translate(${x + 22} ${y + 36}) scale(1.45)"/></g></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A king and queen of hearts with an ace of spades, next to a slate that says 1000">
  <rect width="320" height="150" fill="#b8433f"/>
  <path d="M0 0h320v150H0z" fill="url(#tysp)"/><defs><pattern id="tysp" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M14 4l5 5-5 5-5-5z" fill="#fff4e222"/><circle cx="0" cy="21" r="2.4" fill="#fff4e222"/><circle cx="28" cy="21" r="2.4" fill="#fff4e222"/></pattern></defs>
  <ellipse cx="160" cy="166" rx="210" ry="92" fill="#3f9c7a" stroke="${ink}" stroke-width="3"/>
  ${card(52, 40, -18, 'A', ink, spade, .4)}${card(88, 30, -4, 'K', red, heart, 0)}${card(126, 34, 12, 'Q', red, heart, .2)}
  <g transform="rotate(5 250 78)"><rect x="204" y="46" width="94" height="64" rx="8" fill="#3b2f3a" stroke="#8a5a3c" stroke-width="6"/>
    <text x="251" y="90" text-anchor="middle" font-family="Rubik, Nunito, sans-serif" font-weight="700" font-size="34" fill="#fff4e2">1000</text>
    <path d="M222 98h58" stroke="#fff4e288" stroke-width="3" stroke-linecap="round"/></g></svg>`;
}

// Pan card: the nine of hearts on a blue table with a climbing fan of cards on top of it.
export function panArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const heart = (x, y, k, c = '#d8402a') => `<path transform="translate(${x} ${y}) scale(${k})" d="M12 21.5S3 15.8 3 9.6A4.9 4.9 0 0 1 12 6.8a4.9 4.9 0 0 1 9 2.8c0 6.2-9 11.9-9 11.9z" fill="${c}"/>`;
  const spade = (x, y, k) => `<path transform="translate(${x} ${y}) scale(${k})" d="M12 1.8s8.6 6.4 8.6 11.5a4.3 4.3 0 0 1-7.4 3l1.3 5.2h-5l1.3-5.2a4.3 4.3 0 0 1-7.4-3C3.4 8.2 12 1.8 12 1.8z" fill="#3b2219"/>`;
  const card = (x, y, rot, label, pip, cls = '') => `<g class="${cls}" style="animation-delay:${-x * 9}ms"><g transform="rotate(${rot} ${x + 24} ${y + 34})"><rect x="${x}" y="${y}" width="48" height="68" rx="8" fill="#fff8ec" ${o}/><text x="${x + 7}" y="${y + 23}" font-family="Rubik, system-ui, sans-serif" font-weight="700" font-size="21" fill="${pip === 's' ? '#3b2219' : '#d8402a'}">${label}</text>${pip === 's' ? spade(x + 16, y + 30, 1.25) : heart(x + 16, y + 30, 1.25)}</g></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="The nine of hearts on a blue table with a ten, a king and an ace fanned on top">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="122" cy="14" r="1.6"/><circle cx="214" cy="12" r="1.3"/><circle cx="292" cy="50" r="1.5"/><circle cx="18" cy="60" r="1.2"/><circle cx="64" cy="14" r="1.2"/></g>
    <path d="M22 34l14-8 16 4 8 10-10 8H30z" class="artcloud" fill="#fff"/><path d="M254 26l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <ellipse cx="160" cy="134" rx="152" ry="36" fill="#b9794a" ${o}/><ellipse cx="160" cy="128" rx="140" ry="30" fill="#4f6fc4" ${o}/>
    ${card(74, 52, -14, '9', 'h')}${card(118, 44, -5, '10', 's', 'pfan')}${card(162, 42, 5, 'K', 'h', 'pfan')}${card(206, 46, 14, 'A', 's', 'pfan')}
    <path d="M262 62l10-8M268 80h13M96 34l-5-10" fill="none" stroke="#3b2219" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

// Hay Hunch card: rows of hay bales on a floating meadow, one tossed up showing carrots, a sign and a napping pet.
export function hayArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const bale = (x, y, cls = '') => `<g class="${cls}"><rect x="${x}" y="${y}" width="40" height="26" rx="4" fill="#e8c25a" ${o}/><rect x="${x + 9}" y="${y}" width="5" height="26" fill="#a8742f"/><rect x="${x + 26}" y="${y}" width="5" height="26" fill="#a8742f"/><path d="M${x + 4} ${y + 8}h8M${x + 18} ${y + 15}h6M${x + 32} ${y + 9}h5" stroke="#f5dc85" stroke-width="2.5" stroke-linecap="round"/></g>`;
  const carrot = (x, y, r) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x - 2} ${y - 13}l-4-7M${x + 2} ${y - 13}l4-7M${x} ${y - 13}v-8" stroke="#3f9a52" stroke-width="3" stroke-linecap="round"/><path d="M${x - 6} ${y - 12}q6-4 12 0l-5 20q-1 2-2 0z" fill="#ff8a3c" stroke="#3b2219" stroke-width="2.4" stroke-linejoin="round"/></g>`;
  const bales = [];
  for (const [y, xs] of [[66, [78, 124, 216]], [94, [64, 110, 156, 202]]]) for (const x of xs) bales.push(bale(x, y));
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Hay bales on a floating meadow, one tossed up over two carrots, a wooden sign and a napping pet">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="40" cy="16" r="1.6"/><circle cx="270" cy="12" r="1.3"/><circle cx="300" cy="52" r="1.5"/><circle cx="16" cy="60" r="1.2"/><circle cx="150" cy="10" r="1.1"/></g>
    <path d="M22 36l14-8 16 4 8 10-10 8H30z" class="artcloud" fill="#fff"/><path d="M248 24l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <path d="M30 118c40-16 220-16 260 0l-16 12c-40 10-188 10-228 0z" fill="#8bca60" ${o}/><path d="M46 130c40 10 188 10 228 0l-40 20h-148z" fill="#c98a5a" ${o}/>
    <path d="M58 92h200l8 30H50z" fill="#d2a56c" ${o}/>
    ${bales.join('')}
    ${carrot(178, 82, -18)}${carrot(190, 84, 16)}
    ${bale(162, 30, 'hbale')}
    <g transform="translate(272 70)"><rect x="-3" y="10" width="6" height="40" fill="#8a5a3c" ${o}/><rect x="-20" y="-14" width="40" height="32" rx="6" fill="#fff4e2" ${o}/><rect x="-20" y="-14" width="40" height="8" rx="4" fill="#ffb547"/><text x="0" y="12" text-anchor="middle" font-family="Rubik, system-ui, sans-serif" font-weight="700" font-size="17" fill="#3b2219">7</text></g>
    <g transform="translate(36 98)"><ellipse cx="-7" cy="-12" rx="5" ry="8" fill="#c9b5f0" ${o}/><ellipse cx="7" cy="-12" rx="5" ry="8" fill="#c9b5f0" ${o}/><ellipse cx="0" cy="0" rx="17" ry="13" fill="#c9b5f0" ${o}/><path d="M-8 -1q3 3 6 0M2 -1q3 3 6 0" stroke="#3b2219" stroke-width="2.4" fill="none" stroke-linecap="round"/><text x="16" y="-18" font-family="Rubik, system-ui, sans-serif" font-weight="700" font-size="15" fill="#7a4fc9" stroke="#fff4e2" stroke-width="3" paint-order="stroke">z z</text></g>
  </svg>`;
}

// Pip Party card: five dice in a row on a pink felt tray, two of them hopping, with a little score sheet behind.
export function pipsArt() {
  const o = 'stroke="#3b2219" stroke-width="3" stroke-linejoin="round"';
  const P = [[], [[17, 17]], [[10, 10], [24, 24]], [[10, 10], [17, 17], [24, 24]], [[10, 10], [24, 10], [10, 24], [24, 24]], [[10, 10], [24, 10], [17, 17], [10, 24], [24, 24]], [[10, 9], [24, 9], [10, 17], [24, 17], [10, 25], [24, 25]]];
  const die = (x, y, rot, v, d, fill = '#fff8ec') => `<g class="pdie" style="--d:${d}ms"><g transform="rotate(${rot} ${x + 17} ${y + 17})"><rect x="${x}" y="${y}" width="34" height="34" rx="8" fill="${fill}" ${o}/>${P[v].map(([px, py]) => `<circle cx="${x + px}" cy="${y + py}" r="${v === 1 ? 5 : 3.2}" fill="${v === 1 ? '#e5543b' : '#3b2219'}"/>`).join('')}</g></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Five dice showing fives on a pink felt tray next to a score sheet">
    <rect class="artsky" width="320" height="150" fill="#bfe8ff"/><g class="artstars" fill="#fff6d8"><circle cx="112" cy="14" r="1.6"/><circle cx="204" cy="10" r="1.3"/><circle cx="296" cy="56" r="1.5"/><circle cx="14" cy="66" r="1.2"/><circle cx="160" cy="30" r="1.1"/></g>
    <path d="M20 36l14-8 16 4 8 10-10 8H28z" class="artcloud" fill="#fff"/><path d="M196 24l12-6 14 4 6 8-8 6h-18z" class="artcloud" fill="#fff"/>
    <ellipse cx="160" cy="136" rx="154" ry="36" fill="#b9794a" ${o}/>
    <rect x="34" y="84" width="204" height="56" rx="12" fill="#8a5a3c" ${o}/><rect x="44" y="92" width="184" height="44" rx="7" fill="#c94f6d" ${o}/>
    <g transform="rotate(8 272 82)"><rect x="246" y="40" width="54" height="84" rx="7" fill="#fff8ec" ${o}/><path d="M255 56h36M255 70h36M255 84h36M255 98h22" fill="none" stroke="#c9a99a" stroke-width="3" stroke-linecap="round"/><path d="M280 96l5 6 10-13" fill="none" stroke="#3fae5d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${die(52, 96, -8, 5, 0)}${die(89, 90, 5, 5, -500, '#ffd84a')}${die(126, 98, -3, 5, -1000)}${die(163, 88, 9, 5, -1500, '#ffd84a')}${die(198, 97, -6, 2, -2000)}
    <path d="M100 76l-4-10M140 80v-11M180 74l5-9" fill="none" stroke="#3b2219" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

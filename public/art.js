// Shared illustrations for the hub (SVG strings).
import { iconSvg } from './games/hotpot/icons.js';

const ink = '#3b2219';

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
  <rect width="320" height="150" fill="#3d1f33"/>
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
  <rect width="320" height="150" fill="#3d1f33"/>
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
    <text x="${x + 8}" y="${y + 24}" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="22" fill="${suit[s][0]}">${r}</text>
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
  <rect width="320" height="150" fill="#3d1f33"/>
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
    <rect width="320" height="150" fill="#bfe8ff"/>
    <path d="M36 40l14-8 16 4 8 10-10 8H44z" fill="#fff"/><path d="M236 28l12-6 14 4 6 8-8 6h-18z" fill="#fff"/>
    <path d="M0 122h320v28H0z" fill="#7fcdf0"/>
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

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
    <circle cx="${x - r * .28}" cy="${y + r * .1}" r="${r * .11}" fill="${ink}"/><circle cx="${x + r * .28}" cy="${y + r * .1}" r="${r * .11}" fill="${ink}"/>
    <path d="M${x - r * .16} ${y + r * .36}q${r * .16} ${r * .2} ${r * .32} 0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/></g>`;
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Three smiling marbles rolling down a ramp">
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

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

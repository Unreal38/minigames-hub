// Small flat pictures of the draughts pieces for the HUD (name tags, results): a man is one disc, a king two with a crown.
// side 0 cream (White), 1 dark (Black).
const FILL = ['#fffaf0', '#4d362e'], EDGE = ['#3b2219', '#20120d'];
export function discSvg(king, side, cls = '') {
  const f = FILL[side ? 1 : 0], e = EDGE[side ? 1 : 0];
  const disc = y => `<ellipse cx="12" cy="${y + 3}" rx="9" ry="4" fill="${f}" stroke="${e}" stroke-width="1.8"/><path d="M3 ${y}v3a9 4 0 0 0 18 0v-3" fill="${f}" stroke="${e}" stroke-width="1.8"/><ellipse cx="12" cy="${y}" rx="9" ry="4" fill="${f}" stroke="${e}" stroke-width="1.8"/><ellipse cx="12" cy="${y}" rx="5" ry="2" fill="none" stroke="${side ? '#7a5a4a' : '#d8c298'}" stroke-width="1.4"/>`;
  const crown = '<path d="M7.500 8.500l1.200-4.300 2 2.600 1.300-3.600 1.300 3.600 2-2.600 1.200 4.300z" fill="#ffc93c" stroke="#3b2219" stroke-width="1.4" stroke-linejoin="round"/>';
  return `<svg class="wc-pc ${cls}" viewBox="0 0 24 24" aria-hidden="true">${king ? disc(15) + disc(10) + crown : disc(13)}</svg>`;
}

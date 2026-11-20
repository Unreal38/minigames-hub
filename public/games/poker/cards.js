// Playing cards as HTML (for your hand and the results) and the suit shapes the 3D cards share.
import { RANKS, rankOf, suitOf, cardLabel } from './rules.js';

// Four-colour deck: hearts red, diamonds orange, clubs green, spades ink. Easier to spot a flush.
export const SUIT_COLS = ['#e5543b', '#f08a24', '#2f8a5a', '#3b2219'];
// 24×24 paths. Clubs are drawn as three circles plus this stem.
export const SUIT_PATHS = [
  'M12 21.5S3 15.8 3 9.6A4.9 4.9 0 0 1 12 6.8a4.9 4.9 0 0 1 9 2.8c0 6.2-9 11.9-9 11.9z',
  'M12 1.8l7.6 10.2L12 22.2 4.4 12z',
  'M10.6 13.2h2.8l1.6 8.3H9z',
  'M12 1.8s8.6 6.4 8.6 11.5a4.3 4.3 0 0 1-7.4 3l1.3 5.2h-5l1.3-5.2a4.3 4.3 0 0 1-7.4-3C3.4 8.2 12 1.8 12 1.8z',
];
export const CLUB_DOTS = [[12, 7.4, 4.3], [7, 13.4, 4.3], [17, 13.4, 4.3]];

export function suitSvg(s, size = 20) {
  const col = SUIT_COLS[s];
  const dots = s === 2 ? CLUB_DOTS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('') : '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${col}" aria-hidden="true">${dots}<path d="${SUIT_PATHS[s]}"/></svg>`;
}

// c = -1 draws the back. opts: { cls, big }
export function cardHtml(c, opts = {}) {
  if (c < 0 || c === undefined) return `<span class="pcard back ${opts.cls || ''}" aria-label="Hidden card"><i></i></span>`;
  const r = rankOf(c), s = suitOf(c);
  return `<span class="pcard ${opts.cls || ''}" style="--sc:${SUIT_COLS[s]}" aria-label="${cardLabel(c)}" role="img">
    <b>${RANKS[r]}</b><span class="ps">${suitSvg(s, 18)}</span><span class="pbig">${suitSvg(s, 44)}</span></span>`;
}

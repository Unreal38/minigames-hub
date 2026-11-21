// Quick reactions: six snacks and six emoji. k indexes this combined list.
import { iconSvg } from './games/hotpot/icons.js';
import { CATS } from './games/hotpot/rules.js';
import { STICKERS, STICKER_BASE } from './cosmetics.js';

export const FOODS = [16, 3, 10, 13, 0, 7];
export const EMOJI = ['😂', '❤️', '👍', '😮', '😭', '🔥'];
export const REACT_COUNT = FOODS.length + EMOJI.length;
// k past the free twelve is a sticker from a bought pack (cosmetics.js). Anything unknown shows the first snack.
const clampK = k => { k |= 0; return k >= 0 && k < REACT_COUNT + STICKERS.length ? k : 0; };
export const reactHtml = k0 => { const k = clampK(k0); return k >= STICKER_BASE ? `<span class="emo">${STICKERS[k - STICKER_BASE].e}</span>` : reactHtml0(k); };
const reactHtml0 = k => k < FOODS.length ? iconSvg(FOODS[k]) : `<span class="emo">${EMOJI[k - FOODS.length] || EMOJI[0]}</span>`;
export const reactLabel = k => k < FOODS.length ? CATS[Math.floor(FOODS[k] / 3)].items[FOODS[k] % 3] : EMOJI[k - FOODS.length];

// Float a reaction up from an element.
export function floatAt(el, k) {
  if (!el) return;
  const rc = el.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'floaty'; f.innerHTML = reactHtml(k);
  f.style.left = `${rc.left + rc.width / 2 - 32 + (Math.random() * 30 - 15)}px`; f.style.top = `${rc.top - 10}px`;
  document.body.append(f); setTimeout(() => f.remove(), 1600);
}

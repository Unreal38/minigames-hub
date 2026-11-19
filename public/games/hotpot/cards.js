import { CATS, kindOf, catOf } from './rules.js';
import { iconSvg, backSvg } from './icons.js';

// HTML for a face-up card. tag = 'div' or 'button'.
export function cardHtml(c, { tag = 'div', w, cls = '', attrs = '' } = {}) {
  const cat = CATS[catOf(c)], k = kindOf(c);
  const style = `--c:${cat.col}${w ? `;--cw:${w}px` : ''}`;
  const type = tag === 'button' ? ' type="button"' : '';
  return `<${tag}${type} class="card ${cls}" style="${style}" data-c="${c}" ${attrs} aria-label="${cat.items[k % 3]}, ${cat.name}">
    <span class="band">${cat.name}</span>${iconSvg(k)}<span class="nm">${cat.items[k % 3]}</span></${tag}>`;
}
export const backHtml = (w, cls = '') => `<div class="card back ${cls}" ${w ? `style="--cw:${w}px"` : ''} aria-hidden="true">${backSvg()}</div>`;

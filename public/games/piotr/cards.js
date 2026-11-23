// Piotruś card pictures: each card shows a Pet Farm pet (drawn once from its 3D model by petpic.js) on a card tinted
// with the pet's element colour; the Piotruś is a tuxedo cat on a night-sky card. Used by the HUD (HTML) and by the
// 3D table (canvas textures).
import { petPic, petPicNow } from '../../petpic.js';
import { SPECIES, ELEMENTS } from '../farm/data.js';
import { PETS, PIOTR, PIOTR_PET, petName } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const NIGHT = '#2b2d6e', GOLD = '#ffd84a', INK = '#3b2219';
export const spOf = c => (c === PIOTR ? PIOTR_PET : PETS[c >> 1]);
const petArg = c => ({ sp: spOf(c), lv: 14 }); // grown-up pets: the easiest to tell apart
export const colOf = c => (c === PIOTR ? NIGHT : ELEMENTS[SPECIES[spOf(c)]?.el] || '#8a7f76');
export const picOf = c => petPic(petArg(c), 192);

// A face-up card. Call fillPics(root) after putting cards on the page.
export function cardHtml(c, { cls = '' } = {}) {
  const u = petPicNow(petArg(c));
  return `<span class="pi-c${c === PIOTR ? ' piotr' : ''}${cls ? ' ' + cls : ''}" style="--el:${colOf(c)}" title="${esc(petName(c))}"><i>${u ? `<img src="${u}" alt="">` : `<img data-pic="${c}" alt="">`}</i><b>${esc(petName(c))}</b></span>`;
}
export function fillPics(root) {
  for (const im of root.querySelectorAll('img[data-pic]')) {
    const c = +im.dataset.pic; im.removeAttribute('data-pic');
    picOf(c).then(u => { if (u) im.src = u; });
  }
}
// A face-down card in the back colours of its owner's card back (skins.js loads with the 3D table; red until then).
let backOf = null;
import('../../skins.js').then(m => { backOf = m.backOf; }).catch(() => {});
export function backHtml(cb = 0, { cls = '' } = {}) {
  const B = backOf?.(cb) || { bg: '#e5543b', dot: '#ffffff30' };
  return `<span class="pi-c back${cls ? ' ' + cls : ''}" style="--bg:${B.bg};--dot:${B.dot}"><u></u></span>`;
}

// Paint a face-up card onto a w x h canvas; the pet picture arrives a moment later, so `again` is called to repaint.
const imgs = new Map();
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
export function paintFace(g, w, h, c, again) {
  const k = w / 256, piotr = c === PIOTR, col = colOf(c);
  g.clearRect(0, 0, w, h);
  g.fillStyle = INK; rr(g, 0, 0, w, h, 30 * k); g.fill();
  g.fillStyle = piotr ? NIGHT : '#fff8ec'; rr(g, 10 * k, 10 * k, w - 20 * k, h - 20 * k, 22 * k); g.fill();
  g.save(); rr(g, 10 * k, 10 * k, w - 20 * k, h - 20 * k, 22 * k); g.clip();
  if (piotr) { g.fillStyle = GOLD; for (let i = 0; i < 16; i++) { const x = (Math.sin(i * 12.9) * .5 + .5) * w, y = (Math.sin(i * 78.2 + 1) * .5 + .5) * h * .7; g.beginPath(); g.arc(x, y, (2 + i % 3 * 1.5) * k, 0, 7); g.fill(); } }
  else { g.globalAlpha = .28; g.fillStyle = col; g.fillRect(0, 0, w, h * .72); g.globalAlpha = 1; }
  g.fillStyle = piotr ? GOLD : col; g.fillRect(0, h - 84 * k, w, 84 * k);
  g.restore();
  const im = imgs.get(c);
  if (im?.complete && im.naturalWidth) g.drawImage(im, 18 * k, 34 * k, 220 * k, 220 * k);
  else if (!im) { const n = new Image(); imgs.set(c, n); n.onload = () => again?.(); picOf(c).then(u => { if (u) n.src = u; }); }
  else im.addEventListener('load', () => again?.(), { once: true });
  g.fillStyle = piotr ? INK : '#fff'; g.font = `700 ${34 * k}px Rubik, Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!piotr) { g.lineWidth = 7 * k; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(petName(c), w / 2, h - 46 * k, w - 40 * k); }
  g.fillText(petName(c), w / 2, h - 46 * k, w - 40 * k);
}

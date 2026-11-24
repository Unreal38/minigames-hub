// Pet Parade card pictures. Every card is painted on a canvas: an element-coloured card with a cream window
// holding a Pet Farm pet (drawn once from its 3D model by petpic.js), a big number or action sign in the corners
// and a round badge under the pet. Grey Stone wild cards have a four-colour wheel. The 3D table uses the canvas
// straight away as a texture (paintFace); the HUD shows the same picture as an <img> (cardHtml + fillCards).
import { petPic } from '../../petpic.js';
import { L } from '../../i18n.js';
import { colOf, faceOf, isWild, petOf, HEX, STONE, NAP, TURN, GIFT, PEBBLE, ROCK, COLS } from './rules.js';

export const INK = '#3b2219', CREAM = '#fff8ec';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const colName = i => [L('Leaf', 'Liść'), L('Ember', 'Żar'), L('Tide', 'Fala'), L('Spark', 'Iskra')][i] ?? '';
export const hexOf = c => (isWild(c) ? STONE : HEX[colOf(c)]);
export const faceName = c => {
  const f = faceOf(c);
  if (f <= 9) return `${colName(colOf(c))} ${f}`;
  if (f === NAP) return `${colName(colOf(c))} ${L('Nap', 'Drzemka')}`;
  if (f === TURN) return `${colName(colOf(c))} ${L('Turnabout', 'Zawrotka')}`;
  if (f === GIFT) return `${colName(colOf(c))} ${L('Gift +2', 'Prezent +2')}`;
  return f === PEBBLE ? L('Pebble (wild)', 'Kamyk (dowolny kolor)') : L('Rockslide (wild, +4)', 'Lawina (dowolny kolor, +4)');
};
const keyOf = c => (isWild(c) ? 'w' + faceOf(c) : colOf(c) + '-' + faceOf(c)); // copies of a card look the same

// ---------- painting ----------
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const P = { // 24 x 24 icon paths
  moon: new Path2D('M14.5 3.2a8.6 8.6 0 1 0 6.3 13.6A7.2 7.2 0 0 1 14.5 3.2z'),
  turnA: new Path2D('M4.6 11.2a7.5 7.5 0 0 1 12.6-4.9'), turnHA: new Path2D('M18.6 2.6v4.6h-4.6'),
  turnB: new Path2D('M19.4 12.8a7.5 7.5 0 0 1-12.6 4.9'), turnHB: new Path2D('M5.4 21.4v-4.6h4.6'),
};
function wheel(g, x, y, r) { // the four element colours as a pinwheel
  for (let i = 0; i < 4; i++) { g.fillStyle = HEX[i]; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, -Math.PI / 2 + i * Math.PI / 2, i * Math.PI / 2); g.closePath(); g.fill(); }
  g.lineWidth = r * .14; g.strokeStyle = INK; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
}
// The sign of a face, centred on x, y, about s px tall: a number, a moon, two arrows, +2 or +4.
function sign(g, c, x, y, s, fill = '#fff') {
  const f = faceOf(c);
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  const text = t => {
    g.font = `700 ${s}px Rubik, Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = s * .2; g.strokeStyle = INK; g.strokeText(t, x, y + s * .04); g.fillStyle = fill; g.fillText(t, x, y + s * .04);
    if (t === '6' || t === '9') { const w = s * .42, h = s * .09, yy = y + s * .48; g.fillStyle = INK; rr(g, x - w / 2 - h * .6, yy - h * .6, w + h * 1.2, h * 2.2, h); g.fill(); g.fillStyle = fill; rr(g, x - w / 2, yy, w, h, h / 2); g.fill(); }
  };
  if (f <= 9) text(String(f));
  else if (f === GIFT) text('+2');
  else if (f === ROCK) { wheel(g, x, y, s * .5); text('+4'); }
  else if (f === PEBBLE) wheel(g, x, y, s * .5);
  else {
    const k = s / 24; g.translate(x - 12 * k, y - 12 * k); g.scale(k, k);
    if (f === NAP) {
      g.lineWidth = 3.6; g.strokeStyle = INK; g.stroke(P.moon); g.fillStyle = fill; g.fill(P.moon);
      g.font = '700 9px Rubik, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 2.6; g.strokeText('z', 17.5, 6.5); g.fillText('z', 17.5, 6.5);
    } else {
      for (const p of [P.turnA, P.turnHA, P.turnB, P.turnHB]) { g.lineWidth = 6; g.strokeStyle = INK; g.stroke(p); }
      for (const p of [P.turnA, P.turnHA, P.turnB, P.turnHB]) { g.lineWidth = 2.8; g.strokeStyle = fill; g.stroke(p); }
    }
  }
  g.restore();
}
// Paint card c on a w x h canvas (made for 256 x 364). pet: a loaded <img> of its pet, or null.
export function paintCard(g, w, h, c, pet) {
  const k = w / 256, wild = isWild(c), col = hexOf(c);
  g.save(); g.scale(k, h / 364);
  g.clearRect(0, 0, 256, 364);
  g.fillStyle = INK; rr(g, 0, 0, 256, 364, 30); g.fill();
  g.fillStyle = col; rr(g, 10, 10, 236, 344, 22); g.fill();
  // little paw prints in the card colour
  g.fillStyle = '#ffffff22';
  for (const [x, y, r] of [[40, 300, 9], [216, 64, 9], [26, 190, 6], [230, 230, 6]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + (i - 1) * r * .9, y - r * 1.25 + Math.abs(i - 1) * r * .3, r * .38, 0, 7); g.fill(); } }
  // the cream window with the pet in it; a wild card's window is the colour wheel, faded
  g.save(); rr(g, 46, 50, 164, 236, 70); g.clip();
  if (wild) { for (let i = 0; i < 4; i++) { g.fillStyle = HEX[i]; g.fillRect(i % 2 ? 128 : 46, i < 2 ? 50 : 168, 82, 118); } g.fillStyle = '#fff8ecd0'; g.fillRect(0, 0, 256, 364); }
  else { g.fillStyle = CREAM; g.fillRect(0, 0, 256, 364); g.globalAlpha = .22; g.fillStyle = col; g.fillRect(0, 200, 256, 120); g.globalAlpha = 1; }
  if (pet) g.drawImage(pet, 40, 64, 176, 176);
  g.restore();
  g.lineWidth = 7; g.strokeStyle = INK; rr(g, 46, 50, 164, 236, 70); g.stroke();
  // the badge under the pet, and the corners
  g.fillStyle = col; g.beginPath(); g.arc(128, 290, 40, 0, 7); g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  sign(g, c, 128, 290, 50);
  sign(g, c, 40, 46, 56);
  g.save(); g.translate(256, 364); g.rotate(Math.PI); sign(g, c, 40, 46, 56); g.restore();
  g.restore();
}

// ---------- pet pictures ----------
const pets = new Map(); // species -> Promise<HTMLImageElement|null>
function petImage(c) {
  const sp = petOf(c);
  if (!pets.has(sp)) pets.set(sp, petPic({ sp, lv: 14 }, 192).then(u => new Promise(res => { if (!u) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; })).catch(() => null));
  return pets.get(sp);
}
const loaded = new Map(); // species -> img once ready
// For a canvas texture: paints now (without the pet if it is not drawn yet) and calls again() once it is.
export function paintFace(g, w, h, c, again) {
  const sp = petOf(c), im = loaded.get(sp);
  paintCard(g, w, h, c, im || null);
  if (!im) petImage(c).then(img => { if (img) { loaded.set(sp, img); again?.(); } });
}

// ---------- HTML ----------
const urls = new Map(), plain = new Map(), jobs = new Map(); // finished pictures, pictures without the pet yet, pictures being made
const canvasUrl = (c, im) => { const cv = document.createElement('canvas'); cv.width = 192; cv.height = 273; paintCard(cv.getContext('2d'), 192, 273, c, im); return cv.toDataURL('image/png'); };
function urlNow(c) {
  const k = keyOf(c);
  if (urls.has(k)) return urls.get(k);
  if (!plain.has(k)) plain.set(k, canvasUrl(c, null));
  return plain.get(k);
}
function urlLater(c) {
  const k = keyOf(c);
  if (!jobs.has(k)) jobs.set(k, petImage(c).then(im => { if (im) loaded.set(petOf(c), im); const u = canvasUrl(c, im); urls.set(k, u); return u; }));
  return jobs.get(k);
}
// A face-up card. Call fillCards(root) after putting cards on the page.
export function cardHtml(c, { cls = '' } = {}) {
  const k = keyOf(c), done = urls.has(k);
  return `<span class="pp-c${cls ? ' ' + cls : ''}" style="--el:${hexOf(c)}" role="img" aria-label="${esc(faceName(c))}" title="${esc(faceName(c))}"><img src="${urlNow(c)}" alt=""${done ? '' : ` data-k="${c}"`}></span>`;
}
export function fillCards(root) {
  for (const im of root.querySelectorAll('img[data-k]')) {
    const c = +im.dataset.k; im.removeAttribute('data-k');
    urlLater(c).then(u => { if (u && im.isConnected) im.src = u; });
  }
}
// warm the pictures of a hand before it is shown
export const preload = cards => { for (const c of cards) urlLater(c); };
// A face-down card in the colours of its owner's card back (skins.js loads with the 3D table; red until then).
let backOf = null;
import('../../skins.js').then(m => { backOf = m.backOf; }).catch(() => {});
export function backHtml(cb = 0, { cls = '' } = {}) {
  const B = backOf?.(cb) || { bg: '#e5543b', dot: '#ffffff30' };
  return `<span class="pp-c back${cls ? ' ' + cls : ''}" style="--bg:${B.bg};--dot:${B.dot}"><u></u></span>`;
}
// a round swatch of the colour in play, with its name
export const colDot = i => `<i class="pp-dot" style="--el:${HEX[i] || STONE}"></i>`;
export { COLS };

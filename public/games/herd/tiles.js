// Pet Herds tile pictures: a cream tile with the number in its pet's colour and the pet under it (drawn once from
// the Pet Farm 3D model by petpic.js); a Mystery Egg is a speckled egg with "ANY" over it. The 3D table paints
// these on canvases; the tray in the HUD uses the same look in HTML.
import { petPic, petImg } from '../../petpic.js';
import { PETS, EL_COL, isEgg, elOf, numOf } from './rules.js';
import { herdLook, paintHerdFace } from '../../pieceskins.js';

export const W = 128, H = 170; // face size on the canvas, about the shape of a tile
const pics = new Map(); // pet -> Promise<img|null>
export const loaded = new Map();
export function petImage(sp) {
  if (!pics.has(sp)) pics.set(sp, petPic({ sp, lv: 14 }, 160).then(u => new Promise(res => { if (!u) return res(null); const im = new Image(); im.onload = () => { loaded.set(sp, im); res(im); }; im.onerror = () => res(null); im.src = u; })).catch(() => null));
  return pics.get(sp);
}
export const warmPets = () => Promise.all(PETS.map(petImage));

const EGG_PATH = 'M50 6C27 6 10 40 10 64c0 22 18 36 40 36s40-14 40-36C90 40 73 6 50 6z';
function eggArt(g, x, y, s) { // a speckled egg in a 100 x 106 box, scaled by s
  g.save(); g.translate(x, y); g.scale(s, s);
  const p = new Path2D(EGG_PATH);
  g.fillStyle = '#fff3dd'; g.fill(p); g.lineWidth = 6; g.strokeStyle = '#3b2219'; g.stroke(p);
  g.fillStyle = '#b07ad6';
  for (const [cx, cy, r] of [[36, 40, 8], [62, 30, 6], [66, 62, 9], [38, 74, 6], [52, 52, 5], [26, 58, 4]]) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
  g.restore();
}
// Paint the top of a tile on a W x H canvas. pet: the loaded picture of its pet, or null while it is being drawn;
// k: the tile set (Wardrobe kind ht) of the player who owns it.
export function paintTile(g, id, pet, k = 0) {
  const look = herdLook(k);
  g.clearRect(0, 0, W, H);
  paintHerdFace(g, W, H, k);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (isEgg(id)) {
    g.fillStyle = look.ink || '#8a4fb5'; g.font = '700 32px Rubik, Nunito, sans-serif'; g.fillText('ANY', W / 2, 42);
    eggArt(g, 22, 56, .84);
    return;
  }
  g.fillStyle = look.ink || EL_COL[elOf(id)]; g.font = `700 ${numOf(id) >= 10 ? 70 : 78}px Rubik, Nunito, sans-serif`;
  g.fillText(String(numOf(id)), W / 2, 76);
  if (pet) g.drawImage(pet, 20, 80, 88, 88);
}

// HTML tile for the tray (and the results sheet)
const EGG_SVG = `<svg class="hd-egg" viewBox="0 0 100 106" aria-hidden="true"><path d="${EGG_PATH}" fill="#fff3dd" stroke="#3b2219" stroke-width="6"/>${[[36, 40, 8], [62, 30, 6], [66, 62, 9], [38, 74, 6], [52, 52, 5], [26, 58, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#b07ad6"/>`).join('')}</svg>`;
export const tileName = (id, L) => (isEgg(id) ? L('Mystery Egg', 'Tajemnicze jajo') : `${numOf(id)} ${PETS[elOf(id)][0].toUpperCase() + PETS[elOf(id)].slice(1)}`);
export function tileHtml(id, cls = '', L = (a) => a, tag = 'button') {
  const egg = isEgg(id);
  return `<${tag}${tag === 'button' ? ' type="button"' : ''} class="hd-t ${egg ? 'egg' : 'e' + elOf(id)} ${cls}" data-t="${id}" aria-label="${tileName(id, L)}"><b>${egg ? 'ANY' : numOf(id)}</b>${egg ? EGG_SVG : petImg({ sp: PETS[elOf(id)], lv: 14 }, 40, 'hd-pi').replace(/ (title|alt)="[^"]*"/g, '').replace('<img', '<img alt=""')}</${tag}>`;
}

// The tile set as CSS variables, for the tray and the result sheets (the face pattern is a small picture).
const faceUrl = new Map();
export function herdVars(k = 0) {
  k |= 0; const L = herdLook(k);
  if (!faceUrl.has(k)) { let u = 'none'; if (L.motif && typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = 64; c.height = 85; paintHerdFace(c.getContext('2d'), 64, 85, k); u = `url(${c.toDataURL()})`; } faceUrl.set(k, u); }
  return `--ht-face:${L.face};--ht-body:${L.body};--ht-edge:${L.edge};--ht-pat:${faceUrl.get(k)};${L.ink ? `--ht-ink:${L.ink};` : ''}`;
}

// Pet Pairs card pictures, painted on a canvas: a cream card with a soft blob in the pet's element colour, the
// Pet Farm pet (drawn once from its 3D model by petpic.js) and its name. A special pair carries a round badge in the
// corner: a star (Golden, with a gold frame), a spyglass or a whirl. The back is the same for every card.
// The 3D table uses these canvases as textures; the HUD uses the same badges as small inline SVGs.
import { petPic } from '../../petpic.js';
import { SPECIES, ELEMENTS } from '../farm/data.js';

export const INK = '#3b2219', CREAM = '#fff8ec', GOLD = '#ffc93c';
export const TW_COL = { gold: '#ffd34d', spy: '#9fd8ff', mix: '#ffb0c8' };
export const W = 256, H = 344; // 3 by 4, like the cards on the table
export const petName = sp => SPECIES[sp]?.name || sp;
const elCol = sp => ELEMENTS[SPECIES[sp]?.el] || '#8a7f76';

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const ICON = { // 24 x 24 icon paths
  gold: new Path2D('M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z'),
  spyLens: new Path2D('M16.5 10a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0z'), spyHandle: new Path2D('M15 15l6 6'),
  mix: new Path2D('M4 9c2-4 8-5 11-2s1 7-3 6-3-5 0-4M20 15c-2 4-8 5-11 2'),
};
// the badge of a twist: a circle in its colour with the icon, centred on x, y with radius r
export function badge(g, tw, x, y, r) {
  g.save();
  g.fillStyle = TW_COL[tw]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = r * .16; g.strokeStyle = INK; g.stroke();
  const k = r * 1.3 / 24; g.translate(x - 12 * k, y - 12 * k); g.scale(k, k); g.lineJoin = g.lineCap = 'round';
  if (tw === 'gold') { g.fillStyle = '#fff'; g.fill(ICON.gold); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(ICON.gold); }
  else if (tw === 'spy') { g.fillStyle = '#fff'; g.fill(ICON.spyLens); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke(ICON.spyLens); g.lineWidth = 3.2; g.stroke(ICON.spyHandle); }
  else { g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke(ICON.mix); }
  g.restore();
}
// Paint the face of a card on a W x H canvas. pet: a loaded <img> of the pet, or null while it is being drawn.
export function paintFace(g, sp, tw, pet) {
  const col = elCol(sp), gold = tw === 'gold';
  g.clearRect(0, 0, W, H);
  g.fillStyle = INK; rr(g, 0, 0, W, H, 30); g.fill();
  g.fillStyle = gold ? GOLD : CREAM; rr(g, 9, 9, W - 18, H - 18, 22); g.fill();
  if (gold) { g.fillStyle = CREAM; rr(g, 22, 22, W - 44, H - 44, 16); g.fill(); }
  g.globalAlpha = .26; g.fillStyle = col; g.beginPath(); g.ellipse(W / 2, 150, 98, 86, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  if (pet) g.drawImage(pet, W / 2 - 100, 46, 200, 200);
  // the name on a strip in the element colour
  const name = petName(sp);
  g.fillStyle = col; rr(g, 26, H - 82, W - 52, 52, 26); g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  let fs = 34; g.font = `700 ${fs}px Rubik, Nunito, sans-serif`;
  while (g.measureText(name).width > W - 76 && fs > 18) { fs -= 2; g.font = `700 ${fs}px Rubik, Nunito, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 6; g.strokeStyle = INK; g.strokeText(name, W / 2, H - 55); g.fillStyle = '#fff'; g.fillText(name, W / 2, H - 55);
  if (tw) badge(g, tw, W - 48, 48, 30);
}
// The back: sky-blue stripes round a cream paw print.
export function paintBack(g) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = INK; rr(g, 0, 0, W, H, 30); g.fill();
  g.save(); rr(g, 9, 9, W - 18, H - 18, 22); g.clip();
  g.fillStyle = '#2f86cc'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#4fa3e3'; g.lineWidth = 16;
  for (let x = -H; x < W + H; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); }
  g.restore();
  g.lineWidth = 7; g.strokeStyle = '#fff8ec'; rr(g, 24, 24, W - 48, H - 48, 16); g.stroke();
  g.fillStyle = '#fff8ec'; g.strokeStyle = INK; g.lineWidth = 6;
  g.beginPath(); g.arc(W / 2, H / 2, 64, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#ffb547';
  const paw = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); g.lineWidth = 4; g.stroke(); };
  paw(W / 2, H / 2 + 14, 24, 20); paw(W / 2 - 30, H / 2 - 10, 10, 12); paw(W / 2 - 11, H / 2 - 30, 10, 12); paw(W / 2 + 11, H / 2 - 30, 10, 12); paw(W / 2 + 30, H / 2 - 10, 10, 12);
}

// ---------- pet pictures ----------
const pets = new Map(); // species -> Promise<HTMLImageElement|null>
export const loaded = new Map(); // species -> img once ready
export function petImage(sp) {
  if (!pets.has(sp)) pets.set(sp, petPic({ sp, lv: 14 }, 200).then(u => new Promise(res => { if (!u) return res(null); const im = new Image(); im.onload = () => { loaded.set(sp, im); res(im); }; im.onerror = () => res(null); im.src = u; })).catch(() => null));
  return pets.get(sp);
}
// Draw every pet ahead of time, one at a time while the page is idle, so a flipped card shows its pet at once.
// It warms all species, so it gives nothing away about the board.
export function warmAll(alive) {
  const list = Object.keys(SPECIES); let k = 0;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
  const step = () => { if (!alive() || k >= list.length) return; petImage(list[k++]).finally(() => idle(step)); };
  idle(step);
}

// ---------- HTML ----------
const ICO_SVG = {
  gold: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#fff" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/>',
  spy: '<circle cx="10" cy="10" r="6.5" fill="#fff" stroke="#3b2219" stroke-width="2.4"/><path d="M15 15l6 6" stroke="#3b2219" stroke-width="3.2" stroke-linecap="round"/>',
  mix: '<path d="M4 9c2-4 8-5 11-2s1 7-3 6-3-5 0-4M20 15c-2 4-8 5-11 2" fill="none" stroke="#3b2219" stroke-width="2.6" stroke-linecap="round"/>',
};
export const twIcon = (tw, size = 22) => `<span class="pr-tw" style="--tw:${TW_COL[tw]};width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO_SVG[tw]}</svg></span>`;

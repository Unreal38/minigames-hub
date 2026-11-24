// Table themes (cosmetics.js kinds cb, gb, kp; dice are in dice3d.js): how a player's own cards, golf ball and kart look.
// Each game asks here with the index from the seat's fl ({ cb, dc, gb, kp }); 0 or anything unknown is the classic look.
import * as THREE from 'three';

// ---------- card backs ----------
// Both card games paint their backs on a canvas: a coloured field, a pattern, then their own emblem on top.
const BACKS = [
  { bg: '#e5543b', dot: '#ffffff30' },
  { bg: '#4fa8e8', dot: '#ffffff66', pat: 'cloud' },
  { bg: '#2b2d6e', dot: '#ffd23fcc', pat: 'star' },
  { bg: '#ff8fab', dot: '#ffffff88', pat: 'stripe' },
  { bg: '#f7f1e3', dot: '#ff7a3c', pat: 'koi' },
  { bg: '#d9a520', dot: '#fff3b0aa', pat: 'leaf' },
  { bg: '#6b4326', dot: '#f6ead8', pat: 'bean' }, // Coffee beans (Supporter pack)
  // the Pet Farm's five elements, in their colours (ELEMENTS in games/farm/data.js)
  { bg: '#3f9a52', dot: '#c9efb0', pat: 'elLeaf' },
  { bg: '#e0592f', dot: '#ffd23f', pat: 'elEmber' },
  { bg: '#2f86cc', dot: '#e6f6ff', pat: 'elTide' },
  { bg: '#d9a400', dot: '#fff6c9', pat: 'elSpark' },
  { bg: '#8a7f76', dot: '#d8d0c6', pat: 'elStone' },
  { bg: '#f2a65a', dot: '#fff4e2', pat: 'xPaw' },
  { bg: '#ffd6e3', dot: '#ff8fab', pat: 'xBlossom' },   // spring
  { bg: '#3f7fc4', dot: '#ffffff', pat: 'xFlake' },     // winter
  { bg: '#fff8ec', dot: '#ffffff', pat: 'xRainbow' },
];
export const backOf = k => BACKS[k | 0] || BACKS[0];
// Fill the (already clipped) card area w x h with back k.
export function paintBack(g, w, h, k) {
  const B = backOf(k); g.fillStyle = B.bg; g.fillRect(0, 0, w, h); g.fillStyle = g.strokeStyle = B.dot;
  const each = (nx, ny, fn) => { for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) fn((x + (y % 2 ? .5 : 0) + .25) * w / nx, (y + .5) * h / ny, x + y * nx); };
  if (B.pat === 'stripe') { g.lineWidth = w * .07; for (let i = -6; i < 12; i++) { g.beginPath(); g.moveTo(i * w * .2, 0); g.lineTo(i * w * .2 + h * .6, h); g.stroke(); } }
  else if (B.pat === 'star') each(5, 8, (x, y, i) => { const r = i % 3 ? 4 : 8; g.beginPath(); for (let j = 0; j < 10; j++) { const an = j * Math.PI / 5, rr = j % 2 ? r * .45 : r; g.lineTo(x + Math.sin(an) * rr, y - Math.cos(an) * rr); } g.fill(); });
  else if (B.pat === 'cloud') each(3, 6, (x, y) => { for (const [dx, r] of [[-14, 10], [0, 14], [14, 10]]) { g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill(); } });
  else if (B.pat === 'koi') each(3, 5, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * 1.3); g.fillStyle = i % 2 ? '#ff7a3c' : '#e5352b'; g.beginPath(); g.ellipse(0, 0, 20, 9, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-16, 0); g.lineTo(-30, -9); g.lineTo(-30, 9); g.fill(); g.restore(); });
  else if (B.pat === 'bean') each(4, 6, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * 1.1 + .4); g.fillStyle = i % 3 ? '#f6ead8' : '#d9a878'; g.beginPath(); g.ellipse(0, 0, 13, 9, 0, 0, 7); g.fill(); g.strokeStyle = B.bg; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, 1.5); g.bezierCurveTo(-4, -5, 4, 5, 10, -1.5); g.stroke(); g.restore(); });
  else if (B.pat?.startsWith('el')) { // sizes follow the card, so the small Wardrobe picture and the big table card match
    const u = w / 256, ink = '#3b221955';
    if (B.pat === 'elLeaf') each(4, 6, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * 1.9 + .5); g.scale(u, u); g.fillStyle = i % 3 ? B.dot : '#8fd67a'; g.beginPath(); g.moveTo(-22, 0); g.quadraticCurveTo(0, -17, 22, 0); g.quadraticCurveTo(0, 17, -22, 0); g.fill(); g.strokeStyle = B.bg; g.lineWidth = 3; g.beginPath(); g.moveTo(-16, 0); g.lineTo(18, 0); g.stroke(); g.restore(); });
    if (B.pat === 'elEmber') each(4, 6, (x, y, i) => { g.save(); g.translate(x, y + 8 * u); g.scale(u * (i % 2 ? 1 : 1.25), u * (i % 2 ? 1 : 1.25)); for (const [c, k] of [['#ffb02e', 1], ['#ffe98a', .52]]) { g.fillStyle = c; g.beginPath(); g.moveTo(0, -24 * k); g.bezierCurveTo(4 * k, -12 * k, 15 * k, -6 * k, 13 * k, 5 * k); g.bezierCurveTo(12 * k, 14 * k, -12 * k, 14 * k, -13 * k, 5 * k); g.bezierCurveTo(-14 * k, -3 * k, -5 * k, -8 * k, 0, -24 * k); g.fill(); g.translate(0, 4); } g.restore(); });
    if (B.pat === 'elTide') { g.lineCap = 'round'; for (let r = 0; r < 9; r++) { const y = (r + .6) * h / 9, off = r % 2 ? 0 : w / 8; g.strokeStyle = r % 2 ? B.dot : '#9fd6f7'; g.lineWidth = (r % 2 ? 7 : 5) * u; g.beginPath(); for (let c = -1; c < 5; c++) { const x = c * w / 4 + off; g.moveTo(x, y); g.quadraticCurveTo(x + w / 8, y - 26 * u, x + w / 4, y); } g.stroke(); } }
    if (B.pat === 'elSpark') each(4, 6, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i % 2 ? .25 : -.2); g.scale(u * (i % 3 ? 1 : 1.3), u * (i % 3 ? 1 : 1.3)); g.fillStyle = i % 3 ? B.dot : '#ffffff'; g.strokeStyle = '#8a6400'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath(); for (const [px, py] of [[4, -24], [-11, 3], [-2, 3], [-6, 24], [11, -5], [2, -5]]) g.lineTo(px, py); g.closePath(); g.fill(); g.stroke(); g.restore(); });
    if (B.pat === 'elStone') each(4, 7, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * .8); g.scale(u, u); g.fillStyle = ['#d8d0c6', '#b9afa4', '#6b625b'][i % 3]; g.beginPath(); g.ellipse(0, 0, 21 - (i % 2) * 5, 14 - (i % 3) * 2, 0, 0, 7); g.fill(); g.strokeStyle = ink; g.lineWidth = 2.5; g.stroke(); g.fillStyle = '#ffffff55'; g.beginPath(); g.ellipse(-5, -4, 7, 3, -.4, 0, 7); g.fill(); g.restore(); });
  }
  else if (B.pat?.startsWith('x')) { // the second batch, also sized by the card
    const u = w / 256;
    if (B.pat === 'xPaw') each(3, 5, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i % 2 ? .35 : -.3); g.scale(u * 1.15, u * 1.15); g.fillStyle = i % 3 ? B.dot : '#ffd9a8'; g.beginPath(); g.ellipse(0, 8, 13, 10.5, 0, 0, 7); g.fill(); for (const [px, py] of [[-15, -5], [-5.5, -13], [5.5, -13], [15, -5]]) { g.beginPath(); g.ellipse(px, py, 4.8, 6.2, px * .03, 0, 7); g.fill(); } g.restore(); });
    if (B.pat === 'xBlossom') each(3, 5, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * 1.1); g.scale(u * (i % 2 ? 1 : 1.3), u * (i % 2 ? 1 : 1.3)); g.fillStyle = i % 3 ? B.dot : '#ffffff'; g.strokeStyle = '#c2185b55'; g.lineWidth = 1.5; for (let j = 0; j < 5; j++) { g.rotate(1.2566); g.beginPath(); g.moveTo(0, -2); g.bezierCurveTo(9, -5, 8, -19, 0, -18); g.bezierCurveTo(-8, -19, -9, -5, 0, -2); g.fill(); g.stroke(); } g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, 4.2, 0, 7); g.fill(); g.restore(); });
    if (B.pat === 'xFlake') each(3, 5, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * .4); g.scale(u * (i % 2 ? .9 : 1.25), u * (i % 2 ? .9 : 1.25)); g.strokeStyle = i % 3 ? B.dot : '#bfe2ff'; g.lineWidth = 4; g.lineCap = 'round'; for (let j = 0; j < 3; j++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 18); for (const sgn of [-1, 1]) { g.moveTo(-6, sgn * 16); g.lineTo(0, sgn * 10); g.lineTo(6, sgn * 16); } g.stroke(); } g.restore(); });
    if (B.pat === 'xRainbow') { const cols = ['#e8392f', '#f08a1f', '#f2c230', '#4fb85a', '#3f8fe0', '#8a63e0'], bw = w * .13; g.save(); g.translate(w / 2, h / 2); g.rotate(-.6); for (let r = -2; r <= 2; r++) cols.forEach((c, j) => { g.fillStyle = c; g.globalAlpha = r % 2 ? .55 : 1; g.fillRect(-w * 1.5, r * bw * 7.4 + (j - 3) * bw, w * 3, bw + .5); }); g.restore(); g.globalAlpha = 1;
      g.fillStyle = '#ffffff'; each(3, 5, (x, y, i) => { const r = (i % 2 ? 7 : 11) * u; g.beginPath(); for (let j = 0; j < 8; j++) { const an = j * Math.PI / 4, rr = j % 2 ? r * .38 : r; g.lineTo(x + Math.sin(an) * rr, y - Math.cos(an) * rr); } g.fill(); }); }
  }
  else if (B.pat === 'leaf') each(4, 7, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * .9); g.beginPath(); g.ellipse(0, 0, 15, 6, 0, 0, 7); g.fill(); g.restore(); });
  else each(6, 9, (x, y) => { g.beginPath(); g.arc(x, y, w * .03, 0, 7); g.fill(); });
}

// ---------- dice ----------
// Dice skins are whole looks (shape, face art, pips), so they live in dice3d.js.

// ---------- golf balls ----------
// A texture wrapped once round the ball (null for the classic ball in the player's colour, and for plain gold).
const ballTex = new Map();
export function ballLook(k, color) {
  k |= 0;
  if (k === 5) return { color: '#ffcb3d', map: null };
  if (k < 1 || k > 15) return { color, map: null };
  if (!ballTex.has(k)) {
    const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    if (k === 1) { g.fillStyle = '#17141c'; g.fillRect(0, 0, W, H); for (const u of [.25, .75]) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(u * W, H / 2, 30, 30, 0, 0, 7); g.fill(); g.fillStyle = '#17141c'; g.font = '700 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', u * W, H / 2 + 3); } }
    if (k === 2) { g.fillStyle = '#4fb85a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#1f6e33'; g.lineWidth = 12; for (let i = 0; i < 8; i++) { g.beginPath(); for (let y = 0; y <= H; y += 8) g.lineTo(i * 32 + 16 + Math.sin(y / 12 + i) * 5, y); g.stroke(); } }
    if (k === 3) { g.fillStyle = '#3f8fe0'; g.fillRect(0, 0, W, H); g.fillStyle = '#58c26a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse((i * 67) % W, 28 + (i * 41) % 74, 22 + (i % 3) * 8, 12 + (i % 2) * 7, i, 0, 7); g.fill(); } g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, 12); g.fillRect(0, H - 12, W, 12); }
    if (k === 4) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e88a8a'; g.lineWidth = 2; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(i * 26, (i * 37) % H); g.lineTo(i * 26 + 20, (i * 53) % H); g.stroke(); }
      for (const [r, c] of [[34, '#2f86cc'], [26, '#58b0ee'], [14, '#17141c']]) { g.fillStyle = c; g.beginPath(); g.ellipse(W * .75, H / 2, r * .62, r, 0, 0, 7); g.fill(); } g.fillStyle = '#ffffff'; g.beginPath(); g.arc(W * .75 - 7, H / 2 - 9, 5, 0, 7); g.fill(); }
    if (k === 6) { // latte art (Supporter pack): a cup of coffee seen from above, with a foam heart on each side
      g.fillStyle = '#b8743a'; g.fillRect(0, 0, W, H); g.fillStyle = '#fffaf0'; g.fillRect(0, 0, W, 16); g.fillRect(0, H - 16, W, 16);
      g.strokeStyle = '#d9a878'; g.lineWidth = 5; g.lineCap = 'round';
      for (const u of [0, .5, 1]) for (const r of [14, 26]) { g.beginPath(); g.ellipse(u * W, H / 2, r * .62, r, 0, 0, 7); g.stroke(); }
      for (const u of [.25, .75]) { const x = u * W, y = H / 2, s = 30; g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(x, y + s * .95); g.bezierCurveTo(x - s * .95, y - s * .1, x - s * .47, y - s * 1.15, x, y - s * .4); g.bezierCurveTo(x + s * .47, y - s * 1.15, x + s * .95, y - s * .1, x, y + s * .95); g.fill();
        g.strokeStyle = '#b8743a'; g.lineWidth = 3; for (const d of [.2, .48]) { g.beginPath(); g.moveTo(x - s * .3 * (1 - d), y - s * .1 + d * s); g.quadraticCurveTo(x, y + s * .18 + d * s, x + s * .3 * (1 - d), y - s * .1 + d * s); g.stroke(); } }
    }
    if (k === 7) { // bubble (Tide): pale and glassy, a rainbow sheen round the middle, white glints
      g.fillStyle = '#c9eeff'; g.fillRect(0, 0, W, H); const sh = g.createLinearGradient(0, 30, 0, 98); for (const [o, c] of [[0, '#c9eeff00'], [.25, '#ffb3d9aa'], [.5, '#fff3a8aa'], [.75, '#a8f0d0aa'], [1, '#c9eeff00']]) sh.addColorStop(o, c); g.fillStyle = sh; g.fillRect(0, 0, W, H);
      g.fillStyle = '#eaf8ff'; g.fillRect(0, 0, W, 14); g.fillStyle = '#8fcff2'; g.fillRect(0, H - 14, W, 14);
      for (const u of [.2, .7]) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(u * W, 38, 9, 16, .5, 0, 7); g.fill(); g.beginPath(); g.arc(u * W + 20, 58, 5, 0, 7); g.fill(); g.strokeStyle = '#6fb7e8'; g.lineWidth = 3; g.beginPath(); g.arc(u * W + 62, 78, 10, 0, 7); g.stroke(); } }
    if (k === 8) { // fireball (Ember): flames licking up from a hot core
      g.fillStyle = '#d63a22'; g.fillRect(0, 0, W, H); for (const [c, top, amp] of [['#ff8a1f', 52, 30], ['#ffd23f', 84, 22], ['#fff3b0', 108, 10]]) { g.fillStyle = c; g.beginPath(); g.moveTo(0, H); for (let i = 0; i <= 16; i++) { const x = i * 16; g.lineTo(x, top + (i % 2 ? amp : 0)); g.lineTo(x + 8, top + (i % 2 ? 0 : amp) * .5 + amp * .25); } g.lineTo(W, H); g.fill(); }
      g.fillStyle = '#8a1f14'; g.fillRect(0, 0, W, 10); }
    if (k === 9) { // beach ball: six panels and a white cap at each end
      ['#e5402f', '#ffffff', '#ffc93c', '#ffffff', '#2f86cc', '#ffffff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i * W / 6, 0, W / 6 + 1, H); }); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, 13); g.fillRect(0, H - 13, W, 13); }
    if (k === 10) { // tennis ball: fuzzy yellow-green with the white seam curving round
      g.fillStyle = '#cfe23a'; g.fillRect(0, 0, W, H); g.fillStyle = '#b8cc2a'; for (let i = 0; i < 90; i++) g.fillRect((i * 53) % W, (i * 31) % H, 3, 2);
      g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, H / 2 + Math.sin(x / W * Math.PI * 4) * 34); g.stroke(); }
    if (k === 11) { // football: white with black patches
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); const pent = (x, y, r, rot) => { g.beginPath(); for (let j = 0; j < 5; j++) { const an = rot + j * Math.PI * .4; g.lineTo(x + Math.sin(an) * r * .62, y - Math.cos(an) * r); } g.closePath(); g.fill(); };
      g.fillStyle = '#22202a'; for (let i = 0; i < 5; i++) { pent((i + .5) * W / 5, H / 2, 19, 0); pent(i * W / 5, 24, 15, Math.PI); pent(i * W / 5, H - 24, 15, 0); }
      g.strokeStyle = '#c9ccd2'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = (i + .5) * W / 5; g.beginPath(); g.moveTo(x, H / 2 - 19); g.lineTo(x, 0); g.moveTo(x, H / 2 + 19); g.lineTo(x, H); g.stroke(); } g.fillRect(0, 0, W, 5); g.fillRect(0, H - 5, W, 5); }
    if (k === 12) { // moon: grey with craters
      g.fillStyle = '#c9ccd4'; g.fillRect(0, 0, W, H); for (let i = 0; i < 16; i++) { const x = (i * 71 + 20) % W, y = 18 + (i * 43) % 92, r = 5 + (i * 7) % 11; g.fillStyle = '#9da2b0'; g.beginPath(); g.ellipse(x, y, r * .62, r, 0, 0, 7); g.fill(); g.fillStyle = '#e6e8ee'; g.beginPath(); g.ellipse(x + r * .14, y + r * .22, r * .5, r * .8, 0, 0, 7); g.fill(); g.fillStyle = '#b3b7c3'; g.beginPath(); g.ellipse(x, y, r * .42, r * .68, 0, 0, 7); g.fill(); } }
    if (k === 13) { // disco ball: mirror tiles, a few catching coloured light
      const cols = ['#c9d2de', '#aeb8c8', '#e6ecf4', '#98a4b6'], hot = ['#ff7ac8', '#7ad0ff', '#fff07a', '#b48cff']; g.fillStyle = '#5f6a7c'; g.fillRect(0, 0, W, H);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 20; c++) { const i = r * 20 + c; g.fillStyle = (i * 7) % 11 === 0 ? hot[i % 4] : (i * 5) % 13 === 0 ? '#ffffff' : cols[(r + c * 3) % 4]; g.fillRect(c * 12.8 + 1, r * 16 + 1, 10.8, 14); } }
    if (k === 14) { // pumpkin (Halloween): ribs, a green cap, carved faces all round
      g.fillStyle = '#f08a24'; g.fillRect(0, 0, W, H); g.strokeStyle = '#d06a12'; g.lineWidth = 5; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * W / 12 + 4, 0); g.lineTo(i * W / 12 + 4, H); g.stroke(); } g.fillStyle = '#5a8a3a'; g.fillRect(0, 0, W, 11);
      g.fillStyle = '#3b2219'; for (const u of [.125, .375, .625, .875]) { const x = u * W, y = H / 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * 17, y - 6); g.lineTo(x + s * 5, y - 6); g.lineTo(x + s * 11, y - 26); g.fill(); } g.beginPath(); g.moveTo(x - 20, y + 8); g.lineTo(x - 10, y + 16); g.lineTo(x - 4, y + 9); g.lineTo(x + 4, y + 16); g.lineTo(x + 10, y + 9); g.lineTo(x + 20, y + 8); g.lineTo(x + 12, y + 30); g.lineTo(x - 12, y + 30); g.fill(); } }
    if (k === 15) { // paw print: cream with pink paws all round
      g.fillStyle = '#fff4e2'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd9c2'; g.fillRect(0, 0, W, 12); g.fillRect(0, H - 12, W, 12);
      g.fillStyle = '#ff7a9c'; for (const u of [.125, .375, .625, .875]) { const x = u * W, y = H / 2 + 6; g.beginPath(); g.ellipse(x, y + 12, 15, 20, 0, 0, 7); g.fill(); for (const [px, py] of [[-17, -8], [-6, -24], [6, -24], [17, -8]]) { g.beginPath(); g.ellipse(x + px, y + py, 5.5, 10, px * .02, 0, 7); g.fill(); } } }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; ballTex.set(k, t);
  }
  return { color: '#ffffff', map: ballTex.get(k) };
}

// ---------- kart paint ----------
// The body colour (null keeps the player's colour) and extra painted parts as [colour, position, rotation, size] boxes
// that sit on the kart's body, in the kart model's own units.
export function kartPaint(k) {
  k |= 0; const parts = [];
  if (k === 1) for (const x of [-.2, .2]) { parts.push(['#ffffff', [x, .6, -.02], [0, 0, 0], [.17, .03, 2.06]], ['#ffffff', [x, .64, .95], [-.25, 0, 0], [.17, .03, .72]]); }
  if (k === 2) for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) parts.push([(i + j) % 2 ? '#ffffff' : '#22202a', [(i - 2) * .29, .6, -.62 + j * .29], [0, 0, 0], [.29, .03, .29]]);
  if (k === 3) for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z = .8 - i * .42, sz = .42 - i * .07; parts.push(['#ff8a1f', [s * .76, .44, z], [Math.PI / 4, 0, 0], [.03, sz, sz]], ['#ffe066', [s * .775, .44, z + .06], [Math.PI / 4, 0, 0], [.03, sz * .55, sz * .55]]); }
  if (k === 4) for (let i = 0; i < 16; i++) { const x = ((i * 37) % 13) / 13 * 1.3 - .65, z = ((i * 53) % 17) / 17 * 1.9 - .9, s = i % 4 ? .05 : .09; parts.push([i % 3 ? '#ffffff' : '#ffe066', [x, .6, z], [0, i, 0], [s, .03, s]]); }
  if (k === 6) { // mocha (Supporter pack): coffee-brown body, a wide cream stripe with caramel edges, a red heart on the nose
    parts.push(['#f6ead8', [0, .6, -.02], [0, 0, 0], [.34, .03, 2.06]], ['#f6ead8', [0, .64, .95], [-.25, 0, 0], [.34, .03, .72]]);
    for (const x of [-.24, .24]) parts.push(['#c98a4a', [x, .6, -.02], [0, 0, 0], [.07, .032, 2.06]], ['#c98a4a', [x, .64, .95], [-.25, 0, 0], [.07, .032, .72]]);
    parts.push(['#e5543b', [0, .665, .95], [-.25, Math.PI / 4, 0], [.16, .03, .16]]);
  }
  // The driver and seat cover most of the top, so these three paint the bonnet and the sides, where it shows.
  if (k === 7) { // lightning (Spark): a storm-blue kart, a bolt across the bonnet and a zigzag down each side
    const bolt = [[-.24, 1.24], [.12, .98], [-.12, .92], [.24, .64]]; // corner points on the bonnet (x, z), joined by bars
    for (let i = 1; i < bolt.length; i++) { const [x0, z0] = bolt[i - 1], [x1, z1] = bolt[i], x = (x0 + x1) / 2, z = (z0 + z1) / 2; parts.push(['#ffd23f', [x, .642 + (z - .93) * .255, z], [-.25, Math.atan2(x1 - x0, z1 - z0), 0], [.13, .034, Math.hypot(x1 - x0, z1 - z0) + .1]]); }
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) parts.push([i % 2 ? '#ffd23f' : '#ffe98a', [s * .765, .42, .82 - i * .3], [i % 2 ? .62 : -.62, 0, 0], [.03, .1, .4]]);
  }
  if (k === 8) { // ocean waves (Tide): foam crests along each side, two rolling over the bonnet
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const z = .86 - i * .33, sz = i % 2 ? .2 : .28; parts.push([i % 2 ? '#bfe9ff' : '#ffffff', [s * .765, .37, z], [Math.PI / 4, 0, 0], [.03, sz, sz]]); }
    for (const [z, c] of [[1.04, '#ffffff'], [.8, '#bfe9ff']]) for (const s of [-1, 1]) parts.push([c, [s * .19, .642 + (z - .93) * .255, z], [-.25, s * .7, 0], [.5, .032, .1]]);
  }
  if (k === 9) { // candy stripes (Sweet Shop Isle): white stripes slanting down a pink kart
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) parts.push(['#ffffff', [s * .765, .42, .8 - i * .32], [.6, 0, 0], [.03, .5, .12]]);
    for (const z of [1.03, .8]) parts.push(['#ffffff', [0, .642 + (z - .93) * .255, z], [-.25, .5, 0], [1.0, .032, .1]]);
  }
  const hy = z => .642 + (z - .93) * .255, SX = .765; // the bonnet's top at depth z, and the side panels' x
  if (k === 10) { // taxi: yellow, a black-and-white chequered band along each side and across the bonnet
    for (const s of [-1, 1]) for (let i = 0; i < 12; i++) for (let r = 0; r < 2; r++) parts.push([(i + r) % 2 ? '#22202a' : '#ffffff', [s * SX, .47 - r * .09, .93 - i * .17], [0, 0, 0], [.03, .09, .17]]);
    for (let i = 0; i < 8; i++) for (let r = 0; r < 2; r++) parts.push([(i + r) % 2 ? '#22202a' : '#ffffff', [-.49 + i * .14, hy(.98 - r * .14), .98 - r * .14], [-.25, 0, 0], [.14, .03, .14]]);
  }
  if (k === 11) { // ladybird: red with black spots, a black line down the bonnet
    for (const s of [-1, 1]) for (const [z, y, r] of [[.8, .46, .17], [.42, .36, .13], [.05, .47, .18], [-.35, .37, .14], [-.72, .46, .17]]) parts.push(['#22202a', [s * SX, y, z], [Math.PI / 4, 0, 0], [.03, r, r]]);
    parts.push(['#22202a', [0, hy(.93), .93], [-.25, 0, 0], [.07, .032, .7]]);
    for (const [x, z, r] of [[-.32, 1.08, .17], [.32, 1.08, .17], [-.3, .76, .13], [.3, .76, .13]]) parts.push(['#22202a', [x, hy(z), z], [-.25, Math.PI / 4, 0], [r, .032, r]]);
  }
  if (k === 12) { // tiger: orange with black stripes leaning back, a cream belly line
    for (const s of [-1, 1]) { for (let i = 0; i < 7; i++) parts.push(['#22202a', [s * SX, .43 + (i % 2 ? .04 : -.02), .88 - i * .28], [-.5, 0, 0], [.03, i % 2 ? .22 : .32, .09]]); parts.push(['#fff4e2', [s * SX, .28, .05], [0, 0, 0], [.028, .06, 2.1]]); }
    for (const z of [1.1, .9, .7]) for (const s of [-1, 1]) parts.push(['#22202a', [s * .26, hy(z), z], [-.25, s * .6, 0], [.44, .032, .08]]);
  }
  if (k === 13) { // rainbow: six bands along each side and down the bonnet of a cream kart
    const cols = ['#e8392f', '#f08a1f', '#f2c230', '#4fb85a', '#3f8fe0', '#8a63e0'];
    cols.forEach((c, j) => { for (const s of [-1, 1]) parts.push([c, [s * SX, .545 - j * .05, .05], [0, 0, 0], [.03, .05, 2.16]]); parts.push([c, [-.3 + j * .12, hy(.93), .93], [-.25, 0, 0], [.12, .032, .7]]); });
  }
  if (k === 14) { // watermelon: dark stripes on a green rind, a slice of red with seeds on the bonnet
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) parts.push(['#1f6e33', [s * SX, .42, .92 - i * .26 + (i % 2 ? .03 : 0)], [i % 2 ? .12 : -.12, 0, 0], [.03, .32, .09]]);
    parts.push(['#fff4e2', [0, hy(.93), .93], [-.25, 0, 0], [1.04, .03, .6]], ['#e5402f', [0, hy(.93) + .004, .93], [-.25, 0, 0], [.92, .03, .5]]);
    for (const [x, z] of [[-.3, 1.04], [0, 1.08], [.3, 1.04], [-.16, .82], [.16, .82]]) parts.push(['#22202a', [x, hy(z) + .008, z], [-.25, .3, 0], [.05, .03, .09]]);
  }
  if (k === 15) { // ice (winter): pale blue, frosty white diamonds low on the sides, a snowflake on the bonnet
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) { const sz = i % 2 ? .13 : .2; parts.push([i % 2 ? '#ffffff' : '#eaf7ff', [s * SX, .31 + sz * .3, .9 - i * .24], [Math.PI / 4, 0, 0], [.03, sz, sz]]); }
    for (let j = 0; j < 3; j++) parts.push(['#ffffff', [0, hy(.93) + j * .002, .93], [-.25, j * Math.PI / 3, 0], [.07, .032, .6]]);
    for (let j = 0; j < 6; j++) { const an = j * Math.PI / 3, x = Math.sin(an) * .22, z = .93 + Math.cos(an) * .22; parts.push(['#ffffff', [x, hy(z) + .008, z], [-.25, an + Math.PI / 4, 0], [.1, .032, .1]]); }
  }
  const BODY2 = { 10: '#ffc93c', 11: '#e5352b', 12: '#f08a24', 13: '#fff4e2', 14: '#4fb85a', 15: '#7cc8f0' };
  if (BODY2[k]) return { body: BODY2[k], parts };
  return { body: k === 9 ? '#ff8fab' : k === 8 ? '#2f86cc' : k === 7 ? '#2b2d6e' : k === 6 ? '#6b4326' : k === 5 ? '#f2c230' : k === 4 ? '#3f2f86' : null, parts };
}

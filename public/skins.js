// Table themes (cosmetics.js kinds cb, dc, gb, kp): how a player's own cards, dice, golf ball and kart look.
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
  else if (B.pat === 'leaf') each(4, 7, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(i * .9); g.beginPath(); g.ellipse(0, 0, 15, 6, 0, 0, 7); g.fill(); g.restore(); });
  else each(6, 9, (x, y) => { g.beginPath(); g.arc(x, y, w * .03, 0, 7); g.fill(); });
}

// ---------- dice ----------
// The dice texture is white with dark pips, so a tint on the material colours the die and keeps the pips readable.
const DICE = [null, '#ff8088', '#84e3ae', '#ffabd4', '#96a2ff', '#ffd45c'];
export const diceTint = k => DICE[k | 0] || null;

// ---------- golf balls ----------
// A texture wrapped once round the ball (null for the classic ball in the player's colour, and for plain gold).
const ballTex = new Map();
export function ballLook(k, color) {
  k |= 0;
  if (k === 5) return { color: '#ffcb3d', map: null };
  if (k < 1 || k > 4) return { color, map: null };
  if (!ballTex.has(k)) {
    const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    if (k === 1) { g.fillStyle = '#17141c'; g.fillRect(0, 0, W, H); for (const u of [.25, .75]) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(u * W, H / 2, 30, 30, 0, 0, 7); g.fill(); g.fillStyle = '#17141c'; g.font = '700 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', u * W, H / 2 + 3); } }
    if (k === 2) { g.fillStyle = '#4fb85a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#1f6e33'; g.lineWidth = 12; for (let i = 0; i < 8; i++) { g.beginPath(); for (let y = 0; y <= H; y += 8) g.lineTo(i * 32 + 16 + Math.sin(y / 12 + i) * 5, y); g.stroke(); } }
    if (k === 3) { g.fillStyle = '#3f8fe0'; g.fillRect(0, 0, W, H); g.fillStyle = '#58c26a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse((i * 67) % W, 28 + (i * 41) % 74, 22 + (i % 3) * 8, 12 + (i % 2) * 7, i, 0, 7); g.fill(); } g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, 12); g.fillRect(0, H - 12, W, 12); }
    if (k === 4) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e88a8a'; g.lineWidth = 2; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(i * 26, (i * 37) % H); g.lineTo(i * 26 + 20, (i * 53) % H); g.stroke(); }
      for (const [r, c] of [[34, '#2f86cc'], [26, '#58b0ee'], [14, '#17141c']]) { g.fillStyle = c; g.beginPath(); g.ellipse(W * .75, H / 2, r * .62, r, 0, 0, 7); g.fill(); } g.fillStyle = '#ffffff'; g.beginPath(); g.arc(W * .75 - 7, H / 2 - 9, 5, 0, 7); g.fill(); }
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
  return { body: k === 5 ? '#f2c230' : k === 4 ? '#3f2f86' : null, parts };
}

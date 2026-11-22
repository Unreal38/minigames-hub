// Dice skins (cosmetics.js kind dc): how a player's dice look in every dice game (Liar's Dice, Pip Party, Ludo,
// Snakes & Ladders, Pawperty) and in their Wardrobe picture. A skin is more than a colour: it has its own shape
// (sharp, chamfered, gem cut, puffy, rough rock), its own face art (wood grain, marble veins, starry sky...),
// its own pips (paw prints, hearts, stars, chocolate chips...) and parts that glow.
//
//   const kit = diceKit({ side, classic })   one per scene; side = the value painted on +x, -x, +y, -y, +z, -z
//                                             (each game keeps its own, so its "turn value v to the top" table still works)
//   kit.dress(mesh, k, size)                  give a die mesh skin k (geometry and material; its BackSide outline
//                                             and glow children get the same geometry)
//   kit.geo(k, size), kit.mat(k), kit.dim(k)  the parts on their own (dim = the darker twin Liar's Dice uses for
//                                             dice that did not count)
//   kit.sparks(k)                             particle colours that suit the skin
//   kit.dispose()
//
// Each look is one canvas atlas (six faces side by side) on one toon material, so a die is still one draw call
// (plus its outline), whatever the skin. Only append to SKINS: players' choices are saved as indexes.
import * as THREE from 'three';
import { toonMat } from './scenery3d.js';

export const SIDE = [2, 5, 1, 6, 3, 4];

// r: how much of each face's edge is bevelled (0 = sharp cube), b: bevel steps, smooth: round normals instead of
// flat facets, jit: how lumpy the corners are.
const SHAPES = {
  box: { r: 0 },
  bevel: { r: .16, b: 1 },
  gem: { r: .46, b: 1 },
  round: { r: .44, b: 3, smooth: true },
  rock: { r: .22, b: 1, jit: .09 },
};

// shape, face art (pat with its colours), the pips (pip style, ink colour, the 1 in its own colour and size),
// glow: what lights up by itself (pips and/or art) and how strongly.
const SKINS = [
  { shape: 'box', base: '#fff8ec', edge: '#d9c3a4', pat: 'frame', pip: 'round', ink: '#3b2219', one: '#e5543b', big1: 1.6, sparks: ['#ffd84a', '#ffffff', '#ff8fab'] }, // 0 Classic
  { shape: 'gem', base: '#c81d3a', edge: '#ff7d92', pat: 'facets', pip: 'diamond', ink: '#ffffff', outline: '#6e0c1e', one: '#ffe27a', big1: 1.85, pipK: 1.35, glow: { pips: .55 }, sparks: ['#ff4d6d', '#ffd0d8', '#ffffff'] }, // 1 Ruby gem
  { shape: 'bevel', base: '#3fae7c', edge: '#2a845c', pat: 'veins', vein: ['#9be8c2', '#1f6e4a'], pip: 'inlay', ink: '#ffcf4a', inkHi: '#fff3b0', one: '#ffcf4a', big1: 1.6, carve: '#1f6146', sparks: ['#7fe0b0', '#ffcf4a', '#ffffff'] }, // 2 Carved jade
  { shape: 'round', base: '#ff9ccb', edge: '#ff7fb8', pat: 'swirl', swirl: '#ffc4e1', pip: 'heart', ink: '#8f1450', one: '#d81b60', big1: 1.6, pipK: 1.3, outline: '#8f1450', sparks: ['#ff8fc4', '#ffffff', '#ffe066'] }, // 3 Bubblegum candy
  { shape: 'bevel', base: '#1c2160', edge: '#383f9e', pat: 'galaxy', pip: 'star', ink: '#ffe27a', one: '#ff9ad5', big1: 1.7, pipK: 1.2, glow: { pips: .9, pat: .6 }, sparks: ['#ffe27a', '#b9a5ff', '#ffffff'] }, // 4 Starry midnight
  { shape: 'bevel', base: '#f2bf3a', edge: '#ffe58a', pat: 'brushed', pip: 'round', ink: '#7a4a12', one: '#b02a2a', big1: 1.6, carve: '#fff1b8', sparks: ['#ffd84a', '#fff3b0', '#ffffff'] }, // 5 Solid gold
  { shape: 'bevel', base: '#c98a4e', edge: '#9a6233', pat: 'wood', pip: 'round', ink: '#4a2812', one: '#4a2812', big1: 1.7, carve: '#e8b57e', sparks: ['#e8b57e', '#ffffff', '#86cc5a'] }, // 6 Oak wood
  { shape: 'gem', base: '#9fe6ff', edge: '#e6fbff', pat: 'ice', pip: 'diamond', ink: '#1d5bb0', one: '#7a4dff', big1: 1.5, pipK: 1.35, glow: { pat: .35 }, sparks: ['#c8f4ff', '#ffffff', '#9fb8ff'] }, // 7 Ice crystal
  { shape: 'round', base: '#fff1dc', edge: '#f2d7b2', pat: 'calico', pip: 'paw', ink: '#4a2a1c', one: '#d92a62', big1: 1.45, pipK: 1.3, sparks: ['#ff8fab', '#ffffff', '#ffcf8a'] }, // 8 Paw prints
  { shape: 'rock', base: '#3a2c2e', edge: '#55403f', pat: 'lava', pip: 'round', ink: '#ffd23a', one: '#fff1a0', big1: 1.6, pipK: 1.2, glow: { pips: 1, pat: 1 }, sparks: ['#ff8a1f', '#ffd23a', '#ff4d2e'] }, // 9 Lava rock
  { shape: 'round', base: '#f4fbff', edge: '#cfe6fa', pat: 'frost', pip: 'flake', ink: '#2264b8', one: '#e5543b', big1: 1.45, pipK: 1.35, sparks: ['#ffffff', '#c8ecff', '#9fd0ff'] }, // 10 Snowball
  { shape: 'round', base: '#d9995a', edge: '#b8763d', pat: 'cookie', pip: 'chip', ink: '#4a2616', one: '#4a2616', big1: 1.6, pipK: 1.3, sparks: ['#d9995a', '#ffffff', '#4a2616'] }, // 11 Choc-chip cookie
  { shape: 'rock', base: '#9aa1a8', edge: '#7c838b', pat: 'moss', pip: 'flower', ink: '#ffffff', inkHi: '#ffd84a', one: '#ff7aa0', big1: 1.45, pipK: 1.35, outline: '#3a3f46', sparks: ['#86cc5a', '#ffffff', '#ff9ac0'] }, // 12 Mossy stone
  { shape: 'box', base: '#5fd36a', edge: '#3a9e46', pat: 'pixel', pip: 'pixel', ink: '#163a1c', one: '#a3172a', big1: 1.5, sparks: ['#5fd36a', '#ffffff', '#ffe066'] }, // 13 Pixel
];
export const DICE_SKINS = SKINS.length;
const skinOf = k => SKINS[k | 0] ? k | 0 : 0;

// ---------- shapes ----------
// A box with a few segments per side; the outer ring of vertices is pulled onto a bevel. UVs are spread so the
// flat part of each face shows the middle of its face art and the bevel shows the art's edge band.
const _h = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function shapeGeo(name, size, side) {
  const { r = 0, b = 1, smooth = false, jit = 0 } = SHAPES[name] || SHAPES.box;
  const segs = r ? 2 * b + 1 : 1, per = (segs + 1) * (segs + 1);
  let g = new THREE.BoxGeometry(2, 2, 2, segs, segs, segs);
  const pos = g.attributes.position, uv = g.attributes.uv, nor = g.attributes.normal;
  const step = i => i <= b ? -1 + r * i / b : 1 - r * (segs - i) / b; // grid line i -> where it sits
  const at = c => r ? step(Math.round((c + 1) / 2 * segs)) : c;
  const p = new THREE.Vector3(), q = new THREE.Vector3(), d = new THREE.Vector3(), lim = 1 - r;
  for (let i = 0; i < pos.count; i++) {
    p.set(at(pos.getX(i)), at(pos.getY(i)), at(pos.getZ(i)));
    if (r) {
      q.set(THREE.MathUtils.clamp(p.x, -lim, lim), THREE.MathUtils.clamp(p.y, -lim, lim), THREE.MathUtils.clamp(p.z, -lim, lim));
      d.subVectors(p, q); const l = d.length();
      if (l > 1e-6) { d.divideScalar(l); p.copy(q).addScaledVector(d, r); if (smooth) nor.setXYZ(i, d.x, d.y, d.z); }
    }
    if (jit) p.multiplyScalar(1 + (_h(Math.round(p.x * 50), Math.round(p.y * 50), Math.round(p.z * 50)) - .5) * jit);
    pos.setXYZ(i, p.x * size / 2, p.y * size / 2, p.z * size / 2);
    const f = Math.floor(i / per), u = r ? (step(Math.round(uv.getX(i) * segs)) + 1) / 2 : uv.getX(i), v = r ? (step(Math.round(uv.getY(i) * segs)) + 1) / 2 : uv.getY(i);
    uv.setXY(i, (side[f] - 1 + .015 + u * .97) / 6, v);
  }
  if (!smooth && r) { const n = g.toNonIndexed(); g.dispose(); g = n; g.computeVertexNormals(); }
  g.computeBoundingSphere(); return g;
}

// ---------- face art ----------
const SZ = 160; // pixels per face
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const mixC = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
const AT = [[.5, .5], [.25, .25], [.75, .75], [.75, .25], [.25, .75], [.25, .5], [.75, .5]];
const PIPS = [[], [0], [1, 2], [1, 0, 2], [1, 2, 3, 4], [1, 2, 3, 4, 0], [1, 2, 3, 4, 5, 6]];

function pipPath(g, style, r, R) { // a pip shape round (0, 0), radius r; R is the random source
  g.beginPath();
  if (style === 'square' || style === 'pixel') g.rect(-r * .9, -r * .9, r * 1.8, r * 1.8);
  else if (style === 'diamond') { g.moveTo(0, -r * 1.25); g.lineTo(r * 1.05, 0); g.lineTo(0, r * 1.25); g.lineTo(-r * 1.05, 0); g.closePath(); }
  else if (style === 'star') for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5, rr = j % 2 ? r * .55 : r * 1.35; g.lineTo(Math.sin(a) * rr, -Math.cos(a) * rr); }
  else if (style === 'heart') { const s = r * 1.15; g.moveTo(0, s * .95); g.bezierCurveTo(-s * 1.5, -s * .1, -s * .75, -s * 1.15, 0, -s * .4); g.bezierCurveTo(s * .75, -s * 1.15, s * 1.5, -s * .1, 0, s * .95); }
  else if (style === 'paw') { g.ellipse(0, r * .38, r * .72, r * .58, 0, 0, 7); for (const [x, y, s] of [[-.82, -.32, .3], [-.3, -.82, .32], [.3, -.82, .32], [.82, -.32, .3]]) { g.moveTo(x * r + s * r, y * r); g.ellipse(x * r, y * r, s * r, s * r * 1.15, 0, 0, 7); } }
  else if (style === 'chip') { const n = 9; for (let j = 0; j < n; j++) { const a = j / n * 6.283, rr = r * (.85 + R() * .35); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }
  else if (style === 'flower') { for (let j = 0; j < 5; j++) { const a = j / 5 * 6.283 - 1.57; g.moveTo(Math.cos(a) * r * .62 + r * .5, Math.sin(a) * r * .62); g.arc(Math.cos(a) * r * .62, Math.sin(a) * r * .62, r * .5, 0, 7); } }
  else g.arc(0, 0, r, 0, 7);
}
// Readability: a pip whose colour is too close to the face gets a ring in whichever of white or a deep shade of the
// face stands out more, so every skin's pips can be counted at a glance (contrast as in WCAG, 1 to 21).
const lum = c => { const k = new THREE.Color(c); return .2126 * k.r + .7152 * k.g + .0722 * k.b; }; // THREE.Color is linear
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const PIP_CONTRAST = 3.2;
function haloOf(sk, col) {
  if (sk.outline || contrast(col, sk.base) >= PIP_CONTRAST) return null;
  const dark = shade(sk.base, .32); return contrast(dark, sk.base) >= contrast('#ffffff', sk.base) ? dark : '#ffffff';
}
function drawPip(g, sk, x, y, r, one, R, glow) {
  const col = one ? sk.one : sk.ink, halo = glow ? null : haloOf(sk, col);
  g.save(); g.translate(x, y); if (sk.pip === 'chip' || sk.pip === 'flower') g.rotate(R() * 6.28);
  if (glow) { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = r * .9; pipPath(g, sk.pip, r * 1.05, R); g.fill(); g.restore(); return; }
  if (sk.carve) { g.fillStyle = sk.carve; g.save(); g.translate(r * .16, r * .2); pipPath(g, sk.pip, r * 1.06, rng(1)); g.fill(); g.restore(); }
  if (sk.pip === 'flake') { // a snowflake: six arms with little side twigs
    g.strokeStyle = col;
    if (halo) { g.save(); g.strokeStyle = halo; g.lineWidth = r * .62; g.lineCap = 'round'; for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); g.stroke(); } g.restore(); g.strokeStyle = col; } g.lineCap = 'round'; g.lineWidth = r * .32;
    for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3, cx = Math.cos(a), cy = Math.sin(a); g.beginPath(); g.moveTo(0, 0); g.lineTo(cx * r * 1.2, cy * r * 1.2);
      for (const s of [-1, 1]) { const b = a + s * .7; g.moveTo(cx * r * .7, cy * r * .7); g.lineTo(cx * r * .7 + Math.cos(b) * r * .42, cy * r * .7 + Math.sin(b) * r * .42); } g.stroke(); }
    g.restore(); return;
  }
  pipPath(g, sk.pip, r, R); g.lineJoin = 'round';
  if (halo) { g.strokeStyle = halo; g.lineWidth = r * .5; g.stroke(); } // drawn first, so the pip covers its inner half
  g.fillStyle = col; g.fill();
  if (sk.outline) { g.strokeStyle = sk.outline; g.lineWidth = r * .3; g.stroke(); }
  if (sk.pip === 'inlay') { g.fillStyle = sk.inkHi; g.beginPath(); g.arc(-r * .25, -r * .28, r * .38, 0, 7); g.fill(); }
  else if (sk.pip === 'diamond') { g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(0, -r * 1.05); g.lineTo(r * .45, -r * .1); g.lineTo(0, -r * .2); g.closePath(); g.fill(); }
  else if (sk.pip === 'flower') { g.fillStyle = sk.inkHi; g.beginPath(); g.arc(0, 0, r * .42, 0, 7); g.fill(); }
  else if (sk.pip === 'chip') { g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(-r * .3, -r * .3, r * .3, 0, 7); g.fill(); }
  else if (sk.pip === 'heart' || sk.pip === 'star' || sk.pip === 'round' && !sk.carve) { g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-r * .3, -r * .35, r * .28, r * .18, -.6, 0, 7); g.fill(); }
  g.restore();
}

// The art behind the pips on one face: x0 is the face's left edge, m the bevel band (as a share of the face).
function drawArt(g, sk, x0, m, v, R, glow) {
  const S = SZ, E = m * S, lo = x0 + E, w = S - 2 * E;
  const rect = (c, x, y, ww, hh) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
  if (glow) { // only the parts that light up by themselves
    if (sk.pat === 'lava') { g.strokeStyle = '#a8300c'; g.lineWidth = 2.2; g.shadowColor = '#ff5a1a'; g.shadowBlur = 4; lavaCracks(g, x0, S, R); g.shadowBlur = 0; }
    if (sk.pat === 'galaxy') for (let i = 0; i < 26; i++) { g.fillStyle = i % 5 ? '#ffffff' : '#ffe27a'; g.beginPath(); g.arc(x0 + R() * S, R() * S, .6 + R() * 1.6, 0, 7); g.fill(); }
    if (sk.pat === 'ice') { g.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) sparkle(g, lo + R() * w, E + R() * w, 3 + R() * 4); }
    return;
  }
  rect(sk.edge, x0, 0, S, S);
  if (sk.pat === 'frame') { g.fillStyle = sk.base; g.beginPath(); g.roundRect(x0 + 6, 6, S - 12, S - 12, 24); g.fill(); return; }
  rect(sk.base, lo, E, w, w);
  if (sk.pat === 'facets') { // a cut gem: light and dark triangles fanning out from the middle, a bright table and a glint
    const c = [lo + w / 2, E + w / 2], pts = [[x0, 0], [x0 + S / 2, 0], [x0 + S, 0], [x0 + S, S / 2], [x0 + S, S], [x0 + S / 2, S], [x0, S], [x0, S / 2]];
    pts.forEach((pt, i) => { const nx = pts[(i + 1) % 8]; g.fillStyle = i % 2 ? shade(sk.base, .88) : mixC(sk.base, '#ffffff', .1); g.beginPath(); g.moveTo(...c); g.lineTo(...pt); g.lineTo(...nx); g.fill(); });
    g.fillStyle = sk.base; g.fillRect(lo + w * .12, E + w * .12, w * .76, w * .76);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(lo, E + w * .3); g.lineTo(lo + w * .3, E); g.lineTo(lo + w * .45, E); g.lineTo(lo, E + w * .45); g.fill();
    g.fillStyle = sk.edge; g.fillRect(x0, 0, S, E * .55); g.fillRect(x0, 0, E * .55, S);
  } else if (sk.pat === 'ice') {
    const gr = g.createLinearGradient(lo, E, lo + w, E + w); gr.addColorStop(0, '#e9fbff'); gr.addColorStop(.5, sk.base); gr.addColorStop(1, '#6cc6f0'); g.fillStyle = gr; g.fillRect(lo, E, w, w);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); const a = lo + R() * w, b = E + R() * w; g.moveTo(a, b); g.lineTo(a + (R() - .5) * w * .8, b + (R() - .5) * w * .8); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(lo, E + w * .25); g.lineTo(lo + w * .25, E); g.lineTo(lo + w * .38, E); g.lineTo(lo, E + w * .38); g.fill();
  } else if (sk.pat === 'veins') {
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { g.strokeStyle = sk.vein[i % 2]; g.globalAlpha = .35 + R() * .3; g.lineWidth = 1.5 + R() * 3; g.beginPath(); let x = lo + R() * w, y = E; g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (R() - .5) * w * .45; y += w / 5; g.quadraticCurveTo(x + (R() - .5) * 20, y - w / 10, x, y); } g.stroke(); }
    g.globalAlpha = 1;
  } else if (sk.pat === 'swirl') {
    g.save(); g.beginPath(); g.rect(lo, E, w, w); g.clip(); g.strokeStyle = sk.swirl; g.lineWidth = w * .09;
    for (let i = -3; i < 6; i++) { g.beginPath(); g.moveTo(lo + i * w * .28, E); g.bezierCurveTo(lo + i * w * .28 + w * .3, E + w * .3, lo + i * w * .28 - w * .1, E + w * .7, lo + i * w * .28 + w * .25, E + w); g.stroke(); }
    g.restore(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(lo + w * .28, E + w * .2, w * .2, w * .07, -.5, 0, 7); g.fill();
  } else if (sk.pat === 'galaxy') {
    const gr = g.createRadialGradient(lo + w * (.3 + R() * .4), E + w * (.3 + R() * .4), 4, lo + w / 2, E + w / 2, w * .8);
    gr.addColorStop(0, '#6a3fb8'); gr.addColorStop(.45, '#2b2d7e'); gr.addColorStop(1, sk.base); g.fillStyle = gr; g.fillRect(lo, E, w, w);
    for (let i = 0; i < 3; i++) { g.fillStyle = ['rgba(255,120,200,.16)', 'rgba(120,200,255,.14)', 'rgba(180,140,255,.16)'][i]; g.beginPath(); g.ellipse(lo + R() * w, E + R() * w, w * (.2 + R() * .2), w * .1, R() * 3, 0, 7); g.fill(); }
  } else if (sk.pat === 'brushed') {
    for (let y = E; y < E + w; y += 3) { g.fillStyle = `rgba(${R() > .5 ? '255,250,210' : '160,100,10'},${.08 + R() * .1})`; g.fillRect(lo, y, w, 2); }
    const gr = g.createLinearGradient(lo, E, lo + w, E + w); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, 'rgba(255,255,255,.4)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(lo, E, w, w);
    g.strokeStyle = shade(sk.base, .72); g.lineWidth = 3; g.strokeRect(lo + 1.5, E + 1.5, w - 3, w - 3);
  } else if (sk.pat === 'wood') {
    g.save(); g.beginPath(); g.rect(x0, 0, S, S); g.clip();
    const ox = x0 + R() * S, oy = -S * (.4 + R() * .6); // the tree's middle sits off the face, so the rings curve across it
    for (let k = 0; k < 18; k++) { g.strokeStyle = k % 3 ? 'rgba(110,60,25,.28)' : 'rgba(110,60,25,.5)'; g.lineWidth = 1.5 + R() * 2.5; g.beginPath(); g.ellipse(ox, oy, 30 + k * 13 + R() * 6, 20 + k * 10, R() * .2, 0, 7); g.stroke(); }
    if (R() > .45) { const kx = lo + R() * w, ky = E + R() * w; g.fillStyle = 'rgba(90,45,20,.55)'; g.beginPath(); g.ellipse(kx, ky, 7, 4.5, .3, 0, 7); g.fill(); g.strokeStyle = 'rgba(90,45,20,.35)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, 12, 8, .3, 0, 7); g.stroke(); }
    g.restore(); g.strokeStyle = shade(sk.base, .7); g.lineWidth = 2; g.strokeRect(lo + 1, E + 1, w - 2, w - 2);
  } else if (sk.pat === 'calico') {
    for (const c of ['#f8dcb8', '#f0caa0']) for (let i = 0; i < 2; i++) { const cx = R() < .5 ? lo + w * .08 : lo + w * .92, cy = E + R() * w; g.fillStyle = c; g.globalAlpha = .7; g.beginPath();
      for (let j = 0; j < 9; j++) { const a = j / 9 * 6.283, rr = w * (.16 + R() * .08); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill(); }
    g.globalAlpha = 1;
  } else if (sk.pat === 'lava') {
    g.fillStyle = shade(sk.base, .75); for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(x0 + R() * S, R() * S, 3 + R() * 7, 0, 7); g.fill(); }
    g.strokeStyle = '#d2401a'; g.lineWidth = 2.2; lavaCracks(g, x0, S, R);
  } else if (sk.pat === 'frost') {
    const gr = g.createLinearGradient(lo, E, lo, E + w); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e0f0fd'); g.fillStyle = gr; g.fillRect(lo, E, w, w);
    g.fillStyle = 'rgba(160,205,240,.55)'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(lo + R() * w, E + R() * w, 1 + R() * 2.2, 0, 7); g.fill(); }
  } else if (sk.pat === 'cookie') {
    const gr = g.createRadialGradient(lo + w / 2, E + w / 2, w * .1, lo + w / 2, E + w / 2, w * .75); gr.addColorStop(0, '#e9b071'); gr.addColorStop(1, sk.base); g.fillStyle = gr; g.fillRect(lo, E, w, w);
    for (let i = 0; i < 26; i++) { g.fillStyle = R() > .5 ? 'rgba(150,85,35,.45)' : 'rgba(255,225,170,.5)'; g.beginPath(); g.arc(x0 + R() * S, R() * S, 1 + R() * 2.4, 0, 7); g.fill(); }
  } else if (sk.pat === 'moss') {
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${R() > .5 ? '255,255,255' : '40,45,55'},${.08 + R() * .1})`; g.beginPath(); g.arc(x0 + R() * S, R() * S, 3 + R() * 9, 0, 7); g.fill(); }
    for (let i = 0; i < 2; i++) { const top = R() < .5, cx = lo + R() * w, cy = top ? 0 : S; g.fillStyle = i ? '#7cc45a' : '#5ea644'; g.beginPath();
      for (let j = 0; j <= 12; j++) { const a = Math.PI * j / 12 + (top ? 0 : Math.PI), rr = S * (.22 + R() * .1); g.lineTo(cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr * .8); } g.fill(); }
  } else if (sk.pat === 'pixel') {
    const n = 8, c = S / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = R(); g.fillStyle = k > .8 ? shade(sk.base, 1.15) : k < .2 ? shade(sk.base, .88) : sk.base; g.fillRect(x0 + x * c, y * c, c, c); }
    g.fillStyle = sk.edge; g.fillRect(x0, 0, S, c * .5); g.fillRect(x0, S - c * .5, S, c * .5); g.fillRect(x0, 0, c * .5, S); g.fillRect(x0 + S - c * .5, 0, c * .5, S);
  }
}
function lavaCracks(g, x0, S, R) {
  g.lineCap = g.lineJoin = 'round';
  for (let i = 0; i < 2; i++) { const sideL = i % 2; let x = x0 + (sideL ? R() * S : 0), y = sideL ? 0 : R() * S; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (sideL ? (R() - .5) * 34 : 14 + R() * 18); y += (sideL ? 14 + R() * 18 : (R() - .5) * 34); g.lineTo(x, y); } g.stroke(); }
}
function sparkle(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * .4, y - r * .4); g.lineTo(x + r * 2, y); g.lineTo(x + r * .4, y + r * .4); g.lineTo(x, y + r * 2); g.lineTo(x - r * .4, y + r * .4); g.lineTo(x - r * 2, y); g.lineTo(x - r * .4, y - r * .4); g.fill(); }

function atlas(sk, k, glow) {
  const cv = document.createElement('canvas'); cv.width = SZ * 6; cv.height = SZ;
  const g = cv.getContext('2d'), m = (SHAPES[sk.shape]?.r || 0) / 2;
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); }
  for (let v = 1; v <= 6; v++) {
    const x0 = (v - 1) * SZ, R = rng(k * 977 + v * 131 + 7);
    if (!glow || sk.glow?.pat) drawArt(g, sk, x0, m, v, R, glow);
    if (glow && !sk.glow?.pips) continue;
    const pad = sk.pat === 'frame' ? .03 : m * .9 + .025, span = 1 - 2 * pad, rPip = SZ * span * .108 * (sk.pipK || 1);
    const PR = rng(k * 31 + v);
    for (const n of PIPS[v]) drawPip(g, sk, x0 + (pad + AT[n][0] * span) * SZ, (pad + AT[n][1] * span) * SZ, v === 1 ? rPip * sk.big1 : rPip, v === 1, PR, glow);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- the kit ----------
export function diceKit({ side = SIDE, classic = null } = {}) {
  const looks = new Map(), geos = new Map();
  const skin = k => k ? SKINS[k] : classic ? { ...SKINS[0], ...classic } : SKINS[0];
  function look(k) {
    k = skinOf(k); let L = looks.get(k); if (L) return L;
    const sk = skin(k), map = atlas(sk, k, false);
    const mat = toonMat(new THREE.MeshStandardMaterial({ map, roughness: .6 }));
    let glowMap = null;
    if (sk.glow) { glowMap = atlas(sk, k, true); mat.emissive.set('#ffffff'); mat.emissiveMap = glowMap; mat.emissiveIntensity = Math.max(sk.glow.pips || 0, sk.glow.pat || 0); mat.needsUpdate = true; }
    const dim = mat.clone(); dim.color.set('#9a9a9a'); dim.emissiveIntensity = mat.emissiveIntensity * .3;
    looks.set(k, L = { mat, dim, map, glowMap }); return L;
  }
  function geo(k, size) {
    const sh = skin(skinOf(k)).shape, key = sh + '|' + size; let g = geos.get(key);
    if (!g) geos.set(key, g = shapeGeo(sh, size, side)); return g;
  }
  return {
    mat: k => look(k).mat, dim: k => look(k).dim, geo,
    sparks: k => skin(skinOf(k)).sparks,
    dress(mesh, k, size) {
      const g = geo(k, size); mesh.geometry = g; mesh.material = look(k).mat;
      for (const c of mesh.children) if (c.isMesh && c.material?.side === THREE.BackSide) c.geometry = g;
    },
    dispose() { for (const L of looks.values()) { L.mat.dispose(); L.dim.dispose(); L.map.dispose(); L.glowMap?.dispose(); } for (const g of geos.values()) g.dispose(); looks.clear(); geos.clear(); },
  };
}

// Hot Pot 3D table (three.js). Purely visual: the HUD owns the rules.
import * as THREE from 'three';
import { cardGeometry, cardBlock } from '../../cardgeo.js';
import { paintBack } from '../../skins.js';
import { CATS, kindOf, catOf } from './rules.js';
import { iconSvg, backSvg } from './icons.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { frameLoop, autoResolution, AA, FPS } from '../../frames.js';
import { toonify, toonMat, shell, skyDome, clouds, island, birds, petals, createFx, rim as rimGlow, STAR, DOT, HEART, CONF, nightScene } from '../../scenery3d.js';

const INK = '#3b2219';
const TABLE_R = 4.4, TILE_Y = .05, POT_Y = .53, BROTH_Y = POT_Y + .76, BROTH_R = 1.47;
const SEAT = [[0, 5.7], [-5.7, 0], [0, -5.7], [5.7, 0]];
const rot = ([x, z], r) => { for (let i = 0; i < r; i++) [x, z] = [-z, x]; return [x, z]; };
// Discards sit on the four diagonals (each to its owner's right), so the layout is symmetric and the pot hides none.
const TILE = [0, 1, 2, 3].map(r => rot([2.3, 2.3], r));
const BOWL = [0, 1, 2, 3].map(r => rot([-.1, 3.75], r));
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const back = t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// ---------- textures ----------
const svgImg = svg => new Promise(res => {
  const im = new Image();
  im.onload = () => res(im); im.onerror = () => res(null);
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
const texCache = new Map();
const CARD_GEO = cardGeometry(.8, 1.1, .8 * 34 / 256); // one shared rounded card shape (the picture's outer radius is 34 of 256 px)
// The card back this player picked in the shop (skins.js). Hot Pot shows every face-down card with the viewer's own back.
let backK = 0;
export const setCardBack = k => { backK = k | 0; };
function cardTexture(kind, b) { // kind -1 = back: b's card back (a player's fl.cb), or your own when b is not given
  if (kind < 0) kind = -1 - (b === undefined ? backK : b | 0);
  if (texCache.has(kind)) return texCache.get(kind);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 352;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  texCache.set(kind, tex);
  const g = cv.getContext('2d');
  const paint = async () => {
    await document.fonts?.ready;
    g.clearRect(0, 0, 256, 352);
    if (kind < 0) {
      g.fillStyle = INK; rr(g, 0, 0, 256, 352, 34); g.fill();
      g.save(); rr(g, 9, 9, 238, 334, 27); g.clip(); paintBack(g, 256, 352, -1 - kind); g.restore();
      g.fillStyle = '#fff4e233'; g.beginPath(); g.arc(128, 176, 104, 0, 7); g.fill();
      const im = await svgImg(backSvg('width="200" height="200"'));
      if (im) g.drawImage(im, 28, 76, 200, 200);
    } else {
      const cat = CATS[Math.floor(kind / 3)];
      g.fillStyle = INK; rr(g, 0, 0, 256, 352, 34); g.fill();
      g.fillStyle = '#fff4e2'; rr(g, 9, 9, 238, 334, 27); g.fill();
      g.save(); rr(g, 9, 9, 238, 334, 27); g.clip();
      g.fillStyle = cat.col; g.fillRect(0, 0, 256, 62); g.fillStyle = INK; g.fillRect(0, 62, 256, 8);
      g.restore();
      g.fillStyle = '#fff'; g.font = '600 32px Rubik, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(cat.name, 128, 38);
      g.globalAlpha = .17; g.fillStyle = cat.col; g.beginPath(); g.arc(128, 178, 104, 0, 7); g.fill(); g.globalAlpha = 1;
      const im = await svgImg(iconSvg(kind, 'width="200" height="200"'));
      if (im) g.drawImage(im, 28, 76, 200, 200);
      g.fillStyle = INK; g.font = '600 31px Rubik, Nunito, sans-serif';
      const name = cat.items[kind % 3];
      g.fillText(name, 128, 306, 228);
    }
    tex.needsUpdate = true;
  };
  paint();
  return tex;
}
function woodTexture(base = '#a8693f', ring = '#8a5230') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = ring; g.globalAlpha = .12 + Math.random() * .18; g.lineWidth = 1 + Math.random() * 4;
    g.beginPath(); g.ellipse(256 + Math.random() * 10, 256 + Math.random() * 10, i * 6 + Math.random() * 4, i * 6 + Math.random() * 6, 0, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function brothTexture() {
  const S = 512, R = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#c9351b'; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
  const grad = g.createRadialGradient(R * 1.4, R * .9, 10, R * 1.4, R * .9, R);
  grad.addColorStop(0, '#ff7a3d'); grad.addColorStop(1, '#c9351b00'); g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.fillStyle = '#f6e6c4';
  g.beginPath(); g.arc(R, R, R, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.beginPath(); g.arc(R, R / 2, R / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9351b'; g.beginPath(); g.arc(R, R * 1.5, R / 2, 0, Math.PI * 2); g.fill();
  const dots = (n, col, rx, test) => { for (let i = 0; i < n; i++) { const x = Math.random() * S, y = Math.random() * S; if (!test(x - R, y - R)) continue; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, rx * .6, Math.random() * 3, 0, 7); g.fill(); } };
  const red = (x, z) => isRed(x / R, z / R) && x * x + z * z < R * R * .9;
  const cream = (x, z) => !isRed(x / R, z / R) && x * x + z * z < R * R * .9;
  dots(70, '#8e1d10', 5, red); dots(40, '#ffb547', 3, red); dots(25, '#ff9a6a', 9, red);
  dots(30, '#6fbf5a', 5, cream); dots(22, '#d9402a', 4, cream); dots(40, '#fffaf0', 2.5, cream);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// unit coordinates (x, z in -1..1): is this point in the spicy half?
// how far a point in the broth is from the S-shaped divider wall (two half circles of radius BROTH_R / 2)
function wallDist(x, z) {
  const h = BROTH_R / 2, half = (cz, right) => (right ? x >= 0 : x <= 0) ? Math.abs(Math.hypot(x, z - cz) - h) : Math.min(Math.hypot(x, z - cz - h), Math.hypot(x, z - cz + h));
  return Math.min(half(-h, true), half(h, false));
}
// a spot in the broth on one side of the wall, clear of it and of the pot's edge
function brothSpot(rMin = .35, rMax = 1.15, gap = .24) {
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = rMin + Math.random() * (rMax - rMin); if (wallDist(Math.cos(a) * r, Math.sin(a) * r) > gap) return [a, r]; }
  return [0, .9];
}
function isRed(x, z) {
  if (x * x + (z + .5) ** 2 < .25) return false;
  if (x * x + (z - .5) ** 2 < .25) return true;
  return x > 0;
}
function rugTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  [['#9a4f76', 256], ['#ff8fab', 244], ['#fff4e2', 226], ['#7ed3b2', 214], ['#7a4470', 200]].forEach(([c, r]) => { g.fillStyle = c; g.beginPath(); g.arc(256, 256, r, 0, 7); g.fill(); });
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; g.fillStyle = i % 2 ? '#ffb547' : '#ff8fab'; g.beginPath(); g.arc(256 + Math.cos(a) * 178, 256 + Math.sin(a) * 178, 9, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function floorTexture() { // warm deck boards
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  for (let row = 0; row < 4; row++) {
    let x = -Math.random() * 120;
    while (x < 256) {
      const w = 90 + Math.random() * 110, l = 8 + Math.random() * 4;
      g.fillStyle = `hsl(27 46% ${l * 1.4 + 42}%)`; g.fillRect(x, row * 64, w, 64);
      g.fillStyle = '#5b3a2277'; g.fillRect(x, row * 64, 2, 64);
      x += w;
    }
    g.fillStyle = '#5b3a2288'; g.fillRect(0, row * 64, 256, 2);
    for (let i = 0; i < 9; i++) { g.fillStyle = '#ffffff22'; g.fillRect(Math.random() * 256, row * 64 + 6 + Math.random() * 52, 30 + Math.random() * 80, 1); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function matTexture() { // woven placemat
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#e6d2a8'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) {
    g.fillStyle = (x + y) / 8 % 2 ? '#d9c18f' : '#f1e1bd'; g.fillRect(x + 1, y + 1, 6, 6);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(22, 22);
  return t;
}
function shimmerTexture() { // soft blotches of light
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 112, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, r = 8 + Math.random() * 22;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#ffffff00');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return new THREE.CanvasTexture(cv);
}
// A tiny painted room, blurred into an environment map, so metal, broth and ceramic have something to reflect.
function envTexture(renderer) {
  const s = new THREE.Scene(), box = new THREE.BoxGeometry(1, 1, 1), mats = [];
  const add = (col, k, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.BackSide }));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); s.add(m); mats.push(m.material);
  };
  add('#6a4a58', 1, 0, 0, 0, 30, 30, 30); add('#c98a5c', 1.6, 0, -8, 0, 20, .5, 20);
  add('#ffe2c4', 7, 0, 12, 2, 12, .5, 12); add('#ff8fab', 3, -13, 3, 0, .5, 8, 14); add('#7ed3b2', 2.5, 13, 3, 0, .5, 8, 14);
  add('#ffb070', 4, 0, 4, 13, 14, 6, .5); add('#9db4ff', 3, 0, 5, -13, 14, 6, .5);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, .04).texture;
  pm.dispose(); box.dispose(); mats.forEach(m => m.dispose());
  return tex;
}
function softDot() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// ---------- ingredient models ----------
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, ...o });
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
// Ingredients come and go all game, so their geometries and materials are shared and never disposed.
const igeo = new Map(), imat = new Map();
const IG = (type, ...a) => { const k = type + a.join(); if (!igeo.has(k)) igeo.set(k, new THREE[type + 'Geometry'](...a)); return igeo.get(k); };
const IM = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); if (!imat.has(k)) imat.set(k, M(c, o)); return imat.get(k); };
const ibaked = new Map();
function ingredient(kind) { // each kind is modelled once, merged, and then stamped out cheaply
  let parts = ibaked.get(kind);
  if (!parts) ibaked.set(kind, parts = toonify(bake(modelIngredient(kind)), .014).children.map(m => [m.geometry, m.material]));
  const g = new THREE.Group(); g.userData.dyn = true;
  for (const [gm, mt] of parts) g.add(new THREE.Mesh(gm, mt));
  return g;
}
function modelIngredient(kind) {
  const g = new THREE.Group(), PI = Math.PI;
  const P = (gm, col, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(gm, IM(col, o)); m.position.set(x, y, z); g.add(m); return m; };
  const flat = m => { m.rotation.x = PI / 2; return m; };
  const S = r => IG('Sphere', r, 10, 8);
  switch (kind) {
    case 0: { // beef slice: thin, marbled, with a rim of fat
      P(IG('Cylinder', .21, .21, .035, 20), '#d9584a').scale.set(1.25, 1, .8);
      flat(P(IG('Torus', .2, .02, 6, 22), '#f7cdc2', 0, .004, 0)).scale.set(1.25, .8, 1);
      flat(P(IG('Torus', .09, .012, 5, 10, 2.2), '#ffd9cf', -.05, .02, .02));
      flat(P(IG('Torus', .09, .012, 5, 10, 2.2), '#ffd9cf', .08, .02, -.03)).rotation.z = 2.5;
      break;
    }
    case 1: // pork belly: striped block of meat and fat with a browned skin
      [[-.085, '#c8794e', .03], [-.045, '#f2a08e', .05], [0, '#fff0e6', .04], [.045, '#f08a7a', .05], [.085, '#fff0e6', .03]]
        .forEach(([z, col, w]) => P(IG('Box', .4, .07, w), col, 0, 0, z));
      break;
    case 2: // lamb roll: a rolled slice with a spiral on top
      P(IG('Cylinder', .15, .15, .1, 20), '#c95a4c');
      flat(P(IG('Torus', .1, .014, 5, 18), '#ffe9df', 0, .051, 0)); flat(P(IG('Torus', .05, .014, 5, 12), '#ffe9df', 0, .051, 0));
      break;
    case 3: { // shrimp: curled, striped, with a tail fan
      flat(P(IG('Torus', .13, .06, 10, 18, PI * 1.4), '#ff9a62'));
      for (const a of [.7, 1.6, 2.5, 3.4]) P(IG('Torus', .062, .012, 5, 12), '#ffd0ad', Math.cos(a) * .13, 0, Math.sin(a) * .13).rotation.y = -a;
      P(S(.07), '#ff8a52', .13, 0, 0);
      P(S(.09), '#ff7b45', Math.cos(PI * 1.4) * .13 + .05, 0, Math.sin(PI * 1.4) * .13).scale.set(1, .3, 1.3);
      break;
    }
    case 4: // fish balls on a skewer
      P(IG('Cylinder', .012, .012, .56, 6), '#c99a62').rotation.z = PI / 2;
      P(S(.11), '#fffaf0', -.12); P(S(.11), '#fffaf0', .12);
      break;
    case 5: { // squid: mantle, fins and a fan of tentacles
      P(IG('Cylinder', .05, .11, .3, 14), '#ffe1e6').rotation.z = PI / 2;
      P(S(.05), '#ffe1e6', -.15);
      for (const s of [-1, 1]) {
        P(S(.06), '#ffd3da', -.12, 0, s * .07).scale.set(1.2, .3, 1);
        P(S(.016), '#3b2219', .06, .085, s * .04);
        for (const t of [.03, .08]) { const c = P(IG('Cone', .022, .18, 6), '#ffc9d2', .23, 0, s * t); c.rotation.set(0, -s * t * 4, -PI / 2); }
      }
      break;
    }
    case 6: // bok choy: pale stem, three leaves
      P(S(.09), '#f1f6df', -.08).scale.set(1.5, .7, 1);
      for (const s of [-1, 0, 1]) { const l = P(S(.13), s ? '#62bf55' : '#4fae48', .1, s ? 0 : .02, s * .09); l.scale.set(1.3, .25, .8); l.rotation.y = -s * .45; }
      break;
    case 7: // spinach: one dark leaf with a midrib
      P(S(.2), '#2f9e4b').scale.set(1.1, .12, .7);
      P(IG('Cylinder', .01, .014, .4, 5), '#7fd08a', 0, .022, 0).rotation.z = PI / 2;
      P(IG('Cylinder', .016, .016, .12, 5), '#5bb86a', -.26, 0, 0).rotation.z = PI / 2;
      break;
    case 8: // napa cabbage: frilly pale leaf with a white rib
      P(S(.2), '#d9eb9a').scale.set(1.15, .16, .75);
      flat(P(IG('Torus', .18, .03, 6, 20), '#bfe07a')).scale.set(1.15, .75, .6);
      P(S(.2), '#fbfff0', -.03, .015, 0).scale.set(.9, .18, .25);
      break;
    case 9: // enoki: a fanned bundle of thin stems with tiny caps
      for (let i = -2; i <= 2; i++) {
        const f = i * .13;
        P(IG('Cylinder', .014, .018, .34, 6), '#fff8ec', 0, 0, i * .03).rotation.set(0, f, PI / 2);
        P(S(.035), '#fffdf5', -.17 * Math.cos(f), 0, .17 * Math.sin(f) + i * .03);
      }
      P(S(.05), '#f3e6c8', .17).scale.set(1, .8, 1.4);
      break;
    case 10: { // shiitake: scored cap on a short stem
      P(IG('Sphere', .17, 16, 8, 0, PI * 2, 0, PI / 2), '#8f5a37').scale.y = .75;
      P(IG('Cylinder', .165, .165, .02, 16), '#f1dcc0', 0, -.008, 0); P(IG('Cylinder', .05, .06, .1, 10), '#fff4e2', 0, -.06, 0);
      for (const r of [0, PI / 2]) { const a = P(IG('Torus', .118, .012, 5, 12, PI * .6), '#f4dcc0'); a.rotation.set(0, r, PI * .2); a.scale.y = 1.08; }
      break;
    }
    case 11: // wood ear: dark glossy ruffles
      [[0, 0, 0, .1], [.1, .02, .06, -.25], [-.08, .03, -.06, .3]].forEach(([x, y, z, t]) => { const m = P(S(.16), '#4e3329', x, y, z, { roughness: .25 }); m.scale.set(1, .18, 1); m.rotation.set(t, 0, -t); });
      flat(P(IG('Torus', .15, .03, 6, 16), '#5d3f33', 0, .01, 0, { roughness: .25 })).scale.z = .6;
      break;
    case 12: // udon: a nest of thick noodles
      [[.13, .03, 0, 0, .1], [.11, -.03, .04, .02, -.2], [.09, 0, .08, -.01, .15]].forEach(([r, x, y, z, t]) => { P(IG('Torus', r, .04, 8, 20), '#fff1c7', x, y, z).rotation.set(PI / 2 + t, t, 0); });
      break;
    case 13: // rice cakes: two soft ovals
      P(IG('Cylinder', .11, .11, .06, 18), '#fffdf7', -.06).scale.set(1.35, 1, .8);
      { const m = P(IG('Cylinder', .11, .11, .06, 18), '#fff8ea', .07, .04, .03); m.scale.set(1.35, 1, .8); m.rotation.set(.15, .6, 0); }
      break;
    case 14: // glass noodles: translucent loops
      [[.14, 0, 0, 0, 0], [.11, .04, .025, .03, .25], [.12, -.04, .04, -.03, -.2]].forEach(([r, x, y, z, t]) => { P(IG('Torus', r, .02, 6, 20), '#dff6fb', x, y, z, { transparent: true, opacity: .75, roughness: .1 }).rotation.set(PI / 2 + t, t, 0); });
      break;
    case 15: // tofu: a soft cube with a golden top
      P(IG('Box', .22, .2, .22), '#fff6dc'); P(IG('Box', .2, .012, .2), '#f3e2b0', 0, .1, 0);
      break;
    case 16: // dumpling: crescent with a pleated ridge
      P(S(.15), '#fff8ea').scale.set(1.3, .62, .8);
      for (let i = -2; i <= 2; i++) P(S(.036), '#fbeed8', i * .065, .088 - i * i * .009, 0).scale.set(1, 1, 1.4);
      break;
    default: // quail eggs: two speckled eggs
      [[-.09, 0, 0], [.1, 0, .05, .7]].forEach(([x, , z, ry = 0]) => {
        const e = P(S(.1), '#f6eadb', x, 0, z); e.scale.set(1.2, .85, .85); e.rotation.y = ry;
        for (const [dx, dz] of [[0, 0], [.05, .03], [-.04, -.03]]) P(S(.013), '#8a6a4e', x + dx, .083 - Math.abs(dx) * .15, z + dz);
      });
  }
  const F = IFACE[kind];
  if (F) { // a tiny face on top, looking up at the players
    const [x, y, z, k] = F, col = kind === 10 || kind === 11 ? '#fff4e2' : '#2a1712';
    for (const s of [-1, 1]) P(S(.02), col, x + s * .045 * k, y, z - .012 * k, { roughness: .2 }).scale.set(k, .5 * k, 1.2 * k);
    flat(P(IG('Torus', .022, .007, 4, 8, PI), col, x, y, z + .022 * k, { roughness: .2 })).scale.setScalar(k);
  }
  return g;
}
// where each ingredient's face sits: [x, y, z, size]
const IFACE = [[0, .022, .02, 1], [0, .04, 0, 1], [0, .056, 0, .9], [.13, .066, 0, .7], [.12, .1, .04, .8], [-.02, .09, 0, .8], [-.08, .066, 0, .7], [.02, .028, 0, 1], [.05, .036, 0, 1],
  [.17, .046, 0, .6], [0, .1, .1, .8], [0, .036, 0, 1], [0, .1, .1, .7], [-.06, .034, 0, .9], null, [0, .108, 0, 1], [0, .074, .08, .8], [-.09, .088, 0, .7]];
// little floating symbols for the pot's feelings
function glyphTextures() {
  const mk = draw => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'); g.lineJoin = g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 5; draw(g);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const text = (ch, col) => g => { g.font = '700 46px Rubik, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(ch, 32, 34); g.fillStyle = col; g.fillText(ch, 32, 34); };
  return {
    heart: mk(g => { g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(4, 36, 8, 10, 32, 22); g.bezierCurveTo(56, 10, 60, 36, 32, 54); g.closePath(); g.stroke(); g.fillStyle = '#ff6f8f'; g.fill(); }),
    spark: mk(g => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 9 : 26; g.lineTo(32 + Math.sin(a) * r, 32 - Math.cos(a) * r); } g.closePath(); g.stroke(); g.fillStyle = '#ffd36b'; g.fill(); }),
    drop: mk(g => { g.beginPath(); g.moveTo(32, 8); g.bezierCurveTo(52, 34, 50, 56, 32, 56); g.bezierCurveTo(14, 56, 12, 34, 32, 8); g.closePath(); g.stroke(); g.fillStyle = '#8fd0ff'; g.fill(); }),
    zzz: mk(text('z', '#fff4e2')), bang: mk(text('!', '#ffd36b')), note: mk(text('♪', '#7ed3b2')),
  };
}

// Always 60 fps (see frames.js). quality: 'auto' (default), 'low' (no shadows, 1x resolution, 30 fps battery saver) or 'high' (full resolution)
export function createScene(canvas, { onTile, onDeck, onLayout, quality = 'auto' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; // shadows are refreshed a few times a second, not every frame
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const SKY_TOP = '#5a4fa8', SKY_LOW = '#ffc2a6'; // dinner at sunset
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 30, 120);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);

  let T = 0; // seconds since the scene started
  // lights: warm key, cool rim from behind, and soft reflections from a tiny painted room
  scene.add(new THREE.HemisphereLight('#fff0e4', '#ffc9ae', 1.55));
  const small = matchMedia('(max-width: 760px)').matches;
  const key = new THREE.DirectionalLight('#fff1dd', 1.5); key.position.set(5, 12, 7); key.castShadow = true;
  key.shadow.mapSize.setScalar(small ? 1024 : 1536); Object.assign(key.shadow.camera, { left: -7.6, right: 7.6, top: 7.6, bottom: -7.6, near: 1, far: 30 });
  key.shadow.bias = -.0006; key.shadow.normalBias = .02; scene.add(key);
  const rimL = new THREE.DirectionalLight('#c7b4ff', .35); rimL.position.set(-6, 7, -9); scene.add(rimL);
  const glow = new THREE.PointLight('#ff8a45', 1.6, 6, 1.5); glow.position.set(0, .7, 0); scene.add(glow);
  const dot = softDot();
  const halo = (col, size, op) => new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // floor, rug, string lights, paper lanterns
  const floorMap = floorTexture(); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(9, 9);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(10.6, 48), M('#ffffff', { map: floorMap, roughness: .85 })); floorMap.repeat.set(3.2, 3.2); // a round wooden deck on the grass
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.39; floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = -2.38; rug.receiveShadow = true; scene.add(rug);
  const bulbs = [], bulbGeo = new THREE.SphereGeometry(.13, 12, 10);
  const bulbCols = ['#ffb547', '#ff8fab', '#7ed3b2', '#ffd27a', '#ff7a59'];
  [[-9, -7, 9, -7, 6.2], [-10, -3, -6, -10, 5.4], [6, -10, 10, -3, 5.6]].forEach(([x1, z1, x2, z2, y], li) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * 1.1, z1 + (z2 - z1) * t)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#4a2c22' })));
    pts.forEach((p, i) => {
      if (i % 2) return;
      const col = bulbCols[(i / 2 + li) % 5], b = put(bulbGeo, new THREE.MeshBasicMaterial({ color: col }), p.x, p.y - .16, p.z);
      const h = halo(col, 1, .35); h.scale.setScalar(1.1); b.add(h); bulbs.push(b);
    });
    const l = new THREE.PointLight('#ffb070', 2.5, 14, 1.4); l.position.copy(pts[7]); scene.add(l);
  });
  const lanterns = [[-5.5, -6.3, 1], [5.5, -6.3, .85]].map(([x, z, k]) => {
    const g = new THREE.Group(); g.position.set(x, -2.4, z); g.scale.setScalar(k); g.userData.dyn = true; scene.add(g);
    const dk = M('#3b2219', { roughness: .6 });
    put(new THREE.SphereGeometry(.55, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffd9a0', fog: false, toneMapped: false }), 0, .78, 0, g).scale.y = 1.15;
    for (const y of [-.34, 0, .34]) put(new THREE.TorusGeometry(Math.sqrt(.3025 - (y / 1.15) ** 2) + .005, .014, 5, 24), dk, 0, .78 + y, 0, g).rotation.x = Math.PI / 2;
    put(new THREE.CylinderGeometry(.24, .28, .1, 14), dk, 0, .12, 0, g); put(new THREE.CylinderGeometry(.2, .24, .1, 14), dk, 0, 1.42, 0, g);
    const h = halo('#ffb060', 1, .3); h.position.y = .8; h.scale.setScalar(3.4); g.add(h);
    return h;
  });

  // table
  const wood = woodTexture();
  const table = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - .1, .36, 72), [M('#7a4628'), M('#ffffff', { map: wood, roughness: .48 }), M('#7a4628')]);
  table.position.y = -.18; table.receiveShadow = true; table.castShadow = true; scene.add(table);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, .1, 10, 80), M('#6e3c20', { roughness: .4 })); rim.rotation.x = Math.PI / 2; scene.add(rim);
  const susan = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, .08, 64), M('#c4885a', { map: woodTexture('#c4885a', '#9a6440'), roughness: .38 }));
  susan.position.y = .04; susan.receiveShadow = true; scene.add(susan);
  put(new THREE.TorusGeometry(2.25, .04, 8, 64), M('#a86f45', { roughness: .4 }), 0, .04, 0).rotation.x = Math.PI / 2;
  const leg = put(lathe([[0, -2.4], [1.5, -2.4], [1.56, -2.3], [1.1, -2.18], [.62, -1.95], [.42, -1.55], [.42, -.95], [.62, -.55], [1.05, -.36], [0, -.36]], 28), M('#5a3019', { roughness: .5 }));
  leg.castShadow = true;

  // burner: a little stove with a knob and a ring of flickering flames
  const stoveM = M('#4b4349', { metalness: .6, roughness: .4, envMapIntensity: 2 });
  put(lathe([[0, .08], [1.5, .08], [1.57, .13], [1.57, .3], [1.48, .4], [1.24, .43], [1.18, .38], [0, .38]], 48), stoveM).castShadow = true;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; put(new THREE.BoxGeometry(.3, .16, .08), stoveM, Math.cos(a) * 1.12, .455, Math.sin(a) * 1.12).rotation.y = -a; }
  { const k = put(new THREE.CylinderGeometry(.11, .13, .1, 16), M('#d8dce2', { metalness: .8, roughness: .3 }), Math.sin(.62) * 1.6, .21, Math.cos(.62) * 1.6); k.rotation.order = 'YXZ'; k.rotation.set(Math.PI / 2, .62, 0);
    put(new THREE.SphereGeometry(.03, 8, 8), new THREE.MeshBasicMaterial({ color: '#ff5a3c' }), Math.sin(.62) * 1.655, .27, Math.cos(.62) * 1.655); }
  const FL = 30, flameGeo = new THREE.ConeGeometry(.055, .32, 8); flameGeo.translate(0, .16, 0);
  const flames = [['#3f9dff', 1], ['#bfe6ff', .45]].map(([c, k]) => {
    const m = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }), FL);
    m.userData.k = k; m.frustumCulled = false; scene.add(m); return m;
  });
  const dummy = new THREE.Object3D(); dummy.rotation.order = 'YXZ';

  // pot: brushed steel with a rolled rim, riveted handles and a sleepy little face
  const potG = new THREE.Group(); potG.position.y = POT_Y; potG.userData.dyn = true; scene.add(potG);
  const steel = M('#eef0f3', { metalness: .3, roughness: .32, envMapIntensity: 1.8, side: THREE.DoubleSide });
  const pot = put(lathe([[0, 0], [1.2, 0], [1.38, .05], [1.5, .2], [1.555, .84], [1.6, .9], [1.66, .93], [1.69, .97], [1.66, 1.01], [1.58, 1.01], [1.5, .96], [1.47, .84], [1.44, .3]], 48), steel, 0, 0, 0, potG);
  pot.castShadow = true; pot.userData.dyn = true;
  for (const s of [-1, 1]) {
    const h = put(new THREE.TorusGeometry(.24, .06, 10, 24, Math.PI), steel, s * 1.52, .82, 0, potG); // the ends sink into the wall (radius ~1.55 here)
    h.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); h.castShadow = true;
    for (const z of [-.24, .24]) put(new THREE.SphereGeometry(.085, 12, 10), steel, s * 1.535, .82, z, potG).scale.x = .6;
  }
  // the pot's face: it looks around, changes expression and reacts to the game
  const face = { eyes: [], arcs: [], blush: [], look: new THREE.Vector2(), turn: -1, glance: -1, glanceEnd: 0 };
  {
    const inkM = M('#3b2219', { roughness: .15 }), wh = M('#ffffff'), bl = new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: .75 });
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * .4, .58, 1.5); potG.add(eg);
      put(new THREE.SphereGeometry(.12, 16, 12), inkM, 0, 0, 0, eg).scale.set(1, 1.25, .5);
      put(new THREE.SphereGeometry(.036, 8, 8), wh, .04, .06, .055, eg);
      put(new THREE.SphereGeometry(.019, 8, 8), wh, -.035, -.05, .055, eg);
      const arc = put(new THREE.TorusGeometry(.1, .03, 8, 14, Math.PI), inkM, s * .4, .55, 1.54, potG); arc.visible = false;
      const b = put(new THREE.CircleGeometry(.15, 20), bl, s * .74, .43, 1.385, potG); b.rotation.y = s * .5;
      face.eyes.push(eg); face.arcs.push(arc); face.blush.push(b);
    }
    face.smile = put(new THREE.TorusGeometry(.09, .026, 8, 14, Math.PI), inkM, 0, .45, 1.565, potG); face.smile.rotation.z = Math.PI;
    face.open = put(new THREE.SphereGeometry(.1, 14, 10), M('#8a2f2f', { roughness: .4 }), 0, .4, 1.53, potG); face.open.scale.set(1, 1, .35);
    face.tongue = put(new THREE.SphereGeometry(.06, 10, 8), M('#ff8fa0'), 0, .35, 1.555, potG); face.tongue.scale.set(1, .6, .3);
    face.oh = put(new THREE.TorusGeometry(.05, .022, 8, 14), inkM, 0, .41, 1.565, potG);
  }
  potG.traverse(o => { if (o !== potG && o !== pot && (o.isGroup || o.position.z > 1)) o.userData.dyn = true; }); // the face stays live
  bake(potG);
  // [eyes, mouth, blush]. eyes: open | wide | happy (closed, smiling) | sleep | wink. mouth: smile | open | oh
  const MOODS = {
    idle: ['open', 'smile', 1], peek: ['wide', 'smile', 1.1], happy: ['happy', 'open', 1.25], yum: ['happy', 'open', 1.3], wow: ['wide', 'oh', 1], love: ['happy', 'smile', 1.7],
    sleepy: ['sleep', 'oh', 1], cry: ['sleep', 'oh', 1.15], fire: ['wide', 'open', 1.5], dizzy: ['wide', 'oh', 1.2], wink: ['wink', 'smile', 1.2], bang: ['wide', 'oh', 1],
  };
  const LOOK = [[0, -1], [-1, 0], [0, 1], [1, 0]]; // where each seat is, as the pot sees it
  let mood = 'idle', moodEnd = 0, lastStir = 0, potSq = 0, potSqV = 0, potTilt = 0, potTiltV = 0, potYaw = 0, potSpin = 0, party = 0, laugh = 0, nextZ = 0, nextJump = 3;
  const broth = new THREE.Mesh(new THREE.CircleGeometry(BROTH_R, 64), new THREE.MeshStandardMaterial({ map: brothTexture(), roughness: .14, envMapIntensity: 1.3, emissive: '#3a0e04', emissiveIntensity: .7 }));
  broth.rotation.x = -Math.PI / 2; broth.position.y = BROTH_Y; scene.add(broth);
  // two slow layers of light drifting over the broth
  const shimmerMap = shimmerTexture();
  const shimmer = [.004, .007].map(y => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(BROTH_R - .03, 48), new THREE.MeshBasicMaterial({ map: shimmerMap, transparent: true, color: '#ffd9a8', opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = BROTH_Y + y; scene.add(m); return m;
  });
  { // S-shaped divider wall
    const R = BROTH_R, pts = [];
    for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + i / 20 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * R / 2, 0, -R / 2 + Math.sin(a) * R / 2)); }
    for (let i = 1; i <= 20; i++) { const a = -Math.PI / 2 - i / 20 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * R / 2, 0, R / 2 + Math.sin(a) * R / 2)); }
    const tube = put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .03, 8), steel, 0, BROTH_Y + .03, 0); tube.scale.y = 2.6;
  }

  // bubbles, and the ripples they leave when they pop
  const BUB = 46, bubCol = [new THREE.Color('#ff7b5a'), new THREE.Color('#fffaf0')], bd = new THREE.Object3D(), bubbles = [];
  const bubMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 10, 8), M('#ffffff', { roughness: .1, transparent: true, opacity: .88 }), BUB);
  bubMesh.frustumCulled = false; scene.add(bubMesh);
  const spawnBubble = b => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (BROTH_R - .15);
    b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.t = 0; b.dur = .6 + Math.random() * 1.2; b.size = .5 + Math.random() * .9;
    bubMesh.setColorAt(b.i, bubCol[isRed(b.x / BROTH_R, b.z / BROTH_R) ? 0 : 1]); bubMesh.instanceColor.needsUpdate = true;
  };
  for (let i = 0; i < BUB; i++) { const b = { i }; spawnBubble(b); b.t = Math.random() * b.dur; bubbles.push(b); }
  const ripGeo = new THREE.RingGeometry(.86, 1, 24); let ripI = 0;
  const ripples = Array.from({ length: 14 }, () => {
    const m = new THREE.Mesh(ripGeo, new THREE.MeshBasicMaterial({ color: '#fff4e2', transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return { m, t: 1, size: 1 };
  });
  const ripple = (x, z, size) => { const r = ripples[ripI++ % ripples.length]; r.t = 0; r.size = size; r.m.position.set(x, BROTH_Y + .01, z); r.m.visible = true; };
  let boil = 1;

  // steam
  const steam = [];
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#fff4e2', transparent: true, opacity: 0, depthWrite: false }));
    scene.add(s); steam.push({ s, t: Math.random() * 4, dur: 3 + Math.random() * 2, x: 0, z: 0 });
  }

  // feelings: hearts, sparkles, tears, z's and the odd exclamation mark
  const glyphs = glyphTextures();
  const fx = Array.from({ length: 30 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphs.heart, transparent: true, depthWrite: false, fog: false }));
    sp.visible = false; scene.add(sp); return { s: sp, t: 1, dur: 1 };
  });
  let fxI = 0;
  const emit = (name, n = 1, o = {}) => {
    for (let i = 0; i < n; i++) {
      const p = fx[fxI++ % fx.length]; p.s.material.map = glyphs[name]; p.s.visible = false;
      p.t = -i * (o.gap ?? .09); p.dur = o.dur ?? 1.3; p.ph = Math.random() * 6; p.rise = o.rise ?? 1.6; p.size = (o.size ?? .42) * (.8 + Math.random() * .4);
      p.x = (o.x ?? 0) + (Math.random() - .5) * (o.spread ?? 2.4); p.y = o.y ?? BROTH_Y + .3; p.z = (o.z ?? .5) + (Math.random() - .5) * (o.spread ?? 2.4) * .5;
    }
  };
  const overSeat = r => ({ x: SEAT[r][0] * .97, z: SEAT[r][1] * .97, y: 2.2, spread: .7, size: .5 });
  const setMood = (name, dur = 1.6, kick = .9) => { stir(dur + 1); mood = name; moodEnd = T + dur; lastStir = T; potSqV += kick; };
  const glance = (r, dur = 1.4) => { face.glance = r; face.glanceEnd = T + dur; };
  // tea steam
  const wisps = [];

  // floating ingredients
  const floaters = [];
  const addFloater = (kind, at) => {
    const g = ingredient(kind);
    const [a, r] = brothSpot();
    const f = { g, a, r, sp: (.08 + Math.random() * .12) * (Math.random() < .5 ? -1 : 1), ph: Math.random() * 6, yaw: (Math.random() - .5) * .9, jump: 0 };
    if (at) g.position.copy(at); scene.add(g); floaters.push(f);
    if (floaters.length > 26) { const old = floaters.shift(); scene.remove(old.g); }
    return f;
  };
  for (let i = 0; i < 10; i++) addFloater(Math.random() * 18 | 0);

  // seats: avatars on stools, place settings, turn rings, discard plates
  const ceramic = M('#fff4e2', { roughness: .25 }), ceramicW = M('#ffffff', { roughness: .25, side: THREE.DoubleSide }), ceramic2 = M('#fff4e2', { roughness: .25, side: THREE.DoubleSide });
  const bamboo = M('#e9c58f', { roughness: .5 }), woodD = M('#5a3019', { roughness: .55 }), matM = M('#d6c4a4', { map: matTexture(), roughness: 1 });
  const bowlGeo = lathe([[0, .02], [.2, .02], [.21, 0], [.24, 0], [.25, .04], [.33, .14], [.41, .28], [.44, .4], [.425, .41], [.39, .28], [.3, .14], [.2, .08], [0, .07]], 32);
  const cupGeo = lathe([[0, .03], [.12, .03], [.15, .06], [.19, .22], [.2, .26], [.185, .26], [.17, .2], [.13, .07], [0, .06]], 24);
  const saucerGeo = lathe([[0, .01], [.2, .01], [.3, .035], [.31, .05], [.2, .03], [0, .03]], 24);
  const dishGeo = lathe([[0, 0], [.15, 0], [.2, .03], [.25, .08], [.235, .085], [.19, .04], [0, .03]], 24);
  const plateGeo = lathe([[0, 0], [.55, 0], [.7, .012], [.78, .03], [.775, .042], [.7, .03], [0, .022]], 40);
  const stoolGeo = lathe([[0, -.16], [.5, -.16], [.6, -.12], [.62, -.06], [.58, -.01], [0, 0]], 28);
  const seats = [0, 1, 2, 3].map(r => {
    const [x, z] = SEAT[r], ry = -r * Math.PI / 2;
    const av = avatar3d('#ff8fab'); av.position.set(x, -.2, z); av.lookAt(0, -.2, 0); scene.add(av); av.visible = r !== 0;
    let stool = null;
    if (r) { // your own seat is behind the camera
      const g = new THREE.Group(); g.position.set(x, -.97, z); scene.add(g);
      stool = put(stoolGeo, M('#ff8fab', { roughness: .8 }), 0, 0, 0, g); stool.castShadow = true; stool.userData.dyn = true;
      put(new THREE.CylinderGeometry(.56, .5, .07, 24), woodD, 0, -.195, 0, g);
      put(new THREE.TorusGeometry(.4, .03, 6, 24), woodD, 0, -.85, 0, g).rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, l = put(new THREE.CylinderGeometry(.05, .04, 1.24, 8), woodD, Math.cos(a) * .4, -.81, Math.sin(a) * .4, g); l.rotation.set(Math.sin(a) * .09, 0, -Math.cos(a) * .09); l.castShadow = true; }
    }
    const [bx, bz] = BOWL[r];
    const mat = new THREE.Mesh(new THREE.RingGeometry(3.08, 4.2, 28, 1, Math.atan2(-z, x) - .4, .8), matM); mat.rotation.x = -Math.PI / 2; mat.position.y = .006; mat.receiveShadow = true; scene.add(mat);
    const bowl = put(bowlGeo, M('#ff8fab', { side: THREE.DoubleSide, roughness: .28 }), bx, 0, bz); bowl.castShadow = true; bowl.userData.dyn = true;
    put(new THREE.TorusGeometry(.432, .016, 6, 32), ceramic, bx, .405, bz).rotation.x = Math.PI / 2;
    put(new THREE.CircleGeometry(.39, 28), M('#f3dfb6', { roughness: .15 }), bx, .3, bz).rotation.x = -Math.PI / 2;
    for (const [gx, gz, col] of [[.12, .08, '#6fbf5a'], [-.1, -.12, '#6fbf5a'], [-.14, .1, '#d9402a']]) put(new THREE.TorusGeometry(.035, .014, 5, 10), M(col), bx + gx, .305, bz + gz).rotation.x = Math.PI / 2;
    const sticks = new THREE.Group();
    for (const o of [-.05, .05]) { const st = put(new THREE.CylinderGeometry(.014, .026, 1.05, 8), bamboo, 0, 0, o, sticks); st.rotation.z = Math.PI / 2 - .035; st.castShadow = true; }
    put(new THREE.CapsuleGeometry(.045, .16, 4, 10), ceramic, .3, -.03, 0, sticks).rotation.x = Math.PI / 2;
    const [sx, sz] = rot([.75, 3.75], r); sticks.position.set(sx, .075, sz); sticks.rotation.y = ry + Math.PI / 2 + .25; scene.add(sticks);
    { // tea cup with a saucer, and a little sauce dish
      const [cx, cz] = rot([-1.3, 3.55], r), [dx, dz] = rot([1.5, 3.55], r), [hx, hz] = rot([-.21, .06], r);
      put(saucerGeo, ceramic2, cx, 0, cz).castShadow = true;
      put(cupGeo, ceramic2, cx, 0, cz).castShadow = true;
      put(new THREE.CircleGeometry(.178, 20), M('#c98a3c', { roughness: .12 }), cx, .225, cz).rotation.x = -Math.PI / 2;
      for (let i = 0; i < 2; i++) { const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#fff4e2', transparent: true, opacity: 0, depthWrite: false })); scene.add(w); wisps.push({ s: w, x: cx, z: cz, ph: r * 1.7 + i * 1.1 }); }
      put(new THREE.TorusGeometry(.075, .022, 6, 14), ceramic, cx + hx, .15, cz + hz).rotation.y = ry + .28;
      put(dishGeo, ceramicW, dx, 0, dz).castShadow = true;
      put(new THREE.CircleGeometry(.205, 20), M('#8e1d10', { roughness: .15 }), dx, .058, dz).rotation.x = -Math.PI / 2;
      put(new THREE.SphereGeometry(.035, 8, 8), M('#5cb85c'), dx + .05, .065, dz - .03).scale.y = .5;
      put(new THREE.SphereGeometry(.03, 8, 8), M('#fff4e2'), dx - .07, .065, dz + .04).scale.y = .5;
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(bx, .1, bz); scene.add(ring);
    // discard tile
    const [tx, tz] = TILE[r];
    const tile = new THREE.Group(); tile.position.set(tx, TILE_Y, tz); tile.userData.dyn = true; scene.add(tile);
    const plate = put(plateGeo, M('#ff8fab', { roughness: .3, side: THREE.DoubleSide }), tx, 0, tz);
    plate.scale.set(.86, 1, 1.08); plate.receiveShadow = true; plate.castShadow = true; plate.userData.dyn = true;
    const stack = new THREE.Mesh(cardBlock(.78, 1.07, .1), M('#efe3cf')); stack.castShadow = true; stack.receiveShadow = true;
    const top = new THREE.Mesh(CARD_GEO, new THREE.MeshBasicMaterial({ map: cardTexture(-1) })); // only ever shown face up: unlit like the cards in your hand
    top.rotation.x = -Math.PI / 2; top.userData.tile = r;
    const halo = new THREE.Mesh(cardGeometry(1.02, 1.32, .2), new THREE.MeshBasicMaterial({ color: '#7ed3b2', transparent: true, opacity: 0 }));
    halo.rotation.x = -Math.PI / 2; halo.userData.tile = r;
    tile.add(stack, halo, top);
    return { av, stool, bowl, ring, tile, plate, stack, top, halo, c: -2, n: 0, pending: 0, hop: 0, nod: 0, look: 0, take: false, hover: 0, sq: 1, bs: 1.1, key: '' };
  });

  bake(scene); // every prop that never moves (stove, place settings, stool legs...) collapses into a few meshes

  // the toon look: flat cartoon shading and dark outlines, like the rest of the site
  const own = (m, grow, sx = 1, sy = 1, sz = 1) => { m.material = toonMat(m.material).clone(); m.userData.toon = true; shell(m, grow).scale.multiply(new THREE.Vector3(sx, sy, sz)); }; // things that get recoloured keep a material of their own
  for (const st of seats) {
    own(st.bowl, 1.07); own(st.plate, 1.05, 1, 1.6, 1); if (st.stool) own(st.stool, 1.07);
    st.edge = shell(st.stack, 1); st.edge.scale.set(1.09, 1, 1.07); st.edge.material = new THREE.MeshBasicMaterial({ color: '#4a2c22', side: THREE.BackSide }); toonify(st.tile);
  }
  for (const h of lanterns) toonify(h.parent, .03);
  pot.userData.dyn = false; toonify(potG, .04); pot.userData.dyn = true;
  toonify(scene, .03);
  const potRim = rimGlow('#ffe27a', .09);

  // the world outside: a floating meadow at sunset, pink clouds, lamp posts, birds heading home and fireflies
  skyDome(scene, SKY_TOP, SKY_LOW, { k: 1.25, off: .1 });
  const cloudRing = clouds({ min: 22, max: 90, below: -13, color: '#ffe3da' }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const land = island(17.5, 17.5, { round: true, rim: 4.4, seed: 7, props: 18, size: 1.7, flowers: 70, lamps: 5, clear: 10.6, grass: '#8cc866', patch: '#7dbb5c' }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 26, 6, 4, 1.3), blow = petals(scene, 22, 3, { n: 8, size: .09, colors: ['#ffc1dc', '#fff1a8', '#ffffff', '#ffd9ea'] });
  const pfx = createFx(scene);
  let flyIn = 0, punch = 0;

  // the pot is the draw pile: its rim glows when you can take from it
  const potHalo = new THREE.Mesh(new THREE.TorusGeometry(1.72, .08, 10, 64), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }));
  potHalo.rotation.x = Math.PI / 2; potHalo.position.y = POT_Y + .98; scene.add(potHalo);
  pot.userData.deck = true; broth.userData.deck = true;
  let deckActive = false, deckHover = 0;
  const setStack = (box, topM, halo, n) => {
    const h = .015 + Math.min(n, 40) * .006; box.scale.y = h; box.position.y = h / 2; topM.position.y = h + .002; halo.position.y = .004;
  };

  // ---------- tweens ----------
  const tweens = [];
  const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });

  const handPos = r => r === 0 ? new THREE.Vector3(0, 2.6, 6.2) : new THREE.Vector3(SEAT[r][0] * .78, 1.4, SEAT[r][1] * .78);
  const tilePos = r => new THREE.Vector3(TILE[r][0], TILE_Y + .02 + seats[r].top.position.y, TILE[r][1]);
  const deckPos = () => new THREE.Vector3((Math.random() - .5) * .8, BROTH_Y + .15, (Math.random() - .5) * .8);

  function flyCard(from, to, kind, faceUp, delay = 0, done, grow = false, back) { // back: whose card back it shows (a seat's cb)
    const g = new THREE.Group();
    // a face is unlit, so a card in the air looks exactly like the ones in your hand, day or night
    const front = new THREE.Mesh(CARD_GEO, kind >= 0 ? new THREE.MeshBasicMaterial({ map: cardTexture(kind, back) }) : toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(kind, back), roughness: .6 })));
    const backM = new THREE.Mesh(CARD_GEO, toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(-1, back), roughness: .6 })));
    backM.rotation.y = Math.PI; g.add(front, backM); g.visible = false; scene.add(g);
    const lift = 1.2 + from.distanceTo(to) * .12;
    const r0 = faceUp ? -Math.PI / 2 + 1.1 : Math.PI / 2, r1 = faceUp ? -Math.PI / 2 : Math.PI / 2 - .6;
    let wait = delay;
    tween(.55 + delay, t => {
      const tt = (t * (.55 + delay) - wait) / .55; if (tt < 0) return; g.visible = true;
      const e = ease(Math.min(1, tt));
      g.position.lerpVectors(from, to, e); g.position.y += Math.sin(e * Math.PI) * lift;
      g.rotation.set(r0 + (r1 - r0) * e, 0, Math.sin(e * Math.PI) * .5);
      if (grow) g.scale.setScalar(.2 + .8 * Math.min(1, e * 2.4));
    }, () => { scene.remove(g); front.material.dispose(); backM.material.dispose(); done?.(); });
  }
  function squash(seat) { tween(.35, t => { seat.sq = 1 + Math.sin(t * Math.PI) * .2 * (1 - t); }, () => { seat.sq = 1; }); }
  // an ingredient pops out of the broth whenever someone draws
  function popIngredient(kind) {
    const g = ingredient(kind >= 0 ? kind : Math.random() * 18 | 0); scene.add(g);
    const [a, r] = brothSpot(.45, .9), x = Math.cos(a) * r, z = Math.sin(a) * r;
    tween(.6, t => { g.position.set(x, BROTH_Y + Math.sin(t * Math.PI) * 1.3, z); g.rotation.set(t * 5, t * 3, 0); g.scale.setScalar(1.7 * (1 - t * t) + .01); }, () => scene.remove(g));
  }
  function puff(at, n = 6, big = 1) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#fff4e2', transparent: true, opacity: .5, depthWrite: false }));
      const a = i / n * 6.28; s.position.copy(at); scene.add(s);
      tween(.7, t => { s.position.set(at.x + Math.cos(a) * t * .9 * big, at.y + t * .5, at.z + Math.sin(a) * t * .9 * big); s.scale.setScalar((.3 + t * .8) * big); s.material.opacity = .55 * (1 - t); }, () => { scene.remove(s); s.material.dispose(); });
    }
  }
  function hopIngredient(kind, from, delay) {
    setTimeout(() => {
      const f = addFloater(kind, from.clone()); const g = f.g; f.flying = true;
      const to = new THREE.Vector3(Math.cos(f.a) * f.r, BROTH_Y + .02, Math.sin(f.a) * f.r);
      tween(.7, t => { const e = ease(t); g.position.lerpVectors(from, to, e); g.position.y += Math.sin(e * Math.PI) * 2.2; g.rotation.x = e * 6; },
        () => { f.flying = false; puff(to, 5, .6); boil = 3; });
    }, delay);
  }

  // ---------- input ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const pickables = () => [...seats.flatMap(s => [s.top, s.halo]), pot, broth];
  function pick(e) {
    const rc = canvas.getBoundingClientRect();
    ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables(), false)[0];
    if (!hit) return null;
    if (hit.object.userData.deck) return deckActive ? { deck: true } : null;
    const r = hit.object.userData.tile;
    return seats[r]?.take ? { tile: r } : null;
  }
  let hover = null;
  let busyUntil = 0; // shadows refresh often while something is happening, and rarely when the pot is just simmering
  const stir = (sec = 2.5) => { busyUntil = Math.max(busyUntil, T + sec); };
  const onMove = e => {
    stir(1.2);
    hover = pick(e);
    canvas.style.cursor = hover ? 'pointer' : '';
  };
  const onClick = e => { const h = pick(e); if (h?.deck) onDeck(); else if (h) onTile(h.tile); };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);

  // ---------- sizing & camera: fit the table between the top bar and the hand ----------
  let W = 0, H = 0, camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, 0), shake = 0;
  const DIR = new THREE.Vector3(0, 1, 1.1).normalize();
  const FIT = [[0, 2.75, -5.7], [0, 0, 4.7], [-6.3, 1.6, 0], [6.3, 1.6, 0]].map(p => new THREE.Vector3(...p));
  const v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const mobile = w < 760, portrait = w / h < 1;
    const cw = mobile ? Math.min(Math.max(w * .106, 40), 64) : Math.min(Math.max(w * .074, 56), 104);
    const top = mobile ? 172 : 58, bottom = h - (cw * 1.38 + 40) - (mobile ? 74 : 10);
    camera.aspect = w / h; camera.fov = portrait ? 46 : 36;
    camera.clearViewOffset(); camera.updateProjectionMatrix();
    let lo = 5, hi = 80;
    for (let i = 0; i < 30; i++) {
      const D = (lo + hi) / 2; place(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]);
      if (fy - ty <= bottom - top && lx >= 6) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 14; scene.fog.far = hi + 110; // small screens pull the camera back, and the fog goes with it
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    const off = (ty + fy) / 2 - (top + bottom) / 2;
    camera.setViewOffset(w, h, 0, off, w, h); camera.updateProjectionMatrix();
    // tell the HUD where the avatars are, so name tags sit under them
    const pts = [0, 1, 2, 3].map(r => {
      const [x, z] = SEAT[r];
      const [px, py] = toPx(new THREE.Vector3(x, r === 2 ? 2.4 : -.4, z));
      return { x: px, y: py - (r === 2 ? 0 : 0) };
    });
    const [potX, potY] = toPx(new THREE.Vector3(0, BROTH_Y + .1, 0));
    onLayout?.(pts, { w, h, pot: { x: potX, y: potY } });
  }

  // ---------- loop ----------
  let shadowIn = 0, frames = null;
  const res = autoResolution(renderer);
  const applyQuality = () => {
    res.setCap(quality === 'high' ? 2 : 1.5); // low keeps the full resolution (frames.js): it saves on shadows and steam instead
    key.castShadow = quality !== 'low'; renderer.shadowMap.needsUpdate = true;
    steam.forEach((st, i) => { st.s.visible = quality !== 'low' || i < 8; });
  };
  applyQuality();
  const loop = dt => {
    const busy = tweens.length > 0 || T < busyUntil || seats.some(s => s.hop > 0);
    resize();
    T += dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; tw.t += dt; const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i, 1); tw.done?.(); }
    }
    boil = Math.max(1, boil - dt * .8);
    for (const b of bubbles) {
      b.t += dt * boil;
      if (b.t >= b.dur) { if (b.size > .8) ripple(b.x, b.z, b.size); spawnBubble(b); }
      const p = b.t / b.dur, s = p < .8 ? p / .8 * b.size : b.size * (1 + (p - .8) * 4) * (1 - (p - .8) * 5);
      bd.position.set(b.x, BROTH_Y + s * .03, b.z); bd.scale.setScalar(Math.max(.001, s)); bd.updateMatrix(); bubMesh.setMatrixAt(b.i, bd.matrix);
    }
    bubMesh.instanceMatrix.needsUpdate = true;
    for (const st of steam) {
      st.t += dt * (.7 + boil * .3);
      if (st.t >= st.dur) { st.t = 0; st.dur = 3 + Math.random() * 2; const a = Math.random() * 6.28, r = Math.random() * 1.1; st.x = Math.cos(a) * r; st.z = Math.sin(a) * r; }
      const p = st.t / st.dur;
      st.s.position.set(st.x + Math.sin(T * .7 + st.dur) * .25 * p, BROTH_Y + .1 + p * 3.4, st.z);
      st.s.scale.setScalar(.7 + p * 2.2); st.s.material.opacity = Math.sin(p * Math.PI) * .17 * Math.min(boil, 1.8);
    }
    for (const f of floaters) {
      if (f.flying) continue;
      const na = f.a + f.sp * dt; // drift round the pot, turning back at the divider wall so each one stays in its own broth
      if (wallDist(Math.cos(na) * f.r, Math.sin(na) * f.r) > .22) f.a = na; else f.sp = -f.sp;
      const x = Math.cos(f.a) * f.r, z = Math.sin(f.a) * f.r;
      let y = BROTH_Y + .03 + Math.sin(T * 1.6 + f.ph) * .025, flip = 0;
      if (f.jump > 0) { // now and then one leaps out of the broth
        f.jump = Math.max(0, f.jump - dt * 1.5); y += Math.sin((1 - f.jump) * Math.PI) * .6; flip = (1 - f.jump) * Math.PI * 2;
        if (!f.jump) ripple(x, z, 1.8);
      }
      f.g.position.set(x, y, z);
      f.g.rotation.set(flip, f.yaw + Math.sin(T * .6 + f.ph) * .4, Math.sin(T * 1.3 + f.ph) * .09);
    }
    if (T > nextJump && floaters.length) {
      nextJump = T + 1.6 + Math.random() * 2.6;
      const f = floaters[Math.random() * floaters.length | 0]; if (!f.flying && !f.jump) { f.jump = 1; ripple(Math.cos(f.a) * f.r, Math.sin(f.a) * f.r, 1.4); }
    }
    seats.forEach((s, r) => {
      s.hop = Math.max(0, s.hop - dt * 2.2);
      s.av.position.y = -.2 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .5 * s.hop + (s.active ? Math.abs(Math.sin(T * 3)) * .08 : 0);
      s.nod = Math.max(0, s.nod - dt * 2.4);
      const d = face.turn < 0 ? 0 : (face.turn - r + 4) % 4; // everyone glances at whoever's turn it is
      s.look += ((d === 1 ? .45 : d === 3 ? -.45 : 0) - s.look) * .06;
      animateAvatar(s.av, T, { seed: r, active: s.active, hop: s.hop, look: s.look, nod: Math.sin(s.nod * Math.PI) });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1 + Math.sin(T * 4) * .05);
      const hv = hover?.tile === r; s.hover += ((hv ? 1 : 0) - s.hover) * .2;
      s.halo.material.opacity += ((s.take ? .55 + Math.sin(T * 5) * .3 : 0) - s.halo.material.opacity) * .2;
      s.tile.position.y = TILE_Y + (s.take ? .06 + Math.sin(T * 4 + r) * .04 : 0) + s.hover * .12;
      s.tile.scale.x = s.tile.scale.z = s.bs * s.sq * (1 + s.hover * .1);
      s.edge.material.color.set(hv ? '#ffffff' : s.take ? '#ffd84a' : '#4a2c22'); s.edge.scale.set(hv || s.take ? 1.14 : 1.09, 1, hv || s.take ? 1.11 : 1.07); // a bright rim on a discard you can take
    });
    potRim.show(deckActive ? potG : null); if (deckActive) potRim.pulse(T, .7 + deckHover * .3);
    deckHover += ((hover?.deck ? 1 : 0) - deckHover) * .2;
    potHalo.material.opacity += ((deckActive ? .65 + Math.sin(T * 5) * .3 : 0) - potHalo.material.opacity) * .2;
    potHalo.scale.setScalar(1 + deckHover * .05 + (deckActive ? Math.sin(T * 4) * .015 : 0));
    if (deckActive) boil = Math.max(boil, 1.6 + deckHover);
    for (const rp of ripples) {
      if (rp.t >= 1) continue;
      rp.t = Math.min(1, rp.t + dt * 1.6); rp.m.scale.setScalar((.05 + rp.t * .17) * rp.size); rp.m.material.opacity = .4 * (1 - rp.t); rp.m.visible = rp.t < 1;
    }
    shimmer[0].rotation.z = T * .05; shimmer[1].rotation.z = -T * .08 + 2;
    for (const fm of flames) {
      for (let i = 0; i < FL; i++) {
        const a = i / FL * Math.PI * 2, f = (.8 + Math.sin(T * 13 + i * 2.1) * .22 + Math.sin(T * 23 + i) * .12) * fm.userData.k * (.85 + boil * .15);
        dummy.position.set(Math.cos(a) * 1.37, .36, Math.sin(a) * 1.37); dummy.rotation.set(0, -a, -.38); dummy.scale.set(fm.userData.k, f, fm.userData.k); dummy.updateMatrix();
        fm.setMatrixAt(i, dummy.matrix);
      }
      fm.instanceMatrix.needsUpdate = true;
    }
    // the pot: springy body, wandering eyes, moods
    if (mood !== 'idle' && T > moodEnd) mood = 'idle';
    const asleep = mood === 'idle' && !deckActive && T - lastStir > 16;
    const [ey, mo, blushK] = MOODS[asleep ? 'sleepy' : mood === 'idle' && deckActive && deckHover > .4 ? 'peek' : mood];
    if (asleep && T > nextZ) { nextZ = T + 1.5; emit('zzz', 1, { x: .9, z: 1.2, spread: .3, y: POT_Y + 1.1, rise: 1.3, dur: 2, size: .34 }); }
    if (mood === 'cry' && T > nextZ) { nextZ = T + .25; emit('drop', 1, { x: Math.random() < .5 ? -.5 : .5, z: 1.7, spread: .15, y: POT_Y + .5, rise: -.5, dur: .7, size: .2 }); }
    const lookR = T < face.glanceEnd ? face.glance : face.turn, [lx, ly] = asleep || lookR < 0 ? [0, 0] : LOOK[lookR];
    face.look.x += (lx - face.look.x) * .08; face.look.y += (ly - face.look.y) * .08;
    const blink = (T + 1.9) % 5.2 < .14 || (T + .4) % 9.3 < .12;
    face.eyes.forEach((eg, i) => {
      const sd = i ? 1 : -1, open = ey === 'open' || ey === 'wide' || (ey === 'wink' && i === 0), k = ey === 'wide' ? 1.28 : 1;
      eg.visible = open; face.arcs[i].visible = !open;
      face.arcs[i].rotation.z = ey === 'sleep' ? Math.PI : 0; face.arcs[i].position.y = ey === 'sleep' ? .62 : .54;
      eg.scale.set(k, k * (blink ? .12 : 1), 1);
      eg.position.x = sd * .4 + face.look.x * .06; eg.position.y = .58 + face.look.y * .04;
      face.blush[i].scale.setScalar(blushK * (1 + Math.sin(T * 3 + i) * .04));
    });
    face.smile.visible = mo === 'smile'; face.open.visible = face.tongue.visible = mo === 'open'; face.oh.visible = mo === 'oh';
    party = Math.max(0, party - dt); laugh = Math.max(0, laugh - dt); potSpin = Math.max(0, potSpin - dt * 1.1);
    if (party > 0) potSqV += Math.sin(T * 14) * 9 * dt * Math.min(1, party);
    potSqV += (-potSq * 130 - potSqV * 9) * dt; potSq += potSqV * dt;
    potTiltV += (-potTilt * 90 - potTiltV * 6) * dt; potTilt += potTiltV * dt;
    potYaw += (face.look.x * .34 - potYaw) * .07;
    const pk = potSq + Math.sin(T * 19) * Math.min(.012, (boil - 1) * .006) + Math.sin(T * 1.7) * .006 + (laugh > 0 ? Math.sin(T * 22) * .03 * Math.min(1, laugh * 2) : 0);
    potG.scale.set(1 - pk * .5, 1 + pk, 1 - pk * .5);
    potG.rotation.set(0, potYaw + ease(1 - potSpin) * Math.PI * 2, potTilt + (deckActive ? Math.sin(T * 5) * .012 : 0) + (asleep ? Math.sin(T * 1.2) * .02 : 0));
    for (const p of fx) {
      if (p.t >= p.dur) { p.s.visible = false; continue; }
      p.t += dt; if (p.t < 0) continue;
      const k = p.t / p.dur;
      p.s.visible = true; p.s.position.set(p.x + Math.sin(T * 3 + p.ph) * .18 * k, p.y + p.rise * k * (2 - k), p.z);
      p.s.scale.setScalar(p.size * back(Math.min(1, k * 4))); p.s.material.opacity = Math.min(1, (1 - k) * 2.5); p.s.material.rotation = Math.sin(T * 2 + p.ph) * .3;
    }
    for (const w of wisps) {
      const k = (T * .35 + w.ph) % 1;
      w.s.position.set(w.x + Math.sin(T * 1.3 + w.ph * 5) * .05 * k, .3 + k * .75, w.z); w.s.scale.setScalar(.16 + k * .3); w.s.material.opacity = Math.sin(k * Math.PI) * .2;
    }
    bulbs.forEach((b, i) => b.scale.setScalar(1 + Math.sin(T * 2 + i) * .12));
    lanterns.forEach((h, i) => { h.parent.rotation.z = Math.sin(T * .9 + i * 2) * .04; h.material.opacity = .28 + Math.sin(T * 2.3 + i * 2) * .04 + Math.sin(T * 7.1 + i) * .02; });
    glow.intensity = 1.5 + Math.sin(T * 7) * .22 + Math.sin(T * 11.3) * .15;
    shake = Math.max(0, shake - dt * 2); punch = Math.max(0, punch - dt * 1.6);
    const zoom = 1 - Math.sin(Math.min(1, punch) * Math.PI) * .035; // a little push in on big moments
    camera.position.set(camBase.x * zoom + Math.sin(T * .25) * .2 + (Math.random() - .5) * shake * .3, camBase.y * zoom + Math.sin(T * .4) * .06, camBase.z * zoom);
    cloudRing.rotation.y = T * .005; flyBirds(T); blow(T);
    flyIn -= dt; if (flyIn <= 0 && quality !== 'low') { flyIn = .22; const a = Math.random() * 6.283, r = 6 + Math.random() * 6; pfx.rise(v.set(Math.cos(a) * r, -2 + Math.random() * 4, Math.sin(a) * r), { color: ['#fff1a8', '#ffe27a'], size: .16, life: 3.2, speed: .22, wobble: .5, grow: 0 }); } // fireflies
    pfx.update(dt, camera, H);
    camera.lookAt(camLook);
    shadowIn -= dt;
    if (shadowIn <= 0 && key.castShadow) { renderer.shadowMap.needsUpdate = true; shadowIn = busy ? .05 : .25; }
    renderer.render(scene, camera);
  };
  // if the device can't hold the frame rate, quietly drop the resolution a step (auto only)
  frames = frameLoop(loop, { fps: FPS, onSlow: () => { if (quality === 'auto') res.lower(); } });

  // ---------- API ----------
  return {
    // list has one entry per place round the table; null is a place nobody sits at (a table of 2 or 3)
    setSeats(list, turnRel) {
      list.forEach((p, r) => {
        const s = seats[r];
        s.empty = !p;
        if (s.stool) s.stool.parent.visible = !!p;
        if (!p) { s.av.visible = false; s.active = false; return; }
        const key = p.color + '|' + (p.av || []).join('.');
        if (key !== s.key) {
          s.key = key;
          const [x, z] = SEAT[r];
          scene.remove(s.av); disposeAvatar(s.av);
          s.av = avatar3d(p.color, p.av); s.av.position.set(x, -.2, z); s.av.lookAt(0, -.2, 0); s.av.visible = r !== 0; scene.add(s.av);
          s.bowl.material.color.set(p.color); s.plate.material.color.set(p.color);
          s.stool?.material.color.set(p.color).multiplyScalar(.72);
        }
        s.av.visible = r !== 0;
        s.cb = p.cb | 0; // their card back, for the cards that fly to their hand
        s.active = r === turnRel;
      });
      if (turnRel !== face.turn) { face.turn = turnRel; lastStir = T; }
    },
    setTiles(list) {
      list.forEach((t, r) => {
        const s = seats[r];
        t ||= { c: -1, n: 0 };
        s.n = t.n; setStack(s.stack, s.top, s.halo, t.n);
        s.stack.visible = t.n > 0;
        if (t.c !== s.c) { s.c = t.c; s.top.material.map = cardTexture(t.c >= 0 ? kindOf(t.c) : -1); s.top.material.needsUpdate = true; }
        s.top.visible = t.c >= 0 && !s.pending;
      });
    },
    setInteract({ tiles, deck: d }) {
      seats.forEach((s, r) => { s.take = tiles.has(r); });
      deckActive = d;
    },
    // from/to: 'deck' | 'tileN' | seat rel number
    fly(from, to, c, faceUp) {
      const P = x => x === 'deck' ? deckPos() : typeof x === 'string' ? tilePos(+x.slice(4)) : handPos(x);
      const kind = c >= 0 ? kindOf(c) : -1;
      stir();
      const toTile = typeof to === 'string' && to.startsWith('tile') ? seats[+to.slice(4)] : null;
      if (toTile) { toTile.pending++; toTile.top.visible = false; }
      const fromPot = from === 'deck';
      if (fromPot) { popIngredient(kind); puff(new THREE.Vector3(0, BROTH_Y + .1, 0), 7, .9); boil = 3; setMood('wow', .8, 1.5); pfx.burst(v.set(0, BROTH_Y + .1, 0), { n: 12, colors: ['#ff7b5a', '#ffd9a8', '#fffaf0'], shape: DOT, speed: 2.2, up: 3.6, size: .16, life: .7 }); }
      else if (!toTile) { setMood('peek', 1, .4); if (typeof to === 'number') glance(to); } // someone pinched a discard
      else { lastStir = T; glance(+to.slice(4), 1.2); potTiltV += (TILE[+to.slice(4)][0] > 0 ? -1 : 1) * .5; }
      const seatTo = typeof to === 'number' ? seats[to] : null;
      flyCard(P(from), P(to), kind, faceUp && kind >= 0, 0, () => {
        if (seatTo) seatTo.nod = 1; // a pleased little nod for the new card
        if (toTile) {
          const tp = tilePos(+to.slice(4)); emit('spark', 3, { x: tp.x, z: tp.z, y: .3, spread: .7, rise: .9, dur: .8, size: .26 });
          toTile.pending = Math.max(0, toTile.pending - 1);
          if (!toTile.pending && toTile.c >= 0) toTile.top.visible = true;
          squash(toTile); puff(tilePos(+to.slice(4)), 6, .5); pfx.ring(tilePos(+to.slice(4)), { color: '#ffffff', size: 1.3 });
        }
      }, fromPot, seatTo?.cb ?? (typeof from === 'number' ? seats[from].cb : undefined));
    },
    hop(r) { seats[r].hop = 1; potSqV += .35; lastStir = T; stir(); },
    setQuality(q) { quality = q; applyQuality(); },
    stats: () => ({ ...renderer.info.render, fps: frames.fps(), geometries: renderer.info.memory.geometries, dpr: renderer.getPixelRatio() }),
    // k indexes the quick reactions: six snacks, then laugh, heart, thumbs up, wow, cry, fire
    emote(r, k) {
      const s = seats[r]; s.hop = Math.max(s.hop, .75); glance(r, 1.8);
      const [m, sym] = k < 6 ? ['yum', 'spark'] : [['happy', 'note'], ['love', 'heart'], ['wink', 'spark'], ['wow', 'bang'], ['cry', 'drop'], ['fire', 'spark']][k - 6] || ['happy', 'spark'];
      setMood(m, m === 'cry' ? 2.2 : 1.8, m === 'cry' ? -.5 : 1);
      if (r) emit(sym, 2, overSeat(r));
      if (m === 'cry') return;
      emit(sym, m === 'love' ? 7 : 4, m === 'wow' ? { spread: .4, y: POT_Y + 1.4, size: .6 } : {});
      if (m === 'happy') laugh = 1.4;
      if (m === 'fire') { boil = 4; shake = Math.max(shake, .4); pfx.burst(v.set(0, BROTH_Y + .2, 0), { n: 18, colors: ['#ff7a3c', '#ffd84a', '#ff5a3c'], shape: DOT, speed: 2, up: 5, size: .22, life: .8, grav: 3 }); }
      if (m === 'wink') potTiltV += .8;
    },
    potMood(name) {
      if (!MOODS[name]) return;
      setMood(name, name === 'dizzy' ? 1.6 : 1.4);
      if (name === 'dizzy') { potSpin = 1; boil = 3; emit('spark', 5); }
      if (name === 'bang') emit('bang', 1, { spread: .3, y: POT_Y + 1.4, size: .6 });
    },
    deal() { boil = 3; setMood('happy', 2.2, 1.4); emit('spark', 8, { gap: .12 }); punch = 1; pfx.burst(v.set(0, BROTH_Y + .3, 0), { n: 24, colors: ['#ffd84a', '#fff1a8', '#ffffff'], speed: 4, up: 5, size: .26, life: 1 }); for (let i = 0; i < 16; i++) flyCard(deckPos(), handPos(i % 4), -1, false, i * .05, undefined, true, seats[i % 4].cb); },
    celebrate(r, hand, who) { // who: the seat number, for their win effect
      const from = r === 0 ? new THREE.Vector3(0, 1.4, 4.4) : handPos(r);
      (hand.length ? hand : Array.from({ length: 9 }, () => Math.random() * 72 | 0)).forEach((c, i) => hopIngredient(kindOf(c), from, i * 110));
      seats[r].hop = 1; setTimeout(() => { seats[r].hop = 1; }, 600);
      seats.forEach((s, i) => { if (i !== r) setTimeout(() => { s.hop = Math.max(s.hop, .7); }, 900 + i * 160); }); // a wave of cheers
      setMood('love', 4.5, 1.6); party = 3.2; glance(r, 3); emit('heart', 9, { gap: .22 }); emit('spark', 9, { gap: .2 });
      shake = 1; boil = 4; punch = 1;
      const sp = new THREE.Vector3(SEAT[r][0] * .8, 1.2, SEAT[r][1] * .8);
      pfx.burst(sp, { n: 30, colors: ['#ffd84a', '#ff9fb8', '#ffffff'], speed: 4.5, up: 5.5, size: .3, life: 1.1, shape: [STAR, HEART] });
      pfx.confetti(new THREE.Vector3(0, 1, 0), { n: 140, w: 10, h: 5, s: who }); setTimeout(() => pfx.confetti(new THREE.Vector3(0, 1, 0), { n: 100, w: 11, h: 5, s: who }), 700);
      setTimeout(() => puff(new THREE.Vector3(0, BROTH_Y + .2, 0), 14, 2), 1000);
    },
    dispose() {
      frames.stop();
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick);
      pfx.dispose(); potRim.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

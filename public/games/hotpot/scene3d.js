// Hot Pot 3D table (three.js). Purely visual: the HUD owns the rules.
import * as THREE from 'three';
import { CATS, kindOf, catOf } from './rules.js';
import { iconSvg, backSvg } from './icons.js';
import { SKINS, HAIR_COLS, cleanAv } from '../../avatar.js';

const INK = '#3b2219';
const TABLE_R = 4.4, POT_Y = .53, BROTH_Y = POT_Y + .52, BROTH_R = 1.47;
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
function cardTexture(kind) { // kind -1 = back
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
      g.fillStyle = '#e5543b'; rr(g, 9, 9, 238, 334, 27); g.fill();
      g.strokeStyle = '#ffffff33'; g.lineWidth = 6; rr(g, 26, 26, 204, 300, 18); g.stroke();
      const im = await svgImg(backSvg('width="200" height="200"'));
      if (im) g.drawImage(im, 28, 76, 200, 200);
    } else {
      const cat = CATS[Math.floor(kind / 3)];
      g.fillStyle = INK; rr(g, 0, 0, 256, 352, 34); g.fill();
      g.fillStyle = '#fff4e2'; rr(g, 9, 9, 238, 334, 27); g.fill();
      g.save(); rr(g, 9, 9, 238, 334, 27); g.clip();
      g.fillStyle = cat.col; g.fillRect(0, 0, 256, 62); g.fillStyle = INK; g.fillRect(0, 62, 256, 8);
      g.restore();
      g.fillStyle = '#fff'; g.font = '600 32px Fredoka, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(cat.name, 128, 38);
      const im = await svgImg(iconSvg(kind, 'width="200" height="200"'));
      if (im) g.drawImage(im, 28, 76, 200, 200);
      g.fillStyle = INK; g.font = '600 31px Fredoka, Nunito, sans-serif';
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
function isRed(x, z) {
  if (x * x + (z + .5) ** 2 < .25) return false;
  if (x * x + (z - .5) ** 2 < .25) return true;
  return x > 0;
}
function rugTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  [['#5a2c45', 256], ['#ff8fab', 244], ['#fff4e2', 226], ['#7ed3b2', 214], ['#3d1f33', 200]].forEach(([c, r]) => { g.fillStyle = c; g.beginPath(); g.arc(256, 256, r, 0, 7); g.fill(); });
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; g.fillStyle = i % 2 ? '#ffb547' : '#ff8fab'; g.beginPath(); g.arc(256 + Math.cos(a) * 178, 256 + Math.sin(a) * 178, 9, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
function ingredient(kind) {
  const cat = Math.floor(kind / 3), k = kind % 3;
  let m;
  if (cat === 0) { m = new THREE.Mesh(new THREE.BoxGeometry(.44, .04, .27), M(['#d9584a', '#f2a08e', '#c95a4c'][k])); }
  else if (cat === 1) {
    m = k === 0 ? new THREE.Mesh(new THREE.TorusGeometry(.13, .06, 8, 16, Math.PI * 1.4), M('#ff9a62'))
      : k === 1 ? new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), M('#fffaf0'))
        : new THREE.Mesh(new THREE.CylinderGeometry(.06, .11, .32, 12), M('#ffe1e6'));
    if (k !== 1) m.rotation.x = Math.PI / 2;
  } else if (cat === 2) { m = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), M(['#62bf55', '#2f9e4b', '#cfe58a'][k])); m.scale.set(1.1, .22, .7); }
  else if (cat === 3) {
    m = k === 1 ? new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#8f5a37'))
      : new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), M(k ? '#4e3329' : '#fff8ec'));
    if (k === 2) m.scale.set(1, .2, 1); if (k === 0) m.scale.set(.5, .5, 1.6);
  } else if (cat === 4) {
    m = k === 1 ? new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .07, 16), M('#fffdf7'))
      : new THREE.Mesh(new THREE.TorusGeometry(.14, k ? .022 : .045, 8, 20), M(k ? '#cfeef6' : '#fff1c7', k ? { transparent: true, opacity: .8 } : {}));
    if (k !== 1) m.rotation.x = Math.PI / 2; else m.scale.set(1.3, 1, .8);
  } else {
    m = k === 0 ? new THREE.Mesh(new THREE.BoxGeometry(.22, .2, .22), M('#fff6dc'))
      : new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 12), M(k === 1 ? '#fff8ea' : '#f6eadb'));
    if (k === 1) m.scale.set(1.3, .6, .8); if (k === 2) m.scale.set(.7, .85, .7);
  }
  const g = new THREE.Group(); g.add(m); return g;
}

// ---------- avatar ----------
function avatar(color, avIn) {
  const [sk, hair, hc, acc, ey, mo, fit, det] = cleanAv(avIn);
  const g = new THREE.Group(), hg = new THREE.Group(), bg = new THREE.Group(), eyes = [];
  hg.position.y = 1.42; hg.scale.setScalar(1.16); bg.scale.setScalar(.9); // chibi: big head, small body
  const body = M(color, { roughness: .7 }), skin = M(SKINS[sk], { roughness: .8 }), hm = M(HAIR_COLS[hc], { roughness: .75 });
  const white = M('#ffffff', { roughness: .6 }), cream = M('#fff4e2', { roughness: .7 }), ink = M(sk >= 3 ? '#1c0f0a' : '#2a1712', { roughness: .3 });
  const red = M('#e5543b'), gold = M('#ffc93c', { roughness: .35, metalness: .3 }), pink = M('#ff5d8f', { roughness: .5 }), dark = M('#8a2f2f');
  const put = (grp, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); grp.add(m); return m; };
  const add = (geo, mat, x, y, z) => put(hg, geo, mat, x, y, z);
  const sph = r => new THREE.SphereGeometry(r, 14, 12);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.62, .7, 6, 18), body); torso.position.y = .1; torso.castShadow = true;
  bg.add(torso); g.add(bg, hg);
  for (const s of [-1, 1]) { // little arms reaching for the table, and ears
    const arm = put(bg, new THREE.CapsuleGeometry(.15, .46, 4, 10), body, s * .6, .46, .32); arm.rotation.set(-1.1, 0, s * .25); arm.castShadow = true;
    put(bg, sph(.16), skin, s * .52, .28, .72);
    add(sph(.13), skin, s * .58, -.04, 0);
  }
  put(bg, new THREE.TorusGeometry(.4, .09, 8, 20), body, 0, .88, 0).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(.6, 24, 18), skin, 0, 0, 0).castShadow = true;
  const hat = acc === 1 || acc === 5;
  // hair
  if (![3, 5, 9].includes(hair)) add(new THREE.SphereGeometry(.63, 24, 12, 0, Math.PI * 2, 0, Math.PI * .42), hm, 0, .02, 0).rotation.x = -.35;
  if (hair === 0 && !hat) add(sph(.22), hm, 0, .64, -.08);
  if (hair === 2) for (const s of [-1, 1]) add(sph(.24), hm, s * .66, -.02, -.05);
  if (hair === 3) {
    add(new THREE.SphereGeometry(.63, 24, 12, 0, Math.PI * 2, 0, Math.PI * .42), hm, 0, .02, 0).rotation.x = -.35;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, c = add(new THREE.ConeGeometry(.17, .42, 8), hm, Math.sin(a) * .3, .6, Math.cos(a) * .26 - .08);
      c.rotation.set(Math.cos(a) * .55, 0, -Math.sin(a) * .55);
    }
    add(new THREE.ConeGeometry(.17, .46, 8), hm, 0, .7, -.08);
  }
  if (hair === 4) add(sph(.64), hm, 0, -.3, -.2).scale.set(1.02, 1.25, .8);
  if (hair === 6) add(sph(.66), hm, 0, -.12, -.14).scale.set(1.06, .95, .86);
  if (hair === 7) { add(sph(.2), hm, 0, .2, -.66); add(sph(.2), hm, 0, -.2, -.82).scale.set(.9, 2, .9); }
  if (hair === 8) for (let i = 0; i < 14; i++) {
    const a = i * 2.4, e = .25 + (i % 5) * .22;
    add(sph(.2), hm, Math.sin(a) * Math.sin(e) * .58, Math.cos(e) * .58 + .04, Math.cos(a) * Math.sin(e) * .58 - .1);
  }
  if (hair === 9) for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(.13, .44, 8), hm, 0, .58 + Math.sin((i + .5) / 5 * Math.PI) * .16, .34 - i * .19).rotation.x = .5 - i * .25;
  // face
  const blushM = new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: .7 });
  const arcGeo = new THREE.TorusGeometry(.075, .022, 6, 12, Math.PI);
  for (const s of [-1, 1]) {
    add(new THREE.CircleGeometry(.1, 16), blushM, s * .34, -.14, .5).rotation.y = s * .55;
    const style = ey === 4 ? (s > 0 ? 1 : 0) : ey;
    if (style === 1) add(arcGeo, ink, s * .2, -.01, .56);
    else if (style === 2) add(arcGeo, ink, s * .2, .05, .56).rotation.z = Math.PI;
    else {
      const e = add(sph(style === 3 ? .11 : .088), ink, s * .2, .02, .54); e.scale.set(1, 1.25, .6);
      const hl = add(sph(style === 3 ? .034 : .024), white, s * .2 + .03, .075, .6);
      eyes.push(e, hl);
    }
    if (det === 1) for (const [dx, dy] of [[0, 0], [.07, -.05], [-.05, -.07]]) add(sph(.018), M('#9c5a3c'), s * (.32 + dx), -.06 + dy, .5 - Math.abs(dx) * .3);
  }
  const mz = det === 3 ? .645 : .58;
  const smileM = () => { add(arcGeo, ink, 0, -.12, mz).rotation.z = Math.PI; };
  if (mo === 0) smileM();
  if (mo === 1) add(sph(.08), dark, 0, -.17, mz - .03).scale.set(1, .9, .4);
  if (mo === 2) for (const s of [-1, 1]) add(new THREE.TorusGeometry(.04, .018, 6, 10, Math.PI), ink, s * .04, -.13, mz).rotation.z = Math.PI;
  if (mo === 3) add(new THREE.TorusGeometry(.035, .018, 6, 12), ink, 0, -.16, mz);
  if (mo === 4) { smileM(); add(sph(.04), M('#ff7a8a'), 0, -.2, mz).scale.set(1, 1.2, .5); }
  if (det === 2) for (const s of [-1, 1]) add(sph(.075), hm, s * .085, -.08, .585).scale.set(1.5, .55, .5);
  if (det === 3) add(new THREE.SphereGeometry(.625, 20, 10, Math.PI * .12, Math.PI * .76, Math.PI * .56, Math.PI * .44), hm, 0, 0, 0);
  // extras
  if (acc === 1) { add(new THREE.CylinderGeometry(.4, .37, .3, 20), white, 0, .62, -.04); add(sph(.5), white, 0, .98, -.04).scale.set(1, .72, 1); }
  if (acc === 2 || acc === 8) {
    for (const s of [-1, 1]) {
      add(new THREE.TorusGeometry(.12, .022, 8, 20), ink, s * .2, .02, .6);
      if (acc === 8) add(new THREE.CircleGeometry(.12, 20), ink, s * .2, .02, .6);
    }
    add(new THREE.CylinderGeometry(.02, .02, .16, 6), ink, 0, .02, .62).rotation.z = Math.PI / 2;
  }
  if (acc === 3) {
    for (const s of [-1, 1]) add(sph(.16), pink, .3 + s * .17, .56, .2).scale.set(1, .8, .5);
    add(sph(.08), M('#ff8fab'), .3, .56, .24);
  }
  if (acc === 4) for (const s of [-1, 1]) add(new THREE.ConeGeometry(.17, .36, 12), hair === 5 ? body : hm, s * .36, .58, 0).rotation.z = -s * .35;
  if (acc === 5) {
    add(new THREE.CylinderGeometry(.36, .33, .18, 20), gold, 0, .6, -.04);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(.08, .2, 8), gold, Math.sin(a) * .31, .78, Math.cos(a) * .31 - .04); }
  }
  if (acc === 6) {
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(sph(.075), M('#ff8fab'), .36 + Math.cos(a) * .09, .44 + Math.sin(a) * .09, .32); }
    add(sph(.06), gold, .36, .44, .36);
  }
  if (acc === 7) {
    add(new THREE.TorusGeometry(.65, .045, 8, 28, Math.PI), ink, 0, 0, 0);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.19, .19, .14, 18), body, s * .64, -.02, 0).rotation.z = Math.PI / 2;
  }
  // outfit
  if (fit === 1) put(bg, new THREE.CylinderGeometry(.635, .635, .8, 20, 1, true, -.6, 1.2), M('#ffffff', { roughness: .6, side: THREE.DoubleSide }), 0, .1, 0);
  if (fit === 2) { put(bg, new THREE.TorusGeometry(.45, .13, 10, 24), cream, 0, .9, 0).rotation.x = Math.PI / 2; put(bg, new THREE.BoxGeometry(.2, .5, .1), cream, .2, .62, .52).rotation.x = -.25; }
  if (fit === 3) for (const y of [.36, .06, -.24]) put(bg, new THREE.TorusGeometry(.625, .03, 6, 28), white, 0, y, 0).rotation.x = Math.PI / 2;
  if (fit === 4) { for (const s of [-1, 1]) put(bg, new THREE.ConeGeometry(.1, .2, 10), red, s * .12, .78, .5).rotation.z = s * Math.PI / 2; put(bg, sph(.05), gold, 0, .78, .52); }
  for (const e of eyes) e.userData.sy = e.scale.y;
  g.userData = { head: hg, eyes };
  return g;
}

export function createScene(canvas, { onTile, onDeck, onLayout }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1422'); scene.fog = new THREE.Fog('#2a1422', 17, 36);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);

  // lights
  scene.add(new THREE.HemisphereLight('#ffe2c4', '#3a1a2c', 1.5));
  const key = new THREE.DirectionalLight('#ffe6c8', 2.1); key.position.set(5, 12, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  key.shadow.bias = -.0008; scene.add(key);
  const glow = new THREE.PointLight('#ff7a30', 5, 6, 1.5); glow.position.set(0, .7, 0); scene.add(glow);

  // floor + string lights
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), M('#24111c', { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.4; floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = -2.38; rug.receiveShadow = true; scene.add(rug);
  const bulbs = [];
  const bulbCols = ['#ffb547', '#ff8fab', '#7ed3b2', '#ffd27a', '#ff7a59'];
  [[-9, -7, 9, -7, 6.2], [-10, -3, -6, -10, 5.4], [6, -10, 10, -3, 5.6]].forEach(([x1, z1, x2, z2, y], li) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * 1.1, z1 + (z2 - z1) * t)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a0c14' })));
    pts.forEach((p, i) => {
      if (i % 2) return;
      const b = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), new THREE.MeshBasicMaterial({ color: bulbCols[(i / 2 + li) % 5] }));
      b.position.copy(p).y -= .16; scene.add(b); bulbs.push(b);
    });
    const l = new THREE.PointLight('#ffb070', 6, 14, 1.4); l.position.copy(pts[7]); scene.add(l);
  });

  // table
  const wood = woodTexture();
  const table = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - .1, .36, 72), [M('#7a4628'), M('#ffffff', { map: wood, roughness: .6 }), M('#7a4628')]);
  table.position.y = -.18; table.receiveShadow = true; scene.add(table);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, .1, 10, 80), M('#6e3c20')); rim.rotation.x = Math.PI / 2; scene.add(rim);
  const susan = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, .08, 64), M('#c4885a', { map: woodTexture('#c4885a', '#9a6440'), roughness: .5 }));
  susan.position.y = .04; susan.receiveShadow = true; scene.add(susan);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.1, 2.1, 24), M('#5a3019')); leg.position.y = -1.4; scene.add(leg);

  // burner + pot
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, .45, 32), M('#3a3438', { metalness: .4, roughness: .4 }));
  burner.position.y = .3; burner.castShadow = true; scene.add(burner);
  const flame = new THREE.Mesh(new THREE.TorusGeometry(1.08, .045, 8, 48), new THREE.MeshBasicMaterial({ color: '#7cc4ff' }));
  flame.rotation.x = Math.PI / 2; flame.position.y = .5; scene.add(flame);
  const prof = [[0, 0], [1.25, 0], [1.42, .06], [1.52, .22], [1.56, .62], [1.63, .68], [1.61, .75], [1.5, .73], [1.47, .6]].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M('#d3d7de', { metalness: .45, roughness: .28, side: THREE.DoubleSide }));
  pot.position.y = POT_Y; pot.castShadow = true; scene.add(pot);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(.22, .06, 8, 20, Math.PI), M('#c2c6cc', { metalness: .5, roughness: .3 }));
    h.position.set(s * 1.66, POT_Y + .6, 0); h.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); scene.add(h);
  }
  { // the pot gets a sleepy little face
    const inkM = M('#3b2219', { roughness: .3 }), wh = M('#ffffff'), bl = new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: .75 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.1, 14, 12), inkM); e.position.set(s * .36, POT_Y + .42, 1.5); e.scale.set(1, 1.25, .5); scene.add(e);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 8), wh); h.position.set(s * .36 + .035, POT_Y + .47, 1.56); scene.add(h);
      const c = new THREE.Mesh(new THREE.CircleGeometry(.13, 16), bl); c.position.set(s * .66, POT_Y + .3, 1.41); c.rotation.y = s * .44; scene.add(c);
    }
    const sm = new THREE.Mesh(new THREE.TorusGeometry(.09, .026, 6, 12, Math.PI), inkM); sm.position.set(0, POT_Y + .33, 1.56); sm.rotation.z = Math.PI; scene.add(sm);
  }
  const broth = new THREE.Mesh(new THREE.CircleGeometry(BROTH_R, 64), new THREE.MeshStandardMaterial({ map: brothTexture(), roughness: .18, emissive: '#3a0e04', emissiveIntensity: .7 }));
  broth.rotation.x = -Math.PI / 2; broth.position.y = BROTH_Y; scene.add(broth);
  { // S-shaped divider
    const R = BROTH_R, pts = [];
    for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + i / 20 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * R / 2, BROTH_Y + .02, -R / 2 + Math.sin(a) * R / 2)); }
    for (let i = 1; i <= 20; i++) { const a = -Math.PI / 2 - i / 20 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * R / 2, BROTH_Y + .02, R / 2 + Math.sin(a) * R / 2)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .035, 8), M('#c9cdd4', { metalness: .5, roughness: .3 }));
    scene.add(tube);
  }

  // bubbles
  const bubRed = M('#ff7b5a', { roughness: .1, transparent: true, opacity: .85 }), bubCream = M('#fffaf0', { roughness: .1, transparent: true, opacity: .9 });
  const bubGeo = new THREE.SphereGeometry(.07, 10, 8), bubbles = [];
  const spawnBubble = b => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (BROTH_R - .15);
    b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.t = 0; b.dur = .6 + Math.random() * 1.2; b.size = .5 + Math.random() * .9;
    b.m.material = isRed(b.x / BROTH_R, b.z / BROTH_R) ? bubRed : bubCream;
    b.m.position.set(b.x, BROTH_Y, b.z);
  };
  for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(bubGeo, bubRed); scene.add(m); const b = { m }; spawnBubble(b); b.t = Math.random() * b.dur; bubbles.push(b); }
  let boil = 1;

  // steam
  const dot = softDot(), steam = [];
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#fff4e2', transparent: true, opacity: 0, depthWrite: false }));
    scene.add(s); steam.push({ s, t: Math.random() * 4, dur: 3 + Math.random() * 2, x: 0, z: 0 });
  }

  // floating ingredients
  const floaters = [];
  const addFloater = (kind, at) => {
    const g = ingredient(kind);
    const f = { g, a: Math.random() * 6.28, r: .35 + Math.random() * .8, sp: (.08 + Math.random() * .12) * (Math.random() < .5 ? -1 : 1), ph: Math.random() * 6, spin: (Math.random() - .5) * .8 };
    if (at) g.position.copy(at); scene.add(g); floaters.push(f);
    if (floaters.length > 26) { const old = floaters.shift(); scene.remove(old.g); }
    return f;
  };
  for (let i = 0; i < 10; i++) addFloater(Math.random() * 18 | 0);

  // seats: avatars, bowls, turn rings, tiles
  const seats = [0, 1, 2, 3].map(r => {
    const [x, z] = SEAT[r];
    const av = avatar('#ff8fab'); av.position.set(x, -.2, z); av.lookAt(0, -.2, 0); scene.add(av); av.visible = r !== 0;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#ff8fab', { side: THREE.DoubleSide, roughness: .4 }));
    const [bx, bz] = BOWL[r]; bowl.position.set(bx, .42, bz); bowl.castShadow = true; scene.add(bowl);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(.36, 24), M('#f6e6c4')); soup.rotation.x = -Math.PI / 2; soup.position.set(bx, .32, bz); scene.add(soup);
    const sticks = new THREE.Group();
    for (const o of [-.05, .05]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.018, .025, 1.05, 6), M('#e9c58f')); st.rotation.z = Math.PI / 2; st.position.z = o; sticks.add(st); }
    const [sx, sz] = rot([.75, 3.75], r); sticks.position.set(sx, .05, sz); sticks.rotation.y = -r * Math.PI / 2 + Math.PI / 2 + .25; scene.add(sticks);
    { // tea cup with a saucer, and a little sauce dish
      const [cx, cz] = rot([-1.3, 3.55], r), [dx, dz] = rot([1.5, 3.55], r);
      const P = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; scene.add(m); return m; };
      P(new THREE.CylinderGeometry(.3, .26, .03, 20), M('#fff4e2'), cx, .02, cz);
      P(new THREE.CylinderGeometry(.19, .15, .22, 18), M('#fff4e2', { roughness: .35 }), cx, .14, cz);
      P(new THREE.CircleGeometry(.165, 18), M('#c98a3c', { roughness: .2 }), cx, .252, cz).rotation.x = -Math.PI / 2;
      P(new THREE.TorusGeometry(.08, .025, 6, 12), M('#fff4e2'), cx + .2, .14, cz);
      P(new THREE.CylinderGeometry(.24, .17, .08, 18), M('#ffffff', { roughness: .35 }), dx, .04, dz);
      P(new THREE.CircleGeometry(.2, 18), M('#8e1d10', { roughness: .2 }), dx, .083, dz).rotation.x = -Math.PI / 2;
      P(new THREE.SphereGeometry(.035, 8, 8), M('#5cb85c'), dx + .05, .09, dz - .03);
      P(new THREE.SphereGeometry(.03, 8, 8), M('#fff4e2'), dx - .07, .09, dz + .04);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(bx, .1, bz); scene.add(ring);
    // discard tile
    const [tx, tz] = TILE[r];
    const tile = new THREE.Group(); tile.position.set(tx, .08, tz); scene.add(tile);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.74, .74, .04, 36), M('#ff8fab', { roughness: .5 }));
    plate.position.set(tx, .02, tz); plate.scale.set(.86, 1, 1.08); plate.receiveShadow = true; scene.add(plate);
    const stack = new THREE.Mesh(new THREE.BoxGeometry(.78, 1, 1.07), M('#efe3cf')); stack.castShadow = true; stack.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.1), new THREE.MeshStandardMaterial({ map: cardTexture(-1), roughness: .6, transparent: true }));
    top.rotation.x = -Math.PI / 2; top.userData.tile = r;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.32), new THREE.MeshBasicMaterial({ color: '#7ed3b2', transparent: true, opacity: 0 }));
    halo.rotation.x = -Math.PI / 2; halo.userData.tile = r;
    tile.add(stack, halo, top);
    return { av, bowl, ring, tile, plate, stack, top, halo, c: -2, n: 0, pending: 0, hop: 0, take: false, hover: 0, sq: 1, bs: 1.1, key: '' };
  });

  // the pot is the draw pile: its rim glows when you can take from it
  const potHalo = new THREE.Mesh(new THREE.TorusGeometry(1.72, .08, 10, 64), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }));
  potHalo.rotation.x = Math.PI / 2; potHalo.position.y = POT_Y + .74; scene.add(potHalo);
  pot.userData.deck = true; broth.userData.deck = true;
  let deckActive = false, deckHover = 0;
  const setStack = (box, topM, halo, n) => {
    const h = .015 + Math.min(n, 40) * .006; box.scale.y = h; box.position.y = h / 2; topM.position.y = h + .002; halo.position.y = .004;
  };

  // ---------- tweens ----------
  const tweens = [];
  const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });

  const handPos = r => r === 0 ? new THREE.Vector3(0, 2.6, 6.2) : new THREE.Vector3(SEAT[r][0] * .78, 1.4, SEAT[r][1] * .78);
  const tilePos = r => new THREE.Vector3(TILE[r][0], .1 + seats[r].top.position.y, TILE[r][1]);
  const deckPos = () => new THREE.Vector3((Math.random() - .5) * .8, BROTH_Y + .15, (Math.random() - .5) * .8);

  function flyCard(from, to, kind, faceUp, delay = 0, done, grow = false) {
    const g = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.1), new THREE.MeshStandardMaterial({ map: cardTexture(kind), roughness: .6, transparent: true }));
    const backM = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.1), new THREE.MeshStandardMaterial({ map: cardTexture(-1), roughness: .6, transparent: true }));
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
    }, () => { scene.remove(g); front.material.dispose(); backM.material.dispose(); front.geometry.dispose(); done?.(); });
  }
  function squash(seat) { tween(.35, t => { seat.sq = 1 + Math.sin(t * Math.PI) * .2 * (1 - t); }, () => { seat.sq = 1; }); }
  // an ingredient pops out of the broth whenever someone draws
  function popIngredient(kind) {
    const g = ingredient(kind >= 0 ? kind : Math.random() * 18 | 0); scene.add(g);
    const a = Math.random() * 6.28, x = Math.cos(a) * .5, z = Math.sin(a) * .5;
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
  const onMove = e => {
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
  const clock = new THREE.Clock(); let raf = 0, T = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    resize();
    const dt = Math.min(clock.getDelta(), .05); T += dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; tw.t += dt; const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i, 1); tw.done?.(); }
    }
    boil = Math.max(1, boil - dt * .8);
    for (const b of bubbles) {
      b.t += dt * boil;
      if (b.t >= b.dur) spawnBubble(b);
      const p = b.t / b.dur, s = p < .8 ? p / .8 * b.size : b.size * (1 + (p - .8) * 4) * (1 - (p - .8) * 5);
      b.m.scale.setScalar(Math.max(.001, s)); b.m.position.y = BROTH_Y + s * .03;
    }
    for (const st of steam) {
      st.t += dt * (.7 + boil * .3);
      if (st.t >= st.dur) { st.t = 0; st.dur = 3 + Math.random() * 2; const a = Math.random() * 6.28, r = Math.random() * 1.1; st.x = Math.cos(a) * r; st.z = Math.sin(a) * r; }
      const p = st.t / st.dur;
      st.s.position.set(st.x + Math.sin(T * .7 + st.dur) * .25 * p, BROTH_Y + .1 + p * 3.4, st.z);
      st.s.scale.setScalar(.7 + p * 2.2); st.s.material.opacity = Math.sin(p * Math.PI) * .11 * Math.min(boil, 1.8);
    }
    for (const f of floaters) {
      if (f.flying) continue;
      f.a += f.sp * dt;
      f.g.position.set(Math.cos(f.a) * f.r, BROTH_Y + .03 + Math.sin(T * 1.6 + f.ph) * .025, Math.sin(f.a) * f.r);
      f.g.rotation.y += f.spin * dt;
    }
    seats.forEach((s, r) => {
      s.hop = Math.max(0, s.hop - dt * 2.2);
      s.av.position.y = -.2 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .5 * s.hop + (s.active ? Math.abs(Math.sin(T * 3)) * .08 : 0);
      s.av.userData.head.rotation.z = Math.sin(T * 1.3 + r) * .08;
      s.av.userData.head.rotation.x = Math.sin(T * .9 + r * 2) * .04;
      const blink = (T + r * 1.37) % 3.8 < .13 ? .12 : 1;
      for (const e of s.av.userData.eyes) e.scale.y = e.userData.sy * blink;
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1 + Math.sin(T * 4) * .05);
      const hv = hover?.tile === r; s.hover += ((hv ? 1 : 0) - s.hover) * .2;
      s.halo.material.opacity += ((s.take ? .55 + Math.sin(T * 5) * .3 : 0) - s.halo.material.opacity) * .2;
      s.tile.position.y = .08 + (s.take ? .06 + Math.sin(T * 4 + r) * .04 : 0) + s.hover * .12;
      s.tile.scale.x = s.tile.scale.z = s.bs * s.sq * (1 + s.hover * .1);
    });
    deckHover += ((hover?.deck ? 1 : 0) - deckHover) * .2;
    potHalo.material.opacity += ((deckActive ? .65 + Math.sin(T * 5) * .3 : 0) - potHalo.material.opacity) * .2;
    potHalo.scale.setScalar(1 + deckHover * .05 + (deckActive ? Math.sin(T * 4) * .015 : 0));
    if (deckActive) boil = Math.max(boil, 1.6 + deckHover);
    bulbs.forEach((b, i) => b.scale.setScalar(1 + Math.sin(T * 2 + i) * .12));
    glow.intensity = 4.5 + Math.sin(T * 7) * .6 + Math.sin(T * 11.3) * .4;
    shake = Math.max(0, shake - dt * 2);
    camera.position.set(camBase.x + Math.sin(T * .25) * .2 + (Math.random() - .5) * shake * .3, camBase.y + Math.sin(T * .4) * .06, camBase.z);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  };
  loop();

  // ---------- API ----------
  return {
    setSeats(list, turnRel) {
      list.forEach((p, r) => {
        const s = seats[r];
        const key = p.color + '|' + (p.av || []).join('.');
        if (key !== s.key) {
          s.key = key;
          const [x, z] = SEAT[r];
          scene.remove(s.av);
          s.av = avatar(p.color, p.av); s.av.position.set(x, -.2, z); s.av.lookAt(0, -.2, 0); s.av.visible = r !== 0; scene.add(s.av);
          s.bowl.material.color.set(p.color); s.plate.material.color.set(p.color);
        }
        s.active = r === turnRel;
      });
    },
    setTiles(list) {
      list.forEach((t, r) => {
        const s = seats[r];
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
      const toTile = typeof to === 'string' && to.startsWith('tile') ? seats[+to.slice(4)] : null;
      if (toTile) { toTile.pending++; toTile.top.visible = false; }
      const fromPot = from === 'deck';
      if (fromPot) { popIngredient(kind); puff(new THREE.Vector3(0, BROTH_Y + .1, 0), 7, .9); boil = 3; }
      flyCard(P(from), P(to), kind, faceUp && kind >= 0, 0, () => {
        if (toTile) {
          toTile.pending = Math.max(0, toTile.pending - 1);
          if (!toTile.pending && toTile.c >= 0) toTile.top.visible = true;
          squash(toTile); puff(tilePos(+to.slice(4)), 6, .5);
        }
      }, fromPot);
    },
    hop(r) { seats[r].hop = 1; },
    deal() { boil = 3; for (let i = 0; i < 16; i++) flyCard(deckPos(), handPos(i % 4), -1, false, i * .05, undefined, true); },
    celebrate(r, hand) {
      const from = r === 0 ? new THREE.Vector3(0, 1.4, 4.4) : handPos(r);
      (hand.length ? hand : Array.from({ length: 9 }, () => Math.random() * 72 | 0)).forEach((c, i) => hopIngredient(kindOf(c), from, i * 110));
      seats[r].hop = 1; setTimeout(() => { seats[r].hop = 1; }, 600);
      shake = 1; boil = 4;
      setTimeout(() => puff(new THREE.Vector3(0, BROTH_Y + .2, 0), 14, 2), 1000);
    },
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick);
      renderer.dispose();
    },
  };
}

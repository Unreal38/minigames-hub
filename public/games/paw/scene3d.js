// Pawperty 3D board (three.js): a square ring of pet shops on a sky island. Every shop has its Pet Farm pet:
// in a cardboard box while it waits to be adopted, out on the tile once somebody owns it (and it grows with
// each upgrade). Avatars walk the ring as tokens. Purely visual: it draws what the server sends.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, DOT, HEART, nightScene, disposeToon } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { diceKit } from '../../dice3d.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { petModel } from '../farm/pets3d.js';
import { L } from '../../i18n.js';
import { N, GRID, TILES, GROUPS, SHOP_TILES, cellOf, sideOf, isCorner, BATH, LOST, MUD, START, MS } from './board.js';

const INK = '#4a2c22', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const FEET = .76 * .6; // a standing avatar's feet are .76 below its middle, at token size (TOK)
const CELL = 2.2, HALF = CELL * GRID / 2, TOK = .6, PET = .6, PX = 256;
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const FD = () => (getComputedStyle(document.body).getPropertyValue('--fd') || 'sans-serif').trim();

// ---------- where things are ----------
const centre = i => { const [c, r] = cellOf(i); return new THREE.Vector3((c - (GRID - 1) / 2) * CELL, 0, ((GRID - 1) / 2 - r) * CELL); };
const OUT = [[0, 1], [-1, 0], [0, -1], [1, 0]];
function outDir(i) {
  const s = sideOf(i), a = OUT[s];
  if (!isCorner(i)) return new THREE.Vector3(a[0], 0, a[1]);
  const b = OUT[(s + 3) % 4]; return new THREE.Vector3(a[0] + b[0], 0, a[1] + b[1]).normalize();
}
const CEN = Array.from({ length: N }, (_, i) => centre(i)), DIR = Array.from({ length: N }, (_, i) => outDir(i));
const TAN = DIR.map(d => new THREE.Vector3(d.z, 0, -d.x));
const lane = i => CEN[i].clone().addScaledVector(DIR[i], isCorner(i) ? -.3 : -.5); // where tokens walk
const TUB = CEN[BATH].clone().addScaledVector(DIR[BATH], .62);

// ---------- the board picture: one canvas for every tile ----------
function boardTexture() {
  // drawn in units of PX a tile, on a canvas no bigger than 2048 so phones can hold it
  const S = PX * GRID, R = Math.min(2048, S), cv = document.createElement('canvas'); cv.width = cv.height = R;
  const g = cv.getContext('2d'), fd = FD(); g.scale(R / S, R / S);
  const paw = (x, y, r, rot, col) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col;
    g.beginPath(); g.ellipse(0, r * .25, r * .62, r * .5, 0, 0, 7); g.fill();
    for (const [dx, dy] of [[-.62, -.3], [-.22, -.68], [.22, -.68], [.62, -.3]]) { g.beginPath(); g.ellipse(dx * r, dy * r, r * .2, r * .26, dx * .5, 0, 7); g.fill(); }
    g.restore(); };
  const text = (t, x, y, px, fill = INK, stroke = '', lw = 8, align = 'center') => { g.font = `700 ${px}px ${fd}`; g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(t, x, y); } g.fillStyle = fill; g.fillText(t, x, y); };
  // the lawn in the middle
  g.fillStyle = '#a5dc86'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 44; i++) { const a = i * 2.39996, r = 150 + (i % 9) * 92; paw(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r * .9, 34 + (i % 3) * 10, a, '#98d279'); }
  g.save(); g.translate(S / 2, S / 2 - 110); g.rotate(-.06);
  text('Pawperty', 0, 0, 350, '#fff6e4', INK, 46); g.restore();
  paw(S / 2 + 740, S / 2 + 150, 84, .4, '#ffb547'); paw(S / 2 - 760, S / 2 + 180, 70, -.5, '#ff8fab');
  text(L('adopt · upgrade · nap', 'adopcje · ulepszenia · drzemki'), S / 2, S / 2 + 150, 86, '#3f7a3a');

  for (const t of TILES) {
    const [c, r] = cellOf(t.i), x = c * PX, y = (GRID - 1 - r) * PX, side = sideOf(t.i), cx = x + PX / 2, cy = y + PX / 2;
    g.save(); g.beginPath(); g.roundRect(x + 7, y + 7, PX - 14, PX - 14, 30); g.clip();
    g.fillStyle = t.k === 'shop' ? '#fff6e4' : t.k === 'zoom' ? '#ffe2ef' : t.k === 'vet' ? '#e3f4ff' : t.k === 'bowl' ? '#ffe9c4' : t.k === 'bath' ? '#cdeeff' : t.k === 'mud' ? '#e9cfa6' : t.k === 'lost' ? '#fff0b8' : '#d9f5c4';
    g.fillRect(x, y, PX, PX);
    if (t.k === 'shop') {
      const G = GROUPS[t.g], B = 60; g.fillStyle = G.col;
      if (isCorner(t.i)) {} else if (side === 0) g.fillRect(x, y, PX, B); else if (side === 2) g.fillRect(x, y + PX - B, PX, B); else if (side === 1) g.fillRect(x + PX - B, y, B, PX); else g.fillRect(x, y, B, PX);
      paw(cx, cy, 56, .2, '#f6e6cc');
      const bx = side === 1 ? x + PX - B / 2 : side === 3 ? x + B / 2 : cx, by = side === 0 ? y + B / 2 + 2 : side === 2 ? y + PX - B / 2 + 2 : cy;
      // on the left and right sides the band is narrow, so the price runs along it
      g.save(); g.translate(bx, by); if (side % 2) g.rotate(side === 1 ? Math.PI / 2 : -Math.PI / 2); text(String(t.price), 0, 0, 40, '#fff', G.ink, 8); g.restore();
    } else if (t.k === 'zoom') { text('?', cx, cy - 22, 150, '#ff5d92', '#fff', 14); text(L('Zoomies!', 'Głupawka!'), cx, cy + 82, L(44, 38), '#b02a5c'); }
    else if (t.k === 'vet') { g.fillStyle = '#e5543b'; g.beginPath(); g.roundRect(cx - 22, cy - 86, 44, 124, 10); g.roundRect(cx - 62, cy - 46, 124, 44, 10); g.fill(); text(L('Vet Visit', 'Weterynarz'), cx, cy + 82, L(42, 38), '#14507a'); }
    else if (t.k === 'bowl') { g.fillStyle = '#d9a066'; for (const [dx, dy] of [[-40, -44], [0, -62], [40, -44], [-20, -34], [22, -30]]) { g.beginPath(); g.arc(cx + dx, cy + dy, 24, 0, 7); g.fill(); }
      g.fillStyle = '#4db5ff'; g.beginPath(); g.moveTo(cx - 84, cy - 30); g.lineTo(cx + 84, cy - 30); g.lineTo(cx + 62, cy + 36); g.lineTo(cx - 62, cy + 36); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
      text(L('Treat Bowl', 'Miska'), cx, cy + 82, 40, '#8a4a10'); }
    else if (t.k === 'start') { text(L('Welcome', 'Wycieraczka'), cx - 12, cy - L(88, 68), L(44, 34), '#2f6b2a'); text(L('Mat', ''), cx - 12, cy - 46, 44, '#2f6b2a'); }
    else if (t.k === 'bath') { text(L('Bath', 'Kąpiel'), cx + 30, cy - L(88, 68), 46, '#14507a'); text(L('Time', ''), cx + 30, cy - 46, 46, '#14507a'); }
    else if (t.k === 'lost') { text(L('Lost &', 'Znalezione'), cx + 24, cy + L(50, 72), L(46, 36), '#8a5a10'); text(L('Found', ''), cx + 24, cy + 92, 46, '#8a5a10'); }
    else if (t.k === 'mud') { g.fillStyle = '#9a6a3c'; for (const [dx, dy, rr] of [[10, -30, 80], [-50, -60, 46], [68, -50, 52], [20, -84, 44]]) { g.beginPath(); g.ellipse(cx + dx, cy + dy, rr, rr * .7, 0, 0, 7); g.fill(); } text(L('Muddy', 'Błotna'), cx - 20, cy + 58, 42, '#5b3a1c', '#e9cfa6', 6); text(L('Puddle', 'kałuża'), cx - 20, cy + 98, 42, '#5b3a1c', '#e9cfa6', 6); }
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.roundRect(x + 7, y + 7, PX - 14, PX - 14, 30); g.stroke();
    // shop names sit on the lawn just inside the ring, where no pet or token stands on them
    if (t.k === 'shop') {
      const words = t.name.split(' '), lines = words.length > 1 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : words;
      const px = 44, lh = 46, col = '#2c4a22', halo = '#d6f2c2';
      if (side === 0) lines.forEach((l, k) => text(l, cx, y - 24 - (lines.length - 1 - k) * lh, px, col, halo, 9));
      else if (side === 2) lines.forEach((l, k) => text(l, cx, y + PX + 30 + k * lh, px, col, halo, 9));
      else lines.forEach((l, k) => text(l, side === 1 ? x + PX + 16 : x - 16, cy + (k - (lines.length - 1) / 2) * lh, px, col, halo, 9, side === 1 ? 'left' : 'right'));
    }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}

// ---------- dice ----------
// The dice wear the roller's dice skin (dice3d.js); SIDE_VAL is the value on +x, -x, +y, -y, +z, -z.
const SIDE_VAL = [2, 5, 1, 6, 3, 4];
const UP = [null, [0, 0, 0], [0, 0, Math.PI / 2], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2], [Math.PI, 0, 0]];

// ---------- pets ----------
// A Pet Farm pet is dozens of little meshes. Here up to 18 stand on the board at once, so each one is merged
// into a single vertex-coloured mesh (plus its outline and any glowing or see-through bits).
const _m4 = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _v = new THREE.Vector3();
const VC = () => toonMat(new THREE.MeshStandardMaterial({ vertexColors: true }));
function squash(root) {
  root.updateWorldMatrix(true, true); _inv.copy(root.matrixWorld).invert();
  const buckets = new Map(), gone = [];
  root.traverse(m => {
    if (!m.isMesh || m.userData.ink) return;
    const mt = m.material;
    if (Array.isArray(mt) || mt.map || mt.vertexColors) return;
    // plain painted parts share one vertex-coloured mesh; glowing or see-through ones are merged per material
    const special = mt.transparent || (mt.emissiveIntensity > 0 && mt.emissive?.getHex()), key = special ? mt.uuid : 'plain';
    let bk = buckets.get(key); if (!bk) buckets.set(key, bk = { parts: [], n: 0, mat: special ? mt : null });
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    _m4.multiplyMatrices(_inv, m.matrixWorld); g.applyMatrix4(_m4);
    if (!g.attributes.normal) g.computeVertexNormals();
    bk.parts.push([g.attributes.position.array, g.attributes.normal.array, mt.color, _m4.determinant() < 0]); bk.n += g.attributes.position.count; g.dispose(); gone.push(m);
  });
  for (const m of gone) { if (m.children.length) m.geometry = EMPTY; else m.parent.remove(m); }
  for (const { parts, n, mat } of buckets.values()) {
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = mat ? null : new Float32Array(n * 3); let o = 0;
    for (const [p, q, c, flip] of parts) {
      pos.set(p, o); nor.set(q, o);
      if (flip) for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { let a = pos[o + i + 3 + k]; pos[o + i + 3 + k] = pos[o + i + 6 + k]; pos[o + i + 6 + k] = a; a = nor[o + i + 3 + k]; nor[o + i + 3 + k] = nor[o + i + 6 + k]; nor[o + i + 6 + k] = a; }
      if (col) for (let i = 0; i < p.length; i += 3) { col[o + i] = c.r; col[o + i + 1] = c.g; col[o + i + 2] = c.b; }
      o += p.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(g, mat || VC()); mesh.userData.mine = true; mesh.castShadow = !mat; root.add(mesh);
  }
  return root;
}
const EMPTY = new THREE.BufferGeometry();
function freePet(g) { g.traverse(m => { if (m.isMesh && (m.userData.mine || m.userData.ink)) m.geometry.dispose(); }); }
function makePet(sp, form) { return squash(petModel(sp, form)); }

// ---------- little props ----------
const box = (p, w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y + h / 2, z); p.add(m); return m; };
const cyl = (p, rt, rb, h, seg, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c)); m.position.set(x, y + h / 2, z); p.add(m); return m; };
const ball = (p, r, c, x = 0, y = 0, z = 0, d = 1) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, d), M(c)); m.position.set(x, y, z); p.add(m); return m; };
const done = (g, ink = .03) => { bake(g); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return toonify(g, ink); };
function crate() { // the box a pet waits in until someone adopts it
  const g = new THREE.Group(), c = '#d2a56e', d = '#b98a55';
  box(g, .9, .06, .9, d); for (const [x, z, w, dd] of [[0, .43, .9, .05], [0, -.43, .9, .05], [.43, 0, .05, .9], [-.43, 0, .05, .9]]) box(g, w, .42, dd, c, x, .04, z);
  const f1 = box(g, .44, .04, .3, c, -.24, .44, .58); f1.rotation.x = .9; const f2 = box(g, .44, .04, .3, c, .24, .44, .58); f2.rotation.x = .7;
  box(g, .3, .16, .02, '#fff6e4', 0, .16, .465); ball(g, .05, '#ff5d92', 0, .24, .48, 0);
  return done(g);
}
function upgradeProp(lv, col) {
  const g = new THREE.Group();
  if (lv === 1) { cyl(g, .42, .46, .14, 12, col); cyl(g, .3, .3, .08, 12, '#fff6e4', 0, .1, 0); const p = ball(g, .14, '#fff6e4', -.1, .22, .05); p.scale.set(1.3, .7, 1); }
  else if (lv === 2) { cyl(g, .42, .46, .14, 12, col, -.05, 0, .32); cyl(g, .3, .3, .08, 12, '#fff6e4', -.05, .1, .32);
    box(g, .6, .42, .44, '#c58a52', .1, 0, -.3); box(g, .64, .08, .48, '#8a5a3c', .1, .42, -.3).rotation.x = -.25; ball(g, .16, '#e5543b', -.08, .6, -.3); ball(g, .12, '#ffc93c', .22, .56, -.26); box(g, .12, .12, .12, '#4db5ff', .3, .5, -.4).rotation.y = .5; }
  else { box(g, .95, .7, .8, '#fff6e4', 0, 0, -.1); const roof = new THREE.Mesh(new THREE.ConeGeometry(.78, .5, 4), M(col)); roof.position.set(0, .95, -.1); roof.rotation.y = Math.PI / 4; g.add(roof);
    for (const x of [-.52, .52]) { cyl(g, .16, .18, 1.0, 8, '#fff6e4', x, 0, .25); const t = new THREE.Mesh(new THREE.ConeGeometry(.24, .36, 8), M(col)); t.position.set(x, 1.18, .25); g.add(t); }
    box(g, .3, .42, .04, '#8a5a3c', 0, 0, .31); cyl(g, .02, .02, .5, 5, '#8a5a3c', 0, 1.2, -.1); box(g, .26, .16, .02, '#ffc93c', .14, 1.52, -.1); ball(g, .07, '#ffc93c', 0, 1.2, -.1, 0); }
  return done(g, .035);
}

export function createScene(canvas, { onFrame, onStep, onThumbs } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 200);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 600);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.55); sun.position.set(9, 20, 11); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); { const e = HALF * 1.55; Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 70 }); }
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .04; scene.add(sun);

  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 34, max: 120, below: -14 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(HALF * 2 + 1.4, HALF * 2 + 1.4, { seed: 11, props: 20, rim: 2.6, size: 1.7, flowers: 60 }); land.position.y = -.5; scene.add(land);
  const flyBirds = birds(scene, 60, 15, 4, 1.8), drift = petals(scene, 30, 6, { n: small ? 6 : 12 });
  const pfx = createFx(scene), shake = shaker();

  // ---------- the board ----------
  const room = new THREE.Group(); scene.add(room);
  const boardMap = boardTexture();
  const topMat = toonMat(new THREE.MeshStandardMaterial({ map: boardMap, roughness: .9 }));
  { const slab = new THREE.Group(); box(slab, HALF * 2 + .5, .5, HALF * 2 + .5, '#c58a52', 0, -.5, 0); done(slab, .05); slab.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); room.add(slab);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), topMat); top.rotation.x = -Math.PI / 2; top.position.y = .004; top.receiveShadow = true; room.add(top); }
  document.fonts?.ready.then(() => { if (dead) return; const t = boardTexture(); topMat.map.dispose(); topMat.map = t; topMat.needsUpdate = true; }); // redraw once the display font has loaded

  // corner props
  const deco = new THREE.Group(); room.add(deco);
  const at = (g, p, ry = 0) => { g.position.copy(p); g.rotation.y = ry; deco.add(g); return g; };
  { // Welcome Mat: a mat, a signpost and a bowl of treats
    const g = new THREE.Group(); cyl(g, .05, .06, 1.5, 6, '#8a5a3c', .25, 0, 0); box(g, .8, .32, .06, '#fff6e4', .25, 1.05, .02); box(g, .5, .08, .07, '#5fd08a', .22, 1.17, .03); box(g, .2, .2, .07, '#5fd08a', -.02, 1.11, .03).rotation.z = Math.PI / 4;
    cyl(g, .3, .22, .16, 10, '#4db5ff', -.4, 0, .15); for (let k = 0; k < 5; k++) ball(g, .09, '#d9a066', -.4 + Math.cos(k * 1.3) * .13, .2 + (k % 2) * .06, .15 + Math.sin(k * 1.3) * .13, 0);
    at(done(g), CEN[START].clone().addScaledVector(DIR[START], .75), -.5); }
  { // Bath Time: a tub with a rubber duck
    const g = new THREE.Group(); cyl(g, .82, .68, .5, 14, '#fff6e4'); { const r = new THREE.Mesh(new THREE.TorusGeometry(.8, .08, 6, 16), M('#ffd0e4')); r.rotation.x = Math.PI / 2; r.position.y = .52; g.add(r); }
    for (const [x, z] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) ball(g, .1, '#ffc93c', x, .04, z, 0);
    at(done(g), TUB);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(.74, .74, .04, 14), toonMat(M('#8fd4ff'))); water.position.copy(TUB).setY(.5); deco.add(water);
    const duck = new THREE.Group(); ball(duck, .13, '#ffd84a', 0, .1, 0); ball(duck, .09, '#ffd84a', .08, .24, 0); box(duck, .08, .03, .06, '#ff9f43', .18, .21, 0); done(duck, .02); duck.position.copy(TUB).add(_v.set(.4, .5, .28)); deco.add(duck); deco.userData.duck = duck; }
  const jarFill = new THREE.Mesh(new THREE.CylinderGeometry(.46, .46, 1, 12), toonMat(M('#d9a066')));
  { // Lost & Found: a big glass jar that fills with treats
    const g = new THREE.Group(); cyl(g, .6, .6, .08, 12, '#8a5a3c'); cyl(g, .5, .5, .1, 12, '#e5543b', 0, 1.1, 0); ball(g, .1, '#e5543b', 0, 1.25, 0, 0);
    const p = CEN[LOST].clone().addScaledVector(DIR[LOST], .6); at(done(g), p);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(.54, .54, 1.04, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide })); glass.position.copy(p).setY(.6); deco.add(glass);
    jarFill.position.copy(p); jarFill.castShadow = true; deco.add(jarFill); }
  { // Muddy Puddle: a few splashes and a welly
    const g = new THREE.Group(); for (const [x, z, r] of [[0, 0, .2], [.5, .3, .14], [-.4, .4, .12], [-.2, -.5, .16]]) { const b = ball(g, r, '#9a6a3c', x, r * .5, z); b.scale.y = .6; }
    cyl(g, .16, .18, .5, 8, '#ffc93c', .5, 0, -.4); box(g, .2, .16, .4, '#ffc93c', .5, 0, -.26);
    at(done(g), CEN[MUD].clone().addScaledVector(DIR[MUD], .45)); }

  // ---------- shops: a pet, the box it waits in, the owner's frame and what has been built ----------
  // every waiting pet's box is the same model: two instanced meshes (the box and its outline) draw all of them
  const crateProto = crate(), crates = [];
  crateProto.traverse(m => { if (m.isMesh) { const im = new THREE.InstancedMesh(m.geometry, m.material, SHOP_TILES.length); im.receiveShadow = true; im.frustumCulled = false; room.add(im); crates.push(im); } });
  const _cm = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const showCrate = (k, at, on) => { for (const im of crates) { im.setMatrixAt(k, on ? _cm.makeScale(.95, .95, .95).setPosition(at.x, 0, at.z) : ZERO); im.instanceMatrix.needsUpdate = true; } };
  const frameGeo = (() => { const s = new THREE.Shape(), a = CELL / 2 - .06, b = a - .2; s.moveTo(-a, -a); s.lineTo(a, -a); s.lineTo(a, a); s.lineTo(-a, a); s.closePath();
    const h = new THREE.Path(); h.moveTo(-b, -b); h.lineTo(-b, b); h.lineTo(b, b); h.lineTo(b, -b); h.closePath(); s.holes.push(h);
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; })();
  const zTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.font = `700 54px ${FD()}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const [t, x, y, px] of [['Z', 86, 34, 62], ['z', 54, 76, 46], ['z', 32, 106, 32]]) { g.font = `700 ${px}px sans-serif`; g.strokeStyle = '#3b2a6b'; g.lineWidth = 9; g.strokeText(t, x, y); g.fillStyle = '#ffffff'; g.fillText(t, x, y); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const zMat = new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false });
  const shops = new Map();
  for (const i of SHOP_TILES) {
    const t = TILES[i], spot = CEN[i].clone().addScaledVector(DIR[i], .5), side = sideOf(i);
    const petAt = spot.clone().addScaledVector(TAN[i], side === 0 || side === 2 ? 0 : 0), propAt = spot.clone();
    // side by side along the edge of the board: pet on the left as you look at it, what was built on the right
    const along = side % 2 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    petAt.addScaledVector(along, -.48); propAt.addScaledVector(along, .5);
    const hold = new THREE.Group(); hold.position.copy(petAt); room.add(hold);
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' })); frame.position.copy(CEN[i]).setY(.02); frame.visible = false; room.add(frame);
    const zz = new THREE.Sprite(zMat); zz.scale.setScalar(.9); zz.visible = false; room.add(zz);
    shops.set(i, { t, k: shops.size, hold, pet: null, key: '', frame, zz, prop: null, propLv: 0, propAt, petAt, own: -1, nap: 0, napOn: false, hop: 0, seed: i * 1.7 });
  }
  function setShop(i, own, lv, nap, col) {
    const s = shops.get(i), form = own < 0 ? 0 : lv >= 3 ? 2 : lv >= 1 ? 1 : 0, key = s.t.pet + form;
    if (key !== s.key) {
      if (s.pet) { s.hold.remove(s.pet); freePet(s.pet); }
      s.pet = makePet(s.t.pet, form); s.key = key; s.hold.add(s.pet); s.base = s.pet.scale.x * PET * (form === 0 ? 1.25 : form === 1 ? 1.1 : 1);
      s.pet.scale.setScalar(s.base);
    }
    if (own !== s.own) {
      if (s.own !== -2 && own >= 0 && S) { s.hop = 1; pfx.burst(_v.copy(s.petAt).setY(.8), { n: 14, colors: ['#ff8fab', '#ffffff', col], shape: HEART, speed: 2, up: 3, size: .3 }); }
      s.own = own; showCrate(s.k, s.petAt, own < 0); s.frame.visible = own >= 0; if (own >= 0) s.frame.material.color.set(col);
    } else if (own >= 0) s.frame.material.color.set(col);
    if (lv !== s.propLv) {
      if (s.prop) { room.remove(s.prop); disposeToon(s.prop); s.prop = null; }
      if (lv > 0) { s.prop = upgradeProp(lv, GROUPS[s.t.g].col); s.prop.position.copy(s.propAt); s.prop.scale.setScalar(lv === 3 ? .78 : .8); room.add(s.prop);
        if (S) { s.hop = 1; pfx.puff(_v.copy(s.propAt).setY(.1), { n: 12, size: .4 }); pfx.burst(_v.copy(s.propAt).setY(.9), { n: 12, colors: ['#ffd84a', '#ffffff'], speed: 2.4, up: 3.4, size: .26 }); } }
      s.propLv = lv;
    }
    s.napOn = !!nap && own >= 0;
  }

  // ---------- dice ----------
  const kit = diceKit({ side: SIDE_VAL }), dieGeo = kit.geo(0, .62);
  const dieMat = kit.mat(0), inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const dice = [0, 1].map(k => { const m = new THREE.Mesh(dieGeo, dieMat); m.castShadow = true; const o = new THREE.Mesh(dieGeo, inkMat); o.scale.setScalar(1.1); m.add(o); m.position.set(k ? .6 : -.6, .31, 2.6); m.visible = false; scene.add(m); return { m, v: 1, q: new THREE.Quaternion(), yaw: k * .7 }; });
  let rollN = -1, rollAt = 0, rollFrom = new THREE.Vector3();
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _yq = new THREE.Quaternion(), YUP = new THREE.Vector3(0, 1, 0);

  // the tile the game is asking about (or the one you tapped)
  const markMat = new THREE.MeshBasicMaterial({ color: '#3b2219', transparent: true, opacity: .9, depthWrite: false });
  const mark = new THREE.Mesh(frameGeo, markMat); mark.visible = false; mark.renderOrder = 3; scene.add(mark);
  let markTile = -1;
  // where the roll leads: the tile lights up in the roller's colour, an arrow bobs over it and dots mark the way
  const aimMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const aimFrame = new THREE.Mesh(new THREE.PlaneGeometry(CELL - .2, CELL - .2).rotateX(-Math.PI / 2), aimMat); aimFrame.renderOrder = 2; aimFrame.visible = false; scene.add(aimFrame);
  const aimPin = new THREE.Group(); { const cg = new THREE.ConeGeometry(.5, .85, 4).rotateX(Math.PI); const c = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: '#ffffff' })); const o = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })); o.scale.setScalar(1.22); aimPin.add(c, o); aimPin.userData.c = c; } aimPin.visible = false; scene.add(aimPin);
  const AIM_DOTS = 12, dotGeo = new THREE.CircleGeometry(.2, 14).rotateX(-Math.PI / 2), dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const aimDots = new THREE.InstancedMesh(dotGeo, dotMat, AIM_DOTS); aimDots.frustumCulled = false; aimDots.renderOrder = 2; aimDots.visible = false; scene.add(aimDots);
  let aimA = 0, aimTile = -1;

  // ---------- tokens ----------
  let toks = [], seatKey = '', me = -1, S = null;
  const ringGeo = new THREE.TorusGeometry(.42, .05, 6, 28); ringGeo.rotateX(Math.PI / 2);
  // soft round shadows under tokens and pets: far cheaper than drawing every avatar into the shadow map
  const blobGeo = new THREE.CircleGeometry(.34, 20); blobGeo.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: '#2b3a1a', transparent: true, opacity: .26, depthWrite: false });
  const arrow = youArrow(); arrow.visible = false; arrow.scale.setScalar(.8); scene.add(arrow);
  function freeTok(t) { scene.remove(t.g, t.ring, t.blob); disposeAvatar(t.av); t.ring.material.dispose(); }
  function buildToks(list) {
    for (const t of toks) freeTok(t);
    toks = list.map((p, i) => {
      const g = new THREE.Group(), av = avatar3d(p.color, p.av, { pose: 'stand' }); av.scale.setScalar(1); const sc = new THREE.Group(); sc.scale.setScalar(TOK); sc.position.y = FEET; sc.add(av); g.add(sc); // lifted so the shoes stand on the board
      av.traverse(m => { if (m.isMesh) m.castShadow = false; });
      const blob = new THREE.Mesh(blobGeo, blobMat); scene.add(blob);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0, depthWrite: false })); scene.add(g, ring);
      return { g, av, ring, blob, key: p.color + (p.av || []).join(''), tile: p.pos, bath: p.inBath, anim: null, mvN: p.mv?.n || 0, step: -1, ph: i * 2, walk: 0, hop: 0, yaw: 0, placed: false, at: new THREE.Vector3() };
    });
  }
  // where seat i stands on its tile, sharing it with whoever else is there
  const want = new THREE.Vector3();
  function slot(i) {
    const p = S.seats[i], tile = p.pos;
    if (p.inBath) return want.copy(TUB).setY(.3 - FEET).addScaledVector(TAN[BATH], (S.seats.slice(0, i).filter(x => x.inBath).length - (S.seats.filter(x => x.inBath).length - 1) / 2) * .5);
    const here = S.seats.map((x, k) => k).filter(k => S.seats[k].pos === tile && !S.seats[k].inBath && !toks[k]?.anim), k = Math.max(0, here.indexOf(i)), m = Math.max(1, here.length);
    const perRow = m > 4 ? 3 : m, row = Math.floor(k / perRow), inRow = Math.min(perRow, m - row * perRow), col = k % perRow;
    return want.copy(lane(tile)).addScaledVector(TAN[tile], (col - (inRow - 1) / 2) * (isCorner(tile) ? .5 : .46)).addScaledVector(DIR[tile], -row * .5);
  }

  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|');
    const first = !S || st.gid !== S.gid;
    if (first) { for (const s of shops.values()) { s.own = -2; s.propLv = -1; } S = null; }
    if (key !== seatKey || first) { seatKey = key; buildToks(list); }
    me = st.me;
    for (const i of SHOP_TILES) setShop(i, st.own[i], st.lv[i], st.nap[i], st.own[i] >= 0 ? list[st.own[i]].color : '#fff');
    S = st;
    const now = performance.now();
    list.forEach((p, i) => {
      const t = toks[i]; if (!t) return;
      if (p.mv && p.mv.n !== t.mvN) { t.mvN = p.mv.n; if (p.mv.ago < p.mv.ms + 600 && t.placed) t.anim = { path: p.mv.path, t0: now - p.mv.ago, ms: p.mv.ms, jump: p.mv.jump }; t.step = -1; }
      if (!t.placed) { t.placed = true; t.g.position.copy(slot(i)); }
    });
    if (st.roll && st.roll.n !== rollN) {
      rollN = st.roll.n;
      if (st.roll.ago < MS.roll + 400) { rollAt = now - st.roll.ago; rollFrom.copy(toks[st.roll.s]?.g.position || new THREE.Vector3()).setY(1.2); }
      const skin = list[st.roll.s]?.fl?.dc | 0;
      dice.forEach((d, k) => { d.v = st.roll.d[k]; d.m.visible = true; kit.dress(d.m, skin, .62); d.yaw += 1.3 + k; d.q.setFromEuler(_e.set(...UP[d.v])).premultiply(_yq.setFromAxisAngle(YUP, d.yaw)); if (!rollAt) d.m.quaternion.copy(d.q); });
    }
    const amt = Math.min(1, st.jar / 300); jarFill.scale.y = Math.max(.02, amt); jarFill.position.y = .08 + jarFill.scale.y / 2; jarFill.visible = st.jar > 0;
    setMark(pinned >= 0 ? pinned : st.offer);
  }
  let pinned = -1;
  function setMark(i) { markTile = i; mark.visible = i >= 0; if (i >= 0) mark.position.copy(CEN[i]).setY(.035); }

  // little effects the HUD asks for
  const fxAt = (i, y = 1.2) => (toks[i] ? _v.copy(toks[i].g.position).setY(y) : _v.set(0, y, 0));
  function effect(kind, a = {}) {
    if (kind === 'coins') { pfx.burst(fxAt(a.s), { n: a.n || 12, colors: ['#d9a066', '#ffd84a', '#fff6e4'], shape: DOT, speed: 2.2, up: 3.6, size: .26, life: .8 }); if (toks[a.s]) toks[a.s].hop = 1; }
    else if (kind === 'ouch') { pfx.puff(fxAt(a.s, .1), { n: 10, size: .34 }); shake.kick(.08); }
    else if (kind === 'hearts') { const s = shops.get(a.i); if (s) { s.hop = 1; pfx.burst(_v.copy(s.petAt).setY(.8), { n: 9, colors: ['#ff8fab', '#ff5d92'], shape: HEART, speed: 1.4, up: 2.6, size: .3 }); } }
    else if (kind === 'splash') { pfx.burst(_v.copy(TUB).setY(.6), { n: 26, colors: ['#8fd4ff', '#ffffff', '#cdeeff'], shape: DOT, speed: 3, up: 5, size: .26 }); shake.kick(.12); }
    else if (kind === 'card') { pfx.burst(fxAt(a.s, 1.4), { n: 18, colors: ['#ff8fab', '#ffd84a', '#ffffff', '#c58bff'], shape: STAR, speed: 3, up: 4, size: .28 }); }
    else if (kind === 'party') { const p = fxAt(a.s, 1.6); pfx.confetti(p, { n: 110, w: 5, h: 4, s: a.s }); pfx.burst(p, { n: 24, colors: ['#ffd84a', '#ffffff'], speed: 4, up: 5 }); if (toks[a.s]) toks[a.s].hop = 1; }
    else if (kind === 'jar') { pfx.burst(_v.copy(jarFill.position).setY(1.3), { n: 30, colors: ['#d9a066', '#ffd84a'], shape: DOT, speed: 3.4, up: 5, size: .28 }); }
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 200, hudLeft = 0, hudTop = 110;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, .6);
  const CDIR = new THREE.Vector3(0, 1.22, 1).normalize(), pv = new THREE.Vector3();
  const toPx = p => { pv.copy(p).project(camera); return [(pv.x + 1) / 2 * W, (1 - pv.y) / 2 * H]; };
  function place(D) { camera.position.copy(CDIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    CDIR.set(0, portrait ? 1.9 : 1.22, 1).normalize(); // a tall screen looks down more steeply, so the square board fills more of it
    camera.aspect = w / h; camera.fov = portrait ? 46 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = hudTop, bottom = Math.max(top + 160, h - hudBottom), E = HALF + (portrait ? .1 : .35);
    const FIT = [new THREE.Vector3(0, 1.6, -E), new THREE.Vector3(0, 0, E), new THREE.Vector3(-E, 0, E), new THREE.Vector3(E, 0, E)];
    let lo = 8, hi = 160;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; place(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && rx - lx <= w - hudLeft - 8) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 30; scene.fog.far = hi + 170;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, -hudLeft / 2, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // tap a tile to read about it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function pick(x, y) {
    const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(ground, hit)) return -1;
    const c = Math.floor(hit.x / CELL + GRID / 2), rr = Math.floor(GRID / 2 - hit.z / CELL);
    if (c < 0 || c >= GRID || rr < 0 || rr >= GRID) return -1;
    for (let i = 0; i < N; i++) { const [a, b] = cellOf(i); if (a === c && b === rr) return i; }
    return -1;
  }

  // pictures of the pets for the HUD
  function thumbs() {
    const out = {};
    try {
      const cv = document.createElement('canvas'), R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(128, 128, false);
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 50);
      sc.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9)); const l = new THREE.DirectionalLight('#ffffff', 1.6); l.position.set(3, 6, 4); sc.add(l);
      for (const i of SHOP_TILES) {
        const g = makePet(TILES[i].pet, 1); sc.add(g);
        const bx = new THREE.Box3().setFromObject(g), ctr = bx.getCenter(new THREE.Vector3()), rad = bx.getSize(new THREE.Vector3()).length() / 2, d = rad / Math.sin(15 * Math.PI / 180) * .8;
        cam.position.set(ctr.x + d * .45, ctr.y + d * .36, ctr.z + d * .8); cam.lookAt(ctr); R.render(sc, cam); out[TILES[i].pet] = cv.toDataURL('image/png'); sc.remove(g); freePet(g);
      }
      R.dispose(); R.forceContextLoss?.();
    } catch (e) { console.warn('no pet pictures', e); }
    return out;
  }
  const thumbTimer = setTimeout(() => { if (!dead) onThumbs?.(thumbs()); }, 400);

  // ---------- loop ----------
  let T = 0, dead = false;
  const tv = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
  const info = { toks: [], w: 0, h: 0 };
  const ease = u => u * u * (3 - 2 * u);
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const now = performance.now(), k = 1 - Math.exp(-dt * 10);
    // tokens
    toks.forEach((t, i) => {
      const p = S?.seats[i]; if (!p) return;
      let moving = 0, y = 0, face = null;
      if (t.anim) {
        const a = t.anim, u = (now - a.t0) / a.ms;
        if (u >= 1) { t.anim = null; pfx.puff(tv.copy(t.g.position).setY(.05), { n: 7, size: .26 }); t.hop = .5; if (p.inBath) effect('splash'); }
        else if (u > 0) {
          if (a.jump) { const e = ease(u); pa.copy(lane(a.path[0])); pb.copy(p.inBath ? TUB : lane(a.path[1])); t.g.position.lerpVectors(pa, pb, e); y = Math.sin(u * Math.PI) * 4.2; t.g.rotation.y += dt * 9; }
          else {
            const f = u * (a.path.length - 1), s = Math.min(a.path.length - 2, Math.floor(f)), fr = f - s;
            pa.copy(lane(a.path[s])); pb.copy(lane(a.path[s + 1])); t.g.position.lerpVectors(pa, pb, fr); y = Math.sin(fr * Math.PI) * .32; face = Math.atan2(pb.x - pa.x, pb.z - pa.z); moving = 1;
            if (s !== t.step) { t.step = s; onStep?.(i, a.path[s + 1]); if (s > 0) pfx.puff(tv.copy(pa).setY(.04), { n: 4, size: .18, speed: 1.2 }); }
          }
        }
      }
      if (!t.anim) { t.g.position.lerp(slot(i), k); y = t.g.position.y; t.g.position.y = 0; }
      t.walk += (moving - t.walk) * Math.min(1, dt * 12); t.ph += dt * 13 * t.walk;
      t.hop = Math.max(0, t.hop - dt * 1.9);
      const active = S.ph === 'play' && S.turn === i;
      t.g.position.y = y + Math.abs(Math.sin(t.hop * Math.PI * 2)) * .4 * t.hop;
      if (!(t.anim?.jump)) { const wantYaw = face ?? (p.inBath ? .4 : 0); let d = wantYaw - t.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); t.yaw += d * Math.min(1, dt * 10); t.g.rotation.y = t.yaw; }
      animateAvatar(t.av, T, { seed: i, active: active && !t.walk, hop: t.hop });
      walkAvatar(t.av, t.ph, t.walk);
      t.blob.position.copy(t.g.position).setY(p.inBath ? -5 : .014); t.blob.scale.setScalar(Math.max(.4, 1 - t.g.position.y * .18));
      t.ring.position.copy(t.g.position).setY(.05); t.ring.material.opacity += ((active && !t.anim ? .95 : 0) - t.ring.material.opacity) * .15; t.ring.scale.setScalar(1 + Math.sin(T * 4) * .07);
      const o = info.toks[i] ||= { x: 0, y: 0 }; tv.copy(t.g.position); tv.y += 1.55 + FEET; tv.project(camera); o.x = (tv.x + 1) / 2 * W; o.y = (1 - tv.y) / 2 * H;
    });
    info.toks.length = toks.length; info.w = W; info.h = H;
    // the tile the walking player is heading for, from the moment the dice settle until they arrive
    { const wt = S?.ph === 'play' ? toks[S.turn] : null, a = wt?.anim, on = !!a && !a.jump && a.path.length > 1 && now >= a.t0 - MS.aim;
      if (on) {
        const dest = a.path[a.path.length - 1], col = S.seats[S.turn].color;
        if (dest !== aimTile || !aimA) { aimTile = dest; aimMat.color.set(col); dotMat.color.set(col); aimPin.userData.c.material.color.set(col); aimFrame.position.copy(CEN[dest]).setY(.03); }
        let n = 0; for (let j = Math.max(1, wt.step + 2); j < a.path.length - 1 && n < AIM_DOTS; j++) { const q = lane(a.path[j]); aimDots.setMatrixAt(n++, _cm.makeTranslation(q.x, .03, q.z)); }
        aimDots.count = n; aimDots.instanceMatrix.needsUpdate = true;
      }
      aimA += ((on ? 1 : 0) - aimA) * Math.min(1, dt * (on ? 14 : 6)); if (aimA < .02 && !on) aimA = 0;
      const vis = aimA > 0 && aimTile >= 0; aimFrame.visible = aimPin.visible = aimDots.visible = vis;
      if (vis) { aimMat.opacity = aimA * (.5 + Math.sin(T * 9) * .18); dotMat.opacity = aimA * .9;
        aimPin.position.copy(CEN[aimTile]).setY(2.5 + Math.abs(Math.sin(T * 5)) * .35); aimPin.rotation.y = T * 2.4; aimPin.scale.setScalar(aimA);
        tv.copy(CEN[aimTile]).setY(3.5); tv.project(camera); info.aim = info.aim || {}; info.aim.i = aimTile; info.aim.s = S.turn; info.aim.x = (tv.x + 1) / 2 * W; info.aim.y = (1 - tv.y) / 2 * H; info.aimOn = on; }
      else info.aimOn = false; }
    if (me >= 0 && toks[me] && S?.ph === 'play') { arrow.visible = true; arrow.position.copy(toks[me].g.position); arrow.position.y += 1.5 + FEET; animateArrow(arrow, T); } else arrow.visible = false;
    // pets: breathe, hop when something nice happens, lie down and snore when napping
    for (const s of shops.values()) {
      if (!s.pet) continue;
      s.nap += ((s.napOn ? 1 : 0) - s.nap) * Math.min(1, dt * 4); s.hop = Math.max(0, s.hop - dt * 1.6);
      const b = s.base, br = 1 + Math.sin(T * (s.napOn ? 1.2 : 2.2) + s.seed) * (s.napOn ? .05 : .025);
      s.pet.scale.set(b * (1 + s.nap * .08), b * br * (1 - s.nap * .3), b * (1 + s.nap * .08));
      s.pet.rotation.z = s.nap * .22; s.pet.rotation.y = Math.sin(T * .5 + s.seed) * .25 * (1 - s.nap) + (s.own < 0 ? 0 : -s.petAt.x * .03);
      s.pet.position.y = (s.own < 0 ? .1 : 0) + Math.abs(Math.sin(s.hop * Math.PI * 3)) * .5 * s.hop;
      s.zz.visible = s.nap > .5;
      if (s.zz.visible) { const ph = (T * .5 + s.seed) % 1; s.zz.position.copy(s.petAt); s.zz.position.y = .95 + ph * .5; s.zz.position.x += .3 + ph * .2; s.zz.material.opacity = 1; s.zz.scale.setScalar(.6 + ph * .5); }
    }
    // dice: tossed from the roller, tumbling, then settled on what was rolled
    if (rollAt) {
      const u = Math.min(1, (now - rollAt) / (MS.roll * .9));
      dice.forEach((d, i) => {
        const home = tv.set(i ? .55 : -.55, .31, 2.4 + (i ? .2 : -.1));
        if (u < 1) { d.m.position.lerpVectors(rollFrom, home, ease(u)); d.m.position.y = .31 + Math.sin(u * Math.PI) * 2.6 + Math.abs(Math.sin(u * Math.PI * 3)) * .3 * (1 - u); d.m.rotation.set(now * .012 + i, now * .015, now * .01 + i * 2); if (u > .75) d.m.quaternion.slerp(d.q, (u - .75) * 4); }
        else { d.m.position.copy(home); d.m.quaternion.copy(d.q); }
      });
      if (u >= 1) { rollAt = 0; pfx.ring(tv.set(0, .03, 2.4), { color: '#ffffff', size: 1.6 }); if (S?.roll?.dbl) pfx.burst(tv.set(0, .8, 2.4), { n: 16, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4 }); }
    }
    if (mark.visible) { markMat.opacity = .6 + Math.sin(T * 5) * .4; mark.scale.setScalar(1.05 + Math.sin(T * 5) * .03); }
    const duck = deco.userData.duck; if (duck) { duck.position.y = .52 + Math.sin(T * 2) * .03; duck.rotation.y = T * .4; }
    if (S?.seats.some(p => p.inBath) && Math.random() < dt * 5) pfx.rise(tv.copy(TUB).setY(.7).add(pa.set(Math.random() - .5, 0, Math.random() - .5)), { color: ['#ffffff', '#cdeeff'], size: .2, life: 1.2, speed: .9, wobble: .5, shape: DOT, grow: .6 });

    cloudRing.rotation.y = T * .005; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .2) * .25), camBase.y + (reduced ? 0 : Math.sin(T * .33) * .08), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, effect, pick,
    pin(i) { pinned = i; setMark(i >= 0 ? i : (S?.offer ?? -1)); },
    tileXY(i) { tv.copy(CEN[i]).setY(.6); const [x, y] = toPx(tv); return { x, y }; },
    stats: () => { const n = o => { let k = 0; o.traverse(m => { if (m.isMesh && m.visible && m.geometry.attributes.position) k++; }); return k; };
      return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: ticker.fps(), toks: toks.reduce((a, t) => a + n(t.g), 0), pets: [...shops.values()].reduce((a, x) => a + n(x.hold), 0), land: n(land), room: n(room) }; },
    setHud(bottom, left = 0, top = 110) { if (Math.abs(bottom - hudBottom) > 6 || left !== hudLeft || top !== hudTop) { hudBottom = bottom; hudLeft = left; hudTop = top; resize(true); } },
    dispose() {
      dead = true; ticker.stop(); clearTimeout(thumbTimer);
      for (const t of toks) { disposeAvatar(t.av); t.ring.material.dispose(); }
      for (const s of shops.values()) { if (s.pet) freePet(s.pet); s.frame.material.dispose(); if (s.prop) disposeToon(s.prop); }
      disposeArrow(arrow); disposeToon(crateProto); disposeToon(deco); disposeToon(land);
      pfx.dispose(); blobGeo.dispose(); blobMat.dispose(); for (const im of crates) im.dispose(); kit.dispose(); inkMat.dispose(); frameGeo.dispose(); ringGeo.dispose(); zTex.dispose(); zMat.dispose(); markMat.dispose(); aimFrame.geometry.dispose(); aimMat.dispose(); aimPin.traverse(m => { if (m.isMesh) m.material.dispose(); }); aimPin.userData.c.geometry.dispose(); dotGeo.dispose(); dotMat.dispose(); aimDots.dispose();
      topMat.map?.dispose(); topMat.dispose(); jarFill.geometry.dispose();
      renderer.dispose();
    },
  };
}

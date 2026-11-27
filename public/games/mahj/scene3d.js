// Pet Mahjong 3D board (three.js): chunky tiles stacked on a tray on a sky island, with the players' avatars
// standing behind it. Purely visual: the client tells it which tiles are on the board and which pair was taken.
// Every tile is one instance of three instanced meshes (body, outline, picture), so a full board of 144 tiles is
// three draw calls and holds 60 frames a second on phones.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, nightScene, isNight, flat, disposeToon } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk, easeRefit } from '../../camfit.js';
import { petModel } from '../farm/pets3d.js';
import { disposeModel } from '../farm/models.js';
import { isFree, PETS, PET_COLOR, NKINDS, isPet, suitOf, rankOf } from './rules.js';

const INK = '#4a2c22', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const TW = 1, TD = 1.3, TH = .45, GAP = .03;   // a tile: wide, deep (towards you), thick
const CAP = 144;
const ATLAS = 6, CW = 192, CH = 250;            // the pictures: 6 x 6 cells on one sheet
export const SUIT_COLOR = ['#52b455', '#ee5d74', '#ffc23a'];

// ---------- the tile pictures ----------
function leaf(c, r) { c.beginPath(); c.moveTo(0, -r * 1.12); c.quadraticCurveTo(r * 1.25, -r * .1, 0, r * 1.12); c.quadraticCurveTo(-r * 1.25, r * .1, 0, -r * 1.12); c.closePath(); }
function starPath(c, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .5 : r; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
function pip(c, suit, x, y, r) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineWidth = Math.max(5, r * .24); c.strokeStyle = '#3b2219'; c.fillStyle = SUIT_COLOR[suit];
  if (suit === 0) { c.rotate(.62); leaf(c, r); c.stroke(); c.fill(); c.lineWidth = Math.max(3, r * .14); c.strokeStyle = '#2c7a3a'; c.beginPath(); c.moveTo(0, -r * .55); c.lineTo(0, r * .6); c.stroke(); }
  else if (suit === 1) { c.beginPath(); c.arc(0, 0, r * .86, 0, 7); c.stroke(); c.fill(); c.fillStyle = '#ffffffb8'; c.beginPath(); c.arc(-r * .3, -r * .32, r * .24, 0, 7); c.fill(); }
  else { starPath(c, r * 1.08); c.stroke(); c.fill(); }
  c.restore();
}
// where the pips of a tile go, on a grid three wide: 1 to 9
const SPOTS = [
  [[0, 0]], [[0, -1], [0, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]],
  [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
];
function drawSuit(c, k) {
  const suit = suitOf(k), n = rankOf(k), r = n === 1 ? 62 : n <= 3 ? 38 : n <= 5 ? 33 : 28;
  const sx = n === 2 ? 0 : n === 3 ? 46 : 54, sy = n <= 5 ? 66 : 64;
  for (const [x, y] of SPOTS[n - 1]) pip(c, suit, CW / 2 + x * sx, CH / 2 + 12 + y * sy, r);
  c.font = '800 44px Rubik, Nunito, system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.lineJoin = 'round';
  c.lineWidth = 9; c.strokeStyle = '#fff8ea'; c.strokeText(String(n), 9, 2); c.fillStyle = '#3b2219'; c.fillText(String(n), 9, 2);
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
// The whole sheet. The pets are photographed from their live Pet Farm models, so a change to a pet's look carries over.
function paintAtlas() {
  const cv = document.createElement('canvas'); cv.width = CW * ATLAS; cv.height = CH * ATLAS; const c = cv.getContext('2d');
  for (let k = 0; k < 27; k++) { c.save(); c.translate((k % ATLAS) * CW, (k / ATLAS | 0) * CH); drawSuit(c, k); c.restore(); }
  let R = null;
  try {
    const SZ = 256; R = new THREE.WebGLRenderer({ antialias: true, alpha: true }); R.setPixelRatio(1); R.setSize(SZ, SZ, false);
    const S2 = new THREE.Scene(), C2 = new THREE.PerspectiveCamera(24, 1, .1, 60);
    S2.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2.1)); const l2 = new THREE.DirectionalLight('#ffffff', 1.4); l2.position.set(3, 6, 5); S2.add(l2);
    const bb = new THREE.Box3(), ctr = new THREE.Vector3(), size = new THREE.Vector3();
    PETS.forEach((sp, p) => {
      const k = 27 + p, g = petModel(sp, 0); S2.add(g); bb.setFromObject(g); bb.getCenter(ctr); bb.getSize(size);
      const d = Math.max(size.x, size.y) / 2 / Math.tan(12 * Math.PI / 180) * .95 + size.z / 2;
      C2.position.set(ctr.x + d * .28, ctr.y + d * .14, ctr.z + d); C2.lookAt(ctr); R.render(S2, C2);
      const ink = document.createElement('canvas'); ink.width = ink.height = SZ; const ic = ink.getContext('2d');
      ic.drawImage(R.domElement, 0, 0); ic.globalCompositeOperation = 'source-in'; ic.fillStyle = '#3b2219'; ic.fillRect(0, 0, SZ, SZ);
      c.save(); c.translate((k % ATLAS) * CW, (k / ATLAS | 0) * CH);
      rr(c, 12, 14, CW - 24, CH - 28, 30); c.fillStyle = PET_COLOR[p]; c.fill(); c.lineWidth = 6; c.strokeStyle = '#3b2219'; c.stroke();
      const w = CW - 30, x0 = 15, y0 = (CH - w) / 2 + 4;
      for (let a = 0; a < 12; a++) c.drawImage(ink, x0 + Math.cos(a / 12 * 6.283) * 5, y0 + Math.sin(a / 12 * 6.283) * 5, w, w);
      c.drawImage(R.domElement, x0, y0, w, w);
      c.restore(); S2.remove(g); disposeModel(g);
    });
  } catch (e) { // no second 3D context: the pet tiles get their first letter instead
    console.warn('no pet pictures', e);
    PETS.forEach((sp, p) => { const k = 27 + p; c.save(); c.translate((k % ATLAS) * CW, (k / ATLAS | 0) * CH);
      rr(c, 12, 14, CW - 24, CH - 28, 30); c.fillStyle = PET_COLOR[p]; c.fill(); c.lineWidth = 6; c.strokeStyle = '#3b2219'; c.stroke();
      c.font = '800 120px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#3b2219'; c.fillText(sp[0].toUpperCase(), CW / 2, CH / 2 + 6); c.restore(); });
  }
  if (R) { R.dispose(); R.forceContextLoss(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// A tile body: an ivory slab on a coloured base, as one geometry with the colours painted on.
function tileGeo(base) {
  const parts = [[TH * .36, -TH / 2, new THREE.Color(base)], [TH * .64, -TH / 2 + TH * .36, new THREE.Color('#fff6e2')]];
  const pos = [], nor = [], col = [];
  for (const [h, y0, c] of parts) {
    let g = new THREE.BoxGeometry(TW - GAP * 2, h, TD - GAP * 2); const ni = g.toNonIndexed(); g.dispose(); g = ni; g.translate(0, y0 + h / 2, 0);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 70, 220);
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(4, 12, 8); scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 34, max: 110, below: -14 }); scene.add(cloudRing);
  const land = island(15, 19, { seed: 31, props: 16, size: 1.5, flowers: 60, rim: 3, open: .8 }); land.position.set(0, -.34, -.6); scene.add(land);
  nightScene(scene);
  const lamp = new THREE.PointLight('#ffe2b0', 0, 46, 1.1); lamp.position.set(0, 9, 5); scene.add(lamp); // keeps the tiles readable at night
  const flyBirds = birds(scene, 54, 12, 4, 1.6), drift = petals(scene, 24, 5, { n: small ? 6 : 10 });
  const pfx = createFx(scene), shake = shaker();

  // ---------- the board ----------
  const B = new THREE.Group(); B.position.set(0, .12, 0); scene.add(B); // x right, y up, z towards the camera
  let tray = null, lay = null, W = 6, D = 5;
  const bodyGeo = tileGeo('#3fa58f'), inkGeo = new THREE.BoxGeometry(TW - GAP * 2 + .075, TH + .075, TD - GAP * 2 + .075);
  const faceGeo = new THREE.PlaneGeometry(TW * .86, TD * .86); faceGeo.rotateX(-Math.PI / 2); faceGeo.translate(0, TH / 2 + .006, 0);
  const uvo = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 2), 2); uvo.setUsage(THREE.DynamicDrawUsage); faceGeo.setAttribute('uvo', uvo);
  const atlas = paintAtlas();
  const faceMat = new THREE.MeshBasicMaterial({ color: '#ffffff', map: atlas, transparent: true, depthWrite: false });
  faceMat.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec2 uvo;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n vMapUv = vMapUv / ${ATLAS}.0 + uvo;`); };
  faceMat.customProgramCacheKey = () => 'mahj-face';
  const inst = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, CAP); m.count = 0; m.frustumCulled = false; B.add(m); return m; };
  const inks = inst(inkGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  const bodies = inst(bodyGeo, toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true })));
  const faces = inst(faceGeo, faceMat); faces.renderOrder = 2;
  // a soft shadow under every tile, pushed a little to the right and towards you, so the layers read at a glance
  const shadeGeo = new THREE.PlaneGeometry(TW + .04, TD + .04); shadeGeo.rotateX(-Math.PI / 2); shadeGeo.translate(.13, -TH / 2 + .014, .15);
  const shades = inst(shadeGeo, new THREE.MeshBasicMaterial({ color: '#1c1230', transparent: true, opacity: .3, depthWrite: false })); shades.renderOrder = 3;

  let sp = [], b = [], hover = -1, picked = -1, hintAt = null, T = 0;
  const cx = t => (t[0] / 2 + .5) * TW - W / 2, cz = t => (t[1] / 2 + .5) * TD - D / 2, cy = t => t[2] * TH + TH / 2;
  function setLayout(l) {
    if (lay === l) return; lay = l; W = l.w / 2 * TW; D = l.h / 2 * TD;
    if (tray) { B.remove(tray); disposeToon(tray); }
    tray = new THREE.Group();
    const box = (w, h, d, c, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(c)); m.position.y = y; tray.add(m); };
    box(W + 1.3, .3, D + 1.3, '#a86a42', -.17); box(W + .8, .06, D + .8, '#2f7f78', -.03);
    toonify(tray, .04); B.add(tray);
    sp = l.tiles.map((t, i) => ({ i, x: cx(t), y: cy(t), z: cz(t), kind: -1, nk: -1, on: false, state: 'idle', t: 0, delay: 0, lit: 1, lift: 0, shake: 0, tx: 0, tz: 0, ty: 0, boom: false }));
    b = Array(l.n).fill(-1); hover = picked = -1; hintAt = null;
    resize();
  }
  function setUv(i, k) { uvo.setXY(i, (k % ATLAS) / ATLAS, 1 - ((k / ATLAS | 0) + 1) / ATLAS); uvo.needsUpdate = true; }
  // mode 'fresh': a new board drops in. 'mix': the tiles turn over into new pictures. Otherwise: just make it so,
  // and tiles that left in the meantime fly off in pairs.
  function setBoard(nb, mode) {
    if (!lay || nb.length !== lay.n) return;
    if (mode === 'fresh') {
      sp.forEach((s, i) => { s.kind = nb[i]; s.on = nb[i] >= 0; s.state = s.on ? 'drop' : 'idle'; s.t = 0; s.delay = lay.tiles[i][2] * .13 + lay.tiles[i][1] * .012 + Math.random() * .16; s.lit = 1; s.lift = 0; if (s.on) setUv(i, s.kind); });
    } else if (mode === 'mix') {
      sp.forEach((s, i) => { if (nb[i] < 0) { s.on = false; return; } s.on = true; s.nk = nb[i]; s.state = 'mix'; s.t = 0; s.delay = Math.random() * .22; });
      shake.kick(.12);
    } else {
      const gone = new Map();
      sp.forEach((s, i) => {
        if (nb[i] < 0) { if (s.on && s.state !== 'take') { const q = gone.get(s.kind); if (q != null) { gone.delete(s.kind); fly(q, i); } else gone.set(s.kind, i); } return; }
        if (!s.on || s.kind !== nb[i] || s.state === 'take') { s.on = true; s.kind = nb[i]; s.state = 'idle'; setUv(i, s.kind); }
      });
      for (const i of gone.values()) sp[i].on = false;
    }
    b = nb.slice(); if (picked >= 0 && b[picked] < 0) picked = -1;
  }
  function fly(i, j) {
    const A = sp[i], Z = sp[j], mx = (A.x + Z.x) / 2, mz = (A.z + Z.z) / 2, my = Math.max(A.y, Z.y) + 1.5;
    for (const [s, side] of [[A, -1], [Z, 1]]) { s.state = 'take'; s.t = 0; s.delay = 0; s.tx = mx + side * TW * .52; s.tz = mz; s.ty = my; s.boom = side < 0; }
  }
  // the pair i, j leaves the board
  function take(i, j) { if (!sp[i]?.on || !sp[j]?.on) return; b[i] = b[j] = -1; fly(i, j); if (picked === i || picked === j) picked = -1; hintAt = null; }

  // ---------- avatars: you, and in a race the others, in a row behind the board ----------
  let avs = [], avKey = '', portrait = false;
  const avG = new THREE.Group(); scene.add(avG);
  function setPlayers(list, me = 0) {
    const key = JSON.stringify(list.map(p => [p.color, p.av])) + me; if (key === avKey) return; avKey = key;
    for (const a of avs) { avG.remove(a.g); disposeAvatar(a.m); }
    avs = list.map((p, k) => { const g = new THREE.Group(); g.rotation.order = 'YXZ'; const m = avatar3d(p.color, p.av, { pose: 'stand' }); m.position.y = .76; g.add(m); avG.add(g); return { g, m, hop: 0, sad: 0, big: k === me, seed: k + 1 }; });
    placeAvatars(); resize();
  }
  // Upright screens: everyone in a row behind the board. Wide screens: you on the left, the others down the right side.
  function placeAvatars() {
    const n = avs.length, gap = Math.min(2.3, (W + 1) / Math.max(1, n));
    let r = 0; const others = Math.max(1, n - 1), step = Math.min(2.3, (D - 1.6) / Math.max(1, others - 1));
    avs.forEach((a, k) => {
      if (portrait) { a.g.position.set((k - (n - 1) / 2) * gap, 0, B.position.z - D / 2 - 1.6); a.g.scale.setScalar(a.big ? 1.15 : .9); a.g.rotation.set(-.42, 0, 0); }
      else if (a.big) { const sc = Math.max(1.1, Math.min(1.5, .75 + D * .08)); a.g.position.set(-W / 2 - 1 - sc * 1.15, 0, B.position.z + D / 4); a.g.scale.setScalar(sc); a.g.rotation.set(-.42, .5, 0); }
      else { a.g.position.set(W / 2 + 2.1, 0, B.position.z + .4 + (r++ - (others - 1) / 2) * step); a.g.scale.setScalar(.95); a.g.rotation.set(-.42, -.5, 0); }
    });
  }

  // ---------- camera: fits the board between the HUD bars ----------
  let hudTop = 64, hudBottom = 90, cw = 1, ch = 1;
  const DIR = new THREE.Vector3(), camLook = new THREE.Vector3(), camBase = new THREE.Vector3(), pv = new THREE.Vector3();
  let fitBox = [];
  function place(dist) { camera.position.copy(DIR).multiplyScalar(dist).add(camLook); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize() {
    cw = canvas.clientWidth || innerWidth; ch = canvas.clientHeight || innerHeight;
    renderer.setSize(cw, ch, false);
    portrait = ch > cw * 1.05;
    const e = (portrait ? 70 : 66) * Math.PI / 180; DIR.set(0, Math.sin(e), Math.cos(e));
    placeAvatars(); scene.updateMatrixWorld(true);
    const top = (lay ? lay.top : 2) * TH + .35;
    camLook.set(0, B.position.y + top / 2, B.position.z);
    fitBox = [];
    for (const x of [-W / 2 - .72, W / 2 + .72]) { for (const z of [-D / 2 - .72, D / 2 + .72]) fitBox.push(new THREE.Vector3(x, B.position.y, B.position.z + z)); for (const z of [-D / 2, D / 2]) fitBox.push(new THREE.Vector3(x + Math.sign(x) * -.7, B.position.y + top, B.position.z + z)); }
    for (const a of avs) { const k = a.g.scale.x, p = a.g.position, out = Math.sign(p.x || 1);
      fitBox.push(new THREE.Vector3(p.x, 2.5 * k, p.z - .6 * k), new THREE.Vector3(p.x + out * 1.45 * k, 2 * k, p.z - .4 * k), new THREE.Vector3(p.x + out * .8 * k, .2, p.z + .3 * k)); }
    if (!portrait) fitBox.push(new THREE.Vector3(W / 2 + 2.4, 0, B.position.z)); // keeps the board in the middle when nobody stands on the right
    camera.aspect = cw / ch; camera.fov = portrait ? 26 : 22; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const avail = Math.max(.3, (ch - hudTop - hudBottom) / ch);
    let lo = 5, hi = 140;
    for (let k = 0; k < 30; k++) {
      const dist = (lo + hi) / 2; place(dist);
      let y0 = 1, y1 = -1, ok = true;
      for (const p of fitBox) { pv.copy(p).project(camera); if (Math.abs(pv.x) > .975) ok = false; y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y); }
      if (ok && (y1 - y0) / 2 <= avail * .98) hi = dist; else lo = dist;
    }
    place(hi); camBase.copy(camera.position);
    let y0 = 1, y1 = -1; for (const p of fitBox) { pv.copy(p).project(camera); y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y); }
    const midNdc = (y0 + y1) / 2, wantNdc = 1 - 2 * (hudTop + (ch - hudTop - hudBottom) / 2) / ch;
    camera.setViewOffset(cw, ch, 0, (wantNdc - midNdc) * ch / 2, cw, ch); camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas); resize();

  // ---------- picking: the nearest tile under the pointer ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y) {
    if (!lay) return -1;
    const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, ox = o.x - B.position.x, oy = o.y - B.position.y, oz = o.z - B.position.z;
    let best = -1, bt = Infinity;
    for (let i = 0; i < lay.n; i++) {
      if (b[i] < 0) continue; const s = sp[i];
      let t0 = 0, t1 = Infinity, ok = true;
      for (const [p, q, c, h] of [[ox, d.x, s.x, TW / 2], [oy, d.y, s.y, TH / 2], [oz, d.z, s.z, TD / 2]]) {
        if (Math.abs(q) < 1e-9) { if (Math.abs(p - c) > h) { ok = false; break; } continue; }
        let a = (c - h - p) / q, z = (c + h - p) / q; if (a > z) [a, z] = [z, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, z); if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < bt) { bt = t0; best = i; }
    }
    return best;
  }
  function tileScreen(i, up = 0) {
    const s = sp[i]; if (!s) return null;
    pv.set(B.position.x + s.x, B.position.y + s.y + TH / 2 + up, B.position.z + s.z).project(camera); const r = canvas.getBoundingClientRect();
    return { x: r.left + (pv.x + 1) / 2 * r.width, y: r.top + (1 - pv.y) / 2 * r.height };
  }

  // ---------- the frame loop ----------
  const mat = new THREE.Matrix4(), p3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), eu = new THREE.Euler(), col = new THREE.Color();
  const DIM = new THREE.Color(.6, .6, .68), WHITE = new THREE.Color(1, 1, 1), GOLD = new THREE.Color('#ffe45a'), HOT = new THREE.Color('#ffd0c0');
  const ease = u => 1 - (1 - u) * (1 - u), hide = new THREE.Matrix4().makeScale(0, 0, 0);
  let moving = 0, cheerT = 0;
  function loop(dt) {
    T += dt; moving = 0;
    const n = lay ? lay.n : 0;
    for (let i = 0; i < n; i++) {
      const s = sp[i];
      if (!s.on) { inks.setMatrixAt(i, hide); bodies.setMatrixAt(i, hide); faces.setMatrixAt(i, hide); shades.setMatrixAt(i, hide); continue; }
      let x = s.x, y = s.y, z = s.z, sx = 1, sy = 1, ry = 0, rz = 0, glow = 0;
      const free = s.state === 'take' || (b[i] >= 0 && isFree(lay, b, i));
      s.lit += ((free ? 1 : 0) - s.lit) * Math.min(1, dt * 10);
      if (s.state === 'drop') {
        moving++;
        if (s.delay > 0) { s.delay -= dt; sx = 0; }
        else { s.t = Math.min(1, s.t + dt / .34); const u = s.t; y += (1 - ease(u)) * 5 + (u > .8 ? Math.sin((u - .8) / .2 * Math.PI) * -.03 : 0); sx = Math.min(1, u * 2); if (u >= 1) s.state = 'idle'; }
      } else if (s.state === 'mix') {
        moving++;
        if (s.delay > 0) s.delay -= dt;
        else { const was = s.t; s.t = Math.min(1, s.t + dt / .5); if (was < .5 && s.t >= .5) { s.kind = s.nk; setUv(i, s.kind); } sx = Math.abs(Math.cos(s.t * Math.PI)); y += Math.sin(s.t * Math.PI) * .35; if (s.t >= 1) s.state = 'idle'; }
      } else if (s.state === 'take') {
        moving++;
        s.t = Math.min(1, s.t + dt / .4); const u = s.t, k = ease(Math.min(1, u / .7));
        x += (s.tx - x) * k; z += (s.tz - z) * k; y += (s.ty - y) * k; rz = (s.boom ? 1 : -1) * k * .12;
        sx = u < .7 ? 1 + k * .12 : 1.12 * (1 - (u - .7) / .3); glow = k;
        if (u >= 1) {
          s.on = false; s.state = 'idle';
          if (s.boom) { p3.set(B.position.x + s.tx + TW * .52, B.position.y + s.ty, B.position.z + s.tz); pfx.burst(p3, { n: small ? 10 : 16, colors: ['#ffd84a', '#fff1a8', '#ffffff', '#7ed3b2'], speed: 3.4, up: 2.6, size: .3, life: .7, shape: STAR }); }
        }
      } else {
        const want = i === picked ? .3 : i === hover && free ? .1 : 0; s.lift += (want - s.lift) * Math.min(1, dt * 16); y += s.lift;
        if (hintAt && (i === hintAt[0] || i === hintAt[1])) { const w = .5 + .5 * Math.sin(T * 7); y += w * .14; glow = .45 + w * .55; }
        if (i === picked) glow = 1;
        if (s.shake > 0) { s.shake = Math.max(0, s.shake - dt * 3.2); x += Math.sin(s.shake * 34) * .07 * s.shake; }
      }
      sy = sx;
      eu.set(0, ry, rz); q4.setFromEuler(eu); mat.compose(p3.set(x, y, z), q4, s3.set(sx, sy, sx));
      inks.setMatrixAt(i, mat); bodies.setMatrixAt(i, mat); faces.setMatrixAt(i, mat);
      if (s.state === 'idle' || s.state === 'mix') { mat.compose(p3.set(s.x, s.y, s.z), q4.identity(), s3.set(sx, 1, sx)); shades.setMatrixAt(i, mat); } else shades.setMatrixAt(i, hide);
      col.copy(DIM).lerp(WHITE, s.lit); if (glow) col.lerp(GOLD, glow * .55); if (s.shake > 0) col.lerp(HOT, s.shake);
      bodies.setColorAt(i, col); faces.setColorAt(i, col);
    }
    inks.count = bodies.count = faces.count = shades.count = n;
    lamp.intensity = isNight() ? 34 : 0;
    for (const m of [inks, bodies, faces, shades]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    for (const a of avs) {
      a.hop = Math.max(0, a.hop - dt * 1.6); a.sad = Math.max(0, a.sad - dt * .5);
      animateAvatar(a.m, T, { seed: a.seed, active: a.big && (hover >= 0 || picked >= 0), hop: a.hop, nod: a.sad > 0 ? -Math.min(1, a.sad * 3) * .5 : a.big ? .22 : .12 });
      a.m.position.y = .76 + (a.hop > 0 ? Math.sin((1 - a.hop) * Math.PI) * .32 : 0);
    }
    if (cheerT > 0) { cheerT -= dt; if (Math.random() < dt * 5) for (const a of avs) if (a.cheer && a.hop <= 0) a.hop = 1; }
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    pfx.update(dt, camera, ch);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .1), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    renderer.render(scene, camera);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setLayout, setBoard, take, pick, tileScreen, setPlayers,
    setAvatar(color, av) { setPlayers([{ color, av }], 0); },
    busy: () => moving > 0,
    board: () => b,
    setHover(i) { hover = i; }, setPicked(i) { picked = i; }, hint(m) { hintAt = m; },
    bad(i) { if (sp[i]) sp[i].shake = 1; },
    hop(k) { if (avs[k]) avs[k].hop = 1; },
    // who: the seat whose win effect rains down ('me' in the solo game)
    cheer(k = 0, big = true, who = k) { const a = avs[k]; if (!a) return; a.hop = 1; if (big) { for (const o of avs) o.cheer = o === a; cheerT = 3; pfx.confetti(new THREE.Vector3(0, 1.5, B.position.z), { n: small ? 60 : 110, w: Math.max(6, W), h: 5, s: who }); } },
    oops(k = 0) { if (avs[k]) avs[k].sad = 1; },
    setHud(bottom, top = hudTop) { const fit = hudFitOk(canvas), grew = bottom > hudBottom + 6 || top > hudTop + 6; if ((Math.abs(bottom - hudBottom) > 6 || top !== hudTop) && (fit || grew)) { hudBottom = bottom; hudTop = top; fit ? resize() : easeRefit(camera, camBase, camLook, () => resize()); } }, // a HUD growing mid-game eases the camera out (camfit.js)
    tilePx: () => { const a = tileScreen(0), z = lay && lay.n > 1 ? tileScreen(1) : null; return a && z ? Math.hypot(z.x - a.x, z.y - a.y) : 0; },
    fps: () => ticker.fps(), stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
    dispose() {
      ticker.stop(); ro.disconnect(); for (const a of avs) disposeAvatar(a.m); pfx.dispose();
      if (tray) disposeToon(tray);
      for (const g of [bodyGeo, inkGeo, faceGeo, shadeGeo]) g.dispose(); atlas.dispose(); faceMat.dispose(); inks.material.dispose(); shades.material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

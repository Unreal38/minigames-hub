// Pet Pop 3D shelf (three.js): a big wooden toy shelf on a sky island, one Pet Farm pet in every cubby, and the
// player's avatar watching. Purely visual: the client tells it which swap was made and hands it the server's
// steps, and it plays them (pop, drop, refill). Every pet of a kind is one instanced mesh, so a full shelf is a
// handful of draw calls and holds 60 frames a second on phones.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, DOT, nightScene, isNight, flat } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { petModel } from '../farm/pets3d.js';
import { W, H, N, KINDS, KIND_COLOR, HOLE, EMPTY, BOWL, BALE, isPet, kindOf, powerOf, isBale, settle, ZOOM_H, ZOOM_V, POUNCE } from './rules.js';

const INK = '#4a2c22', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const LEAN = .1;                 // how far the shelf leans back
const CAP = 96;                  // most pets of one kind on screen at once (a full shelf plus the ones dropping in)
const FLOOR = -.44;              // a pet's feet, measured from the middle of its cubby
const cxOf = i => (i % W) - (W - 1) / 2, cyOf = i => (H - 1) / 2 - (i / W | 0);

// ---------- one mesh out of a whole model ----------
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
// Every solid part of a model as one geometry with the colours painted on, plus its outline hull.
function flatten(root) {
  root.updateWorldMatrix(true, true); _inv.copy(root.matrixWorld).invert();
  const parts = []; let n = 0, hull = null;
  root.traverse(m => {
    if (!m.isMesh) return;
    if (m.userData.ink) { hull ||= m.geometry; return; }
    const mt = Array.isArray(m.material) ? m.material[0] : m.material;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(_m.multiplyMatrices(_inv, m.matrixWorld));
    const c = mt.color.clone(); if (mt.emissive && mt.emissiveIntensity > 0 && mt.emissive.getHex()) c.lerp(mt.emissive, Math.min(1, mt.emissiveIntensity));
    parts.push([g.attributes.position.array, g.attributes.normal.array, c]); n += g.attributes.position.count; g.dispose();
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [p, q, c] of parts) { pos.set(p, o); nor.set(q, o); for (let i = 0; i < p.length; i += 3) { col[o + i] = c.r; col[o + i + 1] = c.g; col[o + i + 2] = c.b; } o += p.length; }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.BufferAttribute(pos, 3)); body.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return { body, hull: hull ? hull.clone() : null };
}
// Sizes a flattened model to sit in a cubby: feet on y = 0, centred, no wider than w and no taller than h.
function fit({ body, hull }, w, h) {
  body.computeBoundingBox(); const b = body.boundingBox, s = Math.min(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y), w * 1.7 / (b.max.z - b.min.z));
  const dx = -(b.max.x + b.min.x) / 2, dy = -b.min.y, dz = -(b.max.z + b.min.z) / 2;
  for (const g of [body, hull]) if (g) { g.translate(dx, dy, dz); g.scale(s, s, s); }
  return { body, hull };
}
const bodyMat = () => toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true }));
let inkM = null;
const inkMat = () => { // the dark outline: the hull drawn inside out and pushed out a little
  if (!inkM) { inkM = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }); inkM.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * 0.028;'); }; inkM.customProgramCacheKey = () => 'pop-ink'; }
  return inkM;
};

// ---------- the pieces that are not pets ----------
const box = (g, w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(c)); m.position.set(x, y, z); g.add(m); return m; };
function bowlModel() { // the Treat Bowl: a chunky bowl heaped with treats in every pet's colour
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.5, .3, .42, 8), flat('#5f8fe0')); cup.position.y = .21; g.add(cup);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .1, 8), flat('#fff4e2')); rim.position.y = .44; g.add(rim);
  KIND_COLOR.forEach((c, k) => { const a = k / 6 * Math.PI * 2, t = new THREE.Mesh(new THREE.IcosahedronGeometry(.17, 0), flat(c)); t.position.set(Math.cos(a) * .26, .58 + (k % 2) * .08, Math.sin(a) * .2); t.rotation.set(k, k * 2, 0); g.add(t); });
  const top = new THREE.Mesh(new THREE.OctahedronGeometry(.2, 0), flat('#ffd84a')); top.position.y = .82; g.add(top);
  return toonify(g, .03);
}
function baleModel(strong) { // a hay bale; a strong one is strapped into a wooden frame that breaks off first
  const g = new THREE.Group();
  box(g, .84, .62, .6, '#f2c94c', 0, .31, 0);
  for (const x of [-.22, .22]) box(g, .07, .65, .63, '#c98a1e', x, .31, 0);
  for (const [x, y] of [[-.3, .5], [.05, .2], [.31, .42], [-.08, .52]]) box(g, .16, .03, .02, '#fff1a8', x, y, .31);
  if (strong) {
    for (const x of [-.44, .44]) box(g, .09, .74, .7, '#a86a42', x, .35, 0);
    for (const y of [.02, .68]) box(g, .96, .09, .7, '#8a5a3c', 0, y, 0);
    const bar = box(g, 1.1, .08, .06, '#a86a42', 0, .35, .34); bar.rotation.z = .62;
  }
  return toonify(g, .03);
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.75);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 190);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(4, 10, 12); scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 30, max: 100, below: -12 }); scene.add(cloudRing);
  const land = island(17, 9, { seed: 23, props: 14, size: 1.5, flowers: 50, rim: 3, open: .8 }); land.position.set(0, -.3, -1.2); scene.add(land);
  nightScene(scene);
  const lamp = new THREE.PointLight('#ffe2b0', 0, 40, 1.2); lamp.position.set(0, 6, 9); scene.add(lamp); // keeps the shelf readable at night
  const flyBirds = birds(scene, 50, 14, 4, 1.6), drift = petals(scene, 22, 6, { n: small ? 6 : 10 });
  const pfx = createFx(scene), shake = shaker();

  // ---------- the shelf ----------
  const pivot = new THREE.Group(); pivot.position.set(0, .15, 0); pivot.rotation.x = -LEAN; scene.add(pivot);
  const B = new THREE.Group(); B.position.y = H / 2 + .55; pivot.add(B); // everything on the shelf lives in B: x right, y up, cubbies 1 apart
  const frame = new THREE.Group(); B.add(frame);
  box(frame, W + .5, H + .5, .16, '#e8c9a0', 0, 0, -.5);                                     // the back board
  for (const s of [-1, 1]) { box(frame, .26, H + .76, .9, '#a86a42', s * (W / 2 + .13), 0, -.12); box(frame, W + .52, .26, .9, '#a86a42', 0, s * (H / 2 + .13), -.12); }
  for (let k = 1; k < H; k++) box(frame, W, .07, .7, '#c98f5e', 0, H / 2 - k, -.16);          // shelves
  for (let k = 1; k < W; k++) box(frame, .05, H, .5, '#d9a877', -W / 2 + k, 0, -.26);         // dividers
  for (const s of [-1, 1]) box(frame, .5, .7, 1.5, '#8a5a3c', s * (W / 2 - .6), -H / 2 - .5, .1); // feet
  toonify(frame, .035);
  // the back of each cubby, in two soft tones like a checkerboard
  const backGeo = new THREE.PlaneGeometry(.95, .93), backs = new THREE.InstancedMesh(backGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), N);
  backs.frustumCulled = false; B.add(backs);
  let holes = new THREE.Group(), maskKey = ''; B.add(holes);
  const col = new THREE.Color(), dm = new THREE.Object3D();
  function setMask(b) {
    const key = b.map(v => v === HOLE ? 0 : 1).join(''); if (key === maskKey) return; maskKey = key;
    B.remove(holes); holes.traverse(o => { o.geometry?.dispose(); }); holes = new THREE.Group(); B.add(holes);
    let n = 0; const night = isNight();
    for (let i = 0; i < N; i++) {
      if (b[i] === HOLE) { box(holes, 1.02, 1.02, .82, (i + (i / W | 0)) % 2 ? '#b97b4e' : '#a86a42', cxOf(i), cyOf(i), -.1); continue; }
      dm.position.set(cxOf(i), cyOf(i) + .01, -.41); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.updateMatrix(); backs.setMatrixAt(n, dm.matrix);
      backs.setColorAt(n++, col.set((i + (i / W | 0)) % 2 ? '#fff6e6' : '#fbe6c6').multiplyScalar(night ? .62 : 1));
    }
    backs.count = n; backs.instanceMatrix.needsUpdate = true; if (backs.instanceColor) backs.instanceColor.needsUpdate = true;
    if (holes.children.length) toonify(holes, .035);
  }

  // ---------- instanced pieces ----------
  const inst = (geo, mat, cap = CAP) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; B.add(m); return m; };
  const piece = ({ body, hull }, cap) => ({ body: inst(body, bodyMat(), cap), hull: hull ? inst(hull, inkMat(), cap) : null, n: 0 });
  const pets = KINDS.map(sp => { const model = petModel(sp, 2); const p = piece(fit(flatten(model), .88, .86)); return p; });
  const bowl = piece(fit(flatten(bowlModel()), .78, .74), 16);
  const bale1 = piece(fit(flatten(baleModel(false)), .84, .64), N), bale2 = piece(fit(flatten(baleModel(true)), .92, .72), N);
  // the coloured cushion behind every pet, so a kind reads at a glance even on a small phone
  const padGeo = new THREE.CylinderGeometry(.47, .47, .08, 8); padGeo.rotateY(Math.PI / 8); padGeo.rotateX(Math.PI / 2);
  const pads = inst(padGeo, toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff' })), CAP * 2);
  const padInk = inst(padGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), CAP * 2);
  // powers: arrows either side of a Zoomer, a ring round a Pouncer
  const arrowGeo = new THREE.ConeGeometry(.13, .22, 4); arrowGeo.rotateZ(-Math.PI / 2); // points along +x
  const arrows = inst(arrowGeo, new THREE.MeshBasicMaterial({ color: '#fff7c2' }), CAP * 2), arrowInk = inst(arrowGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), CAP * 2);
  const ringGeo = new THREE.TorusGeometry(.44, .05, 5, 16), rings = inst(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff7c2' }), CAP), ringInk = inst(ringGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), CAP);
  const padCol = KIND_COLOR.map(c => new THREE.Color(c).lerp(new THREE.Color('#ffffff'), .28)), GOLD = new THREE.Color('#ffe9a8');

  // beams for a Zoomer's dash and a Pouncer's stomp
  const beamGeo = new THREE.PlaneGeometry(1, 1);
  const beams = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#fffbe0', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 4; B.add(m); return { m, t: 1, w: 1, h: 1 }; });
  let beamI = 0;
  function beam(x, y, w, h) { const b = beams[beamI++ % beams.length]; b.m.position.set(x, y, .5); b.w = w; b.h = h; b.t = 0; b.m.visible = true; }
  // the frame round the cubby you are aiming at or holding
  const cursor = new THREE.Group(); cursor.visible = false; B.add(cursor);
  for (const [w, h, x, y] of [[1.04, .09, 0, .48], [1.04, .09, 0, -.48], [.09, 1.04, .48, 0], [.09, 1.04, -.48, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .09), new THREE.MeshBasicMaterial({ color: '#ffffff' })); m.position.set(x, y, .32); cursor.add(m); }

  // ---------- sprites: one per thing on the shelf ----------
  let cells = Array(N).fill(null), lb = Array(N).fill(EMPTY), dying = [];
  let hover = -1, picked = -1, hintAt = null, dance = 0;
  const sprite = (v, i) => ({ v, x: cxOf(i), y: cyOf(i), tx: cxOf(i), ty: cyOf(i), vy: 0, state: 'idle', t: 0, ph: Math.random() * 6.28, born: 1, squash: 0, shake: 0, flash: 0, delay: 0, i });
  const moving = () => cells.some(s => s && s.state !== 'idle');
  const wv = new THREE.Vector3();
  const worldOf = (x, y, z = .2) => B.localToWorld(wv.set(x, y, z));

  function setBoard(b, how = '') {
    setMask(b); lb = b.slice(); dying = []; queue = []; phase = null; hintAt = null; dance = 0;
    cells = b.map((v, i) => {
      if (v === HOLE || v === EMPTY) return null;
      const s = sprite(v, i);
      if (how === 'fresh') { s.y = cyOf(i) + H + 1 + (i % W) * .35; s.state = 'fall'; s.vy = -2; }
      else if (how === 'shuffle') { s.born = 0; s.delay = Math.random() * .15; }
      return s;
    });
  }
  function swap(a, b) {
    const sa = cells[a], sb = cells[b]; cells[a] = sb; cells[b] = sa; [lb[a], lb[b]] = [lb[b], lb[a]];
    for (const [s, i] of [[sa, b], [sb, a]]) if (s) { s.tx = cxOf(i); s.ty = cyOf(i); s.state = 'slide'; s.i = i; }
  }
  // a swap that lines nothing up: the two pets lean towards each other and shake their heads
  function nudge(a, b) {
    for (const [i, j] of [[a, b], [b, a]]) { const s = cells[i]; if (s && s.state === 'idle') { s.state = 'bump'; s.t = 0; s.bx = (cxOf(j) - cxOf(i)) * .3; s.by = (cyOf(j) - cyOf(i)) * .3; } }
  }

  // ---------- playing the server's steps ----------
  let queue = [], phase = null, onStep = null, onDone = null;
  function run(steps, stepCb, doneCb) { queue = steps.slice(); onStep = stepCb; onDone = doneCb; phase = { land: true, t: .5, then: next }; }
  function fxOf(st) {
    for (const f of st.fx || []) {
      if (f.t === 'row') beam(0, cyOf(f.i), W + .4, .5);
      else if (f.t === 'col') beam(cxOf(f.i), 0, .5, H + .4);
      else if (f.t === 'box') beam(cxOf(f.i), cyOf(f.i), f.r * 2 + 1.2, f.r * 2 + 1.2);
      else if (f.t === 'all') beam(0, 0, W + .4, H + .4);
      else if (f.t === 'kind') pfx.sparkle(worldOf(cxOf(f.i), cyOf(f.i)).clone(), { n: 14, colors: [KIND_COLOR[f.k], '#ffffff'], r: 1 });
      if (f.t !== 'kind') shake.kick(f.t === 'all' ? .3 : .12);
    }
  }
  function next() {
    const st = queue.shift();
    if (!st) { phase = null; const cb = onDone; onDone = null; cb?.(); return; }
    if (st.shuf) { setBoardKeep(st.shuf); onStep?.(st, lb); phase = { t: .55, then: next }; return; }
    for (const [i, v] of st.turn || []) { lb[i] = v; const s = cells[i]; if (s) { s.v = v; s.flash = 1; s.squash = 1; } }
    phase = { t: st.turn?.length ? .32 : 0, then: () => {
      onStep?.(st, lb); fxOf(st);
      for (const i of st.clr) {
        const s = cells[i]; lb[i] = EMPTY; if (!s) continue;
        s.state = 'pop'; s.t = 0; cells[i] = null; dying.push(s);
        const k = kindOf(s.v), at = worldOf(s.x, s.y).clone();
        if (isBale(s.v)) pfx.burst(at, { n: 9, colors: ['#f2d374', '#e8c25a', '#fff1a8'], shape: DOT, speed: 3, up: 2.4, size: .22, life: .6 });
        else pfx.burst(at, { n: small ? 4 : 6, colors: [k >= 0 ? KIND_COLOR[k] : '#ffd84a', '#ffffff'], shape: [STAR, DOT], speed: 2.6, up: 2, size: .3, life: .55 });
      }
      for (const [i, v] of st.hit) { lb[i] = v; const s = cells[i]; if (s) { s.v = v; s.shake = 1; pfx.burst(worldOf(s.x, s.y).clone(), { n: 7, colors: ['#a86a42', '#8a5a3c'], shape: DOT, speed: 3, up: 2.5, size: .24, life: .6 }); } }
      phase = { t: .24, then: () => {
        for (const [i, v] of st.mk) { lb[i] = v; const s = cells[i] = sprite(v, i); s.born = 0; pfx.sparkle(worldOf(s.x, s.y).clone(), { n: 8, colors: ['#fff1a8', '#ffffff'], r: .5 }); }
        const mv = settle(lb, st.add);
        for (const [from, to] of mv.falls) { const s = cells[to] = cells[from]; cells[from] = null; if (s) { s.tx = cxOf(to); s.ty = cyOf(to); s.state = 'fall'; s.vy = -2; s.i = to; } }
        for (const [to, n, v] of mv.drops) { if (v === EMPTY) continue; const s = cells[to] = sprite(v, to); s.y = cyOf(to) + n + .2; s.state = 'fall'; s.vy = -2; }
        phase = { land: true, t: 1.2, then: next };
      } };
    } };
  }
  // a shuffle: the same shelf shape, every pet somewhere new
  function setBoardKeep(b) { const q = queue, a = onStep, d = onDone; setBoard(b, 'shuffle'); queue = q; onStep = a; onDone = d; }

  // ---------- the avatar ----------
  let av = null, avKey = '', avHop = 0, avSad = 0, avYaw = 0, portrait = false;
  const avG = new THREE.Group(); scene.add(avG);
  const AV_WIDE = { k: 1.9 }, AV_TALL = { k: 1.25 };
  function setAvatar(color, a) {
    const k = color + JSON.stringify(a || []); if (k === avKey) return; avKey = k;
    if (av) { avG.remove(av); disposeAvatar(av); }
    av = avatar3d(color, a, { pose: 'stand' }); av.position.y = .76; avG.add(av);
  }
  function placeAvatar() {
    if (portrait) { B.localToWorld(avG.position.set(W / 2 - 1.4, H / 2 + .27, -.1)); avG.scale.setScalar(AV_TALL.k); avYaw = -.25; }
    else { avG.position.set(-W / 2 - 2.1, -.05, 1.2); avG.scale.setScalar(AV_WIDE.k); avYaw = .55; }
    avG.rotation.y = avYaw;
  }

  // ---------- camera: fits the shelf between the HUD bars ----------
  let hudTop = 64, hudBottom = 120, cw = 1, ch = 1;
  // the camera looks along the shelf's own normal, so the shelf faces it squarely (Kuba asked for straight on)
  const DIR = new THREE.Vector3(0, Math.sin(LEAN), Math.cos(LEAN)), camLook = new THREE.Vector3(), camBase = new THREE.Vector3(), pv = new THREE.Vector3();
  let fitBox = [];
  function place(D) { camera.position.copy(DIR).multiplyScalar(D).add(camLook); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize() {
    cw = canvas.clientWidth || innerWidth; ch = canvas.clientHeight || innerHeight;
    renderer.setSize(cw, ch, false);
    portrait = ch > cw * 1.05;
    scene.updateMatrixWorld(true); placeAvatar();
    B.localToWorld(camLook.set(0, 0, 0));
    fitBox = [];
    for (const x of [-W / 2 - .42, W / 2 + .42]) for (const y of [-H / 2 - .5, H / 2 + (portrait ? 2.6 : .5)]) fitBox.push(B.localToWorld(new THREE.Vector3(x, y, 0)));
    if (!portrait) fitBox.push(new THREE.Vector3(-W / 2 - 3.7, 0, 1.2), new THREE.Vector3(-W / 2 - 3.7, 3.6, 1.2), new THREE.Vector3(W / 2 + 1.6, 0, 1.2));
    camera.aspect = cw / ch; camera.fov = portrait ? 30 : 24; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const avail = Math.max(.3, (ch - hudTop - hudBottom) / ch);
    let lo = 6, hi = 120;
    for (let k = 0; k < 30; k++) {
      const D = (lo + hi) / 2; place(D);
      let y0 = 1, y1 = -1, ok = true;
      for (const p of fitBox) { pv.copy(p).project(camera); if (Math.abs(pv.x) > .985) ok = false; y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y); }
      if (ok && (y1 - y0) / 2 <= avail * .98) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    let y0 = 1, y1 = -1; for (const p of fitBox) { pv.copy(p).project(camera); y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y); }
    const midNdc = (y0 + y1) / 2, wantNdc = 1 - 2 * (hudTop + (ch - hudTop - hudBottom) / 2) / ch;
    camera.setViewOffset(cw, ch, 0, (wantNdc - midNdc) * ch / 2, cw, ch); camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas); resize();

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), pn = new THREE.Vector3(), pp = new THREE.Vector3(), hit = new THREE.Vector3();
  function pick(x, y) {
    const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    B.getWorldDirection(pn); B.localToWorld(pp.set(0, 0, .1)); plane.setFromNormalAndCoplanarPoint(pn, pp);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    B.worldToLocal(hit);
    const c = Math.round(hit.x + (W - 1) / 2), rr = Math.round((H - 1) / 2 - hit.y);
    if (c < 0 || rr < 0 || c >= W || rr >= H) return -1;
    return rr * W + c;
  }
  function cellScreen(i, dy = 0) {
    B.localToWorld(pv.set(cxOf(i), cyOf(i) + dy, .2)).project(camera); const r = canvas.getBoundingClientRect();
    return { x: r.left + (pv.x + 1) / 2 * r.width, y: r.top + (1 - pv.y) / 2 * r.height };
  }
  const cellPx = () => { const a = cellScreen(0), b = cellScreen(1); return Math.abs(b.x - a.x); };

  // ---------- the frame loop ----------
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), mat = new THREE.Matrix4();
  const all = [...pets, bowl, bale1, bale2];
  let nPad = 0, nArrow = 0, nRing = 0, T = 0;
  const putAt = (mesh, n, x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) => { e.set(rx, ry, rz); q.setFromEuler(e); mesh.setMatrixAt(n, mat.compose(p3.set(x, y, z), q, s3.set(sx, sy, sz))); };
  function draw(s, dt) {
    const v = s.v, k = kindOf(v), pw = powerOf(v), bale = isBale(v);
    // where it is and how big, from what it is doing
    let x = s.x, y = s.y, sc = 1, sx = 1, sy = 1, rz = 0, ry = 0, hop = 0;
    if (s.born < 1) { if (s.delay > 0) s.delay -= dt; else s.born = Math.min(1, s.born + dt * 5); const u = s.born; sc *= u < .7 ? u / .7 * 1.2 : 1.2 - (u - .7) / .3 * .2; }
    if (s.state === 'pop') { s.t += dt / .24; const u = Math.min(1, s.t); sc *= u < .3 ? 1 + u : 1.3 * (1 - (u - .3) / .7); rz = u * 1.2; }
    else if (s.state === 'bump') { s.t += dt / .34; const u = Math.min(1, s.t), w = Math.sin(u * Math.PI); x += s.bx * w; y += s.by * w; rz = Math.sin(u * Math.PI * 4) * .18; if (u >= 1) s.state = 'idle'; }
    if (s.squash > 0) { s.squash = Math.max(0, s.squash - dt * 5); const w = Math.sin(s.squash * Math.PI) * .2; sx += w; sy -= w; }
    if (s.shake > 0) { s.shake = Math.max(0, s.shake - dt * 3); x += Math.sin(s.shake * 40) * .06 * s.shake; }
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 2.5);
    const idle = s.state === 'idle';
    if (idle && !bale) {
      const held = s.i === picked, hinted = hintAt && (s.i === hintAt[0] || s.i === hintAt[1]);
      ry = Math.sin(T * 1.1 + s.ph) * .2;
      if (held) { sc *= 1.1 + Math.sin(T * 9) * .04; rz = Math.sin(T * 9) * .1; }
      else if (hinted) hop = Math.abs(Math.sin(T * 5)) * .16;
      else if (dance) hop = Math.abs(Math.sin(T * 7 + s.i * .7)) * .2 * dance;
      else if (pw || v === BOWL) hop = Math.abs(Math.sin(T * 3.2 + s.ph)) * .05;
      else sy += Math.sin(T * 2.2 + s.ph) * .025;
    }
    // new pets grow as they come over the top of the shelf
    const over = y - (H / 2 + .2); if (over > 0) sc *= Math.max(0, 1 - over * 1.4);
    if (sc <= .001) return;
    const z = s.state === 'slide' || s.i === picked ? .12 : 0;
    if (bale) { const P = v - BALE > 1 ? bale2 : bale1; putAt(P.body, P.n, x, y + FLOOR, z - .05, 0, 0, rz, sc * sx, sc * sy, sc); P.hull && putAt(P.hull, P.n, x, y + FLOOR, z - .05, 0, 0, rz, sc * sx, sc * sy, sc); P.n++; return; }
    const P = v === BOWL ? bowl : pets[k]; if (!P || P.n >= CAP) return;
    putAt(P.body, P.n, x, y + FLOOR + hop, z, 0, ry, rz, sc * sx, sc * sy, sc); P.hull && putAt(P.hull, P.n, x, y + FLOOR + hop, z, 0, ry, rz, sc * sx, sc * sy, sc); P.n++;
    const ps = sc * (1 + s.flash * .25);
    putAt(pads, nPad, x, y, z - .3, 0, 0, 0, ps); putAt(padInk, nPad, x, y, z - .3, 0, 0, 0, ps * 1.09, ps * 1.09, ps * .9);
    pads.setColorAt(nPad++, col.copy(v === BOWL || s.flash > .3 ? GOLD : padCol[k]));
    if (pw === ZOOM_H || pw === ZOOM_V) {
      const d = .52 + Math.abs(Math.sin(T * 5 + s.ph)) * .07;
      for (const sd of [-1, 1]) {
        const ax = pw === ZOOM_H ? sd * d : 0, ay = pw === ZOOM_V ? sd * d : 0, r = pw === ZOOM_H ? (sd > 0 ? 0 : Math.PI) : sd * Math.PI / 2;
        putAt(arrows, nArrow, x + ax * sc, y + ay * sc, z + .34, 0, 0, r, sc); putAt(arrowInk, nArrow, x + ax * sc, y + ay * sc, z + .33, 0, 0, r, sc * 1.35); nArrow++;
      }
    } else if (pw === POUNCE) {
      const r = sc * (1 + Math.sin(T * 5 + s.ph) * .06);
      putAt(rings, nRing, x, y, z + .36, 0, 0, T * 1.5, r); putAt(ringInk, nRing, x, y, z + .35, 0, 0, T * 1.5, r * 1.06, r * 1.06, r * 1.7); nRing++;
    }
  }
  function loop(dt) {
    T += dt;
    const night = isNight(); lamp.intensity = night ? 26 : 0;
    // move what is moving
    let busy = false;
    for (const s of cells) {
      if (!s) continue;
      if (s.state === 'fall') { s.vy -= 46 * dt; s.y += s.vy * dt; s.x = s.tx; if (s.y <= s.ty) { s.y = s.ty; s.vy = 0; s.state = 'idle'; s.squash = 1; } else busy = true; }
      else if (s.state === 'slide') { const k = Math.min(1, dt * 16); s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) < .02) { s.x = s.tx; s.y = s.ty; s.state = 'idle'; } else busy = true; }
    }
    if (phase) { phase.t -= dt; if (phase.land ? (!busy || phase.t <= 0) : phase.t <= 0) { const f = phase.then; phase = null; f(); } }
    // draw every sprite into its instanced mesh
    for (const P of all) P.n = 0; nPad = nArrow = nRing = 0;
    for (const s of cells) if (s) draw(s, dt);
    for (const s of dying) draw(s, dt);
    if (dying.length) dying = dying.filter(s => s.t < 1);
    for (const P of all) { P.body.count = P.n; P.body.instanceMatrix.needsUpdate = true; if (P.hull) { P.hull.count = P.n; P.hull.instanceMatrix.needsUpdate = true; } }
    pads.count = padInk.count = nPad; pads.instanceMatrix.needsUpdate = padInk.instanceMatrix.needsUpdate = true; if (pads.instanceColor) pads.instanceColor.needsUpdate = true;
    arrows.count = arrowInk.count = nArrow; arrows.instanceMatrix.needsUpdate = arrowInk.instanceMatrix.needsUpdate = true;
    rings.count = ringInk.count = nRing; rings.instanceMatrix.needsUpdate = ringInk.instanceMatrix.needsUpdate = true;
    for (const b of beams) { if (b.t >= 1) continue; b.t = Math.min(1, b.t + dt / .32); const u = b.t; b.m.scale.set(b.w * (.6 + u * .4), b.h * (.6 + u * .4), 1); b.m.material.opacity = (1 - u) * .85; if (u >= 1) b.m.visible = false; }
    const aim = picked >= 0 ? picked : hover;
    cursor.visible = aim >= 0 && !!cells[aim];
    if (cursor.visible) { cursor.position.set(cxOf(aim), cyOf(aim), 0); cursor.scale.setScalar(1 + Math.sin(T * 6) * .03); for (const m of cursor.children) m.material.color.set(picked >= 0 ? '#ffe14a' : '#ffffff'); }
    if (av) {
      avHop = Math.max(0, avHop - dt * 1.4); avSad = Math.max(0, avSad - dt * .5);
      animateAvatar(av, T, { seed: 1, active: aim >= 0, hop: avHop, nod: avSad > 0 ? -Math.min(1, avSad * 3) * .5 : 0 });
      av.position.y = .76 + (avHop > 0 ? Math.sin((1 - avHop) * Math.PI) * .35 : 0);
    }
    if (dance) dance = Math.max(0, dance - dt * .25);
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    pfx.update(dt, camera, ch);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .12), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    renderer.render(scene, camera);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setBoard, swap, nudge, run, pick, cellScreen, cellPx, setAvatar,
    busy: () => !!phase || moving(),
    board: () => lb,
    setHover(i) { hover = i; }, setPicked(i) { picked = i; }, hint(m) { hintAt = m; },
    cheer(big) { avHop = 1; if (big) { dance = 1; pfx.confetti(worldOf(0, 1, 2).clone(), { n: small ? 60 : 110, w: 8, h: 5, s: 'me' }); } },
    oops() { avSad = 1; },
    setHud(bottom, top = hudTop) { if (Math.abs(bottom - hudBottom) > 6 || top !== hudTop) { hudBottom = bottom; hudTop = top; resize(); } },
    fps: () => ticker.fps(), stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
    dispose() {
      ticker.stop(); ro.disconnect(); if (av) disposeAvatar(av); pfx.dispose();
      for (const P of all) { P.body.geometry.dispose(); P.hull?.geometry.dispose(); }
      for (const g of [padGeo, arrowGeo, ringGeo, beamGeo, backGeo]) g.dispose();
      renderer.dispose();
    },
  };
}

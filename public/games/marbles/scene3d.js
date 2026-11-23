// Marble Rush 3D view (three.js). Purely visual: it replays the positions the server streams.
import * as THREE from 'three';
import { makeTrack, world, at, spinAngle, trapOpen, R, DS, DISH, WALL_H, GATE_S } from './track.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { bake } from '../../avatar3d.js';
import { toonify, toonMat, shell, skyDome, clouds, island, birds, createFx, shaker, disposeToon, STAR, DOT, CONF, nightScene } from '../../scenery3d.js';

const INK = '#3b2219', SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff';
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...o });
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const tmp = [0, 0, 0];

// A plain glass marble in one colour with a pale swirl, so you can see it spin.
function marbleTexture(color) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#ffffff8c'; g.lineWidth = 26;
  for (let k = -1; k < 3; k++) { g.beginPath(); g.moveTo(k * 256, 256); g.bezierCurveTo(k * 256 + 90, 170, k * 256 + 170, 90, k * 256 + 256, 0); g.stroke(); }
  g.strokeStyle = '#00000026'; g.lineWidth = 8;
  for (let k = -1; k < 3; k++) { g.beginPath(); g.moveTo(k * 256 + 40, 256); g.bezierCurveTo(k * 256 + 130, 170, k * 256 + 210, 90, k * 256 + 296, 0); g.stroke(); }
  g.fillStyle = '#00000022'; g.fillRect(0, 0, 512, 22); g.fillRect(0, 234, 512, 22);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

function stripeTexture(a, b, n = 8) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.fillStyle = b;
  const w = 128 / n;
  for (let i = -n; i < n * 2; i += 2) { g.beginPath(); g.moveTo(i * w, 0); g.lineTo((i + 1) * w, 0); g.lineTo((i + 1) * w - 128, 128); g.lineTo(i * w - 128, 128); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function checkTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
  const g = cv.getContext('2d');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#fff4e2' : INK; g.fillRect(x * 16, y * 16, 16, 16); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
function chevronTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#1f6f5a'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#b8ffe6'; g.lineWidth = 16; g.lineJoin = 'miter';
  for (const y of [28, 92]) { g.beginPath(); g.moveTo(14, y + 22); g.lineTo(64, y - 18); g.lineTo(114, y + 22); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// What you see down a trapdoor: open sky with a cloud, shaded round the rim so the hole reads as deep.
function holeTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#6fbdf2'); gr.addColorStop(1, '#c9ecff'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff'; for (const [x, y, r] of [[44, 78, 17], [64, 70, 22], [86, 80, 16], [30, 36, 9], [42, 33, 11]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = '#3b221988'; g.fillRect(0, 0, 128, 16); g.fillStyle = '#3b221955'; g.fillRect(0, 16, 12, 112); g.fillRect(116, 16, 12, 112); g.fillStyle = '#3b221933'; g.fillRect(0, 16, 128, 8);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function floorTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d'); g.fillStyle = '#f6e3c5'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#e9cfa8'; g.fillRect(0, 0, 64, 6); g.fillRect(0, 128, 64, 6);
  g.fillStyle = '#ffffff55'; g.fillRect(30, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function softDot() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// A strip of quads joining rails (arrays of points running along the track).
function ribbon(rails, vScale = 1) {
  const n = rails[0].length, m = rails.length, pos = new Float32Array(n * m * 3), uv = new Float32Array(n * m * 2), idx = [];
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const p = rails[j][i], o = (j * n + i);
    pos[o * 3] = p[0]; pos[o * 3 + 1] = p[1]; pos[o * 3 + 2] = p[2];
    uv[o * 2] = j / (m - 1); uv[o * 2 + 1] = i * vScale;
  }
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

export function createScene(canvas, { onFrame }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 2); // steps the resolution down if the device can't hold 60 fps
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 90, 330);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 900);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.castShadow = true;
  // the world: the track winds through a sunny sky, over a sea of clouds, past little floating islands and balloons
  const sky = skyDome(scene, SKY_TOP, SKY_LOW, { r: 600 });
  const cloudSea = clouds({ near: 90, far: 16, min: 8, max: 190, below: 0 }); scene.add(cloudSea);
  nightScene(scene); // the website's night mode carries into the game
  const birdG = new THREE.Group(); scene.add(birdG); const flyBirds = birds(birdG, 26, 9, 5, 1.6);
  const pfx = createFx(scene, { max: 1200 }), shake = shaker();
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  key.shadow.bias = -.0006; scene.add(key, key.target);

  let T = null, trackGroup = null, anim = [], marbles = [], seatsKey = '';
  let frames = [], renderT = 0, clockAt = 0, clockT = 0, playing = false;
  let stage = 'bet', follow = -1, camS = 0, camU = 0, camInit = false, flyT = 0, endT = 0;
  let fx = { roll: 0, rollTo: 0, shake: 0, fov: 48, fovTo: 48 };
  let won = false, emitIn = 0;
  const sharedGeo = new THREE.SphereGeometry(R, 32, 24);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function disposeTree(o) {
    o.traverse(x => {
      x.geometry?.dispose();
      for (const m of [].concat(x.material || [])) { m.map?.dispose(); m.dispose(); }
    });
  }

  // ---------- track ----------
  function setTrack(seed, short) {
    if (T && T.seed === seed && T.short === short) return;
    if (trackGroup) { scene.remove(trackGroup); disposeToon(trackGroup); }
    T = makeTrack(seed, short); anim = []; camInit = false; frames = []; clockAt = 0;
    const g = trackGroup = new THREE.Group(); scene.add(g);
    const step = 2, cnt = Math.floor((T.n - 1) / step) + 1;
    const rail = (uf, lift) => Array.from({ length: cnt }, (_, i) => {
      const s = Math.min(T.n - 1, i * step) * DS, hw = at(T.w, s) / 2;
      const u = uf(hw);
      return world(T, s, u, typeof lift === 'function' ? lift(hw, u) : lift, [0, 0, 0]);
    });
    const edge = hw => DISH * hw * hw;
    const fl = [];
    for (let k = 0; k <= 8; k++) fl.push(rail(hw => -hw + 2 * hw * k / 8, 0));
    const floor = new THREE.Mesh(ribbon(fl, .25), M('#ffffff', { map: floorTexture(), roughness: .5, side: THREE.DoubleSide }));
    floor.receiveShadow = true; g.add(floor);
    const trimM = new THREE.MeshBasicMaterial({ color: '#4a2c22', side: THREE.DoubleSide }), wallM = M('#e5543b', { roughness: .55, side: THREE.DoubleSide }), topM = M('#fff4e2', { roughness: .5, side: THREE.DoubleSide }), underM = M('#5a2a3c', { roughness: .9, side: THREE.DoubleSide });
    for (const sd of [-1, 1]) {
      const inner = hw => sd * hw, outer = hw => sd * (hw + .3);
      const fix = lift => (hw) => lift - DISH * (hw + .3) ** 2 + edge(hw); // keep outer faces level with the inner ones
      const a = rail(inner, 0), b = rail(inner, WALL_H), c = rail(outer, fix(WALL_H)), d = rail(outer, fix(-.45));
      const w1 = new THREE.Mesh(ribbon([a, b]), wallM), w2 = new THREE.Mesh(ribbon([b, c]), topM), w3 = new THREE.Mesh(ribbon([c, d]), wallM);
      w1.receiveShadow = true; w1.castShadow = w3.castShadow = true;
      g.add(w1, w2, w3);
      // dark trim along both edges of the rail top: the track's outline
      const up = WALL_H + .035;
      g.add(new THREE.Mesh(ribbon([rail(inner, up), rail(hw => sd * (hw + .07), fix(up))]), trimM), new THREE.Mesh(ribbon([rail(hw => sd * (hw + .23), fix(up)), rail(hw => sd * (hw + .31), fix(up - .03))]), trimM));
    }
    const fixB = hw => -.45 - DISH * (hw + .3) ** 2 + edge(hw);
    g.add(new THREE.Mesh(ribbon([rail(hw => -(hw + .3), fixB), rail(hw => hw + .3, fixB)]), underM));
    // end caps
    for (const s of [0, (T.n - 1) * DS]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(5.6, WALL_H + .45 + DISH * 6.25, .3), wallM);
      place(cap, s, 0, (WALL_H - .45 + DISH * 6.25) / 2 - .0); g.add(cap);
    }
    // ground and supports
    let minY = 0; for (let i = 0; i < T.n; i++) minY = Math.min(minY, T.y[i]);
    const groundY = minY - 7;
    const cx = (T.x[0] + T.x[T.n - 1]) / 2, cz = (T.z[0] + T.z[T.n - 1]) / 2;
    cloudSea.position.set(cx, groundY + 3, cz); sky.position.set(cx, groundY, cz); birdG.position.set(cx, (T.y[0] + minY) / 2, cz);
    const solid = new THREE.Group(); g.add(solid); // everything still and chunky: merged, then outlined in one go
    const postM = M('#b07a4f', { roughness: .8 });
    for (let s = 3; s < T.end; s += 9) {
      world(T, s, 0, -.5, tmp);
      const hgt = tmp[1] - groundY, post = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, hgt, 8), postM);
      post.position.set(tmp[0], groundY + hgt / 2, tmp[2]); solid.add(post);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.5, .16, .5), postM); brace.position.set(tmp[0], tmp[1] - .1, tmp[2]); solid.add(brace);
    }
    // floating islands and balloons drifting beside the track
    const cols = ['#ffb547', '#ff8fab', '#7ed3b2', '#8a98ff', '#ff7a59'];
    for (let s = 6, k = 0; s < T.end; s += 13, k++) {
      const side = k % 2 ? 1 : -1;
      world(T, s, side * (8 + (k * 37 % 5)), 1.5 + (k * 53 % 4), tmp);
      // keep clear of every other stretch of track
      let near = 1e9; for (let i = 0; i < T.n; i += 4) near = Math.min(near, Math.hypot(T.x[i] - tmp[0], T.z[i] - tmp[2]) + Math.max(0, Math.abs(T.y[i] - tmp[1]) - 5));
      if (near < 6.5) continue;
      let o;
      if (k % 3 === 1) { o = island(2.2, 2.2, { round: true, rim: .9, seed: k + 2, props: 5, size: 1.5, flowers: 6, depth: .5 }); o.position.set(tmp[0], tmp[1] - 2.5, tmp[2]); }
      else {
        o = new THREE.Group(); const c = cols[k % 5];
        const bal = new THREE.Mesh(new THREE.IcosahedronGeometry(.95, 1), M(c, { flatShading: true })); bal.scale.y = 1.15; bal.position.y = 1.5; o.add(bal);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(.98, .98, .28, 12), M('#fff4e2')); band.position.y = 1.5; o.add(band);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(.3, .2, .3, 8), M(c)); neck.position.y = .42; o.add(neck);
        const basket = new THREE.Mesh(new THREE.BoxGeometry(.42, .32, .42), M('#b07a4f')); basket.position.y = -.25; o.add(basket);
        for (const [x, z] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .6, 4), M('#5b4636')); r.position.set(x, .12, z); o.add(r); }
        bake(o); toonify(o, .045); o.position.set(tmp[0], tmp[1] + 1, tmp[2]);
      }
      o.userData.y = o.position.y; g.add(o);
      anim.push(t => { o.position.y = o.userData.y + Math.sin(t * .8 + k) * .35; if (k % 3 !== 1) o.rotation.y = Math.sin(t * .3 + k) * .4; });
    }
    // pins: springy mushroom bumpers. Stems are part of the merged scenery; the caps squash when a marble bumps them.
    {
      const stemM = M('#fff4e2'), ringM = M('#ffb547'), n = T.pins.length;
      const capGeo = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * .55); capGeo.translate(0, -.12, 0);
      const caps = new THREE.InstancedMesh(capGeo, toonMat(M('#ffffff')), Math.max(1, n)), capInk = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ color: '#4a2c22', side: THREE.BackSide }), Math.max(1, n));
      const dotGeo = new THREE.SphereGeometry(.2, 8, 6), dots = new THREE.InstancedMesh(dotGeo, toonMat(M('#fff4e2')), Math.max(1, n * 3));
      caps.count = capInk.count = n; dots.count = n * 3; caps.castShadow = true; caps.frustumCulled = capInk.frustumCulled = dots.frustumCulled = false; g.add(capInk, caps, dots);
      const d = new THREE.Object3D(), d2 = new THREE.Object3D(), c3 = new THREE.Color(), capCols = ['#ff7a59', '#7ed3b2', '#ff8fab', '#8a98ff'], bump = new Float32Array(n);
      d.add(d2);
      T.pins.forEach((p, i) => {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(p.r * .62, p.r * .8, .7, 10), stemM); place(st, p.s, p.u, .35); solid.add(st);
        const rg = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.25, p.r * 1.35, .08, 12), ringM); place(rg, p.s, p.u, .04); solid.add(rg);
        caps.setColorAt(i, c3.set(capCols[i % 4]));
      });
      const setCaps = () => T.pins.forEach((p, i) => {
        const b = bump[i], sq = 1 - Math.sin(b * Math.PI) * .32 * b, wide = 1 + Math.sin(b * Math.PI) * .22 * b;
        place(d, p.s, p.u, .78 - (1 - sq) * .2); d.scale.set(p.r * 1.75 * wide, p.r * 1.75 * sq, p.r * 1.75 * wide); d.updateMatrixWorld(true); caps.setMatrixAt(i, d.matrix);
        for (let k = 0; k < 3; k++) { const a = k * 2.094 + i; d2.position.set(Math.cos(a) * .62, .52, Math.sin(a) * .62); d2.scale.setScalar(1); d2.updateMatrixWorld(true); dots.setMatrixAt(i * 3 + k, d2.matrixWorld); }
        d.scale.multiplyScalar(1.13); d.position.y -= .01; d.updateMatrix(); capInk.setMatrixAt(i, d.matrix);
      });
      setCaps(); if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
      anim.push((t, st, dt) => {
        let live = false;
        for (let i = 0; i < n; i++) {
          const p = T.pins[i];
          if (bump[i] <= 0 && playing) for (const m of marbles) if (m.st === 0 && Math.abs(m.s - p.s) < p.r + R + .16 && Math.abs(m.u - p.u) < p.r + R + .16) { bump[i] = 1; if (!reduced) { world(T, p.s, p.u, .9, tmp); pfx.burst(tv.set(tmp[0], tmp[1], tmp[2]), { n: 5, colors: [capCols[i % 4], '#ffffff'], speed: 2.2, up: 2.5, size: .26, life: .5 }); } break; }
          if (bump[i] > 0) { bump[i] = Math.max(0, bump[i] - dt * 3.2); live = true; }
        }
        if (live || anim.capsDirty) { setCaps(); caps.instanceMatrix.needsUpdate = capInk.instanceMatrix.needsUpdate = dots.instanceMatrix.needsUpdate = true; anim.capsDirty = live; }
      });
    }
    // spinners: a striped paddle with rubber bumpers on its ends, turning on a bolted hub over a warning ring
    for (const sp of T.spinners) {
      const hub = new THREE.Group(); place(hub, sp.s, sp.u, 0); g.add(hub);
      const warn = new THREE.Mesh(new THREE.RingGeometry(sp.hl - .12, sp.hl + .1, 40), new THREE.MeshBasicMaterial({ map: stripeTexture('#ffb547', INK, 12), transparent: true, opacity: .55 })); warn.rotation.x = -Math.PI / 2; warn.position.y = .15; hub.add(warn);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(.5, .56, .1, 16), M('#8a8794')); plate.position.y = .05; hub.add(plate);
      for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), M('#5b4636')); b.position.set(Math.cos(k * 1.047) * .41, .11, Math.sin(k * 1.047) * .41); hub.add(b); }
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.2, .26, .8, 14), M('#fff4e2')); post.position.y = .4; hub.add(post);
      const arm = new THREE.Group(); arm.userData.dyn = true; arm.position.y = .36; hub.add(arm);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.32, .34, sp.hl * 2 - .3), M('#ffb547', { map: stripeTexture('#ffb547', '#e5543b', 6), roughness: .45 }));
      bar.castShadow = true; arm.add(bar); shell(bar, 1).scale.set(1.25, 1.22, 1 + .08 / sp.hl);
      for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.26, 12, 9), M('#e5543b')); e.position.z = sd * (sp.hl - .2); e.castShadow = true; arm.add(e); shell(e, 1.16); }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10), M('#e5543b')); knob.position.y = .82; hub.add(knob);
      const star = new THREE.Mesh(new THREE.ConeGeometry(.16, .22, 5), M('#ffd84a')); star.position.y = 1.18; hub.add(star);
      toonify(arm); toonify(hub, .035);
      anim.push((t, st) => { arm.rotation.y = spinAngle(sp, st); star.rotation.y = -t * 2; });
    }
    // trapdoors: a framed hole in the track with the sky showing through, a hazard lid that slides shut, and
    // lamps that flash just before it opens
    for (const tr of T.traps) {
      const len = tr.s1 - tr.s0, wid = tr.u1 - tr.u0, mid = (tr.s0 + tr.s1) / 2, um = (tr.u0 + tr.u1) / 2;
      const pg = new THREE.Group(); place(pg, mid, um, .03 + DISH * um * um * .5); g.add(pg);
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), new THREE.MeshBasicMaterial({ map: holeTexture() })); pit.rotation.x = -Math.PI / 2; pg.add(pit);
      const frameM = M('#ffffff', { map: stripeTexture('#ffb547', INK, 8), roughness: .5 }), fr = new THREE.Group(); pg.add(fr);
      for (const [w, d, x, z] of [[wid + .36, .18, 0, -len / 2 - .09], [wid + .36, .18, 0, len / 2 + .09], [.18, len, -wid / 2 - .09, 0], [.18, len, wid / 2 + .09, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, .12, d), frameM); b.position.set(x, .05, z); fr.add(b); }
      const edge = new THREE.Mesh(new THREE.BoxGeometry(wid + .46, .1, len + .46), new THREE.MeshBasicMaterial({ color: '#4a2c22' })); edge.position.y = .0; fr.add(edge); pit.position.y = .056;
      const lamps = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => { const l = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#7ed3b2' })); l.position.set(sx * (wid / 2 + .09), .17, sz * (len / 2 + .09)); pg.add(l); return l; });
      const tex = stripeTexture('#ffb547', INK, 6); tex.repeat.set(1, 1);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(wid, .07, len), M('#ffffff', { map: tex, roughness: .5 })); lid.position.y = .09; pg.add(lid);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(wid * .5, .05, .16), M('#8a8794')); grip.position.set(0, .06, len / 2 - .3); lid.add(grip);
      let k = 1, was = false;
      anim.push((t, st, dt) => {
        const open = trapOpen(tr, st), ph = ((st + tr.ph) % tr.per) / tr.per, soon = !open && ph > .78;
        const to = open ? 0 : 1; k += (to - k) * Math.min(1, dt * 14);
        lid.scale.z = Math.max(.02, k); lid.position.z = -(1 - k) * len / 2; lid.visible = k > .04;
        if (soon && !reduced) lid.position.x = Math.sin(t * 60) * .025; else lid.position.x = 0; // it rattles before it goes
        const col = open ? '#ff5a3c' : soon ? (Math.sin(t * 22) > 0 ? '#ff5a3c' : '#ffd84a') : '#7ed3b2';
        for (const l of lamps) { l.material.color.set(col); l.scale.setScalar(open || soon ? 1.25 : 1); }
        if (open !== was) { was = open; if (!reduced && playing) { world(T, mid, um, .2, tmp); pfx.puff(tv.set(tmp[0], tmp[1], tmp[2]), { n: 8, size: .4, speed: 2.4, life: .4 }); } }
      });
    }
    // boost pads: scrolling chevrons, glowing hoops to fly through and arrow signs on the rails
    for (const b of T.boosts) {
      const len = b.s1 - b.s0, tex = chevronTexture(); tex.repeat.set(2, 1.5);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(4.3, len), new THREE.MeshBasicMaterial({ map: tex }));
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = Math.PI; const pg = new THREE.Group(); pg.add(pad); place(pg, (b.s0 + b.s1) / 2, 0, .1); g.add(pg);
      const edgeM = new THREE.MeshBasicMaterial({ color: '#b8ffe6' });
      for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.1, .05, len), edgeM); e.position.set(sd * 2.2, .02, 0); pg.add(e); }
      const hoops = [.12, .5, .88].map((f, i) => {
        const hg = new THREE.Group(); place(hg, b.s0 + len * f, 0, 0); g.add(hg);
        const mat = new THREE.MeshBasicMaterial({ color: '#7ed3b2' });
        const arc = new THREE.Mesh(new THREE.TorusGeometry(2.85, .11, 8, 28, Math.PI), mat); arc.position.y = WALL_H; hg.add(arc);
        const ink = new THREE.Mesh(new THREE.TorusGeometry(2.85, .17, 8, 28, Math.PI), new THREE.MeshBasicMaterial({ color: '#1f6f5a', side: THREE.BackSide })); ink.position.y = WALL_H; hg.add(ink);
        for (const sd of [-1, 1]) { const f2 = new THREE.Mesh(new THREE.BoxGeometry(.36, .2, .36), M('#1f6f5a')); f2.position.set(sd * 2.85, WALL_H + .06, 0); hg.add(f2); }
        toonify(hg);
        return { mat, i };
      });
      const cA = new THREE.Color('#2fae8c'), cB = new THREE.Color('#eafff7');
      anim.push(t => { tex.offset.y = -t * 1.6; for (const h of hoops) h.mat.color.copy(cA).lerp(cB, Math.max(0, Math.sin(t * 7 - h.i * 1.3)) ** 2); edgeM.color.copy(cA).lerp(cB, .5 + Math.sin(t * 7) * .5); });
    }
    // finish: a chequered arch with bunting, balloons on the posts and a chequered line
    {
      const fg = new THREE.Group(); place(fg, T.L, 0, 0); g.add(fg);
      const postM2 = M('#fff4e2'), band = M('#e5543b');
      for (const sd of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(.18, .2, 4.2, 12), postM2); p.position.set(sd * 2.95, 2.1, 0); fg.add(p);
        for (const y of [.5, 1.5, 2.5]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .4, 12), band); r.position.set(sd * 2.95, y, 0); fg.add(r); }
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .3, 12), M('#8a8794')); foot.position.set(sd * 2.95, .15, 0); fg.add(foot);
        [['#ff7a59', 0, 0], ['#ffd84a', .38, .3], ['#7ed3b2', -.36, .26]].forEach(([c, dx, dy], k) => {
          const bl = new THREE.Group(); bl.userData.dyn = true; bl.position.set(sd * 2.95 + dx, 4.95 + dy, 0); fg.add(bl);
          const m = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 10), M(c)); m.scale.y = 1.2; bl.add(m); shell(m, 1.12); toonify(bl);
          anim.push(t => { bl.position.y = 4.95 + dy + Math.sin(t * 1.6 + k * 2 + sd) * .09; bl.rotation.z = Math.sin(t * 1.1 + k + sd) * .12; });
        });
      }
      const ct = checkTexture(); ct.wrapS = THREE.RepeatWrapping; ct.repeat.set(1.5, 1);
      const ban = new THREE.Mesh(new THREE.BoxGeometry(6.1, 1, .12), M('#ffffff', { map: ct, roughness: .6 })); ban.position.y = 3.7; fg.add(ban);
      const flagCols = ['#ff7a59', '#ffd84a', '#7ed3b2', '#8a98ff', '#ff8fab'];
      for (let k = 0; k < 11; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.2, .42, 3), M(flagCols[k % 5])); f.rotation.x = Math.PI; f.scale.z = .25; f.position.set(-2.5 + k * .5, 2.98, 0); fg.add(f); }
      const line = new THREE.Mesh(new THREE.PlaneGeometry(5, .9), new THREE.MeshBasicMaterial({ map: checkTexture() }));
      line.rotation.x = -Math.PI / 2; line.position.y = .12; fg.add(line); shell(ban, 1).scale.set(1.03, 1.16, 2.2); toonify(fg, .04);
    }
    // start gate: a striped bar between two posts whose lamps go from red to green
    {
      const gg = new THREE.Group(); place(gg, GATE_S + .12, 0, 0); g.add(gg);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(5, .5, .14), M('#ffb547', { map: stripeTexture('#ffb547', INK, 10), roughness: .5 }));
      bar.position.y = .38; bar.userData.dyn = true; gg.add(bar);
      const lampM = new THREE.MeshBasicMaterial({ color: '#ff5a3c' });
      for (const sd of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, 1.1, 10), M('#fff4e2')); p.position.set(sd * 2.65, WALL_H + .55, 0); gg.add(p);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .22, 10), M('#e5543b')); band.position.set(sd * 2.65, WALL_H + .5, 0); gg.add(band);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(.22, .15, .14, 10), M('#5b4636')); cup.position.set(sd * 2.65, WALL_H + 1.13, 0); gg.add(cup);
        const l = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 9), lampM); l.position.set(sd * 2.65, WALL_H + 1.32, 0); gg.add(l);
      }
      let k = 0;
      anim.push((t, st, dt) => { const to = playing ? 1 : 0; k += (to - k) * Math.min(1, dt * 9); bar.position.y = .38 + k * 2.6; lampM.color.set(playing ? '#5ee08a' : stage === 'count' ? (Math.sin(t * 10) > 0 ? '#ffd84a' : '#ff5a3c') : '#ff5a3c'); });
      shell(bar, 1).scale.set(1.02, 1.22, 1.9); toonify(gg, .04);
    }
    bake(solid); solid.traverse(o => { if (o.isMesh) o.castShadow = true; }); toonify(solid, .045);
    toonify(g); // flat cartoon shading on the track itself
  }
  // Put an object on the track, facing along it and tilted with the slope.
  function place(o, s, u, lift) {
    world(T, s, u, lift, tmp); o.position.set(tmp[0], tmp[1], tmp[2]);
    o.rotation.set(Math.atan(at(T.sl, s)), at(T.h, s), 0, 'YXZ');
  }

  // ---------- marbles ----------
  // A small arrow that bobs and spins over your own marble.
  const arrow = new THREE.Group(), arrowM = new THREE.MeshStandardMaterial({ color: '#ffb547', emissive: '#ffb547', emissiveIntensity: .45, roughness: .4, flatShading: true });
  {
    const head = new THREE.Mesh(new THREE.ConeGeometry(.2, .3, 4), arrowM); head.rotation.x = Math.PI; head.position.y = .15;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(.11, .22, .11), arrowM); shaft.position.y = .4;
    arrow.add(head, shaft); arrow.visible = false; scene.add(arrow);
  }
  let mine = -1;
  function setMarbles(seats) {
    const key = seats.map(p => p.color + p.name).join('|');
    if (key === seatsKey) return;
    seatsKey = key;
    for (const m of marbles) { scene.remove(m.mesh); m.mesh.material.map.dispose(); m.mesh.material.dispose(); }
    marbles = seats.map(p => {
      const mesh = new THREE.Mesh(sharedGeo, toonMat(new THREE.MeshStandardMaterial({ map: marbleTexture(p.color) })));
      shell(mesh, 1.09); mesh.castShadow = true; mesh.rotation.y = -Math.PI / 2; scene.add(mesh);
      return { mesh, s: 0, u: 0, st: 0, fall: 0, pop: 1, has: false, pos: new THREE.Vector3(), color: p.color, tag: { x: 0, y: 0, show: false } };
    });
  }

  // ---------- playback ----------
  function pushFrames(list, simT, isPlaying) {
    if (playing !== isPlaying) { playing = isPlaying; if (!isPlaying) frames = []; }
    // Between races the server sends one frame: where the marbles stand now. A new race restarts
    // its frame numbers, so never compare against frames kept from the race before.
    if (!playing) frames = [];
    for (const f of list) {
      if (frames.length && f.i <= frames[frames.length - 1].i) continue;
      if (frames.length && f.t < frames[frames.length - 1].t) frames = []; // a new heat started
      frames.push(f);
    }
    if (frames.length > 80) frames.splice(0, frames.length - 80);
    if (!playing) { renderT = frames.length ? frames[frames.length - 1].t : 0; clockAt = 0; return; }
    const now = performance.now(), want = simT - 320;
    if (!clockAt || Math.abs(want - (clockT + now - clockAt)) > 1200) { clockAt = now; clockT = Math.max(0, want); }
    else { const cur = clockT + now - clockAt; clockT = cur + (want - cur) * .12; clockAt = now; }
  }
  function sample() {
    if (!frames.length) return;
    if (playing) renderT = clockT + performance.now() - clockAt;
    let a = frames[0], b = frames[0];
    for (let i = frames.length - 1; i >= 0; i--) if (frames[i].t <= renderT) { a = frames[i]; b = frames[i + 1] || a; break; }
    const k = b.t > a.t ? Math.min(1, (renderT - a.t) / (b.t - a.t)) : 0;
    for (let i = 0; i < marbles.length; i++) {
      const m = marbles[i], s0 = a.d[i * 3] / 100, s1 = b.d[i * 3] / 100, u0 = a.d[i * 3 + 1] / 100, u1 = b.d[i * 3 + 1] / 100;
      const jump = Math.abs(s1 - s0) > 3.5 || b.d[i * 3 + 2] !== a.d[i * 3 + 2];
      m.ps = m.s; m.s = jump ? s0 : s0 + (s1 - s0) * k; m.u = jump ? u0 : u0 + (u1 - u0) * k;
      const st = a.d[i * 3 + 2];
      if (st !== m.st) { if (st === 1) m.fall = 0; if (m.st === 1 && st !== 1) m.pop = 0; m.st = st; }
      m.has = true;
    }
  }

  function burst(i, color, n = 14) {
    const m = marbles[i]; if (!m || reduced) return;
    pfx.burst(m.pos, { n, colors: [color, '#ffffff'], speed: 5.5, up: 5, size: .42, life: .8, grav: 12 }); pfx.ring(m.pos, { color, size: 2.2 });
  }
  const onBoost = s => T.boosts.some(b => s >= b.s0 && s <= b.s1);

  // ---------- frame loop ----------
  const q = new THREE.Quaternion(), axis = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), prev = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), proj = new THREE.Vector3(), tv = new THREE.Vector3(), camAt = new THREE.Vector3();
  const lookNow = new THREE.Vector3();
  let W = 0, H = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  function leader() {
    let best = -1, bs = -1;
    for (let i = 0; i < marbles.length; i++) { const m = marbles[i]; if (m.st === 0 && m.s > bs) { bs = m.s; best = i; } }
    if (best < 0) for (let i = 0; i < marbles.length; i++) { const m = marbles[i]; if (m.st !== 3 && m.s > bs) { bs = m.s; best = i; } }
    return best;
  }
  function loop(dt, now) {
    const t = now / 1000;
    resize();
    if (!T) { renderer.render(scene, camera); return; }
    sample();
    const st = renderT / 1000;
    for (const f of anim) f(t, st, dt);
    emitIn -= dt; const emit = emitIn <= 0; if (emit) emitIn = .07;
    // marbles
    for (const m of marbles) {
      if (!m.has || m.st === 3) { m.mesh.visible = false; m.tag.show = false; continue; }
      prev.copy(m.pos);
      world(T, m.s, m.u, R, tmp); m.pos.set(tmp[0], tmp[1], tmp[2]);
      let vis = true;
      if (m.st === 1) { if (!m.fall && !reduced) { pfx.puff(m.pos, { n: 10, size: .5, speed: 3 }); pfx.ring(m.pos, { color: '#ffffff', size: 2 }); } m.fall += dt; m.pos.y -= 9 * m.fall * m.fall; vis = m.fall < .9; }
      if (m.pop < 1 && !m.popped && !reduced) { m.popped = true; pfx.ring(m.pos, { color: '#ffffff', size: 2.2 }); pfx.burst(m.pos, { n: 10, colors: ['#ffffff', m.color], speed: 3, up: 3, size: .3 }); } else if (m.pop >= 1) m.popped = false;
      if (m.pop < 1) m.pop = Math.min(1, m.pop + dt * 4);
      m.mesh.visible = vis; m.mesh.scale.setScalar(m.pop < 1 ? .3 + .7 * (1 + .6 * Math.sin(m.pop * Math.PI)) * m.pop : 1);
      m.mesh.position.copy(m.pos);
      axis.subVectors(m.pos, prev); const d = axis.length();
      if (d > 1e-4 && d < 2 && m.st !== 1) { axis.crossVectors(up, axis).normalize(); q.setFromAxisAngle(axis, d / R); m.mesh.quaternion.premultiply(q); }
      // trails: sparks on a boost pad, dust when rolling fast, and a pop of stars over the finish line
      if (playing && !reduced && vis && m.st !== 1 && emit) {
        if (onBoost(m.s)) pfx.rise(m.pos, { color: ['#b8ffe6', '#ffffff', '#7ed3b2'], shape: STAR, size: .34, life: .5, speed: 1.6, wobble: 1.2, grow: -.4 });
        else if (d / Math.max(dt, .001) > 7) pfx.rise(tv.copy(m.pos).setY(m.pos.y - R * .8), { color: '#fff4e2', size: .26, life: .4, speed: .3, wobble: .5, grow: 1.2 });
      }
      if (playing && m.s >= T.L && !m.done) { m.done = true;
        if (!reduced) { pfx.burst(m.pos, { n: 18, colors: [m.color, '#ffffff', '#ffd84a'], speed: 5, up: 6, size: .4, life: 1 });
          if (!won) { won = true; pfx.confetti(m.pos, { n: 150, w: 9, h: 6, size: .32, life: 3 }); shake.kick(.25); } }
      } else if (m.s < T.L - 2) m.done = false;
    }
    if (!playing || marbles.every(m => m.s < T.L - 2)) won = false;
    // camera
    const lead = leader(), target = follow >= 0 && marbles[follow] && marbles[follow].st !== 3 ? follow : lead;
    const tm = marbles[target];
    if (stage === 'bet') { // fly down the track so everyone can see what's coming
      flyT += dt; const s = (flyT * 13) % Math.max(20, T.L - 6);
      world(T, Math.max(0, s - 7), 0, 6.5, tmp); want.set(tmp[0], tmp[1], tmp[2]);
      world(T, s + 9, 0, .5, tmp); look.set(tmp[0], tmp[1], tmp[2]);
    } else if (stage === 'count' || !tm) {
      world(T, GATE_S + 8.5, 2.2, 5.6, tmp); want.set(tmp[0], tmp[1], tmp[2]);
      world(T, GATE_S - 1.5, 0, .4, tmp); look.set(tmp[0], tmp[1], tmp[2]);
    } else if (stage === 'end' || stage === 'gap') {
      endT += dt; const a = endT * .25, cs = T.L + 6;
      world(T, cs, 0, 0, tmp); look.set(tmp[0], tmp[1] + .5, tmp[2]);
      want.set(tmp[0] + Math.sin(a) * 12, tmp[1] + 6.5, tmp[2] + Math.cos(a) * 12);
    } else {
      const ts = tm.st === 1 ? camS : tm.s;
      if (Math.abs(ts - camS) > 30) { camS = ts; camU = tm.u; camInit = false; } // cut instead of a long pan
      camS += (ts - camS) * Math.min(1, dt * (Math.abs(ts - camS) > 12 ? 2 : 5)); camU += (tm.u - camU) * Math.min(1, dt * 2);
      world(T, Math.max(0, camS - 10.5), camU * .35, 6.4, tmp); want.set(tmp[0], tmp[1], tmp[2]);
      world(T, Math.min(T.end, camS + 1.2), camU * .6, 1, tmp); look.set(tmp[0], tmp[1], tmp[2]);
    }
    if (stage !== 'end' && stage !== 'gap') endT = 0;
    if (stage !== 'bet') flyT = 0;
    if (!camInit) { camAt.copy(want); lookNow.copy(look); camInit = true; if (tm) { camS = tm.s; camU = tm.u; } }
    const kk = Math.min(1, dt * (stage === 'race' ? 6 : 2.5));
    camAt.lerp(want, kk); lookNow.lerp(look, kk); camera.position.copy(camAt);
    camera.up.set(0, 1, 0); camera.lookAt(lookNow);
    fx.roll += (fx.rollTo - fx.roll) * Math.min(1, dt * 4);
    if (Math.abs(fx.roll) > .002) camera.rotateZ(fx.roll);
    if (fx.shake > 0 && !reduced) { camera.position.x += (Math.random() - .5) * .35; camera.position.y += (Math.random() - .5) * .35; }
    fx.fov += (fx.fovTo - fx.fov) * Math.min(1, dt * 4);
    if (Math.abs(camera.fov - fx.fov) > .05) { camera.fov = fx.fov; camera.updateProjectionMatrix(); }
    key.target.position.copy(lookNow); key.position.set(lookNow.x + 9, lookNow.y + 24, lookNow.z - 7);
    shake.apply(camera, dt);
    cloudSea.rotation.y = t * .004; flyBirds(t); // (the birds circle the world's middle)
    pfx.update(dt, camera, H);
    const mm = marbles[mine];
    arrow.visible = !!mm && mm.mesh.visible;
    if (arrow.visible) {
      arrow.position.copy(mm.pos); arrow.position.y += R + .16 + (reduced ? 0 : Math.sin(t * 3.2) * .09);
      arrow.rotation.y = reduced ? 0 : t * 2.4;
    }
    renderer.render(scene, camera);
    // screen positions of the marbles (reactions float up from them)
    for (const m of marbles) {
      if (!m.mesh.visible) { m.tag.show = false; continue; }
      proj.copy(m.pos); proj.y += R + .25; proj.project(camera);
      m.tag.show = proj.z < 1 && proj.z > -1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      m.tag.x = (proj.x + 1) / 2 * W; m.tag.y = (1 - proj.y) / 2 * H;
      m.tag.d = camera.position.distanceTo(m.pos);
    }
    onFrame?.({ tags: marbles.map(m => m.tag), s: marbles.map(m => m.s), st: marbles.map(m => m.st), target, L: T.L });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setTrack, setMarbles, pushFrames, burst,
    setStage(s) { stage = s; },
    setFollow(i) { follow = i; },
    setMe(i) { mine = i; },
    setChaos(k) {
      fx.rollTo = k === 'flip' && !reduced ? Math.PI : 0;
      fx.shake = k === 'quake' ? 1 : 0;
      fx.fovTo = k === 'turbo' ? 62 : 48;
    },
    dispose() {
      ticker.stop();
      if (trackGroup) disposeToon(trackGroup); pfx.dispose();
      for (const m of marbles) { m.mesh.material.map.dispose(); m.mesh.material.dispose(); }
      sharedGeo.dispose(); arrow.traverse(o => o.geometry?.dispose()); arrowM.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

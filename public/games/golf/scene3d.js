// Mini Golf Party 3D view (three.js). Purely visual: it draws the hole the server picked, replays the ball
// paths the server worked out, and turns a drag on the screen into an aim and a power for your next putt.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar } from '../../avatar3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { ballLook } from '../../skins.js';
import { toonify, toonMat, skyDome, clouds as cloudSea, island, birds, petals, createFx, shaker, disposeToon, STAR, DOT, CONF, HEART, nightScene } from '../../scenery3d.js';
import { buildHole, ground, pathAt, spinAngle, simulate, BALL_R, CUP_R } from './course.js';

const INK = '#3b2219', SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff', BASE = -.14, AV = .46, WALL_H = .24;
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// each tile edge: neighbour offset, our two corners on it (h order nw, ne, se, sw), the neighbour's matching corners, outward normal
const SIDES = [[1, 0, 3, 2, 0, 1, [0, 0, 1]], [-1, 0, 0, 1, 3, 2, [0, 0, -1]], [0, 1, 1, 2, 0, 3, [1, 0, 0]], [0, -1, 0, 3, 1, 2, [-1, 0, 0]]];
const WIND = 240; // ms of backswing shown before another player's ball sets off

// Collects flat-shaded, vertex-coloured boxes, prisms and quads into one geometry: the whole course is one draw call.
function mesher() {
  const pos = [], col = [], c = new THREE.Color(), A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  const tri = (a, b, d) => { for (const p of [a, b, d]) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); } };
  // corners in order round the face; `out` is roughly the way the face should look, so winding mistakes cannot happen
  function quad(a, b, d, e, color, out) {
    c.set(color);
    A.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); B.set(e[0] - a[0], e[1] - a[1], e[2] - a[2]); N.crossVectors(A, B);
    if (N.x * out[0] + N.y * out[1] + N.z * out[2] < 0) { tri(a, e, d); tri(a, d, b); } else { tri(a, b, d); tri(a, d, e); }
  }
  function box(x, y, z, sx, sy, sz, color, ry = 0, top = color) {
    const cs = Math.cos(ry), sn = Math.sin(ry), P = (px, py, pz) => [x + px * cs + pz * sn, y + py, z - px * sn + pz * cs];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, R = (nx, nz) => [nx * cs + nz * sn, 0, -nx * sn + nz * cs];
    quad(P(-hx, hy, -hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), top, [0, 1, 0]);
    quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, -hy, -hz), color, [0, -1, 0]);
    quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), color, R(0, 1));
    quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), color, R(0, -1));
    quad(P(hx, -hy, -hz), P(hx, -hy, hz), P(hx, hy, hz), P(hx, hy, -hz), color, R(1, 0));
    quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), color, R(-1, 0));
  }
  // an n-sided column from y0 (radius r0) to y1 (radius r1); r1 = 0 makes a cone
  function prism(x, y0, y1, z, r0, r1, n, color, top = color, turn = 0) {
    for (let i = 0; i < n; i++) {
      const a = turn + i / n * Math.PI * 2, b = turn + (i + 1) / n * Math.PI * 2, m = (a + b) / 2;
      const p0 = [x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0], p1 = [x + Math.cos(b) * r0, y0, z + Math.sin(b) * r0];
      const q0 = [x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1], q1 = [x + Math.cos(b) * r1, y1, z + Math.sin(b) * r1];
      quad(p0, p1, q1, q0, color, [Math.cos(m), .2, Math.sin(m)]);
      if (r1 > 0) { c.set(top); const up = [x, y1, z]; A.set(q1[0] - q0[0], 0, q1[2] - q0[2]); if (A.x * (z - q0[2]) - A.z * (x - q0[0]) > 0) tri(q0, up, q1); else tri(q0, q1, up); }
    }
  }
  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  return { quad, box, prism, build };
}
export function createScene(canvas, { onFrame, onCue, canAim, onShot, onAim } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 70, 190);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 400);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-7, 18, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; scene.add(sun);

  // the shared sky-island look: gradient sky, a sea of clouds, birds and drifting petals
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = cloudSea({ min: 15, max: 85, below: -10 }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const flyBirds = birds(scene, 20, 6, 4, 1.1), blow = petals(scene, 24, 4, { n: 9, size: .12 });
  const fx = createFx(scene), shake = shaker(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, ...o });
  const courseMat = flat(), waterMat = new THREE.MeshStandardMaterial({ color: '#4fb8ef', roughness: .25, flatShading: true, transparent: true, opacity: .88 });
  const putterMats = [toonMat(new THREE.MeshStandardMaterial({ color: '#d9dde3' })), toonMat(new THREE.MeshStandardMaterial({ color: '#5b4636' }))];
  const ballGeo = new THREE.IcosahedronGeometry(BALL_R, 2), inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  let H = null, holeG = null, holeKey = '', spinMeshes = [], blades = [], flag = null, water = null;
  let players = [], seatsKey = '', me = -1, turn = -1, turnAt = 0, stage = 'bet', clockBase = performance.now(), frozen = 0;
  const arrow = youArrow(); arrow.visible = false; arrow.scale.setScalar(.7); scene.add(arrow);

  // aim arrow: a strip that grows with the power, plus a row of dots showing the line
  const aimG = new THREE.Group(); aimG.visible = false; scene.add(aimG);
  const aimMat = new THREE.MeshBasicMaterial({ color: '#7ed957', transparent: true, opacity: .95, depthTest: false });
  const aimStrip = new THREE.Mesh(new THREE.BoxGeometry(.11, .02, 1), aimMat); aimStrip.renderOrder = 5; aimG.add(aimStrip);
  const aimTip = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 4), aimMat); aimTip.rotation.x = Math.PI / 2; aimTip.renderOrder = 5; aimG.add(aimTip);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .75, depthTest: false });
  // the preview: dots along the first half of the roll the ball will really take (worked out with the same physics as
  // the server), and never past its first bounce. Where it stops, and whether it drops, is for the player to judge.
  const PRE_N = 48, PRE_PART = .5, preGeo = new THREE.CircleGeometry(.07, 10); preGeo.rotateX(-Math.PI / 2);
  const pre = new THREE.InstancedMesh(preGeo, dotMat, PRE_N); pre.renderOrder = 4; pre.frustumCulled = false; pre.visible = false; scene.add(pre);
  const preM = new THREE.Matrix4(); let preKey = '', preAt = 0;
  function preview(x, z, ang, pow, t0) {
    const r = simulate(H, x, z, ang, pow, t0, 7), P = r.path, n = P.length / 2;
    const cut = r.fx.length ? Math.min(n - 1, r.fx[0][0]) : n - 1; // path index of the first bounce
    let total = 0; for (let i = 1; i < n; i++) total += Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]) / 100;
    const show = total * PRE_PART;
    let k = 0, acc = .12, gone = 0, px = P[0] / 100, pz = P[1] / 100;
    for (let i = 1; i <= cut && k < PRE_N && gone < show; i++) {
      const qx = P[i * 2] / 100, qz = P[i * 2 + 1] / 100, seg = Math.hypot(qx - px, qz - pz);
      while (acc <= seg && k < PRE_N && gone + acc < show) {
        const u = acc / seg, dx = px + (qx - px) * u, dz = pz + (qz - pz) * u, sc = 1 - .6 * (gone + acc) / show; // the dots shrink as the line runs out
        if (Math.hypot(dx - x, dz - z) > BALL_R + .12) { preM.makeScale(sc, 1, sc).setPosition(dx, hAt(dx, dz) + .035, dz); pre.setMatrixAt(k++, preM); }
        acc += .2;
      }
      acc -= seg; gone += seg; px = qx; pz = qz;
    }
    pre.count = k; pre.instanceMatrix.needsUpdate = true;
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(BALL_R + .06, BALL_R + .12, 20), new THREE.MeshBasicMaterial({ color: '#fff4e2', transparent: true, opacity: .9, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 3; ring.visible = false; scene.add(ring);
  const aim = { on: false, ang: 0, pow: 0, drag: false, kb: false, p0: new THREE.Vector3(), sx: 0, sy: 0 };

  const hAt = (x, z) => { const g = ground(H, x, z); return g.tile ? g.h : BASE - .02; };

  // ---------- the hole ----------
  function setHole(def) {
    const key = def.key ?? def.i + '/' + (def.mirror ? 1 : 0);
    if (key === holeKey) return;
    holeKey = key;
    if (holeG) { scene.remove(holeG); disposeToon(holeG); }
    H = buildHole(def.i, def.mirror);
    const g = holeG = new THREE.Group(); scene.add(g);
    const M = mesher(), W = mesher(), { rows, cols } = H;
    spinMeshes = []; blades = [];
    // the floating island under the course, with trees and flowers round its rim
    const iw = cols + 1.2, id = rows + 2.6;
    const land = island(iw, id, { rim: 2.3, seed: (typeof def.i === 'number' ? def.i : H.rows * 7 + H.cols + H.name.length) + 3, props: 16, flowers: 46, size: 1.15 }); land.position.set(0, BASE - .1, -.5); g.add(land);
    // tiles
    for (const row of H.t) for (const T of row) {
      if (!T) continue;
      const x0 = T.x - .5, x1 = T.x + .5, z0 = T.z - .5, z1 = T.z + .5, [nw, ne, se, sw] = T.h, wet = T.k === 'w';
      const dark = (T.r + T.c) % 2, ramp = T.k === 'r' || T.k === 'R';
      const hi = Math.max(nw, ne, se, sw) > .01 && !ramp; // raised greens are a touch brighter, so the levels read from above
      const top = T.k === 's' ? (dark ? '#f1d590' : '#f6dea0') : ramp ? (dark ? '#62c248' : '#6dca50') : hi ? (dark ? '#9ad84e' : '#a8e05c') : dark ? '#7fd457' : '#8cdc62';
      const d = wet ? -.07 : 0;
      (wet ? W : M).quad([x0, nw + d, z0], [x0, sw + d, z1], [x1, se + d, z1], [x1, ne + d, z0], wet ? '#4fb8ef' : top, [0, 1, 0]);
      // sides only where the next tile does not cover them: walls between flush tiles were hidden under the grass, but
      // the outline hull grew each one into a thin dark blade poking up through the seam (the stray lines on the tiles)
      const side = wet ? '#3a94d6' : '#4fa646';
      for (const [dr, dc, a, b, na, nb, out] of SIDES) {
        const N = H.t[T.r + dr]?.[T.c + dc], nd = N?.k === 'w' ? -.1 : 0; // a little below the bobbing water
        if (wet && N?.k === 'w') continue;
        const la = N ? Math.min(N.h[na] + nd, T.h[a]) : BASE - .1, lb = N ? Math.min(N.h[nb] + nd, T.h[b]) : BASE - .1;
        if (N && la >= T.h[a] - 1e-6 && lb >= T.h[b] - 1e-6) continue; // the neighbour's top meets ours: nothing to show
        const P = (k, y) => [k === 0 || k === 3 ? x0 : x1, y, k < 2 ? z0 : z1];
        M.quad(P(a, la), P(b, lb), P(b, T.h[b]), P(a, T.h[a]), !wet && N?.k === 'w' ? '#3a94d6' : side, out); // a pond's inner wall stays blue
      }
      if (T.k === 'T') { M.box(T.x, nw + .012, T.z, .62, .024, .62, '#fff4e2'); M.box(T.x - .42, nw + .06, T.z + .1, .1, .12, .1, '#ff8fab'); M.box(T.x + .42, nw + .06, T.z + .1, .1, .12, .1, '#ff8fab'); }
    }
    // walls: chunky cream boards with a wooden cap, and a post wherever boards meet
    const seen = new Set();
    for (const w of H.walls) {
      const horiz = w.az === w.bz, cx = (w.ax + w.bx) / 2, cz = (w.az + w.bz) / 2, y0 = Math.min(BASE - .1, w.lo), y1 = w.hi + WALL_H;
      M.box(cx, (y0 + y1) / 2, cz, horiz ? 1 : .15, y1 - y0, horiz ? .15 : 1, '#f7e3c0');
      M.box(cx, y1 + .025, cz, horiz ? 1 : .19, .05, horiz ? .19 : 1, '#d9955b');
      for (const [px, pz] of [[w.ax, w.az], [w.bx, w.bz]]) {
        const k = px + '/' + pz, old = seen.has(k); seen.add(k);
        if (!old) M.box(px, (y0 + y1 + .1) / 2, pz, .23, y1 + .1 - y0, .23, '#ffb547', 0, '#ffd08a');
      }
    }
    // bumper posts: stripy candy pins
    for (const p of H.posts) {
      const y = hAt(p.x, p.z);
      M.prism(p.x, y, y + .14, p.z, p.r, p.r, 8, '#e5543b'); M.prism(p.x, y + .14, y + .26, p.z, p.r, p.r, 8, '#fff4e2');
      M.prism(p.x, y + .26, y + .4, p.z, p.r, p.r * .8, 8, '#e5543b', '#ff8fab');
    }
    // a little windmill tower stands beside the first windmill bar
    if (H.spins.length) {
      const s = H.spins[0], side = s.x <= 0 ? 1 : -1; let tx = s.x + side * 1.2;
      const clear = x => { for (let a = 0; a < 12; a++) if (ground(H, x + Math.cos(a * .5236) * .85, s.z + Math.sin(a * .5236) * .85).tile) return false; return !ground(H, x, s.z).tile; };
      while (!clear(tx) && Math.abs(tx) < iw / 2) tx += side * .2;
      tx = clamp(tx, -iw / 2 - .9, iw / 2 + .9);
      M.prism(tx, BASE, BASE + 1.5, s.z, .52, .34, 6, '#fff4e2'); M.prism(tx, BASE + 1.5, BASE + 2.1, s.z, .46, 0, 6, '#e5543b', '#e5543b');
      M.box(tx, BASE + .28, s.z + .44, .22, .5, .06, '#8a5433');
      const bg = new THREE.Group(), bm = mesher();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; bm.box(Math.cos(a) * .5, Math.sin(a) * .5, 0, i % 2 ? .16 : .9, i % 2 ? .9 : .16, .04, '#ffb547'); }
      bm.box(0, 0, 0, .16, .16, .1, '#3b2219');
      const mesh = new THREE.Mesh(bm.build(), courseMat); mesh.castShadow = true; mesh.userData.baked = true; bg.add(mesh);
      bg.position.set(tx, BASE + 1.45, s.z + .5); bg.userData.dyn = true; toonify(bg, .03); g.add(bg); blades.push(bg);
    }
    const cg = new THREE.Group(), course = new THREE.Mesh(M.build(), courseMat); course.castShadow = course.receiveShadow = true; course.userData.baked = true; cg.add(course);
    toonify(cg, .035); g.add(cg); // cartoon shading and one dark outline round the whole course
    water = new THREE.Mesh(W.build(), waterMat); water.receiveShadow = true; water.userData.noInk = true; g.add(water);
    // windmill bars
    for (const s of H.spins) {
      const sg = new THREE.Group(), sm = mesher(), y = hAt(s.x, s.z);
      sm.box(0, .15, 0, s.hl * 2, .16, .16, '#e5543b', 0, '#ff7a59');
      sm.box(-s.hl + .12, .15, 0, .24, .18, .18, '#fff4e2'); sm.box(s.hl - .12, .15, 0, .24, .18, .18, '#fff4e2');
      sm.prism(0, 0, .3, 0, .13, .13, 8, '#3b2219', '#ffb547');
      const mesh = new THREE.Mesh(sm.build(), courseMat); mesh.castShadow = true; mesh.userData.baked = true; sg.add(mesh);
      sg.position.set(s.x, y, s.z); sg.userData.dyn = true; toonify(sg, .03); g.add(sg); spinMeshes.push({ g: sg, s });
    }
    // the cup and its flag
    const cy = H.cup.h;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 20), new THREE.MeshBasicMaterial({ color: '#2a1422' })); hole.rotation.x = -Math.PI / 2; hole.position.set(H.cup.x, cy + .006, H.cup.z); g.add(hole);
    const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + .04, 20), new THREE.MeshBasicMaterial({ color: '#fff4e2' })); rim.rotation.x = -Math.PI / 2; rim.position.set(H.cup.x, cy + .007, H.cup.z); g.add(rim);
    const fm = mesher(); fm.box(0, .7, 0, .035, 1.4, .035, '#fff4e2');
    const pole = new THREE.Mesh(fm.build(), toonMat(courseMat)); pole.castShadow = true; pole.position.set(H.cup.x, cy, H.cup.z); g.add(pole);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.4, 0, 0, 1.02, 0, .52, 1.21, 0], 3)); fg.computeVertexNormals();
    flag = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: '#f0563c', side: THREE.DoubleSide })); flag.position.copy(pole.position); flag.castShadow = true; g.add(flag);
    const span = Math.max(cols, rows) / 2 + 4;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span }); sun.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true; camInit = false;
    for (const p of players) Object.assign(p, { shot: null, shotN: -1, init: false, hidden: false });
  }

  // Marks for a one-colour ball: a paler band round the middle and a ring of dimples each side. It is drawn in greys
  // and multiplied by the ball's colour, so one texture serves every player.
  let plain = null;
  function plainTex() {
    if (plain) return plain;
    const Wt = 256, Ht = 128, cv = document.createElement('canvas'); cv.width = Wt; cv.height = Ht; const g = cv.getContext('2d');
    g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, Wt, Ht);
    g.fillStyle = '#ffffff'; g.fillRect(0, Ht * .4, Wt, Ht * .2);
    g.fillStyle = '#8f8f8f'; g.fillRect(0, Ht * .38, Wt, 3); g.fillRect(0, Ht * .6, Wt, 3);
    for (let i = 0; i < 8; i++) for (const [v, r] of [[.22, 7], [.78, 7]]) { g.beginPath(); g.ellipse((i + (v > .5 ? .5 : 0)) * Wt / 8 + 8, v * Ht, r * 1.3, r, 0, 0, 7); g.fill(); }
    for (let i = 0; i < 2; i++) { g.fillStyle = '#7a7a7a'; g.fillRect(i * Wt / 2 + 10, Ht * .4, 16, Ht * .2); } // two bars across the band, so a spin about the band's own axis shows too
    plain = new THREE.CanvasTexture(cv); plain.colorSpace = THREE.SRGBColorSpace;
    return plain;
  }

  // ---------- players: a ball each, and their avatar standing beside it with a putter ----------
  function setSeats(list) {
    const k = list.map(p => p.color + p.av.join('') + (p.fl?.gb | 0)).join('|');
    if (k === seatsKey) return;
    seatsKey = k;
    for (const p of players) { scene.remove(p.wrap, p.ball); disposeAvatar(p.av); p.putter.traverse(m => m.geometry?.dispose()); }
    players = list.map((s, i) => {
      const look = ballLook(s.fl?.gb, s.color); if (!look.map) look.map = plainTex(); // a plain ball still needs marks, or its roll cannot be seen
      const ball = new THREE.Mesh(ballGeo, toonMat(new THREE.MeshStandardMaterial(look))); ball.rotation.y = -Math.PI / 2; /* a painted ball shows its face to the camera */ ball.castShadow = true; ball.userData.col = s.color;
      const out = new THREE.Mesh(ballGeo, inkMat); out.scale.setScalar(1.16); ball.add(out);
      const av = avatar3d(s.color, s.av, { pose: 'stand', hand: false });
      const wrap = new THREE.Group(); wrap.scale.setScalar(AV); wrap.add(av);
      // putter: held in both hands. Each frame the grip goes to the hands and the head swings past the ball.
      const putter = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 5), putterMats[0]);
      const head = new THREE.Mesh(new THREE.BoxGeometry(.36, .15, .15), putterMats[1]);
      putter.add(shaft, head); putter.userData = { shaft, head }; wrap.add(putter);
      for (const arm of av.userData.arms) { // where the hand is along the arm, from the arm's own shape
        let lo = 0; arm.traverse(m => { if (m.isMesh && m.geometry) { m.geometry.computeBoundingBox(); lo = Math.min(lo, m.geometry.boundingBox.min.y); } });
        arm.userData.hand = lo + .06; arm.userData.rz = arm.rotation.z;
      }
      scene.add(wrap, ball);
      return { i, ball, av, wrap, putter, cur: new THREE.Vector3(), rest: { x: 0, z: 0 }, pos: new THREE.Vector3(), face: 0, shot: null, shotN: -1, t0: 0, cue: 0, phase: '',
        sunk: false, out: false, hidden: false, init: false, hop: 0, walk: 0, swing: 9, mood: 0, moodT: 0, spin: 0, tag: { x: 0, y: 0, show: false }, btag: { x: 0, y: 0 } };
    });
  }

  // Everything the server said about the balls. Shots are replayed from where they are now (ago ms in).
  function setState(S) {
    if (!H) return;
    me = S.me; stage = S.stage; turn = S.stage === 'play' ? S.turn : -1;
    const now = performance.now();
    turnAt = now + (S.tin || 0);
    if (S.stage === 'play') { const b = now - S.clock; if (Math.abs(b - clockBase) > 120) clockBase = b; frozen = 0; }
    else if (S.stage === 'bet') { frozen = 1; }
    S.seats.forEach((s, i) => {
      const p = players[i]; if (!p) return;
      p.rest.x = s.x; p.rest.z = s.z; p.sunk = s.sunk; p.out = s.out;
      const sh = s.shot;
      if (!sh) { p.shot = null; p.shotN = -1; p.phase = ''; p.hidden = false; return; }
      if (sh.n === p.shotN) return;
      p.shotN = sh.n;
      if (sh.path && sh.ago < sh.ms + 1400) { p.shot = sh; p.t0 = now - sh.ago + (i === me ? 90 : WIND); p.cue = 0; p.phase = 'fly'; p.struck = false; p.hidden = false; }
      else { p.shot = null; p.phase = ''; p.hidden = false; }
    });
  }

  const V = new THREE.Vector3(), at = (x, y, z) => V.set(x, y, z);

  // ---------- aiming ----------
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
  function worldAt(e, out) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
    ray.setFromCamera(ndc, camera); plane.constant = -(players[me]?.cur.y ?? 0);
    return ray.ray.intersectPlane(plane, out);
  }
  const ready = () => !!H && !!players[me] && !!canAim?.();
  function down(e) {
    if (e.button > 0 || !ready()) return;
    if (!worldAt(e, aim.p0)) return;
    aim.drag = true; aim.on = true; aim.kb = false; aim.pow = 0; aim.sx = e.clientX; aim.sy = e.clientY;
    canvas.setPointerCapture?.(e.pointerId); e.preventDefault();
  }
  function move(e) {
    if (!aim.drag) return;
    if (!ready()) { cancel(); return; }
    if (!worldAt(e, hitP)) return;
    const dx = aim.p0.x - hitP.x, dz = aim.p0.z - hitP.z, len = Math.hypot(dx, dz);
    // full power is a comfortable thumb's drag, whatever the size of the screen
    aim.pow = clamp(Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) / clamp(Math.min(W, Hh) * .34, 150, 250), 0, 1);
    if (len > .05) aim.ang = Math.atan2(dx, -dz);
    onAim?.(aim.pow, true);
  }
  function up() {
    if (!aim.drag) return;
    aim.drag = false; aim.on = false;
    if (aim.pow > .04 && ready()) onShot?.(aim.ang, aim.pow);
    onAim?.(0, false);
  }
  function cancel() { aim.drag = false; aim.on = false; aim.kb = false; onAim?.(0, false); }
  function key(e) {
    if (e.target?.closest?.('input, textarea, [contenteditable]') || !ready()) return;
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(k)) return;
    e.preventDefault();
    if (!aim.kb) { const p = players[me]; aim.kb = true; aim.on = true; aim.ang = Math.atan2(H.cup.x - p.cur.x, -(H.cup.z - p.cur.z)); aim.pow = .4; if (k === ' ' || k === 'Enter') { onAim?.(aim.pow, true, true); return; } }
    const fine = e.shiftKey ? .25 : 1;
    if (k === 'ArrowLeft') aim.ang -= .05 * fine; else if (k === 'ArrowRight') aim.ang += .05 * fine;
    else if (k === 'ArrowUp') aim.pow = clamp(aim.pow + .04 * fine, .04, 1); else if (k === 'ArrowDown') aim.pow = clamp(aim.pow - .04 * fine, .04, 1);
    else { aim.kb = false; aim.on = false; onShot?.(aim.ang, aim.pow); onAim?.(0, false); return; }
    onAim?.(aim.pow, true, true);
  }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  addEventListener('keydown', key);

  // ---------- frame loop ----------
  const rollAx = new THREE.Vector3(), rollQ = new THREE.Quaternion();
  const grip = new THREE.Vector3(), hand = new THREE.Vector3(), rest = new THREE.Vector3(), headP = new THREE.Vector3(), dir = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const proj = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3(), want = new THREE.Vector3(), tmp = { x: 0, z: 0, done: false };
  const lowC = new THREE.Color('#7ed957'), midC = new THREE.Color('#ffd23f'), hiC = new THREE.Color('#e5543b');
  let W = 0, Hh = 0, camInit = false, shadowIn = 0, orbit = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === Hh) return;
    W = w; Hh = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  function loop(dt) {
    resize();
    const now = performance.now(), T = now / 1000;
    if (!H) { renderer.render(scene, camera); return; }
    const ht = frozen ? 0 : (now - clockBase) / 1000; // seconds since the hole started, as the server counts them
    let moving = spinMeshes.length > 0;
    for (const m of spinMeshes) m.g.rotation.y = -spinAngle(m.s, ht);
    for (const b of blades) b.rotation.z = T * 1.1;
    if (flag) flag.rotation.y = Math.sin(T * 2.2) * .35 - .2;
    cloudRing.rotation.y = T * .006; flyBirds(T); blow(T);
    if (water) { water.position.y = Math.sin(T * 1.6) * .012; waterMat.emissive.setScalar(.04 + Math.sin(T * 2.3) * .03); }
    const n = players.length;
    const watch = players.findIndex(q => q.shot) >= 0 ? players.findIndex(q => q.shot) : turn; // whose ball everyone is looking at
    players.forEach((p, i) => {
      // --- the ball ---
      let bx = p.rest.x, bz = p.rest.z, by = 0, show = !p.sunk && !p.out, flying = false;
      const sh = p.shot;
      if (sh) {
        const t = Math.max(0, now - p.t0);
        if (!p.struck && now >= p.t0) { // the club meets the ball
          p.struck = true; p.swing = 0; onCue?.({ k: 'putt', s: i, pow: sh.pow });
          if (!reduced) fx.puff(at(sh.x0, hAt(sh.x0, sh.z0), sh.z0), { n: 5, size: .16 + sh.pow * .14, speed: 1 + sh.pow * 1.5, life: .35 });
        }
        pathAt(sh.path, t, tmp); bx = tmp.x; bz = tmp.z; flying = !tmp.done; show = true;
        while (sh.fx && p.cue < sh.fx.length && t >= sh.fx[p.cue][0] * 1000 / 30) { const kind = sh.fx[p.cue++][1]; onCue?.({ k: 'hit', s: i, kind }); if (kind === 'c') { p.mood = -1; p.moodT = 1.4; } if (!reduced) fx.puff(at(bx, hAt(bx, bz), bz), kind === 'w' ? { n: 4, size: .16, speed: 1, life: .3 } : { n: 7, size: .2, speed: 1.6, life: .4, color: ['#ffffff', '#ffd0d0'] }); }
        if (tmp.done) {
          const over = t - sh.ms;
          if (sh.sunk) { // drops into the cup
            if (p.phase === 'fly') { p.phase = 'in'; p.hop = 1; p.spin = 1; for (const q of players) if (q !== p) { q.mood = 1; q.moodT = 1.8; } if (!reduced) { const c = at(H.cup.x, H.cup.h, H.cup.z); fx.burst(c, { n: 24, colors: [p.ball.userData.col, '#ffd84a', '#ffffff'], speed: 3, up: 4.5, size: .26, life: 1, y: .15, shape: [STAR, CONF, HEART] }); fx.ring(c, { color: '#ffd84a', size: 1.6 }); fx.confetti(c, { n: i === me ? 60 : 36, w: 3, h: 3, s: i }); if (i === me) shake.kick(.08); } onCue?.({ k: 'sunk', s: i }); }
            by = -Math.min(1, over / 220) * .3; show = over < 260;
            const u = Math.min(1, over / 160); bx += (H.cup.x - bx) * u; bz += (H.cup.z - bz) * u;
          } else if (sh.water) { // splash, then back where it was hit from
            if (p.phase === 'fly') { p.phase = 'wet'; p.mood = -1; p.moodT = 1.8; if (!reduced) { const c = at(bx, hAt(bx, bz), bz); fx.burst(c, { n: 20, colors: ['#bfe8ff', '#4fb8ef', '#ffffff'], speed: 2.4, up: 4, size: .22, life: .7, shape: DOT }); fx.ring(c, { color: '#ffffff', size: 1.3 }); } onCue?.({ k: 'water', s: i }); }
            if (over < 700) { by = -Math.min(1, over / 200) * .4; show = over < 200; }
            else { bx = sh.x0; bz = sh.z0; show = true; if (over > 1100) { p.shot = null; p.phase = ''; } }
          } else {
            if (p.phase === 'fly') { p.phase = ''; onCue?.({ k: 'rest', s: i }); }
            p.shot = null; show = !p.out; bx = p.rest.x; bz = p.rest.z;
          }
          if (p.shot && over > 1500) { p.shot = null; p.phase = ''; }
        }
      }
      if (flying) moving = true;
      const gy = hAt(bx, bz);
      p.cur.set(bx, gy + BALL_R + by, bz);
      p.ball.position.copy(p.cur); p.ball.visible = show && !(stage === 'done' && (p.sunk || p.out));
      // roll: the ball turns about the axis across its path, by exactly the distance it covers
      const mx = bx - (p.lx ?? bx), mz = bz - (p.lz ?? bz), md = Math.hypot(mx, mz);
      if (md > 1e-5 && md < .8) { rollAx.set(mz / md, 0, -mx / md); rollQ.setFromAxisAngle(rollAx, md / BALL_R); p.ball.quaternion.premultiply(rollQ); }
      p.lx = bx; p.lz = bz;
      // --- the golfer ---
      const done = (p.sunk || p.out) && !flying && p.phase !== 'fly';
      const upNow = i === turn && now >= turnAt; // their putt, and the ball before theirs has stopped
      let tx, tz, face, waiting = false;
      if (done && !(sh && sh.sunk && now - p.t0 - sh.ms < 1300)) { // off to the gallery behind the green to cheer
        tx = (i - (n - 1) / 2) * .78; tz = -H.rows / 2 - 1.2; face = 0;
      } else if (!upNow && !sh) { // not their putt: wait in a line beside the course, out of the way, watching the ball in play
        waiting = true;
        if (W < Hh) { tx = (i - (n - 1) / 2) * .8; tz = H.rows / 2 + 1.05; } // tall screen: in front of the tee, where there is room
        else { tx = -H.cols / 2 - .95; tz = H.rows / 2 - .5 - i * .8; }
        const w = players[watch] || p; face = Math.atan2(w.cur.x - tx, w.cur.z - tz);
      } else {
        const ax = sh ? (sh.x0 ?? bx) : bx, az = sh ? (sh.z0 ?? bz) : bz;
        let ang = sh ? sh.ang : Math.atan2(H.cup.x - ax, -(H.cup.z - az));
        if (i === me && aim.on) ang = aim.ang;
        const dx = Math.sin(ang), dz = -Math.cos(ang);
        tx = ax + dz * .46; tz = az - dx * .46; face = Math.atan2(-dz, dx); p.side = 1; // stands side on, facing the ball
        if (!ground(H, tx, tz).tile || ground(H, tx, tz).tile.k === 'w') { tx = ax - dz * .46; tz = az + dx * .46; face = Math.atan2(dz, -dx); p.side = -1; } // no room that side: stand on the other
        p.bx = ax; p.bz = az;
      }
      if (!p.init) { p.pos.set(tx, 0, tz); p.face = face; p.init = true; }
      const ddx = tx - p.pos.x, ddz = tz - p.pos.z, dist = Math.hypot(ddx, ddz);
      let walking = false;
      if (dist > .02) {
        const stepLen = Math.min(dist, dt * (2.6 + dist * .9)); p.pos.x += ddx / dist * stepLen; p.pos.z += ddz / dist * stepLen;
        if (dist > .25) { walking = true; face = Math.atan2(ddx, ddz); moving = true; p.walk += stepLen * 9; }
      }
      p.moodT = Math.max(0, p.moodT - dt); p.spin = Math.max(0, p.spin - dt * 1.3);
      const glad = p.moodT > 0 && p.mood > 0 && !walking, sad = p.moodT > 0 && p.mood < 0 && !walking;
      let df = face - p.face; df = Math.atan2(Math.sin(df), Math.cos(df)); p.face += df * Math.min(1, dt * 10);
      p.hop = Math.max(0, p.hop - dt * 1.1);
      const bob = walking ? Math.abs(Math.sin(p.walk)) * .1 : 0, cheer = (done || glad) && !reduced ? Math.abs(Math.sin(T * (glad ? 7 : 3.2) + i)) * (glad ? .1 : .07) : 0;
      const jump = Math.sin(p.hop * Math.PI) * .3;
      p.wrap.position.set(p.pos.x, hAt(p.pos.x, p.pos.z) + .76 * AV + bob + cheer + jump, p.pos.z);
      p.wrap.rotation.y = p.face + (reduced ? 0 : (1 - (1 - p.spin) ** 2) * Math.PI * 2 * (p.spin > 0 ? 1 : 0));
      animateAvatar(p.av, T, { seed: i, active: done || glad, hop: p.hop, nod: sad ? Math.min(1, p.moodT * 3) * .9 : 0 });
      walkAvatar(p.av, p.walk, walking ? 1 : 0);
      // --- the putter: gripped in both hands, swinging like a pendulum past the ball ---
      const hold = !done && !waiting && !walking && dist < .1;
      p.putter.visible = hold;
      const arms = p.av.userData.arms;
      if (hold) {
        p.swing += dt;
        let th;
        if (sh && !p.struck) { const u = clamp(1 - (p.t0 - now) / WIND, 0, 1), back = .3 + sh.pow * .75; th = -back * Math.sin(u * Math.PI / 2); p.back = back; } // backswing
        else if (i === me && aim.on) { th = -(.22 + aim.pow * .8); p.back = -th; p.swing = 9; }
        else if (p.swing < 1.1) { const b = p.back || .5, u = p.swing; th = u < .14 ? -b + (b * 2.1) * (u / .14) : b * 1.1 * Math.max(0, 1 - (u - .14) / .96) ** 2; } // through the ball, then settle
        else th = Math.sin(T * 2.6 + i) * .035; // a little waggle over the ball
        const ph = th * (p.side || 1);
        for (const a of arms) { const sg = Math.sign(a.position.x) || 1; a.rotation.x = a.userData.rx - .78; a.rotation.z = -sg * .42 + ph * .3; }
        p.wrap.updateMatrixWorld(true);
        grip.set(0, 0, 0);
        for (const a of arms) { hand.set(0, a.userData.hand, 0); a.localToWorld(hand); grip.add(hand); }
        grip.multiplyScalar(.5); p.wrap.worldToLocal(grip);
        // the head rests on the grass just behind the ball; the swing turns it round the grip
        rest.set(p.bx, hAt(p.bx, p.bz) + .04, p.bz); p.wrap.worldToLocal(rest); rest.x -= (p.side || 1) * .42;
        const vx = rest.x - grip.x, vy = rest.y - grip.y, c = Math.cos(ph), sn = Math.sin(ph);
        headP.set(grip.x + vx * c - vy * sn, grip.y + vx * sn + vy * c, rest.z);
        const { shaft, head } = p.putter.userData;
        dir.copy(headP).sub(grip); const len = dir.length(); dir.normalize();
        shaft.position.copy(grip).addScaledVector(dir, len / 2 - .08); shaft.scale.y = len + .16; shaft.quaternion.setFromUnitVectors(UP, dir);
        head.position.copy(headP); head.rotation.set(0, Math.PI / 2, 0); head.position.y += .03;
      } else for (const a of arms) a.rotation.z = a.userData.rz;
    });
    // your ball: a ring when it is your shot, the bobbing arrow over your head
    const mine = players[me], can = !!mine && !!canAim?.();
    arrow.visible = !!mine && !(mine.sunk || mine.out);
    if (mine) { arrow.position.copy(mine.wrap.position); arrow.position.y += 1.64 * AV + .22; animateArrow(arrow, T); }
    ring.visible = can && !aim.on;
    if (ring.visible) { ring.position.copy(mine.cur); ring.position.y -= BALL_R - .02; ring.scale.setScalar(1 + Math.sin(T * 5) * .12); }
    if (aim.on && !can) cancel();
    aimG.visible = aim.on && can && aim.pow > .02; pre.visible = aimG.visible;
    if (aimG.visible) {
      const L = .3 + aim.pow * .9; // a short arrow whose length and colour show the power; the dots show where the ball goes
      aimG.position.copy(mine.cur); aimG.position.y += .04; aimG.rotation.y = -aim.ang + Math.PI;
      aimStrip.scale.z = L; aimStrip.position.z = L / 2 + BALL_R; aimTip.position.z = L + BALL_R + .12;
      aimMat.color.copy(aim.pow < .5 ? lowC : midC).lerp(aim.pow < .5 ? midC : hiC, aim.pow < .5 ? aim.pow * 2 : aim.pow * 2 - 2);
      // the predicted roll; worked out again when the aim changes (and a few times a second, as windmills keep turning)
      const key = aim.ang.toFixed(3) + '/' + aim.pow.toFixed(3);
      if (key !== preKey || now - preAt > 180) { preKey = key; preAt = now; preview(mine.rest.x, mine.rest.z, aim.ang, aim.pow, ht + .12); }
    }
    // camera: the whole hole from the tee end; a slow swing round it while everyone looks the hole over
    const tall = camera.aspect < .8, fv = camera.fov * Math.PI / 360;
    const hw = H.cols / 2 + (tall ? .55 : 1.6), hd = H.rows / 2 + (tall ? 1.5 : 1.5);
    const look0 = stage === 'bet' ? 1 : 0; orbit += (look0 - orbit) * Math.min(1, dt * 1.6);
    const el = (tall ? .98 : .87) - orbit * .2, yaw = orbit * Math.sin(T * .35) * .55;
    const dist = (Math.max(hd * Math.sin(el) / Math.tan(fv), hw / (Math.tan(fv) * camera.aspect)) * 1.03 + hd * Math.cos(el) * .5) * (1 + orbit * .06);
    look.set(0, 0, tall ? -.25 : .1);
    if (mine && !tall && stage === 'play') { look.x += mine.cur.x * .08; look.z += mine.cur.z * .05; }
    want.set(look.x + Math.sin(yaw) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(yaw) * Math.cos(el) * dist);
    if (!camInit) { camera.position.copy(want); lookNow.copy(look); camInit = true; }
    camera.position.lerp(want, Math.min(1, dt * 2.5)); lookNow.lerp(look, Math.min(1, dt * 2.5)); camera.lookAt(lookNow); if (!reduced) shake.apply(camera, dt);
    shadowIn -= dt;
    if (shadowIn <= 0) { renderer.shadowMap.needsUpdate = true; shadowIn = moving ? .034 : .25; }
    fx.update(dt, camera, Hh);
    renderer.render(scene, camera);
    for (const p of players) {
      proj.copy(p.wrap.position); proj.y += 1.75 * AV; proj.project(camera);
      p.tag.show = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      p.tag.x = (proj.x + 1) / 2 * W; p.tag.y = (1 - proj.y) / 2 * Hh;
    }
    onFrame?.({ tags: players.map(p => p.tag), busy: players.map(p => !!p.shot) });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setHole, setSeats, setState,
    aiming: () => aim.on,
    dispose() {
      ticker.stop();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel);
      removeEventListener('keydown', key);
      if (holeG) disposeToon(holeG);
      for (const p of players) disposeAvatar(p.av);
      disposeToon(cloudRing); fx.dispose(); disposeArrow(arrow); ballGeo.dispose(); preGeo.dispose(); pre.dispose(); plain?.dispose(); courseMat.dispose(); waterMat.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

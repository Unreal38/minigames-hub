// Mini Golf Party 3D view (three.js). Purely visual: it draws the hole the server picked, replays the ball
// paths the server worked out, and turns a drag on the screen into an aim and a power for your next putt.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { toonify, toonMat, skyDome, clouds as cloudSea, island, birds, petals, createFx, shaker, disposeToon, STAR, DOT, CONF, HEART } from '../../scenery3d.js';
import { buildHole, ground, pathAt, spinAngle, BALL_R, CUP_R } from './course.js';

const INK = '#3b2219', SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff', BASE = -.14, AV = .46, WALL_H = .24;
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
  const flyBirds = birds(scene, 20, 6, 4, 1.1), blow = petals(scene, 24, 4, { n: 9, size: .12 });
  const fx = createFx(scene), shake = shaker(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, ...o });
  const courseMat = flat(), waterMat = new THREE.MeshStandardMaterial({ color: '#4fb8ef', roughness: .25, flatShading: true, transparent: true, opacity: .88 });
  const putterMats = [toonMat(new THREE.MeshStandardMaterial({ color: '#d9dde3' })), toonMat(new THREE.MeshStandardMaterial({ color: '#5b4636' }))];
  const ballGeo = new THREE.IcosahedronGeometry(BALL_R, 2), inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  let H = null, holeG = null, holeKey = '', spinMeshes = [], blades = [], flag = null, water = null;
  let players = [], seatsKey = '', me = -1, turn = -1, stage = 'bet', clockBase = performance.now(), frozen = 0;
  const arrow = youArrow(); arrow.visible = false; arrow.scale.setScalar(.7); scene.add(arrow);

  // aim arrow: a strip that grows with the power, plus a row of dots showing the line
  const aimG = new THREE.Group(); aimG.visible = false; scene.add(aimG);
  const aimMat = new THREE.MeshBasicMaterial({ color: '#7ed957', transparent: true, opacity: .95, depthTest: false });
  const aimStrip = new THREE.Mesh(new THREE.BoxGeometry(.11, .02, 1), aimMat); aimStrip.renderOrder = 5; aimG.add(aimStrip);
  const aimTip = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 4), aimMat); aimTip.rotation.x = -Math.PI / 2; aimTip.renderOrder = 5; aimG.add(aimTip);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .75, depthTest: false });
  const aimDots = Array.from({ length: 7 }, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(.045, 8), dotMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 4; aimG.add(m); return m; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(BALL_R + .06, BALL_R + .12, 20), new THREE.MeshBasicMaterial({ color: '#fff4e2', transparent: true, opacity: .9, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 3; ring.visible = false; scene.add(ring);
  const aim = { on: false, ang: 0, pow: 0, drag: false, kb: false, p0: new THREE.Vector3(), sx: 0, sy: 0 };

  const hAt = (x, z) => { const g = ground(H, x, z); return g.tile ? g.h : BASE - .02; };

  // ---------- the hole ----------
  function setHole(def) {
    const key = def.i + '/' + (def.mirror ? 1 : 0);
    if (key === holeKey) return;
    holeKey = key;
    if (holeG) { scene.remove(holeG); disposeToon(holeG); }
    H = buildHole(def.i, def.mirror);
    const g = holeG = new THREE.Group(); scene.add(g);
    const M = mesher(), W = mesher(), { rows, cols } = H;
    spinMeshes = []; blades = [];
    // the floating island under the course, with trees and flowers round its rim
    const iw = cols + 1.2, id = rows + 2.6;
    const land = island(iw, id, { rim: 2.3, seed: def.i + 3, props: 16, flowers: 46, size: 1.15 }); land.position.set(0, BASE - .1, -.5); g.add(land);
    // tiles
    for (const row of H.t) for (const T of row) {
      if (!T) continue;
      const x0 = T.x - .5, x1 = T.x + .5, z0 = T.z - .5, z1 = T.z + .5, [nw, ne, se, sw] = T.h, wet = T.k === 'w';
      const dark = (T.r + T.c) % 2, ramp = T.k === 'r' || T.k === 'R';
      const hi = Math.max(nw, ne, se, sw) > .01 && !ramp; // raised greens are a touch brighter, so the levels read from above
      const top = T.k === 's' ? (dark ? '#f1d590' : '#f6dea0') : ramp ? (dark ? '#62c248' : '#6dca50') : hi ? (dark ? '#9ad84e' : '#a8e05c') : dark ? '#7fd457' : '#8cdc62';
      const d = wet ? -.07 : 0;
      (wet ? W : M).quad([x0, nw + d, z0], [x0, sw + d, z1], [x1, se + d, z1], [x1, ne + d, z0], wet ? '#4fb8ef' : top, [0, 1, 0]);
      const side = wet ? '#3a94d6' : '#4fa646';
      M.quad([x0, BASE - .1, z1], [x1, BASE - .1, z1], [x1, se, z1], [x0, sw, z1], side, [0, 0, 1]);
      M.quad([x0, BASE - .1, z0], [x1, BASE - .1, z0], [x1, ne, z0], [x0, nw, z0], side, [0, 0, -1]);
      M.quad([x1, BASE - .1, z0], [x1, BASE - .1, z1], [x1, se, z1], [x1, ne, z0], side, [1, 0, 0]);
      M.quad([x0, BASE - .1, z0], [x0, BASE - .1, z1], [x0, sw, z1], [x0, nw, z0], side, [-1, 0, 0]);
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

  // ---------- players: a ball each, and their avatar standing beside it with a putter ----------
  function setSeats(list) {
    const k = list.map(p => p.color + p.av.join('')).join('|');
    if (k === seatsKey) return;
    seatsKey = k;
    for (const p of players) { scene.remove(p.wrap, p.ball); disposeAvatar(p.av); p.putter.traverse(m => m.geometry?.dispose()); }
    players = list.map((s, i) => {
      const ball = new THREE.Mesh(ballGeo, toonMat(new THREE.MeshStandardMaterial({ color: s.color }))); ball.castShadow = true; ball.userData.col = s.color;
      const out = new THREE.Mesh(ballGeo, inkMat); out.scale.setScalar(1.16); ball.add(out);
      const av = avatar3d(s.color, s.av, { pose: 'stand' });
      const wrap = new THREE.Group(); wrap.scale.setScalar(AV); wrap.add(av);
      // putter: pivots at the hands, in front of the body; the head rests on the grass beside the ball
      const putter = new THREE.Group(); putter.position.set(0, .22, .42);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.08, 5), putterMats[0]);
      shaft.position.set(0, -.46, .26); shaft.rotation.x = -.52;
      const head = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, .12), putterMats[1]); head.position.set(.08, -.93, .53);
      putter.add(shaft, head); wrap.add(putter);
      scene.add(wrap, ball);
      return { i, ball, av, wrap, putter, cur: new THREE.Vector3(), rest: { x: 0, z: 0 }, pos: new THREE.Vector3(), face: 0, shot: null, shotN: -1, t0: 0, cue: 0, phase: '',
        sunk: false, out: false, hidden: false, init: false, hop: 0, walk: 0, swing: 9, tag: { x: 0, y: 0, show: false }, btag: { x: 0, y: 0 } };
    });
  }

  // Everything the server said about the balls. Shots are replayed from where they are now (ago ms in).
  function setState(S) {
    if (!H) return;
    me = S.me; stage = S.stage; turn = S.stage === 'play' ? S.turn : -1;
    const now = performance.now();
    if (S.stage === 'play') { const b = now - S.clock; if (Math.abs(b - clockBase) > 120) clockBase = b; frozen = 0; }
    else if (S.stage === 'bet') { frozen = 1; }
    S.seats.forEach((s, i) => {
      const p = players[i]; if (!p) return;
      p.rest.x = s.x; p.rest.z = s.z; p.sunk = s.sunk; p.out = s.out;
      const sh = s.shot;
      if (!sh) { p.shot = null; p.shotN = -1; p.phase = ''; p.hidden = false; return; }
      if (sh.n === p.shotN) return;
      p.shotN = sh.n;
      if (sh.path && sh.ago < sh.ms + 1400) { p.shot = sh; p.t0 = now - sh.ago; p.cue = 0; p.phase = 'fly'; p.swing = sh.ago / 1000; p.hidden = false; if (sh.ago < 200) { onCue?.({ k: 'putt', s: i, pow: sh.pow }); if (!reduced) fx.puff(at(sh.x0, hAt(sh.x0, sh.z0), sh.z0), { n: 5, size: .16 + sh.pow * .14, speed: 1 + sh.pow * 1.5, life: .35 }); } }
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
    players.forEach((p, i) => {
      // --- the ball ---
      let bx = p.rest.x, bz = p.rest.z, by = 0, show = !p.sunk && !p.out, flying = false;
      const sh = p.shot;
      if (sh) {
        const t = now - p.t0;
        pathAt(sh.path, t, tmp); bx = tmp.x; bz = tmp.z; flying = !tmp.done; show = true;
        while (sh.fx && p.cue < sh.fx.length && t >= sh.fx[p.cue][0] * 1000 / 30) { const kind = sh.fx[p.cue++][1]; onCue?.({ k: 'hit', s: i, kind }); if (!reduced) fx.puff(at(bx, hAt(bx, bz), bz), kind === 'w' ? { n: 4, size: .16, speed: 1, life: .3 } : { n: 7, size: .2, speed: 1.6, life: .4, color: ['#ffffff', '#ffd0d0'] }); }
        if (tmp.done) {
          const over = t - sh.ms;
          if (sh.sunk) { // drops into the cup
            if (p.phase === 'fly') { p.phase = 'in'; p.hop = 1; if (!reduced) { const c = at(H.cup.x, H.cup.h, H.cup.z); fx.burst(c, { n: 24, colors: [p.ball.userData.col, '#ffd84a', '#ffffff'], speed: 3, up: 4.5, size: .26, life: 1, y: .15, shape: [STAR, CONF, HEART] }); fx.ring(c, { color: '#ffd84a', size: 1.6 }); if (i === me) { fx.confetti(c, { n: 60, w: 3, h: 3 }); shake.kick(.08); } } onCue?.({ k: 'sunk', s: i }); }
            by = -Math.min(1, over / 220) * .3; show = over < 260;
            const u = Math.min(1, over / 160); bx += (H.cup.x - bx) * u; bz += (H.cup.z - bz) * u;
          } else if (sh.water) { // splash, then back where it was hit from
            if (p.phase === 'fly') { p.phase = 'wet'; if (!reduced) { const c = at(bx, hAt(bx, bz), bz); fx.burst(c, { n: 20, colors: ['#bfe8ff', '#4fb8ef', '#ffffff'], speed: 2.4, up: 4, size: .22, life: .7, shape: DOT }); fx.ring(c, { color: '#ffffff', size: 1.3 }); } onCue?.({ k: 'water', s: i }); }
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
      if (flying) { p.ball.rotation.x += dt * 9; p.ball.rotation.z += dt * 5; }
      // --- the golfer ---
      const done = (p.sunk || p.out) && !flying && p.phase !== 'fly';
      let tx, tz, face, waiting = false;
      if (done && !(sh && sh.sunk && now - p.t0 - sh.ms < 900)) { // off to the gallery behind the green to cheer
        tx = (i - (n - 1) / 2) * .78; tz = -H.rows / 2 - 1.2; face = 0;
      } else if (i !== turn && !sh) { // not their putt: wait in a line beside the course, out of the way
        waiting = true;
        if (W < Hh) { tx = (i - (n - 1) / 2) * .8; tz = H.rows / 2 + 1.05; face = Math.PI; } // tall screen: in front of the tee, where there is room
        else { tx = -H.cols / 2 - .95; tz = H.rows / 2 - .5 - i * .8; face = Math.PI / 2; }
      } else {
        const ax = flying || sh ? (sh.x0 ?? bx) : bx, az = flying || sh ? (sh.z0 ?? bz) : bz;
        let ang = flying || sh ? sh.ang : Math.atan2(H.cup.x - ax, -(H.cup.z - az));
        if (i === me && aim.on) ang = aim.ang;
        else if (!sh && Math.hypot(ax - H.tee.x, az - H.tee.z) < .05) ang += (i - (n - 1) / 2) * 2.2 / n; // everyone starts on the tee: fan out round it
        const dx = Math.sin(ang), dz = -Math.cos(ang);
        tx = ax + dz * .46; tz = az - dx * .46; face = Math.atan2(-dz, dx); p.side = 1; // stands side on, facing the ball
        if (!ground(H, tx, tz).tile || ground(H, tx, tz).tile.k === 'w') { tx = ax - dz * .46; tz = az + dx * .46; face = Math.atan2(dz, -dx); p.side = -1; } // no room that side: stand on the other
      }
      if (!p.init) { p.pos.set(tx, 0, tz); p.face = face; p.init = true; }
      const ddx = tx - p.pos.x, ddz = tz - p.pos.z, dist = Math.hypot(ddx, ddz);
      let walking = false;
      if (dist > .02) {
        const stepLen = Math.min(dist, dt * (3.2 + dist * 1.2)); p.pos.x += ddx / dist * stepLen; p.pos.z += ddz / dist * stepLen;
        if (dist > .25) { walking = true; face = Math.atan2(ddx, ddz); moving = true; }
      }
      let df = face - p.face; df = Math.atan2(Math.sin(df), Math.cos(df)); p.face += df * Math.min(1, dt * 12);
      p.walk = walking ? p.walk + dt * 9 : 0;
      p.hop = Math.max(0, p.hop - dt * 1.1);
      const bob = walking ? Math.abs(Math.sin(p.walk)) * .16 : 0, cheer = done && !reduced ? Math.abs(Math.sin(T * 3.2 + i)) * .07 : 0;
      p.wrap.position.set(p.pos.x, hAt(p.pos.x, p.pos.z) + .76 * AV + bob + cheer, p.pos.z);
      p.wrap.rotation.y = p.face;
      animateAvatar(p.av, T, { seed: i, active: done || walking, hop: p.hop });
      // arms forward on the putter; a follow-through when the ball is struck
      p.swing += dt;
      const sw = p.swing < .45 ? Math.sin(Math.min(1, p.swing / .45) * Math.PI) * .9 : i === me && aim.on ? -aim.pow * .55 : 0;
      p.putter.visible = !done && !waiting && !walking;
      p.putter.rotation.z = sw * (p.side || 1);
      if (p.putter.visible) for (const a of p.av.userData.arms) a.rotation.x = a.userData.rx - .62;
    });
    // your ball: a ring when it is your shot, the bobbing arrow over your head
    const mine = players[me], can = !!mine && !!canAim?.();
    arrow.visible = !!mine && !(mine.sunk || mine.out);
    if (mine) { arrow.position.copy(mine.wrap.position); arrow.position.y += 1.64 * AV + .22; animateArrow(arrow, T); }
    ring.visible = can && !aim.on;
    if (ring.visible) { ring.position.copy(mine.cur); ring.position.y -= BALL_R - .02; ring.scale.setScalar(1 + Math.sin(T * 5) * .12); }
    if (aim.on && !can) cancel();
    aimG.visible = aim.on && can && aim.pow > .02;
    if (aimG.visible) {
      const L = .35 + aim.pow * 2.3;
      aimG.position.copy(mine.cur); aimG.position.y += .04; aimG.rotation.y = -aim.ang + Math.PI;
      aimStrip.scale.z = L; aimStrip.position.z = L / 2 + BALL_R; aimTip.position.z = L + BALL_R + .12;
      aimMat.color.copy(aim.pow < .5 ? lowC : midC).lerp(aim.pow < .5 ? midC : hiC, aim.pow < .5 ? aim.pow * 2 : aim.pow * 2 - 2);
      aimDots.forEach((d, k) => { d.position.z = L + BALL_R + .5 + k * .34; d.position.y = -.02; d.material.opacity = .75; });
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
      disposeToon(cloudRing); fx.dispose(); disposeArrow(arrow); ballGeo.dispose(); courseMat.dispose(); waterMat.dispose(); renderer.dispose();
    },
  };
}

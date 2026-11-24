// Sky Pool 3D view (three.js). Purely visual: it draws the table and the balls where the server says they are,
// replays each shot with the same physics the server used, and turns drags on the screen into an aim.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar } from '../../avatar3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { toonify, toonMat, skyDome, clouds as cloudSea, island, birds, petals, createFx, shaker, disposeToon, STAR, DOT, CONF, nightScene } from '../../scenery3d.js';
import { N, R, HX, HZ, TL, TW, HEAD_X, FOOT_X, POCKETS, FRAME_HZ, simulate, aimCast, placeOk, legalFirst, kindOf, dirOf, colOf } from './rules.js';

const INK = '#3b2219', SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff', FLOOR = -1.75, AVS = .95;
const FELT = '#3fae7c', FELT2 = '#49b987', CUSH = '#2f9469', WOOD = '#d9955b', WOOD_TOP = '#e9ad74', WOOD_DK = '#a8683c', HOLE = '#24101c';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - (1 - t) * (1 - t);
// where each pocket's hole is drawn (a little outside the corner of the cloth)
const HOLES = POCKETS.map((P, i) => (i % 3 === 1 ? { x: 0, z: Math.sign(P.z) * (HZ + .1), r: .34 } : { x: Math.sign(P.x) * (HX + .04), z: Math.sign(P.z) * (HZ + .04), r: .42 }));
const PETS = ['mossbun', 'cindercub', 'waddlet'];

// Collects flat-shaded, vertex-coloured boxes and columns into one geometry: the whole table is one draw call.
function mesher() {
  const pos = [], col = [], c = new THREE.Color(), A = new THREE.Vector3(), B = new THREE.Vector3(), Nn = new THREE.Vector3();
  const tri = (a, b, d) => { for (const p of [a, b, d]) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); } };
  function quad(a, b, d, e, color, out) {
    c.set(color);
    A.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); B.set(e[0] - a[0], e[1] - a[1], e[2] - a[2]); Nn.crossVectors(A, B);
    if (Nn.x * out[0] + Nn.y * out[1] + Nn.z * out[2] < 0) { tri(a, e, d); tri(a, d, b); } else { tri(a, b, d); tri(a, d, e); }
  }
  function box(x, y, z, sx, sy, sz, color, top = color) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, P = (px, py, pz) => [x + px, y + py, z + pz];
    quad(P(-hx, hy, -hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), top, [0, 1, 0]);
    quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, -hy, -hz), color, [0, -1, 0]);
    quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), color, [0, 0, 1]);
    quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), color, [0, 0, -1]);
    quad(P(hx, -hy, -hz), P(hx, -hy, hz), P(hx, hy, hz), P(hx, hy, -hz), color, [1, 0, 0]);
    quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), color, [-1, 0, 0]);
  }
  function prism(x, y0, y1, z, r, n, color, top = color) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, m = (a + b) / 2;
      const p0 = [x + Math.cos(a) * r, y0, z + Math.sin(a) * r], p1 = [x + Math.cos(b) * r, y0, z + Math.sin(b) * r];
      const q0 = [x + Math.cos(a) * r, y1, z + Math.sin(a) * r], q1 = [x + Math.cos(b) * r, y1, z + Math.sin(b) * r];
      quad(p0, p1, q1, q0, color, [Math.cos(m), 0, Math.sin(m)]);
      c.set(top); const up = [x, y1, z]; A.set(q1[0] - q0[0], 0, q1[2] - q0[2]); if (A.x * (z - q0[2]) - A.z * (x - q0[0]) > 0) tri(q0, up, q1); else tri(q0, q1, up);
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

// A ball's skin: one colour with a number in a white spot (plain), or white with a band of colour (striped).
function ballTexture(b) {
  const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const col = colOf(b), k = kindOf(b);
  if (k === 'c') {
    g.fillStyle = '#fff8ec'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e5543b'; for (const [u, v] of [[.125, .5], [.375, .5], [.625, .5], [.875, .5], [.25, .14], [.75, .86]]) { g.beginPath(); g.arc(u * W, v * H, 7, 0, 7); g.fill(); }
  } else {
    g.fillStyle = k === 't' ? '#fff8ec' : col; g.fillRect(0, 0, W, H);
    if (k === 't') { g.fillStyle = col; g.fillRect(0, H * .27, W, H * .46); }
    for (const u of [.25, .75]) {
      g.fillStyle = '#fff8ec'; g.beginPath(); g.arc(u * W, H / 2, 19, 0, 7); g.fill();
      g.fillStyle = '#2a1422'; g.font = '800 25px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(b), u * W, H / 2 + 2);
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createScene(canvas, { onFrame, onCue, canAim, canPlace, onPlace, onAim } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 80, 220);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 400);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-6, 16, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = cloudSea({ min: 18, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene);
  const flyBirds = birds(scene, 24, 7, 4, 1.2), blow = petals(scene, 26, 4, { n: 9, size: .14 });
  const fx = createFx(scene), shake = shaker(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- the table on its island ----------
  const world = new THREE.Group(); scene.add(world);
  const land = island(TL + 6.5, TW + 6.5, { rim: 2.2, seed: 8, props: 15, flowers: 50, size: 1.9, open: .35 }); land.position.set(0, FLOOR, -.4); world.add(land);
  const tableMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }), tg = new THREE.Group();
  {
    const M = mesher(), CT = .24, FW = .44, top = .2, ftop = .25, OX = HX + CT + FW, OZ = HZ + CT + FW;
    M.box(0, -.06, 0, TL + CT * 2, .12, TW + CT * 2, FELT);                           // the cloth
    M.box(HEAD_X, .002, 0, .035, .004, TW, FELT2); M.prism(FOOT_X, 0, .004, 0, .06, 10, FELT2, FELT2); M.prism(HEAD_X, 0, .005, 0, .06, 10, FELT2, FELT2);
    for (const s of [-1, 1]) {                                                         // cushions, with gaps at the pockets
      for (const [a, b] of [[-HX + .44, -.36], [.36, HX - .44]]) M.box((a + b) / 2, top / 2, s * (HZ + CT / 2), b - a, top, CT, CUSH, '#38a377');
      M.box(s * (HX + CT / 2), top / 2, 0, CT, top, TW - .88, CUSH, '#38a377');
      M.box(0, (ftop - .56) / 2, s * (HZ + CT + FW / 2), OX * 2, ftop + .56, FW, WOOD, WOOD_TOP);       // the wooden frame
      M.box(s * (HX + CT + FW / 2), (ftop - .56) / 2, 0, FW, ftop + .56, (HZ + CT) * 2, WOOD, WOOD_TOP);
      for (const dx of [-3.75, -2.5, -1.25, 1.25, 2.5, 3.75]) M.box(dx, ftop + .004, s * (HZ + CT + FW / 2), .09, .008, .09, '#fff4e2'); // sights
      for (const dz of [-1.25, 0, 1.25]) M.box(s * (HX + CT + FW / 2), ftop + .004, dz, .09, .008, .09, '#fff4e2');
      for (const t of [-1, 1]) M.box(s * (HX - .5), (FLOOR - .5) / 2, t * (HZ - .35), .62, -FLOOR - .5, .62, WOOD_DK, WOOD);            // legs
    }
    M.box(0, -.34, 0, OX * 2 - .3, .44, OZ * 2 - .3, WOOD_DK);                        // the body under the cloth
    for (const h of HOLES) { M.prism(h.x, -.02, .005, h.z, h.r + .035, 16, '#2b7f5c', '#2b7f5c'); M.prism(h.x, -.02, .009, h.z, h.r, 16, HOLE, HOLE); } // pockets: dark holes in the cloth, running under the frame
    const mesh = new THREE.Mesh(M.build(), tableMat); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.baked = true;
    tg.add(mesh); toonify(tg, .035); world.add(tg);
  }

  // ---------- balls ----------
  const ballGeo = new THREE.SphereGeometry(R, 20, 14), inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const balls = [], texs = [];
  for (let b = 0; b < N; b++) {
    const tex = ballTexture(b); texs.push(tex);
    const m = new THREE.Mesh(ballGeo, toonMat(new THREE.MeshStandardMaterial({ map: tex, roughness: .35 }))); m.castShadow = true;
    const out = new THREE.Mesh(ballGeo, inkMat); out.scale.setScalar(1.12); m.add(out);
    m.rotation.set(-1.1, b * 2.4, b * .9); m.visible = false; world.add(m);
    balls.push({ m, x: 0, z: 0, lx: null, lz: null });
  }
  // the cue ball's ring while it may be picked up, and the ghost ball where the aim lands
  const basic = (c, o = .9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false });
  const handRing = new THREE.Mesh(new THREE.RingGeometry(R + .07, R + .14, 28), basic('#fff4e2')); handRing.rotation.x = -Math.PI / 2; handRing.renderOrder = 4; handRing.visible = false; world.add(handRing);
  const lineMat = basic('#ffffff', .85), softMat = basic('#ffffff', .55), ghostMat = basic('#ffffff', .95), stripGeo = new THREE.BoxGeometry(1, .008, .035);
  const mkLine = mat => { const m = new THREE.Mesh(stripGeo, mat); m.renderOrder = 5; m.visible = false; world.add(m); return m; };
  const aimLine = mkLine(lineMat), objLine = mkLine(lineMat), cueLine = mkLine(softMat);
  const ghost = new THREE.Mesh(new THREE.RingGeometry(R - .03, R, 28), ghostMat); ghost.rotation.x = -Math.PI / 2; ghost.renderOrder = 5; ghost.visible = false; world.add(ghost);
  function setLine(m, x0, z0, x1, z1, y = R) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    m.visible = len > .02; if (!m.visible) return;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.scale.x = len; m.rotation.y = -Math.atan2(dz, dx);
  }
  const OK_C = new THREE.Color('#ffffff'), BAD_C = new THREE.Color('#ff6b5c');

  // ---------- the cue ----------
  const CUE_L = 3.7, cue = new THREE.Group(), cueTilt = new THREE.Group(); cue.add(cueTilt); cue.visible = false; world.add(cue);
  const seg = (x0, x1, r0, r1, color) => { // a tapered stick from x0 (nearer the tip) to x1, lying along -x
    const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, 8); g.rotateZ(Math.PI / 2); g.translate(-(x0 + x1) / 2, 0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: .6 })); m.castShadow = true; cueTilt.add(m); return m;
  };
  seg(0, .05, .03, .032, '#6fb7ff'); seg(.05, .2, .032, .036, '#fff4e2'); seg(.2, 2.5, .036, .058, '#efc88f');
  const cueButt = seg(2.5, CUE_L, .058, .07, '#e5543b'); cueTilt.rotation.z = -.075;

  // ---------- players ----------
  let players = [], seatsKey = '', pets = [];
  const arrow = youArrow(); arrow.visible = false; arrow.scale.setScalar(1.5); world.add(arrow);
  function setSeats(list) {
    const k = list.map(p => p.color + p.av.join('')).join('|');
    if (k === seatsKey) return;
    seatsKey = k;
    for (const p of players) { world.remove(p.wrap); disposeAvatar(p.av); }
    players = list.map((s, i) => {
      const av = avatar3d(s.color, s.av, { pose: 'stand' }), wrap = new THREE.Group(); wrap.scale.setScalar(AVS); wrap.add(av); world.add(wrap);
      return { i, av, wrap, color: s.color, pos: new THREE.Vector3(), init: false, face: 0, walk: 0, hop: 0, mood: 0, moodT: 0, tag: { x: 0, y: 0, show: false } };
    });
  }
  // a few Pet Farm pets watch from the lawn and hop when a ball drops
  import('../farm/pets3d.js').then(({ petModel }) => {
    if (dead) return;
    const bb = new THREE.Box3(), size = new THREE.Vector3();
    PETS.forEach((sp, i) => {
      const pet = petModel(sp, 2), g = new THREE.Group();
      bb.setFromObject(pet); bb.getSize(size); const k = 1.5 / Math.max(size.x, size.y, size.z, .01);
      pet.scale.multiplyScalar(k); pet.position.y = -bb.min.y * k; g.add(pet);
      pet.traverse(o => { if (o.isMesh) o.castShadow = true; });
      world.add(g); pets.push({ g, hop: 0, i });
    });
  }).catch(() => {});

  // ---------- what the server said ----------
  let S = null, me = -1, rep = null, lastShot = -1, local = null, localUntil = 0, turnKey = '', pull = 0, dead = false;
  const aim = { ang: 0, mode: '', a0: 0, p0: 0, sx: 0, sy: 0, moved: false, id: -1 };
  const cur = { x: new Array(N).fill(0), z: new Array(N).fill(0), on: new Array(N).fill(false) }; // the balls as they lie now
  function setState(s) {
    S = s; me = s.me;
    const now = performance.now(), sh = s.shot;
    if (sh && sh.n !== lastShot) {
      lastShot = sh.n;
      if (sh.from && sh.ago < s.wind + sh.ms + 300) {
        const sim = simulate(sh.from, sh.ix, sh.iz, sh.pw, true);
        rep = { sim, sh, t0: now - sh.ago + s.wind, wind: s.wind, hitI: 0, potI: 0, gone: new Array(N).fill(-1), struck: false, d: dirOf(sh.ix, sh.iz) };
        aim.mode = ''; local = null;
      } else rep = null;
    }
    if (!sh) { rep = null; lastShot = -1; }
    if (!rep) { for (let b = 0; b < N; b++) { cur.x[b] = s.bx[b]; cur.z[b] = s.bz[b]; cur.on[b] = s.on[b]; } }
    if (local && (now > localUntil || (Math.abs(s.bx[0] - local.x) < 1e-3 && Math.abs(s.bz[0] - local.z) < 1e-3)) && aim.mode !== 'place') local = null;
    // a new turn: point the cue at the nearest ball that may be hit
    const key = s.gid + ':' + s.rack + ':' + s.turn + ':' + (sh?.n ?? 0);
    if (key !== turnKey && !rep) { turnKey = key; if (s.turn >= 0) aimAtNearest(); }
  }
  function aimAtNearest(cx = S.bx[0], cz = S.bz[0]) {
    let best = -1, bd = Infinity;
    for (let b = 1; b < N; b++) {
      if (!S.on[b] || !legalFirst(S.group, S.side, S.on, b, S.brk)) continue;
      const d = Math.hypot(S.bx[b] - cx, S.bz[b] - cz); if (d < bd) { bd = d; best = b; }
    }
    if (S.brk) { best = -1; for (let b = 1; b < N; b++) if (S.on[b] && (best < 0 || S.bx[b] < S.bx[best])) best = b; }
    if (best >= 0) aim.ang = Math.atan2(S.bz[best] - cz, S.bx[best] - cx);
  }

  // ---------- pointer: drag the cue ball when it is in hand, otherwise turn the aim ----------
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R), ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
  function worldAt(e, out) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, out);
  }
  const cueX = () => (local ? local.x : cur.x[0]), cueZ = () => (local ? local.z : cur.z[0]);
  const ready = () => !!S && !rep && !!canAim?.();
  function down(e) {
    if (e.button > 0 || !ready() || aim.mode) return;
    if (!worldAt(e, hitP)) return;
    const d = Math.hypot(hitP.x - cueX(), hitP.z - cueZ());
    aim.id = e.pointerId; aim.sx = e.clientX; aim.sy = e.clientY; aim.moved = false;
    if (canPlace?.() && d < (e.pointerType === 'touch' ? .75 : .4)) { aim.mode = 'place'; local = { x: cueX(), z: cueZ() }; }
    else { aim.mode = 'aim'; aim.a0 = aim.ang; aim.p0 = Math.atan2(hitP.z - cueZ(), hitP.x - cueX()); }
    canvas.setPointerCapture?.(e.pointerId); e.preventDefault();
  }
  function move(e) {
    if (!aim.mode || e.pointerId !== aim.id) return;
    if (!ready()) { aim.mode = ''; return; }
    if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < 6) return;
    aim.moved = true;
    if (!worldAt(e, hitP)) return;
    if (aim.mode === 'place') {
      const kit = S.hand === 'k', x = clamp(hitP.x, -HX + R, kit ? HEAD_X : HX - R), z = clamp(hitP.z, -HZ + R, HZ - R);
      if (placeOk(cur, x, z, kit)) { local.x = Math.round(x * 1e4) / 1e4; local.z = Math.round(z * 1e4) / 1e4; }
    } else {
      let da = Math.atan2(hitP.z - cueZ(), hitP.x - cueX()) - aim.p0; da = Math.atan2(Math.sin(da), Math.cos(da));
      aim.ang = aim.a0 + da; aim.p0 += da; aim.a0 = aim.ang; onAim?.();
    }
  }
  function up(e) {
    if (!aim.mode || e.pointerId !== aim.id) return;
    const mode = aim.mode; aim.mode = '';
    if (!ready()) return;
    if (mode === 'place') { if (local) { localUntil = performance.now() + 2500; onPlace?.(local.x, local.z); aimAtNearest(local.x, local.z); } } // the cue follows the ball to its new place
    else if (!aim.moved && worldAt(e, hitP)) { aim.ang = Math.atan2(hitP.z - cueZ(), hitP.x - cueX()); onAim?.(); } // a tap: aim straight at that spot
  }
  function cancel(e) { if (e.pointerId === aim.id) aim.mode = ''; }
  function wheel(e) { if (!ready()) return; e.preventDefault(); aim.ang += Math.sign(e.deltaY) * (e.shiftKey ? .0012 : .006); onAim?.(); }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('wheel', wheel, { passive: false });

  // ---------- frame loop ----------
  const rollAx = new THREE.Vector3(), rollQ = new THREE.Quaternion(), V = new THREE.Vector3(), proj = new THREE.Vector3();
  const look = new THREE.Vector3(), want = new THREE.Vector3();
  let W = 0, Hh = 0, shadowIn = 0, camKey = '', padTop = 0, padBot = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === Hh) return;
    W = w; Hh = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  const tallNow = () => camera.aspect < 1;
  function placeCamera() {
    const tall = tallNow(), key = [tall, W, Hh, padTop, padBot].join('/');
    if (key === camKey) return; camKey = key;
    // The table is fitted into the part of the screen the HUD leaves free. A phone held upright sees the table end
    // on, so its long side runs up the screen. Everything that should stay in view (table, avatars, pets) is
    // projected and the camera backs off until it all fits; the pets take whichever spot costs the least room.
    const el = tall ? 1.2 : 1.02, yaw = tall ? Math.PI / 2 : 0, top = FLOOR + 2.55, pt = FLOOR + 1.6;
    const sw = p => tall ? [p[2], p[1], p[0]] : p; // upright: across and along swap places
    const A = tall ? HZ : HX, D = tall ? HX : HZ, far = 1;
    const base = [];
    for (const sx of [-1, 1]) {
      base.push([sx * (A + .82), .25, D + .85], [sx * (A + .82), .25, -(D + .85)], [sx * (A + .82), FLOOR, D + .85]);
      base.push([sx * (A + .6), top, -far * (D + 1.3)], [sx * 4.1, top, -far * (D + 1.95)]);
    }
    // the pets sit by the far corners, next to the players and a little away from the table
    const petPts = tall
      ? [-1, 1].flatMap(sx => [[sx * (A + 1.95), FLOOR, -(D + .7)], [sx * (A + 1.25), pt, -(D + .7)], [0, top, -(D + 2.7)]])
      : [-1, 1].flatMap(sx => [[sx * (A + 4.3), FLOOR, -(D - 1)], [sx * (A + 3.5), pt, -(D - 1)], [sx * (A + 3.2), pt, -(D + 1.1)]]);
    const shift = (padTop - padBot) / 2;
    const fits = (dist, pts) => {
      camera.position.set(Math.sin(yaw) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(yaw) * Math.cos(el) * dist); camera.lookAt(look); camera.updateMatrixWorld();
      for (const q of pts) {
        const [x, y, z] = sw(q); proj.set(x, y, z).project(camera);
        const py = (1 - proj.y) / 2 * Hh + shift;
        if (Math.abs(proj.x) > 1 - 24 / Math.max(1, W) || py < padTop + 4 || py > Hh - padBot - 4) return false;
      }
      return true;
    };
    const need = pts => { let lo = 6, hi = 90; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (fits(m, pts)) hi = m; else lo = m; } return hi; };
    look.set(0, 0, 0); camera.clearViewOffset(); camera.updateProjectionMatrix();
    const dist = need(base.concat(petPts));
    want.set(look.x + Math.sin(yaw) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(yaw) * Math.cos(el) * dist);
    camera.position.copy(want); camera.lookAt(look);
    camera.setViewOffset(W, Hh, 0, -Math.round(shift), W, Hh);
    pets.forEach(p => { p.placed = false; });
  }
  function loop(dt) {
    resize(); placeCamera();
    const now = performance.now(), T = now / 1000, tall = tallNow();
    cloudRing.rotation.y = T * .006; flyBirds(T); blow(T);
    if (!S) { renderer.render(scene, camera); return; }
    let moving = false, cueShown = false, cueAng = aim.ang, cuePull = pull, cx = cueX(), cz = cueZ();
    // --- a shot being replayed ---
    if (rep) {
      const t = (now - rep.t0) / 1000, sim = rep.sim, F = sim.frames;
      const from = rep.sh.from;
      if (t < 0) { // the cue swings in
        for (let b = 0; b < N; b++) { cur.x[b] = from.x[b]; cur.z[b] = from.z[b]; cur.on[b] = from.on[b]; }
        const u = clamp(1 + t * 1000 / rep.wind, 0, 1), back = .25 + rep.sh.pw / 1000 * .85;
        cueShown = true; cueAng = Math.atan2(rep.d.dz, rep.d.dx); cuePull = u < .55 ? back * ease(u / .55) : back * (1 - ((u - .55) / .45) ** 2);
        cx = from.x[0]; cz = from.z[0]; moving = true;
      } else {
        if (!rep.struck) { rep.struck = true; onCue?.({ k: 'strike', s: rep.sh.s, pw: rep.sh.pw }); if (!reduced && rep.sh.pw > 700) shake.kick(.05); }
        const f = t * FRAME_HZ, i0 = Math.min(sim.nf - 1, Math.floor(f)), i1 = Math.min(sim.nf - 1, i0 + 1), u = f - Math.floor(f);
        for (let b = 0; b < N; b++) {
          const o0 = (i0 * N + b) * 2, o1 = (i1 * N + b) * 2;
          cur.x[b] = F[o0] + (F[o1] - F[o0]) * u; cur.z[b] = F[o0 + 1] + (F[o1 + 1] - F[o0 + 1]) * u; cur.on[b] = from.on[b];
        }
        while (rep.hitI < sim.hits.length && sim.hits[rep.hitI].t <= t) { const h = sim.hits[rep.hitI++]; onCue?.({ k: 'hit', kind: h.k, v: h.v }); }
        while (rep.potI < sim.pots.length && sim.pots[rep.potI].t <= t) {
          const p = sim.pots[rep.potI++]; rep.gone[p.b] = p.t; rep['p' + p.b] = p.p;
          onCue?.({ k: 'pot', b: p.b, s: rep.sh.s });
          const h = HOLES[p.p];
          if (!reduced) { fx.burst(V.set(h.x, .3, h.z), { n: p.b === 0 ? 8 : 16, colors: p.b === 0 ? ['#ffffff', '#cfd6e6'] : [colOf(p.b), '#ffd84a', '#ffffff'], speed: 2.6, up: 4, size: .3, life: .8, shape: p.b === 0 ? DOT : [STAR, CONF] }); if (p.b !== 0) fx.ring(V, { color: '#ffd84a', size: 1.5 }); }
          for (const q of players) if (p.b !== 0) { q.hop = Math.max(q.hop, q.i === rep.sh.s ? 1 : .0); }
          for (const q of pets) q.hop = 1;
        }
        moving = true;
        if (f >= sim.nf - 1 + FRAME_HZ * .3) { // everything has stopped: from here the server's word counts
          for (let b = 0; b < N; b++) { cur.x[b] = sim.x[b]; cur.z[b] = sim.z[b]; cur.on[b] = sim.on[b]; }
          const done = rep; rep = null; onCue?.({ k: 'rest', s: done.sh.s });
          if (S.shot?.n === done.sh.n) for (let b = 0; b < N; b++) { cur.x[b] = S.bx[b]; cur.z[b] = S.bz[b]; cur.on[b] = S.on[b]; }
        }
      }
    }
    // --- balls ---
    const t = rep ? (now - rep.t0) / 1000 : 0;
    for (let b = 0; b < N; b++) {
      const B = balls[b]; let x = cur.x[b], z = cur.z[b], y = R, show = cur.on[b], sc = 1;
      if (b === 0 && local && !rep) { x = local.x; z = local.z; }
      if (rep && rep.gone[b] >= 0) { // dropping into the pocket
        const u = clamp((t - rep.gone[b]) / .26, 0, 1), h = HOLES[rep['p' + b]];
        x += (h.x - x) * u; z += (h.z - z) * u; y = R - u * .32; sc = 1 - u * .25; show = u < 1;
      }
      B.m.visible = show; if (!show) { B.lx = null; continue; }
      B.m.position.set(x, y, z); B.m.scale.setScalar(sc);
      if (B.lx !== null) { const mx = x - B.lx, mz = z - B.lz, md = Math.hypot(mx, mz); if (md > 1e-5 && md < .6) { rollAx.set(mz / md, 0, -mx / md); rollQ.setFromAxisAngle(rollAx, md / R); B.m.quaternion.premultiply(rollQ); } }
      B.lx = x; B.lz = z;
    }
    // --- aiming: the cue, the line to the first ball and where that ball will go ---
    const can = ready(), aiming = can && aim.mode !== 'place' && cur.on[0];
    if (aiming) { cueShown = true; cueAng = aim.ang; cuePull = pull; }
    cue.visible = cueShown;
    if (cueShown) {
      cue.position.set(cx, R, cz); cue.rotation.y = -cueAng; cueTilt.position.x = -(R + .1 + cuePull);
      const who = players[rep ? rep.sh.s : S.turn]; if (who && cueButt.material.color.getHexString() !== who.color.slice(1).toLowerCase()) cueButt.material.color.set(who.color);
    }
    aimLine.visible = objLine.visible = cueLine.visible = ghost.visible = false;
    if (aiming) {
      const dx = Math.cos(aim.ang), dz = Math.sin(aim.ang), B = local ? { x: [local.x, ...cur.x.slice(1)], z: [local.z, ...cur.z.slice(1)], on: cur.on } : cur;
      const hit = aimCast(B, dx, dz), ok = hit.b < 0 || legalFirst(S.group, S.side, S.on, hit.b, S.brk);
      lineMat.color.copy(ok ? OK_C : BAD_C); ghostMat.color.copy(lineMat.color);
      setLine(aimLine, cx + dx * (R + .04), cz + dz * (R + .04), hit.gx, hit.gz);
      ghost.visible = true; ghost.position.set(hit.gx, R, hit.gz);
      if (hit.b >= 0) {
        const full = dx * hit.nx + dz * hit.nz, len = .35 + 1.25 * full; // the fuller the hit, the longer the line
        setLine(objLine, B.x[hit.b] + hit.nx * R, B.z[hit.b] + hit.nz * R, B.x[hit.b] + hit.nx * (R + len), B.z[hit.b] + hit.nz * (R + len));
        const tx = dx - hit.nx * full, tz = dz - hit.nz * full, tl = Math.hypot(tx, tz);
        if (tl > .08) setLine(cueLine, hit.gx, hit.gz, hit.gx + tx / tl * (.25 + tl * .7), hit.gz + tz / tl * (.25 + tl * .7));
      } else setLine(cueLine, hit.gx, hit.gz, hit.gx + hit.nx * .8, hit.gz + hit.nz * .8);
    }
    handRing.visible = can && !!canPlace?.() && cur.on[0];
    if (handRing.visible) { handRing.position.set(cx, .02, cz); handRing.scale.setScalar(1 + Math.sin(T * 5) * .1); }
    // --- avatars: in a row along the far side; whoever is at the table steps up level with the cue ball ---
    const n = players.length, at = rep ? rep.sh.s : S.turn;
    players.forEach((p, i) => {
      let tx, tz, face;
      const slot = (i - (n - 1) / 2) * (tall ? 1.55 : 2.3), up = i === at;
      if (tall) { tx = -(HX + (up ? 1.25 : 1.9)); tz = up ? clamp(cz, -HZ, HZ) : slot; face = Math.PI / 2; }
      else { tz = -(HZ + (up ? 1.3 : 1.95)); tx = up ? clamp(cx, -HX, HX) : slot; face = 0; }
      if (up) face = Math.atan2(cx - tx, cz - tz);
      if (!p.init) { p.pos.set(tx, 0, tz); p.face = face; p.init = true; }
      const ddx = tx - p.pos.x, ddz = tz - p.pos.z, dist = Math.hypot(ddx, ddz);
      let walking = false;
      if (dist > .02) {
        const step = Math.min(dist, dt * (3.2 + dist * 1.4)); p.pos.x += ddx / dist * step; p.pos.z += ddz / dist * step;
        if (dist > .3) { walking = true; face = Math.atan2(ddx, ddz); moving = true; p.walk += step * 5; }
      }
      let df = face - p.face; df = Math.atan2(Math.sin(df), Math.cos(df)); p.face += df * Math.min(1, dt * 9);
      p.hop = Math.max(0, p.hop - dt * 1.2); p.moodT = Math.max(0, p.moodT - dt);
      const bob = walking ? Math.abs(Math.sin(p.walk)) * .12 : 0, jump = Math.sin(p.hop * Math.PI) * .5;
      if (jump > .01) moving = true;
      p.wrap.position.set(p.pos.x, FLOOR + .76 * AVS + bob + jump, p.pos.z); p.wrap.rotation.y = p.face;
      animateAvatar(p.av, T, { seed: i, active: up || p.moodT > 0, hop: p.hop, nod: p.mood < 0 && p.moodT > 0 ? Math.min(1, p.moodT * 3) * .9 : 0 });
      walkAvatar(p.av, p.walk, walking ? 1 : 0);
    });
    const mine = players[me];
    arrow.visible = !!mine;
    if (mine) { arrow.position.copy(mine.wrap.position); arrow.position.y += 1.75 * AVS + .3; animateArrow(arrow, T); }
    pets.forEach(p => {
      if (!p.placed) {
        p.placed = true; const sx = p.i ? 1 : -1, out = p.i === 2; // one at each far corner, the third a step further out
        if (tall) { p.g.position.set(out ? -(HX - 1.7) : -(HX + .7), FLOOR, sx * (HZ + 1.25)); p.g.rotation.y = Math.PI / 2 - sx * (out ? 1.3 : .8); }
        else { p.g.position.set(sx * (HX + (out ? 3.5 : 2.4)), FLOOR, -(HZ + (out ? -1 : 1.1))); p.g.rotation.y = -sx * (out ? 1.2 : .7); }
      }
      p.hop = Math.max(0, p.hop - dt * 1.5); p.g.position.y = FLOOR + Math.abs(Math.sin(p.hop * Math.PI * 2)) * .45 * p.hop;
      if (p.hop > 0) moving = true;
      const s = 1 + Math.sin(T * 2.2 + p.i * 2) * .02; p.g.scale.set(1 / s, s, 1 / s);
    });
    camera.position.copy(want); if (!reduced) shake.apply(camera, dt);
    shadowIn -= dt;
    if (shadowIn <= 0) { renderer.shadowMap.needsUpdate = true; shadowIn = moving || aim.mode ? .034 : .25; }
    fx.update(dt, camera, Hh);
    renderer.render(scene, camera);
    for (const p of players) {
      proj.copy(p.wrap.position); proj.y += 1.8 * AVS; proj.project(camera);
      p.tag.show = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      p.tag.x = (proj.x + 1) / 2 * W; p.tag.y = (1 - proj.y) / 2 * Hh;
    }
    onFrame?.({ tags: players.map(p => p.tag), rolling: !!rep });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setSeats, setState,
    setPull(p) { pull = clamp(p, 0, 1) * .95; },
    setPads(t, b) { padTop = t; padBot = b; },
    nudge(d) { aim.ang += d; },
    rolling: () => !!rep,
    // the aim as whole numbers, the way the server wants it
    aimInts: () => [Math.round(Math.cos(aim.ang) * 1e6), Math.round(Math.sin(aim.ang) * 1e6)],
    mood(i, good) { const p = players[i]; if (p) { p.mood = good ? 1 : -1; p.moodT = 1.6; if (good) p.hop = 1; } },
    // a winner's shower over their head, in their own win effect from the Wardrobe
    cheer(i) { const p = players[i]; if (p && !reduced) fx.confetti(p.wrap.position.clone().setY(p.wrap.position.y + 1.6 * AVS + .6), { n: 60, w: 2.6, h: 2, s: i }); },
    dispose() {
      dead = true; ticker.stop();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('wheel', wheel);
      for (const p of players) disposeAvatar(p.av);
      disposeToon(land); disposeToon(tg); cue.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); for (const b of balls) b.m.material.dispose(); for (const p of pets) disposeToon(p.g); disposeToon(cloudRing); fx.dispose(); disposeArrow(arrow); ballGeo.dispose(); stripGeo.dispose(); texs.forEach(t => t.dispose()); tableMat.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

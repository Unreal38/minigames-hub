// Sky Darts 3D view (three.js): a dartboard on a wooden stand on a sky island. Whoever is throwing stands at the
// line with a dart raised; everyone else watches from beside the board. Purely visual: the server decides where
// every dart lands (rules.js); this draws your wandering aim, flies the darts in and keeps them in the board.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { toonify, toonMat, skyDome, clouds as cloudSea, island, birds, petals, createFx, shaker, flat, STAR, DOT, CONF, HEART, nightScene } from '../../scenery3d.js';
import { R, ORDER, MS, landing, wobbleR, HAND, spot } from './rules.js';

const SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff', INK = '#3b2219';
const BS = .8, BY = 1.95, BZ = 0;            // board size (world units per board unit), centre height, face z
const AV = .52, OCHE = { x: -1.3, z: 2.7 };  // avatar size, and where the thrower stands
const DART = .44;                             // dart length
// where everyone else watches from: beside the board, nearest first
const STAGE = .5; // the little stage on the left, so the people there can see over the thrower
const SLOTS = [[1.85, .95, 0], [2.6, .7, 0], [-2.05, .5, STAGE], [3.3, 1.05, 0], [-2.85, .55, STAGE], [2.3, 1.9, 0]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - (1 - t) ** 3;

// The board face, painted once on a canvas: segments, rings, wires and the number ring.
function boardTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), c = S / 2, k = c / R.frame;
  g.fillStyle = '#2b2228'; g.beginPath(); g.arc(c, c, c, 0, 6.2832); g.fill();
  g.fillStyle = '#3a2f36'; g.beginPath(); g.arc(c, c, k * 1.02, 0, 6.2832); g.fill();
  const seg = (r0, r1, i, col) => {
    const a0 = (i * 18 - 9 - 90) * Math.PI / 180, a1 = (i * 18 + 9 - 90) * Math.PI / 180;
    g.fillStyle = col; g.beginPath(); g.arc(c, c, r1 * k, a0, a1); g.arc(c, c, r0 * k, a1, a0, true); g.closePath(); g.fill();
  };
  for (let i = 0; i < 20; i++) {
    const even = i % 2 === 0, single = even ? '#2b2228' : '#f6e7c8', ring = even ? '#e5543b' : '#3fae5d';
    seg(R.outer, R.tIn, i, single); seg(R.tIn, R.tOut, i, ring); seg(R.tOut, R.dIn, i, single); seg(R.dIn, R.dOut, i, ring);
  }
  g.fillStyle = '#3fae5d'; g.beginPath(); g.arc(c, c, R.outer * k, 0, 6.2832); g.fill();
  g.fillStyle = '#e5543b'; g.beginPath(); g.arc(c, c, R.bull * k, 0, 6.2832); g.fill();
  // wires
  g.strokeStyle = '#d9dde3'; g.lineWidth = 2.2;
  for (const r of [R.bull, R.outer, R.tIn, R.tOut, R.dIn, R.dOut]) { g.beginPath(); g.arc(c, c, r * k, 0, 6.2832); g.stroke(); }
  for (let i = 0; i < 20; i++) { const a = (i * 18 - 9 - 90) * Math.PI / 180; g.beginPath(); g.moveTo(c + Math.cos(a) * R.outer * k, c + Math.sin(a) * R.outer * k); g.lineTo(c + Math.cos(a) * k, c + Math.sin(a) * k); g.stroke(); }
  // numbers
  g.fillStyle = '#fff4e2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(k * .17)}px Rubik, system-ui, sans-serif`;
  for (let i = 0; i < 20; i++) { const a = i * 18 * Math.PI / 180, r = k * 1.16; g.save(); g.translate(c + Math.sin(a) * r, c - Math.cos(a) * r); g.rotate(a); g.fillText(String(ORDER[i]), 0, 2); g.restore(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createScene(canvas, { onFrame, onCue } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 180);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 400);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(-5, 12, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -5, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = cloudSea({ min: 14, max: 80, below: -9 }); scene.add(cloudRing);
  nightScene(scene);
  const flyBirds = birds(scene, 18, 7, 4, 1.1), blow = petals(scene, 20, 3.5, { n: 8, size: .1 });
  const fx = createFx(scene), shake = shaker(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shadowFor = 10;

  // ---------- the island and the board stand ----------
  const isle = island(9, 7, { seed: 4, props: 16, open: .55, flowers: 46 }); isle.position.z = 1.3; scene.add(isle);
  const stand = new THREE.Group();
  {
    const wood = '#b57c4e', dark = '#8a5a3c', roof = '#e5543b';
    const box = (w, h, d, c, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(c)); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; stand.add(m); return m; };
    const P = R.frame * BS + .22; // half the backboard
    box(P * 2, P * 2, .14, '#6b4a3c', 0, BY, BZ - .16);                       // backboard
    box(P * 2 + .16, .14, .26, wood, 0, BY + P + .05, BZ - .12);               // top rail
    box(P * 2 + .16, .14, .26, wood, 0, BY - P - .05, BZ - .12);               // bottom rail
    for (const s of [-1, 1]) {
      box(.18, BY + P + .45, .2, wood, s * (P + .17), (BY + P + .45) / 2, BZ - .14);         // posts
      box(.42, .1, .42, dark, s * (P + .17), .05, BZ - .14);                                 // feet
      box(.32, .05, .32, '#ffe27a', s * (P + .17), BY + P + .5, BZ - .14);                   // post caps
      // open cabinet doors, angled out
      const door = box(P, P * 2 + .1, .08, wood, s * (P + .25 + P / 2 * Math.cos(.6)), BY, BZ - .1 + P / 2 * Math.sin(.6), -s * .6);
      door.position.x = s * (P + .26 + Math.cos(.6) * P / 2); door.position.z = BZ - .12 + Math.sin(.6) * P / 2;
      const inner = box(P * .7, P * 1.4, .02, '#2f4a3a', 0, 0, .05); stand.remove(inner); door.add(inner); // a little chalkboard inside each door
    }
    // a pitched roof over the top
    for (const s of [-1, 1]) { const r = box(P + .35, .1, .7, roof, s * (P + .35) / 2 * .95, BY + P + .62, BZ - .05); r.rotation.z = s * -.36; }
    box(.16, .16, .72, '#c8432f', 0, BY + P + .78, BZ - .05);
    // the throwing line, and a little mat to stand on
    box(1.5, .06, .14, '#fff4e2', OCHE.x, .03, OCHE.z - .36);
    box(1.3, .03, .9, '#7ed3b2', OCHE.x, .015, OCHE.z + .12);
    // a low stage on the left with a step up
    box(1.9, STAGE, 1.0, '#c99763', -2.45, STAGE / 2, .5); box(1.96, .07, 1.06, wood, -2.45, STAGE, .5); box(.9, STAGE / 2, .4, '#b98a5e', -2.45, STAGE / 4, 1.2);
    // a barrel and a crate of spare darts beside the stand, and a chalk score board on an easel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.3, .26, .7, 8), flat('#a5683f')); barrel.position.set(-3.75, .35, .9); barrel.castShadow = true; stand.add(barrel);
    for (const y of [.12, .58]) { const hoop = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .05, 8), flat('#5b4636')); hoop.position.set(-3.75, y, .9); stand.add(hoop); }
    box(.5, .32, .5, '#c99763', -3.6, .16, 1.7, .3);
    box(.08, 1.3, .08, dark, 3.3, .65, -.25, -.3); box(.08, 1.3, .08, dark, 3.85, .65, -.05, -.3);
    box(.9, .66, .06, '#2f4a3a', 3.58, 1.05, -.1, -.3);
    box(.98, .06, .1, wood, 3.6, .7, -.05, -.3);
  }
  bake(stand); toonify(stand, .05); scene.add(stand);
  // the board itself: a chunky round body and the painted face
  const boardG = new THREE.Group(); boardG.position.set(0, BY, BZ); scene.add(boardG);
  const faceTex = boardTexture();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R.frame * BS, R.frame * BS * 1.02, .12, 40), toonMat(flat('#2b2228')));
  body.rotation.x = Math.PI / 2; body.position.z = -.06; body.castShadow = true; boardG.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(R.frame * BS, 40), new THREE.MeshToonMaterial({ map: faceTex, gradientMap: body.material.gradientMap }));
  face.position.z = .002; face.receiveShadow = true; boardG.add(face);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(R.frame * BS, .03, 5, 40), toonMat(flat('#d9dde3'))); rimRing.position.z = .0; boardG.add(rimRing);
  const boardPt = (x, y, out = new THREE.Vector3()) => out.set(x * BS, BY + y * BS, BZ);

  // ---------- your aim: a dot where the dart would go and a ring for how steady the hand is ----------
  const aimG = new THREE.Group(); aimG.visible = false; aimG.renderOrder = 10; scene.add(aimG);
  const over = o => { o.material.depthTest = false; o.material.transparent = true; o.renderOrder = 10; return o; };
  const ring = over(new THREE.Mesh(new THREE.RingGeometry(.9, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: .9 })));
  const ringIn = over(new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: .14 })));
  const dotInk = over(new THREE.Mesh(new THREE.CircleGeometry(.034, 16), new THREE.MeshBasicMaterial({ color: INK })));
  const dot = over(new THREE.Mesh(new THREE.CircleGeometry(.022, 16), new THREE.MeshBasicMaterial({ color: '#ffe27a' })));
  const cross = new THREE.Group();
  for (const [w, h] of [[.16, .012], [.012, .16]]) cross.add(over(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: INK, opacity: .75 }))));
  aimG.add(ringIn, ring, cross, dotInk, dot);
  // the bed to go for when a finish is on: a glowing ring that pulses
  const hintG = over(new THREE.Mesh(new THREE.RingGeometry(.05, .095, 28), new THREE.MeshBasicMaterial({ color: '#ffe27a', opacity: .9 }))); hintG.visible = false; scene.add(hintG);
  let hint = null;
  const cLoose = new THREE.Color('#fff4e2'), cSteady = new THREE.Color('#5fe08a'), cTired = new THREE.Color('#ff6b5a'), cNow = new THREE.Color();

  // ---------- darts ----------
  const steel = toonMat(flat('#d9dde3')), tipM = toonMat(flat('#5b5f66')), shaftM = toonMat(flat('#3b2219'));
  const flightMats = new Map(), flightMat = c => { if (!flightMats.has(c)) flightMats.set(c, toonMat(flat(c))); return flightMats.get(c); };
  const barrelG = new THREE.CylinderGeometry(.022, .018, DART * .38, 6), tipG = new THREE.ConeGeometry(.012, DART * .2, 5), shaftG = new THREE.CylinderGeometry(.01, .01, DART * .22, 5);
  const flightG = new THREE.BoxGeometry(.13, .005, DART * .26); flightG.translate(.065, 0, 0);
  const inkD = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  // a dart along +z, its tip at the origin pointing at -z
  function makeDart(color) {
    const g = new THREE.Group();
    const tip = new THREE.Mesh(tipG, tipM); tip.rotation.x = -Math.PI / 2; tip.position.z = DART * .1;
    const bar = new THREE.Mesh(barrelG, steel); bar.rotation.x = Math.PI / 2; bar.position.z = DART * .39;
    const barInk = new THREE.Mesh(barrelG, inkD); barInk.scale.setScalar(1.25); bar.add(barInk);
    const sh = new THREE.Mesh(shaftG, shaftM); sh.rotation.x = Math.PI / 2; sh.position.z = DART * .69;
    g.add(tip, bar, sh);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(flightG, flightMat(color)); f.position.z = DART * .86; f.rotation.z = k * Math.PI / 2; const fi = new THREE.Mesh(flightG, inkD); fi.scale.set(1.15, 2.5, 1.1); f.add(fi); g.add(f); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  let stuck = [];      // darts in the board this turn: { g, i, wob }
  const falling = [];  // darts pulled out or bounced off: { g, v, t }
  let fly = null;      // the dart in the air: { g, from, to, t0, d, i }
  let held = null;     // the dart in the thrower's hand
  let turnKey = '';

  // ---------- players ----------
  let seats = [], me = -1, avKey = '', avs = [], S = null, aimSrc = null, dartStart = 0, dartN = -1, thrower = -1, throwT = 1, lastN = 0, lastAt = 0;
  const arrow = youArrow(); arrow.visible = false; arrow.scale.setScalar(.7); scene.add(arrow);
  const homeOf = i => { const k = (i - (me >= 0 ? me : 0) + seats.length) % seats.length; return SLOTS[k % SLOTS.length]; };
  function setSeats(list, mine) {
    seats = list; me = mine;
    const key = list.map(s => s.color + (s.av || []).join('')).join('|') + '|' + mine;
    if (key === avKey) return; avKey = key;
    for (const a of avs) { scene.remove(a.wrap); disposeAvatar(a.av); }
    avs = list.map((s, i) => {
      const av = avatar3d(s.color, s.av, { pose: 'stand' }); av.position.y = .76; // feet on the ground (see standing-avatar notes)
      const wrap = new THREE.Group(); wrap.scale.setScalar(AV); wrap.add(av); scene.add(wrap);
      const [hx, hz, hy] = homeOf(i); wrap.position.set(hx, hy, hz);
      av.traverse(o => { if (o.isMesh) o.castShadow = true; });
      for (const arm of av.userData.arms) { let lo = 0; arm.traverse(m => { if (m.isMesh && m.geometry) { m.geometry.computeBoundingBox(); lo = Math.min(lo, m.geometry.boundingBox.min.y); } }); arm.userData.hand = lo + .05; }
      return { i, wrap, av, face: 0, ph: 0, walk: 0, hop: 0, seed: i * 1.9, tag: { x: 0, y: 0, show: false } };
    });
    shadowFor = 10;
  }

  // ---------- state from the server ----------
  function setState(s) {
    S = s;
    const now = performance.now();
    thrower = s.ph === 'play' ? s.turn : -1;
    if (s.dart && s.dart.n !== dartN) { dartN = s.dart.n; dartStart = now - s.dart.ago; }
    // a new turn: pull the old darts out of the board
    const key = `${s.leg}.${s.round}.${s.turn}`;
    if (key !== turnKey) { turnKey = key; pullOut(); }
    const L = s.last;
    if (L && L.n !== lastN) {
      lastN = L.n; lastAt = now - L.ago;
      if (L.ago < MS.fly && !reduced) startFly(L, now - L.ago);
      else { stickDart(L, true); if (L.ago < 1500) hit(L); }
    }
    // darts already in the board when we arrived
    for (let i = 0; i < s.darts.length; i++) if (!stuck.some(d => d.i === i) && !(fly && fly.i === i)) stickDart({ ...s.darts[i], i, s: s.turn }, true);
  }
  function pullOut() {
    for (const d of stuck) { falling.push({ g: d.g, v: new THREE.Vector3((Math.random() - .5) * .6, .8 + Math.random() * .6, 1.2 + Math.random() * .6), w: (Math.random() - .5) * 8, t: 0 }); }
    stuck = [];
    if (fly) { scene.remove(fly.g); fly = null; }
  }
  function handPos(a, out) { const arm = a.av.userData.arms[0]; out.set(0, arm.userData.hand, 0); return arm.localToWorld(out); }
  function startFly(L, t0) {
    const a = avs[L.s]; if (!a) return stickDart(L, true);
    const g = makeDart(seats[L.s]?.color || '#ffb547'); scene.add(g);
    const from = new THREE.Vector3(); a.av.updateWorldMatrix(true, true); handPos(a, from);
    if (held) held.visible = false;
    fly = { g, from, to: boardPt(L.x, L.y), t0, i: L.i, L };
    throwT = 0; onCue?.({ k: 'throw', s: L.s });
  }
  const tilt = () => (Math.random() - .5) * .35;
  function stickDart(L, quiet) {
    const g = makeDart(seats[L.s ?? S?.turn]?.color || '#ffb547');
    const p = boardPt(L.x, L.y); const r = Math.hypot(L.x, L.y);
    const back = R.frame * BS + .22;
    if (Math.abs(p.x) > back || Math.abs(p.y - BY) > back) { // off the backboard altogether: it bounces away
      g.position.copy(p); scene.add(g); falling.push({ g, v: new THREE.Vector3(0, .5, 1.5), w: 6, t: 0 }); return;
    }
    g.position.copy(p); g.position.z = r > R.frame ? BZ - .09 : BZ; g.rotation.set(-.3 + tilt() * .5, tilt() * 1.2, Math.random() * 6.28);
    scene.add(g); stuck.push({ g, i: L.i, wob: quiet ? 0 : 1, rx: g.rotation.x }); shadowFor = Math.max(shadowFor, 3);
  }

  // ---------- frame loop ----------
  let W_ = 0, H_ = 0, T = 0;
  const camPos = new THREE.Vector3(.4, 2.3, 6.5), camLook = new THREE.Vector3(0, BY - .2, 0), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), proj = new THREE.Vector3(), info = { tags: [], aimLab: null, busy: false };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -BZ);
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W_ && h === H_) return;
    W_ = w; H_ = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  // a point on the screen to board units
  function toBoard(cx, cy) {
    const r = canvas.getBoundingClientRect(); if (!r.width) return null;
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, v2)) return null;
    return [v2.x / BS, (v2.y - BY) / BS];
  }
  // how many screen pixels one board unit covers, for touch dragging
  function pxPerUnit() { const d = camera.position.distanceTo(boardG.position); return H_ / (2 * d * Math.tan(camera.fov * Math.PI / 360)) * BS; }
  const dartMs = () => performance.now() - dartStart;

  function frame(dt) {
    resize(); T += dt;
    const now = performance.now(), playing = S?.ph === 'play', aiming = playing && S.stage === 'aim';
    // --- avatars: the thrower walks to the line, the rest to their spots ---
    avs.forEach((a, i) => {
      const at = i === thrower && playing, home = homeOf(i), tx = at ? OCHE.x : home[0], tz = at ? OCHE.z : home[1];
      const p = a.wrap.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      let want;
      if (d > .03) { const st = Math.min(d, dt * 2.6); p.x += dx / d * st; p.z += dz / d * st; a.ph += st * 5.2; a.walk = Math.min(1, a.walk + dt * 5); want = Math.atan2(dx, dz); shadowFor = Math.max(shadowFor, 2); }
      else { a.walk = Math.max(0, a.walk - dt * 5); want = at ? Math.atan2(-p.x * .8, -p.z) : Math.atan2(.3 - p.x, 5 - p.z); }
      const gy = !at && d < .9 ? home[2] : Math.abs(p.x + 2.45) < .95 && Math.abs(p.z - .5) < .5 ? STAGE : 0; p.y += (gy - p.y) * Math.min(1, dt * 9); // up onto the stage
      let df = ((want - a.face + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; a.face += df * Math.min(1, dt * 8); a.wrap.rotation.y = a.face;
      a.hop = Math.max(0, a.hop - dt * 1.2);
      animateAvatar(a.av, T, { seed: a.seed, active: false, hop: a.hop });
      if (a.walk > .01) walkAvatar(a.av, a.ph, a.walk);
      a.av.position.y = .76 + Math.sin(a.hop * Math.PI) * .3;
      // the throwing arm: raised with a dart while aiming, a snap forward on the throw
      if (at && d < .3) {
        const arm = a.av.userData.arms[0], hold = i === me && aimSrc?.hold >= 0 ? Math.min(1, aimSrc.hold / HAND.settle) : 0;
        throwT = Math.min(1, throwT + dt / .32);
        const up = -2.25 - hold * .45, snap = throwT < 1 ? (throwT < .35 ? up - .3 * (throwT / .35) : up - .3 + (up + 1.55 - (up - .3)) * ease((throwT - .35) / .65)) : up;
        arm.rotation.x = aiming || throwT < 1 ? snap : arm.userData.rx - .2;
      }
    });
    // --- the dart in the hand ---
    const ta = thrower >= 0 ? avs[thrower] : null;
    if (aiming && ta && Math.hypot(ta.wrap.position.x - OCHE.x, ta.wrap.position.z - OCHE.z) < .3 && !fly) {
      if (!held || held.userData.c !== seats[thrower]?.color) { if (held) scene.remove(held); held = makeDart(seats[thrower]?.color || '#ffb547'); held.userData.c = seats[thrower]?.color; scene.add(held); }
      held.visible = true; ta.av.updateWorldMatrix(true, true); handPos(ta, held.position);
      boardPt(0, .6, v).sub(held.position).normalize(); held.position.addScaledVector(v, DART * .4); // held by the barrel, tip towards the board
      held.lookAt(held.position.x - v.x, held.position.y - v.y, held.position.z - v.z);
    } else if (held && !fly) held.visible = false;
    // --- the dart in the air ---
    if (fly) {
      const t = clamp((now - fly.t0) / MS.fly, 0, 1), p = fly.g.position;
      p.lerpVectors(fly.from, fly.to, t); p.y += Math.sin(t * Math.PI) * .22 * fly.from.distanceTo(fly.to) / 3;
      const t2 = Math.min(1, t + .03); v.lerpVectors(fly.from, fly.to, t2); v.y += Math.sin(t2 * Math.PI) * .22 * fly.from.distanceTo(fly.to) / 3;
      if (t < 1) { fly.g.lookAt(p.x * 2 - v.x, p.y * 2 - v.y, p.z * 2 - v.z); fly.g.rotateZ(dt * 20); }
      if (t >= 1) { const L = fly.L; scene.remove(fly.g); fly = null; stickDart(L, false); hit(L); }
    }
    for (const d of stuck) if (d.wob > 0) { d.wob = Math.max(0, d.wob - dt * 3); d.g.rotation.x = d.rx + Math.sin(T * 40) * .12 * d.wob; }
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i]; f.t += dt; f.v.y -= 9 * dt; f.g.position.addScaledVector(f.v, dt); f.g.rotation.x += f.w * dt;
      if (f.g.position.y < .05) { f.g.position.y = .05; f.v.set(0, 0, 0); f.w = 0; }
      if (f.t > .9) f.g.scale.setScalar(Math.max(.01, 1 - (f.t - .9) / .3));
      if (f.t > 1.2) { scene.remove(f.g); falling.splice(i, 1); }
    }
    // --- the aim ---
    if (hint && aiming) { const [hx, hy] = spot(hint.n, hint.m), k = reduced ? 1 : 1 + Math.sin(T * 5) * .18; boardPt(hx, hy, v); hintG.position.set(v.x, v.y, BZ + .015); hintG.scale.setScalar(k * (hint.n === 25 ? .7 : 1)); hintG.material.opacity = reduced ? .95 : .85 + Math.sin(T * 5) * .12; hintG.visible = true; } else hintG.visible = false;
    info.aimLab = null;
    if (aiming && S.turn === me && aimSrc && S.dart) {
      const ms = dartMs(), [lx, ly] = landing(S.dart.seed, [aimSrc.x, aimSrc.y], ms, aimSrc.hold), r = wobbleR(aimSrc.hold);
      aimG.visible = true;
      boardPt(aimSrc.x, aimSrc.y, v); ring.position.set(v.x, v.y, BZ + .02); ringIn.position.copy(ring.position);
      ring.scale.setScalar(r * BS); ringIn.scale.setScalar(r * BS);
      boardPt(lx, ly, v); dot.position.set(v.x, v.y, BZ + .03); dotInk.position.copy(dot.position); cross.position.copy(dot.position);
      const h = aimSrc.hold;
      if (!(h >= 0)) cNow.copy(cLoose); else if (h < HAND.settle) cNow.copy(cLoose).lerp(cSteady, h / HAND.settle); else if (h < HAND.tire) cNow.copy(cSteady); else cNow.copy(cSteady).lerp(cTired, Math.min(1, (h - HAND.tire) / 700));
      ring.material.color.copy(cNow); ringIn.material.color.copy(cNow);
      info.aimLab = [lx, ly];
    } else aimG.visible = false;

    // --- camera: close on the board while throwing, back a step between turns ---
    const half = Math.tan(camera.fov * Math.PI / 360), need = R.frame * BS * 1.35;
    let dist = Math.max(need / half * 1.36, (need + .12) / (half * camera.aspect));
    const wide = !playing || (S.stage === 'fly' && S.last?.fin && now - lastAt > MS.fly + 350);
    if (wide) dist += playing ? 1.2 : 2.6;
    wantPos.set(.35 + (wide ? .2 : 0), BY + .3 + (wide ? .4 : 0), BZ + dist); wantLook.set(0, BY - (camera.aspect > 1 ? .3 : .1) - (wide ? .2 : 0), BZ);
    const k = Math.min(1, dt * (aiming ? 3.5 : 2));
    camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
    camera.position.copy(camPos); camera.lookAt(camLook);
    shake.apply(camera, dt);

    if (me >= 0 && avs[me] && !(me === thrower && playing) && avs[me].walk < .05) { arrow.visible = true; arrow.position.copy(avs[me].wrap.position); arrow.position.y += 3 * AV + .25; animateArrow(arrow, T); } else arrow.visible = false;
    cloudRing.rotation.y += dt * .006; flyBirds(T); blow(T);
    fx.update(dt, camera, H_);
    if (shadowFor > 0) { shadowFor--; renderer.shadowMap.needsUpdate = true; }
    renderer.render(scene, camera);
    avs.forEach((a, i) => {
      const t = a.tag; proj.set(a.wrap.position.x, a.wrap.position.y + 3 * AV + .16, a.wrap.position.z).project(camera);
      t.show = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.1 && !(i === thrower && playing);
      t.x = (proj.x + 1) / 2 * W_; t.y = (1 - proj.y) / 2 * H_; info.tags[i] = t;
    });
    info.tags.length = avs.length;
    info.busy = !!fly;
    onFrame?.(info);
  }
  // A dart has landed: effects, then tell the HUD.
  function hit(L) {
    const p = boardPt(L.x, L.y); p.z += .08;
    proj.copy(p).project(camera);
    const sx = (proj.x + 1) / 2 * W_, sy = (1 - proj.y) / 2 * H_;
    if (!reduced) {
      if (L.bust) { fx.puff(p, { n: 10, color: '#ffd0c8', size: .2, speed: 1.2 }); shake.kick(.25); }
      else if (L.num === 25 && L.m === 2) { fx.burst(p, { n: 26, colors: ['#ffe27a', '#ff7a59', '#fff4e2'], shape: [STAR, CONF], speed: 2.4, up: 1.6, size: .16, grav: 3 }); shake.kick(.35); }
      else if (L.m === 3) fx.burst(p, { n: 18, colors: ['#ffe27a', '#ffffff'], shape: STAR, speed: 2, up: 1.4, size: .14, grav: 3 });
      else if (L.m === 2) fx.burst(p, { n: 14, colors: ['#ff9fb8', '#ffffff'], shape: HEART, speed: 1.8, up: 1.2, size: .13, grav: 3 });
      else if (L.v) fx.burst(p, { n: 6, colors: '#fff4e2', shape: DOT, speed: 1.1, up: .6, size: .08, grav: 2 });
      if (L.out) { fx.confetti(v.set(0, BY + 1.2, 1.2), { n: 110, w: 5, h: 2, s: L.s }); for (const a of avs) a.hop = 1; }
      else if (L.fin && L.got === 180) fx.confetti(v.set(0, BY + 1.2, 1.2), { n: 70, w: 4, h: 2, s: L.s }); // a maximum: the thrower's own shower, for everyone
    }
    if (avs[L.s] && (L.m === 3 || L.out || (L.num === 25 && L.m === 2))) avs[L.s].hop = Math.max(avs[L.s].hop, .7);
    onCue?.({ k: 'hit', ...L, sx, sy });
  }
  const frames = frameLoop(frame, { onSlow: () => res.lower() });

  return {
    setSeats, setState, toBoard, pxPerUnit, dartMs,
    setAim(a) { aimSrc = a; },
    setHint(t) { hint = t; },
    dispose() {
      frames.stop();
      for (const a of avs) disposeAvatar(a.av);
      disposeArrow(arrow); fx.dispose(); faceTex.dispose();
      scene.traverse(o => { if (o.isMesh && !o.userData.keep) o.geometry?.dispose(); });
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

// Beanstalk Bounce 3D view (three.js). The climb happens in one flat plane, drawn in 3D from the front: two side
// stalks to bounce off, a great stalk behind that the ledges grow from, everyone's avatar, and the storm below.
// Your own climber comes from the browser's physics every frame (mine()); everyone else comes from the server's
// stream (snap()), drawn a moment in the past so it moves smoothly. Only the floors near the camera are drawn.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar } from '../../avatar3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { toonMat, skyDome, clouds as cloudSea, island, birds, createFx, shaker, disposeToon, nightScene, hash, STAR, DOT } from '../../scenery3d.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { buildTower, floorAt, ledgeOff, stormY, zoneOf, zoneInfo, zoneName, W, FLOOR_H, ZONE, SPRING, CRUMBLE, MOVING, CRUMBLE_S } from './tower.js';

const DELAY = 110;        // ms behind the newest server update that other climbers are drawn
const AV = .62;           // avatar size
const NF = 30, BELOW = 9; // floors drawn at once, and how many of them are under the camera
const CH = FLOOR_H * 10;  // a stalk piece is ten floors tall and repeats
const DEPTH = 1;          // ledges reach this far to the front and back
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Merges simple shapes into one vertex-coloured geometry. parts: [geometry, colour, [x, y, z], [rx, ry, rz], [sx, sy, sz]]
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function merged(parts) {
  const pos = [], nor = [], col = [];
  for (const [geo, color, p, r, s] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_m.compose(_v.set(...(p || [0, 0, 0])), _q.setFromEuler(_e.set(...(r || [0, 0, 0]))), _s.set(...(s || [1, 1, 1]))));
    const P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 3;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < n; i++) { const c = typeof color === 'function' ? color(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) : color; _c.set(c); col.push(_c.r, _c.g, _c.b); }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const vmat = () => toonMat(new THREE.MeshStandardMaterial({ vertexColors: true }));
// The dark outline round a shape: the same shape with its corners welded, drawn inside out and a little fatter.
function hullGeo(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), p = g.attributes.position, n = p.count, sum = new Map(), keys = new Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1).sub(a); c.fromBufferAttribute(p, i + 2).sub(a); b.cross(c).normalize();
    for (let k = 0; k < 3; k++) { const key = keys[i + k] = Math.round(p.getX(i + k) * 200) + ',' + Math.round(p.getY(i + k) * 200) + ',' + Math.round(p.getZ(i + k) * 200); let v = sum.get(key); if (!v) sum.set(key, v = [0, 0, 0]); v[0] += b.x; v[1] += b.y; v[2] += b.z; }
  }
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = sum.get(keys[i]), l = Math.hypot(v[0], v[1], v[2]) || 1; nor[i * 3] = v[0] / l; nor[i * 3 + 1] = v[1] / l; nor[i * 3 + 2] = v[2] / l; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', p.clone()); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.dispose();
  return out;
}
function inkMat(t, color = '#4a2c22') {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${t.toFixed(4)};`); };
  m.customProgramCacheKey = () => 'bbink' + t.toFixed(4);
  return m;
}

// One ten-floor piece of beanstalk: a wavy stem in segments, with rings, leaves and curly tendrils. side: which
// way the leaves lean (away from the gap).
function stalkGeo(rad, seed, leafy = 1) {
  const parts = [], seg = CH / 13, greens = ['#4f9e45', '#5aad4c', '#47913f'];
  const wave = y => Math.sin(y / CH * 6.283) * rad * .13;
  for (let i = 0; i < 13; i++) {
    const y = (i + .5) * seg, r = rad * (.96 + .08 * hash(i, seed));
    parts.push([new THREE.CylinderGeometry(r * .97, r, seg * 1.04, 9), greens[i % 3], [wave(y), y, 0], [0, hash(i, seed + 1) * 3, 0]]);
    parts.push([new THREE.TorusGeometry(r * 1.02, rad * .09, 5, 10), '#3d8238', [wave(y - seg / 2), y - seg / 2, 0], [Math.PI / 2, 0, 0]]);
  }
  const leaf = new THREE.SphereGeometry(1, 7, 5), n = Math.round(9 * leafy);
  for (let i = 0; i < n; i++) {
    const y = (i + .3 + hash(i, seed + 2) * .5) * CH / n, a = (hash(i, seed + 3) - .5) * 2.4, L = rad * (1.1 + hash(i, seed + 4) * .7);
    // leaves grow out to the side (+x) and a little to the front or back
    const dx = Math.cos(a), dz = Math.sin(a);
    parts.push([leaf, i % 2 ? '#6cc257' : '#7ed067', [wave(y) + dx * (rad + L * .8), y + .1, dz * (rad + L * .8)], [0, -a, -.25], [L, L * .13, L * .5]]);
    parts.push([new THREE.CylinderGeometry(rad * .07, rad * .1, L * .7, 5), '#3d8238', [wave(y) + dx * (rad + L * .2), y, dz * (rad + L * .2)], [0, -a, Math.PI / 2 + .2]]);
  }
  for (let i = 0; i < 3; i++) {
    const y = (i + .6) * CH / 3, a = (hash(i, seed + 5) - .5) * 2;
    parts.push([new THREE.TorusGeometry(rad * .34, rad * .06, 5, 12, 4.6), '#8fdc74', [wave(y) + Math.cos(a) * rad * 1.3, y, Math.sin(a) * rad * 1.3], [0, -a, 0]]);
  }
  return merged(parts);
}

function mushroomGeo() {
  const dots = [[.22, .52, .3], [-.3, .5, .2], [0, .66, 0], [.1, .5, -.36], [-.2, .56, -.2], [.36, .44, -.1]];
  return merged([
    [new THREE.CylinderGeometry(.2, .27, .4, 8), '#fff4e2', [0, .2, 0]],
    [new THREE.SphereGeometry(.62, 10, 6, 0, 6.283, 0, Math.PI / 2), '#ef5a4c', [0, .34, 0], 0, [1, .62, 1]],
    [new THREE.CylinderGeometry(.6, .6, .06, 10), '#ffd9c2', [0, .34, 0]],
    ...dots.map(([x, y, z]) => [new THREE.SphereGeometry(.11, 6, 4), '#ffffff', [x, y, z], 0, [1, .6, 1]]),
  ]);
}

// A little painted sign: floor numbers, and a banner for each new zone.
function makeSign(big) {
  const cv = document.createElement('canvas'); cv.width = big ? 512 : 160; cv.height = big ? 128 : 96;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(big ? 7.2 : 2.1, big ? 1.8 : 1.26, 1); sp.visible = false; sp.renderOrder = 3;
  const font = (getComputedStyle(document.documentElement).getPropertyValue('--fd') || 'system-ui').trim() || 'system-ui';
  let shown = null;
  return { sp, set(text, sub, color) {
    const key = text + '|' + sub + color; if (key === shown) return; shown = key;
    const g = cv.getContext('2d'), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
    g.fillStyle = color || '#fff4e2'; g.strokeStyle = '#3b2219'; g.lineWidth = big ? 8 : 7; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, big ? 40 : 26); g.fill(); g.stroke();
    g.fillStyle = '#3b2219'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (big) { g.font = `700 54px ${font}`; g.fillText(text, w / 2, sub ? 50 : 66, w - 50); if (sub) { g.font = `600 30px ${font}`; g.fillText(sub, w / 2, 96, w - 50); } }
    else { g.font = `700 50px ${font}`; g.fillText(text, w / 2, 52, w - 30); }
    tex.needsUpdate = true;
  }, dispose() { tex.dispose(); sp.material.dispose(); } };
}

export function createScene(canvas, { onFrame, step, clock } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .5, 900);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(-30, 60, 50); scene.add(sun);
  scene.background = new THREE.Color('#d6f1ff');
  const sky = skyDome(scene, '#5fb3f0', '#d6f1ff', { r: 420 });
  const fx = createFx(scene, { max: 1100 }), shake = shaker(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const world = new THREE.Group(); scene.add(world);

  // ----- the stalks -----
  const sideGeo = stalkGeo(1.25, 3), sideHull = hullGeo(sideGeo), backGeo = stalkGeo(3.3, 11, 0), backHull = hullGeo(backGeo);
  const stalkMat = vmat(), backMat = toonMat(new THREE.MeshStandardMaterial({ vertexColors: true, color: '#86ad9c' })), ink = inkMat(.05), inkBack = inkMat(.07, '#35543c');
  const pieces = [];
  for (let j = 0; j < 5; j++) {
    for (const sd of [-1, 1]) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(sideGeo, stalkMat), new THREE.Mesh(sideHull, ink));
      g.position.x = sd * (W + 1.12); if (sd < 0) g.rotation.y = Math.PI; world.add(g); pieces.push({ g, j, ph: sd < 0 ? CH / 2 : 0 });
    }
    const b = new THREE.Group(); b.add(new THREE.Mesh(backGeo, backMat), new THREE.Mesh(backHull, inkBack)); b.position.set(0, 0, -5.4); b.rotation.y = -Math.PI / 2; world.add(b); pieces.push({ g: b, j, ph: 7 });
  }

  // ----- the ledges: a few instanced shapes moved to wherever the floors near the camera are -----
  const inst = (geo, mat, n, color = true) => { const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; if (color) im.setColorAt(0, _c.set('#fff')); world.add(im); return im; };
  const shade = (x, y) => (y > -.16 ? '#ffffff' : '#9a9a9a'); // the top keeps the ledge's colour, the underside is darker
  const midGeo = merged([[new THREE.BoxGeometry(1, .5, DEPTH * 2), shade, [0, -.25, 0]]]);
  const capGeo = merged([[new THREE.CylinderGeometry(DEPTH, DEPTH * .9, .5, 14), shade, [0, -.25, 0]]]);
  const ledgeMat = vmat(), ledgeInk = inkMat(.045);
  const mid = inst(midGeo, ledgeMat, NF), midInk = inst(hullGeo(midGeo), ledgeInk, NF, false);
  const caps = inst(capGeo, ledgeMat, NF * 2), capsInk = inst(hullGeo(capGeo), ledgeInk, NF * 2, false);
  const stems = inst(new THREE.BoxGeometry(1, .26, 1), toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff' })), NF);
  const shroomG = mushroomGeo(), shrooms = inst(shroomG, vmat(), NF, false), shroomInk = inst(hullGeo(shroomG), inkMat(.03), NF, false);
  const puffs = inst(new THREE.IcosahedronGeometry(.55, 1), toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff' })), NF * 2, false);
  const signs = Array.from({ length: 8 }, () => { const s = makeSign(false); world.add(s.sp); return s; });
  const banners = Array.from({ length: 2 }, () => { const s = makeSign(true); world.add(s.sp); return s; });
  const bounced = new Map(); // floor -> when its mushroom was last bounced on (seconds)

  // the meadow island everything starts on
  const base = island(30, 7, { props: 12, seed: 4, flowers: 50, depth: .8 }); base.position.set(0, -.58, -1.2); world.add(base);

  // ----- the storm -----
  const stormMat = new THREE.MeshToonMaterial({ color: '#6a59a6', emissive: '#ffffff', emissiveIntensity: 0 });
  const STORM_N = 110, storm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), stormMat, STORM_N); storm.frustumCulled = false; scene.add(storm);
  for (let i = 0; i < STORM_N; i++) storm.setColorAt(i, _c.set(['#ffffff', '#d9cdfa', '#b9aee6', '#f1e9ff'][i % 4]));
  const stormP = Array.from({ length: STORM_N }, (_, i) => ({ x: (hash(i, 1) - .5) * 60, z: -12 + hash(i, 2) * 20, y: -hash(i, 3) * 3.2, r: 2.2 + hash(i, 4) * 2.6, ph: hash(i, 5) * 6 }));
  const stormBody = new THREE.Mesh(new THREE.BoxGeometry(160, 60, 60), new THREE.MeshBasicMaterial({ color: '#3d3266' })); scene.add(stormBody);
  let flash = 0, nextFlash = 2;

  // ----- far away: clouds drifting past, small islands, birds -----
  const seaG = cloudSea({ min: 26, max: 150, below: -6, near: 60, far: 0, seed: 5 }); scene.add(seaG);
  const driftN = 26, drift = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff' })), driftN * 3);
  drift.frustumCulled = false; drift.userData.cloud = true; scene.add(drift);
  const driftP = Array.from({ length: driftN }, (_, i) => ({ x: (hash(i, 21) - .5) * 190, z: -24 - hash(i, 22) * 70, h: hash(i, 23), s: 2.4 + hash(i, 24) * 3.6, par: .25 + hash(i, 25) * .45, v: .4 + hash(i, 26) }));
  const isles = [0, 1, 2, 3].map(i => {
    const g = island(4 + i % 2 * 2, 4, { round: true, props: 5, seed: 20 + i, flowers: 8, lamps: 1 }); g.scale.setScalar(1.5 + hash(i, 31));
    g.userData.at = [(i % 2 ? 1 : -1) * (30 + hash(i, 32) * 22), 14 + i * 37, -34 - hash(i, 33) * 26]; scene.add(g); return g;
  });
  const birdG = new THREE.Group(); scene.add(birdG); const fly = birds(birdG, 34, 5, 4, 1.5);
  nightScene(scene);

  // ----- climbers -----
  let T = null, pace = 'normal', seedKey = '', climbers = [], seatsKey = '', me = -1, mineK = null, watchI = 0, stage = 'count';
  let outs = [], streaks = [], myStreak = 0;
  const snaps = [], cur = [];
  const shadowGeo = new THREE.CircleGeometry(.5, 14).rotateX(-Math.PI / 2), shadowMat = new THREE.MeshBasicMaterial({ color: '#2a1422', transparent: true, opacity: .22, depthWrite: false });
  const arrow = youArrow(); arrow.scale.setScalar(1.25); arrow.visible = false; scene.add(arrow);
  let camY = 3, camX = 0, camInit = false, dist = 34, zoom = 0;
  const tmp = new THREE.Vector3();

  function setTower(seed, p) {
    pace = p; if (String(seed) === seedKey) return; seedKey = String(seed);
    T = buildTower(seed); bounced.clear(); camInit = false; snaps.length = 0; cur.length = 0;
  }
  function setSeats(seats) {
    const key = seats.map(s => s.color + JSON.stringify(s.av)).join('|');
    if (key === seatsKey) return; seatsKey = key;
    for (const c of climbers) { world.remove(c.root); disposeAvatar(c.av); }
    climbers = seats.map((s, i) => {
      const root = new THREE.Group(), pivot = new THREE.Group(), av = avatar3d(s.color, s.av, { pose: 'stand' });
      av.position.y = .76 - .85; /* full size (animateAvatar owns the avatar's scale), feet on the platform */ pivot.position.y = .85; pivot.add(av); root.add(pivot);
      const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.position.y = .03; sh.renderOrder = 1; root.add(sh);
      root.position.z = (i % 3 - 1) * .28; // a little apart in depth, so a crowd on one ledge can be told apart
      world.add(root);
      return { root, pivot, av, sh, seed: i * 1.7, ph: 0, yaw: 0, spin: 0, wasOn: 0, x: 0, y: 0 };
    });
  }
  function snap(S) {
    const now = performance.now();
    snaps.push({ at: now, k: S.k });
    while (snaps.length > 2 && now - snaps[1].at > DELAY + 400) snaps.shift();
    stage = S.stage; outs = S.out || []; streaks = S.stk || [];
  }
  function others(now) {
    const t = now - DELAY; let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].at <= t) { a = snaps[i]; b = snaps[i + 1] || null; break; }
    if (!a) a = snaps[0]; if (!a) return;
    const u = b ? clamp((t - a.at) / (b.at - a.at || 1), 0, 1) : 0;
    for (let i = 0; i < a.k.length; i++) {
      const p = a.k[i], q = b?.k[i] || p, o = cur[i] ||= {};
      o.x = p[0] + (q[0] - p[0]) * u; o.y = p[1] + (q[1] - p[1]) * u; o.vx = q[2]; o.vy = q[3]; o.on = (u < .5 ? p : q)[4]; o.face = q[5];
    }
  }

  // sounds and sparkles for my own climber come from the physics cues
  function cue(c, k, streak) {
    const p = { x: k.x, y: k.y, z: .2 };
    if (c === 'jump') fx.puff(p, { n: 6, size: .28, speed: 1.6 });
    else if (c === 'land') { fx.puff(p, { n: 8, size: .32, speed: 2.2 }); if (streak) fx.burst({ x: k.x, y: k.y + .4, z: .4 }, { n: 10 + Math.min(20, streak * 3), colors: ['#ffd84a', '#fff4e2', '#ff8fab', '#7ed3b2'], speed: 4, up: 3.5, shape: STAR, size: .3 }); }
    else if (c === 'spring') { fx.burst({ x: k.x, y: k.y + .5, z: .4 }, { n: 16, colors: ['#ef5a4c', '#ffffff', '#ffd84a'], speed: 4, up: 6, shape: STAR, size: .3 }); fx.ring({ x: k.x, y: k.y + .1, z: 0 }, { color: '#fff4e2', size: 1.6 }); }
    else if (c === 'wall') fx.burst({ x: k.x + Math.sign(k.x) * .4, y: k.y + .9, z: .4 }, { n: 7, colors: ['#9be06a', '#fff4e2'], speed: 3, up: 2, shape: DOT, size: .22 });
    else if (c === 'drop') fx.burst({ x: k.x, y: k.y - .2, z: .2 }, { n: 12, colors: ['#e0c080', '#b08a5a'], speed: 3, up: 1, shape: DOT, size: .3 });
  }
  function bounce(f, t) { bounced.set(f, t); }
  function event(e) {
    if (e.t === 'out') {
      const p = { x: e.x ?? 0, y: (e.y ?? 0) + .8, z: .4 };
      fx.burst(p, { n: 26, colors: ['#5a4b8c', '#8f7fd0', '#ffffff', '#ffe36b'], speed: 6, up: 6, shape: [DOT, STAR], size: .4 });
      flash = 1; if (e.s === me) shake.kick(.5);
    } else if (e.t === 'streak') {
      const c = climbers[e.s]; if (c && e.s !== me) fx.sparkle({ x: c.x, y: c.y + 1.4, z: .4 }, { n: 8, r: .8 });
    } else if (e.t === 'zone') {
      const c = climbers[e.s]; if (c) fx.confetti({ x: c.x, y: c.y + 1, z: 1 }, { n: 70, w: 8, h: 5 });
    }
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    // far enough back that the whole gap and both stalks fit, however narrow the screen
    const half = Math.tan(camera.fov * Math.PI / 360);
    dist = Math.max(31, (W + 3.1) / (half * camera.aspect));
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  const colTop = new THREE.Color(), colStem = new THREE.Color();
  function drawLedges(t, lo, gone) {
    let pi = 0, si = 0, bi = 0;
    for (let n = 0; n < NF; n++) {
      const i = lo + n, hide = () => { _m.makeScale(0, 0, 0); mid.setMatrixAt(n, _m); midInk.setMatrixAt(n, _m); caps.setMatrixAt(n * 2, _m); caps.setMatrixAt(n * 2 + 1, _m); capsInk.setMatrixAt(n * 2, _m); capsInk.setMatrixAt(n * 2 + 1, _m); stems.setMatrixAt(n, _m); shrooms.setMatrixAt(n, _m); shroomInk.setMatrixAt(n, _m); };
      if (i < 0) { hide(); continue; }
      const F = floorAt(T, i), off = ledgeOff(F, t), Z = zoneInfo(zoneOf(i));
      let y = i * FLOOR_H, x0 = F.x0 + off, x1 = F.x1 + off, dx = 0, sc = 1;
      const g = gone?.[i];
      if (F.kind === CRUMBLE && g !== undefined) {
        const u = t - g;
        if (u < CRUMBLE_S) dx = Math.sin(u * 70) * .07 * (.4 + u / CRUMBLE_S);
        else { const d = u - CRUMBLE_S; y -= 24 * d * d; sc = Math.max(0, 1 - d * 1.2); }
      }
      if (sc <= 0) { hide(); continue; }
      const full = i % ZONE === 0, w = x1 - x0, cx = (x0 + x1) / 2 + dx, inset = DEPTH - .3;
      colTop.set(F.kind === CRUMBLE ? '#e3c489' : Z.top); if (i % 2 && F.kind !== CRUMBLE) colTop.multiplyScalar(.95);
      _q.identity();
      _m.compose(_v.set(cx, y, 0), _q, _s.set(full ? w + 1.2 : Math.max(.1, w - inset * 2) * sc, sc, sc)); mid.setMatrixAt(n, _m); midInk.setMatrixAt(n, _m); mid.setColorAt(n, colTop);
      for (const [k, ex] of [[0, x0 + inset + dx], [1, x1 - inset + dx]]) { if (full) _m.makeScale(0, 0, 0); else _m.compose(_v.set(ex, y, 0), _q, _s.set(sc, sc, sc)); caps.setMatrixAt(n * 2 + k, _m); capsInk.setMatrixAt(n * 2 + k, _m); caps.setColorAt(n * 2 + k, colTop); }
      // a stem back to the great stalk; moving ledges ride on two little clouds instead
      if (F.kind === MOVING) {
        _m.makeScale(0, 0, 0); stems.setMatrixAt(n, _m);
        for (const ex of [x0 + .9, x1 - .9]) if (pi < NF * 2) { const b = 1 + Math.sin(t * 3 + i + ex) * .06; _m.compose(_v.set(ex, y - .75, 0), _q, _s.set(1.5 * b, .8 / b, 1.2)); puffs.setMatrixAt(pi++, _m); }
      } else {
        colStem.set(F.kind === CRUMBLE ? '#b08a5a' : Z.slab);
        _m.compose(_v.set(cx, y - .3, -2.3), _q, _s.set(full ? 9 : Math.min(1.5, w * .3) * sc, sc, 3.2)); stems.setMatrixAt(n, _m); stems.setColorAt(n, colStem);
      }
      if (F.kind === SPRING) {
        const b = bounced.get(i), u = b === undefined ? 9 : t - b, sq = u < .5 ? Math.sin(u * 22) * Math.exp(-u * 7) * .5 : 0;
        _m.compose(_v.set(cx, y, .1), _q, _s.set(1.25 * (1 + sq * .5), 1.25 * (1 - sq), 1.25 * (1 + sq * .5))); shrooms.setMatrixAt(n, _m); shroomInk.setMatrixAt(n, _m);
      } else { _m.makeScale(0, 0, 0); shrooms.setMatrixAt(n, _m); shroomInk.setMatrixAt(n, _m); }
      // signs: the floor number every five floors, a banner where a new zone starts
      if (full && i > 0 && bi < banners.length) { const B = banners[bi++]; B.set(zoneName(zoneOf(i)), 'Floor ' + i, Z.top); B.sp.position.set(0, y + 1.3, -1.45); B.sp.visible = true; }
      else if (i % 5 === 0 && i > 0 && !full && si < signs.length) { const S = signs[si++]; S.set(String(i), '', '#fff4e2'); S.sp.position.set(x1 + dx - .4, y + .95, -.8); S.sp.visible = true; }
    }
    for (; pi < NF * 2; pi++) { _m.makeScale(0, 0, 0); puffs.setMatrixAt(pi, _m); }
    for (; si < signs.length; si++) signs[si].sp.visible = false;
    for (; bi < banners.length; bi++) banners[bi].sp.visible = false;
    for (const im of [mid, midInk, caps, capsInk, stems, shrooms, shroomInk, puffs]) im.instanceMatrix.needsUpdate = true;
    mid.instanceColor.needsUpdate = caps.instanceColor.needsUpdate = stems.instanceColor.needsUpdate = true;
  }

  const T0 = performance.now(); let trailT = 0;
  const frames = frameLoop((dt, now) => {
    const time = (now - T0) / 1000;
    step?.(dt);
    if (!T || !climbers.length) { renderer.render(scene, camera); return; }
    const t = clock ? clock() : 0, tt = Math.max(0, t);
    others(now);
    const sy = stormY(pace, tt);
    // ----- everyone on the stalk -----
    trailT += dt;
    for (let i = 0; i < climbers.length; i++) {
      const C = climbers[i], mine = i === me && mineK, src = mine ? mineK : cur[i];
      if (!src) continue;
      const gone = !!outs[i] && !mine;
      C.root.visible = !gone; if (gone) continue;
      C.x = src.x; C.y = src.y;
      C.root.position.x = src.x; C.root.position.y = src.y;
      const on = src.on >= 0, sp = Math.abs(src.vx), stk = mine ? myStreak : (streaks[i] ? streaks[i][0] : 0);
      const yawT = (src.face < 0 ? -1 : 1) * (on && sp < .6 ? .35 : 1.05);
      C.yaw += (yawT - C.yaw) * Math.min(1, dt * 14); C.pivot.rotation.y = C.yaw;
      // a somersault in the air while a streak is on
      if (!on && stk > 0 && !reduced) C.spin += dt * 11; else C.spin = 0;
      C.pivot.rotation.z = -(src.face < 0 ? -1 : 1) * C.spin;
      animateAvatar(C.av, time, { seed: C.seed, active: false, hop: on ? 0 : src.vy > 0 ? .5 : .32 });
      if (on) { C.ph += sp * dt * 1.5; walkAvatar(C.av, C.ph, Math.min(1, sp / 4)); }
      else walkAvatar(C.av, 1.1, .75);
      C.sh.visible = on;
      if (!mine && on && !C.wasOn) fx.puff({ x: src.x, y: src.y, z: 0 }, { n: 5, size: .26, speed: 1.6 });
      C.wasOn = on;
      if (!on && stk > 0 && trailT > .03 && !reduced) fx.rise({ x: src.x + (Math.random() - .5) * .5, y: src.y + .6, z: .3 }, { color: ['#ffd84a', '#ff8fab', '#7ed3b2', '#9aa8ff'], size: .3, life: .5, speed: .2, wobble: .5, shape: STAR });
    }
    if (trailT > .03) trailT = 0;
    const mineC = me >= 0 && mineK ? climbers[me] : null;
    arrow.visible = !!mineC && stage !== 'end';
    if (mineC) { arrow.position.set(mineC.x, mineC.y + 2.15, mineC.root.position.z); animateArrow(arrow, time); }

    // ----- camera -----
    const follow = me >= 0 && (mineK || !outs[me]) ? me : watchI, C = climbers[follow];
    const fy = C ? (follow === me && mineK ? mineK.y : cur[follow]?.y ?? 0) : 0;
    const wantY = Math.max(fy + 3.4, sy + 4), wantX = C ? C.x * .12 : 0;
    if (!camInit) { camY = wantY; camX = wantX; camInit = true; }
    camY += (wantY - camY) * Math.min(1, dt * (wantY > camY ? 5.5 : 3.5)); camX += (wantX - camX) * Math.min(1, dt * 3);
    zoom += ((stage === 'count' ? clamp(-t / 3, 0, 1) : 0) - zoom) * Math.min(1, dt * 4);
    camera.position.set(camX, camY + 1.6 + zoom * 5, dist + zoom * 12); camera.lookAt(camX * .6, camY, 0);
    shake.apply(camera, dt);

    // ----- the world round the camera -----
    drawLedges(tt, Math.floor(camY / FLOOR_H) - BELOW, me >= 0 && mineK ? mineK.gone : null);
    for (const p of pieces) p.g.position.y = (Math.floor((camY - p.ph) / CH) - 2 + p.j) * CH + p.ph;
    base.visible = camY < 70;
    // the storm: a lumpy lid of dark cloud that keeps coming, with lightning
    for (let i = 0; i < STORM_N; i++) { const p = stormP[i], b = Math.sin(time * 1.3 + p.ph) * .35; _m.compose(_v.set(p.x + Math.sin(time * .3 + p.ph) * 1.2, sy + p.y + b - p.r * .35, p.z), _q.identity(), _s.set(p.r * 1.25, p.r * .7, p.r)); storm.setMatrixAt(i, _m); }
    storm.instanceMatrix.needsUpdate = true; stormBody.position.set(0, sy - 32.5, -10);
    nextFlash -= dt; if (nextFlash <= 0) { flash = Math.max(flash, .7); nextFlash = 1.2 + Math.random() * 3.5; if (!reduced) fx.burst({ x: (Math.random() - .5) * 18, y: sy + .4, z: 1 }, { n: 5, colors: ['#ffe36b', '#ffffff'], speed: 3, up: 5, shape: STAR, size: .3, life: .5 }); }
    flash *= Math.exp(-dt * 9); stormMat.emissiveIntensity = reduced ? 0 : flash * .8;
    sky.position.set(0, camY, 0); seaG.position.set(0, sy - 3, -6); seaG.rotation.y = time * .01;
    for (let i = 0; i < driftN; i++) {
      const p = driftP[i], span = 150, y = camY + (((p.h * span - camY * p.par) % span) + span) % span - span / 2, x = ((p.x + time * p.v + 110) % 220 + 220) % 220 - 110;
      for (let k = 0; k < 3; k++) { const o = [[0, 0, 1], [1, -.1, .72], [-1, -.14, .68]][k]; _m.compose(_v.set(x + o[0] * p.s, y + o[1] * p.s, p.z), _q.identity(), _s.set(p.s * o[2] * 1.2, p.s * o[2] * .6, p.s * o[2])); drift.setMatrixAt(i * 3 + k, _m); }
    }
    drift.instanceMatrix.needsUpdate = true;
    for (const g of isles) { const [x, y, z] = g.userData.at, per = 148; g.position.set(x, y + Math.round((camY - y) / per) * per + Math.sin(time * .5 + x) * .4, z); }
    birdG.position.y = camY + 4; fly(time);

    fx.update(dt, camera, canvas.clientHeight || innerHeight);
    renderer.render(scene, camera);
    if (onFrame) {
      const Wd = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight, tags = [];
      for (let i = 0; i < climbers.length; i++) {
        const K = climbers[i];
        if ((i === me && mineK) || !K.root.visible) { tags.push({ show: false }); continue; }
        // a climber above or below the screen keeps their tag, pinned to that edge
        tmp.set(K.x, K.y + 2.05, 0).project(camera);
        const off = tmp.y > .7 ? 1 : tmp.y < -.84 ? -1 : 0;
        tags.push({ show: true, off, x: Math.max(70, Math.min(Wd - 70, (tmp.x + 1) / 2 * Wd)), y: off > 0 ? H * .15 + 34 + (i % 3) * 28 : off < 0 ? H * .92 - (i % 3) * 28 : (1 - tmp.y) / 2 * H });
      }
      onFrame({ tags, follow, storm: sy, camY });
    }
  }, { onSlow: () => res.lower() });

  return {
    setTower, setSeats, snap, event, cue, bounce,
    setMe(i) { me = i; },
    watch(i) { watchI = i; },
    mine(k) { mineK = k; },
    streak(n) { myStreak = n; },
    dispose() {
      frames.stop(); ro.disconnect(); fx.dispose();
      for (const c of climbers) disposeAvatar(c.av);
      disposeArrow(arrow); disposeToon(base); for (const g of isles) disposeToon(g);
      for (const s of [...signs, ...banners]) s.dispose();
      for (const g of [sideGeo, sideHull, backGeo, backHull, midGeo, capGeo, shroomG, shadowGeo]) g.dispose();
      renderer.dispose();
    },
  };
}

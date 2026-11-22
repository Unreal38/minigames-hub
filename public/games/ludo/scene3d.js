// Ludo 3D view (three.js): a chunky low-poly board with everyone's avatar sitting in their own yard.
// Purely visual: it replays the rolls and moves the server worked out, and reports which pawn was tapped.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { diceKit } from '../../dice3d.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { toonify, toonMat, shell, skyDome, clouds, island, birds, petals, createFx, shaker, disposeToon, STAR as FSTAR, DOT, HEART, CONF, nightScene } from '../../scenery3d.js';
import { RING_CELLS, GAP, STAR, HOME, MS as MSv, cellOf, yardCentre, yardSlot, lane, turned } from './board.js';

const INK = '#3b2219', SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff', CREAM = '#fff4e2', EMPTY = '#b5a69c';
const Y_YARD = .25, Y_HOME = .04, AV = .6, SEAT_Y = .59;
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, flatShading: true, ...o });
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
// die faces in BoxGeometry material order (+x, -x, +y, -y, +z, -z) and the turn that puts each value on top
const FACES = [3, 4, 1, 6, 2, 5];
const UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] };
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const softDot = () => canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

// Several geometries welded into one (positions and normals only).
function weld(parts) {
  const gs = parts.map(g => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); return n; });
  const n = gs.reduce((t, g) => t + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
// A chunky six-sided pawn standing on y = 0.
function pawnGeo() {
  const base = new THREE.CylinderGeometry(.27, .32, .13, 6); base.translate(0, .065, 0);
  const body = new THREE.CylinderGeometry(.12, .24, .4, 6); body.translate(0, .33, 0);
  const neck = new THREE.CylinderGeometry(.19, .19, .06, 6); neck.translate(0, .55, 0);
  const head = new THREE.IcosahedronGeometry(.2, 0); head.translate(0, .76, 0);
  return weld([base, body, neck, head]);
}
function starGeo() {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .14 : .32; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: .05, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
}

export function createScene(canvas, { onFrame, onCue, onPick }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.5); // steps the resolution down if the device can't hold 60 fps
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 70, 190);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 500);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(7, 18, 9); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
  key.shadow.bias = -.0005; key.shadow.normalBias = .03; scene.add(key);

  // the world: a sunny sky, a sea of clouds and a round floating meadow under the board
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 16, max: 85, below: -11 }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const land = island(16.8, 16.8, { round: true, rim: 4.2, seed: 5, props: 20, size: 1.6, flowers: 60 }); land.position.y = -.8; scene.add(land);
  const flyBirds = birds(scene, 22, 7, 4, 1.2), blow = petals(scene, 28, 4.5, { n: 10, size: .13 });
  const shake = shaker();

  // everything on the board lives in root, which turns so your own yard is nearest you (bottom left)
  const root = new THREE.Group(); scene.add(root);
  const fx = createFx(root), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = ([c, r], y = 0, out = new THREE.Vector3()) => out.set(c - 7, y, r - 7);

  let noStars = false, seats = [], T = 4, boardKey = '', avKey = '', boardGroup = null, tiles = null;
  let pawnMesh = null, lineMesh = null, pawnGeom = null, pawns = [], avatars = [];
  let rl = null, rlStart = 0, mv = null, mvStart = 0, mvPlan = null, cueAt = 0, dieCue = false;
  let turn = -1, stage = 'roll', me = -1, legal = [], hover = -1, spin = 0, spinInit = false;
  const arrow = youArrow(); arrow.visible = false; scene.add(arrow);
  const later = []; // effects booked for a moment later in the current move: [ms, fn]

  function disposeTree(o) { o.traverse(x => { x.geometry?.dispose(); for (const m of [].concat(x.material || [])) { m.map?.dispose(); m.dispose(); } }); }

  // ---------- board ----------
  function buildBoard() {
    if (boardGroup) { root.remove(boardGroup); disposeToon(boardGroup); }
    const g = boardGroup = new THREE.Group(); root.add(g);
    const colOf = [null, null, null, null]; for (const s of seats) colOf[s.corner] = s.col;
    const add = (geo, color, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = !!o.cast; if (o.ry) m.rotation.y = o.ry; g.add(m); return m; };
    add(new THREE.BoxGeometry(16.4, .5, 16.4), '#7a4a2b', 0, -.55, 0, { cast: true });
    add(new THREE.BoxGeometry(15.7, .2, 15.7), '#4a2c22', 0, -.26, 0);
    // track and home lanes: one instanced block per cell
    const cells = [];
    RING_CELLS.forEach((c, i) => {
      const k = i / GAP | 0, col = i % GAP === 0 ? (colOf[k] || EMPTY) : i % GAP === STAR && !noStars ? CREAM : i % 2 ? '#f3e0c6' : '#e8cfae';
      cells.push([c, col]);
    });
    for (let k = 0; k < 4; k++) for (let i = 1; i <= 5; i++) cells.push([lane(k, i), colOf[k] ? mix(colOf[k], '#ffffff', .22) : EMPTY]);
    tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(.9, .26, .9), toonMat(M('#ffffff')), cells.length);
    const m4 = new THREE.Matrix4(), c3 = new THREE.Color();
    cells.forEach(([c, col], i) => { m4.makeTranslation(c[0] - 7, -.13, c[1] - 7); tiles.setMatrixAt(i, m4); tiles.setColorAt(i, c3.set(col)); });
    tiles.receiveShadow = true; g.add(tiles);
    // a star on each safe cell (hard mode has no safe cells, so no stars)
    if (!noStars) for (let k = 0; k < 4; k++) { const [c, r] = RING_CELLS[k * GAP + STAR]; add(starGeo(), '#ffb547', c - 7, 0, r - 7); }
    // yards: a raised pad with four pawn spots and a stool for the avatar. Corners nobody plays grow trees instead.
    for (let k = 0; k < 4; k++) {
      const [yc, yr] = yardCentre(k), x = yc - 7, z = yr - 7, col = colOf[k];
      add(new THREE.BoxGeometry(5.5, .4, 5.5), col || EMPTY, x, -.08, z, { cast: true });
      add(new THREE.BoxGeometry(4.5, .1, 4.5), col ? CREAM : '#cfc2b8', x, .12, z);
      if (col) {
        for (let i = 0; i < 4; i++) { const [c, r] = yardSlot(k, i); add(new THREE.CylinderGeometry(.44, .5, .1, 6), i < T ? col : '#e6d6c4', c - 7, Y_YARD - .05, r - 7); }
        add(new THREE.BoxGeometry(.85, .42, .85), mix(col, INK, .3), x, .38, z, { cast: true });
      } else for (const [dx, dz, s] of [[-.9, -.6, 1], [.9, .2, .8], [-.1, 1.1, .65]]) {
        add(new THREE.BoxGeometry(.22 * s, .5 * s, .22 * s), '#8a5a3c', x + dx, .17 + .25 * s, z + dz, { cast: true });
        add(new THREE.ConeGeometry(.62 * s, .9 * s, 5), '#6fb98f', x + dx, .17 + .9 * s, z + dz, { cast: true });
        add(new THREE.ConeGeometry(.45 * s, .75 * s, 5), '#8fd3a8', x + dx, .17 + 1.4 * s, z + dz, { cast: true, ry: .6 });
      }
    }
    // the middle: a four-sided pyramid, one face per corner
    add(new THREE.BoxGeometry(2.9, .3, 2.9), INK, 0, -.11, 0);
    const pg = new THREE.ConeGeometry(1.1, 1.3, 4, 1, true).toNonIndexed(); pg.rotateY(Math.PI / 4); pg.computeVertexNormals();
    const pp = pg.attributes.position, pc = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i += 3) {
      const cx = (pp.getX(i) + pp.getX(i + 1) + pp.getX(i + 2)) / 3, cz = (pp.getZ(i) + pp.getZ(i + 1) + pp.getZ(i + 2)) / 3;
      const k = Math.abs(cx) > Math.abs(cz) ? (cx < 0 ? 0 : 2) : (cz < 0 ? 1 : 3);
      c3.set(colOf[k] || EMPTY); for (let j = 0; j < 3; j++) pc.set([c3.r, c3.g, c3.b], (i + j) * 3);
    }
    pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    const pyr = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, flatShading: true }));
    pyr.position.y = .04 + .65; pyr.castShadow = true; g.add(pyr);
    bake(g);
    toonify(g, .045); // cartoon shading and one dark outline round the board
    renderer.shadowMap.needsUpdate = true;
  }

  // ---------- pawns and avatars ----------
  const pawnAt = (s, k) => pawns[s * T + k];
  function restSpot(corner, p, k, out) {
    const [c, r] = cellOf(corner, p, k, T);
    return out.set(c - 7, p < 0 ? Y_YARD : p === HOME ? Y_HOME : 0, r - 7);
  }
  function buildPawns() {
    for (const m of [pawnMesh, lineMesh]) if (m) { root.remove(m); m.dispose(); }
    pawnGeom ||= pawnGeo();
    const n = seats.length * T, c3 = new THREE.Color();
    pawnMesh = new THREE.InstancedMesh(pawnGeom, toonMat(M('#ffffff', { roughness: .45 })), n); pawnMesh.castShadow = true; pawnMesh.frustumCulled = false;
    lineMesh = new THREE.InstancedMesh(pawnGeom, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), n); lineMesh.frustumCulled = false;
    pawns = [];
    seats.forEach((s, si) => { for (let k = 0; k < T; k++) { pawnMesh.setColorAt(si * T + k, c3.set(s.col)); pawns.push({ s: si, k, cur: new THREE.Vector3(), tgt: new THREE.Vector3(), sc: 1, init: false, tag: { x: 0, y: 0 } }); } });
    pawnMesh.instanceColor.needsUpdate = true;
    root.add(lineMesh, pawnMesh);
  }
  function buildAvatars() {
    for (const a of avatars) { root.remove(a.g); disposeAvatar(a.av); }
    avatars = seats.map((s, i) => {
      const g = new THREE.Group(), av = avatar3d(s.color, s.av);
      const [c, r] = yardCentre(s.corner); g.position.set(c - 7, SEAT_Y + .76 * AV, r - 7);
      g.add(av); root.add(g);
      return { g, av, hop: 0, tag: { x: 0, y: 0, show: false } };
    });
  }

  function setSeats(list, nPawns, hard = false) {
    seats = list; T = nPawns || 4; noStars = !!hard;
    const bk = list.map(s => s.col + s.corner).join('|') + T + noStars;
    if (bk !== boardKey) { boardKey = bk; buildBoard(); buildPawns(); }
    const ak = list.map(s => s.color + s.corner + s.av.join('')).join('|');
    if (ak !== avKey) { avKey = ak; buildAvatars(); renderer.shadowMap.needsUpdate = true; }
  }

  // ---------- rolls and moves ----------
  const kit = diceKit({ side: FACES, classic: { pip: 'square' } }); // the roller's dice skin (dice3d.js)
  const die = new THREE.Mesh(kit.geo(0, .62), kit.mat(0)); die.castShadow = true; die.visible = false; root.add(die); shell(die, 1.09);
  const dieQ = new THREE.Quaternion(), dieSpin = new THREE.Vector3(), dieRest = new THREE.Vector3(), dieFrom = new THREE.Vector3();
  const dieSpot = (corner, out) => W(turned([3.85, 3.85], corner), .17 + .31, out);
  function setDie(v) {
    const e = UP[v]; dieQ.setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
    dieQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - .5) * .8));
  }
  function setRoll(r) {
    if (!r || !seats[r.s]) return;
    if (rl && rl.n === r.n) return;
    rl = r; rlStart = performance.now() - r.ago; dieCue = r.ago > MSv.die;
    setDie(r.die); dieSpot(seats[r.s].corner, dieRest); die.visible = true; kit.dress(die, seats[r.s].fl?.dc | 0, .62);
    if (r.ago > MSv.die) { die.position.copy(dieRest); die.quaternion.copy(dieQ); return; }
    W(yardCentre(seats[r.s].corner), 3.2, dieFrom);
    dieSpin.set(Math.random() * 14 + 8, Math.random() * 10, Math.random() * 14 + 8);
  }

  function plan(m) {
    const P = [], corner = seats[m.s].corner, at = p => restSpot(corner, p, m.k, new THREE.Vector3());
    if (m.from < 0) P.push({ k: 'out', d: MSv.out, a: at(-1), b: at(0), h: 1 });
    else for (let p = m.from + 1; p <= m.to; p++) P.push({ k: 'hop', d: MSv.step, a: at(p - 1), b: at(p), h: .42 });
    if (m.caps.length) P.push({ k: 'cap', d: MSv.cap, a: at(m.to), caps: m.caps.map(c => ({ ...c, a: restSpot(seats[c.s].corner, c.from, c.k, new THREE.Vector3()), b: restSpot(seats[c.s].corner, -1, c.k, new THREE.Vector3()) })) });
    if (m.to === HOME) P.push({ k: 'home', d: MSv.home, a: at(HOME) });
    let t = 0; for (const p of P) { p.t0 = t; t += p.d; }
    return P;
  }
  function setMove(m) {
    if (!m || !seats[m.s]) { mv = null; return; }
    if (mv && mv.n === m.n) return;
    mv = m; mvPlan = plan(m); mvStart = performance.now() - m.ago; cueAt = m.ago > m.ms ? mvPlan.length : 0; later.length = 0;
  }

  // ---------- effects ----------
  const GOLD = ['#ffd84a', '#fff1a8', '#ffffff'];
  function cueFx(p, t) {
    if (reduced) return;
    const book = (ms, fn) => later.push([t + ms, fn]), col = seats[mv.s]?.col || '#ffffff';
    if (p.k === 'hop') book(p.d, () => fx.puff(p.b, { n: 5, size: .2, speed: 1.4, life: .35 }));
    else if (p.k === 'out') { fx.ring(p.a, { color: col, size: 1.5 }); fx.burst(p.a, { n: 10, colors: [col, '#ffffff'], speed: 2.2, up: 3.5, size: .2, y: .3 });
      book(p.d, () => { fx.puff(p.b, { n: 10, size: .3 }); fx.ring(p.b, { color: '#ffffff', size: 1.5 }); shake.kick(.07); }); }
    else if (p.k === 'cap') { // a capture: a proper thump
      fx.burst(p.a, { n: 26, colors: ['#ff7a59', '#ffd84a', '#ffffff'], speed: 5, up: 4.5, size: .3, life: .9, y: .4 }); fx.puff(p.a, { n: 14, size: .4, speed: 3 });
      fx.ring(p.a, { color: '#ffffff', size: 2.2 }); shake.kick(.32); hitStop = .07;
      for (const c of p.caps) { const vc = seats[c.s]?.col || '#ffffff';
        for (let k = 1; k < 7; k++) book(p.d * k / 7, () => { const v = pawnAt(c.s, c.k); if (v) fx.sparkle(v.cur, { n: 2, colors: [vc, '#ffffff'], r: .2, size: .18, life: .5 }); });
        book(p.d, () => { fx.puff(c.b, { n: 10, size: .3 }); shake.kick(.08); }); }
    } else if (p.k === 'home') {
      fx.burst(p.a, { n: 26, colors: [col, ...GOLD], speed: 4, up: 5.5, size: .3, life: 1.1, y: .4, shape: [FSTAR, HEART] }); fx.ring(p.a, { color: '#ffd84a', size: 2.4 }); shake.kick(.1);
      const seat = seats[mv.s], done = seat && seat.toks.every((v, k) => k >= T || v === HOME || k === mv.k);
      if (done) { fx.confetti(new THREE.Vector3(0, 0, 0), { n: 140, w: 12, h: 6, s: mv.s }); { const ws = mv.s; book(500, () => fx.confetti(new THREE.Vector3(0, 0, 0), { n: 100, w: 14, h: 6, s: ws })); }; shake.kick(.2); }
      else fx.confetti(p.a, { n: 30, w: 2.5, h: 3, s: mv.s });
    }
  }
  let hitStop = 0, diePuff = false;

  // ---------- highlight rings under the pawns you can move ----------
  const ringGeo = new THREE.RingGeometry(.36, .5, 6); ringGeo.rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .95, depthWrite: false }), 5);
  rings.frustumCulled = false; rings.count = 0; rings.renderOrder = 1; root.add(rings);
  // and a bright rim round them: gold while they wait, white under the pointer
  const glow = new THREE.InstancedMesh(pawnGeo(), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.BackSide }), 4);
  glow.frustumCulled = false; glow.count = 0; glow.setColorAt(0, new THREE.Color('#ffd84a')); root.add(glow);

  // ---------- picking: the nearest movable pawn to the pointer ----------
  let W_ = 0, H_ = 0;
  function nearest(e) {
    if (!legal.length || me < 0) return -1;
    const b = canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    let best = -1, bd = 52;
    for (const m of legal) { const p = pawnAt(me, m.k); if (!p) continue; const d = Math.hypot(p.tag.x - x, p.tag.y - y); if (d < bd) { bd = d; best = m.k; } }
    return best;
  }
  const onMove = e => { const k = e.pointerType === 'touch' ? -1 : nearest(e); canvas.style.cursor = k >= 0 ? 'pointer' : ''; hoverPtr = k; };
  const onDown = e => { const k = nearest(e); if (k >= 0) onPick?.(k); };
  let hoverPtr = -1;
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown);

  // ---------- frame loop ----------
  const proj = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3(), want = new THREE.Vector3(), camAt = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), c3 = new THREE.Color();
  let camInit = false, shadowIn = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W_ && h === H_) return;
    W_ = w; H_ = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  const toScreen = (local, tag) => {
    proj.copy(local); root.localToWorld(proj); proj.project(camera);
    tag.show = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
    tag.x = (proj.x + 1) / 2 * W_; tag.y = (1 - proj.y) / 2 * H_;
  };

  // How far back the camera has to sit for the whole board to show between the top bar and the roll button.
  let fitKey = '', fitDist = 30, fitShift = 0;
  function fit(el, tall) {
    const top = 1 - 2 * (tall ? 172 : 64) / Math.max(1, H_), bot = -1 + 2 * (tall ? 96 : 84) / Math.max(1, H_), side = tall ? .98 : .94;
    const cam = camera.clone(), E = 8.25;
    const span = d => {
      cam.position.set(0, Math.sin(el) * d, Math.cos(el) * d); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      let x = 0, lo = 9, hi = -9;
      for (const sx of [-E, E]) for (const sz of [-E, E]) for (const y of [-.3, 1.5]) { proj.set(sx, y, sz).project(cam); x = Math.max(x, Math.abs(proj.x)); lo = Math.min(lo, proj.y); hi = Math.max(hi, proj.y); }
      return { x, lo, hi };
    };
    let a = 8, b = 90;
    for (let i = 0; i < 22; i++) { const d = (a + b) / 2, s = span(d); if (s.x > side || s.hi - s.lo > top - bot) a = d; else b = d; }
    // slide the view along the table so the board sits in the middle of the free space
    const s = span(b), mid = (s.hi + s.lo) / 2, wantMid = (top + bot) / 2;
    fitShift = -(mid - wantMid) * b * Math.tan(camera.fov * Math.PI / 360) / Math.sin(el);
    return b;
  }
  function loop(dt) {
    resize();
    const now = performance.now(), Ts = now / 1000;
    if (!seats.length) { renderer.render(scene, camera); return; }
    // turn the board so your yard is bottom left
    const wantSpin = me >= 0 && seats[me] ? -(3 - seats[me].corner) * Math.PI / 2 : 0;
    if (!spinInit) { spin = wantSpin; spinInit = true; }
    if (Math.abs(spin - wantSpin) > .001) { spin += (wantSpin - spin) * Math.min(1, dt * 4); renderer.shadowMap.needsUpdate = true; } else spin = wantSpin;
    root.rotation.y = spin; root.updateMatrixWorld();

    if (hitStop > 0) { hitStop -= dt; mvStart += dt * 940; } // a capture freezes the move for a blink
    const tr = rl ? now - rlStart : 1e9, tm = mv ? now - mvStart : 1e9, moving = mv && tm < mv.ms, rolling = rl && tr < MSv.die;
    if (rl && !dieCue) { dieCue = true; diePuff = true; onCue?.({ k: 'die', s: rl.s, die: rl.die }); }
    if (diePuff && tr > MSv.die * .5) { diePuff = false; if (!reduced && tr < MSv.die) { fx.puff(tmp.copy(dieRest).setY(dieRest.y - .3), { n: 8, size: .28 }); shake.kick(.05); } }
    // cues for sound and pop-ups
    if (mv && mvPlan) while (cueAt < mvPlan.length && tm >= mvPlan[cueAt].t0) {
      const p = mvPlan[cueAt++];
      onCue?.({ k: p.k, s: mv.s, die: mv.die, caps: p.caps?.map(c => c.s) });
      if ((p.k === 'cap' || p.k === 'home') && avatars[mv.s]) avatars[mv.s].hop = 1;
      cueFx(p, p.t0);
    }
    if (later.length) { if (!mv) later.length = 0; else for (let i = later.length - 1; i >= 0; i--) if (tm >= later[i][0]) { const f = later[i][1]; later.splice(i, 1); f(); } }
    // where every pawn rests; pawns sharing a cell huddle up
    const share = new Map();
    for (const pw of pawns) {
      const seat = seats[pw.s], p = seat.toks[pw.k];
      restSpot(seat.corner, p, pw.k, pw.tgt); pw.sc = p === HOME ? .8 : 1; pw.lift = 0; pw.fly = false;
      if (p >= 0 && p < HOME) { const key = pw.tgt.x + ',' + pw.tgt.z; if (!share.has(key)) share.set(key, []); share.get(key).push(pw); }
    }
    for (const g of share.values()) if (g.length > 1) g.forEach((pw, i) => {
      const a = i / g.length * Math.PI * 2 + .6, r = g.length > 2 ? .25 : .2;
      pw.tgt.x += Math.cos(a) * r; pw.tgt.z += Math.sin(a) * r; pw.sc = g.length > 2 ? .68 : .78;
    });
    // the move being played out
    if (moving) {
      let cur = mvPlan[0]; for (const p of mvPlan) if (tm >= p.t0) cur = p;
      const u = Math.min(1, (tm - cur.t0) / cur.d), pw = pawnAt(mv.s, mv.k);
      if (pw) {
        pw.fly = true; pw.sc = 1;
        if (cur.k === 'hop' || cur.k === 'out') { pw.cur.copy(cur.a).lerp(cur.b, cur.k === 'out' ? ease(u) : u); pw.cur.y += Math.sin(Math.PI * u) * cur.h; }
        else { pw.cur.copy(cur.a); pw.cur.y += Math.abs(Math.sin(u * Math.PI * (cur.k === 'home' ? 3 : 2))) * (cur.k === 'home' ? .55 : .3) * (1 - u * .5); }
      }
      const cp = mvPlan.find(p => p.k === 'cap');
      if (cp) for (const c of cp.caps) { // captured pawns wait where they were, then get flung back to their yard
        const v = pawnAt(c.s, c.k); if (!v) continue;
        v.fly = true; v.sc = 1;
        if (tm < cp.t0) v.cur.copy(c.a);
        else { const w = Math.min(1, (tm - cp.t0) / cp.d); v.cur.copy(c.a).lerp(c.b, ease(w)); v.cur.y += Math.sin(Math.PI * w) * 2.4; }
      }
    }
    // pawns you can move bob up and down on a ring
    const mine = stage === 'pick' && turn === me && !moving ? legal : [];
    const hv = hover >= 0 ? hover : hoverPtr;
    let nr = 0, ng = 0;
    for (const m of mine) {
      const pw = pawnAt(me, m.k); if (!pw) continue;
      pw.lift = reduced ? .1 : Math.abs(Math.sin(Ts * 4.5 + m.k)) * .22;
      const big = m.k === hv ? 1.25 : 1; if (m.k === hv) pw.sc *= 1.15;
      const pulse = 1 + Math.sin(Ts * 6) * .06;
      sv.set(pulse * big, 1, pulse * big); tmp.copy(pw.cur); tmp.y = pw.tgt.y + .03;
      rings.setMatrixAt(nr, m4.compose(tmp, q0, sv)); rings.setColorAt(nr, c3.set('#ffb547')); nr++;
      if (ng < 4) { tmp.copy(pw.cur); tmp.y += pw.lift - .035 * pw.sc; const k = pw.sc * (m.k === hv ? 1.34 : 1.26); sv.set(k, pw.sc * (m.k === hv ? 1.14 : 1.1), k); glow.setMatrixAt(ng, m4.compose(tmp, q0, sv)); glow.setColorAt(ng, c3.set(m.k === hv ? '#ffffff' : '#ffd84a')); ng++; }
      if (m.k === hv) { // and where it would land
        restSpot(seats[me].corner, m.to, m.k, tmp); tmp.y += .03; sv.set(.9, 1, .9);
        rings.setMatrixAt(nr, m4.compose(tmp, q0, sv)); rings.setColorAt(nr, c3.set('#ffffff')); nr++;
      }
    }
    rings.count = Math.min(5, nr); glow.count = ng; if (ng) { glow.instanceMatrix.needsUpdate = true; glow.instanceColor.needsUpdate = true; }
    if (nr) { rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true; }
    pawns.forEach((pw, i) => {
      if (!pw.fly) { if (!pw.init) pw.cur.copy(pw.tgt); pw.cur.lerp(pw.tgt, Math.min(1, dt * 12)); }
      pw.init = true;
      tmp.copy(pw.cur); tmp.y += pw.lift;
      pw.scNow = pw.scNow === undefined ? pw.sc : pw.scNow + (pw.sc - pw.scNow) * Math.min(1, dt * 12);
      sv.setScalar(pw.scNow); pawnMesh.setMatrixAt(i, m4.compose(tmp, q0, sv));
      tmp.y -= .02 * pw.scNow; sv.set(pw.scNow * 1.16, pw.scNow * 1.06, pw.scNow * 1.16); lineMesh.setMatrixAt(i, m4.compose(tmp, q0, sv));
    });
    pawnMesh.instanceMatrix.needsUpdate = true; lineMesh.instanceMatrix.needsUpdate = true;
    // avatars: face the camera, turned a little towards the middle of the board
    avatars.forEach((a, i) => {
      const active = i === turn && (stage === 'roll' || stage === 'pick');
      tmp.copy(a.g.position); root.localToWorld(tmp);
      a.g.rotation.y = Math.atan2(-tmp.x * .09, 1) - spin;
      a.hop = Math.max(0, a.hop - dt * 1.3);
      a.g.position.y = SEAT_Y + .76 * AV + (active && !reduced ? Math.abs(Math.sin(Ts * 4)) * .08 : 0);
      animateAvatar(a.av, Ts, { seed: i, active, hop: a.hop });
      a.av.scale.multiplyScalar(AV);
      tmp.copy(a.g.position); tmp.y += 1.55; toScreen(tmp, a.tag);
    });
    const mineAv = avatars[me];
    arrow.visible = !!mineAv;
    if (mineAv) { tmp.copy(mineAv.g.position); tmp.y += 1.45; root.localToWorld(tmp); arrow.position.copy(tmp); animateArrow(arrow, Ts); arrow.scale.setScalar(.8); }
    // the die tumbles down into the roller's yard and stays there
    if (rolling) {
      const u = tr / MSv.die;
      die.position.copy(dieFrom).lerp(dieRest, ease(Math.min(1, u * 1.3)));
      die.position.y = dieRest.y + Math.abs(Math.sin(u * Math.PI * 2.2)) * (1 - u) * 1.6 + (1 - Math.min(1, u * 1.3)) * 2;
      if (u < .7) die.rotation.set(dieSpin.x * u, dieSpin.y * u, dieSpin.z * u);
      else die.quaternion.slerp(dieQ, Math.min(1, (u - .7) / .3 * .6 + .1));
    } else if (rl) { die.position.lerp(dieRest, Math.min(1, dt * 8)); die.quaternion.slerp(dieQ, Math.min(1, dt * 10)); }
    // camera: the whole board, leaning a touch towards whoever is playing
    const tall = camera.aspect < .8, el = tall ? 1.2 : 1.02;
    look.set(0, 0, 0);
    const fa = avatars[moving ? mv.s : turn];
    if (fa && !tall) { tmp2.copy(fa.g.position); root.localToWorld(tmp2); look.lerp(tmp2, .05); look.y = 0; }
    if (fitKey !== W_ + 'x' + H_) { fitKey = W_ + 'x' + H_; fitDist = fit(el, tall); }
    want.set(look.x, Math.sin(el) * fitDist, look.z + Math.cos(el) * fitDist + fitShift);
    look.z += fitShift;
    if (!camInit) { camAt.copy(want); lookNow.copy(look); camInit = true; }
    camAt.lerp(want, Math.min(1, dt * 2)); lookNow.lerp(look, Math.min(1, dt * 2)); camera.position.copy(camAt);
    if (!reduced) { camera.position.x += Math.sin(Ts * .22) * .4; camera.position.y += Math.sin(Ts * .31) * .14; } // a slow, gentle drift
    camera.lookAt(lookNow); shake.apply(camera, dt);
    cloudRing.rotation.y = Ts * .006; flyBirds(Ts); blow(Ts);
    fx.update(dt, camera, H_);
    shadowIn -= dt; // shadows refresh a few times a second, more often while something is moving
    if (shadowIn <= 0) { renderer.shadowMap.needsUpdate = true; shadowIn = moving || rolling || mine.length ? .05 : .3; }
    renderer.render(scene, camera);
    for (const pw of pawns) { tmp.copy(pw.cur); tmp.y += .45; toScreen(tmp, pw.tag); }
    onFrame?.({ tags: avatars.map(a => a.tag), busy: !!(moving || rolling) });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setSeats, setRoll, setMove,
    setTurn(i, s) { turn = i; stage = s; },
    setMe(i) { me = i; },
    setLegal(l) { legal = l || []; if (!legal.length) { hoverPtr = -1; canvas.style.cursor = ''; } },
    setHover(k) { hover = k; },
    dispose() {
      ticker.stop();
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
      if (boardGroup) disposeToon(boardGroup); disposeToon(land); fx.dispose(); glow.geometry.dispose(); glow.material.dispose(); glow.dispose();
      for (const a of avatars) disposeAvatar(a.av);
      for (const m of [pawnMesh, lineMesh]) if (m) m.dispose();
      pawnGeom?.dispose(); ringGeo.dispose(); rings.material.dispose(); rings.dispose();
      disposeArrow(arrow); for (const c of die.children) c.material.dispose(); kit.dispose(); renderer.dispose();
    },
  };
}

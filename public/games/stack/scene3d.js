// Tower Stack 3D view (three.js): a sky island with a stone pedestal, the shared tower on it, and everyone's
// avatar sitting on a little floating rock that rises as the tower grows. Purely visual: the server decides
// where every block lands (rules.js); this draws the same swing and replays drops, slips and crashes.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { M, finish, toonMat } from '../farm/models.js';
import { swingPos, height, MS } from './rules.js';
import { nightScene } from '../../scenery3d.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff', INK = '#5a3a2e';
const GROUND = -.55, GAP = 2.3, GRAV = 21, AV = .8, ARC = 6.3, CAM_AZ = Math.PI / 4, CAM_EL = .5;
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const lighter = (c, k) => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k).getHexString();

// One geometry from several, each painted a flat colour (kept as vertex colours).
function merge(parts) {
  const gs = parts.map(([g, c]) => [g.index ? g.toNonIndexed() : g, new THREE.Color(c)]);
  const n = gs.reduce((t, [g]) => t + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const [g, c] of gs) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o);
    for (let i = 0; i < g.attributes.position.count; i++) col.set([c.r, c.g, c.b], o + i * 3);
    o += g.attributes.position.count * 3; g.dispose();
  }
  for (const [g] of parts) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

export function createScene(canvas, { onFrame, onCue }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 170);
  const camera = new THREE.PerspectiveCamera(36, 1, .5, 500);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 13, bottom: -11, near: 1, far: 70 });
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toon = c => toonMat(M(c));
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const blockMat = toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .9, flatShading: true }));
  let shadowFor = 8; // frames the shadow map still has to be redrawn for

  { // sky: deep blue overhead, pale at the horizon and below
    const g = new THREE.SphereGeometry(300, 16, 10), p = g.attributes.position, col = [], top = new THREE.Color(SKY_TOP), low = new THREE.Color(SKY_LOW), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { c.copy(low).lerp(top, Math.min(1, Math.max(0, p.getY(i) / 300 * 1.6 + .25))); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.userData.sky = true; scene.add(sky);
  }
  // clouds: a sea below the island and stray ones at every height the tower can reach, all one instanced mesh
  const clouds = new THREE.Group();
  {
    const puffs = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const cloud = (x, y, z, s) => { for (const [dx, dy, dz, r] of [[0, 0, 0, 1], [.9, -.1, .2, .75], [-.9, -.12, -.1, .7], [.2, .3, -.3, .65]]) puffs.push([x + dx * s, y + dy * s, z + dz * s, r * s]); };
    for (let i = 0; i < 44; i++) { const a = hash(i, 1) * 6.283, d = 9 + hash(i, 2) * 90; cloud(Math.cos(a) * d, -9 - hash(i, 3) * 9 - d * .04, Math.sin(a) * d, 2.5 + hash(i, 4) * 3.5); }
    for (let i = 0; i < 26; i++) { const a = hash(i, 5) * 6.283, d = 26 + hash(i, 6) * 70; cloud(Math.cos(a) * d, 2 + hash(i, 7) * 40, Math.sin(a) * d, 2.2 + hash(i, 8) * 3.6); }
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon('#ffffff'), puffs.length);
    puffs.forEach(([x, y, z, r], i) => im.setMatrixAt(i, m.compose(v.set(x, y, z), q, sc.set(r * 1.2, r * .6, r))));
    im.frustumCulled = false; im.userData.cloud = true; clouds.add(im); scene.add(clouds);
  }
  nightScene(scene); // the website's night mode carries into the game

  // ---------- the island ----------
  const put = (p, geo, c, x = 0, y = 0, z = 0, ry = 0) => { const o = new THREE.Mesh(geo, M(c)); o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o; };
  {
    const g = new THREE.Group();
    put(g, new THREE.CylinderGeometry(7.6, 7.2, .7, 11), '#8fd16a', 0, GROUND - .35, 0);
    put(g, new THREE.CylinderGeometry(6.2, 6.4, .06, 11), '#9bdb74', 0, GROUND + .02, 0, .3);
    const dirt = new THREE.ConeGeometry(7.2, 7.5, 11, 3), dp = dirt.attributes.position; // the rock underneath, roughened
    for (let i = 0; i < dp.count; i++) { const k = Math.round(dp.getX(i) * 9) + Math.round(dp.getY(i) * 7) * 3 + Math.round(dp.getZ(i) * 5) * 7; if (dp.getY(i) < 3.6) dp.setXYZ(i, dp.getX(i) + (hash(k, 1) - .5) * .9, dp.getY(i) + (hash(k, 2) - .5) * .5, dp.getZ(i) + (hash(k, 3) - .5) * .9); }
    dirt.computeVertexNormals(); const d = put(g, dirt, '#b98a5e', 0, GROUND - .7 - 3.75, 0); d.rotation.x = Math.PI;
    put(g, new THREE.CylinderGeometry(7.25, 6.6, .5, 11), '#a37449', 0, GROUND - .95, 0);
    // the pedestal: stone steps up to a slab whose top is y = 0
    put(g, new THREE.BoxGeometry(4.6, .2, 4.6), '#8a8794', 0, GROUND + .1, 0);
    put(g, new THREE.BoxGeometry(4.0, .2, 4.0), '#a9a6b0', 0, GROUND + .3, 0);
    put(g, new THREE.BoxGeometry(3.4, .16, 3.4), '#c3c0ca', 0, -.08, 0);
    for (const [x, z] of [[-1.85, -1.85], [1.85, -1.85], [-1.85, 1.85], [1.85, 1.85]]) { put(g, new THREE.BoxGeometry(.5, .5, .5), '#8a8794', x, GROUND + .45, z); put(g, new THREE.BoxGeometry(.3, .14, .3), '#ffe27a', x, GROUND + .77, z); }
    // trees, bushes, rocks and flowers round the edge
    const tree = (x, z, s) => { put(g, new THREE.BoxGeometry(.26 * s, .7 * s, .26 * s), '#8a5a3c', x, GROUND + .35 * s, z); for (let i = 0; i < 3; i++) put(g, new THREE.ConeGeometry((.85 - i * .2) * s, .9 * s, 6), i % 2 ? '#5fb04a' : '#4a9a45', x, GROUND + (.95 + i * .55) * s, z, i * .5); };
    const bush = (x, z, s) => { for (const [dx, dz, r] of [[0, 0, .42], [.36, .1, .3], [-.3, .16, .28]]) put(g, new THREE.IcosahedronGeometry(r * s, 0), '#5fb04a', x + dx * s, GROUND + r * s * .7, z + dz * s, x); };
    const rock = (x, z, s) => put(g, new THREE.IcosahedronGeometry(.34 * s, 0), '#a9a6b0', x, GROUND + .14 * s, z, x * 3).scale.set(1.2, .7, 1);
    tree(-5.6, -3.2, 1.25); tree(-6.3, -1.2, .9); tree(-2.4, -6.1, 1.05); tree(4.1, 5.2, .85); tree(6.1, 1.6, 1.1);
    bush(-4.3, -4.9, 1); bush(5.6, -2.4, .9); bush(-5.8, 2.8, .8); bush(1.8, 6.4, .85); bush(2.6, -6.2, .7);
    rock(-3.4, 3.8, 1.2); rock(3.3, 3.2, .8); rock(5.2, -4.4, 1.3); rock(-6.6, .6, .7); rock(.6, -5.4, .9);
    for (let i = 0; i < 46; i++) {
      const a = hash(i, 11) * 6.283, r = 3.6 + hash(i, 12) * 3.4, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (i % 3) { const t = put(g, new THREE.ConeGeometry(.07, .3, 3), i % 2 ? '#6fbf52' : '#7ccc5c', x, GROUND + .15, z, a); t.rotation.z = (hash(i, 13) - .5) * .5; }
      else { put(g, new THREE.CylinderGeometry(.11, .11, .05, 5), ['#ffffff', '#ffd66b', '#ff9fb8'][i % 9 / 3 | 0], x, GROUND + .1, z); put(g, new THREE.CylinderGeometry(.05, .05, .07, 5), '#ffb547', x, GROUND + .12, z); }
    }
    // spare blocks waiting by the pedestal, and a wooden sign
    for (const [x, y, z, c, r] of [[3.9, 0, -3.6, '#ff8fab', .3], [4.9, 0, -2.9, '#9aa8ff', -.4], [4.3, .5, -3.3, '#ffb547', .8]]) put(g, new THREE.BoxGeometry(.9, .5, .9), c, x, GROUND + .25 + y, z, r);
    put(g, new THREE.BoxGeometry(.12, 1.1, .12), '#8a5a3c', -3.6, GROUND + .55, 4.6); put(g, new THREE.BoxGeometry(1.2, .6, .1), '#c99763', -3.6, GROUND + 1.0, 4.66, .25);
    scene.add(finish(g));
  }

  // ---------- tower ----------
  const towerG = new THREE.Group(); scene.add(towerG);
  const inkGeos = new Map(), plateGeo = (w, d) => new THREE.BoxGeometry(Math.max(.3, w - .4), .05, Math.max(.3, d - .4));
  function blockMesh(b, color) {
    const body = new THREE.BoxGeometry(b.w, b.h, b.d), plate = plateGeo(b.w, b.d); plate.translate(0, b.h / 2 + .02, 0);
    const band = new THREE.BoxGeometry(b.w + .02, b.h * .22, b.d + .02); band.translate(0, -b.h * .2, 0);
    const mesh = new THREE.Mesh(merge([[body, color], [plate, lighter(color, .38)], [band, lighter(color, .2)]]), blockMat);
    mesh.castShadow = mesh.receiveShadow = true;
    const key = [b.w, b.h, b.d].join();
    if (!inkGeos.has(key)) inkGeos.set(key, new THREE.BoxGeometry(b.w + .08, b.h + .08, b.d + .08));
    const ink = new THREE.Mesh(inkGeos.get(key), inkMat); mesh.add(ink);
    mesh.position.set(b.x, b.y, b.z);
    return mesh;
  }
  const freeBlock = m => { m.parent?.remove(m); m.geometry.dispose(); };

  let seats = [], me = -1, avKey = '', avatars = [];
  let blocks = [];        // meshes of the standing tower, bottom first: { m, b, pop }
  const debris = [];      // blocks that are falling or lying about: { m, v, w, r, t, rest }
  const fx = [];          // puffs and sparkles: { m, v, t, life, grow }
  let tower = [], topY = 0, steady = 1, jolt = 0;
  let sw = null, swStart = 0, swMesh = null, frozen = -1, frozenAt = 0;
  let dr = null, drStart = 0, drMesh = null, drLanded = false, drFrom = 0, lastDrop = 0, turn = -1, playing = false;
  let camY = 1, isleY = .45, shake = 0;

  // the balloon that carries the swinging block, and the mark showing where it would land
  const balloon = new THREE.Group(); balloon.visible = false; towerG.add(balloon);
  const balMat = new THREE.MeshToonMaterial({ color: '#ff7a59', gradientMap: blockMat.gradientMap });
  {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.62, 1), balMat); b.scale.set(1, 1.15, 1); b.position.y = 1.4;
    const o = new THREE.Mesh(b.geometry, inkMat); o.scale.setScalar(1.08); b.add(o);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(.13, .2, 5), balMat); knot.position.y = .68;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .64, 4), new THREE.MeshBasicMaterial({ color: INK })); rope.position.y = .32;
    balloon.add(b, knot, rope);
  }
  const guide = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#3b2219', transparent: true, opacity: .22, depthWrite: false }));
  guide.rotation.x = -Math.PI / 2; guide.visible = false; guide.renderOrder = 1; towerG.add(guide);
  const loose = []; // balloons that were let go and are floating off
  const arrow = youArrow(); arrow.visible = false; scene.add(arrow);

  const colorOf = s => seats[s]?.color || '#ffb547';
  function sizeTower() { topY = height(tower); }

  function setSeats(list, mine) {
    seats = list; me = mine;
    const key = list.map(s => s.color + (s.av || []).join('')).join('|');
    if (key === avKey) return; avKey = key;
    for (const a of avatars) { scene.remove(a.g); disposeAvatar(a.av); a.isle.traverse(o => o.geometry?.dispose()); }
    const n = list.length, step = n > 1 ? Math.min(.6, 2.6 / (n - 1)) : 0;
    avatars = list.map((s, i) => {
      const th = CAM_AZ + Math.PI + (i - (n - 1) / 2) * step, g = new THREE.Group();
      g.position.set(Math.sin(th) * ARC, 0, Math.cos(th) * ARC); g.rotation.y = Math.atan2(-g.position.x, -g.position.z) + (i - (n - 1) / 2) * -.12;
      const isle = new THREE.Group();
      put(isle, new THREE.CylinderGeometry(.95, .8, .22, 7), '#8fd16a', 0, -.11, 0);
      const rk = put(isle, new THREE.ConeGeometry(.82, 1.0, 7), '#b98a5e', 0, -.72, 0); rk.rotation.x = Math.PI;
      put(isle, new THREE.IcosahedronGeometry(.16, 0), '#a9a6b0', .6, .06, -.3); put(isle, new THREE.ConeGeometry(.07, .26, 3), '#6fbf52', -.62, .12, .2);
      put(isle, new THREE.BoxGeometry(.7, .3, .6), s.color, 0, .15, -.05); // a block to sit on, in their colour
      g.add(finish(isle));
      const av = avatar3d(s.color, s.av); av.scale.setScalar(AV); av.position.set(0, .3 + .76 * AV, .05); g.add(av);
      scene.add(g);
      return { g, av, isle, hop: 0, seed: i * 2.3, tag: { x: 0, y: 0, show: false } };
    });
    shadowFor = 8;
  }

  // ---------- state from the server ----------
  function setState(S) {
    playing = S.ph === 'play'; turn = S.turn; steady = S.steady ?? 1;
    const d = S.drop, now = performance.now();
    const fresh = d && d.n !== lastDrop;
    // blocks no longer in the tower: debris keeps falling by itself, anything still standing pops away
    while (blocks.length > S.tower.length) { const k = blocks.pop(); if (!k.gone) { k.pop = 1; fx.push({ m: k.m, pop: true, t: 0, life: .35 }); } }
    tower = S.tower; sizeTower();
    if (fresh) {
      lastDrop = d.n; frozen = -1;
      const live = d.ago < MS.drop + 250;
      // the block that was swinging is the one that falls
      const b = { x: d.x, y: d.y, z: d.z, w: d.w, h: d.h, d: d.d };
      let m = swMesh; swMesh = null;
      if (!m) { m = blockMesh(b, colorOf(d.s)); towerG.add(m); }
      m.castShadow = true;
      const stays = d.res === 'ok' || d.res === 'perfect' || d.res === 'crash';
      if (live && !reduced) {
        drFrom = d.y + GAP; m.position.set(d.x, drFrom, d.z); m.rotation.set(0, 0, 0);
        dr = d; drStart = now - d.ago; drMesh = m; drLanded = false;
        letGo(d.x, drFrom + d.h / 2, d.z);
        if (stays) blocks[d.i] = { m, b: S.tower[d.i], falling: true };
      } else {
        dr = null; drMesh = null;
        if (stays && d.res !== 'crash') { m.position.set(d.x, d.y, d.z); m.rotation.set(0, 0, 0); blocks[d.i] = { m, b: S.tower[d.i] }; }
        else { freeBlock(m); if (d.res === 'crash') blocks.length = Math.min(blocks.length, d.at); }
      }
      balloon.visible = false; guide.visible = false; shadowFor = 90;
    }
    // a crash that already played out (joined late, or motion is reduced): only the stump is left standing
    const crashed = d?.res === 'crash' && S.stage === 'drop' && (drLanded || !(dr && dr.n === d.n)) ? d.at : Infinity;
    for (let i = 0; i < S.tower.length && i < crashed; i++) {
      if (blocks[i]) continue;
      const b = S.tower[i], m = blockMesh(b, colorOf(b.s)); towerG.add(m); blocks[i] = { m, b }; shadowFor = 8;
    }
    // the swing
    if (S.swing && S.ph === 'play') {
      if (!sw || sw.n !== S.swing.n) {
        sw = S.swing; swStart = now - sw.ago; frozen = -1;
        if (swMesh) freeBlock(swMesh);
        swMesh = blockMesh({ x: 0, y: 0, z: 0, w: sw.w, h: sw.h, d: sw.d }, colorOf(S.turn)); swMesh.castShadow = false; towerG.add(swMesh);
        balMat.color.set(colorOf(S.turn)); balloon.visible = true; balloon.scale.setScalar(1);
        guide.visible = true; guide.scale.set(sw.w, sw.d, 1);
      }
    } else { sw = null; if (swMesh && !fresh) { freeBlock(swMesh); swMesh = null; } balloon.visible = false; guide.visible = false; }
  }
  // the balloon lets go and drifts off
  function letGo(x, y, z) {
    if (reduced) return;
    const g = balloon.clone(true); g.traverse(o => { if (o.isMesh && o.material === balMat) o.material = balMat.clone(); });
    g.visible = true; g.position.set(x, y, z); towerG.add(g); loose.push({ g, t: 0, vx: (Math.random() - .5) * 1.4 });
  }
  const swingMs = () => frozen >= 0 ? frozen : performance.now() - swStart;
  function hold() { if (!sw || frozen >= 0) return -1; frozen = performance.now() - swStart; frozenAt = performance.now(); return frozen; }

  // ---------- effects ----------
  const puffGeo = new THREE.IcosahedronGeometry(.2, 0), starGeo = new THREE.OctahedronGeometry(.14, 0);
  const puffMat = toon('#ffffff'), starMat = new THREE.MeshBasicMaterial({ color: '#ffe27a' });
  function puffs(x, y, z, w, d, n = 8) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + Math.random(), m = new THREE.Mesh(puffGeo, puffMat);
      m.position.set(x + Math.cos(a) * w * .5, y, z + Math.sin(a) * d * .5); towerG.add(m);
      fx.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.6, .5 + Math.random() * .6, Math.sin(a) * 1.6), t: 0, life: .5 + Math.random() * .2 });
    }
  }
  function stars(x, y, z, n = 14) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283, m = new THREE.Mesh(starGeo, starMat);
      m.position.set(x, y, z); towerG.add(m);
      fx.push({ m, v: new THREE.Vector3(Math.cos(a) * 3.2, 2.2 + Math.random() * 2, Math.sin(a) * 3.2), t: 0, life: .7, grav: 7, spin: 6 });
    }
  }
  // turn a standing block into a tumbling one
  const _wp = new THREE.Vector3(), _up = new THREE.Vector3(), _q = new THREE.Quaternion();
  function tumble(k, vx, vy, vz, spin) {
    k.gone = true;
    const m = k.m; scene.attach(m);
    debris.push({ m, v: new THREE.Vector3(vx, vy, vz), w: spin, r: Math.min(k.b.w, k.b.h, k.b.d) / 2 + .1, dim: [k.b.w, k.b.h, k.b.d], t: 0, hits: 0 });
  }
  function land(d) {
    drLanded = true; jolt = 1;
    const k = blocks[d.i]?.falling ? blocks[d.i] : null;
    if (k) k.falling = false;
    onCue?.({ k: 'land', res: d.res, s: d.s, pts: d.pts, level: d.level, top: d.top });
    const top = d.y + d.h / 2;
    if (d.res === 'ok' || d.res === 'perfect') {
      puffs(d.x, d.y - d.h / 2, d.z, d.w, d.d, 7);
      if (d.res === 'perfect') stars(d.x, top, d.z);
      if (avatars[d.s]) avatars[d.s].hop = d.res === 'perfect' ? 1 : .5;
      if (d.top) for (const a of avatars) a.hop = 1;
    } else if (d.res === 'slip') {
      const [dx, dz] = d.dir;
      tumble({ m: drMesh, b: d }, dx * 2.3, 1.6, dz * 2.3, new THREE.Vector3(dz * 3.2, 0, -dx * 3.2));
      drMesh = null;
    } else if (d.res === 'crash') {
      shake = 1;
      const [dx, dz] = d.dir;
      for (let i = d.at; i < blocks.length; i++) {
        const k2 = blocks[i], up = i - d.at, sp = 1.3 + up * .42;
        tumble(k2, dx * sp + (Math.random() - .5) * .8, .6 + Math.random() * 1.2, dz * sp + (Math.random() - .5) * .8,
          new THREE.Vector3(dz * (1.6 + up * .25) + (Math.random() - .5), (Math.random() - .5) * 2, -dx * (1.6 + up * .25) + (Math.random() - .5)));
      }
      blocks.length = d.at;
      for (let i = 0; i < avatars.length; i++) if (i !== d.s) avatars[i].hop = .6;
    }
  }

  // ---------- frame loop ----------
  let W_ = 0, H_ = 0, T = 0;
  const proj = new THREE.Vector3(), look = new THREE.Vector3(), info = { tags: [], busy: false };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W_ && h === H_) return;
    W_ = w; H_ = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  function frame(dt, nowMs) {
    resize(); T += dt;
    const now = performance.now();
    // the swing
    if (sw && swMesh) {
      if (frozen >= 0 && now - frozenAt > 1800) frozen = -1; // the drop never arrived: carry on swinging
      const ms = swingMs(), p = swingPos(sw, ms), ahead = swingPos(sw, ms + 30);
      const x = sw.axis === 'x' ? p : sw.o, z = sw.axis === 'x' ? sw.o : p, y = topY + GAP + sw.h / 2;
      swMesh.position.set(x, y + Math.sin(T * 3) * .04, z);
      const lean = frozen >= 0 ? 0 : (ahead - p) * .8;
      swMesh.rotation.set(sw.axis === 'z' ? lean : 0, 0, sw.axis === 'x' ? -lean : 0);
      balloon.position.set(x, y + sw.h / 2, z); balloon.rotation.copy(swMesh.rotation);
      guide.position.set(x, topY + .012, z);
    }
    // the drop
    if (dr && drMesh && !drLanded) {
      const t = (now - drStart) / MS.drop;
      if (dr.res === 'miss') { tumble({ m: drMesh, b: dr }, 0, 0, 0, new THREE.Vector3(dr.dir[1] * 1.5, 0, -dr.dir[0] * 1.5)); onCue?.({ k: 'land', res: 'miss', s: dr.s, pts: dr.pts }); drLanded = true; drMesh = null; }
      else if (t >= 1) { drMesh.position.y = dr.y; land(dr); }
      else drMesh.position.y = drFrom + (dr.y - drFrom) * t * t;
    } else if (dr && drLanded && drMesh && (dr.res === 'ok' || dr.res === 'perfect')) {
      const t = (now - drStart - MS.drop) / 260; // a little squash as it settles
      if (t >= 1) { drMesh.scale.set(1, 1, 1); drMesh.position.y = dr.y; drMesh = null; }
      else { const k = Math.sin(t * Math.PI) * .14 * (1 - t); drMesh.scale.set(1 + k * .5, 1 - k, 1 + k * .5); drMesh.position.y = dr.y - dr.h * k / 2; }
    }
    // the tower wobbles more the less steady it is
    jolt = Math.max(0, jolt - dt * 2.2);
    const wob = reduced ? 0 : ((1 - steady) ** 1.6 * .011 + .0012) * Math.min(1, tower.length / 5) + jolt * .004;
    towerG.rotation.set(Math.sin(T * 2.3) * wob, 0, Math.cos(T * 1.9) * wob);
    // tumbling blocks
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i], p = d.m.position; d.t += dt;
      if (!d.rest) {
        d.v.y -= GRAV * dt; p.addScaledVector(d.v, dt);
        _q.setFromAxisAngle(_wp.copy(d.w).normalize(), d.w.length() * dt); d.m.quaternion.premultiply(_q);
        const gy = Math.max(Math.abs(p.x), Math.abs(p.z)) < 2.2 ? -.05 : GROUND; d.gy = gy; // the pedestal counts as ground too
        if (p.y < gy + d.r && d.v.y < 0 && Math.hypot(p.x, p.z) < 7.3) {
          p.y = gy + d.r; d.hits++;
          if (d.hits === 1) onCue?.({ k: 'thud' });
          if (Math.abs(d.v.y) < 2.2 || d.hits > 3) { // comes to rest lying flat on whichever face is nearest the ground
            d.rest = true; d.t = 0; let best = 0, bd = 0;
            for (let a = 0; a < 3; a++) { const y = _wp.set(+(a === 0), +(a === 1), +(a === 2)).applyQuaternion(d.m.quaternion).y / d.dim[a]; if (Math.abs(y) > Math.abs(bd)) { bd = y; best = a; } }
            _wp.set(+(best === 0), +(best === 1), +(best === 2)).applyQuaternion(d.m.quaternion);
            d.flat = new THREE.Quaternion().setFromUnitVectors(_wp, _up.set(0, Math.sign(bd) || 1, 0)).multiply(d.m.quaternion); d.restY = gy + d.dim[best] / 2;
          }
          else { d.v.y *= -.32; d.v.x *= .6; d.v.z *= .6; d.w.multiplyScalar(.5); }
        }
        shadowFor = Math.max(shadowFor, 4);
      }
      if (d.rest && d.t < .3) { d.m.quaternion.slerp(d.flat, Math.min(1, dt * 14)); p.y += (d.restY - p.y) * Math.min(1, dt * 14); shadowFor = Math.max(shadowFor, 2); }
      const gone = p.y < -40 || (d.rest && d.t > 2.4);
      if (d.rest && d.t > 2) { d.m.scale.setScalar(Math.max(.01, 1 - (d.t - 2) / .4)); shadowFor = Math.max(shadowFor, 2); }
      if (gone) { freeBlock(d.m); debris.splice(i, 1); }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt; const k = f.t / f.life;
      if (f.pop) { f.m.scale.setScalar(Math.max(.01, 1 - k)); if (k >= 1) { freeBlock(f.m); fx.splice(i, 1); shadowFor = 4; } continue; }
      if (f.grav) f.v.y -= f.grav * dt;
      f.m.position.addScaledVector(f.v, dt); f.v.multiplyScalar(1 - dt * 2.5);
      if (f.spin) f.m.rotation.y += f.spin * dt;
      f.m.scale.setScalar(Math.max(.01, 1 - k * k));
      if (k >= 1) { f.m.parent?.remove(f.m); fx.splice(i, 1); }
    }
    for (let i = loose.length - 1; i >= 0; i--) {
      const l = loose[i]; l.t += dt;
      l.g.position.y += (2.5 + l.t * 5) * dt; l.g.position.x += l.vx * dt; l.g.rotation.z = Math.sin(l.t * 5) * .12;
      if (l.t > 2.2) { l.g.traverse(o => { if (o.isMesh && o.material.isMeshToonMaterial) o.material.dispose(); }); towerG.remove(l.g); loose.splice(i, 1); }
    }
    // avatars ride their rocks up as the tower grows (and back down to watch a crash)
    const seen = dr && drLanded && dr.res === 'crash' ? Math.min(topY, height(tower.slice(0, dr.at)) + 1.5) : topY;
    const wantIsle = Math.max(.45, seen - 2.6);
    isleY += (wantIsle - isleY) * Math.min(1, dt * 2.2);
    if (Math.abs(wantIsle - isleY) > .01) shadowFor = Math.max(shadowFor, 2);
    avatars.forEach((a, i) => {
      a.hop = Math.max(0, a.hop - dt * 1.3);
      a.g.position.y = isleY + (reduced ? 0 : Math.sin(T * 1.1 + a.seed) * .09);
      a.av.position.y = .3 + .76 * AV + Math.sin(a.hop * Math.PI) * .35;
      animateAvatar(a.av, T, { seed: a.seed, active: playing && i === turn, hop: a.hop });
    });
    if (me >= 0 && avatars[me]) { arrow.visible = true; arrow.position.copy(avatars[me].g.position); arrow.position.y += .3 + 2.1 * AV + 1.0; animateArrow(arrow, T); } else arrow.visible = false;
    clouds.rotation.y += dt * .006;

    // camera: a fixed three-quarter view that climbs with the tower and backs off on narrow screens
    const wantY = seen + (W_ < H_ ? 1.5 : 1);
    camY += (wantY - camY) * Math.min(1, dt * 2.6);
    const half = Math.tan(camera.fov * Math.PI / 360), dist = Math.max(22, 6.1 / (half * camera.aspect));
    const az = CAM_AZ + (reduced ? 0 : Math.sin(T * .13) * .05);
    shake = Math.max(0, shake - dt * 2.4);
    const sx = reduced ? 0 : Math.sin(T * 61) * shake * .12, sy = reduced ? 0 : Math.cos(T * 53) * shake * .12;
    look.set(sx, camY + sy, 0);
    camera.position.set(look.x + Math.sin(az) * Math.cos(CAM_EL) * dist, look.y + Math.sin(CAM_EL) * dist, look.z + Math.cos(az) * Math.cos(CAM_EL) * dist);
    camera.lookAt(look);
    sun.position.set(9, camY + 16, 5); sun.target.position.set(0, camY - 1, 0);
    if (shadowFor > 0) { shadowFor--; renderer.shadowMap.needsUpdate = true; }

    renderer.render(scene, camera);
    avatars.forEach((a, i) => {
      const t = a.tag; proj.set(a.g.position.x, a.g.position.y + .3 + 2.1 * AV + .3, a.g.position.z).project(camera);
      t.show = proj.z < 1 && Math.abs(proj.x) < 1.2 && Math.abs(proj.y) < 1.2;
      t.x = (proj.x + 1) / 2 * W_; t.y = (1 - proj.y) / 2 * H_; info.tags[i] = t;
    });
    info.tags.length = avatars.length;
    info.busy = !!(dr && !drLanded) || debris.some(d => !d.rest);
    onFrame?.(info);
  }
  const frames = frameLoop(frame, { onSlow: () => res.lower() });

  return {
    setSeats, setState, swingMs, hold,
    dispose() {
      frames.stop();
      for (const a of avatars) disposeAvatar(a.av);
      disposeArrow(arrow);
      scene.traverse(o => { if (o.isMesh && !o.userData.keep) o.geometry?.dispose(); });
      balMat.dispose(); inkMat.dispose(); renderer.dispose();
    },
  };
}

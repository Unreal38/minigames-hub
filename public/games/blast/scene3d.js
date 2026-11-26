// Blast Bay's 3D view: the maze on a floating Pet Farm isle, everyone's avatar, the pop seeds, the petal blasts, the
// pets hopping out of crates and the edge crumbling away. The page (client.js) owns the rules, the buttons and your
// own walking; this file only draws.
// Cost rules: the floor, walls and crates are a handful of instanced meshes (one draw each, whatever the maze size),
// blasts are two more, avatars get soft blobs instead of real shadows, and there are no shadow maps at all.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar } from '../../avatar3d.js';
import { island, skyDome, clouds, nightScene, birds, flat, createFx, STAR, DOT, HEART } from '../../scenery3d.js';
import { groundOf } from '../../isle3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { frameLoop, autoResolution, AA, gfx } from '../../frames.js';
import { ARENAS, EL_COL, ELS, WALL, CRATE, GONE, Q } from './rules.js';

const K = .44;                       // avatars are drawn at this size, on a wrapper (standing-avatar rule: the avatar sits .76 up inside it)
const PETAL = ['#ff8fc8', '#fff07a', '#ffffff', '#ffc2e0', '#7ad66b'];
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); return (a < 0 ? a + Math.PI * 2 : a) - Math.PI; };
const FACE = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // facing 0 down (towards the camera), 1 right, 2 up, 3 left

// What each arena's walls and crates look like.
const LOOK = {
  woods: { wall: ['#3f8c4a', '#47944f', '#3a8545'], top: '#5fb04a', crate: 'hay' },
  ridge: { wall: ['#a9a6b0', '#98959f', '#b3b0ba'], top: null, crate: 'box' },
  sweet: { wall: ['#7b4a2e', '#6e4128', '#83512f'], top: '#fff4fa', crate: 'cake' },
};

export function createScene(canvas, opts = {}) {
  const level = gfx(), few = level === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .5, 600);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.45); key.position.set(-8, 20, 12); scene.add(key);
  skyDome(scene, '#4fa8f0', '#c9ecff'); scene.add(clouds({ near: 40, far: 14, below: -12, min: 30, max: 120 }));
  const fly = birds(scene, 34, 10, 3, 1.3);
  const fx = createFx(scene, { max: few ? 400 : 700 });
  nightScene(scene, { wx: { size: 30 } });
  res.prep?.(scene);

  // ---------- the maze ----------
  let arena = '', W = 0, H = 0, grid = null, world = null, floor = null, dirt = null, depth = [], crates = [], crateOf = new Map(), fallen = [], shakeSet = new Set();
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const wx = x => x - (W - 1) / 2, wz = y => y - (H - 1) / 2;
  function clearWorld() {
    if (!world) return;
    scene.remove(world);
    world.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose?.(); } });
    world = null; crates = []; crateOf = new Map(); fallen = []; shakeSet = new Set();
  }
  function build(arenaId, w, h, g) {
    clearWorld();
    arena = arenaId; W = w; H = h; grid = g.slice();
    world = new THREE.Group(); scene.add(world);
    const th = groundOf(ARENAS[arena]?.isle | 0), look = LOOK[arena] || LOOK.woods, n = W * H;
    // floor tiles (a slab of lawn each, two tones like a lawn mown in squares) on a column of earth that hangs below
    floor = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .3, 1), flat('#ffffff'), n);
    dirt = new THREE.InstancedMesh(new THREE.BoxGeometry(.98, 1, .98), flat(th.earth), n);
    depth = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      dummy.position.set(wx(x), -.15, wz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); floor.setMatrixAt(i, dummy.matrix);
      floor.setColorAt(i, col.set((x + y) % 2 ? th.grass : th.patch));
      const d = .8 + edge * .5 + ((x * 7 + y * 13) % 5) * .12; depth[i] = d;
      dummy.position.set(wx(x), -.3 - d / 2, wz(y)); dummy.scale.set(1, d, 1); dummy.updateMatrix(); dirt.setMatrixAt(i, dummy.matrix);
    }
    floor.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dirt.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    world.add(floor, dirt);
    // a rock point far underneath, smaller than the maze, so a fallen tile shows sky
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(W, H) * .32, Math.max(W, H) * .55, 7), flat(th.rock)); cone.rotation.x = Math.PI; cone.position.y = -2.6 - Math.max(W, H) * .27; world.add(cone);
    // walls
    const walls = []; for (let i = 0; i < n; i++) if (grid[i] === WALL) walls.push(i);
    const wgeo = arena === 'ridge' ? new THREE.DodecahedronGeometry(.6, 0) : arena === 'sweet' ? new THREE.BoxGeometry(.94, .8, .94) : new THREE.BoxGeometry(.96, .92, .96);
    const wm = new THREE.InstancedMesh(wgeo, flat('#ffffff'), walls.length);
    walls.forEach((i, k) => {
      const x = i % W, y = i / W | 0;
      dummy.position.set(wx(x), arena === 'ridge' ? .36 : arena === 'sweet' ? .4 : .46, wz(y)); dummy.rotation.set(0, arena === 'ridge' ? (x * 1.7 + y * 2.3) : 0, 0);
      dummy.scale.set(1, arena === 'ridge' ? .82 : 1, 1); dummy.updateMatrix(); wm.setMatrixAt(k, dummy.matrix);
      wm.setColorAt(k, col.set(look.wall[(x * 3 + y) % look.wall.length]));
    });
    world.add(wm);
    if (look.top) { // hedges get a bushy top, chocolate blocks a lick of icing
      const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(arena === 'sweet' ? .8 : .72, arena === 'sweet' ? .1 : .2, arena === 'sweet' ? .8 : .72), flat(look.top), walls.length);
      walls.forEach((i, k) => { dummy.position.set(wx(i % W), arena === 'sweet' ? .85 : 1.0, wz(i / W | 0)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); tm.setMatrixAt(k, dummy.matrix); });
      world.add(tm);
    }
    // crates: a few instanced parts each
    const list = []; for (let i = 0; i < n; i++) if (grid[i] === CRATE) list.push(i);
    list.forEach((i, k) => crateOf.set(i, k));
    const parts = look.crate === 'hay' ? [[new THREE.BoxGeometry(.84, .66, .84), '#e9c357', [[0, .33, 0]]], [new THREE.BoxGeometry(.86, .68, .08), '#c99a30', [[0, .33, -.22], [0, .33, .22]]]]
      : look.crate === 'box' ? [[new THREE.BoxGeometry(.84, .78, .84), '#c9925a', [[0, .39, 0]]], [new THREE.BoxGeometry(.88, .1, .88), '#9c6b3c', [[0, .06, 0], [0, .74, 0]]]]
      : [[new THREE.CylinderGeometry(.42, .42, .56, 10), '#fbe0b5', [[0, .28, 0]]], [new THREE.CylinderGeometry(.44, .44, .14, 10), '#ff8fb8', [[0, .6, 0]]], [new THREE.SphereGeometry(.1, 8, 6), '#e02a3a', [[0, .74, 0]]]];
    crates = parts.map(([geo, c, offs]) => {
      const m = new THREE.InstancedMesh(geo, flat(c), Math.max(1, list.length * offs.length));
      list.forEach((i, k) => offs.forEach((o, j) => { dummy.position.set(wx(i % W) + o[0], o[1], wz(i / W | 0) + o[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.setMatrixAt(k * offs.length + j, dummy.matrix); }));
      if (!list.length) m.count = 0;
      m.userData.per = offs.length; world.add(m); return m;
    });
    // little floating isles of the same Pet Farm island round about
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (1.08 + k / 4 * .84), r = Math.max(W, H) * .78 + (k % 2) * 3;
      const isl = island(2.4 + (k % 3), 2.4, { season: null, grass: th.grass, patch: th.patch, earth: th.earth, rock: th.rock, kinds: th.kinds, petals: th.petals, flowers: 6, props: 3, rim: .8, seed: k + 3, depth: .8 });
      isl.position.set(Math.cos(a) * r * 1.25, -2.5 - (k % 3) * 1.3, Math.sin(a) * r - 1); isl.scale.setScalar(.9); world.add(isl);
    }
  }
  function crateGone(i) {
    const k = crateOf.get(i); if (k === undefined) return;
    crateOf.delete(i);
    dummy.position.set(0, -60, 0); dummy.scale.set(.001, .001, .001); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    for (const m of crates) { for (let j = 0; j < m.userData.per; j++) m.setMatrixAt(k * m.userData.per + j, dummy.matrix); m.instanceMatrix.needsUpdate = true; }
    const look = LOOK[arena] || LOOK.woods, bits = look.crate === 'hay' ? ['#e9c357', '#c99a30'] : look.crate === 'box' ? ['#c9925a', '#9c6b3c'] : ['#fbe0b5', '#ff8fb8'];
    fx.burst(new THREE.Vector3(wx(i % W), .5, wz(i / W | 0)), { n: few ? 6 : 10, colors: bits, shape: DOT, speed: 2.4, up: 3, size: .22, life: .7, grav: 9 });
  }
  // The server's maze: break the crates that went, drop the tiles that fell.
  function setGrid(g) {
    if (!grid) return;
    for (let i = 0; i < g.length; i++) {
      const was = grid[i], now = +g[i]; if (was === now) continue;
      if (was === CRATE && now !== CRATE) crateGone(i);
      if (now === GONE) { fallen.push({ i, t: 0 }); shakeSet.delete(i); fx.puff(new THREE.Vector3(wx(i % W), 0, wz(i / W | 0)), { n: few ? 3 : 6, color: ['#ffffff', '#e8d9bd'], size: .4, speed: 1.2 }); }
      grid[i] = now;
    }
  }
  let shaking = [];
  function setFalls(list) { shaking = list || []; for (const [i] of shaking) shakeSet.add(i); }

  // ---------- people ----------
  let me = -1;
  const folk = [];
  const blobGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: '#1c2540', transparent: true, opacity: .22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 });
  const BLOBS = 64, blobs = new THREE.InstancedMesh(blobGeo, blobMat, BLOBS); blobs.frustumCulled = false; blobs.renderOrder = 1; scene.add(blobs);
  const bm = new THREE.Matrix4();
  const bubbleGeo = new THREE.IcosahedronGeometry(.62, 1);
  function setSeats(list, mySeat) {
    me = mySeat;
    list.forEach((p, i) => {
      const m = folk[i], k = JSON.stringify([p.color, p.av]);
      if (m && m.key === k) return;
      if (m) drop(m);
      const wrap = new THREE.Group(); wrap.rotation.order = 'YXZ'; wrap.scale.setScalar(K);
      const av = avatar3d(p.color, p.av, { pose: 'stand', hand: false }); av.position.y = .76; wrap.add(av); scene.add(wrap);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.34, .44, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: .9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
      ring.renderOrder = 2; scene.add(ring);
      const bubble = new THREE.Mesh(bubbleGeo, new THREE.MeshStandardMaterial({ color: '#8fe07a', transparent: true, opacity: .3, depthWrite: false, roughness: .3 })); bubble.visible = false; scene.add(bubble);
      folk[i] = { i, key: k, wrap, av, ring, bubble, x: 0, y: 0, tx: 0, ty: 0, ry: 0, tr: 0, amt: 0, ph: 0, spd: 0, in: true, outT: -9, flags: 0, placed: false, sx: 0, sy: 0, on: false };
    });
    while (folk.length > list.length) drop(folk.pop());
  }
  function drop(m) { scene.remove(m.wrap, m.ring, m.bubble); disposeAvatar(m.av); m.ring.geometry.dispose(); m.ring.material.dispose(); m.bubble.material.dispose(); }
  let mine = null;
  function setMine(p) { mine = p; }
  // a: [x, y, facing, flags] per seat (see the server's view)
  function snapPlayers(a) {
    a.forEach((v, i) => {
      const m = folk[i]; if (!m) return;
      const x = v[0] / Q, y = v[1] / Q, inNow = !!(v[3] & 1);
      if (!(i === me && mine)) { m.tx = x; m.ty = y; m.tr = FACE[v[2] & 3]; if (!m.placed) { m.x = x; m.y = y; m.ry = m.tr; } }
      if (m.in && !inNow) m.outT = T;
      if (!m.in && inNow) { m.x = x; m.y = y; }
      m.in = inNow; m.flags = v[3]; m.placed = true;
    });
  }

  // ---------- pop seeds ----------
  const seeds = new Map();
  const podGeo = new THREE.IcosahedronGeometry(.3, 1), leafGeo = new THREE.ConeGeometry(.1, .28, 4), tipGeo = new THREE.SphereGeometry(.08, 8, 6);
  const podMat = flat('#ff8fc8'), leafMat = flat('#6cbf4a'), tipMat = new THREE.MeshBasicMaterial({ color: '#fff07a' });
  function seedModel() {
    const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
    const pod = new THREE.Mesh(podGeo, podMat); pod.position.y = .3; pod.scale.set(1, 1.1, 1); b.add(pod);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2, lf = new THREE.Mesh(leafGeo, leafMat); lf.position.set(Math.cos(a) * .15, .62, Math.sin(a) * .15); lf.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); b.add(lf); }
    const tip = new THREE.Mesh(tipGeo, tipMat); tip.position.y = .7; b.add(tip);
    g.userData = { b, tip }; return g;
  }
  // b: [id, x, y, ms left, owner, mine-to-pass]
  function setSeeds(list, now) {
    const seen = new Set();
    for (const [id, qx, qy, left] of list) {
      seen.add(id);
      let s = seeds.get(id);
      if (!s) { s = { g: seedModel(), x: qx / Q, y: qy / Q, born: T }; scene.add(s.g); seeds.set(id, s); }
      s.tx = qx / Q; s.ty = qy / Q; s.end = now + left;
    }
    for (const [id, s] of seeds) if (!seen.has(id) && !s.local) { scene.remove(s.g); seeds.delete(id); }
  }
  // your own seed, shown the moment you plant it (until the server's copy arrives)
  function localSeed(x, y) { const id = 'l' + x + ',' + y; if (seeds.has(id)) return; const s = { g: seedModel(), x, y, tx: x, ty: y, born: T, local: true, end: performance.now() + 2400 }; scene.add(s.g); seeds.set(id, s); setTimeout(() => { const t = seeds.get(id); if (t) { scene.remove(t.g); seeds.delete(id); } }, 500); }

  // ---------- petal blasts ----------
  const BN = 260;
  const outer = new THREE.InstancedMesh(new THREE.BoxGeometry(.96, .5, .96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthWrite: false }), BN);
  const core = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .62, .5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), BN);
  for (const m of [outer, core]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; for (let i = 0; i < BN; i++) { dummy.position.set(0, -60, 0); dummy.scale.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); } scene.add(m); }
  outer.material.color.set('#ff8fc8'); core.material.color.set('#fff4fa');
  const slots = Array.from({ length: BN }, () => ({ life: 0, x: 0, z: 0 })); let bnext = 0;
  function blast(cells) {
    for (const i of cells) {
      const s = slots[bnext]; bnext = (bnext + 1) % BN; s.life = .45; s.x = wx(i % W); s.z = wz(i / W | 0);
    }
    const mid = cells[0];
    if (mid !== undefined) {
      const p = new THREE.Vector3(wx(mid % W), .5, wz(mid / W | 0));
      fx.burst(p, { n: few ? 10 : 22, colors: PETAL, shape: HEART, speed: 3.4, up: 3.2, size: .3, life: .9, grav: 6 });
      if (!few) for (const i of cells.slice(1)) if ((i * 7) % 3 === 0) fx.burst(new THREE.Vector3(wx(i % W), .4, wz(i / W | 0)), { n: 3, colors: PETAL, shape: DOT, speed: 1.6, up: 2.4, size: .2, life: .6, grav: 6 });
    }
    kick = Math.min(1, kick + .35);
  }
  let kick = 0; // a small camera bump on every blast

  // ---------- pets that hopped out of crates ----------
  const pets = new Map(), protos = new Map();
  function petOf(sp) {
    let p = protos.get(sp);
    if (!p) {
      const m = petModel(sp, 2), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const k = Math.min(.7 / size.y, .8 / Math.max(size.x, size.z)); m.userData = { ...m.userData };
      const g = new THREE.Group(); m.scale.multiplyScalar(k); m.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k); g.add(m);
      protos.set(sp, p = g);
    }
    // a clone copies userData through JSON, so the wiggling parts list must be found again on the copy
    const c = p.clone(), m = c.children[0], wigs = [];
    m.traverse(o => { if (o.userData.wig) wigs.push({ o, k: o.userData.wig, r: [o.rotation.x, o.rotation.y, o.rotation.z] }); });
    m.userData.wigs = wigs;
    return c;
  }
  const petRingGeo = new THREE.RingGeometry(.3, .4, 20).rotateX(-Math.PI / 2);
  // it: [id, x, y, element, species]
  function setItems(list) {
    const seen = new Set();
    for (const [id, x, y, el, sp] of list) {
      seen.add(id); if (pets.has(id)) continue;
      let g; try { g = petOf(sp); } catch { g = new THREE.Group(); }
      const ring = new THREE.Mesh(petRingGeo, new THREE.MeshBasicMaterial({ color: EL_COL[ELS[el]], transparent: true, opacity: .95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
      ring.position.set(wx(x), .02, wz(y)); ring.renderOrder = 2;
      g.position.set(wx(x), 0, wz(y)); scene.add(g, ring);
      pets.set(id, { g, ring, x, y, t0: T, seed: id });
      fx.burst(new THREE.Vector3(wx(x), .5, wz(y)), { n: few ? 6 : 12, colors: [EL_COL[ELS[el]], '#ffffff'], shape: STAR, speed: 2, up: 3, size: .25, life: .8 });
    }
    for (const [id, p] of pets) if (!seen.has(id)) { scene.remove(p.g, p.ring); p.ring.material.dispose(); pets.delete(id); }
  }

  // ---------- events ----------
  const v3 = new THREE.Vector3();
  const at = (x, y, h = 0) => v3.set(wx(x), h, wz(y)).clone();
  function caught(s) { const m = folk[s]; if (!m) return; fx.burst(at(m.x, m.y, .7), { n: few ? 12 : 24, colors: ['#ffffff', '#ffd34d', ...PETAL], shape: STAR, speed: 3, up: 4.2, size: .32, life: 1.1, grav: 6 }); fx.puff(at(m.x, m.y, .4), { n: 10, color: ['#ffffff'], size: .5, speed: 2.4 }); }
  function pop(s) { const m = folk[s]; if (!m) return; fx.burst(at(m.x, m.y, .7), { n: 14, colors: ['#8fe07a', '#ffffff'], shape: DOT, speed: 2.6, up: 2.6, size: .26, life: .7 }); }
  function boon(s, el) { const m = folk[s]; if (!m) return; fx.burst(at(m.x, m.y, 1), { n: few ? 8 : 16, colors: [EL_COL[ELS[el]], '#ffffff', '#ffd34d'], shape: STAR, speed: 2, up: 3.4, size: .28, life: 1 }); fx.ring?.(at(m.x, m.y, .05), { color: EL_COL[ELS[el]], size: 1.2 }); }
  function cheer(s) { const m = folk[s]; if (!m) return; fx.confetti(at(m.x, m.y, 2.6), { n: s === me ? 70 : 34, w: 3, h: 3, s }); }

  // ---------- camera ----------
  let cw = 0, ch = 0, rw = 0, rh = 0, portrait = false, camD = 20, camX = 0, camZ = 0, top = 0;
  const ro = new ResizeObserver(es => { const b = es[es.length - 1].contentRect; rw = b.width; rh = b.height; }); ro.observe(canvas);
  const TILT = 58 * Math.PI / 180;
  function fit() {
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    portrait = ch > cw * 1.1 && W > 0;
    const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const halfW = portrait ? 5.6 : W / 2 + .5, halfD = portrait ? 5.4 : H / 2 + .6;
    const dW = halfW / Math.tan(hf / 2) + 1.2, dH = (halfD * Math.sin(TILT) + 1) / Math.tan(vf / 2) + halfD * Math.cos(TILT);
    camD = Math.max(dW, dH) * (1 + top);
  }
  // the HUD across the top takes this share of the screen: the maze sits a little lower and smaller
  function setTop(k) { top = Math.max(0, Math.min(.3, k)); if (cw) fit(); }

  // ---------- every frame ----------
  let T = 0; const T0 = performance.now() / 1000;
  const loop = frameLoop(dt => {
    if (!canvas.isConnected) return;
    if (rw !== cw || rh !== ch) { cw = rw; ch = rh; if (cw && ch) { renderer.setSize(cw, ch, false); fit(); } }
    if (!cw || !ch || !world) { if (cw && ch) renderer.render(scene, camera); return; }
    T = performance.now() / 1000 - T0;
    const now = performance.now();
    let nb = 0;
    // people
    for (const m of folk) {
      const mineNow = m.i === me && mine;
      if (mineNow) { m.x = mine.x; m.y = mine.y; m.tr = FACE[mine.f]; m.spd = mine.moving ? 1 : 0; }
      else { const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
        if (d > 3) { m.x = m.tx; m.y = m.ty; m.spd = 0; }
        else if (d > .01) { const st = Math.min(d, Math.max(6 * dt, d * dt * 10)); m.x += dx / d * st; m.y += dy / d * st; m.spd = 1; }
        else m.spd = 0; }
      m.ry += wrapA(m.tr - m.ry) * Math.min(1, dt * 16);
      m.amt += ((m.spd > .05 ? 1 : 0) - m.amt) * Math.min(1, dt * 12); m.ph += dt * 13 * Math.max(m.amt, .001);
      const out = !m.in, k = out ? Math.min(1, (T - m.outT) / .6) : 0;
      m.wrap.visible = m.placed && (!out || k < 1);
      m.wrap.position.set(wx(m.x), out ? k * 1.4 : 0, wz(m.y));
      m.wrap.rotation.set(0, m.ry + (out ? k * 12 : 0), 0);
      m.wrap.scale.setScalar(K * (out ? Math.max(.01, 1 - k) : 1));
      if (m.wrap.visible) {
        animateAvatar(m.av, T, { seed: m.i });
        const ud = m.av.userData;
        if (m.amt > .02 && !out) { walkAvatar(m.av, m.ph, m.amt); ud.legs?.forEach(l => { l.rotation.z = 0; }); } else ud.legs?.forEach(l => { l.rotation.x = 0; l.rotation.z = 0; });
      }
      m.ring.visible = m.placed && !out; m.ring.position.set(wx(m.x), .02, wz(m.y));
      const sh = !out && (m.flags & 2), inv = !out && (m.flags & 4);
      m.bubble.visible = !!(sh || (inv && Math.sin(T * 30) > 0)); if (m.bubble.visible) m.bubble.position.set(wx(m.x), .55, wz(m.y));
      if (m.wrap.visible && !out && nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.36, 1, .36).setPosition(wx(m.x), .015, wz(m.y)));
    }
    // seeds: pulse faster as they get ready to burst
    for (const s of seeds.values()) {
      s.x += (s.tx - s.x) * Math.min(1, dt * 14); s.y += (s.ty - s.y) * Math.min(1, dt * 14);
      const left = s.end - now, hurry = left < 800, pulse = 1 + Math.sin(T * (hurry ? 26 : 8)) * (hurry ? .1 : .05), grow = Math.min(1, (T - s.born) * 6);
      s.g.position.set(wx(s.x), 0, wz(s.y)); s.g.userData.b.scale.set(pulse * grow, grow / pulse, pulse * grow);
      s.g.userData.tip.visible = Math.sin(T * 40) > -.3;
      if (nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.3, 1, .3).setPosition(wx(s.x), .015, wz(s.y)));
    }
    // pets hop on the spot until someone picks them up
    for (const p of pets.values()) {
      const u = T - p.t0, hop = Math.abs(Math.sin(u * 5)) * .14;
      p.g.position.y = hop; p.g.rotation.y = Math.sin(u * 1.3 + p.seed) * .8;
      p.g.children[0] && wiggle(p.g.children[0], T, p.seed, .6);
      p.ring.material.opacity = .7 + Math.sin(u * 4) * .25;
      if (nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.3, 1, .3).setPosition(wx(p.x), .015, wz(p.y)));
    }
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    // blasts
    for (let i = 0; i < BN; i++) { const s = slots[i]; if (s.life <= 0 && s.dead) continue;
      s.life -= dt; const k = Math.max(0, s.life / .45), pulse = .55 + .45 * Math.sin(k * Math.PI);
      dummy.rotation.set(0, 0, 0);
      const on = s.life > 0 ? 1 : 0; // a spent blast shrinks to nothing (parked far below, a tall phone camera could still see it)
      dummy.position.set(s.x, on ? .27 : -60, s.z); dummy.scale.set(pulse * on, (.5 + pulse * .6) * on, pulse * on); dummy.updateMatrix(); outer.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s.x, on ? .3 : -60, s.z); dummy.scale.set(pulse * 1.1 * on, on, pulse * 1.1 * on); dummy.updateMatrix(); core.setMatrixAt(i, dummy.matrix);
      s.dead = s.life <= 0; }
    outer.instanceMatrix.needsUpdate = core.instanceMatrix.needsUpdate = true;
    // falling tiles, and the ones about to go shaking
    if (fallen.length || shaking.length) {
      for (let k = fallen.length - 1; k >= 0; k--) { const f = fallen[k]; f.t += dt; const x = f.i % W, y = f.i / W | 0, d = depth[f.i], drop = 12 * f.t * f.t;
        dummy.rotation.set(f.t * .8, 0, f.t * .5); dummy.scale.set(1, 1, 1); dummy.position.set(wx(x), -.15 - drop, wz(y)); dummy.updateMatrix(); floor.setMatrixAt(f.i, dummy.matrix);
        dummy.scale.set(1, d, 1); dummy.position.set(wx(x), -.3 - d / 2 - drop, wz(y)); dummy.updateMatrix(); dirt.setMatrixAt(f.i, dummy.matrix);
        if (f.t > 2.2) { dummy.position.set(0, -90, 0); dummy.scale.set(.001, .001, .001); dummy.updateMatrix(); floor.setMatrixAt(f.i, dummy.matrix); dirt.setMatrixAt(f.i, dummy.matrix); fallen.splice(k, 1); } }
      for (const [i, left] of shaking) { if (grid[i] === GONE) continue; const x = i % W, y = i / W | 0, j = Math.max(0, 1 - left / 1200) * .06;
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(wx(x) + (Math.random() - .5) * j, -.15 - j, wz(y) + (Math.random() - .5) * j); dummy.updateMatrix(); floor.setMatrixAt(i, dummy.matrix); }
      floor.instanceMatrix.needsUpdate = dirt.instanceMatrix.needsUpdate = true;
    }
    // camera: the whole maze, or on an upright phone a closer view that follows you
    let tx = 0, tz = 0;
    if (portrait) { const m = folk[me], x = m && m.placed ? wx(m.x) : 0, y = m && m.placed ? wz(m.y) : 0; tx = Math.max(-(W / 2 - 5.2), Math.min(W / 2 - 5.2, x)); tz = Math.max(-(H / 2 - 4.4), Math.min(H / 2 - 4.4, y)); }
    camX += (tx - camX) * Math.min(1, dt * 5); camZ += (tz - camZ) * Math.min(1, dt * 5);
    kick = Math.max(0, kick - dt * 3);
    const bump = kick * .12 * Math.sin(T * 60);
    camera.position.set(camX + bump, Math.sin(TILT) * camD, camZ + Math.cos(TILT) * camD + .3);
    camera.lookAt(camX, 0, camZ + (portrait ? 1.4 : .3) - top * 4);
    fly?.(T);
    fx.update(dt, camera, ch);
    renderer.render(scene, camera);
    // where heads are on screen, for the name tags
    for (const f of folk) { v3.set(wx(f.x), 1.55, wz(f.y)).project(camera); f.on = f.placed && f.in && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1; f.sx = (v3.x * .5 + .5) * cw; f.sy = (-v3.y * .5 + .5) * ch; }
    opts.frame?.(folk, cw, ch);
  }, { onSlow: () => res.lower?.() });

  return {
    build, setGrid, setFalls, setSeats, setMine, snapPlayers, setSeeds, localSeed, setItems, blast, caught, pop, boon, cheer, setTop,
    built: () => arena,
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: loop.fps() }),
    dispose() {
      loop.stop(); ro.disconnect(); for (const m of folk) drop(m); folk.length = 0; clearWorld(); fx.dispose();
      for (const s of seeds.values()) scene.remove(s.g); seeds.clear();
      for (const p of pets.values()) scene.remove(p.g, p.ring); pets.clear();
      scene.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) if (!mt.userData?.shared) mt.dispose?.(); } });
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

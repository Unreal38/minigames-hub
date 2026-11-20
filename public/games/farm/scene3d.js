// Pet Farm 3D scene: a low-poly island floating in the sky, with a tile grid, the player's buildings and their wandering pets.
// Purely visual plus picking: it never decides rules. The client tells it what the farm looks like.
//   createScene(canvas, { onPick, onGhost }) ->
//     setFarm(farm)            show this farm (null = empty island)
//     setStarters(sp | null)   '' or a species: line up the three starters (that one hops); null: hide them
//     setEdit(on)              grid lines on or off
//     ghostNew(type, near, r) / ghostItem(id) / ghostRotate() / ghostCancel() / ghost()   the piece being placed
//     cheer(petId)             make a pet hop
//     thumbs(types)            -> { type: dataURL } little pictures for the build menu
//     dispose()
import * as THREE from 'three';
import { frameLoop, autoResolution } from '../../frames.js';
import { ITEMS, STARTERS, footprint, fits, blockedTiles, stepOf, formOf } from './data.js';
import { itemModel, petModel, balloonModel, disposeModel } from './models.js';

const SKY_TOP = '#4aa6ea', SKY_LOW = '#c9ecff';
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
// Nudge every corner of a shape a little so rock looks rough. Corners above keepY stay put.
function rough(geo, amt, keepY = Infinity) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = Math.round(x * 10) * 7 + Math.round(y * 10) * 13 + Math.round(z * 10) * 29;
    if (y < keepY) p.setXYZ(i, x + (hash(k, 1) - .5) * amt, y + (hash(k, 2) - .5) * amt * .6, z + (hash(k, 3) - .5) * amt);
  }
  geo.computeVertexNormals(); return geo;
}

export function createScene(canvas, { onPick, onGhost }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 70, 190);
  const camera = new THREE.PerspectiveCamera(36, 1, .5, 500);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9d6a8', 1.5));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.1); sun.position.set(9, 16, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; scene.add(sun, sun.target);

  let farm = null, N = 10, edit = false, dead = false, W = 0, H = 0;
  const cam = { az: .6, el: .82, dist: 19, tx: 0, tz: 0 };
  let lift = 0, liftNow = -1; // how far the picture is pushed up to clear the panels at the bottom (share of the height)
  const wx = (x, w = 1) => x + w / 2 - N / 2, wz = (y, h = 1) => y + h / 2 - N / 2;

  // ---------- the island ----------
  let land = null, gridLines = null, fineLines = null;
  const snap = (v, st) => Math.floor(v / st + 1e-6) * st;
  const flat = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: .95, flatShading: true, ...o });
  { // sky: deep blue overhead, pale at the horizon and below
    const g = new THREE.SphereGeometry(300, 16, 10), p = g.attributes.position, col = [], top = new THREE.Color(SKY_TOP), low = new THREE.Color(SKY_LOW), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { c.copy(low).lerp(top, Math.min(1, Math.max(0, p.getY(i) / 300 * 1.6 + .25))); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  }
  // clouds: a sea of them below the island and a few far off, all one mesh on a slowly turning ring
  const clouds = new THREE.Group(); scene.add(clouds);
  {
    const puffs = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const cloud = (x, y, z, s) => { for (const [dx, dy, dz, r] of [[0, 0, 0, 1], [.9, -.1, .2, .75], [-.9, -.12, -.1, .7], [.2, .3, -.3, .65]]) puffs.push([x + dx * s, y + dy * s, z + dz * s, r * s]); };
    for (let i = 0; i < 46; i++) { const a = hash(i, 1) * 6.283, d = 6 + hash(i, 2) * 90; cloud(Math.cos(a) * d, -11 - hash(i, 3) * 9 - d * .04, Math.sin(a) * d, 2.5 + hash(i, 4) * 3.5); }
    for (let i = 0; i < 12; i++) { const a = hash(i, 5) * 6.283, d = 85 + hash(i, 6) * 50; cloud(Math.cos(a) * d, 4 + hash(i, 7) * 22, Math.sin(a) * d, 4 + hash(i, 8) * 4); }
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), flat('#ffffff', { roughness: 1 }), puffs.length);
    puffs.forEach(([x, y, z, r], i) => im.setMatrixAt(i, m.compose(v.set(x, y, z), q, sc.set(r * 1.2, r * .6, r))));
    im.frustumCulled = false; clouds.add(im);
  }
  // little rocks drifting nearby, each with something growing on it
  const drift = [];
  function buildDrift() {
    for (const d of drift) { scene.remove(d); d.traverse(o => { o.geometry?.dispose(); }); }
    drift.length = 0;
    const e = N / 2 + 4;
    for (const [x, y, z, t, s] of [[e, 1.2, e - 3, 'pine', 1], [-e - 1, 2.4, 1, 'tree', 1.2], [-2, 1.8, -e - 2, 'bush', .9], [e + 2, 3.2, -e + 1, 'tree', .8], [-e, .4, e + 1, 'rock', 1]]) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); g.userData = { y, ph: x + z };
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.85, .65, .3, 6), flat('#7cc45c')); g.add(top);
      const under = new THREE.Mesh(rough(new THREE.ConeGeometry(.66, 1.5, 6, 2), .22), flat('#857a72')); under.rotation.x = Math.PI; under.position.y = -.9; g.add(under);
      const m = itemModel(t); m.position.y = .15; g.add(m);
      scene.add(g); drift.push(g);
    }
  }
  let fall = null;
  function buildLand() {
    if (land) { scene.remove(land); land.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
    land = new THREE.Group();
    // checkered grass, one mesh
    const pos = [], col = [], a = new THREE.Color('#8fd16a'), b = new THREE.Color('#84c860');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const x0 = x - N / 2, z0 = y - N / 2, c = (x + y) % 2 ? a : b;
      pos.push(x0, 0, z0, x0, 0, z0 + 1, x0 + 1, 0, z0, x0 + 1, 0, z0, x0, 0, z0 + 1, x0 + 1, 0, z0 + 1);
      for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.computeVertexNormals();
    const tiles = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })); tiles.receiveShadow = true; land.add(tiles);
    const mk = (g, c, y) => { const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: .95, flatShading: true })); m.position.y = y; m.receiveShadow = true; land.add(m); return m; };
    const R = N / 2 * Math.SQRT2;
    mk(new THREE.CylinderGeometry(R + 1.1, R + .7, .5, 4), '#7cc45c', -.26).rotation.y = Math.PI / 4;
    // the underside: a band of earth, then rock tapering to a point, with loose stones hanging about
    mk(rough(new THREE.CylinderGeometry(R + .7, R * .66, 2, 4, 3), .45, .9), '#a87750', -1.5).rotation.y = Math.PI / 4;
    const deep = N * .7;
    mk(rough(new THREE.ConeGeometry(R * .47, deep, 7, 3), N * .05), '#857a72', -2.4 - deep / 2).rotation.x = Math.PI;
    for (let i = 0; i < 6; i++) {
      const a = hash(i, N) * 6.283, d = R * (.35 + hash(i, 9) * .35), st = mk(new THREE.IcosahedronGeometry(.3 + hash(i, 3) * .5, 0), '#857a72', -3.4 - hash(i, 4) * deep * .5);
      st.position.x = Math.cos(a) * d; st.position.z = Math.sin(a) * d; st.scale.y = 1.4;
    }
    // a spring on the rim that spills over the edge
    const side = N / 2 + .78;
    mk(new THREE.CylinderGeometry(.5, .55, .1, 6), '#b9b3aa', .0).position.set(side - .55, 0, 1.5);
    mk(new THREE.BoxGeometry(.9, .06, .5), '#49a9e6', .03).position.set(side - .35, .03, 1.5);
    const fl = N * .9;
    const water = mk(new THREE.BoxGeometry(.12, fl, .5), '#9ad8ff', -fl / 2); water.position.set(side + .06, -fl / 2 + .04, 1.5); water.material.transparent = true; water.material.opacity = .8; water.receiveShadow = false;
    fall = mk(new THREE.BoxGeometry(.16, fl, .16), '#ffffff', -fl / 2); fall.position.set(side + .08, -fl / 2 + .04, 1.5); fall.material.transparent = true; fall.material.opacity = .7; fall.receiveShadow = false;
    // a few things on the rim so the edge doesn't look bare
    const rim = N / 2 + .55;
    for (const [x, z, t] of [[-rim, -rim + 1, 'pine'], [rim, -rim + 2.5, 'tree'], [-rim, rim - 2, 'bush'], [rim - 1.5, rim, 'rock'], [-rim + 3, -rim, 'bush'], [rim, rim - .5, 'pine']]) {
      const m = itemModel(t); m.position.set(x, -.02, z); m.scale.setScalar(.8); land.add(m);
    }
    // grid lines for edit mode
    const lp = [];
    for (let i = 0; i <= N; i++) { const v = i - N / 2, e = N / 2; lp.push(v, .02, -e, v, .02, e, -e, .02, v, e, .02, v); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    gridLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55 })); gridLines.visible = edit; land.add(gridLines);
    // half-tile lines, shown while a small prop is being placed
    const fp = [];
    for (let i = 0; i < N; i++) { const v = i + .5 - N / 2, e = N / 2; fp.push(v, .02, -e, v, .02, e, -e, .02, v, e, .02, v); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    fineLines = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .28 })); land.add(fineLines); gridVis();
    scene.add(land); buildDrift();
    const s = N / 2 + 3; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
    cam.dist = Math.min(Math.max(cam.dist, N * 1.6), N * 2.6);
  }

  // ---------- items ----------
  const items = new Map(); // id -> { key, g }
  function placeModel(g, type, x, y, r) {
    const [w, h] = footprint(type, r);
    g.position.set(wx(x, w), 0, wz(y, h)); g.rotation.y = -r * Math.PI / 2;
  }
  function syncItems() {
    const seen = new Set();
    for (const it of farm?.items || []) {
      seen.add(it.id);
      const key = [it.type, it.x, it.y, it.r, N].join();
      let e = items.get(it.id);
      if (e && e.key === key) continue;
      if (!e || e.type !== it.type) { if (e) { scene.remove(e.g); disposeModel(e.g); } e = { g: itemModel(it.type), type: it.type }; scene.add(e.g); items.set(it.id, e); }
      e.key = key; placeModel(e.g, it.type, it.x, it.y, it.r);
    }
    for (const [id, e] of items) if (!seen.has(id)) { scene.remove(e.g); disposeModel(e.g); items.delete(id); }
    for (const [id, e] of items) e.g.visible = !(ghost && ghost.id === id);
    renderer.shadowMap.needsUpdate = true;
  }

  // ---------- pets ----------
  const pets = new Map(); // id -> { g, x, z, path, wait, hop, seed, blob }
  const blobGeo = new THREE.CircleGeometry(.3, 10), blobMat = new THREE.MeshBasicMaterial({ color: '#23401c', transparent: true, opacity: .28, depthWrite: false });
  let walkGrid = new Uint8Array(100);
  const PET_SIZE = .42;
  function addPet(id, sp, form, x, z) {
    const g = petModel(sp, form); g.scale.multiplyScalar(PET_SIZE); g.userData.base = g.scale.x;
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = .015;
    scene.add(g, blob);
    const p = { g, blob, x, z, path: [], wait: 1 + Math.random() * 2, hop: 0, seed: Math.random() * 10, key: sp + form, face: 0 };
    pets.set(id, p); return p;
  }
  function dropPet(id) { const p = pets.get(id); if (!p) return; scene.remove(p.g, p.blob); disposeModel(p.g); pets.delete(id); }
  const tileOf = p => [Math.max(0, Math.min(N - 1, Math.floor(p.x + N / 2))), Math.max(0, Math.min(N - 1, Math.floor(p.z + N / 2)))];
  function freeTileNear(tx, ty) {
    let best = null, bd = 1e9;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!walkGrid[y * N + x]) { const d = (x - tx) ** 2 + (y - ty) ** 2 + Math.random() * .5; if (d < bd) { bd = d; best = [x, y]; } }
    return best;
  }
  function syncPets() {
    if (!farm) { for (const id of [...pets.keys()]) if (!String(id).startsWith('starter:')) dropPet(id); return; }
    walkGrid = blockedTiles(farm);
    const seen = new Set();
    const house = farm.items.find(i => i.type === 'house');
    for (const pet of farm.pets) {
      if (farm.trip?.pets.includes(pet.id)) continue; // away on an expedition
      seen.add(pet.id);
      const form = formOf(pet.lv);
      let p = pets.get(pet.id);
      if (p && p.key !== pet.sp + form) { dropPet(pet.id); p = null; }
      if (!p) {
        const [hx, hy] = house ? [house.x + 1, house.y + 3] : [N / 2 | 0, N / 2 | 0];
        const t = freeTileNear(hx, hy) || [0, 0];
        p = addPet(pet.id, pet.sp, form, wx(t[0]), wz(t[1]));
      }
      // standing where something was just built: step aside
      const [tx, ty] = tileOf(p);
      if (walkGrid[ty * N + tx]) { const t = freeTileNear(tx, ty); if (t) { p.x = wx(t[0]); p.z = wz(t[1]); } p.path = []; }
      else { const cut = p.path.findIndex(([x, y]) => walkGrid[y * N + x]); if (cut >= 0) p.path.length = cut; }
    }
    for (const id of [...pets.keys()]) if (!seen.has(id)) dropPet(id);
  }
  // A short stroll: breadth-first over free tiles, then walk to a random one nearby.
  function stroll(p) {
    const [sx, sy] = tileOf(p), start = sy * N + sx, prev = new Int16Array(N * N).fill(-1), dist = new Uint8Array(N * N), q = [start], reach = [];
    prev[start] = start;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], cx = c % N, cy = c / N | 0;
      if (dist[c] >= 7) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, y = cy + dy, n = y * N + x;
        if (x < 0 || y < 0 || x >= N || y >= N || prev[n] >= 0 || walkGrid[n]) continue;
        prev[n] = c; dist[n] = dist[c] + 1; q.push(n); if (dist[n] >= 2) reach.push(n);
      }
    }
    if (!reach.length) return;
    let c = reach[Math.random() * reach.length | 0]; const path = [];
    while (c !== start) { path.unshift([c % N, c / N | 0]); c = prev[c]; }
    p.path = path;
  }
  function movePets(dt, T) {
    for (const p of pets.values()) {
      let moving = false;
      if (p.fixed) { /* starter on show */ }
      else if (p.path.length) {
        const [tx, ty] = p.path[0], gx = wx(tx), gz = wz(ty), dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz), step = 1.25 * dt;
        if (d <= step) { p.x = gx; p.z = gz; p.path.shift(); if (!p.path.length) p.wait = 1.5 + Math.random() * 4; }
        else { p.x += dx / d * step; p.z += dz / d * step; p.face = Math.atan2(dx, dz); }
        moving = true;
      } else if ((p.wait -= dt) <= 0) { stroll(p); if (!p.path.length) p.wait = 2; }
      p.hop = Math.max(0, p.hop - dt * 1.6);
      const bounce = moving ? Math.abs(Math.sin(T * 9 + p.seed)) * .1 : 0, cheer = p.hop ? Math.abs(Math.sin(p.hop * Math.PI * 3)) * .35 * p.hop : 0;
      const breathe = 1 + Math.sin(T * 2.2 + p.seed) * .025, b = p.g.userData.base;
      p.g.position.set(p.x, bounce + cheer, p.z);
      let da = p.face - p.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); p.g.rotation.y += da * Math.min(1, dt * 8);
      p.g.scale.set(b / Math.sqrt(breathe), b * breathe, b / Math.sqrt(breathe));
      const blink = (T + p.seed) % 3.6 < .12 ? .15 : 1; for (const e of p.g.userData.eyes) e.scale.z = blink;
      const fl = p.g.userData.flame; if (fl) fl.scale.y = fl.scale.x * (1 + Math.sin(T * 11 + p.seed) * .1);
      p.blob.position.set(p.x, .015, p.z); p.blob.scale.setScalar((p.big || 1) * (1 - (bounce + cheer) * .8));
    }
  }

  // ---------- the expedition balloon ----------
  // It waits above the gate, flies off with the party, and comes back when they are done.
  const balloon = balloonModel(); balloon.visible = false; scene.add(balloon);
  const bal = { state: 'none', t: 9, from: new THREE.Vector3(), home: new THREE.Vector3(), far: new THREE.Vector3() };
  function syncBalloon() {
    const gate = farm?.items.find(i => i.type === 'gate');
    const state = !gate || starters ? 'none' : !farm.trip ? 'home' : farm.trip.left > 0 ? 'away' : 'back';
    if (gate) { const [w, h] = footprint('gate', gate.r); bal.home.set(wx(gate.x, w), 1.75, wz(gate.y, h)); bal.far.set(bal.home.x + N * 2.2, 13, bal.home.z - N * 2.4); }
    if (state === bal.state) return;
    // only a real departure or return is flown; anything else just appears in place
    const fly = (bal.state === 'home' && state === 'away') || (bal.state === 'away' && state === 'back');
    bal.t = fly ? 0 : 9; bal.from.copy(state === 'away' ? bal.home : bal.far); bal.state = state;
  }
  function moveBalloon(dt, T) {
    if (bal.state === 'none') { balloon.visible = false; return; }
    bal.t += dt;
    const k = Math.min(1, bal.t / 6), e = k * k * (3 - 2 * k), away = bal.state === 'away';
    balloon.visible = !(away && k >= 1);
    if (!balloon.visible) return;
    const to = away ? bal.far : bal.home;
    balloon.position.lerpVectors(bal.from, to, k < 1 ? e : 1);
    balloon.position.y += Math.sin(T * 1.3) * .08 + (bal.state === 'back' && k >= 1 ? Math.abs(Math.sin(T * 3.2)) * .25 : 0);
    balloon.rotation.y = Math.sin(T * .4) * .3;
    balloon.scale.setScalar(.8);
  }

  // ---------- the battle ring ----------
  // A separate little scene: a round island with one pet from each side. While a fight is on, this is drawn instead of the farm.
  const ring = new THREE.Scene(); ring.background = new THREE.Color(SKY_LOW);
  let fighting = false;
  const HOME = [new THREE.Vector3(-1.25, 0, 1.1), new THREE.Vector3(1.25, 0, -1.1)], FACE = [2.3, -.75];
  const bp = [null, null]; // the two pets in the ring: { g, key, base, t, lunge, shake, hop, fall }
  {
    ring.add(new THREE.HemisphereLight('#ffffff', '#b9d6a8', 1.5));
    const l = new THREE.DirectionalLight('#fff1d6', 2.1); l.position.set(5, 10, 6); ring.add(l);
    const add = (g, c, y, o) => { const m = new THREE.Mesh(g, flat(c, o)); m.position.y = y; ring.add(m); return m; };
    add(new THREE.CylinderGeometry(4.4, 4.2, .4, 10), '#7cc45c', -.2);
    add(new THREE.CylinderGeometry(3.3, 3.3, .02, 24), '#8fd16a', .011);
    add(new THREE.RingGeometry(3.25, 3.4, 24), '#ffffff', .03).rotation.x = -Math.PI / 2;
    add(rough(new THREE.CylinderGeometry(4.2, 2.6, 1.6, 10, 2), .4, .7), '#a87750', -1.2);
    add(rough(new THREE.ConeGeometry(2.7, 5, 7, 3), .5), '#857a72', -4.4).rotation.x = Math.PI;
    for (const [a, c] of [[.6, '#d9584e'], [2.3, '#ffc94d'], [3.9, '#5d8fd1'], [5.4, '#86cc5a']]) {
      const x = Math.cos(a) * 3.9, z = Math.sin(a) * 3.9;
      add(new THREE.CylinderGeometry(.05, .05, 1.8, 5), '#8a5a3c', .9).position.set(x, .9, z);
      add(new THREE.BoxGeometry(.5, .34, .04), c, 1.55).position.set(x + .27, 1.55, z);
    }
    for (let i = 0; i < 9; i++) { const a = hash(i, 21) * 6.283, d = 14 + hash(i, 22) * 22, c = add(new THREE.IcosahedronGeometry(1, 0), '#ffffff', 0); c.position.set(Math.cos(a) * d, -5 - hash(i, 23) * 6, Math.sin(a) * d - 8); c.scale.set(3.4, 1.6, 2.6).multiplyScalar(.7 + hash(i, 24)); }
  }
  function ringPet(s, u) { // u: { id, sp, form } or null
    const key = u ? u.id + u.sp + u.form : '';
    if (bp[s]?.key === key) return;
    if (bp[s]) { ring.remove(bp[s].g, bp[s].blob); disposeModel(bp[s].g); bp[s] = null; }
    if (!u) return;
    const g = petModel(u.sp, u.form); g.scale.multiplyScalar(.82);
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.set(HOME[s].x, .04, HOME[s].z); blob.scale.setScalar(g.scale.x * 3);
    ring.add(g, blob);
    bp[s] = { g, blob, key, base: g.scale.x, t: 0, lunge: 0, shake: 0, hop: 0, fall: 0, down: false, seed: s * 3.1 };
  }
  function moveRing(dt, T) {
    for (const s of [0, 1]) {
      const p = bp[s]; if (!p) continue;
      p.t += dt; p.lunge = Math.max(0, p.lunge - dt * 2.4); p.shake = Math.max(0, p.shake - dt * 2.2); p.hop = Math.max(0, p.hop - dt * 1.8);
      if (p.down) p.fall = Math.min(1, p.fall + dt * 1.6);
      const reach = Math.sin(p.lunge * Math.PI) * .9, to = HOME[1 - s], h = HOME[s];
      const pop = Math.min(1, p.t * 3.5), k = p.base * pop * (1 - p.fall * .85), breathe = 1 + Math.sin(T * 2.2 + p.seed) * .025;
      p.g.position.set(h.x + (to.x - h.x) * reach * .45 + Math.sin(T * 55) * .09 * p.shake, Math.abs(Math.sin(p.hop * Math.PI * 2)) * .4 * p.hop + Math.sin(p.lunge * Math.PI) * .25, h.z + (to.z - h.z) * reach * .45);
      p.g.rotation.set(0, FACE[s], p.fall * 1.3 * (s ? -1 : 1));
      p.g.scale.set(k / Math.sqrt(breathe), k * breathe, k / Math.sqrt(breathe));
      const blink = (T + p.seed) % 3.6 < .12 || p.down ? .15 : 1; for (const e of p.g.userData.eyes) e.scale.z = blink;
      const fl = p.g.userData.flame; if (fl) fl.scale.y = fl.scale.x * (1 + Math.sin(T * 11) * .1);
      p.blob.visible = p.fall < .5;
    }
  }

  // ---------- starter line-up ----------
  let starters = false, starSel = null;
  function setStarters(sel) {
    if (sel === null) { // back to the normal farm view
      if (starters) { for (const sp of STARTERS) dropPet('starter:' + sp); cam.az = .6; cam.el = .82; cam.dist = N * 1.9; }
      starters = false; return;
    }
    if (!starters) {
      starters = true;
      STARTERS.forEach((sp, i) => { const p = addPet('starter:' + sp, sp, 0, (i - 1) * 2.6, 0); p.fixed = true; p.g.scale.multiplyScalar(2.2); p.g.userData.base = p.g.scale.x; p.big = 2.2; });
      cam.az = 0; cam.el = .4; cam.dist = 11;
    }
    starSel = sel || null;
  }

  // ---------- the piece being placed ----------
  let ghost = null; // { type, id, x, y, r, ok, g, pad }
  function gridVis() { if (gridLines) gridLines.visible = edit; if (fineLines) fineLines.visible = edit && !!ghost && stepOf(ghost.type) < 1; }
  const padMat = new THREE.MeshBasicMaterial({ color: '#7dff8a', transparent: true, opacity: .5, depthWrite: false });
  function ghostCheck() {
    if (!ghost) return;
    ghost.ok = !!farm && fits(farm, ghost.type, ghost.x, ghost.y, ghost.r, ghost.id);
    const [w, h] = footprint(ghost.type, ghost.r);
    placeModel(ghost.g, ghost.type, ghost.x, ghost.y, ghost.r); ghost.g.position.y = .12;
    ghost.pad.scale.set(w, h, 1); ghost.pad.position.set(wx(ghost.x, w), .03, wz(ghost.y, h));
    padMat.color.set(ghost.ok ? '#7dff8a' : '#ff6b5a');
    onGhost?.(ghostInfo());
  }
  const ghostInfo = () => ghost && { type: ghost.type, id: ghost.id, x: ghost.x, y: ghost.y, r: ghost.r, ok: ghost.ok };
  function ghostStart(type, id, x, y, r) {
    ghostCancel(true);
    const g = itemModel(type);
    g.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = .8; m.castShadow = false; m.userData.baked = true; } });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), padMat); pad.rotation.x = -Math.PI / 2;
    scene.add(g, pad);
    ghost = { type, id, x, y, r, g, pad, ok: false };
    for (const [iid, e] of items) e.g.visible = iid !== id;
    renderer.shadowMap.needsUpdate = true;
    gridVis(); ghostCheck();
  }
  function ghostCancel(quiet) {
    if (!ghost) return;
    scene.remove(ghost.g, ghost.pad); disposeModel(ghost.g); ghost.pad.geometry.dispose(); ghost = null;
    for (const e of items.values()) e.g.visible = true;
    renderer.shadowMap.needsUpdate = true; gridVis();
    if (!quiet) onGhost?.(null);
  }
  // A good first spot for a new piece: the free place nearest the middle of the view.
  function firstSpot(type, near, r) {
    const [w, h] = footprint(type, r), st = stepOf(type), cx = near ? near[0] : snap(N / 2 - w / 2, st), cy = near ? near[1] : snap(N / 2 - h / 2, st);
    let best = null, bd = 1e9;
    for (let y = 0; y <= N - h; y += st) for (let x = 0; x <= N - w; x += st) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd && fits(farm, type, x, y, r)) { bd = d; best = [x, y]; } }
    return best || [Math.max(0, Math.min(N - w, cx)), Math.max(0, Math.min(N - h, cy))];
  }

  // ---------- pointer: orbit, zoom, tap, drag the ghost ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, hit) ? hit : null;
  }
  const inGhost = (tx, ty) => { if (!ghost) return false; const [w, h] = footprint(ghost.type, ghost.r); return tx >= ghost.x && ty >= ghost.y && tx < ghost.x + w && ty < ghost.y + h; };
  const itemAt = (tx, ty) => farm?.items.find(it => { const [w, h] = footprint(it.type, it.r); return tx >= it.x && ty >= it.y && tx < it.x + w && ty < it.y + h; });
  function petAt() {
    let best = null, bd = .6;
    for (const [id, p] of pets) { const c = p.g.position.clone(); c.y += .3 * (p.g.userData.base / PET_SIZE); const d = ray.ray.distanceToPoint(c); if (d < bd * (p.fixed ? 1.6 : 1)) { bd = d; best = id; } }
    return best;
  }
  const ptrs = new Map(); let drag = null, pinch = 0;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, e);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); drag = null; return; }
    const g = groundAt(e), tx = g ? g.x + N / 2 : -1, ty = g ? g.z + N / 2 : -1, st = ghost ? stepOf(ghost.type) : 1; // tx, ty: where on the grid, in tiles
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false,
      mode: ghost && inGhost(tx, ty) ? 'ghost' : 'orbit', ox: snap(tx, st) - (ghost?.x || 0), oy: snap(ty, st) - (ghost?.y || 0) };
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, e);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch) cam.dist = Math.min(N * 2.6, Math.max(7, cam.dist * pinch / d)); pinch = d; return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 7) drag.moved = true;
    if (!drag.moved) return;
    if (drag.mode === 'ghost') {
      const g = groundAt(e); if (!g) return;
      const [w, h] = footprint(ghost.type, ghost.r), st = stepOf(ghost.type);
      const nx = Math.max(0, Math.min(N - w, snap(g.x + N / 2, st) - drag.ox)), ny = Math.max(0, Math.min(N - h, snap(g.z + N / 2, st) - drag.oy));
      if (nx !== ghost.x || ny !== ghost.y) { ghost.x = nx; ghost.y = ny; ghostCheck(); }
    } else if (!starters) { cam.az -= dx * .006; cam.el = Math.min(1.35, Math.max(.16, cam.el + dy * .005)); }
  });
  const up = e => {
    if (!ptrs.delete(e.pointerId)) return;
    pinch = 0;
    const d = drag; drag = null;
    if (!d || d.moved || performance.now() - d.t > 500 || ptrs.size) return;
    const g = groundAt(e), tx = g ? g.x + N / 2 : -1, ty = g ? g.z + N / 2 : -1;
    const pid = petAt();
    if (starters) { if (pid) onPick?.({ starter: pid.slice(8) }); return; }
    if (ghost) { // tap a tile: the piece jumps there
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) return;
      const [w, h] = footprint(ghost.type, ghost.r), st = stepOf(ghost.type); // centre the piece on the tapped spot
      ghost.x = Math.max(0, Math.min(N - w, snap(tx - (w - st) / 2, st))); ghost.y = Math.max(0, Math.min(N - h, snap(ty - (h - st) / 2, st))); ghostCheck(); return;
    }
    if (pid && !edit) { pets.get(pid).hop = 1; onPick?.({ pet: pid }); return; }
    const it = tx >= 0 && itemAt(tx, ty);
    onPick?.(it ? { item: it.id } : { nothing: true });
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.min(N * 2.6, Math.max(7, cam.dist * Math.exp(e.deltaY * .0012))); }, { passive: false });

  // ---------- frame ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === H || !w || !h) return;
    W = w; H = h; liftNow = -1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  let T = 0;
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    lift = fighting ? .1 : starters ? .2 : edit ? .13 : 0;
    if (lift !== liftNow && W) { liftNow = lift; if (lift) camera.setViewOffset(W, H, 0, lift * H, W, H); else camera.clearViewOffset(); }
    if (fighting) { // a fixed view of the ring, further back on narrow screens
      const d = Math.max(7.2, 7.4 * H / Math.max(1, W));
      camera.position.set(-1.2, d * .42, d); camera.lookAt(0, .95, 0);
      moveRing(dt, T); renderer.render(ring, camera); return;
    }
    const k = Math.max(1, (starters ? 1.1 : .75) * H / Math.max(1, W)); // narrow screens need to stand further back
    const d = cam.dist * k, ce = Math.cos(cam.el);
    camera.position.set(cam.tx + Math.sin(cam.az) * ce * d, Math.sin(cam.el) * d, cam.tz + Math.cos(cam.az) * ce * d);
    camera.lookAt(cam.tx, starters ? .9 : 0, cam.tz);
    if (starters) for (const sp of STARTERS) { const p = pets.get('starter:' + sp); if (p) { p.face = 0; if (sp === starSel && p.hop <= 0) p.hop = 1; } }
    movePets(dt, T); moveBalloon(dt, T);
    clouds.rotation.y += dt * .006;
    for (const d of drift) d.position.y = d.userData.y + Math.sin(T * .7 + d.userData.ph) * .25;
    if (fall) fall.position.z = 1.5 + Math.sin(T * 9) * .14;
    if (ghost) ghost.g.position.y = .12 + Math.sin(T * 4) * .04;
    renderer.render(scene, camera);
  }
  buildLand();
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });
  renderer.shadowMap.needsUpdate = true;

  return {
    setFarm(f) {
      const size = f?.size || 10;
      farm = f;
      if (size !== N) { N = size; for (const id of [...pets.keys()]) if (!String(id).startsWith('starter:')) dropPet(id); for (const e of items.values()) e.key = ''; buildLand(); }
      syncItems(); syncPets(); syncBalloon();
      if (ghost) ghostCheck();
    },
    setStarters,
    setEdit(on) { edit = !!on; gridVis(); if (!edit) ghostCancel(); },
    ghostNew(type, near = null, r = 0) { if (!farm || !ITEMS[type]) return; const [x, y] = firstSpot(type, near, r); ghostStart(type, null, x, y, r); },
    ghostItem(id) { const it = farm?.items.find(i => i.id === id); if (it) ghostStart(it.type, it.id, it.x, it.y, it.r); },
    ghostRotate() {
      if (!ghost) return;
      ghost.r = (ghost.r + 1) % 4;
      const [w, h] = footprint(ghost.type, ghost.r); ghost.x = Math.max(0, Math.min(N - w, ghost.x)); ghost.y = Math.max(0, Math.min(N - h, ghost.y));
      ghostCheck();
    },
    ghostCancel: () => ghostCancel(),
    ghost: ghostInfo,
    cheer(id) { const p = pets.get(id); if (p) p.hop = 1; },
    // the battle ring: show it, put a pet on a side (0 yours, 1 theirs), and play what happens
    setBattle(on) { fighting = !!on; liftNow = -1; if (!on) { ringPet(0, null); ringPet(1, null); } },
    ringPet,
    ringFx(s, what) { const p = bp[s]; if (!p) return; if (what === 'lunge') p.lunge = 1; else if (what === 'hit') p.shake = 1; else if (what === 'hop') p.hop = 1; else if (what === 'faint') p.down = true; },
    // Little pictures for the build menu, drawn once with a throwaway renderer.
    thumbs(types, size = 112) {
      const out = {};
      try {
        const cv = document.createElement('canvas'); cv.width = cv.height = size;
        const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(1); r.setSize(size, size, false);
        const s = new THREE.Scene(), c = new THREE.PerspectiveCamera(30, 1, .1, 50);
        s.add(new THREE.HemisphereLight('#ffffff', '#b9d6a8', 1.6)); const l = new THREE.DirectionalLight('#fff1d6', 2); l.position.set(3, 6, 4); s.add(l);
        for (const t of types) {
          const pet = t.startsWith('pet:'), g = pet ? petModel(t.slice(4), 0) : itemModel(t);
          s.add(g);
          const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() / 2;
          const d = rad / Math.sin(15 * Math.PI / 180) * (pet ? .72 : 1.02);
          c.position.set(ctr.x + d * .55, ctr.y + d * .5, ctr.z + d * .68); c.lookAt(ctr);
          r.render(s, c); out[t] = cv.toDataURL('image/png');
          s.remove(g); disposeModel(g);
        }
        r.dispose(); r.forceContextLoss?.();
      } catch (e) { console.warn('no thumbnails', e); }
      return out;
    },
    dispose() {
      dead = true; ticker.stop();
      ghostCancel(true);
      for (const id of [...pets.keys()]) dropPet(id);
      for (const e of items.values()) disposeModel(e.g);
      scene.traverse(o => { if (o.isMesh || o.isLineSegments) { o.geometry?.dispose?.(); } });
      renderer.dispose();
    },
  };
}

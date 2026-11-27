// Pet Farm 3D scene: a low-poly island floating in the sky, with a tile grid, the player's buildings and their wandering pets.
// Purely visual plus picking: it never decides rules. The client tells it what the farm looks like.
//   createScene(canvas, { onPick, onGhost, onGhostAt }) ->   onGhostAt(x, top, bottom, front): each frame, where the piece being placed is on the canvas
//     setFarm(farm)            show this farm (null = empty island)
//     setStarters(sp | null)   '' or a species: line up the three starters (that one hops); null: hide them
//     setEdit(on)              grid lines on or off
//     ghostNew(type, near, r) / ghostItem(id) / ghostRotate() / ghostCancel() / ghost()   the piece being placed
//     cheer(petId)             make a pet hop
//     thumbs(types)            -> { type: dataURL } little pictures for the build menu
//     dispose()
import * as THREE from 'three';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { bake, avatar3d, animateAvatar, walkAvatar, disposeAvatar } from '../../avatar3d.js';
import { ITEMS, STARTERS, canTilt, footprint, fits, cellsOf, stepOf, formOf, lvOf, museumFill } from './data.js';
import { pinned } from './journal.js';
import { itemModel, fenceLink, LINKS, ROUTES, hammockSway, balloonModel, disposeModel, signModel, toonMat, toonify, WINDOW, HEARTH, flueTop } from './models.js';
import { fenceSnap, isDiag } from './fence.js';
import { PATHS, pathLink, pathSnap } from './paths.js';
import { petModel, eggModel, wiggle } from './pets3d.js';
import { createBattleFx } from './battlefx.js';
import { L } from '../../i18n.js';
import { groundOf, R as RIMS, BASE, finish, pieceModel } from '../../isle3d.js';
import { skyFriend } from '../../skyfriends.js';
import { skyBow, skyAurora } from '../../weather3d.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
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

export function createScene(canvas, { onPick, onGhost, onGhostAt }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 70, 190);
  const camera = new THREE.PerspectiveCamera(36, 1, .5, 500);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(9, 16, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; scene.add(sun, sun.target);

  let seenOnce = false, farmKey = '';
  let farm = null, N = 10, edit = false, dead = false, W = 0, H = 0;
  const cam = { az: .6, el: .82, dist: 19, tx: 0, tz: 0, gx: 0, gz: 0, follow: null, zoom: 0, back: null };
  // Panning: the camera looks at (tx, tz), which eases towards the goal (gx, gz). A pet whose card is open is followed.
  const panBy = (dx, dy) => { const s = cam.dist * .0017, c = Math.cos(cam.az), n = Math.sin(cam.az), lim = N / 2; cam.follow = null; cam.back = null; cam.zoom = 0;
    cam.gx = Math.max(-lim, Math.min(lim, cam.gx - (dx * c + dy * n) * s)); cam.gz = Math.max(-lim, Math.min(lim, cam.gz - (dy * c - dx * n) * s)); };
  function followPet(id) {
    if (id && pets.has(id)) { if (!cam.follow) cam.back ||= { x: cam.gx, z: cam.gz, d: cam.dist }; cam.follow = id; cam.zoom = Math.min(cam.dist, Math.max(10, N)); }
    else if (cam.follow) { cam.follow = null; if (cam.back) { cam.gx = cam.back.x; cam.gz = cam.back.z; cam.zoom = cam.back.d; cam.back = null; } }
  }
  let lift = 0, liftNow = -1; // how far the picture is pushed up to clear the panels at the bottom (share of the height)
  const wx = (x, w = 1) => x + w / 2 - N / 2, wz = (y, h = 1) => y + h / 2 - N / 2;

  // ---------- the island ----------
  let land = null, gridLines = null, fineLines = null;
  const snap = (v, st) => Math.floor(v / st + 1e-6) * st;
  const flat = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: .95, flatShading: true, ...o }); // plain, for things that get merged first
  const tflat = (c, o) => toonMat(flat(c, o));
  let skyGeo;
  { // sky: deep blue overhead, pale at the horizon and below
    const g = new THREE.SphereGeometry(300, 16, 10), p = g.attributes.position, col = [], top = new THREE.Color(SKY_TOP), low = new THREE.Color(SKY_LOW), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { c.copy(low).lerp(top, Math.min(1, Math.max(0, p.getY(i) / 300 * 1.6 + .25))); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    skyGeo = g; scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  }
  // clouds: a sea of them below the island and a few far off, all one mesh on a slowly turning ring
  function cloudLayer() {
    const grp = new THREE.Group();
    const puffs = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const cloud = (x, y, z, s) => { for (const [dx, dy, dz, r] of [[0, 0, 0, 1], [.9, -.1, .2, .75], [-.9, -.12, -.1, .7], [.2, .3, -.3, .65]]) puffs.push([x + dx * s, y + dy * s, z + dz * s, r * s]); };
    for (let i = 0; i < 46; i++) { const a = hash(i, 1) * 6.283, d = 6 + hash(i, 2) * 90; cloud(Math.cos(a) * d, -11 - hash(i, 3) * 9 - d * .04, Math.sin(a) * d, 2.5 + hash(i, 4) * 3.5); }
    for (let i = 0; i < 12; i++) { const a = hash(i, 5) * 6.283, d = 85 + hash(i, 6) * 50; cloud(Math.cos(a) * d, 4 + hash(i, 7) * 22, Math.sin(a) * d, 4 + hash(i, 8) * 4); }
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), tflat('#ffffff'), puffs.length);
    puffs.forEach(([x, y, z, r], i) => im.setMatrixAt(i, m.compose(v.set(x, y, z), q, sc.set(r * 1.2, r * .6, r))));
    im.frustumCulled = false; grp.add(im);
    return grp;
  }
  const clouds = cloudLayer(); scene.add(clouds);
  // little rocks drifting nearby, each with something growing on it
  const drift = [];
  function buildDrift() {
    for (const d of drift) { scene.remove(d); d.traverse(o => { o.geometry?.dispose(); }); }
    drift.length = 0;
    const e = N / 2 + 4;
    for (const [x, y, z, t, s] of [[e, 1.2, e - 3, 'pine', 1], [-e - 1, 2.4, 1, 'tree', 1.2], [-2, 1.8, -e - 2, 'bush', .9], [e + 2, 3.2, -e + 1, 'tree', .8], [-e, .4, e + 1, 'rock', 1]]) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); g.userData = { y, ph: x + z };
      const th = (look.ig | 0) ? groundOf(look.ig) : null, top = new THREE.Mesh(new THREE.CylinderGeometry(.85, .65, .3, 12), tflat(th ? th.grass : '#8bca60')); g.add(top);
      const under = new THREE.Mesh(rough(new THREE.ConeGeometry(.66, 1.5, 6, 2), .22), tflat(th ? th.earth : '#b08a6a')); under.rotation.x = Math.PI; under.position.y = -.9; g.add(under);
      const m = itemModel(t); m.position.y = .15; g.add(m);
      scene.add(g); drift.push(g);
    }
  }
  let fall = null;
  // The player's isle look (cosmetics ig ground, ib rock base, ik sky, fp floating pieces), worn by the farm island too.
  let look = { ig: 0, ib: 0, ik: 0, fp: [], whole: true }, landTicks = [], falls = [];
  const darker = (c, k = .82) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const RIM_ITEM = { bush: 'bush', tree: 'tree', rock: 'rock', shroom: 'shrooms', flowers: 'flowers', pine: 'pine' };
  function buildLand() {
    if (land) { scene.remove(land); land.traverse(o => { o.geometry?.dispose(); }); }
    land = new THREE.Group(); landTicks = []; falls = [];
    const th = groundOf(look.ig), themed = (look.ig | 0) > 0, ib = BASE[look.ib | 0] ? look.ib | 0 : 0;
    const lawnC = themed && look.whole ? th.grass : '#8bca60', patchC = themed && look.whole ? th.patch : '#7fbf56';
    const tm = dayMats.find(d => d[0] === tufts.material); if (tm) { tm[1].set(themed && look.whole ? darker(th.patch, .85) : '#6ab94a'); air.shade = -1; }
    // one soft lawn with darker patches and little flowers (the grid only shows while editing)
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(N, N), tflat(lawnC)); lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true; land.add(lawn);
    const deco = new THREE.Group(), patch = flat(patchC), petal = (themed && look.whole && th.petals || ['#ffffff', '#ffd0e4', '#fff1a8']).map(c => flat(c)), mid = flat('#ffb000');
    const nFlow = themed && look.whole ? Math.round(N * 3 * th.flowers / 32) : N * 3;
    for (let i = 0; i < N * 2; i++) { const r = .5 + hash(i, 5) * .8, x = (hash(i, 1) - .5) * (N - 2 * r), z = (hash(i, 2) - .5) * (N - 2 * r), m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), patch); m.rotation.x = -Math.PI / 2; m.position.set(x, .004, z); deco.add(m); }
    flowerAt = []; flowerKey = null; flowerG = null; // the little lawn flowers are placed with the items (placeFlowers), so none pokes up through a path or a blanket
    for (let i = 0; i < nFlow; i++) flowerAt.push([(hash(i, 11) - .5) * (N - .6), (hash(i, 12) - .5) * (N - .6), petal[i % petal.length], mid]);
    bake(deco); deco.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); toonify(deco); land.add(deco);
    const mk = (g, c, y, o) => { const m = new THREE.Mesh(g, tflat(c, o)); m.position.y = y; m.receiveShadow = true; land.add(m); return m; };
    const R = N / 2 * Math.SQRT2, ex = themed ? 1 : 0, ER = ex * Math.SQRT2; // ex: a themed island gets a wider rim, so its props stand on it rather than hang off it
    mk(new THREE.CylinderGeometry(R + 1.1 + ER, R + .7 + ER, .5, 4), themed ? darker(th.grass, look.whole ? .9 : 1) : '#7cba54', -.26).rotation.y = Math.PI / 4;
    // the underside: a band of earth, then rock tapering to a point, with loose stones hanging about
    mk(rough(new THREE.CylinderGeometry(R + .7 + ER, R * .66, 2, 4, 3), .45, .9), themed ? th.earth : '#c98a5a', -1.5).rotation.y = Math.PI / 4;
    const deep = N * .7, rockC = themed ? th.rock : '#857a72';
    if (!ib || ib === 3) {
      mk(rough(new THREE.ConeGeometry(R * .47, deep, 7, 3), N * .05), rockC, -2.4 - deep / 2).rotation.x = Math.PI;
      for (let i = 0; i < 6; i++) {
        const a = hash(i, N) * 6.283, d = R * (.35 + hash(i, 9) * .35), st = mk(new THREE.IcosahedronGeometry(.3 + hash(i, 3) * .5, 0), rockC, -3.4 - hash(i, 4) * deep * .5);
        st.position.x = Math.cos(a) * d; st.position.z = Math.sin(a) * d; st.scale.y = 1.4;
      }
    } else { // one of the isle's rock bases, grown to the farm's size
      const g = new THREE.Group(), k = R * .47 / (2.95 * .62); BASE[ib](g, { ...th, rock: rockC }, landTicks); finish(g, .05);
      g.traverse(o => { if (o.isMesh) o.castShadow = false; }); g.scale.setScalar(k); g.position.y = 2 * k - 2.4; land.add(g);
    }
    // a spring on the rim that spills over the edge
    const side = N / 2 + .78 + ex, wc = themed ? th.water : '#49a9e6', lava = !!th.lava && themed;
    const spring = (rot, z, wide = 1) => { // a spring on the rim that spills over the edge; rot turns it to another side
      const sg = new THREE.Group(); sg.rotation.y = rot; land.add(sg); const at = (m, x, y, zz) => { land.remove(m); sg.add(m); m.position.set(x, y, zz); return m; };
      at(mk(new THREE.CylinderGeometry(.5 * wide, .55 * wide, .1, 6), lava ? '#4a3230' : '#b9b3aa', 0), side - .55, 0, z);
      at(mk(new THREE.BoxGeometry(.9, .06, .5 * wide), wc, .03, lava ? { emissive: wc, emissiveIntensity: .8 } : undefined), side - .35, .03, z);
      const fl = N * (wide > 1 ? 1.05 : .9);
      at(mk(new THREE.BoxGeometry(.12, fl, .5 * wide), lava ? wc : themed ? wc : '#9ad8ff', 0, { transparent: true, opacity: .8, ...(lava ? { emissive: wc, emissiveIntensity: .7 } : {}) }), side + .06, -fl / 2 + .04, z).receiveShadow = false;
      const f = at(mk(new THREE.BoxGeometry(.16, fl, .16 * wide), lava ? '#ffd27a' : '#ffffff', 0, { transparent: true, opacity: .7 }), side + .08, -fl / 2 + .04, z); f.receiveShadow = false; falls.push([f, z]);
      if (wide > 1) for (let i = 0; i < 3; i++) { const m = at(mk(new THREE.IcosahedronGeometry(.9, 0), lava ? '#ffd27a' : '#ffffff', 0, { transparent: true, opacity: .55 }), side + .2, -fl + .2, z + (i - 1) * .5); falls.push([m, null, i]); }
    };
    if (ib === 3) { spring(0, 1.5, 2.2); spring(Math.PI / 2, -1, 1.6); spring(Math.PI, 2, 1.6); } else spring(0, 1.5);
    fall = null;
    // a few things on the rim so the edge doesn't look bare
    const rim = N / 2 + .55;
    if (!themed) for (const [x, z, t] of [[-rim, -rim + 1, 'pine'], [rim, -rim + 2.5, 'tree'], [-rim, rim - 2, 'bush'], [rim - 1.5, rim, 'rock'], [-rim + 3, -rim, 'bush'], [rim, rim - .5, 'pine']]) {
      const m = itemModel(t); m.position.set(x, -.02, z); m.scale.setScalar(.8); land.add(m);
    } else { // the ground's own props all round the rim, in the look of that Pet Farm island
      const kinds = th.kinds || ['tree', 'bush', 'pine', 'rock', 'bush', 'shroom', 'tree', 'flowers', 'pine', 'bush'], props = new THREE.Group(); let n = 0;
      const w = .78 + ex, hw = w / 2 - .1, box = new THREE.Box3(), mid = new THREE.Vector3(), size = new THREE.Vector3(); // the rim strip: from the lawn's edge to the island's edge
      for (let sd = 0; sd < 4; sd++) for (const t of [-.8, -.3, .22, .74]) {
        const a = sd * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), ox = N / 2 + w / 2, oz = t * (N / 2 + w / 2), x = ox * c - oz * sn, z = ox * sn + oz * c;
        if (sd === 0 && Math.abs(z - 1.5) < 1.3) continue; // the spring
        const kind = kinds[n++ % kinds.length], g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
        if (typeof kind === 'function') { kind(inner, 1.25 + hash(n, 4) * .35); inner.traverse(o => { if (o.isMesh) o.castShadow = true; }); }
        else { const m = itemModel(RIM_ITEM[kind] || 'bush'); m.scale.setScalar(.8); inner.add(m); }
        inner.rotation.y = hash(n, 7) * 6.283; inner.updateMatrixWorld(true);
        box.setFromObject(inner); box.getSize(size); box.getCenter(mid); // shrink anything too wide for the strip, and centre it there
        const k = Math.min(1, hw * 2 / Math.max(size.x, size.z, .01)); inner.scale.setScalar(k); inner.position.set(-mid.x * k, 0, -mid.z * k);
        g.position.set(x, -.02, z); props.add(g);
      }
      bake(props); toonify(props, .05); land.add(props);
      if (lava) { const g = new THREE.Group(), mt = new THREE.MeshBasicMaterial({ color: '#ff7a2a' }); land.add(g);
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + .4, m = new THREE.Mesh(new THREE.CircleGeometry(.28 + hash(i, 3) * .12, 9), mt), r = N / 2 + (.78 + ex) / 2; m.rotation.x = -Math.PI / 2; m.position.set(Math.max(-r, Math.min(r, Math.cos(a) * r * 1.4)), .03, Math.max(-r, Math.min(r, Math.sin(a) * r * 1.4))); m.userData.noInk = true; g.add(m); }
        landTicks.push(T => { const k = .8 + Math.sin(T * 1.6) * .2; mt.color.setRGB(1, .42 * k + .1, .12 * k); }); }
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
    scene.add(land); buildDrift(); placeFlowers();
    const s = N / 2 + 3; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
    cam.dist = Math.min(Math.max(cam.dist, N * 1.6), N * 2.6); cam.gx = cam.gz = 0; cam.follow = cam.back = null; cam.zoom = 0;
  }

  // ---------- items ----------
  const items = new Map(); // id -> { key, g }
  function placeModel(g, type, x, y, r) {
    const [w, h] = footprint(type, r);
    g.position.set(wx(x, w), 0, wz(y, h)); g.rotation.y = -r * Math.PI / 2;
  }
  // A building's level decides how it looks. The farmhouse keeps its level on the farm itself.
  const levelOf = (it, f = farm) => it.type === 'house' ? f?.house || 1 : lvOf(it);
  // A fence's joins, or the Pet Museum's medallions (from the album when the farm has one, else what the server sent).
  const linkOf = (it, f = farm, skip) => PATHS[it.type] ? pathLink(f?.items, it.type, it.x, it.y, it.r, skip) : it.type === 'arch' ? (isDiag(it.r) ? 1 : 0) : it.type === 'garden' ? (it.crop || 'berries') : it.type === 'museum' ? (f?.album ? museumFill(f.album) : it.mu || '00000') : LINKS[it.type] ? fenceLink(f?.items, it.x, it.y, it.r, skip) : 0;
  function syncItems() {
    const seen = new Set();
    for (const it of farm?.items || []) {
      seen.add(it.id);
      const lv = levelOf(it), link = linkOf(it, farm, ghost?.id), key = [it.type, it.x, it.y, it.r, N, lv, link].join();
      let e = items.get(it.id);
      if (e && e.key === key) continue;
      const grew = !!e && e.type === it.type && lv > e.lv; // improved while we watch: the new look pops in with a little party
      if (!e || e.type !== it.type || e.lv !== lv || e.link !== link) { // a fence also changes shape when a neighbour comes or goes
        const held = ['pick', 'hover'].filter(k => marks[k].t?.item === it.id).map(k => [k, marks[k].t]); for (const [k] of held) setMark(k, null);
        if (e) { scene.remove(e.g); disposeModel(e.g); }
        const g = itemModel(it.type, true, false, lv, link), hold = new THREE.Group(); hold.add(g); // hold is placed and popped; g is left to its own animation
        const rejoin = !!e && e.type === it.type && e.lv === lv; // only its joins changed: swap quietly, no pop
        e = { g: hold, m: g, type: it.type, lv, link, top: new THREE.Box3().setFromObject(g).max.y, pop: seenOnce && !rejoin ? 1 : 0, burst: 0, sign: null, st: { on: false, n: 1, burst: 0 } };
        scene.add(hold); items.set(it.id, e);
        for (const [k, t] of held) setMark(k, t);
      }
      e.key = key; placeModel(e.g, it.type, it.x, it.y, it.r);
      if (grew && seenOnce) { const [w, h] = footprint(it.type, it.r); celebrate(e.g.position.x, e.g.position.z, e.top, Math.max(w, h) / 2 + .25); }
    }
    if (farm) seenOnce = true;
    itemStates();
    for (const [id, e] of items) if (!seen.has(id)) { scene.remove(e.g); disposeModel(e.g); items.delete(id); }
    for (const [id, e] of items) e.g.visible = !(ghost && ghost.id === id);
    renderer.shadowMap.needsUpdate = true;
  }

  // What every building is up to, read from the farm: busy, how far along, and whether it wants a sign over it.
  function itemStates() {
    if (!farm) return;
    const mail = (farm.mail?.length || 0) + (farm.trades?.filter(t => t.dir === 'in').length || 0);
    const out = (farm.trips || []).some(t => t.left > 0), back = (farm.trips || []).some(t => t.left <= 0);
    const nests = farm.nests || (farm.nest ? [farm.nest] : []);
    const full = farm.cap && ['wood', 'stone', 'fiber'].some(k => (farm.inv?.[k] || 0) >= farm.cap);
    const canOrder = [farm.orders?.big, ...(farm.orders?.list || [])].some(o => o && !o.done && Object.entries(o.want).every(([k, n]) => (o.got?.[k] || 0) + (farm.inv?.[k] || 0) >= n));
    let firstNest = true, firstGate = true, firstBarn = true;
    const jp = farm.jn && pinned(farm.jn), want = jp?.task?.at; let quest = !!want; // the Farm Journal's pinned task points at its building
    for (const it of farm.items) {
      const e = items.get(it.id); if (!e) continue; let on = false, n = 1, sign = '';
      if (it.type === 'mailbox') { on = mail > 0; if (on) sign = 'mail'; }
      else if (it.type === 'garden') n = farm.garden?.grow?.[it.id] ?? 1;
      else if (it.type === 'yard') on = !!farm.train?.ids?.length;
      else if (it.type === 'nest') { on = nests.some(q => q.stage === 'cuddle'); if (firstNest && nests.some(q => q.stage === 'ready')) sign = 'ready'; firstNest = false; }
      else if (it.type === 'gate') { on = out; if (firstGate && back) sign = 'ready'; firstGate = false; }
      else if (it.type === 'barn') { on = false; if (firstBarn && full) sign = 'ready'; firstBarn = false; }
      else if (it.type === 'board') { if (canOrder) sign = 'ready'; } // an island order can be delivered
      if (!sign && quest && it.type === want) { sign = 'quest'; quest = false; }
      e.st.on = on; e.st.n = n;
      if ((e.sign?.kind || '') !== sign) {
        if (e.sign) { e.g.remove(e.sign.g); disposeModel(e.sign.g); e.sign = null; }
        if (sign) { e.sign = { kind: sign, g: signModel(sign) }; e.g.add(e.sign.g); }
      }
    }
  }
  function moveItems(dt, T) {
    for (const e of items.values()) {
      if (e.burst > 0) e.burst = Math.max(0, e.burst - dt); e.st.burst = e.burst;
      if (e.st.blow) e.st.blow = Math.max(0, e.st.blow - dt * 1.4); // the helper's puff fades unless it keeps blowing
      e.m.userData.tick?.(T, e.st, e.m);
      if (e.pop > 0) { e.pop = Math.max(0, e.pop - dt * 2.4); const u = 1 - e.pop, s = 1 + Math.sin(u * Math.PI * 2.2) * .22 * e.pop; e.g.scale.set(2 - s, s, 2 - s); if (!e.pop) { e.g.scale.setScalar(1); renderer.shadowMap.needsUpdate = true; } } // shadows are drawn once: redo them now it has settled
      if (e.sign) { const s = e.sign.g; s.position.y = e.top + .55 + Math.abs(Math.sin(T * 3)) * .16; s.rotation.y = cam.az - e.g.rotation.y; s.scale.setScalar(1 + Math.sin(T * 6) * .06); }
    }
  }
  // Butterflies that wander over the island.
  const flies = [];
  { const wing = new THREE.PlaneGeometry(.12, .16); wing.translate(.06, 0, 0);
    ['#ffd95a', '#ff9fb8', '#bfe6fb', '#c8a2f2'].forEach((c, i) => {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
      const a = new THREE.Mesh(wing, m), b = new THREE.Mesh(wing, m); b.scale.x = -1; g.add(a, b); scene.add(g); flies.push({ g, a, b, ph: i * 1.7, r: .25 + i * .12 });
    }); }
  function moveFlies(T) {
    for (const f of flies) {
      f.g.visible = !!farm && !starters; if (!f.g.visible) continue;
      const t = T * .22 + f.ph, R = N * f.r, x = Math.sin(t) * R + Math.sin(t * 2.7) * .8, z = Math.cos(t * 1.3 + f.ph) * R;
      f.g.rotation.y = Math.atan2(x - f.g.position.x, z - f.g.position.z) + Math.PI / 2; f.g.position.set(x, 1.3 + Math.sin(t * 5) * .35, z);
      const w = Math.sin(T * 22 + f.ph) * 1.0; f.a.rotation.z = w; f.b.rotation.z = -w; f.a.rotation.x = f.b.rotation.x = -Math.PI / 2;
    }
  }

  // Small things that live for a moment on the farm: dust under paws, sleepy Zs, hearts, sparkles.
  const bits = [];
  const shapeGeo = (pts, depth) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g; };
  const BIT = {
    ball: new THREE.IcosahedronGeometry(1, 1),
    z: shapeGeo([[-1, 1], [1, 1], [1, .6], [-.3, -.6], [1, -.6], [1, -1], [-1, -1], [-1, -.6], [.3, .6], [-1, .6]], .3),
    star: shapeGeo(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? .45 : 1, a = i / 10 * 6.283 + Math.PI / 2; return [Math.cos(a) * r, Math.sin(a) * r]; }), .3),
    heart: shapeGeo(Array.from({ length: 24 }, (_, i) => { const t = i / 24 * 6.283; return [Math.sin(t) ** 3, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; }), .35),
  };
  const BM = { dust: tflat('#efe4cf'), z: new THREE.MeshBasicMaterial({ color: '#6f8fe0' }), star: new THREE.MeshBasicMaterial({ color: '#ffd84a' }), heart: new THREE.MeshBasicMaterial({ color: '#ff6f91' }) };
  function bit(geo, mat, life, upd) { const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m); bits.push({ m, t: 0, life, upd }); }
  function moveBits(dt) { for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t += dt; if (b.t >= b.life) { scene.remove(b.m); bits.splice(i, 1); } else { b.m.visible = true; b.upd(b.m, b.t / b.life, b.t); } } }
  const dustAt = (x, z, n = 2) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, k = .05 + Math.random() * .04; bit(BIT.ball, BM.dust, .45, (m, u) => { m.position.set(x + Math.cos(a) * u * .22, .05 + u * .14, z + Math.sin(a) * u * .22); m.scale.setScalar(k * Math.sin(Math.PI * Math.sqrt(u))); }); } };
  const floatUp = (geo, mat, x, y, z, size, life = 1.4) => { const ph = Math.random() * 6; bit(geo, mat, life, (m, u, t) => { m.position.set(x + Math.sin(t * 3 + ph) * .08 + u * .12, y + u * .55, z); m.rotation.set(0, cam.az, Math.sin(t * 2 + ph) * .25); m.scale.setScalar(size * (.5 + u * .7) * Math.min(1, (1 - u) * 4)); }); };

  // Grass tufts that sway, on every free patch of lawn. One mesh for all of them.
  const TUFTS = 420, tuftGeo = new THREE.BufferGeometry();
  { const v = []; for (const [a, h, w] of [[0, .2, .05], [2.1, .15, .045], [4.2, .17, .05]]) { const c = Math.cos(a), sn = Math.sin(a); v.push(c * .03 - sn * w, 0, sn * .03 + c * w, c * .03 + sn * w, 0, sn * .03 - c * w, c * .09, h, sn * .09); }
    tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); tuftGeo.computeVertexNormals(); }
  const dayMats = []; // unlit bits that should dim with the day: [material, its own colour]
  const dims = m => { dayMats.push([m, m.color.clone()]); return m; };
  const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshBasicMaterial({ color: '#6ab94a', side: THREE.DoubleSide }), TUFTS); tufts.frustumCulled = false; tufts.count = 0; scene.add(tufts);
  let tuftAt = [], flowerAt = [], flowerKey = null, flowerG = null;
  // The lawn flowers grow only where no item stands. Rebuilt (one merged mesh) only when that changes.
  function placeFlowers() {
    if (!land) return;
    const rects = (farm?.items || []).map(it => { const [w, h] = footprint(it.type, it.r); return [it.x - N / 2 - .08, it.y - N / 2 - .08, it.x + w - N / 2 + .08, it.y + h - N / 2 + .08]; });
    const keep = flowerAt.filter(([x, z]) => !rects.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)), key = keep.length + ':' + keep.map(f => f[0].toFixed(2)).join();
    if (key === flowerKey) return; flowerKey = key;
    if (flowerG) { land.remove(flowerG); flowerG.traverse(o => o.geometry?.dispose()); }
    flowerG = new THREE.Group();
    for (const [x, z, pc, mid] of keep) {
      for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.045, 0), pc); m.position.set(x + Math.cos(k * 1.257) * .055, .03, z + Math.sin(k * 1.257) * .055); m.scale.y = .45; flowerG.add(m); }
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(.035, 0), mid); c.position.set(x, .045, z); flowerG.add(c); }
    bake(flowerG); flowerG.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); toonify(flowerG); land.add(flowerG);
  }
  function placeTufts() {
    tuftAt = [];
    const taken = new Uint8Array(N * N); // nothing grows under a building, a path or the training sand
    for (const it of farm?.items || []) { const [w, h] = footprint(it.type, it.r); for (let y = Math.floor(it.y); y < it.y + h; y++) for (let x = Math.floor(it.x); x < it.x + w; x++) if (x >= 0 && y >= 0 && x < N && y < N) taken[y * N + x] = 1; } // small props sit on half tiles
    for (let i = 0; i < TUFTS && tuftAt.length < N * N * .9; i++) {
      const x = (hash(i, 71) - .5) * (N - .3), z = (hash(i, 72) - .5) * (N - .3), tx = Math.floor(x + N / 2), ty = Math.floor(z + N / 2);
      if (taken[ty * N + tx]) continue;
      tuftAt.push([x, z, .7 + hash(i, 73) * .9, hash(i, 74) * 6.283]);
    }
    tufts.count = tuftAt.length;
  }
  const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3();
  function moveTufts(T) {
    tufts.visible = !edit; if (edit) return;
    for (let i = 0; i < tuftAt.length; i++) {
      const [x, z, k, ph] = tuftAt[i]; let bend = (Math.sin(T * (1.6 + air.wind * 2.4) + x * .7 + z * .5) * .16 + Math.sin(T * 3.7 + ph) * .05) * (1 + air.wind * 1.6) + air.wind * .35, bz = 0;
      for (const p of pets.values()) { const dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz; if (d2 < .2) { const w = (1 - d2 / .2) * .8; bend += dx * w * 2; bz += dz * w * 2; } } // pets push the grass aside
      _tm.compose(_tv.set(x, 0, z), _tq.setFromEuler(_te.set(bz, ph, -bend)), _ts.set(k, k, k)); tufts.setMatrixAt(i, _tm);
    }
    tufts.instanceMatrix.needsUpdate = true;
  }
  // ---------- time of day and weather ----------
  // The sky, the light and a few extras follow the hour and the weather set from outside, easing from one to the next.
  // hour, sky tint, horizon and fog, sky light, its strength, sun (or moon) light, its strength, how much night it is
  const NIGHT = ['#141b4d', '#27306a', '#a3b3ff', 1.05, '#b4c2ff', .6, 1], DAY = [SKY_TOP, SKY_LOW, '#ffffff', 1.9, '#ffffff', 1.6, 0];
  const SKYKEYS = [[0, ...NIGHT], [4.6, ...NIGHT], [6.2, '#7fb2ee', '#ffd9c0', '#ffe6d6', 1.6, '#ffc392', 1.3, .2], [8, ...DAY], [17, ...DAY],
    [19, '#6f8ee0', '#ffcfa8', '#ffe0cc', 1.65, '#ffa468', 1.35, .15], [20.6, '#2a2f72', '#5a4f96', '#b9bdf5', 1.2, '#c0c4ff', .75, .8], [21.6, ...NIGHT], [24, ...NIGHT]];
  const WX = { sunny: [1, 1, 1, 0, 0, 0], cloudy: [.8, .92, .62, 0, 0, 0], rain: [.6, .86, .42, 1, .25, 0], wind: [.95, 1, 1, 0, 1, 0], rainbow: [1, 1, 1, 0, 0, 1], aurora: [1, 1, 1, 0, 0, 0, 1] }; // sky dim, light dim, sun dim, rain, wind, rainbow, aurora
  const airTo = { hour: 12, w: 'sunny' }, air = { set: false, tint: new THREE.Color('#ffffff'), low: new THREE.Color(SKY_LOW), hc: new THREE.Color('#ffffff'), hi: 1.9, sc: new THREE.Color('#ffffff'), si: 1.6, night: 0, rain: 0, wind: 0, windT: 0, bow: 0, aur: 0, shade: -1, dim: 1, dusk: 0 };
  const _k1 = new THREE.Color(), _k2 = new THREE.Color(), _grey = new THREE.Color('#8f9bb3');
  const stars = (() => { const n = 240, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = hash(i, 91) * 6.283, e = .12 + hash(i, 92) * 1.35, r = 280; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const grp = new THREE.Group(); grp.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff8d8', size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff6d2', transparent: true, opacity: 0, fog: false, depthWrite: false })); moon.position.set(-110, 150, -190); grp.add(moon);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff6d2', transparent: true, opacity: 0, fog: false, depthWrite: false })); halo.position.copy(moon.position); grp.add(halo);
    grp.visible = false; return grp; })();
  const DROPS = 280, rainPos = new Float32Array(DROPS * 6), rainAt = Array.from({ length: DROPS }, (_, i) => [hash(i, 93), hash(i, 94), hash(i, 95), .8 + hash(i, 96) * .5]);
  const rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#d6ecff', transparent: true, opacity: 0, fog: false, depthWrite: false })); rain.geometry.setAttribute('position', new THREE.BufferAttribute(rainPos, 3)); rain.frustumCulled = false; rain.visible = false;
  const bow = skyBow(), aurora = skyAurora(); // part of the sky, the same rainbow as the hub and the minigames (weather3d.js)
  // a warm pool of light on the grass round anything that glows, once it gets dark
  const GLOWS = { lamp: 1.5, campfire: 1.7, glow: 1.2, lighthouse: 1.6 }; // buildings light their windows instead (WINDOW in models.js)
  const glowGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2); { const p = glowGeo.attributes.position, c = []; for (let i = 0; i < p.count; i++) { const v = Math.pow(Math.max(0, 1 - Math.hypot(p.getX(i), p.getZ(i))), 1) ; c.push(v, v, v); } glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); } // bright in the middle, fading to nothing
  const glows = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ color: '#ffb85a', vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 28);
  glows.frustumCulled = false; glows.count = 0; glows.renderOrder = 2; scene.add(stars, rain, bow, aurora, glows);
  dims(tufts.material);
  function moveAir(dt, T, map = false) {
    // where the sky should be for this hour and weather
    const h = ((airTo.hour % 24) + 24) % 24; let i = 0; while (i < SKYKEYS.length - 2 && SKYKEYS[i + 1][0] <= h) i++;
    const A = SKYKEYS[i], B = SKYKEYS[i + 1], u = Math.min(1, Math.max(0, (h - A[0]) / Math.max(.001, B[0] - A[0]))), mix = (a, b) => a + (b - a) * u, wx = WX[airTo.w] || WX.sunny;
    const k = air.set ? Math.min(1, dt * 1.2) : 1; air.set = true;
    _k1.set(A[1]).lerp(_k2.set(B[1]), u).lerp(_grey, 1 - wx[0]); air.tint.lerp(_k1, k);
    _k1.set(A[2]).lerp(_k2.set(B[2]), u); _k1.lerp(_k2.copy(_grey).lerp(_k1, .45), 1 - wx[0]); air.low.lerp(_k1, k);
    _k1.set(A[3]).lerp(_k2.set(B[3]), u); air.hc.lerp(_k1, k); air.hi += (mix(A[4], B[4]) * wx[1] - air.hi) * k;
    _k1.set(A[5]).lerp(_k2.set(B[5]), u); air.sc.lerp(_k1, k); air.si += (mix(A[6], B[6]) * wx[2] - air.si) * k;
    air.night += (mix(A[7], B[7]) - air.night) * k; air.dim += (wx[0] - air.dim) * k; air.dusk += (Math.max(0, 1 - Math.min(Math.abs(h - 19.6), Math.abs(h - 5.8)) / 1.6) - air.dusk) * k; air.rain += (wx[3] - air.rain) * k; air.bow += (wx[5] - air.bow) * k; air.aur += ((wx[6] || 0) - air.aur) * k;
    const gust = wx[4] * (.75 + Math.sin(T * .7) * .25 + Math.sin(T * 2.3) * .12); air.wind += (gust - air.wind) * Math.min(1, dt * 2); air.windT += (wx[4] - air.windT) * k;
    for (const [sc, hm, sn] of [[scene, hemi, sun], [world, whemi, wsun]]) { sc.background.copy(air.low); sc.fog.color.copy(air.low); hm.color.copy(air.hc); hm.intensity = air.hi; sn.color.copy(air.sc); sn.intensity = air.si; }
    const sk = air.tint.getHex() * 7 + air.low.getHex(); if (sk !== air.sk) { air.sk = sk; const p = skyGeo.attributes.position, c = skyGeo.attributes.color; for (let v = 0; v < p.count; v++) { _k1.copy(air.low).lerp(air.tint, Math.min(1, Math.max(0, p.getY(v) / 300 * 1.6 + .25))); c.setXYZ(v, _k1.r, _k1.g, _k1.b); } c.needsUpdate = true; }
    const amb = Math.min(1, air.hi / 1.9 + .12); if (Math.abs(amb - air.shade) > .004) { air.shade = amb; for (const [m, c] of dayMats) m.color.copy(c).multiplyScalar(amb); }
    if (map) return;
    const starry = air.night * (1 - (1 - wx[0]) * 1.6); stars.visible = starry > .02;
    if (stars.visible) { stars.children[0].material.opacity = starry * (.8 + Math.sin(T * 1.7) * .08); stars.children[1].material.opacity = starry; stars.children[2].material.opacity = starry * .16; stars.rotation.y = T * .003; }
    rain.visible = air.rain > .02;
    if (rain.visible) { // streaks falling through a box that follows the view
      rain.material.opacity = air.rain * .5; const span = N + 10, top = 11;
      for (let d = 0; d < DROPS; d++) { const [rx, ry, rz, sp] = rainAt[d], y = top - ((T * 13 * sp + ry * top) % top), x = cam.tx + (rx - .5) * span - (top - y) * .12, z = cam.tz + (rz - .5) * span, o = d * 6;
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + .06; rainPos[o + 4] = y + .5; rainPos[o + 5] = z; }
      rain.geometry.attributes.position.needsUpdate = true;
      if (farm && !starters && Math.random() < dt * 14 * air.rain) { const x = (Math.random() - .5) * N, z = (Math.random() - .5) * N; bit(BIT.ball, BM2.drop, .35, (m, v) => { m.position.set(x, .04, z); m.scale.set(.05 + v * .16, .012, .05 + v * .16); }); }
    }
    bow.visible = air.bow > .02 && !starters; if (bow.visible) bow.place(camera, air.bow * .7 * (1 - air.night * .65)); // fixed in the sky, carried along as the camera moves
    aurora.visible = air.aur > .02 && !starters; if (aurora.visible) aurora.place(camera, air.aur * (.3 + .6 * air.night), T); // the winter-night aurora (weather.js), the same as everywhere
    WINDOW.emissiveIntensity = Math.min(1, air.night * 1.4) * (.92 + Math.sin(T * 2.3) * .05);
    let n = 0; const lit = air.night > .08 && farm && !starters;
    if (lit) for (const e of items.values()) { const r = GLOWS[e.type]; if (!r || n >= 28) continue; _tm.compose(_tv.set(e.g.position.x, .03, e.g.position.z), _tq.identity(), _ts.set(r, 1, r).multiplyScalar(1 + Math.sin(T * 3 + n) * .03)); glows.setMatrixAt(n++, _tm); }
    glows.count = n; if (n) { glows.instanceMatrix.needsUpdate = true; glows.material.opacity = air.night * .55; }
  }
  // Petals and leaves drifting over the island on the breeze, and a few birds far off.
  const petals = [];
  { const g = new THREE.OctahedronGeometry(1, 0).scale(.5, .08, 1);
    ['#ffc1dc', '#ffffff', '#a8e08a', '#ffd9ea', '#ffe9a8', '#c9f0a8', '#ffc1dc', '#ffffff'].forEach((c, i) => { const m = new THREE.Mesh(g, dims(new THREE.MeshBasicMaterial({ color: c }))); scene.add(m); petals.push({ m, ph: i * 2.37, sp: .5 + hash(i, 81) * .5 }); }); }
  function movePetals(T) {
    const span = N + 8;
    for (const p of petals) {
      p.m.visible = !!farm && !starters; if (!p.m.visible) continue;
      const pt = T * (1 + air.windT * 2.2), u = ((pt * p.sp * .09 + p.ph * .13) % 1 + 1) % 1, lane = Math.floor(pt * p.sp * .09 + p.ph * .13);
      p.m.position.set(-span / 2 + u * span + Math.sin(T * 1.1 + p.ph) * .5, 3.2 - u * 2.9 + Math.sin(T * 2.3 + p.ph) * .25, (hash(lane, p.ph) - .5) * N + Math.sin(T * .8 + p.ph) * .6);
      p.m.rotation.set(T * 2.1 + p.ph, T * 1.3, Math.sin(T * 3 + p.ph)); p.m.scale.setScalar(.09 * Math.min(1, u * 8, (1 - u) * 8));
    }
  }
  function makeBirds(parent, R, y, n = 3, size = 1) {
    const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.12, 0, 0, .12, .5, 0, 0], 3));
    const mt = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, fog: false }), list = [];
    for (let i = 0; i < n; i++) { const g = new THREE.Group(), a = new THREE.Mesh(wing, mt), b = new THREE.Mesh(wing, mt); b.scale.x = -1; g.add(a, b); g.scale.setScalar(size); parent.add(g); list.push({ g, a, b, ph: i * 2.1 }); }
    return T => { for (const b of list) { const t = T * .12 + b.ph, r = R * (1 + Math.sin(b.ph * 3) * .2), x = Math.cos(t) * r, z = Math.sin(t) * r; b.g.position.set(x, y + Math.sin(t * 3 + b.ph) * 1.2, z); b.g.rotation.y = -t; const w = Math.sin(T * 7 + b.ph * 5) * .7; b.a.rotation.z = w; b.b.rotation.z = -w; } };
  }
  const farmBirds = makeBirds(scene, 15, 6.5, 4, 1.1);

  // ---------- pets ----------
  const pets = new Map(); // id -> { g, x, z, path, wait, hop, seed, blob }
  const blobGeo = new THREE.CircleGeometry(.3, 10), blobMat = new THREE.MeshBasicMaterial({ color: '#23401c', transparent: true, opacity: .28, depthWrite: false });
  // Where pets may walk. Pets step between the middles of half tiles (M = 2 N a side), so they can squeeze past half-tile
  // fences and buildings; a half tile with anything solid on any part of it is out (walkGrid). occ keeps, for every quarter
  // tile, which item stands there (its index in occItems + 1), so helpers' spots and hops can be checked against the real shapes.
  let walkGrid = new Uint8Array(400), M = 20, occ = new Int32Array(1600), occItems = [];
  const QT = 4; // quarter tiles a tile (C in data.js)
  function buildGrids() {
    const m = N * QT; occ = new Int32Array(m * m); occItems = farm.items; M = N * 2; walkGrid = new Uint8Array(M * M);
    occItems.forEach((it, k) => {
      if (!ITEMS[it.type] || ITEMS[it.type].walk) return;
      const c = cellsOf(it.type, it.x, it.y, it.r);
      for (let i = 0; i < c.length; i += 2) { const x = c[i], y = c[i + 1]; if (x >= 0 && y >= 0 && x < m && y < m) { occ[y * m + x] = k + 1; walkGrid[(y >> 1) * M + (x >> 1)] = 1; } }
    });
  }
  const hx = i => (i + .5) / 2 - N / 2; // the middle of half tile i, in the world
  const cellAt = (x, z) => [Math.max(0, Math.min(M - 1, Math.floor((x + N / 2) * 2))), Math.max(0, Math.min(M - 1, Math.floor((z + N / 2) * 2)))];
  // Is the ground at (x, z) taken by something solid (other than the item with id skip), or off the island?
  const solidAt = (x, z, skip = null) => { const m = N * QT, i = Math.floor((x + N / 2) * QT), j = Math.floor((z + N / 2) * QT); if (i < 0 || j < 0 || i >= m || j >= m) return true; const v = occ[j * m + i]; return !!v && occItems[v - 1]?.id !== skip; };
  // Room for a pet's body round (x, z): the point itself and a ring round it.
  const roomAt = (x, z, r = .21, skip = null) => { if (solidAt(x, z, skip)) return false; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (solidAt(x + Math.cos(a) * r, z + Math.sin(a) * r, skip)) return false; } return true; };
  // A straight line on the ground with nothing in the way (skip: the thing it leads to).
  const lineClear = (x0, z0, x1, z1, skip = null) => { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / .08); for (let k = 1; k < n; k++) if (solidAt(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, skip)) return false; return true; };
  // Breadth-first over free half tiles from where a pet is: prev links (for paths) and the list of cells reached, nearest first.
  function reachFrom(p, max = 255) {
    const [sx, sy] = cellAt(p.x, p.z), start = sy * M + sx, prev = new Int32Array(M * M).fill(-1), dist = new Uint16Array(M * M), q = [start];
    prev[start] = start;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], cx = c % M, cy = c / M | 0;
      if (dist[c] >= max) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, y = cy + dy, n = y * M + x;
        if (x < 0 || y < 0 || x >= M || y >= M || prev[n] >= 0 || walkGrid[n]) continue;
        prev[n] = c; dist[n] = dist[c] + 1; q.push(n);
      }
    }
    return { start, prev, dist, q };
  }
  const pathTo = (R, c) => { const path = []; while (c !== R.start && c >= 0) { path.unshift([c % M, c / M | 0]); c = R.prev[c]; } return path; };
  // The way to a spot that is not on the walking grid (a helper's place, a spot in the Nest or the Training Yard): along free half
  // tiles to the one nearest it that has a clear line to it (skip: the item the spot is on). If none has, the pet leaps the last bit.
  function routeTo(p, x, z, skip = null) {
    const R = reachFrom(p); let best = -1, bd = 1e9, clear = false;
    for (const c of R.q) { const cx = hx(c % M), cz = hx(c / M | 0), d = Math.hypot(cx - x, cz - z) + R.dist[c] * .01, ok = d < 1.6 && lineClear(cx, cz, x, z, skip);
      if ((ok && !clear) || (ok === clear && d < bd)) { best = c; bd = d; clear = ok; } }
    return { via: best >= 0 ? pathTo(R, best) : [], leap: !clear };
  }
  // Sets where a pet is headed (p.train or p.nest) and works out the way there, keeping the old way if the spot is the same.
  function headTo(p, t, old, skip = null) {
    if (old && Math.abs(old.x - t.x) < .01 && Math.abs(old.z - t.z) < .01 && old.via && !old.via.some(([x, y]) => walkGrid[y * M + x])) { t.via = old.via; t.leap = old.leap; t.l0 = old.l0; return t; }
    const near = Math.hypot(p.x - t.x, p.z - t.z) < .06; if (near) { t.via = []; return t; }
    Object.assign(t, routeTo(p, t.x, t.z, skip)); return t;
  }
  const heartGeo = new THREE.OctahedronGeometry(.12, 0), heartMat = toonMat(new THREE.MeshStandardMaterial({ color: '#ff6f91', emissive: '#ff6f91', emissiveIntensity: .45 }));
  const PET_SIZE = .42;
  // Pictures of single models are drawn by the island's own renderer into a small off-screen target and read back. A second
  // renderer (as before) has its own GL context, so it had to build every shader again, which on browsers without background
  // compiling (Firefox) stuttered the first seconds after the island showed. The little scene is set up like the island
  // (same lights, a shadow-casting sun, fog) and the target writes the same colours as the screen, so the shaders the island
  // already built are reused as they are.
  const shots = new Map(); let shotT = null, shotS = null, shotC = null, shotBuf = null, shotCv = null; const shotClear = new THREE.Color();
  function photo(g, pet, size) {
    try {
      const sm = renderer.shadowMap, pending = sm.needsUpdate;
      let first = false;
      if (!shotS) {
        first = true;
        shotS = new THREE.Scene(); shotS.fog = new THREE.Fog('#ffffff', 1e4, 2e4); shotC = new THREE.PerspectiveCamera(30, 1, .1, 50);
        shotS.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9)); const l = new THREE.DirectionalLight('#ffffff', 1.6); l.position.set(3, 6, 4);
        l.castShadow = true; l.shadow.mapSize.set(16, 16); shotS.add(l, l.target); // its shadow map is drawn once, empty: nothing in the pictures is shaded by it
        shotCv = document.createElement('canvas');
      }
      if (!shotT || shotT.width !== size) {
        shotT?.dispose(); shotT = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
        shotT.isXRRenderTarget = true; shotT.texture.colorSpace = THREE.SRGBColorSpace; shotT.texture.internalFormat = 'RGBA8'; // stores screen colours as they are, so the island's shaders fit (three.js keys a shader's output colour on this)
        shotBuf = new Uint8Array(size * size * 4); shotCv.width = shotCv.height = size;
      }
      shotS.add(g);
      const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() / 2;
      const d = rad / Math.sin(15 * Math.PI / 180) * (pet ? .78 : 1.02);
      shotC.position.set(ctr.x + d * .5, ctr.y + d * .42, ctr.z + d * .75); shotC.lookAt(ctr);
      const was = renderer.getRenderTarget(), cc = renderer.getClearColor(shotClear), ca = renderer.getClearAlpha();
      if (first) { shotS.remove(g); sm.needsUpdate = true; renderer.setRenderTarget(shotT); renderer.render(shotS, shotC); shotS.add(g); } // the empty shadow map
      sm.needsUpdate = false; // the island's own shadow update (if one is due) stays for its next frame
      renderer.setRenderTarget(shotT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(shotS, shotC);
      renderer.setRenderTarget(was); renderer.setClearColor(cc, ca); sm.needsUpdate = pending;
      shotS.remove(g);
      renderer.readRenderTargetPixels(shotT, 0, 0, size, size, shotBuf);
      // GL rows run bottom up, and the edges come out premultiplied by their coverage
      const cx = shotCv.getContext('2d'), img = cx.createImageData(size, size), o = img.data, row = size * 4;
      for (let y = 0; y < size; y++) {
        const src = (size - 1 - y) * row, dst = y * row;
        for (let i = 0; i < row; i += 4) {
          const a = shotBuf[src + i + 3]; if (!a) continue;
          const k = a === 255 ? 1 : 255 / a;
          o[dst + i] = Math.min(255, shotBuf[src + i] * k); o[dst + i + 1] = Math.min(255, shotBuf[src + i + 1] * k); o[dst + i + 2] = Math.min(255, shotBuf[src + i + 2] * k); o[dst + i + 3] = a;
        }
      }
      cx.putImageData(img, 0, 0); return shotCv.toDataURL('image/png');
    } catch (e) { console.warn('no picture', e); return null; }
  }
  const lookKey = l => l ? JSON.stringify(l) : '';
  function addPet(id, sp, form, x, z, look = null) {
    const g = petModel(sp, form, look); g.scale.multiplyScalar(PET_SIZE); g.userData.base = g.scale.x;
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = .015;
    scene.add(g, blob);
    const p = { g, blob, x, z, path: [], wait: 1 + Math.random() * 2, hop: 0, seed: Math.random() * 10, key: sp + form + lookKey(look), face: 0 };
    const bb = new THREE.Box3().setFromObject(g); p.reach = Math.max(.15, bb.max.z); // how far its nose (or drill, or beak) sticks out in front of its middle
    pets.set(id, p); return p;
  }
  function dropPet(id) { const p = pets.get(id); if (!p) return; endUse(p); if (p.heart) scene.remove(p.heart); scene.remove(p.g, p.blob); disposeModel(p.g); pets.delete(id); }
  const tileOf = p => cellAt(p.x, p.z);
  // The free half tile nearest a point in the world (its middle, in the world), or null.
  function freeSpotNear(px, pz) {
    let best = null, bd = 1e9;
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) if (!walkGrid[y * M + x]) { const d = (hx(x) - px) ** 2 + (hx(y) - pz) ** 2 + Math.random() * .1; if (d < bd) { bd = d; best = [hx(x), hx(y)]; } }
    return best;
  }
  function syncPets() {
    if (!farm) { for (const id of [...pets.keys()]) if (!String(id).startsWith('starter:')) dropPet(id); return; }
    buildGrids();
    const seen = new Set();
    const house = farm.items.find(i => i.type === 'house'), yard = farm.items.find(i => i.type === 'yard');
    const nestItem = farm.items.find(i => i.type === 'nest'), nestsNow = (farm.nests || (farm.nest ? [farm.nest] : [])).filter(Boolean);
    for (const pet of farm.pets) {
      if ((farm.trips || (farm.trip ? [farm.trip] : [])).some(t => t.pets?.includes(pet.id))) continue; // away on an expedition (a visited farm lists its trips without the pets: those are left out already)
      if (pet.lodge) continue; // stored in the Pet Lodge: indoors, not on the island
      seen.add(pet.id);
      const form = formOf(pet.lv);
      let p = pets.get(pet.id);
      if (p && p.key !== pet.sp + form + lookKey(pet.look)) { dropPet(pet.id); p = null; }
      if (!p) {
        const t = freeSpotNear(house ? wx(house.x + 1) : 0, house ? wz(house.y + 3) : 0) || [0, 0];
        p = addPet(pet.id, pet.sp, form, t[0], t[1], pet.look);
      }
      p.open = !!pet.open;
      // in training: it has a spot of its own at the Training Yard and stays there
      const ti = yard ? (farm.train?.ids || []).indexOf(pet.id) : -1;
      if (ti >= 0) {
        const [lx, lz, f] = [[-.15, -.2, -Math.PI / 2], [.7, .62, Math.PI], [.35, -.55, -Math.PI / 2]][ti % 3], [w, h] = footprint('yard', yard.r), a = -yard.r * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
        p.train = headTo(p, { x: wx(yard.x, w) + lx * c + lz * sn, z: wz(yard.y, h) - lx * sn + lz * c, face: f + a, k: ti }, p.train, yard.id); p.path = []; continue;
      }
      // a helper stands in front of the building it works at and keeps busy there
      const wk = Object.keys(farm.work || {}).find(k => farm.work[k] === pet.id), wi = wk && farm.items.find(i => i.type === wk);
      if (wi) { // the Garden helper goes from plot to plot; everyone else stays at the one building
        const all = wk === 'garden' ? farm.items.filter(i => i.type === 'garden') : [wi], at = all[(p.wi || 0) % all.length], [w, h] = footprint(wk, at.r), bx = wx(at.x, w), bz = wz(at.y, h);
        if (p.train?.job !== wk) p.wt = 0;
        p.train = headTo(p, { ...(hearthBy(at, w, h, wk, p.reach) || standBy(at, w, h, p)), k: 2, job: wk, bx, bz, n: all.length, id: at.id }, p.train); p.path = []; continue;
      }
      p.train = null;
      // at the Nest: the pair cuddle up inside it; once the egg is there, one of them keeps it warm
      const ni = nestItem ? nestsNow.findIndex(n => (n.a === pet.id || n.b === pet.id) && (n.stage === 'cuddle' || n.a === pet.id)) : -1;
      if (ni >= 0) {
        const n = nestsNow[ni], [w, h] = footprint('nest', nestItem.r), cx = wx(nestItem.x, w), cz = wz(nestItem.y, h), sd = n.a === pet.id ? -1 : 1, egg = n.stage !== 'cuddle', off = ni ? .32 : 0;
        p.nest = headTo(p, egg ? { x: cx + .46, z: cz + .1 + off, y: .16, face: -Math.PI / 2, egg: true, sd: 0 } : { x: cx + sd * .21, z: cz + .05 + (ni ? -.3 : nestsNow.length > 1 ? .22 : 0), y: .16, face: sd * -.35, sd }, p.nest, nestItem.id);
        p.path = []; endUse(p); p.act = null; continue;
      }
      p.nest = null;
      // standing where something was just built: step aside
      const [tx, ty] = tileOf(p);
      if (walkGrid[ty * M + tx] && !roomAt(p.x, p.z)) { const t = freeSpotNear(p.x, p.z); if (t) { p.x = t[0]; p.z = t[1]; } p.path = []; }
      else { const cut = p.path.findIndex(([x, y]) => walkGrid[y * M + x]); if (cut >= 0) p.path.length = cut; }
    }
    for (const id of [...pets.keys()]) if (!seen.has(id)) dropPet(id);
  }
  // A short stroll: breadth-first over free tiles, then walk to a random one nearby.
  // want: the id of something it has been called over to (friends joining a carousel ride).
  function stroll(p, want = null) {
    const R = reachFrom(p, 22), { start, q } = R, reach = q.filter(n => R.dist[n] >= 4 && R.dist[n] <= 14); // half tiles: 2 to 7 tiles away
    if (!reach.length) return;
    let c = reach[Math.random() * reach.length | 0];
    p.goal = null;
    if (farm && !starters && (want !== null || Math.random() < .55)) { // pick a building or decoration that is free, and the closest tile to it that can be walked to
      const list = farm.items.filter(it => USE[it.type] && items.get(it.id) && !taken(items.get(it.id)) && (want === null || it.id === want)).flatMap(it => ROUTES[it.type] ? Array(lvOf(it)).fill(it) : [it]); // an improved toy is picked more often
      for (let tries = 0; tries < 4 && list.length && !p.goal; tries++) {
        const it = list[Math.random() * list.length | 0], e = items.get(it.id), [w, h] = footprint(it.type, it.r), gx = e.g.position.x, gz = e.g.position.z, lim = Math.max(w, h) / 2 + 1.05;
        let best = -1, bd = 1e9;
        for (const n of q) { if (n === start) continue; const nx = hx(n % M), nz = hx(n / M | 0), d = Math.hypot(nx - gx, nz - gz); if (d < bd && d <= lim && lineClear(nx, nz, gx, gz, it.id)) { bd = d; best = n; } } // with nothing (a fence) between it and the thing
        if (best >= 0 && bd <= lim) { c = best; p.goal = { id: it.id, type: it.type, key: e.key }; }
      }
    }
    p.path = pathTo(R, c);
  }
  // What a pet does at each building or decoration, and for about how many seconds.
  const USE = { house: ['nap', 9], hut: ['nap', 9], treehouse: ['nap', 9], tree: ['nap', 8], pine: ['nap', 8], cherry: ['nap', 8], gazebo: ['nap', 8],
    gate: ['look', 3.5], workshop: ['look', 3], windmill: ['look', 3.5], lighthouse: ['look', 3.5], lamp: ['look', 3], glow: ['look', 3], statue: ['look', 3], barn: ['look', 3],
    flag: ['cheer', 2.4], mailbox: ['cheer', 2.4], rainbow: ['cheer', 2.4], arch: ['cheer', 2.4], kitchen: ['beg', 3.5], nest: ['peek', 3.5], scarecrow: ['hug', 2.6],
    garden: ['sniff', 4], flowers: ['sniff', 3.5], bush: ['sniff', 3.5], shrooms: ['dance', 4.5],
    pond: ['soak', 9], hotspring: ['soak', 11], fountain: ['drink', 4], birdbath: ['drink', 3.5], well: ['drink', 4],
    bench: ['sit', 8], palbench: ['sit', 8], picnic: ['sit', 8], campfire: ['warm', 9],
    tower: ['perch', 8], haybale: ['perch', 7], rock: ['perch', 7], swing: ['swing', 9], ball: ['play', 3.5],
    // the lucky set from the Lucky Wheel
    clover: ['sniff', 3.5], carousel: ['ride', 14], chest: ['look', 3], goldpet: ['look', 3.5], balloon: ['look', 3.5], coinfount: ['drink', 4], horseshoe: ['cheer', 2.4], miniwheel: ['cheer', 2.6] };
  const HOP = .45; // seconds for a hop onto, between and off the stops of an improved decoration
  const SEAT = { bench: .24, palbench: .24, picnic: .04, pond: -.1, hotspring: -.12 }; // how high a pet sits on or in something
  const BM2 = { drop: new THREE.MeshBasicMaterial({ color: '#7cc8ff' }), steam: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .7 }) };
  // A building just got better: confetti and stars burst from it, and dust puffs out round its foot.
  const BMC = ['#ffd84a', '#ff8fb1', '#7fd3ff', '#9be27a', '#ffffff'].map(c => new THREE.MeshBasicMaterial({ color: c })), CONF = new THREE.BoxGeometry(1, 1, .25);
  function celebrate(x, z, top, r) {
    const R = Math.random;
    for (let i = 0; i < 30; i++) { const a = R() * 6.283, v = .7 + R() * 1.5, vy = 2 + R() * 2.2, k = .05 + R() * .05, star = i % 3 === 0, sp = 4 + R() * 6, y0 = top * (.45 + R() * .4);
      bit(star ? BIT.star : CONF, BMC[i % 5], 1.1 + R() * .5, (m, u, t) => { m.position.set(x + Math.cos(a) * v * t, y0 + vy * t - 3.4 * t * t, z + Math.sin(a) * v * t); if (star) m.rotation.set(0, cam.az, t * sp); else m.rotation.set(t * sp, t * sp * .7, a); m.scale.setScalar((star ? k * 1.7 : k * 1.3) * Math.min(1, u * 12, (1 - u) * 3)); }); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + R() * .4; floatUp(BIT.star, BM.star, x + Math.cos(a) * r * .8, top * (.2 + R() * .6), z + Math.sin(a) * r * .8, .09, 1.3 + R() * .6); }
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; dustAt(x + Math.cos(a) * r, z + Math.sin(a) * r, 1); }
  }
  // Helpers at work: each job has its own little routine and its own particles.
  const BMW = { leaf: new THREE.MeshBasicMaterial({ color: '#6cc24f' }), leaf2: new THREE.MeshBasicMaterial({ color: '#a6e06a' }), pebble: tflat('#9a9088'), spark: new THREE.MeshBasicMaterial({ color: '#ffe14a' }), ember: new THREE.MeshBasicMaterial({ color: '#ff8a3c' }), ember2: new THREE.MeshBasicMaterial({ color: '#ffd35a' }), sprout: new THREE.MeshBasicMaterial({ color: '#b6f08a' }) };
  // Where a helper stands: next to the building, with room for its body (nothing solid under or round it: other buildings,
  // decorations, fences), tried from the building's front round to its back, close in first. A spot the pet can walk to wins;
  // with none, one it can leap to over a fence; with no room anywhere round it, the free half tile nearest the front.
  const standBy = (at, w, h, p = null) => { const bx = wx(at.x, w), bz = wz(at.y, h), a = -(at.r || 0) * Math.PI / 2, R = p && reachFrom(p);
    const fromEdge = th => { const s = Math.abs(Math.sin(th)), c = Math.abs(Math.cos(th)); return Math.min(s > 1e-6 ? w / 2 / s : 1e9, c > 1e-6 ? h / 2 / c : 1e9); };
    let leap = null;
    const d0 = Math.max(.3, (p?.reach || .25) + .08); // its nose stays short of the wall, whatever its size
    for (const d of [d0, d0 + .18, d0 + .4, d0 + .65]) for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8]) {
      const th = a + k * Math.PI / 8, r = fromEdge(th) + d, x = bx + Math.sin(th) * r, z = bz + Math.cos(th) * r;
      if (!roomAt(x, z)) continue;
      const s = { x, z, face: Math.atan2(bx - x, bz - z) }, [cx, cy] = cellAt(x, z);
      if (!R || R.prev[cy * M + cx] >= 0) return s;
      leap ||= s;
    }
    if (leap) return leap;
    const f = freeSpotNear(bx + Math.sin(a) * (h / 2 + .4), bz + Math.cos(a) * (h / 2 + .4)) || [bx, bz + h / 2 + .35];
    return { x: f[0], z: f[1], face: Math.atan2(bx - f[0], bz - f[1]) }; };
  // A building with a hearth (the Kitchen): the helper stands on the flat stone in front of the fire's mouth, its nose a little short of it whatever its size, and faces it,
  // turned with the building. If something blocks that tile it falls back to the usual spot (and fans from there).
  const hearthBy = (at, w, h, type, reach = .3) => { const hp = HEARTH[type]; if (!hp) return null;
    const a = -at.r * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), bx = wx(at.x, w), bz = wz(at.y, h), to = (lx, lz) => [bx + lx * c + lz * sn, bz - lx * sn + lz * c];
    const [x, z] = to(hp[0], hp[1] + .1 + reach), [mx, mz] = to(hp[0], hp[1] - .08);
    if (!roomAt(x, z)) return null;
    return { x, z, face: Math.PI + a, mx, mz }; };
  function workPose(p, t, dt, o) {
    const u = (p.wt = (p.wt || 0) + dt), R = Math.random, every = (key, sec) => (p[key] = (p[key] ?? R() * sec) - dt) <= 0 && ((p[key] = sec), true);
    const once = (key, c, at) => { if (c < at) p[key] = false; else if (!p[key]) return (p[key] = true); return false; };
    if (t.job === 'garden') { // tips forward and pours: drops arc onto the soil, the plot splashes and sprouts sparkle; then on to the next plot
      const c = u % 6.5, pour = Math.min(1, c * 3, Math.max(0, (5 - c) * 3));
      o.pitch = (.3 + Math.sin(u * 5) * .04) * pour; o.tilt = Math.sin(u * 2.4) * .06 * pour; o.sit = .05 * pour;
      if (pour > .9) {
        if (every('w1', .08)) { const jx = (R() - .5) * .5, jz = (R() - .5) * .5, x0 = p.x + Math.sin(t.face) * .22, z0 = p.z + Math.cos(t.face) * .22; bit(BIT.ball, BM2.drop, .5, (m, v) => { m.position.set(x0 + (t.bx + jx - x0) * v, .42 * (1 - v) + .08 + Math.sin(v * Math.PI) * .28, z0 + (t.bz + jz - z0) * v); m.scale.setScalar(.055 * (1 - v * .4)); }); }
        if (every('w2', .45)) splash(t.bx + (R() - .5) * .4, .1, t.bz + (R() - .5) * .4, 2);
        if (every('w3', 1.3)) floatUp(BIT.star, BMW.sprout, t.bx + (R() - .5) * .5, .2, t.bz + (R() - .5) * .5, .05, 1.2);
      }
      if (once('w4', c, 5.6)) { if (t.n > 1) { p.wi = (p.wi || 0) + 1; const g = farm?.items.filter(i => i.type === 'garden') || [], at = g[p.wi % g.length]; if (at) { const [w, h] = footprint('garden', at.r); Object.assign(t, standBy(at, w, h, p), { bx: wx(at.x, w), bz: wz(at.y, h), id: at.id }); Object.assign(t, routeTo(p, t.x, t.z), { l0: 0 }); } } else p.hop = .6; }
    } else if (t.job === 'nest') { // rocks from side to side like a lullaby: leaves spiral up round the Nest, and a heart now and then
      o.tilt = Math.sin(u * 1.7) * .17; o.up = Math.abs(Math.sin(u * 1.7)) * .04; o.turn = Math.sin(u * .85) * .15;
      if (every('w1', .4)) { const a0 = R() * 6.283, r0 = .7 + R() * .3, mat = R() < .5 ? BMW.leaf : BMW.leaf2; bit(BIT.ball, mat, 2.4, (m, v, tt) => { const a = a0 + tt * 1.7, r = r0 * (1 - v * .35); m.position.set(t.bx + Math.cos(a) * r, .2 + v * 1.15 + Math.sin(tt * 5 + a0) * .04, t.bz + Math.sin(a) * r); m.rotation.set(tt * 3, a, tt * 2); const k = Math.min(1, v * 8, (1 - v) * 4); m.scale.set(.12 * k, .022 * k, .07 * k); }); }
      if (every('w2', 3.6)) floatUp(BIT.heart, BM.heart, t.bx + (R() - .5) * .3, .7, t.bz, .07, 1.7);
    } else if (t.job === 'yard') { // a coach's stomp: crouch, jump, land in a ring of dust and pebbles, then a firm nod
      const c = u % 2.6;
      if (c < .45) o.sit = .2 * Math.sin(c / .45 * Math.PI / 2);
      else if (c < 1) { const j = (c - .45) / .55; o.up = Math.sin(j * Math.PI) * .5; o.pitch = -.15 * Math.sin(j * Math.PI); }
      else { const d = c - 1; o.sit = .16 * Math.max(0, 1 - d * 5); o.pitch = Math.max(0, Math.sin(d * 9)) * .2 * Math.max(0, 1 - d * .9); }
      if (once('w1', c, 1)) { dustAt(p.x, p.z, 6); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + R(), v = .7 + R() * .6, k = .045 + R() * .03; bit(BIT.ball, BMW.pebble, .6, (m, w, tt) => { m.position.set(p.x + Math.cos(a) * tt * v, .05 + tt * 1.9 - tt * tt * 4.4, p.z + Math.sin(a) * tt * v); m.rotation.set(tt * 9, tt * 7, 0); m.scale.setScalar(k * (1 - w * .5)); }); } }
    } else if (t.job === 'gate') { // spins itself up, crackling, then sends a bolt up to the balloon
      const c = u % 3.4;
      if (c < 1.8) { const q = c / 1.8; o.turn = Math.PI * 6 * q * q; o.up = q * .06;
        if (every('w1', .16 - q * .09)) { const a = R() * 6.283, y0 = .2 + R() * .5, r = .32 + R() * .1; bit(BIT.star, BMW.spark, .32, (m, v) => { m.position.set(p.x + Math.cos(a + v * 3) * r, y0 + v * .2, p.z + Math.sin(a + v * 3) * r); m.rotation.set(0, cam.az, v * 5); m.scale.setScalar(.075 * Math.sin(v * Math.PI)); }); } }
      else if (c < 2.25) { const j = (c - 1.8) / .45; o.up = Math.sin(j * Math.PI) * .26; o.pitch = -.2 * Math.sin(j * Math.PI); }
      if (once('w2', c, 1.8)) { const N2 = 9, tx = t.bx, ty = 1.75, tz = t.bz, x0 = p.x, z0 = p.z; for (let i = 0; i < N2; i++) { const f = (i + 1) / N2, jx = (i % 2 ? .14 : -.14) * (1 - f), d0 = i * .035; bit(BIT.star, BMW.spark, .5 + d0, (m, v, tt) => { const on = tt > d0; m.position.set(x0 + (tx - x0) * f + jx, .5 + (ty - .5) * f, z0 + (tz - z0) * f); m.rotation.set(0, cam.az, tt * 8 + i); m.scale.setScalar(on ? .11 * (1 - v) * (1 + Math.sin(tt * 40) * .3) : 0); }); }
        for (let i = 0; i < 7; i++) { const a = R() * 6.283, v = .5 + R() * .6; bit(BIT.star, BMW.spark, .55, (m, w, tt) => { const q = Math.max(0, tt - .3); m.position.set(tx + Math.cos(a) * q * v, ty + q * .8 - q * q * 3, tz + Math.sin(a) * q * v); m.rotation.set(0, cam.az, tt * 9); m.scale.setScalar(tt > .3 ? .06 * (1 - w) : 0); }); } }
    } else if (t.job === 'kitchen' && t.mx !== undefined) { // at the hearth: a deep breath in, then a long puff into the fire's mouth; the fire roars up and sparks fly up the flue
      const c = u % 3.6, e = items.get(t.id), sx = Math.sin(t.face), sz = Math.cos(t.face), hy = (p.topY || .5) * .55;
      if (c < 1.1) { const q = Math.sin(c / 1.1 * Math.PI / 2); o.pitch = -.22 * q; o.up = .05 * q; o.sit = 0; } // breathes in, leaning back and swelling up a little
      else if (c < 2.1) { const q = (c - 1.1) / 1; o.pitch = .3 - Math.sin(q * Math.PI) * .04; o.sit = .06; o.tilt = Math.sin(q * 30) * .02; // and blows
        if (every('w1', .05)) { const x0 = p.x + sx * (p.reach || .25) * .9, z0 = p.z + sz * (p.reach || .25) * .9, jx = (R() - .5) * .08, k = .04 + R() * .025; bit(BIT.ball, BM2.steam, .32, (m, v) => { m.position.set(x0 + (t.mx - x0) * v + jx * v, hy + (.14 - hy) * v, z0 + (t.mz - z0) * v); m.scale.setScalar(k * (1 + v * 1.4) * (1 - v * v)); }); }
        if (e) e.st.blow = Math.max(e.st.blow || 0, Math.min(1, q * 2.5));
        if (every('w2', .07)) { const a0 = R() * 6.283, v0 = .25 + R() * .35, mat = R() < .5 ? BMW.ember : BMW.ember2, k = .03 + R() * .02; bit(BIT.ball, mat, .8, (m, v, tt) => { m.position.set(t.mx - sx * tt * .35 + Math.cos(a0) * tt * v0 * .5, .18 + tt * 1.1 - tt * tt * .6, t.mz - sz * tt * .35 + Math.sin(a0) * tt * v0 * .5); m.scale.setScalar(k * (1 - v)); }); }
      } else { const q = c - 2.1; o.pitch = .3 * Math.max(0, 1 - q * 3) + Math.sin(q * 3) * .03; o.up = Math.abs(Math.sin(q * 6)) * .03 * Math.max(0, 1 - q); } // then watches the fire, pleased
      if (once('w3', c, 2.1) && e) { const ft = e.g.localToWorld(new THREE.Vector3(...flueTop(e.lv))), top = ft.y; // a puff of sparks out of the flue
        for (let i = 0; i < 7; i++) { const a = R() * 6.283, v = .2 + R() * .3; bit(BIT.star, BMW.spark, .9, (m, w, tt) => { m.position.set(ft.x + Math.cos(a) * tt * v, top + tt * 1.2 - tt * tt * .5, ft.z + Math.sin(a) * tt * v); m.rotation.set(0, cam.az, tt * 6); m.scale.setScalar(.06 * (1 - w)); }); } }
    } else if (t.job === 'kitchen') { // no room at the hearth: fans the oven from beside the building, embers and a little smoke rise, and every so often the fire whooshes
      const c = u % 3.2, whoosh = c > 2.7 ? Math.sin((c - 2.7) / .5 * Math.PI) : 0;
      o.pitch = .12 + Math.sin(u * 8) * .1 * (1 - whoosh) - whoosh * .3; o.tilt = Math.sin(u * 4) * .05; o.up = whoosh * .14;
      const ember = fast => { const sx = Math.abs(Math.cos(t.face)), x0 = p.x + Math.sin(t.face) * .42 + (R() - .5) * .5 * sx, z0 = p.z + Math.cos(t.face) * .42 + (R() - .5) * .5 * (1 - sx), ph = R() * 6, h = fast ? 1.5 : .95, k = .045 + R() * .025, mat = R() < .5 ? BMW.ember : BMW.ember2; bit(BIT.ball, mat, fast ? .7 : 1.15, (m, v, tt) => { m.position.set(x0 + Math.sin(tt * 6 + ph) * .07, .25 + v * h, z0 + Math.cos(tt * 5 + ph) * .05); m.scale.setScalar(k * (1 - v) * (1 + Math.sin(tt * 25 + ph) * .25)); }); };
      if (every('w1', .17)) ember(false);
      if (every('w2', .8)) floatUp(BIT.ball, BM2.steam, p.x + Math.sin(t.face) * .45, .8, p.z + Math.cos(t.face) * .45, .06, 1.6);
      if (once('w3', c, 2.8)) for (let i = 0; i < 8; i++) ember(true);
    }
  }
  const splash = (x, y, z, n = 3) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = .5 + Math.random() * .5; bit(BIT.ball, BM2.drop, .5, (m, u, t) => { m.position.set(x + Math.cos(a) * t * v, y + t * 1.6 - t * t * 4, z + Math.sin(a) * t * v); m.scale.setScalar(.035 * (1 - u)); }); } };
  const endUse = p => { if (p.act?.k !== 'use') return; const e = p.act.e; if (e.user === p) e.user = null; const i = e.riders ? e.riders.indexOf(p) : -1; if (i >= 0) e.riders[i] = null; };
  // The Little Carousel seats four, one pet a horse; everything else is used by one pet at a time.
  const RIDE = 4, taken = e => e.type === 'carousel' ? (e.riders || []).filter(Boolean).length >= RIDE : !!e.user;
  // A pet that climbs onto an empty carousel often calls its friends over, so now and then every horse has a rider.
  function callRiders(first, id, e) {
    const idle = [...pets.values()].filter(o => o !== first && !o.path.length && !o.train && !o.fixed && !o.nest && o.act?.k !== 'use' && o.act?.k !== 'greet');
    idle.sort(() => Math.random() - .5);
    for (const o of idle.slice(0, Math.random() < .5 ? RIDE - 1 : 1 + (Math.random() * 2 | 0))) { o.act = null; stroll(o, id); if (o.goal) { o.run = true; o.wait = 0; } }
  }
  // Chooses what a pet does now that it has stopped walking, and for how long.
  function rest(p) {
    p.topY ??= new THREE.Box3().setFromObject(p.g).max.y - p.g.position.y;
    const goal = p.goal, ge = goal && items.get(goal.id); p.goal = null;
    if (ge && ge.key === goal.key && !taken(ge)) { // arrived at something: use it
      const [use, secs] = USE[goal.type], dur = secs * (.8 + Math.random() * .5);
      let seat = 0;
      if (use === 'ride') { const r = ge.riders ||= Array(RIDE).fill(null), alone = !r.some(Boolean); seat = r.indexOf(null); r[seat] = p; if (alone && Math.random() < .6) callRiders(p, goal.id, ge); }
      else ge.user = p;
      const act = p.act = { k: 'use', use, seat, t: 0, dur, e: ge, id: goal.id, key: ge.key, z: .6, gx: ge.g.position.x, gz: ge.g.position.z };
      const route = ROUTES[goal.type]?.(ge.lv);
      if (route) { // an improved decoration: a list of stops to hop between, turned to wherever the model is turned
        const ry = ge.g.rotation.y, c = Math.cos(ry), sn = Math.sin(ry), back = Math.atan2(p.x - act.gx, p.z - act.gz), k = .85 + Math.random() * .3;
        act.use = 'route'; act.stops = route.map(([what, x, y, z, secs, f]) => ({ what, x: act.gx + x * c + z * sn, y, z: act.gz - x * sn + z * c, d: secs * k, f: f === null ? back : f + ry, ry }));
        act.dur = act.stops.reduce((n, q) => n + q.d, 0) + HOP;
      }
      p.wait = act.dur + .6 + Math.random() * 2; return;
    }
    const r = Math.random(); let k = null, dur = 2;
    const pal = [...pets.values()].find(o => o !== p && !o.path.length && !o.train && !o.fixed && (!o.act || o.act.k === 'sit' || o.act.k === 'look') && Math.hypot(o.x - p.x, o.z - p.z) < 1.7);
    if (pal && r < .5) { k = 'greet'; dur = 2.2; pal.act = { k: 'greet', t: 0, dur, pal: p, done: true }; pal.wait = Math.max(pal.wait, dur + .5); }
    else if (air.night > .6 && r < .6) { k = 'nap'; dur = 9 + Math.random() * 9; } // sleepy after dark
    else if (r < .2) { k = 'sit'; dur = 3 + Math.random() * 3; }
    else if (r < .34) { k = 'nap'; dur = 6 + Math.random() * 6; }
    else if (r < .52) { k = 'look'; dur = 2.5 + Math.random() * 2; }
    else if (r < .66) { k = 'joy'; dur = 1.5; }
    else if (r < .76) { k = 'twirl'; dur = .9; }
    p.act = k ? { k, t: 0, dur, pal, z: .4 } : null;
    p.wait = (k ? dur : 0) + .8 + Math.random() * 2.5;
  }
  // A pet working through the stops of an improved decoration (ROUTES in models.js): it hops from the ground to the first
  // stop, does that stop's thing, hops on to the next, and from the last one back down. Returns the pose for movePets.
  const BM3 = { fluff: new THREE.MeshBasicMaterial({ color: '#e8c860' }) };
  function routePose(p, A, dt, T) {
    const S = A.stops, o = { ox: 0, oz: 0, up: 0, sit: 0, tilt: 0, turn: 0, pitch: 0, asleep: false };
    const say = (geo, mat, n, size) => floatUp(geo, mat, p.x + o.ox, (p.topY || .5) + o.up + .08, p.z + o.oz, size, 1.3);
    let t = A.t, i = 0; while (i < S.length - 1 && t > S[i].d) { t -= S[i].d; i++; }
    const off = q => q ? [q.x - p.x, q.y, q.z - p.z] : [0, 0, 0], end = A.t > A.dur - HOP;
    const [from, to] = end ? [S[S.length - 1], null] : [S[i - 1], S[i]], h = end ? (A.t - (A.dur - HOP)) / HOP : Math.min(1, t / HOP);
    const a = off(from), b = off(to), e = h * h * (3 - 2 * h), arc = Math.sin(h * Math.PI) * (.22 + Math.abs(b[1] - a[1]) * .35);
    o.ox = a[0] + (b[0] - a[0]) * e; o.oz = a[2] + (b[2] - a[2]) * e; o.up = a[1] + (b[1] - a[1]) * e + arc;
    if (h < 1) { if (Math.hypot(b[0] - a[0], b[2] - a[2]) > .05) p.face = Math.atan2(b[0] - a[0], b[2] - a[2]); o.pitch = -Math.sin(h * Math.PI) * .25; if (!end && i === 0 && !A.hopped) { A.hopped = true; dustAt(p.x, p.z, 2); } return o; }
    const q = S[i], s = t - HOP, k = Math.min(1, s * 3, (q.d - t) * 3); p.face = q.f;
    if (q.cue !== i) { q.cue = i; A.z = .5; } // each stop starts its own little timers
    const tick = sec => (A.z -= dt) <= 0 && ((A.z = sec), true);
    if (q.what === 'perch') { o.sit = .14 * k; o.turn = Math.sin(s * 1.2) * .6 * k; }
    else if (q.what === 'scratch') { // leaning into the post, paws going: bits of rope drift down
      o.pitch = .18 * k; o.ox += Math.sin(q.f) * .1 * k; o.oz += Math.cos(q.f) * .1 * k; o.up += .04 * k + Math.abs(Math.sin(s * 14)) * .025 * k; o.tilt = Math.sin(s * 14) * .07 * k;
      if (k > .8 && tick(.22)) { const x0 = p.x + o.ox + Math.sin(q.f) * .16, z0 = p.z + o.oz + Math.cos(q.f) * .16, y0 = q.y + .3, ph = Math.random() * 6; bit(BIT.ball, BM3.fluff, .9, (m, v) => { m.position.set(x0 + Math.sin(v * 9 + ph) * .05, y0 - v * .45, z0 + Math.cos(v * 7 + ph) * .05); m.scale.setScalar(.022 * (1 - v * .5)); }); }
    }
    else if (q.what === 'bat') { // eyes on the toy mouse, then a quick swipe: the mouse spins and swings
      const c = s % 1.3, sw = c > .9 ? Math.sin((c - .9) / .4 * Math.PI) : 0;
      o.sit = .1 * k; o.pitch = (.1 + sw * .3) * k; o.tilt = sw * .22 * k; o.turn = Math.sin(s * 3) * .08 * k * (1 - sw); o.up += sw * .05;
      if (sw > .5) A.e.burst = Math.max(A.e.burst, .8);
      if (c > 1.05 && !q.hit) { q.hit = true; say(BIT.star, BM.star, 1, .05); } if (c < .9) q.hit = false;
    }
    else if (q.what === 'nap') { o.sit = .26 * k; o.tilt = .14 * k; o.asleep = k > .5; if (o.asleep && tick(1.2)) say(BIT.z, BM.z, 1, .07); }
    else if (q.what === 'sway') { // lying in the hammock, rocking with it
      const ang = hammockSway(T), dx = Math.sin(q.f + Math.PI / 2), dz = Math.cos(q.f + Math.PI / 2), L = .2;
      o.ox -= dx * Math.sin(ang) * L * k; o.oz -= dz * Math.sin(ang) * L * k; o.up += (1 - Math.cos(ang)) * L * k - .06 * k;
      o.sit = .28 * k; o.tilt = ang * .9 * k; o.asleep = s > 1.5 && k > .5; if (o.asleep && tick(1.4)) say(BIT.z, BM.z, 1, .07);
    }
    else if (q.what === 'groom') { // a wash: head down to a paw, then round to the side
      o.sit = .16 * k; o.pitch = (.18 + Math.sin(s * 5) * .1) * k; o.turn = Math.sin(s * 1.6) * .45 * k; o.tilt = Math.sin(s * 5) * .04 * k;
      if (tick(1.1)) say(BIT.star, BM.star, 1, .04);
    }
    else if (q.what === 'peek') { // tucked in the hideout's doorway, looking out left and right, happy
      o.sit = .12 * k; o.turn = Math.sin(s * 1.3) * .55 * k; o.up += Math.max(0, Math.sin(s * 2.6)) * .02;
      if (tick(2)) say(BIT.heart, BM.heart, 1, .07);
    }
    return o;
  }
  // Walking along a worked-out way (t.via) to a helper's, trainee's or nesting pet's spot.
  const goVia = (p, t, dt, speed) => { const [tx, ty] = t.via[0], gx = hx(tx), gz = hx(ty), dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz), step = speed * dt;
    if (d <= step) { p.x = gx; p.z = gz; t.via.shift(); } else { p.x += dx / d * step; p.z += dz / d * step; p.face = Math.atan2(dx, dz); } };
  // The last bit to a spot with a fence in the way (a pen with no gate) is a leap over it: how high it is now.
  const leapOf = (t, d) => { if (!t.leap) return 0; t.l0 = Math.max(t.l0 || 0, d); return t.l0 > .2 ? Math.sin((1 - d / t.l0) * Math.PI) * Math.min(.55, .25 + t.l0 * .25) : 0; };
  function movePets(dt, T) {
    for (const p of pets.values()) {
      let moving = false;
      let drill = 0, wpose = null, leapUp = 0;
      if (p.fixed) { /* starter on show */ }
      else if (p.nest) { // walks to its place in the Nest (round anything in the way) and stays there
        const t = p.nest;
        if (t.via?.length) { goVia(p, t, dt, 1.6); moving = true; }
        else { const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
          if (d > .04) { const step = Math.min(d, 1.8 * dt); p.x += dx / d * step; p.z += dz / d * step; p.face = Math.atan2(dx, dz); moving = d > .5; leapUp = leapOf(t, d); }
          else { p.face = t.face; t.l0 = 0; } }
      }
      else if (p.train) { // drills on the spot: a run-up hop at the dummy, a jump over the hurdle, or quick hops
        const t = p.train, dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
        if (t.via?.length) { goVia(p, t, dt, 1.6); moving = true; }
        else if (d > .05) { const step = Math.min(d, 2.5 * dt); p.x += dx / d * step; p.z += dz / d * step; p.face = Math.atan2(dx, dz); moving = true; leapUp = leapOf(t, d); }
        else if (t.job) { p.face = t.face; workPose(p, t, dt, wpose = { sit: 0, tilt: 0, turn: 0, up: 0, pitch: 0 }); }
        else { const u = (T * (t.k === 1 ? .9 : 1.3) + p.seed) % 1; p.face = t.face; drill = Math.sin(u * Math.PI) * (t.k === 1 ? .45 : .22); if (t.k !== 1) { const lunge = Math.sin(u * Math.PI) * .22; p.lx = Math.sin(t.face) * lunge; p.lz = Math.cos(t.face) * lunge; } }
      }
      else if (p.path.length) {
        const [tx, ty] = p.path[0], gx = hx(tx), gz = hx(ty), dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz), step = (p.run ? 2.3 : 1.25) * dt;
        if (d <= step) { p.x = gx; p.z = gz; p.path.shift(); if (!p.path.length) rest(p); }
        else { p.x += dx / d * step; p.z += dz / d * step; p.face = Math.atan2(dx, dz); }
        moving = true;
      } else if ((p.wait -= dt) <= 0) { endUse(p); p.act = null; stroll(p); p.run = Math.random() < .22; if (!p.path.length) p.wait = 2; }
      p.hop = Math.max(0, p.hop - dt * 1.6);
      const pace = p.run ? 13 : 9, stepPh = Math.sin(T * pace + p.seed), bounce = moving ? Math.abs(stepPh) * (p.run ? .16 : .1) : 0, cheer = p.hop ? Math.abs(Math.sin(p.hop * Math.PI * 3)) * .35 * p.hop : 0;
      if (moving && !p.train && (p.stepWas || 0) * stepPh < 0 && !starters) dustAt(p.x, p.z, p.run ? 2 : 1); p.stepWas = stepPh; // a puff each time the paws come down
      // what it is doing while it rests: sitting, napping, looking about, a happy hop, a twirl, or greeting a friend
      const A = !moving && !p.train && !p.fixed && !p.nest ? p.act : null; let sit = 0, tilt = 0, turn = 0, up = 0, asleep = false, ox = 0, oz = 0, pitch = 0;
      if (wpose) ({ sit, tilt, turn, up, pitch } = wpose);
      if (p.nest && !moving) { // snuggled together: leaning in, breathing slowly, a heart now and then
        const t = p.nest, near = Math.min(1, Math.max(0, 1 - Math.hypot(t.x - p.x, t.z - p.z) * 2)); up = t.y * near; sit = .1 * near;
        tilt = (-t.sd * .2 + Math.sin(T * 1.1 + p.seed) * .03) * near; asleep = !t.egg && (T * .13 + p.seed) % 1 < .45;
        if (near > .9 && (p.hz = (p.hz ?? 1 + Math.random() * 2) - dt) <= 0) { p.hz = t.egg ? 4.5 : 2.6 + Math.random(); floatUp(BIT.heart, BM.heart, p.x - t.sd * .2, (p.topY ??= new THREE.Box3().setFromObject(p.g).max.y - p.g.position.y) + t.y + .1, p.z, .075, 1.7); }
      }
      if (A) {
        A.t += dt; const u = Math.min(1, A.t / A.dur), ease = Math.min(1, A.t * 3, (A.dur - A.t) * 3);
        if (A.k === 'sit') sit = .14 * ease;
        else if (A.k === 'nap') { sit = .26 * ease; tilt = .14 * ease; asleep = ease > .5; if (asleep && (A.z -= dt) <= 0) { A.z = 1.2; floatUp(BIT.z, BM.z, p.x + .12, (p.topY || .5) * .8, p.z, .07, 1.6); } }
        else if (A.k === 'look') turn = Math.sin(A.t * 2.1) * .75 * ease;
        else if (A.k === 'joy') { up = Math.abs(Math.sin(A.t * 6.5)) * .2 * ease; if (!A.done) { A.done = true; for (let i = 0; i < 3; i++) floatUp(BIT.star, BM.star, p.x + (i - 1) * .16, (p.topY || .5) + .05, p.z, .05, 1); } }
        else if (A.k === 'twirl') { turn = u * u * (3 - 2 * u) * 6.283; up = Math.sin(u * Math.PI) * .12; }
        else if (A.k === 'greet') { p.face = Math.atan2(A.pal.x - p.x, A.pal.z - p.z); up = Math.abs(Math.sin(A.t * 6)) * .14 * ease; if (!A.done && A.t > .5) { A.done = true; floatUp(BIT.heart, BM.heart, (p.x + A.pal.x) / 2, (p.topY || .5) + .15, (p.z + A.pal.z) / 2, .07, 1.5); } }
        else if (A.k === 'use') {
          if (items.get(A.id) !== A.e || A.e.key !== A.key) { endUse(p); p.act = null; } // it was moved or sold
          else {
            const U = A.use, hx = A.gx - p.x, hz = A.gz - p.z, hop = Math.min(1, A.t / .45) * Math.min(1, Math.max(0, (A.dur - A.t) / .45)), arc = Math.sin(Math.min(1, A.t / .45) * Math.PI) + Math.sin(Math.min(1, Math.max(0, 1 - (A.dur - A.t) / .45)) * Math.PI);
            const say = (geo, mat, n = 1, size = .055) => { for (let i = 0; i < n; i++) floatUp(geo, mat, p.x + ox + (i - (n - 1) / 2) * .16, (p.topY || .5) + up + .08, p.z + oz, size, 1.3); };
            p.face = Math.atan2(hx, hz);
            if (U === 'nap') { p.face += Math.PI * .8; sit = .26 * ease; tilt = .14 * ease; asleep = ease > .5; if (asleep && (A.z -= dt) <= 0) { A.z = 1.2; say(BIT.z, BM.z, 1, .07); } }
            else if (U === 'look') { pitch = -.24 * ease; turn = Math.sin(A.t * 1.6) * .3 * ease; }
            else if (U === 'cheer') { up = Math.abs(Math.sin(A.t * 6.5)) * .2 * ease; if (!A.done) { A.done = true; say(BIT.star, BM.star, 3, .05); } }
            else if (U === 'beg') { up = Math.abs(Math.sin(A.t * 5)) * .1 * ease; pitch = -.2 * ease; if (!A.done && u > .6) { A.done = true; say(BIT.heart, BM.heart, 1, .07); } }
            else if (U === 'peek' || U === 'hug') { pitch = (U === 'hug' ? .12 : .22) * ease; up = U === 'hug' ? Math.abs(Math.sin(A.t * 6)) * .12 * ease : 0; turn = Math.sin(A.t * 2) * .15 * ease; if (!A.done && u > .4) { A.done = true; say(BIT.heart, BM.heart, 1, .07); } }
            else if (U === 'sniff') { pitch = (.3 + Math.sin(A.t * 6) * .08) * ease; turn = Math.sin(A.t * 1.3) * .25 * ease; if ((A.z -= dt) <= 0) { A.z = 1.1; dustAt(p.x + hx * .35, p.z + hz * .35, 1); } }
            else if (U === 'drink') { pitch = (.34 + Math.sin(A.t * 4.5) * .1) * ease; if ((A.z -= dt) <= 0) { A.z = .8; splash(p.x + hx * .5, .35, p.z + hz * .5, 2); } }
            else if (U === 'dance') { const a = Math.atan2(-hx, -hz) + u * 12.566, r = Math.hypot(hx, hz); ox = (hx + Math.sin(a) * r) * hop; oz = (hz + Math.cos(a) * r) * hop; p.face = a + Math.PI / 2; up = Math.abs(Math.sin(A.t * 7)) * .14 * ease; if ((A.z -= dt) <= 0) { A.z = 1.2; say(BIT.star, BM.star, 1, .05); } }
            else if (U === 'play') { up = Math.abs(Math.sin(A.t * 5.5)) * .22 * ease; ox = hx * .3 * Math.abs(Math.sin(A.t * 2.75)) * ease; oz = hz * .3 * Math.abs(Math.sin(A.t * 2.75)) * ease; if ((A.z -= dt) <= 0) { A.z = 1.14; A.e.pop = 1; } }
            else if (U === 'warm') { sit = .16 * ease; turn = Math.sin(A.t * .9) * .12 * ease; tilt = Math.sin(A.t * 1.3) * .05 * ease; }
            else if (U === 'route') ({ ox, oz, up, sit, tilt, turn, pitch, asleep } = routePose(p, A, dt, T));
            else { // onto or into it: a hop there, a stay, and a hop back
              // on the carousel the seat is a horse: it goes round with the platform and bobs on its pole (the same numbers as models.js)
              const ride = U === 'ride', ra = ride ? A.e.g.rotation.y - T * .5 : 0, sa = A.seat * Math.PI / 2, rx = ride ? .6 * Math.cos(sa - ra) : 0, rz = ride ? .6 * Math.sin(sa - ra) : 0;
              const top = ride ? .9 + Math.sin(T * 2 + A.seat * 1.6) * .12 : U === 'perch' ? Math.min(1.5, A.e.top - .02) : U === 'swing' ? .36 : SEAT[A.e.type] ?? .2;
              ox = (hx + rx) * hop; oz = (hz + rz) * hop;
              if (ride) { p.face = ra - sa; if ((A.z -= dt) <= 0) { A.z = 2.2; say(BIT.star, BM.star, 1, .05); } } up = top * hop + arc * .3; sit = .14 * ease;
              if (U === 'swing') { const ang = Math.sin(T * 1.7) * .22, ry = A.e.g.rotation.y, k = hop * .82; ox += Math.sin(ry) * -Math.sin(ang) * k; oz += Math.cos(ry) * -Math.sin(ang) * k; up += (1 - Math.cos(ang)) * k; p.face = ry; pitch = ang * hop; }
              else if (ride) {}
              else if (U === 'perch') { p.face += Math.PI; turn = Math.sin(A.t * 1.2) * .6 * ease; }
              else if (U === 'soak') { p.face += Math.sin(A.t * .4) * 1.5; up += Math.sin(T * 2.2 + p.seed) * .02; if (hop > .95 && (A.z -= dt) <= 0) { A.z = 1; if (A.e.type === 'hotspring') floatUp(BIT.ball, BM2.steam, p.x + ox, .5, p.z + oz, .06, 1.5); else splash(p.x + ox, .12, p.z + oz, 2); } if (!A.wet && hop > .9) { A.wet = true; splash(p.x + ox, .15, p.z + oz, 7); } }
              else if (U === 'sit') { p.face += Math.PI; turn = Math.sin(A.t * .8) * .3 * ease; }
            }
          }
        }
        if (p.act && A.t >= A.dur) { endUse(p); p.act = null; }
      }
      const breathe = (1 + Math.sin(T * (asleep ? 1.3 : 2.2) + p.seed) * (asleep ? .045 : .025)) * (1 - sit) * (moving ? 1 + (Math.abs(stepPh) - .6) * .12 : 1), b = p.g.userData.base;
      p.g.position.set(p.x + (drill ? p.lx || 0 : 0) + ox, bounce + cheer + drill + up + leapUp, p.z + (drill ? p.lz || 0 : 0) + oz);
      let da = p.face - (p.yaw ?? p.face); da = Math.atan2(Math.sin(da), Math.cos(da)); p.yaw = (p.yaw ?? p.face) + da * Math.min(1, dt * 8);
      p.g.rotation.set((moving ? (p.run ? .16 : .06) : 0) + pitch, p.yaw + turn, tilt + (moving ? stepPh * .07 : 0), 'YXZ');
      p.g.scale.set(b / Math.sqrt(breathe), b * breathe, b / Math.sqrt(breathe));
      const blink = asleep || (T + p.seed) % 3.6 < .12 ? .15 : 1; for (const e of p.g.userData.eyes) e.scale.z = blink;
      for (const fl of p.g.userData.flames) fl.scale.y = fl.scale.x * (1 + Math.sin(T * 11 + p.seed) * .1);
      if (!asleep) wiggle(p.g, T, p.seed, moving ? .5 : 0);
      if (p.open && !p.heart) { p.heart = new THREE.Mesh(heartGeo, heartMat); p.top = new THREE.Box3().setFromObject(p.g).max.y - p.g.position.y; scene.add(p.heart); }
      if (p.heart) { p.heart.visible = p.open; p.heart.position.set(p.x, p.top + .22 + bounce + cheer + Math.sin(T * 3 + p.seed) * .05, p.z); p.heart.rotation.y = T * 1.5; p.heart.scale.set(1.2, 1, .5).multiplyScalar(1 + Math.sin(T * 6 + p.seed) * .08); }
      p.blob.position.set(p.x + ox, .015, p.z + oz); p.blob.visible = up < .3; p.blob.scale.setScalar((p.big || 1) * (1 - (bounce + cheer) * .8));
      p.g.visible = !edit || !!p.fixed; if (edit && !p.fixed) { p.blob.visible = false; if (p.heart) p.heart.visible = false; } // out of the way while building (Kuba)
    }
  }

  // ---------- the expedition balloon ----------
  // It waits above the gate, flies off with the party, and comes back when they are done.
  const balloon = balloonModel(); balloon.visible = false; scene.add(balloon);
  const bal = { state: 'none', t: 9, from: new THREE.Vector3(), home: new THREE.Vector3(), far: new THREE.Vector3() };
  // The egg sits in the Nest for everyone to see, and rocks harder as hatching gets close.
  let egg = null;
  // The owner stands on their farm, near the farmhouse door.
  // The owner walks about their farm; on a visit your own avatar comes along as the guest.
  let owner = null, guests = [];
  const people = new Map(); // 'owner' | 'guest' -> { g, key, x, z, path, wait, face, seed }
  function syncOwner() {
    const house = farm?.items.find(i => i.type === 'house'), gate = farm?.items.find(i => i.type === 'gate');
    for (const [who, o, by] of [['owner', owner, house], ...[0, 1, 2].map(i => ['guest' + i, guests[i], gate || house])]) {
      const key = farm && o && !starters ? JSON.stringify([o.color, o.av]) : ''; let p = people.get(who);
      if (p && p.key !== key) { scene.remove(p.g); disposeAvatar(p.g); people.delete(who); p = null; }
      if (!key) continue;
      if (!p) { try { const g = avatar3d(o.color || '#ff8fab', o.av, { pose: 'stand' }); g.scale.setScalar(.5); scene.add(g); p = { g, key, x: 1e9, z: 0, path: [], wait: 2 + Math.random() * 3, face: .4, seed: Math.random() * 10 }; people.set(who, p); } catch (e) { console.warn('no avatar', e); continue; } }
      const [tx, ty] = p.x > 1e8 ? [-1, -1] : tileOf(p);
      if (tx < 0 || walkGrid[ty * M + tx]) { // new here, or something was built where they stood
        const [w, d] = by ? footprint(by.type, by.r) : [1, 1];
        const t = freeSpotNear(wx(Math.min(N - 1, by ? by.x + (w >> 1) + (who === 'owner' ? 0 : 1 + +who[5]) : N >> 1)), wz(Math.min(N - 1, by ? by.y + d : N >> 1)));
        p.shown = !!t; if (t) { p.x = t[0]; p.z = t[1]; } p.path = [];
      } else { const cut = p.path.findIndex(([x, y]) => walkGrid[y * M + x]); if (cut >= 0) p.path.length = cut; }
    }
  }
  function movePeople(dt, T) {
    for (const p of people.values()) {
      p.g.visible = !!p.shown && !edit; if (!p.shown) continue; let moving = false; // hidden while building (Kuba), and still walking about
      if (p.path.length) {
        const [tx, ty] = p.path[0], gx = hx(tx), gz = hx(ty), dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz), step = .95 * dt;
        if (d <= step) { p.x = gx; p.z = gz; p.path.shift(); if (!p.path.length) p.wait = 3 + Math.random() * 6; }
        else { p.x += dx / d * step; p.z += dz / d * step; p.face = Math.atan2(dx, dz); }
        moving = true;
      } else if (!edit && (p.wait -= dt) <= 0) { stroll(p); if (!p.path.length) p.wait = 3; }
      // a real walk: striding legs, swinging arms, a bob on each step and a small lean into it; standing, they breathe and look about
      p.walk = Math.max(0, Math.min(1, (p.walk || 0) + (moving ? dt * 6 : -dt * 5))); if (p.walk > 0) p.ph = (p.ph || 0) + dt * 8.2; else p.ph = 0;
      const w = p.walk * p.walk * (3 - 2 * p.walk);
      animateAvatar(p.g, T, { seed: p.seed }); walkAvatar(p.g, p.ph, w);
      if (moving && Math.sin(p.ph) * (p.stepWas || 0) < 0) dustAt(p.x, p.z, 1); p.stepWas = Math.sin(p.ph);
      p.g.scale.setScalar(.5);
      p.g.position.set(p.x, .38 + Math.abs(Math.cos(p.ph)) * .035 * w, p.z);
      let da = p.face - p.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); p.g.rotation.y += da * Math.min(1, dt * 7);
      p.g.rotation.z = Math.sin(p.ph) * .045 * w; p.g.rotation.x = .09 * w;
    }
  }
  function syncEgg() {
    const n = farm?.nests?.find(q => q.stage !== 'cuddle') || farm?.nest, nest = n && n.stage !== 'cuddle' && farm.items.find(i => i.type === 'nest'), key = nest ? n.shell.base + n.shell.speck : '';
    if (egg && egg.key !== key) { scene.remove(egg.g); disposeModel(egg.g); egg = null; }
    if (!nest) return;
    if (!egg) { egg = { g: eggModel(n.shell.base, n.shell.speck), key }; egg.g.scale.setScalar(.62); scene.add(egg.g); }
    const [w, h] = footprint('nest', nest.r); egg.g.position.set(wx(nest.x) + (w - 1) / 2, .22, wz(nest.y) + (h - 1) / 2); egg.ready = n.stage === 'ready';
  }
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
  const flags = [], fans = []; let cheer = 0; // flags that flutter, and the little onlookers who hop when something lands
  {
    ring.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
    const l = new THREE.DirectionalLight('#ffffff', 1.6); l.position.set(5, 10, 6); ring.add(l);
    { // the same sky as the farm, and a sun low behind the ring
      const g = new THREE.SphereGeometry(200, 16, 10), p = g.attributes.position, col = [], top = new THREE.Color(SKY_TOP), low = new THREE.Color(SKY_LOW), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) { c.copy(low).lerp(top, Math.min(1, Math.max(0, p.getY(i) / 200 * 1.9 + .12))); col.push(c.r, c.g, c.b); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      ring.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
      for (const [r, o] of [[5, 1], [7.5, .35], [11, .16]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: o, depthWrite: false, fog: false })); m.position.set(34, 26, -90); m.lookAt(0, 2, 0); ring.add(m); }
    }
    const deco = new THREE.Group(), put = (g, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(g, flat(c)); m.position.set(x, y, z); deco.add(m); return m; };
    // the island: a wide grassy top with mown rings, on a rough rock that tapers away below
    put(new THREE.CylinderGeometry(5.3, 5.05, .4, 14), '#74bd55', 0, -.2);
    { // mown rings and the chalk line: painted on the grass, so no outline
      const lawn = new THREE.Group(), pl = (g, c, y) => { const m = new THREE.Mesh(g, flat(c)); m.position.y = y; m.rotation.x = -Math.PI / 2; lawn.add(m); };
      pl(new THREE.CircleGeometry(3.3, 36), '#8fd16a', .011); pl(new THREE.CircleGeometry(2.35, 32), '#9bdb74', .016); pl(new THREE.CircleGeometry(1.4, 28), '#8fd16a', .021);
      pl(new THREE.RingGeometry(3.25, 3.42, 36), '#ffffff', .03); pl(new THREE.RingGeometry(.5, .6, 24), '#d9f5b8', .028); pl(new THREE.CircleGeometry(.16, 5), '#d9f5b8', .028);
      bake(lawn); toonify(lawn); ring.add(lawn);
    }
    put(rough(new THREE.CylinderGeometry(5.05, 3.1, 1.8, 12, 2), .45, .8), '#a87750', 0, -1.3);
    put(rough(new THREE.ConeGeometry(3.2, 5.5, 7, 3), .55), '#857a72', 0, -4.9).rotation.x = Math.PI;
    // a rope fence on short posts all the way round
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, x = Math.cos(a) * 4.1, z = Math.sin(a) * 4.1; put(new THREE.CylinderGeometry(.08, .1, .5, 6), '#9a6a45', x, .25, z); put(new THREE.SphereGeometry(.1, 6, 5), '#b98556', x, .52, z); }
    put(new THREE.TorusGeometry(4.1, .028, 4, 42), '#e9d7b0', 0, .38).rotation.x = Math.PI / 2;
    put(new THREE.TorusGeometry(4.1, .028, 4, 42), '#e9d7b0', 0, .2).rotation.x = Math.PI / 2;
    // bushes, flowers, rocks and a few pines on the rim (kept low in front, so nothing hides the fight)
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * 6.283 + .2, back = Math.sin(a) < .2, r = 4.62 + hash(i, 41) * .3, x = Math.cos(a) * r, z = Math.sin(a) * r, k = hash(i, 42);
      if (back && i % 4 === 0) { put(new THREE.CylinderGeometry(.09, .12, .5, 5), '#8a5a3c', x, .25, z); for (let t = 0; t < 3; t++) put(new THREE.ConeGeometry(.62 - t * .15, .75, 7), t % 2 ? '#3f9a52' : '#4aa85c', x, .75 + t * .45, z); }
      else if (k < .55) { for (let b = 0; b < 3; b++) put(new THREE.IcosahedronGeometry(.26 + hash(i, 43 + b) * .14, 1), b % 2 ? '#58b35a' : '#4aa551', x + (b - 1) * .26, .18 + (b === 1 ? .1 : 0), z + (hash(i, 46 + b) - .5) * .2); if (k < .3) for (let f = 0; f < 3; f++) put(new THREE.SphereGeometry(.06, 5, 4), ['#ff8fbd', '#ffe066', '#ffffff'][f], x + (f - 1) * .2, .42, z + .12); }
      else if (k < .8) put(rough(new THREE.IcosahedronGeometry(.3 + k * .12, 0), .12), '#a39a90', x, .16, z);
      else for (let f = 0; f < 4; f++) { const fx_ = x + (hash(i, 50 + f) - .5) * .7, fz = z + (hash(i, 54 + f) - .5) * .5; put(new THREE.CylinderGeometry(.015, .015, .22, 4), '#3f9a52', fx_, .11, fz); put(new THREE.SphereGeometry(.07, 6, 4), ['#ff8fbd', '#ffe066', '#ffffff', '#b79cff'][f], fx_, .25, fz); }
    }
    // far islands, for depth
    for (const [x, y, z, k] of [[-17, -2, -26, 2.4], [14, -1, -34, 3], [27, -4, -18, 1.8], [-30, -1.5, -14, 2]]) { put(new THREE.CylinderGeometry(k, k * .9, k * .22, 8), '#86cc5a', x, y, z); put(rough(new THREE.ConeGeometry(k * .92, k * 1.7, 7, 2), k * .18), '#a08a78', x, y - k * .95, z).rotation.x = Math.PI; put(new THREE.ConeGeometry(k * .3, k * .7, 6), '#4aa85c', x + k * .3, y + k * .45, z); }
    for (let i = 0; i < 11; i++) { const a = hash(i, 21) * 6.283, d = 15 + hash(i, 22) * 24, c = put(new THREE.IcosahedronGeometry(1, 1), '#ffffff', Math.cos(a) * d, -5 - hash(i, 23) * 6, Math.sin(a) * d - 8); c.scale.set(3.4, 1.6, 2.6).multiplyScalar(.7 + hash(i, 24)); }
    for (const [a] of [[.6], [2.3], [3.9], [5.4]]) put(new THREE.CylinderGeometry(.05, .06, 2.1, 6), '#8a5a3c', Math.cos(a) * 4.1, 1.05, Math.sin(a) * 4.1);
    bake(deco); toonify(deco, .028); ring.add(deco);
    // flags on the four tall poles: they flutter
    for (const [a, c] of [[.6, '#d9584e'], [2.3, '#ffc94d'], [3.9, '#5d8fd1'], [5.4, '#86cc5a']]) {
      const hinge = new THREE.Group(), cloth = new THREE.Mesh(new THREE.BoxGeometry(.62, .4, .04).translate(.33, 0, 0), tflat(c));
      hinge.add(cloth); hinge.position.set(Math.cos(a) * 4.1, 1.85, Math.sin(a) * 4.1); ring.add(hinge); flags.push({ g: hinge, ph: a * 3 });
    }
    // onlookers: small round critters sitting behind the rope
    [[3.55, '#ffb7d5'], [4.05, '#ffd98a'], [4.45, '#a5dcff'], [4.95, '#c7b6ff'], [5.3, '#a8ec8f'], [5.75, '#ffb38a'], [3.2, '#fff1d6']].forEach(([a, c], i) => {
      const g = new THREE.Group(), r = .2 + hash(i, 61) * .06, b = (geo, col, x, y, z) => { const m = new THREE.Mesh(geo, flat(col)); m.position.set(x, y, z); g.add(m); return m; };
      b(new THREE.IcosahedronGeometry(r, 2), c, 0, r, 0).scale.y = .92;
      for (const sx of [-1, 1]) { b(new THREE.SphereGeometry(r * .13, 6, 5), '#3b2a22', sx * r * .34, r * 1.12, r * .86); b(i % 2 ? new THREE.ConeGeometry(r * .24, r * .5, 5) : new THREE.SphereGeometry(r * .26, 6, 5), c, sx * r * .55, r * 1.85, 0); }
      bake(g); toonify(g, .016);
      const x = Math.cos(a) * 4.62, z = Math.sin(a) * 4.62; g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); ring.add(g); fans.push({ g, ph: i * 1.9, r });
    });
  }
  const fx = createBattleFx(ring, HOME, tflat), _o = {}, _d = new THREE.Vector3(), _sp = new THREE.Vector3();
  function ringPet(s, u) { // u: { id, sp, form } or null
    const key = u ? u.id + u.sp + u.form : '';
    if (bp[s]?.key === key) return;
    if (bp[s]) { ring.remove(bp[s].g, bp[s].blob); disposeModel(bp[s].g); bp[s] = null; }
    if (!u) return;
    if (fighting) fx.enter(s, .3);
    const g = petModel(u.sp, u.form, u.look); g.scale.multiplyScalar(.82);
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.set(HOME[s].x, .04, HOME[s].z); blob.scale.setScalar(g.scale.x * 3);
    ring.add(g, blob);
    bp[s] = { g, blob, key, base: g.scale.x, t: 0, lunge: 0, shake: 0, hop: 0, fall: 0, down: false, low: false, win: false, seed: s * 3.1 };
  }
  function moveRing(dt, T) {
    if (fx.hold > 0) { fx.hold -= dt; dt *= .06; } // a hard hit freezes everything for a blink
    fx.update(dt);
    cheer = Math.max(fx.shake, cheer - dt * .9);
    for (const f of flags) f.g.rotation.y = Math.sin(T * 3.1 + f.ph) * .35 + Math.sin(T * 7.3 + f.ph) * .1 - .3;
    for (const f of fans) { const hop = Math.abs(Math.sin(T * 9 + f.ph)) * .34 * Math.min(1, cheer * 1.6), br = 1 + Math.sin(T * 2.4 + f.ph) * .04; f.g.position.y = hop; f.g.scale.set(1 / Math.sqrt(br), br, 1 / Math.sqrt(br)); }
    for (const s of [0, 1]) {
      const p = bp[s]; if (!p) continue;
      p.t += dt; p.lunge = Math.max(0, p.lunge - dt * 2.4); p.shake = Math.max(0, p.shake - dt * 2.2); p.hop = Math.max(0, p.hop - dt * 1.8);
      if (p.down) p.fall = Math.min(1, p.fall + dt * 1.6);
      const reach = Math.sin(p.lunge * Math.PI) * .9, to = HOME[1 - s], h = HOME[s];
      // arriving: it drops in from above and squashes as it lands
      const q = Math.min(1, p.t / .3), drop = 2.6 * (1 - q * q), land = p.t > .3 && p.t < .62 ? Math.sin((p.t - .3) / .32 * Math.PI) : 0;
      // standing: breathing, a small sway, and now and then a happy hop. Tired pets droop and pant; winners bounce.
      const calm = !p.down && !p.win, slow = p.low ? .55 : 1, ph = (T * slow + p.seed * 1.7) % 5.2;
      const breathe = 1 + Math.sin(T * (p.low ? 5.5 : 2.2) + p.seed) * (p.low ? .045 : .028);
      const idleHop = calm && !p.low && ph < .5 ? Math.sin(ph / .5 * Math.PI) * .16 : 0, joy = p.win ? Math.abs(Math.sin(p.t * 7)) * .5 : 0;
      const k = p.base * (1 - p.fall * .85);
      const o = fx.pose(s, _o), f = reach * .45 + o.f, sy = breathe * o.sy * (1 - land * .28) * (1 + (drop > 0 ? .12 : 0)), kk = k * o.k; _d.set(to.x - h.x, 0, to.z - h.z);
      const px = -_d.z / _d.length() * o.side, pz = _d.x / _d.length() * o.side; // sideways steps
      p.g.position.set(h.x + _d.x * f + px + Math.sin(T * 55) * .09 * p.shake, Math.abs(Math.sin(p.hop * Math.PI * 2)) * .4 * p.hop + Math.sin(p.lunge * Math.PI) * .25 + o.y + drop + idleHop + joy, h.z + _d.z * f + pz);
      p.g.rotation.set(o.rx + (p.low && calm ? .13 : 0), FACE[s] + o.ry + (calm ? Math.sin(T * .9 + p.seed) * .07 : 0) + (p.win ? Math.sin(p.t * 3.5) * .5 : 0), p.fall * 1.3 * (s ? -1 : 1) + o.rz + (p.low && calm ? Math.sin(T * 1.3 + p.seed) * .04 : 0), 'YXZ');
      p.g.scale.set(kk / Math.sqrt(sy), kk * sy, kk / Math.sqrt(sy));
      p.blob.position.set(p.g.position.x, .04, p.g.position.z); p.blob.scale.setScalar(p.base * 3 / (1 + p.g.position.y * .5));
      const blink = (T + p.seed) % 3.6 < .12 || p.down ? .15 : p.low ? .6 : 1; for (const e of p.g.userData.eyes) e.scale.z = blink;
      for (const fl of p.g.userData.flames) fl.scale.y = fl.scale.x * (1 + Math.sin(T * 11) * .1);
      if (!p.down) wiggle(p.g, T, p.seed || 0, p.win ? 1 : 0);
      p.blob.visible = p.fall < .5;
    }
  }

  // ---------- the world map ----------
  // Everyone's farm as a small island: yours in the middle, the others in rings around it. Each one is a real
  // miniature built from that farm's layout and merged into a few meshes.
  const world = new THREE.Scene(); world.background = new THREE.Color(SKY_LOW); world.fog = new THREE.Fog(SKY_LOW, 60, 170);
  const whemi = new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9), wsun = new THREE.DirectionalLight('#ffffff', 1.6); wsun.position.set(9, 16, 7); world.add(whemi, wsun);
  const wclouds = cloudLayer(); wclouds.position.y = -4; world.add(wclouds);
  const mapBirds = makeBirds(world, 19, 6, 5, 1.7);
  let flights = [], flyTo = null; // balloons on their way, and the island the camera is swooping to
  let mapFar = 33, mapOut = 11, mapZoom = 1, mapOn = false, isles = []; // { id, g, y, ph, r }
  function nameTag(text, mine, friend, sub) { // sub: a second, smaller line saying what can be done there
    const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 512; c.height = 192;
    x.font = '600 60px Rubik, system-ui, sans-serif'; const w = Math.min(490, x.measureText(text).width + 60);
    x.fillStyle = mine ? '#ffb547' : friend ? '#9fe3c4' : '#fff3df'; x.strokeStyle = '#3b2a25'; x.lineWidth = 8;
    x.beginPath(); x.roundRect((512 - w) / 2, 14, w, 100, 50); x.fill(); x.stroke();
    x.fillStyle = '#3b2a25'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 68, 440);
    if (sub) { x.font = '600 40px Rubik, system-ui, sans-serif'; x.lineWidth = 9; x.strokeStyle = '#fff3df'; x.strokeText(sub, 256, 152, 500); x.fillText(sub, 256, 152, 500); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false })); sp.scale.set(4.4, 1.65, 1); sp.center.set(.5, .7); sp.userData.dyn = true;
    return sp;
  }
  function miniIsland(f, mine) {
    const g = new THREE.Group(), land = new THREE.Group(), n = f.size, R = n / 2 * Math.SQRT2, th = (f.isle?.ig | 0) ? groundOf(f.isle.ig) : null; // th: the owner's isle ground
    const mk = (geo, c, y) => { const m = new THREE.Mesh(geo, flat(c)); m.position.y = y; land.add(m); return m; };
    mk(new THREE.CylinderGeometry(R + 1.1, R + .7, .5, 4), th ? darker(th.grass, .9) : '#7cc45c', -.26).rotation.y = Math.PI / 4;
    mk(new THREE.BoxGeometry(n, .04, n), th ? th.grass : '#8fd16a', .0);
    mk(rough(new THREE.CylinderGeometry(R + .7, R * .66, 2, 4, 3), .45, .9), th ? th.earth : '#a87750', -1.5).rotation.y = Math.PI / 4;
    mk(rough(new THREE.ConeGeometry(R * .47, n * .7, 7, 3), n * .05), th ? th.rock : '#857a72', -2.4 - n * .35).rotation.x = Math.PI;
    for (const it of f.items.slice(0, 90)) {
      if (!ITEMS[it.type]) continue;
      const m = itemModel(it.type, false, true, levelOf(it, f), linkOf(it, f)), [w, h] = footprint(it.type, it.r);
      m.position.set(it.x + w / 2 - n / 2, 0, it.y + h / 2 - n / 2); m.rotation.y = -it.r * Math.PI / 2; land.add(m);
    }
    bake(land); toonify(land, .07);
    const k = (mine ? 6.4 : 4.4) / n; land.scale.setScalar(k); g.add(land);
    // the owner stands at the front corner, bigger than life so they can be recognised
    try { const av = avatar3d(f.color || '#ff8fab', f.av, { pose: 'stand' }); av.scale.setScalar(.62); av.position.set(n / 2 * k - .5, .76 * .62, n / 2 * k - .3); av.rotation.y = .5; g.add(av); g.userData.av = av; } catch (e) { console.warn('no avatar', e); }
    const todo = mine ? '' : [f.gift && L('gift', 'prezent'), f.helps > 0 && L('help', 'pomoc'), f.open && L('playdate', 'zabawa'), f.egg && L('egg', 'jajko')].filter(Boolean).join(' · ');
    const icons = new THREE.Group(); g.add(icons); g.userData.icons = icons; // what waits there, seen from afar
    if (!mine) {
      const ic = [];
      if (f.gift) { const b = new THREE.Group(); b.add(new THREE.Mesh(new THREE.BoxGeometry(.5, .42, .5), tflat('#ff9fb8')), new THREE.Mesh(new THREE.BoxGeometry(.54, .12, .16), tflat('#fff3df')), new THREE.Mesh(new THREE.BoxGeometry(.16, .12, .54), tflat('#fff3df'))); b.children[1].position.y = b.children[2].position.y = .22; ic.push(b); }
      if (f.helps > 0) { const b = new THREE.Group(), h = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .6, 5), tflat('#8a5a3c')), t = new THREE.Mesh(new THREE.BoxGeometry(.4, .22, .12), tflat('#a9a6b0')); t.position.y = .3; b.add(h, t); b.rotation.z = .5; ic.push(b); }
      if (f.open) { const h = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), tflat('#ff6f91', { emissive: '#ff6f91', emissiveIntensity: .4 })); h.scale.set(1.2, 1, .5); ic.push(h); }
      if (f.egg) { const e = new THREE.Mesh(new THREE.IcosahedronGeometry(.26, 1), tflat('#fff3df')); e.scale.y = 1.3; ic.push(e); }
      ic.forEach((m, i) => { m.position.set((i - (ic.length - 1) / 2) * .8, 0, 0); icons.add(m); });
      icons.position.y = 2.5;
    }
    const tag = nameTag(mine ? L('You', 'Ty') : f.name, mine, f.friend, todo); tag.position.y = (mine ? 4.4 : 3.6); g.add(tag); g.userData.tag = tag;
    return g;
  }
  // A place to explore, shown at the edge of the map. z: { key, name, el, note, out }
  function zoneIsle(z) {
    const g = new THREE.Group(), land = new THREE.Group(), top = { Leaf: '#6fbf5a', Tide: '#ead9a0', Stone: '#a9a6b0', Ember: '#b5553c', Spark: '#c9d65a' }[z.el] || '#8fd16a', th = z.theme,
      top2 = { fruit: '#8fd16a', veggie: '#9a6a4a', bakery: '#e8c890', sweets: '#ffc4dc', weather: '#eef6ff', night: '#5a4a8a', sea: '#f2dcb0', legend: '#b4c4e6' }[th] || top;
    const mk = (geo, c, x = 0, y = 0, zz = 0) => { const m = new THREE.Mesh(geo, flat(c)); m.position.set(x, y, zz); land.add(m); return m; };
    mk(new THREE.CylinderGeometry(2.3, 1.9, .5, 7), top2, 0, -.25); mk(rough(new THREE.ConeGeometry(1.9, 2.6, 7, 2), .3), '#857a72', 0, -1.8).rotation.x = Math.PI;
    const spots = [[-1, -.6], [.9, -.9], [-.3, .9], [1.1, .6], [0, -.1]];
    spots.forEach(([x, zz], i) => {
      if (th === 'fruit') { mk(new THREE.CylinderGeometry(.09, .11, .6, 5), '#8a5a3c', x, .3, zz); mk(new THREE.IcosahedronGeometry(.55, 1), i % 2 ? '#5fb04a' : '#6cc24f', x, 1, zz); for (let k = 0; k < 4; k++) mk(new THREE.IcosahedronGeometry(.13, 1), ['#ff5a6e', '#ffc93c', '#ff9a3c'][i % 3], x + Math.sin(k * 1.7 + i) * .45, .85 + (k % 2) * .3, zz + Math.cos(k * 1.7 + i) * .45); }
      else if (th === 'veggie') { mk(new THREE.BoxGeometry(1.1, .1, .3), '#7a4f36', x, .05, zz); for (let k = -1; k <= 1; k++) mk(new THREE.ConeGeometry(.1, .3, 4), '#6cc24f', x + k * .34, .25, zz); if (i === 4) { mk(new THREE.IcosahedronGeometry(.42, 1), '#ff9a2c', x, .34, zz + .5).scale.y = .8; mk(new THREE.CylinderGeometry(.04, .06, .16, 5), '#5fa646', x, .72, zz + .5); } }
      else if (th === 'bakery') { if (i === 4) { mk(new THREE.BoxGeometry(1, .7, .9), '#c9703c', x, .35, zz); mk(new THREE.IcosahedronGeometry(.56, 1), '#b8603a', x, .7, zz).scale.set(1, .7, .85); mk(new THREE.BoxGeometry(.4, .34, .1), '#3b2a22', x, .28, zz + .46); mk(new THREE.BoxGeometry(.2, .6, .2), '#8a8794', x + .3, 1.2, zz - .2); } else { mk(new THREE.IcosahedronGeometry(.28, 1), i % 2 ? '#e8a85a' : '#c98a4a', x, .16, zz).scale.set(1.5, .7, 1); } }
      else if (th === 'sweets') { mk(new THREE.CylinderGeometry(.04, .04, .9 + i * .1, 5), '#ffffff', x, .45 + i * .05, zz); const d = mk(new THREE.CylinderGeometry(.34, .34, .1, 12), ['#ff5a6e', '#7cc4ee', '#ffd65a', '#c9b5ff', '#86cc5a'][i], x, 1 + i * .1, zz); d.rotation.x = Math.PI / 2; const e = mk(new THREE.CylinderGeometry(.18, .18, .12, 10), '#ffffff', x, 1 + i * .1, zz); e.rotation.x = Math.PI / 2; }
      else if (th === 'sea') { if (i === 4) mk(new THREE.CylinderGeometry(.75, .75, .06, 9), '#6fc7e8', x, .03, zz); else { const c = ['#ff7a8a', '#ffb14a', '#c98ae0', '#ff9ec4'][i]; mk(new THREE.CylinderGeometry(.07, .11, .6 + i * .1, 5), c, x, .3, zz); for (let k = 0; k < 3; k++) { const b = mk(new THREE.CylinderGeometry(.05, .07, .4, 5), c, x + Math.sin(k * 2.1) * .2, .6 + k * .1, zz + Math.cos(k * 2.1) * .2); b.rotation.set(Math.cos(k * 2.1) * .6, 0, -Math.sin(k * 2.1) * .6); } mk(new THREE.OctahedronGeometry(.13), '#fff3df', x * .6 + .3, .1, zz * .6); } }
      else if (th === 'weather') { if (i < 2) mk(new THREE.ConeGeometry(.6, 1.1 + i * .3, 6), '#cfe0f0', x, .55, zz); else if (i === 2) { mk(new THREE.IcosahedronGeometry(.34, 1), '#ffd21f', x, 1.9, zz); } else if (i === 3) { for (let k = 0; k < 3; k++) mk(new THREE.IcosahedronGeometry(.3 - k * .04, 1), '#ffffff', x + (k - 1) * .34, 1.5 + (k % 2) * .12, zz); mk(new THREE.OctahedronGeometry(.07), '#6fb7e8', x, 1.05, zz).scale.y = 1.8; } else mk(new THREE.CylinderGeometry(.5, .5, .05, 7), '#8fd4ff', x, .03, zz); }
      else if (th === 'night') { mk(new THREE.OctahedronGeometry(.14 + (i % 2) * .05), '#fff3a0', x, 1 + i * .25, zz).scale.y = 1.5; mk(rough(new THREE.DodecahedronGeometry(.28), .06), '#7a6ab0', x * .8, .2, zz * .8); if (i === 4) { const m = mk(new THREE.TorusGeometry(.5, .16, 6, 12, Math.PI * 1.2), '#ffe27a', 0, 2, 0); m.rotation.z = 1.2; m.scale.z = .6; } }
      else if (th === 'legend') { if (i === 4) { for (const k of [-1, 1]) mk(new THREE.CylinderGeometry(.15, .17, 1.3, 8), '#f2ece0', k * .45, .65, zz); mk(new THREE.BoxGeometry(1.3, .2, .36), '#e6dfcf', x, 1.4, zz); mk(new THREE.OctahedronGeometry(.16), '#9ff0ff', x, 1.75, zz).scale.y = 1.6; } // a ruined arch with a glowing gem
        else if (i % 2) { mk(new THREE.CylinderGeometry(.15, .17, .7 + i * .12, 8), '#f2ece0', x, .35 + i * .06, zz); mk(new THREE.BoxGeometry(.4, .1, .4), '#e6dfcf', x, .75 + i * .12, zz); }
        else { const r = mk(rough(new THREE.DodecahedronGeometry(.26), .05), '#6e6694', x, .36, zz); r.scale.set(.8, 1.5, .55); mk(new THREE.OctahedronGeometry(.08), '#9ff0ff', x, .42, zz + .15).scale.z = .3; } }
      else if (z.el === 'Leaf') { mk(new THREE.CylinderGeometry(.09, .09, .5, 5), '#8a5a3c', x, .25, zz); mk(new THREE.ConeGeometry(.5, 1.1 + i * .12, 6), i % 2 ? '#4a9a45' : '#5fb04a', x, 1, zz); }
      else if (z.el === 'Tide') { if (i < 2) mk(new THREE.CylinderGeometry(.6, .6, .06, 7), '#6fb7e8', x, .03, zz); else mk(new THREE.OctahedronGeometry(.2), i % 2 ? '#ffb6c9' : '#fff3df', x, .16, zz); }
      else if (z.el === 'Stone') { mk(rough(new THREE.DodecahedronGeometry(.45 + i * .08), .08), i % 2 ? '#8a8794' : '#a9a6b0', x, .35, zz); if (i === 4) mk(new THREE.OctahedronGeometry(.22), '#8fe3f5', x, 1, zz); }
      else if (z.el === 'Ember') { mk(new THREE.ConeGeometry(.6, .9 + i * .2, 6), '#7a4a3a', x, .5, zz); if (i > 2) mk(new THREE.OctahedronGeometry(.16), '#ffb547', x, 1.3 + i * .1, zz); }
      else { mk(new THREE.ConeGeometry(.12, .7, 4), '#ffc94d', x, .35, zz); mk(new THREE.ConeGeometry(.1, .5, 4), '#86cc5a', x + .3, .25, zz + .2); }
    });
    bake(land); toonify(land, .05); g.add(land);
    const tag = nameTag(z.name, false, false, z.note); tag.position.y = 3; tag.scale.multiplyScalar(1.15); g.add(tag); g.userData.tag = tag;
    return g;
  }
  function setWorld(list, me, zones = []) {
    for (const i of isles) { world.remove(i.g); if (i.g.userData.av) { i.g.remove(i.g.userData.av); disposeAvatar(i.g.userData.av); } i.g.userData.tag.material.map.dispose(); i.g.userData.tag.material.dispose(); i.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    for (const f of flights) { world.remove(f.b); disposeModel(f.b); } flights = []; flyTo = null;
    isles = []; mapOn = !!list; liftNow = -1;
    if (!list) return;
    const put = (f, x, z, mine, i) => { const g = miniIsland(f, mine), y = mine ? 0 : (hash(i, 31) - .5) * 2.4; g.position.set(x, y, z); world.add(g); isles.push({ id: mine ? null : f.id, g, y, ph: i * 1.7, r: mine ? 3.6 : 2.8 }); };
    put(me, 0, 0, true, 0);
    // Rings that never crowd: the closest farms (friends come first) sit round yours, the places to explore make the
    // next ring, and any more farms fill wider rings beyond. Each ring only takes as many islands as fit side by side.
    const GAP = 7.6, cap = r => Math.max(1, Math.floor(6.283 * r / GAP)), rings = []; let left = list.length, at = 0, r = 10.5;
    const R = list.length ? r + GAP : 12;                         // the zone ring
    while (left > 0) { if (rings.length === 1) r = R + GAP; const n = Math.min(left, cap(r)); rings.push({ r, n, at }); at += n; left -= n; r += GAP; }
    rings.forEach((g, k) => { for (let j = 0; j < g.n; j++) { const a = j / g.n * 6.283 - .6 + k * .37; put(list[g.at + j], Math.cos(a) * g.r, Math.sin(a) * g.r, false, g.at + j + 1); } });
    mapOut = Math.max(zones.length ? R : 0, rings.length ? rings[rings.length - 1].r : 0, 8); mapFar = (mapOut + 4.5) * 2.75;
    mapZoom = Math.min(1, 62 / mapFar);                           // a big neighbourhood opens a little closer in; scroll or pinch for the rest
    zones.forEach((z, i) => { const g = zoneIsle(z), a = i / zones.length * 6.283 + 2.2, y = z.far ? .3 : -1 + (hash(i, 77) - .5); // a far island floats a little higher
      g.position.set(Math.cos(a) * R, y, Math.sin(a) * R); world.add(g); isles.push({ zone: z.key, g, y, ph: i * 2.3 + 1, r: 2.4 });
      if (z.out) { // the party's balloon flies out to the zone, waits there, and is home again when the time is up
        const b = balloonModel(); b.scale.setScalar(.7); world.add(b);
        flights.push({ b, to: g.position, end: performance.now() + (z.fly?.left || 0), total: z.fly?.total || 1 }); }
    });
    cam.waz = .5;
  }
  const _wc = new THREE.Vector3(), _look = new THREE.Vector3();
  function isleAt() { // which island the last pointer ray passes closest to
    let best = null, bd = 1e9;
    for (const i of isles) { _wc.copy(i.g.position); _wc.y += .8; const d = ray.ray.distanceToPoint(_wc); if (d < i.r && d < bd) { bd = d; best = i; } }
    return best;
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
      cam.az = 0; cam.el = .4; cam.dist = 11; cam.tx = cam.tz = cam.gx = cam.gz = 0; cam.follow = cam.back = null; cam.zoom = 0;
    }
    starSel = sel || null;
  }

  // ---------- the piece being placed ----------
  let ghost = null; // { type, id, x, y, r, ok, g, pad, top }
  const ghostAt = new THREE.Vector3();
  function gridVis() { if (gridLines) gridLines.visible = edit; if (fineLines) fineLines.visible = edit && !!ghost && stepOf(ghost.type) < 1; }
  const padMat = new THREE.MeshBasicMaterial({ color: '#7dff8a', transparent: true, opacity: .5, depthWrite: false });
  function ghostCheck() {
    if (!ghost) return;
    ghost.ok = !!farm && fits(farm, ghost.type, ghost.x, ghost.y, ghost.r, ghost.id);
    const [w, h] = footprint(ghost.type, ghost.r);
    if (LINKS[ghost.type] || ghost.type === 'arch' || PATHS[ghost.type]) { const link = ghost.type === 'arch' || PATHS[ghost.type] ? linkOf(ghost, farm, ghost.id) : fenceLink(farm?.items, ghost.x, ghost.y, ghost.r, ghost.id); if (link !== ghost.link) { scene.remove(ghost.g); disposeModel(ghost.g); ghost.g = ghostModel(ghost.type, ghost.id, link); scene.add(ghost.g); ghost.link = link; } } // shows how it will join
    placeModel(ghost.g, ghost.type, ghost.x, ghost.y, ghost.r); ghost.g.position.y = .12;
    ghost.box = new THREE.Box3().setFromObject(ghost.g); // the floating buttons keep clear of it
    ghost.pad.scale.set(w, h, 1); ghost.pad.position.set(wx(ghost.x, w), .03, wz(ghost.y, h));
    padMat.color.set(ghost.ok ? '#7dff8a' : '#ff6b5a');
    onGhost?.(ghostInfo());
  }
  // a fence dropped half a tile off a line falls into it (fence.js fenceSnap)
  const snapGhost = (x, y) => !farm ? [x, y] : LINKS[ghost.type] ? fenceSnap(farm.items, x, y, ghost.r, ghost.id, (a, b) => fits(farm, ghost.type, a, b, ghost.r, ghost.id))
    : PATHS[ghost.type] ? pathSnap(farm.items, ghost.type, x, y, ghost.r, ghost.id, (a, b) => fits(farm, ghost.type, a, b, ghost.r, ghost.id)) : [x, y]; // a path tile slides in line with its kind too
  const ghostInfo = () => ghost && { type: ghost.type, id: ghost.id, x: ghost.x, y: ghost.y, r: ghost.r, ok: ghost.ok };
  function ghostModel(type, id, link) {
    const g = itemModel(type, false, false, id ? levelOf(farm.items.find(i => i.id === id) || { type }) : 1, link);
    g.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = .8; m.castShadow = false; m.userData.baked = true; } });
    return g;
  }
  function ghostStart(type, id, x, y, r) {
    ghostCancel(true);
    const g = ghostModel(type, id, type === 'museum' ? linkOf({ type }) : 0);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), padMat); pad.rotation.x = -Math.PI / 2;
    scene.add(g, pad);
    ghost = { type, id, x, y, r, g, pad, ok: false, link: 0 };
    if (id && (LINKS[type] || PATHS[type])) syncItems(); // the fences next to the one picked up let go of it
    for (const [iid, e] of items) e.g.visible = iid !== id;
    renderer.shadowMap.needsUpdate = true;
    gridVis(); ghostCheck();
  }
  function ghostCancel(quiet) {
    if (!ghost) return;
    const relink = ghost.id && (LINKS[ghost.type] || PATHS[ghost.type]);
    scene.remove(ghost.g, ghost.pad); disposeModel(ghost.g); ghost.pad.geometry.dispose(); ghost = null;
    if (relink) syncItems();
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
    if (edit) return null; // hidden while building
    let best = null, bd = .6;
    for (const [id, p] of pets) { const c = p.g.position.clone(); c.y += .3 * (p.g.userData.base / PET_SIZE); const d = ray.ray.distanceToPoint(c); if (d < bd * (p.fixed ? 1.6 : 1)) { bd = d; best = id; } }
    return best;
  }
  // ---------- highlights ----------
  // What the mouse is over gets a white rim and a ring on the ground; what is selected (its card is open) gets a
  // golden rim and a turning ring. Both are a second, slightly larger copy of the model's own outline.
  const markGeo = new THREE.RingGeometry(.86, 1, 40), dashGeo = new THREE.RingGeometry(.84, 1, 40, 1, 0, .5);
  const marks = { hover: { c: '#ffffff', o: .85 }, pick: { c: '#ffd84a', o: 1 } };
  for (const m of Object.values(marks)) {
    m.rim = new THREE.MeshBasicMaterial({ color: m.c, side: THREE.BackSide }); m.uT = { value: .06 }; m.rim.onBeforeCompile = sh => { sh.uniforms.uT = m.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * uT;'); }; m.rim.customProgramCacheKey = () => 'pfrim';
    m.ring = new THREE.Group(); m.ring.visible = false; m.ring.rotation.x = -Math.PI / 2; scene.add(m.ring);
    const mt = new THREE.MeshBasicMaterial({ color: m.c, transparent: true, opacity: m.o, depthWrite: false });
    if (m === marks.pick) for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(dashGeo, mt); d.rotation.z = i * 1.0472; m.ring.add(d); } else m.ring.add(new THREE.Mesh(markGeo, mt));
    m.key = ''; m.glow = null;
  }
  const keyOf = t => !t ? '' : t.pet ? 'p' + t.pet : t.item ? 'i' + t.item : '';
  function setMark(kind, t) {
    const m = marks[kind], key = keyOf(t); if (m.key === key && (!key || m.alive?.())) return;
    if (m.glow) { m.glow.parent?.remove(m.glow); m.glow = null; }
    m.key = key; m.t = t; m.ring.visible = false; m.alive = null;
    const p = t?.pet && pets.get(t.pet), e = t?.item && items.get(t.item), root = p ? p.g : e ? e.g : null; if (!root) { m.key = ''; return; }
    let hull = null; root.traverse(o => { if (!hull && o.userData.ink && o !== marks.hover.glow && o !== marks.pick.glow) hull = o; });
    if (hull) { m.glow = new THREE.Mesh(hull.geometry, m.rim); m.glow.scale.copy(hull.scale); m.uT.value = (kind === 'pick' ? .085 : .06) / (hull.getWorldScale(new THREE.Vector3()).x || 1); m.glow.position.copy(hull.position); m.glow.quaternion.copy(hull.quaternion); m.glow.userData.noInk = true; hull.parent.add(m.glow); }
    const it = e && farm?.items.find(i => i.id === t.item), [w, h] = it ? footprint(it.type, it.r) : [0, 0];
    m.size = p ? [.42 * p.g.userData.base / PET_SIZE, .42 * p.g.userData.base / PET_SIZE] : [w / 2 + .12, h / 2 + .12];
    m.alive = p ? () => pets.get(t.pet) === p : () => items.get(t.item) === e; m.root = root; m.ring.visible = true;
  }
  function moveMarks(T) {
    for (const [kind, m] of Object.entries(marks)) {
      if (!m.key) continue;
      if (!m.alive()) { setMark(kind, null); continue; }
      const pulse = kind === 'pick' ? 1 + Math.sin(T * 4) * .04 : 1, sq = Math.max(m.size[0], m.size[1]), rnd = m.t.pet || Math.abs(m.size[0] - m.size[1]) < .01;
      m.ring.visible = !(kind === 'hover' && marks.pick.key === m.key) && m.root.visible;
      m.ring.position.set(m.root.position.x, .03 + (kind === 'pick' ? .005 : 0), m.root.position.z);
      m.ring.scale.set((rnd ? sq : m.size[0]) * 1.2 * pulse, (rnd ? sq : m.size[1]) * 1.2 * pulse, 1); m.ring.rotation.z = kind === 'pick' && rnd ? T * .8 : 0; // an oval under a long piece stays put: spinning it would swing the oval round
      if (m.glow) m.glow.visible = !(kind === 'hover' && marks.pick.key === m.key);
    }
  }
  // what the pointer is over right now (mouse only: a finger has nothing to hover with)
  let hoverEv = null, hoverIsle = null;
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') hoverEv = e; });
  canvas.addEventListener('pointerleave', () => { hoverEv = null; setMark('hover', null); hoverIsle = null; canvas.style.cursor = ''; });
  function hoverNow() {
    if (!hoverEv || drag?.moved || fighting) { if (!hoverEv || fighting) { setMark('hover', null); hoverIsle = null; canvas.style.cursor = ''; } return; }
    const g = groundAt(hoverEv), tx = g ? g.x + N / 2 : -1, ty = g ? g.z + N / 2 : -1;
    if (mapOn) { hoverIsle = flyTo ? null : isleAt(); setMark('hover', null); canvas.style.cursor = hoverIsle ? 'pointer' : ''; return; }
    hoverIsle = null;
    if (ghost) { setMark('hover', null); canvas.style.cursor = ''; return; }
    const pid = petAt(), it = !pid && tx >= 0 && itemAt(tx, ty), t = pid && !edit ? { pet: pid } : it && !starters ? { item: it.id } : null;
    setMark('hover', t); canvas.style.cursor = t ? 'pointer' : '';
  }

  const ptrs = new Map(); let drag = null, pinch = 0, pinchAt = null;
  canvas.addEventListener('contextmenu', e => e.preventDefault()); // the right button pans
  canvas.addEventListener('pointerdown', e => {
    // A first finger means no other finger is down: forget any touch whose end never arrived (a system swipe, the
    // tab hidden mid-touch). A stuck one turned every later drag into a two-finger pinch, so the camera seemed dead.
    if (e.isPrimary) { ptrs.clear(); pinch = 0; pinchAt = null; }
    try { canvas.setPointerCapture(e.pointerId); } catch {} ptrs.set(e.pointerId, e);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); pinchAt = null; drag = null; return; }
    const g = groundAt(e), tx = g ? g.x + N / 2 : -1, ty = g ? g.z + N / 2 : -1, st = ghost ? stepOf(ghost.type) : 1; // tx, ty: where on the grid, in tiles
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false,
      mode: ghost && inGhost(tx, ty) ? 'ghost' : e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit', ox: snap(tx, st) - (ghost?.x || 0), oy: snap(ty, st) - (ghost?.y || 0) };
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, e);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
      if (pinch) { if (mapOn) zoomMap(pinch / d); else { cam.zoom = 0; cam.dist = Math.min(N * 2.6, Math.max(7, cam.dist * pinch / d)); if (!starters && !fighting && pinchAt) panBy(mx - pinchAt[0], my - pinchAt[1]); } } pinch = d; pinchAt = [mx, my]; return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 7) drag.moved = true;
    if (!drag.moved) return;
    if (drag.mode === 'ghost') {
      const g = groundAt(e); if (!g) return;
      const [w, h] = footprint(ghost.type, ghost.r), st = stepOf(ghost.type);
      const nx = Math.max(0, Math.min(N - w, snap(g.x + N / 2, st) - drag.ox)), ny = Math.max(0, Math.min(N - h, snap(g.z + N / 2, st) - drag.oy));
      const [sx, sy] = snapGhost(nx, ny);
      if (sx !== ghost.x || sy !== ghost.y) { ghost.x = sx; ghost.y = sy; ghostCheck(); }
    } else if (mapOn) { cam.waz -= dx * .006; }
    else if (drag.mode === 'pan') { if (!starters && !fighting) panBy(dx, dy); }
    else if (!starters) { cam.az -= dx * .006; cam.el = Math.min(1.35, Math.max(.16, cam.el + dy * .005)); }
  });
  const up = e => {
    if (!ptrs.delete(e.pointerId)) return;
    pinch = 0; pinchAt = null;
    const d = drag; drag = null;
    if (!d || d.moved || performance.now() - d.t > 500 || ptrs.size) return;
    const g = groundAt(e), tx = g ? g.x + N / 2 : -1, ty = g ? g.z + N / 2 : -1;
    if (fighting) return;
    if (mapOn) { const i = isleAt(); if (i && !flyTo) { if (i.zone) onPick?.({ zone: i.zone }); else flyTo = { i, t: 0 }; } return; }
    const pid = petAt();
    if (starters) { if (pid) onPick?.({ starter: pid.slice(8) }); return; }
    if (ghost) { // tap a tile: the piece jumps there
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) return;
      const [w, h] = footprint(ghost.type, ghost.r), st = stepOf(ghost.type); // centre the piece on the tapped spot
      [ghost.x, ghost.y] = snapGhost(Math.max(0, Math.min(N - w, snap(tx - (w - st) / 2, st))), Math.max(0, Math.min(N - h, snap(ty - (h - st) / 2, st)))); ghostCheck(); return;
    }
    if (pid && !edit) { pets.get(pid).hop = 1; onPick?.({ pet: pid }); return; }
    const it = tx >= 0 && itemAt(tx, ty);
    if (it && !edit) { const e = items.get(it.id); if (e && e.pop <= 0) e.pop = .45; } // a little squash to show the tap landed
    onPick?.(it ? { item: it.id } : { nothing: true });
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', e => { if (ptrs.has(e.pointerId)) { ptrs.delete(e.pointerId); pinch = 0; pinchAt = null; if (!ptrs.size) drag = null; } });
  const zoomMap = k => { mapZoom = Math.min(1, Math.max(Math.min(1, 26 / mapFar), mapZoom * k)); };
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (mapOn) return zoomMap(Math.exp(e.deltaY * .0012)); cam.zoom = 0; cam.dist = Math.min(N * 2.6, Math.max(7, cam.dist * Math.exp(e.deltaY * .0012))); }, { passive: false });

  // ---------- frame ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === H || !w || !h) return;
    W = w; H = h; liftNow = -1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  let T = 0;
  let warming = false; // while the shaders compile in the background, nothing is drawn (drawing would compile them all at once)
  // Shaders are compiled a few at a time before the first picture, so the page never freezes for seconds. Where the browser
  // can compile in the background (KHR_parallel_shader_compile, most Chrome-based browsers) three.js does it all at once.
  // Firefox and some drivers can't: there a program is built the first time it is used, all of them in the first frame,
  // which froze the page on an empty sky. So each new program is built on its own, with a frame for the page in between.
  const parallel = !!renderer.extensions.has('KHR_parallel_shader_compile'), built = new WeakSet();
  const breath = () => new Promise(r => { const t = setTimeout(r, 40); requestAnimationFrame(() => { clearTimeout(t); r(); }); });
  async function buildShaders(root) {
    if (parallel) { await Promise.race([renderer.compileAsync(root, camera).catch(() => {}), new Promise(r => setTimeout(r, 4000))]); return; }
    // one object per kind of program: same material, same shadow and instancing settings, same vertex colours
    const seen = new Set(), todo = [];
    root.traverse(o => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
      const k = [].concat(o.material).map(m => m.uuid).join() + (o.receiveShadow ? 'r' : '') + (o.isInstancedMesh ? 'i' : '') + (o.isSkinnedMesh ? 's' : '') + (o.geometry?.attributes.color ? 'c' : '') + (o.geometry?.morphAttributes.position ? 'm' : '');
      if (!seen.has(k)) { seen.add(k); todo.push(o); }
    });
    const progs = renderer.info.programs; let t = performance.now();
    for (const o of todo) {
      if (dead) return;
      try { renderer.compile(o, camera, root); } catch (e) { console.warn('shader', e); }
      for (const p of progs) if (!built.has(p)) { built.add(p); p.getUniforms(); } // links it now, not in the first frame
      if (performance.now() - t > 10) { await breath(); t = performance.now(); }
    }
  }
  // Resolves once a real frame of the island has been drawn and is on screen.
  let drawnWait = [];
  const afterDraw = () => { if (!drawnWait.length) return; const w = drawnWait; drawnWait = []; requestAnimationFrame(() => w.forEach(f => f())); };
  function loop(dt) {
    if (dead) return;
    resize(); if (warming) return; T += dt;
    lift = mapOn ? 0 : fighting ? .1 : starters ? .2 : edit ? .13 : 0;
    if (lift !== liftNow && W) { liftNow = lift; if (lift) camera.setViewOffset(W, H, 0, lift * H, W, H); else camera.clearViewOffset(); }
    if (fighting) { // a fixed view of the ring, further back on narrow screens
      const d = Math.max(7.2, 7.4 * H / Math.max(1, W));
      const sk = fx.shake * .12, v = fx.view, z = 1 - v.zoom, sway = Math.sin(T * .23) * .45; // drifts a little, leans in on the action
      camera.position.set((-1.2 + sway) * z + v.x * .3 + Math.sin(T * 61) * sk, d * .42 * z + Math.sin(T * 47) * sk, d * z + v.z * .3); camera.lookAt(v.x * .45, .95, v.z * .45);
      moveRing(dt, T); renderer.render(ring, camera); afterDraw(); return;
    }
    if (mapOn) { // the neighbourhood from above; drag to turn it
      const d = mapFar * mapZoom * Math.max(1, 1.2 * H / Math.max(1, W)), off = mapOut * (1 - mapZoom) * .8; // zoomed in, the view slides to the near side: turn the map to bring islands round
      _look.set(Math.sin(cam.waz) * off, 0, Math.cos(cam.waz) * off); camera.position.set(_look.x + Math.sin(cam.waz) * d * .72, d * .7, _look.z + Math.cos(cam.waz) * d * .72);
      if (flyTo) { // swoop towards the island that was tapped, then open it
        flyTo.t = Math.min(1, flyTo.t + dt / .55); const u = flyTo.t * flyTo.t * (3 - 2 * flyTo.t), p = flyTo.i.g.position;
        _look.lerp(p, u); _wc.set(p.x + Math.sin(cam.waz) * 9, p.y + 8, p.z + Math.cos(cam.waz) * 9); camera.position.lerp(_wc, u);
        if (flyTo.t >= 1 && !flyTo.done) { flyTo.done = true; onPick?.({ island: flyTo.i.id }); }
      }
      camera.lookAt(_look);
      hoverNow();
      for (const i of isles) { i.hs = (i.hs || 1) + ((i === hoverIsle ? 1.1 : 1) - (i.hs || 1)) * Math.min(1, dt * 12); i.g.scale.setScalar(i.hs); i.g.position.y = i.y + Math.sin(T * .7 + i.ph) * .18 + (i.hs - 1) * 4; const ic = i.g.userData.icons; if (ic) { ic.rotation.y = T * 1.2; ic.position.y = 2.5 + Math.sin(T * 2 + i.ph) * .12; } }
      for (const f of flights) { // a tenth of the trip flying out, a tenth flying home, the rest spent there
        const left = Math.max(0, f.end - performance.now()), u = 1 - left / f.total, k = left <= 0 ? 0 : u < .1 ? u / .1 : u > .9 ? (1 - u) / .1 : 1, e = k * k * (3 - 2 * k);
        f.b.position.set(f.to.x * e, 2.2 + (f.to.y + 1.4 - 2.2) * e + Math.sin(e * Math.PI) * 3 + Math.sin(T * 1.3) * .12, f.to.z * e); f.b.rotation.y = Math.sin(T * .5) * .3;
      }
      wclouds.rotation.y += dt * .006 * (1 + air.wind * 6); moveAir(dt, T, true);
      mapBirds(T);
      renderer.render(world, camera); afterDraw(); return;
    }
    const k = Math.max(1, (starters ? 1.1 : .75) * H / Math.max(1, W)); // narrow screens need to stand further back
    const fp = cam.follow && pets.get(cam.follow); if (cam.follow && !fp) followPet(null); else if (fp) { cam.gx = fp.g.position.x; cam.gz = fp.g.position.z; }
    const ease = Math.min(1, dt * 5); cam.tx += (cam.gx - cam.tx) * ease; cam.tz += (cam.gz - cam.tz) * ease;
    if (cam.zoom) { cam.dist += (cam.zoom - cam.dist) * Math.min(1, dt * 4); if (Math.abs(cam.zoom - cam.dist) < .05) cam.zoom = 0; }
    const d = cam.dist * k, ce = Math.cos(cam.el);
    camera.position.set(cam.tx + Math.sin(cam.az) * ce * d, Math.sin(cam.el) * d, cam.tz + Math.cos(cam.az) * ce * d);
    camera.lookAt(cam.tx, starters ? .9 : 0, cam.tz);
    if (starters) for (const sp of STARTERS) { const p = pets.get('starter:' + sp); if (p) { p.face = 0; if (sp === starSel && p.hop <= 0) p.hop = 1; } }
    hoverNow(); movePets(dt, T); moveBalloon(dt, T); moveItems(dt, T); moveFlies(T); movePeople(dt, T); moveBits(dt); moveTufts(T); movePetals(T); farmBirds(T); moveMarks(T);
    if (egg) { const k = egg.ready ? 1 : .25, t = T * (egg.ready ? 9 : 3); egg.g.rotation.z = Math.sin(t) * .16 * k * (Math.sin(T * 1.3) > -.2 ? 1 : 0); egg.g.position.y = .22 + (egg.ready ? Math.abs(Math.sin(T * 4.5)) * .08 : 0); }
    clouds.rotation.y += dt * .006 * (1 + air.wind * 6); moveAir(dt, T);
    for (const d of drift) d.position.y = d.userData.y + Math.sin(T * .7 + d.userData.ph) * .25;
    for (const [f, z, i] of falls) { if (z != null) f.position.z = z + Math.sin(T * 9) * .14; else { const u = (T * .7 + i / 3) % 1; f.scale.setScalar(.5 + u); f.material.opacity = .55 * (1 - u); } }
    for (const f of landTicks) f(T);
    if (skyLook) skyLook.tick(T, air.night, camera);
    pieceBits.forEach((b, i) => { const a = b.a + T * .08; b.g.position.set(Math.cos(a) * b.r, b.y + Math.sin(T * 1.1 + i) * .3, Math.sin(a) * b.r); b.g.rotation.set(Math.sin(T * .7 + i) * .4, T * b.spin, 0); });
    if (ghost) ghost.g.position.y = .12 + Math.sin(T * 4) * .04;
    if (ghost && onGhostAt) { // pinned to the piece's square on the floor, so turning it never moves the buttons
      const it = ITEMS[ghost.type], w = Math.max(it.w, it.h), h = w, gx = wx(ghost.x, w), gz = wz(ghost.y, h), top = ghost.box?.max.y || 1; // the square every turn of it fits in, from its corner
      let cx = 0, y0 = 1e9, y1 = -1e9, front = true;
      for (let i = 0; i < 8; i++) { // the floor square's corners, and the same raised to the piece's height (for the "above" fallback)
        ghostAt.set(gx + (i & 1 ? w : -w) / 2, i & 4 ? top : 0, gz + (i & 2 ? h : -h) / 2).project(camera);
        const sy = (1 - ghostAt.y) / 2 * H; if (ghostAt.z >= 1) front = false;
        y0 = Math.min(y0, sy); if (!(i & 4)) y1 = Math.max(y1, sy);
      }
      ghostAt.set(gx, 0, gz).project(camera); cx = (ghostAt.x + 1) / 2 * W;
      onGhostAt(cx, y0, y1, front);
    }
    renderer.render(scene, camera); afterDraw();
  }
  buildLand();
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });
  renderer.shadowMap.needsUpdate = true;

  // the owner's sky friend (skyfriends.js): flies round the island; the sky, light and weather stay the farm's own
  let skyLook = null, pieceBits = [], isleKey = '';
  function lookSky() {
    if (skyLook) { scene.remove(skyLook.root); skyLook.dispose(); skyLook = null; }
    skyLook = skyFriend(look.ik, { s: (N / 2 + 5) / 3.4 }); if (skyLook) scene.add(skyLook.root);
    for (const b of pieceBits) { scene.remove(b.g); disposeModel(b.g); } pieceBits = [];
    (look.fp || []).forEach((id, i, all) => { const g = pieceModel(id); g.scale.setScalar(2.2); scene.add(g); pieceBits.push({ g, r: N / 2 + 5 + (i % 2) * 1.2, a: i / all.length * 6.283, y: 1.5 + (i * 7 % 5) * .5, spin: [0, 1, .4, .7, .2, .9][i % 6] }); });
  }
  return {
    // the owner's isle look: { ig ground, ib rock base, ik sky friend, fp floating pieces }; rebuilt only when it changes
    setLook(lk) { const next = { ...look, ...lk }, k = JSON.stringify(next); if (k === isleKey) return; isleKey = k; look = next; buildLand(); lookSky(); renderer.shadowMap.needsUpdate = true; },
    setFarm(f) {
      const size = f?.size || 10;
      const fk = f ? f.id || f.owner || f.name || '?' : ''; if (fk !== farmKey) { farmKey = fk; seenOnce = false; }
      farm = f;
      if (size !== N) { N = size; for (const id of [...pets.keys()]) if (!String(id).startsWith('starter:')) dropPet(id); for (const e of items.values()) e.key = ''; buildLand(); lookSky(); }
      syncItems(); syncPets(); placeTufts(); placeFlowers(); syncBalloon(); syncEgg(); syncOwner();
      if (ghost) ghostCheck();
    },
    setStarters,
    // Compile the shaders for what is on the island now without freezing the page, before the first picture.
    // Resolves when the island can be drawn.
    warm() {
      if (warming) return Promise.resolve();
      warming = true; const t0 = performance.now(); res.prep(scene);
      return buildShaders(scene).catch(e => console.warn('warm', e)).then(() => { warming = false; renderer.shadowMap.needsUpdate = true; return performance.now() - t0; });
    },
    // Resolves after the next real frame has been drawn and shown (the loading note stays up until then).
    drawn: () => new Promise(r => drawnWait.push(r)),
    setSky(hour, weather) { airTo.hour = hour; airTo.w = weather; },
    setOwner(o, g = []) { owner = o; guests = g; if (farm) syncOwner(); },
    setEdit(on) { edit = !!on; gridVis(); if (!edit) ghostCancel(); },
    // the pet or building whose card is open: { pet: id } or { item: id } or null
    select(t) { const k = keyOf(t); if (k !== marks.pick.key) followPet(t?.pet || null); setMark('pick', t); },
    ghostNew(type, near = null, r = 0) { if (!farm || !ITEMS[type]) return; const [x, y] = firstSpot(type, near, r); ghostStart(type, null, x, y, r); },
    ghostItem(id) { const it = farm?.items.find(i => i.id === id); if (it) ghostStart(it.type, it.id, it.x, it.y, it.r); },
    pan(dx, dy) { if (!starters && !fighting && !mapOn) panBy(dx, dy); },
    ghostRotate() {
      if (!ghost) return;
      ghost.r = (ghost.r + (canTilt(ghost.type) ? .5 : 1)) % 4; // eight steps; the Flower Arch four
      const [w, h] = footprint(ghost.type, ghost.r); ghost.x = Math.max(0, Math.min(N - w, ghost.x)); ghost.y = Math.max(0, Math.min(N - h, ghost.y));
      ghostCheck();
    },
    ghostCancel: () => ghostCancel(),
    ghost: ghostInfo,
    // a short flurry at every building of a kind (cooking, crafting), or a hop for one building
    work(type, secs = 6) { for (const e of items.values()) if (e.type === type) e.burst = secs; },
    pop(id) { const e = items.get(id); if (e) e.pop = 1; },
    cheer(id) { const p = pets.get(id); if (p) p.hop = 1; },
    hearts(id) { const p = pets.get(id); if (!p) return; p.hop = 1; const y = (p.topY ??= new THREE.Box3().setFromObject(p.g).max.y - p.g.position.y) + .1; for (let i = 0; i < 6; i++) setTimeout(() => floatUp(BIT.heart, BM.heart, p.x + (Math.random() - .5) * .5, y, p.z + (Math.random() - .5) * .3, .08, 1.8), i * 140); }, // a favourite treat: a burst of hearts
    // the battle ring: show it, put a pet on a side (0 yours, 1 theirs), and play what happens
    setWorld,
    setBattle(on) { fighting = !!on; liftNow = -1; if (!on) { ringPet(0, null); ringPet(1, null); fx.clear(); } },
    ringPet,
    ringFx(s, what) { const p = bp[s]; if (!p) return; if (what === 'lunge') p.lunge = 1; else if (what === 'hit') p.shake = 1; else if (what === 'hop') p.hop = 1; else if (what === 'faint') { p.down = true; fx.faint(s); } else if (what === 'win') { p.win = true; p.t = 0.7; fx.win(s); } },
    // a move played out in the ring: returns the milliseconds until it lands
    ringMove(s, id, el) { return bp[s] ? Math.round(fx.move(s, id, el) * 1000) : 300; },
    // what happens to the pet on side s: 'hit' (el, eff), 'burn', 'heal', 'stat' (d), 'status' (st), 'dazed'
    ringHit(s, what, a, b) { const p = bp[s]; if (!p) return; if (what === 'hit') { p.shake = .6; fx.hit(s, a, b); } else if (what === 'burn') { p.shake = .4; fx.burn(s); } else if (what === 'heal') fx.heal(s); else if (what === 'stat') fx.stat(s, a); else if (what === 'status') fx.status(s, a); else if (what === 'dazed') fx.dazed(s); },
    ringState(s, list, low) { if (bp[s]) bp[s].low = !!low && !bp[s].down; fx.state(s, low && bp[s] && !bp[s].down ? [...list, 'tired'] : list); },
    // where the pet on side s is on the screen, for numbers that float up from it
    ringSpot(s) { _sp.set(HOME[s].x, 1.25, HOME[s].z).project(camera); return { x: (_sp.x + 1) / 2 * W, y: (1 - _sp.y) / 2 * H }; },
    // One pet as it really looks (form, coat, markings), for cards and the family tree. Kept, so each look is drawn once.
    portrait(sp, form = 0, look = null) { const k = sp + form + lookKey(look); if (!shots.has(k)) { const g = petModel(sp, form, look); shots.set(k, photo(g, true, 128) || ''); disposeModel(g); } return shots.get(k); },
    // Little pictures for the build menu, drawn once with a throwaway renderer.
    thumbs(types, size = 112) {
      const out = {};
      for (const t of types) { const pet = t.startsWith('pet:'), g = pet ? petModel(t.slice(4), 0) : itemModel(t); const u = photo(g, pet, size); if (u) out[t] = u; disposeModel(g); }
      return out;
    },
    dispose() {
      dead = true; ticker.stop(); look = { ...look, ik: 0, fp: [] }; lookSky(); if (shotT) { shotT.dispose(); shotT = null; }
      ghostCancel(true);
      for (const id of [...pets.keys()]) dropPet(id);
      for (const e of items.values()) disposeModel(e.g);
      for (const q of people.values()) disposeAvatar(q.g);
      scene.traverse(o => { if (o.isMesh || o.isLineSegments) { o.geometry?.dispose?.(); } });
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

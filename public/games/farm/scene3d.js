// Pet Farm 3D scene: a low-poly island with a tile grid, the player's buildings and their wandering pets.
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
import { ITEMS, STARTERS, footprint, fits, occupied, formOf } from './data.js';
import { itemModel, petModel, disposeModel } from './models.js';

const SKY = '#bfe8ff';

export function createScene(canvas, { onPick, onGhost }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY);
  const camera = new THREE.PerspectiveCamera(36, 1, .5, 200);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9d6a8', 1.5));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.1); sun.position.set(9, 16, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; scene.add(sun, sun.target);

  let farm = null, N = 10, edit = false, dead = false, W = 0, H = 0;
  const cam = { az: .6, el: .82, dist: 19, tx: 0, tz: 0 };
  let lift = 0, liftNow = -1; // how far the picture is pushed up to clear the panels at the bottom (share of the height)
  const wx = (x, w = 1) => x + w / 2 - N / 2, wz = (y, h = 1) => y + h / 2 - N / 2;

  // ---------- the island ----------
  let land = null, gridLines = null;
  const sea = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshStandardMaterial({ color: '#7fcdf0', roughness: .6, flatShading: true }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -1.5; scene.add(sea);
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
    for (const [x, r] of [[0, 1.2], [1.3, .9], [-1.2, .8]]) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m); p.position.set(x, 0, 0); p.scale.y = .6; c.add(p); }
    c.scale.setScalar(2.4); c.position.set(-70 + i * 26, 1 + (i % 3) * 4, i % 2 ? -52 - i * 3 : 56 + i * 3); c.userData.v = .5 + (i % 3) * .2; scene.add(c); clouds.push(c);
  }
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
    mk(new THREE.CylinderGeometry(R + .7, R * .55, 1.6, 4), '#b98a5e', -1.3).rotation.y = Math.PI / 4;
    mk(new THREE.CylinderGeometry(R * .55, R * .2, 1.4, 4), '#9a6f4a', -2.8).rotation.y = Math.PI / 4;
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
    scene.add(land);
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
    walkGrid = occupied(farm, { walkable: true });
    const seen = new Set();
    const house = farm.items.find(i => i.type === 'house');
    for (const pet of farm.pets) {
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
    ghostCheck();
  }
  function ghostCancel(quiet) {
    if (!ghost) return;
    scene.remove(ghost.g, ghost.pad); disposeModel(ghost.g); ghost.pad.geometry.dispose(); ghost = null;
    for (const e of items.values()) e.g.visible = true;
    renderer.shadowMap.needsUpdate = true;
    if (!quiet) onGhost?.(null);
  }
  // A good first spot for a new piece: the free place nearest the middle of the view.
  function firstSpot(type, near, r) {
    const [w, h] = footprint(type, r), cx = near ? near[0] : Math.round(N / 2 - w / 2), cy = near ? near[1] : Math.round(N / 2 - h / 2);
    let best = null, bd = 1e9;
    for (let y = 0; y <= N - h; y++) for (let x = 0; x <= N - w; x++) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd && fits(farm, type, x, y, r)) { bd = d; best = [x, y]; } }
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
    const g = groundAt(e), tx = g ? Math.floor(g.x + N / 2) : -1, ty = g ? Math.floor(g.z + N / 2) : -1;
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false,
      mode: ghost && inGhost(tx, ty) ? 'ghost' : 'orbit', ox: tx - (ghost?.x || 0), oy: ty - (ghost?.y || 0) };
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
      const [w, h] = footprint(ghost.type, ghost.r);
      const nx = Math.max(0, Math.min(N - w, Math.floor(g.x + N / 2) - drag.ox)), ny = Math.max(0, Math.min(N - h, Math.floor(g.z + N / 2) - drag.oy));
      if (nx !== ghost.x || ny !== ghost.y) { ghost.x = nx; ghost.y = ny; ghostCheck(); }
    } else if (!starters) { cam.az -= dx * .006; cam.el = Math.min(1.35, Math.max(.3, cam.el + dy * .005)); }
  });
  const up = e => {
    if (!ptrs.delete(e.pointerId)) return;
    pinch = 0;
    const d = drag; drag = null;
    if (!d || d.moved || performance.now() - d.t > 500 || ptrs.size) return;
    const g = groundAt(e), tx = g ? Math.floor(g.x + N / 2) : -1, ty = g ? Math.floor(g.z + N / 2) : -1;
    const pid = petAt();
    if (starters) { if (pid) onPick?.({ starter: pid.slice(8) }); return; }
    if (ghost) { // tap a tile: the piece jumps there
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) return;
      const [w, h] = footprint(ghost.type, ghost.r);
      ghost.x = Math.max(0, Math.min(N - w, tx - (w - 1 >> 1))); ghost.y = Math.max(0, Math.min(N - h, ty - (h - 1 >> 1))); ghostCheck(); return;
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
    lift = starters ? .2 : edit ? .13 : 0;
    if (lift !== liftNow && W) { liftNow = lift; if (lift) camera.setViewOffset(W, H, 0, lift * H, W, H); else camera.clearViewOffset(); }
    const k = Math.max(1, (starters ? 1.1 : .75) * H / Math.max(1, W)); // narrow screens need to stand further back
    const d = cam.dist * k, ce = Math.cos(cam.el);
    camera.position.set(cam.tx + Math.sin(cam.az) * ce * d, Math.sin(cam.el) * d, cam.tz + Math.cos(cam.az) * ce * d);
    camera.lookAt(cam.tx, starters ? .9 : 0, cam.tz);
    if (starters) for (const sp of STARTERS) { const p = pets.get('starter:' + sp); if (p) { p.face = 0; if (sp === starSel && p.hop <= 0) p.hop = 1; } }
    movePets(dt, T);
    for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 80) c.position.x = -80; }
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
      syncItems(); syncPets();
      if (ghost) ghostCheck();
    },
    setStarters,
    setEdit(on) { edit = !!on; if (gridLines) gridLines.visible = edit; if (!edit) ghostCancel(); },
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

// Sugar Siege's 3D scene: the side-on block island (one instanced mesh for every block), the sea that rises with the
// sugar tide, the teams' Pet Farm pets, the players' avatars on rocks at the island's ends, flying snacks, splashes
// and the aiming arc. The page (client.js) owns the rules, the HUD and the input; this file draws what the server sent.
// Cost: the island is one draw call, particles one more (createFx), each pet a few baked meshes; no shadow maps.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { island, skyDome, clouds, nightScene, createFx, toonify, toonMat, disposeToon, flat, PROPS, STAR, DOT } from '../../scenery3d.js';
import { lookOf } from '../../season3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import * as R from './rules.js';

const { BS, COLS, ROWS, W } = R;
export const PZ = .55;            // the pets' plane (in front of the island's middle)
const DEPTH = 2.6, ZC = -.4;      // the island's thickness and centre
const K = .6;                     // avatars' size (a scale on a wrapper: standing-avatar rule)
const LIFT = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 };
const PET_K = [.72, .67, .6];    // pet model size by growth form
const mat = c => flat(c);

// one flying snack, as a little model
function snackModel(k) {
  const g = new THREE.Group(), add = (geo, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c); m.position.set(x, y, z); g.add(m); return m; };
  if (k === 'pie') { add(new THREE.CylinderGeometry(.3, .24, .14, 10), '#e8b06a'); add(new THREE.CylinderGeometry(.24, .24, .05, 10), '#e0524f', 0, .08); g.rotation.x = 1.2; }
  else if (k === 'jelly') { add(new THREE.CylinderGeometry(.18, .26, .32, 8), mat('#7ed37a')); add(new THREE.IcosahedronGeometry(.07, 0), '#e0524f', 0, .2); }
  else if (k === 'berry') for (let i = 0; i < 4; i++) add(new THREE.IcosahedronGeometry(.13, 1), '#6c5ce7', Math.cos(i * 1.6) * .12, Math.sin(i * 1.6) * .12);
  else if (k === 'mini') add(new THREE.IcosahedronGeometry(.13, 1), '#6c5ce7');
  else if (k === 'cake') { add(new THREE.CylinderGeometry(.42, .42, .3, 12), '#ffd38a'); add(new THREE.CylinderGeometry(.43, .43, .08, 12), '#fff3df', 0, .17); add(new THREE.ConeGeometry(.05, .2, 5), '#ffc93c', 0, .32); g.rotation.z = .3; }
  else if (k === 'seed') { add(new THREE.IcosahedronGeometry(.15, 0), '#a87a4c').scale.set(1, 1.3, 1); add(new THREE.ConeGeometry(.08, .22, 5), '#5fb04a', 0, .22); }
  else if (k === 'chili') { add(new THREE.ConeGeometry(.12, .5, 7), '#ff5a3c').rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(.04, .04, .12, 5), '#3f8c4a', .3, 0).rotation.z = Math.PI / 2; }
  else if (k === 'soda') { add(new THREE.CylinderGeometry(.14, .14, .42, 10), '#3f86d6'); add(new THREE.CylinderGeometry(.145, .145, .1, 10), '#ffffff'); add(new THREE.CylinderGeometry(.02, .02, .2, 4), '#ff8fab', .04, .28).rotation.z = .3; }
  else if (k === 'fizz') { add(new THREE.OctahedronGeometry(.18, 0), flat('#ffe27a', { emissive: '#ffcf3c', emissiveIntensity: .4 })); }
  else if (k === 'rock') { add(new THREE.CylinderGeometry(.24, .24, .08, 12), '#ff9ec4').rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(.16, .16, .1, 12), '#ffffff').rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(.03, .03, .42, 5), '#f4e8d8', 0, -.3); }
  g.scale.setScalar(1.8); toonify(g, .05);
  const w = new THREE.Group(); w.add(g); return w;
}

export function createScene(canvas, opts = {}) {
  const season = opts.season || 'summer', look = lookOf(season) || {};
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 2);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .5, 700);
  scene.add(new THREE.HemisphereLight('#ffffff', '#7a6a55', 1.7));
  const key = new THREE.DirectionalLight('#fff4e0', 1.6); key.position.set(-20, 40, 30); scene.add(key);
  const fill = new THREE.DirectionalLight('#cfe6ff', .45); fill.position.set(30, 12, 20); scene.add(fill);
  skyDome(scene, '#4fa8f0', '#c9ecff', { r: 320 });
  const cl = clouds({ near: 22, far: 14, below: -6, min: 30, max: 120 }); cl.position.set(W / 2, 6, -30); scene.add(cl);
  // two little islands far behind, wearing the season
  for (const [x, y, z, s, sd] of [[-14, 3, -48, 1.3, 3], [W + 12, 6, -60, 1.6, 9]]) { const isl = island(12, 9, { props: 9, seed: sd, flowers: 20, season }); isl.position.set(x, y, z); isl.scale.setScalar(s); scene.add(isl); }
  // the sea (no front slab: the island's underwater blocks take a sea tint instead)
  const seaDay = season === 'winter' ? '#7cc4ea' : '#4fb3e8'; let seaNight = -1;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 260), new THREE.MeshLambertMaterial({ color: seaDay, transparent: true, opacity: .9 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, R.WATER0, -60); scene.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, .5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(W / 2, R.WATER0 + .02, ZC + DEPTH / 2 + .25); foam.renderOrder = 1; scene.add(foam);
  const fx = createFx(scene, { max: 900 });

  // ---- the island: drawn as one smooth low-poly shape like the site's isles (the gameplay grid stays blocky).
  // Marching squares over the grid's corners gives the outline: flat tops stay on the cell edges, steps become slopes.
  // The front is coloured in bands: the season's grass or snow on top, an earth band, then flat cake layers inside.
  // The sides of the outline make the walls you see from above; an ink ribbon along the outline is the toon line.
  const N = COLS * ROWS, ZF = ZC + DEPTH / 2, ZB = ZC - DEPTH / 2;
  const toon = c => toonMat(flat(c));
  const terrain = new THREE.Mesh(new THREE.BufferGeometry(), toonMat(flat('#ffffff', { vertexColors: true })));
  const ink = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#4a2c22' }));
  terrain.frustumCulled = ink.frustumCulled = false; scene.add(terrain, ink);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), seaC = new THREE.Color();
  let grid = new Uint8Array(N), applied = 0;
  const winter = season === 'winter';
  const GRASS = look.grass || '#8bca60', PATCH = look.patch || '#7fbf56', SOIL = look.earth || '#c98a5a', ROCK = look.rock || '#857a72';
  // the cake inside, in flat bands right across the island (a hole shows the same layers wherever it is)
  const CAKE = ['#f6c97f', '#f6c97f', '#fff3df', '#f0bc6c', '#f0bc6c', '#e0524f', '#f6c97f', '#f6c97f', '#fff3df', '#8a5236', '#8a5236', '#f2c27a'];
  const hash = (i, s2) => { const x = Math.sin(i * 127.1 + s2 * 311.7) * 43758.5453; return x - Math.floor(x); };
  const isTop = (c, r) => R.cellAt(grid, c, r + 1) === 0;
  let fieldAt = () => 0;
  const cellK = (c, r) => R.cellAt(grid, c, Math.max(0, r)); // below row 0 the island just carries on into the sea
  const kindNear = (c, r) => cellK(c, r) || cellK(c, r + 1) || cellK(c - 1, r) || cellK(c + 1, r) || cellK(c, r - 1) || cellK(c - 1, r - 1) || cellK(c + 1, r - 1) || cellK(c - 1, r + 1) || cellK(c + 1, r + 1) || 1;
  function colorAt(x, y, wall) { // the colour of the island at a point (a triangle's middle)
    const c = Math.floor(x / BS), r = Math.floor(y / BS), k = kindNear(c, r);
    if (k === 2) col.set(hash(c * 7 + r, 2) < .5 ? '#5fb04a' : '#4f9a44'); // a sprout bush
    else if (k === 3) col.set(r % 2 ? '#ff9ec4' : '#fff4f8'); // rock candy
    else {
      const cc = Math.min(COLS - 1, Math.max(0, c));
      const d = fieldAt(x, y + .32) < .5 ? 0 : fieldAt(x, y + .7) < .5 ? 1 : 2; // grass, earth, cake: bands that follow the slopes
      if (wall > .35 || d === 0) col.set(winter ? (hash(cc >> 1, 5) < .5 ? '#f6faff' : '#e9f2fb') : (hash(cc >> 1, 3) < .5 ? GRASS : PATCH));
      else if (d === 1) col.set(SOIL);
      else if (r >= 0 && !cellK(cc, r - 1) && cellK(cc, r)) col.set('#c99a6a'); // the underside of an overhang: baked crust
      else col.set(CAKE[(r + 40) % CAKE.length]);
      if (wall > -2 && wall <= .35) col.offsetHSL(0, 0, -.06); // the sides of holes and cliffs, a shade darker
    }
    if (y < water - .05) col.lerp(seaC, .45);
    return col;
  }
  function rebuild() {
    seaC.set(seaNight === 1 ? '#2b3f86' : seaDay);
    const CW = COLS + 1, V = new Float32Array(CW * (ROWS + 1));
    for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) V[i + j * CW] = ((cellK(i - 1, j - 1) ? 1 : 0) + (cellK(i, j - 1) ? 1 : 0) + (cellK(i - 1, j) ? 1 : 0) + (cellK(i, j) ? 1 : 0)) / 4;
    const P = [], C = [], I = [], seg = [];
    const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, cl) => { P.push(ax, ay, az, bx, by, bz, cx, cy, cz); for (let k = 0; k < 3; k++) C.push(cl.r, cl.g, cl.b); };
    const quadInk = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => I.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz);
    const S2 = 2, H = BS / S2, VS = (i, j) => { // the corner field, sampled between corners too (half-cell steps)
      const fi = i / S2, fj = j / S2, i0 = Math.min(COLS - 1, Math.floor(fi)), j0 = Math.min(ROWS - 1, Math.floor(fj)), u = fi - i0, v = fj - j0;
      return (V[i0 + j0 * CW] * (1 - u) + V[i0 + 1 + j0 * CW] * u) * (1 - v) + (V[i0 + (j0 + 1) * CW] * (1 - u) + V[i0 + 1 + (j0 + 1) * CW] * u) * v; };
    fieldAt = (x, y) => (x < 0 || x > W || y > ROWS * BS ? 0 : VS(x / H, Math.max(0, y) / H));
    for (let r = 0; r < ROWS * S2; r++) for (let c = 0; c < COLS * S2; c++) {
      const cs = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]], vs = cs.map(([i, j]) => VS(i, j));
      if (vs.every(v => v < .5)) continue;
      const poly = []; // [x, y, onOutline]
      for (let k = 0; k < 4; k++) {
        const [i0, j0] = cs[k], [i1, j1] = cs[(k + 1) % 4], a = vs[k], b = vs[(k + 1) % 4];
        if (a >= .5) poly.push([i0 * H, j0 * H, false]);
        if ((a >= .5) !== (b >= .5)) { const t = (.5 - a) / (b - a); poly.push([(i0 + (i1 - i0) * t) * H, (j0 + (j1 - j0) * t) * H, true]); }
      }
      let mx = 0, my = 0; for (const q of poly) { mx += q[0]; my += q[1]; } mx /= poly.length; my /= poly.length;
      colorAt(mx, my, -9); const fc = col.clone();
      for (let k = 1; k < poly.length - 1; k++) tri(poly[0][0], poly[0][1], ZF, poly[k][0], poly[k][1], ZF, poly[k + 1][0], poly[k + 1][1], ZF, fc);
      for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; if (p[2] && q[2]) seg.push([p[0], p[1], q[0], q[1]]); }
    }
    for (const [ax, ay, bx, by] of seg) { // the walls along the outline, and the ink line
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L; // outward
      const wc = colorAt((ax + bx) / 2 - nx * .1, (ay + by) / 2 - ny * .1, ny).clone();
      tri(ax, ay, ZF, ax, ay, ZB, bx, by, ZB, wc); tri(ax, ay, ZF, bx, by, ZB, bx, by, ZF, wc);
      const w = .055, ex = nx * w, ey = ny * w, z = ZF + .004; // a ribbon straddling the edge, on the front
      quadInk(ax - ex * .4, ay - ey * .4, z, bx - ex * .4, by - ey * .4, z, bx + ex, by + ey, z, ax + ex, ay + ey, z);
      if (ny > .35) quadInk(ax, ay, ZB, ax, ay + w * 1.4, ZB - .01, bx, by + w * 1.4, ZB - .01, bx, by, ZB); // the far edge of the top
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
    terrain.geometry.dispose(); terrain.geometry = g;
    const gi = new THREE.BufferGeometry(); gi.setAttribute('position', new THREE.Float32BufferAttribute(I, 3)); ink.material.side = THREE.DoubleSide;
    ink.geometry.dispose(); ink.geometry = gi;
    for (const pr of props) if (pr.g.visible && !R.solidAt(grid, pr.x, pr.y - .25)) { pr.g.visible = false; fx.burst(new THREE.Vector3(pr.x, pr.y + .4, pr.z), { n: 12, colors: ['#5fb04a', '#ffffff', '#ff9fb8'], shape: STAR, speed: 3, up: 4, size: .22, grav: 9, life: .9 }); }
    for (const b of splats.list) if (b.on && !R.solidAt(grid, b.x, b.y - .08)) b.on = false;
    splats.sync();
  }
  // season props along the top, behind the pets' path; a hole under one knocks it away
  const props = [];
  function buildProps(hs) {
    for (const pr of props) { scene.remove(pr.g); disposeToon(pr.g); } props.length = 0;
    const kinds = look.kinds || ['tree', 'bush', 'pine', 'rock', 'flowers'];
    for (let c = 3; c < COLS - 3; c += 3 + Math.floor(hash(c, hs[c] || 1) * 4)) {
      let r = ROWS - 1; while (r > 0 && !R.cellAt(grid, c, r)) r--; if (r < 2) continue;
      const kind = kinds[Math.floor(hash(c, 9) * kinds.length)], g = new THREE.Group();
      (typeof kind === 'function' ? kind : PROPS[kind] || PROPS.bush)(g, .85 + hash(c, 10) * .45);
      const x = c * BS + BS / 2, y = (r + 1) * BS + .1, z = ZC - DEPTH / 2 + .45 + hash(c, 11) * .5;
      g.position.set(x, y, z); g.rotation.y = hash(c, 12) * 6.28; toonify(g, .035); scene.add(g); props.push({ g, x, y, z });
    }
  }
  // frosting splats that stay on the ground where snacks land
  const splats = (() => {
    const M = 90, mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.3, 1), toon('#ffffff'), M), list = []; let next = 0;
    mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh);
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    return { list,
      add(x, y, z, c, s) { const b = list[next] || (list[next] = {}); Object.assign(b, { x, y, z, c, s, on: true }); next = (next + 1) % M; },
      sync() { let n = 0; for (const b of list) { if (!b.on) continue; pos.set(b.x, b.y, b.z); sc.set(b.s, b.s * .22, b.s * .8); mesh.setMatrixAt(n, m4.compose(pos, q, sc)); mesh.setColorAt(n, col.set(b.c)); n++; }
        mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
      clear() { for (const b of list) b.on = false; this.sync(); } };
  })();
  function splatAt(x, y, r, colors) {
    for (let k = 0; k < Math.round(3 + r * 4); k++) {
      const px = x + (Math.random() * 2 - 1) * r * 1.1, c = Math.floor(px / BS); if (c < 0 || c >= COLS) continue;
      let rr = Math.min(ROWS - 1, Math.floor((y + r) / BS)); while (rr >= 0 && !R.cellAt(grid, c, rr)) rr--;
      if (rr < 0 || (rr + 1) * BS < y - r * 1.4) continue;
      splats.add(px, (rr + 1) * BS + .02, ZC + DEPTH / 2 - .2 - Math.random() * 1.6, colors[k % 2], .7 + Math.random() * .5);
    }
    splats.sync();
  }
  function setWorld(hs, ops) {
    grid = R.gridOf(hs); applied = 0;
    for (const op of ops) R.applyOp(grid, op);
    applied = ops.length; splats.clear(); buildProps(hs); rebuild();
  }
  // new changes since the last ones we drew (a splash, a bush, a bridge)
  function addOps(ops) {
    if (ops.length < applied) return false; // a different match: the page calls setWorld
    for (let k = applied; k < ops.length; k++) {
      R.applyOp(grid, ops[k]);
      if (ops[k][0] === 'c') fx.burst(new THREE.Vector3(ops[k][1], ops[k][2], PZ), { n: 18, colors: ['#f6c97f', '#fff3df', '#e0524f', GRASS], shape: DOT, speed: 5, up: 4, size: .24, grav: 12, life: .9 });
    }
    applied = ops.length; rebuild();
    return true;
  }

  // ---- players' avatars on rocks at both ends
  const folk = [];
  const rockMat = mat(ROCK), topMat = mat(GRASS);
  function setSeats(list) {
    list.forEach((p, i) => {
      const key = JSON.stringify([p.color, p.av]), m = folk[i];
      if (m && m.key === key) return;
      if (m) { scene.remove(m.root); disposeAvatar(m.av); }
      const side = i % 2, row = i >> 1, root = new THREE.Group();
      const x = side ? W + 2.4 + row * 2.4 : -2.4 - row * 2.4, base = R.WATER0 + 1.2 + row * .9;
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.5, base + 2, 7), rockMat); rock.position.y = (base - 2) / 2; root.add(rock);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, .22, 7), topMat); top.position.y = base; root.add(top);
      const wrap = new THREE.Group(); wrap.scale.setScalar(K); wrap.position.y = base + .11; root.add(wrap);
      const av = avatar3d(p.color, p.av, { pose: 'stand', hand: false }); av.position.y = .76; wrap.add(av);
      wrap.rotation.y = side ? -.55 : .55;
      root.position.set(x, 0, PZ - .4 - row * 1.3); scene.add(root);
      folk[i] = { key, root, av, wrap, cheer: 0, sad: 0, i };
    });
    while (folk.length > list.length) { const m = folk.pop(); scene.remove(m.root); disposeAvatar(m.av); }
  }

  // ---- pets
  let pets = [];
  const ringGeo = new THREE.CircleGeometry(.42, 18).rotateX(-Math.PI / 2), floatGeo = new THREE.TorusGeometry(.48, .18, 8, 18).rotateX(Math.PI / 2);
  const floatMat = mat('#ff8fab');
  function setPets(info, colors) {
    for (const p of pets) scene.remove(p.wrap);
    pets = info.map(([team, sp, form, lk], i) => {
      const wrap = new THREE.Group(), body = new THREE.Group(); wrap.add(body);
      let g; try { g = petModel(sp, form, lk || null); } catch { g = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .6), mat('#cccccc')); }
      g.scale.multiplyScalar(PET_K[form] ?? .52); g.traverse(o => { if (o.isMesh) o.castShadow = false; }); body.add(g);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: colors[team] || '#ffffff', transparent: true, opacity: .9, depthWrite: false, ...LIFT })); ring.position.y = .03; ring.renderOrder = 2; wrap.add(ring);
      const fl = new THREE.Mesh(floatGeo, floatMat); fl.visible = false; fl.position.y = .12; wrap.add(fl);
      scene.add(wrap);
      return { i, team, wrap, body, g, ring, fl, x: 0, y: 0, tx: 0, ty: 0, face: 1, full: 0, st: 0, lie: 0, hit: 0, seed: i * 1.7, placed: false, sx: 0, sy: 0, on: false, walk: 0 };
    });
  }

  // ---- snacks in flight (extrapolated from the server's last word)
  const flying = new Map();
  let S = null, recvAt = 0, active = -1;
  function snap(s) {
    S = s; recvAt = performance.now(); active = s.stage === 'aim' || s.stage === 'retreat' ? s.ap : -1;
    if (s.water !== undefined) waterT = s.water;
    s.pets?.forEach((a, i) => { const p = pets[i]; if (!p) return;
      const x = a[0] / 100, y = a[1] / 100;
      if (!p.placed || Math.hypot(x - p.x, y - p.y) > 4) { p.x = x; p.y = y; }
      p.walk = Math.abs(x - p.tx) > .002 && p.placed ? 1 : 0;
      p.tx = x; p.ty = y; p.face = a[2]; if (a[3] > p.full) p.hit = .45; p.full = a[3]; p.st = a[4]; p.placed = true; });
    const seen = new Set();
    for (const [id, k, x, y, vx, vy] of s.shots || []) {
      seen.add(id); let f = flying.get(id);
      if (!f) { f = { g: snackModel(k), k }; scene.add(f.g); flying.set(id, f); }
      Object.assign(f, { x: x / 100, y: y / 100, vx: vx / 100, vy: vy / 100, t0: recvAt });
    }
    for (const [id, f] of flying) if (!seen.has(id)) { scene.remove(f.g); disposeToon(f.g); flying.delete(id); }
  }

  // ---- the aiming arc: no wind, only the first part of the flight
  const dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthWrite: false }), dots = [];
  for (let i = 0; i < 22; i++) { const d = new THREE.Mesh(new THREE.IcosahedronGeometry(.075, 1), dotMat); d.visible = false; d.renderOrder = 3; scene.add(d); dots.push(d); }
  function arc(pi, k, a, pw, n) {
    const p = pets[pi]; let shown = 0;
    if (p && n && pw > 0) {
      const s = R.launch({ x: p.x, y: p.y }, k, a, pw);
      for (let i = 0; i < n; i++) { for (let q = 0; q < 4; q++) { s.vy -= R.G / 60; s.x += s.vx / 60; s.y += s.vy / 60; } if (R.solidAt(grid, s.x, s.y)) break; dots[i].position.set(s.x, s.y, PZ); dots[i].visible = true; shown = i + 1; }
    }
    for (let i = shown; i < dots.length; i++) dots[i].visible = false;
    dotMat.opacity = .9;
  }

  // ---- effects for the server's events
  const v = (x, y) => new THREE.Vector3(x, y, PZ);
  let shake = 0;
  const zaps = [];
  function splash(e) {
    const f = R.SNACKS[e.k] || R.SNACKS.pie, big = e.k === 'cake';
    fx.burst(v(e.x, e.y), { n: big ? 46 : e.k === 'mini' ? 10 : 26, colors: f.col, shape: DOT, speed: big ? 7 : 5, up: 5, size: big ? .34 : .26, grav: 11, life: 1 });
    if (f.grow) fx.burst(v(e.x, e.y + .5), { n: 14, colors: ['#8bd65a', '#c9f58f', '#ffffff'], shape: STAR, speed: 2, up: 3, size: .3, grav: 3, life: 1.1 });
    if (f.wave) fx.puff(v(e.x, e.y + .3), { n: 22, color: ['#ffffff', '#bfe9ff', '#7fd1e8'], size: .5, speed: 5 });
    if (e.zap) for (const i of e.zap) { const p = pets[i]; if (!p) continue;
      const pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(new THREE.Vector3(e.x + (p.x - e.x) * u + (k % 6 ? (Math.random() - .5) * .5 : 0), e.y + (p.y + .5 - e.y) * u + (k % 6 ? (Math.random() - .5) * .5 : 0), PZ + .1)); }
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffe27a', transparent: true })); scene.add(ln); zaps.push({ ln, t: .5 }); }
    if (f.dmg > 0) splatAt(e.x, e.y, Math.max(.6, f.r * .8), [f.col[0], f.col[1]]);
    for (const [i, got] of e.hits || []) if (got > 0 && pets[i]) pets[i].hit = .45;
    shake = Math.min(.6, shake + (f.r || .5) * .14);
    focus = { x: e.x, y: e.y, until: performance.now() + 900 };
  }
  function plop(e) { fx.puff(v(e.x, water + .1), { n: 14, color: ['#ffffff', '#bfe9ff'], size: .45, speed: 3 }); }
  function crash(i) { const p = pets[i]; if (!p) return; fx.burst(v(p.x, p.y + 1.1), { n: 14, colors: ['#ffd34d', '#ff9fb8', '#ffffff'], shape: STAR, speed: 2.4, up: 3, size: .32, grav: 2, life: 1.3 }); }
  function seaNap(i) { const p = pets[i]; if (!p) return; fx.puff(v(p.x, water), { n: 20, color: ['#ffffff', '#bfe9ff', '#4fb3e8'], size: .5, speed: 4 }); }
  function cheer(team, sad) { const m = folk[team]; if (!m) return; if (sad) m.sad = 1.8; else m.cheer = 1.8; }
  function win(team) { const m = folk[team]; if (!m) return; m.cheer = 9; const p = m.root.position; fx.confetti(new THREE.Vector3(p.x, R.WATER0 + 4, p.z), { n: 70, w: 3, h: 3, s: team }); }

  // ---- camera: follows the pet whose turn it is, then the snack, then the splash; drag pans, pinch and wheel zoom
  const cam = { x: W / 2, y: 8, d: 30, tx: W / 2, ty: 8, td: 30, free: false, fit: 30 };
  let focus = null, water = R.WATER0, waterT = R.WATER0, waterRow = -1;
  function fitD() { const a = (cw || 1) / (ch || 1), wid = a < .8 ? 11 : a < 1.3 ? 20 : 28; return wid / (2 * Math.tan(THREE.MathUtils.degToRad(18)) * a); }
  const pan = (dx, dy) => { const k = cam.d * .0011 * (900 / Math.max(300, ch)); cam.tx -= dx * k; cam.ty += dy * k; cam.free = true; };
  const zoom = f => { cam.td = Math.max(cam.fit * .45, Math.min(cam.fit * 2.2, cam.td * f)); };
  const follow = () => { cam.free = false; };

  let W0 = 0, H0 = 0, cw = 0, ch = 0;
  const ro = new ResizeObserver(es => { const b = es[es.length - 1].contentRect; cw = b.width; ch = b.height; }); ro.observe(canvas);
  nightScene(scene, { wx: { size: 50 } });
  res.prep(scene);
  const v3 = new THREE.Vector3();
  let T = 0, drawn = false;
  const loop = frameLoop(dt => {
    if (!canvas.isConnected) return;
    if (cw !== W0 || ch !== H0) { W0 = cw; H0 = ch; if (W0 && H0) { renderer.setSize(W0, H0, false); camera.aspect = W0 / H0; camera.updateProjectionMatrix(); const f = fitD(); cam.td = cam.td / cam.fit * f; cam.d = cam.d / cam.fit * f; cam.fit = f; } }
    if (!W0 || !H0) return;
    T += dt;
    const nt = scene.userData.dayNight?.on ? 1 : 0; // the sea darkens with the clock sky
    if (nt !== seaNight) { seaNight = nt; sea.material.color.set(nt ? '#2b3f86' : seaDay); foam.material.opacity = nt ? .3 : .55; rebuild(); }
    water += (waterT - water) * Math.min(1, dt * 1.5); sea.position.y = water + Math.sin(T * 1.3) * .03; foam.position.y = water + .03 + Math.sin(T * 2.1) * .03; foam.material.opacity = (seaNight ? .3 : .45) + Math.sin(T * 2.1) * .1;
    const wr = Math.floor(water / BS * 2); if (wr !== waterRow) { waterRow = wr; rebuild(); } // the tide tints a new row of blocks
    // pets
    for (const p of pets) {
      if (!p.placed) { p.wrap.visible = false; continue; }
      p.wrap.visible = true;
      const dx = p.tx - p.x, dy = p.ty - p.y; p.x += dx * Math.min(1, dt * 14); p.y += dy * Math.min(1, dt * 14);
      const asleep = p.st > 0, sea2 = p.st === 2;
      p.lie += ((asleep ? 1 : 0) - p.lie) * Math.min(1, dt * 5);
      p.wrap.position.set(p.x, sea2 ? water - .25 + Math.sin(T * 2 + p.seed) * .06 : p.y, PZ);
      p.body.rotation.y += (p.face * .95 - p.body.rotation.y) * Math.min(1, dt * 10);
      const rush = !asleep && p.full > 60 ? (p.full - 60) / 40 : 0; // the sugar rush: the fuller, the more it jitters
      p.body.rotation.z = -p.face * p.lie * 1.35;
      const walking = p.i === active && Math.abs(dx) > .004;
      p.body.position.set(Math.sin(T * 47 + p.seed) * .035 * rush, p.lie * .28 + (walking ? Math.abs(Math.sin(T * 14)) * .08 : 0) + (sea2 ? .1 : 0), 0);
      const sq = p.hit > 0 ? 1 + Math.sin(p.hit / .45 * Math.PI) * .25 : 1, belly = 1 + p.full / 100 * .22;
      p.body.scale.set(belly * sq, 1 / sq, belly * sq); p.hit = Math.max(0, p.hit - dt);
      if (!asleep) wiggle(p.g, T, p.seed, rush);
      const eyes = p.g.userData?.eyes || [], blink = asleep ? .12 : ((T + p.seed) % 4.2 < .12 ? .15 : 1);
      for (const e of eyes) e.scale.y = blink;
      p.ring.visible = !sea2; p.fl.visible = sea2;
      p.ring.material.opacity = p.i === active ? .95 + Math.sin(T * 5) * .05 : .7;
    }
    // snacks in flight: from the last report, on along their path
    for (const f of flying.values()) {
      const t = Math.min(.25, (performance.now() - f.t0) / 1000), wnd = (S?.wind || 0) * R.WIND_A * ((R.SNACKS[f.k] || R.SNACKS.pie).wind);
      f.g.position.set(f.x + f.vx * t + .5 * wnd * t * t, f.y + f.vy * t - .5 * R.G * t * t, PZ); f.g.rotation.z += dt * 7 * (f.vx >= 0 ? -1 : 1);
      if ((f.tr = (f.tr || 0) - dt) <= 0) { f.tr = .035; fx.burst(f.g.position, { n: 1, colors: (R.SNACKS[f.k] || R.SNACKS.pie).col, shape: DOT, speed: .3, up: .2, size: .2, grav: 1, life: .45 }); }
    }
    for (let i = zaps.length - 1; i >= 0; i--) { const z = zaps[i]; z.t -= dt; z.ln.material.opacity = Math.max(0, z.t * 2) * (Math.sin(T * 60) > 0 ? 1 : .4); if (z.t <= 0) { scene.remove(z.ln); z.ln.geometry.dispose(); z.ln.material.dispose(); zaps.splice(i, 1); } }
    for (const m of folk) { m.cheer = Math.max(0, m.cheer - dt); m.sad = Math.max(0, m.sad - dt);
      animateAvatar(m.av, T, { seed: m.i, active: S?.turn === m.i && S?.ph === 'play', hop: m.cheer > 0 ? Math.abs(Math.sin(m.cheer * 7)) : 0, nod: m.sad > 0 ? .8 : 0 }); }
    // camera target
    const now = performance.now();
    if (flying.size) { const f = flying.values().next().value; cam.tx = f.g.position.x; cam.ty = Math.max(water + 3, f.g.position.y - 1); cam.free = false; }
    else if (focus && now < focus.until) { cam.tx = focus.x; cam.ty = focus.y + 2; }
    else if (!cam.free && pets[S?.ap] && S?.ph === 'play') { const p = pets[S.ap]; cam.tx = p.x; cam.ty = p.y + 1; }
    cam.tx = Math.max(-6, Math.min(W + 6, cam.tx)); cam.ty = Math.max(water + 2, Math.min(ROWS * BS, cam.ty));
    const k = Math.min(1, dt * 4); cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.d += (cam.td - cam.d) * Math.min(1, dt * 6);
    shake = Math.max(0, shake - dt * 1.4);
    const sx = Math.sin(T * 61) * shake * .35, sy = Math.cos(T * 53) * shake * .35;
    camera.position.set(cam.x + sx, cam.y + cam.d * .2 + sy, cam.d + PZ); camera.lookAt(cam.x + sx, cam.y + sy, PZ);
    fx.update(dt, camera, H0);
    renderer.render(scene, camera);
    // where tags go
    for (const p of pets) { v3.set(p.x, (p.st === 2 ? water - .2 : p.y) + (p.st ? 1.05 : 1.3), PZ).project(camera); p.on = p.placed && v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.15; p.sx = (v3.x * .5 + .5) * W0; p.sy = (-v3.y * .5 + .5) * H0; }
    opts.frame?.(pets, W0, H0);
    if (!drawn) { drawn = true; opts.ready?.(); }
  }, { onSlow: () => res.lower() });

  return {
    setWorld, addOps, setSeats, setPets, snap, arc, splash, plop, crash, seaNap, cheer, win, pan, zoom, follow,
    applied: () => applied,
    // a point of the world on screen: [x, y]
    project(x, y) { v3.set(x, y, PZ).project(camera); return [(v3.x * .5 + .5) * W0, (-v3.y * .5 + .5) * H0]; },
    petAt(i) { const p = pets[i]; return p ? { x: p.x, y: p.y } : null; },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: loop.fps() }),
    dispose() { loop.stop(); ro.disconnect(); for (const m of folk) disposeAvatar(m.av); fx.dispose();
      scene.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) if (!mt.userData?.shared && !mt.userData?.keep) mt.dispose(); } }); renderer.dispose(); renderer.forceContextLoss(); },
  };
}

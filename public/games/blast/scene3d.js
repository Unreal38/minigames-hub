// Blast Bay's 3D view: the maze on a floating Pet Farm isle, everyone's avatar, the pop seeds, the petal blasts, the
// pets hopping out of crates and the edge crumbling away. The page (client.js) owns the rules, the buttons and your
// own walking; this file only draws.
// Cost rules: the floor, walls and crates are a handful of instanced meshes (one draw each, whatever the maze size),
// blasts are two more, avatars get soft blobs instead of real shadows, and there are no shadow maps at all.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { skyDome, clouds, nightScene, birds, flat, put, ico, hash, PROPS, toonMat, toonify, mergeStatic, isNight, seasonLookNow, createFx, STAR, DOT, HEART, RING, FISH, COIN, FLAKE, CONF } from '../../scenery3d.js';
import { lookOf, SP, trim } from '../../season3d.js';
import { itemModel } from '../farm/models.js';
import { seedLook, seedModel as seedSkin } from '../../pieceskins.js';
import { groundOf } from '../../isle3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { frameLoop, autoResolution, AA, gfx } from '../../frames.js';
import { ARENAS, EL_COL, ELS, WALL, CRATE, GONE, Q } from './rules.js';

const K = .44;                       // avatars are drawn at this size, on a wrapper (standing-avatar rule: the avatar sits .76 up inside it)
const PETAL = ['#ff8fc8', '#fff07a', '#ffffff', '#ffc2e0', '#7ad66b'];
const SHAPES = { STAR, DOT, HEART, RING, FISH, COIN, FLAKE, CONF }; // a seed look names its blast bits by shape
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); return (a < 0 ? a + Math.PI * 2 : a) - Math.PI; };
const FACE = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // facing 0 down (towards the camera), 1 right, 2 up, 3 left

// What each arena's walls, crates and rim look like. Walls stand clearly taller and darker than crates (Kuba found the
// hay and the hedges too alike). Rim props are Pet Farm decorations (itemModel names) or prop functions; "tall" ones
// stand on the sides and at the back, "low" ones also in front, where they must not hide the maze's bottom row.
const LOOK = {
  woods: { wall: ['#2f7a3d', '#358343', '#2b7339'], top: '#4f9e48', crate: 'hay',
    tall: ['pine', 'tree', 'pine', 'scarecrow', 'tree', 'well', 'pine', 'windmill'], low: ['bush', 'haybale', 'shrooms', 'flowers', 'bush', 'rock', 'bench', 'haybale'] },
  ridge: { wall: ['#7a768a', '#6e6a7e', '#858196'], top: null, crate: 'box',
    tall: ['pine', 'geode', 'telescope', 'pine', 'well', 'statue', 'pine', 'lighthouse'], low: ['rock', 'campfire', 'rock', 'shrooms', 'bush', 'rock'] },
  sweet: { wall: ['#6b3d24', '#5f3520', '#744429'], top: '#ffd1e6', crate: 'cake',
    tall: ['cherry', 'topiary', 'cherry', 'balloon', 'cherry', 'vane'], low: ['picnic', 'flowers', 'ball', 'cart', 'flowers', 'hives'] },
};
// In a season the plain trees, bushes and rocks give way to that season's own (snowy pines and snowmen in winter).
const SWAP = { pine: 0, tree: 1, bush: 2, rock: 3 };
const RIM_SIDE = 3.4, RIM_BACK = 3.2, RIM_FRONT = 1.5; // how far the island reaches past the maze on each side
const INK = new THREE.MeshBasicMaterial({ color: '#3a2620', side: THREE.BackSide }); INK.userData.shared = true;
// An outline for an instanced mesh: a slightly bigger copy of its shape drawn inside out, sharing its instance matrices
// (so hiding a crate hides its outline too). toonify's hulls skip instanced meshes, so these stand in for them.
function inkFor(m, t = .035) {
  const g = m.geometry.clone(); g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3()), c = g.boundingBox.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z); g.scale(1 + 2 * t / Math.max(s.x, .05), 1 + 2 * t / Math.max(s.y, .05), 1 + 2 * t / Math.max(s.z, .05)); g.translate(c.x, c.y, c.z);
  const o = new THREE.InstancedMesh(g, INK, m.instanceMatrix.count); o.instanceMatrix = m.instanceMatrix; o.count = m.count; o.frustumCulled = false;
  return o;
}
const toon = c => toonMat(flat(c));
// a rounded rectangle from x0..x1, z0..z1 (shape y is world z once rotated flat)
function rrect(x0, z0, x1, z1, r, path = new THREE.Shape()) {
  path.moveTo(x0 + r, z0); path.lineTo(x1 - r, z0); path.quadraticCurveTo(x1, z0, x1, z0 + r); path.lineTo(x1, z1 - r); path.quadraticCurveTo(x1, z1, x1 - r, z1);
  path.lineTo(x0 + r, z1); path.quadraticCurveTo(x0, z1, x0, z1 - r); path.lineTo(x0, z0 + r); path.quadraticCurveTo(x0, z0, x0 + r, z0); return path;
}
// Several plain geometries as one (for the petal blast's flower).
function joinGeos(list) {
  const parts = list.map(g => g.index ? g.toNonIndexed() : g), n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
function flowerGeo() {
  const ps = [];
  for (let i = 0; i < 8; i++) { const big = i % 2 === 0, g = new THREE.SphereGeometry(.5, 6, 4); g.scale(big ? .3 : .22, big ? .16 : .13, big ? .52 : .38); g.translate(0, 0, big ? .26 : .2); g.rotateY(i * Math.PI / 4); ps.push(g); }
  return joinGeos(ps);
}

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
    world.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) if (!m.userData?.shared) m.dispose?.(); } });
    world = null; crates = []; crateOf = new Map(); fallen = []; shakeSet = new Set();
  }
  // a prop for the rim: a Pet Farm decoration by name, or a prop function (season or isle props)
  function propOf(kind, s) {
    if (typeof kind === 'string') { const m = itemModel(kind, false, true); m.scale.setScalar(s); return m; }
    const g = new THREE.Group(); kind(g, s); bake(g); return g;
  }
  function build(arenaId, w, h, g) {
    clearWorld();
    arena = arenaId; W = w; H = h; grid = g.slice();
    world = new THREE.Group(); scene.add(world);
    const season = seasonLookNow(), SL = lookOf(season), candy = arena === 'sweet';
    const th0 = groundOf(ARENAS[arena]?.isle | 0), look = LOOK[arena] || LOOK.woods, n = W * H;
    // the season dresses the woods and the ridge like every other island (snow in winter); the Sweet Shop stays candy
    const th = SL && !candy ? { ...th0, grass: SL.grass, patch: SL.patch, earth: SL.earth || th0.earth, rock: SL.rock || th0.rock } : th0;
    const snowy = season === 'winter';
    // floor tiles (a slab of lawn each, two tones like a lawn mown in squares) on a column of earth that hangs below
    floor = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .3, 1), toon('#ffffff'), n);
    dirt = new THREE.InstancedMesh(new THREE.BoxGeometry(.98, 1, .98), toon(th.earth), n);
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
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(W, H) * .32, Math.max(W, H) * .55, 7), toon(th.rock)); cone.rotation.x = Math.PI; cone.position.y = -2.6 - Math.max(W, H) * .27; world.add(cone);
    // walls: hedges with a leafy top, boulders, chocolate blocks with a blob of icing; a cap of snow in winter
    const walls = []; for (let i = 0; i < n; i++) if (grid[i] === WALL) walls.push(i);
    const wgeo = arena === 'ridge' ? new THREE.DodecahedronGeometry(.6, 0) : candy ? new THREE.BoxGeometry(.92, .86, .92) : new THREE.BoxGeometry(.92, .8, .92);
    const wm = new THREE.InstancedMesh(wgeo, toon('#ffffff'), walls.length);
    const place = (m, k, x, y, py, ry = 0, sx = 1, sy = 1) => { dummy.position.set(wx(x), py, wz(y)); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sx); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); };
    walls.forEach((i, k) => {
      const x = i % W, y = i / W | 0;
      if (arena === 'ridge') place(wm, k, x, y, .46, x * 1.7 + y * 2.3, 1, 1.05); else place(wm, k, x, y, candy ? .43 : .4);
      wm.setColorAt(k, col.set(look.wall[(x * 3 + y) % look.wall.length]));
    });
    world.add(wm, inkFor(wm, .04));
    if (look.top) { // hedges get a bushy top, chocolate blocks a blob of icing (the dark block still shows round it from above)
      const tm = new THREE.InstancedMesh(candy ? new THREE.IcosahedronGeometry(.29, 1) : new THREE.IcosahedronGeometry(.54, 1), toon(look.top), walls.length);
      walls.forEach((i, k) => place(tm, k, i % W, i / W | 0, candy ? .88 : .84, (i * 1.3) % 6.28, 1, candy ? .32 : .5));
      world.add(tm, inkFor(tm, .035));
    }
    if (snowy && !candy) { // a little cap only, so the wall tops never melt into a snowy floor
      const cm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.3, 1), toon('#f6faff'), walls.length);
      walls.forEach((i, k) => place(cm, k, i % W, i / W | 0, arena === 'ridge' ? .98 : candy ? .97 : 1.08, i * .7, 1, .4));
      world.add(cm);
    }
    // crates: a few instanced parts each [geometry, colour, offsets [x, y, z, rx, ry, rz], outlined]
    const list = []; for (let i = 0; i < n; i++) if (grid[i] === CRATE) list.push(i);
    list.forEach((i, k) => crateOf.set(i, k));
    const H2 = Math.PI / 2;
    const parts = look.crate === 'hay' ? [ // a round bale lying on its side, two bands of twine
      [new THREE.CylinderGeometry(.35, .35, .76, 14), '#efcb5e', [[0, .36, 0, 0, 0, H2]], true],
      [new THREE.CylinderGeometry(.365, .365, .07, 14), '#b9822e', [[-.2, .36, 0, 0, 0, H2], [.2, .36, 0, 0, 0, H2]], false],
      [new THREE.CylinderGeometry(.24, .24, .772, 12), '#f7dc85', [[0, .36, 0, 0, 0, H2]], false],
    ] : look.crate === 'box' ? [ // a planked crate with corner posts and a brace on each side
      [new THREE.BoxGeometry(.76, .74, .76), '#d39a5e', [[0, .38, 0]], true],
      [new THREE.BoxGeometry(.12, .8, .12), '#8a5a32', [[-.35, .4, -.35], [.35, .4, -.35], [-.35, .4, .35], [.35, .4, .35]], false],
      [new THREE.BoxGeometry(.82, .1, .82), '#a8723f', [[0, .06, 0], [0, .74, 0]], false],
      [new THREE.BoxGeometry(.09, .78, .03), '#a8723f', [[0, .4, .385, 0, 0, .74], [0, .4, -.385, 0, 0, -.74], [.385, .4, 0, 0, H2, .74], [-.385, .4, 0, 0, H2, -.74]], false],
    ] : [ // a little layer cake with frosting and a cherry
      [new THREE.CylinderGeometry(.4, .42, .5, 12), '#fbe0b5', [[0, .25, 0]], true],
      [new THREE.CylinderGeometry(.43, .43, .16, 12), '#ff8fb8', [[0, .55, 0]], true],
      [new THREE.CylinderGeometry(.425, .425, .06, 12), '#c9744a', [[0, .3, 0]], false],
      [new THREE.SphereGeometry(.1, 8, 6), '#e02a3a', [[0, .7, 0]], false],
    ];
    const base = new THREE.Matrix4(), local = new THREE.Matrix4();
    crates = [];
    for (const [geo, c, offs, inked] of parts) {
      const m = new THREE.InstancedMesh(geo, toon(c), Math.max(1, list.length * offs.length));
      list.forEach((i, k) => {
        const x = i % W, y = i / W | 0; dummy.position.set(wx(x), 0, wz(y)); dummy.rotation.set(0, (x * 3 + y) % 2 ? H2 : 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); base.copy(dummy.matrix);
        offs.forEach((o, j) => { dummy.position.set(o[0], o[1], o[2]); dummy.rotation.set(o[3] || 0, o[4] || 0, o[5] || 0); dummy.updateMatrix(); local.copy(dummy.matrix); m.setMatrixAt(k * offs.length + j, local.premultiply(base)); });
      });
      if (!list.length) m.count = 0;
      m.userData.per = offs.length; world.add(m); crates.push(m);
      if (inked) world.add(inkFor(m, .035));
    }
    // ---- the island round the maze: a lawn frame with Pet Farm decorations on it, earth and rock below ----
    const x0 = -W / 2 - RIM_SIDE, x1 = W / 2 + RIM_SIDE, z0 = -H / 2 - RIM_BACK, z1 = H / 2 + RIM_FRONT;
    const hole = () => rrect(-W / 2 - .01, -H / 2 - .01, W / 2 + .01, H / 2 + .01, 0, new THREE.Path());
    const slab = (inset, d, y, c) => { const sh = rrect(x0 + inset, z0 + inset, x1 - inset, z1 - inset, 1.4); sh.holes.push(hole());
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 5 }).rotateX(Math.PI / 2); return put(stat, geo, flat(c), 0, y, 0); };
    const stat = new THREE.Group();
    slab(0, .45, 0, th.grass); slab(.25, 1.1, -.45, th.earth); slab(.95, 1.3, -1.55, th.rock);
    for (let i = 0; i < 9; i++) { const a = hash(i, 5) * 6.283, st = ico(stat, .35 + hash(i, 6) * .45, th.rock, Math.cos(a) * (W / 2 + 1.5), -3.2 - hash(i, 7) * 1.6, Math.sin(a) * (H / 2 + 1.2)); st.scale.y = 1.4; }
    { const ic = new THREE.Group(); trim(ic, season, rrect(x0, z0, x1, z1, 1.4).getSpacedPoints(Math.round((x1 - x0 + z1 - z0) * 2 / .8)).slice(0, -1).map(p => [p.x * 1.004, p.y * 1.004]), -.45, 3); if (ic.children.length) { bake(ic); stat.add(ic); } }
    // darker patches on the lawn
    for (let i = 0; i < 26; i++) { const x = x0 + .8 + hash(i, 21) * (x1 - x0 - 1.6), z = z0 + .8 + hash(i, 22) * (z1 - z0 - 1.6); if (Math.abs(x) < W / 2 + .6 && Math.abs(z) < H / 2 + .6) continue;
      const m = put(stat, new THREE.CircleGeometry(.35 + hash(i, 23) * .45, 10), flat(th.patch), x, .012, z); m.rotation.x = -Math.PI / 2; }
    // props: tall ones on the sides and at the back, low ones in front too; this season's own trees and bushes swap in
    const swaps = SL?.kinds ? [SL.kinds[0], SL.kinds[0], SL.kinds[1], SL.kinds[3]].map(k => typeof k === 'string' ? (gr, sz) => PROPS[k](gr, sz) : k) : null;
    const extra = snowy ? [SP.snowman, SP.gifts] : [];
    const pick = (arr, i) => { const k = arr[i % arr.length]; return swaps && !candy && SWAP[k] !== undefined ? swaps[SWAP[k]] : k; };
    let t = 0, l = 0;
    for (let z = z0 + .7; z < z1 - .5; z += 1.15) for (let x = x0 + .7; x < x1 - .5; x += 1.15) {
      const jx = x + (hash(x * 7 + z, 31) - .5) * .5, jz = z + (hash(x + z * 5, 32) - .5) * .5;
      const gapX = Math.abs(jx) - W / 2, front = jz > H / 2, back = jz < -H / 2;
      if (gapX < .75 && !front && !back) continue; // over the maze
      if (front && (jz - H / 2 < .6 || gapX < -.5 && hash(x, z) < .5)) continue;
      if (back && jz > -H / 2 - .8) continue;
      // keep off the rounded corners
      const cx = Math.max(0, Math.abs(jx) - (W / 2 + RIM_SIDE - 1.4)), cz = Math.max(0, jz > 0 ? jz - (H / 2 + RIM_FRONT - 1.4) : -jz - (H / 2 + RIM_BACK - 1.4));
      if (Math.hypot(cx, cz) > .9) continue;
      if (hash(x * 3 + 1, z * 3 + 2) < .3) continue;
      const tall = !front && hash(x, z + 9) < .55;
      let kind = tall ? pick(look.tall, t++) : pick(look.low, l++);
      if (extra.length && !tall && hash(x + 4, z) < .25) kind = extra[l % extra.length];
      if (!tall && th0.kinds && !candy && hash(x + 8, z + 1) < .2) kind = th0.kinds[l % th0.kinds.length];
      const s = typeof kind === 'string' ? (tall ? .85 : .75) : (tall ? 1.1 : .9) * (.85 + hash(x, z + 3) * .3);
      const pr = propOf(kind, s); pr.position.set(jx, 0, jz); pr.rotation.y = hash(x + 2, z + 7) * 6.283; stat.add(pr);
    }
    world.add(mergeStatic(stat, .05));
    // lamp posts at the corners of the rim, lit after dark like every island's
    for (const [lx, lz] of [[x0 + 1.2, z0 + 1.2], [x1 - 1.2, z0 + 1.2], [x0 + 1, z1 - .8], [x1 - 1, z1 - .8], [x0 + .9, 0], [x1 - .9, 0]]) {
      const lp = new THREE.Group(); PROPS.lamp(lp, 1); toonify(lp, .03); lp.position.set(lx, 0, lz); lp.userData.nightOnly = true; lp.visible = isNight(); world.add(lp);
    }
    if (cw && ch) fit(); // the canvas may have been sized before the maze was known
  }
  function crateGone(i) {
    const k = crateOf.get(i); if (k === undefined) return;
    crateOf.delete(i);
    dummy.position.set(0, -60, 0); dummy.scale.set(.001, .001, .001); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    for (const m of crates) { for (let j = 0; j < m.userData.per; j++) m.setMatrixAt(k * m.userData.per + j, dummy.matrix); m.instanceMatrix.needsUpdate = true; }
    const look = LOOK[arena] || LOOK.woods, bits = look.crate === 'hay' ? ['#efcb5e', '#b9822e'] : look.crate === 'box' ? ['#d39a5e', '#8a5a32'] : ['#fbe0b5', '#ff8fb8'];
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
  let skins = []; // each seat's pop seed look (kind bs), for its seeds and its blasts
  function setSeats(list, mySeat) {
    me = mySeat; skins = list.map(p => p.bs | 0);
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
  const seedProtos = new Map(); // one built model per seed look, cloned for each seed (they share geometry and materials)
  function seedModel(k = 0) {
    let p = seedProtos.get(k);
    if (!p) { p = seedSkin(THREE, k); seedProtos.set(k, p); }
    const g = new THREE.Group(), b = p.clone(); g.add(b);
    g.userData = { b, tip: b.getObjectByName('tip') }; return g;
  }
  // b: [id, x, y, ms left, owner, mine-to-pass]
  function setSeeds(list, now) {
    const seen = new Set();
    for (const [id, qx, qy, left, owner] of list) {
      seen.add(id);
      let s = seeds.get(id);
      if (!s) { s = { g: seedModel(skins[owner] | 0), x: qx / Q, y: qy / Q, born: T }; scene.add(s.g); seeds.set(id, s); }
      s.tx = qx / Q; s.ty = qy / Q; s.end = now + left;
    }
    for (const [id, s] of seeds) if (!seen.has(id) && !s.local) { scene.remove(s.g); seeds.delete(id); }
  }
  // your own seed, shown the moment you plant it (until the server's copy arrives)
  function localSeed(x, y) { const id = 'l' + x + ',' + y; if (seeds.has(id)) return; const s = { g: seedModel(skins[me] | 0), x, y, tx: x, ty: y, born: T, local: true, end: performance.now() + 2400 }; scene.add(s.g); seeds.set(id, s); setTimeout(() => { const t = seeds.get(id); if (t) { scene.remove(t.g); seeds.delete(id); } }, 500); }

  // ---------- petal blasts ----------
  const BN = 260;
  // each blasted tile blooms into a flower: eight petals in the seed look's blast colour round a puffy core
  const outer = new THREE.InstancedMesh(flowerGeo(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .92, depthWrite: false }), BN);
  const core = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.26, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), BN);
  for (const m of [outer, core]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; for (let i = 0; i < BN; i++) { dummy.position.set(0, -60, 0); dummy.scale.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); } scene.add(m); }
  const tint = new THREE.Color();
  for (let i = 0; i < BN; i++) { outer.setColorAt(i, tint.set('#ff8fc8')); core.setColorAt(i, tint.set('#fff4fa')); } // each blast is tinted by its seed's look
  const slots = Array.from({ length: BN }, () => ({ life: 0, x: 0, z: 0, r: 0 })); let bnext = 0;
  function blast(cells, by = -1) {
    const look = seedLook(skins[by] | 0), bits = look.bits, shape = SHAPES[look.burst] ?? HEART;
    for (const i of cells) {
      const k = bnext, s = slots[k]; bnext = (bnext + 1) % BN; s.life = .45; s.x = wx(i % W); s.z = wz(i / W | 0); s.r = (i * 2.399) % 6.283;
      outer.setColorAt(k, tint.set(look.blast)); core.setColorAt(k, tint.set(look.core));
    }
    outer.instanceColor.needsUpdate = core.instanceColor.needsUpdate = true;
    const mid = cells[0];
    if (mid !== undefined) {
      const p = new THREE.Vector3(wx(mid % W), .5, wz(mid / W | 0));
      fx.burst(p, { n: few ? 10 : 22, colors: bits, shape, speed: 3.4, up: 3.2, size: .3, life: .9, grav: 6 });
      if (!few) for (const i of cells.slice(1)) if ((i * 7) % 3 === 0) fx.burst(new THREE.Vector3(wx(i % W), .4, wz(i / W | 0)), { n: 3, colors: bits, shape: DOT, speed: 1.6, up: 2.4, size: .2, life: .6, grav: 6 });
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
    let top1 = 0;
    for (let i = 0; i < BN; i++) { const s = slots[i]; if (s.life <= 0 && s.dead) continue; top1 = i + 1;
      s.life -= dt; const k = Math.max(0, s.life / .45), pulse = .55 + .45 * Math.sin(k * Math.PI);
      const on = s.life > 0 ? 1 : 0; // a spent blast shrinks to nothing (parked far below, a tall phone camera could still see it)
      const bloom = Math.min(1, (1 - k) * 6) * (.75 + .35 * pulse); // opens fast, then breathes and closes
      dummy.rotation.set(0, s.r + (1 - k) * 1.2, 0);
      dummy.position.set(s.x, on ? .16 : -60, s.z); dummy.scale.set(bloom * 1.12 * on, (1 + pulse) * on, bloom * 1.12 * on); dummy.updateMatrix(); outer.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s.x, on ? .22 + pulse * .08 : -60, s.z); dummy.scale.set(bloom * on, bloom * .75 * on, bloom * on); dummy.updateMatrix(); core.setMatrixAt(i, dummy.matrix);
      s.dead = s.life <= 0; }
    outer.count = core.count = top1; // only draw up to the last blooming slot
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

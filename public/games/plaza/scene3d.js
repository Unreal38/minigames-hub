// The Plaza's 3D scene: one floating island (snow and a big Christmas tree in winter, a meadow with a fountain the
// rest of the year), everyone's avatars walking about with their pets behind them, emotes and the tree's ornaments.
// The page (client.js) owns the buttons, name tags and chat; this file owns everything drawn in 3D and your own
// walking, which is worked out here every frame and reported to the server a few times a second.
//
// Cost rules: all standing scenery is merged into a handful of meshes (mergeStatic), its shadows are drawn once, people
// and pets get a soft blob under them instead of real shadows, and models are built a few a frame, nearest first.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { island, skyDome, clouds, nightScene, birds, flat, put, toonify, toonMat, createFx, STAR, HEART, hash, seasonLookNow } from '../../scenery3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { itemModel } from '../farm/models.js';
import { formOf } from '../farm/data.js';
import { youArrow, animateArrow } from '../../marker3d.js';
import { frameLoop, autoResolution, AA, gfx } from '../../frames.js';
import { R_WALK, R_SQUARE, SPEED, Q, TREE_R, THINGS, WINTER, MEADOW, LAMPS, STAGE, SPOTS, EMOTES, ORNAMENTS, SLOTS, TIERS, TREE_H, slotPos, blocksOf, clampWalk, throwMs, THROW_RANGE, thingsOf, POKE_REACH, CAROUSEL, SWING } from './layout.js';

const K = .72;             // avatars are drawn at this size (see standing-avatar notes: the scale sits on a wrapper)
const MOVING = { ride: 1, swing: 1 }; // seats that move: the rider is drawn on them, their own place stays where they got on
const BODY_R = .38;        // how close you can get to things
const SNOW = '#f6faff';
const EM = Object.fromEntries(EMOTES.map((e, i) => [e?.id, i]));
const LIVE = new Set(['campfire', 'carousel', 'balloon', 'swing', 'windmill', 'hotspring', 'fountain', 'miniwheel']); // decorations with moving parts stay their own models
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); return (a < 0 ? a + Math.PI * 2 : a) - Math.PI; };

// Merge every baked mesh under root (the Pet Farm decorations arrive as one or two vertex-coloured meshes each) into one
// mesh per kind of surface, then give the lot one outline. Fifty decorations cost about as much to draw as one.
function mergeStatic(root, ink) {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert(), buckets = new Map(), keep = [], m4 = new THREE.Matrix4(), sc = new THREE.Vector3();
  root.traverse(o => { if (!o.isMesh || o.userData.ink) return;
    const mt = o.material;
    if (o.userData.baked && mt.isMeshStandardMaterial && mt.vertexColors && !mt.transparent && o.geometry.attributes.color) {
      const key = (Math.round(mt.roughness * 5) / 5) + '|' + mt.side; let b = buckets.get(key); if (!b) buckets.set(key, b = { parts: [], n: 0, mt });
      const g = o.geometry.clone(); m4.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(m4); sc.setFromMatrixScale(m4);
      b.parts.push([g.attributes.position.array, g.attributes.normal.array, g.attributes.color.array, g.attributes.inkd?.array, sc.x]); b.n += g.attributes.position.count;
    } else { o.updateWorldMatrix(true, false); keep.push([o, m4.multiplyMatrices(inv, o.matrixWorld).clone()]); }
  });
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const pos = new Float32Array(b.n * 3), nor = new Float32Array(b.n * 3), col = new Float32Array(b.n * 3), sz = new Float32Array(b.n); let o = 0;
    for (const [p, n, c, d, s] of b.parts) { pos.set(p, o * 3); nor.set(n, o * 3); col.set(c, o * 3); const cnt = p.length / 3; if (d) for (let i = 0; i < cnt; i++) sz[o + i] = d[i] * s; else sz.fill(.5, o, o + cnt); o += cnt; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('inkd', new THREE.BufferAttribute(sz, 1));
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: b.mt.roughness, side: b.mt.side })); mesh.userData.baked = true; mesh.castShadow = mesh.receiveShadow = true; out.add(mesh);
  }
  for (const [o, m] of keep) { o.removeFromParent(); o.matrix.copy(m); o.matrix.decompose(o.position, o.quaternion, o.scale); o.userData.noInk = true; o.castShadow = false; out.add(o); }
  root.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  return toonify(out, ink);
}

// ---------- the pieces only the plaza has ----------
function snowman(g) {
  put(g, new THREE.IcosahedronGeometry(.62, 1), flat(SNOW), 0, .55); put(g, new THREE.IcosahedronGeometry(.45, 1), flat(SNOW), 0, 1.35); put(g, new THREE.IcosahedronGeometry(.33, 1), flat(SNOW), 0, 1.98);
  put(g, new THREE.ConeGeometry(.07, .34, 6), flat('#ff8c42'), 0, 1.98, .42).rotation.x = Math.PI / 2; for (const sx of [-.12, .12]) put(g, new THREE.IcosahedronGeometry(.045, 0), flat('#2b2b2b'), sx, 2.08, .29);
  for (const y of [1.2, 1.4, 1.6]) put(g, new THREE.IcosahedronGeometry(.045, 0), flat('#2b2b2b'), 0, y, .43 - Math.abs(y - 1.38) * .3);
  put(g, new THREE.CylinderGeometry(.36, .36, .05, 10), flat('#2b2b2b'), 0, 2.26); put(g, new THREE.CylinderGeometry(.24, .24, .36, 10), flat('#2b2b2b'), 0, 2.45); put(g, new THREE.CylinderGeometry(.245, .245, .08, 10), flat('#e5543b'), 0, 2.33);
  put(g, new THREE.TorusGeometry(.34, .09, 6, 12), flat('#e5543b'), 0, 1.68).rotation.x = Math.PI / 2; put(g, new THREE.BoxGeometry(.14, .42, .08), flat('#e5543b'), .2, 1.46, .3).rotation.z = .2;
  for (const s of [-1, 1]) put(g, new THREE.CylinderGeometry(.03, .03, .8, 5), flat('#7a5236'), s * .7, 1.5, 0).rotation.z = s * -1.0;
}
const GIFTS = [['#e5543b', '#ffd34d'], ['#3f7fc4', '#ffffff'], ['#2f8a55', '#e5543b'], ['#9b6fd6', '#ffd34d'], ['#ff8fab', '#ffffff'], ['#ffd34d', '#e5543b'], ['#5ac8ff', '#ffffff']];
function gift(g, x, z, s, [c, rb], ry) {
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = ry; g.add(o);
  put(o, new THREE.BoxGeometry(s, s * .8, s), flat(c), 0, s * .4); put(o, new THREE.BoxGeometry(s * 1.04, s * .82, s * .2), flat(rb), 0, s * .4); put(o, new THREE.BoxGeometry(s * .2, s * .82, s * 1.04), flat(rb), 0, s * .4);
  for (const sx of [-1, 1]) put(o, new THREE.IcosahedronGeometry(s * .14, 0), flat(rb), sx * s * .13, s * .88, 0);
}
function gifts(g) { for (let i = 0; i < 5; i++) gift(g, Math.cos(i * 2.2) * (.2 + i * .22), Math.sin(i * 2.2) * (.2 + i * .22), .55 + (i * 7 % 4) * .12, GIFTS[i], i * 1.3); }
function stage(g, winter) {
  for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) put(g, new THREE.BoxGeometry(.88, .14, .88), flat((i + j) % 2 ? (winter ? '#e5543b' : '#ffd27a') : (winter ? '#f6faff' : '#ff9fb8')), (i - 2.5) * .9, .07, (j - 2) * .9);
  for (const x of [-2.9, 2.9]) { put(g, new THREE.CylinderGeometry(.07, .09, 3, 6), flat('#8a5a3c'), x, 1.5, -2.5); put(g, new THREE.IcosahedronGeometry(.16, 0), flat('#ffc93c'), x, 3.06, -2.5); }
  for (let i = 0; i < 11; i++) { const u = i / 10; put(g, new THREE.ConeGeometry(.16, .34, 3), flat(['#ff7a59', '#ffc93c', '#7ed3b2', '#8a98ff', '#ff9fb8'][i % 5]), -2.9 + u * 5.8, 2.8 - Math.sin(u * Math.PI) * .5, -2.5).rotation.x = Math.PI; }
}
// The Christmas tree: a trunk in a red tub, seven tiers of branches with snow on them, presents underneath.
function xmasTree() {
  const g = new THREE.Group();
  put(g, new THREE.CylinderGeometry(.5, .6, 1.5, 8), flat('#7a5236'), 0, .75); put(g, new THREE.CylinderGeometry(1.5, 1.75, .5, 10), flat('#c0392b'), 0, .25); put(g, new THREE.CylinderGeometry(1.56, 1.56, .1, 10), flat('#ffd34d'), 0, .52);
  TIERS.forEach(([r, y], k) => {
    put(g, new THREE.ConeGeometry(r, 2.1, 11), flat(k % 2 ? '#2f8a55' : '#277a4c'), 0, y + 1.05);
    put(g, new THREE.ConeGeometry(r * .6, 1.05, 11), flat(SNOW), 0, y + 1.62).scale.y = .9;
    for (let j = 0; j < 5; j++) { const a = j * 1.257 + k, s = put(g, new THREE.IcosahedronGeometry(.2 + (j % 2) * .08, 0), flat(SNOW), Math.cos(a) * r * .8, y + .12, Math.sin(a) * r * .8); s.scale.y = .5; } // snow lying on the branch tips
  });
  GIFTS.forEach((c, i) => { const a = i / GIFTS.length * 6.283 + .3; gift(g, Math.cos(a) * 2.6, Math.sin(a) * 2.6, .6 + (i * 7 % 4) * .14, c, a * 2); });
  bake(g); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return toonify(g, .06);
}
const starGeo = (r, t) => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + Math.PI / 2, d = i % 2 ? r * .45 : r; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * d, Math.sin(a) * d); } s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2); return g; };
// One geometry for a kind of ornament, painted in vertex colours (white parts take the instance's colour).
function paint(parts) {
  let n = 0; const list = parts.map(([g, c]) => { const x = g.index ? g.toNonIndexed() : g; n += x.attributes.position.count; return [x, new THREE.Color(c)]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [g, c] of list) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); for (let i = 0; i < g.attributes.position.count; i++) c.toArray(col, o + i * 3); o += g.attributes.position.count * 3; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); return out;
}
const at = (g, x, y, z, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g; };
const ORN_GEO = {
  ball: () => paint([[at(new THREE.IcosahedronGeometry(.2, 1), 0, -.2, 0), '#ffffff'], [at(new THREE.CylinderGeometry(.06, .06, .08, 6), 0, 0, 0), '#f2b92e']]),
  star: () => paint([[at(starGeo(.26, .1), 0, -.22, 0), '#ffffff']]),
  bell: () => paint([[at(new THREE.CylinderGeometry(.07, .2, .26, 8), 0, -.16, 0), '#ffffff'], [at(new THREE.CylinderGeometry(.23, .23, .05, 8), 0, -.3, 0), '#ffffff'], [at(new THREE.IcosahedronGeometry(.07, 0), 0, -.36, 0), '#c0392b']]),
  cane: () => paint([...[0, 1, 2, 3, 4].map(i => [at(new THREE.CylinderGeometry(.05, .05, .09, 6), 0, -.42 + i * .09, 0), i % 2 ? '#e5543b' : '#ffffff']), [at(new THREE.TorusGeometry(.09, .05, 5, 8, Math.PI), .09, .0, 0), '#e5543b']]),
  ginger: () => paint([[at(new THREE.CylinderGeometry(.1, .1, .06, 8), 0, -.1, 0, Math.PI / 2), '#ffffff'], [at(new THREE.BoxGeometry(.16, .2, .06), 0, -.28, 0), '#ffffff'], [at(new THREE.BoxGeometry(.36, .07, .06), 0, -.24, 0), '#ffffff'],
    [at(new THREE.BoxGeometry(.07, .16, .06), -.05, -.44, 0), '#ffffff'], [at(new THREE.BoxGeometry(.07, .16, .06), .05, -.44, 0), '#ffffff'], [at(new THREE.IcosahedronGeometry(.025, 0), 0, -.24, .04), '#fff6e0'], [at(new THREE.IcosahedronGeometry(.025, 0), 0, -.31, .04), '#fff6e0']]),
  snow: () => paint([0, 1, 2].map(i => [at(new THREE.BoxGeometry(.44, .07, .05), 0, -.24, 0, 0, i * Math.PI / 3), '#ffffff'])),
};
// Meshes that share a material and never move apart become one mesh (the carousel's turning top, a pet's two eyes).
// skip(o): leave this child and everything under it alone.
function fuse(root, skip) {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert(), by = new Map(), m4 = new THREE.Matrix4();
  const walk = o => { for (const c of [...o.children]) { if (skip?.(c)) continue;
    if (c.isMesh && !c.isInstancedMesh && !c.children.length && c.visible && !c.material.map && !c.userData.ink && !c.userData.baked && c.geometry.attributes.normal) {
      const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); g.applyMatrix4(m4.multiplyMatrices(inv, c.matrixWorld));
      let b = by.get(c.material); if (!b) by.set(c.material, b = { parts: [], n: 0, first: c }); b.parts.push(g); b.n += g.attributes.position.count; c.removeFromParent();
    } else walk(c); } };
  walk(root);
  for (const [mt, b] of by) {
    const pos = new Float32Array(b.n * 3), nor = new Float32Array(b.n * 3), hasCol = b.parts.every(g => g.attributes.color), col = hasCol ? new Float32Array(b.n * 3) : null; let o = 0;
    for (const g of b.parts) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); if (col) col.set(g.attributes.color.array.subarray(0, g.attributes.position.count * 3), o); o += g.attributes.position.count * 3; g.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(g, mt); mesh.userData = { ...b.first.userData }; mesh.castShadow = b.first.castShadow; mesh.receiveShadow = b.first.receiveShadow; mesh.renderOrder = b.first.renderOrder; root.add(mesh);
  }
  return root;
}
// Someone else's pet, seen from across the square: the whole pet as one mesh and one outline (its ears and tail keep
// still), and its eyes as one. A handful of draw calls instead of fifteen, so a full room stays light.
function litePet(g) { const out = mergeStatic(g, .045); out.scale.copy(g.scale); fuse(out); out.traverse(o => { if (o.isMesh) o.castShadow = false; }); return out; }
const ORN_SHAPE = { star: 'star', bell: 'bell', cane: 'cane', ginger: 'ginger', snow: 'snow' };

export function createScene(canvas, opts = {}) {
  const theme = opts.theme === 'winter' ? 'winter' : 'meadow', winter = theme === 'winter', level = gfx();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 3, 700);
  scene.add(new THREE.HemisphereLight('#ffffff', winter ? '#dfe9ff' : '#ffe9c9', winter ? 1.75 : 2));
  const key = new THREE.DirectionalLight('#ffffff', winter ? 1.35 : 1.5); key.position.set(12, 26, 14); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 }); key.shadow.normalBias = .05; scene.add(key);
  skyDome(scene, winter ? '#6aa8e8' : '#4fa8f0', winter ? '#e4f1ff' : '#c9ecff'); scene.add(clouds({ near: 50, far: 14, below: -12, min: 26, max: 110 }));
  const fly = winter ? null : birds(scene, 26, 9, 4, 1.2);

  // ---- the island
  const C = 2 * (R_WALK - 2.4);
  // (dressed by season3d.js like every game island; the plaza's own theme decides between the tree and the fountain)
  const today = seasonLookNow(), isle = island(C, C, { round: true, props: 46, seed: 4, rim: 3.4, flowers: 120, clear: R_WALK, size: 1.7, depth: 1.1, open: .2, season: winter ? 'winter' : today === 'winter' ? 'spring' : today });
  for (const c of [...isle.children]) if (c.userData.nightOnly) isle.remove(c); // the plaza has its own lamps round the square
  scene.add(isle);
  const stat = new THREE.Group(), live = [];
  const paveM = flat(winter ? '#dfe3ee' : '#ead9bd'), paveD = flat(winter ? '#c3c9da' : '#d9c3a0'), ringM = flat(winter ? '#aab2c8' : '#c9ae88');
  { const pav = new THREE.Group(); const disc = (r, m, y) => put(pav, new THREE.CylinderGeometry(r, r, .06, 56), m, 0, y);
    disc(R_SQUARE + .35, ringM, 0); disc(R_SQUARE, paveM, .012); disc(TREE_R + 1.3, paveD, .024); disc(TREE_R + 1, paveM, .036);
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, r = (R_SQUARE + TREE_R + 1.3) / 2; put(pav, new THREE.BoxGeometry(.09, .05, R_SQUARE - TREE_R - 1.6), paveD, Math.cos(a) * r, .02, Math.sin(a) * r).rotation.y = -a + Math.PI / 2; }
    for (const [x, z] of [[12.6, 10.2], [-12.4, 10.2], [-12.6, -10.4], [12.6, -10.4], [0, 15.6], [0, -14.4], [15.4, .4], [-15.4, .6]]) { const d = Math.hypot(x, z), n = Math.round((d - R_SQUARE - .6) / .95); // stepping stones out to each corner
      for (let k = 0; k < n; k++) { const r = R_SQUARE + .9 + k * .95; put(pav, new THREE.CylinderGeometry(.36, .36, .05, 7), k % 2 ? paveM : paveD, x / d * r + Math.sin(k * 5 + x) * .12, .01, z / d * r + Math.cos(k * 3 + z) * .12); } }
    { const s = new THREE.Group(); s.position.set(STAGE[0], 0, STAGE[1]); s.rotation.y = STAGE[2]; stage(s, winter); pav.add(s); }
    bake(pav); stat.add(pav); }
  for (const [kind, x, z, ry, s] of [...THINGS, ...(winter ? WINTER : MEADOW)]) {
    let g;
    if (kind === 'snowman') { g = new THREE.Group(); snowman(g); bake(g); }
    else if (kind === 'gifts') { g = new THREE.Group(); gifts(g); bake(g); }
    else if (LIVE.has(kind)) { g = itemModel(kind, true); g.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noInk; o.receiveShadow = false; } }); g.scale.setScalar(s); g.position.set(x, .03, z); g.rotation.y = ry; scene.add(g); if (g.userData.tick) live.push(g);
      if (kind === 'carousel') g.traverse(o => { if (o.children.some(c => c.userData.bob !== undefined)) { fuse(o, c => c.userData.bob !== undefined); for (const r of o.children) if (r.userData.bob !== undefined && r.children[1]) fuse(r.children[1]); } }); // its turning top: 85 little meshes down to a dozen
      continue; }
    else g = itemModel(kind, false, true);
    g.scale.setScalar(s); g.position.set(x, .03, z); g.rotation.y = ry; stat.add(g);
  }
  scene.add(mergeStatic(stat, .05));
  // strings of lights between the lanterns, and (in winter) round the tree: one draw call, blinking in four groups
  const bulbs = [], BULB = ['#ffd34d', '#ff5a5a', '#5ac8ff', '#8dff8a', '#ff8fd0'];
  LAMPS.forEach(([x, z], i) => { const [x2, z2] = LAMPS[(i + 1) % LAMPS.length]; if (Math.abs(x + x2) < 4 && z > 0) return; // the gap by the arch
    for (let k = 1; k < 10; k++) { const u = k / 10; bulbs.push([x + (x2 - x) * u, 2.25 - Math.sin(u * Math.PI) * .6, z + (z2 - z) * u, .1]); } });
  let treeG = null, treeMats = [], ornMeshes = {}, center = null;
  if (winter) {
    treeG = xmasTree(); treeG.position.y = .03; scene.add(treeG);
    treeG.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); treeMats.push(o.material); } });
    TIERS.forEach(([r, y], k) => { const n = Math.round(r * 5.2); for (let j = 0; j < n; j++) { const a = (j + .5) / n * 6.283 + k * .9; bulbs.push([Math.cos(a) * (r * .9), y + .34 + Math.sin(j * 2.1) * .1, Math.sin(a) * (r * .9), .12]); } });
    const star = new THREE.Mesh(starGeo(.85, .3), new THREE.MeshBasicMaterial({ color: '#ffd34d' })); star.position.y = TREE_H + .75; treeG.add(star); treeMats.push(star.material);
    const halo = new THREE.Mesh(starGeo(1.05, .16), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: .45, depthWrite: false })); halo.position.y = TREE_H + .75; treeG.add(halo);
    live.push({ userData: { tick: T => { star.rotation.y = halo.rotation.y = T * .7; halo.scale.setScalar(1 + Math.sin(T * 3) * .08); } } });
    const base = toonMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 })).clone(); treeMats.push(base);
    for (const k of Object.keys(ORN_GEO)) { const im = new THREE.InstancedMesh(ORN_GEO[k](), base, SLOTS); im.count = 0; im.frustumCulled = false; im.userData.slots = []; treeG.add(im); ornMeshes[k] = im; }
  } else { center = itemModel('fountain', true); center.scale.setScalar(3.2); center.position.y = .03; center.traverse(o => { if (o.isMesh) o.castShadow = !o.userData.noInk; }); scene.add(center); if (center.userData.tick) live.push(center); }
  const bulbM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length); bulbM.frustumCulled = false;
  { const m = new THREE.Matrix4(), c = new THREE.Color(); bulbs.forEach(([x, y, z, r], i) => { m.makeScale(r, r, r).setPosition(x, y, z); bulbM.setMatrixAt(i, m); bulbM.setColorAt(i, c.set(BULB[i % BULB.length])); }); }
  scene.add(bulbM); treeMats.push(bulbM.material);
  let blinkAt = 0, blinkN = 0;
  function blink(T) { if (T < blinkAt) return; blinkAt = T + .45; blinkN++; const c = new THREE.Color(); for (let i = 0; i < bulbs.length; i++) { c.set(BULB[i % BULB.length]); if ((i + blinkN) % 4 === 0) c.multiplyScalar(.35); bulbM.setColorAt(i, c); } bulbM.instanceColor.needsUpdate = true; }
  // falling snow
  let snow = null;
  if (winter) { const n = level === 'low' ? 140 : 380, P = new Float32Array(n * 3); for (let i = 0; i < n; i++) P.set([(hash(i, 1) - .5) * 60, hash(i, 2) * 20, (hash(i, 3) - .5) * 60], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    snow = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: .17, transparent: true, opacity: .95, depthWrite: false })); snow.frustumCulled = false; scene.add(snow); }
  const fx = createFx(scene, { max: 400 });
  // a soft dark spot under everyone and every pet instead of real shadows
  const BLOBS = 128, blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1c2540', transparent: true, opacity: .2, depthWrite: false }), BLOBS); blobs.frustumCulled = false; blobs.renderOrder = 1; scene.add(blobs);
  const arrow = youArrow(); arrow.scale.setScalar(.8); arrow.visible = false; // (the yellow "You" tag marks you; the arrow stays out of its way)
  const mark = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthWrite: false })); mark.visible = false; mark.position.y = .1; scene.add(mark);
  nightScene(scene);
  res.prep(scene);

  // ---- ornaments
  let ornList = [];
  function paintOrns() {
    if (!winter) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1.25, 1.25, 1.25), v = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    for (const im of Object.values(ornMeshes)) { im.count = 0; im.userData.slots.length = 0; }
    for (const o of ornList) { const d = ORNAMENTS[o.k]; if (!d) continue;
      const im = ornMeshes[ORN_SHAPE[d.id] || 'ball'], [x, y, z] = slotPos(o.i), n = im.count++;
      q.setFromAxisAngle(up, Math.atan2(x, z)); im.setMatrixAt(n, m.compose(v.set(x, y, z), q, s)); im.setColorAt(n, c.set(d.c)); im.userData.slots[n] = o.i; }
    for (const im of Object.values(ornMeshes)) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
  }
  const setTree = list => { ornList = Array.isArray(list) ? list.slice() : []; paintOrns(); };
  function setOrn(i, o) { const was = ornList.length; ornList = ornList.filter(x => x.i !== i); if (o) { ornList.push(o); const [x, y, z] = slotPos(i); fx.sparkle(new THREE.Vector3(x, y + .03, z), { n: 12, r: .5, colors: ['#fff1a8', '#ffffff', ORNAMENTS[o.k]?.c || '#ffd34d'] }); } paintOrns(); return was; }

  // ---- people
  const folk = new Map(); let me = null, queue = [];
  const petsShown = m => m === me ? 3 : petCap;
  let petCap = 3, noInk = level === 'low'; // light graphics: other people are drawn without their outline (half the triangles of a crowd)
  function dropModel(m) {
    if (m.wrap) { scene.remove(m.wrap); disposeAvatar(m.av); m.wrap = m.av = null; }
    for (const p of m.pets) if (p.g) { scene.remove(p.g); p.g.traverse(o => { if (o.isMesh && !o.material.userData?.shared) o.geometry.dispose(); }); }
    m.pets = [];
  }
  function build(m) {
    if (!folk.has(m.s)) return;
    const p = m.p;
    if (!m.wrap) { m.wrap = new THREE.Group(); m.wrap.rotation.order = 'YXZ'; m.wrap.scale.setScalar(K); m.av = avatar3d(p.c, p.av, { pose: 'stand' }); m.av.position.y = .76; m.av.traverse(o => { if (o.isMesh) { o.castShadow = false; if (noInk && m !== me && o.material.isMeshBasicMaterial && o.material.side === THREE.BackSide) o.visible = false; } }); m.wrap.add(m.av); m.wrap.position.set(m.x, 0, m.z); m.wrap.rotation.y = m.ry; scene.add(m.wrap); return true; }
    const want = (p.pets || []).slice(0, petsShown(m));
    if (m.pets.length < want.length) { const k = m.pets.length, x = want[k], f = formOf(x.lv | 0); let g; try { g = petModel(x.sp, f, x.look || null); if (m !== me) g = litePet(g); } catch { return false; }
      const sc = .44 + .06 * f; g.scale.multiplyScalar(sc); const back = .95 + k * .75, side = (k % 2 ? -1 : 1) * (.45 + k * .1);
      const pet = { g, k, sc: g.scale.x, back, side, x: m.x - Math.sin(m.ry) * back, z: m.z - Math.cos(m.ry) * back, ry: m.ry, seed: m.s * 3 + k, ph: 0, sp: 0 }; g.position.set(pet.x, 0, pet.z); scene.add(g); m.pets.push(pet); return true; }
    return false;
  }
  const enqueue = m => { if (!queue.includes(m)) queue.push(m); };
  function add(p, isMe = false) {
    const old = folk.get(p.s); if (old) dropModel(old);
    const m = { s: p.s, p, x: p.x / Q, z: p.z / Q, tx: p.x / Q, tz: p.z / Q, ry: p.r / 10, tr: p.r / 10, e: p.e | 0, eAt: -9, sp: p.sp ?? -1, amt: 0, ph: 0, pets: [], wrap: null, av: null, sx: 0, sy: 0, on: false, hop: 0 };
    folk.set(p.s, m); if (isMe) me = m; enqueue(m); return m;
  }
  function remove(s) { const m = folk.get(s); if (!m) return; dropModel(m); folk.delete(s); queue = queue.filter(x => x !== m); }
  function look(p) { const m = folk.get(p.s); if (!m) return; const same = JSON.stringify([m.p.c, m.p.av]) === JSON.stringify([p.c, p.av]), pets = JSON.stringify(m.p.pets) === JSON.stringify(p.pets); m.p = { ...m.p, ...p };
    if (!same || !pets) { const keep = same && m.wrap; if (keep) { for (const q of m.pets) scene.remove(q.g); m.pets = []; } else dropModel(m); enqueue(m); } }
  function setPeople(list, mine) { for (const s of [...folk.keys()]) remove(s); me = null; for (const p of list) add(p, p.s === mine); if (me) { cam.x = me.x; cam.z = me.z; } }
  function moved(s, x, z, r) { const m = folk.get(s); if (!m || m === me) return; m.tx = x / Q; m.tz = z / Q; m.tr = r / 10; }
  function fix(x, z) { if (!me) return; me.x = x / Q; me.z = z / Q; goal = null; }
  const T0 = performance.now() / 1000; let T = 0;
  function emote(s, e, sp = -1) {
    const m = folk.get(s); if (!m) return;
    m.e = e; m.eAt = T; m.sp = sp; m.fxN = 0;
    if (sp >= 0 && SPOTS[sp] && !MOVING[SPOTS[sp].k]) { const q = SPOTS[sp]; m.x = m.tx = q.x; m.z = m.tz = q.z; m.ry = m.tr = q.ry; if (m === me) { goal = null; sentX = Math.round(q.x * Q); sentZ = Math.round(q.z * Q); } }
    const head = new THREE.Vector3(m.x, 1.9, m.z);
    if (e === EM.cheer) { if (m === me) fx.confetti(head, { n: 36, w: 2.4, h: 2.2, s: 'me' }); else fx.burst(head, { n: 16, colors: ['#ffd84a', '#ff9fb8', '#8a98ff', '#7ed3b2'], shape: STAR, speed: 2.6, up: 3.4, size: .3 }); }
    if (e === EM.trick) fx.burst(head.setY(.5), { n: 10, colors: ['#ff9fb8', '#ffd84a'], shape: HEART, speed: 1.6, up: 2.6, size: .3 });
    if (e === EM.stars) fx.burst(head, { n: few ? 12 : 22, colors: ['#ffd84a', '#fff1a8', '#ffffff', '#9fd8ff'], shape: STAR, speed: 2.2, up: 5.2, size: .34, grav: 5, life: 1.3 });
    if (e === EM.spin || e === EM.flip) fx.puff(new THREE.Vector3(m.x, 0, m.z), { n: 8, color: winter ? '#ffffff' : '#fff4e2' });
    if (e === EM.jump) fx.puff(new THREE.Vector3(m.x, 0, m.z), { n: 8, color: winter ? '#ffffff' : '#fff4e2' });
  }
  const few = level === 'low';
  // ---- throwing: snowballs in winter, a soft ball the rest of the year
  const BALLS = ['#ff8a5c', '#ffd34d', '#7ed3b2', '#8a98ff', '#ff9fb8', '#9fd8ff'];
  const ballGeo = new THREE.SphereGeometry(.17, 10, 8), balls = [];
  function throwBall(s, x, z, h) {
    const m = folk.get(s); if (!m) return; x /= Q; z /= Q;
    const d = Math.hypot(x - m.x, z - m.z); m.thr = T; m.tr = Math.atan2(x - m.x, z - m.z); if (m !== me) m.tr2 = undefined;
    if (m.hid) return;
    let b = balls.find(q => !q.on); if (!b) { if (balls.length >= 16) return; b = { g: new THREE.Mesh(ballGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' })), on: false }; b.g.castShadow = false; scene.add(b.g); balls.push(b); }
    b.col = winter ? '#ffffff' : BALLS[s % BALLS.length]; b.g.material.color.set(b.col);
    Object.assign(b, { on: true, t0: T + .16, dur: throwMs(d) / 1000, x0: m.x + Math.sin(m.tr) * .3, z0: m.z + Math.cos(m.tr) * .3, x1: x, z1: z, y1: h ? 1.05 : .1, top: .7 + d * .16, h }); b.g.visible = false;
  }
  function stepBalls() {
    for (const b of balls) { if (!b.on) continue; const u = (T - b.t0) / b.dur; if (u < 0) continue;
      if (u >= 1) { b.on = false; b.g.visible = false; const at = new THREE.Vector3(b.x1, b.y1, b.z1);
        if (winter) fx.puff(at, { n: few ? 6 : 10, color: ['#ffffff', '#e6f3ff'], size: .3, speed: 2.6 }); else fx.burst(at, { n: few ? 6 : 10, colors: [b.col, '#ffffff'], shape: STAR, speed: 2, up: 1.8, size: .22, life: .5, grav: 7 });
        if (b.h) { const t = folk.get(b.h); if (t) { t.hitAt = T; t.hitDir = Math.atan2(b.x1 - b.x0, b.z1 - b.z0); } } else fx.puff(at.setY(0), { n: 6, color: winter ? '#ffffff' : '#fff4e2', size: .26 });
        continue; }
      b.g.visible = true; b.g.position.set(b.x0 + (b.x1 - b.x0) * u, 1.25 + (b.y1 - 1.25) * u + Math.sin(u * Math.PI) * b.top, b.z0 + (b.z1 - b.z0) * u); }
  }
  // where a tap would send a throw: the person under it, or the spot on the ground, no further than an arm can throw
  function aim(px, py) {
    if (!me) return null; const q = pick(px, py); let x, z;
    if (q?.kind === 'player') { const t = folk.get(q.s); x = t.x; z = t.z; } else if (q?.kind === 'pet') { const t = folk.get(q.s), p = t?.pets.find(o => o.k === q.i); if (!p || q.mine) return null; x = p.x; z = p.z; }
    else { const r = canvas.getBoundingClientRect(); ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(ground, hit)) return null; x = hit.x; z = hit.z; }
    const d = Math.hypot(x - me.x, z - me.z); if (d < .7) return null; if (d > THROW_RANGE) { x = me.x + (x - me.x) / d * THROW_RANGE; z = me.z + (z - me.z) / d * THROW_RANGE; }
    return [Math.round(x * Q), Math.round(z * Q)];
  }
  // ---- fireworks for the timed events: rockets of stars bursting high over the square
  const FW = [['#ff5a6e', '#ffd0d6', '#ffffff'], ['#ffd84a', '#fff1a8', '#ffffff'], ['#6ecbff', '#d6f1ff', '#ffffff'], ['#7ee08a', '#dcffd9', '#ffffff'], ['#c79bff', '#f0e2ff', '#ffffff'], ['#ff9f4a', '#ffe1bf', '#ffffff']];
  let fwOn = 0, fwAt = 0, fwRush = 0;
  function rocket() { const a = Math.random() * 6.283, r = 4 + Math.random() * 15, c = FW[Math.random() * FW.length | 0];
    fx.burst(new THREE.Vector3(Math.sin(a) * r, 4.5 + Math.random() * 4.5, Math.cos(a) * r * .8 - 3), { n: few ? 16 : 34, colors: c, shape: STAR, speed: 6.5, up: 2, size: 1.05, life: 1.7, grav: 2.4, drag: 1.5 }); } // kept low: the camera looks down at the square, so anything higher would burst off the screen
  const fireworks = rate => { fwOn = +rate || 0; }; // 0 none, 1 a full show, less for a rocket now and then
  const volley = (secs = 12) => { fwRush = T + secs; };

  const spotTaken = sp => { for (const m of folk.values()) if (m.sp === sp) return true; return false; };

  // ---- your own walking
  const blocks = blocksOf(theme);
  let inX = 0, inZ = 0, goal = null, stuck = 0, side = 0, sentX = 0, sentZ = 0, sentR = -1, sendAt = 0;
  let goalCb = null, bestD = 0, bestT = 0;
  // keys and the joystick push relative to the screen, so they are turned by the camera's turn
  const setMove = (x, z) => { inX = x; inZ = z; if (x || z) { goal = null; goalCb = null; mark.visible = false; } };
  function walkTo(x, z, then = null) { [x, z] = clampWalk(x, z);
    // a spot inside a bench or a lamp can never be reached: aim for its nearest edge instead
    for (const b of blocks) { const dx = x - b[0], dz = z - b[1], d = Math.hypot(dx, dz), min = b[2] + BODY_R + .06; if (d < min) { const ax = d > 1e-3 ? dx / d : (me ? me.x - b[0] : 0), az = d > 1e-3 ? dz / d : (me ? me.z - b[1] : 1), l = Math.hypot(ax, az) || 1; x = b[0] + ax / l * min; z = b[1] + az / l * min; } }
    [x, z] = clampWalk(x, z); goal = [x, z]; goalCb = then; stuck = 0; side = 0; bestD = 1e9; bestT = 0; mark.position.set(x, .1, z); mark.visible = true; mark.scale.setScalar(1); }
  function stepMe(dt) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    let vx = inX * cy + inZ * sy, vz = -inX * sy + inZ * cy;
    if (!vx && !vz && goal) { const dx = goal[0] - me.x, dz = goal[1] - me.z, d = Math.hypot(dx, dz);
      if (d < bestD - .05) { bestD = d; bestT = 0; } else bestT += dt; // no nearer for a while (circling something): stop
      if (d < .12 || stuck > 1 || bestT > 1.6) { const cb = d < .6 ? goalCb : null; goal = null; goalCb = null; mark.visible = false; cb?.(); } else { vx = dx / d; vz = dz / d; if (d < SPEED * dt) { vx *= d / (SPEED * dt); vz *= d / (SPEED * dt); } } }
    const moving = !!(vx || vz);
    if (moving) {
      if (me.sp >= 0 || EMOTES[me.e]?.loop) { me.e = 0; me.sp = -1; }
      const l = Math.hypot(vx, vz), k = l > 1 ? 1 / l : 1, ox = me.x, oz = me.z;
      let x = me.x + vx * k * SPEED * dt, z = me.z + vz * k * SPEED * dt;
      let bump = null;
      for (const b of blocks) { const dx = x - b[0], dz = z - b[1], d = Math.hypot(dx, dz), min = b[2] + BODY_R; if (d < min && d > 1e-4) { x = b[0] + dx / d * min; z = b[1] + dz / d * min; bump = b; } }
      // walking to a tapped spot straight into a bench or a lamp: step round it instead of pushing against it
      if (bump && goal && Math.hypot(x - ox, z - oz) < SPEED * dt * .6) { const dx = x - bump[0], dz = z - bump[1], d = Math.hypot(dx, dz) || 1; let tx = -dz / d, tz = dx / d;
        if (side === 0) side = tx * vx + tz * vz >= 0 ? 1 : -1; tx *= side; tz *= side; x += tx * SPEED * dt * .9; z += tz * SPEED * dt * .9; } else if (!bump) side = 0;
      [x, z] = clampWalk(x, z);
      const went = Math.hypot(x - ox, z - oz); stuck = went < SPEED * dt * .25 ? stuck + dt : 0;
      me.x = x; me.z = z; if (went > 1e-4) me.tr = Math.atan2(vx, vz);
      me.spd = went / Math.max(dt, 1e-3) / SPEED;
    } else me.spd = 0;
    // tell the server: six times a second while walking, and once more when you stop
    const qx = Math.round(me.x * Q), qz = Math.round(me.z * Q), qr = Math.round(((me.tr % 6.2832) + 6.2832) % 6.2832 * 10);
    const now = performance.now();
    if ((qx !== sentX || qz !== sentZ || qr !== sentR) && (now - sendAt > 160)) { sendAt = now; sentX = qx; sentZ = qz; sentR = qr; opts.send?.({ k: 'mv', x: qx, z: qz, r: qr }); }
  }

  // ---- camera
  const cam = { x: 0, z: 14, zoom: 1, tall: false, fade: 1, yaw: 0, el: 0, ty: 0, te: 0 }; // yaw/el: where the player turned the view (ty/te are where it is easing to)
  let W = 0, H = 0, rw = 0, rh = 0;
  const ro = new ResizeObserver(es => { const b = es[es.length - 1].contentRect; rw = b.width; rh = b.height; }); ro.observe(canvas);
  const setZoom = z => { cam.zoom = Math.max(.6, Math.min(1.7, z)); };
  const EL0 = Math.atan2(.6, .8);
  const turn = (dy, de = 0) => { cam.ty += dy; cam.te = Math.max(-.32, Math.min(.5, cam.te + de)); };
  const resetView = () => { cam.ty = Math.round(cam.yaw / 6.2832) * 6.2832; cam.te = 0; };
  const turned = () => Math.abs(wrapA(cam.ty)) > .04 || Math.abs(cam.te) > .04;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  // What is under a tap: a person (nearest head within reach), an ornament, or a spot on the ground.
  function pick(px, py) {
    const r = canvas.getBoundingClientRect(), x = px - r.left, y = py - r.top;
    let best = null, bd = 44;
    for (const m of folk.values()) { if (m === me || !m.on) continue; const d = Math.hypot(m.sx - x, m.sy + 26 - y); if (d < bd) { bd = d; best = m; } }
    let pet = null, pd = 30;
    for (const m of folk.values()) if (!m.hid) for (const q of m.pets) { v3.set(q.x, .45, q.z).project(camera); const d = Math.hypot((v3.x * .5 + .5) * r.width - x, (-v3.y * .5 + .5) * r.height - y); if (d < pd) { pd = d; pet = { kind: 'pet', s: m.s, i: q.k, mine: m === me }; } }
    if (pet && pd < bd * .7) return pet;
    if (best) return { kind: 'player', s: best.s };
    if (pet) return pet;
    ndc.set(x / r.width * 2 - 1, -(y / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const th = pickThing(x, y, r);
    if (winter) { const hits = ray.intersectObjects(Object.values(ornMeshes), false); if (hits.length && hits[0].instanceId != null) return { kind: 'orn', i: hits[0].object.userData.slots[hits[0].instanceId] }; }
    if (th >= 0) return th === ALL.length ? (winter ? { kind: 'tree' } : { kind: 'thing', i: th }) : { kind: 'thing', i: th };
    if (!ray.ray.intersectPlane(ground, hit)) return null;
    if (Math.hypot(hit.x, hit.z) < TREE_R) return winter ? { kind: 'tree' } : { kind: 'thing', i: ALL.length };
    if (Math.hypot(hit.x, hit.z) > R_WALK + 1.5) return null;
    return { kind: 'ground', x: hit.x, z: hit.z };
  }

  // ---- the things standing on the island: which one is under a tap, and what it does when someone pokes it
  const ALL = thingsOf(theme);
  const TALL = { lighthouse: 4.4, windmill: 3.8, treehouse: 3.8, balloon: 3.6, arch: 2.8, gazebo: 3.2, carousel: 3.2, lamp: 2.6, glow: 2.6, swing: 2.6, snowman: 1.9, cherry: 3.2, miniwheel: 2.6, well: 2.2, goldpet: 1.8 };
  const thingAt = i => i === ALL.length ? { kind: winter ? 'tree' : 'fountain', x: 0, z: 0, r: TREE_R, h: winter ? 8 : 2.4 } : ALL[i] ? { kind: ALL[i][0], x: ALL[i][1], z: ALL[i][2], r: ALL[i][5], h: TALL[ALL[i][0]] || 1.3 } : null;
  function pickThing(x, y, r) {
    let best = -1, bd = 1e9; const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    for (let i = 0; i <= ALL.length; i++) { const t = thingAt(i), wide = i === ALL.length ? 2 : Math.max(.75, t.r) + .15, n = Math.max(2, Math.ceil(t.h / 1.1));
      for (let k = 0; k < n; k++) { const yy = .35 + (t.h - .5) * k / (n - 1), w = i === ALL.length ? wide * (1.5 - k / n) : wide;
        v3.set(t.x, yy, t.z).project(camera); if (v3.z > 1) continue; const px = (v3.x * .5 + .5) * r.width, py = (-v3.y * .5 + .5) * r.height;
        v3.set(t.x + rx * w, yy, t.z + rz * w).project(camera); const pr = Math.abs((v3.x * .5 + .5) * r.width - px), dd = Math.hypot(px - x, py - y);
        if (dd < pr && dd / pr < bd) { bd = dd / pr; best = i; } } }
    return best;
  }
  const POKE_FX = { campfire: [['#ff8a3c', '#ffd34d', '#ff5a3c'], STAR], well: [['#ffd34d', '#fff1a8'], STAR], goldpet: [['#ffd34d', '#fff1a8', '#ffffff'], STAR], chest: [['#6ecbff', '#ffd34d', '#ff9fb8'], STAR], arch: [['#ff9fb8', '#ff6f91'], HEART], swing: [['#ff9fb8', '#ffd0dc'], HEART],
    cherry: [['#ffb7d1', '#ffd6e6'], HEART], flowers: [['#ff9fb8', '#ffd34d', '#c79bff'], STAR], gifts: [['#ff5a6e', '#7ee08a', '#6ecbff', '#ffd34d'], STAR], lighthouse: [['#fff1a8', '#ffffff'], STAR], lamp: [['#fff1a8', '#ffd34d'], STAR], glow: [['#bfe9ff', '#ffffff'], STAR] };
  function poke(i) { const t = thingAt(i); if (!t) return; const f = POKE_FX[t.kind], at = new THREE.Vector3(t.x, Math.min(t.h, 3.2) * .75, t.z);
    if (f) fx.burst(at, { n: few ? 7 : 12, colors: f[0], shape: f[1], speed: 2, up: 3, size: .34, grav: 5, life: 1.1 });
    else fx.puff(at.setY(t.kind === 'snowman' || t.kind === 'hotspring' || t.kind === 'fountain' ? 1 : .2), { n: 10, color: winter || t.kind === 'hotspring' ? '#ffffff' : '#fff4e2', size: .4, speed: 2.6 });
    fx.sparkle?.(new THREE.Vector3(t.x, 1, t.z), { n: 6, r: Math.max(.8, t.r), colors: ['#ffffff', '#fff1a8'] }); }
  // Where to stand to reach thing i: its edge on your side. [x, z]
  function standBy(i) { const t = thingAt(i); if (!t || !me) return null; const dx = me.x - t.x, dz = me.z - t.z, d = Math.hypot(dx, dz) || 1, rr = Math.max(t.r, .5) + BODY_R + .3; return clampWalk(t.x + dx / d * rr, t.z + dz / d * rr); }
  const nearThing = i => { const t = thingAt(i); return !!t && !!me && Math.hypot(me.x - t.x, me.z - t.z) < Math.max(t.r, .5) + POKE_REACH; };

  // ---- hosts who left for their table: their avatar stays where they stood, under the signpost
  const ghosts = new Map();
  function setGhost(code, g) { dropGhost(code); if (!g || !g.c) return; const wrap = new THREE.Group(); wrap.scale.setScalar(K); let av; try { av = avatar3d(g.c, g.av, { pose: 'stand' }); } catch { return; }
    av.position.y = .76; av.traverse(o => { if (o.isMesh) o.castShadow = false; }); wrap.add(av); wrap.position.set(g.x / Q, 0, g.z / Q); wrap.rotation.y = (g.r || 0) / 10; scene.add(wrap); ghosts.set(code, { wrap, av, x: g.x / Q, z: g.z / Q, seed: g.x + g.z }); }
  function dropGhost(code) { const g = ghosts.get(code); if (!g) return; scene.remove(g.wrap); disposeAvatar(g.av); ghosts.delete(code); }

  // ---- every frame
  const v3 = new THREE.Vector3(), bm = new THREE.Matrix4(), TAG_Y = { sit: 1.78, nap: 1.0, angel: 1.0 };
  let drawn = false, slowN = 0;
  function animate(m, dt) {
    const mine = m === me;
    if (!mine) { const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz);
      if (d > 6) { m.x = m.tx; m.z = m.tz; m.spd = 0; } // a jump (took a seat, was set right by the server): no sliding across the square
      else if (d > .02) { const step = Math.min(d, Math.max(SPEED * 1.15 * dt, d * dt * 6)); m.x += dx / d * step; m.z += dz / d * step; m.spd = Math.min(1.2, step / Math.max(dt, 1e-3) / SPEED); if (d > .25) m.tr2 = Math.atan2(dx, dz); }
      else { m.spd = 0; m.tr2 = undefined; } }
    const face = mine ? m.tr : (m.spd > .05 && m.tr2 !== undefined ? m.tr2 : m.tr);
    m.ry += wrapA(face - m.ry) * Math.min(1, dt * 12);
    m.amt += ((m.spd > .05 ? Math.min(1, m.spd) : 0) - m.amt) * Math.min(1, dt * 10);
    m.ph += dt * 9.5 * Math.max(m.amt, .001);
    if (!m.wrap) return;
    const def = EMOTES[m.e], id = def?.id, t = T - m.eAt, u = def?.ms ? t / (def.ms / 1000) : 0;
    if (def && !def.loop && u >= 1) m.e = 0;
    const sit = id === 'sit', seat = sit && m.sp >= 0 ? SPOTS[m.sp] : null, ride = seat?.k === 'ride', swing = seat?.k === 'swing';
    let y = 0, hop = 0, lean = 0;
    if (id === 'jump') { y = Math.sin(Math.min(1, u) * Math.PI) * 1.15; hop = 1 - u; }
    if (id === 'cheer') { hop = .5 + .5 * Math.sin(t * 9); y = Math.abs(Math.sin(t * 9)) * .22; }
    if (id === 'dance') { y = Math.abs(Math.sin(t * 6.5)) * .16; lean = Math.sin(t * 6.5) * .1; }
    if (sit) y = seat ? seat.y : 0;
    let rx = 0, turn = id === 'dance' ? Math.sin(t * 3.25) * .5 : 0, bend = 0, ox = 0;
    const lie = id === 'nap' || id === 'angel';
    if (id === 'clap') y = Math.abs(Math.sin(t * 9)) * .05;
    if (id === 'bow') bend = Math.min(1, Math.sin(Math.min(1, u) * Math.PI) * 1.7) * 1.05;
    if (id === 'spin') { const w = Math.min(1, u); turn = (1 - (1 - w) * (1 - w)) * Math.PI * 4; y = Math.sin(w * Math.PI) * .28; }
    if (id === 'laugh') { rx = -.2 + Math.sin(t * 13) * .05; y = Math.abs(Math.sin(t * 13)) * .07; }
    let oz = 0;
    if (lie) { const w = Math.min(1, t / .45); rx = -Math.PI / 2 * w * (2 - w); y = .2 * w; ox = Math.sin(m.ry) * .55 * w; oz = Math.cos(m.ry) * .55 * w; } // lying down with the middle of the body where they stood
    if (id === 'shiver') { ox = Math.sin(t * 58) * .022; lean = Math.sin(t * 41) * .03; }
    if (id === 'flip') { const w = Math.min(1, u); y = Math.sin(w * Math.PI) * 1.45; bend = -w * Math.PI * 2; hop = 1 - w; }
    if (id === 'robot') { const st = Math.floor(t * 2.6); turn = ((st % 4) - 1.5) * .28; y = (t * 2.6) % 1 < .18 ? .05 : 0; lean = st % 2 ? .07 : -.07; }
    if (id === 'stars') { hop = .5 + .5 * Math.sin(t * 8); y = Math.abs(Math.sin(t * 8)) * .14;
      if (m.fxN < 3 && u > (m.fxN + 1) * .26 && !m.hid) { m.fxN++; fx.burst(v3.set(m.x, 2.1, m.z), { n: few ? 8 : 16, colors: ['#ffd84a', '#fff1a8', '#ffffff', '#9fd8ff'], shape: STAR, speed: 2.4, up: 5, size: .32, grav: 5, life: 1.2 }); } }
    if (id === 'heart' && !m.fxN && u > .45 && !m.hid) { m.fxN = 1; fx.burst(v3.set(m.x + Math.sin(m.ry) * .7, 1.5, m.z + Math.cos(m.ry) * .7), { n: 7, colors: ['#ff6f91', '#ff9fb8', '#ffd0dc'], shape: HEART, speed: .9, up: 2.2, size: .36, grav: 2, life: 1.3 }); }
    // hit by a snowball: a short stagger away from where it came from
    const hw = m.hitAt !== undefined ? (T - m.hitAt) / .6 : 1;
    if (hw < 1 && !lie) { rx += -Math.sin(hw * Math.PI * 3) * (1 - hw) * .22; if (!sit) y += Math.sin(hw * Math.PI) * .08; }
    m.wrap.position.set(m.x + ox, y, m.z + oz); m.wrap.rotation.set(rx, m.ry + turn, lean);
    if (ride) { // on a carousel horse: the same numbers as the model's own turning (farm/models.js FX.carousel)
      const sc = CAROUSEL[4], a = seat.n * Math.PI / 2, ph = -T * .5 + CAROUSEL[3], lx = Math.cos(a) * .6 * sc, lz = Math.sin(a) * .6 * sc;
      m.wrap.position.set(CAROUSEL[1] + lx * Math.cos(ph) + lz * Math.sin(ph), (.75 + Math.sin(T * 2 + seat.n * 1.6) * .12) * sc - .2, CAROUSEL[2] - lx * Math.sin(ph) + lz * Math.cos(ph));
      m.wrap.rotation.set(0, ph - a, 0); }
    if (swing) { // on the swing: rocking with its seat (farm/models.js FX.swing)
      const sc = SWING[4], th = Math.sin(T * 1.7) * .22, lz = .8 * Math.sin(th) * sc * -1;
      m.wrap.position.set(SWING[1] + lz * Math.sin(SWING[3]), (1.16 - .78 * Math.cos(th)) * sc - .22, SWING[2] + lz * Math.cos(SWING[3]));
      m.wrap.rotation.set(th, SWING[3], 0); }
    m.av.position.y = sit ? .76 - .43 : .76; m.av.rotation.x = bend;
    animateAvatar(m.av, T, { seed: m.s, hop: Math.max(0, Math.min(1, hop)), active: id === 'dance' || id === 'trick' });
    const ud = m.av.userData;
    const tuck = id === 'flip' ? Math.sin(Math.min(1, u) * Math.PI) : 0, sweep = id === 'angel' ? .5 - .5 * Math.cos(t * 3.2) : 0;
    if (m.amt > .02 && !sit && !lie) { walkAvatar(m.av, m.ph, m.amt); ud.legs?.forEach(l => { l.rotation.z = 0; }); }
    else ud.legs?.forEach((l, i) => { l.rotation.x = ride ? -.3 : sit ? -1.5 : id === 'bow' ? -bend : -tuck * 1.5; l.rotation.z = ride ? (i ? 1 : -1) * .5 : (i ? 1 : -1) * sweep * .42; if (l.userData.kn) l.userData.kn.rotation.x = ride ? .5 : sit ? (seat ? 1.45 + (swing ? Math.sin(T * 1.7) * .5 : 0) : .15) : tuck * 1.7; });
    const thr = m.thr !== undefined ? (T - m.thr) / .42 : 1;
    ud.arms.forEach((a, i) => { a.userData.rz0 ??= a.rotation.z; a.rotation.z = a.userData.rz0;
      if (id === 'wave' && i === 1) { a.rotation.x = -2.75; a.rotation.z = a.userData.rz0 + .3 + Math.sin(t * 10) * .32; }
      if (id === 'dance') a.rotation.x = -2.2 + Math.sin(t * 6.5 + i * Math.PI) * .7;
      if (id === 'cheer' || id === 'stars') { a.rotation.x = -2.8 + Math.sin(t * 9 + i) * .2; a.rotation.z = a.userData.rz0 + (i ? .25 : -.25); }
      const out = i ? 1 : -1; // towards this arm's own side
      if (id === 'clap') { a.rotation.x = -1.35; a.rotation.z = a.userData.rz0 - out * (.38 + .2 * Math.sin(t * 18)); }
      if (id === 'bow') { a.rotation.x = i ? -bend * .9 : .25 * bend; a.rotation.z = a.userData.rz0 - (i ? out * bend * .55 : 0); }
      if (id === 'spin') a.rotation.z = a.userData.rz0 + out * 1.25 * Math.sin(Math.min(1, u) * Math.PI);
      if (id === 'laugh') { a.rotation.x = -.75; a.rotation.z = a.userData.rz0 - out * .5; }
      if (id === 'nap') { a.rotation.x = 0; a.rotation.z = a.userData.rz0 + out * .25; }
      if (id === 'angel') { a.rotation.x = 0; a.rotation.z = a.userData.rz0 + out * (.35 + sweep * 1.5); }
      if (id === 'heart' && i === 1) { const k = Math.min(1, u / .45), w = u < .45 ? 0 : Math.min(1, (u - .45) / .2); a.rotation.x = -2.5 * k + w * 1.0; a.rotation.z = a.userData.rz0 - out * .55 * (1 - w); }
      if (id === 'shiver') { a.rotation.x = -1.05; a.rotation.z = a.userData.rz0 - out * .75 + Math.sin(t * 50 + i) * .04; }
      if (id === 'flip') a.rotation.x = -2.6 * tuck;
      if (id === 'robot') { const st = Math.floor(t * 2.6) + i; a.rotation.x = st % 2 ? -1.55 : -.1; a.rotation.z = a.userData.rz0; }
      if (thr < 1 && i === 1) a.rotation.x = thr < .35 ? -3.1 * (thr / .35) : -3.1 + 2.6 * ((thr - .35) / .65); });
    // pets trot after their owner in a line, and join in with a trick
    for (const p of m.pets) {
      const gx = m.x - Math.sin(m.ry) * p.back + Math.cos(m.ry) * p.side, gz = m.z - Math.cos(m.ry) * p.back - Math.sin(m.ry) * p.side;
      const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
      if (d > 8) { p.x = gx; p.z = gz; }
      else if (d > .18) { const step = Math.min(d - .1, Math.max(SPEED * 1.2 * dt * Math.min(1, d), d * dt * 3)); p.x += dx / d * step; p.z += dz / d * step; p.sp += (1 - p.sp) * Math.min(1, dt * 8); p.ry += wrapA(Math.atan2(dx, dz) - p.ry) * Math.min(1, dt * 9); }
      else { p.sp += (0 - p.sp) * Math.min(1, dt * 6); if (m.amt < .05) p.ry += wrapA(m.ry - p.ry) * Math.min(1, dt * 2); }
      p.ph += dt * (6 + p.sp * 8);
      let py = Math.abs(Math.sin(p.ph)) * .16 * p.sp, spin = 0;
      if (p.pat > T) py = Math.max(py, Math.abs(Math.sin((p.pat - T) * 9)) * .3);
      if (id === 'trick') { const w = Math.min(1, u * 1.15); py = Math.sin(w * Math.PI) * .9; spin = w * Math.PI * 2; }
      else if (id === 'cheer' || id === 'dance' || id === 'stars' || id === 'clap') py = Math.abs(Math.sin(t * 7 + p.k)) * .26;
      p.g.position.set(p.x, py, p.z); p.g.rotation.y = p.ry + spin;
      wiggle(p.g, T, p.seed, id === 'cheer' || id === 'trick' ? 1 : p.sp * .6);
    }
  }
  const loop = frameLoop(dt => {
    if (!canvas.isConnected) return;
    if (rw !== W || rh !== H) { W = rw; H = rh; if (W && H) { renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); cam.tall = H > W; } }
    if (!W || !H) return;
    T = performance.now() / 1000 - T0;
    // build what is waiting: a few milliseconds a frame, you first, then whoever is nearest
    if (queue.length) { const t0 = performance.now(); if (me) queue.sort((a, b) => (a === me ? -1 : b === me ? 1 : Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z)));
      while (queue.length && performance.now() - t0 < (drawn ? 7 : 40)) { if (!build(queue[0])) queue.shift(); } }
    if (me) stepMe(dt);
    let nb = 0;
    for (const m of folk.values()) { animate(m, dt);
      if (m.wrap) m.wrap.visible = !m.hid; for (const p of m.pets) p.g.visible = !m.hid;
      if (m.hid) continue;
      if (m.wrap && nb < BLOBS && !(m.sp >= 0 && MOVING[SPOTS[m.sp]?.k])) blobs.setMatrixAt(nb++, bm.makeScale(.42, 1, .42).setPosition(m.x, .05, m.z));
      for (const p of m.pets) if (nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.3, 1, .3).setPosition(p.x, .05, p.z)); }
    for (const g of ghosts.values()) { animateAvatar(g.av, T, { seed: g.seed }); const a = g.av.userData.arms?.[1]; if (a) { a.userData.rz0 ??= a.rotation.z; a.rotation.x = -2.75; a.rotation.z = a.userData.rz0 + .3 + Math.sin(T * 6) * .3; } // waving people over
      if (nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.42, 1, .42).setPosition(g.x, .05, g.z)); }
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    // the camera follows you from the south, looking down; the tree turns see-through when you walk behind it
    if (me) { const k = Math.min(1, dt * 5); cam.x += (me.x - cam.x) * k; cam.z += (me.z - cam.z) * k; arrow.position.set(me.x, (me.wrap?.position.y || 0) + 2.25, me.z); animateArrow(arrow, T); }
    { const k = Math.min(1, dt * 14); cam.yaw += (cam.ty - cam.yaw) * k; cam.el += (cam.te - cam.el) * k; }
    const d = (cam.tall ? 54 : 37) / cam.zoom, off = cam.tall ? 4 : 2.6, sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), el = EL0 + cam.el;
    const lx = cam.x * .92 - sy * off, lz = cam.z - cy * off;
    camera.position.set(lx + sy * Math.cos(el) * d, Math.sin(el) * d, lz + cy * Math.cos(el) * d); camera.lookAt(lx, 1.6, lz);
    if (winter && me) { const dep = me.x * sy + me.z * cy, lat = me.x * cy - me.z * sy, behind = dep < -TREE_R * .5 && Math.abs(lat) < 4.4 && dep > -15.5, to = behind ? .28 : 1;
      if (Math.abs(cam.fade - to) > .005) { cam.fade += (to - cam.fade) * Math.min(1, dt * 6); if (Math.abs(cam.fade - to) < .01) cam.fade = to; const solid = cam.fade >= 1;
        for (const mt of treeMats) { if (mt.transparent === solid) { mt.transparent = !solid; mt.needsUpdate = true; } mt.opacity = cam.fade; mt.depthWrite = solid; } } }
    if (mark.visible) mark.scale.setScalar(1 + Math.sin(T * 6) * .12);
    for (const g of live) g.userData.tick(T, {}, g);
    fly?.(T); blink(T);
    if (snow) { const P = snow.geometry.attributes.position; for (let i = 0; i < P.count; i++) { let y = P.getY(i) - dt * (1.1 + (i % 5) * .22); if (y < 0) y += 20; P.setY(i, y); P.setX(i, P.getX(i) + Math.sin(T + i) * dt * .25); } P.needsUpdate = true; snow.position.set(cam.x, 0, cam.z); }
    stepBalls();
    if ((fwOn || fwRush > T) && T > fwAt) { const rush = fwRush > T; fwAt = T + (rush ? .12 + Math.random() * .2 : (.5 + Math.random() * .9) / fwOn) * (few ? 1.8 : 1); rocket(); }
    fx.update(dt, camera, H);
    if (!drawn) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    // where everyone's head is on screen, for the name tags and speech bubbles
    for (const m of folk.values()) { v3.set(m.wrap ? m.wrap.position.x : m.x, (m.wrap?.position.y || 0) + (TAG_Y[EMOTES[m.e]?.id] ?? 2.12), m.wrap ? m.wrap.position.z : m.z).project(camera); m.on = !!m.wrap && !m.hid && v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.25; m.sx = (v3.x * .5 + .5) * W; m.sy = (-v3.y * .5 + .5) * H; }
    opts.frame?.(folk, me, W, H);
    if (!drawn) { drawn = true; opts.ready?.(); }
  }, { onSlow: () => { // slow for a few seconds: outlines of the others go first, then the usual graphics steps (never the resolution);
    // other people's second and third pets are the last thing to go (Kuba: everyone's pets should show)
    if (++slowN >= 5 && petCap > 1) { petCap = 1; for (const m of folk.values()) if (m !== me) while (m.pets.length > 1) scene.remove(m.pets.pop().g); return; }
    if (!noInk) { noInk = true; for (const m of folk.values()) if (m !== me && m.av) m.av.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial && o.material.side === THREE.BackSide) o.visible = false; }); return; }
    res.lower(); } });

  return {
    setPeople, add, remove, look, moved, fix, emote, throwBall, aim, fireworks, volley, turn, resetView, turned, poke, standBy, nearThing, thingAt, setGhost, dropGhost, setTree, setOrn, setMove, walkTo, pick, setZoom, spotTaken,
    zoom: () => cam.zoom, me: () => me, folk: () => folk, theme,
    nearTree: () => !!me && Math.hypot(me.x, me.z),
    pat(s, i) { const m = folk.get(s), q = m?.pets.find(x => x.k === i); if (!q) return; q.pat = T + 1.05; fx.burst(new THREE.Vector3(q.x, .9, q.z), { n: 6, colors: ['#ff6f91', '#ff9fb8', '#ffffff'], shape: HEART, speed: 1.1, up: 2.6, size: .34, grav: 3, life: 1.1 }); },
    // a point of the island on the screen (for signposts and hints): [x, y, in view]
    project(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H, v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1]; },
    burstAt(s, colors) { const m = folk.get(s); if (m) fx.burst(new THREE.Vector3(m.x, 2, m.z), { n: 8, colors, shape: STAR, speed: 1.6, up: 2.4, size: .22 }); },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: loop.fps(), folk: folk.size, queue: queue.length }),
    hide(s, on) { const m = folk.get(s); if (m && m !== me) m.hid = !!on; },
    lost: () => renderer.getContext().isContextLost(),
    destroy() { loop.stop(); ro.disconnect(); for (const m of folk.values()) dropModel(m); folk.clear(); for (const c of [...ghosts.keys()]) dropGhost(c); fx.dispose(); ballGeo.dispose(); for (const b of balls) b.g.material.dispose();
      scene.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) if (!mt.userData?.shared) mt.dispose(); } }); renderer.dispose(); renderer.forceContextLoss(); },
  };
}

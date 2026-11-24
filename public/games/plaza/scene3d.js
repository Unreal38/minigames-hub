// The Plaza's 3D scene: one floating island (snow and a big Christmas tree in winter, a meadow with a fountain the
// rest of the year), everyone's avatars walking about with their pets behind them, emotes and the tree's ornaments.
// The page (client.js) owns the buttons, name tags and chat; this file owns everything drawn in 3D and your own
// walking, which is worked out here every frame and reported to the server a few times a second.
//
// Cost rules: all standing scenery is merged into a handful of meshes (mergeStatic), its shadows are drawn once, people
// and pets get a soft blob under them instead of real shadows, and models are built a few a frame, nearest first.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { island, skyDome, clouds, nightScene, birds, flat, put, toonify, toonMat, createFx, STAR, HEART, hash } from '../../scenery3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { itemModel } from '../farm/models.js';
import { formOf } from '../farm/data.js';
import { youArrow, animateArrow } from '../../marker3d.js';
import { frameLoop, autoResolution, AA, gfx } from '../../frames.js';
import { R_WALK, R_SQUARE, SPEED, Q, TREE_R, THINGS, WINTER, MEADOW, LAMPS, STAGE, SPOTS, EMOTES, ORNAMENTS, SLOTS, TIERS, TREE_H, slotPos, blocksOf, clampWalk } from './layout.js';

const K = .72;             // avatars are drawn at this size (see standing-avatar notes: the scale sits on a wrapper)
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
function snowPine(g, s = 1) { put(g, new THREE.CylinderGeometry(.07 * s, .1 * s, .4 * s, 6), flat('#7a5236'), 0, .2 * s); for (let i = 0; i < 3; i++) { put(g, new THREE.ConeGeometry((.5 - i * .12) * s, .55 * s, 7), flat(i % 2 ? '#3f8c5a' : '#35795a'), 0, (.6 + i * .3) * s); put(g, new THREE.ConeGeometry((.36 - i * .1) * s, .3 * s, 7), flat(SNOW), 0, (.76 + i * .3) * s); } }
function snowRock(g, s = 1) { const r = put(g, new THREE.IcosahedronGeometry(.3 * s, 0), flat('#9aa3b5'), 0, .15 * s, 0); r.scale.y = .7; const c = put(g, new THREE.IcosahedronGeometry(.24 * s, 0), flat(SNOW), 0, .3 * s, 0); c.scale.y = .4; }
function snowBush(g, s = 1) { put(g, new THREE.IcosahedronGeometry(.3 * s, 0), flat('#4a9a6a'), 0, .2 * s, 0); const c = put(g, new THREE.IcosahedronGeometry(.27 * s, 0), flat(SNOW), 0, .36 * s, 0); c.scale.y = .45; put(g, new THREE.IcosahedronGeometry(.05 * s, 0), flat('#e5543b'), .2 * s, .28 * s, .2 * s); }
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
  const isle = island(C, C, winter
    ? { round: true, props: 46, seed: 4, rim: 3.4, flowers: 0, clear: R_WALK, size: 1.7, depth: 1.1, open: .2, grass: SNOW, patch: '#e3ecfa', earth: '#b9c4dc', rock: '#8791a8', kinds: [snowPine, snowBush, snowPine, snowRock, snowPine, snowBush] }
    : { round: true, props: 46, seed: 4, rim: 3.4, flowers: 120, clear: R_WALK, size: 1.7, depth: 1.1, open: .2 });
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
    else if (LIVE.has(kind)) { g = itemModel(kind, true); g.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noInk; o.receiveShadow = false; } }); g.scale.setScalar(s); g.position.set(x, .03, z); g.rotation.y = ry; scene.add(g); if (g.userData.tick) live.push(g); continue; }
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
  let petCap = level === 'high' ? 3 : 1;
  function dropModel(m) {
    if (m.wrap) { scene.remove(m.wrap); disposeAvatar(m.av); m.wrap = m.av = null; }
    for (const p of m.pets) if (p.g) { scene.remove(p.g); p.g.traverse(o => { if (o.isMesh && !o.material.userData?.shared) o.geometry.dispose(); }); }
    m.pets = [];
  }
  function build(m) {
    if (!folk.has(m.s)) return;
    const p = m.p;
    if (!m.wrap) { m.wrap = new THREE.Group(); m.wrap.scale.setScalar(K); m.av = avatar3d(p.c, p.av, { pose: 'stand' }); m.av.position.y = .76; m.av.traverse(o => { if (o.isMesh) o.castShadow = false; }); m.wrap.add(m.av); m.wrap.position.set(m.x, 0, m.z); m.wrap.rotation.y = m.ry; scene.add(m.wrap); return true; }
    const want = (p.pets || []).slice(0, petsShown(m));
    if (m.pets.length < want.length) { const k = m.pets.length, x = want[k], f = formOf(x.lv | 0); let g; try { g = petModel(x.sp, f, x.look || null); } catch { return false; }
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
    m.e = e; m.eAt = T; m.sp = sp;
    if (sp >= 0 && SPOTS[sp]) { const q = SPOTS[sp]; m.x = m.tx = q.x; m.z = m.tz = q.z; m.ry = m.tr = q.ry; if (m === me) { goal = null; sentX = Math.round(q.x * Q); sentZ = Math.round(q.z * Q); } }
    const head = new THREE.Vector3(m.x, 1.9, m.z);
    if (e === EM.cheer) { if (m === me) fx.confetti(head, { n: 36, w: 2.4, h: 2.2, s: 'me' }); else fx.burst(head, { n: 16, colors: ['#ffd84a', '#ff9fb8', '#8a98ff', '#7ed3b2'], shape: STAR, speed: 2.6, up: 3.4, size: .3 }); }
    if (e === EM.trick) fx.burst(head.setY(.5), { n: 10, colors: ['#ff9fb8', '#ffd84a'], shape: HEART, speed: 1.6, up: 2.6, size: .3 });
    if (e === EM.jump) fx.puff(new THREE.Vector3(m.x, 0, m.z), { n: 8, color: winter ? '#ffffff' : '#fff4e2' });
  }
  const spotTaken = sp => { for (const m of folk.values()) if (m.sp === sp) return true; return false; };

  // ---- your own walking
  const blocks = blocksOf(theme);
  let inX = 0, inZ = 0, goal = null, stuck = 0, side = 0, sentX = 0, sentZ = 0, sentR = -1, sendAt = 0;
  const setMove = (x, z) => { inX = x; inZ = z; if (x || z) { goal = null; mark.visible = false; } };
  function walkTo(x, z) { [x, z] = clampWalk(x, z); goal = [x, z]; stuck = 0; side = 0; mark.position.set(x, .1, z); mark.visible = true; mark.scale.setScalar(1); }
  function stepMe(dt) {
    let vx = inX, vz = inZ;
    if (!vx && !vz && goal) { const dx = goal[0] - me.x, dz = goal[1] - me.z, d = Math.hypot(dx, dz); if (d < .12 || stuck > 1) { goal = null; mark.visible = false; } else { vx = dx / d; vz = dz / d; if (d < SPEED * dt) { vx *= d / (SPEED * dt); vz *= d / (SPEED * dt); } } }
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
  const cam = { x: 0, z: 14, zoom: 1, tall: false, fade: 1 };
  let W = 0, H = 0, rw = 0, rh = 0;
  const ro = new ResizeObserver(es => { const b = es[es.length - 1].contentRect; rw = b.width; rh = b.height; }); ro.observe(canvas);
  const setZoom = z => { cam.zoom = Math.max(.6, Math.min(1.7, z)); };
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
    if (winter) { const hits = ray.intersectObjects(Object.values(ornMeshes), false); if (hits.length && hits[0].instanceId != null) return { kind: 'orn', i: hits[0].object.userData.slots[hits[0].instanceId] }; }
    if (!ray.ray.intersectPlane(ground, hit)) return null;
    if (winter && Math.hypot(hit.x, hit.z) < TREE_R) return { kind: 'tree' };
    if (Math.hypot(hit.x, hit.z) > R_WALK + 1.5) return null;
    return { kind: 'ground', x: hit.x, z: hit.z };
  }

  // ---- every frame
  const v3 = new THREE.Vector3(), bm = new THREE.Matrix4();
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
    const sit = id === 'sit', seat = sit && m.sp >= 0 ? SPOTS[m.sp] : null;
    let y = 0, hop = 0, lean = 0;
    if (id === 'jump') { y = Math.sin(Math.min(1, u) * Math.PI) * 1.15; hop = 1 - u; }
    if (id === 'cheer') { hop = .5 + .5 * Math.sin(t * 9); y = Math.abs(Math.sin(t * 9)) * .22; }
    if (id === 'dance') { y = Math.abs(Math.sin(t * 6.5)) * .16; lean = Math.sin(t * 6.5) * .1; }
    if (sit) y = seat ? seat.y : 0;
    m.wrap.position.set(m.x, y, m.z); m.wrap.rotation.set(0, m.ry + (id === 'dance' ? Math.sin(t * 3.25) * .5 : 0), lean);
    m.av.position.y = sit ? .76 - .43 : .76;
    animateAvatar(m.av, T, { seed: m.s, hop: Math.max(0, Math.min(1, hop)), active: id === 'dance' || id === 'trick' });
    const ud = m.av.userData;
    if (m.amt > .02 && !sit) walkAvatar(m.av, m.ph, m.amt);
    else ud.legs?.forEach(l => { l.rotation.x = sit ? -1.5 : 0; if (l.userData.kn) l.userData.kn.rotation.x = sit ? (seat ? 1.45 : .15) : 0; });
    ud.arms.forEach((a, i) => { a.userData.rz0 ??= a.rotation.z; a.rotation.z = a.userData.rz0;
      if (id === 'wave' && i === 1) { a.rotation.x = -2.75; a.rotation.z = a.userData.rz0 + .3 + Math.sin(t * 10) * .32; }
      if (id === 'dance') a.rotation.x = -2.2 + Math.sin(t * 6.5 + i * Math.PI) * .7;
      if (id === 'cheer') { a.rotation.x = -2.8 + Math.sin(t * 9 + i) * .2; a.rotation.z = a.userData.rz0 + (i ? .25 : -.25); } });
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
      else if (id === 'cheer' || id === 'dance') py = Math.abs(Math.sin(t * 7 + p.k)) * .26;
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
      if (m.wrap && nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.42, 1, .42).setPosition(m.x, .05, m.z));
      for (const p of m.pets) if (nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.3, 1, .3).setPosition(p.x, .05, p.z)); }
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    // the camera follows you from the south, looking down; the tree turns see-through when you walk behind it
    if (me) { const k = Math.min(1, dt * 5); cam.x += (me.x - cam.x) * k; cam.z += (me.z - cam.z) * k; arrow.position.set(me.x, (me.wrap?.position.y || 0) + 2.25, me.z); animateArrow(arrow, T); }
    const d = (cam.tall ? 54 : 37) / cam.zoom, lz = cam.z - (cam.tall ? 4 : 2.6);
    camera.position.set(cam.x * .92, d * .6, lz + d * .8); camera.lookAt(cam.x * .92, 1.6, lz);
    if (winter && me) { const behind = me.z < -TREE_R * .5 && Math.abs(me.x - cam.x * .08) < 4.4 && me.z > -15.5, to = behind ? .28 : 1;
      if (Math.abs(cam.fade - to) > .005) { cam.fade += (to - cam.fade) * Math.min(1, dt * 6); if (Math.abs(cam.fade - to) < .01) cam.fade = to; const solid = cam.fade >= 1;
        for (const mt of treeMats) { if (mt.transparent === solid) { mt.transparent = !solid; mt.needsUpdate = true; } mt.opacity = cam.fade; mt.depthWrite = solid; } } }
    if (mark.visible) mark.scale.setScalar(1 + Math.sin(T * 6) * .12);
    for (const g of live) g.userData.tick(T, {}, g);
    fly?.(T); blink(T);
    if (snow) { const P = snow.geometry.attributes.position; for (let i = 0; i < P.count; i++) { let y = P.getY(i) - dt * (1.1 + (i % 5) * .22); if (y < 0) y += 20; P.setY(i, y); P.setX(i, P.getX(i) + Math.sin(T + i) * dt * .25); } P.needsUpdate = true; snow.position.set(cam.x, 0, cam.z); }
    fx.update(dt, camera, H);
    if (!drawn) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    // where everyone's head is on screen, for the name tags and speech bubbles
    for (const m of folk.values()) { v3.set(m.x, (m.wrap?.position.y || 0) + (EMOTES[m.e]?.id === 'sit' ? 1.36 : 1.72), m.z).project(camera); m.on = !!m.wrap && !m.hid && v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.25; m.sx = (v3.x * .5 + .5) * W; m.sy = (-v3.y * .5 + .5) * H; }
    opts.frame?.(folk, me, W, H);
    if (!drawn) { drawn = true; opts.ready?.(); }
  }, { onSlow: () => { // slow for a few seconds: other people's pets go first (yours stay), then the usual graphics steps
    if (++slowN === 1 && petCap > 1) { petCap = 1; for (const m of folk.values()) if (m !== me) while (m.pets.length > 1) scene.remove(m.pets.pop().g); return; }
    if (slowN === 2 && petCap > 0) { petCap = 0; for (const m of folk.values()) if (m !== me) while (m.pets.length) scene.remove(m.pets.pop().g); return; }
    res.lower(); } });

  return {
    setPeople, add, remove, look, moved, fix, emote, setTree, setOrn, setMove, walkTo, pick, setZoom, spotTaken,
    zoom: () => cam.zoom, me: () => me, folk: () => folk, theme,
    nearTree: () => !!me && Math.hypot(me.x, me.z),
    pat(s, i) { const m = folk.get(s), q = m?.pets.find(x => x.k === i); if (!q) return; q.pat = T + 1.05; fx.burst(new THREE.Vector3(q.x, .9, q.z), { n: 6, colors: ['#ff6f91', '#ff9fb8', '#ffffff'], shape: HEART, speed: 1.1, up: 2.6, size: .34, grav: 3, life: 1.1 }); },
    // a point of the island on the screen (for signposts and hints): [x, y, in view]
    project(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H, v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1]; },
    burstAt(s, colors) { const m = folk.get(s); if (m) fx.burst(new THREE.Vector3(m.x, 2, m.z), { n: 8, colors, shape: STAR, speed: 1.6, up: 2.4, size: .22 }); },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: loop.fps(), folk: folk.size, queue: queue.length }),
    hide(s, on) { const m = folk.get(s); if (m && m !== me) m.hid = !!on; },
    lost: () => renderer.getContext().isContextLost(),
    destroy() { loop.stop(); ro.disconnect(); for (const m of folk.values()) dropModel(m); folk.clear(); fx.dispose();
      scene.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) if (!mt.userData?.shared) mt.dispose(); } }); renderer.dispose(); },
  };
}

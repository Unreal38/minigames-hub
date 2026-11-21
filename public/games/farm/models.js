// Pet Farm models: blocky low-poly buildings, decorations and pets, all built in code from a few shapes.
//   itemModel(type) -> THREE.Group sitting on y = 0, centred on its footprint, front facing +Z. One tile = 1 unit.
//   Pets live in pets3d.js.
// Every surface is flat shaded. Static models are merged into a few meshes with bake().
import * as THREE from 'three';
import { bake } from '../../avatar3d.js';

const mats = new Map();
export const M = (c, o) => {
  if (o) return new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true, ...o });
  let m = mats.get(c);
  if (!m) mats.set(c, m = new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true }));
  return m;
};
// A special material (glowing, see-through) kept under its own name so it is made once.
export const MX = (key, c, o) => { let m = mats.get(key); if (!m) mats.set(key, m = new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true, ...o })); return m; };
const geos = new Map();
export const G = (type, ...a) => {
  const k = type + a.join();
  let g = geos.get(k);
  if (!g) geos.set(k, g = new THREE[type + 'Geometry'](...a));
  return g;
};
// A roof shaped like a tent: w wide (x), h tall, d long (z), sitting on y = 0.
const gable = (w, h, d) => {
  const k = 'gable' + [w, h, d];
  if (!geos.has(k)) {
    const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); geos.set(k, g);
  }
  return geos.get(k);
};
const put = (p, g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o; };
const box = (p, w, h, d, c, x = 0, y = 0, z = 0) => put(p, G('Box', w, h, d), M(c), x, y + h / 2, z);
const cyl = (p, rt, rb, h, seg, c, x = 0, y = 0, z = 0) => put(p, G('Cylinder', rt, rb, h, seg), M(c), x, y + h / 2, z);
const cone = (p, r, h, seg, c, x = 0, y = 0, z = 0) => put(p, G('Cone', r, h, seg), M(c), x, y + h / 2, z);
// Small parts the buildings share: a lit lantern, a barrel, a crate, shingle stripes down a tent roof, a leafy vine.
const LIT = () => MX('lit', '#ffe27a', { emissive: '#ffb547', emissiveIntensity: .7 });
const lantern = (p, x, y, z, s = 1) => { box(p, .1 * s, .03 * s, .1 * s, '#5b4636', x, y + .13 * s, z); put(p, G('Box', .08 * s, .12 * s, .08 * s), LIT(), x, y + .07 * s, z).userData.dyn = true; box(p, .1 * s, .02 * s, .1 * s, '#5b4636', x, y, z); };
const barrel = (p, x, z, s = 1) => { cyl(p, .15 * s, .15 * s, .34 * s, 8, '#b07a4f', x, 0, z); cyl(p, .17 * s, .17 * s, .05 * s, 8, '#b07a4f', x, .145 * s, z).scale.y = 2.6; for (const y of [.06, .26]) cyl(p, .158 * s, .158 * s, .03 * s, 8, '#6f7f8f', x, y * s, z); };
const crate = (p, x, z, s = .3, y = 0, r = 0) => { const o = box(p, s, s, s, '#c99763', x, y, z); o.rotation.y = r; const t = box(p, s * 1.06, s * .16, s * 1.06, '#8a5a3c', x, y + s * .42, z); t.rotation.y = r; return o; };
const shingles = (p, w, h, d, y, z, c, rows = 3) => { const ang = Math.atan2(h, w / 2), len = Math.hypot(h, w / 2); for (const sd of [-1, 1]) for (let i = 0; i < rows; i++) { const t = (i + .5) / rows, o = put(p, G('Box', len / rows * .42, .035, d * 1.005), M(c), sd * w / 2 * (1 - t) + sd * Math.sin(ang) * .012, y + t * h + Math.cos(ang) * .012, z); o.rotation.z = -sd * ang; } };
const vine = (p, x, y, z, n, dx, dy, dz = 0) => { for (let i = 0; i < n; i++) ico(p, .07 + (i % 2) * .025, i % 2 ? '#86cc5a' : '#5fb04a', x + dx * i + (i % 2) * .03, y + dy * i, z + dz * i); };
const ico = (p, r, c, x = 0, y = 0, z = 0, d = 0) => put(p, G('Icosahedron', r, d), M(c), x, y, z);

// ---------- the toon look ----------
// Everything is drawn with flat cartoon shading in three steps and a dark outline around each model.
const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const _hsl = {}, _tc = new THREE.Color();
const tint = c => { c.getHSL(_hsl); return c.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.12 + (_hsl.s > .04 ? .04 : 0)), Math.min(.97, _hsl.l * 1.05 + .03)); }; // a brighter, more saturated palette
// The toon material that stands in for a plain one. Kept, so equal surfaces share one.
export function toonMat(old) {
  const key = 'toon' + [old.color.getHexString(), +!!old.vertexColors, +!!old.transparent, old.opacity, old.emissive?.getHexString(), old.emissiveIntensity, old.side, +old.depthWrite].join();
  let m = mats.get(key);
  if (!m) mats.set(key, m = new THREE.MeshToonMaterial({ color: old.vertexColors ? '#ffffff' : tint(old.color.clone()), vertexColors: !!old.vertexColors, transparent: old.transparent, opacity: old.opacity, depthWrite: old.depthWrite,
    emissive: old.emissive?.clone() || new THREE.Color(0), emissiveIntensity: old.emissiveIntensity ?? 1, side: old.side, gradientMap: RAMP }));
  return m;
}
const inkMat = t => { const key = 'ink' + t; let m = mats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: '#5a3a2e', side: THREE.BackSide }); m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${t.toFixed(4)};`); }; m.customProgramCacheKey = () => key; mats.set(key, m); }
  return m; };
// One hull around a whole model: every solid part merged, corners welded so the line has no gaps, drawn inside out.
const _iv = new THREE.Matrix4(), _im = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function inkHull(root, t) {
  root.updateWorldMatrix(true, true); _iv.copy(root.matrixWorld).invert();
  const parts = []; let n = 0;
  root.traverse(m => { if (!m.isMesh || m.isInstancedMesh || m.material.transparent || m.material.emissiveIntensity > 0 && m.material.emissive?.getHex() || m.userData.noInk) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(_im.multiplyMatrices(_iv, m.matrixWorld)); parts.push(g.attributes.position.array); n += g.attributes.position.count; g.dispose(); });
  if (!n) return null;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), sum = new Map(); let o = 0; for (const p of parts) { pos.set(p, o); o += p.length; }
  const keyOf = i => Math.round(pos[i * 3] * 400) + ',' + Math.round(pos[i * 3 + 1] * 400) + ',' + Math.round(pos[i * 3 + 2] * 400), keys = new Array(n);
  for (let i = 0; i < n; i += 3) {
    _a.fromArray(pos, i * 3); _b.fromArray(pos, i * 3 + 3).sub(_a); _c.fromArray(pos, i * 3 + 6).sub(_a); _b.cross(_c).normalize();
    for (let k = 0; k < 3; k++) { const key = keys[i + k] = keyOf(i + k); let v = sum.get(key); if (!v) sum.set(key, v = [0, 0, 0]); v[0] += _b.x; v[1] += _b.y; v[2] += _b.z; }
  }
  for (let i = 0; i < n; i++) { const v = sum.get(keys[i]), l = Math.hypot(v[0], v[1], v[2]) || 1; nor[i * 3] = v[0] / l; nor[i * 3 + 1] = v[1] / l; nor[i * 3 + 2] = v[2] / l; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const hull = new THREE.Mesh(g, inkMat(t)); hull.userData = { baked: true, ink: true, toon: true }; hull.castShadow = hull.receiveShadow = false;
  return hull;
}
// Gives a whole model the toon look. ink: how thick the outline is in the model's own units (0 for none).
export function toonify(root, ink = 0) {
  root.traverse(m => {
    if (!m.isMesh || m.userData.toon || !m.material.isMeshStandardMaterial) return;
    const old = m.material, C = old.vertexColors && m.userData.baked && m.geometry.attributes.color;
    if (C) { for (let i = 0; i < C.count; i++) { tint(_tc.setRGB(C.getX(i), C.getY(i), C.getZ(i))); C.setXYZ(i, _tc.r, _tc.g, _tc.b); } C.needsUpdate = true; }
    m.material = toonMat(old); m.userData.toon = true;
    if (!mats.has('keep' + old.uuid) && ![...mats.values()].includes(old)) old.dispose();
  });
  if (ink) { const h = inkHull(root, ink); if (h) root.add(h); }
  return root;
}

// Merges a finished model into a few meshes. raw: leave it plain (for the map, which merges whole islands again).
export function finish(g, raw = false) {
  bake(g);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return raw ? g : toonify(g, .028);
}

const C = { wood: '#b07a4f', woodD: '#8a5a3c', cream: '#f4e3c1', red: '#d9584e', redD: '#b8433c', stone: '#a9a6b0', stoneD: '#8a8794',
  leaf: '#5fb04a', leafD: '#4a9a45', leafL: '#86cc5a', straw: '#e8c860', glass: '#bfe6fb', soil: '#8a5a3c', sand: '#e8cf9a',
  teal: '#5aa9a0', iron: '#5b4636', white: '#ffffff', yellow: '#ffc94d', pink: '#ff9fb8', lilac: '#c8a2f2', water: '#6fb7e8', slate: '#6f7f8f' };

const BUILD = {
  house(g) {
    box(g, 2.42, .16, 2.02, C.stoneD, 0, 0, -.1);                // stone footing
    box(g, 2.3, 1.25, 1.9, C.cream, 0, 0, -.1);
    for (const x of [-1.13, 1.13]) for (const z of [.83, -1.03]) box(g, .12, 1.25, .12, C.woodD, x, 0, z); // timber frame
    box(g, 2.36, .09, 1.96, C.woodD, 0, 1.16, -.1);
    for (const x of [-.38, .38]) box(g, .07, 1.0, .05, C.woodD, x, .16, .86);
    put(g, gable(2.7, 1.0, 2.3), M(C.red), 0, 1.25, -.1); shingles(g, 2.7, 1.0, 2.3, 1.25, -.1, C.redD);
    box(g, .12, .1, 2.42, C.redD, 0, 2.2, -.1);                  // ridge
    for (const sd of [-1, 1]) box(g, .14, .08, 2.4, C.white, sd * 1.34, 1.22, -.1); // eaves
    put(g, gable(2.0, .74, .04), M(C.cream), 0, 1.3, 1.06);      // the gable wall, with a round attic window
    const w = put(g, G('Cylinder', .17, .17, .06, 10), M(C.glass), 0, 1.58, 1.08); w.rotation.x = Math.PI / 2;
    const wr = put(g, G('Torus', .18, .035, 4, 10), M(C.woodD), 0, 1.58, 1.1); box(g, .04, .34, .03, C.woodD, 0, 1.41, 1.1); box(g, .34, .04, .03, C.woodD, 0, 1.56, 1.1);
    box(g, .34, .8, .34, C.stone, .7, 1.4, -.5); box(g, .44, .1, .44, C.stoneD, .7, 2.2, -.5); box(g, .2, .1, .2, C.iron, .7, 2.3, -.5); // chimney
    box(g, .66, .9, .06, C.white, 0, 0, .85); box(g, .5, .78, .1, C.woodD, 0, 0, .87); ico(g, .05, C.yellow, .15, .4, .94);
    box(g, .22, .2, .03, C.glass, 0, .5, .93);                   // door pane
    const hood = put(g, gable(.9, .22, .4), M(C.redD), 0, .92, 1.02); for (const x of [-.4, .4]) box(g, .05, .1, .3, C.woodD, x, .84, 1.0);
    lantern(g, .46, .58, .9);
    for (const sd of [-1, 1]) {
      box(g, .5, .5, .05, C.white, sd * .72, .46, .85); box(g, .42, .42, .08, C.glass, sd * .72, .5, .86);
      box(g, .03, .42, .03, C.white, sd * .72, .5, .9); box(g, .42, .03, .03, C.white, sd * .72, .7, .9);
      for (const k of [-1, 1]) box(g, .1, .46, .05, C.teal, sd * .72 + k * .29, .48, .88); // shutters
      box(g, .6, .16, .2, C.woodD, sd * .72, .28, .98);          // flower boxes
      [[-.18, C.pink], [0, C.yellow], [.18, C.lilac]].forEach(([x, c], i) => { ico(g, .09, sd > 0 ? [C.yellow, C.pink, C.white][i] : c, sd * .72 + x, .52, 1.0); ico(g, .05, C.leaf, sd * .72 + x + .08, .46, 1.04); });
    }
    box(g, .9, .1, .4, C.stone, 0, 0, 1.1); box(g, .5, .025, .26, C.red, 0, .1, 1.12); box(g, .4, .03, .16, C.cream, 0, .1, 1.12); // doorstep and mat
    barrel(g, 1.02, .98, .8); vine(g, -1.16, .2, .9, 6, .0, .19, -.02); vine(g, -1.0, 1.05, .9, 3, .14, .02);
  },
  hut(g) {
    cyl(g, .86, .9, .1, 6, C.stoneD);
    cyl(g, .78, .84, .75, 6, '#e9c99a', 0, .04);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; box(g, .08, .76, .08, C.woodD, Math.sin(a) * .8, .04, Math.cos(a) * .8); }
    cone(g, 1.14, .3, 6, C.leafD, 0, .72); cone(g, 1.04, .85, 6, C.leaf, 0, .78); cone(g, .6, .5, 6, C.leafL, 0, 1.2);
    ico(g, .16, C.leafL, 0, 1.72, 0); cone(g, .05, .2, 4, C.leafD, .06, 1.8, 0).rotation.z = -.5;
    const d = put(g, G('Cylinder', .3, .3, .1, 10), M(C.iron), 0, .36, .74); d.rotation.x = Math.PI / 2; d.scale.z = 1.25; // a round doorway
    const r = put(g, G('Torus', .31, .05, 4, 10), M(C.woodD), 0, .36, .78); r.scale.y = 1.25;
    box(g, .34, .2, .05, C.cream, 0, .86, .8);                   // a paw-print plate
    ico(g, .045, C.woodD, 0, .93, .83); for (const x of [-.07, 0, .07]) ico(g, .024, C.woodD, x, 1.0 + (x ? 0 : .02), .83);
    for (const sd of [-1, 1]) { const w = put(g, G('Cylinder', .12, .12, .06, 8), M(C.glass), sd * .62, .5, .42); w.rotation.set(Math.PI / 2, 0, -sd * Math.PI / 3); }
    cyl(g, .13, .1, .08, 8, C.red, .56, 0, .86); cyl(g, .1, .1, .09, 8, C.wood, .56, 0, .86); // food bowl
    box(g, .44, .02, .22, C.pink, 0, 0, .98);
    for (const [x, z, h] of [[-.72, .6, .14], [-.82, .46, .1]]) { cyl(g, .025, .03, h, 5, C.cream, x, 0, z); cone(g, .07, .07, 6, C.red, x, h, z); }
  },
  gate(g) {
    for (const s of [-1, 1]) {
      box(g, .5, .12, .5, C.stoneD, s * .72); box(g, .36, 1.5, .36, C.stone, s * .72); box(g, .46, .14, .46, C.stoneD, s * .72, 1.5);
      for (const [y, z] of [[.4, .185], [.95, .185], [.7, -.185]]) box(g, .2, .1, .02, C.stoneD, s * .72 + (y > .6 ? .05 : -.06), y, z); // odd bricks
    }
    lantern(g, -.72, 1.64, 0, 1.5);
    box(g, 1.9, .24, .3, C.wood, 0, 1.3); box(g, 2.0, .06, .36, C.woodD, 0, 1.54);
    const c = put(g, G('Cylinder', .2, .2, .06, 10), M(C.cream), 0, 1.42, .17); c.rotation.x = Math.PI / 2; // a compass over the way out
    const n = put(g, G('Octahedron', .06, 0), M(C.red), 0, 1.42, .21); n.scale.set(.5, 2.6, .3); n.rotation.z = -.6; put(g, G('Torus', .2, .03, 4, 10), M(C.yellow), 0, 1.42, .2);
    [C.pink, C.yellow, C.teal, C.lilac, C.yellow, C.pink].forEach((col, i) => { const t = cone(g, .07, .16, 3, col, -.5 + i * .2, 1.14, .1); t.rotation.x = Math.PI; }); // bunting
    box(g, .5, .5, .05, C.red, 0, .78, .02); box(g, .06, .5, .06, C.woodD, -.32, .8, .02);
    box(g, .08, .8, .08, C.woodD, .75, 0, .7); box(g, .46, .2, .06, C.cream, .9, .56, .7); box(g, .4, .16, .06, C.cream, .62, .32, .7).rotation.y = .5; // signpost
    vine(g, -.92, .1, .12, 6, 0, .2, 0); vine(g, -.6, 1.2, .2, 3, .0, -.16);
    crate(g, -.72, .62, .3); crate(g, -.44, .7, .22, 0, .5);     // packed for the road
    const roll = cyl(g, .05, .05, .34, 6, C.cream, -.72, .3, .62); roll.rotation.z = Math.PI / 2; roll.position.y = .36;
    box(g, .24, .28, .16, C.teal, .3, 0, .78); box(g, .26, .08, .18, C.woodD, .3, .24, .78); cyl(g, .05, .05, .2, 6, C.cream, .3, .32, .78).rotation.z = Math.PI / 2; // backpack with a bedroll
  },
  garden(g, live) {
    box(g, .92, .14, .92, C.woodD); box(g, .78, .18, .78, C.soil);
    if (!live) PARTS.garden(g);
  },
  kitchen(g) {
    box(g, 1.8, .14, 1.5, C.stoneD, 0, 0, -.15);
    box(g, 1.7, 1.0, 1.4, '#f7d9a8', 0, 0, -.15);
    for (const x of [-.83, .83]) box(g, .1, 1.0, .1, C.woodD, x, 0, .53);
    box(g, 1.86, .12, 1.56, C.woodD, 0, 1.0, -.15); box(g, 1.6, .1, 1.3, C.wood, 0, 1.12, -.15);
    for (let i = 0; i < 5; i++) { const o = box(g, .36, .06, .6, i % 2 ? C.white : C.red, -.72 + i * .36, .86, .78); o.rotation.x = .35; box(g, .36, .1, .03, i % 2 ? C.white : C.red, -.72 + i * .36, .7, 1.06); } // awning with a valance
    for (const x of [-.88, .88]) box(g, .05, .78, .05, C.woodD, x, 0, 1.02);
    box(g, 1.5, .5, .3, C.wood, 0, 0, .72); box(g, 1.58, .05, .38, C.cream, 0, .5, .72); // counter with a pale top
    for (const x of [-.5, 0, .5]) box(g, .03, .46, .02, C.woodD, x, 0, .875);
    cyl(g, .16, .13, .16, 6, C.stoneD, -.4, .55, .72); cyl(g, .17, .17, .03, 6, C.iron, -.4, .71, .72); ico(g, .03, C.iron, -.4, .76, .72); // the pot, lid on
    box(g, .3, .03, .2, C.woodD, .4, .55, .72); ico(g, .09, C.red, .35, .64, .72); ico(g, .08, C.yellow, .5, .63, .76); box(g, .16, .06, .1, '#e8b877', .02, .55, .74); // board, fruit, a loaf
    box(g, .3, .6, .3, C.stone, .5, 1.1, -.5); box(g, .38, .08, .38, C.stoneD, .5, 1.7, -.5);
    for (const [w, d, x, z] of [[1.9, .06, 0, .63], [1.9, .06, 0, -.93], [.06, 1.56, .93, -.15], [.06, 1.56, -.93, -.15]]) box(g, w, .16, d, C.cream, x, .98, z); // a pale rim round the roof
    box(g, .7, .14, .26, C.woodD, -.3, 1.22, -.62); for (let i = 0; i < 4; i++) ico(g, .09, i % 2 ? C.leafL : C.leaf, -.56 + i * .17, 1.4, -.62); ico(g, .04, C.red, -.3, 1.47, -.58); // herbs growing up top
    const pot = new THREE.Group(); pot.position.set(-.45, 1.22, .1); g.add(pot);   // the big pot on the roof says what this is
    cyl(pot, .26, .2, .26, 8, C.slate); cyl(pot, .29, .29, .05, 8, C.stoneD, 0, .24); ico(pot, .06, C.red, 0, .34, 0);
    for (const x of [-.31, .31]) box(pot, .08, .05, .1, C.iron, x, .16);
    box(g, .5, .04, .1, C.wood, 0, .78, .56); for (const [x, c] of [[-.16, C.red], [0, C.yellow], [.16, C.leafL]]) cyl(g, .05, .05, .12, 6, c, x, .82, .56); // jars on a shelf
    const board = box(g, .3, .42, .03, C.iron, -.78, 0, 1.0); board.rotation.x = -.25; box(g, .22, .03, .01, C.white, -.78, .28, 1.06).rotation.x = -.25; box(g, .16, .03, .01, C.white, -.78, .2, 1.08).rotation.x = -.25; // menu board
    crate(g, .76, .98, .24); for (const [x, z] of [[.7, .94], [.82, 1.0], [.76, 1.04]]) ico(g, .06, C.red, x, .27, z);
  },
  barn(g) {
    box(g, 1.8, .12, 2.7, C.stoneD);
    box(g, 1.7, 1.2, 2.6, '#c8553d');
    for (const x of [-.84, .84]) for (const z of [-1.29, 1.29]) box(g, .1, 1.2, .1, C.white, x, 0, z); // white trim
    for (const z of [-.43, .43]) for (const sd of [-1, 1]) box(g, .03, 1.2, .06, '#a8433c', sd * .86, 0, z); // board seams
    put(g, gable(1.96, .8, 2.8), M('#7a4a3a'), 0, 1.2, 0); shingles(g, 1.96, .8, 2.8, 1.2, 0, '#5f3a2e');
    for (const sd of [-1, 1]) box(g, .1, .07, 2.86, C.white, sd * .98, 1.18, 0);
    box(g, .1, .08, 2.9, '#5f3a2e', 0, 1.97, 0);
    put(g, gable(1.5, .6, .04), M('#c8553d'), 0, 1.22, 1.41);
    box(g, .92, .98, .05, C.white, 0, 0, 1.3); box(g, .8, .9, .08, '#a8433c', 0, 0, 1.31);
    const a = box(g, 1.1, .08, .04, C.white, 0, .41, 1.36); a.rotation.z = .84; const b = box(g, 1.1, .08, .04, C.white, 0, .41, 1.36); b.rotation.z = -.84;
    box(g, .42, .42, .04, C.white, 0, 1.34, 1.42); box(g, .34, .34, .06, C.glass, 0, 1.38, 1.43); box(g, .03, .34, .03, C.white, 0, 1.38, 1.46);
    box(g, .08, .08, .5, C.woodD, 0, 1.82, 1.6); box(g, .02, .26, .02, C.cream, 0, 1.56, 1.8); box(g, .1, .08, .1, C.iron, 0, 1.5, 1.8); // hoist over the loft
    for (const sd of [-1, 1]) { box(g, .04, .36, .36, C.white, sd * .86, .5, 0); box(g, .05, .28, .28, C.glass, sd * .87, .54, 0); }
    cyl(g, .025, .025, .5, 5, C.iron, 0, 1.98, -.9); const v = box(g, .4, .05, .03, C.iron, 0, 2.36, -.9); v.rotation.y = .6; cone(g, .07, .14, 4, C.iron, .16, 2.31, -1.01).rotation.set(0, .6, -Math.PI / 2); ico(g, .06, C.yellow, 0, 2.5, -.9); // weathervane
    box(g, .5, .4, .5, C.straw, 1.0, 0, 1.0); box(g, .52, .04, .52, '#d4b24f', 1.0, .13, 1.0); box(g, .52, .04, .52, '#d4b24f', 1.0, .27, 1.0); // hay bale with its ties
    box(g, .4, .3, .4, '#f0d67a', 1.02, .4, 1.02).rotation.y = .4;
    barrel(g, -1.0, 1.05, .9); crate(g, -1.02, .62, .3, 0, .2);
    const fork = box(g, .04, 1.0, .04, C.woodD, -.6, 0, 1.4); fork.rotation.z = .18; for (const x of [-.06, 0, .06]) box(g, .02, .2, .02, C.iron, -.76 + x, .94, 1.4).rotation.z = .18;
  },
  nest(g) {
    const t = put(g, G('Torus', .62, .22, 5, 8), M(C.woodD), 0, .2, 0); t.rotation.x = Math.PI / 2;
    const t2 = put(g, G('Torus', .6, .1, 4, 8), M(C.wood), 0, .36, 0); t2.rotation.set(Math.PI / 2, 0, .4); // a second woven ring
    cyl(g, .56, .5, .2, 8, C.straw, 0, .06); cyl(g, .4, .4, .03, 8, '#f6dd8a', 0, .25);
    box(g, .46, .03, .36, C.pink, -.1, .27, .06).rotation.y = .3; box(g, .4, .035, .08, C.white, -.1, .275, .06).rotation.y = .3; // a little blanket
    for (let i = 0; i < 7; i++) { const a = i * .9 + .2, o = box(g, .5, .06, .08, i % 2 ? C.wood : C.woodD, Math.cos(a) * .74, .26 + (i % 3) * .05, Math.sin(a) * .74); o.rotation.set(0, -a + 1.3 + (i % 2) * .5, (i % 2 ? .2 : -.15)); } // twigs poking out
    for (const [x, z, r] of [[.5, -.52, .6], [-.62, -.4, -.5], [.66, .3, 1.4]]) { const f = cone(g, .06, .3, 4, C.white, x, .42, z); f.scale.z = .35; f.rotation.set(.5, r, .5); } // feathers
    cone(g, .1, .22, 4, C.leafL, -.72, 0, -.6); cone(g, .1, .22, 4, C.leaf, .76, 0, -.5); cone(g, .09, .2, 4, C.leafL, .8, 0, .62);
    for (const [x, z, c] of [[-.86, .5, C.pink], [-.76, .68, C.white], [.5, .86, C.yellow], [-.3, -.9, C.lilac]]) { cyl(g, .015, .015, .14, 4, C.leafD, x, 0, z); put(g, G('Octahedron', .06, 0), M(c), x, .17, z).scale.y = .6; }
    box(g, .05, .5, .05, C.woodD, .84, 0, -.84); const h = put(g, G('Octahedron', .12, 0), M('#ff6f91'), .84, .58, -.84); h.scale.set(1.2, 1, .45); h.rotation.y = -.7; // a heart on a stake
  },
  yard(g, live) {
    box(g, 2.8, .06, 1.8, C.sand);
    for (const x of [-1.34, 1.34]) for (const z of [-.84, .84]) box(g, .12, .4, .12, C.woodD, x, 0, z);
    if (!live) PARTS.yard(g);
    for (const z of [-.3, .3]) box(g, .1, .42, .1, C.white, .7, 0, z);
    box(g, .08, .08, .76, C.red, .7, .36);                       // hurdle
    ico(g, .16, C.stone, .1, .14, .6);
    for (const z of [-.84, .84]) for (const y of [.2, .34]) box(g, 2.68, .03, .03, C.cream, 0, y, z); // rope rails, open at the ends
    for (const x of [-.45, .45]) for (const z of [-.84, .84]) box(g, .1, .38, .1, C.woodD, x, 0, z);
    box(g, .04, .01, 1.5, C.white, -.2, .06, 0); box(g, 1.2, .01, .04, C.white, .4, .06, -.6); // chalk lines
    box(g, .06, .5, .06, C.woodD, 1.15, 0, -.55); const tg = put(g, G('Cylinder', .22, .22, .05, 10), M(C.white), 1.15, .62, -.52); tg.rotation.x = Math.PI / 2 - .2; const tg2 = put(g, G('Cylinder', .13, .13, .06, 10), M(C.red), 1.15, .62, -.515); tg2.rotation.x = Math.PI / 2 - .2; const tg3 = put(g, G('Cylinder', .05, .05, .07, 8), M(C.white), 1.15, .62, -.51); tg3.rotation.x = Math.PI / 2 - .2; // target
    cyl(g, .1, .08, .16, 8, C.teal, 1.2, .06, .6); cyl(g, .085, .085, .02, 8, C.water, 1.2, .21, .6); // water bucket
    const bar = cyl(g, .025, .025, .4, 6, C.iron, -.2, .06, .68); bar.rotation.z = Math.PI / 2; bar.position.y = .15; for (const x of [-.4, 0]) { const wt = put(g, G('Cylinder', .09, .09, .07, 8), M(C.slate), x, .15, .68); wt.rotation.z = Math.PI / 2; } // a weight to lift
  },
  flag(g, live) {
    cyl(g, .26, .32, .2, 5, C.stone);
    cyl(g, .045, .045, 1.9, 5, C.woodD, 0, .2);
    if (!live) PARTS.flag(g);
    ico(g, .08, C.yellow, 0, 2.14, 0);
  },
  mailbox(g, live) {
    cyl(g, .16, .2, .06, 6, C.stoneD); box(g, .1, .7, .1, C.woodD); box(g, .22, .05, .22, C.wood, 0, .66);
    box(g, .34, .28, .5, C.red, 0, .7); box(g, .36, .06, .52, C.redD, 0, .98); box(g, .28, .2, .02, C.redD, 0, .74, .26);
    box(g, .18, .03, .03, C.iron, 0, .86, .27);                  // letter slot
    box(g, .16, .1, .02, C.white, .02, .98, .1).rotation.z = .2; // a letter poking out
    if (!live) PARTS.mailbox(g);
    cone(g, .09, .2, 4, C.leaf, .3, 0, .2); cone(g, .07, .16, 4, C.leafL, -.28, 0, .1);
    cyl(g, .015, .015, .16, 4, C.leafD, -.26, 0, -.2); put(g, G('Octahedron', .06, 0), M(C.yellow), -.26, .19, -.2).scale.y = .6;
  },
  workshop(g) {
    box(g, 1.8, .12, 1.6, C.stoneD, 0, 0, -.1);
    box(g, 1.7, 1.0, 1.5, '#b9a089', 0, 0, -.1);
    for (const x of [-.83, .83]) box(g, .1, 1.05, .1, C.woodD, x, 0, .63);
    for (const y of [.3, .62]) box(g, 1.6, .03, .02, '#a38b74', 0, y, .655); // plank lines
    const r = box(g, 1.94, .12, 1.84, C.slate, 0, 1.2, -.1); r.rotation.x = .22; const r2 = box(g, 1.98, .06, .14, '#566472', 0, 1.02, .8); r2.rotation.x = .22;
    for (const x of [-.6, 0, .6]) { const o = box(g, .04, .05, 1.84, '#566472', x, 1.29, -.1); o.rotation.x = .22; }
    cyl(g, .1, .1, .7, 6, C.iron, -.55, 1.2, -.5); cyl(g, .14, .14, .06, 6, C.iron, -.55, 1.9, -.5); // stove pipe
    box(g, .58, .78, .05, C.woodD, -.4, 0, .655); box(g, .5, .7, .08, '#9a6a44', -.4, 0, .66); box(g, .5, .05, .09, C.iron, -.4, .2, .665); box(g, .5, .05, .09, C.iron, -.4, .5, .665); ico(g, .04, C.yellow, -.22, .36, .72);
    box(g, .48, .44, .05, C.woodD, .45, .38, .655); box(g, .4, .36, .08, C.glass, .45, .42, .66); box(g, .03, .36, .03, C.woodD, .45, .42, .7);
    const gear = new THREE.Group(); gear.position.set(.38, 1.56, .1); gear.scale.setScalar(1.5); gear.rotation.y = .25; g.add(gear); box(g, .12, .2, .1, C.iron, .38, 1.2, .1); // a big gear on the roof says what this is
    const hub = put(gear, G('Cylinder', .17, .17, .06, 8), M(C.yellow)); hub.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, o = put(gear, G('Box', .07, .08, .06), M(C.yellow), Math.cos(a) * .2, Math.sin(a) * .2, 0); o.rotation.z = a + Math.PI / 2; }
    const hole = put(gear, G('Cylinder', .06, .06, .07, 6), M(C.iron)); hole.rotation.x = Math.PI / 2;
    box(g, .7, .3, .36, C.wood, .5, 0, .98); box(g, .76, .04, .4, C.woodD, .5, .28, .98); box(g, .3, .12, .2, C.stoneD, .5, .3, .98); box(g, .16, .06, .14, C.stoneD, .5, .25, .98); // bench and anvil
    box(g, .04, .34, .03, C.woodD, .8, .5, .665); box(g, .14, .1, .05, C.iron, .8, .82, .67);     // tools hung on the wall
    box(g, .03, .3, .03, C.woodD, .12, .5, .665); box(g, .2, .12, .02, C.stone, .12, .76, .67);
    for (const [x, y] of [[-.9, 0], [-.76, 0], [-.83, .1]]) { const l = cyl(g, .06, .06, .5, 6, C.wood, x, y, .9); l.rotation.x = Math.PI / 2; l.position.y = y + .06; put(g, G('Cylinder', .045, .045, .51, 6), M(C.cream), x, y + .06, .9).rotation.x = Math.PI / 2; } // log pile
    const wh = put(g, G('Cylinder', .16, .16, .07, 10), M(C.stone), .9, .22, .2); wh.rotation.z = Math.PI / 2; box(g, .06, .22, .3, C.woodD, .9, 0, .2); // grindstone
  },
  fence(g) {
    for (const x of [-.4, .4]) { box(g, .12, .5, .12, C.wood, x); cone(g, .09, .1, 4, C.wood, x, .5); box(g, .14, .04, .14, C.woodD, x, .44); }
    box(g, .96, .08, .06, C.cream, 0, .34); box(g, .96, .08, .06, C.cream, 0, .14);
    for (const x of [-.2, 0, .2]) { box(g, .08, .42, .04, C.cream, x, .04, .03); cone(g, .056, .07, 4, C.cream, x, .46, .03).rotation.y = Math.PI / 4; }
  },
  path(g) {
    for (const [x, z, r] of [[-.2, -.18, .3], [.24, -.22, .22], [-.24, .24, .22], [.2, .2, .3], [0, 0, .16]]) cyl(g, r, r * 1.05, .05, 6, C.stone, x, 0, z).rotation.y = x * 5;
  },
  tree(g) {
    cyl(g, .12, .18, .7, 5, C.wood);
    ico(g, .52, C.leaf, 0, 1.05, 0).rotation.set(.4, .3, 0); ico(g, .34, C.leafL, .26, .82, .16); ico(g, .3, C.leafD, -.24, .8, -.1);
  },
  pine(g) {
    cyl(g, .1, .14, .4, 5, C.wood);
    cone(g, .48, .6, 6, C.leafD, 0, .3); cone(g, .38, .55, 6, '#3f8f4f', 0, .68); cone(g, .26, .5, 6, C.leafD, 0, 1.04);
  },
  bush(g) { ico(g, .34, C.leaf, 0, .28, 0); ico(g, .24, C.leafL, .22, .22, .14); ico(g, .2, C.leafD, -.24, .18, .1); ico(g, .05, C.red, .1, .5, .2); },
  flowers(g) {
    for (const [x, z, c] of [[-.24, -.16, C.pink], [.2, -.22, C.yellow], [0, .08, C.lilac], [-.2, .28, C.yellow], [.26, .24, C.pink]]) {
      cyl(g, .02, .02, .24, 4, C.leafD, x, 0, z); put(g, G('Octahedron', .1, 0), M(c), x, .3, z).scale.y = .7; cone(g, .06, .12, 4, C.leaf, x + .08, 0, z);
    }
  },
  lamp(g) {
    cyl(g, .14, .18, .1, 6, C.stoneD); cyl(g, .08, .1, .1, 6, C.iron, 0, .1); cyl(g, .04, .045, 1.0, 5, C.iron, 0, .1); cyl(g, .07, .07, .05, 6, C.iron, 0, .6);
    box(g, .3, .04, .3, C.iron, 0, 1.08);
    put(g, G('Box', .22, .28, .22), M('#ffe27a', { emissive: '#ffb547', emissiveIntensity: .7 }), 0, 1.24, 0).userData.dyn = true;
    for (const x of [-.11, .11]) for (const z of [-.11, .11]) box(g, .025, .28, .025, C.iron, x, 1.1, z);
    cone(g, .26, .16, 4, C.iron, 0, 1.38).rotation.y = Math.PI / 4; ico(g, .035, C.iron, 0, 1.57, 0);
  },
  pond(g) {
    cyl(g, .9, .94, .06, 8, C.stone); cyl(g, .78, .78, .08, 8, C.water);
    cyl(g, .16, .16, .1, 6, C.leafL, .25, 0, .2); put(g, G('Octahedron', .07, 0), M(C.pink), .25, .15, .2);
    ico(g, .16, C.stoneD, -.8, .08, .3); ico(g, .12, C.stone, .6, .08, -.7);
    for (const [x, z] of [[-.6, -.6], [-.72, -.48]]) cone(g, .05, .5, 4, C.leafD, x, 0, z);
  },
  bench(g) {
    for (const z of [-.1, 0, .1]) box(g, .84, .05, .09, C.wood, 0, .28, z);
    for (const y of [.42, .56]) box(g, .84, .1, .05, C.wood, 0, y, -.17);
    for (const x of [-.34, .34]) { box(g, .08, .28, .3, C.woodD, x); box(g, .07, .7, .06, C.woodD, x, 0, -.18); box(g, .08, .05, .3, C.woodD, x, .42, -.02); }
    box(g, .22, .03, .2, C.pink, -.2, .33, 0);                   // a cushion
  },
  rock(g) {
    const r = put(g, G('Dodecahedron', .34, 0), M(C.stone), 0, .2, 0); r.scale.set(1.2, .8, 1);
    ico(g, .16, C.stoneD, .3, .1, .22); put(g, G('Box', .3, .06, .26), M(C.leaf), -.05, .46, 0).rotation.y = .5;
  },
  fountain(g, live) {
    cyl(g, .92, .96, .3, 8, C.stone); cyl(g, .8, .8, .34, 8, C.water);
    cyl(g, .16, .22, .8, 6, C.stoneD, 0, .3); cyl(g, .46, .3, .12, 8, C.stone, 0, 1.0); cyl(g, .38, .38, .14, 8, C.water, 0, 1.02);
    if (!live) PARTS.fountain(g);
  },
  windmill(g, live) {
    cyl(g, .44, .46, .14, 6, C.stoneD); cyl(g, .26, .4, 1.5, 6, C.cream);
    cyl(g, .37, .39, .08, 6, C.woodD, 0, .5); cyl(g, .31, .33, .06, 6, C.woodD, 0, 1.05); // hoops
    cyl(g, .4, .36, .06, 6, C.wood, 0, 1.46); cone(g, .36, .42, 6, C.red, 0, 1.5); ico(g, .05, C.yellow, 0, 1.95, 0);
    box(g, .26, .4, .04, C.white, 0, .1, .385); box(g, .2, .34, .06, C.woodD, 0, .1, .39); ico(g, .025, C.yellow, .06, .26, .43);
    box(g, .22, .22, .04, C.white, 0, .77, .325); box(g, .16, .16, .06, C.glass, 0, .8, .33);
    for (const sd of [-1, 1]) box(g, .05, .18, .04, C.teal, sd * .13, .79, .335);
    box(g, .2, .14, .16, C.cream, .36, 0, .3).rotation.y = .4; box(g, .2, .12, .16, C.cream, .34, .14, .26).rotation.y = -.2; // flour sacks
    if (!live) PARTS.windmill(g);
  },
  arch(g) {
    for (const x of [-.4, .4]) box(g, .1, 1.1, .1, C.wood, x); box(g, .96, .1, .12, C.wood, 0, 1.1);
    for (const [x, y, c] of [[-.4, .5, C.pink], [-.4, .9, C.leafL], [-.2, 1.2, C.yellow], [0, 1.24, C.pink], [.2, 1.2, C.lilac], [.4, .9, C.leafL], [.4, .5, C.yellow], [-.4, .2, C.leaf], [.4, .2, C.leaf]]) ico(g, .11, c, x, y, 0);
  },
  statue(g) {
    box(g, .7, .2, .7, C.stoneD); box(g, .54, .3, .54, C.stone, 0, .2);
    ico(g, .26, C.cream, 0, .76, 0, 1); ico(g, .2, C.cream, 0, 1.1, .04, 1);
    for (const x of [-.12, .12]) cone(g, .07, .2, 4, C.cream, x, 1.22);
    put(g, G('Octahedron', .07, 0), MX('glow', '#8fe3f5', { emissive: '#8fe3f5', emissiveIntensity: .8 }), 0, .42, .29);
  },
  glow(g, live) {
    cyl(g, .12, .16, .1, 6, C.stoneD); cyl(g, .03, .03, .5, 5, C.stoneD, 0, .1);
    if (!live) PARTS.glow(g);
  },
  tower(g) {
    cyl(g, .4, .44, .1, 6, C.woodD); cyl(g, .09, .09, 1.3, 6, C.straw, 0, .1);
    cyl(g, .32, .32, .08, 6, C.lilac, .12, .6); cyl(g, .28, .28, .08, 6, C.pink, -.08, 1.36);
    box(g, .3, .22, .3, C.wood, .2, .1, .2); ico(g, .07, C.yellow, -.3, .9, .1);
  },
  cherry(g) {
    cyl(g, .07, .1, .5, 5, C.woodD); ico(g, .32, C.pink, 0, .78, 0); ico(g, .22, '#ffc2d4', .2, .62, .12); ico(g, .2, '#ffc2d4', -.2, .66, -.1);
  },
  well(g) {
    cyl(g, .42, .44, .08, 8, C.stoneD); cyl(g, .38, .4, .4, 8, C.stone); cyl(g, .41, .41, .06, 8, C.stoneD, 0, .36); cyl(g, .3, .3, .42, 8, C.water);
    for (let i = 0; i < 5; i++) { const a = i * 1.3; box(g, .14, .08, .02, C.stoneD, Math.sin(a) * .39, .1 + (i % 2) * .14, Math.cos(a) * .39).rotation.y = a; }
    for (const x of [-.34, .34]) box(g, .07, .7, .07, C.woodD, x, .4); put(g, gable(.96, .3, .7), M(C.red), 0, 1.1, 0); shingles(g, .96, .3, .7, 1.1, 0, C.redD, 2);
    const ax = cyl(g, .03, .03, .64, 6, C.wood, 0, .9); ax.rotation.z = Math.PI / 2; ax.position.y = .93; box(g, .04, .14, .04, C.iron, .4, .86); box(g, .1, .04, .04, C.iron, .44, .84);
    box(g, .015, .26, .015, C.cream, 0, .66); cyl(g, .07, .055, .12, 6, C.wood, 0, .54); cyl(g, .075, .075, .02, 6, C.iron, 0, .62); // bucket on its rope
    ico(g, .07, C.leaf, -.36, .12, .2); ico(g, .05, C.leafL, -.3, .08, .3); ico(g, .03, C.yellow, .2, .44, .1);
  },
  scarecrow(g) {
    box(g, .06, .9, .06, C.woodD); box(g, .6, .06, .06, C.woodD, 0, .58); box(g, .3, .34, .14, '#5b8fd6', 0, .36);
    ico(g, .15, C.straw, 0, .82, 0); cone(g, .2, .2, 6, C.woodD, 0, .92); cyl(g, .26, .26, .03, 8, C.woodD, 0, .92);
  },
  campfire(g, live) {
    for (let i = 0; i < 6; i++) ico(g, .07, C.stoneD, Math.cos(i * 1.05) * .22, .05, Math.sin(i * 1.05) * .22);
    for (const r of [0, 1.05, 2.1]) { const l = box(g, .34, .07, .07, C.woodD, 0, .05); l.rotation.y = r; }
    if (!live) PARTS.campfire(g);
  },
  shrooms(g) {
    for (let i = 0; i < 5; i++) { const x = Math.cos(i * 1.26) * .16, z = Math.sin(i * 1.26) * .16, h = .1 + (i % 2) * .06; cyl(g, .025, .03, h, 5, C.cream, x, 0, z); cone(g, .07, .07, 6, i % 2 ? C.red : C.redD, x, h, z); }
  },
  picnic(g) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) box(g, .22, .02, .22, (i + j) % 2 ? C.red : C.white, -.33 + i * .22, 0, -.33 + j * .22);
    box(g, .26, .16, .2, C.wood, .15, .02, .1); box(g, .28, .03, .06, C.woodD, .15, .2, .1); ico(g, .06, C.red, -.2, .08, -.1); ico(g, .06, C.yellow, -.1, .08, .2); cyl(g, .1, .1, .02, 8, C.white, -.22, .02, .18);
  },
  birdbath(g) {
    cyl(g, .12, .16, .08, 6, C.stoneD); cyl(g, .05, .06, .4, 6, C.stone, 0, .08); cyl(g, .22, .1, .1, 8, C.stone, 0, .48); cyl(g, .17, .17, .02, 8, C.water, 0, .57);
    ico(g, .06, '#5b8fd6', .14, .66, 0); cone(g, .02, .05, 4, C.yellow, .2, .64, 0).rotation.z = -1.57;
  },
  haybale(g) { box(g, .36, .22, .26, C.straw, -.05, 0, .05); box(g, .36, .22, .26, C.straw, .08, 0, -.16).rotation.y = .5; box(g, .3, .2, .24, '#f0d67a', 0, .22, -.04).rotation.y = .2; },
  gazebo(g) {
    cyl(g, .95, .95, .12, 8, C.cream);
    for (let i = 0; i < 6; i++) cyl(g, .05, .05, 1.2, 5, C.white, Math.cos(i * 1.047) * .8, .12, Math.sin(i * 1.047) * .8);
    cone(g, 1.1, .6, 6, '#6fb7a8', 0, 1.32); ico(g, .09, C.yellow, 0, 1.98, 0); box(g, .5, .22, .3, C.wood, 0, .12);
  },
  swing(g, live) {
    for (const x of [-.4, .4]) { const a = box(g, .06, 1.2, .06, C.wood, x, 0, .18); a.rotation.x = -.16; const b = box(g, .06, 1.2, .06, C.wood, x, 0, -.18); b.rotation.x = .16; }
    box(g, .9, .06, .06, C.woodD, 0, 1.16); if (!live) PARTS.swing(g);
  },
  lighthouse(g) {
    cyl(g, .4, .44, .14, 8, C.stoneD); cyl(g, .24, .34, .5, 8, C.white, 0, .14); cyl(g, .2, .24, .4, 8, C.red, 0, .64); cyl(g, .17, .2, .4, 8, C.white, 0, 1.04);
    cyl(g, .26, .26, .05, 8, C.stoneD, 0, 1.44); put(g, G('Cylinder', .13, .13, .22, 6), MX('lamp', '#ffe9a0', { emissive: '#ffd95a', emissiveIntensity: 1 }), 0, 1.6, 0); cone(g, .2, .2, 8, C.red, 0, 1.71);
  },
  hotspring(g, live) {
    cyl(g, .9, .95, .1, 8, C.stoneD); cyl(g, .72, .72, .13, 8, '#8fd9e0');
    for (let i = 0; i < 7; i++) ico(g, .16 + (i % 3) * .05, i % 2 ? C.stone : C.stoneD, Math.cos(i * .9) * .82, .14, Math.sin(i * .9) * .82);
    if (!live) PARTS.hotspring(g);
  },
  rainbow(g) {
    ['#e8615a', '#ffb547', '#ffe066', '#7fd08a', '#6fb7e8', '#b79cf0'].forEach((c, i) => { const t = put(g, G('Torus', .86 - i * .08, .045, 4, 12, Math.PI), M(c)); t.position.y = .02; });
    for (const x of [-.8, .8]) { ico(g, .2, C.white, x, .14, 0); ico(g, .15, C.white, x + .12, .12, .14); }
  },
  treehouse(g) {
    cyl(g, .2, .28, 1.3, 6, C.woodD); box(g, 1.2, .08, 1.2, C.wood, 0, 1.1); box(g, .8, .6, .8, '#f4e3c1', 0, 1.18); put(g, gable(1.0, .4, 1.0), M(C.red), 0, 1.78, 0);
    box(g, .2, .3, .04, C.woodD, 0, 1.18, .41); ico(g, .5, C.leaf, -.6, 1.7, -.4); ico(g, .45, C.leafD, .6, 1.9, -.3); ico(g, .4, C.leafL, 0, 2.3, -.2);
    for (let i = 0; i < 5; i++) box(g, .3, .04, .05, C.wood, 0, .15 + i * .2, .62); for (const x of [-.14, .14]) box(g, .04, 1.1, .04, C.woodD, x, 0, .62);
  },
  palbench(g) {
    box(g, .9, .08, .4, C.pink, 0, .3); box(g, .9, .4, .07, C.pink, 0, .38, -.17);
    for (const x of [-.38, .38]) box(g, .08, .3, .36, C.woodD, x);
    put(g, G('Octahedron', .1, 0), M(C.red), 0, .95, -.17).scale.set(1.2, 1, .5);
  },
  palflag(g) {
    for (const x of [-.2, .2]) cyl(g, .025, .025, .9, 5, C.woodD, x);
    [C.pink, C.yellow, C.lilac, C.leafL].forEach((c, i) => { const t = cone(g, .07, .14, 3, c, -.15 + i * .1, .66); t.rotation.x = Math.PI; });
    box(g, .42, .02, .02, C.cream, 0, .86);
  },
  ball(g) { ico(g, .22, C.red, 0, .22, 0, 1); put(g, G('Cylinder', .224, .224, .07, 10), M(C.white), 0, .22, 0); },
};

// The parts that move. A picture of a model has them baked in; on the farm (live) they stay loose and FX moves them.
// Each returns what it made so FX can get at it.
const PARTS = {
  mailbox(g) { const f = new THREE.Group(); f.position.set(.2, .76, .1); g.add(f); box(f, .04, .22, .12, C.white, 0, 0, 0); box(f, .05, .1, .14, C.yellow, 0, .14, 0); return f; },
  garden(g) { return [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, .18, z); g.add(p); cone(p, .09, .22, 4, C.leaf); p.userData.berry = ico(p, .05, C.red, .07, .12, .04); return p; }); },
  yard(g) { const d = new THREE.Group(); d.position.set(-.8, 0, -.2); g.add(d); box(d, .12, .9, .12, C.wood); box(d, .7, .12, .12, C.wood, 0, .55); box(d, .34, .34, .34, C.straw, 0, .86); return d; },
  flag(g) { const f = new THREE.Group(); f.position.set(0, 1.6, 0); g.add(f); box(f, .62, .4, .04, C.red, .33, 0); box(f, .2, .14, .05, C.yellow, .3, .13); return f; },
  fountain(g) {
    const out = [put(g, G('Octahedron', .12, 0), MX('fount', C.white, { transparent: true, opacity: .8 }), 0, 1.32, 0)];
    for (const a of [0, 2.1, 4.2]) out.push(put(g, G('Octahedron', .06, 0), M(C.white), Math.cos(a) * .5, .5, Math.sin(a) * .5));
    return out;
  },
  windmill(g) {
    const hub = new THREE.Group(); hub.position.set(0, 1.4, .36); hub.rotation.z = .5; g.add(hub);
    for (let i = 0; i < 4; i++) { const b = put(hub, G('Box', .16, .7, .03), M(C.white), 0, .4, 0); const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm); arm.add(b); }
    put(hub, G('Box', .12, .12, .08), M(C.woodD)); return hub;
  },
  glow(g) { const o = put(g, G('Octahedron', .17, 0), MX('glow', '#8fe3f5', { emissive: '#8fe3f5', emissiveIntensity: .8 }), 0, .78, 0); o.scale.set(1, 1.4, 1); return o; },
  campfire(g) { return [put(g, G('Cone', .13, .34, 5), MX('fire', '#ff9a3c', { emissive: '#ff7a1a', emissiveIntensity: .9 }), 0, .26, 0), put(g, G('Cone', .07, .2, 5), MX('fire2', '#ffd95a', { emissive: '#ffc94d', emissiveIntensity: 1 }), .04, .2, .03)]; },
  swing(g) { const s = new THREE.Group(); s.position.set(0, 1.16, 0); g.add(s); for (const x of [-.18, .18]) box(s, .02, .8, .02, C.cream, x, -.8); box(s, .46, .05, .2, C.pink, 0, -.82); return s; },
  hotspring(g) { return [[-.2, .5, 0], [.2, .8, .15], [0, 1.1, -.2]].map(([x, y, z]) => put(g, G('Icosahedron', .14, 0), MX('steam', C.white, { transparent: true, opacity: .55 }), x, y, z)); },
};

// Puffs that rise from a point and fade by shrinking. Returns move(T, speed, on).
function puffs(g, x, y, z, n = 4, size = .11, key = 'smoke', c = C.white) {
  const list = []; for (let i = 0; i < n; i++) { const m = put(g, G('Icosahedron', size, 0), MX(key, c, { transparent: true, opacity: .75 }), x, y, z); m.visible = false; list.push(m); }
  return (T, speed, on, rise = .9) => list.forEach((m, i) => {
    const u = (T * speed + i / n) % 1; m.visible = !!on; if (!on) return;
    m.position.set(x + Math.sin(u * 5 + i * 2) * .1, y + u * rise, z + Math.cos(u * 4 + i) * .06); m.scale.setScalar(Math.sin(Math.PI * u) * (.6 + u));
  });
}
const HEART = () => MX('heart', '#ff6f91', { emissive: '#ff6f91', emissiveIntensity: .4 });
const SPARK = () => MX('spark', '#ffe066', { emissive: '#ffc94d', emissiveIntensity: 1 });
// What each building does while it works. Each gets a loose group and returns tick(T, st, root):
//   st.on: it is busy, st.n: how far along (0 to 1), st.burst: seconds left of a short flurry after an action.
const FX = {
  house(g) { const smoke = puffs(g, .7, 2.25, -.5, 4, .12); return T => smoke(T, .22, true); },
  kitchen(g) { const smoke = puffs(g, .5, 1.75, -.5, 5, .12), steam = puffs(g, -.4, .7, .72, 3, .07); return (T, st) => { smoke(T, st.burst ? .7 : .2, true, st.burst ? 1.3 : .9); steam(T, .8, st.burst > 0, .5); }; },
  workshop(g) {
    const h = new THREE.Group(); h.position.set(.24, .5, .98); g.add(h); box(h, .05, .3, .05, C.woodD, 0, 0, 0); box(h, .16, .1, .1, C.stoneD, 0, .26, 0); h.rotation.z = -1.2;
    const sp = []; for (let i = 0; i < 5; i++) { const m = put(g, G('Octahedron', .04, 0), SPARK(), .5, .45, .98); m.visible = false; sp.push(m); }
    return (T, st) => {
      const on = st.burst > 0; h.rotation.z = -1.2;
      if (on) h.rotation.z = -.2 - Math.abs(Math.cos(T * 9)) * 1.0;
      sp.forEach((m, i) => { const v = (T * 3 + i * .2) % 1, a = i * 1.3 + Math.floor(T * 3) * 2; m.visible = on; m.position.set(.5 + Math.cos(a) * v * .35, .45 + v * .5 - v * v * .45, .98 + Math.sin(a) * v * .35); m.scale.setScalar(1 - v); });
    };
  },
  mailbox(g) {
    const flag = PARTS.mailbox(g); let up = 0;
    return (T, st, root) => {
      up += ((st.on ? 1 : 0) - up) * .12; flag.rotation.x = (1 - up) * Math.PI / 2;
      const u = (T % 2.6) / .5; root.rotation.z = st.on && u < 1 ? Math.sin(u * Math.PI * 4) * .09 * (1 - u) : 0; // a rattle every few seconds
      root.position.y = st.on && u < 1 ? Math.sin(u * Math.PI) * .07 : 0;
    };
  },
  garden(g) {
    const plants = PARTS.garden(g);
    return (T, st) => plants.forEach((p, i) => {
      const n = st.n ?? 1, ripe = n >= 1; p.scale.setScalar(.3 + .7 * Math.min(1, n)); p.rotation.z = Math.sin(T * 1.6 + i * 1.7) * .06;
      const b = p.userData.berry; b.visible = n > .7; b.scale.setScalar(ripe ? 1.25 + Math.sin(T * 5 + i) * .25 : .6);
    });
  },
  yard(g) {
    const d = PARTS.yard(g), dust = puffs(g, -.5, .05, -.1, 3, .09, 'dust', C.sand);
    return (T, st) => { d.rotation.z = st.on ? Math.sin(T * 7) * .16 * (Math.sin(T * 1.3) > -.3 ? 1 : 0) : 0; d.rotation.y = st.on ? Math.sin(T * 2.1) * .5 : 0; dust(T, .9, st.on, .35); };
  },
  nest(g) {
    const hearts = []; for (let i = 0; i < 3; i++) { const m = put(g, G('Octahedron', .09, 0), HEART(), 0, .6, 0); m.visible = false; hearts.push(m); }
    return (T, st) => hearts.forEach((m, i) => { const u = (T * .45 + i / 3) % 1; m.visible = !!st.on; m.position.set(Math.sin(i * 2.2 + u * 3) * .3, .5 + u * 1.1, Math.cos(i * 2.2) * .25); m.scale.set(1.2, 1, .5).multiplyScalar(Math.sin(Math.PI * u)); m.rotation.y = T * 2; });
  },
  gate(g) { // the pennant waves while a party is away
    const f = new THREE.Group(); f.position.set(.72, 1.64, 0); g.add(f); box(f, .04, .5, .04, C.woodD, 0, 0, 0); const c = new THREE.Group(); c.position.y = .4; f.add(c); box(c, .34, .2, .03, C.yellow, .17, -.1, 0);
    return (T, st) => { c.rotation.y = Math.sin(T * (st.on ? 6 : 1.5)) * (st.on ? .5 : .15); };
  },
  barn(g) { const hay = puffs(g, 1.0, .45, 1.0, 3, .05, 'chaff', C.straw); return (T, st) => hay(T, .5, st.on, .5); },
  flag(g) { const f = PARTS.flag(g); return T => { f.rotation.y = Math.sin(T * 2.2) * .28 + Math.sin(T * 5.1) * .06; }; },
  fountain(g) { const d = PARTS.fountain(g); return T => d.forEach((m, i) => { if (!i) { m.position.y = 1.32 + Math.sin(T * 5) * .06; m.rotation.y = T * 2; return; } const u = (T * .9 + i / 3) % 1, a = i * 2.1 + T * .3; m.position.set(Math.cos(a) * (.1 + u * .5), 1.1 + u * .5 - u * u * 1.2, Math.sin(a) * (.1 + u * .5)); }); },
  windmill(g) { const hub = PARTS.windmill(g); return T => { hub.rotation.z = T * 1.1; }; },
  glow(g) { const o = PARTS.glow(g); return T => { o.position.y = .78 + Math.sin(T * 1.8) * .05; o.rotation.y = T * .9; }; },
  campfire(g) { const [a, b] = PARTS.campfire(g), smoke = puffs(g, 0, .5, 0, 3, .06); return T => { a.scale.set(1 + Math.sin(T * 11) * .12, 1 + Math.sin(T * 13 + 1) * .2, 1 + Math.cos(T * 9) * .12); b.scale.y = 1 + Math.sin(T * 17) * .3; b.rotation.y = T * 3; smoke(T, .35, true, .8); }; },
  swing(g) { const s = PARTS.swing(g); return T => { s.rotation.x = Math.sin(T * 1.7) * .22; }; },
  hotspring(g) { const st = PARTS.hotspring(g); return T => st.forEach((m, i) => { const u = (T * .22 + i / 3) % 1; m.position.y = .3 + u * 1.1; m.position.x = Math.sin(u * 4 + i * 2) * .25; m.scale.setScalar(Math.sin(Math.PI * u) * 1.1); }); },
  lighthouse(g) { const b = new THREE.Group(); b.position.y = 1.6; g.add(b); put(b, G('Box', .08, .08, 1.5), MX('beam', '#fff3b8', { transparent: true, opacity: .4, emissive: '#ffe9a0', emissiveIntensity: 1 }), 0, 0, .8); return T => { b.rotation.y = T * 1.2; }; },
  statue(g) { const o = put(g, G('Octahedron', .05, 0), SPARK(), 0, 1.5, 0); return T => { o.position.y = 1.5 + Math.sin(T * 2) * .05; o.rotation.y = T * 2; o.scale.setScalar(.7 + Math.sin(T * 3) * .3); }; },
};

// A sign that floats over a building that wants attention: an envelope for mail, a "!" for anything else.
export function signModel(kind) {
  const g = new THREE.Group();
  if (kind === 'mail') { box(g, .56, .38, .06, C.white, 0, -.19, 0); box(g, .6, .04, .07, C.stoneD, 0, .17, 0); box(g, .6, .04, .07, C.stoneD, 0, -.21, 0);
    for (const d of [-1, 1]) { const v = box(g, .34, .04, .07, C.red, d * .135, .06, .01); v.rotation.z = -d * .6; }
    put(g, G('Cylinder', .12, .12, .06, 8), MX('dot', '#ff5a5f', { emissive: '#ff5a5f', emissiveIntensity: .6 }), .28, .2, 0).rotation.x = Math.PI / 2; }
  else { put(g, G('Cylinder', .22, .22, .08, 8), MX('sign', C.yellow, { emissive: '#ffb547', emissiveIntensity: .5 }), 0, 0, 0).rotation.x = Math.PI / 2; box(g, .07, .2, .1, C.woodD, 0, -.02, 0); box(g, .07, .07, .1, C.woodD, 0, -.14, 0); }
  toonify(g, .03); g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  const o = new THREE.Group(); g.scale.setScalar(1.35); o.add(g);
  return o;
}

// live: for the farm itself, where the moving parts stay loose. g.userData.tick(T, st, g) moves them.
export function itemModel(type, live = false, raw = false) {
  const g = new THREE.Group();
  (BUILD[type] || BUILD.rock)(g, live);
  finish(g, raw);
  if (live && FX[type]) { const fx = new THREE.Group(); g.add(fx); g.userData.tick = FX[type](fx); toonify(fx); fx.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } }); }
  return g;
}

// The expedition balloon. Its basket floor is at y = 0.
export function balloonModel() {
  const g = new THREE.Group();
  box(g, .5, .32, .5, C.wood, 0, 0, 0); box(g, .56, .06, .56, C.woodD, 0, .3, 0);
  for (const [x, z] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]]) box(g, .03, .75, .03, C.woodD, x, .3, z);
  cyl(g, .42, .24, .4, 6, C.yellow, 0, .95, 0);
  const env = ico(g, 1, C.red, 0, 2.15, 0, 1); env.scale.set(1, 1.12, 1);
  put(g, G('Cylinder', 1.0, 1.0, .3, 10), M(C.cream), 0, 2.2, 0);
  put(g, G('Cone', .3, .3, 6), M(C.yellow), 0, 3.35, 0);
  finish(g); g.traverse(m => { if (m.isMesh) m.receiveShadow = false; });
  return g;
}

// Frees what a model owns. Shared geometries and the cached plain materials stay.
export function disposeModel(g) {
  const shared = new Set(mats.values());
  g.traverse(m => {
    if (!m.isMesh) return;
    if (m.userData.baked) m.geometry.dispose();
    if (!shared.has(m.material)) m.material.dispose();
  });
}

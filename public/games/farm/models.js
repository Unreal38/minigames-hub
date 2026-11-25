// Pet Farm models: blocky low-poly buildings, decorations and pets, all built in code from a few shapes.
//   itemModel(type) -> THREE.Group sitting on y = 0, centred on its footprint, front facing +Z. One tile = 1 unit.
//   Pets live in pets3d.js.
// Every surface is flat shaded. Static models are merged into a few meshes with bake().
import * as THREE from 'three';
import { bake, hullGeo, hullMat } from '../../avatar3d.js';

const mats = new Map();
export const M = (c, o) => {
  if (c === '#bfe6fb' && !o) return MX('glass', c, { roughness: .4 }); // window glass bakes into a mesh of its own, so it can light up at night
  if (o) return new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true, ...o });
  let m = mats.get(c);
  if (!m) mats.set(c, m = new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true }));
  return m;
};
// A special material (glowing, see-through) kept under its own name so it is made once.
export const MX = (key, c, o) => { let m = mats.get(key); if (!m) mats.set(key, m = new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true, ...o })); return m; };
const GOLDM = () => MX('luckgold', '#ffd24a', { emissive: '#c98f1c', emissiveIntensity: .35, roughness: .5 });
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
// A wall piece under a roof that slopes front to back: w wide (x), from zf at the front to zb at the back, hf tall at the front and hb at the back.
const wedgeGeo = (w, zf, zb, hf, hb) => {
  const k = 'wedge' + [w, zf, zb, hf, hb];
  if (!geos.has(k)) {
    const s = new THREE.Shape([new THREE.Vector2(-zf, 0), new THREE.Vector2(-zf, hf), new THREE.Vector2(-zb, hb), new THREE.Vector2(-zb, 0)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); geos.set(k, g);
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
const shingles = (p, w, h, d, y, z, c, rows = 3) => { const ang = Math.atan2(h, w / 2), len = Math.hypot(h, w / 2); for (const sd of [-1, 1]) for (let i = 0; i < rows; i++) { const t = (i + .5) / rows, o = put(p, G('Box', len / rows * .42, .035, d * 1.015), M(c), sd * w / 2 * (1 - t) + sd * Math.sin(ang) * .012, y + t * h + Math.cos(ang) * .012, z); o.rotation.z = -sd * ang; } };
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
// One hull around a whole model: every solid part merged, corners welded so the line has no gaps, drawn inside out.
// Small parts get a thinner line in their own dark shade (hullGeo / inkLook in avatar3d.js).
function inkHull(root, t) {
  const meshes = [];
  root.traverse(m => { if (!m.isMesh || m.isInstancedMesh || m.material.transparent || m.material.emissiveIntensity > 0 && m.material.emissive?.getHex() || m.userData.noInk) return; meshes.push(m); });
  const g = hullGeo(root, meshes, t, '#5a3a2e'); if (!g) return null;
  const hull = new THREE.Mesh(g, hullMat(t)); hull.userData = { baked: true, ink: true, toon: true }; hull.castShadow = hull.receiveShadow = false;
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
// Every window in the game shares this: the scene turns its glow up after dark.
export const WINDOW = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: RAMP, emissive: new THREE.Color('#e88a14'), emissiveIntensity: 0 });
mats.set('window', WINDOW); // shared, so never disposed with a model
export function finish(g, raw = false) {
  bake(g);
  const panes = []; g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.userData.baked && Math.abs(m.material.roughness - .4) < .01) panes.push(m); } });
  if (raw) return g;
  toonify(g, .028); for (const m of panes) m.material = WINDOW;
  return g;
}

const C = { wood: '#b07a4f', woodD: '#8a5a3c', cream: '#f4e3c1', red: '#d9584e', redD: '#b8433c', stone: '#a9a6b0', stoneD: '#8a8794',
  leaf: '#5fb04a', leafD: '#4a9a45', leafL: '#86cc5a', straw: '#e8c860', glass: '#bfe6fb', soil: '#8a5a3c', sand: '#e8cf9a',
  teal: '#5aa9a0', iron: '#5b4636', white: '#ffffff', yellow: '#ffc94d', pink: '#ff9fb8', lilac: '#c8a2f2', water: '#6fb7e8', slate: '#6f7f8f',
  gold: '#f2b92e', goldD: '#c98f1c', plum: '#7b62c9', plumD: '#5f4aa6', patina: '#5fb3a1', patinaD: '#448f80', brass: '#d9a441', copper: '#b9683c', brick: '#b9583f', brickD: '#96432f', blue: '#4f7fc4', blueD: '#3b62a0' };
// Parts the upgraded buildings share. Level 2 adds to a building, level 3 makes it grand: taller, gold trim, finer roofs.
const grp = (p, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); p.add(o); return o; };
const pennant = (p, x, y, z, c, h = .5, s = 1) => { box(p, .04, h, .04, C.woodD, x, y, z); box(p, .26 * s, .16 * s, .03, c, x + .15 * s, y + h - .18 * s, z); ico(p, .04, C.gold, x, y + h + .02, z); };
const banner = (p, x, y, z, c, w = .24, h = .56, ry = 0) => { const o = grp(p, x, y, z); o.rotation.y = ry; box(o, w + .06, .04, .04, C.woodD, 0, h, 0); box(o, w, h, .045, c, 0, 0, 0); box(o, w + .02, .05, .06, C.gold, 0, .06, 0); put(o, G('Octahedron', w * .22, 0), M(C.gold), 0, h * .58, .03).scale.z = .35; return o; };
const bricks = (p, list, c) => { for (const [x, y, z, r = 0] of list) box(p, .2, .09, .06, c, x, y, z).rotation.y = r; };
// A stone ground floor w wide and d deep round (0, cz), h tall, with a gap in the front wall from x0 to x1 for the door.
const stoneBase = (p, w, d, h, cz, x0, x1, t = .12) => { box(p, w, h, t, C.stone, 0, 0, cz - d / 2 + t / 2); for (const sd of [-1, 1]) box(p, t, h, d, C.stone, sd * (w / 2 - t / 2), 0, cz);
  const z = cz + d / 2 - t / 2, l = x0 + w / 2, r = w / 2 - x1; if (l > 0) box(p, l, h, t, C.stone, -w / 2 + l / 2, 0, z); if (r > 0) box(p, r, h, t, C.stone, w / 2 - r / 2, 0, z);
  for (const x of [x0, x1]) box(p, .1, h + .04, t + .08, C.stoneD, x + (x === x0 ? -.04 : .04), 0, z); }; // jambs stand proud of the wall (and a hair into the doorway, so no faces lie flush), so the doorway has depth
const glowBox = (p, w, h, d, x, y, z, key = 'lit', c = '#ffe27a', e = '#ffb547') => { const o = put(p, G('Box', w, h, d), MX(key, c, { emissive: e, emissiveIntensity: .7 }), x, y + h / 2, z); o.userData.dyn = true; return o; };
const gearAt = (p, x, y, z, s, c, ry = .25, hole = C.iron) => { const gear = grp(p, x, y, z); gear.scale.setScalar(s); gear.rotation.y = ry;
  put(gear, G('Cylinder', .17, .17, .06, 8), M(c)).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, o = put(gear, G('Box', .07, .08, .06), M(c), Math.cos(a) * .2, Math.sin(a) * .2, 0); o.rotation.z = a + Math.PI / 2; }
  put(gear, G('Cylinder', .06, .06, .07, 6), M(hole)).rotation.x = Math.PI / 2; return gear; };
// How far each level lifts a building's roof, and where its smoke and flag end up.
// The Climbing Tower's spots, shared by its model and by the pets that climb it (ROUTES.tower). up: how much taller level 3 is.
export const TOWER = { up: .44, step: [-.28, .42, .24], mid: [.2, .68, .02], toy: [.4, .6, .2], top: [-.08, 1.45, 0], basket: [.24, 1.14, .18],
  hammock: { x: -.23, y: 1.08, z: -.22, sag: .22 }, hut: [-.02, 1.88, .04] };
// How far the hammock leans, so a pet lying in it sways with it.
export const hammockSway = T => Math.sin(T * 1.4) * .16;
// Upgraded decorations: what a pet does on one, as a list of stops it hops between, each [what, x, y, z, seconds, facing].
// x, y, z are where it sits in the model's own space; facing is in the model's space too (0 looks to the front), or null to
// keep facing the way it came from. scene3d.js plays the stops in order and hops back down at the end.
export const ROUTES = {
  tower(lv) {
    const T = TOWER, at = ([x, y, z]) => [x, y, z], toPost = ([x, , z]) => Math.atan2(-x, -z), toToy = Math.atan2(T.toy[0] - T.mid[0], T.toy[2] - T.mid[2]);
    if (lv < 2) return [['perch', ...at(T.top), 8, null]];
    const head = [['scratch', ...at(T.step), 3, toPost(T.step)], ['bat', ...at(T.mid), lv < 3 ? 4 : 3.5, toToy]];
    if (lv < 3) return [...head, ['nap', ...at(T.top), 9, null]]; // twice as long as level 1, three times at level 3
    const h = T.hammock;
    return [...head, ['sway', h.x, h.y - h.sag, h.z, 6, Math.atan2(h.x, h.z)], ['groom', ...at(T.basket), 3.5, toPost(T.basket) + Math.PI], ['peek', ...at(T.hut), 8, 0]];
  },
};
export const LIFT = { house: [0, 0, .9, .9, .9, .9, .9], lodge: [0, 0, .55], barn: [0, .4, .75], kitchen: [0, .5, 1.0], gate: [0, .55, .8] };
const liftOf = (type, lv) => LIFT[type]?.[Math.min(LIFT[type].length, Math.max(1, lv | 0)) - 1] || 0;

const BUILD = {
  house(g, live, lv = 1) {
    const up = liftOf('house', lv), rf = grp(g, 0, up, 0), grand = lv >= 4, sky = lv >= 7;
    const roof = sky ? C.plum : grand ? C.blue : C.red, roofD = sky ? C.plumD : grand ? C.blueD : C.redD, trim = sky ? C.plum : C.blue;
    box(g, 2.42, .16, 2.02, C.stoneD, 0, 0, -.1);                // stone footing
    box(g, 2.3, 1.25, 1.9, C.cream, 0, 0, -.1);
    for (const x of [-1.13, 1.13]) for (const z of [.83, -1.03]) box(g, .12, 1.25 + up, .12, C.woodD, x, 0, z); // timber frame
    box(g, 2.36, .09, 1.96, C.woodD, 0, 1.16, -.1);
    for (const x of [-.38, .38]) box(g, .07, 1.0, .05, C.woodD, x, .16, .86);
    put(rf, gable(2.7, 1.0, 2.3), M(roof), 0, 1.25, -.1); shingles(rf, 2.7, 1.0, 2.3, 1.25, -.1, roofD);
    box(rf, .12, .1, 2.42, grand ? C.gold : roofD, 0, 2.2, -.1);  // ridge
    for (const sd of [-1, 1]) box(rf, .14, .08, 2.4, C.white, sd * 1.34, 1.22, -.1); // eaves
    put(rf, gable(2.0, .74, .04), M(C.cream), 0, 1.3, 1.06);     // the gable wall, with a round attic window
    const w = put(rf, G('Cylinder', .17, .17, .06, 10), M(C.glass), 0, 1.58, 1.08); w.rotation.x = Math.PI / 2;
    put(rf, G('Torus', .18, .035, 4, 10), M(grand ? C.gold : C.woodD), 0, 1.58, 1.1); box(rf, .04, .34, .03, C.woodD, 0, 1.41, 1.1); box(rf, .34, .04, .03, C.woodD, 0, 1.56, 1.1);
    box(rf, .34, .8, .34, C.stone, .7, 1.4, -.5); box(rf, .44, .1, .44, C.stoneD, .7, 2.2, -.5); box(rf, .2, .1, .2, C.iron, .7, 2.3, -.5); // chimney
    box(g, .66, .9, .06, C.white, 0, 0, .85); box(g, .5, .78, .1, grand ? C.blueD : C.woodD, 0, 0, .87); ico(g, .05, C.yellow, .15, .4, .94);
    box(g, .22, .2, .03, C.glass, 0, .5, .93);                   // door pane
    put(g, gable(.9, .22, .4), M(roofD), 0, .92, 1.02); for (const x of [-.4, .4]) box(g, .05, .1, .3, C.woodD, x, .84, 1.0);
    lantern(g, .46, .58, .9);
    for (const sd of [-1, 1]) {
      box(g, .5, .5, .05, C.white, sd * .72, .46, .85); box(g, .42, .42, .08, C.glass, sd * .72, .5, .86);
      box(g, .03, .4, .03, C.white, sd * .72, .51, .9); box(g, .4, .03, .03, C.white, sd * .72, .7, .9);
      for (const k of [-1, 1]) box(g, .1, .46, .05, C.teal, sd * .72 + k * .29, .48, .88); // shutters
      box(g, .6, .16, .2, C.woodD, sd * .72, .28, .98);          // flower boxes
      [[-.18, C.pink], [0, C.yellow], [.18, C.lilac]].forEach(([x, c], i) => { ico(g, .09, sd > 0 ? [C.yellow, C.pink, C.white][i] : c, sd * .72 + x, .52, 1.0); ico(g, .05, C.leaf, sd * .72 + x + .08, .46, 1.04); });
    }
    box(g, .9, .1, .4, C.stone, 0, 0, 1.1); box(g, .5, .025, .26, C.red, 0, .1, 1.12); box(g, .4, .03, .16, C.cream, 0, .1, 1.12); // doorstep and mat
    barrel(g, 1.02, .98, .8); vine(g, -1.16, .2, lv >= 3 ? .99 : .9, 6, .0, .19, lv >= 3 ? -.035 : -.02); vine(g, -1.0, 1.05, .9, 3, .14, .02);
    if (lv < 2) return;
    // level 2, a cottage: dormer windows in the roof, a picket fence with a flower bed, a taller chimney
    for (const sd of [-1, 1]) {
      box(rf, .5, .44, .5, C.cream, sd * .8, 1.6, .15); box(rf, .06, .26, .3, C.glass, sd * 1.05, 1.7, .15); box(rf, .1, .05, .42, C.white, sd * 1.07, 1.65, .15); box(rf, .08, .3, .04, C.white, sd * 1.06, 1.68, .15); for (const k of [-1, 1]) box(rf, .07, .34, .05, C.white, sd * 1.055, 1.66, .15 + k * .18);
      const d = put(rf, gable(.66, .24, .62), M(roofD), sd * .76, 2.04, .15); d.rotation.y = Math.PI / 2;
      for (let i = 0; i < 4; i++) { const x = sd * (.62 + i * .22); box(g, .08, .34, .04, C.white, x, 0, 1.42); cone(g, .056, .07, 4, C.white, x, .34, 1.42).rotation.y = Math.PI / 4; }
      box(g, .82, .05, .03, C.white, sd * .95, .2, 1.4); box(g, .1, .42, .1, C.wood, sd * 1.4, 0, 1.42); ico(g, .06, C.wood, sd * 1.4, .45, 1.42);
      [C.pink, C.white, C.yellow].forEach((c, i) => { cyl(g, .015, .015, .16, 4, C.leafD, sd * (.7 + i * .24), 0, 1.26); put(g, G('Octahedron', .06, 0), M(sd > 0 ? c : [C.lilac, C.yellow, C.pink][i]), sd * (.7 + i * .24), .2, 1.26).scale.y = .6; });
    }
    box(rf, .26, .3, .26, C.stone, .7, 2.3, -.5); box(rf, .36, .08, .36, C.stoneD, .7, 2.6, -.5); // the chimney grows
    for (const [x, z, r] of [[-.12, 1.42, .16], [.14, 1.38, .13]]) cyl(g, r, r * 1.05, .04, 6, C.stone, x, 0, z); // stepping stones
    if (lv < 3) return;
    // level 3, a manor: a whole upper floor with a balcony over the door, on a tall stone base
    box(g, 2.3, up, 1.9, C.cream, 0, 1.25, -.1); stoneBase(g, 2.46, 2.06, .42, -.1, -.46, .46); box(rf, 2.36, .09, 1.96, C.woodD, 0, 1.16, -.1);
    box(g, .8, .06, .22, C.stoneD, 0, .1, 1.0); // a second step up to the door
    bricks(g, [[-.8, .1, .93], [.86, .24, .93], [-.62, .17, .93], [.7, .08, .93], [-1.0, .26, .93]], C.stoneD);
    bricks(g, [[1.23, .12, .3, Math.PI / 2], [1.23, .27, -.4, Math.PI / 2], [-1.23, .1, -.2, Math.PI / 2], [-1.23, .26, .4, Math.PI / 2]], C.stoneD);
    for (const sd of [-1, 1]) {
      box(g, .46, .46, .08, C.white, sd * .72, 1.42, .86); box(g, .38, .38, .1, C.glass, sd * .72, 1.46, .865); box(g, .03, .36, .04, C.white, sd * .72, 1.47, .905); box(g, .36, .03, .04, C.white, sd * .72, 1.64, .905); box(g, .54, .05, .14, C.woodD, sd * .72, 1.39, .9);
      for (const k of [-1, 1]) box(g, .09, .42, .05, C.teal, sd * .72 + k * .27, 1.44, .88);
      const br = box(g, .06, .95, .05, C.woodD, sd * .36, 1.25, .86); br.rotation.z = 0;
      box(g, .08, .44, .44, C.white, sd * 1.16, 1.42, -.1); box(g, .1, .36, .36, C.glass, sd * 1.165, 1.46, -.1); box(g, .11, .34, .03, C.white, sd * 1.17, 1.47, -.1); box(g, .14, .05, .52, C.woodD, sd * 1.19, 1.39, -.1); // side windows, with sills
    }
    box(g, .96, .07, .42, C.wood, 0, 1.2, 1.06); box(g, .52, .64, .1, C.white, 0, 1.27, .87); box(g, .4, .54, .1, C.glass, 0, 1.3, .885); box(g, .035, .52, .04, C.white, 0, 1.31, .925); box(g, .38, .035, .04, C.white, 0, 1.62, .925); ico(g, .025, C.yellow, .06, 1.52, .95); // balcony and its glass door, set in a deep frame
    for (const x of [-.4, .4]) { const b = box(g, .05, .3, .05, C.woodD, x, .98, 1.12); b.rotation.x = .75; } // struts under the balcony
    for (const x of [-.45, -.225, 0, .225, .45]) box(g, .04, .26, .04, C.white, x, 1.27, 1.25); box(g, .96, .05, .05, C.white, 0, 1.5, 1.25);
    for (const x of [-.46, .46]) { box(g, .04, .26, .04, C.white, x, 1.27, 1.08); box(g, .05, .05, .38, C.white, x, 1.5, 1.08); }
    for (const [x, c] of [[-.32, C.pink], [-.1, C.yellow], [.12, C.lilac], [.34, C.pink]]) ico(g, .07, c, x, 1.56, 1.27);
    if (lv < 4) return;
    // level 4, the grand farmhouse: a stone tower with a pointed roof and a flag, a blue slate roof with a gold ridge
    const t = grp(g, -.98, 0, -.95); t.scale.set(1.25, 1, 1.25); // wide enough to swallow the corner of the eaves
    cyl(t, .44, .47, 2.75, 8, C.stone); cyl(t, .5, .5, .1, 8, C.stoneD, 0, 0); cyl(t, .5, .46, .12, 8, C.stoneD, 0, 2.7); cyl(t, .47, .47, .07, 8, C.woodD, 0, 1.3);
    for (const [a, y] of [[.5, .5], [1.9, 1.0], [-.6, 1.7], [1.2, 2.2], [-1.5, .8], [2.6, 2.4], [0, 2.45]]) box(t, .2, .09, .03, C.stoneD, Math.sin(a) * .445, y, Math.cos(a) * .445).rotation.y = a;
    for (const [a, y] of [[-.785, 2.05], [-2.356, 2.05], [-.785, .8]]) { const o = grp(t, Math.sin(a) * .44, y, Math.cos(a) * .44); o.rotation.y = a; box(o, .2, .34, .06, C.glass, 0, 0, 0); box(o, .26, .05, .08, C.stoneD, 0, -.05, 0); box(o, .26, .05, .08, C.stoneD, 0, .34, 0); }
    if (lv < 6) { cone(t, .62, .16, 8, C.blueD, 0, 2.8); cone(t, .56, .95, 8, C.blue, 0, 2.86); ico(t, .07, C.gold, 0, 3.86, 0);
      box(t, .03, .5, .03, C.woodD, 0, 3.86, 0); box(t, .34, .2, .03, C.red, .19, 4.14, 0); box(t, .1, .08, .04, C.gold, .14, 4.2, 0); }
    for (const sd of [-1, 1]) banner(g, sd * .36, 1.51 + up - .9, .9, trim, .2, .5);
    put(rf, G('Octahedron', .1, 0), M(C.gold), 0, 2.42, 1.05).scale.set(1, 1.5, .6); box(rf, .03, .14, .03, C.goldD, 0, 2.25, 1.05); // a gold finial over the gable
    for (const sd of [-1, 1]) box(rf, .16, .05, 2.42, C.gold, sd * 1.34, 1.3, -.1);
    lantern(g, -.46, .58, .9);
    if (lv < 5) return;
    // level 5, the farm estate: a square clock tower at the back right with a gold dome and a star on top
    const k = grp(g, 1.0, 0, -1.08);
    box(k, .64, .12, .64, C.stoneD); box(k, .54, 3.0, .54, C.cream, 0, .1); for (const [x, z] of [[-.27, -.27], [.27, -.27], [-.27, .27], [.27, .27]]) box(k, .08, 3.0, .08, C.woodD, x, .1, z);
    box(k, .62, .1, .62, C.woodD, 0, 1.5); box(k, .64, .12, .64, C.stoneD, 0, 3.08);
    for (const [ry, x, z] of [[0, 0, .28], [Math.PI / 2, .28, 0]]) { const f = grp(k, x, 2.55, z); f.rotation.y = ry; // a clock face on the front and the side
      put(f, G('Cylinder', .2, .2, .04, 12), M(C.white)).rotation.x = Math.PI / 2; put(f, G('Torus', .2, .03, 4, 12), M(C.gold), 0, 0, .02);
      box(f, .025, .13, .02, C.iron, 0, -.01, .03); box(f, .1, .025, .02, C.iron, .04, 0, .035); ico(f, .02, C.gold, 0, 0, .045); }
    for (const sd of [-1, 1]) { const w = grp(k, sd * .28, 1.9, 0); w.rotation.y = sd * Math.PI / 2; box(w, .2, .34, .06, C.glass); box(w, .26, .05, .1, C.woodD, 0, -.04); }
    put(k, G('Cylinder', .28, .4, .36, 4), M(trim), 0, 3.38, 0).rotation.y = Math.PI / 4; ico(k, .26, C.gold, 0, 3.66, 0, 1); // the dome
    if (!sky) { box(k, .03, .36, .03, C.goldD, 0, 3.88, 0); put(k, G('Octahedron', .11, 0), GOLDM(), 0, 4.3, 0).scale.set(1, 1.3, .4); } // (at level 7 a sky crystal floats there instead, FX.house)
    for (const sd of [-1, 1]) banner(g, sd * .36 + .02, .55, 1.4, trim, .14, .3); // little banners on the fence posts
    if (lv < 6) return;
    // level 6, the explorer's house: the stone tower becomes an observatory, a copper dome with a brass telescope that
    // looks out past the clouds (far expeditions open at this level), and a weathervane rides the roof
    const T0 = [-.98, 2.82, -.95], domeC = sky ? C.gold : C.patina, domeD = sky ? C.goldD : C.patinaD, D0 = T0[1] + .5; // D0: where the dome sits
    cyl(g, .74, .74, .08, 8, C.woodD, T0[0], T0[1], T0[2]); // a lookout gallery round the top of the tower, with a rail
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; box(g, .035, .22, .035, C.white, T0[0] + Math.sin(a) * .7, T0[1] + .08, T0[2] + Math.cos(a) * .7); }
    put(g, G('Torus', .7, .022, 3, 16), M(C.white), T0[0], T0[1] + .31, T0[2]).rotation.x = Math.PI / 2;
    cyl(g, .5, .5, .42, 8, C.cream, T0[0], T0[1] + .08, T0[2]); // the observatory room
    for (const a of [.35, 1.2, -.5, 2.1]) { const o = grp(g, T0[0] + Math.sin(a) * .47, T0[1] + .17, T0[2] + Math.cos(a) * .47); o.rotation.y = a; box(o, .14, .2, .06, C.glass); box(o, .2, .035, .08, C.woodD, 0, -.02); box(o, .2, .035, .08, C.woodD, 0, .2); }
    cyl(g, .55, .55, .08, 8, domeD, T0[0], D0 - .08, T0[2]); // a drum the dome turns on
    put(g, G('Sphere', .52, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(domeC), T0[0], D0, T0[2]);
    for (let i = 0; i < 3; i++) put(g, G('Torus', .525, .022, 3, 12, Math.PI), M(domeD), T0[0], D0, T0[2]).rotation.y = i * Math.PI / 3 + .3; // ribs over the dome
    const tel = grp(g, T0[0], D0 + .22, T0[2]); tel.rotation.copy(new THREE.Euler(-.75, -.5, 0, 'YXZ')); // the telescope looks up and out to the front left
    for (const [r, h, z, c] of [[.07, .5, .3, C.brass], [.085, .06, .6, C.gold], [.095, .2, .66, C.brass], [.105, .05, .86, C.gold]]) put(tel, G('Cylinder', r, r, h, 8), M(c), 0, 0, z + h / 2).rotation.x = Math.PI / 2;
    put(tel, G('Cylinder', .085, .085, .02, 8), M(C.glass), 0, 0, .915).rotation.x = Math.PI / 2;
    pennant(g, T0[0], D0 + .5, T0[2], sky ? C.plum : C.red, .5); // the flag moves to the top of the dome
    const wv = grp(rf, -.35, 2.3, -.55); box(wv, .035, .5, .035, C.iron); // the weathervane's post and its compass arms (the arrow turns, FX.house)
    for (const ry of [0, Math.PI / 2]) { const arm = box(wv, .34, .025, .025, C.iron, 0, .3, 0); arm.rotation.y = ry; }
    for (const [x, z] of [[.17, 0], [-.17, 0], [0, .17], [0, -.17]]) ico(wv, .028, C.gold, x, .31, z);
    if (lv < 7) return;
    // level 7, the sky manor: a plum roof, a gilded observatory, a sky crystal floating over the clock tower (FX.house)
    // and crystal lamps lighting the way to the door
    for (const sd of [-1, 1]) { const x = sd * .56, z = 1.17;
      cyl(g, .07, .09, .08, 6, C.stoneD, x, 0, z); cyl(g, .028, .028, .56, 6, C.iron, x, .08, z); box(g, .1, .03, .1, C.goldD, x, .64, z);
      put(g, G('Octahedron', .075, 0), MX('crystalglow', '#bdf2ff', { emissive: '#7fdcf5', emissiveIntensity: .8 }), x, .76, z).scale.y = 1.5;
      box(g, .03, .14, .03, C.gold, x, .86, z); }
  },
  // The Pet Museum, a 3x3 landmark. Five medallions over the columns show the album: Leaf, Ember, Tide, Spark, Stone,
  // each filled in eighths (link is museumFill() from data.js, '00000' to '88888'). Level 2 adds a dome, 3 skylights,
  // gold trim and element banners, 4 front wings and pet statues, 5 a golden dome with a star, flags and a red carpet.
  museum(g, live, lv = 1, link = '00000') {
    const fill = String(link || '').padEnd(5, '0').slice(0, 5).split('').map(n => Math.min(8, Math.max(0, n | 0))), full = fill.every(n => n === 8);
    const trim = lv >= 3 ? C.gold : C.white, roof = C.blue, wall = C.cream, hz = -.35; // the hall runs from z -1.2 to .5
    box(g, 2.9, .18, 1.9, C.stoneD, 0, 0, hz);                     // footing
    box(g, 2.1, 1.15, 1.7, wall, 0, .18, hz);                       // the hall
    box(g, 2.24, .1, 1.84, C.white, 0, 1.33, hz);                   // cornice
    if (lv >= 3) box(g, 2.27, .045, 1.87, C.gold, 0, 1.3, hz);       // gold band under it
    box(g, 2.0, .08, 1.6, '#ece6dc', 0, 1.43, hz);                  // flat roof
    for (const x of [-1, 1]) for (const z of [-1.16, .46]) box(g, .14, 1.15, .14, '#efe4cc', x, .18, z); // corner pilasters, standing proud
    // the portico: a raised floor, steps, four columns, a beam carrying the medallions and a blue pediment
    box(g, 1.9, .26, .62, C.stone, 0, 0, .79);
    box(g, 1.6, .09, .3, C.stone, 0, 0, 1.23); box(g, 1.5, .18, .2, C.stoneD, 0, 0, 1.14); // two steps up
    for (const x of [-.72, -.24, .24, .72]) {
      box(g, .2, .06, .2, C.white, x, .26, .95); cyl(g, .075, .085, .92, 8, C.white, x, .32, .95); box(g, .22, .06, .22, trim, x, 1.2, .95);
    }
    box(g, 1.96, .24, .22, C.white, 0, 1.26, .95);                  // the beam: a frieze for the medallions
    box(g, 1.9, .06, .5, '#ece6dc', 0, 1.31, .66);                  // porch ceiling, from the hall to the beam
    put(g, gable(2.1, .46, .66), M(roof), 0, 1.5, .79);             // pediment roof
    put(g, gable(1.72, .32, .04), M(wall), 0, 1.55, 1.13);           // and its cream face
    box(g, 2.12, .05, .7, trim, 0, 1.47, .79);                      // the ledge it sits on
    const paw = trim === C.gold ? C.gold : C.yellow; ico(g, .07, paw, 0, 1.69, 1.16); // a paw over the door: one pad and four toes
    for (const [x, y] of [[-.09, 1.78], [-.035, 1.82], [.035, 1.82], [.09, 1.78]]) ico(g, .028, paw, x, y, 1.155);
    // the medallions: a white disc with the element's gem, and eight beads round it that take the element's colour
    // one by one as the album fills; a gold rim once every pet of that element is found
    const ELS = ['#3f9a52', '#e0592f', '#2f86cc', '#d9a400', '#8a7f76'];
    fill.forEach((n, i) => {
      const f = grp(g, -.76 + i * .38, 1.38, 1.06);
      put(f, G('Cylinder', .1, .1, .03, 16), M(n === 8 ? C.gold : '#fbf6ea')).rotation.x = Math.PI / 2;
      put(f, G('Torus', .1, .014, 4, 16), M(n === 8 ? C.gold : C.stoneD), 0, 0, .012);
      put(f, G('Octahedron', .045, 0), M(ELS[i]), 0, 0, .02).scale.z = .5;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ico(f, .019, k < n ? ELS[i] : '#d8d2c4', Math.sin(a) * .072, Math.cos(a) * .072, .02); }
    });
    // the door, set in a deep frame, with a gold lintel
    box(g, .58, .8, .08, C.white, 0, .26, .53); box(g, .44, .68, .06, C.blueD, 0, .27, .56); box(g, .03, .6, .02, '#2f4f86', 0, .3, .595);
    box(g, .64, .06, .1, C.gold, 0, 1.06, .54); ico(g, .03, C.gold, .12, .58, .6); ico(g, .03, C.gold, -.12, .58, .6);
    box(g, .5, .02, .26, C.red, 0, .26, .74);                       // the doormat
    // tall windows on the sides and the back, with sills, so no wall is bare
    const win = (x, z, ry) => { const o = grp(g, x, .18, z); o.rotation.y = ry;
      box(o, .4, .66, .05, C.white, 0, .2, 0); box(o, .3, .56, .08, C.glass, 0, .25, 0); box(o, .025, .54, .1, C.white, 0, .26, 0); box(o, .28, .025, .1, C.white, 0, .6, 0);
      box(o, .48, .05, .14, '#efe4cc', 0, .17, .03); put(o, G('Cylinder', .2, .2, .05, 10, 1, false, -Math.PI / 2, Math.PI), M(C.white), 0, .86, 0).rotation.x = -Math.PI / 2; };
    for (const sd of [-1, 1]) for (const z of [-.8, .1]) win(sd * 1.06, z, sd * Math.PI / 2);
    for (const x of [-.62, .62]) win(x, -1.21, Math.PI);
    if (full) { box(g, .03, .14, .03, C.goldD, 0, 1.93, 1.1); put(g, G('Octahedron', .12, 0), GOLDM(), 0, 2.11, 1.1).scale.set(1, 1.2, .35); } // the whole album found: a star over the pediment
    if (lv < 4) for (const sd of [-1, 1]) { cyl(g, .12, .09, .2, 8, C.copper, sd * 1.15, 0, 1.25); ico(g, .15, C.leaf, sd * 1.15, .32, 1.25); ico(g, .05, C.pink, sd * 1.15 + .06, .42, 1.33); } // potted bushes
    if (lv < 2) return;
    // level 2: a drum and a blue dome with a gold lantern on top
    const dome = lv >= 5 ? C.gold : roof;
    cyl(g, .5, .52, .26, 12, wall, 0, 1.49, hz); cyl(g, .54, .54, .05, 12, trim, 0, 1.73, hz);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + Math.PI / 12; box(g, .05, .18, .05, C.white, Math.sin(a) * .505, 1.53, hz + Math.cos(a) * .505).rotation.y = a; }
    put(g, G('Sphere', .5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(dome), 0, 1.77, hz);
    cyl(g, .1, .12, .16, 8, C.white, 0, 2.25, hz); cone(g, .14, .12, 8, C.gold, 0, 2.41, hz); ico(g, .05, C.gold, 0, 2.56, hz);
    if (lv < 3) return;
    // level 3: skylights each side of the dome, and a banner in each element's colour
    for (const sd of [-1, 1]) { box(g, .36, .04, 1.2, C.white, sd * .76, 1.51, hz); box(g, .28, .06, 1.1, C.glass, sd * .76, 1.52, hz); for (const z of [-.2, .2]) box(g, .3, .07, .03, C.white, sd * .76, 1.52, hz + z); }
    banner(g, -1.08, .5, -.35, ELS[0], .2, .5, -Math.PI / 2); banner(g, 1.08, .5, -.35, ELS[2], .2, .5, Math.PI / 2);
    for (const [x, c] of [[-.3, ELS[1]], [0, ELS[4]], [.3, ELS[3]]]) banner(g, x, .5, -1.23, c, .16, .46, Math.PI);
    if (lv < 4) return;
    // level 4: two wings either side of the portico, and pet statues guarding the steps
    for (const sd of [-1, 1]) { const x = sd * 1.2;
      box(g, .44, .82, .62, wall, x, .18, .78); box(g, .5, .07, .68, trim, x, 1.0, .78);
      put(g, gable(.5, .2, .68), M(roof), x, 1.07, .78);
      box(g, .26, .4, .05, C.white, x, .38, 1.1); box(g, .18, .32, .08, C.glass, x, .42, 1.1); box(g, .32, .05, .12, '#efe4cc', x, .36, 1.13);
      const st = grp(g, sd * .96, 0, 1.33); st.scale.setScalar(.9);
      box(st, .26, .22, .26, C.stoneD); box(st, .3, .04, .3, trim, 0, .22);
      const sc = lv >= 5 ? C.gold : C.stone;
      ico(st, .1, sc, 0, .36, -.02); ico(st, .075, sc, 0, .5, .03); for (const ex of [-.045, .045]) cone(st, .03, .07, 4, sc, ex, .54, .03);
      put(st, G('Torus', .07, .02, 4, 8, Math.PI), M(sc), sd * -.08, .3, -.06).rotation.y = Math.PI / 2;
    }
    if (lv < 5) return;
    // level 5: a golden dome with a star, flags on the corners and a red carpet up the steps
    box(g, .03, .3, .03, C.goldD, 0, 2.6, hz); put(g, G('Octahedron', .14, 0), GOLDM(), 0, 3.02, hz).scale.set(1, 1.3, .4);
    for (const [x, z, c] of [[-.92, -1.08, ELS[0]], [.92, -1.08, ELS[2]], [-.92, .38, ELS[1]], [.92, .38, ELS[3]]]) pennant(g, x, 1.51, z, c, .5, .9);
    box(g, .4, .015, .3, C.red, 0, .09, 1.23); box(g, .4, .015, .2, C.red, 0, .18, 1.14); box(g, .4, .015, .48, C.red, 0, .26, .79);
    for (const sd of [-1, 1]) { box(g, .05, .5, .05, C.iron, sd * .86, .26, .6); lantern(g, sd * .86, .76, .6, .9); }
  },
  // The Pet Lodge: a long log cabin where stored pets sleep. Level 2 adds a porch, level 3 a whole upper floor.
  lodge(g, live, lv = 1) {
    const up = liftOf('lodge', lv), rf = grp(g, 0, up, -.18), roof = '#5b6fb8', roofD = '#46579a', gold = lv >= 3;
    box(g, 2.9, .14, 1.5, C.stoneD, 0, 0, -.18);
    box(g, 2.7, 1.05 + up, 1.3, '#c58e5c', 0, .1, -.18); // log walls
    for (let i = 0; i < 6; i++) for (const z of [-.84, .48]) put(g, G('Cylinder', .065, .065, 2.74, 6), M(i % 2 ? C.wood : '#c99763'), 0, .2 + i * .18, z).rotation.z = Math.PI / 2;
    for (const x of [-1.33, 1.33]) for (const z of [-.86, .5]) for (let i = 0; i < 6; i++) put(g, G('Cylinder', .06, .06, .26, 6), M(C.woodD), x, .2 + i * .18, z).rotation.x = Math.PI / 2; // log ends crossing at the corners
    const r = grp(rf, 0, 1.15, 0); r.rotation.y = Math.PI / 2; put(r, gable(1.75, .85, 3.0), M(roof)); shingles(r, 1.75, .85, 3.0, 0, 0, roofD, 4);
    box(rf, 3.06, .1, .1, gold ? C.gold : roofD, 0, 1.97, 0); // ridge
    for (const sd of [-1, 1]) { // the gable ends: a wooden face with a round attic window, standing just proud of the roof
      const g2 = put(rf, gable(1.3, .62, .04), M('#c58e5c'), sd * 1.515, 1.17, 0); g2.rotation.y = Math.PI / 2;
      const w = put(rf, G('Cylinder', .13, .13, .06, 10), M(C.glass), sd * 1.54, 1.42, 0); w.rotation.z = Math.PI / 2; put(rf, G('Torus', .14, .035, 4, 10), M(gold ? C.gold : C.woodD), sd * 1.56, 1.42, 0).rotation.y = Math.PI / 2; }
    // the sides and the back: windows with sills, a log pile and a water barrel, so no wall is bare
    for (const sd of [-1, 1]) { const o = grp(g, sd * 1.36, 0, -.18); o.rotation.y = sd * Math.PI / 2;
      put(o, G('Cylinder', .16, .16, .08, 12), M(C.glass), 0, .62, .02).rotation.x = Math.PI / 2; put(o, G('Torus', .17, .035, 4, 12), M(C.woodD), 0, .62, .05);
      box(o, .1, .26, .03, C.pink, -.09, .5, .06); box(o, .1, .26, .03, C.pink, .09, .5, .06); box(o, .42, .06, .14, C.woodD, 0, .38, .08); }
    for (const x of [-.7, .7]) { box(g, .36, .32, .08, C.white, x, .46, -.86); box(g, .28, .26, .1, C.glass, x, .49, -.865); box(g, .03, .24, .04, C.white, x, .5, -.915); box(g, .44, .05, .14, C.woodD, x, .42, -.9); }
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3 - i; k++) put(g, G('Cylinder', .08, .08, .3, 7), M(k % 2 ? C.wood : '#c99763'), -.05 + (k - (2 - i) / 2) * .17, .08 + i * .14, -1.02).rotation.x = Math.PI / 2; // the log pile at the back, ends out
    barrel(g, 1.2, -.98, .75);
    box(rf, .3, .7, .3, C.stone, -.85, 1.4, -.45); box(rf, .38, .08, .38, C.stoneD, -.85, 2.1, -.45); // chimney
    // the front: a wide double door with a moon sign over it, and round windows with curtains
    box(g, .86, .8, .08, C.woodD, 0, .1, .5); for (const sd of [-1, 1]) { box(g, .38, .7, .08, '#7a5a8a', sd * .2, .15, .53); ico(g, .03, C.gold, sd * .06, .46, .58); }
    box(g, .96, .08, .14, C.woodD, 0, .88, .52); box(g, 1.0, .08, .4, C.stone, 0, 0, .72);
    const moon = put(g, G('Torus', .14, .045, 4, 10, Math.PI * 1.3), M(C.gold), 0, 1.04 + up * .5, .58); moon.rotation.z = -.9;
    ico(g, .035, C.yellow, .16, 1.1 + up * .5, .58); ico(g, .025, C.yellow, -.14, 1.12 + up * .5, .58);
    for (const sd of [-1, 1]) { const x = sd * .85;
      const w = put(g, G('Cylinder', .2, .2, .08, 12), M(C.glass), x, .62, .52); w.rotation.x = Math.PI / 2; put(g, G('Torus', .21, .04, 4, 12), M(C.woodD), x, .62, .55);
      box(g, .14, .3, .03, C.pink, x - .1, .62, .56); box(g, .14, .3, .03, C.pink, x + .1, .62, .56); // curtains drawn: someone is napping
      box(g, .5, .1, .16, C.woodD, x, .32, .6); [C.lilac, C.white, C.pink].forEach((c, i) => ico(g, .07, c, x - .15 + i * .15, .44, .62)); }
    lantern(g, .6, .7, .58);
    if (lv < 2) return;
    // level 2: a covered porch across the front with a bench, lanterns and a sleepy rug
    box(g, 2.6, .08, .5, C.wood, 0, .1, .72); for (const x of [-1.25, -.55, .55, 1.25]) box(g, .08, .9, .08, C.woodD, x, .18, .92);
    const pr = put(g, G('Box', 2.8, .07, .62), M(roofD), 0, 1.12, .76); pr.rotation.x = .22;
    for (const sd of [-1, 1]) { box(g, .5, .06, .2, C.wood, sd * 1.0, .34, .82); for (const k of [-1, 1]) box(g, .05, .16, .05, C.woodD, sd * 1.0 + k * .2, .18, .82); lantern(g, sd * 1.25, .95, .92, .9); }
    box(g, .6, .02, .3, C.lilac, 0, .18, .78); box(g, .4, .025, .18, C.cream, 0, .19, .78);
    if (lv < 3) return;
    // level 3: a whole upper floor, gold trim and a star on the ridge
    for (const sd of [-1, 1]) { const x = sd * .6; box(g, .4, .38, .08, C.white, x, 1.12, .52); box(g, .32, .3, .1, C.glass, x, 1.16, .53); box(g, .03, .28, .04, C.white, x, 1.17, .58); box(g, .48, .05, .14, C.woodD, x, 1.1, .58); }
    for (let i = 0; i < 2; i++) for (const z of [-.84, .48]) put(g, G('Cylinder', .065, .065, 2.74, 6), M(i % 2 ? C.wood : '#c99763'), 0, 1.28 + i * .18, z).rotation.z = Math.PI / 2;
    for (const sd of [-1, 1]) box(rf, 3.04, .05, .06, C.gold, 0, 1.17, sd * .86);
    box(rf, .03, .4, .03, C.goldD, 1.2, 1.97, 0); put(rf, G('Octahedron', .13, 0), GOLDM(), 1.2, 2.45, 0).scale.set(1, 1.3, .4);
    pennant(rf, -1.2, 1.97, 0, C.lilac, .5, 1.1);
  },
  hut(g, live, lv = 1) {
    const pz = lv >= 2 ? .86 : .8; // how far out the paw-print plate stands
    cyl(g, .86, .9, .1, 6, C.stoneD).rotation.y = Math.PI / 6;
    cyl(g, .78, .84, .75, 6, '#e9c99a', 0, .04).rotation.y = Math.PI / 6; // a flat wall faces the front, the posts stand at the corners
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; box(g, .08, .76, .08, C.woodD, Math.sin(a) * .8, .04, Math.cos(a) * .8); }
    if (lv < 2) {
      cone(g, 1.14, .3, 6, C.leafD, 0, .72); cone(g, 1.04, .85, 6, C.leaf, 0, .78); cone(g, .6, .5, 6, C.leafL, 0, 1.2);
      ico(g, .16, C.leafL, 0, 1.72, 0); cone(g, .05, .2, 4, C.leafD, .06, 1.8, 0).rotation.z = -.5;
    } else { // level 2: a loft with its own round window under a second leafy roof
      cone(g, 1.14, .3, 6, C.leafD, 0, .72); cyl(g, .66, 1.04, .44, 6, C.leaf, 0, .78);
      cyl(g, .56, .6, .52, 6, '#e9c99a', 0, 1.18).rotation.y = Math.PI / 6; cyl(g, .62, .62, .06, 6, C.woodD, 0, 1.18);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; box(g, .06, .52, .06, C.woodD, Math.sin(a) * .55, 1.18, Math.cos(a) * .55); }
      for (const a of lv >= 3 ? [0, 2.094, -2.094] : [0]) { const o = grp(g, Math.sin(a) * .5, 1.45, Math.cos(a) * .5); o.rotation.y = a; put(o, G('Cylinder', .15, .15, .1, 8), M(C.glass)).rotation.x = Math.PI / 2; put(o, G('Torus', .16, .035, 4, 8), M(lv >= 3 ? C.gold : C.woodD), 0, 0, .05); }
      cone(g, .86, .24, 6, C.leafD, 0, 1.64); cone(g, .78, .7, 6, C.leaf, 0, 1.68); cone(g, .45, .42, 6, C.leafL, 0, 2.02);
      if (lv < 3) { ico(g, .14, C.leafL, 0, 2.5, 0); cone(g, .05, .2, 4, C.leafD, .06, 2.56, 0).rotation.z = -.5; }
      [C.pink, C.yellow, C.teal, C.lilac, C.yellow, C.pink].forEach((c, i) => { const a = i * Math.PI / 3; cone(g, .08, .18, 3, c, Math.sin(a) * 1.1, .56, Math.cos(a) * 1.1).rotation.x = Math.PI; }); // bunting under the eaves
      lantern(g, .44, .5, .74, 1.1); cyl(g, .13, .1, .08, 8, C.teal, -.5, 0, .9); cyl(g, .1, .1, .09, 8, C.water, -.5, 0, .9); // a lamp by the door and a water bowl
      box(g, .5, .12, .34, C.straw, -.86, 0, -.2).rotation.y = .5; box(g, .4, .05, .26, C.lilac, -.86, .12, -.2).rotation.y = .5; // a day bed outside
    }
    if (lv >= 3) { // level 3: a stone base, a roof in bloom, gold trim and a flag on top
      put(g, G('Cylinder', .87, .92, .34, 10, 1, false, Math.PI / 6, Math.PI * 5 / 3), M(C.stone), 0, .22, 0); // open at the front, where the door is
      for (const sd of [-1, 1]) { const j = box(g, .16, .4, .2, C.stoneD, sd * .43, .04, .72); j.rotation.y = sd * Math.PI / 6; }
      for (const [a, y] of [[.9, .12], [2.2, .22], [-1.0, .2], [-2.3, .1], [3.0, .2], [1.5, .24]]) box(g, .2, .08, .06, C.stoneD, Math.sin(a) * .86, y, Math.cos(a) * .86).rotation.y = a;
      [[.5, .98, .7], [1.6, 1.0, .68], [2.9, .96, .72], [-1.2, 1.0, .68], [-2.4, .98, .7], [1.0, 1.86, .52], [-.4, 1.9, .5], [2.6, 1.9, .5], [-2.0, 1.86, .52], [.2, 2.2, .28], [3.3, 2.2, .28]].forEach(([a, y, r], i) => put(g, G('Octahedron', .075, 0), M([C.pink, C.white, C.yellow, C.lilac][i % 4]), Math.sin(a) * r, y, Math.cos(a) * r).scale.y = .6);
      box(g, .34, .04, .11, C.gold, 0, .845, pz - .02); pennant(g, 0, 2.38, 0, C.pink, .56, 1.2);
      vine(g, -.5, .66, .72, 3, -.07, -.16, -.05);
    }
    const d = put(g, G('Cylinder', .3, .3, .1, 10), M(C.iron), 0, .36, .74); d.rotation.x = Math.PI / 2; d.scale.z = 1.25; // a round doorway
    const r = put(g, G('Torus', .31, .05, 4, 10), M(C.woodD), 0, .36, .78); r.scale.y = 1.25;
    // a paw-print plate, standing clear of the wider roof of a bigger hut
    box(g, .34, .2, lv >= 2 ? .1 : .05, C.cream, 0, .86, pz - (lv >= 2 ? .025 : 0)); if (lv >= 2) { box(g, .4, .05, .14, C.woodD, 0, 1.06, pz - .03); for (const x of [-.19, .19]) box(g, .04, .24, .12, C.woodD, x, .84, pz - .03); }
    ico(g, .045, C.woodD, 0, .93, pz + .03); for (const x of [-.07, 0, .07]) ico(g, .024, C.woodD, x, 1.0 + (x ? 0 : .02), pz + .03);
    for (const sd of [-1, 1]) { const w = put(g, G('Cylinder', .12, .12, .06, 8), M(C.glass), sd * .615, .5, .355); /* flat on the wall face that looks 60 degrees round */ w.rotation.set(Math.PI / 2, 0, -sd * Math.PI / 3); }
    cyl(g, .13, .1, .08, 8, C.red, .56, 0, .86); cyl(g, .1, .1, .09, 8, C.wood, .56, 0, .86); // food bowl
    box(g, .44, .02, .22, C.pink, 0, 0, .98);
    for (const [x, z, h] of [[-.72, .6, .14], [-.82, .46, .1]]) { cyl(g, .025, .03, h, 5, C.cream, x, 0, z); cone(g, .07, .07, 6, C.red, x, h, z); }
  },
  gate(g, live, lv = 1) {
    const up = liftOf('gate', lv), rc = lv >= 3 ? C.blue : C.slate;
    for (const s of [-1, 1]) {
      box(g, .5, .12, .5, C.stoneD, s * .72); box(g, .36, 1.5, .36, C.stone, s * .72); box(g, .46, .14, .46, C.stoneD, s * .72, 1.5);
      for (const [y, z] of [[.4, .185], [.95, .185], [.7, -.185]]) box(g, .2, .1, .02, C.stoneD, s * .72 + (y > .6 ? .05 : -.06), y, z); // odd bricks
    }
    if (lv < 2) lantern(g, -.72, 1.64, 0, 1.5);
    else for (const s of [-1, 1]) { // level 2: taller pillars under little roofs, a lamp on each, banners and a paved way through
      box(g, .3, up - .14, .3, C.stone, s * .72, 1.64); box(g, .44, .1, .44, C.stoneD, s * .72, 1.5 + up); cone(g, .34, .3, 4, rc, s * .72, 1.6 + up).rotation.y = Math.PI / 4;
      box(g, .14, .09, .02, C.stoneD, s * .72 + .04, 1.76, .155);
      lantern(g, s * .72, 1.0, .24, 1.2); banner(g, s * .93, .5, 0, lv >= 3 ? C.blue : C.teal, .22, .56, s * Math.PI / 2);
    }
    if (lv >= 2) { for (const [x, z, r] of [[-.2, -.3, .2], [.18, -.2, .17], [-.1, .1, .16], [.24, .26, .19], [-.3, -.62, .15], [.1, -.68, .18]]) cyl(g, r, r * 1.05, .04, 6, C.stone, x, 0, z).rotation.y = x * 7; ico(g, .06, C.stoneD, -.72, 1.94 + up, 0); }
    if (lv >= 3) { // level 3: gold on the beam and the roofs, braces, a glowing crystal and a red carpet
      box(g, 1.86, .05, .32, C.gold, 0, 1.27); box(g, 1.86, .035, .4, C.gold, 0, 1.6);
      for (const s of [-1, 1]) { const b = box(g, .08, .5, .1, C.woodD, s * .42, .98, 0); b.rotation.z = s * .7; box(g, .56, .3, .56, C.stoneD, s * .72); box(g, .5, .08, .5, C.gold, s * .72, 1.42 + up); }
      const cr = put(g, G('Octahedron', .11, 0), MX('glow', '#8fe3f5', { emissive: '#8fe3f5', emissiveIntensity: .8 }), -.72, 2.06 + up, 0); cr.scale.y = 1.5; cr.userData.dyn = true;
      box(g, .5, .03, 1.7, C.red, 0, .03, 0); for (const x of [-.27, .27]) box(g, .05, .03, 1.68, C.gold, x, .04, 0);
      put(g, G('Torus', .23, .035, 4, 10), M(C.gold), 0, 1.42, .21);
    }
    box(g, 1.88, .24, .3, C.wood, 0, 1.3); box(g, 2.0, .06, .36, C.woodD, 0, 1.54);
    const c = put(g, G('Cylinder', .2, .2, .06, 10), M(C.cream), 0, 1.42, .17); c.rotation.x = Math.PI / 2; // a compass over the way out
    const n = put(g, G('Octahedron', .06, 0), M(C.red), 0, 1.42, .21); n.scale.set(.5, 2.6, .3); n.rotation.z = -.6; put(g, G('Torus', .2, .03, 4, 10), M(C.yellow), 0, 1.42, .2);
    [C.pink, C.yellow, C.teal, C.lilac, C.yellow, C.pink].forEach((col, i) => { const t = cone(g, .07, .16, 3, col, -.5 + i * .2, 1.14, .1); t.rotation.x = Math.PI; }); // bunting
    box(g, .5, .5, .05, C.red, 0, .78, .02); box(g, .06, .5, .06, C.woodD, -.32, .8, .02);
    box(g, .08, .8, .08, C.woodD, .75, 0, .7); box(g, .46, .2, .06, C.cream, .9, .56, .7); box(g, .4, .16, .06, C.cream, .62, .32, .7).rotation.y = .5; // signpost
    vine(g, -.92, .1, .12, 6, 0, .2, 0); vine(g, -.6, 1.2, .2, 3, .0, -.16);
    crate(g, -.72, .62, .3); crate(g, -.44, .7, .22, 0, .5);     // packed for the road
    const roll = cyl(g, .05, .05, .34, 6, C.cream, -.72, .3, .62); roll.rotation.z = Math.PI / 2; roll.position.y = .36;
    box(g, .24, .28, .16, C.teal, .42, 0, .78); box(g, .26, .08, .18, C.woodD, .42, .24, .78); cyl(g, .05, .05, .2, 6, C.cream, .42, .32, .78).rotation.z = Math.PI / 2; // backpack with a bedroll
  },
  garden(g, live, lv = 1) {
    box(g, .92, .14, .92, lv >= 3 ? C.stone : C.woodD); box(g, .78, .18, .78, C.soil);
    if (!live) PARTS.garden(g);
    const sun = (x, z, h) => { cyl(g, .022, .022, h, 4, C.leafD, x, .18, z); ico(g, .09, C.gold, x, .2 + h + .05, z); ico(g, .035, C.white, x + .04, .2 + h + .11, z + .05); for (const sd of [-1, 1]) cone(g, .05, .16, 4, C.leafL, x + sd * .07, .18 + h * .45, z).rotation.z = -sd * 1.1; };
    if (lv >= 2) { // level 2: corner posts with a rope, and the Sunberry it grows
      for (const x of [-.43, .43]) for (const z of [-.43, .43]) { box(g, .1, .3, .1, lv >= 3 ? C.stoneD : C.wood, x, 0, z); ico(g, .055, lv >= 3 ? C.gold : C.cream, x, .33, z); }
      for (const z of [-.43, .43]) box(g, .8, .025, .025, C.cream, 0, .22, z); for (const x of [-.43, .43]) box(g, .025, .025, .8, C.cream, x, .22, 0);
      sun(0, 0, .4);
    }
    if (lv >= 3) { // level 3: stone edging, a trellis heavy with Sunberries
      for (const x of [-.43, .43]) box(g, .06, .8, .06, C.white, x, .3, -.43);
      box(g, .98, .06, .08, C.white, 0, 1.08, -.43); box(g, .86, .04, .04, C.white, 0, .8, -.43);
      for (const sd of [-1, 1]) box(g, .04, .5, .03, C.white, sd * .2, .56, -.43).rotation.z = sd * .5;
      vine(g, -.38, 1.16, -.43, 5, .19, 0); for (const x of [-.26, .02, .3]) { box(g, .012, .1, .012, C.leafD, x, .98, -.4); ico(g, .06, C.gold, x, .95, -.4); }
      sun(0, -.26, .26);
    }
  },
  kitchen(g, live, lv = 1) {
    const up = liftOf('kitchen', lv);
    box(g, 1.8, .14, 1.5, C.stoneD, 0, 0, -.15);
    box(g, 1.7, 1.0, 1.4, '#f7d9a8', 0, 0, -.15);
    for (const x of [-.83, .83]) box(g, .1, 1.0, .1, C.woodD, x, 0, .53);
    box(g, 1.86, .12, 1.56, C.woodD, 0, 1.0, -.15); box(g, 1.6, .1, 1.3, C.wood, 0, 1.12, -.15);
    for (let i = 0; i < 5; i++) { const o = box(g, .36, .06, .6, i % 2 ? C.white : C.red, -.72 + i * .36, .86, .78); o.rotation.x = .35; box(g, .36, .1, .03, i % 2 ? C.white : C.red, -.72 + i * .36, .7, 1.06); } // awning with a valance
    for (const x of [-.88, .88]) box(g, .05, .78, .05, C.woodD, x, 0, 1.02);
    const ch = .32, cz = .82, ct = ch + .05; // the counter is low and stands out to the front edge of the awning, so it shows from above
    box(g, 1.3, ch, .3, C.wood, 0, 0, cz); box(g, 1.38, .05, .38, C.cream, 0, ch, cz); // counter with a pale top
    for (const x of [-.43, 0, .43]) box(g, .03, ch - .04, .02, C.woodD, x, 0, cz + .155);
    cyl(g, .16, .13, .16, 6, C.stoneD, -.4, ct, cz); cyl(g, .17, .17, .03, 6, C.iron, -.4, ct + .16, cz); ico(g, .03, C.iron, -.4, ct + .21, cz); // the pot, lid on
    box(g, .3, .03, .2, C.woodD, .4, ct, cz); ico(g, .09, C.red, .35, ct + .09, cz); ico(g, .08, C.yellow, .5, ct + .08, cz + .04); box(g, .16, .06, .1, '#e8b877', .02, ct, cz + .02); // board, fruit, a loaf
    if (lv < 2) { box(g, .3, .6, .3, C.stone, .5, 1.1, -.5); box(g, .38, .08, .38, C.stoneD, .5, 1.7, -.5); }
    else { box(g, .34, .6 + up, .34, C.brick, .5, 1.1, -.5); box(g, .44, .08, .44, C.stoneD, .5, 1.7 + up, -.5); box(g, .22, .08, .22, C.iron, .5, 1.78 + up, -.5);
      for (const y of [1.36, 1.62 + up * .5, 1.5 + up]) { box(g, .2, .08, .02, C.brickD, .46, y, -.325); box(g, .02, .08, .2, C.brickD, .675, y - .1, -.5); } }
    for (const [w, d, x, z] of [[1.9, .06, 0, .63], [1.9, .06, 0, -.93], [.06, 1.56, .93, -.15], [.06, 1.56, -.93, -.15]]) box(g, w, .16, d, lv >= 3 ? C.gold : C.cream, x, .98, z); // a pale rim round the roof
    if (lv < 3) { box(g, .7, .14, .26, C.woodD, -.3, 1.22, -.62); for (let i = 0; i < 4; i++) ico(g, .09, i % 2 ? C.leafL : C.leaf, -.56 + i * .17, 1.4, -.62); ico(g, .04, C.red, -.3, 1.47, -.58); } // herbs growing up top
    else { box(g, .52, .1, .12, C.woodD, -.38, 1.34, -.04); for (let i = 0; i < 4; i++) ico(g, .07, i % 2 ? C.leafL : C.leaf, -.56 + i * .12, 1.47, -.02); ico(g, .035, C.red, -.38, 1.52, .02); for (const x of [-.58, -.18]) box(g, .04, .1, .1, C.woodD, x, 1.26, -.06); } // once the upper room is built they grow in its window box
    const pot = new THREE.Group(); pot.position.set(lv >= 3 ? -.5 : -.45, 1.22, lv >= 3 ? .36 : .1); g.add(pot);   // the big pot on the roof says what this is
    cyl(pot, .26, .2, .26, 8, lv >= 3 ? C.copper : C.slate); cyl(pot, .29, .29, .05, 8, lv >= 3 ? C.gold : C.stoneD, 0, .24); ico(pot, .06, C.red, 0, .34, 0);
    for (const x of [-.31, .31]) box(pot, .08, .05, .1, C.iron, x, .16);
    box(g, .5, .04, .1, C.wood, 0, .78, .56); for (const [x, c] of [[-.16, C.red], [0, C.yellow], [.16, C.leafL]]) cyl(g, .05, .05, .12, 6, c, x, .82, .56); // jars on a shelf
    const board = box(g, .3, .42, .03, C.iron, -.78, 0, 1.0); board.rotation.x = -.25; box(g, .22, .03, .01, C.white, -.78, .28, 1.06).rotation.x = -.25; box(g, .16, .03, .01, C.white, -.78, .2, 1.08).rotation.x = -.25; // menu board
    crate(g, .84, .98, .24); for (const [x, z] of [[.78, .94], [.9, 1.0], [.84, 1.04]]) ico(g, .06, C.red, x, .27, z);
    if (lv < 2) return;
    // level 2: a brick bread oven on the roof under a tall chimney, a pie on the counter, lights along the awning
    // the oven: a brick dome with a deep mouth, the fire set back inside it. Once the upper room is built it is a little smaller, so it fits in front of the room
    const og = grp(g, .5, 1.22, lv >= 3 ? .2 : -.02); if (lv >= 3) og.scale.setScalar(.8);
    const ov = ico(og, .36, C.brick, 0, 0, 0, 1); ov.scale.y = .85; box(og, .38, .3, .12, C.brickD, 0, 0, .31); box(og, .26, .2, .04, C.iron, 0, .02, .36); box(og, .44, .05, .16, C.brick, 0, .28, .31);
    put(og, G('Box', .18, .08, .03), MX('fire', '#ff9a3c', { emissive: '#ff7a1a', emissiveIntensity: .9 }), 0, .07, .385).userData.dyn = true; box(og, .3, .03, .1, C.stoneD, 0, 0, .42);
    cyl(g, .11, .09, .05, 8, '#e8b877', .02, ct + .05, cz + .02); cyl(g, .08, .08, .025, 8, C.gold, .02, ct + .095, cz + .02);
    for (let i = 0; i < 6; i++) ico(g, .045, [C.yellow, C.pink, C.teal][i % 3], -.75 + i * .3, .62 - (i % 2) * .03, 1.09);
    crate(g, -.94, .5, .22); for (const [x, z] of [[-.98, .46], [-.9, .54]]) ico(g, .06, C.gold, x, .25, z);
    for (const [x, y] of [[-.96, .0], [-1.06, .0], [-1.01, .09]]) { const l = cyl(g, .05, .05, .4, 6, C.wood, x, y, -.1); l.rotation.x = Math.PI / 2; l.position.y = y + .05; } // firewood for the oven, stacked clear of the wall
    if (lv < 3) return;
    // level 3: an upper room under a tiled roof, copper pots, a gold rim and a tonic sign
    box(g, 1.7, .62, .74, '#f7d9a8', 0, 1.22, -.48); for (const x of [-.83, .83]) for (const z of [-.83, -.13]) box(g, .08, .64, .08, C.woodD, x, 1.2, z);
    box(g, 1.76, .07, .8, C.woodD, 0, 1.8, -.48); put(g, gable(1.96, .5, .96), M(C.red), 0, 1.86, -.48); shingles(g, 1.96, .5, .96, 1.86, -.48, C.redD, 2);
    put(g, gable(1.5, .38, .04), M('#f7d9a8'), 0, 1.87, .0); box(g, .1, .06, 1.0, C.gold, 0, 2.33, -.48);
    box(g, .42, .34, .08, C.white, -.38, 1.46, -.1); box(g, .32, .26, .1, C.glass, -.38, 1.5, -.095); box(g, .03, .24, .04, C.white, -.38, 1.51, -.05); box(g, .3, .03, .04, C.white, -.38, 1.62, -.05);
    const sg = put(g, G('Cylinder', .17, .17, .08, 10), M(C.cream), 0, 2.04, .04); sg.rotation.x = Math.PI / 2; put(g, G('Torus', .17, .035, 4, 10), M(C.gold), 0, 2.04, .08);
    box(g, .1, .14, .05, C.teal, 0, 1.95, .09); box(g, .05, .07, .05, C.teal, 0, 2.09, .09); box(g, .06, .02, .055, C.woodD, 0, 2.16, .09);
    for (const [x, c] of [[-.56, C.copper], [-.3, C.copper], [.56, C.copper]]) { cyl(g, .07, .055, .09, 6, c, x, .6, 1.0); box(g, .012, .12, .012, C.iron, x, .69, 1.0); }
    for (let i = 0; i < 5; i++) box(g, .36, .035, .035, C.gold, -.72 + i * .36, .675, 1.075);
  },
  barn(g, live, lv = 1) {
    const up = liftOf('barn', lv), rf = grp(g, 0, up, 0), roof = lv >= 3 ? '#5d6b86' : '#7a4a3a', roofD = lv >= 3 ? '#45516b' : '#5f3a2e';
    box(g, 1.8, .12, 2.7, C.stoneD);
    box(g, 1.7, 1.2 + up, 2.6, '#c8553d');
    for (const x of [-.84, .84]) for (const z of [-1.29, 1.29]) box(g, .1, 1.2 + up, .1, C.white, x, 0, z); // white trim
    for (const z of [-.43, .43]) for (const sd of [-1, 1]) box(g, .03, 1.2 + up, .06, '#a8433c', sd * .86, 0, z); // board seams
    put(rf, gable(1.96, .8, 2.8), M(roof), 0, 1.2, 0); shingles(rf, 1.96, .8, 2.8, 1.2, 0, roofD);
    for (const sd of [-1, 1]) box(rf, .1, .07, 2.86, C.white, sd * .98, 1.18, 0);
    box(rf, .1, .08, 2.9, roofD, 0, 1.97, 0);
    put(rf, gable(1.5, .6, .04), M('#c8553d'), 0, 1.22, 1.41);
    box(g, .92, .98, .05, C.white, 0, 0, 1.3); box(g, .8, .84, .08, '#a8433c', 0, .12, 1.31);
    const a = box(g, 1.1, .08, .04, C.white, 0, .41, 1.36); a.rotation.z = .84; const b = box(g, 1.1, .08, .04, C.white, 0, .41, 1.36); b.rotation.z = -.84;
    box(rf, .42, .42, .04, C.white, 0, 1.34, 1.42); box(rf, .34, .34, .06, C.glass, 0, 1.38, 1.43); box(rf, .03, .32, .03, C.white, 0, 1.39, 1.46);
    box(rf, .08, .08, .5, C.woodD, 0, 1.82, 1.6); box(rf, .02, .26, .02, C.cream, 0, 1.56, 1.8); box(rf, .1, .08, .1, C.iron, 0, 1.5, 1.8); // hoist over the loft
    for (const sd of [-1, 1]) { box(g, .04, .36, .36, C.white, sd * .86, .5, 0); box(g, .05, .28, .28, C.glass, sd * .87, .54, 0); }
    const vc = lv >= 3 ? C.gold : C.iron;
    cyl(rf, .025, .025, .5, 5, C.iron, 0, 1.98, -.9); const v = box(rf, .4, .05, .03, vc, 0, 2.36, -.9); v.rotation.y = .6; cone(rf, .07, .14, 4, vc, .16, 2.31, -1.01).rotation.set(0, .6, -Math.PI / 2); ico(rf, .06, C.yellow, 0, 2.5, -.9); // weathervane
    box(g, .5, .4, .5, C.straw, 1.0, 0, 1.0); box(g, .52, .04, .52, '#d4b24f', 1.0, .13, 1.0); box(g, .52, .04, .52, '#d4b24f', 1.0, .27, 1.0); // hay bale with its ties
    box(g, .4, .3, .4, '#f0d67a', 1.02, .4, 1.02).rotation.y = .4;
    barrel(g, -1.0, 1.05, .9); crate(g, -1.02, .62, .3, 0, .2);
    const fork = box(g, .04, 1.0, .04, C.woodD, -.6, 0, 1.4); fork.rotation.z = .18; for (const x of [-.06, 0, .06]) box(g, .02, .2, .02, C.iron, -.76 + x, .94, 1.4).rotation.z = .18;
    if (lv < 2) return;
    // level 2: taller walls with a hay loft, a cupola on the ridge, more bales and a ladder
    box(g, 1.74, .07, 2.64, C.white, 0, 1.14, 0);
    { const hy = 1.24 + up - .4; // the hay loft: a hatch with a deep frame and its shutters swung open
      box(g, .46, .32, .06, roofD, 0, hy + .03, 1.31); for (const y of [0, .34]) box(g, .6, .06, .14, C.white, 0, hy + y, 1.35); for (const x of [-.27, .27]) box(g, .06, .4, .14, C.white, x, hy, 1.35); // the frame stands proud of the gable
      for (const sd of [-1, 1]) { box(g, .2, .34, .04, '#a8433c', sd * .41, hy + .03, 1.33); box(g, .18, .04, .05, C.white, sd * .41, hy + .18, 1.335); }
      box(g, .4, .16, .24, C.straw, 0, hy + .06, 1.38); box(g, .3, .1, .18, '#f0d67a', .04, hy + .2, 1.4); }
    for (const sd of [-1, 1]) for (const z of [-.8, .8]) { box(g, .04, .3, .3, C.white, sd * .86, 1.24 + up - .4, z); box(g, .05, .22, .22, C.glass, sd * .87, 1.28 + up - .4, z); }
    const cu = grp(rf, 0, 1.86, .15); if (lv >= 3) cu.scale.setScalar(1.3);
    box(cu, .46, .4, .46, '#c8553d'); for (const x of [-.22, .22]) for (const z of [-.22, .22]) box(cu, .07, .4, .07, C.white, x, 0, z);
    for (const [x, z] of [[0, .235], [0, -.235]]) box(cu, .24, .2, .03, C.glass, x, .16, z); for (const x of [-.235, .235]) box(cu, .03, .2, .24, C.glass, x, .16, 0);
    box(cu, .56, .05, .56, C.white, 0, .4); cone(cu, .42, .3, 4, roof, 0, .45).rotation.y = Math.PI / 4; ico(cu, .05, lv >= 3 ? C.gold : C.yellow, 0, .78, 0);
    box(g, .46, .36, .46, C.straw, 1.0, 0, .46); box(g, .48, .04, .48, '#d4b24f', 1.0, .16, .46); box(g, .4, .3, .4, '#f0d67a', 1.0, .36, .5).rotation.y = -.3;
    for (const z of [-.5, -.22]) box(g, .04, 1.5, .04, C.woodD, 1.0, 0, z).rotation.z = .2; for (let i = 0; i < 5; i++) box(g, .04, .03, .3, C.wood, 1.11 - i * .055, .2 + i * .27, -.36); // ladder
    if (lv < 3) return;
    // level 3: a stone ground floor, a slate roof, a gold weathervane, lamps and bunting by the door
    stoneBase(g, 1.84, 2.74, .5, 0, -.5, .5); box(g, .9, .05, .16, C.stoneD, 0, 0, 1.4); // the stone leaves the doorway open, with a sill in front
    bricks(g, [[-.72, .12, 1.35], [.74, .3, 1.35], [-.7, .34, 1.35], [.72, .1, 1.35]], C.stoneD);
    bricks(g, [[.9, .12, .5, Math.PI / 2], [.9, .3, -.3, Math.PI / 2], [.9, .14, -1.0, Math.PI / 2], [-.9, .28, .7, Math.PI / 2], [-.9, .12, -.1, Math.PI / 2], [-.9, .3, -.9, Math.PI / 2]], C.stoneD);
    for (const sd of [-1, 1]) { lantern(g, sd * .68, .72, 1.42, 1.2); box(g, .05, .05, .12, C.iron, sd * .68, .9, 1.38); } // lamps on brackets
    [C.pink, C.yellow, C.teal, C.lilac, C.yellow, C.pink, C.teal].forEach((c, i) => { cone(g, .07, .16, 3, c, -.6 + i * .2, 1.0 - Math.sin(i / 6 * Math.PI) * .0, 1.38).rotation.x = Math.PI; });
    box(g, 1.4, .025, .025, C.cream, 0, 1.15, 1.38);
    for (const sd of [-1, 1]) box(rf, .12, .05, 2.88, C.gold, sd * .98, 1.25, 0);
    barrel(g, -1.0, .55, .8); crate(g, -1.02, .64, .26, .3, -.3);
  },
  nest(g, live, lv = 1) {
    const t = put(g, G('Torus', .62, .22, 5, 8), M(C.woodD), 0, .2, 0); t.rotation.x = Math.PI / 2;
    const t2 = put(g, G('Torus', .6, .1, 4, 8), M(C.wood), 0, .36, 0); t2.rotation.set(Math.PI / 2, 0, .4); // a second woven ring
    cyl(g, .56, .5, .2, 8, C.straw, 0, .06); cyl(g, .4, .4, .03, 8, '#f6dd8a', 0, .25);
    box(g, .46, .03, .36, C.pink, -.1, .27, .06).rotation.y = .3; box(g, .4, .035, .08, C.white, -.1, .275, .06).rotation.y = .3; // a little blanket
    for (let i = 0; i < 7; i++) { const a = i * .9 + .2, o = box(g, .5, .06, .08, i % 2 ? C.wood : C.woodD, Math.cos(a) * .74, .26 + (i % 3) * .05, Math.sin(a) * .74); o.rotation.set(0, -a + 1.3 + (i % 2) * .5, (i % 2 ? .2 : -.15)); } // twigs poking out
    for (const [x, z, r] of [[.5, -.52, .6], [-.62, -.4, -.5], [.66, .3, 1.4]]) { const f = cone(g, .06, .3, 4, C.white, x, .42, z); f.scale.z = .35; f.rotation.set(.5, r, .5); } // feathers
    cone(g, .1, .22, 4, C.leafL, -.72, 0, -.6); cone(g, .1, .22, 4, C.leaf, .76, 0, -.5); cone(g, .09, .2, 4, C.leafL, .8, 0, .62);
    for (const [x, z, c] of [[-.86, .5, C.pink], [-.76, .68, C.white], [.5, .86, C.yellow], [-.3, -.9, C.lilac]]) { cyl(g, .015, .015, .14, 4, C.leafD, x, 0, z); put(g, G('Octahedron', .06, 0), M(c), x, .17, z).scale.y = .6; }
    box(g, .05, .5, .05, C.woodD, .84, 0, -.84); const h = put(g, G('Octahedron', .12, 0), M('#ff6f91'), .84, .58, -.84); h.scale.set(1.2, 1, .45); h.rotation.y = -.7; // a heart on a stake
    if (lv < 2) return;
    // level 2: a branch bent over the Nest with a lamp hanging from it, and a second blanket for the second egg
    const arch = (ry, c) => { const o = grp(g, 0, .12, 0); o.rotation.y = ry; put(o, G('Torus', .93, .055, 4, 10, Math.PI), M(c));
      for (const [a, col] of [[.35, C.leaf], [.8, C.leafL], [1.25, C.leaf], [1.9, C.leafL], [2.35, C.leaf], [2.8, C.leafL]]) ico(o, .1, col, Math.cos(a) * .93, Math.sin(a) * .93, .03);
      if (lv >= 3) for (const [a, col] of [[.58, C.pink], [1.05, C.white], [2.12, C.yellow], [2.58, C.pink]]) put(o, G('Octahedron', .075, 0), M(col), Math.cos(a) * .95, Math.sin(a) * .95, .08).scale.z = .6; };
    arch(.65, C.woodD);
    box(g, .012, .1, .012, C.iron, 0, .96, 0); lantern(g, 0, .82, 0, 1.0);
    box(g, .36, .04, .28, '#9fd0ff', .22, .285, -.16).rotation.y = -.5; box(g, .3, .045, .07, C.white, .22, .29, -.16).rotation.y = -.5;
    if (lv < 3) return;
    // level 3: a second branch in bloom, a gold band woven in, and warm stones that hurry the eggs along
    arch(-.65, C.wood); for (const [x, z, c] of [[0, .06, C.pink], [.08, -.05, C.leafL], [-.08, -.04, C.leaf]]) ico(g, .1, c, x, 1.1, z);
    const gr = put(g, G('Torus', .64, .05, 4, 8), M(C.gold), 0, .43, 0); gr.rotation.x = Math.PI / 2; gr.rotation.z = .2;
    for (const [x, z] of [[-.9, -.1], [.3, .92], [.2, -.94]]) { ico(g, .1, C.stoneD, x, .06, z); const o = put(g, G('Octahedron', .08, 0), MX('warm', '#ffb35a', { emissive: '#ff8a2a', emissiveIntensity: .9 }), x, .22, z); o.scale.y = 1.4; o.userData.dyn = true; }
    const h2 = put(g, G('Octahedron', .09, 0), M(C.gold), .84, .78, -.84); h2.scale.set(1.2, 1, .45); h2.rotation.y = -.7;
  },
  yard(g, live, lv = 1) {
    box(g, 2.76, .06, 1.76, C.sand);
    for (const x of [-1.34, 1.34]) for (const z of [-.84, .84]) box(g, .12, .4, .12, C.woodD, x, 0, z);
    if (!live) PARTS.yard(g);
    for (const z of [-.3, .3]) box(g, .1, .42, .1, C.white, .7, 0, z);
    box(g, .08, .08, .76, C.red, .7, .36);                       // hurdle
    ico(g, .16, C.stone, .1, .14, .6);
    for (const z of [-.84, .84]) for (const y of [.2, .34]) box(g, 2.68, .03, .03, C.cream, 0, y, z); // rope rails, open at the ends
    for (const x of [-.45, .45]) for (const z of [-.84, .84]) box(g, .1, .38, .1, C.woodD, x, 0, z);
    box(g, .04, .01, 1.5, C.white, -.2, .06, 0); box(g, 1.2, .01, .04, C.white, .4, .06, -.6); // chalk lines
    box(g, .06, .5, .06, C.woodD, 1.15, 0, -.55); const tg = put(g, G('Cylinder', .22, .22, .05, 10), M(C.white), 1.15, .62, -.52); tg.rotation.x = Math.PI / 2 - .2; const tg2 = put(g, G('Cylinder', .13, .13, .06, 10), M(C.red), 1.15, .62, -.505); tg2.rotation.x = Math.PI / 2 - .2; const tg3 = put(g, G('Cylinder', .05, .05, .07, 8), M(C.white), 1.15, .62, -.495); tg3.rotation.x = Math.PI / 2 - .2; // target
    cyl(g, .1, .08, .16, 8, C.teal, 1.2, .06, .6); cyl(g, .085, .085, .02, 8, C.water, 1.2, .21, .6); // water bucket
    const bar = cyl(g, .025, .025, .4, 6, C.iron, -.2, .06, .68); bar.rotation.z = Math.PI / 2; bar.position.y = .15; for (const x of [-.4, 0]) { const wt = put(g, G('Cylinder', .09, .09, .07, 8), M(C.slate), x, .15, .68); wt.rotation.z = Math.PI / 2; } // a weight to lift
    if (lv < 2) return;
    // level 2: flags on the corners, a punch bag and a score board
    [[-1.34, -.84, C.red], [-1.34, .84, C.yellow], [1.34, -.84, C.teal], [1.34, .84, C.pink]].forEach(([x, z, c]) => { if (lv < 3) pennant(g, x, .4, z, c, .56); });
    box(g, .08, 1.0, .08, C.woodD, -1.22, 0, .56); box(g, .46, .07, .07, C.woodD, -1.03, .96, .56); box(g, .02, .14, .02, C.cream, -.86, .82, .56);
    cyl(g, .11, .11, .42, 8, C.red, -.86, .4, .56); for (const y of [.48, .7]) cyl(g, .115, .115, .04, 8, C.white, -.86, y, .56);
    for (const x of [-.85, -.25]) box(g, .05, .78, .05, C.woodD, x, 0, -.88); box(g, .7, .42, .04, C.iron, -.55, .44, -.88); box(g, .76, .05, .06, C.wood, -.55, .86, -.88);
    for (const [x, h] of [[-.76, .2], [-.7, .2], [-.64, .2], [-.58, .2], [-.4, .14], [-.34, .14]]) box(g, .025, h, .01, C.white, x, .56, -.855); box(g, .3, .025, .01, C.white, -.67, .64, -.853).rotation.z = .5;
    if (lv < 3) return;
    // level 3: a stone kerb, fire bowls, a banner arch at the way in and a trophy
    for (const z of [-.95, .95]) box(g, 2.98, .1, .14, C.stone, 0, 0, z); for (const x of [-1.46, 1.46]) for (const z of [-.6, .6]) box(g, .14, .1, .62, C.stone, x, 0, z);
    for (const z of [-.84, .84]) { box(g, .1, .34, .1, C.woodD, -1.34, .4, z); cyl(g, .16, .09, .1, 6, C.iron, -1.34, .74, z);
      const f = put(g, G('Cone', .1, .26, 5), MX('fire', '#ff9a3c', { emissive: '#ff7a1a', emissiveIntensity: .9 }), -1.34, .95, z); f.userData.dyn = true;
      box(g, .1, 1.0, .1, C.woodD, 1.34, .4, z); ico(g, .07, C.gold, 1.34, 1.44, z); }
    box(g, .12, .1, 1.86, C.wood, 1.34, 1.24, 0); [C.red, C.yellow, C.teal, C.pink, C.yellow, C.red].forEach((c, i) => { const t = cone(g, .07, .16, 3, c, 1.34, 1.08, -.6 + i * .24); t.rotation.x = Math.PI; });
    const sh = put(g, G('Cylinder', .16, .16, .05, 6), M(C.gold), 1.4, 1.3, 0); sh.rotation.z = Math.PI / 2; put(g, G('Octahedron', .08, 0), M(C.red), 1.43, 1.3, 0).scale.x = .4;
    for (const x of [-.45, .45]) for (const z of [-.84, .84]) ico(g, .06, C.gold, x, .41, z);
    box(g, .22, .26, .22, C.stone, -1.14, .06, -.62); box(g, .28, .05, .28, C.stoneD, -1.14, .32, -.62); cyl(g, .035, .06, .06, 6, C.gold, -1.14, .37, -.62); cyl(g, .09, .05, .12, 6, C.gold, -1.14, .43, -.62); for (const sd of [-1, 1]) box(g, .03, .06, .03, C.gold, -1.14 + sd * .1, .46, -.62);
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
  workshop(g, live, lv = 1) {
    box(g, 1.8, .12, 1.6, C.stoneD, 0, 0, -.1);
    box(g, 1.7, 1.0, 1.5, '#b9a089', 0, 0, -.1);
    for (const x of [-.83, .83]) box(g, .1, 1.05, .1, C.woodD, x, 0, .63);
    for (const y of [.3, .62]) box(g, 1.6, .03, .02, '#a38b74', 0, y, .655); // plank lines
    put(g, wedgeGeo(1.7, .65, -.85, .05, .39), M('#b9a089'), 0, 1.0, 0); // the walls rise to meet the sloping roof, so there is no gap under it at the back
    const r = box(g, 1.94, .12, 1.84, C.slate, 0, 1.2, -.1); r.rotation.x = .22; const r2 = box(g, 1.98, .06, .14, '#566472', 0, 1.02, .8); r2.rotation.x = .22;
    for (const x of [-.6, 0, .6]) { const o = box(g, .04, .05, 1.84, '#566472', x, 1.29, -.1); o.rotation.x = .22; }
    cyl(g, .1, .1, .7, 6, C.iron, -.55, 1.2, -.5); cyl(g, .14, .14, .06, 6, C.iron, -.55, 1.9, -.5); // stove pipe
    box(g, .58, .78, .05, C.woodD, -.4, 0, .655); box(g, .5, .64, .08, '#9a6a44', -.4, .12, .66); box(g, .52, .05, .09, C.iron, -.4, .2, .665); box(g, .52, .05, .09, C.iron, -.4, .5, .665); ico(g, .04, C.yellow, -.22, .36, .72);
    box(g, .48, .44, .05, C.woodD, .45, .38, .655); box(g, .4, .36, .08, C.glass, .45, .42, .66); box(g, .03, .34, .03, C.woodD, .45, .43, .7);
    gearAt(g, .38, lv >= 3 ? 1.66 : 1.56, .1, lv >= 3 ? 1.9 : 1.5, lv >= 3 ? C.gold : C.yellow); box(g, .12, lv >= 3 ? .26 : .2, .1, C.iron, .38, 1.2, .1); // a big gear on the roof says what this is
    box(g, .7, .3, .36, C.wood, .5, 0, .98); box(g, .76, .04, .4, C.woodD, .5, .28, .98); box(g, .3, .12, .2, C.stoneD, .5, .3, .98); box(g, .16, .06, .14, C.stoneD, .5, .25, .98); // bench and anvil
    box(g, .04, .34, .03, C.woodD, .8, .5, .665); box(g, .14, .1, .05, C.iron, .8, .82, .67);     // tools hung on the wall
    box(g, .03, .3, .03, C.woodD, .1, .5, .665); box(g, .2, .12, .02, C.stone, .1, .76, .675);
    for (const [x, y] of [[-.9, 0], [-.76, 0], [-.83, .1]]) { const l = cyl(g, .06, .06, .4, 6, C.wood, x, y, .98); l.rotation.x = Math.PI / 2; l.position.y = y + .06; put(g, G('Cylinder', .045, .045, .41, 6), M(C.cream), x, y + .06, .98).rotation.x = Math.PI / 2; } // log pile
    const wh = put(g, G('Cylinder', .16, .16, .07, 10), M(C.stone), .92, .22, .2); wh.rotation.z = Math.PI / 2; box(g, .06, .22, .3, C.woodD, .92, 0, .2); // grindstone
    if (lv < 2) return;
    // level 2: a second gear, a taller stove pipe with a cap, a shop sign, paint pots and planks ready to use
    gearAt(g, lv >= 3 ? .98 : .88, lv >= 3 ? 1.38 : 1.34, .16, .95, C.stone).rotation.z = .4;
    cyl(g, .1, .1, .44, 6, C.iron, -.55, 1.9, -.5); cone(g, .2, .16, 6, C.iron, -.55, 2.4, -.5); for (const x of [-.63, -.47]) box(g, .02, .1, .02, C.iron, x, 2.32, -.5);
    for (const x of [-.46, -.1]) box(g, .05, .16, .05, C.woodD, x, 1.0, .84); // a shop sign standing on the eave, clear of the door
    box(g, .5, .3, .05, C.woodD, -.28, 1.12, .84); box(g, .42, .22, .05, C.cream, -.28, 1.16, .87);
    box(g, .035, .15, .04, C.woodD, -.28, 1.19, .9).rotation.z = .5; box(g, .11, .07, .05, C.iron, -.33, 1.3, .9).rotation.z = .5;
    lantern(g, -.05, .64, .68, 1.1);
    [[-.02, .92, C.pink], [.12, .9, C.teal], [.05, 1.05, C.yellow]].forEach(([x, z, c]) => { cyl(g, .065, .065, .12, 6, C.slate, x, 0, z); cyl(g, .055, .055, .02, 6, c, x, .115, z); });
    for (let i = 0; i < 3; i++) box(g, .05, 1.0, .2, i % 2 ? C.wood : '#c99763', .99, 0, -.2 - i * .23).rotation.z = .16;
    if (lv < 3) return;
    // level 3: a lit upper room, a brass gear, a copper boiler, a crane and a stone base
    stoneBase(g, 1.86, 1.66, .34, -.1, -.72, -.08); box(g, .6, .05, .18, C.stoneD, -.4, 0, .8); bricks(g, [[.16, .1, .735], [.34, .22, .735], [.76, .08, .735]], C.stoneD); // the stone leaves the doorway open
    box(g, .84, .56, .6, '#b9a089', -.02, 1.24, -.5); put(g, wedgeGeo(.84, -.2, -.8, .02, .15), M('#b9a089'), -.02, 1.8, 0); for (const x of [-.44, .4]) box(g, .07, .6, .07, C.woodD, x, 1.22, -.21);
    for (const x of [-.22, .18]) { box(g, .28, .28, .08, C.woodD, x, 1.5, -.19); box(g, .2, .2, .1, C.glass, x, 1.54, -.185); box(g, .32, .04, .12, C.woodD, x, 1.47, -.17); }
    const r3 = box(g, 1.0, .08, .8, C.slate, -.02, 1.86, -.5); r3.rotation.x = .22; const e3 = box(g, 1.04, .05, .1, '#566472', -.02, 1.78, -.1); e3.rotation.x = .22;
    cyl(g, .19, .19, .42, 8, C.copper, .64, 1.28, -.55); ico(g, .19, C.copper, .64, 1.7, -.55, 1); for (const y of [1.36, 1.6]) cyl(g, .2, .2, .04, 8, C.goldD, .64, y, -.55); cyl(g, .035, .035, .3, 6, C.copper, .64, 1.82, -.55);
    for (const y of [2.02, 2.2]) cyl(g, .115, .115, .05, 6, C.copper, -.55, y, -.5);
    box(g, .08, .72, .08, C.woodD, -.74, 1.14, .34); box(g, .07, .07, .9, C.woodD, -.74, 1.84, .7); const br = box(g, .05, .44, .05, C.woodD, -.74, 1.5, .5); br.rotation.x = -.75;
    box(g, .02, .44, .02, C.cream, -.74, 1.4, 1.1); crate(g, -.74, 1.1, .24, 1.16, .3);
  },
  fence(g, live, lv, link = 0) { // link: which sides join a neighbour, see fenceLink below
    const nb = link & 15, own = link >> 4 & 15, arch = link >> 8 & 15, ones = [0, 1, 2, 3].filter(d => nb >> d & 1).length;
    const arms = ones === 0 ? 5 : ones === 1 ? nb | (nb << 2 | nb >> 2) & 15 : nb; // a lone piece runs along its own x; an end piece carries its neighbour's line on
    const post = (x, z) => { box(g, .12, .5, .12, C.wood, x, 0, z); cone(g, .09, .1, 4, C.wood, x, .5, z); box(g, .14, .04, .14, C.woodD, x, .44, z); };
    for (let d = 0; d < 4; d++) {
      if (!(arms >> d & 1)) continue;
      const dx = [1, 0, -1, 0][d], dz = [0, 1, 0, -1][d], len = arch >> d & 1 ? .56 : .5, along = d % 2 === 0; // into an arch the rails reach its post
      for (const y of [.34, .14]) box(g, along ? len : .06, .08, along ? .06 : len, C.cream, dx * len / 2, y, dz * len / 2);
      for (const t of [.125, .325]) { const x = dx * t + (along ? 0 : .03), z = dz * t + (along ? .03 : 0); box(g, along ? .08 : .04, .42, along ? .04 : .08, C.cream, x, .04, z); cone(g, .056, .07, 4, C.cream, x, .46, z).rotation.y = Math.PI / 4; }
      if (!(nb >> d & 1) || own >> d & 1) post(dx * .5, dz * .5); // an open end gets a post; a post shared with a neighbour is drawn by one of the two
    }
    if (arms !== 5 && arms !== 10) post(0, 0); // corners, T and cross pieces stand on a post of their own
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
    for (const x of [-.11, .11]) for (const z of [-.11, .11]) box(g, .025, .29, .025, C.iron, x, 1.1, z);
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
    for (const x of [-.34, .34]) { box(g, .08, .28, .3, C.woodD, x); box(g, .07, .7, .06, C.woodD, x, 0, -.18); box(g, .08, .05, .3, C.woodD, x, .43, -.02); }
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
    box(g, .26, .4, .04, C.white, 0, .1, .385); box(g, .2, .34, .06, C.woodD, 0, .11, .39); ico(g, .025, C.yellow, .06, .26, .43);
    box(g, .22, .22, .04, C.white, 0, .77, .325); box(g, .16, .16, .06, C.glass, 0, .8, .33);
    for (const sd of [-1, 1]) box(g, .05, .18, .04, C.teal, sd * .13, .79, .335);
    box(g, .2, .15, .16, C.cream, .36, 0, .3).rotation.y = .4; box(g, .2, .12, .16, C.cream, .34, .14, .26).rotation.y = -.2; // flour sacks
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
  // Level 2 adds sisal bands, a step, a second leg, a toy mouse on a string and a basket bed on top. Level 3 grows taller:
  // a hammock round the back, the basket moves to a shelf and a little hideout with a pointed roof sits on top.
  // The spots pets use are in TOWER and ROUTES.tower above: keep the two in step.
  tower(g, live, lv) {
    const up = lv >= 3 ? TOWER.up : 0, sisal = '#c9a544';
    cyl(g, .4, .44, .1, 6, C.woodD); cyl(g, .09, .09, 1.3 + up, 6, C.straw, 0, .1);
    cyl(g, .32, .32, .08, 6, C.lilac, .12, .6);
    box(g, .3, .22, .3, C.wood, .2, .1, .2);
    if (lv < 2) { cyl(g, .28, .28, .08, 6, C.pink, -.08, 1.36); ico(g, .07, C.yellow, -.3, .9, .1); box(g, .012, .4, .012, C.cream, -.3, .96, .1); return; }
    for (const y of [.22, .42, .82, 1.02, 1.22, ...(lv >= 3 ? [1.44, 1.64] : [])]) cyl(g, .097, .097, .03, 6, sisal, 0, y); // rope wound round the post
    put(g, G('Cylinder', .075, .075, .04, 8), M('#5a3a2e'), .2, .2, .35).rotation.x = Math.PI / 2; box(g, .32, .03, .32, C.woodD, .2, .32, .2); // the den at the foot has a round door
    cyl(g, .045, .045, .5, 6, C.straw, .36, .1, -.14); cyl(g, .05, .05, .03, 6, sisal, .36, .3, -.14); // a second leg under the platform
    const [sx, sy, sz] = TOWER.step; cyl(g, .035, .035, sy - .16, 6, C.woodD, sx, .1, sz); cyl(g, .15, .15, .06, 6, C.lilac, sx, sy - .06, sz); cyl(g, .155, .155, .02, 6, C.cream, sx, sy - .01, sz);
    if (!live) PARTS.towerToy(g);
    const bed = (x, y, z, r) => { cyl(g, r, r * .86, .12, 8, '#c99763', x, y, z); put(g, G('Torus', r * .92, .045, 4, 10), M(C.woodD), x, y + .12, z).rotation.x = Math.PI / 2; cyl(g, r * .82, r * .82, .05, 8, C.pink, x, y + .04, z); };
    if (lv < 3) { cyl(g, .3, .3, .05, 6, C.woodD, -.08, 1.31); bed(-.08, 1.36, 0, .3); return; }
    // level 3: the basket on a shelf, a hammock between the post and a new back leg, and the hideout on top
    const [bx, by, bz] = TOWER.basket; box(g, .06, .06, .2, C.woodD, bx - .16, by - .1, bz).rotation.z = -.7; cyl(g, .26, .26, .05, 6, C.woodD, bx, by - .05, bz); bed(bx, by, bz, .26);
    const H = TOWER.hammock, hx = H.x * 2, hz = H.z * 2; cyl(g, .045, .05, H.y + .1, 6, C.woodD, hx, 0, hz); ico(g, .06, C.gold, hx, H.y + .14, hz); cyl(g, .1, .1, .03, 6, sisal, 0, H.y - .02, 0);
    if (!live) PARTS.towerHammock(g);
    const ty = 1.36 + up; cyl(g, .44, .44, .08, 6, C.lilac, -.02, ty); cyl(g, .45, .45, .02, 6, C.gold, -.02, ty + .05);
    const hut = grp(g, -.02, ty + .08, -.02), W = .72, D = .62, Hh = .62, t = .06, dw = .42, dh = .48;
    box(hut, W, Hh, t, C.cream, 0, 0, -D / 2 + t / 2); for (const s of [-1, 1]) box(hut, t, Hh, D, C.cream, s * (W / 2 - t / 2), 0, 0);
    for (const s of [-1, 1]) box(hut, (W - dw) / 2, Hh, t, C.cream, s * (W + dw) / 4, 0, D / 2 - t / 2);
    box(hut, dw, Hh - dh, t, C.cream, 0, dh, D / 2 - t / 2);
    for (const s of [-1, 1]) box(hut, .05, dh + .03, t + .06, C.wood, s * (dw / 2 + .02), 0, D / 2 - t / 2); box(hut, dw + .1, .06, t + .06, C.wood, 0, dh - .01, D / 2 - t / 2); // a door frame with depth
    for (const s of [-1, 1]) { put(hut, G('Cylinder', .07, .07, t + .02, 8), M(C.glass), s * (W / 2 - t / 2), .26, 0).rotation.z = Math.PI / 2; put(hut, G('Torus', .075, .02, 4, 8), M(C.gold), s * (W / 2 + .005), .26, 0).rotation.y = Math.PI / 2; } // round side windows
    const roof = put(hut, G('Cone', .6, .36, 4), M(C.blue), 0, Hh + .18, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = .9;
    box(hut, W + .08, .04, D + .08, C.blueD, 0, Hh - .02, 0); ico(hut, .05, C.gold, 0, Hh + .38, 0); pennant(hut, 0, Hh + .36, 0, C.pink, .3, .7);
  },
  cherry(g) {
    cyl(g, .07, .1, .5, 5, C.woodD); ico(g, .32, C.pink, 0, .78, 0); ico(g, .22, '#ffc2d4', .2, .62, .12); ico(g, .2, '#ffc2d4', -.2, .66, -.1);
  },
  well(g) {
    cyl(g, .42, .44, .08, 8, C.stoneD); cyl(g, .38, .4, .4, 8, C.stone); cyl(g, .41, .41, .06, 8, C.stoneD, 0, .36); cyl(g, .3, .3, .435, 8, C.water);
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
    box(g, .2, .29, .04, C.woodD, 0, 1.19, .41); ico(g, .5, C.leaf, -.6, 1.7, -.4); ico(g, .45, C.leafD, .6, 1.9, -.3); ico(g, .4, C.leafL, 0, 2.3, -.2);
    for (let i = 0; i < 5; i++) box(g, .3, .04, .05, C.wood, 0, .15 + i * .2, .62); for (const x of [-.14, .14]) box(g, .04, 1.1, .04, C.woodD, x, 0, .62);
  },
  palbench(g) {
    box(g, .9, .08, .4, C.pink, 0, .3); box(g, .9, .4, .07, C.pink, 0, .38, -.17);
    for (const x of [-.38, .38]) box(g, .08, .3, .36, C.woodD, x);
    put(g, G('Octahedron', .1, 0), M(C.red), 0, .95, -.17).scale.set(1.2, 1, .5);
  },
  palflag(g) {
    for (const x of [-.2, .2]) cyl(g, .025, .025, .9, 5, C.woodD, x);
    [C.pink, C.yellow, C.lilac, C.leafL].forEach((c, i) => { const t = cone(g, .055, .14, 3, c, -.15 + i * .1, .66); t.rotation.x = Math.PI; });
    box(g, .42, .02, .02, C.cream, 0, .86);
  },
  ball(g) { ico(g, .22, C.red, 0, .22, 0, 1); put(g, G('Cylinder', .224, .224, .07, 10), M(C.white), 0, .22, 0); },
  // ----- the lucky set: prizes of the Lucky Wheel -----
  clover(g) {
    for (const [x, z, s, c] of [[-.08, .02, 1, C.leaf], [.1, -.06, .8, C.leafL], [.03, .12, .7, C.leafD]]) { const o = grp(g, x, 0, z); o.scale.setScalar(s); cyl(o, .012, .012, .16, 4, C.leafD);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + x * 9, l = put(o, G('Cylinder', .07, .07, .02, 6), M(c), Math.cos(a) * .07, .17, Math.sin(a) * .07); l.rotation.x = .25 * Math.sin(a); l.rotation.z = -.25 * Math.cos(a); } }
    put(g, G('Octahedron', .035, 0), GOLDM(), -.08, .24, .02);
    g.scale.setScalar(1.7);
  },
  carousel(g, live) {
    // a two-step stone plinth with a gold lip; the platform, column and roof turn (PARTS.carousel)
    cyl(g, .96, 1.0, .1, 12, C.stoneD); cyl(g, .9, .92, .08, 12, C.stone, 0, .1); cyl(g, .93, .93, .03, 12, C.gold, 0, .17);
    if (!live) PARTS.carousel(g);
  },
  chest(g) {
    box(g, .4, .2, .28, C.wood, 0, 0, 0); for (const x of [-.16, .16]) box(g, .05, .22, .3, C.goldD, x, 0, 0);
    const lid = grp(g, 0, .2, -.14); lid.rotation.x = -.9; box(lid, .4, .1, .28, C.woodD, 0, 0, .14); for (const x of [-.16, .16]) box(lid, .05, .12, .3, C.goldD, x, -.01, .14);
    for (const [x, y, z] of [[-.09, .2, .02], [.06, .21, -.02], [0, .24, .05], [.11, .2, .07], [-.05, .23, -.06]]) put(g, G('Cylinder', .05, .05, .02, 6), GOLDM(), x, y, z).rotation.x = x * 6;
    put(g, G('Octahedron', .05, 0), MX('gemR', '#e8615a', { emissive: '#b8433c', emissiveIntensity: .5 }), .02, .3, 0); box(g, .07, .08, .03, C.gold, 0, .1, .145);
  },
  goldpet(g) {
    box(g, .7, .14, .7, C.stoneD); box(g, .56, .16, .56, C.stone, 0, .14); box(g, .3, .08, .02, C.gold, 0, .18, .285);
    const m = GOLDM(); put(g, G('Icosahedron', .25, 1), m, 0, .56, 0).scale.set(1, .95, 1.1); put(g, G('Icosahedron', .19, 1), m, 0, .92, .06);
    for (const x of [-.11, .11]) { put(g, G('Cone', .07, .2, 4), m, x, 1.12, .04); put(g, G('Icosahedron', .07, 0), m, x * 1.2, .34, .2); }
    const tail = put(g, G('Cone', .06, .3, 4), m, 0, .6, -.3); tail.rotation.x = -.9;
  },
  balloon(g, live) {
    cyl(g, .2, .24, .1, 6, C.stoneD); box(g, .1, .1, .1, C.iron, 0, .1); // the weight it is tied to
    if (!live) PARTS.balloon(g);
  },
  coinfount(g, live) {
    cyl(g, .92, .96, .28, 8, C.stone); cyl(g, .95, .95, .06, 8, C.gold, 0, .26); cyl(g, .8, .8, .335, 8, C.water); // the water stands a hair over the rim, so the rim's top never hides it
    cyl(g, .16, .22, .7, 6, C.stoneD, 0, .3); cyl(g, .44, .28, .12, 8, C.gold, 0, .95); cyl(g, .36, .36, .14, 8, C.water, 0, .97);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .3 + (i % 3) * .2; put(g, G('Cylinder', .06, .06, .02, 6), GOLDM(), Math.cos(a) * r, .34, Math.sin(a) * r).rotation.y = a; }
    if (!live) PARTS.coinfount(g);
  },
  horseshoe(g) {
    for (const x of [-.4, .4]) { box(g, .12, .9, .12, C.woodD, x, 0); cyl(g, .1, .12, .08, 6, C.stoneD, x, 0); }
    const u = put(g, G('Torus', .4, .08, 4, 10, Math.PI), GOLDM(), 0, .9, 0); u.scale.y = 1.1;
    for (let i = 0; i < 5; i++) { const a = (i + .5) / 5 * Math.PI; put(g, G('Box', .05, .05, .2), M(C.iron), Math.cos(a) * .4, .9 + Math.sin(a) * .44, 0); }
    for (const x of [-.4, .4]) ico(g, .08, C.leaf, x, .5, .08); ico(g, .05, C.pink, -.36, .56, .12); ico(g, .05, C.yellow, .44, .44, .12);
  },
  miniwheel(g, live) {
    box(g, .7, .08, .4, C.woodD); for (const x of [-.22, .22]) { const l = box(g, .07, .86, .07, C.wood, x, .06, -.06); l.rotation.z = x * 1.1; }
    put(g, G('Cylinder', .4, .4, .05, 12), M(C.gold), 0, .78, -.02).rotation.x = Math.PI / 2; put(g, G('Cone', .07, .16, 4), M(C.red), 0, 1.22, .04).rotation.z = Math.PI;
    if (!live) PARTS.miniwheel(g);
  },
  // The Farm Journal set (journal.js): one decoration for each chapter. (jvane is the Prize Pumpkin and jscope the
  // Star Globe: their ids are older than their looks, which changed so they do not repeat the Stamp set's vane and telescope.)
  jsign(g) { // a wooden welcome sign: a little crest with a heart, a painted pet face, a hanging plank and a flower box
    for (const x of [-.38, .38]) { cyl(g, .07, .08, .06, 6, C.stoneD, x, 0, 0); box(g, .08, .7, .08, C.woodD, x, .04, 0); cone(g, .07, .08, 4, C.woodD, x, .74, 0).rotation.y = Math.PI / 4; }
    box(g, .86, .34, .06, C.wood, 0, .3, 0); box(g, .9, .045, .085, C.woodD, 0, .62, 0); box(g, .9, .045, .085, C.woodD, 0, .275, 0);
    put(g, gable(.36, .14, .05), M(C.wood), 0, .64, 0); ico(g, .035, C.pink, -.025, .72, .03); ico(g, .035, C.pink, .025, .72, .03); put(g, G('Octahedron', .036, 0), M(C.pink), 0, .69, .03); // the heart
    box(g, .5, .05, .02, C.cream, -.12, .52, .04); box(g, .34, .05, .02, C.cream, -.2, .42, .04); box(g, .18, .04, .02, C.cream, -.28, .34, .04); // the painted words
    ico(g, .08, C.cream, .26, .45, .04).scale.z = .35; for (const s of [-1, 1]) cone(g, .03, .06, 3, C.cream, .26 + s * .05, .52, .04); // a painted pet face
    for (const s of [-1, 1]) ico(g, .012, C.iron, .26 + s * .03, .46, .07); ico(g, .012, C.pink, .26, .43, .07);
    for (const x of [-.2, .2]) box(g, .012, .1, .012, C.iron, x, .2, 0); box(g, .5, .08, .04, C.cream, 0, .15, 0); for (const x of [-.15, 0, .15]) ico(g, .018, C.red, x, .19, .025); // a plank on strings
    box(g, .62, .1, .14, C.woodD, 0, 0, .16); box(g, .58, .02, .12, C.soil, 0, .1, .16);
    for (const [x, c] of [[-.24, C.pink], [-.12, C.yellow], [0, C.lilac], [.12, C.pink], [.24, C.yellow]]) { ico(g, .05, C.leaf, x, .13, .16); ico(g, .038, c, x + .01, .18, .19); }
  },
  jboard(g) { // a village notice board under a little roof: notes, a pet drawing, a lantern and a shelf of pins
    for (const x of [-.38, .38]) { cyl(g, .07, .08, .06, 6, C.stoneD, x, 0, -.02); box(g, .07, .95, .07, C.woodD, x, .04, -.02); }
    box(g, .7, .46, .05, '#c99763', 0, .38, 0); box(g, .78, .04, .07, C.woodD, 0, .36, .005); box(g, .78, .04, .07, C.woodD, 0, .84, .005);
    for (const s of [-1, 1]) { const b = box(g, .05, .5, .03, C.woodD, 0, .37, -.04); b.rotation.z = s * .72; } // a cross brace at the back
    put(g, gable(.92, .18, .3), M(C.red), 0, .95, -.02); shingles(g, .92, .18, .33, .95, -.02, C.redD, 1); ico(g, .035, C.gold, 0, 1.14, -.02);
    const notes = [[-.2, .66, C.white, .2, .16, .1], [.06, .7, C.yellow, .16, .14, -.12], [.22, .56, C.pink, .16, .18, .08], [-.14, .48, '#bfe6fb', .22, .14, -.05]];
    for (const [x, y, c, w, h, r] of notes) { const n = box(g, w, h, .015, c, x, y - h / 2, .03); n.rotation.z = r; ico(g, .016, C.red, x, y - .02, .045); }
    for (const [x, y, w] of [[-.22, .6, .12], [-.22, .57, .09], [.06, .64, .1], [.22, .5, .1], [.22, .47, .07]]) box(g, w, .012, .01, C.slate, x, y, .045); // writing on the notes
    ico(g, .04, C.straw, -.14, .43, .045); for (const x of [-.165, -.115]) cone(g, .016, .04, 3, C.straw, x, .45, .045); // the pet drawing
    box(g, .1, .06, .01, C.white, .07, .43, .045); const v = box(g, .07, .01, .012, C.redD, .07, .465, .054); v.rotation.z = .5; // an envelope
    box(g, .6, .03, .1, C.woodD, 0, .14, .03); cyl(g, .03, .03, .07, 6, '#bfe6fb', -.18, .17, .04); ico(g, .03, C.cream, .14, .19, .04).scale.x = 2.2; // a shelf with a jar of pins and a rolled-up note
    box(g, .16, .025, .025, C.iron, .5, .74, -.02); box(g, .012, .08, .012, C.iron, .56, .66, -.02); lantern(g, .56, .5, -.02, .9);
  },
  jpost(g) { // a signpost on a mound of stones: arrows tipped in each island's colour, a birdhouse on top, a lantern
    for (const [x, z, r] of [[0, 0, .14], [.1, .08, .07], [-.1, .06, .06], [.06, -.1, .06]]) ico(g, r, C.stoneD, x, .03, z);
    box(g, .07, 1.2, .07, C.woodD, 0, .05);
    const arms = [[.92, '#5fb04a', 1, .1], [.78, '#2f86cc', -1, 1.2], [.64, '#8a7f76', 1, 2.3], [.5, '#e0592f', -1, -.8]];
    for (const [y, c, d, r] of arms) { const a = grp(g, 0, y, 0); a.rotation.y = r; box(a, .34, .1, .03, C.wood, d * .21, 0, .045); put(a, G('Cone', .07, .1, 3), M(c), d * .42, .05, .045).rotation.z = -d * Math.PI / 2; box(a, .2, .025, .01, C.cream, d * .19, .05, .063); }
    box(g, .2, .16, .18, C.cream, 0, 1.24, 0); put(g, gable(.26, .1, .22), M(C.red), 0, 1.4, 0); cyl(g, .035, .035, .01, 8, C.iron, 0, 1.33, .093).rotation.x = Math.PI / 2; box(g, .012, .012, .06, C.woodD, 0, 1.28, .11); // the birdhouse
    box(g, .2, .025, .025, C.iron, .1, 1.05, 0); box(g, .012, .06, .012, C.iron, .19, .99, 0); lantern(g, .19, .84, 0, .8);
    for (const [x, z, c] of [[.15, .14, C.yellow], [-.16, .12, C.pink], [.18, -.06, C.lilac]]) { ico(g, .05, C.leaf, x, .05, z); ico(g, .03, c, x, .1, z + .02); }
  },
  jcradle(g, live) { // a woven basket on rockers, with a handle, a bow and a spotted egg
    for (const z of [-.1, .1]) { const r = put(g, G('Torus', .22, .03, 4, 12, Math.PI), M(C.woodD), 0, .22, z); r.rotation.z = Math.PI; for (const s of [-1, 1]) ico(g, .04, C.woodD, s * .22, .22, z); }
    box(g, .04, .03, .24, C.woodD, 0, .015, 0);
    if (!live) PARTS.jcradle(g);
  },
  jtable(g) { // a round table under a pink cloth: teapot, cups on saucers, cookies, a vase of flowers and two cushioned stools
    cyl(g, .07, .1, .48, 6, C.woodD); cyl(g, .2, .2, .04, 8, C.woodD, 0, 0); cyl(g, .38, .38, .05, 10, C.wood, 0, .47);
    cyl(g, .42, .42, .02, 10, C.white, 0, .52); cyl(g, .43, .44, .08, 10, C.pink, 0, .45); // the cloth and its hanging edge
    for (const [x, z, c] of [[-.4, .26, C.pink], [.4, -.22, '#7fc6e8']]) { cyl(g, .05, .06, .26, 6, C.woodD, x, 0, z); cyl(g, .13, .13, .05, 8, C.wood, x, .24, z); cyl(g, .11, .12, .05, 8, c, x, .29, z); }
    const pot = grp(g, -.06, .54, -.08); ico(pot, .085, C.white, 0, .07, 0, 1).scale.y = .9; cyl(pot, .04, .05, .03, 8, C.white, 0, .14, 0); ico(pot, .02, C.pink, 0, .18, 0);
    put(pot, G('Cone', .022, .12, 5), M(C.white), .1, .08, 0).rotation.z = -1.0; put(pot, G('Torus', .045, .013, 4, 8), M(C.white), -.09, .07, 0);
    for (const [x, y, c] of [[-.04, .05, C.pink], [.04, .03, '#7fc6e8']]) ico(pot, .018, c, x, .07 + y, .07);
    for (const [x, z] of [[.16, .14], [-.2, .2]]) { cyl(g, .055, .055, .01, 8, C.cream, x, .536, z); cyl(g, .035, .03, .06, 6, C.white, x, .546, z); cyl(g, .028, .028, .012, 6, '#a06a3c', x, .6, z); put(g, G('Torus', .018, .006, 4, 6), M(C.white), x + .04, .577, z).rotation.y = Math.PI / 2; }
    cyl(g, .1, .1, .015, 8, C.cream, .18, .53, -.14); for (const [x, z, y] of [[.15, -.12, 0], [.21, -.16, 0], [.18, -.1, .015]]) cyl(g, .032, .032, .02, 6, '#c9874a', x, .545 + y, z);
    cyl(g, .035, .045, .12, 6, '#7fc6e8', .02, .53, .2); for (const [x, z, c] of [[0, .2, C.yellow], [.04, .22, C.pink], [.02, .17, C.lilac]]) { box(g, .008, .08, .008, C.leafD, x, .63, z); ico(g, .03, c, x, .72, z); }
  },
  jvane(g) { // the Prize Pumpkin: a giant pumpkin on a pallet, with a blue rosette and a curly vine
    for (const z of [-.3, -.1, .1, .3]) box(g, .86, .04, .16, C.wood, 0, .04, z); for (const x of [-.36, .36]) box(g, .1, .04, .8, C.woodD, x, 0, 0);
    const P = '#f08a3c', PD = '#d9702a';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, s = put(g, G('Icosahedron', .2, 1), M(i % 2 ? P : PD), Math.cos(a) * .17, .32, Math.sin(a) * .17); s.scale.set(.9, 1.15, .9); }
    put(g, G('Icosahedron', .24, 1), M(P), 0, .34, 0).scale.set(1.1, .95, 1.1);
    const st = cyl(g, .04, .06, .16, 5, C.leafD, 0, .58, 0); st.rotation.z = .25;
    for (let i = 0; i < 6; i++) ico(g, .025, C.leaf, -.06 - i * .04, .6 - Math.sin(i) * .03, Math.cos(i * 1.4) * .05);
    const lf = box(g, .16, .015, .12, C.leaf, .1, .56, -.06); lf.rotation.set(.3, .5, -.4);
    const r = grp(g, .02, .36, .4); cyl(r, .1, .1, .03, 12, '#3b62a0', 0, 0, 0).rotation.x = Math.PI / 2; put(r, G('Torus', .1, .025, 4, 12), M('#4f7fc4'), 0, 0, .005);
    cyl(r, .045, .045, .04, 8, C.gold, 0, 0, .01).rotation.x = Math.PI / 2; for (const s of [-1, 1]) { const t = box(r, .05, .16, .015, '#3b62a0', s * .035, -.18, .0); t.rotation.z = s * .25; }
    box(r, .02, .045, .01, C.white, 0, -.022, .035);
  },
  jscope(g, live) { // the Star Globe: brass rings round a little glowing star, on a stone pedestal
    cyl(g, .34, .38, .1, 8, C.stoneD); cyl(g, .26, .3, .12, 8, C.stone, 0, .1); cyl(g, .08, .12, .36, 6, C.stoneD, 0, .22); cyl(g, .16, .12, .06, 8, C.stone, 0, .58);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ico(g, .04, C.yellow, Math.cos(a) * .3, .23, Math.sin(a) * .3); }
    const brass = M('#d6a24a'); put(g, G('Cylinder', .03, .04, .1, 6), brass, 0, .67, 0);
    const y = put(g, G('Torus', .34, .025, 4, 20, Math.PI), brass, 0, 1.06, 0); y.rotation.z = Math.PI; // the cradle the rings turn in
    if (!live) PARTS.jscope(g);
  },
  jcup(g) { // a big golden cup on a cushion and a stepped plinth, with a laurel wreath and stars
    box(g, .72, .14, .72, C.stoneD); box(g, .56, .16, .56, C.stone, 0, .14); box(g, .3, .08, .02, C.gold, 0, .18, .285);
    box(g, .36, .06, .36, '#c8412f', 0, .3); for (const [x, z] of [[-.17, -.17], [.17, -.17], [-.17, .17], [.17, .17]]) ico(g, .025, C.gold, x, .34, z); // a red cushion with gold tassels
    const m = GOLDM();
    put(g, G('Cylinder', .12, .16, .06, 8), m, 0, .39, 0); put(g, G('Cylinder', .04, .05, .2, 6), m, 0, .52, 0); put(g, G('Cylinder', .1, .04, .06, 8), m, 0, .64, 0);
    put(g, G('Cylinder', .26, .12, .36, 8), m, 0, .84, 0); put(g, G('Cylinder', .27, .27, .03, 8), m, 0, 1.03, 0);
    for (const s of [-1, 1]) { const h = put(g, G('Torus', .1, .025, 4, 8), m, s * .27, .86, 0); h.rotation.y = Math.PI / 2; }
    put(g, G('Octahedron', .07, 0), MX('gemB', '#7fc6e8', { emissive: '#2f86cc', emissiveIntensity: .5 }), 0, .86, .2).scale.z = .5; // a gem on the front
    put(g, G('Octahedron', .07, 0), SPARK(), 0, 1.16, 0);
    for (let i = 0; i < 7; i++) { const a = Math.PI * (.15 + i * .7 / 6); for (const s of [-1, 1]) { const l = put(g, G('Icosahedron', .04, 0), M(i % 2 ? C.leaf : C.leafD), s * Math.cos(a) * .2, .17 + Math.sin(a) * .12, .29); l.scale.set(1.4, .8, .6); } } // the laurel
    for (const [x, z] of [[-.3, .3], [.3, .3], [-.3, -.3], [.3, -.3]]) put(g, G('Octahedron', .045, 0), M(C.gold), x, .17, z);
  },
};

// The parts that move. A picture of a model has them baked in; on the farm (live) they stay loose and FX moves them.
// Each returns what it made so FX can get at it.
const PARTS = {
  // the Climbing Tower's toy mouse, hanging from the platform's edge; it swings from its top
  towerToy(g) { const [x, y, z] = TOWER.toy, o = grp(g, x, y, z); box(o, .012, .24, .012, C.cream, 0, -.24, 0); const m = grp(o, 0, -.28, 0);
    m.scale.setScalar(1.3); ico(m, .065, '#b9b3c4', 0, 0, 0).scale.set(.9, .8, 1.25); for (const s of [-1, 1]) ico(m, .03, C.pink, s * .045, .05, .02); ico(m, .014, '#5a3a2e', 0, -.005, .08); box(m, .012, .012, .12, C.pink, 0, -.02, -.12).rotation.x = -.5;
    return o; },
  // the hammock round the back: slung from the post to the back leg, it rocks round the line between them
  towerHammock(g) { const h = TOWER.hammock, o = grp(g, h.x, h.y, h.z); o.rotation.y = Math.atan2(-h.z, h.x); const s = grp(o); // its x runs along the line from the post to the back leg
    const len = Math.hypot(h.x, h.z) * 2 - .08; for (const e of [-1, 1]) { const r = box(s, .014, .2, .014, C.cream, e * len / 2 * .82, -.17, 0); r.rotation.z = e * .7; }
    const cloth = ico(s, .2, '#7fc6e8', 0, -h.sag + .03, 0, 1); cloth.scale.set(len / .4, .42, 1.05); const stripe = box(s, len * .7, .02, .03, C.white, 0, -h.sag - .03, .17); stripe.rotation.x = -.5;
    box(s, len * .7, .02, .03, C.white, 0, -h.sag - .03, -.17).rotation.x = .5;
    return s; },
  jcradle(g) { const o = grp(g, 0, .02, 0); // the basket rocks on its runners
    const b = put(o, G('Cylinder', .2, .14, .16, 8), M('#c99763'), 0, .24, 0); b.scale.z = .75; put(o, G('Torus', .19, .025, 4, 10), M(C.wood), 0, .32, 0).scale.y = .75;
    for (const y of [.2, .26]) put(o, G('Torus', .175 + (y - .2) * .3, .012, 3, 10), M(C.woodD), 0, y, 0).scale.y = .75; // weave bands
    put(o, G('Box', .34, .03, .22), M('#ffc2d4'), 0, .3, 0); for (const s of [-1, 1]) { const f = box(o, .06, .1, .2, '#ffc2d4', s * .17, .22, 0); f.rotation.z = s * .3; } // the blanket hangs over the sides
    ico(o, .1, C.cream, 0, .4, 0, 1).scale.y = 1.25;
    for (const [x, y, z, c] of [[.05, .44, .08, C.pink], [-.06, .38, .08, '#7fc6e8'], [.03, .49, -.07, C.yellow], [-.08, .45, -.03, C.pink], [.09, .36, -.02, '#7fc6e8']]) ico(o, .02, c, x, y, z);
    const h = put(o, G('Torus', .2, .018, 4, 12, Math.PI), M(C.wood), 0, .3, 0); h.rotation.y = Math.PI / 2; // the handle
    for (const s of [-1, 1]) { const w = box(o, .07, .04, .02, C.pink, s * .04, .5, 0); w.rotation.y = Math.PI / 2; w.rotation.x = s * .5; } ico(o, .025, C.pink, 0, .5, 0); // a bow on top
    box(o, .006, .1, .006, C.cream, 0, .43, 0); put(o, G('Octahedron', .03, 0), M(C.yellow), 0, .37, 0); // a star hanging from the bow
    return o; },
  jscope(g) { const o = grp(g, 0, 1.06, 0); // the turning rings and the star inside them
    const brass = M('#d6a24a'), rings = [];
    for (const [rx, rz, r] of [[Math.PI / 2, 0, .3], [Math.PI / 2, .9, .26], [.4, Math.PI / 2, .22]]) { const t = grp(o); t.rotation.set(rx, 0, rz); put(t, G('Torus', r, .018, 4, 20), brass); rings.push(t); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ico(rings[0], .02, C.yellow, Math.cos(a) * .3, Math.sin(a) * .3, 0); }
    put(o, G('Octahedron', .09, 0), SPARK()); ico(o, .05, '#fff3b8');
    const moon = grp(o, 0, .34, 0); ico(moon, .05, '#fff3b8').scale.z = .5; ico(moon, .045, '#d6a24a', .025, .015, .01).scale.z = .55; // a little moon on top (the brass half hides one side)
    o.userData.rings = rings; return o; },
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
  carousel(g) {
    const t = new THREE.Group(); t.position.y = .22; g.add(t);
    // The roof sits high (1.75) on a tall column, so riders show under it from the farm camera. H is used by scene3d.js too.
    const H = 1.75, N = 10, seg = Math.PI * 2 / N;
    cyl(t, .86, .86, .06, 12, C.red, 0, -.02); cyl(t, .7, .7, .02, 12, C.cream, 0, .04);                 // the turning platform
    cyl(t, .13, .16, H, 8, C.cream, 0, 0); for (const y of [.28, .78, 1.28]) cyl(t, .145, .15, .12, 8, C.red, 0, y); // candy-striped column
    cyl(t, .2, .2, .08, 8, C.gold, 0, .04); cyl(t, .22, .16, .1, 8, C.gold, 0, H - .1);
    for (let i = 0; i < N; i++) { // striped big top: ten panels, red and cream by turns, each with a scallop and a bulb
      const a = i * seg, c = i % 2 ? C.cream : C.red, mid = a + seg / 2;
      put(t, G('Cone', .98, .5, 1, 1, false, a, seg), M(c), 0, H + .31, 0);
      put(t, G('Cylinder', .98, .98, .12, 1, 1, false, a, seg), M(i % 2 ? C.red : C.cream), 0, H, 0);
      const sc = put(t, G('Cone', .12, .14, 4), M(c), Math.sin(mid) * .95, H - .12, Math.cos(mid) * .95); sc.rotation.x = Math.PI; sc.rotation.y = mid;
      put(t, G('Icosahedron', .04, 0), MX('glow2', '#fff3b8', { emissive: '#ffd66b', emissiveIntensity: .9 }), Math.sin(a) * .98, H - .02, Math.cos(a) * .98);
    }
    cyl(t, .16, .2, .1, 8, C.gold, 0, H + .54); ico(t, .09, C.gold, 0, H + .72, 0); pennant(t, 0, H + .76, 0, C.yellow, .3, .8);
    ['#fff4e2', C.pink, C.water, C.lilac].forEach((c, i) => { const a = i * Math.PI / 2, o = grp(t, Math.cos(a) * .6, 0, Math.sin(a) * .6); o.rotation.y = -a; o.userData.bob = i;
      cyl(o, .02, .02, 1.75, 5, C.gold); const b = grp(o, 0, .38, 0); b.scale.setScalar(1.3); box(b, .14, .16, .34, c, 0, 0, 0); box(b, .1, .16, .12, c, 0, .12, .16); for (const x of [-.04, .04]) box(b, .03, .07, .03, c, x, .28, .2); box(b, .15, .05, .12, C.red, 0, .16, -.02); for (const z of [-.12, .12]) box(b, .1, .14, .05, c, 0, -.14, z); });
    return t;
  },
  balloon(g) {
    const b = new THREE.Group(); g.add(b); box(b, .015, 1.0, .015, C.cream, 0, .18, 0);
    const e = put(b, G('Icosahedron', .34, 1), M(C.red), 0, 1.5, 0); e.scale.y = 1.15; put(b, G('Cylinder', .345, .345, .12, 10), M(C.yellow), 0, 1.5, 0); put(b, G('Cone', .08, .1, 5), M(C.redD), 0, 1.1, 0).rotation.x = Math.PI;
    return b;
  },
  coinfount(g) {
    const out = [put(g, G('Octahedron', .12, 0), MX('fount', C.white, { transparent: true, opacity: .8 }), 0, 1.26, 0)];
    for (const a of [0, 2.1, 4.2]) out.push(put(g, G('Cylinder', .06, .06, .02, 6), GOLDM(), Math.cos(a) * .5, .6, Math.sin(a) * .5));
    return out;
  },
  miniwheel(g) {
    const w = new THREE.Group(); w.position.set(0, .78, .03); g.add(w);
    ['#ffb547', '#7ed3b2', '#ff8fab', '#6fb8e6', '#ffd84a', '#e5543b', '#a58be0', '#7ed3b2'].forEach((c, i) => { const a = (i + .5) / 8 * Math.PI * 2, m = put(w, G('Cylinder', .36, .36, .05, 8, 1, false, i / 8 * Math.PI * 2, Math.PI / 4), M(c)); m.rotation.x = Math.PI / 2; put(w, G('Box', .04, .04, .05), M(C.cream), Math.cos(a) * .33, Math.sin(a) * .33, .03); });
    put(w, G('Octahedron', .08, 0), GOLDM(), 0, 0, .05);
    return w;
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
  lodge(g, lv) { const smoke = puffs(g, -.85, 2.2 + liftOf('lodge', lv), -.63, 3, .1); return T => smoke(T, .18, true); },
  house(g, lv) {
    const up = liftOf('house', lv), smoke = puffs(g, .7, 2.25 + up + (lv >= 2 ? .34 : 0), -.5, 4, .12);
    let vane = null, gem = null, shards = [];
    if (lv >= 6) { // the weathervane's arrow swings about in the breeze
      vane = grp(g, -.35, 2.3 + up + .5, -.55); box(vane, .42, .03, .03, C.iron, 0, -.015, 0); cone(vane, .05, .12, 4, C.gold, .25, 0, 0).rotation.z = -Math.PI / 2;
      box(vane, .1, .1, .02, C.gold, -.2, -.05, 0); ico(vane, .035, C.gold, 0, .02, 0);
    }
    if (lv >= 7) { // a sky crystal floats over the clock tower and turns, with three little shards going round it
      const glow = MX('skygem', '#a6ecff', { emissive: '#3fc4ec', emissiveIntensity: .8, roughness: .35 });
      gem = grp(g, 1.0, 4.32, -1.08); put(gem, G('Octahedron', .2, 0), glow).scale.y = 1.55;
      shards = [0, 1, 2].map(() => { const o = put(g, G('Octahedron', .045, 0), glow); o.scale.y = 1.6; return o; });
    }
    return T => {
      smoke(T, .22, true);
      if (vane) vane.rotation.y = .8 + Math.sin(T * .35) * .7 + Math.sin(T * 1.3) * .12;
      if (gem) { gem.position.y = 4.32 + Math.sin(T * 1.4) * .05; gem.rotation.y = T * .7;
        shards.forEach((o, i) => { const a = T * 1.1 + i * Math.PI * 2 / 3; o.position.set(1.0 + Math.cos(a) * .32, gem.position.y + Math.sin(a * 2) * .04, -1.08 + Math.sin(a) * .32); }); }
    };
  },
  kitchen(g, lv) { const smoke = puffs(g, .5, 1.75 + liftOf('kitchen', lv) + (lv >= 2 ? .1 : 0), -.5, 5, .12), steam = puffs(g, -.4, .56, .82, 3, .07); return (T, st) => { smoke(T, st.burst ? .7 : .2, true, st.burst ? 1.3 : .9); steam(T, .8, st.burst > 0, .5); }; },
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
  gate(g, lv) { // the pennant waves while a party is away
    const f = new THREE.Group(); f.position.set(.72, 1.64 + (lv >= 2 ? liftOf('gate', lv) + .2 : 0), 0); g.add(f); box(f, .04, .5, .04, C.woodD, 0, 0, 0); const c = new THREE.Group(); c.position.y = .4; f.add(c); box(c, .34, .2, .03, C.yellow, .17, -.1, 0);
    return (T, st) => { c.rotation.y = Math.sin(T * (st.on ? 6 : 1.5)) * (st.on ? .5 : .15); };
  },
  barn(g) { const hay = puffs(g, 1.0, .45, 1.0, 3, .05, 'chaff', C.straw); return (T, st) => hay(T, .5, st.on, .5); },
  flag(g) { const f = PARTS.flag(g); return T => { f.rotation.y = Math.sin(T * 2.2) * .28 + Math.sin(T * 5.1) * .06; }; },
  fountain(g) { const d = PARTS.fountain(g); return T => d.forEach((m, i) => { if (!i) { m.position.y = 1.32 + Math.sin(T * 5) * .06; m.rotation.y = T * 2; return; } const u = (T * .9 + i / 3) % 1, a = i * 2.1 + T * .3; m.position.set(Math.cos(a) * (.1 + u * .5), 1.1 + u * .5 - u * u * 1.2, Math.sin(a) * (.1 + u * .5)); }); },
  windmill(g) { const hub = PARTS.windmill(g); return T => { hub.rotation.z = T * 1.1; }; },
  jcradle(g) { const o = PARTS.jcradle(g); return T => { o.rotation.x = Math.sin(T * 1.3) * .12; }; },
  jscope(g) { const o = PARTS.jscope(g), [a, b, c] = o.userData.rings; return T => { a.rotation.y = T * .5; b.rotation.y = -T * .35; c.rotation.x = .4 + T * .7; o.children[3].rotation.y = T * 1.2; }; }, // the rings turn at their own speeds round the twinkling star
  carousel(g) { const t = PARTS.carousel(g), riders = t.children.filter(o => o.userData.bob !== undefined); return T => { t.rotation.y = -T * .5; /* the horses go nose first; scene3d.js seats riders by the same numbers */ riders.forEach(o => { o.children[1].position.y = .38 + Math.sin(T * 2 + o.userData.bob * 1.6) * .12; }); }; },
  balloon(g) { const b = PARTS.balloon(g); return T => { b.rotation.z = Math.sin(T * .9) * .09; b.rotation.x = Math.sin(T * .7 + 1) * .06; b.position.y = Math.sin(T * 1.3) * .04; }; },
  coinfount(g) { const d = PARTS.coinfount(g); return T => d.forEach((m, i) => { if (!i) { m.position.y = 1.26 + Math.sin(T * 5) * .06; m.rotation.y = T * 2; return; } const u = (T * .7 + i / 3) % 1, a = i * 2.1 + T * .3; m.position.set(Math.cos(a) * (.1 + u * .5), 1.05 + u * .6 - u * u * 1.3, Math.sin(a) * (.1 + u * .5)); m.rotation.x = T * 6; }); },
  miniwheel(g) { const w = PARTS.miniwheel(g); return T => { const u = T % 6; w.rotation.z = -(Math.floor(T / 6) + (u < 4 ? 1 - Math.pow(1 - u / 4, 3) : 1)) * 13.35; }; }, // spins for four seconds, rests for two
  glow(g) { const o = PARTS.glow(g); return T => { o.position.y = .78 + Math.sin(T * 1.8) * .05; o.rotation.y = T * .9; }; },
  campfire(g) { const [a, b] = PARTS.campfire(g), smoke = puffs(g, 0, .5, 0, 3, .06); return T => { a.scale.set(1 + Math.sin(T * 11) * .12, 1 + Math.sin(T * 13 + 1) * .2, 1 + Math.cos(T * 9) * .12); b.scale.y = 1 + Math.sin(T * 17) * .3; b.rotation.y = T * 3; smoke(T, .35, true, .8); }; },
  swing(g) { const s = PARTS.swing(g); return T => { s.rotation.x = Math.sin(T * 1.7) * .22; }; },
  hotspring(g) { const st = PARTS.hotspring(g); return T => st.forEach((m, i) => { const u = (T * .22 + i / 3) % 1; m.position.y = .3 + u * 1.1; m.position.x = Math.sin(u * 4 + i * 2) * .25; m.scale.setScalar(Math.sin(Math.PI * u) * 1.1); }); },
  lighthouse(g) { const b = new THREE.Group(); b.position.y = 1.6; g.add(b); put(b, G('Box', .08, .08, 1.5), MX('beam', '#fff3b8', { transparent: true, opacity: .4, emissive: '#ffe9a0', emissiveIntensity: 1 }), 0, 0, .8); return T => { b.rotation.y = T * 1.2; }; },
  tower(g, lv) { // the toy mouse sways, and spins round when a pet bats it; the hammock rocks
    if (lv < 2) return null;
    const toy = PARTS.towerToy(g), ham = lv >= 3 ? PARTS.towerHammock(g) : null; let k = 0;
    return (T, st) => { k += ((st.burst > 0 ? 1 : 0) - k) * .08; toy.rotation.x = Math.sin(T * 2.1) * (.12 + k * .5); toy.rotation.z = Math.sin(T * 1.6 + 1) * (.08 + k * .3); toy.children[1].rotation.y = T * k * 6;
      if (ham) ham.rotation.x = hammockSway(T); };
  },
  statue(g) { const o = put(g, G('Octahedron', .05, 0), SPARK(), 0, 1.5, 0); return T => { o.position.y = 1.5 + Math.sin(T * 2) * .05; o.rotation.y = T * 2; o.scale.setScalar(.7 + Math.sin(T * 3) * .3); }; },
};

// A sign that floats over a building that wants attention: an envelope for mail, a "!" for anything else.
export function signModel(kind) {
  const g = new THREE.Group();
  if (kind === 'mail') { box(g, .56, .38, .06, C.white, 0, -.19, 0); box(g, .6, .04, .07, C.stoneD, 0, .17, 0); box(g, .6, .04, .07, C.stoneD, 0, -.21, 0);
    for (const d of [-1, 1]) { const v = box(g, .34, .04, .07, C.red, d * .135, .06, .01); v.rotation.z = -d * .6; }
    put(g, G('Cylinder', .12, .12, .06, 8), MX('dot', '#ff5a5f', { emissive: '#ff5a5f', emissiveIntensity: .6 }), .28, .2, 0).rotation.x = Math.PI / 2; }
  else if (kind === 'quest') { // the Farm Journal's pinned task: a mint arrow pointing down at the building
    const m = MX('quest', '#52d6a4', { emissive: '#2fb383', emissiveIntensity: .5 });
    put(g, G('Box', .16, .26, .1), m, 0, .1, 0); put(g, G('Cone', .22, .24, 4), m, 0, -.15, 0).rotation.set(Math.PI, Math.PI / 4, 0); }
  else { put(g, G('Cylinder', .22, .22, .08, 8), MX('sign', C.yellow, { emissive: '#ffb547', emissiveIntensity: .5 }), 0, 0, 0).rotation.x = Math.PI / 2; box(g, .07, .2, .1, C.woodD, 0, -.02, 0); box(g, .07, .07, .1, C.woodD, 0, -.14, 0); }
  toonify(g, .03); g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  const o = new THREE.Group(); g.scale.setScalar(1.35); o.add(g);
  return o;
}

// live: for the farm itself, where the moving parts stay loose. g.userData.tick(T, st, g) moves them.
// lv: the building's level (1 to 3, the farmhouse to 4). Each level has its own look.
// link: for pieces that join their neighbours (fences), the number fenceLink gives.
export function itemModel(type, live = false, raw = false, lv = 1, link = 0) {
  const g = new THREE.Group();
  (BUILD[type] || BUILD.rock)(g, live, lv, link);
  finish(g, raw);
  if (live && FX[type]) { const fx = new THREE.Group(); g.add(fx); g.userData.tick = FX[type](fx, lv); toonify(fx); fx.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } }); }
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

// Which sides of a fence at (x, y) turned r join something, in the piece's own directions (0 +x, 1 +z, 2 -x, 3 -z):
//   bits 0-3 a fence or a lined-up Flower Arch next door, bits 4-7 the shared post on that side is this piece's to draw
//   (the piece to the west or north draws it), bits 8-11 the neighbour is an arch. skip: an item id to leave out (one being moved).
export const LINKS = { fence: true };
export function fenceLink(items, x, y, r = 0, skip) {
  let link = 0;
  for (let w = 0; w < 4; w++) {
    const nx = x + [1, 0, -1, 0][w], ny = y + [0, 1, 0, -1][w];
    const o = items?.find(i => i.id !== skip && (i.type === 'fence' || i.type === 'arch') && i.x === nx && i.y === ny);
    if (!o || o.type === 'arch' && (o.r | 0) % 2 !== w % 2) continue; // an arch joins only along its own line
    const d = (w - (r | 0) + 4) % 4;
    link |= 1 << d; if (o.type === 'arch') link |= 256 << d; else if (w < 2) link |= 16 << d;
  }
  return link;
}

// Frees what a model owns. Shared geometries and the cached plain materials stay.
export function disposeModel(g) {
  const shared = new Set(mats.values());
  g.traverse(m => {
    if (!m.isMesh) return;
    if (m.userData.baked) m.geometry.dispose();
    if (!shared.has(m.material) && !m.material.userData.keep) m.material.dispose();
  });
}

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
const ico = (p, r, c, x = 0, y = 0, z = 0, d = 0) => put(p, G('Icosahedron', r, d), M(c), x, y, z);

// Merges a finished model and keeps the faceted look (bake() makes plain smooth materials).
export function finish(g) {
  bake(g);
  g.traverse(m => { if (m.isMesh) { m.material.flatShading = true; m.material.roughness = .92; m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

const C = { wood: '#b07a4f', woodD: '#8a5a3c', cream: '#f4e3c1', red: '#d9584e', redD: '#b8433c', stone: '#a9a6b0', stoneD: '#8a8794',
  leaf: '#5fb04a', leafD: '#4a9a45', leafL: '#86cc5a', straw: '#e8c860', glass: '#bfe6fb', soil: '#8a5a3c', sand: '#e8cf9a',
  white: '#ffffff', yellow: '#ffc94d', pink: '#ff9fb8', lilac: '#c8a2f2', water: '#6fb7e8', slate: '#6f7f8f' };

const BUILD = {
  house(g) {
    box(g, 2.3, 1.25, 1.9, C.cream, 0, 0, -.1);
    put(g, gable(2.7, 1.0, 2.3), M(C.red), 0, 1.25, -.1);
    box(g, .34, .8, .34, C.stone, .7, 1.4, -.5);                 // chimney
    box(g, .5, .78, .1, C.woodD, 0, 0, .87); ico(g, .05, C.yellow, .15, .4, .94);
    for (const s of [-1, 1]) { box(g, .42, .42, .08, C.glass, s * .72, .5, .86); box(g, .5, .08, .1, C.wood, s * .72, .42, .88); }
    box(g, .9, .1, .4, C.stone, 0, 0, 1.1);                      // doorstep
    box(g, .6, .16, .2, C.woodD, -.72, .28, .98);                // flower box
    for (const [x, c] of [[-.9, C.pink], [-.72, C.yellow], [-.54, C.lilac]]) ico(g, .09, c, x, .52, 1.0);
  },
  hut(g) {
    cyl(g, .78, .84, .75, 6, '#e9c99a');
    cone(g, 1.08, .85, 6, C.leaf, 0, .72);
    ico(g, .16, C.leafL, 0, 1.6, 0);
    box(g, .46, .56, .1, C.woodD, 0, 0, .74);
    box(g, .3, .12, .06, C.cream, 0, .68, .78);                  // little name plate
  },
  gate(g) {
    for (const s of [-1, 1]) { box(g, .36, 1.5, .36, C.stone, s * .72); box(g, .46, .14, .46, C.stoneD, s * .72, 1.5); }
    box(g, 1.9, .24, .3, C.wood, 0, 1.3);
    box(g, .5, .5, .05, C.red, 0, .78, .02); box(g, .06, .5, .06, C.woodD, -.32, .8, .02);
    box(g, .08, .8, .08, C.woodD, .75, 0, .7); box(g, .46, .2, .06, C.cream, .9, .56, .7); // signpost
  },
  garden(g, live) {
    box(g, .92, .14, .92, C.woodD); box(g, .78, .18, .78, C.soil);
    if (!live) PARTS.garden(g);
  },
  kitchen(g) {
    box(g, 1.7, 1.0, 1.4, '#f7d9a8', 0, 0, -.15);
    box(g, 1.86, .12, 1.56, C.woodD, 0, 1.0, -.15);
    for (let i = 0; i < 5; i++) { const o = box(g, .36, .06, .6, i % 2 ? C.white : C.red, -.72 + i * .36, .86, .78); o.rotation.x = .35; } // awning
    box(g, 1.5, .5, .3, C.wood, 0, 0, .72);                      // counter
    cyl(g, .16, .13, .16, 6, C.stoneD, -.4, .5, .72); ico(g, .09, C.red, .35, .58, .72); ico(g, .08, C.yellow, .52, .57, .76);
    box(g, .3, .6, .3, C.stone, .5, 1.1, -.5);
  },
  barn(g) {
    box(g, 1.7, 1.2, 2.6, '#c8553d');
    put(g, gable(1.96, .8, 2.8), M('#7a4a3a'), 0, 1.2, 0);
    box(g, .8, .9, .08, '#a8433c', 0, 0, 1.31);
    const a = box(g, 1.1, .08, .04, C.white, 0, .41, 1.36); a.rotation.z = .84; const b = box(g, 1.1, .08, .04, C.white, 0, .41, 1.36); b.rotation.z = -.84;
    box(g, .34, .34, .06, C.glass, 0, 1.38, 1.4);
    box(g, .5, .4, .5, C.straw, 1.0, 0, 1.0);                    // hay bale
  },
  nest(g) {
    const t = put(g, G('Torus', .62, .22, 5, 8), M(C.woodD), 0, .2, 0); t.rotation.x = Math.PI / 2;
    cyl(g, .56, .5, .2, 8, C.straw, 0, .06);
    for (const [x, z, r] of [[.6, .5, .5], [-.7, .2, 1.2], [.1, -.75, 2]]) { const o = box(g, .5, .06, .08, C.wood, x, .3, z); o.rotation.y = r; }
    cone(g, .1, .22, 4, C.leafL, -.72, 0, -.6); cone(g, .1, .22, 4, C.leaf, .76, 0, -.5);
  },
  yard(g, live) {
    box(g, 2.8, .06, 1.8, C.sand);
    for (const x of [-1.34, 1.34]) for (const z of [-.84, .84]) box(g, .12, .4, .12, C.woodD, x, 0, z);
    if (!live) PARTS.yard(g);
    for (const z of [-.3, .3]) box(g, .1, .42, .1, C.white, .7, 0, z);
    box(g, .08, .08, .76, C.red, .7, .36);                       // hurdle
    ico(g, .16, C.stone, .1, .14, .6);
  },
  flag(g, live) {
    cyl(g, .26, .32, .2, 5, C.stone);
    cyl(g, .045, .045, 1.9, 5, C.woodD, 0, .2);
    if (!live) PARTS.flag(g);
    ico(g, .08, C.yellow, 0, 2.14, 0);
  },
  mailbox(g, live) {
    box(g, .1, .7, .1, C.woodD);
    box(g, .34, .28, .5, C.red, 0, .7); box(g, .36, .06, .52, C.redD, 0, .98);
    if (!live) PARTS.mailbox(g);
    cone(g, .09, .2, 4, C.leaf, .3, 0, .2);
  },
  workshop(g) {
    box(g, 1.7, 1.0, 1.5, '#b9a089', 0, 0, -.1);
    const r = box(g, 1.94, .12, 1.84, C.slate, 0, 1.2, -.1); r.rotation.x = .22;
    box(g, .5, .7, .08, C.woodD, -.4, 0, .66); box(g, .4, .36, .08, C.glass, .45, .42, .66);
    box(g, .7, .3, .36, C.wood, .5, 0, .98); box(g, .3, .12, .2, C.stoneD, .5, .3, .98); // bench and anvil
    box(g, .1, .1, .5, C.wood, -.9, 0, .9); box(g, .1, .1, .5, C.wood, -.76, .1, .9);
  },
  fence(g) {
    for (const x of [-.4, .4]) { box(g, .12, .5, .12, C.wood, x); cone(g, .09, .1, 4, C.wood, x, .5); }
    box(g, .96, .08, .06, C.cream, 0, .34); box(g, .96, .08, .06, C.cream, 0, .14);
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
    cyl(g, .12, .16, .12, 5, C.stoneD); cyl(g, .045, .045, 1.0, 5, C.woodD, 0, .1);
    put(g, G('Box', .24, .28, .24), M('#ffe27a', { emissive: '#ffb547', emissiveIntensity: .7 }), 0, 1.22, 0).userData.dyn = true;
    cone(g, .24, .16, 4, C.woodD, 0, 1.36).rotation.y = Math.PI / 4;
  },
  pond(g) {
    cyl(g, .9, .94, .06, 8, C.stone); cyl(g, .78, .78, .08, 8, C.water);
    cyl(g, .16, .16, .1, 6, C.leafL, .25, 0, .2); put(g, G('Octahedron', .07, 0), M(C.pink), .25, .15, .2);
    ico(g, .16, C.stoneD, -.8, .08, .3); ico(g, .12, C.stone, .6, .08, -.7);
    for (const [x, z] of [[-.6, -.6], [-.72, -.48]]) cone(g, .05, .5, 4, C.leafD, x, 0, z);
  },
  bench(g) {
    box(g, .84, .08, .32, C.wood, 0, .26); box(g, .84, .3, .06, C.wood, 0, .38, -.16);
    for (const x of [-.34, .34]) box(g, .08, .26, .3, C.woodD, x);
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
    cyl(g, .26, .4, 1.5, 6, C.cream); cone(g, .34, .4, 6, C.red, 0, 1.5);
    box(g, .2, .34, .04, C.woodD, 0, 0, .37); box(g, .16, .16, .04, C.glass, 0, .8, .32);
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
    cyl(g, .38, .4, .4, 8, C.stone); cyl(g, .3, .3, .42, 8, C.water);
    for (const x of [-.34, .34]) box(g, .07, .7, .07, C.woodD, x, .4); put(g, gable(.96, .3, .7), M(C.red), 0, 1.1, 0);
    box(g, .6, .05, .05, C.wood, 0, .9); box(g, .14, .14, .14, C.wood, 0, .6);
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
  g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  const o = new THREE.Group(); g.scale.setScalar(1.35); o.add(g);
  return o;
}

// live: for the farm itself, where the moving parts stay loose. g.userData.tick(T, st, g) moves them.
export function itemModel(type, live = false) {
  const g = new THREE.Group();
  (BUILD[type] || BUILD.rock)(g, live);
  finish(g);
  if (live && FX[type]) { const fx = new THREE.Group(); g.add(fx); g.userData.tick = FX[type](fx); fx.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } }); }
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

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
  garden(g) {
    box(g, .92, .14, .92, C.woodD); box(g, .78, .18, .78, C.soil);
    for (const [x, z] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) { cone(g, .09, .22, 4, C.leaf, x, .18, z); ico(g, .05, C.red, x + .07, .3, z + .04); }
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
  yard(g) {
    box(g, 2.8, .06, 1.8, C.sand);
    for (const x of [-1.34, 1.34]) for (const z of [-.84, .84]) box(g, .12, .4, .12, C.woodD, x, 0, z);
    box(g, .12, .9, .12, C.wood, -.8, 0, -.2); box(g, .7, .12, .12, C.wood, -.8, .55, -.2); box(g, .34, .34, .34, C.straw, -.8, .86, -.2); // dummy
    for (const z of [-.3, .3]) box(g, .1, .42, .1, C.white, .7, 0, z);
    box(g, .08, .08, .76, C.red, .7, .36);                       // hurdle
    ico(g, .16, C.stone, .1, .14, .6);
  },
  flag(g) {
    cyl(g, .26, .32, .2, 5, C.stone);
    cyl(g, .045, .045, 1.9, 5, C.woodD, 0, .2);
    box(g, .62, .4, .04, C.red, .33, 1.6); box(g, .2, .14, .05, C.yellow, .3, 1.73);
    ico(g, .08, C.yellow, 0, 2.14, 0);
  },
  mailbox(g) {
    box(g, .1, .7, .1, C.woodD);
    box(g, .34, .28, .5, C.red, 0, .7); box(g, .36, .06, .52, C.redD, 0, .98);
    box(g, .04, .22, .12, C.white, .2, .86, .1);
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
  fountain(g) {
    cyl(g, .92, .96, .3, 8, C.stone); cyl(g, .8, .8, .34, 8, C.water);
    cyl(g, .16, .22, .8, 6, C.stoneD, 0, .3); cyl(g, .46, .3, .12, 8, C.stone, 0, 1.0); cyl(g, .38, .38, .14, 8, C.water, 0, 1.02);
    put(g, G('Octahedron', .12, 0), MX('fount', C.white, { transparent: true, opacity: .8 }), 0, 1.32, 0);
    for (const a of [0, 2.1, 4.2]) put(g, G('Octahedron', .06, 0), M(C.white), Math.cos(a) * .5, .5, Math.sin(a) * .5);
  },
  windmill(g) {
    cyl(g, .26, .4, 1.5, 6, C.cream); cone(g, .34, .4, 6, C.red, 0, 1.5);
    box(g, .2, .34, .04, C.woodD, 0, 0, .37); box(g, .16, .16, .04, C.glass, 0, .8, .32);
    const hub = new THREE.Group(); hub.position.set(0, 1.4, .36); hub.rotation.z = .5; g.add(hub);
    for (let i = 0; i < 4; i++) { const b = put(hub, G('Box', .16, .7, .03), M(C.white), 0, .4, 0); const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm); arm.add(b); }
    put(hub, G('Box', .12, .12, .08), M(C.woodD));
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
  glow(g) {
    cyl(g, .12, .16, .1, 6, C.stoneD); cyl(g, .03, .03, .5, 5, C.stoneD, 0, .1);
    put(g, G('Octahedron', .17, 0), MX('glow', '#8fe3f5', { emissive: '#8fe3f5', emissiveIntensity: .8 }), 0, .78, 0).scale.set(1, 1.4, 1);
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
  campfire(g) {
    for (let i = 0; i < 6; i++) ico(g, .07, C.stoneD, Math.cos(i * 1.05) * .22, .05, Math.sin(i * 1.05) * .22);
    for (const r of [0, 1.05, 2.1]) { const l = box(g, .34, .07, .07, C.woodD, 0, .05); l.rotation.y = r; }
    put(g, G('Cone', .13, .34, 5), MX('fire', '#ff9a3c', { emissive: '#ff7a1a', emissiveIntensity: .9 }), 0, .26, 0); put(g, G('Cone', .07, .2, 5), MX('fire2', '#ffd95a', { emissive: '#ffc94d', emissiveIntensity: 1 }), .04, .2, .03);
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
  swing(g) {
    for (const x of [-.4, .4]) { const a = box(g, .06, 1.2, .06, C.wood, x, 0, .18); a.rotation.x = -.16; const b = box(g, .06, 1.2, .06, C.wood, x, 0, -.18); b.rotation.x = .16; }
    box(g, .9, .06, .06, C.woodD, 0, 1.16); for (const x of [-.18, .18]) box(g, .02, .8, .02, C.cream, x, .36); box(g, .46, .05, .2, C.pink, 0, .34);
  },
  lighthouse(g) {
    cyl(g, .4, .44, .14, 8, C.stoneD); cyl(g, .24, .34, .5, 8, C.white, 0, .14); cyl(g, .2, .24, .4, 8, C.red, 0, .64); cyl(g, .17, .2, .4, 8, C.white, 0, 1.04);
    cyl(g, .26, .26, .05, 8, C.stoneD, 0, 1.44); put(g, G('Cylinder', .13, .13, .22, 6), MX('lamp', '#ffe9a0', { emissive: '#ffd95a', emissiveIntensity: 1 }), 0, 1.6, 0); cone(g, .2, .2, 8, C.red, 0, 1.71);
  },
  hotspring(g) {
    cyl(g, .9, .95, .1, 8, C.stoneD); cyl(g, .72, .72, .13, 8, '#8fd9e0');
    for (let i = 0; i < 7; i++) ico(g, .16 + (i % 3) * .05, i % 2 ? C.stone : C.stoneD, Math.cos(i * .9) * .82, .14, Math.sin(i * .9) * .82);
    for (const [x, y, z] of [[-.2, .5, 0], [.2, .8, .15], [0, 1.1, -.2]]) put(g, G('Icosahedron', .14, 0), MX('steam', C.white, { transparent: true, opacity: .55 }), x, y, z);
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

export function itemModel(type) {
  const g = new THREE.Group();
  (BUILD[type] || BUILD.rock)(g);
  return finish(g);
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

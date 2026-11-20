// Pet Farm models: blocky low-poly buildings, decorations and pets, all built in code from a few shapes.
//   itemModel(type) -> THREE.Group sitting on y = 0, centred on its footprint, front facing +Z. One tile = 1 unit.
//   petModel(species, form) -> THREE.Group about 2 units tall as an adult, facing +Z. userData = { eyes, k }.
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
const geos = new Map();
const G = (type, ...a) => {
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

// ---------- pets ----------
// form: 0 baby, 1 young, 2 adult. Each form is the same character, bigger and with more of its signature feature.
const FORM = [{ k: .6, f: 0, eye: 1.3 }, { k: .8, f: .55, eye: 1.12 }, { k: 1, f: 1, eye: 1 }];

function face(g, eyes, { y = 1, z = .89, gap = .34, eye = 1, blush = '#ff8a9a', nose = '#f59ab0', mouthY = .86, noseY = .94 }) {
  const ink = M('#2b2230', { roughness: .5 }), bl = new THREE.MeshBasicMaterial({ color: blush, transparent: true, opacity: .6 });
  for (const s of [-1, 1]) {
    const e = put(g, G('Cylinder', .12 * eye, .12 * eye, .06, 6), ink, s * gap, y, z); e.rotation.set(Math.PI / 2, 0, -s * .33); eyes.push(e);
    put(g, G('Box', .055, .055, .02), M('#ffffff'), s * gap + .03, y + .05, z + .04);
    const b = put(g, G('Circle', .12, 6), bl, s * (gap + .26), y - .17, z - .09); b.rotation.y = s * .62;
    if (mouthY < 2.5) put(g, G('Box', .1, .03, .03), ink, s * .04, mouthY, z + .055).rotation.z = s * .5;
  }
  if (noseY < 2.5) put(g, G('Box', .07, .05, .04), M(nose), 0, noseY, z + .065);
}

const PETS = {
  mossbun(g, S, eyes) {
    const fur = '#f7ecd0', body = new THREE.Group(); body.position.y = .95; body.scale.set(1.02, .93, .96); g.add(body);
    ico(body, 1, fur, 0, 0, 0, 1);
    const ear = .34 + S.f * .5;
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * .34, 1.7, -.05); e.rotation.set(-.1, 0, -s * .16); g.add(e);
      const o = put(e, G('Cylinder', .1, .2, ear + .3, 4), M(fur), 0, ear / 2 + .05, 0); o.rotation.y = Math.PI / 4; o.scale.z = .6;
      put(e, G('Box', .13, ear * .8, .04), M('#f59ab0'), 0, ear / 2 + .08, .1).rotation.x = -.07;
    }
    if (S.f) { // the moss coat grows with age
      const mg = new THREE.Group(); mg.rotation.x = -.5; body.add(mg);
      const th = Math.PI * (.18 + S.f * .28);
      put(mg, G('Sphere', 1.13, 7, 3, 0, Math.PI * 2, 0, th), M('#5fb04a'));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; ico(mg, .2, i % 2 ? '#86cc5a' : '#5fb04a', Math.sin(a) * Math.sin(th) * 1.03, Math.cos(th) * 1.03, Math.cos(a) * Math.sin(th) * 1.03).scale.y = .7; }
      if (S.f === 1) {
        const f = new THREE.Group(), p = new THREE.Vector3(Math.sin(.75) * Math.sin(.62), Math.cos(.62), Math.cos(.75) * Math.sin(.62));
        f.position.copy(p.clone().multiplyScalar(1.16)); f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p); mg.add(f);
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; put(f, G('Octahedron', .1, 0), M('#ffffff'), Math.cos(a) * .12, 0, Math.sin(a) * .12).scale.y = .5; }
        put(f, G('Box', .1, .1, .1), M('#ffc94d'), 0, .03, 0);
      }
    }
    for (const s of [-1, 1]) box(g, .34, .2, .46, fur, s * .38, 0, .62);
    ico(g, .28, '#ffffff', 0, .55, -.94);
    face(g, eyes, { eye: S.eye });
  },
  cindercub(g, S, eyes) {
    const fur = '#f59a48', dark = '#5b3a34', body = new THREE.Group(); body.position.y = .95; body.scale.set(1.04, .92, .96); g.add(body);
    ico(body, 1, fur, 0, 0, 0, 1);
    const belly = ico(g, .62, '#fff3df', 0, .62, .5, 1); belly.scale.set(1.15, .7, .75);
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * .52, 1.6, 0); e.rotation.z = -s * .3; g.add(e);
      const o = put(e, G('Cone', .3, .62, 4), M(fur), 0, .3, 0); o.rotation.y = Math.PI / 4; o.scale.z = .6;
      const t = put(e, G('Cone', .15, .3, 4), M(dark), 0, .48, 0); t.rotation.y = Math.PI / 4; t.scale.z = .62;
      box(g, .32, .2, .44, dark, s * .4, 0, .6);
    }
    // the flame tail: an ember on a baby, a proper blaze on an adult
    const t = new THREE.Group(), fk = .5 + S.f * .7; t.position.set(.25, .5, -.95); t.rotation.set(-.5, 0, -.25); t.scale.setScalar(fk); t.userData.flame = true; g.add(t);
    put(t, G('Cone', .34, .9, 5), M('#ff8a3c', { emissive: '#ff5a1c', emissiveIntensity: .35 }), 0, .45, 0);
    put(t, G('Cone', .2, .56, 5), M('#ffd65a', { emissive: '#ffb020', emissiveIntensity: .5 }), 0, .34, .1);
    put(t, G('Icosahedron', .3, 0), M('#ff8a3c', { emissive: '#ff5a1c', emissiveIntensity: .35 }), 0, .05, 0);
    face(g, eyes, { eye: S.eye, nose: '#3b2f3a', y: 1.02 });
  },
  puddlepup(g, S, eyes) {
    const fur = '#e6eef4', grey = '#c3d2de';
    // its own puddle, which grows as it does
    const pr = .9 + S.f * .5;
    put(g, G('Cylinder', pr, pr, .05, 7), M('#7cc4ee', { transparent: true, opacity: .85 }), 0, .03, 0);
    const body = new THREE.Group(); body.position.y = .9; body.scale.set(1.12, .86, 1.02); g.add(body);
    ico(body, 1, fur, 0, 0, 0, 1);
    for (const s of [-1, 1]) {
      const f = box(g, .5, .12, .34, grey, s * 1.0, .28, .25); f.rotation.set(0, s * .4, -s * .5);
      const tl = box(g, .22, .1, .46, grey, s * .16, .5, -1.02); tl.rotation.set(.7, s * .5, 0);
      put(g, G('Box', .22, .015, .015), M('#8a9aa6'), s * .62, .86, .8).rotation.set(0, -s * .5, s * .12);
      put(g, G('Box', .22, .015, .015), M('#8a9aa6'), s * .62, .78, .8).rotation.set(0, -s * .5, -s * .12);
    }
    if (S.f) for (const [x, y, z] of [[-.3, 1.62, -.2], [.25, 1.66, -.3], [0, 1.6, .2]].slice(0, S.f === 1 ? 3 : 2)) ico(g, .12, grey, x, y, z).scale.y = .4;
    face(g, eyes, { eye: S.eye, nose: '#2b2230', y: .98, z: .94, mouthY: .82, noseY: .9 });
  },
  // ----- found on expeditions -----
  sproutle(g, S, eyes) {
    const skin = '#a9d98a', shell = '#7a9a55';
    const sh = ico(g, 1, shell, 0, .8, -.15, 1); sh.scale.set(1.05, .78, 1.1);
    put(g, G('Cylinder', 1.02, 1.1, .16, 7), M('#e9dcae'), 0, .42, -.15);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; ico(g, .26, '#8fb36a', Math.sin(a) * .5, 1.42 - (i ? .12 : 0), -.15 + Math.cos(a) * .5).scale.y = .4; }
    ico(g, .56, skin, 0, .82, .78, 1);
    for (const [x, z] of [[-.7, .45], [.7, .45], [-.7, -.7], [.7, -.7]]) box(g, .34, .3, .36, skin, x, 0, z);
    cone(g, .14, .3, 4, skin, 0, .45, -1.2).rotation.x = -1.2;
    // the sprout: two leaves on a baby, a small bush with a flower on an adult
    const st = new THREE.Group(); st.position.set(0, 1.5, -.2); g.add(st);
    cyl(st, .05, .06, .3 + S.f * .3, 4, '#5fb04a');
    for (let i = 0; i < 2 + Math.round(S.f * 3); i++) { const a = i * 2.4, l = put(st, G('Octahedron', .2 + S.f * .08, 0), M(i % 2 ? '#86cc5a' : '#5fb04a'), Math.sin(a) * .2, .3 + S.f * .3 + (i % 3) * .08, Math.cos(a) * .2); l.scale.set(1.2, .35, .8); l.rotation.y = a; }
    if (S.f === 1) put(st, G('Octahedron', .16, 0), M('#ff9fb8'), 0, .85, 0);
    face(g, eyes, { eye: S.eye * .8, y: .92, z: 1.3, gap: .24, mouthY: .72, noseY: .8, nose: '#7a9a55' });
  },
  petalpuff(g, S, eyes) {
    const wool = '#fff6ea', skin = '#f3d2c1';
    ico(g, 1, wool, 0, .98, -.1, 1);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; ico(g, .42, i % 2 ? '#ffffff' : wool, Math.sin(a) * .78, 1 + Math.cos(a * 2) * .2, -.1 + Math.cos(a) * .78); }
    ico(g, .5, wool, 0, 1.85, 0); ico(g, .34, '#ffffff', 0, .7, -1.05);
    const hd = ico(g, .6, skin, 0, 1, .68, 1); hd.scale.set(1, .92, .8);
    for (const s of [-1, 1]) { box(g, .36, .14, .2, skin, s * .7, 1.12, .6).rotation.z = -s * .5; box(g, .24, .3, .26, '#6b5a66', s * .4, 0, .3); box(g, .24, .3, .26, '#6b5a66', s * .4, 0, -.6); }
    // the flower crown: one bud, then a full ring
    const n = 1 + Math.round(S.f * 5), cols = ['#ff9fb8', '#ffc94d', '#c8a2f2', '#ff7a7a', '#ffffff', '#ffb36b'];
    for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : (i / (n - 1) - .5) * 2.4, f = new THREE.Group(); f.position.set(Math.sin(a) * .52, 1.58, .62 + Math.cos(a) * .22); g.add(f);
      put(f, G('Octahedron', .15, 0), M(cols[i]), 0, 0, 0).scale.y = .55; put(f, G('Box', .08, .1, .08), M('#fff3a0'), 0, .05, 0); }
    face(g, eyes, { eye: S.eye * .85, y: 1.06, z: 1.13, gap: .25, mouthY: .86, noseY: .93 });
  },
  toastoad(g, S, eyes) {
    const crust = '#c98d4f', crumb = '#f6dba6';
    box(g, 1.8, 1.3, 1.5, crust, 0, .12, 0); ico(g, .98, crumb, 0, .78, .12, 1).scale.set(.82, .62, .78);
    for (const s of [-1, 1]) { ico(g, .36, crust, s * .5, 1.55, .35, 1); box(g, .5, .2, .6, crust, s * .85, 0, .35).rotation.y = s * .5; box(g, .44, .34, .5, crust, s * .8, 0, -.5); }
    // butter melts on top once it is older
    if (S.f) { box(g, .5 + S.f * .2, .12, .5 + S.f * .2, '#ffe07a', 0, 1.42, -.25).rotation.y = .4; if (S.f === 1) box(g, .9, .05, .7, '#ffe9a0', .1, 1.4, -.2).rotation.y = .4; }
    for (const [x, y] of [[-.5, .5], [.55, .7], [-.2, .35], [.3, .4]].slice(0, 2 + Math.round(S.f * 2))) put(g, G('Box', .12, .12, .04), M('#a86f3a'), x, y, .76);
    const ink = M('#2b2230', { roughness: .5 });
    for (const s of [-1, 1]) { const e = put(g, G('Cylinder', .13 * S.eye, .13 * S.eye, .06, 6), ink, s * .5, 1.6, .7); e.rotation.x = Math.PI / 2; eyes.push(e); put(g, G('Box', .05, .05, .02), M('#ffffff'), s * .5 + .04, 1.65, .74);
      put(g, G('Circle', .12, 6), new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: .6 }), s * .6, 1.0, .77); }
    put(g, G('Box', .5, .05, .04), ink, 0, 1.08, .77);
  },
  flickit(g, S, eyes) {
    const down = '#ffe27a';
    const body = ico(g, .95, down, 0, .95, 0, 1); body.scale.set(1, .98, .95);
    for (const s of [-1, 1]) { box(g, .2, .5 + S.f * .2, .5, '#ffd24d', s * .92, .6, -.05).rotation.z = s * .35; box(g, .22, .08, .34, '#ff9a3c', s * .3, 0, .3); }
    cone(g, .14, .3, 4, '#ff9a3c', 0, .8, .95).rotation.x = Math.PI / 2;
    cone(g, .2, .4, 4, down, 0, .6, -.9).rotation.x = -2;
    // the candle flame: a spark on a baby, a tall flame on an adult
    const t = new THREE.Group(), fk = .45 + S.f * .65; t.position.set(0, 1.85, 0); t.scale.setScalar(fk); t.userData.flame = true; g.add(t);
    cyl(t, .1, .12, .2, 5, '#fff6ea', 0, -.1, 0);
    put(t, G('Cone', .3, .9, 5), M('#ff8a3c', { emissive: '#ff5a1c', emissiveIntensity: .4 }), 0, .55, 0);
    put(t, G('Cone', .17, .5, 5), M('#ffd65a', { emissive: '#ffb020', emissiveIntensity: .6 }), 0, .4, .08);
    face(g, eyes, { eye: S.eye, y: 1.12, z: .86, gap: .32, mouthY: 2.9, noseY: 2.9 });
  },
  bubblefin(g, S, eyes) {
    const sc = '#ff9d6b', fin = '#ffcf7a';
    const body = ico(g, .8, sc, 0, 1.05, 0, 1); body.scale.set(.85, 1, 1.05);
    const tl = put(g, G('Cone', .5, .6, 4), M(fin), 0, 1.05, -1.05); tl.rotation.x = Math.PI / 2; tl.scale.x = .35;
    const top = put(g, G('Cone', .36, .5 + S.f * .3, 4), M(fin), 0, 1.9, -.1); top.scale.x = .3;
    for (const s of [-1, 1]) { const f = box(g, .08, .34, .4, fin, s * .72, .8, .05); f.rotation.z = s * .7; }
    // its bubble, with more little ones as it grows
    put(g, G('Icosahedron', 1.25, 1), M('#bfeaff', { transparent: true, opacity: .32, roughness: .2 }), 0, 1.1, 0);
    for (const [x, y, z, r] of [[.9, 2.3, .2, .16], [-.8, 2.5, -.3, .12], [.3, 2.75, -.5, .1]].slice(0, Math.round(S.f * 3))) put(g, G('Icosahedron', r, 0), M('#bfeaff', { transparent: true, opacity: .5 }), x, y, z);
    face(g, eyes, { eye: S.eye, y: 1.15, z: .78, gap: .3, mouthY: .95, noseY: 2.9 });
  },
  axolily(g, S, eyes) {
    const skin = '#ffc2d4', pad = '#6fbf73';
    const body = ico(g, .8, skin, 0, .7, -.5, 1); body.scale.set(.9, .75, 1.3);
    const hd = ico(g, .78, skin, 0, 1, .5, 1); hd.scale.set(1.2, .9, .9);
    const tl = put(g, G('Cone', .4, 1, 4), M('#ffa9c2'), 0, .6, -1.7); tl.rotation.x = -Math.PI / 2; tl.scale.x = .3;
    for (const [x, z] of [[-.6, .1], [.6, .1], [-.6, -1], [.6, -1]]) box(g, .3, .2, .3, skin, x, 0, z);
    // lily pad gills: three little pads a side, growing into wide ones with a blossom
    const r = .2 + S.f * .16;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const l = put(g, G('Cylinder', r, r, .05, 6), M(i === 1 ? '#86cc5a' : pad), s * (.95 + (i === 1 ? .2 : 0)), 1 + (i - 1) * .42, .35); l.rotation.set(0, 0, s * (1.1 - (i - 1) * .35)); }
    if (S.f === 1) { const f = new THREE.Group(); f.position.set(.3, 1.75, .45); g.add(f); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; put(f, G('Octahedron', .12, 0), M('#ffffff'), Math.cos(a) * .13, 0, Math.sin(a) * .13).scale.y = .5; } put(f, G('Box', .1, .1, .1), M('#ffc94d'), 0, .04, 0); }
    face(g, eyes, { eye: S.eye * .9, y: 1.08, z: 1.17, gap: .42, mouthY: .86, noseY: 2.9 });
  },
  zapkit(g, S, eyes) {
    const fur = '#ffe066', dark = '#5a4a3a';
    const body = new THREE.Group(); body.position.y = .95; body.scale.set(1.02, .93, .96); g.add(body); ico(body, 1, fur, 0, 0, 0, 1);
    for (const s of [-1, 1]) {
      const e = put(g, G('Cone', .32, .6, 4), M(fur), s * .55, 1.85, 0); e.rotation.y = Math.PI / 4; e.rotation.z = -s * .25; e.scale.z = .6;
      const t = put(g, G('Cone', .16, .28, 4), M(dark), s * .59, 2.03, 0); t.rotation.y = Math.PI / 4; t.rotation.z = -s * .25; t.scale.z = .62;
      box(g, .32, .2, .44, fur, s * .4, 0, .6);
      for (let i = 0; i < 2; i++) put(g, G('Box', .28, .015, .015), M('#ffffff'), s * .72, .9 + i * .1, .78).rotation.set(0, -s * .5, s * (i ? .15 : -.1));
    }
    for (const x of [-.25, 0, .25].slice(0, 1 + Math.round(S.f * 2))) put(g, G('Box', .12, .3, .05), M(dark), x, 1.75, .5).rotation.x = -.5;
    // the lightning tail: one kink on a baby, three on an adult
    const t = new THREE.Group(); t.position.set(.2, .4, -.9); t.rotation.set(-.4, 0, -.2); g.add(t);
    const bolt = M('#ffd21f', { emissive: '#ffb300', emissiveIntensity: .5 }), n = 2 + Math.round(S.f * 2);
    for (let i = 0; i < n; i++) put(t, G('Box', .16, .5, .1), bolt, i % 2 ? .14 : -.14, .2 + i * .36, 0).rotation.z = i % 2 ? .6 : -.6;
    put(t, G('Cone', .14, .3, 4), bolt, n % 2 ? -.2 : .2, .2 + n * .36, 0);
    face(g, eyes, { eye: S.eye, y: 1.02 });
  },
  buzzlet(g, S, eyes) {
    const fuzz = '#ffd447', stripe = '#4a3a34';
    const body = ico(g, .95, fuzz, 0, 1.15, 0, 1); body.scale.set(1, .95, 1.05);
    for (const z of [-.15, -.6].slice(0, 1 + Math.round(S.f))) put(g, G('Cylinder', .93 - Math.abs(z + .1) * .35, .93 - Math.abs(z + .1) * .35, .22, 7), M(stripe), 0, 1.15, z).rotation.x = Math.PI / 2;
    cone(g, .14, .3, 4, stripe, 0, 1, -1.05).rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) {
      const w = put(g, G('Cylinder', .45 + S.f * .15, .45 + S.f * .15, .04, 6), M('#e6f6ff', { transparent: true, opacity: .7 }), s * .7, 2, -.2); w.rotation.set(.3, 0, s * .9); w.scale.z = .6;
      const an = box(g, .04, .4, .04, stripe, s * .25, 1.9, .5); an.rotation.set(.5, 0, -s * .3); ico(g, .09, stripe, s * .34, 2.3, .72);
      box(g, .1, .25, .1, stripe, s * .35, .15, .3);
    }
    // static fuzz sticks out more with age
    for (let i = 0; i < Math.round(S.f * 6); i++) { const a = i * 1.05, sp = put(g, G('Cone', .07, .28, 3), M('#fff3a0'), Math.sin(a) * .9, 1.2 + Math.cos(a * 1.7) * .5, -.2 + Math.cos(a) * .8); sp.lookAt(0, 1.15, 0); sp.rotateX(-Math.PI / 2); }
    face(g, eyes, { eye: S.eye, y: 1.22, z: .88, gap: .32, mouthY: 1.04, noseY: 2.9 });
  },
  voltvole(g, S, eyes) {
    const fur = '#f2c9a0', belly = '#fff3df';
    const body = new THREE.Group(); body.position.y = .92; body.scale.set(1.08, .9, .96); g.add(body); ico(body, 1, fur, 0, 0, 0, 1);
    ico(g, .6, belly, 0, .6, .52, 1).scale.set(1.1, .75, .7);
    for (const s of [-1, 1]) {
      ico(g, .24, fur, s * .55, 1.72, .05).scale.z = .5; ico(g, .13, '#f59ab0', s * .55, 1.72, .12).scale.z = .5;
      box(g, .26, .16, .36, '#f59ab0', s * .4, 0, .62); box(g, .16, .22, .16, '#f59ab0', s * .45, .5, .88);
      // glowing cheeks, bigger and brighter with age
      const c = put(g, G('Icosahedron', .22 + S.f * .14, 0), M('#ffe14d', { emissive: '#ffc400', emissiveIntensity: .3 + S.f * .6 }), s * .78, .82, .55); c.scale.z = .7;
      if (S.f === 1) put(g, G('Box', .1, .3, .05), M('#ffe14d', { emissive: '#ffc400', emissiveIntensity: .8 }), s * 1.2, 1.15, .5).rotation.z = -s * .6;
    }
    ico(g, .16, fur, 0, .5, -.98);
    face(g, eyes, { eye: S.eye, y: 1.08, gap: .28, blush: '#ffe14d', mouthY: .9, noseY: .98 });
  },
  pebblet(g, S, eyes) {
    const skin = '#ead9c0', st = ['#a9a6b0', '#8a8794', '#bdb9c4'];
    const body = ico(g, .95, '#8f8a86', 0, .9, -.15, 1); body.scale.set(1.02, .9, 1.05);
    const hd = ico(g, .7, skin, 0, .78, .5, 1); hd.scale.set(1, .9, .9);
    cone(g, .16, .34, 4, skin, 0, .56, 1.12).rotation.x = Math.PI / 2; ico(g, .08, '#2b2230', 0, .74, 1.4);
    for (const s of [-1, 1]) { ico(g, .15, skin, s * .5, 1.3, .55); box(g, .26, .18, .34, skin, s * .4, 0, .5); box(g, .26, .18, .3, skin, s * .4, 0, -.6); }
    // pebble spines: a few bumps, then a full coat of stones
    const n = 5 + Math.round(S.f * 9);
    for (let i = 0; i < n; i++) { const a = i * 2.4, v = .25 + (i / n) * 1.05, r = .2 + S.f * .08 + (i % 3) * .03;
      const p = put(g, G('Dodecahedron', r, 0), M(st[i % 3]), Math.sin(a) * Math.sin(v) * .93, .9 + Math.cos(v) * .86, -.15 - Math.abs(Math.cos(a)) * Math.sin(v) * .95); p.rotation.set(a, v, 0); }
    face(g, eyes, { eye: S.eye * .85, y: .92, z: 1.07, gap: .27, mouthY: 2.9, noseY: 2.9 });
  },
  cragcrab(g, S, eyes) {
    const shell = '#e2705a', rock = '#8f8a92';
    const b = ico(g, .9, shell, 0, .62, 0, 1); b.scale.set(1.25, .6, .9);
    // the boulder on its back grows and gathers moss
    const r = .7 + S.f * .3, bo = put(g, G('Dodecahedron', r, 0), M(rock), 0, .95 + r * .55, -.15); bo.scale.set(1.15, .85, 1);
    if (S.f) { ico(g, .3, '#a9a6b0', .5, 1.2 + r, -.1); put(g, G('Box', .5, .08, .4), M('#5fb04a'), -.2, .98 + r * 1.28, -.1).rotation.y = .5; }
    if (S.f === 1) cone(g, .12, .5, 4, '#bfeaff', .1, 1.25 + r, -.4);
    for (const s of [-1, 1]) {
      const arm = box(g, .5, .16, .16, shell, s * 1.15, .55, .45); arm.rotation.y = -s * .5;
      const c = put(g, G('Dodecahedron', .32 + S.f * .1, 0), M('#f08a72'), s * 1.45, .75, .8); c.scale.set(1, .8, 1.2);
      for (let i = 0; i < 3; i++) box(g, .5, .1, .1, shell, s * 1.2, .12, -.45 + i * .35).rotation.z = s * .7;
      box(g, .08, .4, .08, shell, s * .3, .95, .65); const e = put(g, G('Icosahedron', .15 * S.eye, 0), M('#2b2230', { roughness: .5 }), s * .3, 1.42, .68); eyes.push(e);
      put(g, G('Box', .05, .05, .02), M('#ffffff'), s * .3 + .04, 1.47, .8);
    }
    put(g, G('Box', .3, .05, .04), M('#2b2230'), 0, .62, .86);
  },
  dustmole(g, S, eyes) {
    const fur = '#8a6f63', paw = '#f3c9b5';
    const body = new THREE.Group(); body.position.y = .88; body.scale.set(1.05, .88, 1); g.add(body); ico(body, 1, fur, 0, 0, 0, 1);
    ico(g, .5, '#a58a7d', 0, .55, .6, 1).scale.set(1.1, .7, .7);
    cone(g, .26, .5, 5, paw, 0, .72, 1.05).rotation.x = Math.PI / 2; ico(g, .1, '#ff8fa6', 0, .98, 1.3);
    for (const s of [-1, 1]) { const h = box(g, .42, .12, .46, paw, s * .92, .45, .5); h.rotation.set(0, s * .5, -s * .4); for (let i = 0; i < 3; i++) cone(g, .05, .16, 3, '#fff3df', s * (.95 + i * .12), .42, .82 - i * .05).rotation.x = Math.PI / 2; box(g, .3, .14, .36, paw, s * .4, 0, -.2); }
    // the hard hat: too big for a baby, with a lamp once grown
    const hat = new THREE.Group(); hat.position.set(0, 1.62, .1); hat.rotation.x = -.12; hat.scale.setScalar(1.15 - S.f * .2); g.add(hat);
    put(hat, G('Sphere', .62, 7, 3, 0, 6.284, 0, 1.571), M('#ffc94d')); put(hat, G('Cylinder', .78, .78, .07, 8), M('#f2b632'), 0, .02, .08); box(hat, .12, .5, .1, '#f2b632', 0, .15, 0).rotation.x = Math.PI / 2;
    if (S.f) put(hat, G('Cylinder', .14, .16, .12, 6), M('#fff6c0', { emissive: '#ffe680', emissiveIntensity: S.f }), 0, .3, .58).rotation.x = Math.PI / 2;
    face(g, eyes, { eye: S.eye * .6, y: 1.12, z: .86, gap: .26, mouthY: 2.9, noseY: 2.9 });
  },
};

export function petModel(sp, form = 0) {
  const g = new THREE.Group(), S = FORM[form] || FORM[0], eyes = [];
  (PETS[sp] || PETS.mossbun)(g, S, eyes);
  g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  g.scale.setScalar(S.k);
  g.userData = { eyes, k: S.k, flame: null };
  g.traverse(o => { if (o.userData.flame) g.userData.flame = o; });
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

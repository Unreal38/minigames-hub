// Copycat Isle's 3D scene: the island (layout.js), everyone's avatars, the disguises, the seeker's pet and the effects.
// The page (client.js) owns the rules, the buttons and your own walking; this file draws.
//
// Fair look: a copied thing must look exactly like the real ones. Every copyable thing is built by one function
// (propModel), the standing ones are merged into one mesh and the copies are clones of the same model, and none of
// them casts a real shadow (a soft blob under each instead), so nothing tells a seeker which bench is a person.
// Cost rules (the Plaza's): standing scenery merged (mergeStatic), its shadows drawn once, people get blobs.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { island, skyDome, clouds, nightScene, birds, flat, put, toonify, createFx, STAR, HEART, DOT, hash, mergeStatic, lightBulbs, PROPS as RIM } from '../../scenery3d.js';
import { SP, lookOf } from '../../season3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { itemModel } from '../farm/models.js';
import { formOf } from '../farm/data.js';
import { frameLoop, autoResolution, AA, gfx } from '../../frames.js';
import * as LY from './layout.js';

const { SIZE, HILL, RAMP, POND, BARN, FORT, HUT, KINDS, PROPS, WALLS, TOWERS, SCENERY, heightAt, inBarn, wallRuns } = LY;
export const KIND_LIST = Object.keys(KINDS);
const K = .72;              // avatars are drawn at this size, the scale on a wrapper (standing-avatar rule)
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); return (a < 0 ? a + Math.PI * 2 : a) - Math.PI; };
const box = (p, w, h, d, c, x, y, z, ry = 0) => { const o = put(p, new THREE.BoxGeometry(w, h, d), flat(c), x, y, z); o.rotation.y = ry; return o; };
const cyl = (p, r1, r2, h, c, x, y, z, n = 8) => put(p, new THREE.CylinderGeometry(r1, r2, h, n), flat(c), x, y, z);
const ico = (p, r, c, x, y, z) => put(p, new THREE.IcosahedronGeometry(r, 0), flat(c), x, y, z);

// ---------- the things you can turn into ----------
// Pet Farm decorations at the Plaza's sizes, the season props, and a few market things built here.
const FARM = { bench: 1.7, haybale: 1.5, lamp: 1.9, chest: 1.7, mailbox: 1.6, birdbath: 1.6, bush: 1.9, rock: 1.7, shrooms: 1.8, scarecrow: 1.6 };
const OWN = {
  crate(g) { box(g, .8, .8, .8, '#c9925a', 0, .4, 0); for (const y of [.07, .73]) box(g, .84, .12, .84, '#9c6b3c', 0, y, 0); box(g, .1, .62, .82, '#9c6b3c', 0, .4, 0).rotation.x = .78; },
  barrel(g) { cyl(g, .36, .36, .86, '#a36b3c', 0, .45, 0, 10); cyl(g, .4, .4, .9, '#b67d48', 0, .45, 0, 10).scale.set(.98, .9, .98); for (const y of [.2, .7]) cyl(g, .415, .415, .07, '#55565e', 0, y, 0, 10); cyl(g, .32, .32, .04, '#8a5a3c', 0, .91, 0, 10); },
  table(g) { cyl(g, .56, .56, .07, '#f7fbfd', 0, .78, 0, 12); cyl(g, .05, .07, .74, '#3c4250', 0, .38, 0, 6); cyl(g, .26, .3, .05, '#3c4250', 0, .025, 0, 8); cyl(g, .09, .07, .14, '#ff8fab', .18, .88, .08, 8); },
  chair(g) { box(g, .5, .07, .5, '#5aa9ff', 0, .46, 0); box(g, .5, .5, .07, '#5aa9ff', 0, .76, -.22); for (const [x, z] of [[-.2, .2], [.2, .2], [-.2, -.2], [.2, -.2]]) box(g, .06, .45, .06, '#f7fbfd', x, .225, z); },
  bucket(g) { cyl(g, .27, .21, .44, '#8fa3b8', 0, .22, 0, 10); cyl(g, .23, .23, .03, '#5cc0ee', 0, .4, 0, 10); const h = put(g, new THREE.TorusGeometry(.25, .02, 4, 10, Math.PI), flat('#55565e'), 0, .44, 0); h.rotation.y = .4; },
  pumpkin(g) { const p = put(g, new THREE.SphereGeometry(.45, 10, 7), flat('#ff8a2a'), 0, .34, 0); p.scale.set(1, .74, 1); const q = put(g, new THREE.SphereGeometry(.3, 8, 6), flat('#f07a1e'), 0, .34, 0); q.scale.set(1.5, .76, .62); cyl(g, .05, .07, .2, '#5b8a3a', 0, .72, 0, 5); ico(g, .1, '#5fb04a', .1, .66, .06).scale.set(1.3, .4, .9); },
};
const SEASON_PROP = { // sa, sb
  winter: [g => SP.gifts(g, 2), g => SP.snowman(g, 1.5)], spring: [g => SP.tulips(g, 2.3), g => SP.sunflower(g, 2)], summer: [g => SP.tulips(g, 2.3), g => SP.sunflower(g, 2)],
  autumn: [g => SP.pumpkin(g, 1.6), g => SP.sunflower(g, 2)], halloween: [g => SP.jack(g, 1.6), g => SP.sunflower(g, 2)],
};
// A copyable thing as a baked group sitting on y = 0 (raw: not outlined yet).
function propModel(kind, season) {
  const g = new THREE.Group();
  if (FARM[kind]) { const m = itemModel(kind, false, true); m.scale.setScalar(FARM[kind]); g.add(m); }
  else if (kind === 'sa' || kind === 'sb') { const w = new THREE.Group(); (SEASON_PROP[season] || SEASON_PROP.winter)[kind === 'sa' ? 0 : 1](w); bake(w); g.add(w); }
  else { const w = new THREE.Group(); (OWN[kind] || OWN.crate)(w); bake(w); g.add(w); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

// ---------- the island ----------
function walls(stat, winter) {
  const SNOWC = '#f6faff';
  for (const w of WALLS) {
    const [ax, , , at, h, look, th] = w;
    for (const [a, b] of wallRuns(w)) {
      const L = b - a, m = (a + b) / 2, X = ax === 'x' ? m : at, Z = ax === 'x' ? at : m, wx = ax === 'x' ? L : th, wz = ax === 'x' ? th : L;
      if (look === 'barn') { box(stat, wx, h, wz, '#c0463e', X, h / 2, Z); for (const y of [.9, 1.9]) box(stat, ax === 'x' ? L + .02 : th + .04, .08, ax === 'x' ? th + .04 : L + .02, '#a93a33', X, y, Z); box(stat, ax === 'x' ? L + .04 : th + .06, .16, ax === 'x' ? th + .06 : L + .04, '#f7fbfd', X, h - .06, Z); }
      else if (look === 'fence') {
        const n = Math.max(1, Math.round(L / 1.1));
        for (let k = 0; k <= n; k++) { const t = a + L * k / n; box(stat, .12, h, .12, '#8a5a3c', ax === 'x' ? t : at, h / 2, ax === 'x' ? at : t); if (winter) box(stat, .16, .05, .16, SNOWC, ax === 'x' ? t : at, h + .025, ax === 'x' ? at : t); }
        for (const y of [.28, .58]) box(stat, ax === 'x' ? L : .06, .1, ax === 'x' ? .06 : L, '#b77b4a', X, y, Z);
      } else if (look === 'snow') {
        box(stat, wx, h - .1, wz, winter ? SNOWC : '#b9895a', X, (h - .1) / 2, Z);
        box(stat, ax === 'x' ? L + .02 : th + .08, .16, ax === 'x' ? th + .08 : L + .02, winter ? '#ffffff' : '#8a5a3c', X, h - .08, Z);
      } else { // hedge
        box(stat, wx, h - .1, wz, '#3f8c4a', X, (h - .1) / 2, Z);
        box(stat, ax === 'x' ? L + .02 : th + .08, .16, ax === 'x' ? th + .08 : L + .02, winter ? SNOWC : '#4f9a54', X, h - .08, Z);
      }
    }
  }
  for (const [x, z] of TOWERS) { box(stat, 1.3, 1.8, 1.3, winter ? '#eef6fb' : '#a87a4c', x, .9, z); box(stat, 1.42, .2, 1.42, winter ? '#ffffff' : '#7a5236', x, 1.85, z); for (const [dx, dz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) box(stat, .3, .3, .3, winter ? '#ffffff' : '#7a5236', x + dx, 2.1, z + dz); }
  // the barn's door beams
  for (const w of WALLS) if (w[5] === 'barn' && w[7]) for (const [a, b] of w[7]) box(stat, w[0] === 'x' ? b - a : .36, .5, w[0] === 'x' ? .36 : b - a, '#f7fbfd', w[0] === 'x' ? (a + b) / 2 : w[3], w[4] - .25, w[0] === 'x' ? w[3] : (a + b) / 2);
}

function pine(g, s, winter) { if (winter) SP.snowpine(g, s); else RIM.pine(g, s); }

function hut(g, winter) {
  box(g, 3, 2, .3, '#e8a85a', 0, 1, -1.35); for (const x of [-1.35, 1.35]) box(g, .3, 2, 3, '#e8a85a', x, 1, 0);
  for (const y of [.5, 1.2]) box(g, 3.04, .08, .34, '#d08f45', 0, y, -1.35);
  box(g, 3.6, .3, 3.6, '#b04a4a', 0, 2.15, 0); if (winter) box(g, 3.3, .14, 3.3, '#f6faff', 0, 2.37, 0); else box(g, 2.4, .5, 2.4, '#c25858', 0, 2.5, 0);
  // a paw sign over the door
  const s = new THREE.Group(); s.position.set(0, 2.62, 1.55); g.add(s); box(s, .9, .6, .08, '#fff4e2', 0, 0, 0);
  ico(s, .14, '#7a5236', 0, -.08, .06).scale.set(1, .8, .4); for (const [x, y] of [[-.18, .12], [-.06, .19], [.06, .19], [.18, .12]]) ico(s, .06, '#7a5236', x, y, .06).scale.z = .4;
  box(g, 2.2, .08, 1.6, '#c94f6e', 0, .04, 0); // a rug inside
}
function stall(g, cloth, winter) {
  box(g, 3.2, .9, 1, '#c9925a', 0, .45, 0); box(g, 3.26, .1, 1.06, '#9c6b3c', 0, .92, 0);
  for (const sx of [-1.5, 1.5]) box(g, .12, 2.4, .12, '#7a5236', sx, 1.2, -.4);
  box(g, 3.4, .12, 1.6, cloth, 0, 2.42, 0); for (let i = 0; i < 6; i++) box(g, .56, .2, .06, i % 2 ? '#ffffff' : cloth, -1.42 + i * .57, 2.3, .8);
  if (winter) box(g, 3.3, .06, 1.5, '#f6faff', 0, 2.51, 0);
  for (let i = 0; i < 4; i++) ico(g, .13, ['#ff5a6e', '#ffd23e', '#86cc5a', '#ff9a3c'][(i + cloth.length) % 4], -1.1 + i * .7, 1.06, .1);
}
function awning(g, winter) {
  box(g, 6, .12, 4, '#ff9ec4', 0, 2.62, 0); for (let i = 0; i < 10; i++) box(g, .58, .22, .06, i % 2 ? '#ffffff' : '#ff9ec4', -2.7 + i * .6, 2.48, 2.01);
  if (winter) box(g, 5.8, .06, 3.8, '#f6faff', 0, 2.71, 0);
  for (const [x, z] of [[-2.8, -1.8], [2.8, -1.8], [-2.8, 1.8], [2.8, 1.8]]) box(g, .14, 2.6, .14, '#f7fbfd', x, 1.3, z);
  box(g, 2, .5, .1, '#fff4e2', 0, 3.05, -1.9); // the café sign
  for (const x of [-.6, -.2, .2, .6]) box(g, .22, .24, .03, ['#7a5236', '#ff8fab', '#7a5236', '#ff8fab'][(x * 5 + 3) & 3], x, 3.05, -1.84);
}
function boat(g) {
  box(g, 3.2, .7, 1.4, '#5aa9ff', 0, .35, 0); box(g, 2.8, .1, 1.1, '#b77b4a', 0, .62, 0); box(g, .3, .55, 1.44, '#3f86d6', 1.7, .5, 0); box(g, .5, .08, 1.2, '#b77b4a', -.4, .8, 0);
  for (const z of [-.72, .72]) box(g, 3.1, .1, .06, '#ffffff', 0, .64, z);
}
function bigTree(g, winter) {
  if (winter) SP.snowpine(g, 3.6, true); // baubles and the star come with it
  else RIM.tree(g, 3.8);
}

function buildIsland(scene, season) {
  const winter = season === 'winter', look = lookOf(season) || {}, lawn = look.grass || '#8bca60';
  const C = 2 * (SIZE - 1.6);
  const base = island(C, C, { props: 0, rim: 1.6, flowers: 70, seed: 7, depth: 1.3, size: 1.2, season });
  // the island's own night lamps stand on its square outline and float off our rounded corners; the map has its own lamps
  const night = []; base.traverse(o => { if (o.userData.nightOnly) night.push(o); }); for (const o of night) o.removeFromParent();
  base.position.y = -.08; // the lawn's bevelled top is at +.08: sink it so the ground is y = 0, under the paving, rugs and shadows
  scene.add(base);
  const stat = new THREE.Group(), live = [];
  const pave = winter ? '#dfe3ee' : '#e8d9bd', paveD = winter ? '#c3c9da' : '#d9c3a0', stone = winter ? '#d9d6e0' : '#dccdb4';
  const slab = (w, d, c, x, z, top) => { const m = box(stat, w, top, d, c, x, top / 2, z); m.castShadow = false; return m; };
  // the square, its ring of darker stones, the paths
  slab(14.4, 14.4, paveD, 0, 0, .03); slab(13.6, 13.6, stone, 0, 0, .04);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; slab(.12, 3.6, paveD, Math.cos(a) * 4.6, Math.sin(a) * 4.6, .045).rotation.y = -a + Math.PI / 2; }
  slab(3, 15, pave, 0, -14.5, .02); slab(3, 6, pave, 0, 10, .02);
  slab(17, 3, pave, -15.5, 0, .02); slab(14, 3, pave, 14, 0, .02);
  slab(3, 5, pave, 11.5, -16, .02); slab(4.8, 2.8, pave, 10.4, -19.5, .025);
  slab(18, 16, winter ? '#e9e1d6' : '#e6d3b8', 17, 17, .025);
  for (let i = 0; i < 40; i++) { const x = 9 + hash(i, 3) * 16, z = 10 + hash(i, 4) * 14; slab(.6 + hash(i, 5) * .4, .5, winter ? '#d6cdc0' : '#d4bf9f', x, z, .03).rotation.y = hash(i, 6) * 3; }
  // the barn floor, the café floor
  slab(BARN.x2 - BARN.x1 - .2, BARN.z2 - BARN.z1 - .2, '#d9b27a', (BARN.x1 + BARN.x2) / 2, (BARN.z1 + BARN.z2) / 2, .03);
  slab(5.8, 3.8, '#f2e6d8', 20, 23, .035);
  slab(7.8, 7.3, winter ? '#e9e4ee' : '#9a6b46', -7, -21.75, .02); // the pumpkin patch's soil
  // the hill: rock sides, a lawn on top, a wooden ramp up, a low fence round the edge
  { const H = HILL, w = H.x2 - H.x1, d = H.z2 - H.z1;
    box(stat, w, H.h - .06, d, '#a8a196', (H.x1 + H.x2) / 2, (H.h - .06) / 2, (H.z1 + H.z2) / 2);
    for (let i = 0; i < 14; i++) box(stat, .5 + hash(i, 1) * .6, .3 + hash(i, 2) * .5, .1, '#8f8880', H.x1 + 1 + hash(i, 3) * (w - 2), .4 + hash(i, 4) * 1.2, H.z2 + .04);
    box(stat, w + .1, .12, d + .1, lawn, (H.x1 + H.x2) / 2, H.h - .06, (H.z1 + H.z2) / 2);
    const L = Math.hypot(RAMP.x2 - RAMP.x1, H.h), ang = Math.atan2(H.h, RAMP.x2 - RAMP.x1), r = box(stat, L + .3, .3, RAMP.z2 - RAMP.z1, '#b77b4a', (RAMP.x1 + RAMP.x2) / 2, H.h / 2 - .16, (RAMP.z1 + RAMP.z2) / 2);
    r.rotation.z = ang;
    for (let k = 0; k < 9; k++) { const u = (k + .5) / 9, s = box(stat, .08, .06, RAMP.z2 - RAMP.z1 - .04, '#8a5a3c', RAMP.x1 + u * (RAMP.x2 - RAMP.x1), u * H.h + .02, (RAMP.z1 + RAMP.z2) / 2); s.rotation.z = ang; }
    for (const z of [RAMP.z1 - .15, RAMP.z2 + .15]) { const rail = box(stat, L, .08, .08, '#8a5a3c', (RAMP.x1 + RAMP.x2) / 2, H.h / 2 + .6, z); rail.rotation.z = ang; for (let k = 0; k <= 3; k++) { const u = k / 3; box(stat, .1, .7, .1, '#8a5a3c', RAMP.x1 + .2 + u * (RAMP.x2 - RAMP.x1 - .4), u * H.h + .35, z); } }
    const fence = (ax, a, b, at) => { const n = Math.max(1, Math.round((b - a) / 1.2)); for (let k = 0; k <= n; k++) { const t = a + (b - a) * k / n; box(stat, .1, .6, .1, '#8a5a3c', ax === 'x' ? t : at, H.h + .3, ax === 'x' ? at : t); } box(stat, ax === 'x' ? b - a : .06, .08, ax === 'x' ? .06 : b - a, '#b77b4a', ax === 'x' ? (a + b) / 2 : at, H.h + .45, ax === 'x' ? at : (a + b) / 2); };
    fence('x', H.x1 + .2, H.x2 - .2, H.z2 - .2); fence('z', H.z1 + .2, RAMP.z1 - .3, H.x1 + .2); fence('z', RAMP.z2 + .3, H.z2 - .2, H.x1 + .2); }
  walls(stat, winter);
  // the pond: ice in winter, shallow water the rest of the year
  { const top = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), flat(winter ? '#9fd6f2' : '#6ec6f5', { roughness: .4 })); top.scale.set(POND.rx, 1, POND.rz); top.position.set(POND.x, .045, POND.z); top.receiveShadow = true; stat.add(top);
    const rim = new THREE.Mesh(new THREE.RingGeometry(.97, 1.06, 48).rotateX(-Math.PI / 2), flat(winter ? '#5fa9d6' : '#8a7a6a')); rim.scale.set(POND.rx, 1, POND.rz); rim.position.set(POND.x, .05, POND.z); stat.add(rim);
    if (winter) for (let i = 0; i < 9; i++) { const m = box(stat, .8 + hash(i, 8) * 1.6, .01, .07, '#ffffff', POND.x + (hash(i, 9) - .5) * 9, .055, POND.z + (hash(i, 10) - .5) * 6); m.rotation.y = hash(i, 11) * 3; }
    else for (let i = 0; i < 7; i++) { const a = i * 2.3, m = cyl(stat, .32, .32, .02, '#5fb04a', POND.x + Math.cos(a) * 4 * (.4 + hash(i, 2) * .6), .06, POND.z + Math.sin(a) * 3 * (.4 + hash(i, 3) * .6), 9); if (i % 3 === 0) ico(stat, .08, '#ff9fb8', m.position.x, .1, m.position.z); }
    box(stat, 4, .2, 1.8, '#b77b4a', POND.x + POND.rx - .6, .12, POND.z - 1); for (const [dx, dz] of [[-1.8, -.8], [-1.8, .8], [1.8, -.8], [1.8, .8]]) cyl(stat, .09, .09, .5, '#8a5a3c', POND.x + POND.rx - .6 + dx, .2, POND.z - 1 + dz, 6);
  }
  // scenery that can't be copied
  for (const [kind, x, z, ry, s] of SCENERY) {
    const y = heightAt(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    if (kind === 'tree') bigTree(g, winter);
    else if (kind === 'pine') pine(g, s, winter);
    else if (kind === 'hut') hut(g, winter);
    else if (kind === 'stall') stall(g, ['#ff5a6e', '#5aa9ff', '#ffd23e', '#86cc5a', '#b48cff'][Math.round(x + z) % 5 < 0 ? 0 : Math.round(x * 3 + z) % 5], winter);
    else if (kind === 'awning') awning(g, winter);
    else if (kind === 'boat') { boat(g); g.rotation.z = winter ? .1 : .04; g.position.y = winter ? .02 : -.12; }
    else if (kind === 'dock') continue;
    else if (kind === 'windmill' || kind === 'campfire') { const m = itemModel(kind, true); m.scale.setScalar(s); m.position.set(x, y + .02, z); m.rotation.y = ry; m.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noInk; o.receiveShadow = false; } }); scene.add(m); if (m.userData.tick) live.push(m); continue; }
    else { const m = itemModel(kind, false, true); m.scale.setScalar(s); g.add(m); }
    if (kind !== 'tree' && kind !== 'pine') bake(g);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    stat.add(g);
  }
  lightBulbs(stat); bake(stat);
  scene.add(mergeStatic(stat, .05));
  // the barn roof: its own mesh, so it can go see-through while you are inside
  const roof = new THREE.Group();
  { const B = BARN, w = B.x2 - B.x1 + .8, d = (B.z2 - B.z1) / 2 + .6;
    for (const sd of [-1, 1]) { const m = box(roof, w, .25, d * 1.15, '#7a3a34', 0, 3.8, sd * d / 2); m.rotation.x = sd * .55; if (winter) { const sn = box(roof, w - .1, .1, d * 1.1, '#f6faff', 0, 3.98, sd * d / 2 - sd * .1); sn.rotation.x = sd * .55; } }
    for (const x of [-w / 2, w / 2]) { const s = new THREE.Shape([new THREE.Vector2(-d * .98, 0), new THREE.Vector2(d * .98, 0), new THREE.Vector2(0, 1.4)]); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .2, bevelEnabled: false }), flat('#c0463e')); m.rotation.y = Math.PI / 2; m.position.set(x < 0 ? x + .15 : x - .35, B.h, 0); roof.add(m); }
    roof.position.set((B.x1 + B.x2) / 2, 0, (B.z1 + B.z2) / 2); bake(roof); roof.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    toonify(roof, .05); scene.add(roof); }
  return { live, roof };
}

export function createScene(canvas, opts = {}) {
  const season = opts.season || 'winter', winter = season === 'winter', level = gfx(), few = level === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = level !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .3, 700);
  scene.add(new THREE.HemisphereLight('#ffffff', winter ? '#dfe9ff' : '#ffe9c9', winter ? 1.75 : 2));
  const key = new THREE.DirectionalLight('#ffffff', winter ? 1.35 : 1.5); key.position.set(16, 30, 12); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 90 }); key.shadow.normalBias = .05; scene.add(key);
  skyDome(scene, winter ? '#6aa8e8' : '#4fa8f0', winter ? '#e4f1ff' : '#c9ecff'); scene.add(clouds({ near: 60, far: 16, below: -14, min: 36, max: 130 }));
  const fly = winter ? null : birds(scene, 36, 12, 4, 1.4);
  const { live, roof } = buildIsland(scene, season);

  // ground markers (rings, blobs) are pulled towards the camera in the depth test so they never flicker into the
  // ground or a paving slab, even far away where depth is coarse
  const LIFT = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 };
  // ---- the copyable things standing about: one merged mesh, no shadows, a blob each
  const tpl = new Map(); // kind -> an outlined model to clone for disguises and decoys
  const model = k => { let t = tpl.get(k); if (!t) tpl.set(k, t = toonify(propModel(k, season), .05)); const g = t.clone(); g.traverse(o => { if (o.isMesh) o.castShadow = false; }); return g; };
  { const stand = new THREE.Group();
    for (const [k, x, z, ry] of PROPS) { const g = propModel(k, season); g.position.set(x, heightAt(x, z), z); g.rotation.y = ry; stand.add(g); }
    const m = mergeStatic(stand, .05); m.traverse(o => { if (o.isMesh) o.castShadow = false; }); scene.add(m); }
  const BLOBS = PROPS.length + 80, blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1c2540', transparent: true, opacity: .2, depthWrite: false, ...LIFT }), BLOBS);
  blobs.frustumCulled = false; blobs.renderOrder = 1; scene.add(blobs);
  const bm = new THREE.Matrix4();
  let nStatic = 0;
  for (const [k, x, z] of PROPS) blobs.setMatrixAt(nStatic++, bm.makeScale(KINDS[k].r * 1.15, 1, KINDS[k].r * 1.15).setPosition(x, heightAt(x, z) + .06, z));

  const fx = createFx(scene, { max: 500 });
  // the target ring: what E (or a tap) would copy or boop
  const ring = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: .95, depthWrite: false, ...LIFT }));
  ring.visible = false; ring.renderOrder = 2; scene.add(ring);
  // the sniff ring round a seeker: how far the pet's nose reaches
  const sniffRing = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, ...LIFT }));
  sniffRing.renderOrder = 2; scene.add(sniffRing);
  nightScene(scene, { wx: { size: 40 } });
  res.prep(scene);

  // ---- people (one per seat) and the loose things (decoys, and to seekers the disguised hiders too)
  let seats = [], me = -1, queue = [];
  const folk = [], objs = new Map();
  let T = 0, mine = null;
  function dropSeat(m) {
    if (m.wrap) { scene.remove(m.wrap); disposeAvatar(m.av); m.wrap = m.av = null; }
    if (m.prop) { scene.remove(m.prop); m.prop = null; m.pk = -1; }
    if (m.pet) { scene.remove(m.pet.g); m.pet = null; }
  }
  function setSeats(list, mySeat) {
    me = mySeat;
    list.forEach((p, i) => {
      const m = folk[i], key = JSON.stringify([p.color, p.av]);
      if (m && m.key === key) { m.p = p; return; }
      if (m) dropSeat(m);
      folk[i] = { i, p, key, x: 0, z: 0, ry: 0, tx: 0, tz: 0, tr: 0, amt: 0, ph: 0, spd: 0, wrap: null, av: null, prop: null, pk: -1, vis: false, kind: -1, role: 0, ghost: false, dizzy: 0, pet: null, petKey: '', placed: false, sx: 0, sy: 0, on: false, lock: 0 };
      queue.push(folk[i]);
    });
    while (folk.length > list.length) dropSeat(folk.pop());
    seats = list;
  }
  function buildAv(m) {
    m.wrap = new THREE.Group(); m.wrap.rotation.order = 'YXZ'; m.wrap.scale.setScalar(K);
    m.av = avatar3d(m.p.color, m.p.av, { pose: 'stand', hand: false }); m.av.position.y = .76; m.av.traverse(o => { if (o.isMesh) o.castShadow = false; });
    m.wrap.add(m.av); m.wrap.visible = false; scene.add(m.wrap); m.ghost = false;
  }
  function setGhost(m, on) {
    if (!m.av || m.ghost === on) return; m.ghost = on;
    m.av.traverse(o => { if (!o.isMesh) return; if (on) { o.userData.mat0 ??= o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = o.material.side === THREE.BackSide ? .12 : .42; o.material.depthWrite = false; } else if (o.userData.mat0) { o.material.dispose(); o.material = o.userData.mat0; } });
  }
  function setPet(m, pet) {
    const k = pet ? JSON.stringify(pet) : '';
    if (m.petKey === k) return; m.petKey = k;
    if (m.pet) { scene.remove(m.pet.g); m.pet = null; }
    if (!pet) return;
    try { const f = formOf(pet.lv | 0), g = petModel(pet.sp, f, pet.look || null); g.scale.multiplyScalar(.5 + .07 * f); g.traverse(o => { if (o.isMesh) o.castShadow = false; });
      m.pet = { g, x: m.x - 1, z: m.z, ry: 0, ph: 0, sp: 0, seed: m.i * 7, hop: 0, sniffAt: -9 }; g.position.set(m.pet.x, 0, m.pet.z); scene.add(g); } catch { m.petKey = ''; }
  }
  function setKind(m, k) {
    if (m.pk === k) return;
    const was = m.pk;
    if (m.prop) { scene.remove(m.prop); m.prop = null; }
    m.pk = k;
    if (k >= 0) { m.prop = model(KIND_LIST[k]); m.prop.position.set(m.x, heightAt(m.x, m.z), m.z); m.prop.rotation.y = m.ry; scene.add(m.prop); }
    if (was !== -2 && m.placed) fx.puff(new THREE.Vector3(m.x, heightAt(m.x, m.z) + .5, m.z), { n: few ? 8 : 14, color: ['#ffffff', '#fff4e2'], size: .45, speed: 2.8 });
  }

  // The server's view of the match. S.a[i]: what you can see of seat i (null: nothing), S.o: the loose things.
  function snap(S) {
    for (let i = 0; i < folk.length; i++) {
      const m = folk[i], a = S.a?.[i], role = S.role?.[i] ?? 0;
      m.role = role; m.vis = !!a;
      if (!a) continue;
      const x = a[0] / LY.Q, z = a[1] / LY.Q, h = a[2] / 100;
      if (i !== me || !mine) { m.tx = x; m.tz = z; m.tr = h; if (!m.placed) { m.x = x; m.z = z; m.ry = h; } }
      m.placed = true;
      if (role === 1) { m.kind = -1; m.dizzy = a[3]; } else { m.kind = i === me && mine ? mine.k : a[4] ?? -1; m.lock = a[3]; m.dizzy = 0; }
    }
    // the loose things
    const seen = new Set();
    for (const [tok, qx, qz, h, k] of S.o || []) {
      seen.add(tok); const x = qx / LY.Q, z = qz / LY.Q;
      let o = objs.get(tok);
      if (o && o.k !== k) { scene.remove(o.g); o.g = model(KIND_LIST[k]); o.k = k; scene.add(o.g); fx.puff(new THREE.Vector3(o.x, heightAt(o.x, o.z) + .5, o.z), { n: few ? 8 : 14, color: ['#ffffff', '#fff4e2'], size: .45, speed: 2.8 }); }
      if (!o) { o = { tok, k, g: model(KIND_LIST[k]), x, z, ry: h / 100, tx: x, tz: z, tr: h / 100 }; objs.set(tok, o); scene.add(o.g); }
      o.tx = x; o.tz = z; o.tr = h / 100;
    }
    for (const [tok, o] of objs) if (!seen.has(tok)) { scene.remove(o.g); objs.delete(tok); }
  }
  // your own player, as the page walks it: { x, z, h, k, spd, dizzy, role }
  function setMine(p) { mine = p; const m = folk[me]; if (!m || !p) return; m.x = m.tx = p.x; m.z = m.tz = p.z; m.tr = p.h; m.spd = p.spd; m.kind = p.k; m.placed = true; }
  function setPets(list) { folk.forEach((m, i) => { m.petWant = list[i] || null; }); }

  // ---- camera: follows you from behind, turned by dragging (or keys); spectators get a slow look round
  const cam = { yaw: 0, el: .5, d: 9, ty: 0, te: .5, x: 0, z: 0, y: 0 };
  const setView = (yaw, el) => { cam.ty = cam.yaw = yaw; if (el !== undefined) cam.te = cam.el = el; };
  const turn = (dy, de = 0) => { cam.ty += dy; cam.te = Math.max(.12, Math.min(1.15, cam.te + de)); };
  const zoom = f => { cam.d = Math.max(5, Math.min(18, cam.d * f)); };
  let W = 0, H = 0, rw = 0, rh = 0;
  const ro = new ResizeObserver(es => { const b = es[es.length - 1].contentRect; rw = b.width; rh = b.height; }); ro.observe(canvas);

  // ---- what is under a tap, and what is in front of you
  const v3 = new THREE.Vector3();
  const things = () => { // every copyable/boopable thing on the island: [x, z, kind index, id]
    const out = PROPS.map((p, i) => [p[1], p[2], KIND_LIST.indexOf(p[0]), { p: i }]);
    for (const o of objs.values()) out.push([o.x, o.z, o.k, { d: o.tok }]);
    return out;
  };
  function pick(px, py) {
    const r = canvas.getBoundingClientRect(), x = px - r.left, y = py - r.top, rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let best = null, bd = 1e9;
    for (const [tx, tz, k, id] of things()) {
      const kd = KINDS[KIND_LIST[k]], ty = heightAt(tx, tz), n = Math.max(2, Math.ceil(kd.h / .6)), w = Math.max(.45, kd.r) + .1;
      for (let j = 0; j < n; j++) {
        const yy = ty + .2 + (kd.h - .3) * j / (n - 1);
        v3.set(tx, yy, tz).project(camera); if (v3.z > 1) continue;
        const sx = (v3.x * .5 + .5) * r.width, sy = (-v3.y * .5 + .5) * r.height;
        v3.set(tx + rx * w, yy, tz + rz * w).project(camera); const pr = Math.abs((v3.x * .5 + .5) * r.width - sx), dd = Math.hypot(sx - x, sy - y);
        if (dd < pr * 1.1 && dd / pr < bd) { bd = dd / pr; best = { ...id, x: tx, z: tz, k }; }
      }
    }
    return best;
  }
  // the best thing to act on from (x, z): near, and towards where the camera looks
  function aim(x, z, reach) {
    const fx_ = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); let best = null, bs = 1e9;
    for (const [tx, tz, k, id] of things()) {
      const r = KINDS[KIND_LIST[k]].r, d = Math.hypot(tx - x, tz - z) - r; if (d > reach) continue;
      const dl = Math.max(.01, Math.hypot(tx - x, tz - z)), cos = ((tx - x) * fx_ + (tz - z) * fz) / dl;
      if (cos < -.1 && d > .9) continue;
      const s = d + (1 - cos) * 2.2; if (s < bs) { bs = s; best = { ...id, x: tx, z: tz, k }; }
    }
    return best;
  }
  function target(t, color) {
    if (!t) { ring.visible = false; return; }
    const r = KINDS[KIND_LIST[t.k]].r + .3; ring.visible = true; ring.position.set(t.x, heightAt(t.x, t.z) + .12, t.z); ring.scale.setScalar(r); ring.material.color.set(color || '#ffd34d');
  }

  // ---- effects for the server's events
  const at = (x, z, y = 0) => new THREE.Vector3(x, heightAt(x, z) + y, z);
  const NOTE = ['#ffd34d', '#ff9fb8', '#9fd8ff', '#c9a8ff'];
  const pings = []; // squeak circles spreading on the ground
  const pingGeo = new THREE.RingGeometry(.9, 1, 40).rotateX(-Math.PI / 2);
  function squeak(x, z, own) {
    fx.burst(at(x, z, 1.1), { n: few ? 6 : 12, colors: NOTE, shape: own ? HEART : STAR, speed: 1.8, up: 3.6, size: .38, grav: 2, life: 1.3 });
    let p = pings.find(q => !q.on); if (!p) { if (pings.length > 8) return; p = { g: new THREE.Mesh(pingGeo, new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, depthWrite: false, ...LIFT })) }; p.g.renderOrder = 2; scene.add(p.g); pings.push(p); }
    p.on = true; p.t0 = T; p.g.position.copy(at(x, z, .09)); p.g.visible = true;
  }
  function caught(x, z, by, k) {
    const p = at(x, z, .7);
    fx.puff(p, { n: few ? 12 : 22, color: ['#ffffff', '#fff4e2', '#ffd34d'], size: .55, speed: 3.6 });
    fx.burst(p, { n: few ? 10 : 18, colors: ['#ffd34d', '#ff9fb8', '#ffffff'], shape: STAR, speed: 3.2, up: 4.6, size: .4, grav: 5, life: 1.2 });
    fx.confetti(at(x, z, 2.4), { n: by === me ? 60 : 28, w: 3, h: 3, s: by });
    void k;
  }
  function miss(s, x, z) {
    fx.puff(at(x, z, .4), { n: 8, color: ['#ffffff'], size: .35, speed: 2 });
    const m = folk[s]; if (m) fx.burst(at(m.x, m.z, 2), { n: 8, colors: ['#ffd34d', '#ffffff'], shape: STAR, speed: 1.2, up: 1.4, size: .3, grav: 1, life: 1.6 });
  }
  const SNIFF_C = ['#7fb6ff', '#7ee0d0', '#ffb547', '#ff5a6e'];
  function sniffed(s, lv) {
    const m = folk[s]; if (!m) return;
    if (m.pet) { m.pet.sniffAt = T; fx.puff(at(m.pet.x, m.pet.z, .4), { n: 10, color: [SNIFF_C[lv], '#ffffff'], size: .4, speed: 1.6 }); }
    if (s === me) { sniffRing.material.color.set(SNIFF_C[lv]); sniffRing.userData.t0 = T; }
  }
  function cheer(s) { const m = folk[s]; if (m) fx.burst(at(m.x, m.z, 2), { n: 12, colors: ['#ffd84a', '#ff9fb8', '#8a98ff', '#7ed3b2'], shape: STAR, speed: 2.4, up: 3.4, size: .3 }); }

  // ---- every frame
  let drawn = false, roofA = 1;
  function animate(m, dt) {
    const mineNow = m.i === me && mine;
    if (!mineNow) { const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz);
      if (d > 6) { m.x = m.tx; m.z = m.tz; m.spd = 0; }
      else if (d > .02) { const step = Math.min(d, Math.max(LY.SPEED * 1.15 * dt, d * dt * 6)); m.x += dx / d * step; m.z += dz / d * step; m.spd = Math.min(1.2, step / Math.max(dt, 1e-3) / LY.SPEED); }
      else m.spd = 0; }
    m.ry += wrapA(m.tr - m.ry) * Math.min(1, dt * 12);
    m.amt += ((m.spd > .05 ? Math.min(1, m.spd) : 0) - m.amt) * Math.min(1, dt * 10);
    m.ph += dt * 9.5 * Math.max(m.amt, .001);
    const y = heightAt(m.x, m.z), dizzy = mineNow ? mine.dizzy > 0 : m.dizzy;
    const showProp = m.vis && m.kind >= 0 && m.role === 0, showAv = m.vis && !showProp;
    if (showProp) setKind(m, m.kind); else if (m.prop) setKind(m, -1);
    if (m.prop) { m.prop.visible = true; m.prop.position.set(m.x, y + (m.amt > .05 ? Math.abs(Math.sin(m.ph * .5)) * .08 : 0), m.z); m.prop.rotation.y = m.ry; }
    if (m.wrap) {
      m.wrap.visible = showAv;
      if (showAv) {
        setGhost(m, m.role === 2);
        const float = m.role === 2 ? .35 + Math.sin(T * 2 + m.i) * .12 : 0;
        m.wrap.position.set(m.x, y + float, m.z); m.wrap.rotation.set(0, m.ry + (dizzy ? T * 14 : 0), 0);
        animateAvatar(m.av, T, { seed: m.i });
        const ud = m.av.userData;
        if (m.amt > .02 && m.role !== 2) { walkAvatar(m.av, m.ph, m.amt); ud.legs?.forEach(l => { l.rotation.z = 0; }); }
        else ud.legs?.forEach(l => { l.rotation.x = 0; l.rotation.z = 0; });
        // seekers waiting in the hut cover their eyes
        // (animateAvatar only resets the arms' swing, so their sideways angle is put back by hand once the hide ends)
        const cover = m.role === 1 && opts.stage?.() === 'hide';
        ud.arms?.forEach((a, k) => { a.userData.rz0 ??= a.rotation.z; if (cover) a.rotation.x = -2.5; a.rotation.z = a.userData.rz0 + (cover ? (k ? -.55 : .55) : 0); });
      }
    }
    // the seeker's pet trots behind, and sniffs about when asked
    const wantPet = m.role === 1 && m.vis ? m.petWant || null : null;
    setPet(m, wantPet);
    const p = m.pet;
    if (p) {
      const back = 1.1, gx = m.x - Math.sin(m.ry) * back + Math.cos(m.ry) * .5, gz = m.z - Math.cos(m.ry) * back - Math.sin(m.ry) * .5;
      const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
      if (d > 8) { p.x = gx; p.z = gz; }
      else if (d > .18) { const step = Math.min(d - .1, Math.max(LY.SPEED * 1.2 * dt * Math.min(1, d), d * dt * 3)); p.x += dx / d * step; p.z += dz / d * step; p.sp += (1 - p.sp) * Math.min(1, dt * 8); p.ry += wrapA(Math.atan2(dx, dz) - p.ry) * Math.min(1, dt * 9); }
      else p.sp += (0 - p.sp) * Math.min(1, dt * 6);
      p.ph += dt * (6 + p.sp * 8);
      const sn = T - p.sniffAt, snif = sn < 1.6;
      let py = Math.abs(Math.sin(p.ph)) * .16 * p.sp; if (snif) py = Math.abs(Math.sin(sn * 10)) * .2;
      p.g.position.set(p.x, heightAt(p.x, p.z) + py, p.z); p.g.rotation.set(snif ? .25 : 0, p.ry + (snif ? Math.sin(sn * 7) * .5 : 0), 0);
      p.g.visible = m.vis;
      wiggle(p.g, T, p.seed, snif ? 1 : p.sp * .6);
    }
  }
  const T0 = performance.now() / 1000;
  const loop = frameLoop(dt => {
    if (!canvas.isConnected) return;
    if (rw !== W || rh !== H) { W = rw; H = rh; if (W && H) { renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); } }
    if (!W || !H) return;
    T = performance.now() / 1000 - T0;
    if (queue.length) { const t0 = performance.now(); while (queue.length && performance.now() - t0 < (drawn ? 6 : 40)) { const m = queue.shift(); if (folk[m.i] === m && !m.wrap) buildAv(m); } }
    let nb = nStatic;
    for (const m of folk) { animate(m, dt);
      if (!m.vis || nb >= BLOBS) continue;
      const r = m.prop ? KINDS[KIND_LIST[m.pk]].r * 1.15 : m.role === 2 ? 0 : .42;
      if (r) blobs.setMatrixAt(nb++, bm.makeScale(r, 1, r).setPosition(m.x, heightAt(m.x, m.z) + .06, m.z));
      if (m.pet && nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.3, 1, .3).setPosition(m.pet.x, heightAt(m.pet.x, m.pet.z) + .06, m.pet.z)); }
    for (const o of objs.values()) {
      const dx = o.tx - o.x, dz = o.tz - o.z, d = Math.hypot(dx, dz);
      if (d > 6) { o.x = o.tx; o.z = o.tz; } else if (d > .02) { const step = Math.min(d, Math.max(LY.SPEED * 1.15 * dt, d * dt * 6)); o.x += dx / d * step; o.z += dz / d * step; }
      o.ry += wrapA(o.tr - o.ry) * Math.min(1, dt * 12);
      o.g.position.set(o.x, heightAt(o.x, o.z) + (d > .05 ? Math.abs(Math.sin(T * 8)) * .08 : 0), o.z); o.g.rotation.y = o.ry;
      if (nb < BLOBS) { const r = KINDS[KIND_LIST[o.k]].r * 1.15; blobs.setMatrixAt(nb++, bm.makeScale(r, 1, r).setPosition(o.x, heightAt(o.x, o.z) + .06, o.z)); } }
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    // camera
    const m = folk[me];
    const fx0 = m && m.placed ? m.x : 0, fz0 = m && m.placed ? m.z : 0;
    if (!m || !m.placed) { cam.ty += dt * .05; cam.te = .62; }
    { const k = Math.min(1, dt * 8); cam.x += (fx0 - cam.x) * k; cam.z += (fz0 - cam.z) * k; cam.y += (heightAt(fx0, fz0) - cam.y) * k; }
    { const k = Math.min(1, dt * 14); cam.yaw += (cam.ty - cam.yaw) * k; cam.el += (cam.te - cam.el) * k; }
    const inside = m && m.placed && inBarn(m.x, m.z), el = inside ? Math.max(cam.el, 1.05) : cam.el, d = (m && m.placed ? cam.d : 46) * (inside ? 1.05 : 1);
    const lx = cam.x, ly = cam.y + (m && m.placed ? 1.4 : 0), lz = cam.z;
    camera.position.set(lx + Math.sin(cam.yaw) * Math.cos(el) * d, ly + Math.sin(el) * d, lz + Math.cos(cam.yaw) * Math.cos(el) * d);
    if (camera.position.y < .6) camera.position.y = .6;
    camera.lookAt(lx, ly, lz);
    // the barn roof fades while you are inside
    const want = inside ? 0 : 1; if (Math.abs(roofA - want) > .01) { roofA += (want - roofA) * Math.min(1, dt * 8); if (Math.abs(roofA - want) < .02) roofA = want; roof.visible = roofA > .03; }
    // squeak rings and the sniff ring
    for (const p of pings) { if (!p.on) continue; const u = (T - p.t0) / 1.4; if (u >= 1) { p.on = false; p.g.visible = false; continue; } p.g.scale.setScalar(.5 + u * 4); p.g.material.opacity = (1 - u) * .9; }
    { const t0 = sniffRing.userData.t0, u = t0 === undefined ? 1 : (T - t0) / 1.8; sniffRing.visible = u < 1 && !!m; if (sniffRing.visible) { sniffRing.position.set(m.x, heightAt(m.x, m.z) + .1, m.z); sniffRing.scale.setScalar(LY.SNIFF_R * Math.min(1, u * 3)); sniffRing.material.opacity = (1 - u) * .85; } }
    if (ring.visible) ring.material.opacity = .85 + Math.sin(T * 4) * .1; // a gentle glow, not a blink
    for (const g of live) g.userData.tick(T, {}, g);
    fly?.(T);
    fx.update(dt, camera, H);
    if (!drawn) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    // where heads are on screen, for the name tags
    for (const f of folk) { const y = heightAt(f.x, f.z) + (f.prop ? KINDS[KIND_LIST[f.pk]].h + .45 : f.role === 2 ? 2.4 : 2.05);
      v3.set(f.x, y, f.z).project(camera); f.on = f.vis && f.placed && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.15; f.sx = (v3.x * .5 + .5) * W; f.sy = (-v3.y * .5 + .5) * H;
      f.dist = camera.position.distanceTo(v3.set(f.x, y, f.z)); }
    opts.frame?.(folk, W, H);
    if (!drawn) { drawn = true; opts.ready?.(); }
  }, { onSlow: () => res.lower() });

  return {
    setSeats, snap, setMine, setPets, turn, zoom, setView, pick, aim, target, squeak, caught, miss, sniffed, cheer,
    yaw: () => cam.yaw,
    project(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x * .5 + .5) * W, (-v3.y * .5 + .5) * H, v3.z < 1]; },
    objects: () => [...objs.values()].map(o => [o.x, o.z, o.k]),
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: loop.fps() }),
    lost: () => renderer.getContext().isContextLost(),
    dispose() { loop.stop(); ro.disconnect(); for (const m of folk) dropSeat(m); for (const o of objs.values()) scene.remove(o.g); objs.clear(); fx.dispose();
      scene.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) if (!mt.userData?.shared) mt.dispose(); } }); renderer.dispose(); renderer.forceContextLoss(); },
  };
}

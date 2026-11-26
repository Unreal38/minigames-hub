// The profile isle and its variants: the ground theme, the rock underneath, the sky, and up to three decorations from
// the player's Pet Farm. What a player picked rides in their flair (cosmetics.js kinds ig, ib, ik, and the list ip);
// the indexes here match those lists, so only ever append.
//
//   buildIsle(look)        look = { ig, ib, ip: ['windmill', ..] }  ->  { root, tick(T), air, dispose() }
//   pieceModel(id)         one of the game pieces that float round the isle
//   buildSky(ik, opts)     the backdrop                 ->  { root, tick(T), mood, dispose() }   mood: '' (follows the site's day/night switch), 'day', 'night' or 'sunset'
//
// Still parts are merged (bake) and outlined once; anything that moves sits in a group flagged dyn with its own outline.
import * as THREE from 'three';
import { bake } from './avatar3d.js';
import { island, toonify, disposeToon, hash, put, ico, flat, rough } from './scenery3d.js';

const PI = Math.PI;
const box = (p, w, h, d, c, x = 0, y = 0, z = 0) => put(p, new THREE.BoxGeometry(w, h, d), flat(c), x, y, z);
const cyl = (p, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 6) => put(p, new THREE.CylinderGeometry(rt, rb, h, seg), flat(c), x, y, z);
const cone = (p, r, h, c, x = 0, y = 0, z = 0, seg = 6) => put(p, new THREE.ConeGeometry(r, h, seg), flat(c), x, y, z);
// Unlit, so it reads as glowing by day and by night.
const glow = (p, geo, c, x = 0, y = 0, z = 0, o = {}) => { const m = put(p, geo, new THREE.MeshBasicMaterial({ color: c, ...o }), x, y, z); m.userData.noInk = true; return m; };
const dyn = p => { const g = new THREE.Group(); g.userData.dyn = true; p.add(g); return g; };
// Merge and outline a finished piece: the still parts as one, each moving part on its own.
export function finish(g, ink = .04) {
  g.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent) o.castShadow = true; });
  const moving = []; g.traverse(o => { if (o.userData.dyn) moving.push(o); });
  for (const d of moving) bake(d);
  bake(g); toonify(g, ink);
  for (const d of moving) toonify(d, ink);
  return g;
}

// ---------- what stands round the rim, per ground theme ----------
const treeOf = (trunk, a, b) => (g, s = 1) => { cyl(g, .09 * s, .13 * s, .7 * s, trunk, 0, .35 * s); ico(g, .45 * s, a, 0, .95 * s, 0); ico(g, .32 * s, b, .22 * s, 1.18 * s, .08 * s); ico(g, .3 * s, a, -.24 * s, .82 * s, -.1 * s); };
const bushOf = (a, b, dot) => (g, s = 1) => { ico(g, .3 * s, a, 0, .2 * s, 0); ico(g, .24 * s, b, .25 * s, .15 * s, .05 * s); ico(g, .2 * s, a, -.22 * s, .13 * s, .06 * s); if (dot) ico(g, .06 * s, dot, .1 * s, .45 * s, .15 * s); };
const rockOf = (a, b, cap) => (g, s = 1) => { const r = ico(g, .3 * s, a, 0, .15 * s, 0); r.scale.y = .7; ico(g, .18 * s, b, .28 * s, .08 * s, .1 * s); if (cap) { const c = ico(g, .22 * s, cap, 0, .3 * s, 0); c.scale.y = .45; } };
// Props in the look of the Pet Farm's islands (zoneIsle in games/farm/scene3d.js): same shapes and colours, sized for the rim.
export const R = {
  pinetree(g, s = 1) { cyl(g, .08 * s, .1 * s, .45 * s, '#8a5a3c', 0, .22 * s); cone(g, .42 * s, 1 * s, s * 97 % 2 < 1 ? '#4a9a45' : '#5fb04a', 0, .9 * s); },
  pool(g, s = 1) { const m = glow(g, new THREE.CylinderGeometry(.42 * s, .42 * s, .04, 8), '#6fb7e8', 0, .025, 0); for (let i = 0; i < 4; i++) { const a = i * 1.7 + s * 9; ico(g, .08 * s, '#c9bfb2', Math.cos(a) * .44 * s, .04, Math.sin(a) * .44 * s).scale.y = .6; } return m; },
  shells(g, s = 1) { put(g, new THREE.OctahedronGeometry(.16 * s), flat('#ffb6c9'), 0, .12 * s, 0); put(g, new THREE.OctahedronGeometry(.12 * s), flat('#fff3df'), .26 * s, .09 * s, .1 * s); put(g, new THREE.OctahedronGeometry(.1 * s), flat('#ffb6c9'), -.1 * s, .08 * s, .24 * s); },
  boulder(g, s = 1) { put(g, rough(new THREE.DodecahedronGeometry(.38 * s), .07), flat(s * 53 % 2 < 1 ? '#8a8794' : '#a9a6b0'), 0, .28 * s, 0); put(g, rough(new THREE.DodecahedronGeometry(.2 * s), .05), flat('#8a8794'), .36 * s, .13 * s, .12 * s); },
  crystal(g, s = 1) { put(g, rough(new THREE.DodecahedronGeometry(.3 * s), .06), flat('#a9a6b0'), 0, .2 * s, 0); const c = put(g, new THREE.OctahedronGeometry(.2 * s), flat('#8fe3f5'), 0, .62 * s, 0); c.scale.y = 1.5; put(g, new THREE.OctahedronGeometry(.11 * s), flat('#8fe3f5'), .22 * s, .4 * s, .05 * s).scale.y = 1.5; },
  emberhill(g, s = 1) { cone(g, .46 * s, .85 * s, '#7a4a3a', 0, .42 * s); glow(g, new THREE.OctahedronGeometry(.13 * s), '#ffb547', 0, 1.02 * s, 0); },
  hill(g, s = 1) { cone(g, .4 * s, .6 * s, '#7a4a3a', 0, .3 * s); cone(g, .26 * s, .4 * s, '#8a5646', .34 * s, .2 * s, .12 * s); },
  spark(g, s = 1) { cone(g, .11 * s, .7 * s, '#ffc94d', 0, .35 * s, 0, 4); cone(g, .09 * s, .5 * s, '#86cc5a', .28 * s, .25 * s, .18 * s, 4); cone(g, .08 * s, .42 * s, '#ffc94d', -.2 * s, .21 * s, .22 * s, 4); },
  fruit(g, s = 1) { const f = ['#ff5a6e', '#ffc93c', '#ff9a3c'][Math.floor(s * 97) % 3]; cyl(g, .08 * s, .1 * s, .55 * s, '#8a5a3c', 0, .27 * s); ico(g, .46 * s, s * 53 % 2 < 1 ? '#5fb04a' : '#6cc24f', 0, .9 * s, 0);
    for (let k = 0; k < 5; k++) ico(g, .1 * s, f, Math.sin(k * 1.7) * .4 * s, (.78 + (k % 2) * .28) * s, Math.cos(k * 1.7) * .4 * s); },
  veggies(g, s = 1) { box(g, .9 * s, .08 * s, .28 * s, '#7a4f36', 0, .04 * s, 0); for (let k = -1; k <= 1; k++) cone(g, .09 * s, .28 * s, '#6cc24f', k * .28 * s, .22 * s, 0, 4); },
  pumpkin(g, s = 1) { const p = ico(g, .3 * s, '#ff9a2c', 0, .22 * s, 0); p.scale.y = .8; cyl(g, .03 * s, .045 * s, .13 * s, '#5fa646', 0, .5 * s); },
  oven(g, s = 1) { box(g, .7 * s, .5 * s, .64 * s, '#c9703c', 0, .25 * s, 0); const d = ico(g, .4 * s, '#b8603a', 0, .5 * s, 0); d.scale.set(1, .7, .85); box(g, .28 * s, .24 * s, .06 * s, '#3b2a22', 0, .2 * s, .33 * s); box(g, .14 * s, .44 * s, .14 * s, '#8a8794', .2 * s, .86 * s, -.14 * s); },
  buns(g, s = 1) { ico(g, .2 * s, '#e8a85a', 0, .11 * s, 0).scale.set(1.5, .7, 1); ico(g, .16 * s, '#c98a4a', .34 * s, .09 * s, .16 * s).scale.set(1.5, .7, 1); },
  lolly(g, s = 1) { const c = ['#ff5a6e', '#7cc4ee', '#ffd65a', '#c9b5ff', '#86cc5a'][Math.floor(s * 97) % 5];
    cyl(g, .03 * s, .03 * s, .85 * s, '#ffffff', 0, .42 * s); const d = cyl(g, .3 * s, .3 * s, .09 * s, c, 0, .98 * s, 0, 12); d.rotation.x = PI / 2; const e = cyl(g, .16 * s, .16 * s, .11 * s, '#ffffff', 0, .98 * s, 0, 10); e.rotation.x = PI / 2; },
  coral(g, s = 1) { const c = ['#ff7a8a', '#ffb14a', '#c98ae0', '#ff9ec4'][Math.floor(s * 97) % 4]; cyl(g, .06 * s, .1 * s, .6 * s, c, 0, .3 * s, 0, 5);
    for (let k = 0; k < 3; k++) { const b = cyl(g, .045 * s, .065 * s, .4 * s, c, Math.sin(k * 2.1) * .2 * s, (.55 + k * .1) * s, Math.cos(k * 2.1) * .2 * s, 5); b.rotation.set(Math.cos(k * 2.1) * .6, 0, -Math.sin(k * 2.1) * .6); }
    put(g, new THREE.OctahedronGeometry(.1 * s), flat('#fff3df'), .28 * s, .08 * s, .1 * s); },
  peak(g, s = 1) { cone(g, .44 * s, .95 * s, '#cfe0f0', 0, .47 * s); cone(g, .2 * s, .36 * s, '#ffffff', 0, .78 * s); },
  cloud(g, s = 1) { for (let k = 0; k < 3; k++) ico(g, (.26 - k * .035) * s, '#ffffff', (k - 1) * .3 * s, (1.25 + (k % 2) * .1) * s, 0); const d = put(g, new THREE.OctahedronGeometry(.06 * s), flat('#6fb7e8'), 0, .85 * s, 0); d.scale.y = 1.8; },
  sunball(g, s = 1) { cone(g, .34 * s, .5 * s, '#cfe0f0', 0, .25 * s); glow(g, new THREE.IcosahedronGeometry(.24 * s, 1), '#ffd21f', 0, 1.25 * s, 0); },
  icepond(g, s = 1) { glow(g, new THREE.CylinderGeometry(.4 * s, .4 * s, .04, 7), '#8fd4ff', 0, .025, 0); },
  star(g, s = 1) { put(g, rough(new THREE.DodecahedronGeometry(.24 * s), .05), flat('#7a6ab0'), 0, .17 * s, 0); glow(g, new THREE.OctahedronGeometry(.13 * s), '#fff3a0', 0, (.8 + s * 37 % 1 * .5) * s, 0).scale.y = 1.5; },
  moonrock(g, s = 1) { put(g, rough(new THREE.DodecahedronGeometry(.3 * s), .06), flat('#7a6ab0'), 0, .2 * s, 0); put(g, rough(new THREE.DodecahedronGeometry(.16 * s), .04), flat('#6a5aa0'), .3 * s, .1 * s, .1 * s); },
  coins(g, s = 1) { for (let i = 0; i < 4; i++) cyl(g, .13 * s, .13 * s, .05 * s, i % 2 ? '#ffd23e' : '#f0b020', (i % 2) * .02 * s, (.03 + i * .055) * s, 0, 10); for (let i = 0; i < 2; i++) cyl(g, .13 * s, .13 * s, .05 * s, '#ffd23e', .3 * s, (.03 + i * .055) * s, .1 * s, 10); },
  trophy(g, s = 1) { box(g, .34 * s, .3 * s, .34 * s, '#fff4e2', 0, .15 * s); box(g, .4 * s, .05 * s, .4 * s, '#e3d6c2', 0, .32 * s); const c = '#ffc93c';
    cyl(g, .09 * s, .11 * s, .05 * s, c, 0, .37 * s, 0, 8); cyl(g, .025 * s, .025 * s, .14 * s, c, 0, .46 * s); cyl(g, .16 * s, .08 * s, .24 * s, c, 0, .65 * s, 0, 8);
    for (const d of [-1, 1]) put(g, new THREE.TorusGeometry(.07 * s, .02 * s, 4, 8), flat(c), d * .16 * s, .66 * s, 0); },
  ruin(g, s = 1) { const h = (.62 + (s * 97 % 1) * .5) * s; box(g, .46 * s, .1 * s, .46 * s, '#ddd5c4', 0, .05 * s, 0); cyl(g, .15 * s, .17 * s, h, '#f2ece0', 0, .1 * s + h / 2, 0, 8); // an old stone column, some still capped
    if (s * 53 % 2 < 1) box(g, .42 * s, .1 * s, .42 * s, '#e6dfcf', 0, .15 * s + h, 0); else { const b = ico(g, .14 * s, '#e6dfcf', .32 * s, .1 * s, .14 * s); b.scale.y = .7; } },
  rune(g, s = 1) { const r = put(g, rough(new THREE.DodecahedronGeometry(.26 * s), .05), flat('#6e6694'), 0, .3 * s, 0); r.scale.set(.8, 1.5, .55); // a standing stone with a glowing rune
    glow(g, new THREE.OctahedronGeometry(.09 * s), '#9ff0ff', 0, .36 * s, .15 * s).scale.z = .3; },
  pennant(g, s = 1) { const cols = ['#ff6f61', '#6ec6f5', '#ffc93c', '#9b7bff']; cyl(g, .03 * s, .04 * s, 1.3 * s, '#fff4e2', 0, .65 * s); ico(g, .05 * s, '#ffc93c', 0, 1.33 * s, 0);
    const f = put(g, new THREE.ConeGeometry(.17 * s, .46 * s, 3), flat(cols[Math.floor(s * 71) % 4]), .23 * s, 1.1 * s, 0); f.rotation.z = -PI / 2; f.scale.z = .15; },
};

// ---------- ground themes (cosmetics.js COS.ig) ----------
// Apart from the two earned ones, each is one of the Pet Farm's islands, in that island's colours (zoneIsle's top2 table).
// air: what drifts past (colours of the petals() flakes); water: what a waterfall base pours.
const GROUND = [
  { air: { colors: ['#ffc1dc', '#ffffff', '#a8e08a', '#ffd9ea', '#ffe9a8', '#c9f0a8'], n: 8 } },                                    // 0 Meadow: your own farm's lawn
  { size: 1.3, grass: '#eef6ff', patch: '#dcebfa', earth: '#a9bdd4', rock: '#70819a', flowers: 0, water: '#8fd4ff',                              // 1 Weather Peak
    kinds: [R.peak, R.cloud, R.icepond, R.peak, R.sunball, R.peak, R.cloud, R.peak, R.icepond, R.peak], air: { colors: ['#ffffff', '#eaf4ff', '#8fd4ff'], n: 20, size: .06 } },
  { size: 1.3, grass: '#a9a6b0', patch: '#98959f', earth: '#8a8794', rock: '#6f6c78', flowers: 0,                                                 // 2 Pebble Ridge
    kinds: [R.boulder, R.crystal, R.boulder, R.boulder, R.crystal, R.boulder, 'rock', R.boulder, R.crystal, R.boulder], air: { colors: ['#d9d6e0', '#8fe3f5'], n: 6, size: .05 } },
  { grass: '#8fd16a', patch: '#7fc45c', flowers: 30, petals: ['#ff5a6e', '#ffc93c', '#ff9a3c', '#ffffff'],                            // 3 Fruit Grove
    kinds: [R.fruit, 'bush', R.fruit, R.fruit, 'flowers', R.fruit, 'bush', R.fruit, R.fruit, 'flowers'], air: { colors: ['#a8e08a', '#ffffff', '#ffd9a8'], n: 10, size: .08 } },
  { size: 1.3, grass: '#9a6a4a', patch: '#8a5c40', earth: '#7a4f36', flowers: 0,                                                                  // 4 Veggie Patch
    kinds: [R.veggies, R.pumpkin, R.veggies, 'bush', R.veggies, R.veggies, R.pumpkin, R.veggies, 'bush', R.veggies], air: { colors: ['#86cc5a', '#c9f0a8'], n: 8, size: .07 } },
  { grass: '#6fbf5a', patch: '#62b04f', flowers: 24,                                                                                   // 5 Mossy Woods
    kinds: [R.pinetree, 'bush', R.pinetree, 'shroom', R.pinetree, R.pinetree, 'rock', R.pinetree, 'bush', R.pinetree], air: { colors: ['#a8e08a', '#c9f0a8', '#86cc5a'], n: 12, size: .08 } },
  { size: 1.3, grass: '#ead9a0', patch: '#dfcb8c', earth: '#d9b878', rock: '#b89872', flowers: 8, petals: ['#ffb6c9', '#fff3df'],               // 6 Tidepool Cove
    kinds: [R.pool, R.shells, 'rock', R.pool, R.shells, R.shells, R.pool, 'rock', R.shells, R.pool], air: { colors: ['#ffffff', '#d9f1ff'], n: 6, size: .06 } },
  { grass: '#ffc4dc', patch: '#fff4fa', earth: '#7b4a2e', rock: '#f0d8a8', flowers: 40, petals: ['#ff5a6e', '#7cc4ee', '#ffd65a', '#c9b5ff', '#86cc5a'], water: '#ff8fc4', // 7 Sweet Shop Isle
    kinds: [R.lolly], air: { colors: ['#7cc4ee', '#ffd65a', '#86cc5a', '#ff5a6e', '#ffffff'], n: 14, size: .06 } },
  { size: 1.3, grass: '#b5553c', patch: '#a34a34', earth: '#7a4a3a', rock: '#4a3230', flowers: 0, water: '#ff8a2a', lava: true,                  // 8 Ember Hills
    kinds: [R.emberhill, R.hill, R.emberhill, R.hill, R.emberhill], air: { colors: ['#ffb547', '#ffc93c', '#ff7a2a'], n: 14, size: .045 } },
  { grass: '#ffd75a', patch: '#ffc12e', earth: '#e0a030', rock: '#b87a1e', flowers: 30, petals: ['#ffffff', '#fff1a8'], water: '#fff1a8', // 9 Golden isle (earned)
    kinds: [treeOf('#fff4e2', '#ffc93c', '#ffe680'), R.coins, rockOf('#f0b020', '#d99a18'), treeOf('#fff4e2', '#ffd23e', '#fff1a8'), bushOf('#ffc93c', '#ffe680', '#ffffff'), R.coins, treeOf('#fff4e2', '#ffc93c', '#ffe680'), rockOf('#f0b020', '#d99a18'), bushOf('#ffc93c', '#ffe680', '#ffffff'), R.coins],
    air: { colors: ['#fff8c9', '#ffffff', '#ffd23e'], n: 18, size: .05 } },
  { grass: '#7ccf7a', patch: '#69bd68', earth: '#7a5ab8', rock: '#57428a', flowers: 30, petals: ['#ffc93c', '#ffffff', '#ff6f61'],   // 10 Champion's isle (earned)
    kinds: [R.trophy, R.pennant, bushOf('#3f8c4a', '#5fb04a', '#ffc93c'), 'tree', R.pennant, R.trophy, bushOf('#3f8c4a', '#5fb04a', '#ffc93c'), R.pennant, 'tree', R.pennant],
    air: { colors: ['#ff6f61', '#6ec6f5', '#ffc93c', '#9b7bff', '#7ed3b2'], n: 16, size: .07 } },
  { size: 1.3, grass: '#e8c890', patch: '#dcb87a', earth: '#c98a4a', rock: '#96683f', flowers: 0,                                                 // 11 Bakery Bluff
    kinds: [R.buns, R.oven, R.buns, R.buns, 'rock', R.buns, R.oven, R.buns, R.buns, 'bush'], air: { colors: ['#fff4e2', '#e8a85a'], n: 8, size: .05 } },
  { size: 1.3, grass: '#f2dcb0', patch: '#e6cc98', earth: '#e0b878', rock: '#b89872', flowers: 6, petals: ['#ff9ec4', '#fff3df'], water: '#6fc7e8', // 12 Coral Reef
    kinds: [R.coral, R.coral, R.pool, R.coral, R.shells, R.coral, R.coral, R.pool, R.coral, R.shells], air: { colors: ['#d9f1ff', '#ffffff', '#ff9ec4'], n: 10, size: .06 } },
  { size: 1.3, grass: '#5a4a8a', patch: '#4e3f7c', earth: '#4a3d6e', rock: '#352b52', flowers: 14, petals: ['#fff3a0', '#c9b5ff'], water: '#c9b5ff', // 13 Starfall Isle
    kinds: [R.star, R.moonrock, R.star, R.star, R.moonrock], air: { colors: ['#fff3a0', '#ffffff', '#c9b5ff'], n: 16, size: .05 } },
  { size: 1.3, grass: '#c9d65a', patch: '#b8c64c', flowers: 16, petals: ['#ffc94d', '#ffffff'],                                                   // 14 Thunder Meadow
    kinds: [R.spark, 'bush', R.spark, R.spark, 'rock', R.spark, R.spark, 'bush', R.spark, R.spark], air: { colors: ['#ffc94d', '#fff1a8', '#c9f0a8'], n: 12, size: .06 } },
  { size: 1.3, grass: '#b4c4e6', patch: '#a4b4da', earth: '#857aae', rock: '#564e7a', flowers: 12, petals: ['#ffffff', '#c9b5ff', '#9ff0ff'], water: '#c9b5ff', // 15 Legend Isle (far expeditions only, not a wardrobe ground)
    kinds: [R.ruin, R.rune, R.ruin, R.crystal, R.ruin, R.rune, R.ruin, R.cloud, R.ruin, R.rune], air: { colors: ['#ffffff', '#e6ddff', '#9ff0ff'], n: 16, size: .06 } },
];
export const groundOf = ig => ({ grass: '#8bca60', patch: '#7fbf56', earth: '#c98a5a', rock: '#857a72', flowers: 32, water: '#6ec6f5', ...(GROUND[ig] || GROUND[0]) });

// ---------- rock bases (COS.ib) ----------
const RAD = 2.95; // the isle's radius: island(3.3, 3.3, { rim: 1.3 })
const stub = (root, th, deep) => { const c = put(root, rough(new THREE.ConeGeometry(RAD * .62, deep, 8, 2), RAD * .08), flat(th.rock), 0, -2 - deep / 2); c.rotation.x = PI; return c; };
export const BASE = [
  null, // classic: island() builds its own cone and loose stones
  (root, th, ticks) => { // crystal cluster
    stub(root, th, 1.1);
    const cols = ['#9b6bff', '#4fc3f0', '#ff6fc8'], spike = (r, h, c, x, y, z, tx = 0, tz = 0) => { const m = put(root, new THREE.ConeGeometry(r, h, 6), flat(c), x, y, z); m.rotation.set(PI + tx, 0, tz); return m; };
    spike(.8, 3.6, cols[0], 0, -4.1, 0);
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + .3, r = 1 + hash(i, 3) * .35, h = 1.5 + hash(i, 5) * 1.3; spike(.36 + hash(i, 7) * .2, h, cols[(i + 1) % 3], Math.cos(a) * r, -2.5 - h / 2, Math.sin(a) * r, Math.sin(a) * .35, -Math.cos(a) * .35); }
    const shards = []; for (let i = 0; i < 5; i++) { const g = dyn(root), a = i * 1.4 + 1; glow(g, new THREE.OctahedronGeometry(.12 + hash(i, 2) * .08, 0), ['#e6dcff', '#d9f6ff', '#ffe0f5'][i % 3]); g.position.set(Math.cos(a) * 2.3, -3 - i * .45, Math.sin(a) * 1.6); shards.push(g); }
    ticks.push(T => shards.forEach((g, i) => { g.position.y = -3 - i * .45 + Math.sin(T * 1.2 + i * 2) * .2; g.rotation.y = T * (.6 + i * .2); }));
  },
  (root, th, ticks) => { // floating chunks
    stub(root, th, 1.5);
    const at = [[.2, -4.2, 0, .8], [-1, -5.1, .5, .55], [1, -5.6, -.3, .45], [-.2, -6.3, .2, .34], [2.7, -2.5, 1, .42], [-2.9, -3, .6, .5], [-2.2, -4.2, -1, .3], [2, -4, -.8, .36]], list = [];
    at.forEach(([x, y, z, r], i) => { const g = dyn(root); const m = put(g, rough(new THREE.IcosahedronGeometry(r, 0), r * .25), flat(th.rock)); m.scale.y = 1.3;
      if (i > 3) { const cap = put(g, new THREE.CylinderGeometry(r * .8, r * .7, r * .3, 7), flat(th.grass), 0, r * .95, 0); cap.castShadow = false; }
      g.position.set(x, y, z); g.rotation.y = i * 1.3; list.push([g, y, i]); });
    ticks.push(T => { for (const [g, y, i] of list) { g.position.y = y + Math.sin(T * .9 + i * 1.7) * .16; g.rotation.y = i * 1.3 + Math.sin(T * .3 + i) * .4; } });
  },
  (root, th, ticks) => { // waterfall: a pond that pours over the front left edge
    const a = 2.3, f = new THREE.Group(); f.rotation.y = PI / 2 - a; root.add(f); // f's +z points out over the edge
    const lava = th.lava, wet = (geo, x, y, z) => glow(f, geo, th.water, x, y, z); // unlit, so the water stays bright under any sky
    wet(new THREE.CylinderGeometry(.6, .6, .06, 10), 0, .02, 1.95);
    for (let i = 0; i < 6; i++) { const b = i / 6 * 6.283 + .5; if (Math.cos(b) > .75) continue; const s = ico(f, .13 + hash(i, 4) * .06, lava ? '#2a2028' : '#a9a6b0', Math.sin(b) * .66, .06, 1.95 + Math.cos(b) * .66); s.scale.y = .7; }
    wet(new THREE.BoxGeometry(.5, .06, .7), 0, .02, 2.7);
    wet(new THREE.BoxGeometry(.5, 5.4, .1), 0, -2.66, RAD + .12);
    const lip = wet(new THREE.CylinderGeometry(.09, .09, .5, 6), 0, .01, RAD + .1); lip.rotation.z = PI / 2;
    const d = dyn(f), streaks = [], foam = lava ? '#ffd27a' : '#ffffff';
    for (let i = 0; i < 7; i++) streaks.push(glow(d, new THREE.BoxGeometry(.07, .5, .02), foam, (i % 3 - 1) * .15, 0, RAD + .185));
    const mist = []; for (let i = 0; i < 4; i++) mist.push(glow(d, new THREE.IcosahedronGeometry(.3, 0), foam, (i - 1.5) * .22, -5.45, RAD + .15, { transparent: true, opacity: .75 }));
    ticks.push(T => { streaks.forEach((m, i) => { const u = (T * .55 + i / 7 + hash(i, 2) * .1) % 1; m.position.y = -.2 - u * 5; m.scale.y = .5 + u; });
      mist.forEach((m, i) => { const u = (T * .7 + i / 4) % 1; m.scale.setScalar(.4 + u * .9); m.material.opacity = .75 * (1 - u); m.position.y = -5.45 + u * .5; }); });
  },
  (root, th, ticks) => { // hanging roots
    stub(root, th, 1.7);
    const list = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + hash(i, 1), r = .5 + hash(i, 2) * 1.5, g = dyn(root), n = 3 + Math.floor(hash(i, 3) * 3), vine = i % 3 === 2; let y = 0, x = 0;
      for (let k = 0; k < n; k++) { const len = .5 + hash(i * 7 + k, 4) * .25, w = (vine ? .035 : .1) * (1 - k / (n + 1)), bend = (hash(i * 7 + k, 5) - .5) * .5;
        const m = cyl(g, w * .7, w, len, vine ? '#4f9a45' : '#8a5a3c', x + Math.sin(bend) * len / 2, y - len / 2, 0); m.rotation.z = bend; x += Math.sin(bend) * len; y -= len * Math.cos(bend);
        if (vine || k === n - 1) ico(g, .08 + hash(k, i) * .05, k % 2 ? '#86cc5a' : '#5fb04a', x + .06, y + .1, .05); }
      g.position.set(Math.cos(a) * r, -1.9 - (1.5 - r) * .7, Math.sin(a) * r); g.rotation.y = a; list.push([g, i]); }
    ticks.push(T => { for (const [g, i] of list) { g.rotation.z = Math.sin(T * .8 + i * 1.3) * .09; g.rotation.x = Math.cos(T * .6 + i * 2.1) * .07; } });
  },
];

// ---------- decor: decorations from the player's own Pet Farm (cos.ip holds their types) ----------
// Where decor stands: clear of the avatar, the pets and the lamp posts. [x, z, turn]
const SLOTS = [[-1.6, -.9, .45], [1.6, -.9, -.45], [2, 1, -.7]];
// The farm's models load only when somebody has decor out, so they arrive a moment after the isle itself.
function farmDecor(root, types, ticks, st) {
  import('./games/farm/models.js').then(({ itemModel, disposeModel }) => {
    if (st.dead) return;
    st.free = () => { for (const h of st.holds) { root.remove(h); disposeModel(h.children[0]); } };
    types.forEach((t, n) => {
      const g = itemModel(t, true), hold = new THREE.Group(), [x, z, ry] = SLOTS[n], sz = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
      hold.scale.setScalar(Math.min(1.3, 1.9 / Math.max(sz.x, sz.z, .01), 2.6 / Math.max(sz.y, .01))); // big things (a pond, a gazebo) shrink to fit their spot
      hold.position.set(x, 0, z); hold.rotation.y = ry; hold.add(g); root.add(hold); st.holds.push(hold);
      if (g.userData.tick) ticks.push(T => g.userData.tick(T, {}, g));
    });
  }).catch(() => {});
}

export function buildIsle(look = {}) {
  const ig = look.ig | 0, ib = BASE[look.ib | 0] ? look.ib | 0 : 0, th = groundOf(ig), ticks = [], root = new THREE.Group();
  const land = island(3.3, 3.3, { round: true, seed: 7, props: 14, open: .8, rim: 1.3, size: th.size || .9, flowers: th.flowers, grass: th.grass, patch: th.patch, earth: th.earth, rock: th.rock, kinds: th.kinds || null, petals: th.petals || null, under: !ib || ib === 3, season: null }); // the owner's look, never the season's
  root.add(land);
  if (th.lava) { // pools that glow and pulse
    const g = dyn(root), mt = new THREE.MeshBasicMaterial({ color: '#ff7a2a' });
    for (const [x, z, r] of [[-2, -.3, .34], [2.1, -.5, .28], [-.9, -2.2, .3], [1, -2.3, .24], [-2.1, 1.2, .22]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 9), mt); m.rotation.x = -PI / 2; m.position.set(x, .015, z); m.userData.noInk = true; g.add(m); }
    ticks.push(T => { const k = .8 + Math.sin(T * 1.6) * .2; mt.color.setRGB(1, .42 * k + .1, .12 * k); });
  }
  if (ib) { const g = new THREE.Group(); root.add(g); BASE[ib](g, th, ticks); finish(g, .05); g.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
  const types = (Array.isArray(look.ip) ? look.ip : []).filter(t => typeof t === 'string').slice(0, SLOTS.length), st = { dead: false, holds: [], free: null };
  if (types.length) farmDecor(root, types, ticks, st);
  return { root, land, air: th.air, tick: T => { for (const f of ticks) f(T); }, dispose: () => { st.dead = true; st.free?.(); disposeToon(root); } };
}

// ---------- skies (COS.ik) ----------
// Colours of each sky, top to bottom: the page paints them behind the canvas (style.css .isk1..), or with disc: true
// they are drawn as a soft round window behind the isle (the hub, where there is no frame to fill).
export const SKY_COLORS = [null, ['#4b3a8f', '#ff7a6a', '#ffc27a'], ['#0c1236', '#2d2b63', '#4a3f8a'], ['#06142e', '#123a55', '#2b2856'], ['#6ec0f5', '#bfe6ff', '#eaf8ff'], ['#1a1440', '#3a2a5e', '#8a4a58']];
const MOOD = ['', 'sunset', 'night', 'night', 'day', 'night'];
function discTex(cols) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  const lin = c.createLinearGradient(0, 20, 0, 236); cols.forEach((x, i) => lin.addColorStop(i / (cols.length - 1), x)); c.fillStyle = lin; c.fillRect(0, 0, 256, 256);
  c.globalCompositeOperation = 'destination-in'; const rad = c.createRadialGradient(128, 128, 60, 128, 128, 126); rad.addColorStop(0, '#000'); rad.addColorStop(.7, 'rgba(0,0,0,.9)'); rad.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rad; c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const basic = (c, o) => new THREE.MeshBasicMaterial({ color: c, depthWrite: false, fog: false, ...o });
function stars(root, n, ticks, disc) {
  const sets = [0, 1].map(k => { const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = hash(i, 11 + k) * 6.283, r = Math.sqrt(hash(i, 13 + k)) * 8;
    pos.set(disc ? [Math.cos(a) * r, -2.6 + Math.sin(a) * r, -12] : [(hash(i, 11 + k) - .5) * 20, -6 + hash(i, 13 + k) * 15, -11 - hash(i, 17) * 2], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: k ? '#fff6d8' : '#ffffff', size: k ? 3 : 2.2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })); p.renderOrder = -4; root.add(p); return p; });
  ticks.push(T => { sets[0].material.opacity = .65 + Math.sin(T * 1.7) * .3; sets[1].material.opacity = .65 + Math.cos(T * 1.3) * .3; });
}
export function buildSky(ik, { disc = false } = {}) {
  ik = SKY_COLORS[ik | 0] ? ik | 0 : 0;
  const root = new THREE.Group(), ticks = [], add = (geo, mat, x, y, z, ro = -3) => { const m = put(root, geo, mat, x, y, z); m.renderOrder = ro; return m; };
  if (ik && disc) add(new THREE.CircleGeometry(9.5, 40), new THREE.MeshBasicMaterial({ map: discTex(SKY_COLORS[ik]), transparent: true, depthWrite: false, fog: false }), 0, -2.6, -13, -6); // centred on the middle of the view at that depth, so no edge of the canvas cuts it
  if (ik === 1) { // sunset: a low sun and long clouds
    add(new THREE.CircleGeometry(3.3, 28), basic('#ffe9a8', { transparent: true, opacity: .35 }), 2.3, .2, -11.5, -5);
    add(new THREE.CircleGeometry(2.3, 28), basic('#fff1b8'), 2.3, .2, -11.4, -4);
    const cl = [[-3.5, 2.6, 3.4], [3.8, 4.6, 2.6], [-1, -2.4, 4.2], [4.6, -1.2, 2.2]].map(([x, y, w], i) => { const g = new THREE.Group(); root.add(g); g.position.set(x, y, -11);
      for (const [dx, dy, k] of [[0, 0, 1], [.25, .22, .55], [-.3, -.2, .7]]) { const m = put(g, new THREE.CircleGeometry(.5, 16), basic(i % 2 ? '#ffb39a' : '#ff9a8a', { transparent: true, opacity: .9 }), dx * w, dy, 0); m.scale.set(w * k, .42, 1); m.renderOrder = -3; } return [g, x, i]; });
    ticks.push(T => { for (const [g, x, i] of cl) g.position.x = x + Math.sin(T * .12 + i * 2) * .7; });
  } else if (ik === 2 || ik === 3) {
    stars(root, ik === 2 ? 70 : 40, ticks, disc);
    if (ik === 2) { // a crescent moon and now and then a shooting star
      const s = new THREE.Shape(), cx = .5, cy = .3, r2 = .84, d = Math.hypot(cx, cy), ph = Math.atan2(cy, cx), al = Math.acos((d * d + 1 - r2 * r2) / (2 * d)), be = Math.acos((1 - d * d - r2 * r2) / (2 * d * r2));
      s.absarc(0, 0, 1, ph + al, ph - al + 2 * PI, false); s.absarc(cx, cy, r2, ph - be + 2 * PI, ph + be, true); // a full disc with a bite out of its upper right
      add(new THREE.ShapeGeometry(s, 24), basic('#fff3c4'), -3.3, 4.7, -11, -3).scale.setScalar(1.25);
      add(new THREE.CircleGeometry(2, 24), basic('#fff3c4', { transparent: true, opacity: .1 }), -3.3, 4.7, -11.1, -4);
      const sh = add(new THREE.PlaneGeometry(1.5, .05), basic('#ffffff', { transparent: true }), 0, 0, -10.8, -3); sh.rotation.z = -.5;
      ticks.push(T => { const u = (T % 7) / .9; sh.visible = u < 1; if (u < 1) { sh.position.set(5 - u * 7, 7 - u * 3.8, -10.8); sh.material.opacity = Math.sin(u * PI); } });
    } else { // aurora: three slow curtains of light
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, 'rgba(255,255,255,.55)'); gr.addColorStop(.85, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      c.globalCompositeOperation = 'destination-in'; const side = c.createLinearGradient(0, 0, 64, 0); side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(.25, '#000'); side.addColorStop(.75, '#000'); side.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = side; c.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv), bands = [['#5dffb0', 3.4, 3.4, 0], ['#58e0ff', 5.2, 2.6, 2], ['#b48cff', 1.4, 2.8, 4]].map(([col, y, h, ph], k) => {
        const geo = new THREE.PlaneGeometry(disc ? 15 : 19, h, 38, 1), m = add(geo, new THREE.MeshBasicMaterial({ color: col, map: tex, transparent: true, opacity: .62, depthWrite: false, fog: false, side: THREE.DoubleSide }), 0, y, -11.6 - k * .2, -5 + k);
        return [geo.attributes.position, h, ph]; });
      ticks.push(T => { for (const [p, h, ph] of bands) { for (let i = 0; i <= 38; i++) { const x = p.getX(i), w = Math.sin(x * .45 + T * .5 + ph) * .55 + Math.sin(x * 1.1 - T * .35 + ph) * .22; p.setY(i, h / 2 + w + Math.sin(x * .8 + T * .9 + ph) * .25); p.setY(i + 39, -h / 2 + w); } p.needsUpdate = true; } });
    }
  } else if (ik === 4) { // a rainbow arching over the isle, with a cloud at each foot
    ['#ff6f61', '#ffa64a', '#ffd84a', '#7ed36a', '#6ec6f5', '#9b7bff'].forEach((c, i) => add(new THREE.RingGeometry(5.6 - i * .28, 5.88 - i * .28, 28, 1, 0, PI), basic(c, { transparent: true, opacity: .9 }), 0, -2.6, -9.5, -4));
    const cl = new THREE.Group(); for (const d of [-1, 1]) for (const [x, y, r] of [[0, 0, .9], [.8, -.15, .65], [-.75, -.1, .7], [.2, .45, .6]]) ico(cl, r, '#ffffff', d * 4.9 + x, -2.7 + y, -9.3).scale.set(1.2, .7, .8);
    cl.traverse(o => { if (o.isMesh) o.userData.noInk = true; }); root.add(toonify(cl));
    ticks.push(T => { cl.position.y = Math.sin(T * .6) * .08; });
  } else if (ik === 5) { // lantern night: paper lanterns drifting up past a few stars (Lantern Night)
    stars(root, 30, ticks, disc);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gl = c.createRadialGradient(32, 32, 4, 32, 32, 32);
    gl.addColorStop(0, 'rgba(255,214,122,.85)'); gl.addColorStop(.4, 'rgba(255,176,74,.3)'); gl.addColorStop(1, 'rgba(255,176,74,0)'); c.fillStyle = gl; c.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(cv), glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false });
    const body = new THREE.BoxGeometry(.34, .44, .34), cols = ['#ff9a3c', '#ffc24a', '#ff6f61', '#ffb05a'], H = 14;
    const lan = Array.from({ length: 9 }, (_, i) => { const g = new THREE.Group(); root.add(g);
      const m = put(g, body, basic(cols[i % 4]), 0, 0, 0); m.renderOrder = -3;
      const top = put(g, new THREE.BoxGeometry(.36, .06, .36), basic('#5a3a2a'), 0, .25, 0); top.renderOrder = -3;
      const gm = put(g, new THREE.PlaneGeometry(1.5, 1.5), glowMat, 0, 0, -.2); gm.renderOrder = -4;
      const x = (hash(i, 31) - .5) * (disc ? 13 : 17), k = 1.1 + hash(i, 37) * .8; g.scale.setScalar(k);
      return [g, x, hash(i, 41) * H, .25 + hash(i, 43) * .2, i]; });
    ticks.push(T => { for (const [g, x, y0, v, i] of lan) { const y = (y0 + T * v) % H; g.position.set(x + Math.sin(T * .5 + i) * .25, -8.5 + y, -10.5 - (i % 3) * .3); g.rotation.y = T * .3 + i; } });
  }
  // fit(aspect): on a narrow canvas the round window shrinks to stay inside it
  return { root, mood: MOOD[ik], fit: a => { const k = disc ? Math.min(.84, a * .82) : 1; root.scale.set(k, k, 1); }, tick: T => { for (const f of ticks) f(T); }, dispose: () => { root.traverse(o => { o.material?.map?.dispose(); }); disposeToon(root); } };
}

// ---------- the game pieces that float round the isle (cosmetics.js PIECES) ----------
const SM = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: .5, ...o });
const PIECE = {
  marble(g) { g.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 14), SM('#ff8fab'))); const s = new THREE.Mesh(new THREE.TorusGeometry(.3, .035, 6, 20), SM('#ffffff')); s.rotation.x = 1.1; g.add(s); },
  die(g) { // a proper die: 1 to 6 pips, opposite faces adding up to 7
    const die = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), SM('#fff4e2')); g.add(die);
    const pip = new THREE.SphereGeometry(.042, 8, 6), pipM = SM('#3b2219'), h = .251, o = .13;
    const LAY = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] };
    for (const [n, nrm] of [[1, [0, 0, 1]], [6, [0, 0, -1]], [2, [1, 0, 0]], [5, [-1, 0, 0]], [3, [0, 1, 0]], [4, [0, -1, 0]]]) {
      const ax = nrm[0] ? [0, 1, 0] : [1, 0, 0], ay = [0, nrm[2] ? 1 : 0, nrm[2] ? 0 : 1];
      for (const [u, v] of LAY[n]) { const p = new THREE.Mesh(pip, pipM); p.position.set(nrm[0] * h + (ax[0] * u + ay[0] * v) * o, nrm[1] * h + (ax[1] * u + ay[1] * v) * o, nrm[2] * h + (ax[2] * u + ay[2] * v) * o);
        p.scale.set(nrm[0] ? .45 : 1, nrm[1] ? .45 : 1, nrm[2] ? .45 : 1); p.userData.noInk = true; die.add(p); } } },
  pawn(g) { const m = SM('#ffb547'), add = (geo, y) => { const x = new THREE.Mesh(geo, m); x.position.y = y; g.add(x); }; add(new THREE.CylinderGeometry(.18, .26, .2, 16), -.2); add(new THREE.CylinderGeometry(.09, .16, .34, 14), .06); add(new THREE.SphereGeometry(.15, 14, 10), .3); },
  card(g) { const c = new THREE.Mesh(new THREE.BoxGeometry(.42, .6, .03), SM('#ffffff')), b = new THREE.Mesh(new THREE.BoxGeometry(.42, .12, .035), SM('#e5543b')); b.position.y = .2; g.add(c, b);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .036, 12), SM('#ffc93c')); d.rotation.x = PI / 2; d.position.y = -.08; g.add(d); },
  chip(g) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .09, 20), SM('#e5543b')), w = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .1, 16), SM('#ffffff')), r = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .11, 14), SM('#e5543b')); g.add(c, w, r);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, m = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), SM('#ffffff')); m.position.set(Math.cos(a) * .27, 0, Math.sin(a) * .27); m.rotation.y = -a; g.add(m); } g.rotation.x = 1; },
  golf(g) { g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.27, 2), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .6, flatShading: true }))); },
  block(g) { [['#ff7a59', 0, 0], ['#ffc93c', .17, .08], ['#7ed3b2', .34, -.05]].forEach(([c, y, x]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.6, .16, .42), SM(c)); m.position.set(x, y - .17, 0); g.add(m); }); },
  tyre(g) { const t = new THREE.Mesh(new THREE.TorusGeometry(.22, .11, 8, 18), SM('#3b3340')), h = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .16, 10), SM('#ffc93c')); h.rotation.x = PI / 2; g.add(t, h); },
  coin(g) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .07, 20), SM('#ffc93c')), i = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .09, 16), SM('#ffe27a')); g.add(c, i); g.rotation.x = PI / 2 - .3; },
  star(g) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? .15 : .34; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 1 }); geo.translate(0, 0, -.05); g.add(new THREE.Mesh(geo, SM('#ffd84a'))); },
  bean(g) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .22, 4, 10), SM('#6cc24f')); b.rotation.z = .5; g.add(b); const l = new THREE.Mesh(new THREE.ConeGeometry(.09, .22, 4), SM('#86cc5a')); l.position.set(.12, .28, 0); l.rotation.z = -.6; l.scale.z = .4; g.add(l); },
  pot(g) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.36, .26, .26, 16), SM('#e5543b')), s = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .04, 16), SM('#ffb547')); s.position.y = .12; g.add(b, s);
    const r = new THREE.Mesh(new THREE.TorusGeometry(.36, .04, 6, 18), SM('#fff4e2')); r.rotation.x = PI / 2; r.position.y = .13; g.add(r);
    for (const d of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(.12, .06, .14), SM('#3b2219')); h.position.set(d * .42, .08, 0); g.add(h); }
    for (const [x, z, c] of [[-.1, .05, '#fff4e2'], [.12, -.06, '#86cc5a'], [.02, .14, '#ff9fb8']]) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 0), SM(c)); m.position.set(x, .16, z); g.add(m); } },
  dart(g) { const add = (geo, c, z, rx = PI / 2) => { const m = new THREE.Mesh(geo, SM(c)); m.position.z = z; m.rotation.x = rx; g.add(m); return m; };
    add(new THREE.ConeGeometry(.035, .22, 8), '#c9ccd2', .4); add(new THREE.CylinderGeometry(.06, .05, .3, 10), '#ffc93c', .15); add(new THREE.CylinderGeometry(.025, .03, .26, 8), '#3b3340', -.12);
    for (const rz of [0, PI / 2]) { const f = new THREE.Mesh(new THREE.BoxGeometry(.3, .02, .2), SM(rz ? '#e5543b' : '#ff7a59')); f.position.z = -.3; f.rotation.z = rz; g.add(f); } g.rotation.set(.5, -.7, 0); g.scale.setScalar(1.45); },
  bubble(g) { g.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 14), SM('#9fdcff', { roughness: .25 }))); const r = new THREE.Mesh(new THREE.TorusGeometry(.2, .025, 6, 16, 1.6), SM('#ffffff')); r.position.z = .23; r.rotation.z = 1.2; g.add(r);
    const d = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), SM('#ffffff')); d.position.set(.13, -.06, .27); g.add(d); },
  egg(g) { const e = new THREE.Mesh(new THREE.SphereGeometry(.26, 18, 14), SM('#fff4e2')); e.scale.set(1, 1.28, 1); g.add(e);
    for (const [x, y, z, r, c] of [[.12, .12, .2, .09, '#7ed37a'], [-.14, -.08, .2, .07, '#ff9fb8'], [.05, -.2, .19, .06, '#7fc8ee'], [-.1, .2, -.17, .08, '#ffc93c'], [.18, -.05, -.17, .07, '#7ed37a']]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), SM(c)); m.position.set(x * .8, y * .86, z * .8); g.add(m); } g.rotation.z = .2; },
  knight(g) { const add = (w, h, d, x, y, rz = 0, c = '#fff4e2') => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), SM(c)); m.position.set(x, y, 0); m.rotation.z = rz; g.add(m); return m; };
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.2, .26, .1, 8), SM('#e6d3ac')); b.position.y = -.3; g.add(b);
    add(.2, .36, .22, .04, -.1, .28); add(.24, .2, .22, -.05, .13, .3); add(.2, .13, .17, -.22, .05, .3); add(.07, .36, .1, .16, -.04, .28, '#4d362e');
    for (const z of [-.07, .07]) { const e = add(.07, .12, .06, .04, .28); e.position.z = z; } g.rotation.y = -.5; g.scale.setScalar(1.15); },
  eight(g) { g.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 14), SM('#221d2a', { roughness: .3 }))); const d = new THREE.Mesh(new THREE.CircleGeometry(.14, 18), SM('#ffffff')); d.position.z = .29; g.add(d);
    for (const y of [.045, -.05]) { const r = new THREE.Mesh(new THREE.TorusGeometry(y > 0 ? .038 : .048, .016, 6, 14), SM('#221d2a')); r.position.set(0, y, .3); g.add(r); } g.rotation.set(-.2, .35, 0); },
  domino(g) { const t = new THREE.Mesh(new THREE.BoxGeometry(.34, .66, .1), SM('#fff8ec')); g.add(t); const bar = new THREE.Mesh(new THREE.BoxGeometry(.24, .025, .02), SM('#3b2219')); bar.position.z = .055; g.add(bar);
    const pip = (x, y, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.065, .065, .02), SM(c)); m.position.set(x, y, .055); g.add(m); };
    for (const [x, y] of [[-.09, .26], [.09, .08], [0, .17]]) pip(x, y, '#3fae5d'); for (const [x, y] of [[-.09, -.08], [.09, -.08], [-.09, -.26], [.09, -.26], [0, -.17]]) pip(x, y, '#9a5fd0'); g.rotation.set(-.1, .5, .25); },
  bingo(g) { g.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 14), SM('#ffc93c', { roughness: .3 }))); const d = new THREE.Mesh(new THREE.CircleGeometry(.17, 18), SM('#ffffff')); d.position.z = .285; g.add(d);
    const r = new THREE.Mesh(new THREE.TorusGeometry(.17, .022, 6, 20), SM('#e5543b')); r.position.z = .25; g.add(r);
    const box = (w, h, x, y, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .02), SM('#3b2219')); m.position.set(x, y, .295); m.rotation.z = rz; g.add(m); };
    box(.03, .15, -.05, 0); box(.09, .03, .045, .06); box(.03, .15, .055, -.01, -.3); g.rotation.set(-.15, .3, 0); },
  paw(g) { const m = SM('#ff9fb8'), pad = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 8), m); pad.scale.set(1.15, .9, .45); pad.position.y = -.1; g.add(pad);
    for (const [x, y] of [[-.24, .12], [-.08, .26], [.08, .26], [.24, .12]]) { const t = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 6), m); t.scale.z = .5; t.position.set(x, y, 0); g.add(t); } },
  // 2026-11-25: Lantern Night, Checkers, Word Reef, Copycat Isle, Sky Runway, and the Pet Farm's stamps and Nest charms
  lantern(g) { const add = (geo, c, y, o) => { const m = new THREE.Mesh(geo, c.isMaterial ? c : SM(c, o)); m.position.y = y; g.add(m); return m; };
    add(new THREE.CylinderGeometry(.2, .2, .05, 6), '#5a3a2a', .27); add(new THREE.CylinderGeometry(.22, .22, .05, 6), '#5a3a2a', -.27);
    add(new THREE.CylinderGeometry(.19, .19, .5, 6), '#ffb84a', 0, { emissive: '#ff9a2a', emissiveIntensity: .55 });
    add(new THREE.CylinderGeometry(.1, .1, .3, 6), new THREE.MeshBasicMaterial({ color: '#fff1b8' }), 0).userData.noInk = true;
    const h = add(new THREE.TorusGeometry(.1, .022, 4, 10, PI), '#3b2f28', .3); h.rotation.y = .4; },
  checker(g) { const m = SM('#e0503c'), d = SM('#b8322a');
    for (const y of [-.1, .06]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .13, 20), m); c.position.y = y; g.add(c); const r = new THREE.Mesh(new THREE.TorusGeometry(.2, .03, 4, 18), d); r.rotation.x = PI / 2; r.position.y = y + .066; g.add(r); }
    const cr = SM('#ffc93c'); const base = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .05, 8), cr); base.position.y = .15; g.add(base);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283, t = new THREE.Mesh(new THREE.ConeGeometry(.04, .12, 4), cr); t.position.set(Math.cos(a) * .11, .23, Math.sin(a) * .11); g.add(t); } g.rotation.x = .45; },
  letter(g) { const t = new THREE.Mesh(new THREE.BoxGeometry(.52, .52, .12), SM('#fff1cf')); g.add(t); const ink = SM('#3b2f28');
    const bar = (w, h, x, y, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .03), ink); m.position.set(x, y, .065); m.rotation.z = rz; g.add(m); };
    bar(.06, .3, -.075, .02); bar(.2, .06, .005, .14); bar(.16, .06, -.015, .03); bar(.2, .06, .005, -.1); // an E
    bar(.025, .07, .19, -.17); bar(.05, .02, .2, -.14); // its value, a small 1
    g.rotation.set(-.15, .4, .1); },
  crate(g) { const w = SM('#c98a4a'), dk = SM('#9a6434'); g.add(new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), w));
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.06, .52, .06), dk); e.position.set(x * .23, 0, y * .23); g.add(e); }
    const s = new THREE.Mesh(new THREE.BoxGeometry(.06, .62, .02), dk); s.position.z = .255; s.rotation.z = .78; g.add(s);
    for (const x of [-.1, .1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), SM('#ffffff')); e.position.set(x, .08, .26); e.scale.z = .4; g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), SM('#3b2f28')); p.position.set(x + .01, .07, .29); p.scale.z = .4; g.add(p); }
    g.rotation.set(.15, -.4, 0); },
  hanger(g) { const m = SM('#c98a4a'), bar = (ax, ay, bx, by, r = .028) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.hypot(bx - ax, by - ay), 6), m); k.position.set((ax + bx) / 2, (ay + by) / 2, 0);
      k.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(bx - ax, by - ay, 0).normalize()); g.add(k); };
    bar(0, .08, -.44, -.2); bar(0, .08, .44, -.2); bar(-.46, -.21, .46, -.21);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.075, .02, 4, 12, PI * 1.3), SM('#c9ccd2')); hook.position.set(0, .2, 0); hook.rotation.z = -.5; g.add(hook);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .1, 6), SM('#c9ccd2')); st.position.y = .11; g.add(st);
    const bow = new THREE.Mesh(new THREE.OctahedronGeometry(.07), SM('#ff6fb0')); bow.position.set(0, .06, .03); bow.scale.set(1.6, .8, .5); g.add(bow); g.rotation.y = .3; },
  stamp(g) { const p = new THREE.Mesh(new THREE.BoxGeometry(.44, .54, .03), SM('#fff4e2')); g.add(p);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) { const n = new THREE.Mesh(new THREE.SphereGeometry(.032, 6, 4), SM('#fff4e2')); const side = i < 2; n.position.set(side ? (i ? .22 : -.22) : (-.18 + k * .09), side ? (-.22 + k * .11) : (i === 2 ? .27 : -.27), 0); g.add(n); }
    const pic = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, .035), SM('#7fc8ee')); g.add(pic); const hill = new THREE.Mesh(new THREE.BoxGeometry(.32, .14, .04), SM('#7ed37a')); hill.position.y = -.14; g.add(hill);
    const sun = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .045, 10), SM('#ffc93c')); sun.rotation.x = PI / 2; sun.position.set(.07, .1, 0); g.add(sun); g.rotation.set(-.1, .35, -.12); },
  charm(g) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.22), SM('#b48cff', { flatShading: true, emissive: '#7a4ae0', emissiveIntensity: .25 })); gem.scale.y = 1.35; g.add(gem);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.3, .03, 4, 20), SM('#ffc93c')); ring.rotation.x = 1.2; g.add(ring);
    for (const [x, y, c] of [[-.24, .2, '#7ed37a'], [.25, .16, '#ff7a3a'], [.02, -.34, '#4fb0ee']]) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(.055), SM(c)); s.position.set(x, y, .1); g.add(s); } },
  // a Blast Bay pop seed: pink pod, four leaves and a glowing tip
  seed(g) { const pod = new THREE.Mesh(new THREE.IcosahedronGeometry(.26, 1), SM('#ff8fc8', { flatShading: true })); pod.scale.y = 1.1; pod.position.y = -.08; g.add(pod);
    for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2, lf = new THREE.Mesh(new THREE.ConeGeometry(.09, .24, 4), SM('#6cbf4a', { flatShading: true })); lf.position.set(Math.cos(a) * .13, .22, Math.sin(a) * .13); lf.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); g.add(lf); }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), SM('#fff07a', { emissive: '#fff07a', emissiveIntensity: .6 })); tip.position.y = .3; g.add(tip); g.rotation.z = -.2; },
  // a Pet Pairs card: blue striped back with a paw print, half turned
  memcard(g) { const c = new THREE.Mesh(new THREE.BoxGeometry(.42, .56, .04), SM('#2f86cc')); g.add(c);
    for (const y of [-.16, 0, .16]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.44, .05, .045), SM('#4fa3e3')); s.position.y = y; s.rotation.z = .6; s.scale.x = .9; g.add(s); }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .05, 16), SM('#fff8ec')); disc.rotation.x = PI / 2; disc.position.z = .01; g.add(disc);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .06, 10), SM('#ffb547')); pad.rotation.x = PI / 2; pad.position.set(0, -.02, .015); g.add(pad);
    for (const [x, y] of [[-.06, .06], [0, .08], [.06, .06]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .06, 8), SM('#ffb547')); t.rotation.x = PI / 2; t.position.set(x, y, .015); g.add(t); }
    g.rotation.set(-.1, .5, .15); },
};
export function pieceModel(id) { const g = new THREE.Group(); (PIECE[id] || PIECE.marble)(g); return toonify(g, .04); }

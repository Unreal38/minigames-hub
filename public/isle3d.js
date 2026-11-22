// The profile isle and its variants: the ground theme, the rock underneath, up to three decor props and the sky.
// What a player picked rides in their flair (cosmetics.js kinds ig, ib, ip, ik); the indexes here match those lists,
// so only ever append.
//
//   buildIsle(look)        look = { ig, ib, ip: [..] }  ->  { root, tick(T), air, dispose() }
//   buildSky(ik, opts)     the backdrop                 ->  { root, tick(T), mood, dispose() }   mood: '' (follows the site's day/night switch), 'day', 'night' or 'sunset'
//   decorOnly(i)           one decor prop on a little lawn, for the wardrobe pictures
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
function finish(g, ink = .04) {
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
const moundOf = c => (g, s = 1) => { const m = ico(g, .5 * s, c, 0, .02, 0); m.scale.set(1.5, .32, 1.1); };
const R = {
  snowpine(g, s = 1) { cyl(g, .07 * s, .1 * s, .4 * s, '#7a5a48', 0, .2 * s); for (let i = 0; i < 3; i++) { cone(g, (.5 - i * .12) * s, .55 * s, '#4f9a7c', 0, (.6 + i * .3) * s, 0, 7); cone(g, (.34 - i * .09) * s, .3 * s, '#f6fbff', 0, (.76 + i * .3) * s, 0, 7); } },
  cactus(g, s = 1) { const c = '#5fae62'; cyl(g, .13 * s, .15 * s, .8 * s, c, 0, .4 * s, 0, 7); ico(g, .13 * s, c, 0, .8 * s, 0);
    cyl(g, .07 * s, .07 * s, .26 * s, c, .2 * s, .42 * s, 0).rotation.z = PI / 2; cyl(g, .07 * s, .07 * s, .3 * s, c, .31 * s, .56 * s, 0);
    cyl(g, .06 * s, .06 * s, .22 * s, c, -.18 * s, .3 * s, 0).rotation.z = PI / 2; cyl(g, .06 * s, .06 * s, .22 * s, c, -.27 * s, .4 * s, 0); ico(g, .06 * s, '#ff8fb8', 0, .95 * s, 0); },
  deadtree(g, s = 1, c = '#5a4a48') { cyl(g, .06 * s, .12 * s, .9 * s, c, 0, .45 * s); const a = cyl(g, .03 * s, .05 * s, .5 * s, c, .16 * s, .85 * s, 0); a.rotation.z = -.8; const b = cyl(g, .03 * s, .05 * s, .4 * s, c, -.13 * s, .7 * s, .03 * s); b.rotation.z = .9; const d = cyl(g, .02 * s, .03 * s, .3 * s, c, .02 * s, 1 * s, -.08 * s); d.rotation.x = -.5; },
  log(g, s = 1) { const l = cyl(g, .12 * s, .12 * s, .6 * s, '#8a5a3c', 0, .12 * s, 0, 7); l.rotation.z = PI / 2; const e = cyl(g, .09 * s, .09 * s, .62 * s, '#e0b98a', 0, .12 * s, 0, 7); e.rotation.z = PI / 2; ico(g, .08 * s, '#e5543b', .1 * s, .27 * s, .05 * s).scale.y = .6; },
  pumpkin(g, s = 1) { const p = ico(g, .24 * s, '#f08a2a', 0, .17 * s, 0); p.scale.y = .75; const q = ico(g, .15 * s, '#e0701e', .3 * s, .1 * s, .12 * s); q.scale.y = .75; cyl(g, .025 * s, .035 * s, .1 * s, '#5f8a3a', 0, .37 * s); },
  bigshroom(g, s = 1, c = '#e5543b') { cyl(g, .09 * s, .13 * s, .7 * s, '#fff4e2', 0, .35 * s, 0, 7); const cap = put(g, new THREE.SphereGeometry(.48 * s, 9, 5, 0, 6.3, 0, 1.5), flat(c), 0, .62 * s);
    for (let i = 0; i < 5; i++) { const a = i * 1.257 + .4; glow(cap, new THREE.IcosahedronGeometry(.07 * s, 0), '#fff8c9', Math.cos(a) * .3 * s, .3 * s, Math.sin(a) * .3 * s); } glow(cap, new THREE.IcosahedronGeometry(.08 * s, 0), '#fff8c9', 0, .47 * s, 0); },
  palm(g, s = 1) { let x = 0, y = 0; for (let i = 0; i < 4; i++) { const t = cyl(g, (.08 - i * .008) * s, (.1 - i * .008) * s, .34 * s, i % 2 ? '#a8794f' : '#96683f', x, y + .17 * s, 0, 6); t.rotation.z = -.12 * i; x += .05 * i * s; y += .32 * s; }
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, l = box(g, .62 * s, .04 * s, .2 * s, i % 2 ? '#4fa64a' : '#63bb55', x + Math.cos(a) * .27 * s, y - .02 * s, Math.sin(a) * .27 * s); l.rotation.set(0, -a, -.45); }
    ico(g, .07 * s, '#7a4f2c', x + .08 * s, y - .1 * s, .05 * s); ico(g, .07 * s, '#7a4f2c', x - .06 * s, y - .1 * s, -.05 * s); },
  parasol(g, s = 1) { cyl(g, .025 * s, .025 * s, 1 * s, '#fff4e2', 0, .5 * s); const top = new THREE.Group(); top.position.y = .95 * s; top.rotation.z = .2; g.add(top);
    for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.55 * s, .3 * s, 1, 1, false, i * PI / 4, PI / 4), flat(i % 2 ? '#ffffff' : '#ff6f61')); top.add(c); }
    const tw = box(g, .34 * s, .03 * s, .6 * s, '#7fd0ff', .15 * s, .03 * s, .25 * s); tw.rotation.y = .3; },
  castle(g, s = 1) { const c = '#e9c887'; box(g, .42 * s, .26 * s, .42 * s, c, 0, .13 * s); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cyl(g, .09 * s, .1 * s, .4 * s, c, x * .2 * s, .2 * s, z * .2 * s, 7); cone(g, .11 * s, .14 * s, '#dcb770', x * .2 * s, .47 * s, z * .2 * s, 7); }
    const st = ico(g, .09 * s, '#ff8a5c', .42 * s, .03 * s, .2 * s); st.scale.y = .35; },
  lolly(g, s = 1) { const cols = [['#ff6f91', '#ffd0dc'], ['#6ec6f5', '#d9f1ff'], ['#ffc93c', '#fff1a8'], ['#9b7bff', '#e0d4ff']], [a, b] = cols[Math.floor(s * 97) % 4];
    cyl(g, .03 * s, .03 * s, .8 * s, '#ffffff', 0, .4 * s); const d = cyl(g, .3 * s, .3 * s, .1 * s, a, 0, .98 * s, 0, 12); d.rotation.x = PI / 2; const e = cyl(g, .19 * s, .19 * s, .13 * s, b, 0, .98 * s, 0, 10); e.rotation.x = PI / 2; const f = cyl(g, .09 * s, .09 * s, .16 * s, a, 0, .98 * s, 0, 8); f.rotation.x = PI / 2; },
  cane(g, s = 1) { for (let i = 0; i < 5; i++) cyl(g, .06 * s, .06 * s, .16 * s, i % 2 ? '#ffffff' : '#ff4f6a', 0, (.08 + i * .16) * s, 0, 7);
    for (let i = 0; i < 4; i++) { const a = i / 3 * PI, m = cyl(g, .06 * s, .06 * s, .14 * s, i % 2 ? '#ff4f6a' : '#ffffff', (.14 - Math.cos(a) * .14) * s, (.8 + Math.sin(a) * .14) * s, 0, 7); m.rotation.z = -a; } },
  gumdrop(g, s = 1) { const cols = ['#7ed3b2', '#ff9fb8', '#ffc93c', '#b79bff']; for (let i = 0; i < 3; i++) { const a = i * 2.1; put(g, new THREE.SphereGeometry((.17 - i * .03) * s, 8, 4, 0, 6.3, 0, PI / 2), flat(cols[(Math.floor(s * 53) + i) % 4]), Math.cos(a) * .18 * s, 0, Math.sin(a) * .18 * s).scale.y = 1.25; } },
  lavarock(g, s = 1) { const r = ico(g, .34 * s, '#3a2e36', 0, .2 * s, 0); r.scale.y = .9; ico(g, .2 * s, '#2a2028', .3 * s, .1 * s, .1 * s);
    glow(g, new THREE.IcosahedronGeometry(.1 * s, 0), '#ff7a2a', .08 * s, .44 * s, .12 * s); glow(g, new THREE.IcosahedronGeometry(.07 * s, 0), '#ffc93c', -.2 * s, .22 * s, .2 * s); glow(g, new THREE.IcosahedronGeometry(.06 * s, 0), '#ff7a2a', .24 * s, .26 * s, -.12 * s); },
  vent(g, s = 1) { put(g, new THREE.CylinderGeometry(.14 * s, .34 * s, .5 * s, 7), flat('#3a2e36'), 0, .25 * s); glow(g, new THREE.CylinderGeometry(.11 * s, .11 * s, .04 * s, 7), '#ff7a2a', 0, .5 * s, 0); glow(g, new THREE.IcosahedronGeometry(.05 * s, 0), '#ffc93c', .03 * s, .62 * s, 0); },
  coins(g, s = 1) { for (let i = 0; i < 4; i++) cyl(g, .13 * s, .13 * s, .05 * s, i % 2 ? '#ffd23e' : '#f0b020', (i % 2) * .02 * s, (.03 + i * .055) * s, 0, 10); for (let i = 0; i < 2; i++) cyl(g, .13 * s, .13 * s, .05 * s, '#ffd23e', .3 * s, (.03 + i * .055) * s, .1 * s, 10); },
  trophy(g, s = 1) { box(g, .34 * s, .3 * s, .34 * s, '#fff4e2', 0, .15 * s); box(g, .4 * s, .05 * s, .4 * s, '#e3d6c2', 0, .32 * s); const c = '#ffc93c';
    cyl(g, .09 * s, .11 * s, .05 * s, c, 0, .37 * s, 0, 8); cyl(g, .025 * s, .025 * s, .14 * s, c, 0, .46 * s); cyl(g, .16 * s, .08 * s, .24 * s, c, 0, .65 * s, 0, 8);
    for (const d of [-1, 1]) { const h = put(g, new THREE.TorusGeometry(.07 * s, .02 * s, 4, 8), flat(c), d * .16 * s, .66 * s, 0); } },
  pennant(g, s = 1) { const cols = ['#ff6f61', '#6ec6f5', '#ffc93c', '#9b7bff']; cyl(g, .03 * s, .04 * s, 1.3 * s, '#fff4e2', 0, .65 * s); ico(g, .05 * s, '#ffc93c', 0, 1.33 * s, 0);
    const f = put(g, new THREE.ConeGeometry(.17 * s, .46 * s, 3), flat(cols[Math.floor(s * 71) % 4]), .23 * s, 1.1 * s, 0); f.rotation.z = -PI / 2; f.scale.z = .15; },
  grave(g, s = 1) { box(g, .3 * s, .34 * s, .09 * s, '#8f8a99', 0, .17 * s); const t = cyl(g, .15 * s, .15 * s, .09 * s, '#8f8a99', 0, .34 * s, 0, 8); t.rotation.x = PI / 2; box(g, .4 * s, .06 * s, .16 * s, '#6f6a7a', 0, .03 * s); },
};

// ---------- ground themes (cosmetics.js COS.ig) ----------
// air: what drifts past (colours of the petals() flakes); water: what a waterfall base pours.
const GROUND = [
  { air: { colors: ['#ffc1dc', '#ffffff', '#a8e08a', '#ffd9ea', '#ffe9a8', '#c9f0a8'], n: 8 } },
  { grass: '#f4f9ff', patch: '#dcebfa', earth: '#a9bdd4', rock: '#70819a', flowers: 0, water: '#bfe6ff',
    kinds: [R.snowpine, rockOf('#a9b4c4', '#8894a8', '#f6fbff'), bushOf('#f6fbff', '#e2eefb'), R.snowpine, moundOf('#ffffff'), R.snowpine, rockOf('#a9b4c4', '#8894a8', '#f6fbff'), bushOf('#f6fbff', '#e2eefb'), 'pine', moundOf('#ffffff')],
    air: { colors: ['#ffffff', '#eaf4ff'], n: 22, size: .06 } },
  { grass: '#f0d18a', patch: '#e3bf72', earth: '#d49a5a', rock: '#a8704a', flowers: 8, petals: ['#ff8fb8', '#fff1a8'],
    kinds: [R.cactus, moundOf('#e9c57a'), rockOf('#d0a06a', '#b98a58'), bushOf('#b9a55a', '#cdb96a'), R.cactus, moundOf('#e9c57a'), g => R.deadtree(g, .8, '#9a7450'), rockOf('#d0a06a', '#b98a58'), R.cactus, bushOf('#b9a55a', '#cdb96a')],
    air: { colors: ['#f6e0a6', '#e9c57a'], n: 6, size: .05 } },
  { grass: '#a9dc7a', patch: '#f7c4d8', flowers: 40, petals: ['#ffd0e4', '#ffffff', '#ff9cc2'],
    kinds: [treeOf('#6a4636', '#ffb3d1', '#ffd0e4'), bushOf('#ff9cc2', '#ffd0e4', '#ffffff'), treeOf('#6a4636', '#ff9cc2', '#ffc4dc'), 'rock', treeOf('#6a4636', '#ffb3d1', '#ffe0ec'), bushOf('#5fb04a', '#86cc5a', '#ff9fb8'), 'flowers', treeOf('#6a4636', '#ff9cc2', '#ffd0e4'), bushOf('#ff9cc2', '#ffd0e4', '#ffffff'), 'rock'],
    air: { colors: ['#ffc1dc', '#ffffff', '#ff9cc2', '#ffd9ea'], n: 20, size: .09 } },
  { grass: '#d2b659', patch: '#e2853a', earth: '#b9794c', flowers: 14, petals: ['#e8742a', '#d9452a', '#f0b030'],
    kinds: [treeOf('#7a5038', '#e8742a', '#f0a030'), R.log, treeOf('#7a5038', '#d9452a', '#e8742a'), bushOf('#c9902e', '#e0a83a'), treeOf('#7a5038', '#f0b030', '#f6cf5a'), 'shroom', moundOf('#e2853a'), treeOf('#7a5038', '#d9452a', '#f0a030'), 'rock', bushOf('#c9902e', '#e0a83a')],
    air: { colors: ['#e8742a', '#d9452a', '#f0b030', '#c9902e'], n: 18, size: .1 } },
  { grass: '#5fae8a', patch: '#4d9979', earth: '#7c5a7c', rock: '#5d4a6e', flowers: 22, petals: ['#b79bff', '#8fe0ff', '#fff8c9'], water: '#8fe0ff',
    kinds: [R.bigshroom, bushOf('#3f8f78', '#56a88c'), (g, s) => R.bigshroom(g, s * .8, '#9b7bff'), 'shroom', (g, s) => R.bigshroom(g, s * 1.1, '#4fb6d9'), bushOf('#3f8f78', '#56a88c', '#b79bff'), R.bigshroom, 'shroom', (g, s) => R.bigshroom(g, s * .9, '#ff8fb8'), rockOf('#7c6a8c', '#5d4a6e')],
    air: { colors: ['#fff8c9', '#b79bff', '#8fe0ff'], n: 14, size: .05 } },
  { grass: '#f6e0a6', patch: '#ecd08c', earth: '#e0b878', rock: '#b89872', flowers: 10, petals: ['#ff8a5c', '#ffffff', '#ffd0e4'],
    kinds: [R.palm, rockOf('#c9bfb2', '#a89e92'), R.parasol, R.palm, R.castle, bushOf('#5fb04a', '#86cc5a', '#ff9fb8'), R.palm, moundOf('#f0d696'), R.palm, rockOf('#c9bfb2', '#a89e92')],
    air: { colors: ['#ffffff', '#d9f1ff'], n: 6, size: .06 } },
  { grass: '#ffb8d9', patch: '#fff4fa', earth: '#7b4a2e', rock: '#f0d8a8', flowers: 46, petals: ['#6ec6f5', '#ffc93c', '#7ed3b2', '#ff6f91', '#9b7bff'], water: '#ff8fc4',
    kinds: [R.lolly, R.gumdrop, R.cane, R.lolly, bushOf('#ffffff', '#ffe0ef', '#ff4f6a'), R.gumdrop, R.lolly, R.cane, R.gumdrop, R.lolly],
    air: { colors: ['#6ec6f5', '#ffc93c', '#7ed3b2', '#ff6f91', '#ffffff'], n: 14, size: .06 } },
  { grass: '#463a44', patch: '#ff7a2a', earth: '#2f252c', rock: '#1f181c', flowers: 0, water: '#ff8a2a', lava: true,
    kinds: [R.lavarock, R.vent, g => R.deadtree(g, 1, '#2a2028'), R.lavarock, rockOf('#3a2e36', '#2a2028'), R.vent, R.lavarock, g => R.deadtree(g, .8, '#2a2028'), rockOf('#3a2e36', '#2a2028'), R.lavarock],
    air: { colors: ['#ff7a2a', '#ffc93c', '#ff4f2a'], n: 16, size: .045 } },
  { grass: '#ffd75a', patch: '#ffc12e', earth: '#e0a030', rock: '#b87a1e', flowers: 30, petals: ['#ffffff', '#fff1a8'], water: '#fff1a8',
    kinds: [treeOf('#fff4e2', '#ffc93c', '#ffe680'), R.coins, rockOf('#f0b020', '#d99a18'), treeOf('#fff4e2', '#ffd23e', '#fff1a8'), bushOf('#ffc93c', '#ffe680', '#ffffff'), R.coins, treeOf('#fff4e2', '#ffc93c', '#ffe680'), rockOf('#f0b020', '#d99a18'), bushOf('#ffc93c', '#ffe680', '#ffffff'), R.coins],
    air: { colors: ['#fff8c9', '#ffffff', '#ffd23e'], n: 18, size: .05 } },
  { grass: '#7ccf7a', patch: '#69bd68', earth: '#7a5ab8', rock: '#57428a', flowers: 30, petals: ['#ffc93c', '#ffffff', '#ff6f61'],
    kinds: [R.trophy, R.pennant, bushOf('#3f8c4a', '#5fb04a', '#ffc93c'), 'tree', R.pennant, R.trophy, bushOf('#3f8c4a', '#5fb04a', '#ffc93c'), R.pennant, 'tree', R.pennant],
    air: { colors: ['#ff6f61', '#6ec6f5', '#ffc93c', '#9b7bff', '#7ed3b2'], n: 16, size: .07 } },
  { grass: '#7c9454', patch: '#657c44', earth: '#5a4038', rock: '#3d2f3a', flowers: 8, petals: ['#f08a2a', '#b79bff'],
    kinds: [R.pumpkin, R.deadtree, R.pumpkin, R.grave, bushOf('#56703c', '#6a8448'), R.pumpkin, R.deadtree, R.grave, R.pumpkin, bushOf('#56703c', '#6a8448')],
    air: { colors: ['#f08a2a', '#7a5ab8', '#c9902e'], n: 12, size: .09 } },
];
export const groundOf = ig => ({ grass: '#8bca60', patch: '#7fbf56', earth: '#c98a5a', rock: '#857a72', flowers: 32, water: '#6ec6f5', ...(GROUND[ig] || GROUND[0]) });

// ---------- rock bases (COS.ib) ----------
const RAD = 2.95; // the isle's radius: island(3.3, 3.3, { rim: 1.3 })
const stub = (root, th, deep) => { const c = put(root, rough(new THREE.ConeGeometry(RAD * .62, deep, 8, 2), RAD * .08), flat(th.rock), 0, -2 - deep / 2); c.rotation.x = PI; return c; };
const BASE = [
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

// ---------- decor (COS.ip): each builds into g, standing on y = 0 and facing +z ----------
const DECOR = [
  g => { cyl(g, .04, .05, 1, '#8a5a3c', 0, .5); const a = box(g, .5, .16, .04, '#e9c887', .08, .82, .03); const p = cone(g, .1, .14, '#e9c887', .37, .82, .03, 3); p.rotation.z = -PI / 2; p.scale.z = .25;
    box(g, .44, .15, .04, '#ffd9a0', -.07, .6, .03); const q = cone(g, .095, .13, '#ffd9a0', -.33, .6, .03, 3); q.rotation.z = PI / 2; q.scale.z = .25; ico(g, .05, '#ff9fb8', .1, .03, .1); },
  g => { const t = put(g, new THREE.CylinderGeometry(.5, .5, 1.1, 3), flat('#ff9a5c'), 0, .25, 0); t.rotation.x = -PI / 2; t.scale.x = 1.2; // a ridge tent: a prism lying on its side
    const door = put(g, new THREE.CylinderGeometry(.27, .27, .04, 3), flat('#6a4636'), 0, .135, .55); door.rotation.x = -PI / 2;
    const fl = put(g, new THREE.CylinderGeometry(.52, .52, .1, 3), flat('#ffd9a0'), 0, .26, -.5); fl.rotation.x = -PI / 2; fl.scale.x = 1.2;
    for (const z of [-.5, .5]) for (const x of [-.72, .72]) cyl(g, .02, .02, .16, '#8a5a3c', x, .06, z).rotation.z = x * .7; },
  (g, ticks) => { for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; ico(g, .09, i % 2 ? '#a9a6b0' : '#8a8794', Math.cos(a) * .3, .05, Math.sin(a) * .3).scale.y = .7; }
    for (let i = 0; i < 3; i++) { const l = cyl(g, .05, .05, .5, '#8a5a3c', 0, .1, 0); l.rotation.set(PI / 2 - .25, i * 2.09, 0, 'YXZ'); }
    const f = dyn(g), a = glow(f, new THREE.ConeGeometry(.17, .46, 5), '#ff7a2a', 0, .36, 0), b = glow(f, new THREE.ConeGeometry(.1, .3, 5), '#ffd23e', 0, .3, 0), sp = [0, 1, 2].map(i => glow(f, new THREE.IcosahedronGeometry(.03, 0), '#ffd23e'));
    const log = box(g, .6, .16, .2, '#96683f', .75, .08, .1); log.rotation.y = .5;
    ticks.push(T => { a.scale.set(1 + Math.sin(T * 9) * .1, 1 + Math.sin(T * 11 + 1) * .16, 1 + Math.cos(T * 8) * .1); b.scale.y = 1 + Math.sin(T * 13) * .2; a.rotation.y = T * 2;
      sp.forEach((m, i) => { const u = (T * .6 + i / 3) % 1; m.position.set(Math.sin(T * 2 + i * 2) * .1, .5 + u * .7, Math.cos(T * 1.7 + i) * .1); m.scale.setScalar(1 - u); }); }); },
  g => { cyl(g, .04, .05, .7, '#8a5a3c', 0, .35); box(g, .26, .2, .4, '#ff6f61', 0, .78, 0); const top = cyl(g, .13, .13, .4, '#ff6f61', 0, .88, 0, 8); top.rotation.x = PI / 2; box(g, .2, .2, .02, '#d9483c', 0, .8, .205);
    cyl(g, .012, .012, .22, '#fff4e2', .15, .92, .08); box(g, .02, .09, .12, '#ffc93c', .15, 1, .12); const l = box(g, .16, .11, .015, '#ffffff', .0, .06, .3); l.rotation.set(-1.2, .4, 0); },
  (g, ticks) => { for (const x of [-.5, .5]) for (const z of [-.3, .3]) { const p = cyl(g, .035, .04, 1.36, '#8a5a3c', x, .66, z * .6); p.rotation.x = -z * .75; }
    const bar = cyl(g, .04, .04, 1.14, '#8a5a3c', 0, 1.3, 0); bar.rotation.z = PI / 2;
    const s = dyn(g); s.position.y = 1.3; for (const x of [-.2, .2]) cyl(s, .012, .012, .9, '#fff4e2', x, -.45, 0, 4); box(s, .52, .05, .2, '#ff9a5c', 0, -.9, 0);
    ticks.push(T => { s.rotation.x = Math.sin(T * 1.8) * .42; }); },
  (g, ticks) => { for (const x of [-.75, .75]) { cyl(g, .035, .045, 1.25, '#5b4636', x, .62, 0); ico(g, .05, '#5b4636', x, 1.27, 0); }
    const cols = ['#ff6f61', '#ffc93c', '#7ed3b2', '#6ec6f5', '#ff9fe0'], list = [];
    for (let i = 0; i < 5; i++) { const u = (i + .5) / 5, x = -.75 + u * 1.5, y = 1.22 - Math.sin(u * PI) * .28, d = dyn(g); d.position.set(x, y, 0); cyl(d, .008, .008, .08, '#5b4636', 0, -.04, 0, 4);
      glow(d, new THREE.CylinderGeometry(.07, .055, .15, 6), cols[i], 0, -.15, 0); cyl(d, .045, .045, .025, '#5b4636', 0, -.07, 0, 6); cyl(d, .035, .035, .02, '#5b4636', 0, -.235, 0, 6); list.push(d); }
    for (let i = 0; i < 6; i++) { const u0 = i / 6, u1 = (i + 1) / 6, p0 = [-.75 + u0 * 1.5, 1.24 - Math.sin(u0 * PI) * .28], p1 = [-.75 + u1 * 1.5, 1.24 - Math.sin(u1 * PI) * .28], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const m = cyl(g, .008, .008, len, '#5b4636', (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0, 4); m.rotation.z = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + PI / 2; }
    ticks.push(T => list.forEach((d, i) => { d.rotation.z = Math.sin(T * 1.6 + i * .9) * .16; })); },
  (g, ticks) => { cyl(g, .2, .34, 1.1, '#fff4e2', 0, .55, 0, 8); cone(g, .28, .32, '#ff6f61', 0, 1.26, 0, 8); box(g, .14, .24, .02, '#8a5a3c', 0, .13, .33); box(g, .1, .1, .02, '#6ec6f5', 0, .7, .26);
    cyl(g, .03, .03, .2, '#5b4636', 0, 1.02, .28).rotation.x = PI / 2;
    const b = dyn(g); b.position.set(0, 1.02, .4); for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * PI / 2; b.add(arm); box(arm, .03, .62, .02, '#8a5a3c', 0, .31, 0); box(arm, .16, .44, .015, '#ffe9c9', .07, .38, 0); }
    ico(b, .05, '#5b4636', 0, 0, .01); ticks.push(T => { b.rotation.z = -T * 1.3; }); },
  g => { ico(g, .34, '#ffffff', 0, .28, 0); ico(g, .25, '#ffffff', 0, .72, 0); ico(g, .18, '#ffffff', 0, 1.05, 0); const n = cone(g, .04, .18, '#ff8a3c', 0, 1.05, .22, 5); n.rotation.x = PI / 2;
    for (const x of [-.07, .07]) ico(g, .025, '#3b2219', x, 1.12, .15); for (const y of [.62, .78]) ico(g, .028, '#3b2219', 0, y, .24);
    cyl(g, .19, .19, .05, '#3b2219', 0, 1.2, 0, 8); cyl(g, .12, .12, .2, '#3b2219', 0, 1.3, 0, 8); cyl(g, .2, .2, .07, '#ff6f61', 0, .92, 0, 8);
    for (const d of [-1, 1]) { const a = cyl(g, .015, .02, .4, '#8a5a3c', d * .38, .8, 0, 4); a.rotation.z = -d * 1.1; } },
  (g, ticks) => { const p = ico(g, .4, '#f08a2a', 0, .3, 0); p.scale.set(1.1, .8, 1); cyl(g, .04, .06, .16, '#5f8a3a', 0, .66, 0);
    const f = dyn(g), eye = () => { const m = new THREE.ConeGeometry(.07, .1, 3); return m; };
    for (const x of [-.14, .14]) { const e = glow(f, eye(), '#ffe27a', x, .38, .385); e.scale.z = .2; }
    const mouth = glow(f, new THREE.BoxGeometry(.3, .06, .02), '#ffe27a', 0, .2, .4); for (const x of [-.09, .03]) glow(f, new THREE.BoxGeometry(.05, .05, .02), '#ffe27a', x + .03, .245, .4);
    ticks.push(T => { const k = .85 + Math.sin(T * 7) * .08 + Math.sin(T * 13) * .07; for (const m of f.children) m.material.color.setRGB(k, k * .86, k * .42); }); },
];
// Where decor stands: clear of the avatar, the pets and the lamp posts. [x, z, turn]
const SLOTS = [[-1.6, -.9, .45], [1.6, -.9, -.45], [2, 1, -.7]];
function decor(i, ticks) {
  const g = new THREE.Group(); if (!DECOR[i]) return null;
  DECOR[i](g, ticks); return finish(g, .035);
}

export function buildIsle(look = {}) {
  const ig = look.ig | 0, ib = BASE[look.ib | 0] ? look.ib | 0 : 0, th = groundOf(ig), ticks = [], root = new THREE.Group();
  const land = island(3.3, 3.3, { round: true, seed: 7, props: 14, open: .8, rim: 1.3, size: .9, flowers: th.flowers, grass: th.grass, patch: th.patch, earth: th.earth, rock: th.rock, kinds: th.kinds || null, petals: th.petals || null, under: !ib || ib === 3 });
  root.add(land);
  if (th.lava) { // pools that glow and pulse
    const g = dyn(root), mt = new THREE.MeshBasicMaterial({ color: '#ff7a2a' });
    for (const [x, z, r] of [[-2, -.3, .34], [2.1, -.5, .28], [-.9, -2.2, .3], [1, -2.3, .24], [-2.1, 1.2, .22]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 9), mt); m.rotation.x = -PI / 2; m.position.set(x, .015, z); m.userData.noInk = true; g.add(m); }
    ticks.push(T => { const k = .8 + Math.sin(T * 1.6) * .2; mt.color.setRGB(1, .42 * k + .1, .12 * k); });
  }
  if (ib) { const g = new THREE.Group(); root.add(g); BASE[ib](g, th, ticks); finish(g, .05); g.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
  (Array.isArray(look.ip) ? look.ip : []).slice(0, SLOTS.length).forEach((d, n) => { const g = decor(d, ticks); if (!g) return; const [x, z, ry] = SLOTS[n]; g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(1.4); root.add(g); });
  return { root, land, air: th.air, tick: T => { for (const f of ticks) f(T); }, dispose: () => disposeToon(root) };
}
export function decorOnly(i) {
  const ticks = [], root = new THREE.Group(), g = decor(i, ticks); if (g) root.add(g);
  const lawn = new THREE.Group(); put(lawn, new THREE.CylinderGeometry(1.05, .95, .16, 14), flat('#8bca60'), 0, -.08, 0); root.add(toonify(lawn, .035));
  return { root, tick: T => { for (const f of ticks) f(T); }, dispose: () => disposeToon(root) };
}

// ---------- skies (COS.ik) ----------
// Colours of each sky, top to bottom: the page paints them behind the canvas (style.css .isk1..), or with disc: true
// they are drawn as a soft round window behind the isle (the hub, where there is no frame to fill).
export const SKY_COLORS = [null, ['#4b3a8f', '#ff7a6a', '#ffc27a'], ['#0c1236', '#2d2b63', '#4a3f8a'], ['#06142e', '#123a55', '#2b2856'], ['#6ec0f5', '#bfe6ff', '#eaf8ff']];
const MOOD = ['', 'sunset', 'night', 'night', 'day'];
function discTex(cols) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  const lin = c.createLinearGradient(0, 20, 0, 236); cols.forEach((x, i) => lin.addColorStop(i / (cols.length - 1), x)); c.fillStyle = lin; c.fillRect(0, 0, 256, 256);
  c.globalCompositeOperation = 'destination-in'; const rad = c.createRadialGradient(128, 128, 60, 128, 128, 126); rad.addColorStop(0, '#000'); rad.addColorStop(.7, 'rgba(0,0,0,.9)'); rad.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rad; c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const basic = (c, o) => new THREE.MeshBasicMaterial({ color: c, depthWrite: false, fog: false, ...o });
function stars(root, n, ticks, disc) {
  const sets = [0, 1].map(k => { const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = hash(i, 11 + k) * 6.283, r = Math.sqrt(hash(i, 13 + k)) * 8;
    pos.set(disc ? [Math.cos(a) * r, .5 + Math.sin(a) * r, -12] : [(hash(i, 11 + k) - .5) * 20, -6 + hash(i, 13 + k) * 15, -11 - hash(i, 17) * 2], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: k ? '#fff6d8' : '#ffffff', size: k ? 3 : 2.2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })); p.renderOrder = -4; root.add(p); return p; });
  ticks.push(T => { sets[0].material.opacity = .65 + Math.sin(T * 1.7) * .3; sets[1].material.opacity = .65 + Math.cos(T * 1.3) * .3; });
}
export function buildSky(ik, { disc = false } = {}) {
  ik = SKY_COLORS[ik | 0] ? ik | 0 : 0;
  const root = new THREE.Group(), ticks = [], add = (geo, mat, x, y, z, ro = -3) => { const m = put(root, geo, mat, x, y, z); m.renderOrder = ro; return m; };
  if (ik && disc) add(new THREE.CircleGeometry(9.5, 40), new THREE.MeshBasicMaterial({ map: discTex(SKY_COLORS[ik]), transparent: true, depthWrite: false, fog: false }), 0, .5, -13, -6);
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
  }
  // fit(aspect): on a narrow canvas the round window shrinks to stay inside it
  return { root, mood: MOOD[ik], fit: a => { const k = disc ? Math.min(.92, a * .82) : 1; root.scale.set(k, k, 1); }, tick: T => { for (const f of ticks) f(T); }, dispose: () => { root.traverse(o => { o.material?.map?.dispose(); }); disposeToon(root); } };
}

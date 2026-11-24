// The seasons in the 3D minigames: every game island (island() in scenery3d.js) and the things drifting past it
// (petals()) dress for the time of year, so all games share one look that changes with the site's shop seasons.
//
//   seasonLookNow(now)     'winter' | 'spring' | 'summer' | 'autumn' | 'halloween' for that day (default: today).
//                      The dates are SEASONS in avatar.js (winter 15 Nov to 28 Feb, spring Mar to May, summer Jun
//                      to Aug, Halloween 1 Oct to 7 Nov); the days no drop covers (September, 8 to 14 November) are autumn.
//                      Hosts can look at another season from the Account menu (seasonpeek.js); players always get the date's.
//   LOOK[season]       colours of the lawn, patches, earth and rock; flower colours and how many; the rim props;
//                      the air (what petals() drops); icicles: winter hangs icicles under the lawn (trim()).
//   SP                 the season props, each sitting on y = 0 like PROPS in scenery3d.js (snowy pine, snowman,
//                      blossom tree, sunflower, autumn tree, pumpkin, jack-o'-lantern...). Other scenes may use them.
//
// The winter lawn is the hangout plaza's snow ('#f6faff') so the plaza and the games look like one world.
// Pet Farm and profile isles wear their owner's isle look instead (they pass season: null).
import * as THREE from 'three';
import { seasonOn } from './avatar.js';
import { peekSeason } from './seasonpeek.js';

export function seasonLookNow(now = new Date()) {
  const peek = peekSeason(); if (peek) return peek; // a host looking at another season (Account menu, own view only)
  for (const s of ['halloween', 'winter', 'spring', 'summer']) if (seasonOn(s, now)) return s;
  return 'autumn';
}

// ---------- props ----------
const mats = new Map();
const flat = c => { let m = mats.get(c); if (!m) mats.set(c, m = new THREE.MeshStandardMaterial({ color: c, roughness: .95, flatShading: true })); return m; };
const geos = new Map(), G = (k, f) => { let g = geos.get(k); if (!g) geos.set(k, g = f()); return g; };
const put = (p, g, c, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, flat(c)); o.position.set(x, y, z); p.add(o); return o; };
const ico = (p, r, c, x, y, z) => put(p, new THREE.IcosahedronGeometry(r, 0), c, x, y, z);
const cyl = (p, a, b, h, c, x, y, z, n = 6) => put(p, new THREE.CylinderGeometry(a, b, h, n), c, x, y, z);
const cone = (p, r, h, c, x, y, z, n = 7) => put(p, new THREE.ConeGeometry(r, h, n), c, x, y, z);
const pickOf = (s, k, list) => list[Math.floor(s * k) % list.length]; // a steady "random" choice from the prop's size
const SNOW = '#f6faff', SNOW2 = '#e3eef9', TRUNK = '#8a5a3c', BULBS = ['#ff5a6e', '#ffd65a', '#6ec6f5', '#86e06a', '#ffffff'];

export const SP = {
  // winter
  snowpine(g, s = 1) { cyl(g, .07 * s, .1 * s, .4 * s, TRUNK, 0, .2 * s);
    for (let i = 0; i < 3; i++) { const r = (.5 - i * .12) * s, y = (.6 + i * .3) * s; cone(g, r, .55 * s, i % 2 ? '#3f8c5a' : '#367f52', 0, y); cone(g, r * .78, .2 * s, SNOW, 0, y + .2 * s); }
    if (pickOf(s, 61, [0, 1, 1]) ) for (let k = 0; k < 8; k++) { const a = k * 1.9 + s * 7, y = (.5 + (k % 3) * .3) * s, r = (.44 - (k % 3) * .11) * s; ico(g, .065 * s, BULBS[k % BULBS.length], Math.cos(a) * r, y, Math.sin(a) * r).userData.bulb = true; } // a string of fairy lights (island() turns them into glowing ones)
    ico(g, .07 * s, '#ffd65a', 0, 1.42 * s, 0); },
  snowbush(g, s = 1) { ico(g, .3 * s, '#4a9a5a', 0, .2 * s, 0); ico(g, .24 * s, '#5aa86a', .25 * s, .15 * s, .05 * s); ico(g, .2 * s, '#3f8c5a', -.22 * s, .13 * s, .06 * s);
    const c = ico(g, .26 * s, SNOW, 0, .34 * s, 0); c.scale.y = .45; const d = ico(g, .17 * s, SNOW, .25 * s, .27 * s, .05 * s); d.scale.y = .45;
    ico(g, .05 * s, '#e5343b', -.2 * s, .28 * s, .2 * s); ico(g, .05 * s, '#e5343b', -.12 * s, .3 * s, .24 * s); }, // holly berries
  snowrock(g, s = 1) { const r = ico(g, .3 * s, '#a3a2b4', 0, .15 * s, 0); r.scale.y = .7; ico(g, .18 * s, '#8a8a9e', .28 * s, .08 * s, .1 * s); const c = ico(g, .25 * s, SNOW, 0, .27 * s, 0); c.scale.y = .35; },
  snowman(g, s = 1) { ico(g, .3 * s, SNOW, 0, .26 * s, 0).scale.y = .9; ico(g, .22 * s, SNOW, 0, .66 * s, 0); ico(g, .16 * s, SNOW, 0, .97 * s, 0);
    const n = cone(g, .035 * s, .18 * s, '#ff8a2a', 0, .97 * s, .2 * s, 5); n.rotation.x = Math.PI / 2;
    for (const x of [-.06, .06]) ico(g, .025 * s, '#2e2a3a', x * s, 1.02 * s, .14 * s);
    for (const y of [.58, .7]) ico(g, .03 * s, '#2e2a3a', 0, y * s, .21 * s);
    cyl(g, .18 * s, .18 * s, .06 * s, pickOf(s, 53, ['#e5343b', '#4a7ae0', '#3fa06a']), 0, .82 * s, 0, 10); // a scarf
    cyl(g, .1 * s, .12 * s, .16 * s, '#2e2a3a', 0, 1.16 * s, 0, 8); cyl(g, .17 * s, .17 * s, .03 * s, '#2e2a3a', 0, 1.09 * s, 0, 10); },
  gifts(g, s = 1) { for (const [x, z, w, h, c, r] of [[0, 0, .34, .3, '#e5343b', '#ffd65a'], [.32, .08, .26, .22, '#4a9ae0', '#ffffff'], [.05, .3, .22, .18, '#3fa06a', '#ff5a6e']]) {
      put(g, G('gb' + w + h, () => new THREE.BoxGeometry(w * s, h * s, w * s)), c, x * s, h / 2 * s, z * s);
      put(g, G('gr' + w + h, () => new THREE.BoxGeometry(w * 1.04 * s, h * 1.02 * s, .05 * s)), r, x * s, h / 2 * s, z * s);
      put(g, G('gq' + w + h, () => new THREE.BoxGeometry(.05 * s, h * 1.02 * s, w * 1.04 * s)), r, x * s, h / 2 * s, z * s); } },
  // spring
  blossom(g, s = 1) { const c = pickOf(s, 97, ['#ffc1dc', '#ffd9ea', '#ffb0cf']); cyl(g, .09 * s, .13 * s, .7 * s, TRUNK, 0, .35 * s);
    ico(g, .45 * s, c, 0, .95 * s, 0); ico(g, .32 * s, '#ffffff', .22 * s, 1.18 * s, .08 * s); ico(g, .3 * s, c, -.24 * s, .82 * s, -.1 * s); ico(g, .2 * s, '#ffe9f3', .1 * s, .7 * s, .3 * s); },
  tulips(g, s = 1) { for (let i = 0; i < 5; i++) { const a = i * 1.26 + s, x = Math.cos(a) * .16 * s, z = Math.sin(a) * .16 * s, c = ['#ff5a6e', '#ffd65a', '#ff9fd0', '#c9a8ff', '#ff8a4a'][i];
      cyl(g, .014 * s, .014 * s, .26 * s, '#5fb04a', x, .13 * s, z, 4); const b = cyl(g, .065 * s, .04 * s, .11 * s, c, x, .29 * s, z, 6); b.scale.z = .8; } },
  // summer
  sunflower(g, s = 1) { for (const [x, z, h] of [[0, 0, 1], [.26, .1, .75]]) { cyl(g, .025 * s, .03 * s, .8 * h * s, '#5fa646', x * s, .4 * h * s, z * s, 5);
      const f = new THREE.Group(); f.position.set(x * s, .82 * h * s, (z + .02) * s); f.rotation.x = -.35; g.add(f);
      for (let k = 0; k < 8; k++) { const a = k * .785, p = ico(f, .07 * s, '#ffc93c', Math.cos(a) * .12 * s, Math.sin(a) * .12 * s, 0); p.scale.z = .4; }
      const m = ico(f, .08 * s, '#7a4a2b', 0, 0, .02 * s); m.scale.z = .5; ico(f, .06 * s, '#5fb04a', -.1 * s, -.3 * s, 0).scale.z = .4; } },
  // autumn and Halloween
  autumntree(g, s = 1) { const [a, b] = pickOf(s, 97, [['#ff9a3c', '#ffc23e'], ['#e5543b', '#ff8a4a'], ['#ffc23e', '#ffe07a'], ['#d9653a', '#ffb14a']]);
    cyl(g, .09 * s, .13 * s, .7 * s, TRUNK, 0, .35 * s); ico(g, .45 * s, a, 0, .95 * s, 0); ico(g, .32 * s, b, .22 * s, 1.18 * s, .08 * s); ico(g, .3 * s, a, -.24 * s, .82 * s, -.1 * s); },
  leaves(g, s = 1) { for (let i = 0; i < 6; i++) { const a = i * 1.1 + s * 3, r = (i ? .18 : 0) * s, l = ico(g, (.2 - i * .015) * s, ['#ff9a3c', '#e5543b', '#ffc23e'][i % 3], Math.cos(a) * r, .06 * s, Math.sin(a) * r); l.scale.y = .45; } },
  pumpkin(g, s = 1) { for (const [x, z, r] of [[0, 0, .28], [.32, .14, .17]]) { const p = ico(g, r * s, '#ff9a2c', x * s, r * .8 * s, z * s); p.scale.y = .78; cyl(g, .025 * s, .04 * s, .12 * s, '#5fa646', x * s, r * 1.45 * s, z * s, 5); } },
  jack(g, s = 1) { const p = put(g, G('jk', () => new THREE.SphereGeometry(.32, 9, 6)), '#ff8a1c', 0, .26 * s, 0); p.scale.set(s, .8 * s, s);
    cyl(g, .03 * s, .045 * s, .14 * s, '#5fa646', 0, .56 * s, 0, 5);
    for (const x of [-.11, .11]) { const e = cone(g, .06 * s, .08 * s, '#ffe066', x * s, .33 * s, .29 * s, 3); e.rotation.x = Math.PI / 2; e.rotation.y = Math.PI; } // a friendly carved face, lit from inside
    const m = put(g, G('jm', () => new THREE.BoxGeometry(.2, .05, .04)), '#ffe066', 0, .2 * s, .3 * s); m.scale.setScalar(s); },
  spooktree(g, s = 1) { cyl(g, .08 * s, .13 * s, 1 * s, '#5b4636', 0, .5 * s);
    for (const [y, a, l] of [[.7, .6, .45], [.85, -.7, .4], [.55, 2.4, .35], [.95, 3.6, .3]]) { const b = cyl(g, .025 * s, .045 * s, l * s, '#5b4636', Math.cos(a) * l * .4 * s, y * s, Math.sin(a) * l * .4 * s, 4); b.rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); }
    ico(g, .07 * s, '#ff9a2c', .2 * s, .8 * s, .1 * s); },
  candles(g, s = 1) { for (const [x, z, h] of [[0, 0, .3], [.14, .1, .2], [-.12, .12, .24]]) { cyl(g, .045 * s, .045 * s, h * s, '#fff4e2', x * s, h / 2 * s, z * s, 6); ico(g, .04 * s, '#ffc93c', x * s, (h + .05) * s, z * s).scale.y = 1.6; } },
};

// ---------- the looks ----------
// grass/patch/earth/rock: island colours; petals: flower colours (n: share of the flowers kept); kinds: rim props
// (PROPS names from scenery3d.js or SP functions); air: petals() colours and amount.
export const LOOK = {
  winter: { grass: SNOW, patch: SNOW2, earth: '#b99a86', rock: '#7d7a8c', petals: ['#ffffff', '#e8f4ff', '#cfe6ff'], n: .3,
    kinds: [SP.snowpine, SP.snowbush, SP.snowpine, SP.snowrock, SP.snowman, SP.snowpine, SP.gifts, SP.snowbush, SP.snowpine, SP.snowrock],
    air: { colors: ['#ffffff', '#f2f8ff', '#e3eef9'], more: 2.2, size: .07, snow: true }, icicles: true },
  spring: { grass: '#9ad46a', patch: '#8cc95c', petals: ['#ffc1dc', '#ffffff', '#fff1a8', '#d9c8ff', '#ff9fd0'], n: 1.2,
    kinds: [SP.blossom, 'bush', SP.tulips, 'tree', SP.blossom, 'shroom', SP.tulips, SP.blossom, 'flowers', 'bush'],
    air: { colors: ['#ffc1dc', '#ffd9ea', '#ffffff', '#ffb0cf'] } },
  summer: { grass: '#8bca60', patch: '#7fbf56', petals: ['#ffffff', '#ffd0e4', '#fff1a8', '#d9c8ff'], n: 1,
    kinds: ['tree', 'bush', SP.sunflower, 'pine', 'rock', 'bush', 'tree', SP.sunflower, 'flowers', 'pine'],
    air: { colors: ['#ffc1dc', '#ffffff', '#a8e08a', '#ffd9ea', '#ffe9a8', '#c9f0a8'] } },
  autumn: { grass: '#a3b45a', patch: '#c2a24c', earth: '#b97f52', petals: ['#ff9a3c', '#e5543b', '#ffc23e'], n: .7,
    kinds: [SP.autumntree, SP.leaves, 'pine', SP.autumntree, SP.pumpkin, 'shroom', SP.autumntree, 'rock', SP.leaves, SP.autumntree],
    air: { colors: ['#ff9a3c', '#e5543b', '#ffc23e', '#d9653a'], size: .12 } },
  halloween: { grass: '#97a858', patch: '#ae8f48', earth: '#a8744e', rock: '#6f6a7c', petals: ['#ff9a3c', '#b48ae0', '#ffc23e'], n: .6,
    kinds: [SP.autumntree, SP.jack, SP.spooktree, SP.pumpkin, SP.autumntree, SP.candles, SP.jack, 'shroom', SP.spooktree, SP.leaves],
    air: { colors: ['#ff9a3c', '#e5543b', '#ffc23e', '#9b7bff'], size: .12 } },
};
export const lookOf = season => LOOK[season] || null;

// Season-only bits that hang off the island itself: icicles under the snowy rim in winter.
// edge: points [x, z] round the lawn's outline; under: the y of the lawn's underside.
export function trim(root, season, edge, under, seed = 1) {
  if (!LOOK[season]?.icicles || !edge.length) return;
  const g = new THREE.Group();
  edge.forEach(([x, z], i) => { const h = .18 + ((i * 7 + seed * 3) % 5) * .07, c = cone(g, .05 + (i % 3) * .015, h, i % 2 ? '#dff2ff' : '#ffffff', x, under - h / 2 + .02, z, 5); c.rotation.x = Math.PI; });
  root.add(g);
}

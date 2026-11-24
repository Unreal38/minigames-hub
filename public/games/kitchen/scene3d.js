// Cozy Kitchen Rush 3D view (three.js): a little open-air kitchen on a floating sky island. Purely visual:
// the server owns every counter, pot and order; this draws them, moves the avatars (your own one straight away,
// everyone else smoothly towards where the server last saw them) and reports screen spots for the HUD.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { toonify, toonMat, skyDome, clouds as cloudSea, island, birds, petals, createFx, shaker, disposeToon, STAR, DOT, HEART, nightScene } from '../../scenery3d.js';
import { kitchen, CRATES, T } from './rules.js';

const SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff', AV = .5, TOP = .62, BASE = .12; // the kitchen floor sits BASE above the lawn
const FOOD = { tomato: '#e5543b', lettuce: '#7ccc5c', mushroom: '#d9b48a', bun: '#e8a95b', patty: '#f08f9a', cooked: '#8a4b2a', burnt: '#2e2320' };
const SOUP = { tomato: '#e8603f', mushroom: '#b9a3ea', burnt: '#3a2a22' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const mats = new Map();
const M = c => { let m = mats.get(c); if (!m) mats.set(c, m = new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true })); return m; };
const geos = new Map();
const Gm = (type, ...a) => { const k = type + a.join(); let g = geos.get(k); if (!g) geos.set(k, g = new THREE[type + 'Geometry'](...a)); return g; };
function put(p, geo, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; }
const box = (p, w, h, d, c, x, y, z, ry = 0) => put(p, Gm('Box', w, h, d), c, x, y + h / 2, z, 0, ry);

// ---------- food models ----------
// Each look is built once, merged and outlined, then cloned (sharing geometry and materials) wherever it shows.
const looks = new Map();
function slices(g, c, n, r, y) { for (let i = 0; i < n; i++) { const a = i / n * 6.28 + .4; put(g, Gm('Cylinder', r, r, .045, 7), c, Math.cos(a) * .09, y, Math.sin(a) * .09, (i % 2 - .5) * .3, 0, (i % 3 - 1) * .2); } }
function flakes(g, c, n, y) { for (let i = 0; i < n; i++) { const a = i / n * 6.28; put(g, Gm('Box', .12, .04, .09), i % 2 ? c : '#9ad77a', Math.cos(a) * .08, y + (i % 3) * .02, Math.sin(a) * .08, .3, a, .2); } }
function food(g, k, ch, ck, y = 0) {
  if (k === 'tomato') {
    if (ch) slices(g, FOOD.tomato, 4, .075, y + .03);
    else { put(g, Gm('Icosahedron', .15, 1), FOOD.tomato, 0, y + .14, 0).scale.y = .85; put(g, Gm('Cone', .06, .08, 5), '#4a9a45', 0, y + .28, 0, Math.PI); }
  } else if (k === 'lettuce') {
    if (ch) flakes(g, FOOD.lettuce, 7, y + .03);
    else { put(g, Gm('Icosahedron', .18, 0), FOOD.lettuce, 0, y + .15, 0).scale.y = .8; put(g, Gm('Icosahedron', .12, 0), '#a8e08a', .03, y + .24, .02); }
  } else if (k === 'mushroom') {
    if (ch) for (let i = 0; i < 4; i++) { const a = i * 1.6; put(g, Gm('Sphere', .07, 6, 3, 0, 6.3, 0, 1.6), '#a98be8', Math.cos(a) * .08, y + .02, Math.sin(a) * .08, Math.PI / 2, a, 0); }
    else { put(g, Gm('Cylinder', .05, .065, .14, 6), '#fff4e2', 0, y + .07, 0); put(g, Gm('Sphere', .16, 8, 4, 0, 6.3, 0, 1.6), '#a98be8', 0, y + .12, 0); for (let i = 0; i < 3; i++) put(g, Gm('Icosahedron', .035, 0), '#ffffff', Math.cos(i * 2.1) * .09, y + .22, Math.sin(i * 2.1) * .09); }
  } else if (k === 'bun') {
    put(g, Gm('Cylinder', .16, .15, .06, 9), FOOD.bun, 0, y + .03, 0);
    put(g, Gm('Sphere', .16, 9, 4, 0, 6.3, 0, 1.5), FOOD.bun, 0, y + .07, 0);
    for (let i = 0; i < 4; i++) put(g, Gm('Box', .025, .015, .015), '#fff4e2', Math.cos(i * 1.7) * .07, y + .2, Math.sin(i * 1.7) * .07);
  } else if (k === 'patty') {
    const c = ck >= T.pattyBurn ? FOOD.burnt : ck >= 1 ? FOOD.cooked : FOOD.patty;
    put(g, Gm('Cylinder', .16, .16, .07, 9), c, 0, y + .035, 0);
    if (ck < 1) for (let i = 0; i < 3; i++) put(g, Gm('Box', .09, .012, .025), '#ffe1dc', Math.cos(i * 2.2) * .06, y + .072, Math.sin(i * 2.2) * .06, 0, i * 1.1);
    else if (ck < T.pattyBurn) for (const dx of [-.06, 0, .06]) put(g, Gm('Box', .02, .012, .22), '#5e2f19', dx, y + .072, 0, 0, .5);
  }
}
function plateModel(g, has, soup) {
  put(g, Gm('Cylinder', .25, .2, .04, 14), '#ffffff', 0, .02, 0);
  put(g, Gm('Cylinder', .19, .19, .045, 14), '#eef2f6', 0, .025, 0);
  if (soup) {
    put(g, Gm('Cylinder', .17, .11, .14, 10), '#fff4e2', 0, .1, 0);
    put(g, Gm('Cylinder', .15, .15, .02, 10), SOUP[soup] || SOUP.burnt, 0, .165, 0);
    return;
  }
  const s = new Set(has);
  if (s.has('bun')) { // a burger built up in layers
    let y = .045;
    put(g, Gm('Cylinder', .16, .15, .06, 9), FOOD.bun, 0, y + .03, 0); y += .06;
    if (s.has('patty')) { put(g, Gm('Cylinder', .16, .16, .07, 9), FOOD.cooked, 0, y + .035, 0); y += .07; }
    if (s.has('lettuce')) { put(g, Gm('Cylinder', .18, .18, .025, 7), FOOD.lettuce, 0, y + .012, 0, 0, .3); y += .025; }
    if (s.has('tomato')) { put(g, Gm('Cylinder', .14, .14, .03, 8), FOOD.tomato, 0, y + .015, 0); y += .03; }
    if (s.has('patty') || s.size > 1) put(g, Gm('Sphere', .16, 9, 4, 0, 6.3, 0, 1.5), FOOD.bun, 0, y, 0);
  } else {
    if (s.has('lettuce')) flakes(g, FOOD.lettuce, 8, .05);
    if (s.has('tomato')) slices(g, FOOD.tomato, 3, .065, .09);
    if (s.has('patty')) put(g, Gm('Cylinder', .14, .14, .07, 9), FOOD.cooked, 0, .08, 0);
  }
}
const lookKey = it => it.k === 'plate' ? 'p:' + [...it.has].sort().join('+') + ':' + (it.soup || '') : it.k + ':' + (it.ch ? 1 : 0) + ':' + (it.k === 'patty' ? (it.ck >= T.pattyBurn ? 2 : it.ck >= 1 ? 1 : 0) : 0);
function look(it) {
  const key = lookKey(it);
  let L = looks.get(key);
  if (!L) {
    L = new THREE.Group();
    if (it.k === 'plate') plateModel(L, it.has, it.soup); else food(L, it.k, it.ch, it.ck);
    bake(L); toonify(L, .016);
    L.traverse(m => { if (m.isMesh) { m.castShadow = true; m.userData.keep = true; } });
    looks.set(key, L);
  }
  const g = L.clone(); g.userData.key = key;
  return g;
}

export function createScene(canvas, { mapId, step, onFrame } = {}) {
  const K = kitchen(mapId), OX = K.cols / 2, OZ = K.rows / 2;
  const W = (x, z, y = 0, v = new THREE.Vector3()) => v.set(x - OX, y + BASE, z - OZ);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 170);
  const camera = new THREE.PerspectiveCamera(34, 1, .3, 400);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.55); sun.position.set(-6, 16, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 45 });
  sun.shadow.bias = -.0008; sun.shadow.normalBias = .03; scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = cloudSea({ min: 16, max: 85, below: -10 }); scene.add(cloudRing);
  nightScene(scene);
  const flyBirds = birds(scene, 22, 7, 4, 1.1), blow = petals(scene, 22, 4, { n: 8, size: .1 });
  const fx = createFx(scene), shake = shaker(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- the kitchen: everything that never moves, merged into a couple of meshes ----------
  const land = island(K.cols + .6, K.rows + 1.4, { rim: 2.2, seed: K.id === 'split' ? 7 : 3, props: 14, flowers: 40, size: 1.1 });
  land.position.set(0, -.02, .3); scene.add(land);
  const room = new THREE.Group(); let signMesh = null;
  for (let r = 0; r < K.rows; r++) for (let c = 0; c < K.cols; c++) {
    const ch = K.t[r][c], x = c + .5 - OX, z = r + .5 - OZ;
    if (ch === '.') { box(room, 1, .06, 1, (r + c) % 2 ? '#fff4e2' : '#f2c9a0', x, 0, z); continue; }
    box(room, .96, .06, .96, '#c99763', x, 0, z);
    if (ch === 'X') { // the bin
      put(room, Gm('Cylinder', .3, .26, .6, 10), '#8fa3b0', x, .3, z); put(room, Gm('Cylinder', .33, .33, .06, 10), '#6f8290', x, .62, z);
      box(room, .14, .05, .06, '#6f8290', x, .65, z); continue;
    }
    const front = ['#d9b98c', '#cfae80'][(r + c) % 2];
    box(room, .98, TOP - .08, .98, front, x, .02, z);
    box(room, 1.02, .08, 1.02, ch === 'S' || ch === 'F' ? '#6f6a78' : ch === 'C' ? '#c99763' : ch === 'W' ? '#fff8ec' : ['#f6e2c4', '#f2dcbb'][(r + c) % 2], x, TOP - .08, z);
    if (CRATES[ch]) { // a wooden crate with the ingredient peeking out
      box(room, .74, .22, .74, '#b07a4f', x, TOP, z); box(room, .78, .04, .78, '#8a5a3c', x, TOP + .2, z);
      const g = new THREE.Group(); food(g, CRATES[ch], 0, 0); for (const [dx, dz] of [[-.17, -.14], [.16, -.1], [0, .15]]) { const k = g.clone(); k.position.set(x + dx * 1.1, TOP + .14, z + dz * 1.1); k.scale.setScalar(1.05); room.add(k); }
    } else if (ch === 'C') {
      box(room, .7, .05, .54, '#e8c48f', x, TOP, z); box(room, .06, .02, .3, '#d9dde3', x + .28, TOP + .05, z, .3); box(room, .05, .03, .12, '#5b4636', x + .31, TOP + .05, z - .2, .3);
    } else if (ch === 'S' || ch === 'F') {
      put(room, Gm('Torus', .22, .025, 4, 12), '#3f3a46', x, TOP + .01, z, Math.PI / 2);
      if (ch === 'S') { put(room, Gm('Cylinder', .3, .26, .34, 12), '#9aa4b0', x, TOP + .17, z); put(room, Gm('Torus', .3, .03, 4, 12), '#7d8794', x, TOP + .34, z, Math.PI / 2); box(room, .5, .04, .06, '#5b6470', x, TOP + .28, z); }
      else { put(room, Gm('Cylinder', .3, .26, .07, 12), '#6a6672', x, TOP + .05, z); box(room, .07, .04, .36, '#5b4636', x, TOP + .07, z + .42); }
    } else if (ch === 'D') {
      for (let i = 0; i < 4; i++) put(room, Gm('Cylinder', .25, .2, .04, 12), '#ffffff', x, TOP + .02 + i * .05, z);
    } else if (ch === 'W') { // serving hatch with a bell and a little awning post
      put(room, Gm('Cylinder', .1, .12, .03, 8), '#d9a43b', x - .25, TOP + .015, z - .25); put(room, Gm('Sphere', .09, 8, 4, 0, 6.3, 0, 1.6), '#ffc93c', x - .25, TOP + .03, z - .25);
      box(room, .06, 1.1, .06, '#8a5a3c', x + .4, TOP, z + .42); box(room, .06, 1.1, .06, '#8a5a3c', x + .4, TOP, z - .42);
    }
  }
  // the back wall with a striped awning, and a sign
  const bw = K.cols + .4;
  box(room, bw, 1.5, .25, '#fff4e2', 0, 0, -OZ - .2); box(room, bw + .1, .12, .3, '#c99763', 0, 1.5, -OZ - .2);
  for (let i = 0; i < Math.ceil(bw / .8); i++) { const x = -bw / 2 + .4 + i * .8; const a = put(room, Gm('Box', .8, .06, .55), i % 2 ? '#ffffff' : '#ff7a59', x, 1.62, -OZ - .1); a.rotation.x = .3; }
  box(room, 2.6, .55, .1, '#8a5a3c', 0, 1.95, -OZ - .25); box(room, 2.4, .42, .06, '#ffd27a', 0, 2.01, -OZ - .19);
  for (const sx of [-1, 1]) { box(room, .5, .5, .06, '#bfe6fb', sx * (bw / 2 - 1.4), .55, -OZ - .07); box(room, .6, .06, .1, '#8a5a3c', sx * (bw / 2 - 1.4), 1.07, -OZ - .05); }
  bake(room); room.traverse(m => { if (m.isMesh) { m.receiveShadow = true; m.castShadow = true; } });
  toonify(room, .022); room.position.y = BASE; scene.add(room);
  { // the sign over the kitchen
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d');
    g.fillStyle = '#ffd27a'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#5a3a2e'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 54px Rubik, system-ui, sans-serif'; g.fillText(K.id === 'split' ? 'PASS-THROUGH' : 'SUNNY DINER', 256, 52);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.36, .42), new THREE.MeshBasicMaterial({ map: tx })); m.position.set(0, 2.22 + BASE, -OZ - .155); scene.add(m); signMesh = m;
  }

  // ---------- what changes: food on counters, soup in pots ----------
  const onCell = new Map(); // key -> { g, key }
  const pots = new Map();   // key -> soup surface mesh
  for (const x of K.cells) if (x.k === 'S') {
    const m = new THREE.Mesh(Gm('Cylinder', .26, .26, .02, 12), new THREE.MeshToonMaterial({ color: SOUP.tomato })); m.visible = false;
    W(x.c + .5, x.r + .5, TOP + .1, m.position); scene.add(m); pots.set(x.key, m);
  }
  const ring = new THREE.Group(); // the counter you are reaching for
  { const mt = new THREE.MeshBasicMaterial({ color: '#fff7c2', transparent: true, opacity: .9, depthWrite: false });
    for (const [w, d, x, z] of [[1.06, .07, 0, .5], [1.06, .07, 0, -.5], [.07, 1.06, .5, 0], [.07, 1.06, -.5, 0]]) { const m = new THREE.Mesh(Gm('Box', w, .03, d), mt); m.position.set(x, 0, z); m.renderOrder = 3; ring.add(m); }
    ring.visible = false; scene.add(ring); }

  let S = null, seats = [], me = -1, avKey = '', people = [];
  const arrow = youArrow(); arrow.scale.setScalar(.55); arrow.visible = false; scene.add(arrow);

  function setSeats(list, mine) {
    seats = list; me = mine;
    const key = list.map(s => s.color + (s.av || []).join('')).join('|');
    if (key === avKey) return; avKey = key;
    for (const p of people) { scene.remove(p.g); disposeAvatar(p.av); if (p.held) p.hand.remove(p.held); }
    people = list.map((s, i) => {
      const g = new THREE.Group(), av = avatar3d(s.color, s.av, { pose: 'stand' }); const wrap = new THREE.Group(); wrap.scale.setScalar(AV); wrap.position.y = .76 * AV; wrap.add(av); g.add(wrap); /* sized by a wrapper (animateAvatar owns the avatar's own scale), feet on the floor */
      const hand = new THREE.Group(); hand.position.set(0, TOP - .04, .5); hand.scale.setScalar(1.35); g.add(hand);
      const old = people[i];
      if (old) g.position.copy(old.g.position); else if (S?.pl[i]) W(S.pl[i].x, S.pl[i].z, 0, g.position);
      scene.add(g);
      return { g, av, hand, held: null, heldKey: '', f: old?.f ?? Math.PI, walk: 0, ph: 0, seed: i * 1.7, tag: { x: 0, y: 0, show: false }, hop: 0, chop: false, last: g.position.clone() };
    });
  }

  function setState(s) {
    S = s;
    // food sitting on counters and in pans
    const seen = new Set();
    for (const [key, c] of Object.entries(s.cells)) {
      if (!c.item) continue;
      seen.add(key);
      const lk = lookKey(c.item), cur = onCell.get(key);
      if (cur && cur.key === lk) continue;
      if (cur) scene.remove(cur.g);
      const [cx, cr] = key.split(',').map(Number), g = look(c.item), k = K.t[cr][cx];
      W(cx + .5, cr + .5, TOP + (k === 'F' ? .06 : k === 'C' ? .05 : 0), g.position);
      g.scale.setScalar(k === 'F' ? 1.15 : 1.3);
      scene.add(g); onCell.set(key, { g, key: lk });
      if (!cur && !reduced) fx.puff(g.position, { n: 5, size: .18, speed: .9, life: .35 });
    }
    for (const [key, cur] of onCell) if (!seen.has(key)) { scene.remove(cur.g); onCell.delete(key); }
    for (const [key, m] of pots) {
      const p = s.cells[key]?.pot;
      m.visible = !!p;
      if (p) { m.position.y = TOP + .06 + p.n * .07; m.material.color.set(p.cook >= T.soupBurn ? SOUP.burnt : SOUP[p.kind] || SOUP.tomato); if (p.cook >= 1 && p.cook < T.soupBurn) m.material.color.offsetHSL(0, .05, .06); }
    }
    // what everyone carries
    people.forEach((p, i) => {
      const h = s.pl[i]?.hold, hk = h ? lookKey(h) : '';
      if (hk === p.heldKey) return;
      if (p.held) p.hand.remove(p.held);
      p.held = h ? look(h) : null; p.heldKey = hk;
      if (p.held) p.hand.add(p.held);
    });
  }

  // little moments the client asks for
  const spot = key => { const [c, r] = key.split(',').map(Number); return W(c + .5, r + .5, TOP + .2); };
  function cue(e) {
    if (reduced) return;
    if (e.t === 'serve') {
      const p = people[e.s]; if (p) p.hop = 1;
      const w = K.cells.find(x => x.k === 'W'); const at = w ? spot(w.key) : W(OX, OZ, 1);
      fx.burst(at, { n: 22, colors: ['#ffd84a', '#ff9fb8', '#7ed3b2'], shape: [STAR, HEART], speed: 3, up: 4 });
    } else if (e.t === 'chopped' && e.key) fx.burst(spot(e.key), { n: 8, colors: '#ffffff', shape: DOT, speed: 1.6, up: 2, size: .14, life: .5 });
    else if (e.t === 'ready' && e.key) fx.sparkle(spot(e.key), { n: 10, r: .4 });
    else if (e.t === 'burn' && e.key) { fx.puff(spot(e.key), { n: 14, color: ['#5b5560', '#7d7783'], size: .4, speed: .8, life: 1.2 }); shake.kick(.25); }
    else if (e.t === 'bin') { const p = people[e.s]; if (p) fx.puff(p.g.position.clone().setY(.5), { n: 6, color: '#cfc7c0', size: .2 }); }
    else if (e.t === 'miss') shake.kick(.4);
    else if (e.t === 'end') fx.confetti(W(OX, OZ, 0), { n: 120, w: 10, h: 5, s: 'me' }); // a team win: each viewer's own effect
  }

  // ---------- frame loop ----------
  let Wd = 0, Hd = 0, T0 = 0, az = 0, dist = 20;
  const look_ = new THREE.Vector3(), proj = new THREE.Vector3(), tmp = new THREE.Vector3();
  const crates = K.cells.filter(c => CRATES[c.k]);
  const info = { tags: [], bars: [], labels: [], fwd: [0, -1], right: [1, 0] };
  const EL = .9;
  function fit() {
    // portrait screens turn the kitchen a quarter so its long side runs up the screen
    az = Wd < Hd * .85 ? -Math.PI / 2 : 0;
    camera.aspect = Wd / Math.max(1, Hd); camera.updateProjectionMatrix();
    const corners = [];
    for (const x of [-OX - .7, OX + .7]) for (const z of [-OZ - .5, OZ + .6]) for (const y of [0, 1.3]) corners.push(new THREE.Vector3(x, y, z));
    const top = Wd < 700 ? .6 : Wd < 900 ? .66 : .72, bot = Wd < 700 ? -.62 : -.9; // room for the orders up top and the buttons below
    let lo = 6, hi = 80;
    for (let i = 0; i < 22; i++) {
      dist = (lo + hi) / 2; place(0);
      camera.updateMatrixWorld();
      const ok = corners.every(c => { proj.copy(c).project(camera); return Math.abs(proj.x) < .96 && proj.y < top && proj.y > bot; });
      if (ok) hi = dist; else lo = dist;
    }
    dist = hi; place(0);
  }
  function place(sway) {
    const a = az + sway;
    look_.set(0, 0, .3);
    camera.position.set(look_.x + Math.sin(a) * Math.cos(EL) * dist, Math.sin(EL) * dist, look_.z + Math.cos(a) * Math.cos(EL) * dist);
    camera.lookAt(look_);
    // which way "up" and "right" on the screen go across the floor, for the controls
    info.fwd[0] = -Math.sin(az); info.fwd[1] = -Math.cos(az); info.right[0] = Math.cos(az); info.right[1] = -Math.sin(az);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === Wd && h === Hd) return;
    Wd = w; Hd = h; renderer.setSize(w, h, false); fit();
  }
  let targetKey = null;
  function setTarget(key) { targetKey = key; }

  function frame(dt) {
    resize(); T0 += dt;
    const local = step?.(dt);
    people.forEach((p, i) => {
      const sp = S?.pl[i]; if (!sp) return;
      let x, z, f;
      if (i === me && local) ({ x, z, f } = local);
      else { x = sp.x; z = sp.z; f = sp.f; }
      W(x, z, 0, tmp);
      const k = i === me && local ? 1 : Math.min(1, dt * 14);
      p.g.position.lerp(tmp, k);
      const moved = p.g.position.distanceTo(p.last) / Math.max(dt, 1e-3); p.last.copy(p.g.position);
      // turn smoothly the short way round
      let d = f - p.f; d = Math.atan2(Math.sin(d), Math.cos(d)); p.f += d * Math.min(1, dt * 14);
      p.g.rotation.y = p.f;
      p.walk += ((moved > .4 ? 1 : 0) - p.walk) * Math.min(1, dt * 10); p.ph += moved * dt * 5.2;
      p.hop = Math.max(0, p.hop - dt * 1.4);
      animateAvatar(p.av, T0, { seed: p.seed, hop: p.hop });
      walkAvatar(p.av, p.ph, p.walk);
      const u = p.av.userData;
      if (p.held) u.arms.forEach(a => { a.rotation.x = a.userData.rx - 1.25; }); // both hands out front, carrying
      else if (sp.chop) u.arms.forEach((a, j) => { a.rotation.x = a.userData.rx - .9 - (j ? Math.abs(Math.sin(T0 * 14)) * .5 : 0); });
      if (p.held) p.held.position.y = Math.sin(p.ph) * .015 * p.walk;
    });
    // the counter you would grab from
    if (targetKey && S?.ph === 'play') {
      const [c, r] = targetKey.split(',').map(Number);
      W(c + .5, r + .5, (K.t[r][c] === 'X' ? .68 : TOP) + .015, ring.position); ring.visible = true;
      const s = 1 + Math.sin(T0 * 6) * .03; ring.scale.set(s, 1, s);
    } else ring.visible = false;
    if (me >= 0 && people[me]) { arrow.visible = S?.ph === 'play'; arrow.position.copy(people[me].g.position); arrow.position.y += 2.9 * AV + .45; animateArrow(arrow, T0); } else arrow.visible = false;
    // steam from cooking pots
    if (!reduced && S && Math.random() < dt * 6) for (const [key, m] of pots) { const p = S.cells[key]?.pot; if (p?.n === 3 && p.cook < T.soupBurn && Math.random() < .5) fx.puff(m.position, { n: 2, color: '#ffffff', size: .22, speed: .25, life: .9 }); }
    cloudRing.rotation.y += dt * .006; flyBirds(T0); blow(T0);
    place(reduced ? 0 : Math.sin(T0 * .15) * .012);
    shake.apply(camera, dt);
    fx.update(dt, camera, Hd);
    renderer.render(scene, camera);
    // screen spots for name tags and progress bars
    people.forEach((p, i) => {
      proj.copy(p.g.position); proj.y += 2.9 * AV; proj.project(camera);
      const t = p.tag; t.show = proj.z < 1; t.x = (proj.x + 1) / 2 * Wd; t.y = (1 - proj.y) / 2 * Hd; info.tags[i] = t;
    });
    info.tags.length = people.length;
    // sticker labels: one over every crate, one over every loose bit of food (on a counter, in a pan or carried)
    info.labels.length = 0;
    const label = (v, it, crate) => { v.project(camera); info.labels.push({ it, crate, x: (v.x + 1) / 2 * Wd, y: (1 - v.y) / 2 * Hd }); };
    for (const c of crates) label(W(c.c + .5, c.r + .5, TOP + .75, proj), { k: CRATES[c.k] }, true);
    if (S) {
      for (const [key, c] of Object.entries(S.cells)) if (c.item && (c.item.k !== 'plate' || c.item.has.length || c.item.soup)) { const [cx, cr] = key.split(',').map(Number); label(W(cx + .5, cr + .5, TOP + .42, proj), c.item, false); }
      for (const [key, c] of Object.entries(S.cells)) if (c.pot) { const [cx, cr] = key.split(',').map(Number); label(W(cx + .5, cr + .5, TOP + .55, proj), c.pot.cook >= T.soupBurn ? { k: 'plate', has: [], soup: 'burnt' } : c.pot.cook >= 1 ? { k: 'plate', has: [], soup: c.pot.kind } : { k: 'plate', has: Array(c.pot.n).fill(c.pot.kind), soup: null }, false); }
      people.forEach((p, i) => { const h = S.pl[i]?.hold; if (h && (h.k !== 'plate' || h.has.length || h.soup)) { p.hand.getWorldPosition(proj); proj.y += .42; label(proj, h, false); } });
    }
    info.bars.length = 0;
    if (S) for (const [key, c] of Object.entries(S.cells)) {
      let p = -1, kind = '';
      if (c.item?.k === 'patty' && K.t[+key.split(',')[1]][+key.split(',')[0]] === 'F') { const ck = c.item.ck; if (ck < 1) { p = ck; kind = 'cook'; } else if (ck < T.pattyBurn) { p = (ck - 1) / (T.pattyBurn - 1); kind = 'hot'; } }
      else if (c.item && c.item.cp > 0 && !c.item.ch) { p = c.item.cp; kind = 'chop'; }
      else if (c.pot) { if (c.pot.n < 3) { p = c.pot.n / 3; kind = 'fill'; } else if (c.pot.cook < 1) { p = c.pot.cook; kind = 'cook'; } else if (c.pot.cook < T.soupBurn) { p = (c.pot.cook - 1) / (T.soupBurn - 1); kind = 'hot'; } else { p = 1; kind = 'burnt'; } }
      if (p < 0) continue;
      const [cx, cr] = key.split(',').map(Number);
      W(cx + .5, cr + .5, TOP + .95, proj).project(camera);
      info.bars.push({ key, kind, p: clamp(p, 0, 1), x: (proj.x + 1) / 2 * Wd, y: (1 - proj.y) / 2 * Hd });
    }
    onFrame?.(info);
  }
  const frames = frameLoop(frame, { onSlow: () => res.lower() });

  return {
    setSeats, setState, setTarget, cue, controls: () => info,
    dispose() {
      frames.stop();
      for (const p of people) disposeAvatar(p.av);
      disposeArrow(arrow);
      disposeToon(room); disposeToon(land);
      for (const m of pots.values()) m.material.dispose();
      signMesh.material.map.dispose(); signMesh.material.dispose(); signMesh.geometry.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

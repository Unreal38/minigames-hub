// Friendship Trail's 3D island (three.js): the big trail loop of stepping stones with its four forks, a pond and a
// stream with plank bridges, the hill with a Pet Farm barn, the forest, the beach and the cliff with its lighthouse.
// Everyone's own avatar walks the trail hop by hop with their herd of Pet Farm pets parading behind in their
// footsteps; wild pets wait beside stones. The island dresses for the season and the real sky and weather.
// Purely visual: the page (client.js) says where everyone is and what just happened.
//
// Cost rules: the whole island (stones, props, hills, bridges, Pet Farm decorations) is merged into a few meshes with
// one outline; the trees are instanced (a solid set and a see-through set, so a tree in front of the player in focus
// swaps to the see-through one); avatars and pets get soft blob shadows, no shadow maps.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { skyDome, clouds, nightScene, birds, petals, createFx, toonMat, toonify, mergeStatic, flat, put, shell, PROPS, hash, seasonLookNow, STAR, DOT, HEART } from '../../scenery3d.js';
import { diceKit, SIDE } from '../../dice3d.js';
import { lookOf, SP } from '../../season3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { itemModel } from '../farm/models.js';
import { frameLoop, autoResolution, AA, gfx } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { NODES, N, EL_COL } from './rules.js';

const K = .42;                 // avatars are drawn at this size, on a wrapper (the standing avatar sits .76 up inside it)
const HOP = 320;               // ms per stone, as the server counts it (MS.hop)
const SR = .62, SY = .18;      // stone radius and the height of a stone's top
const ISLE = { x: 1.5, z: -1, rx: 23, rz: 16.5 };
const POND = { x: -1, z: 0, rx: 4.2, rz: 3 };
const STREAM_Z = .95;
const HILL = { x: 3.8, z: -5.6, r: 2.7 };
// the kinds of stone: top colour, and whether the whole-map view labels it
const STONE = {
  treat: '#ffd36b', picnic: '#ff9fc8', bramble: '#9b6b4a', stall: '#ffffff', nest: '#fff1c4', bench: '#b994f0',
  well: '#7cc6ff', spring: '#9fe6f0', den: '#8a7aa8',
};
export const SPECIAL = new Set(['stall', 'nest', 'bench', 'well', 'spring', 'den', 'picnic']);
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); return (a < 0 ? a + Math.PI * 2 : a) - Math.PI; };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createScene(canvas, { onFrame } = {}) {
  const level = gfx(), few = level === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .3, 700);
  scene.background = new THREE.Color('#c9ecff'); scene.fog = new THREE.Fog('#c9ecff', 90, 300);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.45); key.position.set(-10, 22, 12); scene.add(key);
  skyDome(scene, '#4fa8f0', '#c9ecff'); const cloudRing = clouds({ near: 44, far: 14, below: -12, min: 34, max: 130 }); scene.add(cloudRing);
  const fly = birds(scene, 40, 12, 4, 1.4), season = seasonLookNow(), SL = lookOf(season) || lookOf('summer');
  const drift = petals(scene, 40, 7, { n: few ? 10 : 22, size: .12 });
  const fx = createFx(scene, { max: few ? 400 : 800 });
  nightScene(scene, { wx: { size: 46 } });
  const snowy = season === 'winter';

  // ---------- the island ----------
  const world = new THREE.Group();
  const M = c => flat(c);
  const box = (p, w, h, d, c, x, y, z) => put(p, new THREE.BoxGeometry(w, h, d), M(c), x, y, z);
  const cyl = (p, a, b, h, c, x, y, z, n = 8) => put(p, new THREE.CylinderGeometry(a, b, h, n), M(c), x, y, z);
  const inIsle = (x, z, k = 1) => ((x - ISLE.x) / ISLE.rx) ** 2 + ((z - ISLE.z) / ISLE.rz) ** 2 < k;
  // the lawn: an oval slab with an earth band and a rocky point underneath
  const lawn = cyl(world, 1, 1, .5, SL.grass, ISLE.x, -.25, ISLE.z, 48); lawn.scale.set(ISLE.rx, 1, ISLE.rz);
  const band = cyl(world, .98, .72, 1.8, SL.earth || '#c98a5a', ISLE.x, -1.4, ISLE.z, 24); band.scale.set(ISLE.rx, 1, ISLE.rz);
  const point = put(world, new THREE.ConeGeometry(.6, 9, 10), M(SL.rock || '#857a72'), ISLE.x, -6.6, ISLE.z); point.rotation.x = Math.PI; point.scale.set(ISLE.rx, 1, ISLE.rz);
  for (let i = 0; i < 14; i++) { const a = hash(i, 3) * 6.283, k = .3 + hash(i, 4) * .4; const r = put(world, new THREE.IcosahedronGeometry(.5 + hash(i, 5) * .8, 0), M(SL.rock || '#857a72'), ISLE.x + Math.cos(a) * ISLE.rx * k, -4 - hash(i, 6) * 5, ISLE.z + Math.sin(a) * ISLE.rz * k); r.scale.y = 1.4; }
  // darker lawn patches
  for (let i = 0; i < 26; i++) { const x = ISLE.x + (hash(i, 11) - .5) * ISLE.rx * 1.7, z = ISLE.z + (hash(i, 12) - .5) * ISLE.rz * 1.7; if (!inIsle(x, z, .8)) continue;
    const m = put(world, new THREE.CircleGeometry(.8 + hash(i, 13) * 1.2, 12), M(SL.patch), x, .005, z); m.rotation.x = -Math.PI / 2; }
  // the beach along the back, where the beach detour runs
  const sand = cyl(world, 1, 1, .06, snowy ? '#f3efe6' : '#f3dc9a', 0, .02, -12.6, 24); sand.scale.set(10, 1, 3.4);
  // the pond, the stream to the east coast, lily pads (ice in winter)
  const WATER = snowy ? '#cfeeff' : '#5cc4f0';
  const pond = cyl(world, 1, 1, .06, WATER, POND.x, .03, POND.z, 28); pond.scale.set(POND.rx, 1, POND.rz);
  const shore = cyl(world, 1, 1, .04, snowy ? '#e3eef9' : '#c9b07a', POND.x, .015, POND.z, 28); shore.scale.set(POND.rx + .35, 1, POND.rz + .35);
  const sLen = ISLE.x + ISLE.rx * .99 - (POND.x + POND.rx - .4);
  box(world, sLen, .06, .62, WATER, POND.x + POND.rx - .4 + sLen / 2, .03, STREAM_Z);
  box(world, sLen, .04, 1, snowy ? '#e3eef9' : '#c9b07a', POND.x + POND.rx - .4 + sLen / 2, .015, STREAM_Z);
  if (!snowy) for (let i = 0; i < 7; i++) cyl(world, .3, .3, .04, '#55b04a', POND.x + Math.cos(i * 1.1) * POND.rx * .62, .07, POND.z + Math.sin(i * 1.1) * POND.rz * .62, 8);
  // the hill with a Pet Farm barn and a fence round its paddock
  const hill = put(world, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(SL.patch), HILL.x, 0, HILL.z); hill.scale.set(HILL.r, 1.3, HILL.r * .85);
  const props = []; // Pet Farm decorations, placed then merged with the rest
  const deco = (type, x, z, h, ry = 0, y = 0) => {
    let m; try { m = itemModel(type, false, true); } catch { return null; }
    const b = new THREE.Box3().setFromObject(m), s = h / Math.max(.01, b.max.y - b.min.y);
    m.scale.setScalar(s); m.position.set(x, y - b.min.y * s, z); m.rotation.y = ry; world.add(m); props.push(m); return m;
  };
  deco('barn', HILL.x, HILL.z - .2, 2.1, .3, 1.2);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(wrapA(a - Math.PI / 2)) < .35) continue; box(world, .1, .5, .1, '#c98a52', HILL.x + Math.cos(a) * (HILL.r + .5), .25, HILL.z + Math.sin(a) * (HILL.r * .85 + .5)); }
  deco('haybale', HILL.x - 2.2, HILL.z + 2.3, .55, .4); deco('windmill', -3.5, -6.8, 2.6, .5);
  // the cliff on the east coast, with a lighthouse
  for (let i = 0; i < 10; i++) { const a = -.75 + i * .17, x = ISLE.x + Math.cos(a) * ISLE.rx * .97, z = ISLE.z + Math.sin(a) * ISLE.rz * .97; const r = put(world, new THREE.DodecahedronGeometry(.7 + (i % 3) * .35, 0), M(i % 2 ? '#a9a39b' : '#958e86'), x, .35, z); r.rotation.set(i, i * 2, 0); }
  deco('lighthouse', 21.6, -3.4, 4.2, -.6);
  // the beach: palms and a picnic blanket
  const palm = (x, z) => { const t = new THREE.Group(); t.position.set(x, 0, z); const tr = cyl(t, .1, .16, 1.8, '#c98a52', 0, .9, 0, 6); tr.rotation.z = .12;
    for (let k = 0; k < 5; k++) { const lf = box(t, 1.1, .06, .32, snowy ? '#e8f2f6' : '#55b04a', Math.cos(k * 1.26) * .45, 1.78, Math.sin(k * 1.26) * .45); lf.rotation.y = -k * 1.26; lf.rotation.z = -.3; } world.add(t); };
  for (const [x, z] of [[-8.5, -13.6], [-5.5, -14.5], [3.8, -14.6], [8.8, -13.2], [6.2, -15]]) palm(x, z);
  // little islets floating offshore
  for (let i = 0; i < 9; i++) { const a = i * .72 + .3, r = 1.45 + (i % 3) * .2, x = ISLE.x + Math.cos(a) * ISLE.rx * r, z = ISLE.z + Math.sin(a) * ISLE.rz * r, y = -2 - (i % 4) * 1.2;
    cyl(world, 1.4 + (i % 2), 1.1 + (i % 2), .5, SL.grass, x, y, z, 9); put(world, new THREE.ConeGeometry(1.1 + (i % 2), 1.8, 7), M(SL.rock || '#857a72'), x, y - 1.15, z).rotation.x = Math.PI;
    const t = new THREE.Group(); (snowy ? SP.snowpine : PROPS.tree)(t, 1.1); t.position.set(x, y + .25, z); world.add(t); }

  // ---------- the trail: stones, the dirt between them, bridges and signposts ----------
  const P = NODES.map(n => new THREE.Vector3(n.x, SY, n.z));
  const DIRT = snowy ? '#d8e6ee' : '#d9b77c', DIRT_EDGE = snowy ? '#b9c9d6' : '#a9814f';
  NODES.forEach((n, i) => {
    const kind = n.kind, top = STONE[kind] || '#ffd36b';
    const g = new THREE.Group(); g.position.set(n.x, 0, n.z); g.rotation.y = i * .7; world.add(g);
    // a chunky grey base, a bright cream lip and the coloured top, so every stone you can stand on pops off the lawn
    cyl(g, SR + .1, SR + .2, .16, snowy ? '#9aa6b6' : '#8d867e', 0, .06, 0, 9);
    cyl(g, SR + .1, SR + .1, .05, '#fff6e2', 0, .135, 0, 9);
    cyl(g, SR, SR + .03, .08, kind === 'bramble' && snowy ? '#bfe6ff' : top, 0, .14, 0, 9);
    if (kind === 'treat') for (let k = 0; k < 3; k++) cyl(g, .1, .1, .05, '#c98a52', Math.cos(k * 2.1) * .25, .2, Math.sin(k * 2.1) * .25, 8);
    if (kind === 'bramble') for (let k = 0; k < 4; k++) { const t = put(g, new THREE.TetrahedronGeometry(.17), M(snowy ? '#e8f6ff' : '#5d8a3a'), Math.cos(k * 1.6) * .32, .25, Math.sin(k * 1.6) * .32); t.rotation.set(k, k * 2, 0); }
    if (kind === 'picnic') { box(g, .62, .03, .62, '#ffffff', 0, .195, 0); for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) box(g, .3, .035, .3, '#ff6f9a', -.15 + a * .3, .2, -.15 + b * .3).visible = (a + b) % 2 === 0; }
    // dirt dots to the next stones, and plank bridges over the stream
    for (const j of n.next) { const b = NODES[j];
      // a dirt path with a darker edge from stone to stone (cut where a bridge crosses the stream)
      { const dx = b.x - n.x, dz = b.z - n.z, l = Math.hypot(dx, dz), a = Math.atan2(dx, dz), cross = n.x > 3 && (n.z - STREAM_Z) * (b.z - STREAM_Z) < 0;
        const seg = (t0, t1) => { const len = (t1 - t0) * l; if (len < .05) return; const x = n.x + dx * (t0 + t1) / 2, z = n.z + dz * (t0 + t1) / 2;
          box(world, .74, .03, len, DIRT_EDGE, x, .02, z).rotation.y = a; box(world, .5, .035, len, DIRT, x, .03, z).rotation.y = a; };
        const e0 = (SR + .1) / l, e1 = 1 - e0;
        if (!cross) seg(e0, e1); else { const tc = (STREAM_Z - n.z) / dz, h = .85 / l; seg(e0, Math.max(e0, tc - h)); seg(Math.min(e1, tc + h), e1); } }
      if (n.x > 3 && (n.z - STREAM_Z) * (b.z - STREAM_Z) < 0) { const t = (STREAM_Z - n.z) / (b.z - n.z), x = lerp(n.x, b.x, t);
        const br = new THREE.Group(); br.position.set(x, .12, STREAM_Z); br.rotation.y = Math.atan2(b.x - n.x, b.z - n.z); world.add(br);
        for (let k = 0; k < 5; k++) box(br, .9, .07, .26, k % 2 ? '#b07a4a' : '#c98a52', 0, 0, -.6 + k * .3);
        for (const sx of [-.48, .48]) box(br, .06, .3, 1.5, '#8a5a32', sx, .15, 0); } }
  });
  // a Pet Farm prop beside every special stone, on the side away from the trail's middle
  const sideOf = i => { const n = NODES[i], prev = NODES.findIndex(m => m.next.includes(i)), a = NODES[prev >= 0 ? prev : i], b = NODES[n.next[0]];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; let ox = dz / l, oz = -dx / l;
    if ((n.x - ISLE.x) * ox + (n.z - ISLE.z) * oz < 0) { ox = -ox; oz = -oz; } return [ox, oz]; };
  const PROP = { stall: ['cart', 1], nest: ['nest', .8], bench: ['palbench', .8], well: ['well', 1.2], spring: ['hotspring', .6], den: ['treehouse', 1.6] };
  NODES.forEach((n, i) => { const pr = PROP[n.kind]; if (!pr) return; const [ox, oz] = sideOf(i), d = n.kind === 'den' ? 1.7 : 1.25;
    deco(pr[0], n.x + ox * d, n.z + oz * d, pr[1], Math.atan2(-ox, -oz)); });
  // signposts at the forks, pointing down both ways
  NODES.forEach((n, i) => { if (n.next.length < 2) return; const [ox, oz] = sideOf(i), s = new THREE.Group(); s.position.set(n.x - ox * 1.05, 0, n.z - oz * 1.05); world.add(s);
    cyl(s, .06, .07, 1.3, '#8a5a32', 0, .65, 0, 6);
    n.next.forEach((j, k) => { const b = NODES[j], a = Math.atan2(b.x - n.x, b.z - n.z), bd = box(s, .7, .2, .07, k ? '#ffc93c' : '#ffffff', Math.sin(a) * .3, 1.1 - k * .27, Math.cos(a) * .3); bd.rotation.y = a + Math.PI / 2; }); });
  // the lawn's flowers and season props, never on the trail or the water
  const clearOf = (x, z, r) => P.every(p => Math.hypot(p.x - x, p.z - z) > r) && ((x - POND.x) / (POND.rx + .8)) ** 2 + ((z - POND.z) / (POND.rz + .8)) ** 2 > 1
    && Math.abs(z - STREAM_Z) > .9 + (x < POND.x ? 99 : 0) * 0 && Math.hypot((x - HILL.x) / (HILL.r + 1), (z - HILL.z) / (HILL.r + 1)) > 1 && inIsle(x, z, .9) && !(Math.abs(x) < 10 && z < -11.5) && !(x > 18 && z < 0 && z > -6);
  const notStream = (x, z) => x < POND.x + POND.rx - .5 || Math.abs(z - STREAM_Z) > .9;
  const fl = SL.petals || ['#ff8fab', '#ffffff', '#ffd84a', '#b994f0'];
  let nfl = 0; for (let i = 0; i < 800 && nfl < (few ? 60 : 140); i++) { const x = ISLE.x + (hash(i, 31) - .5) * ISLE.rx * 1.9, z = ISLE.z + (hash(i, 32) - .5) * ISLE.rz * 1.9; if (!clearOf(x, z, .9) || !notStream(x, z)) continue; nfl++;
    put(world, new THREE.IcosahedronGeometry(.09, 0), M(fl[i % fl.length]), x, .08, z); }
  if (snowy) for (const [x, z] of [[-2.5, 6.5], [5.5, 4], [-5, -8.5]]) if (clearOf(x, z, 1.2)) { const g = new THREE.Group(); SP.snowman(g, 1.1); g.position.set(x, 0, z); g.rotation.y = -.4; world.add(g); }
  for (let i = 0; i < 14; i++) { const x = -20 + hash(i, 41) * 13, z = -9 + hash(i, 42) * 18; if (!clearOf(x, z, 1)) continue; const g = new THREE.Group(); (snowy ? SP.snowrock : PROPS.shroom)(g, 1.3); g.position.set(x, 0, z); world.add(g); }
  for (let i = 0; i < 10; i++) { const x = ISLE.x + (hash(i, 51) - .5) * 40, z = ISLE.z + (hash(i, 52) - .5) * 28; if (!clearOf(x, z, 1.4) || !notStream(x, z)) continue; const g = new THREE.Group(); (snowy ? SP.snowbush : PROPS.bush)(g, 1.4); g.position.set(x, 0, z); world.add(g); }
  bake(world);
  const ground = mergeStatic(world, .05); scene.add(ground);

  // ---------- trees: instanced, a solid set and a see-through set ----------
  const KINDS = { winter: [SP.snowpine, SP.snowpine], spring: [SP.blossom, PROPS.tree], summer: [PROPS.tree, PROPS.pine], autumn: [SP.autumntree, PROPS.pine], halloween: [SP.autumntree, SP.spooktree] }[season] || [PROPS.tree, PROPS.pine];
  const spots = [];
  for (let i = 0; i < 1400 && spots.length < 34; i++) { const x = -21 + hash(i, 61) * 14, z = -11 + hash(i, 62) * 21; if (clearOf(x, z, 1.9) && spots.every(s => Math.hypot(s[0] - x, s[1] - z) > 1.5)) spots.push([x, z, i]); } // the thick forest in the west
  for (let i = 0; i < 1400 && spots.length < 62; i++) { const x = ISLE.x + (hash(i, 71) - .5) * 44, z = ISLE.z + (hash(i, 72) - .5) * 31; if (x > -7 && clearOf(x, z, 2) && notStream(x, z) && spots.every(s => Math.hypot(s[0] - x, s[1] - z) > 2.2)) spots.push([x, z, i]); }
  const trees = []; // { mesh pairs, index, x, z, faded }
  const treeSets = KINDS.map(fn => {
    const g = new THREE.Group(); fn(g, 1); bake(g);
    const geos = []; g.traverse(o => { if (o.isMesh) geos.push(o.geometry); });
    return geos;
  });
  const byKind = [[], []]; spots.forEach((s, k) => byKind[s[2] % 2].push(s));
  const fadeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .22, depthWrite: false });
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const treeMeshes = [];
  byKind.forEach((list, kk) => { if (!list.length) return;
    for (const geo of treeSets[kk]) {
      const solid = new THREE.InstancedMesh(geo, toonMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })), list.length);
      const ghost = new THREE.InstancedMesh(geo, fadeMat, list.length);
      list.forEach(([x, z, i], k) => { const s = 1.15 + hash(i, 81) * .45; m4.compose(v3.set(x, 0, z), q.setFromAxisAngle(sc.set(0, 1, 0), hash(i, 82) * 6.28), sc.set(s, s, s)); solid.setMatrixAt(k, m4); ghost.setMatrixAt(k, ZERO); solid.userData.m ||= []; solid.userData.m[k] = m4.clone(); });
      solid.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ghost.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(solid, ghost); treeMeshes.push({ solid, ghost, kk });
    }
    list.forEach(([x, z], k) => trees.push({ kk, k, x, z, faded: false }));
  });
  function fadeTree(t, on) {
    t.faded = on;
    for (const tm of treeMeshes) if (tm.kk === t.kk) { const m = tm.solid.userData.m[t.k]; tm.solid.setMatrixAt(t.k, on ? ZERO : m); tm.ghost.setMatrixAt(t.k, on ? m : ZERO); tm.solid.instanceMatrix.needsUpdate = tm.ghost.instanceMatrix.needsUpdate = true; }
  }

  // ---------- soft blob shadows for everything that moves ----------
  const blobGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const BLOBS = 64, blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: '#2a3a20', transparent: true, opacity: .22, depthWrite: false }), BLOBS);
  blobs.frustumCulled = false; blobs.renderOrder = 1; scene.add(blobs);

  // ---------- whole-map outlines: a ring round every special stone, wild pet and honey pot ----------
  const ringGeo = new THREE.RingGeometry(.86, 1, 28).rotateX(-Math.PI / 2);
  const ringMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 });
  const OUTLINE = { stall: '#ffffff', nest: '#ffe9a8', bench: '#c9a8ff', well: '#7cc6ff', spring: '#9fe6f0', den: '#c9a8ff', picnic: '#ff9fc8' };
  const stoneRings = [];
  // every other stone gets a thin cream ring in the whole-map view too, so the trail reads as one line of stepping stones
  const plain = NODES.filter(n => !OUTLINE[n.kind]), plainRings = new THREE.InstancedMesh(new THREE.RingGeometry(.8, 1, 24).rotateX(-Math.PI / 2), ringMat('#fff6e2'), Math.max(1, plain.length));
  plain.forEach((n, k) => plainRings.setMatrixAt(k, new THREE.Matrix4().makeScale(SR + .3, 1, SR + .3).setPosition(n.x, SY + .02, n.z)));
  plainRings.count = plain.length; plainRings.renderOrder = 2; plainRings.frustumCulled = false; scene.add(plainRings);
  NODES.forEach((n, i) => { if (!OUTLINE[n.kind]) return; const r = new THREE.Mesh(ringGeo, ringMat(OUTLINE[n.kind])); r.position.set(n.x, SY + .02, n.z); r.scale.setScalar(SR + .5); r.renderOrder = 2; scene.add(r); stoneRings.push(r); });

  // ---------- pets ----------
  const protos = new Map();
  function petOf(sp, look, h) {
    const key = sp + '|' + (look ? JSON.stringify(look) : '') + '|' + h;
    let p = protos.get(key);
    if (!p) {
      let m; try { m = petModel(sp, 2, look || null); } catch { m = petModel('mossbun', 2); }
      const box3 = new THREE.Box3().setFromObject(m), size = box3.getSize(new THREE.Vector3()), ctr = box3.getCenter(new THREE.Vector3());
      const k = Math.min(h / size.y, h * 1.2 / Math.max(size.x, size.z)); m.userData = { ...m.userData };
      p = new THREE.Group(); m.scale.multiplyScalar(k); m.position.set(-ctr.x * k, -box3.min.y * k, -ctr.z * k); p.add(m); protos.set(key, p);
    }
    const c = p.clone(), m = c.children[0], wigs = [];
    m.traverse(o => { if (o.userData.wig) wigs.push({ o, k: o.userData.wig, r: [o.rotation.x, o.rotation.y, o.rotation.z] }); });
    m.userData.wigs = wigs;
    return c;
  }

  // ---------- players: avatar, ring, parade ----------
  let me = -1, folk = [], seatKey = '';
  function drop(f) { scene.remove(f.wrap, f.ring); disposeAvatar(f.av); f.ring.material.dispose(); for (const p of f.pets) scene.remove(p.g); }
  function setSeats(seats, mine) {
    me = mine;
    const k = seats.map(p => p.color + (p.av || []).join('')).join('|');
    if (k === seatKey) return; seatKey = k;
    for (const f of folk) drop(f); folk = [];
    seats.forEach((p, i) => {
      const wrap = new THREE.Group(); wrap.rotation.order = 'YXZ'; wrap.scale.setScalar(K);
      const av = avatar3d(p.color, p.av, { pose: 'stand', hand: false }); av.position.y = .76; wrap.add(av); scene.add(wrap);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.3, .4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: .9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
      ring.renderOrder = 3; scene.add(ring);
      folk.push({ i, wrap, av, ring, node: -1, q: [], hop: null, x: 0, z: 0, y: 0, ry: 0, tr: 0, ph: 0, amt: 0, steps: [], pets: [], herdKey: '', cheer: 0, sad: 0, sx: 0, sy: 0, on: false });
    });
  }
  // where a player stands on a stone: alone in the middle, or round the edge when others share it
  function spotOf(i, node) {
    const same = folk.filter(f => (f.q.length ? f.q[f.q.length - 1] : f.node) === node), j = same.findIndex(f => f.i === i), n = same.length, p = P[node];
    if (n <= 1 || j < 0) return [p.x, p.z];
    const a = j / n * Math.PI * 2 + .6; return [p.x + Math.cos(a) * .36, p.z + Math.sin(a) * .36];
  }
  function setHerd(f, herd) {
    const k = herd.map(h => h.sp + (h.look ? JSON.stringify(h.look) : '')).join('|'); if (k === f.herdKey) return; f.herdKey = k;
    const old = f.pets; f.pets = [];
    herd.forEach((h, n) => {
      const key = h.sp + (h.look ? JSON.stringify(h.look) : '');
      const was = old.findIndex(p => p.key === key);
      if (was >= 0) { f.pets.push(old.splice(was, 1)[0]); return; }
      const g = petOf(h.sp, h.look, h.start ? .82 : .72); g.position.set(f.x, SY, f.z); scene.add(g);
      f.pets.push({ g, key, el: h.el, seed: f.i * 7 + n, born: T });
      if (folk.length && T > 1) fx.burst(new THREE.Vector3(f.x, .8, f.z), { n: few ? 8 : 16, colors: [EL_COL[h.el] || '#ffd84a', '#ffffff'], shape: HEART, speed: 2, up: 3, size: .26, life: .9 });
    });
    for (const p of old) { scene.remove(p.g); fx.puff(p.g.position.clone(), { n: 8, color: ['#ffffff'], size: .4, speed: 1.6 }); }
  }

  // ---------- wild pets and honey pots ----------
  const wild = new Map();
  function setWild(list) {
    const seen = new Set();
    for (const w of list) {
      seen.add(w.id);
      const [x, z] = wildSpot(w.pos);
      let o = wild.get(w.id);
      if (!o) {
        const g = petOf(w.sp, null, w.rare === 2 ? 1.15 : .95);
        const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .54, 22).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: EL_COL[w.el], transparent: true, opacity: .95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
        ring.renderOrder = 2; const out = new THREE.Mesh(ringGeo, ringMat(EL_COL[w.el])); out.renderOrder = 2;
        g.position.set(x, SY, z); scene.add(g, ring, out);
        o = { g, ring, out, x, z, tx: x, tz: z, w, seed: w.id }; wild.set(w.id, o);
        if (T > 1) fx.burst(new THREE.Vector3(x, .6, z), { n: few ? 6 : 12, colors: [EL_COL[w.el], '#ffffff'], shape: STAR, speed: 2, up: 3, size: .24, life: .8 });
      }
      o.w = w; o.tx = x; o.tz = z;
    }
    for (const [id, o] of wild) if (!seen.has(id)) { scene.remove(o.g, o.ring, o.out); o.ring.material.dispose(); o.out.material.dispose(); fx.puff(o.g.position.clone().setY(.5), { n: 10, color: ['#ffffff', EL_COL[o.w.el]], size: .45, speed: 2 }); wild.delete(id); }
  }
  // a wild pet waits just off its stone, on the outer side
  function wildSpot(node) { const n = NODES[node]; let [ox, oz] = sideOf(node); if (SPECIAL.has(n.kind) && n.kind !== 'picnic') { ox = -ox; oz = -oz; } return [n.x + ox * .95, n.z + oz * .95]; }
  const honey = new Map();
  function setHoney(h) {
    const seen = new Set();
    for (const [pos, s] of Object.entries(h || {})) { const k = +pos; seen.add(k); if (honey.has(k)) continue;
      const g = new THREE.Group(); const jar = cyl(g, .16, .14, .26, '#ffb547', 0, .13, 0, 10); cyl(g, .17, .17, .06, '#fff4e2', 0, .29, 0, 10); toonify(g, .03);
      g.position.set(P[k].x + .28, SY, P[k].z - .2); scene.add(g); honey.set(k, g); }
    for (const [k, g] of honey) if (!seen.has(k)) { scene.remove(g); honey.delete(k); }
  }

  // ---------- the dice: thrown in the roller's own dice skin (dice3d.js), tumbling onto the lawn beside them ----------
  const kit = diceKit(), DS = .4, DIE_MS = 760, DIE_HOLD = 2300;
  const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new THREE.Vector3(...a));
  const UPV = new THREE.Vector3(0, 1, 0);
  const thrown = []; // { m, from, to, spin, q, t0, s, k, landed }
  function faceUpQ(v, yaw) { const f = Math.max(0, SIDE.indexOf(v)); return new THREE.Quaternion().setFromAxisAngle(UPV, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(FACE_N[f], UPV)); }
  const dropDie = d => { scene.remove(d.m); for (const c of d.m.children) c.material.dispose(); };
  function clearDice() { for (const d of thrown) dropDie(d); thrown.length = 0; }
  function roll(s, vals) {
    const f = folk[s]; if (!f || !vals?.length) return; clearDice();
    const k = S?.seats?.[s]?.fl?.dc | 0, now = performance.now();
    // land just in front of the roller, towards the camera, side by side when there are two
    const cx = camera.position.x - f.x, cz = camera.position.z - f.z, l = Math.hypot(cx, cz) || 1, fx0 = cx / l, fz0 = cz / l;
    vals.forEach((v, j) => {
      const m = new THREE.Mesh(kit.geo(k, DS), kit.mat(k)); shell(m, 1.1); m.renderOrder = 4; scene.add(m);
      const off = vals.length > 1 ? (j - .5) * .62 : 0;
      const to = new THREE.Vector3(f.x + fx0 * 1.05 - fz0 * off, SY + DS / 2, f.z + fz0 * 1.05 + fx0 * off);
      const from = new THREE.Vector3(f.x - fz0 * off * .4, 2.4, f.z + fz0 * .1);
      m.position.copy(from);
      thrown.push({ m, from, to, spin: new THREE.Vector3(9 + Math.random() * 8, Math.random() * 6, 9 + Math.random() * 8), q: faceUpQ(v, Math.atan2(cx, cz) + (Math.random() - .5) * .5), t0: now + j * 90, s, k, landed: false });
    });
  }
  function stepDice(now, blob) {
    for (let i = thrown.length - 1; i >= 0; i--) { const d = thrown[i], t = now - d.t0;
      if (t < 0) { d.m.visible = false; continue; } d.m.visible = true;
      if (t > DIE_HOLD) { const u = Math.min(1, (t - DIE_HOLD) / 220); d.m.scale.setScalar(1 - u); if (u >= 1) { dropDie(d); thrown.splice(i, 1); } continue; }
      const u = Math.min(1, t / DIE_MS);
      d.m.position.lerpVectors(d.from, d.to, ease(Math.min(1, u * 1.15)));
      d.m.position.y = d.to.y + (1 - Math.min(1, u * 1.15)) * (d.from.y - d.to.y) + Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u) * .7;
      if (u < .72) d.m.rotation.set(d.spin.x * u, d.spin.y * u, d.spin.z * u); else d.m.quaternion.slerp(d.q, Math.min(1, (u - .72) / .28 * .7 + .15));
      if (u >= 1) d.m.quaternion.copy(d.q);
      if (!d.landed && u > .55) { d.landed = true; fx.puff(d.to.clone().setY(SY + .05), { n: 3, color: [DIRT], size: .1, speed: 1, life: .35 });
        if (!few) fx.burst(d.to.clone().setY(SY + .5), { n: 8, colors: kit.sparks(d.k), shape: STAR, speed: 1.6, up: 2.4, size: .16, life: .7 }); }
      blob(d.m.position.x, d.m.position.z, .22 * (1 - Math.min(.6, (d.m.position.y - d.to.y) * .4)));
    }
  }

  // ---------- state ----------
  let S = null;
  function setState(s) {
    S = s; setSeats(s.seats, s.me);
    s.pl.forEach((p, i) => { const f = folk[i]; if (!f) return;
      if (!f.q.length && !f.hop && f.node !== p.pos) { f.node = p.pos; const [x, z] = spotOf(i, p.pos); f.x = x; f.z = z; f.steps = []; }
      setHerd(f, p.herd); });
    setWild(s.wild); setHoney(s.honey);
  }
  // walk a player along a path of stones, one hop per stone
  function walk(s, path) { const f = folk[s]; if (!f || !path?.length) return; f.q.push(...path); }

  // ---------- events ----------
  const at = (x, z, y = 0) => new THREE.Vector3(x, y, z);
  function seatAt(s) { const f = folk[s]; return f ? at(f.x, f.z, .9) : at(0, 0, 1); }
  function cue(s, kind, el) {
    const f = folk[s]; if (!f) return; const p = seatAt(s);
    if (kind === 'gain') { f.cheer = 1; fx.burst(p, { n: few ? 8 : 14, colors: ['#ffd36b', '#ffffff', '#c98a52'], shape: DOT, speed: 2.4, up: 3.4, size: .2, life: .8 }); }
    else if (kind === 'lose') { f.sad = 1; fx.puff(p, { n: 8, color: ['#9b6b4a', '#5d8a3a'], size: .35, speed: 1.6 }); }
    else if (kind === 'friend') { f.cheer = 1; fx.burst(p.setY(1.3), { n: few ? 12 : 24, colors: [EL_COL[el] || '#ffd84a', '#ffffff', '#ff9fc8'], shape: HEART, speed: 2.6, up: 4, size: .3, life: 1.1 }); }
    else if (kind === 'miss') { f.sad = 1; fx.puff(p, { n: 10, color: ['#ffffff'], size: .45, speed: 2.2 }); }
    else if (kind === 'item') fx.burst(p.setY(1.2), { n: 14, colors: ['#ffffff', '#ffd84a', '#7cc6ff'], shape: STAR, speed: 2.2, up: 3, size: .26, life: .9 });
    else if (kind === 'win') { f.cheer = 1; fx.confetti(at(f.x, f.z, 3), { n: s === me ? 70 : 34, w: 3, h: 3, s }); }
  }

  // ---------- camera ----------
  let cw = 0, ch = 0, rw = 0, rh = 0, focus = -1, mapView = false, zoom = 1, hudTop = 0, hudBottom = 0;
  const camL = new THREE.Vector3(ISLE.x, 0, ISLE.z);
  const ro = new ResizeObserver(es => { const b = es[es.length - 1].contentRect; rw = b.width; rh = b.height; }); ro.observe(canvas);
  function fit() { camera.aspect = cw / ch; camera.updateProjectionMatrix(); }

  // ---------- every frame ----------
  let T = 0; const T0 = performance.now() / 1000;
  const info = { tags: [], marks: [], zoom: 1, w: 0, h: 0 }, bm = new THREE.Matrix4(), pv = new THREE.Vector3();
  const proj = (x, y, z, o) => { pv.set(x, y, z).project(camera); o.x = (pv.x * .5 + .5) * cw; o.y = (-pv.y * .5 + .5) * ch; o.on = pv.z < 1 && Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05; return o; };
  const loop = frameLoop(dt => {
    if (!canvas.isConnected) return;
    if (rw !== cw || rh !== ch) { cw = rw; ch = rh; if (cw && ch) { renderer.setSize(cw, ch, false); fit(); } }
    if (!cw || !ch) return;
    T = performance.now() / 1000 - T0;
    let nb = 0;
    const blob = (x, z, r) => { if (nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(r, 1, r).setPosition(x, SY + .01, z)); };
    // players hop from stone to stone; their pets follow their footsteps
    for (const f of folk) {
      if (!f.hop && f.q.length) { const to = f.q.shift(), [x, z] = spotOf(f.i, to); f.hop = { fx: f.x, fz: f.z, x, z, t: 0, to }; }
      if (f.hop) { const h = f.hop; h.t = Math.min(1, h.t + dt * 1000 / (HOP * .92)); const e = ease(h.t);
        f.x = lerp(h.fx, h.x, e); f.z = lerp(h.fz, h.z, e); f.y = Math.sin(h.t * Math.PI) * .45; f.tr = Math.atan2(h.x - h.fx, h.z - h.fz); f.amt = 1;
        if (h.t >= 1) { f.node = h.to; f.hop = null; f.y = 0; if (!few) fx.puff(at(f.x, f.z, .2), { n: 3, color: ['#ffffff', DIRT], size: .2, speed: .8, life: .4 }); } }
      else { f.amt += (0 - f.amt) * Math.min(1, dt * 8); f.y = 0; }
      f.ry += wrapA(f.tr - f.ry) * Math.min(1, dt * 12); f.ph += dt * 12 * Math.max(f.amt, .001);
      f.cheer = Math.max(0, f.cheer - dt * 1.6); f.sad = Math.max(0, f.sad - dt * 1.2);
      f.wrap.position.set(f.x, SY + f.y + Math.abs(Math.sin(f.cheer * Math.PI * 3)) * .3 * f.cheer, f.z); f.wrap.rotation.set(f.sad * .25, f.ry, 0);
      animateAvatar(f.av, T, { seed: f.i, active: f.i === focus, hop: f.cheer });
      const ud = f.av.userData; if (f.amt > .05) { walkAvatar(f.av, f.ph, f.amt); ud.legs?.forEach(l => { l.rotation.z = 0; }); } else ud.legs?.forEach(l => { l.rotation.x = 0; l.rotation.z = 0; });
      f.ring.position.set(f.x, SY + .015, f.z); f.ring.material.opacity = f.i === focus ? .95 : .55;
      blob(f.x, f.z, .38);
      const last = f.steps[f.steps.length - 1];
      if (!last || Math.hypot(last[0] - f.x, last[1] - f.z) > .08) { f.steps.push([f.x, f.z]); if (f.steps.length > 300) f.steps.shift(); }
      f.pets.forEach((p, k) => {
        const back = (k + 1) * 7, st = f.steps[Math.max(0, f.steps.length - 1 - back)] || [f.x, f.z];
        // a pet with no footsteps to follow yet stands beside its player
        const tx = f.steps.length > back ? st[0] : f.x + Math.cos(k * 1.3 + f.i) * (.55 + k * .12), tz = f.steps.length > back ? st[1] : f.z + Math.sin(k * 1.3 + f.i) * (.55 + k * .12);
        const px = p.g.position.x, pz = p.g.position.z, kk = 1 - Math.pow(.002, dt);
        p.g.position.x = lerp(px, tx, kk); p.g.position.z = lerp(pz, tz, kk);
        const moved = Math.hypot(p.g.position.x - px, p.g.position.z - pz);
        p.g.position.y = SY + Math.abs(Math.sin(T * 9 + p.seed)) * (moved > .004 ? .14 : .02);
        if (moved > .004) p.g.rotation.y += wrapA(Math.atan2(p.g.position.x - px, p.g.position.z - pz) - p.g.rotation.y) * Math.min(1, dt * 10);
        p.g.children[0] && wiggle(p.g.children[0], T, p.seed, moved > .004 ? .6 : .2);
        blob(p.g.position.x, p.g.position.z, .26);
      });
    }
    // wild pets hop on the spot, and run when they move
    for (const o of wild.values()) {
      const d = Math.hypot(o.tx - o.x, o.tz - o.z);
      if (d > .01) { const s = Math.min(d, Math.max(dt * 7, d * dt * 3)); o.x += (o.tx - o.x) / d * s; o.z += (o.tz - o.z) / d * s; }
      o.g.position.set(o.x, SY + Math.abs(Math.sin(T * (d > .01 ? 10 : 3) + o.seed)) * (d > .01 ? .2 : .08), o.z);
      o.g.rotation.y = d > .01 ? Math.atan2(o.tx - o.x, o.tz - o.z) : Math.atan2(camera.position.x - o.x, camera.position.z - o.z) + Math.sin(T * .9 + o.seed) * .5;
      o.g.children[0] && wiggle(o.g.children[0], T, o.seed, .5);
      o.ring.position.set(o.x, SY + .012, o.z); o.ring.material.opacity = .7 + Math.sin(T * 4 + o.seed) * .25;
      o.out.position.set(o.x, SY + .014, o.z); o.out.scale.setScalar(.8 + Math.sin(T * 3 + o.seed) * .04);
      blob(o.x, o.z, .3);
    }
    stepDice(performance.now(), blob);
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    // camera: a close-up that follows the player in focus, or the whole island
    const f = focus >= 0 && !mapView ? folk[focus] : null;
    const tx = f ? f.x : ISLE.x, tz = f ? f.z : ISLE.z - .5;
    const kk = 1 - Math.pow(.04, dt);
    camL.x = lerp(camL.x, tx, kk); camL.z = lerp(camL.z, tz, kk);
    zoom += ((f ? 0 : 1) - zoom) * (1 - Math.pow(.03, dt));
    const port = ch > cw * 1.05, asp = cw / ch;
    // far enough back for the whole island to fit the screen under the HUD
    const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp), tilt = 52 * Math.PI / 180;
    const farD = Math.max((ISLE.rx + .5) / Math.tan(hf / 2), (ISLE.rz * Math.sin(tilt) + 1) / Math.tan(vf / 2) + ISLE.rz * Math.cos(tilt)) * (1 + (hudTop + hudBottom) / Math.max(1, ch) * .35);
    const nearD = port ? 16 : 13, D = lerp(nearD, farD, zoom), tiltNow = lerp(46 * Math.PI / 180, tilt, zoom);
    // the HUD at the top and the choices at the bottom: the spot in focus sits in the clear band between them
    const shiftZ = (hudBottom - hudTop) / Math.max(1, ch) * D * .5;
    camera.position.set(camL.x, Math.sin(tiltNow) * D, camL.z + shiftZ + Math.cos(tiltNow) * D);
    camera.lookAt(camL.x, lerp(.5, 0, zoom), camL.z + shiftZ);
    // trees between the camera and the player in focus turn see-through
    if (f && zoom < .6) { proj(f.x, .8, f.z, info); const fx0 = info.x, fy0 = info.y, cd = camera.position.distanceTo(f.wrap.position), o = {};
      for (const t of trees) { proj(t.x, 1.4, t.z, o); const dd = Math.hypot(t.x - camera.position.x, t.z - camera.position.z), hide = o.on && dd < cd && Math.abs(o.x - fx0) < Math.min(cw, ch) * .22 && o.y > fy0 - ch * .35; if (hide !== t.faded) fadeTree(t, hide); } }
    else for (const t of trees) if (t.faded) fadeTree(t, false);
    // whole-map outlines fade in as the camera pulls back
    const ro2 = Math.max(0, (zoom - .5) * 2) * .9;
    plainRings.material.opacity = ro2 * .8; plainRings.visible = ro2 > .02;
    for (const r of stoneRings) { r.material.opacity = ro2 * (.75 + Math.sin(T * 3) * .2); r.visible = ro2 > .02; }
    for (const o of wild.values()) { o.out.material.opacity = ro2; o.out.visible = ro2 > .02; }
    cloudRing.rotation.y = T * .005; fly?.(T); drift?.(T);
    fx.update(dt, camera, ch);
    renderer.render(scene, camera);
    // screen spots for the page: name tags over heads, and labels for the whole-map view
    info.zoom = zoom; info.w = cw; info.h = ch;
    folk.forEach((f2, i) => { const t = info.tags[i] ||= {}; proj(f2.x, SY + f2.y + 1.55, f2.z, t); });
    info.tags.length = folk.length;
    onFrame?.(info);
  }, { onSlow: () => res.lower?.() });

  // labels for the whole map: special stones and wild pets, as screen spots (the page draws them)
  function marks() {
    const out = [], o = {};
    NODES.forEach((n, i) => { if (!OUTLINE[n.kind]) return; proj(n.x, SY + .9, n.z, o); if (o.on) out.push({ k: 'stone', kind: n.kind, i, x: o.x, y: o.y }); });
    for (const w of wild.values()) { proj(w.x, SY + 1.1, w.z, o); if (o.on) out.push({ k: 'wild', w: w.w, x: o.x, y: o.y }); }
    for (const [pos] of honey) { proj(P[pos].x, SY + .7, P[pos].z, o); if (o.on) out.push({ k: 'honey', pos, x: o.x, y: o.y }); }
    return out;
  }

  return {
    setState, walk, cue, roll,
    rolling: () => thrown.length > 0,
    focus(s) { focus = s; },
    setMap(on) { mapView = !!on; },
    mapping: () => mapView,
    zoom: () => zoom,
    marks,
    stonePx(i, y = .6) { const o = {}; const p = P[i]; return p ? proj(p.x, y, p.z, o) : null; },
    seatPx(s) { const f = folk[s]; if (!f) return null; return proj(f.x, 1.2, f.z, {}); },
    walking: () => folk.some(f => f.hop || f.q.length),
    setHud(topPx, bottomPx) { if ((Math.abs(topPx - hudTop) > 4 || Math.abs(bottomPx - hudBottom) > 4) && hudFitOk(canvas)) { hudTop = topPx; hudBottom = bottomPx; } },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: loop.fps?.() }),
    dispose() {
      loop.stop(); ro.disconnect(); clearDice(); for (const f of folk) drop(f); folk = []; fx.dispose(); kit.dispose();
      scene.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) if (!mt.userData?.shared) mt.dispose?.(); } });
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
void N;

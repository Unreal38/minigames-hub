// Shared look for the 3D minigames: the same toon style, lively surroundings and juicy effects Pet Farm has.
//
//   toonify(root, ink)        flat three-step cartoon shading on every plain mesh under root, plus one dark outline
//                             hull around the whole model (ink = outline thickness, 0 for none). Call bake() first.
//                             Parts flagged userData.dyn are left out of the hull: toonify them on their own.
//   toonMat(material)         the toon stand-in for one MeshStandardMaterial (keeps its map and colours).
//   skyDome(scene, top, low)  a gradient sky ball.
//   clouds(opts)              soft toon clouds (one instanced mesh). Turn the group slowly for drift.
//   island(w, d, opts)        a floating grass island with a rocky underside, flowers, trees and bushes round the rim.
//                             Its top is y = 0 and the clear middle is w by d.
//   birds(parent, R, y, n)    white birds circling far off; returns update(T).
//   petals(parent, span, y)   petals and leaves drifting past; returns update(T).
//   createFx(scene)           particles in one draw call: burst, puff, confetti, sparkle, rise; call update(dt, camera, H).
//   shaker()                  camera shake: kick(strength) and apply(camera, dt) after lookAt.
//   rim(color)                a hover or selection rim: show(root) wraps root's outline hull in a glowing copy.
import * as THREE from 'three';
import { bake } from './avatar3d.js';
import { fxOf } from './winfx.js';

export const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- the toon look ----------
const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const _hsl = {}, _tc = new THREE.Color();
const tint = c => { c.getHSL(_hsl); return c.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.12 + (_hsl.s > .04 ? .04 : 0)), Math.min(.97, _hsl.l * 1.05 + .03)); };
const mats = new Map();
export function toonMat(old) {
  const make = () => new THREE.MeshToonMaterial({ color: old.vertexColors || old.map ? old.color.clone() : tint(old.color.clone()), map: old.map || null, vertexColors: !!old.vertexColors,
    transparent: old.transparent, opacity: old.opacity, depthWrite: old.depthWrite, side: old.side,
    emissive: old.emissive?.clone() || new THREE.Color(0), emissiveIntensity: old.emissiveIntensity ?? 1, gradientMap: RAMP });
  if (old.map) return make(); // textured surfaces are one of a kind
  const key = [old.color.getHexString(), +!!old.vertexColors, +!!old.transparent, old.opacity, old.emissive?.getHexString(), old.emissiveIntensity, old.side, +old.depthWrite].join();
  let m = mats.get(key); if (!m) { mats.set(key, m = make()); m.userData.shared = true; }
  return m;
}
const inks = new Map();
const inkMat = (t, color) => { const key = t.toFixed(4) + color; let m = inks.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }); m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${t.toFixed(4)};`); }; m.customProgramCacheKey = () => 'ink' + key; m.userData.shared = true; inks.set(key, m); }
  return m; };
// One hull around a whole model: every solid part merged, corners welded so the line has no gaps, drawn inside out.
const _iv = new THREE.Matrix4(), _im = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function inkHull(root, t, color) {
  root.updateWorldMatrix(true, true); _iv.copy(root.matrixWorld).invert();
  const parts = []; let n = 0;
  const walk = o => { for (const m of o.children) {
    if (m.userData.dyn || m.userData.noInk || m.userData.ink || !m.visible) continue;
    if (m.isMesh && !m.isInstancedMesh && !m.material.transparent && !(m.material.emissiveIntensity > 0 && m.material.emissive?.getHex())) {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(_im.multiplyMatrices(_iv, m.matrixWorld)); parts.push(g.attributes.position.array); n += g.attributes.position.count; g.dispose();
    }
    walk(m);
  } };
  walk(root);
  if (!n) return null;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), sum = new Map(); let o = 0; for (const p of parts) { pos.set(p, o); o += p.length; }
  const keyOf = i => Math.round(pos[i * 3] * 400) + ',' + Math.round(pos[i * 3 + 1] * 400) + ',' + Math.round(pos[i * 3 + 2] * 400), keys = new Array(n);
  for (let i = 0; i < n; i += 3) {
    _a.fromArray(pos, i * 3); _b.fromArray(pos, i * 3 + 3).sub(_a); _c.fromArray(pos, i * 3 + 6).sub(_a); _b.cross(_c).normalize();
    for (let k = 0; k < 3; k++) { const key = keys[i + k] = keyOf(i + k); let v = sum.get(key); if (!v) sum.set(key, v = [0, 0, 0]); v[0] += _b.x; v[1] += _b.y; v[2] += _b.z; }
  }
  for (let i = 0; i < n; i++) { const v = sum.get(keys[i]), l = Math.hypot(v[0], v[1], v[2]) || 1; nor[i * 3] = v[0] / l; nor[i * 3 + 1] = v[1] / l; nor[i * 3 + 2] = v[2] / l; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const hull = new THREE.Mesh(g, inkMat(t, color)); hull.userData = { baked: true, ink: true, toon: true }; hull.castShadow = hull.receiveShadow = false;
  return hull;
}
export function toonify(root, ink = 0, { color = '#4a2c22', tinted = true } = {}) {
  root.traverse(m => {
    if (!m.isMesh || m.userData.toon) return;
    if (Array.isArray(m.material)) { m.material = m.material.map(x => x.isMeshStandardMaterial ? toonMat(x) : x); m.userData.toon = true; return; }
    if (!m.material?.isMeshStandardMaterial) return;
    const old = m.material, C = tinted && old.vertexColors && m.userData.baked && m.geometry.attributes.color;
    if (C) { for (let i = 0; i < C.count; i++) { tint(_tc.setRGB(C.getX(i), C.getY(i), C.getZ(i))); C.setXYZ(i, _tc.r, _tc.g, _tc.b); } C.needsUpdate = true; }
    m.material = toonMat(old); m.userData.toon = true;
  });
  if (ink) { const h = inkHull(root, ink, color); if (h) root.add(h); }
  return root;
}
// Frees what a toonified tree made, leaving the shared materials alone.
export function disposeToon(root) {
  root.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) if (!m.userData.shared) { m.map?.dispose(); m.dispose(); } });
}
export const flat = (c, o) => new THREE.MeshStandardMaterial({ color: c, roughness: .95, flatShading: true, ...o });

// A dark shell round a single box-like mesh (dice, cards): a slightly bigger copy drawn inside out.
export function shell(mesh, grow = 1.1, color = '#4a2c22') {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })); o.scale.setScalar(grow); o.userData = { ink: true, noInk: true }; mesh.add(o); return o;
}

// ---------- night ----------
// The website's day/night switch (body.night) carries into the games: call nightScene(scene) once the lights,
// sky and clouds exist. It notes the scene's daytime look, then paints it for the current mode: at night a
// starry navy sky, moonlight for sunlight, tinted clouds, a moon, and the islands' lamp posts. The switch can be
// flipped mid-game: setScenesNight(on) repaints every live scene both ways.
export const isNight = () => typeof document !== 'undefined' && document.body.classList.contains('night');
export const NIGHT_TOP = '#0c1236', NIGHT_LOW = '#2d2b63';
const liveScenes = new Set(); // WeakRefs, so a finished game's scene can still be collected
export function nightScene(scene, { top = NIGHT_TOP, low = NIGHT_LOW, stars = 320, moon = true } = {}) {
  if (!scene.userData.dayNight) {
    const S = scene.userData.dayNight = { top: new THREE.Color(top), low: new THREE.Color(low), stars, moon, lights: [], domes: [], clouds: [], on: false,
      bg: scene.background?.isColor ? scene.background.clone() : null, fog: scene.fog ? scene.fog.color.clone() : null };
    scene.traverse(o => {
      if (o.isHemisphereLight || o.isDirectionalLight || o.isAmbientLight) S.lights.push({ o, c: o.color.clone(), g: o.groundColor?.clone(), i: o.intensity });
      else if (o.isMesh && o.userData.sky) S.domes.push({ o, day: o.geometry.attributes.color.array.slice() });
      else if (o.isInstancedMesh && o.userData.cloud) { const night = o.material.clone(); night.color.set('#6d72b4'); S.clouds.push({ o, day: o.material, night }); }
    });
    if (typeof WeakRef !== 'undefined') liveScenes.add(new WeakRef(scene));
  }
  applyNight(scene, isNight());
  return isNight();
}
export function setScenesNight(on) {
  for (const r of liveScenes) { const s = r.deref(); if (s) applyNight(s, on); else liveScenes.delete(r); }
}
function applyNight(scene, on) {
  const S = scene.userData.dayNight; if (!S) return;
  scene.traverse(o => { if (o.userData.nightOnly) o.visible = on; }); // island lamps
  if (S.on === on) return; S.on = on;
  const moonC = new THREE.Color('#c9d2ff'), c = new THREE.Color();
  if (S.bg && scene.background?.isColor) scene.background.copy(on ? S.low : S.bg);
  if (S.fog && scene.fog) scene.fog.color.copy(on ? S.low : S.fog);
  for (const { o, c: dc, g, i } of S.lights) {
    o.color.copy(dc); if (g) o.groundColor.copy(g); o.intensity = i;
    if (!on) continue;
    if (o.isHemisphereLight) { o.color.lerp(new THREE.Color('#8f9cff'), .75); o.groundColor.set('#3b2f5e'); o.intensity *= .55; }
    else if (o.isDirectionalLight) { o.color.lerp(moonC, .8); o.intensity *= .55; }
    else { o.color.lerp(moonC, .6); o.intensity *= .6; }
  }
  for (const { o, day } of S.domes) { // repaint the dome's gradient
    const g = o.geometry, p = g.attributes.position, col = g.attributes.color;
    if (!on) col.array.set(day);
    else { const r = g.boundingSphere?.radius || (g.computeBoundingSphere(), g.boundingSphere.radius);
      for (let i = 0; i < p.count; i++) { c.copy(S.low).lerp(S.top, Math.min(1, Math.max(0, p.getY(i) / r * 1.5 + .1))); col.setXYZ(i, c.r, c.g, c.b); } }
    col.needsUpdate = true;
  }
  for (const k of S.clouds) k.o.material = on ? k.night : k.day;
  if (on && !S.sky) { // stars and moon are made the first time night falls, then just shown and hidden
    S.sky = new THREE.Group(); S.sky.userData.nightOnly = true; scene.add(S.sky);
    if (S.stars) { // a fixed dome of stars, far out past the fog
      const pos = new Float32Array(S.stars * 3);
      for (let i = 0; i < S.stars; i++) { const a = hash(i, 71) * 6.283, e = .04 + hash(i, 72) * 1.45, r = 260; pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff6d8', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: .9, depthWrite: false }));
      pts.renderOrder = -9; S.sky.add(pts);
    }
    if (S.moon) {
      const grp = new THREE.Group(); grp.position.set(-120, 120, -170); grp.lookAt(0, 0, 0);
      for (const [r, o] of [[9, 1], [13, .25], [19, .1]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: o, depthWrite: false, fog: false })); m.renderOrder = -8; grp.add(m); }
      S.sky.add(grp);
    }
  }
  if (S.sky) S.sky.visible = on;
}

// ---------- sky and clouds ----------
export function skyDome(scene, top, low, { r = 300, k = 1.6, off = .25 } = {}) {
  const g = new THREE.SphereGeometry(r, 16, 10), p = g.attributes.position, col = [], T = new THREE.Color(top), L = new THREE.Color(low), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(L).lerp(T, Math.min(1, Math.max(0, p.getY(i) / r * k + off))); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10; m.userData.sky = true; scene.add(m); return m;
}
// near: a sea of clouds below; far: a few big ones round the horizon.
export function clouds({ near = 40, far = 12, below = -9, min = 6, max = 80, color = '#ffffff', seed = 0 } = {}) {
  const grp = new THREE.Group(), puffs = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const cloud = (x, y, z, s) => { for (const [dx, dy, dz, r] of [[0, 0, 0, 1], [.9, -.1, .2, .75], [-.9, -.12, -.1, .7], [.2, .3, -.3, .65]]) puffs.push([x + dx * s, y + dy * s, z + dz * s, r * s]); };
  for (let i = 0; i < near; i++) { const a = hash(i + seed, 1) * 6.283, d = min + hash(i + seed, 2) * max; cloud(Math.cos(a) * d, below - hash(i, 3) * 8 - d * .04, Math.sin(a) * d, 2.2 + hash(i, 4) * 3.2); }
  for (let i = 0; i < far; i++) { const a = hash(i + seed, 5) * 6.283, d = max + 10 + hash(i, 6) * 50; cloud(Math.cos(a) * d, 4 + hash(i, 7) * 22, Math.sin(a) * d, 4 + hash(i, 8) * 4); }
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toonMat(flat(color)), puffs.length);
  puffs.forEach(([x, y, z, r], i) => im.setMatrixAt(i, m.compose(v.set(x, y, z), q, sc.set(r * 1.2, r * .6, r))));
  im.frustumCulled = false; im.userData.cloud = true; grp.add(im);
  return grp;
}

// ---------- a floating island ----------
// Rough up a shape's lower part so rock looks hand cut.
export function rough(geo, amt, keepY = Infinity) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = Math.round(x * 10) * 7 + Math.round(y * 10) * 13 + Math.round(z * 10) * 29;
    if (y < keepY) p.setXYZ(i, x + (hash(k, 1) - .5) * amt, y + (hash(k, 2) - .5) * amt * .6, z + (hash(k, 3) - .5) * amt);
  }
  geo.computeVertexNormals(); return geo;
}
export const put = (p, g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o; };
export const ico = (p, r, c, x, y, z) => put(p, new THREE.IcosahedronGeometry(r, 0), flat(c), x, y, z);
// Little props for the rim. Each sits on y = 0.
export const PROPS = {
  tree(g, s = 1, c = '#5fb04a') { put(g, new THREE.CylinderGeometry(.09 * s, .13 * s, .7 * s, 6), flat('#8a5a3c'), 0, .35 * s); ico(g, .45 * s, c, 0, .95 * s, 0); ico(g, .32 * s, '#86cc5a', .22 * s, 1.18 * s, .08 * s); ico(g, .3 * s, c, -.24 * s, .82 * s, -.1 * s); },
  pine(g, s = 1) { put(g, new THREE.CylinderGeometry(.07 * s, .1 * s, .4 * s, 6), flat('#8a5a3c'), 0, .2 * s); for (let i = 0; i < 3; i++) put(g, new THREE.ConeGeometry((.5 - i * .12) * s, .55 * s, 7), flat(i % 2 ? '#4a9a45' : '#3f8c4a'), 0, (.6 + i * .3) * s); },
  bush(g, s = 1) { ico(g, .3 * s, '#5fb04a', 0, .2 * s, 0); ico(g, .24 * s, '#86cc5a', .25 * s, .15 * s, .05 * s); ico(g, .2 * s, '#4a9a45', -.22 * s, .13 * s, .06 * s); ico(g, .06 * s, '#ff9fb8', .1 * s, .45 * s, .15 * s); ico(g, .06 * s, '#ffffff', -.12 * s, .36 * s, .2 * s); },
  rock(g, s = 1) { const r = ico(g, .3 * s, '#a9a6b0', 0, .15 * s, 0); r.scale.y = .7; ico(g, .18 * s, '#8a8794', .28 * s, .08 * s, .1 * s); },
  shroom(g, s = 1) { put(g, new THREE.CylinderGeometry(.05 * s, .06 * s, .18 * s, 6), flat('#fff4e2'), 0, .09 * s); const c = put(g, new THREE.SphereGeometry(.14 * s, 8, 5, 0, 6.3, 0, 1.6), flat('#e5543b'), 0, .16 * s); ico(c, .03 * s, '#ffffff', .06 * s, .08 * s, .04 * s); },
  flowers(g, s = 1, c = '#ff9fb8') { for (let i = 0; i < 4; i++) { const a = i * 1.7, x = Math.cos(a) * .14 * s, z = Math.sin(a) * .14 * s; put(g, new THREE.CylinderGeometry(.012 * s, .012 * s, .2 * s, 4), flat('#5fb04a'), x, .1 * s, z); ico(g, .06 * s, i % 2 ? c : '#fff1a8', x, .21 * s, z); } },
  lamp(g, s = 1) { put(g, new THREE.CylinderGeometry(.04 * s, .06 * s, 1.1 * s, 6), flat('#5b4636'), 0, .55 * s); put(g, new THREE.BoxGeometry(.2 * s, .05 * s, .2 * s), flat('#5b4636'), 0, 1.24 * s); const l = put(g, new THREE.BoxGeometry(.16 * s, .2 * s, .16 * s), flat('#ffe27a', { emissive: '#ffb547', emissiveIntensity: .8 }), 0, 1.11 * s); l.userData.noInk = true; put(g, new THREE.BoxGeometry(.2 * s, .04 * s, .2 * s), flat('#5b4636'), 0, 1 * s); },
};
// w, d: the clear middle. opts.round: a round island; grass: top colour; props: how many things round the rim.
export function island(w, d, { round = false, grass = '#8bca60', patch = '#7fbf56', earth = '#c98a5a', rock = '#857a72', props = 14, seed = 1, rim = 1.6, depth = 1, flowers = 40, lamps = 0, size = 1, open = 0, kinds = null, petals = null, under = true, clear = 0 } = {}) { // open: 0..1, how much of the front (towards +z) is kept free of props; clear: radius of a round floor in the middle that patches and flowers stay off
  // kinds: which props stand round the rim (names from PROPS, or functions (group, size)); petals: flower colours; under: false leaves the rock underneath to the caller
  const autoLamps = !lamps; // lamp posts light the island at night: built always, shown only at night (nightScene toggles them)
  if (autoLamps) lamps = Math.max(3, Math.round((w + d) / 5));
  const root = new THREE.Group(), deco = new THREE.Group();
  const W = w / 2 + rim, D = d / 2 + rim, R = round ? Math.max(W, D) : Math.hypot(W, D);
  // the top: a rounded slab of lawn
  let top;
  if (round) top = new THREE.CylinderGeometry(R, R - .2, .5, 40);
  else { const s = new THREE.Shape(), r = Math.min(W, D) * .3; s.moveTo(-W + r, -D); s.lineTo(W - r, -D); s.quadraticCurveTo(W, -D, W, -D + r); s.lineTo(W, D - r); s.quadraticCurveTo(W, D, W - r, D); s.lineTo(-W + r, D); s.quadraticCurveTo(-W, D, -W, D - r); s.lineTo(-W, -D + r); s.quadraticCurveTo(-W, -D, -W + r, -D);
    top = new THREE.ExtrudeGeometry(s, { depth: .5, bevelEnabled: true, bevelThickness: .08, bevelSize: .12, bevelSegments: 2, curveSegments: 6 }); top.rotateX(Math.PI / 2); }
  const lawn = put(root, top, flat(grass), 0, round ? -.25 : 0); lawn.receiveShadow = true;
  // earth band and a rock cone underneath, with loose stones hanging about
  const band = put(root, rough(new THREE.CylinderGeometry(R * .98, R * .7, 1.6 * depth, round ? 18 : 8, 3), .4), flat(earth), 0, -1.2 * depth);
  if (!round) band.scale.set(W / R * 1.08, 1, D / R * 1.08), band.rotation.y = Math.PI / 8;
  const deep = Math.max(W, D) * 1.1 * depth;
  if (under) { const cone = put(root, rough(new THREE.ConeGeometry(R * .62, deep, 8, 3), R * .08), flat(rock), 0, -2 - deep / 2 * depth);
  cone.rotation.x = Math.PI; if (!round) cone.scale.set(W / R * 1.1, 1, D / R * 1.1);
  for (let i = 0; i < 7; i++) { const a = hash(i, seed) * 6.283, k = .35 + hash(i, seed + 9) * .35, st = ico(root, .3 + hash(i, 3) * .5, rock, Math.cos(a) * W * k, -3 - hash(i, 4) * deep * .5, Math.sin(a) * D * k); st.scale.y = 1.4; } }
  // what sits in the grass: darker patches and little flowers, kept off the clear middle
  const onRim = (i, s2, inset = .55) => { // a point on the rim band, outside the clear middle
    for (let k = 0; k < 8; k++) { const x = (hash(i * 8 + k, s2) * 2 - 1) * (W - inset), z = (hash(i * 8 + k, s2 + 1) * 2 - 1) * (D - inset); if (clear && Math.hypot(x, z) < clear + inset) continue;
      if (round ? Math.hypot(x, z) < R - inset && (Math.abs(x) > w / 2 + .25 || Math.abs(z) > d / 2 + .25) : Math.abs(x) > w / 2 + .25 || Math.abs(z) > d / 2 + .25) return [x, z]; }
    return null; };
  const patchM = flat(patch), petal = (petals || ['#ffffff', '#ffd0e4', '#fff1a8', '#d9c8ff']).map(c => flat(c)), mid = flat('#ffb000');
  for (let i = 0; i < 18; i++) { const p = onRim(i, seed + 20, .9); if (!p) continue; const m = put(deco, new THREE.CircleGeometry(.4 + hash(i, 5) * .5, 12), patchM, p[0], .01, p[1]); m.rotation.x = -Math.PI / 2; }
  for (let i = 0; i < flowers; i++) { const p = onRim(i, seed + 40, .3); if (!p) continue; const pc = petal[i % petal.length];
    for (let k = 0; k < 5; k++) { const m = put(deco, new THREE.IcosahedronGeometry(.05, 0), pc, p[0] + Math.cos(k * 1.257) * .06, .03, p[1] + Math.sin(k * 1.257) * .06); m.scale.y = .45; }
    put(deco, new THREE.IcosahedronGeometry(.04, 0), mid, p[0], .05, p[1]); }
  bake(deco); deco.traverse(m => { if (m.isMesh) { m.receiveShadow = true; m.userData.noInk = true; } }); root.add(deco);
  // props round the rim: trees, pines, bushes, rocks and mushrooms
  kinds ||= ['tree', 'bush', 'pine', 'rock', 'bush', 'shroom', 'tree', 'flowers', 'pine', 'bush'];
  for (let i = 0; i < props; i++) {
    const a = (i + hash(i, seed + 60) * .6) / props * 6.283;
    let x = Math.cos(a), z = Math.sin(a); const k = round ? R - .6 : 1;
    if (round) { x *= k; z *= k; } else { const s = Math.min((W - .55) / Math.abs(x || 1e-6), (D - .55) / Math.abs(z || 1e-6)); x *= s; z *= s; }
    if (open && z > (R - .6) * (1 - open)) continue;
    const g = new THREE.Group(), kind = kinds[(i + seed) % kinds.length]; (typeof kind === 'function' ? kind : PROPS[kind])(g, (.7 + hash(i, seed + 61) * .5) * size); g.position.set(x, 0, z); g.rotation.y = hash(i, 62) * 6.283; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); root.add(g);
  }
  for (let i = 0; i < lamps; i++) { const a = (i + .5) / lamps * 6.283, g = new THREE.Group(); PROPS.lamp(g, 1); let x = Math.cos(a), z = Math.sin(a); const s = round ? R - .5 : Math.min((W - .4) / Math.abs(x || 1e-6), (D - .4) / Math.abs(z || 1e-6)); g.position.set(x * s, 0, z * s); if (autoLamps) { g.userData.nightOnly = true; g.visible = isNight(); } root.add(g); }
  bake(root);
  root.traverse(m => { if (m.isMesh && m.userData.baked) m.receiveShadow = true; });
  return toonify(root, .05);
}

// ---------- life in the air ----------
export function birds(parent, R, y, n = 3, size = 1) {
  const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.12, 0, 0, .12, .5, 0, 0], 3));
  const mt = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, fog: false }), list = [];
  for (let i = 0; i < n; i++) { const g = new THREE.Group(), a = new THREE.Mesh(wing, mt), b = new THREE.Mesh(wing, mt); b.scale.x = -1; g.add(a, b); g.scale.setScalar(size); parent.add(g); list.push({ g, a, b, ph: i * 2.1 }); }
  return T => { for (const b of list) { const t = T * .12 + b.ph, r = R * (1 + Math.sin(b.ph * 3) * .2), x = Math.cos(t) * r, z = Math.sin(t) * r; b.g.position.set(x, y + Math.sin(t * 3 + b.ph) * 1.2, z); b.g.rotation.y = -t; const w = Math.sin(T * 7 + b.ph * 5) * .7; b.a.rotation.z = w; b.b.rotation.z = -w; } };
}
export function petals(parent, span, y = 3, { n = 10, colors = ['#ffc1dc', '#ffffff', '#a8e08a', '#ffd9ea', '#ffe9a8', '#c9f0a8'], size = .1 } = {}) {
  const g = new THREE.OctahedronGeometry(1, 0).scale(.5, .08, 1), list = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })); parent.add(m); list.push({ m, ph: i * 2.37, sp: .5 + hash(i, 81) * .5 }); }
  return T => { for (const p of list) {
    const u = ((T * p.sp * .07 + p.ph * .13) % 1 + 1) % 1, lane = Math.floor(T * p.sp * .07 + p.ph * .13);
    p.m.position.set(-span / 2 + u * span + Math.sin(T * 1.1 + p.ph) * .5, y - u * (y - .3) + Math.sin(T * 2.3 + p.ph) * .25, (hash(lane, p.ph) - .5) * span * .8 + Math.sin(T * .8 + p.ph) * .6);
    p.m.rotation.set(T * 2.1 + p.ph, T * 1.3, Math.sin(T * 3 + p.ph)); p.m.scale.setScalar(size * Math.min(1, u * 8, (1 - u) * 8));
  } };
}

// ---------- particles ----------
// Shapes in the sprite sheet: 0 soft dot, 1 star, 2 confetti square, 3 heart, 4 ring, 5 fish, 6 coin, 7 snowflake.
export const DOT = 0, STAR = 1, CONF = 2, HEART = 3, RING = 4, FISH = 5, COIN = 6, FLAKE = 7;
function sheet() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const g = cv.getContext('2d');
  let gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, '#fff'); gr.addColorStop(.45, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 29; g.lineTo(96 + Math.cos(a) * r, 33 + Math.sin(a) * r); } g.closePath(); g.fill();
  g.beginPath(); g.roundRect(128 + 14, 20, 36, 24, 5); g.fill();
  g.beginPath(); g.moveTo(224, 52); g.bezierCurveTo(196, 34, 198, 10, 214, 12); g.bezierCurveTo(220, 12, 224, 18, 224, 22); g.bezierCurveTo(224, 18, 228, 12, 234, 12); g.bezierCurveTo(250, 10, 252, 34, 224, 52); g.fill();
  g.lineWidth = 7; g.strokeStyle = '#fff'; g.beginPath(); g.arc(288, 32, 24, 0, 6.3); g.stroke();
  g.beginPath(); g.ellipse(346, 32, 19, 12, 0, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(362, 32); g.lineTo(378, 19); g.lineTo(378, 45); g.closePath(); g.fill(); g.fillStyle = '#555'; g.beginPath(); g.arc(336, 29, 3, 0, 6.3); g.fill(); // fish
  g.fillStyle = '#fff'; g.beginPath(); g.arc(416, 32, 24, 0, 6.3); g.fill(); g.lineWidth = 5; g.strokeStyle = '#bbb'; g.beginPath(); g.arc(416, 32, 21, 0, 6.3); g.stroke(); g.beginPath(); g.arc(416, 32, 10, 0, 6.3); g.stroke(); // coin
  g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = '#fff'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(480 - Math.cos(a) * 24, 32 - Math.sin(a) * 24); g.lineTo(480 + Math.cos(a) * 24, 32 + Math.sin(a) * 24); g.stroke(); } // snowflake
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// How each win effect (cosmetics.js, kind wn) looks as an in-game shower. 4 (fireworks) is drawn as bursts instead.
const WINLOOK = {
  1: { colors: ['#ff5d8f', '#ffc93c', '#4fc3e8', '#7ed37a', '#c9b3ff', '#ff8a2a'], shape: CONF, n: 1, size: 1, grav: 2.2, spin: 10, flutter: 2.2 },
  2: { colors: ['#ff5d8f', '#ff8fb3', '#e5243b', '#ffc2d6'], shape: HEART, n: .6, size: 1.7, grav: 1.5, spin: 1.5, flutter: 1.6 },
  3: { colors: ['#4fc3e8', '#ff9a3c', '#ffd84a', '#7ed3b2'], shape: FISH, n: .55, size: 2, grav: 3, spin: 2.5, flutter: 1 },
  5: { colors: ['#ffc93c', '#ffd84a', '#f2b01e'], shape: COIN, n: .6, size: 1.5, grav: 4.5, spin: 1, flutter: .6 },
  6: { colors: ['#ffffff', '#dff1ff', '#bcdcff'], shape: FLAKE, n: .7, size: 1.5, grav: .9, spin: 2, flutter: 2.4, life: 1.25 },
};
export function createFx(scene, { max = 900 } = {}) {
  const P = new Float32Array(max * 3), C = new Float32Array(max * 3), S = new Float32Array(max), A = new Float32Array(max), R = new Float32Array(max), K = new Float32Array(max);
  const st = []; // per live particle: { v, life, max, s0, s1, grav, drag, spin, flut }
  const geo = new THREE.BufferGeometry();
  const at = (n, a, k) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, b); return b; };
  const aP = at('position', P, 3), aC = at('color', C, 3), aS = at('size', S, 1), aA = at('alpha', A, 1), aR = at('rot', R, 1), aK = at('shape', K, 1);
  const tex = sheet();
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 500 } }, transparent: true, depthWrite: false, vertexColors: true,
    vertexShader: `attribute float size; attribute float alpha; attribute float rot; attribute float shape; uniform float scale;
      varying vec3 vC; varying float vA; varying float vR; varying float vK;
      void main() { vC = color; vA = alpha; vR = rot; vK = shape; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; varying float vR; varying float vK;
      void main() { vec2 p = gl_PointCoord - .5; float c = cos(vR), s = sin(vR); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + .5;
        if (p.x < 0. || p.x > 1. || p.y < 0. || p.y > 1.) discard;
        vec4 t = texture2D(map, vec2((vK + p.x) / 8., 1. - p.y)); if (t.a * vA < .02) discard; gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  let n = 0, ringI = 0; const col = new THREE.Color();
  const ringGeo = new THREE.RingGeometry(.78, 1, 32); ringGeo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 4; scene.add(m); return { m, t: 1, life: .4, size: 1 }; });
  function add(x, y, z, vx, vy, vz, c, o) {
    if (n >= max) return;
    const i = n++; P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; col.set(c); C[i * 3] = col.r; C[i * 3 + 1] = col.g; C[i * 3 + 2] = col.b;
    K[i] = o.shape ?? DOT; R[i] = Math.random() * 6.28; S[i] = 0; A[i] = 0;
    st[i] = { vx, vy, vz, life: 0, max: o.life * (.7 + Math.random() * .6), s0: o.size * (.7 + Math.random() * .6), grow: o.grow ?? 0, grav: o.grav ?? 9, drag: o.drag ?? 1.5, spin: (Math.random() - .5) * (o.spin ?? 8), flut: o.flutter ?? 0, ph: Math.random() * 6.28, fade: o.fade ?? 1 };
  }
  const pick = c => Array.isArray(c) ? c[Math.floor(Math.random() * c.length)] : c;
  const api = {
    // a pop of bits flying out: stars, dots, hearts...
    burst(p, { n: cnt = 16, colors = '#ffd84a', speed = 4, up = 3, size = .25, life = .8, shape = STAR, grav = 9, drag = 1.2, spin, y = 0, spread = 1, grow } = {}) {
      for (let k = 0; k < cnt; k++) { const a = Math.random() * 6.283, s = speed * (.4 + Math.random() * .6);
        add(p.x, p.y + y, p.z, Math.cos(a) * s * spread, up * (.5 + Math.random() * .8), Math.sin(a) * s * spread, pick(colors), { shape: pick(shape), size, life, grav, drag, spin, grow }); }
    },
    // soft dust ring at the feet, for landings and stomps
    puff(p, { n: cnt = 10, color = '#fff4e2', size = .35, speed = 2.2, life = .55 } = {}) {
      for (let k = 0; k < cnt; k++) { const a = k / cnt * 6.283 + Math.random() * .4;
        add(p.x + Math.cos(a) * .15, p.y + .05, p.z + Math.sin(a) * .15, Math.cos(a) * speed, .4 + Math.random() * .5, Math.sin(a) * speed, pick(color), { shape: DOT, size, life, grav: 0, drag: 4, spin: 0, grow: 1.4, fade: .7 }); }
    },
    // confetti raining down over an area, fluttering as it falls
    // Pass s (a seat number, or 'me') and it becomes that player's win effect from the Wardrobe: hearts, fish, coins...
    confetti(p, { n: cnt = 80, w = 6, h = 4, colors = ['#ff7a59', '#ffc93c', '#7ed3b2', '#8a98ff', '#ff9fb8', '#ffffff'], size = .22, life = 2.6, s } = {}) {
      const k = s == null ? 0 : fxOf(s), L = WINLOOK[k];
      if (k === 4) { // fireworks: a few rings of stars going off above the spot
        const per = Math.max(10, Math.min(26, cnt / 4 | 0));
        for (let b = 0; b < 4; b++) { const cx = p.x + (Math.random() - .5) * w * .8, cy = p.y + h * (.5 + Math.random() * .6), cz = p.z + (Math.random() - .5) * w * .8, c = WINLOOK[1].colors[(b * 2) % 6];
          for (let j = 0; j < per; j++) { const a = Math.random() * 6.283, e = (Math.random() - .5) * 3.14, sp = 2.6 + Math.random() * 1.6;
            add(cx, cy, cz, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1, Math.sin(a) * Math.cos(e) * sp, Math.random() < .2 ? '#ffffff' : c, { shape: STAR, size: size * 1.3, life: 1.1, grav: 2.5, drag: 1.6, spin: 4, grow: -.5 }); } }
        return;
      }
      if (L) { // bigger pictures, so fewer of them: the same cost or less than plain confetti
        for (let j = 0, m = Math.ceil(cnt * L.n); j < m; j++) add(p.x + (Math.random() - .5) * w, p.y + h * (.6 + Math.random() * .6), p.z + (Math.random() - .5) * w, (Math.random() - .5) * 1.5, Math.random() * 2, (Math.random() - .5) * 1.5, pick(L.colors),
          { shape: L.shape, size: size * L.size, life: life * (L.life || 1), grav: L.grav, drag: 1.4, spin: L.spin, flutter: L.flutter });
        return;
      }
      for (let k = 0; k < cnt; k++) add(p.x + (Math.random() - .5) * w, p.y + h * (.6 + Math.random() * .6), p.z + (Math.random() - .5) * w, (Math.random() - .5) * 1.5, Math.random() * 2, (Math.random() - .5) * 1.5, pick(colors), { shape: CONF, size, life, grav: 2.2, drag: 1.4, spin: 10, flutter: 2.2 });
    },
    // a few twinkles hanging round a spot
    sparkle(p, { n: cnt = 8, colors = '#fff1a8', r = .6, size = .22, life = .9 } = {}) {
      for (let k = 0; k < cnt; k++) add(p.x + (Math.random() - .5) * r * 2, p.y + Math.random() * r, p.z + (Math.random() - .5) * r * 2, 0, .6, 0, pick(colors), { shape: STAR, size, life, grav: 0, drag: 2, spin: 3, grow: -.3 });
    },
    // a widening ring lying flat on the ground
    ring(p, { color = '#ffffff', size = 1.4, life = .45 } = {}) {
      const r = rings[ringI++ % rings.length]; r.t = 0; r.life = life; r.size = size; r.m.material.color.set(color); r.m.position.set(p.x, p.y + .04, p.z); r.m.visible = true;
    },
    // things drifting upwards (steam, embers, bubbles, fireflies); one at a time, call as often as you like
    rise(p, { color = '#ffffff', size = .3, life = 1.6, speed = .8, wobble = .3, shape = DOT, grow = 1 } = {}) {
      add(p.x, p.y, p.z, (Math.random() - .5) * wobble, speed * (.7 + Math.random() * .6), (Math.random() - .5) * wobble, pick(color), { shape, size, life, grav: 0, drag: .2, spin: 1, grow, flutter: wobble * 2, fade: .6 });
    },
    update(dt, camera, H) {
      mat.uniforms.scale.value = H / (2 * Math.tan(camera.fov * Math.PI / 360));
      for (const r of rings) { if (!r.m.visible) continue; r.t += dt; const u = Math.min(1, r.t / r.life), e = 1 - (1 - u) * (1 - u); r.m.scale.setScalar(r.size * (.25 + e * .75)); r.m.material.opacity = .85 * (1 - u); if (u >= 1) r.m.visible = false; }
      for (let i = 0; i < n; i++) {
        const s = st[i]; s.life += dt;
        if (s.life >= s.max) { // swap the last one in
          const j = --n; if (i !== j) { for (let k = 0; k < 3; k++) { P[i * 3 + k] = P[j * 3 + k]; C[i * 3 + k] = C[j * 3 + k]; } S[i] = S[j]; A[i] = A[j]; R[i] = R[j]; K[i] = K[j]; st[i] = st[j]; } i--; continue;
        }
        const d = Math.exp(-s.drag * dt); s.vx *= d; s.vz *= d; s.vy = s.vy * d - s.grav * dt;
        const fl = s.flut ? Math.sin(s.life * 7 + s.ph) * s.flut : 0;
        P[i * 3] += (s.vx + fl) * dt; P[i * 3 + 1] += s.vy * dt; P[i * 3 + 2] += (s.vz + fl * .6) * dt; R[i] += s.spin * dt;
        const u = s.life / s.max;
        S[i] = s.s0 * Math.min(1, s.life * 14) * (1 + s.grow * u); A[i] = u < s.fade ? 1 : 1 - (u - s.fade) / (1 - s.fade || 1);
        if (s.flut) A[i] = Math.min(A[i], 1);
      }
      geo.setDrawRange(0, n);
      if (n) { aP.needsUpdate = aC.needsUpdate = aS.needsUpdate = aA.needsUpdate = aR.needsUpdate = aK.needsUpdate = true; }
      pts.visible = n > 0;
    },
    count: () => n,
    dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); tex.dispose(); for (const r of rings) { scene.remove(r.m); r.m.material.dispose(); } ringGeo.dispose(); },
  };
  return api;
}

// ---------- camera shake ----------
export function shaker() {
  let amt = 0, t = 0; const off = new THREE.Vector3();
  return {
    kick(a = .3) { amt = Math.max(amt, a); },
    apply(camera, dt) { t += dt; amt *= Math.exp(-dt * 7); if (amt < .002) { amt = 0; return; }
      off.set(Math.sin(t * 61), Math.sin(t * 47 + 1), Math.sin(t * 53 + 2)).multiplyScalar(amt); camera.position.add(off); },
  };
}

// ---------- hover and selection rims ----------
// show(root): wraps the first outline hull under root in a glowing copy. Pass null to clear.
export function rim(color = '#ffffff', thick = .05) {
  const uT = { value: thick };
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 1, depthWrite: true });
  m.onBeforeCompile = sh => { sh.uniforms.uT = uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * uT;'); };
  m.customProgramCacheKey = () => 'scrim';
  let glow = null, on = null;
  return {
    show(root, t = thick) {
      if (root === on) return; if (glow) { glow.parent?.remove(glow); glow = null; } on = root; if (!root) return;
      let hull = null; root.traverse(o => { if (!hull && o.userData.ink && !o.userData.rim) hull = o; }); if (!hull) return;
      glow = new THREE.Mesh(hull.geometry, m); glow.userData = { rim: true, noInk: true }; glow.position.copy(hull.position); glow.quaternion.copy(hull.quaternion); glow.scale.copy(hull.scale);
      uT.value = t / (hull.getWorldScale(new THREE.Vector3()).x || 1); hull.parent.add(glow);
    },
    pulse(T, base = 1) { m.opacity = base * (.75 + Math.sin(T * 6) * .25); },
    get on() { return on; },
    dispose() { if (glow) glow.parent?.remove(glow); m.dispose(); },
  };
}

// Sky friends (cosmetics.js kind ik): something that flies round your isle and your Pet Farm island. They replaced the
// bought skies on 2026-11-27 (Kuba): a sky of its own clashed with the real-time sky and hid the weather, which signals the
// Pet Farm bonuses. A sky friend never touches the sky's colour, the light or the weather; it only flies through them.
// The indexes match the old skies, so whoever bought a sky now owns the friend at the same place (append only).
//
//   skyFriend(ik, { s, pet })  s = size of the isle (1 = the profile isle, radius 3.3); pet = { petModel, wiggle, disposeModel }, if already loaded
//     ->  { root, tick(T, night), dispose() }  or null for none. Built round the origin, the isle's top at y 0.
import * as THREE from 'three';
import { toonify, disposeToon, put, ico, flat, hash } from './scenery3d.js';

const PI = Math.PI;
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const box = (p, w, h, d, c, x = 0, y = 0, z = 0) => put(p, new THREE.BoxGeometry(w, h, d), flat(c), x, y, z);
const unlit = o => { o.traverse(m => { if (m.isMesh) m.userData.noInk = true; }); return o; };

// A loop round the isle, a little flattened towards the camera like the floating pieces: a, r, y, depth
const loop = (g, a, r, y, d = .6) => { g.position.set(Math.cos(a) * r, y, Math.sin(a) * r * d); };

const FRIENDS = [null,
  // 1 Kite: a diamond kite on a string tied to the isle's edge, swaying in the wind, with bows on its tail
  (root, s, ticks) => {
    const k = new THREE.Group(); root.add(k);
    const sh = new THREE.Shape(); sh.moveTo(0, .62); sh.lineTo(.42, 0); sh.lineTo(0, -.78); sh.lineTo(-.42, 0); sh.closePath();
    const sail = new THREE.ExtrudeGeometry(sh, { depth: .04, bevelEnabled: false }); sail.translate(0, 0, -.02);
    put(k, sail, flat('#ff7a59'));
    const half = new THREE.Shape(); half.moveTo(0, .62); half.lineTo(.42, 0); half.lineTo(0, 0); half.closePath(); half.moveTo(0, 0); half.lineTo(-.42, 0); half.lineTo(0, -.78); half.closePath();
    put(k, new THREE.ShapeGeometry(half), flat('#ffc93c'), 0, 0, .025);
    box(k, .03, 1.38, .05, '#8a5a3a', 0, -.08, .04); box(k, .84, .03, .05, '#8a5a3a', 0, 0, .04);
    const tail = []; for (let i = 0; i < 4; i++) { const b = new THREE.Group(); k.add(b); for (const sx of [-1, 1]) { const m = put(b, new THREE.ConeGeometry(.09, .18, 4), flat(['#7ed3b2', '#8a98ff', '#ff9fb8', '#ffc93c'][i]), sx * .08, 0, 0); m.rotation.z = sx * PI / 2; } tail.push(b); }
    toonify(k, .025); k.scale.setScalar(s * 1.1);
    const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .8 })); root.add(str);
    const anchor = new THREE.Vector3(-2.6 * s, .2 * s, .9 * s), P = str.geometry.attributes.position;
    ticks.push(T => {
      k.position.set((-4.6 + Math.sin(T * .5) * .5) * s, (3.6 + Math.sin(T * .8) * .3) * s, (-1.2 + Math.sin(T * .37) * .3) * s);
      k.rotation.set(Math.sin(T * .9) * .08, Math.sin(T * .3) * .25, -.35 + Math.sin(T * 1.1) * .12);
      tail.forEach((b, i) => b.position.set(Math.sin(T * 2.2 - i * .9) * .12 * (i + 1), -.95 - i * .26, 0));
      P.setXYZ(0, anchor.x, anchor.y, anchor.z); P.setXYZ(1, k.position.x + .1 * s, k.position.y - .55 * s, k.position.z); P.needsUpdate = true;
    });
  },
  // 2 Paper planes: three folded planes looping round the isle, dipping and climbing
  (root, s, ticks, pet, pic) => {
    const geo = new THREE.BufferGeometry(); // a dart folded from one sheet: two wings and a keel
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .5, -.32, .04, -.4, 0, 0, -.32, 0, 0, .5, 0, 0, -.32, .32, .04, -.4, 0, 0, .5, 0, -.12, -.36, 0, 0, -.32], 3)); geo.computeVertexNormals();
    const planes = ['#ffffff', '#cfe9ff', '#ffe1ea'].map((c, i) => { const g = new THREE.Group(); root.add(g); const m = put(g, geo, flat(c, { side: THREE.DoubleSide })); m.scale.setScalar(2); toonify(g, .025); g.scale.setScalar(s); return [g, i]; });
    const at = new THREE.Vector3();
    ticks.push(T => { for (const [g, i] of planes) { const a = T * (.32 + i * .05) + i * 2.1, r = (pic ? 1 + i * .3 : 4.4 + i * .5) * s, y = (2.6 + i * (pic ? .6 : .45) + Math.sin(T * .9 + i * 2) * .5) * s;
      loop(g, a, r, y); loop({ position: at }, a + .08, r, y + Math.cos(T * .9 + i * 2) * .04 * s); g.lookAt(at); g.rotateZ(.5); } });
  },
  // 3 Airship: a round little blimp with fins, a gondola and a spinning propeller, slowly circling high up
  (root, s, ticks) => {
    const g = new THREE.Group(); root.add(g); const b = new THREE.Group(); g.add(b);
    put(b, new THREE.SphereGeometry(.55, 14, 10), flat('#ff9a6a')).scale.set(1, 1, 1.9);
    for (const z of [-.5, 0, .5]) put(b, new THREE.TorusGeometry(.56, .03, 4, 18), flat('#fff3df'), 0, 0, z).scale.set(1, 1, 1);
    for (const r of [0, PI / 2, PI, PI * 1.5]) { const f = box(b, .04, .42, .36, '#5ba4e6', 0, 0, -.95); f.position.set(Math.sin(r) * .2, Math.cos(r) * .2, -.95); f.rotation.z = r; }
    box(b, .32, .2, .56, '#8a5a3a', 0, -.68, .05); box(b, .03, .2, .03, '#5a3a2a', .12, -.5, .2); box(b, .03, .2, .03, '#5a3a2a', -.12, -.5, -.1);
    const prop = new THREE.Group(); prop.position.set(0, -.68, -.3); b.add(prop); box(prop, .06, .46, .02, '#fff3df'); box(prop, .46, .06, .02, '#fff3df');
    toonify(b, .03); g.scale.setScalar(s * .95);
    ticks.push(T => { const a = T * .12 + 1; loop(g, a, 5 * s, (4 + Math.sin(T * .5) * .2) * s, .5); g.rotation.set(0, -a, Math.sin(T * .7) * .05); prop.rotation.z = T * 12; });
  },
  // 4 Bubbles: soap bubbles drifting up from the isle with a shimmer, popping high up and starting again
  (root, s, ticks, pet, pic) => {
    const geo = new THREE.SphereGeometry(.36, 16, 12), hi = new THREE.CircleGeometry(.09, 8), cols = ['#ffb3d9', '#b3e1ff', '#c9ffd8', '#fff1b3', '#d9c2ff'];
    const B = Array.from({ length: 12 }, (_, i) => { const g = new THREE.Group(); root.add(g);
      const m = put(g, geo, new THREE.MeshBasicMaterial({ color: cols[i % 5], transparent: true, opacity: .45, depthWrite: false })); m.renderOrder = 2;
      const rim = put(g, geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .6, side: THREE.BackSide, depthWrite: false })); rim.scale.setScalar(1.04);
      const h = put(g, hi, basic('#ffffff', { transparent: true, opacity: .85, depthWrite: false }), -.1, .12, .26); unlit(g);
      return { g, h, x: (hash(i, 3) - .5) * (pic ? 3 : 7), z: (hash(i, 5) - .5) * 3, v: .35 + hash(i, 7) * .3, k: .55 + hash(i, 9) * .7, t0: hash(i, 11) * 9 }; });
    const H = pic ? 3.5 : 7;
    ticks.push((T, n, cam) => { for (const b of B) { const u = ((T * b.v + b.t0) % H) / H, y = -1 + u * H;
      b.g.position.set((b.x + Math.sin(T * .8 + b.t0) * .5) * s, y * s, b.z * s); const pop = u > .92 ? 1 - (u - .92) / .08 : Math.min(1, u * 8);
      b.g.scale.setScalar(b.k * s * pop); if (cam) b.h.parent.quaternion.copy(cam.quaternion); } });
  },
  // 5 Sky lanterns: paper lanterns rising slowly round the isle, each with a warm glow (brighter after dark)
  (root, s, ticks, pet, pic) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gl = c.createRadialGradient(32, 32, 3, 32, 32, 32);
    gl.addColorStop(0, 'rgba(255,214,122,.9)'); gl.addColorStop(.45, 'rgba(255,176,74,.3)'); gl.addColorStop(1, 'rgba(255,176,74,0)'); c.fillStyle = gl; c.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv), glowM = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }), cols = ['#ff9a3c', '#ffc24a', '#ff6f61', '#ffb05a'];
    const H = pic ? 3 : 8, L = Array.from({ length: 7 }, (_, i) => { const g = new THREE.Group(); root.add(g);
      put(g, new THREE.CylinderGeometry(.2, .14, .42, 6), basic(cols[i % 4])); put(g, new THREE.CylinderGeometry(.21, .21, .05, 6), basic('#7a4a2a'), 0, .23, 0);
      const fl = put(g, new THREE.SphereGeometry(.06, 6, 4), basic('#fff6c8'), 0, -.24, 0); unlit(g);
      const sp = new THREE.Sprite(glowM); sp.scale.setScalar(1.3); g.add(sp);
      const a = i / 7 * 6.283 + hash(i, 3), r = pic ? .6 + hash(i, 5) * .9 : 3.6 + hash(i, 5) * 1.8; return { g, sp, fl, a, r, v: .22 + hash(i, 7) * .15, t0: hash(i, 9) * H }; });
    ticks.push((T, n = 0) => { glowM.opacity = .45 + .55 * n; for (const l of L) { const y = (l.t0 + T * l.v) % H, a = l.a + T * .05;
      l.g.position.set(Math.cos(a) * l.r * s, (y - 1.5) * s, Math.sin(a) * l.r * .6 * s); l.g.scale.setScalar(s * (y > H - 1 ? H - y : Math.min(1, y * 2)));
      l.g.rotation.y = T * .3 + l.a; l.fl.scale.setScalar(.8 + Math.sin(T * 9 + l.a * 5) * .2); } });
  },
  // 6 Toy sleigh (winter): a red wooden sleigh with a gift pile, gliding round the isle and leaving a trail of sparkles
  (root, s, ticks) => {
    const g = new THREE.Group(); root.add(g); const b = new THREE.Group(); g.add(b);
    box(b, .62, .26, 1.05, '#d8443a', 0, .2, 0); box(b, .62, .3, .16, '#d8443a', 0, .42, -.48); box(b, .66, .05, 1.1, '#ffc93c', 0, .34, 0);
    for (const x of [-.27, .27]) { box(b, .05, .05, 1.2, '#ffc93c', x, -.02, .02); const tip = put(b, new THREE.TorusGeometry(.12, .025, 4, 10, PI), flat('#ffc93c'), x, .1, .62); tip.rotation.y = PI / 2; box(b, .04, .18, .04, '#ffc93c', x, .08, -.3); box(b, .04, .18, .04, '#ffc93c', x, .08, .3); }
    box(b, .3, .26, .3, '#7ed3b2', -.08, .52, -.12); box(b, .22, .2, .22, '#8a98ff', .14, .48, .18); box(b, .34, .05, .06, '#ffffff', -.08, .66, -.12);
    toonify(b, .03); g.scale.setScalar(s * 1.45);
    const spark = Array.from({ length: 10 }, (_, i) => { const m = put(root, new THREE.OctahedronGeometry(.06, 0), basic(i % 2 ? '#fff6c8' : '#cfe9ff', { transparent: true })); m.userData.noInk = true; return m; });
    ticks.push(T => { const a = T * .3, r = 4.6 * s, y = (3 + Math.sin(T * .9) * .35) * s; loop(g, a, r, y); g.rotation.set(Math.cos(T * .9) * .1, -a, -.18);
      spark.forEach((m, i) => { const d = (i + 1) * .09, u = ((T * 3 + i) % 3) / 3; loop(m, a - d, r, y + (.1 - u * .4) * s); m.scale.setScalar(s * (1 - u)); m.material.opacity = 1 - u; m.rotation.y = T * 3 + i; }); });
  },
  // 7 Wattbat: a Pet Farm Wattbat (grown up) flapping round the isle, sparks crackling off its ears now and then
  (root, s, ticks, pet, pic) => {
    const g = new THREE.Group(); root.add(g); let bat = null, P = null, gone = false;
    const add = p => { if (gone) return; P = p; bat = p.petModel('wattbat', 2); bat.scale.multiplyScalar(.75); g.add(bat); };
    if (pet) add(pet); else Promise.all([import('./games/farm/pets3d.js'), import('./games/farm/models.js')]).then(([a, b]) => add({ ...a, ...b })).catch(() => {});
    g.scale.setScalar(s);
    ticks.push(T => { const a = -T * .38 + 2; loop(g, a, 4.4 * s, (2.9 + Math.sin(T * 5) * .12 + Math.sin(T * .6) * .4) * s); g.rotation.set(0, pic ? .5 : -a + PI, Math.sin(T * .38) * .15);
      if (bat) { bat.rotation.x = Math.sin(T * 5) * .08; P.wiggle(bat, T, 1); } });
    return () => { if (bat) { g.remove(bat); P.disposeModel(bat); } gone = true; };
  },
  // 8 Hot-air balloons (spring): two striped balloons drifting past the isle, bobbing gently
  (root, s, ticks, pet, pic) => {
    const B = [['#ff8fab', '#ffd84a', pic ? -1.1 : -4.6, 3.4, 1.15, 0], ['#7fc8ee', '#ffffff', pic ? 1.1 : 4.4, 2.6, .9, 2]].map(([a, c2, x, y, k, ph]) => { const g = new THREE.Group(); root.add(g);
      const env = put(g, new THREE.SphereGeometry(.7, 12, 10), flat(a)); env.scale.set(1, 1.15, 1);
      for (const r of [0, PI / 3, PI * 2 / 3]) { const st = put(g, new THREE.TorusGeometry(.705, .07, 4, 20), flat(c2)); st.scale.set(1, 1.15, 1); st.rotation.y = r; }
      put(g, new THREE.ConeGeometry(.32, .4, 8), flat(a), 0, -.86, 0).rotation.x = PI;
      box(g, .3, .24, .3, '#a86a42', 0, -1.34, 0); for (const sx of [-.12, .12]) box(g, .02, .34, .02, '#5a3a2a', sx, -1.08, 0);
      toonify(g, .03); g.scale.setScalar(k * s); return [g, x, y, ph]; });
    ticks.push(T => { for (const [g, x, y, ph] of B) { g.position.set((x + Math.sin(T * .12 + ph) * .8) * s, (y + Math.sin(T * .5 + ph) * .22) * s, (-1.4 + Math.cos(T * .1 + ph) * .5) * s); g.rotation.y = T * .1 + ph; } });
  },
];
export const FRIEND_COUNT = FRIENDS.length;

export function skyFriend(ik, { s = 1, pet = null, pic = false } = {}) { // pic: bunched up for a Wardrobe picture
  const make = FRIENDS[ik | 0]; if (!make) return null;
  const root = new THREE.Group(), ticks = [], extra = make(root, s, ticks, pet, pic);
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { root, tick: (T, night = 0, cam = null) => { for (const f of ticks) f(T, night, cam); },
    dispose: () => { extra?.(); root.traverse(o => { if (o.isSprite) o.material.map?.dispose(); }); root.removeFromParent(); disposeToon(root); } };
}

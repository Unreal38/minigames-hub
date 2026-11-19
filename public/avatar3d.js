// 3D chibi avatar (three.js), shared by every 3D minigame. Purely visual.
//   avatar3d(color, av)  -> THREE.Group facing +Z. Seat height is y = -0.76, the top of the head is about y = 2.1.
//                           userData = { head, eyes, body, arms } for animation.
//   animateAvatar(g, T, { seed, active, hop, look, nod })  idle sway, blinking, breathing and a squashy hop;
//                           look turns the head (radians), nod dips it (0..1).
//   disposeAvatar(g)     frees its materials (geometries are shared between avatars).
import * as THREE from 'three';
import { SKINS, HAIR_COLS, cleanAv } from './avatar.js';

// ---------- shared geometry ----------
const geos = new Map();
const geo = (type, ...a) => {
  const k = type + a.join();
  let g = geos.get(k);
  if (!g) geos.set(k, g = new THREE[type + 'Geometry'](...a));
  return g;
};
const sph = r => geo('Sphere', r, 20, 16);

// Pear-shaped torso profile [radius, y], smoothed. Outfit pieces hug it through rAt().
const TORSO = new THREE.SplineCurve([[0, -.84], [.34, -.83], [.56, -.74], [.67, -.52], [.7, -.26], [.67, .02], [.6, .3], [.5, .55], [.41, .74], [.36, .86], [.28, .94], [0, .97]]
  .map(([x, y]) => new THREE.Vector2(x, y))).getPoints(30).map(p => (p.x = Math.max(0, p.x), p));
const rAt = y => {
  for (let i = 1; i < TORSO.length; i++) {
    const a = TORSO[i - 1], b = TORSO[i];
    if (y <= b.y) return a.x + (b.x - a.x) * Math.max(0, (y - a.y) / (b.y - a.y || 1));
  }
  return 0;
};
const torsoGeo = () => geos.get('torso') || (geos.set('torso', new THREE.LatheGeometry(TORSO, 28)), geos.get('torso'));
// A strip of cloth lying on the torso between two heights (optionally only part of the way round; 0 = front).
const band = (y0, y1, off = .012, phi0 = 0, len = Math.PI * 2) => {
  const k = 'band' + [y0, y1, off, phi0, len];
  if (!geos.has(k)) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const y = y0 + (y1 - y0) * i / 8; pts.push(new THREE.Vector2(rAt(y) + off, y)); }
    geos.set(k, new THREE.LatheGeometry(pts, 28, phi0, len));
  }
  return geos.get(k);
};

const shade = (c, k) => { const o = new THREE.Color(c); return k < 1 ? o.multiplyScalar(k) : o.lerp(new THREE.Color('#ffffff'), k - 1); };

export function avatar3d(color, avIn) {
  const [sk, hair, hc, acc, ey, mo, fit, det] = cleanAv(avIn);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...o });
  const g = new THREE.Group(), hg = new THREE.Group(), bg = new THREE.Group(), eyes = [], arms = [];
  hg.position.y = 1.42; hg.scale.setScalar(1.16); bg.scale.setScalar(.9); // chibi: big head, small body
  const body = M(color, { roughness: .82 }), trim = M(shade(color, 1.35), { roughness: .8 }), pants = M(shade(color, .55), { roughness: .85 });
  const skin = M(SKINS[sk], { roughness: .7 }), skinD = M(shade(SKINS[sk], .86), { roughness: .7 });
  const hm = M(HAIR_COLS[hc], { roughness: .5 }), brow = M(new THREE.Color(HAIR_COLS[hc]).lerp(new THREE.Color('#2a1712'), .45), { roughness: .6 });
  const white = M('#ffffff', { roughness: .55 }), cream = M('#fff4e2', { roughness: .85 });
  const ink = M(sk >= 3 ? '#1c0f0a' : '#2a1712', { roughness: .18 }), shoe = M('#4a2c20', { roughness: .45 });
  const red = M('#e5543b'), gold = M('#ffc93c', { roughness: .28, metalness: .6 }), pink = M('#ff5d8f', { roughness: .55 }), rose = M('#ff8fab'), dark = M('#8a2f2f');
  const put = (grp, gm, mat, x, y, z) => { const m = new THREE.Mesh(gm, mat); m.position.set(x, y, z); grp.add(m); return m; };
  const add = (gm, mat, x, y, z) => put(hg, gm, mat, x, y, z);
  g.add(bg, hg);

  // ----- body -----
  put(bg, torsoGeo(), body, 0, 0, 0);
  put(bg, geo('Torus', .36, .075, 10, 24), trim, 0, .84, 0).rotation.x = Math.PI / 2; // collar
  for (const s of [-1, 1]) {
    // arms hang from a shoulder pivot so they can wave
    const arm = new THREE.Group(); arm.position.set(s * .55, .58, .06); arm.rotation.set(-1.1, 0, s * .25);
    put(arm, geo('Capsule', .15, .4, 4, 12), body, 0, -.28, 0);
    put(arm, geo('Torus', .135, .045, 8, 16), trim, 0, -.52, 0).rotation.x = Math.PI / 2;
    put(arm, sph(.155), skin, 0, -.66, 0);
    put(arm, sph(.06), skin, -s * .12, -.63, .06);
    arm.userData.rx = -1.1; bg.add(arm); arms.push(arm);
    // legs dangle off the seat, with little shoes
    put(bg, geo('Capsule', .19, .34, 4, 12), pants, s * .27, -.66, .36).rotation.x = 1.2;
    put(bg, sph(.2), shoe, s * .27, -.8, .72).scale.set(1, .85, 1.35);
    put(bg, sph(.2), cream, s * .27, -.9, .72).scale.set(1.02, .3, 1.38);
  }
  // ----- outfit -----
  if (fit === 0) for (const y of [.5, .22, -.06]) put(bg, sph(.05), trim, 0, y, rAt(y) + .012).scale.z = .5;
  if (fit === 1) {
    const ap = M('#ffffff', { roughness: .7, side: THREE.DoubleSide });
    put(bg, band(-.66, .2, .014, -.85, 1.7), ap, 0, 0, 0); put(bg, band(.2, .66, .014, -.42, .84), ap, 0, 0, 0);
    put(bg, band(.12, .22, .022), ap, 0, 0, 0);
    put(bg, band(-.34, -.08, .028, -.3, .6), M(shade('#ffffff', .88), { roughness: .7, side: THREE.DoubleSide }), 0, 0, 0);
  }
  if (fit === 2) {
    put(bg, geo('Torus', .42, .14, 10, 24), cream, 0, .82, 0).rotation.x = Math.PI / 2;
    const tail = put(bg, geo('Capsule', .11, .34, 4, 10), cream, .22, .5, .5); tail.rotation.set(-.3, 0, -.12); tail.scale.z = .55;
    put(bg, geo('Capsule', .112, .04, 4, 10), red, .2, .33, .555).scale.z = .55;
  }
  if (fit === 3) for (const y of [.44, .16, -.12, -.4]) put(bg, band(y - .05, y + .05, .008), white, 0, 0, 0);
  if (fit === 4) {
    for (const s of [-1, 1]) put(bg, geo('Cone', .11, .22, 12), red, s * .12, .7, rAt(.7) + .06).rotation.z = s * Math.PI / 2;
    put(bg, sph(.055), gold, 0, .7, rAt(.7) + .08);
  }

  // ----- head -----
  add(geo('Sphere', .6, 32, 24), skin, 0, 0, 0);
  for (const s of [-1, 1]) { add(sph(.13), skin, s * .58, -.04, 0).scale.set(.7, 1, .9); add(sph(.07), skinD, s * .63, -.04, .02).scale.set(.5, 1, .8); }
  add(sph(.04), skinD, 0, -.055, .595).scale.set(1.1, .8, .7); // button nose
  const hat = acc === 1 || acc === 5;
  // hair
  const cap = () => { add(geo('Sphere', .63, 28, 14, 0, Math.PI * 2, 0, Math.PI * .42), hm, 0, .02, 0).rotation.x = -.35; };
  const fringe = side => { // soft tufts over the forehead; side sweeps them
    for (const [x, y, z, w] of side ? [[-.3, .3, .43, 1], [-.04, .37, .5, 1.25], [.27, .4, .43, .9]] : [[-.28, .33, .44, 1], [0, .37, .5, 1.1], [.28, .33, .44, 1]]) {
      const t = add(sph(.2), hm, x, y, z); t.scale.set(w, .5, .5); t.rotation.set(-.5, x * .9, side ? .25 : -x * .8);
    }
  };
  if (![3, 5, 9].includes(hair)) cap();
  if ([0, 2, 4, 6, 7].includes(hair)) fringe(false);
  if (hair === 1) fringe(true);
  if (hair === 0 && !hat) { add(sph(.23), hm, 0, .66, -.08); add(geo('Torus', .13, .035, 8, 16), rose, 0, .5, -.08).rotation.x = Math.PI / 2; }
  if (hair === 2) for (const s of [-1, 1]) { add(sph(.24), hm, s * .7, -.04, -.05).scale.set(1, 1.15, 1); add(geo('Torus', .09, .04, 8, 14), rose, s * .6, .14, -.05).rotation.set(0, Math.PI / 2, s * .6); }
  if (hair === 3) {
    cap();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, c = add(geo('Cone', .18, .44, 10), hm, Math.sin(a) * .3, .6, Math.cos(a) * .27 - .08);
      c.rotation.set(Math.cos(a) * .6, 0, -Math.sin(a) * .6);
    }
    add(geo('Cone', .18, .48, 10), hm, 0, .72, -.08);
  }
  if (hair === 4) add(sph(.64), hm, 0, -.3, -.2).scale.set(1.02, 1.25, .8);
  if (hair === 6) add(sph(.66), hm, 0, -.12, -.14).scale.set(1.06, .95, .86);
  if (hair === 7) { add(sph(.2), hm, 0, .2, -.66); add(geo('Torus', .1, .04, 8, 14), rose, 0, .1, -.72).rotation.x = .9; add(sph(.2), hm, 0, -.22, -.84).scale.set(.9, 2, .9); }
  if (hair === 8) for (let i = 0; i < 22; i++) {
    const a = i * 2.4, e = .2 + (i % 6) * .21;
    add(sph(.19), hm, Math.sin(a) * Math.sin(e) * .58, Math.cos(e) * .58 + .04, Math.cos(a) * Math.sin(e) * .58 - .1);
  }
  if (hair === 9) for (let i = 0; i < 6; i++) add(geo('Cone', .13, .46, 10), hm, 0, .56 + Math.sin((i + .5) / 6 * Math.PI) * .18, .38 - i * .17).rotation.x = .55 - i * .24;
  // face
  const blushM = new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: .6 });
  const arcGeo = geo('Torus', .075, .022, 8, 14, Math.PI);
  for (const s of [-1, 1]) {
    add(geo('Circle', .1, 20), blushM, s * .34, -.14, .5).rotation.y = s * .55;
    const style = ey === 4 ? (s > 0 ? 1 : 0) : ey;
    if (style === 1) add(arcGeo, ink, s * .2, -.01, .56);
    else if (style === 2) add(arcGeo, ink, s * .2, .05, .56).rotation.z = Math.PI;
    else {
      const big = style === 3;
      const e = add(sph(big ? .11 : .088), ink, s * .2, .02, .54); e.scale.set(1, 1.25, .6);
      const hl = add(sph(big ? .034 : .026), white, s * .2 + .028, .07, .582); hl.scale.z = .5;
      const hl2 = add(sph(big ? .02 : .013), white, s * .2 - .028, -.03, .578); hl2.scale.z = .5;
      eyes.push(e, hl, hl2);
    }
    if (acc !== 8) add(geo('Capsule', .018, .09, 3, 6), brow, s * .2, .2, .548).rotation.set(0, 0, Math.PI / 2 + s * (ey === 2 ? -.22 : .12));
    if (det === 1) for (const [dx, dy] of [[0, 0], [.07, -.05], [-.05, -.07]]) add(sph(.018), M('#9c5a3c'), s * (.32 + dx), -.06 + dy, .5 - Math.abs(dx) * .3);
  }
  const mz = det === 3 ? .645 : .58;
  const smileM = () => { add(arcGeo, ink, 0, -.12, mz).rotation.z = Math.PI; };
  if (mo === 0) smileM();
  if (mo === 1) { add(sph(.08), dark, 0, -.17, mz - .03).scale.set(1, .9, .4); add(sph(.045), rose, 0, -.2, mz - .012).scale.set(1, .6, .4); }
  if (mo === 2) for (const s of [-1, 1]) add(geo('Torus', .04, .018, 6, 10, Math.PI), ink, s * .04, -.13, mz).rotation.z = Math.PI;
  if (mo === 3) add(geo('Torus', .035, .018, 6, 12), ink, 0, -.16, mz);
  if (mo === 4) { smileM(); add(sph(.04), M('#ff7a8a'), 0, -.2, mz).scale.set(1, 1.2, .5); }
  if (det === 2) for (const s of [-1, 1]) add(sph(.075), hm, s * .085, -.08, .585).scale.set(1.5, .55, .5);
  if (det === 3) add(geo('Sphere', .625, 24, 12, Math.PI * .12, Math.PI * .76, Math.PI * .56, Math.PI * .44), hm, 0, 0, 0);
  // extras
  if (acc === 1) {
    add(geo('Cylinder', .4, .37, .32, 24), white, 0, .62, -.04);
    add(sph(.4), white, 0, .98, -.04).scale.set(1, .8, 1);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(sph(.27), white, Math.sin(a) * .27, .93, Math.cos(a) * .27 - .04); }
  }
  if (acc === 2 || acc === 8) {
    const lens = acc === 8 ? M('#1c0f0a', { roughness: .08, metalness: .4 }) : new THREE.MeshStandardMaterial({ color: '#dff3ff', roughness: .05, transparent: true, opacity: .28 });
    for (const s of [-1, 1]) {
      add(geo('Torus', .12, .022, 8, 24), ink, s * .2, .02, .6);
      add(geo('Circle', .12, 24), lens, s * .2, .02, .6);
      add(geo('Cylinder', .016, .016, .4, 6), ink, s * .43, .03, .37).rotation.set(Math.PI / 2, 0, s * .62);
    }
    add(geo('Cylinder', .02, .02, .16, 6), ink, 0, .02, .62).rotation.z = Math.PI / 2;
  }
  if (acc === 3) {
    for (const s of [-1, 1]) add(geo('Cone', .15, .26, 14), pink, .3 + s * .15, .56, .2).rotation.z = s * Math.PI / 2;
    add(sph(.075), rose, .3, .56, .22);
  }
  if (acc === 4) for (const s of [-1, 1]) {
    add(geo('Cone', .17, .36, 14), hair === 5 ? body : hm, s * .36, .58, 0).rotation.z = -s * .35;
    const inner = add(geo('Cone', .1, .24, 12), M('#ffb3c4'), s * .36, .56, .06); inner.rotation.z = -s * .35; inner.scale.z = .5;
  }
  if (acc === 5) {
    add(geo('Cylinder', .36, .33, .18, 24), gold, 0, .6, -.04);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
      add(geo('Cone', .08, .2, 10), gold, x * .31, .78, z * .31 - .04); add(sph(.035), gold, x * .31, .89, z * .31 - .04);
      add(sph(.035), i % 2 ? M('#7ed3b2', { roughness: .15 }) : M('#e5543b', { roughness: .15 }), x * .355, .6, z * .355 - .04);
    }
  }
  if (acc === 6) {
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(sph(.075), rose, .36 + Math.cos(a) * .09, .44 + Math.sin(a) * .09, .32).scale.z = .6; }
    add(sph(.06), gold, .36, .44, .35);
  }
  if (acc === 7) {
    add(geo('Torus', .65, .045, 8, 32, Math.PI), ink, 0, 0, 0);
    for (const s of [-1, 1]) {
      add(geo('Cylinder', .19, .19, .14, 20), body, s * .64, -.02, 0).rotation.z = Math.PI / 2;
      add(geo('Cylinder', .15, .15, .05, 20), ink, s * .57, -.02, 0).rotation.z = Math.PI / 2;
    }
  }
  g.traverse(m => { if (m.isMesh && !m.material.transparent) m.castShadow = true; });
  for (const e of eyes) e.userData.sy = e.scale.y;
  g.userData = { head: hg, eyes, body: bg, arms };
  return g;
}

// Call every frame. T is seconds; seed keeps avatars out of sync; hop runs 1 -> 0 during a happy bounce.
export function animateAvatar(g, T, { seed = 0, active = false, hop = 0, look = 0, nod = 0 } = {}) {
  const u = g.userData, ph = (T + seed * 1.37) % 3.8;
  u.head.rotation.z = Math.sin(T * 1.3 + seed) * .08;
  u.head.rotation.x = Math.sin(T * .9 + seed * 2) * .04 - hop * .18 + nod * .4;
  u.head.rotation.y = Math.sin(T * .45 + seed * 3) * .1 + look;
  const blink = ph < .13 || (seed % 2 && ph > .3 && ph < .4) ? .12 : 1;
  for (const e of u.eyes) e.scale.y = e.userData.sy * blink;
  if (u.body) u.body.scale.y = .9 * (1 + Math.sin(T * 1.8 + seed) * .012);
  u.arms?.forEach((a, i) => {
    a.rotation.x = a.userData.rx + Math.sin(T * 1.5 + seed + i * 2) * .05 + (active ? Math.sin(T * 6 + i * Math.PI) * .14 : 0) - Math.sin(hop * Math.PI) * 1.3;
  });
  const k = Math.sin(hop * Math.PI * 4) * .07 * hop; // squash and stretch
  g.scale.set(1 - k * .6, 1 + k, 1 - k * .6);
}

export function disposeAvatar(g) {
  const seen = new Set();
  g.traverse(m => { if (m.isMesh && !seen.has(m.material)) { seen.add(m.material); m.material.dispose(); } });
}

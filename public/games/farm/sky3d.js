// The bought sky (cosmetics ik) on the Pet Farm, pinned to the world rather than to the camera: turn the view and the
// sun stays where it set, the rainbow keeps arching over the same side of the island, and the aurora rings the farm.
// Everything is unlit, so it reads the same by day and by night (the farm's own clock still sets the light).
//   worldSky(ik, n)  n = the farm's size in tiles  ->  { root, tick(T, camera, { night, dusk, clear, wind, bow }), dispose() }  or null
// It blends with the farm's clock and weather: each sky is strongest at its own time (night skies at night, sunset at dusk,
// the rainbow by day) and faint the rest of the day; clouds fade it and rain all but hides it; wind hurries it along.
import * as THREE from 'three';

const PI = Math.PI;
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, fog: false, depthWrite: !o.transparent, ...o });
const SIDE = .6 + PI; // where the sun sets and the rainbow stands: straight ahead from the starting view

// soft round glow, for the sun's halo and the moon's
function glowTex(inner = .2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), g = c.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sprite = (map, color, size, opacity = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, fog: false })); s.scale.setScalar(size); return s; };
// a long flat cloud made of a few squashed puffs
function longCloud(root, x, y, z, w, col) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.lookAt(0, y, 0); root.add(g);
  for (const [dx, dy, k] of [[0, 0, 1], [.32, .25, .6], [-.34, .18, .7], [.1, -.15, .8]]) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), basic(col)); m.position.set(dx * w, dy * w * .25, 0); m.scale.set(w * k * .6, w * .16 * k, w * .3 * k); g.add(m); }
  return g;
}
function starField(root, n, rMin, rMax, ticks) {
  const sets = [0, 1].map(k => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = hash(i, 3 + k) * 6.283, e = -.5 + hash(i, 5 + k) * 1.9, r = rMin + hash(i, 7 + k) * (rMax - rMin); pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: k ? '#fff3c4' : '#ffffff', size: k ? 3.2 : 2.3, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })); root.add(p); return p;
  });
  ticks.push(T => { sets[0].material.opacity = .7 + Math.sin(T * 1.7) * .25; sets[1].material.opacity = .7 + Math.cos(T * 1.3) * .25; });
}

export function worldSky(ik, n = 10) {
  ik |= 0; if (ik < 1 || ik > 4) return null;
  const root = new THREE.Group(), ticks = [], R = n / 2 + 2, maps = [], tex = t => { maps.push(t); return t; };
  const dir = (a, d, y) => new THREE.Vector3(Math.sin(a) * d, y, Math.cos(a) * d);
  if (ik === 1) { // sunset: a big low sun sinking into the cloud sea on one side, warm long clouds all round
    const at = dir(SIDE, R * 5.5, -R * 2.2), halo = tex(glowTex(.05));
    const sun = new THREE.Mesh(new THREE.CircleGeometry(R * .95, 40), basic('#fff1b8')); sun.position.copy(at); root.add(sun);
    const glow = sprite(halo, '#ffc27a', R * 5.5, .75); glow.position.copy(at); root.add(glow);
    const glow2 = sprite(halo, '#ff7a6a', R * 11, .35); glow2.position.copy(at); glow2.position.y -= R * .6; root.add(glow2);
    const cl = [];
    for (let i = 0; i < 9; i++) { const a = SIDE + (i - 4) * .5 + hash(i, 2) * .2, d = R * (3.2 + hash(i, 3) * 2), y = -R * (1.2 + hash(i, 4) * 1.1);
      cl.push([longCloud(root, Math.sin(a) * d, y, Math.cos(a) * d, R * (.9 + hash(i, 5) * .6), i % 2 ? '#ffb39a' : '#ff9a8a'), a, d, i]); }
    for (let i = 0; i < 6; i++) { const a = SIDE + PI + (i - 2.5) * .7, d = R * 3.6; cl.push([longCloud(root, Math.sin(a) * d, -R * 1.6, Math.cos(a) * d, R * .8, '#c98ac9'), a, d, i + 9]); }
    ticks.push((T, cam) => { sun.lookAt(cam.position); for (const [g, a, d, i] of cl) { const b = a + Math.sin(T * .05 + i) * .03; g.position.x = Math.sin(b) * d; g.position.z = Math.cos(b) * d; g.lookAt(0, g.position.y, 0); } });
  } else if (ik === 2 || ik === 3) {
    starField(root, ik === 2 ? 320 : 200, R * 4, R * 8, ticks);
    if (ik === 2) { // starry night: a crescent moon on one side and now and then a shooting star
      const s = new THREE.Shape(), cx = .5, cy = .3, r2 = .84, d = Math.hypot(cx, cy), ph = Math.atan2(cy, cx), al = Math.acos((d * d + 1 - r2 * r2) / (2 * d)), be = Math.acos((1 - d * d - r2 * r2) / (2 * d * r2));
      s.absarc(0, 0, 1, ph + al, ph - al + 2 * PI, false); s.absarc(cx, cy, r2, ph - be + 2 * PI, ph + be, true);
      const moon = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), basic('#fff3c4')), at = dir(SIDE + .5, R * 4.5, -R * 1.2); moon.scale.setScalar(R * .7); moon.position.copy(at); root.add(moon);
      const mg = sprite(tex(glowTex(.1)), '#fff3c4', R * 3, .35); mg.position.copy(at); root.add(mg);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.4, R * .05), basic('#ffffff', { transparent: true, side: THREE.DoubleSide })); root.add(sh);
      ticks.push((T, cam) => { moon.lookAt(cam.position);
        const k = Math.floor(T / 6), u = (T % 6) / 1.1; sh.visible = u < 1; if (!sh.visible) return;
        const a = hash(k, 9) * 6.283, d = R * 4, from = dir(a, d, R * .5), to = dir(a + .6, d, -R * 1.5);
        sh.position.lerpVectors(from, to, u); sh.lookAt(cam.position); sh.rotation.z += -.6; sh.material.opacity = Math.sin(u * PI); });
    } else { // aurora: curtains of light all round the farm
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, 'rgba(255,255,255,.55)'); gr.addColorStop(.85, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      const t = tex(new THREE.CanvasTexture(cv)), SEG = 96;
      const bands = [['#5dffb0', R * 3.4, -R * .9, R * 1.6, 0], ['#58e0ff', R * 4, -R * .3, R * 1.3, 2], ['#b48cff', R * 2.9, -R * 1.5, R * 1.2, 4]].map(([col, rad, y, h, ph], k) => {
        const geo = new THREE.CylinderGeometry(rad, rad, h, SEG, 1, true), m = new THREE.Mesh(geo, basic(col, { map: t, transparent: true, opacity: .55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); m.position.y = y; m.renderOrder = -2 + k; root.add(m);
        const p = geo.attributes.position, base = Float32Array.from(p.array); return [p, base, rad, h, ph]; });
      ticks.push(T => { for (const [p, base, rad, h, ph] of bands) { for (let i = 0; i < p.count; i++) { const x = base[i * 3], z = base[i * 3 + 2], a = Math.atan2(z, x), top = base[i * 3 + 1] > 0;
        const w = Math.sin(a * 5 + T * .4 + ph) * .1 + Math.sin(a * 11 - T * .3 + ph) * .04, r = rad * (1 + w); p.setX(i, Math.cos(a) * r); p.setZ(i, Math.sin(a) * r);
        p.setY(i, (top ? h / 2 : -h / 2) + Math.sin(a * 7 + T * .8 + ph) * h * .15 * (top ? 1 : .4)); } p.needsUpdate = true; } });
    }
  } else { // rainbow: one arch over the island, standing on two clouds, always on the same side
    const g = new THREE.Group(); g.rotation.y = SIDE; root.add(g); const rad = R * 1.75, off = R * 1.5, low = R * 1.15;
    ['#ff6f61', '#ffa64a', '#ffd84a', '#7ed36a', '#6ec6f5', '#9b7bff'].forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rad - i * R * .07, R * .036, 6, 56, PI), basic(c, { transparent: true, opacity: .9 })); m.position.set(0, -low, off); g.add(m); });
    for (const d of [-1, 1]) for (const [x, y, r] of [[0, 0, .3], [.26, -.05, .22], [-.24, -.04, .24], [.07, .14, .2]]) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(R * r, 1), basic('#ffffff')); m.position.set(d * (rad - R * .18) + x * R, -low - R * .05 + y * R, off); m.scale.set(1.2, .7, .9); g.add(m); }
    // seen from its own side it would stand between you and the farm, so it fades out as the view swings round to it
    ticks.push((T, cam) => { g.position.y = Math.sin(T * .6) * .1; const f = Math.min(1, Math.max(0, (.25 - Math.cos(Math.atan2(cam.position.x, cam.position.z) - SIDE)) / .75)); g.visible = f > .02; g.traverse(o => { if (o.material) o.material.opacity = o.userData.o * shown * f; }); });
  }
  // every material fades together; base opacities are kept so they can be scaled
  const mats = []; root.traverse(o => { if (o.material) { o.material.transparent = true; o.material.depthWrite = false; o.userData.o = o.material.opacity; mats.push([o.material, o.material.opacity]); } });
  let clock = 0, last = null, shown = -1;
  const strength = ({ night = 0, dusk = 0, clear = 1, bow = 0 }) => {
    const t = ik === 1 ? .45 + .55 * dusk : ik === 4 ? Math.min(1, 1 - .65 * night + bow * .4) : .3 + .7 * night;
    return t * Math.min(1, Math.max(0, (clear - .55) / .45 + (ik === 4 ? bow : 0)));
  };
  return { root, tick: (T, cam, air = {}) => {
    const dt = last == null ? 0 : Math.min(.1, Math.max(0, T - last)); last = T; clock += dt * (1 + (air.wind || 0) * 2.5); // wind hurries the clouds and curtains
    const k = strength(air); if (Math.abs(k - shown) > .005) { shown = k; root.visible = k > .02; for (const [m, o] of mats) m.opacity = o * k; }
    if (root.visible) for (const f of ticks) f(clock, cam);
  }, dispose: () => { root.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); for (const t of maps) t.dispose(); } };
}

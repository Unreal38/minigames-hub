// The world weather in the 3D scenes: the hub's hero isle and every minigame island show the same weather as Pet Farm
// (weather.js: one clock-based spell for everyone, changing every 40 minutes).
//
//   wxShown()            the kind to show now ('sunny' | 'cloudy' | 'rain' | 'wind' | 'rainbow' | 'aurora'); a host can preview another
//                        kind from the Account menu (seasonpeek.js, own view only).
//   onWeather(fn)        fn(kind) whenever the shown kind changes (checked every 15 s, and at once after wxRecheck()).
//   weatherLayer(scene)  rain, wind streaks, the rainbow and the aurora for one scene, added to it. set(kind, night) switches it.
//                        The drops move on the graphics card (a shader works out each one from the time), so it costs one
//                        draw call per kind and nothing on the main thread; it sizes itself from the camera's distance on
//                        the first frame, or from opts.size (the width of the box of air round the view, in scene units).
//
// The sky tint, greyer clouds and dimmer sun for games are in scenery3d.js (applyNight), using WX_LOOK from weather.js.
// Kept subtle on purpose: thin faint streaks that fade out close to the camera, so boards and cards stay easy to read.
import * as THREE from 'three';
import { weatherAt, WX_LOOK } from './weather.js';
import { peekWeather } from './seasonpeek.js';
import { gfx } from './frames.js';

export const wxShown = () => peekWeather() || weatherAt().kind;
const subs = new Set(); let last = null;
export function onWeather(fn) { subs.add(fn); return () => subs.delete(fn); }
export function wxRecheck() { const k = wxShown(); if (k === last) return; last = k; for (const f of subs) { try { f(k); } catch {} } }
if (typeof window === 'object') { last = wxShown(); setInterval(wxRecheck, 15_000); }

const SHARE = { high: 1, mid: .7, low: .45 }; // how many drops each graphics level draws
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// One shader for rain and wind: each streak is a line from its seed point, moved by the clock and wrapped round a box
// of air that follows the camera (the drops stay put in the world as the view moves; only the box edge wraps).
const VERT = `
uniform float uT, uS, uLen, uFall, uDrift, uNear, uA, uWave;
uniform vec3 uC;
attribute vec4 seed;
attribute float tip;
varying float vA;
void main() {
  float sp = .75 + seed.w * .5;
  vec3 p = seed.xyz * uS;
  p.y -= uT * uFall * sp;
  p.x += uT * uDrift * sp;
  vec3 b = uC - .5 * uS;
  vec3 f = mod(p - b, uS) / uS;
  p = b + f * uS;
  p.y += sin(p.x * 6.283 / uS * 2. + uT * 1.3 + seed.w * 6.) * uWave;
  vec3 dir = normalize(vec3(uDrift, -uFall, 0.));
  p -= dir * tip * uLen * sp;
  float dc = distance(p, cameraPosition);
  vec3 e = smoothstep(0., .1, f) * smoothstep(1., .9, f);
  vA = uA * smoothstep(uNear, uNear * 2.2, dc) * e.x * e.y * e.z * (1. - tip * .65);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`;
const FRAG = `
uniform vec3 uCol;
varying float vA;
void main() { if (vA < .004) discard; gl_FragColor = vec4(uCol, vA); }`;

function streaks(n, u) {
  const seed = new Float32Array(n * 8), tip = new Float32Array(n * 2), h = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < n; i++) { const s = [h(i, 1), h(i, 2), h(i, 3), h(i, 4)]; seed.set(s, i * 8); seed.set(s, i * 8 + 4); tip[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); // unused, three.js wants one
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false });
  const o = new THREE.LineSegments(g, m); o.frustumCulled = false; o.renderOrder = 3; o.userData.n = n;
  return o;
}

const BOW = ['#e8615a', '#ffb547', '#ffe066', '#7fd08a', '#6fb7e8', '#b79cf0']; // Pet Farm's rainbow
const _f = new THREE.Vector3();

// The arch drawn on the inside of a ball of radius 1 round the camera (a ring of directions, like a real rainbow round
// the point opposite the sun), so it looks right from any angle the camera turns to. Its centre is +z, up is +y; ra is
// its angular radius. Bands keep the same angular width at any size. The lower part fades out, so the arch rises out of the
// haze round the horizon. One mesh, one draw call.
function bowRing(ra) {
  const SEG = 72, pos = [], col = [], idx = [], c = new THREE.Color(), bw = Math.min(.03, ra * .045);
  BOW.forEach((hex, i) => {
    c.set(hex); const r0 = ra - bw * (i + 1), r1 = ra - bw * i, base = pos.length / 3;
    for (let j = 0; j <= SEG; j++) {
      const f = -.25 + (Math.PI + .5) * j / SEG, k0 = Math.min(1, Math.max(0, (Math.sin(f) - .22) / .26)), al = k0 * k0 * (3 - 2 * k0);
      for (const r of [r0, r1]) { pos.push(Math.sin(r) * Math.cos(f), Math.sin(r) * Math.sin(f), Math.cos(r)); col.push(c.r, c.g, c.b, al); }
      if (j) { const q = base + (j - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g;
}

// The rainbow as part of the sky (Kuba, 2026-11-27: never stuck to the camera, it should behave like it is far away,
// and it must be easy to see, since it tells players about the Pet Farm rainbow bonus). Like a real distant rainbow it
// stands on the horizon in one compass direction and only travels with the camera, so turning, tilting and moving the
// view never shift it in the sky. Each camera gets it where it first looks, as wide as most of its view. A camera that
// looks steeply down sees the ground, not the sky, so it sees the rainbow only once tilted up (like the real thing).
// fit: true is for a camera that never moves and shows little sky (the hub's hero isle): the arch is lowered so its top
// sits just under the top of that view. place(camera, opacity) every frame.
export function skyBow({ fit = false } = {}) {
  const bow = new THREE.Group(), at = new WeakMap(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false, side: THREE.DoubleSide });
  const rings = new Map(); // one ring per size (cameras differ), kept for reuse
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); mesh.renderOrder = -7; mesh.frustumCulled = false; bow.add(mesh);
  bow.visible = false;
  bow.place = (camera, opacity) => {
    let a = at.get(camera);
    if (!a) {
      camera.getWorldDirection(_f);
      const pitch = Math.asin(Math.max(-1, Math.min(1, _f.y))), half = camera.fov * Math.PI / 360;
      const hfov = 2 * Math.atan(Math.tan(half) * (camera.aspect || 1)), A = Math.round(Math.min(.62, Math.max(.3, hfov * .4)) * 50) / 50;
      const el = fit ? Math.max(-1.05, Math.min(-.04, pitch + half - .09 - A * .6)) : -A * .4; // centre sunk under the horizon, so a low arch rises from it
      _f.y = 0; if (_f.lengthSq() < 1e-4) _f.set(0, 0, -1); _f.normalize();
      if (!rings.has(A)) rings.set(A, bowRing(A));
      a = { yaw: Math.atan2(_f.x, _f.z), el, g: rings.get(A) }; at.set(camera, a);
    }
    mesh.geometry = a.g;
    bow.position.copy(camera.position); // a ball round the camera, out past the scenery: the sky
    bow.rotation.set(-a.el, a.yaw, 0, 'YXZ'); bow.scale.setScalar(Math.min(240, camera.far * .85)); bow.updateMatrixWorld(true);
    mat.opacity = opacity;
  };
  bow.dispose = () => { for (const g of rings.values()) g.dispose(); mat.dispose(); };
  return bow;
}

// The aurora (a winter-night weather since 2026-11-27, Kuba): three curtains of light low over the horizon, drawn on the
// inside of a ball round the camera like the rainbow, so they stay in one compass direction (where the camera first looks)
// and only travel with it. Each frame the curtains ripple and their hems wave. fit: like skyBow, for a camera that never
// moves and shows little sky (the hub's hero isle): the curtains are lowered into its view. place(camera, opacity, T).
// Like the real thing: oxygen green with a bright, sharp lower hem that glows almost white, a pink fringe just under it
// where the curtain is brightest, and tops fading through violet to a dim red. The light comes in vertical rays that
// shimmer and drift along the curtain, and each curtain folds back and forth across the sky.
// Rows of each column, bottom to top: [height above the hem as a share of the curtain, colour, alpha].
const AUR_ROWS = [[-.06, '#ff5fa8', 0], [0, '#d8ffe6', 1], [.12, '#4dff9a', .95], [.45, '#2fd98a', .55], [.75, '#7a5cff', .22], [1, '#c0406a', 0]];
// Curtains: hem height, curtain height (radians), phase, strength, how far it reaches to each side (radians), fold size
const AUR = [[.03, .36, 0, 1, .62, .09], [.12, .28, 2.3, .7, .48, .11], [.2, .22, 4.1, .5, .38, .07]]; // narrow enough that turning the view clearly leaves it behind
export function skyAurora({ fit = false } = {}) {
  const g = new THREE.Group(), at = new WeakMap(), SEG = 160, R = AUR_ROWS.length, n = AUR.length * (SEG + 1) * R;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), idx = [], c = new THREE.Color();
  AUR.forEach((_, b) => { for (let j = 0; j <= SEG; j++) { const v = (b * (SEG + 1) + j) * R;
    AUR_ROWS.forEach(([, hex], r) => { c.set(hex); col.set([c.r, c.g, c.b, 0], (v + r) * 4); });
    if (j) for (let r = 0; r < R - 1; r++) { const q = v - R + r; idx.push(q, q + 1, q + R, q + 1, q + R + 1, q + R); } } });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = -7; mesh.frustumCulled = false; g.add(mesh); g.visible = false;
  const put = (v, f, e) => { const ce = Math.cos(e); pos[v * 3] = Math.sin(f) * ce; pos[v * 3 + 1] = Math.sin(e); pos[v * 3 + 2] = Math.cos(f) * ce; };
  const hsh = i => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
  const vnoise = x => { const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t); return hsh(i) * (1 - u) + hsh(i + 1) * u; }; // smooth 1D noise, 0..1
  g.place = (camera, opacity, T) => {
    let a = at.get(camera);
    if (!a) {
      camera.getWorldDirection(_f); const pitch = Math.asin(Math.max(-1, Math.min(1, _f.y))), half = camera.fov * Math.PI / 360;
      _f.y = 0; if (_f.lengthSq() < 1e-4) _f.set(0, 0, -1); _f.normalize();
      a = { yaw: Math.atan2(_f.x, _f.z), el: fit ? Math.min(0, pitch + half - .52) : -.14 }; at.set(camera, a); // sunk a little, so the hems rise from the horizon
    }
    AUR.forEach(([base, h, ph, k, W, fold], b) => {
      // a slow surge: now and then the whole curtain brightens and its rays race along it
      const surge = .75 + .25 * Math.sin(T * .11 + ph * 1.7) + .2 * Math.max(0, Math.sin(T * .037 + ph) - .6) * 2.5;
      for (let j = 0; j <= SEG; j++) {
        const u = j / SEG, x = u * 2 - 1, ends = Math.pow(Math.max(0, Math.sin(Math.PI * u)), .8);
        // the curtain's path folds: yaw wobbles back and forth, the hem waves up and down
        const f = x * W + fold * Math.sin(x * 4.2 + T * .09 + ph) * Math.cos(x * 1.3 - T * .05);
        const hem = base + .05 * Math.sin(x * 3.1 + T * .13 + ph) + .02 * Math.sin(x * 9.7 - T * .21 + ph * 2);
        // rays: fine streaks drifting sideways along the curtain, over a slower patchy brightness
        const s = j * .55, ray = Math.pow(vnoise(s + T * .9 + ph * 10) * .6 + vnoise(s * 2.3 - T * 1.7 + ph * 20) * .4, 1.6);
        const patch = .35 + .65 * vnoise(u * 6 + T * .08 + ph * 3), tall = h * (.55 + .45 * patch + .25 * ray);
        const bright = k * ends * surge * (.25 + .75 * ray) * (.45 + .55 * patch), v = (b * (SEG + 1) + j) * (AUR_ROWS.length);
        AUR_ROWS.forEach(([dy, , al], r) => { put(v + r, f, hem + dy * tall); col[(v + r) * 4 + 3] = al * Math.min(1, bright * (r === 0 ? .7 * ray : 1)); });
      } });
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    g.position.copy(camera.position); g.rotation.set(-a.el, a.yaw, 0, 'YXZ'); g.scale.setScalar(Math.min(230, camera.far * .8)); g.updateMatrixWorld(true);
    mat.opacity = opacity;
  };
  g.dispose = () => { geo.dispose(); mat.dispose(); };
  return g;
}

export function weatherLayer(scene, { size = 0, bowFit = false } = {}) {
  const root = new THREE.Group(); root.name = 'weather'; scene.add(root);
  const share = SHARE[gfx()] || 1;
  const common = () => ({ uT: { value: 0 }, uS: { value: 20 }, uC: { value: new THREE.Vector3() }, uNear: { value: 3 }, uA: { value: 0 } });
  const R = { ...common(), uLen: { value: .6 }, uFall: { value: 11 }, uDrift: { value: -1.2 }, uWave: { value: 0 }, uCol: { value: new THREE.Color('#a8c4e4') } };
  const W = { ...common(), uLen: { value: 2.4 }, uFall: { value: .25 }, uDrift: { value: 9 }, uWave: { value: .25 }, uCol: { value: new THREE.Color('#ffffff') } };
  const rain = streaks(Math.round(1300 * share), R), wind = streaks(Math.round(70 * share), W);
  const bow = skyBow({ fit: bowFit }), aur = skyAurora({ fit: bowFit });
  root.add(rain, wind, bow, aur);
  rain.visible = wind.visible = false;

  let want = { rain: 0, wind: 0, bow: 0, aur: 0 }, now = { rain: 0, wind: 0, bow: 0, aur: 0 }, S = size, D = size / 1.3, lastT = -1, nextLook = 0;
  const ray = new THREE.Raycaster(), mid = new THREE.Vector2();
  const solid = o => o.isMesh && o.visible && !o.userData.sky && !o.userData.cloud && !o.material?.transparent;
  function focus(camera) {
    ray.setFromCamera(mid, camera); ray.far = camera.far;
    try { for (const h of ray.intersectObjects(scene.children, true)) { let o = h.object, ok = solid(o); while (ok && o) { if (o === root || !o.visible) ok = false; o = o.parent; } if (ok) return h.distance; } } catch {}
    return 0;
  }
  const fit = d => { S = d * 1.3; D = d;
    R.uLen.value = S * .03; R.uFall.value = S * .55; R.uDrift.value = -S * .06; R.uNear.value = d * .3;
    W.uLen.value = S * .08; W.uFall.value = S * .012; W.uDrift.value = S * .45; W.uWave.value = S * .01; W.uNear.value = d * .3;
    for (const u of [R, W]) u.uS.value = S; };
  if (size) fit(size / 1.3);
  // Runs once per frame, just before the first weather part is drawn: the clock, the box round the view, easing in and out.
  function step(renderer, sc, camera) {
    const t = performance.now() / 1000; if (t === lastT) return; const dt = lastT < 0 ? 1 : Math.min(.1, t - lastT); lastT = t;
    if (!size && t > nextLook) { // how far off the thing in the middle of the view is (games move their cameras in very different ways)
      nextLook = t + 3; const d = focus(camera);
      if (d && (!S || d > D * 1.6 || d < D / 1.6)) fit(Math.min(120, Math.max(3, d)));
      else if (!S) fit(Math.min(80, Math.max(3, camera.position.length())));
    }
    camera.getWorldDirection(_f);
    const T = t % 3600; R.uT.value = W.uT.value = T;
    R.uC.value.copy(camera.position).addScaledVector(_f, D * .55); W.uC.value.copy(R.uC.value);
    const k = Math.min(1, dt * .8);
    for (const key of ['rain', 'wind', 'bow', 'aur']) now[key] += (want[key] - now[key]) * k;
    R.uA.value = now.rain * .5; W.uA.value = now.wind * (.34 + Math.sin(T * .7) * .08 + Math.sin(T * 2.3) * .04);
    rain.visible = now.rain > .01 && !reduced; wind.visible = now.wind > .01 && !reduced;
    bow.visible = now.bow > .01;
    if (bow.visible) bow.place(camera, now.bow * want.bowA);
    aur.visible = now.aur > .01;
    if (aur.visible) aur.place(camera, now.aur * want.aurA, reduced ? 0 : T);
  }
  for (const o of [rain, wind, ...bow.children, ...aur.children]) o.onBeforeRender = step;
  // An empty, always drawn point keeps step() running while every part is hidden (so a spell can fade in).
  const tick = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), new THREE.PointsMaterial({ size: 0, transparent: true, opacity: 0, depthWrite: false }));
  tick.frustumCulled = false; tick.onBeforeRender = step; root.add(tick);

  function set(kind, night = false) {
    const L = WX_LOOK[kind] || WX_LOOK.sunny;
    want = { rain: L.fall, wind: L.wind, bow: L.bow, bowA: night ? .22 : .55, aur: L.aur || 0, aurA: night ? .9 : .3 }; // an aurora seen by day is only a host's preview
    R.uCol.value.set(night ? '#a9b6e8' : '#a8c4e4'); W.uCol.value.set(night ? '#c8d0ff' : '#ffffff');
  }
  set(wxShown());
  now = { ...want }; // a scene opened mid-spell starts with it already there
  return { root, set, dispose() { scene.remove(root); root.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); } };
}

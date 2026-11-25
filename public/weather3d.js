// The world weather in the 3D scenes: the hub's hero isle and every minigame island show the same weather as Pet Farm
// (weather.js: one clock-based spell for everyone, changing every 40 minutes).
//
//   wxShown()            the kind to show now ('sunny' | 'cloudy' | 'rain' | 'wind' | 'rainbow'); a host can preview another
//                        kind from the Account menu (seasonpeek.js, own view only).
//   onWeather(fn)        fn(kind) whenever the shown kind changes (checked every 15 s, and at once after wxRecheck()).
//   weatherLayer(scene)  rain, wind streaks and the rainbow for one scene, added to it. set(kind, night) switches it.
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

export function weatherLayer(scene, { size = 0 } = {}) {
  const root = new THREE.Group(); root.name = 'weather'; scene.add(root);
  const share = SHARE[gfx()] || 1;
  const common = () => ({ uT: { value: 0 }, uS: { value: 20 }, uC: { value: new THREE.Vector3() }, uNear: { value: 3 }, uA: { value: 0 } });
  const R = { ...common(), uLen: { value: .6 }, uFall: { value: 11 }, uDrift: { value: -1.2 }, uWave: { value: 0 }, uCol: { value: new THREE.Color('#a8c4e4') } };
  const W = { ...common(), uLen: { value: 2.4 }, uFall: { value: .25 }, uDrift: { value: 9 }, uWave: { value: .25 }, uCol: { value: new THREE.Color('#ffffff') } };
  const rain = streaks(Math.round(1300 * share), R), wind = streaks(Math.round(70 * share), W);
  const bow = new THREE.Group();
  BOW.forEach((c, i) => bow.add(new THREE.Mesh(new THREE.TorusGeometry(58 - i * 2.2, 1.15, 4, 40, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false, depthWrite: false }))));
  bow.children.forEach(m => { m.renderOrder = -7; m.frustumCulled = false; });
  root.add(rain, wind, bow);
  rain.visible = wind.visible = bow.visible = false;

  let want = { rain: 0, wind: 0, bow: 0 }, now = { rain: 0, wind: 0, bow: 0 }, S = size, D = size / 1.3, lastT = -1, nextLook = 0;
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
    for (const key of ['rain', 'wind', 'bow']) now[key] += (want[key] - now[key]) * k;
    R.uA.value = now.rain * .5; W.uA.value = now.wind * (.34 + Math.sin(T * .7) * .08 + Math.sin(T * 2.3) * .04);
    rain.visible = now.rain > .01 && !reduced; wind.visible = now.wind > .01 && !reduced;
    bow.visible = now.bow > .01;
    if (bow.visible) { // always arching over the far side of the view, like Pet Farm's
      _f.y = 0; if (_f.lengthSq() < 1e-4) _f.set(0, 0, -1); _f.normalize();
      const far = Math.min(D * 4, camera.far * .8), r = far * .58; // about 60 degrees wide, its top a little above the horizon
      bow.position.copy(camera.position).addScaledVector(_f, far); bow.position.y = camera.position.y + far * .21 - r;
      bow.rotation.set(0, Math.atan2(_f.x, _f.z), 0); bow.scale.setScalar(r / 58); bow.updateMatrixWorld(true);
      for (const m of bow.children) m.material.opacity = now.bow * want.bowA;
    }
  }
  for (const o of [rain, wind, ...bow.children]) o.onBeforeRender = step;
  // An empty, always drawn point keeps step() running while every part is hidden (so a spell can fade in).
  const tick = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), new THREE.PointsMaterial({ size: 0, transparent: true, opacity: 0, depthWrite: false }));
  tick.frustumCulled = false; tick.onBeforeRender = step; root.add(tick);

  function set(kind, night = false) {
    const L = WX_LOOK[kind] || WX_LOOK.sunny;
    want = { rain: L.fall, wind: L.wind, bow: L.bow, bowA: night ? .14 : .38 };
    R.uCol.value.set(night ? '#a9b6e8' : '#a8c4e4'); W.uCol.value.set(night ? '#c8d0ff' : '#ffffff');
  }
  set(wxShown());
  now = { ...want }; // a scene opened mid-spell starts with it already there
  return { root, set, dispose() { scene.remove(root); root.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); } };
}

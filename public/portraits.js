// Round avatar pictures as snapshots of the 3D head, plus the turning 3D preview in the avatar creator.
// Loaded by app.js once three.js is available; avatarHtml() falls back to a flat head until then.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from './avatar3d.js';
import { cleanAv, setPortraitSource } from './avatar.js';

const lights = scene => {
  scene.add(new THREE.HemisphereLight('#ffffff', '#d8c8c0', 1.7));
  const d = new THREE.DirectionalLight('#fff4dd', 1.9); d.position.set(2.5, 5, 6); scene.add(d);
};

let rd = null, dead = false; const cache = new Map(), SIZE = 144;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, .1, 40); lights(scene);

// A data URL of the head and shoulders, or '' if this browser cannot draw 3D.
export function portrait(color, av) {
  const a = cleanAv(av), key = color + a.join('.');
  if (cache.has(key)) return cache.get(key);
  if (dead) return '';
  try {
    if (!rd) { const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); rd.setSize(SIZE, SIZE, false); }
    const g = avatar3d(color, a, { pose: 'stand' }), u = g.userData; g.rotation.y = -.22; scene.add(g);
    cam.position.set(0, u.headY + u.headH * .06, u.headH * 3.5); cam.lookAt(0, u.headY - u.headH * .04, 0);
    rd.render(scene, cam);
    const url = rd.domElement.toDataURL('image/png');
    scene.remove(g); disposeAvatar(g);
    if (cache.size > 300) cache.clear();
    cache.set(key, url); return url;
  } catch (e) { dead = true; return ''; }
}
setPortraitSource(portrait);

// The creator's preview: a standing avatar that turns slowly and can be dragged round.
//   const pv = creatorPreview(hostElement); pv.set(color, av); pv.face(true); pv.dispose();
export function creatorPreview(host) {
  let r; try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); host.append(r.domElement);
  const sc = new THREE.Scene(), c = new THREE.PerspectiveCamera(26, 1, .1, 50); lights(sc);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, .16, 40), new THREE.MeshToonMaterial({ color: '#f3c9a8' })); disc.position.y = -.84; sc.add(disc);
  let g = null, raf = 0, drag = 0, px = null, close = false, off = false;
  const pos = new THREE.Vector3(0, 1.0, 8.6), look = new THREE.Vector3(0, .66, 0), cp = pos.clone(), cl = look.clone();
  const aim = () => { if (!g) return; const u = g.userData; if (close) { pos.set(0, u.headY + u.headH * .08, u.headH * 4.2); look.set(0, u.headY - u.headH * .1, 0); } else { pos.set(0, 1.0, 8.6); look.set(0, .66, 0); } };
  const fit = () => { const w = host.clientWidth, h = host.clientHeight; if (w && h) { r.setSize(w, h, false); c.aspect = w / h; c.updateProjectionMatrix(); } };
  const ro = new ResizeObserver(fit); ro.observe(host); fit();
  const down = e => { px = e.clientX; host.setPointerCapture(e.pointerId); }, move = e => { if (px !== null) { drag += (e.clientX - px) * .012; px = e.clientX; } }, up = () => { px = null; };
  host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now();
  const frame = now => {
    if (off) return; raf = requestAnimationFrame(frame);
    const T = (now - t0) / 1000;
    if (g) { g.rotation.y = drag + (still ? -.25 : Math.sin(T * .5) * .45); if (!still) animateAvatar(g, T, { seed: 0 }); }
    cp.lerp(pos, .14); cl.lerp(look, .14); c.position.copy(cp); c.lookAt(cl);
    r.render(sc, c);
  };
  raf = requestAnimationFrame(frame);
  return {
    set(color, av) { if (g) { sc.remove(g); disposeAvatar(g); } g = avatar3d(color, av, { pose: 'stand' }); sc.add(g); aim(); },
    face(on) { close = on; aim(); },
    dispose() { off = true; cancelAnimationFrame(raf); ro.disconnect(); if (g) disposeAvatar(g); disc.geometry.dispose(); disc.material.dispose(); r.dispose(); r.forceContextLoss?.(); r.domElement.remove(); },
  };
}

// The aurora on the hub page sky, drawn by the very same 3D curtains as the hub isle (weather3d.js skyAurora), so it is just as
// smooth: one mesh whose colours blend between columns (no hard strips), at the site's steady 60 frames a second.
// Kuba, 2026-11-27: the 2D canvas version looked laggy, stripy and made the site slow.
// It only runs while the aurora is out and the hub is showing; a game opening drops the WebGL canvas, and it comes back after.
//   const sky = mountAuroraSky(canvas); sky.on(true|false); sky.dispose();
import * as THREE from 'three';
import { skyAurora } from './weather3d.js';
import { AA, autoResolution, frameLoop } from './frames.js';

export function mountAuroraSky(cv, { still = false } = {}) {
  let renderer = null, scene = null, aur = null, camera = null, loop = null, want = false, w = 0, h = 0;
  const hidden = () => document.body.classList.contains('in-game');
  const fit = () => {
    const r = cv.getBoundingClientRect(); w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    if (!renderer) return;
    renderer.setSize(w, h, false);
    // wide enough sideways for the whole ~70 degree spread of curtains, and the lowest hems (sunk .14 rad below the horizon) just inside the bottom edge
    const asp = w / h, vf = Math.min(100, Math.max(42, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(42)) / asp) * 180 / Math.PI));
    camera.fov = vf; camera.aspect = asp; camera.updateProjectionMatrix();
    camera.rotation.set(Math.atan(.92 * Math.tan(THREE.MathUtils.degToRad(vf / 2))) - .17, 0, 0, 'YXZ');
    if (still) draw();
  };
  const draw = () => { if (!renderer) return; aur.place(camera, 1, still ? 40 : performance.now() / 1000 % 3600); renderer.render(scene, camera); };
  function build() {
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: AA, powerPreference: 'low-power' }); } catch { renderer = null; return false; }
    renderer.setClearColor(0x000000, 0); autoResolution(renderer, 1.5);
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, .1, 1000);
    aur = skyAurora({ fit: false }); aur.visible = true; scene.add(aur);
    fit(); return true;
  }
  function release() {
    loop?.stop(); loop = null;
    if (!renderer) return;
    aur.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer = scene = aur = camera = null;
  }
  function sync() {
    const run = want && !hidden();
    if (!run) { release(); return; }
    if (!renderer && !build()) return;
    if (still) draw(); else loop ||= frameLoop(draw);
  }
  const ro = new ResizeObserver(fit); ro.observe(cv);
  const mo = new MutationObserver(sync); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return {
    on(v) { want = !!v; sync(); },
    dispose() { want = false; release(); ro.disconnect(); mo.disconnect(); },
  };
}

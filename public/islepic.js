// Small pictures of the isle variants for the wardrobe tiles: a ground theme seen from above, a rock base from the
// side, one decor prop on a patch of lawn, a sky behind a tiny isle. One hidden renderer, cached as data URLs.
import * as THREE from 'three';
import { buildIsle, buildSky, decorOnly } from './isle3d.js';

const SIZE = 176, cache = new Map();
let rd = null, dead = false;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, .1, 80);
const hemi = new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2), key = new THREE.DirectionalLight('#ffffff', 1.5);
key.position.set(5, 12, 8); scene.add(hemi, key);

// A data URL for entry i of isle kind k ('' if 3D is not available).
export function islePic(k, i) {
  const id = k + i; if (cache.has(id)) return cache.get(id);
  if (dead) return '';
  try {
    if (!rd) { const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); rd.setSize(SIZE, SIZE, false); }
    const parts = [], at = (x, y, z, tx, ty, tz) => { cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); };
    let night = false;
    if (k === 'ip') { parts.push(decorOnly(i)); at(2.2, 2.3, 5.6, 0, .55, 0); }
    else if (k === 'ik') { const sky = buildSky(i); parts.push(buildIsle({}), sky); night = sky.mood === 'night'; at(0, 2.5, 46, 0, 0, 0); }
    else if (k === 'ib') { parts.push(buildIsle({ ib: i })); at(-8, 0, 23, 0, -2.6, 0); }
    else { parts.push(buildIsle({ ig: i })); at(0, 6.4, 12.6, 0, -.3, 0); }
    hemi.color.set(night ? '#9aa6ff' : '#ffffff'); hemi.groundColor.set(night ? '#5a3a6a' : '#ffe9c9'); hemi.intensity = night ? 1.35 : 2; key.intensity = night ? .9 : 1.5;
    for (const p of parts) { p.root.traverse(o => { if (o.userData.nightOnly) o.visible = night; }); p.tick(1.3); scene.add(p.root); }
    rd.render(scene, cam);
    const url = rd.domElement.toDataURL('image/png');
    for (const p of parts) { scene.remove(p.root); p.dispose(); }
    cache.set(id, url); return url;
  } catch (e) { dead = true; return ''; }
}

// Small pictures of the isle variants for the wardrobe tiles: a ground theme seen from above, a rock base from the
// side, one Pet Farm decoration on a patch of lawn, a sky friend on its own. One hidden renderer, cached as data URLs.
import * as THREE from 'three';
import { buildIsle, pieceModel } from './isle3d.js';
import { skyFriend } from './skyfriends.js';
import { petModel, wiggle } from './games/farm/pets3d.js';
import { disposeToon } from './scenery3d.js';
import { itemModel, disposeModel, toonify } from './games/farm/models.js';

// One Pet Farm decoration on a patch of lawn.
function decorOnly(type) {
  const root = new THREE.Group(), g = itemModel(type), sz = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  g.scale.setScalar(Math.min(1.5, 1.7 / Math.max(sz.x, sz.z, .01), 1.9 / Math.max(sz.y, .01))); root.add(g);
  const lawn = new THREE.Group(), m = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.05, .16, 14), new THREE.MeshStandardMaterial({ color: '#8bca60', roughness: .95, flatShading: true })); m.position.y = -.09; lawn.add(m); root.add(toonify(lawn, .03));
  return { root, tick() {}, dispose() { disposeModel(g); m.geometry.dispose(); } };
}

const SIZE = 176, BIG = 288, cache = new Map(); // the expedition places show their island large, so they get a sharper picture
let rd = null, dead = false;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, .1, 80);
const hemi = new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2), key = new THREE.DirectionalLight('#ffffff', 1.5);
key.position.set(5, 12, 8); scene.add(hemi, key);

// The picture if it is already drawn ('' if not yet), so a list can paint the cached ones at once.
export const isleCached = (k, i) => cache.get(k + i) || '';

// A data URL for entry i of isle kind k (for 'ip' a Pet Farm decoration type, for 'fp' a floating piece id) ('' if 3D is not available).
export function islePic(k, i) {
  const id = k + i; if (cache.has(id)) return cache.get(id);
  if (dead) return '';
  try {
    if (!rd) { const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    const px = k === 'zn' ? BIG : SIZE; if (rd.domElement.width !== px) rd.setSize(px, px, false);
    const parts = [], at = (x, y, z, tx, ty, tz) => { cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); };
    let night = false;
    if (k === 'fp') { const g = pieceModel(i); g.rotation.set(.35, .6, 0); parts.push({ root: g, tick() {}, dispose: () => disposeToon(g) }); at(0, .3, 2.6, 0, 0, 0); }
    else if (k === 'ip') { parts.push(decorOnly(i)); at(2.2, 2.3, 5.6, 0, .55, 0); }
    else if (k === 'ik') { const f = skyFriend(i, { pet: { petModel, wiggle, disposeModel }, pic: true }); if (f) { f.tick(2.2); parts.push({ root: f.root, tick() {}, dispose: f.dispose }); // the friend on its own against the tile's sky, framed to fill it
      const bx = new THREE.Box3().setFromObject(f.root), c = bx.getCenter(new THREE.Vector3()), sz = bx.getSize(new THREE.Vector3()), d = Math.max(sz.x, sz.y, 1.2) * 1.25 / (2 * Math.tan(12 * Math.PI / 180)) + sz.z / 2;
      at(c.x, c.y + d * .08, c.z + d, c.x, c.y, c.z); } }
    else if (k === 'ib') { parts.push(buildIsle({ ib: i })); at(-8, 0, 23, 0, -2.6, 0); }
    else if (k === 'zn') { parts.push(buildIsle({ ig: i })); at(0, 4.2, 15.6, 0, -1.45, 0); } // a whole island, rock base and all
    else { parts.push(buildIsle({ ig: i })); at(0, 6.4, 12.6, 0, -.3, 0); }
    hemi.color.set(night ? '#9aa6ff' : '#ffffff'); hemi.groundColor.set(night ? '#5a3a6a' : '#ffe9c9'); hemi.intensity = night ? 1.35 : 2; key.intensity = night ? .9 : 1.5;
    for (const p of parts) { p.root.traverse(o => { if (o.userData.nightOnly) o.visible = night; }); p.tick(1.3); scene.add(p.root); }
    rd.render(scene, cam);
    const url = rd.domElement.toDataURL('image/png');
    for (const p of parts) { scene.remove(p.root); p.dispose(); }
    cache.set(id, url); return url;
  } catch (e) { dead = true; return ''; }
}

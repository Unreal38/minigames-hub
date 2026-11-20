// Shared "this is you" marker for the 3D games: a small arrow that bobs above your own token and slowly turns.
//   youArrow(color?)        -> THREE.Group, tip at y = 0 pointing down. Put it just above your avatar's head.
//   animateArrow(g, T)      call every frame (T in seconds): bobs and spins it.
//   disposeArrow(g)         frees its geometry and materials.
import * as THREE from 'three';

export function youArrow(color = '#ffb547') {
  const g = new THREE.Group(), spin = new THREE.Group();
  const fill = new THREE.MeshStandardMaterial({ color, roughness: .45, emissive: color, emissiveIntensity: .35 });
  const ink = new THREE.MeshBasicMaterial({ color: '#3b2219', side: THREE.BackSide });
  // a chunky flat arrow pointing down, extruded so it reads as a solid shape while it turns
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(.3, .3); sh.lineTo(.13, .3); sh.lineTo(.13, .62); sh.lineTo(-.13, .62); sh.lineTo(-.13, .3); sh.lineTo(-.3, .3); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: .12, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 });
  geo.translate(0, 0, -.06);
  const m = new THREE.Mesh(geo, fill);
  const o = new THREE.Mesh(geo, ink); o.scale.set(1.18, 1.1, 1.5); o.position.y = -.035;
  spin.add(o, m);
  spin.children.forEach(m => { m.castShadow = false; m.renderOrder = 2; });
  g.add(spin); g.userData.spin = spin;
  return g;
}

export function animateArrow(g, T) {
  const s = g.userData.spin; if (!s) return;
  s.position.y = Math.abs(Math.sin(T * 3)) * .18;
  s.rotation.y = T * 2;
}

export function disposeArrow(g) {
  const seen = new Set();
  g.traverse(m => { if (m.isMesh) { if (!seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); } if (!seen.has(m.material)) { seen.add(m.material); m.material.dispose(); } } });
}

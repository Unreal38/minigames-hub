// Rounded playing cards for every 3D card game. Card pictures are painted with round corners (outer ink
// radius 30 of 256 px wide), so the mesh is cut to the same rounded outline: no square black corners, no
// transparency (cheap with many cards on the table). UVs match PlaneGeometry, so any card texture fits.
import * as THREE from 'three';

function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// like new THREE.PlaneGeometry(w, h) but with round corners; r defaults to the card textures' 30/256 of the width
export function cardGeometry(w, h, r = w * 30 / 256, seg = 5) {
  const g = new THREE.ShapeGeometry(roundRect(w, h, r), seg), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
  return g;
}
// a rounded block (a pile of cards seen from the side): w by d footprint, 1 tall, from y = -.5 to .5
export function cardBlock(w, d, r = w * 30 / 256, seg = 5) {
  const g = new THREE.ExtrudeGeometry(roundRect(w, d, r), { depth: 1, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2); g.translate(0, -.5, 0);
  return g;
}

// 3D chibi avatar (three.js), shared by every 3D minigame and by the round pictures in lists. Purely visual.
// Anime "pocket" chibi in a toon look: big round head with the face painted on, clumpy hair with pointed bangs,
// a small soft body, mitten hands and chunky shoes, flat two-step shading and a dark outline.
//
//   avatar3d(color, av, { pose })  -> THREE.Group facing +Z. pose 'sit' (default): the seat is at y = -0.76 and the
//                           top of the head is about y = 2.1. pose 'stand': the feet are at y = -0.76.
//                           userData = { head, eyes, body, arms, headY, headH } for animation and framing.
//   animateAvatar(g, T, { seed, active, hop, look, nod })  idle sway, blinking, a little arm swing and a squashy hop;
//                           look turns the head (radians), nod dips it (0..1).
//                           It sets g.scale every frame (the squash), so size an avatar with a wrapper group, never g.scale,
//                           and lift it by 0.76 x that size so the feet (or the seat) rest on the floor.
//   walkAvatar(g, ph, amt) call after animateAvatar on a standing avatar: ph is the stride phase, amt 0..1 blends it in.
//   disposeAvatar(g)     frees its textures, materials and merged geometry.
//   partBox(part)        world box of ud.head, an arm or a leg (the whole avatar is ONE skinned mesh + outline + face,
//                        so Box3.setFromObject on a part no longer sees its shape; on the whole avatar it still works).
//   bake(root)           merges a group's static meshes into a few (see below); any 3D game can use it on its props.
import * as THREE from 'three';
import { SKINS, HAIR_COLS, EYE_COLS, BOTTOM_COLS, SHOE_COLS, avObj } from './avatar.js';
import { hairParts, HC, envT } from './hair3d.js';

// ---------- bake: for scenery ----------

// Merge the plain meshes under root into one mesh per kind of surface, with the paint moved into vertex colours.
// A model made of 70 little parts then costs a handful of draw calls instead of 70. Skips anything flagged
// userData.dyn (and everything inside it), hidden meshes, textured or non-standard materials and instanced meshes.
const _bm = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _pb = new THREE.Vector3(), _ps = new THREE.Vector3();
// How big a part is for its outline: the mean of its two thinnest sides, so a flat coin or a thin rod counts as small.
export function partSize(geo, mat) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  geo.boundingBox.getSize(_pb); _ps.setFromMatrixScale(mat);
  const [a, b] = [Math.abs(_pb.x * _ps.x), Math.abs(_pb.y * _ps.y), Math.abs(_pb.z * _ps.z)].sort((x, y) => x - y);
  return Math.sqrt(a * b);
}
// The outline of a part of size d on a model whose full line is t thick: big parts get all of t, small ones about a
// sixth of their size (never under t * .16) and a dark shade of their own colour c instead of the ink, so beads,
// pins and little lamps keep their colour instead of vanishing into a dark ring. Returns the width factor (0..1)
// and writes the line colour into out.
export function inkLook(d, t, c, ink, out) {
  const f = Math.min(1, Math.max(.16, d * .16 / t)), small = Math.min(1, Math.max(0, (4 * t - d) / (2.3 * t)));
  out.copy(ink); if (small > 0) out.lerp(_pl.copy(c).multiplyScalar(.45), small * .8);
  return f;
}
const _pl = new THREE.Color();
// One outline hull for a list of meshes (all under root): their parts merged, corners welded so the line has no
// gaps, each part pushed out by its own width (inkLook) and painted its own line colour. t: the full line width in
// root's units; ink: the line colour. Keeps position + smoothed normal, so hover rims can reuse the geometry.
const _hv = new THREE.Matrix4(), _hm = new THREE.Matrix4(), _ha = new THREE.Vector3(), _hb = new THREE.Vector3(), _hc = new THREE.Vector3(), _hk = new THREE.Color(), _hx = new THREE.Color();
export function hullGeo(root, meshes, t, ink) {
  root.updateWorldMatrix(true, true); _hv.copy(root.matrixWorld).invert(); ink = new THREE.Color(ink);
  const parts = []; let n = 0;
  for (const m of meshes) {
    _hm.multiplyMatrices(_hv, m.matrixWorld);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(_hm);
    const mc = (Array.isArray(m.material) ? m.material[0] : m.material).color || _hx.set('#ffffff');
    parts.push([g.attributes.position.array, g.attributes.color?.array, g.attributes.inkd?.array, m.geometry.attributes.inkd ? 0 : partSize(m.geometry, _hm), mc.clone(), _ps.setFromMatrixScale(_hm).x]);
    n += g.attributes.position.count; g.dispose();
  }
  if (!n) return null;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), wf = new Float32Array(n), sum = new Map(); let o = 0;
  for (const [p, vc, vd, d0, mc, sc] of parts) {
    pos.set(p, o);
    for (let i = 0, j = o / 3; i < p.length; i += 3, j++) {
      if (vc) _hk.setRGB(vc[i], vc[i + 1], vc[i + 2]).multiply(mc); else _hk.copy(mc);
      wf[j] = inkLook(vd ? vd[i / 3] * sc : d0, t, _hk, ink, _hk); col[j * 3] = _hk.r; col[j * 3 + 1] = _hk.g; col[j * 3 + 2] = _hk.b;
    }
    o += p.length;
  }
  const keyOf = i => (Math.round(pos[i * 3] * 400) + 32768) + (Math.round(pos[i * 3 + 1] * 400) + 32768) * 65536 + (Math.round(pos[i * 3 + 2] * 400) + 32768) * 4294967296, keys = new Float64Array(n);
  for (let i = 0; i < n; i += 3) {
    _ha.fromArray(pos, i * 3); _hb.fromArray(pos, i * 3 + 3).sub(_ha); _hc.fromArray(pos, i * 3 + 6).sub(_ha); _hb.cross(_hc).normalize();
    for (let k = 0; k < 3; k++) { const key = keys[i + k] = keyOf(i + k); let v = sum.get(key); if (!v) sum.set(key, v = [0, 0, 0]); v[0] += _hb.x; v[1] += _hb.y; v[2] += _hb.z; }
  }
  for (let i = 0; i < n; i++) { const v = sum.get(keys[i]), l = Math.hypot(v[0], v[1], v[2]) || 1; nor[i * 3] = v[0] / l; nor[i * 3 + 1] = v[1] / l; nor[i * 3 + 2] = v[2] / l; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('inkf', new THREE.BufferAttribute(wf, 1));
  return g;
}
// The material for a hullGeo: pushes each point out by t times its own width factor, in its own line colour. Shared per t.
const hullMats = new Map();
export function hullMat(t) {
  const key = t.toFixed(4); let m = hullMats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }); m.userData.shared = true;
    m.onBeforeCompile = sh => { sh.vertexShader = 'attribute float inkf;\n' + sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * (${key} * inkf);`); };
    m.customProgramCacheKey = () => 'hull' + key; hullMats.set(key, m); }
  return m;
}
export function bake(root) {
  root.updateWorldMatrix(true, true); _inv.copy(root.matrixWorld).invert();
  const buckets = new Map(), gone = [];
  const walk = o => {
    for (const c of o.children) {
      if (c.userData.dyn || !c.visible) continue;
      const mt = c.material;
      if (c.isMesh && !c.isInstancedMesh && !c.children.length && mt.isMeshStandardMaterial && !mt.map && !mt.vertexColors && !c.userData.noInk) {
        const rough = Math.round(mt.roughness * 5) / 5, metal = Math.round(mt.metalness * 4) / 4, op = mt.transparent ? mt.opacity : 1;
        const key = [rough, metal, mt.side, op, mt.envMapIntensity, c.castShadow, c.receiveShadow].join();
        let b = buckets.get(key);
        if (!b) buckets.set(key, b = { parts: [], n: 0, rough, metal, side: mt.side, op, env: mt.envMapIntensity, cast: c.castShadow, recv: c.receiveShadow });
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        g.applyMatrix4(_bm.multiplyMatrices(_inv, c.matrixWorld));
        b.parts.push([g.attributes.position.array, g.attributes.normal.array, mt.color, partSize(c.geometry, _bm)]); b.n += g.attributes.position.count; g.dispose(); gone.push(c);
      } else walk(c);
    }
  };
  walk(root);
  for (const m of gone) m.parent.remove(m);
  for (const b of buckets.values()) {
    const pos = new Float32Array(b.n * 3), nor = new Float32Array(b.n * 3), col = new Float32Array(b.n * 3), sz = new Float32Array(b.n); let o = 0;
    for (const [p, n, c, d] of b.parts) {
      pos.set(p, o); nor.set(n, o); sz.fill(d, o / 3, (o + p.length) / 3);
      for (let i = 0; i < p.length; i += 3) { col[o + i] = c.r; col[o + i + 1] = c.g; col[o + i + 2] = c.b; }
      o += p.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('inkd', new THREE.BufferAttribute(sz, 1)); // each part's size, so the outline can stay thin on small parts (see inkLook)
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: b.rough, metalness: b.metal, side: b.side, transparent: b.op < 1, opacity: b.op, envMapIntensity: b.env }));
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.userData.baked = true; root.add(mesh);
  }
  return root;
}

// ---------- shared pieces ----------
const PI = Math.PI, SEG = 20, RS = 10;
const geos = new Map(), f3 = v => Math.round(v * 1000) / 1000;
const G = (k, f) => { let g = geos.get(k); if (!g) geos.set(k, g = f()); return g; };
const shade = (c, k) => { const o = new THREE.Color(c); return '#' + (k < 1 ? o.multiplyScalar(k) : o.lerp(new THREE.Color('#ffffff'), k - 1)).getHexString(); };
const fold = c => shade(c, new THREE.Color(c).getHSL({}).l > .5 ? .8 : 1.3); // a crease or pleat line that shows on dark cloth as well as light
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
const rAt = (pr, y) => { if (y <= pr[0][1]) return pr[0][0]; for (let i = 1; i < pr.length; i++) { const a = pr[i - 1], b = pr[i]; if (y <= b[1]) return a[0] + (b[0] - a[0]) * ((y - a[1]) / ((b[1] - a[1]) || 1)); } return 0; };
const slice = (pr, y0, y1, off) => { const out = [[rAt(pr, y0) + off, y0]]; for (const [r, y] of pr) if (y > y0 + .004 && y < y1 - .004 && r > 0) out.push([r + off, y]); out.push([rAt(pr, y1) + off, y1]); return out; };

// Parts are built as throwaway meshes that only carry a shape, a place and a colour; merge() then turns each
// moving piece (body, head, each arm) into one mesh with the colours stored per vertex.
const stub = new THREE.MeshBasicMaterial();
const put = (p, g, c, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, stub); o.userData.c = c; o.position.set(x, y, z); p.add(o); return o; };
const box = (p, w, h, d, c, x, y, z) => put(p, G('b' + [f3(w), f3(h), f3(d)], () => new THREE.BoxGeometry(w, h, d)), c, x, y, z);
const cyl = (p, rt, rb, h, c, x, y, z) => put(p, G('c' + [f3(rt), f3(rb), f3(h)], () => new THREE.CylinderGeometry(rt, rb, h, RS)), c, x, y, z);
const cone = (p, r, h, c, x, y, z) => put(p, G('k' + [f3(r), f3(h)], () => new THREE.ConeGeometry(r, h, RS)), c, x, y, z);
const sph = (p, r, c, x, y, z) => put(p, G('s' + f3(r), () => new THREE.SphereGeometry(r, 14, 10)), c, x, y, z);
const ring = (p, r, t, c, x, y, z, arc = PI * 2) => put(p, G('t' + [f3(r), f3(t), f3(arc)], () => new THREE.TorusGeometry(r, t, 6, 18, arc)), c, x, y, z);
const lathe = (p, pts, c, ph0 = -PI, len = PI * 2, seg = SEG, zk) => put(p, G('l' + pts.map(q => q.map(f3)).flat() + [seg, f3(ph0), f3(len), zk ? zk.key : ''], () => {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg, ph0, len);
  if (zk) { const q = g.attributes.position; for (let i = 0; i < q.count; i++) q.setZ(i, q.getZ(i) * zk.f(q.getY(i))); g.computeVertexNormals(); }
  return g;
}), c);
const part = (p, pts, c, mid, half, zk) => lathe(p, pts, c, mid - half, half * 2, Math.max(2, Math.round(SEG * half / PI)), zk);

const grad = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
// The ink outline is an inverted hull: a copy of each piece pushed out along its smoothed normals, drawn inside out.
// Big pieces (body, head, sleeves, hats) get the full OUTLINE; small ones get a thinner line in a dark shade of their
// own colour (inkLook), so pearls stay pearly and a tiny medal does not turn into a brown smudge.
const OUTLINE = .022, INK = new THREE.Color('#3a2630');
const lineMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
const inkOf = ch => {
  const d = partSize(ch.geometry, _m.multiplyMatrices(_i, ch.matrixWorld)), col = new THREE.Color();
  const f = inkLook(d, OUTLINE, new THREE.Color(ch.userData.c), INK, col);
  return { hard: HARD.has(ch.geometry.type), w: OUTLINE * f, col };
};
// Push one piece's vertices out along its normals. For boxes, cylinders and cones (hard edges) the normals are first
// averaged over vertices that share a spot, so the hull closes at the corners instead of splitting into loose flaps.
// Other shapes keep their own normals: hair and hat-pressed hair turn some normals inward on purpose to hide the line.
const HARD = new Set(['BoxGeometry', 'CylinderGeometry', 'ConeGeometry']);
const hullOf = (p, nn, w, out, at, hard) => {
  if (!hard) { for (let i = 0; i < p.length; i++) out[at + i] = p[i] + nn[i] * w; return; }
  const sum = new Map(), key = i => (Math.round(p[i] * 2000) + 8192) + (Math.round(p[i + 1] * 2000) + 8192) * 16384 + (Math.round(p[i + 2] * 2000) + 8192) * 268435456, keys = [];
  for (let i = 0; i < p.length; i += 3) { const k = key(i); keys.push(k); let v = sum.get(k); if (!v) sum.set(k, v = [0, 0, 0]); v[0] += nn[i]; v[1] += nn[i + 1]; v[2] += nn[i + 2]; }
  for (let i = 0, j = 0; i < p.length; i += 3, j++) { const v = sum.get(keys[j]), l = Math.hypot(v[0], v[1], v[2]) || 1;
    out[at + i] = p[i] + v[0] / l * w; out[at + i + 1] = p[i + 1] + v[1] / l * w; out[at + i + 2] = p[i + 2] + v[2] / l * w; }
};

// Merge every stub mesh of the avatar into ONE skinned mesh plus ONE skinned outline (2 draw calls, the face is the 3rd).
// The moving pieces (body, head, each arm and elbow, each leg and knee) are the skeleton's bones: they stay ordinary
// groups that games turn as before, and each point follows the bone it was built under. Limb tubes (see tube()) carry
// a second bone and a weight per point, so they bend smoothly at the elbow and knee instead of being separate pieces
// whose outlines would ring every joint. extra: [{ bone, pos, nor }] outline-only shapes (the face joins the head's rim).
const _m = new THREE.Matrix4(), _i = new THREE.Matrix4(), _c = new THREE.Color(), _jb = new THREE.Matrix4(), _jv = new THREE.Vector3(), _jw = new THREE.Vector3(), _jn = new THREE.Vector3(), _jm = new THREE.Vector3(), _bl = new THREE.Matrix4();
function merge(root, bones, mat, extra = []) {
  root.updateWorldMatrix(true, true); _i.copy(root.matrixWorld).invert();
  const bi = new Map(bones.map((b, i) => [b, i])), parts = [], gone = []; let n = 0;
  const walk = (o, b) => { for (const ch of o.children) {
    const cb = bi.has(ch) ? bi.get(ch) : b;
    if (ch.isMesh && ch.material === stub) {
      const ink = inkOf(ch);
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone(), jw = g.attributes.jw, cnt = g.attributes.position.count;
      const sk = new Uint8Array(cnt * 2), w = new Float32Array(cnt); sk.fill(cb);
      if (jw && ch.userData.jb) { // a limb tube: straight in its own bone's space; the far end follows the next bone
        const jb = ch.userData.jb, k2 = bi.get(jb), P = g.attributes.position, N = g.attributes.normal;
        _m.multiplyMatrices(_i, ch.matrixWorld); _jb.multiplyMatrices(_i, jb.matrixWorld).multiply(_bl.makeTranslation(-jb.position.x, -jb.position.y, -jb.position.z));
        for (let v = 0; v < cnt; v++) {
          const t = jw.getX(v); sk[v * 2 + 1] = k2; w[v] = t;
          _jv.fromBufferAttribute(P, v); _jw.copy(_jv).applyMatrix4(_jb); _jv.applyMatrix4(_m).lerp(_jw, t); P.setXYZ(v, _jv.x, _jv.y, _jv.z);
          _jn.fromBufferAttribute(N, v); _jm.copy(_jn).transformDirection(_jb); _jn.transformDirection(_m).lerp(_jm, t).normalize(); N.setXYZ(v, _jn.x, _jn.y, _jn.z);
        }
      } else g.applyMatrix4(_m.multiplyMatrices(_i, ch.matrixWorld));
      parts.push([g.attributes.position.array, g.attributes.normal.array, _c.set(ch.userData.c).clone(), ink, ch.userData.cs && g.attributes.tone ? [g.attributes.tone.array, ch.userData.cs.map(c => new THREE.Color(c))] : null, sk, w]); n += cnt; g.dispose(); gone.push(ch);
    } else walk(ch, cb);
  } };
  walk(root, 0);
  for (const m of gone) m.parent.remove(m);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), si = new Uint8Array(n * 4), sw = new Float32Array(n * 4);
  let ln = n; for (const e of extra) ln += e.pos.length / 3;
  const lpos = new Float32Array(ln * 3), lcol = new Float32Array(ln * 3), lsi = new Uint8Array(ln * 4), lsw = new Float32Array(ln * 4); let o = 0;
  const skinAt = (sI, sW, v, a, b, t) => { sI[v * 4] = a; sI[v * 4 + 1] = b; sW[v * 4] = 1 - t; sW[v * 4 + 1] = t; };
  for (const [p, nn, c, ink, tn, sk, w] of parts) {
    pos.set(p, o); nor.set(nn, o); for (let i = 0; i < p.length; i += 3) { const k = tn ? tn[1][Math.round(tn[0][i / 3])] : c; col[o + i] = k.r; col[o + i + 1] = k.g; col[o + i + 2] = k.b; } // hair carries a tone per point (see hair3d.js)
    hullOf(p, nn, ink.w, lpos, o, ink.hard); for (let i = 0; i < p.length; i += 3) { lcol[o + i] = ink.col.r; lcol[o + i + 1] = ink.col.g; lcol[o + i + 2] = ink.col.b; }
    for (let v = 0, q = o / 3 * 4; v < p.length / 3; v++, q += 4) { si[q] = sk[v * 2]; si[q + 1] = sk[v * 2 + 1]; sw[q] = 1 - w[v]; sw[q + 1] = w[v]; }
    o += p.length;
  }
  lsi.set(si); lsw.set(sw); // the outline's first n points are the model's own, in the same order
  for (const e of extra) { hullOf(e.pos, e.nor, OUTLINE, lpos, o, false); for (let i = 0; i < e.pos.length; i += 3) { lcol[o + i] = INK.r; lcol[o + i + 1] = INK.g; lcol[o + i + 2] = INK.b; skinAt(lsi, lsw, (o + i) / 3, bi.get(e.bone), 0, 0); } o += e.pos.length; }
  // each bone's bounds in its own space, from the outline (it wraps the model): ob its own points, bb with its elbow or
  // knee as well (an arm or a leg as one part, for partBox())
  const inv = bones.map(b => _m.multiplyMatrices(_i, b.matrixWorld).clone().invert().elements), lo = new Float32Array(bones.length * 6).fill(Infinity), hi = new Float32Array(bones.length * 6).fill(-Infinity);
  const grow = (j, x, y, z, o) => { const e = inv[j], q = j * 6 + o; // o 0: the bone's own points, 3: with its elbow or knee
    const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
    if (X < lo[q]) lo[q] = X; if (X > hi[q]) hi[q] = X; if (Y < lo[q + 1]) lo[q + 1] = Y; if (Y > hi[q + 1]) hi[q + 1] = Y; if (Z < lo[q + 2]) lo[q + 2] = Z; if (Z > hi[q + 2]) hi[q + 2] = Z; };
  const up = bones.map(b => b.userData.sub ? bi.get(b.parent) : -1);
  for (let v = 0; v < ln; v++) { const k = lsw[v * 4 + 1] > .5 ? lsi[v * 4 + 1] : lsi[v * 4], x = lpos[v * 3], y = lpos[v * 3 + 1], z = lpos[v * 3 + 2];
    grow(k, x, y, z, 0); if (up[k] >= 0) grow(up[k], x, y, z, 3); }
  bones.forEach((b, j) => { const q = j * 6, ob = new THREE.Box3(new THREE.Vector3(lo[q], lo[q + 1], lo[q + 2]), new THREE.Vector3(hi[q], hi[q + 1], hi[q + 2]));
    b.userData.ob = ob; b.userData.bb = ob.clone().union(new THREE.Box3(new THREE.Vector3(lo[q + 3], lo[q + 4], lo[q + 5]), new THREE.Vector3(hi[q + 3], hi[q + 4], hi[q + 5]))); });
  const sk = new THREE.Skeleton(bones);
  const mk = (geo, m) => { const s = new THREE.SkinnedMesh(geo, m); s.userData.baked = true; root.add(s); s.bind(sk, root.matrixWorld); return s; };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lcol, 3));
  lg.setAttribute('skinIndex', new THREE.BufferAttribute(lsi, 4)); lg.setAttribute('skinWeight', new THREE.BufferAttribute(lsw, 4));
  const mesh = mk(g, mat), line = mk(lg, lineMat); mesh.castShadow = true; mesh.receiveShadow = true;
  // bounds for culling, wide enough for any arm swing or stride (computing them from the bones would skin every point on the CPU)
  lg.computeBoundingSphere(); for (const s of [mesh, line]) { s.boundingSphere = lg.boundingSphere.clone(); s.boundingSphere.radius *= 1.25; }
  // Box3.setFromObject reads boundingBox: give the box of the pose it is in now, from the bones (three would skin every
  // point on the CPU once and then keep that box whatever the avatar does later)
  const box = new THREE.Box3(), _bx = new THREE.Box3();
  const now = () => { box.makeEmpty(); root.updateWorldMatrix(true, true); _jb.copy(mesh.matrixWorld).invert();
    for (const b of bones) if (!b.userData.ob.isEmpty()) box.union(_bx.copy(b.userData.ob).applyMatrix4(_bl.multiplyMatrices(_jb, b.matrixWorld)));
    return box; };
  for (const s of [mesh, line]) Object.defineProperty(s, 'boundingBox', { get: now, set() {}, configurable: true });
  return mesh;
}
// Where a part of an avatar is, in world space: its bone's own bounds (see merge) plus any separate meshes on it.
// Use it instead of Box3.setFromObject on ud.head, an arm or a leg: their shape now lives in the avatar's one skinned mesh.
const _pbx = new THREE.Box3();
export function partBox(o, out = new THREE.Box3()) {
  o.updateWorldMatrix(true, true); out.makeEmpty();
  if (o.userData.bb && !o.userData.bb.isEmpty()) out.copy(o.userData.bb).applyMatrix4(o.matrixWorld);
  return out.union(_pbx.setFromObject(o));
}
// One limb as a single tube round its bone's y axis, so arm or leg, joint and outline are all one smooth piece.
// prof: [[r, y, tone], ...] from the top down (r 0 at an end closes it); tones index cs (the colours along it).
// Points below the joint at y = jy follow the bone jb, blended over (jy + up) .. (jy - down) so it bends round.
const tube = (p, prof, cs, jb, jy, up, down) => {
  const S = SEG, pos = [], nor = [], tone = [], jw = [], idx = [], L = prof.length;
  const at = j => { let a = j, b = j; while (a > 0 && prof[a - 1][0] === prof[j][0] && prof[a - 1][1] === prof[j][1]) a--; while (b < L - 1 && prof[b + 1][0] === prof[j][0] && prof[b + 1][1] === prof[j][1]) b++; return [prof[Math.max(0, a - 1)], prof[Math.min(L - 1, b + 1)]]; };
  for (let j = 0; j < L; j++) {
    const [r, y, t] = prof[j], [A, B] = at(j); let nr = A[1] - B[1], ny = B[0] - A[0]; const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
    if (r === 0) { nr = 0; ny = j ? -1 : 1; } // the round ends
    const u = Math.min(1, Math.max(0, (jy + up - y) / (up + down))), wt = u * u * (3 - 2 * u);
    for (let i = 0; i <= S; i++) { const ph = i / S * PI * 2, sn = Math.sin(ph), cs2 = Math.cos(ph); pos.push(r * sn, y, r * cs2); nor.push(nr * sn, ny, nr * cs2); tone.push(t); jw.push(wt); }
  }
  for (let j = 0; j < L - 1; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + S + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('tone', new THREE.Float32BufferAttribute(tone, 1)); g.setAttribute('jw', new THREE.Float32BufferAttribute(jw, 1)); g.setIndex(idx);
  const o = put(p, g, cs[0]); o.userData.cs = cs; o.userData.jb = jb; return o;
};
// a profile point list with extra rings every d between y0 and y1 (so a bend has rings to bend with)
const rings = (pr, y0, y1, d) => { const out = []; for (let j = 0; j < pr.length; j++) { out.push(pr[j]); const b = pr[j + 1]; if (!b) break; const a = pr[j];
  const lo = Math.max(Math.min(a[1], b[1]), y1), hi = Math.min(Math.max(a[1], b[1]), y0); if (hi - lo < d * 1.5 || a[1] === b[1]) continue;
  const k = Math.ceil((hi - lo) / d); for (let q = 1; q < k; q++) { const y = a[1] > b[1] ? hi - (hi - lo) * q / k : lo + (hi - lo) * q / k, f = (y - a[1]) / (b[1] - a[1]); if (f > 0 && f < 1) out.push([a[0] + (b[0] - a[0]) * f, y, a[2]]); } }
  return out; };

// ---------- the head: a round shape with the face painted on, like an anime figure ----------
// A "marshmallow" head: full cheeks, a nearly flat underside and a flattish top, so the jaw never narrows to a cone at the neck.
const FSH = [{ R: .5, a: 4.56, b: .33, h: 1 }, { R: .465, a: 4.08, b: .352, h: 1.05 }, { R: .5, a: 7.2, b: .275, h: .97 }, { R: .5, a: 2.7, b: .44, h: 1 }, { R: .45, a: 4.56, b: .33, h: 1.12 }];
const headR = (f, y) => { const F = FSH[f], c = .47; if (y >= c) return F.R * Math.pow(Math.max(0, 1 - Math.pow((y - c) / (1 - c), 3)), .45); return F.R * Math.pow(Math.max(0, 1 - Math.pow((c - y) / c, F.a)), F.b); };
const EYE = [[.072, .1], [.09, .072], [.09, .05], [.086, .118], [.074, .1], [.078, .106], [.08, .09], [.03, .04], [.07, .06], [.082, .09], [.072, .098], [.072, .1], [.076, .102], [.08, .1], [.07, .07], [.084, .11]];
const TILT = [0, .24, .06, 0, 0, 0, -.24, 0, 0, .16, 0, 0, 0, 0, 0, 0];

// The face is drawn on a canvas that wraps once round the head (the front is the middle of the canvas).
function paintFace(a, closed) {
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const skin = SKINS[a.skin], hair = HAIR_COLS[a.hairC], ink = a.skin >= 3 && a.skin !== 6 ? '#1c0f0a' : '#2a1712', browC = mix(hair, '#2a1712', .4), lip = mix(skin, '#8a2f3a', .75);
  x.fillStyle = skin; x.fillRect(0, 0, W, H);
  const X = p => W * (p + PI) / (2 * PI), V = y => H * (1 - Math.acos(1 - 2 * y) / PI);
  const at = (px, py, fn) => {
    const r = headR(a.face, py), p = Math.asin(Math.max(-1, Math.min(1, px / r))), th = Math.acos(1 - 2 * py);
    x.save(); x.translate(X(p), V(py)); x.scale(W / (2 * PI * r), -2 * H / (PI * Math.sin(th))); x.lineCap = 'round'; x.lineJoin = 'round'; fn(); x.restore();
  };
  const ex = .18, ey = .4, [hw, hh] = EYE[a.eyes], fh = a.facial;
  // stubble is painted as speckles over the jaw (the other facial hair is modelled, see beardGeo)
  if (fh === 1) {
    x.fillStyle = mix(skin, hair, a.skin >= 4 && a.skin !== 6 ? .7 : .5);
    for (let i = 0; i < 420; i++) {
      const p = ((i * .618034) % 1 - .5) * 3.1, py = .025 + ((i * .754877) % 1) * .4, k = Math.min(1, Math.max(0, (Math.abs(p) - .55) / .6)), r = headR(a.face, py);
      if (py > .285 + k * k * (3 - 2 * k) * .14) continue;                                                  // under the nose at the front, up to the ears at the sides
      const px = Math.sin(p) * r; if (Math.abs(p) < .5 && Math.hypot(px / .085, (py - .19) / .042) < 1) continue; // not on the lips
      x.beginPath(); x.ellipse(X(p), V(py), 1.7, 1.7 * Math.min(2.2, 1 / Math.sin(Math.acos(1 - 2 * py))), 0, 0, PI * 2); x.fill();
    }
  }
  // blush, freckles, mole
  for (const s of [-1, 1]) at(s * (ex + .07), ey - .15, () => { const g = x.createRadialGradient(0, 0, 0, 0, 0, .07); g.addColorStop(0, 'rgba(255,105,130,' + (a.marks === 2 ? .75 : .38) + ')'); g.addColorStop(1, 'rgba(255,105,130,0)'); x.fillStyle = g; x.scale(1, .62); x.beginPath(); x.arc(0, 0, .07, 0, PI * 2); x.fill(); });
  if (a.marks === 1) for (const s of [-1, 1]) for (const [dx, dy] of [[0, 0], [.04, -.02], [-.035, -.025], [.01, -.045]]) at(s * (ex + .05 + dx), ey - .13 + dy, () => { x.fillStyle = shade(skin, .68); x.beginPath(); x.arc(0, 0, .008, 0, PI * 2); x.fill(); });
  const star = (r, k = .42) => { x.beginPath(); for (let i = 0; i < 10; i++) { const an = PI / 2 + i * PI / 5, rr = i % 2 ? r * k : r; x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } x.closePath(); x.fill(); };
  const heart = q => { x.beginPath(); x.moveTo(0, -q * .9); x.bezierCurveTo(q * 1.6, q * .2, q * .7, q * 1.3, 0, q * .5); x.bezierCurveTo(-q * .7, q * 1.3, -q * 1.6, q * .2, 0, -q * .9); x.fill(); };
  if (a.marks === 4) at(.25, .27, () => { x.fillStyle = '#ffc93c'; star(.045); });
  if (a.marks === 5) for (const s of [-1, 1]) at(s * (ex + .08), ey - .15, () => { x.fillStyle = '#ff5d8f'; heart(.03); });
  if (a.marks === 6) at(-.24, .25, () => { x.rotate(.5); x.fillStyle = '#ffffff'; x.strokeStyle = '#b8865a'; x.lineWidth = .01; x.fillRect(-.07, -.024, .14, .048); x.strokeRect(-.07, -.024, .14, .048); x.fillStyle = '#efc3a4'; x.fillRect(-.022, -.024, .044, .048); });
  if (a.marks === 7) for (const s of [-1, 1]) at(s * .2, .22, () => { x.strokeStyle = ink; x.lineWidth = .007; x.beginPath(); for (const k of [-1, 0, 1]) { x.moveTo(s * -.04, k * .012); x.lineTo(s * .06, k * .03); } x.stroke(); });
  if (a.marks === 3) at(.13, .17, () => { x.fillStyle = '#3b2219'; x.beginPath(); x.arc(0, 0, .011, 0, PI * 2); x.fill(); });
  // eyes
  const ic = EYE_COLS[a.eyeC];
  for (const s of [-1, 1]) at(s * ex, ey, () => {
    const e = a.eyes; x.strokeStyle = ink; x.rotate(s * TILT[e]);
    if (e === 14) { x.lineWidth = .024; x.beginPath(); x.moveTo(-hw * .8, -hh * .7); x.lineTo(hw * .8, hh * .7); x.moveTo(-hw * .8, hh * .7); x.lineTo(hw * .8, -hh * .7); x.stroke(); return; }
    if (closed && e !== 8) { x.lineWidth = .02; x.beginPath(); x.moveTo(-hw, .005); x.quadraticCurveTo(0, -hh * .55, hw, .005); x.stroke(); return; }
    if (e === 8 || (e === 11 && s === 1)) { x.lineWidth = .024; x.beginPath(); x.moveTo(-hw, -hh * .3); x.quadraticCurveTo(0, hh * 1.1, hw, -hh * .3); x.stroke(); return; }
    if (e === 7) { x.fillStyle = ink; x.beginPath(); x.ellipse(0, 0, hw, hh, 0, 0, PI * 2); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(-hw * .3, hh * .35, hw * .3, 0, PI * 2); x.fill(); return; }
    if (e === 13) { x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(0, 0, hw, hh, 0, 0, PI * 2); x.fill(); x.lineWidth = .02; x.stroke(); x.lineWidth = .013; x.beginPath(); for (let i = 0; i <= 60; i++) { const an = i / 60 * PI * 6, r = hw * .9 * i / 60; x.lineTo(Math.cos(an) * r, Math.sin(an) * r * hh / hw); } x.stroke(); return; }
    x.save(); x.beginPath(); x.ellipse(0, 0, hw, hh, 0, 0, PI * 2); x.fillStyle = '#ffffff'; x.fill(); x.clip();
    const g = x.createLinearGradient(0, hh, 0, -hh); g.addColorStop(0, shade(ic, .3)); g.addColorStop(.5, ic); g.addColorStop(1, shade(ic, 1.55));
    x.fillStyle = g; x.beginPath(); x.ellipse(0, -hh * .04, hw * (e === 1 || e === 2 ? .7 : .84), hh * .94, 0, 0, PI * 2); x.fill();
    if (e === 15) { x.fillStyle = '#1a1014'; x.beginPath(); x.ellipse(0, hh * .05, hw * .4, hh * .44, 0, 0, PI * 2); x.fill(); x.fillStyle = '#fff6c8'; x.beginPath(); for (let i = 0; i < 10; i++) { const an = PI / 2 + i * PI / 5, rr = (i % 2 ? .4 : 1) * hw * .42; x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr * hh / hw); } x.fill(); }
    else if (e === 12) { x.fillStyle = '#ff5d8f'; x.beginPath(); const q = hw * .5; x.moveTo(0, -q * .9); x.bezierCurveTo(q * 1.6, q * .2, q * .7, q * 1.3, 0, q * .5); x.bezierCurveTo(-q * .7, q * 1.3, -q * 1.6, q * .2, 0, -q * .9); x.fill(); }
    else { x.fillStyle = '#1a1014'; x.beginPath(); x.ellipse(0, hh * .05, hw * (e === 9 ? .12 : .36), hh * (e === 9 ? .72 : .4), 0, 0, PI * 2); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(0, -hh * .62, hw * .5, hh * .2, 0, 0, PI * 2); x.fill();
    if (e === 4 || e === 2) { x.fillStyle = shade(skin, .93); x.fillRect(-hw * 1.2, hh * (e === 2 ? .45 : .25), hw * 2.4, hh); }
    x.restore();
    const top = e === 4 ? hh * .25 : e === 2 ? hh * .45 : hh, big = e === 5 || e === 3 ? 1.3 : 1;
    x.fillStyle = '#ffffff';
    x.beginPath(); x.ellipse(-hw * .3, Math.min(top * .5, hh * .42), hw * .27 * big, hh * .21 * big, 0, 0, PI * 2); x.fill();
    x.beginPath(); x.ellipse(hw * .34, -hh * .36, hw * .14 * big, hh * .11 * big, 0, 0, PI * 2); x.fill();
    if (e === 5) { const st = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 8; i++) { const an = i * PI / 4, rr = i % 2 ? r * .35 : r; x.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * hh / hw); } x.fill(); }; st(hw * .3, hh * .3, hw * .3); st(-hw * .42, -hh * .25, hw * .18); }
    x.lineWidth = .024; x.beginPath();
    if (e === 4 || e === 2) { x.moveTo(-hw * 1.05, top); x.lineTo(hw * 1.05, top); } else { x.moveTo(-hw * 1.08, hh * .18); x.bezierCurveTo(-hw * .85, hh * 1.22, hw * .85, hh * 1.22, hw * 1.08, hh * .18); }
    x.moveTo(s * hw * 1.02, top * .45); x.lineTo(s * hw * 1.38, top * .45 + hh * (e === 6 ? -.1 : .3)); x.stroke();
    if (e === 10) { x.lineWidth = .014; for (const k of [.35, .62, .86]) { x.beginPath(); x.moveTo(s * hw * k, hh * (1.05 - k * .3)); x.lineTo(s * hw * (k + .22), hh * (1.42 - k * .3)); x.stroke(); } }
    x.lineWidth = .008; x.globalAlpha = .6; x.beginPath(); x.moveTo(-hw * .6, -hh * .86); x.quadraticCurveTo(0, -hh * 1.1, hw * .6, -hh * .86); x.stroke();
  });
  // brows
  const by = ey + Math.max(hh, .07) + .05, b = a.brows;
  if (b !== 6) for (const s of [-1, 1]) at(s * ex, by, () => {
    x.strokeStyle = browC; x.lineWidth = b === 2 ? .03 : b === 3 ? .01 : .018; x.beginPath();
    if (b === 1) { x.moveTo(-.06, -.012); x.quadraticCurveTo(0, .035, .06, -.012); }
    else if (b === 4) { x.moveTo(-s * .055, -.022); x.lineTo(s * .06, .02); }
    else if (b === 5) { x.moveTo(-s * .055, .02); x.lineTo(s * .06, -.014); }
    else { x.moveTo(-.058, 0); x.quadraticCurveTo(0, .012, .058, 0); }
    x.stroke();
  });
  // nose: barely there
  at(0, .285, () => {
    x.strokeStyle = shade(skin, .7); x.fillStyle = shade(skin, .7); x.lineWidth = .011; x.beginPath(); const n = a.nose;
    if (n === 0) { x.arc(0, 0, .008, 0, PI * 2); x.fill(); }
    if (n === 1) { x.moveTo(-.004, .02); x.lineTo(.012, -.006); x.lineTo(-.006, -.01); x.stroke(); }
    if (n === 2) { x.arc(-.014, 0, .006, 0, PI * 2); x.arc(.014, 0, .006, 0, PI * 2); x.fill(); }
    if (n === 3) { x.moveTo(.004, .03); x.lineTo(.004, -.008); x.stroke(); }
    if (n === 4) { x.moveTo(-.014, .004); x.quadraticCurveTo(0, -.016, .014, .004); x.stroke(); }
  });
  // mouth
  at(0, .19, () => {
    const m = a.mouth; x.strokeStyle = lip; x.lineWidth = .014; x.beginPath();
    if (m === 0) { x.moveTo(-.045, .012); x.quadraticCurveTo(0, -.034, .045, .012); x.stroke(); }
    if (m === 1) { x.moveTo(-.058, .018); x.lineTo(.058, .018); x.bezierCurveTo(.055, -.07, -.055, -.07, -.058, .018); x.fillStyle = '#8a2f3a'; x.fill(); x.stroke(); x.fillStyle = '#ffffff'; x.fillRect(-.04, .0, .08, .014); x.fillStyle = '#ff8fa0'; x.beginPath(); x.ellipse(0, -.036, .024, .012, 0, 0, PI * 2); x.fill(); }
    if (m === 2) { x.moveTo(-.035, 0); x.lineTo(.035, 0); x.stroke(); }
    if (m === 3) { x.ellipse(0, -.006, .026, .036, 0, 0, PI * 2); x.fillStyle = '#8a2f3a'; x.fill(); x.fillStyle = '#ff8fa0'; x.beginPath(); x.ellipse(0, -.026, .016, .012, 0, 0, PI * 2); x.fill(); }
    if (m === 4) { x.moveTo(-.04, -.006); x.quadraticCurveTo(.01, -.03, .05, .022); x.stroke(); }
    if (m === 5) { x.ellipse(0, 0, .02, .015, 0, 0, PI * 2); x.fillStyle = '#e8707e'; x.fill(); }
    if (m === 7) { x.moveTo(-.045, .012); x.quadraticCurveTo(0, -.034, .045, .012); x.stroke(); x.fillStyle = '#ffffff'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * .034, .002); x.lineTo(s * .018, -.006); x.lineTo(s * .028, -.032); x.fill(); } }
    if (m === 8) { x.fillStyle = '#ff7a8f'; x.beginPath(); x.ellipse(.008, -.024, .02, .026, 0, 0, PI * 2); x.fill(); x.beginPath(); x.moveTo(-.045, .006); x.quadraticCurveTo(0, -.02, .045, .006); x.stroke(); }
    if (m === 9) { x.moveTo(-.05, 0); for (let i = 1; i <= 5; i++) x.lineTo(-.05 + i * .02, i % 2 ? -.012 : 0); x.stroke(); }
    if (m === 6) { x.moveTo(-.05, .012); x.quadraticCurveTo(-.025, -.03, 0, .01); x.quadraticCurveTo(.025, -.03, .05, .012); x.stroke(); }
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Beards are modelled like the hair: a chunky shell hugging the jaw. Its upper edge is `front` under the mouth and rises to
// `side` (sideburns) between the angles th0 and th1; it ends at tmax, just in front of the ears. `drop` is how far it
// hangs below the chin, `jag` cuts the lower edge into tufts.
const beardGeo = (f, front, side, th0, th1, tmax, off, drop, jag) => G('fh' + [f, front, side, th0, th1, tmax, off, drop, jag].map(f3), () => {
  const NU = 20, NV = 5, pos = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const th = (i / NU * 2 - 1) * tmax, at = Math.abs(th), k = Math.min(1, Math.max(0, (at - th0) / (th1 - th0))), sm = k * k * (3 - 2 * k);
    const top = front + (side - front) * sm, bot = -(drop + (i % 2 ? jag : 0)) * (1 - sm) + .03 * sm, edge = Math.min(1, (tmax - at) / .1);
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, y = bot + (top - bot) * v, under = y < 0 ? 1 - .5 * Math.pow(y / bot, 2) * (1 - sm) : 1;
      const o = j === NV ? -.012 : j === 0 ? off * .35 * edge : off * (v > .7 ? .75 : 1) * edge - .012 * (1 - edge);
      const r = headR(f, Math.max(y, .07)) * under + o; pos.push(Math.sin(th) * r, y, Math.cos(th) * r);
      if (i < NU && j < NV) { const q = i * (NV + 1) + j; idx.push(q, q + NV + 1, q + 1, q + 1, q + NV + 1, q + NV + 2); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
});

// ---------- the avatar ----------
// Pocket chibi proportions: 2.5 heads tall.
const P = { N: 2.5, hw: 1.04, leg: .27, limb: 1.9, wide: 1.4, arm: .66 };
const BODIES = [ // shoulder, chest, waist, hip (radius / height), limb radius, depth
  { sh: .1, ch: .082, wa: .066, hi: .076, lb: .021, dz: .6 }, { sh: .115, ch: .097, wa: .084, hi: .09, lb: .025, dz: .62 }, { sh: .135, ch: .112, wa: .082, hi: .088, lb: .029, dz: .62 },
  { sh: .145, ch: .128, wa: .118, hi: .112, lb: .033, dz: .68 }, { sh: .106, ch: .1, wa: .074, hi: .106, lb: .026, dz: .64 }, { sh: .126, ch: .118, wa: .116, hi: .118, lb: .031, dz: .74 }];
const SIT_K = 1.48, STAND_K = 1.2; // model units -> scene units, so a seated head tops out near y = 2.1

// ---------- hats over hair ----------
// Hair styles are free-form, so instead of a hand-made offset for every hat and hair pair the hair is fitted to the hat:
// a hat that covers the skull squashes all the hair above its brim onto a thin shell just over the skull (hair below
// the brim, like bangs, tails and braids, stays as it is), and a small topper (ears, crown, horns...) sitting on big hair
// is moved out to the hair's surface, with any hair still poking up through it pressed down under it.
// All in head space (chin at 0, crown at 1); C is roughly the middle of the skull.
const HAT_BRIM = { 1: .72, 2: .76, 3: .88, 9: .8, 10: .86, 11: .87, 13: .9, 14: .93, 16: .82, 17: .72, 19: .76, 20: .64, 21: .86, 22: .92, 26: .87, 27: .62,
  29: .9, 30: .8, 32: .74, 33: .72, 36: .66, 39: .8, 40: .8, 48: .7, 49: .74, hood: .76 };
// Helmets and hoods also wrap the back and sides of the head, so hair there is pressed flat as well ('hood' is the
// pulled-up hood of a costume top, which has no hat number).
const HAT_WRAP = [32, 33, 'hood'], WRAP_AT = { hood: .92 }; // how far round from the front the sides start (radians)
// A headband (headphones, earmuffs) stays its own size on big hair and presses a groove into it instead.
const HAT_BAND = [6, 31, 38];
const HAT_TOP = [4, 5, 6, 7, 8, 12, 15, 18, 23, 24, 25, 28, 31, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47], SHELL = 1.12;
// envT (hair3d.js): how far from C along the unit direction d you can go and still be inside the skull grown sideways
// by o, the way hair and hat shells are made. skullT is the bare skull.
const skullT = (hr, d) => envT(hr, d, 0);
function fitHat(hg, hH, hT, hat, hr) {
  const brim = HAT_BRIM[hat], top = HAT_TOP.includes(hat), wa = WRAP_AT[hat] || 1.44, wrap = HAT_WRAP.includes(hat) ? (x, z) => Math.atan2(Math.abs(x), z) > wa : () => false, made = [];
  if (brim == null && !top) return made;
  hg.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(hg.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), d = new THREE.Vector3();
  // every hair vertex in head space, mesh by mesh
  const hair = []; hH.traverse(o => { if (o.isMesh) { m.multiplyMatrices(inv, o.matrixWorld); hair.push({ o, m: m.clone() }); } });
  for (const h of hair) { const p = h.o.geometry.attributes.position, pts = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(h.m); pts.set([v.x, v.y, v.z], i * 3); } h.pts = pts; }
  // limit(x, y, z, d) -> the farthest from C that point may be, or Infinity
  const squash = (limit, under = () => true) => { for (const h of hair) {
    let hit = false; const q = h.pts, hid = [];
    for (let i = 0; i < q.length; i += 3) {
      v.set(q[i], q[i + 1], q[i + 2]).sub(HC); const L = v.length(); if (L < 1e-4) continue; d.copy(v).divideScalar(L);
      const T = limit(q[i], q[i + 1], q[i + 2], d); if (L <= T) continue;
      const ox = q[i], oy = q[i + 1], oz = q[i + 2]; q[i] = HC.x + d.x * T; q[i + 1] = HC.y + d.y * T; q[i + 2] = HC.z + d.z * T; hit = true; if (under(ox, oy, oz)) hid.push(i, -d.x, -d.y, -d.z);
    }
    if (!hit) continue;
    // swap in a squashed copy of the shape, already placed, so the shared shape stays untouched
    const g = h.o.geometry.clone(); g.attributes.position.array.set(q); g.attributes.position.needsUpdate = true; g.computeVertexNormals(); made.push(g);
    // pressed points are hidden under the hat; turn their normals inward so their outline cannot show through it
    const nr = g.attributes.normal.array; for (let j = 0; j < hid.length; j += 4) nr.set([hid[j + 1], hid[j + 2], hid[j + 3]], hid[j]);
    const o = h.o; o.geometry = g; o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); hH.add(o);
  } };
  if (brim != null) {
    // fade in over a short band at the brim so a clump crossing it does not get a hard step
    squash((x, y, z, d) => y < brim && wrap(x, z) ? envT(hr, d, .012) : y < brim - .06 ? Infinity : envT(hr, d, y > brim ? .012 : .012 + (brim - y) / .06 * .25), (x, y, z) => y > brim || wrap(x, z));
    return made;
  }
  // toppers: find how far out the hair reaches under each piece and move the whole hat out by the most any piece needs
  // a piece centred on the head (the headphone band) arches over it, so it is checked straight up against its own reach
  // Each piece looks along its own direction d from C; seat is how close to C it comes along d, as a multiple of the
  // skull there. A piece centred on the head (the headphone band) arches over it, so it looks straight up.
  const up = new THREE.Vector3(0, 1, 0), pieces = hT.children.filter(o => o.isMesh).map(o => {
    o.geometry.boundingSphere || o.geometry.computeBoundingSphere(); const c = o.position.clone().sub(HC), L = c.length(), br = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
    if (L < .2) return { d: up, over: dd => dd.y > .25 && Math.abs(dd.z) < .14, sk: skullT(hr, up), near: br - .05 };
    const d = c.divideScalar(L), cos = Math.cos(Math.max(.3, Math.min(.5, Math.atan2(br, L)))), p = o.geometry.attributes.position; o.updateMatrix(); let near = Infinity;
    for (let i = 0; i < p.count; i++) near = Math.min(near, v.fromBufferAttribute(p, i).applyMatrix4(o.matrix).sub(HC).dot(d));
    return { d, over: dd => dd.dot(d) > cos, sk: skullT(hr, d), near: Math.max(.1, near) };
  });
  // How much thicker than usual the hair is over the top of the head: the outer surface of the hair (the farthest
  // point in each of a set of directions) in the middle direction. Only hair that is big all over (an afro, curls)
  // counts, since a quiff, a bun or spikes cover only a few directions; the hat then moves out by that much, and
  // whatever still sticks up under it is pressed down instead.
  const far = new Float32Array(36);
  for (const h of hair) for (let i = 0; i < h.pts.length; i += 3) {
    v.set(h.pts[i], h.pts[i + 1], h.pts[i + 2]).sub(HC); const L = v.length(); if (L < 1e-4) continue; d.copy(v).divideScalar(L); if (d.y <= .5) continue;
    const b = Math.min(2, Math.floor((d.y - .5) / .5 * 3)) * 12 + Math.floor((Math.atan2(d.x, d.z) + PI) / (2 * PI) * 12) % 12; far[b] = Math.max(far[b], L / skullT(hr, d));
  }
  const x = [...far].sort((a, b) => a - b)[18];
  let s = 1;
  for (const p of pieces) s = Math.max(s, 1 + Math.max(0, x - SHELL) * p.sk / p.near);
  s = Math.max(1, Math.min(s, 1.9));
  // a headband on big hair: the cups stay on the ears and only the band is stretched, into a taller arch that clears the hair
  const bandM = HAT_BAND.includes(hat) && hT.children.find(o => o.isMesh && o.geometry.parameters?.arc);
  if (bandM) {
    if (s > 1.02) { const R = bandM.geometry.parameters.radius; let sy = 1;
      for (const h of hair) for (let i = 0; i < h.pts.length; i += 3) { const px = Math.abs(h.pts[i]), py = h.pts[i + 1] - HC.y; if (py > .15 && Math.abs(h.pts[i + 2]) < .3 && px < R * .9) sy = Math.max(sy, py / (R * Math.sqrt(1 - (px / R) ** 2))); }
      sy = Math.min(sy, 1.9); bandM.scale.y = sy; bandM.position.y = HC.y + (bandM.position.y - HC.y) * sy;
      squash((x, y, z, dd) => y > HC.y && Math.abs(z) < .16 ? (R - .02) / Math.hypot(dd.x, dd.y / sy) : Infinity); return made; }
    s = 1;
  }
  // grow only a little and carry the rest as a move outwards, so a duck or a horn does not double in size on an afro
  if (s > 1.02) { const sc = Math.min(s, 1.2), cen = new THREE.Vector3(); let near = Infinity; for (const o of hT.children) cen.add(o.position); for (const p of pieces) near = Math.min(near, p.near);
    cen.divideScalar(hT.children.length || 1).sub(HC).normalize(); hT.scale.setScalar(sc); hT.position.copy(HC).multiplyScalar(1 - sc).addScaledVector(cen, (s - sc) * near); }
  // whatever still pokes up under a piece (spikes, a bun) is pressed down to just under it
  const lifted = s > 1.02 ? s : 1;
  squash((x, y, z, dd) => { for (const p of pieces) if (p.over(dd)) return skullT(hr, dd) * (Math.max(p.near * lifted / p.sk, SHELL) - .02); return Infinity; });
  return made;
}

// Costume tops that dress the legs too (their leg colour), and the tops that are long enough to hide any bottom.
const LLAMA = '#e8cda0', SUITS = { 23: '#62c267', 24: '#ffd93b', 25: '#f7f5ee', 26: '#2b2228', 29: '#1c1a22', 38: LLAMA };
export const hidesBottom = top => top === 6 || top === 15 || top === 32 || top in SUITS;

// ---------- things to hold ----------
// Drawn in a frame at the centre of the mitten: y up, z towards the front, x to the avatar's left (the side it is held on).
// u scales with the avatar's height, r is the mitten's radius (a grip should pass through it, not float beside it).
// Items in HANG are carried at the side with the arm down; the rest are held up in front, forearm forward.
const HANG = [2, 5, 9, 13, 16, 17, 18], HAND_LEAN = { z: .3, x: .2 }, WIDE = [4, 10, 12, 20, 21];
function handItem(p, i, u, r, { gold, COFFEE, LATTE, CREAM }) {
  // a star of five flat points round (x, y, z), facing the front
  const star = (R, c, x, y, z) => { for (let k = 0; k < 5; k++) { const an = k / 5 * PI * 2, pt = cone(p, R * .42, R, c, x - Math.sin(an) * R * .5, y + Math.cos(an) * R * .5, z); pt.rotation.z = an; pt.scale.z = .45; } sph(p, R * .36, c, x, y, z).scale.z = .55; };
  const bloom = (x, y, z, R, c, mid = '#ffd23f') => { for (let k = 0; k < 5; k++) { const an = k / 5 * PI * 2 + .3, pe = sph(p, R * .55, c, x + Math.cos(an) * R * .55, y + Math.sin(an) * R * .55 * .5, z + Math.sin(an) * R * .55 * .86); pe.scale.set(1, .5, 1); } sph(p, R * .36, mid, x, y + R * .12, z); };
  const leaf = (x, y, z, R, an, c = '#58b356') => { const l = sph(p, R, c, x, y, z); l.scale.set(.45, 1, .16); l.rotation.set(0, PI / 2, an); return l; };
  // a carrying handle: an arch from the mitten down to the item's rim (top y), w wide
  const handle = (w, y, c, t = .016) => { const h = ring(p, w / 2, t * u, c, 0, y, 0, PI); h.rotation.y = PI / 2; h.scale.y = (-y + r * .2) / (w / 2); h.position.y = y; return h; };
  if (i === 1) { // flower: one long stem with a leaf and a pink bloom
    cyl(p, .014 * u, .014 * u, .5 * u, '#3f9a4a', 0, .2 * u, 0); leaf(.035 * u, .22 * u, 0, .07 * u, -.6);
    bloom(0, .47 * u, .02 * u, .11 * u, '#ff7fa8');
  }
  if (i === 2) { // book: carried at the side by the top of its spine
    const bc = '#c8342b'; box(p, .1 * u, .44 * u, .34 * u, bc, 0, -.16 * u, .05 * u); box(p, .084 * u, .41 * u, .32 * u, '#fbf3e2', 0, -.16 * u, .062 * u);
    box(p, .104 * u, .04 * u, .345 * u, gold, 0, -.04 * u, .05 * u); box(p, .104 * u, .04 * u, .345 * u, gold, 0, -.3 * u, .05 * u);
  }
  if (i === 3) { // phone: held up to read, the screen towards the face
    const ph = new THREE.Group(); ph.position.set(-.02 * u, .1 * u, .04 * u); ph.rotation.set(-.5, -.35, 0); p.add(ph);
    // the screen faces the avatar, so the world sees a pink case with a camera
    box(ph, .17 * u, .3 * u, .03 * u, '#ff8fab', 0, 0, 0); box(ph, .14 * u, .24 * u, .006 * u, '#7fd1e8', 0, .01 * u, -.016 * u);
    box(ph, .06 * u, .06 * u, .01 * u, '#2b2b34', -.04 * u, .1 * u, .018 * u); sph(ph, .016 * u, '#7fd1e8', -.04 * u, .1 * u, .024 * u).scale.z = .4; sph(ph, .03 * u, '#ffffff', .03 * u, -.05 * u, .018 * u).scale.z = .25;
  }
  if (i === 4) { // bouquet: a paper cone with a round bunch of flowers and leaves poking out
    const wr = cone(p, .16 * u, .42 * u, '#fff4f7', 0, .06 * u, .02 * u); wr.rotation.x = PI; cyl(p, .17 * u, .17 * u, .03 * u, '#ff8fab', 0, .25 * u, .02 * u);
    const cs = ['#ff7fa8', '#ffffff', '#ffd23f', '#c9b3ff', '#ff5d8f', '#ff9a3c', '#ffffff'];
    [[0, .4, .02], [-.09, .35, .07], [.09, .35, .07], [-.08, .36, -.06], [.08, .36, -.06], [0, .34, .12], [0, .37, -.1]].forEach(([x, y, z], k) => bloom(x * u, y * u, z * u, .075 * u, cs[k]));
    for (const an of [-1, 1]) leaf(an * .14 * u, .32 * u, 0, .09 * u, an * .8);
  }
  if (i === 5) { // umbrella: closed and carried by its hook, the tip near the ground
    const c = '#3f7fc4'; const hk = ring(p, .07 * u, .02 * u, '#6b4326', -.0 * u, .0, 0, PI); hk.rotation.set(0, PI / 2, PI); hk.position.y = .02 * u;
    cyl(p, .018 * u, .018 * u, .82 * u, '#5a5f68', 0, -.41 * u + .02 * u, -.07 * u);
    const cn = cone(p, .1 * u, .55 * u, c, 0, -.52 * u, -.07 * u); cn.rotation.x = PI; cyl(p, .1 * u, .1 * u, .03 * u, shade(c, .8), 0, -.25 * u, -.07 * u);
    box(p, .03 * u, .1 * u, .03 * u, shade(c, .8), 0, -.33 * u, -.07 * u + .09 * u); // the strap
    cone(p, .014 * u, .07 * u, '#5a5f68', 0, -.83 * u, -.07 * u).rotation.x = PI;
  }
  if (i === 6) { // magic wand: a dark stick with a gold star on top
    const st = cyl(p, .016 * u, .02 * u, .5 * u, '#3a2a4a', 0, .2 * u, 0); cyl(p, .022 * u, .022 * u, .06 * u, '#ffffff', 0, .43 * u, 0); st.position.y = .2 * u;
    star(.12 * u, gold, 0, .55 * u, 0); sph(p, .02 * u, '#ffffff', .1 * u, .66 * u, .02 * u); sph(p, .014 * u, '#fff1a8', -.11 * u, .62 * u, .01 * u);
  }
  if (i === 7) { // microphone: a black handle and a silver mesh ball
    cyl(p, .04 * u, .03 * u, .32 * u, '#24222c', 0, .1 * u, 0); cyl(p, .05 * u, .05 * u, .04 * u, '#8a8f98', 0, .28 * u, 0);
    sph(p, .085 * u, '#c9ccd2', 0, .35 * u, 0); ring(p, .086 * u, .008 * u, '#8a8f98', 0, .35 * u, 0).rotation.x = PI / 2; cyl(p, .012 * u, .012 * u, .2 * u, '#24222c', 0, -.14 * u, 0);
  }
  if (i === 8) { // foam sword: a soft blue blade, a yellow guard and a red grip
    cyl(p, .035 * u, .035 * u, .2 * u, '#e5543b', 0, 0, 0); sph(p, .045 * u, '#e5543b', 0, -.11 * u, 0);
    box(p, .26 * u, .05 * u, .07 * u, '#ffd23f', 0, .12 * u, 0); box(p, .1 * u, .66 * u, .04 * u, '#4fc3e8', 0, .47 * u, 0); const tp = cone(p, .05 * u, .1 * u, '#4fc3e8', 0, .85 * u, 0); tp.scale.z = .4; tp.scale.x = 1.4;
  }
  if (i === 9) { // handbag: a rounded bag on a little arched handle
    const c = '#c2185b'; handle(.18 * u, -.1 * u, shade(c, .7));
    const b = box(p, .1 * u, .2 * u, .3 * u, c, 0, -.2 * u, 0); b.scale.set(1, 1, 1); sph(p, .12 * u, c, 0, -.27 * u, 0).scale.set(.42, .55, 1.25);
    box(p, .106 * u, .06 * u, .31 * u, shade(c, .8), 0, -.13 * u, 0); sph(p, .02 * u, gold, .056 * u, -.15 * u, 0);
  }
  if (i === 10) { // trophy: a gold cup with two handles on a dark base
    box(p, .2 * u, .07 * u, .2 * u, '#4a2f2a', 0, .07 * u, 0); cyl(p, .03 * u, .05 * u, .12 * u, gold, 0, .16 * u, 0);
    lathe(p, [[.02 * u, .22 * u], [.1 * u, .26 * u], [.15 * u, .36 * u], [.15 * u, .44 * u]], gold); cyl(p, .14 * u, .1 * u, .17 * u, gold, 0, .32 * u, 0);
    for (const s2 of [-1, 1]) { const hh = ring(p, .07 * u, .016 * u, gold, s2 * .15 * u, .34 * u, 0, PI); hh.rotation.z = -s2 * PI / 2; }
    star(.05 * u, '#fff1a8', 0, .32 * u, .14 * u);
  }
  if (i === 11) { // tennis racket: grip in the hand, a round frame with strings above
    cyl(p, .03 * u, .03 * u, .3 * u, '#f4f1ea', 0, .02 * u, 0); cyl(p, .022 * u, .022 * u, .12 * u, '#3f7fc4', 0, .22 * u, 0);
    const fr = ring(p, .17 * u, .022 * u, '#3f7fc4', 0, .44 * u, 0); fr.scale.set(.8, 1.12, 1);
    for (let k = -2; k <= 2; k++) { box(p, .006 * u, .34 * u * Math.sqrt(1 - (k / 3) ** 2), .006 * u, '#f4f1ea', k * .045 * u, .44 * u, 0); box(p, .26 * u * Math.sqrt(1 - (k / 3) ** 2), .006 * u, .006 * u, '#f4f1ea', 0, .44 * u + k * .055 * u, 0); }
  }
  if (i === 12) { // Mossbun plush: the Pet Farm bunny, soft and round, sitting on the palm
    const c = '#f7ecd0', y = .17 * u;
    sph(p, .15 * u, c, 0, y, 0).scale.set(1, .9, .95); sph(p, .13 * u, c, 0, y + .17 * u, .03 * u);
    sph(p, .12 * u, '#6fb85a', 0, y + .04 * u, -.07 * u).scale.set(1.05, .8, .6); // the moss on its back
    for (const s2 of [-1, 1]) { const e = sph(p, .045 * u, c, s2 * .06 * u, y + .33 * u, .01 * u); e.scale.set(1, 2.4, .7); e.rotation.z = -s2 * .2; const ei = sph(p, .028 * u, '#f59ab0', s2 * .06 * u, y + .33 * u, .03 * u); ei.scale.set(1, 2.4, .5); ei.rotation.z = -s2 * .2;
      sph(p, .022 * u, '#2a1712', s2 * .05 * u, y + .19 * u, .145 * u).scale.z = .5; sph(p, .04 * u, c, s2 * .09 * u, y - .1 * u, .1 * u); }
    sph(p, .016 * u, '#f59ab0', 0, y + .155 * u, .16 * u);
  }
  if (i === 13) { // lantern: carried by its ring, warm glass panels in a dark frame
    const fc = '#3a3440'; ring(p, .05 * u, .012 * u, fc, 0, -.02 * u, 0).rotation.y = PI / 2;
    cone(p, .13 * u, .1 * u, fc, 0, -.1 * u, 0); box(p, .17 * u, .22 * u, .17 * u, '#ffd76a', 0, -.27 * u, 0); sph(p, .05 * u, '#fff4c4', 0, -.27 * u, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) box(p, .025 * u, .24 * u, .025 * u, fc, x * .09 * u, -.27 * u, z * .09 * u);
    box(p, .2 * u, .03 * u, .2 * u, fc, 0, -.39 * u, 0); box(p, .19 * u, .025 * u, .19 * u, fc, 0, -.155 * u, 0);
  }
  if (i === 14) { // ice cream cone: a waffle cone and two scoops
    const cn = cone(p, .1 * u, .3 * u, '#e0a04a', 0, .07 * u, 0); cn.rotation.x = PI; ring(p, .1 * u, .016 * u, '#c98a3a', 0, .22 * u, 0).rotation.x = PI / 2;
    sph(p, .11 * u, '#ff9ad5', 0, .28 * u, 0); sph(p, .095 * u, '#9ff0d0', .01 * u, .41 * u, 0); sph(p, .03 * u, '#e5352b', 0, .51 * u, 0);
    for (const [x, z] of [[.08, .06], [-.07, .07], [.02, -.1]]) sph(p, .03 * u, '#ff9ad5', x * u, .2 * u, z * u).scale.y = 1.4;
  }
  if (i === 15) { // candy cane: red and white stripes, hooked at the top
    for (let k = 0; k < 8; k++) cyl(p, .03 * u, .03 * u, .06 * u, k % 2 ? '#ffffff' : '#e5352b', 0, (-.1 + k * .06) * u, 0);
    for (let k = 0; k < 6; k++) { const an = k / 5 * PI, sg = cyl(p, .03 * u, .03 * u, .06 * u, k % 2 ? '#e5352b' : '#ffffff', 0, .38 * u + Math.sin(an) * .09 * u, .09 * u - Math.cos(an) * .09 * u); sg.rotation.x = an; }
  }
  if (i === 16) { // pumpkin bucket: a jack-o'-lantern pail on a black handle, full of sweets
    const c = '#f08a24'; handle(.3 * u, -.12 * u, '#24222c');
    sph(p, .17 * u, c, 0, -.27 * u, 0).scale.set(1, .82, 1); for (let k = 0; k < 4; k++) { const rb = sph(p, .17 * u, '#dd7616', 0, -.27 * u, 0); rb.scale.set(.24, .84, 1.02); rb.rotation.y = k * PI / 4; }
    cyl(p, .13 * u, .13 * u, .02 * u, '#3a2a20', 0, -.14 * u, 0); for (const [x, z, cc] of [[.05, .03, '#e5352b'], [-.05, -.02, '#7fd1e8'], [0, -.06, '#ffd23f']]) sph(p, .03 * u, cc, x * u, -.13 * u, z * u);
    for (const s2 of [-1, 1]) { const ey = cone(p, .035 * u, .05 * u, '#2b2228', s2 * .055 * u, -.24 * u, .16 * u); ey.rotation.x = PI / 2 + .3; ey.scale.y = .4; }
    box(p, .1 * u, .025 * u, .02 * u, '#2b2228', 0, -.32 * u, .155 * u);
  }
  if (i === 17) { // flower basket: a woven basket on a handle, flowers spilling over the rim
    const c = '#c98a4a'; handle(.3 * u, -.1 * u, shade(c, .8), .02);
    cyl(p, .15 * u, .11 * u, .16 * u, c, 0, -.2 * u, 0); for (const y of [-.15, -.21, -.27]) ring(p, .135 * u - (y + .15) * -.3 * u, .012 * u, shade(c, .78), 0, y * u, 0).rotation.x = PI / 2;
    [[0, .04, '#ff7fa8'], [-.08, .02, '#ffd23f'], [.08, -.03, '#ffffff'], [.02, -.08, '#c9b3ff'], [-.06, -.07, '#ff9a3c']].forEach(([x, z, cc]) => bloom(x * u, -.1 * u, z * u, .06 * u, cc));
    for (const an of [-1, 1]) leaf(an * .12 * u, -.11 * u, .04 * u, .06 * u, an * 1.2);
  }
  if (i === 18) { // Coffee pot (Supporter pack): a glass carafe of coffee with a cream lid, carried by its handle
    const z = .2 * u; ring(p, .07 * u, .02 * u, COFFEE, 0, -.1 * u, .1 * u, PI).rotation.set(0, PI / 2, -PI / 2);
    lathe(p, [[.01, -.42 * u], [.13 * u, -.4 * u], [.15 * u, -.3 * u], [.135 * u, -.25 * u]], COFFEE).position.z = z; // the coffee shows through the bottom half
    lathe(p, [[.135 * u, -.255 * u], [.1 * u, -.16 * u], [.08 * u, -.1 * u]], '#d8ecf2').position.z = z; ring(p, .135 * u, .008 * u, '#ffffff', 0, -.25 * u, z).rotation.x = PI / 2;
    cyl(p, .085 * u, .09 * u, .05 * u, CREAM, 0, -.08 * u, z); sph(p, .03 * u, LATTE, 0, -.05 * u, z); const sp = cone(p, .025 * u, .06 * u, '#e8f1f4', 0, -.12 * u, z + .1 * u); sp.rotation.x = 1.1;
    box(p, .02 * u, .16 * u, .03 * u, COFFEE, 0, -.18 * u, .08 * u);
  }
  if (i === 19) { // magnifying glass (2026-11-25, for Lantern Night and Copycat Isle sleuths): a brass ring and lens on a wooden handle
    cyl(p, .028 * u, .034 * u, .24 * u, '#7a4a2a', 0, .05 * u, 0); cyl(p, .036 * u, .036 * u, .04 * u, gold, 0, .19 * u, 0);
    const rg = ring(p, .12 * u, .022 * u, gold, 0, .33 * u, 0); rg.rotation.y = .5;
    const ln = cyl(p, .11 * u, .11 * u, .012 * u, '#bfe9ff', 0, .33 * u, 0, 18); ln.rotation.set(PI / 2, 0, -.5); sph(p, .025 * u, '#ffffff', -.04 * u, .37 * u, .03 * u).scale.z = .3;
  }
  if (i === 20) { // folding fan (Sky Runway): open, ribs spreading up from the grip
    const cs = ['#ff7fa8', '#ffffff'];
    for (let k = 0; k < 9; k++) { const an = (k - 4) * .19, len = .3 * u, b2 = box(p, .07 * u, len, .012 * u, cs[k % 2], Math.sin(an) * len * .55, .06 * u + Math.cos(an) * len * .55, 0); b2.rotation.z = -an; }
    for (let k = 0; k < 9; k++) { const an = (k - 4) * .19; const rb = box(p, .012 * u, .34 * u, .016 * u, '#6b4326', Math.sin(an) * .17 * u, .06 * u + Math.cos(an) * .17 * u, .008 * u); rb.rotation.z = -an; }
    sph(p, .03 * u, gold, 0, .06 * u, .01 * u); bloom(0, .26 * u, .02 * u, .045 * u, '#ff5d8f');
  }
  if (i === 21) { // camera (Sky Runway): a chunky body, a big lens towards the world and a flash on top
    const cam = new THREE.Group(); cam.position.set(0, .16 * u, .04 * u); cam.rotation.y = -.2; p.add(cam);
    box(cam, .28 * u, .18 * u, .12 * u, '#3a3440', 0, 0, 0); box(cam, .12 * u, .06 * u, .08 * u, '#4a4452', -.06 * u, .11 * u, 0); box(cam, .06 * u, .04 * u, .06 * u, '#fff4c4', .07 * u, .11 * u, 0);
    const lz = cyl(cam, .07 * u, .07 * u, .08 * u, '#24222c', .02 * u, -.01 * u, .09 * u, 14); lz.rotation.x = PI / 2; const gl = cyl(cam, .05 * u, .05 * u, .02 * u, '#7fc8ee', .02 * u, -.01 * u, .135 * u, 14); gl.rotation.x = PI / 2;
    box(cam, .29 * u, .03 * u, .125 * u, '#e5543b', 0, -.07 * u, 0);
  }
}

export function avatar3d(color, avIn, { pose = 'sit', hand = true } = {}) { // hand: false drops the held item (games that put props in the hands)
  const a = avObj(avIn), seated = pose !== 'stand';
  const root = new THREE.Group(), g = new THREE.Group(), ud = { arms: [], legs: [], eyes: [], dyn: true }; root.add(g);
  const H = 2.4 * [.93, 1, 1.07][a.height], B = BODIES[a.body];
  const topC = /^#[0-9a-f]{6}$/i.test(color) ? color : '#ff8fab';
  const CREAM = '#f6ead8', COFFEE = '#6b4326', LATTE = '#b8743a'; // the Supporter pack's café colours
  const skin = SKINS[a.skin], hair = HAIR_COLS[a.hairC], hD = shade(hair, .8), shoeC = SHOE_COLS[a.shoeC], gold = '#ffc93c';
  const headH = H / P.N * FSH[a.face].h, legLen = H * P.leg, neckL = H * .008, hipY = legLen, shY = H - headH - neckL;
  const W = P.wide, sh = B.sh * H * W, ch = B.ch * H * W, wa = B.wa * H * W, hi = B.hi * H * W, lb = B.lb * H * P.limb, dz = B.dz + .16;
  // A costume (suit) dresses the legs too, whatever bottom was picked, and has a hood that goes up when no hat is worn.
  const top = a.top, suit = SUITS[top], hoodC = a.hat === 0 ? { 23: '#62c267', 24: '#ffd93b', 25: '#f7f5ee', 26: '#2b2228', 28: topC, 38: LLAMA }[top] : null;
  // the dino and llama onesies with no hat are a full mascot head: the face, hair and glasses are all inside it
  const mascot = (top === 23 || top === 38) && a.hat === 0;
  const bot = suit ? 7 : a.bottom, botC = suit || BOTTOM_COLS[a.botC];
  const gown = top === 32, dress = top === 6 || top === 15 || gown, skirt = [3, 5, 6, 11, 12].includes(bot) || dress, longSl = [1, 2, 3, 9, 11, 12, 14, 15, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 34, 35, 36].includes(top), noSl = top === 5 || gown, lowC = dress ? topC : botC;
  const LEATHER = '#2b2a30', bodyC = top === 35 ? LEATHER : top === 10 ? '#ffffff' : top === 19 ? '#24222c' : top === 21 ? '#a8b0ba' : top === 22 ? '#f4f1ea' : top === 26 ? '#ffc93c' : top === 27 ? '#c8342b' : top === 31 ? CREAM : suit || topC, slvC = top === 14 || top === 16 ? '#ffffff' : top === 26 ? '#2b2228' : bodyC, dk = shade(topC, .62);

  // torso: a soft bean. Hips take the bottom colour.
  const y0 = hipY - .05 * H, t = shY - y0, wy = y0 + .42 * t, yT = shY + .015 * H;
  // The legs hang at legX; on builds with thick legs and narrow hips (Athletic, Broad) the hips are filled out at the
  // bottom so the tops of the thighs (narrowed a little, see the leg tube) stay inside them instead of sticking out.
  const legX = Math.max(hi * .5, lb * 1.3), hL = Math.max(hi, (legX + lb * 1.55 * .86) / .95 + .004);
  const TP = [[0, y0], [hL * .55, y0 + .01 * t], [hL * .9, y0 + .07 * t], [Math.max(hi, hL * .97), y0 + .18 * t], [wa, y0 + .45 * t], [ch, y0 + .72 * t], [sh * .97, y0 + .86 * t], [sh * .8, y0 + .95 * t], [sh * .45, yT], [0, yT]];
  // depth is its own gentle profile, so a wide build gets wider and never sticks out in front
  const dhi = Math.min(hi, wa * 1.06) * dz, dch = Math.min(ch, wa * 1.12) * dz, DP = [[0, y0], [dhi * .55, y0 + .01 * t], [dhi * .9, y0 + .07 * t], [dhi, y0 + .18 * t], [wa * dz, y0 + .45 * t], [dch, y0 + .72 * t], [dch * .93, y0 + .86 * t], [dch * .78, y0 + .95 * t], [sh * .45 * dz, yT], [0, yT]];
  const zk = { key: 'z' + DP.map(q => f3(q[0])).join(), f: y => { const r = rAt(TP, y); return r > 1e-4 ? rAt(DP, y) / r : dz; } };
  const tg = new THREE.Group(); g.add(tg);
  lathe(tg, slice(TP, y0, wy, 0), lowC, -PI, PI * 2, SEG, zk);
  lathe(tg, [...slice(TP, wy - .01, yT, .004), [0, yT]], bodyC, -PI, PI * 2, SEG, zk);
  const tz = y => rAt(DP, y) + .008, chestY = y0 + .72 * t;
  // a point on the front of the torso, x across and y up (tz is the same at x = 0)
  const front = (xx, y) => { const r = rAt(TP, y) + .004; return rAt(DP, y) * Math.sqrt(Math.max(0, 1 - (xx / r) ** 2)) + .006; };
  const band = (ya, yb, c, off = .012) => lathe(tg, slice(TP, ya, yb, off), c, -PI, PI * 2, SEG, zk);
  const panel = (ya, yb, c, half, off = .014) => part(tg, slice(TP, ya, yb, off), c, 0, half, zk);
  const side = (ya, yb, c, mid, half, off = .014) => part(tg, slice(TP, ya, yb, off), c, mid, half, zk);
  // a point on the torso's surface: an is the angle round it (0 is the front), y the height, o how far it stands off
  const round = (an, y, o = 0) => [Math.sin(an) * (rAt(TP, y) + o), y, Math.cos(an) * (rAt(DP, y) + o)];
  const bz = y => -(rAt(DP, y) + .012); // the back of the torso
  const collar = (c, k = 1) => { ring(g, lb * 1.5 * k, lb * .42, c, 0, shY, 0).rotation.x = PI / 2; };
  const tie = () => { box(g, .078, .2 * t, .02, '#d9584e', 0, chestY - .04 * t, tz(chestY - .1 * t) + .022); const tp = cone(g, .05, .09 * t, '#d9584e', 0, chestY - .185 * t, tz(chestY - .1 * t) + .022); tp.rotation.x = PI; tp.scale.z = .2; box(g, .09, .06, .034, '#b8433c', 0, chestY + .09 * t, tz(chestY + .05 * t) + .024); };
  const lapels = c => { for (const s of [-1, 1]) side(chestY - .2 * t, y0 + .93 * t, c, s * .42, .11, .02); side(wy, wy + .24 * t, c, PI, .022, .012); };
  // a little flower printed on swim shorts: five petals round a yellow middle, turned to face out at angle an
  const hibC = new THREE.Color(botC).getHSL({}).l > .62 ? ['#ff8fab', '#ff6f9c'] : ['#ffffff', '#fff1c4'];
  const hibiscus = (p, x, y, z, an, r = .034) => { for (let i = 0; i < 5; i++) { const pa = i / 5 * PI * 2, d = sph(p, r, hibC[i % 2], x + Math.cos(an) * Math.cos(pa) * r * 1.1, y + Math.sin(pa) * r * 1.1, z - Math.sin(an) * Math.cos(pa) * r * 1.1); d.scale.set(1, 1, .45); d.rotation.y = an; } sph(p, r * .55, '#ffc93c', x + Math.sin(an) * .006, y, z + Math.cos(an) * .006).scale.z = .5; };
  const bow = (c, y, z, r = .06) => { for (const s of [-1, 1]) { const b = cone(g, r, r * 2, c, s * r, y, z); b.rotation.z = s * PI / 2; b.scale.z = .6; } };
  if (top === 4) for (const k of [.5, .62, .74, .86]) band(y0 + k * t - .022 * t, y0 + k * t + .022 * t, '#ffffff');
  if (top === 3) { band(wy, wy + .09 * t, shade(topC, .82), .018); collar(shade(topC, .82), 1.3); for (const an of [-.55, 0, .55, PI - .55, PI, PI + .55]) side(wy + .12 * t, y0 + .9 * t, shade(topC, .9), an, .07, .012); }
  if (top === 1 || top === 28) {
    if (!hoodC) { const hd = ring(g, lb * 1.9, lb * .85, shade(topC, .9), 0, shY + .01 * H, -lb * .8); hd.rotation.x = PI / 2; hd.scale.set(1, .9, 1.1); }
    panel(wy + .05 * t, wy + .2 * t, shade(topC, .86), .55);
    for (const s of [-1, 1]) { cyl(g, .012, .012, .14 * t, '#ffffff', s * lb * .8, chestY + .02 * t, front(lb * .8, chestY + .02 * t) + .01); sph(g, .022, '#ffffff', s * lb * .8, chestY - .06 * t, front(lb * .8, chestY - .06 * t) + .014); }
  }
  if (top === 2 || top === 9) {
    panel(wy, y0 + .93 * t, top === 9 ? '#ffffff' : '#f4f1ea', .32); collar(shade(topC, top === 9 ? .8 : 1.2));
    if (top === 2) for (const k of [.55, .72]) sph(g, .026, shade(topC, .7), 0, y0 + k * t, tz(y0 + k * t) + .02);
    if (top === 9) { lapels(shade(topC, .76)); box(g, .075, .03, .02, '#ffffff', ch * .5, chestY + .02 * t, front(ch * .5, chestY + .02 * t) + .016); sph(g, .022, shade(topC, .55), 0, y0 + .5 * t, tz(y0 + .5 * t) + .018); }
    if (top === 9 && a.neck === 0) tie();
  }
  if (top === 7) { panel(y0 + .06 * t, wy + .1 * t, '#ffffff', .85, .02); panel(wy + .08 * t, chestY + .08 * t, '#ffffff', .45, .018); band(wy + .04 * t, wy + .1 * t, '#ece8df', .022); }
  if (top === 8) { panel(wy, chestY + .02 * t, botC, .5, .018); for (const s of [-1, 1]) { side(chestY, yT - .02 * t, botC, s * .42, .11, .018); side(wy, yT - .02 * t, botC, PI + s * .42, .11, .018); sph(g, .028, gold, s * ch * .38, chestY - .01 * t, front(ch * .38, chestY - .01 * t) + .016); } }
  if (top === 10) { band(chestY + .04 * t, yT - .02 * t, topC, .016); band(chestY + .04 * t, chestY + .075 * t, '#ffffff', .02); if (a.neck === 0) { bow('#e5543b', chestY + .02 * t, tz(chestY) + .035, .065); sph(g, .032, '#b8433c', 0, chestY + .02 * t, tz(chestY) + .045); } }
  if (top === 11) { panel(wy, y0 + .93 * t, '#fff8ec', .26); band(wy, wy + .06 * t, shade(topC, .84)); for (const s of [-1, 1]) { side(wy + .09 * t, wy + .2 * t, shade(topC, .84), s * .75, .22, .012); sph(g, .022, shade(topC, .6), s * wa * .28, wy + .3 * t, tz(wy + .3 * t) * .96 + .01); } }
  if (top === 12) { const tn = ring(g, lb * 1.78, lb * .82, shade(topC, .88), 0, shY + .014 * H, 0); tn.rotation.x = PI / 2; tn.scale.z = 1.15; band(wy, wy + .07 * t, shade(topC, .85)); }
  if (top === 13) { collar('#ffffff'); panel(chestY - .02 * t, yT - .03 * t, '#ffffff', .1); for (const k of [.76, .86]) sph(g, .018, dk, 0, y0 + k * t, tz(y0 + k * t) + .012); }
  if (top === 14) { band(wy, wy + .07 * t, dk); collar(dk); side(chestY - .08 * t, chestY + .08 * t, '#ffffff', .5, .17); }
  if (top === 15) { for (const s of [-1, 1]) side(chestY - .1 * t, yT - .02 * t, '#ffffff', s * .24, .1, .016); band(wy - .03 * t, wy + .17 * t, botC, .02); bow(shade(botC, .85), wy + .07 * t, -tz(wy + .07 * t) - .05, .1); }
  if (top === 16) { for (const k of [.52, .66, .8]) band(y0 + k * t - .012 * t, y0 + k * t + .012 * t, dk, .016); collar(topC, 1.15); panel(wy, y0 + .95 * t, dk, .035, .016); }
  if (top === 17) { for (const s of [-1, 1]) side(wy, y0 + .84 * t, '#ffffff', s * PI / 2, .2); collar('#ffffff'); panel(chestY - .14 * t, chestY + .06 * t, '#ffffff', .16); side(chestY - .16 * t, chestY + .08 * t, '#ffffff', PI, .2); band(wy, wy + .05 * t, dk); }
  // a cape lies on the back from the shoulders down (to the waist over a skirt, which would poke through it)
  const cape = c => { side(skirt ? wy + .02 * t : y0 + .08 * t, yT, c, PI, 1.2, .03); collar(c, 1.1); };
  if (top === 18) { // flowers printed flat all the way round
    collar(shade(topC, .8));
    [[-.7, .3], [.55, .4], [-.2, .62], [.75, .76], [-.65, .8], [.15, .22], [1.5, .56], [2.3, .34], [2.9, .68], [3.5, .3], [3.9, .74], [4.7, .5]].forEach(([an, fy], i) => { const y = y0 + fy * t, c = i % 2 ? '#ffffff' : '#ffd23f', r = .03;
      for (let j = 0; j < 5; j++) { const q = j * PI * .4 + .3, yy = y + Math.sin(q) * r, pe = sph(g, r * .8, c, ...round(an + Math.cos(q) * r / Math.max(.08, rAt(TP, yy)), yy, .006)); pe.rotation.y = an; pe.scale.z = .3; }
      const ce = sph(g, r * .55, i % 2 ? '#ffd23f' : '#ff8a2a', ...round(an, y, .014)); ce.rotation.y = an; ce.scale.z = .4; }); }
  if (top === 19) { panel(wy, y0 + .93 * t, '#ffffff', .28); collar('#24222c'); lapels('#3d3a48'); for (const s of [-1, 1]) side(y0 + .02 * t, wy, '#24222c', PI + s * .3, .26, .014); for (const k of [.5, .62]) sph(g, .02, '#24222c', 0, y0 + k * t, tz(y0 + k * t) + .016); if (a.neck === 0) bow('#17100d', chestY + .16 * t, tz(chestY + .16 * t) + .03, .05); }
  if (top === 20) { band(wy - .02 * t, wy + .06 * t, gold, .016); const d = cyl(g, .1, .1, .02, gold, 0, chestY, tz(chestY) + .012); d.rotation.x = PI / 2; const d2 = cyl(g, .06, .06, .02, shade(topC, .55), 0, chestY, tz(chestY) + .022); d2.rotation.x = PI / 2; if (a.neck === 0) cape(shade(topC, .6)); }
  if (top === 21) { for (const k of [.3, .5, .7]) band(y0 + k * t - .015 * t, y0 + k * t + .015 * t, '#7d858f', .014); collar(gold, 1.2); box(g, .045, .3 * t, .02, '#d9342b', 0, chestY - .02 * t, tz(chestY) + .015); box(g, .16, .045, .02, '#d9342b', 0, chestY + .04 * t, tz(chestY) + .015); }
  if (top === 22) { band(wy - .02 * t, wy + .05 * t, topC, .016); if (!a.back) { box(g, sh * 1.15, .42 * t, .13, '#c9ccd2', 0, y0 + .64 * t, -rAt(DP, chestY) - .05); box(g, sh * .7, .08 * t, .14, topC, 0, y0 + .74 * t, -rAt(DP, chestY) - .055); for (const s of [-1, 1]) cyl(g, .04, .04, .2 * t, '#8a8f98', s * sh * .32, y0 + .5 * t, -rAt(DP, chestY) - .13); } panel(chestY - .1 * t, chestY + .08 * t, '#c9ccd2', .3, .016); ['#e5543b', '#4f9df0', '#ffd23f'].forEach((c, i) => sph(g, .02, c, (i - 1) * .05, chestY, tz(chestY) + .03)); ring(g, lb * 2.1, lb * .5, '#c9ccd2', 0, shY + .01 * H, 0).rotation.x = PI / 2; }
  // ----- the fun wardrobe -----
  if (top === 23) { // dino onesie: pale belly, spikes down the back, a tail
    panel(y0 + .1 * t, chestY + .06 * t, '#d9f2a6', .55, .012);
    for (const k of [.3, .5, .7, .88]) { const sp = cone(g, .07, .15, '#3f9a4a', 0, y0 + k * t, bz(y0 + k * t) - .05); sp.rotation.x = -PI / 2 + .5; sp.scale.x = .55; }
    const tl2 = cone(g, hi * .55, .42 * t + .2, suit, 0, y0 + .1 * t, bz(y0 + .14 * t) - .16); tl2.rotation.x = -PI / 2 - .35;
  }
  if (top === 38) { // llama onesie: a woolly collar, a bright striped blanket on the back and a fluffy pompom tail
    for (let i = 0; i < 14; i++) { const an = i / 14 * PI * 2; sph(g, lb * .7, i % 2 ? '#fffaf0' : '#f7ecd8', Math.sin(an) * lb * 1.75, shY - .005 * H, Math.cos(an) * lb * 1.75 * Math.max(dz, .8)); }
    side(y0 + .5 * t, y0 + .86 * t, '#ff7fa8', PI, .62, .02); side(y0 + .6 * t, y0 + .66 * t, '#4fc3c8', PI, .64, .026); side(y0 + .72 * t, y0 + .77 * t, '#ffd23f', PI, .64, .026);
    for (const k of [.52, .84]) side(y0 + k * t - .015 * t, y0 + k * t + .015 * t, '#ffffff', PI, .65, .028);
    panel(y0 + .12 * t, chestY + .04 * t, '#fbf4e6', .5, .012);
    for (const [dx, dy, r] of [[0, 0, .1], [-.06, .05, .075], [.06, .05, .075], [0, .09, .07]]) sph(g, r, '#fffaf0', dx, y0 + .1 * t + dy, bz(y0 + .14 * t) - .06);
  }
  if (top === 24) { // banana suit: ridges down the sides, peel flaps over the shoulders, a brown tip
    for (const s of [-1, 1]) side(y0 + .04 * t, yT - .06 * t, '#eab420', s * PI / 2, .1, .012);
    for (const an of [-.75, .75, PI - .8, PI + .8]) { const f = cone(g, .11, .36 * t, '#fff3a6', ...round(an, yT - .2 * t, .028)); f.rotation.order = 'YXZ'; f.rotation.set(PI, an, 0); f.scale.z = .3; }
  }
  if (top === 25) { // ghost sheet: one big drape from the shoulders with a scalloped hem
    const yE = seated ? hipY - .02 * H : hipY - legLen * .34, rE = hi * 1.45;
    lathe(g, [[rE, yE], [hi * 1.2, hipY + .06 * t], [ch + .03, y0 + .72 * t], [sh * .9, y0 + .9 * t], [sh * .5, yT + .004]], suit).scale.z = Math.max(dz, .8);
    for (let i = 0; i < 12; i++) { const an = i / 12 * PI * 2; sph(g, rE * .27, suit, Math.sin(an) * rE * .97, yE, Math.cos(an) * rE * .97 * Math.max(dz, .8)).scale.y = .8; }
  }
  if (top === 26) { // bee: black stripes and a sting
    for (const k of [.2, .46, .72]) band(y0 + k * t - .05 * t, y0 + k * t + .05 * t, '#2b2228', .008);
    collar('#2b2228', 1.15); cone(g, .06, .2, '#2b2228', 0, y0 + .08 * t, bz(y0 + .1 * t) - .08).rotation.x = -PI / 2 - .3;
    if (!a.back) for (const s of [-1, 1]) { const w = sph(g, .2, '#e6f5ff', s * .2, chestY + .14 * t, bz(chestY) - .05); w.scale.set(.7, 1.25, .08); w.rotation.set(0, -s * .5, -s * .7); }
  }
  if (top === 27) { // ugly sweater: zigzags, little trees and far too many bobbles
    collar('#ffffff', 1.1); band(wy - .02 * t, wy + .05 * t, '#2f8a4a', .012);
    for (const [k, c] of [[.56, '#ffffff'], [.9, '#ffffff']]) band(y0 + k * t - .014 * t, y0 + k * t + .014 * t, c, .012);
    for (let i = 0; i < 12; i++) { const an = i / 12 * PI * 2 + .26, y = y0 + .73 * t;
      if (i % 2) { const tr = cone(g, .055, .13, '#2f8a4a', ...round(an, y, .012)); tr.rotation.y = an; tr.scale.z = .5; }
      else sph(g, .034, ['#ffd23f', '#ffffff', '#7fd1e8'][(i / 2) % 3], ...round(an, y, .012)); }
    for (let i = 0; i < 9; i++) { const an = i / 9 * PI * 2; const z2 = cone(g, .04, .07, '#ffd23f', ...round(an, y0 + .52 * t, .008)); z2.rotation.set(PI, an, 0); z2.scale.z = .4; }
  }
  if (top === 29) { // skeleton: ribs, spine and hips painted on black
    for (const k of [.58, .68, .78]) panel(y0 + k * t - .022 * t, y0 + k * t + .022 * t, '#f4f1ea', .62 - (k - .58) * .5, .01);
    panel(y0 + .3 * t, y0 + .9 * t, '#f4f1ea', .07, .012); panel(y0 + .12 * t, y0 + .26 * t, '#f4f1ea', .5, .01); panel(y0 + .16 * t, y0 + .27 * t, suit, .14, .014);
    for (const k of [.58, .68, .78]) side(y0 + k * t - .022 * t, y0 + k * t + .022 * t, '#f4f1ea', PI, .62 - (k - .58) * .5, .01); side(y0 + .26 * t, y0 + .92 * t, '#f4f1ea', PI, .07, .014); side(y0 + .12 * t, y0 + .24 * t, '#f4f1ea', PI, .45, .01);
  }
  if (top === 30) { // duck floatie: a swim ring round the waist with a duck's head
    const fl = ring(g, hi * 1.42, hi * .5, '#ffd93b', 0, wy - .06 * t, 0); fl.rotation.x = PI / 2; fl.scale.y = Math.max(dz, .78);
    const fzz = hi * 1.42 * Math.max(dz, .78) + hi * .35, fy = wy + .1 * t;
    sph(g, hi * .52, '#ffd93b', 0, fy, fzz); const bk = cone(g, hi * .2, hi * .4, '#ff8a2a', 0, fy - .01, fzz + hi * .58); bk.rotation.x = PI / 2; bk.scale.y = 1; bk.scale.x = 1.3;
    for (const s of [-1, 1]) sph(g, hi * .08, '#1a1014', s * hi * .24, fy + hi * .2, fzz + hi * .4);
    collar(shade(topC, .82));
  }
  if (top === 31) { // barista sweater: cream knit with coffee trim, a steaming cup on the chest and a stripe across the back
    band(wy, wy + .08 * t, COFFEE, .018); collar(COFFEE, 1.3); band(wy + .1 * t, wy + .125 * t, LATTE, .012);
    const cy = chestY - .06 * t, cz = tz(cy) + .014, cup = cyl(g, .125, .09, .17, COFFEE, 0, cy, cz); cup.scale.z = .25;
    ring(g, .055, .02, COFFEE, .15, cy + .01, cz - .004).scale.z = .7; const fo = cyl(g, .1, .1, .03, '#fffaf0', 0, cy + .075, cz + .006); fo.scale.z = .25;
    for (const [dx, dy, r] of [[-.03, .17, .032], [.03, .24, .024]]) sph(g, r, LATTE, dx, cy + dy, tz(cy + dy) + .012).scale.z = .4;
    side(chestY - .09 * t, chestY + .05 * t, COFFEE, PI, .62, .012); side(chestY - .13 * t, chestY - .105 * t, LATTE, PI, .62, .012);
  }
  // ----- the dress-up batch: formal, royal, pirate, rock, sporty, disco -----
  // an open piece of cloth (a cape, coat tails) gets a lining facing the other way, so its inside never shows as a dark slab
  const lined = (pts, c, ph0, len, sz) => { lathe(g, pts, c, ph0, len).scale.z = sz; lathe(g, pts.map(([r, y]) => [r - .012, y]).reverse(), shade(c, .82), ph0, len).scale.z = sz; };
  if (gown) { // ball gown: a fitted bodice with a sash and a bow at the back, puffed shoulders, a sparkly neckline (the full skirt is below)
    band(wy - .02 * t, wy + .07 * t, shade(topC, .78), .02); bow(shade(topC, .78), wy + .03 * t, -tz(wy + .03 * t) - .06, .09);
    band(y0 + .86 * t, y0 + .91 * t, mix(topC, '#ffffff', .55), .016);
    for (let i = 0; i < 14; i++) sph(g, .018, '#ffffff', ...round(i / 14 * PI * 2, y0 + .885 * t, .026));
    for (const s of [-1, 1]) { const pf = sph(g, lb * 1.55, mix(topC, '#ffffff', .25), s * sh * .86, shY - lb * 1.2, 0); pf.scale.set(1, .78, 1); }
  }
  if (top === 33) { // royal robe: ermine trim down the front and round the collar, gold buttons, a long cape to the floor
    const erm = '#fbf8f0'; panel(y0 + .02 * t, yT, erm, .17, .018); collar(erm, 1.45);
    for (const k of [.3, .5, .7]) { sph(g, .016, '#1a1014', -.04, y0 + k * t, tz(y0 + k * t) + .03); sph(g, .016, '#1a1014', .045, y0 + (k + .1) * t, tz(y0 + (k + .1) * t) + .03); }
    for (const k of [.4, .6, .8]) for (const sx of [-1, 1]) sph(g, .024, gold, sx * .13, y0 + k * t, front(.13, y0 + k * t) + .014);
    const cc = shade(topC, .78), yF = seated ? wy : hipY - legLen * .86;
    lined([[hi * 1.75, yF], [hi * 1.3, hipY], [wa * 1.12, wy], [ch * 1.08, chestY], [sh * .98, yT - .02 * t]], cc, PI - 1.45, 2.9, Math.max(dz, .8) * 1.08);
    if (!seated) lathe(g, [[hi * 1.76 + .015, yF - .02], [hi * 1.76 + .015, yF + .07]], erm, PI - 1.45, 2.9).scale.z = Math.max(dz, .8) * 1.08;
  }
  if (top === 34) { // pirate coat: open over a white shirt, wide lapels, two rows of gold buttons, a belt and coat tails
    panel(wy, y0 + .93 * t, '#f4f1ea', .3); lapels(shade(topC, .7)); collar(shade(topC, .7), 1.25);
    for (const k of [.45, .6, .75]) for (const sx of [-1, 1]) sph(g, .026, gold, sx * .16, y0 + k * t, front(.16, y0 + k * t) + .016);
    band(wy - .03 * t, wy + .05 * t, '#4a2f2a', .026); box(g, .1, .07 * t, .03, gold, 0, wy + .01 * t, tz(wy) + .03); box(g, .05, .035 * t, .034, '#4a2f2a', 0, wy + .01 * t, tz(wy) + .036);
    if (!seated) lined([[hi * 1.42, hipY - legLen * .5], [hi * 1.16, hipY], [wa * 1.08, wy - .02 * t]], topC, PI - 1.55, 3.1, Math.max(dz, .8) * 1.06);
  }
  if (top === 35) { // leather jacket: black, open over a T-shirt in the player's colour, silver zip and studs
    panel(wy + .04 * t, y0 + .9 * t, topC, .3, .016); lapels('#3d3c44'); collar('#3d3c44', 1.25); band(wy - .02 * t, wy + .06 * t, '#3d3c44', .016);
    box(g, .014, .5 * t, .02, '#c9ccd2', .2, wy + .3 * t, front(.2, wy + .3 * t) + .016);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) sph(g, .02, '#c9ccd2', ...round(sx * (.85 + k * .22), yT - .06 * t, .01));
  }
  if (top === 36) { // tracksuit top: a white zip, a white collar and stripes down the sides and sleeves
    panel(wy - .02 * t, yT, '#f4f1ea', .025, .016); collar('#f4f1ea', 1.25); band(wy - .02 * t, wy + .05 * t, shade(topC, .78), .014);
    for (const sx of [-1, 1]) side(wy + .04 * t, yT - .02 * t, '#f4f1ea', sx * PI / 2, .05, .016);
  }
  if (top === 37) { // sequin top: little shiny discs all over in two tones
    collar(shade(topC, .8));
    for (let j = 0; j < 7; j++) for (let i = 0; i < 12; i++) { const an = (i + (j % 2) * .5) / 12 * PI * 2, y = wy + (j + .5) / 7 * (yT - wy - .06 * t), d = sph(g, .028, (i + j) % 3 ? mix(topC, '#ffffff', .5) : shade(topC, .75), ...round(an, y, .006)); d.rotation.y = an; d.scale.z = .35; }
  }
  // things on the back
  const bk = a.back, flat = (r, c, x, y, z, sx, sy, sz = .1) => { const o = sph(g, r, c, x, y, z); o.scale.set(sx, sy, sz); return o; };
  if (bk === 1) { box(g, sh * 1.25, .5 * t, .16, '#e5543b', 0, y0 + .62 * t, bz(chestY) - .07); box(g, sh * .9, .2 * t, .06, '#b8433c', 0, y0 + .5 * t, bz(chestY) - .17); box(g, sh * 1.3, .1 * t, .17, '#b8433c', 0, y0 + .86 * t, bz(chestY) - .07);
    for (const s of [-1, 1]) { side(wy + .1 * t, yT - .01 * t, '#b8433c', s * .5, .09, .016); side(wy + .1 * t, yT - .01 * t, '#b8433c', PI + s * .62, .09, .016); } sph(g, .03, gold, 0, y0 + .5 * t, bz(chestY) - .2); }
  if (bk === 2) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const w = flat(.2, i === 1 ? '#f1ede6' : '#ffffff', s * (.16 + i * .13), chestY + .16 * t - i * .13 * t, bz(chestY) - .05 + i * .012, 1.5 - i * .15, .55, .16); w.rotation.set(0, -s * .3, s * (.75 - i * .5)); }
  if (bk === 3) for (const s of [-1, 1]) { const u = flat(.2, '#ffc4e0', s * .3, chestY + .2 * t, bz(chestY) - .04, 1.15, 1.7, .08); u.rotation.set(0, -s * .4, -s * .6); const l = flat(.15, '#c9b3ff', s * .24, chestY - .16 * t, bz(chestY) - .04, 1.1, 1.4, .08); l.rotation.set(0, -s * .4, -s * 2.2); sph(g, .03, '#ffffff', s * .36, chestY + .3 * t, bz(chestY) - .06); }
  if (bk === 4) { for (const s of [-1, 1]) { cyl(g, .085, .085, .4 * t, '#c9ccd2', s * .1, y0 + .6 * t, bz(chestY) - .09); cone(g, .085, .1, '#e5543b', s * .1, y0 + .8 * t + .05, bz(chestY) - .09); cyl(g, .05, .075, .06, '#5a5f68', s * .1, y0 + .4 * t - .03, bz(chestY) - .09); cone(g, .06, .2, '#ff9a2a', s * .1, y0 + .4 * t - .16, bz(chestY) - .09).rotation.x = PI; cone(g, .032, .12, '#ffe066', s * .1, y0 + .4 * t - .12, bz(chestY) - .09).rotation.x = PI; }
    box(g, .3, .1 * t, .05, '#8a8f98', 0, y0 + .62 * t, bz(chestY) - .04); for (const s of [-1, 1]) side(wy + .1 * t, yT - .01 * t, '#5a5f68', s * .5, .07, .016); }
  if (bk === 5) { flat(sh * 1.25, '#3f8a4f', 0, y0 + .55 * t, bz(chestY) - .02, 1, 1.25, .55); flat(sh * 1.3, '#d9c27a', 0, y0 + .55 * t, bz(chestY) + .01, 1, 1.25, .3);
    for (const [fx, fy] of [[0, .55], [-.5, .7], [.5, .7], [-.5, .4], [.5, .4], [0, .86], [0, .24]]) flat(sh * .3, '#63b06f', fx * sh, y0 + fy * t, bz(chestY) - .02 - sh * .58 * Math.sqrt(Math.max(.1, 1 - fx * fx * .7 - ((fy - .55) / .5) ** 2)), 1, 1, .5); }
  if (bk === 6) { const top6 = shY + headH + .3 * H / 2.4, by = y0 + .8 * t, bx = sh * .6, len = Math.hypot(.28, top6 - by); const st = cyl(g, .008, .008, len, '#ffffff', bx + .14, (top6 + by) / 2, bz(chestY) - .06); st.rotation.z = -Math.atan2(.28, top6 - by);
    sph(g, .24, '#e5352b', bx + .28, top6 + .22, bz(chestY) - .06).scale.y = 1.15; cone(g, .04, .06, '#b82a22', bx + .28, top6 - .04, bz(chestY) - .06); sph(g, .05, '#ff8a80', bx + .2, top6 + .32, bz(chestY) + .1).scale.z = .4; }
  if (bk === 7) for (const s of [-1, 1]) { for (let i = 0; i < 3; i++) { const f = cone(g, .15, .52 - i * .07, '#3a2a4a', s * (.2 + i * .12), chestY + .02 * t - i * .02, bz(chestY) - .04); f.scale.z = .14; f.rotation.set(0, -s * .3, s * (2.0 - i * .5) + PI); } flat(.2, '#4a3660', s * .2, chestY + .12 * t, bz(chestY) - .035, 1.3, .6, .1).rotation.set(0, -s * .3, s * .5); }
  if (bk === 8) { flat(sh * 1.15, '#c8342b', 0, y0 + .45 * t, bz(chestY) - .14, 1, 1.15, .85); cyl(g, sh * .3, sh * .55, .1 * t, '#c8342b', 0, y0 + .82 * t, bz(chestY) - .12); ring(g, sh * .36, .02, '#ffffff', 0, y0 + .8 * t, bz(chestY) - .12).rotation.x = PI / 2;
    box(g, .13, .13, .13, '#4fa85a', .06, y0 + .9 * t, bz(chestY) - .14).rotation.z = .3; box(g, .14, .035, .135, gold, .06, y0 + .9 * t, bz(chestY) - .14).rotation.z = .3; flat(sh * .3, '#a8271f', -sh * .3, y0 + .4 * t, bz(chestY) - .14 - sh * .88, 1, 1, .3); side(chestY, yT, '#ffffff', -.5, .05, .016); }
  if (bk === 9) { const sb = flat(.3, '#4fc3e8', 0, y0 + .62 * t, bz(chestY) - .06, .75, 2.5, .12); sb.rotation.z = .4; const st = flat(.3, '#ffffff', 0, y0 + .62 * t, bz(chestY) - .075, .16, 2.45, .1); st.rotation.z = .4; const fn = cone(g, .07, .14, '#ff8a2a', .19, y0 + .62 * t - .42, bz(chestY) - .12); fn.rotation.x = -PI / 2; fn.scale.x = .3; }
  if (bk === 10) for (const s of [-1, 1]) { const u = flat(.22, '#ff9a3c', s * .32, chestY + .2 * t, bz(chestY) - .04, 1.25, 1.3, .08); u.rotation.set(0, -s * .4, -s * .5); const l = flat(.17, '#ffd23f', s * .26, chestY - .16 * t, bz(chestY) - .04, 1.1, 1.1, .08); l.rotation.set(0, -s * .4, s * .4);
    sph(g, .045, '#2b2228', s * .44, chestY + .3 * t, bz(chestY) - .055).scale.z = .3; sph(g, .035, '#ffffff', s * .34, chestY - .2 * t, bz(chestY) - .055).scale.z = .3; }
  if (bk === 11) { // takeaway cup: a big paper cup with a sleeve, a lid and a straw, carried on two straps
    const bzc = bz(chestY) - sh * .56, cy = y0 + .56 * t, hh = .6 * t;
    cyl(g, sh * .62, sh * .47, hh, '#fffaf0', 0, cy, bzc); cyl(g, sh * .6, sh * .53, hh * .42, LATTE, 0, cy - hh * .02, bzc).scale.set(1.04, 1, 1.04);
    cyl(g, sh * .68, sh * .68, hh * .1, '#ffffff', 0, cy + hh * .53, bzc); cyl(g, sh * .5, sh * .6, hh * .09, '#ffffff', 0, cy + hh * .62, bzc);
    const stw = cyl(g, .022, .022, hh * .55, '#e5543b', sh * .2, cy + hh * .9, bzc); stw.rotation.z = -.22;
    sph(g, sh * .16, '#e5543b', 0, cy - hh * .02, bzc - sh * .56).scale.z = .35;
    for (const s of [-1, 1]) { side(wy + .1 * t, yT - .01 * t, COFFEE, s * .5, .08, .016); side(wy + .1 * t, yT - .01 * t, COFFEE, PI + s * .62, .08, .016); }
  }
  if (bk === 12) { // pirate flag: a pole tucked in the back strap, a black flag with a skull and crossbones flying out to the side
    const px = -sh * .45, pz = bz(chestY) - .07, yb = y0 + .25 * t, ytop = shY + headH * 1.95; // the flag flies above the head and most hats
    cyl(g, .028, .028, ytop - yb, '#8a5a3c', px, (ytop + yb) / 2, pz); sph(g, .05, gold, px, ytop + .03, pz);
    side(wy + .1 * t, yT - .01 * t, '#4a2f2a', -.5, .07, .018); side(wy + .1 * t, yT - .01 * t, '#4a2f2a', PI + .62, .07, .018);
    const fl = new THREE.Group(); fl.position.set(px, ytop - .26, pz); fl.rotation.y = -.3; g.add(fl);
    box(fl, .62, .42, .03, '#24222c', -.32, 0, 0); for (const sz2 of [-1, 1]) { sph(fl, .085, '#f4f1ea', -.33, .05, sz2 * .02).scale.set(1, .95, .3); for (const e of [-1, 1]) sph(fl, .022, '#24222c', -.33 + e * .03, .06, sz2 * .03).scale.z = .4;
      for (const r2 of [-1, 1]) { const bn = box(fl, .3, .035, .02, '#f4f1ea', -.33, -.09, sz2 * .022); bn.rotation.z = r2 * .55; } }
  }
  if (bk === 13) { // electric guitar on the back on a strap across the chest
    const gx = 0, gy = y0 + .45 * t, gz = bz(chestY) - .09, gr = new THREE.Group(); gr.position.set(gx, gy, gz); gr.rotation.z = .55; g.add(gr);
    const gc = '#e5352b'; sph(gr, .2, gc, 0, -.12, 0).scale.set(1.15, 1, .28); sph(gr, .15, gc, 0, .1, 0).scale.set(1, 1, .28); box(gr, .1, .1, .05, '#f4f1ea', 0, -.08, -.04);
    box(gr, .06, .62, .04, '#8a5a3c', 0, .5, 0); box(gr, .1, .14, .045, '#2b2228', 0, .84, 0); for (const k of [-.1, .02]) box(gr, .12, .02, .03, '#c9ccd2', 0, k - .1, -.045);
    side(wy - .02 * t, yT - .01 * t, '#2b2228', .5, .07, .018); side(wy + .1 * t, yT - .01 * t, '#2b2228', PI - .5, .07, .018);
  }
  if ([0, 1, 8, 9, 10, 14, 15].includes(bot) && !dress) band(wy - .035 * t, wy + .012 * t, shade(botC, .7), .01);
  // what tells the trousers apart: a buckle, jeans pockets and a stud, a joggers waistband with drawstrings
  if (!dress && !suit) {
    if (bot === 0 || bot === 8) box(g, .07, .045 * t, .02, gold, 0, wy - .012 * t, tz(wy - .012 * t) + .014);
    if (bot === 1 || bot === 15) { sph(g, .02, gold, 0, wy - .012 * t, tz(wy - .012 * t) + .016); for (const s of [-1, 1]) { side(y0 + .1 * t, y0 + .3 * t, shade(botC, 1.22), PI + s * .5, .24, .012); side(y0 + .2 * t, y0 + .36 * t, shade(botC, .8), s * .62, .14, .01); } }
    if (bot === 9) { box(g, .07, .045 * t, .02, LATTE, 0, wy - .012 * t, tz(wy - .012 * t) + .014); for (const s of [-1, 1]) { side(y0 + .2 * t, y0 + .36 * t, shade(botC, .8), s * .62, .14, .01); side(y0 + .1 * t, y0 + .28 * t, CREAM, PI + s * .5, .2, .012); } }
    if (bot === 10) { box(g, .07, .045 * t, .02, '#8a8f98', 0, wy - .012 * t, tz(wy - .012 * t) + .014); for (const s of [-1, 1]) side(y0 + .1 * t, y0 + .28 * t, fold(botC), PI + s * .5, .2, .012); }
    if (bot === 13) { band(wy - .05 * t, wy + .012 * t, shade(botC, .75), .012); for (const s of [-1, 1]) { cyl(g, .01, .01, .12 * t, '#ffffff', s * .03, wy - .09 * t, front(s * .03, wy - .09 * t) + .014); sph(g, .016, '#ffffff', s * .03, wy - .15 * t, front(s * .03, wy - .15 * t) + .016); }
      for (const [an, yy] of [[.5, .2], [-.9, .1], [2.4, .22], [3.6, .12]]) { const [fx, fy, fz] = round(an, y0 + yy * t, .012); hibiscus(g, fx, fy, fz, an); } }
    if (bot === 4 || bot === 16) { band(wy - .05 * t, wy + .012 * t, '#f4f1ea', .012); for (const s of [-1, 1]) { cyl(g, .01, .01, .1 * t, '#f4f1ea', s * .03, wy - .08 * t, front(s * .03, wy - .08 * t) + .014); sph(g, .016, '#f4f1ea', s * .03, wy - .13 * t, front(s * .03, wy - .13 * t) + .016); } }
  }

  // arms: stubby, with mitten hands. Each arm is its own piece so it can swing.
  const ua = H * .168 * P.arm, fa = H * .15 * P.arm, shX = sh * .86, reach = Math.max(.12, Math.asin(Math.min(.7, Math.max(0, (hi + lb * 1.3 - shX) / (ua + fa)))));
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.userData.own = true; arm.position.set(s * shX, shY - lb * 1.05, 0); arm.rotation.z = s * reach; g.add(arm);
    const slC = noSl ? skin : slvC, cuff = top === 33 ? '#fbf8f0' : top === 34 ? gold : top === 36 ? '#f4f1ea' : top === 31 ? COFFEE : top === 9 || top === 2 ? '#ffffff' : top === 14 ? dk : top === 22 ? topC : shade(slvC, .82);
    if (!longSl && !noSl) { cyl(arm, lb * 1.28, lb * 1.34, ua * .55, slvC, 0, -ua * .27, 0); if (top === 10 || top === 17 || top === 13) cyl(arm, lb * 1.37, lb * 1.37, ua * .12, top === 10 ? topC : top === 13 ? '#ffffff' : dk, 0, -ua * .5, 0); }
    const el = new THREE.Group(); el.position.y = -ua; el.userData.sub = true; arm.add(el);
    // shoulder, upper arm, elbow and forearm are one tube that bends at the elbow (the shoulder takes the top's colour)
    const R0 = lb * 1.04, aC = longSl ? slvC : skin;
    tube(arm, rings([[0, R0, 0], [R0 * .5, R0 * .87, 0], [R0 * .87, R0 * .5, 0], [lb * 1.06, 0, 0], [lb * 1.06, 0, 1], [lb * .95, -ua, 1], [lb * .86, -ua - fa, 1],
      [lb * .62, -ua - fa - lb * .35, 1], [0, -ua - fa - lb * .5, 1]], -ua + lb * 1.2, -ua - lb * 1.2, lb * .3), [slC, aC], el, -ua, lb * .8, lb * .8);
    if (top === 15) cyl(el, lb * 1.0, lb * 2.0, fa * .9, slvC, 0, -fa * .45, 0);
    if (longSl && top !== 15) cyl(el, lb * 1.0, lb * 1.0, fa * .16, cuff, 0, -fa * .92, 0);
    sph(el, lb * 1.22, skin, 0, -fa - lb * .5, 0);
    if (top === 21) { sph(arm, lb * 1.5, '#8f98a3', 0, lb * .25, 0).scale.y = .72; cyl(arm, lb * 1.2, lb * 1.2, ua * .16, '#7d858f', 0, -ua * .55, 0); }
    if (top === 29) { box(arm, lb * .55, ua * .75, .02, '#f4f1ea', 0, -ua * .5, lb * 1.1); box(el, lb * .5, fa * .7, .02, '#f4f1ea', 0, -fa * .5, lb * .98); }
    if (top === 36) { box(arm, .02, ua * .9, lb * .5, '#f4f1ea', s * lb * 1.04, -ua * .5, 0); box(el, .02, fa * .75, lb * .45, '#f4f1ea', s * lb * .93, -fa * .45, 0); }
    if (top === 33 || top === 34) cyl(el, lb * 1.2, lb * 1.1, fa * .26, cuff, 0, -fa * .86, 0); // big turned-back cuffs
    if (top === 35) for (const k of [.3, .6]) sph(arm, .016, '#c9ccd2', s * lb * .9, -ua * k, lb * .5);
    if (seated) { arm.rotation.x = -.45; el.rotation.x = -.95; }
    // the held item (standing only: seated avatars rest their hands on the table, where cards and cues go)
    if (s === 1 && !seated && hand && a.hand > 0) {
      // a mascot head holds things out to the side, clear of its snout
      const hang = HANG.includes(a.hand);
      // held up: the arm reaches forward and a little out, so the item stands clear of the big head; carried: hangs clear of the leg
      if (!hang) { if (mascot) { arm.rotation.x = -.6; arm.rotation.z += .8; el.rotation.x = -.1; } else { arm.rotation.x = -.5; arm.rotation.z += .2; el.rotation.x = -1.0; } } else arm.rotation.z += .22;
      const hd = new THREE.Group(); hd.position.y = -fa - lb * .5; el.add(hd);
      // turn the item back upright, whatever the arm and elbow are doing, then lean a held-up item forward and away from the face
      hd.quaternion.setFromEuler(arm.rotation).multiply(new THREE.Quaternion().setFromEuler(el.rotation)).invert();
      if (!hang) { hd.rotateZ(-HAND_LEAN.z); hd.rotateX(HAND_LEAN.x); }
      handItem(hd, a.hand, H / 2.4 * 1.45, lb * 1.22, { gold, COFFEE, LATTE, CREAM });
      if (WIDE.includes(a.hand)) for (const o of hd.children) { o.position.z += lb * .7; o.position.x += lb * .35; } // a big round item sits out on the palm, off the chin
      arm.userData.hold = true;
    }
    arm.userData.rx = arm.rotation.x; ud.arms.push(arm);
  }
  // legs and big rounded shoes. Seated, the legs dangle forward off the seat.
  const tl = legLen * .5, shoeH = H * .05, sl = legLen - tl - shoeH, shortLeg = (bot === 2 || bot === 13) && !dress;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * legX, hipY, 0); g.add(leg);
    const wide = bot === 8 && !skirt, slim = bot === 7 && !suit && !skirt, plain = !skirt && !suit, cuffd = bot === 9 && plain, cargo = bot === 10 && plain, flare = bot === 14 && plain, track = bot === 16 && plain, kT = wide ? 1.7 : slim ? 1.36 : cargo ? 1.66 : flare ? 1.45 : 1.55, kK = wide ? 1.6 : slim ? 1.12 : cuffd ? 1.36 : cargo ? 1.44 : flare ? 1.08 : 1.3, kA = wide ? 2.05 : flare ? 2.35 : slim ? .92 : bot === 4 && plain ? .96 : track ? 1.16 : cuffd ? 1.24 : cargo ? 1.08 : 1.05;
    const kn = new THREE.Group(); kn.position.y = -tl; kn.userData.sub = true; leg.add(kn);
    // thigh, knee and shin are one tube that bends at the knee; shorts change to skin under their hem
    const lc = skirt || shortLeg ? skin : botC, rH = lb * (kT + (kK - kT) * .9);
    tube(leg, rings([[0, lb * .15, 0], [lb * kT * .65, lb * .1, 0], [lb * kT * .86, 0, 0], [lb * kT, -tl * .35, 0], [rH, -tl * .9, 0], [rH, -tl * .9, 1], [lb * kK, -tl, 1], [lb * kA, -tl - sl, 1],
      [lb * kA * .7, -tl - sl - shoeH * .3, 1], [0, -tl - sl - shoeH * .45, 1]], -tl + lb * 1.2, -tl - lb * 1.4, lb * .3), [skirt ? skin : botC, lc], kn, -tl, lb * .5, lb * 1.0);
    if (top === 29) { box(leg, lb * .7, tl * .7, .02, '#f4f1ea', 0, -tl * .5, lb * 1.52); box(kn, lb * .6, sl * .7, .02, '#f4f1ea', 0, -sl * .5, lb * 1.22); }
    if (shortLeg && bot === 2) cyl(leg, lb * 1.42, lb * 1.46, tl * .14, shade(botC, .8), 0, -tl * .9, 0);
    if (shortLeg && bot === 13) { cyl(leg, lb * 1.6, lb * 1.66, tl * .3, botC, 0, -tl * .82, 0); hibiscus(leg, s * lb * 1.62, -tl * .55, lb * .3, s * PI / 2 - s * .3); hibiscus(leg, s * lb * .4, -tl * .8, lb * 1.6, 0, .028); }
    if (cargo) { // a big pocket with a flap on the outside of each thigh, and the trousers gathered at the ankle
      const ang = -s * Math.atan2((kT - kK) * lb, tl), pk = box(leg, .03, tl * .36, lb * 1.1, shade(botC, 1.12), s * lb * 1.56, -tl * .58, 0); pk.rotation.z = ang;
      const fl = box(leg, .036, tl * .1, lb * 1.16, fold(botC), s * lb * 1.6, -tl * .38, 0); fl.rotation.z = ang; sph(leg, .018, '#8a8f98', s * lb * 1.64, -tl * .4, 0);
      cyl(kn, lb * 1.16, lb * 1.16, sl * .12, fold(botC), 0, -sl * .9, 0); }
    if (bot === 12 && skirt && !dress) { // knee socks under the kilt, with a red band at the top
      cyl(kn, lb * (kK - .02), lb * (kA + .04), sl * .74, '#f4f1ea', 0, -sl * .6, 0); cyl(kn, lb * (kK + .02), lb * (kK - .02), sl * .1, '#d9342b', 0, -sl * .24, 0); }
    if (flare) cyl(kn, lb * 2.38, lb * 2.38, sl * .06, shade(botC, .78), 0, -sl * .97, 0);
    if (bot === 15 && plain) { // ripped jeans: torn knees and a tear on the thigh, with white threads across
      const kz2 = lb * (kK - .02); sph(kn, lb * .62, skin, 0, sl * .02, kz2 * .82).scale.set(1.15, .8, .5); for (const dy of [-.03, .05]) box(kn, lb * 1.3, .008, .012, '#f4f1ea', 0, dy * sl, kz2 * .98);
      sph(leg, lb * .4, skin, s * lb * .3, -tl * .4, lb * (kT + kK) / 2 * .84).scale.set(1.3, .5, .5); box(leg, lb * .9, .007, .012, '#f4f1ea', s * lb * .3, -tl * .4, lb * (kT + kK) / 2 * .96);
      cyl(kn, lb * 1.12, lb * 1.12, sl * .1, shade(botC, 1.3), 0, -sl * .94, 0); }
    if (track) for (const dx of [-.07, .07]) { box(leg, .02, tl * .96, lb * .16, '#f4f1ea', s * lb * 1.5, -tl * .5, dx).rotation.z = -s * Math.atan2((kT - kK) * lb, tl); box(kn, .02, sl * .9, lb * .14, '#f4f1ea', s * lb * (kK + kA) / 2 * .98, -sl * .45, dx).rotation.z = -s * Math.atan2((kK - .04 - kA) * lb, sl); }
    if (bot === 1 && plain) { cyl(kn, lb * 1.2, lb * 1.2, sl * .22, shade(botC, 1.35), 0, -sl * .87, 0); box(leg, .012, tl * .9, .012, '#e0a04a', s * lb * 1.435, -tl * .5, 0).rotation.z = -s * Math.atan2((kT - kK) * lb, tl); }
    if (bot === 4 && plain) { cyl(kn, lb * 1.1, lb * 1.1, sl * .16, '#f4f1ea', 0, -sl * .9, 0); box(leg, .02, tl * .96, lb * .8, '#f4f1ea', s * lb * 1.425, -tl * .5, 0).rotation.z = -s * Math.atan2((kT - kK) * lb, tl); box(kn, .02, sl * .8, lb * .6, '#f4f1ea', s * lb * 1.13, -sl * .4, 0).rotation.z = -s * Math.atan2((kK - .04 - kA) * lb, sl); }
    if (bot === 0 && plain) { box(leg, .016, tl * .9, .016, fold(botC), 0, -tl * .52, lb * 1.43).rotation.x = Math.atan2((kT - kK) * lb, tl); box(kn, .016, sl * .9, .016, fold(botC), 0, -sl * .48, lb * 1.15).rotation.x = Math.atan2((kK - .04 - kA) * lb, sl); }
    if (bot === 7 && slim) cyl(kn, lb * .98, lb * .98, sl * .08, shade(botC, 1.3), 0, -sl * .93, 0);
    if (cuffd) { cyl(kn, lb * 1.4, lb * 1.4, sl * .2, CREAM, 0, -sl * .86, 0); cyl(kn, lb * 1.43, lb * 1.43, sl * .035, shade(CREAM, .8), 0, -sl * .76, 0); }
    if (wide) cyl(kn, lb * 2.08, lb * 2.08, sl * .07, shade(botC, .8), 0, -sl * .95, 0);
    const fy = -sl - shoeH * .45, fz = lb * .8, R = lb * 1.5, so = a.shoes;
    if (so === 2) { sph(kn, R * .9, skin, 0, fy + shoeH * .1, fz).scale.set(1, .55, 1.5); sph(kn, R, shoeC, 0, fy - shoeH * .3, fz).scale.set(1.05, .22, 1.6); ring(kn, R * .8, R * .14, shoeC, 0, fy + shoeH * .05, fz + R * .5).scale.y = .6; }
    else if (so === 4) { sph(kn, R, shoeC, 0, fy, fz).scale.set(1, .5, 1.5); sph(kn, R, shade(shoeC, .5), 0, fy - shoeH * .34, fz).scale.set(1.04, .18, 1.55); sph(kn, R * .4, shade(shoeC, 1.4), 0, fy + shoeH * .3, fz + R * .5).scale.set(1.6, .4, .6); box(kn, R * 1.7, R * .14, R * .34, shade(shoeC, .62), 0, fy + R * .34, fz + R * .2); box(kn, R * .3, R * .16, R * .2, gold, 0, fy + R * .36, fz + R * .2); }
    else if (so === 5) { sph(kn, R * 1.12, shoeC, 0, fy + shoeH * .1, fz).scale.set(1.05, .8, 1.5); for (const e of [-1, 1]) { const er = sph(kn, R * .3, shoeC, e * R * .4, fy + shoeH * .9, fz + R * .7); er.scale.set(.6, 1.8, .5); er.rotation.x = -.4; } sph(kn, R * .16, '#2a1712', 0, fy + shoeH * .2, fz + R * 1.62); }
    else if (so === 8) { // cocoa slippers: a soft mug for each foot, with a handle and marshmallows on the toe
      sph(kn, R * 1.12, shoeC, 0, fy + shoeH * .1, fz).scale.set(1.05, .8, 1.5); sph(kn, R * 1.05, shade(shoeC, .6), 0, fy - shoeH * .34, fz).scale.set(1.06, .2, 1.56);
      ring(kn, lb * 1.3, lb * .34, '#fffaf0', 0, fy + R * .74, lb * .1).rotation.x = PI / 2;
      sph(kn, R * .62, '#5a3220', 0, fy + R * .78, fz + R * .62).scale.set(1.1, .3, 1); ring(kn, R * .68, R * .13, '#fffaf0', 0, fy + R * .8, fz + R * .62).rotation.x = PI / 2;
      for (const [mx, mz] of [[-.24, .52], [.2, .78], [.12, .4]]) cyl(kn, R * .17, R * .17, R * .2, '#ffffff', mx * R, fy + R * .92, fz + mz * R);
      const hd = ring(kn, R * .36, R * .11, shoeC, s * R * 1.12, fy + shoeH * .15, fz + R * .1); hd.scale.y = .8;
    }
    else if (so === 9) { // paw slippers: a fluffy paw with pink toe beans and a big pad, and a fluffy cuff
      sph(kn, R * 1.12, shoeC, 0, fy + shoeH * .1, fz).scale.set(1.08, .78, 1.5); sph(kn, R * 1.06, shade(shoeC, .82), 0, fy - shoeH * .34, fz).scale.set(1.08, .2, 1.56);
      const onTop = (x, z) => fy + shoeH * .1 + R * .874 * Math.sqrt(Math.max(0, 1 - (x / 1.21) ** 2 - (z / 1.68) ** 2)); // the top of the slipper over a point, in R
      for (const [bx, bz] of [[-.62, .86], [-.22, 1.08], [.22, 1.08], [.62, .86]]) sph(kn, R * .2, '#ff8fab', bx * R, onTop(bx, bz) + R * .02, fz + bz * R).scale.set(1, .5, 1.15);
      sph(kn, R * .44, '#ff8fab', 0, onTop(0, .42) + R * .01, fz + R * .42).scale.set(1.25, .3, .95);
      cyl(kn, lb * 1.4, lb * 1.3, sl * .16, mix(shoeC, '#ffffff', .4), 0, -sl * .86, 0);
    }
    else if (so === 13) { // heels: a pointed low shoe with a thin heel and a little bow
      sph(kn, R * .86, skin, 0, fy + shoeH * .3, fz - R * .1).scale.set(.95, .5, 1.3);
      sph(kn, R * .95, shoeC, 0, fy - shoeH * .05, fz + R * .25).scale.set(.95, .42, 1.6); sph(kn, R * .8, shade(shoeC, .62), 0, fy - shoeH * .38, fz + R * .2).scale.set(1, .16, 1.75);
      cyl(kn, R * .12, R * .2, shoeH * .9, shade(shoeC, .7), 0, fy - shoeH * .25, fz - R * .95); for (const e of [-1, 1]) sph(kn, R * .17, mix(shoeC, '#ffffff', .45), e * R * .15, fy + shoeH * .32, fz + R * .95).scale.set(1, .7, .6);
    }
    else if (so === 14 || so === 15) { // cowboy boots (pointed toe, a block heel, stitched shaft) and platform boots (a thick sole, buckles)
      const cow = so === 14, sc2 = cow ? shoeC : shoeC, lift = cow ? 0 : shoeH * .6;
      if (!cow) { sph(kn, R * 1.08, '#2b2a30', 0, fy - shoeH * .45, fz).scale.set(1.08, .55, 1.6); box(kn, R * 2, shoeH * .9, R * 2.6, '#2b2a30', 0, fy - shoeH * .55, fz - R * .3); }
      sph(kn, R, sc2, 0, fy + shoeH * .12 + lift, fz).scale.set(1, .72, cow ? 1.8 : 1.55);
      if (cow) { sph(kn, R * .9, shade(sc2, .6), 0, fy - shoeH * .32, fz + R * .3).scale.set(1, .2, 1.9); box(kn, R * 1.2, shoeH * .7, R * .9, shade(sc2, .55), 0, fy - shoeH * .2, fz - R * 1.05); }
      cyl(kn, lb * 1.52, lb * 1.38, sl * .7, sc2, 0, -sl * .62 + lift, 0);
      if (cow) { cyl(kn, lb * 1.6, lb * 1.6, sl * .07, shade(sc2, .7), 0, -sl * .28, 0); for (let k = 0; k < 2; k++) { const st = box(kn, .012, sl * .3, .012, mix(sc2, '#ffffff', .5), (k - .5) * lb * .8, -sl * .55, lb * 1.48); st.rotation.z = (k - .5) * .6; } }
      else for (const yy of [.45, .7]) { cyl(kn, lb * 1.56, lb * 1.56, sl * .06, '#3d3c44', 0, -sl * yy + lift, 0); box(kn, lb * .5, sl * .08, .04, '#c9ccd2', s * lb * 1.3, -sl * yy + lift, lb * .6); }
    }
    else if (so === 11) { // flippers: a long flat fin with ribs, a strap round the heel
      sph(kn, R, shoeC, 0, fy + shoeH * .12, fz - R * .1).scale.set(1, .7, 1.3);
      const fn = new THREE.Group(); fn.position.set(0, fy - shoeH * .3, fz + R * .3); fn.rotation.y = s * .22; kn.add(fn); // the fins point a little outwards, so they do not cross
      sph(fn, R * 1.1, shoeC, 0, 0, R * 1.05).scale.set(.95, .14, 1.5);
      for (const rx of [-.45, 0, .45]) box(fn, R * .07, R * .12, R * 1.7, mix(shoeC, '#ffffff', .4), rx * R, R * .13, R * 1.1);
      ring(kn, lb * 1.15, lb * .2, shade(shoeC, .7), 0, fy + shoeH * .5, -lb * .3).rotation.x = PI / 2;
    }
    else {
      const bt = so === 1 || so === 6 || so === 16, pale = new THREE.Color(shoeC).getHSL({}).l > .8, trim = pale ? shade(shoeC, .62) : '#ffffff';
      sph(kn, R, shoeC, 0, fy + shoeH * .12, fz).scale.set(1, .72, 1.55); sph(kn, R, bt ? shade(shoeC, .6) : pale ? '#d6d2ca' : '#ffffff', 0, fy - shoeH * .32, fz).scale.set(1.06, .24, 1.62);
      // laces across the top, and a stripe down each side of a trainer
      if (so !== 6 && so !== 16) for (const dz2 of [.15, .45, .75]) box(kn, R * .8, R * .07, R * .13, bt ? shade(shoeC, 1.5) : trim, 0, fy + shoeH * .12 + R * .72 * Math.sqrt(1 - (dz2 / 1.55) ** 2) - R * .02, fz + dz2 * R);
      if (so === 0 || so === 3 || so === 7 || so === 10) for (const e of [-1, 1]) { const st = box(kn, R * .06, R * .22, R * 1.0, trim, e * R * .96, fy + shoeH * .2, fz - R * .1); st.rotation.x = .35; }
      if (so === 6 || so === 16) { cyl(kn, lb * 1.5, lb * 1.36, sl * .62, shoeC, 0, -sl * .7, 0); cyl(kn, lb * 1.58, lb * 1.58, sl * .08, shade(shoeC, 1.35), 0, -sl * .4, 0); }
      if (so === 16) for (const [an, y, c2] of [[.25, .86, '#ff6f8f'], [-.65, .8, '#ffc93c'], [1.2, .9, '#b48cff'], [-1.5, .88, '#ff6f8f'], [2.4, .84, '#ffc93c']]) { // flowers painted round the welly
        const x = Math.sin(an) * lb * 1.46, z = Math.cos(an) * lb * 1.46, yy = -sl * y; for (let k = 0; k < 5; k++) { const pa = k / 5 * PI * 2; sph(kn, lb * .24, c2, x + Math.cos(pa) * lb * .24 * Math.cos(an), yy + Math.sin(pa) * lb * .24, z - Math.cos(pa) * lb * .2 * Math.sin(an)).scale.set(1, 1, .4); } sph(kn, lb * .16, c2 === '#ffc93c' ? '#ff8a2a' : '#ffc93c', x * 1.06, yy, z * 1.06); }
      if (so === 16) { for (let k = 0; k < 5; k++) { const pa = k / 5 * PI * 2; sph(kn, R * .2, '#ff6f8f', Math.cos(pa) * R * .22, fy + shoeH * .12 + R * .62 + Math.sin(pa) * R * .05, fz + R * .95 + Math.sin(pa) * R * .2).scale.set(1, .45, 1); } sph(kn, R * .15, '#ffc93c', 0, fy + shoeH * .12 + R * .7, fz + R * .95).scale.y = .6; } // a big flower on the toe
      else if (so === 1) { cyl(kn, lb * 1.36, lb * 1.3, sl * .42, shoeC, 0, -sl * .8, 0); cyl(kn, lb * 1.46, lb * 1.46, sl * .1, shade(shoeC, .7), 0, -sl * .62, 0); } else sph(kn, R * .5, pale ? '#d6d2ca' : '#ffffff', 0, fy + shoeH * .3, fz + R * 1.05).scale.set(1.3, .6, .7);
      if (so === 7) for (const wx of [-1, 1]) for (const wz of [-1, 1]) { cyl(kn, R * .36, R * .36, R * .3, '#ff8a2a', wx * R * .62, fy - shoeH * .5, fz + wz * R * .85).rotation.z = PI / 2; sph(kn, R * .14, '#3a3440', wx * R * .78, fy - shoeH * .5, fz + wz * R * .85); }
      if (so === 7) { box(kn, R * 1.1, R * .12, R * 2.4, '#8a8f98', 0, fy - shoeH * .42, fz); sph(kn, R * .26, '#e5543b', 0, fy - shoeH * .2, fz + R * 1.5); }
      if (so === 10) for (let i = 0; i < 7; i++) { const an = -1.3 + i * (2.6 / 6), c2 = ['#ff5d8f', '#ffc93c', '#7ed37a', '#4fc3e8', '#b48cff', '#ff8a2a', '#ff5d8f'][i]; sph(kn, R * .14, c2, Math.sin(an) * R * 1.05, fy - shoeH * .32, fz + Math.cos(an) * R * 1.62).scale.set(1, .8, 1); }
      if (so === 12) { cyl(kn, lb * 1.36, lb * 1.32, sl * .5, shoeC, 0, -sl * .76, 0); cyl(kn, lb * 1.44, lb * 1.44, sl * .08, '#ffffff', 0, -sl * .52, 0);
        const yb = fy + shoeH * .12 - R * .7; for (const bz of [-.75, .85]) box(kn, R * .22, R * .3, R * .3, '#8a93a0', 0, yb - R * .08, fz + bz * R); // the blade hangs just under the boot
        box(kn, R * .14, R * .2, R * 3.1, '#e6edf5', 0, yb - R * .26, fz + R * .1); const tp = cyl(kn, R * .26, R * .26, R * .14, '#e6edf5', 0, yb - R * .1, fz + R * 1.62); tp.rotation.z = PI / 2; }
      if (so === 3) { cyl(kn, lb * 1.32, lb * 1.3, sl * .34, shoeC, 0, -sl * .84, 0); cyl(kn, lb * 1.38, lb * 1.38, sl * .08, trim, 0, -sl * .7, 0); sph(kn, lb * .55, trim, s * lb * 1.3, -sl * .86, 0).scale.x = .3; }
    }
    if (seated) { leg.rotation.x = -PI / 2; kn.rotation.x = .5; }
    else { leg.userData.own = kn.userData.own = true; leg.userData.kn = kn; ud.legs.push(leg); } // standing legs are their own pieces, so they can walk
  }
  if (skirt) {
    const c = dress ? topC : botC, sLen = top === 15 ? 1.7 : gown ? 1.8 : dress ? .75 : bot === 6 ? 1.6 : bot === 5 ? .5 : bot === 11 ? .42 : bot === 12 ? .62 : .6, yE = hipY - tl * sLen, rE0 = hi * (top === 15 ? 1.22 : gown ? 2.05 : bot === 11 && !dress ? 1.75 : 1.22 + .28 * Math.min(1, sLen));
    // The skirt's top must hold the thighs (same place and size as the leg loop above, plus a little room for the outline):
    // on a build with thick legs and narrow hips (Athletic) hi * 1.12 is too tight, so the skirt is made wider there and
    // deep enough that the round thigh fits in its oval, and the hem grows by the same amount so the shape stays the same.
    const lx = legX, lr = lb * 1.55 + .014, rH = Math.max(hi * 1.12, lx + lr + .01), rE = rE0 * rH / (hi * 1.12);
    let kz = Math.max(dz * Math.min(1, wa * 1.25 / hi), lb * 2 / (hi * 1.12));
    for (let i = 0; i <= 24; i++) { const an = i / 24 * PI, px = lx + lr * Math.cos(an), pz = lr * Math.sin(an); if (px < rH * .995) kz = Math.max(kz, pz / (rH * Math.sqrt(1 - (px / rH) ** 2))); }
    if (seated) { const R = Math.max(hi * 1.35, (lx + lr) * 1.1); sph(g, R, c, 0, hipY + lb * .5, tl * .36).scale.set(1, Math.max(.32, (lr - lb * .5 + .016) / R), 1.1); if (sLen > 1) { const dr = cyl(g, hi * 1.15, hi * 1.25, sl * .9, c, 0, hipY - sl * .15, tl * 1.0); dr.scale.z = .5; dr.rotation.x = -.5; } }
    else { lathe(g, [[rE - .02, yE - .004], [rE, yE], [rH, hipY + .02 * t], [wa + .006, wy]], c).scale.z = kz; if (bot === 11 && !dress) { // tutu: a second, paler frill of net under the first, and a satin waistband
        lathe(g, [[rE * .9 - .02, yE - .034 * H], [rE * .9, yE - .03 * H], [rH * .98, hipY - .01 * t]], mix(c, '#ffffff', .45)).scale.z = kz; band(wy - .04 * t, wy + .012 * t, shade(c, .8), .016);
        for (let i = 0; i < 18; i++) { const an = (i + .5) / 18 * PI * 2, r = rE * (i % 2 ? .97 : 1.0); sph(g, .085, i % 2 ? mix(c, '#ffffff', .25) : c, Math.sin(an) * r, yE + .01 - (i % 2) * .012, Math.cos(an) * r * kz).scale.set(1, .5, 1); } }
      if (gown) { lathe(g, [[rE + .006, yE - .004], [rE * .97, yE + .045 * H]], mix(c, '#ffffff', .45)).scale.z = kz; // a pale hem with tiny gems
        for (let i = 0; i < 16; i++) { const an = i / 16 * PI * 2; sph(g, .02, '#ffffff', Math.sin(an) * (rE * .985 + .014), yE + .055 * H, Math.cos(an) * (rE * .985 + .014) * kz); } }
      if (bot === 12 && !dress) { // kilt: a tartan of bands round and stripes down, a buckled strap, and a sporran in front
        const tn = shade(c, .62), ln = mix(c, '#ffffff', .5), yM = (yE + hipY) / 2, len = Math.hypot(hipY - yE, rE - rH), tilt = Math.atan2(rE - rH, hipY - yE);
        const at = k => [rE + (rH - rE) * k + .012, yE + (hipY - yE) * k];
        for (const [k, col, w] of [[.28, tn, .12], [.62, tn, .12], [.45, ln, .04]]) lathe(g, [at(k - w / 2), at(k + w / 2)], col).scale.z = kz;
        for (let i = 0; i < 10; i++) { const an = (i + .5) / 10 * PI * 2, r = (rE + rH) / 2 + .016, f = Math.hypot(Math.sin(an), Math.cos(an) * kz), pl = box(g, i % 2 ? .05 : .016, len * .96, .014, i % 2 ? tn : ln, Math.sin(an) * r, yM, Math.cos(an) * r * kz); pl.rotation.order = 'YXZ'; pl.rotation.set(-Math.atan(Math.tan(tilt) * f), Math.atan2(Math.sin(an), Math.cos(an) / kz), 0); }
        band(wy - .045 * t, wy + .012 * t, '#4a2f2a', .016); box(g, .07, .05 * t, .02, gold, hi * .5, wy - .016 * t, front(hi * .5, wy - .016 * t) + .02);
        const sz = front(0, hipY) + .03; sph(g, .085, '#8a5a3c', 0, hipY - .025 * H, sz).scale.set(1, 1.15, .42); box(g, .13, .035, .03, '#6b4326', 0, hipY - .005 * H, sz + .01); sph(g, .022, gold, 0, hipY - .012 * H, sz + .035).scale.z = .5; for (const k of [-1, 1]) cyl(g, .012, .012, .08, '#f4f1ea', k * .035, hipY - .065 * H, sz + .03); }
      if (bot === 5 && !dress) { lathe(g, [[rE + .008, yE - .002], [rE - .02, yE + .05 * H]], shade(c, 1.4)).scale.z = kz;
        const yM = (yE + hipY) / 2, len = Math.hypot(hipY - yE, rE - rH), tilt = Math.atan2(rE - rH, hipY - yE); // pleats
        for (let i = 0; i < 12; i++) { const an = (i + .5) / 12 * PI * 2, r = (rE + rH) / 2 + .014, f = Math.hypot(Math.sin(an), Math.cos(an) * kz), pl = box(g, .026, len * .9, .02, fold(c), Math.sin(an) * r, yM + .01 * H, Math.cos(an) * r * kz); pl.rotation.order = 'YXZ'; pl.rotation.set(-Math.atan(Math.tan(tilt) * f), Math.atan2(Math.sin(an), Math.cos(an) / kz), 0); } } }
  }
  cyl(g, lb * 1.1, lb * 1.3, .07 * H, shade(skin, .9), 0, shY, 0); // neck
  // neck accessories
  const nk = a.neck;
  if (nk === 1) { const sc = ring(g, lb * 1.75, lb * .8, '#fff4e2', 0, shY + .01 * H, 0); sc.rotation.x = PI / 2; sc.scale.z = 1.1; box(g, lb * 1.5, .34 * t, .05, '#fff4e2', lb * 1.15, chestY + .08 * t, front(lb * 1.2, chestY) + .026).rotation.z = -.08; box(g, lb * 1.5, .035 * t, .055, '#e5543b', lb * 1.25, chestY - .04 * t, front(lb * 1.2, chestY) + .028).rotation.z = -.08; }
  // a chain or ribbon in a V from the sides of the neck down to a pendant at height py
  const vee = (c, w, py) => { for (const s of [-1, 1]) { const ax = s * lb * 1.3, ay = shY - .01 * H, L = Math.hypot(ax, py - ay), o = box(g, w, L, .012, c, ax / 2, (ay + py) / 2, front(ax / 2, (ay + py) / 2) + .008); o.rotation.z = Math.atan2(ax, py - ay) + PI; } };
  if (nk === 2) { bow('#e5543b', chestY + .16 * t, tz(chestY + .16 * t) + .03); sph(g, .03, gold, 0, chestY + .16 * t, tz(chestY + .16 * t) + .04); }
  if (nk === 3) { vee(gold, .014, chestY + .12 * t); sph(g, .04, '#7fd1e8', 0, chestY + .12 * t, tz(chestY + .12 * t) + .02); }
  if (nk === 4 && top !== 9) tie();
  if (nk === 5) { vee('#4f9df0', .04, chestY + .12 * t); const md = cyl(g, .075, .075, .022, gold, 0, chestY + .1 * t, tz(chestY + .1 * t) + .025); md.rotation.x = PI / 2; sph(g, .03, '#fff1a8', 0, chestY + .1 * t, tz(chestY + .1 * t) + .035).scale.z = .4; }
  if (nk === 6) cape('#d9342b');
  const beads = (n, r, c, drop, cs) => { for (let i = 0; i < n; i++) { const an = i / n * PI * 2, ff = Math.max(0, Math.cos(an)); sph(g, r, cs ? cs[i % cs.length] : c, Math.sin(an) * lb * 1.9, shY - .005 * H - ff * drop, Math.cos(an) * lb * 1.9 * 1.05); } };
  if (nk === 7) beads(12, .045, null, .05 * H, ['#ff8fab', '#ffd23f', '#ffffff', '#c9b3ff']);
  if (nk === 8) { ring(g, lb * 1.6, lb * .35, '#d9342b', 0, shY + .005 * H, 0).rotation.x = PI / 2; sph(g, .04, gold, 0, shY - .025 * H, lb * 1.75); }
  if (nk === 9) beads(18, .022, '#fbf6ec', .04 * H);
  if (nk === 10) { ring(g, lb * 1.65, lb * .45, '#d9342b', 0, shY + .005 * H, 0).rotation.x = PI / 2; const bd = cone(g, lb * 1.6, .2 * t, '#d9342b', 0, chestY + .12 * t, tz(chestY + .12 * t) + .02); bd.rotation.x = PI; bd.scale.z = .3; for (const k of [-1, 0, 1]) sph(g, .014, '#ffffff', k * lb * .6, chestY + .17 * t, tz(chestY + .17 * t) + .04); }

  if (nk === 13) { // feather boa: a fluffy loop round the neck, both ends hanging down the front
    beads(16, .07, null, .02 * H, ['#ff7fa8', '#ff9ac0']);
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const y = shY - .04 * H - k * .07 * t, x = sx * (lb * 1.6 + k * .01); sph(g, .068 - k * .004, k % 2 ? '#ff9ac0' : '#ff7fa8', x, y, front(x, y) + .05); }
  }
  if (nk === 14) { // spiked collar: a black band with silver spikes and a ring at the front
    ring(g, lb * 1.6, lb * .4, '#24222c', 0, shY + .005 * H, 0).rotation.x = PI / 2;
    for (let i = 0; i < 10; i++) { const an = i / 10 * PI * 2, x = Math.sin(an) * lb * 2.0, z = Math.cos(an) * lb * 2.0, sp = cone(g, .03, .07, '#c9ccd2', x, shY + .005 * H, z); sp.rotation.order = 'YXZ'; sp.rotation.set(PI / 2, an, 0); }
    ring(g, .04, .01, '#c9ccd2', 0, shY - .04 * H, lb * 1.95);
  }
  if (nk === 15) { // ruff collar: a big white pleated ruff
    for (let i = 0; i < 22; i++) { const an = i / 22 * PI * 2, rr = lb * 2.5, f = sph(g, lb * 1.0, i % 2 ? '#ffffff' : '#ece8df', Math.sin(an) * rr, shY + .02 * H, Math.cos(an) * rr); f.scale.set(.55, .7, 1.25); f.rotation.y = an; }
  }
  if (nk === 12) { // coffee bean necklace with a tiny cup
    beads(16, .034, null, .05 * H, [COFFEE, '#8a5a3c']); const py = shY - .075 * H, pz = lb * 1.9 * 1.05 + .03;
    cyl(g, .05, .038, .075, '#fffaf0', 0, py, pz); ring(g, .026, .01, '#fffaf0', .058, py, pz); cyl(g, .04, .04, .012, COFFEE, 0, py + .036, pz);
  }
  if (nk === 16) { // daisy chain: white daisies with yellow middles, linked round the neck
    for (let i = 0; i < 12; i++) { const an = i / 12 * PI * 2, ff = Math.max(0, Math.cos(an)), x = Math.sin(an) * lb * 1.95, y = shY - .005 * H - ff * .045 * H, z = Math.cos(an) * lb * 1.95 * 1.05;
      for (let k = 0; k < 5; k++) { const pa = k / 5 * PI * 2; sph(g, .026, '#ffffff', x + Math.cos(pa) * .03 * Math.cos(an), y + Math.sin(pa) * .03, z - Math.cos(pa) * .03 * Math.sin(an)).scale.set(1, 1, .5); }
      sph(g, .02, '#ffc93c', x + Math.sin(an) * .012, y, z + Math.cos(an) * .012); } }
  if (nk === 17) { // shell necklace: a cord of small beads with a big pink scallop shell in front
    beads(16, .022, null, .05 * H, ['#fff4e2', '#7fd1e8', '#fff4e2', '#ffc9a8']); const py = shY - .085 * H, pz = lb * 1.9 * 1.05 + .03;
    for (let k = 0; k < 5; k++) { const a = (k - 2) * .34, rib = box(g, .022, .1, .02, k % 2 ? '#ffb3c6' : '#ff9ab4', Math.sin(a) * .035, py + Math.cos(a) * .035, pz); rib.rotation.z = -a; }
    sph(g, .03, '#ff9ab4', 0, py - .012, pz).scale.set(1.4, .6, .5); }
  if (nk === 18) { // vampire cape: a black cape, two tall collar points lined in red, and a red gem clasp
    cape('#1c1820');
    for (const sx of [-1, 1]) { const p = cone(g, lb * 1.3, .5 * t, '#1c1820', sx * lb * 2.6, shY + .05 * H, -lb * .3); p.rotation.z = -sx * .7; p.scale.z = .35;
      const r = cone(g, lb * 1.0, .4 * t, '#c8242f', sx * lb * 2.55, shY + .045 * H, -lb * .05); r.rotation.z = -sx * .7; r.scale.z = .3; }
    ring(g, lb * 1.6, lb * .3, '#1c1820', 0, shY + .005 * H, 0).rotation.x = PI / 2; sph(g, .035, '#d9142b', 0, shY - .01 * H, lb * 1.85).scale.z = .6; }
  if (nk === 11) { const sc = ring(g, lb * 1.8, lb * .85, '#e5352b', 0, shY + .01 * H, 0); sc.rotation.x = PI / 2; sc.scale.z = 1.1; for (let i = 0; i < 6; i++) box(g, lb * 1.6, .06 * t, .05, i % 2 ? '#ffffff' : '#e5352b', lb * 1.2 + i * .004, chestY + .19 * t - i * .06 * t, front(lb * 1.2, chestY) + .026); }
  // head: modelled 1 unit tall with the chin at 0, inside a pivot at the neck so it can turn and nod
  const hp = new THREE.Group(); hp.userData.own = true; hp.position.y = shY + neckL + .012 * H; g.add(hp); // the flat chin rides a little above the shoulders, so scarves and ties show
  const hg = new THREE.Group(), DZ = .94; hg.scale.set(headH * P.hw, headH, headH * P.hw * DZ); hp.add(hg);
  const hr = y => headR(a.face, y), HP = []; for (let j = 0; j <= 16; j++) { const y = (1 - Math.cos(j * PI / 16)) / 2; HP.push([hr(y), y]); }
  const fz = (x, y, o = 0) => Math.sqrt(Math.max(0, hr(y) * hr(y) - x * x)) + o;
  for (const s of [-1, 1]) sph(hg, .085, skin, s * hr(.4) * .97, .4, -.02).scale.set(.6, 1, .8);
  // hair: a shell over the skull plus chunky clumps and pointed bangs
  // An afro is too big to tuck under a covering hat (or inside a flower crown), so it shows as curls there.
  // Hair goes in hH and the hat in hT, so fitHat() can squash the hair under a hat or lift a small topper onto big hair.
  const hat = a.hat, hatKey = mascot ? 'mascot' : hoodC ? 'hood' : hat, hs = a.hair === 13 && (HAT_BRIM[hatKey] != null || hat === 23) ? 8 : a.hair, A = 1.3, hH = new THREE.Group(), hT = new THREE.Group(); hg.add(hH, hT);
  // rings get closer together towards the crown, where the skull curves fastest, so the shell never dips below it
  const shellPts = (ya, yb, off) => { const p = []; for (let j = 0; j <= 14; j++) { const y = ya + (yb - ya) * Math.sin(j / 14 * PI / 2); p.push([hr(Math.min(y, 1)) + off, y]); } if (yb >= 1) p.push([0, 1 + off]); return p; };
  // one sculpted piece per style (hair3d.js), in three tones of the hair colour
  const tieC = '#ff8fab', tones = [hair, shade(hair, .87), shade(hair, .66), mix(hair, '#ffffff', .22)];
  if (!mascot) for (const p of hairParts(hs, a.face, hr, seated ? .26 : 0, a.back > 0 || top === 22 || top === 26)) { const o = put(hH, p.geo, p.c === 'tie' ? tieC : hair); if (p.c !== 'tie') o.userData.cs = tones; }
  // facial hair: modelled, so it has the same chunky look as the hair (stubble is painted on the face)
  const fh = mascot ? 0 : a.facial, tash = (curl) => { for (const s of [-1, 1]) {
    const m = sph(hg, .1, hD, s * .075, .252, fz(.075, .252, .012)); m.scale.set(1, .42, .5); m.rotation.set(0, s * .3, -s * .32);
    const tip = sph(hg, .05, hD, s * (curl ? .17 : .15), curl ? .285 : .215, fz(.16, .25, .004)); tip.scale.set(curl ? .8 : 1, curl ? 1 : .75, .55);
  } };
  if (fh === 2 || fh === 3 || fh === 4) tash(false);
  if (fh === 6) tash(true);
  if (fh === 3) sph(hg, .11, hair, 0, .045, fz(0, .08, -.035)).scale.set(1, .95, .6);
  if (fh === 4) put(hg, beardGeo(a.face, .125, .44, .5, 1.05, 1.46, .06, .07, .035), hair);
  if (fh === 5) put(hg, beardGeo(a.face, .075, .44, 1.0, 1.3, 1.46, .03, .012, 0), hair);
  // glasses
  const gl = mascot ? 0 : a.glasses, ex = .18, ey = .4, gz = fz(ex, ey, .035);
  // a thin bar from point a to point b, and a path of them through several points
  const _z = new THREE.Vector3(0, 0, 1);
  const rod = (p, a, b, t, c) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(), o = box(p, t, t, L + t, c, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); o.quaternion.setFromUnitVectors(_z, d.divideScalar(L)); return o; };
  const path = (pts, t, c) => { for (let i = 1; i < pts.length; i++) rod(hg, pts[i - 1], pts[i], t, c); };
  // a glasses arm: from the outer edge of a lens (rr from its middle, turned like the lens) round the side of the
  // head, just over the skin, to the ear
  const arm = (s, rr, c) => {
    const x0 = s * (ex + rr * Math.cos(.36)), z0 = gz - rr * Math.sin(.36), a0 = Math.atan2(Math.abs(x0), z0), r0 = Math.hypot(x0, z0), pts = [];
    for (let i = 0; i <= 5; i++) { const k = i / 5, an = a0 + (PI / 2 + .06 - a0) * k, y = ey + .01 + .02 * k, r = r0 + (hr(y) + .016 - r0) * Math.min(1, k * 2.5); pts.push(new THREE.Vector3(s * Math.sin(an) * r, y, Math.cos(an) * r)); }
    path(pts, .014, c);
  };
  const strap = c => { const sr = ring(hg, hr(ey + .04) + .035, .016, c, 0, ey + .04, 0); sr.rotation.x = PI / 2; };
  const lens = (key, mk, c, sx, z = 0) => { const d = put(hg, G(key, mk), c, sx, ey, gz + z); d.rotation.y = Math.sign(sx) * .36; return d; };
  const shapeG = draw => () => { const sp = new THREE.Shape(); draw(sp); return new THREE.ShapeGeometry(sp); };
  const starG = r => shapeG(sp => { for (let i = 0; i < 10; i++) { const an = PI / 2 + i * PI / 5, rr = i % 2 ? r * .45 : r; sp[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } });
  const heartG = q => shapeG(sp => { sp.moveTo(0, -q * .9); sp.bezierCurveTo(q * 1.6, q * .2, q * .7, q * 1.3, 0, q * .5); sp.bezierCurveTo(-q * .7, q * 1.3, -q * 1.6, q * .2, 0, -q * .9); });
  if (gl === 4 || gl === 5) {
    for (const s of [-1, 1]) {
      if (gl === 4) { lens('gs1', starG(.16), '#ffc93c', s * ex); lens('gs2', starG(.1), '#ff5d8f', s * ex, .006); }
      else { lens('gh1', heartG(.13), '#ff5d8f', s * ex); lens('gh2', heartG(.085), '#c2185b', s * ex, .006); }
      arm(s, gl === 4 ? .15 : .13, '#4a2f2a');
    }
    box(hg, .07, .014, .014, gl === 4 ? '#ffc93c' : '#ff5d8f', 0, ey + .01, fz(0, ey, .02));
  }
  if (gl === 6) { ring(hg, .1, .014, gold, ex, ey, gz).rotation.y = .36; path([[.08, -.07], [.1, -.15], [.15, -.21], [.22, -.24]].map(([dx, dy]) => new THREE.Vector3(ex + dx, ey + dy, fz(ex + dx, ey + dy, .014))), .009, gold); }
  if (gl === 7) { lens('dk', () => new THREE.CircleGeometry(.105, 18), '#17100d', -ex).scale.y = .86; strap('#17100d'); }
  if (gl === 8) { for (const s of [-1, 1]) { ring(hg, .1, .035, '#8a5a3c', s * ex, ey, gz).rotation.y = s * .36; lens('dk', () => new THREE.CircleGeometry(.105, 18), '#7fd1e8', s * ex, -.005); } strap('#5a3a22'); }
  if (gl === 9) { for (const s of [-1, 1]) { lens('sq1', () => new THREE.PlaneGeometry(.23, .17), '#ffffff', s * ex); lens('sq2', () => new THREE.PlaneGeometry(.18, .12), s < 0 ? '#e33b3b' : '#20c4c4', s * ex, .006); arm(s, .11, '#ffffff'); } box(hg, .09, .05, .014, '#ffffff', 0, ey + .02, fz(0, ey, .03)); }
  if (gl === 10) sph(hg, .08, '#e5352b', 0, .3, fz(0, .3, .05));
  if (gl === 11) { // pushed up on the forehead, so the eyes stay in view
    const my = .74, mz = fz(.1, my, .05), fr = ring(hg, .17, .035, '#ffd23f', 0, my, mz); fr.scale.set(1.5, .8, 1); fr.rotation.x = -.25; const ln = put(hg, G('dk2', () => new THREE.CircleGeometry(.17, 20)), '#7fd1e8', 0, my, mz - .004); ln.scale.set(1.5, .8, 1); ln.rotation.x = -.25;
    const sr = ring(hg, hr(my) + .03, .02, '#2b2b2b', 0, my, 0); sr.rotation.x = PI / 2;
    path([[.5, .3, .2], [.56, .5, .04], [.56, .95, 0], [.56, 1.2, 0]].map(([x1, y1, z1]) => new THREE.Vector3(x1, y1, z1)), .055, '#ffd23f'); sph(hg, .05, '#ff8a2a', .56, 1.24, 0); }
  if (gl >= 1 && gl <= 3) {
    const dark = a.glasses === 3, fr = dark ? '#17100d' : '#4a2f2a', rr = .105;
    for (const s of [-1, 1]) {
      const rg = ring(hg, rr, .012, fr, s * ex, ey, gz); rg.rotation.y = s * .36; rg.scale.y = a.glasses === 2 ? 1 : .86;
      if (dark) { const d = put(hg, G('dk', () => new THREE.CircleGeometry(rr, 18)), '#17100d', s * ex, ey, gz); d.rotation.y = s * .36; d.scale.y = .86; }
      arm(s, rr, fr);
    }
    box(hg, .07, .014, .014, fr, 0, ey + .01, fz(0, ey, .02));
  }
  if (gl === 13) { // masquerade mask: one wide purple band that follows the face, only the eyes showing through, big swept wings,
    // sequins, and feathers at one side (no rims or strap, so it never reads as glasses)
    const mc = '#7b4fc4', R = y => hr(y) + .028, aE = Math.asin(ex / hr(ey)), dE = Math.asin(.1 / hr(ey)), aO = aE + dE + .3;
    const band2 = (ya, yb, mid, half, c = mc, o = 0) => part(hg, [[R(ya) + o, ya], [R((ya + yb) / 2) + o, (ya + yb) / 2], [R(yb) + o, yb]], c, mid, half);
    band2(ey + .065, ey + .17, 0, aO); band2(ey - .15, ey - .06, 0, aO - .12); band2(ey - .065, ey + .07, 0, aE - dE);
    for (const sx of [-1, 1]) { band2(ey - .065, ey + .07, sx * (aE + dE + .15), .15);
      const wx = sx * Math.sin(aO - .02) * R(ey + .12), wz = Math.cos(aO - .02) * R(ey + .12), wg = cone(hg, .11, .3, mc, wx, ey + .22, wz); wg.rotation.set(0, sx * aO, -sx * .6); wg.scale.z = .3;
      for (let k = 0; k < 4; k++) { const an = sx * (aE + dE * (k - 1.5) * .9), yy = ey + .13; sph(hg, .016, k % 2 ? gold : '#ffffff', Math.sin(an) * (R(yy) + .006), yy, Math.cos(an) * (R(yy) + .006)).scale.z = .5; }
      for (let k = 0; k < 3; k++) { const an = sx * (aE + (k - 1) * .16), yy = ey - .11; sph(hg, .014, gold, Math.sin(an) * (R(yy) + .006), yy, Math.cos(an) * (R(yy) + .006)).scale.z = .5; } }
    band2(ey + .165, ey + .18, 0, aO, gold, .004);
    sph(hg, .04, '#7fd1e8', 0, ey + .12, R(ey + .12) + .012).scale.z = .5;
    for (const [dx, an, c] of [[0, .2, '#e5543b'], [.05, -.25, '#ffd23f'], [-.04, .55, '#ff8fab']]) { const f = sph(hg, .11, c, .34 + dx, ey + .36, .3); f.scale.set(.26, 1.4, .12); f.rotation.set(0, .7, an - .45); }
  }
  if (gl === 14) { // cat-eye glasses: dark frames swept up at the outer corners
    for (const s of [-1, 1]) { const rg = ring(hg, .1, .02, '#24222c', s * ex, ey, gz); rg.rotation.y = s * .36; rg.scale.y = .78; const wg = cone(hg, .045, .12, '#24222c', s * (ex + .1), ey + .07, gz - .03); wg.rotation.z = -s * 1.0; wg.scale.z = .4; arm(s, .1, '#24222c'); }
    box(hg, .07, .016, .016, '#24222c', 0, ey + .01, fz(0, ey, .02));
  }
  if (gl === 12) { // café glasses: chunky caramel rounds with a little heart on the bridge
    for (const s of [-1, 1]) { const rg = ring(hg, .108, .022, LATTE, s * ex, ey, gz); rg.rotation.y = s * .36; arm(s, .108, LATTE); }
    box(hg, .07, .02, .016, LATTE, 0, ey + .01, fz(0, ey, .022)); put(hg, G('hrtb', heartG(.034)), '#e5543b', 0, ey + .012, fz(0, ey, .034));
  }
  // hats
  if (hat === 1) { lathe(hT, shellPts(.7, 1, .1), topC); lathe(hT, shellPts(.63, .76, .125), shade(topC, .8)); sph(hT, .1, '#ffffff', 0, 1.2, 0); }
  if (hat === 2) { lathe(hT, shellPts(.74, 1, .09), topC); const br = cyl(hT, .34, .34, .065, shade(topC, .8), 0, .765, .46); br.scale.set(1, 1, .95); br.rotation.x = .14; sph(hT, .05, shade(topC, .8), 0, 1.1, 0); }
  if (hat === 3) { cyl(hT, .37, .35, .28, '#ffffff', 0, 1.02, -.02); for (let i = 0; i < 5; i++) { const an = i / 5 * PI * 2; sph(hT, .24, i % 2 ? '#ffffff' : '#ece8df', Math.sin(an) * .24, 1.28, Math.cos(an) * .24 - .02); } sph(hT, .26, '#ffffff', 0, 1.38, -.02); }
  if (hat === 4) { cyl(hT, .3, .28, .14, gold, 0, 1.03, -.02); for (let i = 0; i < 6; i++) { const an = i / 6 * PI * 2; cone(hT, .07, .16, gold, Math.sin(an) * .26, 1.17, Math.cos(an) * .26 - .02); sph(hT, .034, i % 2 ? '#e5543b' : '#7ed3b2', Math.sin(an) * .3, 1.04, Math.cos(an) * .3 - .02); } }
  if (hat === 5) for (const s of [-1, 1]) { const e = cone(hT, .16, .32, a.hair === 5 ? topC : hair, s * .3, 1.06, 0); e.rotation.z = -s * .3; e.scale.z = .6; const i2 = cone(hT, .09, .2, '#ffb3c4', s * .3, 1.04, .05); i2.rotation.z = -s * .3; i2.scale.z = .5; }
  if (hat === 6) { ring(hT, .6, .035, '#2b2b2b', 0, .46, 0, PI); for (const s of [-1, 1]) cyl(hT, .16, .16, .12, topC, s * .6, .44, 0).rotation.z = PI / 2; }
  if (hat === 7) { for (let i = 0; i < 5; i++) { const an = i / 5 * PI * 2; sph(hT, .085, '#ff8fab', .4 + Math.cos(an) * .1, .84 + Math.sin(an) * .1, .3).scale.z = .6; } sph(hT, .065, gold, .4, .84, .34); }
  if (hat === 8) { for (const s of [-1, 1]) { const b = cone(hT, .17, .3, '#ff5d8f', s * .17, 1.08, .05); b.rotation.z = s * PI / 2; b.scale.z = .6; } sph(hT, .07, '#ff8fab', 0, 1.08, .06); }
  if (hat === 9) { cyl(hT, .38, .5, .3, topC, 0, .96, -.02); cyl(hT, .68, .76, .08, shade(topC, .82), 0, .8, -.02); }
  if (hat === 10) { const b = sph(hT, .42, topC, .07, 1.0, -.02); b.scale.set(1.15, .36, 1.1); b.rotation.z = -.22; sph(hT, .03, shade(topC, .7), .1, 1.16, -.02); }
  if (hat === 11) { cyl(hT, .37, .44, .24, '#e8c860', 0, 1.0, -.02); cyl(hT, .8, .82, .06, '#d9b54a', 0, .865, -.02); cyl(hT, .43, .445, .07, topC, 0, .92, -.02); }
  if (hat === 12) for (const s of [-1, 1]) { const e = sph(hT, .1, '#ffffff', s * .2, 1.3, -.02); e.scale.set(1, 3.2, .5); e.rotation.z = -s * .14; const i2 = sph(hT, .06, '#ffb3c4', s * .2, 1.3, .02); i2.scale.set(1, 3.6, .4); i2.rotation.z = -s * .14; }
  if (hat === 14) { cyl(hT, .3, .3, .5, '#2b2730', 0, 1.18, -.02); cyl(hT, .54, .54, .06, '#2b2730', 0, .945, -.02).scale.z = .9; cyl(hT, .305, .305, .09, topC, 0, 1.0, -.02); }
  if (hat === 15) { cone(hT, .26, .6, topC, 0, 1.28, 0); for (const [y, r] of [[1.13, .2], [1.3, .125]]) ring(hT, r, .025, '#ffffff', 0, y, 0).rotation.x = PI / 2; sph(hT, .08, '#ffd23f', 0, 1.6, 0); }
  if (hat === 16) { // a bicorne: a low crown between two tall flaps, gold along their edges
    sph(hT, .45, '#2b2228', 0, 1.0, -.02).scale.set(1.2, .5, 1.0); const br = cyl(hT, .6, .6, .06, '#2b2228', 0, .93, -.02); br.scale.z = .78;
    for (const s of [-1, 1]) { const fl = sph(hT, .5, '#2b2228', 0, 1.1, -.02 + s * .4); fl.scale.set(1.34, .6, .14); fl.rotation.x = -s * .2; const tr = ring(hT, .5, .02, gold, 0, 1.1, -.02 + s * .4, PI); tr.scale.set(1.34, .6, 1); tr.rotation.x = -s * .2; }
    sph(hT, .08, '#ffffff', 0, 1.2, .43).scale.z = .4; for (const s of [-1, 1]) box(hT, .2, .028, .02, '#ffffff', 0, 1.08, .47).rotation.z = s * .5; }
  if (hat === 17) { lathe(hT, shellPts(.72, 1, .1), '#9aa3ad'); lathe(hT, shellPts(.66, .78, .125).slice(0, 9), '#c8a050'); for (const s of [-1, 1]) { const hn = cone(hT, .1, .36, '#f4ecd8', s * .52, 1.08, 0); hn.rotation.z = -s * .55; } }
  if (hat === 18) ring(hT, .3, .035, gold, 0, 1.32, 0).rotation.x = PI / 2;
  if (hat === 19) { lathe(hT, shellPts(.74, 1, .09), topC); const br = cyl(hT, .34, .34, .065, shade(topC, .8), 0, .765, .46); br.scale.set(1, 1, .95); br.rotation.x = .14; cyl(hT, .02, .015, .14, '#555055', 0, 1.15, 0); box(hT, .62, .02, .08, '#e5543b', 0, 1.22, 0).rotation.y = .6; box(hT, .08, .02, .62, '#4f9df0', 0, 1.22, 0).rotation.y = .6; sph(hT, .035, gold, 0, 1.24, 0); }
  if (hat === 20) { sph(hT, .5, '#6cc76a', 0, .92, -.02).scale.set(1.08, .62, 1.02); for (const s of [-1, 1]) { sph(hT, .12, '#ffffff', s * .22, 1.2, .22); sph(hT, .055, '#1a1014', s * .22, 1.22, .33); } }
  if (hat === 21) { cone(hT, .36, .62, '#d9342b', 0, 1.2, -.05).rotation.x = -.35; cyl(hT, .42, .42, .12, '#ffffff', 0, .93, -.02); sph(hT, .09, '#ffffff', 0, 1.49, -.16); }
  if (hat === 22) { cone(hT, .4, .9, '#3b5bb5', 0, 1.4, -.02); cyl(hT, .76, .8, .06, '#2e4a96', 0, .935, -.02); for (const [y, an] of [[1.15, .3], [1.32, -.9], [1.5, .8], [1.06, -.4]]) { const r = .4 * (1 - (y - .95) / .9) + .01; sph(hT, .035, gold, Math.sin(an) * r, y, Math.cos(an) * r - .02); } }
  if (hat === 23) { ring(hT, .44, .02, '#4fa85a', 0, .86, -.02).rotation.x = PI / 2; for (let i = 0; i < 9; i++) { const an = i / 9 * PI * 2; sph(hT, .072, ['#ff8fab', '#ffd23f', '#ffffff', '#c9b3ff'][i % 4], Math.sin(an) * .45, .87, Math.cos(an) * .44 - .02); } }
  if (hat === 24) for (const s of [-1, 1]) cone(hT, .07, .22, '#d9342b', s * .25, 1.06, .1).rotation.z = -s * .35;
  if (hat === 25) for (const s of [-1, 1]) { cyl(hT, .012, .012, .34, '#2b2b2b', s * .16, 1.12, 0).rotation.z = -s * .3; sph(hT, .06, topC, s * .21, 1.28, 0); }
  if (hat === 26) { cyl(hT, .34, .38, .3, '#9a6234', 0, 1.02, -.02); const br = cyl(hT, .82, .82, .06, '#8a5428', 0, .885, -.02); br.scale.z = .85; for (const s of [-1, 1]) { const cu = cyl(hT, .3, .3, .06, '#8a5428', s * .68, .95, -.02); cu.scale.z = 1.7; cu.rotation.z = s * .55; } cyl(hT, .385, .385, .06, '#4a2f2a', 0, .9, -.02); }
  if (hat === 27) { sph(hT, .62, '#e5402f', 0, .92, -.02).scale.set(1, .55, 1); for (const [ph, th] of [[.15, 0], [.6, .5], [.6, 2.6], [.7, 4.4], [.9, 1.5], [.95, 3.5], [.85, 5.6]]) sph(hT, .07, '#ffffff', .62 * Math.sin(ph) * Math.sin(th), .92 + .34 * Math.cos(ph), .62 * Math.sin(ph) * Math.cos(th) - .02).scale.y = .5; }
  if (hat === 28) { const h = cone(hT, .1, .5, '#fff4c8', 0, 1.16, .3); h.rotation.x = .5; for (const [k, r] of [[.0, .09], [.14, .065]]) ring(hT, r, .018, gold, 0, .97 + k * Math.cos(.5), .18 + k * Math.sin(.5)).rotation.x = PI / 2 + .5; }
  if (hat === 41) { // a mug of coffee on a saucer, with a heart on the front and steam coming off
    cyl(hT, .44, .36, .05, '#efe2cc', 0, .99, -.02); cyl(hT, .3, .27, .36, '#fffaf0', 0, 1.19, -.02); ring(hT, .3, .028, '#efe2cc', 0, 1.37, -.02).rotation.x = PI / 2;
    cyl(hT, .275, .275, .02, COFFEE, 0, 1.365, -.02); sph(hT, .1, '#e9c9a0', .03, 1.37, -.02).scale.set(1, .08, 1);
    ring(hT, .11, .036, '#fffaf0', .37, 1.19, -.02); put(hT, G('hrtm', heartG(.085)), '#e5543b', 0, 1.18, .275);
    for (const [sx, sy, r] of [[-.06, 1.52, .06], [.05, 1.66, .048], [-.03, 1.78, .036]]) sph(hT, r, '#ffffff', sx, sy, -.02);
  }
  // the Pet Farm's elements as hats: a Leaf sprout, an Ember candle (Flickit's), a Tide wave (Ripplet's), a Spark storm cloud
  if (hat === 42) { sph(hT, .15, '#8a5a3c', 0, 1.0, -.02).scale.set(1.2, .4, 1.2); cyl(hT, .028, .04, .3, '#58b356', 0, 1.16, -.02);
    for (const s of [-1, 1]) { const lf = sph(hT, .17, s < 0 ? '#63b06f' : '#4fa85a', s * .17, 1.36 + s * .02, -.02); lf.scale.set(1.15, .22, .62); lf.rotation.z = s * .55; const rb = box(hT, .3, .014, .02, '#3f8a4f', s * .17, 1.4 + s * .02, -.02); rb.rotation.z = s * .55; }
    sph(hT, .045, '#7fd37a', 0, 1.33, -.02); }
  if (hat === 43) { cyl(hT, .17, .2, .05, gold, 0, 1.0, -.02); cyl(hT, .1, .1, .3, '#fff4e2', 0, 1.17, -.02); ring(hT, .1, .028, '#ffffff', 0, 1.31, -.02).rotation.x = PI / 2; sph(hT, .04, '#ffffff', .1, 1.24, .02).scale.y = 1.8;
    cyl(hT, .012, .012, .07, '#2b2228', 0, 1.35, -.02); sph(hT, .1, '#ff8a1f', 0, 1.47, -.02).scale.set(.85, 1.3, .85); cone(hT, .07, .16, '#ff8a1f', 0, 1.62, -.02); sph(hT, .06, '#ffe066', 0, 1.44, .05).scale.set(.8, 1.25, .7); }
  if (hat === 44) { // a wave rolling over: a wide swell on the crown, a crest that curls round on itself and gets thinner, foam at the lip
    sph(hT, .36, '#2f86cc', 0, .98, -.02).scale.set(1.15, .32, 1.0);
    for (let i = 0; i <= 13; i++) { const k = i / 13, an = 3.5 - k * 3.9, r = .15 - k * .105, o = sph(hT, r, '#2f86cc', -.06 + Math.cos(an) * .23, 1.2 + Math.sin(an) * .23, -.02); o.scale.z = 1.9 - k * .5;
      if (i > 2 && i < 12) sph(hT, r * .7, '#8fd0f5', -.06 + Math.cos(an) * (.23 - r * .5), 1.2 + Math.sin(an) * (.23 - r * .5), -.02).scale.z = 2.1 - k * .5; }
    for (const [fx, fy2, fz2, r] of [[.19, 1.1, .07, .05], [.2, 1.08, -.03, .06], [.19, 1.1, -.12, .05], [.36, 1.0, .08, .05], [.38, .99, -.1, .045], [-.36, 1.02, 0, .045]]) sph(hT, r, '#ffffff', fx, fy2, fz2); }
  if (hat === 45) { for (const [cx, cy, cz, r] of [[-.2, 1.42, -.02, .17], [0, 1.5, -.02, .21], [.21, 1.43, -.02, .16], [.02, 1.4, .1, .15], [-.04, 1.4, -.14, .15]]) sph(hT, r, cz > 0 ? '#aab2c2' : '#8f98ab', cx, cy, cz).scale.y = .85;
    for (const [bx, by, rz, w] of [[.04, 1.27, .5, .16], [-.02, 1.19, -.6, .14], [.03, 1.1, .5, .13]]) box(hT, .05, w, .035, '#ffd23f', bx, by, .04).rotation.z = rz;
    for (const [dx, dy] of [[-.24, 1.2], [.26, 1.22]]) sph(hT, .035, '#7fc8ee', dx, dy, 0).scale.y = 1.6; }
  if (hat === 13) { cone(hT, .38, .8, '#4b3a6b', 0, 1.36, -.02); cyl(hT, .74, .78, .06, '#3d2f58', 0, .905, -.02); cyl(hT, .345, .375, .07, gold, 0, .98, -.02); }
  // a helmet or hood: a shell over the top and round the back and sides of the head, open at the face
  const wrapShell = (c, off = .1, hf = .76, hb = .1) => { part(hT, shellPts(hf, 1, off), c, 0, A); part(hT, shellPts(hb, 1, off), c, PI, PI - A); };
  const flat2 = (p, r, c, x, y, z) => { const o = sph(p, r, c, x, y, z); o.scale.set(1.5, .3, .8); o.rotation.z = .4; return o; };
  const eyesOn = (r, y, z, x = .2) => { for (const s of [-1, 1]) { sph(hT, r, '#ffffff', s * x, y, z); sph(hT, r * .45, '#1a1014', s * x, y + r * .15, z + r * .82); } };
  if (hat === 29) { cone(hT, .36, .9, '#ff7a1a', 0, 1.33, -.02); box(hT, .86, .08, .86, '#ff7a1a', 0, .89, -.02); for (const y of [1.1, 1.34]) { const r = .36 * (1 - (y - .88) / .9); cyl(hT, r - .018, r + .03, .12, '#ffffff', 0, y, -.02); } }
  if (hat === 30) { cyl(hT, .38, .5, .3, '#6cc76a', 0, .96, -.02); cyl(hT, .68, .76, .08, '#58b356', 0, .8, -.02); eyesOn(.13, 1.16, .2); for (const s of [-1, 1]) sph(hT, .04, '#ff8fab', s * .34, .98, .36).scale.z = .4; }
  if (hat === 31) { ring(hT, .66, .06, '#2b2b2b', 0, .46, 0, PI); for (const s of [-1, 1]) { cyl(hT, .22, .22, .14, topC, s * .66, .44, 0).rotation.z = PI / 2; cyl(hT, .18, .18, .08, '#2b2b2b', s * .57, .44, 0).rotation.z = PI / 2; sph(hT, .09, shade(topC, 1.4), s * .73, .44, 0).scale.x = .4; } }
  if (hat === 32) { wrapShell('#f4f1ea', .17, .74, .04); part(hT, shellPts(.7, .78, .19), gold, 0, A + .05); ring(hT, .5, .08, '#c9ccd2', 0, .03, -.03).rotation.x = PI / 2; for (const s of [-1, 1]) cyl(hT, .12, .12, .08, '#e5543b', s * .66, .45, 0).rotation.z = PI / 2;
    cyl(hT, .012, .012, .22, '#8a8f98', .3, 1.2, -.1); sph(hT, .04, '#e5543b', .3, 1.32, -.1); }
  if (hat === 33) { wrapShell('#a8b0ba', .12, .72, .08); part(hT, shellPts(.66, .76, .14), '#7d858f', 0, A + .05); box(hT, .06, .34, .04, '#7d858f', 0, .55, hr(.55) + .1);
    for (let i = 0; i < 8; i++) { const an = -.45 + i * .3; sph(hT, .13 - i * .006, i % 2 ? '#b8271f' : '#d9342b', 0, .47 + Math.cos(an) * .78, -Math.sin(an) * .7 - .02).scale.x = .7; } }
  if (hat === 34) { sph(hT, .24, '#ffd93b', 0, 1.2, -.04).scale.set(1, .8, 1.25); sph(hT, .16, '#ffd93b', 0, 1.44, .12); const bk2 = cone(hT, .07, .14, '#ff8a2a', 0, 1.42, .3); bk2.rotation.x = PI / 2; bk2.scale.x = 1.5; for (const s of [-1, 1]) sph(hT, .025, '#1a1014', s * .08, 1.49, .24); cone(hT, .1, .16, '#ffd93b', 0, 1.3, -.34).rotation.x = -PI / 2 + .6; }
  if (hat === 35) { const w = put(hT, G('wedge', () => new THREE.CylinderGeometry(.46, .46, .3, 3)), '#ffc93c', 0, 1.14, -.02); w.rotation.y = PI; for (const [x1, y1, z1, r] of [[.12, 1.3, .05, .07], [-.14, 1.3, -.12, .05], [0, 1.14, .215, .06], [.2, 1.18, -.14, .05], [-.24, 1.1, -.02, .06]]) sph(hT, r, '#e8a820', x1, y1, z1).scale.y = .5; }
  if (hat === 36) { sph(hT, .6, '#f08a24', 0, .95, -.02).scale.set(1, .62, 1); for (let i = 0; i < 4; i++) { const rb = sph(hT, .6, '#dd7616', 0, .95, -.02); rb.scale.set(.2, .64, 1.03); rb.rotation.y = i * PI / 4; }
    const stm = cyl(hT, .05, .07, .2, '#5a8a3a', .03, 1.38, -.02); stm.rotation.z = -.3; flat2(hT, .12, '#63b06f', .2, 1.36, -.02); }
  if (hat === 37) for (const s of [-1, 1]) { cyl(hT, .03, .04, .36, '#8a5a3c', s * .26, 1.2, 0).rotation.z = -s * .35; cyl(hT, .024, .028, .18, '#8a5a3c', s * .4, 1.3, 0).rotation.z = -s * 1.1; cyl(hT, .024, .028, .16, '#8a5a3c', s * .22, 1.33, 0).rotation.z = s * .5; const er = sph(hT, .08, '#b98a5e', s * .44, 1.0, 0); er.scale.set(1.4, .7, .5); er.rotation.z = s * .4; }
  if (hat === 38) { ring(hT, .57, .03, '#e5543b', 0, .46, 0, PI); for (const s of [-1, 1]) sph(hT, .2, '#fff4f7', s * .58, .44, 0).scale.x = .7; }
  if (hat === 39) { sph(hT, .5, '#f2b632', 0, 1.0, -.02).scale.set(.98, .74, .98); for (let i = 0; i < 14; i++) { const an = i * 2.4, e = .5 + (i % 4) * .28; sph(hT, .05, '#c98a1a', Math.sin(an) * Math.sin(e) * .49, 1.0 + Math.cos(e) * .37, Math.cos(an) * Math.sin(e) * .49 - .02).scale.y = .6; }
    for (let i = 0; i < 6; i++) { const an = i / 6 * PI * 2, lf = cone(hT, .09, .4, i % 2 ? '#3f8a4f' : '#58b356', Math.sin(an) * .1, 1.5, Math.cos(an) * .1 - .02); lf.rotation.set(Math.cos(an) * .5, 0, -Math.sin(an) * .5); } cone(hT, .08, .46, '#58b356', 0, 1.58, -.02); }
  if (hat === 40) { lathe(hT, shellPts(.8, 1, .09), '#ff7fa8'); for (let i = 0; i < 6; i++) { const an = i / 6 * PI * 2, pt = cone(hT, .26, .46, i % 2 ? '#ff5d8f' : '#ff7fa8', Math.sin(an) * .44, .86, Math.cos(an) * .44 - .02); pt.rotation.set(PI + Math.cos(an) * .55, 0, -Math.sin(an) * .55); pt.scale.set(1, 1, 1); }
    cyl(hT, .035, .045, .3, '#58b356', 0, 1.22, -.02); const lf = sph(hT, .1, '#63b06f', .1, 1.24, -.02); lf.scale.set(1.5, .3, .7); lf.rotation.z = .5; }
  if (hat === 46) { // tiara: a thin gold band with a tall middle point and pale jewels
    const tb = ring(hT, .34, .022, gold, 0, 1.0, -.02, PI * 1.1); tb.rotation.set(-PI / 2 + .15, 0, -PI * .05);
    for (const [an, hh, cj] of [[0, .2, '#ff8fab'], [-.5, .13, '#7fd1e8'], [.5, .13, '#7fd1e8'], [-.95, .08, '#ffffff'], [.95, .08, '#ffffff']]) { const x = Math.sin(an) * .34, z = Math.cos(an) * .34 - .02; const pk = cone(hT, .05, hh, gold, x, 1.02 + hh / 2, z); pk.rotation.z = -an * .2; pk.scale.z = .45; sph(hT, .034, cj, x * 1.03, 1.04, z * 1.03 + .01).scale.z = .6; }
  }
  if (hat === 47) { // bridal veil: a band of little white flowers and a soft veil falling down the back to the shoulders
    for (let i = 0; i < 9; i++) { const an = (i - 4) * .3; sph(hT, .055, i % 2 ? '#fff4f7' : '#ffffff', Math.sin(an) * .42, 1.0 - Math.abs(an) * .08, Math.cos(an) * .42 - .05); }
    const vp = [[.8, -.22], [.74, .2], [.66, .55], [.5, .86], [.22, 1.04]]; // the veil flares out from the back of the crown over the hair, lined inside
    part(hT, vp, '#f4f7fb', PI, 1.35); part(hT, vp.map(([r2, y2]) => [r2 - .02, y2]).reverse(), '#e4eaf1', PI, 1.35); part(hT, [[.82, -.25], [.8, -.19]], '#ffffff', PI, 1.35);
  }
  if (hat === 48) { // sweatband: a thick terry band round the forehead, with a stripe
    lathe(hT, shellPts(.64, .8, .06), '#ffffff'); lathe(hT, shellPts(.7, .74, .075), topC);
  }
  if (hat === 49) { // deerstalker: a tweed cap with a peak at the front and the back, and the ear flaps tied up on top
    const tw = '#a08058', tk = shade(tw, .75); lathe(hT, shellPts(.68, 1, .1), tw); for (const yy of [.76, .86, .94]) lathe(hT, shellPts(yy, yy + .018, .108), tk);
    for (const z of [1, -1]) { const pk = sph(hT, .34, tw, 0, .72, z * .42); pk.scale.set(1, .16, .75); pk.rotation.x = z * .2; }
    for (const sx of [-1, 1]) { const fl = sph(hT, .16, tw, sx * .32, 1.02, -.02); fl.scale.set(.35, 1, .8); fl.rotation.z = -sx * .55; }
    sph(hT, .05, '#4a2f2a', 0, 1.2, -.02).scale.x = 1.6;
  }
  // the pulled-up hood of a costume top (only when no hat is worn)
  if (hoodC && !mascot) {
    const hw2 = WRAP_AT.hood, lip = shade(hoodC, .86);
    part(hT, shellPts(.78, 1, .11), hoodC, 0, hw2 + .02); part(hT, shellPts(.1, 1, .11), hoodC, PI, PI - hw2);
    part(hT, shellPts(.74, .82, .14), lip, 0, hw2 + .06); for (const s of [-1, 1]) part(hT, shellPts(.1, .8, .14).slice(0, 15), lip, s * (hw2 + .03), .07);
    if (top === 23) { eyesOn(.11, 1.1, .3, .22); for (let i = 0; i < 4; i++) { const an = .1 + i * .5, sp = cone(hT, .07, .17, '#3f9a4a', 0, .47 + Math.cos(an) * .7, -Math.sin(an) * .64 - .02); sp.rotation.x = -an; sp.scale.x = .55; } for (let i = 0; i < 6; i++) { const an = (i - 2.5) * .34; cone(hT, .035, .09, '#ffffff', Math.sin(an) * (hr(.76) + .1), .73, Math.cos(an) * (hr(.76) + .1)).rotation.x = PI; } }
    if (top === 24) { const st = cyl(hT, .05, .09, .26, '#8a6a2a', 0, 1.2, -.04); st.rotation.x = -.3; sph(hT, .055, '#5a3a22', 0, 1.33, -.08); }
    if (top === 25) { const tp = cone(hT, .2, .42, hoodC, 0, 1.12, -.2); tp.rotation.x = -.9; }
    if (top === 26) for (const s of [-1, 1]) { cyl(hT, .014, .014, .3, '#2b2228', s * .16, 1.2, .1).rotation.z = -s * .3; sph(hT, .06, '#ffc93c', s * .21, 1.35, .1); }
    if (top === 28) for (const s of [-1, 1]) { sph(hT, .15, hoodC, s * .34, 1.06, 0).scale.z = .6; sph(hT, .09, shade(hoodC, 1.5), s * .34, 1.06, .06).scale.z = .5; }
  }
  // big shiny cartoon eyes for the mascot heads
  const cuteEye = (x, y, z, r = .135) => { const ey = sph(hT, r, '#ffffff', x, y, z); ey.scale.z = .8; const pu = sph(hT, r * .7, '#2a1a22', x - Math.sign(x) * .01, y - .01, z + r * .52); pu.scale.set(1, 1.1, .55);
    sph(hT, r * .24, '#ffffff', x - Math.sign(x) * .01 + .03, y + .04, z + r * .9); sph(hT, r * .12, '#ffffff', x - Math.sign(x) * .01 - .03, y - .04, z + r * .9); };
  if (mascot && top === 23) { // a big round dino head over the whole head, with a long snout, a toothy grin, eyes on bumps and spikes
    const G0 = hoodC, DK = '#3f9a4a', BL = '#d9f2a6', C = .47;
    lathe(hT, HP.map(([r, y]) => [r * 1.13, C + (y - C) * (y > C ? 1.12 : 1.04)]), G0);
    const sn = sph(hT, .34, G0, 0, .43, .5); sn.scale.set(.9, .62, 1.24); // upper snout
    const jw = sph(hT, .3, BL, 0, .23, .46); jw.scale.set(.8, .38, 1.12); // pale lower jaw
    // cute, not scary: big shiny eyes, round blush and no frown (the teeth stay sharp)
    for (let i = 0; i < 9; i++) { const an = (i - 4) * .26, tt = cone(hT, .03, .075, '#ffffff', Math.sin(an) * .29, .27, .5 + Math.cos(an) * .38); tt.rotation.x = PI; }
    for (const s of [-1, 1]) {
      const ns = sph(hT, .03, '#2d5e33', s * .1, .6, .84); ns.scale.set(1.2, .6, .6); ns.rotation.x = -.6;
      const bl = sph(hT, .085, '#ff9fb2', s * .25, .45, .66); bl.scale.set(.55, .6, .3); bl.rotation.y = s * .8;
      sph(hT, .16, G0, s * .23, .73, .46); // the bumps the eyes sit in
      cuteEye(s * .23, .74, .55);
    }
    for (let i = 0; i < 6; i++) { const an = .45 + i * .4, sz = 1.1 - i * .1, sp = cone(hT, .1 * sz, .24 * sz, DK, 0, C + Math.cos(an) * .63, -Math.sin(an) * .62); sp.rotation.x = -an; sp.scale.x = .62; }
  }
  if (mascot && top === 38) { // a fluffy llama head: a long soft muzzle, tall banana ears and a woolly tuft on top
    const C = .47, MZ = '#fbf4e6', IN = '#ffb3c4', TU = '#fffaf0';
    lathe(hT, HP.map(([r, y]) => [r * 1.12, C + (y - C) * (y > C ? 1.1 : 1.04)]), LLAMA);
    const mz = sph(hT, .3, MZ, 0, .33, .5); mz.scale.set(.86, .74, 1.05); // muzzle
    for (const s of [-1, 1]) {
      const ns = sph(hT, .03, '#5a3a32', s * .07, .44, .8); ns.scale.set(1.3, .7, .6); ns.rotation.z = s * .5;
      const bl = sph(hT, .085, '#ff9fb2', s * .3, .44, .6); bl.scale.set(.55, .6, .3); bl.rotation.y = s * .8;
      cuteEye(s * .22, .68, .5, .125);
      const er = sph(hT, .13, LLAMA, s * .3, 1.2, -.02); er.scale.set(.45, 1.25, .38); er.rotation.z = -s * .28; // ears
      const ei = sph(hT, .1, IN, s * .3, 1.2, .025); ei.scale.set(.38, 1.05, .2); ei.rotation.z = -s * .28;
    }
    const mo = ring(hT, .05, .012, '#5a3a32', 0, .33, .8, PI); mo.rotation.z = PI; mo.scale.y = .7; // a little smile
    for (const [x, y, z, r] of [[0, 1.12, .12, .12], [-.12, 1.09, .06, .1], [.12, 1.09, .06, .1], [0, 1.1, -.04, .11], [-.06, 1.02, .26, .09], [.07, 1.02, .25, .085]]) sph(hT, r, TU, x, y, z);
  }
  const tmpGeo = fitHat(hg, hH, hT, hatKey, hr);

  // ----- turn the loose parts into a few meshes: body, head, two arms, and the painted face -----
  const k = seated ? SIT_K : STAND_K;
  g.scale.setScalar(k); g.position.y = -.76 - (seated ? (hipY - lb * 1.55) * k : 0);
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  const to = paintFace(a, false), tc = paintFace(a, true);
  const faceMat = new THREE.MeshToonMaterial({ map: to, gradientMap: grad });
  const faceGeo = new THREE.LatheGeometry(HP.map(([r, y]) => new THREE.Vector2(r, y)), SEG + 4, -PI, PI * 2);
  const face = new THREE.Mesh(faceGeo, faceMat); face.castShadow = true; face.userData.face = true; face.visible = !mascot; hg.add(face);
  root.updateWorldMatrix(true, true);
  // the face joins the head's outline so the whole head gets one clean rim
  const fg = faceGeo.toNonIndexed(); fg.applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(face.matrixWorld));
  const bones = [g, hp];
  g.traverse(o => { if (o.userData.sub) bones.push(o.parent, o); });
  merge(root, bones, mat, mascot ? [] : [{ bone: hp, pos: fg.attributes.position.array, nor: fg.attributes.normal.array }]); fg.dispose();
  for (const t of tmpGeo) t.dispose();
  ud.head = hp; ud.tilt = seated ? -.26 : 0; hp.rotation.x = ud.tilt; ud.body = g; ud.k = k; ud.faceMat = faceMat; ud.to = to; ud.tc = tc; ud.mat = mat;
  ud.headH = headH * k; ud.headY = g.position.y + (shY + neckL + .03 * H + headH * .48) * k;
  root.userData = ud;
  LIVE.add(new WeakRef(root));
  return root;
}

// Call every frame. T is seconds; seed keeps avatars out of sync; hop runs 1 -> 0 during a happy bounce.
export function animateAvatar(g, T, { seed = 0, active = false, hop = 0, look = 0, nod = 0 } = {}) {
  const u = g.userData, ph = (T + seed * 1.37) % 3.8;
  u.head.rotation.z = Math.sin(T * 1.3 + seed) * .07;
  u.head.rotation.x = u.tilt + Math.sin(T * .9 + seed * 2) * .04 - hop * .18 + nod * .4; // seated avatars look up a little, towards the camera
  u.head.rotation.y = Math.sin(T * .45 + seed * 3) * .1 + look;
  const map = ph < .13 || (seed % 2 && ph > .3 && ph < .4) ? u.tc : u.to;
  if (u.faceMat.map !== map) u.faceMat.map = map;
  u.body.scale.y = u.k * (1 + Math.sin(T * 1.8 + seed) * .012);
  u.arms.forEach((a, i) => {
    a.rotation.x = a.userData.rx + Math.sin(T * 1.5 + seed + i * 2) * .05 + (active ? Math.sin(T * 6 + i * Math.PI) * .14 : 0) - Math.sin(hop * Math.PI) * 1.3;
  });
  const k = Math.sin(hop * Math.PI * 4) * .07 * hop; // squash and stretch
  g.scale.set(1 - k * .6, 1 + k, 1 - k * .6);
}

// A walk cycle for a standing avatar: legs stride from the hip with a knee bend on the way forward, arms swing
// against the legs, the head stays level. ph: stride phase in radians (advance it with distance); amt: 0 standing, 1 walking.
export function walkAvatar(g, ph, amt = 1) {
  const u = g.userData;
  u.legs.forEach((l, i) => { const p = ph + i * Math.PI, s = Math.sin(p), c = Math.cos(p);
    l.rotation.x = -s * .62 * amt; l.userData.kn.rotation.x = (Math.max(0, c) * .95 + Math.max(0, -s) * .25) * amt; });
  u.arms.forEach((a, i) => { a.rotation.x += (Math.sin(ph + i * Math.PI) * .55 * amt - .12 * amt) * (a.userData.hold ? .35 : 1); }); // a held item swings less
  u.head.rotation.x -= .07 * amt; u.head.rotation.z *= 1 - amt * .6;
}

export function disposeAvatar(g) {
  const u = g.userData;
  u.gone = true;
  g.traverse(m => { if (m.isMesh && (m.userData.baked || m.userData.face)) m.geometry.dispose(); if (m.isSkinnedMesh) m.skeleton.dispose(); });
  u.to?.dispose(); u.tc?.dispose(); u.faceMat?.dispose(); u.mat?.dispose();
}

// ---------- where heads are on screen (for the floating name tags, see nametag.js) ----------
// Every avatar registers itself; each scene's render tells us its camera and canvas (Scene.onAfterRender). headSpots() then gives
// each visible head's centre and radius in canvas pixels, so tags can sit above heads (or beside them) in every game
// without each scene working it out. Off-screen picture renders (portraits) are ignored: their canvas is not on the page.
const LIVE = new Set();
let view = null, spotsAt = -1, spots = [];
const _nsB = new THREE.Box3(), _nsS = new THREE.Sphere(), _nsC = new THREE.Vector3(), _nsU = new THREE.Vector3(), _nsK = new THREE.Vector3();
THREE.Scene.prototype.onAfterRender = function (renderer, scene, camera) {
  const el = renderer.domElement;
  if (camera?.isPerspectiveCamera && !renderer.getRenderTarget() && el.isConnected && el.clientWidth > 160) view = { scene, camera, el, t: performance.now() };
};
const shown = (o, scene) => { for (; o; o = o.parent) { if (!o.visible) return false; if (o === scene) return true; } return false; };
export function headSpots() {
  if (!view || !view.el.isConnected) return [];
  if (spotsAt === view.t) return spots;
  spotsAt = view.t; spots = [];
  const { scene, camera, el } = view, W = el.clientWidth, H = el.clientHeight;
  for (const ref of LIVE) {
    const root = ref.deref(), ud = root?.userData;
    if (!root || ud.gone) { LIVE.delete(ref); continue; }
    const h = ud.head; if (!h || !shown(root, scene)) continue;
    if (!ud.hb) { // the head's bounds (hair and hats included), once, in the head's own space
      partBox(h, _nsB); if (_nsB.isEmpty()) continue;
      _nsB.getBoundingSphere(_nsS); h.getWorldScale(_nsK);
      ud.hb = { c: h.worldToLocal(_nsS.center.clone()), r: _nsS.radius / (_nsK.x || 1) };
    }
    _nsC.copy(ud.hb.c); h.localToWorld(_nsC); h.getWorldScale(_nsK);
    const r = ud.hb.r * _nsK.x * .72;
    _nsU.setFromMatrixColumn(camera.matrixWorld, 1).normalize().multiplyScalar(r).add(_nsC);
    _nsC.project(camera); _nsU.project(camera);
    if (_nsC.z > 1 || Math.abs(_nsC.x) > 1.3 || Math.abs(_nsC.y) > 1.3) continue;
    spots.push({ x: (_nsC.x + 1) / 2 * W, y: (1 - _nsC.y) / 2 * H, r: Math.abs(_nsU.y - _nsC.y) / 2 * H, el, root });
  }
  return spots;
}

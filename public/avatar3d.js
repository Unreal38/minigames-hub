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
//   bake(root)           merges a group's static meshes into a few (see below); any 3D game can use it on its props.
import * as THREE from 'three';
import { SKINS, HAIR_COLS, EYE_COLS, BOTTOM_COLS, SHOE_COLS, avObj } from './avatar.js';
import { hairParts, HC, envT } from './hair3d.js';

// ---------- bake: for scenery ----------

// Merge the plain meshes under root into one mesh per kind of surface, with the paint moved into vertex colours.
// A model made of 70 little parts then costs a handful of draw calls instead of 70. Skips anything flagged
// userData.dyn (and everything inside it), hidden meshes, textured or non-standard materials and instanced meshes.
const _bm = new THREE.Matrix4(), _inv = new THREE.Matrix4();
export function bake(root) {
  root.updateWorldMatrix(true, true); _inv.copy(root.matrixWorld).invert();
  const buckets = new Map(), gone = [];
  const walk = o => {
    for (const c of o.children) {
      if (c.userData.dyn || !c.visible) continue;
      const mt = c.material;
      if (c.isMesh && !c.isInstancedMesh && !c.children.length && mt.isMeshStandardMaterial && !mt.map && !mt.vertexColors) {
        const rough = Math.round(mt.roughness * 5) / 5, metal = Math.round(mt.metalness * 4) / 4, op = mt.transparent ? mt.opacity : 1;
        const key = [rough, metal, mt.side, op, mt.envMapIntensity, c.castShadow, c.receiveShadow].join();
        let b = buckets.get(key);
        if (!b) buckets.set(key, b = { parts: [], n: 0, rough, metal, side: mt.side, op, env: mt.envMapIntensity, cast: c.castShadow, recv: c.receiveShadow });
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        g.applyMatrix4(_bm.multiplyMatrices(_inv, c.matrixWorld));
        b.parts.push([g.attributes.position.array, g.attributes.normal.array, mt.color]); b.n += g.attributes.position.count; g.dispose(); gone.push(c);
      } else walk(c);
    }
  };
  walk(root);
  for (const m of gone) m.parent.remove(m);
  for (const b of buckets.values()) {
    const pos = new Float32Array(b.n * 3), nor = new Float32Array(b.n * 3), col = new Float32Array(b.n * 3); let o = 0;
    for (const [p, n, c] of b.parts) {
      pos.set(p, o); nor.set(n, o);
      for (let i = 0; i < p.length; i += 3) { col[o + i] = c.r; col[o + i + 1] = c.g; col[o + i + 2] = c.b; }
      o += p.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
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
// Big pieces (body, head, sleeves, hats) get the full OUTLINE; small ones get a line in proportion to their size
// (about a sixth of the mean of their two thinnest sides, never under INK_MIN) so a bead or a pin is not swallowed by a dark ring
// twice its size. Small pieces are also inked in a dark shade of their own colour rather than near-black, so pearls
// stay pearly and a tiny medal does not turn into a brown smudge.
const OUTLINE = .022, INK_MIN = .0035, INK = new THREE.Color('#3a2630');
const lineMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
const _bx = new THREE.Vector3(), _sx = new THREE.Vector3(), _lc = new THREE.Color();
const inkOf = ch => {
  const gb = ch.geometry; if (!gb.boundingBox) gb.computeBoundingBox();
  gb.boundingBox.getSize(_bx); _m.multiplyMatrices(_i, ch.matrixWorld); _sx.setFromMatrixScale(_m);
  const [a, b] = [_bx.x * _sx.x, _bx.y * _sx.y, _bx.z * _sx.z].sort((a, b) => a - b), d = Math.sqrt(a * b); // flat things (a coin, a tag) count as small
  const w = Math.min(OUTLINE, Math.max(INK_MIN, d * .16)), small = Math.min(1, Math.max(0, (.09 - d) / .05));
  return { hard: HARD.has(gb.type), w, col: _lc.copy(INK).lerp(new THREE.Color(ch.userData.c).multiplyScalar(.45), small * .8).clone() };
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

// Merge every stub mesh under root (not inside a group flagged userData.own) into one coloured mesh plus its outline.
const _m = new THREE.Matrix4(), _i = new THREE.Matrix4(), _c = new THREE.Color();
function merge(root, mat, extra = []) {
  root.updateWorldMatrix(true, true); _i.copy(root.matrixWorld).invert();
  const parts = [], gone = []; let n = 0;
  const walk = o => { for (const ch of o.children) {
    if (ch.userData.own) continue;
    if (ch.isMesh && ch.material === stub) {
      const ink = inkOf(ch);
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone(); g.applyMatrix4(_m.multiplyMatrices(_i, ch.matrixWorld));
      parts.push([g.attributes.position.array, g.attributes.normal.array, _c.set(ch.userData.c).clone(), ink, ch.userData.cs && g.attributes.tone ? [g.attributes.tone.array, ch.userData.cs.map(c => new THREE.Color(c))] : null]); n += g.attributes.position.count; g.dispose(); gone.push(ch);
    } else walk(ch);
  } };
  walk(root);
  for (const m of gone) m.parent.remove(m);
  for (const e of extra) parts.push([e.pos, e.nor, null, { w: OUTLINE, col: INK, hard: false }]);
  let ln = 0; for (const q of parts) ln += q[0].length / 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), lpos = new Float32Array(ln * 3), lcol = new Float32Array(ln * 3); let o = 0;
  for (const [p, nn, c, ink, tn] of parts) {
    if (c) { pos.set(p, o); nor.set(nn, o); for (let i = 0; i < p.length; i += 3) { const k = tn ? tn[1][Math.round(tn[0][i / 3])] : c; col[o + i] = k.r; col[o + i + 1] = k.g; col[o + i + 2] = k.b; } } // hair carries a tone per point (see hair3d.js)
    hullOf(p, nn, ink.w, lpos, o, ink.hard); for (let i = 0; i < p.length; i += 3) { lcol[o + i] = ink.col.r; lcol[o + i + 1] = ink.col.g; lcol[o + i + 2] = ink.col.b; }
    o += p.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.baked = true; root.add(mesh);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lcol, 3));
  const line = new THREE.Mesh(lg, lineMat); line.userData.baked = true; root.add(line);
  return mesh;
}

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
  29: .9, 30: .8, 32: .74, 33: .72, 36: .66, 39: .8, 40: .8, hood: .76 };
// Helmets and hoods also wrap the back and sides of the head, so hair there is pressed flat as well ('hood' is the
// pulled-up hood of a costume top, which has no hat number).
const HAT_WRAP = [32, 33, 'hood'], WRAP_AT = { hood: .92 }; // how far round from the front the sides start (radians)
// A headband (headphones, earmuffs) stays its own size on big hair and presses a groove into it instead.
const HAT_BAND = [6, 31, 38];
const HAT_TOP = [4, 5, 6, 7, 8, 12, 15, 18, 23, 24, 25, 28, 31, 34, 35, 37, 38, 41], SHELL = 1.12;
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
const SUITS = { 23: '#62c267', 24: '#ffd93b', 25: '#f7f5ee', 26: '#2b2228', 29: '#1c1a22' };
export const hidesBottom = top => top === 6 || top === 15 || top in SUITS;

export function avatar3d(color, avIn, { pose = 'sit' } = {}) {
  const a = avObj(avIn), seated = pose !== 'stand';
  const root = new THREE.Group(), g = new THREE.Group(), ud = { arms: [], legs: [], eyes: [], dyn: true }; root.add(g);
  const H = 2.4 * [.93, 1, 1.07][a.height], B = BODIES[a.body];
  const topC = /^#[0-9a-f]{6}$/i.test(color) ? color : '#ff8fab';
  const CREAM = '#f6ead8', COFFEE = '#6b4326', LATTE = '#b8743a'; // the Supporter pack's café colours
  const skin = SKINS[a.skin], hair = HAIR_COLS[a.hairC], hD = shade(hair, .8), shoeC = SHOE_COLS[a.shoeC], gold = '#ffc93c';
  const headH = H / P.N * FSH[a.face].h, legLen = H * P.leg, neckL = H * .008, hipY = legLen, shY = H - headH - neckL;
  const W = P.wide, sh = B.sh * H * W, ch = B.ch * H * W, wa = B.wa * H * W, hi = B.hi * H * W, lb = B.lb * H * P.limb, dz = B.dz + .16;
  // A costume (suit) dresses the legs too, whatever bottom was picked, and has a hood that goes up when no hat is worn.
  const top = a.top, suit = SUITS[top], hoodC = a.hat === 0 ? { 23: '#62c267', 24: '#ffd93b', 25: '#f7f5ee', 26: '#2b2228', 28: topC }[top] : null;
  const bot = suit ? 7 : a.bottom, botC = suit || BOTTOM_COLS[a.botC];
  const dress = top === 6 || top === 15, skirt = [3, 5, 6].includes(bot) || dress, longSl = [1, 2, 3, 9, 11, 12, 14, 15, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31].includes(top), noSl = top === 5, lowC = dress ? topC : botC;
  const bodyC = top === 10 ? '#ffffff' : top === 19 ? '#24222c' : top === 21 ? '#a8b0ba' : top === 22 ? '#f4f1ea' : top === 26 ? '#ffc93c' : top === 27 ? '#c8342b' : top === 31 ? CREAM : suit || topC, slvC = top === 14 || top === 16 ? '#ffffff' : top === 26 ? '#2b2228' : bodyC, dk = shade(topC, .62);

  // torso: a soft bean. Hips take the bottom colour.
  const y0 = hipY - .05 * H, t = shY - y0, wy = y0 + .42 * t, yT = shY + .015 * H;
  const TP = [[0, y0], [hi * .55, y0 + .01 * t], [hi * .9, y0 + .07 * t], [hi, y0 + .18 * t], [wa, y0 + .45 * t], [ch, y0 + .72 * t], [sh * .97, y0 + .86 * t], [sh * .8, y0 + .95 * t], [sh * .45, yT], [0, yT]];
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
  if ((bot === 0 || bot === 1 || bot === 8 || bot === 9) && !dress) band(wy - .035 * t, wy + .012 * t, shade(botC, .7), .01);
  // what tells the trousers apart: a buckle, jeans pockets and a stud, a joggers waistband with drawstrings
  if (!dress && !suit) {
    if (bot === 0 || bot === 8) box(g, .07, .045 * t, .02, gold, 0, wy - .012 * t, tz(wy - .012 * t) + .014);
    if (bot === 1) { sph(g, .02, gold, 0, wy - .012 * t, tz(wy - .012 * t) + .016); for (const s of [-1, 1]) { side(y0 + .1 * t, y0 + .3 * t, shade(botC, 1.22), PI + s * .5, .24, .012); side(y0 + .2 * t, y0 + .36 * t, shade(botC, .8), s * .62, .14, .01); } }
    if (bot === 9) { box(g, .07, .045 * t, .02, LATTE, 0, wy - .012 * t, tz(wy - .012 * t) + .014); for (const s of [-1, 1]) { side(y0 + .2 * t, y0 + .36 * t, shade(botC, .8), s * .62, .14, .01); side(y0 + .1 * t, y0 + .28 * t, CREAM, PI + s * .5, .2, .012); } }
    if (bot === 4) { band(wy - .05 * t, wy + .012 * t, '#f4f1ea', .012); for (const s of [-1, 1]) { cyl(g, .01, .01, .1 * t, '#f4f1ea', s * .03, wy - .08 * t, front(s * .03, wy - .08 * t) + .014); sph(g, .016, '#f4f1ea', s * .03, wy - .13 * t, front(s * .03, wy - .13 * t) + .016); } }
  }

  // arms: stubby, with mitten hands. Each arm is its own piece so it can swing.
  const ua = H * .168 * P.arm, fa = H * .15 * P.arm, shX = sh * .86, reach = Math.max(.12, Math.asin(Math.min(.7, Math.max(0, (hi + lb * 1.3 - shX) / (ua + fa)))));
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.userData.own = true; arm.position.set(s * shX, shY - lb * 1.05, 0); arm.rotation.z = s * reach; g.add(arm);
    const slC = noSl ? skin : slvC, cuff = top === 31 ? COFFEE : top === 9 || top === 2 ? '#ffffff' : top === 14 ? dk : top === 22 ? topC : shade(slvC, .82);
    sph(arm, lb * 1.02, slC, 0, 0, 0); cyl(arm, lb * 1.08, lb * .95, ua, longSl ? slvC : skin, 0, -ua / 2, 0);
    if (!longSl && !noSl) { cyl(arm, lb * 1.28, lb * 1.34, ua * .55, slvC, 0, -ua * .27, 0); if (top === 10 || top === 17 || top === 13) cyl(arm, lb * 1.37, lb * 1.37, ua * .12, top === 10 ? topC : top === 13 ? '#ffffff' : dk, 0, -ua * .5, 0); }
    const el = new THREE.Group(); el.position.y = -ua; arm.add(el);
    sph(el, lb * .95, longSl ? slvC : skin, 0, 0, 0);
    if (top === 15) cyl(el, lb * 1.0, lb * 2.0, fa * .9, slvC, 0, -fa * .45, 0); else cyl(el, lb * .94, lb * .86, fa, longSl ? slvC : skin, 0, -fa / 2, 0);
    if (longSl && top !== 15) cyl(el, lb * 1.0, lb * 1.0, fa * .16, cuff, 0, -fa * .92, 0);
    sph(el, lb * 1.22, skin, 0, -fa - lb * .5, 0);
    if (top === 21) { sph(arm, lb * 1.5, '#8f98a3', 0, lb * .25, 0).scale.y = .72; cyl(arm, lb * 1.2, lb * 1.2, ua * .16, '#7d858f', 0, -ua * .55, 0); }
    if (top === 29) { box(arm, lb * .55, ua * .75, .02, '#f4f1ea', 0, -ua * .5, lb * 1.1); box(el, lb * .5, fa * .7, .02, '#f4f1ea', 0, -fa * .5, lb * .98); }
    if (seated) { arm.rotation.x = -.45; el.rotation.x = -.95; }
    arm.userData.rx = arm.rotation.x; ud.arms.push(arm);
  }
  // legs and big rounded shoes. Seated, the legs dangle forward off the seat.
  const tl = legLen * .5, shoeH = H * .05, sl = legLen - tl - shoeH, shortLeg = bot === 2 && !dress;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * Math.max(hi * .5, lb * 1.45), hipY, 0); g.add(leg);
    const wide = bot === 8 && !skirt, slim = bot === 7 && !suit && !skirt, plain = !skirt && !suit, cuffd = bot === 9 && plain, kT = wide ? 1.7 : slim ? 1.36 : 1.55, kK = wide ? 1.6 : slim ? 1.12 : cuffd ? 1.36 : 1.3, kA = wide ? 2.05 : slim ? .92 : bot === 4 && plain ? .96 : cuffd ? 1.24 : 1.05;
    cyl(leg, lb * kT, lb * kK, tl, skirt ? skin : botC, 0, -tl / 2, 0);
    const kn = new THREE.Group(); kn.position.y = -tl; leg.add(kn);
    const lc = skirt || shortLeg ? skin : botC; sph(kn, lb * (kK - .02), lc, 0, 0, 0); cyl(kn, lb * (kK - .04), lb * kA, sl, lc, 0, -sl / 2, 0);
    if (top === 29) { box(leg, lb * .7, tl * .7, .02, '#f4f1ea', 0, -tl * .5, lb * 1.52); box(kn, lb * .6, sl * .7, .02, '#f4f1ea', 0, -sl * .5, lb * 1.22); }
    if (shortLeg) cyl(leg, lb * 1.42, lb * 1.46, tl * .14, shade(botC, .8), 0, -tl * .9, 0);
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
    else {
      const bt = so === 1 || so === 6, pale = new THREE.Color(shoeC).getHSL({}).l > .8, trim = pale ? shade(shoeC, .62) : '#ffffff';
      sph(kn, R, shoeC, 0, fy + shoeH * .12, fz).scale.set(1, .72, 1.55); sph(kn, R, bt ? shade(shoeC, .6) : pale ? '#d6d2ca' : '#ffffff', 0, fy - shoeH * .32, fz).scale.set(1.06, .24, 1.62);
      // laces across the top, and a stripe down each side of a trainer
      if (so !== 6) for (const dz2 of [.15, .45, .75]) box(kn, R * .8, R * .07, R * .13, bt ? shade(shoeC, 1.5) : trim, 0, fy + shoeH * .12 + R * .72 * Math.sqrt(1 - (dz2 / 1.55) ** 2) - R * .02, fz + dz2 * R);
      if (so === 0 || so === 3 || so === 7) for (const e of [-1, 1]) { const st = box(kn, R * .06, R * .22, R * 1.0, trim, e * R * .96, fy + shoeH * .2, fz - R * .1); st.rotation.x = .35; }
      if (so === 6) { cyl(kn, lb * 1.5, lb * 1.36, sl * .62, shoeC, 0, -sl * .7, 0); cyl(kn, lb * 1.58, lb * 1.58, sl * .08, shade(shoeC, 1.35), 0, -sl * .4, 0); }
      else if (so === 1) { cyl(kn, lb * 1.36, lb * 1.3, sl * .42, shoeC, 0, -sl * .8, 0); cyl(kn, lb * 1.46, lb * 1.46, sl * .1, shade(shoeC, .7), 0, -sl * .62, 0); } else sph(kn, R * .5, pale ? '#d6d2ca' : '#ffffff', 0, fy + shoeH * .3, fz + R * 1.05).scale.set(1.3, .6, .7);
      if (so === 7) for (const wx of [-1, 1]) for (const wz of [-1, 1]) { cyl(kn, R * .36, R * .36, R * .3, '#ff8a2a', wx * R * .62, fy - shoeH * .5, fz + wz * R * .85).rotation.z = PI / 2; sph(kn, R * .14, '#3a3440', wx * R * .78, fy - shoeH * .5, fz + wz * R * .85); }
      if (so === 7) { box(kn, R * 1.1, R * .12, R * 2.4, '#8a8f98', 0, fy - shoeH * .42, fz); sph(kn, R * .26, '#e5543b', 0, fy - shoeH * .2, fz + R * 1.5); }
      if (so === 3) { cyl(kn, lb * 1.32, lb * 1.3, sl * .34, shoeC, 0, -sl * .84, 0); cyl(kn, lb * 1.38, lb * 1.38, sl * .08, trim, 0, -sl * .7, 0); sph(kn, lb * .55, trim, s * lb * 1.3, -sl * .86, 0).scale.x = .3; }
    }
    if (seated) { leg.rotation.x = -PI / 2; kn.rotation.x = .5; }
    else { leg.userData.own = kn.userData.own = true; leg.userData.kn = kn; ud.legs.push(leg); } // standing legs are their own pieces, so they can walk
  }
  if (skirt) {
    const c = dress ? topC : botC, sLen = top === 15 ? 1.7 : dress ? .75 : bot === 6 ? 1.6 : bot === 5 ? .5 : .6, yE = hipY - tl * sLen, rE = hi * (top === 15 ? 1.22 : 1.22 + .28 * Math.min(1, sLen)), kz = Math.max(dz * Math.min(1, wa * 1.25 / hi), lb * 2 / (hi * 1.12));
    if (seated) { sph(g, hi * 1.35, c, 0, hipY + lb * .5, tl * .36).scale.set(1, .32, 1.1); if (sLen > 1) { const dr = cyl(g, hi * 1.15, hi * 1.25, sl * .9, c, 0, hipY - sl * .15, tl * 1.0); dr.scale.z = .5; dr.rotation.x = -.5; } }
    else { lathe(g, [[rE - .02, yE - .004], [rE, yE], [hi * 1.12, hipY + .02 * t], [wa + .006, wy]], c).scale.z = kz; if (bot === 5 && !dress) { lathe(g, [[rE + .008, yE - .002], [rE - .02, yE + .05 * H]], shade(c, 1.4)).scale.z = kz;
        const yM = (yE + hipY) / 2, len = Math.hypot(hipY - yE, rE - hi * 1.12), tilt = Math.atan2(rE - hi * 1.12, hipY - yE); // pleats
        for (let i = 0; i < 12; i++) { const an = (i + .5) / 12 * PI * 2, r = (rE + hi * 1.12) / 2 + .014, f = Math.hypot(Math.sin(an), Math.cos(an) * kz), pl = box(g, .026, len * .9, .02, fold(c), Math.sin(an) * r, yM + .01 * H, Math.cos(an) * r * kz); pl.rotation.order = 'YXZ'; pl.rotation.set(-Math.atan(Math.tan(tilt) * f), Math.atan2(Math.sin(an), Math.cos(an) / kz), 0); } } }
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

  if (nk === 12) { // coffee bean necklace with a tiny cup
    beads(16, .034, null, .05 * H, [COFFEE, '#8a5a3c']); const py = shY - .075 * H, pz = lb * 1.9 * 1.05 + .03;
    cyl(g, .05, .038, .075, '#fffaf0', 0, py, pz); ring(g, .026, .01, '#fffaf0', .058, py, pz); cyl(g, .04, .04, .012, COFFEE, 0, py + .036, pz);
  }
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
  const hat = a.hat, hatKey = hoodC ? 'hood' : hat, hs = a.hair === 13 && (HAT_BRIM[hatKey] != null || hat === 23) ? 8 : a.hair, A = 1.3, hH = new THREE.Group(), hT = new THREE.Group(); hg.add(hH, hT);
  // rings get closer together towards the crown, where the skull curves fastest, so the shell never dips below it
  const shellPts = (ya, yb, off) => { const p = []; for (let j = 0; j <= 14; j++) { const y = ya + (yb - ya) * Math.sin(j / 14 * PI / 2); p.push([hr(Math.min(y, 1)) + off, y]); } if (yb >= 1) p.push([0, 1 + off]); return p; };
  // one sculpted piece per style (hair3d.js), in three tones of the hair colour
  const tieC = '#ff8fab', tones = [hair, shade(hair, .87), shade(hair, .66), mix(hair, '#ffffff', .22)];
  for (const p of hairParts(hs, a.face, hr, seated ? .26 : 0, a.back > 0 || top === 22 || top === 26)) { const o = put(hH, p.geo, p.c === 'tie' ? tieC : hair); if (p.c !== 'tie') o.userData.cs = tones; }
  // facial hair: modelled, so it has the same chunky look as the hair (stubble is painted on the face)
  const fh = a.facial, tash = (curl) => { for (const s of [-1, 1]) {
    const m = sph(hg, .1, hD, s * .075, .252, fz(.075, .252, .012)); m.scale.set(1, .42, .5); m.rotation.set(0, s * .3, -s * .32);
    const tip = sph(hg, .05, hD, s * (curl ? .17 : .15), curl ? .285 : .215, fz(.16, .25, .004)); tip.scale.set(curl ? .8 : 1, curl ? 1 : .75, .55);
  } };
  if (fh === 2 || fh === 3 || fh === 4) tash(false);
  if (fh === 6) tash(true);
  if (fh === 3) sph(hg, .11, hair, 0, .045, fz(0, .08, -.035)).scale.set(1, .95, .6);
  if (fh === 4) put(hg, beardGeo(a.face, .125, .44, .5, 1.05, 1.46, .06, .07, .035), hair);
  if (fh === 5) put(hg, beardGeo(a.face, .075, .44, 1.0, 1.3, 1.46, .03, .012, 0), hair);
  // glasses
  const gl = a.glasses, ex = .18, ey = .4, gz = fz(ex, ey, .035);
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
  // the pulled-up hood of a costume top (only when no hat is worn)
  if (hoodC) {
    const hw2 = WRAP_AT.hood, lip = shade(hoodC, .86);
    part(hT, shellPts(.78, 1, .11), hoodC, 0, hw2 + .02); part(hT, shellPts(.1, 1, .11), hoodC, PI, PI - hw2);
    part(hT, shellPts(.74, .82, .14), lip, 0, hw2 + .06); for (const s of [-1, 1]) part(hT, shellPts(.1, .8, .14).slice(0, 15), lip, s * (hw2 + .03), .07);
    if (top === 23) { eyesOn(.11, 1.1, .3, .22); for (let i = 0; i < 4; i++) { const an = .1 + i * .5, sp = cone(hT, .07, .17, '#3f9a4a', 0, .47 + Math.cos(an) * .7, -Math.sin(an) * .64 - .02); sp.rotation.x = -an; sp.scale.x = .55; } for (let i = 0; i < 6; i++) { const an = (i - 2.5) * .34; cone(hT, .035, .09, '#ffffff', Math.sin(an) * (hr(.76) + .1), .73, Math.cos(an) * (hr(.76) + .1)).rotation.x = PI; } }
    if (top === 24) { const st = cyl(hT, .05, .09, .26, '#8a6a2a', 0, 1.2, -.04); st.rotation.x = -.3; sph(hT, .055, '#5a3a22', 0, 1.33, -.08); }
    if (top === 25) { const tp = cone(hT, .2, .42, hoodC, 0, 1.12, -.2); tp.rotation.x = -.9; }
    if (top === 26) for (const s of [-1, 1]) { cyl(hT, .014, .014, .3, '#2b2228', s * .16, 1.2, .1).rotation.z = -s * .3; sph(hT, .06, '#ffc93c', s * .21, 1.35, .1); }
    if (top === 28) for (const s of [-1, 1]) { sph(hT, .15, hoodC, s * .34, 1.06, 0).scale.z = .6; sph(hT, .09, shade(hoodC, 1.5), s * .34, 1.06, .06).scale.z = .5; }
  }
  const tmpGeo = fitHat(hg, hH, hT, hatKey, hr);

  // ----- turn the loose parts into a few meshes: body, head, two arms, and the painted face -----
  const k = seated ? SIT_K : STAND_K;
  g.scale.setScalar(k); g.position.y = -.76 - (seated ? (hipY - lb * 1.55) * k : 0);
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  const to = paintFace(a, false), tc = paintFace(a, true);
  const faceMat = new THREE.MeshToonMaterial({ map: to, gradientMap: grad });
  const faceGeo = new THREE.LatheGeometry(HP.map(([r, y]) => new THREE.Vector2(r, y)), SEG + 4, -PI, PI * 2);
  const face = new THREE.Mesh(faceGeo, faceMat); face.castShadow = true; face.userData.face = true; hg.add(face);
  root.updateWorldMatrix(true, true);
  // the face joins the head's outline so the whole head gets one clean rim
  const fg = faceGeo.toNonIndexed(); fg.applyMatrix4(new THREE.Matrix4().copy(hp.matrixWorld).invert().multiply(face.matrixWorld));
  merge(hp, mat, [{ pos: fg.attributes.position.array, nor: fg.attributes.normal.array }]); fg.dispose();
  for (const t of tmpGeo) t.dispose();
  for (const arm of ud.arms) merge(arm, mat);
  for (const leg of ud.legs) { merge(leg.userData.kn, mat); merge(leg, mat); }
  merge(g, mat);
  ud.head = hp; ud.tilt = seated ? -.26 : 0; hp.rotation.x = ud.tilt; ud.body = g; ud.k = k; ud.faceMat = faceMat; ud.to = to; ud.tc = tc; ud.mat = mat;
  ud.headH = headH * k; ud.headY = g.position.y + (shY + neckL + .03 * H + headH * .48) * k;
  root.userData = ud;
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
  u.arms.forEach((a, i) => { a.rotation.x += Math.sin(ph + i * Math.PI) * .55 * amt - .12 * amt; });
  u.head.rotation.x -= .07 * amt; u.head.rotation.z *= 1 - amt * .6;
}

export function disposeAvatar(g) {
  const u = g.userData;
  g.traverse(m => { if (m.isMesh && (m.userData.baked || m.userData.face)) m.geometry.dispose(); });
  u.to?.dispose(); u.tc?.dispose(); u.faceMat?.dispose(); u.mat?.dispose();
}

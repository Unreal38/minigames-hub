// 3D chibi avatar (three.js), shared by every 3D minigame and by the round pictures in lists. Purely visual.
// Anime "pocket" chibi in a toon look: big round head with the face painted on, clumpy hair with pointed bangs,
// a small soft body, mitten hands and chunky shoes, flat two-step shading and a dark outline.
//
//   avatar3d(color, av, { pose })  -> THREE.Group facing +Z. pose 'sit' (default): the seat is at y = -0.76 and the
//                           top of the head is about y = 2.1. pose 'stand': the feet are at y = -0.76.
//                           userData = { head, eyes, body, arms, headY, headH } for animation and framing.
//   animateAvatar(g, T, { seed, active, hop, look, nod })  idle sway, blinking, a little arm swing and a squashy hop;
//                           look turns the head (radians), nod dips it (0..1).
//   disposeAvatar(g)     frees its textures, materials and merged geometry.
//   bake(root)           merges a group's static meshes into a few (see below); any 3D game can use it on its props.
import * as THREE from 'three';
import { SKINS, HAIR_COLS, EYE_COLS, BOTTOM_COLS, SHOE_COLS, avObj } from './avatar.js';

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
const OUTLINE = .022;
const lineMat = new THREE.MeshBasicMaterial({ color: '#3a2630', side: THREE.BackSide });
lineMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${OUTLINE};`); };
lineMat.customProgramCacheKey = () => 'avatar-outline';

// Merge every stub mesh under root (not inside a group flagged userData.own) into one coloured mesh plus its outline.
const _m = new THREE.Matrix4(), _i = new THREE.Matrix4(), _c = new THREE.Color();
function merge(root, mat, extra = []) {
  root.updateWorldMatrix(true, true); _i.copy(root.matrixWorld).invert();
  const parts = [], gone = []; let n = 0;
  const walk = o => { for (const ch of o.children) {
    if (ch.userData.own) continue;
    if (ch.isMesh && ch.material === stub) {
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone(); g.applyMatrix4(_m.multiplyMatrices(_i, ch.matrixWorld));
      parts.push([g.attributes.position.array, g.attributes.normal.array, _c.set(ch.userData.c).clone()]); n += g.attributes.position.count; g.dispose(); gone.push(ch);
    } else walk(ch);
  } };
  walk(root);
  for (const m of gone) m.parent.remove(m);
  let ln = n; for (const e of extra) ln += e.pos.length / 3;
  const pos = new Float32Array(ln * 3), nor = new Float32Array(ln * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [p, nn, c] of parts) { pos.set(p, o); nor.set(nn, o); for (let i = 0; i < p.length; i += 3) { col[o + i] = c.r; col[o + i + 1] = c.g; col[o + i + 2] = c.b; } o += p.length; }
  for (const e of extra) { pos.set(e.pos, o); nor.set(e.nor, o); o += e.pos.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.baked = true; root.add(mesh);
  let lg = g;
  if (extra.length) { lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); }
  const line = new THREE.Mesh(lg, lineMat); line.userData.baked = lg !== g; root.add(line);
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
  // facial hair that covers skin
  x.fillStyle = hair;
  if (fh === 1) { const g = x.createLinearGradient(0, V(.3), 0, V(.16)); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, mix(skin, hair, .3)); x.fillStyle = g; x.fillRect(X(-1.9), V(.3), X(1.9) - X(-1.9), H); x.fillStyle = hair; }
  if (fh === 4) {
    x.beginPath(); x.moveTo(X(-1.75), V(.46)); x.quadraticCurveTo(X(-1.2), V(.24), X(-.35), V(.27)); x.lineTo(X(.35), V(.27)); x.quadraticCurveTo(X(1.2), V(.24), X(1.75), V(.46)); x.lineTo(X(1.75), H); x.lineTo(X(-1.75), H); x.fill();
    at(0, .19, () => { x.fillStyle = skin; x.beginPath(); x.ellipse(0, 0, .075, .04, 0, 0, PI * 2); x.fill(); });
  }
  if (fh === 5) { x.strokeStyle = hair; x.lineWidth = 30; x.lineJoin = 'round'; x.beginPath(); x.moveTo(X(-1.6), V(.5)); x.quadraticCurveTo(X(-1.5), V(.1), X(-.5), V(.07)); x.lineTo(X(.5), V(.07)); x.quadraticCurveTo(X(1.5), V(.1), X(1.6), V(.5)); x.stroke(); }
  if (fh === 3) at(0, .085, () => { x.fillStyle = hair; x.beginPath(); x.ellipse(0, 0, .06, .05, 0, 0, PI * 2); x.fill(); });
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
  // moustaches
  if ([2, 3, 4, 6].includes(fh)) at(0, .24, () => {
    x.fillStyle = fh === 4 ? shade(hair, .8) : hair; x.strokeStyle = x.fillStyle;
    for (const s of [-1, 1]) {
      x.beginPath(); x.moveTo(0, .012); x.quadraticCurveTo(s * .05, .03, s * .085, -.012); x.quadraticCurveTo(s * .04, -.012, 0, -.008); x.fill();
      if (fh === 6) { x.lineWidth = .014; x.beginPath(); x.moveTo(s * .075, -.006); x.quadraticCurveTo(s * .12, -.02, s * .115, .03); x.stroke(); }
    }
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

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
const HAT_BRIM = { 1: .72, 2: .76, 3: .88, 9: .8, 10: .86, 11: .87, 13: .9, 14: .93, 16: .82, 17: .72, 19: .76, 20: .64, 21: .86, 22: .92, 26: .87, 27: .62 };
const HAT_TOP = [4, 5, 6, 7, 8, 12, 15, 18, 23, 24, 25, 28], HC = new THREE.Vector3(0, .47, 0), SHELL = 1.12;
// How far from C along the unit direction d you can go and still be inside the skull grown sideways by o, the way
// hair and hat shells are made (shellPts), closed over the crown by a low cone. skullT is the bare skull.
const envT = (hr, d, o) => { let lo = 0, hi = 1.4; for (let i = 0; i < 18; i++) { const t = (lo + hi) / 2, y = HC.y + d.y * t, r = Math.hypot(d.x * t, d.z * t); if (y >= 0 && (y <= 1 ? r <= hr(y) + o : r <= o - (y - 1))) lo = t; else hi = t; } return lo; };
const skullT = (hr, d) => envT(hr, d, 0);
function fitHat(hg, hH, hT, hat, hr) {
  const brim = HAT_BRIM[hat], top = HAT_TOP.includes(hat), made = [];
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
      const oy = q[i + 1]; q[i] = HC.x + d.x * T; q[i + 1] = HC.y + d.y * T; q[i + 2] = HC.z + d.z * T; hit = true; if (under(oy)) hid.push(i, -d.x, -d.y, -d.z);
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
    squash((x, y, z, d) => y < brim - .06 ? Infinity : envT(hr, d, y > brim ? .012 : .012 + (brim - y) / .06 * .25), y => y > brim);
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
  // How much thicker than usual the hair is over the top of the head. Only hair that is big all over (an afro, curls)
  // counts, since a quiff, a bun or spikes are only a small part of it; the hat then moves out by that much, and
  // whatever still sticks up under it is pressed down instead.
  const r = [];
  for (const h of hair) for (let i = 0; i < h.pts.length; i += 3) { v.set(h.pts[i], h.pts[i + 1], h.pts[i + 2]).sub(HC); const L = v.length(); if (L < 1e-4) continue; d.copy(v).divideScalar(L); if (d.y > .5) r.push(L / skullT(hr, d)); }
  const x = r.length ? (r.sort((a, b) => a - b), r[Math.floor(r.length * .7)]) : 0;
  let s = 1;
  for (const p of pieces) s = Math.max(s, 1 + Math.max(0, x - SHELL) * p.sk / p.near);
  s = Math.max(1, Math.min(s, 1.9));
  if (s > 1.02) { hT.scale.setScalar(s); hT.position.copy(HC).multiplyScalar(1 - s); }
  // whatever still pokes up under a piece (spikes, a bun) is pressed down to just under it
  const lifted = s > 1.02 ? s : 1;
  squash((x, y, z, dd) => { for (const p of pieces) if (p.over(dd)) return skullT(hr, dd) * (Math.max(p.near * lifted / p.sk, SHELL) - .02); return Infinity; });
  return made;
}

export function avatar3d(color, avIn, { pose = 'sit' } = {}) {
  const a = avObj(avIn), seated = pose !== 'stand';
  const root = new THREE.Group(), g = new THREE.Group(), ud = { arms: [], eyes: [], dyn: true }; root.add(g);
  const H = 2.4 * [.93, 1, 1.07][a.height], B = BODIES[a.body];
  const topC = /^#[0-9a-f]{6}$/i.test(color) ? color : '#ff8fab';
  const skin = SKINS[a.skin], hair = HAIR_COLS[a.hairC], hD = shade(hair, .8), botC = BOTTOM_COLS[a.botC], shoeC = SHOE_COLS[a.shoeC], gold = '#ffc93c';
  const headH = H / P.N * FSH[a.face].h, legLen = H * P.leg, neckL = H * .008, hipY = legLen, shY = H - headH - neckL;
  const W = P.wide, sh = B.sh * H * W, ch = B.ch * H * W, wa = B.wa * H * W, hi = B.hi * H * W, lb = B.lb * H * P.limb, dz = B.dz + .16;
  const top = a.top, bot = a.bottom, dress = top === 6 || top === 15, skirt = [3, 5, 6].includes(bot) || dress, longSl = [1, 2, 3, 9, 11, 12, 14, 15, 19, 20, 21, 22].includes(top), noSl = top === 5, lowC = dress ? topC : botC;
  const bodyC = top === 10 ? '#ffffff' : top === 19 ? '#24222c' : top === 21 ? '#a8b0ba' : top === 22 ? '#f4f1ea' : topC, slvC = top === 14 || top === 16 ? '#ffffff' : bodyC, dk = shade(topC, .62);

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
  const collar = (c, k = 1) => { ring(g, lb * 1.5 * k, lb * .42, c, 0, shY, 0).rotation.x = PI / 2; };
  const tie = () => { box(g, .05, .26 * t, .02, '#d9584e', 0, chestY - .08 * t, tz(chestY - .1 * t) + .022); box(g, .07, .05, .03, '#b8433c', 0, chestY + .08 * t, tz(chestY + .05 * t) + .024); };
  const bow = (c, y, z, r = .06) => { for (const s of [-1, 1]) { const b = cone(g, r, r * 2, c, s * r, y, z); b.rotation.z = s * PI / 2; b.scale.z = .6; } };
  if (top === 4) for (const k of [.5, .62, .74, .86]) band(y0 + k * t - .022 * t, y0 + k * t + .022 * t, '#ffffff');
  if (top === 3) { band(wy, wy + .08 * t, shade(topC, .82)); collar(shade(topC, .82)); }
  if (top === 1) {
    const hd = ring(g, lb * 1.9, lb * .85, shade(topC, .9), 0, shY + .01 * H, -lb * .8); hd.rotation.x = PI / 2; hd.scale.set(1, .9, 1.1);
    panel(wy + .05 * t, wy + .2 * t, shade(topC, .86), .55);
    for (const s of [-1, 1]) { cyl(g, .012, .012, .14 * t, '#ffffff', s * lb * .8, chestY + .02 * t, front(lb * .8, chestY + .02 * t) + .01); sph(g, .022, '#ffffff', s * lb * .8, chestY - .06 * t, front(lb * .8, chestY - .06 * t) + .014); }
  }
  if (top === 2 || top === 9) {
    panel(wy, y0 + .93 * t, top === 9 ? '#ffffff' : '#f4f1ea', .32); collar(shade(topC, top === 9 ? .8 : 1.2));
    if (top === 2) for (const k of [.55, .72]) sph(g, .026, shade(topC, .7), 0, y0 + k * t, tz(y0 + k * t) + .02);
    if (top === 9 && a.neck === 0) tie();
  }
  if (top === 7) { panel(y0 + .06 * t, wy + .1 * t, '#ffffff', .85, .02); panel(wy + .08 * t, chestY + .08 * t, '#ffffff', .45, .018); band(wy + .04 * t, wy + .1 * t, '#ece8df', .022); }
  if (top === 8) { panel(wy, chestY + .02 * t, botC, .5, .018); for (const s of [-1, 1]) { side(chestY, yT - .02 * t, botC, s * .42, .11, .018); sph(g, .028, gold, s * ch * .38, chestY - .01 * t, front(ch * .38, chestY - .01 * t) + .016); } }
  if (top === 10) { band(chestY + .04 * t, yT - .02 * t, topC, .016); band(chestY + .04 * t, chestY + .075 * t, '#ffffff', .02); if (a.neck === 0) { bow('#e5543b', chestY + .02 * t, tz(chestY) + .035, .065); sph(g, .032, '#b8433c', 0, chestY + .02 * t, tz(chestY) + .045); } }
  if (top === 11) { panel(wy, y0 + .93 * t, '#fff8ec', .26); band(wy, wy + .06 * t, shade(topC, .84)); for (const s of [-1, 1]) { side(wy + .09 * t, wy + .2 * t, shade(topC, .84), s * .75, .22, .012); sph(g, .022, shade(topC, .6), s * wa * .28, wy + .3 * t, tz(wy + .3 * t) * .96 + .01); } }
  if (top === 12) { cyl(g, lb * 1.32, lb * 1.45, .07 * H, topC, 0, shY + .02 * H, 0); ring(g, lb * 1.36, lb * .3, shade(topC, .85), 0, shY + .05 * H, 0).rotation.x = PI / 2; }
  if (top === 13) { collar('#ffffff'); panel(chestY - .02 * t, yT - .03 * t, '#ffffff', .1); for (const k of [.76, .86]) sph(g, .018, dk, 0, y0 + k * t, tz(y0 + k * t) + .012); }
  if (top === 14) { band(wy, wy + .07 * t, dk); collar(dk); side(chestY - .08 * t, chestY + .08 * t, '#ffffff', .5, .17); }
  if (top === 15) { for (const s of [-1, 1]) side(chestY - .1 * t, yT - .02 * t, '#ffffff', s * .24, .1, .016); band(wy - .03 * t, wy + .17 * t, botC, .02); bow(shade(botC, .85), wy + .07 * t, -tz(wy + .07 * t) - .05, .1); }
  if (top === 16) { for (const k of [.52, .66, .8]) band(y0 + k * t - .012 * t, y0 + k * t + .012 * t, dk, .016); collar(topC, 1.15); panel(wy, y0 + .95 * t, dk, .035, .016); }
  if (top === 17) { for (const s of [-1, 1]) side(wy, y0 + .84 * t, '#ffffff', s * PI / 2, .2); collar('#ffffff'); panel(chestY - .14 * t, chestY + .06 * t, '#ffffff', .16); }
  // a cape lies on the back from the shoulders down (to the waist over a skirt, which would poke through it)
  const cape = c => { side(skirt ? wy + .02 * t : y0 + .08 * t, yT, c, PI, 1.2, .03); collar(c, 1.1); };
  if (top === 18) { collar(shade(topC, .8)); [[-.6, .3], [.5, .4], [-.2, .62], [.62, .78], [-.55, .82], [.15, .2], [.3, .58]].forEach(([fx, fy], i) => { const y = y0 + fy * t, xx = fx * rAt(TP, y); sph(g, .034, i % 2 ? '#ffffff' : '#ffd23f', xx, y, front(xx, y)); }); }
  if (top === 19) { panel(wy, y0 + .93 * t, '#ffffff', .28); collar('#24222c'); for (const k of [.5, .62]) sph(g, .02, '#24222c', 0, y0 + k * t, tz(y0 + k * t) + .016); if (a.neck === 0) bow('#17100d', chestY + .16 * t, tz(chestY + .16 * t) + .03, .05); }
  if (top === 20) { band(wy - .02 * t, wy + .06 * t, gold, .016); const d = cyl(g, .1, .1, .02, gold, 0, chestY, tz(chestY) + .012); d.rotation.x = PI / 2; const d2 = cyl(g, .06, .06, .02, shade(topC, .55), 0, chestY, tz(chestY) + .022); d2.rotation.x = PI / 2; if (a.neck === 0) cape(shade(topC, .6)); }
  if (top === 21) { for (const k of [.3, .5, .7]) band(y0 + k * t - .015 * t, y0 + k * t + .015 * t, '#7d858f', .014); collar(gold, 1.2); box(g, .045, .3 * t, .02, '#d9342b', 0, chestY - .02 * t, tz(chestY) + .015); box(g, .16, .045, .02, '#d9342b', 0, chestY + .04 * t, tz(chestY) + .015); }
  if (top === 22) { band(wy - .02 * t, wy + .05 * t, topC, .016); panel(chestY - .1 * t, chestY + .08 * t, '#c9ccd2', .3, .016); ['#e5543b', '#4f9df0', '#ffd23f'].forEach((c, i) => sph(g, .02, c, (i - 1) * .05, chestY, tz(chestY) + .03)); ring(g, lb * 2.1, lb * .5, '#c9ccd2', 0, shY + .01 * H, 0).rotation.x = PI / 2; }
  if ((bot === 0 || bot === 1 || bot === 8) && !dress) band(wy - .035 * t, wy + .012 * t, shade(botC, .7), .01);

  // arms: stubby, with mitten hands. Each arm is its own piece so it can swing.
  const ua = H * .168 * P.arm, fa = H * .15 * P.arm, shX = sh * .86, reach = Math.max(.12, Math.asin(Math.min(.7, Math.max(0, (hi + lb * 1.3 - shX) / (ua + fa)))));
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.userData.own = true; arm.position.set(s * shX, shY - lb * 1.05, 0); arm.rotation.z = s * reach; g.add(arm);
    const slC = noSl ? skin : slvC, cuff = top === 9 || top === 2 ? '#ffffff' : top === 14 ? dk : shade(slvC, .82);
    sph(arm, lb * 1.02, slC, 0, 0, 0); cyl(arm, lb * 1.08, lb * .95, ua, longSl ? slvC : skin, 0, -ua / 2, 0);
    if (!longSl && !noSl) { cyl(arm, lb * 1.28, lb * 1.34, ua * .55, slvC, 0, -ua * .27, 0); if (top === 10 || top === 17 || top === 13) cyl(arm, lb * 1.37, lb * 1.37, ua * .12, top === 10 ? topC : top === 13 ? '#ffffff' : dk, 0, -ua * .5, 0); }
    const el = new THREE.Group(); el.position.y = -ua; arm.add(el);
    sph(el, lb * .95, longSl ? slvC : skin, 0, 0, 0);
    if (top === 15) cyl(el, lb * 1.0, lb * 2.0, fa * .9, slvC, 0, -fa * .45, 0); else cyl(el, lb * .94, lb * .86, fa, longSl ? slvC : skin, 0, -fa / 2, 0);
    if (longSl && top !== 15) cyl(el, lb * 1.0, lb * 1.0, fa * .16, cuff, 0, -fa * .92, 0);
    sph(el, lb * 1.22, skin, 0, -fa - lb * .5, 0);
    if (seated) { arm.rotation.x = -.45; el.rotation.x = -.95; }
    arm.userData.rx = arm.rotation.x; ud.arms.push(arm);
  }
  // legs and big rounded shoes. Seated, the legs dangle forward off the seat.
  const tl = legLen * .5, shoeH = H * .05, sl = legLen - tl - shoeH, shortLeg = bot === 2 && !dress;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * Math.max(hi * .5, lb * 1.45), hipY, 0); g.add(leg);
    const wide = bot === 8 && !skirt;
    cyl(leg, lb * (wide ? 1.7 : 1.55), lb * (wide ? 1.55 : 1.3), tl, skirt ? skin : botC, 0, -tl / 2, 0);
    const kn = new THREE.Group(); kn.position.y = -tl; leg.add(kn);
    const lc = skirt || shortLeg ? skin : botC; sph(kn, lb * (wide ? 1.5 : 1.28), lc, 0, 0, 0); cyl(kn, lb * (wide ? 1.5 : 1.26), lb * (wide ? 1.75 : 1.05), sl, lc, 0, -sl / 2, 0);
    if (shortLeg) cyl(leg, lb * 1.42, lb * 1.46, tl * .14, shade(botC, .8), 0, -tl * .9, 0);
    if (bot === 1 && !skirt) cyl(kn, lb * 1.14, lb * 1.14, sl * .14, shade(botC, 1.3), 0, -sl * .9, 0);
    if (bot === 4 && !skirt) cyl(kn, lb * 1.1, lb * 1.1, sl * .14, '#f4f1ea', 0, -sl * .9, 0);
    const fy = -sl - shoeH * .45, fz = lb * .8, R = lb * 1.5, so = a.shoes;
    if (so === 2) { sph(kn, R * .9, skin, 0, fy + shoeH * .1, fz).scale.set(1, .55, 1.5); sph(kn, R, shoeC, 0, fy - shoeH * .3, fz).scale.set(1.05, .22, 1.6); ring(kn, R * .8, R * .14, shoeC, 0, fy + shoeH * .05, fz + R * .5).scale.y = .6; }
    else if (so === 4) { sph(kn, R, shoeC, 0, fy, fz).scale.set(1, .5, 1.5); sph(kn, R, shade(shoeC, .5), 0, fy - shoeH * .34, fz).scale.set(1.04, .18, 1.55); sph(kn, R * .4, shade(shoeC, 1.4), 0, fy + shoeH * .3, fz + R * .5).scale.set(1.6, .4, .6); }
    else if (so === 5) { sph(kn, R * 1.12, shoeC, 0, fy + shoeH * .1, fz).scale.set(1.05, .8, 1.5); for (const e of [-1, 1]) { const er = sph(kn, R * .3, shoeC, e * R * .4, fy + shoeH * .9, fz + R * .7); er.scale.set(.6, 1.8, .5); er.rotation.x = -.4; } sph(kn, R * .16, '#2a1712', 0, fy + shoeH * .2, fz + R * 1.62); }
    else {
      const bt = so === 1 || so === 6; sph(kn, R, shoeC, 0, fy + shoeH * .12, fz).scale.set(1, .72, 1.55); sph(kn, R, bt ? shade(shoeC, .6) : '#ffffff', 0, fy - shoeH * .32, fz).scale.set(1.06, .24, 1.62);
      if (so === 6) { cyl(kn, lb * 1.5, lb * 1.36, sl * .62, shoeC, 0, -sl * .7, 0); cyl(kn, lb * 1.58, lb * 1.58, sl * .08, shade(shoeC, 1.35), 0, -sl * .4, 0); }
      else if (so === 1) cyl(kn, lb * 1.36, lb * 1.3, sl * .42, shoeC, 0, -sl * .8, 0); else sph(kn, R * .5, '#ffffff', 0, fy + shoeH * .3, fz + R * 1.05).scale.set(1.3, .6, .7);
      if (so === 7) for (const wx of [-1, 1]) for (const wz of [-1, 1]) cyl(kn, R * .26, R * .26, R * .2, '#3a3440', wx * R * .55, fy - shoeH * .62, fz + wz * R * .8).rotation.z = PI / 2;
      if (so === 3) { cyl(kn, lb * 1.32, lb * 1.3, sl * .34, shoeC, 0, -sl * .84, 0); cyl(kn, lb * 1.36, lb * 1.36, sl * .07, '#ffffff', 0, -sl * .7, 0); }
    }
    if (seated) { leg.rotation.x = -PI / 2; kn.rotation.x = .5; }
  }
  if (skirt) {
    const c = dress ? topC : botC, sLen = top === 15 ? 1.7 : dress ? .75 : bot === 6 ? 1.6 : bot === 5 ? .5 : .6, yE = hipY - tl * sLen, rE = hi * (top === 15 ? 1.22 : 1.22 + .28 * Math.min(1, sLen)), kz = Math.max(dz * Math.min(1, wa * 1.25 / hi), lb * 2 / (hi * 1.12));
    if (seated) { sph(g, hi * 1.35, c, 0, hipY + lb * .5, tl * .36).scale.set(1, .32, 1.1); if (sLen > 1) { const dr = cyl(g, hi * 1.15, hi * 1.25, sl * .9, c, 0, hipY - sl * .15, tl * 1.0); dr.scale.z = .5; dr.rotation.x = -.5; } }
    else { lathe(g, [[rE - .02, yE - .004], [rE, yE], [hi * 1.12, hipY + .02 * t], [wa + .006, wy]], c).scale.z = kz; if (bot === 5 && !dress) lathe(g, [[rE + .008, yE - .002], [rE - .02, yE + .05 * H]], shade(c, 1.4)).scale.z = kz; }
  }
  cyl(g, lb * 1.1, lb * 1.3, .07 * H, shade(skin, .9), 0, shY, 0); // neck
  // neck accessories
  const nk = a.neck;
  if (nk === 1) { const sc = ring(g, lb * 1.75, lb * .8, '#fff4e2', 0, shY + .01 * H, 0); sc.rotation.x = PI / 2; sc.scale.z = 1.1; box(g, lb * 1.5, .22 * t, .05, '#fff4e2', lb * 1.2, chestY, front(lb * 1.2, chestY) + .026).rotation.z = -.1; box(g, lb * 1.5, .035 * t, .055, '#e5543b', lb * 1.3, chestY - .08 * t, front(lb * 1.2, chestY) + .028); }
  if (nk === 2) { bow('#e5543b', chestY + .16 * t, tz(chestY + .16 * t) + .03); sph(g, .03, gold, 0, chestY + .16 * t, tz(chestY + .16 * t) + .04); }
  if (nk === 3) { ring(g, lb * 1.7, .012, gold, 0, shY - .005 * H, lb * .3).rotation.x = PI / 2 - .4; sph(g, .035, '#7fd1e8', 0, chestY + .12 * t, tz(chestY + .12 * t) + .02); }
  if (nk === 4 && top !== 9) tie();
  if (nk === 5) { ring(g, lb * 1.7, .016, '#4f9df0', 0, shY - .005 * H, lb * .3).rotation.x = PI / 2 - .4; const md = cyl(g, .075, .075, .022, gold, 0, chestY + .1 * t, tz(chestY + .1 * t) + .025); md.rotation.x = PI / 2; sph(g, .03, '#fff1a8', 0, chestY + .1 * t, tz(chestY + .1 * t) + .035).scale.z = .4; }
  if (nk === 6) cape('#d9342b');
  const beads = (n, r, c, drop, cs) => { for (let i = 0; i < n; i++) { const an = i / n * PI * 2, ff = Math.max(0, Math.cos(an)); sph(g, r, cs ? cs[i % cs.length] : c, Math.sin(an) * lb * 1.9, shY - .005 * H - ff * drop, Math.cos(an) * lb * 1.9 * 1.05); } };
  if (nk === 7) beads(12, .045, null, .05 * H, ['#ff8fab', '#ffd23f', '#ffffff', '#c9b3ff']);
  if (nk === 8) { ring(g, lb * 1.6, lb * .35, '#d9342b', 0, shY + .005 * H, 0).rotation.x = PI / 2; sph(g, .04, gold, 0, shY - .025 * H, lb * 1.75); }
  if (nk === 9) beads(18, .022, '#fbf6ec', .04 * H);
  if (nk === 10) { ring(g, lb * 1.65, lb * .45, '#d9342b', 0, shY + .005 * H, 0).rotation.x = PI / 2; const bd = cone(g, lb * 1.6, .2 * t, '#d9342b', 0, chestY + .12 * t, tz(chestY + .12 * t) + .02); bd.rotation.x = PI; bd.scale.z = .3; for (const k of [-1, 0, 1]) sph(g, .014, '#ffffff', k * lb * .6, chestY + .17 * t, tz(chestY + .17 * t) + .04); }

  // head: modelled 1 unit tall with the chin at 0, inside a pivot at the neck so it can turn and nod
  const hp = new THREE.Group(); hp.userData.own = true; hp.position.y = shY + neckL + .012 * H; g.add(hp); // the flat chin rides a little above the shoulders, so scarves and ties show
  const hg = new THREE.Group(), DZ = .94; hg.scale.set(headH * P.hw, headH, headH * P.hw * DZ); hp.add(hg);
  const hr = y => headR(a.face, y), HP = []; for (let j = 0; j <= 16; j++) { const y = (1 - Math.cos(j * PI / 16)) / 2; HP.push([hr(y), y]); }
  const fz = (x, y, o = 0) => Math.sqrt(Math.max(0, hr(y) * hr(y) - x * x)) + o;
  for (const s of [-1, 1]) sph(hg, .085, skin, s * hr(.4) * .97, .4, -.02).scale.set(.6, 1, .8);
  // hair: a shell over the skull plus chunky clumps and pointed bangs
  // An afro is too big to tuck under a covering hat (or inside a flower crown), so it shows as curls there.
  // Hair goes in hH and the hat in hT, so fitHat() can squash the hair under a hat or lift a small topper onto big hair.
  const hat = a.hat, hs = a.hair === 13 && (HAT_BRIM[hat] != null || hat === 23) ? 8 : a.hair, A = 1.3, hH = new THREE.Group(), hT = new THREE.Group(); hg.add(hH, hT);
  // rings get closer together towards the crown, where the skull curves fastest, so the shell never dips below it
  const shellPts = (ya, yb, off) => { const p = []; for (let j = 0; j <= 14; j++) { const y = ya + (yb - ya) * Math.sin(j / 14 * PI / 2); p.push([hr(Math.min(y, 1)) + off, y]); } if (yb >= 1) p.push([0, 1 + off]); return p; };
  const base = (hf, hb, off = .065, c = hair) => { part(hH, shellPts(hf, 1, off), c, 0, A); part(hH, shellPts(hb, 1, off), c, PI, PI - A); };
  const bangs = (nb = 5, len = .26, skew = 0, spread = 1.2) => {
    for (let i = 0; i < nb; i++) {
      const f = nb > 1 ? i / (nb - 1) - .5 : 0, pv = new THREE.Group(); pv.rotation.y = f * 2 * spread; hH.add(pv);
      const l = len * (1 - Math.abs(f) * .25) * (i % 2 ? .86 : 1), c = cone(pv, spread / nb * .62 + .05, l, i % 2 ? hD : hair, 0, .8 - l * .5, hr(.7) + .035); c.rotation.set(PI + .16, 0, skew); c.scale.z = .42;
    }
  };
  const clump = (r, x, y, z, sx = 1, sy = 1, sz = 1, c = hair) => { const o = sph(hH, r, c, x, y, z); o.scale.set(sx, sy, sz); return o; };
  const tail = (r, l, x, y, z, rx = 0, rz = 0, c = hair) => { const o = cone(hH, r, l, c, x, y, z); o.rotation.set(PI + rx, 0, rz); return o; };
  const tieC = '#ff8fab';
  if (hs === 0) { base(.74, .42); bangs(5, .24); clump(.2, 0, 1.1, -.16); }
  if (hs === 1) { base(.74, .46); bangs(4, .2, .3); }
  if (hs === 2) { base(.74, .42); bangs(5, .26); for (const s of [-1, 1]) { clump(.15, s * .52, .74, -.1); tail(.17, .7, s * .64, .34, -.12, 0, s * .28, hD); box(hH, .07, .07, .07, tieC, s * .47, .82, -.08); } }
  if (hs === 3) { base(.76, .46); for (let i = 0; i < 9; i++) { const an = i / 9 * PI * 2, c = cone(hH, .17, .4, i % 2 ? hD : hair, Math.sin(an) * .3, 1.0, Math.cos(an) * .27 - .06); c.rotation.set(Math.cos(an) * .75, 0, -Math.sin(an) * .75); } cone(hH, .17, .4, hair, 0, 1.14, -.06); bangs(5, .3, 0, 1.25); }
  if (hs === 4) { base(.74, .36); part(hH, [[.57, .55], [.6, .1], [.56, -.4], [.44, -.72], [.3, -.74]], hD, PI, 1.9); bangs(6, .3); for (const s of [-1, 1]) tail(.12, .62, s * .5, .32, .14, 0, s * .1); }
  if (hs === 6) { base(.74, .1, .085); bangs(6, .28); }
  if (hs === 7) { base(.76, .42); bangs(5, .24, -.2); clump(.14, 0, .84, -.56); box(hH, .1, .08, .1, tieC, 0, .86, -.5); tail(.18, .8, 0, .42, -.72, -.25, 0, hD); }
  if (hs === 8) { base(.78, .4); for (let i = 0; i < 22; i++) { const an = i * 2.4, e = .3 + (i % 5) * .3; clump(.16, Math.sin(an) * Math.sin(e) * .5, .58 + Math.cos(e) * .5, Math.cos(an) * Math.sin(e) * .48 - .04, 1, 1, 1, i % 3 ? hair : hD); } for (let i = 0; i < 4; i++) clump(.1, (i - 1.5) * .17, .76, hr(.76) - .02, 1, 1, .6, i % 2 ? hD : hair); }
  if (hs === 9) { base(.86, .6, .016, hD); for (let i = 0; i < 6; i++) { const o = cone(hH, .12, .36 + Math.sin((i + .5) / 6 * PI) * .14, i % 2 ? hD : hair, 0, 1.12 + Math.sin((i + .5) / 6 * PI) * .04, .34 - i * .15); o.rotation.x = .5 - i * .22; o.scale.x = .6; } }
  if (hs === 10) base(.8, .5, .02);
  if (hs === 11) { base(.74, .44); bangs(5, .3, .55, 1.15); clump(.2, -.36, .9, .1, 1, .6, 1.2, hD); }
  if (hs === 12) { base(.8, .46); clump(.26, 0, 1.02, .26, 1.2, .8, 1); cone(hH, .2, .4, hD, 0, 1.1, .38).rotation.x = -1.0; }
  if (hs === 13) { base(.76, .4); clump(.66, 0, .93, -.1, 1.02, .86, .98); for (let i = 0; i < 5; i++) clump(.13, (i - 2) * .17, .8 - Math.abs(i - 2) * .03, hr(.8) - .03, 1, 1, .6, i % 2 ? hD : hair); } // sits high, so it never hangs over the face
  if (hs === 14) { base(.76, .42); bangs(5, .26); for (const s of [-1, 1]) { for (let i = 0; i < 5; i++) clump(.085, s * .5, .36 - i * .15, .1 + i * .015, 1, 1, 1, i % 2 ? hD : hair); box(hH, .06, .06, .06, tieC, s * .5, -.4, .17); } }
  if (hs === 15) { base(.74, .2, .08); bangs(5, .28, .15); for (const s of [-1, 1]) { clump(.2, s * .5, .12, -.06, .8, 1.2, 1, hD); clump(.18, s * .52, -.14, -.02, .8, 1.1, 1); } clump(.36, 0, -.02, -.36, 1.3, 1, .6, hD); }
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
      else { const h1 = lens('gh1', heartG(.13), '#ff5d8f', s * ex); h1.rotation.z = PI; const h2 = lens('gh2', heartG(.085), '#c2185b', s * ex, .006); h2.rotation.z = PI; }
      arm(s, gl === 4 ? .15 : .13, '#4a2f2a');
    }
    box(hg, .07, .014, .014, gl === 4 ? '#ffc93c' : '#ff5d8f', 0, ey + .01, fz(0, ey, .02));
  }
  if (gl === 6) { ring(hg, .1, .014, gold, ex, ey, gz).rotation.y = .36; path([[.08, -.07], [.1, -.15], [.15, -.21], [.22, -.24]].map(([dx, dy]) => new THREE.Vector3(ex + dx, ey + dy, fz(ex + dx, ey + dy, .014))), .009, gold); }
  if (gl === 7) { lens('dk', () => new THREE.CircleGeometry(.105, 18), '#17100d', -ex).scale.y = .86; strap('#17100d'); }
  if (gl === 8) { for (const s of [-1, 1]) { ring(hg, .1, .035, '#8a5a3c', s * ex, ey, gz).rotation.y = s * .36; lens('dk', () => new THREE.CircleGeometry(.105, 18), '#7fd1e8', s * ex, -.005); } strap('#5a3a22'); }
  if (gl >= 1 && gl <= 3) {
    const dark = a.glasses === 3, fr = dark ? '#17100d' : '#4a2f2a', rr = .105;
    for (const s of [-1, 1]) {
      const rg = ring(hg, rr, .012, fr, s * ex, ey, gz); rg.rotation.y = s * .36; rg.scale.y = a.glasses === 2 ? 1 : .86;
      if (dark) { const d = put(hg, G('dk', () => new THREE.CircleGeometry(rr, 18)), '#17100d', s * ex, ey, gz); d.rotation.y = s * .36; d.scale.y = .86; }
      arm(s, rr, fr);
    }
    box(hg, .07, .014, .014, fr, 0, ey + .01, fz(0, ey, .02));
  }
  // hats
  if (hat === 1) { lathe(hT, shellPts(.7, 1, .1), topC); lathe(hT, shellPts(.63, .76, .125), shade(topC, .8)); sph(hT, .1, '#ffffff', 0, 1.2, 0); }
  if (hat === 2) { lathe(hT, shellPts(.74, 1, .09), topC); const br = cyl(hT, .34, .34, .03, shade(topC, .8), 0, .76, .44); br.scale.set(1, 1, .9); br.rotation.x = .14; sph(hT, .04, shade(topC, .8), 0, 1.1, 0); }
  if (hat === 3) { cyl(hT, .37, .35, .28, '#ffffff', 0, 1.02, -.02); for (let i = 0; i < 5; i++) { const an = i / 5 * PI * 2; sph(hT, .24, i % 2 ? '#ffffff' : '#ece8df', Math.sin(an) * .24, 1.28, Math.cos(an) * .24 - .02); } sph(hT, .26, '#ffffff', 0, 1.38, -.02); }
  if (hat === 4) { cyl(hT, .3, .28, .12, gold, 0, 1.06, -.02); for (let i = 0; i < 6; i++) { const an = i / 6 * PI * 2; cone(hT, .07, .16, gold, Math.sin(an) * .26, 1.19, Math.cos(an) * .26 - .02); sph(hT, .03, i % 2 ? '#e5543b' : '#7ed3b2', Math.sin(an) * .3, 1.06, Math.cos(an) * .3 - .02); } }
  if (hat === 5) for (const s of [-1, 1]) { const e = cone(hT, .16, .32, a.hair === 5 ? topC : hair, s * .3, 1.06, 0); e.rotation.z = -s * .3; e.scale.z = .6; const i2 = cone(hT, .09, .2, '#ffb3c4', s * .3, 1.04, .05); i2.rotation.z = -s * .3; i2.scale.z = .5; }
  if (hat === 6) { ring(hT, .6, .035, '#2b2b2b', 0, .46, 0, PI); for (const s of [-1, 1]) cyl(hT, .16, .16, .12, topC, s * .6, .44, 0).rotation.z = PI / 2; }
  if (hat === 7) { for (let i = 0; i < 5; i++) { const an = i / 5 * PI * 2; sph(hT, .065, '#ff8fab', .4 + Math.cos(an) * .08, .82 + Math.sin(an) * .08, .3); } sph(hT, .05, gold, .4, .82, .33); }
  if (hat === 8) { for (const s of [-1, 1]) { const b = cone(hT, .17, .3, '#ff5d8f', s * .17, 1.08, .05); b.rotation.z = s * PI / 2; b.scale.z = .6; } sph(hT, .07, '#ff8fab', 0, 1.08, .06); }
  if (hat === 9) { cyl(hT, .38, .5, .3, topC, 0, .96, -.02); cyl(hT, .7, .76, .04, shade(topC, .82), 0, .8, -.02); }
  if (hat === 10) { const b = sph(hT, .42, topC, .07, 1.0, -.02); b.scale.set(1.15, .36, 1.1); b.rotation.z = -.22; sph(hT, .03, shade(topC, .7), .1, 1.16, -.02); }
  if (hat === 11) { cyl(hT, .37, .44, .24, '#e8c860', 0, 1.0, -.02); cyl(hT, .8, .82, .035, '#d9b54a', 0, .86, -.02); cyl(hT, .43, .445, .07, topC, 0, .92, -.02); }
  if (hat === 12) for (const s of [-1, 1]) { const e = sph(hT, .1, '#ffffff', s * .2, 1.3, -.02); e.scale.set(1, 3.2, .5); e.rotation.z = -s * .14; const i2 = sph(hT, .06, '#ffb3c4', s * .2, 1.3, .02); i2.scale.set(1, 3.6, .4); i2.rotation.z = -s * .14; }
  if (hat === 14) { cyl(hT, .3, .3, .5, '#2b2730', 0, 1.18, -.02); cyl(hT, .54, .54, .035, '#2b2730', 0, .94, -.02).scale.z = .9; cyl(hT, .305, .305, .09, topC, 0, 1.0, -.02); }
  if (hat === 15) { cone(hT, .26, .6, topC, 0, 1.28, 0); for (const [y, r] of [[1.13, .2], [1.3, .125]]) ring(hT, r, .025, '#ffffff', 0, y, 0).rotation.x = PI / 2; sph(hT, .08, '#ffd23f', 0, 1.6, 0); }
  if (hat === 16) { sph(hT, .45, '#2b2228', 0, 1.0, -.02).scale.set(1.35, .45, 1.0); const br = cyl(hT, .62, .62, .04, '#2b2228', 0, .93, -.02); br.scale.z = .75; sph(hT, .065, '#ffffff', 0, 1.06, .43).scale.z = .4; for (const s of [-1, 1]) box(hT, .1, .018, .02, '#ffffff', 0, .98, .44).rotation.z = s * .6; }
  if (hat === 17) { lathe(hT, shellPts(.72, 1, .1), '#9aa3ad'); lathe(hT, shellPts(.66, .78, .125).slice(0, 9), '#c8a050'); for (const s of [-1, 1]) { const hn = cone(hT, .1, .36, '#f4ecd8', s * .52, 1.08, 0); hn.rotation.z = -s * .55; } }
  if (hat === 18) ring(hT, .3, .035, gold, 0, 1.32, 0).rotation.x = PI / 2;
  if (hat === 19) { lathe(hT, shellPts(.74, 1, .09), topC); const br = cyl(hT, .34, .34, .03, shade(topC, .8), 0, .76, .44); br.scale.set(1, 1, .9); br.rotation.x = .14; cyl(hT, .015, .015, .14, '#555055', 0, 1.15, 0); box(hT, .62, .02, .08, '#e5543b', 0, 1.22, 0).rotation.y = .6; box(hT, .08, .02, .62, '#4f9df0', 0, 1.22, 0).rotation.y = .6; sph(hT, .035, gold, 0, 1.24, 0); }
  if (hat === 20) { sph(hT, .5, '#6cc76a', 0, .92, -.02).scale.set(1.08, .62, 1.02); for (const s of [-1, 1]) { sph(hT, .12, '#ffffff', s * .22, 1.2, .22); sph(hT, .055, '#1a1014', s * .22, 1.22, .33); } }
  if (hat === 21) { cone(hT, .36, .62, '#d9342b', 0, 1.2, -.05).rotation.x = -.35; cyl(hT, .42, .42, .12, '#ffffff', 0, .93, -.02); sph(hT, .09, '#ffffff', 0, 1.49, -.16); }
  if (hat === 22) { cone(hT, .4, .9, '#3b5bb5', 0, 1.4, -.02); cyl(hT, .76, .8, .035, '#2e4a96', 0, .93, -.02); for (const [y, an] of [[1.15, .3], [1.32, -.9], [1.5, .8], [1.06, -.4]]) { const r = .4 * (1 - (y - .95) / .9) + .01; sph(hT, .035, gold, Math.sin(an) * r, y, Math.cos(an) * r - .02); } }
  if (hat === 23) { ring(hT, .44, .02, '#4fa85a', 0, .86, -.02).rotation.x = PI / 2; for (let i = 0; i < 9; i++) { const an = i / 9 * PI * 2; sph(hT, .072, ['#ff8fab', '#ffd23f', '#ffffff', '#c9b3ff'][i % 4], Math.sin(an) * .45, .87, Math.cos(an) * .44 - .02); } }
  if (hat === 24) for (const s of [-1, 1]) cone(hT, .07, .22, '#d9342b', s * .25, 1.06, .1).rotation.z = -s * .35;
  if (hat === 25) for (const s of [-1, 1]) { cyl(hT, .012, .012, .34, '#2b2b2b', s * .16, 1.12, 0).rotation.z = -s * .3; sph(hT, .06, topC, s * .21, 1.28, 0); }
  if (hat === 26) { cyl(hT, .34, .38, .3, '#9a6234', 0, 1.02, -.02); const br = cyl(hT, .82, .82, .035, '#8a5428', 0, .88, -.02); br.scale.z = .85; cyl(hT, .385, .385, .06, '#4a2f2a', 0, .9, -.02); }
  if (hat === 27) { sph(hT, .62, '#e5402f', 0, .92, -.02).scale.set(1, .55, 1); for (const [ph, th] of [[.15, 0], [.6, .5], [.6, 2.6], [.7, 4.4], [.9, 1.5], [.95, 3.5], [.85, 5.6]]) sph(hT, .07, '#ffffff', .62 * Math.sin(ph) * Math.sin(th), .92 + .34 * Math.cos(ph), .62 * Math.sin(ph) * Math.cos(th) - .02).scale.y = .5; }
  if (hat === 28) { const h = cone(hT, .1, .5, '#fff4c8', 0, 1.16, .3); h.rotation.x = .5; for (const [k, r] of [[.0, .09], [.14, .065]]) ring(hT, r, .018, gold, 0, .97 + k * Math.cos(.5), .18 + k * Math.sin(.5)).rotation.x = PI / 2 + .5; }
  if (hat === 13) { cone(hT, .38, .8, '#4b3a6b', 0, 1.36, -.02); cyl(hT, .74, .78, .035, '#3d2f58', 0, .9, -.02); cyl(hT, .345, .375, .07, gold, 0, .98, -.02); }
  const tmpGeo = fitHat(hg, hH, hT, hat, hr);

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

export function disposeAvatar(g) {
  const u = g.userData;
  g.traverse(m => { if (m.isMesh && (m.userData.baked || m.userData.face)) m.geometry.dispose(); });
  u.to?.dispose(); u.tc?.dispose(); u.faceMat?.dispose(); u.mat?.dispose();
}

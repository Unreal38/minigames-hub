// Kart Island Race 3D view (three.js). Draws the track, every kart with its driver's avatar, the item boxes and the
// power-ups, and follows your kart with a chase camera. Your own kart comes from the browser's physics every frame
// (mine()); everyone else comes from the server's stream (snap()), drawn a moment in the past so it moves smoothly.
import * as THREE from 'three';
import { kartPaint } from '../../skins.js';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { toonify, toonMat, skyDome, clouds as cloudSea, island, birds, createFx, shaker, disposeToon, nightScene, hash, STAR, DOT, CONF, HEART } from '../../scenery3d.js';
import { buildTrack, locate, at, headingAt, angDiff, ROAD, SHOULDER, RAIL, KART_R } from './track.js';

const DELAY = 110; // ms behind the newest server update that other karts are drawn
const SKIES = [['#6fbdf2', '#d6f1ff'], ['#f59ac0', '#ffe3c4'], ['#7fc8ff', '#e9f7ff']];
const AV_K = .5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpA = (a, b, t) => a + angDiff(b, a) * t;

// Merges simple shapes into one vertex-coloured geometry. parts: [geometry, colour, [x, y, z], [rx, ry, rz], [sx, sy, sz]]
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function merged(parts) {
  const pos = [], nor = [], col = [];
  for (const [geo, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_m.compose(_v.set(...(p || [0, 0, 0])), _q.setFromEuler(_e.set(...(r || [0, 0, 0]))), _s.set(...(s || [1, 1, 1]))));
    _c.set(color);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) col.push(_c.r, _c.g, _c.b);
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, ...o });

// Quads and boxes into one geometry, for the track itself (one draw call for the whole road and land).
function mesher() {
  const pos = [], col = [], c = new THREE.Color(), A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  const tri = (a, b, d) => { for (const p of [a, b, d]) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); } };
  function quad(a, b, d, e, color, out) {
    c.set(color);
    A.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); B.set(e[0] - a[0], e[1] - a[1], e[2] - a[2]); N.crossVectors(A, B);
    if (N.x * out[0] + N.y * out[1] + N.z * out[2] < 0) { tri(a, e, d); tri(a, d, b); } else { tri(a, b, d); tri(a, d, e); }
  }
  function tri3(a, b, d, color, out) { c.set(color); A.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); B.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]); N.crossVectors(A, B); if (N.x * out[0] + N.y * out[1] + N.z * out[2] < 0) tri(a, d, b); else tri(a, b, d); }
  function box(x, y, z, sx, sy, sz, color, ry = 0, top = color) {
    const cs = Math.cos(ry), sn = Math.sin(ry), P = (px, py, pz) => [x + px * cs + pz * sn, y + py, z - px * sn + pz * cs];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, R = (nx, nz) => [nx * cs + nz * sn, 0, -nx * sn + nz * cs];
    quad(P(-hx, hy, -hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), top, [0, 1, 0]);
    quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, -hy, -hz), color, [0, -1, 0]);
    quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), color, R(0, 1));
    quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), color, R(0, -1));
    quad(P(hx, -hy, -hz), P(hx, -hy, hz), P(hx, hy, hz), P(hx, hy, -hz), color, R(1, 0));
    quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), color, R(-1, 0));
  }
  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); return g;
  }
  return { quad, tri3, box, build };
}

// ---------- the track ----------
function buildTrackMesh(T) {
  const M = mesher(), n = T.n;
  const P = (i, lat, dy = 0) => { i = (i + n) % n; return [T.x[i] - T.tz[i] * lat, T.y[i] + dy, T.z[i] + T.tx[i] * lat]; };
  const edge = i => SHOULDER + .35 + .3 * (Math.sin(i * .37) * .5 + .5) + .25 * hash(i, 3);
  const UP = [0, 1, 0];
  const padAt = i => T.pads.some(p => ((i - p.i + n) % n) < p.len);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, bA = T.br[i], bB = T.br[j];
    const fwd = [T.tx[i], 0, T.tz[i]], lft = [-T.tz[i], 0, T.tx[i]], rgt = [T.tz[i], 0, -T.tx[i]];
    if (bA) { // ----- bridge: planks, beams under, rails with bunting
      const w = RAIL;
      M.quad(P(i, -w), P(i, w), P(j, w), P(j, -w), i % 2 ? '#e0a86e' : '#cf9358', UP);
      M.quad(P(i, -w, -.32), P(i, -w), P(j, -w), P(j, -w, -.32), '#a86a42', rgt);
      M.quad(P(i, w, -.32), P(i, w), P(j, w), P(j, w, -.32), '#a86a42', lft);
      M.quad(P(i, -w, -.32), P(i, w, -.32), P(j, w, -.32), P(j, -w, -.32), '#8a5433', [0, -1, 0]);
      const h = headingAt(T, i);
      if (i % 5 === 0) { const p = P(i, 0, -.5); M.box(p[0], p[1], p[2], w * 2 - .3, .3, .4, '#8a5433', h); }
      for (const sd of [-1, 1]) {
        const lat = sd * (w + .08);
        if (i % 3 === 0) { const p = P(i, lat, .5); M.box(p[0], p[1], p[2], .26, 1.1, .26, '#f7e3c0', h, '#ffd08a'); }
        const a = P(i, lat, 1.02), b = P(j, lat, 1.02), cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2, cy = (a[1] + b[1]) / 2;
        M.box(cx, cy, cz, .16, .12, T.step * 1.05, '#d9955b', h);
        // little bunting flags hanging under the rail
        if (i % 2 === 0) { const f = P(i, lat, .98), g = P(j, lat, .98), m = P(i, lat, .6); m[0] = (f[0] + g[0]) / 2; m[2] = (f[2] + g[2]) / 2; M.tri3(f, g, m, ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff'][(i >> 1) % 4], sd > 0 ? lft : rgt); }
      }
      continue;
    }
    // ----- land: road, curbs, grass shoulders, then the cliff of the floating island
    const pad = padAt(i), road = pad ? (i % 2 ? '#ffb547' : '#ffc96b') : (i >> 2) % 2 ? '#948a9a' : '#8b8192';
    M.quad(P(i, -ROAD), P(i, ROAD), P(j, ROAD), P(j, -ROAD), road, UP);
    if (pad) { // chevrons pointing the way
      const a = P(i, -2.8, .02), b = P(i, 2.8, .02), tip = P(j, 0, .02); if (i % 2 === 0) M.tri3(a, b, tip, '#fff4e2', UP);
    } else if (i % 6 < 3) M.quad(P(i, -.14, .01), P(i, .14, .01), P(j, .14, .01), P(j, -.14, .01), '#fff4e2', UP);
    for (const sd of [-1, 1]) {
      const r0 = ROAD * sd, r1 = (ROAD + .7) * sd, out = sd > 0 ? lft : rgt, cc = (i >> 1) % 2 ? '#e5543b' : '#fff4e2';
      M.quad(P(i, r0, .05), P(i, r1, .05), P(j, r1, .05), P(j, r0, .05), cc, UP);
      M.quad(P(i, r0, 0), P(i, r0, .05), P(j, r0, .05), P(j, r0, 0), cc, sd > 0 ? rgt : lft);
      const eI = edge(i) * sd, eJ = edge(j) * sd;
      const g1 = hash(i * 3 + (sd > 0 ? 1 : 0), 7) < .25 ? '#7fbf56' : '#8bca60';
      M.quad(P(i, r1), P(i, eI), P(j, eJ), P(j, r1), g1, UP);
      M.quad(P(i, eI), P(i, eI * .97, -1.3), P(j, eJ * .97, -1.3), P(j, eJ), (i >> 1) % 3 ? '#c98a5a' : '#b97c4f', out);
      const dI = -4.5 - 2.5 * hash(i, 11), dJ = -4.5 - 2.5 * hash(j, 11);
      M.quad(P(i, eI * .97, -1.3), P(i, eI * .4, dI), P(j, eJ * .4, dJ), P(j, eJ * .97, -1.3), (i >> 2) % 2 ? '#857a72' : '#7a706a', [out[0], -.6, out[2]]);
    }
    M.quad(P(i, -edge(i) * .4, -4.5 - 2.5 * hash(i, 11)), P(i, edge(i) * .4, -4.5 - 2.5 * hash(i, 11)), P(j, edge(j) * .4, -4.5 - 2.5 * hash(j, 11)), P(j, -edge(j) * .4, -4.5 - 2.5 * hash(j, 11)), '#6d645f', [0, -1, 0]);
    // the land ends where a bridge starts: close it off with a cliff face
    for (const [k, nb, dir] of [[i, T.br[(i - 1 + n) % n], -1], [j, bB, 1]]) {
      if (!nb || (dir === 1 && k !== j)) continue;
      const e = edge(k), d = -4.5 - 2.5 * hash(k, 11), o = [fwd[0] * dir, 0, fwd[2] * dir];
      const ring = [P(k, -e), P(k, e), P(k, e * .97, -1.3), P(k, e * .4, d), P(k, -e * .4, d), P(k, -e * .97, -1.3)];
      for (let q = 1; q < ring.length - 1; q++) M.tri3(ring[0], ring[q], ring[q + 1], q < 2 ? '#c98a5a' : '#857a72', o);
    }
  }
  // start line: a chequered strip and a balloon arch
  const h0 = headingAt(T, 0);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) {
    const lat = -ROAD + (c + .5) * ROAD * .2, p = P(0, lat, .03), f = (r - .5) * .5;
    M.box(p[0] + T.tx[0] * f, p[1], p[2] + T.tz[0] * f, ROAD * .2, .02, .5, (r + c) % 2 ? '#3b2219' : '#fff4e2', h0);
  }
  for (const sd of [-1, 1]) { const p = P(0, sd * (ROAD + 1.1), 2.2); M.box(p[0], p[1], p[2], .5, 4.4, .5, '#fff4e2', h0, '#ffb547'); }
  for (let c = 0; c < 12; c++) for (let r = 0; r < 2; r++) {
    const lat = -(ROAD + 1.1) + (c + .5) * (ROAD + 1.1) * 2 / 12, p = P(0, lat, 4.1 + r * .42);
    M.box(p[0], p[1], p[2], (ROAD + 1.1) * 2 / 12, .42, .3, (r + c) % 2 ? '#3b2219' : '#fff4e2', h0);
  }
  return M.build();
}

// grass tufts and flowers on the shoulders, and floating islands round about
function buildDeco(T, sky) {
  const grp = new THREE.Group(), parts = [], n = T.n;
  const tuft = new THREE.ConeGeometry(.16, .4, 4), petal = new THREE.IcosahedronGeometry(.11, 0), bush = new THREE.IcosahedronGeometry(.42, 0);
  for (let i = 0; i < n; i += 2) {
    if (T.br[i]) continue;
    for (const sd of [-1, 1]) {
      if (hash(i, sd + 20) > .55) continue;
      const lat = sd * (ROAD + 1.4 + hash(i, sd + 21) * (SHOULDER - ROAD - 1.4)), p = at(T, i, lat), r = hash(i, sd + 22);
      if (r < .45) parts.push([tuft, '#5fb04a', [p.x, p.y + .18, p.z]]);
      else if (r < .85) { const cc = ['#ffffff', '#ff9fb8', '#fff1a8', '#d9c8ff'][i % 4]; parts.push([petal, cc, [p.x, p.y + .1, p.z], [0, 0, 0], [1, .5, 1]]); parts.push([tuft, '#6cbf4f', [p.x + .2, p.y + .15, p.z]]); }
      else if (Math.abs(lat) > SHOULDER - 1.2) parts.push([bush, i % 3 ? '#5fb04a' : '#86cc5a', [p.x, p.y + .25, p.z], [0, i, 0], [1, .8, 1]]);
    }
  }
  const tufts = new THREE.Mesh(merged(parts), toonMat(vmat())); tufts.userData.noInk = true; grp.add(tufts);
  // islands: spots away from the road, below it, with trees and lamps
  const spots = [];
  for (let i = 0; i < n; i += 9) {
    for (const sd of [-1, 1]) {
      const dist = 24 + hash(i, sd + 40) * 36, p = at(T, i, sd * dist), size = 6 + hash(i, sd + 41) * 11;
      let ok = true;
      for (let k = 0; k < n && ok; k += 2) if (Math.hypot(T.x[k] - p.x, T.z[k] - p.z) < size + SHOULDER + 7) ok = false;
      for (const q of spots) if (Math.hypot(q.x - p.x, q.z - p.z) < q.size + size + 6) ok = false;
      if (ok) spots.push({ x: p.x, z: p.z, y: p.y - 4 - hash(i, sd + 42) * 9, size, i });
    }
  }
  spots.sort((a, b) => hash(a.i, 5) - hash(b.i, 5));
  for (const s of spots.slice(0, 13)) {
    const isl = island(s.size, s.size * (.7 + hash(s.i, 6) * .5), { round: hash(s.i, 7) < .5, seed: s.i + 3, props: 8 + (s.size | 0), flowers: 20, size: 1.4, grass: sky === 1 ? '#9fd36a' : '#8bca60' });
    isl.position.set(s.x, s.y, s.z); isl.rotation.y = hash(s.i, 8) * 6.28; isl.userData.bob = hash(s.i, 9) * 6.28; grp.add(isl);
  }
  return grp;
}

// ---------- karts ----------
const WHEEL = new THREE.CylinderGeometry(.33, .33, .3, 10).rotateZ(Math.PI / 2);
const HUB = new THREE.CylinderGeometry(.14, .14, .32, 8).rotateZ(Math.PI / 2);
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
export function makeKart(color, av, paintK = 0) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = kartPaint(paintK), bc = paint.body || color; // kart paint from the shop (skins.js); the driver keeps their own colour
  const B = new THREE.BoxGeometry(1, 1, 1), dk = shade(bc, .7), cream = '#fff4e2', ink = '#3b2219';
  const chassis = new THREE.Mesh(merged([
    ...paint.parts.map(([c, p, r, sz]) => [B, c, p, r, sz]),
    [B, bc, [0, .42, .05], 0, [1.5, .34, 2.2]],
    [B, dk, [0, .3, 0], 0, [1.6, .14, 2.3]],
    [B, bc, [0, .5, .95], [-.25, 0, 0], [1.2, .26, .7]],
    [B, cream, [0, .3, 1.32], 0, [1.7, .2, .22]],
    [B, cream, [0, .32, -1.16], 0, [1.6, .22, .2]],
    [B, dk, [0, .9, -.62], [.2, 0, 0], [1.0, .75, .16]],
    [B, '#5b4636', [0, .7, -.98], 0, [.9, .42, .42]],
    [new THREE.CylinderGeometry(.08, .1, .36, 6), '#d9dde3', [.32, .72, -1.24], [Math.PI / 2 + .3, 0, 0]],
    [new THREE.CylinderGeometry(.08, .1, .36, 6), '#d9dde3', [-.32, .72, -1.24], [Math.PI / 2 + .3, 0, 0]],
    [new THREE.CylinderGeometry(.05, .05, .5, 5), ink, [0, .78, .62], [-.9, 0, 0]],
    [new THREE.TorusGeometry(.2, .05, 5, 10), ink, [0, .92, .5], [-.7, 0, 0]],
    [B, '#ffd23f', [.48, .52, 1.3], 0, [.22, .12, .06]], [B, '#ffd23f', [-.48, .52, 1.3], 0, [.22, .12, .06]],
  ]), vmat());
  body.add(chassis);
  toonify(body, .035);
  const wm = toonMat(new THREE.MeshStandardMaterial({ color: ink })), hm = toonMat(new THREE.MeshStandardMaterial({ color: cream }));
  const wheels = [[.82, .33, .78], [-.82, .33, .78], [.82, .33, -.8], [-.82, .33, -.8]].map(([x, y, z]) => {
    const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.order = 'YXZ'; /* steer about the upright axis first, then roll */ const t = new THREE.Mesh(WHEEL, wm), h = new THREE.Mesh(HUB, hm); w.add(t, h); body.add(w); return w;
  });
  const driver = avatar3d(color, av, { pose: 'sit' });
  driver.scale.setScalar(AV_K); driver.position.set(0, .62 + .76 * AV_K, -.2); driver.userData.tilt = 0;
  body.add(driver);
  // bubble shield and blob shadow
  const bub = new THREE.Mesh(new THREE.SphereGeometry(1.75, 18, 12), new THREE.MeshBasicMaterial({ color: '#9fe6ff', transparent: true, opacity: .28, depthWrite: false }));
  bub.position.y = .9; bub.visible = false; root.add(bub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, .05, 4, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .6 }));
  ring.rotation.x = Math.PI / 2; bub.add(ring);
  return { root, body, wheels, driver, bub };
}

// banana peel, wobbly jelly and the gift-box item boxes, each one geometry
function peelGeo() {
  const S = new THREE.SphereGeometry(.3, 7, 5);
  return merged([[S, '#ffd23f', [0, .12, 0], 0, [1, .55, 1]], [S, '#ffe36b', [.32, .05, .05], [0, 0, -.5], [1.1, .22, .55]], [S, '#ffe36b', [-.3, .05, .1], [0, 0, .5], [1.1, .22, .55]],
    [S, '#ffd23f', [0, .05, -.33], [.5, 0, 0], [.55, .22, 1.1]], [new THREE.CylinderGeometry(.05, .07, .2, 5), '#6b4a2c', [0, .32, 0]]]);
}
function jellyGeo() {
  return merged([[new THREE.CylinderGeometry(.42, .6, .7, 9), '#ff7ab0', [0, .35, 0]], [new THREE.CylinderGeometry(.44, .44, .12, 9), '#ffb3d1', [0, .72, 0]],
    [new THREE.SphereGeometry(.16, 7, 5), '#e5243b', [0, .9, 0]], [new THREE.CylinderGeometry(.02, .02, .25, 4), '#5b8f3a', [.05, 1.06, 0], [0, 0, -.4]]]);
}

export function createScene(canvas, { onFrame, step } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, .1, 1100);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(-40, 80, 30); scene.add(sun);
  const fx = createFx(scene, { max: 1400 }), shake = shaker(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let T = null, trackKey = '', trackG = null, deco = null, skyM = null, cloudG = null, flyBirds = null;
  let karts = [], seatsKey = '', me = -1, mineK = null, stage = 'count', tGo = 0, watchI = 0;
  const snaps = []; // [{ at, k }] newest last
  let boxesMesh = null, ribbonMesh = null, boxUp = [], boxPop = [];
  const objs = new Map(); const pGeo = peelGeo(), jGeo = jellyGeo(), objMat = toonMat(vmat());
  const shadowGeo = new THREE.CircleGeometry(1.25, 16).rotateX(-Math.PI / 2), shadowMat = new THREE.MeshBasicMaterial({ color: '#2a1422', transparent: true, opacity: .25, depthWrite: false });
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3(); let camInit = false, fovKick = 0, camYaw = 0;
  let baseFov = 62, camBack = 0;
  const live = []; // the last drawn place of every kart (for bumping into them)

  function setTrack(id) {
    if (id === trackKey) return; trackKey = id;
    if (trackG) { scene.remove(trackG); disposeToon(trackG); }
    T = buildTrack(id);
    trackG = new THREE.Group(); scene.add(trackG);
    const road = new THREE.Mesh(buildTrackMesh(T), vmat()); road.userData.noInk = true; trackG.add(road);
    toonify(road, 0);
    deco = buildDeco(T, T.def.sky); trackG.add(deco);
    // sky, cloud sea and birds centred on the track
    let cx = 0, cz = 0; for (let i = 0; i < T.n; i++) { cx += T.x[i]; cz += T.z[i]; } cx /= T.n; cz /= T.n;
    if (skyM) { scene.remove(skyM); skyM.geometry.dispose(); }
    if (cloudG) scene.remove(cloudG);
    const [top, low] = SKIES[T.def.sky] || SKIES[0];
    scene.background = new THREE.Color(low); scene.fog = new THREE.Fog(low, 160, 520);
    skyM = skyDome(scene, top, low, { r: 650 }); skyM.position.set(cx, 0, cz);
    cloudG = cloudSea({ min: 40, max: 270, below: -16, near: 90, far: 20, seed: T.def.sky * 17 }); cloudG.position.set(cx, 0, cz); scene.add(cloudG);
    if (!flyBirds) { const bg = new THREE.Group(); scene.add(bg); bg.position.set(cx, 0, cz); flyBirds = { g: bg, f: birds(bg, 90, 16, 6, 2) }; } else flyBirds.g.position.set(cx, 0, cz);
    scene.userData.dayNight = null; nightScene(scene);
    // item boxes
    if (boxesMesh) { scene.remove(boxesMesh, ribbonMesh); }
    const cnt = T.boxes.length;
    boxesMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), toonMat(new THREE.MeshStandardMaterial({ color: '#ffffff' })), cnt);
    ribbonMesh = new THREE.InstancedMesh(merged([[new THREE.BoxGeometry(1.2, 1.2, .26), '#ffd23f'], [new THREE.BoxGeometry(.26, 1.2, 1.2), '#ffd23f'], [new THREE.TorusGeometry(.2, .07, 4, 8), '#ffd23f', [-.18, .68, 0], [0, 0, .5]], [new THREE.TorusGeometry(.2, .07, 4, 8), '#ffd23f', [.18, .68, 0], [0, 0, -.5]]]), toonMat(vmat()), cnt);
    const pal = ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffb547'];
    for (let b = 0; b < cnt; b++) boxesMesh.setColorAt(b, new THREE.Color(pal[b % 4]));
    boxesMesh.frustumCulled = ribbonMesh.frustumCulled = false;
    scene.add(boxesMesh, ribbonMesh);
    boxUp = T.boxes.map(() => 1); boxPop = T.boxes.map(() => 1);
    camInit = false;
  }

  function setSeats(seats) {
    const key = seats.map(s => s.color + JSON.stringify(s.av) + (s.fl?.kp | 0)).join('|');
    if (key === seatsKey) return; seatsKey = key;
    for (const k of karts) { scene.remove(k.root); scene.remove(k.shadow); disposeAvatar(k.driver); }
    karts = seats.map((s, i) => {
      const K = makeKart(s.color, s.av, s.fl?.kp); K.seed = i * 1.7; K.spinA = 0; K.wheelA = 0; K.trail = 0; K.i = -1;
      K.shadow = new THREE.Mesh(shadowGeo, shadowMat); K.shadow.renderOrder = 1; scene.add(K.shadow);
      scene.add(K.root); return K;
    });
  }

  // a fresh update from the server
  function snap(S) {
    const now = performance.now();
    snaps.push({ at: now, k: S.k });
    while (snaps.length > 2 && now - snaps[1].at > DELAY + 400) snaps.shift();
    stage = S.stage; tGo = now - S.t;
    if (T) {
      S.bx?.forEach((u, b) => { if (u && !boxUp[b]) boxPop[b] = 0; boxUp[b] = u; });
      const seen = new Set();
      for (const [id, kind, x, z, y] of S.obj || []) {
        seen.add(id);
        let o = objs.get(id);
        if (!o) { o = { m: new THREE.Mesh(kind === 'peel' ? pGeo : jGeo, objMat), kind, born: now, tx: x, tz: z, ty: y }; o.m.position.set(x, y, z); o.m.rotation.y = Math.random() * 6; scene.add(o.m); objs.set(id, o); if (kind === 'peel') fx.puff({ x, y: y + .1, z }, { n: 6, color: '#fff1a8', size: .3 }); }
        o.tx = x; o.tz = z; o.ty = y;
      }
      for (const [id, o] of objs) if (!seen.has(id)) { scene.remove(o.m); objs.delete(id); }
    }
    S.sh?.forEach((on, i) => { if (karts[i]) karts[i].bub.visible = !!on; });
  }

  // where kart i is right now: your own from the physics, others from the stream a moment back
  const cur = [];
  function others(now) {
    const t = now - DELAY;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) { if (snaps[i].at <= t) { a = snaps[i]; b = snaps[i + 1] || null; break; } }
    if (!a) { a = snaps[0]; b = null; }
    if (!a) return;
    const u = b ? clamp((t - a.at) / (b.at - a.at || 1), 0, 1) : 0;
    for (let i = 0; i < a.k.length; i++) {
      const p = a.k[i], q = b?.k[i] || p, o = cur[i] ||= {};
      const far = Math.hypot(q[0] - p[0], q[1] - p[1]) > 12; // a respawn: jump, don't glide
      const w = far ? (u > .5 ? 1 : 0) : u;
      o.x = p[0] + (q[0] - p[0]) * w; o.z = p[1] + (q[1] - p[1]) * w; o.y = p[2] + (q[2] - p[2]) * w; o.h = lerpA(p[3], q[3], w); o.v = p[4] + (q[4] - p[4]) * w; o.f = (w < .5 ? p : q)[5];
    }
  }

  function event(e) {
    const K = karts[e.s], p = K ? K.root.position : null;
    if (e.t === 'hit' && p) { fx.burst({ x: p.x, y: p.y + 1.2, z: p.z }, { n: 18, colors: ['#ffd84a', '#fff4e2', '#ff8fab'], speed: 5, up: 4, shape: STAR }); if (e.s === me) shake.kick(.35); }
    else if (e.t === 'pop' && p) fx.burst({ x: p.x, y: p.y + 1, z: p.z }, { n: 22, colors: ['#9fe6ff', '#ffffff'], speed: 6, up: 2, shape: DOT, size: .3 });
    else if (e.t === 'splat') fx.burst({ x: e.x, y: e.y + .5, z: e.z }, { n: 22, colors: ['#ff7ab0', '#ffb3d1', '#e5243b'], speed: 6, up: 5, shape: DOT, size: .35 });
    else if (e.t === 'box' && T) { const B = T.boxes[e.b]; if (B) fx.burst({ x: B.x, y: B.y + 1.2, z: B.z }, { n: 16, colors: ['#ff8fab', '#7ed3b2', '#9aa8ff', '#ffd23f'], speed: 5, up: 4, shape: CONF, size: .3 }); }
    else if (e.t === 'zzz') for (const i of e.hit || []) { const q = karts[i]?.root.position; if (q) fx.burst({ x: q.x, y: q.y + 2.4, z: q.z }, { n: 10, colors: ['#ffffff', '#c9d2ff'], speed: 1.5, up: 1, shape: DOT, size: .9, grav: 0, life: 1.2 }); }
    else if (e.t === 'fin' && p) { fx.confetti({ x: p.x, y: p.y, z: p.z }, { n: e.s === me ? 160 : 50, w: 8, h: 5, s: e.s }); }
    else if (e.t === 'use' && e.k === 'chili' && p) fx.burst({ x: p.x, y: p.y + 1, z: p.z }, { n: 14, colors: ['#ff7a59', '#ffd23f', '#e5543b'], speed: 4, up: 2, shape: DOT, size: .4 });
    else if (e.t === 'use' && e.k === 'bubble' && p) fx.burst({ x: p.x, y: p.y + 1, z: p.z }, { n: 14, colors: ['#9fe6ff', '#ffffff'], speed: 3, up: 2, shape: DOT, size: .3 });
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    // tall phone screens: a wider view from a little further back, so the road ahead still fits
    baseFov = camera.aspect >= 1.1 ? 62 : Math.min(80, 62 + (1.1 - camera.aspect) * 30); camBack = camera.aspect < 1 ? (1 - camera.aspect) * 4 : 0;
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  let T0 = performance.now(), dustT = 0;
  const frames = frameLoop((dt, now) => {
    const time = (now - T0) / 1000;
    step?.(dt);
    if (!T || !karts.length) { renderer.render(scene, camera); return; }
    others(now);
    dustT += dt;
    for (let i = 0; i < karts.length; i++) {
      const K = karts[i], src = i === me && mineK ? mineK : cur[i]; if (!src) continue;
      const mine = i === me && mineK;
      const f = mine ? (mineK.fall > 0 ? 1 : 0) | (mineK.spin > 0 ? 2 : 0) | (mineK.boost > 0 ? 4 : 0) | (mineK.slow > 0 ? 8 : 0) | (mineK.dr > 0 ? 32 : 0) | (mineK.dr < 0 ? 64 : 0) | (mineK.grass ? 128 : 0) | (mineK.ghost > 0 ? 256 : 0) | (mineK.charge > 1.4 ? 512 : mineK.charge > .65 ? 1024 : 0) : src.f | 0;
      K.root.position.set(src.x, src.y, src.z);
      const l = locate(T, src.x, src.z, K.i); K.i = l.i;
      // lean into slopes and corners, spin when hit, wobble in a drift
      const pitch = l.br || Math.abs(l.lat) < SHOULDER ? -Math.atan2(T.y[(l.i + 2) % T.n] - T.y[(l.i - 2 + T.n) % T.n], 4 * T.step) : 0;
      if (f & 2) K.spinA += dt * 14; else K.spinA = K.spinA % (Math.PI * 2) > .1 ? K.spinA + Math.min(dt * 14, Math.PI * 2 - K.spinA % (Math.PI * 2)) : 0;
      const drift = f & 32 ? 1 : f & 64 ? -1 : 0;
      K.root.rotation.set(0, src.h + K.spinA + drift * .38, 0);
      K.body.rotation.x = pitch; K.body.rotation.z = drift * -.08 + Math.sin(time * 30) * (Math.abs(src.v) > 3 ? .008 : 0);
      if (f & 1) { K.body.rotation.x += time * 4; K.body.rotation.z += time * 3; }
      K.wheelA += (src.v || 0) * dt / .33;
      for (let w = 0; w < 4; w++) { K.wheels[w].rotation.x = K.wheelA; if (w < 2) K.wheels[w].rotation.y = mine ? (mineK.steerVis || 0) * .45 : 0; }
      K.root.visible = !(f & 256) || Math.floor(time * 12) % 2 === 0;
      K.bub.visible = K.bub.visible; K.bub.scale.setScalar(1 + Math.sin(time * 4) * .03);
      animateAvatar(K.driver, time, { seed: K.seed, active: Math.abs(src.v) > 4 || !!drift });
      K.driver.userData.head.rotation.x = -.05 + (f & 8 ? .35 : 0); // sleepy: head nods forward
      K.shadow.visible = !(f & 1); K.shadow.position.set(src.x, l.y + .04, src.z);
      live[i] = { x: src.x, z: src.z, y: src.y, f };
      // effects behind the kart
      const bx = src.x - Math.sin(src.h) * 1.3, bz = src.z - Math.cos(src.h) * 1.3, by = src.y + .4;
      if (f & 4 && !reduced) for (let q = 0; q < 2; q++) fx.rise({ x: bx + (Math.random() - .5) * .5, y: by + .3, z: bz }, { color: ['#ffb547', '#ff7a59', '#ffd23f'], size: .45, life: .35, speed: 1.4, wobble: .6 });
      if (drift && (f & (512 | 1024)) && Math.random() < .6) { const cc = f & 512 ? ['#ff9a3c', '#ffd23f'] : ['#7fd1ff', '#ffffff']; for (const sd of [-1, 1]) fx.burst({ x: bx + Math.cos(src.h) * .8 * sd, y: src.y + .15, z: bz - Math.sin(src.h) * .8 * sd }, { n: 1, colors: cc, speed: 2.5, up: 2, size: .2, life: .3, shape: STAR }); }
      if (f & 128 && Math.abs(src.v) > 6 && dustT > .05) fx.puff({ x: bx, y: src.y, z: bz }, { n: 2, color: '#c9e29a', size: .45, speed: 1, life: .5 });
      if (f & 8 && Math.random() < dt * 3) fx.rise({ x: src.x, y: src.y + 2.3, z: src.z }, { color: '#ffffff', size: .5, life: 1.2, speed: .8, shape: DOT });
    }
    if (dustT > .05) dustT = 0;
    // boxes spin and bob; taken ones pop back in when they return
    if (boxesMesh) for (let b = 0; b < T.boxes.length; b++) {
      const B = T.boxes[b]; boxPop[b] = Math.min(1, boxPop[b] + dt * 2.5);
      const s = boxUp[b] ? (boxPop[b] < 1 ? 1 + Math.sin(boxPop[b] * Math.PI) * .25 : 1) * Math.min(1, boxPop[b] * 1.5) : 0;
      _m.compose(_v.set(B.x, B.y + 1.1 + Math.sin(time * 2 + b) * .15, B.z), _q.setFromEuler(_e.set(.3, time * 1.6 + b, .2)), _s.set(s, s, s));
      boxesMesh.setMatrixAt(b, _m); ribbonMesh.setMatrixAt(b, _m);
    }
    if (boxesMesh) { boxesMesh.instanceMatrix.needsUpdate = ribbonMesh.instanceMatrix.needsUpdate = true; }
    for (const o of objs.values()) {
      if (o.kind === 'jelly') { o.m.position.x += (o.tx - o.m.position.x) * Math.min(1, dt * 14); o.m.position.z += (o.tz - o.m.position.z) * Math.min(1, dt * 14); o.m.position.y = o.ty + Math.abs(Math.sin(time * 9)) * .5; const w = Math.sin(time * 18) * .1; o.m.scale.set(1 + w, 1 - w, 1 + w); }
      else { const a = Math.min(1, (now - o.born) / 250); o.m.scale.setScalar(a); }
    }
    deco?.children.forEach(c => { if (c.userData.bob !== undefined) c.position.y += Math.sin(time * .6 + c.userData.bob) * .004; });
    flyBirds?.f(time);
    if (cloudG) cloudG.rotation.y = time * .004;
    // ----- camera -----
    const follow = me >= 0 ? me : watchI;
    const src = follow === me && mineK ? mineK : cur[follow];
    if (src) {
      const falling = src.fall > 0 || (src.f & 1);
      const h = follow === me && mineK ? mineK.h : src.h;
      if (!camInit) { camYaw = h; }
      camYaw = lerpA(camYaw, h, Math.min(1, dt * (stage === 'end' ? .6 : 5)));
      const yaw = stage === 'end' && follow === me ? camYaw + time * .35 : camYaw;
      const back = (stage === 'end' ? 9 : 7.6) + camBack, up = (stage === 'end' ? 4.2 : 3.9) + camBack * .35;
      const gy = falling ? camPos.y - up : src.y;
      let cx = src.x - Math.sin(yaw) * back, cz = src.z - Math.cos(yaw) * back, cy = gy + up;
      // the start: swoop down from high above the grid
      const tc = (now - tGo) / 1000;
      if (stage === 'count' && tc < 0) { const k = clamp(-tc / 3.6, 0, 1), e = k * k; cy += e * 14; cx -= Math.sin(yaw) * e * 10; cz -= Math.cos(yaw) * e * 10; }
      tmp.set(cx, cy, cz);
      if (!camInit) { camPos.copy(tmp); camLook.set(src.x, src.y + 1.2, src.z); camInit = true; }
      camPos.lerp(tmp, Math.min(1, dt * 7));
      if (!falling) camLook.lerp(tmp.set(src.x + Math.sin(h) * 6, src.y + 1.2, src.z + Math.cos(h) * 6), Math.min(1, dt * 10));
      camera.position.copy(camPos); camera.lookAt(camLook);
      const boosting = (follow === me && mineK ? mineK.boost > 0 : src.f & 4);
      fovKick += ((boosting ? 10 : 0) + clamp(Math.abs(src.v || 0) - 15, 0, 12) * .35 - fovKick) * Math.min(1, dt * 4);
      const fov = baseFov + fovKick; if (Math.abs(camera.fov - fov) > .05) { camera.fov = fov; camera.updateProjectionMatrix(); }
      shake.apply(camera, dt);
    }
    fx.update(dt, camera, canvas.clientHeight || innerHeight);
    renderer.render(scene, camera);
    // name tags over the other karts
    if (onFrame) {
      const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight, tags = [];
      for (let i = 0; i < karts.length; i++) {
        const K = karts[i];
        if (i === follow || !K.root.visible) { tags.push({ show: false }); continue; }
        tmp.copy(K.root.position); tmp.y += 2.6; const d = tmp.distanceTo(camera.position); tmp.project(camera);
        tags.push({ show: tmp.z < 1 && d < 70 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1, x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, d });
      }
      onFrame({ tags, follow });
    }
  }, { onSlow: () => res.lower() });

  return {
    setTrack, setSeats, snap, event,
    setMe(i) { me = i; },
    watch(i) { watchI = i; },
    mine(k) { mineK = k; },
    live: () => live,
    track: () => T,
    dispose() {
      frames.stop(); ro.disconnect(); fx.dispose();
      for (const k of karts) disposeAvatar(k.driver);
      if (trackG) disposeToon(trackG);
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

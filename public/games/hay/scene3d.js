// Hay Hunch 3D field (three.js): 25 hay bales on a sky-island meadow, a wooden sign at the end of every row and
// column, and the player's avatar watching from the corner. Flipping a bale tosses it into the air: carrots
// or a napping Pet Farm pet are underneath. Purely visual: it draws what the server says.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, DOT, nightScene, isNight } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { petModel } from '../farm/pets3d.js';
import { N, PET } from './rules.js';

const INK = '#3b2219', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const S = 1.22;                         // distance between bales
const BH = .62;                         // bale height
const FEET = .76;                       // a standing avatar's feet are this far below its middle
export const LINE = ['#ff8fab', '#ffb547', '#7ed3b2', '#8fb0ff', '#d59ae6']; // one colour per row / column, on its sign
const PETS = ['mossbun', 'sproutle', 'petalpuff', 'cindercub', 'toastoad', 'puddlepup', 'ripplet', 'zapkit', 'voltvole', 'pebblet', 'acornip', 'buzzlet'];
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const cx = c => (c - (N - 1) / 2) * S, cz = r => (r - (N - 1) / 2) * S;
const FONT = '700 {px}px Rubik, system-ui, sans-serif';
const font = px => FONT.replace('{px}', px);

// ---------- little canvas pictures ----------
function carrotIcon(g, x, y, k) {
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-.6);
  g.fillStyle = '#5fb04a'; g.strokeStyle = INK; g.lineWidth = 4; g.lineJoin = 'round';
  for (const a of [-.5, 0, .5]) { g.beginPath(); g.ellipse(Math.sin(a) * 9, -26 - Math.cos(a) * 6, 5, 11, a, 0, 7); g.fill(); g.stroke(); }
  g.fillStyle = '#ff8a3c'; g.beginPath(); g.moveTo(-11, -16); g.quadraticCurveTo(0, -24, 11, -16); g.lineTo(2, 26); g.quadraticCurveTo(0, 29, -2, 26); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#c85a1e'; g.lineWidth = 3; for (const yy of [-6, 6]) { g.beginPath(); g.moveTo(-6, yy); g.lineTo(-1, yy + 2); g.stroke(); }
  g.restore();
}
function napIcon(g, x, y, k) { // a sleeping round pet face with a Z
  g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = '#c9b5f0'; g.strokeStyle = INK; g.lineWidth = 4;
  g.beginPath(); g.ellipse(-14, -14, 7, 10, -.4, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.ellipse(14, -14, 7, 10, .4, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 2, 20, 0, 7); g.fill(); g.stroke();
  g.lineWidth = 3.5; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 8, 0, 5, .2, Math.PI - .2); g.stroke(); }
  g.fillStyle = '#ff9fbb'; g.beginPath(); g.arc(0, 9, 3, 0, 7); g.fill();
  g.restore();
}
const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// A sign's face: carrots on top, napping pets below.
function paintSign(cv, sum, pets, col) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff4e2'; roundRect(g, 4, 4, W - 8, H - 8, 26); g.fill();
  g.fillStyle = col; roundRect(g, 4, 4, W - 8, 30, [26, 26, 0, 0]); g.fill();
  g.lineWidth = 8; g.strokeStyle = INK; roundRect(g, 4, 4, W - 8, H - 8, 26); g.stroke();
  g.beginPath(); g.moveTo(14, H * .6); g.lineTo(W - 14, H * .6); g.lineWidth = 4; g.strokeStyle = '#c9a99a'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  if (sum >= 0) {
    carrotIcon(g, 54, 92, 1.05);
    g.font = font(84); g.fillText(String(sum), 160, 96);
    napIcon(g, 56, 200, 1.05);
    g.font = font(74); g.fillStyle = pets ? '#7a4fc9' : INK; g.fillText(String(pets), 160, 202);
  }
}
// A row sign is wide and short, so the five of them stacked up the right side never hide each other.
function paintWide(cv, sum, pets, col) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff4e2'; roundRect(g, 4, 4, W - 8, H - 8, 22); g.fill();
  g.fillStyle = col; roundRect(g, 4, 4, 26, H - 8, [22, 0, 0, 22]); g.fill();
  g.lineWidth = 8; g.strokeStyle = INK; roundRect(g, 4, 4, W - 8, H - 8, 22); g.stroke();
  g.beginPath(); g.moveTo(W * .56, 16); g.lineTo(W * .56, H - 16); g.lineWidth = 4; g.strokeStyle = '#c9a99a'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (sum < 0) return;
  carrotIcon(g, 62, 66, .95); g.fillStyle = INK; g.font = font(80); g.fillText(String(sum), 132, 70);
  napIcon(g, 196, 66, .9); g.fillStyle = pets ? '#7a4fc9' : INK; g.font = font(72); g.fillText(String(pets), 252, 70);
}
// The value tag that stands in front of what was under a bale.
function valueTex(v) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = v === 3 ? '#ffd84a' : v === 2 ? '#ffb547' : '#fff4e2'; g.strokeStyle = INK; g.lineWidth = 9;
  g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(70); g.fillText('×' + v, 64, 70);
  return tex(cv);
}
function zzzTex(text = 'z z', color = '#7a4fc9') {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const g = cv.getContext('2d');
  g.font = font(54); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 12; g.strokeStyle = '#fff4e2'; g.strokeText(text, 64, 50); g.fillStyle = color; g.fillText(text, 64, 50);
  return tex(cv);
}
// Marks the player puts on a bale: a paw for "a pet naps here" and 1 / 2 / 3 for guesses.
function paintMarks(cv, m) {
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
  const on = [m & 1, m & 2, m & 4, m & 8];
  const slots = [[40, 40], [88, 40], [40, 88], [88, 88]];
  slots.forEach(([x, y], k) => {
    if (!on[k]) return;
    g.fillStyle = k === 0 ? '#c9b5f0' : '#fff4e2'; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (k === 0) { for (const [dx, dy, r] of [[-9, -6, 4], [0, -10, 4], [9, -6, 4], [0, 5, 8]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } }
    else { g.font = font(32); g.fillText(String(k), x, y + 2); }
  });
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(5, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 24, max: 90, below: -12 }); scene.add(cloudRing);
  const land = island(N * S + 2.6, N * S + 3.2, { seed: 11, props: 16, size: 1.4, flowers: 60, rim: 3.2 }); land.position.set(.3, -.3, .3); scene.add(land);
  nightScene(scene);
  // a warm lamp so the field stays easy to read at night (only lit then)
  const lamp = new THREE.PointLight('#ffd9a0', 0, 22, 1.4); lamp.position.set(0, 6, 3); scene.add(lamp);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const pfx = createFx(scene), shake = shaker();

  // ---------- the plot: soil under the bales and a little fence ----------
  const plot = new THREE.Group(); scene.add(plot);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = plot) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const PW = N * S + .3;
  put(new THREE.BoxGeometry(PW, .2, PW), M('#b98a56'), 0, -.12, 0).receiveShadow = true;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const p = put(new THREE.BoxGeometry(S - .12, .04, S - .12), M((r + c) % 2 ? '#c99a62' : '#d2a56c'), cx(c), -.01, cz(r)); p.receiveShadow = true; }
  // coloured ribbons from each sign along its row / column, so it is easy to see which sign is which
  for (let k = 0; k < N; k++) {
    put(new THREE.BoxGeometry(PW + .2, .03, .06), M(LINE[k]), .1, .025, cz(k) + S / 2 - .03).receiveShadow = true;
    put(new THREE.BoxGeometry(.06, .03, PW + .2), M(LINE[k]), cx(k) + S / 2 - .03, .025, .1).receiveShadow = true;
  }
  toonify(plot, .03);
  // a few hay scraps lying about
  const scrapGeo = new THREE.BoxGeometry(.3, .02, .04), scrapMat = toonMat(M('#e8c25a'));
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(scrapGeo, scrapMat); const a = i * 2.4, r = PW / 2 + .5 + (i % 5) * .25; m.position.set(Math.cos(a) * r, -.2, Math.sin(a) * r); m.rotation.y = a * 3; scene.add(m); }

  // ---------- signs ----------
  const signs = [];
  const postGeo = new THREE.CylinderGeometry(.06, .07, .9, 6), postMat = toonMat(M('#8a5a3c'));
  const boardGeo = new THREE.BoxGeometry(.94, .94, .08), wideGeo = new THREE.BoxGeometry(1.36, .6, .08);
  function makeSign(x, z, col, lean) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const post = new THREE.Mesh(postGeo, postMat); post.position.y = .3; post.castShadow = true; g.add(post);
    const wide = lean > 1, geo = wide ? wideGeo : boardGeo;
    const cv = document.createElement('canvas'); cv.width = wide ? 288 : 256; cv.height = wide ? 128 : 256; const t = tex(cv);
    const face = new THREE.MeshBasicMaterial({ map: t, transparent: true });
    const board = new THREE.Mesh(geo, [toonMat(M('#a86a42')), toonMat(M('#a86a42')), toonMat(M('#a86a42')), toonMat(M('#a86a42')), face, toonMat(M('#a86a42'))]);
    board.position.y = .92; board.castShadow = true; g.add(board);
    const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })); ink.scale.set(1.06, 1.06, 1.5); board.add(ink);
    const s = { g, board, cv, t, col, key: '', lean, wide }; signs.push(s); if (wide) { board.position.y = .5; post.scale.y = .6; post.position.y = .15; } return s;
  }
  const rowSigns = Array.from({ length: N }, (_, r) => makeSign(cx(N - 1) + S * 1.25, cz(r), LINE[r], 1.1));
  const colSigns = Array.from({ length: N }, (_, c) => makeSign(cx(c), cz(N - 1) + S * 1.08, LINE[c], .9));
  function setSigns(rows, cols) {
    const paint = (s, h) => { const k = h ? h.sum + '/' + h.pets : '-'; if (s.key === k) return; s.key = k; (s.wide ? paintWide : paintSign)(s.cv, h ? h.sum : -1, h ? h.pets : 0, s.col); s.t.needsUpdate = true; s.pop = 1; };
    rowSigns.forEach((s, k) => paint(s, rows?.[k])); colSigns.forEach((s, k) => paint(s, cols?.[k]));
  }
  // The font may still be loading the first time the signs are painted: paint them again once it is here.
  document.fonts?.ready.then(() => { for (const s of signs) s.key = ''; if (state) setSigns(state.rows, state.cols); });

  // ---------- bales ----------
  // A square hay bale: pressed straw in flakes, two strings of twine round it, ragged cut ends and loose stalks.
  // Three slightly different bales, so the field does not look stamped out.
  const BL = .98, BD = .84;               // length (along a row) and depth of a bale
  // one picture per bale: the long sides in the top half, the cut ends in the bottom half (one material, one draw call)
  const paintStraw = (g, w, h, ends, seed) => {
    let z = seed * 9301 + 49297; const rnd = () => (z = (z * 9301 + 49297) % 233280) / 233280;
    g.fillStyle = '#e2b94e'; g.fillRect(0, 0, w, h);
    const golds = ['#f3d777', '#ecc95f', '#d9a93e', '#c89533', '#f7e39a', '#bf8a2c'];
    if (ends) { // the cut end: a jumble of short stalk ends, darker deep inside
      const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * .6); gr.addColorStop(0, '#b9852c'); gr.addColorStop(1, '#e2b94e00'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 520; i++) { const x = rnd() * w, y = rnd() * h, a = rnd() * 6.28, l = 3 + rnd() * 9; g.strokeStyle = golds[rnd() * 6 | 0]; g.lineWidth = 1.2 + rnd() * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    } else { // the long sides: stalks lying along the bale, pressed into flakes with a dark seam between each
      for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h, l = 10 + rnd() * 34, d = (rnd() - .5) * 5; g.strokeStyle = golds[rnd() * 6 | 0]; g.lineWidth = 1 + rnd() * 1.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + d, x + l, y + d * .4); g.stroke(); }
      const flakes = 7;
      for (let k = 1; k < flakes; k++) { const x = k / flakes * w + (rnd() - .5) * 6; g.strokeStyle = '#9c6b22aa'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 8) g.lineTo(x + (rnd() - .5) * 4, y); g.stroke(); g.strokeStyle = '#f7e39a88'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 2.5, 0); g.lineTo(x + 2.5, h); g.stroke(); }
    }
  };
  const strawTex = seed => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d');
    paintStraw(g, 256, 128, false, seed + 1);
    g.save(); g.translate(0, 128); g.beginPath(); g.rect(0, 0, 256, 128); g.clip(); paintStraw(g, 256, 128, true, seed + 7); g.restore();
    return tex(cv);
  };
  // a box with soft, slightly lumpy edges (packed straw is never sharp)
  function baleGeo(seed) {
    const geo = new THREE.BoxGeometry(BL, BH, BD, 8, 4, 6), P = geo.attributes.position, v = new THREE.Vector3();
    const R = .07, hx = BL / 2 - R, hy = BH / 2 - R, hz = BD / 2 - R;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const inner = new THREE.Vector3(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
      const d = v.clone().sub(inner); if (d.lengthSq() > 0) v.copy(inner).add(d.setLength(R));
      const n = Math.sin(v.x * 23 + seed) * Math.cos(v.z * 19 + seed * 2) * Math.sin(v.y * 17 + seed * 3) * .012;
      v.x += n; v.z += n * .8; v.y += (Math.abs(v.y) > hy ? n * .7 : 0);
      P.setXYZ(i, v.x, v.y, v.z);
    }
    geo.translate(0, BH / 2, 0); geo.computeVertexNormals();
    // canvas row 0 is the top of the picture, which three shows at v = 1: sides use v .5..1, cut ends (the x faces) v 0 to .5
    const uv = geo.attributes.uv, idx = geo.index;
    for (const gr of geo.groups) { const ends = gr.materialIndex < 2, seen = new Set(); for (let k = gr.start; k < gr.start + gr.count; k++) { const vi = idx.getX(k); if (seen.has(vi)) continue; seen.add(vi); uv.setY(vi, (ends ? 0 : .5) + uv.getY(vi) * .5); } }
    geo.clearGroups();
    return geo;
  }
  const twineMat = M('#ffffff', { vertexColors: true }), stalkMat = M('#ffffff', { vertexColors: true }), STALK = ['#f3d777', '#e2b94e', '#d9a93e'];
  const stalkGeo = new THREE.BoxGeometry(.2, .018, .022); stalkGeo.translate(.1, 0, 0);
  const baleTpls = [0, 1, 2].map(seed => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(baleGeo(seed), M('#ffffff', { map: strawTex(seed), flatShading: false })); body.castShadow = true; body.receiveShadow = true; g.add(body);
    // Twine and loose stalks are each merged into one mesh, so a bale stays three draw calls.
    const parts = [];
    for (const x of [-.25, .25]) parts.push([new THREE.BoxGeometry(.035, BH + .012, BD + .012), new THREE.Matrix4().makeTranslation(x, BH / 2, 0), '#8a5a2b', 'twine']);
    // loose stalks poking out of the edges and cut ends
    let z = seed * 77 + 5; const rnd = () => (z = (z * 9301 + 49297) % 233280) / 233280;
    const o = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      const onEnd = i < 8, sx = rnd() < .5 ? -1 : 1;
      if (onEnd) { o.position.set(sx * (BL / 2 - .02), .08 + rnd() * (BH - .14), (rnd() - .5) * (BD - .14)); o.rotation.set(0, sx > 0 ? (rnd() - .5) * .9 : Math.PI + (rnd() - .5) * .9, (rnd() - .5) * 1.2); }
      else { o.position.set((rnd() - .5) * (BL - .1), BH - .01, sx * (BD / 2 - .03)); o.rotation.set(0, sx > 0 ? -Math.PI / 2 + (rnd() - .5) * 1.2 : Math.PI / 2 + (rnd() - .5) * 1.2, .25 + rnd() * .5); }
      o.scale.set(.6 + rnd() * .8, 1, 1); o.updateMatrix();
      parts.push([stalkGeo, o.matrix.clone(), STALK[i % 3], 'stalk']);
    }
    for (const kind of ['twine', 'stalk']) {
      const pos = [], col = [], c = new THREE.Color();
      for (const [geo, mx, hex, k] of parts) {
        if (k !== kind) continue;
        const gg = geo.toNonIndexed().applyMatrix4(mx), P = gg.attributes.position; c.set(hex);
        for (let v = 0; v < P.count; v++) { pos.push(P.getX(v), P.getY(v), P.getZ(v)); col.push(c.r, c.g, c.b); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, kind === 'twine' ? twineMat : stalkMat); m.userData.noInk = true; g.add(m);
    }
    return toonify(g, .03);
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: .0, depthWrite: false });
  const cursorGeo = new THREE.RingGeometry(.62, .74, 32); cursorGeo.rotateX(-Math.PI / 2);
  const cursor = new THREE.Mesh(cursorGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: .95, depthWrite: false })); cursor.visible = false; scene.add(cursor);
  const markGeo = new THREE.PlaneGeometry(.72, .72); markGeo.rotateX(-Math.PI / 2);
  const tagGeo = new THREE.PlaneGeometry(.62, .62), valTex = [null, valueTex(1), valueTex(2), valueTex(3)];
  const valMat = valTex.map(t => t && new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  const zzMat = new THREE.SpriteMaterial({ map: zzzTex(), transparent: true, depthWrite: false }), bangMat = new THREE.SpriteMaterial({ map: zzzTex('!', '#e5543b'), transparent: true, depthWrite: false });
  // carrots, shared by every cell
  const carrotGeo = new THREE.ConeGeometry(.12, .56, 7); carrotGeo.rotateX(Math.PI); carrotGeo.translate(0, .21, 0);
  const leafGeo = new THREE.ConeGeometry(.06, .26, 5); leafGeo.translate(0, .1, 0);
  const carrotMat = [toonMat(M('#ff8a3c')), toonMat(M('#ffc93c', { emissive: '#ffb000', emissiveIntensity: .25 }))], leafMat = toonMat(M('#5fb04a'));
  function carrots(v) {
    const g = new THREE.Group();
    for (let k = 0; k < v; k++) {
      const c = new THREE.Group(), a = (k - (v - 1) / 2) * .55;
      const body = new THREE.Mesh(carrotGeo, carrotMat[v === 3 ? 1 : 0]); c.add(body);
      for (const l of [-.4, 0, .4]) { const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.y = .54; lf.rotation.z = l; c.add(lf); }
      c.rotation.z = a; c.position.set(Math.sin(a) * .25, .05, -.12); c.rotation.x = -.35; g.add(c);
    }
    toonify(g, .025);
    const tag = new THREE.Mesh(tagGeo, valMat[v]); tag.position.set(0, .82, -.28); if (v === 1) tag.scale.setScalar(.75); g.add(tag); g.userData.tag = tag;
    return g;
  }

  const cells = Array.from({ length: N * N }, (_, i) => {
    const r = i / N | 0, c = i % N, x = cx(c), z = cz(r);
    const bale = baleTpls[(i * 7 + (i / N | 0)) % 3].clone(true); bale.position.set(x, 0, z); scene.add(bale);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const mt = tex(cv);
    const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ map: mt, transparent: true, depthWrite: false })); mark.position.y = BH + .07; mark.visible = false; bale.add(mark);
    return { i, x, z, bale, mark, mcv: cv, mt, marks: 0, shown: -1, what: null, flipT: -1, under: null, hover: 0, wake: 0 };
  });
  const petCache = new Map();
  function clearUnder(cell) {
    if (!cell.under) return;
    scene.remove(cell.under);
    if (cell.under.userData.pet) petCache.set(cell.under.userData.sp, [...(petCache.get(cell.under.userData.sp) || []), cell.under]);
    cell.under = null;
  }
  function putUnder(cell, v, sp) {
    clearUnder(cell);
    let g;
    if (v === PET) {
      const free = petCache.get(sp); g = free?.pop();
      if (!g) {
        g = new THREE.Group(); const pet = petModel(sp, 1); pet.scale.multiplyScalar(.62); g.add(pet); g.userData.body = pet; g.userData.k = pet.scale.x; g.userData.pet = true; g.userData.sp = sp;
        const zz = new THREE.Sprite(zzMat); zz.scale.set(.6, .45, 1); zz.position.set(.25, 1.05, 0); g.add(zz); g.userData.zz = zz;
        const bang = new THREE.Sprite(bangMat); bang.scale.set(.6, .45, 1); bang.position.set(0, 1.25, 0); bang.visible = false; g.add(bang); g.userData.bang = bang;
      }
      g.userData.bang.visible = false; g.userData.zz.visible = true; g.rotation.y = .3;
    } else g = carrots(v);
    g.position.set(cell.x, 0, cell.z); scene.add(g); cell.under = g;
    return g;
  }

  // ---------- the avatar ----------
  let av = null, avKey = '', avHop = 0, avSad = 0, avLook = new THREE.Vector3(0, 0, 0), avYaw = 0;
  const AV_AT = new THREE.Vector3(cx(0) - S * 1.6, 0, cz(1)), AV_WIDE = AV_AT.clone(), AV_TALL = new THREE.Vector3(cx(0) - S * .2, 0, cz(0) - S * 1.25);
  const avG = new THREE.Group(); avG.position.copy(AV_AT); scene.add(avG);
  function setAvatar(color, a) {
    const k = color + JSON.stringify(a || []); if (k === avKey) return; avKey = k;
    if (av) { avG.remove(av); disposeAvatar(av); }
    av = avatar3d(color, a, { pose: 'stand' }); av.position.y = FEET - .22; avG.add(av);
  }

  // ---------- camera: fits the field between the HUD bars ----------
  let hudTop = 64, hudBottom = 120, cw = 1, ch = 1;
  const DIR_WIDE = new THREE.Vector3(0, 1.6, 1).normalize(), DIR_TALL = new THREE.Vector3(0, 2.3, 1).normalize(), DIR = DIR_WIDE.clone(), camLook = new THREE.Vector3(.35, 0, .55), camBase = new THREE.Vector3();
  // what has to fit on screen: the field, its signs and the avatar (beside the field on wide screens, behind it on phones)
  const boxOf = tall => { const b = []; for (const x of tall ? [cx(0) - S * .75, cx(N - 1) + S * 1.95] : [cx(0) - S * 2.0, cx(N - 1) + S * 1.95]) for (const z of tall ? [cz(0) - S * 1.6, cz(N - 1) + S * 1.75] : [cz(0) - S * .7, cz(N - 1) + S * 1.75]) for (const y of [0, 1.4]) b.push(new THREE.Vector3(x, y, z)); return b; };
  const BOX_WIDE = boxOf(false), BOX_TALL = boxOf(true); let box = BOX_WIDE;
  const pv = new THREE.Vector3();
  function place(D) { camera.position.copy(DIR).multiplyScalar(D).add(camLook); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize() {
    cw = canvas.clientWidth || innerWidth; ch = canvas.clientHeight || innerHeight;
    renderer.setSize(cw, ch, false);
    const portrait = ch > cw * 1.1;
    box = portrait ? BOX_TALL : BOX_WIDE; DIR.copy(portrait ? DIR_TALL : DIR_WIDE); AV_AT.copy(portrait ? AV_TALL : AV_WIDE); avG.position.copy(AV_AT);
    camera.aspect = cw / ch; camera.fov = portrait ? 44 : 34; camera.clearViewOffset(); camera.updateProjectionMatrix();
    // find the closest distance where the whole field fits inside the space left by the HUD
    const avail = Math.max(.3, (ch - hudTop - hudBottom) / ch);
    let lo = 4, hi = 80;
    for (let k = 0; k < 30; k++) {
      const D = (lo + hi) / 2; place(D);
      let y0 = 1, y1 = -1, ok = true;
      for (const p of box) { pv.copy(p).project(camera); if (Math.abs(pv.x) > .96) ok = false; y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y); }
      if (ok && (y1 - y0) / 2 <= avail * .97) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    let y0 = 1, y1 = -1; for (const p of box) { pv.copy(p).project(camera); y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y); }
    // shift the picture so the field sits in the middle of the free space
    const midNdc = (y0 + y1) / 2, wantNdc = 1 - 2 * (hudTop + (ch - hudTop - hudBottom) / 2) / ch;
    camera.setViewOffset(cw, ch, 0, (wantNdc - midNdc) * ch / 2, cw, ch); camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas); resize();

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BH * .6), hit = new THREE.Vector3();
  function pick(x, y) {
    const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const c = Math.round(hit.x / S + (N - 1) / 2), rr = Math.round(hit.z / S + (N - 1) / 2);
    if (c < 0 || rr < 0 || c >= N || rr >= N) return -1;
    return rr * N + c;
  }
  function tileScreen(i, y = BH * .6) {
    const c = cells[i]; if (!c) return null;
    pv.set(c.x, y, c.z).project(camera); const r = canvas.getBoundingClientRect();
    return { x: r.left + (pv.x + 1) / 2 * r.width, y: r.top + (1 - pv.y) / 2 * r.height };
  }

  // ---------- state ----------
  let state = null, fieldId = null, hover = -1, picked = -1;
  const spOf = (id, i) => PETS[(parseInt(id.slice(0, 6), 16) + i * 7) % PETS.length];
  function setState(s) {
    const fresh = s.id !== fieldId;
    if (fresh) { // a new field: every bale drops back in
      fieldId = s.id;
      cells.forEach((c, k) => { clearUnder(c); c.shown = -1; c.flipT = -1; c.wake = 0; c.bale.visible = true; c.bale.position.y = 6 + (k % N) * .4 + (k / N | 0) * .3; c.bale.rotation.set(0, Math.sin(k * 7.3) * .08 + (k * 5 % 3 === 1 ? Math.PI : 0), 0); c.bale.scale.setScalar(1); c.drop = performance.now() + k * 28; });
    }
    state = s;
    setSigns(s.rows, s.cols);
    const t = performance.now(); let n = 0;
    s.cells.forEach((v, i) => {
      const c = cells[i];
      if (v < 0 || c.shown === v) return;
      const mine = s.open[i], late = !mine; // bales the player did not flip open one after another at the end
      c.shown = v; putUnder(c, v, spOf(s.id, i));
      if (fresh && mine) { c.bale.visible = false; c.flipT = -1; return; } // came back to a field already in progress
      c.flipT = t + (late ? 450 + (n++) * 55 : 0); c.late = late;
      if (i === s.wake) c.wake = t;
    });
    if (fresh) cursor.visible = false;
  }
  function setMarks(m) { cells.forEach((c, i) => { const v = m?.[i] | 0; if (v === c.marks) return; c.marks = v; paintMarks(c.mcv, v); c.mt.needsUpdate = true; c.mark.visible = !!v; }); }
  function cheer(big) { avHop = 1; if (big) { pfx.confetti(new THREE.Vector3(0, 1, 0), { n: small ? 60 : 110, w: 7, h: 4, s: 'me' }); } }
  function oops() { avSad = 1; shake.kick(.25); }

  // ---------- the frame loop ----------
  const tv = new THREE.Vector3(); let T = 0;
  function loop(dt, now) {
    T += dt;
    const night = isNight(); lamp.intensity = night ? 18 : 0;
    // bales: drop in, bob when hovered, tumble away when flipped
    for (const c of cells) {
      const b = c.bale;
      if (c.drop) { const u = Math.min(1, Math.max(0, (now - c.drop) / 420)); b.position.y = (1 - u * u) * 6; if (u >= 1) { c.drop = 0; b.position.y = 0; pfx.puff(tv.set(c.x, .02, c.z), { n: 4, color: '#f2d374', size: .25, speed: 1.4 }); } }
      if (c.flipT >= 0 && b.visible) {
        const u = (now - c.flipT) / (c.late ? 380 : 520);
        if (u >= 0) {
          if (!c.burst) { c.burst = true; pfx.burst(tv.set(c.x, .4, c.z), { n: c.late ? 6 : 16, colors: ['#f2d374', '#e8c25a', '#fff1a8'], shape: DOT, speed: 2.6, up: 3.2, size: .16, life: .7 }); if (!c.late && c.shown >= 2) pfx.sparkle(tv.set(c.x, .8, c.z), { n: c.shown === 3 ? 14 : 8, colors: ['#fff1a8', '#ffd84a'], r: .5 }); }
          const e = Math.min(1, u);
          b.position.y = Math.sin(e * Math.PI) * 1.4 + e * .6; b.rotation.x = -e * 2.6; b.rotation.z = e * .8; b.scale.setScalar(1 - e * e);
          if (u >= 1) { b.visible = false; c.burst = false; }
        }
      } else if (b.visible && !c.drop) {
        const want = (c.i === hover || c.i === picked) ? 1 : 0; c.hover += (want - c.hover) * Math.min(1, dt * 14);
        b.position.y = c.hover * .12 + (c.i === picked ? Math.sin(T * 6) * .03 : 0);
      }
      // what is underneath
      const g = c.under; if (!g || b.visible && b.scale.x > .5) continue;
      if (g.userData.pet) {
        const body = g.userData.body, k = g.userData.k;
        if (c.wake) { // startled awake: hops about on the spot
          const w = (now - c.wake) / 1000; g.userData.zz.visible = false; g.userData.bang.visible = w < 3;
          body.position.y = Math.abs(Math.sin(w * 9)) * .35 * Math.max(0, 1 - w / 2.4); g.rotation.y = .3 + Math.sin(w * 5) * .5;
          body.scale.set(k, k, k);
        } else { // napping: slow breathing, curled down a little
          const br = Math.sin(T * 1.6 + c.i) * .03; body.scale.set(k * (1 + br * .5), k * (.82 + br), k * (1 + br * .5)); body.position.y = 0;
          g.userData.zz.position.y = 1 + Math.sin(T * 1.2 + c.i) * .06; g.userData.zz.material.opacity = .75 + Math.sin(T * 1.2 + c.i) * .25;
        }
      } else if (g.userData.tag) { const tg = g.userData.tag; tg.quaternion.copy(camera.quaternion); tg.position.y = .82 + Math.sin(T * 2 + c.i) * .04; }
    }
    // signs bounce when their numbers arrive
    for (const s of signs) { if (s.pop > 0) { s.pop = Math.max(0, s.pop - dt * 2.4); const k = 1 + Math.sin(s.pop * Math.PI) * .12; s.board.scale.set(k, k, 1); } s.board.rotation.x = -s.lean; }
    // the cursor ring on the bale being aimed at
    const aim = picked >= 0 ? picked : hover;
    cursor.visible = aim >= 0 && cells[aim].bale.visible && !state?.over;
    if (cursor.visible) { cursor.position.set(cells[aim].x, .03, cells[aim].z); const k = 1 + Math.sin(T * 6) * .04; cursor.scale.set(k, 1, k); }
    // the avatar looks at what you are aiming at, hops for good finds, droops after waking a pet
    if (av) {
      if (aim >= 0) avLook.set(cells[aim].x, 0, cells[aim].z); else avLook.set(0, 0, 0);
      const want = Math.atan2(avLook.x - AV_AT.x, avLook.z - AV_AT.z); let dr = want - avYaw; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); avYaw += dr * Math.min(1, dt * 6); avG.rotation.y = avYaw;
      avHop = Math.max(0, avHop - dt * 1.4); avSad = Math.max(0, avSad - dt * .5);
      animateAvatar(av, T, { seed: 1, active: aim >= 0, hop: avHop, nod: avSad > 0 ? -Math.min(1, avSad * 3) * .5 : 0 });
      av.position.y = FEET - .22 + Math.sin(Math.min(1, (1 - avHop)) * Math.PI) * (avHop > 0 ? .5 : 0);
    }
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    pfx.update(dt, camera, ch);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .1), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    renderer.render(scene, camera);
    onFrame?.();
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, setMarks, setAvatar, pick, tileScreen, cheer, oops,
    setHover(i) { hover = i; }, setPicked(i) { picked = i; },
    setHud(bottom, top = hudTop) { if (Math.abs(bottom - hudBottom) > 6 || top !== hudTop) { hudBottom = bottom; hudTop = top; resize(); } },
    fps: () => ticker.fps(),
    dispose() {
      ticker.stop(); ro.disconnect(); if (av) disposeAvatar(av);
      pfx.dispose(); for (const s of signs) s.t.dispose(); for (const c of cells) c.mt.dispose(); valTex.forEach(t => t?.dispose());
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

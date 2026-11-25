// Sky Runway 3D (three.js): a catwalk on a sky island. A stage with a red curtain and the round's theme sign at the
// back, a long runway with bulbs down both edges, two spotlights, and stools for the judges along both sides.
// Dressing: your own look turns on the stage. Runway: one look walks down, poses at the end and walks back while the
// others watch from their stools. Reveal and end: the top three on a podium.
// Purely visual: it draws what the server sends. The fitting room, stars and results are the page (client.js).
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, HEART, nightScene, isNight } from '../../scenery3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { L } from '../../i18n.js';
import { themeName, twistName, EMOTE_POSE } from './rules.js';
import { EMOTES } from '../plaza/layout.js';

// A Plaza emote struck as a pose at the front of the runway (a short take on the Plaza's own moves in plaza/scene3d.js).
// q: 0..1 through the pose, T: the clock, u: the avatar's userData. Returns how the whole body moves.
function emotePose(id, q, T, u) {
  let y = 0, ry = 0, bend = 0, lean = 0; const t = q * 2.2;
  const arms = (fn) => u.arms.forEach((a, i) => { a.userData.rz0 ??= a.rotation.z; a.rotation.z = a.userData.rz0; fn(a, i, i ? 1 : -1); });
  const snap = Math.min(1, q / .15) * Math.min(1, (1 - q) / .1);
  switch (id) {
    case 'wave': arms((a, i) => { if (i) { a.rotation.x = -2.75; a.rotation.z += .3 + Math.sin(T * 10) * .32; } }); break;
    case 'dance': y = Math.abs(Math.sin(T * 6.5)) * .16; lean = Math.sin(T * 6.5) * .1; ry = Math.sin(T * 3.25) * .5; arms((a, i) => { a.rotation.x = -2.2 + Math.sin(T * 6.5 + i * Math.PI) * .7; }); break;
    case 'jump': y = Math.abs(Math.sin(q * Math.PI * 2)) * 1; break;
    case 'cheer': case 'stars': y = Math.abs(Math.sin(T * 9)) * .22; arms((a, i, o) => { a.rotation.x = -2.8 + Math.sin(T * 9 + i) * .2; a.rotation.z += o * .25; }); break;
    case 'clap': y = Math.abs(Math.sin(T * 9)) * .05; arms((a, i, o) => { a.rotation.x = -1.35; a.rotation.z -= o * (.38 + .2 * Math.sin(T * 18)); }); break;
    case 'bow': bend = Math.sin(q * Math.PI) * 1.05; arms((a, i, o) => { a.rotation.x = i ? -bend * .9 : .25 * bend; if (i) a.rotation.z -= o * bend * .55; }); break;
    case 'spin': ry = (1 - (1 - q) * (1 - q)) * Math.PI * 4; y = Math.sin(q * Math.PI) * .28; arms((a, i, o) => { a.rotation.z += o * 1.25 * Math.sin(q * Math.PI); }); break;
    case 'laugh': bend = -.2 + Math.sin(T * 13) * .05; y = Math.abs(Math.sin(T * 13)) * .07; arms((a, i, o) => { a.rotation.x = -.75; a.rotation.z -= o * .5; }); break;
    case 'heart': arms((a, i, o) => { if (i) { const k = Math.min(1, q / .45), w = q < .45 ? 0 : Math.min(1, (q - .45) / .2); a.rotation.x = -2.5 * k + w; a.rotation.z -= o * .55 * (1 - w); } }); break;
    case 'shiver': lean = Math.sin(T * 41) * .03; arms((a, i, o) => { a.rotation.x = -1.05; a.rotation.z += -o * .75 + Math.sin(T * 50 + i) * .04; }); break;
    case 'flip': { const w = Math.min(1, q * 1.6); y = Math.sin(w * Math.PI) * 1.45; bend = -w * Math.PI * 2; arms(a => { a.rotation.x = -2.6 * Math.sin(w * Math.PI); }); break; }
    case 'robot': { const st = Math.floor(T * 2.6); ry = ((st % 4) - 1.5) * .28; lean = st % 2 ? .07 : -.07; arms((a, i) => { a.rotation.x = (st + i) % 2 ? -1.55 : -.1; }); break; }
    case 'pose': ry = -.45 * snap; lean = .1 * snap; arms((a, i, o) => { if (i) { a.rotation.x = -2.9 * snap; a.rotation.z += .35 * snap; } else { a.rotation.x = -.45 * snap; a.rotation.z -= o * .95 * snap; } }); break;
    case 'strut': lean = Math.sin(T * 7) * .08; ry = Math.sin(T * 3.5) * .12; arms((a, i, o) => { if (!i) { a.rotation.x = -.45; a.rotation.z -= o * .95; } }); break;
  }
  return { y, ry, bend, lean, walk: id === 'strut' };
}

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff', INK = '#3b2219';
const K = .72, LIFT = .76;            // avatars on a wrapper at this size; a standing avatar's feet are .76 below its middle
const RUN = { z0: -6.6, z1: 5.2, w: 2.3, h: .5 };   // the runway: from the stage to its front end, its width and height
const STAGE = { z: -8.4, w: 7, d: 3.6 };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, flatShading: true, ...o });
// up to seven judges: four on the left, three on the right, facing the runway
const SEATS = [[-3, -5], [3, -4.2], [-3, -3.4], [3, -2.6], [-3, -1.8], [3, -1], [-3, -.2]];
const PODIUM = [[0, 1.1, '#ffc94d'], [-1.9, .75, '#d6dae2'], [1.9, .5, '#e3a35c']]; // 1st, 2nd, 3rd: x, height, colour

function signTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, t, text: '' };
}
function paintSign(s, text, sub) {
  const key = text + '|' + sub; if (s.text === key) return; s.text = key;
  const g = s.c.getContext('2d'); g.clearRect(0, 0, 1024, 256);
  g.fillStyle = '#fff4e2'; g.strokeStyle = INK; g.lineWidth = 14; g.beginPath(); g.roundRect(10, 10, 1004, 236, 60); g.fill(); g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 92; g.font = `700 ${size}px Rubik, system-ui, sans-serif`;
  while (g.measureText(text).width > 920 && size > 40) { size -= 4; g.font = `700 ${size}px Rubik, system-ui, sans-serif`; }
  g.fillText(text, 512, sub ? 108 : 128);
  if (sub) { g.font = '600 46px Nunito, Rubik, system-ui, sans-serif'; g.fillStyle = '#b5532e'; g.fillText(sub, 512, 192); }
  s.t.needsUpdate = true;
}

// canvas textures: the carpet (stripes and small stars), a glow that fades out down a light shaft, a round soft glow, a place number
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function carpetTex(rep) {
  const t = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#ff8fab'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff7a9c'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h);
    g.fillStyle = '#ffa9c0'; g.fillRect(52, 0, 24, h);
    g.fillStyle = '#ffd6e1';
    for (const [x, y] of [[64, 64], [64, 192]]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7 : 16; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, rep); t.anisotropy = 4; return t;
}
const fadeTex = () => canvasTex(4, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const glowTex = () => canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const placeTex = n => canvasTex(128, 128, g => { g.fillStyle = '#fff8ea'; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, 6.283); g.fill(); g.stroke(); g.fillStyle = INK; g.font = '800 76px Rubik, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 70); });
function starShape(R, r) { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r : R; k ? sh.lineTo(Math.cos(a) * q, Math.sin(a) * q) : sh.moveTo(Math.cos(a) * q, Math.sin(a) * q); } return sh; }
// a hanging cloth with folds: a strip of quads pushed in and out; tied: gathered in at the tie-back height like a side drape
function drape(w, h, folds, depth, tied = false) {
  const g = new THREE.PlaneGeometry(w, h, folds * 2, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i); const y = p.getY(i), k = Math.round((x / w + .5) * folds * 2);
    const tie = tied ? 1 - .55 * Math.exp(-((y + h * .15) ** 2) / .5) : 1;
    x *= tie; p.setX(i, x); p.setZ(i, (k % 2 ? depth : -depth) * (tied ? tie : 1) * (1 - .25 * (y / h + .5)));
  }
  g.computeVertexNormals(); return g;
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 50, 170);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.8));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(7, 14, 9); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 45 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island and the show ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 26, max: 95, below: -12, seed: 21 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(24, 26, { round: true, rim: 4, seed: 57, props: 18, size: 1.6, flowers: 50, clear: 10 }); land.position.z = -1.5; scene.add(land);
  const flyBirds = birds(scene, 48, 14, 4, 1.6), drift = petals(scene, 24, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const LEN = RUN.z1 - RUN.z0, MID = (RUN.z0 + RUN.z1) / 2;
  const cz = STAGE.z - STAGE.d / 2 + .1, POSE_Z = RUN.z0 + .5 + LEN - 1.4, PAD_R = 1.55, PAD_IN = 1.25; // the curtain's line; where a walk stops to pose
  {
    // runway and stage: white boards, a striped pink carpet with little stars, gold trim; a round platform at the front end
    // the runway ends where it meets the round pose platform (each part stops at the platform's edge, nothing runs through it)
    const meet = (half, r) => POSE_Z - Math.sqrt(r * r - half * half) + .02, seg = (z1, x = 0) => [z1 - RUN.z0, (RUN.z0 + z1) / 2];
    // the carpet tucks in under the platform's pink top (which sits a hair higher), so its square end never shows
    const [bl, bm] = seg(meet(RUN.w / 2, PAD_R)), [cl, cm] = seg(POSE_Z - PAD_IN + .3);
    const carpet = new THREE.MeshStandardMaterial({ map: carpetTex(cl / 2.2), roughness: .8 });
    const rw = put(new THREE.BoxGeometry(RUN.w, RUN.h, bl), M('#fbf7ff'), 0, RUN.h / 2, bm); rw.castShadow = rw.receiveShadow = true;
    put(new THREE.BoxGeometry(RUN.w - .5, .03, cl - .15), carpet, 0, RUN.h + .015, cm + .075).receiveShadow = true;
    const st = put(new THREE.BoxGeometry(STAGE.w, RUN.h, STAGE.d), M('#fbf7ff'), 0, RUN.h / 2, STAGE.z); st.castShadow = st.receiveShadow = true;
    put(new THREE.BoxGeometry(STAGE.w - .5, .03, STAGE.d - .5), M('#ffd3df'), 0, RUN.h + .015, STAGE.z).receiveShadow = true;
    { const [tl, tm] = seg(meet(RUN.w / 2 - .04, PAD_R)); for (const sx of [-1, 1]) put(new THREE.BoxGeometry(.08, .06, tl), M('#ffc94d'), sx * (RUN.w / 2 - .04), RUN.h + .03, tm); }
    put(new THREE.BoxGeometry(STAGE.w, .08, .1), M('#ffc94d'), 0, RUN.h + .04, STAGE.z + STAGE.d / 2 - .05); // gold lip on the stage front
    // the pose platform: a round end where the looks stop, with a gold star to stand on
    // its rim: a gold band round the top of the side (a little wider than the white base, so no face is shared)
    const pad = put(new THREE.CylinderGeometry(PAD_R, PAD_R, RUN.h, 32), M('#fbf7ff'), 0, RUN.h / 2, POSE_Z); pad.castShadow = pad.receiveShadow = true;
    put(new THREE.CylinderGeometry(PAD_R + .02, PAD_R + .02, .1, 32, 1, true), M('#ffc94d', { side: THREE.DoubleSide }), 0, RUN.h - .045, POSE_Z);
    put(new THREE.CylinderGeometry(PAD_IN, PAD_IN, .04, 32), M('#ff8fab'), 0, RUN.h + .02, POSE_Z).receiveShadow = true;
    const star = put(new THREE.ExtrudeGeometry(starShape(.62, .27), { depth: .02, bevelEnabled: false }), M('#ffd54a'), 0, RUN.h + .03, POSE_Z);
    star.rotation.x = -Math.PI / 2; star.receiveShadow = true;
    // the curtain: one draped sheet with deep folds, and two side drapes tied back with gold bands
    const red = M('#c0302a', { roughness: .95 }), redD = M('#93201b', { roughness: .95 });
    put(drape(7.0, 4.6, 34, .16), red, 0, RUN.h + 2.3, cz).castShadow = true;
    for (const sx of [-1, 1]) {
      const d = put(drape(1.9, 4.7, 8, .16, true), redD, sx * 2.95, RUN.h + 2.35, cz + .42); d.castShadow = true;
      put(new THREE.BoxGeometry(.95, .24, .36), M('#ffc94d'), sx * 2.95, RUN.h + 1.65, cz + .42); // the gold tie-back band
    }
    // a frame round it all: pale pink pillars and a top beam lined with marquee bulbs, a scalloped gold pelmet
    const frameM = M('#ffe3ec'), gold = M('#ffc94d');
    for (const sx of [-1, 1]) { const pl = put(new THREE.BoxGeometry(.5, 5.4, .55), frameM, sx * 3.85, RUN.h + 2.7, cz + .3); pl.castShadow = true;
      put(new THREE.BoxGeometry(.62, .2, .66), gold, sx * 3.85, RUN.h + .1, cz + .3); put(new THREE.BoxGeometry(.62, .2, .66), gold, sx * 3.85, RUN.h + 5.3, cz + .3); }
    put(new THREE.BoxGeometry(8.2, .62, .6), frameM, 0, RUN.h + 5.15, cz + .3).castShadow = true;
    put(new THREE.BoxGeometry(7.2, .5, .3), gold, 0, RUN.h + 4.62, cz + .2);
    for (let i = 0; i < 12; i++) put(new THREE.SphereGeometry(.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), gold, -3.3 + i * .6, RUN.h + 4.38, cz + .2).rotation.x = Math.PI;
    // two lamp posts at the front corners of the stage, their heads tipped towards the stage
    for (const sx of [-1, 1]) {
      put(new THREE.CylinderGeometry(.08, .11, 5.4, 6), M('#3a3440'), sx * 3.7, 2.7, -5.2).castShadow = true;
      const hd = put(new THREE.CylinderGeometry(.24, .34, .55, 10), M('#3a3440'), sx * 3.7, 5.5, -5.2); hd.rotation.set(-.55, 0, sx * .5);
    }
    // flower stands at the corners of the stage front
    for (const [x, z, sz] of [[-3.05, STAGE.z + 1.3, 1], [3.05, STAGE.z + 1.3, 1]]) {
      const g = new THREE.Group(); g.position.set(x, z < -6 ? RUN.h : 0, z); g.scale.setScalar(sz); room.add(g);
      put(new THREE.CylinderGeometry(.26, .2, .45, 8), M('#ffffff'), 0, .22, 0, g); put(new THREE.CylinderGeometry(.28, .28, .06, 8), gold, 0, .44, 0, g);
      const cols = ['#ff8fab', '#ffd54a', '#ffffff', '#ff6f91', '#c9a7ff'];
      for (let k = 0; k < 9; k++) { const a = k * 2.4, r = k ? .16 + (k % 3) * .05 : 0; put(new THREE.IcosahedronGeometry(.13 + (k % 2) * .03, 0), M(cols[k % cols.length]), Math.cos(a) * r, .62 + (k ? (k % 3) * .06 : .14), Math.sin(a) * r, g); }
      for (let k = 0; k < 4; k++) put(new THREE.IcosahedronGeometry(.1, 0), M('#7cc35b'), Math.cos(k * 1.6 + .8) * .26, .5, Math.sin(k * 1.6 + .8) * .26, g).scale.set(1.4, .6, 1);
    }
    bake(room); toonify(room, .04);
  }
  const stools = SEATS.map(([x, z], i) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); scene.add(s);
    put(new THREE.CylinderGeometry(.42, .38, .16, 12), M(i % 2 ? '#ffb547' : '#7ed3b2'), 0, .78, 0, s).castShadow = true;
    put(new THREE.CylinderGeometry(.07, .1, .74, 6), M('#8a5a3c'), 0, .38, 0, s);
    put(new THREE.CylinderGeometry(.3, .34, .06, 10), M('#8a5a3c'), 0, .03, 0, s);
    toonify(s, .035); s.visible = false; return s;
  });
  // the bulbs: down both runway edges, round the pose platform and along the frame; one instanced mesh that glows at night
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff0b0', emissive: '#ffc94d', emissiveIntensity: .5, roughness: .4 });
  const spots = [];
  for (let z = RUN.z0 + .4; z < POSE_Z - 1.4; z += .8) for (const sx of [-1, 1]) spots.push([sx * (RUN.w / 2 + .05), RUN.h + .08, z]);
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = Math.sin(a) * 1.41, z = POSE_Z + Math.cos(a) * 1.41; if (Math.abs(x) > RUN.w / 2 + .12 || z > POSE_Z) spots.push([x, RUN.h + .08, z]); }
  for (let k = 0; k < 13; k++) spots.push([-3.6 + k * .6, RUN.h + 5.15, cz + .62]);
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) spots.push([sx * 3.85, RUN.h + .7 + k * .65, cz + .6]);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.075, 8, 6), bulbMat, spots.length);
  { const m = new THREE.Matrix4(); spots.forEach((p, k) => bulbs.setMatrixAt(k, m.makeTranslation(...p))); }
  scene.add(bulbs);
  // soft light shafts from the lamp heads onto the stage front: open cones whose glow fades out towards the floor (no real lights)
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1b8', map: fadeTex(), transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beams = [-1, 1].map(sx => {
    const from = new THREE.Vector3(sx * 3.55, 5.35, -5.35), to = new THREE.Vector3(sx * .4, RUN.h, STAGE.z + .7), len = from.distanceTo(to);
    const g = new THREE.ConeGeometry(1.05, len, 20, 1, true); g.translate(0, -len / 2, 0); g.rotateX(Math.PI); // tip at the origin, opening down +y flipped
    const b = new THREE.Mesh(g, beamMat); b.position.copy(from); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); scene.add(b); return b;
  });
  // a follow spot from out front onto whoever is on show, with a soft pool of light at their feet
  const follow = new THREE.SpotLight('#fff4dc', 0, 40, .3, .7, 0); follow.position.set(0, 12, 12); scene.add(follow, follow.target);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: '#fff1c4' }));
  pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; scene.add(pool);
  const spotAt = new THREE.Vector3(0, RUN.h, STAGE.z + .4);
  // the theme sign above the curtain
  const sign = signTex(), signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: sign.t, transparent: true }));
  signMesh.position.set(0, RUN.h + 6.1, STAGE.z - STAGE.d / 2 + .5); scene.add(signMesh);
  // the podium, on the stage: three blocks with their place on the front and a gold rim
  const podium = new THREE.Group(); podium.position.set(0, RUN.h, STAGE.z + .3); scene.add(podium); podium.visible = false;
  PODIUM.forEach(([x, h, c], k) => {
    const b = put(new THREE.BoxGeometry(1.6, h, 1.4), M(c), x, h / 2, 0, podium); b.castShadow = b.receiveShadow = true;
    put(new THREE.BoxGeometry(1.68, .08, 1.48), M(k ? '#fff7e8' : '#fff1b0'), x, h - .02, 0, podium);
    const sz = Math.min(.62, h * .78), n = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: placeTex(k + 1), transparent: true })); n.position.set(x, h / 2 - .02, .711); n.userData.dyn = true; podium.add(n);
  });
  toonify(podium, .035);
  // the press: Pet Farm pets sitting by the front of the runway, either side of it, with little cameras, cheering and snapping flashes
  const PRESS = ['mossbun', 'tuxpurr', 'cupcowl', 'puddlepup', 'glazemew', 'cindercub'];
  const camGeo = [new THREE.BoxGeometry(.3, .2, .14), new THREE.CylinderGeometry(.075, .085, .12, 10), new THREE.BoxGeometry(.1, .06, .06)];
  const camMats = [M('#3a3440'), M('#9fe6ff', { roughness: .3 }), M('#fff8dc', { emissive: '#ffffff', emissiveIntensity: 0 })];
  // they sit on a low white press bench each side, a step away from the runway's edge, so they are up level with the show
  const PRESS_X = 2.15, BENCH_H = .4;
  { const b = new THREE.Group(); for (const sx of [-1, 1]) { const m = put(new THREE.BoxGeometry(.8, BENCH_H, 2.6), M('#fbf7ff'), sx * PRESS_X, BENCH_H / 2, 1.6, b); m.castShadow = m.receiveShadow = true;
      put(new THREE.BoxGeometry(.84, .05, 2.64), M('#ff8fab'), sx * PRESS_X, BENCH_H - .02, 1.6, b).receiveShadow = true; }
    scene.add(b); toonify(b, .035); }
  const press = PRESS.map((sp, i) => {
    const side = i % 2 ? 1 : -1, row = i >> 1;
    const g = new THREE.Group(); g.position.set(side * PRESS_X, BENCH_H, .75 + row * .85); scene.add(g);
    let h = .8, pet = null;
    try {
      pet = petModel(sp, 1); const bb = new THREE.Box3().setFromObject(pet), size = bb.getSize(new THREE.Vector3()), k = .62 / Math.max(size.y, size.x * .8, .01);
      pet.scale.multiplyScalar(k); pet.position.y = -bb.min.y * k; h = size.y * k; g.add(pet);
    } catch (e) { console.warn('press pet', sp, e); }
    // the camera, held up in front of the face, its lens to the runway
    const cam = new THREE.Group(); cam.position.set(0, h * .6, .34); cam.scale.setScalar(.8); g.add(cam);
    const body = new THREE.Mesh(camGeo[0], camMats[0]), lens = new THREE.Mesh(camGeo[1], camMats[1]), bulb = new THREE.Mesh(camGeo[2], camMats[2].clone());
    lens.rotation.x = Math.PI / 2; lens.position.z = .11; bulb.position.set(-.08, .13, 0); cam.add(body, lens, bulb);
    toonify(cam, .03);
    return { g, pet, cam, bulb: bulb.material ? bulb : null, seed: i * 1.7, hop: 0, lit: 0, ry: null };
  });
  const snap = (x, k = 1) => {
    x.lit = 1; x.hop = Math.max(x.hop, .6 * k); flash = Math.max(flash, .7 * k);
    x.cam.getWorldPosition(tv); tv.y += .1; pfx.sparkle(tv, { n: 4, colors: ['#ffffff', '#fff6c8'], r: .12, size: .34, life: .3 });
  };

  // ---------- avatars: one standing and one seated model per look, made when needed ----------
  const models = new Map(); // key -> { wrap, av, used }
  function model(color, av, pose) {
    const key = pose + color + (av || []).join('.');
    let m = models.get(key);
    if (!m) {
      const wrap = new THREE.Group(), a = avatar3d(color, av, { pose });
      a.position.y = pose === 'stand' ? LIFT : 0; a.traverse(o => { if (o.isMesh) o.castShadow = true; });
      wrap.add(a); wrap.scale.setScalar(K); scene.add(wrap);
      m = { wrap, av: a, key, pose }; models.set(key, m);
    }
    m.used = true; return m;
  }
  const hideAll = () => { for (const m of models.values()) { m.wrap.visible = false; m.used = false; } };
  const sweep = () => { for (const [k, m] of models) if (!m.used) { scene.remove(m.wrap); disposeAvatar(m.av); models.delete(k); } };

  // ---------- state ----------
  let S = null, gid = '', T = 0, evN = 0, stageT = 0, stageKey = '';
  let shown = []; // what is on screen this stage: { m, i, kind: 'walk' | 'judge' | 'me' | 'pod', at, place }
  const pfx = createFx(scene), shake = shaker();
  const lookOf = i => S.looks[i] || S.seats[i].av, tcOf = i => S.tc?.[i] || S.seats[i].color; // a look's top colour
  function arrange() {
    hideAll(); shown = []; for (const s of stools) s.visible = false;
    const st = S.stage, me = S.me;
    podium.visible = st === 'reveal' || st === 'end';
    if (st === 'dress' || st === 'theme' || st === 'pick') {
      if (me >= 0) { const m = model(tcOf(me), lookOf(me), 'stand'); m.wrap.visible = true; m.wrap.position.set(0, RUN.h, STAGE.z + .4); m.wrap.rotation.set(0, 0, 0); shown.push({ m, i: me, kind: 'me' }); }
    }
    if (st === 'walk') {
      const w = S.walker, cur = S.cur;
      if (cur) { const m = model(cur.color, cur.av, 'stand'); m.wrap.visible = true; shown.push({ m, i: w, kind: 'walk', pose: cur.pose }); }
      // everyone else watches from a stool in their usual clothes (with Secret walk the walker sits there too, so nobody can tell)
      const sit = S.seats.map((p, i) => i).filter(i => i !== w && S.seats[i].human).slice(0, SEATS.length);
      // the judges spread down both sides, the first ones near the front where the looks stop to pose
      const spots = sit.map((_, k) => SEATS.length - 1 - Math.round(k * (SEATS.length - 1) / Math.max(1, sit.length - 1)));
      sit.forEach((i, k) => {
        const p = S.seats[i], si = spots[k], [x, z] = SEATS[si], m = model(p.color, p.av, 'sit');
        stools[si].visible = true;
        m.wrap.visible = true; m.wrap.position.set(x, .86 + .42 * K, z); m.wrap.rotation.set(0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
        shown.push({ m, i, kind: 'judge', x, z });
      });
    }
    if (st === 'reveal' || st === 'end') {
      const pts = st === 'end' ? S.res.tot : S.last.map(l => l?.pts ?? -1);
      const top = S.seats.map((_, i) => i).filter(i => pts[i] >= 0 && S.seats[i].human !== false).sort((a, b) => pts[b] - pts[a]).slice(0, 3);
      top.forEach((i, k) => {
        const m = model(tcOf(i), lookOf(i), 'stand'), [x, h] = PODIUM[k];
        m.wrap.visible = true; m.wrap.position.set(x, RUN.h + h, STAGE.z + .3); m.wrap.rotation.set(0, 0, 0);
        shown.push({ m, i, kind: 'pod', place: k });
      });
    }
    sweep();
  }
  function setState(st) {
    const fresh = st.gid !== gid;
    if (fresh) { gid = st.gid; evN = st.ev?.length ? st.ev[st.ev.length - 1].n : 0; }
    S = st;
    const key = [st.stage, st.walk, st.round, st.me, st.walker, st.cur ? st.cur.av.join('.') + st.cur.pose : '', st.me >= 0 ? (st.looks[st.me] || []).join('.') + st.tc?.[st.me] : '', (st.tc || []).join(), st.seats.map(p => p.color + p.human).join()].join('/');
    if (key !== stageKey) { if (stageKey.split('/')[0] !== st.stage || stageKey.split('/')[1] !== String(st.walk)) stageT = 0; stageKey = key; arrange(); }
    paintSign(sign, themeName(st.theme) || 'Sky Runway', st.twist && st.ph !== 'end' ? twistName(st.twist) : st.ph === 'end' ? L("Show's over!", 'Koniec pokazu!') : `${L('Round', 'Runda')} ${st.round + 1}/${st.rounds}`);
    if (!fresh) for (const e of st.ev || []) {
      if (e.n <= evN) continue; evN = e.n;
      if (e.t === 'theme') shake.kick(.06);
      else if (e.t === 'reveal' || e.t === 'end') {
        const first = shown.find(x => x.kind === 'pod' && x.place === 0);
        if (first) { first.hop = 1; pfx.confetti(first.m.wrap.position.clone().setY(first.m.wrap.position.y + 2.2), { n: 90, w: 3, h: 2.4, s: first.i }); }
      }
    }
    resize(true);
  }

  // ---------- camera: a fixed framing per stage, moved over by the HUD panels ----------
  let W = 0, H = 0, hudBottom = 200, hudRight = 0;
  const cam = { pos: new THREE.Vector3(0, 6, 14), look: new THREE.Vector3(0, 2, -6) };
  const goal = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  function frame(stage, walkZ = 0) {
    const portrait = W / Math.max(1, H) < 1, far = portrait ? 1.45 : 1;
    if (stage === 'dress') { goal.look.set(0, RUN.h + .95, STAGE.z + .4); goal.pos.set(0, RUN.h + 1.5, STAGE.z + .4 + 7.4 * (portrait ? 1.75 : 1)); }
    else if (stage === 'theme' || stage === 'pick') { goal.look.set(0, 3.2, STAGE.z); goal.pos.set(0, 4.2, RUN.z1 + 6.5 * far); }
    else if (stage === 'walk') { goal.look.set(0, 1.3, Math.min(RUN.z1 - 2, (walkZ + RUN.z1) / 2 - 1.5)); goal.pos.set(portrait ? 0 : 1.2, portrait ? 5 : 4.3, RUN.z1 + 5.4 * far); }
    else { goal.look.set(0, RUN.h + 2, STAGE.z + .3); goal.pos.set(0, RUN.h + 3, STAGE.z + 8.6 * far); }
  }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < 1 ? 52 : 38;
    // panels: on the right when wide, at the bottom on a phone; the view's middle moves to the free part of the screen
    camera.setViewOffset(w, h, hudRight / 2, Math.min(h * .4, hudBottom / 2), w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let dead = false, first = true, first2 = true, flash = 0, snapT = 0;
  const tv = new THREE.Vector3(), info = { tags: [] };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt; stageT += dt;
    if (!S) { renderer.render(scene, camera); return; }
    let walkZ = RUN.z0;
    for (const x of shown) {
      const a = x.m.av, u = a.userData; x.hop = Math.max(0, (x.hop || 0) - dt * 2);
      if (x.kind === 'me') { animateAvatar(a, T, { seed: 1 }); x.m.wrap.rotation.y = reduced ? -.3 : Math.sin(T * .55) * .8; }
      else if (x.kind === 'judge') { animateAvatar(a, T, { seed: x.i + 2, look: 0 }); }
      else if (x.kind === 'pod') { animateAvatar(a, T, { seed: x.i, hop: x.hop }); if (x.place === 0 && !reduced) { const r = u.arms; r[0].rotation.x = r[1].rotation.x = -2.8 + Math.sin(T * 8) * .15; } }
      else if (x.kind === 'walk') {
        // walk down (40%), pose at the front (25%), walk back (35%) over the walk's time
        const D = Math.max(4, (S.all || 8500) / 1000 - .4), k = Math.min(1, stageT / D), L1 = LEN - 1.4;
        const ease = q => q < .5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
        let z, ry = 0, amt = 1, posing = false;
        if (k < .42) z = RUN.z0 + .5 + ease(k / .42) * L1;
        else if (k < .68) { z = RUN.z0 + .5 + L1; amt = 0; posing = true; }
        else { z = RUN.z0 + .5 + L1 - ease((k - .68) / .32) * L1; ry = Math.PI; }
        animateAvatar(a, T, { seed: 3 });
        if (amt) walkAvatar(a, stageT * 6.8, 1);
        if (posing) {
          const q = (k - .42) / .26, p = x.pose | 0, em = p >= EMOTE_POSE ? EMOTES[p - EMOTE_POSE]?.id : '';
          if (em) { const e = emotePose(em, q, T, u); if (e.walk) walkAvatar(a, T * 7, .9); ry = e.ry; a.rotation.x = e.bend; x.m.wrap.rotation.z = e.lean; x.m.wrap.position.y = RUN.h + e.y; }
          else if (p === 0) { u.arms[1].rotation.x = -2.75; u.arms[1].rotation.z = (u.arms[1].userData.rz0 ??= u.arms[1].rotation.z) + .3 + Math.sin(T * 10) * .3; }
          else if (p === 1) ry = q * Math.PI * 2;
          else { for (const r of u.arms) r.rotation.x = -2.8 + Math.sin(T * 9) * .2; x.m.wrap.position.y = RUN.h + Math.abs(Math.sin(q * Math.PI * 3)) * .3; }
        } else { x.m.wrap.position.y = RUN.h; a.rotation.x = 0; x.m.wrap.rotation.z = 0; }
        x.m.wrap.position.set(0, x.m.wrap.position.y, z); x.m.wrap.rotation.y = ry; walkZ = z;
        if (posing && !reduced && (snapT -= dt) <= 0) {
          // photographers in the crowd: a flash from the front sides now and then
          snapT = .22 + Math.random() * .35; snap(press[Math.random() * press.length | 0]);
        }
        if (posing && !x.puff && !reduced) { x.puff = 1; pfx.burst(new THREE.Vector3(0, 2.4, z), { n: 18, colors: ['#ffd84a', '#ffffff', '#ff8fab'], speed: 2.6, up: 2.4, size: .22, life: .8, shape: p_shape(x.pose) }); }
      }
    }
    // the judges turn their heads to follow whoever walks
    for (const x of shown) if (x.kind === 'judge') { const u = x.m.av.userData; u.head.rotation.y += Math.max(-1, Math.min(1, Math.atan2(walkZ - x.z, Math.abs(x.x)) * (x.x < 0 ? -1 : 1))) * .7; }
    // the press cheers: hops and wagging while a look walks or the podium is up, a quick hop with every photo
    const cheer = S.stage === 'walk' || S.stage === 'reveal' || S.stage === 'end' ? 1 : .25;
    if (S.stage === 'reveal' && !reduced && (snapT -= dt) <= 0) { snapT = .6 + Math.random() * .9; snap(press[Math.random() * press.length | 0], .5); }
    // they turn to follow whoever is on the runway (or the podium), but only so far: they stay side-on to the runway, faces to the crowd
    const aim = shown.find(x => x.kind === 'walk')?.m.wrap.position || (S.stage === 'reveal' || S.stage === 'end' ? podium.position : null);
    for (const x of press) {
      const gz = x.g.position.z, az = Math.max(gz - 1.1, Math.min(gz + 2.2, aim ? aim.z : POSE_Z - .6));
      const goalY = Math.atan2(-x.g.position.x, az - gz);
      if (x.ry == null) x.ry = goalY; else { let d = goalY - x.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); x.ry += d * Math.min(1, dt * 4); }
      x.g.rotation.y = x.ry;
      x.hop = Math.max(0, x.hop - dt * 2.2); x.lit = Math.max(0, x.lit - dt * 6);
      const b = reduced ? 0 : Math.abs(Math.sin(T * 5 + x.seed)) * .08 * cheer + Math.sin(x.hop * Math.PI) * .18;
      if (x.pet) { x.pet.position.y = x.pet.userData.y0 ??= x.pet.position.y; x.pet.position.y += b; wiggle(x.pet, T, x.seed, cheer); }
      x.cam.position.y = (x.cam.userData.y0 ??= x.cam.position.y) + b; x.cam.rotation.z = reduced ? 0 : Math.sin(T * 3 + x.seed) * .08 * cheer;
      x.bulb.material.emissiveIntensity = x.lit * 4;
    }
    frame(S.stage, walkZ);
    const k = first ? 1 : Math.min(1, dt * (S.stage === 'walk' ? 2.5 : 3.2)); first = false;
    cam.pos.lerp(goal.pos, k); cam.look.lerp(goal.look, k);
    camera.position.copy(cam.pos); if (!reduced) camera.position.x += Math.sin(T * .22) * .1;
    camera.lookAt(cam.look); if (!reduced) shake.apply(camera, dt);
    signMesh.position.y = RUN.h + 6.1 + (S.stage === 'theme' && !reduced ? Math.max(0, 1 - stageT * 1.4) * 4 : 0);
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    const night = isNight();
    bulbMat.emissiveIntensity = (night ? 1.6 : .55) + (reduced ? 0 : Math.sin(T * 4) * .15);
    // the shafts dim while you dress (the camera is close), the follow spot and its pool sit on whoever is on show
    const close = S.stage === 'dress' ? .35 : 1; beamMat.opacity = (night ? .3 : .13) * close;
    const on = shown.find(x => x.kind === 'walk') || shown.find(x => x.kind === 'me') || shown.find(x => x.kind === 'pod' && x.place === 0);
    if (on) spotAt.lerp(tv.set(on.m.wrap.position.x, RUN.h, on.m.wrap.position.z), first2 ? 1 : Math.min(1, dt * 8)); first2 = false;
    flash = Math.max(0, flash - dt * 5);
    follow.intensity = on ? (night ? 3.2 : 1.1) + flash * 4 : 0; follow.target.position.copy(spotAt).setY(RUN.h + .8);
    pool.visible = !!on; pool.position.set(spotAt.x, spotAt.y + .045, spotAt.z); pool.material.opacity = (night ? .55 : .32) + flash * .4;
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);
    // name tags: over the walker and the judges, the page draws them
    info.tags.length = 0;
    for (const x of shown) {
      if (x.i < 0) continue;
      tv.setFromMatrixPosition(x.m.av.userData.head.matrixWorld); tv.y += x.kind === 'judge' ? .7 : 1.05; tv.project(camera);
      info.tags.push({ i: x.i, kind: x.kind, x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H, on: tv.z < 1 });
    }
    onFrame?.(info);
  }
  const p_shape = p => (p === 2 ? STAR : p === 1 ? HEART : STAR);
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    // force: a new stage brought a different panel (the camera is moving to a new framing anyway), so it is taken at once
    setHud(px, force) { if (Math.abs(px - hudBottom) > 6 && (force || hudFitOk(canvas))) { hudBottom = px; resize(true); } },
    setInset(px, force) { if (px !== hudRight && (force || hudFitOk(canvas))) { hudRight = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const m of models.values()) disposeAvatar(m.av);
      for (const g of camGeo) g.dispose(); for (const m of camMats) m.dispose(); for (const x of press) x.bulb.material.dispose();
      sign.t.dispose(); pfx.dispose(); bulbMat.dispose(); beamMat.map.dispose(); beamMat.dispose(); pool.material.map.dispose(); pool.material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

// Sky Runway 3D (three.js): a catwalk on a sky island. A stage with a red curtain and the round's theme sign at the
// back, a long runway with bulbs down both edges, two spotlights, and stools for the judges along both sides.
// Dressing: your own look turns on the stage. Runway: one look walks down, poses at the end and walks back while the
// others watch from their stools. Reveal and end: the top three on a podium.
// Purely visual: it draws what the server sends. The fitting room, stars and results are the page (client.js).
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, HEART, nightScene } from '../../scenery3d.js';
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
const SEATS = [[-2.9, -4.6], [2.9, -3.7], [-2.9, -2.4], [2.9, -1.3], [-2.9, -.1], [2.9, 1], [-2.9, 2.1]];
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
  {
    // runway and stage: white boards with a pink carpet down the middle
    const rw = put(new THREE.BoxGeometry(RUN.w, RUN.h, LEN), M('#fbf7ff'), 0, RUN.h / 2, MID); rw.castShadow = rw.receiveShadow = true;
    put(new THREE.BoxGeometry(RUN.w - .5, .03, LEN - .3), M('#ff8fab'), 0, RUN.h + .015, MID).receiveShadow = true;
    const st = put(new THREE.BoxGeometry(STAGE.w, RUN.h, STAGE.d), M('#fbf7ff'), 0, RUN.h / 2, STAGE.z); st.castShadow = st.receiveShadow = true;
    put(new THREE.BoxGeometry(STAGE.w - .5, .03, STAGE.d - .5), M('#ffd3df'), 0, RUN.h + .015, STAGE.z).receiveShadow = true;
    for (const sx of [-1, 1]) put(new THREE.BoxGeometry(.08, .06, LEN), M('#ffc94d'), sx * (RUN.w / 2 - .04), RUN.h + .03, MID);
    // the curtain: folds in red, a gold pelmet over it
    const cz = STAGE.z - STAGE.d / 2 + .1;
    for (let i = 0; i < 16; i++) { const x = -3.4 + i * .453; const f = put(new THREE.CylinderGeometry(.24, .24, 4.6, 6), M(i % 2 ? '#c8342b' : '#b02a22'), x, RUN.h + 2.3, cz); f.castShadow = true; }
    put(new THREE.BoxGeometry(7.4, .7, .6), M('#ffc94d'), 0, RUN.h + 4.75, cz + .05).castShadow = true;
    for (let i = 0; i < 9; i++) put(new THREE.ConeGeometry(.2, .36, 4), M('#ffc94d'), -3.2 + i * .8, RUN.h + 4.25, cz + .3).rotation.x = Math.PI;
    // two lamp posts at the front corners of the stage
    for (const sx of [-1, 1]) {
      put(new THREE.CylinderGeometry(.08, .11, 5.4, 6), M('#3a3440'), sx * 3.7, 2.7, -5.2).castShadow = true;
      put(new THREE.BoxGeometry(.5, .4, .5), M('#3a3440'), sx * 3.7, 5.5, -5.2);
    }
    // the judges' stools (their own group: only as many as there are judges show)
    bake(room); toonify(room, .04);
  }
  const stools = SEATS.map(([x, z], i) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); scene.add(s);
    put(new THREE.CylinderGeometry(.42, .38, .16, 12), M(i % 2 ? '#ffb547' : '#7ed3b2'), 0, .78, 0, s).castShadow = true;
    put(new THREE.CylinderGeometry(.07, .1, .74, 6), M('#8a5a3c'), 0, .38, 0, s);
    put(new THREE.CylinderGeometry(.3, .34, .06, 10), M('#8a5a3c'), 0, .03, 0, s);
    toonify(s, .035); s.visible = false; return s;
  });
  // the bulbs along the runway: one instanced mesh that glows at night
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff0b0', emissive: '#ffc94d', emissiveIntensity: .5, roughness: .4 });
  const nB = Math.floor(LEN / .8) * 2, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.075, 8, 6), bulbMat, nB);
  { const m = new THREE.Matrix4(); let k = 0; for (let z = RUN.z0 + .4; k < nB; z += .8) for (const sx of [-1, 1]) { m.makeTranslation(sx * (RUN.w / 2 + .05), RUN.h + .08, z); bulbs.setMatrixAt(k++, m); } }
  scene.add(bulbs);
  // soft fake spotlight cones from the lamp posts onto the runway end of the stage (no real lights: cheap)
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beams = [-1, 1].map(sx => { const b = new THREE.Mesh(new THREE.ConeGeometry(1.5, 5.6, 18, 1, true), beamMat); b.position.set(sx * 2.4, 3, -4.6); b.rotation.z = -sx * .42; b.rotation.x = .18; scene.add(b); return b; });
  // the theme sign above the curtain
  const sign = signTex(), signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: sign.t, transparent: true }));
  signMesh.position.set(0, RUN.h + 5.9, STAGE.z - STAGE.d / 2 + .5); scene.add(signMesh);
  // the podium, on the stage
  const podium = new THREE.Group(); podium.position.set(0, RUN.h, STAGE.z + .3); scene.add(podium); podium.visible = false;
  for (const [x, h, c] of PODIUM) { const b = put(new THREE.BoxGeometry(1.6, h, 1.4), M(c), x, h / 2, 0, podium); b.castShadow = b.receiveShadow = true; }
  toonify(podium, .035);

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
  const lookOf = i => S.looks[i] || S.seats[i].av;
  function arrange() {
    hideAll(); shown = []; for (const s of stools) s.visible = false;
    const st = S.stage, me = S.me;
    podium.visible = st === 'reveal' || st === 'end';
    if (st === 'dress' || st === 'theme' || st === 'pick') {
      if (me >= 0) { const m = model(S.seats[me].color, lookOf(me), 'stand'); m.wrap.visible = true; m.wrap.position.set(0, RUN.h, STAGE.z + .4); m.wrap.rotation.set(0, 0, 0); shown.push({ m, i: me, kind: 'me' }); }
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
        const m = model(S.seats[i].color, lookOf(i), 'stand'), [x, h] = PODIUM[k];
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
    const key = [st.stage, st.walk, st.round, st.me, st.walker, st.cur ? st.cur.av.join('.') + st.cur.pose : '', st.me >= 0 ? (st.looks[st.me] || []).join('.') : '', st.seats.map(p => p.color + p.human).join()].join('/');
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
    else if (stage === 'walk') { goal.look.set(0, 1.3, Math.min(RUN.z1 - 2, (walkZ + RUN.z1) / 2 - 1.5)); goal.pos.set(portrait ? 0 : 1.2, portrait ? 4.4 : 3.5, RUN.z1 + 4.5 * far); }
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
  let dead = false, first = true;
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
        if (posing && !x.puff && !reduced) { x.puff = 1; pfx.burst(new THREE.Vector3(0, 2.4, z), { n: 18, colors: ['#ffd84a', '#ffffff', '#ff8fab'], speed: 2.6, up: 2.4, size: .22, life: .8, shape: p_shape(x.pose) }); }
      }
    }
    // the judges turn their heads to follow whoever walks
    for (const x of shown) if (x.kind === 'judge') { const u = x.m.av.userData; u.head.rotation.y += Math.max(-1, Math.min(1, Math.atan2(walkZ - x.z, Math.abs(x.x)) * (x.x < 0 ? -1 : 1))) * .7; }
    frame(S.stage, walkZ);
    const k = first ? 1 : Math.min(1, dt * (S.stage === 'walk' ? 2.5 : 3.2)); first = false;
    cam.pos.lerp(goal.pos, k); cam.look.lerp(goal.look, k);
    camera.position.copy(cam.pos); if (!reduced) camera.position.x += Math.sin(T * .22) * .1;
    camera.lookAt(cam.look); if (!reduced) shake.apply(camera, dt);
    signMesh.position.y = RUN.h + 5.9 + (S.stage === 'theme' && !reduced ? Math.max(0, 1 - stageT * 1.4) * 4 : 0);
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    const night = document.body.classList.contains('night');
    bulbMat.emissiveIntensity = (night ? 1.5 : .5) + (reduced ? 0 : Math.sin(T * 4) * .15); beamMat.opacity = night ? .26 : .12;
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
      sign.t.dispose(); pfx.dispose(); bulbMat.dispose(); beamMat.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

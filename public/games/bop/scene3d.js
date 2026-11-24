// Burrow Bop 3D view (three.js): every player has a blocky floating garden with nine burrows. Yours is the big one
// in the middle; the others float beside it (or behind it on an upright phone). Pet Farm pets pop out of the burrows
// and a squeaky pillow mallet bops them. Purely visual: the list of pop-ups (rules.js), the browser's own game
// (client.js) and the server decide what happened; this draws it.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, birds, createFx, shaker, STAR, DOT, HEART as FX_HEART, nightScene, disposeToon } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { petModel } from '../farm/pets3d.js';
import { disposeModel } from '../farm/models.js';
import { HOLES, PETS, SLEEP, GOLD, HEART } from './rules.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const FOV = 30, GAP = 2.7, RIM = .42, PH = 1.75;     // burrows are GAP apart; RIM: how tall a mound is; PH: how tall a pet stands
const X0 = 4.9, ZB = -6.9, ZF = 4.6;                  // a garden's lawn: x -X0..X0, z ZB (back, where the avatar stands) .. ZF
const AV_S = 1.25, FEET = .76, AV_Z = -5.6;
const RISE = 130, SINK = 150;                         // ms a pet takes to pop out and to duck
export const holeX = h => (h % 3 - 1) * GAP, holeZ = h => ((h / 3 | 0) - 1) * GAP;
const backOut = u => { const c = 1.9; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

function zTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  g.font = '900 54px Rubik, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 9; g.strokeStyle = '#3b2219'; g.strokeText('Z', 32, 35); g.fillStyle = '#ffffff'; g.fillText('Z', 32, 35);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function heartGeo() {
  const s = new THREE.Shape(); s.moveTo(0, -.3); s.bezierCurveTo(-.5, 0, -.42, .38, -.2, .38); s.bezierCurveTo(-.08, .38, 0, .3, 0, .2);
  s.bezierCurveTo(0, .3, .08, .38, .2, .38); s.bezierCurveTo(.42, .38, .5, 0, 0, -.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: .16, bevelEnabled: false, curveSegments: 3 }); g.translate(0, 0, -.08); return g;
}

export function createScene(canvas, { onFrame, clock } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 80, 260);
  const camera = new THREE.PerspectiveCamera(FOV, 1, .5, 600);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(6, 16, 10); scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 30, max: 110, below: -16 }); scene.add(cloudRing);
  nightScene(scene);
  const flyBirds = birds(scene, 60, 14, 4, 1.8);
  const pfx = createFx(scene), shake = shaker();
  const zTx = zTexture(), zMat = new THREE.SpriteMaterial({ map: zTx, transparent: true, depthWrite: false });
  const hGeo = heartGeo();

  // ---------- the pets: one model a species, copied (the copies share its shapes) for every burrow that needs one ----------
  const protos = PETS.map(sp => {
    const m = petModel(sp, 0), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = Math.min(PH / size.y, 1.95 / Math.max(size.x, size.z));
    for (const e of m.userData.eyes || []) e.userData.eye = 1;
    m.userData = {}; // the copies must not drag the model's own bookkeeping along
    m.scale.multiplyScalar(k); m.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
    const hold = new THREE.Group(); hold.add(m);
    return { hold, top: size.y * k };
  });
  function petCopy(k) { const g = protos[k].hold.clone(), eyes = []; g.traverse(o => { if (o.userData.eye) eyes.push(o); }); g.userData.eyes = eyes; return g; }

  // ---------- one garden ----------
  function makeGarden() {
    const g = new THREE.Group(), deco = new THREE.Group(); g.add(deco);
    const put = (geo, mat, x, y, z, p = deco) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
    const W = X0 * 2, D = ZF - ZB, cz = (ZF + ZB) / 2;
    put(new THREE.BoxGeometry(W, .5, D), M('#8bca60'), 0, -.25, cz);
    put(new THREE.BoxGeometry(W - .5, .8, D - .5), M('#c98a5a'), 0, -.9, cz);
    put(new THREE.BoxGeometry(W - 2.2, .9, D - 2.4), M('#b0764a'), 0, -1.7, cz);
    put(new THREE.BoxGeometry(W - 4.6, .9, D - 5), M('#96623e'), 0, -2.5, cz);
    for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(1.5, .04, 1.5), M('#7fbf56'), -3.6 + ((i * 53) % 7) * 1.2, .02, ZB + 1 + ((i * 37) % 9) * 1.2); // darker patches of lawn
    for (let h = 0; h < HOLES; h++) {
      put(new THREE.CylinderGeometry(1.05, 1.28, RIM, 8), M(h % 2 ? '#b9824f' : '#c28a55'), holeX(h), RIM / 2, holeZ(h));
      put(new THREE.CylinderGeometry(.88, .88, .04, 8), M('#3a2418'), holeX(h), RIM + .01, holeZ(h));
    }
    // a picket fence along the back and a little way down the sides, bushes in the corners, a few flowers
    for (let i = 0; i < 10; i++) { put(new THREE.BoxGeometry(.3, 1, .16), M('#fff6e6'), -4.5 + i, .5, ZB + .25); put(new THREE.BoxGeometry(.3, .24, .16), M('#fff6e6'), -4.5 + i, 1.08, ZB + .25).rotation.z = Math.PI / 4; }
    put(new THREE.BoxGeometry(9.5, .16, .1), M('#f0dfc4'), 0, .62, ZB + .16);
    for (const sx of [-1, 1]) { for (let i = 0; i < 2; i++) put(new THREE.BoxGeometry(.16, 1, .3), M('#fff6e6'), sx * (X0 - .25), .5, ZB + 1.1 + i);
      put(new THREE.BoxGeometry(1.2, .9, 1.2), M('#4fa85a'), sx * 3.9, .45, ZB + 1.3); put(new THREE.BoxGeometry(.8, .5, .8), M('#5fba66'), sx * 3.9, 1.1, ZB + 1.3); }
    const FL = ['#ff8fab', '#ffd84a', '#ffffff', '#b49bff'];
    [[-4.3, 4], [4.3, 4.1], [-1.35, 4.2], [1.35, -1.35], [-1.35, 1.35], [4.4, .1], [-4.4, -1.3], [1.4, 4.15]].forEach(([x, z], i) => { put(new THREE.BoxGeometry(.07, .3, .07), M('#4fa85a'), x, .15, z); put(new THREE.BoxGeometry(.22, .14, .22), M(FL[i % 4]), x, .36, z); });
    bake(deco); toonify(deco, .045);
    // what comes out of each burrow: the pet, and what it may wear (a nightcap, a crown, a heart)
    const holes = [];
    for (let h = 0; h < HOLES; h++) {
      const riser = new THREE.Group(); riser.position.set(holeX(h), RIM, holeZ(h)); riser.visible = false; g.add(riser);
      const lift = new THREE.Group(); riser.add(lift);
      const cap = new THREE.Group();
      put(new THREE.CylinderGeometry(.4, .42, .14, 6), M('#ffffff'), 0, 0, 0, cap); const cone = put(new THREE.ConeGeometry(.36, .7, 6), M('#6f8cff'), .1, .38, 0, cap); cone.rotation.z = -.35;
      put(new THREE.IcosahedronGeometry(.13, 0), M('#ffffff'), .27, .68, 0, cap); bake(cap); toonify(cap, .035); cap.rotation.z = .2; cap.scale.setScalar(1.3);
      const crown = new THREE.Group();
      put(new THREE.CylinderGeometry(.34, .28, .2, 6), M('#ffd84a'), 0, 0, 0, crown); for (let i = 0; i < 3; i++) put(new THREE.ConeGeometry(.1, .24, 4), M('#ffd84a'), Math.sin(i * 2.094) * .24, .2, Math.cos(i * 2.094) * .24, crown);
      put(new THREE.IcosahedronGeometry(.08, 0), M('#ff5a7a'), 0, .02, .31, crown); bake(crown); toonify(crown, .035); crown.scale.setScalar(1.25);
      const heart = new THREE.Group(); put(hGeo, M('#ff5a7a'), 0, 0, 0, heart); bake(heart); toonify(heart, .04); heart.scale.setScalar(1.3);
      const zs = [0, 1].map(i => { const s = new THREE.Sprite(zMat); s.scale.setScalar(.5 + i * .25); riser.add(s); return s; });
      for (const o of [cap, crown, heart]) { o.visible = false; lift.add(o); }
      holes.push({ riser, lift, cap, crown, heart, zs, pet: null, sp: -1, cur: -1, seen: false, wob: 0 });
    }
    // the pillow mallet: a wooden handle and a soft head, swung about the hand
    const mal = new THREE.Group(); mal.visible = false; g.add(mal);
    put(new THREE.BoxGeometry(.15, 1.5, .15), M('#c98a52'), 0, .7, 0, mal);
    const head = new THREE.Group(); head.position.y = 1.5; mal.add(head);
    put(new THREE.BoxGeometry(1.05, .66, .7), M('#ff8fab'), 0, 0, 0, head); for (const sx of [-1, 1]) put(new THREE.BoxGeometry(.14, .76, .8), M('#fff6e6'), sx * .56, 0, 0, head);
    toonify(mal, .04);
    const avG = new THREE.Group(); avG.position.set(0, FEET * AV_S, AV_Z); avG.scale.setScalar(AV_S); g.add(avG);
    scene.add(g);
    return { g, deco, holes, mal, head, avG, av: null, key: '', x: 0, z: 0, s: 1, seat: -1, hop: 0, nod: 0, dead: false, gp: 0, bonk: new Map(), pool: PETS.map(() => []),
      sw: { t: 1, x: 0, y: 0, z: 0 }, rest: null, bob: Math.random() * 6 };
  }
  function freeGarden(w) {
    scene.remove(w.g); if (w.av) disposeAvatar(w.av); disposeToon(w.deco);
    for (const H of w.holes) for (const o of [H.cap, H.crown, H.heart]) disposeToon(o);
    disposeToon(w.mal);
  }

  // ---------- who plays where ----------
  let wells = [], seats = [], focus = 0, pops = [], layoutKey = '', stage = 'count', mineOn = false;
  let cw = 0, ch = 0, hudTop = 64, hudBottom = 24, tall = false;
  const camDir = new THREE.Vector3(0, Math.sin(.74), Math.cos(.74)), camLook = new THREE.Vector3(), camBase = new THREE.Vector3();

  function setSeats(list, f) {
    const key = list.map(p => p.color + '|' + (p.av || []).join('')).join('/');
    seats = list;
    if (key !== layoutKey) {
      layoutKey = key;
      while (wells.length > list.length) freeGarden(wells.pop());
      while (wells.length < list.length) wells.push(makeGarden());
      list.forEach((p, i) => {
        const w = wells[i], k = p.color + (p.av || []).join('');
        w.seat = i;
        if (w.key !== k) { w.key = k; if (w.av) { w.avG.remove(w.av); disposeAvatar(w.av); } w.av = avatar3d(p.color, p.av, { pose: 'stand' }); w.avG.add(w.av); }
      });
      focus = -1;
    }
    if (f !== focus) { focus = f; resize(true); }
  }
  function setPops(list) { if (list !== pops) { pops = list; for (const w of wells) { w.gp = 0; w.bonk.clear(); } } }

  const corners = [], pv = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === cw && h === ch && !force) return; cw = w; ch = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const availH = Math.max(160, h - hudTop - hudBottom);
    const others = seats.map((_, i) => i).filter(i => i !== focus);
    tall = w / availH < 1.2;
    const fw = wells[focus]; if (fw) { fw.s = 1; fw.x = 0; fw.z = 0; }
    if (tall) { // an upright phone: the others stand in a row behind your garden
      const m = Math.min(.42, (X0 * 2 + 1) / (others.length * (X0 * 2 + .8)));
      others.forEach((i, k) => { const wl = wells[i]; wl.s = m; wl.x = (k - (others.length - 1) / 2) * (X0 * 2 + .8) * m; wl.z = ZB - 4.6 - ZF * m; });
    } else { // otherwise: in a column on each side
      const nL = Math.ceil(others.length / 2), side = (list, sgn) => {
        const cols = list.length > 2 ? 2 : 1, rows = Math.ceil(list.length / cols), m = .46, stepZ = (ZF - ZB + 3.6) * m, stepX = (X0 * 2 + .9) * m;
        list.forEach((i, k) => { const wl = wells[i], c = k % cols, r = (k / cols) | 0, inRow = Math.min(cols, list.length - r * cols);
          wl.s = m; wl.x = sgn * (X0 + 1.1 + X0 * m + (c + (cols - inRow) / 2) * stepX); wl.z = -1 - (sgn > 0 && rows > 1 ? 1.4 : 0) + (r - (rows - 1) / 2) * stepZ - (ZF + ZB) / 2 * m; });
      };
      side(others.slice(0, nL), -1); side(others.slice(nL), 1);
    }
    corners.length = 0;
    for (const wl of wells) {
      wl.g.position.set(wl.x, 0, wl.z); wl.g.scale.setScalar(wl.s);
      const top = FEET * AV_S + 2.75 * AV_S;
      for (const x of [-X0, X0]) { corners.push(new THREE.Vector3(wl.x + x * wl.s, 0, wl.z + ZF * wl.s), new THREE.Vector3(wl.x + x * wl.s, 0, wl.z + ZB * wl.s), new THREE.Vector3(wl.x + x * .5 * wl.s, top * wl.s, wl.z + AV_Z * wl.s)); }
      corners.push(new THREE.Vector3(wl.x, -1.1 * wl.s, wl.z + ZF * wl.s)); // room for the name tag under a small garden
    }
    // find how far back the camera must stand for everything to fit between the bars at the top and the bottom
    const bx = new THREE.Box3().setFromPoints(corners); bx.getCenter(camLook);
    const ax = 1 - 16 / w, y1 = 1 - 2 * hudTop / h, y0 = -1 + 2 * hudBottom / h;
    let lo = 4, hi = 400, ext = null;
    const measure = D => {
      camera.position.copy(camLook).addScaledVector(camDir, D); camera.lookAt(camLook); camera.updateMatrixWorld();
      let a = 9, b = -9, c = 9, d = -9;
      for (const p of corners) { pv.copy(p).project(camera); a = Math.min(a, pv.x); b = Math.max(b, pv.x); c = Math.min(c, pv.y); d = Math.max(d, pv.y); }
      return [a, b, c, d];
    };
    for (let i = 0; i < 26; i++) { const D = (lo + hi) / 2; ext = measure(D); if (ext[1] - ext[0] <= ax * 2 && ext[3] - ext[2] <= y1 - y0) hi = D; else lo = D; }
    // then slide the view so the picture sits in the middle of that space
    for (let i = 0; i < 3; i++) {
      ext = measure(hi);
      const ty = Math.tan(FOV * Math.PI / 360) * hi, dy = ((ext[2] + ext[3]) / 2 - (y0 + y1) / 2) * ty, dx = (ext[0] + ext[1]) / 2 * ty * camera.aspect;
      up.setFromMatrixColumn(camera.matrixWorld, 1); right.setFromMatrixColumn(camera.matrixWorld, 0);
      camLook.addScaledVector(up, dy).addScaledVector(right, dx);
    }
    camBase.copy(camLook).addScaledVector(camDir, hi);
    camera.position.copy(camBase); camera.lookAt(camLook); camera.updateMatrixWorld();
    scene.fog.near = hi + 60; scene.fog.far = hi + 300;
  }

  // ---------- what happened ----------
  const wp = new THREE.Vector3();
  const at = (w, x, y, z, v = wp) => v.set(w.x + x * w.s, y * w.s, w.z + z * w.s);
  // a pet was bopped (bad: it was asleep). t: the game clock, ms
  function bop(seat, i, t, bad) {
    const w = wells[seat], pop = pops[i]; if (!w || !pop || w.bonk.has(i)) return;
    w.bonk.set(i, { t: Math.min(t, pop.at + pop.up), bad });
    const hx = holeX(pop.hole), hz = holeZ(pop.hole), big = seat === focus;
    swing(seat, hx, RIM + PH * .7, hz);
    if (reduced) return;
    at(w, hx, RIM + PH * .9, hz);
    if (bad) pfx.burst(wp, { n: big ? 10 : 5, colors: ['#ff5a5a', '#ffffff', '#6f8cff'], speed: 3 * w.s + .5, up: 2.4 * w.s, size: .34 * w.s + .05, life: .6, shape: [DOT, STAR] });
    else {
      const gd = pop.kind === GOLD, hrt = pop.kind === HEART;
      pfx.burst(wp, { n: (big ? 9 : 4) + (gd ? 8 : 0), colors: gd ? ['#ffd84a', '#fff1a8', '#ffffff'] : hrt ? ['#ff5a7a', '#ffb3c6'] : ['#ffe46b', '#ffffff', '#ffb547'], speed: (gd ? 4.2 : 3) * w.s + .4, up: 2.6 * w.s, size: (gd ? .42 : .32) * w.s + .05, life: .55, shape: hrt ? FX_HEART : STAR });
      pfx.ring(at(w, hx, RIM + .05, hz), { color: gd ? '#ffd84a' : '#ffffff', size: 1.5 * w.s, life: .35 });
      w.hop = Math.max(w.hop, gd ? 1 : .45);
    }
    if (big) shake.kick(bad ? .22 : pop.kind === GOLD ? .12 : .05);
  }
  // a pet got away from the big garden
  function miss(i) {
    const w = wells[focus], pop = pops[i]; if (!w || !pop || reduced) return;
    pfx.puff(at(w, holeX(pop.hole), RIM + .1, holeZ(pop.hole)), { n: 8, size: .34, speed: 2.4, life: .45, color: ['#ffd0c8', '#ffffff'] });
    shake.kick(.16);
  }
  function out(seat) {
    const w = wells[seat]; if (!w) return; w.dead = true;
    if (!reduced) { pfx.puff(at(w, 0, 1, 0), { n: 18, size: 1.3 * w.s + .2, speed: 6 * w.s + 1, life: .8, color: ['#ffffff', '#dcd8e4'] }); if (seat === focus) shake.kick(.4); }
  }
  function cheer(seat) { const w = wells[seat]; if (!w) return; w.hop = 1; if (!reduced) pfx.confetti(at(w, 0, 1.5, -1), { n: 90, w: 8 * w.s + 1, h: 6 * w.s + 1, s: seat }); }
  function setState(S) { stage = S.stage; S.x.forEach((x, i) => { if (wells[i]) wells[i].dead = x[0] <= 0; }); }
  // the mallet comes down on a spot of a garden (its own coordinates)
  function swing(seat, x, y, z) { const w = wells[seat]; if (!w) return; w.sw.t = 0; w.sw.x = x; w.sw.y = y; w.sw.z = z; }

  // ---------- pointing ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), box = new THREE.Box3();
  // which burrow of the big garden is under this point of the screen? { h: 0..8 or -1, x, z: the spot on the lawn }
  function pick(cx, cy) {
    const w = wells[focus]; if (!w || !cw) return null;
    const rc = canvas.getBoundingClientRect(); ndc.set((cx - rc.left) / rc.width * 2 - 1, 1 - (cy - rc.top) / rc.height * 2);
    ray.setFromCamera(ndc, camera);
    let best = -1, bd = 1e9; const R = 1.3;
    for (let h = 0; h < HOLES; h++) {
      const x = w.x + holeX(h) * w.s, z = w.z + holeZ(h) * w.s;
      box.min.set(x - R * w.s, 0, z - R * w.s); box.max.set(x + R * w.s, (RIM + PH + .15) * w.s, z + R * w.s);
      if (ray.ray.intersectBox(box, hit)) { const d = hit.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = h; } }
    }
    const g = ray.ray.intersectPlane(ground, hit);
    return { h: best, x: g ? (hit.x - w.x) / w.s : 0, z: g ? (hit.z - w.z) / w.s : 0, on: !!g };
  }
  // the mallet waits over the lawn where the mouse points (null: put it away)
  function hover(p) { const w = wells[focus]; if (w) w.rest = p; }
  function tap(seat, h, x, z) { if (h >= 0) swing(seat, holeX(h), RIM + .25, holeZ(h)); else swing(seat, Math.max(-X0, Math.min(X0, x)), .25, Math.max(ZB + 1.5, Math.min(ZF, z))); }

  // ---------- loop ----------
  let T = 0, dead = false;
  const tv = new THREE.Vector3(), info = { tags: [] };
  const toScreen = (v, o) => { tv.copy(v).project(camera); o.x = (tv.x + 1) / 2 * cw; o.y = (1 - tv.y) / 2 * ch; return o; };
  function release(w, H) { if (H.pet) { H.lift.remove(H.pet); w.pool[H.sp].push(H.pet); H.pet = null; } H.cur = -1; H.riser.visible = false; }
  function drawGarden(w, t, dt) {
    const big = w.seat === focus;
    while (w.gp < pops.length && pops[w.gp].at + pops[w.gp].up + 800 < t) { w.bonk.delete(w.gp); w.gp++; }
    for (const H of w.holes) H.seen = false;
    for (let j = w.gp; j < pops.length && pops[j].at <= t; j++) {
      const pop = pops[j], b = w.bonk.get(j), end = b ? b.t + (b.bad ? 640 : 400) : pop.at + pop.up;
      if (t >= end || (w.dead && !b) || stage !== 'go') continue;
      const H = w.holes[pop.hole];
      if (H.cur !== j) {
        if (H.cur >= 0) release(w, H);
        H.cur = j; H.sp = pop.pet; H.pet = w.pool[pop.pet].pop() || petCopy(pop.pet); H.lift.add(H.pet);
        const top = protos[pop.pet].top;
        H.cap.visible = pop.kind === SLEEP; H.crown.visible = pop.kind === GOLD; H.heart.visible = pop.kind === HEART;
        H.cap.position.set(0, top - .08, .05); H.crown.position.set(0, top + .02, 0); H.heart.position.set(0, top + .7, 0);
        for (const e of H.pet.userData.eyes) e.scale.z = pop.kind === SLEEP ? .15 : 1;
        H.riser.visible = true;
      }
      H.seen = true;
      const a = t - pop.at, down = -(PH + .25);
      let y = a < RISE ? down * (1 - backOut(a / RISE)) : 0, sx = 1, sy = 1, rz = 0, zzz = pop.kind === SLEEP;
      if (b) {
        const d = t - b.t;
        if (b.bad) { // woken up: it jumps, cross, and goes back to bed
          zzz = false; for (const e of H.pet.userData.eyes) e.scale.z = 1;
          rz = Math.sin(d * .06) * .16 * Math.max(0, 1 - d / 460); y += d < 300 ? Math.sin(d / 300 * Math.PI) * .35 : 0;
          if (d > 460) y = down * ((d - 460) / 180) ** 2;
        } else if (d < 110) { const k = d / 110; sy = 1 - .5 * k; sx = 1 + .32 * k; }
        else { const k = (d - 110) / 290; sy = .5 + .25 * k; sx = 1.32 - .22 * k; y = down * k * k; }
      } else {
        const left = pop.at + pop.up - t;
        if (left < SINK) y = down * (1 - left / SINK) ** 2;
        if (pop.kind === SLEEP) { sy = 1 + Math.sin(t * .003 + j) * .04; rz = .1; }
        else { sy = 1 + Math.sin(t * .012 + j) * .035; rz = Math.sin(t * .008 + j * 2) * .05; }
      }
      H.lift.position.y = y; H.lift.scale.set(sx, sy, sx); H.lift.rotation.z = rz;
      if (H.heart.visible) { H.heart.rotation.y = t * .004; H.heart.position.y = protos[pop.pet].top + .7 + Math.sin(t * .006) * .08; }
      if (H.crown.visible && big && !reduced && !b && Math.random() < dt * 5) pfx.sparkle(at(w, holeX(pop.hole), RIM + PH * .6 + y, holeZ(pop.hole)), { n: 1, r: .7, size: .26, life: .6 });
      H.zs.forEach((s, i) => { s.visible = zzz && y > -.6; if (s.visible) { const u = (t * .0007 + i * .5) % 1; s.position.set(.7 + u * .5 + i * .1, PH + .45 + u * .9, .2); s.material.opacity = 1; s.scale.setScalar((.44 + i * .16) * (.6 + u * .6)); } });
    }
    for (const H of w.holes) if (!H.seen && H.cur >= 0) release(w, H);
    // the mallet
    const sw = w.sw, mal = w.mal;
    if (sw.t < 1) {
      sw.t = Math.min(1, sw.t + dt / .26);
      const u = sw.t, k = u < .27 ? u / .27 : u < .5 ? 1 : 1 - (u - .5) / .5, th = .55 + 1.2 * k * k;
      mal.visible = true; mal.position.set(sw.x + 1.476, sw.y + .6, sw.z + .12); mal.rotation.z = th;
      w.head.scale.set(1, u > .25 && u < .5 ? .72 : 1, 1);
    } else if (big && w.rest && mineOn) {
      mal.visible = true; mal.position.set(w.rest.x + 1.2, 1.9 + Math.sin(T * 3) * .06, w.rest.z + .12); mal.rotation.z = .55; w.head.scale.set(1, 1, 1);
    } else mal.visible = false;
    // the avatar
    w.hop = Math.max(0, w.hop - dt * 1.6); w.nod += ((w.dead ? 1 : 0) - w.nod) * Math.min(1, dt * 4);
    if (w.av) { w.av.position.y = Math.abs(Math.sin(w.hop * Math.PI * 2)) * .3 * w.hop; w.av.rotation.z = w.nod * .1; animateAvatar(w.av, T, { seed: w.seat, active: !w.dead && stage === 'go', hop: w.hop, nod: w.nod * 1.4 }); }
    w.g.position.y = big || reduced ? 0 : Math.sin(T * .9 + w.bob) * .1 * w.s;
  }
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const t = clock ? clock() : 0;
    for (const w of wells) drawGarden(w, t, dt);
    cloudRing.rotation.y = T * .005; flyBirds(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .05), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, ch);
    renderer.render(scene, camera);
    camera.position.copy(camBase); camera.lookAt(camLook); camera.updateMatrixWorld(); // the tags and the pointer use the steady view
    wells.forEach((w, i) => {
      const tg = info.tags[i] ||= { x: 0, y: 0, w: 0, show: false }; tg.show = w.seat !== focus;
      toScreen(at(w, 0, -.6, ZF + .2), tg); const a = toScreen(at(w, -X0, 0, ZF), info.a ||= {}).x, b = toScreen(at(w, X0, 0, ZF), info.b ||= {}).x; tg.w = b - a;
    });
    info.tags.length = wells.length; info.tall = tall;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setSeats, setPops, setState, bop, miss, out, cheer, pick, hover, tap,
    setMine(on) { mineOn = on; },
    // where a burrow of the big garden is on the screen (for the points that float up)
    spot(h, o = {}) { const w = wells[focus]; if (!w) return null; return toScreen(at(w, holeX(h), RIM + PH, holeZ(h)), o); },
    setHud(top, bottom) { if (Math.abs(bottom - hudBottom) > 6 || Math.abs(top - hudTop) > 6) { hudBottom = bottom; hudTop = top; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const w of wells) freeGarden(w);
      for (const p of protos) disposeModel(p.hold);
      pfx.dispose(); zTx.dispose(); zMat.dispose(); hGeo.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

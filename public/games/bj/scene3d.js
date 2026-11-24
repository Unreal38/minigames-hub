// Blackjack 3D table (three.js). Purely visual: it draws the state the HUD hands it and animates the changes.
// The players sit round an oval table with the dealer in one more seat across from you; the dealer's cards lie in the
// middle and everyone's own cards lie face up in front of them, turned to the camera so they are easy to read.
import * as THREE from 'three';
import { cardGeometry } from '../../cardgeo.js';
import { cardTexture, suitPath, feltLogo } from '../poker/scene3d.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, createFx, shaker } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';

const INK = '#3b2219';
const RX = 5.3, RZ = 3.35; // table half-width and half-depth
const CW = .62, CH = .88;   // card size
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, ...o });
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- textures ----------
function feltTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S / 2);
  gr.addColorStop(0, '#3f86b8'); gr.addColorStop(1, '#2a5f93'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < .5 ? '#ffffff08' : '#00000010'; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  // the dealer's box in the middle and a dashed ring where the bets go
  g.strokeStyle = '#fff4e266'; g.lineWidth = 6; g.setLineDash([22, 16]);
  g.beginPath(); g.ellipse(S / 2, S / 2, S * .39, S * .39, 0, 0, 7); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#fff4e23a'; g.lineWidth = 5; g.beginPath(); g.roundRect(S * .27, S * .385, S * .46, S * .2, 26); g.stroke();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, x = S / 2 + Math.cos(a) * S * .45, y = S / 2 + Math.sin(a) * S * .45;
    g.globalAlpha = .2; suitPath(g, i % 4, x - 14, y - 14, 28); g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  feltLogo(t, g, S / 2, S / 2 + 250, 150, '#1f4a75', RX / RZ);
  return t;
}
function woodTexture(base = '#8a4e2c', ring = '#6e3a1e') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.strokeStyle = ring; g.globalAlpha = .1 + Math.random() * .2; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const y = Math.random() * 256; g.moveTo(0, y); g.bezierCurveTo(80, y + 8, 170, y - 8, 256, y + 4); g.stroke(); }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function floorTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  for (let row = 0; row < 4; row++) {
    let x = -Math.random() * 120;
    while (x < 256) { const w = 90 + Math.random() * 110; g.fillStyle = `hsl(27 40% ${40 + Math.random() * 6}%)`; g.fillRect(x, row * 64, w, 64); g.fillStyle = '#4a2c2277'; g.fillRect(x, row * 64, 2, 64); x += w; }
    g.fillStyle = '#4a2c2288'; g.fillRect(0, row * 64, 256, 2);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3.6, 3.6); return t;
}
function rugTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  [['#2f5f7a', 256], ['#ffb547', 244], ['#fff4e2', 228], ['#7ed3b2', 216], ['#24506b', 202]].forEach(([c, r]) => { g.fillStyle = c; g.beginPath(); g.arc(256, 256, r, 0, 7); g.fill(); });
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; g.globalAlpha = .5; suitPath(g, i % 4, 256 + Math.cos(a) * 180 - 10, 256 + Math.sin(a) * 180 - 10, 20); }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function chipTexture(col, edge) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = col; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
  g.fillStyle = edge; for (let i = 0; i < 8; i++) { g.save(); g.translate(64, 64); g.rotate(i / 8 * Math.PI * 2); g.fillRect(-7, -64, 14, 18); g.restore(); }
  g.strokeStyle = edge; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function softDot() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// chip colours by value, biggest first (the same chips as the poker table)
const DENOM = [[500, '#9b6fd6', '#fff4e2'], [100, '#3b2219', '#ffb547'], [25, '#7ed3b2', '#fff4e2'], [5, '#ff8fab', '#fff4e2'], [1, '#fff4e2', '#e5543b']];

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 2); // steps the resolution down if the device can't hold 60 fps
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const SKY_TOP = '#0f2350', SKY_LOW = '#3d7fa6'; // the blue hour over the bay
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 30, 130);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  scene.add(new THREE.HemisphereLight('#eaf4ff', '#9bb7d6', 1.4));
  const small = matchMedia('(max-width: 760px)').matches;
  const key = new THREE.DirectionalLight('#fff0e4', 1.25); key.position.set(4, 13, 6); key.castShadow = true;
  key.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34 });
  key.shadow.bias = -.0006; key.shadow.normalBias = .02; scene.add(key);
  const rimL = new THREE.DirectionalLight('#a8d0ff', .3); rimL.position.set(-6, 7, -9); scene.add(rimL);
  const lamp = new THREE.PointLight('#ffc27a', 4, 14, 1.3); lamp.position.set(0, 4.6, 0); scene.add(lamp);
  const dot = softDot();
  const room = new THREE.Group(); scene.add(room); // everything that never moves: merged and outlined together below
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // a round wooden deck with a rug, a lampshade over the table and strings of lights
  const floor = put(new THREE.CircleGeometry(11.6, 48), M('#ffffff', { map: floorTexture(), roughness: .85 }), 0, -2.39, 0);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const rug = put(new THREE.CircleGeometry(9.8, 64), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }), 0, -2.38, 0);
  rug.rotation.x = -Math.PI / 2; rug.scale.y = .78; rug.receiveShadow = true;
  {
    const g = new THREE.Group(); g.position.set(0, 6.4, -.4); room.add(g);
    const shade = put(new THREE.CylinderGeometry(.7, 1.5, 1, 32, 1, true), M('#7ed3b2', { side: THREE.DoubleSide, roughness: .9, emissive: '#7ed3b2', emissiveIntensity: .25 }), 0, 0, 0, g);
    put(new THREE.TorusGeometry(1.5, .05, 6, 32), M('#ffb547'), 0, -.5, 0, g).rotation.x = Math.PI / 2;
    put(new THREE.SphereGeometry(.32, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1cf', fog: false }), 0, -.35, 0, g);
    put(new THREE.CylinderGeometry(.02, .02, 4, 6), M(INK), 0, 2.5, 0, g);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ffc27a', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
    h.position.y = -.5; h.scale.setScalar(4); g.add(h); shade.castShadow = false;
  }
  const bulbs = [], bulbGeo = new THREE.SphereGeometry(.13, 12, 10), bulbCols = ['#ffb547', '#ff8fab', '#7ed3b2', '#ffd27a', '#7fd1e8'];
  [[-10, -7, 10, -7, 6.4], [-11, -2, -7, -10, 5.6], [7, -10, 11, -2, 5.8]].forEach(([x1, z1, x2, z2, y], li) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(V(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * 1.1, z1 + (z2 - z1) * t)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2a1f4a' })));
    pts.forEach((p, i) => { if (i % 2) return; const col = bulbCols[(i / 2 + li) % 5]; const b = put(bulbGeo, new THREE.MeshBasicMaterial({ color: col }), p.x, p.y - .16, p.z, scene); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: col, transparent: true, opacity: .35, depthWrite: false })); h.scale.setScalar(1.1); b.add(h); bulbs.push(b); });
  });

  // table: wooden base, padded rail, blue felt
  const oval = (r, h, seg = 80) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.scale(1, 1, RZ / RX); return g; };
  const wood = woodTexture();
  const base = put(oval(RX + .5, .5), [M('#6e3a1e', { map: wood }), M('#7a4628', { map: wood }), M('#5a3019')], 0, -.3, 0);
  base.castShadow = true; base.receiveShadow = true;
  const felt = put(new THREE.CircleGeometry(RX, 96), M('#ffffff', { map: feltTexture(), roughness: .95 }), 0, .005, 0);
  felt.rotation.x = -Math.PI / 2; felt.scale.y = RZ / RX; felt.receiveShadow = true;
  const railGeo = new THREE.TorusGeometry(RX + .2, .34, 16, 120); railGeo.rotateX(Math.PI / 2); railGeo.scale(1, .7, (RZ + .2) / (RX + .2));
  const rail = put(railGeo, M('#e0a04a', { roughness: .45 }), 0, .05, 0); rail.castShadow = true; rail.receiveShadow = true;
  const trimGeo = new THREE.TorusGeometry(RX - .12, .045, 8, 120); trimGeo.rotateX(Math.PI / 2); trimGeo.scale(1, 1, (RZ - .12) / (RX - .12));
  put(trimGeo, M('#fff4e2', { roughness: .35, metalness: .3 }), 0, .03, 0);
  const leg = put(new THREE.CylinderGeometry(.9, 1.6, 1.9, 28), M('#5a3019', { roughness: .5 }), 0, -1.45, 0); leg.castShadow = true;

  bake(room); toonify(room, .035);

  // the world outside: a floating meadow in the blue hour, with stars, a moon, pale clouds, lamp posts and fireflies
  skyDome(scene, SKY_TOP, SKY_LOW, { k: 1.3, off: .05 });
  { const K = 160, pos = new Float32Array(K * 3); for (let i = 0; i < K; i++) { const a = Math.random() * 6.283, e = .05 + Math.random() * 1.4, r = 270; pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff6d8', size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: .8 })));
    for (const [r, o] of [[9, 1], [13, .25], [19, .1]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: o, depthWrite: false, fog: false })); m.position.set(70, 60, -200); m.lookAt(0, 0, 0); scene.add(m); } }
  const cloudRing = clouds({ min: 24, max: 95, below: -13, color: '#9fc6e6' }); scene.add(cloudRing);
  const land = island(19, 19, { round: true, rim: 4.6, seed: 23, props: 18, size: 1.8, flowers: 60, lamps: 6, clear: 11.6, grass: '#79b877', patch: '#6aa96b' }); land.position.y = -2.4; scene.add(land);
  const pfx = createFx(scene), shake = shaker();
  let flyIn = 0, punch = 0;

  // ---------- seats ----------
  // n players and the dealer share n + 1 places round the table. You are at the bottom; the dealer sits across.
  let n = 0, me = -1, N = 1, kd = 1, seats = [], seatKey = '';
  let dealer = null; // { av, stool, hop }
  const slotAngle = k => Math.PI / 2 + k * Math.PI * 2 / N;
  const onRim = (k, f = 1) => { const a = slotAngle(k); return V(Math.cos(a) * RX * f, 0, Math.sin(a) * RZ * f); };
  const rel = i => me >= 0 ? (i - me + n) % n : i;
  const slotOf = i => { const r = rel(i); return r < kd ? r : r + 1; };
  const ringGeo = new THREE.TorusGeometry(.75, .05, 8, 40);
  const stoolFor = (col, at) => {
    const stool = new THREE.Group(); stool.position.set(at.x, -.95, at.z); scene.add(stool);
    put(new THREE.CylinderGeometry(.58, .5, .2, 24), M(col, { roughness: .8 }), 0, 0, 0, stool).castShadow = true;
    put(new THREE.CylinderGeometry(.08, .1, 1.3, 8), M('#5a3019'), 0, -.75, 0, stool); toonify(stool, .035);
    return stool;
  };
  // the dealer's shoe: the box the cards come out of
  const shoe = new THREE.Group(); scene.add(shoe);
  { const b = put(new THREE.BoxGeometry(.78, .42, 1.05), M('#3b2a5a'), 0, .21, 0, shoe); b.castShadow = true;
    put(new THREE.BoxGeometry(.6, .3, .1), M('#fff8ec'), 0, .2, .5, shoe);
    put(new THREE.BoxGeometry(.82, .06, 1.09), M('#ffb547'), 0, .44, 0, shoe); toonify(shoe, .03); }
  const deckPos = V(), bankPos = V();
  function buildSeats(list, D) {
    for (const s of seats) { scene.remove(s.av, s.ring, s.stool, s.chips, s.cardsG); disposeAvatar(s.av); }
    if (dealer) { scene.remove(dealer.av, dealer.stool); disposeAvatar(dealer.av); }
    n = list.length; N = n + 1; kd = Math.ceil(N / 2);
    seats = list.map((p, i) => {
      const k = slotOf(i), mine = me >= 0 && rel(i) === 0, out = onRim(k, 1.32);
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = stoolFor(p.color, out); stool.visible = av.visible;
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }), 0, 0, 0, scene);
      const rp = onRim(k, .8); ring.position.set(rp.x, .02, rp.z); ring.rotation.x = Math.PI / 2; ring.scale.set(1.25, 1, .8);
      const chips = new THREE.Group(); const cp = onRim(k, .46); chips.position.set(cp.x, .01, cp.z); scene.add(chips);
      const cardsG = new THREE.Group(); cardsG.position.set(rp.x, .02, rp.z); cardsG.scale.setScalar(HS); scene.add(cardsG); cardsG.updateMatrixWorld();
      return { av, stool, ring, chips, cardsG, hands: [], chipAmt: 0, hop: 0, nod: 0, active: false, look: 0, key: '', k };
    });
    const out = onRim(kd, 1.32), a = slotAngle(kd);
    const av = avatar3d(D.color, D.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); scene.add(av);
    dealer = { av, stool: stoolFor(D.color, out), hop: 0, nod: 0 };
    const sp = onRim(kd, .7); shoe.position.set(sp.x + Math.cos(a + Math.PI / 2) * 1.25, 0, sp.z + Math.sin(a + Math.PI / 2) * .8); shoe.rotation.y = -a - Math.PI / 2;
    deckPos.copy(shoe.position).setY(.35); bankPos.copy(onRim(kd, .72)).setY(.02);
  }

  // ---------- cards ----------
  const cardGeo = cardGeometry(CW, CH); cardGeo.rotateX(-Math.PI / 2);
  const backGeo = cardGeo.clone(); backGeo.rotateZ(Math.PI); backGeo.translate(0, -.004, 0);
  function makeCard(c, bk = 0) { // bk: the owner's card back
    const g = new THREE.Group(), bc = -1 - (bk | 0);
    const front = new THREE.Mesh(cardGeo, toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(c >= 0 ? c : bc), roughness: .55 })));
    const back = new THREE.Mesh(backGeo, toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(bc), roughness: .55 })));
    front.castShadow = true; g.add(front, back); g.userData = { c, front, bc };
    return g;
  }
  function setFace(card, c) { if (card.userData.c === c) return; card.userData.c = c; card.userData.front.material.map = cardTexture(c >= 0 ? c : card.userData.bc); card.userData.front.material.needsUpdate = true; }
  const dim = (card, on) => card.userData.front.material.color.set(on ? '#8f8a9c' : '#ffffff');

  const dcards = []; // the dealer's cards, in the middle
  const DZ = -.25, DS = 1.4, HS = 1.12; // the dealer's cards are bigger than the players': everyone reads them
  const dealerPos = (k, m) => { const gap = m > 1 ? Math.min((CW + .08) * DS, 3.6 / (m - 1)) : 0; return V((k - (m - 1) / 2) * gap, .02 + k * .006, DZ); };
  // where card k of m lies in a seat's group; a split puts the two hands side by side
  const handPos = (h, H, k, m) => V((H > 1 ? (h ? .62 : -.62) : 0) + (k - (m - 1) / 2) * (H > 1 ? .22 : .3), .01 + k * .012, 0);

  // ---------- chips ----------
  const chipGeo = new THREE.CylinderGeometry(.2, .2, .07, 24);
  const chipMats = DENOM.map(([, c, e]) => { const t = chipTexture(c, e); return [M(c, { roughness: .4 }), M('#ffffff', { map: t, roughness: .4 }), M('#ffffff', { map: t, roughness: .4 })].map(toonMat); });
  function chipStack(amt, group) {
    while (group.children.length) group.remove(group.children[0]);
    let left = amt; const cols = [];
    for (let d = 0; d < DENOM.length && left > 0; d++) {
      const k = Math.min(10, Math.floor(left / DENOM[d][0])); left -= k * DENOM[d][0];
      for (let j = 0; j < k; j++) cols.push(d);
    }
    if (left > 0) cols.push(4);
    const per = Math.max(5, Math.ceil(cols.length / 3));
    cols.forEach((d, j) => {
      const col = Math.floor(j / per), h = j % per;
      const m = new THREE.Mesh(chipGeo, chipMats[d]); m.castShadow = true;
      m.position.set((col - 1) * .44 + Math.sin(j * 7.3) * .02, .035 + h * .072, Math.cos(j * 3.1) * .02 + (col % 2) * .1); m.rotation.y = j;
      group.add(m);
    });
  }

  // ---------- tweens & sparkles ----------
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });
  function sparkle(at, col = '#ffd27a', k = 14) { pfx.burst(at, { n: k + 6, colors: [col, '#ffffff', '#fff1a8'], speed: 3.5, up: 4.5, size: .28, life: 1 }); }
  function flyChips(from, to, amt, delay = 0, done) {
    if (amt <= 0) { done?.(); return; }
    const g = new THREE.Group(); chipStack(Math.min(amt, 400), g); g.scale.setScalar(.85); g.visible = false; scene.add(g);
    tween(.55, t => { g.visible = true; const e = ease(t); g.position.lerpVectors(from, to, e); g.position.y += Math.sin(e * Math.PI) * 1.1; }, () => { scene.remove(g); pfx.puff(to, { n: 7, size: .22, speed: 1.6, life: .4 }); pfx.ring(to, { color: '#ffd84a', size: 1.2 }); if (amt >= 200) shake.kick(.06); done?.(); }, delay);
  }
  function flyCard(card, from, to, delay = 0, done) {
    card.visible = false; card.rotation.z = Math.PI; card.userData.y = to.y; card.userData.to = to.clone(); card.userData.fly = true;
    tween(.42, t => {
      card.visible = true; const e = ease(t), dst = card.userData.to; // the spot may shift while the card is in the air
      card.position.lerpVectors(from, dst, e); card.position.y += Math.sin(e * Math.PI) * .8;
    }, () => { card.userData.fly = false; done?.(); }, delay);
  }
  function slide(card, to, delay = 0) { // a card already on the table makes room for a new one
    if (card.userData.to && card.userData.to.distanceToSquared(to) < 1e-6) return;
    card.userData.to = to.clone(); card.userData.y = to.y;
    if (card.userData.fly) return;
    const from = card.position.clone();
    tween(.25, t => card.position.lerpVectors(from, to, ease(t)), null, delay);
  }
  function flip(card, toUp, delay = 0) {
    const to = toUp ? 0 : Math.PI;
    const y0 = () => card.userData.y ?? card.position.y; // where the card rests once it has landed
    let from = null;
    tween(.36, t => { if (from === null) from = card.rotation.z; const e = ease(t); card.rotation.z = from + (to - from) * e; card.position.y = y0() + Math.sin(e * Math.PI) * .5; }, () => { card.rotation.z = to; card.position.y = y0(); }, delay);
  }

  // ---------- sync with the game ----------
  let last = null;
  function sync(S) {
    const list = S.seats, D = S.dealer, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + S.me + '/' + (D.av || []).join('');
    if (key !== seatKey) {
      const meChanged = S.me !== me || list.length !== n;
      me = S.me; seatKey = key;
      if (meChanged || !seats.length) { buildSeats(list, D); for (const c of dcards) scene.remove(c); dcards.length = 0; }
      else list.forEach((p, i) => { // someone sat down in a bot's chair: swap just that avatar
        const s = seats[i], k = p.color + (p.av || []).join('');
        if (s.key && s.key !== k) { const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av); s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1; }
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
      last = null;
    }
    const fresh = !last || last.round !== S.round || last.gid !== S.gid;
    // a fresh deal goes round the table twice: the players in order, then the dealer
    const dealing = fresh ? false : (last.stage === 'bet' && S.stage !== 'bet');
    const inOrder = list.map((_, i) => i).filter(i => list[i].hands.length), P = inOrder.length + 1;
    const dealDelay = (i, k) => (dealing && k < 2 ? (k * P + (i < 0 ? P - 1 : inOrder.indexOf(i))) * .26 : 0);

    // the dealer's cards
    if (fresh) { for (const c of dcards) scene.remove(c); dcards.length = 0; }
    const dm = D.cards.length;
    dcards.forEach((c, k) => slide(c, dealerPos(k, dm)));
    while (dcards.length < dm) {
      const k = dcards.length, v = D.cards[k], c = makeCard(v, 0), d = dealDelay(-1, k);
      c.scale.setScalar(DS); scene.add(c); dcards.push(c);
      flyCard(c, deckPos, dealerPos(k, dm), d, () => pfx.sparkle(dealerPos(k, dm), { n: 3, colors: ['#fff1a8', '#ffffff'], r: .3, size: .16, life: .5 }));
      if (v >= 0) flip(c, true, d + .42);
    }
    dcards.forEach((c, k) => { const v = D.cards[k]; if (v >= 0 && c.userData.c < 0) { setFace(c, v); flip(c, true, .05); if (dealer) dealer.nod = 1; } });

    // everyone's cards and bets
    list.forEach((p, i) => {
      const s = seats[i], H = p.hands.length;
      if (fresh || s.hands.length !== H) { // new round or a split: lay the cards out again (only the new ones fly in)
        const old = s.hands.flat(); for (const c of old) s.cardsG.remove(c);
        const had = fresh ? [] : old.map(c => c.userData.c);
        s.hands = p.hands.map((h, hi) => h.cards.map((v, k) => {
          const c = makeCard(v, p.fl?.cb), to = handPos(hi, H, k, h.cards.length), at = had.indexOf(v);
          s.cardsG.add(c);
          if (at >= 0) { had.splice(at, 1); c.position.copy(to); c.userData.to = to.clone(); c.userData.y = to.y; }
          else { const d = dealDelay(i, k); flyCard(c, s.cardsG.worldToLocal(deckPos.clone()), to, d); flip(c, true, d + .42); }
          return c;
        }));
      } else p.hands.forEach((h, hi) => {
        const cs = s.hands[hi], m = h.cards.length;
        cs.forEach((c, k) => slide(c, handPos(hi, H, k, m)));
        while (cs.length < m) {
          const k = cs.length, c = makeCard(h.cards[k], p.fl?.cb), d = dealDelay(i, k);
          s.cardsG.add(c); cs.push(c);
          flyCard(c, s.cardsG.worldToLocal(deckPos.clone()), handPos(hi, H, k, m), d); flip(c, true, d + .42);
          if (h.dbl && k === 2) c.rotation.y = Math.PI / 2; // the one card of a double lies sideways
        }
      });
      p.hands.forEach((h, hi) => { const off = h.bust || h.res === 'lose'; for (const c of s.hands[hi] || []) dim(c, off); });
      s.cardsG.visible = !(me >= 0 && i === me); // my own cards are in the HUD
      // the bet in front of each seat: lost bets go to the dealer, winnings come back at the end of the round
      const amt = H ? p.hands.reduce((a, h) => a + (h.bust || h.res === 'lose' ? 0 : h.bet), 0) : Math.max(0, p.bet);
      if (amt !== s.chipAmt) {
        const at = s.chips.position.clone();
        if (!fresh && amt > s.chipAmt) flyChips(onRim(s.k, 1.05), at, amt - s.chipAmt, dealing ? i * .05 : 0);
        else if (!fresh && amt < s.chipAmt) { flyChips(at, bankPos.clone(), s.chipAmt - amt, .1); s.nod = 1; }
        s.chipAmt = amt; chipStack(amt, s.chips);
      }
      s.active = S.turn === i;
    });
    // paying out: winnings fly from the dealer to every winner
    if (S.stage === 'pay' && last && last.stage !== 'pay') {
      list.forEach((p, i) => {
        const won = p.hands.reduce((a, h) => a + Math.max(0, h.pay), 0), s = seats[i];
        if (won <= 0) return;
        const bjack = p.hands.some(h => h.res === 'bj');
        flyChips(bankPos.clone(), onRim(s.k, .62), won, .5 + i * .12, () => {
          s.hop = 1; const top = s.av.position.clone().add(V(0, 2.2, 0));
          sparkle(top, '#ffd27a', 10); if (bjack) pfx.confetti(top, { n: 50, w: 3.5, h: 2.5, s: i });
          if (i === me) { punch = 1; shake.kick(.1); }
        });
      });
      if (dealer && !list.some(p => p.net > 0)) dealer.hop = 1;
    }
    last = { round: S.round, gid: S.gid, stage: S.stage };
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230;
  const camBase = V(), camLook = V(0, 0, -.3);
  const DIR = V(0, 1.05, 1).normalize();
  const v = V();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 175 : 120, bottom = h - hudBottom;
    const FIT = [V(0, 3.4, -RZ * 1.32), V(0, .3, RZ * 1.02), V(-(portrait ? RX * 1.12 : RX * 1.32 + 1.1), 1.2, 0), V(portrait ? RX * 1.12 : RX * 1.32 + 1.1, 1.2, 0)]; // phones: side players may peek in from the edges
    let lo = 5, hi = 90;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; place(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && lx >= 4 && rx <= w - 4) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 14; scene.fog.far = hi + 120;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, 0, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastNow = 0;
  const tagV = V();
  const px = () => ({ x: (tagV.x + 1) / 2 * W, y: (1 - tagV.y) / 2 * H });
  function loop(dt, now) {
    if (dead) return;
    resize();
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    // tweens run on wall-clock time, so a slow device skips frames instead of falling behind the game
    for (let i = 0; i < tweens.length; i++) { // oldest first, so a later tween wins
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    const turnSeat = seats.findIndex(s => s.active);
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * 1.6);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .5 * s.hop;
      let want = 0; // everyone glances at whoever is playing
      if (turnSeat >= 0 && turnSeat !== i) { const d = ((seats[turnSeat].k - s.k + N) % N) / N; want = d < .5 ? .5 : -.5; }
      s.look += (want - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop, look: s.look, nod: Math.sin(s.nod * Math.PI) });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      const pulse = 1 + Math.sin(T * 4) * .05; s.ring.scale.set(1.25 * pulse, pulse, .8);
    });
    if (dealer) {
      dealer.hop = Math.max(0, dealer.hop - dt * 2.2); dealer.nod = Math.max(0, dealer.nod - dt * 1.6);
      dealer.av.position.y = -.15 + Math.abs(Math.sin(dealer.hop * Math.PI * 2)) * .5 * dealer.hop;
      animateAvatar(dealer.av, T, { seed: 9, active: turnSeat < 0, hop: dealer.hop, look: 0, nod: Math.sin(dealer.nod * Math.PI) });
    }
    bulbs.forEach((b, i) => b.scale.setScalar(1 + Math.sin(T * 2 + i) * .12));
    lamp.intensity = 4 + Math.sin(T * 1.3) * .2;
    punch = Math.max(0, punch - dt * 1.4);
    const zoom = 1 - Math.sin(Math.min(1, punch) * Math.PI) * .04; // a little push in when you win
    camera.position.set(camBase.x * zoom + Math.sin(T * .22) * .18, camBase.y * zoom + Math.sin(T * .37) * .05, camBase.z * zoom);
    camera.lookAt(camLook); shake.apply(camera, dt);
    cloudRing.rotation.y = T * .005;
    flyIn -= dt; if (flyIn <= 0) { flyIn = .2; const a = Math.random() * 6.283, r = 7 + Math.random() * 7; pfx.rise(v.set(Math.cos(a) * r, -2 + Math.random() * 4, Math.sin(a) * r), { color: ['#fff1a8', '#d8ffb0'], size: .17, life: 3.2, speed: .22, wobble: .5, grow: 0 }); } // fireflies
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);
    // where the HUD should draw the name tags and the dealer's total
    const tags = seats.map((s, i) => {
      const mine = me >= 0 && rel(i) === 0;
      tagV.copy(onRim(s.k, mine ? .98 : 1.32)); tagV.y = mine ? .2 : 2.35; tagV.project(camera);
      return { ...px(), mine };
    });
    tagV.copy(onRim(kd, 1.32)); tagV.y = 2.35; tagV.project(camera); const dealerTag = px();
    tagV.set(0, .1, DZ - CH * DS / 2 - .1); tagV.project(camera); const dealerCards = px();
    onFrame?.({ tags, dealer: dealerTag, dcards: dealerCards });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    sync,
    hop(i) { if (seats[i]) seats[i].hop = 1; },
    nod(i) { if (seats[i]) seats[i].nod = 1; },
    setHud(px) { if (px !== hudBottom) { hudBottom = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) disposeAvatar(s.av);
      if (dealer) disposeAvatar(dealer.av);
      pfx.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

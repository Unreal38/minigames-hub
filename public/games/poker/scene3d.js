// Texas Hold'em 3D table (three.js). Purely visual: it draws the state the HUD hands it and animates the changes.
import * as THREE from 'three';
import { rankOf, suitOf, RANKS } from './rules.js';
import { SUIT_COLS, SUIT_PATHS, CLUB_DOTS } from './cards.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, createFx, shaker, STAR, DOT, HEART } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';

const INK = '#3b2219';
const RX = 5.3, RZ = 3.35; // table half-width and half-depth
const CW = .62, CH = .88;   // card size
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, ...o });

// ---------- textures ----------
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
export function suitPath(g, s, x, y, size) {
  g.save(); g.translate(x, y); g.scale(size / 24, size / 24); g.fillStyle = SUIT_COLS[s];
  if (s === 2) for (const [cx, cy, r] of CLUB_DOTS) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
  g.fill(new Path2D(SUIT_PATHS[s])); g.restore();
}
const texCache = new Map();
export function cardTexture(c) { // c = -1 is the back (Tysiąc draws its cards with this too)
  if (texCache.has(c)) return texCache.get(c);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 364;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  texCache.set(c, tex);
  const g = cv.getContext('2d');
  const paint = () => {
    g.clearRect(0, 0, 256, 364);
    g.fillStyle = INK; rr(g, 0, 0, 256, 364, 30); g.fill();
    if (c < 0) {
      g.fillStyle = '#e5543b'; rr(g, 10, 10, 236, 344, 22); g.fill();
      g.save(); rr(g, 10, 10, 236, 344, 22); g.clip(); g.fillStyle = '#ffffff30';
      for (let y = 0; y < 9; y++) for (let x = 0; x < 6; x++) { g.beginPath(); g.arc(x * 46 + (y % 2 ? 40 : 18), y * 42 + 22, 7, 0, 7); g.fill(); }
      g.restore();
      g.fillStyle = '#fff4e2'; g.beginPath(); g.arc(128, 182, 62, 0, 7); g.fill();
      g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
      suitPath(g, 0, 128 - 38, 182 - 36, 76);
    } else {
      const r = rankOf(c), s = suitOf(c);
      g.fillStyle = '#fff8ec'; rr(g, 10, 10, 236, 344, 22); g.fill();
      // corner index (rank over a small suit) top-left and, upside down, bottom-right; one big pip in the middle
      const corner = () => {
        g.fillStyle = SUIT_COLS[s]; g.font = '700 82px Fredoka, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillText(RANKS[r], 50, 88, 76);
        suitPath(g, s, 29, 98, 42);
      };
      corner();
      g.save(); g.translate(256, 364); g.rotate(Math.PI); corner(); g.restore();
      suitPath(g, s, 128 - 52, 182 - 52, 104);
    }
    tex.needsUpdate = true;
  };
  paint(); document.fonts?.ready.then(paint);
  return tex;
}
function feltTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S / 2);
  gr.addColorStop(0, '#3f9c7a'); gr.addColorStop(1, '#2b7a5e'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < .5 ? '#ffffff08' : '#00000010'; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  g.strokeStyle = '#fff4e255'; g.lineWidth = 6; g.setLineDash([22, 16]);
  g.beginPath(); g.ellipse(S / 2, S / 2, S * .36, S * .36, 0, 0, 7); g.stroke(); g.setLineDash([]);
  // a ring of tiny suits around the middle
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, x = S / 2 + Math.cos(a) * S * .43, y = S / 2 + Math.sin(a) * S * .43;
    g.globalAlpha = .22; suitPath(g, i % 4, x - 14, y - 14, 28); g.globalAlpha = 1;
  }
  g.fillStyle = '#fff4e21c'; g.font = '700 64px Fredoka, Nunito, sans-serif'; g.textAlign = 'center';
  g.fillText('COZY TABLE', S / 2, S / 2 + 230);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
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
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); return t;
}
function rugTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  [['#7a4a8a', 256], ['#ffb547', 244], ['#fff4e2', 228], ['#ff8fab', 216], ['#5c3f86', 202]].forEach(([c, r]) => { g.fillStyle = c; g.beginPath(); g.arc(256, 256, r, 0, 7); g.fill(); });
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

// chip colours by value, biggest first
const DENOM = [[500, '#9b6fd6', '#fff4e2'], [100, '#3b2219', '#ffb547'], [25, '#7ed3b2', '#fff4e2'], [5, '#ff8fab', '#fff4e2'], [1, '#fff4e2', '#e5543b']];

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 2); // steps the resolution down if the device can't hold 60 fps
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const SKY_TOP = '#141a4a', SKY_LOW = '#5a4fae'; // a card night under the stars
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 30, 130);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  scene.add(new THREE.HemisphereLight('#e6e9ff', '#a79be0', 1.35));
  const small = matchMedia('(max-width: 760px)').matches;
  const key = new THREE.DirectionalLight('#f3efff', 1.25); key.position.set(4, 13, 6); key.castShadow = true;
  key.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34 });
  key.shadow.bias = -.0006; key.shadow.normalBias = .02; scene.add(key);
  const rimL = new THREE.DirectionalLight('#9db4ff', .3); rimL.position.set(-6, 7, -9); scene.add(rimL);
  const lamp = new THREE.PointLight('#ffc27a', 4, 14, 1.3); lamp.position.set(0, 4.6, 0); scene.add(lamp);
  const dot = softDot();
  const room = new THREE.Group(); scene.add(room); // everything that never moves: merged and outlined together below
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // room: floor, rug, a hanging lamp and string lights
  const floorMap = floorTexture(); floorMap.repeat.set(3.6, 3.6);
  const floor = put(new THREE.CircleGeometry(11.6, 48), M('#ffffff', { map: floorMap, roughness: .85 }), 0, -2.39, 0); // a round wooden deck on the grass
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const rug = put(new THREE.CircleGeometry(9.8, 64), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }), 0, -2.38, 0);
  rug.rotation.x = -Math.PI / 2; rug.scale.y = .78; rug.receiveShadow = true;
  { // a fabric lampshade over the table
    const g = new THREE.Group(); g.position.set(0, 6.4, -.4); room.add(g);
    const shade = put(new THREE.CylinderGeometry(.7, 1.5, 1, 32, 1, true), M('#ff8fab', { side: THREE.DoubleSide, roughness: .9, emissive: '#ff8fab', emissiveIntensity: .25 }), 0, 0, 0, g);
    put(new THREE.TorusGeometry(1.5, .05, 6, 32), M('#ffb547'), 0, -.5, 0, g).rotation.x = Math.PI / 2;
    put(new THREE.SphereGeometry(.32, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1cf', fog: false }), 0, -.35, 0, g);
    put(new THREE.CylinderGeometry(.02, .02, 4, 6), M(INK), 0, 2.5, 0, g);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ffc27a', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
    h.position.y = -.5; h.scale.setScalar(4); g.add(h); shade.castShadow = false;
  }
  const bulbs = [], bulbGeo = new THREE.SphereGeometry(.13, 12, 10), bulbCols = ['#ffb547', '#ff8fab', '#7ed3b2', '#ffd27a', '#ff7a59'];
  [[-10, -7, 10, -7, 6.4], [-11, -2, -7, -10, 5.6], [7, -10, 11, -2, 5.8]].forEach(([x1, z1, x2, z2, y], li) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * 1.1, z1 + (z2 - z1) * t)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2a1f4a' })));
    pts.forEach((p, i) => { if (i % 2) return; const col = bulbCols[(i / 2 + li) % 5]; const b = put(bulbGeo, new THREE.MeshBasicMaterial({ color: col }), p.x, p.y - .16, p.z, scene); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: col, transparent: true, opacity: .35, depthWrite: false })); h.scale.setScalar(1.1); b.add(h); bulbs.push(b); });
  });

  // table: wooden base, padded rail, felt
  const oval = (r, h, seg = 80) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.scale(1, 1, RZ / RX); return g; };
  const wood = woodTexture();
  const base = put(oval(RX + .5, .5), [M('#6e3a1e', { map: wood }), M('#7a4628', { map: wood }), M('#5a3019')], 0, -.3, 0);
  base.castShadow = true; base.receiveShadow = true;
  const felt = put(new THREE.CircleGeometry(RX, 96), M('#ffffff', { map: feltTexture(), roughness: .95 }), 0, .005, 0);
  felt.rotation.x = -Math.PI / 2; felt.scale.y = RZ / RX; felt.receiveShadow = true;
  const railGeo = new THREE.TorusGeometry(RX + .2, .34, 16, 120); railGeo.rotateX(Math.PI / 2); railGeo.scale(1, .7, (RZ + .2) / (RX + .2));
  const rail = put(railGeo, M('#b4475a', { roughness: .45 }), 0, .05, 0); rail.castShadow = true; rail.receiveShadow = true;
  const trimGeo = new THREE.TorusGeometry(RX - .12, .045, 8, 120); trimGeo.rotateX(Math.PI / 2); trimGeo.scale(1, 1, (RZ - .12) / (RX - .12));
  put(trimGeo, M('#ffb547', { roughness: .35, metalness: .3 }), 0, .03, 0);
  const leg = put(new THREE.CylinderGeometry(.9, 1.6, 1.9, 28), M('#5a3019', { roughness: .5 }), 0, -1.45, 0); leg.castShadow = true;

  bake(room); toonify(room, .035);

  // the world outside: a floating meadow at night, with stars, a moon, lilac clouds, lamp posts and fireflies
  skyDome(scene, SKY_TOP, SKY_LOW, { k: 1.3, off: .05 });
  { const N = 260, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, e = .05 + Math.random() * 1.4, r = 270; pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff6d8', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: .9 })));
    for (const [r, o] of [[9, 1], [13, .25], [19, .1]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: o, depthWrite: false, fog: false })); m.position.set(-70, 60, -200); m.lookAt(0, 0, 0); scene.add(m); } }
  const cloudRing = clouds({ min: 24, max: 95, below: -13, color: '#a9a2ea' }); scene.add(cloudRing);
  const land = island(19, 19, { round: true, rim: 4.6, seed: 11, props: 18, size: 1.8, flowers: 60, lamps: 6, grass: '#6fb476', patch: '#62a56c' }); land.position.y = -2.4; scene.add(land);
  const pfx = createFx(scene), shake = shaker();
  let flyIn = 0, punch = 0;

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const onRim = (r, k = 1, dx = 0) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * RX * k + dx, 0, Math.sin(a) * RZ * k); };
  const rel = i => me >= 0 ? (i - me + n) % n : i;
  const ringGeo = new THREE.TorusGeometry(.75, .05, 8, 40);
  function buildSeats(list) {
    for (const s of seats) { scene.remove(s.av, s.ring, s.stool, s.chips, s.cardsG); disposeAvatar(s.av); }
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), a = seatAngle(r), out = onRim(r, 1.32);
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !(me >= 0 && r === 0); scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 24), M(p.color, { roughness: .8 }), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.08, .1, 1.3, 8), M('#5a3019'), 0, -.75, 0, stool); toonify(stool, .035);
      stool.visible = av.visible;
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }), 0, 0, 0, scene);
      const rp = onRim(r, .8); ring.position.set(rp.x, .02, rp.z); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1, .8);
      const chips = new THREE.Group(); const cp = onRim(r, .6); chips.position.set(cp.x, .01, cp.z); scene.add(chips);
      const cardsG = new THREE.Group(); const hp = onRim(r, .8); cardsG.position.set(hp.x, .02, hp.z); cardsG.rotation.y = -a + Math.PI / 2; cardsG.scale.setScalar(.82); scene.add(cardsG); cardsG.updateMatrixWorld();
      return { av, stool, ring, chips, cardsG, cards: [], chipAmt: -1, a, hop: 0, nod: 0, active: false, look: 0, fold: false, key: '' };
    });
  }

  // ---------- cards ----------
  const cardGeo = new THREE.PlaneGeometry(CW, CH); cardGeo.rotateX(-Math.PI / 2);
  const backGeo = cardGeo.clone(); backGeo.rotateZ(Math.PI); backGeo.translate(0, -.004, 0);
  function makeCard(c) {
    const g = new THREE.Group();
    const front = new THREE.Mesh(cardGeo, toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(c >= 0 ? c : -1), roughness: .55 })));
    const back = new THREE.Mesh(backGeo, toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(-1), roughness: .55 })));
    front.castShadow = true; g.add(front, back); g.userData = { c, front };
    return g;
  }
  function setFace(card, c) { if (card.userData.c === c) return; card.userData.c = c; card.userData.front.material.map = cardTexture(c >= 0 ? c : -1); card.userData.front.material.needsUpdate = true; }

  const board = []; // 3D board cards
  const boardPos = k => new THREE.Vector3((k - 2) * (CW + .12), .02, -.15);
  const deckPos = new THREE.Vector3(0, .3, -.15);
  // Mango Poker: thrown-away cards gather face down in the middle, and the flop is dealt out of them
  const pilePos = new THREE.Vector3(0, .02, -.15), pile = [];
  function clearPile() { for (const c of pile) scene.remove(c); pile.length = 0; }

  // ---------- chips ----------
  const chipGeo = new THREE.CylinderGeometry(.2, .2, .07, 24);
  const chipMats = DENOM.map(([, c, e]) => { const t = chipTexture(c, e); return [M(c, { roughness: .4 }), M('#ffffff', { map: t, roughness: .4 }), M('#ffffff', { map: t, roughness: .4 })].map(toonMat); });
  function chipStack(amt, group) {
    while (group.children.length) group.remove(group.children[0]);
    let left = amt, col = 0, h = 0;
    const cols = [];
    for (let d = 0; d < DENOM.length && left > 0; d++) {
      const k = Math.min(10, Math.floor(left / DENOM[d][0])); left -= k * DENOM[d][0];
      for (let j = 0; j < k; j++) cols.push(d);
    }
    if (left > 0) cols.push(4);
    const per = Math.max(5, Math.ceil(cols.length / 3));
    cols.forEach((d, j) => {
      col = Math.floor(j / per); h = j % per;
      const m = new THREE.Mesh(chipGeo, chipMats[d]); m.castShadow = true;
      m.position.set((col - 1) * .44 + Math.sin(j * 7.3) * .02, .035 + h * .072, Math.cos(j * 3.1) * .02 + (col % 2) * .1); m.rotation.y = j;
      group.add(m);
    });
  }
  const pot = new THREE.Group(); pot.position.set(0, .01, -1.45); scene.add(pot); let potAmt = -1;
  const dealerBtn = new THREE.Group(); scene.add(dealerBtn);
  { const t = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#fff4e2'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill(); g.fillStyle = INK; g.font = '700 70px Fredoka, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('D', 64, 70); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; document.fonts?.ready.then(() => { g.fillStyle = '#fff4e2'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill(); g.fillStyle = INK; g.fillText('D', 64, 70); tx.needsUpdate = true; }); return tx; })();
    const b = put(new THREE.CylinderGeometry(.26, .26, .08, 28), [M('#e5543b'), M('#ffffff', { map: t }), M('#e5543b')].map(toonMat), 0, .045, 0, dealerBtn); b.castShadow = true; }

  // ---------- tweens & sparkles ----------
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });
  function sparkle(at, col = '#ffd27a', k = 14) {
    pfx.burst(at, { n: k + 6, colors: [col, '#ffffff', '#fff1a8'], speed: 3.5, up: 4.5, size: .28, life: 1 });
  }
  // a little flying stack of chips from one spot to another
  function flyChips(from, to, amt, delay = 0, done) {
    if (amt <= 0) { done?.(); return; }
    const g = new THREE.Group(); chipStack(Math.min(amt, 400), g); g.scale.setScalar(.85); g.visible = false; scene.add(g);
    tween(.55, t => { g.visible = true; const e = ease(t); g.position.lerpVectors(from, to, e); g.position.y += Math.sin(e * Math.PI) * 1.1; }, () => { scene.remove(g); pfx.puff(to, { n: 7, size: .22, speed: 1.6, life: .4 }); pfx.ring(to, { color: '#ffd84a', size: 1.2 }); if (amt >= 200) shake.kick(.06); done?.(); }, delay);
  }
  function flyCard(card, from, to, faceUp, delay = 0, done) {
    card.visible = false; card.rotation.z = faceUp ? 0 : Math.PI; card.userData.y = to.y;
    tween(.45, t => {
      if (card.userData.gone) return;
      card.visible = true; const e = ease(t);
      card.position.lerpVectors(from, to, e); card.position.y += Math.sin(e * Math.PI) * .8;
    }, done, delay);
  }
  function flip(card, toUp, delay = 0) {
    const from = card.rotation.z, to = toUp ? 0 : Math.PI;
    if (Math.abs(from - to) < .01) return;
    const y0 = () => card.userData.y ?? card.position.y; // where the card rests once it has landed
    tween(.4, t => { const e = ease(t); card.rotation.z = from + (to - from) * e; card.position.y = y0() + Math.sin(e * Math.PI) * .5; }, () => { card.position.y = y0(); }, delay);
  }

  // ---------- sync with the game ----------
  let last = null;
  function sync(S) {
    const list = S.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + S.me;
    if (key !== seatKey) {
      const meChanged = S.me !== me || list.length !== n;
      me = S.me; seatKey = key;
      if (meChanged || !seats.length) buildSeats(list);
      else list.forEach((p, i) => { // someone sat down in a bot's chair: swap just that avatar
        const s = seats[i], k = p.color + (p.av || []).join('');
        if (s.key && s.key !== k) { const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av); s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1; }
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
      last = null;
    }
    const fresh = !last || last.hand !== S.hand || last.gid !== S.gid;
    // dealer button sits just to the side of the dealer's chips
    if (S.dealer >= 0 && seats[S.dealer]) {
      const r = rel(S.dealer), a = seatAngle(r), p = onRim(r, .66);
      const to = new THREE.Vector3(p.x + Math.cos(a + Math.PI / 2) * .75, 0, p.z + Math.sin(a + Math.PI / 2) * .55);
      if (fresh && last) { const from = dealerBtn.position.clone(); tween(.6, t => { dealerBtn.position.lerpVectors(from, to, ease(t)); }); } else if (!last) dealerBtn.position.copy(to);
    }
    // board
    const bl = S.board.length;
    if (fresh || bl < board.length) { for (const c of board) scene.remove(c); board.length = 0; }
    if (fresh) clearPile();
    const k0 = board.length, fromPile = k0 === 0 && bl >= 3 && pile.length > 0;
    if (fromPile) { // the flop spreads out of the pile; the cards nobody got stay hidden and slide away
      for (const c of pile) { const from = c.position.clone(), to = new THREE.Vector3(0, .02, -1.0); tween(.5, t => { c.position.lerpVectors(from, to, ease(t)); c.scale.setScalar(1 - t * .8); }, () => scene.remove(c), .45); }
      pile.length = 0;
    }
    for (let k = k0; k < bl; k++) {
      const c = makeCard(S.board[k]), j = k - k0; scene.add(c); board.push(c);
      c.rotation.z = Math.PI; flyCard(c, fromPile && k < 3 ? pilePos.clone().setY(.06) : deckPos, boardPos(k), false, j * .12, () => pfx.sparkle(boardPos(k), { n: 4, colors: ['#fff1a8', '#ffffff'], r: .35, size: .18, life: .6 }));
      flip(c, true, .47 + j * .12);
    }
    // hole cards
    list.forEach((p, i) => {
      const s = seats[i];
      if (fresh) { for (const c of s.cards) s.cardsG.remove(c); s.cards = []; s.fold = false; }
      const want = p.cards?.length || 0;
      while (s.cards.length < want) {
        const k = s.cards.length, c = makeCard(p.cards[k]);
        c.rotation.z = Math.PI; s.cardsG.add(c); s.cards.push(c);
        const to = new THREE.Vector3((k - (want - 1) / 2) * .5, .01 + k * .01, 0);
        const from = s.cardsG.worldToLocal(deckPos.clone());
        const order = (rel(i) + n - (S.dealer >= 0 ? rel(S.dealer) : 0)) % n;
        flyCard(c, from, to, false, (k * n + order) * .07); c.rotation.y = (k - .5) * .12;
      }
      if (!fresh && s.cards.length > want && want > 0) { // Mango: one card thrown into the middle pile
        const c = s.cards.pop();
        const from = s.cardsG.localToWorld(c.position.clone()); s.cardsG.remove(c);
        setFace(c, -1); c.rotation.set(0, Math.random() * .8 - .4, Math.PI); c.scale.setScalar(.82); scene.add(c);
        const to = pilePos.clone().add(new THREE.Vector3((Math.random() - .5) * .25, .012 * pile.length, (Math.random() - .5) * .2));
        pile.push(c); flyCard(c, from, to, false);
        s.cards.forEach((h, k) => { const a = h.position.clone(), b = new THREE.Vector3((k - (want - 1) / 2) * .5, .01 + k * .01, 0); tween(.3, t => h.position.lerpVectors(a, b, ease(t)), null, .1); h.rotation.y = (k - .5) * .12; });
      }
      s.cards.forEach((c, k) => {
        const v = p.cards[k];
        if (v >= 0 && c.userData.c !== v) { setFace(c, v); flip(c, true, .1); }
        else if (v < 0 && c.userData.c >= 0) { setFace(c, -1); c.rotation.z = Math.PI; }
      });
      // my own cards stay in the HUD; in 3D they are hidden unless shown at the end
      const mine = me >= 0 && i === me;
      s.cardsG.visible = !mine;
      if (p.fold && !s.fold) { // fold: slide the cards into the middle and away
        s.fold = true; const cs = s.cards.slice();
        cs.forEach((c, k) => { c.userData.gone = true; const from = c.position.clone(), to = s.cardsG.worldToLocal(new THREE.Vector3(0, .02, -.4)); tween(.45, t => { c.position.lerpVectors(from, to, ease(t)); c.scale.setScalar(1 - t * .7); }, () => { c.visible = false; }, k * .05); });
        s.nod = 1;
      }
      // bets in front of each seat; when they shrink to 0 the chips slide into the pot
      if (s.chipAmt !== p.bet) {
        if (s.chipAmt > 0 && p.bet === 0 && !fresh) flyChips(s.chips.position.clone(), pot.position.clone(), s.chipAmt, i * .04);
        else if (p.bet > s.chipAmt && s.chipAmt >= 0 && !fresh) { const from = onRim(rel(i), 1.05); flyChips(from, s.chips.position.clone(), p.bet - Math.max(0, s.chipAmt), 0); }
        s.chipAmt = p.bet; chipStack(p.bet, s.chips);
      }
      s.active = S.turn === i;
    });
    // pot: everything already collected
    const collected = S.pot - list.reduce((a, p) => a + p.bet, 0);
    const showing = S.stage === 'show' && S.handRes;
    if (!showing && collected !== potAmt) { potAmt = collected; chipStack(collected, pot); }
    if (showing && !(last?.stage === 'show')) { // pay the winners
      const res = S.handRes.pots;
      setTimeout(() => {
        potAmt = 0; chipStack(0, pot);
        res.forEach((p, k) => p.win.forEach((w, j) => {
          const to = onRim(rel(w), .85);
          flyChips(pot.position.clone(), to, p.paid?.[j] ?? p.amt, k * .35 + j * .1, () => { seats[w].hop = 1; const top = seats[w].av.position.clone().add(new THREE.Vector3(0, 2.2, 0)); sparkle(top, '#ffd27a', 12); pfx.confetti(top, { n: k ? 30 : 70, w: 3.5, h: 2.5 }); if (!k && !j) { punch = 1; shake.kick(.12); } });
        }));
      }, S.handRes.fold ? 400 : 1400);
    }
    last = { hand: S.hand, gid: S.gid, stage: S.stage };
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, hudLeft = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, -.3);
  const DIR = new THREE.Vector3(0, 1.05, 1).normalize();
  const v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 175 : 120, bottom = h - hudBottom;
    const FIT = [new THREE.Vector3(0, 3.4, -RZ * 1.32), new THREE.Vector3(0, .3, RZ * 1.02), new THREE.Vector3(-(portrait ? RX * 1.12 : RX * 1.32 + 1.1), 1.2, 0), new THREE.Vector3(portrait ? RX * 1.12 : RX * 1.32 + 1.1, 1.2, 0)]; // phones: side players may peek in from the edges
    let lo = 5, hi = 90;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; place(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && lx + hudLeft / 2 >= hudLeft + 4 && rx + hudLeft / 2 <= w - 4) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 14; scene.fog.far = hi + 120;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, -hudLeft / 2, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastNow = 0;
  const tagV = new THREE.Vector3();
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
      // everyone glances at whoever is thinking
      let want = 0;
      if (turnSeat >= 0 && turnSeat !== i) { const d = ((rel(turnSeat) - rel(i) + n) % n) / n; want = d < .5 ? .5 : -.5; }
      s.look += (want - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop, look: s.look, nod: s.fold ? .35 + Math.sin(s.nod * Math.PI) * .4 : Math.sin(s.nod * Math.PI) });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.set(1 + Math.sin(T * 4) * .05, 1 + Math.sin(T * 4) * .05, .8);
    });
    bulbs.forEach((b, i) => b.scale.setScalar(1 + Math.sin(T * 2 + i) * .12));
    lamp.intensity = 4 + Math.sin(T * 1.3) * .2;
    punch = Math.max(0, punch - dt * 1.4);
    const zoom = 1 - Math.sin(Math.min(1, punch) * Math.PI) * .04; // a little push in when a pot is won
    camera.position.set(camBase.x * zoom + Math.sin(T * .22) * .18, camBase.y * zoom + Math.sin(T * .37) * .05, camBase.z * zoom);
    camera.lookAt(camLook); shake.apply(camera, dt);
    cloudRing.rotation.y = T * .005;
    flyIn -= dt; if (flyIn <= 0) { flyIn = .2; const a = Math.random() * 6.283, r = 7 + Math.random() * 7; pfx.rise(v.set(Math.cos(a) * r, -2 + Math.random() * 4, Math.sin(a) * r), { color: ['#fff1a8', '#d8ffb0'], size: .17, life: 3.2, speed: .22, wobble: .5, grow: 0 }); } // fireflies
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);
    // where the HUD should draw name tags, the pot label and the board
    const tags = seats.map((s, i) => {
      const r = rel(i), mine = me >= 0 && r === 0;
      tagV.copy(onRim(r, mine ? .98 : 1.32)); tagV.y = mine ? .2 : 2.35; tagV.project(camera);
      return { x: (tagV.x + 1) / 2 * W, y: (1 - tagV.y) / 2 * H, mine };
    });
    tagV.copy(pot.position); tagV.y = .1; tagV.project(camera);
    const potXY = { x: (tagV.x + 1) / 2 * W, y: (1 - tagV.y) / 2 * H };
    onFrame?.({ tags, pot: potXY });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    sync,
    hop(i) { if (seats[i]) seats[i].hop = 1; },
    nod(i) { if (seats[i]) seats[i].nod = 1; },
    sparkleAt(i, col) { const s = seats[i]; if (s) sparkle(s.av.position.clone().add(new THREE.Vector3(0, 2.2, 0)), col); },
    setInset(px) { if (px !== hudLeft) { hudLeft = px; resize(true); } }, // the open hand-rankings panel on the left
    setHud(px) { if (px !== hudBottom) { hudBottom = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) disposeAvatar(s.av);
      pfx.dispose(); renderer.dispose();
    },
  };
}

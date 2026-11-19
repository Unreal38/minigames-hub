// Hot Pot 3D table (three.js). Purely visual: the HUD owns the rules.
import * as THREE from 'three';
import { CATS, kindOf, catOf } from './rules.js';
import { iconSvg, backSvg } from './icons.js';

const INK = '#3b2219';
const TABLE_R = 4.4, POT_Y = .53, BROTH_Y = POT_Y + .52, BROTH_R = 1.47;
const SEAT = [[0, 5.7], [-5.7, 0], [0, -5.7], [5.7, 0]];
const rot = ([x, z], r) => { for (let i = 0; i < r; i++) [x, z] = [-z, x]; return [x, z]; };
const TILE = [0, 1, 2, 3].map(r => rot([1.0, 2.85], r));
const BOWL = [0, 1, 2, 3].map(r => rot([-.1, 3.75], r));
const DECK = [-1.15, 2.85];
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const back = t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// ---------- textures ----------
const svgImg = svg => new Promise(res => {
  const im = new Image();
  im.onload = () => res(im); im.onerror = () => res(null);
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
const texCache = new Map();
function cardTexture(kind) { // kind -1 = back
  if (texCache.has(kind)) return texCache.get(kind);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 352;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  texCache.set(kind, tex);
  const g = cv.getContext('2d');
  const paint = async () => {
    await document.fonts?.ready;
    g.clearRect(0, 0, 256, 352);
    if (kind < 0) {
      g.fillStyle = INK; rr(g, 0, 0, 256, 352, 34); g.fill();
      g.fillStyle = '#e5543b'; rr(g, 9, 9, 238, 334, 27); g.fill();
      g.strokeStyle = '#ffffff33'; g.lineWidth = 6; rr(g, 26, 26, 204, 300, 18); g.stroke();
      const im = await svgImg(backSvg('width="200" height="200"'));
      if (im) g.drawImage(im, 28, 76, 200, 200);
    } else {
      const cat = CATS[Math.floor(kind / 3)];
      g.fillStyle = INK; rr(g, 0, 0, 256, 352, 34); g.fill();
      g.fillStyle = '#fff4e2'; rr(g, 9, 9, 238, 334, 27); g.fill();
      g.save(); rr(g, 9, 9, 238, 334, 27); g.clip();
      g.fillStyle = cat.col; g.fillRect(0, 0, 256, 62); g.fillStyle = INK; g.fillRect(0, 62, 256, 8);
      g.restore();
      g.fillStyle = '#fff'; g.font = '600 32px Fredoka, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(cat.name, 128, 38);
      const im = await svgImg(iconSvg(kind, 'width="200" height="200"'));
      if (im) g.drawImage(im, 28, 76, 200, 200);
      g.fillStyle = INK; g.font = '600 31px Fredoka, Nunito, sans-serif';
      const name = cat.items[kind % 3];
      g.fillText(name, 128, 306, 228);
    }
    tex.needsUpdate = true;
  };
  paint();
  return tex;
}
function woodTexture(base = '#a8693f', ring = '#8a5230') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = ring; g.globalAlpha = .12 + Math.random() * .18; g.lineWidth = 1 + Math.random() * 4;
    g.beginPath(); g.ellipse(256 + Math.random() * 10, 256 + Math.random() * 10, i * 6 + Math.random() * 4, i * 6 + Math.random() * 6, 0, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function brothTexture() {
  const S = 512, R = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#c9351b'; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
  const grad = g.createRadialGradient(R * 1.4, R * .9, 10, R * 1.4, R * .9, R);
  grad.addColorStop(0, '#ff7a3d'); grad.addColorStop(1, '#c9351b00'); g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.fillStyle = '#f6e6c4';
  g.beginPath(); g.arc(R, R, R, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.beginPath(); g.arc(R, R / 2, R / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9351b'; g.beginPath(); g.arc(R, R * 1.5, R / 2, 0, Math.PI * 2); g.fill();
  const dots = (n, col, rx, test) => { for (let i = 0; i < n; i++) { const x = Math.random() * S, y = Math.random() * S; if (!test(x - R, y - R)) continue; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, rx * .6, Math.random() * 3, 0, 7); g.fill(); } };
  const red = (x, z) => isRed(x / R, z / R) && x * x + z * z < R * R * .9;
  const cream = (x, z) => !isRed(x / R, z / R) && x * x + z * z < R * R * .9;
  dots(70, '#8e1d10', 5, red); dots(40, '#ffb547', 3, red); dots(25, '#ff9a6a', 9, red);
  dots(30, '#6fbf5a', 5, cream); dots(22, '#d9402a', 4, cream); dots(40, '#fffaf0', 2.5, cream);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// unit coordinates (x, z in -1..1): is this point in the spicy half?
function isRed(x, z) {
  if (x * x + (z + .5) ** 2 < .25) return false;
  if (x * x + (z - .5) ** 2 < .25) return true;
  return x > 0;
}
function softDot() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// ---------- ingredient models ----------
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, ...o });
function ingredient(kind) {
  const cat = Math.floor(kind / 3), k = kind % 3;
  let m;
  if (cat === 0) { m = new THREE.Mesh(new THREE.BoxGeometry(.44, .04, .27), M(['#d9584a', '#f2a08e', '#c95a4c'][k])); }
  else if (cat === 1) {
    m = k === 0 ? new THREE.Mesh(new THREE.TorusGeometry(.13, .06, 8, 16, Math.PI * 1.4), M('#ff9a62'))
      : k === 1 ? new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), M('#fffaf0'))
        : new THREE.Mesh(new THREE.CylinderGeometry(.06, .11, .32, 12), M('#ffe1e6'));
    if (k !== 1) m.rotation.x = Math.PI / 2;
  } else if (cat === 2) { m = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), M(['#62bf55', '#2f9e4b', '#cfe58a'][k])); m.scale.set(1.1, .22, .7); }
  else if (cat === 3) {
    m = k === 1 ? new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#8f5a37'))
      : new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), M(k ? '#4e3329' : '#fff8ec'));
    if (k === 2) m.scale.set(1, .2, 1); if (k === 0) m.scale.set(.5, .5, 1.6);
  } else if (cat === 4) {
    m = k === 1 ? new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .07, 16), M('#fffdf7'))
      : new THREE.Mesh(new THREE.TorusGeometry(.14, k ? .022 : .045, 8, 20), M(k ? '#cfeef6' : '#fff1c7', k ? { transparent: true, opacity: .8 } : {}));
    if (k !== 1) m.rotation.x = Math.PI / 2; else m.scale.set(1.3, 1, .8);
  } else {
    m = k === 0 ? new THREE.Mesh(new THREE.BoxGeometry(.22, .2, .22), M('#fff6dc'))
      : new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 12), M(k === 1 ? '#fff8ea' : '#f6eadb'));
    if (k === 1) m.scale.set(1.3, .6, .8); if (k === 2) m.scale.set(.7, .85, .7);
  }
  const g = new THREE.Group(); g.add(m); return g;
}

// ---------- avatar ----------
function avatar(color) {
  const g = new THREE.Group(), body = M(color, { roughness: .7 }), skin = M('#ffe3c8', { roughness: .8 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.62, .7, 6, 18), body); torso.position.y = .1; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.6, 24, 18), skin); head.position.y = 1.5; head.castShadow = true;
  const bun = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), body); bun.position.set(0, 2.12, -.08);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.62, 24, 12, 0, Math.PI * 2, 0, Math.PI * .42), body); hair.position.y = 1.53; hair.rotation.x = -.35;
  const eyeM = M('#2a1712', { roughness: .3 }), blushM = new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: .7 });
  const parts = [torso, head, bun, hair];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), eyeM); eye.position.set(s * .2, 1.52, .54); eye.scale.set(1, 1.25, .6);
    const bl = new THREE.Mesh(new THREE.CircleGeometry(.1, 16), blushM); bl.position.set(s * .34, 1.36, .5); bl.rotation.y = s * .55;
    parts.push(eye, bl);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.07, .022, 6, 12, Math.PI), eyeM); mouth.position.set(0, 1.38, .58); mouth.rotation.z = Math.PI;
  parts.push(mouth);
  g.add(...parts);
  g.userData = { body, head };
  return g;
}

export function createScene(canvas, { onTile, onDeck, onLayout }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1422'); scene.fog = new THREE.Fog('#2a1422', 17, 36);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);

  // lights
  scene.add(new THREE.HemisphereLight('#ffe2c4', '#3a1a2c', 1.5));
  const key = new THREE.DirectionalLight('#ffe6c8', 2.1); key.position.set(5, 12, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  key.shadow.bias = -.0008; scene.add(key);
  const glow = new THREE.PointLight('#ff7a30', 5, 6, 1.5); glow.position.set(0, .7, 0); scene.add(glow);

  // floor + string lights
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), M('#24111c', { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.4; floor.receiveShadow = true; scene.add(floor);
  const bulbs = [];
  const bulbCols = ['#ffb547', '#ff8fab', '#7ed3b2', '#ffd27a', '#ff7a59'];
  [[-9, -7, 9, -7, 6.2], [-10, -3, -6, -10, 5.4], [6, -10, 10, -3, 5.6]].forEach(([x1, z1, x2, z2, y], li) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * 1.1, z1 + (z2 - z1) * t)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a0c14' })));
    pts.forEach((p, i) => {
      if (i % 2) return;
      const b = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), new THREE.MeshBasicMaterial({ color: bulbCols[(i / 2 + li) % 5] }));
      b.position.copy(p).y -= .16; scene.add(b); bulbs.push(b);
    });
    const l = new THREE.PointLight('#ffb070', 6, 14, 1.4); l.position.copy(pts[7]); scene.add(l);
  });

  // table
  const wood = woodTexture();
  const table = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - .1, .36, 72), [M('#7a4628'), M('#ffffff', { map: wood, roughness: .6 }), M('#7a4628')]);
  table.position.y = -.18; table.receiveShadow = true; scene.add(table);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, .1, 10, 80), M('#6e3c20')); rim.rotation.x = Math.PI / 2; scene.add(rim);
  const susan = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, .08, 64), M('#c4885a', { map: woodTexture('#c4885a', '#9a6440'), roughness: .5 }));
  susan.position.y = .04; susan.receiveShadow = true; scene.add(susan);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.1, 2.1, 24), M('#5a3019')); leg.position.y = -1.4; scene.add(leg);

  // burner + pot
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, .45, 32), M('#3a3438', { metalness: .4, roughness: .4 }));
  burner.position.y = .3; burner.castShadow = true; scene.add(burner);
  const flame = new THREE.Mesh(new THREE.TorusGeometry(1.08, .045, 8, 48), new THREE.MeshBasicMaterial({ color: '#7cc4ff' }));
  flame.rotation.x = Math.PI / 2; flame.position.y = .5; scene.add(flame);
  const prof = [[0, 0], [1.25, 0], [1.42, .06], [1.52, .22], [1.56, .62], [1.63, .68], [1.61, .75], [1.5, .73], [1.47, .6]].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M('#d3d7de', { metalness: .45, roughness: .28, side: THREE.DoubleSide }));
  pot.position.y = POT_Y; pot.castShadow = true; scene.add(pot);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(.22, .06, 8, 20, Math.PI), M('#c2c6cc', { metalness: .5, roughness: .3 }));
    h.position.set(s * 1.66, POT_Y + .6, 0); h.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); scene.add(h);
  }
  const broth = new THREE.Mesh(new THREE.CircleGeometry(BROTH_R, 64), new THREE.MeshStandardMaterial({ map: brothTexture(), roughness: .18, emissive: '#3a0e04', emissiveIntensity: .7 }));
  broth.rotation.x = -Math.PI / 2; broth.position.y = BROTH_Y; scene.add(broth);
  { // S-shaped divider
    const R = BROTH_R, pts = [];
    for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + i / 20 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * R / 2, BROTH_Y + .02, -R / 2 + Math.sin(a) * R / 2)); }
    for (let i = 1; i <= 20; i++) { const a = -Math.PI / 2 - i / 20 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * R / 2, BROTH_Y + .02, R / 2 + Math.sin(a) * R / 2)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .035, 8), M('#c9cdd4', { metalness: .5, roughness: .3 }));
    scene.add(tube);
  }

  // bubbles
  const bubRed = M('#ff7b5a', { roughness: .1, transparent: true, opacity: .85 }), bubCream = M('#fffaf0', { roughness: .1, transparent: true, opacity: .9 });
  const bubGeo = new THREE.SphereGeometry(.07, 10, 8), bubbles = [];
  const spawnBubble = b => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (BROTH_R - .15);
    b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.t = 0; b.dur = .6 + Math.random() * 1.2; b.size = .5 + Math.random() * .9;
    b.m.material = isRed(b.x / BROTH_R, b.z / BROTH_R) ? bubRed : bubCream;
    b.m.position.set(b.x, BROTH_Y, b.z);
  };
  for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(bubGeo, bubRed); scene.add(m); const b = { m }; spawnBubble(b); b.t = Math.random() * b.dur; bubbles.push(b); }
  let boil = 1;

  // steam
  const dot = softDot(), steam = [];
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#fff4e2', transparent: true, opacity: 0, depthWrite: false }));
    scene.add(s); steam.push({ s, t: Math.random() * 4, dur: 3 + Math.random() * 2, x: 0, z: 0 });
  }

  // floating ingredients
  const floaters = [];
  const addFloater = (kind, at) => {
    const g = ingredient(kind);
    const f = { g, a: Math.random() * 6.28, r: .35 + Math.random() * .8, sp: (.08 + Math.random() * .12) * (Math.random() < .5 ? -1 : 1), ph: Math.random() * 6, spin: (Math.random() - .5) * .8 };
    if (at) g.position.copy(at); scene.add(g); floaters.push(f);
    if (floaters.length > 26) { const old = floaters.shift(); scene.remove(old.g); }
    return f;
  };
  for (let i = 0; i < 10; i++) addFloater(Math.random() * 18 | 0);

  // seats: avatars, bowls, turn rings, tiles
  const seats = [0, 1, 2, 3].map(r => {
    const [x, z] = SEAT[r];
    const av = avatar('#ff8fab'); av.position.set(x, -.2, z); av.lookAt(0, -.2, 0); scene.add(av); av.visible = r !== 0;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#ff8fab', { side: THREE.DoubleSide, roughness: .4 }));
    const [bx, bz] = BOWL[r]; bowl.position.set(bx, .42, bz); bowl.castShadow = true; scene.add(bowl);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(.36, 24), M('#f6e6c4')); soup.rotation.x = -Math.PI / 2; soup.position.set(bx, .32, bz); scene.add(soup);
    const sticks = new THREE.Group();
    for (const o of [-.05, .05]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.018, .025, 1.05, 6), M('#e9c58f')); st.rotation.z = Math.PI / 2; st.position.z = o; sticks.add(st); }
    const [sx, sz] = rot([.75, 3.75], r); sticks.position.set(sx, .05, sz); sticks.rotation.y = -r * Math.PI / 2 + Math.PI / 2 + .25; scene.add(sticks);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(bx, .1, bz); scene.add(ring);
    // discard tile
    const [tx, tz] = TILE[r];
    const tile = new THREE.Group(); tile.position.set(tx, .08, tz); scene.add(tile);
    const stack = new THREE.Mesh(new THREE.BoxGeometry(.78, 1, 1.07), M('#efe3cf')); stack.castShadow = true; stack.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.1), new THREE.MeshStandardMaterial({ map: cardTexture(-1), roughness: .6, transparent: true }));
    top.rotation.x = -Math.PI / 2; top.userData.tile = r;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.32), new THREE.MeshBasicMaterial({ color: '#7ed3b2', transparent: true, opacity: 0 }));
    halo.rotation.x = -Math.PI / 2; halo.userData.tile = r;
    tile.add(stack, halo, top);
    return { av, bowl, ring, tile, stack, top, halo, c: -2, n: 0, pending: 0, hop: 0, take: false, hover: 0 };
  });

  // deck
  const deck = new THREE.Group(); deck.position.set(DECK[0], .08, DECK[1]); deck.rotation.y = .12; scene.add(deck);
  const deckBox = new THREE.Mesh(new THREE.BoxGeometry(.78, 1, 1.07), M('#c43e27')); deckBox.castShadow = true;
  const deckTop = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.1), new THREE.MeshStandardMaterial({ map: cardTexture(-1), roughness: .6, transparent: true }));
  deckTop.rotation.x = -Math.PI / 2; deckTop.userData.deck = true;
  const deckHalo = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.32), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0 }));
  deckHalo.rotation.x = -Math.PI / 2; deckHalo.userData.deck = true;
  deck.add(deckBox, deckHalo, deckTop);
  let deckActive = false, deckHover = 0, deckCount = 40;
  const setStack = (box, topM, halo, n) => {
    const h = .015 + Math.min(n, 40) * .006; box.scale.y = h; box.position.y = h / 2; topM.position.y = h + .002; halo.position.y = .004;
  };
  setStack(deckBox, deckTop, deckHalo, deckCount);

  // ---------- tweens ----------
  const tweens = [];
  const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });

  const handPos = r => r === 0 ? new THREE.Vector3(0, 2.6, 6.2) : new THREE.Vector3(SEAT[r][0] * .78, 1.4, SEAT[r][1] * .78);
  const tilePos = r => new THREE.Vector3(TILE[r][0], .1 + seats[r].top.position.y, TILE[r][1]);
  const deckPos = () => new THREE.Vector3(DECK[0], .1 + deckTop.position.y, DECK[1]);

  function flyCard(from, to, kind, faceUp, delay = 0, done) {
    const g = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.1), new THREE.MeshStandardMaterial({ map: cardTexture(kind), roughness: .6, transparent: true }));
    const backM = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.1), new THREE.MeshStandardMaterial({ map: cardTexture(-1), roughness: .6, transparent: true }));
    backM.rotation.y = Math.PI; g.add(front, backM); g.visible = false; scene.add(g);
    const lift = 1.2 + from.distanceTo(to) * .12;
    const r0 = faceUp ? -Math.PI / 2 + 1.1 : Math.PI / 2, r1 = faceUp ? -Math.PI / 2 : Math.PI / 2 - .6;
    let wait = delay;
    tween(.55 + delay, t => {
      const tt = (t * (.55 + delay) - wait) / .55; if (tt < 0) return; g.visible = true;
      const e = ease(Math.min(1, tt));
      g.position.lerpVectors(from, to, e); g.position.y += Math.sin(e * Math.PI) * lift;
      g.rotation.set(r0 + (r1 - r0) * e, 0, Math.sin(e * Math.PI) * .5);
    }, () => { scene.remove(g); front.material.dispose(); backM.material.dispose(); front.geometry.dispose(); done?.(); });
  }
  function squash(obj) { tween(.35, t => { const s = 1 + Math.sin(t * Math.PI) * .18 * (1 - t); obj.scale.set(s, 1, s); }, () => obj.scale.set(1, 1, 1)); }
  function puff(at, n = 6, big = 1) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#fff4e2', transparent: true, opacity: .5, depthWrite: false }));
      const a = i / n * 6.28; s.position.copy(at); scene.add(s);
      tween(.7, t => { s.position.set(at.x + Math.cos(a) * t * .9 * big, at.y + t * .5, at.z + Math.sin(a) * t * .9 * big); s.scale.setScalar((.3 + t * .8) * big); s.material.opacity = .55 * (1 - t); }, () => { scene.remove(s); s.material.dispose(); });
    }
  }
  function hopIngredient(kind, from, delay) {
    setTimeout(() => {
      const f = addFloater(kind, from.clone()); const g = f.g; f.flying = true;
      const to = new THREE.Vector3(Math.cos(f.a) * f.r, BROTH_Y + .02, Math.sin(f.a) * f.r);
      tween(.7, t => { const e = ease(t); g.position.lerpVectors(from, to, e); g.position.y += Math.sin(e * Math.PI) * 2.2; g.rotation.x = e * 6; },
        () => { f.flying = false; puff(to, 5, .6); boil = 3; });
    }, delay);
  }

  // ---------- input ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const pickables = () => [...seats.flatMap(s => [s.top, s.halo]), deckTop, deckHalo];
  function pick(e) {
    const rc = canvas.getBoundingClientRect();
    ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables(), false)[0];
    if (!hit) return null;
    if (hit.object.userData.deck) return deckActive ? { deck: true } : null;
    const r = hit.object.userData.tile;
    return seats[r]?.take ? { tile: r } : null;
  }
  let hover = null;
  const onMove = e => {
    hover = pick(e);
    canvas.style.cursor = hover ? 'pointer' : '';
  };
  const onClick = e => { const h = pick(e); if (h?.deck) onDeck(); else if (h) onTile(h.tile); };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);

  // ---------- sizing & camera: fit the table between the top bar and the hand ----------
  let W = 0, H = 0, camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, 0), shake = 0;
  const DIR = new THREE.Vector3(0, 1, 1.1).normalize();
  const FIT = [[0, 2.4, -5.7], [0, 0, 4.7], [-6.3, 1.6, 0], [6.3, 1.6, 0]].map(p => new THREE.Vector3(...p));
  const v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const mobile = w < 760, portrait = w / h < 1;
    const cw = mobile ? Math.min(Math.max(w * .106, 40), 64) : Math.min(Math.max(w * .074, 56), 104);
    const top = mobile ? 172 : 58, bottom = h - (cw * 1.38 + 40) - (mobile ? 74 : 10);
    camera.aspect = w / h; camera.fov = portrait ? 46 : 36;
    camera.clearViewOffset(); camera.updateProjectionMatrix();
    let lo = 5, hi = 80;
    for (let i = 0; i < 30; i++) {
      const D = (lo + hi) / 2; place(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]);
      if (fy - ty <= bottom - top && lx >= 6) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    const off = (ty + fy) / 2 - (top + bottom) / 2;
    camera.setViewOffset(w, h, 0, off, w, h); camera.updateProjectionMatrix();
    // tell the HUD where the avatars are, so name tags sit under them
    const pts = [0, 1, 2, 3].map(r => {
      const [x, z] = SEAT[r];
      const [px, py] = toPx(new THREE.Vector3(x, r === 2 ? 2.4 : -.4, z));
      return { x: px, y: py - (r === 2 ? 0 : 0) };
    });
    onLayout?.(pts, { w, h });
  }

  // ---------- loop ----------
  const clock = new THREE.Clock(); let raf = 0, T = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    resize();
    const dt = Math.min(clock.getDelta(), .05); T += dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; tw.t += dt; const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i, 1); tw.done?.(); }
    }
    boil = Math.max(1, boil - dt * .8);
    for (const b of bubbles) {
      b.t += dt * boil;
      if (b.t >= b.dur) spawnBubble(b);
      const p = b.t / b.dur, s = p < .8 ? p / .8 * b.size : b.size * (1 + (p - .8) * 4) * (1 - (p - .8) * 5);
      b.m.scale.setScalar(Math.max(.001, s)); b.m.position.y = BROTH_Y + s * .03;
    }
    for (const st of steam) {
      st.t += dt * (.7 + boil * .3);
      if (st.t >= st.dur) { st.t = 0; st.dur = 3 + Math.random() * 2; const a = Math.random() * 6.28, r = Math.random() * 1.1; st.x = Math.cos(a) * r; st.z = Math.sin(a) * r; }
      const p = st.t / st.dur;
      st.s.position.set(st.x + Math.sin(T * .7 + st.dur) * .25 * p, BROTH_Y + .1 + p * 3.4, st.z);
      st.s.scale.setScalar(.7 + p * 2.2); st.s.material.opacity = Math.sin(p * Math.PI) * .2 * Math.min(boil, 1.8);
    }
    for (const f of floaters) {
      if (f.flying) continue;
      f.a += f.sp * dt;
      f.g.position.set(Math.cos(f.a) * f.r, BROTH_Y + .03 + Math.sin(T * 1.6 + f.ph) * .025, Math.sin(f.a) * f.r);
      f.g.rotation.y += f.spin * dt;
    }
    seats.forEach((s, r) => {
      s.hop = Math.max(0, s.hop - dt * 2.2);
      s.av.position.y = -.2 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .5 * s.hop + (s.active ? Math.abs(Math.sin(T * 3)) * .08 : 0);
      s.av.userData.head.rotation.z = Math.sin(T * 1.3 + r) * .06;
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1 + Math.sin(T * 4) * .05);
      const hv = hover?.tile === r; s.hover += ((hv ? 1 : 0) - s.hover) * .2;
      s.halo.material.opacity += ((s.take ? .55 + Math.sin(T * 5) * .3 : 0) - s.halo.material.opacity) * .2;
      s.tile.position.y = .08 + (s.take ? .06 + Math.sin(T * 4 + r) * .04 : 0) + s.hover * .12;
      s.tile.scale.x = s.tile.scale.z = 1 + s.hover * .1;
    });
    const dh = hover?.deck ? 1 : 0; deckHover += (dh - deckHover) * .2;
    deckHalo.material.opacity += ((deckActive ? .6 + Math.sin(T * 5) * .3 : 0) - deckHalo.material.opacity) * .2;
    deck.position.y = .08 + (deckActive ? .05 + Math.sin(T * 4) * .04 : 0) + deckHover * .14;
    bulbs.forEach((b, i) => b.scale.setScalar(1 + Math.sin(T * 2 + i) * .12));
    glow.intensity = 4.5 + Math.sin(T * 7) * .6 + Math.sin(T * 11.3) * .4;
    shake = Math.max(0, shake - dt * 2);
    camera.position.set(camBase.x + Math.sin(T * .25) * .2 + (Math.random() - .5) * shake * .3, camBase.y + Math.sin(T * .4) * .06, camBase.z);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  };
  loop();

  // ---------- API ----------
  return {
    setSeats(list, turnRel) {
      list.forEach((p, r) => {
        const s = seats[r];
        s.av.userData.body.color.set(p.color); s.bowl.material.color.set(p.color);
        s.active = r === turnRel;
      });
    },
    setTiles(list) {
      list.forEach((t, r) => {
        const s = seats[r];
        s.n = t.n; setStack(s.stack, s.top, s.halo, t.n);
        s.stack.visible = t.n > 0;
        if (t.c !== s.c) { s.c = t.c; s.top.material.map = cardTexture(t.c >= 0 ? kindOf(t.c) : -1); s.top.material.needsUpdate = true; }
        s.top.visible = t.c >= 0 && !s.pending;
      });
    },
    setInteract({ tiles, deck: d, deckCount: n }) {
      seats.forEach((s, r) => { s.take = tiles.has(r); });
      deckActive = d;
      if (n !== deckCount) { deckCount = n; setStack(deckBox, deckTop, deckHalo, n); deck.visible = n > 0; }
    },
    // from/to: 'deck' | 'tileN' | seat rel number
    fly(from, to, c, faceUp) {
      const P = x => x === 'deck' ? deckPos() : typeof x === 'string' ? tilePos(+x.slice(4)) : handPos(x);
      const kind = c >= 0 ? kindOf(c) : -1;
      const toTile = typeof to === 'string' && to.startsWith('tile') ? seats[+to.slice(4)] : null;
      if (toTile) { toTile.pending++; toTile.top.visible = false; }
      flyCard(P(from), P(to), kind, faceUp && kind >= 0, 0, () => {
        if (toTile) {
          toTile.pending = Math.max(0, toTile.pending - 1);
          if (!toTile.pending && toTile.c >= 0) toTile.top.visible = true;
          squash(toTile.tile); puff(tilePos(+to.slice(4)), 6, .5);
        }
      });
    },
    hop(r) { seats[r].hop = 1; },
    deal() { for (let i = 0; i < 16; i++) flyCard(deckPos(), handPos(i % 4), -1, false, i * .05); },
    celebrate(r, hand) {
      const from = r === 0 ? new THREE.Vector3(0, 1.4, 4.4) : handPos(r);
      (hand.length ? hand : Array.from({ length: 9 }, () => Math.random() * 72 | 0)).forEach((c, i) => hopIngredient(kindOf(c), from, i * 110));
      seats[r].hop = 1; setTimeout(() => { seats[r].hop = 1; }, 600);
      shake = 1; boil = 4;
      setTimeout(() => puff(new THREE.Vector3(0, BROTH_Y + .2, 0), 14, 2), 1000);
    },
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick);
      renderer.dispose();
    },
  };
}

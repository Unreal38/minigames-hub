// Pictures of the table themes (card back, dice, golf ball, kart paint) for the Your style pop-up.
// The game code that paints the real things is loaded only when a picture is first asked for; each picture is drawn once.
const shots = new Map(); // key -> data URL ('' when it could not be drawn)
let kit = null;
const keyOf = (k, i, color, av) => k + '|' + (i | 0) + (k === 'kp' || k === 'cu' || k === 'cs' || k === 'ck' || k === 'dt' || k === 'bt' || (k === 'gb' && !(i | 0)) ? '|' + color : '') + (k === 'kp' ? '|' + (av || []).join('') : '');
export const skinPicNow = (k, i, color, av) => shots.get(keyOf(k, i, color, av)) || '';

function cv2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const INK = '#3b2219';
function cardPic(i, { paintBack }) {
  const [c, g] = cv2d(240, 240);
  const one = (x, y, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = INK; rr(g, -62, -86, 124, 172, 16); g.fill();
    g.save(); rr(g, -56, -80, 112, 160, 11); g.clip(); g.translate(-56, -80); paintBack(g, 112, 160, i); g.restore();
    g.fillStyle = '#fff4e2'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.fill(); g.stroke(); g.restore(); };
  one(92, 126, -.22); one(150, 120, .16);
  return c.toDataURL('image/png');
}
async function shot3d(build, size = 240) {
  const THREE = await import('three');
  const R = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(size, size, false);
  const S = new THREE.Scene(), C = new THREE.PerspectiveCamera(30, 1, .1, 60);
  S.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9)); const l = new THREE.DirectionalLight('#ffffff', 1.6); l.position.set(3, 6, 4); S.add(l);
  let after = null;
  try {
    const b = await build(THREE), { g, dir, zoom = 1 } = b; after = b.after; S.add(g);
    const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), d = box.getSize(new THREE.Vector3()).length() / 2 / Math.sin(15 * Math.PI / 180) * zoom;
    C.position.set(ctr.x + d * dir[0], ctr.y + d * dir[1], ctr.z + d * dir[2]); C.lookAt(ctr);
    R.render(S, C); return R.domElement.toDataURL('image/png');
  } finally { S.traverse(o => { o.geometry?.dispose?.(); }); after?.(); R.dispose(); R.forceContextLoss?.(); }
}
// two of the real 3D dice, one showing five and one showing three
const dicePic = i => shot3d(async THREE => {
  const { diceKit } = await import('./dice3d.js'), kit = diceKit(), g = new THREE.Group();
  const UP = { 5: [0, 0, -Math.PI / 2], 3: [Math.PI / 2, 0, 0] }; // with the kit's default sides
  for (const [v, x, z, yaw] of [[5, -.62, .2, .5], [3, .66, -.25, -.45]]) {
    const m = new THREE.Mesh(), ink = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })); ink.scale.setScalar(1.08); m.add(ink);
    kit.dress(m, i, 1); m.rotation.set(...UP[v]); m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), yaw); m.position.set(x, .5, z); g.add(m);
  }
  return { g, dir: [.2, .62, .76], zoom: .8, after: () => kit.dispose() };
});
const ballPic = (i, color, { ballLook }) => shot3d(async THREE => {
  const g = new THREE.Group(), look = ballLook(i, color);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshToonMaterial({ color: look.color, map: look.map })); ball.rotation.y = -Math.PI / 2 + .5;
  const ink = new THREE.Mesh(new THREE.SphereGeometry(1.07, 28, 20), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  g.add(ball, ink); return { g, dir: [.25, .35, .9], zoom: .95 };
});
const kartPic = (i, color, av) => shot3d(async () => {
  const { makeKart } = await import('./games/kart/scene3d.js'), K = makeKart(color, av, i);
  K.bub.removeFromParent(); return { g: K.root, dir: [.62, .36, .7], zoom: .98 };
});
// a cue lying across the picture, tip up and to the right
const cuePic = (i, color, { cueMeshes }) => shot3d(async THREE => {
  const g = new THREE.Group(), c = new THREE.Group(); for (const m of cueMeshes(i, color)) c.add(m);
  c.scale.set(1, 3.2, 3.2); c.rotation.z = -.62; g.add(c); // fattened so the pattern reads at this size
  return { g, dir: [0, .12, 1], zoom: .78 };
});
// the light king and the dark knight of a chess set
const chessPic = (i, color) => shot3d(async THREE => {
  const { pieceModel } = await import('./games/chess/scene3d.js'), g = new THREE.Group();
  const k = pieceModel(6, 0, color, i), n = pieceModel(2, 1, '#7a5a4a', i); k.position.set(-.36, 0, -.1); n.position.set(.4, 0, .22); n.rotation.y = -.5; g.add(k, n);
  return { g, dir: [.1, .32, .94], zoom: .82 };
});
// a light king standing behind a dark man of a checkers set
const checkersPic = (i, color) => shot3d(async THREE => {
  const { pieceModel } = await import('./games/warcaby/scene3d.js'), g = new THREE.Group(), U = 1.25;
  const k = pieceModel(true, 0, color, i, U), m = pieceModel(false, 1, '#7a5a4a', i, U); k.position.set(-.32, 0, -.22); m.position.set(.36, 0, .3); g.add(k, m);
  return { g, dir: [.05, .62, .78], zoom: .96 };
});
// two domino tiles drawn flat: 6-4 and the double three
async function dominoPic(i) {
  const { dominoLook, paintDominoHalf } = await import('./pieceskins.js'), L = dominoLook(i), [c, g] = cv2d(240, 240);
  const one = (x, y, rot, a, b) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = INK; rr(g, -45, -85, 90, 170, 18); g.fill();
    g.save(); rr(g, -39, -79, 78, 158, 13); g.clip(); g.fillStyle = L.face; g.fillRect(-39, -79, 78, 158);
    g.save(); g.translate(-39, -79); paintDominoHalf(g, 78, a, i); g.translate(0, 80); paintDominoHalf(g, 78, b, i); g.restore();
    g.strokeStyle = L.bar; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.stroke(); g.restore(); g.restore(); };
  one(84, 128, -.2, 6, 4); one(164, 118, .16, 3, 3);
  return c.toDataURL('image/png');
}
// two Word Reef tiles, an R and a F, in that set's colours
async function reefPic(i) {
  const { reefLook, paintReefMotif } = await import('./pieceskins.js'), L = reefLook(i), [c, g] = cv2d(240, 240);
  const one = (x, y, rot, l, v) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = INK; rr(g, -64, -64, 128, 136, 22); g.fill(); g.fillStyle = L.body; rr(g, -58, -58, 116, 124, 17); g.fill();
    g.fillStyle = L.face; rr(g, -58, -58, 116, 112, 17); g.fill(); g.save(); g.translate(-58, -58); paintReefMotif(g, 116, i); g.restore();
    g.fillStyle = L.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 70px Rubik, Arial, sans-serif'; g.fillText(l, -6, 2); g.font = '700 26px Rubik, Arial, sans-serif'; g.fillText(v, 36, 34); g.restore(); };
  one(82, 108, -.16, 'R', '1'); one(162, 138, .12, 'F', '4');
  return c.toDataURL('image/png');
}
// the lantern itself, bobbing in the air
const lanternPic = i => shot3d(async THREE => {
  const { lanternModel } = await import('./pieceskins.js'), { toonify } = await import('./scenery3d.js'), g = lanternModel(THREE, i); toonify(g, .03);
  return { g, dir: [.25, .3, .92], zoom: .92 };
});
// a pop seed beside its blast: the seed, with a ring of the blast's own bits round it
const seedPic = i => shot3d(async THREE => {
  const { seedModel, seedLook } = await import('./pieceskins.js'), { toonify } = await import('./scenery3d.js'), L = seedLook(i), g = new THREE.Group();
  const s = seedModel(THREE, i); s.position.y = -.38; g.add(s);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .12), new THREE.MeshBasicMaterial({ color: L.bits[k % L.bits.length] })); b.position.set(Math.cos(a) * .48, Math.sin(a) * .4, -.1); b.rotation.set(a, a, 0); b.userData.noInk = true; g.add(b); }
  toonify(g, .03);
  return { g, dir: [.2, .35, .92], zoom: .9 };
});
// three Pet Herds tiles in that set's look: a 7, a 7 and a Mystery Egg
async function herdPic(i) {
  const { herdLook } = await import('./pieceskins.js'), { paintTile, petImage } = await import('./games/herd/tiles.js'), [c, g] = cv2d(240, 240);
  const ids = [6, 19, 104], pets = await Promise.all(ids.map(t => (t < 104 ? petImage(['cindercub', 'zapkit'][t / 13 | 0]) : null)));
  const face = document.createElement('canvas'); face.width = 128; face.height = 170; const f = face.getContext('2d'), L = herdLook(i);
  [[62, 128, -.18], [120, 118, 0], [178, 128, .18]].forEach(([x, y, rot], n) => {
    paintTile(f, ids[n], pets[n], i);
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = INK; rr(g, -33, -44, 66, 92, 11); g.fill(); g.fillStyle = L.body; rr(g, -29, -40, 58, 84, 8); g.fill();
    g.save(); rr(g, -29, -40, 58, 78, 8); g.clip(); g.drawImage(face, -29, -40, 58, 78); g.restore(); g.restore();
  });
  return c.toDataURL('image/png');
}
// the slingshot, a little turned
const slingPic = i => shot3d(async THREE => {
  const { slingModel } = await import('./pieceskins.js'), { toonify } = await import('./scenery3d.js'), g = slingModel(THREE, i), [a, b] = g.userData.tips, S = g.userData.look;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1, 5), new THREE.MeshStandardMaterial({ color: S.band })); const mid = new THREE.Vector3(0, .12, .02);
  for (const t of [a, b]) { const m = band.clone(), d = mid.clone().sub(t); m.scale.y = d.length(); m.position.copy(t).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m); }
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(.1, .06, .05), new THREE.MeshStandardMaterial({ color: S.pouch })); pouch.position.copy(mid); g.add(pouch);
  toonify(g, .02); g.rotation.set(0, .5, -.15);
  return { g, dir: [.2, .15, .97], zoom: .85 };
});
// three darts in that skin, flights in the player's colour
const dartPic = (i, color) => shot3d(async THREE => {
  const { dartLook } = await import('./pieceskins.js'), { toonify } = await import('./scenery3d.js'), D = dartLook(i), g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .5, flatShading: true });
  const one = (x, rz) => { const d = new THREE.Group(); d.position.x = x; d.rotation.z = rz; g.add(d); const add = (geo, c, y) => { const m = new THREE.Mesh(geo, M(c)); m.position.y = y; d.add(m); return m; };
    add(new THREE.ConeGeometry(.05, .3, 6), D.tip, -.75).rotation.x = Math.PI; add(new THREE.CylinderGeometry(.09, .075, .6, 8), D.barrel, -.3);
    if (D.band) for (const y of [-.45, -.15]) add(new THREE.CylinderGeometry(.095, .095, .07, 8), D.band, y);
    add(new THREE.CylinderGeometry(.04, .04, .4, 6), D.shaft, .2);
    for (let n = 0; n < 2; n++) { const f = D.flight === 'feather' ? add(new THREE.BoxGeometry(.3, .7, .02), color, .52) : D.flight === 'fin' ? add(new THREE.ConeGeometry(.32, .45, 3), color, .4) : D.flight === 'heart' ? add(new THREE.OctahedronGeometry(.25), color, .45) : add(new THREE.BoxGeometry(.5, .42, .02), color, .45);
      if (D.flight === 'fin') f.scale.z = .08; else if (D.flight === 'heart') f.scale.set(1, 1.1, .1); f.rotation.y = n * Math.PI / 2; } };
  one(-.45, .35); one(0, 0); one(.45, -.35); toonify(g, .03);
  return { g, dir: [.15, .1, .98], zoom: .9 };
});
// the bopper itself, leaning over
const bopperPic = i => shot3d(async THREE => {
  const { bopperModel } = await import('./pieceskins.js'), { toonify } = await import('./scenery3d.js'), g = bopperModel(THREE, i, c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true }));
  g.rotation.z = -.6; toonify(g, .04); const w = new THREE.Group(); w.add(g);
  return { g: w, dir: [.3, .25, .92], zoom: .85 };
});
// a two-square boat in that skin, trim and flag in the player's colour
const boatPic = (i, color) => shot3d(async THREE => {
  const { boatLook } = await import('./pieceskins.js'), { toonify } = await import('./scenery3d.js'), S = boatLook(i), g = new THREE.Group();
  const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true });
  const box = (w, h, d, c, x, y, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); g.add(m); return m; };
  const L = 1.72, W = .62, H = .3, hull = S.hull || shade(color, .72);
  box(L, H, W, hull, 0, H / 2 - .06); const bow = box(.44, H, .44, hull, L / 2, H / 2 - .06); bow.rotation.y = Math.PI / 4; bow.scale.z = .7;
  box(L + .06, .07, W + .06, color, 0, H - .07); box(L - .16, .03, W - .2, S.deck, 0, H - .02);
  const cx = -L / 2 + .42; box(.46, .3, .4, S.cabin, cx, H + .15); box(.54, .08, .48, S.roof || color, cx, H + .34);
  const mx = L / 2 - .34; box(.05, .5, .05, '#8a5a3c', mx, H + .25); box(.22, .14, .03, color, mx - .13, H + .43);
  if (S.bow === 'skull') { box(.05, .26, .05, '#8a5a3c', cx, H + .5); box(.26, .18, .03, '#1c1820', cx - .15, H + .56); box(.08, .07, .035, '#ffffff', cx - .15, H + .58); }
  if (S.bow === 'duck') { const hx = L / 2 + .1; box(.22, .26, .22, hull, hx, H + .2); box(.14, .06, .12, '#ff8a2a', hx + .16, H + .17); }
  if (S.bow === 'dragon') { const hx = L / 2 + .1; box(.08, .4, .1, hull, hx, H + .2); box(.2, .12, .12, hull, hx + .08, H + .42); box(.06, .06, .14, '#ffc93c', hx + .1, H + .5);
    for (let x = -L / 2 + .3; x < L / 2 - .5; x += .3) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .03, 8), M('#fff4e2')); s.rotation.x = Math.PI / 2; s.position.set(x, H - .02, W / 2 + .02); g.add(s); } }
  toonify(g, .03);
  return { g, dir: [.35, .5, .8], zoom: 1.05 };
});
export async function skinPic(k, i, color, av) {
  const key = keyOf(k, i, color, av); if (shots.has(key)) return shots.get(key);
  let u = '';
  try {
    const sk = await (kit ||= import('./skins.js'));
    u = k === 'cb' ? cardPic(i | 0, sk) : k === 'dc' ? await dicePic(i | 0) : k === 'gb' ? await ballPic(i | 0, color, sk) : k === 'kp' ? await kartPic(i | 0, color, av) : k === 'cu' ? await cuePic(i | 0, color, sk) : k === 'cs' ? await chessPic(i | 0, color) : k === 'ck' ? await checkersPic(i | 0, color) : k === 'dm' ? await dominoPic(i | 0) : k === 'rt' ? await reefPic(i | 0) : k === 'ln' ? await lanternPic(i | 0) : k === 'bs' ? await seedPic(i | 0) : k === 'ht' ? await herdPic(i | 0) : k === 'sl' ? await slingPic(i | 0) : k === 'dt' ? await dartPic(i | 0, color) : k === 'bb' ? await bopperPic(i | 0) : k === 'bt' ? await boatPic(i | 0, color) : '';
  } catch (e) { console.warn('no theme picture', k, e); }
  shots.set(key, u); return u;
}

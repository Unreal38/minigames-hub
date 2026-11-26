// Pictures of the table themes (card back, dice, golf ball, kart paint) for the Your style pop-up.
// The game code that paints the real things is loaded only when a picture is first asked for; each picture is drawn once.
const shots = new Map(); // key -> data URL ('' when it could not be drawn)
let kit = null;
const keyOf = (k, i, color, av) => k + '|' + (i | 0) + (k === 'kp' || k === 'cu' || k === 'cs' || k === 'ck' || (k === 'gb' && !(i | 0)) ? '|' + color : '') + (k === 'kp' ? '|' + (av || []).join('') : '');
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
export async function skinPic(k, i, color, av) {
  const key = keyOf(k, i, color, av); if (shots.has(key)) return shots.get(key);
  let u = '';
  try {
    const sk = await (kit ||= import('./skins.js'));
    u = k === 'cb' ? cardPic(i | 0, sk) : k === 'dc' ? await dicePic(i | 0) : k === 'gb' ? await ballPic(i | 0, color, sk) : k === 'kp' ? await kartPic(i | 0, color, av) : k === 'cu' ? await cuePic(i | 0, color, sk) : k === 'cs' ? await chessPic(i | 0, color) : k === 'ck' ? await checkersPic(i | 0, color) : k === 'dm' ? await dominoPic(i | 0) : k === 'rt' ? await reefPic(i | 0) : k === 'ln' ? await lanternPic(i | 0) : k === 'bs' ? await seedPic(i | 0) : k === 'ht' ? await herdPic(i | 0) : '';
  } catch (e) { console.warn('no theme picture', k, e); }
  shots.set(key, u); return u;
}

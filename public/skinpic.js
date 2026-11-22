// Pictures of the table themes (card back, dice, golf ball, kart paint) for the Your style pop-up.
// The game code that paints the real things is loaded only when a picture is first asked for; each picture is drawn once.
const shots = new Map(); // key -> data URL ('' when it could not be drawn)
let kit = null;
const keyOf = (k, i, color, av) => k + '|' + (i | 0) + (k === 'kp' || (k === 'gb' && !(i | 0)) ? '|' + color : '') + (k === 'kp' ? '|' + (av || []).join('') : '');
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
function dicePic(i, { diceTint }) {
  const [c, g] = cv2d(240, 240), tint = diceTint(i) || '#fffaf0';
  const PIPS = { 3: [[-1, -1], [0, 0], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]] };
  const one = (x, y, rot, v, s) => { g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,.16)'; rr(g, -s / 2 + 5, -s / 2 + 9, s, s, s * .22); g.fill();
    g.fillStyle = tint; g.strokeStyle = INK; g.lineWidth = 6; rr(g, -s / 2, -s / 2, s, s, s * .22); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; rr(g, -s / 2 + 9, -s / 2 + 8, s * .5, s * .16, s * .08); g.fill();
    g.fillStyle = INK; for (const [px, py] of PIPS[v]) { g.beginPath(); g.arc(px * s * .26, py * s * .26, s * .085, 0, 7); g.fill(); } g.restore(); };
  one(88, 138, -.2, 5, 96); one(160, 96, .24, 3, 84);
  return c.toDataURL('image/png');
}
async function shot3d(build, size = 240) {
  const THREE = await import('three');
  const R = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(size, size, false);
  const S = new THREE.Scene(), C = new THREE.PerspectiveCamera(30, 1, .1, 60);
  S.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9)); const l = new THREE.DirectionalLight('#ffffff', 1.6); l.position.set(3, 6, 4); S.add(l);
  try {
    const { g, dir, zoom = 1 } = await build(THREE); S.add(g);
    const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), d = box.getSize(new THREE.Vector3()).length() / 2 / Math.sin(15 * Math.PI / 180) * zoom;
    C.position.set(ctr.x + d * dir[0], ctr.y + d * dir[1], ctr.z + d * dir[2]); C.lookAt(ctr);
    R.render(S, C); return R.domElement.toDataURL('image/png');
  } finally { S.traverse(o => { o.geometry?.dispose?.(); }); R.dispose(); R.forceContextLoss?.(); }
}
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
export async function skinPic(k, i, color, av) {
  const key = keyOf(k, i, color, av); if (shots.has(key)) return shots.get(key);
  let u = '';
  try {
    const sk = await (kit ||= import('./skins.js'));
    u = k === 'cb' ? cardPic(i | 0, sk) : k === 'dc' ? dicePic(i | 0, sk) : k === 'gb' ? await ballPic(i | 0, color, sk) : k === 'kp' ? await kartPic(i | 0, color, av) : '';
  } catch (e) { console.warn('no theme picture', k, e); }
  shots.set(key, u); return u;
}

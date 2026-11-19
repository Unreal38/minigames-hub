// Snack Swap 3D table (three.js). Purely visual: everyone's avatar sits round the far side of a cosy table,
// face-down cards land in front of them as they play, gather in the middle for the vote, and winners hop.
import * as THREE from 'three';
import { backSvg } from './art.js';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';

const TABLE_R = 3.9, SEAT_R = 5.15, CARD_R = 3.05;
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, ...o });
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

function canvasTex(w, h, paint) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  paint(cv.getContext('2d'), t);
  return t;
}
const woodTex = () => canvasTex(512, 512, g => {
  g.fillStyle = '#a8693f'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = '#8a5230'; g.globalAlpha = .12 + Math.random() * .18; g.lineWidth = 1 + Math.random() * 4;
    g.beginPath(); g.ellipse(256 + Math.random() * 10, 256 + Math.random() * 10, i * 6 + Math.random() * 4, i * 6 + Math.random() * 6, 0, 0, Math.PI * 2); g.stroke();
  }
});
const clothTex = () => canvasTex(512, 512, g => { // round gingham cloth
  g.fillStyle = '#fff4e2'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#ff8fab66'; for (let i = 0; i < 16; i += 2) { g.fillRect(i * 32, 0, 32, 512); g.fillRect(0, i * 32, 512, 32); }
});
const rugTex = () => canvasTex(512, 512, g => {
  [['#5a2c45', 256], ['#ffb547', 244], ['#fff4e2', 226], ['#ff8fab', 214], ['#3d1f33', 200]].forEach(([c, r]) => { g.fillStyle = c; g.beginPath(); g.arc(256, 256, r, 0, 7); g.fill(); });
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; g.fillStyle = i % 2 ? '#7ed3b2' : '#ffb547'; g.beginPath(); g.arc(256 + Math.cos(a) * 178, 256 + Math.sin(a) * 178, 9, 0, 7); g.fill(); }
});
const backTex = () => canvasTex(256, 352, (g, tex) => {
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  g.fillStyle = '#3b2219'; rr(0, 0, 256, 352, 34); g.fill();
  g.fillStyle = '#e5543b'; rr(9, 9, 238, 334, 27); g.fill();
  g.strokeStyle = '#ffffff33'; g.lineWidth = 6; rr(26, 26, 204, 300, 18); g.stroke();
  const im = new Image();
  im.onload = () => { g.drawImage(im, 28, 76, 200, 200); tex.needsUpdate = true; };
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(backSvg('width="200" height="200"'));
});
function softDot() {
  return canvasTex(64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

// Seats fan out round the far side of the table so every face looks at the camera.
export function seatAngles(n) {
  const step = Math.min(.66, 3.7 / Math.max(1, n - 1));
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
}

export function createScene(canvas, { onFrame }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1422'); scene.fog = new THREE.Fog('#2a1422', 18, 38);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);

  scene.add(new THREE.HemisphereLight('#ffe2c4', '#3a1a2c', 1.5));
  const key = new THREE.DirectionalLight('#ffe6c8', 2.2); key.position.set(4, 12, 8); key.castShadow = true;
  key.shadow.mapSize.setScalar(matchMedia('(max-width: 760px)').matches ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 32 });
  key.shadow.bias = -.0006; key.shadow.normalBias = .02; scene.add(key);
  const rim = new THREE.DirectionalLight('#9db4ff', .9); rim.position.set(-6, 7, -9); scene.add(rim);
  const warm = new THREE.PointLight('#ffb070', 5, 9, 1.5); warm.position.set(0, 2.2, 0); scene.add(warm);

  const put = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const dot = softDot();
  const halo = (col, op) => new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));

  // room: floor, rug, strings of bulbs
  const floor = put(new THREE.CircleGeometry(30, 48), M('#3a1c2e', { roughness: .9 }), 0, -2.4, 0); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const rug = put(new THREE.CircleGeometry(8.6, 64), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 }), 0, -2.38, 0); rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true;
  const bulbs = [], bulbGeo = new THREE.SphereGeometry(.13, 12, 10), bulbCols = ['#ffb547', '#ff8fab', '#7ed3b2', '#ffd27a', '#9aa8ff'];
  [[-10, -8, 10, -8, 6.6], [-11, -3, -6, -11, 5.6], [6, -11, 11, -3, 5.8]].forEach(([x1, z1, x2, z2, y], li) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * 1.1, z1 + (z2 - z1) * t)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a0c14' })));
    pts.forEach((p, i) => {
      if (i % 2) return;
      const col = bulbCols[(i / 2 + li) % 5], b = put(bulbGeo, new THREE.MeshBasicMaterial({ color: col }), p.x, p.y - .16, p.z);
      const h = halo(col, .35); h.scale.setScalar(1.1); b.add(h); bulbs.push(b);
    });
  });

  // table with a gingham cloth and a snack bowl in the middle
  const table = put(new THREE.CylinderGeometry(TABLE_R, TABLE_R - .1, .34, 72), [M('#7a4628'), M('#ffffff', { map: woodTex(), roughness: .5 }), M('#7a4628')], 0, -.17, 0);
  table.receiveShadow = true; table.castShadow = true;
  put(new THREE.TorusGeometry(TABLE_R, .09, 10, 80), M('#6e3c20', { roughness: .4 })).rotation.x = Math.PI / 2;
  const cloth = put(new THREE.CylinderGeometry(2.5, 2.5, .03, 64), M('#ffffff', { map: clothTex(), roughness: .9 }), 0, .015, 0); cloth.receiveShadow = true;
  put(lathe([[0, -2.4], [1.4, -2.4], [1.46, -2.3], [1, -2.18], [.58, -1.95], [.4, -1.55], [.4, -.95], [.58, -.55], [1, -.34], [0, -.34]], 28), M('#5a3019', { roughness: .5 })).castShadow = true;
  const bowl = new THREE.Group(); bowl.position.set(0, .03, -1.5); scene.add(bowl);
  const bowlMesh = put(lathe([[0, 0], [.42, 0], [.5, .04], [.86, .46], [.9, .5], [.84, .5], [.46, .1], [0, .08]], 36), M('#7ed3b2', { roughness: .35, side: THREE.DoubleSide }), 0, 0, 0, bowl); bowlMesh.castShadow = true;
  const candyGeo = new THREE.SphereGeometry(.17, 14, 10);
  ['#ff8fab', '#ffb547', '#e5543b', '#9aa8ff', '#fff4e2', '#ffd84a', '#ff8fab', '#c8e66b', '#ffb547'].forEach((c, i) => {
    const a = i * 2.4, r = i ? .22 + (i % 3) * .14 : 0;
    put(candyGeo, M(c, { roughness: .3 }), Math.cos(a) * r, .3 + (i % 2) * .1 + (i ? 0 : .12), Math.sin(a) * r, bowl).castShadow = true;
  });

  // seats
  const cardGeo = new THREE.BoxGeometry(.78, .03, 1.07), stoolGeo = lathe([[0, -.16], [.5, -.16], [.6, -.12], [.62, -.06], [.58, -.01], [0, 0]], 28);
  const cardMats = [M('#fff4e2'), M('#fff4e2'), M('#ffffff', { map: backTex(), roughness: .6 }), M('#fff4e2'), M('#fff4e2'), M('#fff4e2')];
  let seats = [], seatKey = '', stage = '', destroyed = false;
  const V = new THREE.Vector3();

  function clearSeats() {
    for (const s of seats) { scene.remove(s.g, s.card); disposeAvatar(s.av); s.stool.material.dispose(); s.spot.material.dispose(); }
    seats = [];
  }
  function setSeats(list, me) {
    const key = list.map(p => p.color + p.av.join('')).join('|') + '/' + me;
    if (key === seatKey) return; seatKey = key;
    clearSeats();
    const ang = seatAngles(list.length);
    halfW = Math.max(...ang.map(a => Math.abs(Math.sin(a)))) * SEAT_R + 1.3; W = 0;
    seats = list.map((p, i) => {
      const a = ang[i], x = Math.sin(a) * SEAT_R, z = -Math.cos(a) * SEAT_R;
      const g = new THREE.Group(); g.position.set(x, -.2, z); g.rotation.y = Math.atan2(-x, -z); scene.add(g);
      const av = avatar3d(p.color, p.av); g.add(av);
      const stool = put(stoolGeo, M(p.color, { roughness: .8 }), 0, -.76, 0, g); stool.material.color.multiplyScalar(.72); stool.castShadow = true;
      put(new THREE.CylinderGeometry(.09, .13, 1.3, 10), stool.material, 0, -1.55, 0, g);
      const spot = put(new THREE.CircleGeometry(.72, 32), new THREE.MeshBasicMaterial({ color: i === me ? '#ffb547' : p.color, transparent: true, opacity: i === me ? .5 : .22 }), Math.sin(a) * CARD_R, .012, -Math.cos(a) * CARD_R);
      spot.rotation.x = -Math.PI / 2;
      const card = new THREE.Mesh(cardGeo, cardMats); card.castShadow = true; card.visible = false; scene.add(card);
      const s = { g, av, stool, spot, card, a, played: false, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), ry0: 0, ry1: 0, hop: 0, cheer: false, active: false };
      scene.add(spot);
      return s;
    });
  }

  // where a seat's card rests: in front of its owner, or fanned in the middle while voting
  function rest(s, i, mid) {
    if (!mid) return { p: V.set(Math.sin(s.a) * CARD_R, .03, -Math.cos(s.a) * CARD_R).clone(), ry: -s.a };
    const n = seats.filter(x => x.played).length, k = seats.slice(0, i).filter(x => x.played).length;
    const cols = Math.min(n, 4), row = k / cols | 0, inRow = Math.min(cols, n - row * cols), col = k % cols;
    return { p: new THREE.Vector3((col - (inRow - 1) / 2) * .95, .03 + k * .002, .55 + row * 1.2), ry: (k % 2 ? 1 : -1) * .06 };
  }
  function send(s, i, mid, fromAbove) {
    const r = rest(s, i, mid);
    if (fromAbove) { s.from.set(s.g.position.x * .8, 2.3, s.g.position.z * .8); s.ry0 = -s.a + 2.5; }
    else { s.from.copy(s.card.position); s.ry0 = s.card.rotation.y; }
    s.to.copy(r.p); s.ry1 = r.ry; s.t = 0; s.card.visible = true;
  }

  // state = { stage, played: [bool], winners: [seat], waiting: [bool] }
  function setState(st) {
    const mid = st.stage === 'vote' || st.stage === 'reveal' || st.stage === 'end';
    const moved = mid !== (stage === 'vote' || stage === 'reveal' || stage === 'end');
    stage = st.stage;
    seats.forEach((s, i) => {
      const was = s.played; s.played = !!st.played[i]; s.active = !!st.waiting?.[i];
      s.cheer = st.stage === 'reveal' && !!st.winners?.includes(i);
      if (!s.played) { s.card.visible = false; return; }
      if (!was) send(s, i, mid, true);
    });
    if (moved) seats.forEach((s, i) => { if (s.played) send(s, i, mid, !s.card.visible); });
  }
  const hop = i => { if (seats[i]) seats[i].hop = 1; };

  // camera: the table sits in the upper part of the screen, leaving room for the hand of cards below
  let W = 0, H = 0, halfW = 5.5;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    const asp = w / h, portrait = asp < .9;
    camera.aspect = asp; camera.fov = portrait ? 54 : 36;
    const fit = halfW / (Math.tan(camera.fov * Math.PI / 360) * asp); // keep the widest seats in frame
    const D = Math.max(portrait ? 15 : 17.5, fit);
    camera.position.set(0, D * .4, D * .92);
    camera.lookAt(0, -D * (portrait ? .13 : .045), 0); // aim low so the table sits in the top half, above the cards
    camera.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    resize();
    const dt = Math.min(.05, clock.getDelta()), T = clock.elapsedTime;
    bulbs.forEach((b, i) => { b.children[0].material.opacity = .28 + Math.sin(T * 2 + i) * .1; });
    bowl.rotation.y = T * .15;
    const tags = [];
    seats.forEach((s, i) => {
      if (s.cheer && s.hop <= 0 && Math.sin(T * 3 + i) > .97) s.hop = 1;
      if (s.hop > 0) s.hop = Math.max(0, s.hop - dt * 1.4);
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop });
      s.av.position.y = Math.sin((1 - s.hop) * Math.PI) * (s.hop > 0 ? .45 : 0);
      if (s.card.visible && s.t < 1) {
        s.t = Math.min(1, s.t + dt * 2.2);
        const k = ease(s.t);
        s.card.position.lerpVectors(s.from, s.to, k); s.card.position.y += Math.sin(k * Math.PI) * .9;
        s.card.rotation.y = s.ry0 + (s.ry1 - s.ry0) * k;
      }
      V.set(s.g.position.x, 2.25 + s.av.position.y, s.g.position.z).project(camera);
      tags.push({ x: (V.x + 1) / 2 * W, y: (1 - V.y) / 2 * H, show: V.z < 1 });
    });
    renderer.render(scene, camera);
    onFrame?.({ tags });
  }
  frame();

  return {
    setSeats, setState, hop,
    dispose() {
      destroyed = true; cancelAnimationFrame(raf); clearSeats();
      scene.traverse(o => { if (o.isMesh || o.isSprite || o.isLine) { o.geometry?.dispose?.(); for (const m of [].concat(o.material)) { m.map?.dispose(); m.dispose(); } } });
      renderer.dispose();
    },
  };
}

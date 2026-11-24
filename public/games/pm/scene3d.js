// Państwa-miasta 3D table (three.js): a round table on a sky island with a big letter block in the middle. The block
// tumbles through the alphabet while the letter is drawn, then stops with the round's letter facing you. Everyone's
// avatar sits round the table with a sheet of paper that fills up line by line as they write.
// Purely visual: it draws what the server sends. The answer sheet itself is drawn by the page (client.js), not here.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { LETTERS } from './rules.js';

const INK = '#4a2c22', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 2.95; // table radius
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const BLOCK = new THREE.Vector3(0, 1.5, -.1), SIDE = 1.5;
const BUNT = ['#4aa3ff', '#ff6b8b', '#ffd23f', '#5fcf86', '#ff9440'];

// One face of the letter block: a cream plate with the letter on it.
function faceTex(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ff7a59'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(22, 22, 212, 212, 34); g.fill(); g.lineWidth = 9; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '700 168px Rubik, system-ui, sans-serif';
  const m = g.measureText(ch); // centred on the ink of the glyph, so Ł, Ś and Ż sit in the middle too
  g.fillText(ch, 128, 128 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.55); sun.position.set(6, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island and the table ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 22, max: 90, below: -12, seed: 9 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(15, 15, { round: true, rim: 4.4, seed: 33, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  {
    const deck = put(new THREE.CylinderGeometry(7.6, 7.6, .16, 28), M('#d9a066'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 7.5 * 7.5 - (i * 1.15) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .05), M('#b97f4c'), 0, -2.33, i * 1.15); }
    const rimG = new THREE.TorusGeometry(7.6, .14, 6, 28); rimG.rotateX(Math.PI / 2); put(rimG, M('#a86a42'), 0, -2.36, 0);
    // the table: a plank top on a barrel with a pale blue cloth
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    const edge = new THREE.TorusGeometry(R + .4, .08, 6, 28); edge.rotateX(Math.PI / 2); put(edge, M('#ffc94d'), 0, 0, 0);
    const cloth = put(new THREE.CylinderGeometry(R + .12, R + .12, .04, 28), M('#e6f1ff'), 0, 0, 0); cloth.receiveShadow = true;
    const band = new THREE.TorusGeometry(R - .12, .035, 5, 28); band.rotateX(Math.PI / 2); put(band, M('#7fb6ff'), 0, .02, 0);
    put(new THREE.CylinderGeometry(1.25, 1.05, 2, 14), M('#a86a42'), 0, -1.32, 0).castShadow = true;
    for (const y of [-.7, -1.9]) { const h = new THREE.TorusGeometry(y < -1 ? 1.13 : 1.24, .07, 5, 14); h.rotateX(Math.PI / 2); put(h, M('#5b4636'), 0, y, 0); }
    // the stand the letter block floats over, and a globe and a stack of books at the back of the table
    put(new THREE.CylinderGeometry(.95, 1.1, .2, 8), M('#ffc94d'), BLOCK.x, .12, BLOCK.z).castShadow = true;
    put(new THREE.CylinderGeometry(.7, .7, .1, 8), M('#8a5a3c'), BLOCK.x, .26, BLOCK.z);
    // Both sit in the ring between the stand and the rivals' paper sheets (sheets start about 1.84 from the middle),
    // so they never clip a sheet whatever the number of players. Built at full size in a group, then shrunk.
    const globeG = new THREE.Group(); globeG.position.set(-1.12, 0, -.92); globeG.scale.setScalar(.7); room.add(globeG);
    put(new THREE.CylinderGeometry(.2, .28, .1, 8), M('#8a5a3c'), 0, .13, 0, globeG);
    put(new THREE.CylinderGeometry(.04, .04, .34, 6), M('#5b4636'), 0, .35, 0, globeG);
    const globe = put(new THREE.IcosahedronGeometry(.4, 1), M('#4aa3ff'), 0, .85, 0, globeG); globe.castShadow = true;
    for (const [a, b, sx] of [[.5, .9, 1.25], [2.3, -.4, 1.1], [4.2, .5, .9], [5.4, -1, 1.2]]) { const l = put(new THREE.IcosahedronGeometry(.17, 0), M('#5fcf86'), 0, 0, 0, globe); l.position.setFromSphericalCoords(.33, Math.PI / 2 + b * .5, a); l.scale.set(sx, 1, 1); }
    const booksG = new THREE.Group(); booksG.position.set(1.15, 0, -.88); booksG.scale.setScalar(.68); room.add(booksG);
    [['#ff6b8b', 0, .1], ['#5fcf86', .09, -.2], ['#ffd23f', .18, .25]].forEach(([c, y, r]) => { const b = put(new THREE.BoxGeometry(.72, .13, .5), M(c), 0, .1 + y * 1.5, 0, booksG); b.rotation.y = r; b.castShadow = true; put(new THREE.BoxGeometry(.66, .09, .46), M('#fffaf0'), .04, .1 + y * 1.5, 0, booksG).rotation.y = r; });
    // lantern poles round the deck and a string of bunting between them
    for (const [x, z, c] of [[-6.4, -2.2, '#ffd84a'], [6.4, -2.2, '#ff8fab'], [0, -6.9, '#7ed3b2']]) {
      put(new THREE.CylinderGeometry(.07, .09, 3.6, 6), M('#8a5a3c'), x, -.6, z).castShadow = true;
      put(new THREE.BoxGeometry(.42, .5, .42), M(c, { emissive: c, emissiveIntensity: .35 }), x, 1.35, z);
      put(new THREE.ConeGeometry(.36, .25, 4), M('#5b4636'), x, 1.72, z).rotation.y = Math.PI / 4;
    }
    for (let i = 0; i < 11; i++) {
      for (const sx of [-1, 1]) {
        const t = (i + .5) / 11, x = sx * 6.4 * (1 - t), z = -2.2 + (-6.9 + 2.2) * t, y = 1.05 - Math.sin(t * Math.PI) * .5;
        const f = put(new THREE.ConeGeometry(.2, .36, 3), M(BUNT[(i + (sx > 0 ? 2 : 0)) % 5]), x, y, z); f.rotation.set(Math.PI, Math.atan2(sx * 6.4, 4.7), 0); f.scale.z = .25;
      }
    }
    bake(room); toonify(room, .04);
  }

  // ---------- the letter block ----------
  const texOf = new Map();
  const tex = ch => { let t = texOf.get(ch); if (!t) texOf.set(ch, t = faceTex(ch)); return t; };
  const blockGeo = new THREE.BoxGeometry(SIDE, SIDE, SIDE);
  const blockMat = new THREE.MeshStandardMaterial({ map: tex('?'), roughness: .8, emissive: '#ffffff', emissiveMap: tex('?'), emissiveIntensity: .32 });
  const block = new THREE.Group(); block.position.copy(BLOCK); scene.add(block);
  const cube = new THREE.Mesh(blockGeo, blockMat); cube.castShadow = true; block.add(cube);
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const hull = new THREE.Mesh(blockGeo, inkMat); hull.scale.setScalar(1.06); block.add(hull);
  let shownCh = '?', spin = 0, spinT = 0, pop = 0, flick = 0;
  const showCh = ch => { if (ch === shownCh) return; shownCh = ch; blockMat.map = blockMat.emissiveMap = tex(ch); };
  const ALPHA = LETTERS.pl;

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  // You sit at the front. A rival right behind the block would be hidden by it, so everyone shifts round a little.
  const seatAngle = r => { const a = r * Math.PI * 2 / n; return Math.PI / 2 + a + (r ? .52 * (1 - Math.abs(a - Math.PI) / Math.PI) : 0); };
  const onRim = (r, k = 1) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, 0, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  const sheetGeo = new THREE.PlaneGeometry(.8, 1.04); sheetGeo.rotateX(-Math.PI / 2);
  // a rival's sheet: one line per category, scribbled in once they have a word there
  function paintSheet(s, fill, lines, color) {
    const g = s.ctx; g.clearRect(0, 0, 80, 104);
    g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(1.5, 1.5, 77, 101, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.fillStyle = color; g.fillRect(8, 8, 64, 9);
    const gap = Math.min(11, 76 / Math.max(1, lines));
    for (let i = 0; i < lines; i++) {
      const y = 26 + i * gap;
      g.strokeStyle = '#d9c8b4'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(9, y + 3); g.lineTo(71, y + 3); g.stroke();
      if (i < fill) { g.strokeStyle = INK; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(11, y); for (let x = 16; x <= 44 + (i * 37 % 22); x += 5) g.lineTo(x, y + (x / 5 % 2 ? -2 : 1.4)); g.stroke(); }
    }
    s.tex.needsUpdate = true;
  }
  function freeSeat(s) { scene.remove(s.av, s.stool, s.sheet); disposeAvatar(s.av); s.tex.dispose(); s.sheet.material.dispose(); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), out = onRim(r, 1.4), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const cv = document.createElement('canvas'); cv.width = 80; cv.height = 104;
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const at = onRim(r, .8), sheet = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      sheet.position.set(at.x, .06, at.z); sheet.rotation.y = -seatAngle(r) + Math.PI / 2; sheet.visible = !mine; scene.add(sheet);
      return { av, stool, sheet, tex: t, ctx: cv.getContext('2d'), fill: -1, lines: -1, mine, hop: 0, busy: 0, key: p.color + (p.av || []).join(''), color: p.color };
    });
  }

  // ---------- state from the server ----------
  let S = null, gid = '', T = 0, evN = 0;
  const pfx = createFx(scene), shake = shaker();
  const over = (i, y = 2.2) => { const at = onRim(rel(i), 1.4); return new THREE.Vector3(at.x * .85, y, at.z * .85); };
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) buildSeats(list);
      else list.forEach((p, i) => {
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1; s.key = k; s.color = p.color; s.fill = -1;
      });
    }
    const fresh = st.gid !== gid;
    if (fresh) { gid = st.gid; evN = st.ev?.length ? st.ev[st.ev.length - 1].n : 0; }
    const writing = st.ph === 'play' && (st.stage === 'write' || st.stage === 'stop');
    seats.forEach((s, i) => {
      if (s.fill !== st.fill[i] || s.lines !== st.nOpen) { if (!fresh && s.fill >= 0 && st.fill[i] > s.fill) s.hop = Math.max(s.hop, .16); s.fill = st.fill[i]; s.lines = st.nOpen; paintSheet(s, s.fill, s.lines, s.color); }
      s.busy = writing && !st.seats[i].bot && st.fill[i] < st.nOpen ? 1 : 0;
    });
    // the block: tumbling while the letter is drawn, then the letter
    if (st.ph === 'play' && st.stage === 'draw') { if (!spin) { spin = 1; spinT = 0; } }
    else { if (spin || fresh) { spin = 0; pop = fresh ? 0 : 1; if (!fresh) pfx.burst(BLOCK.clone(), { n: 22, colors: ['#ffd84a', '#ffffff', '#ff7a59'], speed: 3.2, up: 2.4, size: .26, life: .8, shape: STAR }); } showCh(st.letter || '?'); }
    if (!fresh) for (const e of st.ev || []) {
      if (e.n <= evN) continue; evN = e.n;
      if (e.t === 'stop' && seats[e.s]) { seats[e.s].hop = 1; shake.kick(.1); pfx.burst(over(e.s, 1.9), { n: 16, colors: ['#ff7a59', '#ffd84a', '#ffffff'], speed: 2.6, up: 2.6, size: .22, life: .7, shape: STAR }); }
      else if (e.t === 'score') { const best = Math.max(...e.pts); if (best > 0) e.pts.forEach((p, i) => { if (p === best && seats[i]) seats[i].hop = 1; }); }
      else if (e.t === 'end' && e.w >= 0 && seats[e.w]) { seats[e.w].hop = 1; pfx.confetti(over(e.w), { n: 90, w: 3, h: 2.4, s: e.w }); }
    }
    S = st;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, hudRight = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, .5, -.1);
  const DIR = new THREE.Vector3(0, 1.05, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function placeCam(D) { camera.position.copy(DIR).multiplyScalar(D).add(camLook); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const avail = Math.max(200, w - hudRight), portrait = avail / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 150 : 104, bottom = Math.max(top + 120, h - hudBottom), side = portrait ? R * 1.25 : R * 1.4 + 2.1;
    const FIT = [new THREE.Vector3(0, 3.3, -R * 1.2), new THREE.Vector3(0, .1, R * .98), new THREE.Vector3(-side, 1, 0), new THREE.Vector3(side, 1, 0)];
    let lo = 4, hi = 90;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; placeCam(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && rx - lx <= avail - 8) hi = D; else lo = D;
    }
    placeCam(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, hudRight / 2, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let dead = false;
  const tv = new THREE.Vector3(), face = new THREE.Quaternion(), look = new THREE.Matrix4();
  const info = { tags: [] };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    // the block: a fast tumble through the alphabet during the draw, then it turns its face to you and bobs
    pop = Math.max(0, pop - dt * 2.2);
    if (spin && !reduced) {
      spinT += dt; flick -= dt;
      if (flick <= 0) { flick = .09; showCh(ALPHA[Math.random() * ALPHA.length | 0]); }
      cube.rotation.x += dt * 9; cube.rotation.y += dt * 13; cube.rotation.z += dt * 4;
      block.position.y = BLOCK.y + .25 + Math.sin(spinT * 9) * .12;
    } else {
      if (spin) showCh('?');
      // every face shows the letter, so the nearest quarter turn is enough
      // (only the four side faces carry an upright letter, so it never rests on its top or bottom)
      const snap = (a, q) => Math.round(a / q) * q, k = Math.min(1, dt * 9), full = Math.PI * 2;
      cube.rotation.x += (snap(cube.rotation.x, full) - cube.rotation.x) * k; cube.rotation.y += (snap(cube.rotation.y, Math.PI / 2) - cube.rotation.y) * k; cube.rotation.z += (snap(cube.rotation.z, full) - cube.rotation.z) * k;
      block.position.y = BLOCK.y + Math.sin(T * 1.6) * .06 + Math.sin(pop * Math.PI) * .5;
    }
    // the whole block leans back to face the camera, so the letter reads straight on
    look.lookAt(tv.copy(camera.position).setX(0), block.position, camera.up); face.setFromRotationMatrix(look);
    block.quaternion.slerp(face, Math.min(1, dt * 8));
    block.scale.setScalar(1 + Math.sin(pop * Math.PI) * .18);
    hull.rotation.copy(cube.rotation);
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      animateAvatar(s.av, T, { seed: i, active: s.busy > 0, hop: s.hop, look: 0, nod: s.busy ? .5 + Math.sin(T * 2.3 + i) * .12 : 0 });
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .14), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, mine: false };
      tv.copy(onRim(r, 1.4)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
    });
    info.tags.length = seats.length;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    setHud(px) { if (Math.abs(px - hudBottom) > 6) { hudBottom = px; resize(true); } },
    setInset(px) { if (px !== hudRight) { hudRight = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.tex.dispose(); s.sheet.material.dispose(); }
      for (const t of texOf.values()) t.dispose();
      pfx.dispose(); inkMat.dispose(); blockMat.dispose(); blockGeo.dispose(); sheetGeo.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

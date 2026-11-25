// Word Reef 3D table (three.js): a round table on a sky island deck with the island board in the middle: sand
// squares, sea in the corners, shells, starfish, waves and whirlpools for the bonus squares and four pet nests.
// Letter tiles are chunky blocks. Everyone's avatar sits round the table behind a little tile stand (you only see
// the backs of their tiles). Purely visual: it draws what the server sends and the tiles you are laying.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { petModel } from '../farm/pets3d.js';
import { boardOf, value, WILD } from './rules.js';
import { paintKind, KIND_COL } from './icons.js';
import { reefLook, paintReefMotif } from '../../pieceskins.js';
export { paintKind, KIND_COL };

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const U = .62, TH = .2, TOP = .34;       // a square in world units, how thick a tile is, the board's top surface
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const SAND2 = '#eed8a6';
// the face of a letter tile
// k: the tile set of the player who laid it (Wardrobe kind rt, public/pieceskins.js)
export function paintTile(g, S, l, wild, lang, k = 0) {
  const T = reefLook(k);
  g.fillStyle = T.face; g.fillRect(0, 0, S, S); paintReefMotif(g, S, k);
  g.fillStyle = wild ? T.wild : T.ink;
  g.font = `800 ${S * .62}px Rubik, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(l === WILD ? '' : l.toUpperCase(), S * .46, S * .53);
  if (!wild && l !== WILD) { g.font = `700 ${S * .24}px Rubik, Arial, sans-serif`; g.fillText(String(value(lang, l)), S * .82, S * .8); }
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.45); sun.position.set(5, 16, 8); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 26, max: 95, below: -12 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(19, 19, { round: true, rim: 4.6, seed: 57, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 50, 13, 4, 1.6);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const pfx = createFx(scene), shake = shaker();
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });
  const texOf = (S, paint) => { const cv = document.createElement('canvas'); cv.width = cv.height = S; paint(cv.getContext('2d'), S); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

  // ---------- the deck and the round table (built once, sized for the bigger board) ----------
  const TS = 5.75; // half the table: the big island fits with room for the tile stands along the edges
  { const room = new THREE.Group(); scene.add(room);
    const deck = put(new THREE.CylinderGeometry(10.5, 10.5, .16, 30), M('#e9d3a7'), 0, -2.42, 0, room); deck.receiveShadow = true;
    for (let i = -7; i <= 7; i++) { const w = Math.sqrt(Math.max(0, 10.4 * 10.4 - (i * 1.4) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .1), M('#d6bb8a'), 0, -2.33, i * 1.4 + .7, room); }
    const top = put(new THREE.BoxGeometry(TS * 2, .3, TS * 2), M('#b9794a'), 0, -.15, 0, room); top.castShadow = top.receiveShadow = true;
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(TS * 2 + .12, .08, .14), M('#ffc94d'), 0, .01, s * TS, room);
      put(new THREE.BoxGeometry(.14, .08, TS * 2 + .12), M('#ffc94d'), s * TS, .01, 0, room);
      for (const q of [-1, 1]) put(new THREE.BoxGeometry(.55, 2.2, .55), M('#a86a42'), s * (TS - .4), -1.35, q * (TS - .4), room).castShadow = true;
    }
    bake(room); toonify(room, .04);
  }

  // ---------- the board ----------
  let B = null, boardG = null, kindMats = {};
  const pos = i => new THREE.Vector3((i % B.N - (B.N - 1) / 2) * U, TOP, ((i / B.N | 0) - (B.N - 1) / 2) * U);
  const cornerOut = i => { // the water square just outside a nest, where its pet comes to sit
    const r = i / B.N | 0, c = i % B.N, h = (B.N - 1) / 2, dr = Math.sign(r - h), dc = Math.sign(c - h);
    for (let k = 1; k < 4; k++) { const j = (r + dr * k) * B.N + c + dc * k; if (B.kinds[j] === '#') return j; }
    return i;
  };
  // bonus pictures; painted again once the badge font has loaded so the x2 / x3 never show in a fallback font
  const kindMat = k => {
    const paint = (g, S) => paintKind(g, S, k), map = texOf(256, paint), m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    document.fonts?.load(`900 40px Rubik`).then(() => { const cv = map.image; paint(cv.getContext('2d'), cv.width); map.needsUpdate = true; }, () => {});
    return m;
  };
  function buildBoard(kind) {
    if (boardG) { scene.remove(boardG); boardG.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    B = boardOf(kind); boardG = new THREE.Group(); scene.add(boardG);
    const N = B.N, sq = new THREE.BoxGeometry(U * .96, .12, U * .96), decal = new THREE.PlaneGeometry(U * .9, U * .9); decal.rotateX(-Math.PI / 2);
    // a reef slab of stone and sand under the land squares
    const slab = put(new THREE.BoxGeometry(N * U + .3, .3, N * U + .3), M('#cfa56a'), 0, TOP - .27, 0, boardG); slab.receiveShadow = true; slab.castShadow = true;
    const sea = put(new THREE.BoxGeometry(N * U + .1, .04, N * U + .1), M('#4fb9e3', { roughness: .4 }), 0, TOP - .1, 0, boardG); sea.receiveShadow = true;
    toonify(boardG, .02);
    // the squares: one instanced mesh for all of them (coloured by kind), one for each kind of bonus picture
    const lands = [], byKind = {};
    for (let i = 0; i < N * N; i++) { const k = B.kinds[i]; if (k === '#') continue; lands.push(i); if (k !== '.') (byKind[k] ||= []).push(i); }
    const mx = new THREE.Matrix4(), col = new THREE.Color();
    const sqMesh = new THREE.InstancedMesh(sq, kindMats.sq ||= M('#ffffff'), lands.length); sqMesh.receiveShadow = true;
    lands.forEach((i, j) => {
      const p = pos(i), k = B.kinds[i], r = i / N | 0, c = i % N;
      mx.makeTranslation(p.x, TOP - .06, p.z); sqMesh.setMatrixAt(j, mx);
      sqMesh.setColorAt(j, col.set(k === '.' && (r + c) % 2 ? SAND2 : KIND_COL[k]));
    });
    boardG.add(sqMesh);
    for (const [k, list] of Object.entries(byKind)) {
      const dm = kindMats['d' + k] ||= kindMat(k);
      const im = new THREE.InstancedMesh(decal, dm, list.length); im.renderOrder = 1;
      list.forEach((i, j) => { const p = pos(i); mx.makeTranslation(p.x, TOP + .002, p.z); im.setMatrixAt(j, mx); });
      boardG.add(im);
    }
  }

  // ---------- tiles ----------
  const tileGeo = new THREE.BoxGeometry(U * .88, TH, U * .88), faceGeo = new THREE.PlaneGeometry(U * .84, U * .84); faceGeo.rotateX(-Math.PI / 2);
  const bodyMat = toonMat(M('#f3dfb6')), draftMat = toonMat(M('#bff0d8')), pendMat = toonMat(M('#ffe48a'));
  const faceMats = new Map();
  let lang = 'pl';
  const faceMat = (l, w, sk = 0) => { const k = lang + l + (w ? '*' : '') + '/' + sk; if (!faceMats.has(k)) faceMats.set(k, new THREE.MeshStandardMaterial({ map: texOf(128, (g, S) => paintTile(g, S, l, w, lang, sk)), roughness: .7 })); return faceMats.get(k); };
  // a laid tile's block wears its player's tile set (classic = the sand colour); pending and draft blocks keep their state colours
  const skinBodies = new Map(), skinBody = sk => !sk ? bodyMat : skinBodies.get(sk) || skinBodies.set(sk, toonMat(M(reefLook(sk).body))).get(sk);
  const skinAt = (st, s) => Math.max(0, st.seats?.[s]?.fl?.rt | 0);
  function makeTile(l, w, body = bodyMat, sk = 0) {
    const g = new THREE.Group(), b = put(tileGeo, body, 0, TH / 2, 0, g); b.castShadow = true;
    if (l) put(faceGeo, faceMat(l, w, sk), 0, TH + .003, 0, g);
    g.userData.sk = sk; return g;
  }
  const tileBackMat = c => (backMats.get(c) || backMats.set(c, toonMat(M(c))).get(c));
  const backMats = new Map();

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  function spotOf(r) { // you at the front, then clockwise round the table
    const a = n === 2 ? [0, Math.PI][r] : n === 3 ? [0, Math.PI * .5, Math.PI * 1.5][r] : [0, Math.PI * .5, Math.PI, Math.PI * 1.5][r];
    const ang = a + Math.PI / 2; // 0 = towards the camera (+z); the others sit on the far side and the two ends
    const rx = Math.round(Math.cos(ang)), rz = Math.round(Math.sin(ang));
    return { ax: rx * (TS + .95), az: rz * (TS + .95), nx: rx, nz: rz, sx: rx * (TS - .42), sz: rz * (TS - .42) };
  }
  function freeSeat(s) { scene.remove(s.av, s.stool, s.rack, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), sp = spotOf(r), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(sp.ax, -.15, sp.az); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(sp.ax, -.95, sp.az); scene.add(stool);
      put(new THREE.BoxGeometry(1, .22, 1), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.BoxGeometry(.2, 1.3, .2), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const rack = new THREE.Group(); rack.position.set(sp.sx, 0, sp.sz); rack.lookAt(0, 0, 0); rack.visible = !mine; scene.add(rack);
      const bar = put(new THREE.BoxGeometry(U * 7.6 * .62, .16, .3), M('#a86a42'), 0, .08, .08, rack); bar.castShadow = true; toonify(rack, .03);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), sp.ax, -2.3, sp.az); ring.scale.set(1.25, 1, 1.25); ring.visible = !mine;
      return { av, stool, rack, ring, sp, mine, color: p.color, tiles: [], n: 0, hop: 0, nod: 0, look: 0, active: false, key: '' };
    });
  }
  // their tiles stand in the rack, backs to us, in that player's colour
  function setRack(s, cnt) {
    while (s.tiles.length > cnt) s.rack.remove(s.tiles.pop());
    while (s.tiles.length < cnt) {
      const t = new THREE.Group(), b = put(new THREE.BoxGeometry(U * .55, U * .55, TH * .7), tileBackMat(s.color), 0, U * .3 + .14, 0, t); b.castShadow = true; b.rotation.x = -.25;
      toonify(t, .02); s.rack.add(t); s.tiles.push(t); t.scale.setScalar(.001); tween(.25, e => t.scale.setScalar(Math.max(.001, ease(e))), null, s.tiles.length * .06);
    }
    s.tiles.forEach((t, j) => { t.position.x = (j - (cnt - 1) / 2) * U * .62; });
    s.n = cnt;
  }
  const seatSpot = i => { const s = seats[i]; return s ? new THREE.Vector3(s.sp.sx, 1, s.sp.sz) : new THREE.Vector3(0, 1, 6); };

  // ---------- letters on the board ----------
  const laid = new Map(), drafts = new Map(), pets = new Map(); // cell -> mesh
  const tilesG = new THREE.Group(); scene.add(tilesG);
  let pendSet = new Set();
  function syncBoard(st, animate) {
    const P = st.pend, back = st.told && !st.told.ok ? st.told : null;
    const pend = new Set(P ? P.tiles.map(t => t.i) : []);
    for (const [i, m] of laid) if (!st.cells[i] || m.userData.l !== st.cells[i] + st.wild[i]) { // gone: a new game, or a play that was challenged off
      laid.delete(i);
      if (animate && back && back.tiles.some(t => t.i === i) && !reduced) {
        const from = m.position.clone(), to = seatSpot(back.s);
        tween(.5, e => { const k = ease(e); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.4; m.scale.setScalar(Math.max(.001, 1 - k * .7)); }, () => tilesG.remove(m), Math.random() * .15);
      } else tilesG.remove(m);
    }
    st.cells.forEach((l, i) => {
      if (!l) return;
      let m = laid.get(i);
      const isPend = pend.has(i), sk = skinAt(st, st.who[i]);
      if (!m) {
        m = makeTile(l, st.wild[i], isPend ? pendMat : skinBody(sk), sk); m.userData.l = l + st.wild[i]; laid.set(i, m); tilesG.add(m);
        const to = pos(i);
        if (animate && isPend && seats[P.s] && !drafts.has(i) && !reduced) {
          const from = seatSpot(P.s), k0 = P.tiles.findIndex(t => t.i === i);
          m.position.copy(from); m.scale.setScalar(.6);
          tween(.45, e => { const k = ease(e); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.6; m.scale.setScalar(.6 + .4 * k); },
            () => { m.position.copy(to); pfx.puff(to.clone().setY(TOP + .1), { n: 5, color: ['#fff4e2', '#d9c3a4'], size: .2, speed: 1.2 }); }, k0 * .08);
          seats[P.s].hop = .5;
        } else m.position.copy(to);
      }
      const want = isPend ? pendMat : skinBody(sk);
      if (m.children[1] && m.userData.sk !== sk) { m.userData.sk = sk; m.children[1].material = faceMat(l, st.wild[i], sk); }
      if (m.children[0].material !== want) { // a play that stood: its tiles settle with a ring in the player's colour
        m.children[0].material = want;
        if (!isPend && animate && pendSet.has(i)) { const p = pos(i).setY(TOP + .05); pfx.ring(p, { color: seats[st.who[i]]?.color || '#ffd84a', size: .7 }); }
      }
      m.userData.lift = isPend ? .06 : 0;
    });
    pendSet = pend;
    // pets wake up next to the nests that were covered
    for (const nst of st.nests || []) {
      if (pets.has(nst.i)) continue;
      const hold = new THREE.Group(), pm = petModel(nst.pet, 0), box = new THREE.Box3().setFromObject(pm), size = box.getSize(new THREE.Vector3());
      const k = Math.min(1.05 / size.y, 1 / Math.max(size.x, size.z)); pm.scale.multiplyScalar(k); pm.position.y = -box.min.y * k; pm.userData.y0 = pm.position.y; hold.add(pm);
      const pad = put(new THREE.CylinderGeometry(U * .55, U * .55, .05, 9), M('#6cc36a'), 0, -.01, 0, hold); pad.receiveShadow = true;
      const at = pos(cornerOut(nst.i)); hold.position.set(at.x, TOP - .08, at.z); hold.lookAt(0, TOP - .08, 0);
      scene.add(hold); pets.set(nst.i, hold);
      if (animate && !reduced) { hold.scale.setScalar(.001); tween(.5, e => hold.scale.setScalar(Math.max(.001, ease(e))), () => pfx.burst(hold.position.clone().setY(TOP + 1), { n: 14, colors: ['#ffd84a', '#ffffff', '#ff8fab'], speed: 2.6, up: 3, size: .22 })); }
    }
  }
  function setDraft(list) {
    const want = new Map(list.map(t => [t.i, t]));
    for (const [i, m] of drafts) { const t = want.get(i); if (!t || m.userData.key !== t.l + t.w) { tilesG.remove(m); drafts.delete(i); } }
    for (const [i, t] of want) {
      if (drafts.has(i)) continue;
      const m = makeTile(t.l, t.w, draftMat, mySkin); m.userData.key = t.l + t.w; m.position.copy(pos(i)); m.userData.lift = .12;
      m.scale.setScalar(.7); tween(.16, e => m.scale.setScalar(.7 + .3 * ease(e)));
      drafts.set(i, m); tilesG.add(m);
    }
  }
  // the square under the pointer, and where you are aiming
  const hover = put(new THREE.BoxGeometry(U * .98, .03, U * .98), new THREE.MeshBasicMaterial({ color: '#2fbf71', transparent: true, opacity: .55, depthWrite: false }), 0, TOP + .02, 0); hover.visible = false;
  function setHover(i) { if (!B || i < 0 || B.kinds[i] === '#') { hover.visible = false; return; } hover.visible = true; hover.position.copy(pos(i)).setY(TOP + .02); }

  // ---------- state from the server ----------
  let S = null, gid = '', mySkin = 0;
  function setState(st) {
    lang = st.lang; mySkin = skinAt(st, st.me);
    if (!B || st.board !== boardKind) { boardKind = st.board; buildBoard(st.board); for (const m of laid.values()) tilesG.remove(m); laid.clear(); for (const p of pets.values()) scene.remove(p); pets.clear(); force = true; }
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) { buildSeats(list); force = true; }
      else list.forEach((p, i) => {
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos0 = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos0); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1;
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
    }
    const fresh = st.gid !== gid;
    if (fresh) { gid = st.gid; tweens.length = 0; for (const m of laid.values()) tilesG.remove(m); laid.clear(); for (const p of pets.values()) scene.remove(p); pets.clear(); }
    syncBoard(st, !fresh);
    list.forEach((p, i) => { if (seats[i].n !== p.n) setRack(seats[i], p.n); seats[i].active = st.turn === i && st.stage === 'play'; });
    if (st.ph === 'end' && S && S.ph !== 'end' && seats[st.win] && !seats[st.win].mine) { const s = seats[st.win]; s.hop = 1; pfx.confetti(s.av.position.clone().setY(2.1), { n: 60, w: 2.6, h: 2, s: st.win }); }
    S = st;
  }
  let boardKind = '', force = false;

  // ---------- camera ----------
  // The board (and the heads of the players across and, on a wide screen, at the ends) fits between the HUD
  // insets: the top bar, your tray at the bottom, and the tray panel on the right on a wide screen.
  let W = 0, H = 0, ins = { top: 120, bottom: 230, left: 0, right: 0 }, zoomAt = -1, zoomK = 0, zoomTo = 0;
  const DIR = new THREE.Vector3(0, 2.3, 1).normalize(), v = new THREE.Vector3(), look = new THREE.Vector3(), lookTo = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  let baseDist = 20, offX = 0, offY = 0;
  function place(dist, at) { camera.position.copy(DIR).multiplyScalar(dist).add(at); camera.lookAt(at); camera.updateMatrixWorld(); }
  function resize(forceIt) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h || !B) return;
    if (w === W && h === H && !forceIt) return; W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < .8 ? 40 : 30; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const half = B.N * U / 2 + .12, top = ins.top, bottom = Math.max(top + 140, h - ins.bottom), left = ins.left + (w < 700 ? 4 : 16), right = w - ins.right - (w < 700 ? 4 : 16);
    const FIT = [new THREE.Vector3(-half, TOP, -half), new THREE.Vector3(half, TOP, -half), new THREE.Vector3(-half, TOP, half), new THREE.Vector3(half, TOP, half)];
    const wide = right - left > (bottom - top) * 1.5;
    for (const s of seats) if (!s.mine) { // keep the other players' faces in view: across always, at the ends when there is room
      if (s.sp.nz < 0) FIT.push(new THREE.Vector3(s.sp.ax, 1.9, s.sp.az));
      else if (wide) FIT.push(new THREE.Vector3(s.sp.ax + s.sp.nx * .5, 1.9, s.sp.az));
    }
    let lo = 4, hi = 120; const o = new THREE.Vector3();
    const box = () => { const ps = FIT.map(toPx); return { ty: Math.min(...ps.map(p => p[1])), by: Math.max(...ps.map(p => p[1])), lx: Math.min(...ps.map(p => p[0])), rx: Math.max(...ps.map(p => p[0])) }; };
    for (let i = 0; i < 32; i++) {
      const dist = (lo + hi) / 2; place(dist, o); const b = box();
      if (b.by - b.ty <= bottom - top && b.rx - b.lx <= right - left) hi = dist; else lo = dist;
    }
    baseDist = hi; place(hi, o);
    const b = box();
    offY = (b.ty + b.by) / 2 - (top + bottom) / 2; offX = (b.lx + b.rx) / 2 - (left + right) / 2;
    camera.setViewOffset(w, h, offX, offY, w, h); camera.updateProjectionMatrix();
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
  }
  // how many pixels a square takes on the screen right now
  const cellPx = () => { if (!B) return 40; const a = toPx(pos(0)), b = toPx(pos(0).add(new THREE.Vector3(U, 0, 0))); return Math.hypot(a[0] - b[0], a[1] - b[1]); };

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3();
  function cellAt(cx, cy) {
    if (!B) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const c = Math.round(hit.x / U + (B.N - 1) / 2), row = Math.round(hit.z / U + (B.N - 1) / 2);
    if (c < 0 || row < 0 || c >= B.N || row >= B.N) return -1;
    return row * B.N + c;
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastNow = 0;
  const tv = new THREE.Vector3();
  const info = { cell: cellPx, tags: [], px: i => { tv.copy(pos(i)).setY(TOP + .3); tv.project(camera); return [(tv.x + 1) / 2 * W, (1 - tv.y) / 2 * H]; } };
  function loop(dt, now) {
    if (dead) return;
    resize(force); force = false;
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    for (let i = 0; i < tweens.length; i++) {
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    for (const m of [...laid.values(), ...drafts.values()]) { const want = TOP + (m.userData.lift || 0) + (m.userData.lift ? Math.sin(T * 4) * .02 : 0); if (Math.abs(m.position.y - want) < .4) m.position.y += (want - m.position.y) * .3; }
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * .7);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop, look: 0, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
    });
    for (const p of pets.values()) p.children[0].position.y = Math.abs(Math.sin(T * 2 + p.position.x)) * .06 + p.children[0].userData.y0;
    cloudRing.rotation.y = T * .006; flyBirds(T);
    // zoom: ease towards the chosen square, closer by zoomTo
    zoomK += (zoomTo - zoomK) * Math.min(1, real * 7);
    look.lerp(lookTo, Math.min(1, real * 7));
    place(baseDist * (1 - zoomK * .38), look);
    camera.setViewOffset(W, H, offX * (1 - zoomK), offY * (1 - zoomK), W, H); camera.updateProjectionMatrix();
    if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);
    seats.forEach((s, i) => { const t = info.tags[i] ||= { x: 0, y: 0, mine: false }; tv.set(s.sp.ax, 2.25, s.sp.az).project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine; });
    info.tags.length = seats.length;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, setDraft, setHover, cellAt, cellPx,
    // zoom in on a square (closer and centred on it), or back out with -1
    zoom(i) { zoomAt = i; if (i < 0 || !B) { zoomTo = 0; lookTo.set(0, 0, 0); } else { zoomTo = 1; const p = pos(i); const h = B.N * U / 3; lookTo.set(Math.max(-h, Math.min(h, p.x)), 0, Math.max(-h, Math.min(h, p.z))); } },
    zoomed: () => zoomAt >= 0,
    // slide the zoomed-in island by a drag of (dx, dy) pixels
    pan(dx, dy) { if (zoomAt < 0 || !B) return; const k = U / Math.max(8, cellPx()), h = B.N * U / 3; lookTo.x = Math.max(-h, Math.min(h, lookTo.x - dx * k)); lookTo.z = Math.max(-h, Math.min(h, lookTo.z - dy * k * 1.1)); look.copy(lookTo); },
    kick(k = .05) { if (!reduced) shake.kick(k); },
    setHud(next) { if (Object.keys(next).some(k => Math.abs(next[k] - ins[k]) > 6) && hudFitOk(canvas)) { ins = { ...ins, ...next }; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const m of faceMats.values()) { m.map?.dispose(); m.dispose(); }
      for (const m of skinBodies.values()) m.dispose();
      pfx.dispose(); tileGeo.dispose(); faceGeo.dispose(); ringGeo.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

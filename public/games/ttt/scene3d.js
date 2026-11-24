// Tic-Tac-Toe 3D table (three.js): a chunky wooden board on a table on a sky island, the two players' avatars on
// stools at either side, and blocky crosses and noughts in the players' own colours that drop onto the board.
// Purely visual: it draws what the server sends and tells the HUD which square the pointer is over.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const B = 4.4;            // board width
const TOP = .22;          // height of the board's playing surface
const SEAT_X = 4.7;       // how far out the players sit
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const bounce = t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; };

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.55); sun.position.set(5, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island and the table ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 22, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const land = island(15, 15, { round: true, rim: 4.4, seed: 41, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  { // a round wooden deck, a square table with chunky legs, and a few things lying about
    const deck = put(new THREE.CylinderGeometry(7.8, 7.8, .16, 28), M('#e9d3a7'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 7.7 * 7.7 - (i * 1.18) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .1), M('#d6bb88'), 0, -2.33, i * 1.18 + .59); }
    const rim = new THREE.TorusGeometry(7.8, .14, 6, 28); rim.rotateX(Math.PI / 2); put(rim, M('#c9a26b'), 0, -2.36, 0);
    const top = put(new THREE.BoxGeometry(B + 1.9, .34, B + 1.9), M('#b9794a'), 0, -.19, 0); top.castShadow = top.receiveShadow = true;
    put(new THREE.BoxGeometry(B + 1.5, .04, B + 1.5), M('#cf9460'), 0, -.01, 0).receiveShadow = true;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(new THREE.BoxGeometry(.5, 2.1, .5), M('#a86a42'), sx * (B / 2 + .5), -1.38, sz * (B / 2 + .5)).castShadow = true;
    // a chalk slate on an easel, a crate of spare pieces, a mug
    const easel = new THREE.Group(); easel.position.set(-5.6, -2.34, -4.3); easel.rotation.y = .55; room.add(easel);
    put(new THREE.BoxGeometry(2.1, 1.6, .12), M('#3d4a45'), 0, 1.75, 0, easel).rotation.x = -.14; put(new THREE.BoxGeometry(2.3, .14, .2), M('#a86a42'), 0, .9, .14, easel);
    put(new THREE.BoxGeometry(.14, 2.9, .14), M('#a86a42'), -.85, 1.35, .05, easel).rotation.x = -.14; put(new THREE.BoxGeometry(.14, 2.9, .14), M('#a86a42'), .85, 1.35, .05, easel).rotation.x = -.14;
    put(new THREE.BoxGeometry(.14, 2.8, .14), M('#8a5a3c'), 0, 1.3, -.55, easel).rotation.x = .3;
    for (const x of [-.32, .32]) { put(new THREE.BoxGeometry(.05, 1.2, .03), M('#f4f1e6'), x, 1.76, .08, easel).rotation.x = -.14; put(new THREE.BoxGeometry(1.5, .05, .03), M('#f4f1e6'), 0, 1.76 + x * 1.15, .08 - x * .16, easel).rotation.x = -.14; }
    const crate = new THREE.Group(); crate.position.set(5.7, -2.34, -3.6); crate.rotation.y = -.4; room.add(crate);
    put(new THREE.BoxGeometry(1.5, .8, 1.1), M('#c99763'), 0, .4, 0, crate).castShadow = true; put(new THREE.BoxGeometry(1.6, .12, .14), M('#a86a42'), 0, .5, .56, crate); put(new THREE.BoxGeometry(1.6, .12, .14), M('#a86a42'), 0, .2, .56, crate);
    put(new THREE.BoxGeometry(.7, .16, .2), M('#ff7a59'), -.25, .88, 0, crate).rotation.y = .78; put(new THREE.BoxGeometry(.7, .16, .2), M('#ff7a59'), -.25, .88, 0, crate).rotation.y = -.78;
    put(new THREE.TorusGeometry(.24, .09, 4, 8), M('#7fd1e8'), .4, .9, .1, crate).rotation.x = Math.PI / 2;
    put(new THREE.CylinderGeometry(.2, .15, .3, 8), M('#ff8fab'), 5.2, -2.19, 4.3); put(new THREE.CylinderGeometry(.2, .15, .3, 8), M('#ffc94d'), -5.0, -2.19, 4.5);
    bake(room); toonify(room, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- the board (rebuilt when the grid size changes) ----------
  let n = 0, cell = 1, boardG = null, tiles = [];
  const cellPos = c => new THREE.Vector3((c % n - (n - 1) / 2) * cell, TOP, ((c / n | 0) - (n - 1) / 2) * cell);
  const tileMats = [M('#fff1d6'), M('#f6dfb6')].map(m => toonMat(m)), hotMat = toonMat(M('#ffe27a')).clone(), winMat = toonMat(M('#ffd84a')).clone();
  function buildBoard(size) {
    if (boardG) { scene.remove(boardG); boardG.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
    n = size; cell = B / n; tiles = [];
    boardG = new THREE.Group(); scene.add(boardG);
    const frame = put(new THREE.BoxGeometry(B + .5, TOP + .06, B + .5), M('#8a5a3c'), 0, TOP / 2 - .03, 0, boardG); frame.castShadow = frame.receiveShadow = true;
    const g = cell * .06; // the gap between tiles: the dark frame shows through as the grid lines
    const tg = new THREE.BoxGeometry(cell - g * 2, .1, cell - g * 2);
    toonify(boardG, .035);
    for (let c = 0; c < n * n; c++) {
      const p = cellPos(c), t = new THREE.Mesh(tg, tileMats[((c % n) + (c / n | 0)) % 2]); t.position.set(p.x, TOP - .02, p.z); t.receiveShadow = true; t.userData = { toon: true, base: ((c % n) + (c / n | 0)) % 2 };
      boardG.add(t); tiles.push(t);
    }
  }

  // ---------- crosses and noughts ----------
  // One model of each per player colour, cloned for every mark. The see-through copy is the mark about to vanish
  // (vanishing mode) and the one that follows your pointer.
  let xGeo = null, oGeo = null, protos = [], protoN = 0, marks = new Map(); // cell -> { g, s }
  function buildProtos(colors) {
    for (const p of protos) { p.solid.traverse(o => { if (o.userData.ink) o.geometry.dispose(); }); p.ghost.dispose(); }
    xGeo?.dispose(); oGeo?.dispose();
    const L = cell * .78, W = cell * .2, H = Math.min(.3, cell * .22);
    xGeo = new THREE.BoxGeometry(L, H, W);
    const oct = (r, path) => { for (let i = 0; i <= 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4, x = Math.cos(a) * r, y = Math.sin(a) * r; i ? path.lineTo(x, y) : path.moveTo(x, y); } return path; };
    const sh = oct(cell * .4, new THREE.Shape()); sh.holes.push(oct(cell * .22, new THREE.Path()));
    oGeo = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false }); oGeo.rotateX(-Math.PI / 2); oGeo.translate(0, -H / 2, 0);
    protoN = n;
    protos = colors.map((col, s) => {
      const solid = new THREE.Group(), mat = M(col);
      if (s === 0) for (const r of [Math.PI / 4, -Math.PI / 4]) { const m = new THREE.Mesh(xGeo, mat); m.rotation.y = r; m.castShadow = true; solid.add(m); }
      else { const m = new THREE.Mesh(oGeo, mat); m.castShadow = true; solid.add(m); }
      toonify(solid, .03);
      const ghost = solid.children.find(o => !o.userData.ink).material.clone(); ghost.transparent = true; ghost.opacity = .42; ghost.depthWrite = false;
      return { solid, ghost, H, col };
    });
  }
  function makeMark(s, ghost = false) {
    const p = protos[s], g = p.solid.clone();
    g.userData = { s, y: TOP + .03 + p.H / 2, fade: false, hop: 0 };
    if (ghost) setGhost(g, true);
    return g;
  }
  function setGhost(g, on) {
    if (g.userData.fade === on) return; g.userData.fade = on;
    const p = protos[g.userData.s];
    for (const o of g.children) { if (o.userData.ink) o.visible = !on; else { o.material = on ? p.ghost : p.solid.children.find(x => !x.userData.ink).material; o.castShadow = !on; } }
  }
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });
  function addMark(c, s, drop) {
    removeMark(c, false);
    const g = makeMark(s), p = cellPos(c); g.position.set(p.x, g.userData.y, p.z); boardG.add(g); marks.set(c, { g, s });
    if (drop && !reduced) {
      const y1 = g.userData.y; g.position.y = y1 + 3.2; g.rotation.y = (s ? 1 : -1) * 1.4;
      tween(.5, t => { const e = bounce(t); g.position.y = y1 + 3.2 * (1 - e); g.rotation.y = (s ? 1 : -1) * 1.4 * (1 - ease(Math.min(1, t * 1.6))); },
        () => { g.position.y = y1; g.rotation.y = 0; });
      tween(.01, () => {}, () => { pfx.ring(p.clone().setY(TOP + .06), { color: protos[s].col, size: cell * .62 }); pfx.puff(p.clone().setY(TOP + .1), { n: 7, color: ['#fff4e2', '#e9d3a7'], size: .28, speed: 1.8 }); shake.kick(.05); }, .17);
    }
  }
  function removeMark(c, poof) {
    const m = marks.get(c); if (!m) return;
    marks.delete(c);
    if (!poof || reduced) { boardG.remove(m.g); return; }
    const g = m.g, p = g.position.clone();
    pfx.puff(p.clone().setY(TOP + .3), { n: 12, color: [protos[m.s].col, '#ffffff'], size: .32, speed: 2.4 });
    tween(.3, t => { const k = 1 - ease(t); g.scale.setScalar(Math.max(.001, k)); g.position.y = p.y + t * .8; g.rotation.y = t * 2.5; }, () => boardG.remove(g));
  }
  function clearMarks(sweep) {
    const all = [...marks.entries()]; marks.clear();
    all.forEach(([c, m], i) => {
      if (!sweep || reduced) { boardG.remove(m.g); return; }
      const g = m.g, y = g.position.y;
      tween(.32, t => { const k = 1 - ease(t); g.scale.setScalar(Math.max(.001, k)); g.position.y = y + Math.sin(t * Math.PI) * .5; }, () => boardG.remove(g), i * .04);
    });
  }
  // the bar through a winning line
  let bar = null;
  function showBar(line, s) {
    hideBar();
    const a = cellPos(line[0]), b = cellPos(line[line.length - 1]), len = a.distanceTo(b) + cell * .8;
    bar = new THREE.Mesh(new THREE.BoxGeometry(len, .14, cell * .16), new THREE.MeshBasicMaterial({ color: '#fff6c9', transparent: true, opacity: .95 }));
    bar.position.copy(a).add(b).multiplyScalar(.5); bar.position.y = TOP + .62; bar.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); bar.scale.x = .001; boardG.add(bar);
    const mine = bar; tween(.35, t => { mine.scale.x = Math.max(.001, ease(t)); }, null, .25);
    line.forEach((c, i) => { const m = marks.get(c); if (m) m.g.userData.hop = -.01 - i * .12; });
    const mid = bar.position.clone(); pfx.confetti(mid.clone().setY(2.2), { n: 70, w: 4, h: 2.2, s }); pfx.burst(mid.clone().setY(1.2), { n: 16, colors: ['#ffd84a', '#ffffff', protos[s]?.col || '#fff'], speed: 4, up: 4, size: .28 });
    shake.kick(.14);
  }
  function hideBar() { if (!bar) return; boardG.remove(bar); bar.geometry.dispose(); bar.material.dispose(); bar = null; }

  // ---------- seats ----------
  let me = -1, seats = [], seatKey = '';
  const side = i => ((me >= 0 ? i === me : i === 0) ? -1 : 1); // you sit on the left; watchers see seat 1 there
  const ringGeo = new THREE.TorusGeometry(.95, .06, 6, 28); ringGeo.rotateX(Math.PI / 2);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  // On a wide screen the players sit at the left and right of the table. On a tall one (a phone) there is no room
  // beside it, so they sit behind it, at the far corners, and the board can fill the width.
  let tall = false;
  const seatAt = sd => (tall ? { x: sd * 2.5, z: -(B / 2 + 2.1) } : { x: sd * SEAT_X, z: .5 });
  function seatPlace(s) {
    const { x, z } = seatAt(s.sd); s.x = x; s.z = z;
    s.av.position.set(x, -.15, z); s.av.lookAt(tall ? x * .6 : 0, -.15, tall ? 4 : 2.6);
    s.stool.position.set(x, -.95, z); s.ring.position.set(x, -2.3, z);
  }
  function makeAv(p) { const av = avatar3d(p.color, p.av); scene.add(av); return av; }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    seats = list.map((p, i) => {
      const x = 0, av = makeAv(p);
      const stool = new THREE.Group(); scene.add(stool);
      put(new THREE.CylinderGeometry(.6, .52, .22, 8), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.1, .14, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), x, -2.3, .5, scene); ring.scale.setScalar(1.25);
      const s = { av, stool, ring, sd: side(i), x: 0, z: 0, hop: 0, nod: 0, active: false, key: p.color + (p.av || []).join('') };
      seatPlace(s); return s;
    });
  }

  // ---------- pointer: which square is under it ----------
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  function cellAt(px, py) {
    if (!n || !W) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const q = Math.floor(hit.x / cell + n / 2), row = Math.floor(hit.z / cell + n / 2);
    return q < 0 || q >= n || row < 0 || row >= n ? -1 : row * n + q;
  }
  let hover = -1, hoverS = -1, ghost = null;
  function setHover(c, s) { // s: the seat whose mark to show, or -1 for none
    if (c >= 0 && (s < 0 || marks.has(c))) c = -1;
    if (c === hover && s === hoverS) return;
    if (hover >= 0 && tiles[hover]) tiles[hover].material = tileMats[tiles[hover].userData.base];
    if (ghost) { boardG.remove(ghost); ghost = null; }
    hover = c; hoverS = s;
    if (c < 0 || !protos[s]) return;
    tiles[c].material = hotMat;
    ghost = makeMark(s, true); const p = cellPos(c); ghost.position.set(p.x, ghost.userData.y + .12, p.z); boardG.add(ghost);
  }

  // ---------- state from the server ----------
  let S = null, gid = '', mv = -1, round = 0, fadeCell = -1;
  function syncMarks(st) { // make the board match the server's, whatever was missed
    for (const [c, m] of [...marks]) if (st.board[c] !== m.s) removeMark(c, false);
    st.board.forEach((s, c) => { if (s >= 0 && !marks.has(c)) addMark(c, s, false); });
  }
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    const fresh = st.gid !== gid;
    if (st.n !== n) { marks.clear(); tweens.length = 0; hover = -1; ghost = null; bar = null; buildBoard(st.n); }
    if (key !== seatKey || protoN !== n) {
      const rebuilt = st.me !== me || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) buildSeats(list);
      else list.forEach((p, i) => { // someone came back or left: swap that avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        scene.remove(s.av); disposeAvatar(s.av); s.av = makeAv(p); seatPlace(s); s.hop = 1; s.key = k;
      });
      const cols = list.map(p => p.color);
      if (protoN !== n || protos.some((p, i) => p.col !== cols[i])) { const had = [...marks.keys()]; for (const c of had) removeMark(c, false); setHover(-1, -1); buildProtos(cols); }
    }
    if (fresh) {
      gid = st.gid; mv = st.mv; round = st.round; tweens.length = 0; hideBar(); clearMarks(false); setHover(-1, -1);
      syncMarks(st);
      if (st.line) showBar(st.line, st.roundWin);
    } else if (st.round !== round) { // a new round: sweep the board clean
      round = st.round; mv = st.mv; hideBar(); clearMarks(true); setHover(-1, -1);
      st.board.forEach((s, c) => { if (s >= 0) addMark(c, s, true); });
    } else if (st.mv !== mv) {
      mv = st.mv;
      const last = st.last;
      if (last) {
        if (last.gone >= 0) removeMark(last.gone, true);
        if (hover === last.c) setHover(-1, -1);
        addMark(last.c, last.s, true);
        if (seats[last.s]) seats[last.s].hop = .6;
      }
      syncMarks(st);
      if (st.line && !bar) { showBar(st.line, st.roundWin); if (seats[st.roundWin]) seats[st.roundWin].hop = 1; if (seats[1 - st.roundWin]) seats[1 - st.roundWin].nod = 2; }
    }
    // the mark that goes when the player to move puts down their next one
    fadeCell = st.stage === 'play' ? st.fade : -1;
    for (const [c, m] of marks) setGhost(m.g, c === fadeCell);
    list.forEach((p, i) => { if (seats[i]) seats[i].active = st.turn === i && st.stage === 'play'; });
    if (st.ph === 'end' && S?.ph !== 'end' && st.win >= 0 && seats[st.win]) { seats[st.win].hop = 1; const top = seats[st.win].av.position.clone().setY(2.3); pfx.confetti(top, { n: 80, w: 3, h: 2.2, s: st.win }); }
    for (const t of tiles) if (t.material === winMat) t.material = tileMats[t.userData.base];
    if (st.line) for (const c of st.line) if (tiles[c]) tiles[c].material = winMat;
    S = st;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 110;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, .2, 0);
  const DIR = new THREE.Vector3(0, 1.2, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    if (portrait !== tall) { tall = portrait; for (const s of seats) seatPlace(s); }
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 190 : 150, bottom = Math.max(top + 120, h - hudBottom), sx = portrait ? B / 2 + .75 : SEAT_X + 2; // on phones the players may sit right at the edges
    const FIT = [portrait ? new THREE.Vector3(0, 2.9, -(B / 2 + 2.1)) : new THREE.Vector3(0, 2.7, .5), new THREE.Vector3(0, TOP, B / 2 + 1.1), new THREE.Vector3(-sx, 1.2, .5), new THREE.Vector3(sx, 1.2, .5), new THREE.Vector3(0, TOP, -B / 2 - .6)];
    let lo = 5, hi = 90;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; place(D);
      const ty = Math.min(toPx(FIT[0])[1], toPx(FIT[4])[1]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && lx >= 4 && rx <= w - 4) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    const ty = Math.min(toPx(FIT[0])[1], toPx(FIT[4])[1]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, 0, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastNow = 0;
  const tv = new THREE.Vector3();
  const info = { tags: [] };
  function loop(dt, now) {
    if (dead) return;
    resize();
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    for (let i = 0; i < tweens.length; i++) { // oldest first, so a later tween wins
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * .7);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop, look: tall ? 0 : s.x < 0 ? .35 : -.35, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1.25 + Math.sin(T * 4) * .04);
    });
    // marks: the one about to vanish blinks, the ones in a winning line hop
    for (const [c, m] of marks) {
      const u = m.g.userData;
      if (c === fadeCell && !reduced) m.g.scale.setScalar(.9 + Math.sin(T * 7) * .06); else if (u.fade === false && m.g.scale.x < 1 && m.g.scale.x > .8) m.g.scale.setScalar(1);
      if (u.hop !== 0 && bar) { u.hop += dt * 1.6; const k = u.hop > 0 ? u.hop % 1.2 : 0; m.g.position.y = u.y + (k < .5 ? Math.sin(k * 2 * Math.PI) * .45 : 0); }
    }
    if (ghost && !reduced) ghost.position.y = ghost.userData.y + .16 + Math.sin(T * 5) * .05;
    if (hover >= 0) hotMat.emissive?.setScalar(.05 + Math.sin(T * 6) * .04);
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .12), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    seats.forEach((s, i) => { // where the HUD draws the name tags
      const t = info.tags[i] ||= { x: 0, y: 0 };
      tv.set(s.x, 2.45, s.z).project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, cellAt, setHover,
    cellPx(c) { if (!n) return null; tv.copy(cellPos(c)).project(camera); return { x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H }; },
    setHud(px) { if (Math.abs(px - hudBottom) > 6) { hudBottom = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const p of protos) { p.solid.traverse(o => { if (o.userData.ink) o.geometry.dispose(); }); p.ghost.dispose(); }
      hideBar(); boardG?.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      pfx.dispose(); xGeo?.dispose(); oGeo?.dispose(); ringGeo.dispose(); hotMat.dispose(); winMat.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

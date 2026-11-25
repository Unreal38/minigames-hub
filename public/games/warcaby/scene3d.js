// Warcaby 3D table (three.js): a chunky board on a table on a sky island, the two players' avatars on stools, and
// round blocky draughts pieces. Cream plays against dark chocolate (or the players' chess sets from the Wardrobe);
// the band round each piece's foot is its player's own colour, and a king is two pieces stacked with a little crown.
// Purely visual: it draws what the server sends and tells the HUD which square is under the pointer.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { chessLook } from '../../pieceskins.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const B = .76 * 8;              // board width (the same as the chessboard: a 10x10 board has smaller squares)
const TOP = .22;                // height of the playing surface
const EDGE = .34;               // the frame round the squares (it carries the letters and numbers)
const SEAT_X = B / 2 + 2.0;     // how far out the players sit on a wide screen
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const LIGHT = '#f8eed2', DARK = '#86b56b';
const MAN_H = .2, KING_H = .48; // how tall a piece stands, in squares (for picking)

// ---------- piece models ----------
// A man: a thick round disc with a ridge on top. A king: two discs and a little crown. `cell` is the square's width.
export function pieceModel(king, side, ring, set = 0, cell = B / 10) {
  const g = new THREE.Group(), U = cell;
  const { body, shade, trim, gold } = chessLook(set, side);
  let y = 0;
  const add = (geo, col, x, yy, z) => { const m = new THREE.Mesh(geo, M(col)); m.position.set(x * U, yy * U, z * U); m.castShadow = true; g.add(m); return m; };
  const cyl = (rt, rb, h, col = body, seg = 14) => { const m = add(new THREE.CylinderGeometry(rt * U, rb * U, h * U, seg), col, 0, y + h / 2, 0); y += h; return m; };
  const disc = () => {
    cyl(.4, .4, .045, ring); cyl(.42, .4, .1); cyl(.36, .42, .03, shade);
    // the ridge round the top and a button in the middle
    const t = new THREE.TorusGeometry(.27 * U, .035 * U, 4, 14); t.rotateX(Math.PI / 2); add(t, trim, 0, y + .005, 0);
    add(new THREE.CylinderGeometry(.12 * U, .14 * U, .03 * U, 10), trim, 0, y + .015, 0);
  };
  disc();
  if (king) {
    y += .03; disc(); y += .02;
    cyl(.22, .24, .05, gold, 10);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5, m = add(new THREE.ConeGeometry(.065 * U, .16 * U, 4), gold, Math.cos(a) * .17, y + .07, Math.sin(a) * .17); m.rotation.y = -a; }
    add(new THREE.IcosahedronGeometry(.07 * U, 0), ring, 0, y + .04, 0);
  }
  bake(g); toonify(g, .028);
  return g;
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.55); sun.position.set(5, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island and the table ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 24, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const land = island(18, 18, { round: true, rim: 4.4, seed: 64, props: 18, size: 1.7, flowers: 60 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 50, 13, 4, 1.6), drift = petals(scene, 24, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  { // a round wooden deck, a square table with chunky legs, and a few things lying about
    const R = 9.4;
    const deck = put(new THREE.CylinderGeometry(R, R, .16, 28), M('#e9d3a7'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = -7; i <= 7; i++) { const w = Math.sqrt(Math.max(0, (R - .1) ** 2 - (i * 1.18 + .59) ** 2)) * 2; if (w > .2) put(new THREE.BoxGeometry(w, .02, .1), M('#d6bb88'), 0, -2.33, i * 1.18 + .59); }
    const rim = new THREE.TorusGeometry(R, .14, 6, 28); rim.rotateX(Math.PI / 2); put(rim, M('#c9a26b'), 0, -2.36, 0);
    const W = B + EDGE * 2 + 1.1;
    const top = put(new THREE.BoxGeometry(W, .34, W), M('#b9794a'), 0, -.19, 0); top.castShadow = top.receiveShadow = true;
    put(new THREE.BoxGeometry(W - .4, .04, W - .4), M('#cf9460'), 0, -.01, 0).receiveShadow = true;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(new THREE.BoxGeometry(.5, 2.1, .5), M('#a86a42'), sx * (W / 2 - .5), -1.38, sz * (W / 2 - .5)).castShadow = true;
    // a crate with stacks of spare pieces, a stack of books and two mugs
    const crate = new THREE.Group(); crate.position.set(7.2, -2.34, -4.6); crate.rotation.y = -.4; room.add(crate);
    put(new THREE.BoxGeometry(1.5, .8, 1.1), M('#c99763'), 0, .4, 0, crate).castShadow = true; put(new THREE.BoxGeometry(1.6, .12, .14), M('#a86a42'), 0, .5, .56, crate); put(new THREE.BoxGeometry(1.6, .12, .14), M('#a86a42'), 0, .2, .56, crate);
    for (let i = 0; i < 4; i++) { put(new THREE.CylinderGeometry(.28, .28, .1, 12), M('#fffaf0'), -.32, .86 + i * .11, 0, crate); put(new THREE.CylinderGeometry(.28, .28, .1, 12), M('#4d362e'), .36, .86 + i * .11, .08, crate); }
    const books = new THREE.Group(); books.position.set(-7.3, -2.34, -4.2); books.rotation.y = .5; room.add(books);
    [['#e5543b', 0], ['#3f8fe0', .22], ['#ffc93c', .44]].forEach(([c, yy], i) => { const b = put(new THREE.BoxGeometry(1.3 - i * .12, .2, .95 - i * .08), M(c), 0, yy + .1, 0, books); b.rotation.y = i * .18; b.castShadow = true; });
    put(new THREE.CylinderGeometry(.2, .15, .3, 8), M('#ff8fab'), 6.6, -2.19, 5.0); put(new THREE.CylinderGeometry(.2, .15, .3, 8), M('#ffc94d'), -6.4, -2.19, 5.2);
    bake(room); toonify(room, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- the board (built again when the table switches between 10x10 and 8x8) ----------
  let N = 0, CELL = B / 10;
  let flip = false; // true when the viewer plays Black: the board is turned so their pieces are nearest
  const sqPos = (s, out = new THREE.Vector3()) => { const c = s % N, r = Math.floor(s / N), h = (N - 1) / 2; return out.set((flip ? h - c : c - h) * CELL, TOP, (flip ? r - h : h - r) * CELL); };
  const boardG = new THREE.Group(); scene.add(boardG);
  const tiles = new THREE.Group(); boardG.add(tiles);
  {
    const frame = put(new THREE.BoxGeometry(B + EDGE * 2, TOP + .04, B + EDGE * 2), M('#8a5a3c'), 0, TOP / 2 - .04, 0, boardG); frame.castShadow = frame.receiveShadow = true;
    bake(boardG); toonify(boardG, .035);
  }
  // letters and numbers along the near and left edges, redrawn when the board turns
  const labelTex = [0, 1].map(k => { const cv = document.createElement('canvas'); cv.width = k ? 48 : 1024; cv.height = k ? 1024 : 48; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; });
  const labelMat = labelTex.map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  {
    const g1 = new THREE.PlaneGeometry(B, B * 48 / 1024); g1.rotateX(-Math.PI / 2);
    put(g1, labelMat[0], 0, TOP + .005, B / 2 + EDGE / 2, boardG);
    const g2 = new THREE.PlaneGeometry(B * 48 / 1024, B); g2.rotateX(-Math.PI / 2);
    put(g2, labelMat[1], -B / 2 - EDGE / 2, TOP + .005, 0, boardG);
  }
  function drawLabels() {
    const w = 1024 / N;
    labelTex.forEach((t, k) => {
      const cv = t.image, g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
      g.font = `700 ${N > 8 ? 34 : 38}px Rubik, Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe9c4';
      for (let i = 0; i < N; i++) {
        // k 0: columns left to right along the near edge; k 1: rows down the left edge, the far one first
        const txt = k === 0 ? 'abcdefghij'[flip ? N - 1 - i : i] : String(flip ? i + 1 : N - i);
        if (k === 0) g.fillText(txt, (i + .5) * w, 25); else g.fillText(txt, 24, (i + .5) * w + 2);
      }
      t.needsUpdate = true;
    });
  }

  // highlights: flat tiles just above the squares, dots on squares a piece can go to, red rings round pieces it will take,
  // pulsing orange rings round the pieces that must take
  let flatGeo = null, dotGeo = null, ringGeoT = null;
  const hiMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  const mats = { hov: hiMat('#7fdcff', .75), last: hiMat('#ffe14d', .55), sel: hiMat('#ffb020', .8), must: hiMat('#ff9a1f', .9), step: hiMat('#ffb020', .5), cur: hiMat('#4fb4ff', .6), dot: hiMat('#3b2219', .55), ring: hiMat('#e5402f', .9) };
  const hi = {};
  const tile = k => { const m = new THREE.Mesh(flatGeo, mats[k]); m.visible = false; m.renderOrder = 2; boardG.add(m); return m; };
  const showTile = (m, s) => { m.visible = s >= 0; if (s >= 0) { sqPos(s, m.position); m.position.y = TOP + .008; } };
  const marks = []; // pooled dots, rings and tiles: { mesh, kind }
  function setMarks(list) { // list of { s, kind: 'dot' | 'ring' | 'must' | 'step' | 'last' }
    let i = 0;
    for (const { s, kind } of list) {
      let m = marks[i++];
      if (!m) { m = new THREE.Mesh(dotGeo, mats.dot); boardG.add(m); marks.push(m); }
      const round = kind === 'dot' || kind === 'ring' || kind === 'must';
      m.geometry = kind === 'dot' ? dotGeo : round ? ringGeoT : flatGeo; m.material = mats[kind]; m.renderOrder = round ? 3 : 2;
      sqPos(s, m.position); m.position.y = TOP + (round ? .012 : .006); m.visible = true;
    }
    for (; i < marks.length; i++) marks[i].visible = false;
  }
  function buildBoard(n) {
    N = n; CELL = B / n;
    tiles.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } }); tiles.clear();
    const tg = new THREE.BoxGeometry(CELL, .06, CELL), h = (n - 1) / 2;
    for (let s = 0; s < n * n; s++) { const c = s % n, r = Math.floor(s / n); const t = put(tg, M((r + c) % 2 ? LIGHT : DARK), (c - h) * CELL, TOP - .03, (h - r) * CELL, tiles); t.receiveShadow = true; }
    bake(tiles); toonify(tiles, .03);
    tiles.traverse(o => { if (o.isMesh && !o.userData.ink) o.receiveShadow = true; });
    for (const g of [flatGeo, dotGeo, ringGeoT]) g?.dispose();
    flatGeo = new THREE.PlaneGeometry(CELL, CELL); flatGeo.rotateX(-Math.PI / 2);
    dotGeo = new THREE.CircleGeometry(CELL * .2, 14); dotGeo.rotateX(-Math.PI / 2);
    ringGeoT = new THREE.RingGeometry(CELL * .45, CELL * .57, 24); ringGeoT.rotateX(-Math.PI / 2);
    for (const k of Object.keys(hi)) { boardG.remove(hi[k]); }
    for (const k of ['lastF', 'lastT', 'sel', 'cur', 'hov']) hi[k] = tile(k === 'lastF' || k === 'lastT' ? 'last' : k);
    for (const m of marks) boardG.remove(m); marks.length = 0;
  }

  // ---------- pieces ----------
  let protos = new Map(), protoKey = '';
  const pieces = new Map(); // square -> { g, p }
  function buildProtos(ringW, ringB, setW = 0, setB = 0) {
    for (const g of protos.values()) g.traverse(o => o.geometry?.dispose());
    protos = new Map();
    for (let side = 0; side < 2; side++) for (let t = 1; t <= 2; t++) protos.set(t | side << 2, pieceModel(t === 2, side, side ? ringB : ringW, side ? setB : setW, CELL));
  }
  function addPiece(s, p) {
    dropPiece(s);
    const g = protos.get(p).clone(); sqPos(s, g.position); g.position.y = TOP;
    g.userData = { lift: 0 };
    boardG.add(g); pieces.set(s, { g, p });
    return g;
  }
  function dropPiece(s) { const x = pieces.get(s); if (x) { boardG.remove(x.g); pieces.delete(s); } }
  const dying = new Set(); // taken pieces still on their way out
  function hardSync(b) {
    tweens.length = 0;
    for (const g of dying) boardG.remove(g); dying.clear();
    for (const [s, x] of [...pieces]) if (b[s] !== x.p) dropPiece(s); else { sqPos(s, x.g.position); x.g.position.y = TOP; x.g.scale.setScalar(1); x.g.rotation.set(0, 0, 0); }
    for (let s = 0; s < b.length; s++) if (b[s] && !pieces.has(s)) addPiece(s, b[s]);
  }
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });
  function poof(x, side) {
    const g = x.g, p = g.position.clone(), gone = () => { boardG.remove(g); dying.delete(g); };
    if (reduced) return gone();
    pfx.puff(p.clone().setY(TOP + .25), { n: 9, color: [side ? '#7a5a4a' : '#fff4e2', '#ffffff'], size: .22, speed: 2.2 });
    tween(.26, t => { const k = 1 - ease(t); g.scale.setScalar(Math.max(.001, k)); g.position.y = p.y + t * .5; g.rotation.y = t * 2.2; }, gone);
  }
  function hop(x, from, to, { h = .3, dur = .28, delay = 0, done } = {}) {
    const a = sqPos(from), b = sqPos(to), g = x.g;
    if (reduced) { tween(.001, () => {}, () => { g.position.set(b.x, TOP, b.z); done?.(); }, delay); return; }
    tween(dur, t => { const e = ease(t); g.position.set(a.x + (b.x - a.x) * e, TOP + Math.sin(t * Math.PI) * h, a.z + (b.z - a.z) * e); },
      () => { g.position.set(b.x, TOP, b.z); pfx.ring(b.clone().setY(TOP + .03), { color: '#fff6c9', size: CELL * .55 }); done?.(); }, delay);
  }
  // One move, shown: the piece hops from square to square, each taken piece pops as it is jumped (they all stay
  // until the move is over in the rules, but popping them one by one reads better), and a crowned man grows its crown.
  function animateMove(next, last) {
    const x = pieces.get(last.f); if (!x) return hardSync(next);
    pieces.delete(last.f);
    const path = last.path, caps = last.caps || [];
    const long = Math.max(...path.slice(1).map((s, i) => Math.abs((s % N) - (path[i] % N))));
    const dur = caps.length ? .3 : long > 1 ? .34 : .26;
    let at = 0;
    for (let i = 1; i < path.length; i++) {
      const v = caps[i - 1], vp = v !== undefined ? pieces.get(v) : null;
      if (vp) { pieces.delete(v); dying.add(vp.g); tween(.01, () => {}, () => { poof(vp, vp.p >> 2); shake.kick(.05 + Math.min(.06, i * .015)); }, at + dur * .55); }
      hop(x, path[i - 1], path[i], { h: caps.length ? .55 : .22, dur, delay: at });
      at += dur + (reduced ? 0 : .04);
    }
    pieces.set(last.t, x);
    tween(.01, () => {}, () => {
      if (next[last.t] !== x.p) { // crowned
        dropPiece(last.t); const g = addPiece(last.t, next[last.t]);
        pfx.burst(sqPos(last.t).setY(TOP + .5), { n: 16, colors: ['#ffd84a', '#ffffff'], speed: 3.5, up: 3.5, size: .22 });
        if (!reduced) { g.scale.setScalar(.4); tween(.3, k => g.scale.setScalar(.4 + .6 * ease(k)), () => g.scale.setScalar(1)); }
      }
    }, at);
    // anything the story above missed: put the board right once the pieces have landed (against the newest board)
    tween(.01, () => {}, () => { for (let s = 0; s < board.length; s++) if ((pieces.get(s)?.p || 0) !== board[s]) return hardSync(board); }, at + .45);
  }

  // ---------- seats ----------
  let me = -1, white = 0, seats = [], seatKey = '';
  const left = i => (me >= 0 ? i === me : i === white); // you sit on the left; watchers see White there
  const ringGeo = new THREE.TorusGeometry(.95, .06, 6, 28); ringGeo.rotateX(Math.PI / 2);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  // On a wide screen the players sit at the left and right of the table. On a tall one (a phone) there is no room
  // beside it, so they sit behind it, at the far corners, and the board can fill the width.
  let tall = false;
  const seatAt = sd => (tall ? { x: sd * 2.4, z: -(B / 2 + EDGE + 2.0) } : { x: sd * SEAT_X, z: -.5 });
  function seatPlace(s) {
    const { x, z } = seatAt(s.sd); s.x = x; s.z = z;
    s.av.position.set(x, -.15, z); s.av.lookAt(tall ? x * .6 : 0, -.15, tall ? 4 : 3.2);
    s.stool.position.set(x, -.95, z); s.ring.position.set(x, -2.3, z);
  }
  function makeAv(p) { const av = avatar3d(p.color, p.av); scene.add(av); return av; }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    seats = list.map((p, i) => {
      const av = makeAv(p);
      const stool = new THREE.Group(); scene.add(stool);
      put(new THREE.CylinderGeometry(.6, .52, .22, 8), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.1, .14, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), 0, -2.3, .5, scene); ring.scale.setScalar(1.25);
      const s = { av, stool, ring, sd: left(i) ? -1 : 1, x: 0, z: 0, hop: 0, nod: 0, active: false, key: p.color + (p.av || []).join('') };
      seatPlace(s); return s;
    });
  }

  // ---------- pointer: which square is under it ----------
  // Every piece the ray passes is a candidate (as a short upright stick about as thick as the piece), and so is the
  // square the ray lands on. `want(s)` says which squares a tap could do something with: only those compete, a solid
  // hit on the nearest of them wins, otherwise the floor square, otherwise the one whose middle the ray passes closest.
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  function squareAt(px, py, want) {
    if (!W || !N) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const cands = [];
    for (const [s, x] of pieces) {
      const rad = CELL * .42;
      sqPos(s, _a); _a.y = TOP; _b.copy(_a); _b.y = TOP + ((x.p & 3) === 2 ? KING_H : MAN_H) * CELL;
      const d2 = ray.ray.distanceSqToSegment(_a, _b, _c, _d);
      if (d2 < rad * rad) cands.push({ s, score: d2 / (rad * rad), d: _c.distanceTo(ray.ray.origin) });
    }
    let floor = -1;
    if (ray.ray.intersectPlane(plane, hit)) {
      const cx = Math.floor(hit.x / CELL + N / 2), cz = Math.floor(hit.z / CELL + N / 2);
      if (cx >= 0 && cx < N && cz >= 0 && cz < N) floor = flip ? cz * N + (N - 1 - cx) : (N - 1 - cz) * N + cx;
    }
    const byNear = (a, b) => a.d - b.d;
    if (want) {
      const ok = cands.filter(c => want(c.s));
      const solid = ok.filter(c => c.score < .5).sort(byNear)[0];
      if (solid) return solid.s;
      if (floor >= 0 && want(floor)) return floor;
      if (ok.length) return ok.sort((a, b) => a.score - b.score)[0].s;
    }
    cands.sort(byNear);
    return cands.length ? cands[0].s : floor;
  }
  // sel: the picked piece; list: the marks that go with it (where it can go, what it will take, the steps tapped so far)
  let sel = -1, selMarks = [], mustMarks = [];
  function paintMarks() { setMarks(sel >= 0 ? selMarks : mustMarks); }
  function setSelect(s, list = []) { sel = s; selMarks = list; showTile(hi.sel, s); if (hov >= 0) showTile(hi.hov, hov === sel ? -1 : hov); paintMarks(); }
  // pieces that can take (taking is compulsory), shown while nothing is picked
  function setMust(list) { mustMarks = list.map(s => ({ s, kind: 'must' })); paintMarks(); }
  function setCursor(s) { showTile(hi.cur, s); }
  // the piece or square under the mouse: a pale tile, and the piece rises a little and swells
  let hov = -1;
  function setHover(s) { if (s === hov) return; hov = s; showTile(hi.hov, s === sel ? -1 : s); }

  // ---------- state from the server ----------
  let S = null, gid = '', mvN = -1, board = null;
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me + '/' + st.white;
    const fresh = st.gid !== gid;
    const vf = st.me >= 0 ? st.me !== st.white : false;
    let rebuilt = false;
    if (key !== seatKey) {
      const again = st.me !== me || st.white !== white || !seats.length;
      me = st.me; white = st.white; seatKey = key;
      if (again) buildSeats(list);
      else list.forEach((p, i) => { // someone came back or left: swap that avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        scene.remove(s.av); disposeAvatar(s.av); s.av = makeAv(p); seatPlace(s); s.hop = 1; s.key = k;
      });
    }
    if (st.size !== N) { for (const s of [...pieces.keys()]) dropPiece(s); buildBoard(st.size); protoKey = ''; board = null; rebuilt = true; }
    { const W = list[st.white], Bk = list[1 - st.white], pk = W.color + '|' + Bk.color + '|' + (W.fl?.cs | 0) + '|' + (Bk.fl?.cs | 0); // each side wears its player's chess set
      if (pk !== protoKey) { protoKey = pk; for (const s of [...pieces.keys()]) dropPiece(s); buildProtos(W.color, Bk.color, W.fl?.cs | 0, Bk.fl?.cs | 0); rebuilt = true; } }
    if (vf !== flip || !board) { flip = vf; drawLabels(); rebuilt = true; }
    const b = st.pos.b;
    if (fresh || rebuilt) { gid = st.gid; mvN = st.mv; setSelect(-1); setMust([]); hardSync(b); }
    else if (st.mv !== mvN) {
      board = b.slice();
      if (st.mv === mvN + 1 && st.last) { animateMove(b, st.last); if (seats[st.last.s]) seats[st.last.s].hop = .5; }
      else hardSync(b);
      mvN = st.mv;
    }
    board = b.slice();
    showTile(hi.lastF, st.last ? st.last.f : -1); showTile(hi.lastT, st.last ? st.last.t : -1);
    list.forEach((p, i) => { if (seats[i]) seats[i].active = st.turn === i; });
    if (st.ph === 'end' && S && S.ph !== 'end') {
      if (st.win >= 0 && seats[st.win]) {
        seats[st.win].hop = 1; if (seats[1 - st.win]) seats[1 - st.win].nod = 2;
        const top = seats[st.win].av.position.clone().setY(2.3); pfx.confetti(top, { n: 80, w: 3, h: 2.2, s: st.win });
      } else for (const s of seats) s.nod = 1.4;
    }
    S = st;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 120;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, .2, 0);
  const DIR = new THREE.Vector3(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    if (portrait !== tall) { tall = portrait; for (const s of seats) seatPlace(s); }
    DIR.set(0, portrait ? 1.65 : 1.12, 1).normalize(); // steep enough that pieces do not hide the squares behind them
    camera.aspect = w / h; camera.fov = portrait ? 46 : 34; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 196 : 96, bottom = Math.max(top + 120, h - hudBottom), half = B / 2 + EDGE;
    const sx = portrait ? half + .1 : SEAT_X + 1.15, sz = portrait ? 0 : -.5;
    const FIT = [portrait ? new THREE.Vector3(0, 2.7, -(half + 2.0)) : new THREE.Vector3(0, 1.3, -half), new THREE.Vector3(0, TOP, half + .15), new THREE.Vector3(-sx, portrait ? TOP : 2.2, sz), new THREE.Vector3(sx, portrait ? TOP : 2.2, sz), new THREE.Vector3(0, TOP, -half - .2)];
    let lo = 5, hi2 = 110;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi2) / 2; place(D);
      const ty = Math.min(toPx(FIT[0])[1], toPx(FIT[4])[1]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && lx >= 4 && rx <= w - 4) hi2 = D; else lo = D;
    }
    place(hi2); camBase.copy(camera.position);
    scene.fog.near = hi2 + 20; scene.fog.far = hi2 + 130;
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
    // the picked piece floats a little
    for (const [s, x] of pieces) {
      const u = x.g.userData, want = s === sel ? 1 : s === hov ? .6 : 0;
      if (u.lift !== want) { u.lift += Math.sign(want - u.lift) * Math.min(Math.abs(want - u.lift), dt * 9); if (!tweens.length) { x.g.position.y = TOP + u.lift * .14; x.g.scale.setScalar(1 + Math.min(u.lift, .6) * .2); } }
      else if (want === 1 && !reduced && !tweens.length) x.g.position.y = TOP + .16 + Math.sin(T * 5) * .025;
    }
    mats.must.opacity = .7 + Math.sin(T * 5) * .25;
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .08), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .03), camBase.z);
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
    setState, squareAt, setSelect, setMust, setCursor, setHover,
    squarePx(s, h = .5) { sqPos(s, tv); tv.y = TOP + h; tv.project(camera); return { x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H }; },
    flipped: () => flip,
    setHud(px) { if ((Math.abs(px - hudBottom) > 6) && hudFitOk(canvas)) { hudBottom = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const g of protos.values()) g.traverse(o => o.geometry?.dispose());
      boardG.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      for (const t of labelTex) t.dispose(); for (const m of labelMat) m.dispose(); for (const m of Object.values(mats)) m.dispose();
      pfx.dispose(); ringGeo.dispose(); for (const g of [flatGeo, dotGeo, ringGeoT]) g?.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

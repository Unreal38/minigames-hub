// Chess 3D table (three.js): a chunky board on a table on a sky island, the two players' avatars on stools, and
// blocky low-poly pieces with the classic shapes. Cream plays against dark chocolate; the ring at each piece's foot is
// its player's own colour. Purely visual: it draws what the server sends and tells the HUD which square is under the pointer.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene, roundDeck } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
import { chessLook } from '../../pieceskins.js';
const CELL = .76, B = CELL * 8; // square and board width
const TOP = .22;                // height of the playing surface
const EDGE = .34;               // the frame round the squares (it carries the letters and numbers)
const SEAT_X = B / 2 + 2.0;     // how far out the players sit on a wide screen
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const LIGHT = '#f8eed2', DARK = '#86b56b';
export const HEIGHT = [0, .62, .78, .9, .74, .96, 1.12]; // roughly how tall each piece stands (for picking and name tags)

// ---------- piece models ----------
// Built from a few boxes and eight-sided columns in units of one square, facing left (the knight's nose points at -x).
export function pieceModel(type, side, ring, set = 0) { // set: the chess set its player wears (Wardrobe, kind cs)
  const g = new THREE.Group(), U = CELL * .98;
  const { body, shade, trim, gold, slot } = chessLook(set, side);
  let y = 0;
  const add = (geo, col, x, yy, z) => { const m = new THREE.Mesh(geo, M(col)); m.position.set(x * U, yy * U, z * U); m.castShadow = true; g.add(m); return m; };
  const cyl = (rt, rb, h, col = body, seg = 8) => { const m = add(new THREE.CylinderGeometry(rt * U, rb * U, h * U, seg), col, 0, y + h / 2, 0); m.rotation.y = Math.PI / 8; y += h; return m; };
  const box = (w, h, d, x, yy, z, col = body) => add(new THREE.BoxGeometry(w * U, h * U, d * U), col, x, yy, z);
  cyl(.37, .39, .07, ring); cyl(.31, .35, .08, shade);
  if (type === 1) { // pawn: a short column and a round head
    cyl(.17, .27, .24); cyl(.24, .24, .05, trim);
    add(new THREE.IcosahedronGeometry(.19 * U, 1), body, 0, y + .15, 0);
  } else if (type === 4) { // rook: a tower with a square top and a block on each corner
    cyl(.22, .29, .42); cyl(.3, .26, .08, trim);
    box(.58, .12, .58, 0, y + .06, 0); y += .12;
    for (const [x, z] of [[.2, .2], [-.2, .2], [.2, -.2], [-.2, -.2]]) box(.19, .14, .19, x, y + .07, z);
    box(.34, .03, .34, 0, y + .012, 0, shade);
  } else if (type === 2) { // knight: a blocky horse head in profile, nose to the left
    cyl(.24, .29, .16); cyl(.29, .29, .05, trim);
    box(.26, .46, .3, .07, y + .2, 0).rotation.z = .28;                 // neck
    box(.3, .26, .3, -.06, y + .5, 0).rotation.z = .3;                   // head
    box(.26, .17, .22, -.28, y + .39, 0).rotation.z = .3;                // nose
    box(.09, .5, .12, .23, y + .3, 0, slot).rotation.z = .28;            // mane
    for (const z of [-.1, .1]) box(.09, .16, .08, .06, y + .7, z);       // ears
    for (const z of [-.155, .155]) box(.07, .07, .02, -.08, y + .55, z, slot); // eyes
  } else if (type === 3) { // bishop: a pointed hat with a slanted notch
    cyl(.16, .27, .4); cyl(.25, .25, .05, trim); cyl(.21, .16, .09);
    cyl(.07, .21, .3);
    box(.05, .2, .46, .04, y - .13, 0, slot).rotation.z = -.7;
    add(new THREE.IcosahedronGeometry(.08 * U, 0), gold, 0, y + .05, 0);
  } else if (type === 5) { // queen: a tall body and a spiked crown
    cyl(.18, .29, .58); cyl(.27, .27, .05, trim); cyl(.31, .19, .17);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8, m = add(new THREE.ConeGeometry(.07 * U, .2 * U, 4), trim, Math.cos(a) * .26, y + .08, Math.sin(a) * .26); m.rotation.y = -a; }
    add(new THREE.IcosahedronGeometry(.12 * U, 0), gold, 0, y + .07, 0);
  } else { // king: the tallest, with a cross on top
    cyl(.2, .3, .66); cyl(.28, .28, .05, trim); cyl(.3, .2, .17); cyl(.17, .3, .06, shade);
    box(.1, .32, .1, 0, y + .15, 0, gold); box(.28, .1, .1, 0, y + .18, 0, gold);
  }
  bake(g); toonify(g, .028);
  return g;
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
    room.add(roundDeck(R, { wood: '#e9d3a7', seam: '#d6bb88', rim: '#c9a26b', pitch: 1.18, off: .59 }));
    const W = B + EDGE * 2 + 1.1;
    const top = put(new THREE.BoxGeometry(W, .34, W), M('#b9794a'), 0, -.19, 0); top.castShadow = top.receiveShadow = true;
    put(new THREE.BoxGeometry(W - .4, .04, W - .4), M('#cf9460'), 0, -.01, 0).receiveShadow = true;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(new THREE.BoxGeometry(.5, 2.1, .5), M('#a86a42'), sx * (W / 2 - .5), -1.38, sz * (W / 2 - .5)).castShadow = true;
    // a crate of spare pieces, a stack of books and two mugs
    const crate = new THREE.Group(); crate.position.set(7.2, -2.34, -4.6); crate.rotation.y = -.4; room.add(crate);
    put(new THREE.BoxGeometry(1.5, .8, 1.1), M('#c99763'), 0, .4, 0, crate).castShadow = true; put(new THREE.BoxGeometry(1.6, .12, .14), M('#a86a42'), 0, .5, .56, crate); put(new THREE.BoxGeometry(1.6, .12, .14), M('#a86a42'), 0, .2, .56, crate);
    put(new THREE.CylinderGeometry(.2, .26, .3, 8), M('#fffaf0'), -.3, .95, 0, crate); put(new THREE.IcosahedronGeometry(.17, 1), M('#fffaf0'), -.3, 1.2, 0, crate);
    put(new THREE.CylinderGeometry(.2, .26, .3, 8), M('#4d362e'), .35, .95, .1, crate); put(new THREE.IcosahedronGeometry(.17, 1), M('#4d362e'), .35, 1.2, .1, crate);
    const books = new THREE.Group(); books.position.set(-7.3, -2.34, -4.2); books.rotation.y = .5; room.add(books);
    [['#e5543b', 0], ['#3f8fe0', .22], ['#ffc93c', .44]].forEach(([c, yy], i) => { const b = put(new THREE.BoxGeometry(1.3 - i * .12, .2, .95 - i * .08), M(c), 0, yy + .1, 0, books); b.rotation.y = i * .18; b.castShadow = true; });
    put(new THREE.CylinderGeometry(.2, .15, .3, 8), M('#ff8fab'), 6.6, -2.19, 5.0); put(new THREE.CylinderGeometry(.2, .15, .3, 8), M('#ffc94d'), -6.4, -2.19, 5.2);
    bake(room); toonify(room, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- the board ----------
  let flip = false; // true when the viewer plays Black: the board is turned so their pieces are nearest
  const sqPos = (s, out = new THREE.Vector3()) => { const f = s & 7, r = s >> 3; return out.set((flip ? 3.5 - f : f - 3.5) * CELL, TOP, (flip ? r - 3.5 : 3.5 - r) * CELL); };
  const boardG = new THREE.Group(); scene.add(boardG);
  {
    const frame = put(new THREE.BoxGeometry(B + EDGE * 2, TOP + .04, B + EDGE * 2), M('#8a5a3c'), 0, TOP / 2 - .04, 0, boardG); frame.castShadow = frame.receiveShadow = true;
    const tg = new THREE.BoxGeometry(CELL, .06, CELL);
    for (let s = 0; s < 64; s++) { const t = put(tg, M(((s & 7) + (s >> 3)) % 2 ? LIGHT : DARK), ((s & 7) - 3.5) * CELL, TOP - .03, (3.5 - (s >> 3)) * CELL, boardG); t.receiveShadow = true; }
    bake(boardG); toonify(boardG, .035);
    boardG.traverse(o => { if (o.isMesh && !o.userData.ink) o.receiveShadow = true; });
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
    labelTex.forEach((t, k) => {
      const cv = t.image, g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
      g.font = '700 38px Rubik, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe9c4';
      for (let i = 0; i < 8; i++) {
        // k 0: files left to right along the near edge; k 1: ranks down the left edge, the far one first
        const txt = k === 0 ? 'abcdefgh'[flip ? 7 - i : i] : String(flip ? i + 1 : 8 - i);
        if (k === 0) g.fillText(txt, (i + .5) * 128, 25); else g.fillText(txt, 24, (i + .5) * 128 + 2);
      }
      t.needsUpdate = true;
    });
  }

  // highlights: flat tiles just above the squares, dots on squares a piece can go to, rings round pieces it can take
  const flatGeo = new THREE.PlaneGeometry(CELL, CELL); flatGeo.rotateX(-Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(CELL * .16, 14); dotGeo.rotateX(-Math.PI / 2);
  const ringGeoT = new THREE.RingGeometry(CELL * .38, CELL * .47, 20); ringGeoT.rotateX(-Math.PI / 2);
  const hiMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  const mats = { hov: hiMat('#7fdcff', .75), last: hiMat('#ffe14d', .55), sel: hiMat('#ffb020', .8), check: hiMat('#ff3b30', .75), cur: hiMat('#4fb4ff', .6), dot: hiMat('#3b2219', .42), ring: hiMat('#e5402f', .9) };
  const tile = k => { const m = new THREE.Mesh(flatGeo, mats[k]); m.visible = false; m.renderOrder = 2; boardG.add(m); return m; };
  const hi = { lastF: tile('last'), lastT: tile('last'), sel: tile('sel'), check: tile('check'), cur: tile('cur'), hov: tile('hov') };
  const showTile = (m, s) => { m.visible = s >= 0; if (s >= 0) { sqPos(s, m.position); m.position.y = TOP + .008; } };
  const marks = []; // pooled dots and rings
  function setTargets(list) {
    let i = 0;
    for (const { t, cap } of list) {
      let m = marks[i++];
      if (!m) { m = new THREE.Mesh(dotGeo, mats.dot); m.renderOrder = 3; boardG.add(m); marks.push(m); }
      m.geometry = cap ? ringGeoT : dotGeo; m.material = cap ? mats.ring : mats.dot;
      sqPos(t, m.position); m.position.y = TOP + .012; m.visible = true;
    }
    for (; i < marks.length; i++) marks[i].visible = false;
  }

  // ---------- pieces ----------
  let protos = new Map(), protoKey = '';
  const pieces = new Map(); // square -> { g, p, y }
  function buildProtos(ringW, ringB, setW = 0, setB = 0) {
    for (const g of protos.values()) g.traverse(o => o.geometry?.dispose());
    protos = new Map();
    for (let side = 0; side < 2; side++) for (let t = 1; t <= 6; t++) protos.set(t | side << 3, pieceModel(t, side, side ? ringB : ringW, side ? setB : setW));
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
    for (let s = 0; s < 64; s++) if (b[s] && !pieces.has(s)) addPiece(s, b[s]);
  }
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });
  function poof(x, side) {
    const g = x.g, p = g.position.clone(), gone = () => { boardG.remove(g); dying.delete(g); };
    if (reduced) return gone();
    pfx.puff(p.clone().setY(TOP + .4), { n: 9, color: [side ? '#7a5a4a' : '#fff4e2', '#ffffff'], size: .24, speed: 2.2 });
    tween(.26, t => { const k = 1 - ease(t); g.scale.setScalar(Math.max(.001, k)); g.position.y = p.y + t * .5; g.rotation.y = t * 2.2; }, gone);
  }
  function slide(x, from, to, { hop = .28, dur = .3, delay = 0, done } = {}) {
    const a = sqPos(from), b = sqPos(to), g = x.g;
    if (reduced) { g.position.set(b.x, TOP, b.z); done?.(); return; }
    tween(dur, t => { const e = ease(t); g.position.set(a.x + (b.x - a.x) * e, TOP + Math.sin(t * Math.PI) * hop, a.z + (b.z - a.z) * e); },
      () => { g.position.set(b.x, TOP, b.z); pfx.ring(b.clone().setY(TOP + .03), { color: '#fff6c9', size: CELL * .5 }); done?.(); }, delay);
  }
  // One move, shown: the piece hops to its square, a taken piece pops, the rook follows a castling king, a pawn turns into its new piece.
  function animateMove(prev, next, f, t) {
    const x = pieces.get(f); if (!x) return hardSync(next);
    const type = x.p & 7, side = x.p >> 3;
    let victim = pieces.get(t), vsq = t;
    if (!victim && type === 1 && (f & 7) !== (t & 7)) { vsq = (f & ~7) | (t & 7); victim = pieces.get(vsq); } // en passant
    if (victim) { pieces.delete(vsq); const v = victim; dying.add(v.g); tween(.01, () => {}, () => { poof(v, v.p >> 3); shake.kick(.07); }, reduced ? 0 : .2); }
    pieces.delete(f); pieces.set(t, x);
    slide(x, f, t, { hop: type === 2 ? .7 : .26, dur: type === 2 ? .36 : .3, done: () => {
      if (next[t] !== x.p) { // promotion
        dropPiece(t); const g = addPiece(t, next[t]);
        pfx.burst(sqPos(t).setY(TOP + .7), { n: 16, colors: ['#ffd84a', '#ffffff'], speed: 3.5, up: 3.5, size: .26 });
        if (!reduced) { g.scale.setScalar(.3); tween(.3, k => g.scale.setScalar(.3 + .7 * ease(k)), () => g.scale.setScalar(1)); }
      }
    } });
    if (type === 6 && Math.abs((t & 7) - (f & 7)) === 2) { // castling: the rook jumps over
      const rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1, rk = pieces.get(rf);
      if (rk) { pieces.delete(rf); pieces.set(rt, rk); slide(rk, rf, rt, { hop: .5, dur: .34, delay: .12 }); }
    }
    // anything the story above missed: put the board right once the pieces have landed
    tween(.01, () => {}, () => { for (let s = 0; s < 64; s++) if ((pieces.get(s)?.p || 0) !== board[s]) return hardSync(board); }, .75); // against the newest board: another move may have come in
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
  // From this angle a tall piece in the front row hides the feet of the one behind it, so "nearest piece under the pointer"
  // picked the king when you meant the pawn. Every piece the ray passes is a candidate (as an upright stick about as thick
  // as the piece), and so is the square the ray lands on. `want(s)` says which squares a tap could do something with:
  // only those compete, a solid hit on the nearest of them wins, otherwise the one whose middle the ray passes closest.
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  const RAD = [0, .24, .29, .27, .3, .3, .3]; // how thick each piece is for the pointer, in squares
  function squareAt(px, py, want) {
    if (!W) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const cands = [];
    for (const [s, x] of pieces) {
      const t = x.p & 7, rad = CELL * RAD[t];
      sqPos(s, _a); _a.y = TOP; _b.copy(_a); _b.y = TOP + HEIGHT[t] * .95;
      const d2 = ray.ray.distanceSqToSegment(_a, _b, _c, _d);
      if (d2 < rad * rad) cands.push({ s, score: d2 / (rad * rad), d: _c.distanceTo(ray.ray.origin) });
    }
    let floor = -1;
    if (ray.ray.intersectPlane(plane, hit)) {
      const cx = Math.floor(hit.x / CELL + 4), cz = Math.floor(hit.z / CELL + 4);
      if (cx >= 0 && cx <= 7 && cz >= 0 && cz <= 7) floor = flip ? cz * 8 + (7 - cx) : (7 - cz) * 8 + cx;
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
  let sel = -1;
  function setSelect(s, targets = []) { sel = s; showTile(hi.sel, s); if (hov >= 0) showTile(hi.hov, hov === sel ? -1 : hov); setTargets(s >= 0 ? targets : []); }
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
    { const W = list[st.white], Bk = list[1 - st.white], pk = W.color + '|' + Bk.color + '|' + (W.fl?.cs | 0) + '|' + (Bk.fl?.cs | 0); // each side wears its player's chess set
      if (pk !== protoKey) { protoKey = pk; for (const s of [...pieces.keys()]) dropPiece(s); buildProtos(W.color, Bk.color, W.fl?.cs | 0, Bk.fl?.cs | 0); rebuilt = true; } }
    if (vf !== flip || !board) { flip = vf; drawLabels(); rebuilt = true; }
    const b = st.pos.b;
    if (fresh || rebuilt) { gid = st.gid; mvN = st.mv; setSelect(-1); hardSync(b); }
    else if (st.mv !== mvN) {
      if (st.mv === mvN + 1 && st.last && board) { animateMove(board, b, st.last.f, st.last.t); if (seats[st.last.s]) seats[st.last.s].hop = .5; }
      else hardSync(b);
      mvN = st.mv;
    }
    board = b.slice();
    showTile(hi.lastF, st.last ? st.last.f : -1); showTile(hi.lastT, st.last ? st.last.t : -1);
    showTile(hi.check, st.check);
    list.forEach((p, i) => { if (seats[i]) seats[i].active = st.turn === i; });
    if (st.ph === 'end' && S && S.ph !== 'end') {
      if (st.win >= 0 && seats[st.win]) {
        seats[st.win].hop = 1; if (seats[1 - st.win]) seats[1 - st.win].nod = 2;
        const top = seats[st.win].av.position.clone().setY(2.3); pfx.confetti(top, { n: 80, w: 3, h: 2.2, s: st.win });
        if (st.res?.how === 'mate' && st.check >= 0) { const k = pieces.get(st.check); if (k && !reduced) tween(.5, t => { k.g.rotation.z = ease(t) * 1.45 * (flip ? -1 : 1); k.g.position.y = TOP + Math.sin(t * Math.PI) * .15; }, null, .5); } // the mated king tips over
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
      if (u.lift !== want) { u.lift += Math.sign(want - u.lift) * Math.min(Math.abs(want - u.lift), dt * 9); if (!tweens.length) { x.g.position.y = TOP + u.lift * .16; x.g.scale.setScalar(1 + Math.min(u.lift, .6) * .2); } }
      else if (want === 1 && !reduced && !tweens.length) x.g.position.y = TOP + .16 + Math.sin(T * 5) * .025;
    }
    mats.check.opacity = .55 + Math.sin(T * 6) * .2;
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
    setState, squareAt, setSelect, setCursor, setHover,
    squarePx(s) { sqPos(s, tv); tv.y = TOP + .5; tv.project(camera); return { x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H }; },
    flipped: () => flip,
    setHud(px) { if ((Math.abs(px - hudBottom) > 6) && hudFitOk(canvas)) { hudBottom = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const g of protos.values()) g.traverse(o => o.geometry?.dispose());
      boardG.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      for (const t of labelTex) t.dispose(); for (const m of labelMat) m.dispose(); for (const m of Object.values(mats)) m.dispose();
      pfx.dispose(); ringGeo.dispose(); flatGeo.dispose(); dotGeo.dispose(); ringGeoT.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

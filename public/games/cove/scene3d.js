// Cove Clash 3D scene (three.js): two square bays on a calm sea, one per player, each with a sandy islet where its
// owner's avatar stands. Blocky toy boats with Pet Farm pets for a crew float in the bays; coconuts fly from the
// shooter to the square they picked. Purely visual: it draws what the server sends, shows the layout the player is
// arranging, and tells the HUD which square the pointer is over.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, createFx, shaker, nightScene, disposeToon, hash, DOT, STAR } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { petModel } from '../farm/pets3d.js';
import { cellsOf, MISS, HIT, CLEAR } from './rules.js';

const SKY_TOP = '#4fb0f2', SKY_LOW = '#d3f1ff';
const BW = 10;            // a bay is this wide, whatever the number of squares
const RIM = .45;          // the wooden walkway round a bay
const ISL = BW / 2 + 2.5; // how far the islet's middle is from the bay's
const AV = .9;            // avatar size
const SAND = .22;         // height of the islet's top
const SMALL = .52;        // on a phone the bay you are not using is drawn this much smaller
export const FLY = .8;    // seconds a coconut is in the air
const CREW = ['puddlepup', 'waddlet', 'ripplet', 'ottershell', 'donuseal', 'axolily']; // Pet Farm pets that sail the boats
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const back = t => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const shadeOf = (c, k) => { const o = new THREE.Color(c); return '#' + (k < 1 ? o.multiplyScalar(k) : o.lerp(new THREE.Color('#ffffff'), k - 1)).getHexString(); };

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 190);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 600);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#bfe9ff', 2.0));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(6, 16, 9); scene.add(sun);

  // ---------- sky, sea and far islands ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const sea = put(new THREE.CircleGeometry(260, 40), new THREE.MeshToonMaterial({ color: '#4aa8de' }), 0, -.32, 0); sea.rotation.x = -Math.PI / 2;
  // things floating about on the open sea: pale wave streaks that drift, a few rocks, lily pads and buoys
  const far = new THREE.Group(); scene.add(far);
  const waveGeo = new THREE.BoxGeometry(1, .02, .12), waves = new THREE.InstancedMesh(waveGeo, new THREE.MeshBasicMaterial({ color: '#8fd3f5', transparent: true, opacity: .8 }), 70); waves.frustumCulled = false; scene.add(waves);
  const waveAt = Array.from({ length: 70 }, (_, i) => ({ x: (hash(i, 1) - .5) * 70, z: (hash(i, 2) - .5) * 60, w: .8 + hash(i, 3) * 1.6, sp: .15 + hash(i, 4) * .25 }));
  for (let i = 0; i < 16; i++) {
    const a = hash(i, 7) * 6.283, r = 17 + hash(i, 8) * 16, x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r * .9, k = hash(i, 9);
    if (k < .4) { const s = .5 + hash(i, 10) * .8; const rock = put(new THREE.IcosahedronGeometry(s, 0), M(k < .2 ? '#9a8f88' : '#857a72'), x, -.25, z, far); rock.scale.y = .6; rock.rotation.y = a; if (k < .2) put(new THREE.IcosahedronGeometry(s * .5, 0), M('#a59a92'), x + s * .8, -.3, z + s * .3, far); }
    else if (k < .75) { for (let j = 0; j < 3; j++) { const pad = put(new THREE.CylinderGeometry(.5 - j * .1, .5 - j * .1, .05, 7), M(j % 2 ? '#74cf74' : '#5fbf6a'), x + j * .9 - .8, -.28, z + (j % 2) * .7, far); pad.rotation.y = j; } put(new THREE.IcosahedronGeometry(.16, 0), M('#ffb5d0'), x - .8, -.2, z, far); }
    else { put(new THREE.CylinderGeometry(.3, .36, .5, 7), M('#ff6b57'), x, -.1, z, far); put(new THREE.CylinderGeometry(.31, .31, .14, 7), M('#fff4e2'), x, -.05, z, far); put(new THREE.BoxGeometry(.06, .5, .06), M('#8a5a3c'), x, .35, z, far); }
  }
  bake(far); toonify(far, .04);
  nightScene(scene); // the website's night mode carries into the game
  const pfx = createFx(scene), shake = shaker();

  // ---------- shared shapes ----------
  const G = {
    nut: new THREE.IcosahedronGeometry(.26, 0), ring: new THREE.TorusGeometry(1, .07, 6, 28), swim: new THREE.TorusGeometry(.34, .13, 6, 12),
  };
  G.ring.rotateX(Math.PI / 2); G.swim.rotateX(Math.PI / 2);
  const nutMat = toonMat(M('#7a4a2b')), swimMat = toonMat(M('#ff6b57')), swimMat2 = toonMat(M('#fff4e2'));
  const tileMat = new THREE.MeshToonMaterial({ color: '#ffffff' });
  const missMat = new THREE.MeshBasicMaterial({ color: '#ffffff' }), clearMat = new THREE.MeshBasicMaterial({ color: '#c9efff', transparent: true, opacity: .75 }), hitMat = new THREE.MeshBasicMaterial({ color: '#e8452c' });
  const warnMat = new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: .7, depthWrite: false });
  const lastMat = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: .95, depthWrite: false });
  const hoverMat = new THREE.MeshBasicMaterial({ color: '#fff6c9', transparent: true, opacity: .95, depthWrite: false });
  const WATER = [new THREE.Color('#7fdcf7'), new THREE.Color('#6acff2')], HOT = new THREE.Color('#fff09a');

  // Pet Farm pets, one model per species, sized so each is 1 tall with its feet at 0. Boats get copies.
  const petProtos = new Map(), bb = new THREE.Box3(), bsize = new THREE.Vector3();
  function crew(sp) {
    let p = petProtos.get(sp);
    if (!p) {
      const pet = petModel(sp, 0); p = new THREE.Group();
      bb.setFromObject(pet); bb.getSize(bsize); const k = 1 / Math.max(bsize.y, .01);
      pet.scale.multiplyScalar(k); pet.position.set(-(bb.min.x + bb.max.x) / 2 * k, -bb.min.y * k, -(bb.min.z + bb.max.z) / 2 * k); p.add(pet);
      petProtos.set(sp, p);
    }
    return p.clone();
  }

  // ---------- a boat ----------
  // Built along +x with its middle at 0, sized for a square of 1 (the caller scales it to the bay's squares).
  function hullShape(len, wide) {
    const a = len / 2, w = wide / 2, s = new THREE.Shape();
    s.moveTo(-a, -w * .78); s.lineTo(a - wide * .72, -w); s.lineTo(a, 0); s.lineTo(a - wide * .72, w); s.lineTo(-a, w * .78); s.closePath();
    return s;
  }
  function makeBoat(len, color, sp) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const L = len - .28, W = .62, H = .3, dark = shadeOf(color, .72), cream = '#fff4e2';
    const hull = new THREE.ExtrudeGeometry(hullShape(L, W), { depth: H, bevelEnabled: false }); hull.rotateX(-Math.PI / 2);
    put(hull, M(dark), 0, -.06, 0, body);
    const trim = new THREE.ExtrudeGeometry(hullShape(L + .06, W + .06), { depth: .07, bevelEnabled: false }); trim.rotateX(-Math.PI / 2);
    put(trim, M(color), 0, H - .1, 0, body);
    const deck = new THREE.ExtrudeGeometry(hullShape(L - .16, W - .2), { depth: .03, bevelEnabled: false }); deck.rotateX(-Math.PI / 2);
    put(deck, M('#e9c48c'), 0, H - .03, 0, body);
    const box = (w, h, d, c, x, y, z = 0) => put(new THREE.BoxGeometry(w, h, d), M(c), x, y, z, body);
    let petX = 0;
    if (len === 1) { box(.1, .06, W - .2, '#b9794a', -.18, H + .03); petX = .04; } // a dinghy: just a bench
    else {
      const cx = -L / 2 + .42; // the cabin sits at the back, the crew stands in front of it
      box(.46, .3, .4, cream, cx, H + .15); box(.54, .08, .48, color, cx, H + .34);
      box(.1, .1, .02, '#7fd1e8', cx + .1, H + .18, .205); box(.1, .1, .02, '#7fd1e8', cx + .1, H + .18, -.205);
      if (len >= 3) { put(new THREE.CylinderGeometry(.09, .11, .32, 6), M('#ff7a59'), cx - .02, H + .52, 0, body); put(new THREE.CylinderGeometry(.1, .1, .07, 6), M('#3b2219'), cx - .02, H + .68, 0, body); }
      if (len >= 4) { box(.5, .2, .36, cream, cx + .72, H + .1); box(.56, .06, .42, color, cx + .72, H + .23); }
      const mx = L / 2 - .34; // a little flag at the bow
      box(.05, .5, .05, '#8a5a3c', mx, H + .25); box(.22, .14, .03, color, mx - .13, H + .43);
      petX = len === 2 ? .3 : len === 3 ? .45 : 1.0;
    }
    bake(body); toonify(body, .035);
    const pet = crew(sp); pet.scale.setScalar(.56); pet.position.set(petX, H, 0); pet.rotation.y = Math.PI / 2; body.add(pet);
    // what is left when it sinks: the crew bobbing in a swim ring
    const ring = new THREE.Group(); ring.visible = false; g.add(ring);
    put(G.swim, swimMat, 0, 0, 0, ring); for (let i = 0; i < 4; i++) { const s = put(new THREE.BoxGeometry(.2, .27, .2), swimMat2, Math.cos(i * Math.PI / 2 + .78) * .34, 0, Math.sin(i * Math.PI / 2 + .78) * .34, ring); s.rotation.y = -(i * Math.PI / 2 + .78); }
    const warn = put(new THREE.BoxGeometry(len - .04, .04, .96), warnMat, 0, .1, 0, g); warn.visible = false; warn.renderOrder = 3;
    return { g, body, pet, ring, warn, len, petX, H, sink: 0, sunk: false, pop: 1, lift: 0, liftTo: 0, seed: Math.random() * 6.28, tx: 0, tz: 0, tr: 0, placed: false };
  }

  // ---------- the two bays ----------
  let bays = [], bayKey = '', n = 0, cell = 1, mine = 0, me = -1;
  function freeBays() {
    for (const b of bays) {
      scene.remove(b.g); disposeAvatar(b.av);
      b.g.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
      for (const o of b.boats.values()) disposeBoat(o);
      disposeToon(b.static); disposeToon(b.deco); b.last.geometry.dispose(); b.ring.material.dispose(); b.tileGeo.dispose(); for (const k of ['missGeo', 'clearGeo', 'hitGeo']) b[k].dispose();
    }
    bays = [];
  }
  function disposeBoat(o) { o.body.traverse(m => { if (m.isMesh && m.userData.baked) m.geometry.dispose(); }); o.warn.geometry.dispose(); }
  function buildBays(st) {
    freeBays(); n = st.n; cell = BW / n; me = st.me; mine = me >= 0 ? me : 0;
    bays = st.seats.map((p, i) => {
      const g = new THREE.Group(); scene.add(g);
      const fixed = new THREE.Group(); g.add(fixed);
      // the walkway round the water, the bed under it, and corner posts in the owner's colour
      const half = BW / 2, wood = '#d9ab74', wood2 = '#b9794a';
      put(new THREE.BoxGeometry(BW + .2, .3, BW + .2), M('#2f8fc9'), 0, -.22, 0, fixed);
      for (const [x, z, w, d] of [[0, -half - RIM / 2, BW + RIM * 2, RIM], [0, half + RIM / 2, BW + RIM * 2, RIM], [-half - RIM / 2, 0, RIM, BW], [half + RIM / 2, 0, RIM, BW]]) put(new THREE.BoxGeometry(w, .34, d), M(wood), x, -.02, z, fixed);
      for (let k = -4; k <= 4; k++) for (const sd of [-1, 1]) { put(new THREE.BoxGeometry(.05, .02, RIM), M(wood2), k * 1.14, .16, sd * (half + RIM / 2), fixed); put(new THREE.BoxGeometry(RIM, .02, .05), M(wood2), sd * (half + RIM / 2), .16, k * 1.14, fixed); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { put(new THREE.CylinderGeometry(.2, .22, .9, 6), M(wood2), sx * (half + RIM / 2), .3, sz * (half + RIM / 2), fixed); put(new THREE.CylinderGeometry(.24, .24, .14, 6), M(p.color), sx * (half + RIM / 2), .8, sz * (half + RIM / 2), fixed); }
      bake(fixed); toonify(fixed, .04);
      // the islet: sand, a palm, a pile of coconuts and a flag
      const isl = new THREE.Group(); g.add(isl);
      const deco = new THREE.Group(); isl.add(deco);
      put(new THREE.CylinderGeometry(2.0, 2.3, .6, 9), M('#f6e2a6'), 0, SAND - .3, 0, deco);
      put(new THREE.CylinderGeometry(1.1, 1.2, .08, 8), M('#ffeebe'), .2, SAND + .02, .1, deco);
      const palm = new THREE.Group(); palm.position.set(-1.25, SAND, -.5); deco.add(palm);
      for (let k = 0; k < 4; k++) { const t = put(new THREE.CylinderGeometry(.14 - k * .012, .17 - k * .012, .62, 6), M(k % 2 ? '#a9764a' : '#b98556'), -k * .1, .3 + k * .58, 0, palm); t.rotation.z = .16; }
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283, leaf = put(new THREE.BoxGeometry(1.1, .06, .34), M(k % 2 ? '#5fbf6a' : '#74cf74'), -.42 + Math.cos(a) * .5, 2.42, Math.sin(a) * .5, palm); leaf.rotation.set(0, -a, -.42); }
      put(new THREE.IcosahedronGeometry(.16, 0), M('#7a4a2b'), -.5, 2.24, .12, palm); put(new THREE.IcosahedronGeometry(.16, 0), M('#7a4a2b'), -.32, 2.2, -.14, palm);
      for (const [x, y, z] of [[1.25, .16, .5], [1.5, .16, .25], [1.22, .16, .12], [1.34, .4, .3]]) put(new THREE.IcosahedronGeometry(.19, 0), M('#7a4a2b'), x, SAND + y, z, deco);
      put(new THREE.BoxGeometry(.07, 1.7, .07), M('#8a5a3c'), 1.35, SAND + .85, -.75, deco); put(new THREE.BoxGeometry(.62, .4, .04), M(p.color), 1.69, SAND + 1.46, -.75, deco);
      put(new THREE.BoxGeometry(.9, .12, 1.3), M(wood), 0, .06, 2.05, deco); // a plank down to the walkway
      bake(deco); toonify(deco, .04);
      const avWrap = new THREE.Group(); avWrap.scale.setScalar(AV); avWrap.position.set(.15, SAND + .06 + .76 * AV, .25); isl.add(avWrap);
      const av = avatar3d(p.color, p.av, { pose: 'stand' }); avWrap.add(av);
      const ring = put(G.ring, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), .15, SAND + .1, .25, isl);
      // the water: one tile a square, so squares can light up and the surface can ripple
      const tileGeo = new THREE.BoxGeometry(cell * .94, .16, cell * .94);
      const tiles = new THREE.InstancedMesh(tileGeo, tileMat, n * n); tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(tiles);
      for (let c = 0; c < n * n; c++) tiles.setColorAt(c, WATER[((c % n) + (c / n | 0)) % 2]);
      const missGeo = new THREE.CylinderGeometry(cell * .2, cell * .2, .06, 10), clearGeo = new THREE.CylinderGeometry(cell * .09, cell * .09, .05, 8), hitGeo = new THREE.BoxGeometry(cell * .62, .09, cell * .17);
      const inst = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, n * n); m.count = 0; m.frustumCulled = false; g.add(m); return m; };
      const last = put(new THREE.TorusGeometry(cell * .4, cell * .055, 5, 20), lastMat, 0, .16, 0, g); last.rotation.x = Math.PI / 2; last.visible = false;
      return {
        g, static: fixed, isl, deco, av, avWrap, ring, tiles, tileGeo, missGeo, clearGeo, hitGeo, last, color: p.color, key: p.color + (p.av || []).join(''),
        miss: inst(missGeo, missMat), clear: inst(clearGeo, clearMat), hitA: inst(hitGeo, hitMat), hitB: inst(hitGeo, hitMat),
        boats: new Map(), hop: 0, active: false, aim: 0, glow: 0,
        tp: new THREE.Vector3(), ts: 1, ip: new THREE.Vector3(0, 0, -ISL), ir: 0, set: false,
      };
    });
    hover.b = -1; hover.c = -1;
  }
  const cellX = c => (c % n - (n - 1) / 2) * cell, cellZ = c => ((c / n | 0) - (n - 1) / 2) * cell;
  const world = (b, c, y = 0, out = new THREE.Vector3()) => { const B = bays[b]; return out.set(B.g.position.x + cellX(c) * B.g.scale.x, y * B.g.scale.x, B.g.position.z + cellZ(c) * B.g.scale.x); };
  const avWorld = (b, y = 2.4, out = new THREE.Vector3()) => { const B = bays[b], s = B.g.scale.x; return out.set(B.g.position.x + (B.isl.position.x + .15) * s, (SAND + y) * s, B.g.position.z + (B.isl.position.z + .25) * s); };

  // ---------- where the bays are ----------
  // Wide screen: yours on the left, theirs on the right. Tall screen (a phone): the bay you are using is big at the
  // top (yours while you arrange the boats, theirs once the shooting starts) and the other one is small underneath.
  let tall = false, big = 0, W = 0, H = 0, hudBottom = 110, fitPts = [];
  function arrange(snap) {
    if (!bays.length) return;
    fitPts = [];
    bays.forEach((B, i) => {
      if (!tall) { B.tp.set((i === mine ? -1 : 1) * (BW / 2 + RIM + .8), 0, 0); B.ts = 1; B.ip.set(0, 0, -ISL); B.ir = 0; }
      else if (i === big) { B.tp.set(0, 0, -2.4); B.ts = 1; B.ip.set(0, 0, -ISL); B.ir = 0; }
      else { const w = (BW / 2 + RIM) * SMALL; B.tp.set(-BW / 2 - RIM + w, 0, -2.4 + BW / 2 + RIM + .7 + w); B.ts = SMALL; B.ip.set(BW / 2 + 3.4, 0, .6); B.ir = -Math.PI / 2; }
      if (snap || !B.set) { B.set = true; B.g.position.copy(B.tp); B.g.scale.setScalar(B.ts); B.isl.position.copy(B.ip); B.isl.rotation.y = B.ir; }
      const e = (BW / 2 + RIM + .15) * B.ts;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) fitPts.push(new THREE.Vector3(B.tp.x + sx * e, 0, B.tp.z + sz * e));
      for (const sx of [-1, 1]) fitPts.push(new THREE.Vector3(B.tp.x + (B.ip.x + sx * 2.1) * B.ts, 0, B.tp.z + B.ip.z * B.ts), new THREE.Vector3(B.tp.x + (B.ip.x + sx * 1.6) * B.ts, 3.6 * B.ts, B.tp.z + B.ip.z * B.ts));
    });
    resize(true);
  }

  // ---------- marks on the water ----------
  const dummy = new THREE.Object3D();
  function setMarks(b, sea, list) {
    const B = bays[b], seen = new Map(); // squares with a boat you can see: marks sit on its deck
    (list || []).forEach(e => { if (e) for (const c of cellsOf(e, n) || []) seen.set(c, e.sunk ? .5 : .62); });
    let nm = 0, nc = 0, nh = 0;
    for (let c = 0; c < n * n; c++) {
      const x = sea[c]; if (!x) continue;
      dummy.position.set(cellX(c), .12, cellZ(c)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
      if (x === MISS) { dummy.updateMatrix(); B.miss.setMatrixAt(nm++, dummy.matrix); }
      else if (x === CLEAR) { dummy.updateMatrix(); B.clear.setMatrixAt(nc++, dummy.matrix); }
      else if (x === HIT) {
        dummy.position.y = seen.has(c) ? seen.get(c) * cell : .16;
        dummy.rotation.y = Math.PI / 4; dummy.updateMatrix(); B.hitA.setMatrixAt(nh, dummy.matrix);
        dummy.rotation.y = -Math.PI / 4; dummy.updateMatrix(); B.hitB.setMatrixAt(nh++, dummy.matrix);
      }
    }
    B.miss.count = nm; B.clear.count = nc; B.hitA.count = B.hitB.count = nh;
    for (const m of [B.miss, B.clear, B.hitA, B.hitB]) m.instanceMatrix.needsUpdate = true;
    B.smoke = []; for (let c = 0; c < n * n; c++) if (sea[c] === HIT && !(seen.get(c) < .6)) B.smoke.push(c); // hit but still afloat: these squares smoulder
  }

  // ---------- boats in a bay ----------
  // list: one entry per boat of the fleet ({ c, len, v, sunk }), or null for a boat this viewer cannot see.
  function setBoats(b, list, { pop = false, bad = null, lift = -1 } = {}) {
    const B = bays[b];
    for (const [i, o] of B.boats) if (!list[i] || list[i].len !== o.len) { B.g.remove(o.g); disposeBoat(o); B.boats.delete(i); }
    list.forEach((e, i) => {
      if (!e) return;
      let o = B.boats.get(i);
      if (!o) {
        o = makeBoat(e.len, B.color, CREW[(i + b * 3) % CREW.length]); o.g.scale.setScalar(cell); B.g.add(o.g); B.boats.set(i, o);
        if (pop && !reduced) o.pop = 0;
        if (e.sunk && !pop) o.sink = 1;
      }
      const cells = cellsOf(e, n); if (!cells) return;
      o.tx = (cellX(cells[0]) + cellX(cells[cells.length - 1])) / 2; o.tz = (cellZ(cells[0]) + cellZ(cells[cells.length - 1])) / 2; o.tr = e.v ? -Math.PI / 2 : 0;
      if (!o.placed) { o.placed = true; o.g.position.set(o.tx, 0, o.tz); o.g.rotation.y = o.tr; }
      o.sunk = !!e.sunk; o.warn.visible = !!bad?.has(i); o.liftTo = i === lift ? 1 : 0;
    });
  }

  // ---------- pointer ----------
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.1), hitP = new THREE.Vector3(), ndc = new THREE.Vector2();
  function pick(px, py) { // -> { b, c }: the bay and square under a screen point, or null
    if (!bays.length || !W) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hitP)) return null;
    for (let b = 0; b < bays.length; b++) {
      const B = bays[b], s = B.g.scale.x, q = Math.floor((hitP.x - B.g.position.x) / s / cell + n / 2), row = Math.floor((hitP.z - B.g.position.z) / s / cell + n / 2);
      if (q >= 0 && q < n && row >= 0 && row < n) return { b, c: row * n + q };
    }
    return null;
  }
  const hover = { b: -1, c: -1 };
  const cross = put(new THREE.TorusGeometry(.36, .06, 5, 20), hoverMat, 0, 0, 0); cross.rotation.x = Math.PI / 2; cross.visible = false; cross.renderOrder = 4;
  function setHover(b, c) {
    if (b === hover.b && c === hover.c) return;
    if (hover.b >= 0 && bays[hover.b] && hover.c >= 0) { const B = bays[hover.b]; B.tiles.setColorAt(hover.c, WATER[((hover.c % n) + (hover.c / n | 0)) % 2]); B.tiles.instanceColor.needsUpdate = true; }
    hover.b = b; hover.c = c; cross.visible = b >= 0 && c >= 0 && !!bays[b];
    if (!cross.visible) return;
    const B = bays[b]; B.tiles.setColorAt(c, HOT); B.tiles.instanceColor.needsUpdate = true;
  }

  // ---------- state from the server ----------
  let S = null, gid = '', mv = -1, landAt = 0, landing = null, layout = null, T = 0;
  const flights = [];
  function show(st, pop) {
    bays.forEach((B, b) => {
      const list = b === mine && layout ? layout.boats : st.boats[b];
      setBoats(b, list, { pop: pop && b !== mine, bad: b === mine && layout ? layout.bad : null, lift: b === mine && layout ? layout.lift : -1 });
      setMarks(b, st.sea[b], list);
      const L = st.last; B.last.visible = !!L && 1 - L.s === b && st.stage !== 'setup';
      if (B.last.visible) B.last.position.set(cellX(L.c), .2, cellZ(L.c));
    });
  }
  function setState(st) {
    const key = st.seats.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me + '/' + st.n;
    const fresh = st.gid !== gid || key !== bayKey;
    if (key !== bayKey) { bayKey = key; buildBays(st); }
    const wantBig = st.stage === 'setup' && st.me >= 0 ? mine : 1 - mine;
    if (wantBig !== big || fresh) { big = wantBig; arrange(fresh); }
    if (fresh) { gid = st.gid; mv = st.mv; landAt = 0; landing = null; flights.length = 0; for (const f of nuts) f.visible = false; for (const B of bays) B.cheer = false; S = st; show(st, false); }
    else if (st.mv !== mv && st.last && st.last.mv === st.mv) { // a coconut is on its way: the square changes when it lands
      mv = st.mv; launch(st.last); landing = st.last; landAt = T + FLY; S = st;
    } else { S = st; if (!landAt) show(st, false); }
    bays.forEach((B, i) => { B.active = st.stage === 'play' && st.turn === i; B.aim = st.stage === 'play' && st.turn === 1 - i && st.turn === st.me ? 1 : 0; });
    if (st.ph === 'end' && st.win >= 0 && bays[st.win]) bays[st.win].cheer = true;
  }
  const nuts = Array.from({ length: 3 }, () => { const m = put(G.nut, nutMat); m.visible = false; return m; });
  function launch(L) {
    const from = avWorld(L.s, 2.2), to = world(1 - L.s, L.c, .2), m = nuts.find(x => !x.visible) || nuts[0];
    m.visible = true; flights.push({ m, from, to, t: 0, b: 1 - L.s, c: L.c }); bays[L.s].hop = .7;
  }
  function land(L) {
    const b = 1 - L.s, p = world(b, L.c, .3), k = bays[b].g.scale.x;
    if (L.r === 'miss') { pfx.burst(p, { n: 14, colors: ['#ffffff', '#c9efff', '#8fdcff'], shape: DOT, speed: 2.4 * k, up: 4.5 * k, size: .26 * k, life: .7 }); pfx.ring(p, { color: '#ffffff', size: cell * .9 * k }); }
    else {
      const sunk = L.r === 'sunk';
      pfx.burst(p, { n: sunk ? 34 : 16, colors: ['#ffd84a', '#ff9a3d', '#ffffff'], shape: STAR, speed: (sunk ? 5 : 3.4) * k, up: (sunk ? 5.5 : 4) * k, size: (sunk ? .36 : .28) * k, life: sunk ? 1.1 : .8 });
      pfx.puff(p, { n: sunk ? 14 : 8, color: ['#fff4e2', '#ffe0b0'], size: .4 * k, speed: 2.6 * k }); pfx.ring(p, { color: '#ffd84a', size: cell * (sunk ? 1.8 : 1.1) * k });
      shake.kick(sunk ? .22 : .1);
      if (sunk && bays[L.s]) bays[L.s].hop = 1;
    }
  }
  function setLayout(boats, bad = null, lift = -1) { // the fleet the player is arranging (null: back to the server's)
    layout = boats ? { boats, bad, lift } : null;
    if (S && bays.length && !landAt) show(S, false);
  }

  // ---------- sizing ----------
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3();
  const DIR = new THREE.Vector3(0, 1.45, 1).normalize(), v = new THREE.Vector3();
  function placeCam(D) { camera.position.copy(DIR).multiplyScalar(D).add(camLook); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function box() { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of fitPts) { v.copy(p).project(camera); const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, x1, y0, y1]; }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return;
    W = w; H = h; renderer.setSize(w, h, false);
    const portrait = w / h < .9;
    if (portrait !== tall) { tall = portrait; arrange(true); return; }
    if (!fitPts.length) return;
    camera.aspect = w / h; camera.fov = portrait ? 46 : 34; camera.clearViewOffset(); camera.updateProjectionMatrix();
    let zs = 0, zn = 0; for (const p of fitPts) { zs += p.z; zn++; } camLook.set(0, 0, zs / zn);
    const top = w < 760 ? 150 : 118, bottom = Math.max(top + 160, h - hudBottom), pad = w < 760 ? 4 : 16;
    let lo = 8, hi = 160;
    for (let i = 0; i < 30; i++) {
      const D = (lo + hi) / 2; placeCam(D);
      const [x0, x1, y0, y1] = box();
      if (x1 - x0 <= w - pad * 2 && y1 - y0 <= bottom - top) hi = D; else lo = D;
    }
    placeCam(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 40; scene.fog.far = hi + 190;
    const [x0, x1, y0, y1] = box();
    camera.setViewOffset(w, h, (x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let dead = false, smokeT = 0;
  const tv = new THREE.Vector3(), info = { tags: [] };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const k = 1 - Math.exp(-dt * 7);
    bays.forEach((B, i) => {
      B.g.position.lerp(B.tp, k); B.g.scale.setScalar(B.g.scale.x + (B.ts - B.g.scale.x) * k);
      B.isl.position.lerp(B.ip, k); B.isl.rotation.y += (B.ir - B.isl.rotation.y) * k;
      // ripples: every tile rides a slow wave; the bay you may shoot at glows a little
      B.glow += ((B.aim ? 1 : 0) - B.glow) * k;
      if (!reduced || !B.rippled) {
        B.rippled = true;
        for (let c = 0; c < n * n; c++) {
          const r = c / n | 0, q = c % n, y = reduced ? 0 : Math.sin(T * 1.4 + r * .7 + q * .45 + i) * .028;
          dummy.position.set(cellX(c), y - .02 + (i === hover.b && c === hover.c ? .05 : 0), cellZ(c)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); B.tiles.setMatrixAt(c, dummy.matrix);
        }
        B.tiles.instanceMatrix.needsUpdate = true;
      }
      for (const o of B.boats.values()) {
        o.g.position.x += (o.tx - o.g.position.x) * Math.min(1, k * 2.4); o.g.position.z += (o.tz - o.g.position.z) * Math.min(1, k * 2.4);
        let d = o.tr - o.g.rotation.y; o.g.rotation.y += d * Math.min(1, k * 2.4);
        o.lift += (o.liftTo - o.lift) * Math.min(1, k * 2.5);
        o.sink += ((o.sunk ? 1 : 0) - o.sink) * Math.min(1, dt * 2.2);
        if (o.pop < 1) o.pop = Math.min(1, o.pop + dt * 2.4);
        const e = ease(o.sink), bob = reduced ? 0 : Math.sin(T * 1.7 + o.seed) * .03;
        o.g.position.y = o.lift * .5 * cell;
        o.body.position.y = bob - e * .13; o.body.rotation.x = e * .4 + (reduced ? 0 : Math.sin(T * 1.2 + o.seed) * .03 * (1 - e));
        o.body.scale.setScalar(Math.max(.001, back(o.pop)));
        // the crew: on deck while afloat, in the swim ring once the boat is sunk
        o.ring.visible = o.sink > .5; o.ring.position.set(0, .12 + bob * 1.5, .0); o.ring.rotation.y = T * .5 + o.seed;
        if (o.sink > .5) { if (o.pet.parent !== o.g) { o.g.add(o.pet); o.pet.rotation.y = o.g.rotation.y ? -o.g.rotation.y : 0; } o.pet.position.set(0, -.06 + bob * 1.5, 0); }
        else if (o.pet.parent !== o.body) { o.body.add(o.pet); o.pet.position.set(o.petX, o.H, 0); o.pet.rotation.y = Math.PI / 2; }
        if (o.sink <= .5 && !reduced) o.pet.position.y = o.H + Math.abs(Math.sin(T * 2.4 + o.seed)) * .04;
      }
      B.hop = Math.max(0, B.hop - dt * 1.8);
      B.avWrap.position.y = SAND + .06 + .76 * AV + Math.abs(Math.sin(B.hop * Math.PI * 2)) * .4 * B.hop;
      animateAvatar(B.av, T, { seed: i, active: B.active, hop: B.hop + (B.cheer ? .3 + Math.sin(T * 6) * .3 : 0), look: 0 });
      B.ring.material.opacity += ((B.active ? .9 : 0) - B.ring.material.opacity) * .15; B.ring.scale.setScalar(1.15 + Math.sin(T * 4) * .04);
      if (B.last.visible) B.last.scale.setScalar(1 + Math.sin(T * 5) * .08);
    });
    // coconuts in the air
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]; f.t += dt / FLY;
      const u = Math.min(1, f.t), hgt = 3 + f.from.distanceTo(f.to) * .22;
      f.m.position.lerpVectors(f.from, f.to, u); f.m.position.y += Math.sin(u * Math.PI) * hgt; f.m.rotation.x += dt * 9; f.m.rotation.z += dt * 5;
      f.m.scale.setScalar(.6 + bays[f.b].g.scale.x * .6);
      if (u >= 1) { f.m.visible = false; flights.splice(i, 1); }
    }
    if (landAt && T >= landAt) { landAt = 0; const L = landing; landing = null; if (S) show(S, true); if (L) land(L); }
    // squares that were hit on a boat still afloat send up a wisp now and then
    smokeT -= dt;
    if (smokeT <= 0 && !reduced) { smokeT = .22; const B = bays[Math.random() * bays.length | 0]; if (B?.smoke?.length) { const c = B.smoke[Math.random() * B.smoke.length | 0], b = bays.indexOf(B); pfx.rise(world(b, c, .5), { color: ['#fff4e2', '#d9d2c8'], size: .3 * B.g.scale.x, life: 1.1, speed: .9 }); } }
    if (cross.visible && bays[hover.b]) { world(hover.b, hover.c, .34 + Math.sin(T * 5) * .05, cross.position); cross.scale.setScalar(cell * bays[hover.b].g.scale.x * (1 + Math.sin(T * 5) * .06)); cross.rotation.z = T * 1.5; }
    if (!reduced || !waves.userData.set) { // wave streaks slide slowly and wrap round
      waves.userData.set = true;
      waveAt.forEach((wv, i) => { const x = ((wv.x + T * wv.sp + 35) % 70 + 70) % 70 - 35; dummy.position.set(x, -.3, wv.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(wv.w * (.7 + Math.sin(T * .8 + i) * .3), 1, 1); dummy.updateMatrix(); waves.setMatrixAt(i, dummy.matrix); });
      waves.instanceMatrix.needsUpdate = true;
    }
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .2) * .1), camBase.y + (reduced ? 0 : Math.sin(T * .33) * .05), camBase.z);
    if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    bays.forEach((B, i) => { // where the HUD draws the name tags: over each avatar
      const t = info.tags[i] ||= { x: 0, y: 0, yb: 0, k: 1 };
      avWorld(i, 3.15, tv).project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.k = B.g.scale.x;
      avWorld(i, -SAND, tv); tv.z += 2.5 * t.k; tv.project(camera); t.yb = (1 - tv.y) / 2 * H; // the small bay on a phone has its tag under the islet
    });
    info.tags.length = bays.length;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, setLayout, pick, setHover,
    setHud(px) { if (Math.abs(px - hudBottom) > 6) { hudBottom = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop(); freeBays();
      for (const p of petProtos.values()) disposeToon(p);
      disposeToon(far); pfx.dispose(); for (const g of Object.values(G)) g.dispose(); cross.geometry.dispose(); sea.geometry.dispose(); sea.material.dispose(); waveGeo.dispose(); waves.material.dispose(); waves.dispose();
      for (const m of [tileMat, missMat, clearMat, hitMat, warnMat, lastMat, hoverMat]) m.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

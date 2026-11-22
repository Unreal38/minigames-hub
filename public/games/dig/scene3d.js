// Treasure Dig 3D field (three.js): a grid of grass tiles on a sky island. Avatars wait round the edge; whoever
// digs hops onto the tile, digs with a shovel, and a gem, a chest or a trap comes out. Purely visual: it draws what
// the server sends, and nothing under the grass exists here until it is dug.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, DOT, HEART, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { homeOf as homeAt, standOf } from './rules.js';

const INK = '#3b2219', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const TOP = .34;                 // grass tile height
const AV = 1;                    // avatar scale (animateAvatar sets the avatar's own scale, so it has to stay 1 without a wrapper)
const FEET = .76 * AV;           // a standing avatar's feet are this far below its middle
const LAWN = -.22;               // the island's grass, a little lower than the plot
const SPADE = 1.15;              // from the blade's tip to the hands
const FOOT = .4;                 // how far an avatar's body reaches from its middle
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const GEM_COL = { 11: '#4db5ff', 12: '#ff5c8a', 13: '#ffc93c' };
const NUM_COL = ['', '#2f7fd8', '#2f9a4a', '#e5543b', '#7a4fc9', '#b5482b', '#1f9aa0', '#3b2219', '#6b6b6b'];

// ---------- the dug ground: one canvas painted under the grass ----------
const PX = 96;
function sparklePath(g, x, y, r) { g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * .32 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
function bombIcon(g, x, y, r) {
  g.fillStyle = '#2b2430'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#ffffff55'; g.beginPath(); g.arc(x - r * .35, y - r * .35, r * .25, 0, 7); g.fill();
  g.strokeStyle = '#8a5a3c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + r * .5, y - r * .7); g.quadraticCurveTo(x + r * 1.1, y - r * 1.3, x + r * .9, y - r * 1.5); g.stroke();
}
function gemIcon(g, x, y, r, col) {
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(x - r, y - r * .3); g.lineTo(x - r * .55, y - r * .8); g.lineTo(x + r * .55, y - r * .8); g.lineTo(x + r, y - r * .3); g.lineTo(x, y + r); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffffff88'; g.beginPath(); g.moveTo(x - r * .5, y - r * .3); g.lineTo(x - r * .25, y - r * .65); g.lineTo(x, y - r * .3); g.closePath(); g.fill();
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(5, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 24, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const pfx = createFx(scene), shake = shaker();
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

  // ---------- the field (built once the size is known) ----------
  let w = 0, h = 0, field = null, land = null, grass = null, grassInk = null, ground = null, gtx = null, gcv = null, cursor = null;
  const cx = x => (x - (w - 1) / 2), cz = y => (y - (h - 1) / 2);
  const tilePos = (i, y = 0, v = new THREE.Vector3()) => v.set(cx(i % w), y, cz((i / w) | 0));
  const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const pops = new Map(); // tile -> when its grass flies off (performance.now ms)
  const popAt = (i, delay = 0) => pops.set(i, performance.now() + delay * 1000);
  let shownHidden = []; // what the grass shows right now: true while a tile is still covered
  function buildField(W, H) {
    if (field) { scene.remove(field, land); }
    w = W; h = H;
    land = island(w + 3.2, h + 4.6, { seed: 7, props: 18, size: 1.5, flowers: 60, rim: 3.4 }); land.position.y = -.3; scene.add(land);
    field = new THREE.Group(); scene.add(field);
    const deco = new THREE.Group(); field.add(deco);
    const put = (geo, mat, x = 0, y = 0, z = 0, parent = deco) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    // a wooden frame round the plot
    const fw = w + .5, fd = h + .5;
    put(new THREE.BoxGeometry(fw + .3, .5, fd + .3), M('#8a5a3c'), 0, -.27, 0).receiveShadow = true;
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(fw + .3, .16, .3), M('#b9794a'), 0, .02, s * (fd / 2)).castShadow = true;
      put(new THREE.BoxGeometry(.3, .16, fd + .3), M('#b9794a'), s * (fw / 2), .02, 0).castShadow = true;
    }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(new THREE.BoxGeometry(.38, .34, .38), M('#a86a42'), x * fw / 2, .08, z * fd / 2);
    // a signpost, a dirt pile with a spare shovel, a crate of finds
    const sx = -fw / 2 - 1.1, sz = fd / 2 + .4;
    put(new THREE.CylinderGeometry(.07, .08, 1.6, 6), M('#8a5a3c'), sx, .5, sz).castShadow = true;
    put(new THREE.BoxGeometry(1.1, .5, .08), M('#d9a066'), sx, 1.1, sz).castShadow = true;
    put(new THREE.BoxGeometry(.24, .08, .1), M('#e5543b'), sx - .2, 1.15, sz + .05); put(new THREE.BoxGeometry(.24, .08, .1), M('#3b2219'), sx + .2, 1.05, sz + .05);
    const pile = put(new THREE.IcosahedronGeometry(.7, 0), M('#a8744a'), fw / 2 + 1.2, -.05, fd / 2 - .3); pile.scale.set(1, .55, .9); pile.castShadow = true;
    put(new THREE.IcosahedronGeometry(.4, 0), M('#9a6a42'), fw / 2 + 1.7, -.05, fd / 2 + .3).scale.set(1, .6, 1);
    put(new THREE.BoxGeometry(.7, .55, .6), M('#c99763'), -fw / 2 - 1, .02, -fd / 2 + .6).castShadow = true;
    put(new THREE.OctahedronGeometry(.16, 0), M('#4db5ff'), -fw / 2 - 1.1, .38, -fd / 2 + .55); put(new THREE.OctahedronGeometry(.13, 0), M('#ff5c8a'), -fw / 2 - .85, .36, -fd / 2 + .7);
    bake(deco); toonify(deco, .035);
    // the dug ground: one canvas texture across the whole plot
    gcv = document.createElement('canvas'); gcv.width = w * PX; gcv.height = h * PX;
    gtx = new THREE.CanvasTexture(gcv); gtx.colorSpace = THREE.SRGBColorSpace; gtx.anisotropy = 8;
    const gg = new THREE.PlaneGeometry(w, h); gg.rotateX(-Math.PI / 2);
    ground = new THREE.Mesh(gg, toonMat(new THREE.MeshStandardMaterial({ map: gtx }))); ground.position.y = .011; ground.receiveShadow = true; field.add(ground);
    // grass tiles: one instanced mesh, plus one for their outlines
    const tg = new THREE.BoxGeometry(.9, TOP, .9); tg.translate(0, TOP / 2, 0);
    grass = new THREE.InstancedMesh(tg, toonMat(M('#ffffff')), w * h); grass.castShadow = grass.receiveShadow = true;
    grassInk = new THREE.InstancedMesh(tg, inkMat, w * h);
    const c = new THREE.Color();
    for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0; grass.setColorAt(i, c.set((x + y) % 2 ? '#8fd068' : '#7cc45a').offsetHSL(0, 0, (Math.sin(i * 12.9) * .5) * .03)); }
    field.add(grass, grassInk);
    // the cursor over the tile you point at
    const cg = new THREE.RingGeometry(.46, .6, 4, 1); cg.rotateX(-Math.PI / 2); cg.rotateY(Math.PI / 4);
    cursor = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: .95, depthWrite: false })); cursor.visible = false; cursor.renderOrder = 3; field.add(cursor);
    shownHidden = new Array(w * h).fill(true); pops.clear();
    setGrass();
    resize(true);
  }
  function setGrass() {
    for (let i = 0; i < w * h; i++) {
      const p0 = pops.get(i), p = p0 === undefined ? undefined : (performance.now() - p0) / 1000, hid = shownHidden[i] && !(pending?.landed && pending.i === i && !pending.done);
      if (!hid && p === undefined) sv.setScalar(0);
      else if (p !== undefined) { const t = Math.max(0, Math.min(1, p / .45)); sv.set(1 + t * .15, Math.max(0, 1 - t), 1 + t * .15); }
      else sv.setScalar(1);
      tilePos(i, p !== undefined ? Math.max(0, Math.min(1, p / .45)) * .6 : 0, pv);
      grass.setMatrixAt(i, mtx.compose(pv, q0, sv));
      grassInk.setMatrixAt(i, mtx.compose(pv.setY(pv.y - .02), q0, sv.multiplyScalar(sv.x ? 1.07 : 0).setY(sv.y ? sv.y * 1.12 : 0)));
    }
    grass.instanceMatrix.needsUpdate = true; grassInk.instanceMatrix.needsUpdate = true;
  }

  // paint the dug ground from what is shown
  let paintKey = '';
  function paint(tiles, by, glint, all, colors) {
    const key = tiles.map((t, i) => (shownHidden[i] ? 'h' : t)).join() + '|' + glint.join() + '|' + (all ? 1 : 0);
    if (key === paintKey) return; paintKey = key;
    const g = gcv.getContext('2d'), gl = new Set(glint);
    g.fillStyle = '#6b4a2f'; g.fillRect(0, 0, gcv.width, gcv.height);
    for (let i = 0; i < w * h; i++) {
      const x = (i % w) * PX, y = ((i / w) | 0) * PX, cxp = x + PX / 2, cyp = y + PX / 2;
      const hid = shownHidden[i], untouched = tiles[i] < 0;
      const v = untouched && all ? all[i] : hid ? -1 : tiles[i];
      if (v < 0) continue;
      g.fillStyle = ((i % w) + ((i / w) | 0)) % 2 ? '#d6a46c' : '#cc9a62'; g.fillRect(x + 1, y + 1, PX - 2, PX - 2);
      g.fillStyle = '#b9854f'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 14 + ((i * 37 + k * 29) % 68), y + 14 + ((i * 53 + k * 41) % 68), 3 + k, 0, 7); g.fill(); }
      if (v >= 1 && v <= 8) {
        g.font = `700 ${PX * .62}px "Fredoka", "Baloo 2", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 9; g.strokeStyle = '#fff4e2'; g.strokeText(v, cxp, cyp + 3); g.fillStyle = NUM_COL[v]; g.fillText(v, cxp, cyp + 3);
      }
      if (v >= 11 && v <= 13) { // a gem came out of here: an empty hole ringed in the finder's colour
        g.fillStyle = '#5a3a24'; g.beginPath(); g.ellipse(cxp, cyp + 4, PX * .3, PX * .24, 0, 0, 7); g.fill();
        if (by[i] >= 0 && colors[by[i]]) { g.strokeStyle = colors[by[i]]; g.lineWidth = 7; g.beginPath(); g.ellipse(cxp, cyp + 4, PX * .36, PX * .3, 0, 0, 7); g.stroke(); }
        gemIcon(g, cxp, cyp, PX * .17, GEM_COL[v]);
      }
      if (v === 14) { // a trap went off
        const r = g.createRadialGradient(cxp, cyp, 4, cxp, cyp, PX * .48); r.addColorStop(0, '#2b2430'); r.addColorStop(.6, '#5a4038'); r.addColorStop(1, '#5a403800');
        g.fillStyle = r; g.fillRect(x, y, PX, PX);
        if (!untouched) { g.strokeStyle = '#2b2430'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { const a = k * 1.05 + i; g.beginPath(); g.moveTo(cxp, cyp); g.lineTo(cxp + Math.cos(a) * PX * .42, cyp + Math.sin(a) * PX * .42); g.stroke(); } }
        else bombIcon(g, cxp, cyp + 6, PX * .2); // the end of the game: traps nobody stepped on
      }
      if (!hid && gl.has(i)) { g.fillStyle = '#ffd84a'; g.strokeStyle = INK; g.lineWidth = 3; sparklePath(g, x + PX - 18, y + 18, 13); g.fill(); g.stroke(); }
    }
    g.strokeStyle = '#00000022'; g.lineWidth = 2;
    for (let x = 0; x <= w; x++) { g.beginPath(); g.moveTo(x * PX, 0); g.lineTo(x * PX, h * PX); g.stroke(); }
    for (let y = 0; y <= h; y++) { g.beginPath(); g.moveTo(0, y * PX); g.lineTo(w * PX, y * PX); g.stroke(); }
    gtx.needsUpdate = true;
  }

  // ---------- things that come out of the ground ----------
  const finds = []; // { g, kind, t, from, to, s }
  const cone = new THREE.ConeGeometry(.3, .34, 8); cone.rotateX(Math.PI); cone.translate(0, -.24, 0);
  const gemGeo = { 11: new THREE.OctahedronGeometry(.2, 0), 12: [new THREE.CylinderGeometry(.18, .3, .14, 8), cone] };
  function makeFind(v) {
    const g = new THREE.Group();
    const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, toonMat(M(color, { emissive: color, emissiveIntensity: .15 }))); m.position.set(x, y, z); g.add(m); const o = new THREE.Mesh(geo, inkMat); o.scale.setScalar(1.12); m.add(o); return m; };
    if (v === 11) add(gemGeo[11], '#4db5ff').scale.set(1, 1.3, 1);
    else if (v === 12) { add(gemGeo[12][0], '#ff5c8a'); add(gemGeo[12][1], '#ff5c8a'); g.scale.setScalar(1.1); }
    else if (v === 13) { // a little golden chest
      add(new THREE.BoxGeometry(.5, .3, .34), '#b9794a'); const lid = add(new THREE.BoxGeometry(.52, .14, .36), '#c98a52', 0, .22, 0);
      add(new THREE.BoxGeometry(.54, .06, .06), '#ffc93c', 0, .08, .17); add(new THREE.BoxGeometry(.1, .12, .04), '#ffc93c', 0, .12, .19);
      const gold = add(new THREE.OctahedronGeometry(.1, 0), '#ffe27a', 0, .22, 0); g.userData.lid = lid; g.userData.gold = gold;
    } else { // a bomb
      const b = add(new THREE.SphereGeometry(.24, 10, 8), '#2b2430'); add(new THREE.CylinderGeometry(.06, .07, .12, 6), '#5b4636', 0, .26, 0);
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(.07, 0), new THREE.MeshBasicMaterial({ color: '#ffd84a' })); spark.position.set(0, .36, 0); g.add(spark); g.userData.spark = spark; g.userData.body = b;
    }
    scene.add(g); return g;
  }

  // ---------- avatars ----------
  let seats = [], seatKey = '', me = -1;
  const homeOf = (k, n) => { const p = homeAt(k, n, w, h); return new THREE.Vector3(p.x, 0, p.z); }; // shared with the server, which times the walk
  // the shovel: the blade's tip is the origin, the handle runs up +y to the hands (stretched each frame to reach them)
  const shovelGeo = [new THREE.CylinderGeometry(.042, .042, 1, 6).translate(0, .5, 0), new THREE.BoxGeometry(.34, .38, .06).translate(0, .19, 0), new THREE.BoxGeometry(.26, .07, .08)];
  const shovelMats = [toonMat(M('#a86a42')), toonMat(M('#c9ccd6'))];
  function makeShovel() {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(shovelGeo[0], shovelMats[0]), blade = new THREE.Mesh(shovelGeo[1], shovelMats[1]), tee = new THREE.Mesh(shovelGeo[2], shovelMats[0]);
    handle.position.y = .36; handle.scale.y = SPADE - .36 + .22; tee.position.y = .36 + handle.scale.y;
    for (const m of [handle, blade, tee]) { const o = new THREE.Mesh(m.geometry, inkMat); o.scale.set(1.5, 1.04, 1.5); if (m !== handle) o.scale.setScalar(1.14); m.add(o); m.castShadow = true; g.add(m); }
    g.userData = { handle, tee }; scene.add(g); return g;
  }
  function handsOf(av) { // where the hand is along each arm, from the arm's own shape (as Mini Golf does for the putter)
    for (const arm of av.userData.arms) { let lo = 0; arm.traverse(m => { if (m.isMesh && m.geometry) { m.geometry.computeBoundingBox(); lo = Math.min(lo, m.geometry.boundingBox.min.y); } }); arm.userData.hand = lo + .06; arm.userData.rz = arm.rotation.z; }
  }
  function freeSeat(s) { scene.remove(s.g, s.ring, s.shovel); disposeAvatar(s.av); s.ring.material.dispose(); }
  const ringGeo = new THREE.RingGeometry(.5, .64, 28); ringGeo.rotateX(-Math.PI / 2);
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    seats = list.map((p, i) => {
      const g = new THREE.Group(), av = avatar3d(p.color, p.av, { pose: 'stand' }); g.add(av); handsOf(av);
      const home = homeOf(i, list.length); g.position.copy(home); g.lookAt(0, 0, 0); scene.add(g);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false })); ring.position.y = .05; scene.add(ring);
      const shovel = makeShovel(); shovel.visible = false;
      return { g, av, home, ring, shovel, key: p.color + (p.av || []).join(''), hop: 0, nod: 0, walk: 0, ph: 0, at: home.clone(), from: home.clone(), to: home.clone(), hopT: -1, active: false, y: 0 };
    });
  }

  // ---------- state ----------
  let S = null, gid = '', digN = 0, digAt = 0, pending = null, hover = -1, startBurst = false, endKey = '';
  const endOpen = new Set();
  const now = () => performance.now();
  function setState(st) {
    if (st.w !== w || st.h !== h || st.gid !== gid) {
      if (st.w !== w || st.h !== h) buildField(st.w, st.h);
      else { shownHidden = st.tiles.map(t => t < 0); pops.clear(); setGrass(); }
      gid = st.gid; digN = st.dig?.n || 0; pending = null; endOpen.clear(); endKey = ''; startBurst = false; paintKey = '';
      shownHidden = st.tiles.map(t => t < 0); setGrass();
      for (const f of finds.splice(0)) scene.remove(f.g);
    }
    const key = st.seats.map(p => p.color + (p.av || []).join('')).join('|');
    if (key !== seatKey) {
      if (st.seats.length !== seats.length) buildSeats(st.seats);
      else st.seats.forEach((p, i) => { // someone took over a bot: swap the avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        s.g.remove(s.av); disposeAvatar(s.av); s.av = avatar3d(p.color, p.av, { pose: 'stand' }); s.av.scale.setScalar(AV); s.g.add(s.av); handsOf(s.av); s.key = k; s.hop = 1;
      });
      seatKey = key;
    }
    me = st.me;
    // a new dig: the tile stays covered until the shovel has done its work
    if (st.dig && st.dig.n !== digN) {
      digN = st.dig.n; digAt = now() - st.dig.ago;
      pending = { ...st.dig, cells: [st.dig.i, ...st.dig.opened], walk: st.dig.walk || 600, revealAt: digAt + (st.dig.walk || 600) + st.ms.dig, done: false, fx: false };
      const s = seats[st.dig.s];
      if (s) { // stand on the tile behind and dig it facing the camera, so the find is not hidden behind the digger
        const sp = standOf(st.dig.i, st.w, st.h); s.from.copy(s.g.position).setY(0); s.to.set(sp.x, 0, sp.z); s.hopT = digAt;
      }
      if (st.dig.ago > pending.walk + st.ms.dig + 400) pending.fx = true; // too late to show the fireworks
    }
    shownHidden = st.tiles.map((t, i) => ((t < 0 && !endOpen.has(i)) || (pending && !pending.done && pending.cells.includes(i))));
    if (st.ph === 'end' && st.all) {
      if (endKey !== st.gid) { endKey = st.gid; setTimeout(() => { if (!dead && S?.ph === 'end') { const hid = S.tiles.map((t, i) => (t < 0 ? i : -1)).filter(i => i >= 0); hid.forEach((i, k) => setTimeout(() => { if (dead || S?.gid !== endKey) return; endOpen.add(i); popAt(i); shownHidden[i] = false; }, k * 40)); } }, 900); }
    }
    S = st;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 120, hudTop = 70;
  const camLook = new THREE.Vector3(0, 0, .3), camBase = new THREE.Vector3(), v = new THREE.Vector3();
  let DIR = new THREE.Vector3(0, 1.5, 1).normalize();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D).add(camLook); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch || !w) return;
    if (cw === W && ch === H && !force) return; W = cw; H = ch;
    renderer.setSize(cw, ch, false);
    const portrait = cw / ch < 1;
    DIR = new THREE.Vector3(0, portrait ? 3.2 : 1.45, 1).normalize();
    camera.aspect = cw / ch; camera.fov = portrait ? 46 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const ex = w / 2 + (portrait ? .5 : 1.5), back = -h / 2 - 1.3, front = h / 2 + .35;
    const FIT = [new THREE.Vector3(-ex, 0, front), new THREE.Vector3(ex, 0, front), new THREE.Vector3(-ex, AV * 2.6, back), new THREE.Vector3(ex, AV * 2.6, back), new THREE.Vector3(0, AV * 2.6 + .6, back)];
    const top = hudTop, bottom = Math.max(top + 160, ch - hudBottom), side = 8;
    let lo = 3, hi = 120;
    for (let k = 0; k < 34; k++) {
      const D = (lo + hi) / 2; place(D);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of FIT) { const [x, y] = toPx(p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (x1 - x0 <= cw - side * 2 && y1 - y0 <= bottom - top) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    let y0 = Infinity, y1 = -Infinity; for (const p of FIT) { const [, y] = toPx(p); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    camera.setViewOffset(cw, ch, 0, (y0 + y1) / 2 - (top + bottom) / 2, cw, ch); camera.updateProjectionMatrix();
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3();
  function pick(clientX, clientY) {
    if (!w) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const x = Math.round(hit.x + (w - 1) / 2), y = Math.round(hit.z + (h - 1) / 2);
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    return y * w + x;
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastT = 0;
  const grip = new THREE.Vector3(), hand = new THREE.Vector3(), bladeP = new THREE.Vector3(), dirV = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const tv = new THREE.Vector3(), info = { tags: [], dig: { x: 0, y: 0 } };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const t = now(), rdt = lastT ? Math.min(.3, (t - lastT) / 1000) : dt; lastT = t; // walking keeps real time even on a slow device
    if (!S || !w) { renderer.render(scene, camera); return; }
    // the start: the middle of the field pops open
    if (!startBurst && S.startAgo < 2500) { startBurst = true; if (!reduced) for (let i = 0; i < w * h; i++) if (S.tiles[i] >= 0 && S.dig === null) popAt(i, (i % w + ((i / w) | 0)) * .04); }
    // the dig in progress: the grass comes off when the digger lands, what is under it shows after the digging
    if (pending && !pending.landed && t >= pending.revealAt - S.ms.dig * .7) { /* the first scoop lifts the turf */ pending.landed = true; if (!pending.done) { popAt(pending.i); if (!pending.fx) pfx.puff(tilePos(pending.i, .2, tv), { n: 10, color: ['#7cc45a', '#8fd068'], size: .26, speed: 2 }); } }
    if (pending && !pending.done && t >= pending.revealAt) {
      pending.done = true;
      for (const i of pending.cells) { shownHidden[i] = false; if (i !== pending.i) popAt(i); }
      const p = tilePos(pending.i, .3, new THREE.Vector3()), v2 = 10 + pending.kind;
      if (!pending.fx) {
        pfx.puff(p, { n: 14, color: ['#a8744a', '#7cc45a', '#d6a46c'], size: .3, speed: 2.4 });
        for (const j of pending.opened) pfx.puff(tilePos(j, .3, tv), { n: 4, color: ['#7cc45a', '#d6a46c'], size: .22, speed: 1.4 });
        const s = seats[pending.s];
        if (pending.kind >= 1 && pending.kind <= 3) {
          const g = makeFind(v2); g.position.copy(p); finds.push({ g, kind: v2, t: 0, s: pending.s });
          pfx.burst(p, { n: v2 === 13 ? 30 : 16, colors: [GEM_COL[v2], '#ffffff', '#ffd84a'], speed: 2.6, up: 4, size: .22, shape: STAR });
          if (v2 === 13) { pfx.confetti(tv.copy(p).setY(1.5), { n: 60, w: 3, h: 2, s: pending.s }); shake.kick(.08); }
          if (s) s.hop = 1;
        } else if (pending.kind === 4) {
          const g = makeFind(14); g.position.copy(p); finds.push({ g, kind: 14, t: 0, s: pending.s });
          if (s) s.nod = 1;
        }
      }
    }
    // gems float up, spin and fly to the finder; bombs fizz and go off
    for (let k = finds.length - 1; k >= 0; k--) {
      const f = finds[k]; f.t += dt; const s = seats[f.s];
      if (f.kind === 14) {
        const u = f.t / .8;
        f.g.position.y = .3 + Math.min(1, u) * .5; f.g.rotation.y += dt * 4;
        f.g.userData.spark.visible = Math.sin(f.t * 40) > 0; f.g.userData.body.scale.setScalar(1 + Math.max(0, u - .6) * 1.2 + Math.sin(f.t * 30) * .04);
        if (u >= 1) {
          const p = f.g.position.clone(); scene.remove(f.g); finds.splice(k, 1);
          pfx.burst(p, { n: 26, colors: ['#ffd84a', '#ff7a59', '#e5543b', '#ffffff'], speed: 4.5, up: 4, size: .3, shape: STAR });
          pfx.puff(p, { n: 22, color: ['#5a4038', '#2b2430', '#8a8794'], size: .55, speed: 3 }); pfx.ring(p.setY(.05), { color: '#ff7a59', size: 2.2 });
          shake.kick(.22); if (s) { s.nod = 1; s.knock = 1; }
        }
        continue;
      }
      const rise = Math.min(1, f.t / .5), fly = Math.max(0, (f.t - (f.kind === 13 ? 1.1 : .75)) / .45);
      f.g.rotation.y += dt * 5;
      if (f.kind === 13 && f.g.userData.lid) { f.g.userData.lid.rotation.x = -Math.min(1, Math.max(0, (f.t - .35) / .3)) * 1.1; f.g.userData.lid.position.z = -Math.min(1, Math.max(0, (f.t - .35) / .3)) * .1; f.g.userData.gold.position.y = .22 + Math.min(1, Math.max(0, (f.t - .45) / .4)) * .3; }
      if (fly <= 0) { f.g.position.y = .3 + rise * 1.1 + Math.sin(f.t * 6) * .05; f.g.scale.setScalar((f.kind === 12 ? 1.1 : 1) * (.4 + rise * .8)); if (Math.random() < dt * 10) pfx.sparkle(f.g.position, { n: 2, colors: ['#ffffff', GEM_COL[f.kind]], r: .4, size: .16 }); }
      else if (s) {
        tv.copy(s.g.position).setY(AV * 2.2); f.g.position.lerp(tv, Math.min(1, fly * .6 + dt * 6)); f.g.scale.multiplyScalar(1 - dt * 3);
        if (fly >= 1 || f.g.position.distanceTo(tv) < .2) { pfx.sparkle(tv, { n: 10, colors: ['#ffffff', GEM_COL[f.kind], '#ffd84a'], r: .5 }); scene.remove(f.g); finds.splice(k, 1); }
      } else if (fly >= 1) { scene.remove(f.g); finds.splice(k, 1); }
    }
    // grass tiles flying off
    if (pops.size) {
      for (const [i, at] of pops) { const p = (t - at) / 1000; if (p > .45) pops.delete(i); else if (p >= 0 && p - dt < 0) pfx.puff(tilePos(i, .3, tv), { n: 3, color: ['#7cc45a', '#d6a46c'], size: .2, speed: 1.2 }); }
      setGrass();
    } else if (S && shownHidden.length) setGrass();
    paint(S.tiles, S.by, S.glint, S.ph === 'end' ? S.all : null, S.seats.map(p => p.color));
    // sparkles over tiles next to buried gems, now and then
    if (S.glint.length && Math.random() < dt * 2.5) { const i = S.glint[Math.random() * S.glint.length | 0]; if (!shownHidden[i]) pfx.sparkle(tilePos(i, .15, tv).add(new THREE.Vector3(.3, 0, -.3)), { n: 2, colors: ['#fff1a8', '#ffd84a'], r: .2, size: .14 }); }
    // the cursor
    const myTurn = S.ph === 'play' && S.stage === 'turn' && S.turn === me && me >= 0;
    cursor.visible = myTurn && hover >= 0 && shownHidden[hover];
    if (cursor.visible) { tilePos(hover, TOP + .02, cursor.position); const k = 1 + Math.sin(T * 6) * .05; cursor.scale.set(k, 1, k); }

    // avatars: walk home, or hop to the tile being dug
    seats.forEach((s, i) => {
      s.active = S.ph === 'play' && S.turn === i && S.stage !== 'start';
      const digging = pending && pending.s === i && S.ph !== 'end' && (t < pending.revealAt + 900 || (S.turn === i && S.stage !== 'start'));
      let walking = 0;
      let digU = -1; // 0..1 through the digging once the walk is done
      const face = (yaw, k) => { let dr = yaw - s.g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); s.g.rotation.set(0, s.g.rotation.y + dr * Math.min(1, rdt * k), 0); };
      if (digging && s.hopT > 0) {
        // walk to the tile behind it, in exactly the time the server allows for it
        const u = Math.min(1, (t - s.hopT) / pending.walk), e = u * u * (3 - 2 * u) * .35 + u * .65;
        tv.lerpVectors(s.from, s.to, e); const step = Math.hypot(tv.x - s.g.position.x, tv.z - s.g.position.z);
        if (u < 1) { if (step > 1e-4) face(Math.atan2(tv.x - s.g.position.x, tv.z - s.g.position.z), 14); walking = 1; s.ph += step * 7; }
        else { face(0, 10); digU = Math.min(1, (t - s.hopT - pending.walk) / S.ms.dig); } // turn to the camera and dig the tile in front
        s.g.position.x = tv.x; s.g.position.z = tv.z;
      } else {
        // walk back to your spot by the plot
        const target = s.home, d = tv.copy(target).sub(s.g.position).setY(0), dist = d.length();
        if (dist > .04) { const step = Math.min(dist, rdt * 4.6); d.normalize(); face(Math.atan2(d.x, d.z), 12); s.g.position.addScaledVector(d, step); walking = 1; s.ph += step * 7; }
        else face(Math.atan2(-s.g.position.x, -s.g.position.z), 5);
      }
      { // stand on whatever is highest under your feet, so nobody sinks into a grass tile they are brushing past
        let top = Math.abs(s.g.position.x) < w / 2 + .45 && Math.abs(s.g.position.z) < h / 2 + .45 ? 0 : LAWN;
        for (let k = 0; k < 5 && top < TOP; k++) {
          const gx = Math.round(s.g.position.x + (k === 1 ? FOOT : k === 2 ? -FOOT : 0) + (w - 1) / 2), gz = Math.round(s.g.position.z + (k === 3 ? FOOT : k === 4 ? -FOOT : 0) + (h - 1) / 2);
          const cell = gx >= 0 && gz >= 0 && gx < w && gz < h ? gz * w + gx : -1;
          if (cell >= 0 && shownHidden[cell] && !(pending?.landed && pending.i === cell)) top = TOP;
        }
        s.y += (top - s.y) * Math.min(1, rdt * 16); s.g.position.y = s.y + (walking ? Math.abs(Math.sin(s.ph)) * .04 : 0);
      }
      s.hop = Math.max(0, s.hop - dt * 1.6); s.nod = Math.max(0, s.nod - dt * .8); s.knock = Math.max(0, (s.knock || 0) - dt * 1.5);
      s.av.position.y = FEET + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .35 * s.hop;
      s.av.rotation.x = -Math.sin((s.knock || 0) * Math.PI) * .5;
      animateAvatar(s.av, T, { seed: i, active: s.active && !walking, hop: s.hop, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      walkAvatar(s.av, s.ph, walking);
      // --- the shovel: held in both hands. Two scoops: push it into the tile, lever it, then lift and toss the dirt aside ---
      const arms = s.av.userData.arms, hold = digU >= 0 && t < pending.revealAt + 350;
      s.shovel.visible = hold;
      if (hold) {
        const c = (digU * 2) % 1;
        // push: 0 raised .. 1 driven in; toss: 0 .. 1 swinging the load out to the side
        const push = digU >= 1 ? 0 : c < .3 ? (c / .3) ** 2 : c < .5 ? 1 : Math.max(0, 1 - (c - .5) / .22);
        const toss = digU >= 1 ? 0 : c < .5 ? 0 : Math.sin(Math.min(1, (c - .5) / .42) * Math.PI);
        const lever = c >= .3 && c < .5 ? Math.sin((c - .3) / .2 * Math.PI) : 0;
        const side = i % 2 ? -1 : 1;
        s.av.rotation.x = push * .2 + lever * .05 - toss * .08;            // lean into it
        s.av.position.y -= push * .02;
        arms.forEach(a => { const sg = Math.sign(a.position.x) || 1; a.rotation.x = a.userData.rx - .5 - push * .28 - toss * .6 + lever * .12; a.rotation.z = -sg * .3 + toss * .4 * side; });
        s.g.updateMatrixWorld(true);
        grip.set(0, 0, 0); for (const a of arms) { hand.set(0, a.userData.hand, 0); a.localToWorld(hand); grip.add(hand); } grip.multiplyScalar(.5);
        // a rigid shovel gripped part way up the handle. The blade points down at the tile ahead, drives in, then swings up and out sideways
        const rest = 1 - push;
        // a fixed length: the hands tilt it so the tip reaches the ground on the push, then swings up and out on the toss
        const dx = toss * .7 * side, down = Math.min(.97, Math.max(.3, (grip.y - (pending.landed ? .08 : TOP - .1)) / SPADE));
        const dy = -(rest * .55 + push * down) * (1 - toss) + toss * .1;
        dirV.set(dx, dy, Math.sqrt(Math.max(.01, 1 - dx * dx - dy * dy)));
        bladeP.copy(grip).addScaledVector(dirV, SPADE);
        s.shovel.position.copy(bladeP); dirV.negate(); s.shovel.quaternion.setFromUnitVectors(UP, dirV);
        // dirt: a puff as the blade goes in, a clod thrown off as it swings out
        const stage = (digU >= .5 ? 2 : 0) + (c >= .26 ? 1 : 0) + (c >= .62 ? 1 : 0) * 10;
        if (stage !== s.digStage && digU < 1) {
          s.digStage = stage;
          if (c >= .62 && !pending.fx) pfx.burst(bladeP, { n: 9, colors: ['#a8744a', '#8a5a3c', '#d6a46c'], speed: 2.2, up: 2.6, size: .2, life: .7, shape: DOT, spread: .8 });
          else if (c >= .26 && !pending.fx) { pfx.puff(tilePos(pending.i, .1, tv), { n: 7, color: ['#a8744a', '#d6a46c', '#7cc45a'], size: .24, speed: 1.8 }); shake.kick(.025); }
        }
      } else { s.digStage = -1; for (const a of arms) a.rotation.z = a.userData.rz; }
      s.ring.position.set(s.g.position.x, s.y + .05, s.g.position.z);
      s.ring.material.opacity += ((s.active && S.stage === 'turn' ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1 + Math.sin(T * 4) * .05);
    });

    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .12), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    seats.forEach((s, i) => {
      const tg = info.tags[i] ||= { x: 0, y: 0 };
      tv.copy(s.g.position); tv.y += 1.15 + s.av.position.y; tv.project(camera); tg.x = (tv.x + 1) / 2 * W; tg.y = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    if (pending) { tilePos(pending.i, .9, tv).project(camera); info.dig.x = (tv.x + 1) / 2 * W; info.dig.y = (1 - tv.y) / 2 * H; }
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, pick,
    setHover(i) { hover = i; },
    setHud(bottom, top = hudTop) { if (Math.abs(bottom - hudBottom) > 6 || top !== hudTop) { hudBottom = bottom; hudTop = top; resize(true); } },
    tileScreen(i) { if (!w) return null; tilePos(i, .5, tv).project(camera); return { x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H }; },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) freeSeat(s);
      pfx.dispose(); gtx?.dispose(); inkMat.dispose(); renderer.dispose();
    },
  };
}

// Dominoes 3D table (three.js): a long table on a sky island, the line of tiles snaking across it, everyone's
// avatar on a stool with their tiles standing in front of them (you only ever see their backs), and the pile of
// spare tiles on the edge nearest you. Purely visual: it draws what the server sends.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { TILES, layout, footprint } from './rules.js';
import { paintHalf, FACE } from './tiles.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const U = .56, TH = .19;      // half a tile (one square) in world units, and how thick a tile is
const PILE_BACK = '#e08a00'; // the back of a tile nobody owns yet
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// table half-size and how far the line may run sideways (in squares) before it turns
const dims = portrait => (portrait ? { TX: 3.0, TZ: 4.3, W: 4, V: 3 } : { TX: 4.5, TZ: 3.3, W: 6.5, V: 2 });

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.55); sun.position.set(6, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island and the table ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 24, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const land = island(17, 17, { round: true, rim: 4.4, seed: 41, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 48, 13, 4, 1.6), drift = petals(scene, 24, 5, { n: small ? 6 : 10 });
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  let D = dims(false);
  const D0 = dims(false);
  const room = new THREE.Group(); scene.add(room);
  { // a wooden deck with a rug under the table
    const deck = put(new THREE.CylinderGeometry(8.6, 8.6, .16, 28), M('#e9d3a7'), 0, -2.42, 0, room); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 8.5 * 8.5 - (i * 1.3) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .1), M('#d6bb8a'), 0, -2.33, i * 1.3 + .65, room); }
    const rim = new THREE.TorusGeometry(8.6, .14, 6, 28); rim.rotateX(Math.PI / 2); put(rim, M('#c9a26b'), 0, -2.36, 0, room);
    bake(room); toonify(room, .04);
  }
  // the table is built for a wide screen and stretched to a tall one on phones held upright
  const table = new THREE.Group(); scene.add(table);
  {
    const top = put(new THREE.BoxGeometry(D0.TX * 2 + .9, .3, D0.TZ * 2 + .9), M('#b9794a'), 0, -.15, 0, table); top.castShadow = top.receiveShadow = true;
    const felt = put(new THREE.BoxGeometry(D0.TX * 2, .04, D0.TZ * 2), M('#2f8f86'), 0, .0, 0, table); felt.receiveShadow = true;
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(D0.TX * 2 + .16, .07, .1), M('#ffc94d'), 0, .01, s * (D0.TZ + .03), table);
      put(new THREE.BoxGeometry(.1, .07, D0.TZ * 2 + .16), M('#ffc94d'), s * (D0.TX + .03), .01, 0, table);
      for (const q of [-1, 1]) put(new THREE.BoxGeometry(.5, 2.2, .5), M('#a86a42'), s * (D0.TX - .2), -1.35, q * (D0.TZ - .2), table).castShadow = true;
    }
    bake(table); toonify(table, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- tiles ----------
  // One prototype (body, divider, back plate) is cloned for every tile; a tile lies flat with its long side along x
  // and its face up. The two numbers are flat pictures on top, sharing one material per number.
  const bodyGeo = new THREE.BoxGeometry(U * 2 * .95, TH, U * .95), plateGeo = new THREE.BoxGeometry(U * 2 * .95 - .1, .03, U * .95 - .1);
  const barGeo = new THREE.BoxGeometry(.035, .02, U * .62), faceGeo = new THREE.PlaneGeometry(U * .88, U * .88); faceGeo.rotateX(-Math.PI / 2);
  const bodyMat = toonMat(M(FACE)), barMat = toonMat(M('#3b2219'));
  const halfMats = [], plateMats = new Map();
  const halfMat = v => {
    if (!halfMats[v]) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; paintHalf(cv.getContext('2d'), 128, v); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; halfMats[v] = toonMat(new THREE.MeshStandardMaterial({ map: tx, roughness: .6 })); }
    return halfMats[v];
  };
  const plateMat = c => { if (!plateMats.has(c)) plateMats.set(c, toonMat(M(c))); return plateMats.get(c); };
  const proto = new THREE.Group();
  { const b = put(bodyGeo, bodyMat, 0, TH / 2, 0, proto); b.castShadow = true; put(barGeo, barMat, 0, TH + .005, 0, proto); toonify(proto, .022); }
  function makeTile(near = -1, far = -1, back = PILE_BACK, solid = false) { // near/far: the numbers on the -x and +x halves; -1 = a tile you cannot see
    const g = proto.clone();
    g.userData.plate = put(plateGeo, plateMat(back), 0, -.012, 0, g);
    if (solid) g.children[0].material = plateMat(back); // a spare tile in the pile is its back colour all over
    if (near >= 0) { put(faceGeo, halfMat(near), -U / 2, TH + .004, 0, g); put(faceGeo, halfMat(far), U / 2, TH + .004, 0, g); }
    return g;
  }
  // a tile standing on its short end inside a holder that turns its face towards (nx, nz)
  function standTile(back) {
    const h = new THREE.Group(), t = makeTile(-1, -1, back); t.rotation.z = Math.PI / 2; t.position.set(TH / 2, U * .95, 0); h.add(t);
    return h;
  }

  // tweens run on wall-clock time, so a slow device skips frames instead of falling behind the game
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  // where each player sits, clockwise from you: across (2 players), far left and far right (3), left, across, right (4)
  function spotOf(r) {
    const { TX, TZ } = D;
    if (r === 0) return { ax: 0, az: TZ + 1.3, nx: 0, nz: 1, rx: 0, rz: TZ + .5, w: 4 };
    if (n === 2) return { ax: 0, az: -TZ - 1.3, nx: 0, nz: -1, rx: 0, rz: -TZ + .42, w: TX * 2 - 1.6 };
    if (n === 3) { const s = r === 1 ? -1 : 1; return { ax: s * TX * .5, az: -TZ - 1.3, nx: 0, nz: -1, rx: s * TX * .5, rz: -TZ + .42, w: TX - .5 }; }
    if (r === 2) return { ax: 0, az: -TZ - 1.3, nx: 0, nz: -1, rx: 0, rz: -TZ + .42, w: TX * 2 - 2.4 };
    const s = r === 1 ? -1 : 1;
    return { ax: s * (TX + 1.3), az: -.5, nx: s, nz: 0, rx: s * (TX - .42), rz: -.5, w: TZ * 2 - 3.2 };
  }
  function freeSeat(s) { scene.remove(s.av, s.stool, s.rack, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), sp = spotOf(r), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(sp.ax, -.15, sp.az); av.lookAt(sp.ax - sp.nx * 3, -.15, sp.az - sp.nz * 3); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(sp.ax, -.95, sp.az); scene.add(stool);
      put(new THREE.BoxGeometry(1, .22, 1), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.BoxGeometry(.2, 1.3, .2), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      // their tiles stand in a row along the table edge, faces towards them
      const rack = new THREE.Group(); rack.position.set(sp.rx, .02, sp.rz); rack.rotation.y = Math.atan2(sp.nz, -sp.nx); rack.visible = !mine; scene.add(rack);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), sp.ax, -2.3, sp.az); ring.scale.set(1.25, 1, 1.25); ring.visible = !mine;
      return { av, stool, rack, ring, sp, mine, color: p.color, tiles: [], n: 0, hop: 0, nod: 0, look: 0, active: false, key: '' };
    });
  }
  // the rack closes up (and its tiles shrink) as it gets longer
  function setRack(s, cnt, pop = -1) {
    while (s.tiles.length > cnt) s.rack.remove(s.tiles.pop());
    const fresh = [];
    while (s.tiles.length < cnt) { const t = standTile(s.color); s.rack.add(t); s.tiles.push(t); fresh.push(t); }
    const step = Math.min(U * 1.12, s.sp.w / Math.max(1, cnt)), k = Math.min(1, step / (U * 1.12));
    s.tiles.forEach((t, j) => {
      const z = (j - (cnt - 1) / 2) * step, isNew = fresh.includes(t);
      if (isNew) { t.position.set(0, 0, z); t.scale.setScalar(.001); tween(.28, e => t.scale.setScalar(Math.max(.001, k * ease(e))), null, pop >= 0 ? pop + j * .09 : 0); }
      else { const z0 = t.position.z, k0 = t.scale.x; tween(.22, e => { t.position.z = z0 + (z - z0) * ease(e); t.scale.setScalar(k0 + (k - k0) * ease(e)); }); }
    });
    s.n = cnt;
  }
  const seatSpot = i => { const s = seats[i]; return s ? new THREE.Vector3(s.sp.rx, .5, s.sp.rz) : new THREE.Vector3(); };

  // ---------- the pile of spare tiles: a row standing on the edge nearest you ----------
  const pileG = new THREE.Group(); pileG.position.set(0, .02, D.TZ - .66); scene.add(pileG);
  const pile = [];
  const pileX = (j, cnt) => (j - (cnt - 1) / 2) * (TH + .035);
  function setPile(cnt) {
    while (pile.length > cnt) pileG.remove(pile.pop());
    while (pile.length < cnt) { const t = makeTile(-1, -1, PILE_BACK, true); t.rotation.order = 'YXZ'; t.rotation.set(Math.PI / 2, Math.PI / 2, 0); const h = new THREE.Group(); h.add(t); t.position.set(-TH / 2, U * .475, 0); pileG.add(h); pile.push(h); }
    pile.forEach((h, j) => { h.position.set(pileX(j, cnt), 0, 0); });
  }
  const pileSpot = () => pileG.localToWorld(new THREE.Vector3(pile.length ? pileX(pile.length - 1, pile.length) : 0, .5, 0));

  // ---------- the line ----------
  const line = new THREE.Group(); line.position.y = .02; scene.add(line);
  const laid = new Map(); // tile id -> mesh
  let lineTo = { s: 1, x: 0, z: 0 }, ends = null;
  const rotOf = o => Math.atan2(-o.dz, o.dx) + (o.dbl ? Math.PI / 2 : 0);
  // Keeps the whole line on the cloth: it shrinks once it outgrows the table, and slides over only as far as it has to.
  function fitLine(tiles, endL, endR) {
    let x0 = -1.5, x1 = 1.5, z0 = -1, z1 = 1;
    for (const o of [...tiles, { ...endL, dbl: false }, { ...endR, dbl: false }]) { const f = footprint(o); x0 = Math.min(x0, f[0]); z0 = Math.min(z0, f[1]); x1 = Math.max(x1, f[2]); z1 = Math.max(z1, f[3]); }
    const ax = D.TX - .35, zLo = -(D.TZ - 1.25), zHi = D.TZ - 1.4; // clear of the far players' tiles and of the pile
    const s = Math.min(1, ax * 2 / ((x1 - x0) * U), (zHi - zLo) / ((z1 - z0) * U));
    const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
    return { s, x: clamp(0, -ax - x0 * U * s, ax - x1 * U * s), z: clamp(0, zLo - z0 * U * s, zHi - z1 * U * s) };
  }
  function syncLine(st, animate) {
    const { tiles, endL, endR } = layout(st.chain, st.first, D.W, D.V);
    ends = { l: endL, r: endR };
    lineTo = fitLine(tiles, endL, endR);
    const keep = new Set(st.chain.map(e => e.t));
    for (const [t, m] of laid) if (!keep.has(t)) { // a new round: the old line is swept away
      laid.delete(t);
      if (animate && !reduced) { const k0 = m.scale.x; tween(.3, e => m.scale.setScalar(Math.max(.001, k0 * (1 - ease(e)))), () => line.remove(m), Math.random() * .25); } else line.remove(m);
    }
    st.chain.forEach((e, i) => {
      const o = tiles[i], to = new THREE.Vector3(o.x * U, 0, o.z * U), ry = rotOf(o);
      let m = laid.get(e.t);
      if (m) { m.position.x = to.x; m.position.z = to.z; m.rotation.y = ry; return; }
      m = makeTile(o.near, o.far); laid.set(e.t, m); line.add(m);
      const L = st.last;
      if (animate && L?.t === 'play' && L.tile === e.t && seats[L.s]) { // it flies in from whoever played it and lands with a knock
        line.updateMatrixWorld();
        const from = line.worldToLocal(seatSpot(L.s)), r0 = ry + (Math.random() < .5 ? -1.6 : 1.6), col = seats[L.s].color;
        m.position.copy(from); m.rotation.y = r0; m.scale.setScalar(.6);
        tween(.5, t => { const k = ease(t); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.4 / line.scale.x; m.rotation.y = r0 + (ry - r0) * k; m.scale.setScalar(.6 + .4 * k); },
          () => { m.position.copy(to); m.rotation.y = ry; const w = line.localToWorld(to.clone()).setY(.06); pfx.ring(w, { color: col, size: 1.1 }); pfx.puff(w, { n: 6, color: ['#fff4e2', '#d9c3a4'], size: .22, speed: 1.4 }); if (!reduced) shake.kick(o.dbl ? .09 : .05); });
        seats[L.s].hop = .5;
      } else { m.position.copy(to); m.rotation.y = ry; }
    });
  }

  // ---------- state from the server ----------
  let S = null, gid = '', mv = -1, round = 0;
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) { n = list.length; buildSeats(list); gid = ''; }
      else list.forEach((p, i) => { // someone came back or left: swap that avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1;
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
    }
    const fresh = st.gid !== gid, newRound = !fresh && st.round !== round;
    if (fresh) { gid = st.gid; tweens.length = 0; for (const m of laid.values()) line.remove(m); laid.clear(); }
    round = st.round;
    if (fresh || newRound) {
      mv = st.mv;
      const dealing = st.stage === 'deal' && st.stageLeft > 500 && !reduced;
      syncLine(st, !fresh);
      setPile(st.pile);
      list.forEach((p, i) => { setRack(seats[i], 0); setRack(seats[i], p.n, dealing ? .25 + rel(i) * .12 : -1); });
    } else if (st.mv !== mv) {
      mv = st.mv;
      const L = st.last;
      syncLine(st, true);
      if (L?.t === 'draw' && seats[L.s] && pile.length > st.pile) { // a tile leaves the pile for that player
        const from = pileSpot(), to = seatSpot(L.s), m = makeTile(-1, -1, PILE_BACK, true); m.position.copy(from); m.rotation.z = Math.PI / 2; scene.add(m);
        tween(.42, t => { const k = ease(t); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.2; m.rotation.y = k * 3; }, () => { scene.remove(m); pfx.puff(to.clone(), { n: 6, color: ['#fff4e2', '#d9c3a4'], size: .26, speed: 1.4 }); });
        seats[L.s].nod = 1;
      } else if (L?.t === 'pass' && seats[L.s]) seats[L.s].nod = 1.4;
      setPile(st.pile);
      list.forEach((p, i) => { if (seats[i].n !== p.n) setRack(seats[i], p.n); });
    }
    list.forEach((p, i) => { seats[i].active = st.turn === i && st.stage === 'play'; });
    if (st.rd && !S?.rd && seats[st.rd.w] && !fresh) { // the round's winner gets a little party
      const s = seats[st.rd.w]; s.hop = 1;
      if (!s.mine) { const top = s.av.position.clone().setY(2.1); pfx.confetti(top, { n: 60, w: 2.6, h: 2, s: st.rd.w }); pfx.burst(top, { n: 14, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 }); }
    }
    S = st;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, portrait = false;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, 0);
  const DIR = new THREE.Vector3(0, 1.7, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(dist) { camera.position.copy(DIR).multiplyScalar(dist); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const tall = w / h < .8;
    if (tall !== portrait || force === 'init') { // the table turns to suit the screen, and everything on it moves along
      portrait = tall; D = dims(portrait);
      table.scale.set(D.TX / D0.TX, 1, D.TZ / D0.TZ);
      pileG.position.set(0, .02, D.TZ - .66);
      if (S) { const st = S; seatKey = ''; me = -2; gid = ''; S = null; setState(st); }
    }
    camera.aspect = w / h; camera.fov = portrait ? 46 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 150 : 110, bottom = Math.max(top + 120, h - hudBottom);
    const side = D.TX + (portrait ? .55 : n === 4 ? 2.2 : .8);
    const FIT = [new THREE.Vector3(0, 2.5, -D.TZ - 1.3), new THREE.Vector3(0, .1, D.TZ + .5), new THREE.Vector3(-side, .6, 0), new THREE.Vector3(side, .6, 0)];
    let lo = 5, hi = 110;
    for (let i = 0; i < 32; i++) {
      const dist = (lo + hi) / 2; place(dist);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && lx >= 4 && rx <= w - 4) hi = dist; else lo = dist;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, 0, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastNow = 0, seatsN = 0;
  const tv = new THREE.Vector3();
  const info = { tags: [], ends: { l: { x: 0, y: 0 }, r: { x: 0, y: 0 } }, pile: { x: 0, y: 0 } };
  function loop(dt, now) {
    if (dead) return;
    if (!W) resize('init'); else resize(seatsN !== n ? true : undefined);
    seatsN = n;
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    for (let i = 0; i < tweens.length; i++) { // oldest first, so a later tween wins
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    { // the line eases to its size and place
      const k = Math.min(1, real * 6), s = line.scale.x + (lineTo.s - line.scale.x) * k;
      line.scale.setScalar(s); line.position.x += (lineTo.x - line.position.x) * k; line.position.z += (lineTo.z - line.position.z) * k;
    }
    const turnSeat = seats.findIndex(s => s.active);
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * .7);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      let look = 0;
      if (turnSeat >= 0 && turnSeat !== i) { const d = ((rel(turnSeat) - rel(i) + n) % n) / n; look = d < .5 ? .5 : -.5; }
      s.look += (look - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop, look: s.look, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .12), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    // where the HUD draws the name tags, the two "put it here" buttons and the pile's label
    seats.forEach((s, i) => {
      const t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.set(s.sp.ax, 2.25, s.sp.az).project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
      tv.set(s.sp.rx, .9, s.sp.rz).project(camera); t.cx = (tv.x + 1) / 2 * W; t.cy = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    if (ends) for (const k of ['l', 'r']) { const e = ends[k]; tv.set(e.x * U, .1, e.z * U); line.localToWorld(tv); tv.project(camera); info.ends[k].x = (tv.x + 1) / 2 * W; info.ends[k].y = (1 - tv.y) / 2 * H; }
    tv.set(0, .75, D.TZ - .66).project(camera); info.pile.x = (tv.x + 1) / 2 * W; info.pile.y = (1 - tv.y) / 2 * H;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    setHud(px) { if (Math.abs(px - hudBottom) > 6) { hudBottom = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const m of halfMats) if (m) { m.map?.dispose(); m.dispose(); }
      for (const m of plateMats.values()) if (!m.userData.shared) m.dispose();
      pfx.dispose(); bodyGeo.dispose(); plateGeo.dispose(); barGeo.dispose(); faceGeo.dispose(); ringGeo.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

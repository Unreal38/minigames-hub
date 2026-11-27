// Pet Herds 3D table (three.js): the Dominoes deck and table on a sky island. The groups on the table are laid
// out in rows on the cloth, each on a soft mat; everyone else's tiles stand at their edge of the table with only
// the backs showing, and the pile sits in stacks at your right. Tile faces are unlit, like card faces, so they
// stay bright at night. Purely visual: it draws what the server sends and tells the HUD where things are.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { PETS, check, isEgg, elOf, numOf } from './rules.js';
import { W as FW, H as FH, paintTile, petImage, loaded } from './tiles.js';
import { herdLook } from '../../pieceskins.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const TW = .5, TL = .66, TH = .13, GAP = .04, PAD = .13, GX = .3, GZ = .36; // tile size, gaps inside a group, between groups and rows
const PILE_BACK = '#e08a00';
const MAT = { plain: ['#1f6f68', .5], bad: ['#e5543b', .6], fit: ['#ffffff', .5], sel: ['#ffd84a', .55] };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const dims = portrait => (portrait ? { TX: 3.1, TZ: 4.7 } : { TX: 5.0, TZ: 3.4 });
const faceKey = id => (isEgg(id) ? 'egg' : elOf(id) * 13 + numOf(id));

function roundRect(w, h, r) {
  const s = new THREE.Shape(), a = w / 2, b = h / 2;
  s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r); s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b);
  s.lineTo(-a + r, b); s.quadraticCurveTo(-a, b, -a, b - r); s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b);
  const g = new THREE.ShapeGeometry(s, 3); g.rotateX(-Math.PI / 2); return g;
}
export const groupW = n => n * (TW + GAP) - GAP + PAD * 2;

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
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
  nightScene(scene);
  const land = island(17, 17, { round: true, rim: 4.4, seed: 41, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 48, 13, 4, 1.6), drift = petals(scene, 24, 5, { n: small ? 6 : 10 });
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  let D = dims(false);
  const D0 = dims(false);
  const room = new THREE.Group(); scene.add(room);
  {
    const deck = put(new THREE.CylinderGeometry(9.2, 9.2, .16, 28), M('#e9d3a7'), 0, -2.42, 0, room); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 9.1 * 9.1 - (i * 1.3) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .1), M('#d6bb8a'), 0, -2.33, i * 1.3 + .65, room); }
    const rim = new THREE.TorusGeometry(9.2, .14, 6, 28); rim.rotateX(Math.PI / 2); put(rim, M('#c9a26b'), 0, -2.36, 0, room);
    bake(room); toonify(room, .04);
  }
  const table = new THREE.Group(); scene.add(table);
  let felt;
  {
    const top = put(new THREE.BoxGeometry(D0.TX * 2 + .9, .3, D0.TZ * 2 + .9), M('#b9794a'), 0, -.15, 0, table); top.castShadow = top.receiveShadow = true;
    felt = put(new THREE.BoxGeometry(D0.TX * 2, .04, D0.TZ * 2), M('#2f8f86'), 0, 0, 0, table); felt.receiveShadow = true;
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(D0.TX * 2 + .16, .07, .1), M('#ffc94d'), 0, .01, s * (D0.TZ + .03), table);
      put(new THREE.BoxGeometry(.1, .07, D0.TZ * 2 + .16), M('#ffc94d'), s * (D0.TX + .03), .01, 0, table);
      for (const q of [-1, 1]) put(new THREE.BoxGeometry(.5, 2.2, .5), M('#a86a42'), s * (D0.TX - .2), -1.35, q * (D0.TZ - .2), table).castShadow = true;
    }
    bake(table); toonify(table, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- tiles ----------
  const bodyGeo = new THREE.BoxGeometry(TW, TH, TL), faceGeo = new THREE.PlaneGeometry(TW * .97, TL * .97); faceGeo.rotateX(-Math.PI / 2);
  const plateGeo = new THREE.BoxGeometry(TW - .08, .02, TL - .08), dotGeo = new THREE.CylinderGeometry(.05, .05, .02, 12);
  const selGeo = new THREE.PlaneGeometry(TW + .14, TL + .14); selGeo.rotateX(-Math.PI / 2);
  const bodyMat = toonMat(M(herdLook(0).body));
  const backMats = new Map(); const backMat = c => { if (!backMats.has(c)) backMats.set(c, toonMat(M(c))); return backMats.get(c); };
  const selMat = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: .95, depthWrite: false });
  const dotMats = new Map(); const dotMat = c => { if (!dotMats.has(c)) dotMats.set(c, new THREE.MeshBasicMaterial({ color: c })); return dotMats.get(c); };
  const faces = new Map(); // face key -> { mat, g, id }
  function faceMat(id, sk = 0) { // one face picture per tile and tile set (Wardrobe kind ht)
    const k = faceKey(id) + '|' + sk; let f = faces.get(k);
    if (!f) {
      const cv = document.createElement('canvas'); cv.width = FW; cv.height = FH; const g = cv.getContext('2d');
      const sp = isEgg(id) ? null : PETS[elOf(id)];
      paintTile(g, id, sp ? loaded.get(sp) : null, sk);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
      f = { mat: new THREE.MeshBasicMaterial({ map: tx }), g, id };
      faces.set(k, f);
      if (sp && !loaded.has(sp)) petImage(sp).then(im => { if (im && !dead) { paintTile(g, id, im, sk); tx.needsUpdate = true; } });
    }
    return f.mat;
  }
  const proto = new THREE.Group();
  { const b = put(bodyGeo, bodyMat, 0, TH / 2, 0, proto); b.castShadow = true; toonify(proto, .02); }
  const skinBody = sk => (sk ? backMat(herdLook(sk).body) : bodyMat);
  function makeTile(id, sk = 0) { // a face-up tile on the table; the face is added after toonify so it stays unlit
    const g = proto.clone(); g.children[0].material = skinBody(sk); put(faceGeo, faceMat(id, sk), 0, TH + .003, 0, g);
    g.children[0].userData.tile = id;
    return g;
  }
  function reskin(o, id, sk) { if (o.sk === sk) return; o.sk = sk; o.m.children[0].material = skinBody(sk); const f = o.m.children.find(c => c.geometry === faceGeo); if (f) f.material = faceMat(id, sk); }
  // a tile seen from behind: the owner's colour with a cream plate on top, or the body and face of their tile set
  function backTile(color, sk = 0) {
    const g = proto.clone(), L = herdLook(sk); g.children[0].material = backMat(sk ? L.body : color);
    put(plateGeo, backMat(sk ? L.face : '#f6ead8'), 0, TH + .005, 0, g); return g;
  }

  // wall-clock tweens, as in Dominoes
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  function spotOf(r) {
    const { TX, TZ } = D;
    if (r === 0) return { ax: 0, az: TZ + 1.3, nx: 0, nz: 1, rx: 0, rz: TZ + .5, w: 4 };
    if (n === 2) return { ax: 0, az: -TZ - 1.3, nx: 0, nz: -1, rx: 0, rz: -TZ + .42, w: TX * 2 - 1.6 };
    if (n === 3) { const s = r === 1 ? -1 : 1; return { ax: s * TX * .5, az: -TZ - 1.3, nx: 0, nz: -1, rx: s * TX * .5, rz: -TZ + .42, w: TX - .5 }; }
    if (r === 2) return { ax: 0, az: -TZ - 1.3, nx: 0, nz: -1, rx: 0, rz: -TZ + .42, w: TX * 2 - 2.4 };
    const s = r === 1 ? -1 : 1;
    return { ax: s * (TX + 1.3), az: -.3, nx: s, nz: 0, rx: s * (TX - .42), rz: -.3, w: TZ * 2 - 2.8 };
  }
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.rack, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), sp = spotOf(r), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(sp.ax, -.15, sp.az); av.lookAt(sp.ax - sp.nx * 3, -.15, sp.az - sp.nz * 3); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(sp.ax, -.95, sp.az); scene.add(stool);
      put(new THREE.BoxGeometry(1, .22, 1), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.BoxGeometry(.2, 1.3, .2), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const rack = new THREE.Group(); rack.position.set(sp.rx, .02, sp.rz); rack.rotation.y = Math.atan2(sp.nz, -sp.nx); rack.visible = !mine; scene.add(rack);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), sp.ax, -2.3, sp.az); ring.scale.set(1.25, 1, 1.25); ring.visible = !mine;
      return { av, stool, rack, ring, sp, mine, color: p.color, tiles: [], n: 0, hop: 0, nod: 0, look: 0, active: false, key: p.color + (p.av || []).join('') };
    });
  }
  // a rival's tile standing upright on its short edge: width along the rack, back plate facing the table, leaning back towards its owner
  function standTile(color, sk) { const h = new THREE.Group(), t = backTile(color, sk); t.rotation.set(0, Math.PI / 2, -Math.PI / 2 + .3, 'ZYX'); t.position.set(-.04, TL / 2 * Math.cos(.3) + .01, 0); h.add(t); return h; }
  function setRack(s, cnt, pop = -1) {
    if (s.mine) { s.n = cnt; return; }
    while (s.tiles.length > cnt) s.rack.remove(s.tiles.pop());
    const fresh = [];
    while (s.tiles.length < cnt) { const t = standTile(s.color, s.sk); s.rack.add(t); s.tiles.push(t); fresh.push(t); }
    const step = Math.min(TW + .03, s.sp.w / Math.max(1, cnt)), k = Math.min(1, step / (TW + .03));
    s.tiles.forEach((t, j) => {
      const z = (j - (cnt - 1) / 2) * step;
      if (fresh.includes(t)) { t.position.set(0, 0, z); t.scale.setScalar(.001); tween(.28, e => t.scale.setScalar(Math.max(.001, k * ease(e))), null, pop >= 0 ? pop + j * .05 : 0); }
      else { const z0 = t.position.z, k0 = t.scale.x; tween(.22, e => { t.position.z = z0 + (z - z0) * ease(e); t.scale.setScalar(k0 + (k - k0) * ease(e)); }); }
    });
    s.n = cnt;
  }
  // where a seat's tiles come from and go to: their rack, or (for you) the near edge where your tray is
  const seatSpot = i => { const s = seats[i]; if (!s) return new THREE.Vector3(); return s.mine ? new THREE.Vector3(0, 1.2, D.TZ + 1.2) : new THREE.Vector3(s.sp.rx, .5, s.sp.rz); };

  // ---------- the pile: face-down stacks at your right ----------
  const pileG = new THREE.Group(); pileG.position.set(D.TX - .75, .02, D.TZ - .66); scene.add(pileG);
  const pile = [];
  function setPile(cnt) {
    const show = cnt ? Math.max(1, Math.min(15, Math.ceil(cnt / 5))) : 0;
    while (pile.length > show) pileG.remove(pile.pop());
    while (pile.length < show) { const t = backTile(PILE_BACK); t.children[0].material = backMat(PILE_BACK); pileG.add(t); pile.push(t); }
    pile.forEach((t, j) => { const s = j % 3, h = j / 3 | 0; t.position.set((s - 1) * (TW + .05), h * (TH + .006), 0); t.rotation.y = (s - 1) * .06 + (h % 2 ? .04 : -.03); });
  }
  const pileSpot = () => pileG.localToWorld(new THREE.Vector3(0, (pile.length / 3) * TH + .2, 0));

  // ---------- the groups on the table ----------
  const board = new THREE.Group(); board.position.y = .02; scene.add(board);
  const tiles = new Map(); // tile id -> { m, to: Vector3, k, gid }
  const groups = new Map(); // group id -> { mat, edge, n, x, z, w, kind, label, bad }
  const matGeos = new Map(), edgeGeos = new Map();
  const matGeo = nT => { if (!matGeos.has(nT)) matGeos.set(nT, roundRect(groupW(nT), TL + .2, .12)); return matGeos.get(nT); };
  const edgeGeo = nT => { if (!edgeGeos.has(nT)) edgeGeos.set(nT, roundRect(groupW(nT) + .1, TL + .3, .16)); return edgeGeos.get(nT); };
  let area = null, areaKey = ''; // where the groups lie, for the close-up camera
  let scaleK = 1.6, marks = { sel: new Set(), fit: new Set(), drop: null }, freshSet = new Set(), turnCol = '#ffb547';

  // Rows of groups, back to front, scaled down as a whole once the table fills up.
  function flow(list) {
    const fourSides = n >= 4;
    const xMax = D.TX - (fourSides ? 1.0 : .35), zLo = -D.TZ + 1.15, zHi = D.TZ - 1.35;
    const avail = xMax * 2, rowH = TL + .2;
    // the last "row" also keeps room for a new group, so dropping one never needs a reshuffle first
    const widest = Math.max(3, ...list.map(g => g.t.length));
    for (let s = 1.6; s > .3; s -= .04) {
      if (groupW(widest) * s > avail && s > .34) continue; // a long line must fit across the cloth on its own
      const rows = []; let row = [], x = 0;
      for (const g of list) { const w = groupW(g.t.length) * s; if (row.length && x + w > avail) { rows.push(row); row = []; x = 0; } row.push({ g, w }); x += w + GX * s; }
      if (row.length) rows.push(row);
      const h = rows.length * rowH * s + Math.max(0, rows.length - 1) * GZ * s;
      if (h <= zHi - zLo || s <= .34) {
        const out = new Map(); let z = zLo + Math.max(0, ((zHi - zLo) - h) * .25);
        for (const r of rows) {
          const tot = r.reduce((a, o) => a + o.w, 0) + GX * s * (r.length - 1); let cx = -tot / 2;
          for (const o of r) { out.set(o.g.id, { x: cx + o.w / 2, z: z + rowH * s / 2, w: o.w }); cx += o.w + GX * s; }
          z += (rowH + GZ) * s;
        }
        return { s, at: out, next: { x: 0, z: Math.min(zHi, z + rowH * s / 2) } };
      }
    }
  }
  let nextSpot = { x: 0, z: 0 };
  // a tile wears the tile set of whoever put it down; one put down this turn, the set of the player whose turn it is
  const skinOf = (st, id) => { const o = st.own?.[id] ?? (st.turn >= 0 ? st.turn : -1); return Math.max(0, st.seats[o]?.fl?.ht | 0); };
  function syncTable(st, animate, from = -1) {
    const list = st.table, L = flow(list);
    scaleK = L.s; nextSpot = L.next;
    // the part of the cloth the groups use, for the close-up camera (rounded, so small shuffles do not refit)
    if (L.at.size) {
      let x0 = 0, x1 = 0, z0 = Infinity, z1 = L.next.z + (TL + .2) * L.s / 2;
      for (const o of L.at.values()) { x0 = Math.min(x0, o.x - o.w / 2); x1 = Math.max(x1, o.x + o.w / 2); z0 = Math.min(z0, o.z - (TL + .2) * L.s / 2); z1 = Math.max(z1, o.z + (TL + .2) * L.s / 2); }
      const r = v => Math.round(v * 4) / 4; area = { x0: r(x0), x1: r(x1), z0: r(z0), z1: r(z1) };
    } else area = null;
    const ak = area ? `${area.x0},${area.x1},${area.z0},${area.z1}` : '';
    if (ak !== areaKey) { areaKey = ak; if (W) resize('refit'); }
    const keepG = new Set(list.map(g => g.id)), keepT = new Set(list.flatMap(g => g.t));
    for (const [id, g] of groups) if (!keepG.has(id)) { board.remove(g.mat, g.edge); g.mat.material.dispose(); g.edge.material.dispose(); groups.delete(id); }
    for (const [id, o] of tiles) if (!keepT.has(id)) { // the tile went back to a tray (or the table was put back)
      tiles.delete(id);
      if (animate && !reduced && from >= 0) {
        const m = o.m, a = m.position.clone(), b = board.worldToLocal(seatSpot(from)), k0 = m.scale.x;
        tween(.35, e => { const k = ease(e); m.position.lerpVectors(a, b, k); m.position.y += Math.sin(k * Math.PI) * .8; m.scale.setScalar(Math.max(.001, k0 * (1 - k * .7))); }, () => board.remove(m));
      } else board.remove(o.m);
    }
    for (const g of list) {
      const at = L.at.get(g.id), c = check(g.t);
      let G = groups.get(g.id);
      if (!G) {
        G = { mat: new THREE.Mesh(matGeo(g.t.length), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })), edge: new THREE.Mesh(edgeGeo(g.t.length), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 })) };
        G.mat.userData.gid = g.id; G.mat.renderOrder = 1; G.edge.renderOrder = 0;
        board.add(G.edge, G.mat); groups.set(g.id, G);
        G.mat.position.set(at.x, .025, at.z); G.edge.position.set(at.x, .022, at.z);
      }
      if (G.n !== g.t.length) { G.mat.geometry = matGeo(g.t.length); G.edge.geometry = edgeGeo(g.t.length); G.n = g.t.length; }
      Object.assign(G, { x: at.x, z: at.z, w: at.w, kind: c?.kind || '', value: c?.value || 0, c, bad: !c, ids: g.t });
      const x0 = at.x - at.w / 2 + PAD * scaleK + TW * scaleK / 2;
      g.t.forEach((id, i) => {
        const to = new THREE.Vector3(x0 + i * (TW + GAP) * scaleK, .03, at.z);
        let o = tiles.get(id);
        if (!o) {
          const sk = skinOf(st, id);
          o = { m: makeTile(id, sk), sk, to, gid: g.id, dot: null }; tiles.set(id, o); board.add(o.m);
          o.m.scale.setScalar(scaleK);
          if (animate && !reduced && from >= 0) { // it flies in from whoever put it down
            o.m.position.copy(board.worldToLocal(seatSpot(from))); o.m.rotation.y = (Math.random() - .5) * 2; o.fly = 0;
          } else o.m.position.copy(to);
        }
        o.to = to; o.gid = g.id; reskin(o, id, skinOf(st, id));
      });
    }
    paintMarks(st);
  }
  function paintMarks(st = S) {
    freshSet = new Set(st?.fresh || []);
    turnCol = st && st.turn >= 0 ? st.seats[st.turn]?.color || '#ffb547' : '#ffb547';
    for (const [id, G] of groups) {
      const fit = marks.fit.has(id), drop = marks.drop === id, fresh = G.ids.some(t => freshSet.has(t));
      const [c, a] = drop ? MAT.sel : G.bad ? MAT.bad : fit ? MAT.fit : fresh ? [turnCol, .62] : MAT.plain;
      G.mat.material.color.set(c); G.mat.material.opacity = a;
      G.edge.material.color.set(drop ? '#ffd84a' : G.bad ? '#e5543b' : fit ? '#ffffff' : turnCol);
      G.edgeOn = drop || G.bad || fit || fresh ? 1 : 0; G.pulse = fit && !drop;
    }
    for (const [id, o] of tiles) {
      const sel = marks.sel.has(id), fresh = freshSet.has(id);
      if (sel && !o.sel) { o.sel = put(selGeo, selMat, 0, -.005, 0, o.m); o.sel.renderOrder = 2; } else if (!sel && o.sel) { o.m.remove(o.sel); o.sel = null; }
      if (fresh && !o.dot) o.dot = put(dotGeo, dotMat(turnCol), TW / 2 - .1, TH + .015, -TL / 2 + .1, o.m);
      else if (fresh && o.dot) o.dot.material = dotMat(turnCol);
      else if (!fresh && o.dot) { o.m.remove(o.dot); o.dot = null; }
      o.lift = sel ? .16 : 0;
    }
  }

  // ---------- state from the server ----------
  let S = null, gid = '', mv = -1, round = 0, dead = false;
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) { n = list.length; buildSeats(list); gid = ''; }
      else list.forEach((p, i) => {
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1; s.key = k;
      });
    }
    list.forEach((p, i) => { const s = seats[i], sk = Math.max(0, p.fl?.ht | 0); if (s && s.sk !== sk) { const had = s.sk !== undefined; s.sk = sk; if (had && !s.mine) { const c = s.n; setRack(s, 0); setRack(s, c); } } });
    const fresh = st.gid !== gid, newRound = !fresh && st.round !== round;
    if (fresh) { gid = st.gid; tweens.length = 0; }
    if (fresh || newRound) {
      round = st.round; mv = st.mv; lastDraw = st.last?.mv ?? -1;
      for (const o of tiles.values()) board.remove(o.m); tiles.clear();
      for (const G of groups.values()) { board.remove(G.mat, G.edge); G.mat.material.dispose(); G.edge.material.dispose(); } groups.clear();
      marks = { sel: new Set(), fit: new Set(), drop: null };
      syncTable(st, false);
      setPile(st.pool);
      const dealing = st.stage === 'deal' && st.dealLeft > 500 && !reduced;
      list.forEach((p, i) => { setRack(seats[i], 0); setRack(seats[i], p.n, dealing ? .2 + rel(i) * .1 : -1); });
    } else if (st.mv !== mv) {
      mv = st.mv;
      const L = st.last;
      // tiles come from (and go back to) whoever's turn it was: when the turn just moved on, that's the one before
      const src = S && S.turn >= 0 && S.turn !== st.turn ? S.turn : st.turn;
      syncTable(st, true, src);
      if (L?.t === 'draw' && L.mv !== lastDraw) drawFx(L.s, L.mv);
      setPile(st.pool);
      list.forEach((p, i) => { if (seats[i].n !== p.n) setRack(seats[i], p.n); });
    }
    list.forEach((p, i) => { seats[i].active = st.turn === i && st.stage === 'turn'; });
    S = st;
    paintMarks(st);
  }
  let lastDraw = -1;
  function drawFx(s, m0) {
    lastDraw = m0; if (!seats[s]) return;
    const from = pileSpot(), to = seatSpot(s), m = backTile(PILE_BACK); m.position.copy(from); scene.add(m);
    tween(.45, t => { const k = ease(t); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 1.2; m.rotation.y = k * 3; m.rotation.x = k * 1.2; }, () => { scene.remove(m); if (!seats[s].mine) pfx.puff(to.clone(), { n: 6, color: ['#fff4e2', '#d9c3a4'], size: .24, speed: 1.4 }); });
    seats[s].nod = 1;
  }
  // a play went in for good: the changed groups get a ring and a puff in the player's colour
  function playFx(gids, s) {
    const col = seats[s]?.color || '#ffd84a';
    for (const id of gids) { const G = groups.get(id); if (!G) continue; const w = board.localToWorld(new THREE.Vector3(G.x, .06, G.z)); pfx.ring(w, { color: col, size: .9 + G.w * .25 }); pfx.puff(w, { n: 5, color: ['#fff4e2', '#d9c3a4'], size: .2, speed: 1.2 }); }
    if (seats[s]) seats[s].hop = .6;
    if (!reduced) shake.kick(.04);
  }
  function roundFx(wins) {
    for (const w of wins) { const s = seats[w]; if (!s) continue; s.hop = 1; if (!s.mine) { const top = s.av.position.clone().setY(2.1); pfx.confetti(top, { n: 60, w: 2.6, h: 2, s: w }); pfx.burst(top, { n: 14, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 }); } }
  }
  function cue(s, kind) { const x = seats[s]; if (!x) return; if (kind === 'nod') x.nod = 1.3; else x.hop = .7; }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect(); if (!r.width) return null;
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const bodies = []; for (const o of tiles.values()) bodies.push(o.m.children[0]);
    let hit = ray.intersectObjects(bodies, false)[0];
    if (hit) { const id = hit.object.userData.tile; return { t: id, g: tiles.get(id)?.gid }; }
    const mats = []; for (const G of groups.values()) mats.push(G.mat, G.edge);
    hit = ray.intersectObjects(mats, false)[0];
    if (hit) { const G = [...groups.entries()].find(([, g]) => g.mat === hit.object || g.edge === hit.object); return G ? { g: G[0] } : null; }
    hit = ray.intersectObject(felt, false)[0];
    return hit ? { cloth: true } : null;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, hudTop = 110, portrait = null;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, 0);
  const v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const tall = w / h < .8;
    if (tall !== portrait || force === 'init') {
      portrait = tall; D = dims(portrait);
      table.scale.set(D.TX / D0.TX, 1, D.TZ / D0.TZ);
      pileG.position.set(D.TX - .75, .02, D.TZ - .66);
      if (S) { const st = S; seatKey = ''; me = -2; gid = ''; S = null; setState(st); }
    }
    const DIR = new THREE.Vector3(0, portrait ? 2.4 : 2.0, 1).normalize();
    const place = dist => { camera.position.copy(DIR).multiplyScalar(dist); camera.lookAt(camLook); camera.updateMatrixWorld(); };
    camera.aspect = w / h; camera.fov = portrait ? 46 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = hudTop; let bottom = Math.max(top + 120, h - hudBottom);
    // portrait phones fit the cloth (the rivals are chips in the HUD); wide screens fit the whole table and its seats.
    // "close" fits just the part of the cloth the groups use: the camera eases towards it as a full table shrinks the tiles
    const side = D.TX + (portrait ? .25 : n >= 4 ? 2.0 : .8), xMax = D.TX - (n >= 4 ? 1.0 : .35);
    const wide = portrait
      ? [new THREE.Vector3(0, .6, -D.TZ - .2), new THREE.Vector3(0, .1, D.TZ + .3), new THREE.Vector3(-side, .2, 0), new THREE.Vector3(side, .2, 0)]
      : [new THREE.Vector3(0, 2.4, -D.TZ - 1.3), new THREE.Vector3(0, .1, D.TZ + .45), new THREE.Vector3(-side, .6, 0), new THREE.Vector3(side, .6, 0)];
    const A = area || { x0: -xMax, x1: xMax, z0: -D.TZ + 1.15, z1: D.TZ - 1.35 }, cx = Math.max(-A.x0, A.x1) + .25, cz0 = A.z0 - .3, cz1 = A.z1 + .3;
    const close = [new THREE.Vector3(0, .1, cz0), new THREE.Vector3(0, .1, cz1), new THREE.Vector3(-cx, .1, cz1), new THREE.Vector3(cx, .1, cz1)];
    const fit = FIT => {
      let lo = 4, hi = 110;
      for (let i = 0; i < 32; i++) {
        const dist = (lo + hi) / 2; place(dist);
        const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
        if (fy - ty <= bottom - top && lx >= 4 && rx <= w - 4) hi = dist; else lo = dist;
      }
      place(hi); const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
      return { dist: hi, off: (ty + fy) / 2 - (top + bottom) / 2 };
    };
    const f = fit(wide); bottom -= 56; const c = fit(close); bottom += 56; // close up, the hint line above the tray stays clear of the last row
    if (c.dist > f.dist) { c.dist = f.dist; c.off = f.off; } // the close view never sits further out than the wide one
    view.wide = f; view.close = c; view.dir.copy(DIR);
    scene.fog.near = f.dist + 20; scene.fog.far = f.dist + 130;
    applyView(0, force !== 'refit'); // a new window size snaps; a new layout eases
  }
  // how close the camera sits: 0 = the whole table, 1 = just the groups; it follows the tile size, eased so it never jumps
  const view = { wide: null, close: null, dir: new THREE.Vector3(0, 1, 1), z: 0, zTo: 0, dist: 0, off: 0, set: false };

  function applyView(dt, snap) {
    if (!view.wide) return;
    const e = view.z * view.z * (3 - 2 * view.z), dist = view.wide.dist + (view.close.dist - view.wide.dist) * e, off = view.wide.off + (view.close.off - view.wide.off) * e;
    if (snap || !view.set) { view.dist = dist; view.off = off; view.set = true; }
    else { const k = 1 - Math.exp(-dt * 2.5); if (Math.abs(dist - view.dist) < 1e-3 && Math.abs(off - view.off) < .05) return; view.dist += (dist - view.dist) * k; view.off += (off - view.off) * k; }
    camBase.copy(view.dir).multiplyScalar(view.dist);
    camera.clearViewOffset(); camera.setViewOffset(W, H, 0, view.off, W, H); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, lastNow = 0, seatsN = 0;
  const tv = new THREE.Vector3();
  const info = { tags: [], groups: new Map(), pile: { x: 0, y: 0 }, next: { x: 0, y: 0 }, portrait: false };
  function loop(dt, now) {
    if (dead) return;
    if (!W) resize('init'); else resize(seatsN !== n ? true : undefined);
    seatsN = n;
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    for (let i = 0; i < tweens.length; i++) {
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    // tiles glide to their places (a new one arcs in from its player), groups' mats follow
    const k = 1 - Math.exp(-real * 12);
    for (const o of tiles.values()) {
      const m = o.m, y = o.to.y + (o.lift || 0);
      if (o.fly !== undefined) { // in flight from a seat
        o.fly = Math.min(1, o.fly + real / .45); const e = ease(o.fly);
        if (!o.from) o.from = m.position.clone();
        m.position.lerpVectors(o.from, o.to, e); m.position.y += Math.sin(e * Math.PI) * 1.1; m.rotation.y *= 1 - e;
        if (o.fly >= 1) { o.fly = undefined; o.from = null; m.rotation.y = 0; }
      } else { m.position.x += (o.to.x - m.position.x) * k; m.position.z += (o.to.z - m.position.z) * k; m.position.y += (y - m.position.y) * k; }
      const s = m.scale.x + (scaleK - m.scale.x) * k; m.scale.setScalar(s);
    }
    const pulse = .5 + .5 * Math.sin(T * 5);
    for (const G of groups.values()) {
      G.mat.position.x += (G.x - G.mat.position.x) * k; G.mat.position.z += (G.z - G.mat.position.z) * k;
      G.edge.position.x = G.mat.position.x; G.edge.position.z = G.mat.position.z;
      const s = G.mat.scale.x + (scaleK - G.mat.scale.x) * k; G.mat.scale.setScalar(s); G.edge.scale.setScalar(s);
      G.edge.material.opacity = G.edgeOn ? (G.pulse ? .45 + .5 * pulse : .9) : 0; G.edge.visible = !!G.edgeOn;
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
    view.zTo = Math.min(1, Math.max(0, (1.6 - scaleK) / .6));
    view.z += (view.zTo - view.z) * (1 - Math.exp(-real * 1.6)); applyView(real);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .08), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .03), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    // where the HUD draws name tags, group labels, the pile count and the "new group" spot
    seats.forEach((s, i) => {
      const t = info.tags[i] ||= { x: 0, y: 0, mine: false };
      tv.set(s.sp.ax, 2.25, s.sp.az).project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine; t.off = view.z > .3 && t.y < hudTop * .5; // zoomed in past this seat: the scoreboard lists them instead
    });
    info.tags.length = seats.length;
    for (const id of info.groups.keys()) if (!groups.has(id)) info.groups.delete(id);
    for (const [id, G] of groups) {
      const o = info.groups.get(id) || {}; info.groups.set(id, o);
      tv.set(G.mat.position.x, .05, G.mat.position.z + (TL + .2) / 2 * G.mat.scale.x).add(board.position).project(camera);
      o.x = (tv.x + 1) / 2 * W; o.y = (1 - tv.y) / 2 * H; o.bad = G.bad; o.kind = G.kind; o.value = G.value; o.c = G.c; o.n = G.ids.length;
    }
    tv.set(pileG.position.x, .8, pileG.position.z).project(camera); info.pile.x = (tv.x + 1) / 2 * W; info.pile.y = (1 - tv.y) / 2 * H;
    tv.set(nextSpot.x, .05, nextSpot.z).project(camera); info.next.x = (tv.x + 1) / 2 * W; info.next.y = (1 - tv.y) / 2 * H;
    info.portrait = portrait;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, pick, playFx, roundFx, cue,
    setMarks(m) { marks = { sel: m.sel || new Set(), fit: m.fit || new Set(), drop: m.drop ?? null }; paintMarks(); },
    tilePx(id) { const o = tiles.get(id); if (!o) return null; tv.copy(o.m.position).add(board.position).project(camera); return { x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H }; },
    groupPx(id) { const G = groups.get(id); if (!G) return null; tv.set(G.x, .1, G.z).add(board.position).project(camera); return { x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H }; },
    setHud(bottomPx, topPx = hudTop) { if ((Math.abs(bottomPx - hudBottom) > 6 || Math.abs(topPx - hudTop) > 6) && hudFitOk(canvas)) { hudBottom = bottomPx; hudTop = topPx; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) disposeAvatar(s.av), s.ring.material.dispose();
      for (const f of faces.values()) { f.mat.map?.dispose(); f.mat.dispose(); }
      for (const G of groups.values()) { G.mat.material.dispose(); G.edge.material.dispose(); }
      for (const g of [...matGeos.values(), ...edgeGeos.values()]) g.dispose();
      for (const m of backMats.values()) if (!m.userData.shared) m.dispose();
      for (const m of dotMats.values()) m.dispose();
      pfx.dispose(); bodyGeo.dispose(); faceGeo.dispose(); plateGeo.dispose(); dotGeo.dispose(); selGeo.dispose(); ringGeo.dispose(); selMat.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

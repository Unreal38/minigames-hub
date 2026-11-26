// Pet Pairs 3D table (three.js): a round table on a sky island with everyone's avatar on a stool round it and the
// cards in a grid in the middle. Flipped cards turn over in place; a found pair flies to a little pile in front of
// whoever found it; the Whirlwind slides cards round each other. Purely visual: it draws what the server sends,
// and a face-down card has no pet here at all until the server shows it.
import * as THREE from 'three';
import { cardGeometry } from '../../cardgeo.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { paintFace, paintBack, petImage, loaded, W as TW, H as TH } from './cards.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const CW = .8, CH = CW * TH / TW;  // card size
const PX = .94, PZ = 1.22;         // grid step across and away
const PILE = .62;                  // found pairs are shown smaller in front of their finder
const Y0 = .035;                   // a card's height on the cloth (its back sits .004 lower, clear of the cloth top at .02)
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

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

  // ---------- the island ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 26, max: 95, below: -12 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(18, 18, { round: true, rim: 4.6, seed: 57, props: 16, size: 1.7, flowers: 60 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 50, 13, 4, 1.6), drift = petals(scene, 24, 5, { n: small ? 6 : 10 });
  const pfx = createFx(scene), shake = shaker();
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // ---------- the table: a rounded oblong just bigger than the grid, with a band round it for the found pairs ----------
  let A = 4, B = 4, table = null; // half the table's width and depth
  const roundRect = (w, d, r) => { const s = new THREE.Shape(), x = -w / 2, y = -d / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const slab = (w, d, r, h, col) => { const g = new THREE.ExtrudeGeometry(roundRect(w, d, r), { depth: h, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return new THREE.Mesh(g, M(col)); };
  function buildTable(a, b) {
    if (table && Math.abs(a - A) < .01 && Math.abs(b - B) < .01) return;
    if (table) { scene.remove(table); table.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
    A = a; B = b; table = new THREE.Group(); scene.add(table);
    const R = Math.max(A, B);
    const deck = put(new THREE.CylinderGeometry(R + 4.6, R + 4.6, .16, 32), M('#e9d3a7'), 0, -2.42, 0, table); deck.receiveShadow = true;
    for (let i = 0; i < 8; i++) { const g = new THREE.RingGeometry(1.6 + i * .9, 2 + i * .9, 32); g.rotateX(-Math.PI / 2); put(g, M(i % 2 ? '#d9ecff' : '#cfe8c3'), 0, -2.335, 0, table); }
    const top = slab(A * 2 + .5, B * 2 + .5, 1.1, .32, '#b9794a'); top.position.y = -.36; top.castShadow = top.receiveShadow = true; table.add(top);
    const edge = slab(A * 2 + .1, B * 2 + .1, .95, .05, '#2f86cc'); edge.position.y = -.06; edge.receiveShadow = true; table.add(edge);
    const cloth = slab(A * 2 - .2, B * 2 - .2, .8, .05, '#f3e9ff'); cloth.position.y = -.03; cloth.receiveShadow = true; table.add(cloth);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(new THREE.CylinderGeometry(.22, .3, 2.1, 8), M('#a86a42'), x * (A - .9), -1.35, z * (B - .9), table).castShadow = true;
    // lanterns on posts round the deck
    for (let k = 0; k < 6; k++) {
      const a2 = k / 6 * Math.PI * 2 + .5, x = Math.cos(a2) * (R + 3.6), z = Math.sin(a2) * (R + 3.6), col = ['#ffb547', '#7ed3b2', '#ff8fab'][k % 3];
      put(new THREE.CylinderGeometry(.09, .12, 3.6, 6), M('#a86a42'), x, -.6, z, table).castShadow = true;
      put(new THREE.SphereGeometry(.32, 10, 8), M(col, { emissive: col, emissiveIntensity: .35 }), x, 1.4, z, table);
    }
    bake(table); toonify(table, .04);
  }

  // ---------- cards ----------
  const cardGeo = cardGeometry(CW, CH); cardGeo.rotateX(-Math.PI / 2);
  const backGeo = cardGeo.clone(); backGeo.rotateZ(Math.PI); backGeo.translate(0, -.004, 0);
  const texs = [], mats = new Map();
  function canvasTex(paint) {
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texs.push(tex);
    const redo = () => { paint(cv.getContext('2d')); tex.needsUpdate = true; }; redo(); document.fonts?.ready.then(redo);
    return { tex, redo };
  }
  const backMat = toonMat(new THREE.MeshStandardMaterial({ map: canvasTex(paintBack).tex, roughness: .55 }));
  // card faces are unlit, so a pet looks the same day or night
  function faceMat(sp, tw) {
    const k = sp + '|' + tw;
    if (!mats.has(k)) {
      const { tex, redo } = canvasTex(g => paintFace(g, sp, tw, loaded.get(sp) || null));
      if (!loaded.has(sp)) petImage(sp).then(im => { if (im && !dead) redo(); });
      mats.set(k, new THREE.MeshBasicMaterial({ map: tex }));
    }
    return mats.get(k);
  }
  const glowGeo = cardGeometry(CW + .16, CH + .16); glowGeo.rotateX(-Math.PI / 2);
  const glow = put(glowGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: .85, depthWrite: false })); glow.visible = false;

  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => { const t = { t: -delay, dur, fn, done }; tweens.push(t); return t; };
  const cancel = c => { for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].card === c) tweens.splice(i, 1); };
  const tweenCard = (c, dur, fn, done, delay = 0) => { cancel(c); const t = tween(dur, fn, done, delay); t.card = c; return t; };

  let cards = [], w = 0, h = 0, flip = false, gid = '';
  // where card i lies: the grid turns a quarter on a portrait screen, so the long side runs away from you
  const slot = i => { const c = i % w, r = i / w | 0, dc = flip ? h : w, dr = flip ? w : h, x = flip ? r : c, z = flip ? c : r; return new THREE.Vector3((x - (dc - 1) / 2) * PX, Y0, (z - (dr - 1) / 2) * PZ); };
  function makeCard(i) {
    const g = new THREE.Group(), front = new THREE.Mesh(cardGeo, backMat), back = new THREE.Mesh(backGeo, backMat);
    front.castShadow = true; g.add(front, back); g.position.copy(slot(i)); g.rotation.z = Math.PI; scene.add(g);
    return { g, front, i, state: 'down', face: '', owner: -1, lift: 0, peekT: 0 };
  }
  function clearCards() { for (const c of cards) scene.remove(c.g); cards = []; tweens.length = 0; }
  const pose = (c, p, rz, ry = 0, k = 1) => { c.g.position.copy(p); c.g.rotation.set(0, ry, rz); c.g.scale.setScalar(k); };

  // turn a card face up or down where it lies
  function turn(c, up, delay = 0) {
    const from = c.g.rotation.z, to = up ? 0 : Math.PI, p = slot(c.i), y0 = c.g.position.y;
    tweenCard(c, .36, t => { const e = ease(t); c.g.rotation.z = from + (to - from) * e; c.g.position.set(p.x, y0 + (Y0 - y0) * e + Math.sin(e * Math.PI) * .55, p.z); c.g.scale.setScalar(1); },
      () => { if (!up) c.front.material = backMat; }, delay);
  }

  // ---------- seats and the found pairs in front of them ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); s.stool.traverse(o => o.geometry?.dispose()); }
  // a point round the table in the direction of seat r: d past the table's edge (or inside it when d < 0)
  function around(r, d) { const a = seatAngle(r), c = Math.cos(a), s = Math.sin(a), k = Math.min(Math.abs(c) > 1e-6 ? (A + d) / Math.abs(c) : Infinity, Math.abs(s) > 1e-6 ? (B + d) / Math.abs(s) : Infinity); return new THREE.Vector3(c * k, 0, s * k); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), out = around(r, 1.35), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const at = around(r, -.5);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), at.x, .03, at.z); ring.scale.set(.75, 1, .75);
      return { av, stool, ring, mine, hop: 0, nod: 0, look: 0, active: false, key: p.color + (p.av || []).join(''), won: 0 };
    });
  }
  function reseat(list) { // the avatars move when the table size changes
    seats.forEach((s, i) => {
      const r = rel(i), out = around(r, 1.35), at = around(r, -.5);
      s.av.position.set(out.x, -.15, out.z); s.av.lookAt(0, -.15, 0); s.stool.position.set(out.x, -.95, out.z); s.ring.position.set(at.x, .03, at.z);
    });
    void list;
  }
  // the k-th card of a seat's pile: face up, pointing at the middle, a little higher each card
  function pileSpot(owner, k) {
    const r = rel(owner), a = seatAngle(r), p = around(r, -.5);
    p.y = .03 + k * .011; return { p, ry: Math.PI / 2 - a + ((k % 2) - .5) * .18 };
  }
  function toPile(c, k, delay = 0, instant = false) {
    const { p, ry } = pileSpot(c.owner, k);
    if (instant) { pose(c, p, 0, ry, PILE); return; }
    const from = c.g.position.clone(), r0 = c.g.rotation.y;
    tweenCard(c, .6, t => { const e = ease(t); c.g.position.lerpVectors(from, p, e); c.g.position.y += Math.sin(e * Math.PI) * 1.2; c.g.rotation.set(0, r0 + (ry - r0) * e, 0); c.g.scale.setScalar(1 + (PILE - 1) * e); },
      () => { const s = seats[c.owner]; if (s) s.hop = Math.max(s.hop, .5); }, delay);
  }

  // ---------- state from the server ----------
  let S = null;
  function layoutFor(st) {
    w = st.w; h = st.h; flip = canvas.clientWidth < canvas.clientHeight && w > h;
    const dc = flip ? h : w, dr = flip ? w : h;
    return [(dc - 1) * PX / 2 + CW / 2 + 1.05, (dr - 1) * PZ / 2 + CH / 2 + 1.05];
  }
  function setState(st) {
    const list = st.seats, fresh = st.gid !== gid;
    if (fresh) { gid = st.gid; clearCards(); buildTable(...layoutFor(st)); }
    const key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey || fresh) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) buildSeats(list);
      else {
        list.forEach((p, i) => {
          const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
          const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
          s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.key = k; s.hop = 1;
        });
        reseat(list);
      }
    }
    if (fresh) {
      cards = st.face.map((_, i) => makeCard(i));
      const dealing = st.stage === 'deal' && st.dealLeft > 600 && !reduced;
      const step = dealing ? Math.min(.05, (st.dealLeft / 1000 - .7) / cards.length) : 0;
      seats.forEach(s => { s.won = 0; });
      cards.forEach((c, k) => {
        const f = st.face[k], o = st.got[k];
        if (o >= 0 && f) { c.state = 'won'; c.owner = o; c.front.material = faceMat(f[0], f[1]); toPile(c, seats[o].won++, 0, true); return; }
        if (f && st.up.includes(k)) { c.state = 'up'; c.front.material = faceMat(f[0], f[1]); c.g.rotation.z = 0; }
        if (dealing) { // dealt from the middle of the table, row by row
          const to = slot(k), from = new THREE.Vector3(0, 2.2, 0); c.g.visible = false;
          tweenCard(c, .42, t => { c.g.visible = true; const e = ease(t); c.g.position.lerpVectors(from, to, e); c.g.position.y += Math.sin(e * Math.PI) * .6; c.g.rotation.y = (1 - e) * 1.4; }, null, k * step);
        }
      });
    } else {
      cards.forEach((c, k) => {
        const f = st.face[k], o = st.got[k], peek = st.peek?.i === k;
        const want = o >= 0 ? 'won' : st.up.includes(k) || peek ? 'up' : 'down';
        if (want === c.state) return;
        if (want === 'up') { const ff = f || [st.peek.sp, st.peek.tw]; c.front.material = faceMat(ff[0], ff[1]); turn(c, true); if (peek) c.peekT = 1; }
        else if (want === 'down') turn(c, false);
        else if (want === 'won') {
          c.owner = o; if (f) c.front.material = faceMat(f[0], f[1]);
          const k2 = seats[o] ? seats[o].won++ : 0, lift = c.state === 'down' ? .36 : 0;
          if (c.state === 'down') turn(c, true);
          toPile(c, k2, .55 + lift);
        }
        c.state = want; if (want !== 'up') c.peekT = 0;
      });
    }
    peekAt = st.peek ? -1 : st.peekAt;
    seats.forEach((s, i) => { s.active = st.turn === i && (st.stage === 'pick' || st.stage === 'spy'); });
    if (st.ph === 'end' && S?.ph !== 'end') st.res?.place.forEach((p, i) => {
      if (p !== 1 || !seats[i]) return; const s = seats[i]; s.hop = 1; const top = s.av.position.clone().setY(2.1);
      pfx.confetti(top, { n: 70, w: 2.6, h: 2, s: i }); pfx.burst(top, { n: 14, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 });
    });
    S = st;
  }
  let peekAt = -1, hover = -1;

  // ---------- effects ----------
  const cardTop = i => { const c = cards[i]; return c ? c.g.position.clone().setY(.6) : new THREE.Vector3(); };
  function pairFx(i, j, tw) {
    const mid = cardTop(i).add(cardTop(j)).multiplyScalar(.5);
    if (tw === 'gold') { pfx.burst(mid, { n: 26, colors: ['#ffd84a', '#ffffff', '#ffb547'], speed: 3.4, up: 4, size: .3 }); shake.kick(.06); }
    else if (tw === 'spy') pfx.burst(mid, { n: 16, colors: ['#9fd8ff', '#ffffff'], speed: 2.6, up: 3, size: .24 });
    else if (tw === 'mix') { pfx.puff(mid, { n: 14, color: ['#ffb0c8', '#ffffff'], size: .34, speed: 2.4 }); shake.kick(.08); }
    else pfx.burst(mid, { n: 10, colors: ['#7ed3b2', '#ffffff'], speed: 2.2, up: 2.6, size: .2 });
  }
  function missFx(i, j) { for (const k of [i, j]) { const c = cards[k]; if (c) c.nod = 1; } }
  // the Whirlwind: each pair of cards trades places along an arc, then everything is back on its own spot
  function mix(sw) {
    for (const [a, b] of sw) for (const [x, y, side] of [[a, b, 1], [b, a, -1]]) {
      const c = cards[x]; if (!c) continue;
      const from = slot(x), to = slot(y), mid = from.clone().add(to).multiplyScalar(.5), off = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize().multiplyScalar(.9 * side);
      tweenCard(c, 1.25, t => {
        const e = ease(t), q = 1 - e;
        c.g.position.set(from.x * q * q + 2 * q * e * (mid.x + off.x) + to.x * e * e, Y0 + Math.sin(e * Math.PI) * .9, from.z * q * q + 2 * q * e * (mid.z + off.z) + to.z * e * e);
        c.g.rotation.y = Math.sin(e * Math.PI) * 2.4 * side;
      }, () => { c.g.position.copy(slot(x)); c.g.rotation.y = 0; });
    }
    if (!reduced) shake.kick(.05);
    pfx.puff(new THREE.Vector3(0, .8, 0), { n: 18, color: ['#ffb0c8', '#ffffff', '#ffd9ea'], size: .4, speed: 3 });
  }
  function cue(i, kind) {
    const s = seats[i]; if (!s) return;
    const at = s.av.position.clone().setY(2);
    if (kind === 'streak') { s.hop = 1; pfx.burst(at, { n: 12, colors: ['#ffd84a', '#ffffff'], speed: 2.4, up: 3, size: .22 }); }
    else if (kind === 'late') { s.nod = 1.2; pfx.puff(at, { n: 8, color: ['#ffffff', '#d9e4ff'], size: .3, speed: 1.4 }); }
    else if (kind === 'miss') s.nod = Math.max(s.nod, .8);
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Y0), hit = new THREE.Vector3();
  function pick(clientX, clientY) {
    if (!w || !cards.length) return -1;
    const r = canvas.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const dc = flip ? h : w, dr = flip ? w : h;
    const x = Math.round(hit.x / PX + (dc - 1) / 2), z = Math.round(hit.z / PZ + (dr - 1) / 2);
    if (x < 0 || z < 0 || x >= dc || z >= dr) return -1;
    const p = new THREE.Vector3((x - (dc - 1) / 2) * PX, 0, (z - (dr - 1) / 2) * PZ);
    if (Math.abs(hit.x - p.x) > CW / 2 + .06 || Math.abs(hit.z - p.z) > CH / 2 + .06) return -1; // the gap between cards picks nothing
    return flip ? x * w + z : z * w + x;
  }
  function setHover(i) { hover = i; }

  // ---------- sizing ----------
  let Wd = 0, Ht = 0, hudBottom = 120, hudTop = 110;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, -.1);
  const DIR = new THREE.Vector3(0, 1.75, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * Wd, (1 - v.y) / 2 * Ht]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch) return;
    if (cw === Wd && ch === Ht && !force) return; Wd = cw; Ht = ch;
    renderer.setSize(cw, ch, false);
    const portrait = cw / ch < 1;
    camera.aspect = cw / ch; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = hudTop, bottom = Math.max(top + 120, ch - hudBottom);
    // the whole grid and the rim must show; the avatars across the table and at the sides should, where there is room
    const dc = flip ? h : w, dr = flip ? w : h, gx = dc * PX / 2 + .2, gz = dr * PZ / 2 + .2;
    const FIT = portrait
      ? [new THREE.Vector3(0, 0, -B - .2), new THREE.Vector3(0, 0, B + .2), new THREE.Vector3(-gx - .3, 0, gz), new THREE.Vector3(gx + .3, 0, gz), new THREE.Vector3(-gx - .3, 0, -gz), new THREE.Vector3(gx + .3, 0, -gz)]
      : [new THREE.Vector3(0, 2.6, -B - 1.35), new THREE.Vector3(0, 0, B + .2), new THREE.Vector3(-A - 1.1, 1.2, 0), new THREE.Vector3(A + 1.1, 1.2, 0)];
    let lo = 3, hi = 120;
    for (let k = 0; k < 34; k++) {
      const D = (lo + hi) / 2; place(D);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of FIT) { const [x, y] = toPx(p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (x1 - x0 <= cw - 16 && y1 - y0 <= bottom - top) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    let y0 = Infinity, y1 = -Infinity; for (const p of FIT) { const [, y] = toPx(p); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    camera.setViewOffset(cw, ch, 0, (y0 + y1) / 2 - (top + bottom) / 2, cw, ch); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastNow = 0;
  const tv = new THREE.Vector3();
  const info = { tags: [] };
  function loop(dt, now) {
    if (dead) return;
    resize();
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    for (let i = 0; i < tweens.length; i++) {
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    // a hovered card rises a little; a card someone else is peeking at hovers and wobbles; a missed pair shakes its head
    const busy = new Set(tweens.map(t => t.card).filter(Boolean));
    for (const c of cards) {
      if (c.state === 'won' || busy.has(c)) continue;
      const want = c.i === peekAt ? .45 : c.i === hover && c.state === 'down' ? .12 : 0;
      c.lift += (want - c.lift) * Math.min(1, dt * 12);
      c.g.position.y = Y0 + c.lift;
      c.g.rotation.x = c.i === peekAt && !reduced ? Math.sin(T * 9) * .08 : 0;
      if (c.nod > 0) { c.nod = Math.max(0, c.nod - dt * 2.2); c.g.rotation.y = Math.sin(c.nod * Math.PI * 4) * .08 * c.nod; }
      else if (c.g.rotation.y && c.state !== 'won') c.g.rotation.y *= .8;
    }
    const hc = cards[hover];
    glow.visible = !!hc && hc.state === 'down'; if (glow.visible) { glow.position.set(hc.g.position.x, Y0 - .012 + hc.lift * .2, hc.g.position.z); }
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
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .1), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, Ht);
    renderer.render(scene, camera);

    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.copy(around(r, 1.35)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * Wd; t.y = (1 - tv.y) / 2 * Ht; t.mine = s.mine;
      tv.copy(around(r, -.5)); tv.y = .4; tv.project(camera); t.cx = (tv.x + 1) / 2 * Wd; t.cy = (1 - tv.y) / 2 * Ht;
    });
    info.tags.length = seats.length;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, cue, pick, setHover, pairFx, missFx, mix,
    cardPx(i) { const c = cards[i]; if (!c) return null; tv.copy(c.g.position); tv.y = .3; tv.project(camera); return { x: (tv.x + 1) / 2 * Wd, y: (1 - tv.y) / 2 * Ht }; },
    setHud(bottomPx, topPx = hudTop) { if ((Math.abs(bottomPx - hudBottom) > 6 || Math.abs(topPx - hudTop) > 6) && hudFitOk(canvas)) { hudBottom = bottomPx; hudTop = topPx; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) freeSeat(s);
      for (const m of mats.values()) m.dispose(); for (const t of texs) t.dispose(); backMat.dispose();
      pfx.dispose(); cardGeo.dispose(); backGeo.dispose(); glowGeo.dispose(); ringGeo.dispose(); glow.material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

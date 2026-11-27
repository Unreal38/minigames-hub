// Pet Parade 3D table (three.js): a round table on a sky island, everyone's avatar on a stool with their cards face
// down in front of them, the deck on the left of the middle and the played cards on the right. A ring of arrows
// round the middle shows the direction of play in the colour that is in play.
// Purely visual: it draws what the server sends, and other players' cards are only ever backs here.
import * as THREE from 'three';
import { cardGeometry } from '../../cardgeo.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk, easeRefit } from '../../camfit.js';
import { cardTexture } from '../poker/scene3d.js';
import { paintFace } from './cards.js';
import { HEX, STONE } from './rules.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 3.4;               // table radius
const CW = .62, CH = .88;    // card size
const PILE = 1.5;            // the played cards are drawn bigger, so the top one can be read
const STOCK = new THREE.Vector3(-1.05, 0, -.05), DISC = new THREE.Vector3(.95, 0, 0);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const hash = c => { const x = Math.sin(c * 91.7 + 3.1) * 43758.5; return x - Math.floor(x); };

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
  const cloudRing = clouds({ min: 22, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(15, 15, { round: true, rim: 4.4, seed: 41, props: 16, size: 1.7, flowers: 60 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  { // a parade-day table: bunting posts round a striped rug, a cream cloth with a four-colour edge
    const deck = put(new THREE.CylinderGeometry(7.6, 7.6, .16, 28), M('#e9d3a7'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, g = new THREE.RingGeometry(1.6 + i * .7, 1.9 + i * .7, 28, 1, 0, Math.PI * 2); g.rotateX(-Math.PI / 2); put(g, M(i % 2 ? '#f7d2c3' : '#cfe8c3'), 0, -2.335, 0); void a; }
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    put(new THREE.CylinderGeometry(R, R, .04, 28), M('#fff1d6'), 0, 0, 0).receiveShadow = true;
    for (let i = 0; i < 4; i++) { const g = new THREE.TorusGeometry(R + .02, .08, 6, 10, Math.PI / 2); g.rotateX(Math.PI / 2); g.rotateY(-i * Math.PI / 2); put(g, M(HEX[i]), 0, 0, 0); }
    put(new THREE.CylinderGeometry(.5, 1.3, 2.1, 12), M('#a86a42'), 0, -1.35, 0).castShadow = true;
    // bunting: four posts with flags strung between them in the element colours
    const posts = [[-5.6, -4.2], [5.6, -4.2], [6.4, 2.6], [-6.4, 2.6]];
    for (const [x, z] of posts) { put(new THREE.CylinderGeometry(.09, .12, 4.4, 6), M('#a86a42'), x, -.2, z).castShadow = true; put(new THREE.SphereGeometry(.2, 8, 6), M('#ffc94d'), x, 2.05, z); }
    const flag = new THREE.ConeGeometry(.2, .42, 3); flag.rotateX(Math.PI);
    [[0, 1], [0, 3], [1, 2]].forEach(([a, b]) => {
      const [x1, z1] = posts[a], [x2, z2] = posts[b];
      for (let k = 1; k < 12; k++) { const t = k / 12, m = put(flag, M(HEX[k % 4]), x1 + (x2 - x1) * t, 1.9 - Math.sin(t * Math.PI) * .7, z1 + (z2 - z1) * t); m.rotation.y = Math.atan2(x2 - x1, z2 - z1); }
    });
    bake(room); toonify(room, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- cards ----------
  const cardGeo = cardGeometry(CW, CH); cardGeo.rotateX(-Math.PI / 2);
  const backGeo = cardGeo.clone(); backGeo.rotateZ(Math.PI); backGeo.translate(0, -.004, 0);
  const mats = new Map(), texs = [];
  function faceTex(c) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 364;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texs.push(tex);
    const g = cv.getContext('2d'), paint = () => { paintFace(g, 256, 364, c, paint); tex.needsUpdate = true; };
    paint(); document.fonts?.ready.then(paint);
    return tex;
  }
  // key: a card number for a face, 'b' + k for the card back k from the shop
  // card faces are unlit, so cards on the table look exactly like the ones in your hand, day or night; the backs take the table's light
  const mat = key => { if (!mats.has(key)) mats.set(key, typeof key === 'string' ? toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(-1 - +key.slice(1)), roughness: .55 })) : new THREE.MeshBasicMaterial({ map: faceTex(key) })); return mats.get(key); };
  function makeCard(c, k = 1, b = 0) { // c = -1: a card you cannot see, back on both sides; b = whose card back
    const g = new THREE.Group(); g.scale.setScalar(k);
    const front = new THREE.Mesh(cardGeo, mat(c >= 0 ? c : 'b' + (b | 0))), back = new THREE.Mesh(backGeo, mat('b' + (b | 0)));
    front.castShadow = true; g.add(front, back); g.userData.c = c;
    return g;
  }
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);

  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });

  // ---------- the direction ring ----------
  const dirG = new THREE.Group(); scene.add(dirG);
  const dirMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: .6, emissive: STONE, emissiveIntensity: .25 });
  const trackGeo = new THREE.TorusGeometry(2.05, .035, 5, 48); trackGeo.rotateX(Math.PI / 2);
  const track = new THREE.Mesh(trackGeo, dirMat); track.position.y = .03; scene.add(track);
  const arrowGeo = new THREE.ConeGeometry(.16, .42, 3); arrowGeo.rotateZ(-Math.PI / 2); // points along +x
  for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(arrowGeo, dirMat); const t = i / 4 * Math.PI * 2; a.position.set(Math.cos(t) * 2.05, .1, Math.sin(t) * 2.05); a.rotation.y = -t - Math.PI / 2; a.castShadow = true; dirG.add(a); }
  let dir = 1, dirShown = 1, spin = 0;
  const colNow = new THREE.Color(STONE), colTo = new THREE.Color(STONE);

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const onRim = (r, k = 1) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, 0, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.g, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), a = seatAngle(r), out = onRim(r, 1.4), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const g = new THREE.Group(), at = onRim(r, mine ? 1.02 : .72); g.position.copy(at); g.rotation.y = Math.PI / 2 - a; g.visible = !mine; scene.add(g); g.updateMatrixWorld();
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), at.x, .05, at.z, scene); ring.scale.set(1.5, 1, .75); ring.rotation.y = g.rotation.y; ring.visible = !mine;
      return { av, stool, g, ring, mine, cb: p.fl?.cb | 0, cards: [], n: 0, hop: 0, nod: 0, look: 0, active: false, key: '' };
    });
  }
  // a fan is never wider than the room its seat has: at a full table the neighbours' fans would run into each other
  const fanRoom = () => (n < 3 ? 2.3 : Math.min(2.3, 2 * ((R * .72 - .36) * Math.tan(Math.PI / n) - .32)));
  const slot = (k, cnt) => { const step = Math.min(.34, fanRoom() / Math.max(1, cnt)); return new THREE.Vector3((k - (cnt - 1) / 2) * step, .02 + k * .004, 0); };
  function setHand(s, cnt, deal = -1, flyIn = 0) {
    while (s.cards.length > cnt) s.g.remove(s.cards.pop());
    const had = s.cards.length;
    while (s.cards.length < cnt) { const c = makeCard(-1, 1, s.cb); c.scale.setScalar(.82); c.rotation.z = Math.PI; s.g.add(c); s.cards.push(c); }
    s.cards.forEach((c, k) => {
      const to = slot(k, cnt);
      if (deal >= 0) { // dealt off the deck, one card at a time round the table
        const from = s.g.worldToLocal(STOCK.clone().setY(.4)); c.visible = false;
        tween(.4, t => { c.visible = true; const e = ease(t); c.position.lerpVectors(from, to, e); c.position.y += Math.sin(e * Math.PI) * .7; }, null, deal + k * dealStep * n);
      } else if (flyIn && k >= had) { // drawn off the deck
        const from = s.g.worldToLocal(STOCK.clone().setY(.3 + stockH)); c.visible = false;
        tween(.45, t => { c.visible = true; const e = ease(t); c.position.lerpVectors(from, to, e); c.position.y += Math.sin(e * Math.PI) * .8; }, null, (k - had) * .12);
      } else { const from = c.position.clone(); tween(.25, t => c.position.lerpVectors(from, to, ease(t))); }
    });
    s.n = cnt;
  }
  let dealStep = .07;

  // ---------- the deck and the played cards ----------
  const stock = new THREE.Group(); stock.position.copy(STOCK); scene.add(stock);
  let stockH = 0;
  function setStock(k) { // one card mesh for every few cards, so the deck has some height; the bottom card (and its back, .004 under it) sits clear above the cloth top (.02), so a last card never z-fights with it
    const want = Math.min(16, Math.ceil(k / 5));
    while (stock.children.length > want) stock.remove(stock.children[stock.children.length - 1]);
    while (stock.children.length < want) { const c = makeCard(-1, PILE * .82, 0), j = stock.children.length; c.position.set((hash(j) - .5) * .04, .045 + j * .02, (hash(j + 9) - .5) * .04); c.rotation.y = (hash(j + 3) - .5) * .12; stock.add(c); }
    stockH = .025 + want * .02;
  }
  const pile = []; // played card meshes, bottom first (only the last few are kept)
  // each played card lies a clear step above the one under it (the cards are drawn bigger, so their backs sit lower too): no flicker
  const pileY = k => .04 + k * .016;
  const spot = (c, k) => { const j = hash(c * 7 + k); return { p: new THREE.Vector3(DISC.x + (j - .5) * .3, pileY(k), DISC.z + (hash(c + 5 * k) - .5) * .26), ry: (j - .5) * .9 }; };
  function setPile(cards, animateFrom = null, cb = 0) {
    // a card just played is added on top with a throw; anything else (a new game, a reshuffle) is laid out as it is
    const prev = pile.map(m => m.userData.c), base = cards.slice(0, -1);
    const match = animateFrom && base.length <= prev.length && base.every((c, k) => c === prev[prev.length - base.length + k]);
    if (!match) {
      for (const m of pile) scene.remove(m); pile.length = 0;
      cards.forEach((c, k) => { const m = makeCard(c, PILE), { p, ry } = spot(c, k); m.position.copy(p); m.rotation.y = ry; scene.add(m); pile.push(m); });
      return;
    }
    while (pile.length > base.length) scene.remove(pile.shift());
    pile.forEach((q, i) => { q.position.y = pileY(i); }); // the cards left move down a step, so the new one never shares a height
    const c = cards[cards.length - 1], k = cards.length - 1, m = makeCard(c, PILE, cb), { p, ry } = spot(c, k), from = animateFrom.clone(), r0 = ry + Math.PI * .6;
    m.position.copy(from); m.rotation.set(0, r0, Math.PI); scene.add(m); pile.push(m);
    tween(.5, t => { const e = ease(t); p.y = pileY(Math.max(0, pile.indexOf(m))); m.position.lerpVectors(from, p, e); m.position.y += Math.sin(e * Math.PI) * 1.1; m.rotation.y = r0 + (ry - r0) * e; m.rotation.z = Math.PI * (1 - e); },
      () => { pfx.ring(p.clone().setY(.05), { color: '#' + colTo.getHexString(), size: 1.4 }); });
  }
  const seatSpot = i => { const s = seats[i]; return s ? s.g.localToWorld(new THREE.Vector3(0, .1, 0)) : new THREE.Vector3(); };

  // ---------- state from the server ----------
  let S = null, gid = '', mv = -1, pileN = -1;
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) { buildSeats(list); gid = ''; }
      else list.forEach((p, i) => {
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1;
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
    }
    const fresh = st.gid !== gid;
    colTo.set(st.col >= 0 ? HEX[st.col] : STONE);
    if (st.dir !== dir) { dir = st.dir; if (!fresh) { spin = 1; shake.kick(.06); } }
    if (fresh) {
      gid = st.gid; mv = st.mv; pileN = st.pileN; tweens.length = 0; dirShown = dir; colNow.copy(colTo);
      setPile(st.pile); setStock(st.stockN);
      const dealing = st.stage === 'deal' && st.dealLeft > 500 && !reduced;
      dealStep = dealing ? Math.max(.02, (st.dealLeft / 1000 - .8) / (7 * list.length)) : .07;
      list.forEach((p, i) => { setHand(seats[i], 0); setHand(seats[i], p.n, dealing ? rel(i) * dealStep : -1); });
    } else {
      const L = st.last, played = st.pileN === pileN + 1 && L?.t === 'play';
      if (st.mv !== mv || st.pileN !== pileN) setPile(st.pile, played ? seatSpot(L.s) : null, list[L?.s]?.fl?.cb);
      if (played && seats[L.s]) seats[L.s].hop = .6;
      mv = st.mv; pileN = st.pileN;
      setStock(st.stockN);
      list.forEach((p, i) => { const s = seats[i]; if (s.n !== p.n) { if (p.n > s.n) s.nod = Math.max(s.nod, .8); setHand(s, p.n, -1, p.n > s.n); } });
    }
    list.forEach((p, i) => {
      const s = seats[i];
      if (s.cb !== (p.fl?.cb | 0)) { s.cb = p.fl?.cb | 0; const k2 = s.cards.length; setHand(s, 0); setHand(s, k2); }
      s.active = st.turn === i && (st.stage === 'play' || st.stage === 'drawn');
    });
    if (st.ph === 'end' && S?.ph !== 'end' && seats[st.win]) { const s = seats[st.win]; s.hop = 1; const top = s.av.position.clone().setY(2.1); pfx.confetti(top, { n: 70, w: 2.6, h: 2, s: st.win }); pfx.burst(top, { n: 14, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 }); }
    S = st;
  }
  // a little effect over a seat (a caught player, a skipped one)
  function cue(i, kind) {
    const s = seats[i]; if (!s) return;
    const at = s.av.position.clone().setY(2);
    if (kind === 'catch') { s.nod = 2; shake.kick(.1); pfx.burst(at, { n: 12, colors: ['#e5543b', '#ffd84a'], speed: 3, up: 3, size: .24 }); }
    else if (kind === 'skip') { s.nod = 1.2; pfx.puff(at, { n: 8, color: ['#ffffff', '#d9e4ff'], size: .3, speed: 1.4 }); }
    else if (kind === 'call') { s.hop = 1; pfx.burst(at, { n: 10, colors: ['#ffd84a', '#ffffff'], speed: 2.4, up: 3, size: .22 }); }
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, hudLeft = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, -.2);
  const DIR = new THREE.Vector3(0, 1.08, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 150 : 110, bottom = Math.max(top + 120, h - hudBottom), side = portrait ? R * 1.12 : R * 1.4 + 1.1;
    const FIT = [new THREE.Vector3(0, 3.3, -R * 1.4), new THREE.Vector3(0, .3, R * 1.04), new THREE.Vector3(-side, 1.2, 0), new THREE.Vector3(side, 1.2, 0)];
    let lo = 5, hi = 90;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; place(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && lx + hudLeft / 2 >= hudLeft + 4 && rx + hudLeft / 2 <= w - 4) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, -hudLeft / 2, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, dead = false, lastNow = 0;
  const tv = new THREE.Vector3();
  const info = { tags: [], pile: { x: 0, y: 0 }, stock: { x: 0, y: 0 } };
  function loop(dt, now) {
    if (dead) return;
    resize();
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    for (let i = 0; i < tweens.length; i++) {
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    // the arrows run round the middle in the direction of play; a Turnabout swings them round
    dirShown += (dir - dirShown) * Math.min(1, dt * 4); spin = Math.max(0, spin - dt * 1.5);
    if (!reduced) dirG.rotation.y -= dt * .5 * dirShown;
    dirG.children.forEach(a => { a.scale.set(1, 1, 1); a.scale.x = dirShown >= 0 ? 1 : -1; a.position.y = .1 + Math.sin(spin * Math.PI) * .25; });
    colNow.lerp(colTo, Math.min(1, dt * 5)); dirMat.color.copy(colNow); dirMat.emissive.copy(colNow);
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
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .16), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.copy(onRim(r, 1.4)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
      tv.copy(s.g.position); tv.y = .5; tv.project(camera); t.cx = (tv.x + 1) / 2 * W; t.cy = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    tv.set(DISC.x, .05, .95).project(camera); info.pile.x = (tv.x + 1) / 2 * W; info.pile.y = (1 - tv.y) / 2 * H;
    tv.set(STOCK.x, .05, .95).project(camera); info.stock.x = (tv.x + 1) / 2 * W; info.stock.y = (1 - tv.y) / 2 * H;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, cue,
    setHud(px) { const fit = hudFitOk(canvas), grew = px > hudBottom + 6; if ((Math.abs(px - hudBottom) > 6) && (fit || grew)) { hudBottom = px; fit ? resize(true) : easeRefit(camera, camBase, camLook, () => resize(true)); } }, // a HUD growing mid-game eases the camera out (camfit.js)
    setInset(px) { if ((px !== hudLeft) && hudFitOk(canvas)) { hudLeft = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const m of mats.values()) m.dispose(); for (const t of texs) t.dispose();
      pfx.dispose(); cardGeo.dispose(); backGeo.dispose(); ringGeo.dispose(); trackGeo.dispose(); arrowGeo.dispose(); dirMat.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

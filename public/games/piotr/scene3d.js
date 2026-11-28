// Piotruś 3D table (three.js): a round table on a sky island, everyone's avatar on a stool holding a fan of cards
// with the backs towards the middle, and the pairs laid down so far scattered face up on the cloth.
// Purely visual: it draws what the server sends, and other players' cards are only ever backs here.
import * as THREE from 'three';
import { cardGeometry } from '../../cardgeo.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene, roundDeck } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk, easeRefit } from '../../camfit.js';
import { cardTexture } from '../poker/scene3d.js';
import { paintFace } from './cards.js';
import { PIOTR } from './rules.js';
import { playArea, disc } from '../../nametag.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 3.4;               // table radius
const CW = .62, CH = .88;    // card size
const HAND = .9, LEAN = Math.PI / 2 + .78; // cards in a hand: their size, and how far they stand up (tops lean back to their owner)
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
  nightScene(scene); // the website's night mode carries into the game
  const land = island(15, 15, { round: true, rim: 4.4, seed: 41, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  { // a striped play mat under a table with a green cloth, and pet toys lying about
    room.add(roundDeck(7.6, { wood: '#f3e2bd', rim: '#c9a26b', stripes: { w: .34, colors: ['#c9ecd9', '#9fd8c0'] } }));
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    const cloth = put(new THREE.CylinderGeometry(R, R, .04, 28), M('#3f9a7a'), 0, .0, 0); cloth.receiveShadow = true;
    const ring = new THREE.TorusGeometry(1.75, .03, 5, 28); ring.rotateX(Math.PI / 2); put(ring, M('#7fd1b0'), 0, .02, 0);
    const edge = new THREE.TorusGeometry(R + .02, .07, 6, 28); edge.rotateX(Math.PI / 2); put(edge, M('#ffc94d'), 0, .0, 0);
    put(new THREE.CylinderGeometry(.5, 1.3, 2.1, 12), M('#a86a42'), 0, -1.35, 0).castShadow = true;
    // a pet bed, a ball, a food bowl and a stack of toy blocks
    put(new THREE.CylinderGeometry(1.0, 1.1, .34, 12), M('#ff8fab'), -5.6, -2.17, -2.8).castShadow = true; put(new THREE.CylinderGeometry(.72, .72, .1, 12), M('#fff8ec'), -5.6, -2.02, -2.8);
    put(new THREE.IcosahedronGeometry(.42, 0), M('#ffc94d'), 5.5, -1.92, 3.6).castShadow = true;
    put(new THREE.CylinderGeometry(.5, .36, .28, 10), M('#4f6fc4'), 5.6, -2.2, -2.7).castShadow = true; put(new THREE.CylinderGeometry(.4, .4, .06, 10), M('#c98a5a'), 5.6, -2.06, -2.7);
    put(new THREE.BoxGeometry(.5, .5, .5), M('#e5543b'), -5.0, -2.09, 4.0).rotation.y = .4; put(new THREE.BoxGeometry(.5, .5, .5), M('#7ed3b2'), -5.5, -2.09, 3.6).rotation.y = -.3; put(new THREE.BoxGeometry(.5, .5, .5), M('#ffc94d'), -5.2, -1.59, 3.85).rotation.y = .8;
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
  function makeCard(c, cb = 0, k = 1) { // c = -1: a card you cannot see, back on both sides
    const g = new THREE.Group(), inner = new THREE.Group(); g.scale.setScalar(k); g.add(inner);
    const front = new THREE.Mesh(cardGeo, mat(c < 0 ? 'b' + cb : c)), back = new THREE.Mesh(backGeo, mat('b' + cb));
    front.castShadow = true; inner.add(front, back); g.userData = { c, inner, lift: 0, sx: 0, sz: 0 };
    return g;
  }
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);
  // the pointer that bobs over the card the drawer is reaching for
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(.16, .34, 4), new THREE.MeshBasicMaterial({ color: '#ffd84a' })); pointer.rotation.x = Math.PI; pointer.visible = false; scene.add(pointer);

  // tweens run on wall-clock time, so a slow device skips frames instead of falling behind the game
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const onRim = (r, k = 1) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, 0, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  const keyOf = p => p.color + (p.av || []).join('') + '/' + (p.fl?.cb | 0);
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
      // this player's cards; local +z points out towards the player
      const g = new THREE.Group(), at = onRim(r, mine ? 1.02 : .74); g.position.copy(at); g.rotation.y = Math.PI / 2 - a; g.visible = !mine; scene.add(g); g.updateMatrixWorld();
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), at.x, .05, at.z, scene); ring.scale.set(1.5, 1, .6); ring.rotation.y = g.rotation.y; ring.visible = !mine;
      return { av, stool, g, ring, mine, cb: p.fl?.cb | 0, cards: [], hop: 0, nod: 0, look: 0, active: false, out: false, key: '' };
    });
  }
  // a standing fan that closes up as it gets longer
  // a fan is never wider than the room its seat has: at a full table the neighbours' fans would run into each other
  const fanRoom = () => (n < 3 ? 2.7 : Math.min(2.7, 2 * ((R * .74 - .3) * Math.tan(Math.PI / n) - .34)));
  const slot = (k, cnt) => { const step = Math.min(.4, fanRoom() / Math.max(1, cnt)), u = k - (cnt - 1) / 2; return new THREE.Vector3(u * step, CH * HAND * .3 - Math.abs(u) * Math.abs(u) * step * .02, k * .006 + Math.abs(u) * step * .1); };
  function layHand(s, deal = -1) {
    const cnt = s.cards.length;
    s.cards.forEach((c, k) => {
      const to = slot(k, cnt);
      if (deal >= 0) { // dealt out of the middle, one card at a time round the table
        const from = s.g.worldToLocal(new THREE.Vector3(0, .5, 0)); c.visible = false;
        tween(.4, t => { c.visible = true; const e = ease(t); c.position.lerpVectors(from, to, e); c.position.y += Math.sin(e * Math.PI) * .7; c.rotation.x = LEAN * e; }, null, deal + k * dealStep * n);
      } else { const from = c.position.clone(); if (from.distanceToSquared(to) > 1e-6) tween(.25, t => c.position.lerpVectors(from, to, ease(t))); }
    });
  }
  function setHand(s, cnt, deal = -1) {
    while (s.cards.length > cnt) s.g.remove(s.cards.pop());
    while (s.cards.length < cnt) { const c = makeCard(-1, s.cb, HAND); c.rotation.x = LEAN; c.position.copy(slot(s.cards.length, cnt)); s.g.add(c); s.cards.push(c); }
    layHand(s, deal);
  }
  let dealStep = .07;
  const seatSpot = (i, y = .5) => { const s = seats[i]; return s ? s.g.localToWorld(new THREE.Vector3(0, y, 0)) : new THREE.Vector3(); };

  // ---------- the pairs on the table ----------
  const heap = []; // one entry per pair laid down: its two card meshes
  function heapSpot(j, side) {
    const a = j * 2.4 + .6, r = .3 + .3 * Math.sqrt(j), ry = hash(j * 7 + 1) * 6.28;
    return { p: new THREE.Vector3(Math.cos(a) * r + Math.cos(ry) * side * .22, .03 + j * .012 + (side > 0 ? .006 : 0), Math.sin(a) * r * .8 - Math.sin(ry) * side * .22 - .15), ry: ry + side * .22 };
  }
  // fromSeat < 0: the pair is simply there (a game already under way)
  function addPair(pet, fromSeat, delay = 0) {
    const j = heap.length, two = [0, 1].map(k => makeCard(pet * 2 + k, 0, 1.3));
    heap.push(two);
    two.forEach((m, k) => {
      const { p, ry } = heapSpot(j, k ? 1 : -1); scene.add(m);
      if (fromSeat < 0 || reduced) { m.position.copy(p); m.rotation.y = ry; return; }
      const from = seatSpot(fromSeat), r0 = seats[fromSeat].g.rotation.y; m.position.copy(from); m.visible = false;
      tween(.55, t => { m.visible = true; const e = ease(t); m.position.lerpVectors(from, p, e); m.position.y += Math.sin(e * Math.PI) * 1.2; m.rotation.y = r0 + (ry - r0) * e; m.rotation.z = Math.PI * 2 * (1 - e); },
        () => { if (k) { pfx.ring(p.clone().setY(.05), { color: S?.seats[fromSeat]?.color || '#ffd84a', size: 1.1 }); pfx.burst(p.clone().setY(.3), { n: 8, colors: ['#ffd84a', '#ffffff'], speed: 2, up: 2.4, size: .2 }); } }, delay + k * .1);
    });
  }
  function clearHeap() { for (const two of heap) for (const m of two) scene.remove(m); heap.length = 0; }

  // ---------- state from the server ----------
  let S = null, gid = '', mv = -1, flying = -1, reveal = null;
  const syncHands = () => S?.seats.forEach((p, i) => { if (i !== flying && seats[i] && seats[i].cards.length !== p.n) setHand(seats[i], p.n); });
  function setState(st) {
    const list = st.seats, key = list.map(keyOf).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) { buildSeats(list); gid = ''; }
      else list.forEach((p, i) => { // someone came back or left: swap that avatar
        const s = seats[i], k = keyOf(p); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1;
        if (s.cb !== (p.fl?.cb | 0)) { s.cb = p.fl?.cb | 0; const k2 = s.cards.length; setHand(s, 0); setHand(s, k2); }
      });
      list.forEach((p, i) => { seats[i].key = keyOf(p); });
    }
    const fresh = st.gid !== gid;
    if (fresh) {
      gid = st.gid; mv = st.mv; tweens.length = 0; flying = -1; clearHeap();
      if (reveal) { scene.remove(reveal); reveal = null; }
      const dealing = st.stage === 'deal' && st.stageLeft > 500 && !reduced;
      dealStep = dealing ? Math.max(.015, (st.stageLeft / 1000 - .7) / (st.deck === 'big' ? 33 : 25)) : .07;
      list.forEach((p, i) => { setHand(seats[i], 0); setHand(seats[i], p.n, dealing ? rel(i) * dealStep : -1); });
      st.heap.forEach(h => addPair(h.p, -1));
    } else {
      if (st.mv !== mv) {
        mv = st.mv;
        const tk = st.last, giver = seats[tk?.from], taker = seats[tk?.s];
        if (tk?.t === 'take' && giver && taker) {
          if (giver.cards.length !== tk.n) setHand(giver, tk.n); // whatever was missed, start from the hand as it was
          const m = giver.cards.splice(Math.min(tk.k, giver.cards.length - 1), 1)[0];
          if (m) {
            const a = m.getWorldPosition(new THREE.Vector3()), b = seatSpot(tk.s), r0 = giver.g.rotation.y, r1 = taker.g.rotation.y;
            giver.g.remove(m); scene.add(m); m.position.copy(a); m.rotation.set(LEAN, r0, 0, 'YXZ'); m.userData.inner.position.set(0, 0, 0);
            flying = tk.s;
            tween(reduced ? .01 : .55, t => { const e = ease(t); m.position.lerpVectors(a, b, e); m.position.y += Math.sin(e * Math.PI) * .9; m.rotation.y = r0 + (r1 - r0) * e; },
              () => { scene.remove(m); flying = -1; syncHands(); if (tk.pair < 0) pfx.puff(b.clone(), { n: 6, color: ['#fff4e2', '#d9c3a4'], size: .26, speed: 1.4 }); });
            layHand(giver);
          }
          taker.nod = tk.pair >= 0 ? 0 : .6; if (tk.pair >= 0) taker.hop = .6;
        }
      }
      // pairs laid down since the last look fly in from their owner (after the drawn card has landed)
      for (let j = heap.length; j < st.heap.length; j++) addPair(st.heap[j].p, st.heap[j].s, st.stage === 'pairs' ? .1 + rel(st.heap[j].s) * .22 + (j % 4) * .12 : .55);
      if (st.heap.length < heap.length) { clearHeap(); st.heap.forEach(h => addPair(h.p, -1)); }
      syncHands();
    }
    list.forEach((p, i) => {
      const s = seats[i];
      s.active = st.turn === i && st.stage === 'play';
      if (p.out && !s.out && !fresh) { s.hop = 1; const top = s.av.position.clone().setY(2.1); pfx.confetti(top, { n: 60, w: 2.6, h: 2, s: i }); pfx.burst(top, { n: 14, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 }); }
      s.out = !!p.out;
    });
    if (st.ph === 'end' && !reveal && seats[st.loser]) { // the Piotruś is turned over above the table for everyone to see
      const L0 = seats[st.loser], from = seatSpot(st.loser), to = new THREE.Vector3(0, 1.75, .5);
      reveal = makeCard(PIOTR); reveal.position.copy(from); scene.add(reveal);
      const late = S?.ph === 'end' || fresh || reduced; // already over when we got here: no show
      tween(late ? .01 : .9, t => { const e = ease(t); reveal.position.lerpVectors(from, to, e); reveal.rotation.x = e * 1.0; reveal.rotation.z = Math.PI * 2 * (1 - e); reveal.scale.setScalar(1 + e * 1.5); },
        () => { if (!late) { shake.kick(.14); pfx.burst(to.clone(), { n: 22, colors: ['#ffd84a', '#2b2d6e', '#ffffff'], speed: 3.4, up: 3, size: .3 }); } }, late ? 0 : .7);
      setHand(L0, 0); if (!late) L0.nod = 3;
    }
    S = st;
  }
  // a player mixing up their cards: the fan jumps about for a moment
  function shuffleSeat(i) {
    const s = seats[i]; if (!s || reduced) return;
    s.cards.forEach((c, k) => { const dx = (hash(k + performance.now() % 97) - .5) * .5; tween(.38, t => { const w = Math.sin(t * Math.PI); c.userData.sx = dx * w; c.userData.sz = -w * .22; }, null, k * .025); });
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
    const top = w < 760 ? 150 : 110, bottom = Math.max(top + 120, h - hudBottom), side = portrait ? R * 1.12 : R * 1.4 + 1.1; // on phones the side players may peek in from the edges
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
  const playTop = disc(R + .45, -.02, { h: .45 }); // the table top and the cards/dice on it: name tags keep off it
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
    const turnSeat = seats.findIndex(s => s.active), aimAt = S && S.stage === 'play' ? S.aim : -1;
    pointer.visible = false;
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * .7);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      let look = 0;
      const watch = turnSeat === i ? S.from : turnSeat; // the drawer eyes the giver, everyone else eyes the drawer
      if (watch >= 0 && watch !== i) { const d = ((rel(watch) - rel(i) + n) % n) / n; look = d < .5 ? .5 : -.5; }
      s.look += (look - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active || s.out, hop: s.hop, look: s.look, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      // the card being reached for stands up out of the fan
      s.cards.forEach((c, k) => {
        const want = S && i === S.from && k === aimAt ? 1 : 0; c.userData.lift += (want - c.userData.lift) * Math.min(1, dt * 14);
        c.userData.inner.position.set(c.userData.sx, 0, c.userData.sz - c.userData.lift * .34);
        if (want && s.g.visible) { c.getWorldPosition(tv); pointer.visible = true; pointer.position.set(tv.x, tv.y + .78 + Math.sin(T * 6) * .07, tv.z); pointer.rotation.y = T * 2; pointer.material.color.set(S.seats[S.turn]?.color || '#ffd84a'); }
      });
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    if (reveal) reveal.position.y += Math.sin(T * 2) * .0015;
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .16), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    // where the HUD draws the name tags
    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.copy(onRim(r, 1.4)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
      tv.copy(s.g.position); tv.y = .9; tv.project(camera); t.cx = (tv.x + 1) / 2 * W; t.cy = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    playArea(camera, W, H, playTop);
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, shuffle: shuffleSeat,
    setHud(px) { const fit = hudFitOk(canvas), grew = px > hudBottom + 6; if ((Math.abs(px - hudBottom) > 6) && (fit || grew)) { hudBottom = px; fit ? resize(true) : easeRefit(camera, camBase, camLook, () => resize(true)); } }, // a HUD growing mid-game eases the camera out (camfit.js)
    setInset(px) { if ((px !== hudLeft) && hudFitOk(canvas)) { hudLeft = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const m of mats.values()) m.dispose(); for (const t of texs) t.dispose();
      pointer.geometry.dispose(); pointer.material.dispose();
      pfx.dispose(); cardGeo.dispose(); backGeo.dispose(); ringGeo.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

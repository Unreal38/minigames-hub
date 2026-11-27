// Wojna 3D table (three.js): a round table on a sky island, everyone's avatar on a stool with their pile of cards
// face down in front of them. Cards flip into the middle, the winner's card shines, and the lot is swept onto
// the winner's pile. Purely visual: it draws what the server sends; face-down cards are only ever backs here.
import * as THREE from 'three';
import { cardGeometry, cardBlock } from '../../cardgeo.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk, easeRefit } from '../../camfit.js';
import { cardTexture } from '../poker/scene3d.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 2.7;               // table radius
const CW = .62, CH = .88;    // card size
const SMALL = .86;            // cards in the piles; the ones in the middle are drawn much bigger, so they can be read
const THICK = .009;          // how much one card adds to a pile
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
  { // a checked picnic blanket under a table with a green cloth
    const deck = put(new THREE.CylinderGeometry(7.6, 7.6, .16, 28), M('#e9d3a7'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 7.5 * 7.5 - (i * 1.15) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .34), M(i % 2 ? '#f1ad9a' : '#f7d2c3'), 0, -2.33, i * 1.15); }
    const rim = new THREE.TorusGeometry(7.6, .14, 6, 28); rim.rotateX(Math.PI / 2); put(rim, M('#c9a26b'), 0, -2.36, 0);
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    const cloth = put(new THREE.CylinderGeometry(R, R, .04, 28), M('#3f9a6a'), 0, .0, 0); cloth.receiveShadow = true;
    const ring = new THREE.TorusGeometry(R * .62, .03, 5, 28); ring.rotateX(Math.PI / 2); put(ring, M('#7fd1a0'), 0, .02, 0);
    const edge = new THREE.TorusGeometry(R + .02, .07, 6, 28); edge.rotateX(Math.PI / 2); put(edge, M('#ffc94d'), 0, .0, 0);
    put(new THREE.CylinderGeometry(.5, 1.3, 2.1, 12), M('#a86a42'), 0, -1.35, 0).castShadow = true;
    // things lying about: a picnic basket, a stack of spare card boxes, a thermos and cups
    const basket = new THREE.Group(); basket.position.set(-5.7, -2.34, -2.9); basket.rotation.y = .5; room.add(basket);
    put(new THREE.BoxGeometry(1.6, .9, 1.1), M('#c99763'), 0, .45, 0, basket).castShadow = true; put(new THREE.BoxGeometry(1.7, .12, 1.2), M('#a86a42'), 0, .93, 0, basket);
    const hoop = new THREE.TorusGeometry(.62, .06, 5, 14, Math.PI); put(hoop, M('#a86a42'), 0, .95, 0, basket);
    put(new THREE.BoxGeometry(.8, .22, .58), M('#e5543b'), 5.7, -2.23, -2.6).rotation.y = .3; put(new THREE.BoxGeometry(.8, .22, .58), M('#4f6fc4'), 5.75, -2.01, -2.55).rotation.y = -.2; put(new THREE.BoxGeometry(.8, .22, .58), M('#fff8ec'), 5.68, -1.79, -2.62).rotation.y = .5;
    put(new THREE.CylinderGeometry(.22, .26, 1.1, 10), M('#7ed3b2'), 5.3, -1.79, 3.9).castShadow = true; put(new THREE.CylinderGeometry(.16, .22, .2, 10), M('#fff8ec'), 5.3, -1.14, 3.9);
    put(new THREE.CylinderGeometry(.2, .15, .3, 10), M('#ff8fab'), 4.7, -2.19, 4.5); put(new THREE.CylinderGeometry(.2, .15, .3, 10), M('#ffc94d'), -4.9, -2.19, 4.3);
    bake(room); toonify(room, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- cards ----------
  const cardGeo = cardGeometry(CW, CH); cardGeo.rotateX(-Math.PI / 2);
  const backGeo = cardGeo.clone(); backGeo.rotateZ(Math.PI); backGeo.translate(0, -.004, 0);
  const blockGeo = cardBlock(CW, CH), blockMat = toonMat(new THREE.MeshStandardMaterial({ color: '#efe3cf', roughness: .8 }));
  const faceMats = new Map();
  // card faces are unlit, so cards on the table look exactly like the ones in your hand, day or night; the backs take the table's light
  const faceMat = c => { if (!faceMats.has(c)) faceMats.set(c, c >= 0 ? new THREE.MeshBasicMaterial({ map: cardTexture(c) }) : toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(c), roughness: .55 }))); return faceMats.get(c); };
  function makeCard(c, k = 1, b = 0) { // c = -1: a card you cannot see, back on both sides; b = whose card back (that player's fl.cb)
    const g = new THREE.Group(); g.scale.setScalar(k); const bk = -1 - (b | 0);
    const front = new THREE.Mesh(cardGeo, faceMat(c >= 0 ? c : bk)), back = new THREE.Mesh(backGeo, faceMat(bk));
    front.castShadow = true; g.add(front, back); g.userData.c = c;
    return g;
  }
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);

  // tweens run on wall-clock time, so a slow device skips frames instead of falling behind the game
  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const onRim = (r, k = 1) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, 0, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  function freeSeat(s) { for (const m of s.tbl) scene.remove(m); scene.remove(s.av, s.stool, s.g, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), a = seatAngle(r), out = onRim(r, 1.4), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      // this player's pile on the table; local +z points out towards the player
      const g = new THREE.Group(), at = onRim(r, .84); g.position.copy(at); g.rotation.y = Math.PI / 2 - a; scene.add(g);
      const block = new THREE.Mesh(blockGeo, blockMat); block.castShadow = block.receiveShadow = true; g.add(block);
      const topCard = makeCard(-1, 1, p.fl?.cb); topCard.rotation.z = Math.PI; g.add(topCard); g.updateMatrixWorld();
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), at.x, .05, at.z, scene); ring.scale.set(.66, 1, .8); ring.rotation.y = g.rotation.y;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      return { av, stool, g, block, topCard, ring, dir, at, mine, cb: p.fl?.cb | 0, tbl: [], n: 0, h: -1, hop: 0, nod: 0, look: 0, need: false, out: false, glow: 0, key: '' };
    });
  }
  function setBack(s, cb) { s.cb = cb; s.g.remove(s.topCard); s.topCard = makeCard(-1, 1, cb); s.topCard.rotation.z = Math.PI; s.g.add(s.topCard); s.h = -1; }
  const deckTop = s => new THREE.Vector3(s.at.x, .06 + Math.max(0, s.h) + .02, s.at.z);
  // Where seat s's k-th card of this battle lies: in front of them near the middle. War cards pile up on the same
  // spot, the face-down one askew so its corners show. Face-up cards all face the camera, so everyone can read them.
  const big = () => (n === 2 ? 1.65 : 1.45), reach = () => (n === 2 ? .88 : 1.15); // big enough to read, small enough that four of them (and a war's askew cards) keep clear of each other and of the piles
  function spot(s, k, up) {
    const d = reach() - Math.min(k, 8) * .05, j = hash(k * 7 + seats.indexOf(s) * 3);
    return { p: new THREE.Vector3(s.dir.x * d, .05 + k * .014, s.dir.z * d), ry: up ? (j - .5) * .14 : .5 + j * .25 };
  }
  function placeCard(s, k, c, fly, delay = 0) {
    const up = c >= 0, BIG = big(), m = makeCard(c, BIG, s.cb), { p, ry } = spot(s, k, up);
    scene.add(m); s.tbl.push(m); m.userData.up = up;
    if (!fly) { m.position.copy(p); m.rotation.set(0, ry, up ? 0 : Math.PI); return; }
    const from = deckTop(s), r0 = s.g.rotation.y;
    m.position.copy(from); m.rotation.set(0, r0, Math.PI); m.scale.setScalar(SMALL); m.visible = false;
    tween(.3, t => {
      m.visible = true; const e = ease(t);
      m.position.lerpVectors(from, p, e); m.position.y += Math.sin(e * Math.PI) * .95;
      m.rotation.y = r0 + (ry - r0) * e; m.rotation.z = up ? Math.PI * (1 - e) : Math.PI; m.scale.setScalar(SMALL + (BIG - SMALL) * e);
    }, () => { if (up) pfx.ring(p.clone().setY(.05), { color: S?.seats[seats.indexOf(s)]?.color || '#ffd84a', size: 1.25, life: .35 }); }, delay);
  }
  // everything on the table slides off to the winner's pile, turning face down on the way
  function sweep(w) {
    const all = seats.flatMap(s => s.tbl.splice(0)), to = seats[w];
    if (!to) { for (const m of all) scene.remove(m); return; }
    const r1 = to.g.rotation.y;
    all.forEach((m, j) => {
      let a = null, r0 = 0, z0 = 0, k0 = 1; // read where it is when its turn comes: it may still be landing
      tween(.4, t => {
        if (!a) { a = m.position.clone(); r0 = m.rotation.y; z0 = m.rotation.z; k0 = m.scale.x; }
        const e = ease(t), end = deckTop(to);
        m.position.lerpVectors(a, end, e); m.position.y += Math.sin(e * Math.PI) * .8;
        m.rotation.y = r0 + (r1 - r0) * e; m.rotation.z = z0 + (Math.PI - z0) * e; m.scale.setScalar(k0 + (SMALL - k0) * e);
      }, () => { scene.remove(m); if (j === all.length - 1) { pfx.ring(deckTop(to), { color: '#fff4e2', size: 1.1, life: .3 }); to.glow = 1; } }, j * .03);
    });
    to.hop = Math.max(to.hop, all.length > n ? 1 : .5);
  }

  // ---------- state from the server ----------
  let S = null, gid = '';
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) { buildSeats(list); gid = ''; }
      else list.forEach((p, i) => { // someone came back or left: swap that avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1;
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
    }
    const fresh = st.gid !== gid, prev = S; S = st;
    list.forEach((p, i) => { if (seats[i].cb !== (p.fl?.cb | 0)) setBack(seats[i], p.fl?.cb | 0); }); // they changed their card back
    if (fresh) {
      gid = st.gid; tweens.length = 0;
      list.forEach((p, i) => {
        const s = seats[i]; for (const m of s.tbl) scene.remove(m); s.tbl.length = 0;
        p.tbl.forEach((c, k) => placeCard(s, k, c, false));
        s.n = p.n; s.h = -1; s.out = !!p.out;
        if (st.stage === 'deal' && st.dealLeft > 500 && !reduced) { // the piles grow as the cards are dealt
          s.n = 0; const full = p.n; tween(st.dealLeft / 1000 - .3, t => { s.n = Math.round(full * t); }, () => { s.n = S.seats[i]?.n ?? full; }, .1);
        }
      });
    } else {
      // someone swept the table: the cards leave before any new ones land
      if (prev && st.rnd !== prev.rnd && st.last) sweep(st.last.s);
      list.forEach((p, i) => {
        const s = seats[i];
        if (p.tbl.length < s.tbl.length) { for (const m of s.tbl) scene.remove(m); s.tbl.length = 0; } // whatever was missed
        for (let k = s.tbl.length, j = 0; k < p.tbl.length; k++, j++) placeCard(s, k, p.tbl[k], true, j * .14);
        s.n = p.n;
      });
      const land = .34; // the last card is still in the air when the server has already judged it
      if (st.stage === 'show' && prev?.stage !== 'show' && seats[st.bw]) {
        const s = seats[st.bw], m = s.tbl[s.tbl.length - 1], war = st.war > 0, BIG = big(), y0 = .05 + (s.tbl.length - 1) * .014;
        tween(.34, t => { if (m?.parent) { const k = BIG * (1 + Math.sin(t * Math.PI) * .22 + t * .08); m.scale.setScalar(k); m.position.y = y0 + Math.sin(t * Math.PI) * .35 + t * .06; } }, null, land);
        tween(.01, () => {}, () => {
          if (!m?.parent) return;
          const p = m.position.clone();
          pfx.sparkle(p.clone().setY(.5), { n: war ? 16 : 8, r: .8 }); pfx.ring(p.clone().setY(.06), { color: '#ffd84a', size: 2 });
          s.hop = Math.max(s.hop, war ? 1 : .45);
          if (war) { shake.kick(.14); pfx.confetti(p.clone().setY(1.1), { n: 36, w: 1.6, h: 1.2, size: .11, s: st.bw }); }
          for (const o of seats) if (o !== s && o.tbl.length && st.inn.includes(seats.indexOf(o))) o.nod = Math.max(o.nod, .6);
        }, land + .05);
      }
      if (st.stage === 'war' && prev?.stage !== 'war') {
        tween(.01, () => {}, () => {
          shake.kick(.3);
          pfx.burst(new THREE.Vector3(0, .5, 0), { n: 26, colors: ['#ff5a3c', '#ffb547', '#ffd84a', '#ffffff'], speed: 5.5, up: 4.5, size: .3 });
          for (const i of st.inn) { const s = seats[i]; if (!s) continue; s.hop = .8; const m = s.tbl[s.tbl.length - 1]; if (m) { const r0 = m.rotation.y; tween(.5, t => { m.rotation.y = r0 + Math.sin(t * Math.PI * 5) * .16 * (1 - t); }); } }
        }, land);
      }
    }
    list.forEach((p, i) => {
      const s = seats[i];
      s.need = st.stage === 'flip' && p.need;
      if (p.out && !s.out && !fresh) s.nod = 3;
      s.out = !!p.out;
    });
    if (st.ph === 'end' && prev && prev.ph !== 'end' && !fresh) {
      st.seats.forEach((p, i) => { if (st.res?.place[i] !== 1 || !seats[i] || seats[i].mine) return; const s = seats[i]; s.hop = 1.6; const top = s.av.position.clone().setY(2.1); pfx.confetti(top, { n: 70, w: 2.6, h: 2, size: .14, s: i }); pfx.burst(top, { n: 16, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 }); });
    }
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
    const pulse = .5 + Math.sin(T * 7) * .5;
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * .7); s.glow = Math.max(0, s.glow - dt * 2.5);
      s.av.position.y = -.15 + Math.abs(Math.sin(Math.min(1, s.hop) * Math.PI * 2)) * .45 * Math.min(1, s.hop);
      s.look += (0 - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.need || s.hop > 0, hop: Math.min(1, s.hop), look: s.look, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      // the pile: as tall as its cards, with one real card back on top
      const h = s.n * THICK;
      if (Math.abs(h - s.h) > .0005) {
        s.h = s.h < 0 ? h : s.h + (h - s.h) * Math.min(1, real * 12);
        s.block.visible = s.topCard.visible = s.n > 0 || s.h > .004;
        s.block.scale.y = Math.max(.002, s.h); s.block.position.y = .025 + s.h / 2; s.topCard.position.y = .032 + s.h;
      }
      const k = 1 + s.glow * .12; s.topCard.scale.setScalar(k);
      s.ring.material.opacity += ((s.need ? .55 + pulse * .4 : 0) - s.ring.material.opacity) * .2;
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .16), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    // where the HUD draws the name tags (over the avatar) and the pile counts (beside each pile, so the card back stays in view)
    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.copy(onRim(r, 1.4)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
      if (s.mine) tv.set(s.at.x + .62, .1, s.at.z + .1); else tv.copy(s.dir).multiplyScalar(R * .84 + .62).setY(.1); tv.project(camera); t.cx = (tv.x + 1) / 2 * W; t.cy = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    setHud(px) { const fit = hudFitOk(canvas), grew = px > hudBottom + 6; if ((Math.abs(px - hudBottom) > 6) && (fit || grew)) { hudBottom = px; fit ? resize(true) : easeRefit(camera, camBase, camLook, () => resize(true)); } }, // a HUD growing mid-game eases the camera out (camfit.js)
    setInset(px) { if ((px !== hudLeft) && hudFitOk(canvas)) { hudLeft = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const m of faceMats.values()) m.dispose();
      pfx.dispose(); cardGeo.dispose(); backGeo.dispose(); blockGeo.dispose(); blockMat.dispose(); ringGeo.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

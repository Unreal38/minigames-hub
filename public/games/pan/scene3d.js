// Pan 3D table (three.js): a round table on a sky island, everyone's avatar on a stool with their cards face
// down in front of them, and the pile in the middle with the three cards you would pick up fanned out.
// Purely visual: it draws what the server sends, and other players' cards are only ever backs here.
import * as THREE from 'three';
import { cardGeometry } from '../../cardgeo.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { cardTexture } from '../poker/scene3d.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 3.4;               // table radius
const CW = .62, CH = .88;    // card size
const PILE = 1.45;           // cards in the pile are drawn bigger, so the top ones can be read
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
  const land = island(15, 15, { round: true, rim: 4.4, seed: 23, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  { // a checked picnic blanket under a table with a blue cloth
    const deck = put(new THREE.CylinderGeometry(7.6, 7.6, .16, 28), M('#e9d3a7'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 7.5 * 7.5 - (i * 1.15) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .34), M(i % 2 ? '#f1ad9a' : '#f7d2c3'), 0, -2.33, i * 1.15); }
    const rim = new THREE.TorusGeometry(7.6, .14, 6, 28); rim.rotateX(Math.PI / 2); put(rim, M('#c9a26b'), 0, -2.36, 0);
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    const cloth = put(new THREE.CylinderGeometry(R, R, .04, 28), M('#4f6fc4'), 0, .0, 0); cloth.receiveShadow = true;
    const ring = new THREE.TorusGeometry(1.75, .03, 5, 28); ring.rotateX(Math.PI / 2); put(ring, M('#7f9be6'), 0, .02, 0);
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
  const faceMats = new Map();
  const faceMat = c => { if (!faceMats.has(c)) faceMats.set(c, toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(c), roughness: .55 }))); return faceMats.get(c); };
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
      // this player's cards on the table; local +z points out towards the player
      const g = new THREE.Group(), at = onRim(r, mine ? 1.02 : .7); g.position.copy(at); g.rotation.y = Math.PI / 2 - a; g.visible = !mine; scene.add(g); g.updateMatrixWorld();
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), at.x, .05, at.z, scene); ring.scale.set(1.5, 1, .75); ring.rotation.y = g.rotation.y; ring.visible = !mine;
      return { av, stool, g, ring, mine, cb: p.fl?.cb | 0, cards: [], n: 0, hop: 0, nod: 0, look: 0, active: false, out: false, key: '' };
    });
  }
  // a face-down row that closes up as it gets longer
  const slot = (k, cnt) => { const step = Math.min(.36, 2.5 / Math.max(1, cnt)); return new THREE.Vector3((k - (cnt - 1) / 2) * step, .02 + k * .004, 0); };
  function setHand(s, cnt, deal = -1) {
    while (s.cards.length > cnt) s.g.remove(s.cards.pop());
    while (s.cards.length < cnt) { const c = makeCard(-1, 1, s.cb); c.scale.setScalar(.82); c.rotation.z = Math.PI; s.g.add(c); s.cards.push(c); }
    s.cards.forEach((c, k) => {
      const to = slot(k, cnt);
      if (deal >= 0) { // dealt out of the middle, one card at a time round the table
        const from = s.g.worldToLocal(new THREE.Vector3(0, .5, 0)); c.visible = false;
        tween(.4, t => { c.visible = true; const e = ease(t); c.position.lerpVectors(from, to, e); c.position.y += Math.sin(e * Math.PI) * .7; }, null, deal + k * dealStep * n);
      } else { const from = c.position.clone(); tween(.25, t => c.position.lerpVectors(from, to, ease(t))); }
    });
    s.n = cnt;
  }
  let dealStep = .07;

  // ---------- the pile ----------
  // The whole pile is one neat stack on the left of the middle; the top three (what you would pick up) fan out
  // to the right, each leaving its corner showing. The nine of hearts at the bottom never joins the fan.
  const pile = []; // card meshes, bottom first
  function pileSpot(k, len) {
    const d = len - 1 - k, fan = k > 0 && d < 3; // how far below the top
    const j = hash(pile[k]?.userData.c ?? k);
    return { p: new THREE.Vector3(fan ? 1.02 - d * .56 : -1.0 + (j - .5) * .06, .03 + k * .007, (j - .5) * .08), ry: fan ? (1 - d) * -.06 : (j - .5) * .3 };
  }
  function settlePile(skip = 0) {
    pile.forEach((c, k) => {
      if (k >= pile.length - skip) return; // still in the air
      const { p, ry } = pileSpot(k, pile.length), from = c.position.clone(), r0 = c.rotation.y;
      if (from.distanceToSquared(p) < 1e-6) return;
      tween(.3, t => { const e = ease(t); c.position.lerpVectors(from, p, e); c.rotation.y = r0 + (ry - r0) * e; });
    });
  }
  const seatSpot = i => { const s = seats[i]; return s ? s.g.localToWorld(new THREE.Vector3(0, .1, 0)) : new THREE.Vector3(); };

  // ---------- state from the server ----------
  let S = null, gid = '', mv = -1;
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
    const fresh = st.gid !== gid;
    if (fresh) {
      gid = st.gid; mv = st.mv; tweens.length = 0;
      for (const c of pile) scene.remove(c); pile.length = 0;
      for (const c of st.pile) { const m = makeCard(c, PILE); scene.add(m); pile.push(m); }
      pile.forEach((c, k) => { const { p, ry } = pileSpot(k, pile.length); c.position.copy(p); c.rotation.y = ry; });
      const dealing = st.stage === 'deal' && st.dealLeft > 500 && !reduced;
      dealStep = dealing ? Math.max(.02, (st.dealLeft / 1000 - .7) / 24) : .07;
      list.forEach((p, i) => { setHand(seats[i], 0); setHand(seats[i], p.n, dealing ? rel(i) * dealStep : -1); });
    } else if (st.mv !== mv) {
      mv = st.mv;
      const L = st.last, from = L ? seatSpot(L.s) : null;
      if (L?.t === 'play') {
        const k0 = pile.length;
        L.cards.forEach((c, j) => {
          const m = makeCard(c, PILE, list[L.s]?.fl?.cb); m.position.copy(from); m.rotation.set(0, seats[L.s].g.rotation.y, Math.PI); m.visible = false; scene.add(m); pile.push(m);
        });
        L.cards.forEach((c, j) => {
          const m = pile[k0 + j], { p, ry } = pileSpot(k0 + j, pile.length), r0 = m.rotation.y;
          tween(.5, t => { m.visible = true; const e = ease(t); m.position.lerpVectors(from, p, e); m.position.y += Math.sin(e * Math.PI) * 1.1; m.rotation.y = r0 + (ry - r0) * e; m.rotation.z = Math.PI * (1 - e); },
            () => { if (j === L.cards.length - 1) { pfx.ring(p.clone().setY(.04), { color: list[L.s]?.color || '#ffd84a', size: 1.3 }); if (L.cards.length > 1) { shake.kick(.12); pfx.confetti(p.clone().setY(1), { n: 40, w: 2.2, h: 1.6, s: L.s }); } } }, j * .09);
        });
        settlePile(L.cards.length);
        if (seats[L.s]) seats[L.s].hop = L.cards.length > 1 ? 1 : .5;
      } else if (L?.t === 'draw') {
        const took = pile.splice(pile.length - L.cards.length, L.cards.length);
        took.forEach((m, j) => {
          const a = m.position.clone(), r0 = m.rotation.y, r1 = seats[L.s].g.rotation.y;
          tween(.5, t => { const e = ease(t); m.position.lerpVectors(a, from, e); m.position.y += Math.sin(e * Math.PI) * .9; m.rotation.y = r0 + (r1 - r0) * e; m.rotation.z = Math.PI * e; m.scale.setScalar(PILE - e * (PILE - .82)); },
            () => { scene.remove(m); if (!j) pfx.puff(from.clone(), { n: 8, color: ['#fff4e2', '#d9c3a4'], size: .3, speed: 1.6 }); }, (took.length - 1 - j) * .08);
        });
        settlePile();
        if (seats[L.s]) seats[L.s].nod = 1;
      }
      // the pile on the table must end up matching the server's, whatever was missed
      if (pile.length !== st.pile.length || pile.some((m, k) => m.userData.c !== st.pile[k])) {
        for (const c of pile) scene.remove(c); pile.length = 0;
        for (const c of st.pile) { const m = makeCard(c, PILE); scene.add(m); pile.push(m); }
        pile.forEach((c, k) => { const { p, ry } = pileSpot(k, pile.length); c.position.copy(p); c.rotation.y = ry; });
      }
      list.forEach((p, i) => { if (seats[i].n !== p.n) setHand(seats[i], p.n); });
    }
    list.forEach((p, i) => {
      const s = seats[i];
      if (s.cb !== (p.fl?.cb | 0)) { s.cb = p.fl?.cb | 0; const k2 = s.cards.length; setHand(s, 0); setHand(s, k2); } // they changed their card back
      s.active = st.turn === i && st.stage === 'play';
      if (p.out && !s.out && !fresh) { s.hop = 1; const top = s.av.position.clone().setY(2.1); pfx.confetti(top, { n: 60, w: 2.6, h: 2, s: i }); pfx.burst(top, { n: 14, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 }); }
      s.out = !!p.out;
    });
    if (st.ph === 'end' && S?.ph !== 'end' && seats[st.pan]) { seats[st.pan].nod = 3; shake.kick(.12); }
    S = st;
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
  const info = { tags: [], pile: { x: 0, y: 0 } };
  function loop(dt, now) {
    if (dead) return;
    resize();
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now; T += dt;
    for (let i = 0; i < tweens.length; i++) { // oldest first, so a later tween wins
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    const turnSeat = seats.findIndex(s => s.active);
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * .7);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      let look = 0;
      if (turnSeat >= 0 && turnSeat !== i) { const d = ((rel(turnSeat) - rel(i) + n) % n) / n; look = d < .5 ? .5 : -.5; }
      s.look += (look - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active || s.out, hop: s.hop, look: s.look, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .16), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    // where the HUD draws the name tags
    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.copy(onRim(r, 1.4)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
      tv.copy(s.g.position); tv.y = .5; tv.project(camera); t.cx = (tv.x + 1) / 2 * W; t.cy = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    tv.set(0, .05, .9).project(camera); info.pile.x = (tv.x + 1) / 2 * W; info.pile.y = (1 - tv.y) / 2 * H;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    setHud(px) { if (Math.abs(px - hudBottom) > 6) { hudBottom = px; resize(true); } },
    setInset(px) { if (px !== hudLeft) { hudLeft = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      for (const m of faceMats.values()) m.dispose();
      pfx.dispose(); cardGeo.dispose(); backGeo.dispose(); ringGeo.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

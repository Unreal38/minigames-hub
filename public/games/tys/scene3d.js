// Tysiąc 3D table (three.js): a round card table on a sky island, everyone's avatar on a stool with their cards
// face down in front of them. Purely visual: it draws what the server sends, and the server never sends
// anyone else's cards, so the fans here are only ever card backs.
import * as THREE from 'three';
import { cardGeometry } from '../../cardgeo.js';
import { cardTexture, suitPath } from '../poker/scene3d.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution } from '../../frames.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 3.2;              // table radius
const CW = .62, CH = .88;   // card size
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });

function feltTexture() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 30, S / 2, S / 2, S / 2);
  gr.addColorStop(0, '#46a57c'); gr.addColorStop(1, '#2f8262'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#fff4e244'; g.lineWidth = 4; g.setLineDash([14, 10]); g.beginPath(); g.arc(S / 2, S / 2, S * .4, 0, 7); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.globalAlpha = .2; suitPath(g, i % 4, S / 2 + Math.cos(a) * S * .45 - 9, S / 2 + Math.sin(a) * S * .45 - 9, 18); }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.75); // steps the resolution down if the device can't hold 60 fps
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(6, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island and the table ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 22, max: 90, below: -12, seed: 3 }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const land = island(15, 15, { round: true, rim: 4.4, seed: 23, props: 16, size: 1.7, flowers: 60 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 3, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const feltMap = feltTexture();
  {
    const deck = put(new THREE.CylinderGeometry(7.4, 7.4, .16, 28), M('#e2b77e'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 7.3 * 7.3 - (i * 1.12) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .05), M('#c4925a'), 0, -2.33, i * 1.12); }
    const rim = new THREE.TorusGeometry(7.4, .14, 6, 28); rim.rotateX(Math.PI / 2); put(rim, M('#a86a42'), 0, -2.36, 0);
    // a woven rug in folk red and white under the table
    put(new THREE.CylinderGeometry(5.6, 5.6, .04, 28), M('#b9483f'), 0, -2.32, 0).receiveShadow = true;
    put(new THREE.CylinderGeometry(5.1, 5.1, .05, 28), M('#fff4e2'), 0, -2.32, 0);
    put(new THREE.CylinderGeometry(4.6, 4.6, .06, 28), M('#b9483f'), 0, -2.32, 0);
    // the table: wooden top, red padded edge, one fat leg
    const top = put(new THREE.CylinderGeometry(R + .42, R + .28, .3, 32), M('#9c6238'), 0, -.16, 0); top.castShadow = top.receiveShadow = true;
    const edge = new THREE.TorusGeometry(R + .08, .13, 8, 40); edge.rotateX(Math.PI / 2); put(edge, M('#c9404a', { flatShading: false }), 0, .0, 0);
    put(new THREE.CylinderGeometry(.75, 1.25, 2.1, 12), M('#7d4b2a'), 0, -1.35, 0).castShadow = true;
    // a jug of kompot, two cups and a plate of pierogi left beside the table
    const side = new THREE.Group(); side.position.set(-5.3, -2.34, -3.2); room.add(side);
    put(new THREE.CylinderGeometry(.9, .9, .9, 10), M('#b9794a'), 0, .45, 0, side).castShadow = true; put(new THREE.CylinderGeometry(1.05, 1.05, .1, 10), M('#c99763'), 0, .95, 0, side);
    put(new THREE.CylinderGeometry(.22, .3, .6, 8), M('#e5543b'), -.3, 1.3, .1, side).castShadow = true; put(new THREE.CylinderGeometry(.12, .12, .2, 6), M('#fff4e2'), .3, 1.1, -.2, side); put(new THREE.CylinderGeometry(.12, .12, .2, 6), M('#fff4e2'), .45, 1.1, .25, side);
    const crate = (x, z, s, c, ry) => { const m = put(new THREE.BoxGeometry(s, s, s), M(c), x, -2.34 + s / 2, z); m.rotation.y = ry; m.castShadow = true; };
    crate(5.7, -3.0, 1, '#c99763', .3); crate(5.5, -3.1 + 1.25, .7, '#d9a066', -.4);
    bake(room); toonify(room, .04);
  }
  const felt = new THREE.Mesh(new THREE.CircleGeometry(R, 48), toonMat(new THREE.MeshStandardMaterial({ map: feltMap, roughness: .95 })));
  felt.rotation.x = -Math.PI / 2; felt.position.y = .0; felt.receiveShadow = true; scene.add(felt);
  const pfx = createFx(scene), shake = shaker();

  // ---------- cards ----------
  const cardGeo = cardGeometry(CW, CH); cardGeo.rotateX(-Math.PI / 2);
  const backGeo = cardGeo.clone(); backGeo.rotateZ(Math.PI); backGeo.translate(0, -.004, 0);
  const faceMats = new Map();
  const faceMat = c => { if (!faceMats.has(c)) faceMats.set(c, toonMat(new THREE.MeshStandardMaterial({ map: cardTexture(c), roughness: .55 }))); return faceMats.get(c); };
  function makeCard(c = -1) {
    const g = new THREE.Group();
    const front = new THREE.Mesh(cardGeo, faceMat(c)), back = new THREE.Mesh(backGeo, faceMat(-1));
    front.castShadow = true; g.add(front, back); g.userData = { c, front }; g.rotation.z = c >= 0 ? 0 : Math.PI;
    scene.add(g); return g;
  }
  const setFace = (card, c) => { if (card.userData.c !== c) { card.userData.c = c; card.userData.front.material = faceMat(c); } };
  const drop = card => { card.userData.gone = true; scene.remove(card); };

  const tweens = [];
  const tween = (dur, fn, done, delay = 0) => tweens.push({ t: -delay, dur, fn, done });
  // slide a card through the air to a spot on the table
  function fly(card, to, { delay = 0, dur = .42, up = .7, ry, scale, done } = {}) {
    let from = null, ry0 = 0, s0 = 1;
    tween(dur, t => {
      if (card.userData.gone) return;
      if (!from) { from = card.position.clone(); ry0 = card.rotation.y; s0 = card.scale.x; card.visible = true; }
      const e = ease(t); card.position.lerpVectors(from, to, e); card.position.y += Math.sin(e * Math.PI) * up;
      if (ry !== undefined) card.rotation.y = ry0 + (ry - ry0) * e;
      if (scale !== undefined) card.scale.setScalar(s0 + (scale - s0) * e);
    }, done, delay);
  }
  function flip(card, up, delay = 0) {
    const to = up ? 0 : Math.PI; let from = null, y0 = 0;
    tween(.4, t => { if (card.userData.gone) return; if (from === null) { from = card.rotation.z; y0 = card.position.y; } const e = ease(t); card.rotation.z = from + (to - from) * e; card.position.y = y0 + Math.sin(e * Math.PI) * .45; }, null, delay);
  }

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const onRim = (r, k = 1, y = 0) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, y, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  const ringGeo = new THREE.TorusGeometry(.95, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); for (const c of s.fan) drop(c); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), a = seatAngle(r), out = onRim(r, 1.42), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const at = onRim(r, .7, .03);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), at.x, .04, at.z, scene);
      return { av, stool, ring, mine, r, a, fan: [], hop: 0, nod: 0, look: 0, active: false, key: '' };
    });
  }
  // where the k-th of m face-down cards lies in front of a seat
  const fanSpot = (s, k, m) => { const x = (k - (m - 1) / 2) * .2, p = onRim(s.r, .7, .02 + k * .004); p.x += -Math.sin(s.a) * x; p.z += Math.cos(s.a) * x; return p; };
  const fanTurn = (s, k, m) => Math.PI / 2 - s.a - (k - (m - 1) / 2) * .06;
  const handSpot = s => (s.mine ? onRim(s.r, 1.25, .3) : onRim(s.r, .7, .1)); // where a seat's cards come from and go to
  function layFan(s, from, stagger = 0, start = 0) {
    const m = s.fan.length;
    s.fan.forEach((c, k) => {
      const fresh = c.userData.fresh; c.userData.fresh = false;
      if (fresh && from) { c.position.copy(from); c.visible = false; c.scale.setScalar(.8); }
      fly(c, fanSpot(s, k, m), { delay: fresh ? start + k * stagger : 0, dur: fresh ? .45 : .25, up: fresh ? .6 : 0, ry: fanTurn(s, k, m) });
    });
  }

  // ---------- state from the server ----------
  const CENTER = new THREE.Vector3(0, .05, 0);
  let handKey = '', trick = [], musik = [], musikUp = false, last = null, T = 0;
  const trickSpot = (s, k) => onRim(s.r, .27, .03 + k * .012);
  function clearTable() { for (const t of trick) drop(t.card); trick = []; for (const c of musik) drop(c); musik = []; musikUp = false; for (const s of seats) { for (const c of s.fan) drop(c); s.fan = []; } }

  function setState(S) {
    const list = S.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + S.me;
    if (key !== seatKey) {
      const rebuilt = S.me !== me || list.length !== n || !seats.length;
      me = S.me; seatKey = key;
      if (rebuilt) { clearTable(); buildSeats(list); handKey = ''; }
      else list.forEach((p, i) => { // someone took over a bot: swap that avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1;
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
    }
    const hk = S.gid + '/' + S.hand, fresh = hk !== handKey, dealing = fresh && S.stage === 'deal' && S.ago < 600 && !reduced;
    if (fresh) { handKey = hk; clearTable(); last = null; }

    // the musik: three cards face down in the middle, turned over when the bidding is won
    const wantMusik = S.ph === 'play' && S.musikN > 0 && ['deal', 'bid', 'take'].includes(S.stage);
    if (wantMusik && !musik.length) {
      musik = [0, 1, 2].map(k => { const c = makeCard(-1); c.scale.setScalar(1.15); const to = new THREE.Vector3((k - 1) * .8, .03, 0); if (dealing) { c.position.copy(CENTER); c.visible = false; fly(c, to, { delay: 1.5 + k * .08 }); } else c.position.copy(to); return c; });
    }
    if (S.musik && musik.length && !musikUp) { musikUp = true; musik.forEach((c, k) => { setFace(c, S.musik[k]); flip(c, true, k * .14); fly(c, new THREE.Vector3((k - 1) * 1.02, .03, 0), { dur: .4, up: 0, scale: 1.5 }); }); pfx.ring(CENTER, { color: '#ffd84a', size: 2 }); }
    if (!wantMusik && musik.length) { // the declarer picks them up
      const d = seats[S.decl], cs = musik; musik = []; musikUp = false;
      cs.forEach((c, k) => { if (d) { flip(c, false); fly(c, handSpot(d), { delay: k * .07, dur: .45, scale: .8, done: () => drop(c) }); } else drop(c); });
    }

    // the trick in the middle
    const tk = S.trick || [];
    if (trick.length && (tk.length < trick.length || tk[0]?.c !== trick[0].c)) { // it was taken: slide the cards to whoever won
      const w = seats[S.lastTrick?.w], old = trick; trick = [];
      old.forEach((t, k) => { if (w) fly(t.card, onRim(w.r, 1.0, .1), { delay: k * .05, dur: .45, up: .3, scale: .5, done: () => drop(t.card) }); else drop(t.card); });
      if (w) { w.hop = 1; const p = onRim(w.r, .8, .3); pfx.burst(p, { n: 10, colors: ['#ffd84a', '#ffffff', w.key.slice(0, 7)], speed: 2.2, up: 3, size: .22, life: .7, shape: STAR }); }
    }
    for (let k = trick.length; k < tk.length; k++) {
      const s = seats[tk[k].s], c = makeCard(tk[k].c); if (!s) { drop(c); continue; }
      c.position.copy(handSpot(s)); c.rotation.y = Math.PI / 2 - s.a; c.scale.setScalar(.8); c.visible = !!last;
      const to = trickSpot(s, k), ry = Math.PI / 2 - s.a + (Math.sin(tk[k].c * 7.1) * .18);
      if (last) fly(c, to, { dur: .34, up: .55, ry, scale: 1.45, done: () => pfx.puff(to, { n: 5, size: .2, speed: 1.2, life: .35 }) });
      else { c.position.copy(to); c.rotation.y = ry; c.scale.setScalar(1.45); }
      trick.push({ c: tk[k].c, card: c });
    }

    // everyone else's cards, face down
    list.forEach((p, i) => {
      const s = seats[i], want = s.mine ? 0 : p.n; let grew = false;
      while (s.fan.length > want) drop(s.fan.pop());
      while (s.fan.length < want) { const c = makeCard(-1); c.userData.fresh = true; s.fan.push(c); grew = true; }
      const key = want + '/' + S.stage;
      if (grew || s.fanKey !== key) {
        s.fanKey = key;
        const from = !last && !dealing ? null : S.stage === 'play' && seats[S.decl] && S.decl !== i ? handSpot(seats[S.decl]) : CENTER;
        if (!from) s.fan.forEach((c, k) => { c.userData.fresh = false; c.position.copy(fanSpot(s, k, want)); c.rotation.y = fanTurn(s, k, want); c.scale.setScalar(.8); });
        else layFan(s, from, dealing ? .1 : .06, dealing ? .15 + s.r * .05 : 0);
      }
      s.active = S.turn === i && S.ph === 'play';
    });
    last = S;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 260, hudLeft = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, -.2);
  const DIR = new THREE.Vector3(0, 1.15, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 1100 ? 178 : 112, bottom = Math.max(top + 120, h - hudBottom), side = portrait ? R * 1.1 : R * 1.42 + 1.1; // on phones the side players may peek in from the edges
    const FIT = [new THREE.Vector3(0, 3.3, -R * 1.42), new THREE.Vector3(0, .3, R * 1.04), new THREE.Vector3(-side, 1.2, 0), new THREE.Vector3(side, 1.2, 0)];
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
  let dead = false, lastNow = 0;
  const tv = new THREE.Vector3(), info = { tags: [], mid: { x: 0, y: 0 } };
  function loop(dt, now) {
    if (dead) return;
    resize(); T += dt;
    const real = lastNow ? Math.min((now - lastNow) / 1000, .5) : dt; lastNow = now;
    // tweens run on wall-clock time, so a slow device skips frames instead of falling behind the game
    for (let i = 0; i < tweens.length; i++) {
      const tw = tweens[i]; tw.t += real; if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { tweens.splice(i--, 1); tw.done?.(); }
    }
    const turnSeat = seats.findIndex(s => s.active);
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * 1.2);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      let look = 0;
      if (turnSeat >= 0 && turnSeat !== i) { const d = ((rel(turnSeat) - rel(i) + n) % n) / n; look = d < .5 ? .5 : -.5; }
      s.look += (look - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop, look: s.look, nod: Math.sin(Math.min(1, s.nod) * Math.PI) * .9 });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1 + Math.sin(T * 4) * .05);
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .14), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    // where the HUD draws the name tags and floating points
    seats.forEach((s, i) => {
      const t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.copy(onRim(s.r, 1.42)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
      tv.copy(onRim(s.r, s.mine ? .95 : .7)); tv.y = .6; tv.project(camera); t.cx = (tv.x + 1) / 2 * W; t.cy = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    tv.set(0, .1, 0).project(camera); info.mid.x = (tv.x + 1) / 2 * W; info.mid.y = (1 - tv.y) / 2 * H;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    // a marriage is announced: a burst in the suit's colour over the table
    meld(i, su) { const s = seats[i]; if (s) { s.hop = 1; } const col = su < 2 ? '#e5543b' : '#3b2219'; pfx.burst(CENTER.clone().setY(.4), { n: 26, colors: [col, '#ffd84a', '#ffffff'], speed: 4, up: 5, size: .3, life: 1 }); pfx.ring(CENTER, { color: '#ffd84a', size: 2.6 }); if (!reduced) shake.kick(.1); },
    cheer(i, good = true) { const s = seats[i]; if (!s) return; if (good) { s.hop = 1; const p = onRim(s.r, s.mine ? .9 : 1.42, s.mine ? .6 : 2.2); pfx.confetti(p, { n: 60, w: 3, h: 2.4, s: i }); } else s.nod = 1; },
    setHud(px) { if (Math.abs(px - hudBottom) > 6) { hudBottom = px; resize(true); } },
    setInset(px) { if (px !== hudLeft) { hudLeft = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      pfx.dispose(); feltMap.dispose(); for (const m of faceMats.values()) m.dispose();
      for (const g of [cardGeo, backGeo, ringGeo]) g.dispose();
      renderer.dispose();
    },
  };
}

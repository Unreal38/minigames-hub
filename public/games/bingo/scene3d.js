// Sky Bingo 3D table (three.js): a round table on a sky island with a blocky ball machine in the middle and an owl
// on top that calls the numbers. Every ball pops out of the machine, sits on the stand in front of you, then moves to
// the rail of earlier balls. Everyone's avatar sits round the table with a small card that fills up as they daub.
// Purely visual: it draws what the server sends. Your own card is drawn by the page (client.js), not here.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { colOf, letterOf, count } from './rules.js';

const INK = '#4a2c22', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 2.95; // table radius
export const BALL_COLS = ['#4aa3ff', '#ff6b8b', '#ffd23f', '#5fcf86', '#ff9440']; // B I N G O
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const RAIL = 5;                                   // earlier balls kept on the rail
const STAND = new THREE.Vector3(0, .62, 1.55);    // where the newest ball sits
const MOUTH = new THREE.Vector3(0, .5, .75);      // where balls leave the machine
const railAt = i => new THREE.Vector3(-1.28 + i * .64, .3, 2.42);

// The number on a ball: a white disc with the column letter over the number, always turned to the camera.
function labelTex(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(64, 64, 60, 0, 6.3); g.fill();
  g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 30px Rubik, system-ui, sans-serif'; g.fillText(letterOf(n), 64, 30);
  g.font = '700 66px Rubik, system-ui, sans-serif'; g.fillText(String(n), 64, 76);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

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

  // ---------- the island, the table and the machine ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 22, max: 90, below: -12, seed: 5 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(15, 15, { round: true, rim: 4.4, seed: 21, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  {
    const deck = put(new THREE.CylinderGeometry(7.6, 7.6, .16, 28), M('#d9a066'), 0, -2.42, 0); deck.receiveShadow = true;
    for (let i = -6; i <= 6; i++) { const w = Math.sqrt(Math.max(0, 7.5 * 7.5 - (i * 1.15) ** 2)) * 2; put(new THREE.BoxGeometry(w, .02, .05), M('#b97f4c'), 0, -2.33, i * 1.15); }
    const rimG = new THREE.TorusGeometry(7.6, .14, 6, 28); rimG.rotateX(Math.PI / 2); put(rimG, M('#a86a42'), 0, -2.36, 0);
    // the table: a plank top on a barrel with a mint cloth
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    const edge = new THREE.TorusGeometry(R + .4, .08, 6, 28); edge.rotateX(Math.PI / 2); put(edge, M('#ffc94d'), 0, 0, 0);
    const cloth = put(new THREE.CylinderGeometry(R + .12, R + .12, .04, 28), M('#e9f7ec'), 0, 0, 0); cloth.receiveShadow = true;
    const band = new THREE.TorusGeometry(R - .12, .035, 5, 28); band.rotateX(Math.PI / 2); put(band, M('#ff8fab'), 0, .02, 0);
    put(new THREE.CylinderGeometry(1.25, 1.05, 2, 14), M('#a86a42'), 0, -1.32, 0).castShadow = true;
    for (const y of [-.7, -1.9]) { const h = new THREE.TorusGeometry(y < -1 ? 1.13 : 1.24, .07, 5, 14); h.rotateX(Math.PI / 2); put(h, M('#5b4636'), 0, y, 0); }
    // the machine: a chunky coral base with a yellow trim, a chute at the front and four posts that hold the cage
    put(new THREE.BoxGeometry(2.1, .5, 1.7), M('#ff7a59'), 0, .27, -.25).castShadow = true;
    put(new THREE.BoxGeometry(2.24, .12, 1.84), M('#ffc94d'), 0, .56, -.25);
    put(new THREE.BoxGeometry(2.24, .1, 1.84), M('#8a5a3c'), 0, .07, -.25);
    put(new THREE.BoxGeometry(.62, .34, .5), M('#8a5a3c'), 0, .36, .72).castShadow = true;                       // the chute's mouth
    put(new THREE.BoxGeometry(.44, .05, .7), M('#ffd6e0'), 0, .2, 1.05).rotation.x = .16;                         // the slide
    for (const x of [-1, 1]) put(new THREE.BoxGeometry(.06, .12, .7), M('#8a5a3c'), x * .25, .24, 1.05).rotation.x = .16;
    for (const [x, z] of [[-.88, -.95], [.88, -.95], [-.88, .45], [.88, .45]]) put(new THREE.BoxGeometry(.14, 2.1, .14), M('#8a5a3c'), x, 1.6, z).castShadow = true;
    put(new THREE.BoxGeometry(2.1, .14, 1.7), M('#ffc94d'), 0, 2.68, -.25).castShadow = true;                      // the roof the owl sits on
    put(new THREE.BoxGeometry(1.5, .1, 1.2), M('#ff7a59'), 0, 2.8, -.25);
    // a crank on the side
    put(new THREE.CylinderGeometry(.07, .07, .5, 6), M('#5b4636'), 1.3, .34, -.25).rotation.z = Math.PI / 2;
    // the stand for the newest ball and the rail for the earlier ones
    put(new THREE.CylinderGeometry(.34, .44, .2, 8), M('#ffc94d'), STAND.x, .12, STAND.z).castShadow = true;
    put(new THREE.CylinderGeometry(.24, .24, .08, 8), M('#8a5a3c'), STAND.x, .25, STAND.z);
    put(new THREE.BoxGeometry(RAIL * .64 + .16, .08, .5), M('#8a5a3c'), 0, .06, 2.42).castShadow = true;
    for (const z of [-1, 1]) put(new THREE.BoxGeometry(RAIL * .64 + .16, .1, .07), M('#ffc94d'), 0, .13, 2.42 + z * .24);
    // lantern poles round the deck and a string of bunting between two of them
    for (const [x, z, c] of [[-6.4, -2.2, '#ffd84a'], [6.4, -2.2, '#ff8fab'], [0, -6.9, '#7ed3b2']]) {
      put(new THREE.CylinderGeometry(.07, .09, 3.6, 6), M('#8a5a3c'), x, -.6, z).castShadow = true;
      put(new THREE.BoxGeometry(.42, .5, .42), M(c, { emissive: c, emissiveIntensity: .35 }), x, 1.35, z);
      put(new THREE.ConeGeometry(.36, .25, 4), M('#5b4636'), x, 1.72, z).rotation.y = Math.PI / 4;
    }
    for (let i = 0; i < 11; i++) { // bunting from the left pole to the back pole to the right pole
      for (const sx of [-1, 1]) {
        const t = (i + .5) / 11, x = sx * 6.4 * (1 - t), z = -2.2 + (-6.9 + 2.2) * t, y = 1.05 - Math.sin(t * Math.PI) * .5;
        const f = put(new THREE.ConeGeometry(.2, .36, 3), M(BALL_COLS[(i + (sx > 0 ? 2 : 0)) % 5]), x, y, z); f.rotation.set(Math.PI, Math.atan2(sx * 6.4, 4.7), 0); f.scale.z = .25;
      }
    }
    bake(room); toonify(room, .04);
  }
  // the cage: a see-through blocky globe with dark edges, turning slowly, with balls tumbling inside
  const CAGE = new THREE.Vector3(0, 1.66, -.25), CR = .98;
  const cageGeo = new THREE.IcosahedronGeometry(CR + .06, 1);
  const cage = new THREE.Group(); cage.position.copy(CAGE); scene.add(cage);
  const glass = new THREE.Mesh(cageGeo, new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: .2, roughness: .3, flatShading: true, depthWrite: false })); glass.renderOrder = 2; cage.add(glass);
  const edgesGeo = new THREE.EdgesGeometry(cageGeo), wires = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .55 })); cage.add(wires);
  const ballGeo = new THREE.IcosahedronGeometry(1, 2);
  const N_IN = small ? 14 : 20;
  const tumble = new THREE.InstancedMesh(ballGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), N_IN); scene.add(tumble); // unlit, so the colours are exactly the card's
  const tb = Array.from({ length: N_IN }, (_, i) => ({ p: new THREE.Vector3((Math.random() - .5), -.5 + Math.random() * .3, (Math.random() - .5)).multiplyScalar(.8), v: new THREE.Vector3(), c: new THREE.Color(BALL_COLS[i % 5]) }));
  tb.forEach((b, i) => tumble.setColorAt(i, b.c));
  const dummy = new THREE.Object3D();
  let stir = 0; // how hard the machine is blowing: jumps on every call, then settles

  // the owl that calls the numbers
  const owl = new THREE.Group(); owl.position.set(0, 2.85, -.25); scene.add(owl);
  let owlPet = null, owlHop = 0;
  try {
    owlPet = petModel('cupcowl', 2);
    const bb = new THREE.Box3().setFromObject(owlPet), size = bb.getSize(new THREE.Vector3()), k = 1.15 / Math.max(size.x, size.y, size.z, .01);
    owlPet.scale.multiplyScalar(k); owlPet.position.y = -bb.min.y * k; owl.add(owlPet);
    owl.traverse(o => { if (o.isMesh) o.castShadow = true; });
  } catch (e) { console.warn('no caller pet', e); }

  // ---------- the called balls: the newest on the stand, earlier ones on the rail ----------
  const labelGeo = new THREE.CircleGeometry(.72, 20);
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const shown = []; // newest first
  const texOf = new Map();
  function makeBall(n) {
    const g = new THREE.Group();
    // mostly self-lit: the ball shows the very colour of its column on the card (plain lighting turned orange into brown), with only a hint of shading
    const col = new THREE.Color(BALL_COLS[colOf(n)]);
    const body = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(.22), emissive: col, emissiveIntensity: .82, roughness: .6, flatShading: true })); body.castShadow = true; g.add(body);
    const ink = new THREE.Mesh(ballGeo, inkMat); ink.scale.setScalar(1.08); g.add(ink);
    let tex = texOf.get(n); if (!tex) texOf.set(n, tex = labelTex(n));
    const lab = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true })); lab.renderOrder = 3; g.add(lab);
    scene.add(g);
    return { n, g, body, lab, r: .2, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, dur: .6, pop: 0, spin: Math.random() * 6 };
  }
  function freeBall(b) { scene.remove(b.g); b.body.material.dispose(); b.lab.material.dispose(); }
  function moveBall(b, to, r, dur, fromPos) {
    b.from.copy(fromPos || b.g.position); b.to.copy(to); b.r0 = b.r; b.r1 = r; b.t = reduced ? 1 : 0; b.dur = dur; b.t0 = performance.now();
    if (reduced) { b.g.position.copy(to); b.r = r; }
  }
  function layoutBalls(animate) {
    shown.forEach((b, i) => {
      const to = i === 0 ? STAND : railAt(i - 1), r = i === 0 ? .44 : .27;
      if (!animate) { b.g.position.copy(to); b.r = b.r0 = b.r1 = r; b.t = 1; }
      else if (!b.to.equals(to)) moveBall(b, to, r, .5);
    });
  }

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  // You sit at the front. A rival right behind the machine would be hidden by it, so everyone shifts round a
  // little: most at the back (half a radian), less and less toward the front.
  const seatAngle = r => { const a = r * Math.PI * 2 / n; return Math.PI / 2 + a + (r ? .52 * (1 - Math.abs(a - Math.PI) / Math.PI) : 0); };
  const onRim = (r, k = 1) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, 0, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  const cardGeo = new THREE.PlaneGeometry(.92, .92); cardGeo.rotateX(-Math.PI / 2);
  function paintCard(s, mask, color) {
    const g = s.ctx; g.clearRect(0, 0, 80, 80);
    g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(1, 1, 78, 78, 9); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    for (let c = 0; c < 25; c++) {
      const x = 12 + (c % 5) * 14, y = 12 + (c / 5 | 0) * 14, on = mask & 1 << c;
      g.fillStyle = on ? color : '#e6d7c6'; g.beginPath(); g.arc(x, y, on ? 5.6 : 3.6, 0, 6.3); g.fill();
    }
    s.tex.needsUpdate = true;
  }
  function freeSeat(s) { scene.remove(s.av, s.stool, s.card); disposeAvatar(s.av); s.tex.dispose(); s.card.material.dispose(); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), out = onRim(r, 1.4), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const cv = document.createElement('canvas'); cv.width = cv.height = 80;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const at = onRim(r, .8), card = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      card.position.set(at.x, .06, at.z); card.rotation.y = -seatAngle(r) + Math.PI / 2; card.visible = !mine; scene.add(card);
      return { av, stool, card, tex, ctx: cv.getContext('2d'), mask: -1, mine, hop: 0, joy: 0, key: p.color + (p.av || []).join(''), color: p.color };
    });
  }

  // ---------- state from the server ----------
  let S = null, gid = '', T = 0, winN = 0;
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) buildSeats(list);
      else list.forEach((p, i) => { // someone took over a bot: swap that avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1; s.key = k; s.color = p.color; s.mask = -1;
      });
    }
    const fresh = st.gid !== gid;
    if (fresh) { gid = st.gid; for (const b of shown) freeBall(b); shown.length = 0; winN = st.wins.length; }
    seats.forEach((s, i) => { if (s.mask !== st.masks[i]) { if (!fresh && s.mask >= 0 && count(st.masks[i]) > count(s.mask)) s.hop = Math.max(s.hop, .25); s.mask = st.masks[i]; paintCard(s, s.mask, s.color); } s.joy = st.ph === 'play' && st.go[i] <= 1 ? 1 : 0; });
    // the balls: keep the newest RAIL + 1
    const want = st.called.slice(-(RAIL + 1)).reverse(), have = shown.map(b => b.n).join();
    if (want.join() !== have) {
      const newest = want[0], isNew = shown.length && want[1] === shown[0].n && !fresh;
      if (isNew) {
        const b = makeBall(newest); shown.unshift(b);
        while (shown.length > RAIL + 1) freeBall(shown.pop());
        layoutBalls(true);
        b.g.position.copy(MOUTH); b.r = .2; moveBall(b, STAND, .44, .75, MOUTH); b.pop = 1;
        stir = 1; owlHop = 1;
      } else {
        for (const b of shown) freeBall(b); shown.length = 0;
        for (const x of want) shown.push(makeBall(x));
        layoutBalls(false);
        if (!fresh && shown.length === 1) { const b = shown[0]; b.g.position.copy(MOUTH); b.r = .2; moveBall(b, STAND, .44, .75, MOUTH); b.pop = 1; stir = 1; owlHop = 1; }
      }
    }
    // a prize was won: confetti over the winner
    if (st.wins.length > winN) {
      const w = st.wins[st.wins.length - 1], s = seats[w.s];
      if (s) { s.hop = 1; const at = onRim(rel(w.s), 1.4); pfx.confetti(new THREE.Vector3(at.x * .8, 2.2, at.z * .8), { n: 80, w: 3, h: 2.4, s: w.s }); shake.kick(.12); }
      owlHop = 1;
    }
    winN = st.wins.length;
    S = st;
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, hudRight = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, .4, -.1);
  const DIR = new THREE.Vector3(0, 1.05, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function placeCam(D) { camera.position.copy(DIR).multiplyScalar(D).add(camLook); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const avail = Math.max(200, w - hudRight), portrait = avail / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 150 : 104, bottom = Math.max(top + 120, h - hudBottom), side = portrait ? R * 1.25 : R * 1.4 + 2.1;
    const FIT = [new THREE.Vector3(0, 3.9, -R * 1.2), new THREE.Vector3(0, .1, R * .98), new THREE.Vector3(-side, 1, 0), new THREE.Vector3(side, 1, 0)];
    let lo = 4, hi = 90;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; placeCam(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && rx - lx <= avail - 8) hi = D; else lo = D;
    }
    placeCam(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, hudRight / 2, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let dead = false;
  const tv = new THREE.Vector3();
  const info = { tags: [] };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    // the cage turns and the balls inside bounce about: a little all the time, a lot right after a call
    stir = Math.max(0, stir - dt * .9);
    const live = S && S.ph === 'play' ? 1 : .25, power = (2.2 + stir * 7) * live;
    cage.rotation.y += dt * (.35 + stir * 2.4) * live; cage.rotation.x = Math.sin(T * .7) * .08;
    for (let i = 0; i < N_IN; i++) {
      const b = tb[i];
      b.v.y -= 9 * dt;
      if (b.p.y < -.45 && Math.random() < dt * power) { b.v.set((Math.random() - .5) * 3, 2.2 + Math.random() * (2 + stir * 3), (Math.random() - .5) * 3); }
      b.p.addScaledVector(b.v, dt);
      const d = b.p.length(), lim = CR - .17;
      if (d > lim) { // bounce off the inside of the globe
        b.p.multiplyScalar(lim / d); tv.copy(b.p).normalize(); const vn = b.v.dot(tv);
        if (vn > 0) b.v.addScaledVector(tv, -1.6 * vn); b.v.multiplyScalar(.86);
      }
      dummy.position.copy(CAGE).add(b.p); dummy.scale.setScalar(.15); dummy.rotation.set(T * 2 + i, i, 0); dummy.updateMatrix(); tumble.setMatrixAt(i, dummy.matrix);
    }
    tumble.instanceMatrix.needsUpdate = true;
    // the caller hops on every ball
    owlHop = Math.max(0, owlHop - dt * 2.4);
    owl.position.y = 2.85 + Math.abs(Math.sin(owlHop * Math.PI * 2)) * .3 * owlHop;
    owl.rotation.y = Math.sin(T * .6) * .25;
    if (owlPet) wiggle(owlPet, T, 3, owlHop);
    // called balls
    shown.forEach((b, i) => {
      if (b.t < 1) {
        b.t = Math.min(1, (performance.now() - b.t0) / (b.dur * 1000)); // by the clock, so a slow device still gets every ball to its place
        const e = 1 - (1 - b.t) ** 3;
        b.g.position.lerpVectors(b.from, b.to, e);
        b.g.position.y += Math.sin(b.t * Math.PI) * (b.pop ? .9 : .35);
        b.r = b.r0 + (b.r1 - b.r0) * e;
        if (b.t >= 1 && b.pop) { b.pop = 0; pfx.burst(tv.copy(b.to), { n: 10, colors: [BALL_COLS[colOf(b.n)], '#ffffff', '#ffd84a'], speed: 2, up: 2.6, size: .22, life: .6, shape: STAR }); }
      } else if (i === 0) b.g.position.y = b.to.y + Math.sin(T * 2.2) * .04;
      b.g.scale.setScalar(b.r);
      b.lab.quaternion.copy(camera.quaternion); // the number always faces you
      b.lab.position.set(0, 0, 0).addScaledVector(tv.copy(camera.position).sub(b.g.position).normalize(), 1.02);
    });
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      animateAvatar(s.av, T, { seed: i, active: s.joy > 0, hop: s.hop, look: 0 });
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .14), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, mine: false };
      tv.copy(onRim(r, 1.4)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
    });
    info.tags.length = seats.length;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    setHud(px) { if (Math.abs(px - hudBottom) > 6) { hudBottom = px; resize(true); } },
    setInset(px) { if (px !== hudRight) { hudRight = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.tex.dispose(); s.card.material.dispose(); }
      for (const b of shown) freeBall(b);
      for (const t of texOf.values()) t.dispose();
      pfx.dispose(); inkMat.dispose(); glass.material.dispose(); wires.material.dispose(); tumble.material.dispose();
      for (const g of [cageGeo, edgesGeo, ballGeo, labelGeo, cardGeo]) g.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

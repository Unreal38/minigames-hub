// Pip Party 3D table (three.js): a round wooden table with a felt dice tray on a sky island, everyone's avatar on a
// stool round it. The player whose turn it is throws the five dice into the tray from their seat; kept dice slide
// into a row at the front of the tray. Purely visual: it draws what the server sends, and reports which die you tap.
import * as THREE from 'three';
import { diceKit } from '../../dice3d.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, nightScene, roundDeck } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk, easeRefit } from '../../camfit.js';
import { playArea, disc } from '../../nametag.js';

const INK = '#4a2c22', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 2.95;           // table radius
const DIE = .6;          // die edge
const TRAY_W = 3.9, TRAY_D = 2.9;
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });

// ---------- dice ----------
// Each die's look (shape, face art, pips) is the roller's dice skin (dice3d.js); SIDE is the value on +x, -x, +y, -y, +z, -z.
const SIDE = [2, 5, 1, 6, 3, 4];
const UP = [null, [0, 0, 0], [0, 0, Math.PI / 2], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2], [Math.PI, 0, 0]];
const _e = new THREE.Euler(), _yaw = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
const faceUpQ = (q, v, yaw = 0) => q.setFromEuler(_e.set(...UP[v])).premultiply(_yaw.setFromAxisAngle(Y, yaw));

// where the loose dice come to rest in the tray, and the row of kept dice along the front
const LOOSE = [[-1.25, -.75], [0, -.95], [1.25, -.7], [-.62, -.05], [.66, .02]];
const keptAt = k => [-1.44 + k * .72, 1.02];

export function createScene(canvas, { onFrame, onPick } = {}) {
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
  const cloudRing = clouds({ min: 22, max: 90, below: -12, seed: 3 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(15, 15, { round: true, rim: 4.4, seed: 9, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  {
    // a round deck of planks with a picnic look: checked blanket corners, lanterns on poles
    room.add(roundDeck(7.6, { wood: '#d9a066', seam: '#b97f4c', rim: '#a86a42', pitch: 1.15 }));
    // table: a thick plank top on a barrel, with a sunny yellow edge
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    const edge = new THREE.TorusGeometry(R + .4, .08, 6, 28); edge.rotateX(Math.PI / 2); put(edge, M('#ffc94d'), 0, 0, 0);
    const cloth = put(new THREE.CylinderGeometry(R + .12, R + .12, .04, 28), M('#fff1d6'), 0, .0, 0); cloth.receiveShadow = true;
    const band = new THREE.TorusGeometry(R - .12, .035, 5, 28); band.rotateX(Math.PI / 2); put(band, M('#7ed3b2'), 0, .02, 0);
    put(new THREE.CylinderGeometry(1.25, 1.05, 2, 14), M('#a86a42'), 0, -1.32, 0).castShadow = true;
    for (const y of [-.7, -1.9]) { const h = new THREE.TorusGeometry(y < -1 ? 1.13 : 1.24, .07, 5, 14); h.rotateX(Math.PI / 2); put(h, M('#5b4636'), 0, y, 0); }
    // the dice tray: a wooden frame round a raspberry felt
    const felt = put(new THREE.BoxGeometry(TRAY_W, .06, TRAY_D), M('#c94f6d'), 0, .03, 0); felt.receiveShadow = true;
    const fr = M('#8a5a3c');
    for (const z of [-1, 1]) put(new THREE.BoxGeometry(TRAY_W + .36, .26, .18), fr, 0, .13, z * (TRAY_D / 2 + .09)).castShadow = true;
    for (const x of [-1, 1]) put(new THREE.BoxGeometry(.18, .26, TRAY_D), fr, x * (TRAY_W / 2 + .09), .13, 0).castShadow = true;
    put(new THREE.BoxGeometry(TRAY_W - .3, .005, .05), M('#ffd6e0'), 0, .065, .6); // the line the kept dice sit behind
    // lantern poles round the deck
    for (const [x, z, c] of [[-6.4, -2.2, '#ffd84a'], [6.4, -2.2, '#ff8fab'], [0, -6.9, '#7ed3b2']]) {
      put(new THREE.CylinderGeometry(.07, .09, 3.6, 6), M('#8a5a3c'), x, -.6, z).castShadow = true;
      put(new THREE.BoxGeometry(.42, .5, .42), M(c, { emissive: c, emissiveIntensity: .35 }), x, 1.35, z);
      put(new THREE.ConeGeometry(.36, .25, 4), M('#5b4636'), x, 1.72, z).rotation.y = Math.PI / 4;
    }
    // a picnic basket and two giant dice lying on the deck
    const basket = new THREE.Group(); basket.position.set(5.6, -2.34, 1.6); basket.rotation.y = -.5; basket.scale.setScalar(.8); room.add(basket);
    put(new THREE.BoxGeometry(1.3, .7, .9), M('#c99763'), 0, .35, 0, basket).castShadow = true;
    put(new THREE.BoxGeometry(1.36, .12, .96), M('#e5543b'), 0, .72, 0, basket);
    const handle = new THREE.TorusGeometry(.45, .05, 5, 12, Math.PI); put(handle, M('#8a5a3c'), 0, .75, 0, basket);
    bake(room); toonify(room, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- the five dice ----------
  const kit = diceKit({ side: SIDE });
  const dieMat = kit.mat(0), dieGeo = kit.geo(0, DIE);
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd84a', side: THREE.BackSide, transparent: true, opacity: .95 });
  const dice = Array.from({ length: 5 }, (_, k) => {
    const m = new THREE.Mesh(dieGeo, dieMat); m.castShadow = true;
    const ink = new THREE.Mesh(dieGeo, inkMat); ink.scale.setScalar(1.1); m.add(ink);
    const glow = new THREE.Mesh(dieGeo, glowMat); glow.scale.setScalar(1.24); glow.visible = false; m.add(glow);
    m.userData.k = k; m.visible = false; scene.add(m);
    return { m, glow, v: 1, held: false, from: new THREE.Vector3(), to: new THREE.Vector3(), q0: new THREE.Quaternion(), q1: new THREE.Quaternion(),
      axis: new THREE.Vector3(1, 0, 0), spin: 0, t0: 0, dur: 0, flying: false, hop: 0, yaw: 0, slide: 0 };
  });
  const rollRing = new THREE.TorusGeometry(.6, .04, 5, 24); rollRing.rotateX(Math.PI / 2);

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const onRim = (r, k = 1) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, 0, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  // the turn ring: a flat, smooth band round the player's middle, just above the table top, so the table edge never cuts it
  // (the old tube sat on the table rim, half over the table and half in the air, and came out lumpy)
  const ringGeo = new THREE.RingGeometry(.86, 1, 72); ringGeo.rotateX(-Math.PI / 2);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), out = onRim(r, 1.4), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), out.x, .14, out.z, scene); ring.visible = !mine; // your own turn is shown by the dock
      return { av, stool, ring, mine, hop: 0, look: 0, active: false, key: p.color + (p.av || []).join(''), hand: onRim(r, 1.15).setY(1.1) };
    });
  }

  // ---------- state from the server ----------
  let S = null, rollKey = '', turnKey = '', pickKey = '', T = 0;
  const yawOf = k => Math.sin(k * 7.3 + 1.1) * .35;
  function place(d, k, held) { const [x, z] = held ? keptAt(k) : LOOSE[k]; return d.to.set(x, DIE / 2 + .06, z); }
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) buildSeats(list);
      else list.forEach((p, i) => { // someone took over a bot: swap that avatar
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1; s.key = k;
      });
    }
    const now = performance.now();
    list.forEach((p, i) => { seats[i].active = st.turn === i && st.stage === 'turn'; });
    const tk = st.gid + '/' + st.round + '/' + st.turn;
    const skin = st.turn >= 0 ? list[st.turn]?.fl?.dc | 0 : 0;
    if (tk !== turnKey) { turnKey = tk; if (st.stage === 'turn' && !st.rolls) for (const d of dice) d.m.visible = false; }
    // a new roll: the moved dice fly in from the roller's hand and tumble onto the felt
    const rk = st.gid + '/' + st.rollN;
    if (st.rolls && rk !== rollKey) {
      const fresh = !rollKey.startsWith(st.gid + '/') || st.rollAgo > st.ms.roll; rollKey = rk;
      const hand = seats[st.turn]?.hand || new THREE.Vector3(0, 2, 3);
      if (seats[st.turn]) seats[st.turn].hop = .8;
      dice.forEach((d, k) => {
        d.v = st.dice[k]; d.held = !!st.held[k]; kit.dress(d.m, skin, DIE);
        const moved = st.moved.includes(k);
        if (!moved && d.m.visible) return;
        d.yaw = yawOf(k + st.rollN); place(d, k, d.held); faceUpQ(d.q1, d.v, d.yaw);
        d.m.visible = true;
        if (reduced || fresh && st.rollAgo > st.ms.roll) { d.m.position.copy(d.to); d.m.quaternion.copy(d.q1); d.flying = false; return; }
        d.from.copy(hand).add(new THREE.Vector3((k - 2) * .18, k * .05, 0));
        d.axis.set(Math.random() - .5, Math.random() * .3, Math.random() - .5).normalize();
        d.spin = 9 + Math.random() * 6; d.t0 = now - Math.max(0, st.rollAgo) + k * 35; d.dur = st.ms.roll * .78 - k * 35; d.flying = true;
        d.q0.random(); d.m.position.copy(d.from);
      });
      if (!fresh) shake.kick(.05);
    } else if (st.rolls) {
      // holds changed: slide kept dice to the front row and back
      dice.forEach((d, k) => {
        kit.dress(d.m, skin, DIE);
        const h = !!st.held[k]; if (h === d.held) return;
        d.held = h; if (d.flying) return;
        d.from.copy(d.m.position); place(d, k, h); d.slide = 1; d.hop = .5;
      });
    }
    // a box was written: the dice jump and sparkle
    const pk = st.last ? st.gid + '/' + st.last.s + '/' + st.last.box + '/' + st.round : '';
    if (pk && pk !== pickKey) {
      const late = st.last.ago > 600; pickKey = pk;
      if (!late && st.stage === 'pick') {
        const good = st.last.pts > 0;
        for (const d of dice) if (d.m.visible) { d.hop = 1; if (good) pfx.burst(d.m.position, { n: 6, colors: [...kit.sparks(list[st.last.s]?.fl?.dc).slice(0, 2), list[st.last.s]?.color || '#ff8fab'], speed: 1.6, up: 2.4, size: .2, life: .6, shape: STAR }); }
        if (st.last.box === 'gen' && st.last.pts || st.last.bonus) { pfx.confetti(new THREE.Vector3(0, 1.4, 0), { n: 70, w: 3, h: 2.4, s: st.last.s }); shake.kick(.14); }
        if (seats[st.last.s]) seats[st.last.s].hop = good ? 1 : .3;
      }
    }
    S = st;
  }

  // ---------- picking a die with the pointer ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hover = -1, canPick = false;
  function hit(e) {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(dice.filter(d => d.m.visible).map(d => d.m), false)[0];
    return h ? h.object.userData.k : -1;
  }
  const onMove = e => { const k = canPick ? hit(e) : -1; if (k !== hover) { hover = k; canvas.style.cursor = k >= 0 ? 'pointer' : ''; } };
  const onDown = e => { if (!canPick) return; const k = hit(e); if (k >= 0) { e.preventDefault(); onPick?.(k); } };
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown);

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, hudRight = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, -.1);
  const DIR = new THREE.Vector3(0, 1.15, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function placeCam(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1, avail = w - hudRight;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 140 : 100, bottom = Math.max(top + 120, h - hudBottom), side = portrait ? R * .95 : R * 1.4 + .9;
    const FIT = [new THREE.Vector3(0, 3.1, -R * 1.4), new THREE.Vector3(0, .3, R * .75), new THREE.Vector3(-side, 1, 0), new THREE.Vector3(side, 1, 0)];
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
  const tv = new THREE.Vector3(), tq = new THREE.Quaternion();
  const playTop = disc(R + .45, -.02, { h: .45 }); // the table top and the cards/dice on it: name tags keep off it
  const info = { tags: [] };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const now = performance.now(), k = 1 - Math.exp(-dt * 12);
    canPick = !!S && S.stage === 'turn' && S.turn === S.me && S.me >= 0 && S.rolls > 0 && S.rolls < 3 && !S.auto && !S.seats[S.me]?.bot;
    for (const d of dice) {
      if (!d.m.visible) continue;
      if (d.flying) {
        const t = Math.min(1, (now - d.t0) / d.dur);
        if (t < 0) { d.m.position.copy(d.from); continue; }
        // a throw: an arc from the hand, then two small bounces on the felt
        const e = 1 - (1 - t) ** 2;
        d.m.position.lerpVectors(d.from, d.to, Math.min(1, e * 1.05));
        const air = t < .62 ? Math.sin(t / .62 * Math.PI) * 1.5 + (1 - t / .62) * (d.from.y - d.to.y) * 0 : t < .84 ? Math.sin((t - .62) / .22 * Math.PI) * .35 : Math.sin((t - .84) / .16 * Math.PI) * .09;
        d.m.position.y = d.to.y + Math.max(0, air) + (t < .62 ? (1 - t / .62) * (d.from.y - d.to.y) : 0);
        tq.setFromAxisAngle(d.axis, (1 - t) ** 2 * d.spin);
        d.m.quaternion.copy(d.q1).premultiply(tq);
        if (t >= 1) { d.flying = false; d.m.position.copy(d.to); d.m.quaternion.copy(d.q1); pfx.puff(tv.copy(d.to).setY(.08), { n: 4, color: ['#ffd6e0', '#ffffff'], size: .22, speed: 1.2 }); }
        else if (t > .62 && !d.landed) { d.landed = true; }
        if (t < .62) d.landed = false;
        continue;
      }
      if (d.slide > 0) { d.slide = Math.max(0, d.slide - dt * 4); d.m.position.lerpVectors(d.to, d.from, d.slide ** 2); }
      d.hop = Math.max(0, d.hop - dt * 2.6);
      d.m.position.y = d.to.y + Math.sin(d.hop * Math.PI) * .5;
      const want = d.held ? 1.06 : 1;
      d.m.scale.setScalar(d.m.scale.x + (want + (hover === d.m.userData.k && canPick ? .08 : 0) - d.m.scale.x) * k);
      d.glow.visible = d.held;
    }
    const turnSeat = S?.stage === 'turn' ? S.turn : -1;
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2.2);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      let look = 0;
      if (turnSeat >= 0 && turnSeat !== i) { const dd = ((rel(turnSeat) - rel(i) + n) % n) / n; look = dd < .5 ? .5 : -.5; }
      s.look += (look - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active, hop: s.hop, look: s.look });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1 + Math.sin(T * 4) * .03);
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
    tv.set(0, .3, 0).project(camera); info.tray = { x: (tv.x + 1) / 2 * W, y: (1 - tv.y) / 2 * H };
    playArea(camera, W, H, playTop);
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    setHud(px) { const fit = hudFitOk(canvas), grew = px > hudBottom + 6; if ((Math.abs(px - hudBottom) > 6) && (fit || grew)) { hudBottom = px; fit ? resize(true) : easeRefit(camera, camBase, camLook, () => resize(true)); } }, // a HUD growing mid-game eases the camera out (camfit.js)
    setInset(px) { if ((px !== hudRight) && hudFitOk(canvas)) { hudRight = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      pfx.dispose(); kit.dispose(); inkMat.dispose(); glowMat.dispose();
      for (const g of [ringGeo, rollRing]) g.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

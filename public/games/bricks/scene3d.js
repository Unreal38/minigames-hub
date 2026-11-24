// Sky Bricks 3D view (three.js): your well stands on a sky island with your avatar perched on its corner post, and
// everyone else's well floats beside it, smaller, with their avatar on top. Purely visual: the browser's own game
// (client.js) and the server decide where every brick is; this draws them, plus the bursts, stones and wobble.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, DOT, nightScene, isNight, disposeToon } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { W, VIS, H, ROT, SHAPES, STONE, decode } from './rules.js';

const INK = '#3b2219', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
export const PAL = [null, '#ff8fab', '#c8e66b', '#9aa8ff', '#ffb547', '#59d6c2', '#ff7a59', '#c59bff', '#6fc8f0', '#ffd84a', '#a7a2b3'];
const GREY = ['#c9c5d2', '#b5b0c0'];
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const FOV = 30, Y0 = -1.3, Y1 = VIS + 3.9, HALF = W / 2 + 1.1; // the picture is fitted to Y0..Y1; HALF: half the big well with its posts
const AV_BIG = 1.15, AV_MINI = 2, FEET = .76, AV_H = 2.6; // AV_H: how tall an avatar stands at scale 1

// the back wall of a well: soft stripes, one a column
function wallTexture() {
  const cv = document.createElement('canvas'); cv.width = W * 16; cv.height = VIS * 16; const g = cv.getContext('2d');
  for (let x = 0; x < W; x++) { g.fillStyle = x % 2 ? '#343e7c' : '#3a4587'; g.fillRect(x * 16, 0, 16, cv.height); }
  g.fillStyle = '#ffffff10'; for (let y = 0; y < VIS; y++) g.fillRect(0, y * 16, cv.width, 1);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}

export function createScene(canvas, { onFrame, step } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 80, 260);
  const camera = new THREE.PerspectiveCamera(FOV, 1, .5, 600);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(6, 14, 16); scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 26, max: 100, below: -14 }); scene.add(cloudRing);
  const land = island(W + 6, 3.4, { seed: 5, props: 12, size: 1.3, flowers: 40, rim: 2.2 }); land.position.set(0, -.95, -.4); scene.add(land);
  nightScene(scene);
  // at night the bricks keep their colours: a lamp of their own, added after nightScene so the moonlight leaves it alone
  const lamp = new THREE.DirectionalLight('#fff6e6', 0); lamp.position.set(0, 6, 20); scene.add(lamp);
  const flyBirds = birds(scene, 60, 16, 4, 1.8), drift = petals(scene, 26, 9, { n: small ? 6 : 10 });
  const pfx = createFx(scene), shake = shaker();
  const wallTx = wallTexture();

  // ---------- one well: frame, back wall, the "stone lines coming" bar, and its owner's avatar ----------
  function makeWell() {
    const g = new THREE.Group(), deco = new THREE.Group(); g.add(deco);
    const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); deco.add(m); return m; };
    const px = W / 2 + .45;
    put(new THREE.BoxGeometry(W + 2.1, .8, 1.8), M('#a86a42'), 0, -.4, 0);
    put(new THREE.BoxGeometry(W + 2.5, .22, 2.1), M('#c98a52'), 0, -.84, 0);
    for (const s of [-1, 1]) { put(new THREE.BoxGeometry(.7, VIS + .3, 1.3), M('#b9794a'), s * px, VIS / 2 + .15, 0); put(new THREE.BoxGeometry(1, .34, 1.6), M('#d9a066'), s * px, VIS + .47, 0); }
    put(new THREE.BoxGeometry(W + .2, VIS + .2, .25), M('#333d78'), 0, VIS / 2, -.72);
    bake(deco); toonify(deco, .045);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, VIS), new THREE.MeshBasicMaterial({ map: wallTx })); wall.position.set(0, VIS / 2, -.585); g.add(wall);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.34, 1, .2).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color: '#ff4f5e' })); bar.position.set(-px, 0, .72); bar.visible = false; g.add(bar);
    const avG = new THREE.Group(); g.add(avG);
    scene.add(g);
    return { g, deco, wall, bar, avG, av: null, key: '', x: 0, y: 0, s: 1, seat: -1, hop: 0, nod: 0, barH: 0, dead: false, rows: null, str: null, bob: Math.random() * 6 };
  }
  function freeWell(w) { scene.remove(w.g); if (w.av) disposeAvatar(w.av); disposeToon(w.deco); w.wall.geometry.dispose(); w.wall.material.dispose(); w.bar.geometry.dispose(); w.bar.material.dispose(); }

  // ---------- every block in the scene is one instanced box (and one inside-out copy for its dark outline) ----------
  const MAXN = 6 * W * H + 80;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cells = new THREE.InstancedMesh(boxGeo, toonMat(M('#ffffff')), MAXN); cells.frustumCulled = false;
  const hulls = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), MAXN); hulls.frustumCulled = false;
  const ghosts = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .26, depthWrite: false }), 8); ghosts.frustumCulled = false; ghosts.renderOrder = 2;
  scene.add(hulls, cells, ghosts);
  const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), col = new THREE.Color();
  const cols = PAL.map(c => (c ? new THREE.Color(c) : null)), greys = GREY.map(c => new THREE.Color(c)), white = new THREE.Color('#ffffff');
  let n = 0;
  function block(x, y, size, c, z = 0, mix = 0) {
    if (n >= MAXN) return;
    pv.set(x, y, z);
    cells.setMatrixAt(n, mtx.compose(pv, q0, sv.setScalar(size * .88)));
    hulls.setMatrixAt(n, mtx.compose(pv, q0, sv.setScalar(size * 1.0)));
    cells.setColorAt(n, mix ? col.copy(c).lerp(white, mix) : c); n++;
  }
  // a spare brick drawn on its own (the one set aside, the ones coming next), centred on (x, y)
  function loose(k, x, y, size, dim) {
    const c = SHAPES[k].c; let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const [cx, cy] of c) { x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); }
    for (const [cx, cy] of c) block(x + (cx - (x0 + x1) / 2) * size, y + (cy - (y0 + y1) / 2) * size, size, dim ? greys[0] : cols[k + 1], .2);
  }

  // ---------- who sits where ----------
  let wells = [], seats = [], focus = 0, S = null, mine = null, layoutKey = '';
  let cw = 0, ch = 0, hudTop = 64, hudBottom = 24, hudCorner = 0, unit = 1, ps = .7, holdAt = new THREE.Vector3(), nextAt = new THREE.Vector3();
  const camLook = new THREE.Vector3(), camBase = new THREE.Vector3();
  const vis = { x: 0, y: 0, k: -1 }; // where the falling brick is drawn (it glides to where it really is)

  function setSeats(list, f) {
    const key = list.map(p => p.color + '|' + (p.av || []).join('')).join('/') + '#' + f;
    seats = list; focus = f;
    if (key === layoutKey) return; layoutKey = key;
    while (wells.length > list.length) freeWell(wells.pop());
    while (wells.length < list.length) wells.push(makeWell());
    list.forEach((p, i) => {
      const w = wells[i], k = p.color + (p.av || []).join('') + (i === f);
      w.seat = i;
      if (w.key !== k) {
        w.key = k; if (w.av) { w.avG.remove(w.av); disposeAvatar(w.av); }
        w.av = avatar3d(p.color, p.av, { pose: 'stand' }); w.avG.add(w.av);
        const sc = i === f ? AV_BIG : AV_MINI; w.avG.scale.setScalar(sc); w.avG.position.set(-(W / 2 + .45), VIS + .64 + FEET * sc, .1);
      }
    });
    resize(true);
  }

  // Fit n small wells into a box: as big as they go, in however many columns that takes.
  function pack(aw, ah, k) {
    let best = { m: 0, c: 1, rows: k };
    for (let c = 1; c <= k; c++) { const rows = Math.ceil(k / c), m = Math.min(.6, (aw / c - .5) / (W + 2.5), (ah / rows - 1.1) / (VIS + 1.2 + AV_H * AV_MINI)); if (m > best.m) best = { m, c, rows }; }
    return best;
  }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === cw && h === ch && !force) return; cw = w; ch = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const availH = Math.max(200, h - hudTop - hudBottom), HT = Y1 - Y0, MINC = 2.5;
    let colW = (HT * w / availH - HALF * 2) / 2 - .2;
    if (colW >= MINC) { colW = Math.min(colW, 12); unit = HT / availH; } else { colW = MINC; unit = (HALF * 2 + MINC * 2 + .4) / w; }
    unit *= 1.02;
    ps = Math.max(.44, Math.min(.78, (colW - .5) / 4.2));
    const strip = 4.2 * ps + .5, xs = HALF + strip / 2; // the strip beside the well for the spare bricks
    holdAt.set(-xs, VIS - .2, 0); nextAt.set(xs, VIS - .2, 0);
    const holdH = 1.2 + 2.6 * ps, nextH = 1.2 + 7.6 * ps;
    // the other wells: beside the spare bricks if the screen is wide, under them if not
    const others = seats.map((_, i) => i).filter(i => i !== focus), nL = Math.ceil(others.length / 2);
    const side = (list, sgn, zoneH) => {
      if (!list.length) return;
      const top = Y1 - .2, bot = Y0 + .2 + (sgn > 0 ? Math.max(0, hudCorner - hudBottom) * unit : 0);
      const A = pack(colW - strip, top - bot, list.length), B = pack(colW, VIS - zoneH - bot, list.length);
      const useA = A.m >= B.m, P = useA ? A : B, aw = useA ? colW - strip : colW, x0 = HALF + (useA ? strip : 0), yTop = useA ? top : VIS - zoneH, ah = yTop - bot;
      const cwid = aw / P.c, chgt = ah / P.rows, used = (VIS + 1.2 + AV_H * AV_MINI) * P.m + 1.1;
      list.forEach((i, k) => {
        const c = k % P.c, r = (k / P.c) | 0, wl = wells[i];
        wl.s = P.m; wl.x = sgn * (x0 + cwid * (c + .5)); wl.y = yTop - chgt * r - (chgt - used) / 2 - used + 1.1 + .95 * P.m;
      });
    };
    side(others.slice(0, nL), -1, holdH); side(others.slice(nL), 1, nextH);
    const fw = wells[focus]; if (fw) { fw.s = 1; fw.x = 0; fw.y = 0; }
    for (const wl of wells) { wl.g.position.set(wl.x, wl.y, 0); wl.g.scale.setScalar(wl.s); }
    const cy = (Y0 + Y1) / 2, lookY = cy - (hudBottom - hudTop) / 2 * unit, D = h * unit / (2 * Math.tan(FOV * Math.PI / 360));
    camLook.set(0, lookY, 0); camBase.set(0, lookY + D * .05, D);
    camera.position.copy(camBase); camera.lookAt(camLook);
    scene.fog.near = D + 40; scene.fog.far = D + 260;
  }

  // ---------- what the server says (every well) and what this browser is playing (your own) ----------
  function setState(st) {
    S = st;
    st.b.forEach((str, i) => { const w = wells[i]; if (!w) return; if (w.str !== str) { w.str = str; w.rows = decode(str || ''); } w.dead = !!st.x[i][0]; });
  }
  function setMine(m) { mine = m; if (m?.P && vis.k !== m.P.id) { vis.k = m.P.id; vis.x = m.P.x; vis.y = m.P.y; } }

  // ---------- effects ----------
  const wp = new THREE.Vector3();
  const at = (w, x, y, z = .6, v = wp) => v.set(w.x + (x - W / 2) * w.s, w.y + y * w.s, z);
  const flashes = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 3; scene.add(m); return { m, t: 1 }; });
  let flashI = 0;
  function cleared(seat, rows, kind = 1) {
    const w = wells[seat]; if (!w) return;
    const big = seat === focus, list = Array.isArray(rows) ? rows : null, cnt = list ? list.length : rows;
    if (list) list.forEach((y, k) => {
      const f = flashes[flashI++ % flashes.length]; f.t = 0; f.m.visible = true; f.m.position.set(w.x, w.y + (y + .5) * w.s, .55); f.m.scale.setScalar(w.s);
      if (!reduced) for (let x = 0; x < W; x += 1) pfx.burst(at(w, x + .5, y + .5), { n: 3, colors: PAL.slice(1, 10), speed: 3.5, up: 2.5, size: .34 * w.s + .08, life: .7, shape: [STAR, DOT] });
    });
    else if (!reduced) pfx.burst(at(w, W / 2, Math.min(VIS - 2, (w.rows ? w.rows.findIndex(r => r.every(v => !v)) : 4) + 1)), { n: 8 + cnt * 4, colors: PAL.slice(1, 10), speed: 3 * w.s + 1.2, up: 2, size: .5 * w.s + .1, life: .6, shape: [STAR, DOT] });
    w.hop = Math.max(w.hop, cnt >= 4 ? 1 : .6);
    if (big && !reduced) shake.kick(cnt >= 4 ? .35 : .08 + cnt * .05);
    if (cnt >= 4 && !reduced) pfx.confetti(at(w, W / 2, VIS * .55), { n: big ? 70 : 24, w: W * w.s, h: 5 * w.s, size: .3 * w.s + .08, s: seat });
  }
  function landed(P) { // your brick hit the floor hard
    const w = wells[focus]; if (!w || reduced) return;
    let lo = 9; for (const [, cy] of ROT[P.k][P.r]) lo = Math.min(lo, cy);
    for (const [cx, cy] of ROT[P.k][P.r]) if (cy === lo) pfx.puff(at(w, P.x + cx + .5, P.y + cy, .7), { n: 4, size: .5, speed: 2.4, life: .4 });
    shake.kick(.07);
  }
  // stone lines flying from one well to another
  const stoneMat = toonMat(M(PAL[STONE])), stoneInk = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const stones = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(boxGeo, stoneMat), o = new THREE.Mesh(boxGeo, stoneInk); o.scale.setScalar(1.14); m.add(o); m.visible = false; scene.add(m); return { m, t: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), to: -1, s: 1, wait: 0 }; });
  let stoneI = 0;
  function attack(from, to, k) {
    const A = wells[from], B = wells[to]; if (!B) return;
    for (let i = 0; i < Math.min(k, 5); i++) {
      const st = stones[stoneI++ % stones.length]; st.t = 0; st.wait = i * .07; st.to = to; st.s = Math.max(.35, (A ? A.s : .5) * .9);
      if (A) at(A, W / 2 + (Math.random() - .5) * 3, VIS * .45 + (Math.random() - .5) * 3, 1, st.a); else st.a.set(B.x, Y1 + 6, 1);
      at(B, -.45, 1 + Math.random() * 2, 1, st.b);
    }
  }
  function out(seat) {
    const w = wells[seat]; if (!w) return; w.dead = true; w.nod = 1;
    if (!reduced) { pfx.puff(at(w, W / 2, VIS * .5), { n: 16, size: 1.4 * w.s + .2, speed: 5 * w.s + 1, life: .8, color: ['#ffffff', '#d9d4e2'] }); if (seat === focus) shake.kick(.45); }
  }
  function cheer(seat) { const w = wells[seat]; if (!w) return; w.hop = 1; if (!reduced) pfx.confetti(at(w, W / 2, VIS * .7), { n: 90, w: 8, h: 6, s: seat }); }

  // ---------- loop ----------
  let T = 0, dead = false, last = 0;
  const tv = new THREE.Vector3(), info = { tags: [], hold: { x: 0, y: 0 }, next: { x: 0, y: 0 }, px: 30 };
  const toScreen = (v, o) => { tv.copy(v).project(camera); o.x = (tv.x + 1) / 2 * cw; o.y = (1 - tv.y) / 2 * ch; return o; };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const t = performance.now(), rdt = last ? Math.min(.25, (t - last) / 1000) : dt; last = t;
    step?.(rdt * 1000);
    // --- blocks ---
    n = 0; let gn = 0;
    for (const w of wells) {
      const big = w.seat === focus, local = big && mine ? mine : null, rows = local ? local.b : w.rows, gone = local ? local.dead : w.dead;
      if (rows) for (let y = 0; y < H; y++) { const row = rows[y]; for (let x = 0; x < W; x++) { const v = row[x]; if (v) block(w.x + (x - W / 2 + .5) * w.s, w.y + (y + .5) * w.s, w.s, gone ? greys[(x + y) % 2] : cols[v]); } }
      if (local) {
        const P = local.P;
        if (P && !gone) {
          const k = Math.min(1, rdt * 32); vis.x += (P.x - vis.x) * k; vis.y += (P.y - vis.y) * k;
          if (reduced || Math.abs(P.y - vis.y) > 3) { vis.x = P.x; vis.y = P.y; }
          for (const [cx, cy] of ROT[P.k][P.r]) {
            block(w.x + (vis.x + cx - W / 2 + .5), w.y + (vis.y + cy + .5), 1, cols[P.k + 1], .05, local.flash || 0);
            if (local.gy < P.y) ghosts.setMatrixAt(gn++, mtx.compose(pv.set(w.x + (P.x + cx - W / 2 + .5), w.y + (local.gy + cy + .5), .02), q0, sv.setScalar(.9)));
          }
        }
        if (local.hold >= 0) loose(local.hold, holdAt.x, holdAt.y - 1.1 - 1.3 * ps, ps, !local.can);
        local.next.forEach((k, i) => loose(k, nextAt.x, nextAt.y - 1.1 - 1.2 * ps - i * 2.5 * ps, ps * (i ? .86 : 1)));
      }
      // the bar of stone lines on their way
      const want = local ? local.pend : S ? S.x[w.seat]?.[3] || 0 : 0;
      w.barH += (Math.min(VIS, want) - w.barH) * Math.min(1, rdt * 12);
      w.bar.visible = w.barH > .05; w.bar.scale.y = Math.max(.05, w.barH); w.bar.material.color.set(Math.sin(T * 9) > 0 || want < 4 ? '#ff4f5e' : '#ffb547');
      // the avatar and a gentle bob for the floating wells
      w.hop = Math.max(0, w.hop - rdt * 1.5); w.nod += ((gone ? 1 : 0) - w.nod) * Math.min(1, rdt * 4);
      if (w.av) { w.av.position.y = Math.abs(Math.sin(w.hop * Math.PI * 2)) * .3 * w.hop; w.av.rotation.z = w.nod * .12; animateAvatar(w.av, T, { seed: w.seat, active: !gone && S?.stage === 'go', hop: w.hop, nod: w.nod * 1.4 }); }
      if (!big && !reduced) w.g.position.y = w.y + Math.sin(T * .9 + w.bob) * .08 * w.s;
    }
    cells.count = n; hulls.count = n; ghosts.count = gn;
    cells.instanceMatrix.needsUpdate = hulls.instanceMatrix.needsUpdate = ghosts.instanceMatrix.needsUpdate = true;
    if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
    // --- effects ---
    for (const f of flashes) { if (!f.m.visible) continue; f.t += rdt / .28; f.m.material.opacity = Math.max(0, .9 * (1 - f.t)); if (f.t >= 1) f.m.visible = false; }
    for (const st of stones) {
      if (st.t >= 1) continue;
      if (st.wait > 0) { st.wait -= rdt; continue; }
      st.t = Math.min(1, st.t + rdt / .5); const u = st.t, e = u * u * (3 - 2 * u);
      st.m.visible = u < 1; st.m.position.lerpVectors(st.a, st.b, e); st.m.position.y += Math.sin(u * Math.PI) * 2.2; st.m.position.z += Math.sin(u * Math.PI) * 2.5;
      st.m.rotation.set(u * 7, u * 5, 0); st.m.scale.setScalar(st.s * (.6 + .4 * Math.sin(u * Math.PI)));
      if (u >= 1) { const w = wells[st.to]; if (w && !reduced) { pfx.puff(st.b, { n: 6, size: .7 * w.s + .15, speed: 2.5 * w.s + .6, life: .4, color: ['#d9d4e2', '#ffffff'] }); if (st.to === focus) shake.kick(.12); } }
    }
    lamp.intensity = isNight() ? 1.7 : 0;
    cloudRing.rotation.y = T * .005; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .1), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, ch);
    renderer.render(scene, camera);
    // --- where the name tags and labels go on screen ---
    wells.forEach((w, i) => { const tg = info.tags[i] ||= { x: 0, y: 0, show: false }; tg.show = w.seat !== focus; toScreen(tv.set(w.x, w.y - 1.05 * w.s, 1), tg); tg.w = (W + 2.5) * w.s / unit; });
    info.tags.length = wells.length;
    toScreen(holdAt, info.hold); toScreen(nextAt, info.next); info.px = 1 / unit; info.ps = ps;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setSeats, setState, setMine, cleared, landed, attack, out, cheer,
    setHud(top, bottom, corner = 0) { if (Math.abs(bottom - hudBottom) > 6 || Math.abs(top - hudTop) > 6 || corner !== hudCorner) { hudBottom = bottom; hudTop = top; hudCorner = corner; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const w of wells) freeWell(w);
      pfx.dispose(); wallTx.dispose(); boxGeo.dispose(); cells.dispose(); hulls.dispose(); ghosts.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

// Bubble Lagoon 3D view (three.js): your lagoon stands on a sandy sky island, a tall pool of water under a blocky
// coral reef, with your avatar on a raft beside the shell launcher. Everyone else's lagoon floats beside it, smaller.
// Purely visual: the browser's own game (client.js) and the server decide where every bubble is; this draws them,
// plus the pops, the bubbles that fall, the eggs that fly between lagoons and the reef pushing rows out.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, createFx, shaker, STAR, DOT, nightScene, disposeToon } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { petModel, eggModel } from '../farm/pets3d.js';
import { disposeModel } from '../farm/models.js';
import { COLS, WIDTH, RH, LIM, KINDS, EGG, PETS, LX, LY, AMAX, decode, shifted } from './rules.js';

const INK = '#3b2219', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
export const KIND_COLOR = [null, '#ff9b54', '#ffe46b', '#9be07a', '#8fd0ff', '#b49bff', '#ffb3d1', '#fff6e6'];
const KIND_DEEP = [null, '#e0642a', '#e3b81e', '#4fa83a', '#3b8fd6', '#7652d8', '#e0679b', '#d6b98f'];
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const FH = LY + 1.2;                        // the reef's underside, in units above the raft's floor (rules measure down from the reef)
const FOV = 30, Y0 = -1.3, Y1 = FH + 2.1, HALF = WIDTH / 2 + 1.05; // the picture is fitted to Y0..Y1; HALF: half the big lagoon with its posts
const AV_BIG = 1.05, AV_MINI = 1.7, FEET = .76, AV_H = 2.6;
const R = .485;                             // a bubble's drawn radius

// the water behind the bubbles: deep at the bottom, light near the reef, with soft rays
function waterTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#49c3dd'); gr.addColorStop(.45, '#1f8fb8'); gr.addColorStop(1, '#0c4a70');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#ffffff12'; for (const [a, b] of [[20, 70], [110, 150], [190, 236]]) { g.beginPath(); g.moveTo(a, 0); g.lineTo(b, 0); g.lineTo(b - 60, 512); g.lineTo(a - 70, 512); g.fill(); }
  g.strokeStyle = '#ffffff30'; g.lineWidth = 2; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc((i * 73) % 256, 60 + (i * 131) % 440, 3 + (i % 3) * 2, 0, 7); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function lineTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 8; const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; for (let x = 0; x < 256; x += 32) g.fillRect(x + 4, 0, 20, 8);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createScene(canvas, { onFrame, step } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 80, 260);
  const camera = new THREE.PerspectiveCamera(FOV, 1, .5, 600);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(6, 14, 16); scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 26, max: 100, below: -14 }); scene.add(cloudRing);
  const land = island(WIDTH + 6, 3.4, { seed: 11, props: 10, size: 1.2, flowers: 0, rim: 2.2, grass: '#f1dba6', patch: '#e8cc8c', earth: '#d9a86a', kinds: ['rock', 'bush'] }); land.position.set(0, -.95, -.4); scene.add(land);
  nightScene(scene);
  const flyBirds = birds(scene, 60, 18, 4, 1.8);
  const pfx = createFx(scene), shake = shaker();
  const waterTx = waterTexture(), lineTx = lineTexture();

  // ---------- the bubbles: one picture a pet (and one for the egg), wrapped over the front of a ball ----------
  const ballGeo = new THREE.SphereGeometry(R, 20, 14);
  { const uv = ballGeo.attributes.uv, ps = ballGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / (2 * R) + .5, ps.getY(i) / (2 * R) + .5); }
  const CAP = 460, HCAP = 2200;
  const balls = []; // by cell value 1..7
  for (let k = 1; k <= EGG; k++) { const m = new THREE.InstancedMesh(ballGeo, new THREE.MeshBasicMaterial({ color: KIND_COLOR[k] }), CAP); m.count = 0; m.frustumCulled = false; scene.add(m); balls[k] = { m, n: 0 }; }
  const hulls = new THREE.InstancedMesh(ballGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), HCAP); hulls.count = 0; hulls.frustumCulled = false; scene.add(hulls);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .92, depthWrite: false }), 80); dots.count = 0; dots.frustumCulled = false; dots.renderOrder = 3; scene.add(dots);
  // Each picture is drawn once: the pet model is photographed, given a dark outline and set inside a glossy bubble.
  function paintFaces() {
    const SZ = 256, PR = new THREE.WebGLRenderer({ antialias: true, alpha: true }); PR.setPixelRatio(1); PR.setSize(SZ, SZ, false);
    const S2 = new THREE.Scene(), C2 = new THREE.PerspectiveCamera(26, 1, .1, 60);
    S2.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2.1)); const l2 = new THREE.DirectionalLight('#ffffff', 1.4); l2.position.set(3, 6, 5); S2.add(l2);
    const bb = new THREE.Box3(), ctr = new THREE.Vector3(), size = new THREE.Vector3();
    for (let k = 1; k <= EGG; k++) {
      const g = k === EGG ? eggModel() : petModel(PETS[k - 1], 0); S2.add(g); bb.setFromObject(g); bb.getCenter(ctr); bb.getSize(size);
      const d = Math.max(size.x, size.y) / 2 / Math.tan(13 * Math.PI / 180) * 1.02 + size.z / 2;
      C2.position.set(ctr.x + d * .28, ctr.y + d * .16, ctr.z + d); C2.lookAt(ctr); PR.render(S2, C2);
      const ink = document.createElement('canvas'); ink.width = ink.height = SZ; const ic = ink.getContext('2d');
      ic.drawImage(PR.domElement, 0, 0); ic.globalCompositeOperation = 'source-in'; ic.fillStyle = INK; ic.fillRect(0, 0, SZ, SZ);
      const cv = document.createElement('canvas'); cv.width = cv.height = SZ; const c = cv.getContext('2d'), H = SZ / 2;
      const gr = c.createRadialGradient(SZ * .38, SZ * .32, 6, H, H, SZ * .56);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(.3, KIND_COLOR[k]); gr.addColorStop(1, KIND_DEEP[k]);
      c.fillStyle = gr; c.fillRect(0, 0, SZ, SZ);
      const s = k === EGG ? .6 : .7, o = SZ * (1 - s) / 2; // the pet sits in the middle of the ball
      for (let a = 0; a < 14; a++) c.drawImage(ink, o + Math.cos(a / 14 * 6.283) * 5, o + 6 + Math.sin(a / 14 * 6.283) * 5, SZ * s, SZ * s);
      c.drawImage(PR.domElement, o, o + 6, SZ * s, SZ * s);
      c.fillStyle = '#ffffffc8'; c.beginPath(); c.ellipse(SZ * .33, SZ * .24, SZ * .12, SZ * .055, -.6, 0, 7); c.fill(); // the shine
      c.fillStyle = '#ffffff90'; c.beginPath(); c.arc(SZ * .23, SZ * .37, SZ * .022, 0, 7); c.fill();
      c.strokeStyle = '#ffffff50'; c.lineWidth = SZ * .03; c.beginPath(); c.arc(H, H, SZ * .4, .5, 1.9); c.stroke();    // light coming through, lower right
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const mat = balls[k].m.material; mat.map = t; mat.color.set('#ffffff'); mat.needsUpdate = true;
      S2.remove(g); if (k === EGG) disposeToon(g); else disposeModel(g);
    }
    PR.dispose(); PR.forceContextLoss();
  }
  try { paintFaces(); } catch (e) { console.warn('no pet portraits', e); }
  const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
  let hn = 0, dn = 0;
  function ball(k, x, y, z, s) {
    const B = balls[k]; if (!B || B.n >= CAP || hn >= HCAP || s <= 0) return;
    pv.set(x, y, z); B.m.setMatrixAt(B.n++, mtx.compose(pv, q0, sv.setScalar(s)));
    hulls.setMatrixAt(hn++, mtx.compose(pv, q0, sv.setScalar(s * 1.085)));
  }

  // ---------- one lagoon: water, reef, posts, raft, launcher, the line, and its owner's avatar ----------
  function makeLagoon() {
    const g = new THREE.Group(), deco = new THREE.Group(); g.add(deco);
    const put = (geo, mat, x, y, z, p = deco) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
    const px = WIDTH / 2 + .42;
    // raft: a row of planks on two logs
    for (let i = 0; i < 7; i++) put(new THREE.BoxGeometry((WIDTH + 1.7) / 7 - .08, .34, 1.9), M(i % 2 ? '#b77a45' : '#c98a52'), (i - 3) * (WIDTH + 1.7) / 7, .33, .1);
    put(new THREE.BoxGeometry(WIDTH + 2.1, .3, .5), M('#8f5b34'), 0, .05, .75); put(new THREE.BoxGeometry(WIDTH + 2.1, .3, .5), M('#8f5b34'), 0, .05, -.55);
    // side posts of stacked stone, and the coral reef on top
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(.72 + (i % 2) * .08, FH / 6 - .04, 1.3), M(i % 2 ? '#8fa3b5' : '#a3b4c4'), s * px, .5 + (i + .5) * FH / 6, 0);
    const CORAL = ['#f08a7e', '#ffb26b', '#e2679a', '#ff9f8f', '#c55a8f'];
    put(new THREE.BoxGeometry(WIDTH + 1.7, 1, 1.7), M('#d9707a'), 0, FH + 1, 0);
    for (let i = 0; i < 9; i++) { const w = (WIDTH + 1.7) / 9, h = .5 + ((i * 37) % 5) * .13;
      put(new THREE.BoxGeometry(w * .9, h, 1.5), M(CORAL[i % 5]), (i - 4) * w, FH + 1.5 + h / 2 - .1, .05);
      put(new THREE.BoxGeometry(w * .8, .3 + ((i * 53) % 4) * .08, 1.76), M(CORAL[(i + 2) % 5]), (i - 4) * w + .05, FH + .55, 0); }
    put(new THREE.BoxGeometry(WIDTH + .1, FH + .3, .2), M('#0c4a70'), 0, .5 + FH / 2, -.78);
    bake(deco); toonify(deco, .045);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, FH), new THREE.MeshBasicMaterial({ map: waterTx })); wall.position.set(0, .5 + FH / 2, -.67); g.add(wall);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH - .2, .1), new THREE.MeshBasicMaterial({ map: lineTx, color: '#ffe9a8', transparent: true, opacity: .85, depthWrite: false })); line.position.set(0, .5 + FH - ((LIM - 1) * RH + 1.04), -.6); g.add(line);
    // the shell launcher: turns to where you aim
    const aimG = new THREE.Group(); aimG.position.set(0, .5 + FH - LY, .1); g.add(aimG);
    const shellG = new THREE.Group(); aimG.add(shellG);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.82, 1.25, 7, 1, true), M('#ffd6c2', { side: THREE.DoubleSide })); cone.rotation.x = Math.PI; cone.scale.z = .62; cone.position.y = -.42; shellG.add(cone);
    const knob = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .4), M('#e8a58a')); knob.position.y = -1.08; shellG.add(knob);
    bake(shellG); toonify(shellG, .04);
    const avG = new THREE.Group(); g.add(avG);
    scene.add(g);
    return { g, deco, wall, line, aimG, shellG, avG, av: null, key: '', x: 0, y: 0, s: 1, seat: -1, hop: 0, nod: 0, dead: false, b: null, par: 0, str: null, rows: 0, slide: 0, n: 0, aim: 0, bob: Math.random() * 6 };
  }
  function freeLagoon(w) { scene.remove(w.g); if (w.av) disposeAvatar(w.av); disposeToon(w.deco); disposeToon(w.shellG); w.wall.geometry.dispose(); w.wall.material.dispose(); w.line.geometry.dispose(); w.line.material.dispose(); }

  // ---------- who sits where ----------
  let wells = [], seats = [], focus = 0, S = null, mine = null, layoutKey = '';
  let cw = 0, ch = 0, hudTop = 64, hudBottom = 24, hudCorner = 0, unit = 1, tall = false;
  const camLook = new THREE.Vector3(), camBase = new THREE.Vector3();

  function setSeats(list, f) {
    const key = list.map(p => p.color + '|' + (p.av || []).join('')).join('/') + '#' + f;
    seats = list; focus = f;
    if (key === layoutKey) return; layoutKey = key;
    while (wells.length > list.length) freeLagoon(wells.pop());
    while (wells.length < list.length) wells.push(makeLagoon());
    list.forEach((p, i) => {
      const w = wells[i], k = p.color + (p.av || []).join('') + (i === f);
      w.seat = i;
      if (w.key !== k) {
        w.key = k; if (w.av) { w.avG.remove(w.av); disposeAvatar(w.av); }
        w.av = avatar3d(p.color, p.av, { pose: 'stand' }); w.avG.add(w.av);
        // yours stands on the raft beside the launcher; the others stand on top of their reef, where they can be seen
        if (i === f) { w.avG.scale.setScalar(AV_BIG); w.avG.position.set(-2.75, .5 + FEET * AV_BIG, .45); }
        else { w.avG.scale.setScalar(AV_MINI); w.avG.position.set(0, FH + 1.9 + FEET * AV_MINI, .1); }
      }
    });
    resize(true);
  }

  const MINI_H = FH + 2.3 + AV_H * AV_MINI + 1.3; // a small lagoon with its avatar on top and its name tag underneath
  // Fit n small lagoons into a box: as big as they go, in however many columns that takes.
  function pack(aw, ah, k) {
    let best = { m: 0, c: 1, rows: k };
    for (let c = 1; c <= k; c++) { const rows = Math.ceil(k / c), m = Math.min(.62, (aw / c - .4) / (WIDTH + 2), (ah / rows - .5) / MINI_H); if (m > best.m) best = { m, c, rows }; }
    return best;
  }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === cw && h === ch && !force) return; cw = w; ch = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const availH = Math.max(200, h - hudTop - hudBottom), HT = Y1 - Y0;
    const others = seats.map((_, i) => i).filter(i => i !== focus);
    tall = w / availH < 1.05 && others.length > 0; // a phone held upright: the others go in a strip over your reef
    let top = Y1, strip = 0, mScale = 0;
    if (tall) {
      mScale = Math.min(.24, (HALF * 2 / others.length - .3) / (WIDTH + 2)); strip = MINI_H * mScale + .3;
      unit = Math.max((HT + strip) / availH, (HALF * 2 + .3) / w); top = Y1 + strip;
      others.forEach((i, k) => { const wl = wells[i]; wl.s = mScale; wl.x = (k - (others.length - 1) / 2) * (HALF * 2 / others.length); wl.y = Y1 + 1.3 * mScale + .1; });
    } else {
      let colW = (HT * w / availH - HALF * 2) / 2 - .2; const MINC = others.length ? 3 : 0;
      if (colW >= MINC) { colW = Math.min(colW, 12); unit = HT / availH; } else { colW = MINC; unit = (HALF * 2 + MINC * 2 + .4) / w; }
      unit *= 1.02;
      const nL = Math.floor(others.length / 2);
      const side = (list, sgn) => {
        if (!list.length) return;
        const yTop = Y1 - .1, bot = Y0 + .2 + (sgn > 0 ? Math.max(0, hudCorner - hudBottom) * unit : 0), ah = yTop - bot;
        const P = pack(colW, ah, list.length), cwid = colW / P.c, chgt = ah / P.rows, used = MINI_H * P.m;
        list.forEach((i, k) => { const c = k % P.c, r = (k / P.c) | 0, wl = wells[i];
          wl.s = P.m; wl.x = sgn * (HALF + .2 + cwid * (c + .5)); wl.y = yTop - chgt * r - (chgt - used) / 2 - used + 1.3 * P.m; });
      };
      side(others.slice(0, nL), -1); side(others.slice(nL), 1);
    }
    const fw = wells[focus]; if (fw) { fw.s = 1; fw.x = 0; fw.y = 0; }
    for (const wl of wells) { wl.g.position.set(wl.x, wl.y, 0); wl.g.scale.setScalar(wl.s); }
    const cy = (Y0 + top) / 2, lookY = cy - (hudBottom - hudTop) / 2 * unit, D = h * unit / (2 * Math.tan(FOV * Math.PI / 360));
    camLook.set(0, lookY, 0); camBase.set(0, lookY + D * .03, D);
    camera.position.copy(camBase); camera.lookAt(camLook);
    scene.fog.near = D + 40; scene.fog.far = D + 260;
  }

  // ---------- what the server says (every lagoon) and what this browser is playing (your own) ----------
  const wp = new THREE.Vector3();
  // a spot in a lagoon, from the rules' own coordinates (x across, y down from the reef), in the world
  const at = (w, x, y, z = .5, v = wp) => v.set(w.x + (x - WIDTH / 2) * w.s, w.y + (.5 + FH - y) * w.s, z * w.s);
  function setState(st) {
    S = st;
    st.b.forEach((str, i) => {
      const w = wells[i]; if (!w) return;
      const rows = st.x[i][6] || 0;
      if (w.str !== str) {
        const d = decode(str || '0'), local = i === focus && mine;
        // what vanished since the last picture pops (for the lagoons this browser is not playing itself)
        if (w.b && !local && !reduced) {
          const sh = Math.max(0, rows - w.rows); let shown = 0;
          for (let r = 0; r < w.b.length && shown < 14; r++) for (let c = 0; c < COLS; c++) { const v = w.b[r][c]; if (v && !(d.b[r + sh]?.[c])) { shown++;
            pfx.burst(at(w, c + .5 + (((r + w.par) & 1) ? .5 : 0), .5 + (r + sh) * RH), { n: w.s > .5 ? 5 : 3, colors: [KIND_COLOR[v], '#ffffff'], speed: 2.4 * w.s + .5, up: 1.2, size: .3 * w.s + .06, life: .5, shape: [DOT, STAR] }); } }
        }
        if (w.b && rows > w.rows && !reduced) w.slide += rows - w.rows;
        w.str = str; w.b = d.b; w.par = d.par; w.rows = rows;
      }
      w.dead = !!st.x[i][0]; w.n = st.x[i][3] || 0;
    });
  }
  function setMine(m) { mine = m; }

  // ---------- effects in your own lagoon (the browser knows exactly what its shot did) ----------
  const pops = [], falls = [], rises = new Map(), flyers = [];
  let mySlide = 0, landKey = '', landT = 1;
  // res: what rules.lock() returned; par: the half-step the lagoon had when the shot landed
  function landed(res) {
    const w = wells[focus]; if (!w) return;
    const sx = (r, c) => c + .5 + (((r + res.par0) & 1) ? .5 : 0);
    res.popped.forEach(([r, c, k], i) => pops.push({ x: sx(r, c), y: .5 + r * RH, k, wait: i * .045, t: 0 }));
    res.cracked.forEach(([r, c, k], i) => pops.push({ x: sx(r, c), y: .5 + r * RH, k, wait: .1 + i * .04, t: 0, crack: true }));
    res.dropped.forEach(([r, c, k], i) => falls.push({ x: sx(r, c), y: .5 + r * RH, k, vx: (Math.random() - .5) * 1.6, vy: -2 - Math.random() * 2, wait: .12 + i * .02, done: false }));
    for (const [r, c] of res.eggs) rises.set(r * COLS + c, { t: 0 });
    if (res.added) mySlide += res.added;
    landKey = res.popped.length ? '' : res.r * COLS + res.c + ''; landT = 0;
    if (res.popped.length) { w.hop = Math.max(w.hop, res.dropped.length >= 4 ? 1 : .5); if (!reduced) shake.kick(Math.min(.3, .04 + res.dropped.length * .03)); }
    if (res.clean && !reduced) pfx.confetti(at(w, WIDTH / 2, 4), { n: 70, w: WIDTH, h: 5, s: focus });
  }
  // eggs flying from one lagoon to another
  function attack(from, to, k) {
    const A = wells[from], B = wells[to]; if (!B) return;
    for (let i = 0; i < Math.min(k, 8); i++) {
      const f = { t: 0, wait: i * .06 + (from === focus ? .35 : 0), to, s: Math.max(.3, (A ? A.s : .5) * .8), a: new THREE.Vector3(), b: new THREE.Vector3() };
      if (A) at(A, WIDTH / 2 + (Math.random() - .5) * 5, LY - 1 - Math.random() * 2, 1, f.a); else f.a.set(B.x, Y1 + 6, 1);
      at(B, WIDTH / 2 + (Math.random() - .5) * 6, LY - .4, 1, f.b);
      flyers.push(f);
    }
  }
  function out(seat) {
    const w = wells[seat]; if (!w) return; w.dead = true; w.nod = 1;
    if (!reduced) { pfx.puff(at(w, WIDTH / 2, LY - 2), { n: 16, size: 1.4 * w.s + .2, speed: 5 * w.s + 1, life: .8, color: ['#ffffff', '#bfe8ff'] }); if (seat === focus) shake.kick(.45); }
  }
  function cheer(seat) { const w = wells[seat]; if (!w) return; w.hop = 1; if (!reduced) pfx.confetti(at(w, WIDTH / 2, FH * .3), { n: 90, w: 8, h: 6, s: seat }); }

  // where on the screen is the player pointing, as an aim for the launcher? below: under the launcher (no shot)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function aimAt(cx, cy) {
    const w = wells[focus]; if (!w || !cw) return null;
    const rc = canvas.getBoundingClientRect(); ndc.set((cx - rc.left) / rc.width * 2 - 1, 1 - (cy - rc.top) / rc.height * 2);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null;
    const dx = hit.x - w.x, dy = hit.y - (w.y + .5 + FH - LY), len = Math.hypot(dx, dy);
    if (len < .05) return { a: 0, below: false };
    const up = Math.max(dy, -len * .999 + 1e-6), a = Math.round(1000 * dx / (len + up)); // the tangent of half the angle from straight up
    return { a: Math.max(-AMAX, Math.min(AMAX, a)), below: dy < .25 };
  }

  // ---------- loop ----------
  let T = 0, dead = false, last = 0;
  const tv = new THREE.Vector3(), info = { tags: [], next: { x: 0, y: 0 }, px: 30 };
  const toScreen = (v, o) => { tv.copy(v).project(camera); o.x = (tv.x + 1) / 2 * cw; o.y = (1 - tv.y) / 2 * ch; return o; };
  const NEXT_X = LX + 2.1, NEXT_Y = LY + .25;
  function drawBoard(w, b, par, slide, gone, local) {
    const off = slide * RH;
    for (let r = 0; r < b.length; r++) { const row = b[r], y = .5 + r * RH - off; if (y < -.2) continue;
      const sh = ((r + par) & 1) ? .5 : 0;
      for (let c = 0; c < COLS; c++) { const v = row[c]; if (!v) continue;
        let yy = y, s = 1;
        if (local) {
          const key = r * COLS + c, rs = rises.get(key);
          if (rs) { const u = Math.min(1, rs.t / .45), e = 1 - (1 - u) * (1 - u); yy = y + (LY - y) * (1 - e); s = .5 + .5 * e; }
          if (landT < 1 && landKey === key + '') s *= 1 + Math.sin(landT * Math.PI) * .16;
        }
        at(w, c + .5 + sh, yy, gone ? .3 : .5);
        ball(gone ? EGG : v, wp.x, wp.y, wp.z, w.s * s * (gone ? .92 : 1));
      } }
  }
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const t = performance.now(), rdt = last ? Math.min(.25, (t - last) / 1000) : dt; last = t;
    step?.(rdt * 1000);
    for (let k = 1; k <= EGG; k++) balls[k].n = 0; hn = 0; dn = 0;
    mySlide = Math.max(0, mySlide - rdt * Math.max(3, mySlide * 9)); landT = Math.min(1, landT + rdt / .22);
    for (const [key, rs] of rises) { rs.t += rdt; if (rs.t > .5) rises.delete(key); }
    for (const w of wells) {
      const big = w.seat === focus, local = big && mine ? mine : null, gone = local ? local.dead : w.dead;
      w.slide = Math.max(0, w.slide - rdt * Math.max(3, w.slide * 9));
      if (local) drawBoard(w, local.b, local.par, mySlide, gone, true); else if (w.b) drawBoard(w, w.b, w.par, w.slide, gone, false);
      const rowsNow = local ? local.b.length : w.b ? w.b.length : 0, hot = !gone && rowsNow >= LIM - 2;
      w.line.material.color.set(hot && Math.sin(T * 10) > 0 ? '#ff5a5a' : '#ffe9a8');
      // the launcher: the bubble in hand, the one after it, and the eggs on their way
      const aim = local ? local.aim : w.aim, ang = 2 * Math.atan(aim / 1000);
      w.aimG.rotation.z += (-ang - w.aimG.rotation.z) * Math.min(1, rdt * 22);
      if (local && !gone) {
        if (!local.fly && local.cur) { at(w, LX, LY, .6); ball(local.cur, wp.x, wp.y, wp.z, local.ready); }
        if (local.nxt) { at(w, NEXT_X, NEXT_Y, .7); ball(local.nxt, wp.x, wp.y, wp.z, .62); }
        if (local.fly) { at(w, local.fly.x, local.fly.y, .6); ball(local.fly.k, wp.x, wp.y, wp.z, 1); }
        // the dotted line of where the shot will go
        if (local.path && !local.fly) {
          let left = local.guide, carry = (T * 1.6) % .55;
          for (let i = 0; i + 1 < local.path.length && left > 0 && dn < 80; i++) {
            const [ax, ay] = local.path[i], [bx, by] = local.path[i + 1], seg = Math.hypot(bx - ax, by - ay); let d = carry;
            for (; d < seg && d < left && dn < 80; d += .55) { if (i === 0 && d < .7) continue; at(w, ax + (bx - ax) * d / seg, ay + (by - ay) * d / seg, .55); dots.setMatrixAt(dn++, mtx.compose(wp, q0, sv.setScalar(1 - .45 * (local.guide - left + d) / local.guide))); }
            carry = d - seg; left -= seg;
          }
        }
      }
      const eggsDue = local ? local.pend : w.n;
      for (let i = 0; i < Math.min(eggsDue, 12) && !gone; i++) { at(w, WIDTH - .45 - (i % 2) * .62, LY + .42 - ((i / 2) | 0) * .56 + Math.sin(T * 5 + i) * .03, .85); ball(EGG, wp.x, wp.y, wp.z, w.s * .56); }
      // the avatar and a gentle bob for the floating lagoons
      w.hop = Math.max(0, w.hop - rdt * 1.5); w.nod += ((gone ? 1 : 0) - w.nod) * Math.min(1, rdt * 4);
      if (w.av) { w.av.position.y = Math.abs(Math.sin(w.hop * Math.PI * 2)) * .3 * w.hop; w.av.rotation.z = w.nod * .12; animateAvatar(w.av, T, { seed: w.seat, active: !gone && S?.stage === 'go', hop: w.hop, nod: w.nod * 1.4 }); }
      if (!big && !reduced) w.g.position.y = w.y + Math.sin(T * .9 + w.bob) * .08 * w.s;
    }
    // --- your pops, your falling bubbles, and eggs in flight ---
    const fw = wells[focus];
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; if (p.wait > 0) { p.wait -= rdt; if (fw) { at(fw, p.x, p.y); ball(p.k, wp.x, wp.y, wp.z, 1); } if (p.wait <= 0 && fw && !reduced) pfx.burst(at(fw, p.x, p.y, .9), { n: p.crack ? 5 : 7, colors: [KIND_COLOR[p.k], '#ffffff', KIND_DEEP[p.k]], speed: 3, up: 1.6, size: .3, life: .55, shape: [DOT, STAR] }); continue; }
      p.t += rdt / .34; if (p.t >= 1 || !fw) { pops.splice(i, 1); continue; }
      const grow = p.t < .25 ? 1 + p.t * .9 : 1.22 * (1 - (p.t - .25) / .75);
      at(fw, p.x, p.y - (p.crack ? 0 : p.t * p.t * 1.4)); ball(p.k, wp.x, wp.y, wp.z, grow); // freed pets drift up as their bubble goes
    }
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i]; if (!fw) { falls.splice(i, 1); continue; }
      if (f.wait > 0) f.wait -= rdt; else { f.vy += 34 * rdt; f.x += f.vx * rdt; f.y += f.vy * rdt; }
      if (f.y > LY + .4) { if (!reduced) pfx.puff(at(fw, f.x, LY + .5, .9), { n: 5, size: .5, speed: 2, life: .4, color: ['#ffffff', '#bfe8ff'] }); falls.splice(i, 1); continue; }
      at(fw, f.x, f.y, .7); ball(f.k, wp.x, wp.y, wp.z, 1);
    }
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]; if (f.wait > 0) { f.wait -= rdt; continue; }
      f.t = Math.min(1, f.t + rdt / .55); const u = f.t, e = u * u * (3 - 2 * u);
      pv.lerpVectors(f.a, f.b, e); pv.y += Math.sin(u * Math.PI) * 2.4; pv.z += Math.sin(u * Math.PI) * 2.5;
      ball(EGG, pv.x, pv.y, pv.z, f.s * (.7 + .5 * Math.sin(u * Math.PI)));
      if (u >= 1) { const w = wells[f.to]; if (w && !reduced) { pfx.puff(f.b, { n: 5, size: .6 * w.s + .12, speed: 2.2 * w.s + .5, life: .4, color: ['#fff6e6', '#ffffff'] }); if (f.to === focus) shake.kick(.06); } flyers.splice(i, 1); }
    }
    for (let k = 1; k <= EGG; k++) { const B = balls[k]; B.m.count = B.n; B.m.instanceMatrix.needsUpdate = true; }
    hulls.count = hn; hulls.instanceMatrix.needsUpdate = true; dots.count = dn; dots.instanceMatrix.needsUpdate = true;
    cloudRing.rotation.y = T * .005; flyBirds(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .06), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .04), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, ch);
    renderer.render(scene, camera);
    // --- where the name tags and the "next" label go on screen ---
    wells.forEach((w, i) => { const tg = info.tags[i] ||= { x: 0, y: 0, show: false }; tg.show = w.seat !== focus; toScreen(tv.set(w.x, w.y - .25 * w.s, 1 * w.s), tg); tg.w = (WIDTH + 2) * w.s / unit; });
    info.tags.length = wells.length;
    if (fw) { toScreen(at(fw, NEXT_X, NEXT_Y, .7), info.next); toScreen(at(fw, LX, LY, .6), info.raft ||= { x: 0, y: 0 }); }
    info.px = 1 / unit; info.tall = tall;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setSeats, setState, setMine, landed, attack, out, cheer, aimAt,
    setHud(top, bottom, corner = 0) { if ((Math.abs(bottom - hudBottom) > 6 || Math.abs(top - hudTop) > 6 || corner !== hudCorner) && hudFitOk(canvas)) { hudBottom = bottom; hudTop = top; hudCorner = corner; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const w of wells) freeLagoon(w);
      for (let k = 1; k <= EGG; k++) { balls[k].m.material.map?.dispose(); balls[k].m.material.dispose(); balls[k].m.dispose(); }
      pfx.dispose(); waterTx.dispose(); lineTx.dispose(); ballGeo.dispose(); hulls.dispose(); dots.geometry.dispose(); dots.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
void KINDS; void shifted;

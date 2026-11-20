// Marble Rush 3D view (three.js). Purely visual: it replays the positions the server streams.
import * as THREE from 'three';
import { makeTrack, world, at, spinAngle, trapOpen, R, DS, DISH, WALL_H, GATE_S } from './track.js';
import { avatarSvg } from '../../avatar.js';
import { frameLoop, autoResolution } from '../../frames.js';

const INK = '#3b2219', PLUM = '#2a1422';
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...o });
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const tmp = [0, 0, 0];

const svgImg = svg => new Promise(res => {
  const im = new Image();
  im.onload = () => res(im); im.onerror = () => res(null);
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});

// The marble wears its owner's outfit colour and has their avatar's face on both sides.
function marbleTexture(color, av) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const base = () => {
    g.fillStyle = color; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#ffffff66'; g.lineWidth = 16;
    for (let k = -1; k < 3; k++) { g.beginPath(); g.moveTo(k * 256, 256); g.bezierCurveTo(k * 256 + 90, 170, k * 256 + 170, 90, k * 256 + 256, 0); g.stroke(); }
    g.fillStyle = '#00000022'; g.fillRect(0, 0, 512, 22); g.fillRect(0, 234, 512, 22);
  };
  base();
  svgImg(avatarSvg(color, av).replace('<svg ', '<svg width="200" height="200" ')).then(im => {
    if (!im) return;
    for (const cx of [128, 384]) {
      g.save(); g.beginPath(); g.ellipse(cx, 128, 74, 92, 0, 0, 6.3); g.closePath();
      g.fillStyle = '#fff4e2'; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.clip();
      g.drawImage(im, cx - 80, 128 - 100, 160, 200); g.restore();
    }
    tex.needsUpdate = true;
  });
  return tex;
}

function stripeTexture(a, b, n = 8) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.fillStyle = b;
  const w = 128 / n;
  for (let i = -n; i < n * 2; i += 2) { g.beginPath(); g.moveTo(i * w, 0); g.lineTo((i + 1) * w, 0); g.lineTo((i + 1) * w - 128, 128); g.lineTo(i * w - 128, 128); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function checkTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
  const g = cv.getContext('2d');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#fff4e2' : INK; g.fillRect(x * 16, y * 16, 16, 16); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
function chevronTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#1f6f5a'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#b8ffe6'; g.lineWidth = 16; g.lineJoin = 'miter';
  for (const y of [28, 92]) { g.beginPath(); g.moveTo(14, y + 22); g.lineTo(64, y - 18); g.lineTo(114, y + 22); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function floorTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d'); g.fillStyle = '#f6e3c5'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#e9cfa8'; g.fillRect(0, 0, 64, 6); g.fillRect(0, 128, 64, 6);
  g.fillStyle = '#ffffff55'; g.fillRect(30, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function softDot() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// A strip of quads joining rails (arrays of points running along the track).
function ribbon(rails, vScale = 1) {
  const n = rails[0].length, m = rails.length, pos = new Float32Array(n * m * 3), uv = new Float32Array(n * m * 2), idx = [];
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const p = rails[j][i], o = (j * n + i);
    pos[o * 3] = p[0]; pos[o * 3 + 1] = p[1]; pos[o * 3 + 2] = p[2];
    uv[o * 2] = j / (m - 1); uv[o * 2 + 1] = i * vScale;
  }
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

export function createScene(canvas, { onFrame }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 2); // steps the resolution down if the device can't hold 60 fps
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PLUM); scene.fog = new THREE.Fog(PLUM, 40, 170);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 400);
  scene.add(new THREE.HemisphereLight('#ffe2c4', '#4a2338', 1.7));
  const key = new THREE.DirectionalLight('#ffe6c8', 2.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  key.shadow.bias = -.0006; scene.add(key, key.target);

  const dot = softDot();
  let T = null, trackGroup = null, anim = [], marbles = [], seatsKey = '';
  let frames = [], renderT = 0, clockAt = 0, clockT = 0, playing = false;
  let stage = 'bet', follow = -1, camS = 0, camU = 0, camInit = false, flyT = 0, endT = 0;
  let fx = { roll: 0, rollTo: 0, shake: 0, fov: 48, fovTo: 48 };
  const bursts = [];
  const sharedGeo = new THREE.SphereGeometry(R, 32, 24);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function disposeTree(o) {
    o.traverse(x => {
      x.geometry?.dispose();
      for (const m of [].concat(x.material || [])) { m.map?.dispose(); m.dispose(); }
    });
  }

  // ---------- track ----------
  function setTrack(seed, short) {
    if (T && T.seed === seed && T.short === short) return;
    if (trackGroup) { scene.remove(trackGroup); disposeTree(trackGroup); }
    T = makeTrack(seed, short); anim = []; camInit = false; frames = []; clockAt = 0;
    const g = trackGroup = new THREE.Group(); scene.add(g);
    const step = 2, cnt = Math.floor((T.n - 1) / step) + 1;
    const rail = (uf, lift) => Array.from({ length: cnt }, (_, i) => {
      const s = Math.min(T.n - 1, i * step) * DS, hw = at(T.w, s) / 2;
      const u = uf(hw);
      return world(T, s, u, typeof lift === 'function' ? lift(hw, u) : lift, [0, 0, 0]);
    });
    const edge = hw => DISH * hw * hw;
    const fl = [];
    for (let k = 0; k <= 8; k++) fl.push(rail(hw => -hw + 2 * hw * k / 8, 0));
    const floor = new THREE.Mesh(ribbon(fl, .25), M('#ffffff', { map: floorTexture(), roughness: .5, side: THREE.DoubleSide }));
    floor.receiveShadow = true; g.add(floor);
    const wallM = M('#e5543b', { roughness: .55, side: THREE.DoubleSide }), topM = M('#fff4e2', { roughness: .5, side: THREE.DoubleSide }), underM = M('#5a2a3c', { roughness: .9, side: THREE.DoubleSide });
    for (const sd of [-1, 1]) {
      const inner = hw => sd * hw, outer = hw => sd * (hw + .3);
      const fix = lift => (hw) => lift - DISH * (hw + .3) ** 2 + edge(hw); // keep outer faces level with the inner ones
      const a = rail(inner, 0), b = rail(inner, WALL_H), c = rail(outer, fix(WALL_H)), d = rail(outer, fix(-.45));
      const w1 = new THREE.Mesh(ribbon([a, b]), wallM), w2 = new THREE.Mesh(ribbon([b, c]), topM), w3 = new THREE.Mesh(ribbon([c, d]), wallM);
      w1.receiveShadow = true; w1.castShadow = w3.castShadow = true;
      g.add(w1, w2, w3);
    }
    const fixB = hw => -.45 - DISH * (hw + .3) ** 2 + edge(hw);
    g.add(new THREE.Mesh(ribbon([rail(hw => -(hw + .3), fixB), rail(hw => hw + .3, fixB)]), underM));
    // end caps
    for (const s of [0, (T.n - 1) * DS]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(5.6, WALL_H + .45 + DISH * 6.25, .3), wallM);
      place(cap, s, 0, (WALL_H - .45 + DISH * 6.25) / 2 - .0); g.add(cap);
    }
    // ground and supports
    let minY = 0; for (let i = 0; i < T.n; i++) minY = Math.min(minY, T.y[i]);
    const groundY = minY - 7;
    const cx = (T.x[0] + T.x[T.n - 1]) / 2, cz = (T.z[0] + T.z[T.n - 1]) / 2;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), M('#24111c', { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, groundY, cz); ground.receiveShadow = true; g.add(ground);
    const postM = M('#7a4628', { roughness: .8 });
    for (let s = 3; s < T.end; s += 9) {
      world(T, s, 0, -.5, tmp);
      const hgt = tmp[1] - groundY, post = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, hgt, 10), postM);
      post.position.set(tmp[0], groundY + hgt / 2, tmp[2]); g.add(post);
    }
    // lanterns floating beside the track
    const cols = ['#ffb547', '#ff8fab', '#7ed3b2', '#ffd27a', '#ff7a59'];
    for (let s = 6, k = 0; s < T.end; s += 13, k++) {
      const side = k % 2 ? 1 : -1;
      world(T, s, side * (8 + (k * 37 % 5)), 2.5 + (k * 53 % 4), tmp);
      const l = new THREE.Mesh(new THREE.SphereGeometry(.45, 14, 10), new THREE.MeshBasicMaterial({ color: cols[k % 5] }));
      l.position.set(tmp[0], tmp[1], tmp[2]); g.add(l);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: cols[k % 5], transparent: true, opacity: .35, depthWrite: false }));
      halo.position.copy(l.position); halo.scale.setScalar(3); g.add(halo);
      anim.push(t => { l.position.y = halo.position.y = l.userData.y + Math.sin(t * .8 + k) * .35; });
      l.userData.y = l.position.y;
    }
    // pins
    const pinGeo = new THREE.CylinderGeometry(1, 1, 1, 16), pinM = M('#7ed3b2', { roughness: .35 }), capM = M('#fff4e2', { roughness: .4 });
    for (const p of T.pins) {
      const m = new THREE.Mesh(pinGeo, pinM); m.scale.set(p.r, .95, p.r); place(m, p.s, p.u, .47); m.castShadow = true; g.add(m);
      const c = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.12, 12, 8), capM); place(c, p.s, p.u, .95); g.add(c);
    }
    // spinners
    for (const sp of T.spinners) {
      const hub = new THREE.Group(); place(hub, sp.s, sp.u, 0); g.add(hub);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.2, .26, .8, 14), M('#fff4e2')); post.position.y = .4; hub.add(post);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.32, .34, sp.hl * 2), M('#ffb547', { map: stripeTexture('#ffb547', '#e5543b', 6), roughness: .45 }));
      bar.position.y = .36; bar.castShadow = true; hub.add(bar);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10), M('#e5543b')); knob.position.y = .82; hub.add(knob);
      anim.push((t, st) => { bar.rotation.y = spinAngle(sp, st); });
    }
    // trapdoors: a hazard-striped lid slides away over a dark pit
    for (const tr of T.traps) {
      const len = tr.s1 - tr.s0, wid = tr.u1 - tr.u0, mid = (tr.s0 + tr.s1) / 2, um = (tr.u0 + tr.u1) / 2;
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), new THREE.MeshBasicMaterial({ color: '#0d0509' }));
      pit.rotation.x = -Math.PI / 2; const pg = new THREE.Group(); pg.add(pit); place(pg, mid, um, .03 + DISH * um * um * .5); g.add(pg);
      const tex = stripeTexture('#ffb547', INK, 6); tex.repeat.set(1, 1);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(wid, .06, len), M('#ffffff', { map: tex, roughness: .5 }));
      const lg = new THREE.Group(); lg.add(lid); place(lg, mid, um, .07 + DISH * um * um * .5); g.add(lg);
      let k = 1;
      anim.push((t, st, dt) => {
        const to = trapOpen(tr, st) ? 0 : 1; k += (to - k) * Math.min(1, dt * 14);
        lid.scale.z = Math.max(.02, k); lid.position.z = -(1 - k) * len / 2; lid.visible = k > .04;
      });
    }
    // boost pads
    for (const b of T.boosts) {
      const len = b.s1 - b.s0, tex = chevronTexture(); tex.repeat.set(2, 1.5);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(4.3, len), new THREE.MeshBasicMaterial({ map: tex }));
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = Math.PI; const pg = new THREE.Group(); pg.add(pad); place(pg, (b.s0 + b.s1) / 2, 0, .1); g.add(pg);
      anim.push(t => { tex.offset.y = -t * 1.6; });
    }
    // finish arch + line
    {
      const fg = new THREE.Group(); place(fg, T.L, 0, 0); g.add(fg);
      const postM2 = M('#fff4e2');
      for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 4.2, 12), postM2); p.position.set(sd * 2.95, 2.1, 0); fg.add(p); }
      const ct = checkTexture(); ct.wrapS = THREE.RepeatWrapping; ct.repeat.set(1.5, 1);
      const ban = new THREE.Mesh(new THREE.BoxGeometry(6.1, 1, .12), M('#ffffff', { map: ct, roughness: .6 })); ban.position.y = 3.7; fg.add(ban);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(5, .9), new THREE.MeshBasicMaterial({ map: checkTexture() }));
      line.rotation.x = -Math.PI / 2; line.position.y = .12; fg.add(line);
    }
    // start gate
    {
      const gg = new THREE.Group(); place(gg, GATE_S + .12, 0, 0); g.add(gg);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(5, .5, .14), M('#ffb547', { map: stripeTexture('#ffb547', INK, 10), roughness: .5 }));
      bar.position.y = .38; gg.add(bar);
      let k = 0;
      anim.push((t, st, dt) => { const to = playing ? 1 : 0; k += (to - k) * Math.min(1, dt * 9); bar.position.y = .38 + k * 2.6; });
    }
  }
  // Put an object on the track, facing along it and tilted with the slope.
  function place(o, s, u, lift) {
    world(T, s, u, lift, tmp); o.position.set(tmp[0], tmp[1], tmp[2]);
    o.rotation.set(Math.atan(at(T.sl, s)), at(T.h, s), 0, 'YXZ');
  }

  // ---------- marbles ----------
  // A small arrow that bobs and spins over your own marble.
  const arrow = new THREE.Group(), arrowM = new THREE.MeshStandardMaterial({ color: '#ffb547', emissive: '#ffb547', emissiveIntensity: .45, roughness: .4, flatShading: true });
  {
    const head = new THREE.Mesh(new THREE.ConeGeometry(.2, .3, 4), arrowM); head.rotation.x = Math.PI; head.position.y = .15;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(.11, .22, .11), arrowM); shaft.position.y = .4;
    arrow.add(head, shaft); arrow.visible = false; scene.add(arrow);
  }
  let mine = -1;
  function setMarbles(seats) {
    const key = seats.map(p => p.color + p.av.join('') + p.name).join('|');
    if (key === seatsKey) return;
    seatsKey = key;
    for (const m of marbles) { scene.remove(m.mesh); m.mesh.material.map.dispose(); m.mesh.material.dispose(); }
    marbles = seats.map(p => {
      const mesh = new THREE.Mesh(sharedGeo, new THREE.MeshPhysicalMaterial({ map: marbleTexture(p.color, p.av), roughness: .18, clearcoat: 1, clearcoatRoughness: .08 }));
      mesh.castShadow = true; mesh.rotation.y = -Math.PI / 2; scene.add(mesh);
      return { mesh, s: 0, u: 0, st: 0, fall: 0, pop: 1, has: false, pos: new THREE.Vector3(), color: p.color, tag: { x: 0, y: 0, show: false } };
    });
  }

  // ---------- playback ----------
  function pushFrames(list, simT, isPlaying) {
    if (playing !== isPlaying) { playing = isPlaying; if (!isPlaying) frames = []; }
    // Between races the server sends one frame: where the marbles stand now. A new race restarts
    // its frame numbers, so never compare against frames kept from the race before.
    if (!playing) frames = [];
    for (const f of list) {
      if (frames.length && f.i <= frames[frames.length - 1].i) continue;
      if (frames.length && f.t < frames[frames.length - 1].t) frames = []; // a new heat started
      frames.push(f);
    }
    if (frames.length > 80) frames.splice(0, frames.length - 80);
    if (!playing) { renderT = frames.length ? frames[frames.length - 1].t : 0; clockAt = 0; return; }
    const now = performance.now(), want = simT - 320;
    if (!clockAt || Math.abs(want - (clockT + now - clockAt)) > 1200) { clockAt = now; clockT = Math.max(0, want); }
    else { const cur = clockT + now - clockAt; clockT = cur + (want - cur) * .12; clockAt = now; }
  }
  function sample() {
    if (!frames.length) return;
    if (playing) renderT = clockT + performance.now() - clockAt;
    let a = frames[0], b = frames[0];
    for (let i = frames.length - 1; i >= 0; i--) if (frames[i].t <= renderT) { a = frames[i]; b = frames[i + 1] || a; break; }
    const k = b.t > a.t ? Math.min(1, (renderT - a.t) / (b.t - a.t)) : 0;
    for (let i = 0; i < marbles.length; i++) {
      const m = marbles[i], s0 = a.d[i * 3] / 100, s1 = b.d[i * 3] / 100, u0 = a.d[i * 3 + 1] / 100, u1 = b.d[i * 3 + 1] / 100;
      const jump = Math.abs(s1 - s0) > 3.5 || b.d[i * 3 + 2] !== a.d[i * 3 + 2];
      m.ps = m.s; m.s = jump ? s0 : s0 + (s1 - s0) * k; m.u = jump ? u0 : u0 + (u1 - u0) * k;
      const st = a.d[i * 3 + 2];
      if (st !== m.st) { if (st === 1) m.fall = 0; if (m.st === 1 && st !== 1) m.pop = 0; m.st = st; }
      m.has = true;
    }
  }

  function burst(i, color, n = 14) {
    const m = marbles[i]; if (!m || reduced) return;
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, depthWrite: false }));
      s.position.copy(m.pos); s.scale.setScalar(.5); scene.add(s);
      bursts.push({ s, v: new THREE.Vector3((Math.random() - .5) * 7, Math.random() * 6 + 1, (Math.random() - .5) * 7), t: 0 });
    }
  }

  // ---------- frame loop ----------
  const q = new THREE.Quaternion(), axis = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), prev = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), proj = new THREE.Vector3();
  const lookNow = new THREE.Vector3();
  let W = 0, H = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  function leader() {
    let best = -1, bs = -1;
    for (let i = 0; i < marbles.length; i++) { const m = marbles[i]; if (m.st === 0 && m.s > bs) { bs = m.s; best = i; } }
    if (best < 0) for (let i = 0; i < marbles.length; i++) { const m = marbles[i]; if (m.st !== 3 && m.s > bs) { bs = m.s; best = i; } }
    return best;
  }
  function loop(dt, now) {
    const t = now / 1000;
    resize();
    if (!T) { renderer.render(scene, camera); return; }
    sample();
    const st = renderT / 1000;
    for (const f of anim) f(t, st, dt);
    // marbles
    for (const m of marbles) {
      if (!m.has || m.st === 3) { m.mesh.visible = false; m.tag.show = false; continue; }
      prev.copy(m.pos);
      world(T, m.s, m.u, R, tmp); m.pos.set(tmp[0], tmp[1], tmp[2]);
      let vis = true;
      if (m.st === 1) { m.fall += dt; m.pos.y -= 9 * m.fall * m.fall; vis = m.fall < .9; }
      if (m.pop < 1) m.pop = Math.min(1, m.pop + dt * 4);
      m.mesh.visible = vis; m.mesh.scale.setScalar(m.pop < 1 ? .3 + .7 * (1 + .6 * Math.sin(m.pop * Math.PI)) * m.pop : 1);
      m.mesh.position.copy(m.pos);
      axis.subVectors(m.pos, prev); const d = axis.length();
      if (d > 1e-4 && d < 2 && m.st !== 1) { axis.crossVectors(up, axis).normalize(); q.setFromAxisAngle(axis, d / R); m.mesh.quaternion.premultiply(q); }
    }
    // camera
    const lead = leader(), target = follow >= 0 && marbles[follow] && marbles[follow].st !== 3 ? follow : lead;
    const tm = marbles[target];
    if (stage === 'bet') { // fly down the track so everyone can see what's coming
      flyT += dt; const s = (flyT * 13) % Math.max(20, T.L - 6);
      world(T, Math.max(0, s - 7), 0, 6.5, tmp); want.set(tmp[0], tmp[1], tmp[2]);
      world(T, s + 9, 0, .5, tmp); look.set(tmp[0], tmp[1], tmp[2]);
    } else if (stage === 'count' || !tm) {
      world(T, GATE_S + 8.5, 2.2, 5.6, tmp); want.set(tmp[0], tmp[1], tmp[2]);
      world(T, GATE_S - 1.5, 0, .4, tmp); look.set(tmp[0], tmp[1], tmp[2]);
    } else if (stage === 'end' || stage === 'gap') {
      endT += dt; const a = endT * .25, cs = T.L + 6;
      world(T, cs, 0, 0, tmp); look.set(tmp[0], tmp[1] + .5, tmp[2]);
      want.set(tmp[0] + Math.sin(a) * 12, tmp[1] + 6.5, tmp[2] + Math.cos(a) * 12);
    } else {
      const ts = tm.st === 1 ? camS : tm.s;
      if (Math.abs(ts - camS) > 30) { camS = ts; camU = tm.u; camInit = false; } // cut instead of a long pan
      camS += (ts - camS) * Math.min(1, dt * (Math.abs(ts - camS) > 12 ? 2 : 5)); camU += (tm.u - camU) * Math.min(1, dt * 2);
      world(T, Math.max(0, camS - 10.5), camU * .35, 6.4, tmp); want.set(tmp[0], tmp[1], tmp[2]);
      world(T, Math.min(T.end, camS + 1.2), camU * .6, 1, tmp); look.set(tmp[0], tmp[1], tmp[2]);
    }
    if (stage !== 'end' && stage !== 'gap') endT = 0;
    if (stage !== 'bet') flyT = 0;
    if (!camInit) { camera.position.copy(want); lookNow.copy(look); camInit = true; if (tm) { camS = tm.s; camU = tm.u; } }
    const kk = Math.min(1, dt * (stage === 'race' ? 6 : 2.5));
    camera.position.lerp(want, kk); lookNow.lerp(look, kk);
    camera.up.set(0, 1, 0); camera.lookAt(lookNow);
    fx.roll += (fx.rollTo - fx.roll) * Math.min(1, dt * 4);
    if (Math.abs(fx.roll) > .002) camera.rotateZ(fx.roll);
    if (fx.shake > 0 && !reduced) { camera.position.x += (Math.random() - .5) * .35; camera.position.y += (Math.random() - .5) * .35; }
    fx.fov += (fx.fovTo - fx.fov) * Math.min(1, dt * 4);
    if (Math.abs(camera.fov - fx.fov) > .05) { camera.fov = fx.fov; camera.updateProjectionMatrix(); }
    key.target.position.copy(lookNow); key.position.set(lookNow.x + 9, lookNow.y + 24, lookNow.z - 7);
    // sparkles
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += dt; b.v.y -= 12 * dt; b.s.position.addScaledVector(b.v, dt); b.s.material.opacity = 1 - b.t / .8;
      if (b.t > .8) { scene.remove(b.s); b.s.material.dispose(); bursts.splice(i, 1); }
    }
    const mm = marbles[mine];
    arrow.visible = !!mm && mm.mesh.visible;
    if (arrow.visible) {
      arrow.position.copy(mm.pos); arrow.position.y += R + .16 + (reduced ? 0 : Math.sin(t * 3.2) * .09);
      arrow.rotation.y = reduced ? 0 : t * 2.4;
    }
    renderer.render(scene, camera);
    // screen positions of the marbles (reactions float up from them)
    for (const m of marbles) {
      if (!m.mesh.visible) { m.tag.show = false; continue; }
      proj.copy(m.pos); proj.y += R + .25; proj.project(camera);
      m.tag.show = proj.z < 1 && proj.z > -1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      m.tag.x = (proj.x + 1) / 2 * W; m.tag.y = (1 - proj.y) / 2 * H;
      m.tag.d = camera.position.distanceTo(m.pos);
    }
    onFrame?.({ tags: marbles.map(m => m.tag), s: marbles.map(m => m.s), st: marbles.map(m => m.st), target, L: T.L });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setTrack, setMarbles, pushFrames, burst,
    setStage(s) { stage = s; },
    setFollow(i) { follow = i; },
    setMe(i) { mine = i; },
    setChaos(k) {
      fx.rollTo = k === 'flip' && !reduced ? Math.PI : 0;
      fx.shake = k === 'quake' ? 1 : 0;
      fx.fovTo = k === 'turbo' ? 62 : 48;
    },
    dispose() {
      ticker.stop();
      if (trackGroup) disposeTree(trackGroup);
      for (const m of marbles) { m.mesh.material.map.dispose(); m.mesh.material.dispose(); }
      sharedGeo.dispose(); dot.dispose(); arrow.traverse(o => o.geometry?.dispose()); arrowM.dispose(); renderer.dispose();
    },
  };
}

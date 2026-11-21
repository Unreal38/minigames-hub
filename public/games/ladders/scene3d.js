// Snakes & Ladders 3D view (three.js). Purely visual: it replays the moves the server worked out.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { frameLoop, autoResolution } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { cell, COLS, MS as MSv } from './board.js';
import { toonify, toonMat, shell, skyDome, clouds, island, birds, petals, createFx, shaker, disposeToon, STAR, DOT, HEART, CONF } from '../../scenery3d.js';

const INK = '#3b2219', SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff';
const U = 1.2, HALF = COLS * U / 2, TOKEN = .3;
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...o });
const TILE_COLS = ['#fff4e2', '#ffd9c2', '#d8f0e2', '#ffe9a8', '#e6defc'];
const SNAKE_COLS = [['#6cc96a', '#c8f2b4'], ['#ff7aa0', '#ffd0dc'], ['#8a98ff', '#d8dcff'], ['#7ed3b2', '#d8f6ea'], ['#5cc4e0', '#c8f0fa'], ['#d88ad0', '#f6d4f2']];
const SP_COL = { boost: '#7ed3b2', again: '#ffb547', swap: '#e8a0e0', nap: '#9aa8ff' };
// die faces in BoxGeometry material order (+x, -x, +y, -y, +z, -z) and the turn that puts each value on top
const FACES = [3, 4, 1, 6, 2, 5];
const UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] };
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function softDot() {
  return canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#ffffffff'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
}
function pipTex(v) {
  const P = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] }[v];
  return canvasTex(128, 128, g => {
    g.fillStyle = '#fff8ec'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#e8d3b8'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
    g.fillStyle = v === 1 ? '#e5543b' : INK;
    for (const [x, y] of P) { g.beginPath(); g.arc(x * 32, y * 32, v === 1 ? 17 : 12, 0, 6.3); g.fill(); }
  });
}

// Little icons painted on party tiles.
function drawSpecial(g, k, x, y, s) {
  g.save(); g.translate(x, y); g.lineWidth = s * .09; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = INK; g.fillStyle = INK;
  if (k === 'boost') for (const o of [-.16, .14]) { g.beginPath(); g.moveTo(-s * .22, s * (o + .12)); g.lineTo(0, s * (o - .1)); g.lineTo(s * .22, s * (o + .12)); g.stroke(); }
  else if (k === 'again') {
    g.beginPath(); g.arc(0, 0, s * .2, -.4, 4.4); g.stroke();
    g.beginPath(); g.moveTo(s * .2, -s * .2); g.lineTo(s * .22, s * .02); g.lineTo(s * .02, -s * .04); g.closePath(); g.fill();
  } else if (k === 'swap') {
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(-s * .22 * d, s * .09 * d); g.lineTo(s * .22 * d, s * .09 * d); g.lineTo(s * .12 * d, s * .19 * d); g.stroke(); }
  } else if (k === 'nap') { g.font = `700 ${s * .36}px Fredoka, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Zz', 0, s * .02); }
  g.restore();
}

function boardTexture(B) {
  const px = 128, rows = B.rows;
  return canvasTex(COLS * px, rows * px, g => {
    const sp = new Map(B.specials.map(s => [s.at, s.k]));
    for (let n = 1; n <= B.size; n++) {
      const { row, col } = cell(n), x = col * px, y = (rows - 1 - row) * px;
      const k = sp.get(n);
      g.fillStyle = n === B.size ? '#ffc93c' : k ? SP_COL[k] : TILE_COLS[(row + col) % 2 ? 0 : 1 + (row + (col >> 1)) % 4];
      g.fillRect(x, y, px, px);
      g.strokeStyle = '#3b221933'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, px - 3, px - 3);
      g.fillStyle = '#3b2219b0'; g.font = `600 ${n === B.size ? 30 : 26}px Fredoka, system-ui, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(String(n), x + 10, y + 8);
      if (k) { g.globalAlpha = .85; drawSpecial(g, k, x + px / 2, y + px * .58, px); g.globalAlpha = 1; }
      if (B.ladders.some(l => l.broken && l.from === n)) { // a little warning sign at the foot of a broken ladder
        const cx = x + px - 26, cy = y + px - 26;
        g.fillStyle = '#ff7a59'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy - 18); g.lineTo(cx + 18, cy + 14); g.lineTo(cx - 18, cy + 14); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = INK; g.fillRect(cx - 2.5, cy - 7, 5, 11); g.fillRect(cx - 2.5, cy + 6, 5, 5);
      }
      if (B.snakes.some(sn => sn.up && sn.from === n)) { // gold up-arrow at the head of a reversed snake, where you climb on
        const cx = x + px - 26, cy = y + px - 24;
        g.fillStyle = '#ffc93c'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath();
        g.moveTo(cx, cy - 18); g.lineTo(cx + 15, cy); g.lineTo(cx + 6, cy); g.lineTo(cx + 6, cy + 14); g.lineTo(cx - 6, cy + 14); g.lineTo(cx - 6, cy); g.lineTo(cx - 15, cy); g.closePath(); g.fill(); g.stroke();
      }
      if (n === B.size) {
        g.fillStyle = '#fff4e2'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 40; g.lineTo(x + px / 2 + Math.cos(a) * r, y + px * .58 + Math.sin(a) * r); }
        g.closePath(); g.fill(); g.stroke();
      }
    }
  });
}

// A tube that gets thinner towards the tail, with stripes painted as vertex colours.
function snakeBody(curve, r0, r1, c0, c1) {
  const segs = 90, rad = 12, fr = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], col = [], idx = [], A = new THREE.Color(c0), Bc = new THREE.Color(c1), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, r = (r0 + (r1 - r0) * t) * (t > .94 ? Math.max(.15, (1 - t) / .06) : 1);
    curve.getPointAt(t, p);
    const c = Math.floor(t * 14) % 2 ? Bc : A;
    for (let j = 0; j <= rad; j++) {
      const a = j / rad * Math.PI * 2;
      n.copy(fr.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r); nor.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
    const a = i * (rad + 1) + j, b = a + rad + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export function createScene(canvas, { onFrame, onCue }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const res = autoResolution(renderer, 1.5); // steps the resolution down if the device can't hold 60 fps
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 70, 190);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 500);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(6, 16, 9); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
  key.shadow.bias = -.0005; key.shadow.normalBias = .03; scene.add(key);

  // the world: a sunny sky, a sea of clouds, and a floating meadow the board sits on (built once the board size is known)
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 14, max: 85, below: -10 }); scene.add(cloudRing);
  let land = null;
  const flyBirds = birds(scene, 20, 7, 4, 1.2), blow = petals(scene, 26, 4.5, { n: 10, size: .12 });
  const fx = createFx(scene), shake = shaker();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let B = null, boardGroup = null, snakes = [], ladders = [], toks = [], seatsKey = '', seats = [];
  let mv = null, mvStart = 0, mvPlan = null, cueAt = 0, turn = -1, stage = 'roll', me = -1;
  const arrow = youArrow(); arrow.visible = false; scene.add(arrow);
  const later = []; // effects booked for a moment later in the current move: [ms, fn]

  function disposeTree(o) {
    o.traverse(x => { x.geometry?.dispose(); for (const m of [].concat(x.material || [])) { m.map?.dispose(); m.dispose(); } });
  }

  // tile centre on the board (0 = the start mat beside tile 1)
  function tileXZ(n, out = new THREE.Vector3()) {
    if (n <= 0) return out.set(-HALF - U * .95, 0, (B.rows / 2 - .5) * U);
    const { row, col } = cell(Math.min(n, B.size));
    return out.set((col - (COLS - 1) / 2) * U, 0, (B.rows / 2 - row - .5) * U);
  }

  // ---------- board ----------
  let pendingBoard = null;
  const sigOf = b => b.seed + '/' + b.size + '/' + b.ladders.map(l => (l.broken ? 1 : 0)).join('');
  function setBoard(b) {
    if (B && sigOf(B) === sigOf(b)) return;
    // a ladder that just cracked: keep showing it whole until the climb that broke it has played out
    if (B && B.seed === b.seed && mv && performance.now() - mvStart < mv.ms) { pendingBoard = b; return; }
    pendingBoard = null;
    if (boardGroup) { scene.remove(boardGroup); disposeToon(boardGroup); }
    const grew = !B || B.rows !== b.rows;
    B = b; snakes = []; ladders = [];
    const g = boardGroup = new THREE.Group(); scene.add(g);
    const D = B.rows * U;
    if (grew) { if (land) { scene.remove(land); disposeToon(land); } land = island(COLS * U + 3.9, D + 1.5, { seed: 3, props: 18, rim: 1.25, size: 1.5 }); land.position.y = -.42; scene.add(land); }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(COLS * U + .7, .36, D + .7), M('#c4885a', { roughness: .7 }));
    frame.position.y = -.2; frame.receiveShadow = frame.castShadow = true; g.add(frame);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(COLS * U + .9, .14, D + .9), M('#7a4a2b')); lip.position.y = -.34; g.add(lip);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(COLS * U, D), M('#ffffff', { map: boardTexture(B), roughness: .8 }));
    top.rotation.x = -Math.PI / 2; top.position.y = -.015; top.receiveShadow = true; g.add(top);
    // start mat
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(U * .62, U * .66, .14, 32), M('#ffb547', { roughness: .7 }));
    tileXZ(0, mat.position); mat.position.y = -.27; mat.receiveShadow = true; g.add(mat);
    const matTop = new THREE.Mesh(new THREE.CircleGeometry(U * .5, 32), M('#fff4e2', { map: canvasTex(128, 128, c => { c.fillStyle = '#fff4e2'; c.fillRect(0, 0, 128, 128); c.fillStyle = INK; c.font = '700 30px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('START', 64, 66); }) }));
    matTop.rotation.x = -Math.PI / 2; matTop.position.set(mat.position.x, -.195, mat.position.z); g.add(matTop);
    // ladders: two rails arching a little off the board, with rungs
    const wood = M('#c98b4f', { roughness: .55 }), rung = M('#f0c27a', { roughness: .55 }), cracked = M('#a0714a', { roughness: .7 }), splinter = M('#f6d3a0', { roughness: .8 });
    for (const l of B.ladders) {
      const a = tileXZ(l.from), b = tileXZ(l.to), d = b.clone().sub(a), len = d.length(); d.normalize();
      const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(.24);
      const lift = .18 + len * .025, at = (t, s, out = new THREE.Vector3()) => out.copy(a).lerp(b, t).addScaledVector(side, s).setY(.08 + Math.sin(Math.PI * t) * lift);
      const railCurve = s => new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => at(i / 8, s)));
      const railCurve2 = (s, t0, t1) => new THREE.CatmullRomCurve3(Array.from({ length: 6 }, (_, i) => at(t0 + (t1 - t0) * i / 5, s)));
      const gap = l.broken ? [.4, .6] : null, mat = l.broken ? cracked : wood;
      for (const s of [-1, 1]) {
        const parts = gap ? [railCurve2(s, 0, gap[0]), railCurve2(s, gap[1], 1)] : [railCurve(s)];
        for (const c of parts) { const m = new THREE.Mesh(new THREE.TubeGeometry(c, 20, .065, 8), mat); m.castShadow = true; g.add(m); }
        if (gap) for (const [t, dirn] of [[gap[0], 1], [gap[1], -1]]) { // splintered ends pointing into the gap
          const p0 = at(t, s), p1 = at(t + dirn * .04, s), sp = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 5), splinter);
          sp.position.copy(p0); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.sub(p0).normalize()); sp.position.addScaledVector(sp.up.clone().applyQuaternion(sp.quaternion), .09); g.add(sp);
        }
      }
      const nR = Math.max(3, Math.round(len / .42));
      for (let i = 1; i < nR; i++) {
        const t = i / nR, p0 = at(t, -1), p1 = at(t, 1), mid = p0.clone().add(p1).multiplyScalar(.5);
        if (gap && t > gap[0] - .03 && t < gap[1] + .03) continue;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, p0.distanceTo(p1), 8), rung);
        m.position.copy(mid); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); m.castShadow = true; g.add(m);
      }
      ladders.push({ ...l, path: new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => at(i / 8, 0).add(new THREE.Vector3(0, .05, 0)))) });
    }
    // snakes: a wiggly stripy body from head to tail, with a cute face
    B.snakes.forEach((s, k) => {
      // a is the head end (where you step on). A reversed snake faces down the board, head at the bottom and
      // tail up top, so you climb it from its head to its tail; it is golden so it stands out.
      const a = tileXZ(s.from), b = tileXZ(s.to), d = b.clone().sub(a), len = d.length(); d.normalize();
      const side = new THREE.Vector3(-d.z, 0, d.x), waves = Math.max(2, Math.round(len / 2.2)), amp = Math.min(.7, .3 + len * .04);
      const nP = waves * 2 + 3, pts = Array.from({ length: nP }, (_, i) => {
        const t = i / (nP - 1);
        return a.clone().lerp(b, t).addScaledVector(side, Math.sin(t * waves * Math.PI) * amp * (t < .08 ? 0 : 1)).setY(.13 + Math.sin(t * Math.PI) * .12);
      });
      const curve = new THREE.CatmullRomCurve3(pts);
      const [c0, c1] = s.up ? ['#ffc93c', '#fff4e2'] : SNAKE_COLS[k % SNAKE_COLS.length];
      const body = new THREE.Mesh(snakeBody(curve, .17, .07, c0, c1), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45 }));
      body.castShadow = true; g.add(body);
      const head = new THREE.Group(), dir = curve.getTangentAt(0).negate();
      head.position.copy(a).setY(.2);
      // the head points the way the body leads out of it, nose tipped up a little; the eyes sit high on top so they show from any side
      head.rotation.order = 'YXZ';
      head.rotation.set(-.22, Math.atan2(dir.x, dir.z), 0);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(.26, 20, 16), M(c0, { roughness: .45 })); skull.scale.set(1.05, .78, 1.3); skull.castShadow = true; head.add(skull);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 10), M('#ffffff', { roughness: .3 })); eye.position.set(sx * .12, .2, .06); head.add(eye);
        const pup = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), M(INK, { roughness: .2 })); pup.position.set(sx * .13, .25, .1); head.add(pup);
        const blush = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), M('#ff8fab')); blush.scale.set(1, .5, .6); blush.position.set(sx * .2, .02, .2); head.add(blush);
      }
      const tongue = new THREE.Mesh(new THREE.BoxGeometry(.05, .015, .2), M('#e5543b')); tongue.position.set(0, -.04, .38); head.add(tongue);
      toonify(head, .022); head.userData.dyn = true; g.add(head);
      snakes.push({ ...s, path: curve, head, tongue, k });
    });
    bake(g); // ladders, rungs, frame and mat collapse into a few meshes
    g.traverse(m => { if (m.isMesh && m.userData.baked) m.castShadow = m.receiveShadow = true; });
    toonify(g, .03); // cartoon shading and one dark outline round the lot
    renderer.shadowMap.needsUpdate = true;
    seatsKey = ''; // rebuild tokens so they land on the new board
    setSeats(seats);
  }

  // ---------- tokens: a chibi avatar sitting on a round puck ----------
  function setSeats(list) {
    seats = list;
    if (!B) return;
    const k = list.map(p => p.color + p.av.join('')).join('|');
    if (k !== seatsKey) {
      seatsKey = k;
      for (const t of toks) { scene.remove(t.g); disposeAvatar(t.av); t.ring.material.dispose(); }
      toks = list.map((p, i) => {
        const g = new THREE.Group();
        const puck = new THREE.Mesh(new THREE.CylinderGeometry(.34, .38, .14, 28), toonMat(M(p.color, { roughness: .5 }))); puck.position.y = .07; puck.castShadow = true;
        const edge = new THREE.Mesh(new THREE.CylinderGeometry(.375, .415, .17, 28), new THREE.MeshBasicMaterial({ color: '#4a2c22', side: THREE.BackSide })); puck.add(edge);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.34, .035, 8, 28), M('#fff4e2')); ring.rotation.x = Math.PI / 2; ring.position.y = .14;
        const av = avatar3d(p.color, p.av); av.scale.setScalar(TOKEN); av.position.y = .14 + .76 * TOKEN;
        const wrap = new THREE.Group(); wrap.add(av); g.add(puck, ring, wrap); scene.add(g);
        return { g, puck, ring, av, wrap, pos: new THREE.Vector3(), cur: new THREE.Vector3(), init: false, hop: 0, spin: 0, tag: { x: 0, y: 0, show: false } };
      });
    }
  }

  // ---------- moves ----------
  function plan(m) {
    const P = [{ k: 'die', d: MSv.die }];
    let tile = m.from;
    for (const s of m.segs) {
      if (s.t === 'walk') for (const t of s.tiles) { P.push({ k: 'hop', d: MSv.step, a: tile, b: t }); tile = t; }
      else if (s.t === 'ladder' || s.t === 'snake') { P.push({ k: s.t, d: MSv[s.t], a: s.from, b: s.to, up: s.up }); tile = s.to; }
      else if (s.t === 'broken') { P.push({ k: 'broken', d: MSv.broken, a: s.from, b: s.to }); tile = s.to; }
      else if (s.t === 'crack' || s.t === 'stuck') P.push({ k: s.t, d: MSv[s.t], a: s.at ?? tile, tile });
      else if (s.t === 'special') P.push({ k: 'special', d: MSv.special, sp: s.k, a: tile });
      else if (s.t === 'swap') { P.push({ k: 'swap', d: MSv.swap, a: s.b, b: s.a, other: s.with }); tile = s.a; }
    }
    let t = 0; for (const p of P) { p.t0 = t; t += p.d; }
    P.end = tile;
    return P;
  }

  // die
  const dieMats = FACES.map(v => toonMat(new THREE.MeshStandardMaterial({ map: pipTex(v), roughness: .35 })));
  const die = new THREE.Mesh(new THREE.BoxGeometry(.62, .62, .62), dieMats); die.castShadow = true; scene.add(die); shell(die, 1.09);
  const dieQ = new THREE.Quaternion(), dieFrom = new THREE.Quaternion(), dieSpin = new THREE.Vector3();
  let dieVal = 6;
  let tall = false; // portrait phones: die sits below the board and the camera leans in on whoever is moving
  const dieRest = () => tall && B ? new THREE.Vector3(HALF - U * .6, .31, B.rows * U / 2 + U * .95) : new THREE.Vector3(HALF + U * 1.1, .31, B ? (B.rows / 2 - 1) * U : 0);
  function setDie(v) {
    dieVal = v;
    const e = UP[v]; dieQ.setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
    dieQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - .5) * .8));
  }
  setDie(6); die.quaternion.copy(dieQ);

  function setMove(m) {
    if (!m) { mv = null; return; }
    if (mv && mv.n === m.n) return;
    mv = m; mvPlan = plan(m); mvStart = performance.now() - m.ago; cueAt = 0; later.length = 0;
    if (m.ago > m.ms) { cueAt = mvPlan.length; setDie(m.die); die.quaternion.copy(dieQ); return; } // old news: just show the end
    dieFrom.copy(die.quaternion); setDie(m.die);
    dieSpin.set(Math.random() * 14 + 8, Math.random() * 10, Math.random() * 14 + 8);
  }

  // where token i is at time t of the current move (null when the move does not involve it)
  const tA = new THREE.Vector3(), tB = new THREE.Vector3();
  function moveAt(i, t, out) {
    if (!mv || t >= mv.ms) return null;
    const mover = i === mv.s, swapP = mvPlan.find(p => p.k === 'swap');
    if (!mover && !(swapP && swapP.other === i)) return null;
    if (!mover) { // swap partner waits, then flies to its new tile
      if (t < swapP.t0) return { tile: swapP.b, p: tileXZ(swapP.b, out) };
      const u = Math.min(1, (t - swapP.t0) / swapP.d);
      tileXZ(swapP.b, tA); tileXZ(swapP.a, tB); out.copy(tA).lerp(tB, ease(u)); out.y = Math.sin(Math.PI * u) * 1.6;
      return { tile: swapP.a, p: out, air: true };
    }
    let cur = null;
    for (const p of mvPlan) if (t >= p.t0) cur = p;
    const u = Math.min(1, (t - cur.t0) / cur.d);
    if (cur.k === 'die') return { tile: mv.from, p: tileXZ(mv.from, out) };
    if (cur.k === 'hop') { tileXZ(cur.a, tA); tileXZ(cur.b, tB); out.copy(tA).lerp(tB, u); out.y = Math.sin(Math.PI * u) * .55; return { tile: cur.b, p: out, air: true, hop: 1 - u }; }
    if (cur.k === 'ladder') { const L = ladders.find(l => l.from === cur.a); L.path.getPointAt(ease(u), out); return { tile: cur.b, p: out, air: true }; }
    if (cur.k === 'snake') {
      const S = snakes.find(s => s.from === cur.a), v = u < .15 ? 0 : ease((u - .15) / .85);
      S.path.getPointAt(v, out); out.y += .1; return { tile: cur.b, p: out, air: true, wob: u };
    }
    if (cur.k === 'broken') { // climb to the gap, then drop through it onto the tile halfway
      const L = ladders.find(l => l.from === cur.a);
      if (u < .62) { L.path.getPointAt(ease(u / .62) * .42, out); return { tile: cur.b, p: out, air: true }; }
      const v = (u - .62) / .38; L.path.getPointAt(.42, tA); tileXZ(cur.b, tB);
      out.copy(tA).lerp(tB, v); out.y = tA.y * (1 - v * v) + Math.sin(Math.PI * v) * .3; return { tile: cur.b, p: out, air: true, wob: u };
    }
    if (cur.k === 'crack' || cur.k === 'stuck') { tileXZ(cur.tile, out); return { tile: cur.tile, p: out, wob: cur.k === 'stuck' ? u : undefined }; }
    if (cur.k === 'special') return { tile: cur.a, p: tileXZ(cur.a, out), spin: u, sp: cur.sp };
    if (cur.k === 'swap') { tileXZ(cur.a, tA); tileXZ(cur.b, tB); out.copy(tA).lerp(tB, ease(u)); out.y = Math.sin(Math.PI * u) * 1.6; return { tile: cur.b, p: out, air: true }; }
    return null;
  }

  // ---------- effects ----------
  const GOLD = ['#ffd84a', '#fff1a8', '#ffffff'], LEAF = ['#7ed37a', '#c8f2b4', '#ffffff'], WOOD = ['#f6d3a0', '#c98b4f', '#8a5a3c'];
  const at = (n, y = 0) => { const v = tileXZ(n, new THREE.Vector3()); v.y = y; return v; };
  function cueFx(p, t) {
    if (reduced) return;
    const book = (ms, fn) => later.push([t + ms, fn]);
    if (p.k === 'die') book(MSv.die * .55, () => { fx.puff(die.position.clone().setY(0), { n: 8, size: .3 }); shake.kick(.05); });
    else if (p.k === 'hop') book(p.d, () => fx.puff(at(p.b), { n: 6, size: .22, speed: 1.6, life: .4 }));
    else if (p.k === 'ladder') {
      fx.ring(at(p.a), { color: '#ffd84a' }); fx.burst(at(p.a, .3), { n: 8, colors: GOLD, speed: 2, up: 3, size: .2 });
      for (let k = 1; k < 8; k++) book(p.d * k / 8, () => { const tk = toks[mv?.s]; if (tk) fx.sparkle(tk.cur, { n: 2, colors: GOLD, r: .35, size: .2, life: .6 }); });
      book(p.d, () => { fx.burst(at(p.b, .5), { n: 22, colors: GOLD, speed: 3.5, up: 4.5, size: .28, life: 1 }); fx.ring(at(p.b), { color: '#fff1a8', size: 1.8 }); shake.kick(.08); });
    } else if (p.k === 'snake') {
      if (p.up) { fx.burst(at(p.a, .4), { n: 14, colors: GOLD, speed: 3, up: 4 }); book(p.d, () => { fx.burst(at(p.b, .5), { n: 22, colors: GOLD, speed: 3.5, up: 4.5, size: .28, life: 1 }); shake.kick(.08); }); }
      else {
        fx.burst(at(p.a, .4), { n: 14, colors: LEAF, speed: 3.2, up: 3.5, shape: [STAR, DOT] }); fx.ring(at(p.a), { color: '#ff7a59', size: 1.6 }); shake.kick(.22);
        for (let k = 2; k < 9; k++) book(p.d * k / 9, () => { const tk = toks[mv?.s]; if (tk) fx.puff(tk.cur, { n: 2, size: .2, speed: .8, life: .35, color: '#ffffff' }); });
        book(p.d, () => { fx.puff(at(p.b), { n: 12, size: .34 }); fx.burst(at(p.b, .9), { n: 6, colors: ['#ffd84a', '#ffffff'], speed: 1.2, up: 1.5, grav: 0, life: 1.1, size: .2 }); shake.kick(.14); });
      }
    } else if (p.k === 'crack' || p.k === 'broken') {
      const hit = () => { fx.burst(at(p.a, .5), { n: 18, colors: WOOD, speed: 3.5, up: 3.5, shape: CONF, size: .2, spin: 16 }); fx.puff(at(p.a), { n: 10, color: '#f6d3a0' }); shake.kick(.25); };
      if (p.k === 'broken') { book(p.d * .62, hit); book(p.d, () => { fx.puff(at(p.b), { n: 12, size: .34 }); shake.kick(.12); }); } else hit();
    } else if (p.k === 'stuck') fx.burst(at(p.a, .9), { n: 5, colors: ['#9aa8ff', '#ffffff'], speed: .8, up: 1.4, grav: 0, life: 1.2, size: .2 });
    else if (p.k === 'special') {
      const c = SP_COL[p.sp]; fx.ring(at(p.a), { color: c, size: 1.8 });
      fx.burst(at(p.a, .5), { n: 18, colors: [c, '#ffffff', '#fff1a8'], speed: 3, up: 4, size: .26, shape: p.sp === 'nap' ? DOT : STAR });
    } else if (p.k === 'swap') { for (const n of [p.a, p.b]) { fx.ring(at(n), { color: '#e8a0e0', size: 1.8 }); fx.burst(at(n, .4), { n: 12, colors: ['#e8a0e0', '#ffffff', '#ffd84a'], speed: 2.6, up: 4, shape: [STAR, HEART] }); }
      book(p.d, () => { for (const n of [p.a, p.b]) fx.puff(at(n), { n: 10 }); shake.kick(.1); }); }
  }
  // reaching the last tile: a shower of confetti over the board
  function party(n) {
    if (reduced) return;
    const c = at(n, 0); fx.confetti(c, { n: 110, w: 7, h: 5 }); fx.burst(c.clone().setY(.6), { n: 30, colors: GOLD, speed: 5, up: 6, size: .32, life: 1.3 }); shake.kick(.18);
    later.push([(mv ? performance.now() - mvStart : 0) + 500, () => fx.confetti(at(n, 0), { n: 80, w: 9, h: 5 })]);
  }

  // ---------- frame loop ----------
  const proj = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3(), want = new THREE.Vector3(), camAt = new THREE.Vector3(), tmp = new THREE.Vector3();
  let W = 0, H = 0, camInit = false, shadowIn = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  function loop(dt) {
    resize();
    const now = performance.now(), T = now / 1000;
    if (!B) { renderer.render(scene, camera); return; }
    const t = mv ? now - mvStart : 0;
    if (pendingBoard && (!mv || t >= mv.ms)) setBoard(pendingBoard);
    // cues for sound and pop-ups
    if (mv && mvPlan) while (cueAt < mvPlan.length && t >= mvPlan[cueAt].t0) {
      const p = mvPlan[cueAt++];
      onCue?.({ k: p.k, s: mv.s, die: mv.die, sp: p.sp, other: p.other, a: p.a, b: p.b, up: p.up, last: !mvPlan[cueAt] });
      cueFx(p, p.t0);
      if (!mvPlan[cueAt] && mvPlan.end === B.size) later.push([mv.ms - 40, () => party(B.size)]);
    }
    if (later.length) { if (!mv) later.length = 0; else for (let i = later.length - 1; i >= 0; i--) if (t >= later[i][0]) { const f = later[i][1]; later.splice(i, 1); f(); } }
    // where everyone stands: resting tokens share tiles politely
    const rest = new Map(), info = toks.map((_, i) => moveAt(i, t, new THREE.Vector3()));
    seats.forEach((p, i) => { if (!info[i]) { const k = p.pos; if (!rest.has(k)) rest.set(k, []); rest.get(k).push(i); } });
    for (const [tile, ids] of rest) ids.forEach((i, k) => {
      const tk = toks[i]; tileXZ(tile, tk.pos);
      if (ids.length > 1) { const a = k / ids.length * Math.PI * 2 + .6, r = ids.length > 3 ? .34 : .28; tk.pos.x += Math.cos(a) * r; tk.pos.z += Math.sin(a) * r; }
    });
    toks.forEach((tk, i) => {
      const f = info[i];
      if (f) { tk.pos.copy(f.p); tk.cur.copy(f.p); }
      else { if (!tk.init) tk.cur.copy(tk.pos); tk.cur.lerp(tk.pos, Math.min(1, dt * 10)); }
      tk.init = true;
      tk.g.position.copy(tk.cur);
      const active = i === turn && stage === 'roll';
      tk.wrap.rotation.y = f?.spin !== undefined ? ease(f.spin) * Math.PI * 2 : f?.wob !== undefined ? Math.sin(f.wob * 30) * .4 : 0;
      tk.wrap.position.y = active && !reduced ? Math.abs(Math.sin(T * 4)) * .12 : 0;
      animateAvatar(tk.av, T, { seed: i, active: active || !!f, hop: f?.hop || 0, nod: f?.wob ? .4 : 0 });
      tk.av.scale.multiplyScalar(TOKEN);
      tk.ring.material.emissive.set(active ? '#ffb547' : '#000000'); tk.ring.material.emissiveIntensity = active ? .6 + Math.sin(T * 5) * .3 : 0;
    });
    // your own token wears a little bobbing arrow
    const mine = toks[me];
    arrow.visible = !!mine;
    if (mine) { arrow.position.copy(mine.cur); arrow.position.y += 1.3 + mine.wrap.position.y; animateArrow(arrow, T); }
    // snakes flick their tongues
    for (const s of snakes) { const ph = (T * 1.3 + s.k * .7) % 3; s.tongue.scale.z = ph < .3 ? 1 + Math.sin(ph / .3 * Math.PI) * 1.2 : 1; s.head.rotation.z = Math.sin(T * 1.2 + s.k) * .08; }
    // the die: tumbles while the move starts, otherwise rests by the board
    const restP = dieRest();
    if (mv && t < MSv.die) {
      const u = t / MSv.die, start = tileXZ(seats[mv.s] ? Math.max(0, mv.from) : 0, tmp).clone();
      start.y = 2.4;
      die.position.copy(start).lerp(restP, ease(Math.min(1, u * 1.3)));
      die.position.y = restP.y + Math.abs(Math.sin(u * Math.PI * 2.2)) * (1 - u) * 1.8 + (1 - Math.min(1, u * 1.3)) * 1.4;
      if (u < .7) die.rotation.set(dieSpin.x * u, dieSpin.y * u, dieSpin.z * u);
      else die.quaternion.slerp(dieQ, Math.min(1, (u - .7) / .3 * .6 + .1));
    } else { die.position.lerp(restP, Math.min(1, dt * 6)); die.quaternion.slerp(dieQ, Math.min(1, dt * 8)); }
    // camera: the whole board, drifting a touch towards whoever is moving
    tall = camera.aspect < .8;
    const D = B.rows * U, hw = HALF + (tall ? 1.4 : 2.6), hd = D / 2 + (tall ? 2 : 1.6), el = tall ? 1.08 : .98, fv = camera.fov * Math.PI / 360;
    const dist = (Math.max(hd * Math.sin(el) / Math.tan(fv), hw / (Math.tan(fv) * camera.aspect)) * 1.04 + hd * Math.cos(el) * .5) * (tall ? .72 : 1);
    const focus = toks[mv && t < mv.ms ? mv.s : turn];
    look.set(tall ? 0 : .5, 0, tall ? .8 : .3); if (focus) look.lerp(focus.cur, tall ? .5 : .14);
    want.set(look.x, look.y + Math.sin(el) * dist, look.z + Math.cos(el) * dist);
    if (!camInit) { camAt.copy(want); lookNow.copy(look); camInit = true; }
    camAt.lerp(want, Math.min(1, dt * 2)); lookNow.lerp(look, Math.min(1, dt * 2)); camera.position.copy(camAt);
    if (!reduced) { camera.position.x += Math.sin(T * .22) * .35; camera.position.y += Math.sin(T * .31) * .12; } // a slow, gentle drift
    camera.lookAt(lookNow); shake.apply(camera, dt);
    cloudRing.rotation.y = T * .006; flyBirds(T); blow(T);
    fx.update(dt, camera, H);
    shadowIn -= dt; // shadows refresh a few times a second, more often while a token is moving
    if (shadowIn <= 0) { renderer.shadowMap.needsUpdate = true; shadowIn = mv && t < mv.ms + 300 ? .05 : .3; }
    renderer.render(scene, camera);
    for (const tk of toks) {
      proj.copy(tk.cur); proj.y += 1.1; proj.project(camera);
      tk.tag.show = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      tk.tag.x = (proj.x + 1) / 2 * W; tk.tag.y = (1 - proj.y) / 2 * H;
    }
    onFrame?.({ tags: toks.map(tk => tk.tag), busy: !!mv && t < mv.ms });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setBoard, setSeats, setMove,
    setTurn(i, s) { turn = i; stage = s; },
    setMe(i) { me = i; },
    dispose() {
      ticker.stop();
      if (boardGroup) disposeToon(boardGroup); if (land) disposeToon(land); fx.dispose();
      for (const t of toks) { disposeAvatar(t.av); t.ring.material.dispose(); }
      disposeArrow(arrow); disposeTree(die); renderer.dispose();
    },
  };
}

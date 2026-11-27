// Kalambury 3D scene (three.js): a big easel on a sky island with everyone's avatar sitting on a bench in front of it.
// The camera looks at the easel straight on and never moves, so the page can lay its drawing canvas exactly over
// the easel's paper (onLayout tells it where that is on screen). Purely visual: it shows what the server says.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, nightScene, roundDeck } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { BW, BH } from './rules.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const PW = 12, PH = PW * BH / BW, PY = 4.3;      // the paper: width, height, and how high its bottom edge is
const ROW_Z = 2.3, SEAT_Y = .42, AV = .8, ROW_W = 12.4;   // the bench in front of the easel; avatars are a little smaller than life
const HEAD_Y = SEAT_Y + (.76 + 2.12) * AV;
const slotOf = n => Math.min(2.1, ROW_W / Math.max(1, n));
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });

export function createScene(canvas, { onFrame, onLayout } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 190);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(7, 16, 12); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 16, bottom: -4, near: 1, far: 50 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island, the easel and the bench ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 30, max: 110, below: -14, seed: 9 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(20, 13, { round: true, rim: 4.6, seed: 33, props: 18, size: 1.8, flowers: 60, open: .5 }); land.position.set(0, -.08, -1); scene.add(land);
  const flyBirds = birds(scene, 56, 17, 4, 1.7), drift = petals(scene, 24, 8, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ color: '#ffffff' })); paper.position.set(0, PY + PH / 2, .02); scene.add(paper);
  {
    const WOOD = '#b9794a', DARK = '#8a5a3c', cy = PY + PH / 2, F = .34;
    put(new THREE.BoxGeometry(PW + F * 2, PH + F * 2, .3), M('#fff6e6'), 0, cy, -.16).castShadow = true;                 // the backing board
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(F, PH + F * 2, .44), M(WOOD), s * (PW / 2 + F / 2), cy, -.06).castShadow = true;         // side rails
      put(new THREE.BoxGeometry(PW + F * 2, F, .44), M(WOOD), 0, cy + s * (PH / 2 + F / 2), -.06).castShadow = true;     // top and bottom rails
      put(new THREE.BoxGeometry(.42, PY + .3, .42), M(DARK), s * (PW / 2 - 1.4), PY / 2 - .1, -.2).castShadow = true;    // legs
      const back = put(new THREE.BoxGeometry(.3, PY + PH, .3), M(DARK), s * (PW / 2 - 1.4), (PY + PH) / 2 - .4, -2.1); back.rotation.x = -.26; back.castShadow = true;
      put(new THREE.BoxGeometry(.9, .22, 1.3), M(DARK), s * (PW / 2 - 1.4), .11, -.2);                                   // feet
    }
    put(new THREE.BoxGeometry(PW - 2.2, .26, .3), M(DARK), 0, 2.2, -.2);                                                 // the bar between the legs
    put(new THREE.BoxGeometry(PW * .62, .16, .6), M(WOOD), 0, PY - F - .06, .3).castShadow = true;                       // the ledge for chalk and brushes
    for (const [x, c] of [[-2.6, '#e5392f'], [-2.1, '#ffd92e'], [-1.6, '#37b8f2'], [2.2, '#4cc04a'], [2.7, '#9a4fd0']]) put(new THREE.CylinderGeometry(.09, .09, .5, 6), M(c), x, PY - F + .12, .4).rotation.z = Math.PI / 2 + (x % 1) * .4;
    // bunting along the top rail
    for (let i = 0; i < 13; i++) { const t = (i + .5) / 13, f = put(new THREE.ConeGeometry(.3, .52, 3), M(['#ff8fab', '#ffd84a', '#7ed3b2', '#9aa8ff', '#ff9440'][i % 5]), -PW / 2 + t * PW, PY + PH + F + .12 - Math.sin(t * Math.PI) * .0, .2); f.rotation.x = Math.PI; f.scale.z = .25; }
    // the stage: a round wooden deck, and the long bench
    { const d = roundDeck(9.6, { wood: '#d9a066', seam: '#b97f4c', rim: '#a86a42', y: -.02, h: .14, seg: 30, tube: .15, pitch: 1.2 }); d.position.z = .6; room.add(d); }
    const bench = put(new THREE.BoxGeometry(ROW_W + .6, .2, 1.05), M(WOOD), 0, SEAT_Y - .1, ROW_Z - .1); bench.castShadow = bench.receiveShadow = true;
    for (const x of [-5.4, -1.8, 1.8, 5.4]) put(new THREE.BoxGeometry(.3, SEAT_Y - .2, .9), M(DARK), x, (SEAT_Y - .2) / 2, ROW_Z - .1);
    // lanterns either side
    for (const [x, c] of [[-8.3, '#ffd84a'], [8.3, '#ff8fab']]) {
      put(new THREE.CylinderGeometry(.09, .12, 5, 6), M(DARK), x, 2.5, -.6).castShadow = true;
      put(new THREE.BoxGeometry(.6, .7, .6), M(c, { emissive: c, emissiveIntensity: .35 }), x, 5.3, -.6);
      put(new THREE.ConeGeometry(.52, .36, 4), M('#5b4636'), x, 5.84, -.6).rotation.y = Math.PI / 4;
    }
    bake(room); toonify(room, .04);
  }
  // a Pet Farm cat keeps watch from the top of the easel and hops when somebody gets the word
  const mascot = new THREE.Group(); mascot.position.set(PW / 2 - .5, PY + PH + .68, -.06); scene.add(mascot);
  let pet = null, petHop = 0;
  try {
    pet = petModel('tuxpurr', 2);
    const bb = new THREE.Box3().setFromObject(pet), size = bb.getSize(new THREE.Vector3()), k = 1.3 / Math.max(size.x, size.y, size.z, .01);
    pet.scale.multiplyScalar(k); pet.position.y = -bb.min.y * k; mascot.add(pet);
    mascot.traverse(o => { if (o.isMesh) o.castShadow = true; });
  } catch (e) { console.warn('no mascot pet', e); }
  // the pencil that floats over whoever is drawing
  const pencil = new THREE.Group(); scene.add(pencil); pencil.visible = false;
  {
    const body = put(new THREE.CylinderGeometry(.13, .13, .8, 6), M('#ffd23f'), 0, .25, 0, pencil);
    put(new THREE.ConeGeometry(.13, .26, 6), M('#f6c9a0'), 0, -.28, 0, pencil).rotation.x = Math.PI;
    put(new THREE.ConeGeometry(.055, .11, 6), M('#3b2219'), 0, -.36, 0, pencil).rotation.x = Math.PI;
    put(new THREE.CylinderGeometry(.14, .14, .16, 6), M('#ff8fab'), 0, .73, 0, pencil);
    body.castShadow = true; toonify(pencil, .04); pencil.rotation.z = -.5;
  }

  // ---------- seats ----------
  let seats = [], seatKey = '', S = null, T = 0;
  const xOf = (i, n) => (i - (n - 1) / 2) * slotOf(n);
  function buildSeats(list) {
    for (const s of seats) { scene.remove(s.box); disposeAvatar(s.av); }
    seats = list.map((p, i) => {
      // (the size goes on a wrapper: the avatar's own scale is animated)
      const box = new THREE.Group(); box.position.set(xOf(i, list.length), SEAT_Y, ROW_Z); box.scale.setScalar(AV); scene.add(box);
      const av = avatar3d(p.color, p.av); av.position.y = .76; box.add(av);
      return { av, box, hop: 0, x: xOf(i, list.length) };
    });
    layoutOut();
  }
  function setState(st) {
    const key = st.seats.map(p => p.color + (p.av || []).join('')).join('|');
    if (key !== seatKey) { seatKey = key; buildSeats(st.seats); }
    S = st;
  }
  const pfx = createFx(scene);
  // somebody guessed the word: they hop, their own win effect pops over them, the cat hops too
  function cheer(i) {
    const s = seats[i]; if (!s) return;
    s.hop = 1; petHop = 1;
    pfx.confetti(new THREE.Vector3(s.x, HEAD_Y + .5, ROW_Z), { n: 46, w: 1.4, h: 1.4, s: i });
  }

  // ---------- sizing: fit the easel (and the bench) into the free part of the screen ----------
  let W = 0, H = 0, fit = { top: 80, bottom: 20, left: 0, right: 0, paperOnly: false }, out = null;
  const v = new THREE.Vector3();
  const toPx = (x, y, z) => { v.set(x, y, z).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  const CY = 7;
  function placeCam(D) { camera.position.set(0, CY, D); camera.lookAt(0, CY, 0); camera.updateMatrixWorld(); }
  function box() { // screen box of what must be seen
    const F = .36, [l, t] = toPx(-PW / 2 - F, PY + PH + F + (fit.paperOnly ? 0 : H > W ? .5 : 1.9), 0), [r, b0] = toPx(PW / 2 + F, PY - F, 0);
    if (fit.paperOnly) return [l, t, r, b0];
    const [al, ab] = toPx(-ROW_W / 2 - .2, 0, ROW_Z + .5), [ar] = toPx(ROW_W / 2 + .2, 0, ROW_Z + .5);
    return [Math.min(l, al), t, Math.max(r, ar), ab];
  }
  function layoutOut() {
    if (!W) return;
    const [x0, y0] = toPx(-PW / 2, PY + PH, .02), [x1, y1] = toPx(PW / 2, PY, .02);
    out = { paper: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, slot: toPx(slotOf(seats.length), 0, ROW_Z)[0] - toPx(0, 0, ROW_Z)[0],
      seats: seats.map(s => { const [x, fy] = toPx(s.x, .02, ROW_Z + .5), [, hy] = toPx(s.x, HEAD_Y + .1, ROW_Z); return { x, feet: fy, head: hy }; }) };
    onLayout?.(out);
  }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const aw = Math.max(120, w - fit.left - fit.right), ah = Math.max(90, h - fit.top - fit.bottom);
    let lo = 8, hi = 400;
    for (let i = 0; i < 36; i++) {
      const D = (lo + hi) / 2; placeCam(D);
      const [l, t, r, b] = box();
      if (r - l <= aw && b - t <= ah) hi = D; else lo = D;
    }
    placeCam(hi); scene.fog.near = hi + 30; scene.fog.far = hi + 170;
    const [l, t, r, b] = box();
    // centred sideways; on tall screens the easel sits right under the top bar, on wide ones in the middle
    const ox = (l + r) / 2 - (fit.left + aw / 2), oy = h > w || fit.paperOnly ? t - fit.top : (t + b) / 2 - (fit.top + ah / 2);
    camera.setViewOffset(w, h, Math.round(ox), Math.round(oy), w, h); camera.updateProjectionMatrix();
    layoutOut();
  }

  // ---------- loop ----------
  let dead = false;
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    petHop = Math.max(0, petHop - dt * 2.2);
    mascot.position.y = PY + PH + .68 + Math.abs(Math.sin(petHop * Math.PI * 2)) * .45 * petHop;
    mascot.rotation.y = -.35 + Math.sin(T * .5) * .2;
    if (pet) wiggle(pet, T, 2, petHop);
    const drawing = S && S.ph === 'play' && S.st === 'draw' ? S.drawer : -1;
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2);
      s.av.position.y = .76 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .5 * s.hop;
      animateAvatar(s.av, T, { seed: i, active: i === drawing, hop: s.hop, look: 0 });
    });
    const d = seats[drawing];
    pencil.visible = !!d;
    if (d) { pencil.position.set(d.x + .1, HEAD_Y + .7 + Math.sin(T * 3) * .1, ROW_Z); pencil.rotation.y = T * 1.6; }
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);
    onFrame?.();
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState, cheer,
    // how much of the screen the page's own panels cover, in screen pixels; paperOnly: only the paper has to fit (phone keyboard open)
    setFit(f) { const n = { ...fit, ...f }; if (JSON.stringify(n) !== JSON.stringify(fit)) { fit = n; resize(true); } },
    layout: () => out,
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) disposeAvatar(s.av);
      pfx.dispose(); paper.geometry.dispose(); paper.material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

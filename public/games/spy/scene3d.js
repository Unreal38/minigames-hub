// Spyglass Isle 3D backdrop (three.js): a sky island with a big wooden picture frame on an easel, a Pet Farm fox cub
// with a spyglass at its foot, and everyone's avatar standing beside the frame. The page lays its 2D picture card exactly
// over the frame's picture: setBoard() gets the card's box on screen and the camera is placed to match it (the frame
// leans back to face the camera, so it stays a true square on screen). Purely visual: it shows what the server says.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, skyDome, clouds, island, birds, petals, createFx, nightScene } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { petModel, wiggle } from '../farm/pets3d.js';

const SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const PW = 12, LEAN = .26, LEG = 1.1;  // the picture (square), how far the frame leans back, how high it stands
const FOV = 30, AV_H = 2.35; // AV_H: about a standing avatar's height at scale 1 (with the .76 lift)
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
// the picture's middle: the frame stands on its bottom edge, leaning back
const MID = new THREE.Vector3(0, LEG + Math.cos(LEAN) * PW / 2, -Math.sin(LEAN) * PW / 2);
const FACING = new THREE.Vector3(0, Math.sin(LEAN), Math.cos(LEAN)); // the way the picture faces

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 60, 220);
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 600);
  const small = matchMedia('(max-width: 760px)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(9, 18, 14); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 18, bottom: -6, near: 1, far: 60 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- sky, island, frame ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 40, max: 140, below: -16, seed: 21 }); scene.add(cloudRing);
  nightScene(scene);
  const land = island(34, 18, { round: true, rim: 5, seed: 57, props: 26, size: 1.9, flowers: 80, open: .55 }); land.position.set(0, -.08, -2.5); scene.add(land);
  const flyBirds = birds(scene, 70, 20, 4, 1.8), drift = petals(scene, 30, 9, { n: small ? 6 : 10 });
  const stand = new THREE.Group(); scene.add(stand);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = stand) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); m.castShadow = true; return m; };
  const frame = new THREE.Group(); frame.position.set(0, LEG, 0); frame.rotation.x = -LEAN; stand.add(frame);
  {
    const WOOD = '#b9794a', DARK = '#8a5a3c', F = .5, cy = PW / 2;
    put(new THREE.BoxGeometry(PW + .2, PW + .2, .3), M('#fff6e6'), 0, cy, -.2, frame);                                  // the backing board
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(F, PW + F * 2, .5), M(WOOD), s * (PW / 2 + F / 2), cy, -.05, frame);                     // side rails
      put(new THREE.BoxGeometry(PW + F * 2, F, .5), M(WOOD), 0, cy + s * (PW / 2 + F / 2), -.05, frame);                 // top and bottom rails
      put(new THREE.SphereGeometry(.34, 8, 6), M('#ffd84a'), s * (PW / 2 + F / 2), PW + F, .1, frame);                   // knobs on the top corners
    }
    // easel legs: two at the front, one at the back, a ledge the frame rests on
    for (const s of [-1, 1]) { const l = put(new THREE.BoxGeometry(.42, LEG + PW * .7, .42), M(DARK), s * (PW / 2 - 1.2), (LEG + PW * .7) / 2 - .1, -.5); l.rotation.x = -LEAN * .9; }
    const back = put(new THREE.BoxGeometry(.4, LEG + PW, .4), M(DARK), 0, (LEG + PW) / 2 - .5, -PW * .45); back.rotation.x = .3;
    put(new THREE.BoxGeometry(PW + 1.4, .36, .9), M(WOOD), 0, LEG - .2, .15);
    // bunting across the top
    for (let i = 0; i < 15; i++) { const t = (i + .5) / 15, f = put(new THREE.ConeGeometry(.34, .6, 3), M(['#ff8fab', '#ffd84a', '#7ed3b2', '#9aa8ff', '#ff9440'][i % 5]), -PW / 2 + t * PW, PW + F + .1, .3, frame); f.rotation.x = Math.PI; f.scale.z = .25; }
    // a round wooden deck for the frame and the crowd
    const deck = put(new THREE.CylinderGeometry(13, 13, .14, 34), M('#d9a066'), 0, -.02, 0); deck.receiveShadow = true; deck.castShadow = false;
    const rimG = new THREE.TorusGeometry(13, .16, 6, 34); rimG.rotateX(Math.PI / 2); put(rimG, M('#a86a42'), 0, .03, 0);
    bake(stand); toonify(stand, .04);
  }
  // the mascot: a fox cub with a spyglass at the foot of the frame; hops when somebody finds the pet
  const mascot = new THREE.Group(); scene.add(mascot); mascot.position.set(-PW / 2 - 1.6, 0, 1);
  let pet = null, petHop = 0;
  try {
    pet = petModel('cindercub', 2);
    const bb = new THREE.Box3().setFromObject(pet), size = bb.getSize(new THREE.Vector3()), k = 1.7 / Math.max(size.x, size.y, size.z, .01);
    pet.scale.multiplyScalar(k); pet.position.y = -bb.min.y * k; mascot.add(pet);
    const glass = new THREE.Group(); glass.position.set(.45, .95, .35); glass.rotation.set(0, -.5, .5); mascot.add(glass);
    put(new THREE.CylinderGeometry(.12, .16, .9, 8), M('#e9b949', { metalness: .3 }), 0, 0, 0, glass);
    put(new THREE.CylinderGeometry(.17, .17, .14, 8), M('#3b2219'), 0, .45, 0, glass);
    toonify(glass, .03);
    mascot.traverse(o => { if (o.isMesh) o.castShadow = true; });
  } catch (e) { console.warn('no mascot pet', e); }

  // ---------- the players ----------
  let seats = [], seatKey = '';
  function buildSeats(list) {
    for (const s of seats) { scene.remove(s.box); disposeAvatar(s.av); }
    seats = list.map(p => {
      const box = new THREE.Group(); scene.add(box);
      const av = avatar3d(p.color, p.av); av.position.y = .76; box.add(av); // (the size goes on a wrapper: the avatar's own scale is animated)
      const h = new THREE.Box3().setFromObject(box).max.y || AV_H; // the real height of this look (hats, hair, ears)
      return { av, box, hop: 0, at: box.position, h };
    });
    place();
  }
  function setSeats(list) {
    const key = list.map(p => p.color + (p.av || []).join('')).join('|');
    if (key !== seatKey) { seatKey = key; buildSeats(list); }
  }
  const pfx = createFx(scene);
  function cheer(i) {
    petHop = 1;
    const s = seats[i]; if (!s) return;
    s.hop = 1;
    const top = s.h * s.box.scale.y; pfx.confetti(new THREE.Vector3(s.at.x, top + .6, s.at.z), { n: 40, w: top * .6, h: top * .6, s: i });
  }

  // ---------- the camera matches the page's card ----------
  let W = 0, H = 0, board = null;
  // Everyone stands on the ground in a screen spot picked from the page's layout: the first half of the players to
  // the left of the card, the rest to the right, outside the players' lists (phones: in a row along the bottom).
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function ground(px, py, out) {
    ray.setFromCamera(new THREE.Vector2(px / W * 2 - 1, 1 - py / H * 2), camera);
    if (!ray.ray.intersectPlane(floor, hit)) return false;
    out.set(hit.x, 0, hit.z); return true;
  }
  const face = o => { o.rotation.y = o.userData.yaw = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z) * .8; };
  function place() {
    if (!W || !H) return;
    const b = board || { x: W * .2, y: H * .15, size: Math.min(W * .6, H * .7), row: true, l: W * .2, r: W * .8 };
    // feet just above the Scores and Chat buttons; everyone about a fifth of the card tall, whatever the screen
    const n = seats.length, half = Math.ceil(n / 2), foot = H - 84, tall = Math.max(64, Math.min(130, b.size * .19));
    const fit = (o, px, h) => { const d = o.position.distanceTo(camera.position), perPx = 2 * d * Math.tan(FOV * Math.PI / 360) / H; o.scale.setScalar(px * perPx / h); };
    seats.forEach((s, i) => {
      let x0, x1, k, m;
      if (b.row) {
        const left = i < half; k = left ? i : i - half; m = left ? half : n - half;
        if (left) { x1 = Math.min(b.l, b.x) - 12; x0 = Math.max(8, x1 - 95 * m); if (x1 - x0 < 50 * m) { x0 = 8; x1 = b.x - 8; } }
        else { x0 = Math.max(b.r, b.x + b.size) + 12; x1 = Math.min(W - 8, x0 + 95 * m); if (x1 - x0 < 50 * m) { x0 = b.x + b.size + 8; x1 = W - 8; } }
      } else { x0 = 10; x1 = W - 10; k = i; m = n; }
      const tight = (x1 - x0) / m < 70, px = x0 + (x1 - x0) * (k + .5) / m, py = foot - (tight && k % 2 ? 34 : 0);
      s.box.visible = ground(px, py, s.box.position);
      fit(s.box, tall * (tight && k % 2 ? .9 : 1), s.h); face(s.box);
    });
    // the fox cub sits right at the card's bottom-left corner
    mascot.visible = b.row && b.x > 70 && ground(b.x - 26, foot + 6, mascot.position);
    if (mascot.visible) { fit(mascot, tall * .55, 1.7); face(mascot); }
  }
  const eye = new THREE.Vector3();
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.clearViewOffset();
    const b = board || { x: w * .2, y: h * .15, size: Math.min(w * .6, h * .7) };
    const D = PW * h / (2 * Math.tan(FOV * Math.PI / 360) * Math.max(60, b.size)); // the distance where the picture is b.size pixels tall
    eye.copy(MID).addScaledVector(FACING, D); camera.position.copy(eye); camera.lookAt(MID);
    camera.setViewOffset(w, h, Math.round(w / 2 - (b.x + b.size / 2)), Math.round(h / 2 - (b.y + b.size / 2)), w, h);
    camera.updateProjectionMatrix();
    scene.fog.near = D + 40; scene.fog.far = D + 200;
    camera.updateMatrixWorld(); place();
  }

  // ---------- loop ----------
  let dead = false, T = 0;
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    petHop = Math.max(0, petHop - dt * 2.2);
    mascot.position.y = Math.abs(Math.sin(petHop * Math.PI * 2)) * .5 * petHop;
    mascot.rotation.y = (mascot.userData.yaw || 0) + .3 + Math.sin(T * .5) * .25;
    if (pet) wiggle(pet, T, 3, petHop);
    seats.forEach((s, i) => {
      s.hop = Math.max(0, s.hop - dt * 2);
      s.av.position.y = .76 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .5 * s.hop;
      animateAvatar(s.av, T, { seed: i, hop: s.hop, look: 0 });
    });
    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setSeats, cheer,
    // the card's box on screen, in CSS pixels of the canvas: { x, y, size }, plus the layout: row (lists beside the
    // card), l / r (the outer edges of the left and right players' lists)
    setBoard(b) { const n = { x: Math.round(b.x), y: Math.round(b.y), size: Math.round(b.size), row: !!b.row, l: Math.round(b.l ?? b.x), r: Math.round(b.r ?? b.x + b.size) }; if (JSON.stringify(n) !== JSON.stringify(board)) { board = n; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) disposeAvatar(s.av);
      pfx.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

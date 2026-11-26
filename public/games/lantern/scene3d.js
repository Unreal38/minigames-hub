// Lantern Night's 3D island at dusk: the chore places (Pet Farm decorations), the campfire with its meeting bell, the
// dock with the ferry, hollow logs, everyone's avatar with their companion pet, sleepers lying where they were lulled,
// and players who are out trotting about as their pet. Your own walking is worked out here every frame and reported.
// The page (client.js) owns the buttons, name tags, the lantern's darkness and the chores.
//
// Reused from the Plaza (as Kuba asked: same rules, same fixes): mergeStatic/litePet for cheap scenery and pets, the
// avatar wrapper scale + 0.76 lift (standing-avatar feet), blob shadows, the follow camera with turning, the season
// island and night/weather painting, frameLoop + autoResolution (never a lower resolution), hudFitOk for HUD changes.
import * as THREE from 'three';
import { avatar3d, animateAvatar, walkAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { island, skyDome, clouds, nightScene, flat, put, toonify, createFx, STAR, HEART, seasonLookNow } from '../../scenery3d.js';
import { petModel, wiggle } from '../farm/pets3d.js';
import { itemModel } from '../farm/models.js';
import { frameLoop, autoResolution, AA, gfx } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { mergeStatic, litePet } from '../plaza/scene3d.js';
import { lanternModel } from '../../pieceskins.js';
import { R_WALK, SPEED, GHOST_SPEED, Q, STATIONS, DECOR, LOGS, ROPES, BELL, WALLS, WALL_KIND, spotOf, unblock, clampWalk, findPath } from './layout.js';

const K = .72;                  // avatars are drawn at this size, on a wrapper (animateAvatar owns the avatar's own scale)
const LIFT = .76;               // a standing avatar's feet are .76 below its middle
const LIVE = new Set(['campfire', 'windmill']); // decorations with moving parts stay their own models
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); return (a < 0 ? a + Math.PI * 2 : a) - Math.PI; };
const WOOD = '#9a6a44', WOOD_D = '#7a5236';

// ---------- the pieces only this island has ----------
function hollowLog(g) {
  const bark = flat('#7a5236'), inside = flat('#2a1a12'), ring = flat('#d8b07a');
  put(g, new THREE.CylinderGeometry(.62, .7, 2.3, 9, 1, true), bark, 0, .58).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) { put(g, new THREE.RingGeometry(.4, .66, 9), ring, sx * 1.152, .58).rotation.y = sx * Math.PI / 2; put(g, new THREE.CircleGeometry(.41, 9), inside, sx * 1.14, .58).rotation.y = sx * Math.PI / 2; }
  put(g, new THREE.CylinderGeometry(.42, .42, 2.24, 9, 1, true), flat('#3a2418', { side: THREE.BackSide }), 0, .58).rotation.z = Math.PI / 2;
  for (const [x, c] of [[-.5, '#5aa04a'], [.35, '#6dbb5a']]) put(g, new THREE.IcosahedronGeometry(.18, 0), flat(c), x, 1.2, .1).scale.y = .55; // moss on top
}
function bell(g) {
  put(g, new THREE.CylinderGeometry(.08, .1, 2.1, 6), flat(WOOD_D), 0, 1.05);
  put(g, new THREE.BoxGeometry(.9, .1, .12), flat(WOOD_D), .32, 2.05);
  put(g, new THREE.CylinderGeometry(.12, .3, .42, 10), flat('#f2b92e'), .62, 1.72);
  put(g, new THREE.CylinderGeometry(.31, .31, .05, 10), flat('#d99a1e'), .62, 1.5);
  put(g, new THREE.IcosahedronGeometry(.07, 0), flat('#6b4a2c'), .62, 1.44);
  put(g, new THREE.CylinderGeometry(.02, .02, .26, 4), flat('#e3c7ad'), .62, 1.93); // the rope's top ends inside the beam (no shared face)
}
function dock(g, x0) { // planks from the island's edge out over the water, posts down into it
  const plank = flat(WOOD), dark = flat(WOOD_D);
  for (let i = 0; i < 11; i++) put(g, new THREE.BoxGeometry(5.2 - (i % 2) * .08, .14, .62), i % 3 ? plank : dark, x0, .02, R_WALK - 1.3 + i * .66);
  for (const sx of [-2.5, 2.5]) for (const z of [-.5, 2, 4.5].map(d => R_WALK + d)) put(g, new THREE.CylinderGeometry(.16, .18, 2.6, 6), dark, x0 + sx, -.9, z);
}
function bollard(g) { put(g, new THREE.CylinderGeometry(.22, .26, .7, 8), flat(WOOD_D), 0, .35); put(g, new THREE.CylinderGeometry(.3, .3, .08, 8), flat(WOOD), 0, .74); put(g, new THREE.TorusGeometry(.24, .06, 5, 10), flat('#e8d2a8'), 0, .45).rotation.x = Math.PI / 2; }
function ferryBoat() {
  const g = new THREE.Group(), hull = flat('#e5543b'), white = flat('#fff4e2'), wood = flat(WOOD), dark = flat('#3b2219');
  put(g, new THREE.BoxGeometry(3.4, .9, 6), hull, 0, .2);
  put(g, new THREE.ConeGeometry(1.7, 1.6, 4, 1), hull, 0, .2, -3.6).rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  put(g, new THREE.BoxGeometry(3.5, .16, 6.1), white, 0, .7);
  put(g, new THREE.BoxGeometry(3.1, .1, 5.6), wood, 0, .66);
  put(g, new THREE.BoxGeometry(1.8, 1.3, 1.9), white, 0, 1.4, 1.4);
  put(g, new THREE.BoxGeometry(2.1, .16, 2.2), flat('#3f7fc4'), 0, 2.13, 1.4);
  put(g, new THREE.CylinderGeometry(.22, .28, 1, 8), dark, 0, 2.6, 1.7); put(g, new THREE.CylinderGeometry(.3, .3, .14, 8), flat('#e5543b'), 0, 3.06, 1.7);
  for (const sx of [-1, 1]) put(g, new THREE.TorusGeometry(.32, .1, 6, 12), white, sx * 1.76, .5, -.6).rotation.y = Math.PI / 2;
  bake(g); return toonify(g, .05);
}
// Stepping stones from the campfire square out to a place, along the way you walk there (round the walls).
function stones(g, x, z, light, darkM, laid) {
  const d = Math.hypot(x, z) || 1, sx = x / d * 2.8, sz = z / d * 2.8, way = findPath(sx, sz, x, z); if (!way) return;
  let px = sx, pz = sz, k = 0, carry = 0;
  for (const [wx, wz] of way) { const len = Math.hypot(wx - px, wz - pz);
    for (let t = 1.05 - carry; t < len; t += 1.05) { const qx = px + (wx - px) * t / len, qz = pz + (wz - pz) * t / len; k++;
      if (Math.hypot(qx, qz) < 6.9 || laid.some(([lx, lz]) => Math.hypot(lx - qx, lz - qz) < .7)) continue; laid.push([qx, qz]);
      put(g, new THREE.CylinderGeometry(.36, .38, .05, 7), k % 2 ? light : darkM, qx + Math.sin(k * 5 + x) * .12, .012, qz + Math.cos(k * 3 + z) * .12); }
    carry = (len + carry) % 1.05; px = wx; pz = wz; }
}
// The island's walls: stone with a cap, clipped hedges, plank sheds with posts, low fences with two rails.
// Each piece runs half a thickness past its ends so corners close (the same as the walking rules: walls are capsules).
function wallPiece(w) {
  const g = new THREE.Group(), K = WALL_KIND[w.k], dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], len = Math.hypot(dx, dz), L = len + (w.k === 'fence' ? 0 : K.t);
  g.position.set((w.a[0] + w.b[0]) / 2, .02, (w.a[1] + w.b[1]) / 2); g.rotation.y = -Math.atan2(dz, dx);
  const seed = Math.abs(Math.sin(w.a[0] * 12.9 + w.a[1] * 78.2)) * 9;
  if (w.k === 'stone') {
    put(g, new THREE.BoxGeometry(L, K.h - .1, K.t), flat('#9b8f84'), 0, (K.h - .1) / 2);
    put(g, new THREE.BoxGeometry(L + .08, .16, K.t + .08), flat('#b9ada0'), 0, K.h - .04);
    for (let i = 0, n = Math.floor(L / 1.3); i < n; i++) for (const sd of [-1, 1]) { const x = -L / 2 + .65 + i * 1.3 + Math.sin(seed + i * 3 + sd) * .2; // a few stones stand out of the face
      put(g, new THREE.BoxGeometry(.42, .22, .06), flat((i + sd) % 2 ? '#877b70' : '#a89c90'), x, .3 + ((i * 7 + seed) % 3) * .2, sd * (K.t / 2 + .02)); }
  } else if (w.k === 'hedge') {
    put(g, new THREE.BoxGeometry(L, K.h, K.t), flat('#4f8f45'), 0, K.h / 2);
    put(g, new THREE.BoxGeometry(L - .1, .14, K.t - .14), flat('#64a957'), 0, K.h + .05);
    for (let i = 0, n = Math.floor(L / 1.6); i < n; i++) { const sd = i % 2 ? 1 : -1, x = -L / 2 + .8 + i * 1.6 + Math.sin(seed + i) * .3; // berries and leaf tufts
      put(g, new THREE.IcosahedronGeometry(.2, 0), flat('#5ea052'), x, .5 + (i % 3) * .22, sd * (K.t / 2 + .03)).scale.z = .45;
      if (i % 3 === 1) put(g, new THREE.IcosahedronGeometry(.06, 0), flat('#e0524a'), x + .15, .78, sd * (K.t / 2 + .09)); }
  } else if (w.k === 'plank') {
    put(g, new THREE.BoxGeometry(L, K.h, K.t), flat('#a8774f'), 0, K.h / 2);
    for (let i = 1; i < 4; i++) for (const sd of [-1, 1]) put(g, new THREE.BoxGeometry(L - .04, .04, .03), flat('#8c6140'), 0, i * K.h / 4, sd * (K.t / 2 + .012)); // plank seams
    const n = Math.max(1, Math.round(L / 2.2)); for (let i = 0; i <= n; i++) put(g, new THREE.BoxGeometry(.22, K.h + .16, K.t + .1), flat('#6f4a2f'), -L / 2 + .13 + (L - .26) * i / n, (K.h + .16) / 2); // end posts stop just short of the plank's end
  } else {
    const n = Math.max(1, Math.round(L / 1.2)); for (let i = 0; i <= n; i++) put(g, new THREE.BoxGeometry(.14, K.h, .14), flat('#7d5234'), -L / 2 + L * i / n, K.h / 2);
    for (const y of [.3, .58]) put(g, new THREE.BoxGeometry(L, .08, .06), flat('#b07a4a'), 0, y);
  }
  bake(g); return g;
}
export const _wallPiece = wallPiece; // (for the flicker checker)

export function createScene(canvas, opts = {}) {
  const level = gfx(), few = level === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 3, 700);
  // dusk: a warm low sun, a violet sky (the site's night mode turns it into a starry night as everywhere else)
  scene.add(new THREE.HemisphereLight('#ffe2c4', '#6b5a8c', 1.55));
  const key = new THREE.DirectionalLight('#ffd2a1', 1.35); key.position.set(-25, 22.4, 14); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -R_WALK - 8, right: R_WALK + 8, top: R_WALK + 8, bottom: -R_WALK - 8, near: 1, far: 120 }); key.shadow.normalBias = .05; scene.add(key);
  skyDome(scene, '#5a4c9a', '#ffb48a'); scene.add(clouds({ near: 50, far: 14, below: -12, min: 30, max: 120, color: '#ffd9c4' }));

  // ---- the island
  const C = 2 * (R_WALK - 2.2), today = seasonLookNow();
  const isle = island(C, C, { round: true, props: 56, seed: 11, rim: 3.4, flowers: 140, clear: R_WALK, size: 1.7, depth: 1.1, open: .15, season: today });
  scene.add(isle);
  const stat = new THREE.Group(), live = [];
  { const pav = new THREE.Group(), a = flat('#e2cfae'), b = flat('#cdb38c');
    put(pav, new THREE.CylinderGeometry(8.4, 8.4, .05, 48), flat('#cdb38c'), 0, .005); put(pav, new THREE.CylinderGeometry(8.1, 8.1, .05, 48), flat('#e2cfae'), 0, .016);
    const laid = []; for (const st of STATIONS) stones(pav, ...spotOf(st), a, b, laid);
    dock(pav, STATIONS.find(st => st.id === 'dock').x); bake(pav); stat.add(pav); }
  for (const st of STATIONS) {
    if (!st.item) continue;
    if (LIVE.has(st.item)) { const g = itemModel(st.item, true); g.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noInk; o.receiveShadow = false; } }); g.scale.setScalar(st.s); g.position.set(st.x, .03, st.z); g.rotation.y = st.ry; scene.add(g); if (g.userData.tick) live.push(g); continue; }
    const g = itemModel(st.item, false, true); g.scale.setScalar(st.s); g.position.set(st.x, .03, st.z); g.rotation.y = st.ry; stat.add(g);
  }
  for (const [kind, x, z, ry, s] of DECOR) {
    if (LIVE.has(kind)) { const g = itemModel(kind, true); g.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noInk; o.receiveShadow = false; } }); g.scale.setScalar(s); g.position.set(x, .03, z); g.rotation.y = ry; scene.add(g); if (g.userData.tick) live.push(g); continue; }
    const g = itemModel(kind, false, true); g.scale.setScalar(s); g.position.set(x, .03, z); g.rotation.y = ry; stat.add(g);
  }
  for (const w of WALLS) stat.add(wallPiece(w));
  for (const [x, z, ry] of LOGS) { const g = new THREE.Group(); hollowLog(g); bake(g); g.position.set(x, .03, z); g.rotation.y = ry; stat.add(g); }
  for (const [x, z] of ROPES) { const g = new THREE.Group(); bollard(g); bake(g); g.position.set(x, .03, z); stat.add(g); }
  { const g = new THREE.Group(); bell(g); bake(g); g.position.set(BELL[0], .03, BELL[1]); stat.add(g); }
  scene.add(mergeStatic(stat, .05));
  // the ferry, moored off the end of the dock
  const boat = ferryBoat(), BOAT = [STATIONS.find(st => st.id === 'dock').x, R_WALK + 7.7]; boat.position.set(BOAT[0], -.35, BOAT[1]); boat.rotation.y = Math.PI / 2; scene.add(boat);
  const ropeM = new THREE.LineBasicMaterial({ color: '#e8d2a8' }), ropeG = new THREE.BufferGeometry().setFromPoints(ROPES.flatMap(([x, z]) => [new THREE.Vector3(x, .5, z), new THREE.Vector3(BOAT[0] + (x - BOAT[0]) * .3, .55, BOAT[1] - 1.6)]));
  const ropeL = new THREE.LineSegments(ropeG, ropeM); scene.add(ropeL);
  // the water round the island catches the sunset
  const sea = new THREE.Mesh(new THREE.CircleGeometry(80, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5b6fb8', roughness: .4, transparent: true, opacity: .9 }));
  sea.position.y = -.9; scene.add(sea);
  const fx = createFx(scene, { max: 400 });
  const BLOBS = 48, blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1c2540', transparent: true, opacity: .22, depthWrite: false }), BLOBS); blobs.frustumCulled = false; blobs.renderOrder = 1; scene.add(blobs);
  // rings on the ground: your chores (gold), something to do here (white)
  const RINGS = 16, rings = new THREE.InstancedMesh(new THREE.RingGeometry(.62, .82, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .85, depthWrite: false }), RINGS); rings.frustumCulled = false; rings.count = 0; rings.renderOrder = 2; scene.add(rings);
  let ringList = [];
  const mark = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthWrite: false })); mark.visible = false; mark.position.y = .1; scene.add(mark);
  nightScene(scene, { wx: { size: 50 } });
  res.prep(scene);

  // ---- people: an avatar and its pet each; out players are only their pet
  const folk = new Map(); let me = null, queue = [], noInk = few;
  function dropModel(m) {
    if (m.wrap) { scene.remove(m.wrap); disposeAvatar(m.av); m.lamp?.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); m.wrap = m.av = m.lamp = null; }
    if (m.pet) { scene.remove(m.pet.g); m.pet = null; }
  }
  function build(m) {
    if (!folk.has(m.s)) return false;
    if (!m.wrap) { m.wrap = new THREE.Group(); m.wrap.rotation.order = 'YXZ'; m.wrap.scale.setScalar(K); m.av = avatar3d(m.p.color, m.p.av, { pose: 'stand' }); m.av.position.y = LIFT; m.av.traverse(o => { if (o.isMesh) { o.castShadow = false; if (noInk && m !== me && o.material.isMeshBasicMaterial && o.material.side === THREE.BackSide) o.visible = false; } }); m.wrap.add(m.av);
      m.lamp = toonify(lanternModel(THREE, m.p.fl?.ln | 0), .03); m.lamp.scale.setScalar(.9); m.lamp.position.set(.72, 1.25, .1); m.lamp.traverse(o => { if (o.isMesh) o.castShadow = false; }); m.wrap.add(m.lamp); // your Lantern (Wardrobe kind ln): looks only, the light reaches as far for everyone
      m.wrap.position.set(m.x, 0, m.z); scene.add(m.wrap); return true; }
    if (!m.pet && m.pp) { let g; try { g = petModel(m.pp.sp, m.pp.f || 0, null); if (m !== me) g = litePet(g); } catch { m.pp = null; return false; }
      g.scale.multiplyScalar(.44 + .06 * (m.pp.f || 0)); m.pet = { g, x: m.x - 1.2, z: m.z, ry: 0, ph: 0, sp: 0, seed: m.s * 3 }; g.position.set(m.pet.x, 0, m.pet.z); scene.add(g); return true; }
    return false;
  }
  const enqueue = m => { if (!queue.includes(m)) queue.push(m); };
  // seats: [{ name, color, av }], pets: [{ sp, f }], mine: your seat (-1 when watching)
  function setSeats(seats, pets, mine) {
    for (const m of folk.values()) dropModel(m); folk.clear(); queue = []; me = null;
    seats.forEach((p, s) => { const m = { s, p, pp: pets?.[s] || null, x: 0, z: 0, tx: 0, tz: 0, ry: 0, tr: 0, amt: 0, ph: 0, spd: 0, on: false, out: 0, seen: false, fade: 0, wrap: null, av: null, pet: null };
      folk.set(s, m); if (s === mine) me = m; enqueue(m); });
  }
  // at: per seat [x, z, turn*10, out] or null when out of your sight
  function setAt(at, mineJ) {
    at.forEach((a, s) => { const m = folk.get(s); if (!m) return;
      if (!a) { m.seen = false; return; }
      const [x, z, r, out] = a; m.out = out;
      if (m === me) { if (mineJ !== m.j) { m.j = mineJ; m.x = m.tx = x; m.z = m.tz = z; m.ry = m.tr = r / 10; goal = null; sentX = Math.round(x * Q); sentZ = Math.round(z * Q); if (cam.snap) { cam.x = x; cam.z = z; } } m.seen = true; return; }
      if (!m.seen && !m.fade) { m.x = x; m.z = z; m.ry = r / 10; if (m.pet) { m.pet.x = x - 1.2; m.pet.z = z; } }
      m.seen = true; m.tx = x; m.tz = z; m.tr = r / 10; });
  }
  // sleepers: [seat, x, z, found]: the avatar lying on the grass, its pet curled up beside it
  const beds = new Map();
  function setBeds(list) {
    const keep = new Set(list.map(b => b[0]));
    for (const [s, b] of beds) if (!keep.has(s)) { scene.remove(b.wrap); disposeAvatar(b.av); if (b.pet) scene.remove(b.pet); beds.delete(s); }
    for (const [s, x, z] of list) { if (beds.has(s)) continue; const m = folk.get(s); if (!m) continue;
      const wrap = new THREE.Group(); wrap.scale.setScalar(K); const av = avatar3d(m.p.color, m.p.av, { pose: 'stand' }); av.position.y = LIFT; wrap.add(av);
      wrap.rotation.set(-Math.PI / 2, (s * 1.7) % 6.28, 0, 'YXZ'); wrap.position.set(x, .22, z); av.traverse(o => { if (o.isMesh) o.castShadow = false; }); scene.add(wrap);
      let pet = null; if (m.pp) { try { pet = litePet(petModel(m.pp.sp, m.pp.f || 0, null)); pet.scale.multiplyScalar(.44 + .06 * (m.pp.f || 0)); pet.position.set(x + 1.1, 0, z + .3); pet.rotation.y = -.8; scene.add(pet); } catch {} }
      beds.set(s, { wrap, av, pet, x, z, s });
      fx.puff(new THREE.Vector3(x, .4, z), { n: 10, color: '#d6d0ff', size: .35, speed: 1.6 }); }
  }
  function setRings(list) { ringList = list.slice(0, RINGS); const m4 = new THREE.Matrix4(), c = new THREE.Color(); rings.count = ringList.length; ringList.forEach(([x, z, col], i) => { rings.setMatrixAt(i, m4.makeTranslation(x, .06, z)); rings.setColorAt(i, c.set(col)); }); rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true; }

  // ---- your own walking (keys and joystick push relative to the screen; a tap on the ground walks there)
  let inX = 0, inZ = 0, goal = null, stuck = 0, sentX = 0, sentZ = 0, sentR = -1, sendAt = 0, frozen = true, bestD = 0, bestT = 0;
  const setMove = (x, z) => { inX = x; inZ = z; if (x || z) { goal = null; mark.visible = false; } };
  const ghostMe = () => !!me && me.out > 0;
  function walkTo(x, z) { if (!me) return; [x, z] = ghostMe() ? clampWalk(x, z) : unblock(x, z, .44); goal = ghostMe() ? [[x, z]] : findPath(me.x, me.z, x, z) || [[x, z]]; /* round the walls */ stuck = 0; bestD = 1e9; bestT = 0; mark.position.set(x, .1, z); mark.visible = true; }
  function stepMe(dt) {
    if (frozen) { me.spd = 0; return; }
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    let vx = inX * cy + inZ * sy, vz = -inX * sy + inZ * cy;
    if (!vx && !vz && goal) { const [gx, gz] = goal[0], last = goal.length === 1, dx = gx - me.x, dz = gz - me.z, d = Math.hypot(dx, dz);
      if (d < bestD - .05) { bestD = d; bestT = 0; } else bestT += dt;
      if (!last && d < .35) { goal.shift(); bestD = 1e9; bestT = 0; }
      else if (d < .12 || stuck > 1 || bestT > 1.6) { goal = null; mark.visible = false; } else { vx = dx / d; vz = dz / d; } }
    const speed = ghostMe() ? GHOST_SPEED : SPEED;
    if (vx || vz) {
      const l = Math.hypot(vx, vz), k = l > 1 ? 1 / l : 1, ox = me.x, oz = me.z;
      let x = me.x + vx * k * speed * dt, z = me.z + vz * k * speed * dt;
      [x, z] = ghostMe() ? clampWalk(x, z) : unblock(x, z);
      const went = Math.hypot(x - ox, z - oz); stuck = went < speed * dt * .25 ? stuck + dt : 0;
      me.x = x; me.z = z; if (went > 1e-4) me.tr = Math.atan2(vx, vz);
      me.spd = went / Math.max(dt, 1e-3) / speed;
    } else me.spd = 0;
    const qx = Math.round(me.x * Q), qz = Math.round(me.z * Q), qr = Math.round(((me.tr % 6.2832) + 6.2832) % 6.2832 * 10), now = performance.now();
    if ((qx !== sentX || qz !== sentZ || qr !== sentR) && now - sendAt > 100) { sendAt = now; sentX = qx; sentZ = qz; sentR = qr; opts.send?.({ t: 'p', x: qx / Q, z: qz / Q, r: qr / 10, j: me.j | 0 }); }
  }

  // ---- camera: follows you from the south, looking down; Q/E or a drag turns it, the wheel or a pinch zooms
  const cam = { x: 0, z: 6, zoom: 1, tall: false, yaw: 0, el: 0, ty: 0, te: 0, snap: true, hud: 0 };
  let W = 0, H = 0, rw = 0, rh = 0;
  const ro = new ResizeObserver(es => { const b = es[es.length - 1].contentRect; rw = b.width; rh = b.height; }); ro.observe(canvas);
  const EL0 = Math.atan2(.72, .7);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), v3 = new THREE.Vector3(), bm = new THREE.Matrix4();
  function groundAt(px, py) { const r = canvas.getBoundingClientRect(); ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(ground, hit) ? [hit.x, hit.z] : null; }
  // the people under a tap: nearest head within reach
  function personAt(px, py) { const r = canvas.getBoundingClientRect(), x = px - r.left, y = py - r.top; let best = -1, bd = 46;
    for (const m of folk.values()) { if (m === me || !m.on) continue; const d = Math.hypot(m.sx - x, m.sy + 28 - y); if (d < bd) { bd = d; best = m.s; } } return best; }

  // ---- the ferry: sails off with the voted player on deck, comes back empty
  let ferry = null;
  function sail(s) { const m = folk.get(s); ferry = { t0: T, rider: null };
    if (m) { const wrap = new THREE.Group(); wrap.scale.setScalar(K); const av = avatar3d(m.p.color, m.p.av, { pose: 'stand' }); av.position.y = LIFT; wrap.add(av); wrap.position.set(0, .74, -1.2); wrap.rotation.y = Math.PI; boat.add(wrap); ferry.rider = { wrap, av }; } }

  // ---- every frame
  const T0 = performance.now() / 1000; let T = 0, drawn = false, slowN = 0, view = 'walk';
  function animate(m, dt) {
    const mine = m === me;
    if (!mine) { const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz);
      if (d > 6) { m.x = m.tx; m.z = m.tz; m.spd = 0; }
      else if (d > .02) { const sp = m.out ? GHOST_SPEED : SPEED, step = Math.min(d, Math.max(sp * 1.15 * dt, d * dt * 6)); m.x += dx / d * step; m.z += dz / d * step; m.spd = Math.min(1.2, step / Math.max(dt, 1e-3) / sp); if (d > .25) m.tr2 = Math.atan2(dx, dz); }
      else { m.spd = 0; m.tr2 = undefined; } }
    const face = mine ? m.tr : (m.spd > .05 && m.tr2 !== undefined ? m.tr2 : m.tr);
    m.ry += wrapA(face - m.ry) * Math.min(1, dt * 12);
    m.amt += ((m.spd > .05 ? Math.min(1, m.spd) : 0) - m.amt) * Math.min(1, dt * 10);
    m.ph += dt * 9.5 * Math.max(m.amt, .001);
    // fade in and out of your lantern's light instead of popping
    const want = m.seen && (mine || view !== 'hide') ? 1 : 0; m.fade += (want - m.fade) * Math.min(1, dt * 6); if (m.fade < .01) m.fade = 0;
    const show = m.fade > .02, petOnly = m.out > 0;
    if (m.wrap) { m.wrap.visible = show && !petOnly; if (m.wrap.visible) { m.wrap.position.set(m.x, 0, m.z); m.wrap.rotation.set(0, m.ry, 0); m.wrap.scale.setScalar(K * Math.min(1, .6 + m.fade * .4));
      animateAvatar(m.av, T, { seed: m.s }); if (m.amt > .02) walkAvatar(m.av, m.ph, m.amt);
      if (m.lamp) { m.lamp.position.y = 1.25 + Math.sin(T * 2.2 + m.s) * .06; m.lamp.rotation.y = Math.sin(T * .9 + m.s) * .5; m.lamp.rotation.z = Math.sin(T * 1.7 + m.s) * .08; } } }
    if (m.pet) { const p = m.pet;
      if (petOnly) { p.x = m.x; p.z = m.z; p.ry = m.ry; p.sp = m.amt; } // out: you are the pet
      else { const gx = m.x - Math.sin(m.ry) * 1.2 + Math.cos(m.ry) * .7, gz = m.z - Math.cos(m.ry) * 1.2 - Math.sin(m.ry) * .7, dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
        if (d > 8) { p.x = gx; p.z = gz; } else if (d > .18) { const step = Math.min(d - .1, Math.max(SPEED * 1.2 * dt * Math.min(1, d), d * dt * 3)); p.x += dx / d * step; p.z += dz / d * step; p.sp += (1 - p.sp) * Math.min(1, dt * 8); p.ry += wrapA(Math.atan2(dx, dz) - p.ry) * Math.min(1, dt * 9); }
        else { p.sp += (0 - p.sp) * Math.min(1, dt * 6); if (m.amt < .05) p.ry += wrapA(m.ry - p.ry) * Math.min(1, dt * 2); } }
      p.ph += dt * (6 + p.sp * 8);
      const bob = petOnly ? .35 + Math.sin(T * 2.4 + m.s) * .12 : Math.abs(Math.sin(p.ph)) * .16 * p.sp; // pets of players who are out float a little: they are spirits now
      p.g.visible = show; p.g.position.set(p.x, bob, p.z); p.g.rotation.y = p.ry; if (show) wiggle(p.g, T, p.seed, p.sp * .6); }
  }
  const loop = frameLoop(dt => {
    if (!canvas.isConnected) return;
    if (rw !== W || rh !== H) { W = rw; H = rh; if (W && H) { renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); cam.tall = H > W; } }
    if (!W || !H) return;
    T = performance.now() / 1000 - T0;
    if (queue.length) { const t0 = performance.now(); if (me) queue.sort((a, b) => (a === me ? -1 : b === me ? 1 : 0));
      while (queue.length && performance.now() - t0 < (drawn ? 7 : 40)) { if (!build(queue[0])) queue.shift(); } }
    if (me) stepMe(dt);
    let nb = 0;
    for (const m of folk.values()) { animate(m, dt);
      if (m.fade > .3 && nb < BLOBS) { if (!m.out) blobs.setMatrixAt(nb++, bm.makeScale(.42, 1, .42).setPosition(m.x, .05, m.z)); if (m.pet && nb < BLOBS) blobs.setMatrixAt(nb++, bm.makeScale(.3, 1, .3).setPosition(m.pet.x, .05, m.pet.z)); } }
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    for (const b of beds.values()) { animateAvatar(b.av, T, { seed: b.s }); if (b.wrap.visible && Math.random() < dt * .6) fx.rise(new THREE.Vector3(b.x, 1, b.z), { color: '#d6d0ff', size: .25 }); }
    if (me) { const k = cam.snap ? 1 : Math.min(1, dt * 5); cam.x += (me.x - cam.x) * k; cam.z += (me.z - cam.z) * k; cam.snap = false; }
    { const k = Math.min(1, dt * 14); cam.yaw += (cam.ty - cam.yaw) * k; cam.el += (cam.te - cam.el) * k; }
    const d = (cam.tall ? 44 : 31) / cam.zoom, off = cam.tall ? 3.2 : 2, sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), el = EL0 + cam.el;
    const lx = cam.x - sy * off, lz = cam.z - cy * off + cam.hud * d * .02;
    camera.position.set(lx + sy * Math.cos(el) * d, Math.sin(el) * d, lz + cy * Math.cos(el) * d); camera.lookAt(lx, 1.2, lz);
    if (mark.visible) mark.scale.setScalar(1 + Math.sin(T * 6) * .12);
    if (rings.count) { const s = 1 + Math.sin(T * 3) * .06, m4 = new THREE.Matrix4(); ringList.forEach(([x, z], i) => rings.setMatrixAt(i, m4.makeScale(s, 1, s).setPosition(x, .06, z))); rings.instanceMatrix.needsUpdate = true; }
    for (const g of live) g.userData.tick(T, {}, g);
    boat.position.y = -.35 + Math.sin(T * 1.3) * .06; boat.rotation.z = Math.sin(T * .9) * .025;
    if (ferry) { const u = (T - ferry.t0) / 6; if (u >= 1) { if (ferry.rider) { boat.remove(ferry.rider.wrap); disposeAvatar(ferry.rider.av); } ferry = null; boat.position.z = BOAT[1]; boat.position.x = BOAT[0]; }
      else { const go = u < .5 ? Math.max(0, u - .08) / .42 : 1 - (u - .5) / .5, e = go * go * (3 - 2 * go); boat.position.z = BOAT[1] + e * 34; boat.position.x = BOAT[0] + e * 6; if (ferry.rider) { ferry.rider.wrap.visible = u < .5; animateAvatar(ferry.rider.av, T, { seed: 9, hop: .3 }); const a = ferry.rider.av.userData.arms?.[1]; if (a) a.rotation.x = -2.7 + Math.sin(T * 9) * .3; } } }
    fx.update(dt, camera, H);
    if (!drawn) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    for (const m of folk.values()) { const y = m.out ? 1.3 : 2.12; v3.set(m.x, y, m.z).project(camera); m.on = m.fade > .5 && v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.25; m.sx = (v3.x * .5 + .5) * W; m.sy = (-v3.y * .5 + .5) * H; }
    for (const b of beds.values()) { v3.set(b.x, .9, b.z).project(camera); b.on = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1; b.sx = (v3.x * .5 + .5) * W; b.sy = (-v3.y * .5 + .5) * H; }
    opts.frame?.(folk, me, beds, W, H);
    if (!drawn) { drawn = true; opts.ready?.(); }
  }, { onSlow: () => { // slow for a few seconds: other people's outlines go first, then the usual steps (never the resolution)
    if (++slowN && !noInk) { noInk = true; for (const m of folk.values()) if (m !== me && m.av) m.av.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial && o.material.side === THREE.BackSide) o.visible = false; }); return; }
    res.lower(); } });

  return {
    setSeats, setAt, setBeds, setRings, setMove, walkTo, groundAt, personAt, sail,
    freeze(on) { frozen = !!on; if (on) { goal = null; mark.visible = false; } },
    setView(v) { view = v; },
    // the bottom panel's height, so the camera keeps you above it (only when a real resize allows a re-fit)
    setHud(px) { if (px !== cam.hud && hudFitOk(canvas)) cam.hud = px / Math.max(1, H) * 10; },
    turn(dy, de = 0) { cam.ty += dy; cam.te = Math.max(-.3, Math.min(.35, cam.te + de)); }, resetView() { cam.ty = Math.round(cam.yaw / 6.2832) * 6.2832; cam.te = 0; },
    turned: () => Math.abs(wrapA(cam.ty)) > .04 || Math.abs(cam.te) > .04,
    setZoom(z) { cam.zoom = Math.max(.65, Math.min(1.6, z)); }, zoom: () => cam.zoom,
    me: () => me, folk: () => folk,
    burst(x, z, colors, shape = STAR) { fx.burst(new THREE.Vector3(x, 1.4, z), { n: few ? 8 : 16, colors, shape, speed: 2, up: 3, size: .3, grav: 5, life: 1.1 }); },
    hearts(x, z) { fx.burst(new THREE.Vector3(x, 1.2, z), { n: 8, colors: ['#ff6f91', '#ff9fb8', '#ffffff'], shape: HEART, speed: 1.4, up: 2.6, size: .32, grav: 3, life: 1.1 }); },
    shower(s) { if (!me) return; fx.confetti(new THREE.Vector3(me.x, 2, me.z), { n: 40, w: 3, h: 2.4, s }); },
    // a point of the island on the screen (for the lantern's light): [x, y, pixels per metre there]
    project(x, y, z) { v3.set(x, y, z).project(camera); const px = (v3.x * .5 + .5) * W, py = (-v3.y * .5 + .5) * H; v3.set(x + Math.cos(cam.yaw), y, z - Math.sin(cam.yaw)).project(camera); return [px, py, Math.hypot((v3.x * .5 + .5) * W - px, (-v3.y * .5 + .5) * H - py)]; },
    // where the camera is looking from, rounded well under a pixel: the lantern's dark is repainted only when it changes
    camKey() { const p = camera.position, q = camera.quaternion; return `${W}x${H} ${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)} ${q.x.toFixed(4)} ${q.y.toFixed(4)} ${q.z.toFixed(4)} ${q.w.toFixed(4)} ${camera.aspect.toFixed(4)}`; },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: loop.fps(), folk: folk.size, queue: queue.length }),
    lost: () => renderer.getContext().isContextLost(),
    destroy() { loop.stop(); ro.disconnect(); for (const m of folk.values()) dropModel(m); folk.clear(); for (const b of beds.values()) disposeAvatar(b.av); fx.dispose();
      scene.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) { o.geometry?.dispose(); for (const mt of [].concat(o.material || [])) if (!mt.userData?.shared) mt.dispose(); } }); renderer.dispose(); renderer.forceContextLoss(); },
  };
}

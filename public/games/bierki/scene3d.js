// Bierki 3D view (three.js). Purely visual: it draws the pile the server describes, turns a drag on the screen into
// a path for the held stick, and shows other players' pulls as they come in. The rules live in rules.js.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from '../../avatar3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { youArrow, animateArrow, disposeArrow } from '../../marker3d.js';
import { toonify, toonMat, skyDome, clouds as cloudSea, island, birds, petals, createFx, disposeToon, STAR, DOT, nightScene } from '../../scenery3d.js';
import { LEN, R, MM, REACH, LIFT_MAX, KINDS, PETS, colOf, ends } from './rules.js';

const INK = '#3b2219', SKY_TOP = '#6fbdf2', SKY_LOW = '#d6f1ff', FLOOR = -1.75, AVS = .95;
const TR = 4.4, CLOTH = '#5d4468', CLOTH2 = '#6a4f76', WOOD = '#d9955b', WOOD_TOP = '#e9ad74', WOOD_DK = '#a8683c', TIP = '#fff1d6';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const X = new THREE.Vector3(1, 0, 0);

// Several coloured pieces as one flat-shaded geometry (one draw call a stick).
function merged(parts) {
  const pos = [], col = [], c = new THREE.Color();
  for (const [geo, color] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position; c.set(color);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(c.r, c.g, c.b); }
    geo.dispose(); if (g !== geo) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
// A piece of rod along the x axis from x0 to x1.
const rod = (x0, x1, r0, r1 = r0, n = 6) => { const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, n, 1); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); return g; };
const boxAt = (x, y, z, sx, sy, sz, ry = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
// One stick lying along x, its middle at the origin: a six-sided rod with pointed pale tips and bands in its kind.
function stickGeo(kind) {
  const h = LEN / 2, tip = .24, body = kind === 'pet' ? '#f4e3c3' : KINDS[kind].col, parts = [[rod(-h + tip, h - tip, R), body]];
  parts.push([rod(-h, -h + tip, .012, R), TIP], [rod(h - tip, h, R, .012), TIP]);
  const band = (x, w, c) => parts.push([rod(x - w / 2, x + w / 2, R * 1.12), c]);
  if (kind === 'plain') { band(-.9, .05, '#b98a52'); band(.9, .05, '#b98a52'); }
  else if (kind === 'crown') { band(-.95, .1, '#fff4c2'); band(.95, .1, '#fff4c2'); band(0, .16, '#e5543b'); }
  else if (kind === 'hook') { // the hook itself: a small crook lying flat at one end
    band(-.9, .08, '#e9c48f');
    parts.push([boxAt(h - .1, 0, .09, .09, .08, .22), body], [boxAt(h - .22, 0, .2, .3, .08, .09), body], [boxAt(h - .36, 0, .13, .09, .08, .16), body]);
  } else if (kind !== 'pet') { band(-.95, .09, '#fff8ec'); band(.95, .09, '#fff8ec'); if (KINDS[kind].pts > 2) band(-.78, .05, '#fff8ec'); if (KINDS[kind].pts > 3) band(.78, .05, '#fff8ec'); if (KINDS[kind].pts > 4) band(0, .09, '#fff8ec'); }
  return merged(parts);
}
// The dark outline drawn behind a stick: the same shape as the stick, a little fatter, so it hugs the pointed tips
// (a plain fat rod here used to stick out past the points as a dark block).
const INK_W = .016;
function inkGeo(kind) {
  const h = LEN / 2, tip = .24, e = INK_W, parts = [rod(-h + tip, h - tip, R + e), rod(-h - e * 1.4, -h + tip, .012 + e * .7, R + e), rod(h - tip, h + e * 1.4, R + e, .012 + e * .7)];
  if (kind === 'hook') { const w = 2 * e; parts.push(boxAt(h - .1, 0, .09, .09 + w, .08 + w, .22 + w), boxAt(h - .22, 0, .2, .3 + w, .08 + w, .09 + w), boxAt(h - .36, 0, .13, .09 + w, .08 + w, .16 + w)); }
  const geo = merged(parts.map(g => [g, '#000'])); geo.deleteAttribute('color'); geo.deleteAttribute('normal');
  return geo;
}
function crownModel() {
  const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: '#f2bd2c', flatShading: true, roughness: .5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.15, .13, .13, 8), gold); base.position.y = .065; g.add(base);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = new THREE.Mesh(new THREE.ConeGeometry(.045, .13, 4), gold); p.position.set(Math.cos(a) * .115, .19, Math.sin(a) * .115); g.add(p); }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.045, 0), new THREE.MeshStandardMaterial({ color: '#e5543b', flatShading: true })); gem.position.set(0, .075, .15); g.add(gem);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return toonify(g, .02);
}

export function createScene(canvas, cb = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 80, 220);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 400);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-5, 15, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .012; scene.add(sun);
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = cloudSea({ min: 18, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene);
  const flyBirds = birds(scene, 24, 7, 4, 1.2), blow = petals(scene, 26, 4, { n: 9, size: .14 });
  const fx = createFx(scene), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dead = false;

  // ---------- the round table on its island ----------
  const world = new THREE.Group(); scene.add(world);
  const land = island(19, 19, { round: true, rim: 2.2, seed: 5, props: 15, flowers: 50, size: 1.9, open: .4 }); land.position.set(0, FLOOR, -.4); world.add(land);
  const tg = new THREE.Group();
  {
    const parts = [];
    const disc = (r0, r1, y0, y1, c, n = 14) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, n, 1); g.translate(0, (y0 + y1) / 2, 0); parts.push([g, c]); };
    disc(TR - .5, TR - .5, -.012, 0, CLOTH, 28); disc(TR - 2.2, TR - 2.2, -.006, .002, CLOTH2, 28);   // the cloth, with a paler middle
    disc(TR, TR, -.3, -.012, WOOD);                                                                  // the top
    { const g = new THREE.TorusGeometry(TR - .24, .26, 4, 14); g.rotateX(Math.PI / 2); g.scale(1, .32, 1); g.translate(0, -.03, 0); parts.push([g, WOOD_TOP]); } // its raised edge
    disc(.7, .5, FLOOR + .25, -.3, WOOD_DK, 8); disc(1.9, 1.5, FLOOR, FLOOR + .25, WOOD, 8);          // the leg and its foot
    const mesh = new THREE.Mesh(merged(parts), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }));
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.baked = true; tg.add(mesh); toonify(tg, .035); world.add(tg);
  }

  // ---------- sticks ----------
  const geos = {}, inks = {}, inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const baseMat = toonMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .7 }));
  const tints = {}; // a pet stick's body is tinted in its element colour
  let sticks = [], pileKey = '', S = null, me = -1, petMaker = null, pendingPets = false;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), proj = new THREE.Vector3();
  // the picked stick: a thick bright rim, and a faint copy of it that shows through the sticks lying over it
  const selMat = new THREE.MeshBasicMaterial({ color: '#ffe23d', side: THREE.BackSide }), hovMat = new THREE.MeshBasicMaterial({ color: '#fff6d8', side: THREE.BackSide });
  const xray = new THREE.Mesh(inks.plain = inkGeo('plain'), new THREE.MeshBasicMaterial({ color: '#ffe23d', transparent: true, opacity: .16, depthTest: false, depthWrite: false })); xray.renderOrder = 6; xray.scale.set(1, 1.9, 1.9);
  const EM = { none: new THREE.Color(0x000000), sel: new THREE.Color('#8a6a00'), top: new THREE.Color('#8a1408'), touch: new THREE.Color('#6a3c00'), hover: new THREE.Color('#33332a') };

  function clearSticks() {
    xray.removeFromParent();
    for (const k of sticks) { world.remove(k.g); k.mat.dispose(); if (k.top) { world.remove(k.top); disposeToon(k.top); } }
    sticks = [];
  }
  function buildSticks(pile, fresh) {
    clearSticks();
    for (const s of pile) {
      const geo = geos[s.k] ||= stickGeo(s.k), mat = baseMat.clone();
      if (s.k === 'pet') mat.color.set(tints[s.pet] ||= new THREE.Color(colOf(s)).lerp(new THREE.Color('#ffffff'), .25));
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
      const out = new THREE.Mesh(inks[s.k] ||= inkGeo(s.k), inkMat); m.add(out);
      const g = new THREE.Group(); g.add(m); world.add(g);
      const k = { s, g, m, mat, out, top: null, y0: s.y0, y1: s.y1, off: new THREE.Vector3(), want: new THREE.Vector3(), jig: 0, state: s.g, fly: null, born: fresh ? performance.now() + s.id * 28 : 0, glow: 'none' };
      if (s.k === 'crown') { k.top = crownModel(); world.add(k.top); }
      sticks.push(k);
      g.visible = !s.g; if (k.top) k.top.visible = !s.g;
    }
    addPets();
    dirty = 2;
  }
  // The four pet sticks carry a small Pet Farm pet sitting on one end.
  function addPets() {
    if (!petMaker) { pendingPets = true; return; }
    const bb = new THREE.Box3(), size = new THREE.Vector3();
    for (const k of sticks) {
      if (k.s.k !== 'pet' || k.top) continue;
      const pet = petMaker(k.s.pet, 0), g = new THREE.Group();
      bb.setFromObject(pet); bb.getSize(size); const sc = .46 / Math.max(size.x, size.y, size.z, .01);
      pet.scale.multiplyScalar(sc); pet.position.y = -bb.min.y * sc; g.add(pet);
      pet.traverse(o => { if (o.isMesh) o.castShadow = true; });
      k.top = g; g.visible = k.g.visible; world.add(g);
    }
    dirty = 2;
  }
  import('../farm/pets3d.js').then(({ petModel }) => { if (dead) return; petMaker = petModel; if (pendingPets) addPets(); }).catch(() => {});

  const endA = new THREE.Vector3(), endB = new THREE.Vector3();
  function place(k, T) {
    const s = k.s, hx = s.dx * LEN / 2, hz = s.dz * LEN / 2;
    let lift = 0;
    if (k.born) { const t = (performance.now() - k.born) / 420; if (t >= 1) k.born = 0; else lift = t < 0 ? 9 : (1 - t) * (1 - t) * 7; }
    const jx = k.jig ? Math.sin(T * 61 + s.id) * k.jig : 0, jz = k.jig ? Math.cos(T * 53 + s.id * 2) * k.jig : 0;
    endA.set(s.cx - hx + k.off.x + jx, k.y0 + k.off.y + lift, s.cz - hz + k.off.z + jz);
    endB.set(s.cx + hx + k.off.x + jx, k.y1 + k.off.y + lift, s.cz + hz + k.off.z + jz);
    k.g.position.addVectors(endA, endB).multiplyScalar(.5);
    k.g.quaternion.setFromUnitVectors(X, V.subVectors(endB, endA).normalize());
    if (k.fly) {
      const f = k.fly, t = clamp((performance.now() - f.t0) / f.ms, 0, 1), e = t * t * (3 - 2 * t);
      k.g.position.lerp(f.to, e); k.g.position.y += Math.sin(t * Math.PI) * f.arc; k.g.scale.setScalar(1 - e * .75);
      if (f.spin) k.g.rotateY(e * f.spin);
      if (t >= 1) { k.g.visible = false; if (k.top) k.top.visible = false; k.fly = null; }
    }
    if (k.top && k.top.visible) {
      if (k.fly) { k.top.position.copy(k.g.position); k.top.scale.copy(k.g.scale); }
      else { k.top.position.copy(endB).addScaledVector(V, -.2); k.top.position.y += R; k.top.rotation.y = Math.atan2(V.x, V.z) + Math.PI / 2; }
    }
  }

  // ---------- players ----------
  let players = [], seatsKey = '';
  const arrow = youArrow(); arrow.visible = false; arrow.scale.setScalar(1.5); world.add(arrow);
  function setSeats(list) {
    const k = list.map(p => p.color + p.av.join('')).join('|');
    if (k === seatsKey) return;
    seatsKey = k;
    for (const p of players) { world.remove(p.wrap); disposeAvatar(p.av); }
    const n = list.length, span = Math.min(2.5, .62 * (n - 1));
    players = list.map((s, i) => {
      const av = avatar3d(s.color, s.av, { pose: 'stand', hand: false }), wrap = new THREE.Group(); wrap.scale.setScalar(AVS); wrap.add(av); world.add(wrap);
      const a = -Math.PI / 2 + (n > 1 ? (i / (n - 1) - .5) * span : 0); // a row round the far side of the table
      return { i, av, wrap, a, r: TR + 1.25, hop: 0, mood: 0, moodT: 0, tag: { x: 0, y: 0, show: false } };
    });
    camKey = '';
  }

  // ---------- state ----------
  let held = null;      // my own pull: { id, st } (the client's startPull state; its .off is where the stick is)
  let glow = null;      // { sel, top: [], touch: [] } from the client
  let dirty = 2;
  function setState(s) {
    const fresh = !S || S.gid !== s.gid || S.pileN !== s.pileN;
    S = s; me = s.me;
    if (!s.pile) return;
    const key = s.gid + '/' + s.pileN;
    if (key !== pileKey) { pileKey = key; buildSticks(s.pile, fresh); return; }
    for (const k of sticks) {
      const ns = s.pile[k.s.id]; if (!ns) continue;
      k.s.y0 = ns.y0; k.s.y1 = ns.y1; k.s.g = ns.g; k.s.by = ns.by;
      if (ns.g && !k.state) { k.state = ns.g; leave(k); }
    }
    dirty = 2;
  }
  // A stick leaves the table: to the player who took it, or tumbling off the edge when it is out of play.
  function leave(k) {
    const to = new THREE.Vector3();
    if (k.state === 1 && players[k.s.by]) { to.copy(players[k.s.by].wrap.position); to.y += .9; k.fly = { to, t0: performance.now(), ms: 620, arc: 1.2, spin: 0 }; }
    else { const a = Math.atan2(k.g.position.z, k.g.position.x); to.set(Math.cos(a) * (TR + 2.5), FLOOR + .2, Math.sin(a) * (TR + 2.5)); k.fly = { to, t0: performance.now(), ms: 900, arc: 1.6, spin: 5 }; }
    k.jig = 0;
  }

  // ---------- camera: turn it by dragging the cloth or the sky, pinch or scroll to zoom ----------
  const orb = { yaw: 0, el: .93, zoom: 1, tyaw: 0, tel: .93, tzoom: 1 };
  const look = new THREE.Vector3(0, .1, 0);
  let W = 0, Hh = 0, shadowIn = 0, camKey = '', padTop = 0, padBot = 0, fitDist = 14;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === W && h === Hh) return;
    W = w; Hh = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  const camAt = (dist, yaw, el) => camera.position.set(look.x + Math.sin(yaw) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(yaw) * Math.cos(el) * dist);
  function fitCamera() {
    const key = [W, Hh, padTop, padBot, players.length].join('/');
    if (key === camKey) return; camKey = key;
    // back off until the table and the row of players fit in the part of the screen the HUD leaves free
    const pts = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([Math.cos(a) * TR, 0, Math.sin(a) * TR]); }
    const tall = W < Hh; // on an upright phone the table gets the width: players at the ends of the row may stand partly off screen
    for (const p of players) pts.push([tall ? 0 : Math.cos(p.a) * p.r, FLOOR + 2 * AVS + .5, Math.sin(p.a) * p.r]);
    const shift = (padTop - padBot) / 2;
    const fits = dist => {
      camAt(dist, 0, .93); camera.lookAt(look); camera.updateMatrixWorld();
      for (const [x, y, z] of pts) {
        proj.set(x, y, z).project(camera);
        const py = (1 - proj.y) / 2 * Hh + shift;
        if (Math.abs(proj.x) > 1 - 20 / Math.max(1, W) || py < padTop + 4 || py > Hh - padBot - 4) return false;
      }
      return true;
    };
    camera.clearViewOffset(); camera.updateProjectionMatrix();
    let lo = 7, hi = 70; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
    fitDist = hi;
    camera.setViewOffset(W, Hh, 0, -Math.round(shift), W, Hh);
  }

  // ---------- pointer ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  const ptrs = new Map();
  let mode = '', grab = null, last = null, pinch = 0, hover = -1, liftMode = false, shift = false, lastSent = null, lastAt = 0;
  // The camera's view offset already moves the picture down for the HUD, so screen points need no extra shift
  // (adding it a second time put every hit box about 30 px away from the stick you could see).
  function aim(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera); return r; }
  const toScreen = (x, y, z) => { proj.set(x, y, z).project(camera); return [(proj.x + 1) / 2 * W, (1 - proj.y) / 2 * Hh, proj.z]; };
  // Which stick the pointer means. First the stick actually drawn under the pointer (its outline and the pet or
  // crown on it count too), so at a crossing you get the one lying on top. If the pointer is on bare cloth, the
  // stick whose middle line is nearest on screen wins, within `slack` px.
  const hitList = [];
  function stickAt(e, slack) {
    const r = aim(e), px = e.clientX - r.left, py = e.clientY - r.top;
    // only the stick itself and its pet or crown: not the outline, which grows while a stick is highlighted
    let top = -1, near = Infinity;
    for (const k of sticks) {
      if (k.s.g || k.fly || !k.g.visible) continue;
      hitList.length = 0; ray.intersectObject(k.m, false, hitList); if (k.top) ray.intersectObject(k.top, true, hitList);
      for (const h of hitList) if (h.distance < near) { near = h.distance; top = k.s.id; }
    }
    if (top >= 0) return top;
    let best = -1, bd = slack;
    for (const k of sticks) {
      if (k.s.g || k.fly || !k.g.visible) continue;
      const [a, b] = ends(k.s, k.off);
      const [ax, ay] = toScreen(a.x, a.y, a.z), [bx, by] = toScreen(b.x, b.y, b.z);
      const ex = bx - ax, ey = by - ay, u = clamp(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      const d = Math.hypot(px - (ax + ex * u), py - (ay + ey * u));
      if (d < bd) { bd = d; best = k.s.id; }
    }
    return best;
  }
  const slackOf = e => (e.pointerType === 'mouse' ? 18 : 30);
  function planeAt(e, y) { aim(e); plane.set(V2.set(0, 1, 0), -y); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
  const mayLift = () => !!cb.canLift?.() && (liftMode || shift);
  function down(e) {
    // stop the browser's own drag (Firefox drags the canvas as a picture, or the page selection) so the view and
    // the sticks get the drag instead
    e.preventDefault(); getSelection?.()?.removeAllRanges?.();
    canvas.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { if (mode === 'pull') letGo(); mode = 'pinch'; const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); last = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return; }
    last = { x: e.clientX, y: e.clientY }; shift = e.shiftKey;
    let id = -1; try { if (cb.canPull?.()) id = stickAt(e, slackOf(e)); } catch (err) { console.warn('bierki pick', err); }
    if (id < 0) { mode = 'orbit'; return; }
    const st = cb.pick?.(id); if (!st) { mode = 'orbit'; return; }
    held = { id, st }; mode = 'pull'; hover = -1;
    const k = sticks[id], y = (k.s.y0 + k.s.y1) / 2 + st.off.y;
    grab = { p: planeAt(e, y), off: { ...st.off }, y0: e.clientY, lift: mayLift() };
    lastSent = { ...st.off }; lastAt = performance.now();
  }
  function move(e) {
    const pt = ptrs.get(e.pointerId);
    if (!pt) { if (e.pointerType === 'mouse' && !mode) { let h = -1; try { if (cb.canPull?.()) h = stickAt(e, slackOf(e)); } catch {} if (h !== hover) { hover = h; cb.hover?.(h); dirty = 1; } canvas.style.cursor = h >= 0 ? 'grab' : ''; } return; }
    pt.x = e.clientX; pt.y = e.clientY;
    if (mode === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      orb.tzoom = clamp(orb.tzoom * pinch / Math.max(1, d), .45, 1.5); pinch = d;
      orb.tyaw -= (mx - last.x) * .006; orb.tel = clamp(orb.tel + (my - last.y) * .005, .45, 1.45); last = { x: mx, y: my };
      return;
    }
    if (mode === 'orbit') { orb.tyaw -= (e.clientX - last.x) * .006; orb.tel = clamp(orb.tel + (e.clientY - last.y) * .005, .45, 1.45); last = { x: e.clientX, y: e.clientY }; return; }
    if (mode !== 'pull' || !held) return;
    const st = held.st, k = sticks[held.id]; let x, y, z;
    const lift = mayLift();
    if (lift !== grab.lift) { grab = { p: planeAt(e, (k.s.y0 + k.s.y1) / 2 + st.off.y), off: { ...st.off }, y0: e.clientY, lift }; }
    if (grab.lift) { x = grab.off.x; z = grab.off.z; y = clamp(grab.off.y + (grab.y0 - e.clientY) * (fitDist * orb.zoom / Math.max(300, Hh)) * .75, 0, LIFT_MAX); }
    else {
      const p = planeAt(e, (k.s.y0 + k.s.y1) / 2 + st.off.y); if (!p || !grab.p) return;
      x = grab.off.x + p.x - grab.p.x; z = grab.off.z + p.z - grab.p.z; y = st.off.y;
      const len = Math.hypot(x, z); if (len > REACH - .2) { x *= (REACH - .2) / len; z *= (REACH - .2) / len; }
    }
    const now = performance.now(), ms = Math.round(now - lastAt);
    if (ms < 12) return;
    const q = [Math.round(x * MM), Math.round(y * MM), Math.round(z * MM)];
    if (q[0] === Math.round(lastSent.x * MM) && q[1] === Math.round(lastSent.y * MM) && q[2] === Math.round(lastSent.z * MM)) return;
    lastAt = now; lastSent = { x: q[0] / MM, y: q[1] / MM, z: q[2] / MM };
    if (cb.move?.(q[0], q[1], q[2], ms) === false) { mode = ''; }
    dirty = 2;
  }
  function letGo() { if (held) { cb.drop?.(); } mode = ''; }
  function up(e) {
    ptrs.delete(e.pointerId);
    if (mode === 'pull') letGo();
    if (!ptrs.size) mode = ''; else if (mode === 'pinch') { mode = 'orbit'; const a = [...ptrs.values()][0]; last = { x: a.x, y: a.y }; }
  }
  function wheel(e) { e.preventDefault(); orb.tzoom = clamp(orb.tzoom * (1 + Math.sign(e.deltaY) * .09), .45, 1.5); }
  const keyDown = e => { if (e.key === 'Shift') shift = true; }, keyUp = e => { if (e.key === 'Shift') shift = false; };
  const noDrag = e => e.preventDefault(); canvas.draggable = false;
  canvas.addEventListener('dragstart', noDrag); canvas.addEventListener('selectstart', noDrag);
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: false });
  addEventListener('keydown', keyDown); addEventListener('keyup', keyUp);

  // ---------- frame loop ----------
  function loop(dt) {
    resize(); fitCamera();
    const now = performance.now(), T = now / 1000;
    cloudRing.rotation.y = T * .006; flyBirds(T); blow(T);
    let moving = dirty > 0; if (dirty) dirty--;
    orb.yaw += (orb.tyaw - orb.yaw) * Math.min(1, dt * 12); orb.el += (orb.tel - orb.el) * Math.min(1, dt * 12); orb.zoom += (orb.tzoom - orb.zoom) * Math.min(1, dt * 12);
    camAt(fitDist * orb.zoom, orb.yaw, orb.el); camera.lookAt(look);

    const rp = S?.pull, mine = held ? held.id : -1, shake = held ? held.st.shake : rp?.shake ? Object.fromEntries(rp.shake.map(i => [i, .4])) : null;
    for (const k of sticks) {
      if (!k.g.visible) continue;
      const id = k.s.id;
      if (k.fly) { moving = true; continue; } // on its way off the table: it leaves from where it was let go
      // where the stick should be: carried by me, carried by someone else, or at rest
      if (id === mine) k.want.set(held.st.off.x, held.st.off.y, held.st.off.z);
      else if (rp && rp.id === id && !k.s.g) k.want.set(rp.off[0] / MM, rp.off[1] / MM, rp.off[2] / MM);
      else k.want.set(0, 0, 0);
      const d = k.off.distanceTo(k.want);
      if (d > 1e-4) { if (id === mine) k.off.copy(k.want); else k.off.lerp(k.want, Math.min(1, dt * 16)); moving = true; }
      if (Math.abs(k.y0 - k.s.y0) > 1e-4 || Math.abs(k.y1 - k.s.y1) > 1e-4) { const t = Math.min(1, dt * 9); k.y0 += (k.s.y0 - k.y0) * t; k.y1 += (k.s.y1 - k.y1) * t; moving = true; }
      const want = !reduced && shake && shake[id] ? .012 + .03 * Math.min(1, shake[id]) : 0;
      k.jig += (want - k.jig) * Math.min(1, dt * 14); if (k.jig < .0005) k.jig = 0; else moving = true;
      if (k.born || k.fly) moving = true;
      let g = 'none';
      if (glow) { if (glow.sel === id) g = 'sel'; else if (glow.top.includes(id)) g = 'top'; else if (glow.touch.includes(id)) g = 'touch'; }
      if (g === 'none' && hover === id) g = 'hover';
      if (g !== k.glow) {
        k.glow = g; k.mat.emissive.copy(EM[g]);
        const rim = g === 'sel' ? 2 : g === 'hover' ? 1.7 : 1;
        k.out.material = g === 'sel' ? selMat : g === 'hover' ? hovMat : inkMat; k.out.scale.set(1, rim, rim);
        if (g === 'sel') { xray.geometry = k.out.geometry; k.m.add(xray); } else if (xray.parent === k.m) k.m.remove(xray);
        moving = true;
      }
      if (g === 'sel' && !reduced) { const p = 2 + Math.sin(T * 6) * .22; k.out.scale.set(1, p, p); moving = true; }
    }
    if (moving) for (const k of sticks) if (k.g.visible) place(k, T);

    const turn = S ? S.turn : -1;
    players.forEach((p, i) => {
      const up = i === turn, r = p.r - (up ? .45 : 0);
      p.rr = p.rr == null ? r : p.rr + (r - p.rr) * Math.min(1, dt * 6);
      p.hop = Math.max(0, p.hop - dt * 1.2); p.moodT = Math.max(0, p.moodT - dt);
      const jump = Math.sin(p.hop * Math.PI) * .5; if (jump > .01 || Math.abs(p.rr - r) > .01) moving = true;
      p.wrap.position.set(Math.cos(p.a) * p.rr, FLOOR + .76 * AVS + jump, Math.sin(p.a) * p.rr); p.wrap.rotation.y = Math.atan2(-p.wrap.position.x, -p.wrap.position.z);
      animateAvatar(p.av, T, { seed: i, active: up || p.moodT > 0, hop: p.hop, nod: p.mood < 0 && p.moodT > 0 ? Math.min(1, p.moodT * 3) * .9 : 0 });
    });
    const my = players[me];
    arrow.visible = !!my;
    if (my) { arrow.position.copy(my.wrap.position); arrow.position.y += 1.75 * AVS + .3; animateArrow(arrow, T); }

    shadowIn -= dt;
    if (shadowIn <= 0) { renderer.shadowMap.needsUpdate = true; shadowIn = moving ? .034 : .3; }
    fx.update(dt, camera, Hh);
    renderer.render(scene, camera);
    for (const p of players) {
      proj.copy(p.wrap.position); proj.y += 1.8 * AVS; proj.project(camera);
      p.tag.show = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      p.tag.x = (proj.x + 1) / 2 * W; p.tag.y = (1 - proj.y) / 2 * Hh;
    }
    cb.onFrame?.({ tags: players.map(p => p.tag) });
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setSeats, setState,
    setPads(t, b) { padTop = t; padBot = b; },
    setGlow(g) { glow = g; dirty = 1; },
    setLift(on) { liftMode = !!on; },
    // my own pull ended (taken, failed, put back or cancelled by the server)
    release() { held = null; if (mode === 'pull') mode = ''; dirty = 2; },
    holding: () => (held ? held.id : -1),
    resetView() { const turns = Math.round(orb.yaw / (Math.PI * 2)) * Math.PI * 2; orb.yaw -= turns; orb.tyaw = 0; orb.tel = .93; orb.tzoom = 1; },
    // where a stick is on the screen, for the "+3" that floats up from it
    screenOf(id) { const k = sticks[id]; if (!k) return null; proj.copy(k.g.position).project(camera); return { x: (proj.x + 1) / 2 * W, y: (1 - proj.y) / 2 * Hh }; },
    sparkle(id, color) { const k = sticks[id]; if (k && !reduced) fx.burst(V2.copy(k.g.position), { n: 12, colors: [color, '#ffd84a', '#ffffff'], speed: 1.8, up: 2.4, size: .13, life: .7, shape: [STAR, DOT] }); },
    thud(id) { const k = sticks[id]; if (k && !reduced) fx.burst(V2.copy(k.g.position), { n: 10, colors: ['#ffffff', '#ffb0a0'], speed: 1.6, up: 1.2, size: .12, life: .5, shape: DOT }); },
    mood(i, good) { const p = players[i]; if (p) { p.mood = good ? 1 : -1; p.moodT = 1.6; if (good) p.hop = 1; } },
    // a winner's shower over their head, in their own win effect from the Wardrobe
    cheer(i) { const p = players[i]; if (p && !reduced) fx.confetti(p.wrap.position.clone().setY(p.wrap.position.y + 1.6 * AVS + .6), { n: 60, w: 2.6, h: 2, s: i }); },
    dispose() {
      dead = true; ticker.stop();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('dragstart', noDrag); canvas.removeEventListener('selectstart', noDrag); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel);
      removeEventListener('keydown', keyDown); removeEventListener('keyup', keyUp);
      for (const p of players) disposeAvatar(p.av);
      clearSticks(); for (const k in geos) geos[k].dispose(); for (const k in inks) inks[k].dispose(); inkMat.dispose(); selMat.dispose(); hovMat.dispose(); xray.material.dispose();
      disposeToon(land); disposeToon(tg); disposeToon(cloudRing); fx.dispose(); disposeArrow(arrow); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

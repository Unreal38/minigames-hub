// The hub's hero: your own avatar standing on a little floating island, with game pieces bobbing round it,
// on the right of the hub's sky banner.
// One canvas for the whole visit: mountHero() moves it into the hub's .art box each time the hub is drawn,
// and the loop sleeps while the canvas isn't on the page.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from './avatar3d.js';
import { birds, petals, createFx, disposeToon, CONF } from './scenery3d.js';
import { buildIsle, buildSky, pieceModel } from './isle3d.js';
import { piecesOf } from './cosmetics.js';
import { frameLoop, autoResolution } from './frames.js';

let H = null, P = null, night = false; // H: your own isle on the hub; P: the isle in another player's profile card
export function setHeroNight(on) { night = on; H?.setNight(on); P?.setNight(on); }

function build() {
  const canvas = document.createElement('canvas'); canvas.className = 'hero3d'; canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const res = autoResolution(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 200);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffe9c9', 2); scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 1.5); key.position.set(5, 12, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 }); key.shadow.normalBias = .03; scene.add(key);

  const world = new THREE.Group(); scene.add(world);
  // The isle itself, as the player dressed it (isle3d.js): ground, rock base, decor and sky. Rebuilt only when the look changes.
  let isle = null, sky = null, air = null, airG = null, isleKey = null, skyNo = 0;
  function setIsle(fl) {
    setBits(fl?.fp);
    const look = { ig: fl?.ig | 0, ib: fl?.ib | 0, ik: fl?.ik | 0, ip: Array.isArray(fl?.ip) ? fl.ip.slice(0, 3) : [] }, k = JSON.stringify(look);
    if (k === isleKey) return; isleKey = k;
    if (isle) { world.remove(isle.root); isle.dispose(); } if (sky) { scene.remove(sky.root); sky.dispose(); }
    if (airG) { scene.remove(airG); airG.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
    isle = buildIsle(look); world.add(isle.root);
    sky = buildSky(look.ik); scene.add(sky.root); skyNo = look.ik; sky.fit(camera.aspect);
    airG = new THREE.Group(); scene.add(airG); air = petals(airG, 9, 2.8, isle.air);
    setNight(night);
  }

  // Game pieces floating round the island: the player picks which (cosmetics.js PIECES, models in isle3d.js pieceModel).
  let bits = [], bitsKey = null;
  function setBits(list) {
    list = piecesOf({ cos: { fp: list } }); const k = list.join(); if (k === bitsKey) return; bitsKey = k;
    for (const b of bits) { world.remove(b.g); disposeToon(b.g); }
    bits = list.map((id, i) => { const g = pieceModel(id); world.add(g); return { g, r: 3.2 + (i % 3) * .12, a: i / list.length * 6.283 + .4, y: 1.25 + (i * 7 % 5) * .28, spin: [0, 1, .4, .7, .2, .9][i % 6] }; });
  }
  const flyBirds = birds(scene, 9, 4.5, 3, .6);
  const fx = createFx(scene, { max: 200 });

  let av = null, avKey = '', hop = 0, look = 0, lookWant = 0, T = 0, W = 0, Hh = 0;
  const camAt = new THREE.Vector3(0, 3.4, 19.5), target = new THREE.Vector3(0, -.2, 0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  canvas.addEventListener('pointerdown', () => { // poke yourself for a happy hop
    hop = 1; fx.burst(new THREE.Vector3(0, 2.6 + world.position.y, 0), { n: 22, colors: ['#ff7a59', '#ffc93c', '#7ed3b2', '#8a98ff', '#ff9fb8'], shape: CONF, speed: 3.5, up: 4 });
  });
  addEventListener('pointermove', e => { if (!canvas.isConnected) return; const r = canvas.getBoundingClientRect(); lookWant = Math.max(-.6, Math.min(.6, ((e.clientX - r.left) / r.width - .5) * 1.4)); });

  function setAvatar(color, a) {
    const k = color + JSON.stringify(a); if (k === avKey) return; avKey = k;
    if (av) { world.remove(av); disposeAvatar(av); }
    av = avatar3d(color, a, { pose: 'stand' }); av.position.y = .76; av.traverse(o => { if (o.isMesh) o.castShadow = true; }); world.add(av);
  }
  // Pet Farm pets shown off beside the avatar: up to three, each on its own spot. The pet models load only when needed.
  const SPOTS = [[1.1, .7, -.45], [-1.1, .7, .45], [.05, 1.3, .1]]; // inside the island's clear middle (the rim holds the trees)
  let pals = [], palKey = '';
  function setPets(list) {
    list = (list || []).slice(0, SPOTS.length);
    const k = JSON.stringify(list.map(x => [x.sp, x.lv, x.look])); if (k === palKey) return; palKey = k;
    for (const g of pals) { world.remove(g); g.userData.dispose?.(); } pals = [];
    if (!list.length) return;
    Promise.all([import('./games/farm/pets3d.js'), import('./games/farm/models.js'), import('./games/farm/data.js')]).then(([{ petModel }, { disposeModel }, { formOf }]) => {
      if (k !== palKey) return;
      pals = list.map((x, i) => {
        const g = petModel(x.sp, formOf(x.lv | 0), x.look || null), [px, pz, ry] = SPOTS[i];
        g.scale.setScalar(.5 + .05 * formOf(x.lv | 0)); g.position.set(px, 0, pz); g.rotation.y = ry; g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        g.userData.dispose = () => disposeModel(g); g.userData.i = i; world.add(g); return g;
      });
    }).catch(() => {});
  }
  const loop = dt => {
    if (!canvas.isConnected) return;
    const r = canvas.getBoundingClientRect();
    if (r.width !== W || r.height !== Hh) { W = r.width; Hh = r.height; renderer.setSize(W, Hh, false); camera.aspect = W / Math.max(1, Hh); camera.updateProjectionMatrix(); sky?.fit(camera.aspect); }
    if (!W || !Hh) return;
    if (!reduced) T += dt;
    world.position.y = Math.sin(T * .8) * .12; world.rotation.y = Math.sin(T * .15) * .25;
    for (const b of bits) { const a = b.a + T * .25; b.g.position.set(Math.cos(a) * b.r, b.y + Math.sin(T * 1.4 + b.a) * .2, Math.sin(a) * b.r * .6); b.g.rotation.set(T * b.spin * .7, T * (.4 + b.spin), 0); }
    look += (lookWant - look) * Math.min(1, dt * 4); hop = Math.max(0, hop - dt * 1.2);
    if (av) {
      animateAvatar(av, T, { hop, look: look - world.rotation.y });
    }
    for (const g of pals) { const u = (T * .55 + g.userData.i * .37) % 1, j = u < .22 ? Math.sin(u / .22 * Math.PI) : 0; // a little hop now and then, and one with you when poked
      g.position.y = j * .22 + Math.sin(Math.min(1, (1 - hop) * 1.6) * Math.PI) * (hop > 0 ? .5 : 0); g.rotation.z = Math.sin(T * 1.7 + g.userData.i * 2) * .04; }
    camera.position.copy(camAt); camera.position.x += Math.sin(T * .2) * .4; camera.lookAt(target);
    flyBirds(T); air?.(T); isle?.tick(T); sky?.tick(T); fx.update(dt, camera, Hh);
    renderer.render(scene, camera);
  };
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });
  function setNight(want) { // moonlight: cooler and dimmer, lamps glowing. A night or day sky decides for itself; a sunset warms the light.
    const mood = sky?.mood || '', on = mood === 'night' || (want && mood !== 'day' && mood !== 'sunset'), warm = mood === 'sunset';
    hemi.color.set(on ? '#9aa6ff' : warm ? '#ffd9c0' : '#ffffff'); hemi.groundColor.set(on ? '#5a3a6a' : warm ? '#ff9a8a' : '#ffe9c9'); hemi.intensity = on ? 1.35 : warm ? 1.7 : 2;
    key.color.set(on ? '#c8d0ff' : warm ? '#ffc08a' : '#ffffff'); key.intensity = on ? .9 : 1.5;
    isle?.root.traverse(o => { if (o.userData.nightOnly) o.visible = on; }); // lamp posts
  }
  setIsle(null);
  const setZoom = k => { camAt.set(0, 3.4, 19.5 / k); target.y = -.2 - (k - 1) * 1.2; };
  return { canvas, setAvatar, setPets, setIsle, setNight, setZoom, ticker, skyNo: () => skyNo };
}

// fl: the player's flair; its isle kinds (ig ground, ib rock base, ip decor, ik sky) dress the isle.
const skyCls = (box, n) => { for (const c of [...box.classList]) if (/^isk\d/.test(c)) box.classList.remove(c); if (n) box.classList.add('isk' + n); };
// frame: the hub's sky banner (it gets a class isk1.. for a bought sky); zoom brings the camera closer so the isle fills it.
export function mountHero(box, color, av, pets = [], fl = null, { frame = null, zoom = 1 } = {}) {
  if (!box) return false;
  try { H ||= build(); } catch { return false; }
  H.setAvatar(color, av); H.setPets(pets); H.setIsle(fl); H.setZoom(zoom); if (frame) skyCls(frame, H.skyNo());
  if (H.canvas.parentNode !== box) box.replaceChildren(H.canvas);
  return true;
}
// The same isle for someone else: their avatar and the pets they show off, in a profile card.
// frame: the element whose background is the sky (it gets a class isk1.. for a bought sky; see style.css).
export function mountIsle(box, color, av, pets = [], fl = null, frame = box) {
  if (!box) return false;
  try { P ||= build(); } catch { return false; }
  P.setAvatar(color, av); P.setPets(pets); P.setIsle(fl); skyCls(frame, P.skyNo());
  if (P.canvas.parentNode !== box) box.replaceChildren(P.canvas);
  return true;
}

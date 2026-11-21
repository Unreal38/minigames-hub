// The hub's hero: your own avatar standing on a little floating island, with game pieces bobbing round it.
// One canvas for the whole visit: mountHero() moves it into the hub's .art box each time the hub is drawn,
// and the loop sleeps while the canvas isn't on the page.
import * as THREE from 'three';
import { avatar3d, animateAvatar, disposeAvatar } from './avatar3d.js';
import { toonify, toonMat, island, birds, petals, createFx, CONF } from './scenery3d.js';
import { frameLoop, autoResolution } from './frames.js';

let H = null, night = false;
export function setHeroNight(on) { night = on; H?.setNight(on); }

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
  const land = island(1.6, 1.6, { round: true, seed: 7, props: 9, rim: 1.5, flowers: 26, size: .9 }); world.add(land);

  // game pieces floating round the island: three marbles, a die, a Ludo pawn and a card
  const M = (c, o = {}) => toonMat(new THREE.MeshStandardMaterial({ color: c, roughness: .5, ...o }));
  const bits = [];
  const add = (mesh, r, a, y, spin) => { const g = new THREE.Group(); g.add(mesh); toonify(g, .04); world.add(g); bits.push({ g, r, a, y, spin }); };
  [['#ff8fab', .32], ['#7ed3b2', .26], ['#8fb8ff', .3]].forEach(([c, s], i) => add(new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), M(c)), 2.7 + i * .2, i * 2.1, 1.5 + i * .45, 0));
  const die = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), M('#fff4e2'));
  for (const [x, y, z] of [[0, .26, 0], [.26, 0, .1], [.26, 0, -.1], [-.12, -.1, .26], [.12, .1, .26], [0, 0, .26]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), M('#3b2219')); p.position.set(x, y, z); die.add(p); }
  add(die, 2.9, 1.05, 2.3, 1);
  const pawn = new THREE.Group(); pawn.add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, .2, 16), M('#ffb547')));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.09, .16, .34, 14), M('#ffb547')); neck.position.y = .26; pawn.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), M('#ffb547')); head.position.y = .5; pawn.add(head);
  add(pawn, 2.8, 3.2, 1.2, .4);
  const card = new THREE.Mesh(new THREE.BoxGeometry(.42, .6, .03), M('#ffffff')); const band = new THREE.Mesh(new THREE.BoxGeometry(.42, .12, .035), M('#e5543b')); band.position.y = .2; card.add(band);
  add(card, 2.9, 5.1, 2.1, .7);

  const flyBirds = birds(scene, 9, 4.5, 3, .6), blow = petals(scene, 9, 2.8, { n: 8, size: .08 });
  const fx = createFx(scene, { max: 200 });

  let av = null, avKey = '', hop = 0, look = 0, lookWant = 0, T = 0, W = 0, Hh = 0;
  const camAt = new THREE.Vector3(0, 3.2, 17), target = new THREE.Vector3(0, -.2, 0);
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
  const loop = dt => {
    if (!canvas.isConnected) return;
    const r = canvas.getBoundingClientRect();
    if (r.width !== W || r.height !== Hh) { W = r.width; Hh = r.height; renderer.setSize(W, Hh, false); camera.aspect = W / Math.max(1, Hh); camera.updateProjectionMatrix(); }
    if (!W || !Hh) return;
    if (!reduced) T += dt;
    world.position.y = Math.sin(T * .8) * .12; world.rotation.y = Math.sin(T * .15) * .25;
    for (const b of bits) { const a = b.a + T * .25; b.g.position.set(Math.cos(a) * b.r, b.y + Math.sin(T * 1.4 + b.a) * .2, Math.sin(a) * b.r * .6); b.g.rotation.set(T * b.spin * .7, T * (.4 + b.spin), 0); }
    look += (lookWant - look) * Math.min(1, dt * 4); hop = Math.max(0, hop - dt * 1.2);
    if (av) {
      animateAvatar(av, T, { hop, look: look - world.rotation.y });
    }
    camera.position.copy(camAt); camera.position.x += Math.sin(T * .2) * .4; camera.lookAt(target);
    flyBirds(T); blow(T); fx.update(dt, camera, Hh);
    renderer.render(scene, camera);
  };
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });
  function setNight(on) { // moonlight: cooler and dimmer, lamps glowing
    hemi.color.set(on ? '#9aa6ff' : '#ffffff'); hemi.groundColor.set(on ? '#5a3a6a' : '#ffe9c9'); hemi.intensity = on ? 1.35 : 2;
    key.color.set(on ? '#c8d0ff' : '#ffffff'); key.intensity = on ? .9 : 1.5;
  }
  setNight(night);
  return { canvas, setAvatar, setNight, ticker };
}

export function mountHero(box, color, av) {
  if (!box) return false;
  try { H ||= build(); } catch { return false; }
  H.setAvatar(color, av);
  box.replaceChildren(H.canvas);
  return true;
}

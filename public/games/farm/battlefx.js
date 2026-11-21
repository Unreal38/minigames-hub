// Pet Farm battle effects: what every move looks like in the ring. Each move has its own motion for the pet that
// uses it and its own little shapes flying about. Purely for show: the rules live in battle.js.
//   createBattleFx(ring, HOME, tflat) ->
//     move(s, id)        play move `id` for side s; returns the seconds until it lands
//     hit(s, el, eff) / heal(s) / stat(s, d) / status(s, st) / dazed(s) / faint(s) / enter(s) / burn(s)
//     state(s, statuses) which lasting troubles to keep showing on side s
//     pose(s, o)         fills o with where the move puts the pet right now
//     update(dt)         every frame; .shake is how hard the camera should rattle (0..1)
//     clear()
import * as THREE from 'three';

export const EL_COL = { Leaf: '#6fcf6a', Ember: '#ff8a3c', Tide: '#4fb3ff', Spark: '#ffd84a', Stone: '#a89a8c' };
const TAU = Math.PI * 2, rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pop = u => Math.sin(Math.min(1, Math.max(0, u)) * Math.PI), out = u => 1 - (1 - Math.min(1, Math.max(0, u))) ** 2;
const seg = (u, a, b) => Math.min(1, Math.max(0, (u - a) / (b - a)));

function flatShape(pts, depth) { // a flat outline given a little thickness, centred
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}

export function createBattleFx(ring, HOME, tflat) {
  const G = {
    ball: new THREE.IcosahedronGeometry(1, 1), rock: new THREE.IcosahedronGeometry(1, 0), cone: new THREE.ConeGeometry(.5, 1, 6), box: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.TorusGeometry(1, .07, 5, 22), disc: new THREE.CircleGeometry(1, 24), leaf: new THREE.OctahedronGeometry(1, 0).scale(.45, .1, 1),
    drop: new THREE.ConeGeometry(.5, 1.4, 6).translate(0, .3, 0),
    star: flatShape(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? .45 : 1, a = i / 10 * TAU + Math.PI / 2; return [Math.cos(a) * r, Math.sin(a) * r]; }), .3),
    plus: flatShape([[-.3, 1], [.3, 1], [.3, .3], [1, .3], [1, -.3], [.3, -.3], [.3, -1], [-.3, -1], [-.3, -.3], [-1, -.3], [-1, .3], [-.3, .3]], .4),
    arrow: flatShape([[0, 1], [.8, .1], [.32, .1], [.32, -1], [-.32, -1], [-.32, .1], [-.8, .1]], .3),
  };
  const mats = new Map(), M = c => { if (!mats.has(c)) mats.set(c, tflat(c)); return mats.get(c); };
  // a see-through, glowing material of its own, so it can fade
  const glow = (c, o = 1) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }); m.userData.own = true; return m; };
  const mat = c => typeof c === 'string' ? M(c) : c;

  const parts = [], later = [], anims = [null, null], states = [[], []];
  let shake = 0, drip = 0, hold = 0;
  const ink = new THREE.MeshBasicMaterial({ color: '#5a3a2e', side: THREE.BackSide }); // the same dark outline the pets have
  const view = { x: 0, z: 0, zoom: 0 }, aim = { x: 0, z: 0, zoom: 0, t: 0 };
  const look = (p, zoom, secs) => { aim.x = p.x; aim.z = p.z; aim.zoom = zoom; aim.t = secs; };
  // One shape that lives for `life` seconds. upd(mesh, u, t) moves it; u runs 0 to 1.
  function P(geo, c, life, upd, delay = 0) {
    const m = new THREE.Mesh(geo, mat(c)); m.visible = false; ring.add(m);
    if (!m.material.userData.own && geo !== G.ring && geo !== G.disc && geo !== G.leaf) { const line = new THREE.Mesh(geo, ink); line.scale.setScalar(1.16); m.add(line); }
    parts.push({ m, t: -delay, life, upd }); return m;
  }
  const at = (delay, fn) => later.push({ t: delay, fn });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const dir = s => V(HOME[1 - s].x - HOME[s].x, 0, HOME[1 - s].z - HOME[s].z).normalize();
  const perp = s => { const d = dir(s); return V(-d.z, 0, d.x); };
  const spot = (s, y = .5, f = 0) => V(HOME[s].x + (HOME[1 - s].x - HOME[s].x) * f, y, HOME[s].z + (HOME[1 - s].z - HOME[s].z) * f);
  const anim = (s, dur, fn) => { anims[s] = { t: 0, dur, fn }; };
  const rattle = n => { shake = Math.min(1, Math.max(shake, n)); };

  // ----- building blocks -----
  // bits thrown outwards that fall and shrink
  function burst(p, n, c, geo = G.rock, { size = .15, sp = 2.4, life = .65, delay = 0, grav = 5, up = 1.8, flatY = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), v = V(Math.cos(a) * rnd(.4, 1) * sp, rnd(.3, 1) * up * flatY, Math.sin(a) * rnd(.4, 1) * sp), k = size * rnd(.6, 1.3), sx = rnd(-8, 8), col = Array.isArray(c) ? c[i % c.length] : c;
      P(geo, col, life * rnd(.7, 1.1), (m, u, t) => { m.position.set(p.x + v.x * t, Math.max(.03, p.y + v.y * t - grav * t * t / 2), p.z + v.z * t); m.scale.setScalar(k * (1 - u * u)); m.rotation.set(t * sx, t * 5, 0); }, delay);
    }
  }
  // soft balls that swell and fade away
  function puff(p, n, c, { size = .28, life = .7, delay = 0, spread = .45, lift = .35 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), o = V(Math.cos(a) * rnd(spread), rnd(-.1, .2), Math.sin(a) * rnd(spread)), k = size * rnd(.7, 1.2);
      P(G.ball, c, life * rnd(.8, 1.15), (m, u) => { m.position.set(p.x + o.x * out(u), p.y + o.y + lift * u, p.z + o.z * out(u)); m.scale.setScalar(k * Math.sin(Math.PI * Math.sqrt(u))); }, delay + i * .02);
    }
  }
  // one thing flying from a to b, with an arc and a spin
  function shot(a, b, geo, c, { size = .12, life = .4, delay = 0, arc = 0, spin = 0, grow = 0, face = false, wob = 0 } = {}, done) {
    const ph = rnd(TAU), pp = V(-(b.z - a.z), 0, b.x - a.x).normalize();
    P(geo, c, life, (m, u, t) => {
      const w = Math.sin(u * TAU * 1.5 + ph) * wob;
      m.position.set(a.x + (b.x - a.x) * u + pp.x * w, a.y + (b.y - a.y) * u + arc * 4 * u * (1 - u), a.z + (b.z - a.z) * u + pp.z * w);
      m.scale.setScalar(size * (1 + grow * u) * Math.min(1, u * 8));
      if (face) { m.lookAt(b.x, b.y + arc * (1 - 2 * u) * 2, b.z); m.rotateX(Math.PI / 2); } else m.rotation.set(t * spin, t * spin * .7, ph);
    }, delay);
    if (done) at(delay + life, done);
  }
  // a ring spreading over the ground (or in the air)
  function wave(p, c, r = 1.2, life = .5, delay = 0, thick = 1) {
    const mt = glow(c, .9);
    P(G.ring, mt, life, (m, u) => { m.position.copy(p); m.rotation.x = Math.PI / 2; const k = r * out(u); m.scale.set(k, k, thick * (1 - u) + .1); mt.opacity = .9 * (1 - u); }, delay);
  }
  // things winding upwards around a spot
  function rise(p, n, c, geo, { size = .1, h = 1.3, life = .9, delay = 0, rad = .45, turns = 1, gap = .06, up = true } = {}) {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU + rnd(.5), r = rad * rnd(.75, 1.2), col = Array.isArray(c) ? c[i % c.length] : c;
      P(geo, col, life, (m, u, t) => { const a = a0 + u * TAU * turns; m.position.set(p.x + Math.cos(a) * r, p.y + (up ? u : 1 - u) * h, p.z + Math.sin(a) * r); m.scale.setScalar(size * Math.sin(Math.PI * Math.sqrt(u))); m.rotation.set(0, -a + t * 2, 0); }, delay + i * gap);
    }
  }
  // a jagged bolt from a to b that flickers and is gone
  function bolt(a, b, c = '#fff6b0', w = .12, life = .14, delay = 0, kinks = 5) {
    const pts = [a.clone()]; for (let i = 1; i < kinks; i++) pts.push(a.clone().lerp(b, i / kinks).add(V(rnd(-.22, .22), rnd(-.18, .18), rnd(-.22, .22)))); pts.push(b.clone());
    for (let i = 0; i < kinks; i++) {
      const p = pts[i], q = pts[i + 1], len = p.distanceTo(q), mid = p.clone().add(q).multiplyScalar(.5), mt = glow(c);
      P(G.box, mt, life, (m, u) => { m.position.copy(mid); m.lookAt(q); m.scale.set(w, w, len * 1.05); mt.opacity = u < .5 ? 1 : (Math.sin(u * 60) > 0 ? 1 : .35); }, delay);
    }
  }
  const stars = (s, n = 3, life = 1.1, delay = 0) => { // stars circling a pet's head
    const p = spot(s, 1.15);
    for (let i = 0; i < n; i++) P(G.star, '#ffe066', life, (m, u, t) => { const a = i / n * TAU + t * 5; m.position.set(p.x + Math.cos(a) * .42, p.y + Math.sin(t * 6 + i) * .04, p.z + Math.sin(a) * .42); m.scale.setScalar(.13 * Math.sin(Math.PI * Math.sqrt(u))); m.rotation.set(0, -a, t * 3); }, delay);
  };

  // ----- the 22 moves -----
  // Each one: (s, a, b, d, pp) with a = the user's chest, b = the target's chest, d = the way across, pp = sideways.
  // It sets the user's motion, launches its shapes, and returns the seconds until it lands.
  const MOVE = {
    leafflick(s, a, b, d, pp) { // a twirl that flings a fan of leaves
      anim(s, .55, (u, o) => { o.ry = TAU * out(u); o.y = pop(u) * .18; });
      for (let i = 0; i < 6; i++) shot(a.clone().addScaledVector(pp, (i - 2.5) * .12), b.clone().addScaledVector(pp, (i - 2.5) * .08), G.leaf, i % 2 ? '#2f8f45' : '#e4f77a', { size: .34, life: .34, delay: .14 + i * .04, arc: .25 + (i % 3) * .1, spin: 14 });
      at(.5, () => burst(b, 8, ['#2f8f45', '#e4f77a'], G.leaf, { size: .26, sp: 1.6, grav: 2 }));
      return .5;
    },
    rootgrab(s, a, b) { // a stomp, and roots twist up around the other pet
      anim(s, .8, (u, o) => { o.y = pop(seg(u, 0, .4)) * .35; o.sy = 1 - pop(seg(u, .4, .7)) * .22; });
      at(.32, () => { wave(spot(s, .05), '#8a5a3c', 1, .4); rattle(.3); });
      const g = spot(1 - s, 0);
      for (let i = 0; i < 6; i++) { const an = i / 6 * TAU, r = .5, h = rnd(1, 1.4), lean = rnd(.25, .5);
        P(G.cone, i % 2 ? '#8a5a3c' : '#6b8f3a', 1.5, (m, u) => { const k = out(seg(u, 0, .2)) * (1 - seg(u, .8, 1)); m.position.set(g.x + Math.cos(an) * r, h * k / 2, g.z + Math.sin(an) * r); m.scale.set(.32, h * k + .001, .32); m.rotation.set(Math.sin(an) * -lean * k, 0, Math.cos(an) * lean * k); }, .45 + i * .03); }
      at(.6, () => burst(b, 6, '#2f8f45', G.leaf, { size: .22, sp: 1.3, grav: 2 }));
      return .7;
    },
    sunnap(s, a) { // dozing under a little sun
      anim(s, 1.1, (u, o) => { o.rz = Math.sin(u * TAU) * .14; o.sy = 1 - pop(u) * .1; });
      const sun = V(a.x, 1.95, a.z), mt = glow('#ffe066');
      P(G.ball, mt, 1.1, (m, u) => { m.position.copy(sun); m.scale.setScalar(.3 * pop(u) ** .5); });
      for (let i = 0; i < 8; i++) P(G.cone, glow('#ffd23d'), 1.1, (m, u, t) => { const an = i / 8 * TAU + t; m.position.set(sun.x + Math.cos(an) * .5, sun.y + Math.sin(an) * .5, sun.z); m.rotation.set(0, 0, an - Math.PI / 2); m.scale.set(.12, .22 * pop(u), .12); });
      rise(V(a.x, 1.6, a.z), 7, '#fff2a8', G.star, { size: .08, h: 1.3, life: .8, delay: .25, rad: .5, up: false, turns: .5 });
      return 1;
    },
    sweetscent(s, a, b) { // a wiggle, and a sweet pink cloud drifts across
      anim(s, .9, (u, o) => { o.ry = Math.sin(u * TAU * 3) * .3 * (1 - u); o.y = Math.abs(Math.sin(u * TAU * 1.5)) * .08; });
      for (let i = 0; i < 7; i++) shot(a, b.clone().add(V(rnd(-.2, .2), rnd(-.1, .3), rnd(-.2, .2))), G.ball, i % 2 ? '#ffb7d5' : '#ffd9ea', { size: .12, grow: 1.2, life: .65, delay: .1 + i * .05, wob: .22 });
      for (let i = 0; i < 4; i++) shot(a, b, G.leaf, '#ff8fbd', { size: .15, life: .6, delay: .2 + i * .08, wob: .3, spin: 6, arc: .2 });
      at(.75, () => puff(b, 5, '#ffc6de', { size: .26, life: .8 }));
      return .8;
    },
    bloomburst(s, a, b) { // gathers itself, then a huge flower bursts open
      anim(s, 1.15, (u, o) => { const c = seg(u, 0, .5), l = seg(u, .5, 1); o.k = 1 + .16 * c * (1 - l); o.sy = 1 - .15 * pop(c); o.f = pop(l) * .4; o.y = pop(l) * .25; });
      rise(V(a.x, .1, a.z), 8, ['#2f8f45', '#ffd84a'], G.leaf, { size: .22, h: 1.1, life: .55, rad: .55, turns: 1.2, gap: .03 });
      at(.72, () => {
        for (let i = 0; i < 10; i++) { const an = i / 10 * TAU; P(G.leaf, i % 2 ? '#ff8fbd' : '#ffc1dc', .7, (m, u) => { const r = .2 + .75 * out(seg(u, 0, .35)); m.position.set(b.x + Math.cos(an) * r, b.y + .1 + pop(u) * .25, b.z + Math.sin(an) * r); m.rotation.set(0, -an + Math.PI / 2, .5); m.scale.setScalar(.6 * out(seg(u, 0, .25)) * (1 - seg(u, .7, 1))); }); }
        P(G.ball, '#ffd84a', .7, (m, u) => { m.position.set(b.x, b.y + .1 + pop(u) * .25, b.z); m.scale.setScalar(.34 * out(seg(u, 0, .25)) * (1 - seg(u, .7, 1))); });
        wave(V(b.x, .06, b.z), '#8fe07a', 1.7, .5); burst(b, 10, ['#2f8f45', '#ffd84a', '#ff8fbd'], G.leaf, { size: .24, sp: 2.6, grav: 3 }); rattle(.55);
      });
      return .78;
    },
    sparknip(s, a, b) { // a quick dart in and a hot little bite
      anim(s, .5, (u, o) => { o.f = pop(u) * .58; o.y = pop(u) * .12; o.rx = pop(u) * .25; });
      at(.24, () => { burst(b, 9, ['#ff8a3c', '#ffd84a', '#ff5a3c'], G.rock, { size: .11, sp: 2.6, life: .5 }); P(G.cone, glow('#ffb347'), .35, (m, u) => { m.position.set(b.x, b.y + .3 * u, b.z); m.scale.set(.5 * pop(u), 1 * pop(u), .5 * pop(u)); }); });
      return .26;
    },
    singe(s, a, b, d) { // leans back and breathes a tongue of flame
      anim(s, .9, (u, o) => { o.rx = -.3 * pop(seg(u, 0, .3)) + .22 * pop(seg(u, .25, 1)); o.f = -.05 * pop(seg(u, 0, .3)) + .08 * pop(seg(u, .3, 1)); });
      const from = a.clone().addScaledVector(d, .35);
      for (let i = 0; i < 12; i++) shot(from, b.clone().add(V(rnd(-.18, .18), rnd(-.15, .2), rnd(-.18, .18))), G.cone, ['#ff8a3c', '#ffd84a', '#ff5a3c'][i % 3], { size: .26, grow: 1.5, life: .3, delay: .25 + i * .03, face: true });
      at(.6, () => { puff(V(b.x, b.y + .3, b.z), 4, '#8c8580', { size: .28, life: .9, lift: .7 }); burst(b, 6, '#ff8a3c', G.rock, { size: .1, sp: 1.8 }); });
      return .55;
    },
    warmup(s, a) { // two bouncy hops inside a whirl of flame
      anim(s, 1, (u, o) => { o.y = Math.abs(Math.sin(u * TAU)) * .32; o.k = 1 + pop(u) * .08; o.ry = Math.sin(u * TAU * 2) * .15; });
      rise(V(a.x, .05, a.z), 12, ['#ff8a3c', '#ffd84a', '#ff5a3c'], G.cone, { size: .36, h: 1.6, life: .7, rad: .7, turns: 1.4, gap: .04 });
      wave(V(a.x, .06, a.z), '#ff8a3c', 1.3, .5, 0, 2); wave(V(a.x, .06, a.z), '#ffd84a', 1.3, .5, .45, 2);
      return .9;
    },
    blazedash(s, a, b, d) { // crouches, then streaks across trailing fire
      anim(s, 1.05, (u, o) => { const back = pop(seg(u, 0, .3)), go = out(seg(u, .3, .5)), home = seg(u, .7, 1); o.f = -.1 * back + .68 * go * (1 - out(home)); o.sy = 1 - .2 * back; o.rx = .3 * go * (1 - home); o.y = .1 * pop(seg(u, .3, .5)); });
      for (let i = 0; i < 10; i++) { const p = spot(s, .1, .08 + i * .085), k = rnd(.3, .46); P(G.cone, ['#ff8a3c', '#ffd84a', '#ff5a3c'][i % 3], .55, (m, u, t) => { m.position.set(p.x, p.y + k * (1 - u) * .7, p.z); m.scale.set(k * (1 - u), k * 1.6 * (1 - u) * (1 + Math.sin(t * 40) * .15), k * (1 - u)); }, .34 + i * .018); }
      at(.5, () => { burst(b, 14, ['#ff8a3c', '#ffd84a', '#ff5a3c'], G.rock, { size: .1, sp: 3.2 }); wave(V(b.x, .06, b.z), '#ff8a3c', 1.8, .45); puff(b, 5, '#ffb347', { size: .3, life: .5 }); rattle(.75); });
      return .52;
    },
    splash(s, a, b) { // flicks a string of water blobs
      anim(s, .6, (u, o) => { o.y = pop(u) * .2; o.rx = pop(u) * .3; });
      for (let i = 0; i < 6; i++) shot(a, b, G.ball, i % 2 ? '#4fb3ff' : '#9ad6ff', { size: .17 - i * .012, life: .36, delay: .12 + i * .04, arc: .55 });
      at(.5, () => { burst(b, 9, ['#4fb3ff', '#c9ebff'], G.drop, { size: .13, sp: 2, up: 2.8, grav: 7 }); wave(V(b.x, .06, b.z), '#9ad6ff', 1.2, .45, 0, 2); });
      return .5;
    },
    soak(s, a, b) { // calls a small rain cloud over the other pet
      anim(s, 1, (u, o) => { o.rx = -.22 * pop(u); o.y = Math.abs(Math.sin(u * TAU * 1.5)) * .1; });
      const c = V(b.x, 1.95, b.z);
      for (let i = 0; i < 4; i++) { const o = V((i - 1.5) * .26, i % 2 ? .1 : 0, rnd(-.1, .1)), k = i % 2 ? .42 : .34; P(G.ball, '#8fa6c4', 1.5, (m, u) => { m.position.set(c.x + o.x, c.y + o.y, c.z + o.z); m.scale.setScalar(k * out(seg(u, 0, .15)) * (1 - seg(u, .85, 1))); }, .1); }
      for (let i = 0; i < 14; i++) { const o = V(rnd(-.4, .4), 0, rnd(-.25, .25)); shot(c.clone().add(o), V(b.x + o.x, .05, b.z + o.z), G.drop, '#2f95ea', { size: .11, life: .28, delay: .35 + i * .05, face: false }); }
      at(.7, () => wave(V(b.x, .06, b.z), '#9ad6ff', .9, .5)); at(1, () => wave(V(b.x, .06, b.z), '#9ad6ff', .9, .5));
      return .75;
    },
    bubbleshield(s, a) { // a big wobbly bubble closes around it
      anim(s, 1.1, (u, o) => { o.k = 1 + pop(u) * .07; o.y = pop(u) * .1; });
      const mt = glow('#aee3ff', .38), rim = glow('#ffffff', .8);
      P(G.ball, mt, 1.3, (m, u, t) => { const k = .82 * out(seg(u, 0, .3)) * (1 + Math.sin(t * 9) * .03); m.position.set(a.x, .55, a.z); m.scale.set(k, k * (1 + Math.sin(t * 7) * .04), k); mt.opacity = .38 * (1 - seg(u, .8, 1)); });
      P(G.ball, rim, 1.3, (m, u) => { m.position.set(a.x - .28, .95, a.z + .25); m.scale.setScalar(.09 * out(seg(u, .1, .35))); rim.opacity = .8 * (1 - seg(u, .8, 1)); });
      for (let i = 0; i < 7; i++) { const o = V(rnd(-.6, .6), 0, rnd(-.6, .6)), k = rnd(.05, .1), bm = glow('#d6f1ff', .7); P(G.ball, bm, .9, (m, u) => { m.position.set(a.x + o.x, .1 + u * 1.4, a.z + o.z); m.scale.setScalar(k * pop(u) ** .4); }, .1 + i * .07); }
      return .9;
    },
    mend(s, a) { // floats up, turning, as green crosses spiral round it
      anim(s, 1.1, (u, o) => { o.y = pop(u) * .28; o.ry = TAU * u * u * (3 - 2 * u); });
      rise(V(a.x, .1, a.z), 6, ['#7ee08a', '#9ff0d0'], G.plus, { size: .15, h: 1.6, life: .9, rad: .7, turns: .8, gap: .07 });
      rise(V(a.x, .1, a.z), 6, '#e8fff0', G.star, { size: .08, h: 1.7, life: .8, rad: .35, turns: 1.3, gap: .08, delay: .15 });
      wave(V(a.x, .06, a.z), '#7ee08a', 1.1, .6);
      return 1;
    },
    tidalbump(s, a, b, d, pp) { // rides a rolling wave straight into the other pet
      anim(s, 1, (u, o) => { const g = seg(u, .1, .7); o.f = pop(g) * .68; o.y = pop(g) * .55; o.rx = -.25 * pop(g); });
      for (let i = -3; i <= 3; i++) { const from = spot(s, .15, .1).addScaledVector(pp, i * .22), to = spot(s, .15, 1).addScaledVector(pp, i * .22), k = .42 - Math.abs(i) * .05;
        shot(from, to, G.ball, i % 2 ? '#4fb3ff' : '#2f95ea', { size: k, grow: .5, life: .5, delay: .15 + Math.abs(i) * .015, arc: .22 });
        shot(from.clone().setY(.4), to.clone().setY(.5), G.ball, '#ffffff', { size: k * .45, life: .5, delay: .17 + Math.abs(i) * .015, arc: .3 }); }
      at(.65, () => { burst(b, 14, ['#4fb3ff', '#c9ebff', '#ffffff'], G.drop, { size: .1, sp: 2.6, up: 3.2, grav: 7 }); wave(V(b.x, .06, b.z), '#4fb3ff', 1.9, .5); wave(V(b.x, .06, b.z), '#ffffff', 1.3, .5, .1); rattle(.7); });
      return .66;
    },
    zap(s, a, b) { // a twitch, and a crackling bolt jumps across
      anim(s, .5, (u, o) => { o.sy = 1 + pop(seg(u, 0, .4)) * .16; o.ry = Math.sin(u * 40) * .08 * (1 - u); });
      puff(a, 3, glow('#fff6b0', .7), { size: .12, life: .25, spread: .3 });
      bolt(a, b, '#fff6b0', .13, .13, .16); bolt(a, b, '#ffd84a', .1, .13, .27); bolt(a, b, '#ffffff', .08, .1, .36);
      at(.2, () => burst(b, 9, ['#ffd84a', '#fff6b0'], G.star, { size: .11, sp: 2.2, grav: 3 }));
      return .22;
    },
    dazeflash(s, a, b) { // rears up and lets off a blinding flash
      anim(s, .8, (u, o) => { o.rx = -.32 * pop(seg(u, 0, .6)); o.y = pop(seg(u, 0, .6)) * .15; });
      const h = V(a.x, .9, a.z), mt = glow('#ffffff', 1);
      P(G.ball, mt, .45, (m, u) => { m.position.copy(h); m.scale.setScalar(.2 + 1.7 * out(u)); mt.opacity = 1 - u; }, .22);
      for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, rm = glow('#fff6b0'); P(G.box, rm, .4, (m, u) => { const r = .3 + 1.2 * out(u); m.position.set(h.x + Math.cos(an) * r, h.y + Math.sin(an) * r, h.z); m.rotation.z = an; m.scale.set(.5 * (1 - u), .05, .05); rm.opacity = 1 - u; }, .22); }
      at(.45, () => stars(1 - s, 4, 1.2));
      return .48;
    },
    quickstep(s, a, b, d, pp) { // zips from side to side, leaving streaks
      anim(s, .9, (u, o) => { o.side = Math.sin(u * TAU * 2) * .55 * (1 - u * .3); o.sy = 1 - Math.abs(Math.cos(u * TAU * 2)) * .1; o.rz = -Math.cos(u * TAU * 2) * .25; });
      for (let i = 0; i < 4; i++) at(i * .2 + .06, () => { const sd = i % 2 ? -1 : 1; puff(spot(s, .08).addScaledVector(pp, sd * .5), 2, '#e8dcc8', { size: .13, life: .35, spread: .15 });
        for (let j = 0; j < 3; j++) { const p = spot(s, .3 + j * .22).addScaledVector(pp, sd * .1), mt = glow('#ffe066', .9); P(G.box, mt, .22, (m, u) => { m.position.copy(p).addScaledVector(pp, -sd * u * .5); m.lookAt(p.clone().add(pp)); m.scale.set(.03, .03, .8 * (1 - u)); mt.opacity = .9 * (1 - u); }); } });
      rise(V(a.x, .1, a.z), 5, '#ffe066', G.arrow, { size: .13, h: 1.2, life: .6, rad: .6, turns: .2, delay: .45, gap: .05 });
      return .9;
    },
    thunderpounce(s, a, b) { // leaps high and comes down with a thunderbolt
      anim(s, 1.25, (u, o) => { const up = out(seg(u, 0, .32)), fall = seg(u, .45, .56) ** 2, home = seg(u, .75, 1); o.f = .7 * up * (1 - out(home)); o.y = 1.2 * up * (1 - fall); o.rx = -.35 * up * (1 - fall) + .5 * fall * (1 - seg(u, .56, .7)); o.sy = 1 - .25 * pop(seg(u, .56, .72)); });
      at(.7, () => { const top = V(b.x + .3, 4.6, b.z); bolt(top, V(b.x, .1, b.z), '#fff6b0', .2, .16, 0, 7); bolt(top, V(b.x, .1, b.z), '#ffffff', .12, .14, .1, 7);
        const fm = glow('#fff6b0', .8); P(G.ball, fm, .3, (m, u) => { m.position.copy(b); m.scale.setScalar(.3 + 1.2 * out(u)); fm.opacity = .8 * (1 - u); });
        wave(V(b.x, .06, b.z), '#ffd84a', 2, .5, 0, 2); wave(V(b.x, .06, b.z), '#ffffff', 1.4, .5, .08); burst(b, 14, ['#ffd84a', '#fff6b0'], G.star, { size: .13, sp: 3, grav: 4 }); rattle(1); });
      return .72;
    },
    pebbletoss(s, a, b) { // winds up and lobs three pebbles
      anim(s, .8, (u, o) => { o.ry = -.5 * pop(seg(u, 0, .3)) + .45 * pop(seg(u, .2, .8)); o.y = pop(seg(u, .15, .6)) * .15; });
      [.16, .28, .4].forEach((dl, i) => { const to = b.clone().add(V(rnd(-.15, .15), rnd(-.1, .2), rnd(-.15, .15)));
        shot(V(a.x, a.y + .3, a.z), to, G.rock, i % 2 ? '#8f8478' : '#a89a8c', { size: .19 + i * .02, life: .34, delay: dl, arc: .7 + i * .12, spin: 12 }, () => { burst(to, 5, '#b8ac9e', G.rock, { size: .08, sp: 1.8, life: .45 }); rattle(.2); }); });
      at(.6, () => puff(V(b.x, .15, b.z), 3, '#d9cbb8', { size: .16, life: .5 }));
      return .52;
    },
    dustcloud(s, a, b, d) { // turns its back and kicks up a storm of dust
      anim(s, 1, (u, o) => { o.ry = Math.PI * out(seg(u, 0, .2)) * (1 - out(seg(u, .8, 1))); o.y = Math.abs(Math.sin(seg(u, .2, .8) * TAU * 1.5)) * .16; o.rx = -.2 * pop(seg(u, .2, .8)); });
      const from = spot(s, .15, .12);
      for (let i = 0; i < 10; i++) shot(from, b.clone().add(V(rnd(-.35, .35), rnd(-.3, .3), rnd(-.35, .35))), G.ball, i % 2 ? '#d9c7a8' : '#c4ae8a', { size: .14, grow: 2.8, life: .7, delay: .22 + i * .045, arc: .15, wob: .1 });
      at(.3, () => burst(from, 5, '#b8a888', G.rock, { size: .05, sp: 1.4, life: .4 }));
      at(.85, () => puff(b, 6, '#d9c7a8', { size: .32, life: .9, spread: .5 }));
      return .85;
    },
    harden(s, a) { // braces as stones close in and lock around it
      anim(s, 1, (u, o) => { o.sy = 1 - .16 * pop(seg(u, 0, .5)); o.k = 1 + .12 * pop(seg(u, .5, 1)); o.side = Math.sin(u * 70) * .02 * pop(seg(u, .3, .7)); });
      for (let i = 0; i < 7; i++) { const an = i / 7 * TAU, y = .25 + (i % 3) * .28, k = rnd(.2, .3); P(G.rock, i % 2 ? '#7d7268' : '#a89a8c', .75, (m, u, t) => { const r = 1.5 - .9 * out(seg(u, 0, .7)), q = an + u * 2.2; m.position.set(a.x + Math.cos(q) * r, y, a.z + Math.sin(q) * r); m.scale.setScalar(k * out(seg(u, 0, .2)) * (1 - seg(u, .85, 1))); m.rotation.set(t * 3, t * 2, 0); }); }
      at(.62, () => { const mt = glow('#ffffff', .7); P(G.rock, mt, .35, (m, u) => { m.position.set(a.x, .55, a.z); m.scale.setScalar(.6 + .5 * out(u)); mt.opacity = .7 * (1 - u); }); wave(V(a.x, .06, a.z), '#cfc5ba', 1.2, .45, 0, 2); burst(V(a.x, 1.1, a.z), 4, '#ffffff', G.star, { size: .07, sp: 1.2, grav: 1.5 }); });
      return .9;
    },
    boulderroll(s, a, b, d, pp) { // heaves a great boulder that rumbles across
      anim(s, 1.1, (u, o) => { o.f = -.1 * pop(seg(u, 0, .25)) + .22 * pop(seg(u, .2, .9)); o.rx = .32 * pop(seg(u, .2, .8)); o.sy = 1 - .12 * pop(seg(u, 0, .25)); });
      const from = spot(s, 0, .42), to = spot(s, 0, 1), life = .55, axis = pp.clone();
      P(G.rock, '#9a8d80', life, (m, u, t) => { const k = .45 + .22 * u; m.position.set(from.x + (to.x - from.x) * u * u, k * .9 + Math.abs(Math.sin(u * 9)) * .06, from.z + (to.z - from.z) * u * u); m.scale.setScalar(k); m.setRotationFromAxisAngle(axis, u * u * 11); }, .25);
      for (let i = 0; i < 6; i++) at(.3 + i * .08, () => { const f = ((.05 + i * .08) / life) ** 2; puff(V(from.x + (to.x - from.x) * f, .1, from.z + (to.z - from.z) * f), 2, '#d9c7a8', { size: .15, life: .45, spread: .2 }); rattle(.18); });
      at(.8, () => { burst(b, 13, ['#9a8d80', '#b8ac9e', '#7d7268'], G.rock, { size: .12, sp: 2.8, up: 2.4 }); puff(V(b.x, .2, b.z), 6, '#d9c7a8', { size: .32, life: .7, spread: .55 }); wave(V(b.x, .06, b.z), '#cfc5ba', 1.8, .45); rattle(.9); });
      return .8;
    },
  };

  // ----- lasting troubles: a small reminder every so often -----
  const TROUBLE = {
    rooted: s => { const g = spot(s, 0), an = rnd(TAU); P(G.leaf, '#6b8f3a', .9, (m, u, t) => { const q = an + u * 3; m.position.set(g.x + Math.cos(q) * .4, .05 + u * .45, g.z + Math.sin(q) * .4); m.scale.setScalar(.12 * pop(u)); m.rotation.set(t * 2, -q, .6); }); },
    singed: s => { const p = spot(s, rnd(.4, .8)).add(V(rnd(-.25, .25), 0, rnd(-.25, .25))); P(G.cone, rnd() < .5 ? '#ff8a3c' : '#ffd84a', .6, (m, u) => { m.position.set(p.x, p.y + u * .5, p.z); m.scale.set(.1 * (1 - u), .22 * pop(u), .1 * (1 - u)); }); puff(V(p.x, p.y + .5, p.z), 1, '#9c948e', { size: .09, life: .7, lift: .6, delay: .3 }); },
    soaked: s => { const p = spot(s, 1.05).add(V(rnd(-.3, .3), 0, rnd(-.3, .3))); P(G.drop, '#4fb3ff', .55, (m, u) => { m.position.set(p.x, p.y - u * u * .9, p.z); m.scale.setScalar(.06 * Math.min(1, u * 6) * (1 - seg(u, .85, 1))); }); },
    dazed: s => stars(s, 2, .9),
    tired: s => { const sd = rnd() < .5 ? -1 : 1, p = spot(s, 1).add(V(sd * .32, 0, .1)); P(G.drop, '#bfe6ff', .6, (m, u) => { m.position.set(p.x + sd * u * .25, p.y + Math.sin(u * Math.PI) * .2 - u * .2, p.z); m.scale.setScalar(.07 * pop(u) ** .5); }); },
  };

  return {
    get shake() { return shake; }, view,
    get hold() { return hold; }, set hold(v) { hold = v; },
    move(s, id, el) { // a glowing circle in the move's colour gathers under the pet, then the move itself plays
      const a = spot(s), b = spot(1 - s), g = spot(s, .05), c = EL_COL[el] || '#ffffff', dm = glow(c, .5);
      P(G.disc, dm, .55, (m, u) => { m.position.copy(g); m.rotation.x = -Math.PI / 2; m.scale.setScalar(.95 * out(seg(u, 0, .4))); dm.opacity = .5 * (1 - seg(u, .5, 1)); });
      wave(g, c, 1, .45, 0, 2);
      const t = MOVE[id] ? MOVE[id](s, a, b, dir(s), perp(s)) : .5;
      look(a, .04, t * .6); at(t * .6, () => look(spot(s, 0, .6), .07, .8));
      return t;
    },
    hit(s, el, eff = 1) { // the pet on side s is struck
      const p = spot(s, .6), c = EL_COL[el] || '#ffffff', big = eff > 1, d = dir(s);
      anim(s, .45, (u, o) => { o.f = -.16 * pop(u) * (big ? 1.5 : 1); o.rx = -.3 * pop(u); o.sy = 1 - .12 * pop(seg(u, 0, .5)); });
      const sm = glow('#ffffff');
      P(G.star, sm, .28, (m, u, t) => { m.position.copy(p).addScaledVector(d, .3); m.position.y += .2; m.scale.setScalar((big ? .7 : .45) * out(u)); m.rotation.set(0, Math.atan2(d.x, d.z), t * 4); sm.opacity = 1 - u * u; });
      burst(p, big ? 10 : eff < 1 ? 3 : 6, [c, '#ffffff'], G.rock, { size: big ? .13 : .09, sp: big ? 3 : 2.2 });
      if (big) wave(p, c, 1.3, .4);
      rattle(big ? .6 : eff < 1 ? .1 : .3); hold = big ? .13 : eff < 1 ? 0 : .07; look(spot(s, 0, -.3), big ? .08 : .05, .6);
    },
    burn(s) { const p = spot(s, .5); anim(s, .4, (u, o) => { o.side = Math.sin(u * 50) * .05 * (1 - u); o.sy = 1 - .1 * pop(u); }); for (let i = 0; i < 4; i++) TROUBLE.singed(s); burst(p, 5, ['#ff8a3c', '#ffd84a'], G.rock, { size: .05, sp: 1.4 }); },
    heal(s) { const g = spot(s, .1); anim(s, .7, (u, o) => { o.y = pop(u) * .18; o.k = 1 + pop(u) * .06; }); rise(g, 5, ['#7ee08a', '#9ff0d0'], G.plus, { size: .14, h: 1.4, life: .8, rad: .6, turns: .6, gap: .06 }); wave(V(g.x, .06, g.z), '#7ee08a', 1, .5); },
    stat(s, d) { // arrows climbing (better) or sinking (worse); a shrug of dust when nothing changes
      const g = spot(s, 0);
      if (!d) return puff(V(g.x, .9, g.z), 2, '#e8dcc8', { size: .12, life: .5 });
      for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + rnd(.4), r = .5; P(G.arrow, d > 0 ? '#5fd07a' : '#e2604e', .85, (m, u) => { m.position.set(g.x + Math.cos(an) * r, d > 0 ? .2 + u * 1.2 : 1.5 - u * 1.2, g.z + Math.sin(an) * r); m.rotation.set(0, -an + Math.PI / 2, d > 0 ? 0 : Math.PI); m.scale.setScalar(.17 * pop(u) ** .5); }, i * .06); }
      if (d < 0) anim(s, .6, (u, o) => { o.sy = 1 - .14 * pop(u); o.rx = .15 * pop(u); });
      wave(V(g.x, .06, g.z), d > 0 ? '#5fd07a' : '#e2604e', 1, .5);
    },
    status(s, st) { for (let i = 0; i < 4; i++) at(i * .12, () => TROUBLE[st]?.(s)); if (st === 'dazed') stars(s, 3, 1); },
    dazed(s) { stars(s, 4, .9); anim(s, .9, (u, o) => { o.rz = Math.sin(u * TAU * 2) * .22 * (1 - u); o.side = Math.sin(u * TAU * 2) * .1; }); },
    faint(s) { const p = spot(s, .3); look(spot(s, 0, -.2), .09, 1.2); rattle(.35); at(.45, () => { puff(p, 7, '#ffffff', { size: .3, life: .8, spread: .5 }); for (let i = 0; i < 3; i++) P(G.star, '#ffe066', 1, (m, u, t) => { m.position.set(p.x + Math.sin(t * 3 + i * 2) * .3, .4 + u * 1.2, p.z + Math.cos(t * 3 + i * 2) * .3); m.scale.setScalar(.1 * pop(u)); m.rotation.z = t * 3; }, i * .12); }); },
    enter(s, delay = 0) { const g = spot(s, .06); anims[s] = null; at(delay, () => { puff(V(g.x, .2, g.z), 7, '#f3ead8', { size: .26, life: .5, spread: .6 }); wave(g, '#ffffff', 1.2, .45, 0, 2); rattle(.15); }); },
    win(s) { // confetti and stars over the winner
      const p = spot(s, 1.6); look(spot(s, 0, .3), .12, 4);
      for (let i = 0; i < 3; i++) at(i * .35, () => { burst(p, 14, ['#ff8fbd', '#ffd84a', '#7ee08a', '#4fb3ff', '#c7b6ff'], G.box, { size: .1, sp: 2.6, up: 3, grav: 4, life: 1.3 }); burst(p, 4, '#ffe066', G.star, { size: .14, sp: 2, up: 2.6, grav: 3, life: 1.2 }); });
      rattle(.5);
    },
    state(s, list) { states[s] = list || []; },
    pose(s, o) { o.f = 0; o.side = 0; o.y = 0; o.ry = 0; o.rx = 0; o.rz = 0; o.sy = 1; o.k = 1; const A = anims[s]; if (A) A.fn(Math.min(1, A.t / A.dur), o); return o; },
    update(dt) {
      shake = Math.max(0, shake - dt * 2.6);
      if (aim.t > 0) aim.t -= dt; const on = aim.t > 0 ? 1 : 0, kq = Math.min(1, dt * 4.5); view.x += (aim.x * on - view.x) * kq; view.z += (aim.z * on - view.z) * kq; view.zoom += (aim.zoom * on - view.zoom) * kq;
      for (const s of [0, 1]) { const A = anims[s]; if (A && (A.t += dt) >= A.dur) anims[s] = null; }
      for (let i = later.length - 1; i >= 0; i--) if ((later[i].t -= dt) <= 0) later.splice(i, 1)[0].fn();
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt; if (p.t < 0) continue;
        if (p.t >= p.life) { ring.remove(p.m); if (p.m.material.userData.own) p.m.material.dispose(); parts.splice(i, 1); } else { p.m.visible = true; p.upd(p.m, p.t / p.life, p.t); }
      }
      if ((drip -= dt) <= 0) { drip = .42; for (const s of [0, 1]) for (const st of states[s]) TROUBLE[st]?.(s); }
    },
    clear() { for (const p of parts) { ring.remove(p.m); if (p.m.material.userData.own) p.m.material.dispose(); } parts.length = later.length = 0; anims[0] = anims[1] = null; states[0] = []; states[1] = []; shake = hold = 0; aim.t = 0; view.x = view.z = view.zoom = 0; },
  };
}

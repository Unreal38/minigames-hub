// Lucky Wheel: the daily spin, opened in a pop-up from the hub's Today column. The server picks the slice
// (server/wheel.js); this file draws the 3D wheel, plays the spin it is told about and shows the prize.
// The wheel has 20 equal slices in the order of ORDER, so what you see is the real odds.
import * as THREE from 'three';
import { frameLoop } from './frames.js';
import { L, cnt } from './i18n.js';
import { sfx } from './sfx.js';
import { srvText } from './lang/server.js';
import { ORDER, PRIZES, LUCKY, PITY, SET_COINS } from './wheelprizes.js';
import { boostName, boostWhat } from './wheeltext.js';
import { SPECIES, MATS, ITEMS, RARITY, elName } from './games/farm/data.js';
import { petPic } from './petpic.js';
import { islePic } from './islepic.js';
import { matIcon } from './games/farm/icons.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = ORDER.length, STEP = Math.PI * 2 / N;
const HEX = { gold: '#ffd84a', chili: '#e5543b', mint: '#7ed3b2', pink: '#ff8fab', sky: '#6fb8e6', violet: '#a58be0', cream: '#fff4e2', wood: '#a9713f', wood2: '#8a5a30', plum: '#7a2e3f' };
// two shades per prize kind, so neighbouring slices never blend
const SLICE = { c20: ['#ffc266', '#f5a93a'], c40: ['#ffe066', '#f2c93a'], c100: ['#f0705a', '#d9503a'], mat: ['#8fdcbf', '#6cc7a4'], fine: ['#86c6ee', '#5fa9dc'], cry: ['#b7a0ea', '#9a80d8'], treat: ['#ffa5bb', '#f3849f'], boost: ['#86c6ee', '#5fa9dc'], pet: ['#8fdcbf', '#6cc7a4'], decor: ['#fff0a0', '#ffd84a'] };
const NUM = { c20: '20', c40: '40', c100: '100', mat: '40', fine: '12', cry: '2' };

// ---------- words ----------
const lot = got => Object.entries(got).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ');
const lots = k => PRIZES[k].pick.map(lot).join(L(' or ', ' albo '));
const KIND = {
  c20: () => [cnt(20, 'coin', 'coins', 'moneta', 'monety', 'monet'), ''],
  c40: () => [cnt(40, 'coin', 'coins', 'moneta', 'monety', 'monet'), ''],
  c100: () => [cnt(100, 'coin', 'coins', 'moneta', 'monety', 'monet'), ''],
  mat: () => [lots('mat'), L('One of the three, for Pet Farm.', 'Jedno z trzech, na Farmę zwierzaków.')],
  fine: () => [lots('fine'), L('One of the two, for Pet Farm.', 'Jedno z dwóch, na Farmę zwierzaków.')],
  cry: () => [lots('cry'), L('The rare one, for Pet Farm.', 'Rzadki materiał na Farmę zwierzaków.')],
  treat: () => [lots('treat'), L('Treats that level up your pets.', 'Smakołyki, po których zwierzaki rosną.')],
  boost: () => [L('Building booster', 'Wzmocnienie budynku'), L('For one Pet Farm building. You start it when you like.', 'Do jednego budynku na farmie. Włączasz je, kiedy chcesz.')],
  pet: () => [L('Pet of the day', 'Zwierzak dnia'), L('A baby of today’s species.', 'Maluch dzisiejszego gatunku.')],
  decor: () => [L('Lucky decoration', 'Szczęśliwa ozdoba'), L(`One of ${LUCKY.length} island decorations only the wheel gives.`, `Jedna z ${LUCKY.length} ozdób wyspy, które daje tylko koło.`)],
};
const where = w => w === 'hold' ? L('It waits for you in Pet Farm.', 'Czeka na ciebie na Farmie zwierzaków.') : L('It is in your Pet Farm Mailbox.', 'Jest w Skrzynce pocztowej na Farmie zwierzaków.');
function wonText(z) {
  if (z.item) return [`${ITEMS[z.item]?.name || ''}!`, L('A lucky decoration for your island. ', 'Szczęśliwa ozdoba na twoją wyspę. ') + where(z.where)];
  if (z.full) return [cnt(z.coins, 'coin', 'coins', 'moneta', 'monety', 'monet'), L('You own the whole lucky set, so the slice pays coins.', 'Masz już cały szczęśliwy zestaw, więc to pole płaci monetami.')];
  if (z.coins) return [cnt(z.coins, 'coin', 'coins', 'moneta', 'monety', 'monet'), L('Added to your coins.', 'Dodane do twoich monet.')];
  if (z.pet) return [`${SPECIES[z.pet.sp]?.name || ''}${z.pet.el ? ` (${elName(z.pet.el)})` : ''}!`, L('A baby of the pet of the day. ', 'Maluch zwierzaka dnia. ') + where(z.where)];
  if (z.boost) return [boostName(z.boost), boostWhat(z.boost) + ' ' + where(z.where)];
  return [lot(z.got || {}), where(z.where)];
}

// The picture for the prize pop-up: the pet itself, the decoration, or a big icon.
const BOLT = '<svg viewBox="0 0 24 24" width="88" height="88" aria-hidden="true"><path d="M13.5 2 5 13.5h5.5L9 22l9.5-12H13z" fill="#ffd84a" stroke="#3b2219" stroke-width="1.6" stroke-linejoin="round"/></svg>';
function wonPic(z) {
  if (z.item) { const u = islePic('ip', z.item); return u ? `<img src="${u}" alt="" width="132" height="132">` : ''; }
  if (z.pet) return '<img class="lwwinpet" alt="" width="132" height="132" hidden>';
  if (z.boost) return BOLT;
  return matIcon(z.coins ? 'coins' : Object.keys(z.got || {})[0], 88);
}

// ---------- the 3D model ----------
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const bx = (w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat(c), x, y, z);
const cyl = (r1, r2, h, n, c, x, y, z) => mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat(c), x, y, z);
const grp = (...k) => { const g = new THREE.Group(); g.add(...k); return g; };
const flat = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; };
// Prize figures, built upright and about 0.7 tall. Coins face the viewer.
function coins(n) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const z = .1 + i * .1, x = (i - (n - 1) / 2) * .13, y = i % 2 ? .06 : -.06, c = cyl(.3, .3, .1, 8, '#f2b01e', x, y, z), f = cyl(.2, .2, .03, 8, '#ffe37a', x, y, z + .055); c.rotation.x = f.rotation.x = Math.PI / 2; c.rotation.y = f.rotation.y = Math.PI / 8; g.add(c, f); } return g; }
function figure(k) {
  if (k === 'c20') return coins(2);
  if (k === 'c40') return coins(4);
  if (k === 'c100') { const g = grp(coins(4), coins(4)); g.children[0].position.y = .2; g.children[1].position.set(0, -.2, .12); g.scale.setScalar(.9); return g; }
  if (k === 'mat') { const log = (x, y, r) => { const m = cyl(.15, .15, .7, 6, HEX.wood, x, y, .1), e = cyl(.1, .1, .72, 6, '#e2b98a', x, y, .1); m.rotation.z = e.rotation.z = Math.PI / 2 + r; return grp(m, e); }; return grp(log(0, -.15, 0), log(.02, .12, .12), bx(.34, .3, .3, '#9d9189', -.3, -.2, .32), bx(.2, .2, .2, '#b5aba3', -.08, -.26, .4)); }
  if (k === 'fine') { const s = mesh(new THREE.ConeGeometry(.3, .5, 5), mat('#ffe3ec'), -.12, 0, .2), s2 = mesh(new THREE.ConeGeometry(.2, .52, 5), mat('#ffb9cd'), -.1, .01, .22); s.rotation.z = s2.rotation.z = -.5; return grp(s, s2, mesh(new THREE.DodecahedronGeometry(.2), mat('#3a3340'), .28, -.18, .25)); }
  if (k === 'cry') { const o = (r, h, x, y, t) => { const m = mesh(new THREE.OctahedronGeometry(r), mat('#d9c8ff', { emissive: '#5a3fb0', emissiveIntensity: .45 }), x, y, .25); m.scale.y = h; m.rotation.z = t; return m; }; return grp(o(.2, 2, 0, .02, 0), o(.14, 1.8, -.24, -.12, .35), o(.13, 1.7, .24, -.14, -.35)); }
  if (k === 'treat') return grp(cyl(.32, .34, .22, 8, '#f6d7a3', 0, -.18, .2), cyl(.33, .33, .08, 8, HEX.pink, 0, -.03, .2), cyl(.26, .28, .18, 8, '#f6d7a3', 0, .1, .2), cyl(.27, .27, .07, 8, HEX.cream, 0, .22, .2), bx(.11, .11, .11, HEX.chili, 0, .31, .2));
  if (k === 'boost') { const bolt = mesh(new THREE.ExtrudeGeometry(flat([[.08, .42], [-.24, -.04], [-.02, -.04], [-.12, -.42], [.24, .08], [.02, .08]]), { depth: .14, bevelEnabled: false }), mat('#ffe066', { emissive: '#ffa500', emissiveIntensity: .35 }), 0, 0, .12), tile = grp(bx(.5, .5, .06, HEX.cream, 0, 0, .06)); tile.rotation.z = Math.PI / 4; return grp(tile, bolt); }
  if (k === 'pet') { const e = mesh(new THREE.IcosahedronGeometry(.3, 1), mat(HEX.cream), 0, 0, .28); e.scale.set(1, 1.28, .9); const d = (x, y, c) => bx(.12, .12, .1, c, x, y, .5); return grp(e, d(-.1, .12, HEX.mint), d(.12, -.02, HEX.pink), d(-.06, -.18, HEX.sky), bx(.5, .1, .4, '#c89a5a', 0, -.36, .26)); }
  const star = mesh(new THREE.ExtrudeGeometry(flat(Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? .19 : .44, a = Math.PI / 2 + i * Math.PI / 5; return [Math.cos(a) * r, Math.sin(a) * r]; })), { depth: .16, bevelEnabled: false }), mat('#ffe066', { emissive: '#ffb000', emissiveIntensity: .5 }), 0, 0, .14);
  star.userData.twirl = true; return grp(star);
}
function numberTile(txt) {
  const c = document.createElement('canvas'); c.width = 192; c.height = 96; const g = c.getContext('2d');
  g.font = '800 64px Rubik, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 12; g.strokeStyle = '#fff4e2'; g.strokeText(txt, 96, 52); g.fillStyle = '#3b2219'; g.fillText(txt, 96, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(.9, .45), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}

function buildScene(canvas, night) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(34, 1, .1, 100);
  cam.position.set(0, .2, 18.6); cam.lookAt(0, -.2, 0);
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9a79a', 2), sun = new THREE.DirectionalLight('#fff1d6', 1.6);
  sun.position.set(-4, 7, 9); scene.add(hemi, sun);

  const R = 3.3, R0 = .85, wheel = new THREE.Group(), twirl = [], tiles = [];
  const wedges = ORDER.map((k, i) => {
    const h = STEP / 2, tall = i % 2 ? .42 : .5;
    const g = grp(new THREE.Mesh(new THREE.ExtrudeGeometry(flat([[Math.cos(-h) * R0, Math.sin(-h) * R0], [Math.cos(-h) * R, Math.sin(-h) * R], [Math.cos(h) * R, Math.sin(h) * R], [Math.cos(h) * R0, Math.sin(h) * R0]]), { depth: tall, bevelEnabled: false }), mat(SLICE[k][i % 2])));
    // The figure is fitted to its slice: never wider than the slice is at that distance, never sunk into the face,
    // and with a gap to the rim and to the number, so nothing pokes into a neighbour.
    const raw = figure(k), bb = new THREE.Box3().setFromObject(raw), sz = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
    const AT = 2.5, s = Math.min(.7 / sz.x, 1.06 / sz.y, .55 / sz.z); // the slice is .75 wide at the figure's inner edge
    raw.position.set(-mid.x, -mid.y, -bb.min.z); const f = grp(raw); f.scale.setScalar(s); f.rotation.z = -Math.PI / 2; f.position.set(AT, 0, tall + .03); g.add(f);
    f.traverse(o => o.userData.twirl && twirl.push(o));
    if (NUM[k]) { const l = numberTile(NUM[k]); l.rotation.z = -Math.PI / 2; l.position.set(1.5, 0, tall + .02); l.scale.setScalar(NUM[k].length > 2 ? .62 : NUM[k].length > 1 ? .8 : .9); g.add(l); tiles.push([l, NUM[k]]); }
    const peg = cyl(.07, .07, .3, 6, HEX.cream, Math.cos(h) * (R - .12), Math.sin(h) * (R - .12), .62); peg.rotation.x = Math.PI / 2; g.add(peg);
    g.rotation.z = Math.PI / 2 + i * STEP; return g; // slice 0 is at the top, the rest follow clockwise once the wheel turns the other way
  });
  wheel.add(...wedges);
  const hub = cyl(R0 + .12, R0 + .12, .75, 8, HEX.plum, 0, 0, .35), cap = cyl(.5, .62, .2, 8, HEX.gold, 0, 0, .8); hub.rotation.x = cap.rotation.x = Math.PI / 2;
  const gem = mesh(new THREE.OctahedronGeometry(.3), mat(HEX.chili, { emissive: '#7a1a10', emissiveIntensity: .5 }), 0, 0, 1); gem.scale.z = .6;
  wheel.add(hub, cap, gem);

  const rig = new THREE.Group(), back = cyl(R + .48, R + .48, .3, 20, HEX.plum, 0, 0, -.2), trim = cyl(R + .28, R + .28, .34, 20, HEX.gold, 0, 0, -.19); back.rotation.x = trim.rotation.x = Math.PI / 2;
  const bulbs = Array.from({ length: 20 }, (_, i) => { const a = i * STEP + STEP / 2; return mesh(new THREE.IcosahedronGeometry(.11, 0), mat(HEX.cream, { emissive: '#ffc94d' }), Math.cos(a) * (R + .39), Math.sin(a) * (R + .39), .02); });
  const legL = bx(.42, 5.4, .42, HEX.wood, -1.7, -3.1, -.6), legR = bx(.42, 5.4, .42, HEX.wood, 1.7, -3.1, -.6); legL.rotation.z = -.3; legR.rotation.z = .3;
  const axle = cyl(.22, .22, 1.2, 6, HEX.wood2, 0, 0, -.6); axle.rotation.x = Math.PI / 2;
  const tip = mesh(new THREE.ConeGeometry(.24, .7, 4), mat(HEX.chili), 0, -.35, 0); tip.rotation.z = Math.PI;
  const flap = grp(tip, bx(.34, .2, .3, HEX.gold, 0, .02, 0)); flap.position.set(0, R + .45, .72);
  const isle = grp(cyl(4.6, 4.2, .6, 9, '#7fcf6a', 0, -6.05, -.3), cyl(4.2, 1.2, 2.6, 9, '#9a7658', 0, -7.65, -.3));
  const bush = (x, z, s, c) => mesh(new THREE.IcosahedronGeometry(s, 0), mat(c), x, -5.6, z);
  isle.add(bush(-3.3, .6, .55, '#4faa4f'), bush(-2.75, 1.2, .35, '#63bf5c'), bush(3.2, .9, .5, '#4faa4f'), bx(.5, .5, .5, HEX.chili, 2.5, -5.5, 1.5), bx(.56, .12, .56, HEX.gold, 2.5, -5.22, 1.5), bx(.12, .52, .52, HEX.gold, 2.5, -5.5, 1.51));
  rig.add(back, trim, ...bulbs, legL, legR, bx(5.4, .36, 1.3, HEX.wood2, 0, -5.55, -.5), axle, bx(.3, 1.1, .3, HEX.wood2, 0, R + .95, -.25), bx(.3, .3, 1.1, HEX.wood2, 0, R + .55, .2), flap, wheel, isle);
  rig.rotation.set(-.04, -.26, 0); rig.position.y = 1; scene.add(rig);
  const clouds = [[-6, 3.5, -6, 1.2], [5.5, 1.5, -8, 1.5], [3, 5.5, -10, 1]].map(([x, y, z, s]) => { const g = grp(bx(2.2, .7, .9, '#ffffff', 0, 0, 0), bx(1.2, .6, .8, '#ffffff', .3, .5, 0), bx(1, .5, .7, '#ffffff', -.9, -.1, .2)); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); return g; });
  const bits = Array.from({ length: 90 }, (_, i) => { const m = bx(.16, .16, .04, [HEX.chili, HEX.gold, HEX.mint, HEX.pink, HEX.sky, HEX.violet][i % 6], 0, 0, 0); m.visible = false; scene.add(m); return { m, v: new THREE.Vector3(), life: 0 }; });

  const S = { rot: 0, speed: 0, spinning: false, won: -1, flash: 0, idle: true, lastPeg: 0 };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setNight(n) {
    hemi.intensity = n ? 1.9 : 2; hemi.color.set(n ? '#d4d6ff' : '#ffffff'); hemi.groundColor.set(n ? '#6a63b0' : '#b9a79a'); sun.intensity = n ? 1.1 : 1.6; sun.color.set(n ? '#dfe3ff' : '#fff1d6');
    for (const c of clouds) c.visible = !n;
  }
  setNight(night);
  function size() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  const ro = new ResizeObserver(size); ro.observe(canvas); size();
  document.fonts?.ready.then(() => { for (const [l, t] of tiles) { const old = l.material.map; l.material.map = numberTile(t).material.map; old.dispose(); } }); // redraw the numbers once Rubik is in

  let T = 0;
  const loop = frameLoop(dt => {
    T += dt;
    if (S.idle && !still) S.rot -= dt * .12; // a slow turn until the first spin
    wheel.rotation.z = S.rot;
    const ph = ((S.rot / STEP) % 1 + 1.5) % 1; // 0 just after a peg has passed the pointer
    const peg = Math.floor(S.rot / STEP + .5); if (S.spinning && peg !== S.lastPeg) { S.lastPeg = peg; if (S.speed < 14) sfx.tick(); }
    flap.rotation.z = S.spinning ? -Math.max(0, 1 - ph * 3.5) * Math.min(.7, S.speed * .25) : flap.rotation.z * .8;
    bulbs.forEach((b, i) => { const on = S.flash > 0 ? Math.floor(T * 8) % 2 === 0 : S.spinning ? (i + Math.floor(T * 12)) % 3 === 0 : (i + Math.floor(T * 2)) % 2 === 0; b.material.emissiveIntensity = on ? 1 : .08; b.scale.setScalar(on ? 1.15 : 1); });
    for (const o of twirl) o.rotation.z = Math.sin(T * 2) * .35; // the star rocks in its own plane, so it never dips into the wheel
    gem.rotation.z = T; S.flash = Math.max(0, S.flash - dt);
    wedges.forEach((g, i) => { const up = i === S.won ? .22 + Math.sin(T * 5) * .06 : 0; g.position.z += (up - g.position.z) * .2; });
    for (const c of clouds) { c.position.x += dt * .15; if (c.position.x > 9) c.position.x = -9; }
    for (const b of bits) if (b.life > 0) { b.life -= dt; b.v.y -= 9 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 7; b.m.rotation.z += dt * 5; if (b.life <= 0) b.m.visible = false; }
    renderer.render(scene, cam);
  });
  return {
    setNight,
    // Stand still on slice i, with no show (the wheel was already spun today).
    rest(i) { S.idle = false; S.rot = -i * STEP; S.won = i; },
    // Turn at least five times and stop on slice i, then call done.
    spin(i, done) {
      const from = S.rot; let to = -i * STEP + (Math.random() - .5) * STEP * .6; while (to > from - 5 * Math.PI * 2) to -= Math.PI * 2;
      const D = still ? 1 : 5200, t0 = performance.now(); let prev = from;
      S.idle = false; S.won = -1; S.spinning = true; sfx.whoosh();
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / D), e = 1 - Math.pow(1 - t, 4);
        S.rot = from + (to - from) * e; S.speed = Math.abs(S.rot - prev) * 60; prev = S.rot;
        if (t < 1) return void (S.raf = requestAnimationFrame(step));
        S.rot = to % (Math.PI * 2); S.spinning = false; S.won = i; S.flash = 2.2;
        if (!still) for (const b of bits) { b.m.visible = true; b.life = 1.6 + Math.random(); b.m.position.set((Math.random() - .5) * 2, 4.6, 1.5); b.v.set((Math.random() - .5) * 7, 2 + Math.random() * 5, (Math.random() - .5) * 3); }
        done();
      };
      step();
    },
    destroy() {
      loop.stop(); cancelAnimationFrame(S.raf); ro.disconnect();
      scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
      renderer.dispose();
    },
  };
}

// ---------- the window ----------
export function mount(box, ctx) {
  let info = null, view = null, busy = false, dead = false, shown = null; // shown: the result on screen
  box.classList.add('lw');
  box.innerHTML = `<h2 class="lwh">${L('Lucky Wheel', 'Koło szczęścia')}</h2>
    <div class="lwgrid">
      <div class="lwstage"><div class="lwwin" id="lw-win" hidden></div><canvas class="lwcv" aria-label="${L('A wheel with 20 equal slices', 'Koło z 20 równymi polami')}"></canvas><p class="lwflat" hidden></p></div>
      <div class="lwside">
        <div class="lwpet" id="lw-pet"></div>
        <button type="button" class="btn big lwspin" id="lw-spin" disabled>${L('Spin', 'Zakręć')}</button>
        <div class="lwres" id="lw-res" role="status"></div>
        <div class="lwset" id="lw-set"></div>
      </div>
    </div>
    <details class="lwodds"><summary>${L('What is on the wheel', 'Co jest na kole')}</summary>
      <p>${L('20 equal slices, so each one is a 5% chance. The wheel shows the real odds.', '20 równych pól, więc każde to 5% szansy. Koło pokazuje prawdziwe szanse.')}</p>
      <table><tbody>${Object.keys(PRIZES).map(k => { const n = ORDER.filter(x => x === k).length, [a, b] = KIND[k](); return `<tr><td><i style="background:${SLICE[k][1]}"></i></td><td><b>${a}</b>${b ? `<small>${b}</small>` : ''}</td><td>${n * 100 / N}%</td></tr>`; }).join('')}</tbody></table>
      <p>${L(`You never win a lucky decoration twice. After ${PITY} spins in a row without one, the next spin is a sure one. With the whole set, that slice pays ${SET_COINS} coins.`, `Szczęśliwej ozdoby nie da się wygrać dwa razy. Po ${PITY} obrotach z rzędu bez ozdoby następny obrót daje ją na pewno. Gdy masz cały zestaw, to pole płaci ${SET_COINS} monet.`)}</p>
    </details>`;
  const $ = id => box.querySelector('#' + id), cv = box.querySelector('.lwcv');
  try { view = buildScene(cv, document.body.classList.contains('night')); }
  catch (e) { console.warn('3D unavailable', e); cv.hidden = true; box.querySelector('.lwflat').hidden = false; }
  const watch = new MutationObserver(() => view?.setNight(document.body.classList.contains('night')));
  watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function paintSet() {
    const have = info?.lucky || [];
    $('lw-set').innerHTML = info?.guest ? '' : `<b>${L(`Lucky set: ${have.length} of ${LUCKY.length}`, `Szczęśliwy zestaw: ${have.length} z ${LUCKY.length}`)}</b>
      <div class="lwtiles">${LUCKY.map(t => `<span class="lwtile${have.includes(t) ? ' on' : ''}" title="${esc(ITEMS[t].name)}">${have.includes(t) ? `<img src="${islePic('ip', t)}" alt="${esc(ITEMS[t].name)}" width="48" height="48">` : '?'}</span>`).join('')}</div>
      ${have.length < LUCKY.length ? `<small>${info.sure > 0 ? L(`A sure one in ${cnt(info.sure, 'spin', 'spins')} at the latest.`, `Pewna ozdoba najpóźniej za: ${cnt(info.sure, '', '', 'obrót', 'obroty', 'obrotów')}.`) : L('Your next spin is a sure one!', 'Następny obrót daje ozdobę na pewno!')}</small>` : ''}`;
  }
  function paintResult(r, fresh) {
    const [a, b] = wonText(r.prize);
    $('lw-res').innerHTML = `<div class="lwwon${fresh ? ' pop' : ''}"><small>${fresh ? L('You won', 'Wygrana') : L('Today’s prize', 'Dzisiejsza nagroda')}</small><b>${esc(a)}</b><span>${esc(b)}</span></div>`;
  }
  // The prize pop-up: what was won, as big as it deserves, over the wheel.
  function showWin(r) {
    const z = r.prize, [a, b] = wonText(z), farm = !z.coins, el = $('lw-win');
    el.innerHTML = `<div class="lwcard${z.item ? ' gold' : ''}" role="dialog" aria-label="${L('Your prize', 'Twoja nagroda')}"><small>${z.item ? L('Jackpot! You won', 'Główna nagroda! Wygrywasz') : L('You won', 'Wygrana')}</small>
      <div class="lwpic">${wonPic(z)}</div><b>${esc(a)}</b><p>${esc(b)}</p>
      <div class="row">${farm ? `<button type="button" class="btn w" data-w="farm">${L('Open Pet Farm', 'Otwórz Farmę zwierzaków')}</button>` : ''}<button type="button" class="btn m" data-w="ok">${L('Great!', 'Super!')}</button></div></div>`;
    el.hidden = false;
    if (z.pet) petPic({ sp: z.pet.sp, lv: 1 }, 264).then(u => { const im = el.querySelector('.lwwinpet'); if (u && im) { im.src = u; im.hidden = false; } });
    el.querySelector('[data-w="ok"]').focus();
  }
  $('lw-win').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b && e.target !== $('lw-win')) return; sfx.click(); $('lw-win').hidden = true; if (b?.dataset.w === 'farm') ctx.farm(); });
  function paint() {
    if (!info) return;
    const sp = SPECIES[info.pet];
    $('lw-pet').innerHTML = sp ? `<img class="lwpetpic" alt="" width="64" height="64" hidden><div><small>${L('Pet of the day', 'Zwierzak dnia')}</small><b>${esc(sp.name)}</b><span>${RARITY[sp.rare]} · ${elName(sp.el)}</span></div>` : '';
    if (sp) petPic({ sp: info.pet, lv: 1 }).then(u => { const im = box.querySelector('.lwpetpic'); if (u && im) { im.src = u; im.hidden = false; } });
    const btn = $('lw-spin');
    if (info.guest) { btn.disabled = false; btn.textContent = L('Log in to spin', 'Zaloguj się, żeby zakręcić'); $('lw-res').innerHTML = `<p class="lwnote">${L('One free spin a day for everyone with an account.', 'Jeden darmowy obrót dziennie dla każdego, kto ma konto.')}</p>`; }
    else if (info.spun) { btn.disabled = true; btn.textContent = L(`Next spin in ${left(info.next)}`, `Następny obrót za ${left(info.next)}`); }
    else { btn.disabled = busy; btn.textContent = L('Spin', 'Zakręć'); if (!busy) $('lw-res').innerHTML = `<p class="lwnote">${L('Your free spin is ready.', 'Twój darmowy obrót czeka.')}</p>`; }
    paintSet();
  }
  const left = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? `${h}${L('h', ' godz.')} ${m % 60}${L('m', ' min')}` : `${m}${L('m', ' min')}`; };

  $('lw-spin').addEventListener('click', () => {
    if (!info || busy) return;
    if (info.guest) return ctx.account('login');
    if (info.spun) return;
    busy = true; $('lw-spin').disabled = true; $('lw-res').innerHTML = ''; sfx.click();
    ctx.send({ t: 'wheel', spin: true });
  });
  ctx.send({ t: 'wheel' });

  return {
    msg(m) {
      if (dead) return;
      if (m.err) { busy = false; ctx.toast(srvText(m.err), true); }
      if (m.won) { // play the spin first; the prize and the new state show when the wheel stops
        const after = () => { if (dead) return; busy = false; info = m; shown = m.day; paint(); paintResult(m.won, true); showWin(m.won); (m.won.prize.item || m.won.prize.kind === 'c100' || m.won.prize.pet ? sfx.win : sfx.set).call(sfx); ctx.spun?.(); };
        if (view) view.spin(m.won.i, after); else after();
        return;
      }
      if (busy) return; // a plain update while the wheel turns would give the result away
      info = m; paint();
      if (m.last && shown !== m.day) { shown = m.day; view?.rest(m.last.i); paintResult(m.last, false); }
    },
    destroy() { dead = true; watch.disconnect(); view?.destroy(); },
  };
}

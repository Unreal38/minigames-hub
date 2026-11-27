// Liar's Dice 3D table (three.js): a round wooden table on a sky island, everyone's avatar on a stool with a
// dice cup in their colour. Purely visual: it draws what the server sends. Other players' dice do not exist
// here until the cups lift, because the server never sends them before that.
import * as THREE from 'three';
import { diceKit } from '../../dice3d.js';
import { avatar3d, animateAvatar, disposeAvatar, bake } from '../../avatar3d.js';
import { toonify, toonMat, shell, skyDome, clouds, island, birds, petals, createFx, shaker, STAR, DOT, nightScene, roundDeck } from '../../scenery3d.js';
import { frameLoop, autoResolution, AA } from '../../frames.js';
import { hudFitOk } from '../../camfit.js';
import { matches } from './rules.js';

const INK = '#4a2c22', SKY_TOP = '#5fb8f5', SKY_LOW = '#cfeeff';
const R = 3.4;                 // table radius
const DIE = .3, CUP_H = .9;    // die edge, cup height
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true, ...o });
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

// ---------- dice ----------
// Each die's look (shape, face art, pips) comes from its owner's dice skin (dice3d.js); SIDE is the value on +x, -x, +y, -y, +z, -z.
const SIDE = [2, 5, 1, 6, 3, 4]; // opposite sides add up to 7
// turn a die so that value v is on top
const UP = [null, [0, 0, 0], [0, 0, Math.PI / 2], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2], [Math.PI, 0, 0]];
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _yaw = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
function faceUp(mesh, v, yaw = 0) { mesh.quaternion.setFromEuler(_e.set(...UP[v])).premultiply(_yaw.setFromAxisAngle(Y, yaw)); }
// where up to six dice sit under one cup
const SPOTS = [[], [[0, 0]], [[-.22, 0], [.22, 0]], [[-.23, .16], [.23, .16], [0, -.24]], [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]],
  [[-.32, -.32], [.32, -.32], [0, 0], [-.32, .32], [.32, .32]], [[-.38, -.22], [0, -.22], [.38, -.22], [-.38, .22], [0, .22], [.38, .22]]];

export function createScene(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance' });
  const res = autoResolution(renderer, 1.75);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY_LOW); scene.fog = new THREE.Fog(SKY_LOW, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const small = matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.55); sun.position.set(6, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

  // ---------- the island and the table ----------
  skyDome(scene, SKY_TOP, SKY_LOW);
  const cloudRing = clouds({ min: 22, max: 90, below: -12 }); scene.add(cloudRing);
  nightScene(scene); // the website's night mode carries into the game
  const land = island(15, 15, { round: true, rim: 4.4, seed: 5, props: 16, size: 1.7, flowers: 56 }); land.position.y = -2.4; scene.add(land);
  const flyBirds = birds(scene, 46, 13, 4, 1.6), drift = petals(scene, 22, 5, { n: small ? 6 : 10 });
  const room = new THREE.Group(); scene.add(room);
  const put = (geo, mat, x = 0, y = 0, z = 0, parent = room) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  { // a round plank deck with a rope-ish rim
    room.add(roundDeck(7.6, { wood: '#d9a066', seam: '#b97f4c', rim: '#a86a42', pitch: 1.15 }));
    // table: a plank top with a teal cloth, on a barrel
    const top = put(new THREE.CylinderGeometry(R + .45, R + .3, .3, 28), M('#b9794a'), 0, -.15, 0); top.castShadow = top.receiveShadow = true;
    const cloth = put(new THREE.CylinderGeometry(R, R, .04, 28), M('#3f9f96'), 0, .0, 0); cloth.receiveShadow = true;
    const ring = new THREE.TorusGeometry(R * .5, .03, 5, 28); ring.rotateX(Math.PI / 2); put(ring, M('#5fbdb2'), 0, .02, 0);
    const edge = new THREE.TorusGeometry(R + .02, .07, 6, 28); edge.rotateX(Math.PI / 2); put(edge, M('#ffc94d'), 0, .0, 0);
    put(new THREE.CylinderGeometry(1.25, 1.05, 2, 14), M('#a86a42'), 0, -1.32, 0).castShadow = true;
    for (const y of [-.7, -1.9]) { const h = new THREE.TorusGeometry(y < -1 ? 1.13 : 1.24, .07, 5, 14); h.rotateX(Math.PI / 2); put(h, M('#5b4636'), 0, y, 0); }
    // a few things lying about: barrels, a crate, a little flag
    const barrel = (x, z, s = 1) => { const g = new THREE.Group(); g.position.set(x, -2.34, z); g.scale.setScalar(s); room.add(g);
      put(new THREE.CylinderGeometry(.5, .5, 1.1, 10), M('#b9794a'), 0, .55, 0, g).castShadow = true; put(new THREE.CylinderGeometry(.54, .54, .1, 10), M('#5b4636'), 0, .3, 0, g); put(new THREE.CylinderGeometry(.54, .54, .1, 10), M('#5b4636'), 0, .85, 0, g); };
    barrel(-6.1, -2.6, 1.1); barrel(-5.3, -3.7, .85); barrel(6.2, -1.6, 1);
    put(new THREE.BoxGeometry(1, 1, 1), M('#c99763'), 5.6, -1.84, -3.2).castShadow = true; put(new THREE.BoxGeometry(.7, .7, .7), M('#d9a066'), 5.5, -.99, -3.1).rotation.y = .5;
    put(new THREE.CylinderGeometry(.07, .09, 4.4, 6), M('#8a5a3c'), -4.2, -.2, -5.4).castShadow = true;
    const flag = new THREE.Shape(); flag.moveTo(0, 0); flag.lineTo(1.5, -.4); flag.lineTo(0, -.85); flag.closePath();
    put(new THREE.ExtrudeGeometry(flag, { depth: .04, bevelEnabled: false }), M('#e5543b'), -4.14, 1.95, -5.4);
    put(new THREE.BoxGeometry(.5, .5, .5), M('#fff8ec'), 4.2, -2.09, 5.0).rotation.y = .6; put(new THREE.BoxGeometry(.42, .42, .42), M('#ff8fab'), 4.75, -2.13, 4.5).rotation.y = -.3; // giant spare dice
    bake(room); toonify(room, .04);
  }
  const pfx = createFx(scene), shake = shaker();

  // ---------- shared dice and cup parts ----------
  const kit = diceKit({ side: SIDE });
  const dieMat = kit.mat(0), bigGeo = kit.geo(0, .62);
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const cupGeo = new THREE.LatheGeometry([[.7, 0], [.72, .04], [.55, CUP_H - .05], [.5, CUP_H], [0, CUP_H]].map(p => new THREE.Vector2(...p)), 14);
  const bandGeo = new THREE.CylinderGeometry(.685, .725, .14, 14, 1, true); bandGeo.translate(0, .2, 0);
  const ringGeo = new THREE.TorusGeometry(.9, .05, 6, 32); ringGeo.rotateX(Math.PI / 2);
  // life mode: a row of little hearts on the table in front of each player
  const heartGeo = (() => { const h = new THREE.Shape(); h.moveTo(0, -.5); h.bezierCurveTo(-.75, 0, -.6, .55, -.27, .55); h.bezierCurveTo(-.1, .55, 0, .42, 0, .3); h.bezierCurveTo(0, .42, .1, .55, .27, .55); h.bezierCurveTo(.6, .55, .75, 0, 0, -.5);
    const g = new THREE.ExtrudeGeometry(h, { depth: .22, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 1, curveSegments: 5 }); g.translate(0, 0, -.11); g.rotateX(-Math.PI / 2); g.scale(.3, .3, .3); /* lying flat, point towards +z */ return g; })();
  const heartMat = toonMat(M('#f0483e')), heartOff = toonMat(M('#cdb9a6'));
  function setLives(s, lives, max) {
    if (s.lives === lives && s.hearts.length === max) return;
    while (s.hearts.length < max) { const m = new THREE.Mesh(heartGeo, heartMat); const o = new THREE.Mesh(heartGeo, inkMat); o.scale.setScalar(1.16); m.add(o); m.castShadow = true; s.g.add(m); s.hearts.push({ m, pop: 0 }); }
    while (s.hearts.length > max) s.g.remove(s.hearts.pop().m);
    s.hearts.forEach((h, k) => { const on = k < lives; if (s.lives >= 0 && k < s.lives && !on) { h.pop = 1; pfx.burst(h.m.getWorldPosition(new THREE.Vector3()), { n: 9, colors: ['#f0483e', '#ff9fb8'], speed: 2, up: 3, size: .22, life: .7 }); }
      h.m.material = on ? heartMat : heartOff; // yours lie in a row at the table edge; everyone else's sit on the middle side of their cup, where the cup does not hide them
      if (s.mine) h.m.position.set((k - (max - 1) / 2) * .4, .08, .92);
      else { const row = k < 3 ? 0 : 1, inRow = row ? max - 3 : Math.min(3, max), j = row ? k - 3 : k; h.m.position.set((j - (inRow - 1) / 2) * .34, .08, -.98 - row * .3); }
      h.m.rotation.y = -s.g.rotation.y; h.m.scale.setScalar((on ? 1 : .8) * (s.mine ? 1 : .82)); }); // turned so every heart reads the right way up from your seat
    s.lives = lives;
  }
  // Dice skins from the shop: each player's dice wear their own skin, and dice that did not count go dark.
  const skinOf = k => [kit.mat(k), kit.dim(k), kit.geo(k, DIE)];
  function makeDie(geo, v, yaw, mat = dieMat) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; faceUp(m, v, yaw);
    const o = new THREE.Mesh(geo, inkMat); o.scale.setScalar(1.12); m.add(o);
    return m;
  }
  function makeCup(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(cupGeo, toonMat(M(color, { side: THREE.DoubleSide }))); body.castShadow = true;
    const band = new THREE.Mesh(bandGeo, toonMat(M(shade(color, .72))));
    const o = new THREE.Mesh(cupGeo, inkMat); o.scale.set(1.07, 1.04, 1.07);
    g.add(body, band, o); return g;
  }

  // the bid in the middle of the table: one big die showing the face that was bid
  const bidDie = makeDie(bigGeo, 6, 0); bidDie.position.set(0, .33, 0); bidDie.visible = false; scene.add(bidDie);
  let bidKey = '', bidHop = 0, bidYaw = .5;

  // ---------- seats ----------
  let n = 0, me = -1, seats = [], seatKey = '';
  const seatAngle = r => Math.PI / 2 + r * Math.PI * 2 / n;
  const onRim = (r, k = 1) => { const a = seatAngle(r); return new THREE.Vector3(Math.cos(a) * R * k, 0, Math.sin(a) * R * k); };
  const rel = i => (me >= 0 ? (i - me + n) % n : i);
  function freeSeat(s) { scene.remove(s.av, s.stool, s.g, s.ring); disposeAvatar(s.av); s.ring.material.dispose(); }
  function buildSeats(list) {
    for (const s of seats) freeSeat(s);
    n = list.length;
    seats = list.map((p, i) => {
      const r = rel(i), a = seatAngle(r), out = onRim(r, 1.4), mine = me >= 0 && r === 0;
      const av = avatar3d(p.color, p.av); av.position.set(out.x, -.15, out.z); av.lookAt(0, -.15, 0); av.visible = !mine; scene.add(av);
      const stool = new THREE.Group(); stool.position.set(out.x, -.95, out.z); scene.add(stool);
      put(new THREE.CylinderGeometry(.58, .5, .2, 12), M(p.color), 0, 0, 0, stool).castShadow = true;
      put(new THREE.CylinderGeometry(.09, .12, 1.3, 6), M('#8a5a3c'), 0, -.75, 0, stool); toonify(stool, .035); stool.visible = !mine;
      // everything on the table in front of this seat; local +z points out towards the player
      const g = new THREE.Group(), at = onRim(r, mine ? .68 : .64); g.position.copy(at); g.rotation.y = Math.PI / 2 - a; scene.add(g);
      const cup = makeCup(p.color); g.add(cup);
      const ring = put(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }), at.x, .05, at.z, scene);
      return { av, stool, g, cup, ring, mine, dice: [], diceKey: '', hearts: [], lives: -1, n: p.n, hop: 0, nod: 0, look: 0, active: false, key: '' };
    });
  }
  function setDice(s, vals, key) {
    if (s.diceKey === key) return; s.diceKey = key;
    for (const d of s.dice) s.g.remove(d.m);
    const spots = SPOTS[Math.min(6, vals.length)] || [];
    s.dice = vals.slice(0, 6).map((v, k) => { const m = makeDie(s.skin[2], v, Math.sin(k * 12.9 + v * 4.1 + s.g.position.x) * .3, s.skin[0]); m.position.set(spots[k][0], DIE / 2 + .02, spots[k][1]); s.g.add(m); return { m, v, hop: 0, hit: false }; });
  }

  // ---------- state from the server ----------
  let S = null, round = '', rollEnd = 0, showAt = 0, showKey = '', order = [], counted = 0, dimmed = false, verdict = false, T0 = performance.now();
  function setState(st) {
    const list = st.seats, key = list.map(p => p.color + (p.av || []).join('')).join('|') + '/' + st.me;
    if (key !== seatKey) {
      const rebuilt = st.me !== me || list.length !== n || !seats.length;
      me = st.me; seatKey = key;
      if (rebuilt) buildSeats(list);
      else list.forEach((p, i) => { // someone took over a bot: swap that avatar and repaint the cup
        const s = seats[i], k = p.color + (p.av || []).join(''); if (s.key === k) return;
        const pos = s.av.position.clone(), q = s.av.quaternion.clone(), vis = s.av.visible; scene.remove(s.av); disposeAvatar(s.av);
        s.av = avatar3d(p.color, p.av); s.av.position.copy(pos); s.av.quaternion.copy(q); s.av.visible = vis; scene.add(s.av); s.hop = 1;
        const c = makeCup(p.color); c.position.copy(s.cup.position); c.quaternion.copy(s.cup.quaternion); s.g.remove(s.cup); s.g.add(c); s.cup = c;
      });
      list.forEach((p, i) => { seats[i].key = p.color + (p.av || []).join(''); });
      round = '';
    }
    const now = performance.now(), rk = st.gid + '/' + st.round;
    if (rk !== round) { // new round: the cups come down and rattle
      round = rk; rollEnd = st.stage === 'roll' && !reduced ? now + Math.max(0, st.ms.roll - st.rollAgo) : 0;
      showKey = ''; showAt = 0; order = []; counted = 0; dimmed = false; verdict = false;
    }
    list.forEach((p, i) => {
      const s = seats[i];
      s.n = p.n; s.active = st.turn === i && st.stage === 'bid';
      s.skin = skinOf(p.fl?.dc);
      setLives(s, st.livesMax ? p.lives : 0, st.livesMax && p.n ? st.livesMax : 0);
      setDice(s, p.dice || [], rk + (p.dice ? p.dice.join('') : '') + (p.fl?.dc | 0));
    });
    // the bid die in the middle
    const bk = st.bid ? rk + st.bid.q + '/' + st.bid.f + '/' + st.hist.length : '';
    if (bk !== bidKey) {
      bidKey = bk; bidDie.visible = !!st.bid;
      if (st.bid) { bidYaw += 1.1; faceUp(bidDie, st.bid.f, bidYaw); bidHop = 1; pfx.ring(bidDie.position.clone().setY(.03), { color: list[st.bid.s]?.color || '#ffd84a', size: 1.5 }); if (seats[st.bid.s]) seats[st.bid.s].hop = .6; }
    }
    // the cups lift: line up every matching die, starting from whoever made the bid, to be counted one by one
    if (st.show && st.stage === 'show') {
      const sk = rk + st.show.caller + st.show.kind;
      if (sk !== showKey) {
        showKey = sk; showAt = now - st.show.ago; order = []; counted = 0; dimmed = false; verdict = false;
        for (let k = 0; k < n; k++) { const i = (st.show.bidder + k) % n; for (const d of seats[i].dice) { d.hit = matches(d.v, st.show.f, st.wild); if (d.hit) order.push({ d, i }); } }
        if (seats[st.show.caller]) seats[st.show.caller].hop = 1;
        shake.kick(.1);
      }
    }
    S = st;
  }

  // ---------- sizing ----------
  let W = 0, H = 0, hudBottom = 230, hudLeft = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3(0, 0, -.2);
  const DIR = new THREE.Vector3(0, 1.08, 1).normalize(), v = new THREE.Vector3();
  const toPx = p => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function place(D) { camera.position.copy(DIR).multiplyScalar(D); camera.lookAt(camLook); camera.updateMatrixWorld(); }
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w === W && h === H && !force) return; W = w; H = h;
    renderer.setSize(w, h, false);
    const portrait = w / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 50 : 36; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const top = w < 760 ? 150 : 110, bottom = Math.max(top + 120, h - hudBottom), side = portrait ? R * 1.12 : R * 1.4 + 1.1; // on phones the side players may peek in from the edges
    const FIT = [new THREE.Vector3(0, 3.3, -R * 1.4), new THREE.Vector3(0, .3, R * 1.04), new THREE.Vector3(-side, 1.2, 0), new THREE.Vector3(side, 1.2, 0)];
    let lo = 5, hi = 90;
    for (let i = 0; i < 32; i++) {
      const D = (lo + hi) / 2; place(D);
      const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]), [lx] = toPx(FIT[2]), [rx] = toPx(FIT[3]);
      if (fy - ty <= bottom - top && lx + hudLeft / 2 >= hudLeft + 4 && rx + hudLeft / 2 <= w - 4) hi = D; else lo = D;
    }
    place(hi); camBase.copy(camera.position);
    scene.fog.near = hi + 20; scene.fog.far = hi + 130;
    const [, ty] = toPx(FIT[0]), [, fy] = toPx(FIT[1]);
    camera.setViewOffset(w, h, -hudLeft / 2, (ty + fy) / 2 - (top + bottom) / 2, w, h); camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let T = 0, dead = false;
  const tv = new THREE.Vector3(), want = new THREE.Vector3(), wq = new THREE.Quaternion(), we = new THREE.Euler();
  const info = { tags: [], bid: { x: 0, y: 0 } };
  function loop(dt) {
    if (dead) return;
    resize(); T += dt;
    const now = performance.now(), k = 1 - Math.exp(-dt * 11);
    const rolling = now < rollEnd, showing = !!showAt && S?.stage === 'show', lifted = showing && now - showAt > 250;
    // count the matching dice one at a time, then show who was wrong
    if (showing && S) {
      const t = now - showAt - S.ms.lift;
      if (t > -200 && !dimmed) { dimmed = true; for (const s of seats) for (const d of s.dice) if (!d.hit) d.m.material = s.skin[1]; }
      while (counted < order.length && t >= (counted + 1) * S.ms.each) {
        const { d, i } = order[counted++]; d.hop = 1;
        pfx.burst(d.m.getWorldPosition(tv), { n: 7, colors: ['#ffd84a', '#ffffff', seats[i].key.slice(0, 7)], speed: 1.8, up: 2.6, size: .2, life: .6, shape: STAR });
      }
      if (!verdict && t >= order.length * S.ms.each + 550) {
        verdict = true; shake.kick(.14);
        for (const i of S.show.lose) { const s = seats[i]; if (!s) continue; s.nod = 1; pfx.puff(tv.copy(s.g.position).setY(.1), { n: 12, color: ['#fff4e2', '#d9c3a4'], size: .4, speed: 2.4 }); }
        const glad = S.show.kind === 'spot' ? (S.show.right ? [S.show.caller] : []) : [S.show.right ? S.show.caller : S.show.bidder];
        for (const i of glad) { const s = seats[i]; if (!s) continue; s.hop = 1; const top = tv.copy(s.g.position).setY(1.2); pfx.confetti(top, { n: 46, w: 2.4, h: 2, s: i }); pfx.burst(top, { n: 14, colors: ['#ffd84a', '#ffffff'], speed: 3, up: 4, size: .26 }); }
      }
    }
    const turnSeat = seats.findIndex(s => s.active);
    seats.forEach((s, i) => {
      // where the cup wants to be
      let rx = 0, rz = 0; want.set(0, 0, 0);
      if (!s.n) { want.set(.1, .5, 0); rz = Math.PI / 2 - .12; }                         // out of dice: tipped over
      else if (rolling) { const ph = now * .03 + i * 2; want.set(Math.sin(ph) * .09, Math.abs(Math.sin(ph * 1.7)) * .1, Math.cos(ph * 1.3) * .07); rz = Math.sin(ph * 2.1) * .13; rx = Math.cos(ph * 1.6) * .1; }
      else if (s.mine) want.set(1.2, 0, .15);                                           // your own cup stands beside your dice
      else if (lifted) { want.set(1.12, .3, .3); rz = -.5; rx = .2; }                     // the reveal: lifted off and held to one side
      s.cup.position.lerp(want, k); wq.setFromEuler(we.set(rx, 0, rz)); s.cup.quaternion.slerp(wq, k);
      // your dice stay hidden while your cup is over them
      const hide = s.mine && now < rollEnd - 220;
      for (const d of s.dice) {
        if (d.m.visible === hide) d.m.visible = !hide;
        if (d.hop > 0 || d.m.scale.x !== 1) { d.hop = Math.max(0, d.hop - dt * 2.6); const lift = Math.sin(d.hop * Math.PI); d.m.position.y = DIE / 2 + .02 + lift * .45 + (d.hit && lifted ? .0 : 0); d.m.scale.setScalar((d.hit && dimmed ? 1.18 : 1) + lift * .3); }
      }
      for (const h of s.hearts) if (h.pop > 0) { h.pop = Math.max(0, h.pop - dt * 2.5); h.m.position.y = .08 + Math.sin(h.pop * Math.PI) * .4; }
      s.hop = Math.max(0, s.hop - dt * 2.2); s.nod = Math.max(0, s.nod - dt * .7);
      s.av.position.y = -.15 + Math.abs(Math.sin(s.hop * Math.PI * 2)) * .45 * s.hop;
      let look = 0;
      if (turnSeat >= 0 && turnSeat !== i) { const d = ((rel(turnSeat) - rel(i) + n) % n) / n; look = d < .5 ? .5 : -.5; }
      s.look += (look - s.look) * .05;
      animateAvatar(s.av, T, { seed: i, active: s.active || (rolling && !!s.n), hop: s.hop, look: s.look, nod: s.n ? Math.sin(Math.min(1, s.nod) * Math.PI) * .9 : .5 });
      s.ring.material.opacity += ((s.active ? .9 : 0) - s.ring.material.opacity) * .15;
      s.ring.scale.setScalar(1 + Math.sin(T * 4) * .05);
    });
    if (rolling && Math.random() < dt * 14) { const s = seats[Math.random() * seats.length | 0]; if (s?.n) pfx.rise(tv.copy(s.g.position).setY(CUP_H + .1), { color: '#ffffff', size: .14, life: .5, speed: 1.2, wobble: .8, shape: DOT, grow: 0 }); }
    bidHop = Math.max(0, bidHop - dt * 2.4);
    bidDie.position.y = .33 + Math.sin(bidHop * Math.PI) * .55 + Math.sin(T * 1.6) * .015; bidDie.scale.setScalar(1 + Math.sin(bidHop * Math.PI) * .18);

    cloudRing.rotation.y = T * .006; flyBirds(T); drift(T);
    camera.position.set(camBase.x + (reduced ? 0 : Math.sin(T * .22) * .16), camBase.y + (reduced ? 0 : Math.sin(T * .37) * .05), camBase.z);
    camera.lookAt(camLook); if (!reduced) shake.apply(camera, dt);
    pfx.update(dt, camera, H);
    renderer.render(scene, camera);

    // where the HUD draws the name tags and the bid label
    seats.forEach((s, i) => {
      const r = rel(i), t = info.tags[i] ||= { x: 0, y: 0, cx: 0, cy: 0, mine: false };
      tv.copy(onRim(r, 1.4)); tv.y = 2.3; tv.project(camera); t.x = (tv.x + 1) / 2 * W; t.y = (1 - tv.y) / 2 * H; t.mine = s.mine;
      tv.copy(s.g.position); tv.y = .9; tv.project(camera); t.cx = (tv.x + 1) / 2 * W; t.cy = (1 - tv.y) / 2 * H;
    });
    info.tags.length = seats.length;
    tv.set(0, .05, .62).project(camera); info.bid.x = (tv.x + 1) / 2 * W; info.bid.y = (1 - tv.y) / 2 * H;
    onFrame?.(info);
  }
  const ticker = frameLoop(loop, { onSlow: () => res.lower() });

  return {
    setState,
    setHud(px) { if ((Math.abs(px - hudBottom) > 6) && hudFitOk(canvas)) { hudBottom = px; resize(true); } },
    setInset(px) { if ((px !== hudLeft) && hudFitOk(canvas)) { hudLeft = px; resize(true); } },
    dispose() {
      dead = true; ticker.stop();
      for (const s of seats) { disposeAvatar(s.av); s.ring.material.dispose(); }
      pfx.dispose(); kit.dispose(); inkMat.dispose();
      for (const g of [cupGeo, bandGeo, ringGeo, heartGeo]) g.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

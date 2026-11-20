// Pet Farm pets: every species is built in code from a few flat-shaded shapes, with its own silhouette and
// three growth forms that each look different (not just bigger).
//   petModel(species, form, look) -> THREE.Group facing +Z, standing on y = 0, about 2 units tall as an adult.
//     look (optional, from breeding): { coat, coat2, pat: [...], feat: species, spark }
//     userData = { eyes, k, flame }
//   eggModel(base, speck) -> THREE.Group
// Each species also owns one signature part (ears, tail, cap...) in FEAT, which a baby can borrow from a parent.
import * as THREE from 'three';
import { M, MX, G } from './models.js';

const mat = c => typeof c === 'string' ? M(c) : c;
const V = (p, o, pos, rot, scl) => { if (pos) o.position.set(...pos); if (rot) o.rotation.set(...rot); if (scl) o.scale.set(...(scl.length ? scl : [scl, scl, scl])); p.add(o); return o; };
const Grp = (p, pos, rot, scl) => V(p, new THREE.Group(), pos, rot, scl);
const Bx = (p, s, c, pos, rot) => V(p, new THREE.Mesh(G('Box', ...s), mat(c)), pos, rot);
const Sp = (p, r, c, pos, scl, d = 1) => V(p, new THREE.Mesh(G('Icosahedron', r, d), mat(c)), pos, null, scl);
const Gm = (p, r, c, pos, scl, rot) => V(p, new THREE.Mesh(G('Icosahedron', r, 0), mat(c)), pos, rot, scl);
const Oc = (p, r, c, pos, scl, rot) => V(p, new THREE.Mesh(G('Octahedron', r, 0), mat(c)), pos, rot, scl);
const Cy = (p, a, c, pos, rot, scl) => V(p, new THREE.Mesh(G('Cylinder', ...a), mat(c)), pos, rot, scl);
const Co = (p, a, c, pos, rot, scl) => V(p, new THREE.Mesh(G('Cone', ...a), mat(c)), pos, rot, scl);
const GL = (c, i = .45) => MX('glow' + c + i, c, { emissive: c, emissiveIntensity: i });
const TR = (c, o = .4) => MX('clear' + c + o, c, { transparent: true, opacity: o, depthWrite: false, roughness: .3 });
const _c = new THREE.Color(), _d = new THREE.Color();
export const mix = (a, b, t) => '#' + _c.set(a).lerp(_d.set(b), t).getHexString();
const PI = Math.PI;

const INK = '#2b2230';
// A face on the front of a head of radius r centred at pos. Eyes are remembered so the scene can blink them.
function face(p, eyes, pos, r, { gap = .34, y = .05, eye = 1, nose = '#f59ab0', mouth = true, z = .89, blush = '#ff8a9a' } = {}) {
  const g = Grp(p, pos, null, r), bl = MX('blush' + blush, blush, { transparent: true, opacity: .6 });
  for (const s of [-1, 1]) {
    eyes.push(Cy(g, [.12 * eye, .12 * eye, .06, 6], MX('ink', INK, { roughness: .5 }), [s * gap, y, z], [PI / 2, 0, -s * .33]));
    Bx(g, [.055, .055, .02], '#ffffff', [s * gap + .03, y + .05, z + .04]);
    V(g, new THREE.Mesh(G('Circle', .12, 6), bl), [s * (gap + .26), y - .17, z - .09], [0, s * .62, 0]);
    if (mouth) Bx(g, [.1, .03, .03], INK, [s * .04, y - .14, z + .055], [0, 0, s * .5]);
  }
  if (nose) Bx(g, [.07, .05, .04], nose, [0, y - .06, z + .065]);
}
const feet = (g, c, x, z, s = [.3, .18, .4], y = 0) => { for (const k of [-1, 1]) Bx(g, s, c, [k * x, y + s[1] / 2, z]); };
const legs4 = (g, c, x, zf, zb, h, w = .2) => { for (const k of [-1, 1]) for (const z of [zf, zb]) Bx(g, [w, h, w], c, [k * x, h / 2, z]); };
const flame = (g, pos, k, rot) => { // a flame the scene makes flicker
  const t = Grp(g, pos, rot, k); t.userData.flame = true;
  Co(t, [.3, .8, 5], GL('#ff8a3c', .4), [0, .42, 0]); Co(t, [.17, .5, 5], GL('#ffd65a', .55), [0, .3, .09]); Gm(t, .27, GL('#ff8a3c', .4), [0, .06, 0]);
  return t;
};
const flower = (g, pos, c = '#ff9ec4', k = 1, rot) => { const f = Grp(g, pos, rot, k); for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; Gm(f, .1, c, [Math.cos(a) * .13, 0, Math.sin(a) * .13], [1, .45, 1]); } Gm(f, .08, '#ffd65a', [0, .03, 0]); return f; };
const leaf = (g, pos, rot, k = 1, c = '#6cc24f') => Oc(g, .2, c, pos, [k, k * .25, k * 1.6], rot);

// ---------- signature parts ----------
// slot: where it sits (top of the head, tail, or back). b(g, F, K): built around the anchor point, F = form 0..2.
export const FEAT = {
  mossbun: { slot: 'top', name: 'bunny ears', b(g, F, K) {
    const h = [.36, .8, 1.15][F];
    for (const s of [-1, 1]) { const e = Grp(g, [s * (F === 2 ? .52 : .3), F === 2 ? -.2 : -.12, -.05], [-.1, 0, F === 2 ? -s * 2.35 : -s * .16]); Cy(e, [.11, .2, h, 4], K.a, [0, h / 2, 0], [0, PI / 4, 0], [1, 1, .6]); Bx(e, [.13, h * .7, .04], '#f59ab0', [0, h / 2, .1]); }
  } },
  sproutle: { slot: 'top', name: 'a sprout', b(g, F) {
    if (F === 0) { Cy(g, [.03, .04, .2, 4], '#5fa646', [0, .1, 0]); leaf(g, [-.14, .24, 0], [0, 0, .5], .8); leaf(g, [.14, .24, 0], [0, 0, -.5], .8); }
    else if (F === 1) { Cy(g, [.04, .06, .5, 5], '#8a5a3c', [0, .25, 0]); for (let i = 0; i < 4; i++) leaf(g, [Math.cos(i * 1.6) * .18, .42 + i * .07, Math.sin(i * 1.6) * .18], [0, -i * 1.6, .5], 1); }
    else { Cy(g, [.07, .11, .6, 5], '#8a5a3c', [0, .3, 0]); Sp(g, .48, '#5fb04a', [0, .85, 0], [1.1, .85, 1.1]); Gm(g, .26, '#86cc5a', [.3, .7, .15]); Gm(g, .24, '#86cc5a', [-.3, .75, -.1]); for (const [x, y, z] of [[.25, 1.15, .2], [-.3, 1.05, .2], [0, 1.25, -.2]]) flower(g, [x, y, z], '#ffb3d1', .8, [.5, 0, -x]); }
  } },
  petalpuff: { slot: 'top', name: 'a flower crown', b(g, F) {
    if (F === 0) { Gm(g, .14, '#ff9ec4', [0, .12, 0], [1, 1.3, 1]); leaf(g, [.12, .03, 0], [0, 0, -.3], .6); }
    else if (F === 1) for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; flower(g, [Math.cos(a) * .42, -.02, Math.sin(a) * .42], i % 2 ? '#ff9ec4' : '#fff1a8', .9, [Math.sin(a) * .5, 0, -Math.cos(a) * .5]); }
    else { for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; Oc(g, .3, i % 2 ? '#ff8fba' : '#ffc0d9', [Math.cos(a) * .52, .05, Math.sin(a) * .52], [.55, .2, 1.1], [0, -a + PI / 2, 0]); } Gm(g, .26, '#ffd65a', [0, .12, 0], [1, .6, 1]); }
  } },
  truffowl: { slot: 'top', name: 'a mushroom cap', b(g, F) {
    const r = [.5, .78, 1.08][F], c = '#c8553d';
    Cy(g, [r * .55, r * .7, .12, 8], '#fff3df', [0, .02, 0]);
    Sp(g, r, c, [0, .08, 0], [1, [.75, .62, .5][F], 1]);
    if (F) for (let i = 0; i < (F === 2 ? 7 : 4); i++) { const a = i * 2.4, e = .35 + (i % 3) * .28; Gm(g, r * .14, '#fff3df', [Math.sin(a) * Math.sin(e) * r, .08 + Math.cos(e) * r * (F === 2 ? .5 : .62), Math.cos(a) * Math.sin(e) * r], [1, .5, 1]); }
    if (F === 2) for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + .4; Oc(g, .09, GL('#7fe0d0', .5), [Math.cos(a) * r * .92, -.12, Math.sin(a) * r * .92], [1, 1.7, 1]); }
  } },
  cindercub: { slot: 'tail', name: 'a flame tail', b(g, F) {
    if (F < 2) flame(g, [0, 0, 0], [.6, 1, 1][F], [-.9, 0, 0]);
    else for (const [x, r, k] of [[0, 0, 1.25], [-.3, .5, .9], [.3, -.5, .9]]) flame(g, [x, 0, 0], k, [-.85, 0, r]);
  } },
  toastoad: { slot: 'top', name: 'a pat of butter', b(g, F) {
    Bx(g, [.34, .1, .34], '#ffe680', [0, .06, 0], [0, .5, .08]);
    if (F) Bx(g, [.5, .04, .5], '#ffd23e', [0, .01, 0], [0, .5, 0]);
    if (F === 2) { Gm(g, .2, '#d9455f', [.2, .1, .12], [1.2, .5, 1]); Gm(g, .08, '#d9455f', [.42, .02, .2], [1, .5, 1]); }
  } },
  flickit: { slot: 'top', name: 'a candle flame', b(g, F) {
    const h = [0, .22, .45][F];
    if (h) { Cy(g, [.13, .15, h, 6], '#fff6e0', [0, h / 2, 0]); if (F === 2) { Bx(g, [.07, .2, .07], '#fff6e0', [.13, h - .12, .05]); Bx(g, [.06, .13, .06], '#fff6e0', [-.12, h - .08, -.06]); } }
    flame(g, [0, h, 0], [.45, .6, .85][F]);
  } },
  magmutt: { slot: 'back', name: 'lava rocks', b(g, F) {
    const rock = (x, y, z, r) => { Gm(g, r, '#4a3f45', [x, y, z], [1, .8, 1], [x, z, r]); Bx(g, [r * .25, r * 1.3, r * .25], GL('#ff7a2c', .8), [x, y, z], [.5, x * 2, .6]); };
    rock(0, .1, 0, .34); if (F) { rock(-.36, .02, -.2, .26); rock(.36, .02, -.2, .26); } if (F === 2) { rock(0, .12, -.5, .3); rock(0, .4, -.1, .22); }
  } },
  puddlepup: { slot: 'tail', name: 'seal flippers', b(g, F, K) {
    const k = [.7, 1, 1.25][F];
    for (const s of [-1, 1]) Bx(g, [.26 * k, .1, .55 * k], K.b, [s * .17 * k, .12, -.2 * k], [.8, s * .45, 0]);
  } },
  bubblefin: { slot: 'back', name: 'a sail fin', b(g, F) {
    const k = [.6, 1, 1.4][F];
    Co(g, [.3 * k, .7 * k, 4], '#ffb14a', [0, .25 * k, -.05], [-.45, 0, 0], [.22, 1, 1]);
    if (F === 2) Co(g, [.2, .5, 4], '#ffd65a', [0, .22, -.42], [-.9, 0, 0], [.22, 1, 1]);
  } },
  axolily: { slot: 'top', name: 'a lily pad', b(g, F) {
    Cy(g, [.42 + F * .08, .42 + F * .08, .05, 7], '#5fb04a', [0, .03, 0], [.12, 0, 0]);
    if (F === 1) Gm(g, .13, '#ff9ec4', [0, .15, 0], [1, 1.4, 1]);
    if (F === 2) { for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; Oc(g, .2, i % 2 ? '#ff9ec4' : '#ffd0e2', [Math.cos(a) * .15, .16, Math.sin(a) * .15], [.5, 1.2, .5], [Math.sin(a) * .6, 0, -Math.cos(a) * .6]); } Gm(g, .08, '#ffd65a', [0, .2, 0]); }
  } },
  nimbowhale: { slot: 'top', name: 'a rain cloud', b(g, F) {
    const c = F === 2 ? '#aab4c8' : '#ffffff', y = .45;
    Sp(g, .34, c, [0, y, 0], [1.2, .8, 1]);
    if (F) { Sp(g, .26, c, [-.36, y - .04, .02], [1, .8, 1]); Sp(g, .28, c, [.36, y - .02, -.02], [1, .8, 1]); Gm(g, .2, c, [.1, y + .2, 0]); }
    if (F === 1) Oc(g, .06, '#7cc4ee', [0, y - .35, .1], [1, 1.8, 1]);
    if (F === 2) { for (const [x, z] of [[-.3, .1], [.05, -.1], [.32, .12]]) Oc(g, .06, '#7cc4ee', [x, y - .38, z], [1, 1.8, 1]); Bx(g, [.07, .26, .05], GL('#ffe066', .8), [.12, y - .3, .2], [0, 0, .5]); Bx(g, [.07, .22, .05], GL('#ffe066', .8), [.08, y - .48, .2], [0, 0, -.4]); }
  } },
  zapkit: { slot: 'tail', name: 'a lightning tail', b(g, F) {
    const k = [.6, .85, 1.1][F], y = GL('#ffd21f', .6), t = Grp(g, [0, 0, 0], [-.35, 0, 0], k);
    Bx(t, [.16, .5, .12], y, [0, .22, 0], [0, 0, .55]); Bx(t, [.18, .5, .12], y, [0, .58, 0], [0, 0, -.6]); Bx(t, [.2, .55, .12], y, [.02, .98, 0], [0, 0, .5]);
    if (F === 2) { Bx(t, [.16, .42, .12], y, [-.34, 1.28, 0], [0, 0, -.5]); Oc(t, .14, GL('#fff3a0', .9), [-.5, 1.5, 0]); }
  } },
  buzzlet: { slot: 'back', name: 'buzzy wings', b(g, F) {
    const w = TR('#dff4ff', .55), k = [.5, 1, 1.15][F];
    for (const s of [-1, 1]) { Gm(g, .42 * k, w, [s * .36 * k, .3 * k, 0], [.75, .08, 1.3], [.3, s * .5, s * .55]); if (F === 2) Gm(g, .3, w, [s * .3, .18, -.42], [.7, .08, 1.2], [.2, s * .9, s * .4]); }
  } },
  voltvole: { slot: 'top', name: 'a spark tuft', b(g, F) {
    const y = GL('#ffd21f', .6), k = [.6, .85, 1.1][F];
    for (const [x, r, h] of [[0, 0, .5], [-.15, .5, .36], [.15, -.5, .36]].slice(0, F + 1)) Co(g, [.11 * k, h * k, 4], y, [x * k, h * k / 2 - .05, 0], [0, 0, r]);
  } },
  glimmoth: { slot: 'back', name: 'glowing wings', b(g, F) {
    if (!F) { for (const s of [-1, 1]) Gm(g, .16, GL('#9fe8c8', .5), [s * .22, .08, 0], [1, .3, 1]); return; }
    const k = F === 2 ? 1.25 : .75;
    for (const s of [-1, 1]) {
      const w = Grp(g, [s * .12, .1, 0], [.35, 0, -s * .5], k);
      Oc(w, .62, GL('#9fe8c8', .45), [s * .58, .25, 0], [1, .9, .06]); Oc(w, .2, GL('#fff3a0', .8), [s * .6, .3, .03], [1, 1, .1]);
      if (F === 2) { Oc(w, .42, GL('#c9b5ff', .45), [s * .42, -.3, -.03], [1, .9, .06]); Oc(w, .12, GL('#fff3a0', .8), [s * .44, -.3, .01], [1, 1, .1]); }
    }
  } },
  pebblet: { slot: 'back', name: 'pebble spines', b(g, F) {
    const n = [3, 6, 9][F], cs = ['#a9a6b0', '#8a8794', '#c4c1c9'];
    for (let i = 0; i < n; i++) { const row = i % 3 - 1, col = Math.floor(i / 3); const p = [row * .34, .08 - Math.abs(row) * .12 - col * .06, -col * .36]; Gm(g, .2 + (i % 2) * .05, cs[i % 3], p, [1, 1.15, 1], [i, i * 2, 0]); if (F === 2 && i % 2 === 0) Oc(g, .11, GL('#8fe3ff', .6), [p[0], p[1] + .28, p[2]], [1, 1.8, 1]); }
  } },
  cragcrab: { slot: 'back', name: 'a boulder shell', b(g, F) {
    const r = [.42, .68, .9][F];
    Gm(g, r, '#9a97a3', [0, r * .55, -.1], [1.1, .85, 1], [.4, .7, 0]); Gm(g, r * .5, '#b5b2bd', [r * .5, r * .9, -.2], null, [1, 2, 0]);
    if (F === 2) { Sp(g, r * .5, '#6cc24f', [-.25, r * 1.15, 0], [1.3, .35, 1.2]); flower(g, [-.3, r * 1.34, .1], '#fff1a8', 1.1); Gm(g, .2, '#86cc5a', [.35, r * 1.2, .2], [1, .5, 1]); }
  } },
  dustmole: { slot: 'top', name: 'a hard hat', b(g, F) {
    const k = [1.05, .95, 1][F];
    Sp(g, .5 * k, '#ffc93c', [0, -.06, 0], [1, .72, 1]); Cy(g, [.6 * k, .6 * k, .06, 8], '#f0b320', [0, -.1, .1]); Bx(g, [.12, .34 * k, .7 * k], '#f0b320', [0, .12, 0]);
    if (F === 2) { Cy(g, [.13, .15, .12, 6], '#6d6a75', [0, .1, .46], [PI / 2, 0, 0]); Cy(g, [.1, .1, .04, 6], GL('#fff6c0', 1), [0, .1, .53], [PI / 2, 0, 0]); }
  } },
  geodeer: { slot: 'top', name: 'crystal antlers', b(g, F) {
    const c = GL('#8fe3ff', .5), c2 = GL('#c9b5ff', .5);
    for (const s of [-1, 1]) {
      const a = Grp(g, [s * .26, -.08, -.05], [0, 0, -s * .35]);
      if (!F) { Oc(a, .11, c, [0, .1, 0], [1, 1.5, 1]); continue; }
      Oc(a, .13, c, [0, .32, 0], [1, 3, 1]); Oc(a, .1, c2, [s * .16, .42, 0], [1, 2.2, 1], [0, 0, -s * .7]);
      if (F === 2) { Oc(a, .12, c, [-s * .04, .78, 0], [1, 2.8, 1], [0, 0, s * .2]); Oc(a, .1, c2, [s * .22, .86, 0], [1, 2.2, 1], [0, 0, -s * .8]); Oc(a, .08, c, [-s * .2, .6, 0], [1, 2, 1], [0, 0, s * .9]); }
    }
  } },
};

// ---------- bodies ----------
// Each returns anchors: head { p, r }, body { p, r: [rx, ry, rz] }, top, tail, back. X.own(slot) is false when a
// borrowed part takes that place; X.sig(pos, k) builds the species' own signature part there.
const BODY = {
  mossbun(g, F, K, X) {
    const A = F === 0 ? { head: { p: [0, .8, 0], r: .8 }, body: { p: [0, .8, 0], r: [.8, .74, .78] } }
      : F === 1 ? { head: { p: [0, 1.22, .22], r: .68 }, body: { p: [0, .56, -.2], r: [.62, .54, .7] } }
        : { head: { p: [0, 1.5, .28], r: .7 }, body: { p: [0, .7, -.22], r: [.78, .68, .86] } };
    const h = A.head, b = A.body;
    if (F) Sp(g, 1, K.a, b.p, b.r);
    Sp(g, h.r, K.a, h.p, [1.05, .93, .98]);
    feet(g, K.a, F ? .36 : .4, F ? .42 : .55, [.3, .18, .42]);
    Sp(g, [.22, .26, .36][F], K.b, [0, [.4, .5, .7][F], b.p[2] - b.r[2] * .95]);
    if (F === 0) leaf(g, [0, h.p[1] + h.r * .95, .1], [.5, 0, 0], .9);
    if (F === 1) for (const [x, z] of [[0, 0], [-.25, -.2], [.25, -.2]]) Gm(g, .26, '#5fb04a', [x, b.p[1] + b.r[1] * .9, b.p[2] - .1 + z], [1, .5, 1]);
    if (F === 2) { for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; Gm(g, .3, i % 2 ? '#86cc5a' : '#5fb04a', [Math.sin(a) * .66, 1.06 + Math.cos(a * 2) * .04, .08 + Math.cos(a) * .6], [1, .8, 1], [a, a, 0]); } flower(g, [-.5, 1.3, .5], '#ffffff', 1.3, [.9, 0, .5]); flower(g, [.55, 1.22, .42], '#ff9ec4', 1.1, [.9, 0, -.5]); }
    face(g, X.eyes, h.p, h.r, { eye: [1.25, 1.1, 1][F] });
    A.top = [0, h.p[1] + h.r * .86, h.p[2]]; A.tail = [0, .5, b.p[2] - b.r[2]]; A.back = [0, b.p[1] + b.r[1] * .9, b.p[2] - .1];
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  sproutle(g, F, K, X) { // a wide domed shell, a head that pokes out front
    const w = [.75, .9, 1.05][F], shell = '#7a9a52', A = { head: { p: [0, [.62, .7, .8][F], w * .95], r: [.5, .48, .5][F] }, body: { p: [0, .62, -.1], r: [w, w * .72, w * 1.05] } };
    Cy(g, [w * 1.02, w * 1.06, .22, 8], K.b, [0, .34, -.1]);
    Sp(g, 1, shell, [0, .42, -.1], [w, w * .78, w * 1.05]);
    for (let i = 0; i < [0, 5, 6][F]; i++) { const a = i / 6 * PI * 2; Gm(g, .2, '#5f7f3f', [Math.sin(a) * w * .6, .42 + w * .62, -.1 + Math.cos(a) * w * .62], [1.3, .3, 1.3]); }
    Sp(g, A.head.r, K.a, A.head.p);
    for (const s of [-1, 1]) for (const z of [w * .55, -w * .75]) Bx(g, [.3, .3, .34], K.a, [s * w * .82, .15, z]);
    Co(g, [.12, .34, 4], K.a, [0, .3, -w * 1.12], [-1.9, 0, 0]);
    if (F === 2) for (const s of [-1, 1]) Gm(g, .2, '#86cc5a', [s * w * .7, .9, -.5], [1, .5, 1]);
    face(g, X.eyes, A.head.p, A.head.r, { eye: [1.3, 1.15, 1.05][F], nose: null });
    A.top = [0, .42 + w * .76, -.1]; A.tail = [0, .35, -w * 1.15]; A.back = [0, .42 + w * .7, -.35]; A.fs = [.8, 1, 1.1][F];
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  petalpuff(g, F, K, X) { // a woolly cloud on thin legs with a dark little face
    const r = [.66, .78, .9][F], y = [.78, 1, 1.18][F], skin = '#6b5560', A = { head: { p: [0, y + .06, r * .78], r: [.44, .46, .5][F] }, body: { p: [0, y, -.1], r: [r, r * .9, r * 1.05] } };
    legs4(g, skin, r * .45, r * .35, -r * .55, y - r * .5, .16);
    Sp(g, 1, K.a, A.body.p, A.body.r);
    for (let i = 0; i < [5, 8, 11][F]; i++) { const a = i * 2.4, e = .5 + (i % 4) * .5; Sp(g, r * .42, i % 2 ? K.a : K.b, [Math.sin(a) * Math.sin(e) * r * .8, y + Math.cos(e) * r * .7, -.1 + Math.cos(a) * Math.sin(e) * r * .9], null, 0); }
    Sp(g, A.head.r, skin, A.head.p, [1, .95, .9]);
    Sp(g, A.head.r * .62, K.a, [0, A.head.p[1] + A.head.r * .72, A.head.p[2] - .08], [1.3, .7, 1]);
    for (const s of [-1, 1]) Bx(g, [.3, .12, .16], skin, [s * (A.head.r + .1), A.head.p[1] + .05, A.head.p[2] - .1], [0, 0, -s * .5]);
    if (F === 2) for (const s of [-1, 1]) { Cy(g, [.09, .12, .4, 5], '#f1dfb8', [s * .5, A.head.p[1] + .42, A.head.p[2] - .2], [0, 0, -s * 1.1]); Gm(g, .13, '#f1dfb8', [s * .72, A.head.p[1] + .4, A.head.p[2] - .1]); }
    face(g, X.eyes, A.head.p, A.head.r, { eye: [1.3, 1.15, 1.05][F], nose: '#ffb3c8', blush: '#ff7a9a' });
    A.top = [0, A.head.p[1] + A.head.r * 1.05, A.head.p[2] - .1]; A.tail = [0, y, -.1 - r * 1.05]; A.back = [0, y + r * .85, -.2]; A.fs = [.7, .85, 1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  truffowl(g, F, K, X) { // a tall egg with huge eye discs under a mushroom cap
    const r = [.66, .74, .8][F], hgt = [1, 1.2, 1.35][F], y = r * hgt, A = { head: { p: [0, y * 1.12, .05], r: r * .95 }, body: { p: [0, y, 0], r: [r, y, r * .95] } };
    Sp(g, 1, K.a, [0, y, 0], [r, y, r * .95]);
    Sp(g, r * .7, K.b, [0, y * .62, r * .42], [1, 1.1, .7]);
    for (let i = 0; i < F * 2; i++) Oc(g, .08, K.a, [(i % 2 ? 1 : -1) * .16, y * (.75 - (i >> 1) * .22), r * .92], [1.3, .7, .5]);
    for (const s of [-1, 1]) {
      Cy(g, [r * .36, r * .36, .06, 8], K.b, [s * r * .36, y * 1.18, r * .78], [PI / 2 - .1, 0, 0]);
      const wv = [0, .25, .7][F]; Oc(g, r * .75, mix(K.a, '#5b3a34', .25), [s * (r * .95 + wv * .18), y * .92, -.05], [.22 + wv * .25, [.7, .9, 1.05][F], .7], [0, 0, s * (.12 + wv * .55)]);
      Bx(g, [.2, .1, .3], '#f0a23c', [s * .24, .05, .3]);
      if (F) Co(g, [.12, .3 + F * .1, 4], K.a, [s * r * .62, y * 2 - .2, 0], [0, 0, -s * .5]);
    }
    Co(g, [.1, .2, 4], '#f0a23c', [0, y * 1.06, r * .98], [PI / 2 + .5, 0, 0]);
    face(g, X.eyes, [0, y * 1.14, .02], r, { gap: .36, eye: [1.5, 1.4, 1.3][F], nose: null, mouth: false, y: .04 });
    A.top = [0, y * 1.96, 0]; A.tail = [0, y * .4, -r * .9]; A.back = [0, y * 1.5, -r * .6]; A.fs = [.9, .95, 1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  cindercub(g, F, K, X) { // a fox: baby sits as a ball, later it stands on four legs with a long snout
    const dark = '#5b3a34';
    let A;
    if (F === 0) {
      A = { head: { p: [0, .98, .12], r: .66 }, body: { p: [0, .42, -.1], r: [.5, .44, .5] }, tail: [0, .3, -.55] };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, .3, K.b, [0, .4, .3], [1, 1, .6]); feet(g, dark, .3, .32, [.22, .16, .3]);
    } else {
      const L = F === 1 ? .62 : .82, by = F === 1 ? .78 : 1;
      A = { head: { p: [0, by + .55, L * .9], r: F === 1 ? .6 : .58 }, body: { p: [0, by, -.05], r: [.46, .44, L] }, tail: [0, by + .1, -L - .05] };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, .36, K.b, [0, by - .12, L * .5], [1, 1, 1.2]);
      legs4(g, dark, .28, L * .55, -L * .6, by - .25, .2);
      if (F === 2) for (let i = 0; i < 5; i++) Co(g, [.16, .4, 4], K.b, [(i - 2) * .16, by + .12 - Math.abs(i - 2) * .05, L * .78], [2.4, 0, (2 - i) * .3]);
    }
    const h = A.head;
    Sp(g, h.r, K.a, h.p, [1.08, .92, .95]);
    Sp(g, h.r * .42, K.b, [0, h.p[1] - h.r * .28, h.p[2] + h.r * .72], [1.2, .75, 1.1 + F * .25]);
    for (const s of [-1, 1]) { const e = Grp(g, [s * h.r * .62, h.p[1] + h.r * .6, h.p[2] - .05], [0, 0, -s * .3]); Co(e, [.28, .5 + F * .14, 4], K.a, [0, .28, 0], [0, PI / 4, 0], [1, 1, .6]); Co(e, [.14, .26 + F * .08, 4], dark, [0, .46 + F * .1, 0], [0, PI / 4, 0], [1, 1, .62]); if (F === 2) Oc(e, .07, K.b, [s * .12, .2, .1], [1, 2, 1]); }
    face(g, X.eyes, [h.p[0], h.p[1] + .04, h.p[2]], h.r, { eye: [1.3, 1.15, 1][F], nose: '#3b2f3a' });
    A.top = [0, h.p[1] + h.r * .85, h.p[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .9, -.15];
    if (X.own('tail')) X.sig(A.tail);
    return A;
  },
  toastoad(g, F, K, X) { // baby is a round bread roll; it grows into a square slice of toast with a crust
    const crust = mix(K.a, '#7a4a22', .55);
    let A;
    if (F === 0) { A = { head: { p: [0, .55, .1], r: .62 }, body: { p: [0, .55, 0], r: [.75, .52, .7] } }; Sp(g, 1, K.a, A.body.p, A.body.r); Bx(g, [.5, .04, .06], crust, [0, 1.02, 0], [0, .5, 0]); }
    else {
      const w = F === 1 ? 1.5 : 1.85, hh = F === 1 ? 1.05 : 1.3, d = .8;
      A = { head: { p: [0, hh * .62, d * .32], r: .62 }, body: { p: [0, hh * .55, 0], r: [w / 2, hh / 2, d / 2] } };
      Bx(g, [w, hh, d], crust, [0, hh / 2 + .08, 0]); Bx(g, [w - .2, hh - .16, d + .04], K.a, [0, hh / 2 + .1, 0]);
      for (const s of [-1, 1]) Sp(g, w * .27, crust, [s * w * .25, hh + .05, 0], [1, .6, d * 1.9]);
      if (F === 2) { for (let i = 0; i < 4; i++) Co(g, [.12, .26, 4], crust, [(i - 1.5) * .34, hh + .32, -.2]); for (const s of [-1, 1]) Bx(g, [.04, .3, .04], '#ffffff', [s * .5, hh + .7, 0], [0, 0, s * .2]); }
    }
    const b = A.body;
    for (const s of [-1, 1]) { Bx(g, [.34, .16, .5], crust, [s * b.r[0] * .8, .08, .3], [0, -s * .4, 0]); if (!F) Sp(g, .2, K.a, [s * .34, b.p[1] + b.r[1], .22]); }
    if (F) { Bx(g, [.5, .05, .04], INK, [0, b.p[1] - .12, b.r[2] + .05]); for (const s of [-1, 1]) Bx(g, [.05, .12, .04], INK, [s * .26, b.p[1] - .07, b.r[2] + .05], [0, 0, -s * .5]); face(g, X.eyes, [0, b.p[1] + .16, b.r[2] + .06 - .62], .7, { gap: .52, y: .1, eye: [1, 1.25, 1.15][F], nose: null, mouth: false }); }
    else { Bx(g, [.6, .04, .04], INK, [0, .38, .62]); face(g, X.eyes, [0, b.p[1] + b.r[1] - .02, .05], .5, { gap: .68, y: .06, z: .78, eye: 1.25, nose: null, mouth: false }); }
    A.top = [0, b.p[1] + b.r[1] + (F ? .16 : .02), -.15]; A.tail = [0, .3, -b.r[2]]; A.back = [0, b.p[1] + b.r[1] * .8, -b.r[2] * .8];
    if (X.own('top')) X.sig([A.top[0], A.top[1], .05]);
    return A;
  },
  flickit(g, F, K, X) { // hatches still wearing its eggshell, then a chick, then a proud little bird
    let A;
    if (F === 0) { A = { head: { p: [0, .78, 0], r: .62 }, body: { p: [0, .78, 0], r: [.62, .62, .62] } }; Sp(g, .62, K.a, A.head.p); Cy(g, [.66, .42, .5, 7], '#fff6e0', [0, .3, 0]); for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; Co(g, [.16, .22, 3], '#fff6e0', [Math.sin(a) * .58, .62, Math.cos(a) * .58]); } }
    else {
      const r = F === 1 ? .7 : .62, by = F === 1 ? .9 : .85;
      A = { head: { p: [0, F === 1 ? by + .1 : 1.75, F === 1 ? .1 : .2], r: F === 1 ? .7 : .52 }, body: { p: [0, by, -.05], r: [r, r * .95, r * 1.05] } };
      Sp(g, 1, K.a, A.body.p, A.body.r);
      if (F === 2) { Cy(g, [.24, .34, .5, 6], K.a, [0, 1.38, .12]); Sp(g, .52, K.a, A.head.p); Sp(g, .4, K.b, [0, .82, .36], [1, 1, .7]); for (let i = 0; i < 3; i++) flame(g, [(i - 1) * .22, .9, -.6], .55, [-1.1, 0, (1 - i) * .4]); }
      for (const s of [-1, 1]) { Oc(g, .4, mix(K.a, '#e08a1c', .45), [s * (r + .02), by, -.05], [.3, F === 2 ? 1.1 : .7, F === 2 ? 1.3 : .9], [.4, 0, s * .2]); Cy(g, [.04, .04, .3, 4], '#f0a23c', [s * .22, .15, 0]); Bx(g, [.2, .05, .28], '#f0a23c', [s * .22, .025, .08]); }
    }
    const h = A.head;
    Co(g, [.13, .26, 4], '#f0a23c', [0, h.p[1] - h.r * .12, h.p[2] + h.r * .98], [PI / 2, 0, 0], [1.2, 1, .8]);
    face(g, X.eyes, h.p, h.r, { eye: [1.3, 1.15, 1.1][F], nose: null, mouth: false, y: .1 });
    A.top = [0, h.p[1] + h.r * .92, h.p[2] - .05]; A.tail = [0, A.body.p[1], -A.body.r[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .85, -.3]; A.fs = [.9, 1, .9][F];
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  magmutt(g, F, K, X) { // a chunky puppy made of blocks, with rock plates and glowing cracks
    const rock = '#4a3f45', lava = GL('#ff7a2c', .8), L = [.5, .68, .85][F], by = [.6, .78, .95][F];
    const A = { head: { p: [0, by + [.42, .5, .58][F], L * .85], r: [.62, .62, .64][F] }, body: { p: [0, by, -.05], r: [.52, .46, L] } };
    Bx(g, [1, .86, L * 2], K.a, [0, by, -.05]);
    legs4(g, rock, .34, L * .6, -L * .7, by - .3, .3);
    const h = A.head;
    Bx(g, [h.r * 1.9, h.r * 1.6, h.r * 1.6], K.a, h.p); Bx(g, [h.r * 1.05, h.r * .62, .4], K.b, [0, h.p[1] - h.r * .36, h.p[2] + h.r * .85]);
    for (const s of [-1, 1]) { Bx(g, [.3, .5 + F * .08, .16], rock, [s * h.r * .98, h.p[1] + h.r * .25, h.p[2] - .1], [0, 0, s * .25]); Bx(g, [.04, .34, .07], lava, [s * .505, by + .05, L * .35], [s * .6, 0, 0]); Bx(g, [.04, .26, .07], lava, [s * .505, by - .05, -L * .4], [-s * .7, 0, 0]); if (F === 2) Co(g, [.12, .4, 4], rock, [s * .42, h.p[1] + h.r * 1.02, h.p[2] - .05], [0, 0, -s * .3]); }
    Gm(g, .2 + F * .06, rock, [0, h.p[1] + h.r * .8, h.p[2] + .1], [1.2, .6, 1]);
    if (F === 2) for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; Gm(g, .22, rock, [Math.sin(a) * .58, by + .42 + Math.cos(a) * .1, L * .5 + Math.cos(a) * .12], null, [a, a, 0]); }
    const t = Grp(g, [0, by + .2, -L - .1], [-.7, 0, 0]); Bx(t, [.2, .2, .5 + F * .15], rock, [0, 0, -.2]); Gm(t, .16 + F * .05, lava, [0, 0, -.5 - F * .15]);
    face(g, X.eyes, [0, h.p[1] + .05, h.p[2] - .1], h.r * 1.05, { z: .92, eye: [1.3, 1.15, 1.05][F], nose: '#2b2230', gap: .4 });
    A.top = [0, h.p[1] + h.r * .8, h.p[2]]; A.tail = [0, by + .2, -L - .1]; A.back = [0, by + .44, -.1]; A.fs = [.8, .95, 1.1][F];
    if (X.own('back')) X.sig(A.back, A.fs);
    return A;
  },
  puddlepup(g, F, K, X) { // a seal lying on its tummy; a fluffy white ball as a baby
    let A;
    if (F === 0) { A = { head: { p: [0, .72, .1], r: .7 }, body: { p: [0, .7, 0], r: [.78, .68, .8] }, tail: [0, .3, -.75] }; Sp(g, 1, K.a, A.body.p, A.body.r); for (let i = 0; i < 6; i++) { const a = i * 1.05; Gm(g, .22, '#ffffff', [Math.sin(a) * .62, .8 + (i % 2) * .3, -.25 + Math.cos(a) * .4]); } }
    else {
      const L = F === 1 ? .95 : 1.2;
      A = { head: { p: [0, F === 1 ? .95 : 1.25, L * .55], r: .62 }, body: { p: [0, .55, -.1], r: [.66, .5, L] }, tail: [0, .42, -L - .05] };
      Cy(g, [L + .25, L + .25, .05, 8], TR('#7cc4ee', .8), [0, .03, 0]);
      Sp(g, 1, K.a, A.body.p, A.body.r);
      if (F === 2) { Sp(g, .5, K.a, [0, .9, L * .4], [1, 1.2, 1]); for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; Co(g, [.14, .34, 4], '#7cc4ee', [Math.sin(a) * .62, .88, L * .42 + Math.cos(a) * .58], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2]); } for (let i = 0; i < 5; i++) { const a = i * 1.3; Oc(g, .07, '#bfe6fb', [Math.sin(a) * (L + .1), .16, Math.cos(a) * (L + .1)], [1, 1.8, 1]); } }
      Sp(g, .62, K.a, A.head.p);
    }
    const h = A.head;
    for (const s of [-1, 1]) { Bx(g, [.5, .12, .34], K.b, [s * (A.body.r[0] + .12), .2, .3], [0, s * .4, -s * .4]); Bx(g, [.2, .015, .015], '#8a9aa6', [s * h.r * .92, h.p[1] - h.r * .12, h.p[2] + h.r * .75], [0, -s * .5, s * .12]); Bx(g, [.2, .015, .015], '#8a9aa6', [s * h.r * .92, h.p[1] - h.r * .24, h.p[2] + h.r * .75], [0, -s * .5, -s * .12]); }
    Sp(g, h.r * .36, K.b, [0, h.p[1] - h.r * .22, h.p[2] + h.r * .78], [1.3, .8, .8]);
    face(g, X.eyes, [h.p[0], h.p[1] + .03, h.p[2]], h.r, { eye: [1.35, 1.2, 1.05][F], nose: '#2b2230', z: .93 });
    A.top = [0, h.p[1] + h.r * .9, h.p[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .9, -.3];
    if (X.own('tail')) X.sig(A.tail);
    return A;
  },
  bubblefin(g, F, K, X) { // a flat-sided fish floating inside its bubble
    const r = [.52, .68, .8][F], y = [1, 1.15, 1.3][F], fin = mix(K.a, '#ff7a1c', .5);
    const A = { head: { p: [0, y, .12], r: r * .95 }, body: { p: [0, y, 0], r: [r * .72, r, r * 1.1] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, r * .7, K.b, [0, y - r * .3, .1], [.74, .7, 1.2]);
    const tk = [.5, .8, 1.2][F];
    for (const s of [-1, 1]) { Co(g, [.3 * tk, .6 * tk, 4], fin, [0, y + s * .2 * tk, -r * 1.1 - .2 * tk], [PI / 2 + s * .5, 0, 0], [.2, 1, 1]); Co(g, [.2, .4 + F * .1, 4], fin, [s * r * .72, y - .1, .1], [0, 0, s * 1.9], [1, 1, .25]); }
    if (F === 2) for (let i = 0; i < 3; i++) Sp(g, .13 - i * .02, TR('#dff4ff', .6), [(i - 1) * .3, y + r + .5 + (i % 2) * .16, .1]);
    Sp(g, r * 1.75, TR('#cfeeff', .26), [0, y, -.05]);
    Gm(g, .1, '#ffffff', [-r, y + r, r * .9], [1.6, .6, .4], [0, 0, .7]);
    face(g, X.eyes, [0, y + .02, .1], r * 1.06, { gap: .3, eye: [1.4, 1.25, 1.15][F], nose: null, z: .93 });
    A.top = [0, y + r * .96, .05]; A.tail = [0, y, -r * 1.1]; A.back = [0, y + r * .88, -.15]; A.fs = [.7, .9, 1][F];
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  axolily(g, F, K, X) { // a long low body, a wide smiling head, feathery gills
    const L = [.5, .8, 1.05][F], hr = [.62, .64, .68][F], A = { head: { p: [0, .62, L * .7], r: hr }, body: { p: [0, .42, -.15], r: [.42, .36, L] } };
    Sp(g, 1, K.a, A.body.p, A.body.r);
    Sp(g, hr, K.a, A.head.p, [1.25, .85, 1]);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) { const gk = [.6, .9, 1.15][F]; Co(g, [.09, .46 * gk, 4], '#ff8fb0', [s * (hr * 1.2 + .1), .62 + (i - 1) * .24, L * .7 - .12], [0, 0, -s * (1.57 - (i - 1) * .6)]); if (F) Gm(g, .1, '#5fb04a', [s * (hr * 1.2 + .3 * gk), .62 + (i - 1) * .36 * gk, L * .7 - .12], [1.3, .3, 1.3]); }
      for (const z of [L * .3, -L * .6]) Bx(g, [.34, .12, .2], K.a, [s * .5, .08, z], [0, s * .3, 0]);
    }
    const t = Grp(g, [0, .4, -L - .1], [0, 0, 0]); Co(t, [.3, .9 + F * .3, 4], K.a, [0, 0, -.35 - F * .12], [-PI / 2, 0, 0], [.4, 1, 1]); Co(t, [.26, .8 + F * .3, 4], '#ff8fb0', [0, .14, -.35 - F * .12], [-PI / 2, 0, 0], [.1, 1, 1.4]);
    face(g, X.eyes, [0, .68, L * .7], hr, { gap: .55, eye: [1.15, 1.05, 1][F], nose: null, y: .1, z: .84 });
    A.top = [0, .62 + hr * .82, L * .7]; A.tail = [0, .45, -L]; A.back = [0, .76, -.2]; A.fs = [.8, .95, 1.05][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  nimbowhale(g, F, K, X) { // a tiny whale that swims through the air under its own cloud
    const r = [.6, .76, .92][F], y = [.9, 1.05, 1.2][F], A = { head: { p: [0, y, r * .35], r: r * .98 }, body: { p: [0, y, -.1], r: [r, r * .82, r * 1.3] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, y - r * .2, 0], [r * .93, r * .66, r * 1.22]);
    const t = Grp(g, [0, y + .05, -r * 1.25], [.5, 0, 0]); Co(t, [r * .4, r * .9, 5], K.a, [0, 0, -r * .3], [-PI / 2, 0, 0]);
    for (const s of [-1, 1]) { Bx(t, [r * .6, .1, r * .42], K.a, [s * r * .32, 0, -r * .85], [0, s * .5, 0]); Bx(g, [r * .7, .1, r * .4], K.a, [s * r * 1.05, y - r * .35, .1], [0, s * .3, -s * .5]); }
    face(g, X.eyes, [0, y + .02, r * .32], r, { gap: .5, eye: [1.2, 1.1, 1][F], nose: null, y: -.05, z: .86 });
    A.top = [0, y + r * .82, 0]; A.tail = [0, y, -r * 1.3]; A.back = [0, y + r * .8, -.3]; A.fs = [.8, 1, 1.25][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  zapkit(g, F, K, X) { // a kitten: baby is all head, then it sits up tall with a zigzag tail
    const dark = mix(K.a, '#5a4a3a', .7);
    const A = F === 0 ? { head: { p: [0, .78, .05], r: .74 }, body: { p: [0, .4, -.2], r: [.45, .36, .5] } }
      : { head: { p: [0, F === 1 ? 1.38 : 1.7, .12], r: F === 1 ? .64 : .62 }, body: { p: [0, F === 1 ? .6 : .72, -.1], r: F === 1 ? [.5, .6, .5] : [.52, .76, .55] } };
    const h = A.head, b = A.body;
    Sp(g, 1, K.a, b.p, b.r); if (F) { Sp(g, b.r[0] * .7, K.b, [0, b.p[1] + .05, b.r[2] * .55], [1, 1.2, .7]); for (const s of [-1, 1]) Bx(g, [.2, b.p[1], .22], K.a, [s * .24, b.p[1] / 2, b.r[2] * .8]); }
    feet(g, K.b, .26, F ? b.r[2] * .95 : .5, [.22, .14, .26]);
    Sp(g, h.r, K.a, h.p, [1.1, .9, .95]);
    for (const s of [-1, 1]) { const e = Grp(g, [s * h.r * .66, h.p[1] + h.r * .62, h.p[2]], [0, 0, -s * .25]); Co(e, [.26, .46, 4], K.a, [0, .2, 0], [0, PI / 4, 0], [1, 1, .6]); Co(e, [.14, .28, 4], '#f59ab0', [0, .16, .06], [0, PI / 4, 0], [1, 1, .5]); if (F === 2) Co(e, [.06, .32, 3], dark, [0, .56, 0]); Bx(g, [.34, .02, .02], dark, [s * h.r * .95, h.p[1] - h.r * .2, h.p[2] + h.r * .6], [0, -s * .5, s * .15]); }
    for (let i = 0; i < F + 1; i++) Bx(g, [.1, .04, .22], dark, [(i - F / 2) * .2, h.p[1] + h.r * .84, h.p[2] + .22]);
    if (F === 2) Oc(g, .16, GL('#ffd21f', .6), [0, b.p[1] + .35, b.r[2] * .95], [1, 1.3, .5]);
    face(g, X.eyes, h.p, h.r, { eye: [1.35, 1.2, 1.1][F] });
    A.top = [0, h.p[1] + h.r * .84, h.p[2]]; A.tail = [.2, .25, b.p[2] - b.r[2] * .9]; A.back = [0, b.p[1] + b.r[1] * .7, b.p[2] - b.r[2] * .6];
    if (X.own('tail')) X.sig(A.tail);
    return A;
  },
  buzzlet(g, F, K, X) { // a striped bee: a wingless grub first, then airborne, then a fuzzy queen
    const r = [.6, .66, .76][F], y = [.6, 1.15, 1.3][F], stripe = '#4a3a32';
    const A = { head: { p: [0, y + .06, r * .6], r: r * .92 }, body: { p: [0, y, -r * .3], r: [r * .95, r * .9, r * 1.25] } };
    Sp(g, 1, K.a, A.body.p, A.body.r);
    for (let i = 0; i < 2; i++) Cy(g, [r * (.93 - i * .16), r * (.99 - i * .2), r * .26, 8], stripe, [0, y, -r * (.5 + i * .5)], [PI / 2, 0, 0], [.97, 1, .93]);
    Sp(g, A.head.r, K.a, A.head.p);
    Co(g, [.12, .3 + F * .08, 4], F === 2 ? GL('#ffd21f', .7) : stripe, [0, y - .05, -r * 1.55], [-PI / 2, 0, 0]);
    for (const s of [-1, 1]) { Cy(g, [.02, .02, .36, 3], stripe, [s * .2, A.head.p[1] + A.head.r + .1, A.head.p[2] + .1], [.3, 0, -s * .3]); Gm(g, .08, F ? GL('#ffd21f', .6) : stripe, [s * .26, A.head.p[1] + A.head.r + .28, A.head.p[2] + .16]); if (!F) for (let i = 0; i < 3; i++) Bx(g, [.16, .14, .16], stripe, [s * r * .6, .07, r * .3 - i * r * .5]); }
    if (F === 2) for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; Gm(g, .2, '#fff3c4', [Math.sin(a) * r * .8, y + .02 + Math.cos(a) * r * .78, r * .05], null, [a, 0, a]); }
    face(g, X.eyes, A.head.p, A.head.r, { eye: [1.3, 1.2, 1.1][F], nose: null });
    A.top = [0, A.head.p[1] + A.head.r * .9, A.head.p[2]]; A.tail = [0, y, -r * 1.5]; A.back = [0, y + r * .8, -r * .3]; A.fs = [.8, .9, 1][F];
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  voltvole(g, F, K, X) { // a pear-shaped hamster standing up, with cheeks that glow
    const r = [.66, .76, .86][F], hgt = [1, 1.12, 1.2][F], y = r * hgt, A = { head: { p: [0, y * 1.25, .08], r: r * .86 }, body: { p: [0, y * .8, 0], r: [r, y * .8, r * .92] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, A.head.r, K.a, A.head.p, [1.08, .95, 1]);
    Sp(g, r * .66, K.b, [0, y * .66, r * .4], [1, 1.15, .7]);
    const ck = [.2, .26, .33][F];
    for (const s of [-1, 1]) {
      Sp(g, ck, GL('#ffcf5a', [.2, .35, .6][F]), [s * A.head.r * .82, A.head.p[1] - A.head.r * .3, A.head.p[2] + A.head.r * .42]);
      Cy(g, [.2, .2, .08, 7], K.a, [s * A.head.r * .7, A.head.p[1] + A.head.r * .78, A.head.p[2]], [PI / 2, 0, 0]); Cy(g, [.12, .12, .09, 7], '#f59ab0', [s * A.head.r * .7, A.head.p[1] + A.head.r * .78, A.head.p[2] + .01], [PI / 2, 0, 0]);
      Bx(g, [.18, .12, .2], '#f3c9b5', [s * r * .5, y * .9, r * .82], [.4, 0, 0]); Bx(g, [.26, .12, .34], '#f3c9b5', [s * r * .45, .06, r * .5]);
      if (F === 2) for (let i = 0; i < 2; i++) Bx(g, [.05, .24, .05], GL('#fff3a0', .9), [s * (A.head.r * .82 + ck + .12 + i * .12), A.head.p[1] - A.head.r * .3 + (i ? .2 : -.12), A.head.p[2] + .3], [0, 0, s * (i ? -.6 : .7)]);
    }
    Sp(g, .16 + F * .04, K.b, [0, .3, -r * .9]);
    face(g, X.eyes, A.head.p, A.head.r, { eye: [1.3, 1.2, 1.1][F], gap: .3 });
    A.top = [0, A.head.p[1] + A.head.r * .86, A.head.p[2]]; A.tail = [0, .3, -r * .9]; A.back = [0, y * 1.2, -r * .7];
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  glimmoth(g, F, K, X) { // a caterpillar, then a cocoon with its head poking out, then a moth with glowing wings
    let A;
    if (F === 0) { A = { head: { p: [0, .62, .75], r: .56 }, body: { p: [0, .42, -.2], r: [.4, .4, .9] } }; for (let i = 0; i < 4; i++) { Sp(g, .44 - i * .04, i % 2 ? K.b : K.a, [0, .42 + (i === 1 ? .12 : 0), .2 - i * .5]); feet(g, '#6b5560', .3, .2 - i * .5, [.14, .12, .14]); } }
    else if (F === 1) { A = { head: { p: [0, 1.55, .12], r: .56 }, body: { p: [0, .8, 0], r: [.56, .8, .56] } }; Sp(g, 1, mix(K.a, '#b9a27c', .5), A.body.p, A.body.r); for (let i = 0; i < 4; i++) Cy(g, [.5 - Math.abs(i - 1.5) * .09, .5 - Math.abs(i - 1.5) * .09, .06, 7], mix(K.a, '#8a744e', .6), [0, .35 + i * .3, 0]); }
    else { A = { head: { p: [0, 1.6, .15], r: .56 }, body: { p: [0, .95, -.05], r: [.42, .62, .42] } }; Sp(g, 1, K.a, A.body.p, A.body.r); for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; Gm(g, .22, K.b, [Math.sin(a) * .42, 1.3, .05 + Math.cos(a) * .4]); } for (const s of [-1, 1]) Bx(g, [.08, .22, .08], '#6b5560', [s * .16, .3, .15], [.3, 0, 0]); }
    const h = A.head;
    Sp(g, h.r, K.a, h.p);
    for (const s of [-1, 1]) { const an = Grp(g, [s * .2, h.p[1] + h.r * .8, h.p[2]], [.2, 0, -s * .4]); Cy(an, [.02, .03, .2 + F * .16, 3], '#6b5560', [0, .1 + F * .08, 0]); if (F === 2) for (let i = 0; i < 3; i++) Bx(an, [.3 - i * .07, .04, .04], GL('#fff3a0', .6), [0, .2 + i * .12, 0]); else Gm(an, .07, GL('#fff3a0', .7), [0, .22 + F * .16, 0]); }
    face(g, X.eyes, h.p, h.r, { eye: [1.4, 1.3, 1.3][F], nose: null });
    A.top = [0, h.p[1] + h.r * .9, h.p[2]]; A.tail = [0, .4, A.body.p[2] - A.body.r[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * (F === 2 ? .45 : .9), A.body.p[2] - A.body.r[2] * (F ? .8 : 0)]; A.fs = .8;
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  pebblet(g, F, K, X) { // a low dome with a pointy snout and tiny feet
    const r = [.62, .8, .98][F], A = { head: { p: [0, r * .62, r * .62], r: r * .7 }, body: { p: [0, r * .68, -.1], r: [r, r * .82, r * 1.1] } };
    Sp(g, 1, K.b, A.body.p, A.body.r); Sp(g, 1, K.a, [0, r * .56, .12], [r * .86, r * .62, r * 1.06]);
    Co(g, [r * .3, r * .5, 5], K.a, [0, r * .45, r * 1.2], [PI / 2, 0, 0]); Gm(g, .09, INK, [0, r * .45, r * 1.46]);
    for (const s of [-1, 1]) { Cy(g, [.13, .13, .06, 6], K.a, [s * r * .5, r * 1.0, r * .5], [PI / 2 - .4, 0, s * .3]); for (const z of [r * .6, -r * .5]) Bx(g, [.2, .14, .26], '#6b5560', [s * r * .55, .07, z]); }
    face(g, X.eyes, [0, r * .7, r * .5], r * .72, { gap: .36, eye: [1.3, 1.15, 1.05][F], nose: null, mouth: false, z: .84 });
    A.top = [0, r * 1.3, .3]; A.tail = [0, r * .4, -r * 1.15]; A.back = [0, r * 1.36, -.02]; A.fs = [.8, 1, 1.2][F];
    if (X.own('back')) X.sig([0, r * 1.36, .12], A.fs);
    return A;
  },
  cragcrab(g, F, K, X) { // wide and flat, eyes on stalks, one claw that outgrows the other
    const w = [.7, .9, 1.05][F], A = { head: { p: [0, .6, w * .3], r: w * .62 }, body: { p: [0, .5, 0], r: [w, .36, w * .7] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, .42, .05], [w * .9, .28, w * .66]);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) Bx(g, [.5, .1, .12], K.a, [s * (w + .1), .22, .15 - i * .32], [0, s * (i - 1) * .4, -s * .7]);
      const big = F === 2 && s === 1 ? 1.7 : 1, c = Grp(g, [s * w * .95, .5, w * .75], [0, -s * .5, 0], (.7 + F * .18) * big);
      Bx(c, [.22, .2, .4], K.a, [0, 0, 0]); Gm(c, .32, K.a, [0, .02, .42], [1, .8, 1.2]); Co(c, [.13, .4, 4], mix(K.a, '#ffffff', .5), [-s * .12, .08, .78], [PI / 2, 0, 0]); Co(c, [.1, .32, 4], mix(K.a, '#ffffff', .5), [s * .14, -.02, .74], [PI / 2, 0, 0]);
      Cy(g, [.04, .04, .3, 4], K.a, [s * w * .3, .92, w * .5]);
    }
    for (const s of [-1, 1]) { const e = Sp(g, .17, '#ffffff', [s * w * .3, 1.12, w * .5]); X.eyes.push(Cy(g, [.09, .09, .05, 6], MX('ink', INK, { roughness: .5 }), [s * w * .3, 1.12, w * .5 + .15], [PI / 2, 0, 0])); e.userData.keep = 1; }
    Bx(g, [.2, .03, .03], INK, [0, .5, w * .7]); for (const s of [-1, 1]) V(g, new THREE.Mesh(G('Circle', .09, 6), MX('blush#ff8a9a', '#ff8a9a', { transparent: true, opacity: .6 })), [s * w * .42, .52, w * .66], [0, s * .4, 0]);
    A.top = [0, .9, 0]; A.tail = [0, .5, -w * .7]; A.back = [0, .72, -.05]; A.fs = 1;
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  dustmole(g, F, K, X) { // an upright capsule with big digging paws; its hat is too big until it grows into it
    const r = [.6, .68, .76][F], hgt = [1.15, 1.35, 1.5][F], y = r * hgt, paw = '#f3c9b5', A = { head: { p: [0, y * 1.35, .05], r: r * .95 }, body: { p: [0, y, 0], r: [r, y, r * .95] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, r * .6, K.b, [0, y * .7, r * .5], [1, 1.2, .6]);
    Co(g, [r * .34, r * .6, 5], paw, [0, y * 1.12, r * .95], [PI / 2, 0, 0]); Gm(g, .1, '#e0708a', [0, y * 1.12, r * 1.28]);
    for (const s of [-1, 1]) { const p = Grp(g, [s * r * .98, y * .95, r * .3], [0, 0, s * .3], .8 + F * .15); Bx(p, [.36, .44, .14], paw, [0, 0, 0]); for (let i = 0; i < 3; i++) Co(p, [.06, .2, 3], '#ffffff', [(i - 1) * .12, -.3, 0], [PI, 0, 0]); Bx(g, [.3, .12, .38], paw, [s * r * .45, .06, r * .5]); if (F === 2) Bx(g, [.34, .03, .03], '#ffffff', [s * r * .5, y * 1.06, r * .98], [0, -s * .4, -s * .25]); }
    if (F === 2) { const pk = Grp(g, [.1, y * 1.05, -r * .95], [0, 0, .6]); Cy(pk, [.04, .04, 1.1, 4], '#8a5a3c', [0, 0, 0]); Bx(pk, [.7, .1, .1], '#8a8794', [0, .5, 0]); }
    face(g, X.eyes, [0, y * 1.3, .05], r * .95, { eye: [.9, .95, .9][F], gap: .34, nose: null, mouth: false, y: .02 });
    A.top = [0, y * 1.35 + r * .78, .05]; A.tail = [0, .3, -r * .9]; A.back = [0, y * 1.5, -r * .7]; A.fs = [1, .95, 1][F];
    if (X.own('top')) X.sig(F === 0 ? [0, A.top[1] - .02, .12] : [0, A.top[1] + .1, 0], r / .68);
    return A;
  },
  geodeer(g, F, K, X) { // a fawn: folded up asleep-style as a baby, then long legs and crystal antlers
    const hoof = '#6b5560', gemc = GL('#8fe3ff', .5);
    let A;
    if (F === 0) { A = { head: { p: [0, .86, .42], r: .58 }, body: { p: [0, .42, -.2], r: [.5, .4, .72] } }; Sp(g, 1, K.a, A.body.p, A.body.r); for (const s of [-1, 1]) { Bx(g, [.16, .14, .5], K.a, [s * .42, .08, .3]); Bx(g, [.16, .14, .16], hoof, [s * .42, .08, .6]); } }
    else {
      const lh = F === 1 ? .7 : 1, L = F === 1 ? .62 : .78, by = lh + .34;
      A = { head: { p: [0, by + (F === 1 ? .8 : 1.05), L * .95], r: .5 }, body: { p: [0, by, -.05], r: [.42, .4, L] } };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, .9, K.b, [0, by - .08, 0], [.4, .36, L * .95]);
      for (const s of [-1, 1]) for (const z of [L * .6, -L * .65]) { Bx(g, [.14, lh, .14], K.a, [s * .26, lh / 2 + .05, z]); Bx(g, [.16, .14, .16], hoof, [s * .26, .07, z]); }
      Cy(g, [.2, .28, F === 1 ? .7 : .95, 6], K.a, [0, by + (F === 1 ? .38 : .5), L * .78], [.45, 0, 0]);
      if (F === 2) { for (let i = 0; i < 5; i++) Oc(g, .12, gemc, [(i % 2 ? .3 : -.3) * (1 - i * .1), by + .3, L * .4 - i * .3], [1, 1.6, 1], [0, 0, (i % 2 ? -.5 : .5)]); Sp(g, .3, K.b, [0, by - .1, L * .9], [1, 1.2, .8]); }
    }
    const h = A.head;
    Sp(g, h.r, K.a, h.p, [1, .95, 1]); Sp(g, h.r * .5, K.b, [0, h.p[1] - h.r * .3, h.p[2] + h.r * .7], [1, .8, 1.2]);
    for (const s of [-1, 1]) { Oc(g, .22, K.a, [s * h.r * 1.05, h.p[1] + h.r * .35, h.p[2] - .1], [1.5, .6, .35], [0, 0, s * .5]); for (let i = 0; i < 2; i++) Gm(g, .07, '#ffffff', [s * (.16 + i * .14), A.body.p[1] + A.body.r[1] * .88, A.body.p[2] - .2 - i * .22], [1, .4, 1]); }
    Sp(g, .16, '#ffffff', [0, A.body.p[1] + .1, A.body.p[2] - A.body.r[2]]);
    face(g, X.eyes, h.p, h.r, { eye: [1.4, 1.25, 1.15][F], nose: '#3b2f3a' });
    A.top = [0, h.p[1] + h.r * .85, h.p[2] - .05]; A.tail = [0, A.body.p[1] + .1, A.body.p[2] - A.body.r[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .9, -.15]; A.fs = .85;
    if (X.own('top')) X.sig(A.top);
    return A;
  },
};

// Natural coats: main colour and second colour (belly, wool tips, flippers).
export const COAT = {
  mossbun: ['#f7ecd0', '#ffffff'], sproutle: ['#bfd98a', '#e6d9a0'], petalpuff: ['#fff6ec', '#ffe3ee'], truffowl: ['#e9d3b0', '#fff3df'],
  cindercub: ['#f59a48', '#fff3df'], toastoad: ['#f1c27a', '#f7dba4'], flickit: ['#ffe27a', '#fff6c8'], magmutt: ['#c96a3c', '#f3c9a0'],
  puddlepup: ['#e6eef4', '#c3d2de'], bubblefin: ['#ffb14a', '#ffe7b8'], axolily: ['#ffc4d6', '#ffe3ec'], nimbowhale: ['#7fb4e6', '#eaf4ff'],
  zapkit: ['#ffe066', '#fff6c8'], buzzlet: ['#ffd23e', '#fff3c4'], voltvole: ['#f2c9a0', '#fff3df'], glimmoth: ['#d9c9f2', '#fff3df'],
  pebblet: ['#d9b89a', '#8a8794'], cragcrab: ['#e2705a', '#f6c9a8'], dustmole: ['#8a6f63', '#c9b0a2'], geodeer: ['#c9b59a', '#f3e6d2'],
};
export const coatOf = (sp, look) => { const n = COAT[sp] || COAT.mossbun, a = look?.coat || n[0]; return { a, b: look?.coat2 || (look?.coat ? mix(a, '#ffffff', .6) : n[1]) }; };

// Markings sit on the body (spots, stripes) or the head (star, patch) and stack.
function markings(g, A, pats, K) {
  const b = A.body, h = A.head, dk = mix(K.a, '#4a342c', .45);
  for (const p of pats || []) {
    if (p === 'spots') for (const [a, e] of [[2.2, .9], [-2.2, .9], [3.14, .5], [1.5, 1.25], [-1.5, 1.25], [2.9, 1.3], [1.2, .7], [-1.1, .65]]) Gm(g, .15 + Math.min(.1, b.r[0] * .08), dk, [b.p[0] + Math.sin(a) * Math.sin(e) * b.r[0] * 1.0, b.p[1] + Math.cos(e) * b.r[1] * 1.0, b.p[2] + Math.cos(a) * Math.sin(e) * b.r[2] * 1.0], [1, .5, 1], [e * Math.cos(a), 0, -e * Math.sin(a)]);
    if (p === 'stripes') for (let i = 0; i < 3; i++) { const z = .1 - i * .32, k = Math.sqrt(1 - z * z) * 1.03; V(g, new THREE.Mesh(G('Torus', 1, .07, 4, 10, PI), M(dk)), [b.p[0], b.p[1], b.p[2] + z * b.r[2]], null, [b.r[0] * k, b.r[1] * k, 1]); }
    if (p === 'star') Oc(g, .17 * h.r / .7, '#fff6c8', [h.p[0], h.p[1] + h.r * .52, h.p[2] + h.r * .8], [1, 1, .3], [-.5, 0, 0]);
    if (p === 'patch') Sp(g, h.r * .5, dk, [h.p[0] + h.r * .5, h.p[1] + h.r * .42, h.p[2] + h.r * .35], [1, .9, .9], 0);
  }
}

const SCALE = [.62, .8, 1];
export function petModel(sp, form = 0, look = null) {
  if (!BODY[sp]) sp = 'mossbun';
  const g = new THREE.Group(), F = Math.max(0, Math.min(2, form | 0)), K = coatOf(sp, look), eyes = [];
  const borrowed = look?.feat && look.feat !== sp && FEAT[look.feat] ? look.feat : null;
  const X = { eyes, own: slot => !borrowed || FEAT[borrowed].slot !== slot, sig: (pos, k = 1) => FEAT[sp].b(Grp(g, pos, null, k), F, K) };
  const A = BODY[sp](g, F, K, X);
  if (borrowed) FEAT[borrowed].b(Grp(g, A[FEAT[borrowed].slot], null, A.fs || 1), F, K);
  markings(g, A, look?.pat, K);
  if (look?.spark) for (let i = 0; i < 5; i++) { const a = i * 1.3; Oc(g, .09, GL('#fff6c8', 1), [Math.sin(a) * 1.1, .5 + i * .38, Math.cos(a) * 1.1], [1, 1.7, 1]); }
  g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  g.scale.setScalar(SCALE[F]);
  g.userData = { eyes, k: SCALE[F], flame: null, flames: [] };
  g.traverse(o => { if (o.userData.flame) { g.userData.flames.push(o); g.userData.flame ||= o; } });
  return g;
}

// An egg: the shell colour comes from one parent and the speckles from the other.
export function eggModel(base = '#fff3df', speck = '#c9a27c') {
  const g = new THREE.Group();
  Sp(g, .5, base, [0, .58, 0], [1, 1.3, 1]);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, e = .5 + (i % 4) * .55; Gm(g, .09, speck, [Math.sin(a) * Math.sin(e) * .49, .58 + Math.cos(e) * .63, Math.cos(a) * Math.sin(e) * .49], [1, .5, 1], [e * Math.cos(a), 0, -e * Math.sin(a)]); }
  return g;
}
export const BODYKEYS = Object.keys(BODY);

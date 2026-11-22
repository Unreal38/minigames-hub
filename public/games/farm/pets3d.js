// Pet Farm pets: every species is built in code from a few flat-shaded shapes, with its own silhouette and
// three growth forms that each look different (not just bigger).
//   petModel(species, form, look) -> THREE.Group facing +Z, standing on y = 0, about 2 units tall as an adult.
//     look (optional, from breeding): { coat, coat2, pat: [...], feat: species, spark }
//     userData = { eyes, k, flame }
//   eggModel(base, speck) -> THREE.Group
// Each species also owns one signature part (ears, tail, cap...) in FEAT, which a baby can borrow from a parent.
import * as THREE from 'three';
import { M, MX, G, toonify } from './models.js';
import { COAT } from './breed.js';

const mat = c => typeof c === 'string' ? M(c) : c;
const V = (p, o, pos, rot, scl) => { if (pos) o.position.set(...pos); if (rot) o.rotation.set(...rot); if (scl) o.scale.set(...(scl.length ? scl : [scl, scl, scl])); p.add(o); return o; };
const Grp = (p, pos, rot, scl) => V(p, new THREE.Group(), pos, rot, scl);
const Bx = (p, s, c, pos, rot) => V(p, new THREE.Mesh(G('Box', ...s), mat(c)), pos, rot);
const Sp = (p, r, c, pos, scl, d = 2) => V(p, new THREE.Mesh(G('Icosahedron', r, d), mat(c)), pos, null, scl);
const Gm = (p, r, c, pos, scl, rot) => V(p, new THREE.Mesh(G('Icosahedron', r, 0), mat(c)), pos, rot, scl);
const Oc = (p, r, c, pos, scl, rot) => V(p, new THREE.Mesh(G('Octahedron', r, 0), mat(c)), pos, rot, scl);
const Cy = (p, a, c, pos, rot, scl) => V(p, new THREE.Mesh(G('Cylinder', ...a), mat(c)), pos, rot, scl);
const Co = (p, a, c, pos, rot, scl) => V(p, new THREE.Mesh(G('Cone', ...a), mat(c)), pos, rot, scl);
const GL = (c, i = .45) => MX('glow' + c + i, c, { emissive: c, emissiveIntensity: i });
const TR = (c, o = .4) => MX('clear' + c + o, c, { transparent: true, opacity: o, depthWrite: false, roughness: .3 });
const _c = new THREE.Color(), _d = new THREE.Color();
export const mix = (a, b, t) => '#' + _c.set(a).lerp(_d.set(b), t).getHexString();
const PI = Math.PI;

const INK = '#2b2230', UP = new THREE.Vector3(0, 1, 0);
// A face on the front of a head of radius r centred at pos. Eyes are remembered so the scene can blink them.
const WH = () => MX('shine', '#ffffff', { emissive: '#ffffff', emissiveIntensity: .9 });
// One eye: a round dark disc with two white glints that blink away with it. Faces +Z; the scene squashes scale.z.
function eyeAt(p, eyes, r, pos, tilt = 0) {
  const e = Cy(p, [r, r, .06, 14], MX('ink', INK, { roughness: .5 }), pos, [PI / 2, 0, tilt]); e.userData.noInk = 1;
  for (const [x, y, k] of [[.36, .36, .34], [-.34, -.38, .17]]) Cy(e, [r * k, r * k, .02, 8], WH(), [x * r, .035, -y * r]).userData.noInk = 1;
  eyes.push(e); return e;
}
function face(p, eyes, pos, r, { gap = .34, y = .05, eye = 1, nose = '#f59ab0', mouth = true, z = .89, blush = '#ff8a9a' } = {}) {
  z = Math.max(z, Math.sqrt(Math.max(0, 1 - gap * gap - y * y)) - .02); // sit on the surface of a round head
  const g = Grp(p, pos, null, r), bl = MX('blush' + blush, blush, { transparent: true, opacity: .55 });
  for (const s of [-1, 1]) {
    eyeAt(g, eyes, .135 * eye, [s * gap, y, z], -s * .3);
    V(g, new THREE.Mesh(G('Circle', .13, 10), bl), [s * (gap + .27), y - .19, z - .1], [0, s * .62, 0], [1.25, .8, 1]);
    if (mouth) Bx(g, [.1, .032, .03], INK, [s * .04, y - .15, z + .055], [0, 0, s * .5]).userData.noInk = 1;
  }
  if (nose) Sp(g, .042, nose, [0, y - .065, z + .07], [1.15, .8, .8], 1);
}
// Soft shapes: a rounded lump the size of a box, a box with rounded edges, and a little tuft of fur.
const Rd = (p, s, c, pos, rot) => V(p, new THREE.Mesh(G('Icosahedron', .5, 1), mat(c)), pos, rot, [s[0] * 1.14, s[1] * 1.14, s[2] * 1.14]);
const rboxes = new Map();
function rbox(w, h, d, r) {
  const k = [w, h, d, r].join(); let g = rboxes.get(k); if (g) return g;
  g = new THREE.BoxGeometry(w, h, d, 6, 6, 6); const P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3(), q = new THREE.Vector3(), hs = [w / 2 - r, h / 2 - r, d / 2 - r];
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); q.set(Math.max(-hs[0], Math.min(hs[0], v.x)), Math.max(-hs[1], Math.min(hs[1], v.y)), Math.max(-hs[2], Math.min(hs[2], v.z))); v.sub(q).normalize(); N.setXYZ(i, v.x, v.y, v.z); P.setXYZ(i, q.x + v.x * r, q.y + v.y * r, q.z + v.z * r); }
  rboxes.set(k, g); return g;
}
const Rb = (p, s, c, pos, rot, r = Math.min(...s) * .28) => V(p, new THREE.Mesh(rbox(...s.map(x => +x.toFixed(3)), +r.toFixed(3)), mat(c)), pos, rot);
const tuft = (g, pos, c, k = 1, rot) => { const t = Grp(g, pos, rot, k); for (const [x, r, h] of [[0, 0, .3], [-.09, .55, .22], [.09, -.55, .22]]) Co(t, [.075, h, 5], c, [x, h / 2 - .03, 0], [0, 0, r]); return t; };
const feet = (g, c, x, z, s = [.3, .18, .4], y = 0) => { for (const k of [-1, 1]) Sp(g, .5, c, [k * x, y + s[1] * .5, z], [s[0] * 1.1, s[1] * 1.15, s[2] * 1.05], 1); };
const legs4 = (g, c, x, zf, zb, h, w = .2) => { for (const k of [-1, 1]) for (const z of [zf, zb]) { Cy(g, [w * .5, w * .62, h, 7], c, [k * x, h / 2, z]); Sp(g, w * .66, c, [k * x, w * .3, z + w * .15], [1, .6, 1.2], 1); } };
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
  shrimplet: { slot: 'tail', name: 'a fan tail', b(g, F, K) {
    const k = [.6, .85, 1.1][F], c = mix(K.a, '#ff5a4a', .4), t = Grp(g, [0, 0, 0], [-.7, 0, 0], k);
    for (let i = 0; i < (F ? 5 : 3); i++) { const a = (i - (F ? 2 : 1)) * .45; Oc(t, .3, i % 2 ? K.a : c, [Math.sin(a) * .3, 0, -Math.cos(a) * .32], [.5, .14, 1.15], [0, -a, 0]); }
  } },
  siamew: { slot: 'tail', name: 'a chocolate tail', b(g, F, K) { catTail(g, F, [K.a, K.b, K.b, K.b, K.b]); } },
  coralcolt: { slot: 'top', name: 'a coral crown', b(g, F) {
    const c = '#ff7a8a', tip = '#ffc0c8', prong = (x, z, h, r) => { const e = Grp(g, [x, -.04, z], [z * 1.2, 0, -x * 1.6]); Cy(e, [.045, .07, h, 5], c, [0, h / 2, 0]); Gm(e, .075, tip, [0, h, 0]); if (F === 2 && r) { Cy(e, [.035, .045, h * .5, 4], c, [.09, h * .55, 0], [0, 0, -.9]); Gm(e, .055, tip, [.2, h * .68, 0]); } };
    prong(0, 0, [.2, .34, .5][F], 1); if (F) { prong(-.2, .02, .26 + F * .06, 0); prong(.2, .02, .26 + F * .06, 1); } if (F === 2) { prong(-.1, -.2, .3, 0); prong(.12, -.2, .34, 0); }
  } },
  skipfin: { slot: 'top', name: 'a beach ball', b(g, F) {
    const r = [.15, .26, .34][F], cs = ['#ff6b6b', '#ffffff', '#ffd23e', '#ffffff', '#4aa8e8', '#ffffff'];
    Sp(g, r, '#ffffff', [0, r, 0]);
    for (let i = 0; i < 6; i += F ? 1 : 2) { const a = i / 6 * PI * 2; Sp(g, r * .66, cs[i], [Math.cos(a) * r * .5, r, Math.sin(a) * r * .5], [1, 1.2, 1], 1); }
    Gm(g, r * .22, '#ff6b6b', [0, r * 1.95, 0], [1, .5, 1]);
    if (F === 2) for (const [x, y] of [[-.42, .5], [.4, .7]]) Oc(g, .07, GL('#fff6c8', 1), [x, y, 0], [1, 1.7, 1]);
  } },
  gingersnap: { slot: 'tail', name: 'a striped tail', b(g, F, K) { const d = mix(K.a, '#b3501c', .6); catTail(g, F, [K.a, d, K.a, d, K.a, K.b]); } },
  patchkit: { slot: 'top', name: 'a daisy', b(g, F) {
    const k = [.8, 1.15, 1.4][F], f = Grp(g, [.3, -.12, .3], [.9, 0, -.5], k);
    for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; Gm(f, .1, '#ffffff', [Math.cos(a) * .15, 0, Math.sin(a) * .15], [1.1, .4, .7], [0, -a, 0]); } Gm(f, .09, '#ffd23e', [0, .04, 0], [1, .6, 1]);
    if (F === 2) { leaf(f, [-.2, -.03, -.1], [0, .6, 0], .7); leaf(f, [.05, -.03, -.24], [0, 1.8, 0], .6); }
  } },
  tuxpurr: { slot: 'top', name: 'a top hat', b(g, F) {
    const h = [.18, .32, .5][F], r = [.16, .2, .24][F], c = '#2f2c38', t = Grp(g, [0, -.05, 0], [0, 0, -.14]);
    Cy(t, [r * 1.7, r * 1.7, .05, 10], c, [0, .03, 0]); Cy(t, [r * 1.05, r, h, 10], c, [0, .05 + h / 2, 0]);
    if (F) Cy(t, [r * 1.04, r * 1.04, .08, 10], '#e0483c', [0, .12, 0]);
    if (F === 2) Oc(t, .07, GL('#ffd65a', .7), [0, .13, r * 1.02], [1, 1, .4]);
  } },
  fluffcoon: { slot: 'tail', name: 'a bushy tail', b(g, F, K) { const d = mix(K.a, '#4a342c', .45); catTail(g, F, [K.a, d, K.a, d, K.a, d, K.b], 1.9); } },
  glazemew: { slot: 'back', name: 'pink icing', b(g, F) {
    const w = [.36, .42, .48][F], L = [.4, .62, .82][F], c = '#ff9ec4', sp = ['#ffffff', '#ffd23e', '#7cc4ee', '#8fe0a0', '#ff6b6b'];
    Sp(g, 1, c, [0, -.06, 0], [w, .14, L]);
    if (F) for (let i = 0; i < 4 + F * 3; i++) { const a = i * 2.4, r = .25 + (i % 3) * .28; Bx(g, [.04, .035, .13], sp[i % 5], [Math.sin(a) * r * w, .07, Math.cos(a) * r * L], [0, a * 1.7, 0]); }
    if (F === 2) for (const [x, z] of [[-1, .3], [1, -.2], [-1, -.5], [1, .5]]) Sp(g, .09, c, [x * w * .92, -.14, z * L], [1, 1.6, 1], 1);
  } },
  munchmew: { slot: 'top', name: 'a ribbon bow', b(g, F) {
    const k = [.7, .95, 1.15][F], c = '#ff8fb0', t = Grp(g, [0, -.04, .04], [.25, 0, 0], k);
    for (const s of [-1, 1]) { Co(t, [.17, .34, 4], c, [s * .19, .1, 0], [0, 0, s * PI / 2], [1, 1, .5]); if (F) Bx(t, [.09, .26, .04], c, [s * .09, -.08, .06], [0, 0, s * .35]); }
    Gm(t, .09, '#e0668c', [0, .1, .02]);
  } },
  rocktopus: { slot: 'top', name: 'a pebble stack', b(g, F) {
    const c = ['#9a9088', '#b9b2a8', '#8a8794'];
    for (let i = 0; i <= F; i++) Gm(g, .2 - i * .045, c[i], [i % 2 ? .03 : -.02, .08 + i * .2, 0], [1.25, .7, 1.1], [0, i * 1.3, 0]);
    if (F === 2) Oc(g, .07, GL('#7fe0d0', .6), [0, .66, 0], [1, 1.5, 1]);
  } },
  driftle: { slot: 'back', name: 'a starfish', b(g, F) {
    const k = [.55, .8, 1.05][F], t = Grp(g, [.1, .04, 0], [-.15, .4, 0], k);
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; Co(t, [.1, .3, 4], '#ff9a5a', [Math.sin(a) * .17, 0, Math.cos(a) * .17], [PI / 2, 0, -a], [1, 1, .45]); }
    Gm(t, .12, '#ffb27a', [0, .02, 0], [1, .5, 1]);
  } },
  zapuff: { slot: 'back', name: 'puffer spikes', b(g, F) {
    const k = [.6, .9, 1.15][F], c = F === 2 ? GL('#ffd21f', .6) : '#e8a81c';
    for (const [x, z, r] of [[0, 0, 0], [-.28, .05, .5], [.28, .05, -.5], [0, -.3, 0], [0, .3, 0]].slice(0, F ? 5 : 3)) Co(g, [.09 * k, .34 * k, 4], c, [x * k, .12 * k, z * k], [z * 1.6, 0, r]);
  } },
  ottershell: { slot: 'tail', name: 'a paddle tail', b(g, F, K) {
    const k = [.6, .9, 1.15][F]; Co(g, [.24 * k, 1.0 * k, 6], K.a, [0, .1 * k, -.42 * k], [-PI / 2 + .25, 0, 0], [1, 1, .5]);
  } },
  cinnapanda: { slot: 'tail', name: 'a ringed tail', b(g, F, K) { const d = mix(K.a, '#7a2f1c', .55); catTail(g, F, [K.a, K.b, d, K.b, d, K.b, d], 1.7); } },
  yuzubara: { slot: 'top', name: 'a yuzu', b(g, F) {
    const r = [.15, .2, .22][F], y = '#ffc93c';
    Sp(g, r, y, [0, r * .8, 0], [1, .88, 1], 1); Cy(g, [.02, .03, .08, 4], '#6b4a2c', [0, r * 1.62, 0]); leaf(g, [.09, r * 1.64, 0], [0, 0, -.3], .5);
    if (F === 2) { Sp(g, r * .8, mix(y, '#ff9a2c', .4), [.04, r * 2.25, 0], [1, .88, 1], 1); leaf(g, [.14, r * 2.95, 0], [0, .8, -.3], .45); }
  } },
  snoozloth: { slot: 'top', name: 'a nightcap', b(g, F) {
    const k = [.7, .95, 1.2][F], c = '#6f8fd8', t = Grp(g, [0, -.08, -.02], [0, 0, .12], k);
    Cy(t, [.36, .38, .1, 9], '#ffffff', [0, .04, 0]); Co(t, [.33, .5, 7], c, [0, .32, 0]);
    const e = Grp(t, [.06, .5, 0], [0, 0, -1.25]); Co(e, [.15, .46, 6], c, [0, .2, 0]); Sp(e, .1, '#ffffff', [0, .46, 0], null, 1);
    if (F === 2) for (const [x, y, z] of [[-.16, .22, .25], [.14, .3, .2]]) Oc(t, .05, GL('#fff6c8', .9), [x, y, z], [1, 1.5, .5]);
  } },
  glidenut: { slot: 'back', name: 'glider flaps', b(g, F, K) {
    const w = [.3, .62, .95][F], d = [.3, .5, .7][F];
    for (const s of [-1, 1]) { Rb(g, [w, .05, d], K.b, [s * (w / 2 + .12), -.12, .1], [0, 0, -s * .12], .02); Rd(g, [.14, .14, .18], K.a, [s * (w + .12), -.14, .1 + d / 2]); Rd(g, [.14, .14, .18], K.a, [s * (w + .1), -.14, .1 - d / 2]); }
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
  acornip: { slot: 'top', name: 'an acorn cap', b(g, F) {
    const r = [.7, .5, .58][F];
    Sp(g, r, '#8a5a3c', [0, -.04, 0], [1, .6, 1]); Cy(g, [r * 1.02, r * 1.02, .1, 8], '#6f4630', [0, -.06, 0]);
    Cy(g, [.05, .07, .22, 5], '#6f4630', [0, r * .62, 0], [0, 0, .25]);
    if (F === 2) { leaf(g, [.16, r * .7, 0], [0, 0, -.5], 1); leaf(g, [-.1, r * .68, .05], [0, 2, .5], .8, '#86cc5a'); }
  } },
  lanternail: { slot: 'back', name: 'a lantern shell', b(g, F) {
    if (!F) { Sp(g, .36, '#c96a3c', [0, .3, 0], [.7, 1, 1]); for (const s of [-1, 1]) Gm(g, .13, GL('#ffd65a', .8), [s * .22, .32, 0], [.5, 1, 1]); return; }
    const h = [0, .62, .95][F], w = [0, .32, .4][F], dk = '#5b4a55';
    Cy(g, [w, w * 1.1, .1, 6], dk, [0, .05, 0]); Cy(g, [w * .78, w * .78, h, 6], GL('#ffc24a', .75), [0, .1 + h / 2, 0]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 6; Bx(g, [.05, h, .05], dk, [Math.cos(a) * w * .86, .1 + h / 2, Math.sin(a) * w * .86]); }
    Cy(g, [w, w, .08, 6], dk, [0, .14 + h, 0]); Co(g, [w * 1.15, .3, 6], '#d9584e', [0, .33 + h, 0]);
    if (F === 2) { V(g, new THREE.Mesh(G('Torus', .14, .035, 4, 8), mat(dk)), [0, .6 + h, 0]); Gm(g, .12, GL('#fff3a0', 1), [0, .1 + h * .45, 0], [1, 1.6, 1]); }
  } },
  ripplet: { slot: 'top', name: 'a wave curl', b(g, F) {
    const n = [2, 3, 4][F], k = 1 + F * .25;
    for (let i = 0; i < n; i++) { const a = i / n * 2.4; Sp(g, .2 - i * .03, i === n - 1 ? '#ffffff' : mix('#6fb7e8', '#ffffff', i * .15), [0, .06 + Math.sin(a) * .3 * k, -.12 + (1 - Math.cos(a)) * .22 * k]); }
  } },
  wattbat: { slot: 'top', name: 'bolt ears', b(g, F) {
    const c = GL('#ffd23e', .6), h = [.3, .5, .7][F];
    for (const s of [-1, 1]) { const e = Grp(g, [s * .32, -.1, 0], [0, 0, -s * .35]); Bx(e, [.14, h * .5, .08], c, [0, h * .25, 0], [0, 0, s * .35]); Bx(e, [.12, h * .5, .08], c, [s * .02, h * .62, 0], [0, 0, -s * .45]); if (F === 2) Co(e, [.07, h * .35, 4], c, [-s * .06, h * 1.0, 0], [0, 0, s * .3]); }
  } },
  rubblet: { slot: 'top', name: 'a gem crown', b(g, F) {
    const n = [1, 3, 5][F], cs = ['#8fe3ff', '#c9b5ff', '#ffb3d1'];
    if (F === 2) Cy(g, [.4, .42, .09, 8], '#f0b320', [0, -.03, 0]);
    for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : (i / (n - 1) - .5) * 1.9; Oc(g, .13 + (i === n >> 1 ? .05 : 0), GL(cs[i % 3], .6), [Math.sin(a) * .34, .02 + Math.cos(a) * .14, .05], [1, 1.9, 1], [0, 0, -a * .5]); }
  } },
  bambear: { slot: 'top', name: 'a bamboo shoot', b(g, F) {
    const n = F + 1;
    for (let i = 0; i < n; i++) { Cy(g, [.07, .08, .2, 6], i % 2 ? '#86cc5a' : '#6cc24f', [0, .1 + i * .21, 0]); Cy(g, [.088, .088, .03, 6], '#4a9a45', [0, .2 + i * .21, 0]); }
    leaf(g, [.14, n * .21 + .02, 0], [0, 0, -.6], .8); if (F) leaf(g, [-.14, n * .21 - .08, 0], [0, PI, -.6], .7, '#86cc5a');
  } },
  sizzlet: { slot: 'back', name: 'dragon wings', b(g, F, K) {
    const D = DRAGON[K.el], k = [.5, .85, 1.25][F], c = D ? mix(K.a, D.spike, .5) : mix(K.a, '#7a2a2a', .3), m = D ? D.wing : mix(K.b, '#ffb14a', .4);
    for (const s of [-1, 1]) { const w = Grp(g, [s * .14, .02, 0], [.25, s * .5, -s * .55], k); Cy(w, [.035, .05, .7, 5], c, [0, .32, 0]);
      for (let i = 0; i < 3; i++) { const p = [s * (.15 + i * .1), .44 - i * .17, 0], r = [0, 0, -s * (.5 + i * .45)];
        if (K.el === 'Stone') Gm(w, .2, i % 2 ? '#8a8794' : m, p, [1.3, .75, .45], r); // slabs of slate
        else if (K.el === 'Leaf') Oc(w, .3, i % 2 ? '#4a9a45' : m, p, [1.15, .5, .1], r); // three leaves
        else Oc(w, .3, m, p, K.el === 'Spark' ? [1.25, .4, .08] : [1, .55, .08], r); }
      Co(w, [.05, .14, 4], D ? D.horn : '#fff3df', [0, .72, 0]); }
  } },
  waddlet: { slot: 'top', name: 'a seashell hat', b(g, F) {
    const s = Grp(g, [0, -.04, 0], [-.25, 0, 0], [.75, .95, 1.15][F]);
    Sp(s, .34, '#ffb9c4', [0, .1, 0], [1, .6, 1]);
    for (let i = 0; i < 5; i++) { const a = (i - 2) * .5; Bx(s, [.04, .04, .44], '#fff3f0', [Math.sin(a) * .15, .275 - Math.abs(i - 2) * .035, .02], [0, a, 0]); }
    Sp(s, .08, '#ffffff', [0, .1, -.32], null, 1); if (F === 2) Sp(s, .09, GL('#fff6ff', .5), [.2, .3, .12], null, 1);
  } },
  oinkwatt: { slot: 'tail', name: 'a curly spark tail', b(g, F) {
    const y = GL('#ffd21f', .6), t = Grp(g, [0, 0, 0], [-.6, 0, 0], [.6, .85, 1.1][F]), n = 7 + F * 2;
    for (let i = 0; i < n; i++) { const a = i * .9, rr = .16 - i * .008; Sp(t, .078 - i * .003, y, [Math.cos(a) * rr, .06 + i * .06, Math.sin(a) * rr], null, 1); }
    if (F === 2) Oc(t, .1, GL('#fff3a0', .9), [0, .1 + n * .06, 0], [1, 1.6, 1]);
  } },
  tricerock: { slot: 'top', name: 'a stone frill', b(g, F) {
    const f = Grp(g, [0, -.34, -.3], [-.45, 0, 0], [.65, .85, 1][F]), cs = ['#8fe3ff', '#ffb3d1', '#c9b5ff'];
    Cy(f, [.6, .6, .1, 9], '#a9a6b0', [0, .3, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) { const a = (i - 2) * .55; Gm(f, .15, '#8a8794', [Math.sin(a) * .58, .3 + Math.cos(a) * .58, 0], null, [a, i, 0]); if (F === 2 || (F && i % 2 === 0)) Oc(f, .075, GL(cs[i % 3], .6), [Math.sin(a) * .36, .3 + Math.cos(a) * .36, .07], [1, 1.5, .5]); }
  } },
  // themed sets
  strawbun: { slot: 'top', name: 'a strawberry top', b(g, F) { for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; leaf(g, [Math.sin(a) * .16, 0, Math.cos(a) * .16], [.3, -a + PI / 2, 0], .7 + F * .1); } Cy(g, [.03, .04, .14, 5], '#4a9a45', [0, .08, 0]); } },
  chilipup: { slot: 'top', name: 'a chili stem', b(g, F) { Sp(g, .2 + F * .03, '#5fb04a', [0, 0, 0], [1, .5, 1]); for (let i = 0; i < 4; i++) Sp(g, .05 - i * .006, '#4a9a45', [i * .04, .1 + i * .07, -i * i * .02], null, 1); } },
  melonwhale: { slot: 'back', name: 'a melon slice', b(g, F, K) { const k = [.6, .85, 1.1][F]; Sp(g, .46 * k, '#5fb85a', [0, 0, 0], [.22, 1, 1]); Sp(g, .4 * k, '#ff7a8a', [0, 0, 0], [.26, 1, 1]); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) Sp(g, .03, '#3b2f3a', [s * .1 * k, .14 * k + (i % 2) * .1 * k, (i - 1) * .16 * k], null, 0); } },
  lemonzest: { slot: 'top', name: 'a peel curl', b(g, F) { for (let i = 0; i < 6 + F * 2; i++) { const a = i * .9, rr = .15 - i * .008; Sp(g, .07 - i * .003, '#f7d23a', [Math.cos(a) * rr, .08 + i * .055, Math.sin(a) * rr], null, 1); } leaf(g, [.14, .03, -.05], [0, 0, -.5], .8); } },
  coconutkin: { slot: 'back', name: 'a palm sprout', b(g, F) { Cy(g, [.04, .05, .3, 5], '#5fa646', [0, .12, 0]); for (let i = 0; i < 4 + F; i++) { const a = i / (4 + F) * PI * 2; leaf(g, [Math.sin(a) * .2, .3, Math.cos(a) * .2], [.5, -a + PI / 2, 0], 1 + F * .15); } } },
  pinepine: { slot: 'top', name: 'a pineapple crown', b(g, F) { const n = [5, 8, 11][F]; for (let i = 0; i < n; i++) { const a = i * 2.4, t = i / n; leaf(g, [Math.sin(a) * .16 * (1 - t), t * .3 - .04, Math.cos(a) * .16 * (1 - t)], [.9 - t * .7, -a + PI / 2, 0], 1.2 + F * .2 - t * .3, i % 2 ? '#4a9a45' : '#6cc24f'); } } },
  croissab: { slot: 'back', name: 'a croissant', b(g, F) { const k = [.6, .85, 1.1][F]; for (let i = -2; i <= 2; i++) { const t = i / 2, rr = (.26 - Math.abs(t) * .13) * k; Sp(g, rr, i % 2 ? '#f2c078' : '#e8a85a', [t * .42 * k, rr * .7, -t * t * .2 * k], [1.1, 1, 1.1], 1); } } },
  donuseal: { slot: 'top', name: 'a little donut', b(g, F) { const k = [.7, .9, 1.1][F], d = Grp(g, [0, .1, 0], [PI / 2 - .2, 0, 0], k); To(d, [.24, .13, 6, 14], '#e8b878', [0, 0, 0]); To(d, [.24, .11, 6, 14], '#ff9ec4', [0, 0, -.05]); for (let i = 0; i < 7; i++) Bx(d, [.07, .025, .025], ['#ffffff', '#7cc4ee', '#ffd65a'][i % 3], [Math.cos(i * .9) * .24, Math.sin(i * .9) * .24, -.165], [0, 0, i * 2]); } },
  cupcowl: { slot: 'top', name: 'a frosting swirl', b(g, F) { const k = [.6, .8, 1][F]; for (let i = 0; i < 3; i++) Sp(g, (.5 - i * .13) * k, i % 2 ? '#ffd0e2' : '#ff9ec4', [0, i * .19 * k, 0], [1, .5, 1]); Sp(g, .11 * k + .02, '#e8402a', [0, .56 * k, 0], null, 1); } },
  pretzelisk: { slot: 'top', name: 'a pretzel bow', b(g, F) { const k = [.7, .9, 1.1][F]; for (const s of [-1, 1]) To(g, [.16 * k, .06 * k, 6, 12], '#c98a4a', [s * .15 * k, .16 * k, 0], [-.3, 0, s * .4]); for (let i = 0; i < 4; i++) Sp(g, .035, '#ffffff', [(i - 1.5) * .12 * k, .26 * k + (i % 2) * .06, .06], null, 0); } },
  mallowlamb: { slot: 'top', name: 'a toasted marshmallow', b(g, F) { const k = [.7, .9, 1.1][F]; Rb(g, [.4 * k, .3 * k, .4 * k], '#ffffff', [0, .15 * k, 0], [0, .4, .1], .1 * k); Rb(g, [.34 * k, .06 * k, .34 * k], '#e8b878', [0.02, .3 * k, 0], [0, .4, .1], .025 * k); } },
  candraffe: { slot: 'top', name: 'candy cane horns', b(g, F) { const k = [.8, 1, 1.25][F]; for (const s of [-1, 1]) { const c = Grp(g, [s * .18, -.06, 0], [0, 0, -s * .15], k); Cy(c, [.04, .04, .26, 6], '#ff5a6e', [0, .13, 0]); Cy(c, [.043, .043, .06, 6], '#ffffff', [0, .12, 0]); To(c, [.08, .04, 5, 8, PI], '#ff5a6e', [s * .08, .26, 0]); } } },
  jellifrog: { slot: 'top', name: 'a wobbly jelly', b(g, F) { const k = [.6, .8, 1][F]; Sp(g, .08 * k + .02, '#ff7a8a', [0, .14 * k, 0], null, 1); Sp(g, .36 * k, TR('#7fe0a0', .62), [0, .12 * k, 0], [1, .8, 1]); } },
  carrofox: { slot: 'tail', name: 'a carrot tail', b(g, F) { const t = Grp(g, [0, 0, 0], [.5, 0, 0], .7 + F * .25); Co(t, [.3, 1.1, 8], '#ff9a3c', [0, 0, -.5], [-PI / 2, 0, 0]); for (let i = 0; i < 3; i++) To(t, [.25 - i * .07, .025, 4, 10], '#c96a2a', [0, 0, -.2 - i * .27]); } },
  pumpkit: { slot: 'top', name: 'a pumpkin stem', b(g, F) { Sp(g, .26 + F * .04, '#ff9a2c', [0, -.02, 0], [1, .45, 1]); Cy(g, [.07, .1, .22, 6], '#5fa646', [0, .14, 0], [0, 0, .2]); leaf(g, [.15, .12, 0], [0, 0, -.4], .9); } },
  peapillar: { slot: 'back', name: 'a pea pod', b(g, F) { const k = [.6, .8, 1][F]; Sp(g, 1, '#5fa84a', [0, .08 * k, 0], [.2 * k, .16 * k, .55 * k]); for (let i = 0; i < 3; i++) Sp(g, .14 * k, '#a8e06a', [0, .2 * k, (i - 1) * .3 * k], null, 1); } },
  shroomouse: { slot: 'top', name: 'a spotted cap', b(g, F) { const R = [.5, .75, 1][F]; Cy(g, [R * .5, R * .62, .1, 10], '#fff3df', [0, 0, 0]); Sp(g, R, '#8f7fd9', [0, .05, 0], [1, .55, 1]); for (let i = 0; i < 5 + F; i++) { const a = i * 2.4, e = .3 + (i % 3) * .3; Sp(g, R * .14, '#ffffff', [Math.sin(a) * Math.sin(e) * R, .05 + Math.cos(e) * R * .55, Math.cos(a) * Math.sin(e) * R], [1, .5, 1], 1); } } },
  snowfox: { slot: 'tail', name: 'a snowy tail', b(g, F) { const n = 3 + F; for (let i = 0; i < n; i++) { const t = i / (n - 1); Sp(g, (.26 + Math.sin(t * PI) * .16) * (.8 + F * .15), i === n - 1 ? '#8fd4ff' : '#f4faff', [0, t * .5, -.1 - t * .55]); } } },
  sunlion: { slot: 'top', name: 'a crown of sun rays', b(g, F) { const n = 5 + F; for (let i = 0; i < n; i++) { const a = (i / (n - 1) - .5) * 2.2; Co(g, [.13, .3 + F * .1, 4], i % 2 ? GL('#ff9a3c', .25) : GL('#ffd21f', .3), [Math.sin(a) * .34, Math.cos(a) * .2 - .05, 0], [0, 0, -a], [1, 1, .5]); } } },
  dripfrog: { slot: 'top', name: 'a leaf umbrella', b(g, F) { const k = [.6, .8, 1][F]; Cy(g, [.025, .025, .4 * k, 5], '#5fa646', [0, .2 * k, 0]); Sp(g, .5 * k, '#6cc24f', [0, .42 * k, 0], [1, .28, 1]); Oc(g, .05, '#bfe6fb', [.36 * k, .3 * k, .1], [1, 1.8, 1]); } },
  twistret: { slot: 'tail', name: 'a little whirlwind', b(g, F) { const n = 3 + F; for (let i = 0; i < n; i++) { const rr = .1 + i * .07; Sp(g, 1, i % 2 ? '#eef2f7' : '#b9c2d0', [Math.sin(i * 1.3) * .05, -.1 + i * .15, -.25 + Math.cos(i * 1.3) * .05], [rr, .11, rr]); } } },
  moonbun: { slot: 'back', name: 'a slice of moon', b(g, F) { const m = Grp(g, [-.2, .25, -.15], [.15, 0, .5], .7 + F * .25); To(m, [.62, .2, 6, 14, PI * 1.25], GL('#ffe27a', .5), [0, 0, 0], [0, 0, PI * .4], [1, 1, .6]); } },
  starjelly: { slot: 'top', name: 'a lucky star', b(g, F) { const k = [.6, .8, 1][F], s = Grp(g, [0, .12 * k, 0], [-.3, 0, 0], k); Sp(s, .16, GL('#fff3a0', .6), [0, 0, 0], [1, 1, .5], 1); for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; Co(s, [.12, .3, 4], GL('#fff3a0', .6), [Math.sin(a) * .22, Math.cos(a) * .22, 0], [0, 0, -a], [1, 1, .45]); } } },
  cometail: { slot: 'tail', name: 'a comet tail', b(g, F) { const n = 6 + F * 2; for (let i = 0; i < n; i++) { const t = i / (n - 1); Sp(g, (.3 + F * .04) * (1 - t * .85), GL(mix('#fff6c8', '#7fd0ff', t), .7 - t * .3), [Math.sin(t * 4) * .06, .1 + t * .5, -.15 - t * (.9 + F * .3)], null, 1); } } },
  ringbear: { slot: 'back', name: 'a planet ring', b(g, F) { const k = [.5, .7, .9][F], r = Grp(g, [0, .35 * k, -.1], [.5, 0, .25], k); Sp(r, .26, '#f2c9a0', [0, 0, 0]); To(r, [.5, .06, 4, 18], '#c9b5ff', [0, 0, 0], [PI / 2, 0, 0], [1, 1, .35]); Sp(g, .08, '#e9e4ff', [.45 * k, .7 * k, 0], null, 1); } },
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
// ---------- shared shapes for themed pets ----------
const To = (p, a, c, pos, rot, scl) => V(p, new THREE.Mesh(G('Torus', ...a), mat(c)), pos, rot, scl);
const dots = (g, c, p, r, n, sz, front = false, d0 = 0) => { for (let i = 0; i < n; i++) { const a = i * 2.4 + d0, e = .45 + ((i * .37) % 1) * 1.5, x = Math.sin(a) * Math.sin(e), y = Math.cos(e), z = Math.cos(a) * Math.sin(e); if (!front && z > .4 && y > -.35) continue; Sp(g, sz, c, [p[0] + x * r[0], p[1] + y * r[1], p[2] + z * r[2]], null, 1); } };
const earsP = (g, h, c, inn, k = 1) => { for (const s of [-1, 1]) { const e = Grp(g, [s * h.r * .62, h.p[1] + h.r * .62, h.p[2] - .03], [0, 0, -s * .28], k); Co(e, [.26, .48, 4], c, [0, .22, 0], [0, PI / 4, 0], [1, 1, .6]); if (inn) Co(e, [.14, .28, 4], inn, [0, .17, .06], [0, PI / 4, 0], [1, 1, .5]); } };
const earsR = (g, h, c, inn, k = 1) => { for (const s of [-1, 1]) { Sp(g, h.r * .3 * k, c, [s * h.r * .7, h.p[1] + h.r * .72, h.p[2] - .02], [1, 1, .6]); if (inn) Sp(g, h.r * .17 * k, inn, [s * h.r * .7, h.p[1] + h.r * .72, h.p[2] + .08], [1, 1, .4], 1); } };
const earsL = (g, h, c, inn, len = .8, droop = 0) => { for (const s of [-1, 1]) { const e = Grp(g, [s * h.r * (.35 + droop * .3), h.p[1] + h.r * (.8 - droop * .3), h.p[2] - .05], [-.1, 0, -s * (.16 + droop * 2)]); Cy(e, [.11, .2, len, 4], c, [0, len / 2, 0], [0, PI / 4, 0], [1, 1, .6]); Bx(e, [.13, len * .7, .04], inn, [0, len / 2, .1]); } };
function sitter(g, F, K, X, { r = [.6, .6, .7][F], hr = [.7, .62, .66][F], feetC = K.a, belly = true, arms = true, faceO = {} } = {}) {
  const k = F ? 1 : .8, by = F ? r : r * .7, hy = F ? by * 1.75 + hr * .55 : by + hr * .75;
  const A = { head: { p: [0, hy, .1], r: hr }, body: { p: [0, by, 0], r: [r * k, by, r * .92 * k] } }, b = A.body;
  Sp(g, 1, K.a, b.p, b.r); if (belly) Sp(g, b.r[0] * .64, K.b, [0, by * .85, b.r[2] * .5], [1, 1.1, .6]);
  Sp(g, hr, K.a, A.head.p, [1.06, .95, 1]); feet(g, feetC, b.r[0] * .55, b.r[2] * .6, [.3, .18, .42]);
  if (arms) for (const s of [-1, 1]) Rd(g, [.2, .32, .2], K.a, [s * b.r[0] * .85, by * 1.15, b.r[2] * .45], [-.6, 0, s * .3]);
  face(g, X.eyes, A.head.p, hr, { eye: [1.35, 1.2, 1.1][F], ...faceO });
  A.top = [0, hy + hr * .88, .1]; A.tail = [0, by * .5, -b.r[2]]; A.back = [0, by * 1.5, -b.r[2] * .7]; A.fs = [.8, .9, 1][F];
  return A;
}
function walker(g, F, K, X, { w = [.5, .5, .6][F], L = [.5, .66, .82][F], hr = [.64, .58, .6][F], leg = [.16, .36, .46][F], legC = K.a, lw = .22, faceO = {} } = {}) {
  const by = leg + w * .8, A = { head: { p: [0, by + hr * .45, L * .95], r: hr }, body: { p: [0, by, -.05], r: [w, w * .88, L] } };
  Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, by - w * .25, -.05], [w * .85, w * .66, L * .88]);
  legs4(g, legC, w * .55, L * .55, -L * .6, leg + .12, lw); Sp(g, hr, K.a, A.head.p, [1.06, .95, 1]);
  face(g, X.eyes, A.head.p, hr, { eye: [1.35, 1.2, 1.1][F], ...faceO });
  A.top = [0, A.head.p[1] + hr * .88, A.head.p[2]]; A.tail = [0, by + .1, -.05 - L]; A.back = [0, by + w * .8, -.15]; A.fs = [.8, .9, 1][F];
  return A;
}
function ball(g, F, K, X, { r = [.62, .72, .82][F], h = 1, feetC = K.a, faceO = {}, fy = 0, c = K.a } = {}) {
  const y = r * h + .08, A = { head: { p: [0, y + fy * r, 0], r: r * .98 }, body: { p: [0, y, 0], r: [r, r * h, r] } };
  Sp(g, 1, c, A.body.p, A.body.r); if (feetC) feet(g, feetC, r * .42, r * .35, [.26, .16, .34]);
  face(g, X.eyes, A.head.p, r, { eye: [1.35, 1.2, 1.1][F], ...faceO });
  A.top = [0, y + r * h * .97, 0]; A.tail = [0, y * .6, -r * .95]; A.back = [0, y + r * h * .7, -r * .65]; A.fs = [.8, .9, 1][F];
  return A;
}
// A cat's tail: a soft chain that rises behind and curls at the tip. cols run from the root to the tip.
function catTail(g, F, cols, fat = 1) {
  const k = [.55, .85, 1.05][F], t = Grp(g, [0, 0, 0], null, k), n = cols.length;
  const m = n * 2 - 1;
  for (let i = 0; i < m; i++) { const u = i / (m - 1); Sp(t, (.15 - u * .03) * fat, cols[Math.round(u * (n - 1))], [Math.sin(u * 2.6) * .16, .08 + u * .82, -.12 - Math.sin(u * PI) * .3 + u * .12], [1, 1.15, 1], 1); }
}
// A sitting cat shared by the cat breeds: the baby is all head, then it sits up taller each form.
function cat(g, F, K, X, { ear = K.a, inner = '#f59ab0', paws = K.b, chest = K.b, whisk = mix(K.a, '#5a4a3a', .7), fat = 1, tuftC = null, faceO = {} } = {}) {
  const A = F === 0 ? { head: { p: [0, .78, .05], r: .74 }, body: { p: [0, .4, -.2], r: [.45 * fat, .36, .5 * fat] } }
    : { head: { p: [0, F === 1 ? 1.38 : 1.7, .12], r: F === 1 ? .64 : .62 }, body: { p: [0, F === 1 ? .6 : .72, -.1], r: F === 1 ? [.5 * fat, .6, .5 * fat] : [.52 * fat, .76, .55 * fat] } };
  const h = A.head, b = A.body;
  Sp(g, 1, K.a, b.p, b.r);
  if (F) { Sp(g, b.r[0] * .7, chest, [0, b.p[1] + .05, b.r[2] * .55], [1, 1.2, .7]); for (const s of [-1, 1]) Cy(g, [.1, .12, b.p[1], 7], K.a, [s * .24, b.p[1] / 2, b.r[2] * .8]); }
  feet(g, paws, .26, F ? b.r[2] * .95 : .42, [.24, .16, .3]);
  Sp(g, h.r, K.a, h.p, [1.1, .9, .95]);
  for (const s of [-1, 1]) {
    const e = Grp(g, [s * h.r * .66, h.p[1] + h.r * .62, h.p[2]], [0, 0, -s * .25]);
    Co(e, [.26, .46, 4], Array.isArray(ear) ? ear[s < 0 ? 0 : 1] : ear, [0, .2, 0], [0, PI / 4, 0], [1, 1, .6]); Co(e, [.14, .28, 4], inner, [0, .16, .06], [0, PI / 4, 0], [1, 1, .5]);
    if (tuftC && F) Co(e, [.06, .24 + F * .06, 3], tuftC, [0, .52, 0]);
    Bx(g, [.34, .02, .02], whisk, [s * h.r * .95, h.p[1] - h.r * .2, h.p[2] + h.r * .6], [0, -s * .5, s * .15]);
  }
  face(g, X.eyes, h.p, h.r, { eye: [1.35, 1.2, 1.1][F], ...faceO });
  A.top = [0, h.p[1] + h.r * .84, h.p[2]]; A.tail = [.2, .25, b.p[2] - b.r[2] * .9]; A.back = [0, b.p[1] + b.r[1] * .7, b.p[2] - b.r[2] * .6];
  return A;
}
// A munchkin cat's build: a long body on very short legs. Munchmew wears a bow on it, Glazemew pink icing.
function munchkin(g, F, K, X) {
  const C = CATCOAT[X.coat], o = C.o(K), ear = o.ear || K.a;
  const A = walker(g, F, K, X, { w: [.46, .46, .5][F], L: [.5, .78, 1.02][F], leg: [.05, .08, .1][F], hr: [.66, .6, .62][F], legC: o.paws || K.b, lw: .24 }), h = A.head;
  A.long = true;
  for (const s of [-1, 1]) { const e = Grp(g, [s * h.r * .66, h.p[1] + h.r * .62, h.p[2]], [0, 0, -s * .25]); Co(e, [.26, .46, 4], Array.isArray(ear) ? ear[s < 0 ? 0 : 1] : ear, [0, .2, 0], [0, PI / 4, 0], [1, 1, .6]); Co(e, [.14, .28, 4], '#f59ab0', [0, .16, .06], [0, PI / 4, 0], [1, 1, .5]); Bx(g, [.34, .02, .02], o.whisk || mix(K.a, '#5a4a3a', .7), [s * h.r * .95, h.p[1] - h.r * .2, h.p[2] + h.r * .6], [0, -s * .5, s * .15]); }
  C.m(g, A, F, K);
  if (X.own('tail')) catTail(Grp(g, [0, A.tail[1] - .1, A.tail[2] + .1]), F, C.t(K));
  return A;
}
// Cat coats: o(K) gives the colours a build needs, m() paints the markings on whatever build wears it, t(K) colours the tail.
const catMuzzle = (g, h, c) => Sp(g, h.r * .34, c, [0, h.p[1] - h.r * .3, h.p[2] + h.r * .66], [1.25, .7, .75]);
const catBrow = (g, h, c) => { for (let i = 0; i < 3; i++) Bx(g, [.09, .04, i === 1 ? .34 : .24], c, [(i - 1) * .2, h.p[1] + h.r * (i === 1 ? .86 : .8), h.p[2] + .2]); };
const CATCOAT = {
  siamew: { o: K => ({ ear: K.b, paws: K.b, chest: mix(K.a, '#ffffff', .6), whisk: '#fffaf0' }), t: K => [K.a, K.b, K.b, K.b, K.b],
    m(g, A, F, K) { Sp(g, A.head.r * .36, K.b, [0, A.head.p[1] - A.head.r * .3, A.head.p[2] + A.head.r * .66], [1.25, .72, .75]); } },
  gingersnap: { o: () => ({}), t: K => { const d = mix(K.a, '#b3501c', .6); return [K.a, d, K.a, d, K.a, K.b]; },
    m(g, A, F, K) {
      const d = mix(K.a, '#b3501c', .6), h = A.head, b = A.body; catMuzzle(g, h, K.b); catBrow(g, h, d);
      for (const s of [-1, 1]) for (let i = 0; i < F; i++) Bx(g, [.04, .08, .26], d, [s * h.r * 1.02, h.p[1] - h.r * (.02 + i * .2), h.p[2] + h.r * .1], [0, 0, s * .2]);
      if (F) for (let i = 0; i < F + 1; i++) { const u = .55 - i * .32, k = Math.sqrt(1 - u * u) * 1.02, T = new THREE.Mesh(G('Torus', 1, .07, 4, 10, PI), M(d));
        if (A.long) V(g, T, [0, b.p[1], b.p[2] + u * b.r[2] * .8], null, [b.r[0] * k, b.r[1] * k, 1]); else V(g, T, [0, b.p[1] + u * b.r[1], b.p[2] - .06], [PI / 2, 0, PI], [b.r[0] * k, b.r[2] * k, 1]); }
    } },
  patchkit: { o: K => ({ ear: [K.b, '#4a4350'], paws: K.a, chest: K.a }), t: K => [K.a, K.b, K.b, '#4a4350', '#4a4350', K.a],
    m(g, A, F, K) {
      const o = K.b, c = '#4a4350', h = A.head, b = A.body, z = A.long ? b.r[2] * .1 : -b.r[2] * .3;
      Sp(g, h.r * .52, o, [-h.r * .5, h.p[1] + h.r * .38, h.p[2] + h.r * .34], [1, .9, .9], 1); Sp(g, h.r * .46, c, [h.r * .56, h.p[1] + h.r * .42, h.p[2] + h.r * .1], [1, .9, 1], 1);
      Sp(g, b.r[0] * .6, c, [-b.r[0] * .55, b.p[1] + b.r[1] * .25, b.p[2] + z], [1, 1, 1], 1); Sp(g, b.r[0] * .55, o, [b.r[0] * .55, b.p[1] - b.r[1] * .05, b.p[2] + z - b.r[2] * .3], [1, 1.1, 1], 1);
      if (F === 2) Sp(g, b.r[0] * .4, o, [-b.r[0] * .3, b.p[1] + b.r[1] * .7, b.p[2] - b.r[2] * .5], [1, 1, 1], 1);
    } },
  tuxpurr: { o: () => ({ whisk: '#ffffff' }), t: K => [K.a, K.a, K.a, K.a, K.b],
    m(g, A, F, K) { Sp(g, A.head.r * .66, K.b, [0, A.head.p[1] - A.head.r * .16, A.head.p[2] + A.head.r * .4], [1.15, .95, .9]); } },
  fluffcoon: { o: K => ({ whisk: K.b }), t: K => { const d = mix(K.a, '#4a342c', .45); return [K.a, d, K.a, d, K.a, d, K.b]; },
    m(g, A, F, K) { catMuzzle(g, A.head, K.b); catBrow(g, A.head, mix(K.a, '#4a342c', .45)); } },
  munchmew: { o: () => ({}), t: K => [K.a, K.a, K.a, K.b], m(g, A, F, K) { catMuzzle(g, A.head, K.b); } },
};
CATCOAT.glazemew = CATCOAT.munchmew;
export const isCat = sp => !!CATCOAT[sp];
const BODY = {
  acornip(g, F, K, X) { // starts as an acorn with a face, then a squirrel whose tail outgrows the rest of it
    const r = [.64, .58, .66][F], tailC = mix(K.a, '#8a5a3c', .35);
    if (!F) {
      const A = { head: { p: [0, r * 1.08, 0], r }, body: { p: [0, r * 1.08, 0], r: [r, r * 1.12, r] } };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, r * .6, K.b, [0, r * .7, r * .5], [1, 1, .6]); feet(g, '#8a5a3c', .26, .22, [.24, .14, .34]);
      Sp(g, .24, tailC, [0, r * .7, -r * .98]);
      face(g, X.eyes, [0, r * 1.0, 0], r, { eye: 1.4, y: -.05 });
      A.top = [0, r * 1.95, 0]; A.tail = [0, r * .7, -r]; A.back = [0, r * 1.7, -r * .5]; A.fs = 1;
      if (X.own('top')) X.sig([0, r * 1.72, 0]);
      return A;
    }
    const by = r * [0, 1.0, 1.1][F], hr = r * .92, hy = by * 2 + hr * .5;
    const A = { head: { p: [0, hy, .12], r: hr }, body: { p: [0, by, 0], r: [r, by, r * .9] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, r * .68, K.b, [0, by * .9, r * .45], [1, 1.25, .6]); Sp(g, hr, K.a, A.head.p);
    for (const s of [-1, 1]) { Co(g, [.14, .3, 4], K.a, [s * hr * .6, hy + hr * .85, .05], [0, 0, -s * .3]); Sp(g, hr * .34, K.b, [s * hr * .5, hy - hr * .3, hr * .62], [1, .8, .7]); Rd(g, [.2, .34, .2], K.a, [s * r * .7, by * 1.2, r * .6], [-.7, 0, 0]); Co(g, [.07, .16, 4], '#f59ab0', [s * hr * .6, hy + hr * .83, .1], [0, 0, -s * .3]); }
    feet(g, '#8a5a3c', r * .5, r * .5, [.26, .14, .4]);
    const n = F === 2 ? 6 : 4, R = r * (F === 2 ? 1.35 : .85); // the tail: a plume climbing up behind and curling over
    for (let i = 0; i < n; i++) { const t = i / (n - 1), a = t * (F === 2 ? 2.5 : 1.7); Sp(g, (F === 2 ? .4 : .28) * (1 + Math.sin(t * PI) * .45), i % 2 ? mix(tailC, '#ffffff', .25) : tailC, [0, by * .4 + R * (1 - Math.cos(a)), -r * .95 - R * Math.sin(a) * .6]); }
    face(g, X.eyes, A.head.p, hr, { eye: [0, 1.3, 1.15][F] });
    A.top = [0, hy + hr * .85, .1]; A.tail = [0, by * .5, -r]; A.back = [0, by * 1.6, -r * .7]; A.fs = [1, .95, 1.05][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  lanternail(g, F, K, X) { // a snail: a long soft foot, a head on a raised neck, the lantern riding on its back
    const L = [.7, .9, 1.05][F], w = [.42, .46, .52][F], hr = [.46, .44, .46][F], hy = [.62, .95, 1.2][F];
    const A = { head: { p: [0, hy, L * .78], r: hr }, body: { p: [0, .3, -.05], r: [w, .3, L] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, .12, -.05], [w * 1.12, .12, L * 1.06]);
    Cy(g, [hr * .6, w * .8, hy, 6], K.a, [0, hy / 2 + .1, L * .68], [.25, 0, 0]);
    Sp(g, hr, K.a, A.head.p);
    for (const s of [-1, 1]) { const st = Grp(g, [s * hr * .45, hy + hr * .8, L * .78], [0, 0, -s * .25]), h = .32 + F * .1; Cy(st, [.035, .035, h, 4], K.a, [0, h / 2, 0]); Gm(st, .085, GL('#ffd65a', .7), [0, h + .04, 0]); }
    face(g, X.eyes, A.head.p, hr, { eye: [1.4, 1.25, 1.15][F], nose: null });
    A.top = [0, hy + hr * .85, L * .74]; A.tail = [0, .3, -L]; A.back = [0, .52, -.15]; A.fs = [.9, 1, 1.15][F];
    if (X.own('back')) X.sig(A.back, A.fs);
    return A;
  },
  ripplet(g, F, K, X) { // a round duckling, then a long neck, then wings held up like a little swan
    const r = [.6, .62, .7][F], L = [1, 1.2, 1.4][F], nk = [0, .35, .8][F], hr = [.5, .44, .42][F], by = r * .85 + .12;
    const hp = [0, by + r * .55 + nk + hr * .5, r * L * .55 + (F ? .1 : 0)];
    const A = { head: { p: hp, r: hr }, body: { p: [0, by, 0], r: [r, r * .85, r * L] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, by - r * .2, .05], [r * .9, r * .65, r * L * .9]);
    if (nk) Cy(g, [hr * .5, hr * .62, nk + r * .5, 6], K.a, [0, by + r * .45 + nk / 2, r * L * .5], [.12, 0, 0]);
    Sp(g, hr, K.a, hp);
    Rd(g, [hr * .74, .14, hr * .6], '#f0a23c', [0, hp[1] - hr * .2, hp[2] + hr * .95]); Rd(g, [hr * .5, .08, hr * .4], '#d98a2c', [0, hp[1] - hr * .34, hp[2] + hr * .9]);
    Co(g, [r * .32, r * .6, 4], K.a, [0, by + r * .35, -r * L * .95], [-.9, 0, 0]);
    for (const s of [-1, 1]) {
      const wl = [.4, .62, .95][F]; Oc(g, wl, mix(K.a, '#ffffff', .35), [s * r * (F === 2 ? 1.0 : .92), by + (F === 2 ? r * .55 : .05), -.1], [.16, [.6, .6, .95][F], 1], [F === 2 ? -.5 : -.15, 0, s * (F === 2 ? .45 : .1)]);
      Rd(g, [.28, .08, .36], '#f0a23c', [s * r * .4, .03, .12]); if (F) Cy(g, [.04, .04, .14, 4], '#f0a23c', [s * r * .4, .1, .05]);
    }
    face(g, X.eyes, hp, hr, { eye: [1.4, 1.25, 1.15][F], nose: null, mouth: false, gap: .4 });
    tuft(g, [0, by + r * .2, r * L * .78], K.b, .9 + F * .15, [1.9, 0, 0]);
    A.top = [0, hp[1] + hr * .85, hp[2] - .03]; A.tail = [0, by + .2, -r * L]; A.back = [0, by + r * .85, -.2]; A.fs = [.9, .85, .9][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  wattbat(g, F, K, X) { // a furball with stubby wings, then a bat that hovers on wide wings
    const r = [.6, .58, .64][F], y = [r, r + .45, r + .6][F], wing = mix(K.a, '#3b2f4a', .45);
    const A = { head: { p: [0, y, 0], r }, body: { p: [0, y, 0], r: [r, r, r * .92] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, r * .6, K.b, [0, y - r * .35, r * .5], [1, .9, .6]);
    for (const s of [-1, 1]) {
      const span = [.4, .7, .92][F], wg = Grp(g, [s * r * .85, y + (F ? .1 : -.1), -.1], [0, 0, s * [-.9, .25, .35][F]]);
      for (let i = 0; i < (F ? F + 1 : 1); i++) Oc(wg, span * (1 - i * .22), wing, [s * span * (.5 + i * .12), -i * .2 * span, 0], [1, .55, .08], [0, 0, -s * i * .5]);
      if (F) Cy(wg, [.035, .035, span * 1.2, 4], K.a, [s * span * .55, .1, 0], [0, 0, PI / 2]);
      Rd(g, [.16, F ? .2 : .13, .24], '#5b4a55', [s * .2, F ? y - r - .06 : .06, .1]);
      if (F === 2) Co(g, [.045, .14, 3], '#ffffff', [s * .1, y - r * .42, r * .88], [PI, 0, 0]);
    }
    face(g, X.eyes, [0, y + .02, 0], r, { eye: [1.5, 1.35, 1.2][F], nose: '#3b2f3a' });
    tuft(g, [0, y - r * .2, r * .86], K.b, .9 + F * .2, [2.1, 0, 0]);
    A.top = [0, y + r * .82, 0]; A.tail = [0, y - r * .4, -r * .9]; A.back = [0, y + r * .7, -r * .55]; A.fs = [.9, .9, 1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  rubblet(g, F, K, X) { // one boulder with a face, then boulders stacked into a little golem
    const st = mix(K.a, '#6f6b78', .25);
    if (!F) {
      const r = .66, A = { head: { p: [0, r * .95, 0], r }, body: { p: [0, r * .95, 0], r: [r, r * .92, r] } };
      Gm(g, r * 1.08, K.a, A.body.p, [1, .9, 1], [.3, .5, 0]); feet(g, st, .3, .15, [.3, .16, .36]); Gm(g, .2, K.b, [.4, r * 1.6, -.1], null, [1, 2, 0]);
      face(g, X.eyes, [0, r * .9, .06], r, { eye: 1.4, nose: null, z: .93 });
      A.top = [0, r * 1.85, 0]; A.tail = [0, .4, -r]; A.back = [0, r * 1.5, -.4]; A.fs = .9;
      if (X.own('top')) X.sig(A.top, .9);
      return A;
    }
    const w = [0, .62, .82][F], by = [0, .62, .8][F], hr = .5, hy = by * 2 + hr * .7;
    const A = { head: { p: [0, hy, .08], r: hr }, body: { p: [0, by + .1, 0], r: [w, by, w * .8] } };
    Gm(g, 1, K.a, A.body.p, [w * 1.08, by * 1.05, w * .9], [0, .4, 0]); Gm(g, w * .5, K.b, [0, by * .9, w * .55], [1, 1, .5], [0, .3, 0]);
    Gm(g, hr * 1.1, K.a, A.head.p, [1, .9, 1], [.2, .9, 0]);
    for (const s of [-1, 1]) {
      Bx(g, [.3, .2, .36], st, [s * w * .5, .1, .08]);
      const arm = Grp(g, [s * (w + .12), by * 1.45, 0], [0, 0, s * .2]);
      if (F === 2) Gm(arm, .38, st, [s * .05, .1, 0], null, [s, 1, 0]);
      Bx(arm, [.24, by * .9, .24], K.a, [s * .08, -by * .45, .05]); Gm(arm, F === 2 ? .3 : .22, st, [s * .1, -by * .95, .08], null, [1, s, 0]);
    }
    if (F === 2) { Sp(g, .3, '#6cc24f', [-.3, by * 1.9, -.2], [1.3, .4, 1.2]); flower(g, [-.34, by * 1.9 + .14, -.15], '#fff1a8', .9); }
    face(g, X.eyes, [0, hy - .02, .1], hr, { eye: [0, 1.25, 1.1][F], nose: null, z: .93 });
    if (F) { Oc(g, .13 + F * .03, GL('#8fe3ff', .6), [0, by * 1.25, w * .86], [1, 1.4, .5]); for (const [x, yy, zr] of [[-.3, 1.0, .6], [.34, .7, -.5]]) Bx(g, [.03, .22, .03], st, [x * w, by * yy, w * .88], [0, 0, zr]); }
    A.top = [0, hy + hr * .88, .05]; A.tail = [0, .4, -w * .8]; A.back = [0, by * 1.7, -w * .7]; A.fs = [0, .9, 1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  bambear(g, F, K, X) { // a panda: a ball with ears, then sitting up, then munching on a bamboo stick
    const dk = '#544a60', r = [.74, .62, .72][F];
    let A;
    if (!F) { A = { head: { p: [0, r, 0], r }, body: { p: [0, r, 0], r: [r, r * .95, r] } }; Sp(g, 1, K.a, A.body.p, A.body.r); feet(g, dk, .34, .4, [.28, .18, .34]); }
    else {
      const by = r, hr = [0, .62, .66][F], hy = by * 1.75 + hr * .55;
      A = { head: { p: [0, hy, .12], r: hr }, body: { p: [0, by, 0], r: [r, by, r * .92] } };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, hr, K.a, A.head.p, [1.08, .95, 1]); Sp(g, r * .62, K.b, [0, by * .85, r * .5], [1, 1.1, .6]);
      for (const s of [-1, 1]) { Rd(g, [.3, .52, .3], dk, [s * r * .8, by * 1.2, r * .35], [-.7, 0, s * .35]); Rd(g, [.36, .3, .5], dk, [s * r * .55, .16, r * .62]); Sp(g, .07, '#f59ab0', [s * r * .55, .17, r * .9], [1, 1, .4], 1); }
      if (F === 2) { const st = Grp(g, [r * .5, by * 1.2, r * .85], [.25, 0, -.55]); for (let i = 0; i < 3; i++) Cy(st, [.07, .07, .3, 6], i % 2 ? '#86cc5a' : '#6cc24f', [0, i * .31, 0]); leaf(st, [.14, .78, 0], [0, 0, -.6], .8); }
    }
    const h = A.head;
    Sp(g, .17, dk, [0, .42, -A.body.r[2] * .95]);
    for (const s of [-1, 1]) { Sp(g, h.r * .3, dk, [s * h.r * .68, h.p[1] + h.r * .72, h.p[2] - .02], [1, 1, .6]); Sp(g, h.r * .25, dk, [s * h.r * .37, h.p[1] + h.r * .05, h.p[2] + h.r * .78], [.9, 1.2, .45], 1).rotation.z = s * .4; }
    face(g, X.eyes, h.p, h.r, { gap: .36, y: .06, eye: [1.15, 1.05, 1][F], nose: '#3b2f3a' });
    A.top = [0, h.p[1] + h.r * .88, h.p[2]]; A.tail = [0, .42, -A.body.r[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .7, -r * .7]; A.fs = [.8, .9, 1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  sizzlet(g, F, K, X) { // a dragon hatchling: mostly head, then a pot belly, then a first little flame
    const D = DRAGON[K.el], r = [.5, .64, .72][F], by = [.5, .72, .86][F], hr = [.66, .62, .64][F], horn = D ? D.horn : '#fff3df', spike = D ? D.spike : '#ffb14a', rz = r * .95;
    const hy = F ? by * 1.75 + hr * .5 : 1.0, hz = .15;
    const A = { head: { p: [0, hy, hz], r: hr }, body: { p: [0, by, -.05], r: [r, by, rz] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, by * .9, rz * .4], [r * .72, by * .78, rz * .72]);
    Sp(g, hr, K.a, A.head.p, [1.05, .92, 1]); Sp(g, hr * .5, K.a, [0, hy - hr * .25, hz + hr * .75], [1.25, .7, 1]);
    for (const s of [-1, 1]) {
      Sp(g, .035, INK, [s * hr * .2, hy - hr * .12, hz + hr * 1.2], null, 1);
      Co(g, [.09, .26 + F * .08, 5], horn, [s * hr * .45, hy + hr * .82, hz - .1], [-.25, 0, -s * .35]);
      Rd(g, [.2, .3, .2], K.a, [s * r * .85, by * 1.15, rz * .5], [-.6, 0, s * .3]); Rd(g, [.32, .2, .44], K.a, [s * r * .6, .1, rz * .5]);
      for (let i = 0; i < 3; i++) Co(g, [.035, .09, 4], horn, [s * r * .6 + (i - 1) * .09, .08, rz * .5 + .25], [PI / 2, 0, 0]);
    }
    const tn = 3 + F; for (let i = 0; i < tn; i++) Sp(g, .22 - i * .035, K.a, [0, .2 + i * i * .012, -rz * .8 - i * .2], null, 1);
    const tip = [0, .24 + tn * tn * .012, -rz * .8 - tn * .2], mouth = [0, hy - hr * .3, hz + hr * 1.25];
    if (K.el === 'Leaf') { leaf(g, tip, [.5, 0, 0], 1.1); leaf(g, [tip[0], tip[1] + .1, tip[2] + .05], [-.6, 0, 0], .8, '#4a9a45'); }
    else if (K.el === 'Tide') for (const s of [-1, 1]) Oc(g, .16, D.wing, [s * .12, tip[1] + .04, tip[2] - .06], [1.3, .25, .8], [0, s * .5, s * .5]); // a tail fluke
    else if (K.el === 'Stone') { Gm(g, .2, '#8a8794', tip); for (const s of [-1, 1]) Co(g, [.05, .14, 4], spike, [s * .19, tip[1], tip[2]], [0, 0, -s * PI / 2]); } // a club tail
    else if (K.el === 'Spark') { Oc(g, .11, GL(spike, .8), [0, tip[1] + .1, tip[2]], [.5, 1.5, .5], [.5, 0, 0]); Oc(g, .11, GL(spike, .8), [0, tip[1] - .02, tip[2] - .1], [.5, 1.5, .5], [-.4, 0, 0]); }
    else Oc(g, .1, spike, tip, [.5, 1.2, 1.4]);
    for (let i = 0; i < F * 2; i++) { const a = .75 + i * .42, p = [0, by + by * Math.cos(a) * 1.02, -.05 - rz * Math.sin(a) * 1.02];
      if (K.el === 'Stone') Oc(g, .1, i % 2 ? GL('#8fe3f5', .5) : spike, p, [.8, 1.5, .8], [-a, 0, 0]); else if (K.el === 'Leaf') leaf(g, p, [-a + PI / 2, 0, 0], .6, i % 2 ? '#6cc24f' : spike); else Co(g, [.07, .18, 4], K.el === 'Spark' ? GL(spike, .6) : spike, p, [-a, 0, 0]); }
    if (K.el === 'Stone') Oc(g, .09, GL('#8fe3f5', .6), [0, hy + hr * .5, hz + hr * .82], [1, 1.3, .5], [-.5, 0, 0]); // a gem on the brow
    if (F === 2) { // what it breathes
      if (!D) flame(g, mouth, .32, [1.35, 0, 0]);
      else if (K.el === 'Leaf') flower(g, [mouth[0], mouth[1], mouth[2] + .08], '#ff9ec4', 1.1, [PI / 2, 0, 0]);
      else if (K.el === 'Tide') for (let i = 0; i < 3; i++) Sp(g, .09 - i * .02, TR('#bfe6ff', .7), [(i - 1) * .1, mouth[1] + i * .1, mouth[2] + .1 + i * .08], null, 1);
      else if (K.el === 'Spark') for (let i = 0; i < 3; i++) Oc(g, .06, GL('#ffe14a', .9), [(i - 1) * .12, mouth[1] + (i % 2) * .1, mouth[2] + .12], [.6, 1.6, .6], [0, 0, i - 1]);
    }
    face(g, X.eyes, [0, hy + .03, hz], hr, { gap: .4, eye: [1.35, 1.2, 1.1][F], nose: null, mouth: false });
    A.top = [0, hy + hr * .82, hz - .03]; A.tail = [0, .25, -rz * .8 - tn * .2]; A.back = [0, by * 1.5, -rz * .75]; A.fs = [.7, .9, 1.1][F];
    if (X.own('back')) X.sig(A.back, A.fs);
    return A;
  },
  waddlet(g, F, K, X) { // a penguin: a grey ball of fluff, then an egg with flippers, then a proud one with yellow crests
    const r = [.64, .62, .7][F], hgt = [1, 1.3, 1.45][F], y = r * hgt, beak = '#f0a23c', coat = F ? K.a : mix(K.a, '#d5dae2', .7);
    const A = { head: { p: [0, y * 1.25, .02], r: r * .95 }, body: { p: [0, y, 0], r: [r, y, r * .92] } };
    Sp(g, 1, coat, A.body.p, A.body.r); Sp(g, 1, K.b, [0, y * .8, r * .2], [r * .8, y * .74, r * .8]);
    for (const s of [-1, 1]) {
      Sp(g, r * .42, K.b, [s * r * .3, y * 1.27, r * .58], [1, 1.05, .5]);
      Rd(g, [.15, y * .8, .4], coat, [s * (r + .03), y * .98, 0], [0, 0, s * (.25 + F * .15)]); Rd(g, [.3, .1, .4], beak, [s * .26, .05, .26]);
      if (F === 2) Co(g, [.05, .34, 4], '#ffd65a', [s * r * .55, y * 1.66, r * .35], [.2, 0, -s * 1.15]);
    }
    Co(g, [.12, .24, 5], beak, [0, y * 1.14, r * .97], [PI / 2, 0, 0], [1.3, 1, .8]);
    if (!F) tuft(g, [0, y * 1.95, 0], coat, 1); else Co(g, [.14, .3, 4], coat, [0, y * .3, -r * .9], [-2.0, 0, 0], [1.4, 1, .5]);
    face(g, X.eyes, [0, y * 1.25, .02], r * .95, { gap: .34, eye: [1.4, 1.25, 1.15][F], nose: null, mouth: false, y: .04 });
    A.top = [0, y * 1.97, 0]; A.tail = [0, y * .35, -r * .9]; A.back = [0, y * 1.5, -r * .6]; A.fs = [.85, .9, 1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  oinkwatt(g, F, K, X) { // a piglet: a ball with a snout, then four trotters, then a round hog with sparking cheeks
    const r = [.7, .66, .8][F], hoof = '#e0a84a', pink = mix(K.a, '#ff8fa8', .5);
    let A;
    if (!F) { A = { head: { p: [0, r, 0], r }, body: { p: [0, r, 0], r: [r, r * .92, r] }, tail: [0, .55, -r * .95] }; Sp(g, 1, K.a, A.body.p, A.body.r); feet(g, hoof, .3, .35, [.24, .16, .28]); }
    else {
      const L = r * 1.15, by = r * .85 + .16;
      A = { head: { p: [0, by + r * .35, L * .75], r: r * .82 }, body: { p: [0, by, -.1], r: [r, r * .88, L] }, tail: [0, by + .2, -.1 - L * .97] };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, by - r * .25, -.1], [r * .85, r * .68, L * .85]);
      for (const s of [-1, 1]) for (const z of [L * .45, -L * .6]) { Cy(g, [.14, .12, .3, 7], K.a, [s * r * .5, .2, z]); Cy(g, [.115, .125, .12, 7], hoof, [s * r * .5, .06, z]); }
      Sp(g, A.head.r, K.a, A.head.p, [1.05, .95, .95]);
    }
    const h = A.head;
    Cy(g, [h.r * .3, h.r * .34, .16, 10], pink, [0, h.p[1] - h.r * .16, h.p[2] + h.r * .92], [PI / 2, 0, 0], [1.2, 1, .9]);
    for (const s of [-1, 1]) {
      Sp(g, .04, '#c96a80', [s * h.r * .12, h.p[1] - h.r * .16, h.p[2] + h.r * .92 + .08], [1, 1.3, .5], 1);
      const e = Grp(g, [s * h.r * .6, h.p[1] + h.r * .7, h.p[2] + .02], [.9, 0, -s * .5]); Co(e, [.2, .36, 4], K.a, [0, .16, 0], null, [1, 1, .5]); Co(e, [.11, .22, 4], pink, [0, .13, .05], null, [1, 1, .4]);
      if (F) Oc(g, .07 + F * .02, GL('#ffd21f', .7), [s * h.r * 1.08, h.p[1] - h.r * .05, h.p[2] + h.r * .25], [.6, 1.8, .6], [0, 0, s * .5]);
    }
    if (F === 2) tuft(g, [0, h.p[1] + h.r * .88, h.p[2] + .1], pink, 1, [.4, 0, 0]);
    face(g, X.eyes, [h.p[0], h.p[1] + .06, h.p[2]], h.r, { gap: .38, y: .1, eye: [1.3, 1.15, 1.05][F], nose: null, mouth: false });
    A.top = [0, h.p[1] + h.r * .86, h.p[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .9, -.15]; A.fs = [.8, .9, 1][F];
    if (X.own('tail')) X.sig(A.tail);
    return A;
  },
  tricerock(g, F, K, X) { // a baby three-horn: all head and one nub, then four stumpy legs, then proper horns
    const horn = '#fff3df', st = '#a9a6b0';
    let A;
    if (!F) { A = { head: { p: [0, .72, .18], r: .66 }, body: { p: [0, .42, -.3], r: [.46, .4, .52] } }; Sp(g, 1, K.a, A.body.p, A.body.r); feet(g, K.a, .3, .1, [.26, .18, .3]); Co(g, [.2, .4, 5], K.a, [0, .32, -.85], [-PI / 2 - .2, 0, 0]); }
    else {
      const L = [0, .7, .88][F], w = [0, .56, .68][F], by = w * .9 + .34;
      A = { head: { p: [0, by + .22, L * .95], r: [0, .6, .64][F] }, body: { p: [0, by, -.05], r: [w, w * .9, L] } };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, by - w * .28, -.05], [w * .85, w * .66, L * .88]);
      for (const s of [-1, 1]) for (const z of [L * .5, -L * .55]) { Cy(g, [.17, .19, .46, 7], K.a, [s * w * .55, .23, z]); for (let i = 0; i < 3; i++) Sp(g, .05, horn, [s * w * .55 + (i - 1) * .1, .05, z + .17], null, 1); }
      Co(g, [w * .5, L * .9, 6], K.a, [0, by - .1, -L - .2], [-PI / 2 - .25, 0, 0]);
      for (let i = 0; i < F + 2; i++) { const t = .1 - i * .32; Gm(g, .15 - i * .015, st, [0, by + w * .9 * Math.sqrt(1 - t * t) + .03, -.05 + t * L], [1, 1.1, 1], [i, i * 2, 0]); }
    }
    const h = A.head;
    Sp(g, h.r, K.a, h.p, [1.05, .95, 1]); Sp(g, h.r * .5, mix(K.a, '#fff3df', .55), [0, h.p[1] - h.r * .25, h.p[2] + h.r * .72], [1.1, .8, 1.1]);
    Co(g, [.09, [.14, .22, .3][F], 5], horn, [0, h.p[1] - h.r * .0, h.p[2] + h.r * 1.08], [1.0, 0, 0]);
    if (F) for (const s of [-1, 1]) Co(g, [.08, [0, .3, .5][F], 5], horn, [s * h.r * .5, h.p[1] + h.r * .78, h.p[2] + h.r * .42], [.7, 0, -s * .3]);
    face(g, X.eyes, h.p, h.r, { gap: .42, eye: [1.4, 1.25, 1.15][F], nose: null, y: .1 });
    A.top = [0, h.p[1] + h.r * .86, h.p[2]]; A.tail = [0, A.body.p[1], A.body.p[2] - A.body.r[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .9, -.15]; A.fs = [.8, .9, 1][F];
    if (X.own('top')) X.sig(A.top, A.fs * h.r / .64);
    return A;
  },
  // ---- themed sets: fruit, bakery, sweets, veggie patch, weather, night sky ----
  strawbun(g, F, K, X) { // a strawberry bunny: seed freckles, a leafy collar and a calyx between its ears
    const A = sitter(g, F, K, X, { feetC: K.b }), h = A.head, b = A.body;
    dots(g, '#ffe98a', b.p, b.r, 18 + F * 4, .05); dots(g, '#ffe98a', h.p, [h.r * 1.04, h.r * .94, h.r], 14, .055);
    earsL(g, h, K.a, K.b, [.4, .7, .9][F], F === 2 ? .3 : 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; leaf(g, [Math.sin(a) * .16, A.top[1] - .02, h.p[2] + Math.cos(a) * .16], [.3, -a + PI / 2, 0], .7 + F * .1); }
    Cy(g, [.03, .04, .14, 5], '#4a9a45', [0, A.top[1] + .07, h.p[2]]);
    if (F) for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; leaf(g, [Math.sin(a) * b.r[0] * .7, b.p[1] * 1.72, .05 + Math.cos(a) * b.r[2] * .7], [.2, -a + PI / 2, .5], 1, i % 2 ? '#86cc5a' : '#6cc24f'); }
    Sp(g, .2 + F * .05, '#ffffff', A.tail);
    return A;
  },
  chilipup(g, F, K, X) { // a sausage dog shaped like a chili pepper: long, glossy and tapering to a curled tip
    const dk = mix(K.a, '#7a1f1a', .4), A = walker(g, F, K, X, { w: [.36, .36, .4][F], L: [.5, .85, 1.15][F], leg: [.1, .14, .16][F], hr: [.56, .5, .52][F], legC: dk, lw: .2, faceO: { nose: '#3b2f3a', y: .08 } }), h = A.head, b = A.body;
    Sp(g, h.r * .55, K.a, [0, h.p[1] - h.r * .22, h.p[2] + h.r * .62], [1, .8, 1.5]); Sp(g, h.r * .3, K.b, [0, h.p[1] - h.r * .36, h.p[2] + h.r * 1.1], [1.2, .7, 1]);
    Sp(g, .07, '#3b2f3a', [0, h.p[1] - h.r * .2, h.p[2] + h.r * 1.42], null, 1);
    for (const s of [-1, 1]) Rd(g, [.14, .5, .3], dk, [s * h.r * .98, h.p[1] - h.r * .1, h.p[2] - .05], [0, 0, s * .2]);
    Sp(g, h.r * .32, '#5fb04a', [0, h.p[1] + h.r * .86, h.p[2] - .05], [1, .5, 1]); for (let i = 0; i < 4; i++) Sp(g, .05 - i * .006, '#4a9a45', [i * .04, h.p[1] + h.r * 1.0 + i * .07, h.p[2] - .05 - i * i * .02], null, 1);
    Sp(g, .14, '#ffffff', [-b.r[0] * .5, b.p[1] + b.r[1] * .7, b.p[2] + b.r[2] * .3], [.5, .3, 1.6], 1);
    const n = 5 + F; for (let i = 0; i < n; i++) { const t = i / (n - 1), a = t * 2.4; Sp(g, b.r[0] * .8 * (1 - t * .8), K.a, [0, A.tail[1] - .08 + (1 - Math.cos(a)) * .3, A.tail[2] + .12 - Math.sin(a) * .42 * (.7 + F * .15)], null, 1); }
    if (F === 2) for (let i = 0; i < 3; i++) Sp(g, .1 - i * .02, TR('#ffffff', .7), [0, A.tail[1] + .7 + i * .2, A.tail[2] - .1 - i * .06], null, 1);
    return A;
  },
  melonwhale(g, F, K, X) { // a watermelon whale: striped rind on top, a pink slice of a belly with seeds
    const r = [.6, .76, .92][F], y = [.9, 1.05, 1.2][F], dk = mix(K.a, '#1f5a2a', .5), A = { head: { p: [0, y, r * .35], r: r * .98 }, body: { p: [0, y, -.1], r: [r, r * .82, r * 1.3] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, '#fffaf0', [0, y - r * .16, 0], [r * .95, r * .7, r * 1.24]); Sp(g, 1, K.b, [0, y - r * .22, .02], [r * .9, r * .66, r * 1.2]);
    for (let i = 0; i < 4; i++) { const z = .55 - i * .38, k = Math.sqrt(1 - z * z) * 1.02; To(g, [1, .06, 4, 12, PI], dk, [0, y, -.1 + z * r * 1.3], null, [r * k, r * .82 * k, 1]); }
    for (let i = 0; i < 5 + F * 2; i++) Sp(g, .045, '#3b2f3a', [((i * .37) % 1 - .5) * r * 1.1, y - r * .74 + Math.abs((i * .37) % 1 - .5) * r * .5, r * (.75 - (i % 3) * .3)], [.7, 1, .5], 1);
    const t = Grp(g, [0, y + .05, -r * 1.25], [.5, 0, 0]); Co(t, [r * .4, r * .9, 5], K.a, [0, 0, -r * .3], [-PI / 2, 0, 0]);
    for (const s of [-1, 1]) { Rd(t, [r * .62, .12, r * .44], dk, [s * r * .32, 0, -r * .85], [0, s * .5, 0]); Rd(g, [r * .72, .13, r * .42], K.a, [s * r * 1.05, y - r * .35, .1], [0, s * .3, -s * .5]); }
    for (let i = 0; i < 4 + F; i++) Sp(g, .05, '#3b2f3a', [(i - (3 + F) / 2) * r * .22, y - r * (.5 + (i % 2) * .12), r * (1.02 - Math.abs(i - (3 + F) / 2) * .08)], [.7, 1, .5], 1);
    face(g, X.eyes, [0, y + .02, r * .32], r, { gap: .5, eye: [1.2, 1.1, 1][F], nose: null, y: -.05, z: .86 });
    A.top = [0, y + r * .82, 0]; A.tail = [0, y, -r * 1.3]; A.back = [0, y + r * .8, -.3]; A.fs = [.8, 1, 1.25][F];
    return A;
  },
  lemonzest(g, F, K, X) { // a lemon chick that fizzes, with a peel curl on its head
    const A = ball(g, F, K, X, { h: 1.05, feetC: '#f0a23c', faceO: { nose: null, mouth: false, y: .12 } }), b = A.body, r = b.r[0];
    Sp(g, r * .3, K.a, [0, b.p[1] + .02, -r * .95], [1, 1, 1.2]); Sp(g, r * .2, K.a, [0, A.top[1] - .03, 0], [1, .9, 1]);
    Co(g, [.12, .24, 5], '#f0a23c', [0, b.p[1] + r * .02, r * .97], [PI / 2, 0, 0], [1.3, 1, .8]);
    for (const s of [-1, 1]) Rd(g, [.14, r * .7, r * .6], mix(K.a, '#f0b320', .4), [s * (r + .02), b.p[1] - .05, -.05], [.3, 0, s * .25]);
    for (let i = 0; i < 6 + F * 2; i++) { const a = i * .9, rr = .15 - i * .008; Sp(g, .07 - i * .003, mix(K.a, '#f0b320', .3), [Math.cos(a) * rr, A.top[1] + .1 + i * .055, Math.sin(a) * rr], null, 1); }
    leaf(g, [.14, A.top[1] + .05, -.05], [0, 0, -.5], .8);
    if (F === 2) for (let i = 0; i < 5; i++) Sp(g, .07 + (i % 2) * .03, TR('#fffbe0', .6), [Math.sin(i * 1.4) * (r + .3), b.p[1] + .2 + i * .22, Math.cos(i * 1.4) * (r + .2)], null, 1);
    return A;
  },
  coconutkin(g, F, K, X) { // a coconut armadillo: a hairy brown shell in bands, a white tummy and a palm sprout
    const A = walker(g, F, K, X, { w: [.55, .58, .68][F], leg: [.1, .16, .2][F], legC: mix(K.a, '#3b2a22', .4), lw: .26, faceO: { nose: null, y: .02 } }), h = A.head, b = A.body, dk = mix(K.a, '#3b2a22', .4);
    Sp(g, 1, '#fffaf0', [0, b.p[1] - b.r[0] * .28, -.05], [b.r[0] * .87, b.r[0] * .68, b.r[2] * .9]);
    for (let i = 0; i < 3 + F; i++) { const z = .6 - i * (1.3 / (3 + F)), k = Math.sqrt(1 - z * z) * 1.03; To(g, [1, .05, 4, 12, PI], dk, [0, b.p[1], -.05 + z * b.r[2]], null, [b.r[0] * k, b.r[1] * k, 1]); }
    Co(g, [h.r * .32, h.r * .55, 6], mix(K.a, '#fff3df', .5), [0, h.p[1] - h.r * .2, h.p[2] + h.r * .95], [PI / 2, 0, 0]); Sp(g, .07, INK, [0, h.p[1] - h.r * .2, h.p[2] + h.r * 1.22], null, 1);
    for (const s of [-1, 1]) Co(g, [.13, .3, 4], K.a, [s * h.r * .55, h.p[1] + h.r * .85, h.p[2] - .05], [0, 0, -s * .3], [1, 1, .5]);
    for (const [x, yy] of [[0, .25], [-.2, -.05], [.2, -.05]]) Sp(g, .07, dk, [x * b.r[0], b.p[1] + yy * b.r[1] + .1, -.05 - b.r[2] * .97], [1, 1, .4], 1);
    if (F) { Cy(g, [.04, .05, .3, 5], '#5fa646', [0, A.back[1] + .1, A.back[2]]); for (let i = 0; i < 3 + F; i++) { const a = i / (3 + F) * PI * 2; leaf(g, [Math.sin(a) * .2, A.back[1] + .28, A.back[2] + Math.cos(a) * .2], [.5, -a + PI / 2, 0], 1 + F * .15); } }
    return A;
  },
  pinepine(g, F, K, X) { // a pineapple hedgehog: diamond scales and a tall leafy crown
    const r = [.62, .78, .92][F], dk = mix(K.a, '#b06a1a', .5), A = { head: { p: [0, r * .62, r * .62], r: r * .7 }, body: { p: [0, r * .78, -.1], r: [r * .9, r * .98, r * 1.0] } }, b = A.body;
    Sp(g, 1, K.a, b.p, b.r); Sp(g, 1, K.b, [0, r * .56, .15], [r * .8, r * .6, r * .98]);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, e = .25 + ((i * .37) % 1) * 1.5, x = Math.sin(a) * Math.sin(e), y = Math.cos(e), z = Math.cos(a) * Math.sin(e); if (z > .35 && y < .5) continue; Oc(g, .13, dk, [x * b.r[0], b.p[1] + y * b.r[1], b.p[2] + z * b.r[2]], [1, 1.3, .45], [-(PI / 2 - e) * Math.cos(a), a, 0]); }
    Co(g, [r * .28, r * .46, 5], K.b, [0, r * .45, r * 1.15], [PI / 2, 0, 0]); Sp(g, .08, INK, [0, r * .45, r * 1.4], null, 1);
    for (const s of [-1, 1]) { Sp(g, .13, K.b, [s * r * .5, r * 1.02, r * .52], [1, 1, .5], 1); for (const z of [r * .55, -r * .5]) Rd(g, [.22, .16, .28], dk, [s * r * .5, .07, z]); }
    const n = [5, 8, 11][F]; for (let i = 0; i < n; i++) { const a = i * 2.4, t = i / n; leaf(g, [Math.sin(a) * .16 * (1 - t), b.p[1] + b.r[1] * .96 + t * .3, b.p[2] + Math.cos(a) * .16 * (1 - t)], [.9 - t * .7, -a + PI / 2, 0], 1.3 + F * .2 - t * .3, i % 2 ? '#4a9a45' : '#6cc24f'); }
    face(g, X.eyes, [0, r * .7, r * .5], r * .72, { gap: .36, eye: [1.3, 1.15, 1.05][F], nose: null, mouth: false, z: .84 });
    A.top = [0, b.p[1] + b.r[1], -.1]; A.tail = [0, r * .4, -r * 1.1]; A.back = [0, r * 1.5, -.3]; A.fs = [.8, 1, 1.2][F];
    return A;
  },
  croissab(g, F, K, X) { // a croissant crab: one golden crescent whose two tips are its pincers
    const w = [.62, .8, .95][F], dk = mix(K.a, '#8a4a1a', .5), cr = w * .52, cy = cr * .92 + .16, A = { head: { p: [0, cy, .1], r: cr }, body: { p: [0, cy, 0], r: [w * 1.3, cr, w * .6] } };
    for (let i = -3; i <= 3; i++) { const t = i / 3, rr = cr * (1 - Math.abs(t) * .62), p = [t * w * 1.15, .16 + rr * .92, t * t * w * .85 - .05]; if (i) Sp(g, rr, Math.abs(i) % 2 ? mix(K.a, '#fff0c8', .3) : K.a, p, [1.1, 1, 1.1]); if (i) To(g, [rr * 1.0, .04, 4, 12], dk, [p[0] - Math.sign(t) * rr * .55, p[1], p[2] - Math.abs(t) * rr * .5], [0, PI / 2 - t * .9, 0]); }
    Sp(g, cr, K.a, [0, cy, -.05], [1.1, 1, 1.1]);
    for (const s of [-1, 1]) { Co(g, [cr * .3, cr * .7, 5], K.b, [s * w * 1.2, .2 + cr * .34, w * .98], [PI / 2, 0, -s * .5]); for (let i = 0; i < 3; i++) Bx(g, [.34, .08, .09], dk, [s * w * (.5 + i * .22), .1, -.3 - i * .05], [0, s * (i - 1) * .4, -s * .8]); }
    face(g, X.eyes, [0, cy + .02, -.05], cr * 1.08, { eye: [1.4, 1.3, 1.2][F], nose: null });
    A.top = [0, cy + cr * .95, -.05]; A.tail = [0, cy * .7, -cr]; A.back = [0, cy + cr * .7, -cr * .6]; A.fs = [.7, .85, 1][F];
    return A;
  },
  donuseal(g, F, K, X) { // a seal pup wearing an iced donut like a swim ring
    const L = [.6, .9, 1.1][F], hr = [.64, .6, .62][F], A = { head: { p: [0, [.72, .95, 1.15][F], L * .6], r: hr }, body: { p: [0, .5, -.1], r: [.6, .46, L] } }, h = A.head;
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, hr, K.a, h.p); if (F === 2) Sp(g, .46, K.a, [0, .85, L * .42], [1, 1.2, 1]);
    const R = [.5, .54, .6][F], d = Grp(g, [0, .56, -.1 - L * .15], [-.2, 0, 0]);
    To(d, [R, .22, 8, 18], '#e8b878', [0, 0, 0]); To(d, [R, .18, 8, 18], K.b, [0, 0, .08], null, [1.03, 1.03, 1]);
    for (let i = 0; i < 12; i++) { const a = i * 2.4 + .4, q = R + ((i % 3) - 1) * .1; if (Math.sin(a) < -.5) continue; Bx(d, [.1, .035, .035], ['#ffffff', '#7cc4ee', '#ffd65a', '#86cc5a'][i % 4], [Math.cos(a) * q, Math.sin(a) * q, .255], [0, 0, a * 3]); }
    for (const s of [-1, 1]) { Rd(g, [.5, .14, .34], K.a, [s * .7, .16, L * .45], [0, s * .4, -s * .3]); Rd(g, [.26, .1, .5], K.a, [s * .16, .2, -L * 1.05], [.6, s * .45, 0]); Bx(g, [.2, .015, .015], '#8a9aa6', [s * hr * .92, h.p[1] - hr * .16, h.p[2] + hr * .75], [0, -s * .5, s * .12]); }
    Sp(g, hr * .36, mix(K.a, '#ffffff', .6), [0, h.p[1] - hr * .22, h.p[2] + hr * .78], [1.3, .8, .8]);
    face(g, X.eyes, [0, h.p[1] + .03, h.p[2]], hr, { eye: [1.35, 1.2, 1.05][F], nose: '#2b2230', z: .93 });
    A.top = [0, h.p[1] + hr * .9, h.p[2]]; A.tail = [0, .4, -L - .1]; A.back = [0, 1, -.4]; A.fs = [.8, .9, 1][F];
    return A;
  },
  cupcowl(g, F, K, X) { // an owl in a cupcake wrapper with a swirl of frosting and a cherry on top
    const r = [.64, .72, .8][F], hgt = [1, 1.15, 1.3][F], y = r * hgt, wrap = '#7cc4ee', A = { head: { p: [0, y * 1.14, .03], r: r * .95 }, body: { p: [0, y, 0], r: [r, y, r * .95] } };
    Sp(g, 1, K.a, A.body.p, A.body.r);
    Cy(g, [r * 1.05, r * .78, y * .8, 12], wrap, [0, y * .42, 0]); for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; Bx(g, [.05, y * .78, .05], mix(wrap, '#ffffff', .5), [Math.sin(a) * r * .94, y * .42, Math.cos(a) * r * .94], [Math.cos(a) * .17, 0, -Math.sin(a) * .17]); }
    for (let i = 0; i < 3 + (F > 0); i++) Sp(g, r * (.86 - i * .2), i % 2 ? mix(K.b, '#ffffff', .4) : K.b, [0, y * 1.72 + i * r * .27, -.02], [1, .5, 1]);
    Sp(g, .13 + F * .02, '#e8402a', [0, y * 1.72 + (3 + (F > 0)) * r * .27 - .02, 0], null, 1); Cy(g, [.015, .015, .2, 4], '#4a9a45', [.04, y * 1.72 + (3 + (F > 0)) * r * .27 + .15, 0], [0, 0, -.3]);
    for (let i = 0; i < 6; i++) Bx(g, [.09, .03, .03], ['#ffd65a', '#ffffff', '#86cc5a'][i % 3], [Math.sin(i * 1.1) * r * .7, y * 1.82, Math.cos(i * 1.1) * r * .7], [0, i, .3]);
    for (const s of [-1, 1]) { Cy(g, [r * .34, r * .34, .06, 12], '#fff3df', [s * r * .36, y * 1.2, r * .8], [PI / 2 - .1, 0, 0]); Rd(g, [.16, y * .6, .4], mix(K.a, '#b08a5a', .4), [s * (r + .02), y * 1.02, 0], [0, 0, s * .3]); }
    Co(g, [.1, .2, 4], '#f0a23c', [0, y * 1.08, r * 1.0], [PI / 2 + .5, 0, 0]);
    face(g, X.eyes, [0, y * 1.16, .04], r, { gap: .36, eye: [1.5, 1.4, 1.3][F], nose: null, mouth: false, y: .04 });
    A.top = [0, y * 2.4, 0]; A.tail = [0, y * .4, -r * .9]; A.back = [0, y * 1.5, -r * .6]; A.fs = [.9, .95, 1][F];
    return A;
  },
  pretzelisk(g, F, K, X) { // a little snake that ties itself into a pretzel knot, sprinkled with salt
    const k = [.2, .26, .31][F], hr = [.5, .48, .5][F], n = 34, pts = []; let lo = 9;
    for (let i = 0; i < n; i++) { const t = -4 + i / (n - 1) * 8, p = [(3.3 - .4 * t * t) * Math.sin(t) * k, (3.3 - .5 * t * t) * Math.cos(t) * k, 0]; lo = Math.min(lo, p[1]); pts.push(p); }
    const kn = Grp(g, [0, 0, -.25], [-.22, 0, 0]);
    pts.forEach((p, i) => { p[1] += -lo + .2; p[2] = Math.sin(i * .8) * .05; Sp(kn, k * .78, K.a, p, null, 1); if (i % 3 === 1) Sp(kn, .05, '#ffffff', [p[0], p[1] + .02, p[2] + k * .74], null, 0); });
    const hp = [0, hr * .95, .32], A = { head: { p: hp, r: hr }, body: { p: [0, 3.3 * k, -.25], r: [3.2 * k, 3.3 * k, .3] } };
    Sp(g, hr, K.a, hp, [1.05, .9, 1.05]); Sp(g, hr * .5, K.b, [0, hp[1] - hr * .3, hp[2] + hr * .62], [1.2, .6, 1]);
    Bx(g, [.04, .03, .2], '#e8402a', [0, hp[1] - hr * .42, hp[2] + hr * 1.08]);
    for (let i = 0; i < 4; i++) Sp(g, .045, '#ffffff', [(i - 1.5) * .14, hp[1] + hr * .84 - Math.abs(i - 1.5) * .05, hp[2] + .05], null, 0);
    face(g, X.eyes, [0, hp[1] + .02, hp[2]], hr, { eye: [1.35, 1.25, 1.15][F], nose: null, gap: .38 });
    A.top = [0, hp[1] + hr * .82, hp[2]]; A.tail = [0, .3, -.5]; A.back = [0, 6.2 * k, -.4]; A.fs = [.7, .85, 1][F];
    return A;
  },
  mallowlamb(g, F, K, X) { // a marshmallow lamb: a soft squishy block on stubby legs, toasted on top when grown
    const w = [.9, 1.1, 1.3][F], hh = [.8, .9, 1.05][F], d = [.9, 1.15, 1.35][F], leg = [.14, .24, .3][F], y = leg + hh / 2, skin = '#f3c9b5';
    const A = { head: { p: [0, y + hh * .12, d * .5 + .05], r: [.5, .5, .54][F] }, body: { p: [0, y, -.05], r: [w / 2, hh / 2, d / 2] } }, h = A.head;
    Rb(g, [w, hh, d], K.a, [0, y, -.05], null, .26); if (F === 2) Rb(g, [w * .86, .12, d * .86], '#e8b878', [0, y + hh / 2 - .03, -.05], null, .05);
    Rb(g, [w * 1.01, hh * .2, d * 1.01], K.b, [0, y - hh * .12, -.05], null, .08);
    legs4(g, skin, w * .3, d * .28, -d * .35, leg + .1, .18);
    Sp(g, h.r, skin, h.p, [1, .95, .9]); Sp(g, h.r * .6, K.a, [0, h.p[1] + h.r * .75, h.p[2] - .08], [1.3, .7, 1]);
    for (const s of [-1, 1]) Rd(g, [.3, .13, .17], skin, [s * (h.r + .1), h.p[1] + .05, h.p[2] - .1], [0, 0, -s * .5]);
    Sp(g, .16, K.a, [0, y, -.05 - d / 2 - .06]);
    face(g, X.eyes, h.p, h.r, { eye: [1.3, 1.15, 1.05][F] });
    A.top = [0, h.p[1] + h.r * 1.05, h.p[2] - .1]; A.tail = [0, y, -.05 - d / 2]; A.back = [0, y + hh / 2, -.2]; A.fs = [.7, .85, 1][F];
    return A;
  },
  candraffe(g, F, K, X) { // a candy cane giraffe: red and white stripes up a long neck, little cane-hook horns
    const A0 = { w: [.42, .42, .5][F], L: [.42, .52, .62][F], leg: [.3, .6, .85][F], hr: [.58, .5, .5][F] }, nk = [.25, .8, 1.3][F];
    const w = A0.w, L = A0.L, by = A0.leg + w * .8, hp = [0, by + w * .5 + nk + A0.hr * .6, L * .75 + nk * .22];
    const A = { head: { p: hp, r: A0.hr }, body: { p: [0, by, -.05], r: [w, w * .88, L] } };
    Sp(g, 1, K.a, A.body.p, A.body.r);
    for (const s of [-1, 1]) for (const z of [L * .55, -L * .6]) { Cy(g, [.09, .1, A0.leg + .12, 7], K.a, [s * w * .55, (A0.leg + .12) / 2, z]); for (let i = 0; i < Math.round(A0.leg / .28); i++) Cy(g, [.1, .105, .1, 7], K.b, [s * w * .55, .28 + i * .28, z]); Cy(g, [.11, .12, .12, 7], '#6b5560', [s * w * .55, .06, z]); }
    const m = Math.max(2, Math.round((nk + w * .6) / .16)); for (let i = 0; i < m; i++) { const t = i / (m - 1); Cy(g, [.2 - t * .04, .21 - t * .04, (nk + w * .6) / m + .01, 8], i % 2 ? K.b : K.a, [0, by + w * .2 + t * (nk + w * .3), L * .6 + t * nk * .22], [.17, 0, 0]); }
    for (let i = 0; i < 3; i++) To(g, [1, .07, 4, 12, PI], K.b, [0, by, -.05 + (.5 - i * .5) * L], null, [w * Math.sqrt(1 - (.5 - i * .5) ** 2) * 1.02, w * .88 * Math.sqrt(1 - (.5 - i * .5) ** 2) * 1.02, 1]);
    Sp(g, A0.hr, K.a, hp, [1, .95, 1]); Sp(g, A0.hr * .5, mix(K.a, '#ffd9de', .7), [0, hp[1] - A0.hr * .28, hp[2] + A0.hr * .7], [1.1, .8, 1.2]);
    for (const s of [-1, 1]) { Rd(g, [.3, .14, .1], K.a, [s * A0.hr * 1.0, hp[1] + A0.hr * .3, hp[2] - .08], [0, 0, s * .4]); const c = Grp(g, [s * A0.hr * .36, hp[1] + A0.hr * .8, hp[2] - .05], [0, 0, -s * .15]); Cy(c, [.04, .04, .26, 6], K.b, [0, .13, 0]); To(c, [.08, .04, 5, 8, PI], K.b, [s * .08, .26, 0]); }
    Co(g, [.07, .3, 4], K.b, [0, by + .1, -.05 - L - .1], [-2.2, 0, 0]);
    face(g, X.eyes, hp, A0.hr, { eye: [1.35, 1.2, 1.1][F], nose: null });
    A.top = [0, hp[1] + A0.hr * .88, hp[2]]; A.tail = [0, by + .1, -.05 - L]; A.back = [0, by + w * .8, -.15]; A.fs = [.7, .8, .9][F];
    return A;
  },
  jellifrog(g, F, K, X) { // a wobbly jelly frog you can see through, with fruit bits inside
    const r = [.6, .74, .88][F], y = r * .8 + .05, J = TR(K.a, .62), A = { head: { p: [0, y + r * .1, .1], r: r * .98 }, body: { p: [0, y, 0], r: [r * 1.05, r * .8, r] } };
    for (let i = 0; i < 3 + F; i++) Sp(g, .1 + (i % 2) * .04, ['#ff7a8a', '#ffd65a', '#ff9a3c', '#c9b5ff', '#ffffff'][i], [Math.sin(i * 2.1) * r * .45, y - r * .1 + (i % 3) * r * .2, -.1 + Math.cos(i * 2.1) * r * .4], null, 1);
    Sp(g, 1, J, A.body.p, A.body.r); Sp(g, 1, K.b, [0, y * .42, 0], [r * .96, r * .22, r * .92]);
    for (const s of [-1, 1]) { Sp(g, r * .3, J, [s * r * .45, y + r * .72, r * .25]); Sp(g, r * .2, '#ffffff', [s * r * .45, y + r * .76, r * .38], null, 1); eyeAt(g, X.eyes, r * .13, [s * r * .45, y + r * .78, r * .55]); Rd(g, [.4, .16, .5], K.a, [s * r * .85, .08, -.05], [0, s * .5, 0]); Rd(g, [.24, .12, .3], K.a, [s * r * .5, .06, r * .7]); }
    Bx(g, [r * .5, .03, .03], INK, [0, y + r * .12, r * .98]); for (const s of [-1, 1]) { Bx(g, [.08, .03, .03], INK, [s * r * .27, y + r * .15, r * .96], [0, 0, s * .6]); V(g, new THREE.Mesh(G('Circle', .1, 10), MX('blush#ff8a9a', '#ff8a9a', { transparent: true, opacity: .55 })), [s * r * .62, y + r * .2, r * .8], [0, s * .6, 0]); }
    A.top = [0, y + r * .8, 0]; A.tail = [0, y * .6, -r]; A.back = [0, y + r * .6, -r * .5]; A.fs = [.8, .9, 1][F];
    return A;
  },
  carrofox(g, F, K, X) { // a fox with a carrot for a tail and a tuft of carrot greens
    const dk = mix(K.a, '#7a3a1a', .5), A = walker(g, F, K, X, { legC: dk, faceO: { nose: '#3b2f3a' } }), h = A.head;
    Sp(g, h.r * .42, K.b, [0, h.p[1] - h.r * .28, h.p[2] + h.r * .72], [1.2, .75, 1.2]); earsP(g, h, K.a, dk, .9 + F * .1);
    const t = Grp(g, A.tail, [.5, 0, 0], .7 + F * .25); Co(t, [.3, 1.1, 8], K.a, [0, 0, -.5], [-PI / 2, 0, 0]); for (let i = 0; i < 3; i++) To(t, [.25 - i * .07, .025, 4, 10], dk, [0, 0, -.2 - i * .27]);
    Co(t, [.1, .2, 6], K.b, [0, 0, -1.1], [-PI / 2, 0, 0]);
    for (let i = 0; i < 3 + F; i++) leaf(g, [(i - (2 + F) / 2) * .1, A.top[1] + .1, h.p[2] - .05], [0, i * 1.3, (i - (2 + F) / 2) * -.35], 1 + F * .15, i % 2 ? '#86cc5a' : '#5fb04a');
    return A;
  },
  pumpkit(g, F, K, X) { // a kitten curled inside a pumpkin, with a stem hat and a curly vine tail
    const r = [.62, .74, .86][F], y = r * .82, dk = mix(K.a, '#b0541a', .45), hr = [.6, .56, .58][F], A = { head: { p: [0, y + r * .55 + hr * .45, r * .2], r: hr }, body: { p: [0, y, 0], r: [r, r * .82, r] } }, h = A.head;
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; Sp(g, 1, i % 2 ? K.a : mix(K.a, dk, .35), [Math.sin(a) * r * .5, y, Math.cos(a) * r * .5], [r * .56, r * .82, r * .56]); }
    Sp(g, hr, K.a, h.p, [1.08, .92, .98]); earsP(g, h, K.a, '#f59ab0', .85 + F * .08);
    Cy(g, [.07, .1, .22, 6], '#5fa646', [0, h.p[1] + hr * .9, h.p[2]], [0, 0, .2]); leaf(g, [.15, h.p[1] + hr * .88, h.p[2]], [0, 0, -.4], .9);
    for (const s of [-1, 1]) { Rd(g, [.24, .16, .3], K.b, [s * r * .35, .07, r * .85]); Bx(g, [.3, .02, .02], dk, [s * hr * .95, h.p[1] - hr * .2, h.p[2] + hr * .6], [0, -s * .5, s * .15]); }
    for (let i = 0; i < 8 + F * 2; i++) { const a = i * .8; Sp(g, .07, '#5fa646', [Math.cos(a) * .14 - r * .2, y * .6 + i * .07, -r * 1.02 - Math.sin(a) * .14 - i * .015], null, 1); }
    if (F === 2) for (const s of [-1, 1]) Co(g, [.1, .18, 3], '#ffe27a', [s * r * .3, y + r * .1, r * .96], [PI / 2 + .2, 0, s * .2], [1, 1, .4]);
    face(g, X.eyes, h.p, hr, { eye: [1.35, 1.2, 1.1][F] });
    A.top = [0, h.p[1] + hr * .86, h.p[2]]; A.tail = [0, y * .6, -r]; A.back = [0, y + r * .7, -r * .5]; A.fs = [.8, .9, 1][F];
    return A;
  },
  peapillar(g, F, K, X) { // three peas in a pod, each with its own face: one, then two, then all three awake
    const r = [.42, .46, .5][F], n = 3, pod = mix(K.a, '#3f8a3a', .5), A = { head: { p: [0, r + .16, r * .3], r }, body: { p: [0, r + .1, 0], r: [r * 3.1, r, r] } };
    Sp(g, 1, pod, [0, r * .62 + .08, -.05], [r * 3.5, r * .75, r * 1.25]); Sp(g, 1, mix(pod, '#ffffff', .25), [0, r * .7 + .1, .02], [r * 3.2, r * .5, r * 1.05]);
    for (let i = 0; i < n; i++) { const x = (i - 1) * r * 1.9, yy = r + .18 - Math.abs(i - 1) * .06, awake = i === 1 || F === 2 || (F === 1 && i === 0); Sp(g, r * (i === 1 ? 1 : .88), i === 1 ? K.a : K.b, [x, yy, .05]);
      if (awake) face(g, X.eyes, [x, yy, .05], r * (i === 1 ? 1 : .88), { eye: 1.3, nose: null }); else for (const s of [-1, 1]) Bx(g, [.1, .03, .03], INK, [x + s * r * .3, yy, .05 + r * .82], [0, 0, s * .2]); }
    for (const s of [-1, 1]) Co(g, [r * .3, r * .8, 5], pod, [s * r * 3.5, r * .75, -.05], [0, 0, -s * 1.9]);
    Cy(g, [.03, .04, .3, 5], '#5fa646', [-r * 3.6, r * 1.2, -.05], [0, 0, .7]); leaf(g, [-r * 3.75, r * 1.45, -.05], [0, 0, .9], 1);
    for (let i = 0; i < 6; i++) { const a = i * .9; Sp(g, .05, '#86cc5a', [r * 3.7 + i * .05, r + .1 + i * .07, -.05 + Math.sin(a) * .1], null, 1); }
    A.top = [0, r * 2 + .16, .05]; A.tail = [r * 3.6, r, 0]; A.back = [0, r * 1.2, -r]; A.fs = [.7, .8, .9][F];
    return A;
  },
  shroomouse(g, F, K, X) { // a tiny mouse under a spotted mushroom cap, with big round ears and a long tail
    const A = sitter(g, F, K, X, { r: [.5, .52, .6][F], feetC: '#f3c9b5' }), h = A.head, b = A.body, cap = '#8f7fd9', R = h.r * [1.15, 1.35, 1.6][F];
    earsR(g, { p: [h.p[0], h.p[1] - h.r * .25, h.p[2]], r: h.r * 1.45 }, K.a, '#f59ab0', 1.1);
    Cy(g, [R * .5, R * .62, .1, 10], '#fff3df', [0, A.top[1] - .02, h.p[2] - .05]); Sp(g, R, cap, [0, A.top[1] + .03, h.p[2] - .05], [1, .55, 1]);
    for (let i = 0; i < 5 + F; i++) { const a = i * 2.4, e = .3 + (i % 3) * .3; Sp(g, R * .14, '#ffffff', [Math.sin(a) * Math.sin(e) * R, A.top[1] + .03 + Math.cos(e) * R * .55, h.p[2] - .05 + Math.cos(a) * Math.sin(e) * R], [1, .5, 1], 1); }
    for (let i = 0; i < 9 + F * 2; i++) { const t = i / 10; Sp(g, .05, '#f3c9b5', [Math.sin(t * 3) * .25, .1 + t * t * .5, -b.r[2] - t * .6], null, 1); }
    for (const s of [-1, 1]) Bx(g, [.26, .015, .015], '#8a7a70', [s * h.r * .95, h.p[1] - h.r * .2, h.p[2] + h.r * .6], [0, -s * .5, s * .12]);
    return A;
  },
  snowfox(g, F, K, X) { // a snow fox with a big fluffy tail, icy ear tips and a snowflake on its forehead
    const ice = '#8fd4ff', A = walker(g, F, K, X, { legC: mix(K.a, ice, .5), faceO: { nose: '#3b5a7a', blush: '#9fd0ff' } }), h = A.head;
    Sp(g, h.r * .42, '#ffffff', [0, h.p[1] - h.r * .28, h.p[2] + h.r * .72], [1.2, .75, 1.2]); earsP(g, h, K.a, ice, .9 + F * .1);
    const n = 3 + F; for (let i = 0; i < n; i++) { const t = i / (n - 1); Sp(g, (.26 + Math.sin(t * PI) * .16) * (.8 + F * .15), i === n - 1 ? ice : K.a, [0, A.tail[1] + t * .5, A.tail[2] - .1 - t * .55]); }
    const f = Grp(g, [0, h.p[1] + h.r * .5, h.p[2] + h.r * .86], [-.5, 0, 0], .7 + F * .15); for (let i = 0; i < 3; i++) Bx(f, [.3, .05, .03], GL(ice, .5), [0, 0, 0], [0, 0, i * PI / 3]);
    tuft(g, [0, A.body.p[1] - .05, A.body.p[2] + A.body.r[2] * .95], '#ffffff', 1 + F * .2, [1.9, 0, 0]);
    if (F === 2) for (let i = 0; i < 4; i++) Oc(g, .07, GL('#ffffff', .6), [Math.sin(i * 1.7) * 1.1, .6 + i * .4, Math.cos(i * 1.7) * .9], [1, 1, .3]);
    return A;
  },
  sunlion(g, F, K, X) { // a lion cub whose mane is a ring of sun rays that grows as it does
    const A = sitter(g, F, K, X, { faceO: { nose: '#c9703c' } }), h = A.head, n = [8, 12, 14][F];
    for (let i = 0; i < n; i++) { const a = i / n * PI * 2; Co(g, [.2, [.4, .55, .72][F], 4], i % 2 ? GL('#ff9a3c', .25) : GL('#ffd21f', .3), [Math.sin(a) * h.r * 1.12, h.p[1] + Math.cos(a) * h.r * 1.08, h.p[2] - .02], [0, 0, -a], [1, 1, .5]); }
    earsR(g, h, K.a, '#ff9a3c', .9); Sp(g, h.r * .4, K.b, [0, h.p[1] - h.r * .26, h.p[2] + h.r * .76], [1.3, .8, .8]);
    const b = A.body; for (let i = 0; i < 4; i++) Sp(g, .07, K.a, [0, .2 + i * .1, -b.r[2] - i * .12], null, 1); Co(g, [.13, .26, 4], GL('#ff9a3c', .25), [0, .62, -b.r[2] - .52], [-.6, 0, 0]);
    return A;
  },
  dripfrog(g, F, K, X) { // a raindrop-shaped frog; grown up it carries a leaf umbrella
    const r = [.58, .7, .82][F], y = r * .85 + .05, A = { head: { p: [0, y + r * .05, .05], r: r * .98 }, body: { p: [0, y, 0], r: [r, r * .85, r] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Co(g, [r * .72, r * 1.1, 10], K.a, [0, y + r * .95, 0]); Sp(g, 1, K.b, [0, y - r * .25, r * .2], [r * .75, r * .55, r * .8]);
    Sp(g, r * .16, '#ffffff', [-r * .4, y + r * .6, r * .55], [1, 1.6, .4], 1);
    for (const s of [-1, 1]) { Sp(g, r * .26, K.a, [s * r * .5, y + r * .6, r * .4]); Sp(g, r * .18, '#ffffff', [s * r * .5, y + r * .63, r * .52], null, 1); eyeAt(g, X.eyes, r * .12, [s * r * .5, y + r * .65, r * .68]); Rd(g, [.4, .16, .5], K.a, [s * r * .82, .08, -.05], [0, s * .5, 0]); Rd(g, [.24, .12, .3], K.a, [s * r * .45, .06, r * .72]); V(g, new THREE.Mesh(G('Circle', .1, 10), MX('blush#ff8a9a', '#ff8a9a', { transparent: true, opacity: .55 })), [s * r * .62, y + r * .15, r * .8], [0, s * .6, 0]); }
    Bx(g, [r * .4, .03, .03], INK, [0, y + r * .1, r * .99]);
    if (F === 2) { const u = Grp(g, [r * .95, 0, .2], [0, 0, -.15]); Cy(u, [.03, .03, y * 2.6, 5], '#5fa646', [0, y * 1.3, 0]); Sp(u, .8, '#6cc24f', [0, y * 2.6, 0], [1, .3, 1]); for (let i = 0; i < 3; i++) Oc(g, .06, '#bfe6fb', [r * .95 - .5 + i * .5, y * 2.3 - (i % 2) * .2, .2 + (i - 1) * .5], [1, 1.8, 1]); }
    A.top = [0, y + r * 1.45, 0]; A.tail = [0, y * .6, -r]; A.back = [0, y + r * .6, -r * .6]; A.fs = [.8, .9, 1][F];
    return A;
  },
  twistret(g, F, K, X) { // a ferret whose body is a little whirlwind, with leaves caught in the spin
    const n = [4, 6, 8][F], hr = [.58, .54, .56][F], top = .3 + n * .2, A = { head: { p: [0, top + hr * .75, .1], r: hr }, body: { p: [0, top / 2, 0], r: [.6, top / 2, .6] } }, h = A.head;
    for (let i = 0; i < n; i++) { const t = i / (n - 1 || 1), rr = .16 + t * (.3 + F * .08); Sp(g, 1, i % 2 ? K.b : K.a, [Math.sin(i * 1.3) * .08, .14 + i * .2, Math.cos(i * 1.3) * .08], [rr, .15, rr]); }
    Sp(g, hr, K.a, h.p, [1.05, .92, 1]); earsR(g, h, K.a, '#f59ab0', .8); Sp(g, hr * .38, '#ffffff', [0, h.p[1] - hr * .26, h.p[2] + hr * .76], [1.3, .8, .8]);
    for (const s of [-1, 1]) { Sp(g, hr * .22, mix(K.a, '#5b6a80', .5), [s * hr * .36, h.p[1] + hr * .06, h.p[2] + hr * .8], [1.1, 1, .4], 1); Rd(g, [.16, .26, .16], K.a, [s * .34, top - .1, .3], [-.8, 0, s * .3]); }
    for (let i = 0; i < 2 + F; i++) leaf(g, [Math.sin(i * 2.3) * (.5 + i * .12), .3 + i * .32, Math.cos(i * 2.3) * (.5 + i * .12)], [i, i * 2, .5], .7, i % 2 ? '#ffb14a' : '#86cc5a');
    face(g, X.eyes, h.p, hr, { eye: [1.3, 1.2, 1.1][F], nose: '#3b2f3a', gap: .36, y: .06 });
    A.top = [0, h.p[1] + hr * .86, h.p[2]]; A.tail = [0, .15, 0]; A.back = [0, top * .8, -.45]; A.fs = [.8, .9, 1][F];
    return A;
  },
  moonbun(g, F, K, X) { // a sleepy lilac bunny that carries a slice of moon on its back
    const A = sitter(g, F, K, X, { feetC: K.b }), h = A.head, b = A.body, gold = GL('#ffe27a', .5);
    earsL(g, h, K.a, K.b, [.45, .75, .95][F], .12);
    Oc(g, .11 + F * .02, gold, [0, h.p[1] + h.r * .5, h.p[2] + h.r * .84], [1, 1, .3], [-.5, 0, 0]);
    const m = Grp(g, [-.25, b.p[1] * 1.7, -b.r[2] - .15], [.15, 0, .5], .9 + F * .3); To(m, [.62, .2, 6, 14, PI * 1.25], gold, [0, 0, 0], [0, 0, PI * .4], [1, 1, .6]);
    Sp(g, .2 + F * .05, '#ffffff', [0, b.p[1] * .5, -b.r[2]]);
    if (F === 2) for (let i = 0; i < 4; i++) Oc(g, .07, gold, [Math.sin(i * 1.8) * 1.05, .8 + i * .38, Math.cos(i * 1.8) * .8 - .2], [1, 1.5, 1]);
    return A;
  },
  starjelly(g, F, K, X) { // a jellyfish with a five-pointed star for a bell and glowing tips on its tentacles
    const r = [.56, .68, .8][F], y = [1.0, 1.25, 1.5][F], J = TR(K.a, .8), gold = GL(K.b, .6), A = { head: { p: [0, y, 0], r: r * .98 }, body: { p: [0, y, 0], r: [r, r * .8, r] } };
    Sp(g, 1, K.a, [0, y, 0], [r, r * .8, r]); Sp(g, 1, J, [0, y - r * .25, 0], [r * 1.12, r * .4, r * 1.12]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; Co(g, [r * .42, r * .8, 4], gold, [Math.sin(a + .3) * r * 1.1, y - r * .12, Math.cos(a + .3) * r * 1.1], [Math.cos(a + .3) * 1.75, 0, -Math.sin(a + .3) * 1.75], [1, 1, .6]); }
    const n = [4, 5, 6][F]; for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + .3, len = 3 + F + (i % 2); for (let j = 0; j < len; j++) Sp(g, .075 - j * .006, j === len - 1 ? gold : K.a, [Math.sin(a) * r * .55 + Math.sin(j * 1.2 + i) * .06, y - r * .55 - j * .15, Math.cos(a) * r * .55 + Math.cos(j * 1.2 + i) * .06], null, 1); }
    face(g, X.eyes, [0, y - .02, 0], r, { eye: [1.3, 1.2, 1.1][F], nose: null, y: -.02 });
    A.top = [0, y + r * .78, 0]; A.tail = [0, y - r, -r * .4]; A.back = [0, y + r * .5, -r * .6]; A.fs = [.8, .9, 1][F];
    return A;
  },
  cometail(g, F, K, X) { // a slim ferret that streaks about, trailing a glowing comet for a tail
    const dk = mix(K.a, '#2f3a8a', .5), A = walker(g, F, K, X, { w: [.36, .32, .36][F], L: [.5, .9, 1.2][F], leg: [.1, .16, .2][F], hr: [.56, .48, .5][F], legC: dk, lw: .18, faceO: { nose: '#3b2f3a', y: .08 } }), h = A.head, b = A.body;
    earsP(g, h, K.a, dk, .55 + F * .05); Sp(g, h.r * .45, '#ffffff', [0, h.p[1] - h.r * .26, h.p[2] + h.r * .7], [1.1, .75, 1.3]);
    for (const s of [-1, 1]) Sp(g, h.r * .3, dk, [s * h.r * .38, h.p[1] + h.r * .1, h.p[2] + h.r * .74], [1.2, .8, .4], 1);
    for (let i = 0; i < 2 + F; i++) To(g, [1, .05, 4, 12, PI], dk, [0, b.p[1], b.p[2] + (.3 - i * .4) * b.r[2]], null, [b.r[0] * Math.sqrt(1 - (.3 - i * .4) ** 2) * 1.03, b.r[1] * Math.sqrt(1 - (.3 - i * .4) ** 2) * 1.03, 1]);
    const n = 6 + F * 2; for (let i = 0; i < n; i++) { const t = i / (n - 1); Sp(g, (.3 + F * .04) * (1 - t * .85), GL(mix('#fff6c8', '#7fd0ff', t), .7 - t * .3), [Math.sin(t * 4) * .06, A.tail[1] + .1 + t * .5, A.tail[2] - .15 - t * (.9 + F * .3)], null, 1); }
    for (let i = 0; i < 2 + F; i++) Oc(g, .06, GL('#fff3a0', .9), [Math.sin(i * 2) * .3, A.tail[1] + .3 + i * .16, A.tail[2] - .5 - i * .3], [1, 1.5, 1]);
    Oc(g, .1, GL('#fff3a0', .8), [0, h.p[1] + h.r * .55, h.p[2] + h.r * .82], [1, 1, .3], [-.5, 0, 0]);
    return A;
  },
  ringbear(g, F, K, X) { // a round, dozy bear cub that wears a planet's ring and, later, a tiny moon
    const A = ball(g, F, K, X, { feetC: mix(K.a, '#8a5a3c', .4), faceO: { nose: '#3b2f3a', y: .12 } }), b = A.body, r = b.r[0];
    earsR(g, { p: [0, b.p[1] + r * .1, 0], r: r * 1.05 }, K.a, K.b, 1); Sp(g, r * .34, '#fff3df', [0, b.p[1] - r * .12, r * .82], [1.3, .8, .7]);
    for (let i = 0; i < 2; i++) Sp(g, 1, mix(K.a, '#c98a5a', .3), [0, b.p[1] - r * (.25 + i * .32), -.02], [r * (1.0 - i * .09), .07, r * (1.0 - i * .09)]);
    const ring = Grp(g, [0, b.p[1] - r * .05, 0], [.3, 0, .22]); To(ring, [r * 1.45, .09, 4, 22], K.b, [0, 0, 0], [PI / 2, 0, 0], [1, 1, .35]); To(ring, [r * 1.22, .06, 4, 22], mix(K.b, '#ffffff', .5), [0, 0, 0], [PI / 2, 0, 0], [1, 1, .35]);
    if (F) Sp(g, .14 + F * .03, '#e9e4ff', [r * 1.5, b.p[1] + r * .9, .2], null, 1); if (F === 2) Oc(g, .09, GL('#fff3a0', .8), [-r * 1.4, b.p[1] + r * 1.1, -.2], [1, 1.5, 1]);
    return A;
  },
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
    if (F) tuft(g, [0, b.p[1] + b.r[1] * .55, b.p[2] + b.r[2] * .85], K.b, [0, 1, 1.3][F], [2.0, 0, 0]); if (F) for (const s of [-1, 1]) Rd(g, [.2, .3, .2], K.a, [s * b.r[0] * .55, b.p[1] + b.r[1] * .35, b.p[2] + b.r[2] * .82], [-.6, 0, s * .2]);
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
    for (const s of [-1, 1]) for (const z of [w * .55, -w * .75]) Rd(g, [.32, .34, .38], K.a, [s * w * .82, .15, z]);
    Co(g, [.12, .34, 4], K.a, [0, .3, -w * 1.12], [-1.9, 0, 0]);
    if (F === 2) for (const s of [-1, 1]) Gm(g, .2, '#86cc5a', [s * w * .7, .9, -.5], [1, .5, 1]);
    face(g, X.eyes, A.head.p, A.head.r, { eye: [1.3, 1.15, 1.05][F], nose: null });
    for (let i = 0; i < [3, 5, 6][F]; i++) { const a = i / [3, 5, 6][F] * PI * 2 + .5; Cy(g, [.13, .13, .03, 6], '#93b866', [Math.sin(a) * w * .5, .42 + w * .66, -.1 + Math.cos(a) * w * .52], [Math.cos(a) * .7, 0, -Math.sin(a) * .7]); }
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
    for (const s of [-1, 1]) Rd(g, [.32, .14, .18], skin, [s * (A.head.r + .1), A.head.p[1] + .05, A.head.p[2] - .1], [0, 0, -s * .5]);
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
      Rd(g, [.22, .12, .32], '#f0a23c', [s * .24, .05, .3]);
      if (F) Co(g, [.12, .3 + F * .1, 4], K.a, [s * r * .62, y * 2 - .2, 0], [0, 0, -s * .5]);
    }
    Co(g, [.1, .2, 4], '#f0a23c', [0, y * 1.06, r * .98], [PI / 2 + .5, 0, 0]);
    face(g, X.eyes, [0, y * 1.14, .02], r, { gap: .36, eye: [1.5, 1.4, 1.3][F], nose: null, mouth: false, y: .04 });
    for (const s of [-1, 1]) Bx(g, [r * .34, .045, .05], mix(K.a, '#5b3a34', .45), [s * r * .36, y * 1.18 + r * .4, r * .82], [0, 0, -s * .35]);
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
    tuft(g, [0, A.body.p[1] + (F ? .05 : .1), A.body.p[2] + A.body.r[2] * (F ? .96 : .9)], K.b, [.8, 1, 0][F], [1.9, 0, 0]);
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
      Rb(g, [w, hh, d], crust, [0, hh / 2 + .08, 0], null, .16); Rb(g, [w - .2, hh - .18, d + .05], K.a, [0, hh / 2 + .09, 0], null, .12);
      for (const s of [-1, 1]) Sp(g, w * .27, crust, [s * w * .25, hh + .05, 0], [1, .6, d * 1.9]);
      if (F === 2) { for (let i = 0; i < 4; i++) Co(g, [.12, .26, 4], crust, [(i - 1.5) * .34, hh + .32, -.2]); for (const s of [-1, 1]) Bx(g, [.04, .3, .04], '#ffffff', [s * .5, hh + .7, 0], [0, 0, s * .2]); }
    }
    const b = A.body;
    for (const s of [-1, 1]) { Rd(g, [.36, .18, .5], crust, [s * b.r[0] * .8, .08, .3], [0, -s * .4, 0]); if (!F) Sp(g, .2, K.a, [s * .34, b.p[1] + b.r[1], .22]); }
    if (F) { for (const s of [-1, 1]) Rd(g, [.2, .3, .16], crust, [s * (b.r[0] + .06), b.p[1] - .05, .12], [0, 0, s * .5]); Bx(g, [.5, .05, .04], INK, [0, b.p[1] - .12, b.r[2] + .05]); for (const s of [-1, 1]) Bx(g, [.05, .12, .04], INK, [s * .26, b.p[1] - .07, b.r[2] + .05], [0, 0, -s * .5]); face(g, X.eyes, [0, b.p[1] + .16, b.r[2] + .06 - .62], .7, { gap: .52, y: .1, eye: [1, 1.25, 1.15][F], nose: null, mouth: false }); }
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
      for (const s of [-1, 1]) { Oc(g, .4, mix(K.a, '#e08a1c', .45), [s * (r + .02), by, -.05], [.3, F === 2 ? 1.1 : .7, F === 2 ? 1.3 : .9], [.4, 0, s * .2]); Cy(g, [.04, .04, .3, 4], '#f0a23c', [s * .22, .15, 0]); Rd(g, [.22, .07, .3], '#f0a23c', [s * .22, .025, .08]); }
    }
    const h = A.head;
    Co(g, [.13, .26, 4], '#f0a23c', [0, h.p[1] - h.r * .12, h.p[2] + h.r * .98], [PI / 2, 0, 0], [1.2, 1, .8]);
    face(g, X.eyes, h.p, h.r, { eye: [1.3, 1.15, 1.1][F], nose: null, mouth: false, y: .1 });
    if (F) { tuft(g, [0, A.body.p[1] + .1, -A.body.r[2] * .95], mix(K.a, '#e08a1c', .45), 1.1 + F * .2, [-1.2, 0, 0]); Sp(g, A.body.r[0] * .62, K.b, [0, A.body.p[1] - .12, A.body.r[2] * .5], [1, 1, .7]); }
    A.top = [0, h.p[1] + h.r * .92, h.p[2] - .05]; A.tail = [0, A.body.p[1], -A.body.r[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .85, -.3]; A.fs = [.9, 1, .9][F];
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  magmutt(g, F, K, X) { // a chunky puppy made of blocks, with rock plates and glowing cracks
    const rock = '#4a3f45', lava = GL('#ff7a2c', .8), L = [.5, .68, .85][F], by = [.6, .78, .95][F];
    const A = { head: { p: [0, by + [.42, .5, .58][F], L * .85], r: [.62, .62, .64][F] }, body: { p: [0, by, -.05], r: [.52, .46, L] } };
    Rb(g, [1, .86, L * 2], K.a, [0, by, -.05], null, .2); Rb(g, [.7, .2, L * 1.5], K.b, [0, by - .36, 0], null, .09);
    legs4(g, rock, .34, L * .6, -L * .7, by - .3, .3);
    const h = A.head;
    Rb(g, [h.r * 1.9, h.r * 1.6, h.r * 1.6], K.a, h.p, null, .24); Rb(g, [h.r * 1.05, h.r * .62, .4], K.b, [0, h.p[1] - h.r * .36, h.p[2] + h.r * .85]);
    for (const s of [-1, 1]) { Rb(g, [.3, .5 + F * .08, .16], rock, [s * h.r * .98, h.p[1] + h.r * .25, h.p[2] - .1], [0, 0, s * .25]); Bx(g, [.04, .34, .07], lava, [s * .505, by + .05, L * .35], [s * .6, 0, 0]); Bx(g, [.04, .26, .07], lava, [s * .505, by - .05, -L * .4], [-s * .7, 0, 0]); if (F === 2) Co(g, [.12, .4, 4], rock, [s * .42, h.p[1] + h.r * 1.02, h.p[2] - .05], [0, 0, -s * .3]); }
    Gm(g, .2 + F * .06, rock, [0, h.p[1] + h.r * .8, h.p[2] + .1], [1.2, .6, 1]);
    if (F === 2) for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; Gm(g, .22, rock, [Math.sin(a) * .58, by + .42 + Math.cos(a) * .1, L * .5 + Math.cos(a) * .12], null, [a, a, 0]); }
    const t = Grp(g, [0, by + .2, -L - .1], [-.7, 0, 0]); Bx(t, [.2, .2, .5 + F * .15], rock, [0, 0, -.2]); Gm(t, .16 + F * .05, lava, [0, 0, -.5 - F * .15]);
    face(g, X.eyes, [0, h.p[1] + .05, h.p[2] - .1], h.r * 1.05, { z: .92, eye: [1.3, 1.15, 1.05][F], nose: '#2b2230', gap: .4 });
    Rd(g, [.18, .09, .08], '#ff7a9a', [0, h.p[1] - h.r * .66, h.p[2] + h.r * 1.1]);
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
    for (const s of [-1, 1]) { Rd(g, [.54, .14, .36], K.b, [s * (A.body.r[0] + .12), .2, .3], [0, s * .4, -s * .4]); Bx(g, [.2, .015, .015], '#8a9aa6', [s * h.r * .92, h.p[1] - h.r * .12, h.p[2] + h.r * .75], [0, -s * .5, s * .12]); Bx(g, [.2, .015, .015], '#8a9aa6', [s * h.r * .92, h.p[1] - h.r * .24, h.p[2] + h.r * .75], [0, -s * .5, -s * .12]); }
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
      for (const z of [L * .3, -L * .6]) Rd(g, [.36, .14, .22], K.a, [s * .5, .08, z], [0, s * .3, 0]);
    }
    const t = Grp(g, [0, .4, -L - .1], [0, 0, 0]); Co(t, [.3, .9 + F * .3, 4], K.a, [0, 0, -.35 - F * .12], [-PI / 2, 0, 0], [.4, 1, 1]); Co(t, [.26, .8 + F * .3, 4], '#ff8fb0', [0, .14, -.35 - F * .12], [-PI / 2, 0, 0], [.1, 1, 1.4]);
    face(g, X.eyes, [0, .68, L * .7], hr, { gap: .55, eye: [1.15, 1.05, 1][F], nose: null, y: .1, z: .84 });
    for (let i = 0; i < 2 + F; i++) Sp(g, .07, mix(K.a, '#ff8fb0', .6), [(i % 2 ? .14 : -.14), .42 + .36 * .96, .1 - i * L * .42], [1, .4, 1], 1);
    A.top = [0, .62 + hr * .82, L * .7]; A.tail = [0, .45, -L]; A.back = [0, .76, -.2]; A.fs = [.8, .95, 1.05][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  nimbowhale(g, F, K, X) { // a tiny whale that swims through the air under its own cloud
    const r = [.6, .76, .92][F], y = [.9, 1.05, 1.2][F], A = { head: { p: [0, y, r * .35], r: r * .98 }, body: { p: [0, y, -.1], r: [r, r * .82, r * 1.3] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, y - r * .2, 0], [r * .93, r * .66, r * 1.22]);
    const t = Grp(g, [0, y + .05, -r * 1.25], [.5, 0, 0]); Co(t, [r * .4, r * .9, 5], K.a, [0, 0, -r * .3], [-PI / 2, 0, 0]);
    for (const s of [-1, 1]) { Rd(t, [r * .62, .12, r * .44], K.a, [s * r * .32, 0, -r * .85], [0, s * .5, 0]); Rd(g, [r * .72, .13, r * .42], K.a, [s * r * 1.05, y - r * .35, .1], [0, s * .3, -s * .5]); }
    face(g, X.eyes, [0, y + .02, r * .32], r, { gap: .5, eye: [1.2, 1.1, 1][F], nose: null, y: -.05, z: .86 });
    for (let i = 0; i < 3; i++) Bx(g, [r * (.5 - i * .1), .025, .03], mix(K.b, K.a, .5), [0, y - r * (.42 + i * .12), r * (1.02 - i * .1)]); Cy(g, [.05, .05, .04, 6], mix(K.a, '#2b3a55', .4), [0, y + r * .8, r * .2]);
    A.top = [0, y + r * .82, 0]; A.tail = [0, y, -r * 1.3]; A.back = [0, y + r * .8, -.3]; A.fs = [.8, 1, 1.25][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  shrimplet(g, F, K, X) { // a shrimp that hovers curled like a comma: a round baby, then more and more tail segments
    const hr = [.6, .56, .6][F], hy = [.72, 1.32, 1.72][F], R = [.4, .55, .7][F], n = [1, 3, 5][F], band = mix(K.a, '#ff5a4a', .35), hz = .3;
    const A = { head: { p: [0, hy, hz], r: hr }, body: { p: [0, hy - hr * .2, hz - hr * .8], r: [hr * .8, hr * .8, hr * .9] } };
    let last = [0, hy, hz];
    for (let i = 0; i < n; i++) { const a = (i + 1.1) * [.5, .62, .6][F], r = hr * (.8 - i * .08); last = [0, hy - R + R * Math.cos(a), hz - hr * .35 - R * Math.sin(a)]; Sp(g, r, i % 2 ? K.a : band, last, [1, 1, .85]); if (F) for (const s of [-1, 1]) Co(g, [.05, .22, 4], K.b, [s * r * .45, last[1] - r * .95, last[2] + .05], [PI, 0, 0]); }
    Sp(g, hr, K.a, A.head.p, [1, .95, 1.05]); Sp(g, hr * .6, K.b, [0, hy - hr * .45, hz + hr * .3], [1, .7, 1]);
    for (const s of [-1, 1]) { const e = Grp(g, [s * hr * .32, hy + hr * .8, hz + hr * .3], [-.5 - F * .1, 0, -s * .35]); const L = [.4, .75, 1.15][F]; Cy(e, [.018, .03, L, 4], band, [0, L / 2, 0]); Gm(e, .06, band, [0, L, 0]); }
    if (F === 2) Co(g, [.09, .42, 4], band, [0, hy + hr * .55, hz + hr * .85], [1.1, 0, 0]);
    if (F) for (const s of [-1, 1]) Rd(g, [.14, .14, .3], K.b, [s * hr * .55, hy - hr * .75, hz + hr * .55], [.4, s * .3, 0]);
    face(g, X.eyes, [0, hy, hz], hr, { gap: .4, eye: [1.4, 1.25, 1.15][F], nose: null });
    A.top = [0, hy + hr * .9, hz]; A.tail = [0, last[1] - .05, last[2] - .1]; A.back = [0, hy + hr * .3, hz - hr * 1.1]; A.fs = [.8, .9, 1][F];
    if (X.own('tail')) FEAT.shrimplet.b(Grp(g, [0, last[1] - .08, last[2] + .1], [.5, PI, 0]), F, K);
    return A;
  },
  coralcolt(g, F, K, X) { // a sea horse that hovers upright: big head and snout, round belly, a tail that curls forward
    const hr = [.6, .56, .58][F], R = [.2, .32, .4][F], n = [4, 7, 9][F], bh = [.3, .46, .62][F], cy = R + .14, by = cy + R * .5 + bh * .8, hy = by + bh * .75 + hr * .62;
    const A = { head: { p: [0, hy, .12], r: hr }, body: { p: [0, by, -.05], r: [bh * .82, bh, bh * .9] } }, dk = mix(K.a, '#e8823c', .5);
    for (let i = 0; i < n; i++) { const t = -1 + i * .72, rr = R * (1 - i / (n + 2)); Sp(g, .19 * (1 - i / (n + 1.5)) * (F ? 1 : .8) + .05, i % 2 ? dk : K.a, [0, cy - Math.sin(t) * rr, .05 - Math.cos(t) * rr], null, 1); }
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, bh * .7, K.b, [0, by - bh * .05, bh * .4], [.85, 1.05, .7]);
    if (F) for (let i = 0; i < 2 + F; i++) Bx(g, [bh * (.8 - i * .1), .03, .03], dk, [0, by + bh * (.35 - i * .28), bh * .92 - Math.abs(i - 1) * .04]);
    Sp(g, hr, K.a, A.head.p, [1, .95, 1]);
    const sl = [.22, .4, .52][F]; Cy(g, [.13, .17, sl, 7], K.a, [0, hy - hr * .22, .12 + hr * .85 + sl / 2], [PI / 2, 0, 0]); Cy(g, [.16, .13, .08, 7], dk, [0, hy - hr * .22, .12 + hr * .85 + sl], [PI / 2, 0, 0]);
    if (F) Co(g, [.3 + F * .06, .5 + F * .1, 4], dk, [0, by + bh * .2, -bh * .95], [-1.2, 0, 0], [.22, 1, 1]);
    if (F === 2) for (let i = 0; i < 3; i++) Co(g, [.08, .2, 4], dk, [0, hy + hr * (.3 - i * .45), .12 - hr * (.95 - i * .08)], [-1.3 - i * .2, 0, 0]);
    for (const s of [-1, 1]) Rd(g, [.08, .26, .22], dk, [s * hr * .98, hy - hr * .25, 0], [0, 0, -s * .5]);
    face(g, X.eyes, [0, hy + .02, .12], hr, { gap: .46, eye: [1.4, 1.25, 1.15][F], nose: null, mouth: false, y: .12 });
    A.top = [0, hy + hr * .9, .08]; A.tail = [0, cy, -R]; A.back = [0, by + bh * .4, -bh * .8]; A.fs = [.8, .95, 1.1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  skipfin(g, F, K, X) { // a dolphin that swims through the air and balances a beach ball on its nose
    const r = [.56, .62, .7][F], y = [.85, 1.05, 1.25][F], L = [1.05, 1.4, 1.65][F], bk = [.16, .34, .5][F];
    const A = { head: { p: [0, y + .02, r * L * .42], r: r * .9 }, body: { p: [0, y, -.1], r: [r * .86, r * .8, r * L] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, y - r * .2, -.02], [r * .78, r * .64, r * L * .93]);
    const nz = -.1 + r * L * .93; Sp(g, 1, K.a, [0, y - r * .08, nz + bk * .4], [r * .3, r * .22, bk + .12], 1); Sp(g, 1, K.b, [0, y - r * .2, nz + bk * .35], [r * .26, r * .14, bk + .08], 1);
    const t = Grp(g, [0, y + .04, -.1 - r * L * .9], [.45, 0, 0]); Co(t, [r * .36, r * .8, 5], K.a, [0, 0, -r * .28], [-PI / 2, 0, 0]);
    for (const s of [-1, 1]) { Rd(t, [r * .56, .1, r * .36], K.a, [s * r * .3, 0, -r * .78], [0, s * .6, 0]); Rd(g, [r * .62, .11, r * .36], K.a, [s * r * .92, y - r * .42, r * .25], [0, s * .5, -s * .6]); }
    Co(g, [r * .34, r * (.55 + F * .12), 4], K.a, [0, y + r * .92, -r * .25], [-.6, PI / 4, 0], [.5, 1, 1]);
    face(g, X.eyes, [0, y + .04, r * L * .36], r * .92, { gap: .52, eye: [1.3, 1.15, 1.05][F], nose: null, y: .02, z: .8 });
    Cy(g, [.045, .045, .04, 6], mix(K.a, '#2b3a55', .4), [0, y + r * .78, r * .3]);
    A.top = [0, y + r * .8, 0]; A.tail = [0, y, -r * L]; A.back = [0, y + r * .78, -.3]; A.fs = [.8, 1, 1.2][F];
    if (X.own('top')) X.sig([0, y + r * .12, nz + bk * 1.35 + .05], 1);
    return A;
  },
  rocktopus(g, F, K, X) { // an octopus that sits on curled arms and balances pebbles on its head: 4 arms, then 6, then 8
    const r = [.56, .64, .74][F], n = [4, 6, 8][F], y = r * .95 + [.1, .18, .24][F], k = [.7, .9, 1.1][F];
    const A = { head: { p: [0, y, 0], r }, body: { p: [0, y, 0], r: [r, r * 1.02, r] } };
    Sp(g, 1, K.a, A.body.p, [r, r * 1.05, r]);
    for (let i = 0; i < n; i++) {
      const a = (i + .5) / n * PI * 2, cx = Math.sin(a), cz = Math.cos(a);
      for (let j = 0; j < 4; j++) { const d = r * .62 + j * .2 * k, up = j === 3 ? .16 * k : 0; Sp(g, (.2 - j * .035) * k, K.a, [cx * d, .14 * k + up + (j === 0 ? .1 : 0), cz * d], null, 1); if (j && j < 3) Sp(g, .07 * k, K.b, [cx * d, .03, cz * d], [1, .5, 1], 1); }
    }
    for (let i = 0; i < 2 + F; i++) { const a = 2.4 + i * .5; Gm(g, .09, mix(K.a, '#5a3a7a', .4), [Math.sin(a) * r * .8, y + r * .55, Math.cos(a) * r * .5], [1, .5, 1]); }
    face(g, X.eyes, [0, y - r * .12, 0], r, { gap: .36, eye: [1.4, 1.25, 1.15][F], nose: null });
    A.top = [0, y + r * 1.0, 0]; A.tail = [0, y * .6, -r * .95]; A.back = [0, y + r * .7, -r * .6]; A.fs = [.8, .95, 1.1][F];
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  driftle(g, F, K, X) { // a sea turtle that glides through the air on long flippers, a starfish riding on its shell
    const w = [.5, .7, .88][F], y = [.7, .95, 1.15][F], shell = '#3f9a94', hr = [.5, .46, .48][F];
    const A = { head: { p: [0, y + .08, w * 1.0 + hr * .35], r: hr }, body: { p: [0, y, -.1], r: [w, w * .6, w * 1.15] } };
    Sp(g, 1, K.b, [0, y - w * .1, -.1], [w * .92, w * .4, w * 1.08]); Sp(g, 1, shell, [0, y + w * .05, -.1], [w, w * .58, w * 1.15]);
    for (let i = 0; i < [3, 5, 7][F]; i++) { const a = i / [3, 5, 6][F] * PI * 2, c = i === 6 ? 0 : .5; Cy(g, [.16 * w / .7, .16 * w / .7, .03, 6], '#6cc0b4', [Math.sin(a) * w * c, y + w * (c ? .5 : .62), -.1 + Math.cos(a) * w * c * 1.1], [Math.cos(a) * c, 0, -Math.sin(a) * c]); }
    Sp(g, hr, K.a, A.head.p);
    for (const s of [-1, 1]) { Rd(g, [w * 1.1, .1, w * .5], K.a, [s * w * 1.25, y - .02, w * .45], [0, s * .5, -s * .25]); Rd(g, [w * .5, .09, w * .36], K.a, [s * w * .85, y - .08, -w * 1.0], [0, -s * .6, 0]); }
    Co(g, [.1, .28, 4], K.a, [0, y - .05, -w * 1.28], [-PI / 2, 0, 0]);
    face(g, X.eyes, A.head.p, hr, { eye: [1.3, 1.15, 1.05][F], nose: null });
    A.top = [0, A.head.p[1] + hr * .9, A.head.p[2]]; A.tail = [0, y, -w * 1.2]; A.back = [0, y + w * .6, -.15]; A.fs = [.8, 1, 1.1][F];
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  zapuff(g, F, K, X) { // a pufferfish that floats like a balloon: smooth as a baby, then puffed up and prickly
    const r = [.5, .68, .84][F], y = [.8, 1.05, 1.3][F], spike = '#e8a81c', fin = mix(K.a, '#e8823c', .45);
    const A = { head: { p: [0, y, .05], r: r * .98 }, body: { p: [0, y, 0], r: [r, r * .96, r] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, y - r * .22, .02], [r * .93, r * .8, r * .95]);
    if (F && X.own('back')) for (let i = 0, N = F === 2 ? 26 : 16; i < N; i++) { const yy = 1 - (i + .5) / N * 1.7, rr = Math.sqrt(1 - yy * yy), a = i * 2.4, d = new THREE.Vector3(Math.sin(a) * rr, yy, Math.cos(a) * rr); if (d.z > .45 && d.y < .7) continue; Co(g, [.07, .26 + F * .04, 4], spike, [d.x * r * 1.04, y + d.y * r * 1.0, d.z * r * 1.04]).quaternion.setFromUnitVectors(UP, d); }
    for (const s of [-1, 1]) Co(g, [.2, .34 + F * .06, 4], fin, [s * r * 1.0, y - .05, .05], [0, 0, -s * 1.9], [1, 1, .25]);
    Co(g, [.26, .4 + F * .1, 4], fin, [0, y, -r * 1.1], [-PI / 2, 0, 0], [.22, 1, 1]);
    Sp(g, r * .16, '#ff8fa0', [0, y - r * .26, r * .96], [1.4, .8, .7], 1);
    face(g, X.eyes, [0, y + .04, .02], r, { gap: .42, eye: [1.4, 1.25, 1.15][F], nose: null, mouth: false, z: .88 });
    A.top = [0, y + r * .96, 0]; A.tail = [0, y, -r]; A.back = [0, y + r * .82, -r * .45]; A.fs = [.8, .95, 1.1][F];
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  ottershell(g, F, K, X) { // an otter that sits up and hugs its favourite seashell
    const A = sitter(g, F, K, X, { faceO: { nose: '#3a2a2a' } }), h = A.head, b = A.body;
    earsR(g, h, K.a, K.b, .7); Sp(g, h.r * .4, K.b, [0, h.p[1] - h.r * .26, h.p[2] + h.r * .62], [1.3, .75, .75]);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) Bx(g, [.26, .02, .02], '#fff3df', [s * h.r * .9, h.p[1] - h.r * (.2 + i * .12), h.p[2] + h.r * .55], [0, -s * .5, s * (.1 - i * .25)]);
    if (F) { const z = b.p[2] + b.r[2] * .95, y = b.p[1] * 1.05, k = [0, .8, 1][F], t = Grp(g, [0, y, z], [-.3, 0, 0], k); Sp(t, .26, '#ffd9c4', [0, 0, 0], [1, .9, .4], 1); for (let i = -2; i <= 2; i++) Bx(t, [.03, .34, .03], '#f5a08a', [i * .09, .03, .1], [0, 0, -i * .22]); Gm(t, .08, '#f5a08a', [0, -.2, .04], [1.6, .6, .6]); }
    if (X.own('tail')) X.sig(A.tail);
    return A;
  },
  cinnapanda(g, F, K, X) { // a red panda: white brows and cheeks, dark socks and belly, a long ringed tail
    const d = '#4a2f2a', A = sitter(g, F, K, X, { feetC: d, belly: false, arms: false, faceO: { nose: '#3a2a2a' } }), h = A.head, b = A.body;
    Sp(g, b.r[0] * .66, d, [0, b.p[1] * .85, b.r[2] * .5], [1, 1.1, .6]);
    for (const s of [-1, 1]) { Rd(g, [.2, .34, .2], d, [s * b.r[0] * .85, b.p[1] * 1.15, b.r[2] * .45], [-.6, 0, s * .3]); Co(g, [.24, .38, 4], K.a, [s * h.r * .72, h.p[1] + h.r * .78, h.p[2]], [0, PI / 4, -s * .35], [1, 1, .6]); Co(g, [.15, .26, 4], K.b, [s * h.r * .72, h.p[1] + h.r * .76, h.p[2] + .07], [0, PI / 4, -s * .35], [1, 1, .5]);
      Sp(g, h.r * .3, K.b, [s * h.r * .56, h.p[1] - h.r * .26, h.p[2] + h.r * .6], [1.1, .8, .7], 1); Sp(g, h.r * .13, K.b, [s * h.r * .36, h.p[1] + h.r * .34, h.p[2] + h.r * .84], [1.3, .7, .5], 1); }
    Sp(g, h.r * .3, K.b, [0, h.p[1] - h.r * .26, h.p[2] + h.r * .72], [1.1, .7, .7], 1);
    if (X.own('tail')) X.sig([0, A.tail[1], A.tail[2] + .1]);
    return A;
  },
  yuzubara(g, F, K, X) { // a capybara: a calm barrel on short legs with a yuzu balanced on its head
    const A = walker(g, F, K, X, { w: [.52, .58, .68][F], L: [.52, .76, .95][F], leg: [.08, .16, .2][F], hr: [.6, .56, .6][F], lw: .26, faceO: { nose: '#5a3a2c', gap: .4, y: .16 } }), h = A.head, d = mix(K.a, '#5a3a2c', .5);
    Rb(g, [h.r * 1.1, h.r * .8, h.r * .7], K.a, [0, h.p[1] - h.r * .25, h.p[2] + h.r * .62]);
    for (const s of [-1, 1]) { Sp(g, h.r * .17, d, [s * h.r * .62, h.p[1] + h.r * .8, h.p[2] - .1], [1, 1, .6], 1); Sp(g, .035, d, [s * h.r * .2, h.p[1] - h.r * .12, h.p[2] + h.r * .98], null, 1); }
    Sp(g, .13, K.a, A.tail, [1, 1, .8], 1);
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  snoozloth(g, F, K, X) { // a sloth in a nightcap: a pale face with sleepy stripes and long arms with three claws
    const d = mix(K.a, '#4a3a32', .6), A = sitter(g, F, K, X, { arms: false, faceO: { nose: '#3a2a2a', eye: [1.1, 1, .9][F] } }), h = A.head, b = A.body;
    Sp(g, h.r * .8, K.b, [0, h.p[1] - h.r * .02, h.p[2] + h.r * .3], [1.02, .88, .9]);
    for (const s of [-1, 1]) { Bx(g, [h.r * .36, h.r * .09, .04], d, [s * h.r * .56, h.p[1] - h.r * .04, h.p[2] + h.r * .96], [0, s * .55, -s * .4]);
      const L = [.5, .8, 1.05][F], a = Grp(g, [s * b.r[0] * .9, b.p[1] * 1.35, b.r[2] * .2], [-.5, 0, s * .22]); Rd(a, [.22, L, .22], K.a, [0, -L / 2, 0]); for (let i = -1; i <= 1; i++) Co(a, [.035, .2, 4], '#f3e6d2', [i * .07, -L - .06, .04], [PI, 0, 0]); }
    if (X.own('top')) X.sig(A.top, A.fs);
    return A;
  },
  glidenut(g, F, K, X) { // a flying squirrel: huge eyes, a flat tail, and flaps that spread wider as it learns to glide
    const r = [.5, .52, .58][F], y = [.5, .75, 1.15][F], hr = [.66, .62, .64][F];
    const A = { head: { p: [0, y + r * .5 + hr * .5, .2], r: hr }, body: { p: [0, y, -.05], r: [r, r * .82, r * 1.05] } }, h = A.head;
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, 1, K.b, [0, y - r * .2, .0], [r * .88, r * .66, r * .98]);
    Sp(g, hr, K.a, h.p, [1.08, .95, 1]);
    for (const s of [-1, 1]) { Sp(g, hr * .26, K.a, [s * hr * .66, h.p[1] + hr * .74, h.p[2] - .02], [1, 1.1, .6], 1); Sp(g, hr * .14, '#f59ab0', [s * hr * .66, h.p[1] + hr * .74, h.p[2] + .07], [1, 1, .4], 1); Sp(g, hr * .28, K.b, [s * hr * .42, h.p[1] - hr * .3, h.p[2] + hr * .66], [1.1, .8, .7], 1); }
    feet(g, K.b, r * .5, r * .5, [.24, .14, .34], Math.max(0, y - r * .86));
    const tl = [.4, .8, 1.15][F]; Rb(g, [.34 + F * .08, .1, tl], mix(K.a, '#5a4a3a', .3), [0, y + .05, -r - tl / 2 + .1], [.25, 0, 0], .045);
    face(g, X.eyes, h.p, hr, { eye: [1.6, 1.5, 1.4][F], gap: .38 });
    A.top = [0, h.p[1] + hr * .88, h.p[2]]; A.tail = [0, y, -r]; A.back = [0, y + r * .3, -.05]; A.fs = [.8, .9, 1][F];
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  // The six cats share one way of being built: a build (this function) wears a coat (CATCOAT), and breeding can mix them.
  siamew(g, F, K, X) { // a Siamese cat's build: slim, with a sapphire on its collar
    const C = CATCOAT[X.coat], A = cat(g, F, K, X, C.o(K)), b = A.body; C.m(g, A, F, K);
    if (F) { Cy(g, [b.r[0] * .62, b.r[0] * .7, .09, 10], '#3f6fd0', [0, b.p[1] + b.r[1] * .78, b.p[2] + .1]); Oc(g, [.1, .13][F - 1], GL('#5aa0ff', .6), [0, b.p[1] + b.r[1] * .7, b.p[2] + b.r[2] * .78], [1, 1.3, .6]); }
    if (X.own('tail')) catTail(Grp(g, A.tail), F, C.t(K));
    return A;
  },
  gingersnap(g, F, K, X) { // a tabby's build: the plain house cat
    const C = CATCOAT[X.coat], A = cat(g, F, K, X, C.o(K)); C.m(g, A, F, K);
    if (X.own('tail')) catTail(Grp(g, A.tail), F, C.t(K));
    return A;
  },
  patchkit(g, F, K, X) { // a calico's build: a house cat with a daisy tucked behind one ear
    const C = CATCOAT[X.coat], A = cat(g, F, K, X, C.o(K)); C.m(g, A, F, K);
    if (X.own('tail')) catTail(Grp(g, A.tail), F, C.t(K));
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  tuxpurr(g, F, K, X) { // a tuxedo cat's build: a red bow tie and a top hat
    const C = CATCOAT[X.coat], A = cat(g, F, K, X, C.o(K)), b = A.body; C.m(g, A, F, K);
    if (F) { const y = b.p[1] + b.r[1] * .74, z = b.p[2] + b.r[2] * .8; for (const s of [-1, 1]) Co(g, [.16 + F * .02, .3 + F * .04, 4], '#e0483c', [s * (.17 + F * .02), y, z + .08], [0, 0, s * PI / 2], [1, 1, .5]); Gm(g, .09, '#b8342a', [0, y, z + .12]); }
    if (X.own('tail')) catTail(Grp(g, A.tail), F, C.t(K));
    if (X.own('top')) X.sig(A.top);
    return A;
  },
  fluffcoon(g, F, K, X) { // a Maine Coon's build: the biggest, fluffiest cat, with tufted ears, a ruff and a tail like a feather duster
    const C = CATCOAT[X.coat], d = mix(K.a, '#4a342c', .45), A = cat(g, F, K, X, { ...C.o(K), fat: 1.18, tuftC: d }), h = A.head, b = A.body; C.m(g, A, F, K);
    for (const s of [-1, 1]) tuft(g, [s * h.r * .98, h.p[1] - h.r * .25, h.p[2] + .05], K.a, .9 + F * .2, [0, 0, -s * 1.9]);
    if (F) for (let i = 0; i < 7; i++) { const a = (i - 3) * .5; Sp(g, .2 + F * .03, mix(K.b, '#ffffff', .3), [Math.sin(a) * b.r[0] * .82, b.p[1] + b.r[1] * (.72 - Math.abs(i - 3) * .03), b.p[2] + Math.cos(a) * b.r[2] * .78], [1, 1.15, 1], 1); }
    if (F === 2) for (const s of [-1, 1]) tuft(g, [s * b.r[0] * .8, .12, b.p[2] + b.r[2] * .3], K.a, 1, [0, 0, -s * 1.3]);
    if (X.own('tail')) catTail(Grp(g, A.tail), F, C.t(K), 1.9);
    return A;
  },
  munchmew(g, F, K, X) { const A = munchkin(g, F, K, X); if (X.own('top')) X.sig(A.top); return A; },
  glazemew(g, F, K, X) { const A = munchkin(g, F, K, X); if (X.own('back')) X.sig(A.back); return A; }, // the bakery's munchkin, iced like a donut
  zapkit(g, F, K, X) { // a kitten: baby is all head, then it sits up tall with a zigzag tail
    const dark = mix(K.a, '#5a4a3a', .7);
    const A = F === 0 ? { head: { p: [0, .78, .05], r: .74 }, body: { p: [0, .4, -.2], r: [.45, .36, .5] } }
      : { head: { p: [0, F === 1 ? 1.38 : 1.7, .12], r: F === 1 ? .64 : .62 }, body: { p: [0, F === 1 ? .6 : .72, -.1], r: F === 1 ? [.5, .6, .5] : [.52, .76, .55] } };
    const h = A.head, b = A.body;
    Sp(g, 1, K.a, b.p, b.r); if (F) { Sp(g, b.r[0] * .7, K.b, [0, b.p[1] + .05, b.r[2] * .55], [1, 1.2, .7]); for (const s of [-1, 1]) Cy(g, [.1, .12, b.p[1], 7], K.a, [s * .24, b.p[1] / 2, b.r[2] * .8]); }
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
    tuft(g, [0, A.head.p[1] + A.head.r * .9, A.head.p[2] + .05], K.a, .7 + F * .15); if (F) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) Cy(g, [.025, .02, .22, 4], stripe, [s * r * .4, y - r * .85, r * (.3 - i * .5)], [0, 0, s * .4]);
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
      Rd(g, [.2, .14, .22], '#f3c9b5', [s * r * .5, y * .9, r * .82], [.4, 0, 0]); Rd(g, [.28, .14, .36], '#f3c9b5', [s * r * .45, .06, r * .5]);
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
    for (const s of [-1, 1]) { Cy(g, [.13, .13, .06, 8], K.a, [s * r * .5, r * 1.0, r * .5], [PI / 2 - .4, 0, s * .3]); Cy(g, [.075, .075, .07, 8], '#f59ab0', [s * r * .5, r * 1.0, r * .5 + .01], [PI / 2 - .4, 0, s * .3]); for (const z of [r * .6, -r * .5]) Rd(g, [.22, .16, .28], '#6b5560', [s * r * .55, .07, z]); }
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
    for (const s of [-1, 1]) { const e = Sp(g, .17, '#ffffff', [s * w * .3, 1.12, w * .5]); eyeAt(g, X.eyes, .1, [s * w * .3, 1.12, w * .5 + .15]); e.userData.keep = 1; }
    Bx(g, [.2, .03, .03], INK, [0, .5, w * .7]); for (const s of [-1, 1]) V(g, new THREE.Mesh(G('Circle', .09, 6), MX('blush#ff8a9a', '#ff8a9a', { transparent: true, opacity: .6 })), [s * w * .42, .52, w * .66], [0, s * .4, 0]);
    A.top = [0, .9, 0]; A.tail = [0, .5, -w * .7]; A.back = [0, .72, -.05]; A.fs = 1;
    if (X.own('back')) X.sig(A.back);
    return A;
  },
  dustmole(g, F, K, X) { // an upright capsule with big digging paws; its hat is too big until it grows into it
    const r = [.6, .68, .76][F], hgt = [1.15, 1.35, 1.5][F], y = r * hgt, paw = '#f3c9b5', A = { head: { p: [0, y * 1.35, .05], r: r * .95 }, body: { p: [0, y, 0], r: [r, y, r * .95] } };
    Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, r * .6, K.b, [0, y * .7, r * .5], [1, 1.2, .6]);
    Co(g, [r * .34, r * .6, 5], paw, [0, y * 1.12, r * .95], [PI / 2, 0, 0]); Gm(g, .1, '#e0708a', [0, y * 1.12, r * 1.28]);
    for (const s of [-1, 1]) { const p = Grp(g, [s * r * .98, y * .95, r * .3], [0, 0, s * .3], .8 + F * .15); Rd(p, [.36, .44, .16], paw, [0, 0, 0]); for (let i = 0; i < 3; i++) Co(p, [.06, .2, 3], '#ffffff', [(i - 1) * .12, -.3, 0], [PI, 0, 0]); Rd(g, [.32, .14, .4], paw, [s * r * .45, .06, r * .5]); if (F === 2) Bx(g, [.34, .03, .03], '#ffffff', [s * r * .5, y * 1.06, r * .98], [0, -s * .4, -s * .25]); }
    if (F === 2) { const pk = Grp(g, [.1, y * 1.05, -r * .95], [0, 0, .6]); Cy(pk, [.04, .04, 1.1, 4], '#8a5a3c', [0, 0, 0]); Bx(pk, [.7, .1, .1], '#8a8794', [0, .5, 0]); }
    face(g, X.eyes, [0, y * 1.3, .05], r * .95, { eye: [.9, .95, .9][F], gap: .34, nose: null, mouth: false, y: .02 });
    A.top = [0, y * 1.35 + r * .78, .05]; A.tail = [0, .3, -r * .9]; A.back = [0, y * 1.5, -r * .7]; A.fs = [1, .95, 1][F];
    if (X.own('top')) X.sig(F === 0 ? [0, A.top[1] - .02, .12] : [0, A.top[1] + .1, 0], r / .68);
    return A;
  },
  geodeer(g, F, K, X) { // a fawn: folded up asleep-style as a baby, then long legs and crystal antlers
    const hoof = '#6b5560', gemc = GL('#8fe3ff', .5);
    let A;
    if (F === 0) { A = { head: { p: [0, .86, .42], r: .58 }, body: { p: [0, .42, -.2], r: [.5, .4, .72] } }; Sp(g, 1, K.a, A.body.p, A.body.r); for (const s of [-1, 1]) { Rd(g, [.18, .16, .5], K.a, [s * .42, .08, .3]); Rd(g, [.18, .16, .18], hoof, [s * .42, .08, .6]); } }
    else {
      const lh = F === 1 ? .7 : 1, L = F === 1 ? .62 : .78, by = lh + .34;
      A = { head: { p: [0, by + (F === 1 ? .8 : 1.05), L * .95], r: .5 }, body: { p: [0, by, -.05], r: [.42, .4, L] } };
      Sp(g, 1, K.a, A.body.p, A.body.r); Sp(g, .9, K.b, [0, by - .08, 0], [.4, .36, L * .95]);
      for (const s of [-1, 1]) for (const z of [L * .6, -L * .65]) { Cy(g, [.08, .065, lh, 7], K.a, [s * .26, lh / 2 + .05, z]); Cy(g, [.085, .1, .14, 7], hoof, [s * .26, .07, z]); }
      Cy(g, [.2, .28, F === 1 ? .7 : .95, 6], K.a, [0, by + (F === 1 ? .38 : .5), L * .78], [.45, 0, 0]);
      if (F === 2) { for (let i = 0; i < 5; i++) Oc(g, .12, gemc, [(i % 2 ? .3 : -.3) * (1 - i * .1), by + .3, L * .4 - i * .3], [1, 1.6, 1], [0, 0, (i % 2 ? -.5 : .5)]); Sp(g, .3, K.b, [0, by - .1, L * .9], [1, 1.2, .8]); }
    }
    const h = A.head;
    Sp(g, h.r, K.a, h.p, [1, .95, 1]); Sp(g, h.r * .5, K.b, [0, h.p[1] - h.r * .3, h.p[2] + h.r * .7], [1, .8, 1.2]);
    for (const s of [-1, 1]) { Oc(g, .22, K.a, [s * h.r * 1.05, h.p[1] + h.r * .35, h.p[2] - .1], [1.5, .6, .35], [0, 0, s * .5]); Oc(g, .13, '#f59ab0', [s * h.r * 1.05, h.p[1] + h.r * .35, h.p[2] - .06], [1.5, .6, .3], [0, 0, s * .5]); for (let i = 0; i < 2; i++) Gm(g, .07, '#ffffff', [s * (.16 + i * .14), A.body.p[1] + A.body.r[1] * .88, A.body.p[2] - .2 - i * .22], [1, .4, 1]); }
    Sp(g, .16, '#ffffff', [0, A.body.p[1] + .1, A.body.p[2] - A.body.r[2]]);
    face(g, X.eyes, h.p, h.r, { eye: [1.4, 1.25, 1.15][F], nose: '#3b2f3a' });
    A.top = [0, h.p[1] + h.r * .85, h.p[2] - .05]; A.tail = [0, A.body.p[1] + .1, A.body.p[2] - A.body.r[2]]; A.back = [0, A.body.p[1] + A.body.r[1] * .9, -.15]; A.fs = .85;
    if (X.own('top')) X.sig(A.top);
    return A;
  },
};

// Element variants: a pet hatched with another element than its species' wears that element's colours and one small
// charm by its ear (the dragon has its own parts instead: wings, spikes, tail and breath).
const ELTINT = { Leaf: ['#8fd16a', '#e6f5c8'], Ember: ['#f0683c', '#ffe0b0'], Tide: ['#6fb7e8', '#e6f6ff'], Spark: ['#ffd84a', '#fff8d0'], Stone: ['#a9a6b0', '#e6e2dc'] };
const DRAGON = { Leaf: { body: '#8fd16a', spike: '#4a9a45', horn: '#8a5a3c', wing: '#8fd16a' }, Tide: { body: '#6fa8e8', spike: '#3f8fd0', horn: '#e6f6ff', wing: TR('#8fd0f5', .8) }, Spark: { body: '#ffd24a', spike: '#ffe14a', horn: '#fff8d0', wing: GL('#ffe14a', .5) }, Stone: { body: '#9a98a8', spike: '#6f6a78', horn: '#5b5766', wing: '#a9a6b0' } };
const CHARM = {
  Leaf(c) { leaf(c, [-.07, .1, 0], [0, 0, .7], .7); leaf(c, [.08, .1, 0], [0, 0, -.7], .7, '#4a9a45'); },
  Ember(c) { flame(c, [0, 0, 0], .3); },
  Tide(c) { Sp(c, .11, TR('#c6ebff', .9), [0, .1, 0], null, 1); Co(c, [.085, .16, 6], TR('#c6ebff', .9), [0, .24, 0]); },
  Spark(c) { for (const [y, z] of [[.22, -.4], [.07, -.4]]) Oc(c, .1, GL('#ffe14a', .8), [y > .1 ? .03 : -.03, y, 0], [.6, 1.3, .4], [0, 0, z]); },
  Stone(c) { Gm(c, .12, '#8a8794', [0, .08, 0], [1.2, .9, 1]); Oc(c, .07, GL('#8fe3f5', .5), [.04, .2, 0], [.7, 1.4, .7]); },
};
export const coatOf = (sp, look) => {
  const n = COAT[sp] || COAT.mossbun, t = ELTINT[look?.el], a = look?.coat ? (t ? mix(look.coat, t[0], .3) : look.coat) : t ? mix(n[0], t[0], .85) : n[0];
  return { a, b: look?.coat2 || (look?.coat ? mix(a, '#ffffff', .6) : t ? mix(n[1], t[1], .5) : n[1]), el: t ? look.el : null };
};

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
  const kc = look?.cat && COAT[look.cat] ? look.cat : sp; // a pet can wear the colours of another species in its family
  const coat = CATCOAT[sp] && !CATCOAT[kc] ? sp : kc; // cats also swap markings, when the other cat has its own
  const g = new THREE.Group(), F = Math.max(0, Math.min(2, form | 0)), K = coatOf(kc, look), eyes = [];
  if (sp === 'sizzlet' && K.el && !look.coat) K.a = DRAGON[K.el].body; // the dragon's own colours
  const borrowed = look?.feat && look.feat !== sp && FEAT[look.feat] ? look.feat : null;
  const X = { eyes, coat, own: slot => !borrowed || FEAT[borrowed].slot !== slot, sig: (pos, k = 1) => FEAT[sp].b(Grp(g, pos, null, k), F, K) };
  const A = BODY[sp](g, F, K, X);
  if (borrowed) FEAT[borrowed].b(Grp(g, A[FEAT[borrowed].slot], null, A.fs || 1), F, K);
  if (K.el && sp !== 'sizzlet' && A.head) { const h = A.head, hr = h.r[0] || h.r; CHARM[K.el](Grp(g, [h.p[0] - hr * .6, h.p[1] + hr * .72, h.p[2] + hr * .15], [0, 0, .45], hr / .65)); }
  markings(g, A, look?.pat, K);
  if (look?.spark) for (let i = 0; i < 5; i++) { const a = i * 1.3; Oc(g, .09, GL('#fff6c8', 1), [Math.sin(a) * 1.1, .5 + i * .38, Math.cos(a) * 1.1], [1, 1.7, 1]); }
  toonify(g, .045);
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
  toonify(g, .03);
  return g;
}
export const BODYKEYS = Object.keys(BODY);

// Looks for the pieces of Sky Pool (cue, kind cu), Chess (set, kind cs), Dominoes (tiles, kind dm) and Checkers (set, kind ck).
// Plain data and a little drawing, no 3D imports, so the HUD and the Wardrobe pictures can use it too.
// Every list is in the same order as its kind in cosmetics.js: indexes are saved, append only. Index 0 is the classic look.

// ---------- pool cues ----------
// A cue lies along -x from its tip at 0 to its end at 3.7. segs: [from, to, radius at from, radius at to, colour].
// The last bit (the cap) is always painted in the player's colour by the game, so everyone sees whose shot it is.
export const CUE_L = 3.7, CUE_CAP = 3.52;
const rad = x => (x < .2 ? .03 + x * .03 : .036 + (x - .2) / 3.5 * .034); // the classic taper
const seg = (a, b, c, fat = 0) => [a, b, rad(a) + fat, rad(b) + fat, c];
const bands = (a, b, n, cols, fat = 0) => Array.from({ length: n }, (_, i) => seg(a + (b - a) * i / n, a + (b - a) * (i + 1) / n, cols[i % cols.length], fat));
const TIP = [seg(0, .05, '#6fb7ff'), seg(.05, .2, '#fff4e2')];
const CUES = [
  null,
  { segs: [...TIP, seg(.2, 2.4, '#4a3a34'), seg(2.4, 2.48, '#ffc93c', .006), seg(2.48, 3.4, '#241b18'), seg(3.4, 3.48, '#ffc93c', .006), seg(3.48, CUE_CAP, '#241b18')] }, // ebony
  { segs: [...TIP, ...[0, 1, 2, 3, 4].flatMap(i => { const a = .2 + i * .664; return [seg(a, a + .6, i % 2 ? '#8fc763' : '#a3d672'), seg(a + .6, a + .664, '#5c8f3a', .008)]; })] }, // bamboo
  { segs: [...TIP, ...bands(.2, CUE_CAP, 16, ['#e5352b', '#ffffff'])] }, // candy cane
  { segs: [seg(0, .07, '#3a3a44'), seg(.07, .34, '#f0cf9c'), seg(.34, 3.05, '#ffc93c'), seg(3.05, 3.2, '#c9ccd4', .008), seg(3.2, CUE_CAP, '#ff8fab', .004)] }, // pencil
  { segs: [...TIP, seg(.2, 1.6, '#fff4e2'), ...bands(1.6, CUE_CAP, 6, ['#e5402f', '#ff9a2e', '#ffd23f', '#4fb85a', '#3f8fe0', '#9a5fd0'])] }, // rainbow
  { segs: [...TIP, seg(.2, 2.4, '#ffd257'), seg(2.4, 2.5, '#fff3b0', .006), seg(2.5, CUE_CAP, '#f0b93a')], shine: true }, // gold
  { segs: [seg(0, .3, '#ffffff'), seg(.3, 3.1, '#2b2140'), seg(3.1, CUE_CAP, '#ffffff')], gem: '#ffd23f' }, // magic wand
  { segs: [seg(0, .05, '#6fb7ff'), ...bands(.05, 3.0, 9, ['#ff9a2e', '#f58a1c']), seg(3.0, 3.1, '#3f8f3a', .01), seg(3.1, CUE_CAP, '#58b84a', .004)] }, // carrot
  { segs: [seg(0, .2, '#ffffff'), ...bands(.2, CUE_CAP, 8, ['#bfe6fb', '#7cc4ec'])], gem: '#d6f1ff' }, // icicle (winter)
  { segs: [...TIP, seg(.2, 2.3, '#2b2d6e'), ...bands(2.3, CUE_CAP, 7, ['#ffd23f', '#2b2d6e'], .004)] }, // lightning
];
export const cueLook = k => CUES[k | 0] || null;
// The classic cue, for the game and the pictures: the whole butt wears the player's colour.
export const CUE_CLASSIC = { segs: [...TIP, seg(.2, 2.5, '#efc88f')], butt: 2.5 };

// ---------- chess sets ----------
// Each set has a light army (w) and a dark one (b), so the two sides can always be told apart whatever the two players wear.
// body, shade (the foot), trim (collars and crown points), gold (crosses and gems), slot (eyes, mane, the bishop's notch).
const army = (body, shade, trim, gold, slot) => ({ body, shade, trim, gold, slot });
const SETS = [
  { w: army('#f7ecd4', '#d8c298', '#e6d3ac', '#ffc93c', '#4d362e'), b: army('#4d362e', '#38261f', '#7a5a4a', '#ffc93c', '#f3e2bf') },
  { w: army('#f4f4f6', '#c2c6d2', '#dcdfe8', '#b9bdc9', '#3a3d47'), b: army('#3a3d47', '#23252d', '#5d6170', '#b9bdc9', '#f4f4f6') }, // marble
  { w: army('#ffe3ee', '#f5b0c9', '#ffc7da', '#ff6f9f', '#6a3b2a'), b: army('#6a3b2a', '#4a2619', '#8f5a43', '#ff9fc0', '#ffe3ee') }, // candy
  { w: army('#dff6ff', '#9bd0ec', '#bfe6f7', '#ffc93c', '#1f3f73'), b: army('#1f3f73', '#142a52', '#3b68a6', '#ffc93c', '#dff6ff') }, // ocean
  { w: army('#eef7dc', '#b6d596', '#d2e8b4', '#ffc93c', '#2f5a34'), b: army('#2f5a34', '#1e3d24', '#4f8251', '#ffc93c', '#eef7dc') }, // forest
  { w: army('#fff8e6', '#e0b84a', '#ffc93c', '#ffc93c', '#8a5a14'), b: army('#26222e', '#15121b', '#ffc93c', '#ffc93c', '#ffd98a') }, // royal
  { w: army('#ffe9cf', '#f2b382', '#ffcfa3', '#ff6a2a', '#5a2a1c'), b: army('#3a1f1c', '#24100e', '#ff6a2a', '#ffb02e', '#ffcfa3') }, // lava
  { w: army('#f1ecdc', '#c6bfa6', '#ddd6bf', '#ff8a1f', '#3a2552'), b: army('#3a2552', '#24153a', '#ff8a1f', '#ff8a1f', '#ffd9a8') }, // spooky (halloween)
  { w: army('#f4fbff', '#b8daf0', '#d9eefa', '#7cc8f0', '#2b4a6b'), b: army('#2b4a6b', '#1b3350', '#7cc8f0', '#bfe9ff', '#f4fbff') }, // frost (winter)
  { w: army('#f2fff7', '#9fe8c4', '#3df2a0', '#ff4fd8', '#1b1b2a'), b: army('#1b1b2a', '#0f0f1a', '#ff4fd8', '#3df2a0', '#7af7c0') }, // neon
];
export const chessLook = (k, side) => (SETS[k | 0] || SETS[0])[side ? 'b' : 'w'];

// ---------- checkers (warcaby) sets ----------
// Each set has a light army (w) and a dark one (b), so the two sides can always be told apart whatever the two players wear.
// body (the disc), shade (its foot), trim (the decoration on top), gold (the king's crown). top: what is on the disc's face
// (ridge, grooves, chips, holes, coin, paw, flower, star, flake, pumpkin, gem), built in public/games/warcaby/scene3d.js.
const disc = (body, shade, trim, gold = '#ffc93c') => ({ body, shade, trim, gold });
const CHECKERS = [
  { top: 'ridge', w: disc('#f7ecd4', '#d8c298', '#d8c298'), b: disc('#4d362e', '#38261f', '#7a5a4a') },
  { top: 'grooves', w: disc('#f0cf98', '#d4a866', '#c08a4a'), b: disc('#5e3a22', '#43261a', '#8a5a36') },            // wood
  { top: 'chips', w: disc('#f6dca6', '#e0b878', '#7a4a2a'), b: disc('#5a3420', '#3e2214', '#f6dca6') },              // cookies
  { top: 'holes', w: disc('#ffd6e4', '#f3a9c3', '#c2417a'), b: disc('#23356e', '#16224a', '#8fb0ff') },              // buttons
  { top: 'coin', w: disc('#ffe07a', '#e0b030', '#c9901a', '#fff4c2'), b: disc('#7a4a1e', '#5a3412', '#c98a4a') },    // coins
  { top: 'paw', w: disc('#fff6ee', '#e8d8c8', '#ff8fab'), b: disc('#2e2a35', '#1d1a22', '#ff8fab') },                // paws
  { top: 'flower', w: disc('#fff0f6', '#ffc4da', '#ff6f9f'), b: disc('#4a2550', '#311838', '#ffb547') },             // flowers
  { top: 'star', w: disc('#fff6cc', '#f0d878', '#ffb020'), b: disc('#1f2558', '#121738', '#ffd84a') },               // stars
  { top: 'flake', w: disc('#f4fbff', '#b8daf0', '#7cc8f0'), b: disc('#2b4a6b', '#1b3350', '#bfe9ff') },              // frost (winter)
  { top: 'pumpkin', w: disc('#ffb35c', '#f08a2a', '#d06a12'), b: disc('#3a2552', '#24153a', '#ff8a1f', '#ff8a1f') }, // pumpkins (halloween)
  { top: 'gem', w: disc('#e8fbff', '#a8e4f2', '#5fd3ff'), b: disc('#3a1f5c', '#25123d', '#d07cff') },                // gems
];
export const checkersLook = (k, side) => { const s = CHECKERS[k | 0] || CHECKERS[0]; return { ...s[side ? 'b' : 'w'], top: s.top }; };

// ---------- domino tiles ----------
// face (the tile), edge (the thin line round each half), bar (the divider), pips: one colour per number 0..6, shape of a pip.
const PIP = ['#b9a48c', '#e5543b', '#3f8fe0', '#3fae5d', '#e08a00', '#9a5fd0', '#16999b'];
const DEEP = ['#a08a78', '#d63a22', '#2f6fd0', '#2a8f48', '#c86f00', '#8448c0', '#0f8587'], GLOW = ['#8a8496', '#ff8573', '#74bbff', '#6fe08f', '#ffbd55', '#cfa6ff', '#55dcdc'];
const one = c => Array(7).fill(c);
const TILES = [
  { face: '#fff8ec', edge: '#e7d6bb', bar: '#3b2219', pips: PIP, shape: 'sq' },
  { face: '#2e2a35', edge: '#494356', bar: '#ffc93c', pips: GLOW, shape: 'sq' },                 // ebony
  { face: '#e9c08a', edge: '#cf9f66', bar: '#5a3418', pips: one('#4a2c1a'), shape: 'dot' },      // wood
  { face: '#c5ecd3', edge: '#93d2ab', bar: '#1f6e33', pips: DEEP, shape: 'dot' },                // jade
  { face: '#ffd9e7', edge: '#ffb0cc', bar: '#c2417a', pips: DEEP, shape: 'heart' },              // bubblegum
  { face: '#25306e', edge: '#3d4a9a', bar: '#ffe27a', pips: GLOW, shape: 'star' },               // midnight
  { face: '#ffd257', edge: '#e6ae2e', bar: '#6b4326', pips: one('#5a3418'), shape: 'sq' },       // gold
  { face: '#e4f6ff', edge: '#a8dcf5', bar: '#2f6fa8', pips: DEEP, shape: 'gem' },                // ice (winter)
  { face: '#f79d3c', edge: '#dc7a1c', bar: '#3b2219', pips: one('#3b2219'), shape: 'tri' },      // pumpkin (halloween)
  { face: '#1b1b2a', edge: '#ff4fd8', bar: '#3df2a0', pips: GLOW, shape: 'dot' },                // neon
];
export const dominoLook = k => TILES[k | 0] || TILES[0];
// A pip as an SVG path in a box from -.5 to .5 (the same path is filled on canvas with Path2D).
const star = () => { let d = ''; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? .27 : .62; d += (i ? 'L' : 'M') + (Math.sin(a) * r).toFixed(3) + ' ' + (-Math.cos(a) * r).toFixed(3); } return d + 'Z'; };
export const PIP_PATH = {
  sq: 'M-.36 -.5H.36A.14 .14 0 0 1 .5 -.36V.36A.14 .14 0 0 1 .36 .5H-.36A.14 .14 0 0 1 -.5 .36V-.36A.14 .14 0 0 1 -.36 -.5Z',
  dot: 'M0 -.54A.54 .54 0 1 1 0 .54A.54 .54 0 1 1 0 -.54Z',
  heart: 'M0 .6C-.75 .1 -.72 -.6 -.3 -.6C-.1 -.6 0 -.45 0 -.33C0 -.45 .1 -.6 .3 -.6C.72 -.6 .75 .1 0 .6Z',
  star: star(),
  gem: 'M0 -.64L.56 0L0 .64L-.56 0Z',
  tri: 'M0 -.58L.62 .5H-.62Z',
};
export const SPOTS = [[], [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [2, 0], [0, 2], [2, 2]], [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]];
// One half of a tile painted on a square canvas of side S.
export function paintDominoHalf(g, S, v, k = 0) {
  const L = dominoLook(k), P = new Path2D(PIP_PATH[L.shape]);
  g.fillStyle = L.face; g.fillRect(0, 0, S, S);
  g.strokeStyle = L.edge; g.lineWidth = S * .05; g.strokeRect(S * .025, S * .025, S * .95, S * .95);
  g.fillStyle = L.pips[v];
  for (const [c, r] of SPOTS[v] || []) { g.save(); g.translate(S * (.22 + c * .28), S * (.22 + r * .28)); g.scale(S * .2, S * .2); g.fill(P); g.restore(); }
}

// ---------- Word Reef letter tiles (kind rt) ----------
// face (the top), body (the block under it), ink (letter and value), wild (the letter on a wild tile), motif: a little
// picture in the top left corner, away from the letter and its value. Letters stay dark on light faces (or light on the dark one).
const reefTile = (face, body, ink, motif = '', wild = '#1f8a86') => ({ face, body, ink, wild, motif });
const REEF_TILES = [
  reefTile('#fff4dc', '#f3dfb6', '#3b2219'),
  reefTile('#ecd6ae', '#b98a58', '#4a2c1a', 'grain'),                // driftwood
  reefTile('#ffe3e0', '#ff9e8e', '#7a1f2c', 'coral', '#c2417a'),     // coral
  reefTile('#f8f3ff', '#d6c8ee', '#43295e', 'pearl', '#7a4ac0'),     // pearl
  reefTile('#d9f6ec', '#8fd6bf', '#154f47', 'wave', '#1f6fae'),      // sea glass
  reefTile('#26306c', '#171f4c', '#fff1cf', 'stars', '#7fe9d6'),     // ink
  reefTile('#ffeab0', '#f2b84a', '#5e3010', 'star', '#c0561a'),      // starfish
  reefTile('#ecf8ff', '#a8dcf5', '#1d4a7a', 'flake', '#2a8fd0'),     // ice (winter)
  reefTile('#ffc98a', '#ef8a2c', '#3b1a0a', 'pumpkin', '#6a2a8a'),   // pumpkin (halloween)
];
export const reefLook = k => REEF_TILES[k | 0] || REEF_TILES[0];
// the corner picture, drawn on a canvas square of side S (also used for the HUD tray via reefMotifSvg)
export function paintReefMotif(g, S, k) {
  const m = reefLook(k).motif; if (!m) return;
  const L = reefLook(k); g.save(); g.translate(S * .17, S * .17); const u = S * .09;
  if (m === 'grain') { g.strokeStyle = L.body; g.lineWidth = S * .025; for (const y of [-.9, 0, .9]) { g.beginPath(); g.moveTo(-u * 1.2, y * u); g.quadraticCurveTo(0, y * u - u * .6, u * 1.2, y * u); g.stroke(); } }
  else if (m === 'coral') { g.strokeStyle = L.body; g.lineWidth = S * .04; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, u * 1.2); g.lineTo(0, -u); g.moveTo(0, u * .2); g.lineTo(-u, -u * .6); g.moveTo(0, 0); g.lineTo(u, -u * .9); g.stroke(); }
  else if (m === 'pearl') { g.fillStyle = L.body; g.beginPath(); g.arc(0, 0, u * 1.05, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-u * .35, -u * .35, u * .35, 0, 7); g.fill(); }
  else if (m === 'wave') { g.strokeStyle = L.body; g.lineWidth = S * .035; g.lineCap = 'round'; for (const y of [-.5, .6]) { g.beginPath(); g.moveTo(-u * 1.3, y * u); g.quadraticCurveTo(-u * .65, y * u - u * .8, 0, y * u); g.quadraticCurveTo(u * .65, y * u + u * .8, u * 1.3, y * u); g.stroke(); } }
  else if (m === 'stars' || m === 'star' || m === 'flake') {
    g.fillStyle = m === 'stars' ? '#ffd84a' : L.body; g.strokeStyle = L.body; g.lineWidth = S * .03; g.lineCap = 'round';
    if (m === 'flake') { for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-u * 1.2, 0); g.lineTo(u * 1.2, 0); g.stroke(); } }
    else { const r = m === 'star' ? 1.25 : .9; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, q = (i % 2 ? .45 : 1) * r * u; g[i ? 'lineTo' : 'moveTo'](Math.sin(a) * q, -Math.cos(a) * q); } g.closePath(); g.fill();
      if (m === 'stars') { g.beginPath(); g.arc(u * 1.4, u * 1.2, u * .28, 0, 7); g.fill(); } }
  } else if (m === 'pumpkin') { g.fillStyle = '#d0661a'; g.beginPath(); g.ellipse(0, u * .2, u * 1.2, u * .9, 0, 0, 7); g.fill(); g.fillStyle = '#3f8a3a'; g.fillRect(-u * .15, -u * 1.05, u * .3, u * .5); }
  g.restore();
}

// ---------- Lantern Night lanterns (kind ln) ----------
// The lantern that bobs beside you on the island, and the tint of the light round you on your own screen. Only the look
// changes: every lantern lights the same distance. shape: box (paper), jar, candle, crystal, star, pumpkin.
// frame (cap and handle), glass (the shade), light (the flame and the glow), shape.
const lamp = (shape, frame, glass, light) => ({ shape, frame, glass, light });
const LANTERNS = [
  lamp('box', '#5a3a2a', '#ffb84a', '#ffd27a'),
  lamp('box', '#3b2f28', '#ff6f61', '#ffc0a0'),      // paper lantern (red)
  lamp('jar', '#8a6a4a', '#c9f0d8', '#d9ff7a'),      // firefly jar
  lamp('candle', '#c98a4a', '#fff4e2', '#ffe08a'),   // candle
  lamp('crystal', '#6a5aa0', '#b8f0ff', '#9fe8ff'),  // crystal
  lamp('star', '#c9901a', '#ffe680', '#fff1a8'),     // star
  lamp('pumpkin', '#3f8a3a', '#ff9a2c', '#ffc05a'),  // pumpkin (halloween)
];
export const lanternLook = k => LANTERNS[k | 0] || LANTERNS[0];
// The lantern as a little 3D model (THREE passed in, so this file needs no three.js import). About .5 tall, centred on
// its middle. The shade and flame are unlit so it glows by day and by night.
export function lanternModel(THREE, k) {
  const L = lanternLook(k), g = new THREE.Group(), std = c => new THREE.MeshStandardMaterial({ color: c, roughness: .55, flatShading: true });
  const glowM = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .9 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const flame = (y, s = 1) => { const f = add(new THREE.OctahedronGeometry(.055 * s), new THREE.MeshBasicMaterial({ color: L.light }), 0, y, 0); f.scale.y = 1.6; f.userData.noInk = true; return f; };
  const handle = y => { const h = add(new THREE.TorusGeometry(.08, .018, 4, 10, Math.PI), std(L.frame), 0, y, 0); return h; };
  if (L.shape === 'box') {
    add(new THREE.CylinderGeometry(.17, .17, .05, 6), std(L.frame), 0, .2); add(new THREE.CylinderGeometry(.18, .18, .05, 6), std(L.frame), 0, -.2);
    add(new THREE.CylinderGeometry(.16, .16, .36, 6), glowM(L.glass)); flame(0); handle(.23);
  } else if (L.shape === 'jar') {
    add(new THREE.CylinderGeometry(.15, .16, .36, 10), new THREE.MeshBasicMaterial({ color: L.glass, transparent: true, opacity: .55 }));
    add(new THREE.CylinderGeometry(.13, .13, .07, 10), std(L.frame), 0, .21); handle(.25);
    for (const [x, y, z] of [[-.06, .05, .05], [.07, -.06, .02], [0, -.1, -.07], [.04, .1, -.04]]) { const f = add(new THREE.SphereGeometry(.03, 6, 4), new THREE.MeshBasicMaterial({ color: L.light }), x, y, z); f.userData.noInk = true; }
  } else if (L.shape === 'candle') {
    add(new THREE.CylinderGeometry(.2, .22, .05, 10), std(L.frame), 0, -.22); add(new THREE.CylinderGeometry(.08, .08, .3, 10), std(L.glass), 0, -.05); flame(.16, 1.3);
    const r = add(new THREE.TorusGeometry(.07, .02, 4, 8), std(L.frame), .2, -.16, 0); r.rotation.y = Math.PI / 2;
  } else if (L.shape === 'crystal') {
    const c = add(new THREE.OctahedronGeometry(.18), glowM(L.glass)); c.scale.y = 1.5; c.userData.noInk = true;
    add(new THREE.CylinderGeometry(.08, .1, .06, 6), std(L.frame), 0, -.27); add(new THREE.CylinderGeometry(.06, .08, .06, 6), std(L.frame), 0, .27); handle(.3); flame(0, .8);
  } else if (L.shape === 'star') {
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .1 : .22; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .1, bevelEnabled: false }); geo.translate(0, 0, -.05); add(geo, glowM(L.glass)).userData.noInk = false;
    add(new THREE.CylinderGeometry(.03, .03, .08, 6), std(L.frame), 0, .25); handle(.3);
  } else if (L.shape === 'pumpkin') {
    const p = add(new THREE.SphereGeometry(.2, 10, 8), glowM(L.glass)); p.scale.y = .8;
    for (const x of [-.07, .07]) { const e = add(new THREE.ConeGeometry(.035, .06, 3), new THREE.MeshBasicMaterial({ color: '#4a1a00' }), x, .04, .16); e.rotation.x = Math.PI / 2; e.userData.noInk = true; }
    add(new THREE.BoxGeometry(.12, .025, .02), new THREE.MeshBasicMaterial({ color: '#4a1a00' }), 0, -.05, .17).userData.noInk = true;
    add(new THREE.CylinderGeometry(.025, .035, .08, 6), std(L.frame), 0, .19); handle(.22);
  }
  return g;
}

// ---------- Blast Bay pop seeds (kind bs) ----------
// One look for both your seed and the blast it makes: the pod, its leaves and the glowing tip, then the colour of the
// blast squares and the shape and colours of the bits that fly out. Only the look changes: every seed bursts the same.
// shape: pod, long (chili), acorn, pumpkin, star, gem, bubble, bonbon (a wrapped sweet), pearl (in an open shell). burst: a scenery3d.js particle shape name.
const seed = (shape, pod, leaf, tip, blast, core, bits, burst) => ({ shape, pod, leaf, tip, blast, core, bits, burst });
const SEEDS = [
  seed('pod', '#ff8fc8', '#6cbf4a', '#fff07a', '#ff8fc8', '#fff4fa', ['#ff8fc8', '#fff07a', '#ffffff', '#ffc2e0', '#7ad66b'], 'HEART'), // classic petal blast
  seed('long', '#e8402a', '#4f9a3a', '#ffd23f', '#ff7a3a', '#fff0b0', ['#ff5a2a', '#ffb02a', '#ffe36a', '#ffffff'], 'STAR'),            // ember chili
  seed('pod', '#6fd0ff', '#d8f4ff', '#ffffff', '#8fdcff', '#f2fbff', ['#bfeaff', '#ffffff', '#8fd0ff'], 'FLAKE'),                       // frost bud (winter)
  seed('bubble', '#4fd6c8', '#2f9a8a', '#d6fff8', '#6fe0d8', '#e8fffb', ['#bff5ef', '#ffffff', '#6fe0d8'], 'RING'),                        // bubble pod
  seed('bonbon', '#ffb0d8', '#9be3ff', '#ffffff', '#ffb0d8', '#fff7fb', ['#ff8fc8', '#8fd8ff', '#fff07a', '#b48cff', '#7ad66b'], 'CONF'),  // candy bonbon
  seed('acorn', '#ffcc3a', '#a0702a', '#fff6c0', '#ffd84a', '#fffbe0', ['#ffd84a', '#ffe98a', '#ffffff'], 'COIN'),                     // golden acorn
  seed('pumpkin', '#ff8a2a', '#3f8a3a', '#fff0a0', '#ff9a3a', '#ffe8c0', ['#ff8a2a', '#8a4ac8', '#2a1a2a', '#ffd23f'], 'DOT'),          // pumpkin (halloween)
  seed('star', '#ffd84a', '#ffaa2a', '#ffffff', '#ffe066', '#fffbe0', ['#ffe066', '#ffffff', '#ffb02a'], 'STAR'),                      // starfruit
  seed('gem', '#9b6aff', '#5a3ab0', '#fff07a', '#b48cff', '#f4ecff', ['#b48cff', '#fff07a', '#ffffff', '#7a5ae0'], 'STAR'),             // thunder berry
  seed('pearl', '#f4efe6', '#2f86cc', '#9fe8ff', '#5ab8e8', '#e8f8ff', ['#5ab8e8', '#ffffff', '#ffb0a0'], 'FISH'),                       // sea pearl
];
export const seedLook = k => SEEDS[k | 0] || SEEDS[0];
// The seed as a little 3D model (THREE passed in), standing on the ground, about .75 tall. The glowing tip is named
// 'tip' so a scene can blink it.
export function seedModel(THREE, k) {
  const S = seedLook(k), g = new THREE.Group(), std = c => new THREE.MeshStandardMaterial({ color: c, roughness: .55, flatShading: true });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const tip = y => { const t = add(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshBasicMaterial({ color: S.tip }), 0, y, 0); t.name = 'tip'; t.userData.noInk = true; return t; };
  const leaves = (y, n = 4, r = .15) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, lf = add(new THREE.ConeGeometry(.1, .28, 4), std(S.leaf), Math.cos(a) * r, y, Math.sin(a) * r); lf.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); } };
  const stem = y => add(new THREE.CylinderGeometry(.035, .05, .16, 6), std(S.leaf), 0, y, 0);
  if (S.shape === 'long') {
    const p = add(new THREE.CapsuleGeometry(.17, .32, 4, 10), std(S.pod), 0, .34); p.rotation.z = .25;
    stem(.66).rotation.z = .25; tip(.76);
  } else if (S.shape === 'acorn') {
    const p = add(new THREE.SphereGeometry(.26, 12, 10), std(S.pod), 0, .26); p.scale.y = 1.15;
    const cap = add(new THREE.SphereGeometry(.29, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(S.leaf), 0, .44); cap.scale.y = .6;
    stem(.6); tip(.7);
  } else if (S.shape === 'pumpkin') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, r = add(new THREE.SphereGeometry(.17, 10, 8), std(S.pod), Math.cos(a) * .13, .26, Math.sin(a) * .13); r.scale.set(.8, 1.3, .8); }
    add(new THREE.SphereGeometry(.2, 10, 8), std(S.pod), 0, .26); stem(.52); tip(.62);
  } else if (S.shape === 'star') {
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .15 : .34; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .16, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 1 }); geo.translate(0, 0, -.08);
    add(geo, std(S.pod), 0, .36); stem(.74); tip(.84);
  } else if (S.shape === 'gem') {
    const p = add(new THREE.OctahedronGeometry(.28), std(S.pod), 0, .34); p.scale.y = 1.25;
    leaves(.68, 3, .1); tip(.76);
  } else if (S.shape === 'bubble') {
    add(new THREE.IcosahedronGeometry(.22, 1), std(S.pod), 0, .28);
    const sk = add(new THREE.SphereGeometry(.32, 14, 10), new THREE.MeshStandardMaterial({ color: S.tip, transparent: true, opacity: .35, roughness: .2 }), 0, .32); sk.userData.noInk = true;
    for (const [x, y, z, r] of [[.24, .62, .05, .07], [-.2, .58, -.04, .05]]) add(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshStandardMaterial({ color: S.tip, transparent: true, opacity: .5 }), x, y, z).userData.noInk = true;
    stem(.66); tip(.76);
  } else if (S.shape === 'bonbon') {
    const p = add(new THREE.SphereGeometry(.24, 12, 10), std(S.pod), 0, .3); p.scale.set(1.15, 1, 1);
    for (const sd of [-1, 1]) { const w = add(new THREE.ConeGeometry(.15, .22, 6), std(S.leaf), sd * .36, .3); w.rotation.z = sd * Math.PI / 2; }
    const band = add(new THREE.TorusGeometry(.245, .035, 4, 16), std('#ffffff'), 0, .3); band.rotation.y = Math.PI / 2;
    tip(.6);
  } else if (S.shape === 'pearl') {
    const sh = add(new THREE.SphereGeometry(.34, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(S.leaf), 0, .3); sh.scale.y = .55;
    const lid = add(new THREE.SphereGeometry(.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(S.leaf), 0, .32, -.18); lid.scale.y = .55; lid.rotation.x = -1.05;
    add(new THREE.SphereGeometry(.2, 14, 10), std(S.pod), 0, .38); tip(.62);
  } else {
    const p = add(new THREE.IcosahedronGeometry(.3, 1), std(S.pod), 0, .3); p.scale.set(1, 1.1, 1);
    leaves(.62); tip(.7);
  }
  return g;
}

// ---------- Pet Herds number tiles (kind ht) ----------
// face (the top the number and pet sit on), body (the block under it, and the back that rivals see), edge (the rim of
// the HUD tile), ink: null keeps each pet's own number colour (best for reading), or one colour for every number on a
// dark face; motif: a faint pattern over the face, kept light so the number and the pet stay clear.
const herdTile = (face, body, edge, motif = '', ink = null, card = null) => ({ face, body, edge, motif, ink, card });
const HERD_TILES = [
  herdTile('#f2dfbf', '#e6cfa8', '#c9a77c'),                          // classic: warm sand
  herdTile('#e3c08e', '#b98457', '#9b6a43', 'grain'),                 // wood: light oak
  herdTile('#b7e6cf', '#7ed3b2', '#4fb08d', 'stripes'),               // mint candy
  herdTile('#26306c', '#171f4c', '#0e1436', 'stars', null, '#c7d0f3'), // night sky: a pale moonlight card inside the starry frame, so the pet colours read
  herdTile('#dedad4', '#b9b2a8', '#9a9288', 'veins'),                 // marble
  herdTile('#f4d488', '#e0a63a', '#c98a1a', 'hex'),                   // honeycomb
  herdTile('#cde9fa', '#8fcbee', '#6fb4dc', 'flake'),                 // frost (winter)
  herdTile('#f2cf72', '#e0a52a', '#b8801a', 'shine'),                 // golden herd (earned)
];
export const herdLook = k => HERD_TILES[k | 0] || HERD_TILES[0];
// The face background with its pattern, on a canvas of w x h (the game's tile faces are 128 x 170).
export function paintHerdFace(g, w, h, k) {
  const L = herdLook(k), m = L.motif, u = w / 128;
  g.fillStyle = L.face; g.fillRect(0, 0, w, h);
  if (!m) return;
  g.save(); g.globalAlpha = m === 'stars' ? .9 : .28; g.strokeStyle = g.fillStyle = L.body; g.lineCap = 'round';
  if (m === 'grain') { g.lineWidth = 2.5 * u; for (let y = 10; y < h; y += 22 * u) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y - 8 * u, w * .6, y + 8 * u, w, y - 3 * u); g.stroke(); } }
  else if (m === 'stripes') { g.lineWidth = 9 * u; for (let x = -h; x < w + h; x += 26 * u) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); } }
  else if (m === 'stars') { g.fillStyle = '#fff1b8'; for (const [x, y, r] of [[14, 14, 2.4], [112, 22, 2], [20, 96, 1.6], [108, 110, 2.4], [60, 158, 1.8], [102, 154, 1.4], [16, 150, 2]]) { g.beginPath(); g.arc(x * u, y * u, r * u, 0, 7); g.fill(); } }
  else if (m === 'veins') { g.lineWidth = 2 * u; for (const [a, b, c, d] of [[0, 30, 128, 70], [0, 120, 128, 96], [30, 0, 70, 170]]) { g.beginPath(); g.moveTo(a * u, b * u); g.bezierCurveTo((a + c) * .4 * u, b * u + 30 * u, (a + c) * .6 * u, d * u - 30 * u, c * u, d * u); g.stroke(); } }
  else if (m === 'hex') { g.lineWidth = 2.5 * u; const r = 14 * u; for (let row = 0; row * r * 1.5 < h + r; row++) for (let col = 0; col * r * 1.73 < w + r; col++) { const cx = col * r * 1.73 + (row % 2 ? r * .87 : 0), cy = row * r * 1.5; g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.stroke(); } }
  else if (m === 'flake') { g.lineWidth = 3 * u; for (const [x, y, s] of [[18, 18, 10], [110, 150, 12], [112, 24, 7]]) { for (let i = 0; i < 3; i++) { const a = Math.PI / 3 * i; g.beginPath(); g.moveTo((x - Math.cos(a) * s) * u, (y - Math.sin(a) * s) * u); g.lineTo((x + Math.cos(a) * s) * u, (y + Math.sin(a) * s) * u); g.stroke(); } } }
  else if (m === 'shine') { g.globalAlpha = .55; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, 40 * u); g.lineTo(40 * u, 0); g.lineTo(62 * u, 0); g.lineTo(0, 62 * u); g.fill(); g.beginPath(); g.moveTo(w, 120 * u); g.lineTo(w - 20 * u, h); g.lineTo(w - 30 * u, h); g.lineTo(w, 108 * u); g.fill(); }
  g.restore();
  // readability: the number and pet sit on calm ground. Dark sets get a cream card inside their frame; the others
  // fade their pattern out under the middle of the face, so it only shows round the edges.
  g.save();
  if (L.card) { const i = 9 * u, r = 10 * u; g.fillStyle = L.card; g.beginPath(); g.roundRect(i, i, w - i * 2, h - i * 2, r); g.fill(); }
  else { const gr = g.createRadialGradient(w / 2, h * .5, 0, w / 2, h * .5, h * .5); gr.addColorStop(0, L.face); gr.addColorStop(.62, L.face); gr.addColorStop(1, L.face + '00'); g.fillStyle = gr; g.globalAlpha = .88; g.fillRect(0, 0, w, h); }
  g.restore();
}

// ---------- Sugar Siege slingshots (kind sl) ----------
// The fork your pet throws with. wood: handle and prongs, dark: knots and tips, grip: the wrap on the handle,
// band: the rubber band, pouch: the bit that holds the snack. Append only: index 0 is the classic wooden one.
const sling = (wood, dark, grip, band, pouch, tip = 'ball') => ({ wood, dark, grip, band, pouch, tip });
export const SLINGS = [
  sling('#c98a4b', '#7a4a22', '#f2d9a6', '#e0524f', '#6b3f22'),   // classic wood
  sling('#ff8fab', '#ffffff', '#ffffff', '#7fd1e8', '#ff5d8f', 'star'),   // candy
  sling('#6cbf4a', '#3f8a3a', '#a8e08a', '#ffc93c', '#4f9a3a', 'leaf'),   // sprout
  sling('#ff7fa8', '#e5435f', '#ffd6e2', '#ffffff', '#e5435f', 'heart'),  // sweetheart
  sling('#ffc93c', '#c99a1a', '#fff1a8', '#e5543b', '#b07a20', 'star'),   // golden
  sling('#f4efe6', '#c9c2b4', '#5a4a6a', '#8a4ac8', '#2a1a2a'),           // bone (halloween)
  sling('#bfe9ff', '#ffffff', '#7fc8ee', '#e6f6ff', '#4f9de0', 'star'),   // frost (winter)
];
export const slingLook = k => SLINGS[k | 0] || SLINGS[0];
// The slingshot as a 3D model (THREE passed in). Its origin is the crotch of the fork: the handle hangs down -y (.42),
// the two prongs splay up in the x-y plane to about +.36. userData.tips holds the two band anchor points (local).
export function slingModel(THREE, k) {
  const S = slingLook(k), g = new THREE.Group(), std = c => new THREE.MeshStandardMaterial({ color: c, roughness: .6, flatShading: true });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const wood = std(S.wood), dark = std(S.dark);
  add(new THREE.CylinderGeometry(.055, .065, .42, 7), wood, 0, -.21);                       // handle
  add(new THREE.CylinderGeometry(.07, .07, .18, 7), std(S.grip), 0, -.27);                  // grip wrap
  add(new THREE.SphereGeometry(.075, 8, 6), wood, 0, 0);                                     // the knot where it forks
  const tips = [];
  for (const sd of [-1, 1]) {
    const pr = add(new THREE.CylinderGeometry(.04, .05, .36, 6), wood, sd * .09, .16); pr.rotation.z = -sd * .5;
    const tx = sd * .18, ty = .32;
    if (S.tip === 'star') { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .04 : .09; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: .04, bevelEnabled: false }); geo.translate(0, 0, -.02); add(geo, dark, tx, ty + .02); }
    else if (S.tip === 'leaf') { const lf = add(new THREE.ConeGeometry(.06, .16, 4), dark, tx + sd * .03, ty + .06); lf.rotation.z = -sd * .5; lf.scale.z = .4; }
    else if (S.tip === 'heart') { for (const hx of [-.03, .03]) add(new THREE.SphereGeometry(.04, 8, 6), dark, tx + hx, ty + .03); const pt = add(new THREE.ConeGeometry(.06, .07, 6), dark, tx, ty - .02); pt.rotation.z = Math.PI; }
    else add(new THREE.SphereGeometry(.055, 8, 6), dark, tx, ty);
    tips.push(new THREE.Vector3(tx, ty, 0));
  }
  g.userData.tips = tips; g.userData.look = S;
  return g;
}

// ---------- Sky Darts darts (kind dt) ----------
// barrel, shaft and tip colours, an optional band round the barrel, and the flight shape. The flights always stay in
// the thrower's own colour, so everyone can still tell whose darts are in the board.
// flight: 'std' (four flat vanes), 'feather' (long soft feathers), 'heart', 'fin' (swept rocket fins).
const dart = (barrel, shaft, tip, flight = 'std', band = null) => ({ barrel, shaft, tip, flight, band });
const DARTS = [
  dart('#d9dde3', '#3b2219', '#5b5f66'),                         // classic
  dart('#ffc93c', '#7a4a2a', '#c9a23a', 'std', '#fff1a8'),       // brass
  dart('#b07a46', '#8a5a34', '#5b5f66', 'feather'),              // feather
  dart('#ff8fab', '#ffffff', '#c9ccd2', 'heart', '#ffffff'),     // candy hearts
  dart('#e5543b', '#c9ccd2', '#ffffff', 'fin', '#ffffff'),       // rocket
  dart('#3a2e7a', '#241c4e', '#ffd84a', 'fin', '#ffd84a'),       // starlight
  dart('#bfe9ff', '#e6f6ff', '#ffffff', 'std', '#7fc8ee'),       // icicle (winter)
];
export const dartLook = k => DARTS[k | 0] || DARTS[0];

// ---------- Burrow Bop boppers (kind bb) ----------
// Every bopper is the same size and bops the same: only the look changes. shape picks the model in bopperModel.
const BOPPERS = [
  { shape: 'pillow', a: '#ff8fab', b: '#fff6e6', h: '#c98a52' },   // classic pillow mallet
  { shape: 'hammer', a: '#e5543b', b: '#ffc93c', h: '#4fa3e3' },   // squeaky toy hammer
  { shape: 'baguette', a: '#e8a85a', b: '#fff1d0', h: '#e8a85a' }, // baguette
  { shape: 'paw', a: '#ffb27a', b: '#ff8fab', h: '#8a5a34' },      // foam paw
  { shape: 'carrot', a: '#ff8a2a', b: '#6cc24f', h: '#ff8a2a' },   // carrot
  { shape: 'fish', a: '#7fc8ee', b: '#4f9de0', h: '#7fc8ee' },     // fish
  { shape: 'cane', a: '#ffffff', b: '#e5352b', h: '#ffffff' },     // candy cane (winter)
];
export const bopperLook = k => BOPPERS[k | 0] || BOPPERS[0];
// The bopper as a group: a handle 1.5 tall along +y from 0, and a group 'head' at y 1.5 holding the bopping end
// (the scene squashes 'head' on a bop). M(colour) makes a material.
export function bopperModel(THREE, k, M) {
  const S = bopperLook(k), g = new THREE.Group(), add = (geo, c, x, y, z, p = g) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); p.add(m); return m; };
  const head = new THREE.Group(); head.position.y = 1.5; g.add(head); g.userData.head = head;
  if (S.shape === 'baguette' || S.shape === 'carrot' || S.shape === 'cane') { // one long thing held at its end
    if (S.shape === 'baguette') { add(new THREE.BoxGeometry(.3, 2.1, .3), S.a, 0, 1.05, 0); for (const y of [.5, 1, 1.5]) add(new THREE.BoxGeometry(.32, .08, .2), S.b, 0, y, .08).rotation.z = .5; add(new THREE.BoxGeometry(.34, .3, .34), S.a, 0, 0, 0, head); }
    else if (S.shape === 'carrot') { add(new THREE.CylinderGeometry(.26, .08, 1.9, 6), S.a, 0, .95, 0).rotation.x = Math.PI; for (const r of [-.4, 0, .4]) add(new THREE.BoxGeometry(.1, .5, .1), S.b, Math.sin(r) * .2, -.2, 0).rotation.z = r; add(new THREE.CylinderGeometry(.28, .26, .3, 6), S.a, 0, 0, 0, head); }
    else { add(new THREE.BoxGeometry(.16, 1.6, .16), S.a, 0, .75, 0); for (const y of [.2, .55, .9, 1.25]) add(new THREE.BoxGeometry(.18, .1, .18), S.b, 0, y, 0).rotation.y = .4;
      const hook = new THREE.Group(); head.add(hook); for (let i = 0; i < 5; i++) { const a = i / 4 * Math.PI; add(new THREE.BoxGeometry(.17, .22, .17), i % 2 ? S.b : S.a, Math.cos(a) * .3 - .3, Math.sin(a) * .3, 0, hook).rotation.z = a; } }
    return g;
  }
  add(new THREE.BoxGeometry(.15, 1.5, .15), S.h, 0, .7, 0);
  if (S.shape === 'hammer') { add(new THREE.BoxGeometry(1.0, .6, .6), S.a, 0, 0, 0, head); for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.16, .7, .7), S.b, sx * .52, 0, 0, head); add(new THREE.BoxGeometry(.2, .2, .62), S.b, 0, -.32, 0, head); }
  else if (S.shape === 'paw') { add(new THREE.BoxGeometry(.9, .55, .7), S.a, 0, 0, 0, head); add(new THREE.BoxGeometry(.5, .06, .36), S.b, 0, -.04, .36, head); for (const x of [-.32, -.11, .11, .32]) { add(new THREE.BoxGeometry(.2, .3, .2), S.a, x, .38, .1, head); add(new THREE.BoxGeometry(.12, .06, .12), S.b, x, .38, .21, head); } }
  else if (S.shape === 'fish') { add(new THREE.BoxGeometry(1.0, .55, .4), S.a, 0, 0, 0, head); const tail = add(new THREE.BoxGeometry(.4, .55, .1), S.b, -.62, 0, 0, head); tail.rotation.z = Math.PI / 4; add(new THREE.BoxGeometry(.1, .1, .42), '#3b2219', .34, .08, 0, head); add(new THREE.BoxGeometry(.4, .14, .42), S.b, 0, .32, 0, head); }
  else { add(new THREE.BoxGeometry(1.05, .66, .7), S.a, 0, 0, 0, head); for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.14, .76, .8), S.b, sx * .56, 0, 0, head); }
  return g;
}

// ---------- Cove Clash boats (kind bt) ----------
// hull: the hull's colour (null keeps a darker shade of the player's colour), deck, cabin, and a bow piece. The trim
// round the hull and the flag stay in the player's own colour. bow: '' none, 'duck' a duck head, 'dragon' a dragon head,
// 'skull' a black flag with a white skull instead of the plain flag, 'dragon' a dragon head with round shields along the sides.
const boat = (hull, deck, cabin, bow = '', roof = null) => ({ hull, deck, cabin, bow, roof });
const BOATS = [
  boat(null, '#e9c48c', '#fff4e2'),                                // classic
  boat('#4a3326', '#8a5a3c', '#6b4a36', 'skull', '#2b2028'),       // pirate
  boat('#ffd23f', '#ffe98a', '#fff4e2', 'duck'),                   // rubber duck
  boat('#a86a42', '#d9ab74', '#c98a52', 'dragon'),                 // viking
  boat('#f4f4f0', '#ffffff', '#e8eef6', ''),                       // paper boat
  boat('#ffc93c', '#fff1a8', '#fff8e0', '', '#e8a820'),            // golden
  boat('#bfe9ff', '#e6f6ff', '#ffffff', '', '#9fd8f5'),            // ice (winter)
];
export const boatLook = k => BOATS[k | 0] || BOATS[0];

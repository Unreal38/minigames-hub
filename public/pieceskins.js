// Looks for the pieces of Sky Pool (cue, kind cu), Chess (set, kind cs) and Dominoes (tiles, kind dm).
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

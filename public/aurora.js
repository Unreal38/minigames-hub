// The aurora's shape and colours, shared by the 3D sky (weather3d.js skyAurora) and the hub page sky (aurorasky.js),
// so both look the same (Kuba, 2026-11-27: the isle's aurora looked far better than the page's). No three.js here.
// Like the real thing: oxygen green with a bright, sharp lower hem that glows almost white, a pink fringe just under it
// where the curtain is brightest, and tops fading through violet to a dim red. The light comes in vertical rays that
// shimmer and drift along the curtain, and each curtain folds back and forth across the sky.

// Rows of each column, bottom to top: [height above the hem as a share of the curtain, colour, alpha].
export const AUR_ROWS = [[-.06, '#ff5fa8', 0], [0, '#d8ffe6', 1], [.12, '#4dff9a', .95], [.45, '#2fd98a', .55], [.75, '#7a5cff', .22], [1, '#c0406a', 0]];
// Curtains: hem height, curtain height (radians), phase, strength, how far it reaches to each side (radians), fold size
export const AUR = [[.03, .36, 0, 1, .62, .09], [.12, .28, 2.3, .7, .48, .11], [.2, .22, 4.1, .5, .38, .07]];

const hsh = i => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
const vnoise = x => { const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t); return hsh(i) * (1 - u) + hsh(i + 1) * u; }; // smooth 1D noise, 0..1

// Walks every column of every curtain at time T: each(b, j, f, hem, tall, bright, ray), f = sideways angle, hem and tall in
// radians above the horizon, bright 0..~1.3 (times the row alphas), ray 0..1 (the pink fringe follows the rays).
export function auroraColumns(T, SEG, each) {
  AUR.forEach(([base, h, ph, k, W, fold], b) => {
    // a slow surge: now and then the whole curtain brightens and its rays race along it
    const surge = .75 + .25 * Math.sin(T * .11 + ph * 1.7) + .2 * Math.max(0, Math.sin(T * .037 + ph) - .6) * 2.5;
    for (let j = 0; j <= SEG; j++) {
      const u = j / SEG, x = u * 2 - 1, ends = Math.pow(Math.max(0, Math.sin(Math.PI * u)), .8);
      // the curtain's path folds: it wobbles from side to side, and the hem waves up and down
      const f = x * W + fold * Math.sin(x * 4.2 + T * .09 + ph) * Math.cos(x * 1.3 - T * .05);
      const hem = base + .05 * Math.sin(x * 3.1 + T * .13 + ph) + .02 * Math.sin(x * 9.7 - T * .21 + ph * 2);
      // rays: fine streaks drifting sideways along the curtain, over a slower patchy brightness
      const s = j * .55 * 160 / SEG, ray = Math.pow(vnoise(s + T * .9 + ph * 10) * .6 + vnoise(s * 2.3 - T * 1.7 + ph * 20) * .4, 1.6);
      const patch = .35 + .65 * vnoise(u * 6 + T * .08 + ph * 3), tall = h * (.55 + .45 * patch + .25 * ray);
      each(b, j, f, hem, tall, k * ends * surge * (.25 + .75 * ray) * (.45 + .55 * patch), ray);
    }
  });
}

// Word Reef bonus square pictures, painted on a canvas and laid on the board as decals.
// Kept apart from scene3d.js (no three.js) so the pictures can be checked on their own.
// Letter bonuses wear a little cream "tile" badge, word bonuses a dark pill, so x2 letter and x2 word never look alike.
export const KIND_COL = { '.': '#f4e2b4', p: '#ffc4d6', s: '#ffb062', w: '#86d0f2', v: '#a493f2', n: '#c3e39a', '*': '#ffd84a' };
const INK = '#3b2219';
const TAU = Math.PI * 2;

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const dark = (h, t) => mix(h, '#000000', t), light = (h, t) => mix(h, '#ffffff', t);
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); return gr; };
const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); return gr; };
function outline(g, S, w = .03) { g.lineWidth = S * w; g.strokeStyle = INK; g.stroke(); }
function shine(g, x, y, rx, ry, a = .8) { g.save(); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, -.6, 0, TAU); g.fill(); g.restore(); }

// the frame every bonus square gets: a sunk rim in the square's own colour
function frame(g, S, base) {
  const m = S * .045;
  rr(g, m, m, S - 2 * m, S - 2 * m, S * .14);
  g.lineWidth = S * .035; g.strokeStyle = dark(base, .25); g.globalAlpha = .5; g.stroke(); g.globalAlpha = 1;
}

// x2 / x3 badges at the bottom of the square
function badge(g, S, text, kind, col) {
  const c = S / 2, y = S * .79;
  g.font = `900 ${S * .37}px Rubik, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'letter') { // a little cream letter tile
    const w = S * .62, h = S * .37, x = c - w / 2, t = y - h / 2;
    rr(g, x, t + S * .025, w, h, S * .05); g.fillStyle = '#c79a5e'; g.fill();
    rr(g, x, t, w, h, S * .05); g.fillStyle = lin(g, 0, t, 0, t + h, ['#fffaf0', '#f6e3bd']); g.fill(); outline(g, S, .022);
    g.fillStyle = col; g.fillText(text, c, y + S * .008);
  } else { // a dark pill for the whole word
    const w = S * .78, h = S * .36, x = c - w / 2, t = y - h / 2;
    rr(g, x, t, w, h, h / 2); g.fillStyle = lin(g, 0, t, 0, t + h, [light(col, .15), dark(col, .12)]); g.fill(); outline(g, S, .022);
    g.fillStyle = '#ffffff'; g.fillText(text, c, y + S * .008);
  }
}

function pearl(g, S) { // an open scallop shell with a shiny pearl
  const c = S / 2, hy = S * .6, R = S * .3, base = '#ff8fb1';
  g.beginPath();
  const a0 = Math.PI * 1.08, a1 = Math.PI * 1.92, bumps = 7;
  g.moveTo(c - S * .07, hy);
  for (let i = 0; i <= bumps; i++) {
    const a = a0 + (a1 - a0) * i / bumps, x = c + Math.cos(a) * R, y = hy + Math.sin(a) * R;
    if (i === 0) g.lineTo(x, y);
    else { const am = a0 + (a1 - a0) * (i - .5) / bumps; g.quadraticCurveTo(c + Math.cos(am) * R * 1.13, hy + Math.sin(am) * R * 1.13, x, y); }
  }
  g.lineTo(c + S * .07, hy); g.closePath();
  g.fillStyle = lin(g, 0, hy - R, 0, hy, [light(base, .55), base, dark(base, .12)]); g.fill(); outline(g, S);
  g.save(); g.clip(); g.strokeStyle = dark(base, .25); g.lineWidth = S * .016; g.globalAlpha = .6;
  for (let i = 1; i < bumps; i++) { const a = a0 + (a1 - a0) * i / bumps; g.beginPath(); g.moveTo(c, hy); g.lineTo(c + Math.cos(a) * R * 1.1, hy + Math.sin(a) * R * 1.1); g.stroke(); }
  g.restore();
  // the hinge
  rr(g, c - S * .1, hy - S * .02, S * .2, S * .07, S * .025); g.fillStyle = dark(base, .08); g.fill(); outline(g, S, .024);
  // the pearl
  const px = c, py = hy - S * .1, pr = S * .095;
  g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fillStyle = rad(g, px - pr * .35, py - pr * .4, pr * .1, pr * 1.2, ['#ffffff', '#f4eefc', '#cfc3e6']); g.fill(); outline(g, S, .026);
  shine(g, px - pr * .35, py - pr * .38, pr * .3, pr * .18, .95);
}

function starfish(g, S) { // a chubby five-armed starfish with bumps
  const c = S / 2, cy = S * .4, R = S * .31, r = S * .13, rot = -Math.PI / 2 - .12, base = '#ff8a3d';
  const pt = (i, rad) => { const a = rot + i * Math.PI / 5; return [c + Math.cos(a) * rad, cy + Math.sin(a) * rad]; };
  g.beginPath();
  for (let i = 0; i < 10; i += 2) {
    const [ox, oy] = pt(i, R), [ix, iy] = pt(i + 1, r), [tx1, ty1] = pt(i - .28, R * .96), [tx2, ty2] = pt(i + .28, R * .96);
    if (i === 0) { const [sx, sy] = pt(-1, r); g.moveTo(sx, sy); }
    g.quadraticCurveTo(...pt(i - .5, r * 1.35), tx1, ty1);
    g.quadraticCurveTo(ox + (ox - c) * .08, oy + (oy - cy) * .08, tx2, ty2);
    g.quadraticCurveTo(...pt(i + .5, r * 1.35), ix, iy);
  }
  g.closePath();
  g.fillStyle = rad(g, c, cy, S * .02, R, ['#ffd08a', '#ffa354', base, dark(base, .1)]); g.fill(); outline(g, S);
  // bumps down each arm
  g.fillStyle = 'rgba(255,240,215,.9)';
  for (let i = 0; i < 10; i += 2) for (const f of [.38, .58, .76]) { const [x, y] = pt(i, R * f); g.beginPath(); g.arc(x, y, S * (.026 - f * .012), 0, TAU); g.fill(); }
  g.beginPath(); g.arc(c, cy, S * .035, 0, TAU); g.fillStyle = dark(base, .25); g.fill();
}

function wave(g, S) { // a curling wave with foam on the crest
  const c = S / 2, cy = S * .42, k = S * .3, base = '#2f8fd8';
  const P = (x, y) => [c + x * k, cy + y * k];
  g.beginPath();
  g.moveTo(...P(-1.05, .62));
  g.bezierCurveTo(...P(-.9, -.1), ...P(-.35, -.9), ...P(.3, -.86));
  g.bezierCurveTo(...P(.85, -.82), ...P(1.08, -.3), ...P(.78, -.08));
  g.bezierCurveTo(...P(.58, .06), ...P(.36, -.1), ...P(.46, -.3));
  g.bezierCurveTo(...P(.12, -.38), ...P(-.12, -.05), ...P(-.02, .62));
  g.closePath();
  g.fillStyle = lin(g, 0, cy - k, 0, cy + k * .6, ['#7fd0ff', base, '#1c5fae']); g.fill(); outline(g, S);
  // foam along the top of the crest
  g.save(); g.clip();
  g.lineWidth = S * .07; g.strokeStyle = 'rgba(255,255,255,.95)'; g.beginPath();
  g.moveTo(...P(-.85, .1)); g.bezierCurveTo(...P(-.65, -.55), ...P(-.1, -.95), ...P(.4, -.9)); g.bezierCurveTo(...P(.9, -.82), ...P(1.05, -.32), ...P(.8, -.12)); g.stroke();
  g.restore();
  // a water line under it
  g.beginPath(); g.moveTo(...P(-1.12, .62)); g.lineTo(...P(1.12, .62));
  g.lineWidth = S * .05; g.strokeStyle = '#1c5fae'; g.stroke();
  for (const [x, y, r] of [[.9, -.98, .07], [1.06, -.7, .05], [.62, -1.05, .045]]) { g.beginPath(); g.arc(...P(x, y), S * r * .6, 0, TAU); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = S * .014; g.strokeStyle = INK; g.stroke(); }
}

function whirlpool(g, S) { // a deep swirl with a white spiral of foam
  const c = S / 2, cy = S * .4, R = S * .3;
  g.beginPath(); g.arc(c, cy, R, 0, TAU);
  g.fillStyle = rad(g, c, cy, S * .01, R, ['#1d1660', '#3e33a8', '#6d5ee6', '#9c90ff']); g.fill(); outline(g, S);
  g.save(); g.beginPath(); g.arc(c, cy, R - S * .01, 0, TAU); g.clip();
  // the spiral, thin in the middle and wider outside
  let px = c, py = cy;
  for (let a = .4; a < 15.5; a += .12) {
    const r = R * (a / 15.5) * 1.02, x = c + Math.cos(-a) * r, y = cy + Math.sin(-a) * r;
    g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.lineWidth = S * (.008 + .045 * a / 15.5); g.strokeStyle = `rgba(255,255,255,${.35 + .6 * a / 15.5})`; g.lineCap = 'round'; g.stroke();
    px = x; py = y;
  }
  g.restore();
  // foam on the rim
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .3; g.beginPath(); g.arc(c + Math.cos(a) * R, cy + Math.sin(a) * R, S * (i % 2 ? .026 : .036), 0, TAU); g.fillStyle = '#ffffff'; g.fill(); }
}

function nest(g, S) { // a twig nest with two eggs
  const c = S / 2, cy = S * .46, base = '#9b6a3e';
  // the dark inside of the bowl
  g.beginPath(); g.ellipse(c, cy - S * .06, S * .29, S * .1, 0, 0, TAU); g.fillStyle = dark(base, .45); g.fill();
  // eggs
  const egg = (x, y, rx, ry, col, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.moveTo(0, -ry); g.bezierCurveTo(rx * 1.05, -ry, rx * 1.1, ry * .75, 0, ry); g.bezierCurveTo(-rx * 1.1, ry * .75, -rx * 1.05, -ry, 0, -ry);
    g.fillStyle = rad(g, -rx * .3, -ry * .3, 1, ry * 1.3, [light(col, .7), col, dark(col, .12)]); g.fill(); outline(g, S, .024);
    g.fillStyle = dark(col, .35); for (const [sx, sy, sr] of [[-.3, -.2, .1], [.25, .1, .08], [-.05, .35, .07], [.3, -.45, .06]]) { g.beginPath(); g.arc(sx * rx, sy * ry, sr * rx, 0, TAU); g.fill(); }
    shine(g, -rx * .35, -ry * .45, rx * .18, ry * .12, .9);
    g.restore();
  };
  egg(c - S * .085, cy - S * .14, S * .085, S * .12, '#9fe0d8', -.2);
  egg(c + S * .08, cy - S * .12, S * .08, S * .11, '#fff1cf', .25);
  // the bowl in front
  g.beginPath(); g.moveTo(c - S * .33, cy - S * .07);
  g.bezierCurveTo(c - S * .3, cy + S * .2, c + S * .3, cy + S * .2, c + S * .33, cy - S * .07);
  g.bezierCurveTo(c + S * .2, cy - S * .01, c - S * .2, cy - S * .01, c - S * .33, cy - S * .07);
  g.closePath();
  g.fillStyle = lin(g, 0, cy - S * .08, 0, cy + S * .15, [light(base, .2), base, dark(base, .2)]); g.fill(); outline(g, S);
  // woven twigs
  g.save(); g.clip(); g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = cy - S * .04 + i * S * .022, s = i % 2 ? 1 : -1;
    g.beginPath(); g.moveTo(c - S * .36, y + s * S * .02); g.quadraticCurveTo(c, y + S * .06 - s * S * .03, c + S * .36, y - s * S * .02);
    g.lineWidth = S * .014; g.strokeStyle = i % 3 ? dark(base, .3) : light(base, .35); g.stroke();
  }
  g.restore();
  // stray twigs at the rim
  g.lineWidth = S * .018; g.strokeStyle = dark(base, .2); g.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [[-.36, -.1, -.26, -.03], [.26, -.03, .38, -.12], [-.2, .02, -.32, .06]]) { g.beginPath(); g.moveTo(c + x0 * S, cy + y0 * S); g.lineTo(c + x1 * S, cy + y1 * S); g.stroke(); }
}

function bigStar(g, S) { // the middle: a big shiny star with sparkles
  const c = S / 2, cy = S * .41, R = S * .3, r = S * .14, base = '#ffc21a';
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; const x = c + Math.cos(a) * q, y = cy + Math.sin(a) * q; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.lineJoin = 'round';
  g.fillStyle = lin(g, c - R, cy - R, c + R, cy + R, ['#fff8c9', '#ffe066', base, '#f0a000']); g.fill(); outline(g, S, .034);
  // a facet down the middle of each point
  g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 10; i += 2) { const a = -Math.PI / 2 + i * Math.PI / 5, b = a + Math.PI / 5; g.beginPath(); g.moveTo(c, cy); g.lineTo(c + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(c + Math.cos(b) * r, cy + Math.sin(b) * r); g.closePath(); g.fill(); }
  g.restore();
  const spark = (x, y, s) => { g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fillStyle = '#ffffff'; g.fill(); };
  spark(c + S * .3, cy - S * .26, S * .06); spark(c - S * .32, cy + S * .02, S * .045); spark(c + S * .29, cy + S * .14, S * .035);
}

const ICON = { p: pearl, s: starfish, w: wave, v: whirlpool, n: nest, '*': bigStar };
const BADGE = { p: ['×2', 'letter', '#c2456f'], s: ['×3', 'letter', '#c4501a'], w: ['×2', 'word', '#1d5fa8'], v: ['×3', 'word', '#3e33a8'], n: ['+10', 'word', '#4f8a2a'], '*': ['×2', 'word', '#c07a00'] };

// the picture on a bonus square: its shape and how much it gives
export function paintKind(g, S, k) {
  g.clearRect(0, 0, S, S);
  if (!ICON[k]) return;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  frame(g, S, KIND_COL[k]);
  g.translate(S / 2, S * .35); g.scale(1.02, 1.02); g.translate(-S / 2, -S * .41);
  ICON[k](g, S);
  g.restore();
  g.save(); g.lineJoin = 'round'; const [t, kind, col] = BADGE[k]; badge(g, S, t, kind, col); g.restore();
}

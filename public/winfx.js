// Win effects: a few seconds of particles over the whole screen when the winner has one on (cosmetics.js, kind wn).
// One 2D canvas, no three.js, and it removes itself when done, so it costs nothing the rest of the time.
import { drawFish, drawShape } from './fxart.js';
const KINDS = {
  1: { n: 150, draw: 'rect', cols: ['#ff5d8f', '#ffc93c', '#4fc3e8', '#7ed37a', '#c9b3ff', '#ff8a2a'], from: 'top' },      // confetti
  2: { n: 60, glyph: ['💖', '💗', '❤️', '💕'], from: 'bottom' },                                                           // hearts
  3: { n: 55, draw: 'fish', from: 'top', spin: .5 },                                                    // fish rain
  4: { n: 0, bursts: 7, cols: ['#ff5d8f', '#ffc93c', '#4fc3e8', '#7ed37a', '#ffffff', '#c9b3ff'] },                          // fireworks
  5: { n: 80, draw: 'coin', from: 'top' },                                                                                   // coin shower
  6: { n: 120, draw: 'flake', from: 'top', slow: true, spin: 1.5 },                                                       // snowfall
  7: { n: 60, glyph: ['☕', '🥐', '🍩', '🍪'], from: 'top', spin: 2 },                                                       // coffee break (Supporter pack)
  // drawn pictures (PICS below), named in glyph like the emoji ones
  8: { n: 80, glyph: ['blossom', 'petal', 'blossom2', 'petal'], from: 'top', slow: true, spin: 2 },                         // blossoms (spring)
  9: { n: 70, glyph: ['bubble'], from: 'bottom', spin: 0 },                                                                // bubbles (summer)
  10: { n: 60, glyph: ['bat', 'bat', 'pumpkin'], from: 'bottom', spin: 1 },                                                 // bats (Halloween)
  11: { n: 60, glyph: ['paw', 'paw2', 'paw3'], from: 'top', spin: 2 },                                                      // paw prints
};
let live = null;
// Who has which win effect on: app.js keeps this up to date, so a game scene only names a seat (createFx().confetti
// with { s: seat }) and a game client calls myBurst() for the player's own good moments.
let seatFx = [], myFx = 0;
export const setSeatFx = list => { seatFx = Array.isArray(list) ? list : []; };
export const setMyFx = k => { myFx = KINDS[k] ? k : 0; };
export const fxOf = s => s === 'me' ? myFx : KINDS[seatFx[s]] ? seatFx[s] : 0;
// The player's own win effect as a short, lighter burst, in place of a game's plain confetti. False if they have none
// on (the game then draws its own confetti).
export function myBurst() { return burst(myFx); }
// The same for someone else's good moment (a seat number): their win effect, so a player who wears snowflakes never
// gets plain confetti on anyone's screen. False if they have none on.
export const seatBurst = s => burst(fxOf(s));
function burst(k) {
  if (!k) return false;
  if (!live || live.light) playWinFx(k, { ms: 2300, light: true });
  return true;
}
// Every particle is drawn from a small picture made once (an emoji, a coin, a confetti strip), because drawing emoji
// text 100+ times a frame is slow enough to drop frames on phones and laptops while the results screen comes in.
const sprites = new Map();
function sprite(key, sz, paint) {
  if (sprites.has(key)) return sprites.get(key);
  const c = document.createElement('canvas'), px = Math.ceil(sz * 2) + 4; c.width = c.height = px;
  const g = c.getContext('2d'); g.translate(px / 2, px / 2); paint(g, sz); sprites.set(key, c); return c;
}
const fishSprite = () => sprite('fish', 64, (g, s) => drawFish(g, 0, 0, s));
// drawn, not an emoji: as text the snowflake came out black on some systems and could not be seen at night
const flakeSprite = () => sprite('flake', 64, (g, s) => drawShape(g, 'flake', 0, 0, s * .92, { fill: '#ffffff', shade: '#cfe6fa', edge: '#5f84a8' }));
const big = K => K.draw === 'fish' || K.draw === 'flake';
// Pictures drawn here instead of taken from the system's emoji, so they look the same everywhere. Each paints into a
// box of half-size s round the middle, in the flat fill + ink outline look of fxart.js.
const INK = '#3b2219';
const inked = (g, s, fill, path) => { g.lineJoin = g.lineCap = 'round'; g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = s * .09; g.stroke(); };
const blossom = (pet, mid) => (g, s) => { for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * 1.2566); inked(g, s, pet, () => { g.moveTo(0, -s * .12); g.bezierCurveTo(s * .5, -s * .3, s * .42, -s * .95, 0, -s * .9); g.bezierCurveTo(-s * .42, -s * .95, -s * .5, -s * .3, 0, -s * .12); }); g.restore(); }
  g.fillStyle = mid; g.beginPath(); g.arc(0, 0, s * .2, 0, 6.3); g.fill(); g.fillStyle = '#c2185b'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.sin(i * 1.2566 + .6) * s * .32, -Math.cos(i * 1.2566 + .6) * s * .32, s * .045, 0, 6.3); g.fill(); } };
const pawPic = (fill, pad) => (g, s) => { inked(g, s, fill, () => g.arc(0, 0, s * .92, 0, 6.3)); g.fillStyle = pad; g.beginPath(); g.ellipse(0, s * .28, s * .4, s * .32, 0, 0, 6.3); g.fill();
  for (const [x, y] of [[-.5, -.08], [-.19, -.42], [.19, -.42], [.5, -.08]]) { g.beginPath(); g.ellipse(x * s, y * s, s * .15, s * .19, x * .6, 0, 6.3); g.fill(); } };
const PICS = {
  blossom: blossom('#ffc1d6', '#fff1a8'), blossom2: blossom('#ffffff', '#ffd23f'),
  petal: (g, s) => inked(g, s, '#ff9fc0', () => { g.moveTo(0, s * .8); g.bezierCurveTo(s * .75, s * .2, s * .5, -s * .8, 0, -s * .7); g.bezierCurveTo(-s * .5, -s * .8, -s * .75, s * .2, 0, s * .8); }),
  bubble: (g, s) => { const gr = g.createRadialGradient(-s * .25, -s * .3, s * .1, 0, 0, s * .9); gr.addColorStop(0, '#ffffffcc'); gr.addColorStop(.55, '#bfe9ff66'); gr.addColorStop(1, '#7fc8eecc'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * .88, 0, 6.3); g.fill();
    g.strokeStyle = '#3f8fd0'; g.lineWidth = s * .08; g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = s * .1; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, s * .62, 3.5, 4.5); g.stroke(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s * .36, s * .4, s * .08, 0, 6.3); g.fill(); },
  bat: (g, s) => { inked(g, s, '#4b3a6b', () => { g.moveTo(0, -s * .3); g.lineTo(s * .16, -s * .56); g.lineTo(s * .24, -s * .26); g.quadraticCurveTo(s * .6, -s * .62, s * .95, -s * .3); g.quadraticCurveTo(s * .8, -s * .1, s * .82, s * .22); g.quadraticCurveTo(s * .62, s * .02, s * .5, s * .26); g.quadraticCurveTo(s * .34, s * .06, s * .2, s * .3);
      g.quadraticCurveTo(0, s * .62, -s * .2, s * .3); g.quadraticCurveTo(-s * .34, s * .06, -s * .5, s * .26); g.quadraticCurveTo(-s * .62, s * .02, -s * .82, s * .22); g.quadraticCurveTo(-s * .8, -s * .1, -s * .95, -s * .3); g.quadraticCurveTo(-s * .6, -s * .62, -s * .24, -s * .26); g.lineTo(-s * .16, -s * .56); g.closePath(); });
    g.fillStyle = '#ffd23f'; for (const x of [-1, 1]) { g.beginPath(); g.arc(x * s * .1, -s * .1, s * .055, 0, 6.3); g.fill(); } },
  pumpkin: (g, s) => { inked(g, s, '#5a8a3a', () => g.rect(-s * .08, -s * .85, s * .18, s * .3)); for (const [x, w, c] of [[-.42, .5, '#e8731f'], [.42, .5, '#e8731f'], [0, .46, '#f79a2e']]) inked(g, s, c, () => g.ellipse(x * s, s * .1, w * s, s * .66, 0, 0, 6.3));
    g.fillStyle = INK; for (const x of [-1, 1]) { g.beginPath(); g.moveTo(x * s * .34, -s * .02); g.lineTo(x * s * .14, -s * .02); g.lineTo(x * s * .24, -s * .24); g.fill(); } g.beginPath(); g.moveTo(-s * .38, s * .24); g.quadraticCurveTo(0, s * .62, s * .38, s * .24); g.quadraticCurveTo(0, s * .4, -s * .38, s * .24); g.fill(); },
  paw: pawPic('#fff4e2', '#ff8fab'), paw2: pawPic('#c98a4a', '#6b4326'), paw3: pawPic('#8a8f98', '#ffd3df'),
};
const glyphSprite = ch => PICS[ch] ? sprite('p' + ch, 64, PICS[ch]) : sprite('g' + ch, 64, (g, s) => { g.font = `${s}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, 2); });
const coinSprite = () => sprite('coin', 30, g => { g.fillStyle = '#ffc93c'; g.strokeStyle = '#b97c12'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 26, 0, 6.283); g.fill(); g.stroke(); });
const dotSprite = () => sprite('dot', 16, g => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 14, 0, 6.283); g.fill(); });
// A picture for the Wardrobe tile of a drawn effect ('' for the emoji ones, which show their emoji).
export const winPic = k => { const n = KINDS[k]?.glyph?.[0]; try { return PICS[n] ? glyphSprite(n).toDataURL() : ''; } catch { return ''; } };
// The same pictures as one strip, for the in-game showers (scenery3d.js createFx): `at` lists each effect's cells, the
// plain strip and the firework spark are white so the shower tints them with `cols`.
export function winSheet(C = 96) {
  const pics = [rectSprite('#ffffff'), dotSprite(), ...KINDS[2].glyph.map(glyphSprite), fishSprite(), coinSprite(), flakeSprite(), ...KINDS[7].glyph.map(glyphSprite), ...['blossom', 'petal', 'blossom2', 'bubble', 'bat', 'pumpkin', 'paw', 'paw2', 'paw3'].map(glyphSprite)], n = 24;
  const cv = document.createElement('canvas'); cv.width = C * n; cv.height = C; const g = cv.getContext('2d');
  pics.forEach((im, i) => g.drawImage(im, C * i + 2, 2, C - 4, C - 4));
  return { cv, n, at: { 1: [0], 4: [1], 2: [2, 3, 4, 5], 3: [6], 5: [7], 6: [8], 7: [9, 10, 11, 12], 8: [13, 14, 15], 9: [16], 10: [17, 17, 18], 11: [19, 20, 21] }, cols: { 1: KINDS[1].cols, 4: KINDS[4].cols } };
}
const rectSprite = c => sprite('r' + c, 16, g => { g.fillStyle = c; g.fillRect(-16, -8, 32, 16); });
export function playWinFx(k, { ms = 4200, banner = '', light = false } = {}) {
  const K = KINDS[k]; if (!K || typeof document === 'undefined') return;
  live?.stop();
  const cv = document.createElement('canvas'); cv.className = 'winfx'; cv.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(1.5, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const x = cv.getContext('2d', { willReadFrequently: false }); x.scale(dpr, dpr); document.body.append(cv); // drawn every frame: stays on the GPU
  let tag = null; if (banner) { tag = document.createElement('div'); tag.className = 'winfxtag'; tag.textContent = banner; document.body.append(tag); }
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, R = Math.random, ps = [];
  const spawn = i => {
    const up = K.from === 'bottom', sz = K.glyph || big(K) ? 22 + R() * 22 : K.draw === 'coin' ? 9 + R() * 6 : 6 + R() * 7;
    return { x: R() * W, y: K.slow ? R() * H * (light ? .8 : 1.1) - H * .25 : up ? H + 30 + R() * H * (light ? .25 : .5) : -30 - R() * H * (light ? .4 : .9), vx: (R() - .5) * (K.slow ? 40 : 120), vy: (up ? -1 : 1) * (K.slow ? 70 + R() * 60 : 260 + R() * 260),
      r: R() * 6.3, vr: (R() - .5) * (K.spin ?? 6), sz, c: K.cols?.[i % K.cols.length], g: K.glyph?.[i % K.glyph.length], ph: R() * 6.3 };
  };
  const small = W * H < 500_000; // phones: fewer particles, the screen is smaller anyway
  for (let i = 0; i < (calm ? K.n / 4 : small ? K.n * .6 : K.n) * (light ? .5 : 1); i++) { const p = spawn(i); p.img = p.g ? glyphSprite(p.g) : K.draw === 'fish' ? fishSprite() : K.draw === 'flake' ? flakeSprite() : K.draw === 'coin' ? coinSprite() : rectSprite(p.c); ps.push(p); }
  const sparks = []; let nextBurst = 0, bursts = light ? Math.min(3, K.bursts || 0) : K.bursts || 0;
  const t0 = performance.now(); let last = t0, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); cv.remove(); tag?.remove(); if (live?.stop === stop) live = null; };
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000), el = now - t0; last = now;
    if (el > ms) return stop();
    const fade = Math.min(1, el / 350, (ms - el) / 600); x.clearRect(0, 0, W, H); x.globalAlpha = fade;
    if (bursts && el >= nextBurst) { // a firework: a ring of sparks from a random spot in the upper half
      bursts--; nextBurst = el + 380 + R() * 260; const cx = W * (.15 + R() * .7), cy = H * (.15 + R() * .35), c = K.cols[bursts % K.cols.length], n = calm ? 14 : 44;
      for (let i = 0; i < n; i++) { const an = i / n * 6.283, sp = 140 + R() * 190; sparks.push({ x: cx, y: cy, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: 1, c }); }
    }
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 190 * dt; s.vx *= .985; s.life -= dt * .75; if (s.life <= 0) continue; x.globalAlpha = Math.max(0, s.life); x.fillStyle = s.c; x.beginPath(); x.arc(s.x, s.y, 3.2, 0, 6.283); x.fill(); }
    x.globalAlpha = fade;
    for (const p of ps) {
      p.x += (p.vx + Math.sin(el / 400 + p.ph) * 40) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y < -60 && p.vy > 0 || p.y > H + 60 && p.vy < 0) continue; // not on screen yet
      const cs = Math.cos(p.r), sn = Math.sin(p.r), k = p.g ? p.sz / 64 : big(K) ? p.sz / 96 : K.draw === 'coin' ? p.sz / 26 : p.sz / 32, fx = K.draw === 'coin' ? Math.abs(Math.cos(p.r * 2)) * .9 + .1 : 1;
      x.setTransform(dpr * cs * k * fx, dpr * sn * k * fx, -dpr * sn * k, dpr * cs * k, dpr * p.x, dpr * p.y);
      x.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    raf = requestAnimationFrame(frame);
  };
  live = { stop, light }; raf = requestAnimationFrame(frame);
}

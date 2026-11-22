// Win effects: a few seconds of particles over the whole screen when the winner has one on (cosmetics.js, kind wn).
// One 2D canvas, no three.js, and it removes itself when done, so it costs nothing the rest of the time.
const KINDS = {
  1: { n: 150, draw: 'rect', cols: ['#ff5d8f', '#ffc93c', '#4fc3e8', '#7ed37a', '#c9b3ff', '#ff8a2a'], from: 'top' },      // confetti
  2: { n: 60, glyph: ['💖', '💗', '❤️', '💕'], from: 'bottom' },                                                           // hearts
  3: { n: 55, glyph: ['🐟', '🐠', '🐡', '🦐'], from: 'top', spin: .5 },                                                    // fish rain
  4: { n: 0, bursts: 7, cols: ['#ff5d8f', '#ffc93c', '#4fc3e8', '#7ed37a', '#ffffff', '#c9b3ff'] },                          // fireworks
  5: { n: 80, draw: 'coin', from: 'top' },                                                                                   // coin shower
  6: { n: 120, glyph: ['❄️', '❄', '✻'], from: 'top', slow: true },                                                          // snowfall
};
let live = null;
// Every particle is drawn from a small picture made once (an emoji, a coin, a confetti strip), because drawing emoji
// text 100+ times a frame is slow enough to drop frames on phones and laptops while the results screen comes in.
const sprites = new Map();
function sprite(key, sz, paint) {
  if (sprites.has(key)) return sprites.get(key);
  const c = document.createElement('canvas'), px = Math.ceil(sz * 2) + 4; c.width = c.height = px;
  const g = c.getContext('2d'); g.translate(px / 2, px / 2); paint(g, sz); sprites.set(key, c); return c;
}
const glyphSprite = ch => sprite('g' + ch, 64, (g, s) => { g.font = `${s}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, 2); });
const coinSprite = () => sprite('coin', 30, g => { g.fillStyle = '#ffc93c'; g.strokeStyle = '#b97c12'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 26, 0, 6.283); g.fill(); g.stroke(); });
const rectSprite = c => sprite('r' + c, 16, g => { g.fillStyle = c; g.fillRect(-16, -8, 32, 16); });
export function playWinFx(k, { ms = 4200, banner = '' } = {}) {
  const K = KINDS[k]; if (!K || typeof document === 'undefined') return;
  live?.stop();
  const cv = document.createElement('canvas'); cv.className = 'winfx'; cv.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(1.5, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const x = cv.getContext('2d'); x.scale(dpr, dpr); document.body.append(cv);
  let tag = null; if (banner) { tag = document.createElement('div'); tag.className = 'winfxtag'; tag.textContent = banner; document.body.append(tag); }
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, R = Math.random, ps = [];
  const spawn = i => {
    const up = K.from === 'bottom', sz = K.glyph ? 22 + R() * 22 : K.draw === 'coin' ? 9 + R() * 6 : 6 + R() * 7;
    return { x: R() * W, y: up ? H + 30 + R() * H * .5 : -30 - R() * H * .9, vx: (R() - .5) * (K.slow ? 40 : 120), vy: (up ? -1 : 1) * (K.slow ? 70 + R() * 60 : 260 + R() * 260),
      r: R() * 6.3, vr: (R() - .5) * (K.spin ?? 6), sz, c: K.cols?.[i % K.cols.length], g: K.glyph?.[i % K.glyph.length], ph: R() * 6.3 };
  };
  const small = W * H < 500_000; // phones: fewer particles, the screen is smaller anyway
  for (let i = 0; i < (calm ? K.n / 4 : small ? K.n * .6 : K.n); i++) { const p = spawn(i); p.img = p.g ? glyphSprite(p.g) : K.draw === 'coin' ? coinSprite() : rectSprite(p.c); ps.push(p); }
  const sparks = []; let nextBurst = 0, bursts = K.bursts || 0;
  const t0 = performance.now(); let last = t0, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); cv.remove(); tag?.remove(); if (live?.stop === stop) live = null; };
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000), el = now - t0; last = now;
    if (el > ms) return stop();
    x.clearRect(0, 0, W, H); x.globalAlpha = Math.min(1, (ms - el) / 600);
    if (bursts && el >= nextBurst) { // a firework: a ring of sparks from a random spot in the upper half
      bursts--; nextBurst = el + 380 + R() * 260; const cx = W * (.15 + R() * .7), cy = H * (.15 + R() * .35), c = K.cols[bursts % K.cols.length], n = calm ? 14 : 44;
      for (let i = 0; i < n; i++) { const an = i / n * 6.283, sp = 140 + R() * 190; sparks.push({ x: cx, y: cy, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: 1, c }); }
    }
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 190 * dt; s.vx *= .985; s.life -= dt * .75; if (s.life <= 0) continue; x.globalAlpha = Math.max(0, s.life); x.fillStyle = s.c; x.beginPath(); x.arc(s.x, s.y, 3.2, 0, 6.283); x.fill(); }
    x.globalAlpha = Math.min(1, (ms - el) / 600);
    for (const p of ps) {
      p.x += (p.vx + Math.sin(el / 400 + p.ph) * 40) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y < -60 && p.vy > 0 || p.y > H + 60 && p.vy < 0) continue; // not on screen yet
      const cs = Math.cos(p.r), sn = Math.sin(p.r), k = p.g ? p.sz / 64 : K.draw === 'coin' ? p.sz / 26 : p.sz / 32, fx = K.draw === 'coin' ? Math.abs(Math.cos(p.r * 2)) * .9 + .1 : 1;
      x.setTransform(dpr * cs * k * fx, dpr * sn * k * fx, -dpr * sn * k, dpr * cs * k, dpr * p.x, dpr * p.y);
      x.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    raf = requestAnimationFrame(frame);
  };
  live = { stop }; raf = requestAnimationFrame(frame);
}

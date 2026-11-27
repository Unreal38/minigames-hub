// Tiny synthesized sound kit (WebAudio, no files). Starts on the first user gesture.
let ctx = null, master = null;
let muted = (() => { try { return localStorage.getItem('ct_mute') === '1'; } catch { return false; } })();

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
addEventListener('pointerdown', () => ac(), { once: true });
export const audioCtx = () => ac();                       // music.js plays through the same context
const muteSubs = new Set();
export const onMute = fn => { muteSubs.add(fn); };          // told when the sound button is pressed

function tone(freq, dur = .12, type = 'sine', vol = .3, slide = 0, delay = 0) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
}
function noise(dur = .2, vol = .2, from = 2000, to = 400, delay = 0, q = 1) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + delay, len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t);
}

export const sfx = {
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('ct_mute', muted ? '1' : '0'); } catch {} if (!muted) this.click(); muteSubs.forEach(f => f(muted)); return muted; },
  tick() { tone(1800, .03, 'sine', .06); },
  hover() { tone(1250 + Math.random() * 200, .045, 'sine', .07); },
  click() { tone(660, .07, 'triangle', .22, 1.6); },
  pop() { tone(420 + Math.random() * 160, .09, 'sine', .3, 2.4); },
  land() { tone(230 + Math.random() * 90, .05, 'sine', .09, .6); },
  combo(n) { const f = 523 * 2 ** (Math.min(n, 10) * 2 / 12); tone(f, .1, 'triangle', .2); tone(f * 1.5, .16, 'triangle', .16, 1, .06); },
  boom() { noise(.28, .3, 500, 120, 0, 1.2); tone(110, .22, 'sine', .3, .5); },
  draw() { noise(.16, .16, 3200, 900, 0, .8); tone(880, .06, 'triangle', .1, 1.3, .06); },
  place() { noise(.07, .25, 900, 300, 0, 2); tone(220, .09, 'sine', .25, .6); },
  plop() { tone(300, .14, 'sine', .35, 3); tone(520, .08, 'sine', .15, 2, .05); },
  set() { [784, 988, 1175].forEach((f, i) => tone(f, .16, 'triangle', .18, 1, i * .07)); },
  turn() { tone(523, .14, 'sine', .22, 1, 0); tone(784, .22, 'sine', .22, 1, .1); },
  warn() { tone(1040, .07, 'square', .06); },
  bad() { tone(200, .16, 'sawtooth', .08, .7); },
  join() { tone(660, .1, 'sine', .2, 1.5); tone(990, .12, 'sine', .15, 1.2, .08); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .24, 'triangle', .2, 1, i * .11)); noise(.6, .08, 6000, 2000, .3, .5); },
  whoosh() { noise(.2, .14, 900, 3600, 0, .8); },
  thunk() { noise(.06, .4, 800, 220, 0, 2.2); tone(150, .09, 'sine', .32, .55); },
  lose() { [523, 466, 415].forEach((f, i) => tone(f, .26, 'triangle', .16, 1, i * .14)); },
};

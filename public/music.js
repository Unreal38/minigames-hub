// Friendship Trail music: "Music Box Meadow", a gentle waltz on bells (Kuba's pick, 2026-11-27). Our own tune, made
// from notes in the browser like sfx.js: no audio files. Cheap by design: a timer every 100 ms schedules the tones
// of the next third of a second, and nothing runs per frame. The site's sound button mutes it too (sfx.muted), the
// music button turns only the tune off (ct_music), and it pauses while the tab is hidden. After dark (the real sky,
// never the light/dark switch) the same tune plays slower and softer.
import { sfx, audioCtx, onMute } from './sfx.js';
import { skyPhase } from './weather.js';
import { skyHour } from './seasonpeek.js';

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = s => PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0);
const midi = n => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 12 * (+m[2] + 1) + pcOf(m[1]); };
const hz = m => 440 * 2 ** ((m - 69) / 12);
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10] };
const chord = s => { const m = /^([A-G][#b]?)(m|7)?$/.exec(s); return { pc: pcOf(m[1]), iv: QUAL[m[2] || ''] }; };
const voiced = (c, low) => c.iv.map(i => low + ((c.pc + i - low) % 12 + 12) % 12);
const rootAt = (c, low) => low + ((c.pc - low) % 12 + 12) % 12;
const chords = s => s.trim().split(/\s+/).map(chord);

// ----- the tune: G major, 3 beats to the bar. "note/beats", _ is a rest, | only marks the bars for the reader -----
const BEATS = 3, BPM = 132;
const CH_A = 'G Em C D G Em Am D', CH_A2 = 'G Bm C D Em C D G', CH_B = 'C D G Em C D G G Am D Bm Em C D D D7';
const M_A = 'B4/1 D5/1 G5/1 | F#5/2 E5/1 | E5/1 G5/1 C6/1 | B5/2 A5/1 | G5/1 B5/1 D6/1 | B5/2 G5/1 | A5/1 G5/1 E5/1 | D5/2 F#5/1';
const M_A2 = 'D5/1 G5/1 B5/1 | A5/2 F#5/1 | G5/1 E5/1 C5/1 | D5/1 F#5/1 A5/1 | B5/2 G5/1 | E5/1 G5/1 C6/1 | B5/1 A5/1 F#5/1 | G5/3';
const M_B = `E5/1 G5/1 E5/1 | F#5/2 A5/1 | G5/1.5 A5/.5 B5/1 | B5/2 G5/1 | C6/1 B5/1 A5/1 | A5/2 F#5/1 | G5/1 D5/1 B4/1 | D5/3 |
  C5/1 E5/1 A5/1 | A5/1 F#5/1 D5/1 | D5/1 F#5/1 B5/1 | B5/2 G5/1 | E5/1 G5/1 C6/1 | D6/2 C6/1 | B5/1 A5/1 F#5/1 | A5/2 D5/1`;

function lead(str, at = 0, v = 1) {
  const ev = []; let t = at;
  for (const tok of str.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [n, d] = tok.split('/');
    if (n !== '_') ev.push({ t, d: +d, m: midi(n), i: 'bell', L: 'lead', v });
    t += +d;
  }
  return ev;
}
// the accompaniment under a run of bars: bass on one, then either the "pah-pah" chords or a rolling harp figure
function bed(bars, at = 0, { harp = false, shake = true } = {}) {
  const ev = [];
  bars.forEach((c, bi) => {
    const t0 = at + bi * BEATS, v = voiced(c, 62);
    ev.push({ t: t0, d: 2.6, m: rootAt(c, 40), i: 'bass', L: 'bass' });
    if (harp) { const r = rootAt(c, 55), h = [r, r + c.iv[1], r + 7, r + 12, r + 7, r + c.iv[1]]; h.forEach((m, k) => ev.push({ t: t0 + k / 2, d: .5, m, i: 'harp', L: 'comp', v: k ? .8 : 1 })); }
    else for (const k of [1, 2]) v.forEach(m => ev.push({ t: t0 + k, d: .8, m, i: 'harp', L: 'comp', v: .75 }));
    v.forEach(m => ev.push({ t: t0, d: 3, m: m + 12, i: 'pad', L: 'pad' }));
    if (shake) ev.push({ t: t0 + 1, i: 'shake', L: 'drum' }, { t: t0 + 2, i: 'shake', L: 'drum' });
    if (bi % 4 === 0) ev.push({ t: t0, d: 1, m: rootAt(c, 84), i: 'bell', L: 'comp', v: .3 });
  });
  return ev;
}
const sparkle = l => l.map(e => ({ ...e, m: e.m + 12, v: .4 })); // the melody again an octave up, quietly

// Each cue: { ev, len (beats), bpm, loop }
export const CUES = {
  // Tux is talking: the bed alone, with the first note of each bar of the tune as a far-off hint
  intro() {
    const ev = [...bed(chords(CH_A + ' ' + CH_A2), 0, { shake: false }), ...lead(M_A + ' ' + M_A2, 0, .32).filter(e => e.t % BEATS === 0)];
    return { ev, len: 16 * BEATS, bpm: BPM * .94, loop: true };
  },
  // on the trail: A, A', a 16-bar middle over a harp, then A' again with a sparkle on top (40 bars, about 55 s)
  trail() {
    const last = lead(M_A2, 32 * BEATS);
    const ev = [...bed(chords(CH_A + ' ' + CH_A2)), ...bed(chords(CH_B), 16 * BEATS, { harp: true }), ...bed(chords(CH_A2), 32 * BEATS),
      ...lead(M_A + ' ' + M_A2), ...lead(M_B, 16 * BEATS), ...last, ...sparkle(last)];
    return { ev, len: 40 * BEATS, bpm: BPM, loop: true };
  },
  // the minigame wheel: the dominant chord climbing in quick bells, louder each bar
  wheel() {
    const V = chord('D7'), tones = [...voiced(V, 62), ...voiced(V, 74)], ev = [];
    for (let bar = 0; bar < 4; bar++) for (let k = 0; k < 6; k++) {
      const t = bar * BEATS + k / 2, v = .5 + .16 * bar;
      ev.push({ t, d: .5, m: tones[(k + bar) % tones.length], i: 'bell', L: 'comp', v }, { t, i: 'hat', L: 'drum', v });
      if (k % 2 === 0) ev.push({ t, d: .5, m: rootAt(V, 40), i: 'bass', L: 'bass', v });
    }
    return { ev, len: 4 * BEATS, bpm: BPM * 1.3, loop: true };
  },
  // the wheel has landed: a run up the home chord and three bright hits, then silence for the minigame
  sting() {
    const I = chord('G'), ev = [];
    [...voiced(I, 67), rootAt(I, 79)].forEach((m, k) => ev.push({ t: k / 2, d: .5, m, i: 'bell', L: 'lead' }));
    [[2, chord('C'), 1], [3, chord('D'), 1], [4, I, 3]].forEach(([t, c, d]) => {
      voiced(c, 60).forEach(m => ev.push({ t, d, m, i: 'harp', L: 'comp', v: 1.3 }, { t, d, m: m + 12, i: 'bell', L: 'comp', v: .5 }));
      ev.push({ t, d, m: rootAt(c, 40), i: 'bass', L: 'bass' }, { t, i: 'shake', L: 'drum', v: 1.6 });
    });
    ev.push({ t: 4, d: 3, m: rootAt(I, 79), i: 'bell', L: 'lead' });
    return { ev, len: 8, bpm: BPM, loop: false };
  },
  // the Pet Show: a waiting figure on the harp, no tune yet
  show() {
    const bars = chords('C D Em Em C D G G'), ev = bed(bars, 0, { harp: true });
    bars.forEach((c, bi) => { if (bi % 2 === 0) ev.push({ t: bi * BEATS, d: 2, m: rootAt(c, 79), i: 'bell', L: 'lead', v: .6 }); });
    return { ev, len: 8 * BEATS, bpm: BPM * 1.06, loop: true };
  },
  // the podium: the trail tune as a victory lap, quicker, with the sparkle and a soft beat
  podium() {
    const l = lead(M_A + ' ' + M_A2), ev = [...bed(chords(CH_A + ' ' + CH_A2)), ...l, ...sparkle(l)];
    for (let b = 0; b < 16; b++) { ev.push({ t: b * BEATS, i: 'kick', L: 'drum' }); for (let k = 1; k < 6; k++) ev.push({ t: b * BEATS + k / 2, i: 'hat', L: 'drum', v: k % 2 ? .45 : .8 }); }
    return { ev, len: 16 * BEATS, bpm: BPM * 1.14, loop: true };
  },
};

// ----- playing -----
const LEVEL = .3; // well under the sound effects: friends are talking over it
let off = (() => { try { return localStorage.getItem('ct_music') === '0'; } catch { return false; } })();
let want = null, cur = null, timer = 0, noiseBuf = null;
const nightNow = () => { try { return skyPhase(skyHour()).n >= .5; } catch { return false; } };

function tone(type, f, t, v, dest, { a = .004, hold = 0, dec = .3, det = 0 } = {}) {
  const c = cur.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
  if (hold) g.gain.setValueAtTime(v, t + a + hold);
  g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + dec);
  o.connect(g).connect(dest); o.start(t); o.stop(t + a + hold + dec + .03);
}
function hit(t, dec, v, kind, freq, dest) {
  const c = cur.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = kind; f.frequency.value = freq; f.Q.value = .9;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
  s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * .5, dec + .02);
}
function fire(e, t, spb) {
  const { wet, dry, night } = cur, v = e.v ?? 1, d = (e.d || 0) * spb, f = e.m ? hz(e.m) : 0;
  switch (e.i) {
    case 'bell': tone('sine', f, t, .17 * v, wet, { dec: 1.3 }); tone('sine', f * 4, t, .03 * v, wet, { dec: .2 }); break;
    case 'harp': tone('triangle', f, t, .085 * v, wet, { dec: Math.max(.22, d * .9) }); break;
    case 'bass': tone('triangle', f, t, .26 * v, dry, { a: .008, hold: d * .8, dec: .09 }); break;
    case 'pad': tone('triangle', f, t, .03 * v, wet, { a: .3, hold: Math.max(0, d - .3), dec: .5, det: 6 }); tone('triangle', f, t, .03 * v, wet, { a: .3, hold: Math.max(0, d - .3), dec: .5, det: -6 }); break;
    case 'kick': { const c = cur.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
      g.gain.setValueAtTime(.3 * v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18); o.connect(g).connect(dry); o.start(t); o.stop(t + .2); break; }
    case 'hat': if (!night) hit(t, .045, .06 * v, 'highpass', 7500, dry); break;
    case 'shake': if (!night) hit(t, .06, .035 * v, 'bandpass', 5200, dry); break;
  }
}
function halt() {
  clearInterval(timer); timer = 0;
  if (!cur) return;
  const { bus, nodes, ctx } = cur; cur = null;
  bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setTargetAtTime(0, ctx.currentTime, .12);
  setTimeout(() => nodes.forEach(n => n.disconnect()), 900);
}
function start(name) {
  halt();
  const ctx = audioCtx(); if (!ctx) return;
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const night = nightNow(), seq = CUES[name]();
  seq.ev.sort((a, b) => a.t - b.t); if (night) seq.bpm *= .92;
  // bus -> soft lowpass (closed further at night) -> out; "wet" also feeds one echo that makes the bells ring on
  const bus = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), send = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = night ? 1700 : 9000; dl.delayTime.value = 60 / seq.bpm * .75; fb.gain.value = .3; send.gain.value = .2;
  bus.gain.setValueAtTime(0, ctx.currentTime); bus.gain.linearRampToValueAtTime(LEVEL * (night ? .85 : 1), ctx.currentTime + .35);
  bus.connect(lp).connect(ctx.destination); wet.connect(bus); wet.connect(send).connect(dl); dl.connect(fb).connect(dl); dl.connect(bus);
  cur = { name, seq, ctx, night, idx: 0, t0: ctx.currentTime + .1, bus, dry: bus, wet, nodes: [bus, lp, wet, dl, fb, send] };
  tick(); timer = setInterval(tick, 100);
}
function tick() {
  const c = cur; if (!c) return;
  if (c.ctx.state !== 'running') { c.ctx.resume?.(); c.t0 = Math.max(c.t0, c.ctx.currentTime + .1); if (c.ctx.state !== 'running') return; }
  const spb = 60 / c.seq.bpm, horizon = c.ctx.currentTime + .35;
  for (let guard = 0; guard < 300; guard++) {
    const e = c.seq.ev[c.idx];
    if (!e) {
      if (!c.seq.loop) { if (c.ctx.currentTime > c.t0 + c.seq.len * spb) { want = null; halt(); } return; }
      if (nightNow() !== c.night) { const at = c.t0 + c.seq.len * spb; if (c.ctx.currentTime >= at - .4) start(c.name); return; } // dusk or dawn came: the next lap is the other version
      c.idx = 0; c.t0 += c.seq.len * spb; continue;
    }
    const t = c.t0 + e.t * spb; if (t > horizon) return;
    if (t >= c.ctx.currentTime - .05) fire(e, Math.max(t, c.ctx.currentTime), spb); // after a stalled timer: skip what is already past
    c.idx++;
  }
}
const silent = () => off || sfx.muted || (typeof document !== 'undefined' && document.hidden);
function refresh() { if (!want || silent()) halt(); else if (cur?.name !== want) start(want); }
onMute(refresh);
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refresh);

export const music = {
  get on() { return !off; },
  get playing() { return cur?.name || null; },
  cue(name) { if (!CUES[name]) return; want = name; refresh(); },      // a looping cue; the same one again changes nothing
  sting() { want = 'sting'; if (silent()) { want = null; halt(); } else start('sting'); }, // plays once, then silence
  stop() { want = null; halt(); },
  toggle() { off = !off; try { localStorage.setItem('ct_music', off ? '0' : '1'); } catch {} refresh(); return !off; },
};

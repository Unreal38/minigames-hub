// Friendship Trail music (public/music.js): the tune's bars add up, every cue builds into playable notes, and the
// trail view starts and stops it. A static check: nothing here makes a sound.
import fs from 'node:fs';
import path from 'node:path';

const fail = m => { console.error('FAIL', m); process.exit(1); };
globalThis.addEventListener ||= () => {}; globalThis.window ||= {}; // sfx.js listens for the first tap and looks for an AudioContext
const { CUES, music } = await import('../public/music.js');

const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'music.js'), 'utf8');
for (const m of src.matchAll(/const (M_\w+) = [`']([^`']+)[`']/g)) {
  m[2].split('|').forEach((bar, i) => {
    const sum = bar.trim().split(/\s+/).reduce((a, t) => a + +t.split('/')[1], 0);
    if (Math.abs(sum - 3) > 1e-9) fail(`${m[1]} bar ${i + 1} has ${sum} beats, not 3`);
  });
}
for (const [name, make] of Object.entries(CUES)) {
  const q = make();
  if (!q.ev.length || !(q.len > 0) || !(q.bpm > 60 && q.bpm < 220)) fail(`cue ${name} is empty or has a bad tempo`);
  for (const e of q.ev) {
    if (!(e.t >= 0 && e.t < q.len)) fail(`cue ${name}: a note starts at beat ${e.t}, outside 0..${q.len}`);
    if (e.m !== undefined && !(e.m >= 36 && e.m <= 98)) fail(`cue ${name}: note ${e.m} is out of range`);
    if (!['bell', 'harp', 'bass', 'pad', 'kick', 'hat', 'shake'].includes(e.i)) fail(`cue ${name}: unknown instrument ${e.i}`);
  }
  const secs = q.len * 60 / q.bpm;
  if (q.loop && name === 'trail' && secs < 45) fail(`the trail loop is only ${secs.toFixed(0)} s: it would repeat too soon`);
  if (!q.loop && secs > 5) fail(`the flourish ${name} runs ${secs.toFixed(1)} s: it must be over before the curtain card is read`);
}
for (const k of ['intro', 'trail', 'wheel', 'sting', 'show', 'podium']) if (!CUES[k]) fail(`cue ${k} is missing`);
music.cue('trail'); music.stop(); // no audio here: must not throw
if (music.playing) fail('music.stop() left a cue playing');

const client = fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'games', 'trail', 'client.js'), 'utf8');
if (!/destroy\(\) \{\s*destroyed = true; music\.stop\(\)/.test(client)) fail('the trail view must stop the music when it closes (the minigame starts in quiet)');
if (!/data-a="music"/.test(client) || !/L\('Toggle music', '[^']+'\)/.test(client)) fail('the trail top bar needs the music button, in both languages');
console.log('music ok');

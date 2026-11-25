// Kart Island Race: other players' karts move smoothly. A simulated race on a fake clock: one browser drives and
// reports ten times a second (with its own frame timing), the server runs its 20-a-second stream with a wobbly timer,
// and a second browser draws that kart through smooth.js, over networks from quick to very bumpy. Each drawn frame's
// step is compared with the steps around it: a kart that stops, jumps ahead or crawls shows up as a stutter.
// `node test/kartsmooth.js --old` also prints how the old drawing (newest-arrival times, fixed delay) did.
import * as kart from '../server/games/kart.js';
import { buildTrack, stepKart, autoDrive, angDiff } from '../public/games/kart/track.js';
import { createSmoother } from '../public/games/kart/smooth.js';

const fail = m => { console.error('FAIL', m); process.exit(1); };
const showOld = process.argv.includes('--old');
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// the old drawing, for comparison: arrival time stamps, a fixed 110 ms delay, straight lines between updates
function oldSmoother() {
  const snaps = [], out = [];
  return {
    push(S, at) { snaps.push({ at, k: S.k }); while (snaps.length > 2 && at - snaps[1].at > 510) snaps.shift(); },
    at(now) {
      const t = now - 110; let a = null, b = null;
      for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].at <= t) { a = snaps[i]; b = snaps[i + 1] || null; break; }
      if (!a) { a = snaps[0]; b = null; } if (!a) return out;
      const u = b ? Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at || 1))) : 0;
      for (let i = 0; i < a.k.length; i++) { const p = a.k[i], q = b?.k[i] || p; out[i] = { x: p[0] + (q[0] - p[0]) * u, z: p[1] + (q[1] - p[1]) * u, h: p[3] + angDiff(q[3], p[3]) * u }; }
      return out;
    },
    delay: 110,
  };
}

function race({ up, upJ, down, downJ, stall = 0, hz = 60, sendHz = 60 }, makeSm) {
  let now = 1_000_000; const realNow = Date.now; Date.now = () => now;
  try {
    const G = kart.create([{ id: 'a', name: 'Ana', color: '#ff8fab', av: [0, 0, 0, 0] }, { id: 'b', name: 'Bo', color: '#7ed3b2', av: [1, 1, 1, 1] }], { seats: 4, laps: 3, track: 'meadow', items: 'off', bots: 'sharp' });
    const T = buildTrack(G.trackId), me = { ...G.karts[0] };
    const offA = 51_234.5, offB = -9_876.25; // each browser's own clock
    const sm = makeSm(), drawn = { 0: [], 2: [] }, truth = [];
    const ups = [], downs = []; let upLast = 0, downLast = 0;
    let sendF = now, sentAt = -1e9, tick = now, recvF = now, end = G.goAt + 25_000;
    const dly = (b, j) => b + (rnd() < stall ? 250 + rnd() * 250 : rnd() * j); // in order, like TCP: nothing overtakes
    while (now < end) {
      // the next thing to happen
      const nx = Math.min(sendF, tick, recvF, ups[0]?.at ?? Infinity, downs[0]?.at ?? Infinity);
      now = nx;
      if (ups[0]?.at === now) { const m = ups.shift().m; if (G.ph === 'play') kart.act(G, 0, m); continue; }
      if (downs[0]?.at === now) { sm.push(downs.shift().S, now + offB); continue; }
      if (sendF === now) { // the driving browser's frame
        const dt = 1 / sendHz;
        if (G.stage === 'race') { const t = (now - G.goAt) / 1000; stepKart(T, me, autoDrive(T, me, { lane: -1, t }), dt, 1, t); }
        const pn = now + offA;
        if (G.stage === 'race' && pn - sentAt > 95) {
          sentAt = pn;
          const at = Math.max(upLast, now + dly(up, upJ)); upLast = at;
          ups.push({ at, m: { t: 'p', x: +me.x.toFixed(2), z: +me.z.toFixed(2), h: +me.h.toFixed(3), v: +me.v.toFixed(2), f: 0, c: Math.round(pn) } });
        }
        sendF += 1000 / sendHz + (rnd() - .5) * 4; continue;
      }
      if (tick === now) { // the server's 20-a-second stream (setInterval wobbles)
        kart.fast(G, now);
        if (now > G.goAt + 4000) { const k = G.karts[2]; truth.push({ t: now, x: k.x, z: k.z }); }
        { const S = JSON.parse(JSON.stringify(kart.view(G, 1))); const at = Math.max(downLast, now + dly(down, downJ)); downLast = at; downs.push({ at, S }); }
        tick += 50 + (rnd() - .3) * 6; continue;
      }
      if (recvF === now) { // the watching browser's frame
        const ln = now + offB, o = sm.at(ln);
        if (now > G.goAt + 4000) for (const i of [0, 2]) if (o[i]) drawn[i].push({ t: ln, x: o[i].x, z: o[i].z });
        recvF += 1000 / hz + (rnd() - .5) * 2; continue;
      }
    }
    return { drawn, truth, delay: sm.delay };
  } finally { Date.now = realNow; }
}

// how bumpy a drawn path is: each frame's speed against the average speed of the half second around it
function bumpy(path, win = 15) {
  const sp = [];
  for (let i = 1; i < path.length; i++) sp.push(Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z) / ((path[i].t - path[i - 1].t) / 1000));
  let bad = 0, worst = 0;
  for (let i = win; i < sp.length - win; i++) {
    let s = 0; for (let j = i - win; j <= i + win; j++) s += sp[j]; s /= win * 2 + 1;
    if (s < 5) continue;
    const e = Math.abs(sp[i] - s) / s; worst = Math.max(worst, e); if (e > .25) bad++;
  }
  return { bad: bad / Math.max(1, sp.length - win * 2), worst };
}

const NETS = [
  { name: 'same room', up: 3, upJ: 2, down: 3, downJ: 2 },
  { name: 'normal', up: 35, upJ: 25, down: 35, downJ: 25 },
  { name: 'bumpy wifi', up: 60, upJ: 90, down: 60, downJ: 90 },
  { name: 'stalls', up: 40, upJ: 30, down: 40, downJ: 30, stall: .02 },
  { name: '144 Hz screens', up: 30, upJ: 20, down: 30, downJ: 20, hz: 144, sendHz: 144 },
  { name: '30 fps sender', up: 30, upJ: 20, down: 30, downJ: 20, sendHz: 30 },
];
for (const n of NETS) {
  // a bot really does slow down when it bumps into a kart or a wall: its own path on the server says how often
  const r = race(n, createSmoother), p = bumpy(r.drawn[0]), b = bumpy(r.drawn[2]), real = bumpy(r.truth, 5).bad;
  let line = `${n.name.padEnd(15)} person: ${(p.bad * 100).toFixed(1).padStart(4)}% bumpy frames (worst ${(p.worst * 100).toFixed(0)}%), bot: ${(b.bad * 100).toFixed(1)}% (its real path ${(real * 100).toFixed(1)}%), delay ${r.delay.toFixed(0)} ms`;
  if (showOld) { const o = race(n, oldSmoother), op = bumpy(o.drawn[0]), ob = bumpy(o.drawn[2]); line += `   | old: person ${(op.bad * 100).toFixed(1)}%, bot ${(ob.bad * 100).toFixed(1)}%`; }
  console.log(line);
  const limit = n.stall ? .03 : .01;
  if (p.bad > limit) fail(`${n.name}: the other person's kart stutters (${(p.bad * 100).toFixed(1)}% of frames)`);
  if (b.bad > limit + real * 4) fail(`${n.name}: a bot kart stutters (${(b.bad * 100).toFixed(1)}% of frames)`);
  if (r.delay > (n.stall ? 400 : n.upJ > 50 ? 360 : 220)) fail(`${n.name}: other karts are drawn too far back (${r.delay.toFixed(0)} ms)`);
}
console.log('kart smoothing OK');

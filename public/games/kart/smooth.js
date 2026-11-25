// Smooth motion for the other karts. Every kart in the server's stream carries the time its place was really taken
// (k[6], in race ms on the server's clock): when the driver's browser sent it, or the server tick a bot drove in. Each
// kart keeps its own short list of those samples, and the view draws them a little in the past on that same clock,
// gliding along a curve that follows each sample's speed and heading. So it doesn't matter when an update happens to
// arrive (frame timing, the 20-a-second server tick, network jitter): the kart moves at the speed it really drove.
// No three.js here, so test/kartsmooth.js can run it in Node.

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEEP = 1500;      // ms of samples kept per kart
const MIN_DELAY = 70, MAX_DELAY = 400;
const EXTRA = 600;      // ms a kart may be carried on past its newest sample before it waits
const JUMP = 12;        // m between samples that means a respawn: jump, don't glide

export function createSmoother() {
  let off = null, offAt = 0;   // local ms minus server race ms, from the quickest update seen (slowly let go for drift)
  let offS = null;             // the same, eased: a quicker update moves the clock a few percent at a time, never in a jump
  let late = 60, lateAt = 0, delay = 140, lastNow = 0, lastT = null, gid = null;
  const tmp = {}, then = {};
  const bufs = [], out = [], err = [];

  function reset() { off = null; offS = null; lastT = null; bufs.length = 0; out.length = 0; err.length = 0; late = 60; delay = 140; }

  // S: a server update, at: local ms it arrived
  function push(S, at) {
    if (S.gid !== gid) { gid = S.gid; reset(); }
    if (!Number.isFinite(S.t)) return;
    const o = at - S.t;
    if (off === null || o < off || Math.abs(o - off) > 3000) off = o;
    else off = Math.min(o, off + (at - offAt) * .0005); // let go slowly, so a clock drifting the other way is followed
    offAt = at;
    const srvNow = at - off;
    let worst = -Infinity;
    for (let i = 0; i < (S.k?.length || 0); i++) {
      if (!S.k[i]) continue;
      const b = bufs[i] ||= [];
      for (const p of [...(S.kt?.[i] || []), S.k[i]]) {
        const ts = Number.isFinite(p[6]) ? p[6] : S.t; // an old server without times: when it was sent
        const last = b[b.length - 1], smp = { t: ts, x: p[0], z: p[1], y: p[2], h: p[3], v: p[4], f: p[5] };
        if (last && ts <= last.t) { // the same sample again, or an earlier one sent twice: slot it in once
          if (ts > b[0].t && !b.some(q => q.t === ts)) { b.push(smp); b.sort((x, y) => x.t - y.t); }
          continue;
        }
        b.push(smp);
        // how long after it was taken this sample reached us; the draw delay follows the worst of the recent ones
        if (last && S.stage === 'race') worst = Math.max(worst, srvNow - ts + Math.min(250, ts - last.t));
      }
      while (b.length > 3 && b[1].t < b[b.length - 1].t - KEEP) b.shift();
    }
    // the draw delay follows the slowest recent sample at once, and lets go of it over several seconds
    if (worst > -Infinity) { late = worst > late ? worst : late + (worst - late) * Math.min(1, (at - lateAt) / 6000); lateAt = at; }
  }

  function pose(b, t, o) {
    let j = b.length - 1;
    while (j > 0 && b[j - 1].t > t) j--;
    // b[j] is the first sample after t (or the newest)
    if (t >= b[b.length - 1].t) { // past the newest sample: carry on along the same curve for a moment
      const a = b[b.length - 1], p = b[b.length - 2], dt = Math.min(t - a.t, EXTRA) / 1000;
      const turn = p && a.t - p.t < 300 && !(a.f & 1) ? clamp(angDiff(a.h, p.h) / ((a.t - p.t) / 1000), -3, 3) : 0;
      const v = a.f & 1 ? 0 : a.v, n = Math.max(1, Math.ceil(dt / .05));
      let x = a.x, z = a.z, h = a.h;
      for (let q = 0; q < n; q++) { const st = dt / n; h += turn * st * .5; x += Math.sin(h) * v * st; z += Math.cos(h) * v * st; h += turn * st * .5; }
      o.x = x; o.z = z; o.y = a.y; o.h = h; o.v = v; o.f = a.f;
      return 1;
    }
    if (j === 0) { const a = b[0]; Object.assign(o, { x: a.x, z: a.z, y: a.y, h: a.h, v: a.v, f: a.f }); return 0; }
    const a = b[j - 1], c = b[j];
    let t0 = a.t; const span = c.t - a.t;
    if (span > 300 && Math.abs(a.v) < 1) t0 = c.t - 100; // standing for a long while (the countdown): stay put, then move off
    const u = clamp((t - t0) / (c.t - t0), 0, 1);
    o.f = (u < .5 ? a : c).f;
    if (Math.hypot(c.x - a.x, c.z - a.z) > JUMP || (a.f & 1) || (c.f & 1)) { // respawn or falling: no curve
      const w = Math.hypot(c.x - a.x, c.z - a.z) > JUMP ? (u > .5 ? 1 : 0) : u;
      o.x = a.x + (c.x - a.x) * w; o.z = a.z + (c.z - a.z) * w; o.y = a.y + (c.y - a.y) * w; o.h = a.h + angDiff(c.h, a.h) * w; o.v = a.v + (c.v - a.v) * w;
      return 0;
    }
    // cubic Hermite: positions at both ends, speed along the heading as the slope (a kart drives where it points)
    const d = (c.t - t0) / 1000, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const chord = Math.hypot(c.x - a.x, c.z - a.z);
    // a bump or a wall can change the speed suddenly; never let the slope be far longer than the gap it spans
    const sa = clamp(a.v * d, -chord * 1.5, chord * 1.5), sc = clamp(c.v * d, -chord * 1.5, chord * 1.5);
    o.x = h00 * a.x + h10 * sa * Math.sin(a.h) + h01 * c.x + h11 * sc * Math.sin(c.h);
    o.z = h00 * a.z + h10 * sa * Math.cos(a.h) + h01 * c.z + h11 * sc * Math.cos(c.h);
    o.y = a.y + (c.y - a.y) * u; o.h = a.h + angDiff(c.h, a.h) * u; o.v = a.v + (c.v - a.v) * u;
    return 0;
  }

  // where every kart should be drawn at local time now (ms); returns the list (null for a kart with no samples yet)
  function at(now) {
    if (off === null) return out;
    const dt = lastNow ? clamp(now - lastNow, 0, 250) : 16; lastNow = now;
    // the draw delay: the slowest recent sample plus a little; changed gently so the karts never visibly speed up or stop
    const want = clamp(late + 15, MIN_DELAY, MAX_DELAY);
    // at most a few percent faster or slower than real time, so nobody's kart visibly speeds up or brakes
    delay += clamp((want - delay) * Math.min(1, dt / 300), -dt * .04, dt * .08);
    if (offS === null || Math.abs(offS - off) > 1000) offS = off;
    else offS += clamp(off - offS, -dt * .04, dt * .04);
    const t = now - offS - delay, tPrev = lastT ?? t; lastT = t;
    for (let i = 0; i < bufs.length; i++) {
      const b = bufs[i]; if (!b?.length) { out[i] = null; continue; }
      const o = out[i] ||= {}, raw = { x: o.rx, z: o.rz };
      o.mode = pose(b, t, tmp);
      // new samples can change where the kart was meant to be (most of all after carrying it on through a hiccup):
      // where the new samples put it last frame, against where it was drawn then, is a gap to hide, fading out quickly
      const e = err[i] ||= { x: 0, z: 0 };
      if (Number.isFinite(raw.x)) {
        pose(b, tPrev, then);
        const gx = raw.x - then.x, gz = raw.z - then.z;
        if (Math.hypot(gx, gz) < 20) { e.x += gx; e.z += gz; } else { e.x = e.z = 0; } // farther: a respawn, just jump
      }
      const fade = Math.exp(-dt / 160); e.x *= fade; e.z *= fade;
      o.rx = tmp.x; o.rz = tmp.z;
      o.x = tmp.x + e.x; o.z = tmp.z + e.z; o.y = tmp.y; o.h = tmp.h; o.v = tmp.v; o.f = tmp.f;
    }
    return out;
  }

  return { push, at, reset, get delay() { return delay; } };
}

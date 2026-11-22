// Beanstalk Bounce: the beanstalk's ledges, the climbing physics, the storm and the streak scoring. Shared by the
// server (bots, checking what browsers report, the score) and the browser (your own climber is moved here, then
// reported), so both sides agree on every ledge and every jump.
//
// Everything happens in one flat plane: x from -W to W between the two side stalks, y upwards. Floor i sits at
// y = i * FLOOR_H. Ledges are one way: you pass up through them and land on them coming down.
// The tuning numbers below are first guesses; change them here and restart the server.

export const W = 8;            // half the width of the gap between the stalks
export const FLOOR_H = 2.6;    // height between floors
export const R = .42;          // half the width of a climber
export const EDGE = .3;        // how far past a ledge's end your middle can be and still stand on it
export const G = 58;           // gravity
export const RUN_ACC = 44;     // speeding up on a ledge
export const TURN_ACC = 76;    // braking when you push the other way
export const AIR_ACC = 30;     // steering in the air
export const FRICTION = 30;    // slowing down with no key held
export const VMAX = 14;        // top running speed
export const JUMP0 = 19.5;     // a standing jump: clears one floor
export const JUMPK = 1.5;      // extra jump speed per unit of running speed: a full sprint clears about five floors
export const BOUNCE = .92;     // how much speed a bounce off a side stalk keeps
export const FALL_MAX = 40;
export const SPRING_V = 43;    // a bounce mushroom throws you about six floors
export const CRUMBLE_S = .7;   // a dry leaf drops this long after you land on it
export const ZONE = 25;        // floors per zone; every zone starts with a full-width terrace
export const STREAK_MS = 3000; // a streak lasts this long after its last big jump
export const NORMAL = 0, SPRING = 1, CRUMBLE = 2, MOVING = 3;

export const ZONES = [
  { name: 'Leafy Meadow', slab: '#5fae4c', top: '#9be06a' },
  { name: 'Blossom Boughs', slab: '#e2789f', top: '#ffc4dc' },
  { name: 'Mushroom Shelves', slab: '#c98a5a', top: '#ffdca8' },
  { name: 'Cloud Tufts', slab: '#b9c8e8', top: '#ffffff' },
  { name: 'Frost Crystals', slab: '#5fb7d6', top: '#c9f4ff' },
  { name: 'Star Garden', slab: '#5a55b8', top: '#ffd84a' },
];
export const zoneOf = f => Math.floor(Math.max(0, f) / ZONE);
export const zoneInfo = z => ZONES[z % ZONES.length];
export const zoneName = z => ZONES[z % ZONES.length].name + (z >= ZONES.length ? ' ' + 'I'.repeat(Math.min(3, Math.floor(z / ZONES.length) + 1)) : '');

// How fast the storm climbs: it waits GRACE seconds, then rises faster and faster.
export const PACES = {
  chill: { name: 'Chill', v0: 1.3, a: .055, max: 16 },
  normal: { name: 'Normal', v0: 1.8, a: .08, max: 20 },
  wild: { name: 'Wild', v0: 2.6, a: .12, max: 24 },
};
export const GRACE = 2, STORM_START = -9;
export function stormY(pace, t) {
  const P = PACES[pace] || PACES.normal, u = Math.max(0, t - GRACE), tm = (P.max - P.v0) / P.a;
  return u <= tm ? STORM_START + P.v0 * u + P.a * u * u / 2 : STORM_START + P.v0 * tm + P.a * tm * tm / 2 + P.max * (u - tm);
}
export function stormSpeed(pace, t) { const P = PACES[pace] || PACES.normal; return t < GRACE ? 0 : Math.min(P.max, P.v0 + P.a * (t - GRACE)); }

const rnd = (seed, i, s) => { const x = Math.sin(seed * 12.9898 + i * 78.233 + s * 37.719) * 43758.5453; return x - Math.floor(x); };

export function buildTower(seed) { return { seed: +seed || 1, floors: [] }; }

// Floor i of the tower: { i, x0, x1 (its ends at rest), kind, amp/per/ph (moving ledges) }. Made on demand, always the same for a seed.
export function floorAt(T, i) {
  let F = T.floors[i]; if (F) return F;
  const s = T.seed, z = zoneOf(i);
  if (i % ZONE === 0) return T.floors[i] = { i, x0: -W, x1: W, kind: NORMAL, amp: 0, per: 1, ph: 0 };
  const w = Math.max(3.3, 7.4 - i * .032) * (.82 + .36 * rnd(s, i, 1));
  let c = (rnd(s, i, 2) * 2 - 1) * (W - w / 2);
  let kind = NORMAL, amp = 0, per = 1, ph = 0;
  const k = rnd(s, i, 3), m = i % ZONE;
  if (i > 6 && m > 1 && m < ZONE - 1) {
    const pS = .06, pC = z >= 1 ? Math.min(.2, .07 + .035 * z) : 0, pM = z >= 1 ? Math.min(.24, .08 + .04 * z) : i > 14 ? .08 : 0;
    if (k < pS) kind = SPRING; else if (k < pS + pC) kind = CRUMBLE; else if (k < pS + pC + pM) kind = MOVING;
  }
  if (kind === MOVING) {
    c *= .45; amp = Math.min(3.4, W - w / 2 - Math.abs(c)) * (.7 + .3 * rnd(s, i, 4));
    per = 2.6 + 1.8 * rnd(s, i, 5); ph = rnd(s, i, 6) * 6.283;
  }
  return T.floors[i] = { i, x0: c - w / 2, x1: c + w / 2, kind, amp, per, ph };
}
// how far a moving ledge has slid from its resting place at race time t (seconds)
export const ledgeOff = (F, t) => (F.kind === MOVING ? F.amp * Math.sin(t / F.per * 6.283 + F.ph) : 0);

// ---------- the climber ----------
export function newClimber(slot = 0, n = 1) {
  return { x: (slot - (n - 1) / 2) * 1.7, y: 0, vx: 0, vy: 0, on: 0, face: slot % 2 ? -1 : 1, air: 0, gone: {}, landed: -1 };
}
export const cloneClimber = k => ({ ...k, gone: { ...k.gone } });
export const isGone = (k, i, t) => k.gone[i] !== undefined && t > k.gone[i] + CRUMBLE_S;

// One step. inp: { dir: -1/0/1, jump }. t: race time in seconds at the start of the step.
// Returns a cue for sounds ('jump', 'land', 'spring', 'wall', 'drop') or null, and sets k.landed to the floor
// landed on in this step (-1 otherwise).
export function stepClimber(T, k, inp, dt, t) {
  k.landed = -1;
  let cue = null;
  const dir = inp.dir > 0 ? 1 : inp.dir < 0 ? -1 : 0, t1 = t + dt;
  if (k.on >= 0) {
    const F = floorAt(T, k.on);
    if (F.kind === MOVING) k.x += ledgeOff(F, t1) - ledgeOff(F, t); // carried along
    if (dir) k.vx += dir * (dir * k.vx < 0 ? TURN_ACC : RUN_ACC) * dt;
    else { const d = FRICTION * dt; k.vx = Math.abs(k.vx) <= d ? 0 : k.vx - Math.sign(k.vx) * d; }
  } else if (dir) k.vx += dir * AIR_ACC * dt;
  k.vx = Math.max(-VMAX, Math.min(VMAX, k.vx));
  if (dir) k.face = dir;
  if (k.on >= 0 && inp.jump) { k.vy = JUMP0 + JUMPK * Math.abs(k.vx); k.on = -1; k.air = 0; cue = 'jump'; }
  k.x += k.vx * dt;
  if (k.x > W - R) { k.x = W - R; if (k.vx > 0) { if (k.vx > 3) cue = cue || 'wall'; k.vx = -k.vx * BOUNCE; k.face = -1; } }
  else if (k.x < -W + R) { k.x = -W + R; if (k.vx < 0) { if (k.vx < -3) cue = cue || 'wall'; k.vx = -k.vx * BOUNCE; k.face = 1; } }
  if (k.on < 0) {
    const y0 = k.y;
    k.vy = Math.max(-FALL_MAX, k.vy - G * dt); k.y += k.vy * dt; k.air += dt;
    if (k.vy <= 0) {
      for (let i = Math.floor(y0 / FLOOR_H + 1e-6); i >= 0 && i * FLOOR_H >= k.y - 1e-6; i--) {
        if (isGone(k, i, t1)) continue;
        const F = floorAt(T, i), off = ledgeOff(F, t1);
        if (k.x < F.x0 + off - EDGE || k.x > F.x1 + off + EDGE) continue;
        k.y = i * FLOOR_H; k.vy = 0; k.on = i; k.landed = i; k.air = 0; cue = 'land';
        if (F.kind === SPRING) { k.vy = SPRING_V; k.on = -1; cue = 'spring'; }
        else if (F.kind === CRUMBLE && k.gone[i] === undefined) k.gone[i] = t1;
        break;
      }
      if (k.y < 0) { k.y = 0; k.vy = 0; k.on = 0; k.landed = 0; cue = 'land'; } // the meadow at the bottom catches everything
    }
  } else {
    const F = floorAt(T, k.on), off = ledgeOff(F, t1);
    if (isGone(k, k.on, t1)) { k.on = -1; k.vy = 0; cue = cue || 'drop'; }
    else if (k.x < F.x0 + off - EDGE || k.x > F.x1 + off + EDGE) { k.on = -1; k.vy = 0; }
  }
  return cue;
}

// ---------- streaks and the score ----------
// A big jump is a landing two or more floors above where you last stood. Big jumps in a row (each within
// STREAK_MS of the last) make a streak; when it ends, a streak of two or more jumps pays floors x jumps x 2.
// Score = 10 a floor for the highest floor reached, plus streak bonuses.
export const newRun = () => ({ last: 0, best: 0, bonus: 0, top: 0, st: null });
export const streakPts = st => (st && st.n >= 2 ? st.fl * st.n * 2 : 0);
export const scoreOf = run => run.best * 10 + run.bonus;
// Ends the streak if there is one. Returns what it paid: { n, fl, pts } or null.
export function bank(run) {
  const st = run.st; run.st = null;
  if (!st) return null;
  const pts = streakPts(st); run.bonus += pts; run.top = Math.max(run.top, pts);
  return { n: st.n, fl: st.fl, pts };
}
// Call often: ends a streak whose time ran out.
export const expire = (run, ms) => (run.st && ms > run.st.until ? bank(run) : null);
// A landing on floor f at race time ms. Returns { up (floors gained on this jump), big, ended (a banked streak or null) }.
export function land(run, f, ms) {
  let ended = expire(run, ms);
  const up = f - run.last;
  if (up >= 2) { const st = run.st || (run.st = { n: 0, fl: 0, until: 0 }); st.n++; st.fl += up; st.until = ms + STREAK_MS; }
  else if (up !== 0) ended = bank(run) || ended;
  run.last = f; run.best = Math.max(run.best, f);
  return { up, big: up >= 2, ended };
}
// what the crowd shouts for a streak that covered this many floors
export const cheer = fl => (fl >= 60 ? 'Sky legend!' : fl >= 40 ? 'Unreal!' : fl >= 26 ? 'Soaring!' : fl >= 16 ? 'Wow!' : fl >= 9 ? 'Sweet!' : 'Nice!');

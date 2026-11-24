// Shared frame loop for every game's 3D scene: a steady 60 frames a second.
//
//   const frames = frameLoop((dt, now) => { ...update and render... }, { onSlow: () => lowerResolution() });
//   frames.setFps(30);   // optional battery saver
//   frames.stop();       // on dispose
//
// - Draws on the display's own refresh, so a 60 Hz screen gets exactly 60 with even spacing.
// - On faster screens (120, 144, 240 Hz) it draws every 2nd, 3rd... refresh instead of burning the GPU
//   at the full rate: never below the target where the screen allows it, and never uneven.
// - Does nothing while the tab is hidden.
// - Results screens over a scene (.results) don't blur it (see style.css): a backdrop blur over a live 3D canvas has
//   to be redone every frame and dragged the whole page down, so the scene keeps its full frame rate under them.
export const FPS = 60;

export function frameLoop(draw, { fps = FPS, onSlow } = {}) {
  let raf = 0, dead = false, last = 0, lastDraw = 0, skip = 0;
  const gaps = []; let refresh = 1000 / 60; // measured time between screen refreshes, ms
  let secAt = 0, drawn = 0, slow = 0, measured = fps;
  const tick = now => {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    if (document.hidden) { last = 0; return; }
    if (!last || now - last > 500) { last = lastDraw = secAt = now; drawn = 0; skip = 0; return; } // first frame, or back from a pause
    gaps.push(now - last); last = now;
    if (gaps.length >= 30) { gaps.sort((a, b) => a - b); refresh = Math.max(2, gaps[14]); gaps.length = 0; }
    // how many refreshes each drawn frame spans: 1 on a 60 or 75 Hz screen, 2 at 120 or 144 Hz, 4 at 240 Hz
    const every = Math.max(1, Math.floor(1000 / refresh / (fps - 2)));
    if (++skip < every) return;
    skip = 0;
    const dt = Math.min(.05, (now - lastDraw) / 1000); lastDraw = now;
    drawn++;
    if (now - secAt >= 1000) {
      measured = drawn * 1000 / (now - secAt);
      slow = measured < fps * .75 ? slow + 1 : 0; drawn = 0; secAt = now;
      if (slow >= 3) { slow = 0; onSlow?.(measured); }
    }
    draw(dt, now);
  };
  raf = requestAnimationFrame(tick);
  return {
    setFps(n) { fps = n; slow = 0; },
    fps: () => measured,
    stop() { dead = true; cancelAnimationFrame(raf); },
  };
}

// ---------- graphics level ----------
// One level for the whole site, picked per device:
//   'high' computers: each game's own resolution cap, full shadows.
//   'mid'  phones and tablets: at most 1.3 pixels per CSS pixel (phone screens are 2.5x to 3x and a mid-range phone GPU
//          can't fill that at 60 fps), shadow maps at most 1024 and redrawn every second frame.
//   'low'  weak phones (4 cores or fewer, or 3 GB or less memory), or any device whose 3D already had to drop to its lowest
//          resolution and was still slow (remembered in ct_gfxa for a week): 1x resolution, no antialiasing, 512 shadow maps,
//          plain filtering, the hub's moving pictures stand still. With no graphics card (software WebGL, SOFT) Auto goes
//          further: about 0.3 megapixels and no shadows (see soft()), plus a tip to turn hardware acceleration on.
// A player can pin it with ct_gfx = 'low' | 'high' (Hot Pot's Graphics button and the hub's account menu); 'auto' detects.
const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch { return false; } };
// Is WebGL drawn by the processor instead of the graphics card (hardware acceleration off or blocked)? Checked once per
// page with a throwaway context, before any game makes its renderer, so even the first scene starts in the light mode.
const SOFT_RE = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i;
const glName = gl => { const x = gl.getExtension('WEBGL_debug_renderer_info'); return String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); };
export const SOFT = (() => {
  if (typeof document !== 'object') return false;
  try { const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); if (!gl) return false;
    const soft = SOFT_RE.test(glName(gl)); gl.getExtension('WEBGL_lose_context')?.loseContext(); return soft; } catch { return false; }
})();
export function detectGfx() {
  const nav = typeof navigator === 'object' ? navigator : {};
  const phone = coarse() || /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || '');
  const cores = nav.hardwareConcurrency || 8, mem = nav.deviceMemory || 8;
  if (SOFT || +LS.get('ct_gfxa') > Date.now() - 7 * 864e5) return 'low';
  if (phone && (cores <= 4 || mem <= 3)) return 'low';
  if (!phone && cores <= 2) return 'low';
  return phone ? 'mid' : 'high';
}
export const gfxPick = () => { const v = LS.get('ct_gfx'); return v === 'low' || v === 'high' ? v : 'auto'; };
let level = null;
export function gfx() { if (!level) { const p = gfxPick(); level = p === 'auto' ? detectGfx() : p; markPage(); } return level; }
// Set the player's own pick ('auto' | 'low' | 'high'). Scenes already open keep theirs until they are built again,
// except the resolution and shadow maps, which follow at once (each autoResolution listens).
export function setGfx(pick) {
  LS.set('ct_gfx', pick === 'auto' ? null : pick); if (pick !== 'low') LS.set('ct_gfxa', null); // a fresh Auto forgets what it learned
  level = pick === 'auto' ? detectGfx() : pick; markPage(); tell(level);
}
const live = new Set(); // WeakRefs to each open renderer's level hook, so closed games can be collected
const tell = l => { for (const w of live) { const f = w.deref(); if (f) f(l); else live.delete(w); } };
function markPage() { if (typeof document !== 'object') return; for (const l of ['high', 'mid', 'low']) document.documentElement.classList.toggle('gfx-' + l, l === level); document.documentElement.classList.toggle('gfx-soft', soft()); }
// The no-graphics-card mode: Auto on a software renderer. Drawing on the CPU costs per pixel, so the 3D is drawn at about
// 0.3 megapixels whatever the window size (the browser scales it up) and without shadows. Games stay smooth; they just look softer.
const soft = () => SOFT && level === 'low' && gfxPick() === 'auto';
const SOFT_PIXELS = 320_000;
const softRatio = (w, h) => Math.max(.3, Math.min(1, Math.sqrt(SOFT_PIXELS / Math.max(1, w * h))));
export const AA = typeof window === 'object' ? gfx() !== 'low' : true; // antialias flag for new WebGLRenderer (fixed for the page's life)
// Tips for the player when the browser itself holds the 3D back (app.js shows them as a toast, once a day at most):
// 'soft' the browser draws 3D without the graphics card (hardware acceleration off or blocked, often in Opera GX);
// 'slow' a scene stayed slow even at the lowest resolution (a CPU/RAM limiter like Opera GX's GX Control, page shaders).
let tipFn = null; const tipped = new Set();
export function onGfxTip(fn) { tipFn = fn; }
function tip(kind) { if (tipped.has(kind)) return; tipped.add(kind); const k = 'ct_gfxtip_' + kind, d = new Date().toDateString(); if (LS.get(k) === d) return; LS.set(k, d); tipFn?.(kind); }
const PX = { high: 99, mid: 1.3, low: 1 }, SHADOW = { high: 99999, mid: 1024, low: 512 };

// Resolution that backs off when a device can't hold the frame rate. `cap` is the most pixels per CSS pixel to draw.
// It also fits the renderer to the graphics level: the resolution cap, and (checked every couple of seconds, so lights
// added later are caught too) the shadow map size, filter and how often a constantly updated shadow map is redrawn.
export function autoResolution(renderer, cap = 1.5) {
  let scale = 1, lv = gfx(), floorHits = 0;
  if (SOFT) tip('soft');
  // The soft budget is per canvas, so the ratio follows each setSize (the hub's small isle stays sharp, a full-window game drops).
  let cw = innerWidth, ch = innerHeight, busy = false;
  const ratio = () => soft() ? softRatio(cw, ch) * scale : Math.max(1, Math.min(devicePixelRatio, cap, PX[lv]) * scale);
  const apply = () => { busy = true; renderer.setPixelRatio(ratio()); busy = false; };
  const size = renderer.setSize.bind(renderer);
  renderer.setSize = (w, h, style) => { cw = w; ch = h; if (!busy && soft() && Math.abs(renderer.getPixelRatio() - ratio()) > .001) { busy = true; renderer.setPixelRatio(ratio()); busy = false; } size(w, h, style); };
  apply();
  const sm = renderer.shadowMap, draw = renderer.render.bind(renderer);
  let check = 0, frame = 0, ours = false;
  const fitShadows = scene => {
    if (soft()) { if (sm.enabled) { sm.enabled = false; scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); } return; }
    if (lv === 'low' && sm.type === 2) { sm.type = 1; sm.needsUpdate = true; } // PCFSoft -> PCF: a quarter of the samples
    const max = SHADOW[lv];
    scene.traverse(o => {
      const s = o.isLight && o.castShadow && o.shadow; if (!s) return;
      if (!s.full) s.full = s.mapSize.clone();
      const w = Math.min(s.full.x, max), h = Math.min(s.full.y, max);
      if (s.mapSize.x !== w || s.mapSize.y !== h) { s.mapSize.set(w, h); s.map?.dispose(); s.map = null; sm.needsUpdate = true; }
    });
  };
  renderer.render = (scene, camera) => {
    if (scene.isScene && --check <= 0) { check = 120; fitShadows(scene); }
    if (lv !== 'high' && sm.enabled) { // a map the game keeps redrawing every frame: every second frame is plenty
      if (sm.autoUpdate) { sm.autoUpdate = false; ours = true; }
      if (ours && (++frame & 1)) sm.needsUpdate = true;
    } else if (ours) { sm.autoUpdate = true; ours = false; }
    draw(scene, camera);
  };
  const onLevel = l => { lv = l; scale = 1; check = 0; apply(); };
  renderer.__gfx = onLevel; live.add(new WeakRef(onLevel));
  return {
    setCap(c) { cap = c; scale = 1; apply(); },
    // Called by a scene's onSlow. At the lowest resolution and still slow twice: this device is weak, so remember it
    // and start every scene at the low level from now on (unless the player picked a level).
    lower() {
      if (soft()) { if (scale > .6) { scale *= .85; apply(); return true; } return false; }
      if (scale > .67 && Math.min(devicePixelRatio, cap, PX[lv]) * scale > 1.01) { scale *= .82; apply(); return true; }
      if (++floorHits >= 2 && lv !== 'low' && gfxPick() === 'auto') { LS.set('ct_gfxa', String(Date.now())); level = 'low'; markPage(); tell('low'); }
      else if (floorHits >= 4) tip('slow'); // even the low level can't keep up: something outside the page is holding it back
      return false;
    },
  };
}

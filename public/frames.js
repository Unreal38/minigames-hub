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

// Resolution that backs off when a device can't hold the frame rate. `cap` is the most pixels per CSS pixel to draw.
export function autoResolution(renderer, cap = 1.5) {
  let scale = 1;
  const apply = () => renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio, cap) * scale));
  apply();
  return {
    setCap(c) { cap = c; scale = 1; apply(); },
    lower() { if (scale <= .67) return false; scale *= .82; apply(); return true; },
  };
}

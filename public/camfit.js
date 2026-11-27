// Camera re-fits for HUD panels (Kuba, 2026-11-24): pressing a button or playing a card changes how tall the
// game's bottom dock is, and the scene used to re-frame the table right away, a short abrupt camera jump.
// Now a scene takes new HUD sizes only while it is settling: for a moment after its first HUD measure (the
// opening layout), and right after a window resize (a real one, a phone turning, or a game sheet loading).
// The rest of the time the new size is only stored, and the next resize frames the table with it.
const born = new WeakMap(); // canvas -> time of its first HUD measure
let until = 0;
addEventListener('resize', () => { until = performance.now() + 900; });
export function hudFitOk(canvas) {
  const now = performance.now();
  if (!born.has(canvas)) born.set(canvas, now);
  return now - born.get(canvas) < 2500 || now < until;
}

// A HUD that grows mid-game (a fuller hand, a two-line hint, a wrapped name strip) used to be ignored, and on phones it
// then covered the bottom of the table (a friend's report, 2026-11-27). Now a scene re-fits for a HUD that GROWS past
// anything seen so far, and eases there instead of jumping; a shrinking HUD keeps the frame, so it never swings back and
// forth. easeRefit runs the scene's own re-fit, then walks camBase/camLook and the view offset over from where they were.
// The scene's loop must place the camera from camBase each frame (they all do). A later re-fit (a real window resize)
// moves camBase itself, which stops the walk.
const walks = new WeakMap();
export function easeRefit(camera, camBase, camLook, refit) {
  const v = () => (camera.view?.enabled ? { x: camera.view.offsetX, y: camera.view.offsetY } : { x: 0, y: 0 });
  const b0 = camBase.clone(), l0 = camLook.clone(), o0 = v();
  refit();
  const b1 = camBase.clone(), l1 = camLook.clone(), o1 = v(), vw = camera.view;
  if (!vw?.enabled && !o0.x && !o0.y && b0.distanceToSquared(b1) < 1e-8) return;
  const t0 = performance.now(), me = {}; walks.set(camera, me);
  let last = null;
  const step = () => {
    if (walks.get(camera) !== me || (last && !camBase.equals(last))) return; // a newer fit took over
    const k = Math.min(1, (performance.now() - t0) / 650), e = k * k * (3 - 2 * k);
    camBase.lerpVectors(b0, b1, e); camLook.lerpVectors(l0, l1, e); last = camBase.clone();
    if (vw?.enabled) { camera.setViewOffset(vw.fullWidth, vw.fullHeight, o0.x + (o1.x - o0.x) * e, o0.y + (o1.y - o0.y) * e, vw.width, vw.height); camera.updateProjectionMatrix(); }
    if (k < 1) requestAnimationFrame(step); else walks.delete(camera);
  };
  step();
}

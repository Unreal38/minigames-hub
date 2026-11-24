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

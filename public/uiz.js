// One size knob for the in-game screens on computers (Kuba, 2026-11-24: the game panels, buttons and card hands
// were too small on PC). Phones and tablets keep 1 so their layouts stay exactly as they are.
//
// - html gets `--uiz` (1, or up to 1.3 on a big desktop window). style.css zooms the game HUDs, results, gates,
//   name tags, the table chat and pop-ups with `zoom: var(--uiz)` and sets `--vz` inside them, so vh/vw in the game
//   stylesheets (written as calc(Nvh / var(--vz, 1))) still mean the real window.
// - JS that mixes screen pixels with HUD layout must convert: an element inside a zoomed HUD reports offsetWidth /
//   offsetHeight in its own unzoomed pixels (times uiz() = on screen), and left/top/translate pixels set on it are
//   multiplied by uiz() on screen (so divide screen positions by uiz()). getBoundingClientRect() is already on screen.
let z = 1;
export const uiz = () => z;
const fine = typeof matchMedia === 'function' ? matchMedia('(hover: hover) and (pointer: fine)') : null;

function fit() {
  const w = innerWidth, h = innerHeight;
  // 1 below a roomy desktop window; 1.25 on a full-HD browser window (about 1920 x 950); 1.3 at most
  const want = fine?.matches && w >= 1200 ? Math.min(1.3, Math.max(1, Math.min(w / 1500, h / 760))) : 1;
  const next = Math.floor(want * 20) / 20; // steps of 0.05 so the layout does not shift on every pixel of a resize
  if (next === z && document.documentElement.style.getPropertyValue('--uiz')) return;
  z = next; document.documentElement.style.setProperty('--uiz', String(z));
}
fit();
addEventListener('resize', fit);
fine?.addEventListener?.('change', fit);

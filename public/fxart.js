// The particle shapes, drawn the way the rest of the game looks: flat colour, one darker facet and an ink outline,
// with straight low-poly edges. Used by the in-scene particles (scenery3d.js) and the full-screen win effects
// (winfx.js), so both stay one family. No three.js in here.
export const INK = '#3b2219';
const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
const ngon = (n, r, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; });
const PATH = {
  dot: g => poly(g, ngon(8, .82, Math.PI / 8)),
  star: g => poly(g, Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .44 : .92; return [Math.cos(a) * r, Math.sin(a) * r]; })),
  conf: g => poly(g, [[-.74, -.4], [.74, -.4], [.74, .4], [-.74, .4]]),
  heart: g => poly(g, [[0, .86], [-.86, .02], [-.86, -.42], [-.52, -.76], [-.18, -.76], [0, -.5], [.18, -.76], [.52, -.76], [.86, -.42], [.86, .02]]),
  fish: g => poly(g, [[-.9, 0], [-.5, -.46], [.08, -.5], [.44, -.14], [.9, -.52], [.9, .52], [.44, .14], [.08, .5], [-.5, .46]]),
  coin: g => poly(g, ngon(8, .86, Math.PI / 8)),
};
// Draws shape `kind` centred on (cx, cy) with half-size r. edge '' leaves the outline off (soft things like dust).
export function drawShape(g, kind, cx, cy, r, { fill = '#ffffff', shade = '#d0d0d0', edge = INK } = {}) {
  g.save(); g.translate(cx, cy); g.scale(r, r); g.lineJoin = g.lineCap = 'round';
  if (kind === 'ring') { for (const [c, w] of [[edge, .36], [fill, .2]]) { g.strokeStyle = c; g.lineWidth = w; poly(g, ngon(12, .7)); g.stroke(); } }
  else if (kind === 'flake') {
    for (const [c, w] of [[edge, .44], [fill, .22]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath();
      for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * Math.PI / 3, x = Math.cos(a) * .72, y = Math.sin(a) * .72; g.moveTo(-x, -y); g.lineTo(x, y); } g.stroke(); }
  } else {
    const path = PATH[kind] || PATH.dot;
    path(g); g.fillStyle = fill; g.fill();
    g.save(); path(g); g.clip(); g.fillStyle = shade; poly(g, [[-1.1, .34], [1.1, -.12], [1.1, 1.1], [-1.1, 1.1]]); g.fill(); g.restore(); // the facet
    if (edge) { path(g); g.strokeStyle = edge; g.lineWidth = .15; g.stroke(); }
    if (kind === 'fish') { g.fillStyle = edge || INK; g.beginPath(); g.arc(-.48, -.12, .09, 0, 6.3); g.fill(); }
    if (kind === 'coin') { g.strokeStyle = shade; g.lineWidth = .1; poly(g, ngon(8, .46, Math.PI / 8)); g.stroke(); }
  }
  g.restore();
}
// A darker version of a #rrggbb colour, for the facet.
export const darker = (hex, k = .8) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

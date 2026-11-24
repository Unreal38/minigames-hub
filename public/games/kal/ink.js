// Kalambury's drawing board: plays the drawer's strokes onto an 800 × 600 canvas. The same strokes always give the
// same picture on every screen, which the fill bucket relies on. Keeps the list of strokes so "undo" can replay it.
import { BW, BH, COLORS, SIZES, OP } from './rules.js';

const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const RGB = COLORS.map(rgb);

export function createInk(canvas) {
  canvas.width = BW; canvas.height = BH;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.lineCap = 'round'; g.lineJoin = 'round';
  let items = [], cur = null; // strokes { c, w, p: [x, y, …] } and fills { f: 1, c, x, y }

  const blank = () => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, BW, BH); };
  function dot(c, w, x, y) { g.fillStyle = COLORS[c]; g.beginPath(); g.arc(x, y, SIZES[w] / 2, 0, 6.3); g.fill(); }
  function seg(c, w, x0, y0, x1, y1) { g.strokeStyle = COLORS[c]; g.lineWidth = SIZES[w]; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }

  // Paint bucket: floods the area around (x, y) that has (about) the same colour, a row at a time.
  function fill(c, x, y) {
    x = Math.max(0, Math.min(BW - 1, x | 0)); y = Math.max(0, Math.min(BH - 1, y | 0));
    const img = g.getImageData(0, 0, BW, BH), d = img.data, [r, gg, b] = RGB[c];
    const at = (y * BW + x) * 4, r0 = d[at], g0 = d[at + 1], b0 = d[at + 2];
    if (Math.abs(r0 - r) + Math.abs(g0 - gg) + Math.abs(b0 - b) < 12) return;
    const TOL = 120, seen = new Uint8Array(BW * BH);
    const same = i => !seen[i] && Math.abs(d[i * 4] - r0) + Math.abs(d[i * 4 + 1] - g0) + Math.abs(d[i * 4 + 2] - b0) <= TOL;
    const stack = [y * BW + x];
    while (stack.length) {
      let i = stack.pop(); if (!same(i)) continue;
      const row = (i / BW | 0) * BW; let l = i, rr = i;
      while (l > row && same(l - 1)) l--;
      while (rr < row + BW - 1 && same(rr + 1)) rr++;
      let up = false, down = false;
      for (let k = l; k <= rr; k++) {
        seen[k] = 1; const o = k * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
        if (k >= BW) { const a = same(k - BW); if (a && !up) stack.push(k - BW); up = a; }
        if (k < BW * (BH - 1)) { const a = same(k + BW); if (a && !down) stack.push(k + BW); down = a; }
      }
    }
    g.putImageData(img, 0, 0);
  }

  function paint(it) {
    if (it.f) return fill(it.c, it.x, it.y);
    dot(it.c, it.w, it.p[0], it.p[1]);
    for (let i = 2; i < it.p.length; i += 2) seg(it.c, it.w, it.p[i - 2], it.p[i - 1], it.p[i], it.p[i + 1]);
  }
  function redraw() { blank(); for (const it of items) paint(it); }

  // One step of the drawing, as it came from the drawer.
  function apply(o) {
    const k = o[0];
    if (k === OP.START) { cur = { c: o[1], w: o[2], p: [o[3], o[4]] }; items.push(cur); dot(cur.c, cur.w, o[3], o[4]); }
    else if (k === OP.MOVE) {
      if (!cur) return;
      for (let i = 1; i + 1 < o.length; i += 2) { const n = cur.p.length; seg(cur.c, cur.w, cur.p[n - 2], cur.p[n - 1], o[i], o[i + 1]); cur.p.push(o[i], o[i + 1]); }
    } else if (k === OP.FILL) { cur = null; const it = { f: 1, c: o[1], x: o[2], y: o[3] }; items.push(it); fill(it.c, it.x, it.y); }
    else if (k === OP.UNDO) { cur = null; if (items.pop()) redraw(); }
    else if (k === OP.CLEAR) { cur = null; items = []; blank(); }
  }
  blank();
  return { apply, reset() { items = []; cur = null; blank(); }, get count() { return items.length; } };
}

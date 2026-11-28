// Floating name tags over players in every 3D game: one look and one way of placing them.
//
// Look: tagFace(p) is the inside of a tag (small portrait in the player's frame, name in their name colour, title),
// tagCls(p) goes on the pill element and tagBg(p) is its last child (the player's card background).
//
// Placing: a game keeps working out a point above each player (its scene's tag anchor) and calls
// placer.place(items) once a frame with { el, x, y, show } in the tags box's pixels. The placer finds the head
// under that point (avatar3d.js headSpots) and puts the tag above the head, or to its right or left when above is
// off the screen, under the HUD, over another tag or over another player's head. A tag keeps its side until another
// one is clearly better, and slides there instead of jumping. Only transforms are written each frame; sizes and the
// HUD boxes are measured a few times a second, so this stays cheap at 60 fps.
//
// Play area: a scene calls playArea(camera, w, h, shape...) each frame with the world points that outline where people
// click (the board, the table middle, the card fan). Tags never sit over it: a tag that would is moved just past its
// edge (beside, above or below it), next to its player. Kuba: name tags must never cover the play area (2026-11-28).
import * as THREE from 'three';
import { avatarHtml } from './avatar.js';
import { headSpots } from './avatar3d.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, rowBg, pbRows } from './cosmetics.js';

export const tagFace = (p, name) => `${avatarHtml(p.color, p.av, 26, `ntav ${frameCls(p.fl)}`)}<span class="ntx"><b>${name ?? nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</span>`;
export const tagCls = p => ` nt${pbRowCls(p.fl)}`;
export const tagBg = p => rowBg(p.fl);

const GAP = 5, EDGE = 4;

// ---------- play area ----------
let zones = [], zoneAt = 0, zv = null;
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function hull(P) {
  if (P.length < 3) return P;
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}
// Each shape: an array of world points (THREE.Vector3), or a box { min, max } (THREE.Box3), in the canvas's pixels
// (w x h, the size the scene renders at). Called every frame from the scene, after the camera moved.
export function playArea(camera, w, h, ...shapes) {
  zones = []; zoneAt = performance.now();
  for (const sh of shapes) {
    if (!sh) continue;
    const pts = sh.min && sh.max ? boxPts(sh) : sh;
    if (!pts.length) continue;
    zv ||= pts[0].clone();
    const P = [];
    for (const p of pts) { zv.copy(p).project(camera); if (zv.z > 1 || zv.z < -1) continue; P.push([(zv.x + 1) / 2 * w, (1 - zv.y) / 2 * h]); }
    const H = hull(P); if (H.length < 3) continue;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of H) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    zones.push({ P: H, x0, x1, y0, y1 });
  }
}
// Screen rectangles (canvas pixels) for play areas drawn by the page, not the scene (a hand of cards in the HUD).
export function playRects(...rs) { for (const r of rs) if (r && r.w > 0 && r.h > 0) zones.push({ P: [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }); zoneAt = performance.now(); }
export const playZones = () => zones;
// The outline of a round table top (radius r at height y, centre x/z), optionally raised by h (cards, tiles, pieces).
export function disc(r, y, { x = 0, z = 0, h = 0, n = 28 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push(new THREE.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r)); if (h) out.push(new THREE.Vector3(x + Math.cos(a) * r, y + h, z + Math.sin(a) * r)); }
  return out;
}
const BX = [0, 1];
function boxPts(b) { // the box's 8 corners, kept on the box so nothing is made each frame
  const out = b._pts ||= Array.from({ length: 8 }, () => b.min.clone());
  let n = 0;
  for (const i of BX) for (const j of BX) for (const k of BX) out[n++].set(i ? b.max.x : b.min.x, j ? b.max.y : b.min.y, k ? b.max.z : b.min.z);
  return out;
}
function inside(P, x, y) {
  for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false; }
  return true;
}
// how much of the rectangle (0..1) lies over a play area: a grid of points inside it, so long thin tags count right
function overPlay(R, Z) {
  let n = 0, hit = 0;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) {
    const x = R.x + R.w * (i + .5) / 7, y = R.y + R.h * (j + .5) / 4; n++;
    for (const z of Z) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1 && inside(z.P, x, y)) { hit++; break; }
  }
  return hit / n;
}
// The polygon's reach along one axis inside a band of the other: [min, max] of x over y in [a, b] (or of y over x).
function span(P, a, b, vert) {
  const X = vert ? 1 : 0, Y = vert ? 0 : 1; let lo = 1e9, hi = -1e9;
  for (let i = 0, n = P.length; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n];
    if (p[Y] >= a && p[Y] <= b) { lo = Math.min(lo, p[X]); hi = Math.max(hi, p[X]); }
    for (const c of [a, b]) if ((p[Y] - c) * (q[Y] - c) < 0) { const x = p[X] + (q[X] - p[X]) * (c - p[Y]) / (q[Y] - p[Y]); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  }
  return lo <= hi ? [lo, hi] : null;
}
const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function tagPlacer(box) {
  zones = []; zoneAt = 0;
  const st = new Map();
  let blocks = [], until = 0, vw = 1, vh = 1, ox = 0, oy = 0, washAt = 0, zoom = 1, queue = [], queued = false;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(es => { for (const e of es) { const s = st.get(e.target); if (s) { s.w = e.target.offsetWidth; s.h = e.target.offsetHeight; } } }) : null;
  const game = box.closest('.game') || box.parentElement || document.body;

  // The HUD pieces a tag must not sit under: corner chips and buttons, banners, bottom bars, lists.
  function measure(now) {
    until = now + 400;
    const br = box.getBoundingClientRect(); vw = br.width || 1; vh = br.height || 1; zoom = box.offsetWidth ? vw / box.offsetWidth : 1;
    const big = vw * vh * .2;
    blocks = [];
    const els = game.querySelectorAll('.hud > *, .hud .tl > *, .hud .tr > *, .hud .bl > *, .hud .br > *');
    const extra = document.querySelectorAll('body.in-game #chat .chatbtns > *, body.in-game #chat .chatpeek:not([hidden])');
    for (const el of [...els, ...extra]) {
      if (el === box || el.contains(box) || box.contains(el)) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.width * r.height > big) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      blocks.push({ x: r.left - br.left - 3, y: r.top - br.top - 3, w: r.width + 6, h: r.height + 6 });
    }
    const cv = game.querySelector('canvas');
    if (cv) { const c = cv.getBoundingClientRect(); ox = c.left - br.left; oy = c.top - br.top; }
    if (now > washAt) { washAt = now + 900; pbRows(box); }
  }

  function place(items) {
    const now = performance.now(); if (now > until) measure(now);
    const heads = headSpots().map(h => ({ x: h.x + ox, y: h.y + oy, r: h.r, top: (h.top ?? h.y - h.r) + oy, root: h.root }));
    const narrow = vw < 700, placed = [], taken = new Set();
    // the play areas in this box's pixels (a scene that stopped sending them has none)
    const Z = now - zoneAt < 1000 ? zones.map(z => ({ P: z.P.map(([x, y]) => [x + ox, y + oy]), x0: z.x0 + ox, x1: z.x1 + ox, y0: z.y0 + oy, y1: z.y1 + oy })) : [];
    const list = items.filter(t => t && t.el && t.show !== false && !t.el.hidden).sort((a, b) => b.y - a.y);
    for (const t of list) {
      let s = st.get(t.el);
      if (!s) { s = { side: -1, dx: 0, dy: 0, w: t.el.offsetWidth, h: t.el.offsetHeight, root: null, hox: 0, hoy: 0, hr: 0, at: 0 }; st.set(t.el, s); ro?.observe(t.el); if (t.k) t.el.style.transformOrigin = '0 0'; }
      t.s = s;
    }
    // Each tag keeps the head it found first, so a player walking past never takes it over; new tags take the closest free head.
    for (const t of list) {
      const s = t.s; t.hd = null;
      if (s.root) { const h = heads.find(o => o.root === s.root); if (h && Math.hypot(h.x - t.x, h.y - h.r - t.y) < Math.max(160, h.r * 6)) { t.hd = h; taken.add(h); } }
    }
    for (const t of list) {
      if (t.hd) continue;
      let bd = 1e9;
      for (const h of heads) { if (taken.has(h)) continue; const d = Math.hypot(h.x - t.x, h.y - h.r - t.y); if (d < bd && d < Math.max(70, h.r * 3)) { bd = d; t.hd = h; } }
      if (t.hd) { taken.add(t.hd); t.s.root = t.hd.root; }
    }
    for (const t of list) {
      const s = t.s, hd = t.hd;
      // a player off the edge of the view: no tag pinned to the edge for them
      const away = t.x < -20 || t.x > vw + 20 || t.y < -20 || t.y > vh + 40;
      if (away) { if (!s.off) { s.off = true; t.el.style.visibility = 'hidden'; } continue; }
      if (!s.w) { s.w = t.el.offsetWidth; s.h = t.el.offsetHeight; }
      const k = (t.k || 1) * zoom;
      // the head, or (for a frame where it is hidden) where it was last seen next to this tag's point
      if (hd) { s.hox = hd.x - t.x; s.hoy = hd.y - t.y; s.hr = hd.r; s.ht = hd.y - hd.top; }
      const hx = t.x + (s.root ? s.hox : 0), hy = t.y + (s.root ? s.hoy : 0), hr = s.root ? s.hr : 0, w = s.w * k, h = s.h * k;
      // above; beside (right, left); above but leaning right or left; a row higher (players huddled together)
      const up = hy - (s.root ? s.ht : 0) - GAP - h; // just over the hair
      const cands = [
        [hx - w / 2, up, 0],
        [hx + hr + GAP, hy - h / 2 - hr * .15, 1],
        [hx - hr - GAP - w, hy - h / 2 - hr * .15, 2],
        [hx - w * .15, up, 3],
        [hx - w * .85, up, 4],
        [hx - w / 2, up - h - 4, 5],
      ];
      // a tag changes side only now and then, and only for a clearly better spot: no flicking between two places
      // a spot over the play area also gets the same spot moved just past the area's edge: beside it, above or below it
      if (Z.length) for (let i = 0; i < 6; i++) {
        const [x, y] = cands[i], R = { x, y, w, h };
        if (!overPlay(R, Z)) continue;
        let L = 1e9, Rt = -1e9, T = 1e9, B = -1e9;
        for (const z of Z) {
          if (z.x1 < x || z.x0 > x + w || z.y1 < y || z.y0 > y + h) continue;
          const sx = span(z.P, y, y + h, false); if (sx) { L = Math.min(L, sx[0]); Rt = Math.max(Rt, sx[1]); }
          const sy = span(z.P, x, x + w, true); if (sy) { T = Math.min(T, sy[0]); B = Math.max(B, sy[1]); }
        }
        if (Rt > -1e9) { cands.push([Rt + GAP, y, 6 + i * 4, x, y]); cands.push([L - GAP - w, y, 7 + i * 4, x, y]); }
        if (B > -1e9) { cands.push([x, T - GAP - h, 8 + i * 4, x, y]); cands.push([x, B + GAP, 9 + i * 4, x, y]); }
      }
      const settled = s.side >= 0 && now - s.at < 900;
      let best = null, bc = 1e9;
      for (const [x, y, side, fx, fy] of cands) {
        if (settled && side !== s.side) continue;
        let c = side < 6 ? [0, narrow ? .5 : .8, narrow ? .5 : .8, .35, .35, .7][side] : .6 + Math.hypot(x - fx, y - fy) / Math.max(8, h) * .45;
        if (side !== s.side && s.side >= 0) c += 1.2;
        // kept on screen, a tag that had to be pushed far from its head counts against that side
        const cx = Math.min(Math.max(EDGE, x), vw - w - EDGE), cy = Math.min(Math.max(EDGE, y), vh - h - EDGE), R = { x: cx, y: cy, w, h };
        c += Math.hypot(cx - x, cy - y) / Math.max(8, h) * 2.5;
        const A = w * h || 1;
        for (const b of blocks) c += area(R, b) / A * 6;
        for (const p of placed) c += area(R, p) / A * 4;
        for (const o of heads) if (o !== hd) c += area(R, { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 }) / A * 1.5;
        if (Z.length) c += overPlay(R, Z) * 14;
        if (c < bc) { bc = c; best = [x, y, side]; }
      }
      const tx = best[0] - hx, ty = best[1] - hy;
      if (s.side < 0) { s.dx = tx; s.dy = ty; } else { s.dx += (tx - s.dx) * .15; s.dy += (ty - s.dy) * .15; }
      if (best[2] !== s.side) { s.side = best[2]; s.at = now; }
      const x = Math.min(Math.max(EDGE, hx + s.dx), vw - w - EDGE), y = Math.min(Math.max(EDGE, hy + s.dy), vh - h - EDGE);
      const off = Math.hypot(x - hx - s.dx, y - hy - s.dy) > h * 2; // only half on the screen: a tag pinned far from them would mislead
      if (off !== !!s.off) { s.off = off; t.el.style.visibility = off ? 'hidden' : ''; }
      t.el.style.transform = `translate3d(${(x / zoom).toFixed(1)}px, ${(y / zoom).toFixed(1)}px, 0)${t.k ? ` scale(${t.k.toFixed(2)})` : ''}`;
      t.el.dataset.side = s.side;
      placed.push({ x: x - 2, y: y - 2, w: w + 4, h: h + 4 });
    }
  }
  // A rebuilt tag list: forget the old elements.
  function reset() { for (const el of st.keys()) ro?.unobserve(el); st.clear(); until = 0; }
  // add(el, x, y, k) from inside a game's per-frame loop: the tags of one frame are placed together right after it.
  const flush = () => { queued = false; const q = queue; queue = []; place(q); };
  function add(el, x, y, k) { queue.push({ el, x, y, k }); if (!queued) { queued = true; queueMicrotask(flush); } }
  return { place, add, reset, refresh: () => { until = 0; washAt = 0; } };
}

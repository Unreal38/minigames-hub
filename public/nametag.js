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
import { avatarHtml } from './avatar.js';
import { headSpots } from './avatar3d.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, rowBg, pbRows } from './cosmetics.js';

export const tagFace = (p, name) => `${avatarHtml(p.color, p.av, 26, `ntav ${frameCls(p.fl)}`)}<span class="ntx"><b>${name ?? nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</span>`;
export const tagCls = p => ` nt${pbRowCls(p.fl)}`;
export const tagBg = p => rowBg(p.fl);

const GAP = 5, EDGE = 4;
const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function tagPlacer(box) {
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
    const heads = headSpots().map(h => ({ x: h.x + ox, y: h.y + oy, r: h.r, root: h.root }));
    const narrow = vw < 700, placed = [], taken = new Set();
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
      if (hd) { s.hox = hd.x - t.x; s.hoy = hd.y - t.y; s.hr = hd.r; }
      const hx = t.x + (s.root ? s.hox : 0), hy = t.y + (s.root ? s.hoy : 0), hr = s.root ? s.hr : 0, w = s.w * k, h = s.h * k;
      // above; beside (right, left); above but leaning right or left; a row higher (players huddled together)
      const up = hy - hr - GAP - h;
      const cands = [
        [hx - w / 2, up, 0],
        [hx + hr + GAP, hy - h / 2 - hr * .15, 1],
        [hx - hr - GAP - w, hy - h / 2 - hr * .15, 2],
        [hx - w * .15, up, 3],
        [hx - w * .85, up, 4],
        [hx - w / 2, up - h - 4, 5],
      ];
      // a tag changes side only now and then, and only for a clearly better spot: no flicking between two places
      const settled = s.side >= 0 && now - s.at < 900;
      let best = null, bc = 1e9;
      for (const [x, y, side] of cands) {
        if (settled && side !== s.side) continue;
        let c = [0, narrow ? .5 : .8, narrow ? .5 : .8, .35, .35, .7][side];
        if (side !== s.side && s.side >= 0) c += 1.2;
        // kept on screen, a tag that had to be pushed far from its head counts against that side
        const cx = Math.min(Math.max(EDGE, x), vw - w - EDGE), cy = Math.min(Math.max(EDGE, y), vh - h - EDGE), R = { x: cx, y: cy, w, h };
        c += Math.hypot(cx - x, cy - y) / Math.max(8, h) * 2.5;
        const A = w * h || 1;
        for (const b of blocks) c += area(R, b) / A * 6;
        for (const p of placed) c += area(R, p) / A * 4;
        for (const o of heads) if (o !== hd) c += area(R, { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 }) / A * 1.5;
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

// Keep scrolled lists where they were when the page redraws them.
// Kuba's report (2026-11-24): picking a pet, an item or an emote in a long list jumped the list back to the top.
// Most panels (Pet Farm pickers, Pet Lodge, My pets, Workshop swap, Wardrobe, shop) redraw with innerHTML, and a
// scrolled box that is part of the new HTML is a brand new element that starts at the top. Instead of patching
// every panel, this wraps the innerHTML setter once for the whole site: before a redraw it notes every scrolled
// box inside, after it finds the same box in the new HTML and puts it back where it was.
//
// "The same box" means: same tag, same class, same heading (the nearest h1-h3 that is a direct child of the box
// or of one of its parents inside the redrawn part, numbers left out, so "My pets (12)" still matches "My pets
// (13)") and the same position among such boxes. A panel with another heading, like a different Pet Farm window,
// starts at the top as before. The redrawn element itself is never touched: it is not replaced, so it keeps its
// own scroll, and code that sets its scrollTop on purpose (chat logs to the bottom, Wardrobe tabs to the top)
// still wins because it runs after this.
const scrolled = new Set(); // boxes the user has scrolled away from the top or left edge

addEventListener('scroll', e => {
  const t = e.target;
  if (t.nodeType !== 1) return; // the page itself: never replaced, the browser keeps it
  if (t.scrollTop || t.scrollLeft) scrolled.add(t); else scrolled.delete(t);
}, { capture: true, passive: true });

const cls = el => el.getAttribute('class') || '';
function head(el, root) {
  for (let x = el; x && x !== root; x = x.parentElement) {
    const h = x.querySelector(':scope > h1, :scope > h2, :scope > h3');
    if (h) return h.textContent.replace(/\d+/g, '').trim();
  }
  return '';
}
const twins = (root, tag, c, h) => [...root.getElementsByTagName(tag)].filter(x => cls(x) === c && head(x, root) === h);

function save(root) {
  let out = null;
  for (const el of scrolled) {
    if (!el.isConnected) { scrolled.delete(el); continue; }
    if (el === root || !root.contains(el)) continue;
    const c = cls(el), h = head(el, root);
    const n = el.id ? -1 : twins(root, el.tagName, c, h).indexOf(el);
    (out ||= []).push({ id: el.id, tag: el.tagName, c, h, n, top: el.scrollTop, left: el.scrollLeft });
  }
  return out;
}

function put(el, top, left, tries) {
  if (el.scrollTop !== top) el.scrollTop = top;
  if (el.scrollLeft !== left) el.scrollLeft = left;
  // pictures that size themselves after loading can leave the box too short for a moment: try again for a few
  // frames, but only while nobody else has moved it in between
  if (tries && (Math.abs(el.scrollTop - top) > 1 || Math.abs(el.scrollLeft - left) > 1)) {
    const at = [el.scrollTop, el.scrollLeft];
    requestAnimationFrame(() => { if (el.isConnected && el.scrollTop === at[0] && el.scrollLeft === at[1]) put(el, top, left, tries - 1); });
  }
}

function restore(root, saved) {
  for (const s of saved) {
    let el = null;
    if (s.id) { const x = root.querySelector('#' + CSS.escape(s.id)); if (x && x.tagName === s.tag && cls(x) === s.c) el = x; }
    else { const t = twins(root, s.tag, s.c, s.h); el = t[s.n] || null; }
    if (el && !el.scrollTop && !el.scrollLeft) put(el, s.top, s.left, 4);
  }
}

const inner = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
if (inner?.set && !Element.prototype.__keepScroll) {
  Object.defineProperty(Element.prototype, '__keepScroll', { value: true });
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true, enumerable: inner.enumerable,
    get: inner.get,
    set(v) {
      const saved = scrolled.size ? save(this) : null;
      inner.set.call(this, v);
      if (saved) restore(this, saved);
    },
  });
}

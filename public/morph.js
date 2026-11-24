// Patch a part of the page to new HTML, touching only what changed.
// Waiting rooms used to be rebuilt with innerHTML on every look save, seat change and coin update: the browser
// threw the whole page away, decoded every avatar picture again and the table code and seats blinked for
// everyone at the table. morph() walks the old and the new tree side by side and keeps every node that is the
// same, so a new hat on one player redraws that one avatar and nothing else.
const tpl = document.createElement('template');

function attrs(a, b) {
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of b.attributes) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
}

function patch(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b); return; }
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.isEqualNode(b)) return;
  attrs(a, b);
  kids(a, b);
}

function kids(a, b) {
  const na = [...a.childNodes], nb = [...b.childNodes];
  for (let i = 0; i < nb.length; i++) { if (i < na.length) patch(na[i], nb[i]); else a.append(nb[i]); }
  for (let i = nb.length; i < na.length; i++) na[i].remove();
}

// Make el's children match html. Returns true when anything changed.
export function morph(el, html) {
  tpl.innerHTML = html;
  const b = tpl.content, ticks = [...b.querySelectorAll('input[type=checkbox]')].map(x => x.hasAttribute('checked'));
  const same = el.childNodes.length === b.childNodes.length && [...el.childNodes].every((n, i) => n.isEqualNode(b.childNodes[i]));
  if (!same) kids(el, b);
  // a tick box keeps what the user clicked in a property the attribute compare cannot see: the new HTML wins
  const boxes = el.querySelectorAll('input[type=checkbox]');
  if (boxes.length === ticks.length) boxes.forEach((x, i) => { if (x.checked !== ticks[i]) x.checked = ticks[i]; });
  return !same;
}

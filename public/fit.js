// Keeping words whole in narrow boxes. emw(text) is how wide the longest word of the text is, in em of the bold
// display font (Rubik), with a little room to spare. A box that holds names or labels sets it as --w and shrinks the
// text only as far as its own width needs, so a long word never splits in the middle and never spills out:
//   .box { container-type: inline-size; }  .box b { font-size: max(10px, min(15px, calc(100cqi / var(--w, 6)))); }
// (cqi is a hundredth of the box's width.) Short words stay at the normal size.
const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
const memo = new Map();
export function emw(text, font = '600 100px Rubik, sans-serif') {
  const s = String(text ?? '').replace(/<[^>]*>/g, ' '), key = font + '|' + s; // markup is not text
  if (memo.has(key)) return memo.get(key);
  let w = s.length * .62; // no canvas (tests in Node): a fair guess for the display font
  if (ctx) { ctx.font = font; w = Math.max(0, ...s.split(/\s+/).map(x => ctx.measureText(x).width)) / 100; }
  const v = +(w * 1.06 + .1).toFixed(2) || 1; memo.set(key, v); return v;
}
// The style attribute for it: <b ${fitw(name)}>
export const fitw = (text, font) => `style="--w:${emw(text, font)}"`;

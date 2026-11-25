// Word Reef bots: find every play a bot could make with the words it knows, then choose one by strength.
// The search walks a letter tree along each row and column, one start square at a time, laying tray tiles on empty
// squares and running through the letters already there, and keeps a word only where every cross word it makes is
// in the full dictionary. Cross checks are worked out once per empty square per turn.
import { readPlay, land, WILD, alphabet, value } from '../../public/games/reef/rules.js';
import { has, tree } from '../reefdict.js';

// all plays for this tray: [{ tiles: [{ i, l, w }], pts, words }]
export function findPlays(B, cells, wild, rack, lang, level, cap = 4000) {
  const N = B.N, root = tree(lang, level), abc = alphabet(lang), out = [], seen = new Set();
  const first = !cells.some(Boolean);
  const L = (r, c) => (r >= 0 && c >= 0 && r < N && c < N ? cells[r * N + c] : '');
  for (const dir of ['a', 'd']) {
    const [dr, dc] = dir === 'a' ? [0, 1] : [1, 0], [pr, pc] = [dc, dr]; // pr, pc: across the line
    // which letters may go on each empty square (null = anything) given the letters above and below it
    const cross = new Map();
    const allowed = i => {
      if (cross.has(i)) return cross.get(i);
      const r = i / N | 0, c = i % N;
      let a = '', b = '';
      for (let y = r - pr, x = c - pc; L(y, x); y -= pr, x -= pc) a = L(y, x) + a;
      for (let y = r + pr, x = c + pc; L(y, x); y += pr, x += pc) b += L(y, x);
      const ok = !a && !b ? null : new Set(abc.filter(ch => has(lang, a + ch + b)));
      cross.set(i, ok); return ok;
    };
    // a square is an anchor when a tile there joins the play to the board (or it is the middle on the first turn)
    const anchor = i => {
      if (first) return i === B.mid;
      const r = i / N | 0, c = i % N;
      return !!(L(r - 1, c) || L(r + 1, c) || L(r, c - 1) || L(r, c + 1));
    };
    for (let line = 0; line < N; line++) {
      for (let s = 0; s < N; s++) {
        const r0 = dir === 'a' ? line : s, c0 = dir === 'a' ? s : line, i0 = r0 * N + c0;
        if (!land(B, i0)) continue;
        const br = r0 - dr, bc = c0 - dc; if (L(br, bc)) continue; // a word starts where the square before it is empty
        // only worth starting here when an anchor is within reach of the tray
        let reach = false, empties = 0;
        for (let r = r0, c = c0; r < N && c < N && land(B, r * N + c); r += dr, c += dc) {
          const i = r * N + c; if (!cells[i]) { if (++empties > rack.length) break; if (anchor(i)) { reach = true; break; } } else { reach = true; break; }
        }
        if (!reach) continue;
        const left = rack.slice(), placed = [];
        const walk = (r, c, node, word, touch) => {
          if (out.length >= cap) return;
          const i = r * N + c, inside = r < N && c < N && land(B, i);
          if (!inside || !cells[i]) { // the word may stop here
            if (node.end && placed.length && touch && word.length >= 2) {
              const key = placed.map(t => t.i + t.l + (t.w ? '*' : '')).sort().join();
              if (!seen.has(key)) { seen.add(key); out.push(placed.map(t => ({ ...t }))); }
            }
            if (!inside) return;
            const ok = allowed(i), hit = touch || anchor(i);
            const tried = new Set();
            for (let k = 0; k < left.length; k++) {
              const t = left[k]; if (tried.has(t)) continue; tried.add(t);
              const opts = t === WILD ? Object.keys(node.c) : [t];
              for (const ch of opts) {
                const nx = node.c[ch]; if (!nx || (ok && !ok.has(ch))) continue;
                left.splice(k, 1); placed.push({ i, l: ch, w: t === WILD ? 1 : 0 });
                walk(r + dr, c + dc, nx, word + ch, hit || (ok !== null));
                placed.pop(); left.splice(k, 0, t);
              }
            }
            return;
          }
          const nx = node.c[cells[i]]; if (!nx) return;
          walk(r + dr, c + dc, nx, word + cells[i], true);
        };
        walk(r0, c0, root, '', false);
      }
    }
  }
  const plays = [];
  for (const tiles of out) { const p = readPlay(B, cells, wild, tiles, lang); if (p.ok && p.words.every(w => has(lang, w.w))) plays.push({ tiles, pts: p.pts, words: p.words.map(w => w.w) }); }
  return plays;
}

const VOWELS = new Set('aąeęioóuy');
// how good the tiles left in the tray are: wild tiles are kept, repeats and too many or too few vowels cost
function leave(rest, lang) {
  let v = 0, s = 0; const seen = {};
  for (const l of rest) {
    if (l === WILD) { s += 8; continue; }
    if (VOWELS.has(l)) v++;
    if (seen[l]) s -= 3; seen[l] = 1;
    s -= Math.max(0, value(lang, l) - 4); // heavy letters are hard to place later
  }
  const c = rest.filter(l => l !== WILD).length - v;
  return s - Math.abs(v - c * .7) * 2;
}

// Pick a play by strength, or null to swap/pass.
//   easy: a weaker play from its small word list
//   normal: one of its three best plays
//   hard: the best play counting what it leaves in the tray
export function choose(plays, rack, lang, level) {
  if (!plays.length) return null;
  const rest = p => { const left = rack.slice(); for (const t of p.tiles) left.splice(left.indexOf(t.w ? WILD : t.l), 1); return left; };
  if (level === 'easy') { const s = plays.sort((a, b) => a.pts - b.pts), k = s.length; return s[Math.floor((.15 + Math.random() * .5) * k)]; }
  if (level === 'hard') { let best = null, bv = -1e9; for (const p of plays) { const v = p.pts + leave(rest(p), lang) * .6 + Math.random() * .5; if (v > bv) { bv = v; best = p; } } return best; }
  const s = plays.sort((a, b) => b.pts - a.pts); return s[Math.random() * Math.min(3, s.length) | 0];
}
// which tiles a bot throws back when it swaps: heavy letters, repeats and the vowels it has too many of
export function swapPick(rack, lang) {
  const keep = [], out = [];
  for (const l of rack) {
    const dup = keep.includes(l), heavy = l !== WILD && value(lang, l) >= 5;
    if (l !== WILD && (dup || heavy || keep.filter(x => VOWELS.has(x)).length >= 3 && VOWELS.has(l))) out.push(l); else keep.push(l);
  }
  return out.length ? out : rack.filter(l => l !== WILD);
}

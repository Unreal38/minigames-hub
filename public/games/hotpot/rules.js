// Shared Hot Pot rules: used by the server (authoritative) and the browser (hints & highlights).
// 6 categories x 3 ingredients x 4 copies = 72 cards. Card id -> kind = id >> 2, category = kind / 3.

export const CATS = [
  { id: 'meat',   name: 'Meat',      col: '#e5604a', deep: '#a83a26', items: ['Beef Slice', 'Pork Belly', 'Lamb Roll'] },
  { id: 'sea',    name: 'Seafood',   col: '#4a9be0', deep: '#24639e', items: ['Shrimp', 'Fish Ball', 'Squid'] },
  { id: 'veg',    name: 'Greens',    col: '#5cb85c', deep: '#357a35', items: ['Bok Choy', 'Spinach', 'Napa Cabbage'] },
  { id: 'shroom', name: 'Mushrooms', col: '#b07a52', deep: '#714529', items: ['Enoki', 'Shiitake', 'Wood Ear'] },
  { id: 'noodle', name: 'Noodles',   col: '#f0b429', deep: '#a8750a', items: ['Udon', 'Rice Cake', 'Glass Noodles'] },
  { id: 'tofu',   name: 'Tofu & Co', col: '#b98ad8', deep: '#7a4f9c', items: ['Tofu', 'Dumpling', 'Quail Egg'] },
];

export const COPIES = 4;
export const KINDS = CATS.length * 3;
export const DECK_SIZE = KINDS * COPIES;
export const HAND = 8;
export const PTS_SAME = 30;      // three identical ingredients
export const PTS_CAT = 15;       // three of the same category
export const PTS_WIN = 90;       // bonus for calling "Let's Eat!"

export const kindOf = c => c >> 2;
export const catOf = c => Math.floor((c >> 2) / 3);
export const cardName = c => CATS[catOf(c)].items[kindOf(c) % 3];
export const cardCat = c => CATS[catOf(c)];

export function setVal(t) {
  const [a, b, c] = t.map(kindOf);
  if (a === b && b === c) return PTS_SAME;
  const [x, y, z] = t.map(catOf);
  if (x === y && y === z) return PTS_CAT;
  return 0;
}

// Best disjoint sets in a hand (max 3). w adds a per-set weight (bots value set count).
export function bestSets(hand, w = 0) {
  let best = { score: 0, val: 0, sets: [] };
  const rec = (rest, sets, score) => {
    const val = score + w * sets.length;
    if (val > best.val) best = { score, val, sets: sets.slice() };
    if (sets.length === 3 || rest.length < 3) return;
    const a = rest[0], r = rest.slice(1);
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++) {
        const t = [a, r[i], r[j]], v = setVal(t);
        if (v) rec(r.filter((_, k) => k !== i && k !== j), [...sets, t], score + v);
      }
    rec(r, sets, score);
  };
  rec(hand.slice(), [], 0);
  return best;
}

// Winning hand: all 9 cards split into three sets.
export function canWin(hand) {
  if (hand.length !== 9) return false;
  const rec = r => {
    if (!r.length) return true;
    const a = r[0], x = r.slice(1);
    for (let i = 0; i < x.length; i++)
      for (let j = i + 1; j < x.length; j++)
        if (setVal([a, x[i], x[j]]) && rec(x.filter((_, k) => k !== i && k !== j))) return true;
    return false;
  };
  return rec(hand);
}

// Bot heuristic: sets + promising pairs among leftovers.
export function evalHand(hand) {
  const b = bestSets(hand, 14);
  const used = new Set(b.sets.flat());
  const rest = hand.filter(c => !used.has(c));
  let p = 0;
  for (let i = 0; i < rest.length; i++)
    for (let j = i + 1; j < rest.length; j++) {
      if (kindOf(rest[i]) === kindOf(rest[j])) p += 7;
      else if (catOf(rest[i]) === catOf(rest[j])) p += 3;
    }
  return b.val + p;
}

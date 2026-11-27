// Pet Herds rules, shared by the server and the browser: our own number-tile game for 2 to 4 players.
// 106 tiles: numbers 1 to 13 in four Pet Farm pets, two of each, plus two Mystery Eggs that stand in for any tile.
// A herd is one number in 3 or 4 different pets; a line is one pet with 3 or more numbers in a row. On your turn
// play at least one tile from your tray or draw one. You may take apart and rebuild anything on the table, as long
// as every group is a herd or a line when you press Done. Before your first play is in, you can only lay new groups
// from your own tray worth 30 or more. First to empty the tray wins the round.
//
// A tile is a number 0..105: 0..103 are pet tiles (two copies of 52), 104 and 105 are the eggs.
// The table is a list of groups { id, t: [tile, ...] } in the order they are shown.
// Pet names are the same in every language, so nothing here needs translating.
export const PETS = ['chilipup', 'zapkit', 'sproutle', 'waddlet']; // Ember, Spark, Leaf, Tide: red, gold, green, blue like their numbers
export const EL_COL = ['#d24a1f', '#a87800', '#2f8a43', '#1f74bb']; // number colour on a tile, dark enough for cream
export const N_TILES = 106, START = 14, EGG_PTS = 30, OPEN_PTS = 30;
export const TIMERS = [0, 45, 60, 90];
export const isEgg = id => id >= 104;
export const elOf = id => (id >= 104 ? -1 : ((id % 52) / 13) | 0);
export const numOf = id => (id >= 104 ? 0 : (id % 13) + 1);
export const valOf = id => (id >= 104 ? EGG_PTS : (id % 13) + 1);
export const trayValue = ids => ids.reduce((s, t) => s + valOf(t), 0);
export const byNum = (a, b) => isEgg(a) - isEgg(b) || numOf(a) - numOf(b) || elOf(a) - elOf(b) || a - b;
export const byPet = (a, b) => isEgg(a) - isEgg(b) || elOf(a) - elOf(b) || numOf(a) - numOf(b) || a - b;

// Is this group a set? Returns { kind: 'herd'|'line', order, value, n | lo, hi } with the tiles in the order they
// are shown (eggs where they stand in), or null.
export function check(ts) {
  if (!Array.isArray(ts) || ts.length < 3) return null;
  const R = ts.filter(t => !isEgg(t)), J = ts.filter(isEgg);
  if (!R.length) return { kind: 'line', order: ts.slice(), value: 0, lo: 1, hi: ts.length };
  const n0 = numOf(R[0]), e0 = elOf(R[0]);
  if (ts.length <= 4 && R.every(t => numOf(t) === n0)) {
    const els = new Set(R.map(elOf));
    if (els.size === R.length) return { kind: 'herd', order: R.slice().sort((a, b) => elOf(a) - elOf(b)).concat(J), value: n0 * ts.length, n: n0 };
  }
  if (ts.length <= 13 && R.every(t => elOf(t) === e0)) {
    const s = R.slice().sort((a, b) => numOf(a) - numOf(b));
    for (let i = 1; i < s.length; i++) if (numOf(s[i]) === numOf(s[i - 1])) return null;
    const lo = numOf(s[0]), hi = numOf(s[s.length - 1]), gaps = hi - lo + 1 - s.length;
    if (gaps > J.length) return null;
    const extra = J.length - gaps, top = Math.min(13 - hi, extra), bot = extra - top;
    if (lo - bot < 1) return null;
    const order = []; let ji = 0, value = 0, si = 0;
    for (let n = lo - bot; n <= hi + top; n++) { if (si < s.length && numOf(s[si]) === n) order.push(s[si++]); else order.push(J[ji++]); value += n; }
    return { kind: 'line', order, value, lo: lo - bot, hi: hi + top, e: e0 };
  }
  return null;
}

// Split tiles into sets: every "must" tile is used, any "opt" tile may be. Keeps the split with the most weight of
// optional tiles used. A depth-first search with a step budget and a time limit, so a huge table can never stall
// the server; it returns the best split found so far (or null when none was found).
export function solve(must, opt, { budget = 30000, ms = 18, w = t => 100 + valOf(t), seed = null } = {}) {
  const N = must.length + opt.length, tile = new Int16Array(N), isMust = new Uint8Array(N), used = new Uint8Array(N), wt = new Float64Array(N);
  must.forEach((t, i) => { tile[i] = t; isMust[i] = 1; });
  opt.forEach((t, i) => { tile[must.length + i] = t; wt[must.length + i] = w(t); });
  const reals = [], jok = [];
  for (let i = 0; i < N; i++) (isEgg(tile[i]) ? jok : reals).push(i);
  reals.sort((a, b) => numOf(tile[a]) - numOf(tile[b]) || elOf(tile[a]) - elOf(tile[b]) || isMust[b] - isMust[a]);
  jok.sort((a, b) => isMust[b] - isMust[a]);
  // by pet and number: the tiles that are that pet and number, best (must) first
  const at = Array.from({ length: 4 }, () => Array.from({ length: 14 }, () => []));
  for (const i of reals) at[elOf(tile[i])][numOf(tile[i])].push(i);
  const sets = [], end = Date.now() + ms;
  let best = null, steps = 0, cur = 0, optLeft = 0;
  if (seed) { const o = new Set(opt); best = { score: seed.flat().reduce((a, t) => a + (o.has(t) ? w(t) : 0), 0), sets: seed.map(x => x.slice()) }; }
  for (let i = 0; i < N; i++) if (!isMust[i]) optLeft += wt[i];
  const free = (e, n, but) => { for (const i of at[e][n]) if (!used[i] && i !== but) return i; return -1; };
  const freeJ = () => { const out = []; for (const j of jok) if (!used[j]) out.push(j); return out; };
  const tilesOf = s => s.map(i => tile[i]);
  function leaf() {
    const extra = sets.map(s => s.slice());
    for (const j of jok) if (isMust[j] && !used[j]) {
      const s = extra.find(x => check(tilesOf(x).concat(tile[j])));
      if (!s) return; s.push(j);
    }
    if (!best || cur > best.score) best = { score: cur, sets: extra.map(tilesOf) };
  }
  function gen(x) {
    const out = [], fj = freeJ(), e = elOf(tile[x]), n = numOf(tile[x]);
    const av = [];
    for (let e2 = 0; e2 < 4; e2++) if (e2 !== e) { const y = free(e2, n, x); if (y >= 0) av.push(y); }
    for (let mask = 0; mask < 1 << av.length; mask++) {
      const pick = av.filter((_, i) => mask >> i & 1);
      for (let j = 0; j <= Math.min(fj.length, 3 - pick.length); j++) { const size = 1 + pick.length + j; if (size >= 3 && size <= 4) out.push([x, ...pick, ...fj.slice(0, j)]); }
    }
    const ext = (seq, k, ju) => {
      if (seq.length >= 3) out.push(seq);
      else if (seq.length === 2 && fj.length > ju && check(tilesOf(seq).concat(tile[fj[ju]]))) out.push(seq.concat(fj[ju]));
      if (seq.length >= 13 || k > 13) return;
      const y = free(e, k, x);
      if (y >= 0 && !seq.includes(y)) ext(seq.concat(y), k + 1, ju);
      else if (fj.length > ju) ext(seq.concat(fj[ju]), k + 1, ju + 1);
    };
    ext([x], n + 1, 0);
    return out.sort((a, b) => b.length - a.length);
  }
  function rec(k) {
    if (++steps > budget || (steps & 255) === 0 && Date.now() > end) { steps = budget + 1; return; }
    while (k < reals.length && used[reals[k]]) k++;
    if (k === reals.length) return leaf();
    if (best && cur + optLeft <= best.score) return;
    const x = reals[k];
    for (const c of gen(x)) {
      let add = 0; for (const y of c) if (!isMust[y]) add += wt[y];
      for (const y of c) { used[y] = 1; if (!isMust[y]) optLeft -= wt[y]; }
      sets.push(c); cur += add;
      rec(k + 1);
      cur -= add; sets.pop(); for (const y of c) { used[y] = 0; if (!isMust[y]) optLeft += wt[y]; }
      if (steps > budget) return;
    }
    if (!isMust[x]) { used[x] = 1; optLeft -= wt[x]; rec(k + 1); used[x] = 0; optLeft += wt[x]; }
  }
  rec(0);
  return best;
}

// A group after tiles were added or taken out: one set in order, or a clean split into sets, or (for one pet without
// eggs) runs of numbers in a row, or else the tiles sorted. Gives the list of new groups' tiles.
export function tidy(ts) {
  if (!ts.length) return [];
  const c = check(ts);
  if (c) return [c.order];
  if (ts.length <= 16) {
    const s = solve(ts, [], { budget: 4000, ms: 6 });
    if (s && s.sets.length > 1) return s.sets.map(x => check(x).order).sort((a, b) => numOf(a.find(t => !isEgg(t)) ?? 0) - numOf(b.find(t => !isEgg(t)) ?? 0));
  }
  const R = ts.filter(t => !isEgg(t));
  if (R.length === ts.length && R.every(t => elOf(t) === elOf(R[0]))) {
    const s = R.slice().sort(byNum), out = [[s[0]]];
    for (let i = 1; i < s.length; i++) { if (numOf(s[i]) === numOf(s[i - 1]) + 1) out[out.length - 1].push(s[i]); else out.push([s[i]]); }
    return out;
  }
  return [ts.slice().sort(byNum)];
}

const sig = ts => ts.slice().sort((a, b) => a - b).join(',');
export const tilesOn = table => table.flatMap(g => g.t);

// Move tiles during a turn. W = { table, rack, nid } (the working table and tray of the player whose turn it is),
// mine = the tiles that were in their tray when the turn began (only those may go back to the tray),
// locked = true before their first play (table tiles from earlier turns can't be touched).
// to: a group id, 'new' or 'rack'. Returns the new W, or null when the move isn't allowed.
export function move(W, ids, to, mine, locked) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 40 || new Set(ids).size !== ids.length) return null;
  const where = new Map();
  W.rack.forEach(t => where.set(t, 'rack'));
  W.table.forEach(g => g.t.forEach(t => where.set(t, g.id)));
  if (ids.some(t => !Number.isInteger(t) || !where.has(t))) return null;
  if (locked && ids.some(t => where.get(t) !== 'rack' && !mine.has(t))) return null;
  if (to === 'rack') { if (ids.some(t => !mine.has(t))) return null; }
  else if (to !== 'new' && !W.table.some(g => g.id === to)) return null;
  else if (locked && to !== 'new' && W.table.find(g => g.id === to).t.some(t => !mine.has(t))) return null;
  let nid = W.nid;
  const moving = to === 'rack' || to === 'new' ? ids : ids.filter(t => where.get(t) !== to);
  if (!moving.length) return null;
  const set = new Set(moving);
  const rack = W.rack.filter(t => !set.has(t));
  const table = [];
  for (const g of W.table) {
    const keep = g.t.filter(t => !set.has(t));
    if (keep.length === g.t.length) { table.push(g); continue; }
    tidy(keep).forEach((t, i) => table.push({ id: i ? ++nid : g.id, t }));
  }
  if (to === 'rack') rack.push(...moving);
  else if (to === 'new') tidy(moving).forEach(t => table.push({ id: ++nid, t }));
  else {
    const gi = table.findIndex(g => g.id === to), g = table[gi];
    table.splice(gi, 1, ...tidy(g.t.concat(moving)).map((t, i) => ({ id: i ? ++nid : g.id, t })));
  }
  return { table, rack, nid };
}

// Can the turn end with this table? snap = { table, rack } as the turn began. Returns
// { ok, why: 'none'|'bad'|'mixed'|'low'|'', placed, bad, val }.
export function turnCheck(snap, W, opened, open = OPEN_PTS) {
  const mine = new Set(snap.rack), placed = tilesOn(W.table).filter(t => mine.has(t)).length;
  const bad = W.table.filter(g => !check(g.t)).length;
  let val = 0, mixed = false;
  if (!opened) {
    const orig = new Set(snap.table.map(g => sig(g.t)));
    for (const g of W.table) {
      if (orig.has(sig(g.t))) continue;
      if (g.t.every(t => mine.has(t))) val += check(g.t)?.value || 0; else mixed = true;
    }
  }
  const out = { ok: false, why: '', placed, bad, val };
  if (!placed) out.why = 'none';
  else if (bad) out.why = 'bad';
  else if (!opened && mixed) out.why = 'mixed';
  else if (!opened && val < open) out.why = 'low';
  else out.ok = true;
  return out;
}

// Where each group may go: a set that the given tiles (all at once) can join, the tray tile staying a set after.
export function fits(table, ids, mine, locked) {
  const out = [];
  for (const g of table) {
    if (ids.some(t => g.t.includes(t))) continue;
    if (locked && g.t.some(t => !mine.has(t))) continue;
    if (tidy(g.t.concat(ids)).every(x => check(x))) out.push(g.id);
  }
  return out;
}

// ---------- bots ----------
// The quick way to play: new sets from the tray, then single tray tiles added to a group (which may split it, like a
// 5 dropped on 3-4-5-6-7), then two tray tiles plus a spare end tile of a long group. Returns { sets, left }.
function greedy(groups, rack, B, rnd) {
  groups = groups.map(g => g.slice());
  let left = rack.slice();
  const own = solve([], rack, { budget: Math.min(B.budget, 3000), ms: 6 });
  if (own) for (const x of own.sets) { groups.push(x); left = left.filter(t => !x.includes(t)); }
  for (let pass = 0; pass < 2; pass++) for (const t of left.slice()) {
    if (rnd() < B.miss) continue;
    for (let i = 0; i < groups.length; i++) {
      const parts = tidy(groups[i].concat(t));
      if (parts.every(p => check(p))) { groups.splice(i, 1, ...parts); left = left.filter(y => y !== t); break; }
    }
  }
  // two tray tiles and one tile taken off the end of a group that stays a set without it
  for (let a = 0; a < left.length; a++) for (let b = a + 1; b < left.length; b++) {
    if (rnd() < B.miss) continue;
    let done = false;
    for (let i = 0; i < groups.length && !done; i++) {
      const g = check(groups[i]); if (!g || groups[i].length < 4) continue;
      for (const k of [0, g.order.length - 1]) {
        const take = g.order[k], rest = g.order.filter((_, j) => j !== k);
        if (!check(rest) || !check([left[a], left[b], take])) continue;
        groups.splice(i, 1, rest, [left[a], left[b], take]); left = left.filter(y => y !== left[a] && y !== left[b]); done = true; break;
      }
    }
    if (done) { a = -1; break; }
  }
  return { sets: groups, left };
}
// chill: lays new groups from its tray and adds single tiles to the ends of groups, never rebuilds the table;
// sharp: rebuilds the whole table when that plays more, keeps its eggs unless they help, and holds a few tiles
// back when it can't go out (hold: the chance per turn to play only part of what it found).
export const BOT_LEVELS = {
  chill: { rebuild: true, budget: 600, miss: .3, hold: .5 },
  sharp: { rebuild: true, budget: 40000, miss: 0, hold: .2 },
};
// Returns the new table (groups that did not change keep their ids, new ones get ids from nid) or null to draw.
export function botPlay(table, rack, opened, open, level, nid, rnd = Math.random) {
  const B = typeof level === 'object' ? level : BOT_LEVELS[level] || BOT_LEVELS.chill;
  let sets = null;
  if (!opened) {
    const s = solve([], rack, { budget: B.budget, w: t => (isEgg(t) ? 3 : valOf(t)) });
    if (!s || !s.sets.length) return null;
    const val = s.sets.reduce((a, x) => a + check(x).value, 0);
    if (val < open) return null;
    sets = table.map(g => g.t).concat(s.sets);
  } else {
    const g = greedy(table.map(g => g.t), rack, B, rnd);
    sets = g.sets;
    if (B.rebuild && g.left.length) { // a deeper search may play more by rebuilding the whole table; it starts from what greedy found
      const s = solve(tilesOn(table), rack, { budget: B.budget, w: t => (isEgg(t) ? 20 : 100 + valOf(t)), seed: sets });
      if (s) sets = s.sets;
    }
    const usedN = rack.filter(t => sets.some(x => x.includes(t))).length;
    if (!usedN) return null;
    if (usedN < rack.length && B.hold && rnd() < B.hold) { // hold back: when it can't go out, sometimes lay only its first new set
      const own = solve([], rack, { budget: 2000, w: t => (isEgg(t) ? 2 : 100 + valOf(t)) });
      if (own && own.sets.length) sets = table.map(g => g.t).concat(own.sets.slice(0, 1));
    }
  }
  // keep ids of groups that did not change; changed or new groups get fresh ids at the end
  const old = new Map(table.map(g => [sig(g.t), g]));
  const out = [], fresh = [];
  for (const x of sets) {
    const o = old.get(sig(x));
    if (o) { out.push({ id: o.id, t: o.t.slice() }); old.delete(sig(x)); } else fresh.push(x);
  }
  out.sort((a, b) => table.findIndex(g => g.id === a.id) - table.findIndex(g => g.id === b.id));
  for (const x of fresh) out.push({ id: ++nid, t: check(x).order });
  return { table: out, nid };
}

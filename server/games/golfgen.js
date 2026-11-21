// Mini Golf Party: makes a new hole out of random parts. A hole is stacked from the tee (bottom) to the green (top):
// a tee box, one to three obstacle sections and a green. Each part sits in its own lane of columns, so the fairway
// bends and narrows, and parts can sit on different levels joined by ramps. The result has the same shape as the
// hand-made entries in HOLES (course.js); golf.js checks it can be played and works out the par.
const W = 9, MAX_ROWS = 14;
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = a => a[ri(0, a.length - 1)], chance = p => Math.random() < p;
const line = (a, b, ch = '.') => '#'.repeat(a) + ch.repeat(b - a + 1) + '#'.repeat(W - 1 - b);
const put = (s, c, ch) => s.slice(0, c) + ch + s.slice(c + 1);

// a lane `w` wide that shares at least three columns (or all it can) with the one below
function lane(prev, w) {
  const need = prev ? Math.min(3, w, prev[1] - prev[0] + 1) : 0, opts = [];
  for (let a = 0; a + w <= W; a++) if (!prev || Math.min(a + w - 1, prev[1]) - Math.max(a, prev[0]) + 1 >= need) opts.push([a, a + w - 1]);
  return pick(opts);
}

// Each part returns its rows from the far side to the near side. The first and last row are always plain fairway
// across the whole lane, so parts join up whatever is inside them.
const PARTS = {
  mill: { w: [3, 3, 5], make([a, b]) {
    const w = b - a + 1;
    return { rows: [line(a, b), line(a, b), line(a, b)], spin: [{ c: (a + b) / 2, r: 1, hl: w === 3 ? 1.1 : 1.7, w: (chance(.5) ? 1 : -1) * (1.15 + Math.random() * .5) }] };
  } },
  water: { w: [5, 5, 7], make([a, b]) {
    const bw = b - a + 1 === 7 && chance(.6) ? 2 : 1, c = ri(a + (chance(.5) ? 0 : 1), b - bw - (chance(.5) ? 0 : 1) + 1);
    let wr = line(a, b, 'w'); for (let k = 0; k < bw; k++) wr = put(wr, c + k, '.');
    return { rows: [line(a, b), wr, ...(chance(.5) ? [wr] : []), line(a, b)] };
  } },
  pond: { w: [5, 7], make([a, b]) { // water in the middle, a path down each side
    const m = b - a + 1 === 7 ? 3 : 1, c = a + (b - a + 1 - m) / 2;
    let wr = line(a, b); for (let k = 0; k < m; k++) wr = put(wr, c + k, 'w');
    return { rows: [line(a, b), wr, ...(chance(.4) ? [wr] : []), line(a, b)] };
  } },
  posts: { w: [5, 7], make([a, b]) {
    const rows = [line(a, b), line(a, b), line(a, b), line(a, b)], off = ri(0, 1);
    for (let r = 0; r < 3; r++) for (let c = a + 1 + ((r + off) % 2); c < b; c += 2) rows[r] = put(rows[r], c, 'o');
    rows[3] = line(a, b);
    return { rows: [line(a, b), ...rows.slice(0, 3), line(a, b)].slice(chance(.5) ? 0 : 1) };
  } },
  sand: { w: [3, 5, 7], make([a, b]) {
    const rows = [line(a, b), line(a, b), line(a, b), line(a, b)], n = b - a + 1 >= 5 ? 2 : 1;
    for (let k = 0; k < n; k++) { const c = ri(a, b - 1), r = ri(1, 2); rows[r] = put(put(rows[r], c, 's'), c + 1, 's'); if (chance(.5)) rows[3 - r] = put(rows[3 - r], c + ri(0, 1), 's'); }
    return { rows };
  } },
  baffle: { w: [5, 7], make([a, b]) { // a wall right across with a gap at one end, then another with the gap at the other end
    const gap = b - a + 1 === 7 ? ri(2, 3) : 2, left = chance(.5);
    const wall = l => (l ? line(a, a + gap - 1) : line(b - gap + 1, b));
    return { rows: chance(.55) ? [line(a, b), wall(left), line(a, b), line(a, b), wall(!left), line(a, b)] : [line(a, b), wall(left), line(a, b)] };
  } },
  island: { w: [5, 7], make([a, b]) { // a block in the middle to go round
    const m = b - a + 1 - 4, ch = chance(.3) ? 's' : '#';
    let r = line(a, b); for (let k = 0; k < m; k++) r = put(r, a + 2 + k, ch);
    return { rows: [line(a, b), r, r, line(a, b)] };
  } },
  open: { w: [3, 5], make([a, b]) {
    const rows = [line(a, b), line(a, b), line(a, b)];
    if (b - a + 1 === 5 && chance(.7)) rows[1] = put(rows[1], ri(a + 1, b - 1), 'o');
    return { rows };
  } },
};
const ADJ = { mill: 'Windy', water: 'Soggy', pond: 'Misty', posts: 'Bumpy', sand: 'Sandy', baffle: 'Twisty', island: 'Loopy', open: 'Breezy', ramp: 'Steep', hill: 'Lofty' };
const NOUN = { mill: 'Mill', water: 'Crossing', pond: 'Pond', posts: 'Arcade', sand: 'Dunes', baffle: 'Maze', island: 'Roundabout', open: 'Lane', ramp: 'Steps', hill: 'Summit' };

export function genSpec() {
  const tags = [], secs = []; // sections from the tee upwards: { rows, lane, level, spin }
  // tee box
  let ln = lane(null, pick([3, 5, 5])), level = 0;
  { const [a, b] = ln, t = [line(a, b), put(line(a, b), ri(a + (b - a > 2 ? 1 : 0), b - (b - a > 2 ? 1 : 0)), 'T'), line(a, b)]; secs.push({ rows: t, lane: ln, level }); }
  let rows = 3;
  const names = Object.keys(PARTS).sort(() => Math.random() - .5), n = pick([1, 2, 2, 2, 3, 3]);
  const step = (next) => { // maybe change level on the way into the next part, over a ramp as wide as the overlap allows
    if (rows >= MAX_ROWS - 4 || !chance(.3)) return;
    const a = Math.max(ln[0], next[0]), b = Math.min(ln[1], next[1]); if (b - a < 1) return;
    const w = Math.min(3, b - a + 1), s = a + ri(0, b - a + 1 - w);
    level += level === 0 ? 1 : level >= 2 ? -1 : pick([-1, 1]);
    secs.push({ rows: [line(s, s + w - 1, 'r')], lane: [s, s + w - 1], level, ramp: true }); rows++; tags.push('ramp');
  };
  for (let k = 0; k < n && rows < MAX_ROWS - 5; k++) {
    const id = names[k], P = PARTS[id], next = lane(ln, pick(P.w));
    step(next);
    const part = P.make(next);
    if (rows + part.rows.length > MAX_ROWS - 3) break;
    secs.push({ rows: part.rows, lane: next, level, spin: part.spin }); rows += part.rows.length; ln = next; tags.push(id);
  }
  // green: flat, or the cup up on a little hill
  const hill = rows <= MAX_ROWS - 5 && chance(.25), gl = lane(ln, hill ? pick([5, 7]) : pick([3, 5, 5, 7]));
  step(gl);
  const [a, b] = gl, cc = ri(a + 1, b - 1);
  let green, bump = null;
  if (hill) {
    green = [line(a, b), put(line(a, b), cc, 'r'), put(put(put(line(a, b), cc - 1, 'R'), cc, 'H'), cc + 1, 'R'), put(line(a, b), cc, 'r'), line(a, b)];
    bump = { r: 2, c: cc }; tags.push('hill');
  } else {
    green = [line(a, b), put(line(a, b), cc, 'H'), line(a, b)];
    if (b - a + 1 >= 5 && chance(.35)) green[2] = put(green[2], cc === a + 1 ? b - 1 : a + 1, 's');
  }
  secs.push({ rows: green, lane: gl, level, bump });
  // stack it up, far side first
  const map = [], lv = [], spin = [];
  for (const s of secs.reverse()) {
    const r0 = map.length;
    for (const r of s.rows) { map.push(r); lv.push(String(s.level).repeat(W)); }
    for (const sp of s.spin || []) spin.push({ ...sp, r: r0 + sp.r });
    if (s.bump) lv[r0 + s.bump.r] = put(lv[r0 + s.bump.r], s.bump.c, String(s.level + 1));
  }
  // trim empty columns so the hole sits in the middle
  let c0 = W, c1 = 0;
  for (const r of map) for (let c = 0; c < W; c++) if (r[c] !== '#') { c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  const feat = [...new Set(tags)].sort(() => Math.random() - .5);
  const name = feat.length >= 2 ? `${ADJ[feat[0]]} ${NOUN[feat[1]]}` : feat.length ? `${pick(['Little', 'Old', 'Lucky', 'Sunny'])} ${NOUN[feat[0]]}` : 'Easy Street';
  return { name, par: 3, map: map.map(r => r.slice(c0, c1 + 1)), lv: lv.map(r => r.slice(c0, c1 + 1)), spin: spin.map(s => ({ ...s, c: s.c - c0 })), tags: feat };
}

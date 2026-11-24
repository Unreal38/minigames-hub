// Match colours: every game paints a player's markers, pieces, rings and name chips with seat.color,
// which is also their avatar's top colour. When two seats wear the same or a very similar colour,
// the later one gets a clearly different colour for this match only (their saved look is untouched).
// Runs on the server, so every client sees the same colours.

// Replacement colours: bright, far apart in hue, readable on the day and the night table.
export const MATCH_COLS = ['#ff5a5f', '#4d9fff', '#ffd23f', '#43c96b', '#b07cff', '#ff9a3c', '#2fd0c4', '#ff6fb5', '#c79a6b', '#f2f2f2'];

const lab = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); const n = m ? parseInt(m[1], 16) : 0x999999;
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((r * .4124 + g * .3576 + b * .1805) / .95047), y = f(r * .2126 + g * .7152 + b * .0722), z = f((r * .0193 + g * .1192 + b * .9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
// Perceived difference (CIE76 in Lab). Below CLOSE two colours read as "the same" at a glance on a busy board.
export const colDist = (a, b) => { const x = lab(a), y = lab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
export const CLOSE = 32;
const hexOk = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// The replacement furthest from every colour already taken (first one wins a tie, so it is deterministic).
function freshCol(taken) {
  let best = MATCH_COLS[0], bd = -1;
  for (const c of MATCH_COLS) { const d = Math.min(Infinity, ...taken.map(t => colDist(t, c))); if (d > bd + .01) { bd = d; best = c; } }
  return best;
}

// colours in seat order -> colours with no two closer than CLOSE. Earlier entries keep theirs.
export function distinctCols(cols) {
  const out = [];
  for (const c of cols) out.push(hexOk(c) && !out.some(t => colDist(t, c) < CLOSE) ? c : freshCol(out));
  return out;
}

// Fix G.seats in place. Safe to call on every state send: seats that already got their match colour keep it,
// and only a seat that is new or changed (a bot handed to a joining player, a rejoin) may be moved off a clash.
// People win over bots: a bot never makes a person change colour.
export function matchColors(G) {
  const seats = G?.seats; if (!Array.isArray(seats) || seats.length < 2) return;
  const mc = G.mc ||= []; // per seat: { k: who sat there, own: their own colour, got: colour given for the match }
  if (seats.some(s => !s || typeof s !== 'object')) return;
  const info = seats.map((s, i) => {
    const k = s.id || (s.bot ? 'b:' + (s.name || i) : 'x:' + i), was = mc[i];
    const settled = !!was && was.k === k && hexOk(s.color) && s.color === was.got;
    return { i, s, k, settled, own: settled ? was.own : s.color, want: s.color, person: !s.bot };
  });
  const order = [...info].sort((a, b) => (b.person - a.person) || (b.settled - a.settled) || (a.i - b.i));
  const taken = [];
  for (const x of order) {
    const c = hexOk(x.want) && !taken.some(t => colDist(t, x.want) < CLOSE) ? x.want : freshCol(taken);
    taken.push(c);
    if (x.s.color !== c) x.s.color = c;
    mc[x.i] = { k: x.k, own: x.own, got: c };
  }
  mc.length = seats.length;
}

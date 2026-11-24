// Mahjong Race: everyone gets the same board of tiles, dealt the same way, and clears it on their own screen at
// the same time. Two free tiles with the same picture make a pair. The first to clear the board wins; the rest are
// placed by how many tiles they have left. A racer with no pair left has their tiles mixed and waits a moment.
// Each browser plays its own board with the shared rules (rules.js) and reports every pair; the server checks it
// on its own copy, so progress and the finish are decided here.
import { layout, deal, reshuffle, canPair, findMove, pairs, tilesLeft, kindsFor, RACE, SHUFFLE_HOLD, RACE_MAX } from '../../public/games/mahj/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'mahj', name: 'Mahjong Race', minPlayers: 1, maxPlayers: 4, seats: { lo: 2, def: 4 }, joinAt: 'game' };

const COUNT_MS = 3600;
const BOT_NAMES = ['Noodle', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Biscuit', 'Maple'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const BOT = { chill: { ms: 5200 }, sharp: { ms: 3300 } }; // a bot takes a pair about every ms (people manage one every 3 to 5 seconds)
const rnd = n => (Math.random() * n) | 0;

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    size: ['short', 'normal', 'long'].includes(o.size) ? o.size : 'normal',
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.seats, seats.length)) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const now = Date.now(), ids = RACE[opts.size], id = ids[rnd(ids.length)], lay = layout(id), start = deal(lay, kindsFor(lay), rnd);
  return {
    game: 'mahj', ph: 'play', stage: 'count', gid: Math.random().toString(36).slice(2, 8), seats, opts, lay: id,
    startAt: now, goAt: now + COUNT_MS,
    b: seats.map(() => start.slice()),
    x: seats.map(() => ({ sync: 0, n: 0, left: lay.n, holdTo: 0, mixes: 0, stuck: false, doneAt: 0, lastAt: 0, place: 0, botAt: now + COUNT_MS + 1200 + Math.random() * 1500 })),
    ev: [], evN: 0, res: null, win: -1, endAt: 0, dirty: true,
  };
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 30) G.ev.shift(); }
const playing = (G, s) => G.seats[s].human && !G.seats[s].bot; // a person at the controls right now
const racing = G => G.seats.map((_, i) => i).filter(i => !G.x[i].stuck && !G.x[i].doneAt);

// ---------- one pair off somebody's board (a person's or a bot's) ----------
function take(G, s, i, j, now) {
  const b = G.b[s], x = G.x[s], lay = layout(G.lay);
  b[i] = b[j] = -1; x.n++; x.left -= 2; x.lastAt = now - G.goAt; G.dirty = true;
  if (!x.left) { x.doneAt = Math.max(1, now - G.goAt); pushEv(G, { t: 'done', s }); return; }
  if (findMove(lay, b)) return;
  // no pair left: the tiles are mixed (always into a board that can be cleared) and the racer waits a moment
  const mixed = reshuffle(lay, b, rnd);
  if (!mixed) { x.stuck = true; x.sync++; pushEv(G, { t: 'stuck', s }); return; }
  G.b[s] = mixed; x.sync++; x.mixes++; x.holdTo = now + SHUFFLE_HOLD; x.botAt = Math.max(x.botAt, x.holdTo + 600); pushEv(G, { t: 'mix', s });
}

function botStep(G, s, now) {
  const x = G.x[s]; if (now < x.botAt || now < x.holdTo) return;
  const lvl = BOT[G.seats[s].human ? 'chill' : G.opts.bots], opts = pairs(layout(G.lay), G.b[s]);
  x.botAt = now + lvl.ms * (.6 + Math.random() * .8);
  if (opts.length) { const [i, j] = opts[rnd(opts.length)]; take(G, s, i, j, now); }
}

// ---------- the clock ----------
export function fast(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'count') {
    if (now >= G.goAt) { G.stage = 'go'; pushEv(G, { t: 'go' }); G.dirty = true; }
    return flush(G);
  }
  for (const s of racing(G)) if (!playing(G, s)) botStep(G, s, now);
  // over when somebody clears their board, when nobody can go on, when no person is left racing, or when time is up
  const left = racing(G);
  if (G.x.some(x => x.doneAt) || !left.length || !left.some(s => playing(G, s)) || now - G.goAt > RACE_MAX) finish(G, now);
  return flush(G);
}
function flush(G) { const d = G.dirty; G.dirty = false; return d; }

function finish(G, now) {
  // a cleared board first, then the fewest tiles left, then whoever made their last pair sooner
  const order = G.seats.map((_, i) => i).sort((a, b) => (G.x[b].doneAt ? 1 : 0) - (G.x[a].doneAt ? 1 : 0) || G.x[a].doneAt - G.x[b].doneAt || G.x[a].left - G.x[b].left || G.x[a].lastAt - G.x[b].lastAt || a - b);
  order.forEach((s, i) => { G.x[s].place = i + 1; });
  G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.win = order[0];
  G.res = { order, pairs: G.x.map(x => x.n), left: G.x.map(x => x.left), mixes: G.x.map(x => x.mixes), time: G.x.map(x => x.doneAt), cleared: !!G.x[order[0]].doneAt, ms: Math.max(0, now - G.goAt) };
  pushEv(G, { t: 'end', w: G.win }); G.dirty = true;
}

// ---------- what people send ----------
// { t: 'p', y0: sync, n: pairs so far + 1, a, b }: the pair of tiles a and b.
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || !playing(G, s) || G.ph !== 'play' || G.stage !== 'go') return false;
  const x = G.x[s], now = Date.now();
  if (x.stuck || x.doneAt || a.t !== 'p' || a.y0 !== x.sync) return false; // sent before the browser took the server's copy: stale
  const resync = () => { x.sync++; G.dirty = true; return false; };
  if (a.n !== x.n + 1 || now < x.holdTo - 250) return resync();
  if (!canPair(layout(G.lay), G.b[s], a.a, a.b)) return resync();
  take(G, s, a.a, a.b, now);
  return false; // fast() sends it on its next beat
}

export function tick() { return false; } // fast() does the work

// A player who drops out keeps their board; a bot plays it until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; G.x[s].sync++; G.x[s].botAt = Date.now() + 1500; G.dirty = true;
  return true;
}

export function view(G, s) {
  const now = Date.now();
  // somebody watching sees the board of whoever is ahead
  const show = s >= 0 ? s : G.seats.map((_, i) => i).sort((a, b) => G.x[a].left - G.x[b].left || a - b)[0];
  const x = G.x[show];
  return {
    game: 'mahj', ph: G.ph, stage: G.stage, gid: G.gid, me: s, lay: G.lay, size: G.opts.size, t: now - G.goAt,
    seats: G.seats.map(p => ({ name: p.name, color: p.color, av: p.av, bot: p.bot, human: p.human, id: p.id })),
    x: G.x.map(q => [q.left, q.n, q.stuck ? 1 : 0, q.doneAt, q.place, q.mixes]),
    show, mine: { sync: x.sync, n: x.n, b: G.b[show], hold: Math.max(0, x.holdTo - now), stuck: x.stuck },
    ev: G.ev, res: G.res, win: G.win,
  };
}

// Per-seat outcome: placed by who cleared the board first, then by tiles left; a point for every pair.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((_, i) => ({ pts: G.x[i].n, win: G.x[i].place === 1, place: G.x[i].place }));
}

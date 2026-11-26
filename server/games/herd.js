// Pet Herds: our own number-tile game for 2 to 4 players (rules in public/games/herd/rules.js). The server keeps
// every tray hidden: a player only ever gets their own tiles and the others' tile counts. The table is public,
// and so is the working table while someone rebuilds it on their turn, so everyone watches the moves live.
// A turn's moves are checked one by one (move()), and Done is accepted only when every group is a set
// (turnCheck()); running out of time puts the table back and draws a tile.
import { N_TILES, START, OPEN_PTS, TIMERS, check, move, turnCheck, botPlay, tilesOn, trayValue, byNum, isEgg } from '../../public/games/herd/rules.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'herd', name: 'Pet Herds', minPlayers: 1, maxPlayers: 4, seats: { lo: 2, def: 4 } };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// deal; how long a round's score stays up before the next deal; how long bots think before they play
export const MS = { deal: 2200, round: 9000 };
export const THINK = { chill: [1500, 2600], sharp: [1100, 2000] };

const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: TIMERS.includes(+o.timer) ? +o.timer : 60,
    open: +o.open === 0 ? 0 : OPEN_PTS, // points the first play must be worth (0: no first-play rule)
    hints: o.hints === 'off' || o.hints === false ? 'off' : 'on', // a picked tile lights up the groups it fits
    rounds: +o.rounds === 3 ? 3 : 1,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  const n = Math.max(opts.seats, seats.length, 2);
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const G = {
    game: 'herd', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    round: 0, total: seats.map(() => 0), rd: null, hist: [],
    st: seats.map(() => ({ played: 0, drawn: 0, rebuilt: 0, outs: 0 })),
    ev: [], evN: 0, mv: 0, res: null, win: -1, endAt: 0,
  };
  deal(G, Date.now(), Math.random() * n | 0);
  return G;
}

function deal(G, now, first) {
  G.round++;
  G.pool = shuffle(Array.from({ length: N_TILES }, (_, i) => i));
  G.racks = G.seats.map(() => G.pool.splice(0, START).sort(byNum));
  G.opened = G.seats.map(() => !G.opts.open);
  G.table = []; G.nid = 0; G.W = null; G.snap = null; G.passes = 0; G.rd = null; G.last = null;
  G.turn = first; G.stage = 'deal'; G.stageEnd = now + MS.deal; G.tEnd = 0; G.botAt = 0;
  pushEv(G, { t: 'deal', round: G.round, s: first });
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const think = G => rnd(...(THINK[G.opts.bots] || THINK.chill));
const lvOf = (G, s) => G.lvl?.[s] || G.opts.bots; // G.lvl: a level per seat (tests pit chill against sharp)

function startTurn(G, s, now) {
  G.turn = s; G.stage = 'turn'; G.mv++;
  G.snap = { table: G.table.map(g => ({ id: g.id, t: g.t.slice() })), rack: G.racks[s].slice() };
  G.W = { table: G.snap.table.map(g => ({ id: g.id, t: g.t.slice() })), rack: G.racks[s].slice(), nid: G.nid };
  G.tEnd = G.opts.timer && !G.seats[s].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + think(G);
  return true;
}
const nextSeat = G => (G.turn + 1) % G.seats.length;

// The working table becomes the table: tiles that went down leave the tray, and the turn passes on.
function commit(G, s, now, by) {
  const before = new Map(G.table.map(g => [g.id, g.t.join()])), onT = new Set(tilesOn(G.W.table));
  const placed = G.racks[s].filter(t => onT.has(t));
  const groups = G.W.table.filter(g => before.get(g.id) !== g.t.join()).map(g => g.id);
  const rebuilt = G.table.some(g => !G.W.table.some(h => h.id === g.id && h.t.join() === g.t.join()) && g.t.some(t => !placed.includes(t)));
  const first = !G.opened[s];
  G.table = G.W.table; G.nid = G.W.nid; G.racks[s] = G.racks[s].filter(t => !onT.has(t)); G.opened[s] = true;
  G.W = null; G.snap = null; G.passes = 0; G.mv++;
  const st = G.st[s]; st.played += placed.length; if (rebuilt) st.rebuilt++;
  G.last = { t: 'play', s, tiles: placed, groups, mv: G.mv };
  pushEv(G, { t: 'play', s, tiles: placed, groups, rebuilt, first, by });
  if (!G.racks[s].length) return endRound(G, s, now);
  return startTurn(G, nextSeat(G), now);
}
// No play: the table goes back as it was and the player takes a tile (or passes when the pile is empty).
function drawTile(G, s, now, why = 'draw') {
  G.W = null; G.snap = null; G.mv++;
  if (G.pool.length) {
    const t = G.pool.pop(); G.racks[s].push(t); G.racks[s].sort(byNum); G.st[s].drawn++; G.passes = 0;
    G.last = { t: 'draw', s, mv: G.mv };
    pushEv(G, { t: why, s, drew: true });
  } else {
    G.passes++;
    G.last = { t: 'pass', s, mv: G.mv };
    pushEv(G, { t: why, s, drew: false });
    if (G.passes >= G.seats.length) return endRound(G, -1, now); // nobody can play and the pile is empty
  }
  return startTurn(G, nextSeat(G), now);
}

// A round ends when someone empties their tray (out >= 0) or nobody can play (out = -1): the smallest tray wins it.
// Each loser pays the value of their tray; the winner (or the winners, sharing) gets what the others pay.
function endRound(G, out, now) {
  const vals = G.racks.map(trayValue), low = Math.min(...vals);
  const wins = G.seats.map((_, i) => i).filter(i => (out >= 0 ? i === out : vals[i] === low));
  const paid = vals.reduce((a, v, i) => a + (wins.includes(i) ? 0 : v), 0);
  const pts = G.seats.map((_, i) => (wins.includes(i) ? Math.floor(paid / wins.length) : -vals[i]));
  pts.forEach((p, i) => { G.total[i] += p; });
  if (out >= 0) G.st[out].outs++;
  G.rd = { out, wins, vals, pts, racks: G.racks.map(r => r.slice()), round: G.round };
  G.hist.push(pts);
  G.W = null; G.snap = null; G.tEnd = 0; G.mv++;
  pushEv(G, { t: 'round', out, wins, pts, round: G.round });
  if (G.round >= G.opts.rounds) return finish(G);
  G.stage = 'round'; G.stageEnd = now + MS.round; G.turn = -1;
  return true;
}

function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = Date.now();
  const order = G.seats.map((_, i) => i).sort((a, b) => G.total[b] - G.total[a] || G.rd.vals[a] - G.rd.vals[b] || a - b);
  const place = G.seats.map((_, i) => 1 + G.seats.filter((__, j) => G.total[j] > G.total[i]).length); // equal points share the place
  G.win = order[0];
  G.res = { order, place, total: G.total.slice(), n: G.seats.length };
  pushEv(G, { t: 'end', w: G.win, tie: place.filter(p => p === 1).length > 1 });
  return true;
}

// ---------- bots ----------
export function botTurn(G, s, now, level = lvOf(G, s)) {
  if (G.stage !== 'turn' || G.turn !== s) return false;
  const r = botPlay(G.table, G.racks[s], G.opened[s], G.opts.open, level, G.nid);
  if (!r) return drawTile(G, s, now);
  G.W = { table: r.table, rack: G.racks[s].filter(t => !tilesOn(r.table).includes(t)), nid: r.nid };
  G.snap = G.snap || { table: G.table, rack: G.racks[s].slice() };
  return commit(G, s, now, 'bot');
}
export { botTurn as _bot };

// ---------- people ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage !== 'turn' || G.turn !== s || !G.W) return false;
  const now = Date.now();
  if (a.t === 'mv') {
    const to = a.to === 'new' || a.to === 'rack' ? a.to : Number.isInteger(a.to) ? a.to : null;
    if (to === null || !Array.isArray(a.ids)) return false;
    const W = move(G.W, a.ids, to, new Set(G.snap.rack), !G.opened[s]);
    if (!W) return false;
    G.W = W; G.mv++;
    return true;
  }
  if (a.t === 'undo') { G.W = { table: G.snap.table.map(g => ({ id: g.id, t: g.t.slice() })), rack: G.snap.rack.slice(), nid: G.nid }; G.mv++; return true; }
  if (a.t === 'done') {
    const c = turnCheck(G.snap, G.W, G.opened[s], G.opts.open);
    if (!c.ok) return false;
    return commit(G, s, now, 'me');
  }
  if (a.t === 'draw') return drawTile(G, s, now);
  return false;
}

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; return startTurn(G, G.turn, now); }
  if (G.stage === 'round') { if (now < G.stageEnd) return false; deal(G, now, (G.rd.wins[0] >= 0 ? G.rd.wins[0] : 0)); return true; }
  if (G.stage !== 'turn') return false;
  const s = G.turn;
  if (G.seats[s].bot) { if (now < G.botAt) return false; return botTurn(G, s, now); }
  if (G.tEnd && now >= G.tEnd) { G.tEnd = 0; return drawTile(G, s, now, 'late'); } // out of time: the table goes back and you draw
  return false;
}

// A player who drops out is played by a bot until they're back; whatever they had moved goes back first.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.ph === 'play' && G.stage === 'turn') {
    if (away && G.snap) G.W = { table: G.snap.table.map(g => ({ id: g.id, t: g.t.slice() })), rack: G.snap.rack.slice(), nid: G.nid };
    G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000;
    G.mv++;
  }
  return true;
}

export function view(G, s) {
  const now = Date.now(), mine = G.W && G.turn === s;
  const table = G.W ? G.W.table : G.table;
  const committed = new Set(tilesOn(G.table));
  return {
    game: 'herd', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, round: G.round, rounds: G.opts.rounds,
    timer: G.opts.timer, open: G.opts.open, hints: G.opts.hints, botsLevel: G.opts.bots,
    tLeft: G.stage === 'turn' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    dealLeft: G.stage === 'deal' ? Math.max(0, G.stageEnd - now) : 0, roundLeft: G.stage === 'round' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    table, nid: G.W ? G.W.nid : G.nid,
    fresh: tilesOn(table).filter(t => !committed.has(t)), // tiles put down this turn, not yet played for good
    rack: s >= 0 && G.seats[s] ? (mine ? G.W.rack : G.racks[s]).slice() : [],
    snapRack: mine ? G.snap.rack : null, snapTable: mine ? G.snap.table : null,
    pool: G.pool.length, last: G.last,
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.W && G.turn === i ? G.W.rack.length : G.racks[i].length, opened: G.opened[i], total: G.total[i], st: G.st[i] })),
    // a round's end shows every tray; until then nobody sees another tray
    rd: G.rd, hist: G.hist, res: G.res, win: G.win, ev: G.ev,
  };
}

// 10 points for every player you finished ahead of; everyone sharing first place wins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => { const place = G.res.place[i]; return { pts: (n - place) * 10, win: place === 1, place }; });
}

export { check, isEgg };

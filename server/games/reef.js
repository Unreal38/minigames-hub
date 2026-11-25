// Word Reef: our own crossword tile game for 2 to 4 on an island board. Everyone has a tray of 7 letter tiles from
// a shared bag. On your turn you lay tiles in one line that join the tiles already down (the first word covers the
// middle), swap tiles with the bag, or pass. Every word a play makes scores its letters with the bonus squares under
// the new tiles; using all 7 tiles adds 40 and covering a pet nest adds 10.
// Words are not checked when they are played. Everyone else gets a few seconds to challenge: if any word of the
// play is not in the dictionary the tiles go back and the turn scores nothing, and if they all are, the player gets
// 10 more for the trouble. The game ends when the bag is empty and someone empties their tray, or when every turn
// in two whole rounds scored nothing; tiles left in a tray count against it.
// Nobody is ever sent another player's tray, or the bag, while the game is being played.
import { readPlay, fromRack, bagOf, boardOf, rackValue, langOf, RACK, WILD, CHAL_BONUS } from '../../public/games/reef/rules.js';
import { has, knows, preload } from '../reefdict.js';
import { findPlays, choose, swapPick } from './reef-bot.js';
import { randomAv } from '../../public/avatar.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'reef', name: 'Word Reef', minPlayers: 1, maxPlayers: 4, seats: { lo: 2, def: 2 } };

setTimeout(() => { try { preload(); } catch (e) { console.error('Word Reef dictionaries', e); } }, 1500).unref?.();

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// start: the tiles are handed out; chal: how long the others have to challenge (bots only: chalBots); told: how
// long the outcome of a challenge stays up before the next turn
export const MS = { start: 2200, chal: 12000, chalBots: 3200, told: 2600 };
export const NEST_PETS = ['waddlet', 'puddlepup', 'mossbun', 'sproutle', 'zapkit', 'pebblet', 'cindercub', 'dustmole']; // Pet Farm species, never translated
// how bots judge a play: chance to challenge a play with a wrong word, and to challenge a right one that has a
// word they do not know themselves
export const BOTS = { easy: { catch: .35, doubt: .12 }, normal: { catch: .75, doubt: .05 }, hard: { catch: 1, doubt: 0 } };
const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    lang: o.lang === 'en' ? 'en' : 'pl',
    board: o.board === 'big' ? 'big' : 'small',
    bag: o.bag === 'full' ? 'full' : 'short',
    bots: BOTS[o.bots] ? o.bots : 'normal',
    timer: [0, 60, 90, 120].includes(+o.timer) ? +o.timer : 90,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn), B = boardOf(opts.board);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  const n = Math.max(2, opts.seats, seats.length);
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const bag = shuffle(bagOf(opts.lang, opts.bag));
  const G = {
    game: 'reef', ph: 'play', stage: 'start', gid: Math.random().toString(36).slice(2, 8), seats, opts, board: opts.board, N: B.N,
    cells: Array(B.N * B.N).fill(''), wild: Array(B.N * B.N).fill(0), who: Array(B.N * B.N).fill(-1), nests: [],
    bag, racks: seats.map(() => bag.splice(0, RACK)), score: seats.map(() => 0), left: null,
    st: seats.map(() => ({ moves: 0, auto: 0, words: 0, best: '', bestPts: 0, chal: 0, caught: 0 })),
    turn: Math.random() * n | 0, mv: 0, dry: 0, pend: null, told: null, last: null, words: [],
    stageEnd: Date.now() + MS.start, tEnd: 0, botAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  pushEv(G, { t: 'start', s: G.turn });
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const B_ = G => boardOf(G.board);
const lang = G => langOf(G.opts.lang);

function setTurn(G, i, now) {
  G.turn = i; G.stage = 'play'; G.pend = null; G.told = null;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(1400, 2600);
  G.mv++;
}
const next = (G, now) => setTurn(G, (G.turn + 1) % G.seats.length, now);
const draw = (G, s) => { while (G.racks[s].length < RACK && G.bag.length) G.racks[s].push(G.bag.pop()); };

// ----- a play goes down and waits for challenges -----
function doPlay(G, s, tiles, now, auto = false) {
  if (!Array.isArray(tiles)) return false;
  tiles = tiles.slice(0, RACK).map(t => ({ i: t?.i, l: typeof t?.l === 'string' ? t.l.toLowerCase() : '', w: t?.w ? 1 : 0 }));
  const p = readPlay(B_(G), G.cells, G.wild, tiles, lang(G));
  if (!p.ok) return false;
  const left = fromRack(G.racks[s], tiles);
  if (!left) return false;
  for (const t of tiles) { G.cells[t.i] = t.l; G.wild[t.i] = t.w; G.who[t.i] = s; }
  G.racks[s] = left;
  G.st[s].moves++; if (auto) G.st[s].auto++;
  const bad = p.words.filter(w => !has(lang(G), w.w)).map(w => w.w);
  const judges = G.seats.map((x, i) => i).filter(i => i !== s);
  const people = judges.filter(i => !G.seats[i].bot);
  G.pend = { s, tiles, words: p.words.map(w => ({ w: w.w, pts: w.pts, cells: w.cells })), pts: p.pts, full: p.full, nests: p.nests, bad, fine: [], until: now + (people.length ? MS.chal : MS.chalBots), bots: [] };
  // bots make up their minds now and speak up a moment later
  for (const i of judges) {
    if (!G.seats[i].bot) continue;
    const B = BOTS[G.opts.bots], lvl = G.opts.bots;
    const doubt = !bad.length && p.words.some(w => !knows(lang(G), lvl, w.w)) && Math.random() < B.doubt;
    if ((bad.length && Math.random() < B.catch) || doubt) G.pend.bots.push({ i, at: now + rnd(1500, Math.min(5000, G.pend.until - now - 300)) });
  }
  G.stage = 'chal'; G.tEnd = 0; G.mv++;
  G.last = { t: 'play', s, mv: G.mv };
  pushEv(G, { t: 'play', s, pts: p.pts, words: p.words.map(w => w.w) });
  return true;
}
// nobody challenged (or a challenge failed): the play stands
function keep(G, now, extra = 0) {
  const P = G.pend, s = P.s;
  G.score[s] += P.pts + extra;
  for (const i of P.nests) G.nests.push({ i, pet: NEST_PETS[Math.random() * NEST_PETS.length | 0], s });
  for (const w of P.words) { G.st[s].words++; if (w.pts > G.st[s].bestPts) { G.st[s].bestPts = w.pts; G.st[s].best = w.w; } }
  G.words.push({ s, words: P.words.map(w => w.w), pts: P.pts + extra }); if (G.words.length > 30) G.words.shift();
  draw(G, s); G.dry = 0;
  pushEv(G, { t: 'stand', s, pts: P.pts + extra, nests: P.nests.length, full: P.full });
  if (!G.racks[s].length && !G.bag.length) return finish(G, now, s);
  return false;
}
function challenge(G, c, now) {
  const P = G.pend; if (!P || G.stage !== 'chal' || c === P.s) return false;
  G.st[c].chal++;
  if (P.bad.length) { // the play comes back off the board
    for (const t of P.tiles) { G.cells[t.i] = ''; G.wild[t.i] = 0; G.who[t.i] = -1; G.racks[P.s].push(t.w ? WILD : t.l); }
    G.st[c].caught++; G.dry++;
    G.told = { by: c, s: P.s, ok: false, bad: P.bad, tiles: P.tiles };
    G.last = { t: 'back', s: P.s, by: c, mv: G.mv + 1 };
    pushEv(G, { t: 'chal', by: c, s: P.s, ok: false, bad: P.bad });
  } else {
    G.told = { by: c, s: P.s, ok: true, words: P.words.map(w => w.w) };
    pushEv(G, { t: 'chal', by: c, s: P.s, ok: true, words: P.words.map(w => w.w), pts: P.pts + CHAL_BONUS });
    if (keep(G, now, CHAL_BONUS)) { G.mv++; return true; }
    G.last = { t: 'play', s: P.s, mv: G.mv + 1 };
  }
  G.pend = null; G.stage = 'told'; G.stageEnd = now + MS.told; G.mv++;
  return true;
}
function settle(G, now) { // the challenge window closed with nobody speaking up
  if (keep(G, now)) return true;
  if (G.dry >= G.seats.length * 2) return finish(G, now, -1);
  next(G, now); return true;
}

function doSwap(G, s, letters, now, auto = false) {
  if (!Array.isArray(letters) || !letters.length || letters.length > RACK || G.bag.length < letters.length) return false;
  const left = fromRack(G.racks[s], letters.map(l => (l === WILD ? { l: WILD, w: 1 } : { l })));
  if (!left) return false;
  const back = letters.slice();
  G.racks[s] = left; draw(G, s); G.bag.push(...back); shuffle(G.bag);
  G.st[s].moves++; if (auto) G.st[s].auto++;
  G.dry++; G.last = { t: 'swap', s, k: back.length, mv: G.mv + 1 };
  pushEv(G, { t: 'swap', s, k: back.length });
  if (G.dry >= G.seats.length * 2) return finish(G, now, -1);
  next(G, now); return true;
}
function doPass(G, s, now, auto = false) {
  G.st[s].moves++; if (auto) G.st[s].auto++;
  G.dry++; G.last = { t: 'pass', s, mv: G.mv + 1 };
  pushEv(G, { t: 'pass', s, auto });
  if (G.dry >= G.seats.length * 2) return finish(G, now, -1);
  next(G, now); return true;
}

function finish(G, now, out) {
  const L = lang(G);
  G.left = G.racks.map(r => rackValue(L, r));
  G.left.forEach((v, i) => { G.score[i] -= v; });
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.pend = null; G.endAt = now; G.mv++;
  const order = G.seats.map((_, i) => i).sort((a, b) => G.score[b] - G.score[a] || G.left[a] - G.left[b]);
  const key = i => G.score[i] * 1000 - G.left[i];
  const places = []; order.forEach((i, k) => { places[i] = k && key(i) === key(order[k - 1]) ? places[order[k - 1]] : k + 1; });
  const tie = order.length > 1 && key(order[0]) === key(order[1]);
  G.win = tie ? -1 : order[0];
  G.res = { order, places, score: G.score.slice(), left: G.left.slice(), out, racks: G.racks.map(r => r.slice()) };
  pushEv(G, { t: 'end', w: G.win, out });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot || G.ph !== 'play') return false;
  const now = Date.now();
  if (a.t === 'chal') return challenge(G, s, now);
  if (a.t === 'fine') { // "looks fine": once every person who may challenge says so, the window closes
    const P = G.pend; if (!P || G.stage !== 'chal' || s === P.s || P.fine.includes(s)) return false;
    P.fine.push(s); G.mv++;
    const people = G.seats.map((x, i) => i).filter(i => i !== P.s && !G.seats[i].bot);
    if (people.every(i => P.fine.includes(i))) P.until = Math.min(P.until, Math.max(now + 300, ...P.bots.map(b => b.at)));
    return true;
  }
  if (G.stage !== 'play' || G.turn !== s) return false;
  if (a.t === 'play') return doPlay(G, s, a.tiles, now);
  if (a.t === 'swap') return doSwap(G, s, a.tiles, now);
  if (a.t === 'pass') return doPass(G, s, now);
  return false;
}

// ---------- bots ----------
function botMove(G, s, now, level = G.opts.bots, auto = false) {
  const plays = findPlays(B_(G), G.cells, G.wild, G.racks[s], lang(G), level);
  const p = choose(plays, G.racks[s], lang(G), level);
  if (p && !(level === 'hard' && p.pts < 8 && G.bag.length >= RACK && !auto)) return doPlay(G, s, p.tiles, now, auto);
  if (!auto && G.bag.length >= RACK) { const out = swapPick(G.racks[s], lang(G)); if (out.length && G.bag.length >= out.length) return doSwap(G, s, out, now, auto); }
  return doPass(G, s, now, auto);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'start') { if (now < G.stageEnd) return false; setTurn(G, G.turn, now); return true; }
  if (G.stage === 'told') {
    if (now < G.stageEnd) return false;
    if (G.dry >= G.seats.length * 2) return finish(G, now, -1);
    next(G, now); return true;
  }
  if (G.stage === 'chal') {
    const P = G.pend, b = P.bots.find(x => now >= x.at && G.seats[x.i]?.bot);
    if (b) return challenge(G, b.i, now);
    if (now < P.until) return false;
    return settle(G, now);
  }
  const s = G.turn; if (s < 0) return false;
  if (G.seats[s].bot) { if (now < G.botAt) return false; return botMove(G, s, now); }
  if (G.tEnd && now >= G.tEnd) return doPass(G, s, now, true); // out of time: the turn passes
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.stage === 'play') { G.botAt = Date.now() + 1200; G.tEnd = away || !G.opts.timer ? 0 : Date.now() + G.opts.timer * 1000; }
  if (G.stage === 'chal' && G.pend) G.pend.until = Math.min(G.pend.until, Date.now() + MS.chalBots); // nobody left to wait for, maybe
  return true;
}

export function view(G, s) {
  const now = Date.now(), over = G.ph === 'end', P = G.pend;
  return {
    game: 'reef', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, timer: G.opts.timer,
    lang: lang(G), board: G.board, bag: G.bag.length, bagSize: G.opts.bag, botsLevel: G.opts.bots,
    tLeft: G.stage === 'play' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    stageLeft: G.stage === 'start' || G.stage === 'told' ? Math.max(0, G.stageEnd - now) : 0,
    cells: G.cells, wild: G.wild, who: G.who, nests: G.nests, score: G.score, dry: G.dry, ms: MS,
    pend: P && { s: P.s, tiles: P.tiles, words: P.words, pts: P.pts, full: P.full, nests: P.nests, fine: P.fine, left: Math.max(0, P.until - now) },
    told: G.told, last: G.last, words: G.words.slice(-8),
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.racks[i].length, st: G.st[i],
      rack: i === s || over ? G.racks[i] : null, // your own tray only, until the game is over
    })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Points are the final score. Places follow it (level players share a place).
// A person whose every move was made by the turn timer earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.score[i], win: G.win === i, place: G.res.places[i], idle: x.human && G.st[i].moves > 0 && G.st[i].moves === G.st[i].auto }));
}

// Dominoes: the classic draw game with a double-six set. Everyone gets 7 tiles (2 players) or 5 (3 or 4); the rest
// are the pile. On your turn you add a tile that matches one of the two open ends of the line. If nothing fits you
// draw from the pile until something does, and once the pile is empty you pass. The first to put down their last
// tile wins the round and scores the pips left in the other hands; if nobody can move, the lightest hand wins and
// scores the others' pips minus its own. A match is one round, or first to 50 or 100 points.
// Nobody is ever sent another player's hand while a round is being played.
import { TILES, isDouble, pipsOf, handPips, handSize, sortHand, sides, playable, place, opener, ends } from '../../public/games/domino/rules.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'domino', name: 'Dominoes', minPlayers: 1, maxPlayers: 4 };

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
export const MS = { deal: 2000, round: 8500, pass: 1300 }; // tiles slide out; the round's count stays up; a pass is shown this long
export const MAX_ROUNDS = 15; // rounds nobody wins can't stretch a match for ever
const rnd = (a, b) => a + Math.random() * (b - a);

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4].includes(+o.seats) ? +o.seats : 4,
    to: [0, 50, 100].includes(+o.to) ? +o.to : 100,
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    timer: [0, 15, 20, 30].includes(+o.timer) ? +o.timer : 20,
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  const n = Math.max(2, opts.seats, seats.length);
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const G = {
    game: 'domino', ph: 'play', stage: 'deal', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    hands: [], pile: [], chain: [], first: 0, must: -1, lack: [], passes: 0,
    score: seats.map(() => 0), round: 0, lead: -1, rd: null,
    st: seats.map(() => ({ moves: 0, auto: 0, played: 0, drawn: 0, rounds: 0 })),
    turn: -1, mv: 0, last: null, stageEnd: 0, tEnd: 0, botAt: 0, passAt: 0, ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  deal(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }

// A new round: shuffle, hand out the tiles, and work out who starts. In the first round (and after a round nobody
// won) that is the holder of the highest double, who has to open with it; otherwise the last round's winner opens
// with any tile.
function deal(G, now) {
  const n = G.seats.length, k = handSize(n), d = TILES.map((_, i) => i);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; }
  G.hands = G.seats.map((_, i) => sortHand(d.slice(i * k, i * k + k)));
  G.pile = d.slice(n * k);
  G.chain = []; G.first = 0; G.passes = 0; G.last = null; G.rd = null;
  G.lack = G.seats.map(() => []); // numbers each player was seen not to have (they drew or passed on them): open knowledge
  G.round++;
  if (G.lead >= 0) { G.turn = G.lead; G.must = -1; }
  else { const o = opener(G.hands); G.turn = o.s; G.must = o.t; }
  G.stage = 'deal'; G.stageEnd = now + MS.deal; G.tEnd = 0; G.mv++;
  pushEv(G, { t: 'start', round: G.round, s: G.turn });
}

const canMove = (G, s) => (G.must >= 0 ? G.hands[s].includes(G.must) : playable(G.chain, G.hands[s]).length > 0);
function setTurn(G, i, now) {
  G.turn = i;
  G.tEnd = G.opts.timer && !G.seats[i].bot ? now + G.opts.timer * 1000 : 0;
  G.botAt = now + rnd(900, 1700);
  // nothing fits and nothing to draw: the turn passes by itself after a moment
  G.passAt = !canMove(G, i) && !G.pile.length ? now + MS.pass : 0;
  if (G.passAt) G.tEnd = 0;
}
const noteLack = (G, s) => { const e = ends(G.chain); if (e) for (const v of e) if (!G.lack[s].includes(v)) G.lack[s].push(v); };

function doPlay(G, s, t, side, now, auto = false) {
  if (!G.hands[s].includes(t) || (G.must >= 0 && t !== G.must)) return false;
  const fit = sides(G.chain, t);
  if (!fit) return false;
  if (side !== 'l' && side !== 'r') { if (fit.length !== 1) return false; side = fit; } // only one place it can go
  const r = place(G.chain, G.first, t, side);
  if (!r) return false;
  G.chain = r.chain; G.first = r.first; G.must = -1; G.passes = 0;
  G.hands[s] = G.hands[s].filter(x => x !== t);
  G.st[s].moves++; G.st[s].played++; if (auto) G.st[s].auto++;
  G.mv++; G.last = { t: 'play', s, tile: t, side, mv: G.mv };
  pushEv(G, { t: 'play', s, tile: t, side, left: G.hands[s].length });
  if (!G.hands[s].length) return endRound(G, s, false, now);
  setTurn(G, (s + 1) % G.seats.length, now);
  return true;
}
function doDraw(G, s, now, auto = false) {
  if (!G.pile.length || canMove(G, s)) return false; // you only draw when nothing you hold fits
  noteLack(G, s);
  const t = G.pile.pop();
  G.hands[s] = sortHand([...G.hands[s], t]);
  G.st[s].moves++; G.st[s].drawn++; if (auto) G.st[s].auto++;
  G.mv++; G.last = { t: 'draw', s, mv: G.mv, got: t };
  pushEv(G, { t: 'draw', s, pile: G.pile.length });
  const keep = G.tEnd; setTurn(G, s, now); if (keep) G.tEnd = keep; // still your turn, on the same clock
  G.botAt = now + rnd(550, 900);
  return true;
}
function doPass(G, s, now) {
  noteLack(G, s);
  G.passes++; G.mv++; G.last = { t: 'pass', s, mv: G.mv };
  pushEv(G, { t: 'pass', s });
  if (G.passes >= G.seats.length) return endRound(G, -1, true, now); // nobody can move: the line is blocked
  setTurn(G, (s + 1) % G.seats.length, now);
  return true;
}

function endRound(G, out, blocked, now) {
  const pips = G.hands.map(handPips), n = G.seats.length;
  let w = out, pts = 0;
  if (blocked) {
    const low = Math.min(...pips), lows = pips.map((p, i) => (p === low ? i : -1)).filter(i => i >= 0);
    w = lows.length === 1 ? lows[0] : -1; // level on the lightest hand: nobody scores
  }
  if (w >= 0) { pts = pips.reduce((a, b) => a + b, 0) - pips[w] * (blocked ? 2 : 1); G.score[w] += pts; G.st[w].rounds++; }
  G.lead = w; // the winner opens the next round; -1 means the highest double decides again
  G.rd = { w, pts, blocked, pips, hands: G.hands.map(h => h.slice()), round: G.round };
  G.turn = -1; G.tEnd = 0; G.passAt = 0; G.mv++;
  pushEv(G, { t: 'round', w, pts, blocked, score: G.score.slice() });
  const top = Math.max(...G.score);
  if (!G.opts.to || top >= G.opts.to || G.round >= MAX_ROUNDS) return finish(G, now);
  G.stage = 'round'; G.stageEnd = now + MS.round;
  return true;
}
function finish(G, now) {
  G.ph = 'end'; G.stage = 'end'; G.turn = -1; G.tEnd = 0; G.endAt = now;
  // most points first; level on points, the lighter hand in the last round goes ahead
  const order = G.seats.map((_, i) => i).sort((a, b) => G.score[b] - G.score[a] || G.rd.pips[a] - G.rd.pips[b]);
  const key = i => G.score[i] * 1000 - G.rd.pips[i];
  const places = []; order.forEach((i, k) => { places[i] = k && key(i) === key(order[k - 1]) ? places[order[k - 1]] : k + 1; });
  const tie = order.length > 1 && key(order[0]) === key(order[1]);
  G.win = tie ? -1 : order[0];
  G.res = { order, places, score: G.score.slice(), rounds: G.round, tie };
  pushEv(G, { t: 'end', w: G.win });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.seats[s].bot) return false;
  if (G.ph !== 'play' || G.stage !== 'play' || G.turn !== s) return false;
  const now = Date.now();
  if (a.t === 'play') return doPlay(G, s, a.tile, a.side, now);
  if (a.t === 'draw') return doDraw(G, s, now);
  return false;
}

// ---------- bots ----------
// chill: puts down any tile that fits, a little keener on doubles.
// sharp: weighs every tile and end. It likes to get rid of heavy tiles (pip) and of doubles (dbl), to leave ends
//   it can still follow itself (keep, per matching tile left in its hand), and to leave ends the next player was
//   seen not to have (block). Only what everyone at the table could have seen is used.
export const BOTS = {
  chill: { dbl: .35 },
  sharp: { pip: 1, dbl: 5, keep: 3, block: 9 },
};
function pick(G, s, level) {
  const hand = G.hands[s], B = BOTS[level] || BOTS.chill;
  const opts = [];
  for (const t of hand) { if (G.must >= 0 && t !== G.must) continue; for (const side of sides(G.chain, t)) opts.push({ t, side }); }
  if (!opts.length) return null;
  if (level !== 'sharp') {
    const dbl = opts.filter(o => isDouble(o.t));
    return dbl.length && Math.random() < B.dbl ? dbl[Math.random() * dbl.length | 0] : opts[Math.random() * opts.length | 0];
  }
  const next = (s + 1) % G.seats.length;
  let best = null;
  for (const o of opts) {
    const r = place(G.chain, G.first, o.t, o.side), e = ends(r.chain), rest = hand.filter(t => t !== o.t);
    let v = pipsOf(o.t) * B.pip + (isDouble(o.t) ? B.dbl : 0) + Math.random();
    v += rest.filter(t => e.includes(TILES[t][0]) || e.includes(TILES[t][1])).length * B.keep;
    if (rest.length) v += e.filter(x => G.lack[next].includes(x)).length * B.block;
    else v += 1000; // going out wins the round
    if (!best || v > best.v) best = { ...o, v };
  }
  return best;
}
function botMove(G, s, now, level = G.opts.bots, auto = false) {
  const o = pick(G, s, level);
  if (o) return doPlay(G, s, o.t, o.side, now, auto);
  if (G.pile.length) return doDraw(G, s, now, auto);
  return doPass(G, s, now);
}
export { botMove as _bot };

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (G.stage === 'deal') { if (now < G.stageEnd) return false; G.stage = 'play'; setTurn(G, G.turn, now); return true; }
  if (G.stage === 'round') { if (now < G.stageEnd) return false; deal(G, now); return true; }
  const s = G.turn; if (s < 0) return false;
  if (G.passAt) { if (now < G.passAt) return false; return doPass(G, s, now); }
  if (G.seats[s].bot) { if (now < G.botAt) return false; return botMove(G, s, now); }
  if (G.tEnd && now >= G.tEnd) { // out of time: a bot finishes the turn (drawing as long as it has to)
    for (let k = 0; k < 30 && G.turn === s && G.stage === 'play' && !G.passAt; k++) if (!botMove(G, s, now, 'chill', true)) break;
    return true;
  }
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.turn === s && G.stage === 'play') { G.botAt = Date.now() + 800; G.tEnd = away || !G.opts.timer || G.passAt ? 0 : Date.now() + G.opts.timer * 1000; }
  return true;
}

export function view(G, s) {
  const now = Date.now(), open = G.stage === 'round' || G.stage === 'end'; // hands are turned over to count the pips
  return {
    game: 'domino', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, mv: G.mv, timer: G.opts.timer, botsLevel: G.opts.bots, to: G.opts.to,
    tLeft: G.stage === 'play' && G.tEnd ? Math.max(0, G.tEnd - now) : -1,
    stageLeft: G.stage === 'deal' || G.stage === 'round' ? Math.max(0, G.stageEnd - now) : 0, ms: MS,
    chain: G.chain, first: G.first, pile: G.pile.length, must: G.turn === s ? G.must : -1, passing: !!G.passAt,
    round: G.round, score: G.score, lack: G.lack,
    last: G.last && { t: G.last.t, s: G.last.s, mv: G.last.mv, tile: G.last.tile, side: G.last.side, got: G.last.s === s ? G.last.got : undefined },
    rd: open ? G.rd : null,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id,
      n: G.hands[i].length, st: G.st[i],
      hand: i === s || open ? G.hands[i] : null, // your own tiles only, until the round is over
    })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Points are the match score. Places follow the final order (level players share a place).
// A person whose every move was made by the turn timer earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.score[i], win: G.win === i, place: G.res.places[i], idle: x.human && G.st[i].moves > 0 && G.st[i].moves === G.st[i].auto }));
}

// Hot Pot: authoritative game engine + bots. Inspired by the Palia Hotpot card minigame.
import { DECK_SIZE, HAND, PTS_WIN, bestSets, canWin, evalHand } from '../../public/games/hotpot/rules.js';

export const meta = { id: 'hotpot', name: 'Hot Pot', minPlayers: 1, maxPlayers: 4 };

const BOT_NAMES = ['Miso', 'Bao', 'Yuzu', 'Sesame', 'Mochi', 'Pepper', 'Dango', 'Tamago'];
const BOT_COLS = ['#ff8fab', '#7ec8a9', '#ffb86b', '#9aa8ff', '#e8a0e0', '#7fd1e8'];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rnd = (a, b) => a + Math.random() * (b - a);

export function create(players, opts = {}, prev = null) {
  const used = new Set(players.map(p => p.name));
  const names = shuffle(BOT_NAMES.filter(n => !used.has(n)));
  const seats = players.slice(0, 4).map(p => ({ id: p.id, name: p.name, color: p.color, bot: false, human: true }));
  let bi = 0;
  while (seats.length < 4) seats.push({ id: null, name: names[bi], color: BOT_COLS[bi++ % BOT_COLS.length], bot: true, human: false });
  const deck = shuffle([...Array(DECK_SIZE).keys()]);
  const start = prev ? (prev.start + 1) % 4 : 0;
  const G = {
    ph: 'play', gid: Math.random().toString(36).slice(2, 8), seats,
    hands: seats.map(() => deck.splice(0, HAND)), disc: seats.map(() => []), deck,
    start, turn: start, step: 'draw', round: 1, maxR: 30,
    tLim: [0, 20, 30, 45, 60].includes(+opts.timer) ? +opts.timer : 30,
    level: opts.bots === 'sharp' ? 'sharp' : 'chill',
    ev: [], evN: 0, res: null, win: -1, drawn: null, tEnd: 0, botAt: 0, endAt: 0,
  };
  startTurn(G);
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 10) G.ev.shift(); }

function startTurn(G) {
  G.step = 'draw'; G.drawn = null;
  G.tEnd = G.tLim ? Date.now() + G.tLim * 1000 : 0;
  G.botAt = Date.now() + rnd(900, 1700);
  pushEv(G, { t: 'turn', s: G.turn });
}

function refill(G) {
  const tops = G.disc.map(p => p.pop());
  for (const p of G.disc) { G.deck.push(...p); p.length = 0; }
  tops.forEach((t, i) => { if (t !== undefined) G.disc[i].push(t); });
  shuffle(G.deck);
  pushEv(G, { t: 'shuffle' });
}

function draw(G, s, src) {
  if (G.ph !== 'play' || s !== G.turn || G.step !== 'draw') return false;
  let c;
  if (src < 0) {
    if (!G.deck.length) refill(G);
    if (!G.deck.length) { finish(G, -1); return true; }
    c = G.deck.pop();
  } else {
    if (!Number.isInteger(src) || src === s || !G.disc[src]?.length) return false;
    c = G.disc[src].pop();
  }
  G.hands[s].push(c); G.drawn = c; G.step = 'disc';
  G.botAt = Date.now() + rnd(700, 1300);
  pushEv(G, { t: 'draw', s, src, c });
  return true;
}

function discard(G, s, c) {
  if (G.ph !== 'play' || s !== G.turn || G.step !== 'disc') return false;
  const i = G.hands[s].indexOf(c);
  if (i < 0) return false;
  G.hands[s].splice(i, 1); G.disc[s].push(c);
  pushEv(G, { t: 'disc', s, c });
  G.turn = (G.turn + 1) % 4;
  if (G.turn === G.start && ++G.round > G.maxR) { finish(G, -1); return true; }
  startTurn(G);
  return true;
}

function eat(G, s) {
  if (G.ph !== 'play' || s !== G.turn || G.step !== 'disc' || !canWin(G.hands[s])) return false;
  pushEv(G, { t: 'eat', s });
  finish(G, s);
  return true;
}

function finish(G, w) {
  G.ph = 'end'; G.win = w; G.endAt = Date.now();
  G.res = G.seats.map((_, i) => {
    const b = bestSets(G.hands[i]);
    return { sets: b.sets, setPts: b.score, bonus: i === w ? PTS_WIN : 0, pts: b.score + (i === w ? PTS_WIN : 0) };
  });
  pushEv(G, { t: 'end', w });
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || G.seats[s]?.bot) return false;
  if (a.t === 'deck') return draw(G, s, -1);
  if (a.t === 'take') return draw(G, s, +a.from);
  if (a.t === 'disc') return discard(G, s, +a.c);
  if (a.t === 'eat') return eat(G, s);
  return false;
}

function botMove(G, s) {
  const h = G.hands[s], noise = G.level === 'sharp' ? 1 : 9;
  if (G.step === 'draw') {
    let best = -1, bestV = evalHand(h) + (G.level === 'sharp' ? 5 : 2);
    for (let o = 0; o < 4; o++) {
      const top = G.disc[o].at(-1);
      if (o === s || top === undefined) continue;
      const hh = [...h, top];
      if (canWin(hh)) { best = o; break; }
      let v = -1;
      for (const x of hh) if (x !== top) v = Math.max(v, evalHand(hh.filter(y => y !== x)));
      v += Math.random() * noise * 0.5;
      if (v > bestV) { bestV = v; best = o; }
    }
    return draw(G, s, best);
  }
  if (canWin(h)) return eat(G, s);
  let pick = h[0], pv = -1e9;
  for (const x of h) {
    const v = evalHand(h.filter(y => y !== x)) + Math.random() * noise;
    if (v > pv) { pv = v; pick = x; }
  }
  return discard(G, s, pick);
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const s = G.turn;
  if (G.seats[s].bot) return now >= G.botAt ? botMove(G, s) : false;
  if (G.tEnd && now >= G.tEnd) {
    pushEv(G, { t: 'timeout', s });
    if (G.step === 'draw') draw(G, s, -1);
    if (G.ph === 'play' && G.step === 'disc') {
      if (canWin(G.hands[s])) eat(G, s); else discard(G, s, G.drawn ?? G.hands[s].at(-1));
    }
    return true;
  }
  return false;
}

// A disconnected player is played by a bot until they come back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (away && G.turn === s) G.botAt = Date.now() + 800;
  return true;
}

// What one seat (or a spectator, s = -1) is allowed to see.
export function view(G, s) {
  const end = G.ph === 'end';
  return {
    ph: G.ph, gid: G.gid, me: s, turn: G.turn, step: G.step, round: G.round, maxR: G.maxR,
    tl: G.tEnd ? Math.max(0, G.tEnd - Date.now()) : 0, tLim: G.tLim, dc: G.deck.length, win: G.win,
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, bot: x.bot, human: x.human, id: x.id,
      n: G.hands[i].length, top: G.disc[i].at(-1) ?? -1, dn: G.disc[i].length,
    })),
    hand: s >= 0 ? G.hands[s] : [],
    hands: end ? G.hands : null,
    res: G.res,
    ev: G.ev.map(e => (e.t === 'draw' && e.src < 0 && e.s !== s && !end) ? { ...e, c: -1 } : e),
  };
}

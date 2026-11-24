// Państwa-miasta (Countries & Cities): a letter is drawn and everyone writes one word per category that starts with it.
// The first to fill every box may call Stop (the rest get a few more seconds), otherwise the clock ends the round.
// Then the whole table sees the answers and can thumb down wrong ones (more than half of the other players throw a word
// out); the game itself throws out a wrong first letter.
// Points the traditional way: 15 for the only valid answer in a category, 10 for a word nobody else wrote, 5 for a shared one.
// People only: there are no bots here, so the table needs at least two players.
import { SETS, LETTERS, TIMES, ROUNDS, clean, fold, starts, mark } from '../../public/games/pm/rules.js';
import { SPECIES } from '../../public/games/farm/data.js';

export const meta = { id: 'pm', name: 'Countries & Cities', minPlayers: 2, maxPlayers: 8, minHumans: 2 };

// draw: the letter block spins; stop: time the others get after someone calls Stop; grace: late keystrokes still arrive;
// check + perCat for each category: time to look through the answers; score: the round's points stay on screen.
export const MS = { draw: 3400, stop: 5000, grace: 900, check: 30000, perCat: 4000, score: 7000 };
const PETS = new Set(Object.values(SPECIES).map(x => fold(x.name)));
const petOk = w => PETS.has(fold(w));
const petLetter = l => Object.values(SPECIES).some(x => starts(x.name, l));

export function cleanOpts(o = {}) {
  return {
    rounds: ROUNDS.includes(+o.rounds) ? +o.rounds : 5,
    time: TIMES.includes(+o.time) ? +o.time : 90,
    cats: Object.hasOwn(SETS, o.cats) ? o.cats : 'classic',
    letters: o.letters === 'pl' ? 'pl' : 'easy',
    pet: o.pet === 'on' ? 'on' : 'off',
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const cats = [...SETS[opts.cats], ...(opts.pet === 'on' ? ['pet'] : [])];
  const G = {
    game: 'pm', ph: 'play', stage: 'draw', gid: Math.random().toString(36).slice(2, 8), seats, opts, cats,
    round: -1, letter: '', used: [], open: cats.map(() => true), tEnd: 0, tAll: 0, stopBy: -1,
    ans: [], votes: [], ready: [], marks: null, last: null,
    tot: seats.map(() => 0), hist: [], wrote: seats.map(() => false),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  nextRound(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 16) G.ev.shift(); }
const here = G => G.seats.map(x => x.human && !x.bot);
const setStage = (G, stage, now, ms) => { G.stage = stage; G.tAll = ms; G.tEnd = now + ms; };

function nextRound(G, now) {
  const pool = LETTERS[G.opts.letters].filter(l => !G.used.includes(l));
  G.round++; G.letter = pool[Math.random() * pool.length | 0]; G.used.push(G.letter);
  G.open = G.cats.map(c => c !== 'pet' || petLetter(G.letter)); // no pet starts with this letter: that box is closed this round
  G.ans = G.seats.map(() => G.cats.map(() => '')); G.votes = G.cats.map(() => ({})); G.ready = G.seats.map(() => false);
  G.marks = null; G.last = null; G.stopBy = -1;
  setStage(G, 'draw', now, MS.draw);
  pushEv(G, { t: 'draw', r: G.round });
}
const live = G => mark({ cats: G.cats, letter: G.letter, ans: G.ans, open: G.open, votes: G.votes, here: here(G), petOk });
const filled = (G, s) => G.ans[s].filter((a, c) => G.open[c] && a).length;
const nOpen = G => G.open.filter(Boolean).length;

function setAns(G, s, list) {
  if (!Array.isArray(list)) return false;
  let ch = false;
  G.cats.forEach((_, c) => {
    if (!G.open[c] || typeof list[c] !== 'string') return;
    const v = clean(list[c]);
    if (v !== G.ans[s][c]) { G.ans[s][c] = v; ch = true; }
    if (v) G.wrote[s] = true;
  });
  return ch;
}
function closeRound(G, now) {
  G.marks = live(G);
  G.last = G.marks.map(row => row.reduce((n, m) => n + m.pts, 0));
  G.last.forEach((p, s) => { G.tot[s] += p; });
  G.hist.push({ l: G.letter, pts: G.last.slice() });
  setStage(G, 'score', now, MS.score);
  pushEv(G, { t: 'score', pts: G.last.slice() });
  return true;
}
function finish(G, now) {
  G.ph = 'end'; G.stage = 'end'; G.endAt = now;
  // most points first; players level on points share the place
  const place = G.seats.map((_, i) => 1 + G.tot.filter(p => p > G.tot[i]).length);
  const order = G.seats.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
  G.win = order[0];
  G.res = { tot: G.tot.slice(), place, order, hist: G.hist };
  pushEv(G, { t: 'end', w: place.filter(p => p === 1).length === 1 ? G.win : -1 });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.ph !== 'play') return false;
  const now = Date.now(), writing = G.stage === 'write' || G.stage === 'stop' || G.stage === 'grace';
  if (a.t === 'ans') return writing && setAns(G, s, a.a);
  if (a.t === 'stop') {
    if (G.stage !== 'write') return false;
    setAns(G, s, a.a);
    // Stop is for someone who has a word in every box, each with the right first letter
    if (G.ans[s].some((v, c) => G.open[c] && !starts(v, G.letter))) return true;
    G.stopBy = s; G.stage = 'stop'; G.tAll = MS.stop; G.tEnd = Math.min(G.tEnd, now + MS.stop);
    pushEv(G, { t: 'stop', s });
    return true;
  }
  if (G.stage !== 'check' || G.seats[s].bot) return false;
  if (a.t === 'ready') { if (G.ready[s] === !!a.on) return false; G.ready[s] = !!a.on; return true; }
  if (a.t === 'vote') {
    const c = a.c, v = a.s;
    if (!Number.isInteger(c) || !Number.isInteger(v) || !G.cats[c] || G.cats[c] === 'pet' || !G.seats[v]) return false;
    const m = live(G);
    // only words that passed the game's own check can be voted on, and never your own word
    if (['closed', 'empty', 'letter', 'nopet'].includes(m[v][c].st) || !m[v][c].k) return false;
    const k = m[v][c].k;
    if (m[s][c].k === k && !['empty', 'letter', 'closed'].includes(m[s][c].st)) return false;
    const list = G.votes[c][k] ||= [], i = list.indexOf(s);
    if (a.on === false ? i < 0 : i >= 0) return false;
    if (i >= 0) list.splice(i, 1); else list.push(s);
    return true;
  }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  // with fewer than two people left at the table there is nobody to play against: the game ends as it stands
  if (G.seats.filter(x => x.human).length < 2) return finish(G, now);
  if (G.stage === 'draw') { if (now < G.tEnd) return false; setStage(G, 'write', now, G.opts.time * 1000); pushEv(G, { t: 'go', l: G.letter }); return true; }
  if (G.stage === 'write' || G.stage === 'stop') { if (now < G.tEnd) return false; setStage(G, 'grace', now, MS.grace); pushEv(G, { t: 'lock' }); return true; }
  if (G.stage === 'grace') {
    if (now < G.tEnd) return false;
    // nothing to check when nobody wrote a word that passes the game's own check
    if (!live(G).some(row => row.some(m => m.pts))) return closeRound(G, now);
    setStage(G, 'check', now, MS.check + MS.perCat * nOpen(G));
    return true;
  }
  if (G.stage === 'check') {
    const h = here(G);
    if (now >= G.tEnd || (h.some(Boolean) && h.every((x, s) => !x || G.ready[s]))) return closeRound(G, now);
    return false;
  }
  if (G.stage === 'score') { if (now < G.tEnd) return false; if (G.round + 1 >= G.opts.rounds) return finish(G, now); nextRound(G, now); return true; }
  return false;
}

// Somebody who drops out simply writes nothing and has no vote until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; if (away) G.ready[s] = false;
  return true;
}

export function view(G, s) {
  const now = Date.now(), shown = G.stage === 'check' || G.stage === 'score' || G.stage === 'end';
  return {
    game: 'pm', ph: G.ph, stage: G.stage, gid: G.gid, me: s, opts: G.opts, cats: G.cats, open: G.open,
    round: G.round, rounds: G.opts.rounds, letter: G.stage === 'draw' ? '' : G.letter, left: Math.max(0, G.tEnd - now), all: G.tAll, stopBy: G.stopBy,
    mine: s >= 0 ? G.ans[s] : null, fill: G.seats.map((_, i) => filled(G, i)), nOpen: nOpen(G),
    // nobody sees the others' words while the round is on
    ans: shown ? G.ans : null, marks: G.stage === 'check' ? live(G) : shown ? G.marks : null, votes: G.stage === 'check' ? G.votes : null,
    ready: G.ready, tot: G.tot, last: G.last, hist: G.hist,
    seats: G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Placed by points over all rounds. Someone who never wrote a single word earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.tot[i], win: G.res.place[i] === 1, place: G.res.place[i], idle: x.human && !G.wrote[i] }));
}

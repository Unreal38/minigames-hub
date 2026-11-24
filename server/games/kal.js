// Kalambury (Sketch & Guess): one player draws a word, everyone else types guesses. The faster the guess, the more
// points; the drawer earns from every person who gets it. No bots: this game needs people, at least two.
// The drawing travels as small strokes the moment they are drawn (the fast() hook streams them twenty times a second),
// and each screen is only ever sent the strokes it has not had yet.
import { BW, BH, COLORS, SIZES, OP, ROUNDS, TIMES, THEMES, guessPts, drawPts, norm, isNear, isLetter } from '../../public/games/kal/rules.js';
import { poolOf, LANGS } from './kalwords.js';

export const meta = { id: 'kal', name: 'Sketch & Guess', minPlayers: 2, minPeople: 2, maxPlayers: 8, joinAt: 'turn' };

// pick: time to choose a word; show: the answer stays up this long; hello: a breath before the very first turn
export const MS = { pick: 15000, show: 6500, hello: 1500, say: 450 };
const MAX_OPS = 9000, MAX_PTS = 60000, MAX_TEXT = 60, FEED = 40;

export function cleanOpts(o = {}) {
  return {
    rounds: ROUNDS.includes(+o.rounds) ? +o.rounds : 3,
    time: TIMES.includes(+o.time) ? +o.time : 80,
    lang: LANGS.includes(o.lang) ? o.lang : 'pl',
    theme: THEMES.includes(o.theme) ? o.theme : 'all',
    hints: o.hints === 'off' ? 'off' : 'on',
  };
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const here = (G, s) => { const x = G.seats[s]; return !!x && x.human && !x.away; };   // a person who is at the table right now
const people = G => G.seats.filter(x => x.human).length;
function say(G, e) { e.n = ++G.feedN; G.feed.push(e); if (G.feed.length > FEED) G.feed.shift(); }

export function create(players, optsIn = {}, prev = null) {
  const opts = cleanOpts(optsIn), now = Date.now();
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true, away: false }));
  const G = {
    game: 'kal', ph: 'play', st: 'pick', gid: Math.random().toString(36).slice(2, 8), seats, opts, seatRev: 1, seatSent: seats.map(() => 0),
    order: shuffle(seats.map((_, i) => i)), oi: -1, round: 1, tid: 0, drawer: -1, picks: [], word: null, keys: [],
    used: prev?.game === 'kal' && prev.usedKey === opts.lang + '/' + opts.theme ? new Set(prev.used) : new Set(), usedKey: opts.lang + '/' + opts.theme,
    stEnd: 0, t0: 0, got: seats.map(() => 0), sc: seats.map(() => 0), acts: seats.map(() => 0), hits: seats.map(() => 0),
    open: [], shown: 0, last: null, log: [], base: 0, pen: false, pts: 0, sent: seats.map(() => 0), sync: new Set(), syncAt: 0, dd: false,
    wFrom: 0, wTo: 0, wAt: 0, feed: [], feedN: 0, lastSay: seats.map(() => 0), queue: [], res: null, win: -1, endAt: 0,
  };
  nextTurn(G, now, MS.hello);
  return G;
}

// ---------- turns ----------
function seatQueued(G) {
  while (G.queue.length && G.seats.length < meta.maxPlayers) {
    const p = G.queue.shift(); if (G.seats.some(x => x.id === p.id)) continue;
    const s = G.seats.push({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true, away: false }) - 1;
    for (const k of ['got', 'sc', 'acts', 'hits', 'sent', 'seatSent', 'lastSay']) G[k].push(0);
    G.order.push(s); G.seatRev++;
    say(G, { k: 'join', s });
  }
}
function threeWords(G) {
  const pool = poolOf(G.opts.lang, G.opts.theme);
  let fresh = pool.filter(w => !G.used.has(w.w));
  if (fresh.length < 3) { G.used.clear(); fresh = pool.slice(); }
  const out = [];
  if (G.opts.theme === 'all') { // three words from three different themes, so there is always a choice
    const themes = shuffle([...new Set(fresh.map(w => w.theme))]);
    for (const t of themes.slice(0, 3)) { const ws = fresh.filter(w => w.theme === t); out.push(ws[Math.random() * ws.length | 0]); }
  }
  for (const w of shuffle(fresh.slice())) { if (out.length >= 3) break; if (!out.includes(w)) out.push(w); }
  return out;
}
function nextTurn(G, now, extra = 0) {
  seatQueued(G);
  if (people(G) < 2) return finish(G, now);
  for (;;) {
    if (++G.oi >= G.order.length) { G.oi = 0; if (++G.round > G.opts.rounds) return finish(G, now); }
    if (here(G, G.order[G.oi])) break;
  }
  G.tid++; G.drawer = G.order[G.oi]; G.st = 'pick'; G.stEnd = now + MS.pick + extra; G.picks = threeWords(G); G.word = null; G.keys = [];
  G.got.fill(0); G.open = []; G.shown = 0; G.last = null;
  G.log = []; G.base = 0; G.pen = false; G.pts = 0; G.sent.fill(0); G.sync.clear(); G.wFrom = G.wTo = 0;
  say(G, { k: 'turn', s: G.drawer });
  return true;
}
function beginDraw(G, i, now) {
  const w = G.picks[i] || G.picks[0];
  G.word = w; G.keys = [w.w, ...w.alts].map(norm); G.used.add(w.w); G.picks = [];
  G.st = 'draw'; G.t0 = now; G.stEnd = now + G.opts.time * 1000;
  // letters that show up as the time runs out: up to a third of the word, spread between 40% and 85% of the time
  const letters = shuffle([...w.w].map((ch, k) => (isLetter(ch) ? k : -1)).filter(k => k >= 0));
  const n = G.opts.hints === 'on' ? Math.min(4, Math.floor(letters.length / 3)) : 0;
  G.open = letters.slice(0, n).map((k, j) => ({ k, at: now + G.opts.time * 1000 * (.4 + .45 * (j + 1) / n) }));
  G.shown = 0;
  return true;
}
const guessers = G => G.seats.map((_, s) => s).filter(s => s !== G.drawer && (here(G, s) || G.got[s] > 0));
function endTurn(G, why, now) {
  const gs = guessers(G), gain = drawPts(gs.map(s => G.got[s]), gs.length);
  G.sc[G.drawer] += gain;
  const gains = G.got.slice(); gains[G.drawer] = gain;
  G.last = { w: G.word.w, sp: G.word.sp || null, why, drawer: G.drawer, gains, n: gs.filter(s => G.got[s] > 0).length, of: gs.length };
  G.st = 'show'; G.stEnd = now + MS.show; G.pen = false;
  say(G, { k: 'word', w: G.word.w, why });
  return true;
}
function finish(G, now) {
  G.ph = 'end'; G.st = 'end'; G.endAt = now; G.picks = [];
  const place = G.seats.map((_, i) => 1 + G.sc.filter(p => p > G.sc[i]).length);
  const order = G.seats.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
  G.win = G.sc[order[0]] > 0 && place.filter(p => p === 1).length === 1 ? order[0] : -1;
  G.res = { pts: G.sc.slice(), place, order, hits: G.hits.slice() };
  return true;
}

// ---------- what players do ----------
const cleanText = s => Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029<>]/g, ' ')
  .replace(/[\u00ad\u061c\u115f\u1160\u180e\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\ufffb]/g, '').replace(/\s+/g, ' ').trim()).slice(0, MAX_TEXT).join('').trim();
const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

function draw(G, ops, now) {
  if (!Array.isArray(ops) || ops.length > 40) return false;
  for (const o of ops) {
    if (!Array.isArray(o) || G.log.length >= MAX_OPS) break;
    const k = o[0];
    if (k === OP.START) {
      if (o.length !== 5 || !int(o[1], COLORS.length - 1) || !int(o[2], SIZES.length - 1) || !int(o[3], BW) || !int(o[4], BH)) continue;
      G.pen = true; G.pts++;
    } else if (k === OP.MOVE) {
      if (!G.pen || o.length < 3 || o.length > 241 || o.length % 2 !== 1 || G.pts + o.length / 2 > MAX_PTS) continue;
      let ok = true; for (let i = 1; i < o.length; i += 2) if (!int(o[i], BW) || !int(o[i + 1], BH)) { ok = false; break; }
      if (!ok) continue;
      G.pts += (o.length - 1) / 2;
    } else if (k === OP.FILL) {
      if (o.length !== 4 || !int(o[1], COLORS.length - 1) || !int(o[2], BW) || !int(o[3], BH)) continue;
      G.pen = false;
    } else if (k === OP.UNDO) { if (o.length !== 1) continue; G.pen = false; }
    else if (k === OP.CLEAR) { // nothing before a clear matters any more
      if (o.length !== 1) continue;
      G.base += G.log.length; G.log = []; G.pen = false; G.pts = 0;
    } else continue;
    G.log.push(o); G.dd = true;
  }
  return false; // the fast() hook sends it on, at most twenty times a second
}

function guess(G, s, raw, now) {
  if (now - G.lastSay[s] < MS.say) return false;
  const text = cleanText(raw); if (!text) return false;
  G.lastSay[s] = now; G.acts[s]++;
  const key = norm(text), live = G.st === 'draw';
  // the drawer and people who already have it talk among themselves, so the word can't slip out
  if (live && (s === G.drawer || G.got[s] > 0)) { say(G, { k: 'say', s, text, in: true }); return true; }
  if (live && key && G.keys.includes(key)) {
    const pts = guessPts(G.stEnd - now, G.opts.time * 1000);
    G.got[s] = pts; G.sc[s] += pts; G.hits[s]++;
    say(G, { k: 'ok', s, pts });
    if (guessers(G).every(x => G.got[x] > 0)) endTurn(G, 'all', now);
    return true;
  }
  if (live && key && G.keys.some(w => isNear(key, w))) { say(G, { k: 'near', s, to: s, text }); return true; }
  say(G, { k: 'say', s, text });
  return true;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object') return false;
  const now = Date.now();
  if (a.t === 'sync') { // a screen that just opened (or lost a few strokes) asks for the whole picture and the seats
    if (s >= 0) { G.sync.add(s); if (G.seatSent[s] !== undefined) G.seatSent[s] = 0; } else G.syncAt = now;
    return true;
  }
  if (s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  if (a.t === 'd') return s === G.drawer && G.st === 'draw' ? (G.acts[s]++, draw(G, a.o, now)) : false;
  if (a.t === 'g') return guess(G, s, a.text, now);
  if (a.t === 'pick') return s === G.drawer && G.st === 'pick' && int(a.i, G.picks.length - 1) ? beginDraw(G, a.i, now) : false;
  if (a.t === 'skip') return s === G.drawer && G.st === 'draw' ? endTurn(G, 'skip', now) : false;
  return false;
}

// Table chat during a drawing: a line that gives the word away is starred out.
export function hush(G, text) {
  if (G.ph !== 'play' || G.st !== 'draw' || !G.keys.length) return text;
  const key = norm(text);
  return G.keys.some(w => key.includes(w)) ? '✏️ •••' : text;
}

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  if (people(G) < 2) return finish(G, now);
  if (G.st === 'pick') {
    if (!here(G, G.drawer)) return nextTurn(G, now);
    if (now >= G.stEnd) return beginDraw(G, Math.random() * G.picks.length | 0, now);
    return false;
  }
  if (G.st === 'draw') {
    if (!here(G, G.drawer)) return endTurn(G, 'left', now);
    const gs = guessers(G);
    if (gs.length && gs.every(s => G.got[s] > 0)) return endTurn(G, 'all', now);
    if (now >= G.stEnd) return endTurn(G, 'time', now);
    const shown = G.open.filter(o => now >= o.at).length;
    if (shown !== G.shown) { G.shown = shown; return true; }
    return false;
  }
  if (G.st === 'show' && now >= G.stEnd) return nextTurn(G, now);
  return false;
}
export function fast(G) { if (!G.dd) return false; G.dd = false; return true; }

// Someone who drops out is simply skipped until they are back: nobody plays for them.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.away === away) return false;
  seat.away = away; G.seatRev++;
  if (!away) { G.sync.add(s); G.seatSent[s] = 0; }
  return true;
}
// A watcher who asks for a seat joins at the start of the next turn (there are no bots to take over).
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(x => x.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return true;
}

function hintOf(G) {
  const open = new Set(G.open.slice(0, G.shown).map(o => o.k));
  return [...G.word.w].map((ch, k) => (!isLetter(ch) || open.has(k) ? ch : '_')).join('');
}
export function view(G, s) {
  const now = Date.now(), seat = s >= 0, live = G.st === 'draw';
  const knows = live && seat && (s === G.drawer || G.got[s] > 0);
  // the picture: only the strokes this screen has not had yet (everything after a sync)
  let from = G.base + G.log.length, ops = [], full = false;
  if (G.st === 'draw' || G.st === 'show') {
    if (seat) {
      if (G.sync.delete(s)) { from = G.base; ops = G.log; full = true; }
      else if (s !== G.drawer) { from = Math.max(G.base, G.sent[s]); ops = G.log.slice(from - G.base); }
      G.sent[s] = G.base + G.log.length;
    } else if (now - G.syncAt < 400) { from = G.base; ops = G.log; full = true; }
    else { // watchers share one view: every watcher asked in the same instant gets the same new strokes
      if (G.wAt !== now) { G.wFrom = G.wTo; G.wTo = G.base + G.log.length; G.wAt = now; }
      from = Math.max(G.base, G.wFrom); ops = G.log.slice(from - G.base);
    }
  }
  const seats = !seat || G.seatSent[s] !== G.seatRev ? G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, id: x.id, human: x.human, bot: false, away: x.away })) : undefined;
  if (seat) G.seatSent[s] = G.seatRev;
  return {
    game: 'kal', ph: G.ph, st: G.st, gid: G.gid, tid: G.tid, me: s, opts: G.opts, round: Math.min(G.round, G.opts.rounds), turn: G.oi + 1, turns: G.order.length,
    drawer: G.drawer, left: Math.max(0, G.stEnd - now), total: G.st === 'draw' ? G.opts.time * 1000 : G.st === 'pick' ? MS.pick : MS.show,
    seats, n: G.seats.length, sc: G.sc, got: G.got.map(p => p > 0),
    picks: seat && s === G.drawer && G.st === 'pick' ? G.picks.map(w => ({ w: w.w, sp: w.sp || null, theme: w.theme })) : null,
    word: knows ? G.word.w : null, pet: knows && G.word.sp ? G.word.sp : null, hint: live ? hintOf(G) : null,
    last: G.last, d: { n: G.base + G.log.length, from, ops, full },
    feed: G.feed.filter(e => (e.to === undefined || e.to === s) && (!e.in || !live || knows)),
    res: G.res, win: G.win,
  };
}

// Placed by points. Someone who never drew a line and never typed a guess earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.sc[i], win: G.res.place[i] === 1 && G.sc[i] > 0, place: G.res.place[i], idle: x.human && G.acts[i] === 0 }));
}

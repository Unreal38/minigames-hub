// Snack Swap: a prompt card comes up, everyone secretly plays one silly item from their hand,
// the cards are shown without names and everyone votes for the funniest. Votes are points.
import { ITEM_COUNT, HAND, PROMPTS, MAX_PROMPTS, CHAOS, cleanPrompt } from '../../public/games/snackswap/deck.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'snackswap', name: 'Snack Swap', minPlayers: 1, maxPlayers: 8 };

const BOT_NAMES = ['Mochi', 'Peanut', 'Waffle', 'Sprout', 'Noodle', 'Biscuit', 'Pudding', 'Olive'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const REVEAL_MS = 11_000, ALL_IN_MS = 1200;
const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Custom prompts live in the table options as [{ text, by, id }], so the whole waiting room sees them.
function cleanPrompts(list) {
  const out = [], seen = new Set();
  for (const p of Array.isArray(list) ? list : []) {
    const text = cleanPrompt(p?.text), key = text.toLowerCase();
    if (text.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push({ text, by: String(p.by ?? '').slice(0, 16), id: String(p.id ?? '').slice(0, 16) });
    if (out.length >= MAX_PROMPTS) break;
  }
  return out;
}

export function cleanOpts(o = {}) {
  return {
    rounds: [5, 8, 12].includes(+o.rounds) ? +o.rounds : 8,
    timer: [30, 45, 60, 90].includes(+o.timer) ? +o.timer : 45,
    chaos: o.chaos === 'off' ? 'off' : 'on',
    field: [0, 4, 6, 8].includes(+o.field) ? +o.field : 4, // bots fill the table up to this many seats
    mix: o.mix === 'custom' ? 'custom' : 'all',
    prompts: cleanPrompts(o.prompts),
  };
}

// Anyone at the table may add a prompt in the waiting room; you can remove your own, the host can remove any.
export function roomAct(room, who, a) {
  if (!a || typeof a !== 'object') return false;
  const list = room.opts.prompts || [];
  if (a.t === 'addPrompt') {
    const text = cleanPrompt(a.text);
    if (text.length < 3) return 'Prompts need at least three letters.';
    if (list.length >= MAX_PROMPTS) return `This table already has ${MAX_PROMPTS} custom prompts.`;
    if (list.some(p => p.text.toLowerCase() === text.toLowerCase())) return 'Someone already added that one.';
    room.opts = cleanOpts({ ...room.opts, prompts: [...list, { text, by: who.name, id: who.id }] });
    return true;
  }
  if (a.t === 'delPrompt') {
    const i = a.i | 0, p = list[i];
    if (!p || (p.id !== who.id && !who.host)) return false;
    room.opts = cleanOpts({ ...room.opts, prompts: list.filter((_, k) => k !== i) });
    return true;
  }
  return false;
}

export function create(players, optsIn = {}, prev = null) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, 8).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  let bi = 0;
  while (seats.length < Math.max(opts.field, 3)) seats.push({ id: null, name: names[bi], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false });
  const n = seats.length;

  // Prompt pile: the table's own prompts come up first, then built-in ones this table has not seen lately.
  const seen = new Set(prev?.game === 'snackswap' ? prev.seen : []);
  let fresh = PROMPTS.map((_, i) => i).filter(i => !seen.has(i));
  if (fresh.length < opts.rounds) { seen.clear(); fresh = PROMPTS.map((_, i) => i); }
  const custom = shuffle(opts.prompts.map(p => ({ text: p.text, by: p.by })));
  const builtin = opts.mix === 'custom' && custom.length ? [] : shuffle(fresh).map(i => ({ text: PROMPTS[i], by: '', i }));
  let pile = [...custom, ...builtin];
  while (pile.length < opts.rounds) pile = pile.concat(shuffle(pile.slice())); // tiny custom-only piles repeat
  pile = shuffle(pile.slice(0, opts.rounds));

  const G = {
    game: 'snackswap', ph: 'play', stage: 'play', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    round: 0, rounds: opts.rounds, pile, prompt: null, seen: [...seen],
    deck: [], discard: [], hands: seats.map(() => []),
    plays: seats.map(() => null), order: [], votes: seats.map(() => null), slots: null,
    chaos: seats.map(() => null),            // which chaos card each seat has spent this game
    dd: seats.map(() => false), steal: seats.map(() => false),
    pts: seats.map(() => 0), wins: seats.map(() => 0), votesGot: seats.map(() => 0),
    stageEnd: 0, botAt: seats.map(() => 0), botPlan: seats.map(() => null),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  const copies = Math.ceil(n * HAND * 1.6 / ITEM_COUNT);
  for (let k = 0; k < copies; k++) for (let i = 0; i < ITEM_COUNT; i++) G.deck.push(i);
  shuffle(G.deck);
  newRound(G);
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 16) G.ev.shift(); }

// Take the next card from the deck, skipping ones this hand already holds so nobody gets twins.
function draw(G, hand = []) {
  if (!G.deck.length) { G.deck = shuffle(G.discard); G.discard = []; }
  for (let i = G.deck.length - 1; i >= 0; i--) if (!hand.includes(G.deck[i])) return G.deck.splice(i, 1)[0];
  return G.deck.pop();
}

function newRound(G) {
  const now = Date.now(), n = G.seats.length;
  G.round++;
  G.prompt = G.pile[G.round - 1];
  if (G.prompt.i !== undefined) G.seen.push(G.prompt.i);
  for (let s = 0; s < n; s++) {
    if (G.plays[s]) G.discard.push(G.plays[s].c);
    while (G.hands[s].length < HAND) { const c = draw(G, G.hands[s]); if (c === undefined) break; G.hands[s].push(c); }
  }
  G.plays = G.seats.map(() => null); G.votes = G.seats.map(() => null);
  G.dd = G.seats.map(() => false); G.steal = G.seats.map(() => false);
  G.order = []; G.slots = null;
  G.stage = 'play'; G.stageEnd = now + G.opts.timer * 1000;
  for (let s = 0; s < n; s++) planBot(G, s, now);
  pushEv(G, { t: 'round', r: G.round });
}

// Decide now what a bot will do this stage, so it looks like it is thinking for a moment.
function planBot(G, s, now) {
  G.botAt[s] = now + rnd(2200, Math.min(9000, G.opts.timer * 400));
  const canChaos = G.opts.chaos === 'on' && !G.chaos[s] && G.round > 1;
  G.botPlan[s] = canChaos && Math.random() < .16 ? (Math.random() < .5 ? 'double' : 'steal') : null;
}

function play(G, s, idx) {
  const hand = G.hands[s];
  if (G.stage !== 'play' || G.plays[s] || !Number.isInteger(idx) || idx < 0 || idx >= hand.length) return false;
  G.plays[s] = { c: hand.splice(idx, 1)[0] };
  pushEv(G, { t: 'played', s });
  return true;
}

function chaos(G, s, k, target) {
  if (G.opts.chaos !== 'on' || G.chaos[s] || !CHAOS[k] || CHAOS[k].when !== G.stage) return false;
  if (k === 'swap') {
    if (G.plays[s] || !Number.isInteger(target) || target === s || !G.seats[target]) return false;
    [G.hands[s], G.hands[target]] = [G.hands[target], G.hands[s]];
    pushEv(G, { t: 'swap', a: s, b: target });
  } else if (k === 'double') G.dd[s] = true;
  else if (k === 'steal') { if (!G.plays[s]) return false; G.steal[s] = true; }
  G.chaos[s] = k;
  return true;
}

function vote(G, s, slot) {
  if (G.stage !== 'vote' || !Number.isInteger(slot) || slot < 0 || slot >= G.order.length || G.order[slot] === s) return false;
  G.votes[s] = slot;
  return true;
}

function openVoting(G, now) {
  for (let s = 0; s < G.seats.length; s++) if (!G.plays[s] && G.hands[s].length) play(G, s, Math.random() * G.hands[s].length | 0); // too slow: a random card goes in
  G.order = shuffle(G.seats.map((_, s) => s).filter(s => G.plays[s]));
  G.stage = 'vote'; G.stageEnd = now + Math.min(G.opts.timer, 45) * 1000;
  for (let s = 0; s < G.seats.length; s++) G.botAt[s] = now + rnd(2500, 8000);
  pushEv(G, { t: 'vote' });
}

function reveal(G, now) {
  const n = G.order.length, slotOf = s => G.order.indexOf(s);
  const voters = G.order.map(() => []);
  G.votes.forEach((slot, s) => { if (slot !== null && voters[slot]) voters[slot].push(s); });
  const cnt = voters.map(v => v.length), stolen = G.order.map(() => 0), lost = G.order.map(() => 0);
  for (const s of shuffle(G.seats.map((_, i) => i).filter(i => G.steal[i]))) {
    const mine = slotOf(s);
    let best = -1;
    for (let k = 0; k < n; k++) if (k !== mine && cnt[k] > 0 && (best < 0 || cnt[k] > cnt[best] || (cnt[k] === cnt[best] && Math.random() < .5))) best = k;
    if (best < 0) { G.chaos[s] = null; G.steal[s] = false; continue; } // nothing to pinch: you keep the card
    cnt[best]--; cnt[mine]++; lost[best]++; stolen[mine]++;
  }
  const top = Math.max(0, ...cnt), tied = cnt.filter(c => c === top).length;
  G.slots = G.order.map((s, k) => {
    const pts = cnt[k] * (G.dd[s] ? 2 : 1), won = top > 0 && cnt[k] === top && tied < n; // a dead heat crowns nobody
    G.pts[s] += pts; G.votesGot[s] += cnt[k]; if (won) G.wins[s]++;
    return { c: G.plays[s].c, by: s, voters: voters[k], n: cnt[k], pts, dd: G.dd[s], stolen: stolen[k], lost: lost[k], won };
  });
  G.stage = 'reveal'; G.stageEnd = now + REVEAL_MS;
  pushEv(G, { t: 'reveal', r: G.round });
}

function finish(G) {
  const idx = G.seats.map((_, i) => i).sort((a, b) => G.pts[b] - G.pts[a] || G.wins[b] - G.wins[a] || a - b);
  const best = G.pts[idx[0]];
  let place = 0;
  const places = [];
  idx.forEach((s, k) => { if (k === 0 || G.pts[s] !== G.pts[idx[k - 1]]) place = k + 1; places[s] = place; });
  G.ph = 'end'; G.stage = 'end'; G.endAt = Date.now(); G.win = idx[0];
  G.res = { order: idx, places, winners: idx.filter(s => G.pts[s] === best), pts: G.pts.slice(), wins: G.wins.slice(), votes: G.votesGot.slice() };
  pushEv(G, { t: 'end', w: G.res.winners });
}

// What a finished game hands to lobby scores, stats and XP: one row per seat, best first.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return {
    game: 'snackswap', rounds: G.rounds,
    players: G.res.order.map(s => ({
      id: G.seats[s].id, name: G.seats[s].name, bot: !G.seats[s].human,
      points: G.res.pts[s], place: G.res.places[s], won: G.res.winners.includes(s),
      roundsWon: G.res.wins[s], votes: G.res.votes[s],
    })),
  };
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play') return false;
  if (a.t === 'play') return play(G, s, a.i);
  if (a.t === 'vote') return vote(G, s, a.slot);
  if (a.t === 'chaos') return chaos(G, s, a.k, a.m);
  if (a.t === 'next') { // skip the rest of the reveal
    if (G.stage !== 'reveal' || G.stageEnd - Date.now() > REVEAL_MS - 2500) return false;
    G.stageEnd = Date.now(); return true;
  }
  return false;
}

function botStep(G, s, now) {
  if (now < G.botAt[s]) return false;
  if (G.stage === 'play' && !G.plays[s]) {
    if (G.botPlan[s] === 'double') chaos(G, s, 'double');
    return play(G, s, Math.random() * G.hands[s].length | 0);
  }
  if (G.stage === 'vote' && G.votes[s] === null) {
    if (G.botPlan[s] === 'steal') chaos(G, s, 'steal');
    const others = G.order.map((_, k) => k).filter(k => G.order[k] !== s);
    return others.length ? vote(G, s, others[Math.random() * others.length | 0]) : false;
  }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  let ch = false;
  if (G.stage === 'play' || G.stage === 'vote') {
    for (let s = 0; s < G.seats.length; s++) if (G.seats[s].bot && botStep(G, s, now)) ch = true;
    const done = G.stage === 'play' ? G.plays.every(Boolean) : G.votes.every(v => v !== null);
    if (done && G.stageEnd - now > ALL_IN_MS) { G.stageEnd = now + ALL_IN_MS; ch = true; }
  }
  if (now < G.stageEnd) return ch;
  if (G.stage === 'play') openVoting(G, now);
  else if (G.stage === 'vote') reveal(G, now);
  else if (G.round >= G.rounds) finish(G);
  else newRound(G);
  return true;
}

// A player who drops out keeps their seat; a bot picks and votes for them until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (away) { G.botAt[s] = Date.now() + 1500; G.botPlan[s] = null; }
  return true;
}

export function view(G, s) {
  const now = Date.now(), shown = G.stage === 'reveal' || G.stage === 'end';
  const mySlot = s >= 0 ? G.order.indexOf(s) : -1;
  return {
    game: 'snackswap', ph: G.ph, stage: G.stage, gid: G.gid, me: s, round: G.round, rounds: G.rounds,
    left: Math.max(0, G.stageEnd - now), timer: G.opts.timer, chaosOn: G.opts.chaos === 'on', prompt: G.prompt && { text: G.prompt.text, by: G.prompt.by },
    seats: G.seats.map((x, i) => ({
      name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id, pts: G.pts[i],
      played: !!G.plays[i], voted: G.votes[i] !== null, cards: G.hands[i].length,
    })),
    hand: s >= 0 ? G.hands[s] : [],
    myPlay: s >= 0 && G.plays[s] ? G.plays[s].c : null,
    myVote: s >= 0 ? G.votes[s] : null, mySlot,
    myChaos: s >= 0 ? { used: G.chaos[s], dd: G.dd[s], steal: G.steal[s] } : null,
    // cards on the table: anonymous while voting, everything once revealed
    slots: shown && G.slots ? G.slots : G.stage === 'vote' ? G.order.map(p => ({ c: G.plays[p].c })) : null,
    res: G.res, ev: G.ev,
  };
}

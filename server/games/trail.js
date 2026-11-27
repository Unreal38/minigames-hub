// Friendship Trail (Szlak przyjaźni): a party tournament for 2 to 6 players. Everyone walks a big island trail with
// their own Pet Farm pet, rolling a die. Wild Pet Farm pets wander the trail: stop on or next to one and win it over
// with an element showdown or with treats, and it joins your herd. Each friend can reroll your die once (a Spark friend
// every round) and cheer you up one place in a minigame once. Stall stones sell items, special stones hatch eggs, open
// buddy pacts, grant wishes. After every round the whole table plays a quick preset of a real hub minigame: the server
// (server.js) starts that game with the same seats when this one reaches stage 'mini', and hands the places back with
// miniDone(). After the last round the Pet Show hands out ribbons, and the most points wins.
//
// Nothing here is secret: every player sees every herd, roll and wild pet. Bots think for a moment before each choice.
import {
  NODES, N, near, dist, STRONG, ELS, oddsOf, priceOf, HERD_MAX, ITEM_MAX, LURE, PACT_ROUNDS, EGG_TURNS, WILD_MAX,
  START_TREATS, START, payFor, ribbonsOf, showPts, ITEMS, ITEM_IDS, ruleSeason, WX_EL, poolFor, ROUNDS, HAND, CARD_DECK, landsOf,
} from '../../public/games/trail/rules.js';
import { SPECIES } from '../../public/games/farm/data.js';
import { randomAv, seasonOn } from '../../public/avatar.js';
import { weatherAt } from '../../public/weather.js';
import { cleanSeats } from '../seats.js';

export const meta = { id: 'trail', name: 'Friendship Trail', minPlayers: 1, maxPlayers: 6, seats: { lo: 2, def: 4 }, pets: true, joinAt: 'game', coins: 50 }; // coins: 1st place pays 50 (Kuba 2026-11-27), last 5

const BOT_NAMES = ['Biscuit', 'Pepper', 'Mochi', 'Captain', 'Waffles', 'Clover', 'Nugget', 'Pickle'];
const BOT_COLS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
// how long things take on screen: the intro, one hop, the wheel before a minigame, the minigame results, the Pet Show
// A calm pace (Kuba 2026-11-27: the first version raced through 8 rounds in a few minutes and was hard to follow).
export const MS = { intro: 52000, hop: 420, say: 1500, dice: 2000, card: 1800, turn: 1400, wheel: 5500, res: 8000, show: 21000, cheer: 14000 };
// Bots wait a moment before each choice, so they look like they're thinking (Kuba, 2026-11-26). Sharp bots are quicker.
export const THINK = { chill: [1400, 2600], sharp: [1100, 2000] };
export const TIMERS = [20, 30, 45, 0];

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = a => a[Math.random() * a.length | 0];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
// The wild pets: every single-element Pet Farm species, by element and rarity.
const WILD = Object.entries(SPECIES).filter(([, d]) => !d.el2 && d.rare <= 2 && ELS.includes(d.el)).map(([sp, d]) => ({ sp, el: d.el, rare: d.rare }));
const COMMON = WILD.filter(w => w.rare === 0);

export function cleanOpts(o = {}) {
  return {
    seats: cleanSeats(meta, o.seats),
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    rounds: ROUNDS.includes(+o.rounds) ? +o.rounds : 8,
    timer: TIMERS.includes(+o.timer) ? +o.timer : 30,
  };
}

function seasonNow(now = new Date()) { for (const s of ['halloween', 'winter', 'spring', 'summer']) if (seasonOn(s, now)) return ruleSeason(s); return 'autumn'; }

const friendOf = (w, extra = {}) => ({ sp: w.sp, el: w.el, rare: w.rare, cheer: true, rr: true, ...extra });

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = BOT_NAMES.filter(n => !used.has(n)).sort(() => Math.random() - .5);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true, pet: p.pets?.[0] || null }));
  const taken = new Set(seats.map(s => s.color.toLowerCase()));
  const cols = [...BOT_COLS.filter(c => !taken.has(c)), ...BOT_COLS];
  const n = Math.max(opts.seats, seats.length, 2);
  let bi = 0;
  while (seats.length < n) seats.push({ id: null, name: names[bi % names.length], color: cols[bi++ % cols.length], av: randomAv(), bot: true, human: false, pet: null });
  // Everyone starts with their own isle pet (the one they show off first), or a common starter.
  const starts = shuffle([...COMMON]);
  const pl = seats.map((seat, i) => {
    const own = seat.pet && SPECIES[seat.pet.sp] ? seat.pet : null, d = own ? SPECIES[own.sp] : null;
    const st = own ? { sp: own.sp, el: d.el2 ? d.el : d.el, rare: d.rare, name: own.name || '', look: own.look || null } : { ...starts[i % starts.length] };
    return { pos: START, hand: [], deck: [], treats: START_TREATS, herd: [friendOf(st, { start: true, name: st.name || '', look: st.look || null })], items: [], egg: 0, pact: null, wins: 0, got: 0, charm: false, berry: false, whistle: false, guard: false };
  });
  const now = Date.now(), wx = weatherAt(now).kind;
  const G = {
    game: 'trail', ph: 'play', stage: 'intro', gid: Math.random().toString(36).slice(2, 8), seats, opts, pl, order: seats.map((_, i) => i), first: null,
    season: seasonNow(), wx, round: 1, turn: 0, wild: [], wildN: 0, honey: {}, pend: null, die: null,
    walk: null, mini: null, cheer: seats.map(() => -1), res: null, show: null, win: -1,
    stageEnd: now + MS.intro, busy: 0, tEnd: 0, botAt: 0, ev: [], evN: 0, endAt: 0,
  };
  // lay the wild pets out a few times and keep the most spread-out map (one greedy pass sometimes boxes itself in)
  const ev0 = [...G.ev], evN0 = G.evN, spread = () => Math.min(99, ...G.wild.flatMap(a => G.wild.filter(b => b !== a).map(b => dist(a.pos, b.pos))));
  let best = null;
  for (let k = 0; k < 40 && !(best?.m >= 8); k++) {
    G.wild = []; G.wildN = 0; G.ev = [...ev0]; G.evN = evN0;
    for (let i = 0; i < WILD_MAX; i++) spawnWild(G);
    const m = spread(); if (!best || m > best.m) best = { m, wild: G.wild, ev: G.ev, evN: G.evN, wildN: G.wildN };
  }
  Object.assign(G, { wild: best.wild, ev: best.ev, evN: best.evN, wildN: best.wildN });
  return G;
}

// Everyone starts in the start meadow beside the first stone (pos -1, Kuba 2026-11-27); the first step is onto stone 0.
const at0 = pos => Math.max(0, pos);

// e.n is the event's number on the screen side, so an event's own amounts go in v
function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 40) G.ev.shift(); }
const think = G => rnd(...(THINK[G.opts.bots] || THINK.chill));

// ---------- wild pets ----------
function spawnWild(G, at = null, rareOnly = false) {
  // a stone at least 8 from every other wild pet and 5 from every player; when none is left, the one farthest from the pets
  const gap = i => Math.min(99, ...G.wild.map(w => dist(w.pos, i))), clear = i => !G.pl.some(p => dist(at0(p.pos), i) < 5);
  const all = [...Array(N).keys()], free = all.filter(i => gap(i) >= 8 && clear(i));
  const far = () => { const ok = all.filter(clear).length ? all.filter(clear) : all, m = Math.max(...ok.map(gap)); return pickOf(ok.filter(i => gap(i) === m)); };
  const pos = at ?? (free.length ? pickOf(free) : far());
  const wxEl = WX_EL[G.wx], rainbow = G.wx === 'rainbow';
  let pool = rareOnly ? WILD.filter(w => w.rare === 2) : WILD;
  if (!rareOnly) { const roll = Math.random(); pool = pool.filter(w => w.rare === (roll < (rainbow ? .45 : .6) ? 0 : roll < (rainbow ? .75 : .88) ? 1 : 2)); if (wxEl && Math.random() < .4) pool = pool.filter(w => w.el === wxEl); }
  const pick = pickOf(pool.length ? pool : WILD);
  const w = { id: ++G.wildN, sp: pick.sp, el: pick.el, rare: pick.rare, pos };
  G.wild.push(w); pushEv(G, { t: 'wild', w: { ...w } });
  return w;
}
const takeWild = (G, w) => { G.wild = G.wild.filter(x => x !== w); };

// ---------- asking a seat ----------
// G.pend: the choice one seat must make now. { s, k, ...k's options }. People get the table timer; bots think first.
function ask(G, s, k, extra, now) {
  G.pend = { s, k, ...extra };
  const t = Math.max(now, G.busy);
  G.tEnd = G.seats[s].bot || !G.opts.timer ? 0 : t + G.opts.timer * 1000;
  G.botAt = t + think(G);
  return true;
}

// ---------- turns ----------
function startTurn(G, s, now) {
  G.turn = s; G.stage = 'turn'; G.die = null; G.walk = null;
  const p = G.pl[s]; p.charm = false; p.guard = false;
  pushEv(G, { t: 'turn', s });
  // catch-up: whoever has the fewest friends gets their starter's reroll back every turn, so an early lucky streak can't snowball (Kuba 2026-11-27)
  if (p.herd.length <= Math.min(...G.pl.map(q => q.herd.length))) { const st = p.herd.find(f => f.start); if (st && !st.rr) { st.rr = true; pushEv(G, { t: 'boost', s, sp: st.sp }); } }
  if (p.pact && G.round > p.pact.until) { const o = p.pact.w; pushEv(G, { t: 'pactend', s, o }); p.pact = null; if (G.pl[o].pact?.w === s) G.pl[o].pact = null; }
  if (p.egg && --p.egg === 0) {
    const pick = pickOf(WILD);
    if (p.herd.length < HERD_MAX) { p.herd.push(friendOf(pick, { egg: true })); pushEv(G, { t: 'hatch', s, sp: pick.sp }); if (p.pact) G.pl[p.pact.w].treats += 3; }
  }
  fillHand(G, s);
  return askCard(G, s, now);
}
function nextTurn(G, now) {
  G.pend = null;
  const k = G.order.indexOf(G.turn);
  if (k + 1 < G.order.length) return startTurn(G, G.order[k + 1], now);
  return startCheer(G, now);
}

// ---------- who goes first (Kuba 2026-11-27) ----------
// After the intro everyone rolls a die in seat order; the highest goes first. Seats that tie roll again among themselves
// (their earlier rolls still count first), until every place is settled. G.order is then the turn order for every round.
function startOrder(G, now) {
  G.stage = 'order'; G.first = { key: G.seats.map(() => []), todo: G.seats.map((_, i) => i), tie: [] };
  pushEv(G, { t: 'firstgo' });
  G.stageEnd = now + MS.say; G.pend = null;
  return true;
}
function orderNext(G, now) {
  const F = G.first;
  if (F.todo.length) return ask(G, F.todo.shift(), 'first', {}, now);
  const cmp = (a, b) => { const x = F.key[a], y = F.key[b]; for (let k = 0; k < Math.max(x.length, y.length); k++) if ((y[k] || 0) !== (x[k] || 0)) return (y[k] || 0) - (x[k] || 0); return 0; };
  const tied = G.seats.map((_, i) => i).filter(i => G.seats.some((_, j) => j !== i && cmp(i, j) === 0));
  if (tied.length) { F.todo = tied; F.tie = tied; pushEv(G, { t: 'firsttie', who: tied }); G.stageEnd = now + MS.say; return true; }
  G.order = G.seats.map((_, i) => i).sort(cmp); G.first = null;
  pushEv(G, { t: 'order', order: [...G.order] });
  G.stage = 'next'; G.turn = -1; G.stageEnd = now + MS.say * 2;
  G.startRound = true;
  return true;
}
function firstRoll(G, s, now) {
  const d = 1 + (Math.random() * 6 | 0);
  G.first.key[s].push(d); G.pend = null;
  pushEv(G, { t: 'first', s, d, tie: G.first.tie.includes(s) });
  G.busy = now + MS.dice; G.stageEnd = now + MS.dice + 300;
  return true;
}
// ---------- trail cards ----------
function draw(G, s) { const p = G.pl[s]; p.deck ||= []; if (!p.deck.length) p.deck = shuffle([...CARD_DECK]); return p.deck.pop(); }
function fillHand(G, s) { const p = G.pl[s]; p.hand ||= []; while (p.hand.length < HAND) p.hand.push(draw(G, s)); }
// friends who can swap your hand for a new one (each once, Spark friends every round)
const redrawers = p => p.herd.map((f, i) => (f.rr ? i : -1)).filter(i => i >= 0);
function askCard(G, s, now) { return ask(G, s, 'card', { f: redrawers(G.pl[s]) }, now); }
function playCard(G, s, i, now) {
  const p = G.pl[s], d = p.hand[i];
  if (!Number.isInteger(d)) return false;
  p.hand.splice(i, 1); while (p.hand.length > HAND) p.deck.push(p.hand.pop()); // a Spyglass card not played goes back
  G.die = d; pushEv(G, { t: 'card', s, d });
  G.busy = now + MS.card;
  return waitDice(G, now);
}
function redraw(G, s, i, now) {
  const p = G.pl[s], f = p.herd[i];
  if (!f?.rr) return false;
  f.rr = false; const was = p.hand.slice(), n = p.hand.length;
  p.deck.push(...was); shuffle(p.deck); p.hand = []; for (let k = 0; k < n; k++) p.hand.push(draw(G, s));
  pushEv(G, { t: 'redraw', s, f: i, sp: f.sp, was, hand: p.hand.slice() });
  G.busy = now + MS.say * .8;
  return askCard(G, s, now);
}
// The walk starts only once everyone has seen the card played.
function waitDice(G, now) { G.pend = null; G.stage = 'rolled'; G.stageEnd = Math.max(now, G.busy); return true; }
function startWalk(G, s, d, now) { G.walk = { left: d, path: [] }; G.stage = 'walk'; G.pend = null; return advance(G, s, now); }
// Walk stone by stone. A fork or a stall on the way stops the walk to ask; the walk goes on after the answer.
function advance(G, s, now) {
  const p = G.pl[s], W = G.walk;
  while (W.left > 0) {
    const nd = p.pos < 0 ? { next: [0] } : NODES[p.pos];
    if (nd.next.length > 1 && W.fork == null) { flushHop(G, s, now); return ask(G, s, 'fork', { opts: nd.next.slice() }, now); }
    const to = W.fork ?? nd.next[0]; W.fork = null;
    p.pos = to; W.left--; W.path.push(to);
    if (NODES[to].kind === 'stall' && canShop(G, s)) { flushHop(G, s, now); return ask(G, s, 'shop', {}, now); }
  }
  flushHop(G, s, now);
  return land(G, s, now);
}
// Send the stones walked so far as one hop event; the screen takes MS.hop per stone, and nothing else happens till then.
function flushHop(G, s, now) {
  const W = G.walk; if (!W?.path.length) return;
  pushEv(G, { t: 'hop', s, path: W.path.slice() });
  G.busy = Math.max(now, G.busy) + W.path.length * MS.hop; W.path = [];
}
const canShop = (G, s) => G.pl[s].items.length < ITEM_MAX && ITEM_IDS.some(k => ITEMS[k].c <= G.pl[s].treats);

// ---------- landing ----------
function land(G, s, now) {
  G.stage = 'land'; G.pend = null; G.walk = null;
  const p = G.pl[s], at = p.pos, kind = NODES[at].kind;
  const hon = G.honey[at];
  if (hon != null && hon !== s) { const n = Math.min(4, p.treats); p.treats -= n; G.pl[hon].treats += n; delete G.honey[at]; pushEv(G, { t: 'honey', s, o: hon, v: n, pos: at }); }
  if (kind === 'treat') gain(G, s, G.season === 'summer' ? 4 : 3, 'treat');
  else if (kind === 'picnic') gain(G, s, G.season === 'spring' ? 7 : 5, 'picnic');
  else if (kind === 'bramble') {
    if (p.guard) pushEv(G, { t: 'stone', s, kind: 'guarded', v: 0 });
    else if (G.season === 'winter') { pushEv(G, { t: 'slide', s }); G.walk = { left: 2, path: [] }; G.stage = 'walk'; G.busy = Math.max(now, G.busy) + MS.say; return advance(G, s, now); }
    else { const n = Math.min(3, p.treats); p.treats -= n; pushEv(G, { t: 'stone', s, kind, v: -n }); }
  }
  else if (kind === 'nest') { if (p.egg || p.herd.length >= HERD_MAX) pushEv(G, { t: 'stone', s, kind: 'nest0', v: 0 }); else { p.egg = EGG_TURNS; pushEv(G, { t: 'egg', s }); } }
  else if (kind === 'spring') { p.herd.forEach(f => { f.cheer = true; f.rr = true; }); gain(G, s, 2, 'spring'); }
  else if (kind === 'den') { const w = spawnWild(G, at, true); pushEv(G, { t: 'den', s, sp: w.sp }); }
  else if (kind === 'well') { G.busy = Math.max(now, G.busy) + MS.say; if (p.treats >= 5) return ask(G, s, 'well', {}, now); }
  else if (kind === 'bench') {
    const free = G.seats.map((_, i) => i).filter(i => i !== s && !G.pl[i].pact);
    if (!p.pact && free.length) { G.busy = Math.max(now, G.busy) + MS.say; return ask(G, s, 'bench', { opts: free }, now); }
    pushEv(G, { t: 'stone', s, kind: 'bench0', v: 0 });
  }
  G.busy = Math.max(now, G.busy) + MS.say;
  return afterLand(G, s, now);
}
function gain(G, s, n, kind) { G.pl[s].treats += n; pushEv(G, { t: 'stone', s, kind, v: n }); }
// After the stone: the Pet Whistle, then every wild pet nearby, then maybe a lure, then the next player.
function afterLand(G, s, now) {
  const p = G.pl[s];
  if (p.whistle) {
    p.whistle = false;
    const w = [...G.wild].sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos))[0];
    if (w && w.pos !== p.pos) { w.pos = p.pos; pushEv(G, { t: 'called', s, id: w.id, sp: w.sp, pos: w.pos }); G.busy = Math.max(now, G.busy) + MS.say; }
  }
  return nextMeet(G, s, now);
}
function nextMeet(G, s, now) {
  const p = G.pl[s];
  p.met ||= []; // the wild pets already met on this stop (an array: tables are saved as JSON)
  const w = G.wild.find(x => x.pos === p.pos && !p.met.includes(x.id)); // only a pet on the very stone you stop on (Kuba 2026-11-27)
  if (w) {
    p.met.push(w.id);
    if (p.herd.length >= HERD_MAX) { pushEv(G, { t: 'full', s }); return nextMeet(G, s, now); }
    return ask(G, s, 'meet', { id: w.id }, now);
  }
  p.met = null;
  return tryLure(G, s, now);
}
function tryLure(G, s, now) {
  const p = G.pl[s];
  const o = G.seats.map((_, i) => i).find(i => i !== s && G.pl[i].pos === p.pos && G.pl[i].herd.length > 1 && !G.pl[i].herd[G.pl[i].herd.length - 1].start && !G.pl[i].charm && p.pact?.w !== i);
  if (o != null && p.treats >= LURE && p.herd.length < HERD_MAX) return ask(G, s, 'lure', { o }, now);
  return endTurn(G, now);
}
function endTurn(G, now) { G.pend = null; G.stage = 'next'; G.stageEnd = Math.max(now, G.busy) + MS.turn; return true; }

// ---------- the choices ----------
function befriend(G, s, w, how, now) {
  const p = G.pl[s];
  if (how.treat) {
    const c = Math.max(1, priceOf(w.rare) - (G.season === 'autumn' ? 2 : 0));
    if (p.treats < c) return false;
    p.treats -= c; join(G, s, w); pushEv(G, { t: 'bought', s, sp: w.sp, c, id: w.id });
  } else {
    const f = p.herd[how.k]; if (!f) return false;
    const ok = Math.random() < oddsOf(f.el, w.el, p.berry); p.berry = false;
    pushEv(G, { t: 'showdown', s, f: how.k, sp: f.sp, wsp: w.sp, ok, id: w.id });
    if (ok) join(G, s, w);
    else { // it runs off down the trail
      const far = [...Array(N).keys()].filter(i => dist(i, at0(p.pos)) > 8 && !G.wild.some(x => x !== w && dist(x.pos, i) < 3));
      w.pos = far.length ? pickOf(far) : w.pos; pushEv(G, { t: 'flee', id: w.id, sp: w.sp, pos: w.pos });
    }
  }
  G.busy = Math.max(now, G.busy) + MS.say * 1.6;
  return nextMeet(G, s, now);
}
function join(G, s, w) {
  const p = G.pl[s];
  takeWild(G, w); p.herd.push(friendOf(w));
  if (p.pact) G.pl[p.pact.w].treats += 3;
  if (G.wild.length < WILD_MAX) spawnWild(G);
}
function useItem(G, s, k, now) {
  const p = G.pl[s], i = p.items.indexOf(k);
  if (i < 0 || (k === 'honey' && p.pos < 0)) return false;
  p.items.splice(i, 1);
  if (k === 'whistle') p.whistle = true;
  if (k === 'berry') p.berry = true;
  if (k === 'spy') { p.hand.push(draw(G, s)); if (G.pend?.k === 'card') G.pend.f = redrawers(p); }
  if (k === 'charm') p.charm = true;
  if (k === 'pouch') { p.herd.forEach(f => { f.cheer = true; f.rr = true; }); if (G.pend?.k === 'card') G.pend.f = redrawers(p); }
  if (k === 'honey') G.honey[p.pos] = s;
  pushEv(G, { t: 'use', s, k, pos: p.pos });
  G.busy = Math.max(now, G.busy) + MS.say * .6;
  if (G.pend) { G.botAt = Math.max(G.botAt, G.busy + 300); if (G.tEnd) G.tEnd = Math.max(G.tEnd, now + 8000); }
  return true;
}
function wish(G, s, yes, now) {
  const p = G.pl[s];
  if (yes && p.treats >= 5) {
    p.treats -= 5;
    const r = Math.random();
    if (r < .3) { const w = spawnWild(G, p.pos, true); pushEv(G, { t: 'well', s, res: 'pet', sp: w.sp }); }
    else if (p.items.length < ITEM_MAX) { const k = pickOf(ITEM_IDS); p.items.push(k); pushEv(G, { t: 'well', s, res: 'item', k }); }
    else { p.treats += 8; pushEv(G, { t: 'well', s, res: 'treats', v: 8 }); }
  } else pushEv(G, { t: 'well', s, res: 'no' });
  G.busy = Math.max(now, G.busy) + MS.say;
  return afterLand(G, s, now);
}
function bench(G, s, o, now) {
  if (o == null || o < 0) { pushEv(G, { t: 'stone', s, kind: 'bench0', v: 0 }); return afterLand(G, s, now); }
  if (o === s || !G.seats[o] || G.pl[o].pact || G.pl[s].pact) return false;
  pushEv(G, { t: 'offer', s, o });
  return ask(G, o, 'pact', { from: s }, now);
}
function pactAnswer(G, o, yes, now) {
  const s = G.pend.from;
  if (yes) { const until = G.round + PACT_ROUNDS - 1; G.pl[s].pact = { w: o, until }; G.pl[o].pact = { w: s, until }; pushEv(G, { t: 'pact', s, o }); }
  else pushEv(G, { t: 'nopact', s, o });
  G.busy = Math.max(now, G.busy) + MS.say;
  return afterLand(G, s, now);
}
function lure(G, s, yes, now) {
  const o = G.pend.o, p = G.pl[s], q = G.pl[o];
  if (yes && p.treats >= LURE) {
    const f = q.herd.pop(); p.treats -= LURE; p.herd.push({ ...f });
    pushEv(G, { t: 'lure', s, o, sp: f.sp }); G.busy = Math.max(now, G.busy) + MS.say * 1.4;
  }
  return endTurn(G, now);
}
function shop(G, s, k, now) {
  const p = G.pl[s];
  if (k && ITEMS[k] && ITEMS[k].c <= p.treats && p.items.length < ITEM_MAX) { p.treats -= ITEMS[k].c; p.items.push(k); pushEv(G, { t: 'buy', s, k }); G.busy = Math.max(now, G.busy) + MS.say * .7; }
  G.pend = null; G.stage = 'walk';
  return advance(G, s, now);
}

// ---------- between rounds: cheers, the minigame, its results ----------
function startCheer(G, now) {
  G.pend = null; G.turn = -1; G.stage = 'cheer'; G.cheer = G.seats.map(() => -1);
  G.cheerDone = G.seats.map((_, i) => !G.pl[i].herd.some(f => f.cheer));
  G.stageEnd = Math.max(now, G.busy) + MS.cheer;
  G.botAt = Math.max(now, G.busy) + think(G);
  pushEv(G, { t: 'cheerask' });
  if (G.cheerDone.every(Boolean)) return startWheel(G, now);
  return true;
}
function setCheer(G, s, i) {
  if (G.cheerDone[s]) return false;
  const f = G.pl[s].herd[i];
  G.cheer[s] = f?.cheer ? i : -1; G.cheerDone[s] = true;
  if (G.cheerDone.every(Boolean)) return startWheel(G, Date.now());
  return true;
}
function startWheel(G, now) {
  // none of the last few minigames again, so a tournament shows plenty of different games
  const pool = poolFor(G.seats.length), recent = (G.recentMini ||= []).slice(-Math.min(4, pool.length - 1));
  const fresh = pool.filter(g => !recent.includes(g.id)), pick = pickOf(fresh.length ? fresh : pool);
  G.lastMini = pick.id; G.recentMini.push(pick.id);
  G.stage = 'wheel'; G.mini = { game: pick.id, opts: { ...pick.opts, bots: G.opts.bots, seats: G.seats.length }, started: false };
  G.stageEnd = now + MS.wheel;
  pushEv(G, { t: 'wheel', game: pick.id });
  return true;
}
// server.js calls this when the minigame ends: places[i] for trail seat i (1 = first). Friends' cheers lift a place.
export function miniDone(G, places, now = Date.now()) {
  if (G.stage !== 'mini') return false;
  const n = G.seats.length;
  let order = G.seats.map((_, i) => i).sort((a, b) => (places[a] || n) - (places[b] || n) || a - b);
  const cheered = [];
  for (let k = 1; k < order.length; k++) {
    const i = order[k], f = G.cheer[i];
    if (f >= 0 && G.pl[i].herd[f]?.cheer) { G.pl[i].herd[f].cheer = false; [order[k - 1], order[k]] = [order[k], order[k - 1]]; cheered.push({ s: i, f, sp: G.pl[i].herd[f].sp }); }
  }
  const pay = order.map((_, k) => payFor(k + 1, n));
  order.forEach((i, k) => { G.pl[i].treats += pay[k]; if (k === 0) G.pl[i].wins++; });
  const a = order[0], b = order[1];
  let pact = null;
  if (b != null && G.pl[a].pact?.w === b) { G.pl[a].treats += 3; G.pl[b].treats += 3; pact = [a, b]; }
  G.miniRes = { game: G.mini?.game, order, pay, cheered, pact };
  pushEv(G, { t: 'minires', ...G.miniRes });
  G.mini = null; G.cheer = G.seats.map(() => -1);
  G.stage = 'minires'; G.stageEnd = now + MS.res;
  return true;
}
function endRound(G, now) {
  G.round++;
  // Spark friends can swap your cards again every round
  for (const p of G.pl) for (const f of p.herd) if (f.el === 'Spark') f.rr = true;
  G.wx = weatherAt(now).kind;
  if (G.round > G.opts.rounds) return petShow(G, now);
  pushEv(G, { t: 'round', r: G.round });
  return startTurn(G, G.order[0], now);
}

// ---------- the Pet Show ----------
export const ribbons = G => ribbonsOf(G.pl);
function petShow(G, now) {
  const rib = ribbons(G), pts = showPts(G.pl, rib);
  G.show = { rib, pts };
  G.stage = 'show'; G.stageEnd = now + MS.show; G.pend = null; G.turn = -1;
  pushEv(G, { t: 'show' });
  return true;
}
function finish(G) {
  G.ph = 'end'; G.stage = 'end'; G.tEnd = 0; G.endAt = Date.now();
  const { pts } = G.show, T = G.pl.map(p => p.treats);
  const better = (j, i) => pts[j] > pts[i] || (pts[j] === pts[i] && T[j] > T[i]);
  const place = G.seats.map((_, i) => 1 + G.seats.filter((__, j) => better(j, i)).length);
  const order = G.seats.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
  G.win = order[0]; G.res = { order, place, pts };
  pushEv(G, { t: 'end', w: G.win });
  return true;
}

// ---------- acts ----------
export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.ph !== 'play') return false;
  const now = Date.now();
  if (G.stage === 'intro') { // skip the intro: once every person at the table has voted, the line-up rolls straight away
    if (a.t !== 'skip' || !G.seats[s].human || G.seats[s].bot) return false;
    (G.skipV ||= []); if (G.skipV.includes(s)) return false; G.skipV.push(s);
    if (G.seats.every((x, i) => !x.human || x.bot || G.skipV.includes(i))) G.stageEnd = now;
    return true;
  }
  if (G.stage === 'cheer') { if (a.t !== 'cheer' || !Number.isInteger(a.i)) return false; return setCheer(G, s, a.i); }
  if (a.t === 'item') { // items are used at the start of your own turn, while you're about to roll
    if (G.pend?.s !== s || G.pend.k !== 'card' || typeof a.k !== 'string') return false;
    return useItem(G, s, a.k, now);
  }
  if (!G.pend || G.pend.s !== s || now < G.busy - 50) return false;
  return answer(G, s, a, now);
}
function answer(G, s, a, now) {
  const P = G.pend;
  switch (P.k) {
    case 'card': if (a.t === 'redraw') return P.f.includes(a.f) && redraw(G, s, a.f, now); return a.t === 'card' && Number.isInteger(a.i) && playCard(G, s, a.i, now);
    case 'first': return a.t === 'roll' && firstRoll(G, s, now);
    case 'fork': if (a.t !== 'fork' || !P.opts.includes(a.j)) return false; G.walk.fork = a.j; G.pend = null; pushEv(G, { t: 'fork', s, j: a.j }); return advance(G, s, now);
    case 'shop': return a.t === 'shop' && (a.k == null || ITEMS[a.k] != null) && shop(G, s, a.k, now);
    case 'meet': { if (a.t !== 'meet') return false; const w = G.wild.find(x => x.id === P.id); if (!w) return nextMeet(G, s, now);
      if (a.skip) { pushEv(G, { t: 'leave', s, sp: w.sp }); G.busy = Math.max(now, G.busy) + MS.say * .6; return nextMeet(G, s, now); }
      return befriend(G, s, w, a.treat ? { treat: true } : { k: a.k | 0 }, now); }
    case 'well': return a.t === 'well' && wish(G, s, !!a.yes, now);
    case 'bench': return a.t === 'bench' && bench(G, s, Number.isInteger(a.o) ? a.o : -1, now);
    case 'pact': return a.t === 'pact' && pactAnswer(G, s, !!a.yes, now);
    case 'lure': return a.t === 'lure' && lure(G, s, !!a.yes, now);
  }
  return false;
}

// ---------- bots (and people out of time) ----------
// The choice a bot makes, as an act. Simple and a little greedy: head for wild pets, keep some treats for befriending.
export function botChoice(G, s) {
  const P = G.pend, p = G.pl[s];
  switch (P.k) {
    case 'first': return { t: 'roll' };
    case 'card': {
      const use = p.items.find(k => (k === 'spy' && p.hand.length <= HAND) || k === 'berry' || k === 'whistle' || (k === 'charm' && p.herd.length > 2) || (k === 'pouch' && !p.herd.some(f => f.rr || f.cheer)) || (k === 'honey' && Math.random() < .5));
      if (use) return { t: 'item', k: use };
      const sc = p.hand.map(d => cardScore(G, s, d) + Math.random() * (G.opts.bots === 'sharp' ? .5 : 4));
      const best = sc.indexOf(Math.max(...sc));
      if (Math.max(...p.hand.map(d => cardScore(G, s, d))) <= 0 && P.f.length && Math.random() < .7) return { t: 'redraw', f: P.f[0] };
      return { t: 'card', i: best };
    }
    case 'fork': {
      const score = j => { let v = Math.random() * 2, at = j; for (let k = 0; k < 6; k++) { if (G.wild.some(w => w.pos === at)) v += k + 1 === G.walk?.left ? 9 : 2; at = NODES[at].next[0]; } return v; };
      return { t: 'fork', j: [...P.opts].sort((a, b) => score(b) - score(a))[0] };
    }
    case 'shop': { if (Math.random() < .45 || p.treats < 9) return { t: 'shop', k: null }; const ok = ITEM_IDS.filter(k => ITEMS[k].c <= p.treats); return { t: 'shop', k: pickOf(ok) }; }
    case 'meet': {
      const w = G.wild.find(x => x.id === P.id); if (!w) return { t: 'meet', skip: true };
      const best = p.herd.map((f, k) => ({ k, o: oddsOf(f.el, w.el, p.berry) })).sort((a, b) => b.o - a.o)[0];
      const c = priceOf(w.rare) - (G.season === 'autumn' ? 2 : 0);
      if (best.o >= .55) return { t: 'meet', k: best.k };
      if (p.treats >= c + 3) return { t: 'meet', treat: true };
      return Math.random() < .5 ? { t: 'meet', k: best.k } : { t: 'meet', skip: true };
    }
    case 'well': return { t: 'well', yes: Math.random() < .6 };
    case 'bench': return { t: 'bench', o: Math.random() < .6 ? pickOf(P.opts) : -1 };
    case 'pact': return { t: 'pact', yes: Math.random() < .7 };
    case 'lure': return { t: 'lure', yes: p.treats >= 10 && Math.random() < .6 };
  }
  return null;
}
// What happens when a person runs out of time: the safe choice (roll, keep the roll, main trail, walk on, leave it).
function lateChoice(G, s) {
  const P = G.pend;
  switch (P.k) {
    case 'first': return { t: 'roll' };
    case 'card': return { t: 'card', i: 0 };
    case 'fork': return { t: 'fork', j: P.opts[0] };
    case 'shop': return { t: 'shop', k: null };
    case 'meet': return { t: 'meet', skip: true };
    case 'well': return { t: 'well', yes: false };
    case 'bench': return { t: 'bench', o: -1 };
    case 'pact': return { t: 'pact', yes: false };
    case 'lure': return { t: 'lure', yes: false };
  }
  return null;
}
// How good stopping after d steps looks to a bot: a wild pet's stone most, then treats; brambles are bad.
const STONE_SCORE = { treat: 3, picnic: 5, bramble: -3, spring: 3, nest: 3, den: 4, well: 1, bench: 1, stall: 1 };
function cardScore(G, s, d) {
  const p = G.pl[s], { ends } = landsOf(p.pos, d);
  return Math.max(...ends.map(at => (G.wild.some(w => w.pos === at) && p.herd.length < HERD_MAX ? 10 : 0) + (STONE_SCORE[NODES[at].kind] ?? 0)));
}
function botCheer(G, s) { const p = G.pl[s], k = p.herd.findIndex(f => f.cheer); return k >= 0 && Math.random() < .4 ? k : -1; }

// ---------- loop ----------
export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  // a table saved before trail cards (a die roll pending): carry on with cards
  if (G.pend?.k === 'roll') { fillHand(G, G.pend.s); G.pend.k = 'card'; G.pend.f = redrawers(G.pl[G.pend.s]); return true; }
  if (G.pend?.k === 'reroll') return startWalk(G, G.pend.s, G.die || 1, now);
  if (G.stage === 'intro') { if (now < G.stageEnd) return false; return startOrder(G, now); }
  if (G.stage === 'order' && !G.pend) { if (now < G.stageEnd) return false; return orderNext(G, now); }
  if (G.stage === 'next') { if (now < G.stageEnd) return false; if (G.startRound) { G.startRound = false; pushEv(G, { t: 'round', r: 1 }); } return nextTurn(G, now); }
  if (G.stage === 'rolled') { if (now < G.stageEnd) return false; return startWalk(G, G.turn, G.die, now); }
  if (G.stage === 'cheer') {
    let ch = false;
    if (now >= G.botAt) G.seats.forEach((seat, i) => { if (seat.bot && !G.cheerDone[i]) { G.cheer[i] = botCheer(G, i); G.cheerDone[i] = true; ch = true; } });
    if (G.cheerDone.every(Boolean) || now >= G.stageEnd) { G.cheerDone = G.cheerDone.map(() => true); return startWheel(G, now); }
    return ch;
  }
  if (G.stage === 'wheel') { if (now < G.stageEnd) return false; G.stage = 'mini'; return true; } // server.js starts the minigame
  if (G.stage === 'minires') { if (now < G.stageEnd) return false; return endRound(G, now); }
  if (G.stage === 'show') { if (now < G.stageEnd) return false; return finish(G); }
  if (!G.pend || now < G.busy) return false;
  const s = G.pend.s;
  if (G.seats[s].bot) { if (now < G.botAt) return false; const a = botChoice(G, s); return a ? (a.t === 'item' ? useItem(G, s, a.k, now) : answer(G, s, a, now)) : false; }
  if (G.tEnd && now >= G.tEnd) { const a = lateChoice(G, s); pushEv(G, { t: 'late', s }); return a ? answer(G, s, a, now) : false; }
  return false;
}

// A player who drops out is played by a bot until they're back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.pend?.s === s) { const now = Date.now(); G.botAt = now + 900; G.tEnd = away || !G.opts.timer ? 0 : now + G.opts.timer * 1000; }
  if (away && G.stage === 'cheer' && !G.cheerDone[s]) { G.cheerDone[s] = true; G.cheer[s] = -1; }
  return true;
}

export function view(G, s) {
  const now = Date.now();
  return {
    game: 'trail', ph: G.ph, stage: G.stage, gid: G.gid, me: s, round: G.round, rounds: G.opts.rounds, turn: G.turn, introMs: MS.intro, skipV: G.skipV || [], order: G.order, first: G.first ? { key: G.first.key, tie: G.first.tie } : null,
    season: G.season, wx: G.wx, die: G.die, botsLevel: G.opts.bots, timer: G.opts.timer,
    pend: G.pend ? { ...G.pend } : null, busy: Math.max(0, G.busy - now),
    tLeft: G.pend && G.tEnd ? Math.max(0, G.tEnd - now) : G.stage === 'cheer' ? Math.max(0, G.stageEnd - now) : -1,
    stageLeft: Math.max(0, (G.stageEnd || 0) - now),
    pl: G.pl.map(p => ({ pos: p.pos, hand: p.hand || [], treats: p.treats, herd: p.herd, items: p.items, egg: p.egg, pact: p.pact, wins: p.wins, charm: p.charm, berry: p.berry, whistle: p.whistle })),
    wild: G.wild, honey: G.honey, mini: G.mini ? { game: G.mini.game } : null, miniRes: G.stage === 'minires' ? G.miniRes : null,
    cheer: G.stage === 'cheer' ? { mine: G.cheer[s] ?? -1, done: G.cheerDone[s] ?? true } : null,
    show: G.show, res: G.res, win: G.win,
    seats: G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    ev: G.ev,
  };
}

// 10 points for every player you finished ahead of; equal Pet Show points and treats share the place.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => { const place = G.res.place[i]; return { pts: (n - place) * 10, win: place === 1, place }; });
}
void STRONG;

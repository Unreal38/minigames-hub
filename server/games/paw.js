// Pawperty: a cozy pet-shop property game. The server rolls, walks tokens, charges rent, deals Zoomies cards and
// runs the bots; clients only animate what it sends. Nobody is knocked out: a player who runs dry sells upgrades
// and shops back at half price, and whatever is still missing is let off. After the last round the richest wins.
import { N, START, BATH, LOST, MUD, PASS_GO, START_CASH, BATH_FEE, VET_FEE, RUB, JAR_START, NAP_CHANCE, LV_MAX,
  TILES, SHOP_TILES, STREET, CARDS, MS as MS_SHOWN, rentOf, fullStreet, worthOf } from '../../public/games/paw/board.js';
import { randomAv } from '../../public/avatar.js';

export const meta = { id: 'paw', name: 'Pawperty', minPlayers: 1, maxPlayers: 6, joinAt: 'round' };

const BOT_NAMES = ['Biscuit', 'Pudding', 'Sprout', 'Mochi', 'Toffee', 'Clover', 'Waffle', 'Pip', 'Noodle', 'Bean'];
const PALETTE = ['#ff6b6b', '#4db5ff', '#ffc93c', '#5fd08a', '#c58bff', '#ff9f43'];
const JAR = -2, BANK = -1;
// PAW_FAST=20 makes every on-screen wait 20 times shorter, so the test can play a whole game over the real server.
const FAST = Math.max(1, +process.env.PAW_FAST || 1), MS = Object.fromEntries(Object.entries(MS_SHOWN).map(([k, v]) => [k, v / FAST]));

export function cleanOpts(o = {}) {
  return {
    seats: [2, 3, 4, 5, 6].includes(+o.seats) ? +o.seats : 4,
    rounds: [8, 15, 25].includes(+o.rounds) ? +o.rounds : 15,
    bots: o.bots === 'sharp' ? 'sharp' : 'chill',
    naps: o.naps === 'off' ? 'off' : 'on',
    timer: [0, 20, 30].includes(+o.timer) ? +o.timer : 30,
  };
}

const rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0x999999; return [n >> 16, (n >> 8) & 255, n & 255]; };
const near = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 80; };
function pickCol(want, used) {
  if (want && /^#[0-9a-f]{6}$/i.test(want) && !used.some(u => near(u, want))) return want;
  return PALETTE.find(c => !used.some(u => near(u, c))) || PALETTE[used.length % PALETTE.length];
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const used = new Set(players.map(p => p.name));
  const names = shuffle(BOT_NAMES.filter(n => !used.has(n)));
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true }));
  let bi = 0;
  while (seats.length < opts.seats) seats.push({ id: null, name: names[bi++], color: null, av: randomAv(), bot: true, human: false });
  const cols = [];
  seats.forEach(s => {
    s.col = pickCol(s.color, cols); cols.push(s.col); s.color ||= s.col;
    Object.assign(s, { pos: START, cash: START_CASH, inBath: false, tries: 0, duck: false, eyes: false, mv: null, st: { rent: 0, got: 0, shops: 0, cards: 0 } });
  });
  const G = {
    game: 'paw', ph: 'play', stage: 'roll', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    own: Array(N).fill(-1), lv: Array(N).fill(0), nap: Array(N).fill(false), jar: JAR_START,
    deck: [], card: null, cardN: 0, offer: -1, turn: Math.random() * seats.length | 0, first: 0, round: 1,
    dbl: 0, extra: false, noAgain: false, next: null, stageEnd: 0, roll: null, rollN: 0, mvN: 0,
    ev: [], evN: 0, res: null, win: -1, endAt: 0, queue: [],
  };
  G.first = G.turn;
  beginTurn(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 24) G.ev.shift(); }
const sharp = G => G.opts.bots === 'sharp';
const waitFor = (G, now, botMs) => (G.seats[G.turn].bot ? now + botMs : G.opts.timer > 0 ? now + G.opts.timer * 1000 : 0);
const worth = (G, s) => G.seats[s].cash + SHOP_TILES.reduce((t, i) => t + (G.own[i] === s ? worthOf(i, G.lv) : 0), 0);
const upgrades = (G, s) => SHOP_TILES.reduce((t, i) => t + (G.own[i] === s ? G.lv[i] : 0), 0);

function beginTurn(G, now) {
  G.stage = 'roll'; G.offer = -1; G.card = G.card && now - G.card.at < MS.card ? G.card : null;
  G.stageEnd = waitFor(G, now, MS.bot);
}

// ---------- money ----------
// Sell things back to the bank at half price until seat s has amt treats (or has nothing left to sell).
function raise(G, s, amt) {
  const seat = G.seats[s];
  while (seat.cash < amt) {
    const up = SHOP_TILES.filter(i => G.own[i] === s && G.lv[i] > 0).sort((a, b) => TILES[b].up - TILES[a].up)[0];
    if (up !== undefined) { G.lv[up]--; seat.cash += TILES[up].up / 2; pushEv(G, { t: 'sellup', s, i: up, lv: G.lv[up] }); continue; }
    const shop = SHOP_TILES.filter(i => G.own[i] === s).sort((a, b) => TILES[a].price - TILES[b].price)[0];
    if (shop === undefined) break;
    G.own[shop] = -1; G.nap[shop] = false; seat.cash += TILES[shop].price / 2; pushEv(G, { t: 'sell', s, i: shop });
  }
}
// Move amt treats from seat `from` to a seat, the bank or the jar. Returns how much was actually paid.
function pay(G, from, to, amt) {
  const seat = G.seats[from];
  raise(G, from, amt);
  const paid = Math.max(0, Math.min(seat.cash, amt));
  seat.cash -= paid;
  if (to >= 0) { G.seats[to].cash += paid; G.seats[to].st.got += paid; } else if (to === JAR) G.jar += paid;
  if (paid < amt) pushEv(G, { t: 'forgive', s: from, amt: amt - paid });
  return paid;
}
const gain = (G, s, amt) => { G.seats[s].cash += amt; };

// ---------- moving ----------
// Walk seat s by steps (negative = backwards). Passing or landing on the Welcome Mat going forwards pays PASS_GO.
function walk(G, s, steps, now, delay = 0) {
  const seat = G.seats[s], path = [seat.pos];
  let p = seat.pos, passed = false;
  for (let k = 0; k < Math.abs(steps); k++) { p = (p + Math.sign(steps) + N) % N; path.push(p); if (steps > 0 && p === START) passed = true; }
  seat.pos = p;
  if (passed) { gain(G, s, PASS_GO); pushEv(G, { t: 'go', s, amt: PASS_GO }); }
  const ms = Math.abs(steps) * MS.step;
  seat.mv = { n: ++G.mvN, path, at: now + delay, ms, jump: false };
  return delay + ms;
}
function jump(G, s, to, now, delay = 0) {
  const seat = G.seats[s];
  seat.mv = { n: ++G.mvN, path: [seat.pos, to], at: now + delay, ms: MS.jump, jump: true };
  seat.pos = to;
  return delay + MS.jump;
}
// stage 'walk' waits for the current player's token, then runs `next`
function walking(G, now, ms, next) { G.stage = 'walk'; G.next = next; G.stageEnd = now + ms + MS.land; }
function pause(G, now, ms = MS.pay) { G.stage = 'pay'; G.stageEnd = now + ms; }

function toBath(G, s, now, delay = 0) {
  const seat = G.seats[s];
  G.dbl = 0; G.noAgain = true; G.extra = false;
  if (seat.duck) { seat.duck = false; pushEv(G, { t: 'duck', s }); pause(G, now, delay + MS.pay); return; }
  seat.inBath = true; seat.tries = 0;
  pushEv(G, { t: 'bath', s });
  walking(G, now, jump(G, s, BATH, now, delay), 'after');
}

// ---------- a turn ----------
function roll(G, s, now, d = [1 + (Math.random() * 6 | 0), 1 + (Math.random() * 6 | 0)]) {
  const seat = G.seats[s], dbl = d[0] === d[1], sum = d[0] + d[1];
  G.roll = { n: ++G.rollN, s, d, dbl, at: now };
  G.offer = -1;
  if (seat.inBath) {
    if (dbl) { seat.inBath = false; G.noAgain = true; pushEv(G, { t: 'free', s, how: 'dbl' }); }
    else if (++seat.tries >= 3) { pay(G, s, JAR, BATH_FEE); seat.inBath = false; G.noAgain = true; pushEv(G, { t: 'free', s, how: 'fee', amt: BATH_FEE }); }
    else { pushEv(G, { t: 'soak', s, left: 3 - seat.tries }); G.stage = 'stay'; G.stageEnd = now + MS.roll + MS.pause * 2; return true; }
  } else if (dbl && ++G.dbl >= 3) { pushEv(G, { t: 'three', s }); toBath(G, s, now, MS.roll); return true; }
  walking(G, now, walk(G, s, sum, now, MS.roll), 'land');
  return true;
}

function land(G, s, now) {
  const seat = G.seats[s], i = seat.pos, t = TILES[i];
  if (t.k === 'shop') {
    const o = G.own[i];
    if (o < 0) {
      if (seat.cash >= t.price) { G.stage = 'buy'; G.offer = i; G.stageEnd = waitFor(G, now, MS.botBuy); return; }
      pushEv(G, { t: 'poor', s, i });
    } else if (o === s) { gain(G, s, RUB); pushEv(G, { t: 'rub', s, i, amt: RUB }); }
    else if (G.nap[i]) pushEv(G, { t: 'tiptoe', s, i, o });
    else if (seat.eyes) { seat.eyes = false; pushEv(G, { t: 'eyes', s, i, o }); }
    else { const amt = rentOf(i, G.own, G.lv), paid = pay(G, s, o, amt); seat.st.rent += paid; pushEv(G, { t: 'rent', s, i, o, amt: paid }); }
    return pause(G, now);
  }
  if (t.k === 'zoom') return drawCard(G, s, now);
  if (t.k === 'vet') { const amt = pay(G, s, JAR, VET_FEE); pushEv(G, { t: 'vet', s, amt }); return pause(G, now); }
  if (t.k === 'lost') { const amt = G.jar; G.jar = 0; gain(G, s, amt); pushEv(G, { t: 'lost', s, amt }); return pause(G, now, amt ? MS.pay * 1.4 : MS.pause); }
  if (t.k === 'mud') { pushEv(G, { t: 'mud', s }); return toBath(G, s, now, MS.pause); }
  afterLand(G, s, now);
}

function drawCard(G, s, now) {
  if (!G.deck.length) G.deck = shuffle(Object.keys(CARDS));
  const id = G.deck.pop();
  G.card = { n: ++G.cardN, s, id, at: now };
  G.seats[s].st.cards++;
  G.stage = 'card'; G.stageEnd = now + MS.card;
  pushEv(G, { t: 'card', s, id });
}

function applyCard(G, s, now) {
  const seat = G.seats[s], id = G.card.id, others = G.seats.map((_, i) => i).filter(i => i !== s);
  switch (id) {
    case 'zoom': return walking(G, now, walk(G, s, 5, now), 'land');
    case 'home': return walking(G, now, walk(G, s, (N - seat.pos) % N || N, now), 'after');
    case 'squirrel': { let ms = 0; for (const o of others) if (!G.seats[o].inBath) ms = Math.max(ms, walk(G, o, -2, now)); return walking(G, now, ms, 'after'); } // whoever is in the tub stays in it
    case 'mud': return toBath(G, s, now);
    case 'stash': gain(G, s, 60); break;
    case 'cake': gain(G, s, 40); break;
    case 'photo': gain(G, s, 30); break;
    case 'ate': pay(G, s, JAR, 40); break;
    case 'pigeon': pay(G, s, BANK, 20); break;
    case 'vase': { const n = upgrades(G, s); if (n) pay(G, s, BANK, 15 * n); break; }
    case 'rubs': for (const o of others) pay(G, s, o, 10); break;
    case 'show': for (const o of others) pay(G, o, s, 15); break;
    case 'yawn': for (const i of SHOP_TILES) if (G.own[i] === s) G.nap[i] = true; break;
    case 'bell': G.nap.fill(false); break;
    case 'duck': seat.duck = true; break;
    case 'eyes': seat.eyes = true; break;
    case 'again': G.extra = true; break;
    case 'swap': {
      const top = others.sort((a, b) => worth(G, b) - worth(G, a))[0];
      if (top === undefined || worth(G, top) <= worth(G, s)) { pushEv(G, { t: 'topdog', s }); break; }
      const a = seat.pos, b = G.seats[top].pos, ta = G.seats[top];
      if (ta.inBath) { ta.inBath = false; seat.inBath = true; seat.tries = 0; G.noAgain = true; }
      jump(G, top, a, now); return walking(G, now, jump(G, s, b, now), 'after');
    }
  }
  pause(G, now, MS.pause);
}

function afterLand(G, s, now) {
  const seat = G.seats[s];
  if (G.ph !== 'play') return;
  if (G.extra || (G.roll?.dbl && G.roll.s === s && !G.noAgain && !seat.inBath && G.dbl > 0)) {
    G.extra = false; pushEv(G, { t: 'again', s }); beginTurn(G, now); return;
  }
  if (buildable(G, s).length || seat.bot) { G.stage = 'done'; G.offer = -1; G.stageEnd = waitFor(G, now, MS.bot * .6); return; }
  endTurn(G, now);
}

// Shops seat s may upgrade now: theirs, they can pay, and the Pet Palace (top level) needs the whole street.
export function buildable(G, s) {
  return SHOP_TILES.filter(i => G.own[i] === s && G.lv[i] < LV_MAX && G.seats[s].cash >= TILES[i].up
    && (G.lv[i] < LV_MAX - 1 || fullStreet(TILES[i].g, s, G.own)));
}
function build(G, s, i) {
  if (!buildable(G, s).includes(i)) return false;
  G.seats[s].cash -= TILES[i].up; G.lv[i]++;
  pushEv(G, { t: 'build', s, i, lv: G.lv[i] });
  return true;
}
function buy(G, s, now) {
  const i = G.offer, t = TILES[i], seat = G.seats[s];
  if (G.stage !== 'buy' || i < 0 || seat.cash < t.price || G.own[i] >= 0) return false;
  seat.cash -= t.price; G.own[i] = s; G.nap[i] = false; seat.st.shops++;
  pushEv(G, { t: 'buy', s, i });
  G.offer = -1; pause(G, now, MS.pause);
  return true;
}
function passBuy(G, s, now) {
  if (G.stage !== 'buy') return false;
  pushEv(G, { t: 'skip', s, i: G.offer });
  G.offer = -1; afterLand(G, s, now);
  return true;
}
function payBath(G, s, now) {
  const seat = G.seats[s];
  if (G.stage !== 'roll' || !seat.inBath) return false;
  pay(G, s, JAR, BATH_FEE); seat.inBath = false;
  pushEv(G, { t: 'free', s, how: 'pay', amt: BATH_FEE });
  G.stageEnd = waitFor(G, now, MS.bot);
  return true;
}

function newRound(G) {
  if (G.opts.naps !== 'on') { G.nap.fill(false); return; }
  for (const i of SHOP_TILES) G.nap[i] = G.own[i] >= 0 && Math.random() < NAP_CHANCE;
  pushEv(G, { t: 'naps', tiles: SHOP_TILES.filter(i => G.nap[i]) });
}
function endTurn(G, now) {
  G.dbl = 0; G.extra = false; G.noAgain = false; G.offer = -1;
  G.turn = (G.turn + 1) % G.seats.length;
  if (G.turn === G.first) {
    G.round++; seatQueued(G);
    if (G.round > G.opts.rounds) return finish(G, now);
    newRound(G);
    pushEv(G, { t: 'round', r: G.round });
  }
  beginTurn(G, now);
}
function finish(G, now) {
  G.round = G.opts.rounds;
  const w = G.seats.map((_, i) => worth(G, i));
  const order = G.seats.map((_, i) => i).sort((a, b) => w[b] - w[a] || G.seats[b].cash - G.seats[a].cash);
  G.win = order[0]; G.ph = 'end'; G.stage = 'end'; G.endAt = now; G.offer = -1;
  G.res = { order, worth: w, rounds: G.opts.rounds };
  pushEv(G, { t: 'end', w: G.win });
}

// ---------- bots ----------
function botBath(G, s) {
  const seat = G.seats[s], late = G.round > G.opts.rounds * .6;
  return seat.cash >= (sharp(G) ? 140 : 220) && !(sharp(G) && late); // late on, the tub is a safe place to wait
}
function botBuy(G, s, chill = !sharp(G)) {
  const i = G.offer, t = TILES[i], seat = G.seats[s], left = seat.cash - t.price;
  const street = STREET[t.g], mine = street.filter(j => G.own[j] === s).length;
  const block = street.some(j => G.own[j] >= 0 && G.own[j] !== s && street.filter(k => G.own[k] === G.own[j]).length === 2);
  if (chill) return left >= 60 && Math.random() < .85;
  if (mine === 2 || block) return left >= 0;
  return left >= 40 + G.round * 4;
}
function botBuild(G, s) {
  const keep = sharp(G) ? 90 : 180;
  for (let k = 0; k < 12; k++) {
    const can = buildable(G, s).filter(i => G.seats[s].cash - TILES[i].up >= keep);
    if (!can.length) break;
    can.sort((a, b) => (sharp(G) ? TILES[b].rent[G.lv[b] + 1] - TILES[a].rent[G.lv[a] + 1] : TILES[a].up - TILES[b].up));
    build(G, s, can[0]);
    if (!sharp(G)) break; // chill bots build one thing a turn
  }
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s]?.human || G.ph !== 'play' || G.turn !== s) return false;
  const now = Date.now();
  if (a.t === 'roll') return G.stage === 'roll' && roll(G, s, now);
  if (a.t === 'pay') return payBath(G, s, now);
  if (a.t === 'buy') return buy(G, s, now);
  if (a.t === 'pass') return passBuy(G, s, now);
  if (a.t === 'build') return (G.stage === 'roll' || G.stage === 'done') && build(G, s, a.i | 0);
  if (a.t === 'end') { if (G.stage !== 'done') return false; endTurn(G, now); return true; }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  const s = G.turn, seat = G.seats[s];
  if (['roll', 'buy', 'done'].includes(G.stage)) {
    if (!G.stageEnd || now < G.stageEnd) {
      // a player who went away while it was their turn gets played for by a bot
      if (seat.bot && (!G.stageEnd || G.stageEnd - now > MS.bot)) { G.stageEnd = now + MS.bot; return true; }
      return false;
    }
    if (G.stage === 'roll') { if (seat.inBath && seat.bot && botBath(G, s)) payBath(G, s, now); return roll(G, s, now); }
    if (G.stage === 'buy') { if (botBuy(G, s, !seat.bot || !sharp(G))) buy(G, s, now); else passBuy(G, s, now); return true; }
    if (seat.bot) botBuild(G, s);
    endTurn(G, now); return true;
  }
  if (now < G.stageEnd) return false;
  if (G.stage === 'walk') { const next = G.next; G.next = null; if (next === 'land') land(G, s, now); else afterLand(G, s, now); return true; }
  if (G.stage === 'card') { applyCard(G, s, now); return true; }
  if (G.stage === 'pay') { afterLand(G, s, now); return true; }
  if (G.stage === 'stay') { endTurn(G, now); return true; }
  return false;
}

export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away;
  if (G.ph === 'play' && G.turn === s && ['roll', 'buy', 'done'].includes(G.stage)) G.stageEnd = waitFor(G, Date.now(), MS.bot);
  return true;
}

// Someone watching takes over a bot's seat (shops, treats and all) at the start of the next round.
export function seatWatcher(G, p, on = true) {
  if (!p?.id) return false;
  G.queue ||= [];
  G.queue = G.queue.filter(q => q.id !== p.id);
  if (on && G.ph === 'play' && !G.seats.some(s => s.id === p.id)) G.queue.push({ id: p.id, name: p.name, color: p.color, av: p.av });
  return true;
}
function seatQueued(G) {
  while (G.queue?.length) {
    const i = G.seats.findIndex(s => !s.human);
    if (i < 0) break;
    const p = G.queue.shift();
    Object.assign(G.seats[i], { id: p.id, name: p.name, color: p.color, av: p.av, bot: false, human: true });
    pushEv(G, { t: 'sit', s: i });
  }
}

export function view(G, s) {
  const now = Date.now(), ago = x => (x ? { ...x, ago: now - x.at } : null);
  return {
    game: 'paw', ph: G.ph, stage: G.stage, gid: G.gid, me: s, turn: G.turn, round: G.round, rounds: G.opts.rounds,
    left: G.stageEnd ? Math.max(0, G.stageEnd - now) : -1, timer: G.opts.timer, naps: G.opts.naps === 'on',
    seats: G.seats.map((x, i) => ({ name: x.name, color: x.color, col: x.col, av: x.av, bot: x.bot, human: x.human, id: x.id,
      pos: x.pos, cash: x.cash, inBath: x.inBath, tries: x.tries, duck: x.duck, eyes: x.eyes, worth: worth(G, i), st: x.st, mv: ago(x.mv) })),
    own: G.own, lv: G.lv, nap: G.nap, jar: G.jar, offer: G.offer, dbl: G.dbl,
    can: s === G.turn && G.ph === 'play' && (G.stage === 'roll' || G.stage === 'done') ? buildable(G, s) : [],
    roll: ago(G.roll), card: ago(G.card), res: G.res, win: G.win, ev: G.ev,
  };
}

// Per seat: 10 points per player you finished ahead of, plus 10 for winning.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  const n = G.seats.length;
  return G.seats.map((_, i) => {
    const place = G.res.order.indexOf(i);
    return { pts: (n - 1 - place) * 10 + (place === 0 ? 10 : 0), win: place === 0, place: place + 1 };
  });
}

// for tests
export const _roll = roll;
export const _worth = worth;
export const _buildable = buildable;

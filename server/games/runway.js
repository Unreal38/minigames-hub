// Sky Runway: a dress-up show for 3 to 8 people. Each round has a theme; everyone dresses up against the clock with
// every coin-shop item on loan (Supporter pack items too), then walks the runway one by one while the others give
// 1 to 5 stars. Points per look = average stars x 20 (with 5+ judges the highest and lowest vote are dropped).
// Nothing worn here is saved: the look lives only in this game. People only, no bots.
import { THEMES, TWISTS, FREE_KEYS, POSES, ROUNDS, TIMES, PICK_N, cleanTheme, scoreLook } from '../../public/games/runway/rules.js';
import { cleanAv, AV_KEYS } from '../../public/avatar.js';

export const meta = { id: 'runway', name: 'Sky Runway', minPlayers: 3, maxPlayers: 8, minHumans: 3 };

// pick: the theme vote (3 random themes + written ones); theme: the theme card; walk: one look on the runway (the walk, the pose, the votes); reveal: the round's podium.
export const MS = { pick: 20000, theme: 5000, walk: 8500, reveal: 8000, early: 1200 };
const FREE = FREE_KEYS.map(k => AV_KEYS.indexOf(k));

export function cleanOpts(o = {}) {
  return {
    rounds: ROUNDS.includes(+o.rounds) ? +o.rounds : 3,
    time: TIMES.includes(+o.time) ? +o.time : 90,
    names: o.names === 'secret' ? 'secret' : 'shown', // Secret walk: who is on the runway shows only at the reveal
  };
}

export function create(players, optsIn = {}) {
  const opts = cleanOpts(optsIn);
  const seats = players.slice(0, meta.maxPlayers).map(p => ({ id: p.id, name: p.name, color: p.color, av: cleanAv(p.av), bot: false, human: true }));
  const G = {
    game: 'runway', ph: 'play', stage: 'theme', gid: Math.random().toString(36).slice(2, 8), seats, opts,
    round: -1, theme: '', twist: '', used: [], picks: [], pv: [], tEnd: 0, tAll: 0,
    looks: seats.map(x => x.av.slice()), pose: seats.map(() => 0), ready: seats.map(() => false),
    order: [], walk: -1, votes: [], last: null,
    tot: seats.map(() => 0), fives: seats.map(() => 0), hist: [], busy: seats.map(() => false),
    ev: [], evN: 0, res: null, win: -1, endAt: 0,
  };
  nextRound(G, Date.now());
  return G;
}

function pushEv(G, e) { e.n = ++G.evN; G.ev.push(e); if (G.ev.length > 16) G.ev.shift(); }
const setStage = (G, stage, now, ms) => { G.stage = stage; G.tAll = ms; G.tEnd = now + ms; };
const present = (G, s) => G.seats[s].human && !G.seats[s].bot;

function nextRound(G, now) {
  // the theme vote: PICK_N random themes not used yet this game, plus whatever the players write
  let pool = THEMES.filter(t => !G.used.includes(t[0])); if (pool.length < PICK_N) pool = THEMES.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  G.round++; G.theme = ''; G.twist = '';
  G.picks = pool.slice(0, PICK_N).map(t => ({ th: t[0], by: -1 })); G.pv = G.seats.map(() => -1);
  G.ready = G.seats.map(() => false); G.votes = G.seats.map(() => G.seats.map(() => 0)); G.last = null; G.walk = -1; G.order = [];
  setStage(G, 'pick', now, MS.pick);
  pushEv(G, { t: 'pick', r: G.round });
}
// most votes wins; a tie (or no votes at all) is settled at random among the tied
function closePick(G, now) {
  const n = G.picks.map((_, k) => G.pv.filter(v => v === k).length), top = Math.max(...n);
  const tied = G.picks.map((_, k) => k).filter(k => n[k] === top);
  const k = tied[Math.random() * tied.length | 0];
  G.theme = G.picks[k].th; G.used.push(G.theme);
  G.twist = G.round > 0 && Math.random() < .5 ? TWISTS[Math.random() * TWISTS.length | 0][0] : '';
  setStage(G, 'theme', now, MS.theme);
  pushEv(G, { t: 'theme', r: G.round, k, n: top, tie: tied.length > 1 });
}
function startWalks(G, now) {
  // everyone still at the table walks, in a fresh random order each round
  const o = G.seats.map((_, i) => i).filter(i => G.seats[i].human);
  for (let i = o.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [o[i], o[j]] = [o[j], o[i]]; }
  G.order = o; G.walk = -1;
  pushEv(G, { t: 'lock' });
  nextWalk(G, now);
}
function nextWalk(G, now) {
  G.walk++;
  if (G.walk >= G.order.length) return closeRound(G, now);
  setStage(G, 'walk', now, MS.walk);
  pushEv(G, { t: 'walk', s: G.order[G.walk] });
  return true;
}
function closeRound(G, now) {
  G.last = G.seats.map((_, s) => {
    if (!G.order.includes(s)) return null;
    const sc = scoreLook(G.votes[s].filter((v, j) => j !== s && v));
    return sc;
  });
  G.last.forEach((sc, s) => { if (sc) { G.tot[s] += sc.pts; G.fives[s] += sc.fives; } });
  G.hist.push({ theme: G.theme, pts: G.last.map(sc => sc?.pts ?? 0), looks: G.looks.map(a => a.slice()) });
  setStage(G, 'reveal', now, MS.reveal);
  pushEv(G, { t: 'reveal', pts: G.last.map(sc => sc?.pts ?? 0) });
  return true;
}
function finish(G, now) {
  G.ph = 'end'; G.stage = 'end'; G.endAt = now;
  // most points first; on equal points more 5-star votes wins; still level shares the place
  const better = (a, b) => G.tot[a] > G.tot[b] || (G.tot[a] === G.tot[b] && G.fives[a] > G.fives[b]);
  const place = G.seats.map((_, i) => 1 + G.seats.filter((__, j) => better(j, i)).length);
  const order = G.seats.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
  G.win = order[0];
  G.res = { tot: G.tot.slice(), fives: G.fives.slice(), place, order, hist: G.hist.map(h => ({ theme: h.theme, pts: h.pts })) };
  pushEv(G, { t: 'end', w: place.filter(p => p === 1).length === 1 ? G.win : -1 });
  return true;
}

// a look from the page: only the parts that may change are taken, the rest stays the player's own
function setLook(G, s, av) {
  if (!Array.isArray(av)) return false;
  const a = cleanAv(av), cur = G.looks[s];
  let ch = false;
  for (const i of FREE) if (a[i] !== cur[i]) { cur[i] = a[i]; ch = true; }
  if (ch) { G.busy[s] = true; G.ready[s] = false; }
  return ch;
}

export function act(G, s, a) {
  if (!a || typeof a !== 'object' || s < 0 || !G.seats[s] || G.ph !== 'play') return false;
  const now = Date.now(), dressing = G.stage === 'theme' || G.stage === 'dress';
  if (a.t === 'write') {
    // one written theme each per round; it can't be changed once votes could be on it
    if (G.stage !== 'pick' || now > G.tEnd || G.picks.some(p => p.by === s)) return false;
    const txt = cleanTheme(a.text); if (!txt) return false;
    const key = txt.toLocaleLowerCase();
    if (G.picks.some(p => (p.th[0] === '*' ? p.th.slice(1).toLocaleLowerCase() : '') === key)) return false;
    G.picks.push({ th: '*' + txt, by: s }); G.busy[s] = true;
    return true;
  }
  if (a.t === 'pick') {
    // one vote each, changeable until the vote closes; never for the theme you wrote yourself
    const k = a.k;
    if (G.stage !== 'pick' || now > G.tEnd || !Number.isInteger(k) || !G.picks[k] || G.picks[k].by === s || G.pv[s] === k) return false;
    G.pv[s] = k; G.busy[s] = true;
    return true;
  }
  if (a.t === 'look') return dressing && setLook(G, s, a.av);
  if (a.t === 'pose') { if (!dressing || !Number.isInteger(a.p) || !POSES[a.p] || G.pose[s] === a.p) return false; G.pose[s] = a.p; G.busy[s] = true; return true; }
  if (a.t === 'ready') {
    if (G.stage !== 'dress' || G.ready[s] === !!a.on) return false;
    if (a.av) setLook(G, s, a.av);
    G.ready[s] = !!a.on;
    return true;
  }
  if (a.t === 'vote') {
    // a vote for whoever is on the runway now; never for yourself. Changing your mind is fine until the next walker.
    const w = G.order[G.walk], v = a.v;
    if (G.stage !== 'walk' || w === s || w == null || !Number.isInteger(v) || v < 1 || v > 5 || G.votes[w][s] === v) return false;
    if (now > G.tEnd) return false;
    G.votes[w][s] = v; G.busy[s] = true;
    // everyone present has voted: the walk ends a little early
    const judges = G.seats.map((_, j) => j).filter(j => j !== w && present(G, j));
    if (judges.length && judges.every(j => G.votes[w][j]) && G.tEnd - now > MS.early + 3000 && now - (G.tEnd - G.tAll) > 4500) G.tEnd = now + MS.early;
    return true;
  }
  return false;
}

export function tick(G, now = Date.now()) {
  if (G.ph !== 'play') return false;
  // with fewer than two people left there is nobody to judge: the game ends as it stands
  if (G.seats.filter(x => x.human).length < 2) return finish(G, now);
  if (G.stage === 'pick') {
    // everyone present has voted: the vote closes a moment later
    const here = G.seats.map((_, j) => j).filter(j => present(G, j));
    if (here.length && here.every(j => G.pv[j] >= 0) && G.tEnd - now > MS.early + 500) { G.tEnd = now + MS.early; return true; }
    if (now < G.tEnd) return false; closePick(G, now); return true;
  }
  if (G.stage === 'theme') { if (now < G.tEnd) return false; setStage(G, 'dress', now, G.opts.time * 1000); pushEv(G, { t: 'dress' }); return true; }
  if (G.stage === 'dress') {
    const here = G.seats.map((_, s) => s).filter(s => present(G, s));
    if (now >= G.tEnd || (here.length && here.every(s => G.ready[s]))) { startWalks(G, now); return true; }
    return false;
  }
  if (G.stage === 'walk') { if (now < G.tEnd) return false; return nextWalk(G, now); }
  if (G.stage === 'reveal') { if (now < G.tEnd) return false; if (G.round + 1 >= G.opts.rounds) return finish(G, now); nextRound(G, now); return true; }
  return false;
}

// Somebody who drops out keeps their look (it still walks) but has no vote until they are back.
export function setAway(G, s, away) {
  const seat = G.seats[s];
  if (!seat || !seat.human || seat.bot === away) return false;
  seat.bot = away; if (away) G.ready[s] = false;
  return true;
}

export function view(G, s) {
  const now = Date.now(), w = G.stage === 'walk' ? G.order[G.walk] : -1;
  const secret = G.opts.names === 'secret' && G.stage === 'walk';
  // with Secret walk on, the looks walked so far stay unnamed until the reveal: the walker comes as cur, not by seat
  const walked = new Set(secret ? [] : G.stage === 'walk' ? G.order.slice(0, G.walk + 1) : G.stage === 'reveal' || G.stage === 'end' ? G.order : []);
  return {
    game: 'runway', ph: G.ph, stage: G.stage, gid: G.gid, me: s, opts: G.opts,
    round: G.round, rounds: G.opts.rounds, theme: G.theme,
    // the theme vote: the choices (written ones show who wrote them only to the writer), the vote counts, your vote
    picks: G.stage === 'pick' ? G.picks.map((p, k) => ({ th: p.th, mine: p.by === s && s >= 0, n: G.pv.filter(v => v === k).length })) : [],
    myPick: G.stage === 'pick' && s >= 0 ? G.pv[s] : -1, wrote: G.stage === 'pick' && s >= 0 && G.picks.some(p => p.by === s),
    nPicked: G.stage === 'pick' ? G.pv.filter(v => v >= 0).length : 0, twist: G.twist, left: Math.max(0, G.tEnd - now), all: G.tAll,
    // nobody sees the other looks before they walk; your own look is always yours
    looks: G.looks.map((a, i) => (i === s || walked.has(i) || G.ph === 'end' ? a : null)), pose: G.pose.map((p, i) => (i === s || walked.has(i) || G.ph === 'end' ? p : 0)),
    ready: G.ready, order: G.stage === 'walk' || G.stage === 'reveal' ? G.order : [], walk: G.walk,
    walker: secret && w !== s ? -2 : w, // -2: someone is walking, but the names are a secret until the reveal
    cur: w >= 0 ? { av: G.looks[w], color: G.seats[w].color, pose: G.pose[w] } : null,
    myVote: w >= 0 && s >= 0 ? G.votes[w][s] : 0, nVotes: w >= 0 ? G.votes[w].filter(Boolean).length : 0,
    judges: w >= 0 ? G.seats.filter((_, j) => j !== w && present(G, j)).length : 0,
    last: G.stage === 'reveal' || G.stage === 'end' ? G.last : null, tot: G.tot, fives: G.fives,
    seats: G.seats.map(x => ({ name: x.name, color: x.color, av: x.av, bot: x.bot, human: x.human, id: x.id })),
    res: G.res, win: G.win, ev: G.ev,
  };
}

// Placed by points over all rounds. Someone who never changed a thing, posed or voted earns no coins.
export function results(G) {
  if (G.ph !== 'end' || !G.res) return null;
  return G.seats.map((x, i) => ({ pts: G.tot[i], win: G.res.place[i] === 1, place: G.res.place[i], idle: x.human && !G.busy[i] }));
}

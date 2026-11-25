// Pet Farm battles: every rule of a 3 against 3 turn-based fight, shared by the server (which runs it) and the
// browser (which only needs the names and numbers). Nothing here touches the network or the save file.
// Side 0 is the player. Side 1 is the other team, always played by pickMove() below.
import { SPECIES, formOf, elOf } from './data.js';
import { PL } from '../../i18n.js';

// Each element is strong against the next one in this ring and weak against the one before it.
export const STRONG = { Tide: 'Ember', Ember: 'Leaf', Leaf: 'Stone', Stone: 'Spark', Spark: 'Tide' };
export const effect = (moveEl, targetEl) => STRONG[moveEl] === targetEl ? 1.5 : STRONG[targetEl] === moveEl ? .75 : 1;
// Against a pet (which may have two elements). A move that is strong against one and weak against the other evens out.
const hitOn = (moveEl, u) => effect(moveEl, u.el) * (u.el2 ? effect(moveEl, u.el2) : 1);
const own = (moveEl, u) => moveEl === u.el || moveEl === u.el2;

// pow: hit strength. cd: turns before it can be used again. heal: share of full health. up / down: a stat of
// yours raised, or of the other pet lowered, by one step. status: what a hit leaves behind.
export const MOVES = {
  leafflick:   { name: 'Leaf Flick', el: 'Leaf', pow: 40 },
  rootgrab:    { name: 'Root Grab', el: 'Leaf', pow: 30, cd: 2, status: 'rooted' },
  sunnap:      { name: 'Sun Nap', el: 'Leaf', heal: .3, cd: 3 },
  sweetscent:  { name: 'Sweet Scent', el: 'Leaf', down: 'atk', cd: 2 },
  bloomburst:  { name: 'Bloom Burst', el: 'Leaf', pow: 85, cd: 3 },
  sparknip:    { name: 'Spark Nip', el: 'Ember', pow: 40 },
  singe:       { name: 'Singe', el: 'Ember', pow: 30, cd: 2, status: 'singed' },
  warmup:      { name: 'Warm Up', el: 'Ember', up: 'atk', cd: 2 },
  blazedash:   { name: 'Blaze Dash', el: 'Ember', pow: 85, cd: 3 },
  splash:      { name: 'Splash', el: 'Tide', pow: 40 },
  soak:        { name: 'Soak', el: 'Tide', pow: 30, cd: 2, status: 'soaked' },
  bubbleshield: { name: 'Bubble Shield', el: 'Tide', up: 'def', cd: 2 },
  mend:        { name: 'Mend', el: 'Tide', heal: .35, cd: 3 },
  tidalbump:   { name: 'Tidal Bump', el: 'Tide', pow: 85, cd: 3 },
  zap:         { name: 'Zap', el: 'Spark', pow: 40 },
  dazeflash:   { name: 'Daze Flash', el: 'Spark', pow: 25, cd: 2, status: 'dazed' },
  quickstep:   { name: 'Quick Step', el: 'Spark', up: 'spd', cd: 2 },
  thunderpounce: { name: 'Thunder Pounce', el: 'Spark', pow: 85, cd: 3 },
  pebbletoss:  { name: 'Pebble Toss', el: 'Stone', pow: 40 },
  dustcloud:   { name: 'Dust Cloud', el: 'Stone', down: 'atk', cd: 2 },
  harden:      { name: 'Harden', el: 'Stone', up: 'def', cd: 2 },
  boulderroll: { name: 'Boulder Roll', el: 'Stone', pow: 85, cd: 3 },
};
// Statuses: how long they last and what they do, in words for the player.
export const STATUS = {
  rooted: { name: 'Rooted', turns: 3, blurb: 'Half speed and cannot switch out.' },
  singed: { name: 'Singed', turns: 3, blurb: 'Loses a little health every turn.' },
  soaked: { name: 'Soaked', turns: 3, blurb: 'Defence is lowered.' },
  dazed:  { name: 'Dazed', turns: 2, blurb: 'May lose its turn.' },
};
export const STAT_NAME = { atk: 'attack', def: 'defence', spd: 'speed' };

// Base numbers by role: health, attack, defence, speed.
const ROLE = { balanced: [100, 50, 50, 50], tank: [125, 42, 62, 35], support: [105, 44, 52, 48], fast: [85, 56, 42, 66],
  glass: [78, 66, 38, 58], trickster: [90, 48, 46, 60], bruiser: [110, 58, 48, 40], healer: [105, 40, 54, 45] };
// What each species fights like. Moves are learnt in this order, at the levels in LEARN.
// Every species has its own set of four moves: no two share one.
export const KIT = {
  mossbun:   { role: 'balanced', moves: ['leafflick', 'sunnap', 'rootgrab', 'bloomburst'] },
  sproutle:  { role: 'tank', moves: ['leafflick', 'harden', 'rootgrab', 'bloomburst'] },
  petalpuff: { role: 'support', moves: ['leafflick', 'sweetscent', 'sunnap', 'bloomburst'] },
  cindercub: { role: 'fast', moves: ['sparknip', 'quickstep', 'singe', 'blazedash'] },
  toastoad:  { role: 'tank', moves: ['sparknip', 'harden', 'singe', 'blazedash'] },
  flickit:   { role: 'glass', moves: ['sparknip', 'warmup', 'singe', 'blazedash'] },
  puddlepup: { role: 'balanced', moves: ['splash', 'bubbleshield', 'soak', 'tidalbump'] },
  bubblefin: { role: 'support', moves: ['splash', 'sweetscent', 'bubbleshield', 'tidalbump'] },
  axolily:   { role: 'healer', moves: ['splash', 'mend', 'soak', 'tidalbump'] },
  shrimplet: { role: 'glass', moves: ['splash', 'warmup', 'soak', 'tidalbump'] },
  siamew:    { role: 'trickster', moves: ['pebbletoss', 'quickstep', 'dustcloud', 'boulderroll'] },
  coralcolt: { role: 'healer', moves: ['splash', 'mend', 'bubbleshield', 'tidalbump'] },
  skipfin:   { role: 'trickster', moves: ['splash', 'quickstep', 'dazeflash', 'tidalbump'] },
  gingersnap: { role: 'bruiser', moves: ['sparknip', 'warmup', 'dazeflash', 'blazedash'] },
  patchkit:  { role: 'healer', moves: ['leafflick', 'sunnap', 'quickstep', 'bloomburst'] },
  tuxpurr:   { role: 'balanced', moves: ['zap', 'harden', 'dazeflash', 'thunderpounce'] },
  fluffcoon: { role: 'tank', moves: ['splash', 'harden', 'mend', 'tidalbump'] },
  glazemew:  { role: 'support', moves: ['zap', 'sweetscent', 'quickstep', 'thunderpounce'] },
  munchmew:  { role: 'trickster', moves: ['sparknip', 'quickstep', 'sweetscent', 'blazedash'] },
  rocktopus: { role: 'trickster', moves: ['pebbletoss', 'dustcloud', 'rootgrab', 'boulderroll'] },
  driftle:   { role: 'tank', moves: ['splash', 'harden', 'bubbleshield', 'tidalbump'] },
  zapuff:    { role: 'bruiser', moves: ['zap', 'harden', 'warmup', 'thunderpounce'] },
  ottershell: { role: 'balanced', moves: ['splash', 'quickstep', 'mend', 'tidalbump'] },
  cinnapanda: { role: 'balanced', moves: ['sparknip', 'sweetscent', 'singe', 'blazedash'] },
  yuzubara:  { role: 'tank', moves: ['leafflick', 'bubbleshield', 'sunnap', 'bloomburst'] },
  snoozloth: { role: 'healer', moves: ['leafflick', 'sunnap', 'mend', 'bloomburst'] },
  glidenut:  { role: 'glass', moves: ['zap', 'quickstep', 'warmup', 'thunderpounce'] },
  zapkit:    { role: 'fast', moves: ['zap', 'quickstep', 'dazeflash', 'thunderpounce'] },
  buzzlet:   { role: 'trickster', moves: ['zap', 'dustcloud', 'dazeflash', 'thunderpounce'] },
  voltvole:  { role: 'glass', moves: ['zap', 'warmup', 'dazeflash', 'thunderpounce'] },
  pebblet:   { role: 'tank', moves: ['pebbletoss', 'harden', 'dustcloud', 'boulderroll'] },
  cragcrab:  { role: 'bruiser', moves: ['pebbletoss', 'warmup', 'dustcloud', 'boulderroll'] },
  dustmole:  { role: 'trickster', moves: ['pebbletoss', 'dustcloud', 'dazeflash', 'boulderroll'] },
  acornip:   { role: 'fast', moves: ['leafflick', 'quickstep', 'rootgrab', 'bloomburst'] },
  lanternail: { role: 'healer', moves: ['sparknip', 'sunnap', 'singe', 'blazedash'] },
  ripplet:   { role: 'fast', moves: ['splash', 'quickstep', 'soak', 'tidalbump'] },
  wattbat:   { role: 'balanced', moves: ['zap', 'sweetscent', 'dazeflash', 'thunderpounce'] },
  rubblet:   { role: 'balanced', moves: ['pebbletoss', 'harden', 'rootgrab', 'boulderroll'] },
  bambear:   { role: 'tank', moves: ['leafflick', 'harden', 'sunnap', 'bloomburst'] },
  sizzlet:   { role: 'bruiser', moves: ['sparknip', 'singe', 'blazedash', 'thunderpounce'] },
  waddlet:   { role: 'trickster', moves: ['splash', 'quickstep', 'dustcloud', 'tidalbump'] },
  oinkwatt:  { role: 'tank', moves: ['zap', 'harden', 'quickstep', 'thunderpounce'] },
  tricerock: { role: 'bruiser', moves: ['pebbletoss', 'warmup', 'harden', 'boulderroll'] },
  strawbun: { role: 'fast', moves: ['leafflick', 'quickstep', 'sweetscent', 'bloomburst'] },
  chilipup: { role: 'glass', moves: ['sparknip', 'warmup', 'quickstep', 'blazedash'] },
  melonwhale: { role: 'tank', moves: ['splash', 'harden', 'soak', 'tidalbump'] },
  lemonzest: { role: 'trickster', moves: ['zap', 'dazeflash', 'soak', 'thunderpounce'] },
  coconutkin: { role: 'tank', moves: ['pebbletoss', 'harden', 'sunnap', 'boulderroll'] },
  pinepine: { role: 'bruiser', moves: ['leafflick', 'warmup', 'rootgrab', 'bloomburst'] },
  croissab: { role: 'bruiser', moves: ['sparknip', 'harden', 'warmup', 'blazedash'] },
  donuseal: { role: 'healer', moves: ['splash', 'mend', 'sweetscent', 'tidalbump'] },
  cupcowl: { role: 'support', moves: ['leafflick', 'sweetscent', 'rootgrab', 'bloomburst'] },
  pretzelisk: { role: 'trickster', moves: ['pebbletoss', 'rootgrab', 'soak', 'boulderroll'] },
  mallowlamb: { role: 'healer', moves: ['leafflick', 'mend', 'rootgrab', 'bloomburst'] },
  candraffe: { role: 'support', moves: ['zap', 'sweetscent', 'mend', 'thunderpounce'] },
  jellifrog: { role: 'trickster', moves: ['splash', 'dustcloud', 'soak', 'tidalbump'] },
  carrofox: { role: 'fast', moves: ['sparknip', 'quickstep', 'rootgrab', 'blazedash'] },
  pumpkit: { role: 'balanced', moves: ['sparknip', 'dustcloud', 'singe', 'blazedash'] },
  peapillar: { role: 'support', moves: ['leafflick', 'sweetscent', 'harden', 'bloomburst'] },
  shroomouse: { role: 'trickster', moves: ['pebbletoss', 'quickstep', 'sweetscent', 'boulderroll'] },
  snowfox: { role: 'fast', moves: ['splash', 'quickstep', 'rootgrab', 'tidalbump'] },
  sunlion: { role: 'bruiser', moves: ['sparknip', 'warmup', 'sunnap', 'blazedash'] },
  dripfrog: { role: 'balanced', moves: ['splash', 'bubbleshield', 'rootgrab', 'tidalbump'] },
  twistret: { role: 'glass', moves: ['zap', 'quickstep', 'dustcloud', 'thunderpounce'] },
  moonbun: { role: 'healer', moves: ['zap', 'sunnap', 'dazeflash', 'thunderpounce'] },
  starjelly: { role: 'support', moves: ['splash', 'mend', 'dazeflash', 'tidalbump'] },
  cometail: { role: 'glass', moves: ['zap', 'warmup', 'singe', 'thunderpounce'] },
  griffling: { role: 'fast', moves: ['sparknip', 'quickstep', 'dazeflash', 'blazedash'] },
  bloomicorn: { role: 'healer', moves: ['leafflick', 'mend', 'quickstep', 'bloomburst'] },
  dreampir: { role: 'support', moves: ['zap', 'sweetscent', 'sunnap', 'thunderpounce'] },
  yetiny: { role: 'bruiser', moves: ['splash', 'warmup', 'harden', 'tidalbump'] },
  tusklet: { role: 'tank', moves: ['splash', 'warmup', 'bubbleshield', 'tidalbump'] }, // warms up in its scarf
  gargoylet: { role: 'tank', moves: ['pebbletoss', 'harden', 'singe', 'boulderroll'] },
  nessling: { role: 'balanced', moves: ['splash', 'sunnap', 'soak', 'tidalbump'] },
  ringbear: { role: 'tank', moves: ['pebbletoss', 'harden', 'dazeflash', 'boulderroll'] },
  truffowl:   { role: 'trickster', moves: ['leafflick', 'soak', 'sweetscent', 'tidalbump'] },
  magmutt:    { role: 'bruiser', moves: ['sparknip', 'harden', 'singe', 'boulderroll'] },
  nimbowhale: { role: 'tank', moves: ['splash', 'bubbleshield', 'dazeflash', 'thunderpounce'] },
  glimmoth:   { role: 'support', moves: ['zap', 'sunnap', 'sweetscent', 'bloomburst'] },
  geodeer:    { role: 'fast', moves: ['pebbletoss', 'quickstep', 'soak', 'tidalbump'] },
  maplander:  { role: 'fast', moves: ['leafflick', 'singe', 'quickstep', 'blazedash'] },
  koalith:    { role: 'tank', moves: ['pebbletoss', 'sunnap', 'harden', 'bloomburst'] },
  kettlephant: { role: 'bruiser', moves: ['splash', 'warmup', 'soak', 'blazedash'] },
  bangaroo:   { role: 'glass', moves: ['sparknip', 'quickstep', 'dazeflash', 'thunderpounce'] },
  magnebug:   { role: 'trickster', moves: ['zap', 'harden', 'dazeflash', 'boulderroll'] },
};
export const LEARN = [1, 1, 5, 10];
export const ROLE_NAME = { balanced: 'Balanced', tank: 'Tank', support: 'Support', fast: 'Fast attacker', glass: 'Glass cannon', trickster: 'Trickster', bruiser: 'Bruiser', healer: 'Healer' };
// An element variant (el is not the species' own) swaps its first move for its element's simple hit.
export const BASIC = { Leaf: 'leafflick', Ember: 'sparknip', Tide: 'splash', Spark: 'zap', Stone: 'pebbletoss' };
export const movesAt = (sp, lv, extra, el) => {
  let k = KIT[sp]?.moves || [];
  if (el && BASIC[el] && el !== SPECIES[sp].el && !SPECIES[sp].el2) k = [BASIC[el], ...k.slice(1)];
  return [...new Set([...k.filter((_, i) => lv >= LEARN[i]), ...(extra && MOVES[extra] && lv >= XMOVE_LV ? [extra] : [])])];
};
export const XMOVE_LV = 5; // a move handed down by a parent of another species wakes up at this level

// A pet's numbers at a level. Each star above the first adds 5% to its stat.
export function statsOf(pet, lv = pet.lv) {
  const b = ROLE[KIT[pet.sp]?.role] || ROLE.balanced, st = pet.stars || [3, 3, 3, 3], g = [.05, .07, .05, .05];
  const [hp, atk, def, spd] = b.map((v, i) => Math.round(v * (1 + (lv - 1) * g[i]) * (1 + ((st[i] || 1) - 1) * .05) * (i === 0 && pet.talent === 2 ? 1.1 : 1)));
  return { hp, atk, def, spd };
}
// A pet ready to fight. lv may be higher than its real level when a battle scales everyone up.
export function unit(pet, lv = pet.lv) {
  const s = statsOf(pet, lv);
  return { id: pet.id, sp: pet.sp, name: pet.name, el: elOf(pet), el2: SPECIES[pet.sp].el2 || null, lv, form: formOf(pet.lv), look: pet.look || null, early: pet.talent === 0, max: s.hp, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd,
    moves: movesAt(pet.sp, lv, pet.xmove, elOf(pet)), cd: {}, up: { atk: 0, def: 0, spd: 0 }, status: {} };
}
export const newBattle = (mine, theirs, meta = {}) => ({ ...meta, sides: [{ pets: mine, on: 0 }, { pets: theirs, on: 0 }], turn: 1, need: false, over: null });

const on = (B, s) => B.sides[s].pets[B.sides[s].on];
const stat = (u, k) => u[k] * Math.pow(1.3, u.up[k]) * (k === 'def' && u.status.soaked ? .75 : 1) * (k === 'spd' && u.status.rooted ? .5 : 1);
const ready = u => u.moves.filter(m => !u.cd[m]);
const alive = (B, s) => B.sides[s].pets.some(u => u.hp > 0);
export const canSwitch = (B, s, i) => { const t = B.sides[s].pets[i]; return !!t && t.hp > 0 && i !== B.sides[s].on && (!on(B, s).status.rooted || on(B, s).hp <= 0); };

// The other team's brain: beatable but not silly.
export function pickMove(B, s, rnd = Math.random) {
  const me = on(B, s), foe = on(B, 1 - s), rdy = ready(me);
  const worth = m => (MOVES[m].pow || 0) * hitOn(MOVES[m].el, foe) * (own(MOVES[m].el, me) ? 1.2 : 1);
  // sometimes step out of a bad match-up
  if (hitOn(foe.el, me) > 1 && rnd() < .3) {
    const i = B.sides[s].pets.findIndex((u, j) => canSwitch(B, s, j) && hitOn(foe.el, u) <= 1);
    if (i >= 0) return { switch: i };
  }
  const hits = rdy.filter(m => MOVES[m].pow).sort((a, b) => worth(b) - worth(a));
  if (hits[0] && hitOn(MOVES[hits[0]].el, foe) > 1) return { move: hits[0] };
  const heal = rdy.find(m => MOVES[m].heal); if (heal && me.hp < me.max * .4) return { move: heal };
  const util = rdy.filter(m => (MOVES[m].up && me.up[MOVES[m].up] < 2) || (MOVES[m].down && foe.up[MOVES[m].down] > -2));
  if (util.length && rnd() < .2) return { move: util[rnd() * util.length | 0] };
  return { move: hits[0] || rdy[0] || me.moves[0] };
}

// Plays one turn. act: { move: id } or { switch: index } for side 0. Returns the list of things that happened,
// in order, for the screen to show. Returns null if the action is not allowed.
export const TURN_S = 30; // seconds each player has to choose in a live battle
export function step(B, act, rnd = Math.random, act1 = null) { // act1: the other side's choice in a live battle between two players
  if (B.over !== null || !act) return null;
  const ev = [];
  const swap = (s, i) => { const old = on(B, s); old.up = { atk: 0, def: 0, spd: 0 }; B.sides[s].on = i; ev.push({ k: 'switch', s, i }); };
  const fallen = s => { // the active pet of side s just fainted
    ev.push({ k: 'faint', s });
    if (!alive(B, s)) { B.over = 1 - s; ev.push({ k: 'end', win: 1 - s }); return; }
    if (B.live) swap(s, B.sides[s].pets.findIndex(u => u.hp > 0)); // live battles keep moving: the next pet in line steps in
    else if (s === 0) B.need = true;
    else { const foe = on(B, 0), pets = B.sides[1].pets; let best = -1; pets.forEach((u, i) => { if (u.hp > 0 && (best < 0 || hitOn(foe.el, u) < hitOn(foe.el, pets[best]))) best = i; }); swap(1, best); }
  };
  if (B.need) { // choosing who comes in after a faint is free
    if (act.switch === undefined || !canSwitch(B, 0, act.switch)) return null;
    B.need = false; swap(0, act.switch); return ev;
  }
  if (act.juice ? B.live || on(B, 0).hp >= on(B, 0).max : act.switch !== undefined ? !canSwitch(B, 0, act.switch) : !ready(on(B, 0)).includes(act.move)) return null;
  const fine1 = act1 && (act1.switch !== undefined ? canSwitch(B, 1, act1.switch) : ready(on(B, 1)).includes(act1.move));
  const acts = [act, fine1 ? act1 : pickMove(B, 1, rnd)];
  for (const s of [0, 1]) if (acts[s].switch !== undefined) swap(s, acts[s].switch);
  if (act.juice) { const u = on(B, 0), n = Math.min(u.max - u.hp, Math.round(u.max * act.juice)); u.hp += n; ev.push({ k: 'juice', s: 0, n, hp: u.hp }); } // a drink takes the turn
  const order = [0, 1].filter(s => acts[s].move).sort((a, b) => (B.turn === 1 ? (on(B, b).early ? 1 : 0) - (on(B, a).early ? 1 : 0) : 0) || stat(on(B, b), 'spd') - stat(on(B, a), 'spd') || rnd() - .5);
  for (const s of order) {
    if (B.over !== null || B.need) break;
    const u = on(B, s), t = on(B, 1 - s), id = acts[s].move, m = MOVES[id];
    if (u.hp <= 0 || t.hp <= 0) continue;
    if (u.status.dazed && rnd() < .4) { ev.push({ k: 'dazed', s }); continue; }
    ev.push({ k: 'move', s, move: id });
    if (m.cd) u.cd[id] = m.cd + 1;
    if (m.pow) {
      const eff = hitOn(m.el, t);
      const dmg = Math.max(1, Math.round(m.pow * .6 * stat(u, 'atk') / stat(t, 'def') * eff * (own(m.el, u) ? 1.2 : 1) * (.9 + rnd() * .2)));
      t.hp = Math.max(0, t.hp - dmg); ev.push({ k: 'hit', s: 1 - s, dmg, eff, hp: t.hp });
      if (t.hp > 0 && m.status && !t.status[m.status]) { t.status[m.status] = STATUS[m.status].turns + 1; ev.push({ k: 'status', s: 1 - s, st: m.status }); }
      if (t.hp <= 0) fallen(1 - s);
    } else if (m.heal) { const n = Math.min(u.max - u.hp, Math.round(u.max * m.heal)); u.hp += n; ev.push({ k: 'heal', s, n, hp: u.hp }); }
    else if (m.up) { const can = u.up[m.up] < 2; if (can) u.up[m.up]++; ev.push({ k: 'stat', s, stat: m.up, d: can ? 1 : 0 }); }
    else if (m.down) { const can = t.up[m.down] > -2; if (can) t.up[m.down]--; ev.push({ k: 'stat', s: 1 - s, stat: m.down, d: can ? -1 : 0 }); }
  }
  // end of the turn: burns sting, statuses and cooldowns run down
  for (const s of [0, 1]) {
    const u = on(B, s);
    if (B.over === null && u.hp > 0 && u.status.singed) {
      const dmg = Math.max(1, Math.round(u.max * .06)); u.hp = Math.max(0, u.hp - dmg); ev.push({ k: 'burn', s, dmg, hp: u.hp });
      if (u.hp <= 0) fallen(s);
    }
    for (const x of B.sides[s].pets) {
      for (const k of Object.keys(x.cd)) if (--x.cd[k] <= 0) delete x.cd[k];
      for (const k of Object.keys(x.status)) if (--x.status[k] <= 0) { delete x.status[k]; if (x.hp > 0 && x === on(B, s)) ev.push({ k: 'clear', s, st: k }); }
    }
  }
  B.turn++;
  return ev;
}

if (PL) (await import('../../lang/farm-pl.js')).plBattle({ MOVES, STATUS, STAT_NAME, ROLE_NAME });

// Pet Farm breeding: what a baby inherits from its two parents. Shared by the server (which rolls the dice) and
// the browser (which shows the odds and draws the looks). Nothing here touches the network or the save file.
import { SPECIES, familyOf, kin } from './data.js';
import { KIT } from './battle.js';

// Natural coats: main colour and second colour (belly, wool tips, flippers).
export const COAT = {
  mossbun: ['#f7ecd0', '#ffffff'], sproutle: ['#bfd98a', '#e6d9a0'], petalpuff: ['#fff6ec', '#ffe3ee'], truffowl: ['#e9d3b0', '#fff3df'],
  cindercub: ['#f59a48', '#fff3df'], toastoad: ['#f1c27a', '#f7dba4'], flickit: ['#ffe27a', '#fff6c8'], magmutt: ['#c96a3c', '#f3c9a0'],
  puddlepup: ['#e6eef4', '#c3d2de'], bubblefin: ['#ffb14a', '#ffe7b8'], axolily: ['#ffc4d6', '#ffe3ec'], nimbowhale: ['#7fb4e6', '#eaf4ff'],
  zapkit: ['#ffe066', '#fff6c8'], buzzlet: ['#ffd23e', '#fff3c4'], voltvole: ['#f2c9a0', '#fff3df'], glimmoth: ['#d9c9f2', '#fff3df'],
  acornip: ['#c98a55', '#f6dcb8'], lanternail: ['#f2a57a', '#ffe0c2'], ripplet: ['#fff2b0', '#ffffff'], wattbat: ['#8f7fc9', '#e6dcff'], rubblet: ['#b9b2a8', '#8a8794'],
  bambear: ['#fffaf0', '#ffffff'], sizzlet: ['#e8607a', '#fff0c4'], waddlet: ['#5b7fb8', '#ffffff'], oinkwatt: ['#ffc9c0', '#ffe9a8'], tricerock: ['#b5c9a0', '#f0ead0'],
  strawbun: ['#ff5a6e', '#ffd9de'], chilipup: ['#e8402a', '#ffd0a0'], melonwhale: ['#5fb85a', '#ff7a8a'], lemonzest: ['#ffe14a', '#fff6b0'], coconutkin: ['#8a5a3c', '#fffaf0'], pinepine: ['#ffc93c', '#fff0b0'], croissab: ['#e8a85a', '#fff0c8'], donuseal: ['#eef2f6', '#ff9ec4'], cupcowl: ['#f3e0c0', '#ff9ec4'], pretzelisk: ['#c98a4a', '#fff3df'], mallowlamb: ['#ffffff', '#ffd9e8'], candraffe: ['#ffffff', '#ff5a6e'], jellifrog: ['#7fe0a0', '#c9ffd9'], carrofox: ['#ff9a3c', '#fff3df'], pumpkit: ['#ff9a2c', '#fff3df'], peapillar: ['#8fd45a', '#b9e87a'], shroomouse: ['#e9d9c9', '#fff3df'], snowfox: ['#eaf6ff', '#ffffff'], sunlion: ['#ffc93c', '#fff0b0'], dripfrog: ['#6fb7e8', '#dff4ff'], twistret: ['#b9c2d0', '#eef2f7'], moonbun: ['#d9d0ff', '#fff9d9'], starjelly: ['#c9b5ff', '#fff3a0'], cometail: ['#7fb8ff', '#fff6c8'], ringbear: ['#f2c9a0', '#c9b5ff'],
  shrimplet: ['#ff9a8a', '#ffe0d6'], siamew: ['#f6ead8', '#6b4a3c'], coralcolt: ['#ffc857', '#fff0c0'], skipfin: ['#7fc4e8', '#f2fbff'],
  gingersnap: ['#f5a04a', '#fff3df'], patchkit: ['#ffffff', '#f5a04a'], tuxpurr: ['#5b5766', '#ffffff'], fluffcoon: ['#b08a6a', '#f3e6d2'],
  munchmew: ['#f3c98a', '#fff3df'], glazemew: ['#f0b878', '#fff3df'],
  rocktopus: ['#b08ad0', '#e6d4f5'], driftle: ['#8fd0c0', '#f0ead0'], zapuff: ['#ffe27a', '#fffaf0'], ottershell: ['#9a6a4a', '#f0dcc0'], cinnapanda: ['#c8683f', '#fff3df'], yuzubara: ['#b98a5e', '#d9b48a'], snoozloth: ['#a89880', '#f0e6d2'], glidenut: ['#b5a08a', '#fff3df'],
  pebblet: ['#d9b89a', '#8a8794'], cragcrab: ['#e2705a', '#f6c9a8'], dustmole: ['#8a6f63', '#c9b0a2'], geodeer: ['#c9b59a', '#f3e6d2'],
};
// Coat colour genes. A pet carries two; the one earlier in this list is the one that shows.
export const COATS = [{ name: 'Natural' }, { name: 'Rose', c: '#f7b7d0' }, { name: 'Sky', c: '#a8d4f5' }, { name: 'Mint', c: '#a9e3bd' }, { name: 'Lilac', c: '#c9b5f0' }, { name: 'Cocoa', c: '#8a6a5a' }];
export const PATTERNS = { spots: 'Spots', stripes: 'Stripes', star: 'Star', patch: 'Patch' };
// The part a baby can borrow from a parent of another species (drawn in pets3d.js).
export const PART = { mossbun: 'bunny ears', sproutle: 'a sprout', petalpuff: 'a flower crown', truffowl: 'a mushroom cap', cindercub: 'a flame tail',
  toastoad: 'a pat of butter', flickit: 'a candle flame', magmutt: 'lava rocks', puddlepup: 'seal flippers', bubblefin: 'a sail fin', axolily: 'a lily pad',
  nimbowhale: 'a rain cloud', zapkit: 'a lightning tail', buzzlet: 'buzzy wings', voltvole: 'a spark tuft', glimmoth: 'glowing wings', pebblet: 'pebble spines',
  shrimplet: 'a fan tail', siamew: 'a chocolate tail', coralcolt: 'a coral crown', skipfin: 'a beach ball',
  gingersnap: 'a striped tail', patchkit: 'a daisy', tuxpurr: 'a top hat', fluffcoon: 'a bushy tail',
  munchmew: 'a ribbon bow', glazemew: 'pink icing',
  rocktopus: 'a pebble stack', driftle: 'a starfish', zapuff: 'puffer spikes', ottershell: 'a paddle tail', cinnapanda: 'a ringed tail', yuzubara: 'a yuzu', snoozloth: 'a nightcap', glidenut: 'glider flaps',
  cragcrab: 'a boulder shell', dustmole: 'a hard hat', geodeer: 'crystal antlers',
  acornip: 'an acorn cap', lanternail: 'a lantern shell', ripplet: 'a wave curl', wattbat: 'bolt ears', rubblet: 'a gem crown',
  bambear: 'a bamboo shoot', sizzlet: 'dragon wings', waddlet: 'a seashell hat', oinkwatt: 'a curly spark tail', tricerock: 'a stone frill',
  strawbun: 'a strawberry top', chilipup: 'a chili stem', melonwhale: 'a melon slice', lemonzest: 'a peel curl', coconutkin: 'a palm sprout', pinepine: 'a pineapple crown', croissab: 'a croissant', donuseal: 'a little donut', cupcowl: 'a frosting swirl', pretzelisk: 'a pretzel bow', mallowlamb: 'a toasted marshmallow', candraffe: 'candy cane horns', jellifrog: 'a wobbly jelly', carrofox: 'a carrot tail', pumpkit: 'a pumpkin stem', peapillar: 'a pea pod', shroomouse: 'a spotted cap', snowfox: 'a snowy tail', sunlion: 'a crown of sun rays', dripfrog: 'a leaf umbrella', twistret: 'a little whirlwind', moonbun: 'a slice of moon', starjelly: 'a lucky star', cometail: 'a comet tail', ringbear: 'a planet ring' };
// Families (data.js): a baby of two pets from one family takes its build (species) from one parent and its coat from
// either. p.cat is the species whose coat a pet wears, when it is not its own (the name is from the cats, who came first).
// The cats' coats have their own names and markings; every other family swaps its colours.
export const CATS = { siamew: 'Siamese points', gingersnap: 'Tabby stripes', patchkit: 'Calico patches', tuxpurr: 'Tuxedo', fluffcoon: 'Maine Coon brown', munchmew: 'Golden cream', glazemew: 'Golden cream' };
export const kinCoat = p => familyOf(p.sp) ? (p.cat && kin(p.cat, p.sp) ? p.cat : p.sp) : null;
export const coatName = sp => CATS[sp] ? `a ${CATS[sp].toLowerCase()} coat` : `${SPECIES[sp].name} colours`;
export const TALENTS = [
  { name: 'Early Bird', blurb: 'Always moves first on the first turn of a battle.' },
  { name: 'Forager', blurb: 'Its party brings back 10% more from expeditions.' },
  { name: 'Tough Cookie', blurb: '10% more health in battles.' },
  { name: 'Quick Learner', blurb: 'Earns 10% more experience.' },
  { name: 'Lucky Charm', blurb: 'Wild pets follow its party home a little more often.' },
  { name: 'Homebody', blurb: 'Rests half as long after visiting the Nest.' },
];
export const STAR_NAME = ['Health', 'Attack', 'Defence', 'Speed'];
// Two parents of these elements can have the breeding-only species. The game never shows this table.
const RECIPE = { 'Leaf+Tide': 'truffowl', 'Ember+Stone': 'magmutt', 'Spark+Tide': 'nimbowhale', 'Leaf+Spark': 'glimmoth', 'Stone+Tide': 'geodeer' };
export const HYBRID_CHANCE = .2, BREED_LV = 5, CUDDLE_H = 2, REST_H = 6, HATCH_H = [4, 6, 8, 12];

const hex = n => n.toString(16).padStart(2, '0');
export function mixHex(a, b, t = .5) {
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => hex(Math.round(v + (y[i] - v) * t))).join('');
}
const pats = p => Array.isArray(p.pat) ? p.pat.filter(k => PATTERNS[k]) : [];
// The colour a pet's coat shows, as a hex. Natural means its species' own colour.
export const coatHex = (p, sp = p.sp) => p.blend || COATS[p.col?.[0] || 0]?.c || COAT[sp === p.sp && kinCoat(p) || sp][0];
// What the 3D model needs to draw this pet.
export function lookOf(p) {
  const l = {};
  if (p.blend) l.coat = p.blend; else if (p.col?.[0]) l.coat = COATS[p.col[0]].c;
  if (p.two != null) l.coat2 = p.two ? COATS[p.two].c : COAT[p.sp][0];
  if (kinCoat(p) && kinCoat(p) !== p.sp) l.cat = p.cat;
  if (pats(p).length) l.pat = pats(p);
  if (p.feat && p.feat !== p.sp) l.feat = p.feat;
  if (p.sparkle) l.spark = 1;
  return Object.keys(l).length ? l : null;
}
// A short record of a pet for family trees: enough to draw its portrait after it has moved on.
export const snapshot = (p, owner) => ({ name: p.name, sp: p.sp, lv: p.lv, look: lookOf(p), own: owner || null });

const els = sp => [SPECIES[sp].el, SPECIES[sp].el2].filter(Boolean);
export function hybridOf(a, b) {
  if (a === b || kin(a, b)) return null; // two of a family always have one of their own
  for (const x of els(a)) for (const y of els(b)) { const h = RECIPE[[x, y].sort().join('+')]; if (h && h !== a && h !== b) return h; }
  return null;
}
// The species a pair can have, with chances that add up to 1.
export function speciesOdds(a, b) {
  if (a === b) return [{ sp: a, p: 1 }];
  const h = hybridOf(a, b), rest = h ? 1 - HYBRID_CHANCE : 1;
  return [{ sp: a, p: rest / 2 }, { sp: b, p: rest / 2 }, ...(h ? [{ sp: h, p: HYBRID_CHANCE, hybrid: true }] : [])];
}
export const hatchHours = sp => HATCH_H[SPECIES[sp].rare] || 4;
// The egg: its shell is the colour of one parent and its speckles the colour of the other.
export const shellOf = (a, b) => ({ base: mixHex(coatHex(a), '#fff6e6', .45), speck: mixHex(coatHex(b), '#6b4a3c', .25) });

// Rolls a baby. a and b are full pet records (b may belong to a friend). Returns the new pet's traits, without id or name.
export function makeBaby(a, b, rnd = Math.random) {
  const pick = list => list[Math.floor(rnd() * list.length)];
  let r = rnd(), sp = a.sp;
  for (const o of speciesOdds(a.sp, b.sp)) { if (r < o.p) { sp = o.sp; break; } r -= o.p; }
  const other = sp === a.sp ? b : sp === b.sp ? a : pick([a, b]);
  const kid = { sp, lv: 1, xp: 0 };
  if (kin(a.sp, b.sp)) { const c = pick([kinCoat(a), kinCoat(b)]); if (c !== sp) kid.cat = c; } // one family: the coat can come from either side
  kid.col = [pick(a.col || [0, 0]), pick(b.col || [0, 0])].sort((x, y) => x - y);
  // a soft blend of both coats, or two tones, when the parents show different colours
  const ca = coatHex(a, sp), cb = coatHex(b, sp);
  if (ca !== cb) { const t = rnd(); if (t < .15) kid.blend = mixHex(ca, cb); else if (t < .3 && kid.col[0] !== kid.col[1]) kid.two = kid.col[1]; }
  const got = new Set();
  for (const p of [a, b]) for (const k of pats(p)) if (rnd() < .45) got.add(k);
  if (rnd() < .1) got.add(pick(Object.keys(PATTERNS)));
  kid.pat = [...got].slice(0, 2);
  // one visible part from the other side of the family; a borrowed part can be handed down again
  const parts = [a, b].map(p => p.feat).filter(f => f && f !== sp);
  if (other.sp !== sp && rnd() < .4) kid.feat = other.sp; else if (parts.length && rnd() < .5) kid.feat = pick(parts);
  kid.stars = [0, 1, 2, 3].map(i => Math.max(1, Math.min(5, Math.round(((a.stars?.[i] || 3) + (b.stars?.[i] || 3)) / 2 + (rnd() < .5 ? -.01 : .01)) + pick([-1, 0, 0, 1]))));
  const t = rnd(); kid.talent = t < .4 ? a.talent || 0 : t < .8 ? b.talent || 0 : Math.floor(rnd() * TALENTS.length);
  if (other.sp !== sp && rnd() < .5) { const extra = (KIT[other.sp]?.moves || []).filter(m => !KIT[sp].moves.includes(m)); if (extra.length) kid.xmove = pick(extra); }
  kid.sparkle = rnd() < (a.sparkle && b.sparkle ? 1 / 4 : a.sparkle || b.sparkle ? 1 / 16 : 1 / 64);
  return kid;
}

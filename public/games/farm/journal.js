// The Farm Journal (Dziennik farmy): a questline from the first steps to the big goals. Shared by the server, which
// checks every task, and the page, which shows them. Kuba's plan (2026-11-25):
//   - chapters of 4 to 6 tasks; one task at a time is pinned on the farm screen, so the first chapters are the tutorial
//   - tasks are read from the farm itself (plus a few counters of things done), never counted from the day it shipped,
//     so a farm that already did something gets the tick at once
//   - rewards: chapters 1 to 5 give a small handful of materials (about one Stroll's worth) and a journal decoration;
//     chapter 6 on gives no materials, only stamps, an exclusive decoration and, from chapter 7, a Nest charm
//   - a chapter that was already finished when the journal first opened pays its decoration and stamps, not materials
// Things built by other parts of the game that the tasks read: f.inv.stamps (island orders), f.charms / f.charmsUsed
// (Nest charms), f.far (far expeditions), the 'museum' item (Pet Museum), farmhouse levels 6 and 7.
import { L } from '../../i18n.js';
import { SPECIES, SIZES, countOf, topLv, palsOf } from './data.js';

// A species is in the album once it has been owned in any form (seen-only entries are [0, 0, 0]).
export const owned = f => Object.entries(f.album || {}).filter(([sp, a]) => SPECIES[sp] && a.some(Boolean)).length;
const went = (f, t, z) => !!t.z?.[z] || f.pets.some(p => p.from === z);
// Every element one species has been raised in (hybrids have two fixed elements, so only single-element species count).
const allEls = f => Object.entries(f.vars || {}).some(([sp, els]) => SPECIES[sp] && !SPECIES[sp].el2 && new Set(els).size >= 5);
const variant = f => Object.entries(f.vars || {}).some(([sp, els]) => SPECIES[sp] && !SPECIES[sp].el2 && els.some(e => e !== SPECIES[sp].el));

// Each task: id, text, done(f, t, x) where t is the farm's counters (f.jt) and x = { old, friends, out }.
//   old: the farm was made before the journal, so things it surely did before then (it has a Kitchen, so it has cooked)
//        count without a counter. at: the building that gets the floating sign while this task is pinned.
//   go: what the pinned card's button opens on the farm screen.
export const CHAPTERS = [
  { id: 'welcome', name: () => L('Welcome home', 'Witaj w domu'), deco: 'jsign', mats: { wood: 20, fiber: 10 },
    intro: () => L('Your farm starts small. Send your first pet exploring and plant something.', 'Twoja farma zaczyna od małego. Wyślij pierwszego zwierzaka na wyprawę i coś posadź.'),
    tasks: [
      { id: 'gate', text: () => L('Build an Expedition Gate', 'Zbuduj Bramę wypraw'), done: f => countOf(f, 'gate') > 0, go: { a: 'buy', type: 'gate' } },
      { id: 'send', text: () => L('Send a party exploring', 'Wyślij drużynę na wyprawę'), done: (f, t, x) => (f.trips || 0) > 0 || x.out > 0, go: { a: 'explore' }, at: 'gate' },
      { id: 'home', text: () => L('Welcome your party home', 'Przywitaj drużynę po powrocie'), done: f => (f.trips || 0) > 0, go: { a: 'collect' }, at: 'gate' },
      { id: 'garden', text: () => L('Plant a Garden Plot', 'Załóż grządkę'), done: f => countOf(f, 'garden') > 0, go: { a: 'buy', type: 'garden' } },
    ] },
  { id: 'settle', name: () => L('Settling in', 'Urządzamy się'), deco: 'jboard', mats: { stone: 15, fiber: 10 },
    intro: () => L('Berries grow into treats, and treats help pets grow.', 'Z jagód powstają smakołyki, a smakołyki pomagają zwierzakom rosnąć.'),
    tasks: [
      { id: 'pick', text: () => L('Pick berries', 'Zbierz jagody'), done: (f, t, x) => !!t.pick || (x.old && countOf(f, 'garden') > 0), go: { a: 'berries' }, at: 'garden' },
      { id: 'kitchen', text: () => L('Build a Kitchen', 'Zbuduj Kuchnię'), done: f => countOf(f, 'kitchen') > 0, go: { a: 'buy', type: 'kitchen' } },
      { id: 'cook', text: () => L('Cook a Berry Cookie', 'Upiecz ciastko jagodowe'), done: (f, t, x) => !!t.cook || (x.old && countOf(f, 'kitchen') > 0), go: { a: 'card', type: 'kitchen' }, at: 'kitchen' },
      { id: 'feed', text: () => L('Feed a pet a treat', 'Daj zwierzakowi smakołyk'), done: (f, t, x) => !!t.feed || (x.old && countOf(f, 'kitchen') > 0), go: { a: 'pets' } },
      { id: 'hut', text: () => L('Build a Pet Hut', 'Zbuduj Chatkę zwierzaków'), done: f => countOf(f, 'hut') > 0, go: { a: 'buy', type: 'hut' } },
    ] },
  { id: 'afield', name: () => L('Farther afield', 'Coraz dalej'), deco: 'jpost', mats: { crystal: 1 },
    intro: () => L('A bigger farmhouse opens new islands to explore.', 'Większy dom otwiera nowe wyspy do zwiedzania.'),
    tasks: [
      { id: 'house2', text: () => L('Improve the farmhouse to level 2', 'Ulepsz dom do poziomu 2'), done: f => (f.house || 1) >= 2, go: { a: 'card', type: 'house' }, at: 'house' },
      { id: 'cove', text: () => L('Explore Tidepool Cove', 'Zwiedź Zatoczkę Pływów'), done: (f, t, x) => went(f, t, 'cove') || (x.old && (f.house || 1) >= 3), go: { a: 'explore', zone: 'cove' }, at: 'gate' },
      { id: 'ridge', text: () => L('Explore Pebble Ridge', 'Zwiedź Kamykową Grań'), done: (f, t, x) => went(f, t, 'ridge') || (x.old && (f.house || 1) >= 3), go: { a: 'explore', zone: 'ridge' }, at: 'gate' },
      { id: 'gate2', text: () => L('Improve the Expedition Gate to level 2', 'Ulepsz Bramę wypraw do poziomu 2'), done: f => topLv(f, 'gate') >= 2, go: { a: 'card', type: 'gate' }, at: 'gate' },
    ] },
  { id: 'family', name: () => L('A growing family', 'Rodzina rośnie'), deco: 'jcradle', mats: { cookie: 3 },
    intro: () => L('Two rested pets in the Nest bring an egg. Wild pets join you when you win them over.', 'Dwa wypoczęte zwierzaki w Gnieździe przynoszą jajko. Dzikie zwierzaki dołączają, gdy je pokonasz.'),
    tasks: [
      { id: 'nest', text: () => L('Build the Nest', 'Zbuduj Gniazdo'), done: f => countOf(f, 'nest') > 0, go: { a: 'buy', type: 'nest' } },
      { id: 'lv5', text: () => L('Raise a pet to level 5', 'Wychowaj zwierzaka do poziomu 5'), done: f => f.pets.some(p => p.lv >= 5), go: { a: 'pets' } },
      { id: 'pair', text: () => L('Pair two pets in the Nest', 'Połącz dwa zwierzaki w Gnieździe'), done: (f, t) => !!t.pair || f.pets.some(p => (p.kids || 0) > 0 || p.bred), go: { a: 'card', type: 'nest' }, at: 'nest' },
      { id: 'hatch', text: () => L('Hatch an egg', 'Wykluj jajko'), done: (f, t) => !!t.hatch || f.pets.some(p => p.bred), go: { a: 'card', type: 'nest' }, at: 'nest' },
      { id: 'wild', text: () => L('Win a battle against a wild pet', 'Wygraj walkę z dzikim zwierzakiem'), done: (f, t, x) => !!t.wild || (x.old && (f.trips || 0) >= 10), go: { a: 'explore' }, at: 'gate' },
    ] },
  { id: 'friends', name: () => L('Friends and neighbours', 'Przyjaciele i sąsiedzi'), deco: 'jtable', mats: { shells: 5, coal: 5 },
    intro: () => L('Other farms float nearby. Visit them on the world map.', 'Inne farmy unoszą się w pobliżu. Odwiedź je na mapie świata.'),
    tasks: [
      { id: 'friend', text: () => L('Add a friend', 'Dodaj znajomego'), done: (f, t, x) => x.friends > 0, go: { a: 'friends' } },
      { id: 'help', text: () => L('Help out on a neighbour’s farm', 'Pomóż na farmie sąsiada'), done: (f, t, x) => !!t.help || (x.old && palsOf(f) > 0), go: { a: 'map' } },
      { id: 'gift', text: () => L('Leave a gift for a neighbour', 'Zostaw prezent sąsiadowi'), done: (f, t, x) => !!t.gift || (x.old && palsOf(f) > 0), go: { a: 'map' } },
      { id: 'date', text: () => L('Have a playdate at a friend’s Nest', 'Urządź zabawę w Gnieździe znajomego'), done: (f, t, x) => !!t.date || (x.old && palsOf(f) > 0), go: { a: 'map' } },
      { id: 'house3', text: () => L('Improve the farmhouse to level 3', 'Ulepsz dom do poziomu 3'), done: f => (f.house || 1) >= 3, go: { a: 'card', type: 'house' }, at: 'house' },
    ] },
  { id: 'master', name: () => L('Master farmer', 'Mistrz farmy'), deco: 'jvane', stamps: 5,
    intro: () => L('The big goals: a grand farmhouse, the best buildings and a full album.', 'Wielkie cele: okazały dom, najlepsze budynki i pełny album.'),
    tasks: [
      { id: 'house5', text: () => L('Improve the farmhouse to level 5', 'Ulepsz dom do poziomu 5'), done: f => (f.house || 1) >= 5, go: { a: 'card', type: 'house' }, at: 'house' },
      { id: 'barn3', text: () => L('Improve the Storage Barn to level 3', 'Ulepsz Stodołę do poziomu 3'), done: f => topLv(f, 'barn') >= 3, go: { a: 'card', type: 'barn', buy: 'barn' }, at: 'barn' },
      { id: 'shop3', text: () => L('Improve the Workshop to level 3', 'Ulepsz Warsztat do poziomu 3'), done: f => topLv(f, 'workshop') >= 3, go: { a: 'card', type: 'workshop', buy: 'workshop' }, at: 'workshop' },
      { id: 'land', text: () => L('Grow the land to its biggest', 'Powiększ ziemię do największej'), done: f => f.size >= SIZES[SIZES.length - 1], go: { a: 'land' } },
      { id: 'sp20', text: () => L('Find 20 species for the Pet Album', 'Znajdź 20 gatunków do Albumu'), done: f => owned(f) >= 20, go: { a: 'album' }, n: f => [owned(f), 20] },
    ] },
  { id: 'clouds', name: () => L('Beyond the clouds', 'Ponad chmurami'), deco: 'jscope', stamps: 8, charm: 1,
    intro: () => L('Past level 5 the farmhouse opens far islands and Nest charms.', 'Powyżej poziomu 5 dom otwiera dalekie wyspy i amulety do Gniazda.'),
    tasks: [
      { id: 'house6', text: () => L('Improve the farmhouse to level 6', 'Ulepsz dom do poziomu 6'), done: f => (f.house || 1) >= 6, go: { a: 'card', type: 'house' }, at: 'house' },
      { id: 'far', text: () => L('Come back from a far expedition', 'Wróć z dalekiej wyprawy'), done: f => (f.far || 0) >= 1, go: { a: 'explore' }, at: 'gate' },
      { id: 'charm', text: () => L('Use a Nest charm', 'Użyj amuletu w Gnieździe'), done: f => (f.charmsUsed || 0) >= 1, go: { a: 'card', type: 'nest' }, at: 'nest' },
      { id: 'variant', text: () => L('Hatch a pet in an element that is not its usual one', 'Wykluj zwierzaka w nietypowym dla niego żywiole'), done: f => variant(f), go: { a: 'card', type: 'nest' }, at: 'nest' },
    ] },
  { id: 'collector', name: () => L('Collector', 'Kolekcjoner'), deco: 'jcup', stamps: 12, charm: 1,
    intro: () => L('For the patient: a museum of your own and an album few farms finish.', 'Dla cierpliwych: własne muzeum i album, który kończy niewiele farm.'),
    tasks: [
      { id: 'sp30', text: () => L('Find 30 species', 'Znajdź 30 gatunków'), done: f => owned(f) >= 30, go: { a: 'album' }, n: f => [owned(f), 30] },
      { id: 'sp45', text: () => L('Find 45 species', 'Znajdź 45 gatunków'), done: f => owned(f) >= 45, go: { a: 'album' }, n: f => [owned(f), 45] },
      { id: 'sp60', text: () => L('Find 60 species', 'Znajdź 60 gatunków'), done: f => owned(f) >= 60, go: { a: 'album' }, n: f => [owned(f), 60] },
      { id: 'els', text: () => L('Raise one species in all five elements', 'Wychowaj jeden gatunek we wszystkich pięciu żywiołach'), done: f => allEls(f), go: { a: 'album' } },
      { id: 'house7', text: () => L('Improve the farmhouse to level 7', 'Ulepsz dom do poziomu 7'), done: f => (f.house || 1) >= 7, go: { a: 'card', type: 'house' }, at: 'house' },
      { id: 'museum', text: () => L('Open the Pet Museum and finish all five halls', 'Otwórz Muzeum zwierzaków i ukończ wszystkie pięć sal'), done: f => topLv(f, 'museum') >= 5, go: { a: 'card', type: 'museum', buy: 'museum' }, at: 'museum' },
    ] },
];

// The journal as the farm's owner sees it: which tasks are ticked, which chapters have been claimed, which one is open.
//   got: chapters claimed so far (they are claimed in order). old: chapters that were finished before the journal
//   existed, which pay no materials.
export function journalOf(f, x) {
  const t = f.jt || {}, got = f.jn?.got || 0;
  const tick = CHAPTERS.map(c => c.tasks.map(q => !!q.done(f, t, x)));
  const n = CHAPTERS.map(c => c.tasks.map(q => q.n ? q.n(f) : null));
  return { got, old: f.jn?.old || 0, tick, n };
}
export const chapterDone = (j, i) => !!j.tick[i]?.every(Boolean);
// The task that is pinned on the farm screen: the first open task of the open chapter. null when the chapter is done
// (then the card offers the reward) or every chapter is claimed.
export function pinned(j) {
  const i = j.got; if (i >= CHAPTERS.length) return null;
  const k = j.tick[i].indexOf(false);
  return k < 0 ? { ch: i, claim: true } : { ch: i, task: CHAPTERS[i].tasks[k], k };
}
// What a chapter pays. old: it was finished before the journal opened, so only the decoration, stamps and charm.
export const rewardOf = (i, old = false) => { const c = CHAPTERS[i]; return { mats: old ? {} : { ...(c.mats || {}) }, deco: c.deco, stamps: c.stamps || 0, charm: c.charm || 0 }; };

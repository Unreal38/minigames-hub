// Lantern Night's island, shared by the page and the server (no three.js here): where the chore places, the hollow logs,
// the dock and the campfire stand, what blocks walking, how far each player can see, and the chores themselves.
// Units are metres of the 3D scene. An avatar is about 1.7 tall. +z is towards the camera (south), like the Plaza.
import { L } from '../../i18n.js';

export const R_WALK = 22.5;   // you can walk this far from the middle
export const SPEED = 4.6;     // walking, metres a second
export const GHOST_SPEED = 5.6; // a pet (players who are out) trots a little faster and goes through everything
export const Q = 20;          // positions travel as whole numbers: metres x Q
export const FIRE_R = 1.1;    // the campfire blocks this much
export const BELL = [0, -2.6]; // the meeting bell stands just north of the fire
export const REACH = 2.3;     // how near you must stand to a chore, a log, a rope or the bell
export const LULL_REACH = 1.9; // how near a Sneak must stand to lull someone
export const REPORT_REACH = 3.4; // how near you must be to a sleeper to ring for a meeting
export const GLOW = 7.5, GLOW_SNEAK = 9.5, GLOW_DARK = 3.4; // how far you see: islanders, Sneaks, islanders while the lighthouse is out

// Chore places: [id, Pet Farm decoration, x, z, turn, size, blocking radius, chore kind].
// Kinds (client.js draws them): hold = press and hold, taps = tap every target, seq = tap 1..5 in order, fill = stop the bar in the band.
export const STATIONS = [
  { id: 'light', item: 'lighthouse', x: -15.5, z: -12.5, ry: .5, s: 2.2, r: 1.25, kind: 'seq', name: () => L('Lighthouse', 'Latarnia'), job: () => L('Light the lamps', 'Zapal lampy') },
  { id: 'mill', item: 'windmill', x: 15.5, z: -12, ry: -.6, s: 2.1, r: 1.3, kind: 'hold', name: () => L('Windmill', 'Wiatrak'), job: () => L('Crank the windmill', 'Zakręć wiatrakiem') },
  { id: 'barn', item: 'barn', x: -17, z: 3.5, ry: 1.35, s: 1.5, r: 2.1, kind: 'taps', name: () => L('Pet barn', 'Stodoła'), job: () => L('Feed the pets', 'Nakarm zwierzaki') },
  { id: 'kitchen', item: 'kitchen', x: 2.5, z: -18.5, ry: 0, s: 1.5, r: 2.1, kind: 'taps', name: () => L('Kitchen hut', 'Kuchnia'), job: () => L('Sort the snacks', 'Posortuj przekąski') },
  { id: 'garden', item: 'garden', x: 16.5, z: 5.5, ry: -1.3, s: 1.7, r: 0, kind: 'fill', name: () => L('Garden', 'Ogród'), job: () => L('Water the garden', 'Podlej ogród') },
  { id: 'well', item: 'well', x: -8.5, z: 13.5, ry: .3, s: 1.8, r: 1.05, kind: 'hold', name: () => L('Well', 'Studnia'), job: () => L('Draw water', 'Wyciągnij wodę') },
  { id: 'dock', item: null, x: 7.5, z: 20.4, ry: 0, s: 1, r: 0, kind: 'fill', name: () => L('Dock', 'Przystań'), job: () => L('Coil the rope', 'Zwiń linę') },
];
export const ST = Object.fromEntries(STATIONS.map((s, i) => [s.id, i]));
// Where you stand to do a chore: in front of the place, on the side that faces the campfire.
export const spotOf = st => { const d = Math.hypot(st.x, st.z) || 1, k = st.r + 1.1; return [st.x - st.x / d * k, st.z - st.z / d * k]; };
export const CHORE_MS = { hold: 2600, taps: 2200, seq: 2000, fill: 1500 }; // the quickest a chore can really be done (the server checks)

// Hollow logs: only Sneaks can crawl in and pop out of the next one round the island.
export const LOGS = [[-20, -2.5, .2], [-3.5, -21, 1.4], [20, -1.5, -.2], [-1.5, 20.5, 1.6]];
// The ferry's two mooring ropes at the dock: when the Sneaks untie the ferry, two islanders must hold both at once.
export const ROPES = [[4.6, 20.6], [10.4, 20.6]];
export const ROPE_MS = 40_000;  // the ferry drifts off (Sneaks win) if nobody ties it within this
export const DARK_FIX = 'light'; // the lighthouse is relit at its own chore place
export const MISCHIEF_WAIT = 30_000, MISCHIEF_FIRST = 20_000; // cooldown between two pranks, and none in the first seconds
export const LULL_WAIT = { 20: 20_000, 30: 30_000, 45: 45_000 };

// Other things on the island: [Pet Farm decoration, x, z, turn, size, blocking radius].
export const DECOR = [
  ['campfire', 0, 0, 0, 2.2, FIRE_R],
  ...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2 + .3; return ['haybale', Math.cos(a) * 4.2, Math.sin(a) * 4.2, -a + Math.PI / 2, 1.5, .7]; }),
  ['lamp', -6.5, -6.5, 0, 1.9, .35], ['lamp', 6.5, -6.5, 0, 1.9, .35], ['lamp', -7, 6.5, 0, 1.9, .35], ['lamp', 7, 6.5, 0, 1.9, .35],
  ['lamp', -12, -2, 0, 1.9, .35], ['lamp', 12, -2.5, 0, 1.9, .35], ['lamp', 0, -11, 0, 1.9, .35], ['lamp', 2, 12, 0, 1.9, .35],
  ['tree', -9, -15, 0, 1.9, .8], ['tree', 9.5, -16, 0, 2, .8], ['pine', -19, -9, 0, 1.9, .7], ['pine', 19.5, -6.5, 0, 2, .7], ['tree', -14, 13, 0, 1.9, .8],
  ['tree', 17.5, 12.5, 0, 1.9, .8], ['bush', -4.5, -14.5, 0, 1.6, .6], ['bush', 11, 9.5, 0, 1.6, .6], ['bush', -11, 7.5, 0, 1.6, .6], ['pine', 13, 17, 0, 1.8, .7],
  ['rock', -6, 18.5, 0, 1.6, .7], ['rock', 21, 4, 0, 1.4, .6], ['bench', 4.5, 9, -.4, 1.7, .9], ['bench', -11, -6, 1.2, 1.7, .9],
];

// What blocks walking: circles [x, z, r]. The page slides you round them; the server only checks the island's edge.
export const BLOCKS = [...STATIONS.filter(s => s.r > 0).map(s => [s.x, s.z, s.r]), ...DECOR.filter(t => t[5] > 0).map(t => [t[1], t[2], t[5]]), ...LOGS.map(([x, z]) => [x, z, .7]), [BELL[0], BELL[1], .3]];
export const clampWalk = (x, z) => { const d = Math.hypot(x, z); return d > R_WALK ? [x * R_WALK / d, z * R_WALK / d] : [x, z]; };
// Slide a step out of anything solid it ended in (pets of players who are out walk through everything).
export function unblock(x, z, body = .38) {
  for (const b of BLOCKS) { const dx = x - b[0], dz = z - b[1], d = Math.hypot(dx, dz), min = b[2] + body; if (d < min && d > 1e-4) { x = b[0] + dx / d * min; z = b[1] + dz / d * min; } }
  return clampWalk(x, z);
}
// Where everybody stands when a game or a meeting starts: a ring round the fire, in seat order.
export const ringAt = (i, n) => { const a = i / Math.max(1, n) * Math.PI * 2 + Math.PI / 2; return [Math.cos(a) * 5.6, Math.sin(a) * 5.6]; };

// How many Sneaks a table has.
export const sneaksFor = (n, pick = 'auto') => pick === 1 || pick === 2 ? Math.min(pick, Math.max(1, Math.floor((n - 1) / 3))) : n >= 7 ? 2 : 1;
export const TALK = [30, 45, 90], CHORES = [3, 5, 7];
// A pet's size as players see it: babies leave tiny prints, adults big ones.
export const SIZE_WORD = f => [L('tiny', 'malutkie'), L('middle-sized', 'średnie'), L('big', 'duże')][f] || '';

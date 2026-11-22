// XP, levels and rank titles. Shared by the server (awards XP) and the hub (draws badges).

// Reaching level L takes 50·L·(L-1) XP in total: 100 for level 2, 300 for 3, 600 for 4 … Each level costs 100 XP more
// than the one before, up to level FLAT. From there every level costs the same (100·FLAT XP), so leveling never ends
// and never slows to a crawl. Levels up to FLAT are exactly what they always were, so nobody's level can drop.
export const FLAT = 20;
const tri = L => 50 * L * (L - 1);
export const xpForLevel = L => L <= FLAT ? tri(L) : tri(FLAT) + (L - FLAT) * 100 * FLAT;
export function levelOf(xp) {
  xp = Math.max(0, Number(xp) || 0);
  if (xp >= tri(FLAT)) return FLAT + Math.floor((xp - tri(FLAT)) / (100 * FLAT));
  let L = 1;
  while (tri(L + 1) <= xp) L++;
  return L;
}

// The ladder is a climb through the sky, so it fits every game in the hub. `icon` is a key into rankicons.js (blocky
// SVG emblems). Levels 1, 3, 5, 8, 12, 17, 23 and 30 are where the first eight (hot pot) ranks began.
export const RANKS = [
  { lv: 1, name: 'Seedling', icon: 'seed' },
  { lv: 3, name: 'Fledgling', icon: 'chick' },
  { lv: 5, name: 'Kite Flyer', icon: 'kite' },
  { lv: 8, name: 'Cloud Hopper', icon: 'cloud' },
  { lv: 10, name: 'Wind Rider', icon: 'plane' },
  { lv: 12, name: 'Isle Explorer', icon: 'isle' },
  { lv: 15, name: 'Balloon Pilot', icon: 'balloon' },
  { lv: 17, name: 'Compass Keeper', icon: 'compass' },
  { lv: 20, name: 'Sky Captain', icon: 'ship' },
  { lv: 23, name: 'Storm Chaser', icon: 'bolt' },
  { lv: 26, name: 'Rainbow Rider', icon: 'rainbow' },
  { lv: 30, name: 'Moon Walker', icon: 'moon' },
  { lv: 35, name: 'Star Catcher', icon: 'star' },
  { lv: 40, name: 'Comet Tamer', icon: 'comet' },
  { lv: 45, name: 'Sun Keeper', icon: 'sun' },
  { lv: 50, name: 'Sky Legend', icon: 'crown' },
];
// After the last named rank the ladder goes on for ever: one more star every STAR_EVERY levels.
export const STAR_EVERY = 10;
const TOP = RANKS.at(-1);
export const starsOf = level => Math.max(0, Math.floor((level - TOP.lv) / STAR_EVERY));
// The rank at a level: { lv, name, icon, stars }. With stars the name reads "Sky Legend ★3".
export function rankOf(level) {
  const r = RANKS.filter(x => x.lv <= level).at(-1) || RANKS[0], stars = starsOf(level);
  return stars ? { ...r, lv: TOP.lv + stars * STAR_EVERY, name: `${r.name} ★${stars}`, stars } : { ...r, stars: 0 };
}
// The next rank or star above a level: there always is one.
export function nextRankOf(level) {
  const n = RANKS.find(x => x.lv > level);
  return n ? { ...n, stars: 0 } : rankOf(TOP.lv + (starsOf(level) + 1) * STAR_EVERY);
}

// Everything the hub needs to draw a badge and progress bar.
export function progress(xp = 0) {
  const level = levelOf(xp), lo = xpForLevel(level), hi = xpForLevel(level + 1);
  const r = rankOf(level), next = nextRankOf(level);
  return { xp, level, rank: r.name, icon: r.icon, stars: r.stars, into: xp - lo, need: hi - lo, nextRank: next.name, nextRankLv: next.lv };
}

// XP for one finished game: showing up, winning, and a little for points scored.
export const XP = { play: 15, win: 35, perPt: 0.1, maxPts: 20 };
// Coins for one finished game: the account currency that buys avatar items in the creator's shop.
// Paid by where you finished: 1st place gets COINS.top, last place COINS.last, and the places in between are spread
// evenly and rounded. 2 players: 10 / 1. 3: 10 / 6 / 1. 4: 10 / 7 / 4 / 1. 6: 10 / 8 / 6 / 5 / 3 / 1.
// Bots take up places but never get coins (they have no profile). Shared places (ties) pay the same.
export const COINS = { top: 10, last: 1 };
export const placeCoins = (place, n) => {
  if (!(n > 1)) return COINS.top;
  const p = Math.min(n, Math.max(1, Math.round(place) || n));
  return Math.round(COINS.last + (COINS.top - COINS.last) * (n - p) / (n - 1));
};
// Fills in a 1-based place for every seat of a game's results() that did not say one: the winner(s) first, then by
// points, higher first. Seats with the same win and points share a place. Every game goes through this, so a new
// game only has to return { pts, win } (or its own place) to get placement coins.
export function withPlaces(res) {
  const key = r => [r.win ? 1 : 0, Number(r.pts) || 0];
  const better = (a, b) => { const [wa, pa] = key(a), [wb, pb] = key(b); return wa > wb || (wa === wb && pa > pb); };
  return res.map(r => Number.isFinite(r.place) && r.place >= 1 ? r : { ...r, place: 1 + res.filter(o => better(o, r)).length });
}
// How many places a game's results() hands out: the seats, or more when the game says so (Marble Rush bets on marbles).
export const fieldOf = res => Math.max(res.length, ...res.map(r => (Number.isFinite(r.of) ? r.of : 0)));

export const xpFor = ({ win, pts }) => Math.round(XP.play + (win ? XP.win : 0) + Math.min(XP.maxPts, Math.max(0, pts) * XP.perPt));

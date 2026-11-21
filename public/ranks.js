// XP, levels and rank titles. Shared by the server (awards XP) and the hub (draws badges).

// Reaching level L takes 50·L·(L-1) XP in total: 100 for level 2, 300 for 3, 600 for 4 …
export const xpForLevel = L => 50 * L * (L - 1);
export function levelOf(xp) {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  return L;
}

export const RANKS = [
  { lv: 1, name: 'Sprout', icon: '🌱' },
  { lv: 3, name: 'Nibbler', icon: '🥢' },
  { lv: 5, name: 'Snack Scout', icon: '🥟' },
  { lv: 8, name: 'Table Regular', icon: '🍜' },
  { lv: 12, name: 'Spice Chaser', icon: '🌶️' },
  { lv: 17, name: 'Pot Master', icon: '🍲' },
  { lv: 23, name: 'Grand Feaster', icon: '👑' },
  { lv: 30, name: 'Legend of the Table', icon: '🏆' },
];
export const rankOf = level => RANKS.filter(r => r.lv <= level).at(-1);

// Everything the hub needs to draw a badge and progress bar.
export function progress(xp = 0) {
  const level = levelOf(xp), lo = xpForLevel(level), hi = xpForLevel(level + 1);
  const r = rankOf(level), next = RANKS.find(x => x.lv > level);
  return { xp, level, rank: r.name, icon: r.icon, into: xp - lo, need: hi - lo, nextRank: next?.name || null, nextRankLv: next?.lv || null };
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

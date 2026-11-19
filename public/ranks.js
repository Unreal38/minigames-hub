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
export const xpFor = ({ win, pts }) => Math.round(XP.play + (win ? XP.win : 0) + Math.min(XP.maxPts, Math.max(0, pts) * XP.perPt));

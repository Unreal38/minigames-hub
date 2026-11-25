// What a match with bots in it pays, as a share of the usual XP and placement coins (Kuba's rule, 2026-11-25:
// "XP for playing with bots should depend on the difficulty; farming low-level bots should give very little").
// A match with only people pays in full, as before. With bots, three things count:
//   - how strong each opponent is: a person counts 1, a bot by the table's bot level (BOT_WEIGHT below);
//   - how many opponents there are, against a full table (up to 3 opponents; fewer seats pay a bit less);
//   - how long the match took: a bot match pays in full only once it has run FULL_MS, a quicker one pays its share,
//     so quick games against bots (a small Mahjong Race board, one Tic-Tac-Toe) can't be repeated for full pay.
// Bot seats are the ones the game filled (human: false). A person who left and was swapped for a bot still counts as
// a person, like in the rankings rule.

// Weight of one bot by the table's bot level. Games whose bots have no level (pure luck: Ladders, Wojna, Marble
// Rush, Ludo, Piotruś) use NO_LEVEL.
export const BOT_WEIGHT = { chill: 0.15, easy: 0.15, club: 0.5, sharp: 1 };
export const NO_LEVEL = 0.5;
export const FULL_OPPS = 3;       // this many opponents (or the table's most, if smaller) is a full table
export const FULL_MS = 3 * 60_000; // a bot match shorter than this pays its share of the time

// seats: the game's seats; i: the seat being paid; level: the table's bot level (opts.bots) or undefined;
// max: the game's most players; ms: how long the match ran. Returns a share from 0 to 1.
export function botPay(seats, i, { level, max = seats.length, ms = Infinity } = {}) {
  const isBot = s => s && !s.human;
  if (!seats.some(isBot)) return 1;
  const w = level == null ? NO_LEVEL : BOT_WEIGHT[level] ?? NO_LEVEL;
  const opps = seats.filter((s, k) => k !== i).map(s => (isBot(s) ? w : 1));
  if (!opps.length) return 1;
  const strength = opps.reduce((a, b) => a + b, 0) / opps.length;
  const full = Math.max(1, Math.min(FULL_OPPS, max - 1));
  const count = 0.5 + 0.5 * Math.min(1, opps.length / full);
  const time = Math.min(1, Math.max(0, ms) / FULL_MS);
  return Math.max(0, Math.min(1, strength * count * time));
}

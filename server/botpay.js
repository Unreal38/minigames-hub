// What a match with bots in it pays, as a share of the usual XP and placement coins (Kuba's rule, 2026-11-25:
// "XP for playing with bots should depend on the difficulty; farming low-level bots should give very little").
// A match with only people pays in full once it has run a minute (PEOPLE_FULL_MS). With bots, three things count:
//   - how strong each opponent is: a person counts 1, a bot by the table's bot level (BOT_WEIGHT below);
//   - how many opponents there are, against a full table (up to 3 opponents; fewer seats pay a bit less);
//   - how long the match took: a bot match pays in full only once it has run FULL_MS, a quicker one pays its share,
//     so quick games against bots (a small Mahjong Race board, one Tic-Tac-Toe) can't be repeated for full pay.
// Bot seats are the ones the game filled (human: false). A person who left and was swapped for a bot still counts as
// a person, like in the rankings rule.

// Weight of one bot by the table's bot level. Games whose bots have no level (pure luck: Ladders, Wojna, Marble
// Rush, Ludo, Piotruś) use NO_LEVEL.
export const BOT_WEIGHT = { chill: 0.15, easy: 0.15, club: 0.5, normal: 0.5, sharp: 1, hard: 1 }; // a new bot level must be added here (test/botpay.js checks)
export const NO_LEVEL = 0.5;
export const FULL_OPPS = 3;       // this many opponents (or the table's most, if smaller) is a full table
export const SOLO = 0.5;         // the most a run alone at a table pays (no opponents: you always come first)
export const PEOPLE_FULL_MS = 60_000; // a match with only people pays in full from this long; a quicker one pays its share
export const FULL_MS = 3 * 60_000; // a bot match shorter than this pays its share of the time

// seats: the game's seats; i: the seat being paid; level: the table's bot level (opts.bots) or undefined;
// max: the game's most players; ms: how long the match ran. Returns a share from 0 to 1.
export function botPay(seats, i, { level, max = seats.length, ms = Infinity } = {}) {
  const isBot = s => s && !s.human;
  const time = Math.min(1, Math.max(0, ms) / FULL_MS);
  // Alone at a table (Beanstalk Bounce, Burrow Bop, Kitchen Rush with one seat): first of one is always a win, so it
  // pays SOLO at most, and only for a run of FULL_MS. It used to pay a full win, and a 4-second Beanstalk run could
  // be repeated for 10 coins and 50 XP each time.
  if (seats.length <= 1) return Math.max(0, Math.min(1, SOLO * time));
  // People only: full pay once the match has run PEOPLE_FULL_MS (Kuba, 2026-11-25), so throwing quick matches to a
  // second account or a guest window pays only its share of the time.
  if (!seats.some(isBot)) return Math.min(1, Math.max(0, ms) / PEOPLE_FULL_MS);
  const w = level == null ? NO_LEVEL : BOT_WEIGHT[level] ?? NO_LEVEL;
  const opps = seats.filter((s, k) => k !== i).map(s => (isBot(s) ? w : 1));
  const strength = opps.reduce((a, b) => a + b, 0) / opps.length;
  const full = Math.max(1, Math.min(FULL_OPPS, max - 1));
  const count = 0.5 + 0.5 * Math.min(1, opps.length / full);
  return Math.max(0, Math.min(1, strength * count * time));
}

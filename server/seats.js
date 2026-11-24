// How many seats a table has: the people sitting down plus the bots that fill the rest. The host picks it in
// the table settings, so friends can play exactly as many as they are and no bot takes a seat (a match with a
// bot in it does not count for rankings). Every game says in its meta how that number is picked:
//   seats: { lo, def }          any count from lo up to meta.maxPlayers
//   seats: { only: [...], def } only these counts, because the rules need them (Tysiąc, Sky Pool teams)
//   seats: { fixed: n }         always n (chess, Tic-Tac-Toe, Cove Clash)
//   key: 'field'                the option is not called seats (Texas Hold'em)
//   no seats + minHumans        no bots at all: the table is whoever sits down, up to meta.maxPlayers
// The waiting room, the open tables list and the game itself all read the size from tableSize, so they agree.

export const seatKey = meta => meta.seats?.key || 'seats';

// The counts a host can pick, smallest first ([] for a game without bots).
export function seatChoices(meta) {
  const s = meta.seats;
  if (!s) return [];
  if (s.fixed) return [s.fixed];
  if (s.only) return [...s.only];
  const out = [];
  for (let n = s.lo || 2; n <= meta.maxPlayers; n++) out.push(n);
  return out;
}

// A seats setting the host sent, or the game's default when it is not one of the choices.
export function cleanSeats(meta, v) {
  const s = meta.seats, ch = seatChoices(meta);
  if (!ch.length) return undefined;
  return ch.includes(+v) ? +v : s.fixed || s.def || ch[0];
}

// Seats at the table: the host's pick, or more when more people sit down (the next choice that fits them all).
export function tableSize(meta, opts = {}, seated = 0) {
  const ch = seatChoices(meta);
  if (!ch.length) return meta.maxPlayers;
  const want = Math.max(cleanSeats(meta, opts[seatKey(meta)]), seated);
  return ch.find(n => n >= want) || ch[ch.length - 1];
}

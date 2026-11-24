// The site's one calendar. Every daily thing (Mystery Pet, Word in a Bottle, the Lucky Wheel, the coin caps of
// Hay Hunch, Pet Pop and Pet Mahjong, Pet Farm's daily battles, helps, gifts and playdates, the shop's seasons)
// turns over at midnight in Warsaw, whatever time zone the server itself runs in.
// Days are written as 'YYYY-MM-DD' strings, the same shape the older UTC and server-clock keys had, so a stored
// day from before this file existed still compares correctly.

export const TZ = 'Europe/Warsaw';
const DAY = 86400_000;

// Tests pin the clock with DAILY_NOW (an ISO time) and move it forward with skip().
let shift = 0;
export const now = () => (process.env.DAILY_NOW ? Date.parse(process.env.DAILY_NOW) : Date.now()) + shift;
export const skip = days => { shift += days * DAY; };

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const parts = ms => Object.fromEntries(fmt.formatToParts(new Date(ms)).map(p => [p.type, p.value]));

// Today's day key in Warsaw.
export const dayOf = (ms = now()) => { const p = parts(ms); return `${p.year}-${p.month}-${p.day}`; };

// Calendar sums on day keys. They work on the date alone, so a 23 or 25 hour day changes nothing.
export const addDays = (day, n) => new Date(Date.parse(day + 'T00:00Z') + n * DAY).toISOString().slice(0, 10);
export const dayBefore = day => addDays(day, -1);
export const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00Z') - Date.parse(a + 'T00:00Z')) / DAY);

// How far Warsaw's wall clock is ahead of UTC at this moment (one or two hours).
const offset = ms => { const p = parts(ms); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; };

// The moment a day starts in Warsaw. Clocks change at 2 or 3 at night, so midnight always exists exactly once.
export const startOf = day => { const guess = Date.parse(day + 'T00:00Z'); let t = guess - offset(guess); t = guess - offset(t); return t; };

// Milliseconds until the next midnight in Warsaw. Right on the days the clocks change (23 or 25 hours long).
export const untilNext = (ms = now()) => Math.max(1000, startOf(addDays(dayOf(ms), 1)) - ms);

// A date for the shop's seasonal calendar (month and day of Warsaw's today, at noon so no time zone can move it).
export const dateOf = day => new Date(day + 'T12:00');

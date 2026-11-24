// Every daily thing turns over at midnight in Warsaw (server/day.js), also on the days the clocks change.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { dayOf, untilNext, startOf, addDays, dayBefore, daysBetween, dateOf } from '../server/day.js';

const H = 3600_000, at = iso => Date.parse(iso);

// Winter: Warsaw is UTC+1, so the day turns at 23:00 UTC.
assert.equal(dayOf(at('2026-11-24T22:59:59Z')), '2026-11-24');
assert.equal(dayOf(at('2026-11-24T23:00:00Z')), '2026-11-25');
assert.equal(untilNext(at('2026-11-24T22:00:00Z')), H);
assert.equal(untilNext(at('2026-11-24T23:00:00Z')), 24 * H);
// Summer: UTC+2, the day turns at 22:00 UTC.
assert.equal(dayOf(at('2027-07-01T21:59:59Z')), '2027-07-01');
assert.equal(dayOf(at('2027-07-01T22:00:00Z')), '2027-07-02');
assert.equal(startOf('2027-07-02'), at('2027-07-01T22:00:00Z'));
assert.equal(startOf('2026-11-25'), at('2026-11-24T23:00:00Z'));
// Spring forward (28 March 2027): that day is 23 hours long.
assert.equal(startOf('2027-03-29') - startOf('2027-03-28'), 23 * H);
assert.equal(untilNext(startOf('2027-03-28')), 23 * H);
assert.equal(untilNext(at('2027-03-28T12:00:00Z')), startOf('2027-03-29') - at('2027-03-28T12:00:00Z'));
assert.equal(dayOf(startOf('2027-03-29') - 1000), '2027-03-28');
assert.equal(dayOf(startOf('2027-03-29')), '2027-03-29');
// Fall back (25 October 2026): 25 hours, and the repeated hour is still the same day.
assert.equal(startOf('2026-10-26') - startOf('2026-10-25'), 25 * H);
assert.equal(untilNext(startOf('2026-10-25')), 25 * H);
assert.equal(dayOf(at('2026-10-25T00:30:00Z')), '2026-10-25');
assert.equal(dayOf(at('2026-10-25T01:30:00Z')), '2026-10-25');
// The countdown always lands exactly on the next day, every hour of a whole year.
for (let t = at('2026-01-01T00:17:00Z'); t < at('2027-01-01T00:00:00Z'); t += H) {
  const n = t + untilNext(t);
  assert.equal(dayOf(n), addDays(dayOf(t), 1), new Date(t).toISOString());
  assert.equal(dayOf(n - 1000), dayOf(t), new Date(t).toISOString());
}
// Calendar sums.
assert.equal(dayBefore('2027-03-01'), '2027-02-28');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
assert.equal(daysBetween('2026-11-22', '2026-11-24'), 2);
assert.equal(daysBetween('2027-03-27', '2027-03-29'), 2);
assert.equal(dateOf('2026-12-24').getDate(), 24);

// No server file may keep its own idea of "today": UTC dates, the server's own clock or 24 hours since last use.
const dir = new URL('../server/', import.meta.url).pathname, bad = [];
const RULES = [/toISOString\(\)\.slice\(0, ?10\)/, /\.get(UTC)?(Date|Month|FullYear)\(\)/, /toDateString/];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'day.js'))
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => { if (RULES.some(r => r.test(l))) bad.push(`server/${f}:${i + 1}: ${l.trim().slice(0, 120)}`); });
assert.deepEqual(bad, [], 'days must come from server/day.js:\n' + bad.join('\n'));
for (const f of ['hay.js', 'pop.js', 'mj.js', 'farm.js', 'wheel.js', 'word.js', 'daily.js'])
  assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /from '\.\/day\.js'/, `server/${f} should take its day from server/day.js`);

console.log('day: all daily resets use midnight in Warsaw, DST days included');

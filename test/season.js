// The hub's season card: seasonNow() agrees with seasonOn() every day of the year, and the gaps between drops point at the next one.
import assert from 'node:assert/strict';
import { seasonNow, seasonOn, SEASONS } from '../public/avatar.js';

const d = s => new Date(s + 'T12:00'), ymd = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
for (let t = d('2026-01-01'); t < d('2029-01-01'); t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 12)) {
  const s = seasonNow(t), on = Object.keys(SEASONS).filter(k => seasonOn(k, t));
  assert.ok(on.length <= 1, `two drops at once on ${ymd(t)}`);
  assert.equal(s.key, on[0] || null, ymd(t));
  assert.ok(s.start <= t && t <= s.end, `${ymd(t)} sits inside its own span`);
  if (!s.key) { assert.ok(s.next.start > t); assert.equal(s.next.start - s.end, 864e5, 'a gap ends the day before the next drop'); }
}
const w = seasonNow(d('2026-11-24'));
assert.equal(w.key, 'winter'); assert.equal(ymd(w.start), '2026-11-15'); assert.equal(ymd(w.end), '2027-02-28');
assert.equal(ymd(seasonNow(d('2027-01-10')).start), '2026-11-15');
const g = seasonNow(d('2026-11-10'));
assert.equal(g.key, null); assert.equal(g.next.key, 'winter'); assert.equal(ymd(g.start), '2026-11-08'); assert.equal(ymd(g.end), '2026-11-14');
assert.equal(seasonNow(d('2026-09-15')).next.key, 'halloween');
console.log('season: ok');

// Small in-memory rate limits, so one person (or one script) can't hammer logins, password resets or connections.
// Each key keeps the times of its recent events; anything older than its window is forgotten.
const keys = new Map(); // key -> { ms, t: [times] }

const recent = (key, ms) => {
  const now = Date.now(); let k = keys.get(key);
  if (!k) keys.set(key, k = { ms, t: [] });
  while (k.t.length && now - k.t[0] > k.ms) k.t.shift();
  return k;
};
// true when `key` already had `max` events within the last `ms`.
export const blocked = (key, max, ms) => recent(key, ms).t.length >= max;
// Records one event for `key`.
export const note = (key, ms) => { recent(key, ms).t.push(Date.now()); };
// Checks and records in one go: true when the event is allowed.
export const allow = (key, max, ms) => { if (blocked(key, max, ms)) return false; note(key, ms); return true; };
export const clear = key => { keys.delete(key); };

setInterval(() => {
  const now = Date.now();
  for (const [key, k] of keys) if (!k.t.length || now - k.t.at(-1) > k.ms) keys.delete(key);
}, 60_000).unref();

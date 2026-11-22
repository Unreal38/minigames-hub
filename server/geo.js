// Which language a first visit gets: Polish for visitors from Poland, English for everyone else.
//
// Where an address is from comes from RIPE NCC's public list of the address blocks it hands out, with the country of
// each holder (https://ftp.ripe.net/pub/stats/ripencc/). Only the Polish blocks are kept. The list is downloaded once
// a week and saved in DATA_DIR, so a restart doesn't need the network. Nothing about visitors is ever sent anywhere.
// If the list can't be had, or for an address it doesn't know, the browser's own language decides (Accept-Language).
//
// A visitor's own pick always wins over this guess: it is only the starting language.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import net from 'node:net';
import { DATA_DIR } from './store.js';

const URL = 'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest';
const FILE = path.join(DATA_DIR, 'geo-pl.json');
const WEEK = 7 * 24 * 3600_000;
let v4 = [], v6 = []; // sorted [start, end] pairs: numbers for IPv4, BigInts for IPv6

const ip4 = s => s.split('.').reduce((n, p) => n * 256 + (+p), 0);
function ip6(s) {
  if (s.includes('.')) { const i = s.lastIndexOf(':'), v = ip4(s.slice(i + 1)); s = s.slice(0, i + 1) + (v >>> 16).toString(16) + ':' + (v & 0xffff).toString(16); }
  const [a, b = ''] = s.split('::'), A = a ? a.split(':') : [], B = b ? b.split(':') : [];
  const parts = s.includes('::') ? [...A, ...Array(8 - A.length - B.length).fill('0'), ...B] : A;
  return parts.reduce((n, p) => (n << 16n) + BigInt(parseInt(p || '0', 16)), 0n);
}
// Lines look like ripencc|PL|ipv4|5.8.0.0|8192|20111108|allocated (a count of addresses) or
// ripencc|PL|ipv6|2001:678::|29|20090508|assigned (a prefix length).
export function parse(text, cc = 'PL') {
  const a = [], b = [];
  for (const line of text.split('\n')) {
    const f = line.split('|');
    if (f[1] !== cc || !['allocated', 'assigned'].includes(f[6]?.trim())) continue;
    try {
      if (f[2] === 'ipv4') { const s = ip4(f[3]); a.push([s, s + Number(f[4]) - 1]); }
      else if (f[2] === 'ipv6') { const s = ip6(f[3]), len = BigInt(128 - Number(f[4])); b.push([s, s + (1n << len) - 1n]); }
    } catch {}
  }
  a.sort((x, y) => x[0] - y[0]); b.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return { v4: a, v6: b };
}
function within(list, n) {
  let lo = 0, hi = list.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (n < list[m][0]) hi = m - 1; else if (n > list[m][1]) lo = m + 1; else return true; }
  return false;
}
/** true / false when the address is known to be in Poland or not, null when the list isn't loaded yet. */
export function inPoland(ip) {
  if (!v4.length) return null;
  ip = String(ip || '').replace(/^::ffff:(?=\d+\.)/, '');
  try {
    if (net.isIPv4(ip)) return within(v4, ip4(ip));
    if (net.isIPv6(ip)) return within(v6, ip6(ip));
  } catch {}
  return false;
}
export function use(lists) { v4 = lists.v4; v6 = lists.v6; }

/** 'pl' or 'en' for a page request: the address first, then the browser's language. */
export function langFor(ip, acceptLanguage = '') {
  if (inPoland(ip)) return 'pl';
  const first = String(acceptLanguage).split(',')[0].trim().toLowerCase();
  return /^pl\b/.test(first) ? 'pl' : 'en';
}

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    use({ v4: d.v4, v6: d.v6.map(([s, e]) => [BigInt('0x' + s), BigInt('0x' + e)]) });
    return d.at || 0;
  } catch { return 0; }
}
function fetchList() {
  return new Promise((ok, bad) => {
    https.get(URL, { timeout: 60_000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return bad(new Error('status ' + res.statusCode)); }
      let keep = '', rest = '';
      res.setEncoding('utf8');
      res.on('data', d => { const lines = (rest + d).split('\n'); rest = lines.pop(); for (const l of lines) if (l.includes('|PL|ipv')) keep += l + '\n'; });
      res.on('end', () => ok(keep + rest));
      res.on('error', bad);
    }).on('error', bad).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}
async function refresh() {
  try {
    const lists = parse(await fetchList());
    if (lists.v4.length < 100) throw new Error('the list looks too short');
    use(lists);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify({ at: Date.now(), v4: lists.v4, v6: lists.v6.map(([s, e]) => [s.toString(16), e.toString(16)]) }));
    fs.renameSync(FILE + '.tmp', FILE);
    console.log(`geo: ${lists.v4.length} Polish IPv4 and ${lists.v6.length} IPv6 blocks`);
    return true;
  } catch (e) { console.warn('geo: could not update the list of Polish addresses:', e.message); return false; }
}
/** Load the saved list and keep it fresh. Not run in tests (GEO=off), which have no network. */
export function start() {
  if (process.env.GEO === 'off') return;
  const at = load();
  const due = Math.max(5_000, at + WEEK - Date.now());
  setTimeout(function again() { refresh().then(ok => setTimeout(again, ok ? WEEK : 3600_000).unref()); }, due).unref(); // an hour after a failure
}

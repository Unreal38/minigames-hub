// Word Reef dictionaries. The full lists (server/words/reef-pl.br, reef-en.br: see build-reef.js) are unpacked
// once into one byte buffer per language with an offset table, so 3 million Polish word forms take about 50 MB
// and a lookup is a binary search with no strings made. The bots' everyday words (reef-*-bot.txt, most common
// first) become letter trees for move finding.
import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = join(dirname(fileURLToPath(import.meta.url)), 'words');
const PL = 'ąćęłńóśźż';
export const enc = w => w.replace(/[ąćęłńóśźż]/g, c => String(PL.indexOf(c) + 1));
export const dec = w => w.replace(/[1-9]/g, d => PL[d - 1]);
const lang = l => (l === 'en' ? 'en' : 'pl');

const lists = {};
function load(l) {
  if (lists[l]) return lists[l];
  const raw = brotliDecompressSync(readFileSync(join(here, `reef-${l}.br`)));
  let n = 0, size = 0; // first pass: how many words, and how long the list is written out in full
  for (let i = 0, line = true; i < raw.length; i++) { if (line) { size += raw[i] - 65; line = false; } else if (raw[i] === 10) { n++; size++; line = true; } else size++; }
  const buf = Buffer.allocUnsafe(size), off = new Uint32Array(n + 1);
  let w = 0, k = 0, prev = 0; // prev: where the last word starts in buf
  for (let i = 0; i < raw.length;) {
    const share = raw[i++] - 65, start = w;
    for (let j = 0; j < share; j++) buf[w++] = buf[prev + j];
    while (raw[i] !== 10) buf[w++] = raw[i++];
    i++; off[k++] = start; prev = start; buf[w++] = 10;
  }
  off[k] = w;
  return (lists[l] = { buf, off, n });
}
// warm both lists up a little after the server starts, so the first table does not wait
export function preload() { load('pl'); load('en'); }

export function has(l, word) {
  if (typeof word !== 'string' || word.length < 2 || word.length > 15) return false;
  const { buf, off, n } = load(lang(l)), q = Buffer.from(enc(word.toLowerCase()), 'latin1');
  let lo = 0, hi = n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, a = off[mid], len = off[mid + 1] - 1 - a;
    let c = 0;
    for (let j = 0; j < len && j < q.length && !c; j++) c = buf[a + j] - q[j];
    if (!c) c = len - q.length;
    if (!c) return true;
    if (c < 0) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}
export const size = l => load(lang(l)).n;
export const _at = (l, i) => { const { buf, off } = load(lang(l)); return buf.toString("latin1", off[i], off[i + 1] - 1); };

// ---------- the bots' words ----------
const everyday = {};
function words(l) {
  return (everyday[l] ||= readFileSync(join(here, `reef-${l}-bot.txt`), 'utf8').split('\n').filter(Boolean).map(dec));
}
// how many everyday words each bot strength knows; hard also knows every short word in the full list
export const KNOWS = { easy: 5000, normal: 16000, hard: 40000 };
const trees = {};
const RUDE = /huj|chuj|jeb|cip|fag|tit|ass|cum|fuk/; // short rude words hard bots leave alone (people may still play them)
// A letter tree: every node is { c: { letter: node }, end: true when a word stops here }.
export function tree(l, level) {
  l = lang(l); level = KNOWS[level] ? level : 'normal';
  const key = l + level; if (trees[key]) return trees[key];
  const root = { c: {} }, add = w => { let n = root; for (const ch of w) n = n.c[ch] ||= { c: {} }; n.end = true; };
  for (const w of words(l).slice(0, KNOWS[level])) add(w);
  if (level === 'hard') { const { buf, off, n } = load(l); for (let i = 0; i < n; i++) { const len = off[i + 1] - 1 - off[i]; if (len <= 3) { const w = dec(buf.toString('latin1', off[i], off[i] + len)); if (!RUDE.test(w)) add(w); } } }
  return (trees[key] = root);
}
// is this word one this bot strength would know?
export function knows(l, level, w) { let n = tree(l, level); for (const ch of w) { n = n.c[ch]; if (!n) return false; } return !!n.end; }

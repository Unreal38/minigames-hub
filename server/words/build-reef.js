// Builds the Word Reef dictionaries from the downloaded source lists (run by hand, not by the server):
//   node server/words/build-reef.js <slowa.txt> <enable1.txt> <pl_50k.txt> <en_50k.txt>
// slowa.txt is the SJP.PL game dictionary (https://sjp.pl/sl/growy/), enable1.txt the ENABLE list, the two 50k
// files come from FrequencyWords. Writes reef-pl.br / reef-en.br (every allowed word, 2 to 15 letters, sorted,
// Polish letters written as the digits 1-9 so the list stays one byte a letter; each line starts with one letter
// saying how many letters it shares with the line before, A = none, then brotli) and reef-pl-bot.txt /
// reef-en-bot.txt (the everyday words the bots know, most common first). Also prints how often each letter is used,
// which is where the tile values and counts in public/games/reef/rules.js came from.
import { readFileSync, writeFileSync } from 'node:fs';
import { brotliCompressSync, constants as Z } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [plSrc, enSrc, plFreq, enFreq] = process.argv.slice(2);
const PL = 'ąćęłńóśźż', AZ = { pl: 'aąbcćdeęfghijklłmnńoóprsśtuwyzźż', en: 'abcdefghijklmnopqrstuvwxyz' };
const enc = w => w.replace(/[ąćęłńóśźż]/g, c => String(PL.indexOf(c) + 1));
// rude words stay playable for people but bots never play them
const RUDE = /kurw|chuj|huj|pierd|jeb|pizd|kutas|cwel|dziwk|fuck|shit|cunt|bitch|cock|puss|whore|slut|fag|nigg|bastard|twat|wank|dick/;
const lines = f => readFileSync(f, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

for (const [lang, src, freq] of [['pl', plSrc, plFreq], ['en', enSrc, enFreq]]) {
  const ok = new RegExp(`^[${AZ[lang]}]{2,15}$`);
  const all = [...new Set(lines(src).map(w => w.toLowerCase()).filter(w => ok.test(w)))];
  const coded = all.map(enc).sort();
  let prev = '';
  const front = coded.map(w => { let k = 0; while (k < prev.length && k < w.length && prev[k] === w[k]) k++; prev = w; return String.fromCharCode(65 + k) + w.slice(k); });
  writeFileSync(join(here, `reef-${lang}.br`), brotliCompressSync(Buffer.from(front.join('\n') + '\n'), { params: { [Z.BROTLI_PARAM_QUALITY]: 11, [Z.BROTLI_PARAM_LGWIN]: 24 } }));
  const set = new Set(all), bot = [], cnt = {};
  for (const l of lines(freq)) {
    const [w] = l.split(' '); if (!set.has(w) || w.length > 12 || bot.length >= 40000 || RUDE.test(w)) continue;
    for (const c of w) cnt[c] = (cnt[c] || 0) + 1; // each everyday word once: letters as they turn up in words, not in text
    bot.push(enc(w));
  }
  writeFileSync(join(here, `reef-${lang}-bot.txt`), bot.join('\n') + '\n');
  const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
  console.log(lang, all.length, 'words,', bot.length, 'bot words');
  console.log([...AZ[lang]].map(c => `${c} ${(100 * (cnt[c] || 0) / tot).toFixed(2)}`).join('  '));
}

// Państwa-miasta (Countries & Cities): the rules both the server and the page use.
// A letter is drawn, everyone writes one word per category starting with it, then the table checks the answers.
import { L } from '../../i18n.js';

// Every category the game knows. `pet` is checked by the game itself against the Pet Farm species list.
export const CATS = {
  country: () => L('Country', 'Państwo'), city: () => L('City', 'Miasto'), animal: () => L('Animal', 'Zwierzę'), plant: () => L('Plant', 'Roślina'),
  name: () => L('Name', 'Imię'), thing: () => L('Thing', 'Rzecz'), job: () => L('Job', 'Zawód'), food: () => L('Food', 'Jedzenie'), pet: () => L('Pet Farm pet', 'Zwierzak z Farmy'),
};
export const catName = k => CATS[k]?.() || k;
export const SETS = { short: ['country', 'city', 'animal', 'name'], classic: ['country', 'city', 'animal', 'plant', 'name', 'thing'], long: ['country', 'city', 'animal', 'plant', 'name', 'thing', 'job', 'food'] };
// Letters that can be drawn. Q, V, X and Y are left out (hardly any Polish words start with them); Ł, Ś and Ż are a table setting.
export const LETTERS = { easy: [...'ABCDEFGHIJKLMNOPRSTUWZ'], pl: [...'ABCDEFGHIJKLŁMNOPRSŚTUWZŻ'] };
export const PTS = { solo: 15, uniq: 10, dup: 5 };   // the only valid answer in the category / nobody else wrote it / somebody else did too
export const MAXLEN = 28;                            // characters per answer
export const TIMES = [60, 90, 120], ROUNDS = [3, 5, 8];

// What a player typed, tidied: no control or invisible characters, single spaces, at most MAXLEN characters.
export function clean(s) {
  const t = String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/[\u00ad\u061c\u115f\u1160\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\ufffb]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(t).slice(0, MAXLEN).join('').trim();
}
// Two answers are the same word when their folds match: capitals, accents (Kraków = Krakow), spaces, hyphens and dots don't count.
export const fold = s => clean(s).toLowerCase().replace(/ł/g, 'l').replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
// The first letter must be the drawn one exactly as Polish spells it: Ż, Ź, Ś, Ć, Ł, Ó, Ą, Ę and Ń are letters of their own
// (Żaba is not a word for Z). Other accents are ignored (Évry counts for E).
const OWN = 'ĄĆĘŁŃÓŚŹŻ';
export function firstLetter(s) {
  const ch = Array.from(clean(s)).find(c => /\p{L}/u.test(c)); if (!ch) return '';
  const up = ch.toLocaleUpperCase('pl');
  return OWN.includes(up) ? up : up.normalize('NFD').replace(/\p{M}/gu, '').slice(0, 1);
}
export const starts = (s, letter) => firstLetter(s) === letter;

// Marks every answer of a round.
//   ans[seat][cat]: tidied answers; open[cat]: false when the category is closed this round (no pet starts with the letter);
//   votes[cat][fold] = seats that reject that word; here[seat]: true for people at the table (only they can vote);
//   petOk(word): is it a real Pet Farm pet.
// Returns marks[seat][cat] = { st, pts, k, no, need }: st is 'closed', 'empty', 'letter' (wrong first letter), 'nopet', 'out' (voted out),
// 'solo', 'uniq' or 'dup'; k is the word's fold; no / need: thumbs down so far and how many throw it out.
export function mark({ cats, letter, ans, open, votes, here, petOk }) {
  const n = ans.length, marks = ans.map(() => []);
  cats.forEach((cat, c) => {
    const keys = ans.map(a => fold(a[c] || ''));
    const pre = ans.map((a, s) => !open[c] ? 'closed' : !keys[s] ? 'empty' : !starts(a[c], letter) ? 'letter' : cat === 'pet' && !petOk(a[c]) ? 'nopet' : '');
    const tally = ans.map(() => [0, 0]); // thumbs down on the word, and how many it takes
    const st = pre.map((p, s) => {
      if (p) return p;
      if (cat === 'pet') return ''; // checked against the species list: nothing to vote on
      const can = here.map((h, v) => h && !(pre[v] === '' && keys[v] === keys[s])), nCan = can.filter(Boolean).length;
      const no = (votes[c]?.[keys[s]] || []).filter(v => can[v]).length;
      tally[s] = [no, nCan ? needed(nCan) : 0];
      return nCan && no >= needed(nCan) ? 'out' : '';
    });
    const good = st.map(x => x === ''), nGood = good.filter(Boolean).length;
    for (let s = 0; s < n; s++) {
      let r = st[s];
      if (!r) r = nGood === 1 ? 'solo' : keys.some((k, v) => v !== s && good[v] && k === keys[s]) ? 'dup' : 'uniq';
      marks[s][c] = { st: r, pts: PTS[r] || 0, k: keys[s], no: tally[s][0], need: tally[s][1] };
    }
  });
  return marks;
}
// How many of the players who may vote on a word have to reject it: more than half of them
// (one of one, two of two or three, three of four or five...), so a single player can't throw words out at a bigger table.
export const needed = nCan => Math.floor(nCan / 2) + 1;

// Bot matches pay a share of XP and coins by bot level, bot count and match length (server/botpay.js).
import { botPay, FULL_MS } from '../server/botpay.js';
import { credit } from '../server/store.js';
const fail = m => { console.error('FAIL', m); process.exit(1); };
const H = { human: true }, B = { human: false, bot: true }, AWAY = { human: true, bot: true };
const long = FULL_MS * 2;
const near = (a, b, m) => { if (Math.abs(a - b) > 1e-9) fail(`${m}: ${a} vs ${b}`); };

near(botPay([H, H, H, H], 0, { level: 'chill', max: 4, ms: 1000 }), 1, 'people only always pay in full');
near(botPay([H, AWAY], 0, { level: 'chill', max: 2, ms: 1000 }), 1, 'a person swapped for a bot still counts as a person');
near(botPay([H, B, B, B], 0, { level: 'sharp', max: 4, ms: long }), 1, 'three sharp bots, long match: full pay');
const chill3 = botPay([H, B, B, B], 0, { level: 'chill', max: 4, ms: long });
const chill1 = botPay([H, B], 0, { level: 'chill', max: 4, ms: long });
const sharp1 = botPay([H, B], 0, { level: 'sharp', max: 4, ms: long });
if (!(chill3 <= 0.2)) fail('chill bots must pay very little, got ' + chill3);
if (!(chill1 < chill3 && chill3 < sharp1)) fail(`more and harder bots pay more: ${chill1} ${chill3} ${sharp1}`);
near(botPay([H, B], 0, { level: 'sharp', max: 2, ms: long }), 1, 'a two-seat game against its hardest bot pays in full');
const easy = botPay([H, B], 0, { level: 'easy', max: 2, ms: long }), club = botPay([H, B], 0, { level: 'club', max: 2, ms: long });
if (!(easy < club && club < 1)) fail(`chess levels in order: ${easy} ${club}`);
near(botPay([H, B, B, B], 0, { level: 'sharp', max: 4, ms: FULL_MS / 4 }), 0.25, 'a quick match pays its share of the time');
if (!(botPay([H, B], 0, { level: undefined, max: 2, ms: long }) === 0.5)) fail('games without a bot level use NO_LEVEL');

// credit scales XP (coins go through the same share; the server test checks real balances)
const p = { pid: 'x', xp: 0, games: 0, wins: 0, pts: 0, byGame: {}, coins: 0 };
const g = credit(p, 'mahj', { pts: 18, win: true, place: 1, of: 2, ranked: false, pay: 0.1 });
if (g.xp !== 5 || g.pay !== 10) fail('credit should pay a tenth: ' + JSON.stringify(g));
const full = credit({ pid: 'y', xp: 0, games: 0, wins: 0, pts: 0, byGame: {}, coins: 0 }, 'mahj', { pts: 18, win: true, place: 1, of: 2 });
if (full.xp !== 52 || full.pay !== 100) fail('people-only match pays as before: ' + JSON.stringify(full));
console.log('OK');
process.exit(0);

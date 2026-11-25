// Sky Runway rules shared by the server and the page: the themes, which avatar parts may be changed for the show,
// the poses and how a look's stars turn into points.
import { L } from '../../i18n.js';

// Theme of each round, with an optional twist the judges can look out for (the twist is only a hint, nobody checks it).
export const THEMES = [
  ['pirate', 'Pirate beach party', 'Piracka impreza na plaży'], ['royal', 'Royal ball', 'Bal królewski'], ['rock', 'Rock concert', 'Koncert rockowy'],
  ['sport', 'Sports day', 'Dzień sportu'], ['disco', 'Disco night', 'Noc disco'], ['winter', 'Winter holidays', 'Zimowe wakacje'],
  ['spooky', 'Spooky night', 'Straszna noc'], ['garden', 'Garden party', 'Przyjęcie w ogrodzie'], ['wedding', 'Wedding guest', 'Gość weselny'],
  ['school', 'First day of school', 'Pierwszy dzień szkoły'], ['ranch', 'Cowboy ranch', 'Na ranczu'], ['farm', 'A day on the farm', 'Dzień na farmie'],
  ['detective', 'Detective', 'Detektyw'], ['star', 'Superstar on stage', 'Gwiazda na scenie'], ['pyjama', 'Cozy pyjama day', 'Leniwy dzień w piżamie'],
  ['beach', 'Beach day', 'Dzień na plaży'], ['cafe', 'Date at a café', 'Randka w kawiarni'], ['rain', 'Rainy day', 'Deszczowy dzień'],
  ['tale', 'Straight from a fairy tale', 'Prosto z bajki'], ['explorer', 'Jungle explorer', 'Odkrywca dżungli'], ['chef', 'Chef in the kitchen', 'Szef kuchni'],
  ['space', 'Trip to space', 'Wyprawa w kosmos'], ['snow', 'Snow day', 'Śnieżny dzień'], ['picnic', 'Picnic in the park', 'Piknik w parku'],
  ['gym', 'Gym time', 'Czas na siłownię'], ['mask', 'Masquerade', 'Bal maskowy'], ['black', 'All in black', 'Cały na czarno'],
  ['rainbow', 'Every colour of the rainbow', 'Wszystkie kolory tęczy'], ['seventies', 'Back in the 70s', 'Powrót do lat 70.'], ['magic', 'Magic school', 'Szkoła magii'],
  ['festival', 'Summer festival', 'Letni festiwal'], ['office', 'Big day at the office', 'Ważny dzień w biurze'], ['camp', 'Camping trip', 'Pod namiotem'],
];
export const TWISTS = [
  ['gold', 'Twist: something gold', 'Haczyk: coś złotego'], ['hold', 'Twist: hold something', 'Haczyk: coś w dłoni'], ['nohat', 'Twist: no hat', 'Haczyk: bez czapki'],
  ['glasses', 'Twist: glasses or a mask', 'Haczyk: okulary albo maska'], ['pink', 'Twist: something pink', 'Haczyk: coś różowego'], ['back', 'Twist: something on your back', 'Haczyk: coś na plecach'],
  ['hair', 'Twist: a new hairstyle', 'Haczyk: nowa fryzura'], ['shoes', 'Twist: show off your shoes', 'Haczyk: pokaż buty'],
];
// A theme a player wrote is kept as '*' + their text (ids never start with '*').
export const themeName = id => { if (typeof id === 'string' && id[0] === '*') return id.slice(1); const t = THEMES.find(x => x[0] === id); return t ? L(t[1], t[2]) : ''; };
// Theme vote before each round: PICK_N random themes plus one written theme per player, at most WRITE_MAX characters.
export const PICK_N = 3, WRITE_MAX = 40;
// A written theme: no control or invisible characters, spaces squashed, at most WRITE_MAX characters ('' = not usable).
export function cleanTheme(s) {
  const t = String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/[\u00ad\u061c\u115f\u1160\u180e\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\ufffb]/g, '')
    .replace(/\s+/g, ' ').trim();
  const c = Array.from(t).slice(0, WRITE_MAX).join('').trim();
  return /[\p{L}\p{N}]/u.test(c) ? c : '';
}
export const twistName = id => { const t = TWISTS.find(x => x[0] === id); return t ? L(t[1], t[2]) : ''; };

// What can be changed for the show. Body, height, skin and the face stay yours, so friends still know who is walking.
export const FREE_KEYS = ['hair', 'hairC', 'facial', 'marks', 'top', 'bottom', 'botC', 'shoes', 'shoeC', 'hat', 'glasses', 'neck', 'back', 'hand'];
// The poses at the end of the runway, free for everyone.
export const POSES = [['wave', 'Wave', 'Machanie'], ['twirl', 'Twirl', 'Obrót'], ['cheer', 'Cheer', 'Hurra']];
export const poseName = i => POSES[i] ? L(POSES[i][1], POSES[i][2]) : '';

export const ROUNDS = [2, 3, 5], TIMES = [60, 90, 120];

// A look's stars: with 5 or more judges the highest and the lowest vote are dropped. Points = average × 20.
export function scoreLook(stars) {
  const s = stars.filter(v => Number.isInteger(v) && v >= 1 && v <= 5).sort((a, b) => a - b);
  const used = s.length >= 5 ? s.slice(1, -1) : s;
  const avg = used.length ? used.reduce((a, b) => a + b, 0) / used.length : 0;
  return { avg: Math.round(avg * 100) / 100, pts: Math.round(avg * 20), n: s.length, fives: s.filter(v => v === 5).length };
}

// The world's weather: the same for everyone, worked out from the clock alone, in 40 minute spells. A rainbow follows rain.
// Weather never takes anything away. Each kind gives one small Pet Farm bonus while it lasts (short: the few words the hub strip shows).
// Small on purpose: the hub shows it too, without loading the Pet Farm data (games/farm/data.js re-exports all of this).
import { L } from './i18n.js';

export const WEATHER = {
  sunny:   { name: L('Sunny', 'Słonecznie'), bonus: L('Parties that set off now bring home 20% more.', 'Drużyny, które wyruszą teraz, przyniosą 20% więcej.'), short: L('+20% trip loot', '+20% łupów z wypraw') },
  cloudy:  { name: L('Cloudy', 'Pochmurno'), bonus: L('Cool air: battles give 25% more experience.', 'Chłodne powietrze: bitwy dają 25% więcej doświadczenia.'), short: L('+25% battle XP', '+25% XP z bitew') },
  rain:    { name: L('Rain', 'Deszcz'), bonus: L('Each garden plot you pick gives one extra berry.', 'Każda zebrana grządka daje jedną jagodę więcej.'), short: L('+1 berry per plot', '+1 jagoda z grządki') },
  wind:    { name: L('Windy', 'Wietrznie'), bonus: L('A tailwind: parties that set off now are back 20% sooner.', 'Wiatr w plecy: drużyny, które wyruszą teraz, wrócą 20% szybciej.'), short: L('Trips back 20% sooner', 'Wyprawy wracają 20% szybciej') },
  rainbow: { name: L('Rainbow', 'Tęcza'), bonus: L('Lucky: parties that set off now are far more likely to meet a wild pet.', 'Szczęście: drużyny, które wyruszą teraz, o wiele łatwiej spotkają dzikiego zwierzaka.'), short: L('More wild pets on trips', 'Więcej dzikich zwierzaków') },
};
export const WEATHER_MS = 40 * 60_000;
const wHash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const wRaw = n => { const r = wHash(n); return r < .42 ? 'sunny' : r < .62 ? 'cloudy' : r < .8 ? 'rain' : 'wind'; };
/** The weather at a moment: { kind, left (ms until it changes), name, bonus }. */
export function weatherAt(ms = Date.now()) {
  const n = Math.floor(ms / WEATHER_MS), raw = wRaw(n), kind = raw !== 'rain' && wRaw(n - 1) === 'rain' ? 'rainbow' : raw;
  return { kind, left: (n + 1) * WEATHER_MS - ms, ...WEATHER[kind] };
}
/** The next spell: { kind, name } (it starts when the current one's `left` runs out). */
export const weatherNext = (ms = Date.now()) => { const w = weatherAt(ms); return weatherAt(ms + w.left + 1); };

// Tiny pictures for each kind, plus the moon for a clear night.
export const WX_ICON = {
  sunny: '<circle cx="12" cy="12" r="5" fill="#ffc94d" stroke="#5a3a2e" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#5a3a2e" stroke-width="2" stroke-linecap="round"/>',
  cloudy: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18z" fill="#fff" stroke="#5a3a2e" stroke-width="2" stroke-linejoin="round"/>',
  rain: '<path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 14z" fill="#cfe0f0" stroke="#5a3a2e" stroke-width="2" stroke-linejoin="round"/><path d="M8 17l-1 4M12 17l-1 4M16 17l-1 4" stroke="#4f9df0" stroke-width="2" stroke-linecap="round"/>',
  wind: '<path d="M3 9h10a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h6" fill="none" stroke="#5a3a2e" stroke-width="2" stroke-linecap="round"/>',
  rainbow: '<path d="M3 18a9 9 0 0 1 18 0" fill="none" stroke="#e8615a" stroke-width="2.4"/><path d="M6 18a6 6 0 0 1 12 0" fill="none" stroke="#ffc94d" stroke-width="2.4"/><path d="M9 18a3 3 0 0 1 6 0" fill="none" stroke="#6fb7e8" stroke-width="2.4"/>',
  moon: '<path d="M16 3a9 9 0 1 0 5 13A7.5 7.5 0 0 1 16 3z" fill="#fff3b8" stroke="#5a3a2e" stroke-width="2" stroke-linejoin="round"/>',
};
export const wxIcon = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${WX_ICON[k] || ''}</svg>`;
// Night on the player's own clock (the same hours as the Pet Farm sky): a sunny spell is a clear night then.
export const isNight = h => h < 4.6 || h >= 21;
// The sky between day and night (Kuba, 2026-11-26): instead of jumping at 21:00 and 4:36 it passes through a dusk and a
// dawn. skyPhase(hour) gives n, how far into night it is (0 day .. 1 night), g, how strong the warm dawn or dusk glow
// is (0 .. 1), and dawn (morning or evening colours). Full night still starts at 21:00 and ends at 4:36, like isNight.
//   hour, night, glow
const SKY_PHASES = [[0, 1, 0], [4.6, 1, 0], [5.3, .55, .6], [6.1, .12, 1], [7.2, 0, 0], [18.8, 0, 0], [19.8, .12, 1], [20.5, .6, .6], [21, 1, 0], [24, 1, 0]];
export function skyPhase(h) {
  h = ((h % 24) + 24) % 24; let i = 0; while (i < SKY_PHASES.length - 2 && SKY_PHASES[i + 1][0] <= h) i++;
  const A = SKY_PHASES[i], B = SKY_PHASES[i + 1], t = Math.min(1, Math.max(0, (h - A[0]) / (B[0] - A[0]))), u = t * t * (3 - 2 * t);
  return { n: A[1] + (B[1] - A[1]) * u, g: A[2] + (B[2] - A[2]) * u, dawn: h < 12 };
}
// The glow's colours: the sky overhead, the horizon, the light from the sky, the low sun, and the clouds it lights up.
export const GLOW = {
  dawn: { top: '#7fb2ee', low: '#ffd0c0', hemi: '#ffe6d6', sun: '#ffc392', cloud: '#ffd8e2' },
  dusk: { top: '#6f8ee0', low: '#ffb48a', hemi: '#ffd2b8', sun: '#ffa468', cloud: '#ffc2a8' },
};

// How each kind looks in the hub and the minigames (weather3d.js, the hub sky in style.css). Pet Farm keeps its own,
// stronger mix in games/farm/scene3d.js; the games stay brighter so boards and cards read as well as on a sunny day.
//   sky: how much of the sky's own colour is kept (the rest goes grey); hemi, sun: light strength kept;
//   fall: rain (or snow in winter); wind: streaks blowing past; bow: the rainbow; clouds: how grey the clouds get.
export const WX_LOOK = {
  sunny:   { sky: 1,   hemi: 1,   sun: 1,   fall: 0, wind: 0, bow: 0, clouds: 0 },
  cloudy:  { sky: .78, hemi: .96, sun: .78, fall: 0, wind: 0, bow: 0, clouds: .45 },
  rain:    { sky: .62, hemi: .93, sun: .66, fall: 1, wind: 0, bow: 0, clouds: .7 },
  wind:    { sky: .94, hemi: 1,   sun: .96, fall: 0, wind: 1, bow: 0, clouds: .1 },
  rainbow: { sky: 1,   hemi: 1,   sun: 1,   fall: 0, wind: 0, bow: 1, clouds: 0 },
};

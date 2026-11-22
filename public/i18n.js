// The site's two languages, English and Polish. Text is written in place as L('English', 'Polish'), so the Polish sits
// right next to the English it translates: when you change one, change the other. Missing Polish falls back to English.
// Long texts (game rules) and what the server says have their Polish in public/lang/.
//
// Which language: the visitor's own pick (saved in this browser, and on the account when logged in), else what the
// server guessed from where the visit comes from (data-geo on <html>: Poland gets Polish), else the browser's language.
// Switching reloads the page, so text worked out once at load (game rules, item names) is always in the right language.
//
// Shared with the server (ranks, pet names, item names), which has no document and always gets English.
export const LANGS = ['en', 'pl'];
const KEY = 'ct_lang';
const doc = globalThis.document;
function saved() { try { const v = globalThis.localStorage?.getItem(KEY); return LANGS.includes(v) ? v : ''; } catch { return ''; } }
function guess() {
  const geo = doc?.documentElement.dataset.geo;
  if (LANGS.includes(geo)) return geo;
  return /^pl\b/i.test(globalThis.navigator?.language || '') ? 'pl' : 'en';
}
// (Tests may set CT_LANG=pl to read the Polish texts in Node.)
export const LANG = doc ? saved() || guess() : globalThis.process?.env?.CT_LANG === 'pl' ? 'pl' : 'en';
export const PL = LANG === 'pl';
export const LOCALE = PL ? 'pl-PL' : 'en-GB';
if (doc) doc.documentElement.lang = LANG;

/** The text in the current language: L('Play', 'Graj'). */
export const L = (en, pl) => PL && pl != null ? pl : en;
/** Did this visitor pick the language themselves (rather than the guess)? */
export const picked = () => !!saved();

// Switch language: remember it and reload. onSwitch lets the hub also save it on the account first.
let onSwitch = null;
export const onLangSwitch = fn => { onSwitch = fn; };
export function setLang(l, reload = true) {
  if (!LANGS.includes(l)) return;
  try { localStorage.setItem(KEY, l); } catch {}
  onSwitch?.(l);
  // Only reload when the pick was really saved: otherwise the page would come back in the old language, and again…
  if (reload && l !== LANG && saved() === l) setTimeout(() => location.reload(), 60); // a moment for the account message to go out
}

/** A number written the local way: 1,234 or 1 234. */
export const num = n => Number(n || 0).toLocaleString(LOCALE);
// Polish plurals have three forms: 1 moneta, 2–4 monety (but 12–14 monet), 5+ monet.
export function plForm(n, one, few, many) {
  n = Math.abs(n);
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
}
/**
 * A count with its word in either language: cnt(3, 'coin', 'coins', 'moneta', 'monety', 'monet') → "3 coins" / "3 monety".
 * English many defaults to one + 's'. Polish forms default to the English ones (for words like "XP").
 */
export function cnt(n, one, many = one + 's', p1, p2 = p1, p5 = p2) {
  return `${num(n)} ${PL && p1 ? plForm(n, p1, p2, p5) : n === 1 ? one : many}`;
}
/** Only the word for a count, without the number. */
export const word = (n, one, many = one + 's', p1, p2 = p1, p5 = p2) => PL && p1 ? plForm(n, p1, p2, p5) : n === 1 ? one : many;
/** 1st, 2nd, 3rd… / 1., 2., 3. */
export const ord = n => PL ? `${n}.` : n + ([, 'st', 'nd', 'rd'][n % 100 >> 3 ^ 1 && n % 10] || 'th');
// The handful of words every game's settings and buttons use.
const COMMON = {
  On: 'Wł.', Off: 'Wył.', Yes: 'Tak', No: 'Nie', Chill: 'Luźne', Sharp: 'Ostre', Normal: 'Normalnie', Fast: 'Szybko', Random: 'Losowo', Classic: 'Klasycznie',
  Players: 'Gracze', Bots: 'Boty', 'Turn timer': 'Czas na ruch', Close: 'Zamknij', Done: 'Gotowe', Leave: 'Wyjdź', 'Play again': 'Zagraj jeszcze raz',
  'Back to the waiting room': 'Wróć do poczekalni', 'Back to the table': 'Wróć do stołu', Rules: 'Zasady', 'How to play': 'Jak grać', Sound: 'Dźwięk',
  'Sound on': 'Włącz dźwięk', 'Sound off': 'Wyłącz dźwięk', Mute: 'Wycisz', Unmute: 'Włącz dźwięk', You: 'Ty', you: 'ty', Bot: 'Bot', bot: 'bot', Host: 'Gospodarz',
  Winner: 'Zwycięzca', Wins: 'Wygrywa', Results: 'Wyniki', Round: 'Runda', Turn: 'Tura', Score: 'Wynik', Points: 'Punkty', pts: 'pkt', Coins: 'Monety', coins: 'monet',
  'Your turn': 'Twoja kolej', 'Your turn!': 'Twoja kolej!', Waiting: 'Czekamy', 'Waiting…': 'Czekamy…', Start: 'Start', Next: 'Dalej', Back: 'Wstecz', Pass: 'Pas',
};
/** A common word in the current language (falls back to the word itself). */
export const t = s => PL ? COMMON[s] ?? s : s;

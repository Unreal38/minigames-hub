// What the server says, in Polish. The server always answers in English (errors, notes, a few chat lines); the page
// passes that text through srvText() before showing it. Exact sentences are looked up in TEXT, sentences with a name or
// a number in them are matched by the patterns in FORMS. Anything not listed is shown as the server sent it, so a new
// server message works right away and only needs its Polish added here.
import { PL, plForm } from '../i18n.js';

const TEXT = {
  // tables
  'That table is full.': 'Ten stół jest pełny.',
  'That player is not around any more.': 'Tego gracza już tu nie ma.',
  'That pet is not on your farm.': 'Tego zwierzaka nie ma na twojej farmie.',
  'Slow down a little: too many new tables.': 'Zwolnij trochę: za dużo nowych stołów.',
  'Too many wrong codes. Wait a few minutes and try again.': 'Za dużo błędnych kodów. Odczekaj kilka minut i spróbuj ponownie.',
  'No table with that code. Check the letters?': 'Nie ma stołu z takim kodem. Sprawdź litery.',
  'Every seat is taken. You will get the next free one.': 'Wszystkie miejsca są zajęte. Dostaniesz następne wolne.',
  'This account was deleted, as asked. You are a guest now.': 'To konto zostało usunięte na twoją prośbę. Grasz teraz jako gość.',
  'The password of your account was changed, so this device was logged out. Log in again with the new password.': 'Hasło do twojego konta zostało zmienione, więc to urządzenie zostało wylogowane. Zaloguj się ponownie nowym hasłem.',
  // accounts
  'Something went wrong. Try again.': 'Coś poszło nie tak. Spróbuj ponownie.',
  'Passwords need 6 to 72 characters.': 'Hasło musi mieć od 6 do 72 znaków.',
  'Usernames are 3–16 letters, numbers, dots, dashes or underscores.': 'Nazwa użytkownika to 3–16 liter, cyfr, kropek, myślników lub podkreśleń.',
  'That username is taken.': 'Ta nazwa użytkownika jest zajęta.',
  'Wrong username or password.': 'Błędna nazwa użytkownika lub hasło.',
  'Your current password is not right.': 'Obecne hasło się nie zgadza.',
  'That password is not right.': 'To hasło się nie zgadza.',
  'That username and code do not match.': 'Ta nazwa użytkownika i kod do siebie nie pasują.',
  'Too many tries. Wait a minute and try again.': 'Za dużo prób. Odczekaj minutę i spróbuj ponownie.',
  'Too many wrong tries. Wait 15 minutes and try again.': 'Za dużo błędnych prób. Odczekaj 15 minut i spróbuj ponownie.',
  'Lots of new accounts were made from here just now. Try again in an hour.': 'Przed chwilą założono stąd dużo nowych kont. Spróbuj ponownie za godzinę.',
  'Log in first.': 'Najpierw się zaloguj.',
  'You already have the Supporter pack.': 'Masz już Pakiet wspierających.',
  'Ko-fi is not connected to this site yet.': 'Ko-fi nie jest jeszcze połączone z tą stroną.',
  'That does not look like an email address.': 'To nie wygląda na adres e-mail.',
  'No Ko-fi payment waiting for that email. It can take a minute to arrive.': 'Nie ma wpłaty z Ko-fi czekającej na ten e-mail. Może dotrzeć dopiero po minucie.',
  'Too many tries. Wait a few minutes and try again.': 'Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.',
  'Not connected.': 'Brak połączenia.',
  'Unknown.': 'Nieznane polecenie.',
  'Slow down a little.': 'Zwolnij trochę.',
  // the shop and the wardrobe
  'That is not in the shop.': 'Tego nie ma w sklepie.',
  'You already have that.': 'Już to masz.',
  'You have not unlocked that yet.': 'To jeszcze nie jest odblokowane.',
  'Log in to bring a pet along.': 'Zaloguj się, żeby zabrać ze sobą zwierzaka.',
  'That is not a pet.': 'To nie jest zwierzak.',
  'Log in and start a Pet Farm to decorate your isle.': 'Zaloguj się i załóż Farmę zwierzaków, żeby ozdobić swoją wyspę.',
  'That decoration is not on your farm.': 'Tej ozdoby nie ma na twojej farmie.',
  // friends
  'Create an account to add friends.': 'Załóż konto, żeby dodawać znajomych.',
  'That is you!': 'To przecież ty!',
  'That player has no account yet, so they cannot be added.': 'Ten gracz nie ma jeszcze konta, więc nie da się go dodać.',
  'That player has no account yet. Once they create one, add them by the username they chose.': 'Ten gracz nie ma jeszcze konta. Gdy je założy, dodaj go po wybranej nazwie użytkownika.',
  'More than one player uses that name. Ask your friend for their username: it is shown at the top of their Friends list.': 'To imię ma więcej niż jeden gracz. Zapytaj znajomego o nazwę użytkownika: widać ją na górze jego listy Znajomych.',
  'Nobody has that username. Your friend can find theirs at the top of their own Friends list.': 'Nikt nie ma takiej nazwy użytkownika. Znajomy znajdzie swoją na górze własnej listy Znajomych.',
  'That request is gone.': 'Tego zaproszenia już nie ma.',
  'They have too many requests waiting.': 'Ta osoba ma za dużo oczekujących zaproszeń.',
  'Your friends list is full.': 'Twoja lista znajomych jest pełna.',
  // hub chat
  'Log in or make an account to chat.': 'Zaloguj się albo załóż konto, żeby pisać na czacie.',
  'Easy there: one message at a time.': 'Spokojnie: jedna wiadomość naraz.',
  'You just said that.': 'To już było przed chwilą.',
  'You are sending messages very fast. Wait a few seconds.': 'Wiadomości lecą bardzo szybko. Odczekaj kilka sekund.',
  'That is a lot of chat for one hour. Take a little break.': 'To dużo pisania jak na jedną godzinę. Zrób sobie małą przerwę.',
  // Mystery Pet and Hay Hunch
  'Solve it first, then share.': 'Najpierw rozwiąż zagadkę, potem się nią podziel.',
  'You already shared today’s result.': 'Dzisiejszy wynik jest już udostępniony.',
  'You already solved today’s Mystery Pet.': 'Dzisiejsza zagadka Mystery Pet jest już rozwiązana.',
  'You already tried that one.': 'Ten zwierzak już był zgadywany.',
  'Unknown move.': 'Nieznany ruch.',
  'Finish this field first.': 'Najpierw dokończ to pole.',
  'Finish this shelf first.': 'Najpierw dokończ tę półkę.',
  'No pet there.': 'Tam nie ma zwierzaka.',
  'Flip a bale first.': 'Najpierw odwróć jakąś belę.',
  'No bale there.': 'Tam nie ma beli.',
};
const SEASON = { 'Winter drop': 'kolekcji zimowej', 'Spring drop': 'kolekcji wiosennej', 'Summer drop': 'kolekcji letniej', 'Halloween drop': 'kolekcji halloweenowej' };
const BACK = { 'mid-November': 'w połowie listopada', March: 'w marcu', June: 'w czerwcu', October: 'w październiku' };
// [pattern, how to say it]: the function gets the captured pieces.
const FORMS = [
  [/^That is part of the (.+)\. It is back in (.+)\.$/, (s, b) => `To część ${SEASON[s] || s}. Wraca ${BACK[b] || b}.`],
  [/^You already asked (.+)\.$/, u => `Zaproszenie do gracza ${u} jest już wysłane.`],
  [/^You and (.+) are already friends\.$/, u => `Ty i ${u} już jesteście znajomymi.`],
  [/^You need (\d+) more coins for that\.$/, n => `Brakuje ci na to ${n} ${plForm(+n, 'monety', 'monet', 'monet')}.`],
  [/^You're already signed in as (.+)\.$/, u => `Zalogowano cię już jako ${u}.`],
  [/^Your isle has room for (\d+) decorations\.$/, n => `Na twojej wyspie zmieści się ${n} ozdób.`],
  [/^🐾 Mystery Pet #(\d+): solved in (\d+) guess(?:es)?(?: · 🔥 (\d+) days in a row)?$/, (no, n, d) => `🐾 Mystery Pet #${no}: ${n} ${plForm(+n, 'próba', 'próby', 'prób')}${d ? ` · 🔥 ${d} dni z rzędu` : ''}`],
];
/** More sentences for a part of the site that loads later (Pet Farm adds its own). */
export function addServerText(text = {}, forms = []) { Object.assign(TEXT, text); FORMS.push(...forms); }

/** A message from the server in the page's language. */
export function srvText(msg) {
  if (!PL || typeof msg !== 'string') return msg;
  if (TEXT[msg]) return TEXT[msg];
  for (const [re, say] of FORMS) { const m = msg.match(re); if (m) return say(...m.slice(1)); }
  return msg;
}

// What the server says, in Polish. The server always answers in English (errors, notes, a few chat lines); the page
// passes that text through srvText() before showing it. Exact sentences are looked up in TEXT, sentences with a name or
// a number in them are matched by the patterns in FORMS. Anything not listed is shown as the server sent it, so a new
// server message works right away and only needs its Polish added here.
import { PL, plForm } from '../i18n.js';

const TEXT = {
  // Lantern Night
  'The chat opens at meetings. Talk on voice, or find a sleeper and ring the bell.': 'Czat otwiera się na naradach. Rozmawiajcie na głosowym albo znajdź śpiocha i zadzwoń dzwonem.',
  // the plaza
  'Log in or make an account to hang an ornament.': 'Zaloguj się albo załóż konto, żeby zawiesić ozdobę.',
  'Walk up to the tree first.': 'Najpierw podejdź do choinki.',
  'Give the tree a moment before changing your ornament again.': 'Odczekaj chwilę, zanim znów zmienisz ozdobę.',
  'Log in or make an account to open the present.': 'Zaloguj się albo załóż konto, żeby otworzyć prezent.',
  'A host has muted you for a few minutes.': 'Gospodarz wyciszył cię na kilka minut.',
  // reports and the hosts' moderation (mod.js)
  'A host has muted you.': 'Gospodarz cię wyciszył.',
  'You can’t report yourself.': 'Nie możesz zgłosić samego siebie.',
  'Pick what happened first.': 'Najpierw wybierz, co się stało.',
  'Write a few words about what happened.': 'Napisz kilka słów o tym, co się stało.',
  'You already reported this player. The hosts will have a look.': 'Ten gracz jest już przez ciebie zgłoszony. Gospodarze się temu przyjrzą.',
  'You have sent a lot of reports. Try again later.': 'Wysłano już dużo zgłoszeń. Spróbuj później.',
  'Only hosts can do that.': 'Może to zrobić tylko gospodarz.',
  'Hosts can’t be muted, warned or banned.': 'Gospodarzy nie da się wyciszyć, ostrzec ani zablokować.',
  'Write the reason: the player is shown it.': 'Wpisz powód: gracz go zobaczy.',
  'Pick how long first.': 'Najpierw wybierz, na jak długo.',
  // tables
  'That table is full.': 'Ten stół jest pełny.',
  'This game needs at least two players. Invite a friend first.': 'Do tej gry potrzeba co najmniej dwóch graczy. Najpierw zaproś znajomego.',
  'That player is not around any more.': 'Tego gracza już tu nie ma.',
  'That pet is not on your farm.': 'Tego zwierzaka nie ma na twojej farmie.',
  'Slow down a little: too many new tables.': 'Zwolnij trochę: za dużo nowych stołów.',
  'Too many wrong codes. Wait a few minutes and try again.': 'Za dużo błędnych kodów. Odczekaj kilka minut i spróbuj ponownie.',
  'No table with that code. Check the letters?': 'Nie ma stołu z takim kodem. Sprawdź litery.',
  'Every seat is taken. You will get the next free one.': 'Wszystkie miejsca są zajęte. Dostaniesz następne wolne.',
  'You are already playing at this table on another screen. This one watches.': 'Grasz już przy tym stole na innym ekranie. Ten tylko ogląda.',
  'This account was deleted, as asked. You are a guest now.': 'To konto zostało usunięte na twoją prośbę. Grasz teraz jako gość.',
  'The password of your account was changed, so this device was logged out. Log in again with the new password.': 'Hasło do twojego konta zostało zmienione, więc to urządzenie zostało wylogowane. Zaloguj się ponownie nowym hasłem.',
  // accounts
  'Something went wrong. Try again.': 'Coś poszło nie tak. Spróbuj ponownie.',
  'Type your username exactly to confirm.': 'Wpisz dokładnie swoją nazwę użytkownika, żeby potwierdzić.',
  'Host accounts cannot be deleted here. Use the delete-account command on the server.': 'Konta gospodarza nie da się tu usunąć. Użyj polecenia delete-account na serwerze.',
  'Several accounts were deleted from here just now. Try again in an hour.': 'Stąd usunięto przed chwilą kilka kont. Spróbuj ponownie za godzinę.',
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
  'You have no star to light there.': 'Nie masz gwiazdy, którą można tu zapalić.',
  'Constellations unlock at the last rank.': 'Gwiazdozbiory odblokujesz po ostatniej randze.',
  'Finish that constellation first.': 'Najpierw ukończ ten gwiazdozbiór.',
  'Slow down a little.': 'Zwolnij trochę.',
  // site notices (maintenance)
  'An update is coming, so new games are on hold until it is done. Games already running carry on.': 'Zaraz będzie aktualizacja, więc nowe gry są wstrzymane do jej końca. Trwające gry toczą się dalej.',
  'Pick 1 to 120 minutes.': 'Wybierz od 1 do 120 minut.',
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
  'Create an account to invite friends.': 'Załóż konto, żeby zapraszać znajomych.',
  'You can only invite your friends.': 'Zapraszać możesz tylko swoich znajomych.',
  'That friend is not on the site right now.': 'Tej osoby nie ma teraz na stronie.',
  'You just invited them. Give them a moment to answer.': 'Zaproszenie już wysłane. Daj chwilę na odpowiedź.',
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
  'You already had today’s spin. Come back tomorrow.': 'Dzisiejszy obrót już za tobą. Wróć jutro.',
  'You already solved today’s Mystery Pet.': 'Dzisiejszy Zagadkowy zwierzak jest już odgadnięty.',
  'You already tried that one.': 'Ten zwierzak już był zgadywany.',
  'Today’s word is already finished.': 'Dzisiejsze słowo jest już skończone.',
  'Finish today’s word first, then share.': 'Najpierw dokończ dzisiejsze słowo, potem się nim podziel.',
  'Unknown move.': 'Nieznany ruch.',
  'Finish this field first.': 'Najpierw dokończ to pole.',
  'Finish this shelf first.': 'Najpierw dokończ tę półkę.',
  'Finish this board first.': 'Najpierw dokończ tę planszę.', 'This board is finished.': 'Ta plansza jest już skończona.',
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
  [/^This game needs at least (\d+) players\. Invite more friends first\.$/, n => `Do tej gry potrzeba co najmniej ${n} graczy. Najpierw zaproś więcej znajomych.`],
  [/^You need (\d+) more coins for that\.$/, n => `Brakuje ci na to ${n} ${plForm(+n, 'monety', 'monet', 'monet')}.`],
  [/^You're already signed in as (.+)\.$/, u => `Zalogowano cię już jako ${u}.`],
  [/^Your isle has room for (\d+) decorations\.$/, n => `Na twojej wyspie zmieści się ${n} ozdób.`],
  [/^You can keep (\d+) outfits\.$/, n => `Możesz mieć najwyżej ${n} strojów.`],
  [/^📜 Word in a Bottle #(\d+) \((PL|EN)\): ([\dX])\/(\d)(?: · 🔥 (\d+) days in a row)?$/, (no, l, n, of, d) => `📜 Słowo w butelce #${no} (${l}): ${n}/${of}${d ? ` · 🔥 ${d} dni z rzędu` : ''}`],
  [/^🐾 Mystery Pet #(\d+): solved in (\d+) guess(?:es)?(?: · 🔥 (\d+) days in a row)?$/, (no, n, d) => `🐾 Zagadkowy zwierzak #${no}: ${n} ${plForm(+n, 'próba', 'próby', 'prób')}${d ? ` · 🔥 ${d} dni z rzędu` : ''}`],
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

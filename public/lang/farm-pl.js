// Pet Farm in Polish: the names and descriptions from games/farm/data.js, breed.js and battle.js. Each of those files
// hands its own tables to the matching function here when the page is in Polish, and the text is swapped in place.
// Species keep their names (they are made-up words); everything else is translated. A new item, species, zone, move
// and so on needs its Polish here: test/i18n.js fails when one is missing.
export const EL_PL = { Leaf: 'Liść', Ember: 'Żar', Tide: 'Fala', Spark: 'Iskra', Stone: 'Kamień' };

const MATS = { wood: 'Drewno', stone: 'Kamień', fiber: 'Włókno', shells: 'Muszle', coal: 'Węgiel', crystal: 'Kryształ', berries: 'Jagody', sunberry: 'Słoneczne jagody', cookie: 'Jagodowe ciastka', cake: 'Miodowe ciasta', juice: 'Sok jagodowy', pie: 'Słoneczne tarty', tonic: 'Toniki wypoczynku', coins: 'Monety' };
const MAT_INFO = {
  wood:     ['Wyprawy, najwięcej z Omszałego Lasu.', 'Większość budynków i ozdób.'],
  stone:    ['Wyprawy, najwięcej z Kamykowej Grani.', 'Budynki, ścieżki i kamienne ozdoby.'],
  fiber:    ['Wyprawy do Omszałego Lasu i Zatoczki Pływów.', 'Chatki, Gniazdo, miękkie ozdoby i Miodowe ciasta.'],
  shells:   ['Wyprawy do Zatoczki Pływów (dom na poziomie 2).', 'Ulepszanie budynków i wyszukane ozdoby.'],
  coal:     ['Wyprawy na Żarzące Wzgórza (dom na poziomie 3).', 'Wyższe poziomy budynków i wyszukane ozdoby.'],
  crystal:  ['Rzadki. Wyprawy na Kamykową Grań (dom na poziomie 2) i Burzową Łąkę (poziom 4). Dłuższe wyprawy z większą liczbą zwierzaków znajdują więcej.', 'Gniazdo, najwyższe poziomy budynków i najbardziej wyszukane ozdoby.'],
  berries:  ['Rosną na Grządkach co godzinę. Dotknij „Zbierz jagody”.', 'Gotowanie smakołyków w Kuchni. Nadmiar wymienisz w Warsztacie.'],
  sunberry: ['Grządki na poziomie 2 lub 3 dają je przy każdych zbiorach.', 'Najlepsze przepisy w Kuchni: Słoneczna tarta i Tonik wypoczynku.'],
  cookie:   ['Pieczone w Kuchni z 4 jagód.', 'Dotknij zwierzaka i podaj mu jedno: 30 doświadczenia.'],
  cake:     ['Pieczone w Kuchni z 10 jagód i 5 włókien.', 'Dotknij zwierzaka i podaj mu jedno: 90 doświadczenia.'],
  juice:    ['Robiony w Kuchni z 6 jagód.', 'Wypity w bitwie treningowej lub na arenie leczy 40%, raz na bitwę.'],
  pie:      ['Pieczone w Kuchni na poziomie 2.', 'Dotknij zwierzaka i podaj mu jedną: 220 doświadczenia.'],
  tonic:    ['Robione w Kuchni na poziomie 3.', 'Podaj odpoczywającemu zwierzakowi, żeby od razu mógł wrócić do Gniazda.'],
  coins:    ['Bitwy, pomaganie sąsiadom i inne gry w Zatoce.', 'Drzewa i krzewy tutaj oraz sklep z ubraniami na stronie głównej. Monety zostają u ciebie: nie można ich wymieniać ani dawać w prezencie.'],
};
// [name, description]
const ITEMS = {
  house: ['Dom', 'Nie ma jak w domu. Większy dom otwiera nowe miejsca do zwiedzania.'],
  hut: ['Chatka zwierzaków', 'Przytulne miejsce do spania dla czterech kolejnych zwierzaków.'],
  lodge: ['Schronisko zwierzaków', 'Duży, przytulny dom, w którym 60 kolejnych zwierzaków drzemie pod dachem, ułożonych we własne kolekcje. Dalej mogą chodzić wszędzie i robić wszystko.'],
  gate: ['Brama wypraw', 'Stąd zwierzaki ruszają balonem i wracają z materiałami, a czasem z nowym przyjacielem.'],
  garden: ['Grządka', 'Kawałek ziemi. Co godzinę dojrzewają tu jagody.'],
  kitchen: ['Kuchnia', 'Zamienia jagody w smakołyki dla zwierzaków.'],
  barn: ['Stodoła', 'Miejsce na trzy razy więcej materiałów.'],
  nest: ['Gniazdo', 'Dwa zwierzaki tu odpoczywają i pojawia się jajko.'],
  yard: ['Plac treningowy', 'Zwierzaki ćwiczą tu swoje ruchy z przyjaznymi partnerami.'],
  flag: ['Flaga areny', 'Stąd wyzywasz inne farmy i wybierasz drużynę, która broni twojej.'],
  mailbox: ['Skrzynka pocztowa', 'Trafiają tu prezenty i listy od znajomych.'],
  workshop: ['Warsztat', 'Odblokowuje wyszukane ozdoby i wymienia zbędne materiały na te, których potrzebujesz.'],
  fence: ['Płotek', 'Pilnuje porządku.'],
  path: ['Kamienna ścieżka', 'Zwierzaki lubią po niej spacerować.'],
  tree: ['Liściaste drzewo', 'Trochę cienia.'],
  pine: ['Sosna', 'Pachnie jak spacer po lesie.'],
  bush: ['Krzak', 'Okrągły i sympatyczny.'],
  flowers: ['Rabatka', 'Odrobina koloru.'],
  lamp: ['Latarnia', 'Ciepłe światełko.'],
  pond: ['Staw', 'Chłodna woda i liść lilii.'],
  bench: ['Ławka', 'Do patrzenia na przechodzące zwierzaki.'],
  rock: ['Omszały głaz', 'Chyba leży tu od zawsze.'],
  fountain: ['Fontanna', 'Pluska przez cały dzień.'],
  windmill: ['Wiatrak', 'Powoli kręci się na wyspowym wietrze.'],
  arch: ['Kwiatowy łuk', 'Zwierzaki uwielbiają pod nim przechodzić.'],
  statue: ['Pomnik zwierzaka', 'Mały, ale dumny.'],
  glow: ['Kryształowa lampa', 'Świeci łagodnie dniem i nocą.'],
  tower: ['Wieża do wspinania', 'Coś do wspinania, drapania i drzemek.'],
  cherry: ['Wiśnia', 'Różowe kwiaty przez cały rok.'],
  well: ['Studnia życzeń', 'Wrzuć monetę i pomyśl życzenie.'],
  scarecrow: ['Strach na wróble', 'Nikogo nie straszy. Zwierzaki myślą, że to kolega.'],
  campfire: ['Ognisko', 'Przytulne miejsce na wieczór.'],
  shrooms: ['Krąg grzybów', 'Czerwone kapelusze w małym kółku.'],
  picnic: ['Koc piknikowy', 'Koszyk, koc i słoneczne popołudnie.'],
  birdbath: ['Poidełko dla ptaków', 'Jeden ptaszek już się wprowadził.'],
  haybale: ['Bele siana', 'Ułożone w stos, w sam raz do wspinania.'],
  gazebo: ['Altana', 'Cienisty pawilon na środek farmy.'],
  swing: ['Huśtawka ogrodowa', 'Kołysze się lekko, nawet gdy nikt na niej nie siedzi.'],
  lighthouse: ['Mała latarnia morska', 'Pomaga balonom trafić do domu.'],
  hotspring: ['Gorące źródło', 'Ciepła woda i unosząca się para.'],
  rainbow: ['Tęczowy łuk', 'Tęcza, która nigdzie się nie wybiera.'],
  treehouse: ['Domek na drzewie', 'Kryjówka wśród gałęzi.'],
  palbench: ['Ławka przyjaciół', 'Ławka dla dwojga. Odblokowuje ją przyjaźń.'],
  palflag: ['Flaga przyjaźni', 'Chorągiewki, które mówią, że mieszkają tu przyjaciele.'],
  ball: ['Piłka dla zwierzaków', 'Zabawka dla zwierzaków.'],
  clover: ['Szczęśliwa koniczyna', 'Każdy listek ma cztery listki. Nagroda z Koła szczęścia.'],
  carousel: ['Mała karuzela', 'Kręci się cały dzień, z pasażerami albo bez. Nagroda z Koła szczęścia.'],
  chest: ['Skrzynia skarbów', 'Pełna po brzegi i o wiele za ciężka, żeby ją wynieść. Nagroda z Koła szczęścia.'],
  goldpet: ['Złoty posąg zwierzaka', 'Zwierzak z lśniącego złota. Nagroda z Koła szczęścia.'],
  balloon: ['Balon na uwięzi', 'Szarpie za linę, gdy tylko zerwie się wiatr. Nagroda z Koła szczęścia.'],
  coinfount: ['Fontanna z monetami', 'Ktoś wrzucił tu naprawdę dużo życzeń. Nagroda z Koła szczęścia.'],
  horseshoe: ['Brama z podkową', 'Przejdź pod nią na szczęście. Nagroda z Koła szczęścia.'],
  miniwheel: ['Małe Koło szczęścia', 'Małe koło, które nigdy nie zatrzymuje się na złym dniu. Nagroda z Koła szczęścia.'],
};
const BLURB = {
  mossbun: 'Króliczek, któremu na grzbiecie rośnie mech.',
  sproutle: 'Żółw z kiełkiem rosnącym na skorupie.',
  petalpuff: 'Puszysta owieczka w koronie z kwiatów.',
  acornip: 'Wiewiórka, która po wykluciu wygląda jak żołądź.',
  cindercub: 'Lisek z ogonem migoczącym jak płomień.',
  toastoad: 'Ropucha ciepła i złocista jak świeży tost.',
  flickit: 'Kurczaczek z płomykiem świecy na głowie.',
  lanternail: 'Ślimak, który zamiast muszli nosi ciepłą latarnię.',
  puddlepup: 'Mała foka, która nosi ze sobą własną kałużę.',
  bubblefin: 'Okrągła rybka unosząca się w bańce.',
  axolily: 'Aksolotl z liśćmi lilii zamiast skrzeli.',
  ripplet: 'Kaczątko z małą falą zakręconą na głowie.',
  zapkit: 'Kociak z błyskawicą zamiast ogona.',
  buzzlet: 'Pulchna pszczoła pokryta naelektryzowanym puszkiem.',
  voltvole: 'Chomik, któremu policzki świecą, gdy jest szczęśliwy.',
  wattbat: 'Puszysty nietoperz z błyskawicami zamiast uszu.',
  pebblet: 'Jeż z kamykami zamiast kolców.',
  cragcrab: 'Krab, który zamiast muszli nosi głaz.',
  dustmole: 'Kret, który nigdy nie zdejmuje małego kasku.',
  rubblet: 'Głaz, który sam układa się w łagodnego małego golema.',
  bambear: 'Mała panda, która hoduje własny pęd bambusa na przekąskę.',
  sizzlet: 'Smocze pisklę, które dopiero uczy się dmuchać płomykiem.',
  waddlet: 'Pingwinek w czapce z muszelki.',
  oinkwatt: 'Prosiaczek z zakręconym ogonkiem, który trzeszczy od iskier.',
  tricerock: 'Mały trójrożec z kryzą z wypolerowanego kamienia.',
  shrimplet: 'Różowa krewetka, która unosi się zwinięta jak przecinek i macha wachlarzem ogona.',
  siamew: 'Kot syjamski z czekoladowymi uszami i łapkami oraz szafirem na obroży.',
  coralcolt: 'Konik morski w koronie z różowego koralu.',
  skipfin: 'Delfin, który pływa w powietrzu z piłką plażową na nosie.',
  gingersnap: 'Rudy pręgowany kot w białych rękawiczkach. Po każdej drzemce przybywa mu jedna pręga.',
  patchkit: 'Trójkolorowa kotka calico ze stokrotką za uchem.',
  tuxpurr: 'Kot w smokingu, który nie wychodzi z domu bez muszki i cylindra.',
  fluffcoon: 'Wielki puszysty maine coon, który kocha śnieg i chlapanie się w kałużach.',
  munchmew: 'Kot munchkin z długim tułowiem, bardzo krótkimi łapkami i kokardą.',
  rocktopus: 'Ośmiornica, która chowa się wśród skał i układa kamyki na głowie.',
  driftle: 'Żółw morski, który szybuje w powietrzu z rozgwiazdą na skorupie.',
  zapuff: 'Rozdymka, która unosi się jak balon i trzeszczy, gdy się nadyma.',
  ottershell: 'Wydra, która nigdy nie wypuszcza z łapek ulubionej muszelki.',
  cinnapanda: 'Panda mała w kolorze cynamonu, z długim ogonem w paski.',
  yuzubara: 'Spokojna kapibara, która balansuje owocem yuzu na głowie.',
  snoozloth: 'Leniwiec, który na wszelki wypadek cały dzień nosi szlafmycę.',
  glidenut: 'Latająca wiewiórka o wielkich oczach, która szybuje na własnych fałdkach.',
  glazemew: 'Kot munchkin z piekarni, polukrowany na różowo jak mały pączek.',
  strawbun: 'Truskawkowy króliczek z piegami z pestek i kołnierzem z listków.',
  chilipup: 'Długi szczeniak papryczka chili z dymiącym, zakręconym ogonem.',
  melonwhale: 'Arbuzowy wieloryb z różowym plasterkiem zamiast brzucha.',
  lemonzest: 'Musujący cytrynowy kurczaczek z zawijasem skórki na głowie.',
  coconutkin: 'Kokosowy pancernik, któremu rośnie kiełek palmy.',
  pinepine: 'Ananasowy jeż z wysoką koroną z liści.',
  croissab: 'Krab croissant, którego dwa rogi to szczypce.',
  donuseal: 'Mała foka, która nosi lukrowanego pączka jak koło do pływania.',
  cupcowl: 'Sowa w papilotce od babeczki, z wisienką na czubku.',
  pretzelisk: 'Wąż, który zawiązuje się w solonego precla.',
  mallowlamb: 'Piankowe jagnię, po dorośnięciu przypieczone na wierzchu.',
  candraffe: 'Żyrafa z cukrowej laski, z różkami jak haczyki.',
  jellifrog: 'Przezroczysta galaretkowa żabka z kawałkami owoców w środku.',
  carrofox: 'Lis z marchewką zamiast ogona.',
  pumpkit: 'Kociak zwinięty w kłębek w dyni.',
  peapillar: 'Trzy groszki w strąku, które budzą się jeden po drugim.',
  shroomouse: 'Malutka myszka pod kapeluszem grzyba w kropki.',
  snowfox: 'Śnieżny lis z płatkiem śniegu na czole.',
  sunlion: 'Lwiątko z grzywą z promieni słońca.',
  dripfrog: 'Żabka kropelka, która dorasta, żeby nosić parasol z liścia.',
  twistret: 'Fretka, która jeździ na własnym małym wirze.',
  moonbun: 'Śpiący liliowy króliczek, który nosi kawałek księżyca.',
  starjelly: 'Meduza w kształcie gwiazdy ze świecącymi końcami.',
  cometail: 'Fretka szybka jak smuga, z kometą zamiast ogona.',
  ringbear: 'Senny niedźwiadek, który nosi pierścień planety.',
  truffowl: 'Okrągła sowa, której rośnie własny kapelusz grzyba.',
  magmutt: 'Szczeniak z lawy w płaszczu z popękanej skały.',
  nimbowhale: 'Malutki wieloryb, który nosi własną chmurę deszczową.',
  glimmoth: 'Ćma, której skrzydła świecą po zmroku.',
  geodeer: 'Jelonek z porożem z przejrzystego kryształu.',
  maplander: 'Salamandra z ogonem z jesiennego liścia, który nigdy nie przestaje świecić.',
  koalith: 'Kamiennoszary koala z mchem w uszach. Śpi jak kamień.',
  kettlephant: 'Słonik, który z radości gwiżdże parą.',
  bangaroo: 'Mały kangur, który na wyjątkowe dni trzyma w torbie fajerwerk.',
  magnebug: 'Żuk z magnesem zamiast rogu. Kamyki chodzą za nim krok w krok.',
};
const HINT = {
  truffowl: 'Wykluwa się tam, gdzie mech spotyka przypływ.',
  magmutt: 'Wykluwa się tam, gdzie ogień ogrzewa kamień.',
  nimbowhale: 'Wykluwa się tam, gdzie deszcz spotyka błyskawicę.',
  glimmoth: 'Wykluwa się tam, gdzie iskra spada na liść.',
  geodeer: 'Wykluwa się tam, gdzie woda żłobi kamień.',
  maplander: 'Wykluwa się tam, gdzie żar spada na suche liście.',
  koalith: 'Wykluwa się tam, gdzie mech porasta kamień.',
  kettlephant: 'Wykluwa się tam, gdzie ogień doprowadza wodę do wrzenia.',
  bangaroo: 'Wykluwa się tam, gdzie iskra spotyka płomień.',
  magnebug: 'Wykluwa się tam, gdzie piorun uderza w skałę.',
};
const FAMILIES = { cat: 'Koty', bunny: 'Króliki', fox: 'Lisy', frog: 'Żaby i ropuchy', bear: 'Niedźwiedzie', chick: 'Kurczaki', seal: 'Foki', hedgehog: 'Jeże', crab: 'Kraby', dog: 'Psy', whale: 'Wieloryby', owl: 'Sowy', ferret: 'Fretki', turtle: 'Żółwie', squirrel: 'Wiewiórki', sheep: 'Owce' };
const RARITY = ['Pospolity', 'Niepospolity', 'Rzadki', 'Tylko z jajka'];
const FORMS = ['Maluch', 'Podrostek', 'Dorosły'];
const UPGRADES = {
  hut: 'Dwa łóżka więcej',
  lodge: ['Miejsce dla 150 zwierzaków w środku', 'Miejsce dla 300 zwierzaków w środku'],
  gate: 'Jedna drużyna więcej może być na wyprawie',
  kitchen: ['Nowy przepis: Słoneczna tarta', 'Nowy przepis: Tonik wypoczynku'],
  workshop: ['Drugi zestaw ozdób i korzystniejsze wymiany', 'Najwspanialsze ozdoby i najlepsze wymiany'],
  garden: ['Dojrzewa 15 minut szybciej i za każdym razem daje słoneczną jagodę', 'Dojrzewa kolejne 15 minut szybciej i daje dwie słoneczne jagody'],
  barn: 'Miejsce na 600 sztuk więcej każdego materiału',
  nest: ['Drugie miejsce na jajko', 'Trzecie miejsce na jajko, a jajka wykluwają się o jedną czwartą szybciej'],
  yard: 'Jedno miejsce treningowe więcej',
  tower: { what: ['Zwierzaki zostają dwa razy dłużej: drapią słupek, łapią zabawkową myszkę i drzemią w koszyku', 'Zwierzaki zostają trzy razy dłużej: hamak, półka z koszykiem i kryjówka na szczycie, z której można wyglądać'],
    does: ['Zwierzaki wspinają się na szczyt i rozglądają.', 'Zwierzaki drapią słupek, łapią zabawkową myszkę i drzemią w koszyku na szczycie.', 'Zwierzaki drapią, łapią myszkę, bujają się w hamaku, myją się w koszyku i wyglądają z kryjówki.'] },
};
const WORK = {
  garden:  ['podlewa grządki', n => `Jagody dojrzewają o ${n}% szybciej`],
  nest:    ['dba o ciepło w Gnieździe', n => `Nowe jajka wykluwają się o ${n}% szybciej`],
  yard:    ['trenuje innych na placu', n => `Trening daje o ${n}% więcej doświadczenia`],
  gate:    ['ładuje balon', n => `Nowe drużyny wracają o ${n}% szybciej`],
  kitchen: ['pilnuje pieca', n => `${n}% szans na drugi smakołyk za darmo`],
};
const RECIPES = {
  cookie: ['Jagodowe ciastko', 'Podaj zwierzakowi: 30 doświadczenia.'],
  cake: ['Miodowe ciasto', 'Podaj zwierzakowi: 90 doświadczenia.'],
  juice: ['Sok jagodowy', 'Wypity w bitwie przywraca 40% zdrowia. Jeden na bitwę.'],
  pie: ['Słoneczna tarta', 'Podaj zwierzakowi: 220 doświadczenia.'],
  tonic: ['Tonik wypoczynku', 'Zwierzak, który go wypije, od razu jest wypoczęty i może wrócić do Gniazda.'],
};
const ZONES = {
  woods: ['Omszały Las', 'Wysokie drzewa i miękki mech.'],
  cove: ['Zatoczka Pływów', 'Ciepłe sadzawki pełne muszli.'],
  ridge: ['Kamykowa Grań', 'Skaliste ścieżki i błysk kryształu.'],
  hills: ['Żarzące Wzgórza', 'Ciepłe zbocza, które świecą nocą.'],
  meadow: ['Burzowa Łąka', 'Wysoka trawa, która trzeszczy przed deszczem.'],
  grove: ['Owocowy Gaj', 'Sady, w których owoce patrzą na ciebie.'],
  patch: ['Warzywna Grządka', 'Równe rządki, w których coś szeleści.'],
  bakery: ['Piekarniany Klif', 'Ciepłe piece i zapach świeżego chleba.'],
  sweets: ['Wyspa Słodyczy', 'Lizakowe drzewa i lepki wietrzyk.'],
  reef: ['Rafa Koralowa', 'Rafa na niebie, gdzie morskie zwierzaki dryfują między koralami.'],
  peak: ['Szczyt Pogody', 'Słońce, śnieg i deszcz naraz.'],
  night: ['Wyspa Spadających Gwiazd', 'Wyspa, na której zawsze jest tuż po zmierzchu.'],
};
const TRIPS = { stroll: ['Spacer', 'Na czas gry'], outing: ['Wycieczka', 'Na przerwę obiadową'], trek: ['Wędrówka', 'Gdy masz inne zajęcia'], camp: ['Biwak', 'Na noc'] };
const WEATHER = {
  sunny: ['Słonecznie', 'Drużyny, które wyruszą teraz, przyniosą 20% więcej.'],
  cloudy: ['Pochmurno', 'Chłodne powietrze: bitwy dają 25% więcej doświadczenia.'],
  rain: ['Deszcz', 'Każda zebrana grządka daje jedną jagodę więcej.'],
  wind: ['Wietrznie', 'Wiatr w plecy: drużyny, które wyruszą teraz, wrócą 20% szybciej.'],
  rainbow: ['Tęcza', 'Szczęście: drużyny, które wyruszą teraz, o wiele łatwiej spotkają dzikiego zwierzaka.'],
};

/** data.js: D holds its tables. */
export function plData(D) {
  Object.assign(D.MATS, MATS); Object.assign(D.MAT_INFO, MAT_INFO);
  for (const [k, [name, desc]] of Object.entries(ITEMS)) if (D.ITEMS[k]) Object.assign(D.ITEMS[k], { name, desc });
  for (const [k, s] of Object.entries(D.SPECIES)) { if (BLURB[k]) s.blurb = BLURB[k]; if (HINT[k]) s.hint = HINT[k]; }
  for (const [k, f] of Object.entries(D.FAMILIES)) if (FAMILIES[k]) f[0] = FAMILIES[k];
  D.RARITY.splice(0, RARITY.length, ...RARITY); D.FORMS.splice(0, FORMS.length, ...FORMS);
  for (const [k, what] of Object.entries(UPGRADES)) if (D.UPGRADES[k]) Object.assign(D.UPGRADES[k], typeof what === 'string' || Array.isArray(what) ? { what } : what); // a decoration also has does
  for (const [k, [job, what]] of Object.entries(WORK)) if (D.WORK[k]) Object.assign(D.WORK[k], { job, what });
  for (const [k, [name, desc]] of Object.entries(RECIPES)) if (D.RECIPES[k]) Object.assign(D.RECIPES[k], { name, desc });
  for (const [k, [name, blurb]] of Object.entries(ZONES)) if (D.ZONES[k]) Object.assign(D.ZONES[k], { name, blurb });
  for (const [k, [name, blurb]] of Object.entries(TRIPS)) if (D.TRIPS[k]) Object.assign(D.TRIPS[k], { name, blurb });
  for (const [k, [name, bonus]] of Object.entries(WEATHER)) if (D.WEATHER[k]) Object.assign(D.WEATHER[k], { name, bonus });
}

const COATS = ['Naturalny', 'Różany', 'Błękitny', 'Miętowy', 'Liliowy', 'Kakaowy'];
const PATTERNS = { spots: 'Cętki', stripes: 'Paski', star: 'Gwiazdka', patch: 'Łata' };
// What a baby can borrow from the other side of its family. Used after a colon ("Może odziedziczyć: ...").
const PART = { mossbun: 'królicze uszy', sproutle: 'kiełek', petalpuff: 'korona z kwiatów', truffowl: 'kapelusz grzyba', cindercub: 'ogon z płomienia',
  toastoad: 'kostka masła', flickit: 'płomyk świecy', magmutt: 'kamienie z lawy', puddlepup: 'focze płetwy', bubblefin: 'płetwa jak żagiel', axolily: 'liść lilii',
  nimbowhale: 'chmura deszczowa', zapkit: 'ogon z błyskawicy', buzzlet: 'bzyczące skrzydełka', voltvole: 'iskrzący czubek', glimmoth: 'świecące skrzydła', pebblet: 'kolce z kamyków',
  shrimplet: 'ogon jak wachlarz', siamew: 'czekoladowy ogon', coralcolt: 'korona z koralu', skipfin: 'piłka plażowa',
  gingersnap: 'ogon w pręgi', patchkit: 'stokrotka', tuxpurr: 'cylinder', fluffcoon: 'puszysty ogon',
  munchmew: 'kokarda', glazemew: 'różowy lukier',
  rocktopus: 'stos kamyków', driftle: 'rozgwiazda', zapuff: 'kolce rozdymki', ottershell: 'ogon jak wiosło', cinnapanda: 'ogon w paski', yuzubara: 'owoc yuzu', snoozloth: 'szlafmyca', glidenut: 'fałdki do szybowania',
  cragcrab: 'skorupa z głazu', dustmole: 'kask', geodeer: 'kryształowe poroże', maplander: 'ogon z liścia klonu', koalith: 'gałązka eukaliptusa', kettlephant: 'pokrywka czajnika', bangaroo: 'rakieta fajerwerku', magnebug: 'róg z magnesu',
  acornip: 'czapeczka żołędzia', lanternail: 'muszla latarnia', ripplet: 'zawijas fali', wattbat: 'uszy błyskawice', rubblet: 'korona z klejnotów',
  bambear: 'pęd bambusa', sizzlet: 'smocze skrzydła', waddlet: 'czapka z muszelki', oinkwatt: 'zakręcony iskrzący ogonek', tricerock: 'kamienna kryza',
  strawbun: 'truskawkowa szypułka', chilipup: 'ogonek chili', melonwhale: 'plaster arbuza', lemonzest: 'zawijas skórki', coconutkin: 'kiełek palmy', pinepine: 'korona ananasa', croissab: 'croissant', donuseal: 'mały pączek', cupcowl: 'zawijas kremu', pretzelisk: 'kokarda z precla', mallowlamb: 'przypieczona pianka', candraffe: 'różki z cukrowej laski', jellifrog: 'trzęsąca się galaretka', carrofox: 'ogon marchewka', pumpkit: 'ogonek dyni', peapillar: 'strąk groszku', shroomouse: 'kapelusz w kropki', snowfox: 'śnieżny ogon', sunlion: 'korona z promieni słońca', dripfrog: 'parasol z liścia', twistret: 'mały wir', moonbun: 'kawałek księżyca', starjelly: 'szczęśliwa gwiazdka', cometail: 'ogon komety', ringbear: 'pierścień planety' };
const CATS = { siamew: 'Syjamskie znaczenia', gingersnap: 'Rude pręgi', patchkit: 'Łaty calico', tuxpurr: 'Smoking', fluffcoon: 'Brąz maine coona', munchmew: 'Złoty krem', glazemew: 'Złoty krem' };
const TALENTS = [
  ['Ranny ptaszek', 'W pierwszej turze bitwy zawsze rusza się pierwszy.'],
  ['Zbieracz', 'Jego drużyna przynosi z wypraw 10% więcej.'],
  ['Twardziel', '10% więcej zdrowia w bitwach.'],
  ['Pojętny uczeń', 'Zdobywa 10% więcej doświadczenia.'],
  ['Szczęśliwy talizman', 'Dzikie zwierzaki trochę częściej wracają z jego drużyną do domu.'],
  ['Domator', 'Po wizycie w Gnieździe odpoczywa o połowę krócej.'],
];
const STAR_NAME = ['Zdrowie', 'Atak', 'Obrona', 'Szybkość'];

/** breed.js */
export function plBreed(D) {
  D.COATS.forEach((c, i) => { if (COATS[i]) c.name = COATS[i]; });
  Object.assign(D.PATTERNS, PATTERNS); Object.assign(D.PART, PART); Object.assign(D.CATS, CATS);
  D.TALENTS.forEach((t, i) => { if (TALENTS[i]) [t.name, t.blurb] = TALENTS[i]; });
  D.STAR_NAME.splice(0, STAR_NAME.length, ...STAR_NAME);
}

const MOVES = { leafflick: 'Pstryk liściem', rootgrab: 'Chwyt korzeni', sunnap: 'Drzemka w słońcu', sweetscent: 'Słodki zapach', bloomburst: 'Wybuch kwiatów',
  sparknip: 'Iskrzący kąsek', singe: 'Przypalenie', warmup: 'Rozgrzewka', blazedash: 'Ognisty zryw',
  splash: 'Chlup', soak: 'Zmoczenie', bubbleshield: 'Tarcza z baniek', mend: 'Kojenie', tidalbump: 'Uderzenie fali',
  zap: 'Bzzt', dazeflash: 'Oślepiający błysk', quickstep: 'Szybki krok', thunderpounce: 'Gromowy skok',
  pebbletoss: 'Rzut kamykiem', dustcloud: 'Chmura pyłu', harden: 'Utwardzenie', boulderroll: 'Toczący się głaz' };
const STATUS = {
  rooted: ['Ukorzenienie', 'Połowa szybkości i nie da się go zmienić.'],
  singed: ['Przypalenie', 'Co turę traci trochę zdrowia.'],
  soaked: ['Przemoczenie', 'Obrona jest obniżona.'],
  dazed:  ['Oszołomienie', 'Może stracić turę.'],
};
const STAT_NAME = { atk: 'atak', def: 'obrona', spd: 'szybkość' };
const ROLE_NAME = { balanced: 'Zrównoważony', tank: 'Czołg', support: 'Wsparcie', fast: 'Szybki atakujący', glass: 'Szklane działo', trickster: 'Spryciarz', bruiser: 'Osiłek', healer: 'Uzdrowiciel' };

/** battle.js */
export function plBattle(D) {
  for (const [k, name] of Object.entries(MOVES)) if (D.MOVES[k]) D.MOVES[k].name = name;
  for (const [k, [name, blurb]] of Object.entries(STATUS)) if (D.STATUS[k]) Object.assign(D.STATUS[k], { name, blurb });
  Object.assign(D.STAT_NAME, STAT_NAME); Object.assign(D.ROLE_NAME, ROLE_NAME);
}

/** What test/i18n.js checks: every key of the English tables has Polish here. */
export const COVER = { MATS, MAT_INFO, ITEMS, SPECIES: BLURB, FAMILIES, UPGRADES, WORK, RECIPES, ZONES, TRIPS, WEATHER, PATTERNS, PART, MOVES, STATUS, ROLE_NAME };

// What the farm's server code says (server/farm.js), for srvText() in lang/server.js.
export const SRV_TEXT = {
  'You already have a farm.': 'Masz już farmę.',
  'The farm is full. Put something away first.': 'Farma jest pełna. Najpierw coś schowaj.',
  'Not enough materials for that.': 'Na to nie wystarczy materiałów.',
  'Build a Workshop first.': 'Najpierw zbuduj Warsztat.',
  'That spot is taken.': 'To miejsce jest zajęte.',
  'That is not on the farm any more.': 'Tego nie ma już na farmie.',
  'The farmhouse stays, but you can move it.': 'Dom zostaje, ale możesz go przesunąć.',
  'The Nest is in use right now.': 'Gniazdo jest teraz zajęte.',
  'Your pets are still out exploring.': 'Twoje zwierzaki są jeszcze na wyprawie.',
  'That is as good as it gets.': 'Lepiej już się nie da.',
  'Not enough materials for that yet.': 'Na to jeszcze nie wystarczy materiałów.',
  'Build a Training Yard first.': 'Najpierw zbuduj Plac treningowy.',
  'A pet that is out exploring cannot start training. Welcome it home first.': 'Zwierzak na wyprawie nie może zacząć treningu. Najpierw przywitaj go w domu.',
  'A pet that is cuddling in the Nest cannot train.': 'Zwierzak, który przytula się w Gnieździe, nie może trenować.',
  'The farm is as big as it gets.': 'Większa farma już nie będzie.',
  'A level 5 farmhouse makes room for a fourth Pet Hut.': 'Dom na poziomie 5 robi miejsce na czwartą Chatkę zwierzaków.',
  'Build a Pet Lodge first.': 'Najpierw zbuduj Schronisko zwierzaków.',
  'The Pet Lodge is full. Improve it to make room for more.': 'Schronisko jest pełne. Ulepsz je, żeby zmieścić więcej zwierzaków.',
  'Every bed on the island is taken. Build or improve a Pet Hut first.': 'Wszystkie łóżka na wyspie są zajęte. Najpierw zbuduj albo ulepsz Chatkę zwierzaków.',
  'One of them is stored in the Pet Lodge. Move it out to the island first.': 'Jeden z nich jest w Schronisku. Najpierw przenieś go na wyspę.',
  'One of them is out exploring. Welcome it home first.': 'Jeden z nich jest na wyprawie. Najpierw przywitaj go w domu.',
  'One of them is busy in the Nest.': 'Jeden z nich jest zajęty w Gnieździe.',
  'Keep at least one pet out on the island.': 'Zostaw na wyspie przynajmniej jednego zwierzaka.',
  'That collection is gone.': 'Tej kolekcji już nie ma.',
  'Only pets stored in the Lodge go into its collections.': 'Do kolekcji trafiają tylko zwierzaki ze Schroniska.',
  'Give it a name first.': 'Najpierw nadaj nazwę.',
  'Move the pets stored in the Lodge out first.': 'Najpierw wyprowadź zwierzaki ze Schroniska.',
  'Not enough materials to grow the land.': 'Na powiększenie ziemi nie wystarczy materiałów.',
  'The farmhouse is as grand as it gets.': 'Okazalszy dom już nie będzie.',
  'Not enough materials to improve the farmhouse.': 'Na ulepszenie domu nie wystarczy materiałów.',
  'Build an Expedition Gate first.': 'Najpierw zbuduj Bramę wypraw.',
  'One of them is cuddling in the Nest.': 'Jeden z nich przytula się w Gnieździe.',
  'Your pets are already out exploring.': 'Twoje zwierzaki są już na wyprawie.',
  'One of them is already out with another party.': 'Jeden z nich jest już na wyprawie z inną drużyną.',
  'One of them is promised in a trade.': 'Jeden z nich jest w ofercie wymiany.',
  'Pick one to three of your pets.': 'Wybierz od jednego do trzech swoich zwierzaków.',
  'Nobody is out exploring.': 'Nikogo nie ma na wyprawie.',
  'They are not back yet.': 'Jeszcze nie wrócili.',
  'Nothing is ripe yet.': 'Nic jeszcze nie dojrzało.',
  'There is no room for more berries. Cook some, or build a Storage Barn.': 'Nie ma miejsca na więcej jagód. Ugotuj coś z nich albo zbuduj Stodołę.',
  'Build a Kitchen first.': 'Najpierw zbuduj Kuchnię.',
  'Not enough for that recipe yet.': 'Na ten przepis jeszcze nie wystarczy.',
  'You have none of those left.': 'Nie masz już tego.',
  'You do not have that many to sell.': 'Nie masz tyle na sprzedaż.',
  'The Workshop swaps materials now. Open it again to swap.': 'Warsztat teraz wymienia materiały. Otwórz go jeszcze raz, żeby coś wymienić.',
  'Coins cannot be traded. They stay with you.': 'Monet nie można wymieniać. Zostają u ciebie.',
  'The Workshop cannot do that swap.': 'Warsztat nie zrobi takiej wymiany.',
  'Coins cannot be gifted. They stay with you.': 'Monet nie można dawać w prezencie. Zostają u ciebie.',
  'That cannot be a gift.': 'To nie może być prezentem.',
  'You do not have enough of that to swap.': 'Masz za mało, żeby to wymienić.',
  'There is no room for that many. Spend some, or build a Storage Barn.': 'Nie ma na tyle miejsca. Wydaj trochę albo zbuduj Stodołę.',
  'Build a Nest first.': 'Najpierw zbuduj Gniazdo.',
  'The Nest is busy.': 'Gniazdo jest zajęte.',
  'That farm is not around any more.': 'Tej farmy już nie ma.',
  'That pet is not open for playdates.': 'Ten zwierzak nie bierze udziału we wspólnych zabawach.',
  'One playdate a day with each friend.': 'Jedna wspólna zabawa dziennie z każdym znajomym.',
  'Pick two different pets.': 'Wybierz dwa różne zwierzaki.',
  'One of them is still resting.': 'Jeden z nich jeszcze odpoczywa.',
  'One of them is away exploring.': 'Jeden z nich jest na wyprawie.',
  'One of them is already in the Nest.': 'Jeden z nich jest już w Gnieździe.',
  'One of them is training at the yard. Take it off training first.': 'Jeden z nich trenuje na placu. Najpierw zakończ jego trening.',
  'There is no egg.': 'Nie ma jajka.',
  'The egg is not ready yet.': 'Jajko nie jest jeszcze gotowe.',
  'There is no bed for the baby. Build a Pet Hut first.': 'Nie ma łóżka dla malucha. Najpierw zbuduj Chatkę zwierzaków.',
  'Three pets can be open for playdates at once.': 'We wspólnych zabawach mogą brać udział najwyżej trzy zwierzaki naraz.',
  'Put something in the offer first.': 'Najpierw dodaj coś do oferty.',
  'You have five offers waiting already.': 'Masz już pięć oczekujących ofert.',
  'You already have an offer waiting with them.': 'Masz już oczekującą ofertę u tego gracza.',
  'One of those pets cannot be traded right now.': 'Jednego z tych zwierzaków nie da się teraz wymienić.',
  'One of their pets cannot be traded right now.': 'Jednego ze zwierzaków drugiej strony nie da się teraz wymienić.',
  'You do not have that much to offer.': 'Nie masz tyle do zaoferowania.',
  'That offer is gone.': 'Tej oferty już nie ma.',
  'One of the pets they ask for cannot be traded right now.': 'Jednego ze zwierzaków, o które prosi druga strona, nie da się teraz wymienić.',
  'You do not have what they ask for.': 'Nie masz tego, o co prosi druga strona.',
  'You need another bed first. Build a Pet Hut.': 'Najpierw potrzebujesz kolejnego łóżka. Zbuduj Chatkę zwierzaków.',
  'Their farm has no bed free for your pet.': 'Na tamtej farmie nie ma wolnego łóżka dla twojego zwierzaka.',
  'Every farm keeps at least one pet.': 'Na każdej farmie musi zostać przynajmniej jeden zwierzak.',
  'You have helped here as much as you can today.': 'Na dziś to już cała pomoc, jakiej można tu udzielić.',
  'One gift a day for each neighbour.': 'Jeden prezent dziennie na sąsiada.',
  'Your Workshop cannot make that yet.': 'Twój Warsztat jeszcze tego nie robi.',
  'You do not have the materials for that.': 'Nie masz na to materiałów.',
  'You do not have enough of that to give.': 'Masz tego za mało, żeby dać.',
  'Build a Mailbox to open your mail.': 'Zbuduj Skrzynkę pocztową, żeby otwierać pocztę.',
  'That is not in your mailbox any more.': 'Tego nie ma już w twojej skrzynce.',
  'Your Lucky Wheel prize is in the Mailbox!': 'Nagroda z Koła szczęścia czeka w Skrzynce pocztowej!',
  'That one only comes from the Lucky Wheel.': 'To można zdobyć tylko na Kole szczęścia.',
  'There is no bed free. Build a Pet Hut and the baby will wait here.': 'Nie ma wolnego łóżka. Zbuduj Chatkę zwierzaków, a maluch tu poczeka.',
  'You have no booster for that building.': 'Nie masz wzmocnienia do tego budynku.',
  'You need that building on your farm first.': 'Najpierw potrzebujesz tego budynku na farmie.',
  'A booster is already running there.': 'Tam już działa wzmocnienie.',
  'The wild pet has wandered off.': 'Dziki zwierzak już sobie poszedł.',
  'The pets that met it are busy right now.': 'Zwierzaki, które go spotkały, są teraz zajęte.',
  'Finish your battle first.': 'Najpierw dokończ swoją bitwę.',
  'Put up an Arena Flag first.': 'Najpierw postaw Flagę areny.',
  'They are in a battle right now.': 'Ten gracz właśnie walczy.',
  'That invitation has run out.': 'To zaproszenie już wygasło.',
  'One of you is already in a battle.': 'Jedno z was już walczy.',
  'One juice a battle.': 'Jeden sok na bitwę.',
  'You have no Berry Juice.': 'Nie masz Soku jagodowego.',
  'That is not possible right now.': 'Teraz się tak nie da.',
  'That pet is not here any more.': 'Tego zwierzaka już tu nie ma.',
  'Finish the battle first.': 'Najpierw dokończ bitwę.',
  'A gift for everyone just landed in your Mailbox!': 'W twojej Skrzynce pocztowej wylądował właśnie prezent dla wszystkich!',
  'Build a Garden Plot first.': 'Najpierw zbuduj Grządkę.',
  'Build a Expedition Gate first.': 'Najpierw zbuduj Bramę wypraw.',
  'Practice partners': 'Partnerzy treningowi',
};
const ZONE_EN = { 'Mossy Woods': 'woods', 'Tidepool Cove': 'cove', 'Pebble Ridge': 'ridge', 'Ember Hills': 'hills', 'Thunder Meadow': 'meadow', 'Fruit Grove': 'grove', 'Veggie Patch': 'patch', 'Bakery Bluff': 'bakery', 'Sweet Shop Isle': 'sweets', 'Coral Reef': 'reef', 'Weather Peak': 'peak', 'Starfall Isle': 'night' };
export const SRV_FORMS = [
  [/^You can only have (\d+) of those\.$/, n => `Możesz mieć najwyżej ${n} sztuk.`],
  [/^That needs a level (\d+) Workshop\.$/, n => `To wymaga Warsztatu na poziomie ${n}.`],
  [/^A Lodge holds up to (\d+) collections\.$/, n => `Schronisko mieści najwyżej ${n} kolekcji.`],
  [/^That needs a level (\d+) farmhouse\.$/, n => `To wymaga domu na poziomie ${n}.`],
  [/^Growing the land again needs a level (\d+) farmhouse\.$/, n => `Dalsze powiększanie ziemi wymaga domu na poziomie ${n}.`],
  [/^That needs (\d+) friendship points\. Help out and leave gifts to earn them\.$/, n => `To wymaga ${n} punktów przyjaźni. Zdobędziesz je, pomagając innym i zostawiając prezenty.`],
  [/^Level (\d+) needs a level \d+ farmhouse\.$/, n => `Poziom ${n} wymaga domu na poziomie ${n}.`],
  [/^All (\d+) of your parties are out\.$/, n => `Wszystkie twoje drużyny (${n}) są na wyprawie.`],
  [/^(.+) opens at farmhouse level (\d+)\.$/, (z, n) => `${ZONES[ZONE_EN[z]]?.[0] || z} otwiera się, gdy dom ma poziom ${n}.`],
  [/^That recipe needs a level (\d+) Kitchen\.$/, n => `Ten przepis wymaga Kuchni na poziomie ${n}.`],
  [/^(.+) is not tired\.$/, p => `${p} nie potrzebuje odpoczynku.`],
  [/^(.+) is busy in the Nest\.$/, p => `${p} jest teraz w Gnieździe.`],
  [/^(.+) is fully grown and just wants cuddles\.$/, p => `${p} jest już w pełni dorosły i chce się tylko przytulać.`],
  [/^(.+) is away exploring\.$/, p => `${p} jest na wyprawie.`],
  [/^Both pets need to be level (\d+) or higher\.$/, n => `Oba zwierzaki muszą mieć co najmniej poziom ${n}.`],
  [/^It needs to be level (\d+) first\.$/, n => `Najpierw musi mieć poziom ${n}.`],
  [/^(.+) is not here right now\. Live battles need both of you online\.$/, u => `${u} nie jest teraz online. Bitwa na żywo wymaga obecności obu stron.`],
  [/^Only (\w+) pets can work at the .+\.$/, e => `Tu mogą pracować tylko zwierzaki żywiołu ${EL_PL[e] || e}.`],
  [/^(.+) is out exploring\. Welcome it home first\.$/, p => `${p} jest na wyprawie. Najpierw przywitaj drużynę w domu.`],
  [/^(.+) is cuddling in the Nest\.$/, p => `${p} przytula się w Gnieździe.`],
  [/^(.+) is promised in a trade\. Take the offer back first\.$/, p => `${p} jest w ofercie wymiany. Najpierw wycofaj ofertę.`],
  [/^(.+) dropped by your farm\.$/, u => `${u} zagląda na twoją farmę.`],
  [/^Your trade offer to (.+) came back, because coins can no longer be traded\. Everything is back on your farm\.$/, u => `Twoja oferta wymiany dla gracza ${u} wróciła, bo monet nie można już wymieniać. Wszystko jest z powrotem na twojej farmie.`],
  [/^(.+) sent you a trade offer\.$/, u => `${u} przysyła ci ofertę wymiany.`],
  [/^(.+) said no to your trade offer\. Everything came back\.$/, u => `${u} odrzuca twoją ofertę wymiany. Wszystko wróciło na miejsce.`],
  [/^(.+) accepted your trade\. Your new things are on the farm\.$/, u => `${u} przyjmuje twoją wymianę. Nowe rzeczy są już na farmie.`],
  [/^(.+) cannot play right now\.$/, u => `${u} nie może teraz grać.`],
  [/^Build an? (Kitchen|Nest|Training Yard) first\.$/, b => ({ Kitchen: 'Najpierw zbuduj Kuchnię.', Nest: 'Najpierw zbuduj Gniazdo.', 'Training Yard': 'Najpierw zbuduj Plac treningowy.' })[b]],
];

/** A zone's Polish name from its English one (the server names zones in English). */
export const zonePl = en => ZONES[ZONE_EN[en]]?.[0] || en;
// Mystery Pet: the clue headings and values the server sends in English.
export const CLUE_PL = {
  Element: 'Żywioł', Home: 'Dom', Rarity: 'Rzadkość', Style: 'Styl', Colour: 'Kolor', Moves: 'Ruchy',
  'The Nest': 'Gniazdo', ...Object.fromEntries(Object.entries(ZONE_EN).map(([en, k]) => [en, ZONES[k][0]])),
  Common: RARITY[0], Uncommon: RARITY[1], Rare: RARITY[2], 'Breeding only': RARITY[3],
  Balanced: ROLE_NAME.balanced, Tank: ROLE_NAME.tank, Support: ROLE_NAME.support, 'Fast attacker': ROLE_NAME.fast, 'Glass cannon': ROLE_NAME.glass, Trickster: ROLE_NAME.trickster, Bruiser: ROLE_NAME.bruiser, Healer: ROLE_NAME.healer,
  White: 'Biały', Grey: 'Szary', Cream: 'Kremowy', Brown: 'Brązowy', Pink: 'Różowy', Red: 'Czerwony', Orange: 'Pomarańczowy', Yellow: 'Żółty', Green: 'Zielony', Blue: 'Niebieski', Purple: 'Fioletowy',
  ...EL_PL,
};
